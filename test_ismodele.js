const https = require('https');

https.get('https://nante.nathansouffrin7.workers.dev/', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const modeles = JSON.parse(data);
    console.log('Total modeles fetched:', modeles.length);
    console.log('Premier modele keys:', Object.keys(modeles[0]));
    console.log('Premier modele:', JSON.stringify(modeles[0], null, 2));

    const pickFn = (obj, keys) => {
      for (const k of keys) {
        const v = obj && obj[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return '';
    };
    const getFn = (obj, ...keys) => pickFn(obj, keys);
    const getMarqueField = (m) => pickFn(m, ['Marque', 'marque', 'MARQUE', 'Brand', 'brand']) || '';
    const getModeleField = (m) => pickFn(m, ['Modele', 'Modèle', 'modele', 'Model', 'MODELE']) || '';

    const item = modeles[0];
    const marque = getMarqueField(item);
    const modele = getModeleField(item);
    const cc = getFn(item, 'Cylindree (cc)', 'Cylindrée (cc)', 'Type (M/S/E)', 'Type(M/S/E)');

    console.log('\n--- Test isModele ---');
    console.log('getMarqueField:', marque);
    console.log('getModeleField:', modele);
    console.log('Cylindree/Type:', cc);

    const isModele = !!marque && !!modele && cc !== '';
    console.log('isModele:', isModele);

    // Compter sur tout le dataset
    let detectedCount = 0;
    for (const m of modeles) {
      const mk = getMarqueField(m);
      const ml = getModeleField(m);
      const cy = getFn(m, 'Cylindree (cc)', 'Cylindrée (cc)', 'Type (M/S/E)', 'Type(M/S/E)');
      if (mk && ml && cy !== '') detectedCount++;
    }
    console.log('\nModeles detectes sur', modeles.length, ':', detectedCount);

    // Verifier les field names exacts (avec caracteres speciaux)
    console.log('\n--- Hex des cles du premier modele ---');
    for (const k of Object.keys(modeles[0])) {
      const hex = Buffer.from(k).toString('hex');
      console.log(JSON.stringify(k), '->', hex);
    }
  });
});
