import sys, json, re, unicodedata
sys.stdout.reconfigure(encoding='utf-8')

STOP_WORDS = {'moto','motos','scooter','roadster','trail','enduro','cross','vend','vente','vends',
'urgent','etat','tres','super','parfait','paiement','securise','option','full','abs','a2','ct','ok',
'km','kms','kilometrage','boite','vitesse','manuelle','prix','euro','eur','garantie','factures','entretien'}
MIN_COV_ALPHA = 0.85
MIN_ACCEPT = 0.78
CC_BLOCK_DIFF = 80

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

def bkey(b): return normalize_js(b).replace(' ', '')

def cc_from_href(href):
    m = re.search(r'cubic_capacity:(\d{2,4})', str(href or ''), re.I)
    return int(m.group(1)) if m else 0

def extract_model_from_href(href):
    m = re.search(r'u_moto_model:([^+&]+)', str(href or ''), re.I)
    return m.group(1).replace('+', ' ') if m else ''

def extract_brand_from_href(href):
    m = re.search(r'u_moto_brand:([^+&]+)', str(href or ''), re.I)
    return m.group(1).replace('+', ' ') if m else ''

def get_dominant_tokens(model_raw):
    n = normalize_js(model_raw)
    nums = re.findall(r'\b\d{3,4}\b', n)
    if nums: return [int(x) for x in nums]
    toks = tokenize_js(model_raw)
    return [t for t in toks if re.search(r'\d', t) or len(t) >= 4]

def extract_numbers(text):
    raw = str(text or '')
    raw = re.sub(r'\b\d{1,6}\s*km\b', ' ', raw, flags=re.I)
    raw = re.sub(r'\b(0?[1-9]|1[0-2])\s*/\s*((19|20)\d{2})\b', ' ', raw)
    s = normalize_js(raw)
    return [int(x) for x in re.findall(r'\b\d{3,4}\b', s)]

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

def parse_year(s):
    s = str(s or '')
    m = re.search(r'\b(0?[1-9]|1[0-2])\s*/\s*((19|20)\d{2})\b', s)
    if m: return int(m.group(2))
    m = re.search(r'\b(19|20)\d{2}\b', s)
    return int(m.group(0)) if m else 0

# Build brand index from BDD
with open('C:/Users/natha/Documents/projets_claude-code/n8n_builders/BDD Modèles/motorcycles_brands_full_ENRICHED.json','r',encoding='utf-8') as f:
    bdd = json.load(f)

brand_index = {}
for m in bdd:
    brand_raw = m.get('Marque','')
    model_raw = m.get('Modèle','')
    if not brand_raw or not model_raw: continue
    bk = bkey(brand_raw)
    cc_val = m.get('Cylindrée (cc)')
    cc = round(float(cc_val)) if cc_val else 0
    ys_raw = m.get('Année début')
    ye_raw = m.get('Année fin')
    ys = int(float(ys_raw)) if ys_raw else 0
    ye = 9999 if ye_raw is None else (int(float(ye_raw)) if ye_raw else 9999)
    variants_raw = str(model_raw).replace('|', '/').split('/')
    variants = list(set([normalize_js(p.strip()) for p in variants_raw if p.strip()]))
    vat = [tokens_alpha_only(tokenize_js(v)) for v in variants]
    vat = [t for t in vat if t]
    if not vat: continue
    doms = get_dominant_tokens(model_raw)
    combined_tok = tokenize_js(brand_raw + ' ' + model_raw)
    if bk not in brand_index: brand_index[bk] = []
    brand_index[bk].append({'cc': cc, 'ys': ys, 'ye': ye, 'vat': vat, 'doms': doms, 'ctok': combined_tok,
                             'brand_raw': brand_raw, 'model_raw': model_raw})

# Load LBC
with open('C:/Users/natha/Documents/projets_claude-code/n8n_builders/JSON LBC/mt14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json','r',encoding='utf-8') as f:
    lbc = json.load(f)

# Find the specific failing items and debug them
debug_titles = ['MT07 A2 - 138e/mois SANS APPORT - MT 07 KD ROSE FLUO', 'Mt-07', 'Yamaha mt-07']

for a in lbc:
    title = a.get('text-headline-1-expanded','')
    if title not in debug_titles:
        continue

    href_brand = a.get('text-body-1 href (2)', '')
    href_model = a.get('text-body-1 href (3)', '')
    href_cc = a.get('text-body-1 href (5)', '')
    desc = a.get('text-body-1 (17)', a.get('text-body-1 (16)', ''))

    brand_from_href = extract_brand_from_href(href_brand)
    bk_ann = bkey(brand_from_href) if brand_from_href else bkey(a.get('text-body-1 (2)', ''))
    model_hint = extract_model_from_href(href_model)
    if not model_hint or 'autre' in normalize_js(model_hint):
        model_hint = title
    ann_cc = cc_from_href(href_cc)
    ann_year = parse_year(a.get('text-body-1 (4)','')) or parse_year(a.get('text-body-1 (9)',''))

    ad_text_base = (title + ' ' + desc).strip()
    ad_text_used = (ad_text_base + ' ' + model_hint).strip()
    ad_tok = tokenize_js(ad_text_used)
    ad_set = set(ad_tok)
    for tok in ad_tok:
        ad_set.add(tok.replace('-','').replace('_',''))
    ad_numbers = extract_numbers(ad_text_used)
    ad_norm_compact = normalize_js(ad_text_used).replace('-','').replace('_','')

    print(f'\n=== DEBUG: {repr(title)} ===')
    print(f'  bk_ann: {bk_ann}')
    print(f'  model_hint: {model_hint}')
    print(f'  ann_cc: {ann_cc}, ann_year: {ann_year}')
    print(f'  ad_tok: {ad_tok}')
    print(f'  ad_norm_compact: {repr(ad_norm_compact)}')

    best_score = 0
    best_p = None

    for p in brand_index.get(bk_ann, []):
        # CC gate
        cc_blocked = False
        if ann_cc and p['cc']:
            if abs(p['cc'] - ann_cc) > CC_BLOCK_DIFF:
                cc_blocked = True

        # Dom gate
        dom_found = True
        if p['doms']:
            dom_found = False
            for d in p['doms']:
                if isinstance(d, int):
                    if d in ad_numbers or str(d) in ad_norm_compact:
                        dom_found = True; break
                else:
                    d_clean = str(d).replace('-','').replace('_','')
                    if d_clean in ad_norm_compact:
                        dom_found = True; break

        if cc_blocked or not dom_found:
            continue

        cov = max((coverage_set(ad_set, vt) for vt in p['vat']), default=0)
        jac = jaccard(ad_tok, p['ctok'])
        cc_bonus = 1.0 if (ann_cc and p['cc'] and ann_cc == p['cc']) else 0
        year_bonus = 1.0 if (ann_year and p['ys'] and p['ye'] and p['ys'] <= ann_year <= p['ye']) else 0
        score = cov*0.70 + jac*0.20 + cc_bonus*0.05 + year_bonus*0.05

        print(f'  CAND: {p["model_raw"]} | vat={p["vat"]} | cc={p["cc"]} | cov={cov:.3f} | jac={jac:.3f} | cc_b={cc_bonus} | yr_b={year_bonus} | score={score:.3f}')

        if score > best_score:
            best_score = score
            best_p = p

    if best_p is None:
        print(f'  RESULT: NO CANDIDATE')
    elif best_score >= MIN_ACCEPT:
        print(f'  RESULT: MATCH score={best_score:.3f} model={best_p["model_raw"]}')
    else:
        print(f'  RESULT: BELOW_THRESH score={best_score:.3f} model={best_p["model_raw"]}')

    debug_titles.remove(title)
    if not debug_titles:
        break
