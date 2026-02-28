const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzAyY2NmNS1kOGU2LTQzYTAtYWEzYS00NmMxZDRkZjE0MmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWYzMjFhNGUtNWExMS00NGUxLTk5ZmYtYzRhNjQzNzMwY2NlIiwiaWF0IjoxNzcxOTMxMjY2LCJleHAiOjE3NzQ0OTc2MDB9.p63Tp_-Sq7l7Fr7pZm_38Jr6FK1K1mmdDKEi9Gu9lOs';

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'n8n-t0fe.onrender.com',
      path: path,
      headers: { 'X-N8N-API-KEY': API_KEY }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const r = await get('/api/v1/executions?limit=5&workflowId=ssvlV5ZZsZemSOUB');
  console.log('Status:', r.status);

  if (!r.data.data || r.data.data.length === 0) {
    console.log('Aucune exécution récente.');
    console.log('Pour tester : ouvre le workflow dans n8n et clique sur "Test Workflow"');
    return;
  }

  r.data.data.forEach(e => {
    console.log('---');
    console.log('ID:', e.id);
    console.log('Status:', e.status);
    console.log('Démarré:', e.startedAt);
    console.log('Fini:', e.stoppedAt || 'en cours...');
    if (e.status === 'error' && e.data) {
      console.log('Erreur:', JSON.stringify(e.data).substring(0, 200));
    }
  });
}

main().catch(console.error);
