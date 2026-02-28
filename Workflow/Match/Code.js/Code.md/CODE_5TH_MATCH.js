// =====================================================
// 5TH MATCH - FALLBACK ULTIME (données MINIMAL)
// =====================================================
// Objectif : Dernière chance de matcher les annonces avec données minimales (score 0-20%)
//
// Stratégie :
// - Seuils ultra-permissifs (MIN_ACCEPT = 0.25)
// - Fuzzy ultra-agressif (Levenshtein ≤ 3)
// - N-gram flexible (bi + tri-grammes)
// - Matching par marque seule + catégorie
// - AUCUN gate (toutes restrictions levées)
// - Bonus massifs (+60% max)
//
// Entrée attendue : Annonces tier "MINIMAL" (data_quality_score 0-20%)
// Sortie : Annonces matchées avec confiance LOW uniquement
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
// ✨ LEVENSHTEIN DISTANCE (Ultra-agressif : distance ≤ 3)
// =====================================================

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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function fuzzyTokenMatch(adTokens, modelTokens, maxDist = 3) {
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
// ✨ N-GRAM FLEXIBLE (Bi + Tri-grammes)
// =====================================================

function ngrams(text, n = 3) {
  const normalized = normalize(text);
  if (!normalized || normalized.length < n) return [];

  const grams = [];
  for (let i = 0; i <= normalized.length - n; i++) {
    grams.push(normalized.substring(i, i + n));
  }
  return grams;
}

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

/**
 * ✨ N-gram flexible : combine bi-grammes et tri-grammes
 */
function flexibleNgramSimilarity(text1, text2) {
  const bigram = ngramSimilarity(text1, text2, 2);
  const trigram = ngramSimilarity(text1, text2, 3);

  // Bi-grammes 40%, Tri-grammes 60%
  return bigram * 0.40 + trigram * 0.60;
}

// =====================================================
// ✨ DÉTECTION DE CATÉGORIE
// =====================================================

const CATEGORIES = {
  roadster: ["roadster", "naked", "street", "streetfighter"],
  trail: ["trail", "enduro", "adventure", "gs", "rallye"],
  sportive: ["sportive", "sport", "racing", "replica", "supersport"],
  custom: ["custom", "cruiser", "bobber", "chopper"],
  touring: ["touring", "gt", "grand tourisme"],
  scooter: ["scooter", "maxiscooter"]
};

function detectCategory(text) {
  const textNorm = normalize(text);

  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    for (const kw of keywords) {
      if (textNorm.includes(kw)) {
        return cat;
      }
    }
  }

  return null;
}

function categoryMatches(adCategory, modelCategory) {
  if (!adCategory || !modelCategory) return false;
  return adCategory === modelCategory;
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
const getCategoryField = (m) => pick(m, ["Categorie", "Category", "Type"]) || "";

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

/**
 * ✨ Extraction modèle ultra-agressive
 */
function extractModelFromDescription(desc, brandNorm) {
  if (!desc) return "";

  const descNorm = normalize(desc);
  if (!descNorm) return "";

  // Pattern 1 : Marque + Modèle (jusqu'à 4 mots)
  if (brandNorm) {
    const regex = new RegExp(`\\b${brandNorm}\\s+([a-z0-9]+(?:\\s+[a-z0-9]+){0,4})\\b`, "i");
    const m = descNorm.match(regex);
    if (m && m[1]) {
      const extracted = m[1].trim();
      if (extracted.length >= 2 && !STOP_WORDS.has(extracted)) {
        return extracted;
      }
    }
  }

  // Pattern 2 : Modèles avec chiffres (très permissif)
  const modelPatterns = [
    /\b([a-z]{1,5}\d{2,4}[a-z]*)\b/,
    /\b(duke|monster|street|tiger|ninja|versys|tracer|diavel|hypermotard|scrambler)\s*(\d{2,4})?/i,
    /\b(speed\s+triple|street\s+triple|street\s+twin|thruxton|bonneville)\b/i
  ];

  for (const pattern of modelPatterns) {
    const m = descNorm.match(pattern);
    if (m && m[0]) {
      return m[0].trim();
    }
  }

  return "";
}

/**
 * ✨ Fuzzy brand matching ultra-agressif (distance ≤ 3)
 */
function fuzzyMatchBrand(adText, knownBrandKeys, maxDistance = 3) {
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
      matching_engine: "5TH_MATCH_NO_MODELS",
      matched_score: 0,
      matched_confidence: "NONE",
      needs_review: true
    }
  }));
}

// =====================================================
// INDEX MARQUES (avec catégories)
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
  const category = getCategoryField(m);

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
    category,
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
// PARAMÈTRES 5TH MATCH (ULTRA-PERMISSIF)
// =====================================================

const MIN_ACCEPT = 0.25;          // 25% score minimum (ultra-permissif)
const CC_RELAXATION = 400;        // 400cc tolérance maximale
const FUZZY_BONUS = 0.20;         // Bonus fuzzy augmenté
const NGRAM_BONUS = 0.15;         // Bonus n-gram augmenté
const CATEGORY_BONUS = 0.10;      // Bonus catégorie
const BRAND_ONLY_BONUS = 0.15;    // Bonus marque seule

// =====================================================
// ✨ SCORING COMPOSITE ULTRA-PERMISSIF
// =====================================================

function computeUltraPermissiveScore(adTok, adSet, p, adTextFull, annonceCC, annonceYear, adCategory) {
  const adAlpha = tokensAlphaOnly(adTok);

  // 1. Coverage classique (20%)
  let bestCov = 0;
  for (const vat of p.variantAlphaTokens) {
    const cov = coverageSet(adSet, vat);
    if (cov > bestCov) bestCov = cov;
  }

  // 2. Jaccard classique (10%)
  const jac = jaccard(adTok, p.combinedTok);

  // 3. ✨ Fuzzy token matching ultra-agressif (25%)
  let bestFuzzy = 0;
  for (const vat of p.variantAlphaTokens) {
    const fuzzy = fuzzyTokenMatch(adAlpha, vat, 3);
    if (fuzzy > bestFuzzy) bestFuzzy = fuzzy;
  }

  // 4. ✨ N-gram flexible (20%)
  const ngramSim = flexibleNgramSimilarity(adTextFull, p.modelRaw);

  // 5. CC proximity très faible (5%)
  let ccProximity = 0;
  if (annonceCC && p.cc) {
    const diff = Math.abs(p.cc - annonceCC);
    if (diff === 0) ccProximity = 1.0;
    else if (diff <= 50) ccProximity = 0.8;
    else if (diff <= 150) ccProximity = 0.5;
    else if (diff <= 300) ccProximity = 0.3;
    else if (diff <= 400) ccProximity = 0.1;
  } else if (!annonceCC && !p.cc) {
    ccProximity = 0.5;
  }

  // 6. ✨ Category match (10%)
  let categoryScore = 0;
  if (adCategory && p.category) {
    categoryScore = categoryMatches(adCategory, p.category) ? 1.0 : 0;
  }

  // 7. ✨ Brand inference (10%)
  // Si le texte contient la marque → bonus
  const brandScore = adTextFull.includes(p.bKey) ? 1.0 : 0.5;

  // Score composite
  const baseScore = (
    bestCov * 0.20 +
    jac * 0.10 +
    bestFuzzy * 0.25 +
    ngramSim * 0.20 +
    ccProximity * 0.05 +
    categoryScore * 0.10 +
    brandScore * 0.10
  );

  // Bonus massifs
  let bonus = 0;
  if (bestFuzzy >= 0.5) bonus += FUZZY_BONUS;
  if (ngramSim >= 0.4) bonus += NGRAM_BONUS;
  if (categoryScore >= 1.0) bonus += CATEGORY_BONUS;
  if (adTok.length <= 5) bonus += BRAND_ONLY_BONUS; // Texte très court

  const finalScore = Math.min(1.0, baseScore + bonus);

  return {
    score: finalScore,
    bestCov,
    jac,
    bestFuzzy,
    ngramSim,
    ccProximity,
    categoryScore,
    brandScore,
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

  // Détection catégorie
  const adCategory = detectCategory(adTextBase);

  // Brand : href → field → fuzzy ultra-agressif (≤ 3)
  let brandAnnonceKey = brandFromHrefKey || brandFromFieldKey;

  if (!brandAnnonceKey) {
    const fuzzyBrand = fuzzyMatchBrand(adTextBase, knownBrandKeys, 3);
    if (fuzzyBrand) {
      brandAnnonceKey = fuzzyBrand;
      console.log(`🆘 5th Match - Fuzzy brand (≤3): ${fuzzyBrand}`);
    }
  }

  // Model hint ultra-agressif
  let modelHint = extractModelFromHref(hrefModel);
  const modelNorm = normalize(modelHint);
  const isModelAutre = modelNorm === "autre" || modelNorm.includes(" autre");

  if (!modelHint || isModelAutre) {
    const extractedModel = extractModelFromDescription(desc, brandAnnonceKey);
    if (extractedModel) {
      modelHint = extractedModel;
      console.log(`🆘 5th Match - Extracted model: ${extractedModel}`);
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
        annonce_category_detected: adCategory || "",

        matched_ok: false,
        matched_marque: "",
        matched_modele: modelHint || "",
        matched_score: 0,
        matched_confidence: "NONE",
        matching_engine: "5TH_MATCH_NO_BRAND",
        needs_review: true,
        reason_no_match: "insufficient_data_even_for_fallback",
        matching_strategy: "complete_failure"
      }
    });
    continue;
  }

  const adTok = tokenize(adTextUsed);
  const adSet = new Set(adTok);

  const baseCandidates = brandIndex.get(brandAnnonceKey) || [];

  // ✨ Filtrage optionnel par catégorie si détectée
  let candidates = baseCandidates;
  if (adCategory) {
    const catFiltered = baseCandidates.filter(p => p.category === adCategory);
    if (catFiltered.length > 0) {
      candidates = catFiltered;
      console.log(`🆘 5th Match - Filtered by category: ${adCategory} (${catFiltered.length} candidates)`);
    }
  }

  // Limiter à 50 candidats max pour performance
  if (candidates.length > 50) {
    candidates = candidates.slice(0, 50);
  }

  let bestPrepared = null;
  let bestScore = 0;
  let bestDetails = null;
  let matchingStrategy = "ultra_permissive";

  // ❌ AUCUN GATE - Tous les candidats sont testés
  for (const p of candidates) {
    const details = computeUltraPermissiveScore(
      adTok, adSet, p, adTextUsed, annonceCC, annonceYear, adCategory
    );

    if (details.score > bestScore) {
      bestScore = details.score;
      bestPrepared = p;
      bestDetails = details;
    }
  }

  // Stratégie de matching
  if (adTok.length <= 3 && adCategory) {
    matchingStrategy = "brand_category_only";
  } else if (bestDetails && bestDetails.bestFuzzy >= 0.5) {
    matchingStrategy = "fuzzy_ultra_aggressive";
  } else if (bestDetails && bestDetails.ngramSim >= 0.4) {
    matchingStrategy = "ngram_flexible";
  }

  const accept = !!bestPrepared && bestScore >= MIN_ACCEPT;
  const best = accept ? bestPrepared.raw : null;

  // Confiance : toujours LOW pour 5th Match
  let confidence = "NONE";
  if (accept) {
    confidence = "LOW";
  }

  results.push({
    json: {
      ...a,
      annonce_title: title,
      annonce_url: url,
      annonce_year_resolved: annonceYear || "",
      annonce_cc_resolved: annonceCC || "",
      annonce_category_detected: adCategory || "",

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
      matched_quality: accept ? "auto_match_5th_fallback" : "no_match",
      matching_engine: "5TH_MATCH_FALLBACK_ULTIME_V1",
      matching_strategy: matchingStrategy,
      needs_review: true, // TOUJOURS true pour 5th Match
      reason_no_match: accept ? "" : "below_threshold_fallback",

      _match_debug: {
        brandKey: brandAnnonceKey,
        modelHint,
        categoryDetected: adCategory || "none",
        adTokensCount: adTok.length,
        candidatesCount: candidates.length,
        coverage: accept ? Number(bestDetails.bestCov.toFixed(3)) : 0,
        jaccard: accept ? Number(bestDetails.jac.toFixed(3)) : 0,
        fuzzyMatch: accept ? Number(bestDetails.bestFuzzy.toFixed(3)) : 0,
        ngramSim: accept ? Number(bestDetails.ngramSim.toFixed(3)) : 0,
        ccProximity: accept ? Number(bestDetails.ccProximity.toFixed(2)) : 0,
        categoryScore: accept ? Number(bestDetails.categoryScore.toFixed(2)) : 0,
        brandScore: accept ? Number(bestDetails.brandScore.toFixed(2)) : 0,
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
  rejected: results.filter(r => !r.json.matched_ok).length,
  strategies: {
    brand_category: results.filter(r => r.json.matching_strategy === "brand_category_only").length,
    fuzzy_ultra: results.filter(r => r.json.matching_strategy === "fuzzy_ultra_aggressive").length,
    ngram: results.filter(r => r.json.matching_strategy === "ngram_flexible").length
  }
};

console.log("🆘 5TH MATCH (FALLBACK ULTIME) - STATS:");
console.log(`   Total items: ${stats.total}`);
console.log(`   Matched: ${stats.matched} (${stats.total ? Math.round(stats.matched / stats.total * 100) : 0}%)`);
console.log(`   Rejected: ${stats.rejected} (${stats.total ? Math.round(stats.rejected / stats.total * 100) : 0}%)`);
console.log(`   Confidence: 100% LOW`);
console.log(`   Review manuelle: ${stats.matched} (100%)`);
console.log(`   Strategies:`);
console.log(`     - Brand+Category: ${stats.strategies.brand_category}`);
console.log(`     - Fuzzy ultra: ${stats.strategies.fuzzy_ultra}`);
console.log(`     - N-gram flexible: ${stats.strategies.ngram}`);

return results;
