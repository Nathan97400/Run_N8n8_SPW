import sys, json, re, unicodedata
sys.stdout.reconfigure(encoding='utf-8')

STOP_WORDS = {'moto','motos','scooter','roadster','trail','enduro','cross','vend','vente','vends',
'urgent','etat','tres','super','parfait','paiement','securise','option','full','abs','a2','ct','ok',
'km','kms','kilometrage','boite','vitesse','manuelle','prix','euro','eur','garantie','factures','entretien'}
MIN_COV_ALPHA = 0.85
MIN_ACCEPT = 0.73
CC_BLOCK_DIFF = 80
LIMIT = 218  # Tester uniquement les N premiers items

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
    return [t for t in n.split() if t and t not in STOP_WORDS and (re.match(r'^\d+$', t) or len(t) >= 2)]

def tokens_alpha_only(toks):
    return [t for t in toks if re.search(r'[a-z]', t) and len(t) >= 2]

def bkey(b): return normalize_js(b).replace(' ', '')

def extract_brand_from_href(href):
    m = re.search(r'u_moto_brand:([^+&]+)', str(href or ''), re.I)
    return m.group(1).replace('+', ' ') if m else ''

def extract_model_from_href(href):
    m = re.search(r'u_moto_model:([^+&]+)', str(href or ''), re.I)
    return m.group(1).replace('+', ' ') if m else ''

def cc_from_href(href):
    m = re.search(r'cubic_capacity:(\d{2,4})', str(href or ''), re.I)
    return int(m.group(1)) if m else 0

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

# Build brand index
bdd_path = 'BDD Mod\u00e8les/motorcycles_brands_full_ENRICHED.json'
with open(bdd_path, 'r', encoding='utf-8') as f:
    bdd = json.load(f)

brand_index = {}
for m in bdd:
    brand_raw = m.get('Marque', '')
    model_raw = m.get('Mod\u00e8le', '')
    if not brand_raw or not model_raw: continue
    bk = bkey(brand_raw)
    cc = round(float(m.get('Cylindr\u00e9e (cc)') or 0)) if m.get('Cylindr\u00e9e (cc)') else 0
    ys_raw = m.get('Ann\u00e9e d\u00e9but')
    ye_raw = m.get('Ann\u00e9e fin')
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
                             'model_raw': model_raw})

print(f'Brand index: {len(brand_index)} brands, {sum(len(v) for v in brand_index.values())} models')

# Load LBC
lbc_path = 'JSON LBC/mt14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json'
with open(lbc_path, 'r', encoding='utf-8') as f:
    lbc = json.load(f)

# Process subset
lbc_subset = lbc[:LIMIT]
print(f'Processing first {LIMIT} items...')

matched = 0; no_brand = 0; no_model = 0; below_thresh = 0
fail_samples = []

for a in lbc_subset:
    title = a.get('text-headline-1-expanded', '')
    desc = a.get('text-body-1 (17)', a.get('text-body-1 (16)', ''))
    href_brand = a.get('text-body-1 href (2)', '')
    href_model = a.get('text-body-1 href (3)', '')
    href_cc = a.get('text-body-1 href (5)', '')

    brand_from_href = extract_brand_from_href(href_brand)
    bk_ann = bkey(brand_from_href) if brand_from_href else bkey(a.get('text-body-1 (2)', ''))

    if not bk_ann or bk_ann not in brand_index:
        no_brand += 1
        continue

    model_hint = extract_model_from_href(href_model)
    model_norm = normalize_js(model_hint)
    if not model_hint or 'autre' in model_norm:
        model_hint = title

    ad_text_base = (title + ' ' + desc).strip()
    ad_text_for_cc = (ad_text_base + ' ' + model_hint).strip()
    ad_text_used = (title + ' ' + model_hint).strip()

    ann_cc = cc_from_href(href_cc)
    ann_year = parse_year(a.get('text-body-1 (4)', '')) or parse_year(a.get('text-body-1 (9)', ''))

    ad_tok = tokenize_js(ad_text_used)
    ad_set = set(ad_tok)
    for tok in ad_tok:
        ad_set.add(tok.replace('-', '').replace('_', ''))
    ad_numbers = extract_numbers(ad_text_used)
    ad_norm_compact = normalize_js(ad_text_used).replace('-', '').replace('_', '')

    best_score = 0
    best_p = None

    for p in brand_index[bk_ann]:
        if ann_cc and p['cc']:
            if abs(p['cc'] - ann_cc) > CC_BLOCK_DIFF: continue
        if p['doms']:
            dom_found = False
            for d in p['doms']:
                if isinstance(d, int):
                    if d in ad_numbers or str(d) in ad_norm_compact:
                        dom_found = True; break
                else:
                    d_clean = str(d).replace('-', '').replace('_', '')
                    if d_clean in ad_norm_compact:
                        dom_found = True; break
            if not dom_found: continue
        cov = max((coverage_set(ad_set, vat) for vat in p['vat']), default=0)
        if cov < MIN_COV_ALPHA: continue
        jac = jaccard(ad_tok, p['ctok'])
        cc_bonus = 1.0 if (ann_cc and p['cc'] and ann_cc == p['cc']) else 0
        year_bonus = 1.0 if (ann_year and p['ys'] and p['ye'] and p['ys'] <= ann_year <= p['ye']) else 0
        score = cov * 0.70 + jac * 0.20 + cc_bonus * 0.05 + year_bonus * 0.05
        if score > best_score:
            best_score = score
            best_p = p

    if best_p is None:
        no_model += 1
        if len(fail_samples) < 8:
            fail_samples.append(('no_cand', title[:40], bk_ann, ann_cc))
    elif best_score >= MIN_ACCEPT:
        matched += 1
    else:
        below_thresh += 1
        if len(fail_samples) < 8:
            fail_samples.append(('below', title[:40], round(best_score, 3), best_p['model_raw']))

total = len(lbc_subset)
print(f'Total: {total}')
print(f'Matched: {matched} ({round(matched/total*100)}%)')
print(f'No brand: {no_brand}')
print(f'No candidate: {no_model}')
print(f'Below thresh: {below_thresh}')
print()
print('Fail samples:')
for s in fail_samples:
    print(' ', s)
