"""
Corrige dans le workflow :
  1. IF Matched OK → FALSE path → Supabase - Annonce A Revoir (connexion manquante)
  2. Supabase nodes : paramètres corrects (dataToSend, conflictColumns)
"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

WF_PATH = "C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json"

with open(WF_PATH, "r", encoding="utf-8") as f:
    wf = json.load(f)

# ── Fix 1 : Connexion IF FALSE → Supabase A Revoir ─────────────────
conn = wf["connections"]
if_conn = conn.get("IF Matched OK ?", {})
main_outputs = if_conn.get("main", [[], []])

# Output 0 = TRUE (déjà connecté à Supabase - Annonce Matchee)
# Output 1 = FALSE (vide → doit pointer vers Supabase - Annonce A Revoir)
if len(main_outputs) < 2:
    main_outputs = main_outputs + [[] for _ in range(2 - len(main_outputs))]

if not main_outputs[1]:
    main_outputs[1] = [{
        "node": "Supabase - Annonce A Revoir",
        "type": "main",
        "index": 0
    }]
    print("Fix 1 : IF FALSE → Supabase - Annonce A Revoir connecté")
else:
    print("Fix 1 : déjà connecté →", main_outputs[1])

if_conn["main"] = main_outputs
conn["IF Matched OK ?"] = if_conn

# ── Fix 2 : Supabase nodes paramètres ──────────────────────────────
SUPABASE_CREDENTIAL = {"supabaseApi": {"id": "OhHpqtfIxQEcmmRX", "name": "Supabase account"}}

for node in wf["nodes"]:
    if node["type"] != "n8n-nodes-base.supabase":
        continue
    node["parameters"] = {
        "operation": "upsert",
        "tableId": "annonces",
        "dataToSend": "autoMapInputData",
        "conflictColumns": "Url_Https"
    }
    node["credentials"] = SUPABASE_CREDENTIAL
    node["typeVersion"] = 1
    print(f"Fix 2 : {node['name']} → paramètres Supabase corrigés")

with open(WF_PATH, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("\nDone.")
