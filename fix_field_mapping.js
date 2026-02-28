/**
 * Corrige le mapping des champs pour les noeuds Supabase HTTP Request :
 * 1. Rename Columns : output = noms colonnes Supabase + id extrait de l'URL
 * 2. HTTP Request Supabase : jsonBody filtre uniquement les colonnes Supabase
 */
const https = require('https');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzAyY2NmNS1kOGU2LTQzYTAtYWEzYS00NmMxZDRkZjE0MmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWYzMjFhNGUtNWExMS00NGUxLTk5ZmYtYzRhNjQzNzMwY2NlIiwiaWF0IjoxNzcxOTMxMjY2LCJleHAiOjE3NzQ0OTc2MDB9.p63Tp_-Sq7l7Fr7pZm_38Jr6FK1K1mmdDKEi9Gu9lOs';
const WF_ID = 'ssvlV5ZZsZemSOUB';
const N8N_HOST = 'n8n-t0fe.onrender.com';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: N8N_HOST, port: 443, path, method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ──────────────────────────────────────────────────────────────────────
// Nouveau code Rename Columns : output = colonnes Supabase exactes
// ──────────────────────────────────────────────────────────────────────
const NEW_RENAME_CODE = `
const CURRENT_YEAR = 2026;

function extractFavoris(value) {
  if (!value) return null;
  const m = String(value).match(/(\\d+)\\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

function extractCC(value) {
  if (!value) return null;
  const m = String(value).match(/(\\d{2,4}(\\.\\d+)?)/);
  if (!m) return null;
  const cc = parseFloat(m[1]);
  return cc < 49.8 ? null : cc;
}

function extractNbPhotos(value) {
  if (!value) return null;
  const m = String(value).match(/(\\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseGenerations(value) {
  const s = String(value || '').trim();
  if (!s) return { label: '', yStart: null, yEnd: null };
  const labelMatch = s.match(/\\(([^)]+)\\)/);
  const label = labelMatch ? labelMatch[1].trim() : '';
  const rangeMatch = s.match(/(\\d{4})\\s*[-\u2013]\\s*(\\d{4})/);
  if (rangeMatch) return { label, yStart: Number(rangeMatch[1]), yEnd: Number(rangeMatch[2]) };
  const arrowMatch = s.match(/(\\d{4})\\s*\\u2192/);
  if (arrowMatch) return { label, yStart: Number(arrowMatch[1]), yEnd: CURRENT_YEAR };
  const oneYear = s.match(/(\\d{4})/);
  if (oneYear) { const y = Number(oneYear[1]); return { label, yStart: y, yEnd: y }; }
  return { label: '', yStart: null, yEnd: null };
}

function extractId(url) {
  const m = String(url || '').match(/\\/(\\d{5,15})(?:[?#].*)?$/);
  return m ? m[1] : '';
}

function extractPrix(value) {
  const s = String(value || '');
  const m = s.replace(/\\s/g, '').match(/(\\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function extractKm(value) {
  const s = String(value || '');
  if (!s.trim()) return null;
  const m = s.replace(/\\s/g, '').match(/(\\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function extractAnnee(value) {
  const s = String(value || '');
  const m = s.match(/\\b(19|20)\\d{2}\\b/);
  return m ? parseInt(m[0], 10) : null;
}

function mapField(item) {
  const gen = parseGenerations(item.matched_generations);
  const url = item['absolute href'] || item.annonce_url || '';

  return {
    json: {
      // ── COLONNES SUPABASE ──
      id:                       extractId(url),
      url:                      url,
      titre:                    item['text-headline-1-expanded'] || item.annonce_title || '',
      prix:                     extractPrix(item['flex'] || item['text-headline-1']),
      kilometrage:              extractKm(item['text-body-1 (5)']),
      annee:                    extractAnnee(item['text-body-1 (4)']),
      cylindree:                extractCC(item['text-body-1 (7)']),
      photo1:                   item['size-full src'] || null,
      photo2:                   item['size-full src (2)'] || null,
      photo3:                   item['size-full src (3)'] || null,
      description:              item.annonce_description || item['text-body-1 (17)'] || null,
      marque:                   item.matched_marque || null,
      modele:                   item.matched_modele || null,
      generation:               gen.label || null,
      nb_photos_supplementaires: extractNbPhotos(item['u-shadow-border-transition (2)']),
      type_vendeur:             item['text-body-1'] || null,
      date_run:                 new Date().toISOString().split('T')[0],
      // ── CHAMPS INTERNES (pour IF node, non envoyés à Supabase) ──
      matched_ok:               item.matched_ok ?? false,
      matched_confidence:       item.matched_confidence || 'NONE',
      matching_engine:          item.matching_engine || '',
    }
  };
}

return $input.all().map(i => mapField(i.json));
`.trim();

// Expression jsonBody : filtre uniquement les colonnes Supabase
const SUPABASE_COLS = [
  'id','url','titre','prix','kilometrage','annee','cylindree',
  'photo1','photo2','photo3','description','marque','modele',
  'generation','nb_photos_supplementaires','type_vendeur','date_run'
];
// Un objet par appel HTTP (évite les crashs mémoire sur Render free tier)
const NEW_JSON_BODY = `={{ (() => { const COLS = ${JSON.stringify(SUPABASE_COLS)}; return COLS.reduce((a,c) => { a[c] = ($json[c] != null && $json[c] !== '') ? $json[c] : null; return a; }, {}); })() }}`;

// ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('GET workflow depuis n8n...');
  const { status, data: wf } = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`, null);
  if (status !== 200) { console.error('GET failed:', status); return; }
  console.log('Workflow:', wf.name, '|', wf.nodes.length, 'noeuds');

  let changes = [];

  wf.nodes = wf.nodes.map(node => {
    // Fix 1 : Rename Columns
    if (node.name === 'Rename Columns') {
      node.parameters.jsCode = NEW_RENAME_CODE;
      changes.push('Rename Columns : mapping -> colonnes Supabase + extractId');
    }

    // Fix 2 : HTTP Request Supabase nodes
    if (
      node.type === 'n8n-nodes-base.httpRequest' &&
      (node.name === 'Supabase - Annonce Matchee' || node.name === 'Supabase - Annonce A Revoir')
    ) {
      node.parameters.jsonBody = NEW_JSON_BODY;
      // on_conflict=id (clé primaire, toujours présente)
      node.parameters.queryParameters = {
        parameters: [{ name: 'on_conflict', value: 'id' }]
      };
      changes.push(`${node.name} : jsonBody filtré + on_conflict=id`);
    }

    return node;
  });

  if (changes.length === 0) {
    console.log('WARN: aucun noeud modifie. Verifier les noms de noeuds sur n8n.');
    console.log('Noeuds HTTP Request:', wf.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest').map(n => n.name));
    return;
  }

  console.log('\nCorrections :');
  changes.forEach(c => console.log(' ', c));

  const result = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' }
  });

  console.log('\nPUT status:', result.status);
  if (result.status === 200) {
    console.log('Workflow mis a jour avec succes !');
  } else {
    console.error('Erreur:', JSON.stringify(result.data).substring(0, 400));
  }
}

main().catch(console.error);
