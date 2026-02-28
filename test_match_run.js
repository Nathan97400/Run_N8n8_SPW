// Simulation complète du 1st Match avec vraies données
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
  // Charger les données
  const annonces = JSON.parse(fs.readFileSync(
    'JSON LBC/14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json', 'utf8'
  ));
  const modeles = await fetchModeles('https://nante.nathansouffrin7.workers.dev/');

  // Combiner comme le ferait le Merge Append
  const allItems = [...annonces, ...modeles];
  console.log('Total items (annonces + modèles):', allItems.length);
  console.log(' - Annonces:', annonces.length);
  console.log(' - Modèles:', modeles.length);

  // Vérifier les KTM dans la base modèles
  const ktmModeles = modeles.filter(m => (m.Marque || '').toLowerCase() === 'ktm');
  console.log('\nModèles KTM disponibles:', ktmModeles.length);
  ktmModeles.slice(0, 10).forEach(m => console.log(' -', m.Marque, m['Modèle'], m['Cylindrée (cc)'], m['Type (M/S/E)']));

  // Simulation rapide du check isModele / isAnnonce
  const pickFn = (obj, keys) => {
    for (const k of keys) {
      const v = obj && obj[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  };
  const getFn = (obj, ...keys) => pickFn(obj, keys);
  const getMarqueField = (m) => pickFn(m, ['Marque', 'marque', 'MARQUE', 'Brand', 'brand']) || '';
  const getModeleField = (m) => pickFn(m, ['Modèle', 'Modele', 'modele', 'Model', 'MODELE']) || '';

  let mCount = 0, aCount = 0, neitherCount = 0;
  for (const item of allItems) {
    const isModele = !!getMarqueField(item) && !!getModeleField(item) &&
      getFn(item, 'Cylindrée (cc)', 'Cylindree (cc)', 'Type (M/S/E)', 'Type(M/S/E)') !== '';
    const isAnnonce = getFn(item, 'text-body-1 (8)', 'text-headline-1-expanded', 'relative',
      'absolute href', 'Url_Https', 'annonce_url') !== '';
    if (isModele) mCount++;
    else if (isAnnonce) aCount++;
    else neitherCount++;
  }

  console.log('\n--- Résultat séparation ---');
  console.log('Modèles détectés:', mCount);
  console.log('Annonces détectées:', aCount);
  console.log('Ni l\'un ni l\'autre:', neitherCount);

  // Vérifier l'annonce KTM
  const ktmAnnonce = annonces[0];
  console.log('\n--- Annonce test (KTM 690 Duke R) ---');
  console.log('text-headline-1-expanded:', ktmAnnonce['text-headline-1-expanded']);
  console.log('text-body-1 (4):', ktmAnnonce['text-body-1 (4)']); // marque ?
  console.log('text-body-1 (6):', ktmAnnonce['text-body-1 (6)']); // année ?
  console.log('absolute href:', ktmAnnonce['absolute href']);
  console.log('CC dans href:', ktmAnnonce['text-body-1 href (5)'] || 'N/A');
}

main().catch(console.error);
