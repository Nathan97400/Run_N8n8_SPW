const fs = require('fs');
const filePath = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json';
const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// ═══════════════════════════════════════════════════════════
// 1. Ajouter 5 Merge nodes (annonces du tier + modèles)
// ═══════════════════════════════════════════════════════════

const mergeNodes = [
  { id: 'merge-excellent', name: 'Merge EXCELLENT + Modeles', pos: [400, 100] },
  { id: 'merge-good',      name: 'Merge GOOD + Modeles',      pos: [400, 240] },
  { id: 'merge-medium',    name: 'Merge MEDIUM + Modeles',    pos: [400, 380] },
  { id: 'merge-poor',      name: 'Merge POOR + Modeles',      pos: [400, 520] },
  { id: 'merge-minimal',   name: 'Merge MINIMAL + Modeles',   pos: [400, 660] },
];

mergeNodes.forEach(m => {
  workflow.nodes.push({
    parameters: { mode: 'combine', combineBy: 'combineAll', options: {} },
    id: m.id,
    name: m.name,
    type: 'n8n-nodes-base.merge',
    typeVersion: 3,
    position: m.pos
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Repositionner les nœuds existants
// ═══════════════════════════════════════════════════════════

const positions = {
  '1st-match':        [600, 100],
  '2nd-match':        [600, 240],
  '3rd-match':        [600, 380],
  '4th-match':        [600, 520],
  '5th-match':        [600, 660],
  'merge-all-matches':[800, 380],
  'rename-columns':   [1000, 380],
  'if-matched-ok':    [1200, 380],
  'supabase-matched': [1400, 260],
  'supabase-review':  [1400, 500],
};

workflow.nodes = workflow.nodes.map(node => {
  if (positions[node.id]) node.position = positions[node.id];
  // Désactiver l'ancien Merge inutile
  if (node.id === 'merge') {
    node.name = 'INUTILISE - Merge Annonces+Modeles';
    node.position = [-200, 700];
  }
  return node;
});

// ═══════════════════════════════════════════════════════════
// 3. Reconstruire toutes les connexions
// ═══════════════════════════════════════════════════════════

const c = {};

// Gmail → Extraction + GET Modeles
c['Gmail Trigger'] = { main: [[
  { node: 'Extraction JSON Leboncoin', type: 'main', index: 0 },
  { node: 'GET Modeles', type: 'main', index: 0 }
]]};

// Extraction → Remove Duplicates
c['Extraction JSON Leboncoin'] = { main: [[
  { node: 'Remove Duplicates', type: 'main', index: 0 }
]]};

// Remove → Filter
c['Remove Duplicates'] = { main: [[
  { node: 'Filter Empty Rows', type: 'main', index: 0 }
]]};

// Filter → Scoring DIRECT (bypass vieux Merge)
c['Filter Empty Rows'] = { main: [[
  { node: 'Scoring de Completude', type: 'main', index: 0 }
]]};

// GET Modeles → les 5 Merge nodes en input 1
c['GET Modeles'] = { main: [[
  { node: 'Merge EXCELLENT + Modeles', type: 'main', index: 1 },
  { node: 'Merge GOOD + Modeles',      type: 'main', index: 1 },
  { node: 'Merge MEDIUM + Modeles',    type: 'main', index: 1 },
  { node: 'Merge POOR + Modeles',      type: 'main', index: 1 },
  { node: 'Merge MINIMAL + Modeles',   type: 'main', index: 1 },
]]};

// Scoring → Router
c['Scoring de Completude'] = { main: [[
  { node: 'Router par Qualite', type: 'main', index: 0 }
]]};

// Router → les 5 Merge nodes en input 0
c['Router par Qualite'] = { main: [
  [{ node: 'Merge EXCELLENT + Modeles', type: 'main', index: 0 }],
  [{ node: 'Merge GOOD + Modeles',      type: 'main', index: 0 }],
  [{ node: 'Merge MEDIUM + Modeles',    type: 'main', index: 0 }],
  [{ node: 'Merge POOR + Modeles',      type: 'main', index: 0 }],
  [{ node: 'Merge MINIMAL + Modeles',   type: 'main', index: 0 }],
]};

// Merge nodes → Match nodes
c['Merge EXCELLENT + Modeles'] = { main: [[{ node: '1st Match (EXCELLENT)', type: 'main', index: 0 }]] };
c['Merge GOOD + Modeles']      = { main: [[{ node: '2nd Match (GOOD)',      type: 'main', index: 0 }]] };
c['Merge MEDIUM + Modeles']    = { main: [[{ node: '3rd Match (MEDIUM - Permissif)', type: 'main', index: 0 }]] };
c['Merge POOR + Modeles']      = { main: [[{ node: '4th Match (POOR)',      type: 'main', index: 0 }]] };
c['Merge MINIMAL + Modeles']   = { main: [[{ node: '5th Match (MINIMAL)',   type: 'main', index: 0 }]] };

// Match nodes → Merge All Matches
c['1st Match (EXCELLENT)']           = { main: [[{ node: 'Merge All Matches', type: 'main', index: 0 }]] };
c['2nd Match (GOOD)']                = { main: [[{ node: 'Merge All Matches', type: 'main', index: 1 }]] };
c['3rd Match (MEDIUM - Permissif)']  = { main: [[{ node: 'Merge All Matches', type: 'main', index: 2 }]] };
c['4th Match (POOR)']                = { main: [[{ node: 'Merge All Matches', type: 'main', index: 3 }]] };
c['5th Match (MINIMAL)']             = { main: [[{ node: 'Merge All Matches', type: 'main', index: 4 }]] };

// Merge All → Rename → IF → Supabase
c['Merge All Matches'] = { main: [[{ node: 'Rename Columns', type: 'main', index: 0 }]] };
c['Rename Columns']    = { main: [[{ node: 'IF Matched OK ?', type: 'main', index: 0 }]] };

// IF TRUE → Supabase Matched ; FALSE → rien (une ligne en moins > une ligne fausse)
c['IF Matched OK ?'] = { main: [
  [{ node: 'Supabase - Annonce Matchee', type: 'main', index: 0 }],
  [] // FALSE : pas d'insertion
]};

workflow.connections = c;

// ═══════════════════════════════════════════════════════════
// 4. Mettre à jour les noms des nœuds (retirer les emojis qui
//    peuvent poser problème dans les connexions JSON)
// ═══════════════════════════════════════════════════════════

const nameMap = {
  'scoring-completude': 'Scoring de Completude',
  'router-quality':     'Router par Qualite',
  '3rd-match':          '3rd Match (MEDIUM - Permissif)',
  'supabase-matched':   'Supabase - Annonce Matchee',
  'supabase-review':    'Supabase - Annonce A Revoir',
};

workflow.nodes = workflow.nodes.map(node => {
  if (nameMap[node.id]) node.name = nameMap[node.id];
  return node;
});

// ═══════════════════════════════════════════════════════════
// 5. IF node : strict (HIGH + MEDIUM seulement)
//    Philosophie : une ligne en moins > une ligne fausse
// ═══════════════════════════════════════════════════════════

workflow.nodes = workflow.nodes.map(node => {
  if (node.id === 'if-matched-ok') {
    node.parameters = {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'cond-matched-ok',
            leftValue: '={{ $json.matched_ok }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          },
          {
            id: 'cond-not-low',
            leftValue: '={{ $json.matched_confidence }}',
            rightValue: 'LOW',
            operator: { type: 'string', operation: 'notEquals' }
          },
          {
            id: 'cond-not-none',
            leftValue: '={{ $json.matched_confidence }}',
            rightValue: 'NONE',
            operator: { type: 'string', operation: 'notEquals' }
          }
        ],
        combinator: 'and'
      },
      options: {}
    };
  }
  return node;
});

workflow.name = 'LBC Scraping - Progressive Matching v3 (ARCHITECTURE FIX)';

fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('Workflow v3 ecrit avec succes.');
console.log('Total noeuds:', workflow.nodes.length);
console.log('Connexions cles:');
console.log('  Filter Empty Rows ->', JSON.stringify(c['Filter Empty Rows']));
console.log('  GET Modeles ->', c['GET Modeles'].main[0].map(n => n.node));
console.log('  Router par Qualite ->', c['Router par Qualite'].main.map(o => o[0]?.node));
console.log('  IF Matched OK TRUE ->', c['IF Matched OK ?'].main[0].map(n => n.node));
console.log('  IF Matched OK FALSE -> (vide ->', c['IF Matched OK ?'].main[1].length, 'connexions)');
