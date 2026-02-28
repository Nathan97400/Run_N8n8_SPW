import json, sys, re, unicodedata, os
sys.stdout.reconfigure(encoding='utf-8')

def normalize(t):
    s = str(t or '').lower()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.replace('_',' ').replace('/',' ').replace('|',' ')
    s = re.sub(r'[^a-z0-9]+',' ',s).strip()
    return s

tmp=os.environ.get('TEMP','C:/Temp')
with open(os.path.join(tmp,'worker_response.json'),'r',encoding='utf-8') as f:
    bdd=json.load(f)

yamaha = [m for m in bdd if str(m.get('Marque','')).lower() == 'yamaha']
print(f'Yamaha models in Worker BDD: {len(yamaha)}')
fjr = [m for m in yamaha if 'fjr' in str(m.get('Modele','') or m.get('Modèle','')).lower()]
print(f'FJR models: {len(fjr)}')
for m in fjr[:5]:
    mo = m.get('Modele','') or m.get('Modèle','')
    print(f'  {repr(mo)} | cc={m.get("Cylindree (cc)","") or m.get("Cylindrée (cc)","")}')

cb650 = [m for m in bdd if 'honda' in str(m.get('Marque','')).lower() and '650' in str(m.get('Modele','') or m.get('Modèle',''))]
print(f'\nHonda 650* models: {len(cb650)}')
for m in cb650[:8]:
    mo = m.get('Modele','') or m.get('Modèle','')
    norm = normalize(mo)
    cc = m.get('Cylindree (cc)','') or m.get('Cylindrée (cc)','')
    print(f'  {repr(mo)} norm={repr(norm)} cc={cc}')

# Also check all Yamaha with "1300"
y1300 = [m for m in yamaha if '1300' in str(m.get('Modele','') or m.get('Modèle',''))]
print(f'\nYamaha 1300 models: {len(y1300)}')
for m in y1300[:5]:
    mo = m.get('Modele','') or m.get('Modèle','')
    print(f'  {repr(mo)} cc={m.get("Cylindree (cc)","") or m.get("Cylindrée (cc)","")}')

# Check what model hint from LBC for FJR gives
model_hint_raw = "YAMAHA_FJR"
normalize_hint = normalize(model_hint_raw)
print(f'\nYAMAHA_FJR normalized: {repr(normalize_hint)}')
