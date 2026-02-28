"""
Applique les 3 corrections dans Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json :
  #1 - Switch node: ajoute fallbackOutput + allMatchingOutputs dans options
  #2 - Scoring code: description lookup : ajoute text-body-1 (17) avant (16)
  #3 - Scoring code: titre : priorité text-headline-1-expanded en premier
"""
import json

WF_PATH = "C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json"

with open(WF_PATH, "r", encoding="utf-8") as f:
    wf = json.load(f)

changes = []

for node in wf["nodes"]:
    # ── Bug #1 : Switch Router ─────────────────────────────────────
    if node["name"] == "Router par Qualite":
        params = node["parameters"]
        if "options" not in params:
            params["options"] = {}
        params["options"]["fallbackOutput"] = "extra"
        params["options"]["allMatchingOutputs"] = False
        changes.append("Bug #1 fixé : fallbackOutput=extra, allMatchingOutputs=false sur Router par Qualite")

    # ── Bug #2 & #3 : Scoring de Completude ───────────────────────
    if node["name"] == "Scoring de Completude":
        code = node["parameters"].get("jsCode", "")

        # Bug #2 — description : insérer text-body-1 (17) avant (16)
        old_desc = '"annonce_description",\n    "text-body-1 (16)",'
        new_desc = '"annonce_description",\n    "text-body-1 (17)",\n    "text-body-1 (16)",'
        if old_desc in code:
            code = code.replace(old_desc, new_desc)
            changes.append("Bug #2 fixé : text-body-1 (17) ajouté dans le lookup description")
        elif '"text-body-1 (17)"' in code:
            changes.append("Bug #2 déjà présent (skip)")
        else:
            changes.append("Bug #2 WARNING : pattern non trouvé, correction manuelle nécessaire")

        # Bug #3 — titre : enlever text-body-1 (8) de la priorité haute
        old_title = '"text-body-1 (8)",\n    "text-headline-1-expanded",'
        new_title = '"text-headline-1-expanded",'
        if old_title in code:
            code = code.replace(old_title, new_title)
            changes.append("Bug #3 fixé : text-headline-1-expanded mis en premier pour le titre")
        elif old_title.replace("    ", "") in code:
            # Essai avec indentation variable
            code = code.replace(old_title.replace("    ", ""), new_title.replace("    ", ""))
            changes.append("Bug #3 fixé (indent alt)")
        elif '"text-body-1 (8)",\r\n    "text-headline-1-expanded",' in code:
            code = code.replace('"text-body-1 (8)",\r\n    "text-headline-1-expanded",', '"text-headline-1-expanded",')
            changes.append("Bug #3 fixé (CRLF)")
        else:
            changes.append("Bug #3 WARNING : pattern non trouvé, vérification manuelle nécessaire")

        node["parameters"]["jsCode"] = code

with open(WF_PATH, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("Corrections appliquées :")
for c in changes:
    print(" ", c)
