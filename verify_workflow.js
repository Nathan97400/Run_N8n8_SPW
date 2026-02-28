const fs = require('fs');
const w = JSON.parse(fs.readFileSync('C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json', 'utf8'));

const nodeNames = new Set(w.nodes.map(n => n.name));

const connTargets = new Set();
Object.values(w.connections).forEach(conn => {
  conn.main?.forEach(outputs => {
    outputs?.forEach(target => {
      if (target && target.node) connTargets.add(target.node);
    });
  });
});

const broken = [];
for (const target of connTargets) {
  if (!nodeNames.has(target)) broken.push(target);
}

if (broken.length === 0) {
  console.log('OK - Toutes les connexions pointent vers des noeuds existants');
} else {
  console.log('CONNEXIONS CASSEES:');
  broken.forEach(b => console.log(' -> "' + b + '"'));
  console.log('\nNoeuds disponibles:');
  for (const n of nodeNames) console.log('  "' + n + '"');
}

console.log('\nFlux principal:');
['Gmail Trigger','Extraction JSON Leboncoin','Remove Duplicates','Filter Empty Rows','Scoring de Completude','Router par Qualite'].forEach(n => {
  const out = (w.connections[n] && w.connections[n].main && w.connections[n].main[0]) ? w.connections[n].main[0].map(c => c.node) : [];
  console.log(' ', n, '->', out.join(', '));
});

console.log('\nRouter outputs:');
const rConn = w.connections['Router par Qualite'];
if (rConn) rConn.main.forEach((o, i) => console.log('  Output', i, '->', o.map ? o.map(c => c.node).join(', ') : '(vide)'));
