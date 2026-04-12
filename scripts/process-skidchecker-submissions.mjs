import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.resolve(__dirname, '..');
const websiteDir = path.join(workspaceDir, 'website');
const incomingRoot = path.join(websiteDir, 'data', 'skidcheckers', '_incoming');
const savedScanDataRoot = path.join(websiteDir, 'data', 'skidcheckers');
const savedScanPageRoot = path.join(websiteDir, 'skidchecker');
const savedScanTemplatePath = path.join(savedScanPageRoot, 'index.html');

await fs.mkdir(incomingRoot, { recursive: true });

const entries = await fs.readdir(incomingRoot, { withFileTypes: true });
const queuedFiles = entries
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
  .map((entry) => path.join(incomingRoot, entry.name));

if (!queuedFiles.length) {
  console.log('No queued SkidChecker scan submissions found.');
  process.exit(0);
}

for (const queuedFile of queuedFiles) {
  const payload = JSON.parse(await fs.readFile(queuedFile, 'utf8'));
  const savedScanId = normalizeSavedScanId(payload.savedScanId || payload.id);
  const scanDataDir = path.join(savedScanDataRoot, savedScanId);
  const scanPageDir = path.join(savedScanPageRoot, savedScanId);

  const persistedJob = {
    ...payload,
    id: savedScanId,
    savedScanId,
    savedAt: payload.savedAt || Date.now(),
    status: 'complete',
    progress: 100,
    currentStep: 'Analysis complete',
    error: null,
    steps: finalizeSteps(payload.steps || [])
  };

  await Promise.all([
    fs.mkdir(scanDataDir, { recursive: true }),
    fs.mkdir(scanPageDir, { recursive: true })
  ]);

  await Promise.all([
    fs.writeFile(path.join(scanDataDir, 'uuid.txt'), `${savedScanId}\n`, 'utf8'),
    fs.writeFile(path.join(scanDataDir, 'scan.dat'), JSON.stringify(persistedJob, null, 2), 'utf8'),
    writeSavedScanPage(scanPageDir)
  ]);

  await fs.rm(queuedFile, { force: true });
  console.log(`Persisted queued scan ${savedScanId}`);
}

function normalizeSavedScanId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(normalized)) {
    throw new Error(`Invalid saved scan id: ${value}`);
  }

  return normalized;
}

function finalizeSteps(steps) {
  return steps.map((step) => ({
    ...step,
    status: 'done'
  }));
}

async function writeSavedScanPage(scanPageDir) {
  const template = await fs.readFile(savedScanTemplatePath, 'utf8');
  const pageHtml = template
    .replace('href="../favicon.svg"', 'href="../../favicon.svg"')
    .replace('href="./styles.css"', 'href="../styles.css"')
    .replace('<script src="./config.js"></script>', '<script src="../config.js"></script>')
    .replace('<script type="module" src="./app.js"></script>', '<script type="module" src="../app.js"></script>');

  await fs.writeFile(path.join(scanPageDir, 'index.html'), pageHtml, 'utf8');
}