"""
Extract supplemental BDD data (missing brands) for injection into n8n match nodes.
Outputs a unique-model JS array (deduplicated by marque+modele+cc+annee).
"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

bdd_path = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/BDD Mod\u00e8les/motorcycles_brands_full_ENRICHED.json'
with open(bdd_path, encoding='utf-8') as f:
    bdd = json.load(f)

missing_brands = {'Voge','Indian','GasGas','Fantic','Brixton','Keeway','Mash','Orcal','Zontes'}

seen = set()
unique_entries = []
for b in bdd:
    marque = b.get('Marque','') or ''
    if marque not in missing_brands:
        continue
    modele = b.get('Mod\u00e8le','') or b.get('Modele','') or ''
    cc = b.get('Cylindr\u00e9e (cc)') or b.get('Cylindree (cc)') or 0
    ys = b.get('Ann\u00e9e d\u00e9but') or b.get('Annee debut') or None
    ye = b.get('Ann\u00e9e fin') or b.get('Annee fin') or None

    key = (marque, modele, cc, ys, ye)
    if key in seen:
        continue
    seen.add(key)

    unique_entries.append({
        'Marque': marque,
        'Mod\u00e8le': modele,
        'Cylindr\u00e9e (cc)': cc,
        'Ann\u00e9e d\u00e9but': ys,
        'Ann\u00e9e fin': ye,
        'Type (M/S/E)': b.get('Type (M/S/E)','M'),
    })

# Also add QJ Motor basic models (not in BDD, but common on LBC)
qj_models = [
    {'Marque':'QJ Motor','Mod\u00e8le':'SRT 600','Cylindr\u00e9e (cc)':600,'Ann\u00e9e d\u00e9but':2022,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'QJ Motor','Mod\u00e8le':'SRV 550','Cylindr\u00e9e (cc)':550,'Ann\u00e9e d\u00e9but':2022,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'QJ Motor','Mod\u00e8le':'SRK 600','Cylindr\u00e9e (cc)':600,'Ann\u00e9e d\u00e9but':2023,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'QJ Motor','Mod\u00e8le':'SRK 400','Cylindr\u00e9e (cc)':400,'Ann\u00e9e d\u00e9but':2023,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'QJ Motor','Mod\u00e8le':'SRV 500','Cylindr\u00e9e (cc)':500,'Ann\u00e9e d\u00e9but':2022,'Ann\u00e9e fin':None,'Type (M/S/E)':'S'},
    {'Marque':'QJ Motor','Mod\u00e8le':'SRV 750','Cylindr\u00e9e (cc)':750,'Ann\u00e9e d\u00e9but':2023,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'QJ Motor','Mod\u00e8le':'SR 125','Cylindr\u00e9e (cc)':125,'Ann\u00e9e d\u00e9but':2021,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'QJ Motor','Mod\u00e8le':'SRT 800','Cylindr\u00e9e (cc)':800,'Ann\u00e9e d\u00e9but':2023,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
]
unique_entries.extend(qj_models)

# Also add Zero Motorcycles aliases (BDD has 'Zero' but LBC sends 'ZERO MOTORCYCLES')
zero_models = [
    {'Marque':'Zero Motorcycles','Mod\u00e8le':'SR/F','Cylindr\u00e9e (cc)':0,'Ann\u00e9e d\u00e9but':2019,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'Zero Motorcycles','Mod\u00e8le':'S','Cylindr\u00e9e (cc)':0,'Ann\u00e9e d\u00e9but':2013,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'Zero Motorcycles','Mod\u00e8le':'DSR','Cylindr\u00e9e (cc)':0,'Ann\u00e9e d\u00e9but':2014,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
    {'Marque':'Zero Motorcycles','Mod\u00e8le':'SR','Cylindr\u00e9e (cc)':0,'Ann\u00e9e d\u00e9but':2013,'Ann\u00e9e fin':None,'Type (M/S/E)':'M'},
]
unique_entries.extend(zero_models)

print(f'Total supplemental entries: {len(unique_entries)}')
from collections import Counter
print(dict(Counter(e['Marque'] for e in unique_entries)))

# Save for use in JS
with open('supplement_bdd.json', 'w', encoding='utf-8') as f:
    json.dump(unique_entries, f, ensure_ascii=False, indent=2)
print('Saved to supplement_bdd.json')
