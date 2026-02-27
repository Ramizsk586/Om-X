const { app, BrowserWindow, BrowserView, ipcMain, Menu, screen, dialog, session, shell, webContents, crashReporter, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const https = require('https');
const os = require('os');
const { pathToFileURL } = require('url');
const UpdateManager = require('./updater/UpdateManager');
const SecurityManager = require('./security/SecurityManager');
const AntivirusEngine = require('./security/antivirus/AntivirusEngine');
const VirusTotalClient = require('./security/virustotal/VirusTotalClient');
const { DEFAULT_BLOCKED_SITES } = require('./security/blocklists/defaultBlockedSites');
const vaultManager = require('./security/vault/VaultManager');
const aiProvider = require('../utils/ai/aiProvider');
const websearch = require('../utils/ai/websearch');
const localModelController = require('./LocalModelController');
const ExtensionManager = require('./coder/ExtensionManager');
const { runCSourceFile, detectAvailableCCompilers, getCompilerSearchDirectories } = require('./coder/CCompilerRunner');
const { runCppSourceFile, detectAvailableCppCompilers } = require('./coder/CppCompilerRunner');
const { SarvamAIClient } = require('sarvamai');

let ElectronBlockerCtor = null;
let ghosteryFetch = null;
let ghosteryDepsChecked = false;
let ghosteryDepsAvailable = false;
let youtubeAdsBlocker = null;
let youtubeAdsBlockerInitPromise = null;
let youtubeAdsBlockingAppliedToDefaultSession = false;
let youtubeAdsBlockerCompatibilityWarned = false;

const TRUSTED_RENDERER_PROTOCOLS = new Set(['file:', 'mindclone:']);

function getIpcSenderUrl(event) {
  try {
    const frameUrl = event?.senderFrame?.url;
    if (typeof frameUrl === 'string' && frameUrl) return frameUrl;
  } catch (_) {}
  try {
    if (event?.sender && typeof event.sender.getURL === 'function') {
      return event.sender.getURL() || '';
    }
  } catch (_) {}
  return '';
}

function isTrustedIpcSender(event) {
  const senderUrl = getIpcSenderUrl(event);
  if (!senderUrl) return false;
  try {
    const parsed = new URL(senderUrl);
    return TRUSTED_RENDERER_PROTOCOLS.has(parsed.protocol);
  } catch (_) {
    return false;
  }
}

function logBlockedIpc(kind, channel, event) {
  const senderUrl = getIpcSenderUrl(event) || 'unknown';
  console.warn(`[Security][IPC] Blocked ${kind} ${channel} from ${senderUrl}`);
}

const __origIpcMainHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, handler) => __origIpcMainHandle(channel, async (event, ...args) => {
  if (!isTrustedIpcSender(event)) {
    logBlockedIpc('invoke', channel, event);
    throw new Error(`Unauthorized IPC call: ${channel}`);
  }
  return handler(event, ...args);
});

const __origIpcMainOn = ipcMain.on.bind(ipcMain);
ipcMain.on = (channel, listener) => __origIpcMainOn(channel, (event, ...args) => {
  if (!isTrustedIpcSender(event)) {
    logBlockedIpc('send', channel, event);
    return;
  }
  return listener(event, ...args);
});

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'mindclone',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    }
]);

const standaloneEntryArg = process.argv.find(arg => arg.startsWith('--standalone-entry='));
const standaloneEntry = standaloneEntryArg ? standaloneEntryArg.slice('--standalone-entry='.length) : null;
const miniAppArg = process.argv.find(arg => arg.startsWith('--mini-app='));
const miniAppId = miniAppArg ? miniAppArg.slice('--mini-app='.length) : null;
const isStandaloneLaunch = Boolean(standaloneEntry);
const isMiniLaunch = Boolean(miniAppId);
const isStandaloneLikeLaunch = isStandaloneLaunch || isMiniLaunch;

if (isStandaloneLaunch) {
    try {
        require(standaloneEntry);
    } catch (error) {
        console.error('[Standalone] Failed to load entry:', standaloneEntry, error);
    }
}

const chessMasterApp = !isStandaloneLaunch ? require('../../game/electron/chess_master/java/main.js') : null;
const chesslyApp = !isStandaloneLaunch ? require('../../game/electron/chessly electron/java/main.js') : null;
const goApp = !isStandaloneLaunch ? require('../../game/electron/go electron/java/main.js') : null;

// Bot managers - load with error handling
let MinecraftBotManager, MineflayerBotManager;
let minecraftBotManager = null;
let mineflayerBotManager = null;

let siteAppWindows = new Map();
let siteAppViews = new Map();

try {
  MinecraftBotManager = require('./MinecraftBotManager');
  console.log('[Main] MinecraftBotManager loaded successfully');
} catch (error) {
  console.error('[Main] Failed to load MinecraftBotManager:', error.message);
}

try {
  MineflayerBotManager = require('./MineflayerBotManager');
  console.log('[Main] MineflayerBotManager loaded successfully');
} catch (error) {
  console.error('[Main] Failed to load MineflayerBotManager:', error.message);
}

let llamaServerProcess = null;
let bedrockServerProcess = null;
let javaServerProcess = null;
let aiPlayerWindow = null;
let aiChatWindow = null;
let canvasWindow = null;
let imageEditorWindow = null;
let coderWindow = null;
let coderPreviewTempFilePath = null;
let coderExtensionManager = null;
const coderWorkspaceScopes = new Map();
const coderTerminalSessions = new Map();
let coderTerminalSessionSeq = 0;

function getEventBrowserWindow(event) {
  try {
    return BrowserWindow.fromWebContents(event?.sender) || null;
  } catch (_) {
    return null;
  }
}

function ensureCoderSenderWindow(event) {
  const senderWin = getEventBrowserWindow(event);
  if (!senderWin || !coderWindow || coderWindow.isDestroyed() || senderWin !== coderWindow) {
    throw new Error('Unauthorized Coder window request');
  }
  return senderWin;
}

function getCoderScopesForEvent(event) {
  const senderWin = ensureCoderSenderWindow(event);
  const wcId = senderWin.webContents.id;
  if (!coderWorkspaceScopes.has(wcId)) {
    coderWorkspaceScopes.set(wcId, new Set());
  }
  return coderWorkspaceScopes.get(wcId);
}

function clearCoderScopesForWindow(win) {
  try {
    if (win?.webContents?.id) coderWorkspaceScopes.delete(win.webContents.id);
  } catch (_) {
    // best effort
  }
}

function getCoderWorkspaceRootsForWindow(windowId) {
  const wcId = Number(windowId) || 0;
  if (!wcId) return [];
  const scopes = coderWorkspaceScopes.get(wcId);
  if (!scopes || !(scopes instanceof Set)) return [];
  return [...scopes].map((p) => path.resolve(String(p || ''))).filter(Boolean);
}

function notifyCoderExtensionRenderer(windowId, payload = {}) {
  try {
    const wcId = Number(windowId) || 0;
    if (!coderWindow || coderWindow.isDestroyed()) return;
    const wc = coderWindow.webContents;
    if (!wc || wc.isDestroyed()) return;
    if (wcId && wc.id !== wcId) return;
    wc.send('coder:extensions-event', payload || {});
  } catch (_) {
    // best effort
  }
}

function getCoderExtensionManager() {
  if (coderExtensionManager) return coderExtensionManager;
  const coderDataDir = path.join(app.getPath('userData'), 'coder');
  const hostScriptPath = path.join(__dirname, '../extensions-host/index.js');
  coderExtensionManager = new ExtensionManager({
    logger: console,
    coderDataDir,
    hostScriptPath,
    notifyRenderer: (windowId, payload) => notifyCoderExtensionRenderer(windowId, payload),
    getWorkspaceRootsForWindow: (windowId) => getCoderWorkspaceRootsForWindow(windowId)
  });
  return coderExtensionManager;
}

function isSameOrSubFsPath(targetPath, basePath) {
  const target = path.resolve(String(targetPath || ''));
  const base = path.resolve(String(basePath || ''));
  if (!target || !base) return false;
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function normalizeRequiredFsPath(input, label = 'path') {
  const raw = String(input || '').trim();
  if (!raw) throw new Error(`${label} is required`);
  return path.resolve(raw);
}

function registerCoderWorkspaceScope(event, targetPath, options = {}) {
  const scopes = getCoderScopesForEvent(event);
  const abs = normalizeRequiredFsPath(targetPath, options.label || 'path');
  const scopeRoot = options.kind === 'file' ? path.dirname(abs) : abs;

  for (const existing of [...scopes]) {
    if (isSameOrSubFsPath(scopeRoot, existing)) return scopeRoot;
    if (isSameOrSubFsPath(existing, scopeRoot)) scopes.delete(existing);
  }
  scopes.add(scopeRoot);
  return scopeRoot;
}

function isCoderPathAllowedForEvent(event, targetPath) {
  const abs = normalizeRequiredFsPath(targetPath, 'path');
  const scopes = getCoderScopesForEvent(event);
  if (!scopes.size) return false;
  for (const root of scopes) {
    if (isSameOrSubFsPath(abs, root)) return true;
  }
  return false;
}

function assertCoderPathAllowed(event, targetPath, label = 'path') {
  const abs = normalizeRequiredFsPath(targetPath, label);
  if (!isCoderPathAllowedForEvent(event, abs)) {
    throw new Error(`${label} is outside the approved Coder workspace`);
  }
  return abs;
}

function canRenameCoderPathTo(event, oldPath, newPath) {
  const oldAbs = normalizeRequiredFsPath(oldPath, 'oldPath');
  const newAbs = normalizeRequiredFsPath(newPath, 'newPath');
  const scopes = getCoderScopesForEvent(event);

  if (!scopes.size) return false;
  if (![...scopes].some((root) => isSameOrSubFsPath(oldAbs, root))) return false;

  if ([...scopes].some((root) => isSameOrSubFsPath(newAbs, root))) return true;
  if (scopes.has(oldAbs)) return true; // allow renaming the selected project root itself
  return false;
}

function rewriteCoderScopesAfterRename(event, oldPath, newPath) {
  const senderWin = ensureCoderSenderWindow(event);
  const oldAbs = path.resolve(String(oldPath || ''));
  const newAbs = path.resolve(String(newPath || ''));
  const scopes = coderWorkspaceScopes.get(senderWin.webContents.id);
  if (!scopes?.size) return;

  const next = new Set();
  for (const root of scopes) {
    if (root === oldAbs || isSameOrSubFsPath(root, oldAbs)) {
      const suffix = path.relative(oldAbs, root);
      next.add(path.resolve(newAbs, suffix || '.'));
    } else {
      next.add(root);
    }
  }
  coderWorkspaceScopes.set(senderWin.webContents.id, next);
}

function coderHttpsJson(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    let redirected = 0;
    const maxRedirects = 4;

    const requestUrl = (targetUrl) => {
      const req = https.get(targetUrl, {
        headers: {
          'User-Agent': 'Om-X-Coder/2.0 (+Extensions)',
          'Accept': 'application/json'
        },
        timeout: Number(options.timeoutMs) || 10000
      }, (res) => {
        const status = Number(res.statusCode) || 0;
        if (status >= 300 && status < 400 && res.headers.location && redirected < maxRedirects) {
          redirected += 1;
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          res.resume();
          requestUrl(nextUrl);
          return;
        }
        if (status < 200 || status >= 300) {
          let body = '';
          res.on('data', (chunk) => { body += String(chunk || ''); });
          res.on('end', () => reject(new Error(`Marketplace HTTP ${status}: ${body.slice(0, 200)}`)));
          return;
        }
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(new Error(`Marketplace JSON parse failed: ${error?.message || error}`));
          }
        });
      });
      req.on('timeout', () => req.destroy(new Error('Marketplace request timed out')));
      req.on('error', reject);
    };

    requestUrl(urlString);
  });
}

function coderHttpsText(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    let redirected = 0;
    const maxRedirects = 4;
    const maxBytes = Math.max(1024, Number(options.maxBytes) || 512 * 1024);

    const requestUrl = (targetUrl) => {
      const req = https.get(targetUrl, {
        headers: {
          'User-Agent': 'Om-X-Coder/2.0 (+Extensions)',
          'Accept': String(options.accept || 'text/plain, text/markdown, */*')
        },
        timeout: Number(options.timeoutMs) || 10000
      }, (res) => {
        const status = Number(res.statusCode) || 0;
        if (status >= 300 && status < 400 && res.headers.location && redirected < maxRedirects) {
          redirected += 1;
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          res.resume();
          requestUrl(nextUrl);
          return;
        }
        if (status < 200 || status >= 300) {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { body += String(chunk || ''); });
          res.on('end', () => reject(new Error(`Marketplace HTTP ${status}: ${body.slice(0, 200)}`)));
          return;
        }
        let raw = '';
        let bytes = 0;
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          const text = String(chunk || '');
          bytes += Buffer.byteLength(text, 'utf8');
          if (bytes > maxBytes) {
            req.destroy(new Error(`Marketplace text exceeds limit (${maxBytes} bytes)`));
            return;
          }
          raw += text;
        });
        res.on('end', () => resolve(raw));
      });
      req.on('timeout', () => req.destroy(new Error('Marketplace request timed out')));
      req.on('error', reject);
    };

    requestUrl(urlString);
  });
}

function coderHttpsDownload(urlString, filePath, options = {}) {
  return new Promise((resolve, reject) => {
    let redirected = 0;
    const maxRedirects = 4;
    const maxBytes = Math.max(1024, Number(options.maxBytes) || 0);
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error || 'Download failed')));
    };

    const succeed = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const download = (targetUrl) => {
      const req = https.get(targetUrl, {
        headers: {
          'User-Agent': 'Om-X-Coder/2.0 (+Extensions)',
          'Accept': '*/*'
        },
        timeout: Number(options.timeoutMs) || 20000
      }, (res) => {
        const status = Number(res.statusCode) || 0;
        if (status >= 300 && status < 400 && res.headers.location && redirected < maxRedirects) {
          redirected += 1;
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          res.resume();
          download(nextUrl);
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          fail(new Error(`Marketplace download HTTP ${status}`));
          return;
        }
        const contentLength = Number(res.headers['content-length']) || 0;
        if (maxBytes && contentLength > maxBytes) {
          res.resume();
          fail(new Error(`VSIX exceeds maximum size (${maxBytes} bytes)`));
          return;
        }
        const out = fs.createWriteStream(filePath);
        let totalBytes = 0;
        res.on('data', (chunk) => {
          totalBytes += Buffer.byteLength(chunk || '');
          if (maxBytes && totalBytes > maxBytes) {
            try { req.destroy(new Error(`VSIX exceeds maximum size (${maxBytes} bytes)`)); } catch (_) {}
            try { out.destroy(); } catch (_) {}
          }
        });
        res.pipe(out);
        out.on('finish', () => out.close(() => succeed({ path: filePath })));
        out.on('error', (error) => {
          try { out.destroy(); } catch (_) {}
          fail(error);
        });
      });
      req.on('timeout', () => req.destroy(new Error('Marketplace download timed out')));
      req.on('error', (error) => {
        try { fs.rmSync(filePath, { force: true }); } catch (_) {}
        fail(error);
      });
    };

    download(urlString);
  });
}

function normalizeCoderMarketplaceResult(item = {}) {
  const namespace = String(item.namespace || item.publisher || item.owner || '').trim();
  const name = String(item.name || '').trim();
  const version = String(item.version || item.latestVersion || '').trim();
  const files = item.files && typeof item.files === 'object' ? item.files : {};
  const stats = item.statistics && typeof item.statistics === 'object' ? item.statistics : {};

  return {
    id: namespace && name ? `${namespace}.${name}` : (name || ''),
    namespace,
    name,
    version,
    displayName: String(item.displayName || name || '').trim(),
    description: String(item.description || '').trim(),
    publisherDisplayName: String(item.namespaceDisplayName || item.publisherDisplayName || namespace || '').trim(),
    iconUrl: String(files.icon || item.iconUrl || '').trim(),
    downloadUrl: String(files.download || item.downloadUrl || '').trim(),
    homepageUrl: String(item.homepage || item.url || (namespace && name ? `https://open-vsx.org/extension/${namespace}/${name}` : '')).trim(),
    downloadCount: Number(item.downloadCount ?? stats.download ?? stats.downloadCount ?? 0) || 0,
    reviewCount: Number(item.reviewCount ?? stats.reviewCount ?? 0) || 0,
    averageRating: Number(item.averageRating ?? stats.averageRating ?? 0) || 0
  };
}

async function fetchCoderMarketplaceSearchResults(query, options = {}) {
  const q = String(query || '').trim();
  const size = Math.max(1, Math.min(30, Number(options.size) || 15));
  if (!q) {
    return { query: '', total: 0, items: [] };
  }
  const url = new URL('https://open-vsx.org/api/-/search');
  url.searchParams.set('query', q);
  url.searchParams.set('size', String(size));
  url.searchParams.set('offset', String(Math.max(0, Number(options.offset) || 0)));
  const data = await coderHttpsJson(url.toString(), { timeoutMs: 12000 });
  const list = Array.isArray(data?.extensions) ? data.extensions : [];
  return {
    query: q,
    total: Number(data?.totalSize ?? data?.total ?? list.length) || list.length,
    items: list.map(normalizeCoderMarketplaceResult).filter((item) => item.namespace && item.name)
  };
}

function normalizeCoderMarketplaceDetail(item = {}) {
  const normalized = normalizeCoderMarketplaceResult(item);
  const files = item.files && typeof item.files === 'object' ? item.files : {};
  const allVersions = Array.isArray(item.allVersions) ? item.allVersions.map((v) => String(v || '')).filter(Boolean) : [];
  const categories = Array.isArray(item.categories) ? item.categories.map((v) => String(v || '').trim()).filter(Boolean) : [];
  const tags = Array.isArray(item.tags) ? item.tags.map((v) => String(v || '').trim()).filter(Boolean) : [];

  let repositoryUrl = '';
  if (typeof item.repository === 'string') repositoryUrl = String(item.repository).trim();
  else if (item.repository && typeof item.repository === 'object') repositoryUrl = String(item.repository.url || '').trim();

  return {
    ...normalized,
    namespaceAccess: String(item.namespaceAccess || '').trim(),
    timestamp: item.timestamp || item.updatedDate || item.lastUpdated || '',
    publishedDate: item.publishedDate || item.createdAt || '',
    lastUpdated: item.lastUpdated || item.updatedDate || item.timestamp || '',
    license: String(item.license || '').trim(),
    repositoryUrl,
    categories,
    tags,
    engines: item.engines && typeof item.engines === 'object' ? item.engines : {},
    allVersions,
    files: {
      download: String(files.download || '').trim(),
      icon: String(files.icon || '').trim(),
      readme: String(files.readme || '').trim(),
      license: String(files.license || '').trim(),
      changelog: String(files.changelog || '').trim(),
      manifest: String(files.manifest || '').trim()
    }
  };
}

async function fetchCoderMarketplaceExtensionDetails(payload = {}) {
  const namespace = String(payload?.namespace || '').trim();
  const name = String(payload?.name || '').trim();
  const version = String(payload?.version || '').trim();
  if (!namespace || !name) throw new Error('namespace and name are required');

  const endpoint = version
    ? `https://open-vsx.org/api/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
    : `https://open-vsx.org/api/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
  const metadata = await coderHttpsJson(endpoint, { timeoutMs: 12000 });
  const detail = normalizeCoderMarketplaceDetail(metadata || {});

  let readme = '';
  const readmeCandidates = [];
  if (detail?.files?.readme) readmeCandidates.push(detail.files.readme);
  if (detail.version) {
    readmeCandidates.push(`https://open-vsx.org/api/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(detail.version)}/file/README.md`);
    readmeCandidates.push(`https://open-vsx.org/api/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(detail.version)}/file/readme.md`);
  }

  for (const url of readmeCandidates) {
    if (!url) continue;
    try {
      readme = await coderHttpsText(url, { timeoutMs: 12000, maxBytes: 768 * 1024 });
      if (readme) break;
    } catch (_) {
      // best-effort
    }
  }

  return {
    ...detail,
    readmeMarkdown: String(readme || '')
  };
}

async function installCoderMarketplaceExtension(manager, payload = {}, windowId = 0) {
  const namespace = String(payload.namespace || '').trim();
  const name = String(payload.name || '').trim();
  const version = String(payload.version || 'latest').trim() || 'latest';
  if (!namespace || !name) throw new Error('namespace and name are required');

  const metaUrl = `https://open-vsx.org/api/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const metadata = await coderHttpsJson(metaUrl, { timeoutMs: 12000 });
  try {
    manager?.vsixInstaller?.validateEngineCompatibility?.(metadata?.engines || {});
  } catch (error) {
    throw new Error(`Marketplace extension is not compatible with Coder: ${error?.message || error}`);
  }
  const downloadUrl = String(metadata?.files?.download || '').trim();
  if (!downloadUrl) throw new Error('Marketplace did not provide a VSIX download URL');

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'omx-coder-market-'));
  const vsixPath = path.join(tmpDir, `${namespace}.${name}-${metadata?.version || version}.vsix`);
  try {
    await coderHttpsDownload(downloadUrl, vsixPath, {
      timeoutMs: 30000,
      maxBytes: Number(manager?.vsixInstaller?.maxVsixBytes) || 0
    });
    const result = await manager.installVsix({ windowId, vsixPath });
    if (result?.extension) {
      result.extension.marketplace = {
        namespace,
        name,
        version: String(metadata?.version || version)
      };
    }
    return result;
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function loadGhosteryAdblockDeps() {
  if (ghosteryDepsChecked) return ghosteryDepsAvailable;
  ghosteryDepsChecked = true;
  try {
    const ghostery = require('@ghostery/adblocker-electron');
    const crossFetchModule = require('cross-fetch');
    ElectronBlockerCtor = ghostery?.ElectronBlocker || null;
    ghosteryFetch = crossFetchModule?.default || crossFetchModule;
    ghosteryDepsAvailable = !!(ElectronBlockerCtor && ghosteryFetch);
    if (!ghosteryDepsAvailable) {
      console.warn('[AdBlock] Ghostery adblock dependencies loaded, but exports were not usable.');
    }
  } catch (error) {
    ghosteryDepsAvailable = false;
    console.warn('[AdBlock] Ghostery adblock dependencies not installed:', error?.message || error);
  }
  return ghosteryDepsAvailable;
}

async function getYouTubeAdsBlocker() {
  if (youtubeAdsBlocker) return youtubeAdsBlocker;
  if (!loadGhosteryAdblockDeps()) return null;
  if (!youtubeAdsBlockerInitPromise) {
    youtubeAdsBlockerInitPromise = ElectronBlockerCtor.fromPrebuiltAdsAndTracking(ghosteryFetch)
      .then((blocker) => {
        youtubeAdsBlocker = blocker;
        return blocker;
      })
      .catch((error) => {
        console.error('[AdBlock] Failed to initialize Ghostery blocker:', error);
        youtubeAdsBlockerInitPromise = null;
        return null;
      });
  }
  return youtubeAdsBlockerInitPromise;
}

async function applyYouTubeAdsBlocking(settings = cachedSettings) {
  try {
    const ses = session.defaultSession;
    if (!ses) return;
    const adBlockerSettings = settings?.adBlocker || {};
    const shouldEnable =
      adBlockerSettings.enabled === true &&
      adBlockerSettings.ytBlockAds === true;
    if (!shouldEnable) {
      if (
        youtubeAdsBlockingAppliedToDefaultSession &&
        youtubeAdsBlocker &&
        typeof youtubeAdsBlocker.disableBlockingInSession === 'function' &&
        typeof ses.unregisterPreloadScript === 'function'
      ) {
        youtubeAdsBlocker.disableBlockingInSession(ses);
        youtubeAdsBlockingAppliedToDefaultSession = false;
      }
      return;
    }

    if (typeof ses.registerPreloadScript !== 'function') {
      if (!youtubeAdsBlockerCompatibilityWarned) {
        youtubeAdsBlockerCompatibilityWarned = true;
        console.warn('[AdBlock] YouTube ad blocking is enabled, but this Electron build does not support session.registerPreloadScript.');
      }
      return;
    }

    const blocker = await getYouTubeAdsBlocker();
    if (!blocker) return;
    blocker.enableBlockingInSession(ses);
    youtubeAdsBlockingAppliedToDefaultSession = true;
  } catch (error) {
    console.warn('[AdBlock] Failed to apply YouTube ad blocking:', error?.message || error);
  }
}

// Helper to extract file path from CLI arguments
function getFilePathFromArgs(args) {
    const skip = [app.getPath('exe'), '.', './', 'index.js', 'main.js', 'java/main/mainProcess.js'];
    const filePath = args.find(arg => {
        if (arg.startsWith('--') || arg.startsWith('-')) return false;
        const isInternal = skip.some(s => arg.endsWith(s));
        if (isInternal) return false;
        try {
            return fs.existsSync(arg) && fs.statSync(arg).isFile();
        } catch(e) { return false; }
    });
    if (filePath) return pathToFileURL(path.resolve(filePath)).href;
    return null;
}

if (!isStandaloneLikeLaunch) {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) { 
        console.log('[Om-X] Another instance is already running. Quitting...');
        app.quit(); 
        process.exit(0); 
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
                const filePath = getFilePathFromArgs(commandLine);
                if (filePath) {
                    mainWindow.webContents.send('open-file-path', filePath);
                }
            }
            handleLaunchArgs(commandLine);
        });
    }
}

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.commandLine.appendSwitch('process-per-site');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('allow-file-access-from-files');

const crashReportDir = path.join(app.getPath('userData'), 'crash-reports');
function writeCrashReport(type, payload = {}) {
    try {
        if (!fs.existsSync(crashReportDir)) fs.mkdirSync(crashReportDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(crashReportDir, `crash-${type}-${timestamp}.json`);
        const report = {
            type,
            timestamp: new Date().toISOString(),
            platform: process.platform,
            release: os.release(),
            arch: process.arch,
            versions: process.versions,
            pid: process.pid,
            ...payload
        };
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
        console.error('[CrashReport] Written:', reportPath);
    } catch (e) {
        console.error('[CrashReport] Failed to write report:', e);
    }
}

process.on('uncaughtException', (error) => {
    console.error('[Om-X Internal Error]:', error);
    writeCrashReport('uncaught-exception', { message: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason) => {
    console.error('[Om-X Unhandled Rejection]:', reason);
    writeCrashReport('unhandled-rejection', { reason: String(reason), stack: reason && reason.stack });
});

const settingsPath = path.join(app.getPath('userData'), 'user-settings.json');
const historyPath = path.join(app.getPath('userData'), 'user-history.json');
const bookmarksPath = path.join(app.getPath('userData'), 'user-bookmarks.json');
const downloadsPath = path.join(app.getPath('userData'), 'user-downloads.json');
const extensionsRoot = path.join(app.getPath('userData'), 'extensions');

const SCRAPES_DIR = path.join(os.homedir(), 'Desktop', 'Om-X Scrapes');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.omx.browser');
}

const APP_ICON_PATH = path.resolve(__dirname, '../../assets/icons/app.png');
const APP_ICO_PATH = path.resolve(__dirname, '../../assets/icons/app.ico');
const HAS_ICON = fs.existsSync(APP_ICON_PATH) || fs.existsSync(APP_ICO_PATH);
const DISPLAY_ICON = fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : APP_ICO_PATH;
const SHORTCUT_ICON = fs.existsSync(APP_ICO_PATH) ? APP_ICO_PATH : (fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined);
const ICONS_DIR = path.resolve(__dirname, '../../assets/icons');

function resolveWindowIcon(...baseNames) {
  const names = baseNames.filter((name) => typeof name === 'string' && name.trim());
  for (const name of names) {
    const normalized = name.trim();
    const icoPath = path.join(ICONS_DIR, `${normalized}.ico`);
    if (fs.existsSync(icoPath)) return icoPath;
    const pngPath = path.join(ICONS_DIR, `${normalized}.png`);
    if (fs.existsSync(pngPath)) return pngPath;
    const icnsPath = path.join(ICONS_DIR, `${normalized}.icns`);
    if (fs.existsSync(icnsPath)) return icnsPath;
  }
  return HAS_ICON ? DISPLAY_ICON : undefined;
}

const CANVAS_WINDOW_ICON = resolveWindowIcon('canvas');
const CODER_WINDOW_ICON = resolveWindowIcon('coder');
const CODER_PREVIEW_WINDOW_ICON = resolveWindowIcon('coder-preview', 'preview', 'coder');
const IMAGE_EDITOR_WINDOW_ICON = resolveWindowIcon('image-editing', 'image-editor');
const CODER_LINK_WINDOW_SCROLLBAR_CSS = `
  html, body {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  html::-webkit-scrollbar,
  body::-webkit-scrollbar,
  *::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
    background: transparent !important;
  }
`;

let pendingAppLaunch = null;

function applyCoderLinkWindowScrollbarHiding(targetWebContents) {
  try {
    if (!targetWebContents || targetWebContents.isDestroyed()) return;
    targetWebContents.insertCSS(CODER_LINK_WINDOW_SCROLLBAR_CSS).catch(() => {});
  } catch (_) {
    // best effort
  }
}

function preventInspectShortcuts(event, input) {
  const key = String(input?.key || '').toLowerCase();
  const inspectShortcut = key === 'f12' || ((input?.control || input?.meta) && input?.shift && key === 'i');
  if (inspectShortcut) event.preventDefault();
}

function getCoderLinkWindowTargetSize() {
  const fallback = { width: 1200, height: 780 };
  try {
    if (!coderWindow || coderWindow.isDestroyed()) return fallback;
    const bounds = coderWindow.getBounds();
    const width = Math.max(980, Math.min(1600, Number(bounds?.width) || fallback.width));
    const height = Math.max(620, Math.min(1200, Number(bounds?.height) || fallback.height));
    return { width, height };
  } catch (_) {
    return fallback;
  }
}

function fitCoderLinkChildWindowToCoderSize(childWindow) {
  try {
    if (!childWindow || childWindow.isDestroyed()) return;
    const target = getCoderLinkWindowTargetSize();
    const bounds = childWindow.getBounds();
    const nextWidth = target.width;
    const nextHeight = target.height;
    if (bounds.width !== nextWidth || bounds.height !== nextHeight) {
      childWindow.setSize(nextWidth, nextHeight, false);
    }
    if (coderWindow && !coderWindow.isDestroyed()) {
      childWindow.center();
    }
  } catch (_) {
    // best effort
  }
}

function getCoderLinkWindowOpenHandlerResult(url) {
  const rawUrl = String(url || '');
  if (/^devtools:/i.test(rawUrl)) return { action: 'deny' };
  if (/^\s*javascript:/i.test(rawUrl)) return { action: 'deny' };
  const targetSize = getCoderLinkWindowTargetSize();
  return {
    action: 'allow',
    overrideBrowserWindowOptions: {
      width: targetSize.width,
      height: targetSize.height,
      minWidth: 760,
      minHeight: 520,
      show: false,
      autoHideMenuBar: true,
      icon: CODER_WINDOW_ICON,
      backgroundColor: '#0b0d12',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        devTools: false
      }
    }
  };
}

function configureCoderLinkChildWindow(childWindow) {
  if (!childWindow || childWindow.isDestroyed()) return;
  try { childWindow.setMenuBarVisibility(false); } catch (_) {}
  try { childWindow.setAutoHideMenuBar(true); } catch (_) {}

  childWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
  childWindow.webContents.on('devtools-opened', () => {
    try { childWindow?.webContents?.closeDevTools(); } catch (_) {}
  });
  childWindow.webContents.on('before-input-event', preventInspectShortcuts);
  childWindow.webContents.on('inspect-element', (event) => {
    event.preventDefault();
  });
  childWindow.webContents.on('dom-ready', () => applyCoderLinkWindowScrollbarHiding(childWindow.webContents));
  childWindow.webContents.on('did-navigate', () => applyCoderLinkWindowScrollbarHiding(childWindow.webContents));
  childWindow.webContents.on('did-navigate-in-page', () => applyCoderLinkWindowScrollbarHiding(childWindow.webContents));
  childWindow.webContents.on('did-finish-load', () => fitCoderLinkChildWindowToCoderSize(childWindow));
  childWindow.webContents.setWindowOpenHandler(({ url }) => getCoderLinkWindowOpenHandlerResult(url));
  childWindow.webContents.on('did-create-window', (grandChild) => {
    configureCoderLinkChildWindow(grandChild);
  });

  childWindow.once('ready-to-show', () => {
    fitCoderLinkChildWindowToCoderSize(childWindow);
    try { childWindow.show(); } catch (_) {}
  });
}

function parseLaunchArgs(args) {
    for (const arg of args) {
        if (typeof arg !== 'string') continue;
        if (arg.startsWith('--omx-app=')) {
            return { type: 'app', value: arg.slice('--omx-app='.length) };
        }
        if (arg.startsWith('--omx-url=')) {
            return { type: 'url', value: decodeURIComponent(arg.slice('--omx-url='.length)) };
        }
    }
    return null;
}

function handleParsedLaunch(parsed) {
    if (!parsed) return;
    if (!mainWindow || mainWindow.isDestroyed()) {
        pendingAppLaunch = parsed;
        return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();

    const openTab = (url) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('open-tab', url);
        }
    };

    if (parsed.type === 'url') {
        openTab(parsed.value);
        return;
    }

    const appId = parsed.value;
    if (appId === 'ai-player') {
        createAIPlayerWindow();
        return;
    }
    if (appId === 'ai-chat') {
        createAIChatWindow();
        return;
    }
    if (appId === 'canvas') {
        createCanvasWindow();
        return;
    }
    if (appId === 'photo-editor') {
        createImageEditorWindow();
        return;
    }
    if (appId === 'coder') {
        createCoderWindow();
        return;
    }
    if (appId === 'youtube') {
        createSiteAppWindow('youtube', 'YouTube', 'https://www.youtube.com');
        return;
    }
    if (appId === 'wikipedia') {
        createSiteAppWindow('wikipedia', 'Wikipedia', 'https://www.wikipedia.org');
        return;
    }
    if (appId === 'pdf-station') {
        const pdfUrl = pathToFileURL(path.join(__dirname, '../../html/pages/pdf-viewer.html')).href;
        openTab(pdfUrl);
        return;
    }
}

function handleLaunchArgs(args) {
    const parsed = parseLaunchArgs(args || []);
    handleParsedLaunch(parsed);
}

function createDesktopShortcut(appId) {
    if (process.platform !== 'win32') {
        return { success: false, error: 'Desktop shortcuts are only supported on Windows.' };
    }
    const appNames = {
        'ai-player': 'AI Player',
        'ai-chat': 'AI Chat',
        'canvas': 'Canvas',
        'coder': 'Coder',
        'photo-editor': 'Photo Editor',
        'youtube': 'YouTube',
        'wikipedia': 'Wikipedia',
        'pdf-station': 'PDF Neural Station'
    };
    const name = appNames[appId] || 'Om-X App';
    const shortcutPath = path.join(app.getPath('desktop'), `${name}.lnk`);
    const target = process.execPath;
    const args = `--omx-app=${appId}`;
    const icon = SHORTCUT_ICON;
    const description = `Launch ${name} in Om-X`;
    const options = { target, args, description };
    if (icon) options.icon = icon;
    if (typeof app.getAppUserModelId === 'function') {
        const id = app.getAppUserModelId();
        if (id) options.appUserModelId = id;
    }

    try {
        const created = shell.writeShortcutLink(shortcutPath, 'create', options);
        if (!created) return { success: false, error: 'Failed to create shortcut.' };
        return { success: true, path: shortcutPath };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

const DEFAULT_SETTINGS = {
  searchEngines: [
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s', keyword: 'google', icon: 'https://www.google.com/favicon.ico', category: 'QUERY_URL' },
    { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', keyword: 'd', icon: 'https://duckduckgo.com/favicon.ico', category: 'QUERY_URL' },
    { id: 'yahoo', name: 'Yahoo', url: 'https://search.yahoo.com/search?p=%s', keyword: 'y', icon: 'https://search.yahoo.com/favicon.ico', category: 'QUERY_URL' },
    { id: 'wiki', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/', keyword: 'w', icon: 'https://en.wikipedia.org/favicon.ico', category: 'DIRECT_URL' },
    { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s', keyword: 'yt', icon: 'https://www.youtube.com/favicon.ico', category: 'QUERY_URL' },
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?q=%s&ref=ext', keyword: 'gpt', icon: 'https://chatgpt.com/favicon.ico', category: 'AI_URL' },
    { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', keyword: 'ds', icon: 'https://chat.deepseek.com/favicon.ico', category: 'INTERACTIVE' },
    { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search?q=%s', keyword: 'p', icon: 'https://www.perplexity.ai/favicon.ico', category: 'QUERY_URL' }
  ],
  defaultSearchEngineId: 'google',
  openDevToolsOnStart: false,
  theme: 'dark',
  downloadPath: app.getPath('downloads'),
  features: { 
    enableHistory: true, 
    enableAntivirus: true, 
    enableFirewall: true,
    enableVirusTotal: false,
    showLoadingAnimation: true,
    showAIChatButton: true
  },
  security: {
    virusTotal: {
      apiKey: '',
      scanUrls: true,
      scanExecutables: true,
      blockOnSuspicious: true
    },
    cookieShield: {
      enabled: true,
      blockThirdPartyRequestCookies: true,
      blockThirdPartyResponseCookies: true
    }
  },
  blocklist: [...DEFAULT_BLOCKED_SITES],
  screenshot: {
    delaySeconds: 0
  },
  translator: { 
      protocol: 'chromium',
      defaultTarget: 'en', 
      api: { chain: [] } 
  },
  writer: {
      protocol: 'balanced',
      api: { chain: [] }
  },
  adBlocker: {
    enabled: true,
    blockNetwork: true,
    blockTrackers: true,
    blockSocial: true,
    blockMiners: true,
    blockPopups: true,
    cosmeticFiltering: true,
    ytSkipAds: false,
    ytBlockAds: false,
    youtubeAddonEnabled: false,
    ytHideShorts: true,
    ytHideHomeSuggestions: true,
    ytBlurThumbnails: false,
    ytHideChats: false,
    ytHideSubscribeButton: false,
    ytBlackAndWhiteMode: false,
    ytHideAddonIcon: false,
    customRules: []
  },
  shortcuts: { 
    'new-tab': 'Ctrl+T',
    'open-scraber': 'Alt+T',
    'close-tab': 'Ctrl+W',
    'toggle-sidebar': 'Ctrl+[',
    'toggle-ai': 'Ctrl+Space',
    'toggle-system': 'Alt+S',
    'toggle-bookmarks': 'Ctrl+Shift+B',
    'toggle-electron-apps': 'Alt+H',
    'toggle-extensions': 'Ctrl+Shift+E',
    'toggle-devtools': 'Ctrl+B',
    'toggle-fullscreen': 'F11',
    'quit-app': 'Ctrl+Shift+Q'
  }
};

function normalizeBlocklistEntries(entries = []) {
  if (!Array.isArray(entries)) return [];

  const normalized = entries
    .map((entry) => String(entry || '').trim().toLowerCase())
    .map((entry) => entry.replace(/^https?:\/\//, ''))
    .map((entry) => entry.replace(/^www\./, ''))
    .map((entry) => entry.replace(/\/.*$/, ''))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function mergeWithDefaultBlocklist(entries = []) {
  return normalizeBlocklistEntries([...(DEFAULT_BLOCKED_SITES || []), ...(entries || [])]);
}

let mainWindow = null;
let previewWindow = null;
let coderPreviewWindow = null;
let minecraftGameWindow = null;
let updateManager = null;
let securityManager = null;
let antivirusEngine = null;
let virusTotalClient = null;
let cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
let activeDownloadItems = new Map();
let pendingSaveAs = new Map();
const VT_INSTALLER_EXTENSIONS = new Set(['.exe', '.apk']);
let mainWindowGameCompactState = {
  active: false,
  previousBounds: null,
  wasMaximized: false,
  gameId: null
};

let isInputFocused = false;
ipcMain.on('focus-changed', (event, status) => {
  isInputFocused = status;
});

try { fs.mkdirSync(extensionsRoot, { recursive: true }); } catch (e) {}

async function safeWriteJson(filePath, data) {
    const tempPath = filePath + '.tmp';
    try {
        await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
        await fs.promises.rename(tempPath, filePath);
        return true;
    } catch (e) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return false;
    }
}

const getStoredHistory = () => { try { return JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch(e) { return []; } };
const getStoredBookmarks = () => { try { return JSON.parse(fs.readFileSync(bookmarksPath, 'utf8')); } catch(e) { return []; } };
const getStoredDownloads = () => { try { return JSON.parse(fs.readFileSync(downloadsPath, 'utf8')); } catch(e) { return []; } };

try {
  if (fs.existsSync(settingsPath)) {
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    cachedSettings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      features: {
        ...DEFAULT_SETTINGS.features,
        ...(saved?.features || {})
      },
      security: {
        ...DEFAULT_SETTINGS.security,
        ...(saved?.security || {}),
        virusTotal: {
          ...DEFAULT_SETTINGS.security.virusTotal,
          ...(saved?.security?.virusTotal || {})
        }
      },
      adBlocker: {
        ...DEFAULT_SETTINGS.adBlocker,
        ...(saved?.adBlocker || {})
      },
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        ...(saved?.shortcuts || {})
      },
      blocklist: mergeWithDefaultBlocklist(saved?.blocklist)
    };
  }
} catch (e) { console.error('Error loading settings:', e); }

function broadcast(channel, data) {
    const all = webContents.getAllWebContents();
    all.forEach(wc => {
        if (!wc.isDestroyed() && !wc.isCrashed()) {
            wc.send(channel, data);
        }
    });
}

async function downloadBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.headers.location) {
                return resolve(downloadBuffer(res.headers.location));
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            const chunks = [];
            res.on('data', (d) => chunks.push(d));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

function crxToZip(buffer) {
    if (buffer.slice(0, 4).toString() !== 'Cr24') throw new Error('Invalid CRX');
    const version = buffer.readUInt32LE(4);
    if (version !== 2 && version !== 3) throw new Error(`Unsupported CRX version ${version}`);
    const headerSize = buffer.readUInt32LE(8);
    const zipStart = 12 + headerSize;
    return buffer.slice(zipStart);
}

async function extractZipToDir(zipBuffer, destDir) {
    // Security: Validate destination path to prevent directory traversal
    const abs = path.resolve(String(destDir || ''));
    if (!isPathInSafeDirectories(abs)) throw new Error('Invalid destination directory');
    
    try { 
        await fs.promises.rm(abs, { recursive: true, force: true }); 
    } catch (e) {}
    
    await fs.promises.mkdir(abs, { recursive: true });
    const tmpZip = path.join(os.tmpdir(), `omx-extract-${Date.now()}.zip`);
    await fs.promises.writeFile(tmpZip, zipBuffer);
    
    return new Promise((resolve, reject) => {
        // Security: Use safe parameter passing instead of string interpolation
        const ps = spawn('powershell.exe', [
            '-NoProfile',
            '-Command',
            '$ProgressPreference="SilentlyContinue"; Expand-Archive -Path $args[0] -DestinationPath $args[1] -Force',
            tmpZip,
            abs
        ], { windowsHide: true });
        
        ps.on('exit', async (code) => {
            try { await fs.promises.unlink(tmpZip); } catch (e) {}
            if (code === 0) resolve(true); 
            else reject(new Error(`Expand-Archive failed with code ${code}`));
        });
        
        ps.on('error', (err) => {
            try { fs.unlinkSync(tmpZip); } catch (e) {}
            reject(err);
        });
    });
}

async function ensureExtensionLoaded(dir) {
    try {
        const ext = await session.defaultSession.loadExtension(dir, { allowFileAccess: true });
        return { success: true, extension: { id: ext.id, name: ext.name, version: ext.version, path: ext.path } };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function configureSecurity(settings, win) {
  const ses = session.defaultSession;
  if (!ses) return;
  if (!antivirusEngine) antivirusEngine = new AntivirusEngine(settings);
  else antivirusEngine.updateSettings(settings);

  if (!virusTotalClient) virusTotalClient = new VirusTotalClient(settings);
  else virusTotalClient.updateSettings(settings);

  if (!securityManager) {
    securityManager = new SecurityManager(ses, settings, win, virusTotalClient);
  } else {
    securityManager.updateSettings(settings);
    securityManager.virusTotalClient = virusTotalClient;
    if (securityManager.firewall) securityManager.firewall.virusTotalClient = virusTotalClient;
    if (win) securityManager.mainWindow = win;
  }
}

function ensureChesslyIpcHandlers() {
  if (!chesslyApp) return;

  const hasHandler = (channel) => {
    try {
      return Boolean(ipcMain._invokeHandlers && ipcMain._invokeHandlers.has(channel));
    } catch (_) {
      return false;
    }
  };

  // Let Chessly register its own handlers if possible.
  if (!hasHandler("engines-save") || !hasHandler("engines-get-all")) {
    try {
      if (typeof chesslyApp.initApp === 'function') {
        chesslyApp.initApp({ embedded: true });
      }
    } catch (e) {
      console.error("[Main] Chessly initApp failed (IPC fallback will be used):", e);
    }
  }

  const registerIfMissing = (channel, handler) => {
    if (!hasHandler(channel)) {
      try { ipcMain.handle(channel, handler); } catch (e) {
        console.error(`[Main] Failed to register handler ${channel}:`, e);
      }
    }
  };

  const chesslyEnginesFile = path.join(app.getPath("userData"), "engines.json");
  const chesslyEnginesDir = path.join(__dirname, "../../game/electron/chessly electron/engines");

  const loadEngines = () => {
    try { return JSON.parse(fs.readFileSync(chesslyEnginesFile, "utf8")); } catch { return []; }
  };
  const saveEngines = (list) => {
    try { fs.writeFileSync(chesslyEnginesFile, JSON.stringify(list, null, 2)); } catch (_) {}
  };

  registerIfMissing("engines-get-all", () => loadEngines());
  registerIfMissing("engines-save", (_event, engineData) => {
    if (!engineData || typeof engineData !== "object") return loadEngines();
    const engines = loadEngines();
    if (!engineData.id) engineData.id = "eng-" + Date.now();
    const idx = engines.findIndex(e => e.id === engineData.id);
    if (idx >= 0) engines[idx] = engineData; else engines.push(engineData);
    saveEngines(engines);
    return engines;
  });
  registerIfMissing("engines-delete", (_event, id) => {
    const engines = loadEngines().filter(e => e.id !== id);
    saveEngines(engines);
    return engines;
  });
  registerIfMissing("engines-browse", async () => {
    const result = await dialog.showOpenDialog({ title: "Select engine executable", properties: ["openFile"] });
    return (result.canceled || !result.filePaths.length) ? null : result.filePaths[0];
  });
  registerIfMissing("dialog-browse-image", async () => {
    const result = await dialog.showOpenDialog({ title: "Select Avatar", properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }] });
    return (result.canceled || !result.filePaths.length) ? null : result.filePaths[0];
  });
  registerIfMissing("scan-engines-dir", async () => {
    if (!fs.existsSync(chesslyEnginesDir)) return [];
    const getAllFiles = (dirPath, arrayOfFiles) => {
      const files = fs.readdirSync(dirPath);
      arrayOfFiles = arrayOfFiles || [];
      files.forEach((file) => {
        const full = path.join(dirPath, file);
        if (fs.statSync(full).isDirectory()) {
          getAllFiles(full, arrayOfFiles);
        } else if (file.endsWith('.exe') || (!file.includes('.') && process.platform !== 'win32')) {
          arrayOfFiles.push(full);
        }
      });
      return arrayOfFiles;
    };
    try { return getAllFiles(chesslyEnginesDir); } catch (e) { console.error("Scanning error", e); return []; }
  });
}

function registerGlobalShortcuts(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const isCtrlPressed = process.platform === 'darwin' ? input.meta : input.control;
    const isModifierPressed = isCtrlPressed || input.alt || input.shift || input.key.startsWith('F');
    if (!isModifierPressed) return;
    const key = input.key.toLowerCase();
    const check = (trigger) => {
       if (!trigger) return false;
       const parts = trigger.toLowerCase().split('+');
       const triggerKey = parts[parts.length - 1];
       const wCtrl = parts.includes('ctrl');
       const wAlt = parts.includes('alt');
       const wShift = parts.includes('shift');
       if (wCtrl !== isCtrlPressed) return false;
       if (wAlt !== input.alt) return false;
       if (wShift !== input.shift) return false;
       return key === (triggerKey === 'space' ? ' ' : triggerKey);
    };
    const s = cachedSettings.shortcuts;
    if (check(s['quit-app'])) { event.preventDefault(); app.quit(); return; }
    if (check(s['toggle-fullscreen'])) { event.preventDefault(); if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); return; }
    if (check(s['toggle-devtools'])) { event.preventDefault(); toggleDevTools(BrowserWindow.fromWebContents(contents)); return; }
    const commands = ['take-screenshot','toggle-bookmarks','toggle-electron-apps','toggle-extensions','new-tab','open-scraber','close-tab','toggle-sidebar','toggle-ai','toggle-system'];
    for (const cmd of commands) {
        if (check(s[cmd])) { event.preventDefault(); broadcast('app-shortcut', cmd); return; }
    }
  });
}

function toggleDevTools(win) {
    const target = win || BrowserWindow.getFocusedWindow();
    if (!target || target.isDestroyed()) return;
    const wc = target.webContents;
    if (!wc) return;
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools({ mode: 'detach' });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 750, 
    frame: false, 
    titleBarStyle: 'hidden', 
    show: false,
    icon: HAS_ICON ? DISPLAY_ICON : undefined,
    backgroundColor: '#18181b',
    webPreferences: { 
      preload: path.join(__dirname, '../preload.js'), 
      webviewTag: true, 
      contextIsolation: true, 
      nodeIntegration: false, 
      webSecurity: true,  // Security: Enable web security
      sandbox: true,       // Security: Enable sandbox
      devTools: false      // Security: Disable DevTools in production
    }
  });
  mainWindow.loadFile(path.join(__dirname, '../../html/windows/main.html'));
  updateManager = new UpdateManager(mainWindow);
  configureSecurity(cachedSettings, mainWindow);

  mainWindow.on('unresponsive', () => {
    writeCrashReport('window-unresponsive', { url: mainWindow.webContents.getURL() });
  });

  mainWindow.on('responsive', () => {
    writeCrashReport('window-responsive', { url: mainWindow.webContents.getURL() });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const filePath = getFilePathFromArgs(process.argv);
    if (filePath) mainWindow.webContents.send('open-file-path', filePath);
    handleLaunchArgs(process.argv);
    if (pendingAppLaunch) {
        handleParsedLaunch(pendingAppLaunch);
        pendingAppLaunch = null;
    }
    // DevTools disabled
    
    // Initialize Minecraft Bot Managers with error handling
    try {
      if (!minecraftBotManager && MinecraftBotManager) {
        minecraftBotManager = new MinecraftBotManager();
        minecraftBotManager.setMainWindow(mainWindow);
        console.log('[Main] MinecraftBotManager initialized');
      }
    } catch (error) {
      console.error('[Main] Failed to initialize MinecraftBotManager:', error.message);
    }
    
    try {
      // Initialize Mineflayer Bot Manager (Java Edition)
      if (!mineflayerBotManager && MineflayerBotManager) {
        mineflayerBotManager = new MineflayerBotManager();
        mineflayerBotManager.setMainWindow(mainWindow);
        console.log('[Main] MineflayerBotManager initialized');
      }
    } catch (error) {
      console.error('[Main] Failed to initialize MineflayerBotManager:', error.message);
    }
  });

  mainWindow.on('minimize', () => vaultManager.lock());
  mainWindow.on('closed', () => { 
    if (previewWindow) previewWindow.close(); 
    if (minecraftBotManager) minecraftBotManager.disconnectAll();
    if (mineflayerBotManager) mineflayerBotManager.disconnectAll();
    if (minecraftGameWindow && !minecraftGameWindow.isDestroyed()) {
      minecraftGameWindow.destroy();
    }
    mainWindow = null; 
  });

  mainWindow.webContents.session.on('will-download', (event, item, wc) => {
      const id = Date.now().toString() + Math.random().toString().slice(2,5);
      const url = item.getURL();
      const filename = item.getFilename();
      const filenameExt = path.extname(filename || '').toLowerCase();
      const defaultDir = (cachedSettings.downloadPath && fs.existsSync(cachedSettings.downloadPath))
        ? cachedSettings.downloadPath
        : app.getPath('downloads');

      let savePath = path.join(defaultDir, item.getFilename());
      if (pendingSaveAs.has(url)) {
          const chosen = dialog.showSaveDialogSync(mainWindow, { defaultPath: savePath });
          pendingSaveAs.delete(url);
          if (chosen) {
              savePath = chosen;
          } else {
              item.cancel();
              return;
          }
      }

      item.setSavePath(savePath);
      const saveExt = path.extname(savePath || '').toLowerCase();
      const shouldThreatScan = VT_INSTALLER_EXTENSIONS.has(saveExt) || VT_INSTALLER_EXTENSIONS.has(filenameExt);
      const resolveSavePath = () => {
          try { return (typeof item.getSavePath === 'function' && item.getSavePath()) || savePath; }
          catch (e) { return savePath; }
      };

      activeDownloadItems.set(id, item);
      const data = {
          id,
          filename,
          totalBytes: item.getTotalBytes(),
          receivedBytes: 0,
          state: 'progressing',
          startTime: Date.now(),
          url,
          speed: 0,
          savePath: resolveSavePath(),
          saveDir: path.dirname(resolveSavePath())
      };
      broadcast('download-update', data);

      const blockCurrentDownload = (reason, quarantinePath = '') => {
          data.state = 'blocked';
          data.reason = reason || 'Blocked by security policy';
          if (quarantinePath) data.quarantinePath = quarantinePath;
          try { item.cancel(); } catch (_) {}
          activeDownloadItems.delete(id);
          const list = getStoredDownloads();
          list.unshift(data);
          safeWriteJson(downloadsPath, list.slice(0, 100));
          broadcast('download-update', data);
      };

      const runThreatGate = async () => {
          if (!shouldThreatScan) return;
          if (!antivirusEngine && !virusTotalClient) return;
          data.state = 'scanning';
          data.reason = 'Running security scan...';
          broadcast('download-update', data);

          try { item.pause(); } catch (_) {}

          try {
              if (antivirusEngine) {
                  const localPre = await antivirusEngine.scanDownload(item);
                  if (localPre?.safe === false) {
                      blockCurrentDownload(localPre.reason || 'Blocked by local antivirus scan.');
                      return;
                  }
                  if (localPre?.warning) {
                      data.reason = localPre.warning;
                      broadcast('download-update', data);
                  }
              }

              const vtEnabled = cachedSettings?.features?.enableVirusTotal ?? false;
              const vtScanExecutables = cachedSettings?.security?.virusTotal?.scanExecutables ?? true;

              if (vtEnabled && vtScanExecutables && virusTotalClient?.isConfigured?.()) {
                  const urlScan = await virusTotalClient.scanUrl(url, { timeoutMs: 6500 });
                  if (urlScan?.blocked) {
                      blockCurrentDownload(urlScan.reason || 'Blocked by VirusTotal URL scan.');
                      return;
                  }
              }
          } catch (error) {
              console.warn('[Security] Download pre-scan failed (open fail):', error?.message || error);
          }

          if (data.state !== 'blocked') {
              data.state = 'progressing';
              delete data.reason;
              broadcast('download-update', data);
              try { item.resume(); } catch (_) {}
          }
      };

      if (shouldThreatScan) {
          void runThreatGate();
      }

      item.on('updated', (e, state) => {
          if (data.state === 'blocked') return;
          data.state = item.isPaused() ? 'paused' : state;
          data.receivedBytes = item.getReceivedBytes();
          data.totalBytes = item.getTotalBytes();
          data.savePath = resolveSavePath();
          data.saveDir = path.dirname(data.savePath || savePath);
          broadcast('download-update', data);
      });

      item.on('done', async (e, state) => {
          if (data.state === 'blocked') return;

          data.state = state;
          data.receivedBytes = item.getReceivedBytes();
          data.totalBytes = item.getTotalBytes();
          data.savePath = resolveSavePath();
          data.saveDir = path.dirname(data.savePath || savePath);
          activeDownloadItems.delete(id);

          if (state === 'completed' && shouldThreatScan) {
              try {
                  if (antivirusEngine) {
                      const localPost = await antivirusEngine.postDownloadScan(data.savePath);
                      if (localPost?.safe === false) {
                          const quarantinePath = antivirusEngine.quarantineFile(data.savePath);
                          data.state = 'blocked';
                          data.reason = localPost.reason || 'Blocked by local antivirus post-scan.';
                          if (quarantinePath) {
                              data.quarantinePath = quarantinePath;
                              data.savePath = quarantinePath;
                              data.saveDir = path.dirname(quarantinePath);
                          }
                      }
                  }

                  const vtEnabled = cachedSettings?.features?.enableVirusTotal ?? false;
                  const vtScanExecutables = cachedSettings?.security?.virusTotal?.scanExecutables ?? true;

                  if (data.state !== 'blocked' && vtEnabled && vtScanExecutables && virusTotalClient?.isConfigured?.()) {
                      const fileScan = await virusTotalClient.scanFileByPath(data.savePath, { timeoutMs: 6500 });
                      if (fileScan?.blocked) {
                          const quarantinePath = antivirusEngine?.quarantineFile?.(data.savePath) || '';
                          data.state = 'blocked';
                          data.reason = fileScan.reason || 'Blocked by VirusTotal file scan.';
                          if (quarantinePath) {
                              data.quarantinePath = quarantinePath;
                              data.savePath = quarantinePath;
                              data.saveDir = path.dirname(quarantinePath);
                          }
                      }
                  }
              } catch (scanError) {
                  console.warn('[Security] Download post-scan failed (open fail):', scanError?.message || scanError);
              }
          }

          const list = getStoredDownloads(); list.unshift(data);
          safeWriteJson(downloadsPath, list.slice(0, 100));
          broadcast('download-update', data);
      });
  });
}

function createAIPlayerWindow() {
  if (aiPlayerWindow && !aiPlayerWindow.isDestroyed()) {
    aiPlayerWindow.show();
    aiPlayerWindow.focus();
    return;
  }

  aiPlayerWindow = new BrowserWindow({
    width: 980,
    height: 700,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    icon: HAS_ICON ? DISPLAY_ICON : undefined,
    backgroundColor: '#18181b',
    webPreferences: {
      preload: path.join(__dirname, '../preload/ai-player-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
      devTools: false
    }
  });

  aiPlayerWindow.loadFile(path.join(__dirname, '../../html/pages/minecraft.html'), {
    query: { mode: 'ai' }
  });

  aiPlayerWindow.once('ready-to-show', () => aiPlayerWindow.show());
  aiPlayerWindow.on('closed', () => {
    aiPlayerWindow = null;
  });
}

function createAIChatWindow() {
  if (aiChatWindow && !aiChatWindow.isDestroyed()) {
    aiChatWindow.show();
    aiChatWindow.focus();
    return;
  }

  aiChatWindow = new BrowserWindow({
    width: 980,
    height: 720,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    icon: HAS_ICON ? DISPLAY_ICON : undefined,
    backgroundColor: '#0b0b0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/ai-chat-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
      devTools: false
    }
  });

  aiChatWindow.loadFile(path.join(__dirname, '../../html/pages/omni-chat.html'), {
    query: { mode: 'chat' }
  });

  aiChatWindow.once('ready-to-show', () => aiChatWindow.show());
  aiChatWindow.on('closed', () => {
    aiChatWindow = null;
  });
}

function createCanvasWindow() {
  if (canvasWindow && !canvasWindow.isDestroyed()) {
    canvasWindow.show();
    canvasWindow.focus();
    return;
  }

  canvasWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    icon: CANVAS_WINDOW_ICON,
    backgroundColor: '#0b0b10',
    webPreferences: {
      preload: path.join(__dirname, '../preload/ai-chat-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
      devTools: false
    }
  });

  canvasWindow.loadFile(path.join(__dirname, '../../html/pages/omni-canvas.html'));

  canvasWindow.once('ready-to-show', () => canvasWindow.show());
  canvasWindow.on('closed', () => {
    canvasWindow = null;
  });
}

function createImageEditorWindow() {
  if (imageEditorWindow && !imageEditorWindow.isDestroyed()) {
    imageEditorWindow.show();
    imageEditorWindow.focus();
    return;
  }

  imageEditorWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    icon: IMAGE_EDITOR_WINDOW_ICON,
    backgroundColor: '#0f1013',
    title: 'Photo Editor',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
      devTools: false
    }
  });

  imageEditorWindow.loadFile(path.join(__dirname, '../../tools/image-editor/index.html'));

  imageEditorWindow.once('ready-to-show', () => imageEditorWindow.show());
  imageEditorWindow.on('closed', () => {
    imageEditorWindow = null;
  });
}

function createCoderWindow() {
  if (coderWindow && !coderWindow.isDestroyed()) {
    coderWindow.show();
    coderWindow.focus();
    return;
  }

  coderWindow = new BrowserWindow({
    width: 1060,
    height: 700,
    minWidth: 900,
    minHeight: 560,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    icon: CODER_WINDOW_ICON,
    backgroundColor: '#0b0d12',
    title: 'Coder',
    webPreferences: {
      preload: path.join(__dirname, '../preload/coder-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: false
    }
  });

  coderWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
  coderWindow.webContents.on('devtools-opened', () => {
    try { coderWindow?.webContents?.closeDevTools(); } catch (_) {}
  });
  coderWindow.webContents.on('before-input-event', (event, input) => {
    preventInspectShortcuts(event, input);
  });
  coderWindow.webContents.setWindowOpenHandler(({ url }) => {
    return getCoderLinkWindowOpenHandlerResult(url);
  });
  coderWindow.webContents.on('did-create-window', (childWindow) => {
    configureCoderLinkChildWindow(childWindow);
  });
  coderWindow.webContents.on('inspect-element', (event) => {
    event.preventDefault();
  });

  coderWorkspaceScopes.set(coderWindow.webContents.id, new Set());
  coderWindow.webContents.once('did-finish-load', () => {
    const wcId = coderWindow?.webContents?.id;
    if (!wcId) return;
    getCoderExtensionManager().attachWindow(wcId).catch((error) => {
      console.warn('[Coder][Extensions] attachWindow failed:', error?.message || error);
    });
  });

  coderWindow.loadFile(path.join(__dirname, '../../html/pages/coder.html'));
  coderWindow.once('ready-to-show', () => coderWindow.show());
  coderWindow.on('closed', () => {
    const closingWin = coderWindow;
    let closingWcId = 0;
    try {
      // Electron may throw "Object has been destroyed" here if the window is already torn down.
      closingWcId = Number(closingWin && closingWin.webContents && closingWin.webContents.id) || 0;
    } catch (_) {
      closingWcId = 0;
    }
    if (closingWcId) {
      killCoderTerminalSessionsForWebContentsId(closingWcId);
      getCoderExtensionManager().detachWindow(closingWcId).catch((error) => {
        console.warn('[Coder][Extensions] detachWindow failed:', error?.message || error);
      });
    }
    clearCoderScopesForWindow(closingWin);
    coderWindow = null;
  });
}

function buildCoderPreviewHtml({ html = '', baseDir = '', title = 'Coder Preview' } = {}) {
  const rawHtml = String(html || '');
  const safeTitle = String(title || 'Coder Preview').replace(/[<>&"]/g, (m) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[m] || m
  ));

  let baseTag = '';
  try {
    if (baseDir) {
      const normalized = path.resolve(String(baseDir));
      let href = pathToFileURL(normalized).toString();
      if (!href.endsWith('/')) href += '/';
      baseTag = `<base href="${href}">`;
    }
  } catch (_) {}

  if (/<!doctype|<html/i.test(rawHtml)) {
    if (baseTag && /<head[^>]*>/i.test(rawHtml)) {
      return rawHtml.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    }
    if (baseTag) {
      return rawHtml.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}<title>${safeTitle}</title></head>`);
    }
    return rawHtml;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${baseTag}<title>${safeTitle}</title></head><body>${rawHtml}</body></html>`;
}

async function writeCoderPreviewTempDocument(payload = {}) {
  const htmlDoc = buildCoderPreviewHtml({
    html: payload?.content || '',
    baseDir: payload?.baseDir || '',
    title: payload?.title || 'Coder Preview'
  });

  const previewDir = path.join(app.getPath('userData'), 'coder', 'preview');
  await fs.promises.mkdir(previewDir, { recursive: true });
  coderPreviewTempFilePath = path.join(previewDir, 'preview.html');
  await fs.promises.writeFile(coderPreviewTempFilePath, htmlDoc, 'utf8');

  const fileUrl = new URL(pathToFileURL(coderPreviewTempFilePath).toString());
  fileUrl.searchParams.set('v', String(Date.now()));
  return fileUrl.toString();
}

async function createCoderPreviewWindow(payload = {}) {
  const previewUrl = await writeCoderPreviewTempDocument(payload);

  if (coderPreviewWindow && !coderPreviewWindow.isDestroyed()) {
    await coderPreviewWindow.loadURL(previewUrl);
    coderPreviewWindow.show();
    coderPreviewWindow.focus();
    return;
  }

  coderPreviewWindow = new BrowserWindow({
    width: 860,
    height: 620,
    minWidth: 520,
    minHeight: 380,
    show: false,
    autoHideMenuBar: true,
    title: 'Coder Preview',
    icon: CODER_PREVIEW_WINDOW_ICON,
    backgroundColor: '#0b0d12',
    parent: coderWindow && !coderWindow.isDestroyed() ? coderWindow : mainWindow,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: false
    }
  });

  coderPreviewWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
  coderPreviewWindow.webContents.on('devtools-opened', () => {
    try { coderPreviewWindow?.webContents?.closeDevTools(); } catch (_) {}
  });
  coderPreviewWindow.webContents.on('before-input-event', (event, input) => {
    const key = String(input?.key || '').toLowerCase();
    const inspectShortcut = key === 'f12' || ((input?.control || input?.meta) && input?.shift && key === 'i');
    if (inspectShortcut) event.preventDefault();
  });
  coderPreviewWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  coderPreviewWindow.webContents.on('inspect-element', (event) => {
    event.preventDefault();
  });
  coderPreviewWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  coderPreviewWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  coderPreviewWindow.on('closed', () => {
    coderPreviewWindow = null;
    if (coderPreviewTempFilePath) {
      fs.promises.unlink(coderPreviewTempFilePath).catch(() => {});
    }
  });
  coderPreviewWindow.once('ready-to-show', () => coderPreviewWindow?.show());

  await coderPreviewWindow.loadURL(previewUrl);
  if (coderPreviewWindow && !coderPreviewWindow.isVisible()) coderPreviewWindow.show();
}

function createSiteAppWindow(appId, title, url) {
  const key = appId || url;
  const existing = siteAppWindows.get(key);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    icon: HAS_ICON ? DISPLAY_ICON : undefined,
    backgroundColor: '#0f1116',
    webPreferences: {
      preload: path.join(__dirname, '../preload/site-app-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: true,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '../../html/windows/site-app.html'), {
    query: { title: title || 'App', url: url || 'about:blank', app: appId || 'app' }
  });

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: false
    }
  });
  win.setBrowserView(view);
  const setViewBounds = () => {
    const bounds = win.getContentBounds();
    const headerHeight = 0;
    view.setBounds({ x: 0, y: headerHeight, width: bounds.width, height: Math.max(0, bounds.height - headerHeight) });
    view.setAutoResize({ width: true, height: true });
  };
  win.on('resize', setViewBounds);
  win.on('maximize', setViewBounds);
  win.on('unmaximize', setViewBounds);
  setViewBounds();

  if (url) {
    view.webContents.loadURL(url);
  }

  const menuTemplate = [
    { label: 'Back', click: () => { if (view.webContents.canGoBack()) view.webContents.goBack(); } },
    { label: 'Reload', click: () => view.webContents.reload() },
    { type: 'separator' },
    { label: 'Minimize', click: () => win.minimize() },
    { label: 'Maximize', click: () => (win.isMaximized() ? win.unmaximize() : win.maximize()) },
    { label: 'Dev Tools', click: () => win.webContents.openDevTools({ mode: 'detach' }) },
    { type: 'separator' },
    { label: 'Close', click: () => win.close() }
  ];

  const showContextMenu = () => {
    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup({ window: win });
  };

  win.webContents.on('context-menu', showContextMenu);
  view.webContents.on('context-menu', showContextMenu);

  win.once('ready-to-show', () => win.show());

  win.on('closed', () => {
    siteAppWindows.delete(key);
    const existingView = siteAppViews.get(key);
    if (existingView) {
      try { existingView.webContents.destroy(); } catch (e) {}
      siteAppViews.delete(key);
    }
  });

  siteAppWindows.set(key, win);
  siteAppViews.set(key, view);
}

function createPreviewWindow(url) {
    if (previewWindow) {
        previewWindow.show(); previewWindow.focus();
        previewWindow.webContents.send('preview-load', url);
        return;
    }
    previewWindow = new BrowserWindow({
        width: 860, height: 640, frame: false, transparent: true, alwaysToTop: true, parent: mainWindow, show: false,
        icon: HAS_ICON ? DISPLAY_ICON : undefined,
        webPreferences: { preload: path.join(__dirname, '../preload.js'), webviewTag: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, sandbox: true, devTools: false }
    });
    const theme = cachedSettings.theme || 'dark';
    previewWindow.loadFile(path.join(__dirname, '../../html/windows/preview.html'), { query: { url, theme } });
    previewWindow.once('ready-to-show', () => previewWindow.show());
    previewWindow.on('closed', () => previewWindow = null);
}

function getMindcloneAppRoot() {
    const devRoot = path.join(__dirname, '../../');
    if (!app.isPackaged) return devRoot;

    const unpackedRoot = path.join(process.resourcesPath, 'app.asar.unpacked');
    const packedRoot = path.join(process.resourcesPath, 'app.asar');
    const unpackedMindclone = path.join(unpackedRoot, 'game', 'electron', 'mindclone', 'minecraft.html');
    return fs.existsSync(unpackedMindclone) ? unpackedRoot : packedRoot;
}

function registerMindcloneProtocol(gameSession) {
    const root = getMindcloneAppRoot();
    const rootAbs = path.resolve(root);
    const rootCmp = process.platform === 'win32' ? rootAbs.toLowerCase() : rootAbs;
    const fallbackHtml = path.join(rootAbs, 'game', 'electron', 'mindclone', 'minecraft.html');
    const fallbackTexture = path.join(rootAbs, 'game', 'electron', 'mindclone', 'assets', 'stone.png');
    const fallbackModule = path.join(rootAbs, 'game', 'electron', 'mindclone', 'assets', 'empty-module.js');
    const fallbackCss = path.join(rootAbs, 'game', 'electron', 'mindclone', 'assets', 'empty.css');
    const fallbackText = path.join(rootAbs, 'game', 'electron', 'mindclone', 'assets', 'empty.txt');
    const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']);
    const moduleExt = new Set(['.js', '.mjs', '.cjs', '.json', '.map']);

    const pickFallback = (resolvedPath) => {
        const ext = path.extname(String(resolvedPath || '')).toLowerCase();
        if (imageExt.has(ext) && fs.existsSync(fallbackTexture)) return fallbackTexture;
        if (moduleExt.has(ext) && fs.existsSync(fallbackModule)) return fallbackModule;
        if (ext === '.css' && fs.existsSync(fallbackCss)) return fallbackCss;
        if ((ext === '.html' || ext === '.htm' || ext === '') && fs.existsSync(fallbackHtml)) return fallbackHtml;
        if (fs.existsSync(fallbackText)) return fallbackText;
        if (fs.existsSync(fallbackHtml)) return fallbackHtml;
        return null;
    };

    try {
        gameSession.protocol.registerFileProtocol('mindclone', (request, callback) => {
            try {
                const req = new URL(request.url);
                let relative = decodeURIComponent(req.pathname || '/').replace(/^[/\\]+/, '');
                const resolved = path.resolve(rootAbs, relative);
                const resolvedCmp = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
                const inRoot = resolvedCmp === rootCmp || resolvedCmp.startsWith(rootCmp + path.sep);
                if (!inRoot) {
                    console.warn('[Mindclone] Protocol access denied:', request.url, '->', resolved);
                    const denyFallback = pickFallback(resolved);
                    if (denyFallback) callback({ path: denyFallback });
                    else callback({ error: -10 }); // ACCESS_DENIED
                    return;
                }
                if (fs.existsSync(resolved)) {
                    let finalPath = resolved;
                    const stat = fs.statSync(resolved);
                    if (stat.isDirectory()) {
                        const indexHtml = path.join(resolved, 'index.html');
                        finalPath = fs.existsSync(indexHtml) ? indexHtml : pickFallback(resolved);
                    }
                    if (finalPath && fs.existsSync(finalPath)) {
                        callback({ path: finalPath });
                        return;
                    }
                }

                const fallback = pickFallback(resolved);
                if (fallback) {
                    console.warn('[Mindclone] Protocol file missing, using fallback:', request.url, '->', resolved, '=>', fallback);
                    callback({ path: fallback });
                    return;
                }
                console.warn('[Mindclone] Protocol file not found with no fallback:', request.url, '->', resolved);
                callback({ error: -6 }); // FILE_NOT_FOUND
            } catch (error) {
                console.error('[Mindclone] Protocol resolve error:', error);
                const fallback = fs.existsSync(fallbackHtml) ? fallbackHtml : null;
                if (fallback) callback({ path: fallback });
                else callback({ error: -2 }); // FAILED
            }
        });
    } catch (error) {
        if (!String(error.message || '').includes('ERR_PROTOCOL_REGISTERED')) {
            console.error('[Mindclone] protocol registration failed:', error);
        }
    }
}

function createMinecraftGameWindow() {
    if (minecraftGameWindow) {
        const currentUrl = minecraftGameWindow.webContents.getURL();
        if (!currentUrl.startsWith('mindclone://')) {
            minecraftGameWindow.loadURL('mindclone://app/game/electron/mindclone/minecraft.html');
        }
        minecraftGameWindow.show();
        minecraftGameWindow.focus();
        return;
    }

    const gameSession = session.fromPartition('persist:omx-minecraft-sandbox', { cache: true });
    registerMindcloneProtocol(gameSession);

    minecraftGameWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,
        title: 'Mindclone - Om-X',
        backgroundColor: '#000000',
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload/minecraft-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            sandbox: true,
            // Note: Mindclone loads ES modules via file://, which Chromium treats as CORS-restricted with opaque origin.
            // webSecurity is disabled ONLY for this isolated local file://  session and only in this specific window.
            // The session is restricted to local file access only (see protocol.registerSchemesAsPrivileged + onBeforeRequest).
            webSecurity: false,
            allowRunningInsecureContent: false,
            webviewTag: false,
            devTools: false,  // Security: Disable DevTools
            session: gameSession
        }
    });

    // If the page tries to block closing (beforeunload), force close
    minecraftGameWindow.webContents.on('will-prevent-unload', (event) => {
        event.preventDefault();
        if (!minecraftGameWindow.isDestroyed()) {
            minecraftGameWindow.destroy();
        }
    });

    minecraftGameWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
        console.error('[Mindclone] did-fail-load:', code, desc, url);
    });

    minecraftGameWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        const lvl = ['log', 'warn', 'error'][Math.min(2, Math.max(0, level - 1))] || 'log';
        const tag = lvl === 'error' ? 'error' : lvl === 'warn' ? 'warn' : 'log';
        console[tag](`[Mindclone:renderer] ${sourceId}:${line} ${message}`);
    });

    minecraftGameWindow.loadURL('mindclone://app/game/electron/mindclone/minecraft.html');

    minecraftGameWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    minecraftGameWindow.webContents.on('will-navigate', (event, url) => {
        // Allow ONLY local mindclone protocol navigation
        if (!url.startsWith('mindclone://')) event.preventDefault();
    });

    gameSession.webRequest.onBeforeRequest((details, callback) => {
        const url = details.url;
        // Allow only local mindclone:// resources for this game (+ devtools when opened manually)
        if (url.startsWith('mindclone://') || url.startsWith('devtools://')) {
            callback({ cancel: false });
            return;
        }
        // Block everything else (http/https/wss/etc.)
        callback({ cancel: true });
    });

    gameSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

    minecraftGameWindow.once('ready-to-show', () => minecraftGameWindow.show());
    minecraftGameWindow.on('closed', () => {
        minecraftGameWindow = null;
        if (!mainWindow && process.platform !== 'darwin') app.quit();
    });
}

ipcMain.on('window-minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('window-maximize', (e) => { const w = BrowserWindow.fromWebContents(e.sender); w?.isMaximized() ? w.unmaximize() : w?.maximize(); });
ipcMain.on('window-close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('window-toggle-devtools', (e) => {
    toggleDevTools(BrowserWindow.fromWebContents(e.sender));
});

ipcMain.handle('window:compact-for-game', async (_event, options = {}) => {
    try {
        if (!mainWindow || mainWindow.isDestroyed()) return { success: false, error: 'Main window not available' };

        const targetWidth = Math.max(700, Number(options.width) || 980);
        const targetHeight = Math.max(560, Number(options.height) || 720);
        const gameId = options.gameId || null;

        if (!mainWindowGameCompactState.active) {
            mainWindowGameCompactState.previousBounds = mainWindow.getBounds();
            mainWindowGameCompactState.wasMaximized = mainWindow.isMaximized();
            if (mainWindowGameCompactState.wasMaximized) mainWindow.unmaximize();
        }

        mainWindowGameCompactState.active = true;
        mainWindowGameCompactState.gameId = gameId;

        const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
        const work = display.workArea;
        const x = Math.round(work.x + (work.width - targetWidth) / 2);
        const y = Math.round(work.y + (work.height - targetHeight) / 2);
        mainWindow.setBounds({ x, y, width: targetWidth, height: targetHeight }, true);
        mainWindow.focus();

        return { success: true };
    } catch (error) {
        console.error('[Window] compact-for-game failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('window:restore-after-game', async () => {
    try {
        if (!mainWindow || mainWindow.isDestroyed()) return { success: false, error: 'Main window not available' };
        if (!mainWindowGameCompactState.active) return { success: true, restored: false };

        const prev = mainWindowGameCompactState.previousBounds;
        const wasMax = mainWindowGameCompactState.wasMaximized;
        mainWindowGameCompactState = { active: false, previousBounds: null, wasMaximized: false, gameId: null };

        if (wasMax) {
            mainWindow.maximize();
        } else if (prev && Number.isFinite(prev.width) && Number.isFinite(prev.height)) {
            mainWindow.setBounds(prev, true);
        }
        mainWindow.focus();
        return { success: true, restored: true };
    } catch (error) {
        console.error('[Window] restore-after-game failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('minecraft-game:open', () => {
    if (minecraftGameWindow && !minecraftGameWindow.isDestroyed()) {
        minecraftGameWindow.show();
        minecraftGameWindow.focus();
        return true;
    }
    createMinecraftGameWindow();
    return true;
});

ipcMain.on('minecraft-game:close', () => {
    if (minecraftGameWindow && !minecraftGameWindow.isDestroyed()) {
        minecraftGameWindow.close();
    }
});

ipcMain.on('open-tab', (e, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('open-tab', url);
    }
});

ipcMain.on('preview-open', (e, url) => createPreviewWindow(url));
ipcMain.on('preview-close', () => { if (previewWindow) previewWindow.close(); });
ipcMain.on('preview-to-tab', (e, url) => { if (previewWindow) previewWindow.close(); if (mainWindow) mainWindow.webContents.send('open-tab', url); });
ipcMain.handle('minecraft-game:launch', () => {
    createMinecraftGameWindow();
    return { success: true };
});
ipcMain.on('minecraft-game:close', () => minecraftGameWindow?.close());
ipcMain.on('minecraft-game:ready', () => {});

const MINDCLONE_GENERATOR_VERSION = 'v1';
const getMindcloneRoot = () => path.join(app.getPath('userData'), 'mindclone', 'worlds');
const safeWorldId = (raw) => String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
const chunkFilePath = (worldId, cx, cz) => {
    const rx = Math.floor(Number(cx) / 32);
    const rz = Math.floor(Number(cz) / 32);
    const regionDir = path.join(getMindcloneRoot(), safeWorldId(worldId), 'chunks', `r.${rx}.${rz}`);
    return path.join(regionDir, `c.${Number(cx)}.${Number(cz)}.bin`);
};

async function ensureMindcloneWorldDir(worldId) {
    const id = safeWorldId(worldId);
    if (!id) throw new Error('Invalid world id');
    const dir = path.join(getMindcloneRoot(), id);
    await fs.promises.mkdir(dir, { recursive: true });
    return dir;
}

ipcMain.handle('mindclone:worlds:list', async () => {
    try {
        const root = getMindcloneRoot();
        await fs.promises.mkdir(root, { recursive: true });
        const entries = await fs.promises.readdir(root, { withFileTypes: true });
        const worlds = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const id = entry.name;
            const metaPath = path.join(root, id, 'world.meta.json');
            try {
                const text = await fs.promises.readFile(metaPath, 'utf8');
                const meta = JSON.parse(text);
                worlds.push(meta);
            } catch (_) {}
        }
        worlds.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        return { success: true, worlds };
    } catch (error) {
        return { success: false, worlds: [], error: error.message };
    }
});

ipcMain.handle('mindclone:worlds:create', async (_event, payload = {}) => {
    try {
        const name = String(payload.name || 'New World').trim().slice(0, 80) || 'New World';
        const seed64 = String(payload.seed64 || `${Date.now()}${Math.floor(Math.random() * 100000)}`);
        const id = safeWorldId(payload.id || `world_${Date.now()}`);
        if (!id) throw new Error('Invalid world id');
        const settings = payload.settings || {};
        const now = Date.now();
        const meta = {
            id,
            name,
            seed64,
            generatorVersion: payload.generatorVersion || MINDCLONE_GENERATOR_VERSION,
            createdAt: now,
            updatedAt: now,
            settings
        };
        const dir = await ensureMindcloneWorldDir(id);
        await fs.promises.mkdir(path.join(dir, 'chunks'), { recursive: true });
        await fs.promises.writeFile(path.join(dir, 'world.meta.json'), JSON.stringify(meta, null, 2), 'utf8');
        return { success: true, meta };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('mindclone:worlds:delete', async (_event, worldId) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        await fs.promises.rm(path.join(getMindcloneRoot(), id), { recursive: true, force: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('mindclone:worlds:get-meta', async (_event, worldId) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        const text = await fs.promises.readFile(path.join(getMindcloneRoot(), id, 'world.meta.json'), 'utf8');
        return { success: true, meta: JSON.parse(text) };
    } catch (error) {
        return { success: false, meta: null, error: error.message };
    }
});

ipcMain.handle('mindclone:worlds:save-meta', async (_event, worldId, meta) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        const dir = await ensureMindcloneWorldDir(id);
        const nextMeta = { ...(meta || {}), id, updatedAt: Date.now() };
        await fs.promises.writeFile(path.join(dir, 'world.meta.json'), JSON.stringify(nextMeta, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('mindclone:player:load', async (_event, worldId) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        const filePath = path.join(getMindcloneRoot(), id, 'player.bin');
        if (!fs.existsSync(filePath)) return { success: true, data: null };
        const buf = await fs.promises.readFile(filePath);
        return { success: true, data: buf.toString('base64') };
    } catch (error) {
        return { success: false, data: null, error: error.message };
    }
});

ipcMain.handle('mindclone:player:save', async (_event, worldId, base64) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        const dir = await ensureMindcloneWorldDir(id);
        const buf = Buffer.from(String(base64 || ''), 'base64');
        await fs.promises.writeFile(path.join(dir, 'player.bin'), buf);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('mindclone:chunks:list', async (_event, worldId) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        const baseDir = path.join(getMindcloneRoot(), id, 'chunks');
        if (!fs.existsSync(baseDir)) return { success: true, chunks: [] };
        const keys = [];
        const walk = async (dir) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(full);
                } else if (entry.isFile() && entry.name.startsWith('c.') && entry.name.endsWith('.bin')) {
                    const m = entry.name.match(/^c\.(-?\d+)\.(-?\d+)\.bin$/);
                    if (m) keys.push({ cx: Number(m[1]), cz: Number(m[2]) });
                }
            }
        };
        await walk(baseDir);
        return { success: true, chunks: keys };
    } catch (error) {
        return { success: false, chunks: [], error: error.message };
    }
});

ipcMain.handle('mindclone:chunks:load', async (_event, worldId, cx, cz) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        const filePath = chunkFilePath(id, cx, cz);
        if (!fs.existsSync(filePath)) return { success: true, data: null };
        const buf = await fs.promises.readFile(filePath);
        return { success: true, data: buf.toString('base64') };
    } catch (error) {
        return { success: false, data: null, error: error.message };
    }
});

ipcMain.handle('mindclone:chunks:save', async (_event, worldId, cx, cz, base64) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        const filePath = chunkFilePath(id, cx, cz);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        const buf = Buffer.from(String(base64 || ''), 'base64');
        await fs.promises.writeFile(filePath, buf);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('mindclone:chunks:delete', async (_event, worldId, cx, cz) => {
    try {
        const id = safeWorldId(worldId);
        if (!id) throw new Error('Invalid world id');
        await fs.promises.rm(chunkFilePath(id, cx, cz), { force: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================================
// WINDOW PICKER IPC HANDLERS (Screenshot System)
// ============================================

// Get all open windows for window picker
ipcMain.handle('screenshot:get-windows', async () => {
    try {
        const allWindows = BrowserWindow.getAllWindows();
        const mainWindowId = mainWindow?.id;
        
        const windows = allWindows
            .filter(win => !win.isDestroyed())
            .filter(win => win.id !== mainWindowId) // Exclude main window
            .map(win => ({
                id: win.id,
                title: win.getTitle(),
                bounds: win.getBounds(),
                isVisible: win.isVisible(),
                isFocused: win.isFocused()
            }));
        
        return { success: true, windows };
    } catch (error) {
        console.error('[Main] Error getting windows:', error);
        return { success: false, error: error.message, windows: [] };
    }
});

// Capture a specific window by ID
ipcMain.handle('screenshot:capture-window', async (event, windowId) => {
    try {
        const targetWindow = BrowserWindow.fromId(windowId);
        
        if (!targetWindow || targetWindow.isDestroyed()) {
            return { success: false, error: 'Window not found or destroyed' };
        }
        
        // Get the native image from the window
        const image = await targetWindow.capture();
        const dataUrl = image.toDataURL();
        
        return { 
            success: true, 
            dataUrl,
            bounds: targetWindow.getBounds()
        };
    } catch (error) {
        console.error('[Main] Error capturing window:', error);
        return { success: false, error: error.message };
    }
});

// ============================================
// DISPLAY PICKER IPC HANDLERS (Multi-Monitor Support)
// ============================================

// Get all displays for display picker
ipcMain.handle('screenshot:get-displays', async () => {
    try {
        const allDisplays = screen.getAllDisplays();
        
        const displays = allDisplays.map((display, index) => {
            // Determine label based on position and properties
            let label = `Display ${index + 1}`;
            if (display.bounds.x === 0 && display.bounds.y === 0) {
                label = 'Primary Display';
            }
            if (allDisplays.length === 1) {
                label = 'Display';
            }
            
            return {
                id: display.id,
                bounds: {
                    x: display.bounds.x,
                    y: display.bounds.y,
                    width: display.bounds.width,
                    height: display.bounds.height
                },
                scaleFactor: display.scaleFactor,
                colorDepth: display.colorDepth,
                label: label,
                isPrimary: index === 0
            };
        });
        
        return { success: true, displays };
    } catch (error) {
        console.error('[Main] Error getting displays:', error);
        return { success: false, error: error.message, displays: [] };
    }
});

// Capture a specific display by ID
ipcMain.handle('screenshot:capture-display', async (event, displayId) => {
    try {
        const allDisplays = screen.getAllDisplays();
        const targetDisplay = allDisplays.find(d => d.id === displayId);
        
        if (!targetDisplay) {
            return { success: false, error: 'Display not found' };
        }
        
        // Create a BrowserWindow to capture the display
        const captureWindow = new BrowserWindow({
            width: targetDisplay.bounds.width,
            height: targetDisplay.bounds.height,
            x: targetDisplay.bounds.x,
            y: targetDisplay.bounds.y,
            show: false,
            frame: false,
            transparent: true,
            webPreferences: {
                preload: path.join(__dirname, '../preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            }
        });
        
        // Capture the screen
        const image = await captureWindow.capture();
        captureWindow.close();
        
        const dataUrl = image.toDataURL();
        
        return { 
            success: true, 
            dataUrl,
            bounds: targetDisplay.bounds
        };
    } catch (error) {
        console.error('[Main] Error capturing display:', error);
        return { success: false, error: error.message };
    }
});

// ============================================
// ELECTRON GAMES IPC HANDLERS
// ============================================

// Track all electron game windows
global.electronGames = global.electronGames || {};

ipcMain.handle('electron-game:launch', async (event, gameConfig) => {
    try {
        const { id, name, gamePath, preloadPath, windowConfig } = gameConfig;
        
        // Resolve paths relative to app root
        const fullGamePath = path.join(__dirname, '../../', gamePath);
        const fullPreloadPath = preloadPath ? path.join(__dirname, '../../', preloadPath) : null;
        
        // Create new independent BrowserWindow for the game
        const gameWindow = new BrowserWindow({
            width: windowConfig.width || 800,
            height: windowConfig.height || 600,
            title: windowConfig.title || name,
            resizable: windowConfig.resizable !== false,
            backgroundColor: windowConfig.backgroundColor || '#1a1a2e',
            webPreferences: {
                preload: fullPreloadPath || undefined,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            },
            // Remove default menu for cleaner game experience
            autoHideMenuBar: true,
            // Center on screen
            center: true
        });
        
        // Load the game
        await gameWindow.loadFile(fullGamePath);
        
        // Track the window
        global.electronGames[id] = gameWindow;
        
        // Cleanup on close
        gameWindow.on('closed', () => {
            delete global.electronGames[id];
        });
        
        // Optional: Open devtools for debugging (commented out by default)
        // gameWindow.webContents.openDevTools();
        
        return { success: true, windowId: gameWindow.id };
    } catch (error) {
        console.error('[Main] Failed to launch electron game:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('electron-game:close', async (event, gameId) => {
    try {
        if (global.electronGames && global.electronGames[gameId]) {
            global.electronGames[gameId].close();
            delete global.electronGames[gameId];
            return { success: true };
        }
        return { success: false, error: 'Game not found' };
    } catch (error) {
        console.error('[Main] Failed to close electron game:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('electron-game:get-windows', async () => {
    const windows = {};
    for (const [id, win] of Object.entries(global.electronGames)) {
        if (win && !win.isDestroyed()) {
            windows[id] = {
                id: win.id,
                title: win.getTitle(),
                isVisible: win.isVisible()
            };
        }
    }
    return windows;
});

// Launch standalone Electron game (has its own main.js)
// Uses root node_modules - no separate node_modules for games
ipcMain.handle('electron-game:launch-standalone', async (event, gameConfig) => {
    try {
        const { id, name, gamePath } = gameConfig;

        if (id === 'chess-master-electron') {
          chessMasterApp?.openWindow?.();
          return { success: true, embedded: true };
        }
        if (id === 'chessly-electron') {
          chesslyApp?.openWindow?.({ embedded: true });
          return { success: true, embedded: true };
        }
        if (id === 'go-electron') {
          goApp?.openWindow?.({ embedded: true });
          return { success: true, embedded: true };
        }
        // Resolve paths - use root node_modules
        const appDir = __dirname; // Om-X app directory
        const rootNodeModules = path.join(appDir, '../node_modules');
        const gameMainFile = path.join(appDir, '../../', gamePath);
        
        console.log(`[Main] Launching standalone game: ${name}`);
        console.log(`[Main] Game main file: ${gameMainFile}`);
        console.log(`[Main] Using root node_modules: ${rootNodeModules}`);
        
        // Spawn Electron with the game's main.js, using root node_modules
        const gameProcess = require('child_process').spawn(
            process.execPath,
            [`--standalone-entry=${gameMainFile}`],
            {
                cwd: appDir, // Use Om-X working directory for node_modules
                detached: true,
                stdio: 'pipe',
                env: {
                    ...process.env,
                    NODE_PATH: rootNodeModules
                }
            }
        );
        
        // Handle process output
        gameProcess.stdout?.on('data', (data) => {
            console.log(`[${name}] ${data.toString().trim()}`);
        });
        
        gameProcess.stderr?.on('data', (data) => {
            console.error(`[${name}] ${data.toString().trim()}`);
        });
        
        // Detach the process so it runs independently
        gameProcess.unref();
        
        // Track the process
        if (!global.standaloneGames) global.standaloneGames = {};
        global.standaloneGames[id] = gameProcess;
        
        console.log(`[Main] Launched standalone game: ${name} (PID: ${gameProcess.pid})`);
        
        return { success: true, pid: gameProcess.pid };
    } catch (error) {
        console.error('[Main] Failed to launch standalone game:', error);
        return { success: false, error: error.message };
    }
});

// Dialog handlers for file/folder selection
ipcMain.handle('dialog:select-file', async (e, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters || []
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('files:read-dir', async (e, dirPath) => {
    try {
        const files = await fs.promises.readdir(dirPath);
        return files;
    } catch (e) {
        return [];
    }
});

ipcMain.handle('settings-get', () => cachedSettings);
ipcMain.handle('settings-save', async (e, s) => {
  const normalizedSettings = {
    ...(s || {}),
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...(s?.shortcuts || {})
    },
    blocklist: mergeWithDefaultBlocklist(s?.blocklist)
  };
  cachedSettings = normalizedSettings;
  const success = await safeWriteJson(settingsPath, normalizedSettings);
  if (success) {
    configureSecurity(normalizedSettings, mainWindow);
    applyYouTubeAdsBlocking(normalizedSettings);
    broadcast('settings-updated', normalizedSettings);
  }
  return success;
});

ipcMain.handle('security:virustotal-verify-key', async (_event, apiKey) => {
  try {
    if (!virusTotalClient) virusTotalClient = new VirusTotalClient(cachedSettings);
    return await virusTotalClient.verifyApiKey(apiKey || '');
  } catch (error) {
    return { success: false, error: error?.message || 'VirusTotal verification failed.' };
  }
});

ipcMain.handle('security:virustotal-scan-url', async (_event, payload = {}) => {
  try {
    if (!virusTotalClient) virusTotalClient = new VirusTotalClient(cachedSettings);
    const url = String(payload?.url || '').trim();
    const apiKey = String(payload?.apiKey || '').trim();
    if (!url) return { success: false, error: 'URL is required.' };
    return await virusTotalClient.scanUrlDetailed(url, { apiKey, force: true, timeoutMs: 9000 });
  } catch (error) {
    return { success: false, error: error?.message || 'VirusTotal URL scan failed.' };
  }
});

ipcMain.handle('system-open-path', async (e, targetPath) => {
    try { if (!targetPath) return false; await shell.openPath(targetPath); return true; } catch (e) { return false; }
});

ipcMain.handle('system-get-user-data-path', () => app.getPath('userData'));

ipcMain.handle('system-get-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion()
  };
});

ipcMain.handle('system-get-local-ip', () => {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1'; // Fallback to localhost
  } catch (error) {
    console.error('[Main] Error getting local IP:', error);
    return '127.0.0.1';
  }
});


ipcMain.on('security:request-lock', (event, targetUrl) => {
    if (!securityManager || !mainWindow) return;
    const lockUrl = securityManager.getLockScreenUrl(targetUrl);
    if (event.sender && event.sender !== mainWindow.webContents) event.sender.loadURL(lockUrl);
});

// Image Scraping Persistence Handlers
ipcMain.handle('ai:save-images-to-desktop', async (event, images) => {
    try {
        if (!fs.existsSync(SCRAPES_DIR)) fs.mkdirSync(SCRAPES_DIR, { recursive: true });
        const results = [];
        for (const img of images) {
            const timestamp = Date.now();
            const fileName = `scrape-${timestamp}-${Math.floor(Math.random() * 1000)}.png`;
            const filePath = path.join(SCRAPES_DIR, fileName);
            const base64Data = img.data.replace(/^data:image\/\w+;base64,/, "");
            await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
            results.push(filePath);
        }
        return { success: true, count: results.length, folder: SCRAPES_DIR };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('ai:get-desktop-scrapes', async () => {
    try {
        if (!fs.existsSync(SCRAPES_DIR)) return [];
        const files = await fs.promises.readdir(SCRAPES_DIR);
        const images = [];
        for (const file of files) {
            if (/\.(png|jpg|jpeg|webp)$/i.test(file)) {
                const fullPath = path.join(SCRAPES_DIR, file);
                const buffer = await fs.promises.readFile(fullPath);
                images.push({
                    name: file,
                    path: fullPath,
                    data: `data:image/png;base64,${buffer.toString('base64')}`
                });
            }
        }
        return images.sort((a, b) => b.name.localeCompare(a.name));
    } catch (e) {
        return [];
    }
});

async function generateAIFailureReport(params, error) {
    try {
        const defaultDir = cachedSettings.downloadPath && fs.existsSync(cachedSettings.downloadPath) ? cachedSettings.downloadPath : app.getPath('downloads');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(defaultDir, `Omni-Intelligence-Failure-Report-${timestamp}.txt`);
        
        let reportContent = `--- OMNI INTELLIGENCE CORE FAILURE REPORT ---
Timestamp: ${new Date().toLocaleString()}
Application Version: ${DEFAULT_SETTINGS.version}

1. ERROR SUMMARY
Message: ${error.message || error}
Trace: ${error.stack || 'No local stack trace available.'}

2. REQUEST PARAMETERS
Query: "${params.text || 'N/A'}"
Context: ${params.context || 'General'}
Provider: ${params.configOverride?.provider || 'Native/Default'}

3. SYSTEM ENVIRONMENT
OS: ${process.platform} ${os.release()}
Node: ${process.versions.node}
Electron: ${process.versions.electron}

--- END OF REPORT ---`;

        await fs.promises.writeFile(reportPath, reportContent, 'utf8');
        console.log(`[Omni Diagnostics] Failure report generated: ${reportPath}`);
        
        broadcast('notification', {
            title: 'AI Pipeline Failure',
            message: 'A diagnostic report has been saved to your downloads folder.',
            type: 'error'
        });
    } catch (e) {
        console.error("[Omni Diagnostics] Failed to write failure report:", e);
    }
}

const SARVAM_LANG_MAP = {
    auto: 'auto',
    en: 'en-IN',
    hi: 'hi-IN',
    bn: 'bn-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    pa: 'pa-IN',
    es: 'es-ES',
    fr: 'fr-FR',
    ja: 'ja-JP',
    zh: 'zh-CN'
};

const toSarvamLanguageCode = (code, fallback = 'en-IN') => {
    const normalized = String(code || '').trim();
    if (!normalized) return fallback;
    if (normalized.includes('-')) return normalized;
    return SARVAM_LANG_MAP[normalized.toLowerCase()] || normalized;
};

const performAITask = async (event, params) => {
    const { text, target, source, promptOverride, configOverride, context, contents, tools, searchMode, wikiMode, videoMode, searchDepth } = params;
    const settings = cachedSettings || DEFAULT_SETTINGS;
    
    // Config resolution
    const activeProvider = settings.activeProvider || 'google';
    const contextDefaults = context === 'writer' ? settings.writer?.api : settings.translator?.api;
    const config = configOverride || contextDefaults || { provider: activeProvider, key: '', model: '' };
    const aiConfig = { ...(settings.aiConfig || {}), searchMode, wikiMode, videoMode, searchDepth };

    const execute = async () => {
        let promptInput = contents || promptOverride;
        if (!promptInput && text) {
            if (context === 'translator') {
                const sourceHint = (source && source !== 'auto') ? `from "${source}"` : "auto-detecting source";
                promptInput = `Directly translate the following text to language code "${target}" ${sourceHint}. Text: ${text}`;
            } else {
                promptInput = text;
            }
        }

        try {
            const targetProvider = config.provider || activeProvider;
            if (context === 'translator' && targetProvider === 'sarvamai') {
                const key = String(config.key || '').trim();
                if (!key) return { error: 'SarvamAI API key is required for translator.' };

                const sourceLanguage = toSarvamLanguageCode(source || 'auto', 'auto');
                const targetLanguage = toSarvamLanguageCode(target || settings.translator?.defaultTarget || 'en', 'en-IN');
                const model = String(config.model || '').trim() || 'sarvam-translate:v1';
                const inputText = String(text || '').trim();
                if (!inputText) return { text: '', provider: 'sarvamai' };

                const client = new SarvamAIClient({ apiSubscriptionKey: key });
                const translated = await client.text.translate({
                    input: inputText,
                    source_language_code: sourceLanguage,
                    target_language_code: targetLanguage,
                    speaker_gender: 'Male',
                    model
                });

                return {
                    text: translated?.translated_text || '',
                    provider: 'sarvamai'
                };
            }

            const result = await aiProvider.performTask(promptInput, {
                provider: targetProvider,
                model: config.model,
                keyOverride: config.key || '',
                tools: params.tools,
                systemInstruction: params.systemInstruction,
                aiConfig: aiConfig
            });
            
            const response = typeof result === 'string' ? { text: result.trim() } : result;
            if (!response.provider) response.provider = config.provider;
            return response; 
        } catch (error) { 
            console.error("[Main Process AI Task Error]:", error);
            await generateAIFailureReport(params, error);
            return { error: error.message }; 
        }
    };
    
    return await execute();
};

const normalizeBaseUrl = (baseUrl = '') => {
    const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
};

const modelEndpointFromBaseUrl = (baseUrl = '') => {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized) return '';
    if (/\/v1$/i.test(normalized)) return `${normalized}/models`;
    return `${normalized}/v1/models`;
};

ipcMain.handle('ai-verify-and-list-models', async (event, { provider, apiKey, baseUrl }) => {
    try {
        const p = (provider || '').trim();
        const key = (apiKey || '').trim();
        const normalizeOpenAIModels = (data) => {
            const ids = (data?.data || []).map((m) => m?.id).filter(Boolean);
            return Array.from(new Set(ids));
        };

        if (!p) return { success: false, error: 'Provider is required.' };

        if (p === 'offline') {
            return { success: true, models: ['offline-bot-v1'] };
        }

        if (p === 'google') {
            if (!key) return { success: false, error: 'API key is required for Google Gemini.' };
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
            if (!res.ok) {
                const errText = await res.text();
                return { success: false, error: `Gemini verification failed: ${res.status} ${errText}` };
            }
            const data = await res.json();
            const models = Array.from(new Set(
                (data?.models || [])
                    .filter((m) => {
                        const name = (m?.name || '').toLowerCase();
                        const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
                        return name.includes('gemini') && (methods.length === 0 || methods.includes('generateContent'));
                    })
                    .map((m) => (m?.name || '').replace(/^models\//i, ''))
                    .filter(Boolean)
            ));
            return { success: true, models };
        }

        if (p === 'openai') {
            if (!key) return { success: false, error: 'API key is required for OpenAI.' };
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${key}` }
            });
            if (!res.ok) {
                const errText = await res.text();
                return { success: false, error: `OpenAI verification failed: ${res.status} ${errText}` };
            }
            const data = await res.json();
            return { success: true, models: normalizeOpenAIModels(data) };
        }

        if (p === 'groq') {
            if (!key) return { success: false, error: 'API key is required for Groq.' };
            const res = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { Authorization: `Bearer ${key}` }
            });
            if (!res.ok) {
                const errText = await res.text();
                return { success: false, error: `Groq verification failed: ${res.status} ${errText}` };
            }
            const data = await res.json();
            return { success: true, models: normalizeOpenAIModels(data) };
        }

        if (p === 'openrouter') {
            if (!key) return { success: false, error: 'API key is required for OpenRouter.' };
            const keyRes = await fetch('https://openrouter.ai/api/v1/key', {
                headers: { Authorization: `Bearer ${key}` }
            });
            if (!keyRes.ok) {
                const errText = await keyRes.text();
                return { success: false, error: `OpenRouter key verification failed: ${keyRes.status} ${errText}` };
            }
            const res = await fetch('https://openrouter.ai/api/v1/models');
            if (!res.ok) {
                const errText = await res.text();
                return { success: false, error: `OpenRouter model fetch failed: ${res.status} ${errText}` };
            }
            const data = await res.json();
            const models = Array.from(new Set((data?.data || []).map((m) => m?.id).filter(Boolean)));
            return { success: true, models };
        }

        if (p === 'mistral') {
            if (!key) return { success: false, error: 'API key is required for Mistral.' };
            const res = await fetch('https://api.mistral.ai/v1/models', {
                headers: { Authorization: `Bearer ${key}` }
            });
            if (!res.ok) {
                const errText = await res.text();
                return { success: false, error: `Mistral verification failed: ${res.status} ${errText}` };
            }
            const data = await res.json();
            return { success: true, models: normalizeOpenAIModels(data) };
        }

        if (p === 'sarvamai') {
            if (!key) return { success: false, error: 'API key is required for SarvamAI.' };
            const client = new SarvamAIClient({ apiSubscriptionKey: key });
            await client.text.translate({
                input: 'hello',
                source_language_code: 'auto',
                target_language_code: 'hi-IN',
                speaker_gender: 'Male',
                model: 'mayura:v1'
            });
            return { success: true, models: ['sarvam-translate:v1', 'mayura:v1'] };
        }

        if (p === 'lmstudio' || p === 'llamacpp' || p === 'openai-compatible') {
            const endpoint = modelEndpointFromBaseUrl(baseUrl || '');
            if (!endpoint) return { success: false, error: 'Base URL is required for local/OpenAI-compatible providers.' };
            const headers = { Accept: 'application/json' };
            if (key) headers.Authorization = `Bearer ${key}`;
            const res = await fetch(endpoint, { headers });
            if (!res.ok) {
                const errText = await res.text();
                return { success: false, error: `Model endpoint failed: ${res.status} ${errText}` };
            }
            const data = await res.json();
            return { success: true, models: normalizeOpenAIModels(data) };
        }

        return { success: false, error: `Unsupported provider: ${p}` };
    } catch (e) {
        return { success: false, error: e.message || 'Verification failed.' };
    }
});

ipcMain.handle('ai-perform-task', (e, p) => performAITask(e, p));
ipcMain.handle('translator-perform', (e, p) => performAITask(e, { ...p, context: 'translator' }));
ipcMain.handle('writer-perform', (e, p) => performAITask(e, { ...p, context: 'writer' }));

ipcMain.handle('ai-generate-speech', async (_event, payload = {}) => {
    try {
        const provider = String(payload.provider || '').trim().toLowerCase();
        const text = String(payload.text || '').trim();
        const settings = payload.settings || {};

        if (!provider) return { success: false, error: 'TTS provider is required.' };
        if (!text) return { success: false, error: 'Text is required for TTS.' };

        if (provider === 'sarvamai') {
            const apiKey = String(settings.apiKey || '').trim();
            if (!apiKey) return { success: false, error: 'SarvamAI API key is required.' };

            const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
            const targetLanguageCode = String(settings.targetLanguageCode || 'hi-IN').trim();
            const response = await client.textToSpeech.convert({
                text,
                target_language_code: targetLanguageCode
            });

            const base64 = Array.isArray(response?.audios) ? response.audios[0] : '';
            if (!base64) return { success: false, error: 'SarvamAI returned no audio data.' };
            return { success: true, mimeType: 'audio/wav', audioBase64: base64 };
        }

        if (provider === 'elevenlabs') {
            const apiKey = String(settings.apiKey || '').trim();
            if (!apiKey) return { success: false, error: 'ElevenLabs API key is required.' };

            const voiceId = String(settings.voiceId || 'JBFqnCBsd6RMkjVDRZzb').trim();
            const modelId = String(settings.modelId || 'eleven_turbo_v2_5').trim();
            const speed = Number.isFinite(Number(settings.speed)) ? Number(settings.speed) : 1;

            const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text,
                    model_id: modelId,
                    voice_settings: {
                        speed,
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                return { success: false, error: `ElevenLabs TTS failed: ${res.status} ${errText}` };
            }

            const audioBuffer = Buffer.from(await res.arrayBuffer());
            return {
                success: true,
                mimeType: 'audio/mpeg',
                audioBase64: audioBuffer.toString('base64')
            };
        }

        return { success: false, error: `Unsupported TTS provider: ${provider}` };
    } catch (error) {
        return { success: false, error: error.message || 'TTS generation failed.' };
    }
});

ipcMain.handle('dialog-save-image', async (event, { dataUrl, defaultName }) => {
    const defaultDir = cachedSettings.downloadPath && fs.existsSync(cachedSettings.downloadPath) ? cachedSettings.downloadPath : app.getPath('downloads');
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: path.join(defaultDir, defaultName || 'image.png'), filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }] });
    if (result.canceled || !result.filePath) return { success: false };
    try { const base64Data = dataUrl.split(',')[1]; await fs.promises.writeFile(result.filePath, Buffer.from(base64Data, 'base64')); return { success: true, filePath: result.filePath }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dialog-save-text', async (event, { content, defaultName }) => {
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName || 'file.txt' });
    if (result.canceled || !result.filePath) return { success: false };
    try { await fs.promises.writeFile(result.filePath, content, 'utf8'); return { success: true, filePath: result.filePath }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('dialog-open-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'svg'] }] });
    if (result.canceled || result.filePaths.length === 0) return null;
    try { const buffer = await fs.promises.readFile(result.filePaths[0]); const ext = path.extname(result.filePaths[0]).slice(1); return `data:image/${ext};base64,${buffer.toString('base64')}`; } catch (e) { return null; }
});

ipcMain.handle('dialog-open-pdf', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { 
        properties: ['openFile'], 
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }] 
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return pathToFileURL(result.filePaths[0]).href;
});

ipcMain.handle('dialog-open-text', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    try { const content = await fs.promises.readFile(result.filePaths[0], 'utf8'); return { success: true, content, filePath: result.filePaths[0] }; } catch (e) { return null; }
});

ipcMain.handle('dialog-select-file', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

ipcMain.handle('dialog-select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

ipcMain.handle('dialog-open-custom', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths;
});

ipcMain.handle('ai-ollama-check', async () => {
    try { const response = await fetch('http://localhost:11434/api/tags'); return response.ok; } catch (e) { return false; }
});

ipcMain.handle('ai-ollama-start-server', async () => {
    try { const cmd = process.platform === 'win32' ? 'ollama serve' : 'ollama serve'; const ollamaProcess = spawn(cmd, { shell: true, detached: true, stdio: 'ignore' }); ollamaProcess.unref(); return { success: true }; } 
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('ai-ollama-pull-model', async (event, modelId) => {
    return new Promise((resolve) => {
        const pull = spawn('ollama', ['pull', modelId], { shell: true });
        pull.on('close', (code) => { if (code === 0) resolve({ success: true }); else resolve({ success: false, error: `Process exited with code ${code}` }); });
        pull.on('error', (err) => resolve({ success: false, error: err.message }));
    });
});

// Security: Validate all file paths to prevent directory traversal attacks
ipcMain.handle('fs-read-file', async (e, filePath) => {
    try {
        const abs = path.resolve(String(filePath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        return await fs.promises.readFile(abs, 'utf8');
    } catch(e) {
        console.warn('[Security] fs-read-file blocked:', e?.message);
        return null;
    }
});

ipcMain.handle('fs-read-dir', async (e, dirPath) => {
    try {
        const abs = path.resolve(String(dirPath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        return await fs.promises.readdir(abs);
    } catch(e) {
        console.warn('[Security] fs-read-dir blocked:', e?.message);
        return [];
    }
});

ipcMain.handle('fs-stat-path', async (e, targetPath) => {
    try {
        const abs = path.resolve(String(targetPath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        const stat = await fs.promises.stat(abs);
        return {
            exists: true,
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory(),
            size: stat.size,
            mtimeMs: stat.mtimeMs
        };
    } catch (e) {
        return { exists: false, isFile: false, isDirectory: false, size: 0, mtimeMs: 0 };
    }
});

ipcMain.handle('fs-create-file', async (e, { path: filePath, content }) => {
    try {
        const abs = path.resolve(String(filePath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        await fs.promises.writeFile(abs, String(content || ''));
        return true;
    } catch(e) {
        console.warn('[Security] fs-create-file blocked:', e?.message);
        return false;
    }
});

ipcMain.handle('fs-create-folder', async (e, dirPath) => {
    try {
        const abs = path.resolve(String(dirPath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        await fs.promises.mkdir(abs, { recursive: true });
        return true;
    } catch(e) {
        console.warn('[Security] fs-create-folder blocked:', e?.message);
        return false;
    }
});

ipcMain.handle('fs-delete-path', async (e, targetPath) => {
    try {
        const abs = path.resolve(String(targetPath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        const stat = await fs.promises.stat(abs);
        if (stat.isDirectory()) await fs.promises.rm(abs, { recursive: true });
        else await fs.promises.unlink(abs);
        console.log('[Audit] Deleted:', abs);
        return true;
    } catch(e) {
        console.warn('[Security] fs-delete-path blocked:', e?.message);
        return false;
    }
});

ipcMain.handle('fs-rename-path', async (e, { oldPath, newPath }) => {
    try {
        const oldAbs = path.resolve(String(oldPath || ''));
        const newAbs = path.resolve(String(newPath || ''));
        if (!isPathInSafeDirectories(oldAbs) || !isPathInSafeDirectories(newAbs)) {
            throw new Error('Access denied: Path outside allowed directories');
        }
        await fs.promises.rename(oldAbs, newAbs);
        return true;
    } catch(e) {
        console.warn('[Security] fs-rename-path blocked:', e?.message);
        return false;
    }
});

function trimCoderGitText(value) {
    return String(value || '').replace(/\r/g, '').trim();
}

function summarizeCoderGitRun(result = {}) {
    return {
        ok: result.ok === true,
        exitCode: Number.isFinite(Number(result.exitCode)) ? Number(result.exitCode) : null,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        error: String(result.error || ''),
        timedOut: result.timedOut === true
    };
}

function runCoderGit(args = [], options = {}) {
    return new Promise((resolve) => {
        const safeArgs = Array.isArray(args) ? args.map((arg) => String(arg ?? '')) : [];
        let stdout = '';
        let stderr = '';
        let settled = false;
        let timedOut = false;

        const finish = (payload) => {
            if (settled) return;
            settled = true;
            resolve(payload);
        };

        // Security: Validate cwd to prevent git operations outside intended directories
        let safeCwd = undefined;
        if (options.cwd) {
            try {
                const cwdPath = path.resolve(String(options.cwd));
                // Check if cwd is within safe directories or is a valid path
                if (!isPathInSafeDirectories(cwdPath)) {
                    finish({
                        ok: false,
                        exitCode: null,
                        stdout: '',
                        stderr: 'Error: Git operations are restricted to safe directories',
                        error: 'Git cwd outside allowed directories',
                        timedOut: false
                    });
                    return;
                }
                safeCwd = cwdPath;
            } catch (e) {
                finish({
                    ok: false,
                    exitCode: null,
                    stdout: '',
                    stderr: 'Error: Invalid working directory path',
                    error: e?.message,
                    timedOut: false
                });
                return;
            }
        }

        let child;
        try {
            child = spawn('git', safeArgs, {
                cwd: safeCwd,
                windowsHide: true,
                shell: false
            });
        } catch (error) {
            finish({
                ok: false,
                exitCode: null,
                stdout,
                stderr,
                error: error?.message || String(error),
                timedOut: false,
                gitNotFound: error?.code === 'ENOENT'
            });
            return;
        }

        const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 20000);
        const maxOutputBytes = Math.max(4096, Number(options.maxOutputBytes) || 256 * 1024);
        const timer = setTimeout(() => {
            timedOut = true;
            try { child.kill(); } catch (_) {}
        }, timeoutMs);

        const append = (bucket, chunk) => {
            const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk || '').toString('utf8');
            if (bucket === 'stdout') stdout = (stdout + text).slice(-maxOutputBytes);
            else stderr = (stderr + text).slice(-maxOutputBytes);
        };

        child.stdout?.on('data', (chunk) => append('stdout', chunk));
        child.stderr?.on('data', (chunk) => append('stderr', chunk));

        child.on('error', (error) => {
            clearTimeout(timer);
            finish({
                ok: false,
                exitCode: null,
                stdout,
                stderr,
                error: error?.message || String(error),
                timedOut,
                gitNotFound: error?.code === 'ENOENT'
            });
        });

        child.on('close', (code) => {
            clearTimeout(timer);
            finish({
                ok: Number(code) === 0 && !timedOut,
                exitCode: Number.isFinite(Number(code)) ? Number(code) : null,
                stdout,
                stderr,
                error: '',
                timedOut,
                gitNotFound: false
            });
        });
    });
}

function parseCoderGitPorcelainStatus(stdout = '') {
    const lines = String(stdout || '').replace(/\r/g, '').split('\n').filter((line) => line.length > 0);
    const result = {
        branch: '',
        upstream: '',
        ahead: 0,
        behind: 0,
        hasCommits: true,
        detached: false,
        changes: [],
        counts: {
            total: 0,
            staged: 0,
            unstaged: 0,
            untracked: 0,
            conflicted: 0
        }
    };

    let startIndex = 0;
    if (lines[0] && lines[0].startsWith('## ')) {
        const header = lines[0].slice(3).trim();
        startIndex = 1;
        if (/^No commits yet on /i.test(header)) {
            result.hasCommits = false;
            result.branch = header.replace(/^No commits yet on /i, '').trim();
        } else if (/^HEAD \(no branch\)/i.test(header)) {
            result.detached = true;
        } else {
            const statusMatch = header.match(/^(.*?)(?: \[(.+)\])?$/);
            const headPart = statusMatch ? String(statusMatch[1] || '').trim() : header;
            const bracketInfo = statusMatch ? String(statusMatch[2] || '').trim() : '';
            const [branchPart, upstreamPart] = headPart.split('...');
            result.branch = String(branchPart || '').trim();
            result.upstream = String(upstreamPart || '').trim();
            if (bracketInfo) {
                const aheadMatch = bracketInfo.match(/ahead\s+(\d+)/i);
                const behindMatch = bracketInfo.match(/behind\s+(\d+)/i);
                result.ahead = aheadMatch ? Number(aheadMatch[1]) || 0 : 0;
                result.behind = behindMatch ? Number(behindMatch[1]) || 0 : 0;
            }
        }
    }

    for (let i = startIndex; i < lines.length; i += 1) {
        const line = lines[i];
        const code = line.slice(0, 2);
        let filePath = line.length > 3 ? line.slice(3).trim() : '';
        if (filePath.startsWith('"') && filePath.endsWith('"')) filePath = filePath.slice(1, -1);
        const x = code[0] || ' ';
        const y = code[1] || ' ';
        const conflicted = code.includes('U') || code === 'AA' || code === 'DD';
        const untracked = code === '??';
        const staged = !untracked && x !== ' ';
        const unstaged = untracked || y !== ' ';
        if (staged) result.counts.staged += 1;
        if (unstaged && !untracked) result.counts.unstaged += 1;
        if (untracked) result.counts.untracked += 1;
        if (conflicted) result.counts.conflicted += 1;
        result.changes.push({
            code,
            path: String(filePath.includes(' -> ') ? filePath.split(' -> ').pop() : filePath).trim()
        });
    }

    result.counts.total = result.changes.length;
    return result;
}

function formatCoderGitError(result = {}, fallback = 'Git command failed') {
    if (result.gitNotFound) return 'Git is not installed or not available in PATH';
    if (result.timedOut) return 'Git command timed out';
    return trimCoderGitText(result.stderr || result.stdout || result.error || fallback);
}

function getCoderGitRepoPathFromPayload(event, payload = {}, label = 'repoPath') {
    ensureCoderSenderWindow(event);
    return assertCoderPathAllowed(event, payload?.repoPath, label);
}

async function getCoderGitStatusSnapshot(event, payload = {}) {
    const repoPath = getCoderGitRepoPathFromPayload(event, payload, 'repoPath');
    const detect = await runCoderGit(['--version'], { timeoutMs: 5000, maxOutputBytes: 4096 });
    if (!detect.ok) {
        return {
            success: true,
            repoPath,
            gitInstalled: false,
            gitVersion: '',
            isRepo: false,
            error: formatCoderGitError(detect, 'Unable to detect Git')
        };
    }

    const gitVersion = trimCoderGitText(detect.stdout || detect.stderr || '');
    const probe = await runCoderGit(['rev-parse', '--is-inside-work-tree'], { cwd: repoPath, timeoutMs: 5000, maxOutputBytes: 4096 });
    if (!probe.ok || trimCoderGitText(probe.stdout) !== 'true') {
        return {
            success: true,
            repoPath,
            gitInstalled: true,
            gitVersion,
            isRepo: false,
            error: ''
        };
    }

    const [rootRes, branchRes, remoteRes, userNameRes, userEmailRes, statusRes] = await Promise.all([
        runCoderGit(['rev-parse', '--show-toplevel'], { cwd: repoPath, timeoutMs: 5000, maxOutputBytes: 8192 }),
        runCoderGit(['branch', '--show-current'], { cwd: repoPath, timeoutMs: 5000, maxOutputBytes: 4096 }),
        runCoderGit(['remote', 'get-url', 'origin'], { cwd: repoPath, timeoutMs: 5000, maxOutputBytes: 8192 }),
        runCoderGit(['config', '--get', 'user.name'], { cwd: repoPath, timeoutMs: 5000, maxOutputBytes: 4096 }),
        runCoderGit(['config', '--get', 'user.email'], { cwd: repoPath, timeoutMs: 5000, maxOutputBytes: 4096 }),
        runCoderGit(['status', '--porcelain=v1', '--branch'], { cwd: repoPath, timeoutMs: 10000, maxOutputBytes: 512 * 1024 })
    ]);

    const parsed = parseCoderGitPorcelainStatus(statusRes.stdout || '');
    return {
        success: true,
        repoPath,
        repoRoot: trimCoderGitText(rootRes.stdout || '') || repoPath,
        gitInstalled: true,
        gitVersion,
        isRepo: true,
        branch: trimCoderGitText(branchRes.stdout || '') || parsed.branch || '',
        upstream: String(parsed.upstream || ''),
        ahead: Number(parsed.ahead) || 0,
        behind: Number(parsed.behind) || 0,
        detached: parsed.detached === true,
        hasCommits: parsed.hasCommits !== false,
        clean: Number(parsed.counts?.total) === 0,
        counts: parsed.counts,
        changes: Array.isArray(parsed.changes) ? parsed.changes.slice(0, 200) : [],
        remoteUrl: remoteRes.ok ? trimCoderGitText(remoteRes.stdout || '') : '',
        userName: userNameRes.ok ? trimCoderGitText(userNameRes.stdout || '') : '',
        userEmail: userEmailRes.ok ? trimCoderGitText(userEmailRes.stdout || '') : '',
        error: statusRes.ok ? '' : formatCoderGitError(statusRes, 'git status failed')
    };
}

async function runCoderGitMutation(event, payload = {}, commandRunner) {
    const repoPath = getCoderGitRepoPathFromPayload(event, payload, 'repoPath');
    const output = await commandRunner(repoPath);
    const status = await getCoderGitStatusSnapshot(event, { repoPath }).catch((error) => ({
        success: false,
        repoPath,
        gitInstalled: false,
        isRepo: false,
        error: error?.message || String(error)
    }));
    return {
        success: output.ok === true,
        repoPath,
        error: output.ok ? '' : formatCoderGitError(output),
        output: summarizeCoderGitRun(output),
        status
    };
}

ipcMain.handle('coder:dialog-select-file', async (event, filters) => {
    try {
        const owner = ensureCoderSenderWindow(event);
        const result = await dialog.showOpenDialog(owner, {
            properties: ['openFile'],
            filters: filters || [{ name: 'All Files', extensions: ['*'] }]
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        const filePath = path.resolve(result.filePaths[0]);
        registerCoderWorkspaceScope(event, filePath, { kind: 'file', label: 'filePath' });
        return filePath;
    } catch (e) {
        console.warn('[Coder][FS] select-file failed:', e?.message || e);
        return null;
    }
});

ipcMain.handle('coder:dialog-select-folder', async (event) => {
    try {
        const owner = ensureCoderSenderWindow(event);
        const result = await dialog.showOpenDialog(owner, {
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        const dirPath = path.resolve(result.filePaths[0]);
        registerCoderWorkspaceScope(event, dirPath, { kind: 'dir', label: 'dirPath' });
        return dirPath;
    } catch (e) {
        console.warn('[Coder][FS] select-folder failed:', e?.message || e);
        return null;
    }
});

ipcMain.handle('coder:workspace-allow-path', async (event, payload) => {
    try {
        ensureCoderSenderWindow(event);
        const targetPath = payload?.path;
        const kind = payload?.kind === 'file' ? 'file' : 'dir';
        const scopeRoot = registerCoderWorkspaceScope(event, targetPath, { kind, label: 'path' });
        return { success: true, scopeRoot };
    } catch (e) {
        console.warn('[Coder][FS] allow-path failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:fs-read-file', async (event, filePath) => {
    try {
        const abs = assertCoderPathAllowed(event, filePath, 'filePath');
        return await fs.promises.readFile(abs, 'utf8');
    } catch (e) {
        console.warn('[Coder][FS] read-file blocked/failed:', e?.message || e);
        return null;
    }
});

ipcMain.handle('coder:fs-read-dir', async (event, dirPath) => {
    try {
        const abs = assertCoderPathAllowed(event, dirPath, 'dirPath');
        return await fs.promises.readdir(abs);
    } catch (e) {
        console.warn('[Coder][FS] read-dir blocked/failed:', e?.message || e);
        return [];
    }
});

ipcMain.handle('coder:fs-stat-path', async (event, targetPath) => {
    try {
        const abs = assertCoderPathAllowed(event, targetPath, 'targetPath');
        const stat = await fs.promises.stat(abs);
        return {
            exists: true,
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory(),
            size: stat.size,
            mtimeMs: stat.mtimeMs
        };
    } catch (_) {
        return { exists: false, isFile: false, isDirectory: false, size: 0, mtimeMs: 0 };
    }
});

ipcMain.handle('coder:fs-write-file', async (event, payload) => {
    try {
        const filePath = payload?.path;
        const content = payload?.content ?? '';
        const abs = assertCoderPathAllowed(event, filePath, 'filePath');
        await fs.promises.writeFile(abs, String(content));
        return true;
    } catch (e) {
        console.warn('[Coder][FS] write-file blocked/failed:', e?.message || e);
        return false;
    }
});

ipcMain.handle('coder:fs-create-folder', async (event, dirPath) => {
    try {
        const abs = assertCoderPathAllowed(event, dirPath, 'dirPath');
        await fs.promises.mkdir(abs, { recursive: true });
        return true;
    } catch (e) {
        console.warn('[Coder][FS] create-folder blocked/failed:', e?.message || e);
        return false;
    }
});

ipcMain.handle('coder:fs-delete-path', async (event, targetPath) => {
    try {
        const abs = assertCoderPathAllowed(event, targetPath, 'targetPath');
        const stat = await fs.promises.stat(abs);
        if (stat.isDirectory()) await fs.promises.rm(abs, { recursive: true });
        else await fs.promises.unlink(abs);
        return true;
    } catch (e) {
        console.warn('[Coder][FS] delete-path blocked/failed:', e?.message || e);
        return false;
    }
});

ipcMain.handle('coder:fs-rename-path', async (event, payload) => {
    try {
        const oldAbs = normalizeRequiredFsPath(payload?.oldPath, 'oldPath');
        const newAbs = normalizeRequiredFsPath(payload?.newPath, 'newPath');
        if (!canRenameCoderPathTo(event, oldAbs, newAbs)) {
            throw new Error('Rename target is outside the approved Coder workspace');
        }
        await fs.promises.rename(oldAbs, newAbs);
        rewriteCoderScopesAfterRename(event, oldAbs, newAbs);
        return true;
    } catch (e) {
        console.warn('[Coder][FS] rename-path blocked/failed:', e?.message || e);
        return false;
    }
});

ipcMain.handle('coder:git-detect', async (event) => {
    try {
        ensureCoderSenderWindow(event);
        const res = await runCoderGit(['--version'], { timeoutMs: 5000, maxOutputBytes: 4096 });
        return {
            success: true,
            installed: res.ok === true,
            version: res.ok ? trimCoderGitText(res.stdout || res.stderr || '') : '',
            error: res.ok ? '' : formatCoderGitError(res, 'Unable to detect Git')
        };
    } catch (e) {
        console.warn('[Coder][Git] detect failed:', e?.message || e);
        return { success: false, installed: false, version: '', error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:git-status', async (event, payload) => {
    try {
        return await getCoderGitStatusSnapshot(event, payload || {});
    } catch (e) {
        console.warn('[Coder][Git] status failed:', e?.message || e);
        return { success: false, gitInstalled: false, isRepo: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:git-init', async (event, payload) => {
    try {
        const branch = String(payload?.branch || '').trim();
        return await runCoderGitMutation(event, payload || {}, async (repoPath) => {
            const initRes = await runCoderGit(['init'], { cwd: repoPath, timeoutMs: 15000, maxOutputBytes: 64 * 1024 });
            if (!initRes.ok) return initRes;
            if (!branch) return initRes;
            const renameRes = await runCoderGit(['branch', '-M', branch], { cwd: repoPath, timeoutMs: 10000, maxOutputBytes: 64 * 1024 });
            if (!renameRes.ok) {
                return {
                    ok: true,
                    exitCode: 0,
                    stdout: `${initRes.stdout || ''}\n${renameRes.stdout || ''}`.trim(),
                    stderr: `${initRes.stderr || ''}\n${renameRes.stderr || ''}`.trim(),
                    error: '',
                    timedOut: false,
                    gitNotFound: false
                };
            }
            return {
                ok: true,
                exitCode: 0,
                stdout: `${initRes.stdout || ''}\n${renameRes.stdout || ''}`.trim(),
                stderr: `${initRes.stderr || ''}\n${renameRes.stderr || ''}`.trim(),
                error: '',
                timedOut: false,
                gitNotFound: false
            };
        });
    } catch (e) {
        console.warn('[Coder][Git] init failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:git-save-config', async (event, payload) => {
    try {
        return await runCoderGitMutation(event, payload || {}, async (repoPath) => {
            const userName = String(payload?.userName || '').trim();
            const userEmail = String(payload?.userEmail || '').trim();
            const remoteUrl = String(payload?.remoteUrl || '').trim();
            const branch = String(payload?.branch || '').trim();
            const outputs = [];

            if (userName) {
                const res = await runCoderGit(['config', 'user.name', userName], { cwd: repoPath, timeoutMs: 10000, maxOutputBytes: 16 * 1024 });
                outputs.push(res);
                if (!res.ok) return res;
            }
            if (userEmail) {
                const res = await runCoderGit(['config', 'user.email', userEmail], { cwd: repoPath, timeoutMs: 10000, maxOutputBytes: 16 * 1024 });
                outputs.push(res);
                if (!res.ok) return res;
            }
            if (remoteUrl) {
                const existingOrigin = await runCoderGit(['remote', 'get-url', 'origin'], { cwd: repoPath, timeoutMs: 8000, maxOutputBytes: 16 * 1024 });
                const cmd = existingOrigin.ok
                    ? ['remote', 'set-url', 'origin', remoteUrl]
                    : ['remote', 'add', 'origin', remoteUrl];
                const res = await runCoderGit(cmd, { cwd: repoPath, timeoutMs: 12000, maxOutputBytes: 32 * 1024 });
                outputs.push(existingOrigin);
                outputs.push(res);
                if (!res.ok) return res;
            }
            if (branch) {
                const res = await runCoderGit(['branch', '-M', branch], { cwd: repoPath, timeoutMs: 10000, maxOutputBytes: 32 * 1024 });
                outputs.push(res);
            }

            if (!outputs.length) {
                return { ok: true, exitCode: 0, stdout: 'No Git config changes applied', stderr: '', error: '', timedOut: false, gitNotFound: false };
            }
            return {
                ok: true,
                exitCode: 0,
                stdout: outputs.map((x) => x.stdout || '').filter(Boolean).join('\n'),
                stderr: outputs.map((x) => x.stderr || '').filter(Boolean).join('\n'),
                error: '',
                timedOut: false,
                gitNotFound: false
            };
        });
    } catch (e) {
        console.warn('[Coder][Git] save-config failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:git-stage-all', async (event, payload) => {
    try {
        return await runCoderGitMutation(event, payload || {}, (repoPath) =>
            runCoderGit(['add', '-A'], { cwd: repoPath, timeoutMs: 20000, maxOutputBytes: 64 * 1024 })
        );
    } catch (e) {
        console.warn('[Coder][Git] stage-all failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:git-commit', async (event, payload) => {
    try {
        const message = String(payload?.message || '').trim();
        if (!message) return { success: false, error: 'Commit message is required' };
        return await runCoderGitMutation(event, payload || {}, (repoPath) =>
            runCoderGit(['commit', '-m', message], { cwd: repoPath, timeoutMs: 45000, maxOutputBytes: 256 * 1024 })
        );
    } catch (e) {
        console.warn('[Coder][Git] commit failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:git-pull', async (event, payload) => {
    try {
        return await runCoderGitMutation(event, payload || {}, (repoPath) => {
            const remote = String(payload?.remote || 'origin').trim();
            const branch = String(payload?.branch || '').trim();
            const args = ['pull'];
            if (payload?.rebase === true) args.push('--rebase');
            if (remote && branch) args.push(remote, branch);
            return runCoderGit(args, { cwd: repoPath, timeoutMs: 120000, maxOutputBytes: 512 * 1024 });
        });
    } catch (e) {
        console.warn('[Coder][Git] pull failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:git-push', async (event, payload) => {
    try {
        return await runCoderGitMutation(event, payload || {}, (repoPath) => {
            const remote = String(payload?.remote || 'origin').trim() || 'origin';
            const branch = String(payload?.branch || '').trim();
            const setUpstream = payload?.setUpstream !== false;
            const args = ['push'];
            if (setUpstream && branch) args.push('-u', remote, branch);
            else if (remote && branch) args.push(remote, branch);
            return runCoderGit(args, { cwd: repoPath, timeoutMs: 120000, maxOutputBytes: 512 * 1024 });
        });
    } catch (e) {
        console.warn('[Coder][Git] push failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-list', async (event) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const manager = getCoderExtensionManager();
        return await manager.listExtensions({ windowId: senderWin.webContents.id });
    } catch (e) {
        console.warn('[Coder][Extensions] list failed:', e?.message || e);
        return [];
    }
});

ipcMain.handle('coder:extensions-list-commands', async (event) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const manager = getCoderExtensionManager();
        return await manager.listCommands({ windowId: senderWin.webContents.id });
    } catch (e) {
        console.warn('[Coder][Extensions] list-commands failed:', e?.message || e);
        return [];
    }
});

ipcMain.handle('coder:extensions-install-vsix', async (event, payload) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const vsixPath = path.resolve(String(payload?.vsixPath || payload?.path || '').trim());
        if (!vsixPath) return { success: false, error: 'VSIX path is required' };
        registerCoderWorkspaceScope(event, vsixPath, { kind: 'file', label: 'vsixPath' });
        const manager = getCoderExtensionManager();
        return await manager.installVsix({ windowId: senderWin.webContents.id, vsixPath });
    } catch (e) {
        console.warn('[Coder][Extensions] install-vsix failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-select-install-vsix', async (event) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const owner = senderWin;
        const result = await dialog.showOpenDialog(owner, {
            properties: ['openFile'],
            filters: [{ name: 'VSIX Extensions', extensions: ['vsix'] }, { name: 'All Files', extensions: ['*'] }]
        });
        if (result.canceled || !result.filePaths?.length) return { canceled: true, success: false };
        const vsixPath = path.resolve(result.filePaths[0]);
        registerCoderWorkspaceScope(event, vsixPath, { kind: 'file', label: 'vsixPath' });
        const manager = getCoderExtensionManager();
        return await manager.installVsix({ windowId: senderWin.webContents.id, vsixPath });
    } catch (e) {
        console.warn('[Coder][Extensions] select-install-vsix failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-set-enabled', async (event, payload) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const extensionId = String(payload?.extensionId || payload?.id || '').trim();
        if (!extensionId) return { success: false, error: 'extensionId is required' };
        const enabled = payload?.enabled !== false;
        const manager = getCoderExtensionManager();
        return await manager.setExtensionEnabled({ windowId: senderWin.webContents.id, extensionId, enabled });
    } catch (e) {
        console.warn('[Coder][Extensions] set-enabled failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-uninstall', async (event, payload) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const extensionId = String(payload?.extensionId || payload?.id || '').trim();
        if (!extensionId) return { success: false, error: 'extensionId is required' };
        const manager = getCoderExtensionManager();
        return await manager.uninstallExtension({ windowId: senderWin.webContents.id, extensionId });
    } catch (e) {
        console.warn('[Coder][Extensions] uninstall failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-execute-command', async (event, payload) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const commandId = String(payload?.commandId || '').trim();
        const args = Array.isArray(payload?.args) ? payload.args : [];
        if (!commandId) return { success: false, error: 'commandId is required' };
        const manager = getCoderExtensionManager();
        const result = await manager.executeCommand({
            windowId: senderWin.webContents.id,
            commandId,
            args,
            source: 'renderer'
        });
        return { success: true, result };
    } catch (e) {
        console.warn('[Coder][Extensions] execute-command failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-notify-editor-event', async (event, payload) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const eventName = String(payload?.event || payload?.eventName || '').trim();
        if (!eventName) return { success: false, error: 'event is required' };
        const manager = getCoderExtensionManager();
        return await manager.notifyEditorEvent({
            windowId: senderWin.webContents.id,
            event: eventName,
            payload: payload?.payload || {}
        });
    } catch (e) {
        console.warn('[Coder][Extensions] notify-editor-event failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-webview-post-message', async (event, payload) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const panelId = String(payload?.panelId || '').trim();
        if (!panelId) return { success: false, error: 'panelId is required' };
        const manager = getCoderExtensionManager();
        const result = await manager.handleWebviewRendererMessage({
            windowId: senderWin.webContents.id,
            panelId,
            message: payload?.message ?? null
        });
        return { success: true, ...(result || {}) };
    } catch (e) {
        console.warn('[Coder][Extensions] webview-post-message failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-webview-user-close', async (event, payload) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const panelId = String(payload?.panelId || '').trim();
        if (!panelId) return { success: false, error: 'panelId is required' };
        const manager = getCoderExtensionManager();
        const result = await manager.handleWebviewRendererClosed({
            windowId: senderWin.webContents.id,
            panelId
        });
        return { success: true, ...(result || {}) };
    } catch (e) {
        console.warn('[Coder][Extensions] webview-user-close failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-marketplace-search', async (event, payload) => {
    try {
        ensureCoderSenderWindow(event);
        return await fetchCoderMarketplaceSearchResults(String(payload?.query || ''), payload?.options || {});
    } catch (e) {
        console.warn('[Coder][Extensions] marketplace-search failed:', e?.message || e);
        return { query: String(payload?.query || ''), total: 0, items: [], error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-marketplace-details', async (event, payload) => {
    try {
        ensureCoderSenderWindow(event);
        const detail = await fetchCoderMarketplaceExtensionDetails(payload || {});
        return { success: true, ...detail };
    } catch (e) {
        console.warn('[Coder][Extensions] marketplace-details failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('coder:extensions-marketplace-install', async (event, payload) => {
    try {
        const senderWin = ensureCoderSenderWindow(event);
        const manager = getCoderExtensionManager();
        return await installCoderMarketplaceExtension(manager, payload || {}, senderWin.webContents.id);
    } catch (e) {
        console.warn('[Coder][Extensions] marketplace-install failed:', e?.message || e);
        return { success: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('history-get', () => getStoredHistory());
ipcMain.handle('history-push', async (e, item) => {
    if (!cachedSettings.features.enableHistory) return;
    const h = getStoredHistory(); const filtered = h.filter(x => x.url !== item.url); filtered.unshift(item); 
    await safeWriteJson(historyPath, filtered.slice(0, 500));
});
ipcMain.handle('history-delete', async (e, timestamp) => { const h = getStoredHistory(); const filtered = h.filter(x => x.timestamp !== timestamp); return await safeWriteJson(historyPath, filtered); });
ipcMain.handle('history-clear', async () => { return await safeWriteJson(historyPath, []); });

ipcMain.handle('bookmarks-get', () => getStoredBookmarks());
ipcMain.handle('bookmarks-add', async (e, b) => { const list = getStoredBookmarks(); list.push({...b, id: Date.now().toString()}); return await safeWriteJson(bookmarksPath, list); });
ipcMain.handle('bookmarks-delete', async (e, id) => { const list = getStoredBookmarks(); const filtered = list.filter(b => b.id !== id); return await safeWriteJson(bookmarksPath, filtered); });

ipcMain.handle('extensions:list', async () => {
    try {
        const extMap = session.defaultSession.getAllExtensions() || new Map();
        return Array.from(extMap.values()).map(e => ({ id: e.id, name: e.name, version: e.version, path: e.path }));
    } catch (e) { return []; }
});

ipcMain.handle('extensions:load-unpacked', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'No folder selected' };
    const dir = result.filePaths[0];
    return await ensureExtensionLoaded(dir);
});

ipcMain.handle('extensions:uninstall', async (e, id) => {
    try { session.defaultSession.removeExtension(id); return true; } catch (err) { return false; }
});

ipcMain.handle('extensions:create-template', async () => {
    try {
        const stamp = Date.now();
        const dir = path.join(extensionsRoot, `template-${stamp}`);
        await fs.promises.mkdir(dir, { recursive: true });
        const manifest = {
            manifest_version: 3,
            name: "Om-X Starter Extension",
            version: "1.0.0",
            description: "Edit this manifest and reload via Load Unpacked.",
            action: { default_popup: "popup.html", default_title: "Hello Om-X" }
        };
        await fs.promises.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
        await fs.promises.writeFile(path.join(dir, 'popup.html'), "<!doctype html><html><body><h3>Starter Extension</h3><p>Edit me.</p></body></html>", 'utf8');
        return { success: true, path: dir };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('extensions:install-from-url', async (event, urlOrId) => {
    const extractId = (input) => {
        if (!input) return null;
        const idMatch = input.match(/detail\/[^/]*\/([a-p]{32})/) || input.match(/\/([a-p]{32})(?:\?|$)/);
        if (idMatch && idMatch[1]) return idMatch[1];
        if (input.length === 32) return input;
        return null;
    };
    const extId = extractId(urlOrId);
    if (!extId) return { success: false, error: 'Invalid extension URL or ID' };

    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=114.0.0.0&x=id%3D${extId}%26installsource%3Dondemand%26uc`;
    try {
        const crxBuffer = await downloadBuffer(crxUrl);
        const zipBuffer = crxToZip(crxBuffer);
        const destDir = path.join(extensionsRoot, extId);
        await extractZipToDir(zipBuffer, destDir);
        const result = await ensureExtensionLoaded(destDir);
        return result;
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('downloads-get', () => getStoredDownloads());
ipcMain.handle('downloads-start', (e, url, opt) => {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) return { success: false, error: 'Download URL is required.' };
    if (!mainWindow || mainWindow.isDestroyed()) return { success: false, error: 'Main window is not available.' };
    if (opt?.saveAs) pendingSaveAs.set(targetUrl, true);
    mainWindow.webContents.downloadURL(targetUrl);
    return { success: true };
});
ipcMain.handle('downloads-clear', async () => { return await safeWriteJson(downloadsPath, []); });
ipcMain.handle('downloads-open-file', (e, id) => {
    const item = getStoredDownloads().find(d => d.id === id);
    if (!item) return;
    const defaultDir = (cachedSettings.downloadPath && fs.existsSync(cachedSettings.downloadPath))
      ? cachedSettings.downloadPath
      : app.getPath('downloads');
    const candidates = [
        item.savePath,
        item.path,
        item.filename ? path.join(defaultDir, item.filename) : null
    ].filter(Boolean);
    const target = candidates.find(p => fs.existsSync(p)) || candidates[0];
    if (target) shell.openPath(target);
});
ipcMain.handle('downloads-show-in-folder', (e, id) => {
    const item = getStoredDownloads().find(d => d.id === id);
    if (!item) return;
    const defaultDir = (cachedSettings.downloadPath && fs.existsSync(cachedSettings.downloadPath))
      ? cachedSettings.downloadPath
      : app.getPath('downloads');
    const candidates = [
        item.savePath,
        item.path,
        item.filename ? path.join(defaultDir, item.filename) : null
    ].filter(Boolean);
    const target = candidates.find(p => fs.existsSync(p)) || candidates[0];
    if (target) shell.showItemInFolder(target);
});
ipcMain.handle('downloads-pause', (e, id) => { const it = activeDownloadItems.get(id); it?.pause(); });
ipcMain.handle('downloads-resume', (e, id) => {
    const it = activeDownloadItems.get(id);
    if (it && typeof it.resume === 'function') it.resume();
});
ipcMain.handle('downloads-cancel', (e, id) => {
    const it = activeDownloadItems.get(id);
    if (!it) return { success: false, error: 'Download not active.' };
    try {
        it.cancel();
        return { success: true };
    } catch (err) {
        return { success: false, error: err?.message || 'Cancel failed.' };
    }
});

ipcMain.on('llama-server-output', (event, data) => {
  broadcast('llama-server-output', data);
});

ipcMain.on('llama-server-exit', (event, code) => {
  broadcast('llama-server-exit', { code });
});

ipcMain.on('bedrock-server-output', (event, data) => {
  broadcast('bedrock-server-output', data);
});

ipcMain.on('bedrock-server-exit', (event, code) => {
  broadcast('bedrock-server-exit', { code });
});

ipcMain.handle('llama:start-server', async (event, config) => {
  try {
    if (llamaServerProcess) {
      return { success: false, error: 'Llama server is already running' };
    }

    const { executable, model, modelsPath, contextLength, gpuLayers, port, threads, host } = config;

    if (!fs.existsSync(executable)) {
      return { success: false, error: `Executable not found: ${executable}` };
    }

    const modelPath = path.join(modelsPath, model);
    if (!fs.existsSync(modelPath)) {
      return { success: false, error: `Model file not found: ${modelPath}` };
    }

    const serverHost = host || '127.0.0.1';

    const args = [
      '-m', modelPath,
      '--host', serverHost,
      '--port', port.toString(),
      '--ctx-size', contextLength.toString(),
      '--threads', threads.toString(),
      '-ngl', gpuLayers.toString()
    ];

    llamaServerProcess = spawn(executable, args, {
      cwd: path.dirname(executable),
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    llamaServerProcess.stdout.on('data', (data) => {
      broadcast('llama-server-output', { type: 'stdout', data: data.toString() });
    });

    llamaServerProcess.stderr.on('data', (data) => {
      broadcast('llama-server-output', { type: 'stderr', data: data.toString() });
    });

    llamaServerProcess.on('exit', (code) => {
      broadcast('llama-server-exit', { code });
      llamaServerProcess = null;
    });

    llamaServerProcess.on('error', (err) => {
      broadcast('llama-server-output', { type: 'error', data: err.message });
      llamaServerProcess = null;
    });

    return { success: true };
  } catch (error) {
    console.error('[Llama Server] Start error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llama:stop-server', async () => {
  try {
    if (!llamaServerProcess) {
      return { success: false, error: 'No llama server is running' };
    }

    llamaServerProcess.kill('SIGTERM');

    const timeout = setTimeout(() => {
      if (llamaServerProcess) {
        llamaServerProcess.kill('SIGKILL');
      }
    }, 5000);

    llamaServerProcess.on('exit', () => {
      clearTimeout(timeout);
      llamaServerProcess = null;
    });

    return { success: true };
  } catch (error) {
    console.error('[Llama Server] Stop error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llama:send-command', async (event, command) => {
  try {
    if (!llamaServerProcess) {
      return { success: false, error: 'Llama server is not running' };
    }

    llamaServerProcess.stdin.write(`${command}\n`);
    return { success: true };
  } catch (error) {
    console.error('[Llama Server] Command error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llama:check-model-size', async (event, modelsPath, modelName) => {
  try {
    const modelPath = path.join(modelsPath, modelName);
    if (!fs.existsSync(modelPath)) {
      return { success: false, error: 'Model file not found' };
    }

    const stats = fs.statSync(modelPath);
    const sizeMB = Math.round(stats.size / (1024 * 1024));

    const availableMemory = 8000;
    const maxAllowed = availableMemory * 0.95;

    return {
      success: true,
      size: sizeMB,
      availableMemory,
      maxAllowed,
      canLoad: sizeMB <= maxAllowed
    };
  } catch (error) {
    console.error('[Llama Server] Check model size error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llama:get-gpu-info', async () => {
  try {
    const gpuInfo = await app.getGPUInfo('complete');
    
    let sharedMemory = 0;
    let gpuName = 'Unknown GPU';
    
    if (gpuInfo && gpuInfo.auxAttributes) {
      sharedMemory = gpuInfo.auxAttributes.sharedMemory || 0;
      gpuName = gpuInfo.auxAttributes.glRenderer || 'Unknown GPU';
    }
    
    // Convert from bytes to MB if needed (if value seems too large, it's likely in bytes)
    if (sharedMemory > 1000000) {
      sharedMemory = Math.round(sharedMemory / (1024 * 1024));
    }
    
    // If no shared memory detected, use a reasonable default for integrated GPUs
    if (sharedMemory === 0) {
      const totalRAM = os.totalmem();
      // Integrated GPUs typically use 50% of system RAM max
      sharedMemory = Math.round(totalRAM / (1024 * 1024) * 0.5);
    }
    
    return {
      success: true,
      availableMemory: sharedMemory,
      totalMemory: sharedMemory,
      name: gpuName
    };
  } catch (error) {
    console.error('[Llama Server] Get GPU info error:', error);
    return {
      success: false,
      error: error.message,
      availableMemory: 4000,
      totalMemory: 4000,
      name: 'Unknown GPU'
    };
  }
});

// Bedrock Server IPC Handlers
ipcMain.handle('bedrock:start-server', async (event, config) => {
  try {
    if (bedrockServerProcess) {
      return { success: false, error: 'Bedrock server is already running' };
    }

    const { executable } = config;

    if (!fs.existsSync(executable)) {
      return { success: false, error: `Executable not found: ${executable}` };
    }

    const serverDir = path.dirname(executable);

    bedrockServerProcess = spawn(executable, [], {
      cwd: serverDir,
      windowsHide: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    bedrockServerProcess.stdout.on('data', (data) => {
      broadcast('bedrock-server-output', { type: 'stdout', data: data.toString() });
    });

    bedrockServerProcess.stderr.on('data', (data) => {
      broadcast('bedrock-server-output', { type: 'stderr', data: data.toString() });
    });

    bedrockServerProcess.on('exit', (code) => {
      broadcast('bedrock-server-exit', { code });
      bedrockServerProcess = null;
    });

    bedrockServerProcess.on('error', (err) => {
      broadcast('bedrock-server-output', { type: 'error', data: err.message });
      bedrockServerProcess = null;
    });

    return { success: true, pid: bedrockServerProcess.pid };
  } catch (error) {
    console.error('[Bedrock Server] Start error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bedrock:stop-server', async () => {
  try {
    if (!bedrockServerProcess) {
      return { success: false, error: 'No bedrock server is running' };
    }

    bedrockServerProcess.kill('SIGTERM');

    const timeout = setTimeout(() => {
      if (bedrockServerProcess) {
        bedrockServerProcess.kill('SIGKILL');
      }
    }, 5000);

    bedrockServerProcess.on('exit', () => {
      clearTimeout(timeout);
      bedrockServerProcess = null;
    });

    return { success: true };
  } catch (error) {
    console.error('[Bedrock Server] Stop error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bedrock:send-command', async (event, command) => {
  try {
    if (!bedrockServerProcess) {
      return { success: false, error: 'Bedrock server is not running' };
    }

    bedrockServerProcess.stdin.write(`${command}\n`);
    return { success: true };
  } catch (error) {
    console.error('[Bedrock Server] Command error:', error);
    return { success: false, error: error.message };
  }
});

// Java Server IPC Handlers
ipcMain.handle('java:start-server', async (event, config) => {
  try {
    const { serverPath, minRam, maxRam, port, javaExecutable } = config;
    
    if (javaServerProcess) {
      return { success: false, error: 'Java server is already running' };
    }

    if (!serverPath || !fs.existsSync(serverPath)) {
      return { success: false, error: 'Server folder does not exist' };
    }

    // Check for server.jar
    const serverJarPath = path.join(serverPath, 'server.jar');
    if (!fs.existsSync(serverJarPath)) {
      return { success: false, error: 'server.jar not found in server folder' };
    }

    // Generate the startup command
    const javaPath = javaExecutable || 'java';
    const command = `${javaPath} -Xmx${maxRam}G -Xms${minRam}G -jar server.jar`;
    
    // Build spawn arguments
    const args = [
      `-Xmx${maxRam}G`,
      `-Xms${minRam}G`,
      '-jar',
      'server.jar'
    ];

    // Spawn the server process
    javaServerProcess = spawn(javaPath, args, {
      cwd: serverPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle stdout
    javaServerProcess.stdout.on('data', (data) => {
      broadcast('java-server-output', { type: 'stdout', data: data.toString() });
    });

    // Handle stderr
    javaServerProcess.stderr.on('data', (data) => {
      broadcast('java-server-output', { type: 'stderr', data: data.toString() });
    });

    // Handle process exit
    javaServerProcess.on('exit', (code) => {
      broadcast('java-server-exit', { code });
      javaServerProcess = null;
    });

    // Handle process errors
    javaServerProcess.on('error', (err) => {
      broadcast('java-server-output', { type: 'error', data: err.message });
      javaServerProcess = null;
    });

    return { success: true, pid: javaServerProcess.pid };
  } catch (error) {
    console.error('[Java Server] Start error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('java:stop-server', async () => {
  try {
    if (!javaServerProcess) {
      return { success: false, error: 'No Java server is running' };
    }

    // Send stop command to server
    javaServerProcess.stdin.write('stop\n');
    
    // Give it time to shutdown gracefully
    const timeout = setTimeout(() => {
      if (javaServerProcess) {
        javaServerProcess.kill('SIGTERM');
      }
    }, 10000);

    javaServerProcess.on('exit', () => {
      clearTimeout(timeout);
      javaServerProcess = null;
    });

    return { success: true };
  } catch (error) {
    console.error('[Java Server] Stop error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('java:send-command', async (event, command) => {
  try {
    if (!javaServerProcess) {
      return { success: false, error: 'Java server is not running' };
    }

    javaServerProcess.stdin.write(`${command}\n`);
    return { success: true };
  } catch (error) {
    console.error('[Java Server] Command error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('java:get-status', async () => {
  return {
    running: javaServerProcess !== null,
    pid: javaServerProcess ? javaServerProcess.pid : null
  };
});

// AI Player IPC Handlers
ipcMain.handle('ai-player:connect', async (event, config) => {
  try {
    console.log('[AI Player] Connection request:', config);
    // Here you would initialize the Minecraft bot connection
    // For now, simulate success
    return { success: true, message: 'AI Player connected successfully' };
  } catch (error) {
    console.error('[AI Player] Connection error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-player:disconnect', async () => {
  try {
    console.log('[AI Player] Disconnecting...');
    // Disconnect the bot
    return { success: true };
  } catch (error) {
    console.error('[AI Player] Disconnect error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-player:send-command', async (event, command) => {
  try {
    console.log('[AI Player] Command received:', command);
    // Process the command through LLM and execute
    return { success: true, response: `Executing: ${command}` };
  } catch (error) {
    console.error('[AI Player] Command error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-player:check-player-online', async () => {
  try {
    // Check if player is online in Minecraft server
    // This would query the server or bot
    return { online: false, playerName: null };
  } catch (error) {
    console.error('[AI Player] Check player error:', error);
    return { online: false, error: error.message };
  }
});

ipcMain.handle('ai-player:query-llm', async (event, { provider, providerType, config, prompt }) => {
  try {
    const providerConfigs = {
      openai: {
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        authHeader: 'Authorization',
        authPrefix: 'Bearer '
      },
      anthropic: {
        baseUrl: 'https://api.anthropic.com/v1/messages',
        authHeader: 'x-api-key',
        authPrefix: ''
      },
      gemini: {
        useEndpoint: (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        authInUrl: true
      },
      groq: {
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        authHeader: 'Authorization',
        authPrefix: 'Bearer '
      },
      cohere: {
        baseUrl: 'https://api.cohere.ai/v1/chat',
        authHeader: 'Authorization',
        authPrefix: 'Bearer '
      },
      mistral: {
        baseUrl: 'https://api.mistral.ai/v1/chat/completions',
        authHeader: 'Authorization',
        authPrefix: 'Bearer '
      },
      openrouter: {
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        authHeader: 'Authorization',
        authPrefix: 'Bearer '
      },
      custom: {
        baseUrl: config.customEndpoint,
        authHeader: 'Authorization',
        authPrefix: 'Bearer '
      }
    };

    if (provider === 'local') {
      // Forward to local llama server
      const response = await fetch(`${config.serverUrl}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 500
        })
      });
      
      if (!response.ok) throw new Error('Local server request failed');
      const data = await response.json();
      return { success: true, response: data.content || data.choices[0].text };
    }

    // Cloud provider handling
    const providerConfig = providerConfigs[providerType] || providerConfigs.openai;
    let url = providerConfig.baseUrl;
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    // Handle Gemini's URL-based auth
    if (providerType === 'gemini') {
      url = providerConfig.useEndpoint(config.model, config.apiKey);
    } else {
      headers[providerConfig.authHeader] = providerConfig.authPrefix + config.apiKey;
    }

    // Build request body based on provider
    switch (providerType) {
      case 'openai':
      case 'groq':
      case 'mistral':
      case 'openrouter':
      case 'custom':
        body = {
          model: config.model,
          messages: [
            { role: 'system', content: config.systemPrompt || 'You are a helpful assistant.' },
            { role: 'user', content: prompt }
          ],
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 500
        };
        break;

      case 'anthropic':
        body = {
          model: config.model,
          system: config.systemPrompt || 'You are a helpful assistant.',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: config.maxTokens || 500,
          temperature: config.temperature || 0.7
        };
        break;

      case 'gemini':
        body = {
          contents: [{
            parts: [{
              text: `${config.systemPrompt || 'You are a helpful assistant.'}\n\nUser: ${prompt}`
            }]
          }],
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 500
          }
        };
        break;

      case 'cohere':
        body = {
          model: config.model,
          message: prompt,
          preamble: config.systemPrompt || 'You are a helpful assistant.',
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens || 500
        };
        break;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Parse response based on provider
    let responseText = '';
    switch (providerType) {
      case 'openai':
      case 'groq':
      case 'mistral':
      case 'openrouter':
      case 'custom':
        responseText = data.choices[0].message.content;
        break;
      case 'anthropic':
        responseText = data.content[0].text;
        break;
      case 'gemini':
        responseText = data.candidates[0].content.parts[0].text;
        break;
      case 'cohere':
        responseText = data.text;
        break;
      default:
        responseText = data.choices?.[0]?.message?.content || data.content?.[0]?.text || data.text || 'No response';
    }

    return { success: true, response: responseText };
  } catch (error) {
    console.error('[AI Player] LLM query error:', error);
    return { success: false, error: error.message };
  }
});

// Minecraft Bedrock Server Process Management
let minecraftServerProcess = null;
let minecraftServerLogs = [];

ipcMain.handle('minecraft-server:start', async (event, { serverPath }) => {
  try {
    if (minecraftServerProcess) {
      return { success: false, error: 'Server is already running' };
    }

    if (!fs.existsSync(serverPath)) {
      return { success: false, error: `Server executable not found: ${serverPath}` };
    }

    console.log(`[Minecraft Server] Starting server from: ${serverPath}`);
    
    // Get the directory of the server executable
    const serverDir = path.dirname(serverPath);
    
    // Spawn the bedrock server process
    minecraftServerProcess = spawn(serverPath, [], {
      cwd: serverDir,
      detached: false,
      windowsHide: false // Show console window so user can see server output
    });

    minecraftServerLogs = [];

    // Set up logging
    minecraftServerProcess.stdout.on('data', (data) => {
      const logLine = data.toString().trim();
      console.log(`[Minecraft Server] ${logLine}`);
      minecraftServerLogs.push({ type: 'stdout', message: logLine, time: Date.now() });
    });

    minecraftServerProcess.stderr.on('data', (data) => {
      const logLine = data.toString().trim();
      console.error(`[Minecraft Server Error] ${logLine}`);
      minecraftServerLogs.push({ type: 'stderr', message: logLine, time: Date.now() });
    });

    minecraftServerProcess.on('error', (error) => {
      console.error('[Minecraft Server] Process error:', error);
      minecraftServerProcess = null;
    });

    minecraftServerProcess.on('exit', (code) => {
      console.log(`[Minecraft Server] Process exited with code ${code}`);
      minecraftServerProcess = null;
    });

    // Return immediately with success - the process is started
    return { 
      success: true, 
      message: 'Server process started',
      pid: minecraftServerProcess.pid
    };

  } catch (error) {
    console.error('[Minecraft Server] Start error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('minecraft-server:stop', async () => {
  try {
    if (!minecraftServerProcess) {
      return { success: false, error: 'Server is not running' };
    }

    console.log('[Minecraft Server] Stopping server...');
    
    // Send stop command to server via stdin
    minecraftServerProcess.stdin.write('stop\n');
    
    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Force kill if still running
    if (minecraftServerProcess) {
      minecraftServerProcess.kill('SIGTERM');
      
      // Wait another 5 seconds then force kill
      setTimeout(() => {
        if (minecraftServerProcess) {
          console.log('[Minecraft Server] Force killing process...');
          minecraftServerProcess.kill('SIGKILL');
          minecraftServerProcess = null;
        }
      }, 5000);
    }

    return { success: true, message: 'Server stopped' };
  } catch (error) {
    console.error('[Minecraft Server] Stop error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('minecraft-server:status', () => {
  return {
    running: !!minecraftServerProcess,
    pid: minecraftServerProcess?.pid || null,
    logs: minecraftServerLogs.slice(-50) // Return last 50 log entries
  };
});

ipcMain.handle('minecraft-server:send-command', async (event, command) => {
  try {
    if (!minecraftServerProcess) {
      return { success: false, error: 'Server is not running' };
    }

    minecraftServerProcess.stdin.write(`${command}\n`);
    return { success: true };
  } catch (error) {
    console.error('[Minecraft Server] Command error:', error);
    return { success: false, error: error.message };
  }
});

// Monitor server process
setInterval(() => {
  if (minecraftServerProcess) {
    // Send status to renderer periodically
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('minecraft-server-status', {
        running: true,
        pid: minecraftServerProcess.pid
      });
    }
  }
}, 5000);

// Pocket TTS Server IPC Handlers
let pocketTTsProcess = null;
let pocketTTSStartTime = null;

ipcMain.handle('pocket-tts:start-server', async (event, config) => {
  try {
    if (pocketTTsProcess) {
      return { success: false, error: 'Pocket TTS server is already running' };
    }

    const executable = config?.executable;
    
    if (!executable) {
      return { success: false, error: 'No executable path provided' };
    }

    if (!fs.existsSync(executable)) {
      return { success: false, error: `Executable not found: ${executable}` };
    }

    broadcast('pocket-tts-output', { type: 'info', data: `[System] Starting Pocket TTS server: ${executable}` });
    broadcast('pocket-tts-output', { type: 'info', data: `[System] Working directory: ${path.dirname(executable)}` });

    // Check if user selected the service wrapper instead of main executable
    const isServiceWrapper = path.basename(executable).toLowerCase().includes('service');
    if (isServiceWrapper) {
      broadcast('pocket-tts-output', { type: 'warning', data: '[System] Warning: You selected the service wrapper. If it fails, try selecting pocket-tts.exe directly.' });
    }

    // Spawn the executable
    const spawnOptions = {
      cwd: path.dirname(executable),
      windowsHide: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    };
    
    pocketTTsProcess = spawn(executable, [], spawnOptions);
    
    pocketTTsProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Pocket TTS stdout]:', output);
      broadcast('pocket-tts-output', { type: 'stdout', data: output });
    });

    pocketTTsProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('[Pocket TTS stderr]:', output);
      broadcast('pocket-tts-output', { type: 'stderr', data: output });
    });

    pocketTTsProcess.on('exit', (code, signal) => {
      console.log(`[Pocket TTS] Process exited with code ${code}, signal ${signal}`);
      broadcast('pocket-tts-exit', { code, signal });
      broadcast('pocket-tts-output', { type: 'info', data: `[System] Server exited with code ${code}${signal ? ` (signal: ${signal})` : ''}` });
      pocketTTsProcess = null;
      pocketTTSStartTime = null;
    });

    pocketTTsProcess.on('error', (err) => {
      console.error('[Pocket TTS] Process error:', err);
      broadcast('pocket-tts-output', { type: 'error', data: `Process error: ${err.message}` });
      pocketTTsProcess = null;
    });

    // Log process info
    console.log('[Pocket TTS] Spawned process with PID:', pocketTTsProcess.pid);

    pocketTTSStartTime = Date.now();
    broadcast('pocket-tts-output', { type: 'success', data: '[System] Pocket TTS server process started' });

    return { success: true, message: 'Server process started' };
  } catch (error) {
    console.error('[Pocket TTS] Start error:', error);
    broadcast('pocket-tts-output', { type: 'error', data: `[System] Error: ${error.message}` });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pocket-tts:stop-server', async () => {
  try {
    if (!pocketTTsProcess) {
      return { success: false, error: 'No Pocket TTS server is running' };
    }

    broadcast('pocket-tts-output', { type: 'info', data: '[System] Stopping Pocket TTS server...' });

    pocketTTsProcess.kill('SIGTERM');

    const timeout = setTimeout(() => {
      if (pocketTTsProcess) {
        pocketTTsProcess.kill('SIGKILL');
        broadcast('pocket-tts-output', { type: 'warning', data: '[System] Force killed server' });
      }
    }, 5000);

    pocketTTsProcess.on('exit', () => {
      clearTimeout(timeout);
      pocketTTsProcess = null;
      pocketTTSStartTime = null;
    });

    return { success: true };
  } catch (error) {
    console.error('[Pocket TTS] Stop error:', error);
    return { success: false, error: error.message };
  }
});

function buildCoderTerminalSpawnEnv(extraEnv = null) {
  const env = {
    ...process.env,
    ...(extraEnv && typeof extraEnv === 'object' ? extraEnv : {})
  };
  if (process.platform !== 'win32') return env;

  const pathKey = Object.keys(env).find((k) => /^path$/i.test(String(k || ''))) || 'Path';
  const seen = new Set();
  const parts = [];
  const addPart = (value) => {
    const text = String(value || '').trim().replace(/^"+|"+$/g, '');
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(text);
  };

  String(env[pathKey] || env.PATH || env.Path || '')
    .split(path.delimiter)
    .forEach(addPart);

  try {
    const compilerDirs = Array.isArray(getCompilerSearchDirectories?.()) ? getCompilerSearchDirectories() : [];
    for (const dir of compilerDirs) addPart(dir);
  } catch (_) {}

  const mergedPath = parts.join(path.delimiter);
  env[pathKey] = mergedPath;
  env.PATH = mergedPath;
  env.Path = mergedPath;
  return env;
}

function runCoderProcessCapture(command, args = [], options = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let outputTruncated = false;
    const maxOutputBytes = Math.max(4096, Number(options.maxOutputBytes) || (512 * 1024));
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 15000);
    let totalBytes = 0;
    let child = null;
    let timeout = null;

    const finish = (partial = {}) => {
      if (settled) return;
      settled = true;
      try { if (timeout) clearTimeout(timeout); } catch (_) {}
      resolve({
        ok: false,
        code: null,
        signal: null,
        stdout,
        stderr,
        timedOut,
        outputTruncated,
        ...partial
      });
    };

    const append = (kind, chunk) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
      if (!text) return;
      totalBytes += Buffer.byteLength(text, 'utf8');
      if (kind === 'stdout') stdout += text;
      else stderr += text;
      if (totalBytes > maxOutputBytes && child && !child.killed) {
        outputTruncated = true;
        try { child.kill(); } catch (_) {}
      }
    };

    try {
      child = spawn(String(command || ''), Array.isArray(args) ? args.map((v) => String(v)) : [], {
        cwd: options.cwd ? path.resolve(String(options.cwd)) : undefined,
        env: buildCoderTerminalSpawnEnv(options.env),
        windowsHide: true,
        shell: false
      });
    } catch (error) {
      finish({
        error: error?.message || String(error),
        spawnErrorCode: error?.code || ''
      });
      return;
    }

    timeout = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch (_) {}
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => append('stdout', chunk));
    child.stderr?.on('data', (chunk) => append('stderr', chunk));

    child.on('error', (error) => {
      finish({
        error: error?.message || String(error),
        spawnErrorCode: error?.code || ''
      });
    });

    child.on('close', (code, signal) => {
      finish({
        ok: Number(code) === 0 && !timedOut && !outputTruncated,
        code: Number.isFinite(Number(code)) ? Number(code) : null,
        signal: signal || null,
        error: timedOut ? 'Process timed out' : (outputTruncated ? 'Process output exceeded limit' : '')
      });
    });
  });
}

function splitCoderTerminalSimpleCommandLineArgs(text) {
  const src = String(text || '');
  if (!src.trim()) return [];
  const out = [];
  let buf = '';
  let quote = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src.charAt(i);
    if (quote) {
      if (ch === '\\' && quote === '"' && i + 1 < src.length) {
        const next = src.charAt(i + 1);
        if (next === '"' || next === '\\') {
          buf += next;
          i += 1;
          continue;
        }
      }
      if (ch === quote) {
        quote = '';
        continue;
      }
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (buf) {
        out.push(buf);
        buf = '';
        if (out.length >= 64) break;
      }
      continue;
    }
    buf += ch;
  }
  if (quote) return null;
  if (buf && out.length < 64) out.push(buf);
  return out;
}

function isCoderTerminalPathLikeCommand(commandToken) {
  const token = String(commandToken || '').trim();
  if (!token) return false;
  return /^[.]{1,2}[\\/]/.test(token) || /^[A-Za-z]:/.test(token) || /[\\/]/.test(token);
}

function makeCoderTerminalSessionId() {
  coderTerminalSessionSeq += 1;
  return `coder-term-${Date.now().toString(36)}-${coderTerminalSessionSeq.toString(36)}`;
}

function emitCoderTerminalSessionEvent(sessionState, payload = {}) {
  try {
    const wc = webContents.fromId(Number(sessionState?.ownerWebContentsId) || 0);
    if (!wc || wc.isDestroyed()) return false;
    wc.send('coder:terminal-event', {
      sessionId: String(sessionState?.id || ''),
      ...(payload && typeof payload === 'object' ? payload : {})
    });
    return true;
  } catch (_) {
    return false;
  }
}

function cleanupCoderTerminalSession(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return;
  const sessionState = coderTerminalSessions.get(id);
  if (!sessionState) return;
  coderTerminalSessions.delete(id);
  try { if (sessionState.timeout) clearTimeout(sessionState.timeout); } catch (_) {}
}

function getCoderTerminalSessionForSender(event, sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) throw new Error('Session id is required');
  const sessionState = coderTerminalSessions.get(id);
  if (!sessionState) throw new Error('Terminal session not found');
  const senderId = Number(event?.sender?.id) || 0;
  if (!senderId || senderId !== Number(sessionState.ownerWebContentsId || 0)) {
    throw new Error('Unauthorized terminal session access');
  }
  return sessionState;
}

function killCoderTerminalSessionsForWebContentsId(webContentsId) {
  const ownerId = Number(webContentsId) || 0;
  if (!ownerId) return;
  for (const [id, sessionState] of coderTerminalSessions.entries()) {
    if (Number(sessionState?.ownerWebContentsId || 0) !== ownerId) continue;
    try { sessionState.stoppedByUser = true; } catch (_) {}
    try { sessionState.child?.kill?.(); } catch (_) {}
    cleanupCoderTerminalSession(id);
  }
}

function spawnCoderTerminalSessionProcess(commandText, options = {}) {
  const command = String(commandText || '').trim();
  if (!command) throw new Error('Command is empty');
  const hasShellControlSyntax = /(?:\|\||&&|[|;<>])/.test(command);
  const parsed = hasShellControlSyntax ? null : splitCoderTerminalSimpleCommandLineArgs(command);
  const spawnOptions = {
    cwd: options.cwd ? path.resolve(String(options.cwd)) : undefined,
    env: buildCoderTerminalSpawnEnv(options.env),
    windowsHide: true,
    shell: false
  };

  if (Array.isArray(parsed) && parsed.length) {
    const [exe, ...args] = parsed;
    if (isCoderTerminalPathLikeCommand(exe)) {
      return spawn(String(exe), args.map((v) => String(v)), spawnOptions);
    }
  }

  if (process.platform === 'win32') {
    return spawn('powershell.exe', ['-NonInteractive', '-Command', command], spawnOptions);
  }
  return spawn('/bin/sh', ['-lc', command], spawnOptions);
}

async function runCoderShellCommandCapture(commandText, options = {}) {
  const command = String(commandText || '').trim();
  if (!command) {
    return {
      ok: false,
      code: null,
      signal: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      outputTruncated: false,
      error: 'Command is empty'
    };
  }
  const hasShellControlSyntax = /(?:\|\||&&|[|;<>])/.test(command);
  const splitSimpleCommandLineArgs = (text) => {
    const src = String(text || '');
    if (!src.trim()) return [];
    const out = [];
    let buf = '';
    let quote = '';
    for (let i = 0; i < src.length; i += 1) {
      const ch = src.charAt(i);
      if (quote) {
        if (ch === '\\' && quote === '"' && i + 1 < src.length) {
          const next = src.charAt(i + 1);
          if (next === '"' || next === '\\') {
            buf += next;
            i += 1;
            continue;
          }
        }
        if (ch === quote) {
          quote = '';
          continue;
        }
        buf += ch;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (/\s/.test(ch)) {
        if (buf) {
          out.push(buf);
          buf = '';
          if (out.length >= 64) break;
        }
        continue;
      }
      buf += ch;
    }
    if (quote) return null;
    if (buf && out.length < 64) out.push(buf);
    return out;
  };

  if (process.platform === 'win32') {
    if (!hasShellControlSyntax) {
      const parsed = splitSimpleCommandLineArgs(command);
      if (Array.isArray(parsed) && parsed.length) {
        const [exe, ...args] = parsed;
        const directRes = await runCoderProcessCapture(exe, args, options);
        const spawnErr = String(directRes?.spawnErrorCode || '').toUpperCase();
        if (spawnErr !== 'ENOENT') {
          return directRes;
        }
      }
    }
    // Use the normal PowerShell profile so user PATH/toolchain setup (MinGW/MSYS2, etc.)
    // matches Windows Terminal behavior.
    return runCoderProcessCapture('powershell.exe', ['-NonInteractive', '-Command', command], options);
  }
  return runCoderProcessCapture('/bin/sh', ['-lc', command], options);
}

function parseCoderCCompilerDiagnostics(outputText, sourcePath, options = {}) {
  const output = String(outputText || '');
  const sourceAbs = path.resolve(String(sourcePath || ''));
  if (!output || !sourceAbs) return [];
  const cwd = options.cwd ? path.resolve(String(options.cwd)) : path.dirname(sourceAbs);
  const targetLower = sourceAbs.toLowerCase();
  const targetBase = path.basename(sourceAbs).toLowerCase();
  const seen = new Set();
  const out = [];

  for (const rawLine of output.split(/\r?\n/)) {
    const line = String(rawLine || '').trim();
    if (!line) continue;
    const match = line.match(/^(.*):(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note)\s*:\s*(.+)$/i);
    if (!match) continue;
    const filePart = String(match[1] || '').trim().replace(/^["']|["']$/g, '');
    let abs = '';
    try {
      abs = path.resolve(filePart);
    } catch (_) {
      try { abs = path.resolve(cwd, filePart); } catch (_) { abs = ''; }
    }
    const absLower = String(abs || '').toLowerCase();
    const baseLower = path.basename(abs || filePart).toLowerCase();
    const sepIdx = absLower ? (absLower.length - targetBase.length - 1) : -1;
    const hasSepBeforeBase = sepIdx >= 0 && /[\\/]/.test(absLower.charAt(sepIdx));
    if (!(absLower === targetLower || (!absLower && baseLower === targetBase) || (baseLower === targetBase && hasSepBeforeBase && absLower.endsWith(targetBase)))) {
      continue;
    }

    const level = String(match[4] || 'warning').toLowerCase();
    const message = String(match[5] || '').trim();
    if (!message) continue;
    const diag = {
      line: Math.max(1, Number(match[2]) || 1),
      col: Math.max(1, Number(match[3]) || 1),
      severity: /error/.test(level) ? 'error' : 'warning',
      code: `compiler:${level}`,
      message
    };
    const key = `${diag.severity}|${diag.line}|${diag.col}|${diag.code}|${diag.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diag);
    if (out.length >= 80) break;
  }

  out.sort((a, b) => {
    if ((a.line || 0) !== (b.line || 0)) return (a.line || 0) - (b.line || 0);
    if ((a.col || 0) !== (b.col || 0)) return (a.col || 0) - (b.col || 0);
    return String(a.message || '').localeCompare(String(b.message || ''));
  });
  return out;
}

async function runCoderCFile(event, payload = {}) {
  ensureCoderSenderWindow(event);
  const sourcePath = assertCoderPathAllowed(event, payload?.path, 'path');
  return runCSourceFile({
    sourcePath,
    compilerProfile: payload?.compilerProfile,
    customCompilerCommand: payload?.customCompilerCommand,
    extraCompilerArgs: payload?.extraCompilerArgs,
    stdinText: payload?.stdinText
  });
}

async function runCoderCppFile(event, payload = {}) {
  ensureCoderSenderWindow(event);
  const sourcePath = assertCoderPathAllowed(event, payload?.path, 'path');
  return runCppSourceFile({
    sourcePath,
    compilerProfile: payload?.compilerProfile,
    customCompilerCommand: payload?.customCompilerCommand,
    extraCompilerArgs: payload?.extraCompilerArgs,
    stdinText: payload?.stdinText
  });
}

if (!isStandaloneLikeLaunch) {
app.whenReady().then(() => {
  try {
    app.setPath('crashDumps', crashReportDir);
    crashReporter.start({
      companyName: 'Om-X',
      productName: 'Om-X',
      submitURL: '',
      uploadToServer: false,
      compress: true,
      globalExtra: {
        appVersion: app.getVersion()
      }
    });
  } catch (e) {
    console.error('[CrashReport] Failed to start crashReporter:', e);
  }

  app.on('render-process-gone', (event, contents, details) => {
    console.error('[Crash] render-process-gone:', details.reason, details.exitCode, contents.getURL());
    writeCrashReport('render-process-gone', {
      reason: details.reason,
      exitCode: details.exitCode,
      url: contents.getURL()
    });
  });

  app.on('child-process-gone', (event, details) => {
    console.error('[Crash] child-process-gone:', details);
    writeCrashReport('child-process-gone', details);
  });

  // Ensure Chessly IPC handlers exist even when launched embedded.
  ensureChesslyIpcHandlers();

  ipcMain.handle('ai-player:open-window', () => {
    createAIPlayerWindow();
    return { success: true };
  });

  ipcMain.handle('ai-chat:open-window', () => {
    createAIChatWindow();
    return { success: true };
  });

  ipcMain.handle('canvas:open-window', () => {
    createCanvasWindow();
    return { success: true };
  });

  ipcMain.handle('image-editor:open-window', () => {
    createImageEditorWindow();
    return { success: true };
  });

  ipcMain.handle('coder:open-window', () => {
    createCoderWindow();
    return { success: true };
  });

  ipcMain.handle('coder:preview-open-html', async (event, payload) => {
    try {
      ensureCoderSenderWindow(event);
      const safePayload = { ...(payload || {}) };
      if (safePayload.baseDir) {
        safePayload.baseDir = assertCoderPathAllowed(event, safePayload.baseDir, 'baseDir');
      }
      await createCoderPreviewWindow(safePayload);
      return { success: true };
    } catch (error) {
      console.error('[Coder] Preview open failed:', error);
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle('coder:preview-close', (event) => {
    try {
      ensureCoderSenderWindow(event);
    } catch (_) {
      return { success: false, error: 'Unauthorized Coder window request' };
    }
    if (coderPreviewWindow && !coderPreviewWindow.isDestroyed()) coderPreviewWindow.close();
    return { success: true };
  });

  ipcMain.handle('coder:run-c', async (event, payload) => {
    try {
      return await runCoderCFile(event, payload || {});
    } catch (error) {
      console.error('[Coder] C run failed:', error);
      return { success: false, phase: 'run', error: error?.message || String(error) };
    }
  });

  ipcMain.handle('coder:run-cpp', async (event, payload) => {
    try {
      return await runCoderCppFile(event, payload || {});
    } catch (error) {
      console.error('[Coder] C++ run failed:', error);
      return { success: false, phase: 'run', error: error?.message || String(error) };
    }
  });

  ipcMain.handle('coder:list-c-compilers', async (event) => {
    try {
      ensureCoderSenderWindow(event);
      const compilers = await detectAvailableCCompilers();
      return { success: true, compilers };
    } catch (error) {
      console.error('[Coder] Compiler scan failed:', error);
      return { success: false, compilers: [], error: error?.message || String(error) };
    }
  });

  ipcMain.handle('coder:list-cpp-compilers', async (event) => {
    try {
      ensureCoderSenderWindow(event);
      const compilers = await detectAvailableCppCompilers();
      return { success: true, compilers };
    } catch (error) {
      console.error('[Coder] C++ compiler scan failed:', error);
      return { success: false, compilers: [], error: error?.message || String(error) };
    }
  });

  ipcMain.handle('coder:terminal-exec', async (event, payload) => {
    try {
      ensureCoderSenderWindow(event);
      const command = String(payload?.command || '').trim();
      if (!command) return { success: false, error: 'Command is required', stdout: '', stderr: '', exitCode: null };
      let cwd = '';
      if (payload?.cwd) {
        cwd = assertCoderPathAllowed(event, payload.cwd, 'cwd');
      }
      const result = await runCoderShellCommandCapture(command, {
        cwd: cwd || undefined,
        timeoutMs: Math.max(1000, Number(payload?.timeoutMs) || 30000),
        maxOutputBytes: Math.max(4096, Number(payload?.maxOutputBytes) || (1024 * 1024))
      });
      const message = result.ok
        ? ''
        : (result.timedOut
            ? 'Command timed out'
            : (result.outputTruncated ? 'Command output exceeded limit' : (result.error || `Command exited with code ${result.code ?? 'unknown'}`)));
      return {
        success: Boolean(result.ok),
        cwd: cwd || '',
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        exitCode: Number.isFinite(Number(result.code)) ? Number(result.code) : null,
        timedOut: result.timedOut === true,
        outputTruncated: result.outputTruncated === true,
        error: message
      };
    } catch (error) {
      console.error('[Coder] Terminal exec failed:', error);
      return {
        success: false,
        cwd: '',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        outputTruncated: false,
        error: error?.message || String(error)
      };
    }
  });

  ipcMain.handle('coder:terminal-start', async (event, payload) => {
    try {
      ensureCoderSenderWindow(event);
      const command = String(payload?.command || '').trim();
      if (!command) return { success: false, error: 'Command is required', sessionId: '' };
      let cwd = '';
      if (payload?.cwd) {
        cwd = assertCoderPathAllowed(event, payload.cwd, 'cwd');
      }

      const ownerWebContentsId = Number(event?.sender?.id) || 0;
      const sessionId = makeCoderTerminalSessionId();
      const maxOutputBytes = Math.max(4096, Number(payload?.maxOutputBytes) || (1024 * 1024));
      const rawTimeoutMs = Number(payload?.timeoutMs);
      const timeoutMs = Number.isFinite(rawTimeoutMs) && rawTimeoutMs > 0 ? Math.max(1000, rawTimeoutMs) : 0;

      let child = null;
      try {
        child = spawnCoderTerminalSessionProcess(command, {
          cwd: cwd || undefined
        });
      } catch (error) {
        return { success: false, error: error?.message || String(error), sessionId: '' };
      }

      const sessionState = {
        id: sessionId,
        ownerWebContentsId,
        child,
        cwd: cwd || '',
        maxOutputBytes,
        totalBytes: 0,
        outputTruncated: false,
        timedOut: false,
        stoppedByUser: false,
        timeout: null,
        ended: false,
        spawnError: ''
      };
      coderTerminalSessions.set(sessionId, sessionState);

      const finalize = (code, signal) => {
        if (sessionState.ended) return;
        sessionState.ended = true;
        try { if (sessionState.timeout) clearTimeout(sessionState.timeout); } catch (_) {}
        const exitCode = Number.isFinite(Number(code)) ? Number(code) : null;
        const exitSignal = signal || null;
        const errorText = sessionState.spawnError
          || (sessionState.timedOut
              ? 'Command timed out'
              : (sessionState.outputTruncated ? 'Command output exceeded limit' : ''));
        const success = exitCode === 0 && !sessionState.timedOut && !sessionState.outputTruncated && !sessionState.spawnError;
        emitCoderTerminalSessionEvent(sessionState, {
          type: 'exit',
          success,
          exitCode,
          signal: exitSignal,
          timedOut: sessionState.timedOut === true,
          outputTruncated: sessionState.outputTruncated === true,
          stopped: sessionState.stoppedByUser === true,
          error: String(errorText || '')
        });
        cleanupCoderTerminalSession(sessionId);
      };

      const emitChunk = (stream, chunk) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
        if (!text || sessionState.ended) return;
        sessionState.totalBytes += Buffer.byteLength(text, 'utf8');
        emitCoderTerminalSessionEvent(sessionState, {
          type: String(stream || 'stdout') === 'stderr' ? 'stderr' : 'stdout',
          data: text
        });
        if (sessionState.totalBytes > sessionState.maxOutputBytes && child && !child.killed) {
          sessionState.outputTruncated = true;
          try { child.kill(); } catch (_) {}
        }
      };

      if (timeoutMs > 0) {
        sessionState.timeout = setTimeout(() => {
          sessionState.timedOut = true;
          try { child.kill(); } catch (_) {}
        }, timeoutMs);
      }

      child.stdout?.on('data', (chunk) => emitChunk('stdout', chunk));
      child.stderr?.on('data', (chunk) => emitChunk('stderr', chunk));
      child.on('error', (error) => {
        sessionState.spawnError = error?.message || String(error);
        finalize(null, null);
      });
      child.on('close', (code, signal) => {
        finalize(code, signal);
      });

      return {
        success: true,
        sessionId,
        cwd: cwd || ''
      };
    } catch (error) {
      console.error('[Coder] Terminal start failed:', error);
      return { success: false, error: error?.message || String(error), sessionId: '' };
    }
  });

  ipcMain.handle('coder:terminal-write', async (event, payload) => {
    try {
      ensureCoderSenderWindow(event);
      const sessionState = getCoderTerminalSessionForSender(event, payload?.sessionId);
      const child = sessionState.child;
      if (!child || sessionState.ended) {
        return { success: false, error: 'Terminal session is not running' };
      }
      if (!child.stdin || child.stdin.destroyed || child.stdin.writableEnded) {
        return { success: false, error: 'Terminal stdin is closed' };
      }
      const data = payload?.data == null ? '' : String(payload.data);
      const closeStdin = payload?.eof === true;
      await new Promise((resolve, reject) => {
        try {
          if (data) {
            child.stdin.write(data, (err) => (err ? reject(err) : resolve()));
            return;
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      if (closeStdin) {
        try { child.stdin.end(); } catch (_) {}
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle('coder:terminal-stop', async (event, payload) => {
    try {
      ensureCoderSenderWindow(event);
      const sessionState = getCoderTerminalSessionForSender(event, payload?.sessionId);
      if (!sessionState.child || sessionState.ended) return { success: true, stopped: false };
      sessionState.stoppedByUser = true;
      const signal = String(payload?.signal || '').trim() || undefined;
      try {
        sessionState.child.kill(signal);
      } catch (_) {
        try { sessionState.child.kill(); } catch (_) {}
      }
      return { success: true, stopped: true };
    } catch (error) {
      return { success: false, error: error?.message || String(error), stopped: false };
    }
  });

  ipcMain.handle('app:open-chess-master', () => {
    try {
      chessMasterApp?.openWindow?.();
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to open Chess Master:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:open-chessly', () => {
    try {
      chesslyApp?.openWindow?.({ embedded: true });
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to open Chessly:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:open-go', () => {
    try {
      goApp?.openWindow?.({ embedded: true });
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to open Go:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app:open-mindclone', () => {
    try {
      createMinecraftGameWindow();
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to open Mindclone:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-shortcut:create', (event, { appId }) => {
    return createDesktopShortcut(appId);
  });

  ipcMain.handle('site-app:open-window', (event, { appId, title, url }) => {
    createSiteAppWindow(appId, title, url);
    return { success: true };
  });

  ipcMain.on('site-app:navigate', (event, { action }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const viewEntry = [...siteAppWindows.entries()].find(([, w]) => w === win);
    if (!viewEntry) return;
    const view = siteAppViews.get(viewEntry[0]);
    if (!view) return;
    if (action === 'back') {
      if (view.webContents.canGoBack()) view.webContents.goBack();
    } else if (action === 'reload') {
      view.webContents.reload();
    }
  });

  app.on('web-contents-created', (event, contents) => registerGlobalShortcuts(contents));
  vaultManager.registerHandlers();
  websearch.registerHandlers(() => cachedSettings);
  localModelController.registerHandlers();
  try {
    if (session.defaultSession) {
      registerMindcloneProtocol(session.defaultSession);
    }
  } catch (e) {
    console.error('[Mindclone] Failed to register protocol on default session:', e);
  }
  applyYouTubeAdsBlocking(cachedSettings);
  createMainWindow();
}).catch(err => {
    console.error('[Om-X] Startup Error:', err);
});
}

// Minimal launch for mini-app shortcuts
if (isMiniLaunch) {
  app.whenReady().then(() => {
    try {
      if (miniAppId === 'chess-master-electron') {
        chessMasterApp?.openWindow?.({ embedded: true });
      } else if (miniAppId === 'chessly-electron') {
        chesslyApp?.openWindow?.({ embedded: true });
      } else if (miniAppId === 'go-electron') {
        goApp?.openWindow?.({ embedded: true });
      } else if (miniAppId === 'coder') {
        createCoderWindow();
      } else {
        console.error('[MiniLaunch] Unknown mini-app id:', miniAppId);
        app.quit();
      }
    } catch (e) {
      console.error('[MiniLaunch] Failed to open mini app:', miniAppId, e);
      app.quit();
    }
  }).catch(err => {
    console.error('[MiniLaunch] Startup Error:', err);
  });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

