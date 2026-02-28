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
    bdd=json.load(f)
brand_index={}
for m in bdd:
    br=m.get('Marque','') or ''; mo=m.get('Mod\u00e8le','') or ''
    if not br or not mo: continue
    bk=bkey(br)
    cc_raw=m.get('Cylindr\u00e9e (cc)'); cc=round(float(cc_raw)) if cc_raw else 0
    ys_raw=m.get('Ann\u00e9e d\u00e9but'); ye_raw=m.get('Ann\u00e9e fin')
    ys=int(float(ys_raw)) if ys_raw else 0
    ye=9999 if ye_raw is None else (int(float(ye_raw)) if ye_raw else 9999)
    variants=[normalize(p.strip()) for p in str(mo).replace('|','/').split('/') if p.strip()]
    vat=[alpha_only(tokenize(v)) for v in variants]; vat=[t for t in vat if t]
    if not vat: continue
    doms=get_doms(mo); ctok=tokenize(str(br)+' '+str(mo))
    if bk not in brand_index: brand_index[bk]=[]
    brand_index[bk].append({'cc':cc,'ys':ys,'ye':ye,'vat':vat,'doms':doms,'ctok':ctok,'model_raw':mo})

with open('C:/Users/natha/Documents/projets_claude-code/n8n_builders/JSON LBC/mt14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json',encoding='utf-8') as f:
    lbc=json.load(f)

fail_titles = []
for a in lbc:
    href_model = a.get('text-body-1 href (3)','')
    mm = re.search(r'u_moto_model:([^+&]+)',str(href_model),re.I)
    model_hint = unquote(mm.group(1).replace('+', ' ')) if mm else ''
    if 'YAMAHA_MT' not in model_hint: continue

    title = a.get('text-headline-1-expanded','')
    href_cc = a.get('text-body-1 href (5)','')
    mcc = re.search(r'cubic_capacity:(\d{2,4})',str(href_cc),re.I)
    ann_cc = int(mcc.group(1)) if mcc else 0

    ad_text=(title+' '+model_hint).strip()
    ad_tok=tokenize(ad_text)
    ad_set=set(ad_tok)|{t.replace('-','').replace('_','') for t in ad_tok}
    ad_nums=extr_nums(ad_text)
    ad_comp=normalize(ad_text).replace('-','').replace('_','')

    best_score=0; best_p=None
    cc_blocked=[]; dom_blocked=[]; cov_blocked=[]
    for p in brand_index.get('yamaha',[]):
        if ann_cc and p['cc'] and abs(p['cc']-ann_cc)>CC_BLOCK_DIFF:
            cc_blocked.append(p['model_raw'])
            continue
        if p['doms']:
            dom_found=any((d in ad_nums or str(d) in ad_comp) if isinstance(d,int) else str(d).replace('-','') in ad_comp for d in p['doms'])
            if not dom_found:
                dom_blocked.append(p['model_raw'])
                continue
        c=max((cvg(ad_set,vat) for vat in p['vat']),default=0)
        if c<MIN_COV_ALPHA:
            cov_blocked.append((round(c,2), p['model_raw']))
            continue
        A,B=set(ad_tok),set(p['ctok'])
        jac=len(A&B)/(len(A)+len(B)-len(A&B)) if A and B else 0
        sc=c*0.70+jac*0.20+(1.0 if ann_cc and p['cc'] and ann_cc==p['cc'] else 0)*0.05
        if sc>best_score: best_score=sc; best_p=p

    if best_p is None:
        fail_titles.append({
            'title':title,'cc':ann_cc,'model_hint':model_hint,
            'n_cc_blocked':len(cc_blocked),'n_dom_blocked':len(dom_blocked),
            'cov_blocked_top':cov_blocked[:3]
        })

print(f'YAMAHA_MT failures: {len(fail_titles)}')
for s in fail_titles[:20]:
    print(f"  {s['title'][:40]!r} cc={s['cc']} cc_blk={s['n_cc_blocked']} dom_blk={s['n_dom_blocked']} cov_blk={s['cov_blocked_top'][:2]}")
