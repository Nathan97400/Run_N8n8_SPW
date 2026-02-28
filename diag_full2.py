import json, sys, re, unicodedata, os
from urllib.parse import unquote
from collections import Counter, defaultdict
sys.stdout.reconfigure(encoding='utf-8')

STOP_WORDS = {'moto','motos','scooter','roadster','trail','enduro','cross','vend','vente','vends','urgent','etat','tres','super','parfait','paiement','securise','option','full','abs','a2','ct','ok','km','kms','kilometrage','boite','vitesse','manuelle','prix','euro','eur','garantie','factures','entretien'}
MIN_COV_ALPHA = 0.85; MIN_ACCEPT = 0.73; CC_BLOCK_DIFF = 80

def normalize(t):
    s = str(t or '').lower()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.replace('_',' ').replace('/',' ').replace('|',' ')
    s = re.sub(r'[^a-z0-9]+',' ',s).strip()
    for p,r in [(r'\b(mt)\s*0?(\d{2})\b',r'\g<1>\2'),(r'\b(fz)\s*(\d)\b',r'\g<1>\2'),(r'\b(gs)\s*(\d{3,4})\b',r'\g<1>\2'),(r'\b(r)\s*(\d{3,4})\b',r'\g<1>\2'),(r'\bv\s*strom\b','vstrom'),(r'\b(dr)\s*z\b','drz')]:
        s = re.sub(p,r,s)
    return s

def bkey(b): return normalize(b).replace(' ','')
def tokenize(t):
    n=normalize(t)
    return [x for x in n.split() if x and x not in STOP_WORDS and (re.match(r'^\d+$',x) or len(x)>=2)]
def alpha_only(toks): return [t for t in toks if re.search(r'[a-z]',t) and len(t)>=2]
def cvg(ad_set,mt):
    if not mt: return 0
    ac={t.replace('-','').replace('_','') for t in ad_set}
    return sum(1 for t in mt if t in ad_set or t.replace('-','').replace('_','') in ac)/len(mt)
def jacc(a,b):
    A,B=set(a),set(b)
    if not A or not B: return 0
    return len(A&B)/(len(A)+len(B)-len(A&B))
def parse_yr(s):
    s=str(s or '')
    m=re.search(r'\b(0?[1-9]|1[0-2])\s*/\s*((19|20)\d{2})\b',s)
    if m: return int(m.group(2))
    m=re.search(r'\b(19|20)\d{2}\b',s)
    return int(m.group(0)) if m else 0
def extr_nums(text):
    raw=str(text or '')
    raw=re.sub(r'\b\d{1,6}\s*km\b',' ',raw,flags=re.I)
    raw=re.sub(r'\b(0?[1-9]|1[0-2])\s*/\s*((19|20)\d{2})\b',' ',raw)
    return [int(x) for x in re.findall(r'\b\d{3,4}\b',normalize(raw))]
def get_doms(mr):
    n=normalize(mr)
    nums=re.findall(r'\b\d{3,4}\b',n)
    if nums: return [int(x) for x in nums]
    toks=tokenize(mr)
    return [t for t in toks if re.search(r'\d',t) or len(t)>=4]

tmp = os.environ.get('TEMP','C:/Temp')
with open(os.path.join(tmp,'worker_response.json'),'r',encoding='utf-8') as f:
    bdd = json.load(f)
print(f'Worker BDD: {len(bdd)} entries')

brand_index = {}
for m in bdd:
    br = m.get('Marque','') or ''
    mo = m.get('Mod\u00e8le','') or ''
    if not br or not mo: continue
    bk = bkey(br)
    cc_raw = m.get('Cylindr\u00e9e (cc)')
    cc = round(float(cc_raw)) if cc_raw else 0
    ys_raw = m.get('Ann\u00e9e d\u00e9but')
    ye_raw = m.get('Ann\u00e9e fin')
    ys = int(float(ys_raw)) if ys_raw else 0
    ye = 9999 if ye_raw is None else (int(float(ye_raw)) if ye_raw else 9999)
    variants = [normalize(p.strip()) for p in str(mo).replace('|','/').split('/') if p.strip()]
    vat = [alpha_only(tokenize(v)) for v in variants]
    vat = [t for t in vat if t]
    if not vat: continue
    doms = get_doms(mo)
    ctok = tokenize(str(br)+' '+str(mo))
    if bk not in brand_index: brand_index[bk] = []
    brand_index[bk].append({'cc':cc,'ys':ys,'ye':ye,'vat':vat,'doms':doms,'ctok':ctok,'model_raw':mo,'brand_raw':br})

lbc_path = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/JSON LBC/mt14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json'
with open(lbc_path, 'r', encoding='utf-8') as f:
    lbc = json.load(f)

fail = Counter()
fail_brands = Counter()
fail_models = defaultdict(list)
dom_fail_samples = []

for a in lbc:
    title = a.get('text-headline-1-expanded','')
    href_brand = a.get('text-body-1 href (2)','')
    href_model = a.get('text-body-1 href (3)','')
    href_cc = a.get('text-body-1 href (5)','')
    mb = re.search(r'u_moto_brand:([^+&]+)',str(href_brand),re.I)
    brand_str = unquote(mb.group(1).replace('+', ' ')) if mb else ''
    bk = bkey(brand_str) if brand_str else ''
    if not bk or bk not in brand_index:
        fail['brand_not_found'] += 1
        fail_brands[brand_str or 'NO_BRAND'] += 1
        continue
    mm = re.search(r'u_moto_model:([^+&]+)',str(href_model),re.I)
    model_hint = unquote(mm.group(1).replace('+', ' ')) if mm else ''
    if not model_hint or 'autre' in normalize(model_hint): model_hint = title
    mcc = re.search(r'cubic_capacity:(\d{2,4})',str(href_cc),re.I)
    ann_cc = int(mcc.group(1)) if mcc else 0
    ann_year = parse_yr(a.get('text-body-1 (6)','')) or parse_yr(a.get('text-body-1 (9)',''))
    ad_text = (title+' '+model_hint).strip()
    ad_tok = tokenize(ad_text)
    ad_set = set(ad_tok)|{t.replace('-','').replace('_','') for t in ad_tok}
    ad_nums = extr_nums(ad_text)
    ad_comp = normalize(ad_text).replace('-','').replace('_','')
    best_score = 0; best_p = None; dom_blocked = []; cov_blocked = []
    for p in brand_index[bk]:
        if ann_cc and p['cc']:
            if abs(p['cc']-ann_cc) > CC_BLOCK_DIFF: continue
        if p['doms']:
            dom_found = any((d in ad_nums or str(d) in ad_comp) if isinstance(d,int) else str(d).replace('-','').replace('_','') in ad_comp for d in p['doms'])
            if not dom_found:
                dom_blocked.append(p['model_raw'])
                continue
        c = max((cvg(ad_set,vat) for vat in p['vat']),default=0)
        if c < MIN_COV_ALPHA:
            cov_blocked.append((c, p['model_raw']))
            continue
        jac = jacc(ad_tok,p['ctok'])
        sc = c*0.70+jac*0.20+(1.0 if ann_cc and p['cc'] and ann_cc==p['cc'] else 0)*0.05+(1.0 if ann_year and p['ys'] and p['ye'] and p['ys']<=ann_year<=p['ye'] else 0)*0.05
        if sc > best_score: best_score=sc; best_p=p
    if best_p is None:
        # Find if dom was the culprit
        if dom_blocked and not cov_blocked:
            fail['no_cand_dom_block'] += 1
            key = f"{brand_str}|{model_hint[:25]}"
            fail_models[key].append(f"dom_blocked:{dom_blocked[:2]}|cc={ann_cc}|{title[:30]}")
            if len(dom_fail_samples) < 15:
                dom_fail_samples.append({'title':title,'brand':brand_str,'ann_cc':ann_cc,'model_hint':model_hint,'dom_blocked':dom_blocked[:3]})
        else:
            fail['no_cand_other'] += 1
            key = f"{brand_str}|{model_hint[:25]}"
            fail_models[key].append(f"cov_blocked:{cov_blocked[:1]}|cc={ann_cc}|{title[:30]}")
    elif best_score < MIN_ACCEPT:
        fail['below_threshold'] += 1
    else:
        fail['matched'] += 1

total = len(lbc)
print(f'Total: {total}')
for k,v in sorted(fail.items(),key=lambda x:-x[1]):
    print(f'  {k}: {v} ({round(v/total*100,1)}%)')
print()
print('=== Brand not found ===')
for k,v in fail_brands.most_common(20):
    print(f'  {repr(k)}: {v}')
print()
print('=== Dom-blocked samples (models that fail because dom not in ad) ===')
for s in dom_fail_samples[:10]:
    print(f"  title={s['title'][:40]!r} ann_cc={s['ann_cc']} dom_blocked={s['dom_blocked']}")
print()
print('=== Top no_cand_other keys ===')
for key,samples in sorted(fail_models.items(),key=lambda x:-len(x[1]))[:15]:
    if 'cov_blocked' in str(samples):
        print(f"  {key}: {len(samples)}x  ex: {samples[0][:80]}")
