const fs = require('fs');
const filePath = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json';
const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));

workflow.nodes = workflow.nodes.map(node => {
  if (node.name !== 'Rename Columns') return node;

  // Ajouter matched_ok, matched_confidence, matched_engine dans le return du mapField
  // On cherche la ligne "needs_review: item.needs_review ?? false," et on ajoute après
  const oldCode = node.parameters.jsCode;

  // Vérification : est-ce que matched_ok est déjà là ?
  if (oldCode.includes('matched_ok:')) {
    console.log('matched_ok déjà présent, pas de modification nécessaire.');
    return node;
  }

  // Ajouter matched_ok / matched_confidence avant la fermeture du return
  const ANCHOR = '      needs_review: item.needs_review ?? false,';
  const NEW_FIELDS = `      needs_review: item.needs_review ?? false,

      // ===============================
      // RÉSULTAT MATCHING (CRITIQUE pour IF node)
      // ===============================
      matched_ok: item.matched_ok ?? false,
      matched_confidence: item.matched_confidence || "NONE",
      matching_engine: item.matching_engine || "",`;

  if (!oldCode.includes(ANCHOR)) {
    // Fallback : chercher autre ancre
    console.warn('Ancre introuvable, tentative fallback...');
    const ANCHOR2 = 'needs_review: item.needs_review';
    const idx = oldCode.indexOf(ANCHOR2);
    if (idx === -1) {
      console.error('ERREUR : impossible de trouver le point d\'injection !');
      return node;
    }
    const end = oldCode.indexOf('\n', idx) + 1;
    node.parameters.jsCode = oldCode.slice(0, end) +
      '\n      // RÉSULTAT MATCHING\n      matched_ok: item.matched_ok ?? false,\n      matched_confidence: item.matched_confidence || "NONE",\n      matching_engine: item.matching_engine || "",\n' +
      oldCode.slice(end);
    console.log('Patch appliqué via fallback.');
    return node;
  }

  node.parameters.jsCode = oldCode.replace(ANCHOR, NEW_FIELDS);
  console.log('matched_ok + matched_confidence ajoutés dans Rename Columns.');
  return node;
});

fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('Workflow sauvegardé.');

// Vérification
const w2 = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const rename = w2.nodes.find(n => n.name === 'Rename Columns');
const code = rename.parameters.jsCode;
console.log('\nVérification :');
console.log(' matched_ok présent:', code.includes('matched_ok:'));
console.log(' matched_confidence présent:', code.includes('matched_confidence:'));
console.log(' matching_engine présent:', code.includes('matching_engine:'));
