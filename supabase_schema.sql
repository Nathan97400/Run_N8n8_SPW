-- ============================================================
-- Schéma Supabase pour Workflow Enrichissement Leboncoin
-- Application: WSP V1
-- Version: 1.0.0
-- Date: 2026-02-15
-- ============================================================

-- Suppression de la table si elle existe (ATTENTION: perte de données)
-- Décommenter uniquement si vous voulez réinitialiser
-- DROP TABLE IF EXISTS annonces_motos CASCADE;

-- ============================================================
-- Table principale: annonces_motos
-- ============================================================

CREATE TABLE IF NOT EXISTS annonces_motos (
  -- Clé primaire
  id BIGSERIAL PRIMARY KEY,

  -- Données de l'annonce (colonnes originales)
  url_annonce TEXT UNIQUE NOT NULL,
  titre TEXT,
  marque_annonce TEXT,
  prix TEXT,
  date_publication TEXT,
  kilometrage TEXT,
  annee TEXT,
  description TEXT,
  localisation TEXT,
  vendeur TEXT,

  -- Données enrichies (depuis BDD Modèles)
  marque_enrichie TEXT,
  modele_enrichi TEXT,
  annees_production TEXT,
  cylindree INTEGER,
  type_moto CHAR(1) CHECK (type_moto IN ('M', 'S', 'E', NULL)),
  coloris TEXT,

  -- Métadonnées de matching
  match_found BOOLEAN DEFAULT FALSE,
  match_confidence VARCHAR(20) CHECK (match_confidence IN ('high', 'medium', 'low', 'none', NULL)),

  -- Timestamps
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Index pour optimiser les requêtes
-- ============================================================

-- Index sur l'URL (clé unique, déjà créé automatiquement)
-- CREATE UNIQUE INDEX idx_url_annonce ON annonces_motos(url_annonce);

-- Index sur la marque enrichie (requêtes fréquentes par marque)
CREATE INDEX IF NOT EXISTS idx_marque_enrichie ON annonces_motos(marque_enrichie);

-- Index sur le modèle enrichi (requêtes fréquentes par modèle)
CREATE INDEX IF NOT EXISTS idx_modele_enrichi ON annonces_motos(modele_enrichi);

-- Index sur la date de traitement (pour récupérer les annonces récentes)
CREATE INDEX IF NOT EXISTS idx_processed_at ON annonces_motos(processed_at DESC);

-- Index sur match_found (filtrer annonces enrichies vs non enrichies)
CREATE INDEX IF NOT EXISTS idx_match_found ON annonces_motos(match_found);

-- Index composite marque + modèle (requêtes combinées)
CREATE INDEX IF NOT EXISTS idx_marque_modele ON annonces_motos(marque_enrichie, modele_enrichi);

-- Index sur la localisation (recherche géographique)
CREATE INDEX IF NOT EXISTS idx_localisation ON annonces_motos(localisation);

-- ============================================================
-- Trigger pour mettre à jour automatiquement updated_at
-- ============================================================

-- Fonction trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS update_annonces_motos_updated_at ON annonces_motos;
CREATE TRIGGER update_annonces_motos_updated_at
  BEFORE UPDATE ON annonces_motos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS) - OPTIONNEL
-- ============================================================

-- Activer RLS (recommandé pour la sécurité)
-- ALTER TABLE annonces_motos ENABLE ROW LEVEL SECURITY;

-- Politique: Lecture publique (tout le monde peut lire)
-- CREATE POLICY "Enable read access for all users" ON annonces_motos
--   FOR SELECT
--   USING (true);

-- Politique: Écriture authentifiée (seulement utilisateurs authentifiés)
-- CREATE POLICY "Enable insert for authenticated users only" ON annonces_motos
--   FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');

-- Politique: Mise à jour authentifiée
-- CREATE POLICY "Enable update for authenticated users only" ON annonces_motos
--   FOR UPDATE
--   USING (auth.role() = 'authenticated');

-- Politique: Suppression authentifiée
-- CREATE POLICY "Enable delete for authenticated users only" ON annonces_motos
--   FOR DELETE
--   USING (auth.role() = 'authenticated');

-- ============================================================
-- Vues utiles pour l'analyse
-- ============================================================

-- Vue: Statistiques par marque
CREATE OR REPLACE VIEW stats_par_marque AS
SELECT
  marque_enrichie,
  COUNT(*) AS total_annonces,
  COUNT(CASE WHEN match_found = TRUE THEN 1 END) AS annonces_enrichies,
  ROUND(
    100.0 * COUNT(CASE WHEN match_found = TRUE THEN 1 END) / COUNT(*),
    2
  ) AS taux_enrichissement_pct,
  MIN(created_at) AS premiere_annonce,
  MAX(created_at) AS derniere_annonce
FROM annonces_motos
WHERE marque_enrichie IS NOT NULL
GROUP BY marque_enrichie
ORDER BY total_annonces DESC;

-- Vue: Annonces récentes enrichies
CREATE OR REPLACE VIEW annonces_recentes_enrichies AS
SELECT
  id,
  titre,
  marque_enrichie,
  modele_enrichi,
  prix,
  annees_production,
  cylindree,
  localisation,
  url_annonce,
  processed_at
FROM annonces_motos
WHERE match_found = TRUE
ORDER BY processed_at DESC
LIMIT 100;

-- Vue: Annonces non enrichies (nécessitent attention)
CREATE OR REPLACE VIEW annonces_non_enrichies AS
SELECT
  id,
  titre,
  marque_annonce,
  prix,
  localisation,
  url_annonce,
  processed_at
FROM annonces_motos
WHERE match_found = FALSE
ORDER BY processed_at DESC;

-- ============================================================
-- Fonctions utiles pour l'analyse
-- ============================================================

-- Fonction: Compter annonces par période
CREATE OR REPLACE FUNCTION count_annonces_by_period(
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  total_annonces BIGINT,
  annonces_enrichies BIGINT,
  taux_enrichissement NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_annonces,
    COUNT(CASE WHEN match_found = TRUE THEN 1 END)::BIGINT AS annonces_enrichies,
    ROUND(
      100.0 * COUNT(CASE WHEN match_found = TRUE THEN 1 END) / NULLIF(COUNT(*), 0),
      2
    ) AS taux_enrichissement
  FROM annonces_motos
  WHERE processed_at BETWEEN period_start AND period_end;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Top N modèles par popularité
CREATE OR REPLACE FUNCTION top_modeles(n INTEGER DEFAULT 10)
RETURNS TABLE (
  marque TEXT,
  modele TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    marque_enrichie::TEXT,
    modele_enrichi::TEXT,
    COUNT(*)::BIGINT
  FROM annonces_motos
  WHERE match_found = TRUE
    AND modele_enrichi IS NOT NULL
  GROUP BY marque_enrichie, modele_enrichi
  ORDER BY COUNT(*) DESC
  LIMIT n;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Données de test (OPTIONNEL)
-- ============================================================

-- INSERT INTO annonces_motos (
--   url_annonce,
--   titre,
--   marque_annonce,
--   prix,
--   marque_enrichie,
--   modele_enrichi,
--   annees_production,
--   cylindree,
--   type_moto,
--   match_found,
--   match_confidence,
--   processed_at
-- ) VALUES
-- (
--   'https://www.leboncoin.fr/motos/test001',
--   'KTM 690 Duke R 2020',
--   'KTM',
--   '5 990 €',
--   'KTM',
--   '690 Duke R',
--   '2012 → 2019',
--   690,
--   'M',
--   TRUE,
--   'high',
--   NOW()
-- ),
-- (
--   'https://www.leboncoin.fr/motos/test002',
--   'Honda CB500F',
--   'Honda',
--   '4 500 €',
--   'Honda',
--   'CB500F',
--   '2013 → 2023',
--   471,
--   'M',
--   TRUE,
--   'high',
--   NOW()
-- );

-- ============================================================
-- Requêtes d'analyse utiles
-- ============================================================

-- 1. Nombre total d'annonces
-- SELECT COUNT(*) FROM annonces_motos;

-- 2. Taux d'enrichissement global
-- SELECT
--   COUNT(*) AS total,
--   COUNT(CASE WHEN match_found = TRUE THEN 1 END) AS enrichies,
--   ROUND(100.0 * COUNT(CASE WHEN match_found = TRUE THEN 1 END) / COUNT(*), 2) AS taux_pct
-- FROM annonces_motos;

-- 3. Top 10 marques
-- SELECT * FROM stats_par_marque LIMIT 10;

-- 4. Top 10 modèles
-- SELECT * FROM top_modeles(10);

-- 5. Annonces des dernières 24h
-- SELECT COUNT(*)
-- FROM annonces_motos
-- WHERE processed_at > NOW() - INTERVAL '24 hours';

-- 6. Distribution par type de moto
-- SELECT
--   CASE type_moto
--     WHEN 'M' THEN 'Moto'
--     WHEN 'S' THEN 'Scooter'
--     WHEN 'E' THEN 'Électrique'
--     ELSE 'Non spécifié'
--   END AS type,
--   COUNT(*)
-- FROM annonces_motos
-- WHERE match_found = TRUE
-- GROUP BY type_moto
-- ORDER BY COUNT(*) DESC;

-- ============================================================
-- Maintenance
-- ============================================================

-- Vacuum (à exécuter périodiquement pour optimiser)
-- VACUUM ANALYZE annonces_motos;

-- Reindex (si performances dégradées)
-- REINDEX TABLE annonces_motos;

-- ============================================================
-- Commentaires sur les colonnes (documentation)
-- ============================================================

COMMENT ON TABLE annonces_motos IS 'Annonces de motos du Leboncoin avec enrichissement automatique';
COMMENT ON COLUMN annonces_motos.id IS 'Identifiant unique auto-incrémenté';
COMMENT ON COLUMN annonces_motos.url_annonce IS 'URL unique de l''annonce (clé de déduplication)';
COMMENT ON COLUMN annonces_motos.titre IS 'Titre de l''annonce tel que publié';
COMMENT ON COLUMN annonces_motos.marque_annonce IS 'Marque extraite de l''annonce (non validée)';
COMMENT ON COLUMN annonces_motos.marque_enrichie IS 'Marque validée via BDD Modèles';
COMMENT ON COLUMN annonces_motos.modele_enrichi IS 'Modèle identifié par matching intelligent';
COMMENT ON COLUMN annonces_motos.annees_production IS 'Période de production (format: "YYYY → YYYY")';
COMMENT ON COLUMN annonces_motos.cylindree IS 'Cylindrée en cm³';
COMMENT ON COLUMN annonces_motos.type_moto IS 'Type: M (Moto), S (Scooter), E (Électrique)';
COMMENT ON COLUMN annonces_motos.match_found IS 'TRUE si enrichissement réussi, FALSE sinon';
COMMENT ON COLUMN annonces_motos.match_confidence IS 'Niveau de confiance du matching: high, medium, low, none';
COMMENT ON COLUMN annonces_motos.processed_at IS 'Date/heure du traitement par le workflow n8n';
COMMENT ON COLUMN annonces_motos.created_at IS 'Date/heure de création de l''enregistrement';
COMMENT ON COLUMN annonces_motos.updated_at IS 'Date/heure de dernière mise à jour';

-- ============================================================
-- Fin du script
-- ============================================================

-- Afficher un message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Schéma créé avec succès !';
  RAISE NOTICE 'Table: annonces_motos';
  RAISE NOTICE 'Index: 6 index créés';
  RAISE NOTICE 'Vues: 3 vues analytiques';
  RAISE NOTICE 'Fonctions: 2 fonctions utilitaires';
END $$;
