// Simulation locale du 1st Match avec données réelles
// Remplace $input.all() par les vraies données
const fs = require('fs');
const https = require('https');

function fetchModeles(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
      res.on('error', reject);
    });
  });
}

async function main() {
  const annonces = JSON.parse(fs.readFileSync(
    'JSON LBC/14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json', 'utf8'
  ));
  const modeles = await fetchModeles('https://nante.nathansouffrin7.workers.dev/');

  // Combiner comme le Merge append
  const allItems = [...annonces, ...modeles];

  // ========================================================
  // Extraire le code du 1st Match depuis le workflow JSON
  // ========================================================
  const w = JSON.parse(fs.readFileSync('Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json', 'utf8'));
  const matchNode = w.nodes.find(n => n.name === '1st Match (EXCELLENT)');
  let code1st = matchNode.parameters.jsCode;

  // Adapter pour Node.js local (remplacer $input.all())
  code1st = code1st.replace(
    'const allItems = $input.all().map(i => i.json);',
    'const allItems = __ALL_ITEMS__;'
  );

  // Créer la fonction wrapper
  const wrappedCode = `
(function(__ALL_ITEMS__) {
  ${code1st}
})(__DATA__);
`;

  // Utiliser les 50 premières annonces + tous les modèles pour test rapide
  const testItems = [...annonces.slice(0, 50), ...modeles];

  // Évaluer le code
  const fn = new Function('__DATA__', code1st.replace('const allItems = __ALL_ITEMS__;', 'const allItems = __DATA__;'));

  let results;
  try {
    results = fn(testItems);
  } catch (e) {
    console.error('Erreur lors de l\'exécution:', e.message);
    // Essayer avec eval
    try {
      const vm = require('vm');
      const ctx = vm.createContext({ __DATA__: testItems, console });
      results = vm.runInContext(
        code1st.replace('const allItems = __ALL_ITEMS__;', 'const allItems = __DATA__;').replace('const allItems = $input.all().map(i => i.json);', 'const allItems = __DATA__;'),
        ctx
      );
    } catch (e2) {
      console.error('Erreur vm:', e2.message);
      return;
    }
  }

  if (!results || !Array.isArray(results)) {
    console.log('Résultats invalides:', typeof results);
    return;
  }

  console.log('--- Résultats 1st Match (50 annonces) ---');
  console.log('Total items retournés:', results.length);

  const matched = results.filter(r => r.json.matched_ok === true);
  const high = results.filter(r => r.json.matched_confidence === 'HIGH');
  const medium = results.filter(r => r.json.matched_confidence === 'MEDIUM');
  const low = results.filter(r => r.json.matched_confidence === 'LOW');
  const none = results.filter(r => r.json.matched_confidence === 'NONE');
  const noModels = results.filter(r => r.json.matching_engine === '1ST_MATCH_NO_MODELS');

  console.log('matched_ok=true:', matched.length);
  console.log('Confidence HIGH:', high.length);
  console.log('Confidence MEDIUM:', medium.length);
  console.log('Confidence LOW:', low.length);
  console.log('Confidence NONE:', none.length);
  console.log('NO_MODELS (modèles non reçus!):', noModels.length);

  // Montrer les premiers matchés
  if (matched.length > 0) {
    console.log('\n--- Exemples de matchés ---');
    matched.slice(0, 5).forEach(r => {
      console.log(` ${r.json['text-headline-1-expanded'] || '?'} → ${r.json.matched_marque} ${r.json.matched_modele} [${r.json.matched_confidence}] score=${r.json.matched_score}`);
    });
  }

  // Montrer les premiers non-matchés
  const unmatched = results.filter(r => !r.json.matched_ok && r.json.matching_engine !== '1ST_MATCH_NO_MODELS');
  if (unmatched.length > 0) {
    console.log('\n--- Exemples non-matchés ---');
    unmatched.slice(0, 5).forEach(r => {
      console.log(` ${r.json['text-headline-1-expanded'] || '?'} → score=${r.json.matched_score} conf=${r.json.matched_confidence} raison=${r.json.reason_no_match || '?'}`);
    });
  }
}

main().catch(e => console.error('Fatal:', e.message, e.stack));
