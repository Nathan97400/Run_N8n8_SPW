// ============================================
// n8n - Extraction JSON avec LIMITATION
// ============================================

const item = $input.first();
const bin = item.binary?.attachment_0;

if (!bin) {
  throw new Error("Pièce jointe 'attachment_0' introuvable");
}

// ⚙️ CONFIGURATION - Nombre max d'annonces à traiter
const MAX_ITEMS = 50; // 🎯 Limiter à 50 annonces pour éviter timeout

// Lecture du buffer
const buffer = await this.helpers.getBinaryDataBuffer(0, "attachment_0");

// Diagnostics (à désactiver en production)
const ENABLE_DIAGNOSTICS = false;
if (ENABLE_DIAGNOSTICS) {
  const head = buffer.subarray(0, 32);
  console.log("Binary info:", {
    fileName: bin.fileName,
    mimeType: bin.mimeType,
    size: bin.fileSize,
    hex: Buffer.from(head).toString('hex')
  });
}

// Détection compression
if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
  throw new Error("Fichier GZIP détecté - décompression requise");
}
if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
  throw new Error("Fichier ZIP détecté - extraction requise");
}

// Fonction de nettoyage unifiée
const cleanJson = (text) => {
  return text
    .replace(/^\uFEFF/, '') // BOM UTF-8
    .trim()
    .replace(/^[^[{]*/, '') // Supprimer avant [ ou {
    .replace(/[^\]}]*$/, ''); // Supprimer après ] ou }
};

// Tentatives de parsing (ordre d'encodages par fréquence)
const encodings = ['utf8', 'utf16le', 'latin1'];
let data = null;

for (const encoding of encodings) {
  try {
    const text = cleanJson(buffer.toString(encoding));
    if (text.startsWith('[') || text.startsWith('{')) {
      data = JSON.parse(text);
      break;
    }
  } catch (e) {
    continue; // Essayer l'encodage suivant
  }
}

if (!data) {
  throw new Error(
    `Parsing JSON impossible. Formats testés: ${encodings.join(', ')}\n` +
    `Aperçu: ${buffer.toString('utf8').slice(0, 100)}`
  );
}

// Normalisation et nettoyage
const items = Array.isArray(data) ? data : [data];
const cleaned = items.filter(item => {
  if (!item || typeof item !== 'object') return false;
  return Object.values(item).some(v =>
    v !== null && v !== undefined && v !== '' && String(v).trim() !== ''
  );
});

// ⚠️ LIMITATION DU NOMBRE D'ITEMS
const limited = cleaned.slice(0, MAX_ITEMS);

console.log(`📊 Extraction JSON:
  - Total trouvé: ${cleaned.length}
  - Limité à: ${limited.length}
  - Items ignorés: ${cleaned.length - limited.length}
`);

return limited.map(json => ({ json }));
