import json, re

with open('C:/Users/natha/Documents/projets_claude-code/n8n_builders/JSON LBC/14.02-10.h04-pro-manque-etoiles-avis-et-annonce---nom-particulier---ville---cp-2026-02-14.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def extract_brand_from_href(href):
    m = re.search(r'u_moto_brand:([^+&]+)', str(href or ''), re.IGNORECASE)
    return m.group(1).replace('+', ' ') if m else ''

def extract_model_from_href(href):
    m = re.search(r'u_moto_model:([^+&]+)', str(href or ''), re.IGNORECASE)
    return m.group(1).replace('+', ' ') if m else ''

def extract_cc_from_href(href):
    m = re.search(r'cubic_capacity:(\d{2,4})', str(href or ''), re.IGNORECASE)
    return int(m.group(1)) if m else 0

def parse_year(text):
    s = str(text or '').strip()
    m = re.search(r'\b(0?[1-9]|1[0-2])\s*/\s*((19|20)\d{2})\b', s)
    if m: return int(m.group(2))
    m = re.search(r'\b(19|20)\d{2}\b', s)
    return int(m.group(0)) if m else 0

def get_field(obj, *keys):
    for k in keys:
        v = obj.get(k)
        if v is not None and str(v).strip(): return v
    return ''

def count_words(text):
    return sum(1 for w in str(text or '').lower().split() if len(w) >= 3)

def score_item(item, fixed=True):
    score = 0
    # Brand
    brand_href = get_field(item, 'text-body-1 href (2)', 'text-body-1 href')
    if extract_brand_from_href(brand_href): score += 25
    else:
        if get_field(item, 'text-body-1 (2)'): score += 20
    # Model
    model_from_href = extract_model_from_href(get_field(item, 'text-body-1 href (3)'))
    version = get_field(item, 'text-body-1 (8)')
    model_field = get_field(item, 'text-body-1 (3)')
    if model_from_href and 'autre' not in model_from_href.lower(): score += 20
    elif version and count_words(version) >= 2: score += 18
    elif model_field: score += 12
    elif version: score += 8
    # CC
    if extract_cc_from_href(get_field(item, 'text-body-1 href (5)')): score += 15
    elif get_field(item, 'text-body-1 (7)'): score += 12
    # Year
    if parse_year(get_field(item, 'text-body-1 (4)')) or parse_year(get_field(item, 'text-body-1 (9)')): score += 10
    # Description - FIXED: (17) before (16)
    if fixed:
        desc = get_field(item, 'annonce_description', 'text-body-1 (17)', 'text-body-1 (16)', 'text-body-1 (14)')
    else:
        desc = get_field(item, 'annonce_description', 'text-body-1 (16)', 'text-body-1 (14)')
    dw = count_words(desc)
    score += 15 if dw >= 50 else 12 if dw >= 20 else 8 if dw >= 10 else 4 if dw >= 5 else 0
    # Photos
    photos = sum(1 for k in ['size-full src', 'size-full src (2)', 'size-full src (3)'] if item.get(k, '').strip())
    score += 5 if photos >= 3 else 4 if photos == 2 else 2 if photos == 1 else 0
    # Title - FIXED: text-headline-1-expanded first
    if fixed:
        title = get_field(item, 'text-headline-1-expanded', 'annonce_title', 'relative')
    else:
        title = get_field(item, 'text-body-1 (8)', 'text-headline-1-expanded', 'annonce_title', 'relative')
    tw = count_words(title)
    score += 10 if tw >= 5 else 7 if tw >= 3 else 3 if tw >= 1 else 0
    tier = 'EXCELLENT' if score >= 80 else 'GOOD' if score >= 60 else 'MEDIUM' if score >= 40 else 'POOR' if score >= 20 else 'MINIMAL'
    return score, tier

print("=== AVANT corrections (simulation) ===")
tiers_before = {}
for item in data:
    _, t = score_item(item, fixed=False)
    tiers_before[t] = tiers_before.get(t, 0) + 1
total = len(data)
for t in ['EXCELLENT', 'GOOD', 'MEDIUM', 'POOR', 'MINIMAL']:
    print(f"  {t}: {tiers_before.get(t,0)} ({round(tiers_before.get(t,0)/total*100)}%)")

print()
print("=== APRÈS corrections (simulation) ===")
tiers_after = {}
scores = []
for item in data:
    s, t = score_item(item, fixed=True)
    tiers_after[t] = tiers_after.get(t, 0) + 1
    scores.append(s)
for t in ['EXCELLENT', 'GOOD', 'MEDIUM', 'POOR', 'MINIMAL']:
    print(f"  {t}: {tiers_after.get(t,0)} ({round(tiers_after.get(t,0)/total*100)}%)")
print(f"  Score moyen: {round(sum(scores)/len(scores))}/100 (range {min(scores)}-{max(scores)})")
