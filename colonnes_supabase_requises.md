# Colonnes Requises pour la Table Supabase "n8n"

## Colonnes à Créer dans Supabase

Voici la liste complète des colonnes que votre table `n8n` doit contenir :

### 📌 Identité de l'Annonce
- `Nom_annonce` (text)
- `Url_Https` (text)
- `Statut_annonce` (text)

### 📅 Date & Heure
- `Date de mise en publication` (text ou date)
- `Heure de mise en publication` (text ou time)

### 💰 Prix
- `Prix_affiche` (text ou numeric)

### 📸 Photos
- `Photo_1` (text - URL)
- `Photo_2` (text - URL)
- `Photo_3` (text - URL)
- `nombre de photos supplémentaires` (integer)

### 🚗 Informations Véhicule
- `nom du vendeur pro` (text)
- `année du modèle` (text ou integer)
- `Kilométrage` (text)
- `Mise_en_circulation` (text ou date)
- `Cylindree_cc` (text ou numeric)

### 📝 Description
- `Description de l'annonce` (text)

### 👤 Informations Vendeur
- `Nom_vendeur` (text)
- `nombre d'avis` (text ou integer)
- `Dernière activité` (text)
- `Paiement_ou_SIREN` (text)
- `Infos_vendeur` (text)

### ⭐ Engagement
- `personnes ont déjà ajouté cette annonce en favori` (integer)

### 🎯 Matching & Scoring
- `matched_marque` (text)
- `matched_modele` (text)
- `matched_generations` (text)
- `generation_label` (text)
- `generation_year_start` (integer)
- `generation_year_end` (integer)
- `matched_score` (numeric ou text)
- `matched_quality` (text)
- `needs_review` (boolean)

---

## 🔍 SQL pour Créer la Table (Exemple)

```sql
CREATE TABLE n8n (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Identité annonce
  "Nom_annonce" TEXT,
  "Url_Https" TEXT,
  "Statut_annonce" TEXT,

  -- Date & Heure
  "Date de mise en publication" TEXT,
  "Heure de mise en publication" TEXT,

  -- Prix
  "Prix_affiche" TEXT,

  -- Photos
  "Photo_1" TEXT,
  "Photo_2" TEXT,
  "Photo_3" TEXT,
  "nombre de photos supplémentaires" INTEGER,

  -- Véhicule
  "nom du vendeur pro" TEXT,
  "année du modèle" TEXT,
  "Kilométrage" TEXT,
  "Mise_en_circulation" TEXT,
  "Cylindree_cc" TEXT,

  -- Description
  "Description de l'annonce" TEXT,

  -- Vendeur
  "Nom_vendeur" TEXT,
  "nombre d'avis" TEXT,
  "Dernière activité" TEXT,
  "Paiement_ou_SIREN" TEXT,
  "Infos_vendeur" TEXT,

  -- Engagement
  "personnes ont déjà ajouté cette annonce en favori" INTEGER,

  -- Matching
  "matched_marque" TEXT,
  "matched_modele" TEXT,
  "matched_generations" TEXT,
  "generation_label" TEXT,
  "generation_year_start" INTEGER,
  "generation_year_end" INTEGER,
  "matched_score" TEXT,
  "matched_quality" TEXT,
  "needs_review" BOOLEAN
);
```

---

**Note** : Certains types peuvent être ajustés selon vos besoins (TEXT vs VARCHAR, NUMERIC vs DECIMAL, etc.)
