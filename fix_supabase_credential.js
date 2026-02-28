const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzAyY2NmNS1kOGU2LTQzYTAtYWEzYS00NmMxZDRkZjE0MmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWYzMjFhNGUtNWExMS00NGUxLTk5ZmYtYzRhNjQzNzMwY2NlIiwiaWF0IjoxNzcxOTMxMjY2LCJleHAiOjE3NzQ0OTc2MDB9.p63Tp_-Sq7l7Fr7pZm_38Jr6FK1K1mmdDKEi9Gu9lOs';
const WF_ID = 'ssvlV5ZZsZemSOUB';

function apiReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'n8n-t0fe.onrender.com', port: 443, path, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // 1. Lister les credentials disponibles
  const creds = await apiReq('GET', '/api/v1/credentials', null);
  console.log('Credentials disponibles:');
  if (creds.data.data) {
    creds.data.data.forEach(c => {
      console.log('  ID:', c.id, '| Name:', c.name, '| Type:', c.type);
    });
  } else {
    console.log(JSON.stringify(creds.data).substring(0, 300));
  }

  // Trouver la credential Supabase
  const supabaseCred = creds.data.data && creds.data.data.find(c =>
    c.type === 'supabaseApi' || c.name.toLowerCase().includes('supabase')
  );

  if (!supabaseCred) {
    console.log('\nAucune credential Supabase trouvée !');
    console.log('Va dans n8n → Credentials → créer une credential Supabase');
    return;
  }

  console.log('\nCredential Supabase trouvée:', supabaseCred.id, '-', supabaseCred.name);

  // 2. Récupérer le workflow
  const { data: wf } = await apiReq('GET', `/api/v1/workflows/${WF_ID}`, null);
  console.log('\nWorkflow:', wf.name, '|', wf.nodes.length, 'noeuds');

  // 3. Mettre à jour la credential dans les noeuds Supabase
  let fixed = 0;
  wf.nodes = wf.nodes.map(node => {
    if (node.type !== 'n8n-nodes-base.supabase') return node;
    node.credentials = {
      supabaseApi: {
        id: supabaseCred.id,
        name: supabaseCred.name
      }
    };
    fixed++;
    console.log('Credential liée à:', node.name, '→ ID:', supabaseCred.id);
    return node;
  });

  console.log('\n' + fixed, 'noeuds Supabase mis à jour');

  // 4. Envoyer
  const result = await apiReq('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' }
  });

  console.log('PUT status:', result.status);
  if (result.status === 200) {
    const sup = result.data.nodes.find(n => n.name === 'Supabase - Annonce Matchee');
    console.log('Credential ID dans workflow:', sup?.credentials?.supabaseApi?.id);
    console.log('tableId:', JSON.stringify(sup?.parameters?.tableId));
    console.log('\nWorkflow prêt ! Relance le test dans n8n.');
  } else {
    console.error('Erreur:', JSON.stringify(result.data).substring(0, 300));
  }
}

main().catch(console.error);
