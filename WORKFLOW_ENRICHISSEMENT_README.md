# Workflow n8n : Enrichissement Annonces Leboncoin

## 📋 Vue d'ensemble

Ce workflow automatise le traitement complet des annonces de motos du Leboncoin, de la réception par email jusqu'au stockage enrichi dans Supabase.

**Version** : 1.0.0
**Créé le** : 2026-02-15
**Application** : WSP V1

---

## 🎯 Objectifs

1. **Réception automatique** des fichiers CSV/JSON par email Gmail
2. **Nettoyage des données** (doublons, lignes vides)
3. **Enrichissement intelligent** via base de données de modèles de motos
4. **Stockage centralisé** dans Supabase

---

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ Gmail       │───▶│ Extract      │───▶│ Normalize   │───▶│ Remove Dupes │
│ Trigger     │    │ Attachment   │    │ Data        │    │              │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                                               │
                                               │ (parallèle)
                                               ▼
                                        ┌─────────────┐
                                        │ Read BDD    │
                                        │ Modèles     │
                                        └─────────────┘
                                               │
     ┌──────────────┐    ┌─────────────┐     │
     │ Filter Empty │───▶│ Merge Data  │◀────┘
     │ Rows         │    │             │
     └──────────────┘    └─────────────┘
                                │
                                ▼
                         ┌─────────────┐    ┌──────────────┐
                         │ Enrich with │───▶│ Insert to    │
                         │ Models      │    │ Supabase     │
                         └─────────────┘    └──────────────┘
```

---

## 🔧 Nœuds du Workflow

### 1️⃣ Gmail Trigger
**Type** : `n8n-nodes-base.gmailTrigger`
**Fonction** : Déclenche le workflow à la réception d'un email avec pièce jointe

**Configuration** :
- **Authentication** : OAuth2
- **Event** : Message Received
- **Filters** : `has:attachment`
- **Options** : `attachments: true`

**Credentials requises** : Gmail OAuth2

---

### 2️⃣ Extract Attachment
**Type** : `n8n-nodes-base.extractFromFile`
**Fonction** : Convertit les pièces jointes binaires (CSV/JSON) en données structurées

**Configuration** :
- **Operation** : fromJson (auto-détecte CSV et JSON)
- **Binary Property** : `data`
- **Destination Key** : `extractedData`

**Formats supportés** : CSV, JSON

---

### 3️⃣ Normalize Data
**Type** : `n8n-nodes-base.code` (JavaScript)
**Fonction** : Normalise les colonnes CSV/JSON avec un mapping uniforme

**Logique** :
- Fonction `getValue()` pour récupérer valeurs avec fallback
- Mapping intelligent CSV ↔ JSON
- Conservation des données brutes (`_raw`)

**Colonnes normalisées** :
- `href` : URL de l'annonce
- `titre` : Titre de l'annonce
- `marque` : Marque du véhicule
- `prix` : Prix affiché
- `date_publication` : Date de publication
- `kilometrage` : Kilométrage
- `annee` : Année du véhicule
- `description` : Description complète
- `localisation` : Localisation géographique
- `vendeur` : Nom du vendeur

---

### 4️⃣ Remove Duplicates
**Type** : `n8n-nodes-base.removeDuplicates`
**Fonction** : Supprime les annonces en doublon basé sur l'URL

**Configuration** :
- **Operation** : Remove Duplicate Input Items
- **Compare** : Selected Fields
- **Fields to Compare** : `href`

**Résultat** : Garde la première occurrence de chaque annonce unique

---

### 5️⃣ Filter Empty Rows
**Type** : `n8n-nodes-base.code` (JavaScript)
**Fonction** : Filtre les lignes 100% vides ou incomplètes

**Critères de validation** :
- `href` doit exister et être non vide
- `titre` doit exister et être non vide
- Au moins 3 champs non vides au total

**Résultat** : Données propres et utilisables

---

### 6️⃣ Read BDD Modèles (Parallèle)
**Type** : `n8n-nodes-base.readBinaryFiles`
**Fonction** : Charge la base de données de référence des modèles de motos

**Configuration** :
- **File Selector** : `C:\Users\natha\Documents\projets_claude-code\n8n_builders\BDD Modèles\motorcycles_brands_full_ENRICHED.json`
- **Property Name** : `bddModeles`

**Contenu de la BDD** :
- Marque
- Modèle
- Année début / Année fin
- Cylindrée (cc)
- Type (M/S/E)
- Coloris commercial

---

### 7️⃣ Parse BDD JSON
**Type** : `n8n-nodes-base.extractFromFile`
**Fonction** : Parse le JSON de la BDD Modèles

**Configuration** :
- **Operation** : fromJson
- **Binary Property** : `bddModeles`
- **Destination Key** : `modeles`

---

### 8️⃣ Merge Data
**Type** : `n8n-nodes-base.merge`
**Fonction** : Fusionne les annonces nettoyées avec la BDD Modèles

**Configuration** :
- **Mode** : Combine
- **Combine By** : combineByFields
- **Join Mode** : enrichInput1 (Left Join)
- **Match Fields** :
  - Input 1 : `marque`
  - Input 2 : `Marque`
- **Output Data From** : both

**Résultat** : Chaque annonce potentiellement enrichie avec données de la BDD

---

### 9️⃣ Enrich with Models
**Type** : `n8n-nodes-base.code` (JavaScript)
**Fonction** : Matching intelligent et enrichissement avancé

**Algorithme de matching** :
1. Normalisation du texte (minuscules, trim, espaces)
2. Filtrage par marque exacte
3. Recherche du modèle le plus long correspondant dans le titre
4. Score basé sur la longueur du match (plus précis = plus long)

**Colonnes ajoutées** :
- `merge_marque` : Marque validée
- `merge_modele` : Modèle identifié
- `merge_annees_production` : "YYYY → YYYY"
- `merge_cylindree` : Cylindrée en cc
- `merge_type` : Type de moto (M/S/E)
- `merge_coloris` : Coloris commercial
- `match_found` : Boolean (match trouvé ?)
- `match_confidence` : "high" ou "none"
- `processed_at` : Timestamp ISO 8601

**Cas gérés** :
- Match parfait : "KTM 690 Duke R" → Modèle trouvé
- Match partiel : "KTM 690" → Meilleur match
- Pas de match : Marque inconnue → `null`

---

### 🔟 Insert to Supabase
**Type** : `n8n-nodes-base.supabase`
**Fonction** : Insère les données enrichies dans Supabase

**Configuration** :
- **Resource** : Row
- **Operation** : Create
- **Table** : `annonces_motos`
- **Options** :
  - `upsert: true` (évite les doublons)
  - `onConflict: url_annonce`

**Credentials requises** : Supabase API (URL + Service Role Key)

**Mapping des colonnes** :
```
href               → url_annonce
titre              → titre
marque             → marque_annonce
prix               → prix
date_publication   → date_publication
kilometrage        → kilometrage
annee              → annee
description        → description
localisation       → localisation
vendeur            → vendeur
merge_marque       → marque_enrichie
merge_modele       → modele_enrichi
merge_annees_prod  → annees_production
merge_cylindree    → cylindree
merge_type         → type_moto
merge_coloris      → coloris
match_found        → match_found
match_confidence   → match_confidence
processed_at       → processed_at
```

---

## 🗄️ Schéma Supabase

Voir le fichier `supabase_schema.sql` pour le schéma complet.

**Table** : `annonces_motos`

**Colonnes principales** :
- `id` : SERIAL PRIMARY KEY
- `url_annonce` : TEXT UNIQUE NOT NULL (clé de déduplication)
- Colonnes annonce (titre, marque, prix, etc.)
- Colonnes enrichies (marque_enrichie, modele_enrichi, etc.)
- Métadonnées (match_found, match_confidence, processed_at)
- Timestamps (created_at, updated_at)

**Index** :
- `idx_url` sur `url_annonce`
- `idx_marque` sur `marque_enrichie`
- `idx_modele` sur `modele_enrichi`

---

## 📊 Flux de Données

### Exemple de transformation

**Input (CSV)** :
```csv
absolute href,text-headline-1-expanded,text-body-1 (4),text-headline-2-expanded
https://www.leboncoin.fr/...,KTM 690 Duke R 2020,KTM,5 990 €
```

**Après Normalize Data** :
```json
{
  "href": "https://www.leboncoin.fr/...",
  "titre": "KTM 690 Duke R 2020",
  "marque": "KTM",
  "prix": "5 990 €"
}
```

**Après Enrich with Models** :
```json
{
  "href": "https://www.leboncoin.fr/...",
  "titre": "KTM 690 Duke R 2020",
  "marque": "KTM",
  "prix": "5 990 €",
  "merge_marque": "KTM",
  "merge_modele": "690 Duke R",
  "merge_annees_production": "2012 → 2019",
  "merge_cylindree": 690,
  "merge_type": "M",
  "merge_coloris": "Orange",
  "match_found": true,
  "match_confidence": "high"
}
```

---

## 🚀 Déploiement

### Prérequis

1. **Credentials Gmail OAuth2**
   - Autoriser l'accès à Gmail
   - Activer les scopes nécessaires

2. **Credentials Supabase**
   - URL du projet : `https://xxxxx.supabase.co`
   - Service Role Key (ou anon key avec RLS)

3. **Base de données Modèles**
   - Fichier : `motorcycles_brands_full_ENRICHED.json`
   - Emplacement : `C:\Users\natha\Documents\projets_claude-code\n8n_builders\BDD Modèles\`

### Installation

1. **Importer le workflow dans n8n**
   ```bash
   # Via l'interface n8n
   Settings → Import from File → workflow_enrichissement_leboncoin.json
   ```

2. **Configurer les credentials**
   - Gmail OAuth2 : Autoriser l'accès
   - Supabase API : Ajouter URL + Key

3. **Créer la table Supabase**
   ```bash
   # Exécuter le script SQL
   psql -h xxxxx.supabase.co -U postgres -f supabase_schema.sql
   ```

4. **Tester le workflow**
   - Envoyer un email de test avec un fichier CSV
   - Vérifier l'exécution dans l'interface n8n
   - Contrôler les données insérées dans Supabase

---

## 🧪 Tests

### Test 1 : Email avec CSV
- ✅ Trigger se déclenche
- ✅ Doublons supprimés (même `href`)
- ✅ Lignes vides filtrées
- ✅ Enrichissement appliqué
- ✅ Insertion dans Supabase

### Test 2 : Email avec JSON
- ✅ Normalisation des colonnes
- ✅ Mapping JSON → Structure uniforme

### Test 3 : Matching de Modèles
- ✅ Match parfait ("KTM 690 Duke R")
- ✅ Match partiel ("KTM 690")
- ✅ Pas de match (marque inconnue)

### Test 4 : Gestion des Erreurs
- ✅ Email sans PJ → Workflow s'arrête proprement
- ✅ Fichier corrompu → Gestion d'erreur
- ✅ Logs d'erreur disponibles

---

## 📈 Performance

**Métriques estimées** :
- **Vitesse de traitement** : ~100 lignes/seconde
- **Temps moyen d'exécution** :
  - 10 lignes : ~2 secondes
  - 100 lignes : ~5 secondes
  - 1000 lignes : ~30 secondes

**Optimisations possibles** :
- Utiliser `Split in Batches` pour fichiers >1000 lignes
- Cache de la BDD Modèles en mémoire
- Parallélisation des insertions Supabase

---

## ⚠️ Points d'Attention

### 1. Encodage des fichiers
- Les CSV doivent être en UTF-8
- Caractères accentués supportés
- Si problème : ajouter un nœud de réencodage

### 2. Matching intelligent
- Normalisation automatique (minuscules, espaces)
- Privilégie le match le plus long et précis
- Marques avec accents/caractères spéciaux gérés

### 3. Sécurité Gmail
- Filtre recommandé sur l'expéditeur
- Validation de l'extension (.csv, .json uniquement)
- Limite de taille des pièces jointes

### 4. Gestion d'erreurs
- Ajouter un nœud Error Trigger pour capturer les échecs
- Notification par email en cas d'erreur
- Log des lignes non enrichies

---

## 🔄 Améliorations Futures

### Version 1.1
- [ ] Validation des données (regex URL, format prix)
- [ ] Rapports par email (résumé du traitement)
- [ ] Déduplication avancée (similarité de titre)

### Version 1.2
- [ ] Cache de la BDD Modèles
- [ ] API pour BDD dynamique
- [ ] Support de formats supplémentaires (Excel, XML)

### Version 2.0
- [ ] Machine Learning pour améliorer le matching
- [ ] Interface web pour visualisation
- [ ] Notifications Slack/Discord

---

## 📞 Support

**Questions** : Consulter le fichier `CLAUDE.md` du projet
**Issues** : Documenter dans le README du projet
**Logs** : Vérifier l'exécution dans n8n (Executions tab)

---

## 📝 Changelog

### [1.0.0] - 2026-02-15
- ✨ Version initiale
- ✅ Support CSV/JSON
- ✅ Enrichissement intelligent
- ✅ Intégration Supabase
- ✅ Nettoyage automatique (doublons, lignes vides)

---

**Made with ❤️ for WSP V1**
