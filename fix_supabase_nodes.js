// Deux corrections :
// 1. tableId → resource locator format (requis par n8n v2.8+)
// 2. conflictColumns → format correct
// La credential devra être configurée manuellement dans l'UI n8n

const https = require('https');
const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzAyY2NmNS1kOGU2LTQzYTAtYWEzYS00NmMxZDRkZjE0MmYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWYzMjFhNGUtNWExMS00NGUxLTk5ZmYtYzRhNjQzNzMwY2NlIiwiaWF0IjoxNzcxOTMxMjY2LCJleHAiOjE3NzQ0OTc2MDB9.p63Tp_-Sq7l7Fr7pZm_38Jr6FK1K1mmdDKEi9Gu9lOs';
const WF_ID = 'ssvlV5ZZsZemSOUB';
const N8N_HOST = 'n8n-t0fe.onrender.com';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: N8N_HOST, port: 443, path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const req = https.request(options, (res) => {
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

async function main() {
  // Récupérer le workflow courant
  const { status, data: wf } = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`, null);
  if (status !== 200) { console.error('GET failed:', status); return; }

  console.log('Workflow récupéré:', wf.name, '|', wf.nodes.length, 'noeuds');

  // Corriger les deux noeuds Supabase
  wf.nodes = wf.nodes.map(node => {
    if (node.type !== 'n8n-nodes-base.supabase') return node;

    // tableId en resource locator format
    node.parameters.tableId = {
      __rl: true,
      value: 'annonces',
      mode: 'name'
    };

    // conflictColumns peut rester string
    node.parameters.conflictColumns = 'Url_Https';

    console.log('Fixé:', node.name);
    return node;
  });

  // Envoyer
  const result = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: 'v1' }
  });

  console.log('PUT status:', result.status);
  if (result.status === 200) {
    const sup = result.data.nodes.find(n => n.name === 'Supabase - Annonce Matchee');
    console.log('tableId Supabase:', JSON.stringify(sup?.parameters?.tableId));
    console.log('Workflow mis à jour !');
  } else {
    console.error('Erreur:', JSON.stringify(result.data).substring(0, 300));
  }
}

main().catch(console.error);
