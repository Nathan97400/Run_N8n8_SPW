"""
Fix 6: Enhanced CVG and DOM matching for compound alphanumeric tokens
- DOM: also check compact (no-space) version of ad
- CVG: for tokens like "sv650", "fjr1300", "cbr500r", match if parts present in ad
"""
import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')

WF_FILE = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json'

with open(WF_FILE, 'r', encoding='utf-8') as f:
    wf = json.load(f)

# =========================================================
# PATCH 6A: Enhanced DOM check (compact ad, no spaces)
# =========================================================
DOM_OLD = """          } else {
            const dClean = String(d).replace(/[-_]/g, '');
            return adNormForDom.includes(dClean);
          }
        });
        if (!hasCommonDom) continue;"""

DOM_NEW = """          } else {
            const dClean = String(d).replace(/[-_]/g, '');
            // FIX6A: also check compact ad (no spaces) for tokens like sv650, fjr1300
            const adCompact = adNormForDom.replace(/\\s+/g, '');
            return adNormForDom.includes(dClean) || adCompact.includes(dClean);
          }
        });
        if (!hasCommonDom) continue;"""

# =========================================================
# PATCH 6B: Enhanced coverageSet - compound token matching
# =========================================================
COV_OLD = """coverageSet(adSet, modelTokens) {
  if (!modelTokens.length) return 0;
  // Build compact version of adSet (sans séparateurs)
  const adSetCompact = new Set([...adSet].map(t => t.replace(/[-_]/g, '')));
  let hit = 0;
  for (const t of modelTokens) {
    const tCompact = t.replace(/[-_]/g, '');
    if (adSet.has(t) || adSetCompact.has(tCompact)) hit++;
  }
  return hit / modelTokens.length;
}"""

COV_NEW = """coverageSet(adSet, modelTokens) {
  if (!modelTokens.length) return 0;
  // Build compact version of adSet (sans séparateurs)
  const adSetCompact = new Set([...adSet].map(t => t.replace(/[-_]/g, '')));
  function tokenMatches(t) {
    const tc = t.replace(/[-_]/g, '');
    if (adSet.has(t) || adSetCompact.has(tc)) return true;
    // FIX6B-1: substring match (e.g. "r1200" inside "r1200r")
    for (const at of adSetCompact) {
      if (tc.length >= 3 && at.length >= 3 && (at.includes(tc) || tc.includes(at))) return true;
    }
    // FIX6B-2: compound split (sv650 -> sv in ad AND 650 in ad)
    const m = tc.match(/^([a-z]{2,})([0-9]{3,4})([a-z]*)$/);
    if (m) {
      const alpha = m[1], num = m[2], sfx = m[3];
      const alphaOk = adSetCompact.has(alpha) ||
        [...adSetCompact].some(at => at.startsWith(alpha) && at.length <= alpha.length + 2);
      const numOk = adSetCompact.has(num) || adSetCompact.has(num + sfx);
      if (alphaOk && numOk) return true;
    }
    return false;
  }
  let hit = 0;
  for (const t of modelTokens) {
    if (tokenMatches(t)) hit++;
  }
  return hit / modelTokens.length;
}"""

MATCH_NODES = [
    '1st Match (EXCELLENT)',
    '2nd Match (GOOD)',
    '3rd Match (MEDIUM - Permissif)',
    '4th Match (POOR)',
    '5th Match (MINIMAL)',
]

for node in wf['nodes']:
    if node.get('name') not in MATCH_NODES:
        continue
    code = node['parameters'].get('jsCode', '')
    name = node['name']
    print(f'\n=== {name} ===')

    if DOM_OLD in code:
        code = code.replace(DOM_OLD, DOM_NEW, 1)
        print('  ✓ DOM compact check')
    else:
        print('  ✗ DOM patch not found')

    if COV_OLD in code:
        code = code.replace(COV_OLD, COV_NEW, 1)
        print('  ✓ CVG compound match')
    else:
        print('  ✗ CVG patch not found')

    node['parameters']['jsCode'] = code

with open(WF_FILE, 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print('\n✓ Workflow saved')
