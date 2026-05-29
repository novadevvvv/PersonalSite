import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

const exactWeedhackPayload = [
  '"username":"',
  '","uuid":"',
  '","accessToken":"',
  '","minecraftInfo":"46c19a54-e52d-42c1-9c7f-eda984c69042"'
];

const urlPattern = /https?:\/\/[^\s"'`<>\\)\]}]+/gi;
const maliciousDomainFeedUrl = window.SKIDCHECKER_CONFIG?.maliciousDomainFeedUrl || 'https://synchole.net/api/baddomains';

let cachedMaliciousHostIndex = null;
let cachedMaliciousHostIndexExpiresAt = 0;

const signatures = [
  {
    id: 'weedhack-payload',
    label: 'Weedhack Credential Packaging Pattern',
    family: 'weedhack',
    severity: 'critical',
    confidence: 99,
    rationale: 'This payload structure is a high-fidelity family marker and is strongly associated with known Weedhack credential theft behavior.',
    description: 'Credential-packaging payload that collects username, UUID, access token, and a fixed minecraftInfo marker.',
    test(content) {
      return exactWeedhackPayload.every((fragment) => content.includes(fragment));
    }
  },
  {
    id: 'minecraft-session-token-access',
    label: 'Obfuscated Session Token Access',
    family: 'session-token-access',
    severity: 'critical',
    confidence: 97,
    rationale: 'Direct access to the session token through obfuscated client internals is highly abnormal for legitimate mods and materially increases credential theft risk.',
    description: 'Obfuscated Minecraft session token accessor method_1674() detected. This should never be invoked by a mod scanner.',
    test(content) {
      return /(?:^|[^\w])method_1674\s*\(/.test(content);
    }
  },
  {
    id: 'minecraft-token-collection',
    label: 'Minecraft Credential Aggregation',
    family: 'credential-collection',
    severity: 'high',
    confidence: 90,
    rationale: 'The combined handling of username, UUID, and access token values is strongly correlated with account takeover and credential exfiltration workflows.',
    description: 'Source combines Minecraft account identifiers with an access token into a serialized payload.',
    test(content) {
      return /accessToken/i.test(content) && /uuid/i.test(content) && /username/i.test(content);
    }
  },
  {
    id: 'session-object-access',
    label: 'Session Object Abuse',
    family: 'minecraft-session-abuse',
    severity: 'high',
    confidence: 87,
    rationale: 'Session access becomes materially more suspicious when it is paired with token extraction, profile identifiers, or obfuscated accessor patterns.',
    description: 'Minecraft session object access combined with token or profile extraction.',
    test(content) {
      return /(getSession\s*\(|session\s*[=.]|class_320)/.test(content) && /(accessToken|token|uuid|username|method_1674)/i.test(content);
    }
  },
  {
    id: 'launcher-account-file-access',
    label: 'Launcher Account Store Access',
    family: 'launcher-account-theft',
    severity: 'high',
    confidence: 84,
    rationale: 'References to launcher account stores are a recurring precursor to credential harvesting across Minecraft-focused malware families.',
    description: 'References launcher or account files commonly harvested by stealer mods.',
    test(content) {
      return /launcher_profiles\.json|accounts\.json|minecraftcredentials|Tlauncher|feather|lunarclient/i.test(content);
    }
  },
  {
    id: 'discord-webhook',
    label: 'Discord Webhook Exfiltration',
    family: 'exfiltration',
    severity: 'high',
    confidence: 91,
    rationale: 'Hardcoded Discord webhooks are a widely used exfiltration channel for low-complexity stealers and unauthorized telemetry.',
    description: 'Discord webhook reference detected.',
    test(content) {
      return /discord(?:app)?\.com\/api\/webhooks|discord\.com\/api\/webhooks/i.test(content);
    }
  },
  {
    id: 'token-post-body',
    label: 'Outbound Credential Transmission Body',
    family: 'credential-exfiltration',
    severity: 'high',
    confidence: 88,
    rationale: 'Serialized request bodies that package token material for outbound transport are a strong indicator of credential transmission.',
    description: 'Serialized request body appears to package tokens or account identifiers for outbound transmission.',
    test(content) {
      return /\{\\?"(?:username|uuid|accessToken|token)\\?":/.test(content) || /accessToken.{0,120}(HttpURLConnection|URL|POST|webhook)/is.test(content);
    }
  },
  {
    id: 'browser-cookie-targeting',
    label: 'Browser Credential Store Targeting',
    family: 'credential-theft',
    severity: 'high',
    confidence: 82,
    rationale: 'Browser cookie stores and login databases have no clear relationship to legitimate mod functionality and are commonly targeted by stealers.',
    description: 'Browser cookie or local storage paths referenced from a mod context.',
    test(content) {
      return /Cookies|Local Storage|Login Data|Network\\Cookies|Google\\Chrome|Opera Stable|Mozilla\\Firefox/i.test(content);
    }
  },
  {
    id: 'powershell-launch',
    label: 'PowerShell Execution Path',
    family: 'loader',
    severity: 'medium',
    confidence: 74,
    rationale: 'PowerShell use is not inherently malicious, but it remains a common execution path for loaders, droppers, and off-box retrieval logic.',
    description: 'PowerShell execution string detected inside the decompiled source.',
    test(content) {
      return /powershell(?:\.exe)?/i.test(content);
    }
  },
  {
    id: 'secondary-payload-retrieval',
    label: 'Secondary Payload Retrieval',
    family: 'downloader',
    severity: 'high',
    confidence: 86,
    rationale: 'Download or write paths for DLL, EXE, BAT, or PS1 files from a mod context are strongly associated with staged malware delivery.',
    description: 'Downloads or writes secondary payloads such as DLL, EXE, BAT, or PS1 files.',
    test(content) {
      return /(URL|HttpURLConnection|HttpClient|OkHttpClient).{0,160}(\.dll|\.exe|\.bat|\.ps1|AppData|Temp)/is.test(content);
    }
  },
  {
    id: 'external-process-invocation',
    label: 'External Process Invocation',
    family: 'process-spawn',
    severity: 'medium',
    confidence: 71,
    rationale: 'External process spawning is frequently abused by loaders and droppers, although limited benign use cases do exist.',
    description: 'Runtime command execution detected.',
    test(content) {
      return /Runtime\.getRuntime\(\)\.exec|ProcessBuilder\s*\(/.test(content);
    }
  },
  {
    id: 'obfuscated-string-decoding',
    label: 'Obfuscated String Decoding with Execution',
    family: 'obfuscation',
    severity: 'medium',
    confidence: 68,
    rationale: 'Encoded string decoding is common in isolation, but becomes materially more suspicious when combined with networking or execution primitives.',
    description: 'Base64 decoding combined with networking or process spawning suggests string-obfuscated payload logic.',
    test(content) {
      return /(Base64\.getDecoder\(|decodeBase64|DatatypeConverter\.parseBase64Binary)/.test(content)
        && /(HttpURLConnection|java\.net\.URL|Runtime\.getRuntime\(\)\.exec|ProcessBuilder)/.test(content);
    }
  },
  {
    id: 'system-identifier-collection',
    label: 'System Identifier Collection',
    family: 'tracking',
    severity: 'medium',
    confidence: 63,
    rationale: 'System identifier collection can support victim tracking, access gating, or crude licensing controls, and warrants review in mod code.',
    description: 'Collects machine identifiers often used for licensing abuse or victim tracking.',
    test(content) {
      return /PROCESSOR_IDENTIFIER|COMPUTERNAME|wmic csproduct get uuid|MachineGuid|user\.name|os\.name/i.test(content);
    }
  },
  {
    id: 'generic-network-communication',
    label: 'Generic Network Communication',
    family: 'networking',
    severity: 'medium',
    confidence: 45,
    rationale: 'Network communication on its own is weak evidence and should be interpreted as supporting context rather than a standalone indicator.',
    description: 'HTTP client or URLConnection activity detected.',
    test(content) {
      return /HttpURLConnection|java\.net\.URL|OkHttpClient|HttpClient/.test(content);
    }
  }
];

const severityWeight = {
  critical: 90,
  high: 65,
  medium: 35,
  low: 15
};

export function getBrowserCatalog() {
  return signatures.map((signature) => ({
    id: signature.id,
    label: signature.label,
    family: signature.family,
    severity: signature.severity,
    confidence: signature.confidence,
    description: signature.description,
    rationale: signature.rationale
  }));
}

export async function analyzeJarInBrowser(file, onProgress) {
  const maliciousHostIndex = await getMaliciousHostIndex();
  const steps = createSteps();
  markStep(steps, 'load', 'active', 'Reading the uploaded archive in the browser.');
  onProgress?.({ progress: 8, currentStep: 'Loading archive', steps });

  const archiveBytes = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(archiveBytes);

  markStep(steps, 'load', 'done', 'Archive loaded successfully.');
  markStep(steps, 'enumerate', 'active', 'Enumerating files contained in the jar.');
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  onProgress?.({ progress: 28, currentStep: 'Enumerating archive entries', steps });

  const extractedFiles = [];
  let processed = 0;

  for (const entry of entries) {
    const content = await readEntryContent(entry);
    if (content) {
      extractedFiles.push({
        relativePath: entry.name,
        content,
        kind: isTextEntry(entry.name) ? 'text' : 'binary-strings'
      });
    }

    processed += 1;
    if (processed === 1 || processed % 8 === 0 || processed === entries.length) {
      markStep(steps, 'enumerate', 'active', `Processed ${processed} of ${entries.length} files.`);
      onProgress?.({
        progress: Math.min(58, 28 + Math.round((processed / Math.max(entries.length, 1)) * 30)),
        currentStep: 'Extracting readable content',
        steps
      });
    }
  }

  markStep(steps, 'enumerate', 'done', `Processed ${entries.length} archive entries.`);
  markStep(steps, 'checks', 'active', 'Evaluating browser-mode detection rules.');
  onProgress?.({ progress: 72, currentStep: 'Running detection checks', steps });

  const result = scanExtractedContent(extractedFiles, maliciousHostIndex);

  markStep(steps, 'checks', 'done', `${result.matchedCheckCount} checks matched out of ${result.checks.length}.`);
  markStep(steps, 'score', 'active', 'Calculating formal verdict and certainty score.');
  onProgress?.({ progress: 90, currentStep: 'Scoring verdict', steps });

  markStep(steps, 'score', 'done', `Verdict: ${result.verdict}.`);
  onProgress?.({ progress: 100, currentStep: 'Analysis complete', steps });

  const deobfuscatedArchive = await buildDeobfuscatedArchive(file.name, extractedFiles, result.detections);

  return {
    fileName: file.name,
    sourceFileCount: extractedFiles.length,
    mode: 'browser',
    deobfuscatedArchiveBlob: deobfuscatedArchive.blob,
    deobfuscatedArchiveName: deobfuscatedArchive.fileName,
    ...result
  };
}

function createSteps() {
  return [
    { id: 'load', label: 'Load archive', confidence: 100, status: 'pending', detail: '' },
    { id: 'enumerate', label: 'Enumerate files', confidence: 94, status: 'pending', detail: '' },
    { id: 'checks', label: 'Run browser checks', confidence: 78, status: 'pending', detail: '' },
    { id: 'score', label: 'Score verdict', confidence: 76, status: 'pending', detail: '' }
  ];
}

function markStep(steps, stepId, status, detail) {
  for (const step of steps) {
    if (step.id === stepId) {
      step.status = status;
      step.detail = detail;
    } else if (status === 'active' && step.status === 'active') {
      step.status = 'done';
    }
  }
}

async function readEntryContent(entry) {
  if (isTextEntry(entry.name)) {
    try {
      return await entry.async('string');
    } catch {
      return null;
    }
  }

  if (isBinaryStringEntry(entry.name)) {
    try {
      const bytes = await entry.async('uint8array');
      return decodeBinaryStrings(bytes);
    } catch {
      return null;
    }
  }

  return null;
}

function isTextEntry(name) {
  return /\.(txt|json|cfg|toml|xml|mcmeta|properties|yml|yaml|java|kt|js|ts|gradle|md)$/i.test(name);
}

function isBinaryStringEntry(name) {
  return /\.(class|mf)$/i.test(name);
}

function decodeBinaryStrings(bytes) {
  let output = '';
  let current = '';

  for (const byte of bytes) {
    if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
      current += String.fromCharCode(byte);
      continue;
    }

    if (current.length >= 4) {
      output += `${current}\n`;
    }
    current = '';
  }

  if (current.length >= 4) {
    output += current;
  }

  return output;
}

function scanExtractedContent(files, maliciousHostIndex = new Map()) {
  const detections = [];
  const checks = [];
  const urlEntries = collectMaliciousUrlEntries(files, maliciousHostIndex);

  for (const signature of signatures) {
    const match = files.find((file) => signature.test(file.content));
    const location = match ? locateMatch(match.content, signature.id) : null;
    const deobfuscatedSource = match ? deobfuscateSource(match.content) : null;
    const urls = deobfuscatedSource ? extractMaliciousUrls(deobfuscatedSource, maliciousHostIndex) : [];
    const webhooks = urls.filter(isDiscordWebhookUrl);

    checks.push({
      id: signature.id,
      label: signature.label,
      family: signature.family,
      severity: signature.severity,
      confidence: signature.confidence,
      rationale: signature.rationale,
      matched: Boolean(match),
      file: match?.relativePath ?? null,
      evidence: match ? buildSnippet(match.content, signature.id) : null,
      urls
    });

    if (!match) {
      continue;
    }

    detections.push({
      id: signature.id,
      label: signature.label,
      family: signature.family,
      severity: signature.severity,
      confidence: signature.confidence,
      rationale: signature.rationale,
      description: signature.description,
      file: match.relativePath,
      snippet: buildSnippet(match.content, signature.id, location),
      fullSource: match.content,
      deobfuscatedSource,
      urls,
      webhooks,
      matchIndex: location?.index ?? 0,
      matchLength: location?.length ?? 0,
      lineNumber: getLineNumber(match.content, location?.index ?? 0),
      columnNumber: getColumnNumber(match.content, location?.index ?? 0)
    });
  }

  const distinctFamilies = [...new Set(detections.map((entry) => entry.family))];
  const score = Math.min(
    100,
    detections.reduce((total, entry) => total + Math.round((severityWeight[entry.severity] ?? 0) * (entry.confidence / 100)), 0)
  );
  const certainty = detections.length
    ? Math.min(99, Math.round(detections.reduce((total, entry) => total + entry.confidence, 0) / detections.length))
    : 8;

  return {
    score,
    certainty,
    verdict: score >= 90 ? 'malicious' : score >= 50 ? 'suspicious' : score > 0 ? 'review-recommended' : 'low-risk',
    primaryFamily: distinctFamilies[0] ?? null,
    matchedCheckCount: detections.length,
    urls: urlEntries,
    detections,
    checks
  };
}

function buildSnippet(content, signatureId, location = locateMatch(content, signatureId)) {
  if (location) {
    return crop(content, location.index, 260);
  }

  return crop(content, 0, 260);
}

function crop(content, centerIndex, width) {
  const start = Math.max(0, centerIndex - Math.floor(width / 2));
  const end = Math.min(content.length, centerIndex + Math.floor(width / 2));
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

function locateMatch(content, signatureId) {
  const exactMarker = findExactMarker(content, signatureId);
  if (exactMarker) {
    return exactMarker;
  }

  const matcher = getSignaturePattern(signatureId);
  if (!matcher) {
    return null;
  }

  const match = matcher.exec(content);
  if (!match || match.index == null) {
    return null;
  }

  return {
    index: match.index,
    length: Math.max(match[0]?.length ?? 0, 1)
  };
}

function findExactMarker(content, signatureId) {
  const markers = {
    'weedhack-payload': 'minecraftInfo',
    'minecraft-session-token-access': 'method_1674'
  };

  const marker = markers[signatureId];
  if (!marker) {
    return null;
  }

  const index = content.indexOf(marker);
  if (index < 0) {
    return null;
  }

  return {
    index,
    length: marker.length
  };
}

function getSignaturePattern(signatureId) {
  const patterns = {
    'minecraft-token-collection': /accessToken|uuid|username/i,
    'session-object-access': /(getSession\s*\(|session\s*[=.]|class_320|accessToken|token|uuid|username|method_1674)/i,
    'launcher-account-file-access': /launcher_profiles\.json|accounts\.json|minecraftcredentials|Tlauncher|feather|lunarclient/i,
    'discord-webhook': /discord(?:app)?\.com\/api\/webhooks|discord\.com\/api\/webhooks/i,
    'token-post-body': /\{\\?"(?:username|uuid|accessToken|token)\\?":|accessToken.{0,120}(?:HttpURLConnection|URL|POST|webhook)/is,
    'browser-cookie-targeting': /Cookies|Local Storage|Login Data|Network\\Cookies|Google\\Chrome|Opera Stable|Mozilla\\Firefox/i,
    'powershell-launch': /powershell(?:\.exe)?/i,
    'secondary-payload-retrieval': /HttpURLConnection|java\.net\.URL|OkHttpClient|HttpClient|\.dll|\.exe|\.bat|\.ps1|AppData|Temp/i,
    'external-process-invocation': /Runtime\.getRuntime\(\)\.exec|ProcessBuilder\s*\(/,
    'obfuscated-string-decoding': /Base64\.getDecoder\(|decodeBase64|DatatypeConverter\.parseBase64Binary|HttpURLConnection|java\.net\.URL|Runtime\.getRuntime\(\)\.exec|ProcessBuilder\s*\(/i,
    'system-identifier-collection': /PROCESSOR_IDENTIFIER|COMPUTERNAME|wmic csproduct get uuid|MachineGuid|user\.name|os\.name/i,
    'generic-network-communication': /HttpURLConnection|java\.net\.URL|OkHttpClient|HttpClient/
  };

  return patterns[signatureId] ?? null;
}

function getLineNumber(content, index) {
  if (!content) {
    return 1;
  }

  const boundedIndex = Math.max(0, Math.min(index, content.length));
  return content.slice(0, boundedIndex).split('\n').length;
}

function getColumnNumber(content, index) {
  if (!content) {
    return 1;
  }

  const boundedIndex = Math.max(0, Math.min(index, content.length));
  const lineStart = content.lastIndexOf('\n', boundedIndex - 1);
  return boundedIndex - lineStart;
}

function deobfuscateSource(content) {
  let output = content;
  let previous = '';

  while (output !== previous) {
    previous = output;
    output = output.replace(/"((?:[^"\\]|\\.)*)"\s*\+\s*"((?:[^"\\]|\\.)*)"/g, '"$1$2"');
  }

  return output
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');
}

function extractDiscordWebhooks(content) {
  return extractInterestingUrls(content).filter(isDiscordWebhookUrl);
}

async function buildDeobfuscatedArchive(originalFileName, files, detections) {
  const archive = new JSZip();
  const urlEntries = [];
  const webhookEntries = [];

  for (const file of files) {
    const deobfuscatedContent = deobfuscateSource(file.content);
    const exportPath = buildDeobfuscatedExportPath(file.relativePath, file.kind);
    archive.file(exportPath, deobfuscatedContent);

    const fileUrls = extractMaliciousUrlEntries(deobfuscatedContent, cachedMaliciousHostIndex || new Map());
    for (const entry of fileUrls) {
      urlEntries.push(`${file.relativePath}: ${entry.url}`);
    }

    const fileWebhooks = fileUrls.map((entry) => entry.url).filter(isDiscordWebhookUrl);
    for (const webhook of fileWebhooks) {
      webhookEntries.push(`${file.relativePath}: ${webhook}`);
    }
  }

  const report = {
    generatedFrom: originalFileName,
    generatedAt: new Date().toISOString(),
    note: 'This browser-mode deobfuscated export contains readable extracted content for analysis. It is not a rebuilt runnable mod jar.',
    sourceFileCount: files.length,
    detections: detections.map((detection) => ({
      id: detection.id,
      label: detection.label,
      file: detection.file,
      lineNumber: detection.lineNumber,
      columnNumber: detection.columnNumber,
      urls: detection.urls || [],
      webhooks: detection.webhooks || []
    })),
    urls: [...new Set(urlEntries)],
    webhooks: [...new Set(webhookEntries)]
  };

  archive.file('_skidchecker/report.json', JSON.stringify(report, null, 2));

  if (report.urls.length) {
    archive.file('_skidchecker/urls.txt', `${report.urls.join('\n')}\n`);
  }

  if (report.webhooks.length) {
    archive.file('_skidchecker/webhooks.txt', `${report.webhooks.join('\n')}\n`);
  }

  return {
    blob: await archive.generateAsync({ type: 'blob' }),
    fileName: `${sanitizeArchiveBaseName(originalFileName)}-deobfuscated.zip`
  };
}

function buildDeobfuscatedExportPath(relativePath, kind) {
  if (kind === 'binary-strings') {
    return `${relativePath}.txt`;
  }

  return relativePath;
}

function sanitizeArchiveBaseName(fileName) {
  return String(fileName || 'mod')
    .replace(/\.jar$/i, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function collectMaliciousUrlEntries(files, maliciousHostIndex) {
  const entries = [];
  const seen = new Set();

  for (const file of files) {
    const deobfuscatedContent = deobfuscateSource(file.content);
    for (const entry of extractMaliciousUrlEntries(deobfuscatedContent, maliciousHostIndex)) {
      const key = `${file.relativePath} ${entry.url}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      entries.push({
        file: file.relativePath,
        url: entry.url,
        host: entry.host,
        service: entry.service,
        matchedDomain: entry.matchedDomain
      });
    }
  }

  return entries;
}

function extractMaliciousUrlEntries(content, maliciousHostIndex) {
  return extractInterestingUrls(content)
    .map((url) => classifyMaliciousUrl(url, maliciousHostIndex))
    .filter(Boolean);
}

function extractMaliciousUrls(content, maliciousHostIndex) {
  return extractMaliciousUrlEntries(content, maliciousHostIndex).map((entry) => entry.url);
}

function extractInterestingUrls(content) {
  const matches = String(content || '').match(urlPattern) || [];
  return [...new Set(matches.map(normalizeUrlMatch).filter(Boolean))];
}

function normalizeUrlMatch(match) {
  return String(match || '').replace(/[.,;:!?]+$/g, '');
}

function isDiscordWebhookUrl(url) {
  return /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/i.test(url);
}

function classifyMaliciousUrl(url, maliciousHostIndex) {
  const normalizedUrl = normalizeUrlMatch(url);
  if (!normalizedUrl) {
    return null;
  }

  if (isDiscordWebhookUrl(normalizedUrl)) {
    return {
      url: normalizedUrl,
      host: extractUrlHost(normalizedUrl),
      service: 'discord-webhook',
      matchedDomain: extractUrlHost(normalizedUrl)
    };
  }

  const host = extractUrlHost(normalizedUrl);
  if (!host) {
    return null;
  }

  const match = findMaliciousDomainMatch(host, maliciousHostIndex);
  if (!match) {
    return null;
  }

  return {
    url: normalizedUrl,
    host,
    service: match.service,
    matchedDomain: match.domain
  };
}

function findMaliciousDomainMatch(host, maliciousHostIndex) {
  const normalizedHost = String(host || '').toLowerCase();
  if (!normalizedHost) {
    return null;
  }

  const hostParts = normalizedHost.split('.');
  for (let index = 0; index < hostParts.length - 1; index += 1) {
    const candidate = hostParts.slice(index).join('.');
    const service = maliciousHostIndex.get(candidate);
    if (service) {
      return { domain: candidate, service };
    }
  }

  return null;
}

async function getMaliciousHostIndex() {
  const now = Date.now();
  if (cachedMaliciousHostIndex && cachedMaliciousHostIndexExpiresAt > now) {
    return cachedMaliciousHostIndex;
  }

  try {
    const response = await fetch(maliciousDomainFeedUrl, {
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`Feed returned ${response.status}`);
    }

    const payload = await response.json();
    cachedMaliciousHostIndex = buildMaliciousHostIndex(payload);
    cachedMaliciousHostIndexExpiresAt = now + 60 * 60 * 1000;
    return cachedMaliciousHostIndex;
  } catch {
    cachedMaliciousHostIndex = new Map();
    cachedMaliciousHostIndexExpiresAt = now + 5 * 60 * 1000;
    return cachedMaliciousHostIndex;
  }
}

function buildMaliciousHostIndex(payload) {
  const hostIndex = new Map();
  const groups = payload?.badhosts;
  if (!groups || typeof groups !== 'object') {
    return hostIndex;
  }

  for (const [service, domains] of Object.entries(groups)) {
    if (!Array.isArray(domains)) {
      continue;
    }

    for (const domain of domains) {
      const normalizedDomain = String(domain || '').trim().toLowerCase();
      if (!/^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/.test(normalizedDomain) || !normalizedDomain.includes('.')) {
        continue;
      }

      hostIndex.set(normalizedDomain, service);
    }
  }

  return hostIndex;
}

function extractUrlHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}