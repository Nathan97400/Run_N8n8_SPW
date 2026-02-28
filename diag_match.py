import json, sys, re, unicodedata
sys.stdout.reconfigure(encoding='utf-8')

with open('BDD Modèles/motorcycles_brands_full_ENRICHED.json','r',encoding='utf-8') as f:
    bdd = json.load(f)
with open('JSON LBC/mt14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json','r',encoding='utf-8') as f:
    lbc = json.load(f)

STOP_WORDS = {"moto","motos","scooter","roadster","trail","enduro","cross","vend","vente","vends",
"urgent","etat","tres","super","parfait","paiement","securise","option","full","abs","a2","ct","ok",
"km","kms","kilometrage","boite","vitesse","manuelle","prix","euro","eur","garantie","factures","entretien"}

def normalize(text):
    if not text: return ""
    s = str(text)
    s = unicodedata.normalize("NFD", s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace('_',' ').replace('/',' ').replace('|',' ')
    s = re.sub(r'[^a-z0-9]+',' ',s).strip()
    s = re.sub(r'\b(mt)\s*0?(\d{2})\b', r'\g<1>\2', s)
    s = re.sub(r'\b(fz)\s*(\d)\b', r'\g<1>\2', s)
    s = re.sub(r'\b(gs)\s*(\d{3,4})\b', r'\g<1>\2', s)
    s = re.sub(r'\b(r)\s*(\d{3,4})\b', r'\g<1>\2', s)
    s = re.sub(r'\bv\s*strom\b', 'vstrom', s)
    s = re.sub(r'\b(dr)\s*z\b', 'drz', s)
    return s.strip()

def brand_key(brand): return normalize(brand).replace(' ','')

def tokenize(text):
    n = normalize(text)
    return [t for t in n.split() if t and t not in STOP_WORDS and (re.match(r'^\d+$',t) or len(t)>=2)]

def tokens_alpha_only(tokens):
    return [t for t in tokens if re.search(r'[a-z]',t) and len(t)>=2]

def extract_brand_from_href(href):
    m = re.search(r'u_moto_brand:([^+&/\s]+)', str(href or ''), re.I)
    return re.sub(r'%20',' ',m.group(1)) if m else ''

def extract_model_from_href(href):
    m = re.search(r'u_moto_model:([^+&/\s]+)', str(href or ''), re.I)
    return re.sub(r'%20',' ',m.group(1)) if m else ''

def cc_from_href(href):
    m = re.search(r'cubic_capacity:(\d{2,4})', str(href or ''), re.I)
    return int(m.group(1)) if m else 0

def extract_numbers(text):
    raw = str(text or '')
    raw = re.sub(r'\b\d{1,6}\s*km\b','', raw, flags=re.I)
    raw = re.sub(r'\b(?:0?[1-9]|1[0-2])\s*/\s*(?:19|20)\d{2}\b','', raw)
    n = normalize(raw)
    return [int(x) for x in re.findall(r'\b\d{3,4}\b', n)]

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
    n = normalize(model_raw)
    nums = re.findall(r'\b\d{3,4}\b', n)
    if nums: return [int(x) for x in nums]
    toks = tokenize(model_raw)
    return [t for t in toks if re.search(r'\d',t) or len(t)>=4]

def parse_year(s):
    m = re.search(r'\b(19|20)\d{2}\b', str(s or ''))
    return int(m.group(0)) if m else 0

# Build brand index
brand_index = {}
for m in bdd:
    brand_raw = m.get('Marque', m.get('marque',''))
    model_raw = m.get('Modele', '')
    if not model_raw:
        for k in m:
            if 'mod' in k.lower():
                model_raw = m[k]
                break
    cc_raw = m.get('Cylindree (cc)', 0)
    if not cc_raw:
        for k in m:
            if 'cylindr' in k.lower():
                cc_raw = m[k]
                break
    ys_raw = m.get('Annee debut', 0)
    if not ys_raw:
        for k in m:
            if 'debut' in k.lower() or 'start' in k.lower():
                ys_raw = m[k]
                break
    ye_raw = m.get('Annee fin', None)
    if ye_raw is None:
        for k in m:
            if 'fin' in k.lower() or 'end' in k.lower():
                ye_raw = m[k]
                break
    ys = int(float(ys_raw or 0)) if ys_raw else 0
    ye = 9999 if (ye_raw is None or str(ye_raw).strip()=='') else (int(float(ye_raw)) if str(ye_raw).strip() else 9999)
    if not brand_raw or not model_raw: continue
    bk = brand_key(brand_raw)
    variants = list(set([normalize(p.strip()) for p in str(model_raw).replace('|','/').split('/') if p.strip()]))
    vat = [tokens_alpha_only(tokenize(v)) for v in variants]
    vat = [t for t in vat if t]
    if not vat: continue
    doms = get_dominant_tokens(model_raw)
    ctok = tokenize(brand_raw + ' ' + model_raw)
    if bk not in brand_index: brand_index[bk] = []
    brand_index[bk].append({
        'brand': brand_raw, 'model': model_raw, 'vat': vat, 'ctok': ctok,
        'cc': int(float(cc_raw or 0)), 'ys': ys, 'ye': ye, 'doms': doms
    })

print(f"Brand index: {len(brand_index)} brands, {sum(len(v) for v in brand_index.values())} models")

# Check BDD field names
print("BDD sample keys:", list(bdd[0].keys()))
print()

MIN_COV_ALPHA = 0.85
MIN_ACCEPT = 0.78
CC_BLOCK = 80

passed_cov_failed_score = []
passed_both = []
no_cov = 0

for item in lbc[:300]:
    bh2 = item.get('text-body-1 href (2)','')
    bh3 = item.get('text-body-1 href (3)','')
    bh5 = item.get('text-body-1 href (5)','')
    title = item.get('text-headline-1-expanded','')
    yr1_raw = item.get('text-body-1 (4)','')
    yr2_raw = item.get('text-body-1 (9)','')

    brand_raw = extract_brand_from_href(bh2)
    bk = brand_key(brand_raw)
    model_hint = extract_model_from_href(bh3)
    ann_cc = cc_from_href(bh5)
    ann_year = parse_year(yr1_raw) or parse_year(yr2_raw)

    if not bk or bk not in brand_index: continue

    ad_text = (title + ' ' + model_hint).strip()
    ad_tok = tokenize(ad_text)
    ad_set = set(ad_tok)
    for tok in ad_tok:
        ad_set.add(tok.replace('-','').replace('_',''))
        parts = re.split(r'(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])', tok)
        if len(parts)>1:
            for p in parts:
                if len(p)>=1: ad_set.add(p)
    ad_numbers = extract_numbers(ad_text)
    ad_norm_compact = normalize(ad_text).replace('-','').replace('_','')

    best_score = 0
    best_cov = 0
    best_p = None

    for p in brand_index[bk]:
        if ann_cc and p['cc']:
            if abs(p['cc'] - ann_cc) > CC_BLOCK: continue
        if p['doms']:
            dom_found = False
            for d in p['doms']:
                if isinstance(d, int):
                    if d in ad_numbers or str(d) in ad_norm_compact:
                        dom_found = True; break
                else:
                    if str(d).replace('-','') in ad_norm_compact:
                        dom_found = True; break
            if not dom_found: continue
        cov = max((coverage_set(ad_set, vat) for vat in p['vat']), default=0)
        if cov < MIN_COV_ALPHA: continue
        jac = jaccard(ad_tok, p['ctok'])
        cc_bonus = 1.0 if (ann_cc and p['cc'] and ann_cc == p['cc']) else 0
        year_bonus = 1.0 if (ann_year and p['ys'] and p['ye'] and p['ys'] <= ann_year <= p['ye']) else 0
        score = cov*0.70 + jac*0.20 + cc_bonus*0.05 + year_bonus*0.05
        if score > best_score:
            best_score = score
            best_cov = cov
            best_p = p

    if best_p is None:
        no_cov += 1
    elif best_score >= MIN_ACCEPT:
        passed_both.append(best_score)
    else:
        entry = {
            'score': round(best_score,3), 'cov': round(best_cov,2),
            'model': best_p['brand'] + ' ' + best_p['model'],
            'title': title[:40],
            'cc_ann': ann_cc, 'cc_bdd': best_p['cc'],
            'yr': ann_year, 'ys': best_p['ys'], 'ye': best_p['ye']
        }
        passed_cov_failed_score.append(entry)

print(f"Passed coverage AND min_accept: {len(passed_both)}")
print(f"Passed coverage but failed min_accept: {len(passed_cov_failed_score)}")
print(f"No coverage match (no candidate): {no_cov}")
print()
print("Top samples failing min_accept (highest score):")
for x in sorted(passed_cov_failed_score, key=lambda x: x['score'], reverse=True)[:20]:
    print(f"  score={x['score']} cov={x['cov']} | {x['model']} | {x['title']}")
    print(f"         cc_ann={x['cc_ann']} cc_bdd={x['cc_bdd']} year={x['yr']} ys={x['ys']} ye={x['ye']}")
