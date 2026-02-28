const https = require('https');
const fs = require('fs');

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
      res.on('end', () => resolve({ status: res.statusCode, raw: d }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // Exec 2 (erreur récente)
  const r2 = await get('/api/v1/executions/2?includeData=true');
  const exec2 = JSON.parse(r2.raw);

  // Sauvegarder le raw pour inspection
  fs.writeFileSync('exec2_raw.json', JSON.stringify(exec2, null, 2));
  console.log('exec2_raw.json sauvegardé');

  // Afficher la structure de haut niveau
  console.log('Keys top-level:', Object.keys(exec2));
  console.log('Status:', exec2.status);
  console.log('Finished:', exec2.finished);

  // Chercher l'erreur
  if (exec2.data) {
    console.log('\nKeys dans data:', Object.keys(exec2.data));
    if (exec2.data.resultData) {
      console.log('Keys dans resultData:', Object.keys(exec2.data.resultData));
      const runData = exec2.data.resultData.runData || {};
      const executedNodes = Object.keys(runData);
      console.log('\nNoeuds avec données:', executedNodes.length);
      executedNodes.forEach(n => console.log(' -', n));

      if (exec2.data.resultData.error) {
        console.log('\nErreur globale:', JSON.stringify(exec2.data.resultData.error).substring(0, 500));
      }
    }
    if (exec2.data.executionData) {
      console.log('\nexecutionData keys:', Object.keys(exec2.data.executionData));
    }
  }

  // Exec 1 (success)
  const r1 = await get('/api/v1/executions/1?includeData=true');
  const exec1 = JSON.parse(r1.raw);
  fs.writeFileSync('exec1_raw.json', JSON.stringify(exec1, null, 2));
  console.log('\n--- Exec 1 (SUCCESS) ---');
  console.log('Keys top-level:', Object.keys(exec1));
  const runData1 = exec1.data?.resultData?.runData || {};
  const nodes1 = Object.keys(runData1);
  console.log('Noeuds exécutés (exec 1):', nodes1.join(', ') || 'aucun');
}

main().catch(console.error);
