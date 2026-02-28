# 🥈 Documentation du 2nd Match (GOOD - Équilibré)

## 🎯 Objectif

Le **2nd Match** est conçu pour matcher les annonces avec des **données riches** (score de complétude 60-80%) en utilisant des techniques **équilibrées** entre précision et couverture.

C'est le **second niveau** du système : matching robuste pour les annonces de bonne qualité.

---

## 📊 Caractéristiques

### Entrée Attendue
- **Tier** : GOOD
- **Score complétude** : 60-80%
- **Profil typique** :
  - ✅ Marque présente (href ou field)
  - ✅ Modèle présent (pas toujours en href, parfois "autre")
  - ⚠️ CC parfois absent ou en field text
  - ✅ Année présente
  - ✅ Description moyenne à complète (20-50 mots)
  - ✅ 2-3 photos
  - ✅ Titre moyen (3-5 mots)

### Sortie
- **Taux de matching attendu** : ~90% des annonces GOOD
- **Confiance** : HIGH (75%), MEDIUM (25%)
- **Flag review** : Occasionnelle (<15%)

---

## ⚙️ Paramètres

### Seuils Équilibrés

```javascript
MIN_COV_ALPHA = 0.80    // 80% couverture alpha
MIN_ACCEPT = 0.70       // 70% score minimum
CC_BLOCK_DIFF = 150     // 150cc tolérance (moyennement strict)
YEAR_TOLERANCE = 2      // ±2 ans hors range acceptés
```

### Comparaison avec Autres Match

| Paramètre | 1st Match | **2nd Match** | 3rd Match | 4th Match | 5th Match |
|-----------|-----------|---------------|-----------|-----------|-----------|
| MIN_COV_ALPHA | 0.85 | **0.80** | 0.50 | N/A | N/A |
| MIN_ACCEPT | 0.78 | **0.70** | 0.55 | 0.40 | 0.25 |
| CC Tolérance | 80cc | **150cc** | 150cc | 250cc | 400cc |
| Gate année | Strict | **±2 ans** | Optionnel | Non | Non |
| Fuzzy matching | ❌ | **Limité** | ✅ | ✅ | ✅ |

---

## ✨ Caractéristiques du 2nd Match

### 1. **Flexibilité des Sources de Données**

Le 2nd Match accepte les données depuis **href OU field**, avec priorité href.

**Sources de données (ordre de priorité)** :
```javascript
// Marque
1. text-body-1 href (2) → u_moto_brand:YAMAHA
2. text-body-1 (2) → champ texte "YAMAHA"

// Modèle
1. text-body-1 href (3) → u_moto_model:MT-07
2. text-body-1 (8) → version constructeur "1050_Speed Triple"
3. text-body-1 (3) → champ modèle text

// CC
1. text-body-1 href (5) → cubic_capacity:689
2. text-body-1 (7) → champ texte "689"
3. text-body-1 (13) → champ secondaire
4. Inférence depuis description
```

**Avantages** :
- ✅ Accepte les données sans href LBC
- ✅ Tolère les modèles href = "autre"
- ✅ Peut matcher même si CC absent de href

---

### 2. **Gates Modérés**

Le 2nd Match applique des **gates moins stricts** que le 1st Match.

**Gates appliqués** :

#### Gate CC (150cc)
```javascript
if (annonceCC && modelCC) {
  const diff = Math.abs(modelCC - annonceCC);
  if (diff > 150) {
    // ❌ Rejeté
    continue;
  }
}
```

**Exemples** :
```
Annonce CC 689, Modèle CC 660 → diff = 29cc ✅
Annonce CC 500, Modèle CC 650 → diff = 150cc ✅ (limite)
Annonce CC 125, Modèle CC 300 → diff = 175cc ❌ (rejeté)
```

---

#### Gate Année (±2 ans)
```javascript
// Pass 1 : Année dans range OU ±2 ans
if (annonceYear) {
  const inRange = annonceYear >= modelYearStart && annonceYear <= modelYearEnd;

  if (!inRange) {
    const distStart = Math.abs(annonceYear - modelYearStart);
    const distEnd = Math.abs(annonceYear - modelYearEnd);
    const minDist = Math.min(distStart, distEnd);

    if (minDist > 2) {
      // ❌ Rejeté en pass 1 (>2 ans hors range)
      continue;
    }
  }
}

// Pass 2 : Si aucun match, gate année désactivé
```

**Exemples** :
```
Annonce 2015, Modèle 2010-2018 → ✅ (pass 1, dans range)
Annonce 2019, Modèle 2010-2018 → ✅ (pass 1, +1 an après fin)
Annonce 2021, Modèle 2010-2018 → ❌ (pass 1, +3 ans), ✅ (pass 2)
```

---

#### Gate Dominants (Si présents)
```javascript
// Si le modèle a des tokens dominants et qu'ils sont présents
if (p.dominants.length > 0) {
  const hasCommonDom = p.dominants.some(d => adNumbers.includes(d));

  if (!hasCommonDom) {
    // Downgrade le score mais ne rejette PAS
    penaltyDominant = 0.10;
  }
}
```

**Exemples** :
```
Annonce "TRIUMPH Speed Triple", Modèle "Speed Triple 1050"
→ dominants: ["1050"]
→ adNumbers: [] (CC absent)
→ Pénalité -10% mais pas de rejet

Annonce "TRIUMPH 1050", Modèle "Speed Triple 1050"
→ dominants: ["1050"]
→ adNumbers: [1050]
→ Pas de pénalité ✅
```

---

### 3. **Scoring Composite avec Pénalités**

Le 2nd Match utilise un **scoring pondéré avec pénalités**.

```javascript
Score = (
  Coverage Alpha × 65% +
  Jaccard × 25% +
  CC Proximity × 7% +
  Year Proximity × 3%
) - Pénalités
```

#### Coverage Alpha (65%)
Pourcentage de tokens du modèle présents dans l'annonce.

#### Jaccard (25%)
Similarité globale entre tous les tokens.

#### CC Proximity (7%)
Score dégressif selon l'écart CC.

```javascript
if (diff === 0) → 1.0
if (diff <= 50) → 0.8
if (diff <= 100) → 0.5
if (diff <= 150) → 0.3
if (diff > 150) → rejeté
```

#### Year Proximity (3%)
Score dégressif selon l'écart année.

```javascript
if (inRange) → 1.0
if (dist ≤ 1) → 0.8
if (dist ≤ 2) → 0.5
if (dist > 2) → 0 (ou rejeté en pass 1)
```

#### Pénalités
```javascript
// Pénalité dominants
if (!hasCommonDominant) {
  penaltyDom = 0.10; // -10%
}

// Pénalité CC absent
if (!annonceCC && modelCC) {
  penaltyCC = 0.05; // -5%
}

// Score final
finalScore = baseScore - penaltyDom - penaltyCC;
```

---

### 4. **Deux Passes avec Tolérance**

Le 2nd Match utilise **2 passes** avec tolérance.

```javascript
Pass 1: useYear = true, tolerance = 2
  ├─ Gate année activé (±2 ans)
  ├─ Gate CC activé (≤ 150cc)
  └─ Gate dominants en pénalité

  Si aucun match trouvé:

Pass 2: useYear = false
  ├─ Gate année désactivé
  ├─ Gate CC activé
  └─ Gate dominants en pénalité
```

**Exemple** :
```
Annonce : HONDA CB650R 2021 (649cc)
Modèle BDD : CB650R (2019-2023, 649cc)

Pass 1 :
  - Année 2021 dans [2019-2023] ✅
  - CC identique ✅
  - Coverage 95% ✅
  - Score 0.88 → Match HIGH ✅
```

---

## 📐 Calcul du Score Détaillé

### Exemple Complet

**Annonce** :
```json
{
  "text-body-1 (2)": "TRIUMPH",
  "text-body-1 (8)": "Speed Triple 1050",
  "text-body-1 href (3)": "...u_moto_model:autre",
  "text-body-1 (7)": "1050",
  "text-body-1 (4)": "2013",
  "annonce_description": "Belle TRIUMPH Speed Triple 1050 de 2013 en excellent état..."
}
```

**Modèle BDD** :
```json
{
  "Marque": "TRIUMPH",
  "Modèle": "Speed Triple / Speed Triple R",
  "Cylindrée (cc)": 1050,
  "Année début": 2005,
  "Année fin": 2015
}
```

**Traitement** :

1. **Extraction données annonce** :
   ```javascript
   brandKey = "triumph"
   modelHint = "Speed Triple 1050" (depuis field, car href = "autre")
   annonceCC = 1050 (depuis field)
   annonceYear = 2013
   ```

2. **Recherche candidats** :
   ```javascript
   brandIndex.get("triumph") → [Speed Triple, Street Triple, ...]
   ```

3. **Pass 1 : avec gate année** :
   ```javascript
   Candidat: Speed Triple

   Gate année: 2013 >= 2005 AND 2013 <= 2015 ✅
   Gate CC: |1050 - 1050| = 0 ≤ 150cc ✅
   Gate dominants: ["1050"] présent dans adNumbers ✅

   Scoring:
   - modelTokens alpha: ["speed", "triple"]
   - adTokens: ["triumph", "speed", "triple", "1050", "2013", ...]
   - Coverage alpha: 2/2 = 1.0
   - Jaccard: (tous tokens) ≈ 0.40
   - CC proximity: diff=0 → 1.0
   - Year proximity: dans range → 1.0

   Base score = 1.0 × 0.65 + 0.40 × 0.25 + 1.0 × 0.07 + 1.0 × 0.03
              = 0.65 + 0.10 + 0.07 + 0.03
              = 0.85

   Pénalités: aucune
   Score final = 0.85 ✅
   ```

4. **Acceptation** :
   ```javascript
   score = 0.85 >= 0.70 (MIN_ACCEPT) ✅

   Confiance:
   - score >= 0.78 → HIGH ✅
   ```

**Output** :
```json
{
  "matched_ok": true,
  "matched_marque": "TRIUMPH",
  "matched_modele": "Speed Triple / Speed Triple R",
  "matched_score": 0.85,
  "matched_confidence": "HIGH",
  "matched_cylindree": 1050,
  "matched_annee_debut": 2005,
  "matched_annee_fin": 2015,
  "matching_engine": "2ND_MATCH_BALANCED_V1",
  "needs_review": false
}
```

---

## 🔄 Workflow du 2nd Match

```
1. Récupération données (href OU field)
   ├─ Brand href → priorité, sinon field
   ├─ Model href → si ≠ "autre", sinon field
   ├─ CC href → priorité, sinon field, sinon inférence
   └─ Year field

2. Brand matching
   ├─ Exact match dans index
   └─ Canonicalisation

3. Model hint flexible
   ├─ Si href présent et ≠ "autre" → utiliser
   ├─ Sinon field version constructeur
   └─ Fallback field modèle

4. Pour chaque candidat modèle
   ├─ Pass 1 : Gates modérés
   │   ├─ Gate année (±2 ans)
   │   ├─ Gate CC (≤ 150cc)
   │   └─ Pénalité dominants (si absents)
   ├─ Calcul scoring composite
   │   ├─ Coverage alpha (65%)
   │   ├─ Jaccard (25%)
   │   ├─ CC proximity (7%)
   │   └─ Year proximity (3%)
   └─ Application des pénalités
       ├─ Pénalité dominants (-10%)
       └─ Pénalité CC absent (-5%)

5. Si aucun match en Pass 1
   └─ Pass 2 : Gate année désactivé

6. Sélection du meilleur
   └─ Score le plus élevé ≥ 0.70

7. Détermination confiance
   ├─ Score ≥ 0.78 → HIGH
   └─ Score ≥ 0.70 → MEDIUM
```

---

## 📈 Exemples Concrets

### Exemple 1 : Match Standard (HIGH)

**Input** :
```json
{
  "text-body-1 (2)": "KAWASAKI",
  "text-body-1 (8)": "Z900 ABS",
  "text-body-1 (7)": "948",
  "text-body-1 (4)": "2019",
  "data_quality_tier": "GOOD",
  "data_quality_score": 72
}
```

**Output** :
```json
{
  "matched_ok": true,
  "matched_marque": "KAWASAKI",
  "matched_modele": "Z900",
  "matched_score": 0.83,
  "matched_confidence": "HIGH",
  "needs_review": false
}
```

---

### Exemple 2 : CC Absent, Pénalité Appliquée (MEDIUM)

**Input** :
```json
{
  "text-body-1 (2)": "YAMAHA",
  "text-body-1 (8)": "MT-07",
  "text-body-1 (4)": "2019",
  "annonce_description": "Belle YAMAHA MT-07 de 2019...",
  "data_quality_tier": "GOOD",
  "data_quality_score": 68
}
```

**Traitement** :
- CC absent → Pénalité -5%
- Score base : 0.78
- Score final : 0.78 - 0.05 = 0.73

**Output** :
```json
{
  "matched_ok": true,
  "matched_marque": "YAMAHA",
  "matched_modele": "MT-07",
  "matched_score": 0.73,
  "matched_confidence": "MEDIUM",
  "needs_review": false
}
```

---

### Exemple 3 : Année Légèrement Hors Range (HIGH)

**Input** :
```json
{
  "text-body-1 (2)": "BMW",
  "text-body-1 (8)": "R1200GS",
  "text-body-1 (7)": "1170",
  "text-body-1 (4)": "2015",
  "data_quality_tier": "GOOD",
  "data_quality_score": 75
}
```

**Modèle BDD** : R 1200 GS (2004-2012, 1170cc)

**Traitement** :
- Pass 1 : Année 2015 > 2012
  - Distance = 3 ans → Rejeté (> 2 ans) ❌
- Pass 2 : Gate année désactivé
  - CC identique ✅
  - Coverage 100% ✅
  - Score : 0.79 → Match HIGH ✅

**Output** :
```json
{
  "matched_ok": true,
  "matched_marque": "BMW",
  "matched_modele": "R 1200 GS",
  "matched_score": 0.79,
  "matched_confidence": "HIGH",
  "needs_review": false,
  "used_year_filter": false
}
```

---

## 📊 Performance Attendue

### Objectifs
- **Taux de matching** : ≥ 85% des annonces GOOD
- **Précision** : ≥ 90% (vrais positifs)
- **Confiance HIGH** : ≥ 70%
- **Review manuelle** : ≤ 15%

### Monitoring

```
🥈 2ND MATCH (ÉQUILIBRÉ) - STATS:
   Total items: 30
   Matched: 27 (90%) ✅
   Confidence:
     - HIGH: 21 (78%) ✅
     - MEDIUM: 6 (22%)
   Review manuelle: 4 (13%) ✅
   Rejected: 3 (10%) → 3rd Match
```

---

## 🔧 Ajustements Possibles

### Rendre Plus Strict

```javascript
MIN_COV_ALPHA = 0.83    // au lieu de 0.80
MIN_ACCEPT = 0.73       // au lieu de 0.70
CC_BLOCK_DIFF = 120     // au lieu de 150
YEAR_TOLERANCE = 1      // au lieu de 2
```

**Effet** : -5% matching, mais +3% précision

---

### Rendre Plus Permissif

```javascript
MIN_COV_ALPHA = 0.75
MIN_ACCEPT = 0.65
CC_BLOCK_DIFF = 200
YEAR_TOLERANCE = 3
```

**Effet** : +5% matching, mais -2% précision

---

## 📚 Références

- Code source : `CODE_2ND_MATCH.js`
- Architecture : `ARCHITECTURE_PROGRESSIVE_MATCHING.md`
- Comparaison : Voir DOC_1ST_MATCH.md et DOC_3RD_MATCH.md

---

**Version** : 1.0
**Date** : 2026-02-15
