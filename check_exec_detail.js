const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzAyY2NmNS1kOGU2LTQzYTAtYWEzYS00NmMxZDRkZjE0MmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWYzMjFhNGUtNWExMS00NGUxLTk5ZmYtYzRhNjQzNzMwY2NlIiwiaWF0IjoxNzcxOTMxMjY2LCJleHAiOjE3NzQ0OTc2MDB9.p63Tp_-Sq7l7Fr7pZm_38Jr6FK1K1mmdDKEi9Gu9lOs';
const EXEC_ID = process.argv[2] || '2';

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
  const r = await get(`/api/v1/executions/${EXEC_ID}`);
  const exec = r.data;

  console.log('=== Exécution', EXEC_ID, '===');
  console.log('Status:', exec.status);
  console.log('Démarré:', exec.startedAt);
  console.log('Fini:', exec.stoppedAt);
  console.log('Mode:', exec.mode);

  // Trouver le noeud en erreur
  const runData = exec.data?.resultData?.runData || {};
  const nodes = Object.keys(runData);
  console.log('\nNoeuds exécutés:', nodes.join(', '));

  // Chercher les erreurs
  nodes.forEach(nodeName => {
    const nodeRuns = runData[nodeName];
    nodeRuns.forEach((run, idx) => {
      if (run.error) {
        console.log('\n=== ERREUR dans:', nodeName, '===');
        console.log('Message:', run.error.message);
        console.log('Description:', run.error.description || '');
        if (run.error.cause) console.log('Cause:', JSON.stringify(run.error.cause).substring(0, 200));
      } else {
        // Afficher l'output du noeud
        const output = run.data?.main?.[0] || [];
        if (output.length > 0 && ['1st Match (EXCELLENT)', 'IF Matched OK ?', 'Rename Columns', 'Supabase - Annonce Matchee'].includes(nodeName)) {
          console.log('\n--- Output', nodeName, '(' + output.length + ' items) ---');
          // Premier item comme exemple
          const first = output[0]?.json;
          if (first) {
            const keys = ['matched_ok', 'matched_confidence', 'matched_marque', 'matched_modele', 'matched_score', 'Nom_annonce', 'Url_Https'];
            const preview = {};
            keys.forEach(k => { if (first[k] !== undefined) preview[k] = first[k]; });
            console.log('Premier item:', JSON.stringify(preview));
          }
        }
      }
    });
  });
}

main().catch(console.error);
