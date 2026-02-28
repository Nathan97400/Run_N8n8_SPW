// Remplace les noeuds Supabase par HTTP Request (upsert natif via REST API)
// Les credentials Supabase sont injectés directement dans les headers

const https = require('https');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzAyY2NmNS1kOGU2LTQzYTAtYWEzYS00NmMxZDRkZjE0MmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWYzMjFhNGUtNWExMS00NGUxLTk5ZmYtYzRhNjQzNzMwY2NlIiwiaWF0IjoxNzcxOTMxMjY2LCJleHAiOjE3NzQ0OTc2MDB9.p63Tp_-Sq7l7Fr7pZm_38Jr6FK1K1mmdDKEi9Gu9lOs';
const WF_ID = 'ssvlV5ZZsZemSOUB';
const N8N_HOST = 'n8n-t0fe.onrender.com';

const SUPA_URL = 'https://rlvxtvutmajmthtluyur.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdnh0dnV0bWFqbXRodGx1eXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMwMzA0OSwiZXhwIjoyMDg1ODc5MDQ5fQ.kWMD2APP6GmcNIKx9VgGiG7n2bI8qjEn9g-qhvWJhFA';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: N8N_HOST, port: 443, path, method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
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

// Génère les paramètres d'un noeud HTTP Request pour upsert Supabase
function makeHttpRequestParams(table, conflictCol) {
  return {
    method: 'POST',
    url: `${SUPA_URL}/rest/v1/${table}`,
    authentication: 'none',
    sendQuery: true,
    queryParameters: {
      parameters: [{ name: 'on_conflict', value: conflictCol }]
    },
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'apikey', value: SUPA_KEY },
        { name: 'Authorization', value: `Bearer ${SUPA_KEY}` },
        { name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' },
        { name: 'Content-Type', value: 'application/json' }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ $input.all().map(i => i.json) }}',
    options: {}
  };
}

async function main() {
  const { status, data: wf } = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`, null);
  if (status !== 200) { console.error('GET failed:', status); return; }
  console.log('Workflow:', wf.name, '|', wf.nodes.length, 'noeuds');

  // Afficher les connexions des noeuds Supabase
  const supNodes = wf.nodes.filter(n => n.type === 'n8n-nodes-base.supabase');
  console.log('\nNoeuds Supabase trouvés:', supNodes.map(n => n.name));

  // Remplacer chaque noeud Supabase par un HTTP Request
  wf.nodes = wf.nodes.map(node => {
    if (node.type !== 'n8n-nodes-base.supabase') return node;

    const table = 'annonces_claude_code_n8n';
    const conflictCol = 'url';

    const newNode = {
      ...node,
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      parameters: makeHttpRequestParams(table, conflictCol),
      credentials: {}  // plus besoin de credential Supabase
    };

    console.log(`Remplacé: "${node.name}" → HTTP Request (upsert ${table})`);
    return newNode;
  });

  // Pousser
  const result = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' }
  });

  console.log('\nPUT status:', result.status);
  if (result.status === 200) {
    const httpNodes = result.data.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest');
    console.log('Noeuds HTTP Request dans le workflow:', httpNodes.map(n => n.name));
    console.log('\nFait ! Recharge le workflow dans n8n et lance un test.');
  } else {
    console.error('Erreur:', JSON.stringify(result.data).substring(0, 400));
  }
}

main().catch(console.error);
