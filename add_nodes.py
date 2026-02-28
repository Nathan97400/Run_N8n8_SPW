import json

# Lire l'ancien workflow
with open('Ancien_Workflow.json', 'r', encoding='utf-8') as f:
    workflow = json.load(f)

# Créer les nouveaux nœuds
remove_duplicates = {
    'parameters': {
        'operation': 'removeDuplicateInputItems',
        'compare': 'selectedFields',
        'fieldsToCompare': 'absolute href',
        'options': {
            'removeOtherFields': False
        }
    },
    'id': 'new-remove-duplicates-node',
    'name': 'Remove Duplicates',
    'type': 'n8n-nodes-base.removeDuplicates',
    'typeVersion': 2,
    'position': [-600, 224]
}

filter_empty_code = """// Filtrer les lignes vides
const items = $input.all();

if (!items || items.length === 0) {
  return [];
}

const filteredItems = items.filter(item => {
  const json = item.json;

  // Verifier absolute href
  const hasHref = json["absolute href"] &&
    typeof json["absolute href"] === "string" &&
    json["absolute href"].trim() !== "";

  // Verifier qu'au moins un champ significatif existe
  const hasContent = json["text-headline-1-expanded"] ||
    json["text-body-1 (2)"] ||
    json["text-body-1 (8)"];

  return hasHref && hasContent;
});

return filteredItems.map(item => ({ json: item.json }));"""

filter_empty = {
    'parameters': {
        'jsCode': filter_empty_code
    },
    'id': 'new-filter-empty-node',
    'name': 'Filter Empty Rows',
    'type': 'n8n-nodes-base.code',
    'typeVersion': 2,
    'position': [-400, 224]
}

# Trouver l'index du noeud "Extraction JSON Leboncoin"
extraction_index = None
for i, node in enumerate(workflow['nodes']):
    if node.get('name') == 'Extraction JSON Leboncoin':
        extraction_index = i
        break

if extraction_index is not None:
    # Insérer les nouveaux noeuds après l'extraction
    workflow['nodes'].insert(extraction_index + 1, remove_duplicates)
    workflow['nodes'].insert(extraction_index + 2, filter_empty)
    print(f"Noeuds inseres apres index {extraction_index}")
else:
    # Si pas trouvé, ajouter au début de la liste
    workflow['nodes'].insert(2, remove_duplicates)
    workflow['nodes'].insert(3, filter_empty)
    print("Noeuds ajoutes a la position 2 et 3")

# Modifier le nom du workflow
workflow['name'] = 'v2 scrap lbc - IMPROVED (avec nettoyage)'

print(f'Total noeuds: {len(workflow["nodes"])}')

# Sauvegarder
with open('Workflow_IMPROVED_v2.json', 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print('Workflow sauvegarde dans Workflow_IMPROVED_v2.json')
