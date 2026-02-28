// Correction ciblée : reset les paramètres Supabase au format correct n8n v2.8.3
// tableId = string simple "annonces" (pas resource locator)
// Garde la credential déjà liée (OhHpqtfIxQEcmmRX)

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
  // 1. Récupérer le workflow courant
  const { status, data: wf } = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`, null);
  if (status !== 200) { console.error('GET failed:', status); return; }
  console.log('Workflow récupéré:', wf.name, '|', wf.nodes.length, 'noeuds');

  // 2. Afficher l'état actuel des noeuds Supabase
  const supabaseNodes = wf.nodes.filter(n => n.type === 'n8n-nodes-base.supabase');
  console.log('\n=== Etat AVANT correction ===');
  supabaseNodes.forEach(n => {
    console.log('Noeud:', n.name);
    console.log('  parameters:', JSON.stringify(n.parameters));
    console.log('  credentials:', JSON.stringify(n.credentials));
    console.log('  typeVersion:', n.typeVersion);
  });

  // 3. Corriger les paramètres Supabase
  let fixed = 0;
  wf.nodes = wf.nodes.map(node => {
    if (node.type !== 'n8n-nodes-base.supabase') return node;

    // Reset complet des paramètres au format natif n8n v2.8.3
    node.parameters = {
      useCustomSchema: false,
      resource: 'row',
      operation: 'upsert',
      tableId: 'annonces',
      conflictColumns: 'Url_Https'
    };

    // S'assurer que la credential est bien liée
    node.credentials = {
      supabaseApi: {
        id: 'OhHpqtfIxQEcmmRX',
        name: 'Supabase account'
      }
    };

    fixed++;
    console.log('\nFixé:', node.name, '→ tableId: annonces');
    return node;
  });

  console.log('\n' + fixed, 'noeuds Supabase corrigés');

  // 4. Pousser le workflow corrigé
  const result = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' }
  });

  console.log('\nPUT status:', result.status);

  if (result.status === 200) {
    console.log('\n=== Etat APRES correction ===');
    const updatedSupabase = result.data.nodes.filter(n => n.type === 'n8n-nodes-base.supabase');
    updatedSupabase.forEach(n => {
      console.log('Noeud:', n.name);
      console.log('  parameters:', JSON.stringify(n.parameters));
      console.log('  credentials:', JSON.stringify(n.credentials));
    });
    console.log('\nWorkflow pret ! Lance le test dans n8n.');
  } else {
    console.error('Erreur:', JSON.stringify(result.data).substring(0, 500));
  }
}

main().catch(console.error);
