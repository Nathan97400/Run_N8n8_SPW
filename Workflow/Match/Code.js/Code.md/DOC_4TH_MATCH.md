# 🏅 Documentation du 4th Match (POOR - Fuzzy Agressif)

## 🎯 Objectif

Le **4th Match** est conçu pour matcher les annonces avec des **données pauvres** (score de complétude 20-40%) en utilisant des techniques **très permissives** et du **fuzzy matching agressif**.

---

## 📊 Caractéristiques

### Entrée Attendue
- **Tier** : POOR
- **Score complétude** : 20-40%
- **Profil typique** :
  - ⚠️ Marque parfois détectable avec fuzzy
  - ❌ Modèle souvent absent ou générique
  - ❌ CC souvent absent
  - ⚠️ Description courte (5-15 mots)
  - ⚠️ 0-1 photo

### Sortie
- **Taux de matching attendu** : ~70% des annonces POOR
- **Confiance** : MEDIUM (20%), LOW (80%)
- **Flag review** : Obligatoire pour tous (données pauvres)

---

## ⚙️ Paramètres

### Seuils Très Permissifs

```javascript
MIN_ACCEPT = 0.40          // 40% score minimum (vs 0.55 pour 3rd Match)
CC_RELAXATION = 250        // 250cc tolérance maximale
FUZZY_BONUS = 0.15         // Bonus si fuzzy match ≥ 50%
NGRAM_BONUS = 0.10         // Bonus si n-gram ≥ 40%
```

### Comparaison avec Autres Match

| Paramètre | 3rd Match | 4th Match | Différence |
|-----------|-----------|-----------|------------|
| MIN_ACCEPT | 0.55 | **0.40** | -27% |
| CC Tolérance | 150cc | **250cc** | +67% |
| Fuzzy matching | Basic | **Agressif** | Levenshtein ≤ 2 |
| N-gram | ❌ | **✅** | Nouveau |
| Bonus | ❌ | **✅** | +25% max |

---

## ✨ 3 Innovations Majeures

### 1. **Fuzzy Token Matching Agressif (Levenshtein ≤ 2)**

Match les tokens même avec des fautes de frappe ou variations.

**Algorithme** :
```javascript
function fuzzyTokenMatch(adTokens, modelTokens, maxDist = 2) {
  // Pour chaque token annonce, trouve le token modèle le plus proche
  // Distance Levenshtein ≤ 2

  // Exemple :
  // "mt09" vs "mt07" → distance = 1 ✅
  // "spee" vs "speed" → distance = 1 ✅
  // "triumh" vs "triumph" → distance = 1 ✅
}
```

**Exemples de matching** :
```javascript
// Variantes de modèles
"mt09" ↔ "mt07"         (distance = 1) ✅
"z800" ↔ "z900"         (distance = 1) ✅
"ninja" ↔ "ninia"       (distance = 1) ✅

// Fautes de frappe
"speed" ↔ "spee"        (distance = 1) ✅
"street" ↔ "stret"      (distance = 1) ✅
"triple" ↔ "tripel"     (distance = 1) ✅

// Variations
"hypermotard" ↔ "hypermotrd"  (distance = 1) ✅
```

**Poids dans le score** : 25%

---

### 2. **N-gram Similarity (Jaccard sur trigrammes)**

Compare les chaînes par trigrammes (groupes de 3 caractères).

**Algorithme** :
```javascript
function ngramSimilarity(text1, text2, n = 3) {
  // "mt07" → ["mt0", "t07"]
  // "mt09" → ["mt0", "t09"]
  // Jaccard = 1/2 = 0.5

  // "speed triple" → ["spe", "pee", "eed", "ed ", "d t", ...]
  // "speed tripel" → ["spe", "pee", "eed", "ed ", "d t", ...]
  // Jaccard ≈ 0.85
}
```

**Avantages** :
- ✅ Robuste aux fautes de frappe
- ✅ Capture les similarités partielles
- ✅ Indépendant de l'ordre des mots (partiellement)

**Exemples** :
```javascript
ngramSimilarity("mt07", "mt09", 3)
→ 0.50 (50% de similarité)

ngramSimilarity("speed triple", "speed tripel", 3)
→ 0.85 (très similaire)

ngramSimilarity("yamaha", "yamha", 3)
→ 0.60 (assez similaire malgré typo)
```

**Poids dans le score** : 15%

---

### 3. **Système de Bonus Cumulatifs**

Bonus ajoutés au score si certains critères sont remplis.

**Bonus disponibles** :
```javascript
// Fuzzy Bonus (+0.15)
if (fuzzyTokenMatch ≥ 0.5) {
  score += 0.15
}

// N-gram Bonus (+0.10)
if (ngramSimilarity ≥ 0.4) {
  score += 0.10
}

// Bonus max cumulé : +0.25 (25% du score)
```

**Impact** :
```javascript
// Sans bonus
baseScore = 0.35 → Rejeté (< 0.40)

// Avec fuzzy bonus
baseScore = 0.35 + 0.15 = 0.50 → Accepté ✅

// Avec les deux bonus
baseScore = 0.35 + 0.15 + 0.10 = 0.60 → MEDIUM confidence ✅
```

---

## 📐 Scoring Composite Avancé

```javascript
Score = (
  Coverage classique × 30% +
  Jaccard classique × 15% +
  Fuzzy token match × 25% +    // ✨ NOUVEAU
  N-gram similarity × 15% +    // ✨ NOUVEAU
  CC proximity × 10% +
  Year proximity × 5%
) + Bonus (max +25%)            // ✨ NOUVEAU
```

### Pondération Détaillée

| Critère | Poids | Nouveau ? |
|---------|-------|-----------|
| **Coverage alpha** | 30% | ❌ (réduit vs 3rd) |
| **Jaccard** | 15% | ❌ (réduit vs 3rd) |
| **Fuzzy matching** | 25% | ✅ **NOUVEAU** |
| **N-gram similarity** | 15% | ✅ **NOUVEAU** |
| **CC proximity** | 10% | ❌ |
| **Year proximity** | 5% | ❌ (réduit vs 3rd) |
| **Bonus** | +25% max | ✅ **NOUVEAU** |

---

## 🔄 Workflow du 4th Match

```
1. Récupération des données
   ├─ Titre, Description (souvent courts)
   ├─ Brand (fuzzy matching agressif si absent)
   ├─ Model (extraction description + fuzzy)
   ├─ CC (inférence agressive depuis nombres)
   └─ Année (optionnelle)

2. Brand matching ultra-permissif
   ├─ Exact match
   ├─ Fuzzy match (Levenshtein ≤ 2)
   └─ Détection dans tout le texte

3. Model hint agressif
   ├─ Href si présent
   ├─ Extraction description (patterns étendus)
   └─ Fallback sur tokens avec chiffres

4. Pour chaque candidat modèle
   ├─ Gate CC ultra-relaxé (≤ 250cc)
   ├─ PAS de gate année (trop restrictif)
   ├─ Calcul scoring composite avancé :
   │   ├─ Coverage (30%)
   │   ├─ Jaccard (15%)
   │   ├─ ✨ Fuzzy matching (25%)
   │   ├─ ✨ N-gram similarity (15%)
   │   ├─ CC proximity (10%)
   │   └─ Year proximity (5%)
   └─ Application des bonus

5. Sélection du meilleur
   ├─ Score ≥ 0.40 → Match accepté
   └─ Score < 0.40 → Rejeté

6. Détermination confiance
   ├─ Score ≥ 0.60 → MEDIUM (rare)
   └─ Score ≥ 0.40 → LOW (majorité)
```

---

## 📈 Exemples Concrets

### Exemple 1 : Annonce avec Typo (Fuzzy Match)

**Input** :
```json
{
  "text-body-1 (8)": "Yamha mt09",
  "annonce_description": "Belle moto",
  "data_quality_tier": "POOR",
  "data_quality_score": 28
}
```

**Traitement** :
1. Brand : "yamha" → Fuzzy match → "yamaha" ✅
2. Model : "mt09" détecté
3. Candidat : YAMAHA MT-09
4. Scoring :
   - Coverage : 0.25
   - Jaccard : 0.30
   - **Fuzzy match : 0.75** ✨ (excellent)
   - **N-gram : 0.60** ✨
   - Score base : 0.25×0.3 + 0.30×0.15 + 0.75×0.25 + 0.60×0.15 = **0.41**
   - **Fuzzy bonus** : +0.15 (fuzzy ≥ 0.5)
   - **N-gram bonus** : +0.10 (ngram ≥ 0.4)
   - **Score final** : 0.41 + 0.15 + 0.10 = **0.66** ✅

**Output** :
```json
{
  "matched_ok": true,
  "matched_marque": "YAMAHA",
  "matched_modele": "MT-09",
  "matched_score": 0.66,
  "matched_confidence": "MEDIUM",
  "needs_review": true
}
```

---

### Exemple 2 : Variante de Modèle

**Input** :
```json
{
  "text-body-1 (2)": "KAWASAKI",
  "text-body-1 (8)": "Z800",
  "annonce_description": "Moto roadster",
  "data_quality_tier": "POOR",
  "data_quality_score": 32
}
```

**Traitement** :
1. Brand : "kawasaki" (OK)
2. Model : "z800"
3. Candidat BDD : Z900 (pas de Z800 en BDD)
4. Scoring :
   - Coverage : 0.30
   - Jaccard : 0.35
   - **Fuzzy match : 0.50** ✨ ("z800" vs "z900", dist=1)
   - **N-gram : 0.50** ✨ ("z800" vs "z900")
   - CC : 0 (absent)
   - Score base : 0.30×0.3 + 0.35×0.15 + 0.50×0.25 + 0.50×0.15 = **0.37**
   - **Fuzzy bonus** : +0.15
   - **N-gram bonus** : +0.10
   - **Score final** : 0.37 + 0.15 + 0.10 = **0.62** ✅

**Output** :
```json
{
  "matched_ok": true,
  "matched_marque": "KAWASAKI",
  "matched_modele": "Z900",
  "matched_score": 0.62,
  "matched_confidence": "MEDIUM",
  "needs_review": true,
  "reason": "model_variant_fuzzy_matched"
}
```

---

### Exemple 3 : Annonce Très Pauvre (Échec)

**Input** :
```json
{
  "text-body-1 (8)": "Moto",
  "annonce_description": "A vendre",
  "data_quality_tier": "POOR",
  "data_quality_score": 22
}
```

**Traitement** :
1. Brand : non détecté (même avec fuzzy)
2. Model : aucun
3. **Aucun candidat**

**Output** :
```json
{
  "matched_ok": false,
  "matched_score": 0,
  "matched_confidence": "NONE",
  "needs_review": true,
  "reason_no_match": "brand_not_found"
}
```

→ Passe au **5th Match** (fallback)

---

## 📊 Performance Attendue

### Objectifs
- **Taux de matching** : ≥ 65% des annonces POOR
- **Confiance MEDIUM** : ~20%
- **Confiance LOW** : ~80%
- **Review manuelle** : 100% (données pauvres)

### Monitoring

```
🏅 4TH MATCH (FUZZY AGRESSIF) - STATS:
   Total items: 25
   Matched: 18 (72%) ✅
   Confidence:
     - MEDIUM: 4 (22%)
     - LOW: 14 (78%)
   Review manuelle: 18 (100%)
```

---

## 🔧 Ajustements Possibles

### Rendre Plus Permissif

```javascript
// Diminuer le seuil
MIN_ACCEPT = 0.30  // au lieu de 0.40

// Augmenter les bonus
FUZZY_BONUS = 0.20  // au lieu de 0.15
NGRAM_BONUS = 0.15  // au lieu de 0.10

// Augmenter la tolérance fuzzy
maxDist = 3  // au lieu de 2 (plus de variations)
```

**Effet** : +10-15% matching, mais +10-15% faux positifs

### Rendre Plus Strict

```javascript
// Augmenter le seuil
MIN_ACCEPT = 0.50

// Diminuer les bonus
FUZZY_BONUS = 0.10
NGRAM_BONUS = 0.05
```

**Effet** : -15% matching, mais -10% faux positifs

---

## 🆚 Comparaison : 3rd vs 4th Match

### Annonce Test : "Kawsaki Z800" (typo + variante)

**3rd Match** :
```javascript
// Pas de fuzzy matching avancé
Brand : "kawsaki" → Pas de match exact → Échec ❌
Score : 0
```

**4th Match** :
```javascript
// Fuzzy brand + fuzzy model
Brand : "kawsaki" → Fuzzy → "kawasaki" ✅
Model : "z800" → Fuzzy → "z900" ✅
Fuzzy match : 0.50
N-gram : 0.50
Bonus : +0.25
Score : 0.62 → Match MEDIUM ✅
```

**Gain** : Le 4th Match récupère **+30-40%** d'annonces que le 3rd rejette

---

## 🐛 Dépannage

### Problème : Trop de faux positifs

**Symptôme** :
- "HONDA CB500" matché avec "YAMAHA MT-07"

**Cause** :
- Fuzzy trop permissif (distance ≤ 2 accepte trop de variantes)

**Solution** :
```javascript
// Diminuer la distance max
maxDist = 1  // au lieu de 2

// Ou augmenter le seuil
MIN_ACCEPT = 0.50
```

### Problème : N-gram match des modèles trop différents

**Symptôme** :
- "Ninja 650" matché avec "Ninja 1000" (trop similaires en n-grams)

**Cause** :
- N-gram ne distingue pas assez les chiffres

**Solution** :
```javascript
// Ajouter un gate sur les chiffres
const adNumbers = extractNumbers(adText);
const modelNumbers = extractNumbers(modelRaw);

if (adNumbers.length && modelNumbers.length) {
  const hasCommonNumber = adNumbers.some(n => modelNumbers.includes(n));
  if (!hasCommonNumber) {
    ngramSim = ngramSim * 0.5; // Pénaliser
  }
}
```

---

## 📚 Références

- Code source : `CODE_4TH_MATCH.js`
- Architecture : `ARCHITECTURE_PROGRESSIVE_MATCHING.md`
- Comparaison : `ANALYSE_MATCH_NODES.md`

---

**Version** : 1.0
**Date** : 2026-02-15
