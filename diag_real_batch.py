"""
Diagnostic simulation on the REAL 236-item batch
"""
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

tmp=os.environ.get('TEMP','C:/Temp')
with open(os.path.join(tmp,'worker_response.json'),'r',encoding='utf-8') as f:
    worker_bdd=json.load(f)
with open('supplement_bdd.json','r',encoding='utf-8') as f:
    supplement=json.load(f)
all_bdd = worker_bdd + supplement
print(f'BDD: Worker={len(worker_bdd)} + Supplement={len(supplement)} = {len(all_bdd)}')

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
    brand_index[bk].append({'cc':cc,'ys':ys,'ye':ye,'vat':vat,'doms':doms,'ctok':ctok,'model_raw':mo})

LBC_PATH = 'C:/Users/natha/Downloads/14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-23 (1) (1).json'
with open(LBC_PATH,'r',encoding='utf-8') as f:
    lbc=json.load(f)

fail=Counter()
fail_details = defaultdict(list)

for a in lbc:
    title=a.get('text-headline-1-expanded','')
    href_brand=a.get('text-body-1 href (2)','')
    href_model=a.get('text-body-1 href (3)','')
    href_cc=a.get('text-body-1 href (5)','')
    mb=re.search(r'u_moto_brand:([^+&]+)',str(href_brand),re.I)
    brand_str=unquote(mb.group(1).replace('+', ' ')) if mb else ''
    bk=bkey(brand_str) if brand_str else ''
    if not bk or bk not in brand_index:
        fail['brand_not_found']+=1
        fail_details['brand_not_found'].append(f'{brand_str!r}: {title[:45]}')
        continue
    mm=re.search(r'u_moto_model:([^+&]+)',str(href_model),re.I)
    model_hint=unquote(mm.group(1).replace('+', ' ')) if mm else ''
    if not model_hint or 'autre' in normalize(model_hint): model_hint=title
    mcc=re.search(r'cubic_capacity:(\d{2,4})',str(href_cc),re.I)
    raw_cc=int(mcc.group(1)) if mcc else 0
    ann_cc = raw_cc if raw_cc <= 2500 else 0
    ann_year=parse_yr(a.get('text-body-1 (6)','')) or parse_yr(a.get('text-body-1 (9)',''))
    ad_text=(title+' '+model_hint).strip()
    ad_tok=tokenize(ad_text)
    ad_set=set(ad_tok)|{t.replace('-','').replace('_','') for t in ad_tok}
    ad_nums=extr_nums(ad_text)
    ad_comp=normalize(ad_text).replace('-','').replace('_','')
    best_score=0; best_p=None

    passes=[{'useYear':True,'useCC':True},{'useYear':False,'useCC':True},{'useYear':False,'useCC':False}]
    for pass_ in passes:
        for p in brand_index[bk]:
            if pass_['useYear'] and ann_year and p['ys']:
                if ann_year < p['ys'] or ann_year > p['ye']: continue
            if pass_['useCC'] and ann_cc and p['cc']:
                if abs(p['cc']-ann_cc)>CC_BLOCK_DIFF: continue
            if p['doms']:
                def dom_check(d):
                    if isinstance(d,int):
                        if ann_cc and abs(d-ann_cc)<=CC_BLOCK_DIFF: return True
                        return d in ad_nums or str(d) in ad_comp
                    else:
                        return str(d).replace('-','').replace('_','') in ad_comp
                if not any(dom_check(d) for d in p['doms']): continue
            c=max((cvg(ad_set,vat) for vat in p['vat']),default=0)
            if c<MIN_COV_ALPHA: continue
            A,B=set(ad_tok),set(p['ctok'])
            jac=len(A&B)/(len(A)+len(B)-len(A&B)) if A and B else 0
            sc=c*0.70+jac*0.20+(1.0 if ann_cc and p['cc'] and ann_cc==p['cc'] else 0)*0.05+(1.0 if ann_year and p['ys'] and p['ye'] and p['ys']<=ann_year<=p['ye'] else 0)*0.05
            if sc>best_score: best_score=sc; best_p=p
        if best_p: break

    if best_p is None:
        fail['no_candidate']+=1
        fail_details['no_candidate'].append(f'{brand_str!r} cc={ann_cc}: {title[:50]}')
    elif best_score<MIN_ACCEPT:
        fail['below_threshold']+=1
        fail_details['below_threshold'].append(f'{brand_str!r} sc={round(best_score,2)}: {title[:50]}')
    else:
        fail['matched']+=1

total=len(lbc)
print(f'\n=== REAL BATCH ({total} items) ===')
for k,v in sorted(fail.items(),key=lambda x:-x[1]):
    print(f'  {k}: {v} ({round(v/total*100,1)}%)')
print(f'\nMatch rate: {round(fail["matched"]/total*100,1)}%')

print(f'\n--- brand_not_found ({len(fail_details["brand_not_found"])}) ---')
for x in fail_details['brand_not_found'][:25]: print(f'  {x}')

print(f'\n--- no_candidate ({len(fail_details["no_candidate"])}) ---')
for x in fail_details['no_candidate'][:30]: print(f'  {x}')

print(f'\n--- below_threshold ({len(fail_details["below_threshold"])}) ---')
for x in fail_details['below_threshold'][:15]: print(f'  {x}')
