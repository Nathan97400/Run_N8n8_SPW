// =====================================================
// 1ST MATCH - STRICT (données EXCELLENT)
// =====================================================
// Objectif : Matcher les annonces avec données excellentes (score 80-100%)
//
// Stratégie :
// - Seuils stricts (MIN_COV_ALPHA = 0.85, MIN_ACCEPT = 0.78)
// - Priorité href LBC (données normalisées)
// - Gates stricts (CC ≤ 80cc, année dans range)
// - Scoring composite classique
// - 2 passes (avec/sans gate année)
//
// Entrée attendue : Annonces tier "EXCELLENT" (data_quality_score 80-100%)
// Sortie : Annonces matchées avec confiance HIGH majoritaire
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

  // Normalisation modèles courants
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
  // Priorité 1 : href LBC (le plus fiable pour 1st Match)
  const ccH = ccFromHref(getAnnonceCCHref(a));
  if (ccH) return ccH;

  // Priorité 2 : champ texte
  const ccTxt = get(a, "text-body-1 (7)", "vehicule_cc_txt", "CC", "cc");
  const ccField = extractCCFromText(ccTxt);
  if (ccField) return ccField;

  // Priorité 3 : extraction depuis description
  const ccT = extractCCFromText(adText);
  if (ccT) return ccT;

  // Priorité 4 : inférence depuis nombres
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
      matching_engine: "1ST_MATCH_NO_MODELS",
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
// PARAMÈTRES 1ST MATCH (STRICT)
// =====================================================

const MIN_COV_ALPHA = 0.85;    // 85% couverture alpha (strict)
const MIN_ACCEPT = 0.78;        // 78% score minimum (strict)
const CC_BLOCK_DIFF = 80;       // 80cc tolérance (strict)

// =====================================================
// SCORING COMPOSITE CLASSIQUE
// =====================================================

function computeClassicScore(adTok, adSet, p, annonceCC, annonceYear) {
  // 1. Coverage alpha (70%)
  let bestCov = 0;
  for (const vat of p.variantAlphaTokens) {
    const cov = coverageSet(adSet, vat);
    if (cov > bestCov) bestCov = cov;
  }

  // 2. Jaccard (20%)
  const jac = jaccard(adTok, p.combinedTok);

  // 3. CC exact (5%)
  let ccBonus = 0;
  if (annonceCC && p.cc) {
    if (annonceCC === p.cc) {
      ccBonus = 1.0;
    }
  }

  // 4. Year exact (5%)
  let yearBonus = 0;
  if (annonceYear && p.ys && p.ye) {
    if (annonceYear >= p.ys && annonceYear <= p.ye) {
      yearBonus = 1.0;
    }
  }

  // Score composite
  const score = (
    bestCov * 0.70 +
    jac * 0.20 +
    ccBonus * 0.05 +
    yearBonus * 0.05
  );

  return { score, bestCov, jac, ccBonus, yearBonus };
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

  // Priorité href pour 1st Match
  const brandFromHrefRaw = extractBrandFromHref(hrefBrand);
  const brandFromFieldRaw = getAnnonceBrand(a);

  const brandFromHrefKey = brandKey(brandFromHrefRaw);
  const brandFromFieldKey = brandKey(brandFromFieldRaw);

  const adTextBase = `${title} ${desc}`.trim();

  // Marque : priorité href
  let brandAnnonceKey = brandFromHrefKey || brandFromFieldKey;

  // Model hint depuis href (priorité)
  let modelHint = extractModelFromHref(hrefModel);
  const modelNorm = normalize(modelHint);
  const isModelAutre = modelNorm === "autre" || modelNorm.includes(" autre");

  if (!modelHint || isModelAutre) {
    // Fallback sur field
    modelHint = get(a, "text-body-1 (8)", "text-body-1 (3)");
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
        matching_engine: "1ST_MATCH_NO_BRAND",
        needs_review: true,
        reason_no_match: "brand_not_found"
      }
    });
    continue;
  }

  const adTok = tokenize(adTextUsed);
  const adSet = new Set(adTok);
  const adNumbers = extractNumbers(adTextUsed);

  const baseCandidates = brandIndex.get(brandAnnonceKey) || [];

  // Passes : Pass 1 avec année, Pass 2 sans année
  const passes = [{ useYear: true }, { useYear: false }];

  let bestPrepared = null;
  let bestScore = 0;
  let bestDetails = null;
  let usedYearFilter = false;

  for (const pass of passes) {
    let foundInPass = false;

    for (const p of baseCandidates) {
      // Gate année (strict en pass 1)
      if (pass.useYear && annonceYear) {
        if (annonceYear < p.ys || annonceYear > p.ye) continue;
      }

      // Gate CC strict (≤ 80cc)
      if (annonceCC && p.cc) {
        const diff = Math.abs(p.cc - annonceCC);
        if (diff > CC_BLOCK_DIFF) continue;
      }

      // Gate dominants (upgrade prevention)
      if (p.dominants.length > 0) {
        const hasCommonDom = p.dominants.some(d => adNumbers.includes(d));
        if (!hasCommonDom) continue;
      }

      // Scoring
      const { score, bestCov, jac, ccBonus, yearBonus } =
        computeClassicScore(adTok, adSet, p, annonceCC, annonceYear);

      // Gate coverage minimum
      if (bestCov < MIN_COV_ALPHA) continue;

      if (score > bestScore) {
        bestScore = score;
        bestPrepared = p;
        bestDetails = { bestCov, jac, ccBonus, yearBonus };
        usedYearFilter = pass.useYear && !!annonceYear;
        foundInPass = true;
      }
    }

    // Si trouvé en pass 1, ne pas faire pass 2
    if (pass.useYear && foundInPass) break;
  }

  const accept = !!bestPrepared && bestScore >= MIN_ACCEPT;
  const best = accept ? bestPrepared.raw : null;

  // Déterminer la confiance
  let confidence = "NONE";
  if (accept) {
    if (bestScore >= 0.85) confidence = "HIGH";
    else confidence = "MEDIUM";
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
      matched_quality: accept ? "auto_match_1st" : "no_match",
      matching_engine: "1ST_MATCH_STRICT_V1",
      needs_review: !accept || confidence === "MEDIUM",
      reason_no_match: accept ? "" : "below_threshold_or_filtered",

      // Détails pour debug
      _match_debug: {
        brandKey: brandAnnonceKey,
        modelHint,
        adTokensCount: adTok.length,
        coverageAlpha: accept ? Number(bestDetails.bestCov.toFixed(3)) : 0,
        jaccard: accept ? Number(bestDetails.jac.toFixed(3)) : 0,
        ccBonus: accept ? Number(bestDetails.ccBonus.toFixed(2)) : 0,
        yearBonus: accept ? Number(bestDetails.yearBonus.toFixed(2)) : 0,
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
  needs_review: results.filter(r => r.json.needs_review).length
};

console.log("🥇 1ST MATCH (STRICT) - STATS:");
console.log(`   Total items: ${stats.total}`);
console.log(`   Matched: ${stats.matched} (${Math.round(stats.matched / stats.total * 100)}%)`);
console.log(`   Confidence:`);
console.log(`     - HIGH: ${stats.confidence_high} (${Math.round(stats.confidence_high / stats.total * 100)}%)`);
console.log(`     - MEDIUM: ${stats.confidence_medium} (${Math.round(stats.confidence_medium / stats.total * 100)}%)`);
console.log(`   Review manuelle: ${stats.needs_review} (${Math.round(stats.needs_review / stats.total * 100)}%)`);

return results;
