import json, sys, re, unicodedata, subprocess
from urllib.parse import unquote
from collections import Counter, defaultdict
sys.stdout.reconfigure(encoding='utf-8')

STOP_WORDS = {'moto','motos','scooter','roadster','trail','enduro','cross','vend','vente','vends',
'urgent','etat','tres','super','parfait','paiement','securise','option','full','abs','a2','ct','ok',
'km','kms','kilometrage','boite','vitesse','manuelle','prix','euro','eur','garantie','factures','entretien'}
MIN_COV_ALPHA = 0.85
MIN_ACCEPT = 0.73
CC_BLOCK_DIFF = 80

def normalize(t):
    s = str(t or '').lower()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.replace('_', ' ').replace('/', ' ').replace('|', ' ')
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    for p,r in [(r'\b(mt)\s*0?(\d{2})\b',r'\g<1>\2'),(r'\b(fz)\s*(\d)\b',r'\g<1>\2'),
                (r'\b(gs)\s*(\d{3,4})\b',r'\g<1>\2'),(r'\b(r)\s*(\d{3,4})\b',r'\g<1>\2'),
                (r'\bv\s*strom\b','vstrom'),(r'\b(dr)\s*z\b','drz')]:
        s = re.sub(p, r, s)
    return s

def bkey(b): return normalize(b).replace(' ', '')
def tokenize(t):
    n = normalize(t)
    return [x for x in n.split() if x and x not in STOP_WORDS and (re.match(r'^\d+$',x) or len(x)>=2)]
def alpha_only(toks): return [t for t in toks if re.search(r'[a-z]',t) and len(t)>=2]
def coverage_set(ad_set, model_toks):
    if not model_toks: return 0
    ac = {t.replace('-','').replace('_','') for t in ad_set}
    return sum(1 for t in model_toks if t in ad_set or t.replace('-','').replace('_','') in ac)/len(model_toks)
def jaccard(a,b):
    A,B=set(a),set(b)
    if not A or not B: return 0
    return len(A&B)/(len(A)+len(B)-len(A&B))
def parse_year(s):
    s=str(s or '')
    m=re.search(r'\b(0?[1-9]|1[0-2])\s*/\s*((19|20)\d{2})\b',s)
    if m: return int(m.group(2))
    m=re.search(r'\b(19|20)\d{2}\b',s)
    return int(m.group(0)) if m else 0
def extract_numbers(text):
    raw=str(text or '')
    raw=re.sub(r'\b\d{1,6}\s*km\b',' ',raw,flags=re.I)
    raw=re.sub(r'\b(0?[1-9]|1[0-2])\s*/\s*((19|20)\d{2})\b',' ',raw)
    return [int(x) for x in re.findall(r'\b\d{3,4}\b', normalize(raw))]
def get_doms(model_raw):
    n=normalize(model_raw)
    nums=re.findall(r'\b\d{3,4}\b',n)
    if nums: return [int(x) for x in nums]
    toks=tokenize(model_raw)
    return [t for t in toks if re.search(r'\d',t) or len(t)>=4]

# Charger Worker BDD
print("Fetching Worker BDD...")
res = subprocess.run(['curl','-s','https://nante.nathansouffrin7.workers.dev/'], capture_output=True, text=True, encoding='utf-8')
bdd = json.loads(res.stdout)
print(f'Worker BDD: {len(bdd)} entries')

brand_index = {}
for m in bdd:
    brand_raw = m.get('Marque','') or ''
    model_raw = m.get('Modele', '') or m.get('Mod\u00e8le','') or ''
    if not brand_raw or not model_raw: continue
    bk = bkey(brand_raw)
    cc_raw = m.get('Cylindree (cc)') or m.get('Cylindr\u00e9e (cc)')
    cc = round(float(cc_raw)) if cc_raw else 0
    ys_raw = m.get('Annee debut') or m.get('Ann\u00e9e d\u00e9but')
    ye_raw = m.get('Annee fin') or m.get('Ann\u00e9e fin')
    ys = int(float(ys_raw)) if ys_raw else 0
    ye = 9999 if ye_raw is None else (int(float(ye_raw)) if ye_raw else 9999)
    variants = [normalize(p.strip()) for p in str(model_raw).replace('|','/').split('/') if p.strip()]
    vat = [alpha_only(tokenize(v)) for v in variants]
    vat = [t for t in vat if t]
    if not vat: continue
    doms = get_doms(model_raw)
    ctok = tokenize(str(brand_raw)+' '+str(model_raw))
    if bk not in brand_index: brand_index[bk] = []
    brand_index[bk].append({'cc':cc,'ys':ys,'ye':ye,'vat':vat,'doms':doms,'ctok':ctok,'model_raw':model_raw})

print(f'Brand index: {len(brand_index)} brands')

# Charger LBC
lbc_path = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/JSON LBC/mt14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json'
with open(lbc_path, 'r', encoding='utf-8') as f:
    lbc = json.load(f)

LIMIT = 218
lbc_sub = lbc[:LIMIT]

fail_reasons = Counter()
fail_details = defaultdict(list)

for a in lbc_sub:
    title = a.get('text-headline-1-expanded','')
    href_brand = a.get('text-body-1 href (2)','')
    href_model = a.get('text-body-1 href (3)','')
    href_cc = a.get('text-body-1 href (5)','')

    mb = re.search(r'u_moto_brand:([^+&]+)', str(href_brand), re.I)
    brand_str = unquote(mb.group(1).replace('+', ' ')) if mb else ''
    bk = bkey(brand_str) if brand_str else bkey(a.get('text-body-1 (4)',''))

    if not bk or bk not in brand_index:
        fail_reasons['brand_not_found'] += 1
        fail_details['brand_not_found'].append(f'{brand_str!r} | {title[:40]}')
        continue

    mm = re.search(r'u_moto_model:([^+&]+)', str(href_model), re.I)
    model_hint = unquote(mm.group(1).replace('+', ' ')) if mm else ''
    if not model_hint or 'autre' in normalize(model_hint):
        model_hint = title

    mcc = re.search(r'cubic_capacity:(\d{2,4})', str(href_cc), re.I)
    ann_cc = int(mcc.group(1)) if mcc else 0
    ann_year = parse_year(a.get('text-body-1 (6)','')) or parse_year(a.get('text-body-1 (9)',''))

    ad_text = (title + ' ' + model_hint).strip()
    ad_tok = tokenize(ad_text)
    ad_set = set(ad_tok) | {t.replace('-','').replace('_','') for t in ad_tok}
    ad_nums = extract_numbers(ad_text)
    ad_compact = normalize(ad_text).replace('-','').replace('_','')

    best_score = 0
    best_p = None
    dom_blocks = 0
    cov_blocks = 0

    for p in brand_index[bk]:
        if ann_cc and p['cc']:
            if abs(p['cc'] - ann_cc) > CC_BLOCK_DIFF: continue
        if p['doms']:
            dom_found = False
            for d in p['doms']:
                if isinstance(d, int):
                    if d in ad_nums or str(d) in ad_compact:
                        dom_found = True; break
                else:
                    dc = str(d).replace('-','').replace('_','')
                    if dc in ad_compact: dom_found = True; break
            if not dom_found:
                dom_blocks += 1
                continue
        cov = max((coverage_set(ad_set, vat) for vat in p['vat']), default=0)
        if cov < MIN_COV_ALPHA:
            cov_blocks += 1
            continue
        jac = jaccard(ad_tok, p['ctok'])
        ccs = 1.0 if (ann_cc and p['cc'] and ann_cc == p['cc']) else 0
        yrs = 1.0 if (ann_year and p['ys'] and p['ye'] and p['ys'] <= ann_year <= p['ye']) else 0
        sc = cov*0.70 + jac*0.20 + ccs*0.05 + yrs*0.05
        if sc > best_score: best_score=sc; best_p=p

    if best_p is None:
        fail_reasons['no_candidate'] += 1
        fail_details['no_candidate'].append(f'{brand_str}|{model_hint[:25]}|cc={ann_cc}|dom_blk={dom_blocks}|cov_blk={cov_blocks}|"{title[:35]}"')
    elif best_score < MIN_ACCEPT:
        fail_reasons['below_threshold'] += 1
        fail_details['below_threshold'].append(f'{round(best_score,3)}|{best_p["model_raw"]!r}|"{title[:35]}"')
    else:
        fail_reasons['matched'] += 1

total = LIMIT
print(f'\n=== RESULTATS ({total} items) ===')
for k,v in sorted(fail_reasons.items(), key=lambda x: -x[1]):
    pct = round(v/total*100)
    print(f'  {k}: {v} ({pct}%)')

print()
for cat, items in fail_details.items():
    print(f'=== {cat} ({len(items)} items) ===')
    for x in items[:20]: print(' ', x)
    if len(items) > 20: print(f'  ... +{len(items)-20} more')
    print()
