"""
Simulation EXACTE du 1st Match JS (comportement n8n) sur les 218 premiers items.
Reproduit:
- pickAnnonceYear: fallback texte (adTextForCC)
- getAnnonceCC: fallback extractCCFromText + inferCCFromNumbers
- year gate (Pass 1) + no-year gate (Pass 2)
"""
import sys, json, re, unicodedata
sys.stdout.reconfigure(encoding='utf-8')

STOP_WORDS = {'moto','motos','scooter','roadster','trail','enduro','cross','vend','vente','vends',
'urgent','etat','tres','super','parfait','paiement','securise','option','full','abs','a2','ct','ok',
'km','kms','kilometrage','boite','vitesse','manuelle','prix','euro','eur','garantie','factures','entretien'}
MIN_COV_ALPHA = 0.85
MIN_ACCEPT = 0.73
CC_BLOCK_DIFF = 80
LIMIT = 218

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

def extract_cc_from_text(text):
    """JS: extractCCFromText - cherche pattern "125cc", "125 cm3" etc."""
    raw = str(text or '')
    no_km = re.sub(r'\b\d{1,6}\s*km\b', ' ', raw, flags=re.I)
    s = normalize_js(no_km)
    m = re.search(r'\b(\d{2,4})\s*(cc|cm3|ccm)\b', s)
    if m: return int(m.group(1))
    m = re.search(r'\b(\d{2,4})(cc|cm3|ccm)\b', s)
    if m: return int(m.group(1))
    return 0

def infer_cc_from_numbers(ad_text, annonce_year):
    """JS: inferCCFromNumbers - infer CC depuis nombres (hors km/dates)"""
    nums = extract_numbers(ad_text)
    candidates = [n for n in nums if 50 <= n <= 2500 and (not annonce_year or n != annonce_year)]
    return max(candidates) if candidates else 0

def get_annonce_cc_js(a, ad_text, annonce_year):
    """Reproduction exacte de getAnnonceCC JS"""
    # 1. href (most reliable)
    cc_h = cc_from_href(a.get('text-body-1 href (5)', ''))
    if cc_h: return cc_h
    # 2. champ texte (text-body-1 (7))
    cc_txt_field = str(a.get('text-body-1 (7)', '') or '')
    if cc_txt_field:
        cc_f = extract_cc_from_text(cc_txt_field)
        if cc_f: return cc_f
    # 3. depuis description
    cc_t = extract_cc_from_text(ad_text)
    if cc_t: return cc_t
    # 4. inférence depuis nombres
    return infer_cc_from_numbers(ad_text, annonce_year)

def pick_annonce_year_js(a, ad_text):
    """Reproduction exacte de pickAnnonceYear JS (avec fallback texte)"""
    for field in ['text-body-1 (4)', 'text-body-1 (9)']:
        val = str(a.get(field, '') or '')
        m = re.search(r'\b(0?[1-9]|1[0-2])\s*/\s*((19|20)\d{2})\b', val)
        if m: return int(m.group(2))
        m = re.search(r'\b(19|20)\d{2}\b', val)
        if m: return int(m.group(0))
    # Fallback: extraction depuis texte
    m = re.search(r'\b(19|20)\d{2}\b', str(ad_text or ''))
    if m: return int(m.group(0))
    return 0

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

print(f'Brand index: {len(brand_index)} brands')

# Load LBC
lbc_path = 'JSON LBC/mt14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json'
with open(lbc_path, 'r', encoding='utf-8') as f:
    lbc = json.load(f)

lbc218 = lbc[:LIMIT]

# Stats
matched = 0; no_brand = 0; no_model = 0; below_thresh = 0
fail_year_gate = 0  # Pass 2 aurait pu sauver mais pas lancé
fail_samples = []

for idx, a in enumerate(lbc218):
    title = a.get('text-headline-1-expanded', '')
    desc = a.get('text-body-1 (17)', a.get('text-body-1 (16)', ''))
    href_brand = a.get('text-body-1 href (2)', '')
    href_model = a.get('text-body-1 href (3)', '')

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

    # JS behavior: year from text fallback
    annonce_year = pick_annonce_year_js(a, ad_text_for_cc)
    # JS behavior: CC with fallback to text inference
    annonce_cc = get_annonce_cc_js(a, ad_text_for_cc, annonce_year)

    ad_tok = tokenize_js(ad_text_used)
    ad_set = set(ad_tok)
    for tok in ad_tok:
        ad_set.add(tok.replace('-', '').replace('_', ''))
        # JS also splits alpha-digit boundaries
        parts = re.split(r'(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])', tok)
        if len(parts) > 1:
            for p in parts:
                if len(p) >= 1: ad_set.add(p)
    ad_numbers = extract_numbers(ad_text_used)
    ad_norm_compact = normalize_js(ad_text_used).replace('-', '').replace('_', '')

    # 2 passes: pass1 with year gate, pass2 without
    best_score = 0
    best_p = None
    found_in_pass1 = False

    for pass_idx in range(2):
        use_year = (pass_idx == 0)
        if pass_idx == 1 and found_in_pass1:
            break  # Skip pass 2 if found in pass 1

        for p in brand_index[bk_ann]:
            # Year gate (pass 1 only)
            if use_year and annonce_year:
                if annonce_year < p['ys'] or annonce_year > p['ye']:
                    continue

            # CC gate
            if annonce_cc and p['cc']:
                if abs(p['cc'] - annonce_cc) > CC_BLOCK_DIFF:
                    continue

            # DOM gate
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

            # Coverage gate
            cov = max((coverage_set(ad_set, vat) for vat in p['vat']), default=0)
            if cov < MIN_COV_ALPHA: continue

            jac = jaccard(ad_tok, p['ctok'])
            cc_bonus = 1.0 if (annonce_cc and p['cc'] and annonce_cc == p['cc']) else 0
            year_bonus = 1.0 if (annonce_year and p['ys'] and p['ye'] and p['ys'] <= annonce_year <= p['ye']) else 0
            score = cov * 0.70 + jac * 0.20 + cc_bonus * 0.05 + year_bonus * 0.05

            if score > best_score:
                best_score = score
                best_p = p
                if use_year:
                    found_in_pass1 = True

    if best_p is None:
        no_model += 1
        if len(fail_samples) < 5:
            fail_samples.append(('no_cand', title[:40], bk_ann, annonce_cc, annonce_year))
    elif best_score >= MIN_ACCEPT:
        matched += 1
    else:
        below_thresh += 1
        if len(fail_samples) < 5:
            fail_samples.append(('below', title[:40], round(best_score, 3), best_p['model_raw'], annonce_cc, annonce_year))

total = len(lbc218)
print(f'Total: {total}')
print(f'Matched: {matched} ({round(matched/total*100)}%)')
print(f'No brand: {no_brand}')
print(f'No candidate: {no_model}')
print(f'Below thresh: {below_thresh}')
print()
print('Fail samples:')
for s in fail_samples:
    print(' ', s)
