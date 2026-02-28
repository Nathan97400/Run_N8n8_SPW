"""
Corrige les 5 noeuds Match dans le workflow :
- getAnnonceTitle : text-headline-1-expanded en priorité (plus text-body-1 (8))
- getAnnonceDesc  : ajoute text-body-1 (17) avant (16)
- modelHint fallback : utilise text-headline-1-expanded à la place de text-body-1 (8)
"""
import json, re

WF_PATH = "C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json"

with open(WF_PATH, "r", encoding="utf-8") as f:
    wf = json.load(f)

MATCH_NAMES = [
    "1st Match (EXCELLENT)",
    "2nd Match (GOOD)",
    "3rd Match (MEDIUM - Permissif)",
    "4th Match (POOR)",
    "5th Match (MINIMAL)",
]

changes = []

for node in wf["nodes"]:
    if node["name"] not in MATCH_NAMES:
        continue
    code = node["parameters"]["jsCode"]
    orig = code

    # ── Fix 1 : getAnnonceTitle ─────────────────────────────────
    # Remplace get(a, "text-body-1 (8)", "text-headline-1-expanded", ...
    # par        get(a, "text-headline-1-expanded", "annonce_title", "relative")
    old_title = 'get(a, "text-body-1 (8)", "text-headline-1-expanded", "annonce_title", "relative")'
    new_title = 'get(a, "text-headline-1-expanded", "annonce_title", "relative")'
    if old_title in code:
        code = code.replace(old_title, new_title)

    # ── Fix 2 : getAnnonceDesc ──────────────────────────────────
    # Ajoute "text-body-1 (17)" avant "(16)"
    old_desc = '"annonce_description", "text-body-1 (16)"'
    new_desc = '"annonce_description", "text-body-1 (17)", "text-body-1 (16)"'
    if old_desc in code and '"text-body-1 (17)"' not in code:
        code = code.replace(old_desc, new_desc)

    # ── Fix 3 : modelHint fallback ──────────────────────────────
    # get(a, "text-body-1 (8)", "text-body-1 (3)")
    # → get(a, "text-headline-1-expanded", "text-body-1 (3)")
    old_hint = 'get(a, "text-body-1 (8)", "text-body-1 (3)")'
    new_hint = 'get(a, "text-headline-1-expanded", "text-body-1 (3)")'
    if old_hint in code:
        code = code.replace(old_hint, new_hint)

    # ── Fix 4 : isAnnonce check ─────────────────────────────────
    # get(item, "text-body-1 (8)", "text-headline-1-expanded", ...
    # → get(item, "text-headline-1-expanded", ...
    old_is = 'get(item, "text-body-1 (8)", "text-headline-1-expanded", "relative",'
    new_is = 'get(item, "text-headline-1-expanded", "relative",'
    if old_is in code:
        code = code.replace(old_is, new_is)

    if code != orig:
        node["parameters"]["jsCode"] = code
        changes.append(f"Fixé: {node['name']}")
    else:
        changes.append(f"WARN: pattern non trouvé dans {node['name']} — vérification manuelle")

with open(WF_PATH, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("Résultat :")
for c in changes:
    print(" ", c)
