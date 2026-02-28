// ============================================
// SCORING DE COMPLÉTUDE - n8n Code Node
// ============================================
// Objectif : Évaluer la qualité des données entrantes pour router
//            intelligemment vers les nœuds Match appropriés
//
// Sortie : Score 0-100 + Tier (EXCELLENT/GOOD/MEDIUM/POOR/MINIMAL)
// ============================================

const items = $input.all();

// ============================================
// HELPERS
// ============================================

/**
 * Récupère une valeur de manière robuste
 */
function get(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

/**
 * Normalise un texte pour analyse
 */
function normalize(text) {
  if (!text) return "";
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Compte le nombre de mots significatifs (≥3 caractères)
 */
function countSignificantWords(text) {
  if (!text) return 0;
  const words = normalize(text).split(/\s+/);
  return words.filter(w => w.length >= 3).length;
}

/**
 * Vérifie si une valeur est présente et non vide
 */
function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

/**
 * Extrait u_moto_brand depuis href
 */
function extractBrandFromHref(href) {
  const h = String(href || "");
  if (!h) return "";
  const m = h.match(/u_moto_brand:([^+&]+)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch (e) {
    return m[1].replace(/\+/g, " ");
  }
}

/**
 * Extrait u_moto_model depuis href
 */
function extractModelFromHref(href) {
  const h = String(href || "");
  if (!h) return "";
  const m = h.match(/u_moto_model:([^+&]+)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch (e) {
    return m[1].replace(/\+/g, " ");
  }
}

/**
 * Extrait cubic_capacity depuis href
 */
function extractCCFromHref(href) {
  const h = String(href || "");
  const m = h.match(/cubic_capacity:(\d{2,4})/i);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Parse année depuis texte (format MM/YYYY ou YYYY)
 */
function parseYear(text) {
  const str = String(text || "").trim();
  if (!str) return 0;

  // MM/YYYY
  const mmyyyy = str.match(/\b(0?[1-9]|1[0-2])\s*\/\s*((19|20)\d{2})\b/);
  if (mmyyyy) return parseInt(mmyyyy[2], 10);

  // YYYY
  const yyyy = str.match(/\b(19|20)\d{2}\b/);
  if (yyyy) return parseInt(yyyy[0], 10);

  return 0;
}

// ============================================
// SCORING DE COMPLÉTUDE
// ============================================

/**
 * Calcule le score de complétude d'une annonce
 * Retourne un objet avec score (0-100) et détails
 */
function calculateCompletudeScore(item) {
  let score = 0;
  const details = {};

  // ────────────────────────────────────────────────────────
  // 1. MARQUE (25 points max)
  // ────────────────────────────────────────────────────────
  const brandField = get(item, "text-body-1 (2)", "annonce_brand_input", "Marque_scrap");
  const brandHref = get(item, "text-body-1 href (2)", "text-body-1 href");
  const brandFromHref = extractBrandFromHref(brandHref);

  if (brandFromHref) {
    // Marque depuis href LBC (le plus fiable)
    score += 25;
    details.brand_source = "href";
    details.brand_quality = "EXCELLENT";
  } else if (brandField) {
    // Marque depuis champ scraped
    score += 20;
    details.brand_source = "field";
    details.brand_quality = "GOOD";
  } else {
    details.brand_source = "missing";
    details.brand_quality = "NONE";
  }

  // ────────────────────────────────────────────────────────
  // 2. MODÈLE (20 points max)
  // ────────────────────────────────────────────────────────
  const modelHref = get(item, "text-body-1 href (3)");
  const modelFromHref = extractModelFromHref(modelHref);
  const modelField = get(item, "text-body-1 (3)");
  const versionField = get(item, "text-body-1 (8)"); // Version constructeur

  const modelNorm = normalize(modelFromHref);
  const isModelAutre = modelNorm === "autre" || modelNorm.includes(" autre");

  if (modelFromHref && !isModelAutre) {
    // Modèle depuis href LBC (non "autre")
    score += 20;
    details.model_source = "href";
    details.model_quality = "EXCELLENT";
  } else if (versionField && countSignificantWords(versionField) >= 2) {
    // Version constructeur riche (ex: "1050_Speed Triple 1050 ABS")
    score += 18;
    details.model_source = "version_field";
    details.model_quality = "VERY_GOOD";
  } else if (modelField) {
    // Champ modèle présent
    score += 12;
    details.model_source = "field";
    details.model_quality = "GOOD";
  } else if (versionField) {
    // Version constructeur pauvre
    score += 8;
    details.model_source = "version_field_weak";
    details.model_quality = "MEDIUM";
  } else {
    details.model_source = "missing";
    details.model_quality = "NONE";
  }

  // ────────────────────────────────────────────────────────
  // 3. CYLINDRÉE CC (15 points max)
  // ────────────────────────────────────────────────────────
  const ccHref = get(item, "text-body-1 href (5)");
  const ccFromHref = extractCCFromHref(ccHref);
  const ccField1 = get(item, "text-body-1 (7)");
  const ccField2 = get(item, "text-body-1 (13)", "vehicule_cc_txt", "CC", "cc");

  if (ccFromHref) {
    // CC depuis href LBC (le plus fiable)
    score += 15;
    details.cc_source = "href";
    details.cc_quality = "EXCELLENT";
  } else if (ccField1) {
    // Champ CC dédié (7)
    score += 12;
    details.cc_source = "field_primary";
    details.cc_quality = "GOOD";
  } else if (ccField2) {
    // Champ CC secondaire (13)
    score += 10;
    details.cc_source = "field_secondary";
    details.cc_quality = "MEDIUM";
  } else {
    details.cc_source = "missing";
    details.cc_quality = "NONE";
  }

  // ────────────────────────────────────────────────────────
  // 4. ANNÉE (10 points max)
  // ────────────────────────────────────────────────────────
  const year1 = get(item, "text-body-1 (4)", "Annee_du_modele");
  const year2 = get(item, "text-body-1 (9)", "Mise_en_circulation");

  const yearParsed1 = parseYear(year1);
  const yearParsed2 = parseYear(year2);

  if (yearParsed1 || yearParsed2) {
    score += 10;
    details.year_source = yearParsed1 ? "field_primary" : "field_secondary";
    details.year_quality = "GOOD";
  } else {
    details.year_source = "missing";
    details.year_quality = "NONE";
  }

  // ────────────────────────────────────────────────────────
  // 5. DESCRIPTION (15 points max)
  // ────────────────────────────────────────────────────────
  const desc = get(
    item,
    "annonce_description",
    "text-body-1 (17)",
    "text-body-1 (16)",
    "text-body-1 (14)",
    "Description_complete",
    "description"
  );

  const descWordCount = countSignificantWords(desc);

  if (descWordCount >= 50) {
    // Description très complète (≥50 mots)
    score += 15;
    details.description_length = descWordCount;
    details.description_quality = "EXCELLENT";
  } else if (descWordCount >= 20) {
    // Description complète (20-49 mots)
    score += 12;
    details.description_length = descWordCount;
    details.description_quality = "GOOD";
  } else if (descWordCount >= 10) {
    // Description moyenne (10-19 mots)
    score += 8;
    details.description_length = descWordCount;
    details.description_quality = "MEDIUM";
  } else if (descWordCount >= 5) {
    // Description pauvre (5-9 mots)
    score += 4;
    details.description_length = descWordCount;
    details.description_quality = "POOR";
  } else {
    details.description_length = descWordCount;
    details.description_quality = "NONE";
  }

  // ────────────────────────────────────────────────────────
  // 6. PHOTOS (5 points max)
  // ────────────────────────────────────────────────────────
  const photo1 = get(item, "size-full src", "Photo_1");
  const photo2 = get(item, "size-full src (2)", "Photo_2");
  const photo3 = get(item, "size-full src (3)", "Photo_3");

  const photoCount = [photo1, photo2, photo3].filter(p => isPresent(p)).length;

  if (photoCount >= 3) {
    score += 5;
    details.photo_count = photoCount;
    details.photo_quality = "EXCELLENT";
  } else if (photoCount === 2) {
    score += 4;
    details.photo_count = photoCount;
    details.photo_quality = "GOOD";
  } else if (photoCount === 1) {
    score += 2;
    details.photo_count = photoCount;
    details.photo_quality = "MEDIUM";
  } else {
    details.photo_count = 0;
    details.photo_quality = "NONE";
  }

  // ────────────────────────────────────────────────────────
  // 7. TITRE (10 points max)
  // ────────────────────────────────────────────────────────
  const title = get(
    item,
    "text-headline-1-expanded",
    "annonce_title",
    "relative"
  );

  const titleWordCount = countSignificantWords(title);

  if (titleWordCount >= 5) {
    // Titre riche (≥5 mots significatifs)
    score += 10;
    details.title_length = titleWordCount;
    details.title_quality = "EXCELLENT";
  } else if (titleWordCount >= 3) {
    // Titre moyen (3-4 mots)
    score += 7;
    details.title_length = titleWordCount;
    details.title_quality = "GOOD";
  } else if (titleWordCount >= 1) {
    // Titre pauvre (1-2 mots)
    score += 3;
    details.title_length = titleWordCount;
    details.title_quality = "POOR";
  } else {
    details.title_length = 0;
    details.title_quality = "NONE";
  }

  // ────────────────────────────────────────────────────────
  // TOTAL : 100 points max
  // ────────────────────────────────────────────────────────
  details.total_score = score;

  return { score, details };
}

/**
 * Détermine le tier de qualité basé sur le score
 */
function determineTier(score) {
  if (score >= 80) return "EXCELLENT";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "POOR";
  return "MINIMAL";
}

/**
 * Détermine le nœud Match recommandé
 */
function determineRecommendedMatch(score, tier) {
  if (tier === "EXCELLENT") return "1st Match";
  if (tier === "GOOD") return "2nd Match";
  if (tier === "MEDIUM") return "3rd Match";
  if (tier === "POOR") return "4th Match";
  return "5th Match";
}

/**
 * Calcule un flag de priorité pour le routing
 */
function calculatePriority(score, details) {
  // Priorité haute si :
  // - Score ≥ 70
  // - ET marque + modèle href présents
  // - ET CC href présent

  const hasExcellentData =
    score >= 70 &&
    details.brand_quality === "EXCELLENT" &&
    details.model_quality === "EXCELLENT" &&
    details.cc_quality === "EXCELLENT";

  if (hasExcellentData) return "HIGH";

  // Priorité moyenne si :
  // - Score ≥ 50
  // - ET au moins marque + (modèle OU cc)

  const hasGoodData =
    score >= 50 &&
    details.brand_quality !== "NONE" &&
    (details.model_quality !== "NONE" || details.cc_quality !== "NONE");

  if (hasGoodData) return "MEDIUM";

  // Sinon priorité basse
  return "LOW";
}

// ============================================
// TRAITEMENT
// ============================================

const results = items.map(inputItem => {
  const item = inputItem.json;

  // Calculer le score de complétude
  const { score, details } = calculateCompletudeScore(item);

  // Déterminer le tier
  const tier = determineTier(score);

  // Recommandation de routing
  const recommendedMatch = determineRecommendedMatch(score, tier);

  // Priorité
  const priority = calculatePriority(score, details);

  // Déterminer si review manuelle recommandée
  const needsManualReview = score < 30 || tier === "MINIMAL";

  // Flags de complétude par catégorie
  const completenessFlags = {
    has_brand: details.brand_quality !== "NONE",
    has_model: details.model_quality !== "NONE",
    has_cc: details.cc_quality !== "NONE",
    has_year: details.year_quality !== "NONE",
    has_description: details.description_quality !== "NONE",
    has_photos: details.photo_quality !== "NONE",
    has_title: details.title_quality !== "NONE"
  };

  // Compter le nombre de champs présents
  const fieldsPresent = Object.values(completenessFlags).filter(Boolean).length;
  const fieldsTotal = Object.keys(completenessFlags).length;
  const completenessPercentage = Math.round((fieldsPresent / fieldsTotal) * 100);

  return {
    json: {
      // ========================================
      // DONNÉES ORIGINALES (préservées)
      // ========================================
      ...item,

      // ========================================
      // SCORING DE COMPLÉTUDE (nouveaux champs)
      // ========================================
      data_quality_score: score,
      data_quality_tier: tier,
      data_quality_priority: priority,

      recommended_match_node: recommendedMatch,
      needs_manual_review: needsManualReview,

      completeness_percentage: completenessPercentage,
      fields_present: fieldsPresent,
      fields_total: fieldsTotal,

      // ========================================
      // DÉTAILS DE SCORING (pour debug)
      // ========================================
      _completude_details: {
        brand: {
          source: details.brand_source,
          quality: details.brand_quality,
          points: details.brand_quality === "EXCELLENT" ? 25 :
                  details.brand_quality === "GOOD" ? 20 : 0
        },
        model: {
          source: details.model_source,
          quality: details.model_quality,
          points: details.model_quality === "EXCELLENT" ? 20 :
                  details.model_quality === "VERY_GOOD" ? 18 :
                  details.model_quality === "GOOD" ? 12 :
                  details.model_quality === "MEDIUM" ? 8 : 0
        },
        cc: {
          source: details.cc_source,
          quality: details.cc_quality,
          points: details.cc_quality === "EXCELLENT" ? 15 :
                  details.cc_quality === "GOOD" ? 12 :
                  details.cc_quality === "MEDIUM" ? 10 : 0
        },
        year: {
          source: details.year_source,
          quality: details.year_quality,
          points: details.year_quality === "GOOD" ? 10 : 0
        },
        description: {
          length: details.description_length,
          quality: details.description_quality,
          points: details.description_quality === "EXCELLENT" ? 15 :
                  details.description_quality === "GOOD" ? 12 :
                  details.description_quality === "MEDIUM" ? 8 :
                  details.description_quality === "POOR" ? 4 : 0
        },
        photos: {
          count: details.photo_count,
          quality: details.photo_quality,
          points: details.photo_quality === "EXCELLENT" ? 5 :
                  details.photo_quality === "GOOD" ? 4 :
                  details.photo_quality === "MEDIUM" ? 2 : 0
        },
        title: {
          length: details.title_length,
          quality: details.title_quality,
          points: details.title_quality === "EXCELLENT" ? 10 :
                  details.title_quality === "GOOD" ? 7 :
                  details.title_quality === "POOR" ? 3 : 0
        }
      },

      // ========================================
      // FLAGS DE COMPLÉTUDE
      // ========================================
      _completeness_flags: completenessFlags
    }
  };
});

// ============================================
// STATS GLOBALES (pour monitoring)
// ============================================
const stats = {
  total_items: results.length,
  distribution: {
    EXCELLENT: results.filter(r => r.json.data_quality_tier === "EXCELLENT").length,
    GOOD: results.filter(r => r.json.data_quality_tier === "GOOD").length,
    MEDIUM: results.filter(r => r.json.data_quality_tier === "MEDIUM").length,
    POOR: results.filter(r => r.json.data_quality_tier === "POOR").length,
    MINIMAL: results.filter(r => r.json.data_quality_tier === "MINIMAL").length
  },
  average_score: Math.round(
    results.reduce((sum, r) => sum + r.json.data_quality_score, 0) / results.length
  ),
  manual_review_needed: results.filter(r => r.json.needs_manual_review).length
};

console.log("📊 SCORING DE COMPLÉTUDE - STATS:");
console.log(`   Total items: ${stats.total_items}`);
console.log(`   Score moyen: ${stats.average_score}/100`);
console.log(`   Distribution:`);
console.log(`     - EXCELLENT: ${stats.distribution.EXCELLENT} (${Math.round(stats.distribution.EXCELLENT / stats.total_items * 100)}%)`);
console.log(`     - GOOD: ${stats.distribution.GOOD} (${Math.round(stats.distribution.GOOD / stats.total_items * 100)}%)`);
console.log(`     - MEDIUM: ${stats.distribution.MEDIUM} (${Math.round(stats.distribution.MEDIUM / stats.total_items * 100)}%)`);
console.log(`     - POOR: ${stats.distribution.POOR} (${Math.round(stats.distribution.POOR / stats.total_items * 100)}%)`);
console.log(`     - MINIMAL: ${stats.distribution.MINIMAL} (${Math.round(stats.distribution.MINIMAL / stats.total_items * 100)}%)`);
console.log(`   Review manuelle nécessaire: ${stats.manual_review_needed}`);

return results;
