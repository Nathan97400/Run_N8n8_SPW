// =====================================================
// 3RD MATCH - PERMISSIF (données MEDIUM)
// =====================================================
// Objectif : Matcher les annonces avec données moyennes (score 40-60%)
//
// Stratégie :
// - Seuils permissifs (MIN_COV_ALPHA = 0.50, MIN_ACCEPT = 0.55)
// - Inférence intelligente du modèle depuis description
// - Fuzzy brand matching (Levenshtein distance)
// - Scoring composite (coverage + jaccard + CC + année)
// - Relaxation des gates (dominant, CC)
//
// Entrée attendue : Annonces tier "MEDIUM" (data_quality_score 40-60%)
// Sortie : Annonces matchées avec confiance MEDIUM
// =====================================================

const allItems = $input.all().map(i => i.json);

// =====================================================
// HELPERS GÉNÉRIQUES
// =====================================================

function get(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

// =====================================================
// NORMALISATION & TOKENIZATION
// =====================================================

const STOP_WORDS = new Set([
  "moto", "motos", "scooter", "roadster", "trail", "enduro", "cross",
  "vend", "vente", "vends", "urgent", "etat", "tres", "super", "parfait",
  "paiement", "securise", "option", "full", "abs", "a2", "ct", "ok",
  "km", "kms", "kilometrage", "boite", "vitesse", "manuelle",
  "prix", "euro", "eur", "garantie", "factures", "entretien"
]);

function normalize(text) {
  if (!text) return "";
  let s = String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  s = s.replace(/_/g, " ");
  s = s.replace(/[/|]/g, " ");
  s = s.replace(/[^a-z0-9]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Normalisation des modèles courants
  s = s.replace(/\b(mt)\s*0?(\d{2})\b/g, "$1$2");
  s = s.replace(/\b(fz)\s*(\d)\b/g, "$1$2");
  s = s.replace(/\b(gs)\s*(\d{3,4})\b/g, "$1$2");
  s = s.replace(/\b(r)\s*(\d{3,4})\b/g, "$1$2");
  s = s.replace(/\b(v\s*strom)\b/g, "vstrom");
  s = s.replace(/\b(dr)\s*z\b/g, "drz");

  return s;
}

function brandKey(brand) {
  return normalize(brand).replace(/\s+/g, "");
}

function tokenize(text) {
  const n = normalize(text);
  if (!n) return [];

  const tokens = n.split(" ").filter(t => {
    if (!t) return false;
    if (STOP_WORDS.has(t)) return false;
    if (/^\d+$/.test(t)) return true; // garde les nombres
    return t.length >= 2;
  });

  return tokens;
}

function tokensAlphaOnly(tokens) {
  return tokens.filter(t => /[a-z]/.test(t) && t.length >= 2);
}

function isNumberToken(t) {
  return /^\d+$/.test(t);
}

// =====================================================
// EXTRACTION DONNÉES ANNONCE
// =====================================================

const getAnnonceTitle = (a) =>
  get(a, "text-body-1 (8)", "text-headline-1-expanded", "annonce_title", "relative");

const getAnnonceDesc = (a) =>
  get(a, "annonce_description", "text-body-1 (16)", "text-body-1 (14)", "Description_complete");

const getAnnonceUrl = (a) =>
  get(a, "absolute href", "Url_Https", "annonce_url", "relative");

const getAnnonceBrand = (a) =>
  get(a, "text-body-1 (2)", "annonce_brand_input", "Marque_scrap");

const getAnnonceYearRaw1 = (a) =>
  get(a, "text-body-1 (4)", "Annee_du_modele", "annonce_year_input_1");

const getAnnonceYearRaw2 = (a) =>
  get(a, "text-body-1 (9)", "Mise_en_circulation", "annonce_year_input_2");

const getAnnonceCCHref = (a) => get(a, "text-body-1 href (5)");
const getAnnonceModelHref = (a) => get(a, "text-body-1 href (3)");
const getAnnonceBrandHref = (a) => get(a, "text-body-1 href (2)", "text-body-1 href");

// =====================================================
// EXTRACTION DONNÉES MODÈLE
// =====================================================

const getModeleField = (m) => pick(m, ["Modèle", "Modele", "modele", "Model", "MODELE"]) || "";
const getMarqueField = (m) => pick(m, ["Marque", "marque", "MARQUE", "Brand", "brand"]) || "";
const getYearStartField = (m) => pick(m, ["Année début", "Annee debut", "Year start"]) || "";
const getYearEndField = (m) => pick(m, ["Année fin", "Annee fin", "Year end"]) || "";

// =====================================================
// PARSING ANNÉE
// =====================================================

function parseYearMonth(s) {
  const str = String(s || "").trim();
  if (!str) return { year: 0, month: 0 };

  const mmyyyy = str.match(/\b(0?[1-9]|1[0-2])\s*\/\s*((19|20)\d{2})\b/);
  if (mmyyyy) return { month: parseInt(mmyyyy[1], 10), year: parseInt(mmyyyy[2], 10) };

  const yyyy = str.match(/\b(19|20)\d{2}\b/);
  if (yyyy) return { month: 0, year: parseInt(yyyy[0], 10) };

  return { year: 0, month: 0 };
}

function pickAnnonceYear(a, adText) {
  const d1 = parseYearMonth(getAnnonceYearRaw1(a));
  if (d1.year) return d1.year;

  const d2 = parseYearMonth(getAnnonceYearRaw2(a));
  if (d2.year) return d2.year;

  // Fallback : extraction depuis texte
  const m = String(adText || "").match(/\b(19|20)\d{2}\b/);
  if (m) return parseInt(m[0], 10);

  return 0;
}

// =====================================================
// EXTRACTION CC
// =====================================================

function ccFromHref(href) {
  const s = String(href || "");
  const m = s.match(/cubic_capacity:(\d{2,4})/i);
  return m ? parseInt(m[1], 10) : 0;
}

function extractCCFromText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return 0;

  const noKm = raw.replace(/\b(\d{1,6})\s*km\b/gi, " ");
  const s = normalize(noKm);

  let m = s.match(/\b(\d{2,4})\s*(cc|cm3|ccm)\b/);
  if (m) return parseInt(m[1], 10);

  m = s.match(/\b(\d{2,4})(cc|cm3|ccm)\b/);
  if (m) return parseInt(m[1], 10);

  return 0;
}

function extractNumbers(text) {
  const raw = String(text || "")
    .replace(/\b(\d{1,6})\s*km\b/gi, " ")
    .replace(/\b(0?[1-9]|1[0-2])\s*\/\s*((19|20)\d{2})\b/g, " ");
  const s = normalize(raw);
  return (s.match(/\b\d{3,4}\b/g) || []).map(n => parseInt(n, 10));
}

function inferCCFromNumbers(adText, annonceYear) {
  const nums = extractNumbers(adText);
  const candidates = nums.filter(n =>
    n >= 50 && n <= 2500 && (!annonceYear || n !== annonceYear)
  );
  if (!candidates.length) return 0;
  return Math.max(...candidates);
}

function getAnnonceCC(a, adText, annonceYear) {
  const ccH = ccFromHref(getAnnonceCCHref(a));
  if (ccH) return ccH;

  const ccTxt = get(a, "text-body-1 (7)", "vehicule_cc_txt", "CC", "cc");
  const ccField = extractCCFromText(ccTxt);
  if (ccField) return ccField;

  const ccT = extractCCFromText(adText);
  if (ccT) return ccT;

  const ccN = inferCCFromNumbers(adText, annonceYear || 0);
  if (ccN) return ccN;

  return 0;
}

// =====================================================
// EXTRACTION BRAND/MODEL DEPUIS HREF
// =====================================================

function decodePlus(s) {
  return String(s || "").replace(/\+/g, " ");
}

function extractBrandFromHref(href) {
  const h = String(href || "");
  if (!h) return "";
  const m = h.match(/u_moto_brand:([^+&]+)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(decodePlus(m[1]));
  } catch (e) {
    return decodePlus(m[1]);
  }
}

function extractModelFromHref(href) {
  const h = String(href || "");
  if (!h) return "";
  const m = h.match(/u_moto_model:([^+&]+)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(decodePlus(m[1]));
  } catch (e) {
    return decodePlus(m[1]);
  }
}

// =====================================================
// ✨ NOUVEAUTÉ : EXTRACTION MODÈLE DEPUIS DESCRIPTION
// =====================================================

/**
 * Tente d'extraire le modèle depuis la description
 * Patterns courants : "TRIUMPH Speed Triple", "YAMAHA MT-07", etc.
 */
function extractModelFromDescription(desc, brandNorm) {
  if (!desc) return "";

  const descNorm = normalize(desc);
  if (!descNorm) return "";

  // Pattern 1 : Marque + Modèle (ex: "triumph speed triple")
  if (brandNorm) {
    const regex = new RegExp(`\\b${brandNorm}\\s+([a-z0-9]+(?:\\s+[a-z0-9]+){0,2})\\b`, "i");
    const m = descNorm.match(regex);
    if (m && m[1]) {
      const extracted = m[1].trim();
      // Vérifier que ce n'est pas juste un mot générique
      if (extracted.length >= 3 && !STOP_WORDS.has(extracted)) {
        return extracted;
      }
    }
  }

  // Pattern 2 : Modèles connus avec chiffres (ex: "mt07", "r1200gs", "z900")
  const modelPatterns = [
    /\b([a-z]{1,3}\d{2,4}[a-z]*)\b/,  // mt07, r1200gs, z900
    /\b(duke|monster|street|tiger|ninja|versys|tracer|diavel)\s*(\d{2,4})?/i
  ];

  for (const pattern of modelPatterns) {
    const m = descNorm.match(pattern);
    if (m && m[0]) {
      return m[0].trim();
    }
  }

  return "";
}

// =====================================================
// ✨ NOUVEAUTÉ : FUZZY BRAND MATCHING (LEVENSHTEIN)
// =====================================================

/**
 * Distance de Levenshtein entre deux chaînes
 */
function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Trouve la marque la plus proche par fuzzy matching
 */
function fuzzyMatchBrand(adText, knownBrandKeys, maxDistance = 2) {
  const adNorm = normalize(adText);
  const adTokens = tokenize(adText);

  for (const token of adTokens) {
    if (token.length < 3) continue; // trop court pour matcher

    for (const brandKey of knownBrandKeys) {
      const dist = levenshtein(token, brandKey);
      if (dist <= maxDistance) {
        return brandKey;
      }
    }
  }

  return null;
}

// =====================================================
// SIMILARITÉ
// =====================================================

function jaccard(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function coverageSet(adSet, modelTokens) {
  if (!modelTokens.length) return 0;
  let hit = 0;
  for (const t of modelTokens) if (adSet.has(t)) hit++;
  return hit / modelTokens.length;
}

// =====================================================
// VARIANTS & DOMINANTS
// =====================================================

function modelVariants(modelRaw) {
  const cleaned = String(modelRaw || "").replace(/[|]/g, "/");
  const parts = cleaned.split("/").map(p => p.trim()).filter(Boolean);
  return Array.from(new Set(parts.map(p => normalize(p)).filter(Boolean)));
}

function getModelDominantTokens(modelRaw) {
  const n = normalize(modelRaw);
  const nums = n.match(/\b\d{3,4}\b/g) || [];
  if (nums.length) return nums.map(Number);

  const toks = tokenize(modelRaw);
  return toks.filter(t => /\d/.test(t) || t.length >= 4);
}

// =====================================================
// SÉPARATION MODÈLES / ANNONCES
// =====================================================

const modeles = [];
const annonces = [];

for (const item of allItems) {
  const isModele =
    !!getMarqueField(item) &&
    !!getModeleField(item) &&
    get(item, "Cylindrée (cc)", "Type (M/S/E)", "Type(M/S/E)") !== "";

  const isAnnonce =
    get(item, "text-body-1 (8)", "text-headline-1-expanded", "relative",
        "absolute href", "Url_Https", "annonce_url") !== "";

  if (isModele) modeles.push(item);
  else if (isAnnonce) annonces.push(item);
}

if (!modeles.length) {
  return annonces.map(a => ({
    json: {
      ...a,
      matching_engine: "3RD_MATCH_NO_MODELS",
      matched_score: 0,
      matched_confidence: "NONE",
      needs_review: true
    }
  }));
}

// =====================================================
// INDEX MARQUES
// =====================================================

const brandIndex = new Map();

for (const m of modeles) {
  const brandRaw = getMarqueField(m);
  const modelRaw = getModeleField(m);

  const bKey = brandKey(brandRaw);
  if (!bKey) continue;

  const variants = modelVariants(modelRaw);
  if (!variants.length) continue;

  const ys = parseInt(getYearStartField(m) || 0, 10) || 0;
  let ye = getYearEndField(m);
  ye = (ye === null || ye === undefined || ye === "") ? 9999 : (parseInt(ye, 10) || 9999);

  const cc = Math.round(Number(get(m, "Cylindrée (cc)") || 0)) || 0;

  const variantAlphaTokens = variants
    .map(v => tokensAlphaOnly(tokenize(v)))
    .filter(t => t.length);

  if (!variantAlphaTokens.length) continue;

  const doms = getModelDominantTokens(modelRaw);
  const modelNoSpace = normalize(modelRaw).replace(/\s+/g, "");

  const prepared = {
    raw: m,
    brandRaw,
    bKey,
    ys,
    ye,
    cc,
    variants,
    variantAlphaTokens,
    combinedTok: tokenize(`${brandRaw} ${modelRaw}`),
    dominants: doms,
    modelNoSpace
  };

  if (!brandIndex.has(bKey)) brandIndex.set(bKey, []);
  brandIndex.get(bKey).push(prepared);
}

const knownBrandKeys = Array.from(brandIndex.keys()).sort((a, b) => b.length - a.length);

// =====================================================
// PARAMÈTRES 3RD MATCH (PERMISSIF)
// =====================================================

const MIN_COV_ALPHA = 0.50;    // 50% couverture alpha (permissif)
const MIN_ACCEPT = 0.55;        // 55% score minimum (permissif)
const CC_BLOCK_DIFF = 150;      // 150cc tolérance
const CC_PENALTY = 0.08;        // Pénalité CC

// =====================================================
// ✨ SCORING COMPOSITE
// =====================================================

/**
 * Calcule un score composite avec pondération
 * Coverage (60%) + Jaccard (20%) + CC proximity (10%) + Year proximity (10%)
 */
function computeCompositeScore(adTok, adSet, p, annonceCC, annonceYear) {
  // 1. Coverage alpha (60%)
  let bestCov = 0;
  for (const vat of p.variantAlphaTokens) {
    const cov = coverageSet(adSet, vat);
    if (cov > bestCov) bestCov = cov;
  }

  // 2. Jaccard (20%)
  const jac = jaccard(adTok, p.combinedTok);

  // 3. CC proximity (10%)
  let ccProximity = 0;
  if (annonceCC && p.cc) {
    const diff = Math.abs(p.cc - annonceCC);
    if (diff === 0) ccProximity = 1.0;
    else if (diff <= 50) ccProximity = 0.8;
    else if (diff <= 100) ccProximity = 0.5;
    else if (diff <= 150) ccProximity = 0.3;
  } else if (!annonceCC && !p.cc) {
    ccProximity = 0.5; // neutral si les deux absents
  }

  // 4. Year proximity (10%)
  let yearProximity = 0;
  if (annonceYear && p.ys && p.ye) {
    if (annonceYear >= p.ys && annonceYear <= p.ye) {
      yearProximity = 1.0;
    } else {
      const distStart = Math.abs(annonceYear - p.ys);
      const distEnd = Math.abs(annonceYear - p.ye);
      const minDist = Math.min(distStart, distEnd);
      if (minDist <= 2) yearProximity = 0.5;
      else if (minDist <= 5) yearProximity = 0.3;
    }
  } else if (!annonceYear) {
    yearProximity = 0.5; // neutral si absent
  }

  // Score composite
  const score = (
    bestCov * 0.60 +
    jac * 0.20 +
    ccProximity * 0.10 +
    yearProximity * 0.10
  );

  return { score, bestCov, jac, ccProximity, yearProximity };
}

// =====================================================
// MATCHING
// =====================================================

const results = [];

for (const a of annonces) {
  const title = getAnnonceTitle(a);
  const desc = getAnnonceDesc(a);
  const url = getAnnonceUrl(a);

  const hrefModel = getAnnonceModelHref(a) || "";
  const hrefCC = getAnnonceCCHref(a) || "";
  const hrefBrand = getAnnonceBrandHref(a) || "";

  const brandFromHrefRaw = extractBrandFromHref(hrefBrand);
  const brandFromFieldRaw = getAnnonceBrand(a);

  const brandFromHrefKey = brandKey(brandFromHrefRaw);
  const brandFromFieldKey = brandKey(brandFromFieldRaw);

  const adTextBase = `${title} ${desc}`.trim();
  const adNormBase = normalize(adTextBase);

  // Marque : priorité href → field → fuzzy match
  let brandAnnonceKey = brandFromHrefKey || brandFromFieldKey;

  if (!brandAnnonceKey) {
    // ✨ FUZZY BRAND MATCHING
    const fuzzyBrand = fuzzyMatchBrand(adTextBase, knownBrandKeys, 2);
    if (fuzzyBrand) {
      brandAnnonceKey = fuzzyBrand;
      console.log(`🔍 Fuzzy matched brand: ${fuzzyBrand} from "${adTextBase.slice(0, 50)}..."`);
    }
  }

  // Model hint depuis href
  let modelHint = extractModelFromHref(hrefModel);
  const modelNorm = normalize(modelHint);
  const isModelAutre = modelNorm === "autre" || modelNorm.includes(" autre");

  if (!modelHint || isModelAutre) {
    // ✨ EXTRACTION MODÈLE DEPUIS DESCRIPTION
    const extractedModel = extractModelFromDescription(desc, brandAnnonceKey);
    if (extractedModel) {
      modelHint = extractedModel;
      console.log(`🔍 Extracted model from description: ${extractedModel}`);
    }
  }

  const adTextUsed = modelHint ? `${adTextBase} ${modelHint}`.trim() : adTextBase;

  const annonceYear = pickAnnonceYear(a, adTextUsed);
  const annonceCC = getAnnonceCC(a, adTextUsed, annonceYear);

  // Vérifier si marque trouvée
  if (!brandAnnonceKey || !brandIndex.has(brandAnnonceKey)) {
    results.push({
      json: {
        ...a,
        annonce_title: title,
        annonce_url: url,
        annonce_year_resolved: annonceYear || "",
        annonce_cc_resolved: annonceCC || "",

        matched_ok: false,
        matched_marque: "",
        matched_modele: modelHint || "",
        matched_score: 0,
        matched_confidence: "NONE",
        matching_engine: "3RD_MATCH_NO_BRAND",
        needs_review: true,
        reason_no_match: "brand_not_found_even_with_fuzzy"
      }
    });
    continue;
  }

  const adTok = tokenize(adTextUsed);
  const adSet = new Set(adTok);
  const adNumbers = extractNumbers(adTextUsed);

  const baseCandidates = brandIndex.get(brandAnnonceKey) || [];

  // Passes : avec/sans année
  const passes = [{ useYear: true }, { useYear: false }];

  let bestPrepared = null;
  let bestScore = 0;
  let bestDetails = null;
  let usedYearFilter = false;

  for (const pass of passes) {
    let foundInPass = false;

    for (const p of baseCandidates) {
      // Filtre année (optionnel en pass 1)
      if (pass.useYear && annonceYear) {
        if (annonceYear < p.ys || annonceYear > p.ye) continue;
      }

      // Gate CC relaxé (150cc)
      if (annonceCC && p.cc) {
        const diff = Math.abs(p.cc - annonceCC);
        if (diff > CC_BLOCK_DIFF) continue;
      }

      // ✨ SCORING COMPOSITE
      const { score, bestCov, jac, ccProximity, yearProximity } =
        computeCompositeScore(adTok, adSet, p, annonceCC, annonceYear);

      // Gate alpha coverage minimum
      if (bestCov < MIN_COV_ALPHA) continue;

      let finalScore = score;

      // Pénalité CC si diff > 50cc
      if (annonceCC && p.cc) {
        const diff = Math.abs(p.cc - annonceCC);
        if (diff > 50) {
          finalScore = Math.max(0, finalScore - CC_PENALTY);
        }
      }

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestPrepared = p;
        bestDetails = { bestCov, jac, ccProximity, yearProximity };
        usedYearFilter = pass.useYear && !!annonceYear;
        foundInPass = true;
      }
    }

    if (pass.useYear && foundInPass) break;
  }

  const accept = !!bestPrepared && bestScore >= MIN_ACCEPT;
  const best = accept ? bestPrepared.raw : null;

  // Déterminer la confiance
  let confidence = "NONE";
  if (accept) {
    if (bestScore >= 0.70) confidence = "HIGH";
    else if (bestScore >= 0.60) confidence = "MEDIUM";
    else confidence = "LOW";
  }

  results.push({
    json: {
      ...a,
      annonce_title: title,
      annonce_url: url,
      annonce_year_resolved: annonceYear || "",
      used_year_filter: usedYearFilter,
      annonce_cc_resolved: annonceCC || "",

      matched_ok: accept,
      matched_marque: accept ? (getMarqueField(best) || "") : "",
      matched_modele: accept ? (getModeleField(best) || "") : (modelHint || ""),
      matched_generations: accept ? (get(best, "Spéc/Génération", "Spec/Generation") || "") : "",
      matched_coloris: accept ? (get(best, "Coloris commercial") || "") : "",
      matched_annee_debut: accept ? (getYearStartField(best) || "") : "",
      matched_annee_fin: accept ? (getYearEndField(best) || "") : "",
      matched_cylindree: accept ? (get(best, "Cylindrée (cc)") || "") : "",

      matched_score: accept ? Number(bestScore.toFixed(3)) : 0,
      matched_confidence: confidence,
      matched_quality: accept ? "auto_match_3rd" : "no_match",
      matching_engine: "3RD_MATCH_PERMISSIVE_V1",
      needs_review: !accept || confidence === "LOW",
      reason_no_match: accept ? "" : "below_threshold_or_filtered",

      // Détails pour debug
      _match_debug: {
        brandKey: brandAnnonceKey,
        modelHint,
        adTokensCount: adTok.length,
        coverageAlpha: accept ? Number(bestDetails.bestCov.toFixed(3)) : 0,
        jaccard: accept ? Number(bestDetails.jac.toFixed(3)) : 0,
        ccProximity: accept ? Number(bestDetails.ccProximity.toFixed(2)) : 0,
        yearProximity: accept ? Number(bestDetails.yearProximity.toFixed(2)) : 0,
        minCovAlpha: MIN_COV_ALPHA,
        minAccept: MIN_ACCEPT,
        ccBlockDiff: CC_BLOCK_DIFF
      }
    }
  });
}

// =====================================================
// STATS
// =====================================================

const stats = {
  total: results.length,
  matched: results.filter(r => r.json.matched_ok).length,
  confidence_high: results.filter(r => r.json.matched_confidence === "HIGH").length,
  confidence_medium: results.filter(r => r.json.matched_confidence === "MEDIUM").length,
  confidence_low: results.filter(r => r.json.matched_confidence === "LOW").length,
  needs_review: results.filter(r => r.json.needs_review).length
};

console.log("🥉 3RD MATCH (PERMISSIF) - STATS:");
console.log(`   Total items: ${stats.total}`);
console.log(`   Matched: ${stats.matched} (${Math.round(stats.matched / stats.total * 100)}%)`);
console.log(`   Confidence:`);
console.log(`     - HIGH: ${stats.confidence_high}`);
console.log(`     - MEDIUM: ${stats.confidence_medium}`);
console.log(`     - LOW: ${stats.confidence_low}`);
console.log(`   Review manuelle: ${stats.needs_review}`);

return results;
