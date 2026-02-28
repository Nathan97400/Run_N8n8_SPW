"""
Apply all matching fixes to the workflow JSON:
1. Letter O→0 normalization for model numbers
2. CC sanity check (reject CC > 2500)
3. DOM proximity fix (ann_cc close to dom_number)
4. Pass 3 without CC gate
5. Supplemental brands injection (VOGE, Indian, QJ Motor, etc.)
"""
import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')

WF_FILE = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json'
SUPPLEMENT_FILE = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/supplement_bdd.json'

with open(WF_FILE, 'r', encoding='utf-8') as f:
    wf = json.load(f)

with open(SUPPLEMENT_FILE, 'r', encoding='utf-8') as f:
    supplement = json.load(f)

# Minify supplement to JS-friendly string (embedded in code)
supplement_js = json.dumps(supplement, ensure_ascii=False, separators=(',',':'))

# =========================================================
# PATCH 1: normalize() - add O→0 conversion
# =========================================================
NORMALIZE_PATCH_FIND = '  s = s.replace(/[/|]/g, " ");\n  s = s.replace(/[^a-z0-9]+/g, " ");'
NORMALIZE_PATCH_REPLACE = '  s = s.replace(/[/|]/g, " ");\n  // FIX: letter O as zero in model numbers (MT O7 → MT 07)\n  s = s.replace(/\\bo(\\d{1,3})\\b/g, "0$1");\n  s = s.replace(/[^a-z0-9]+/g, " ");'

# =========================================================
# PATCH 2: CC sanity in getAnnonceCC (Priority 1 block)
# =========================================================
CC_SANITY_FIND = '  const ccH = ccFromHref(getAnnonceCCHref(a));\n  if (ccH) return ccH;'
CC_SANITY_REPLACE = '  const ccH = ccFromHref(getAnnonceCCHref(a));\n  // FIX: reject clearly wrong CC values from LBC (> 2500cc or < 30cc for non-scooter)\n  if (ccH && ccH <= 2500) return ccH;'

# =========================================================
# PATCH 3: DOM proximity fix in the dominant gate check
# =========================================================
DOM_PATCH_FIND = '''        const hasCommonDom = p.dominants.some(d => {
          if (typeof d === 'number') {
            return adNumbers.includes(d) || adNormForDom.includes(String(d));
          } else {
            const dClean = String(d).replace(/[-_]/g, '');
            return adNormForDom.includes(dClean);
          }
        });'''

DOM_PATCH_REPLACE = '''        const hasCommonDom = p.dominants.some(d => {
          if (typeof d === 'number') {
            // FIX: also accept if ann_cc is close to this dominant number (ex: Rocket III (2300) with CC=2294)
            if (annonceCC && Math.abs(d - annonceCC) <= CC_BLOCK_DIFF) return true;
            return adNumbers.includes(d) || adNormForDom.includes(String(d));
          } else {
            const dClean = String(d).replace(/[-_]/g, '');
            return adNormForDom.includes(dClean);
          }
        });'''

# =========================================================
# PATCH 4: Add Pass 3 without CC gate
# For items with bad CC from LBC (e.g. 7000 for an MT-07)
# =========================================================
PASSES_FIND = "  const passes = [{ useYear: true }, { useYear: false }];"
PASSES_REPLACE = "  const passes = [{ useYear: true, useCC: true }, { useYear: false, useCC: true }, { useYear: false, useCC: false }];"

CC_GATE_FIND = '''      // Gate CC strict (≤ 80cc)
      if (annonceCC && p.cc) {
        const diff = Math.abs(p.cc - annonceCC);
        if (diff > CC_BLOCK_DIFF) continue;
      }'''

CC_GATE_REPLACE = '''      // Gate CC strict (≤ 80cc) — disabled in pass 3 for bad LBC CC values
      if (pass.useCC && annonceCC && p.cc) {
        const diff = Math.abs(p.cc - annonceCC);
        if (diff > CC_BLOCK_DIFF) continue;
      }'''

PASS_BREAK_FIND = "    // Si trouvé en pass 1, ne pas faire pass 2\n    if (pass.useYear && foundInPass) break;"
PASS_BREAK_REPLACE = "    // Si trouvé dans un pass avec CC, ne pas faire le pass sans CC\n    if (pass.useCC && foundInPass) break;"

# =========================================================
# PATCH 5: Supplemental brands injection
# =========================================================
SUPPLEMENT_INJECT_FIND = "const brandIndex = new Map();"
SUPPLEMENT_INJECT_REPLACE = f"""const brandIndex = new Map();

// =====================================================
// SUPPLEMENTAL BRANDS (marques absentes du Worker BDD)
// =====================================================
const SUPPLEMENTAL_BDD = {supplement_js};
// Inject supplemental into modeles list
for (const sm of SUPPLEMENTAL_BDD) {{
  const hasKey = !!sm['Marque'] && !!(sm['Modèle'] || sm['Modele'] || sm['Mod\\u00e8le']);
  if (hasKey) modeles.push(sm);
}}"""

# =========================================================
# Apply patches to all match nodes
# =========================================================
MATCH_NODES = [
    '1st Match (EXCELLENT)',
    '2nd Match (GOOD)',
    '3rd Match (MEDIUM - Permissif)',
    '4th Match (POOR)',
    '5th Match (MINIMAL)',
]

patches = {
    'normalize_o': (NORMALIZE_PATCH_FIND, NORMALIZE_PATCH_REPLACE),
    'cc_sanity': (CC_SANITY_FIND, CC_SANITY_REPLACE),
    'dom_proximity': (DOM_PATCH_FIND, DOM_PATCH_REPLACE),
    'pass3': (PASSES_FIND, PASSES_REPLACE),
    'cc_gate': (CC_GATE_FIND, CC_GATE_REPLACE),
    'pass_break': (PASS_BREAK_FIND, PASS_BREAK_REPLACE),
    'supplement': (SUPPLEMENT_INJECT_FIND, SUPPLEMENT_INJECT_REPLACE),
}

for node in wf['nodes']:
    if node.get('name') not in MATCH_NODES:
        continue

    code = node['parameters'].get('jsCode', '')
    print(f"\n=== Patching: {node['name']} ===")

    for patch_name, (find_str, replace_str) in patches.items():
        if find_str in code:
            code = code.replace(find_str, replace_str, 1)
            print(f"  ✓ {patch_name}")
        else:
            print(f"  ✗ {patch_name} — NOT FOUND (skip)")

    node['parameters']['jsCode'] = code

# Save updated workflow
with open(WF_FILE, 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print(f"\n✓ Workflow sauvegardé: {WF_FILE}")
