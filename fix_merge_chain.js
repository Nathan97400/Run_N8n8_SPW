const fs = require('fs');
const filePath = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json';
const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// ═══════════════════════════════════════════════════════════
// Remplacer "Merge All Matches" (5 inputs impossible en n8n)
// par une chaîne de 4 Merge nodes (2 inputs chacun)
//
// 1st + 2nd → Merge A
//              Merge A + 3rd → Merge B
//                              Merge B + 4th → Merge C
//                                              Merge C + 5th → Rename Columns
// ═══════════════════════════════════════════════════════════

// Supprimer l'ancien "Merge All Matches"
workflow.nodes = workflow.nodes.filter(n => n.id !== 'merge-all-matches');

// Ajouter les 4 nouveaux Merge nodes en cascade
const cascadeMerges = [
  { id: 'merge-a', name: 'Merge 1st+2nd',        pos: [800, 170] },
  { id: 'merge-b', name: 'Merge A+3rd',           pos: [800, 310] },
  { id: 'merge-c', name: 'Merge B+4th',           pos: [800, 450] },
  { id: 'merge-d', name: 'Merge C+5th (Final)',   pos: [800, 590] },
];

cascadeMerges.forEach(m => {
  workflow.nodes.push({
    parameters: {},
    id: m.id,
    name: m.name,
    type: 'n8n-nodes-base.merge',
    typeVersion: 3.2,
    position: m.pos
  });
});

// Repositionner Rename Columns, IF, Supabase
workflow.nodes = workflow.nodes.map(node => {
  if (node.id === 'rename-columns') node.position = [1050, 590];
  if (node.id === 'if-matched-ok')  node.position = [1260, 590];
  if (node.id === 'supabase-matched') node.position = [1470, 490];
  if (node.id === 'supabase-review')  node.position = [1470, 700];
  return node;
});

// ═══════════════════════════════════════════════════════════
// Reconstruire les connexions avec le bon chaînage
// ═══════════════════════════════════════════════════════════

// Match nodes → cascade Merge
// Merge A : input0 = 1st Match, input1 = 2nd Match
workflow.connections['1st Match (EXCELLENT)'] = { main: [[{ node: 'Merge 1st+2nd', type: 'main', index: 0 }]] };
workflow.connections['2nd Match (GOOD)']      = { main: [[{ node: 'Merge 1st+2nd', type: 'main', index: 1 }]] };

// Merge B : input0 = Merge A, input1 = 3rd Match
workflow.connections['Merge 1st+2nd'] = { main: [[{ node: 'Merge A+3rd', type: 'main', index: 0 }]] };
workflow.connections['3rd Match (MEDIUM - Permissif)'] = { main: [[{ node: 'Merge A+3rd', type: 'main', index: 1 }]] };

// Merge C : input0 = Merge B, input1 = 4th Match
workflow.connections['Merge A+3rd'] = { main: [[{ node: 'Merge B+4th', type: 'main', index: 0 }]] };
workflow.connections['4th Match (POOR)'] = { main: [[{ node: 'Merge B+4th', type: 'main', index: 1 }]] };

// Merge D (final) : input0 = Merge C, input1 = 5th Match
workflow.connections['Merge B+4th'] = { main: [[{ node: 'Merge C+5th (Final)', type: 'main', index: 0 }]] };
workflow.connections['5th Match (MINIMAL)'] = { main: [[{ node: 'Merge C+5th (Final)', type: 'main', index: 1 }]] };

// Merge Final → Rename Columns
workflow.connections['Merge C+5th (Final)'] = { main: [[{ node: 'Rename Columns', type: 'main', index: 0 }]] };

// Rename → IF → Supabase (inchangé)
workflow.connections['Rename Columns'] = { main: [[{ node: 'IF Matched OK ?', type: 'main', index: 0 }]] };
workflow.connections['IF Matched OK ?'] = { main: [
  [{ node: 'Supabase - Annonce Matchee', type: 'main', index: 0 }],
  []
]};

workflow.name = 'LBC Scraping - Progressive Matching v3 (MERGE CHAIN FIX)';

fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('OK - Workflow mis a jour avec merge en cascade');

// === VERIFICATION ===
const w = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Connexions entre nœuds
const checks = [
  '1st Match (EXCELLENT)',
  '2nd Match (GOOD)',
  '3rd Match (MEDIUM - Permissif)',
  '4th Match (POOR)',
  '5th Match (MINIMAL)',
  'Merge 1st+2nd',
  'Merge A+3rd',
  'Merge B+4th',
  'Merge C+5th (Final)',
  'Rename Columns',
  'IF Matched OK ?',
];
checks.forEach(name => {
  const c = w.connections[name];
  if (c) {
    const targets = c.main.flatMap(o => (o || []).map(t => t.node)).filter(Boolean);
    console.log(' ', name, '->', targets.join(', ') || '(vide)');
  } else {
    console.log(' ', name, '-> [AUCUNE CONNEXION]');
  }
});

// Vérifier les connexions cassées
const nodeNames = new Set(w.nodes.map(n => n.name));
const broken = [];
Object.values(w.connections).forEach(conn => {
  conn.main.forEach(outputs => {
    (outputs || []).forEach(t => {
      if (t && t.node && !nodeNames.has(t.node)) broken.push(t.node);
    });
  });
});
if (broken.length === 0) {
  console.log('\nToutes les connexions sont valides.');
} else {
  console.log('\nCONNEXIONS CASSEES:', broken);
}
