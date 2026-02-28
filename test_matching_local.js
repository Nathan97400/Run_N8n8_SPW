// Test local complet : simule ce que fait n8n
// Annonces LBC réelles + Modèles workers.dev → 1st Match

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
  // 1. Charger les annonces LBC
  const annoncesRaw = JSON.parse(fs.readFileSync(
    'JSON LBC/14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json',
    'utf8'
  ));
  const annonces = Array.isArray(annoncesRaw) ? annoncesRaw : [annoncesRaw];
  console.log('Annonces chargées:', annonces.length);
  console.log('Champs premiers:', Object.keys(annonces[0]).slice(0, 15).join(', '));

  // 2. Charger les modèles
  const modeles = await fetchModeles('https://nante.nathansouffrin7.workers.dev/');
  console.log('Modèles chargés:', modeles.length);

  // 3. Simuler le scoring (juste compter les tiers)
  // Le scoring cherche marque/modele/cc/annee dans les champs LBC
  // Regardons quels champs contiennent les infos utiles pour l'isAnnonce check
  const firstAnnonce = annonces[0];
  const keys = Object.keys(firstAnnonce);
  console.log('\n--- Champs annonce (tous) ---');
  keys.forEach(k => {
    const v = firstAnnonce[k];
    if (v && String(v).trim()) console.log(' ', JSON.stringify(k), ':', String(v).substring(0, 60));
  });

  // 4. Test isAnnonce sur le premier item
  const get = (obj, ...ks) => {
    for (const k of ks) {
      const v = obj && obj[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  };

  const isAnnonce = get(firstAnnonce,
    'text-body-1 (8)', 'text-headline-1-expanded', 'relative',
    'absolute href', 'Url_Https', 'annonce_url') !== '';
  console.log('\nisAnnonce pour premier item:', isAnnonce);

  // Trouver le champ URL
  for (const k of keys) {
    if (String(firstAnnonce[k] || '').includes('leboncoin.fr') ||
        k.toLowerCase().includes('href') || k.toLowerCase().includes('url')) {
      console.log('  Candidat URL field:', JSON.stringify(k), '->', String(firstAnnonce[k]).substring(0, 80));
    }
  }

  // 5. Compter combien d'annonces sont détectées correctement
  let annonceCount = 0, notDetected = 0;
  for (const a of annonces.slice(0, 20)) {
    const ok = get(a, 'text-body-1 (8)', 'text-headline-1-expanded', 'relative',
      'absolute href', 'Url_Https', 'annonce_url') !== '';
    if (ok) annonceCount++;
    else notDetected++;
  }
  console.log('\nDétection isAnnonce (20 premiers):', annonceCount, 'détectés,', notDetected, 'ignorés');

  // 6. Chercher le champ avec l'URL dans les annonces
  console.log('\n--- Champs avec "href" ou "url" dans le nom ---');
  for (const k of keys) {
    if (k.toLowerCase().includes('href') || k.toLowerCase().includes('url')) {
      console.log(' ', JSON.stringify(k), ':', String(firstAnnonce[k] || '').substring(0, 80));
    }
  }
}

main().catch(console.error);
