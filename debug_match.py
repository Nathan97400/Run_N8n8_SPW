import sys, json, re, unicodedata
sys.stdout.reconfigure(encoding='utf-8')

STOP_WORDS = {'moto','motos','scooter','roadster','trail','enduro','cross','vend','vente','vends','urgent','etat','tres','super','parfait','paiement','securise','option','full','abs','a2','ct','ok','km','kms','kilometrage','boite','vitesse','manuelle','prix','euro','eur','garantie','factures','entretien'}

def normalize_js(text):
    if not text: return ''
    s = str(text)
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace('_', ' ')
    s = re.sub(r'[/|]', ' ', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'\b(mt)\s*0?(\d{2})\b', r'\g<1>\2', s)
    s = re.sub(r'\b(fz)\s*(\d)\b', r'\g<1>\2', s)
    s = re.sub(r'\b(gs)\s*(\d{3,4})\b', r'\g<1>\2', s)
    s = re.sub(r'\b(r)\s*(\d{3,4})\b', r'\g<1>\2', s)
    s = re.sub(r'\bv\s*strom\b', 'vstrom', s)
    s = re.sub(r'\b(dr)\s*z\b', 'drz', s)
    return s

def tokenize_js(text):
    n = normalize_js(text)
    if not n: return []
    return [t for t in n.split() if t and t not in STOP_WORDS and (bool(re.match(r'^\d+$', t)) or len(t) >= 2)]

def tokens_alpha_only(toks):
    return [t for t in toks if re.search(r'[a-z]', t) and len(t) >= 2]

def coverage_set(ad_set, model_tokens):
    if not model_tokens: return 0
    ad_compact = set(t.replace('-','').replace('_','') for t in ad_set)
    hit = sum(1 for t in model_tokens if t in ad_set or t.replace('-','').replace('_','') in ad_compact)
    return hit / len(model_tokens)

def jaccard(a_tok, b_tok):
    A, B = set(a_tok), set(b_tok)
    if not A or not B: return 0
    inter = len(A & B)
    return inter / (len(A) + len(B) - inter)

def get_dominant_tokens(model_raw):
    n = normalize_js(model_raw)
    nums = re.findall(r'\b\d{3,4}\b', n)
    if nums: return [int(x) for x in nums]
    toks = tokenize_js(model_raw)
    return [t for t in toks if re.search(r'\d', t) or len(t) >= 4]

# Load BDD
with open('C:/Users/natha/Documents/projets_claude-code/n8n_builders/BDD Modèles/motorcycles_brands_full_ENRICHED.json','r',encoding='utf-8') as f:
    bdd = json.load(f)

print(f'BDD loaded: {len(bdd)} entries')
print(f'First keys: {list(bdd[0].keys())}')

# Get all yamaha models
yamaha_models = [(m.get('Marque',''), m.get('Modèle',''), get_dominant_tokens(m.get('Modèle',''))) for m in bdd if 'amaha' in str(m.get('Marque',''))]
print(f'Yamaha models: {len(yamaha_models)}')
print()

# Simulate Mt-07 item
title = 'Mt-07'
model_hint = 'YAMAHA_MT'
ad_text_used = (title + ' ' + model_hint).strip()
ad_tok = tokenize_js(ad_text_used)
ad_set = set(ad_tok)
ad_norm_compact = normalize_js(ad_text_used).replace('-','').replace('_','')
print(f'ad_tok: {ad_tok}')
print(f'ad_norm_compact: {repr(ad_norm_compact)}')
print()

# Check which models pass dom gate
print('=== Models passing dominant gate for "Mt-07" ===')
for marque, modele, doms in yamaha_models:
    if doms:
        dom_found = any(
            (str(d) in ad_norm_compact if isinstance(d, int) else str(d).replace('-','').replace('_','') in ad_norm_compact)
            for d in doms
        )
        if dom_found:
            vat = tokens_alpha_only(tokenize_js(modele))
            cov = coverage_set(ad_set, vat) if vat else 0
            ctok = tokenize_js(marque + ' ' + modele)
            jac = jaccard(ad_tok, ctok)
            score = cov*0.70 + jac*0.20
            print(f'  PASS: {modele} | doms={doms} | vat={vat} | cov={cov:.2f} | jac={jac:.3f} | score={score:.3f}')
    else:
        vat = tokens_alpha_only(tokenize_js(modele))
        cov = coverage_set(ad_set, vat) if vat else 0
        ctok = tokenize_js(marque + ' ' + modele)
        jac = jaccard(ad_tok, ctok)
        score = cov*0.70 + jac*0.20
        print(f'  NO_DOM: {modele} | vat={vat} | cov={cov:.2f} | jac={jac:.3f} | score={score:.3f}')

print()
print('=== All yamaha dominant tokens ===')
for marque, modele, doms in yamaha_models:
    print(f'  {modele}: doms={doms}')
