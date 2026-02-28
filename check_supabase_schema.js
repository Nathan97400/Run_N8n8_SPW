// Récupère le schéma de la table annonces via l'API Supabase
const https = require('https');

const SUPA_URL = 'rlvxtvutmajmthtluyur.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdnh0dnV0bWFqbXRodGx1eXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMwMzA0OSwiZXhwIjoyMDg1ODc5MDQ5fQ.kWMD2APP6GmcNIKx9VgGiG7n2bI8qjEn9g-qhvWJhFA';

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: SUPA_URL, path,
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, raw: d }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // Option 1 : OpenAPI spec (liste toutes les tables et colonnes)
  const r = await get('/rest/v1/');
  const spec = JSON.parse(r.raw);

  const annonces = spec.definitions?.annonces;
  if (annonces) {
    console.log('Colonnes de la table "annonces" :');
    Object.entries(annonces.properties || {}).forEach(([col, def]) => {
      console.log(`  ${col} : ${def.type || def.format || JSON.stringify(def)}`);
    });
    if (annonces.required) {
      console.log('\nColonnes required:', annonces.required);
    }
  } else {
    console.log('Definitions disponibles:', Object.keys(spec.definitions || {}));
    console.log('Paths:', Object.keys(spec.paths || {}).slice(0, 20));
  }
}

main().catch(console.error);
