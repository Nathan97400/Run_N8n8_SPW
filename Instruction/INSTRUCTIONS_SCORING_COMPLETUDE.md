# 📊 Instructions d'Installation : Nœud Scoring de Complétude

## 🎯 Objectif du Nœud

Le **Scoring de Complétude** évalue la qualité des données entrantes (annonces LeBonCoin) et attribue :
- Un **score de 0 à 100** points
- Un **tier de qualité** (EXCELLENT/GOOD/MEDIUM/POOR/MINIMAL)
- Une **recommandation de routing** vers le bon nœud Match
- Des **flags de complétude** pour chaque catégorie de données

---

## 📦 Installation dans n8n

### Étape 1 : Créer le Nœud Code

1. Dans votre workflow n8n, ajoutez un nouveau nœud **Code**
2. Nommez-le : `Scoring de Complétude`
3. Positionnez-le **APRÈS** les nœuds de nettoyage (Remove Duplicates, Filter Empty Rows) et **AVANT** les nœuds Match

### Étape 2 : Copier le Code

1. Ouvrez le fichier `CODE_SCORING_COMPLETUDE.js`
2. Copiez **tout le contenu**
3. Collez-le dans le champ `jsCode` du nœud Code

### Étape 3 : Configuration

- **Mode** : Run Once for All Items
- **Language** : JavaScript
- Aucun paramètre supplémentaire requis

---

## 📊 Critères de Scoring (100 points max)

| Critère | Points Max | Source Prioritaire | Qualité |
|---------|------------|-------------------|---------|
| **Marque** | 25 | `text-body-1 href (2)` (u_moto_brand) | EXCELLENT si href |
| **Modèle** | 20 | `text-body-1 href (3)` (u_moto_model) | EXCELLENT si href non-"autre" |
| **Cylindrée CC** | 15 | `text-body-1 href (5)` (cubic_capacity) | EXCELLENT si href |
| **Année** | 10 | `text-body-1 (4)` puis `(9)` | GOOD si présente |
| **Description** | 15 | `annonce_description` / `text-body-1 (16)` | EXCELLENT si ≥50 mots |
| **Photos** | 5 | `size-full src` (1-3) | EXCELLENT si ≥3 photos |
| **Titre** | 10 | `text-body-1 (8)` / `text-headline-1-expanded` | EXCELLENT si ≥5 mots |

---

## 🎯 Tiers de Qualité

| Tier | Score | Signification | Routing Recommandé |
|------|-------|---------------|-------------------|
| **EXCELLENT** | 80-100 | Données très complètes | → **1st Match** (strict) |
| **GOOD** | 60-79 | Données complètes | → **2nd Match** (moyen) |
| **MEDIUM** | 40-59 | Données moyennes | → **3rd Match** (permissif) |
| **POOR** | 20-39 | Données pauvres | → **4th Match** (fuzzy) |
| **MINIMAL** | 0-19 | Données minimales | → **5th Match** (fallback) |

---

## 📤 Champs de Sortie

### Champs Principaux

Tous les champs originaux sont **préservés**, plus :

```javascript
{
  // ========================================
  // SCORING
  // ========================================
  data_quality_score: 75,              // Score 0-100
  data_quality_tier: "GOOD",           // EXCELLENT|GOOD|MEDIUM|POOR|MINIMAL
  data_quality_priority: "MEDIUM",     // HIGH|MEDIUM|LOW

  // ========================================
  // RECOMMANDATION
  // ========================================
  recommended_match_node: "2nd Match", // Quel Match utiliser
  needs_manual_review: false,          // true si score < 30

  // ========================================
  // STATISTIQUES
  // ========================================
  completeness_percentage: 71,         // % de champs présents
  fields_present: 5,                   // Nombre de champs présents
  fields_total: 7,                     // Nombre total de champs évalués

  // ========================================
  // DÉTAILS (debug)
  // ========================================
  _completude_details: {
    brand: { source: "href", quality: "EXCELLENT", points: 25 },
    model: { source: "href", quality: "EXCELLENT", points: 20 },
    cc: { source: "href", quality: "EXCELLENT", points: 15 },
    year: { source: "field_primary", quality: "GOOD", points: 10 },
    description: { length: 45, quality: "GOOD", points: 12 },
    photos: { count: 3, quality: "EXCELLENT", points: 5 },
    title: { length: 6, quality: "EXCELLENT", points: 10 }
  },

  // ========================================
  // FLAGS
  // ========================================
  _completeness_flags: {
    has_brand: true,
    has_model: true,
    has_cc: true,
    has_year: true,
    has_description: true,
    has_photos: true,
    has_title: true
  }
}
```

---

## 📈 Console Logs

Le nœud affiche des statistiques dans la console :

```
📊 SCORING DE COMPLÉTUDE - STATS:
   Total items: 150
   Score moyen: 68/100
   Distribution:
     - EXCELLENT: 45 (30%)
     - GOOD: 52 (35%)
     - MEDIUM: 30 (20%)
     - POOR: 15 (10%)
     - MINIMAL: 8 (5%)
   Review manuelle nécessaire: 8
```

---

## 🔄 Intégration dans le Workflow

### Position Recommandée

```
Gmail Trigger
    ↓
Extraction JSON Leboncoin
    ↓
Remove Duplicates
    ↓
Filter Empty Rows
    ↓
Merge (avec GET Modeles)
    ↓
┌─────────────────────────┐
│ SCORING DE COMPLÉTUDE   │  ← NOUVEAU NŒUD ICI
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ SWITCH/IF (routing)     │  ← OPTIONNEL
└─────────────────────────┘
    ↓
┌─────┬─────┬─────┬─────┬─────┐
│ 1st │ 2nd │ 3rd │ 4th │ 5th │  Match nodes
└─────┴─────┴─────┴─────┴─────┘
```

### Option 1 : Routing Automatique (Recommandé)

Ajoutez un nœud **Switch** ou **IF** après le Scoring :

```javascript
// Nœud Switch
// Route basée sur data_quality_tier

Routes:
1. data_quality_tier === "EXCELLENT" → 1st Match
2. data_quality_tier === "GOOD" → 2nd Match
3. data_quality_tier === "MEDIUM" → 3rd Match
4. data_quality_tier === "POOR" → 4th Match
5. data_quality_tier === "MINIMAL" → 5th Match
```

### Option 2 : Routing Manuel

Laissez toutes les annonces passer par le 1st Match en premier, puis les non-matchées vers 2nd, etc.

Le champ `recommended_match_node` indique quel nœud serait optimal.

---

## ✅ Validation

### Test 1 : Annonce EXCELLENTE

**Données** :
- Marque href : ✅ `u_moto_brand:YAMAHA`
- Modèle href : ✅ `u_moto_model:MT-07`
- CC href : ✅ `cubic_capacity:689`
- Année : ✅ `2021`
- Description : ✅ 60 mots
- Photos : ✅ 3 photos
- Titre : ✅ "YAMAHA MT-07 ABS 2021"

**Résultat attendu** :
- `data_quality_score` : 97-100
- `data_quality_tier` : "EXCELLENT"
- `recommended_match_node` : "1st Match"

### Test 2 : Annonce GOOD

**Données** :
- Marque champ : ✅ `TRIUMPH`
- Modèle href : ❌ "autre"
- Version : ✅ `1050_Speed Triple`
- CC champ : ✅ `1050`
- Année : ✅ `2013`
- Description : ✅ 30 mots
- Photos : ✅ 2 photos

**Résultat attendu** :
- `data_quality_score` : 65-75
- `data_quality_tier` : "GOOD"
- `recommended_match_node` : "2nd Match"

### Test 3 : Annonce POOR

**Données** :
- Marque : ✅ détectée dans titre
- Modèle : ❌ absent
- CC : ❌ absent
- Année : ❌ absente
- Description : ⚠️ 8 mots
- Photos : ✅ 1 photo

**Résultat attendu** :
- `data_quality_score` : 25-35
- `data_quality_tier` : "POOR"
- `recommended_match_node` : "4th Match"
- `needs_manual_review` : false

---

## 🐛 Dépannage

### Problème : Tous les scores sont bas

**Cause** : Les champs sources ne correspondent pas à votre mapping

**Solution** : Vérifiez les champs utilisés dans le code :
- `text-body-1 (2)` → marque
- `text-body-1 href (2)` → href marque
- `text-body-1 href (3)` → href modèle
- etc.

Ajustez les clés dans les fonctions `get()` si nécessaire.

### Problème : Console logs non visibles

**Cause** : Logs désactivés dans n8n

**Solution** : Activez les logs dans Settings → Log Output

### Problème : Distribution déséquilibrée

**Exemple** : 80% MINIMAL, 5% EXCELLENT

**Solution** : Vos données sont très pauvres. Options :
1. Améliorer le scraping pour capturer plus de champs
2. Ajuster les seuils de scoring (diminuer les points requis)
3. Accepter que la majorité ira vers les Match permissifs (4th/5th)

---

## 🎯 Prochaines Étapes

1. ✅ **Installer le nœud** dans votre workflow
2. ✅ **Tester** sur un échantillon de données
3. ✅ **Analyser** la distribution dans les logs
4. ✅ **Ajuster** les seuils si nécessaire (dans le code)
5. ✅ **Implémenter** le routing (Switch node)
6. ➡️ **Passer** à l'amélioration des nœuds Match

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez les console logs pour les stats
2. Inspectez un item de sortie pour voir les `_completude_details`
3. Validez que les champs sources correspondent à votre scraping

**Fichiers de référence** :
- Code source : `CODE_SCORING_COMPLETUDE.js`
- Documentation : `ANALYSE_MATCH_NODES.md`
