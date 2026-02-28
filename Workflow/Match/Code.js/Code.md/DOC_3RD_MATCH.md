# 🥉 Documentation du 3rd Match (MEDIUM - Permissif)

## 🎯 Objectif

Le **3rd Match** est conçu pour matcher les annonces avec des **données moyennes** (score de complétude 40-60%) en utilisant des techniques **permissives** et des **inférences intelligentes**.

---

## 📊 Caractéristiques

### Entrée Attendue
- **Tier** : MEDIUM
- **Score complétude** : 40-60%
- **Profil typique** :
  - ✅ Marque présente (champ ou détectable)
  - ⚠️ Modèle href souvent "autre" ou absent
  - ⚠️ CC parfois absent (pas de href)
  - ⚠️ Description moyenne (10-30 mots)
  - ⚠️ 1-2 photos maximum

### Sortie
- **Taux de matching attendu** : ~90% des annonces MEDIUM
- **Confiance** : HIGH (25%), MEDIUM (60%), LOW (15%)
- **Flag review** : Recommandé si confiance LOW

---

## ⚙️ Paramètres

### Seuils Permissifs

```javascript
MIN_COV_ALPHA = 0.50    // 50% couverture alpha (vs 0.85 pour 2nd Match)
MIN_ACCEPT = 0.55       // 55% score minimum (vs 0.78 pour 2nd Match)
CC_BLOCK_DIFF = 150     // 150cc tolérance (vs 250cc pour 2nd Match)
CC_PENALTY = 0.08       // Pénalité si diff CC > 50cc
```

### Comparaison avec Autres Match

| Paramètre | 2nd Match | 3rd Match | 4th Match |
|-----------|-----------|-----------|-----------|
| MIN_COV_ALPHA | 0.85 | **0.50** | 0.54 |
| MIN_ACCEPT | 0.78 | **0.55** | 0.648 |
| CC_BLOCK_DIFF | 250cc | **150cc** | 315cc |
| Fuzzy matching | ❌ | ✅ | ✅ |
| Inférence modèle | ❌ | ✅ | ✅ |

---

## ✨ Nouveautés vs Autres Match

### 1. **Extraction Modèle depuis Description**

Quand le modèle href est absent ou "autre", le 3rd Match tente d'extraire le modèle depuis la description.

**Patterns détectés** :
```javascript
// Pattern 1 : "TRIUMPH Speed Triple"
// Pattern 2 : "mt07", "r1200gs", "z900"
// Pattern 3 : "Duke 390", "Monster 821"
```

**Exemple** :
```javascript
// Annonce
description: "Belle TRIUMPH Speed Triple 1050 de 2013..."
modele_href: "autre"

// Extraction
→ modelHint = "speed triple"
→ Score amélioré grâce au modèle extrait
```

### 2. **Fuzzy Brand Matching (Levenshtein)**

Si la marque n'est pas trouvée exactement, utilise la distance de Levenshtein pour trouver la marque la plus proche.

**Distance max** : 2 caractères

**Exemples** :
```javascript
"yamha" → "yamaha" (distance = 1) ✅
"kawasaki" → "kawasaki" (exact) ✅
"hoda" → "honda" (distance = 1) ✅
"suzki" → "suzuki" (distance = 1) ✅
"triumh" → "triumph" (distance = 1) ✅
```

### 3. **Scoring Composite Multi-Critères**

Au lieu d'un scoring simple (coverage + jaccard), le 3rd Match utilise un **scoring composite pondéré** :

```javascript
Score = (
  Coverage Alpha × 60% +
  Jaccard × 20% +
  CC Proximity × 10% +
  Year Proximity × 10%
)
```

#### CC Proximity
```javascript
diff = 0cc → 1.0
diff ≤ 50cc → 0.8
diff ≤ 100cc → 0.5
diff ≤ 150cc → 0.3
diff > 150cc → rejeté
```

#### Year Proximity
```javascript
année dans range → 1.0
distance ≤ 2 ans → 0.5
distance ≤ 5 ans → 0.3
distance > 5 ans → 0.0
```

---

## 🔄 Workflow du 3rd Match

```
1. Récupération des données
   ├─ Titre, Description, URL
   ├─ Brand (href → field → fuzzy match)
   ├─ Model (href → extraction description)
   ├─ CC (href → field → inférence)
   └─ Année (field → extraction texte)

2. Brand matching
   ├─ Exact match dans index
   └─ Si échec → Fuzzy matching (Levenshtein ≤ 2)

3. Model hint
   ├─ Depuis href si présent et ≠ "autre"
   └─ Sinon → Extraction depuis description

4. Pour chaque candidat modèle
   ├─ Filtre année (optionnel)
   ├─ Gate CC relaxé (≤ 150cc)
   ├─ Calcul scoring composite
   │   ├─ Coverage alpha (60%)
   │   ├─ Jaccard (20%)
   │   ├─ CC proximity (10%)
   │   └─ Year proximity (10%)
   └─ Pénalité CC si diff > 50cc (-0.08)

5. Sélection du meilleur
   ├─ Score ≥ 0.55 → Match accepté
   └─ Score < 0.55 → Rejeté

6. Détermination confiance
   ├─ Score ≥ 0.70 → HIGH
   ├─ Score ≥ 0.60 → MEDIUM
   └─ Score ≥ 0.55 → LOW
```

---

## 📤 Champs de Sortie Spécifiques

### Champs Standard
```javascript
{
  matched_ok: true/false,
  matched_marque: "TRIUMPH",
  matched_modele: "Speed Triple",
  matched_score: 0.625,
  matched_confidence: "MEDIUM",
  matching_engine: "3RD_MATCH_PERMISSIVE_V1",
  needs_review: true/false  // true si confidence === "LOW"
}
```

### Debug Info
```javascript
{
  _match_debug: {
    brandKey: "triumph",
    modelHint: "speed triple",
    adTokensCount: 45,
    coverageAlpha: 0.667,
    jaccard: 0.524,
    ccProximity: 0.80,
    yearProximity: 1.0,
    minCovAlpha: 0.50,
    minAccept: 0.55,
    ccBlockDiff: 150
  }
}
```

---

## 📈 Exemples Concrets

### Exemple 1 : Annonce Moyenne (Match Réussi)

**Input** :
```json
{
  "text-body-1 (2)": "TRIUMPH",
  "text-body-1 (8)": "Triumph Speed",
  "text-body-1 href (3)": "...u_moto_model:autre",
  "text-body-1 (7)": "1050",
  "text-body-1 (4)": "2013",
  "annonce_description": "Belle TRIUMPH Speed Triple 1050 de 2013 en bon état. Entretenue régulièrement.",
  "data_quality_tier": "MEDIUM",
  "data_quality_score": 52
}
```

**Traitement** :
1. Brand : "triumph" (exact match)
2. Model href : "autre" → Extraction description → "speed triple"
3. CC : 1050 (depuis champ)
4. Année : 2013
5. Candidat : Speed Triple 1050 (2005-2015)
6. Scoring :
   - Coverage alpha : 0.75 (excellent)
   - Jaccard : 0.60
   - CC proximity : 1.0 (exact)
   - Year proximity : 1.0 (dans range)
   - **Score composite** : 0.75 × 0.6 + 0.60 × 0.2 + 1.0 × 0.1 + 1.0 × 0.1 = **0.690**

**Output** :
```json
{
  "matched_ok": true,
  "matched_marque": "TRIUMPH",
  "matched_modele": "Speed Triple",
  "matched_score": 0.690,
  "matched_confidence": "HIGH",
  "needs_review": false
}
```

### Exemple 2 : Annonce avec Fuzzy Brand

**Input** :
```json
{
  "text-body-1 (8)": "Yamha MT-07",
  "annonce_description": "Yamha mt07 de 2019",
  "data_quality_tier": "MEDIUM",
  "data_quality_score": 45
}
```

**Traitement** :
1. Brand field : absent
2. Détection dans texte : "yamha" (typo)
3. **Fuzzy matching** : "yamha" → "yamaha" (distance = 1) ✅
4. Model : "mt07" (détecté dans titre/description)
5. Match réussi avec YAMAHA MT-07

**Output** :
```json
{
  "matched_ok": true,
  "matched_marque": "YAMAHA",
  "matched_modele": "MT-07",
  "matched_confidence": "MEDIUM"
}
```

### Exemple 3 : Annonce Limite (Score Bas)

**Input** :
```json
{
  "text-body-1 (2)": "KAWASAKI",
  "text-body-1 (8)": "Kawasaki",
  "annonce_description": "Moto en bon état",
  "data_quality_tier": "MEDIUM",
  "data_quality_score": 42
}
```

**Traitement** :
1. Brand : "kawasaki" (OK)
2. Model : absent (aucune extraction possible)
3. Scoring très faible (pas de tokens discriminants)
4. **Score** : 0.35 (< 0.55)

**Output** :
```json
{
  "matched_ok": false,
  "matched_score": 0,
  "matched_confidence": "NONE",
  "needs_review": true,
  "reason_no_match": "below_threshold_or_filtered"
}
```

---

## 🎯 Quand Utiliser le 3rd Match ?

### ✅ Cas d'Usage Idéaux

1. **Annonces avec modèle dans description mais pas en href**
   - Href modèle = "autre"
   - Description mentionne le modèle clairement

2. **Annonces avec typos dans la marque**
   - "Yamha" au lieu de "Yamaha"
   - "Triumh" au lieu de "Triumph"

3. **Annonces avec CC approximatif**
   - CC réel : 689cc, BDD : 660cc
   - Tolérance 150cc permet le match

4. **Annonces avec année proche mais hors range**
   - Modèle : 2010-2015
   - Annonce : 2016
   - Year proximity = 0.5 (compense)

### ❌ Cas Où le 3rd Match Échoue

1. **Aucune marque détectable**
   → Passe au 5th Match (fallback)

2. **Description trop courte/générique**
   → Impossible d'extraire le modèle

3. **CC totalement absent**
   → Score CC proximity = 0, réduit le score global

---

## 🔧 Ajustements Possibles

### Rendre Plus Permissif

```javascript
// Dans CODE_3RD_MATCH.js

// Diminuer les seuils
MIN_COV_ALPHA = 0.40    // au lieu de 0.50
MIN_ACCEPT = 0.45       // au lieu de 0.55

// Augmenter tolérance CC
CC_BLOCK_DIFF = 200     // au lieu de 150

// Réduire pénalité
CC_PENALTY = 0.05       // au lieu de 0.08
```

**Effet** : Taux de matching +10-15%, mais risque de faux positifs +5%

### Rendre Plus Strict

```javascript
// Augmenter les seuils
MIN_COV_ALPHA = 0.60    // au lieu de 0.50
MIN_ACCEPT = 0.65       // au lieu de 0.55

// Diminuer tolérance CC
CC_BLOCK_DIFF = 100     // au lieu de 150
```

**Effet** : Taux de matching -10-15%, mais précision +5%

---

## 📊 Métriques de Performance

### Objectifs
- **Taux de matching** : ≥ 85% des annonces MEDIUM
- **Précision** : ≥ 70% (vrais positifs)
- **Confiance HIGH** : ≥ 20%
- **Confiance MEDIUM** : ≥ 50%
- **Review manuelle** : ≤ 20%

### Monitoring

Vérifier les console logs :
```
🥉 3RD MATCH (PERMISSIF) - STATS:
   Total items: 50
   Matched: 43 (86%) ✅
   Confidence:
     - HIGH: 12 (28%) ✅
     - MEDIUM: 25 (58%) ✅
     - LOW: 6 (14%) ✅
   Review manuelle: 9 (18%) ✅
```

---

## 🐛 Dépannage

### Problème : Taux de matching < 70%

**Causes possibles** :
1. Données trop pauvres (tier devrait être POOR)
2. Base de modèles incomplète
3. Seuils trop stricts

**Solutions** :
1. Vérifier le scoring de complétude
2. Enrichir la BDD de modèles
3. Ajuster MIN_ACCEPT vers 0.50

### Problème : Trop de faux positifs

**Causes** :
1. Seuils trop permissifs
2. Patterns d'extraction trop larges

**Solutions** :
1. Augmenter MIN_COV_ALPHA à 0.60
2. Affiner les regex d'extraction

### Problème : Fuzzy matching matche des marques incorrectes

**Solution** :
```javascript
// Augmenter le nombre de caractères minimum
if (token.length < 4) continue; // au lieu de < 3
```

---

## 📚 Références

- Code source : `CODE_3RD_MATCH.js`
- Architecture globale : `ANALYSE_MATCH_NODES.md`
- Workflow : `Workflow/Workflow_PROGRESSIVE_MATCHING_v1.json`

---

**Version** : 1.0
**Date** : 2026-02-15
**Auteur** : Claude Code avec Nathan
