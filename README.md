# Run_N8n8_SPW

Workflow n8n de scraping et d'enrichissement d'annonces motos LeBonCoin, avec un algorithme de **matching progressif** pour identifier le modèle exact de chaque annonce.

---

## Vue d'ensemble

```
Gmail Trigger (JSON LBC)
        ↓
Extraction + Dédoublonnage
        ↓
Merge Annonces × BDD Modèles
        ↓
Scoring de Complétude (0–100)
        ↓
Router par Qualité
        ↓
┌──────┬──────┬──────┬──────┬──────┐
│ 1st  │ 2nd  │ 3rd  │ 4th  │ 5th  │
│Match │Match │Match │Match │Match │
│ ≥90  │ ≥75  │ ≥60  │ ≥40  │ <40  │
└──────┴──────┴──────┴──────┴──────┘
        ↓
Merge All → Rename Columns → Supabase
```

**Taux de matching atteint :**
- Real batch (236 annonces) : **89.8%**
- Large LBC (759 annonces) : **96.0%**

---

## Fichiers clés

### Workflows n8n (`/Workflow/`)

| Fichier | Description |
|---------|-------------|
| `Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json` | ⭐ Version finale recommandée |
| `Workflow_PROGRESSIVE_MATCHING_v1.json` | Version précédente (stable) |
| `Match/Code.js/` | Code source des 5 nœuds de matching |

### BDD & Matching

| Fichier | Description |
|---------|-------------|
| `supplement_bdd.json` | 246 entrées complémentaires (modèles manquants) |
| `BDD Modèles/motorcycles_brands_full_ENRICHED.json` | BDD principale (worker) |

### Scripts Python (simulation & diagnostic)

| Script | Rôle |
|--------|------|
| `sim_fixed2.py` | Simulation complète (mesure taux de matching) |
| `trace_failures2.py` | Diagnostic no_candidate (pourquoi un match échoue) |
| `trace_specific.py` | Debug ciblé sur une annonce précise |

---

## Algorithme de matching

L'algorithme tente de faire correspondre le titre d'une annonce à un modèle de la BDD via 3 passes progressives :

1. **Passe 1** — Année + CC connus → filtre strict
2. **Passe 2** — CC connu seulement
3. **Passe 3** — Aucun filtre (titre uniquement)

**Score final** = `cvg×0.70 + jaccard×0.20 + cc_exact×0.05 + year_ok×0.05`

- `MIN_COV_ALPHA = 0.85` — seuil de couverture des tokens du modèle
- `MIN_ACCEPT = 0.73` — seuil de score pour valider un match
- `CC_BLOCK_DIFF = 80` — écart max de cylindrée accepté (cc)

---

## Prérequis

- **n8n** (self-hosted ou cloud)
- **Supabase** — table `annonces` (voir `supabase_schema.sql`)
- Credential Gmail + Supabase configurés dans n8n
- BDD modèles accessible via HTTP Request (worker n8n)

---

## Import du workflow

1. Ouvrir n8n → **Workflows → Import from file**
2. Sélectionner `Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json`
3. Configurer les credentials (Gmail, Supabase)
4. Activer le workflow

---

## Simulation locale

```bash
# Taux de matching global
python sim_fixed2.py

# Diagnostic des échecs
python trace_failures2.py
```

> Les scripts nécessitent `worker_response.json` dans `%TEMP%` (réponse du nœud worker n8n).
