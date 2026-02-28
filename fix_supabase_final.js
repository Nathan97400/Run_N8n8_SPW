// Fix final : paramètres Supabase corrects + reload forcé via deactivate/activate
const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzAyY2NmNS1kOGU2LTQzYTAtYWEzYS00NmMxZDRkZjE0MmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWYzMjFhNGUtNWExMS00NGUxLTk5ZmYtYzRhNjQzNzMwY2NlIiwiaWF0IjoxNzcxOTMxMjY2LCJleHAiOjE3NzQ0OTc2MDB9.p63Tp_-Sq7l7Fr7pZm_38Jr6FK1K1mmdDKEi9Gu9lOs';
const WF_ID = 'ssvlV5ZZsZemSOUB';
const N8N_HOST = 'n8n-t0fe.onrender.com';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: N8N_HOST, port: 443, path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // 1. Récupérer le workflow
  const { status, data: wf } = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`, null);
  if (status !== 200) { console.error('GET failed:', status); return; }
  console.log('Workflow:', wf.name, '| actif:', wf.active);

  // 2. Corriger les noeuds Supabase avec le format minimal correct
  wf.nodes = wf.nodes.map(node => {
    if (node.type !== 'n8n-nodes-base.supabase') return node;

    // Format original minimal (sans useCustomSchema ni resource qui causent confusion)
    node.parameters = {
      operation: 'upsert',
      tableId: 'annonces',
      dataToSend: 'autoMapInputData',
      conflictColumns: 'Url_Https'
    };

    node.credentials = {
      supabaseApi: { id: 'OhHpqtfIxQEcmmRX', name: 'Supabase account' }
    };

    node.typeVersion = 1;
    console.log('Corrigé:', node.name);
    return node;
  });

  // 3. Pousser
  const r1 = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' }
  });
  console.log('PUT status:', r1.status);
  if (r1.status !== 200) {
    console.error('PUT failed:', JSON.stringify(r1.data).substring(0, 300));
    return;
  }

  // Vérifier
  const sup = r1.data.nodes.filter(n => n.type === 'n8n-nodes-base.supabase');
  sup.forEach(n => console.log('Stocké:', n.name, '→', JSON.stringify(n.parameters)));

  // 4. Si le workflow est actif : deactivate + activate pour forcer reload en mémoire
  if (wf.active) {
    console.log('\nWorkflow actif → deactivate...');
    const deact = await apiRequest('PATCH', `/api/v1/workflows/${WF_ID}/deactivate`, {});
    console.log('Deactivate:', deact.status);
    await new Promise(r => setTimeout(r, 1000));
    const act = await apiRequest('PATCH', `/api/v1/workflows/${WF_ID}/activate`, {});
    console.log('Activate:', act.status);
  } else {
    console.log('\nWorkflow inactif (test manuel) - pas de cycle activate');
  }

  console.log('\nFait. Ferme et rouvre le workflow dans n8n, puis relance le test.');
}

main().catch(console.error);
