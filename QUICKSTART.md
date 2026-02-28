# 🚀 Guide de Démarrage Rapide

## Workflow : Enrichissement Annonces Leboncoin

Ce guide vous permet de déployer et utiliser le workflow en 10 minutes.

---

## ✅ Checklist de Déploiement

- [ ] **1. Importer le workflow dans n8n**
- [ ] **2. Configurer les credentials Gmail**
- [ ] **3. Configurer les credentials Supabase**
- [ ] **4. Créer la table Supabase**
- [ ] **5. Vérifier le chemin de la BDD Modèles**
- [ ] **6. Tester le workflow**

---

## 📝 Étape par Étape

### 1️⃣ Importer le Workflow

**Dans n8n** :
1. Aller dans `Workflows` → bouton `+`
2. Cliquer sur `Import from File`
3. Sélectionner `workflow_enrichissement_leboncoin.json`
4. Cliquer sur `Import`

✅ Le workflow apparaît avec 10 nœuds.

---

### 2️⃣ Configurer Gmail OAuth2

**Dans n8n** :
1. Cliquer sur le nœud `Gmail Trigger`
2. Cliquer sur `Credentials` → `Create New`
3. Choisir `Gmail OAuth2`
4. Suivre le processus d'authentification Google
5. Autoriser l'accès à Gmail
6. Sauvegarder

✅ Vous devriez voir "Connected" en vert.

**Optionnel** : Ajouter un filtre sur l'expéditeur pour la sécurité :
```json
{
  "filters": {
    "q": "has:attachment from:votre-email@example.com"
  }
}
```

---

### 3️⃣ Configurer Supabase

**Obtenir les credentials Supabase** :
1. Aller sur [Supabase Dashboard](https://app.supabase.com)
2. Sélectionner votre projet (ou créer un nouveau)
3. Aller dans `Settings` → `API`
4. Copier :
   - `URL` (Project URL)
   - `anon/public key` OU `service_role key` (recommandé)

**Dans n8n** :
1. Cliquer sur le nœud `Insert to Supabase`
2. Cliquer sur `Credentials` → `Create New`
3. Choisir `Supabase API`
4. Coller :
   - **Host** : L'URL du projet (ex: `https://xxxxx.supabase.co`)
   - **Service Role Secret** : La clé API
5. Sauvegarder

✅ Vous devriez voir "Connected" en vert.

---

### 4️⃣ Créer la Table Supabase

**Option A : Via l'interface Supabase (recommandé)**
1. Aller dans `Table Editor` → `New table`
2. Copier le contenu de `supabase_schema.sql`
3. Aller dans `SQL Editor` → `New query`
4. Coller le script SQL
5. Cliquer sur `Run`

**Option B : Via psql (ligne de commande)**
```bash
psql -h xxxxx.supabase.co -U postgres -f supabase_schema.sql
```

✅ La table `annonces_motos` est créée avec tous les index.

**Vérification** :
```sql
SELECT COUNT(*) FROM annonces_motos;
-- Résultat attendu: 0 (table vide)
```

---

### 5️⃣ Vérifier le Chemin BDD Modèles

**Dans n8n** :
1. Cliquer sur le nœud `Read BDD Modèles`
2. Vérifier le `File Selector` :
   ```
   C:\Users\natha\Documents\projets_claude-code\n8n_builders\BDD Modèles\motorcycles_brands_full_ENRICHED.json
   ```
3. **Si le chemin est différent** : Modifier avec le chemin absolu correct

**Vérification du fichier** :
```bash
# Windows
dir "C:\Users\natha\Documents\projets_claude-code\n8n_builders\BDD Modèles\motorcycles_brands_full_ENRICHED.json"

# Linux/Mac
ls -la /path/to/motorcycles_brands_full_ENRICHED.json
```

✅ Le fichier doit exister et être accessible.

---

### 6️⃣ Tester le Workflow

#### Test Automatique (Email de test)

**Préparer un fichier CSV de test** :
```csv
absolute href,text-headline-1-expanded,text-body-1 (4),text-headline-2-expanded
https://www.leboncoin.fr/test001,KTM 690 Duke R 2020,KTM,5990€
https://www.leboncoin.fr/test002,Honda CB500F 2018,Honda,4500€
https://www.leboncoin.fr/test003,Yamaha MT-07,Yamaha,6200€
```

**Envoyer l'email** :
1. Créer un nouveau email
2. Attacher le fichier CSV
3. Envoyer à l'adresse Gmail configurée

**Vérifier l'exécution** :
1. Dans n8n, aller dans `Executions`
2. Attendre quelques secondes (polling interval)
3. Vous devriez voir une nouvelle exécution
4. Vérifier que tous les nœuds sont en vert ✅

**Vérifier dans Supabase** :
```sql
SELECT * FROM annonces_motos ORDER BY created_at DESC LIMIT 10;
```

✅ Vous devriez voir vos 3 annonces enrichies.

---

#### Test Manuel (Sans email)

**Dans n8n** :
1. Désactiver temporairement le `Gmail Trigger`
2. Ajouter un nœud `Manual Trigger` en première position
3. Ajouter un nœud `Read Binary Files` pour charger le CSV
4. Cliquer sur `Execute Workflow` (bouton ▶️ en haut à droite)

✅ Le workflow s'exécute immédiatement sans attendre un email.

---

## 🔍 Vérifications Post-Déploiement

### Vérification 1 : Workflow actif

```
Dans n8n → Workflows → Votre workflow
Status : Active ✅
```

### Vérification 2 : Données dans Supabase

```sql
-- Nombre total d'annonces
SELECT COUNT(*) FROM annonces_motos;

-- Taux d'enrichissement
SELECT
  COUNT(*) AS total,
  COUNT(CASE WHEN match_found = TRUE THEN 1 END) AS enrichies,
  ROUND(100.0 * COUNT(CASE WHEN match_found = TRUE THEN 1 END) / COUNT(*), 2) AS taux
FROM annonces_motos;
```

### Vérification 3 : Logs du workflow

```
Dans n8n → Executions
- Vérifier qu'il n'y a pas d'erreurs
- Vérifier le nombre d'items traités à chaque étape
```

---

## ⚠️ Problèmes Courants

### Problème 1 : "Authentication failed" (Gmail)

**Solution** :
- Réauthentifier Gmail OAuth2
- Vérifier que les scopes Gmail sont autorisés
- Tester avec un compte Google Workspace (non Gmail.com)

### Problème 2 : "File not found" (BDD Modèles)

**Solution** :
- Vérifier que le chemin est absolu (pas relatif)
- Vérifier les permissions du fichier
- Sur Windows, utiliser `\\` ou `/` (pas de mélange)

### Problème 3 : "Table does not exist" (Supabase)

**Solution** :
- Exécuter le script SQL `supabase_schema.sql`
- Vérifier le nom de la table : `annonces_motos` (exactement)
- Vérifier que vous êtes connecté au bon projet Supabase

### Problème 4 : "Duplicate key error" (Supabase)

**Explication** : Normal ! C'est le système de déduplication qui fonctionne.

**Solution** :
- Si vous voulez réimporter : Supprimer les données existantes
- Ou : Laisser le `upsert: true` faire son travail (mise à jour au lieu d'insertion)

### Problème 5 : Aucun enrichissement (match_found = false)

**Causes possibles** :
- BDD Modèles vide ou mal formatée
- Marques avec orthographe différente (ex: "Ktm" vs "KTM")
- Normalisation échoue (caractères spéciaux)

**Solution** :
- Vérifier le contenu de `motorcycles_brands_full_ENRICHED.json`
- Ajouter des `console.log()` dans le Code node "Enrich with Models"
- Vérifier les logs dans la console du navigateur

---

## 📊 Premiers Pas avec les Données

### Requête 1 : Top 10 marques

```sql
SELECT marque_enrichie, COUNT(*) AS total
FROM annonces_motos
WHERE match_found = TRUE
GROUP BY marque_enrichie
ORDER BY total DESC
LIMIT 10;
```

### Requête 2 : Modèles les plus populaires

```sql
SELECT marque_enrichie, modele_enrichi, COUNT(*) AS total
FROM annonces_motos
WHERE match_found = TRUE
  AND modele_enrichi IS NOT NULL
GROUP BY marque_enrichie, modele_enrichi
ORDER BY total DESC
LIMIT 20;
```

### Requête 3 : Annonces non enrichies (à investiguer)

```sql
SELECT titre, marque_annonce, url_annonce
FROM annonces_motos
WHERE match_found = FALSE
ORDER BY created_at DESC
LIMIT 10;
```

### Requête 4 : Statistiques globales

```sql
SELECT * FROM stats_par_marque;
```

---

## 🎯 Prochaines Étapes

1. **Automatiser l'envoi quotidien**
   - Configurer un script de scraping
   - Envoyer automatiquement par email chaque jour

2. **Créer un dashboard**
   - Utiliser Metabase / Grafana / Superset
   - Connecter à Supabase
   - Visualiser les tendances

3. **Améliorer le matching**
   - Ajouter plus de modèles dans la BDD
   - Affiner l'algorithme de normalisation
   - Tester avec des données réelles

4. **Notifications**
   - Ajouter un nœud Email/Slack pour être notifié
   - Envoyer un résumé quotidien

---

## 📞 Besoin d'Aide ?

**Documentation complète** : Voir `WORKFLOW_ENRICHISSEMENT_README.md`

**Schéma SQL** : Voir `supabase_schema.sql`

**Workflow JSON** : Voir `workflow_enrichissement_leboncoin.json`

**CLAUDE.md** : Instructions projet et context

---

## ✅ Checklist Finale

- [ ] Workflow importé et actif
- [ ] Gmail connecté et testé
- [ ] Supabase connecté et table créée
- [ ] Chemin BDD Modèles correct
- [ ] Test avec email réussi
- [ ] Données visibles dans Supabase
- [ ] Taux d'enrichissement > 50%
- [ ] Aucune erreur dans les logs

---

**🎉 Félicitations ! Votre workflow est opérationnel !**

**Temps estimé de déploiement** : 10-15 minutes

**Prochain objectif** : Collecter 1000 annonces enrichies pour analyse

---

_Made with ❤️ for WSP V1_
