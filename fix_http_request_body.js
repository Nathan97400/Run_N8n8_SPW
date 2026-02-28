// Met à jour les noeuds HTTP Request avec le bon mapping de champs vers Supabase
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
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch (e) { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Expression n8n qui mappe les champs du workflow → colonnes Supabase
// Utilisé pour les 2 noeuds (matchés et à revoir)
const BODY_EXPRESSION = `={{ $input.all().map(i => ({
  id:       (i.json.Url_Https || '').match(/\\/(\\d+)$/)?.[1] || null,
  titre:    i.json.Nom_annonce || null,
  url:      i.json.Url_Https || null,
  prix:     parseInt(String(i.json.Prix_affiche || '').replace(/[^\\d]/g, '')) || null,
  kilometrage: parseInt(String(i.json['Kilom\u00e9trage'] || i.json.Kilometrage || '').replace(/[^\\d]/g, '')) || 0,
  annee:    parseInt(String(i.json['ann\u00e9e du mod\u00e8le'] || i.json.annee_modele || '').replace(/[^\\d]/g, '')) || 0,
  cylindree: parseFloat(String(i.json.Cylindree_cc || '')) || null,
  marque:   i.json.matched_marque || null,
  modele:   i.json.matched_modele || null,
  generation: i.json.generation_label || null,
  description: i.json["Description de l'annonce"] || null,
  photo1:   i.json.Photo_1 || null,
  photo2:   i.json.Photo_2 || null,
  photo3:   i.json.Photo_3 || null,
  nb_photos_supplementaires: parseInt(String(i.json['nombre de photos supplémentaires'] || '0')) || 0,
  date_run: new Date().toISOString().split('T')[0]
})) }}`;

function makeParams(table = 'annonces_claude_code_n8n') {
  return {
    method: 'POST',
    url: `${SUPA_URL}/rest/v1/${table}`,
    authentication: 'none',
    sendQuery: true,
    queryParameters: {
      parameters: [{ name: 'on_conflict', value: 'url' }]  // colonne réelle dans Supabase
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
    jsonBody: BODY_EXPRESSION,
    options: {}
  };
}

async function main() {
  const { status, data: wf } = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`, null);
  if (status !== 200) { console.error('GET failed:', status); return; }
  console.log('Workflow:', wf.name);

  const SUPABASE_NODES = ['Supabase - Annonce Matchee', 'Supabase - Annonce A Revoir'];

  wf.nodes = wf.nodes.map(node => {
    if (!SUPABASE_NODES.includes(node.name)) return node;
    node.parameters = makeParams('annonces_claude_code_n8n');
    console.log('Mis à jour:', node.name);
    return node;
  });

  const result = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: { executionOrder: 'v1' }
  });

  console.log('PUT status:', result.status);
  if (result.status === 200) {
    console.log('OK — recharge le workflow dans n8n et relance le test.');
  } else {
    console.error('Erreur:', JSON.stringify(result.data).substring(0, 400));
  }
}

main().catch(console.error);
