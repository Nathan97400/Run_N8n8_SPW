const https = require('https');
const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4M2Y2NTYzMi05NzVkLTQ2YzQtOTcxMy01NzBiMjNmNzJmOTQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDJmNDYxYzktZTU5OC00NGRlLWI0YTktNTczMTEwNDQwMGJlIiwiaWF0IjoxNzcyMjA5NjM2LCJleHAiOjE3NzQ3NTY4MDB9.VkxS9tEh-rE86sEPTIUVfT0yXD04oIT8ZVzM0-PkDVY';
const WF_ID = 'jv1dOKiyTbxQPVm5';
const N8N_HOST = 'n8n-t0fe.onrender.com';
const WF_FILE = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: N8N_HOST,
      port: 443,
      path: path,
      method: method,
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
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data.substring(0, 500) });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const workflow = JSON.parse(fs.readFileSync(WF_FILE, 'utf8'));

  // 1. Vérifier si le workflow existe déjà
  console.log('GET workflow actuel...');
  const current = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`, null);
  console.log('Status GET:', current.status);

  let result;
  if (current.status === 200) {
    // UPDATE existant
    const currentWf = current.data;
    console.log('Workflow actuel:', currentWf.name);
    const updateBody = {
      name: 'LBC Scraping - Progressive Matching v3 (STABLE)',
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: { executionOrder: 'v1' },
      staticData: currentWf.staticData || null
    };
    console.log('\nPUT workflow corrigé...');
    result = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, updateBody);
    console.log('Status PUT:', result.status);
  } else {
    // CREATE nouveau
    console.log('Workflow non trouvé, création via POST...');
    const createBody = {
      name: 'LBC Scraping - Progressive Matching v3 (STABLE)',
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: { executionOrder: 'v1' }
    };
    console.log('Noeuds à envoyer:', createBody.nodes.length);
    result = await apiRequest('POST', '/api/v1/workflows', createBody);
    console.log('Status POST:', result.status);
  }

  if (result.status === 200 || result.status === 201) {
    console.log('✓ Workflow déployé avec succès !');
    console.log('  Nom:', result.data.name);
    console.log('  Noeuds:', result.data.nodes?.length);
    console.log('  ID:', result.data.id);
  } else {
    console.error('✗ Erreur:', JSON.stringify(result.data).substring(0, 500));
  }
}

main().catch(e => console.error('Fatal:', e.message));
