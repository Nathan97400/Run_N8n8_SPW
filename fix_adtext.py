import sys, json, re
sys.stdout.reconfigure(encoding='utf-8')

WF_PATH = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json'

with open(WF_PATH, 'r', encoding='utf-8') as f:
    wf = json.load(f)

match_nodes = [
    '1st Match (EXCELLENT)',
    '2nd Match (GOOD)',
    '3rd Match (MEDIUM - Permissif)',
    '4th Match (POOR)',
    '5th Match (MINIMAL)',
]

for n in wf['nodes']:
    if n['name'] not in match_nodes:
        continue

    code = n['parameters']['jsCode']

    # Pattern 1: 1st and 2nd Match nodes
    # Replace:
    #   const adTextUsed = modelHint ? `${adTextBase} ${modelHint}`.trim() : adTextBase;
    #   (blank line)
    #   const annonceYear = pickAnnonceYear(a, adTextUsed);
    #   const annonceCC = getAnnonceCC(a, adTextUsed, annonceYear);
    # With:
    #   const adTextForCC = `${adTextBase} ${modelHint}`.trim();
    #   const adTextUsed = modelHint ? `${title} ${modelHint}`.trim() : title;
    #   (blank line)
    #   const annonceYear = pickAnnonceYear(a, adTextForCC);
    #   const annonceCC = getAnnonceCC(a, adTextForCC, annonceYear);

    old1 = '  const adTextUsed = modelHint ? `${adTextBase} ${modelHint}`.trim() : adTextBase;\n\n  const annonceYear = pickAnnonceYear(a, adTextUsed);\n  const annonceCC = getAnnonceCC(a, adTextUsed, annonceYear);'
    new1 = '  const adTextForCC = `${adTextBase} ${modelHint}`.trim();\n  const adTextUsed = modelHint ? `${title} ${modelHint}`.trim() : title;\n\n  const annonceYear = pickAnnonceYear(a, adTextForCC);\n  const annonceCC = getAnnonceCC(a, adTextForCC, annonceYear);'

    if old1 in code:
        code = code.replace(old1, new1)
        print(f'Fixed (pattern 1): {n["name"]}')
    else:
        # Pattern 2: 3rd/4th/5th nodes (may have different blank line layout)
        old2a = '  const adTextUsed = modelHint ? `${adTextBase} ${modelHint}`.trim() : adTextBase;\n\n  const annonceYear = pickAnnonceYear(a, adTextUsed);\n  const annonceCC = getAnnonceCC(a, adTextUsed, annonceYear);'
        old2b = '  const adTextUsed = modelHint ? `${adTextBase} ${modelHint}`.trim() : adTextBase;\n  const annonceYear = pickAnnonceYear(a, adTextUsed);\n  const annonceCC = getAnnonceCC(a, adTextUsed, annonceYear);'

        if old2b in code:
            new2b = '  const adTextForCC = `${adTextBase} ${modelHint}`.trim();\n  const adTextUsed = modelHint ? `${title} ${modelHint}`.trim() : title;\n  const annonceYear = pickAnnonceYear(a, adTextForCC);\n  const annonceCC = getAnnonceCC(a, adTextForCC, annonceYear);'
            code = code.replace(old2b, new2b)
            print(f'Fixed (pattern 2b): {n["name"]}')
        else:
            print(f'WARNING: Pattern not found in {n["name"]}')
            # Show context around adTextUsed line
            lines = code.split('\n')
            for i, l in enumerate(lines):
                if 'adTextUsed' in l and 'modelHint' in l:
                    print(f'  Context L{i-1}: {repr(lines[i-1])}')
                    print(f'  Context L{i}: {repr(l)}')
                    print(f'  Context L{i+1}: {repr(lines[i+1])}')
                    print(f'  Context L{i+2}: {repr(lines[i+2])}')
                    print(f'  Context L{i+3}: {repr(lines[i+3])}')

    n['parameters']['jsCode'] = code

# Save
with open(WF_PATH, 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print('\nDone. Workflow saved.')
