import { analyzeJarInBrowser, getBrowserCatalog } from './browser-scan.js';

const form = document.querySelector('#scan-form');
const input = document.querySelector('#modJar');
const button = document.querySelector('#submit-button');
const selectedFile = document.querySelector('#selected-file');

const fernflowerStatus = document.querySelector('#fernflower-status');

const progressLabel = document.querySelector('#progress-label');
const progressValue = document.querySelector('#progress-value');
const progressFill = document.querySelector('#progress-fill');
const progressRing = document.querySelector('#progress-ring');
const scanStage = document.querySelector('#scan-stage');
const scanDetail = document.querySelector('#scan-detail');
const progressSteps = document.querySelector('#progress-steps');

const resultStatus = document.querySelector('#result-status');
const resultTitle = document.querySelector('#result-title');
const resultSummary = document.querySelector('#result-summary');
const scorePill = document.querySelector('#score-pill');
const certaintyValue = document.querySelector('#certainty-value');
const verdictValue = document.querySelector('#verdict-value');
const familyValue = document.querySelector('#family-value');
const filesValue = document.querySelector('#files-value');
const checksValue = document.querySelector('#checks-value');
const resultDownloadRegular = document.querySelector('#result-download-regular');
const resultDownloadDeobfuscated = document.querySelector('#result-download-deobfuscated');
const resultShareLink = document.querySelector('#result-share-link');
const resultUrlPanel = document.querySelector('#result-url-panel');
const resultUrlList = document.querySelector('#result-url-list');

const detectionsContainer = document.querySelector('#detections');
const checksGrid = document.querySelector('#checks-grid');
const catalogGrid = document.querySelector('#catalog-grid');

const stepTemplate = document.querySelector('#step-template');
const detectionTemplate = document.querySelector('#detection-template');
const checkTemplate = document.querySelector('#check-template');
const catalogTemplate = document.querySelector('#catalog-template');
const sourceDialog = document.querySelector('#source-dialog');
const sourceDialogTitle = document.querySelector('#source-dialog-title');
const sourceDialogMeta = document.querySelector('#source-dialog-meta');
const sourceDialogCode = document.querySelector('#source-dialog-code');
const sourceDialogClose = document.querySelector('#source-dialog-close');
const sourceDialogWebhooks = document.querySelector('#source-dialog-webhooks');
const sourceDialogWebhookList = document.querySelector('#source-dialog-webhook-list');

const runtimeConfig = window.SKIDCHECKER_CONFIG || {};
let apiBaseUrl = normalizeApiBaseUrl(runtimeConfig.apiBaseUrl || '');
const githubPersistenceConfig = normalizeGithubPersistenceConfig(runtimeConfig.githubPersistence || {});
const initialRouteState = getRouteState(window.location.pathname);
const siteRootPath = initialRouteState.siteRootPath;

let activeJobId = null;
let pollTimer = null;
let activeSourceDetection = null;
let currentUploadedFile = null;
let activeDownloadBundle = null;
let activeSavedScanId = initialRouteState.savedScanId;
let activeShareUrl = activeSavedScanId ? buildSavedScanPath(activeSavedScanId) : '';

boot();
bindEvents();

function bindEvents() {
  input.addEventListener('change', () => {
    currentUploadedFile = input.files?.[0] || null;
    selectedFile.textContent = currentUploadedFile?.name || 'No file selected';
    syncDownloadActions({ regularEnabled: false, deobfuscatedEnabled: false });
  });

  sourceDialogClose?.addEventListener('click', closeSourceViewer);
  resultDownloadRegular?.addEventListener('click', () => downloadWholeMod('regular'));
  resultDownloadDeobfuscated?.addEventListener('click', () => downloadWholeMod('deobfuscated'));
  sourceDialog?.addEventListener('click', (event) => {
    if (event.target === sourceDialog) {
      closeSourceViewer();
    }
  });
  sourceDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSourceViewer();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!input.files?.length) {
      return;
    }

    clearPolling();
    currentUploadedFile = input.files[0];
    activeDownloadBundle = null;
    activeSavedScanId = null;
    activeShareUrl = '';
    syncDownloadActions({ regularEnabled: false, deobfuscatedEnabled: false });
    syncShareLink();

    const formData = new FormData();
    formData.append('modJar', input.files[0]);

    button.disabled = true;
    button.textContent = 'Preparing analysis...';
    setProgressShell({
      label: 'Queued',
      progress: 4,
      stage: 'Preparing analysis',
      detail: `${input.files[0].name} has been queued for decompilation and rule evaluation.`
    });

    try {
      if (!apiBaseUrl) {
        await runBrowserModeAnalysis(input.files[0]);
        return;
      }

      const response = await apiFetch('/api/scan', {
        method: 'POST',
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Scan failed.');
      }

      activeJobId = payload.id;
      renderJob(payload);
      button.textContent = 'Analysis in progress...';
      startPolling(payload.id);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Start analysis';
      showErrorState(input.files[0].name, error.message);
    }
  });
}

async function boot() {
  if (!apiBaseUrl && isLocalHost(window.location.hostname)) {
    apiBaseUrl = await detectLocalApiBaseUrl();
  }

  if (!apiBaseUrl) {
    fernflowerStatus.textContent = 'Browser mode';
    renderCatalog(getBrowserCatalog());
  } else {
    try {
      const [healthResponse, catalogResponse] = await Promise.all([
        apiFetch('/api/health'),
        apiFetch('/api/catalog')
      ]);
      const healthPayload = await healthResponse.json();
      const catalogPayload = await catalogResponse.json();

      fernflowerStatus.textContent = healthPayload.fernflowerReady ? 'Ready' : 'Missing jar';
      renderCatalog(catalogPayload.checks || []);
    } catch {
      fernflowerStatus.textContent = apiBaseUrl ? 'API unavailable' : 'API not configured';
      catalogGrid.className = 'catalog-grid empty-state';
      catalogGrid.textContent = apiBaseUrl
        ? 'The check catalog is currently unavailable.'
        : 'Set window.SKIDCHECKER_CONFIG.apiBaseUrl in config.js to connect this GitHub Pages frontend to a hosted API.';
    }
  }

  if (initialRouteState.savedScanId) {
    await loadSavedScan(initialRouteState.savedScanId);
  }
}

async function loadSavedScan(scanId) {
  setProgressShell({
    label: 'Loading',
    progress: 100,
    stage: 'Loading saved scan',
    detail: `Retrieving persisted report ${scanId}.`
  });

  try {
    const response = await fetch(buildSavedScanDataPath(scanId), {
      cache: 'no-store'
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Saved scan could not be loaded.');
    }

    activeSavedScanId = payload.savedScanId || payload.id || scanId;
    activeShareUrl = buildSavedScanPath(activeSavedScanId);
    renderJob(payload);
  } catch (error) {
    showErrorState(`Saved scan ${scanId}`, error.message || 'Saved scan could not be loaded.');
  }
}

async function runBrowserModeAnalysis(file) {
  const completedSteps = buildCompletedBrowserSteps();
  const placeholderJob = {
    fileName: file.name,
    status: 'running',
    progress: 4,
    currentStep: 'Preparing browser analysis',
    steps: []
  };

  renderJob(placeholderJob);
  button.textContent = 'Analysis in progress...';

  const result = await analyzeJarInBrowser(file, ({ progress, currentStep, steps }) => {
    renderJob({
      fileName: file.name,
      status: 'running',
      progress,
      currentStep,
      steps
    });
  });

  activeDownloadBundle = {
    originalFile: file,
    deobfuscatedArchiveBlob: result.deobfuscatedArchiveBlob || null,
    deobfuscatedArchiveName: result.deobfuscatedArchiveName || null
  };

  let persistedJob = null;
  if (shouldPersistBrowserScanToGitHub()) {
    button.textContent = 'Publishing report...';
    setProgressShell({
      label: 'Publishing',
      progress: 98,
      stage: 'Queueing GitHub persistence',
      detail: 'Submitting the completed scan to the repository so GitHub Actions can publish a shareable report.'
    });

    try {
      persistedJob = await queueBrowserScanForGithubPersistence({
        fileName: file.name,
        result,
        steps: completedSteps
      });
    } catch (error) {
      renderJob({
        fileName: file.name,
        status: 'complete',
        progress: 100,
        currentStep: 'Analysis complete',
        steps: completedSteps,
        result
      });
      setProgressShell({
        label: 'Complete',
        progress: 100,
        stage: 'Analysis complete',
        detail: `Analysis completed, but GitHub persistence failed: ${error.message}`
      });
      button.disabled = false;
      button.textContent = 'Start analysis';
      return;
    }
  }

  renderJob({
    fileName: file.name,
    status: 'complete',
    progress: 100,
    currentStep: 'Analysis complete',
    steps: completedSteps,
    result,
    savedScanId: persistedJob?.savedScanId || null
  });

  button.disabled = false;
  button.textContent = 'Start analysis';

  if (persistedJob?.savedScanId) {
    setProgressShell({
      label: 'Publishing',
      progress: 100,
      stage: 'Waiting for GitHub Pages',
      detail: `Queued scan ${persistedJob.savedScanId} for GitHub Actions publishing. Waiting for the shareable page to go live.`
    });

    const published = await waitForPublishedScan(persistedJob.savedScanId);
    if (published) {
      window.location.assign(buildSavedScanPath(persistedJob.savedScanId));
      return;
    }

    setProgressShell({
      label: 'Published Pending',
      progress: 100,
      stage: 'Waiting for GitHub Pages',
      detail: `The scan was queued for GitHub Actions as ${persistedJob.savedScanId}. The Pages deploy has not finished yet; open the saved scan link in a minute.`
    });
  }
}

function buildCompletedBrowserSteps() {
  return [
    { id: 'load', label: 'Load archive', confidence: 100, status: 'done', detail: 'Completed.' },
    { id: 'enumerate', label: 'Enumerate files', confidence: 94, status: 'done', detail: 'Completed.' },
    { id: 'checks', label: 'Run browser checks', confidence: 78, status: 'done', detail: 'Completed.' },
    { id: 'score', label: 'Score verdict', confidence: 76, status: 'done', detail: 'Completed.' }
  ];
}

function startPolling(jobId) {
  pollTimer = window.setInterval(async () => {
    try {
      const response = await apiFetch(`/api/scan/${jobId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Status check failed.');
      }

      renderJob(payload);

      if (payload.status === 'complete' || payload.status === 'failed') {
        clearPolling();
        button.disabled = false;
        button.textContent = 'Start analysis';

        const nextShareUrl = payload.savedScanId ? buildSavedScanPath(payload.savedScanId) : '';
        if (payload.status === 'complete' && nextShareUrl && getRouteState(window.location.pathname).savedScanId !== payload.savedScanId) {
          window.location.assign(nextShareUrl);
          return;
        }
      }
    } catch (error) {
      clearPolling();
      button.disabled = false;
      button.textContent = 'Start analysis';
      showErrorState(activeJobId || 'Scan', error.message);
    }
  }, 850);
}

function clearPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function renderJob(job) {
  activeSavedScanId = job.savedScanId || activeSavedScanId || null;
  activeShareUrl = activeSavedScanId ? buildSavedScanPath(activeSavedScanId) : '';
  syncShareLink();

  setProgressShell({
    label: job.status,
    progress: job.progress,
    stage: job.currentStep,
    detail: buildJobDetail(job)
  });
  renderSteps(job.steps || []);

  if (job.status === 'complete' && job.result) {
    renderResult(job.result);
    return;
  }

  if (job.status === 'failed') {
    showErrorState(job.fileName, job.error || 'Scan failed.');
    return;
  }

  renderPendingResult(job.fileName, job.status, job.currentStep);
}

function buildJobDetail(job) {
  if (job.status === 'failed') {
    return job.error || 'The analysis did not complete successfully.';
  }

  const activeStep = (job.steps || []).find((step) => step.status === 'active');
  if (activeStep?.detail) {
    return activeStep.detail;
  }

  return 'The file is being decompiled and evaluated against the active detection rules.';
}

function setProgressShell({ label, progress, stage, detail }) {
  progressLabel.textContent = humanize(label);
  progressValue.textContent = `${progress}%`;
  progressFill.style.width = `${progress}%`;
  progressRing.style.setProperty('--progress', `${progress}%`);
  scanStage.textContent = stage;
  scanDetail.textContent = detail;
}

function renderSteps(steps) {
  progressSteps.replaceChildren();

  if (!steps.length) {
    return;
  }

  for (const step of steps) {
    const node = stepTemplate.content.cloneNode(true);
    const item = node.querySelector('.step-item');
    item.classList.add(step.status);
    node.querySelector('.step-title').textContent = step.label;
    node.querySelector('.step-confidence').textContent = `${step.confidence}% confidence`;
    node.querySelector('.step-detail').textContent = step.detail || defaultStepDetail(step.status);
    progressSteps.append(node);
  }
}

function renderPendingResult(fileName, status, currentStep) {
  closeSourceViewer();
  syncDownloadActions({ regularEnabled: false, deobfuscatedEnabled: false });
  syncShareLink();
  renderResultUrls([]);
  resultStatus.textContent = humanize(status);
  resultTitle.textContent = fileName || 'Awaiting result';
  resultSummary.textContent = currentStep || 'Analysis has started, but no verdict is available yet.';
  scorePill.textContent = '--';
  certaintyValue.textContent = '--';
  verdictValue.textContent = humanize(status);
  familyValue.textContent = '-';
  filesValue.textContent = '-';
  checksValue.textContent = '-';
  detectionsContainer.className = 'detections empty-state';
  detectionsContainer.textContent = 'Detections will appear here when analysis is complete.';
  checksGrid.className = 'checks-grid empty-state';
  checksGrid.textContent = 'The full check matrix will appear after source analysis completes.';
}

function renderResult(result) {
  closeSourceViewer();
  syncDownloadActions({
    regularEnabled: Boolean(currentUploadedFile),
    deobfuscatedEnabled: Boolean(result?.deobfuscatedArchiveBlob || activeDownloadBundle?.deobfuscatedArchiveBlob)
  });
  syncShareLink();
  resultStatus.textContent = humanize(result.verdict);
  resultTitle.textContent = result.fileName;
  resultSummary.textContent = buildSummary(result);
  scorePill.textContent = String(result.score ?? 0);
  certaintyValue.textContent = `${result.certainty ?? 0}%`;
  verdictValue.textContent = humanize(result.verdict);
  familyValue.textContent = result.primaryFamily || '-';
  filesValue.textContent = String(result.sourceFileCount ?? '-');
  checksValue.textContent = `${result.matchedCheckCount ?? 0}/${result.checks?.length ?? 0}`;

  renderResultUrls(result.urls || []);
  renderDetections(result.detections || []);
  renderChecks(result.checks || []);
}

function renderDetections(detections) {
  detectionsContainer.replaceChildren();

  if (!detections.length) {
    detectionsContainer.className = 'detections empty-state';
    detectionsContainer.textContent = 'No matched signatures were identified in the decompiled source.';
    return;
  }

  detectionsContainer.className = 'detections';

  for (const detection of detections.sort((left, right) => right.confidence - left.confidence)) {
    const node = detectionTemplate.content.cloneNode(true);
    const severity = node.querySelector('.severity');
    severity.textContent = detection.severity;
    severity.classList.add(detection.severity);
    node.querySelector('.family').textContent = detection.family;
    node.querySelector('.confidence').textContent = `${detection.confidence}% certain`;
    node.querySelector('.detection-title').textContent = detection.label;
    node.querySelector('.description').textContent = detection.description;
    node.querySelector('.rationale').textContent = detection.rationale;
    node.querySelector('.file').textContent = formatSourceLocation(detection);
    node.querySelector('.snippet').textContent = detection.snippet;

    const sourceButton = node.querySelector('.source-button');
    if (detection.fullSource) {
      sourceButton.addEventListener('click', () => openSourceViewer(detection));
    } else {
      sourceButton.remove();
    }

    const webhookPanel = node.querySelector('.webhook-panel');
    const webhookList = node.querySelector('.webhook-list');
    const detectionUrls = detection.urls?.length ? detection.urls : detection.webhooks || [];
    if (detectionUrls.length) {
      renderUrlList(webhookList, detectionUrls);
      webhookPanel.hidden = false;
    } else {
      webhookPanel.remove();
    }

    detectionsContainer.append(node);
  }
}

function renderChecks(checks) {
  checksGrid.replaceChildren();

  if (!checks.length) {
    checksGrid.className = 'checks-grid empty-state';
    checksGrid.textContent = 'No checks are available for this analysis.';
    return;
  }

  checksGrid.className = 'checks-grid';

  for (const check of checks.sort(sortChecks)) {
    const node = checkTemplate.content.cloneNode(true);
    const card = node.querySelector('.check-card');
    card.classList.add(check.matched ? 'matched' : 'unmatched');

    const state = node.querySelector('.check-state');
    state.textContent = check.matched ? 'Matched' : 'Not detected';
    state.classList.add(check.matched ? 'matched' : 'unmatched');

    node.querySelector('.check-label').textContent = check.label;
    node.querySelector('.check-severity').textContent = check.severity;
    node.querySelector('.check-family').textContent = check.family;
    node.querySelector('.check-confidence').textContent = `${check.confidence}%`;
    node.querySelector('.check-rationale').textContent = check.rationale;

    const evidence = node.querySelector('.check-evidence');
    evidence.textContent = check.matched
      ? `${check.file}: ${check.evidence}`
      : 'No matching source fragment was identified in this analysis.';

    node.querySelector('.confidence-bar span').style.width = `${check.confidence}%`;
    checksGrid.append(node);
  }
}

function showErrorState(fileName, message) {
  closeSourceViewer();
  syncDownloadActions({ regularEnabled: false, deobfuscatedEnabled: false });
  activeShareUrl = '';
  syncShareLink();
  setProgressShell({
    label: 'Failed',
    progress: 100,
    stage: 'Analysis failed',
    detail: message
  });

  resultStatus.textContent = 'Failed';
  resultTitle.textContent = fileName || 'Scan error';
  resultSummary.textContent = message;
  scorePill.textContent = '!!';
  certaintyValue.textContent = '--';
  verdictValue.textContent = 'Error';
  familyValue.textContent = '-';
  filesValue.textContent = '-';
  checksValue.textContent = '-';
  renderResultUrls([]);
  detectionsContainer.className = 'detections empty-state';
  detectionsContainer.textContent = 'The analysis failed before detections could be generated.';
  checksGrid.className = 'checks-grid empty-state';
  checksGrid.textContent = 'No per-check matrix is available because the analysis did not complete.';
}

function formatSourceLocation(detection) {
  if (!detection?.file) {
    return 'Unknown source file';
  }

  if (typeof detection.lineNumber === 'number' && typeof detection.columnNumber === 'number') {
    return `${detection.file} • line ${detection.lineNumber}, column ${detection.columnNumber}`;
  }

  return detection.file;
}

function openSourceViewer(detection) {
  if (!sourceDialog || !detection?.fullSource) {
    return;
  }

  activeSourceDetection = detection;
  sourceDialogTitle.textContent = detection.file || 'Source file';
  sourceDialogMeta.textContent = formatSourceLocation(detection);
  renderSourceDialogWebhooks(detection.urls?.length ? detection.urls : detection.webhooks || []);
  renderHighlightedSource(sourceDialogCode, detection.fullSource, detection.matchIndex, detection.matchLength);

  if (!sourceDialog.open) {
    sourceDialog.showModal();
  }

  requestAnimationFrame(() => {
    const highlight = sourceDialogCode.querySelector('.source-highlight');
    if (highlight) {
      highlight.scrollIntoView({ block: 'center', inline: 'nearest' });
    } else {
      sourceDialogCode.scrollTop = 0;
      sourceDialogCode.scrollLeft = 0;
    }
  });
}

function closeSourceViewer() {
  activeSourceDetection = null;
  if (sourceDialog?.open) {
    sourceDialog.close();
  }

  if (sourceDialogCode) {
    sourceDialogCode.replaceChildren();
    sourceDialogCode.textContent = '';
  }

  if (sourceDialogWebhookList) {
    sourceDialogWebhookList.replaceChildren();
  }

  if (sourceDialogWebhooks) {
    sourceDialogWebhooks.hidden = true;
  }
}

function renderHighlightedSource(container, source, matchIndex = 0, matchLength = 0) {
  container.replaceChildren();
  container.scrollTop = 0;
  container.scrollLeft = 0;

  const normalizedIndex = Number.isInteger(matchIndex) && matchIndex >= 0 ? matchIndex : 0;
  const normalizedLength = Number.isInteger(matchLength) && matchLength > 0 ? matchLength : 0;

  if (!normalizedLength) {
    container.textContent = source;
    return;
  }

  const start = Math.min(normalizedIndex, source.length);
  const end = Math.min(start + normalizedLength, source.length);

  container.append(document.createTextNode(source.slice(0, start)));

  const highlight = document.createElement('mark');
  highlight.className = 'source-highlight';
  highlight.textContent = source.slice(start, end);
  container.append(highlight);

  container.append(document.createTextNode(source.slice(end)));
}

function renderSourceDialogWebhooks(webhooks) {
  if (!sourceDialogWebhooks || !sourceDialogWebhookList) {
    return;
  }

  sourceDialogWebhookList.replaceChildren();

  if (!webhooks.length) {
    sourceDialogWebhooks.hidden = true;
    return;
  }

  renderUrlList(sourceDialogWebhookList, webhooks);
  sourceDialogWebhooks.hidden = false;
}

function renderResultUrls(urlEntries) {
  if (!resultUrlPanel || !resultUrlList) {
    return;
  }

  resultUrlList.replaceChildren();

  if (!urlEntries.length) {
    resultUrlPanel.hidden = true;
    return;
  }

  renderUrlList(resultUrlList, urlEntries);
  resultUrlPanel.hidden = false;
}

function renderUrlList(container, urls) {
  container.replaceChildren();

  for (const urlEntry of urls) {
    const item = document.createElement('li');
    item.className = 'webhook-item';

    const code = document.createElement('code');
    code.textContent = formatUrlEntry(urlEntry);
    item.append(code);

    container.append(item);
  }
}

function formatUrlEntry(urlEntry) {
  if (typeof urlEntry === 'string') {
    return urlEntry;
  }

  if (urlEntry?.file && urlEntry?.url) {
    const suffix = urlEntry.service ? ` (${urlEntry.service}${urlEntry.matchedDomain ? ` via ${urlEntry.matchedDomain}` : ''})` : '';
    return `${urlEntry.file}: ${urlEntry.url}${suffix}`;
  }

  return urlEntry?.url || '';
}

function downloadWholeMod(mode) {
  if (mode === 'regular') {
    if (!currentUploadedFile) {
      return;
    }

    downloadBlob(currentUploadedFile, currentUploadedFile.name);
    return;
  }

  const archiveBlob = activeDownloadBundle?.deobfuscatedArchiveBlob;
  const archiveName = activeDownloadBundle?.deobfuscatedArchiveName;
  if (!archiveBlob || !archiveName) {
    return;
  }

  downloadBlob(archiveBlob, archiveName);
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 250);
}

function syncDownloadActions({ regularEnabled, deobfuscatedEnabled }) {
  if (resultDownloadRegular) {
    resultDownloadRegular.disabled = !regularEnabled;
  }

  if (resultDownloadDeobfuscated) {
    resultDownloadDeobfuscated.disabled = !deobfuscatedEnabled;
  }
}

function syncShareLink() {
  if (!resultShareLink) {
    return;
  }

  if (!activeShareUrl || !activeSavedScanId) {
    resultShareLink.hidden = true;
    resultShareLink.removeAttribute('href');
    return;
  }

  resultShareLink.hidden = false;
  resultShareLink.href = activeShareUrl;
  resultShareLink.textContent = `Saved scan ${activeSavedScanId}`;
}

function buildSummary(result) {
  if (!result.detections?.length) {
    return 'No signature matched strongly enough to raise an alert under the current ruleset.';
  }

  const strongest = [...result.detections].sort((left, right) => right.confidence - left.confidence)[0];
  return `${humanize(result.verdict)} with ${result.certainty}% certainty. Strongest hit: ${strongest.label} in ${strongest.file}.`;
}

function defaultStepDetail(status) {
  if (status === 'done') {
    return 'Completed.';
  }

  if (status === 'active') {
    return 'In progress.';
  }

  if (status === 'failed') {
    return 'Failed.';
  }

  return 'Pending.';
}

function sortChecks(left, right) {
  if (left.matched !== right.matched) {
    return left.matched ? -1 : 1;
  }

  return right.confidence - left.confidence;
}

function humanize(value) {
  if (!value) {
    return 'Unknown';
  }

  return String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function apiFetch(path, options) {
  return fetch(`${apiBaseUrl}${path}`, options);
}

function normalizeApiBaseUrl(value) {
  if (!value) {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function detectLocalApiBaseUrl() {
  const candidate = normalizeApiBaseUrl(runtimeConfig.localApiBaseUrl || 'http://localhost:3000');

  try {
    const response = await fetch(`${candidate}/api/health`, {
      cache: 'no-store'
    });

    return response.ok ? candidate : '';
  } catch {
    return '';
  }
}

function normalizeGithubPersistenceConfig(value) {
  return {
    enabled: Boolean(value?.enabled),
    owner: String(value?.owner || '').trim(),
    repo: String(value?.repo || '').trim(),
    branch: String(value?.branch || 'main').trim() || 'main',
    token: String(value?.token || '').trim(),
    incomingRoot: String(value?.incomingRoot || 'website/data/skidcheckers/_incoming').trim() || 'website/data/skidcheckers/_incoming'
  };
}

function shouldPersistBrowserScanToGitHub() {
  if (!githubPersistenceConfig.enabled) {
    return false;
  }

  if (!githubPersistenceConfig.owner || !githubPersistenceConfig.repo || !githubPersistenceConfig.token) {
    return false;
  }

  return !isLocalHost(window.location.hostname);
}

function isLocalHost(hostname) {
  const normalized = String(hostname || '').toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized.endsWith('.local');
}

async function queueBrowserScanForGithubPersistence({ fileName, result, steps }) {
  const savedScanId = self.crypto?.randomUUID?.();
  if (!savedScanId) {
    throw new Error('Browser UUID generation is unavailable.');
  }

  const persistedJob = buildPersistedBrowserJob({
    savedScanId,
    fileName,
    result,
    steps
  });
  const requestPath = `${githubPersistenceConfig.incomingRoot}/${savedScanId}.json`;
  const response = await fetch(buildGithubContentsUrl(requestPath), {
    method: 'PUT',
    headers: buildGithubApiHeaders(),
    body: JSON.stringify({
      message: `Queue SkidChecker scan ${savedScanId}`,
      branch: githubPersistenceConfig.branch,
      content: encodeUtf8Base64(JSON.stringify(persistedJob, null, 2))
    })
  });

  if (!response.ok) {
    const message = await readGithubErrorMessage(response);
    throw new Error(message);
  }

  return persistedJob;
}

function buildPersistedBrowserJob({ savedScanId, fileName, result, steps }) {
  return {
    id: savedScanId,
    fileName,
    status: 'complete',
    progress: 100,
    currentStep: 'Analysis complete',
    createdAt: Date.now(),
    savedAt: Date.now(),
    steps,
    result,
    savedScanId,
    error: null
  };
}

function buildGithubContentsUrl(repoPath) {
  const encodedPath = repoPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://api.github.com/repos/${encodeURIComponent(githubPersistenceConfig.owner)}/${encodeURIComponent(githubPersistenceConfig.repo)}/contents/${encodedPath}`;
}

function buildGithubApiHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubPersistenceConfig.token}`,
    'Content-Type': 'application/json'
  };
}

function encodeUtf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function readGithubErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload?.message || `GitHub API request failed with ${response.status}.`;
  } catch {
    return `GitHub API request failed with ${response.status}.`;
  }
}

async function waitForPublishedScan(savedScanId) {
  const deadline = Date.now() + 180000;
  const targetUrl = buildSavedScanDataPath(savedScanId);

  while (Date.now() < deadline) {
    try {
      const response = await fetch(targetUrl, {
        cache: 'no-store'
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Keep polling until timeout.
    }

    await delay(5000);
  }

  return false;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getRouteState(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const skidcheckerIndex = segments.lastIndexOf('skidchecker');

  if (skidcheckerIndex === -1) {
    return {
      siteRootPath: '',
      savedScanId: null
    };
  }

  const siteRootSegments = segments.slice(0, skidcheckerIndex);
  const tailSegments = segments
    .slice(skidcheckerIndex + 1)
    .filter((segment) => segment.toLowerCase() !== 'index.html');
  const candidateId = tailSegments[0] || null;

  return {
    siteRootPath: siteRootSegments.length ? `/${siteRootSegments.join('/')}` : '',
    savedScanId: /^[0-9a-f-]{36}$/i.test(candidateId || '') ? candidateId.toLowerCase() : null
  };
}

function buildSitePath(relativePath) {
  const normalizedPath = relativePath.replace(/^\/+/, '');
  return `${siteRootPath}/${normalizedPath}`.replace(/\/+/g, '/');
}

function buildSavedScanPath(scanId) {
  return buildSitePath(`skidchecker/${encodeURIComponent(scanId)}/`);
}

function buildSavedScanDataPath(scanId) {
  return buildSitePath(`data/skidcheckers/${encodeURIComponent(scanId)}/scan.dat`);
}

function renderCatalog(checks) {
  catalogGrid.replaceChildren();

  if (!checks.length) {
    catalogGrid.className = 'catalog-grid empty-state';
    catalogGrid.textContent = 'No public check catalog is available.';
    return;
  }

  catalogGrid.className = 'catalog-grid';

  for (const check of checks.sort((left, right) => right.confidence - left.confidence)) {
    const node = catalogTemplate.content.cloneNode(true);
    node.querySelector('.catalog-label').textContent = check.label;
    node.querySelector('.catalog-severity').textContent = humanize(check.severity);
    node.querySelector('.catalog-family').textContent = check.family;
    node.querySelector('.catalog-confidence').textContent = `${check.confidence}% confidence`;
    node.querySelector('.catalog-description').textContent = check.description;
    node.querySelector('.catalog-rationale').textContent = check.rationale;
    catalogGrid.append(node);
  }
}