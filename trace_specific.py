"""
Targeted debug for specific failing models
"""
import json, sys, re, unicodedata, os
from urllib.parse import unquote
sys.stdout.reconfigure(encoding='utf-8')

STOP_WORDS = {'moto','motos','scooter','roadster','trail','enduro','cross','vend','vente','vends','urgent','etat','tres','super','parfait','paiement','securise','option','full','abs','a2','ct','ok','km','kms','kilometrage','boite','vitesse','manuelle','prix','euro','eur','garantie','factures','entretien'}
MIN_COV_ALPHA = 0.85; MIN_ACCEPT = 0.73; CC_BLOCK_DIFF = 80

def normalize(t):
    s = str(t or '').lower()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.replace('_',' ').replace('/',' ').replace('|',' ')
    s = re.sub(r'[^a-z0-9]+',' ',s).strip()
    s = re.sub(r'\bo(\d{1,3})\b', r'0\1', s)
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

tmp=os.environ.get('TEMP','C:/Temp')
with open(os.path.join(tmp,'worker_response.json'),'r',encoding='utf-8') as f:
    worker_bdd=json.load(f)
with open('supplement_bdd.json','r',encoding='utf-8') as f:
    supplement=json.load(f)
all_bdd = worker_bdd + supplement

brand_index={}
for m in all_bdd:
    br=m.get('Marque','') or ''
    mo=m.get('Modele','') or m.get('Modèle','') or ''
    if not br or not mo: continue
    bk=bkey(br)
    cc_raw=m.get('Cylindree (cc)') or m.get('Cylindrée (cc)') or m.get('Cylindree','')
    cc=round(float(cc_raw)) if cc_raw else 0
    ys_raw=m.get('Annee debut') or m.get('Année début') or m.get('Annee_debut')
    ye_raw=m.get('Annee fin') or m.get('Année fin') or m.get('Annee_fin')
    ys=int(float(ys_raw)) if ys_raw else 0
    ye=9999 if ye_raw is None else (int(float(ye_raw)) if ye_raw else 9999)
    variants=[normalize(p.strip()) for p in str(mo).replace('|','/').split('/') if p.strip()]
    vat=[alpha_only(tokenize(v)) for v in variants]; vat=[t for t in vat if t]
    if not vat: continue
    doms=get_doms(mo); ctok=tokenize(str(br)+' '+str(mo))
    if bk not in brand_index: brand_index[bk]=[]
    brand_index[bk].append({'cc':cc,'ys':ys,'ye':ye,'vat':vat,'doms':doms,'ctok':ctok,'model_raw':mo,'br':br})

# Test case: Suzuki SV 650
print("=== TEST: Suzuki SV 650 ===")
title = "Sv 650 2019"
model_hint_raw = "SUZUKI_SV"
ann_cc = 650
ann_year = 2019
ad_text = title + ' ' + model_hint_raw
print(f"ad_text: {ad_text!r}")
print(f"normalize: {normalize(ad_text)!r}")
ad_tok = tokenize(ad_text)
ad_set = set(ad_tok)|{t.replace('-','').replace('_','') for t in ad_tok}
ad_nums = extr_nums(ad_text)
ad_comp = normalize(ad_text).replace('-','').replace('_','')
print(f"ad_tok: {ad_tok}")
print(f"ad_set: {sorted(ad_set)}")
print(f"ad_nums: {ad_nums}")
print(f"ad_comp: {ad_comp!r}")
print()

print("Suzuki SV models in BDD:")
for p in brand_index.get('suzuki',[]):
    if 'sv' in p['model_raw'].lower() and '650' in str(p['cc']) or ('sv' in p['model_raw'].lower() and '645' in str(p['cc'])):
        print(f"  model_raw={p['model_raw']!r} cc={p['cc']} doms={p['doms']} vat={p['vat']}")
        # Test DOM
        dom_ok = False
        for d in p['doms']:
            if isinstance(d, int):
                c1 = ann_cc and abs(d-ann_cc)<=CC_BLOCK_DIFF
                c2 = d in ad_nums
                c3 = str(d) in ad_comp
                print(f"    dom {d} (int): prox={c1} in_nums={c2} in_comp={c3}")
                dom_ok = dom_ok or c1 or c2 or c3
            else:
                d_clean = str(d).replace('-','').replace('_','')
                c1 = d_clean in ad_comp
                c2 = d_clean in ad_comp.replace(' ','')
                print(f"    dom {d!r} (str): in_comp={c1} in_compact={c2}")
                dom_ok = dom_ok or c1
        # Test COV
        cov = max((cvg(ad_set,vat) for vat in p['vat']),default=0)
        print(f"    dom_ok={dom_ok} cov={cov:.2f}")

print()
print("=== TEST: Honda CBR 500R ===")
title2 = "Honda cbr 500r 2017"
model_hint2 = "HONDA_CBR"
ann_cc2 = 500
ann_year2 = 2017
ad_text2 = title2 + ' ' + model_hint2
ad_tok2 = tokenize(ad_text2)
ad_set2 = set(ad_tok2)|{t.replace('-','').replace('_','') for t in ad_tok2}
ad_nums2 = extr_nums(ad_text2)
ad_comp2 = normalize(ad_text2).replace('-','').replace('_','')
print(f"ad_tok: {ad_tok2}")
print(f"ad_set: {sorted(ad_set2)}")
print(f"ad_nums: {ad_nums2}")
print(f"ad_comp: {ad_comp2!r}")
print()
print("Honda CBR500R models in BDD:")
for p in brand_index.get('honda',[]):
    if '500' in str(p['cc']) and 'cbr' in p['model_raw'].lower():
        print(f"  model_raw={p['model_raw']!r} cc={p['cc']} doms={p['doms']} vat={p['vat']}")
        for d in p['doms']:
            if isinstance(d, str):
                d_clean = str(d).replace('-','').replace('_','')
                print(f"    dom {d!r}: in_comp={d_clean in ad_comp2} in_compact={d_clean in ad_comp2.replace(' ','')}")
        cov = max((cvg(ad_set2,vat) for vat in p['vat']),default=0)
        print(f"    cov={cov:.2f}")
        break  # just show first match

print()
print("=== TEST: BMW R1200R ===")
title3 = "BMW R1200R ABS INTÉGRAL SPORT ABS 2007 (vente & Echange)"
model_hint3 = "BMW_R"
ann_cc3 = 1200
ann_year3 = 2007
ad_text3 = title3 + ' ' + model_hint3
ad_tok3 = tokenize(ad_text3)
ad_set3 = set(ad_tok3)|{t.replace('-','').replace('_','') for t in ad_tok3}
ad_nums3 = extr_nums(ad_text3)
ad_comp3 = normalize(ad_text3).replace('-','').replace('_','')
print(f"ad_tok: {ad_tok3}")
print(f"ad_nums: {ad_nums3}")
print(f"ad_comp: {ad_comp3!r}")
print()
print("BMW R1200R models in BDD (first 3):")
count = 0
for p in brand_index.get('bmw',[]):
    if 'r1200r' in normalize(p['model_raw']).replace(' ','') and count < 3:
        count += 1
        print(f"  model_raw={p['model_raw']!r} cc={p['cc']} ys={p['ys']} ye={p['ye']}")
        print(f"  doms={p['doms']} vat={p['vat']}")
        for d in p['doms']:
            if isinstance(d, str):
                d_clean = d.replace('-','').replace('_','')
                print(f"  dom {d!r}: in_comp={d_clean in ad_comp3} in_compact={d_clean in ad_comp3.replace(' ','')}")
            elif isinstance(d, int):
                print(f"  dom {d} (int): prox={ann_cc3 and abs(d-ann_cc3)<=CC_BLOCK_DIFF} in_nums={d in ad_nums3} in_comp={str(d) in ad_comp3}")
        cov = max((cvg(ad_set3,vat) for vat in p['vat']),default=0)
        print(f"  year_ok={p['ys']<=ann_year3<=p['ye'] if p['ys'] else True}")
        print(f"  cc_diff={abs(p['cc']-ann_cc3) if p['cc'] else 'n/a'}")
        print(f"  cov={cov:.2f}")
