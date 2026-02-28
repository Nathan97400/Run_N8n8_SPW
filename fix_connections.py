import json

# Lire le workflow
with open('Workflow_IMPROVED_v2.json', 'r', encoding='utf-8') as f:
    workflow = json.load(f)

# Trouver les noeuds concernés
extraction_node_name = None
next_node_after_extraction = None

# Parcourir les connexions pour trouver ce qui était connecté à "Extraction JSON Leboncoin"
connections = workflow.get('connections', {})

if 'Extraction JSON Leboncoin' in connections:
    original_connections = connections['Extraction JSON Leboncoin']['main'][0]
    if original_connections:
        next_node_after_extraction = original_connections[0]['node']
        print(f"Noeud suivant original: {next_node_after_extraction}")

# Modifier les connexions
# Extraction JSON Leboncoin → Remove Duplicates
connections['Extraction JSON Leboncoin'] = {
    'main': [
        [
            {
                'node': 'Remove Duplicates',
                'type': 'main',
                'index': 0
            }
        ]
    ]
}

# Remove Duplicates → Filter Empty Rows
connections['Remove Duplicates'] = {
    'main': [
        [
            {
                'node': 'Filter Empty Rows',
                'type': 'main',
                'index': 0
            }
        ]
    ]
}

# Filter Empty Rows → [ce qui était après Extraction]
if next_node_after_extraction:
    connections['Filter Empty Rows'] = {
        'main': [
            [
                {
                    'node': next_node_after_extraction,
                    'type': 'main',
                    'index': 0
                }
            ]
        ]
    }
    print(f"Connecte Filter Empty Rows vers: {next_node_after_extraction}")

workflow['connections'] = connections

# Sauvegarder
with open('Workflow_IMPROVED_v2.json', 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print('Connexions modifiees avec succes')
print(f'Total connexions: {len(connections)}')
