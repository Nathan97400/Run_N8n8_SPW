// =====================================================
// 4TH MATCH - TRÈS PERMISSIF (données POOR)
// =====================================================
// Objectif : Matcher les annonces avec données pauvres (score 20-40%)
//
// Stratégie :
// - Seuils très permissifs (MIN_ACCEPT = 0.40)
// - Fuzzy matching agressif (Levenshtein ≤ 2)
// - N-gram similarity pour variantes de modèles
// - Inférences multiples (brand, model, CC, year)
// - Scoring composite avancé avec fuzzy bonus
// - Relaxation maximale des gates
//
// Entrée attendue : Annonces tier "POOR" (data_quality_score 20-40%)
// Sortie : Annonces matchées avec confiance LOW/MEDIUM
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
  "km", "kms", "boite", "vitesse", "prix", "euro", "eur", "garantie"
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

  // Normalisation modèles
  s = s.replace(/\b(mt)\s*0?(\d{2})\b/g, "$1$2");
  s = s.replace(/\b(fz)\s*(\d)\b/g, "$1$2");
  s = s.replace(/\b(r)\s*(\d{3,4})\b/g, "$1$2");
  s = s.replace(/\b(gs)\s*(\d{3,4})\b/g, "$1$2");
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
    if (/^\d+$/.test(t)) return true;
    return t.length >= 2;
  });

  return tokens;
}

function tokensAlphaOnly(tokens) {
  return tokens.filter(t => /[a-z]/.test(t) && t.length >= 2);
}

// =====================================================
// ✨ NOUVEAUTÉ : LEVENSHTEIN DISTANCE
// =====================================================

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 */
function levenshtein(a, b) {
  if (!a || !b) return 999;

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
 * Fuzzy matching sur les tokens avec Levenshtein
 */
function fuzzyTokenMatch(adTokens, modelTokens, maxDist = 2) {
  let matches = 0;
  const used = new Set();

  for (const adTok of adTokens) {
    if (adTok.length < 2) continue;

    for (let i = 0; i < modelTokens.length; i++) {
      if (used.has(i)) continue;

      const modelTok = modelTokens[i];
      if (modelTok.length < 2) continue;

      const dist = levenshtein(adTok, modelTok);
      if (dist <= maxDist) {
        matches++;
        used.add(i);
        break;
      }
    }
  }

  return modelTokens.length > 0 ? matches / modelTokens.length : 0;
}

// =====================================================
// ✨ NOUVEAUTÉ : N-GRAM SIMILARITY
// =====================================================

/**
 * Crée des n-grams d'une chaîne
 */
function ngrams(text, n = 3) {
  const normalized = normalize(text);
  if (!normalized || normalized.length < n) return [];

  const grams = [];
  for (let i = 0; i <= normalized.length - n; i++) {
    grams.push(normalized.substring(i, i + n));
  }
  return grams;
}

/**
 * Similarité basée sur les n-grams (Jaccard)
 */
function ngramSimilarity(text1, text2, n = 3) {
  const grams1 = new Set(ngrams(text1, n));
  const grams2 = new Set(ngrams(text2, n));

  if (grams1.size === 0 || grams2.size === 0) return 0;

  let intersection = 0;
  for (const g of grams1) {
    if (grams2.has(g)) intersection++;
  }

  const union = grams1.size + grams2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// =====================================================
// EXTRACTION DONNÉES
// =====================================================

const getAnnonceTitle = (a) =>
  get(a, "text-body-1 (8)", "text-headline-1-expanded", "annonce_title", "relative");

const getAnnonceDesc = (a) =>
  get(a, "annonce_description", "text-body-1 (16)", "text-body-1 (14)", "Description_complete");

const getAnnonceUrl = (a) =>
  get(a, "absolute href", "Url_Https", "annonce_url", "relative");

const getAnnonceBrand = (a) =>
  get(a, "text-body-1 (2)", "annonce_brand_input", "Marque_scrap");

const getAnnonceYearRaw1 = (a) => get(a, "text-body-1 (4)", "Annee_du_modele");
const getAnnonceYearRaw2 = (a) => get(a, "text-body-1 (9)", "Mise_en_circulation");

const getAnnonceCCHref = (a) => get(a, "text-body-1 href (5)");
const getAnnonceModelHref = (a) => get(a, "text-body-1 href (3)");
const getAnnonceBrandHref = (a) => get(a, "text-body-1 href (2)", "text-body-1 href");

// Modèles
const getModeleField = (m) => pick(m, ["Modèle", "Modele", "modele", "Model"]) || "";
const getMarqueField = (m) => pick(m, ["Marque", "marque", "MARQUE", "Brand"]) || "";
const getYearStartField = (m) => pick(m, ["Année début", "Annee debut", "Year start"]) || "";
const getYearEndField = (m) => pick(m, ["Année fin", "Annee fin", "Year end"]) || "";

// =====================================================
// PARSING & EXTRACTION
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

  const m = String(adText || "").match(/\b(19|20)\d{2}\b/);
  if (m) return parseInt(m[0], 10);

  return 0;
}

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
// EXTRACTION BRAND/MODEL
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

// ✨ Extraction modèle depuis description (aggressive)
function extractModelFromDescription(desc, brandNorm) {
  if (!desc) return "";

  const descNorm = normalize(desc);
  if (!descNorm) return "";

  // Pattern 1 : Marque + Modèle
  if (brandNorm) {
    const regex = new RegExp(`\\b${brandNorm}\\s+([a-z0-9]+(?:\\s+[a-z0-9]+){0,3})\\b`, "i");
    const m = descNorm.match(regex);
    if (m && m[1]) {
      const extracted = m[1].trim();
      if (extracted.length >= 2 && !STOP_WORDS.has(extracted)) {
        return extracted;
      }
    }
  }

  // Pattern 2 : Modèles avec chiffres
  const modelPatterns = [
    /\b([a-z]{1,4}\d{2,4}[a-z]*)\b/,
    /\b(duke|monster|street|tiger|ninja|versys|tracer|diavel|hypermotard)\s*(\d{2,4})?/i,
    /\b(speed\s+triple|street\s+triple|street\s+twin|thruxton|scrambler)\b/i
  ];

  for (const pattern of modelPatterns) {
    const m = descNorm.match(pattern);
    if (m && m[0]) {
      return m[0].trim();
    }
  }

  return "";
}

// ✨ Fuzzy brand matching (max distance 2)
function fuzzyMatchBrand(adText, knownBrandKeys, maxDistance = 2) {
  const adNorm = normalize(adText);
  const adTokens = tokenize(adText);

  for (const token of adTokens) {
    if (token.length < 3) continue;

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
// VARIANTS
// =====================================================

function modelVariants(modelRaw) {
  const cleaned = String(modelRaw || "").replace(/[|]/g, "/");
  const parts = cleaned.split("/").map(p => p.trim()).filter(Boolean);
  return Array.from(new Set(parts.map(p => normalize(p)).filter(Boolean)));
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
      matching_engine: "4TH_MATCH_NO_MODELS",
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
    modelNoSpace,
    modelRaw
  };

  if (!brandIndex.has(bKey)) brandIndex.set(bKey, []);
  brandIndex.get(bKey).push(prepared);
}

const knownBrandKeys = Array.from(brandIndex.keys()).sort((a, b) => b.length - a.length);

// =====================================================
// PARAMÈTRES 4TH MATCH (TRÈS PERMISSIF)
// =====================================================

const MIN_ACCEPT = 0.40;          // 40% score minimum (très permissif)
const CC_RELAXATION = 250;        // 250cc tolérance maximale
const FUZZY_BONUS = 0.15;         // Bonus si fuzzy match
const NGRAM_BONUS = 0.10;         // Bonus si n-gram match

// =====================================================
// ✨ SCORING COMPOSITE AVANCÉ AVEC FUZZY
// =====================================================

function computeAdvancedScore(adTok, adSet, p, adTextFull, annonceCC, annonceYear) {
  const adAlpha = tokensAlphaOnly(adTok);

  // 1. Coverage classique (30%)
  let bestCov = 0;
  for (const vat of p.variantAlphaTokens) {
    const cov = coverageSet(adSet, vat);
    if (cov > bestCov) bestCov = cov;
  }

  // 2. Jaccard classique (15%)
  const jac = jaccard(adTok, p.combinedTok);

  // 3. ✨ Fuzzy token matching (25%)
  let bestFuzzy = 0;
  for (const vat of p.variantAlphaTokens) {
    const fuzzy = fuzzyTokenMatch(adAlpha, vat, 2);
    if (fuzzy > bestFuzzy) bestFuzzy = fuzzy;
  }

  // 4. ✨ N-gram similarity (15%)
  const ngramSim = ngramSimilarity(adTextFull, p.modelRaw, 3);

  // 5. CC proximity (10%)
  let ccProximity = 0;
  if (annonceCC && p.cc) {
    const diff = Math.abs(p.cc - annonceCC);
    if (diff === 0) ccProximity = 1.0;
    else if (diff <= 50) ccProximity = 0.8;
    else if (diff <= 100) ccProximity = 0.6;
    else if (diff <= 150) ccProximity = 0.4;
    else if (diff <= 250) ccProximity = 0.2;
  } else if (!annonceCC && !p.cc) {
    ccProximity = 0.5;
  }

  // 6. Year proximity (5%)
  let yearProximity = 0;
  if (annonceYear && p.ys && p.ye) {
    if (annonceYear >= p.ys && annonceYear <= p.ye) {
      yearProximity = 1.0;
    } else {
      const distStart = Math.abs(annonceYear - p.ys);
      const distEnd = Math.abs(annonceYear - p.ye);
      const minDist = Math.min(distStart, distEnd);
      if (minDist <= 3) yearProximity = 0.6;
      else if (minDist <= 7) yearProximity = 0.3;
    }
  } else if (!annonceYear) {
    yearProximity = 0.5;
  }

  // Score composite
  const baseScore = (
    bestCov * 0.30 +
    jac * 0.15 +
    bestFuzzy * 0.25 +
    ngramSim * 0.15 +
    ccProximity * 0.10 +
    yearProximity * 0.05
  );

  // Bonus
  let bonus = 0;
  if (bestFuzzy >= 0.5) bonus += FUZZY_BONUS;
  if (ngramSim >= 0.4) bonus += NGRAM_BONUS;

  const finalScore = Math.min(1.0, baseScore + bonus);

  return {
    score: finalScore,
    bestCov,
    jac,
    bestFuzzy,
    ngramSim,
    ccProximity,
    yearProximity,
    bonusApplied: bonus
  };
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

  // Brand : href → field → fuzzy
  let brandAnnonceKey = brandFromHrefKey || brandFromFieldKey;

  if (!brandAnnonceKey) {
    const fuzzyBrand = fuzzyMatchBrand(adTextBase, knownBrandKeys, 2);
    if (fuzzyBrand) {
      brandAnnonceKey = fuzzyBrand;
      console.log(`🔍 4th Match - Fuzzy brand: ${fuzzyBrand}`);
    }
  }

  // Model hint
  let modelHint = extractModelFromHref(hrefModel);
  const modelNorm = normalize(modelHint);
  const isModelAutre = modelNorm === "autre" || modelNorm.includes(" autre");

  if (!modelHint || isModelAutre) {
    const extractedModel = extractModelFromDescription(desc, brandAnnonceKey);
    if (extractedModel) {
      modelHint = extractedModel;
      console.log(`🔍 4th Match - Extracted model: ${extractedModel}`);
    }
  }

  const adTextUsed = modelHint ? `${adTextBase} ${modelHint}`.trim() : adTextBase;

  const annonceYear = pickAnnonceYear(a, adTextUsed);
  const annonceCC = getAnnonceCC(a, adTextUsed, annonceYear);

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
        matching_engine: "4TH_MATCH_NO_BRAND",
        needs_review: true,
        reason_no_match: "brand_not_found"
      }
    });
    continue;
  }

  const adTok = tokenize(adTextUsed);
  const adSet = new Set(adTok);

  const baseCandidates = brandIndex.get(brandAnnonceKey) || [];

  // Passes : pas de filtre année strict pour 4th Match
  const passes = [{ useYear: false }];

  let bestPrepared = null;
  let bestScore = 0;
  let bestDetails = null;

  for (const pass of passes) {
    for (const p of baseCandidates) {
      // Gate CC ultra-relaxé (250cc)
      if (annonceCC && p.cc) {
        const diff = Math.abs(p.cc - annonceCC);
        if (diff > CC_RELAXATION) continue;
      }

      // ✨ SCORING AVANCÉ
      const details = computeAdvancedScore(
        adTok, adSet, p, adTextUsed, annonceCC, annonceYear
      );

      if (details.score > bestScore) {
        bestScore = details.score;
        bestPrepared = p;
        bestDetails = details;
      }
    }
  }

  const accept = !!bestPrepared && bestScore >= MIN_ACCEPT;
  const best = accept ? bestPrepared.raw : null;

  // Confiance
  let confidence = "NONE";
  if (accept) {
    if (bestScore >= 0.60) confidence = "MEDIUM";
    else confidence = "LOW";
  }

  results.push({
    json: {
      ...a,
      annonce_title: title,
      annonce_url: url,
      annonce_year_resolved: annonceYear || "",
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
      matched_quality: accept ? "auto_match_4th" : "no_match",
      matching_engine: "4TH_MATCH_FUZZY_AGGRESSIVE_V1",
      needs_review: !accept || confidence === "LOW",
      reason_no_match: accept ? "" : "below_threshold",

      _match_debug: {
        brandKey: brandAnnonceKey,
        modelHint,
        adTokensCount: adTok.length,
        coverage: accept ? Number(bestDetails.bestCov.toFixed(3)) : 0,
        jaccard: accept ? Number(bestDetails.jac.toFixed(3)) : 0,
        fuzzyMatch: accept ? Number(bestDetails.bestFuzzy.toFixed(3)) : 0,
        ngramSim: accept ? Number(bestDetails.ngramSim.toFixed(3)) : 0,
        ccProximity: accept ? Number(bestDetails.ccProximity.toFixed(2)) : 0,
        yearProximity: accept ? Number(bestDetails.yearProximity.toFixed(2)) : 0,
        bonusApplied: accept ? Number(bestDetails.bonusApplied.toFixed(2)) : 0,
        minAccept: MIN_ACCEPT
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
  confidence_medium: results.filter(r => r.json.matched_confidence === "MEDIUM").length,
  confidence_low: results.filter(r => r.json.matched_confidence === "LOW").length,
  needs_review: results.filter(r => r.json.needs_review).length
};

console.log("🏅 4TH MATCH (FUZZY AGRESSIF) - STATS:");
console.log(`   Total items: ${stats.total}`);
console.log(`   Matched: ${stats.matched} (${Math.round(stats.matched / stats.total * 100)}%)`);
console.log(`   Confidence:`);
console.log(`     - MEDIUM: ${stats.confidence_medium}`);
console.log(`     - LOW: ${stats.confidence_low}`);
console.log(`   Review manuelle: ${stats.needs_review}`);

return results;
