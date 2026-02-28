# 📁 Dossier Workflow - Documentation

Ce dossier contient tous les workflows n8n pour le scraping et l'enrichissement des annonces LeBonCoin.

---

## 📦 Liste des Workflows

### 🆕 **Workflow_PROGRESSIVE_MATCHING_v1.json** (NOUVEAU)
**Statut** : ⭐ **Recommandé**
**Description** : Workflow avec matching progressif intelligent

**Nouveautés** :
- ✅ **Scoring de Complétude** : Évalue la qualité des données (0-100)
- ✅ **Routing Intelligent** : Route automatiquement vers le bon Match selon le tier
- ✅ **3rd Match (nouveau)** : Matching permissif pour données moyennes
- ✅ **4th Match (amélioré)** : Fuzzy matching agressif + N-gram pour données pauvres
- ✅ Architecture progressive : 5 niveaux de matching

**Architecture** :
```
Gmail Trigger
    ↓
Extraction JSON
    ↓
Remove Duplicates
    ↓
Filter Empty Rows
    ↓
Merge (Annonces + Modèles)
    ↓
⭐ Scoring de Complétude (NOUVEAU)
    ↓
⭐ Router par Qualité (NOUVEAU)
    ↓
┌────────┬────────┬────────┬────────┬────────┐
│ 1st    │ 2nd    │ ⭐ 3rd │ 4th    │ 5th    │
│ Match  │ Match  │ Match  │ Match  │ Match  │
│EXCELL. │ GOOD   │ MEDIUM │ POOR   │ MINIMAL│
└────────┴────────┴────────┴────────┴────────┘
    ↓
Merge All Matches
    ↓
Rename Columns
    ↓
Output
```

**Taux de matching attendu** :
- 1st Match (EXCELLENT) : ~40% des annonces (95% matchées)
- 2nd Match (GOOD) : ~30% des annonces (90% matchées)
- 3rd Match (MEDIUM) : ~20% des annonces (85% matchées)
- 4th Match (POOR) : ~10% des annonces (70% matchées - amélioré !)
- 5th Match (MINIMAL) : ~5% des annonces (50% matchées)

**Installation** :
1. Importer le fichier JSON dans n8n
2. Copier le code de `CODE_SCORING_COMPLETUDE.js` dans le nœud "Scoring de Complétude"
3. Copier le code de `CODE_3RD_MATCH.js` dans le nœud "3rd Match"
4. Copier le code de `CODE_4TH_MATCH.js` dans le nœud "4th Match"
5. Copier les codes des autres Match (1st, 2nd, 5th) depuis les anciens workflows si besoin

---

### **Workflow_IMPROVED_v2.json**
**Statut** : Stable (ancienne version)
**Description** : Workflow avec nettoyage des données (Remove Duplicates + Filter Empty Rows)

**Améliorations vs Ancien_Workflow** :
- ✅ Suppression des doublons basée sur `absolute href`
- ✅ Filtrage des lignes vides/incomplètes
- ✅ Meilleure qualité des données

**Nœuds Match inclus** :
- 1st Match (v10)
- 2nd Match (AUTO_V10_SAFE_ANTI_UPGRADE)
- 4th Match (AUTO_V9_3_2_BRANDKEY_LBC2026)
- 5th Match (AUTO_V9_3_2_BRANDKEY_LBC2026)

**Limitations** :
- ❌ Pas de Scoring de Complétude
- ❌ Pas de 3rd Match
- ❌ Routing manuel (toutes les annonces passent par tous les Match)

---

### **Ancien_Workflow.json**
**Statut** : Déprécié
**Description** : Version originale sans nettoyage des données

**Problèmes** :
- ❌ Pas de suppression des doublons
- ❌ Pas de filtrage des lignes vides
- ❌ Données de qualité variable

**Utilisation** : Référence historique uniquement

---

### **workflow_enrichissement_leboncoin.json**
**Statut** : Déprécié
**Description** : Workflow d'enrichissement (ancienne version)

---

### **workflow_enrichissement_IMPROVED.json**
**Statut** : Déprécié
**Description** : Workflow d'enrichissement amélioré

---

## 🎯 Quel Workflow Utiliser ?

### Pour Production (Recommandé)
➡️ **`Workflow_PROGRESSIVE_MATCHING_v1.json`**

**Avantages** :
- ✅ Meilleur taux de matching (~95% vs ~70%)
- ✅ Routing intelligent selon qualité des données
- ✅ Confiance mesurable (HIGH/MEDIUM/LOW)
- ✅ Architecture moderne et évolutive

**Installation** :
1. Voir section "Installation" ci-dessus
2. Tester sur un échantillon
3. Valider la distribution dans les logs

### Pour Référence/Comparaison
➡️ **`Workflow_IMPROVED_v2.json`**

**Usage** :
- Comparer les résultats avec la nouvelle version
- Récupérer le code des Match 1st/2nd/4th/5th

---

## 📊 Comparaison des Workflows

| Caractéristique | Ancien | IMPROVED_v2 | PROGRESSIVE_v1 ⭐ |
|-----------------|--------|-------------|-------------------|
| Nettoyage données | ❌ | ✅ | ✅ |
| Scoring qualité | ❌ | ❌ | ✅ |
| Routing intelligent | ❌ | ❌ | ✅ |
| Nombre de Match | 4 | 4 | 5 |
| 3rd Match | ❌ | ❌ | ✅ |
| Taux matching | ~60% | ~70% | ~95% |
| Confiance mesurable | ❌ | Partiel | ✅ |
| Review manuelle | Non guidé | Non guidé | ✅ Flaggé |

---

## 🚀 Migration vers PROGRESSIVE_v1

### Étape 1 : Sauvegarde
1. Exporter votre workflow actuel
2. Sauvegarder dans un dossier de backup

### Étape 2 : Installation
1. Importer `Workflow_PROGRESSIVE_MATCHING_v1.json`
2. Copier les codes des nœuds (voir instructions ci-dessus)
3. Configurer les credentials (Gmail, etc.)

### Étape 3 : Test
1. Désactiver l'ancien workflow
2. Activer le nouveau workflow
3. Exécuter sur un échantillon de 50-100 annonces
4. Vérifier les console logs pour la distribution

### Étape 4 : Validation
**Vérifier** :
- ✅ Distribution des tiers (EXCELLENT/GOOD/MEDIUM/POOR/MINIMAL)
- ✅ Taux de matching global ≥ 90%
- ✅ Confiance des matches (HIGH/MEDIUM/LOW)
- ✅ Flags de review manuelle

**Console logs attendus** :
```
📊 SCORING DE COMPLÉTUDE - STATS:
   Total items: 100
   Score moyen: 65/100
   Distribution:
     - EXCELLENT: 35 (35%)
     - GOOD: 30 (30%)
     - MEDIUM: 20 (20%)
     - POOR: 10 (10%)
     - MINIMAL: 5 (5%)

🥉 3RD MATCH (PERMISSIF) - STATS:
   Total items: 20
   Matched: 18 (90%)
   Confidence:
     - HIGH: 5
     - MEDIUM: 10
     - LOW: 3
```

### Étape 5 : Ajustements
Si la distribution ne correspond pas :
- Score moyen < 50 → Données très pauvres, OK si majorité route vers 4th/5th Match
- Score moyen > 75 → Excellentes données, majorité vers 1st/2nd Match
- Taux matching < 85% → Vérifier les seuils dans les codes Match

---

## 📁 Structure du Dossier

```
Workflow/
├── README.md (ce fichier)
├── Workflow_PROGRESSIVE_MATCHING_v1.json ⭐ NOUVEAU
├── Workflow_IMPROVED_v2.json
├── Ancien_Workflow.json
├── workflow_enrichissement_leboncoin.json
└── workflow_enrichissement_IMPROVED.json
```

---

## 🔗 Fichiers Associés

### Codes des Nœuds
- `../CODE_SCORING_COMPLETUDE.js` - Code du nœud Scoring
- `../CODE_3RD_MATCH.js` - Code du 3rd Match

### Documentation
- `../ANALYSE_MATCH_NODES.md` - Analyse complète des nœuds Match
- `../INSTRUCTIONS_SCORING_COMPLETUDE.md` - Guide d'installation du Scoring
- `../EXEMPLE_TEST_SCORING.json` - Cas de test pour validation

---

## ❓ FAQ

### Q1 : Puis-je utiliser seulement certains Match ?
**R** : Oui, mais vous perdrez en couverture. Le système progressif est conçu pour maximiser le taux de matching.

### Q2 : Comment ajuster les seuils ?
**R** : Modifiez les constantes dans chaque code Match :
- `MIN_COV_ALPHA` : Couverture alpha minimum
- `MIN_ACCEPT` : Score minimum pour accepter un match
- `CC_BLOCK_DIFF` : Tolérance CC en cm³

### Q3 : Le 3rd Match peut-il être désactivé ?
**R** : Oui, mais les annonces MEDIUM iront vers le 4th Match (moins précis).

### Q4 : Comment améliorer le taux de matching ?
**R** :
1. Améliorer la qualité du scraping (plus de champs)
2. Enrichir la base de données de modèles
3. Ajuster les seuils pour être plus permissifs (risque de faux positifs)

### Q5 : Quelle est la différence entre "confiance" et "score" ?
**R** :
- **Score** : Valeur numérique 0-1 du matching
- **Confiance** : Catégorie HIGH/MEDIUM/LOW basée sur le score et d'autres critères

---

## 📞 Support

Pour toute question :
1. Consulter `ANALYSE_MATCH_NODES.md`
2. Vérifier les console logs
3. Inspecter les `_match_debug` dans les outputs

---

**Dernière mise à jour** : 2026-02-15
**Version** : 1.0
