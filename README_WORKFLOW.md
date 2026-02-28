# 📚 Workflow n8n : Enrichissement Annonces Leboncoin

## 🎯 Vue d'Ensemble

Ce dépôt contient tous les fichiers nécessaires pour déployer et utiliser le workflow n8n d'enrichissement automatique des annonces motos du Leboncoin.

**Application** : WSP V1
**Version** : 1.0.0
**Date** : 2026-02-15

---

## 📁 Structure du Projet

```
n8n_builders/
│
├── 📄 CLAUDE.md                                    # Instructions projet (context Claude)
├── 📄 README_WORKFLOW.md                           # Ce fichier
│
├── 🔧 WORKFLOW
│   ├── workflow_enrichissement_leboncoin.json      # Workflow n8n (à importer)
│   └── supabase_schema.sql                         # Schéma base de données
│
├── 📖 DOCUMENTATION
│   ├── WORKFLOW_ENRICHISSEMENT_README.md           # Documentation complète
│   ├── QUICKSTART.md                               # Guide de démarrage rapide
│   └── IMPLEMENTATION_SUMMARY.md                   # Résumé de l'implémentation
│
├── 🧪 TEST DATA
│   ├── test_data_sample.csv                        # Données de test (CSV)
│   └── test_data_sample.json                       # Données de test (JSON)
│
├── 📊 DONNÉES SOURCES (vos fichiers)
│   ├── CSV LBC/                                    # Fichiers CSV exportés
│   ├── JSON LBC/                                   # Fichiers JSON exportés
│   └── BDD Modèles/                                # Base de données de référence
│       └── motorcycles_brands_full_ENRICHED.json
│
└── 📝 DOCUMENTATION ANNEXE
    ├── .mcp.json                                   # Configuration serveur MCP n8n
    └── Autres fichiers projet...
```

---

## 🚀 Démarrage Rapide

### Option 1 : Je veux déployer maintenant (10 minutes)

➡️ **Suivez le guide** : [`QUICKSTART.md`](QUICKSTART.md)

**Étapes** :
1. Importer le workflow
2. Configurer Gmail + Supabase
3. Créer la table
4. Tester
5. ✅ C'est prêt !

---

### Option 2 : Je veux comprendre d'abord (30 minutes)

➡️ **Lisez d'abord** : [`WORKFLOW_ENRICHISSEMENT_README.md`](WORKFLOW_ENRICHISSEMENT_README.md)

**Contenu** :
- Architecture détaillée
- Description de chaque nœud
- Exemples de flux de données
- Métriques de performance
- Points d'attention

Puis suivez [`QUICKSTART.md`](QUICKSTART.md) pour le déploiement.

---

## 📄 Description des Fichiers

### 🔧 Fichiers Principaux

#### **workflow_enrichissement_leboncoin.json**
**Type** : Workflow n8n
**Utilisation** : À importer dans n8n

**Contenu** :
- 10 nœuds configurés
- Connexions définies
- Credentials placeholders
- Prêt à l'emploi

**Import** :
```
n8n → Workflows → Import from File → Sélectionner ce fichier
```

---

#### **supabase_schema.sql**
**Type** : Script SQL PostgreSQL
**Utilisation** : Créer la base de données Supabase

**Contenu** :
- Table `annonces_motos` (21 colonnes)
- 6 index optimisés
- 3 vues analytiques
- 2 fonctions utilitaires
- Trigger `updated_at`
- Commentaires sur toutes les colonnes

**Exécution** :
```sql
-- Via Supabase SQL Editor
Copier-coller le contenu → Run

-- Ou via psql
psql -h xxxxx.supabase.co -U postgres -f supabase_schema.sql
```

---

### 📖 Documentation

#### **WORKFLOW_ENRICHISSEMENT_README.md**
**Type** : Documentation complète
**Audience** : Développeurs, DevOps, Analystes

**Sections** :
- 📋 Vue d'ensemble et objectifs
- 🏗️ Architecture (diagramme ASCII)
- 🔧 Description détaillée des 10 nœuds
- 📊 Exemples de transformation de données
- 🚀 Instructions de déploiement
- 🧪 Tests et validation
- 📈 Métriques de performance
- ⚠️ Points d'attention
- 🔄 Améliorations futures

**À lire si** : Vous voulez comprendre le fonctionnement complet.

---

#### **QUICKSTART.md**
**Type** : Guide de démarrage rapide
**Audience** : Débutants, utilisateurs pressés

**Contenu** :
- ✅ Checklist de déploiement (6 étapes)
- 🔧 Configuration Gmail OAuth2
- 🔧 Configuration Supabase
- 🧪 Tests automatiques et manuels
- ⚠️ Résolution de 5 problèmes courants
- 📊 Premières requêtes SQL utiles

**Temps estimé** : 10-15 minutes

**À lire si** : Vous voulez déployer rapidement.

---

#### **IMPLEMENTATION_SUMMARY.md**
**Type** : Résumé récapitulatif
**Audience** : Chefs de projet, décideurs

**Contenu** :
- 📦 Liste de tous les fichiers créés
- ✅ Fonctionnalités implémentées
- 📊 Métriques estimées
- 🔐 Sécurité et dépendances
- 🧪 Tests recommandés
- 🚨 Points d'attention critiques
- 🔄 Améliorations futures
- ✅ Critères de succès

**À lire si** : Vous voulez une vue d'ensemble executive.

---

### 🧪 Données de Test

#### **test_data_sample.csv**
**Type** : Fichier CSV de test
**Lignes** : 12 annonces (dont 1 doublon et 1 ligne vide)

**Utilisation** :
1. Envoyer par email à votre adresse Gmail configurée
2. Attacher ce fichier CSV
3. Le workflow se déclenchera automatiquement

**Attendu** :
- 1 doublon supprimé → 11 annonces
- 1 ligne vide supprimée → 10 annonces finales
- ~70-80% d'enrichissement (7-8 annonces enrichies)

---

#### **test_data_sample.json**
**Type** : Fichier JSON de test
**Objets** : 8 annonces (dont 1 doublon)

**Utilisation** :
Même procédure que le CSV.

**Attendu** :
- 1 doublon supprimé → 7 annonces finales
- ~70-80% d'enrichissement

---

### 📊 Données Sources

#### **CSV LBC/** et **JSON LBC/**
**Contenu** : Vos fichiers CSV/JSON exportés du Leboncoin

**Format attendu** :
- **CSV** : Colonnes comme `absolute href`, `text-headline-1-expanded`, etc.
- **JSON** : Objets avec `href`, `titre`, `marque`, etc.

**Normalisation** :
Le workflow gère automatiquement le mapping entre les deux formats.

---

#### **BDD Modèles/motorcycles_brands_full_ENRICHED.json**
**Type** : Base de données de référence
**Format** : JSON array d'objets

**Structure attendue** :
```json
[
  {
    "Marque": "KTM",
    "Modèle": "690 Duke R",
    "Année début": 2012,
    "Année fin": 2019,
    "Cylindrée (cc)": 690,
    "Type (M/S/E)": "M",
    "Coloris commercial": "Orange"
  },
  ...
]
```

**Importance** :
⚠️ **CRITIQUE** : Ce fichier est essentiel pour l'enrichissement. Sans lui, toutes les annonces auront `match_found = false`.

**Emplacement** :
```
C:\Users\natha\Documents\projets_claude-code\n8n_builders\BDD Modèles\motorcycles_brands_full_ENRICHED.json
```

**À modifier si** : Votre chemin est différent (voir nœud "Read BDD Modèles").

---

## 🎯 Cas d'Usage

### Cas d'Usage 1 : Collecte Quotidienne
**Scénario** : Scraper quotidien envoie un CSV par email chaque matin.

**Configuration** :
1. Workflow actif 24/7
2. Gmail Trigger poll toutes les 5 minutes
3. Filtre sur expéditeur : `from:votre-scraper@example.com`

**Résultat** :
- Annonces enrichies automatiquement
- Stockées dans Supabase
- Prêtes pour analyse

---

### Cas d'Usage 2 : Import Manuel Occasionnel
**Scénario** : Import manuel de fichiers CSV/JSON ponctuellement.

**Configuration** :
1. Workflow actif seulement quand besoin
2. Envoyer manuellement un email avec pièce jointe
3. Vérifier les résultats dans Supabase

**Résultat** :
- Import à la demande
- Pas de polling constant
- Contrôle total

---

### Cas d'Usage 3 : Analyse de Données Historiques
**Scénario** : Vous avez 1000+ annonces dans des fichiers CSV.

**Configuration** :
1. Diviser en plusieurs fichiers de 100-200 lignes
2. Envoyer un email par fichier (ou batch)
3. Ajouter `Split in Batches` avant Supabase si fichiers très gros

**Résultat** :
- Traitement par lots
- Performance optimisée
- Évite les timeouts

---

## 📊 Requêtes SQL Utiles

Une fois les données dans Supabase, voici les requêtes les plus utiles :

### 1. Taux d'enrichissement global
```sql
SELECT
  COUNT(*) AS total_annonces,
  COUNT(CASE WHEN match_found = TRUE THEN 1 END) AS annonces_enrichies,
  ROUND(100.0 * COUNT(CASE WHEN match_found = TRUE THEN 1 END) / COUNT(*), 2) AS taux_pct
FROM annonces_motos;
```

### 2. Top 10 marques
```sql
SELECT * FROM stats_par_marque LIMIT 10;
```

### 3. Top 10 modèles
```sql
SELECT * FROM top_modeles(10);
```

### 4. Annonces des dernières 24h
```sql
SELECT COUNT(*)
FROM annonces_motos
WHERE processed_at > NOW() - INTERVAL '24 hours';
```

### 5. Annonces non enrichies (à investiguer)
```sql
SELECT * FROM annonces_non_enrichies LIMIT 20;
```

### 6. Distribution par type de moto
```sql
SELECT
  CASE type_moto
    WHEN 'M' THEN 'Moto'
    WHEN 'S' THEN 'Scooter'
    WHEN 'E' THEN 'Électrique'
    ELSE 'Non spécifié'
  END AS type,
  COUNT(*)
FROM annonces_motos
WHERE match_found = TRUE
GROUP BY type_moto
ORDER BY COUNT(*) DESC;
```

---

## ⚠️ FAQ / Dépannage

### Q1 : Le workflow ne se déclenche pas
**Réponse** :
- Vérifier que le workflow est **actif** (toggle en haut à droite)
- Vérifier le polling interval de Gmail Trigger (par défaut 1 minute)
- Vérifier les filtres Gmail (`has:attachment`)
- Vérifier les logs : `Executions` → rechercher des erreurs

---

### Q2 : Aucun enrichissement (match_found = false partout)
**Réponse** :
- Vérifier que `motorcycles_brands_full_ENRICHED.json` existe au bon chemin
- Vérifier le contenu du fichier (format JSON valide)
- Vérifier que les marques correspondent (ex: "KTM" vs "Ktm")
- Ajouter des `console.log()` dans le Code node "Enrich with Models"

---

### Q3 : Erreur "Duplicate key" dans Supabase
**Réponse** :
- **Normal** : C'est le système de déduplication qui fonctionne
- Si vous voulez réimporter : Vider la table d'abord
- Ou : Laisser `upsert: true` faire son travail (mise à jour au lieu d'insertion)

---

### Q4 : Performance lente (>1 minute pour 100 lignes)
**Réponse** :
- Vérifier la taille de `motorcycles_brands_full_ENRICHED.json` (trop gros ?)
- Ajouter `Split in Batches` avant Supabase
- Optimiser l'algorithme de matching (Code node)
- Vérifier les index Supabase

---

### Q5 : Comment modifier le chemin de la BDD Modèles ?
**Réponse** :
1. Ouvrir le workflow dans n8n
2. Cliquer sur le nœud `Read BDD Modèles`
3. Modifier `File Selector` avec le nouveau chemin (absolu)
4. Sauvegarder le workflow

---

## 🔄 Cycle de Vie du Workflow

### Phase 1 : Déploiement (Aujourd'hui)
- [x] ✅ Import du workflow
- [x] ✅ Configuration credentials
- [x] ✅ Création table Supabase
- [ ] ⏳ Tests avec données de test
- [ ] ⏳ Validation du taux d'enrichissement

### Phase 2 : Pilote (Cette Semaine)
- [ ] Collecte de 100-500 annonces réelles
- [ ] Validation de la qualité des données
- [ ] Ajustements de l'algorithme
- [ ] Documentation des cas limites

### Phase 3 : Production (Ce Mois)
- [ ] Automatisation quotidienne
- [ ] Dashboard de suivi
- [ ] Notifications en cas d'erreur
- [ ] Atteindre 1000+ annonces enrichies

### Phase 4 : Optimisation (Prochain Trimestre)
- [ ] Machine Learning pour le matching
- [ ] API pour BDD dynamique
- [ ] Interface web de visualisation

---

## 📞 Support

### Ressources
- **Documentation complète** : [`WORKFLOW_ENRICHISSEMENT_README.md`](WORKFLOW_ENRICHISSEMENT_README.md)
- **Guide rapide** : [`QUICKSTART.md`](QUICKSTART.md)
- **Résumé** : [`IMPLEMENTATION_SUMMARY.md`](IMPLEMENTATION_SUMMARY.md)
- **Instructions projet** : [`CLAUDE.md`](CLAUDE.md)

### n8n Resources
- **Documentation officielle** : https://docs.n8n.io
- **Community Forum** : https://community.n8n.io
- **n8n MCP Tools** : Intégré dans le projet

### Supabase Resources
- **Documentation officielle** : https://supabase.com/docs
- **SQL Reference** : https://supabase.com/docs/guides/database

---

## 📝 Changelog

### [1.0.0] - 2026-02-15
**Initial Release**

**Ajouté** :
- ✨ Workflow complet avec 10 nœuds
- ✨ Support CSV et JSON
- ✨ Enrichissement intelligent par matching
- ✨ Nettoyage automatique (doublons, lignes vides)
- ✨ Intégration Supabase avec upsert
- ✨ Documentation complète (4 fichiers)
- ✨ Schéma SQL avec vues et fonctions
- ✨ Données de test (CSV + JSON)

**Fichiers créés** :
- `workflow_enrichissement_leboncoin.json`
- `supabase_schema.sql`
- `WORKFLOW_ENRICHISSEMENT_README.md`
- `QUICKSTART.md`
- `IMPLEMENTATION_SUMMARY.md`
- `test_data_sample.csv`
- `test_data_sample.json`
- `README_WORKFLOW.md` (ce fichier)

---

## 🏆 Crédits

**Créé avec** :
- 🤖 Claude Sonnet 4.5
- 🔧 n8n MCP Tools
- 📚 n8n Skills Plugin

**Pour** : WSP V1 - Application d'enrichissement d'annonces

**Licence** : Propriétaire (usage interne)

---

## 🎉 Prêt à Commencer ?

1. **Nouveau ?** → Lisez [`QUICKSTART.md`](QUICKSTART.md)
2. **Curieux ?** → Lisez [`WORKFLOW_ENRICHISSEMENT_README.md`](WORKFLOW_ENRICHISSEMENT_README.md)
3. **Pressé ?** → Importez `workflow_enrichissement_leboncoin.json` et testez !

---

**Made with ❤️ for WSP V1**

**Version** : 1.0.0
**Date** : 2026-02-15
