const fs = require('fs');
const filePath = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json';
const workflow = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const tierMergeIds = ['merge-excellent', 'merge-good', 'merge-medium', 'merge-poor', 'merge-minimal'];

workflow.nodes = workflow.nodes.map(node => {
  if (tierMergeIds.includes(node.id)) {
    // Supprimer combineBy:combineAll (cartesian product = crash)
    // Utiliser parameters:{} + typeVersion 3.2 = simple append
    node.parameters = {};
    node.typeVersion = 3.2;
    console.log('Fixed:', node.name, '-> parameters: {}, typeVersion: 3.2');
  }
  return node;
});

fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('\nOK - Merge nodes corriges.');
