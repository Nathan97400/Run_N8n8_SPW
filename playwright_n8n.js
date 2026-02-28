const { chromium } = require('playwright');
const fs = require('fs');

const N8N_BASE = 'https://n8n-t0fe.onrender.com';
const WORKFLOW_ID = 'ssvlV5ZZsZemSOUB';
const WORKFLOW_FILE = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/Workflow/Workflow_PROGRESSIVE_MATCHING_v2_COMPLET.json';
const SCREENSHOT_DIR = 'C:/Users/natha/Documents/projets_claude-code/n8n_builders/';

// === METTRE TES IDENTIFIANTS ICI (si tu veux remplissage auto) ===
const EMAIL = '';    // ex: 'ton@email.com'
const PASSWORD = ''; // ex: 'monMotDePasse'
// ================================================================

async function screenshot(page, name) {
  const p = SCREENSHOT_DIR + name + '.png';
  await page.screenshot({ path: p, fullPage: false });
  console.log('Screenshot: ' + name + '.png');
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(300000); // 5 minutes

  console.log('Ouverture n8n Render...');
  await page.goto(`${N8N_BASE}/signin`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await screenshot(page, 'step01_login_page');

  // Remplissage automatique si identifiants fournis
  if (EMAIL && PASSWORD) {
    console.log('Remplissage auto des identifiants...');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    console.log('Identifiants soumis');
  } else {
    console.log('\n=== CONNECTE-TOI DANS LE NAVIGATEUR ===');
    console.log('J attends jusqu a 5 minutes...');
  }

  // Attendre la connexion
  try {
    await page.waitForURL(url => !String(url).includes('/signin'), { timeout: 300000 });
    console.log('Connecte ! URL:', page.url());
  } catch (e) {
    console.log('Timeout ou erreur:', e.message.substring(0, 100));
    await screenshot(page, 'step02_timeout');
    await browser.close();
    return;
  }

  await screenshot(page, 'step02_apres_login');

  // Navigation vers le workflow
  console.log('\nNavigation workflow...');
  await page.goto(`${N8N_BASE}/workflow/${WORKFLOW_ID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await screenshot(page, 'step03_workflow_avant');

  // Verifier si connecte via API
  const me = await page.evaluate(async () => {
    const r = await fetch('/rest/me', { credentials: 'include' });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, email: j.email || j.data?.email || '?' };
  });
  console.log('API /rest/me:', me.status, me.email);

  if (me.status !== 200) {
    console.log('Pas authentifie via API !');
    await browser.close();
    return;
  }

  // Import du workflow via PATCH API
  console.log('\nImport du workflow via API...');
  const workflowData = JSON.parse(fs.readFileSync(WORKFLOW_FILE, 'utf8'));

  const result = await page.evaluate(async (nodes, connections, name, wfId) => {
    const body = { nodes, connections, name };
    const r = await fetch('/rest/workflows/' + wfId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include'
    });
    const txt = await r.text();
    return { status: r.status, ok: r.ok, preview: txt.substring(0, 400) };
  }, workflowData.nodes, workflowData.connections, workflowData.name, WORKFLOW_ID);

  console.log('PATCH result:', result.status, result.ok);
  if (!result.ok) {
    console.log('Response preview:', result.preview);
  } else {
    console.log('Workflow importe avec succes !');
  }

  // Recharger et prendre screenshot final
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await screenshot(page, 'step04_apres_import');

  // Verifier les noeuds dans la page
  const nodeTexts = await page.locator('.node-box, [data-test-id="canvas-node"]').allTextContents().catch(() => []);
  console.log('Noeuds visibles:', nodeTexts.slice(0, 10));

  console.log('\n=== DONE ===');
  console.log('Fermeture dans 20 secondes...');
  await page.waitForTimeout(20000);
  await browser.close();
})();
