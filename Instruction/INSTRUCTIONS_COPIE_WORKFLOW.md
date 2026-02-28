# 🚀 Instructions Rapides - Copier-Coller dans n8n

## 📋 Vue d'Ensemble

Voici les **instructions précises** pour copier-coller les codes dans votre workflow n8n.

**Durée totale** : 10-15 minutes ⏱️

---

## 📂 Étape 1 : Préparer les Fichiers

Ouvrez ces fichiers dans votre éditeur de code (VS Code, Notepad++, etc.) :

```
✅ CODE_SCORING_COMPLETUDE.js
✅ CODE_1ST_MATCH.js          ⭐ NOUVEAU
✅ CODE_2ND_MATCH.js          ⭐ NOUVEAU
✅ CODE_3RD_MATCH.js
✅ CODE_4TH_MATCH.js
✅ CODE_5TH_MATCH.js
```

---

## 🔨 Étape 2 : Import du Workflow de Base dans n8n

1. Ouvrez **n8n**
2. **Menu** → **Workflows** → **Import from File**
3. Sélectionnez : `Workflow/Workflow_PROGRESSIVE_MATCHING_v1.json`
4. Le workflow s'ouvre avec des nœuds vides

---

## ✂️ Étape 3 : Copier-Coller les Codes

### 3.1 - ⭐ Scoring de Complétude

**Fichier source** : `CODE_SCORING_COMPLETUDE.js`

**Dans n8n** :
1. Double-cliquer sur le nœud **"⭐ Scoring de Complétude"**
2. **TOUT SÉLECTIONNER** dans le champ JavaScript Code
3. **SUPPRIMER** le contenu actuel
4. **COLLER** le contenu complet de `CODE_SCORING_COMPLETUDE.js`
5. **Sauvegarder** (bouton "Save")

**Vérification** :
```javascript
// Le code doit commencer par :
const items = $input.all();

// Et se terminer par :
return results;
```

---

### 3.2 - 1st Match (EXCELLENT)

**Fichier source** : `CODE_1ST_MATCH.js`

**Dans n8n** :
1. Double-cliquer sur **"1st Match (EXCELLENT)"**
2. **SUPPRIMER** le contenu actuel
3. **COLLER** le contenu complet de `CODE_1ST_MATCH.js`
4. **Sauvegarder**

**Vérification** :
```javascript
// Chercher ces lignes (vers le milieu) :
const MIN_COV_ALPHA = 0.85;    // 85%
const MIN_ACCEPT = 0.78;        // 78%
const CC_BLOCK_DIFF = 80;       // 80cc
```

---

### 3.3 - 2nd Match (GOOD)

**Fichier source** : `CODE_2ND_MATCH.js`

**Dans n8n** :
1. Double-cliquer sur **"2nd Match (GOOD)"**
2. **SUPPRIMER** le contenu actuel
3. **COLLER** le contenu complet de `CODE_2ND_MATCH.js`
4. **Sauvegarder**

**Vérification** :
```javascript
// Chercher ces lignes :
const MIN_COV_ALPHA = 0.80;    // 80%
const MIN_ACCEPT = 0.70;        // 70%
const CC_BLOCK_DIFF = 150;      // 150cc
const YEAR_TOLERANCE = 2;       // ±2 ans
```

---

### 3.4 - ⭐ 3rd Match (MEDIUM - Permissif)

**Fichier source** : `CODE_3RD_MATCH.js`

**Dans n8n** :
1. Double-cliquer sur **"⭐ 3rd Match (MEDIUM - Permissif)"**
2. **SUPPRIMER** le contenu actuel
3. **COLLER** le contenu complet de `CODE_3RD_MATCH.js`
4. **Sauvegarder**

**Vérification** :
```javascript
// Chercher ces lignes (vers la fin) :
const MIN_COV_ALPHA = 0.50;    // 50%
const MIN_ACCEPT = 0.55;        // 55%
const CC_BLOCK_DIFF = 150;      // 150cc
```

---

### 3.5 - 4th Match (POOR)

**Fichier source** : `CODE_4TH_MATCH.js`

**Dans n8n** :
1. Double-cliquer sur **"4th Match (POOR)"**
2. **SUPPRIMER** le contenu actuel
3. **COLLER** le contenu complet de `CODE_4TH_MATCH.js`
4. **Sauvegarder**

**Vérification** :
```javascript
// Chercher ces lignes :
const MIN_ACCEPT = 0.40;          // 40%
const CC_RELAXATION = 250;        // 250cc
const FUZZY_BONUS = 0.15;
const NGRAM_BONUS = 0.10;
```

---

### 3.6 - ⭐ 5th Match (MINIMAL)

**Fichier source** : `CODE_5TH_MATCH.js`

**Dans n8n** :
1. Double-cliquer sur **"5th Match (MINIMAL)"**
2. **SUPPRIMER** le contenu actuel
3. **COLLER** le contenu complet de `CODE_5TH_MATCH.js`
4. **Sauvegarder**

**Vérification** :
```javascript
// Chercher ces lignes :
const MIN_ACCEPT = 0.25;          // 25%
const CC_RELAXATION = 400;        // 400cc
const FUZZY_BONUS = 0.20;
const NGRAM_BONUS = 0.15;
const CATEGORY_BONUS = 0.10;
const BRAND_ONLY_BONUS = 0.15;
```

---

## ✅ Étape 4 : Vérification Rapide

### Checklist des Nœuds à Vérifier

```
☑️ Gmail Trigger              → Configuré avec credentials Gmail
☑️ Extraction JSON             → Code présent (depuis Workflow_IMPROVED_v2.json)
☑️ Remove Duplicates           → Paramètres : field "absolute href"
☑️ Filter Empty Rows           → Code présent (depuis Workflow_IMPROVED_v2.json)
☑️ GET Modeles                 → URL : https://nante.nathansouffrin7.workers.dev/
☑️ Merge Annonces + Modèles    → Mode "Merge By Position"
☑️ ⭐ Scoring de Complétude    → ✅ Code copié (538 lignes)
☑️ ⭐ Router par Qualité       → Switch avec 5 outputs
☑️ 1st Match (EXCELLENT)       → ✅ Code copié (651 lignes) ⭐ NOUVEAU
☑️ 2nd Match (GOOD)            → ✅ Code copié (701 lignes) ⭐ NOUVEAU
☑️ ⭐ 3rd Match (MEDIUM)       → ✅ Code copié (759 lignes)
☑️ 4th Match (POOR)            → ✅ Code copié (784 lignes)
☑️ 5th Match (MINIMAL)         → ✅ Code copié (851 lignes) ⭐ NOUVEAU
☑️ Merge All Matches           → Mode "Merge By Position"
☑️ Rename Columns              → Code présent (depuis Workflow_IMPROVED_v2.json)
```

---

## 🧪 Étape 5 : Test Rapide

### 5.1 - Préparer un Fichier JSON de Test

Créez un fichier `test_10_annonces.json` avec 10 annonces :
- 2-3 annonces EXCELLENT (toutes données présentes)
- 2-3 annonces GOOD (marque + modèle + CC)
- 2-3 annonces MEDIUM (marque + description)
- 1-2 annonces POOR (marque floue)
- 0-1 annonce MINIMAL (quasiment rien)

---

### 5.2 - Lancer le Test

1. **Envoyer** le fichier JSON par email à l'adresse configurée dans Gmail Trigger
2. **Activer** le workflow dans n8n
3. **Observer** l'exécution

---

### 5.3 - Vérifier les Résultats

**Après "Scoring de Complétude"** :
- Chaque annonce doit avoir `data_quality_score` (0-100)
- Chaque annonce doit avoir `data_quality_tier` (EXCELLENT/GOOD/MEDIUM/POOR/MINIMAL)

**Après "Router par Qualité"** :
- Les annonces sont réparties selon leur tier

**Après chaque Match** :
- Vérifier `matched_ok` (true/false)
- Vérifier `matched_marque` et `matched_modele`
- Vérifier `matched_confidence` (HIGH/MEDIUM/LOW)

**Après "Merge All Matches"** :
- Toutes les annonces sont présentes
- Chaque annonce a un champ `matching_engine` indiquant quel Match l'a traitée

---

## 📊 Étape 6 : Consulter les Stats

Dans l'exécution n8n, cherchez les **console logs** :

```
📊 SCORING DE COMPLÉTUDE - STATS:
   Total items: 10
   Score moyen: XX/100
   Distribution:
     - EXCELLENT: X
     - GOOD: X
     - MEDIUM: X
     - POOR: X
     - MINIMAL: X

🥉 3RD MATCH (PERMISSIF) - STATS:
   Total items: X
   Matched: X (XX%)
   Confidence:
     - HIGH: X
     - MEDIUM: X
     - LOW: X

🏅 4TH MATCH (FUZZY AGRESSIF) - STATS:
   Total items: X
   Matched: X (XX%)
   Confidence:
     - MEDIUM: X
     - LOW: X

🆘 5TH MATCH (FALLBACK ULTIME) - STATS:
   Total items: X
   Matched: X (XX%)
   Rejected: X (XX%)
   Strategies:
     - Brand+Category: X
     - Fuzzy ultra: X
     - N-gram flexible: X
```

---

## 🎯 Résultat Attendu

Avec 10 annonces de test variées, vous devriez obtenir :

- **Taux de matching global** : 80-100% (8-10 annonces matchées)
- **Annonces EXCELLENT** : ~100% matchées (HIGH confidence)
- **Annonces GOOD** : ~90% matchées (HIGH/MEDIUM confidence)
- **Annonces MEDIUM** : ~80-90% matchées (grâce au 3rd Match ⭐)
- **Annonces POOR** : ~60-70% matchées (grâce au 4th Match)
- **Annonces MINIMAL** : ~40-60% matchées (grâce au 5th Match ⭐)

---

## 🔧 Ajustements Rapides

Si le taux de matching est **trop faible** pour un tier spécifique :

### 3rd Match (MEDIUM)
```javascript
// Dans le nœud "⭐ 3rd Match (MEDIUM - Permissif)"
// Chercher et modifier :

const MIN_COV_ALPHA = 0.45;    // au lieu de 0.50 (plus permissif)
const MIN_ACCEPT = 0.50;        // au lieu de 0.55 (plus permissif)
```

### 4th Match (POOR)
```javascript
// Dans le nœud "4th Match (POOR)"
// Chercher et modifier :

const MIN_ACCEPT = 0.35;        // au lieu de 0.40 (plus permissif)
const CC_RELAXATION = 300;      // au lieu de 250 (plus tolérant)
```

### 5th Match (MINIMAL)
```javascript
// Dans le nœud "5th Match (MINIMAL)"
// Chercher et modifier :

const MIN_ACCEPT = 0.20;        // au lieu de 0.25 (plus permissif)
const CATEGORY_BONUS = 0.15;    // au lieu de 0.10 (bonus augmenté)
```

**Après modification** : Sauvegarder et relancer le test.

---

## 🎉 C'est Terminé !

Votre workflow est maintenant **opérationnel** !

### Prochaines étapes recommandées :

1. ✅ **Tester avec plus d'annonces** (50-100) pour valider la robustesse
2. ✅ **Ajuster les paramètres** selon vos résultats
3. ✅ **Exporter le workflow** : Menu → Download → `Workflow_PROGRESSIVE_MATCHING_FINAL.json`
4. ✅ **Documenter vos paramètres** dans un fichier README

---

## 📚 Pour Aller Plus Loin

- **GUIDE_ASSEMBLAGE_WORKFLOW_FINAL.md** → Instructions détaillées complètes
- **DOC_5TH_MATCH.md** → Comprendre le fallback ultime
- **RESUME_FINAL_AMELIORATIONS.md** → Vue d'ensemble du système

---

**Bon matching ! 🚀**

---

**Version** : 1.0
**Date** : 2026-02-15
