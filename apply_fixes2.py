"""
Apply remaining patches to 2nd, 3rd, 4th Match nodes:
- CC gate: add pass.useCC check
- Pass break: use useCC instead of useYear
- DOM proximity: add to 2nd Match
"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

WF_FILE = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json'

with open(WF_FILE, 'r', encoding='utf-8') as f:
    wf = json.load(f)

# ====== 2nd Match patches ======
PATCHES_2ND = [
    # CC gate with pass.useCC
    (
        '      // Gate CC (≤ 150cc)\n      if (annonceCC && p.cc) {\n        const diff = Math.abs(p.cc - annonceCC);\n        if (diff > CC_BLOCK_DIFF) continue;\n      }',
        '      // Gate CC (≤ 150cc) — disabled in pass 3 for bad LBC CC\n      if (pass.useCC && annonceCC && p.cc) {\n        const diff = Math.abs(p.cc - annonceCC);\n        if (diff > CC_BLOCK_DIFF) continue;\n      }'
    ),
    # Pass break
    (
        '    if (pass.useYear && foundInPass) break;',
        '    if (pass.useCC && foundInPass) break;'
    ),
    # DOM proximity in 2nd Match
    (
        '        const hasCommonDom = p.dominants.some(d => {\n          if (typeof d === \'number\') {\n            return adNumbers.includes(d) || adNormForDom.includes(String(d));\n          } else {\n            const dClean = String(d).replace(/[-_]/g, \'\');\n            return adNormForDom.includes(dClean);\n          }\n        });',
        '        const hasCommonDom = p.dominants.some(d => {\n          if (typeof d === \'number\') {\n            // FIX: also accept if ann_cc is close to this dominant number\n            if (annonceCC && Math.abs(d - annonceCC) <= CC_BLOCK_DIFF) return true;\n            return adNumbers.includes(d) || adNormForDom.includes(String(d));\n          } else {\n            const dClean = String(d).replace(/[-_]/g, \'\');\n            return adNormForDom.includes(dClean);\n          }\n        });'
    ),
]

# ====== 3rd Match patches ======
PATCHES_3RD = [
    # CC gate with pass.useCC
    (
        '      // Gate CC relaxé (150cc)\n      if (annonceCC && p.cc) {\n        const diff = Math.abs(p.cc - annonceCC);\n        if (diff > CC_BLOCK_DIFF) continue;\n      }',
        '      // Gate CC relaxé (150cc) — disabled in pass 3\n      if (pass.useCC && annonceCC && p.cc) {\n        const diff = Math.abs(p.cc - annonceCC);\n        if (diff > CC_BLOCK_DIFF) continue;\n      }'
    ),
    # Pass break
    (
        '    if (pass.useYear && foundInPass) break;',
        '    if (pass.useCC && foundInPass) break;'
    ),
]

# ====== 4th Match patches ======
PATCHES_4TH = [
    (
        '      // Gate CC ultra-relaxé (250cc)\n      if (annonceCC && p.cc) {\n        const diff = Math.abs(p.cc - annonceCC);\n        if (diff > CC_RELAXATION) continue;\n      }',
        '      // Gate CC ultra-relaxé (250cc) — disabled in pass 3\n      if (pass.useCC && annonceCC && p.cc) {\n        const diff = Math.abs(p.cc - annonceCC);\n        if (diff > CC_RELAXATION) continue;\n      }'
    ),
]

node_patches = {
    '2nd Match (GOOD)': PATCHES_2ND,
    '3rd Match (MEDIUM - Permissif)': PATCHES_3RD,
    '4th Match (POOR)': PATCHES_4TH,
}

for node in wf['nodes']:
    name = node.get('name','')
    if name not in node_patches:
        continue
    code = node['parameters'].get('jsCode','')
    print(f'\n=== Patching: {name} ===')
    for find_str, replace_str in node_patches[name]:
        if find_str in code:
            code = code.replace(find_str, replace_str, 1)
            # Show what was patched
            key = find_str[:50].replace('\n',' ')
            print(f'  ✓ {key!r}...')
        else:
            key = find_str[:50].replace('\n',' ')
            print(f'  ✗ NOT FOUND: {key!r}...')
    node['parameters']['jsCode'] = code

with open(WF_FILE, 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print(f'\n✓ Workflow saved')
