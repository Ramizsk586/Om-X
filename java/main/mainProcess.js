const { app, BrowserWindow, ipcMain, Menu, screen, dialog, session, shell, webContents, protocol, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const https = require('https');
const net = require('net');
const os = require('os');
const { pathToFileURL, fileURLToPath } = require('url');
const dotenv = require('dotenv');
const {
  normalizeModelEntry,
  prepareLlamaLaunch,
  buildLlamaServerCommand
} = require('../utils/llama-models');

function getBundledOmxEnvCandidates() {
  return [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../Om-chat/.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'Om-chat', '.env'),
    path.join(path.dirname(process.execPath || ''), '.env'),
    path.join(path.dirname(process.execPath || ''), 'Om-chat', '.env'),
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'Om-chat', '.env') : ''
  ];
}

function getWritableOmxEnvPath() {
  try {
    return path.join(app.getPath('userData'), '.env');
  } catch (_) {
    return path.join(process.cwd(), '.omx-user.env');
  }
}

function shouldUseWritableOmxEnvMirror() {
  return Boolean(app?.isPackaged);
}

function ensureWritableOmxEnvMirror() {
  if (!shouldUseWritableOmxEnvMirror()) return '';
  const writablePath = path.resolve(getWritableOmxEnvPath());
  try {
    if (fs.existsSync(writablePath)) return writablePath;
  } catch (_) {}

  for (const candidate of getBundledOmxEnvCandidates()) {
    const sourcePath = String(candidate || '').trim();
    if (!sourcePath) continue;
    try {
      if (!fs.existsSync(sourcePath)) continue;
      fs.mkdirSync(path.dirname(writablePath), { recursive: true });
      fs.copyFileSync(sourcePath, writablePath);
      return writablePath;
    } catch (_) {}
  }

  return writablePath;
}

function getOmxEnvCandidates() {
  const bundled = getBundledOmxEnvCandidates();
  const writable = ensureWritableOmxEnvMirror();
  return writable ? [writable, ...bundled] : bundled;
}

function resolvePrimaryOmxEnvPath() {
  const writable = ensureWritableOmxEnvMirror();
  if (writable) return path.resolve(writable);
  const candidates = getOmxEnvCandidates();
  for (const candidate of candidates) {
    const target = String(candidate || '').trim();
    if (!target) continue;
    try {
      if (fs.existsSync(target)) return path.resolve(target);
    } catch (_) {}
  }
  return path.resolve(__dirname, '../../.env');
}

let primaryOmxEnvPath = resolvePrimaryOmxEnvPath();
let primaryOmxEnvKeys = new Set();
const REQUIRED_ENV_TEMPLATE_KEYS = Object.freeze(['SESSION_SECRET']);

function parseEnvText(raw = '') {
  try {
    return dotenv.parse(String(raw || ''));
  } catch (_) {
    return {};
  }
}

function validateImportedEnvContent(raw = '') {
  const parsed = parseEnvText(raw);
  const missingKeys = REQUIRED_ENV_TEMPLATE_KEYS.filter((key) => !String(parsed[key] || '').trim());
  if (!missingKeys.length) {
    return { valid: true, parsed, missingKeys: [] };
  }
  return {
    valid: false,
    parsed,
    missingKeys,
    error: `Missing required env values: ${missingKeys.join(', ')}`
  };
}

function reloadPrimaryOmxEnvFile() {
  const target = resolvePrimaryOmxEnvPath();
  primaryOmxEnvPath = target;
  let parsed = {};
  try {
    const raw = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    parsed = parseEnvText(raw);
  } catch (_) {
    parsed = {};
  }

  if (primaryOmxEnvKeys.size) {
    for (const key of primaryOmxEnvKeys) {
      delete process.env[key];
    }
  }

  primaryOmxEnvKeys = new Set(Object.keys(parsed));
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
  return { path: target, keys: [...primaryOmxEnvKeys] };
}

function loadOmxEnvFiles() {
  const candidates = getOmxEnvCandidates();

  const seen = new Set();
  for (const candidate of candidates) {
    const target = String(candidate || '').trim();
    if (!target || seen.has(target)) continue;
    seen.add(target);
    dotenv.config({ path: target, override: false, quiet: true });
  }
}

loadOmxEnvFiles();
reloadPrimaryOmxEnvFile();

function loadSessionGuardMasterKey() {
  try {
    const keyPath = path.join(app.getPath('userData'), 'sessionguard.key');
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    let secret = '';
    if (fs.existsSync(keyPath)) {
      secret = String(fs.readFileSync(keyPath, 'utf8') || '').trim();
    }
    if (!secret) {
      secret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, secret, { encoding: 'utf8', mode: 0o600 });
    }
    process.env.OMX_SESSIONGUARD_MASTER_KEY = secret;
    return secret;
  } catch (error) {
    const fallback = crypto.randomBytes(32).toString('hex');
    process.env.OMX_SESSIONGUARD_MASTER_KEY = fallback;
    console.warn('[SessionGuard] Falling back to ephemeral master key:', error?.message || error);
    return fallback;
  }
}

loadSessionGuardMasterKey();

function isAdultContentBlockEnabledFromEnv() {
  const raw = String(process.env.Adult_Content || process.env.ADULT_CONTENT || '')
    .split('//')[0]
    .split('#')[0]
    .trim()
    .toLowerCase();
  if (raw === 'on' || raw === 'true' || raw === '1') return false;
  if (raw === 'off' || raw === 'false' || raw === '0') return true;
  return true;
}

const SecurityManager = require('./security/SecurityManager');
const AntivirusEngine = require('./security/antivirus/AntivirusEngine');
const VirusTotalClient = require('./security/virustotal/VirusTotalClient');
const aiProvider = require('../utils/ai/aiProvider');
const websearch = require('../utils/ai/websearch');
const { SarvamAIClient } = require('sarvamai');

const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...args) => {
  const warningName = typeof warning === 'object' ? String(warning?.name || '') : String(args?.[0] || '');
  const warningMessage = String(typeof warning === 'string' ? warning : warning?.message || '');
  if (
    warningName === 'ExtensionLoadWarning' ||
    /Manifest version 2 is deprecated/i.test(warningMessage)
  ) {
    return;
  }
  return originalEmitWarning(warning, ...args);
};

const TRUSTED_RENDERER_PROTOCOLS = new Set(['file:']);

const GLOBAL_WEBPAGE_SCROLLBAR_CSS = `
  :root, html, body, * {
    scrollbar-width: thin !important;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent !important;
  }
  ::-webkit-scrollbar {
    width: 4px !important;
    height: 4px !important;
  }
  ::-webkit-scrollbar-track {
    background: transparent !important;
    margin: 4px !important;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08) !important;
    border-radius: 100px !important;
    opacity: 0 !important;
    transition: opacity 0.25s ease, transform 0.25s ease !important;
  }
  ::-webkit-scrollbar-thumb:hover,
  :hover::-webkit-scrollbar-thumb {
    opacity: 1 !important;
    transform: scaleY(1.05) !important;
    background: rgba(255, 255, 255, 0.3) !important;
  }
  ::-webkit-scrollbar-corner {
    background: transparent !important;
  }
`;

const globalScrollbarObservedContents = new Set();
const globalScrollbarCssKeys = new Map();
const globalScrollbarPendingSyncs = new Map();

function shouldApplyGlobalScrollbarToContents(contents) {
  if (!contents || contents.isDestroyed?.()) return false;
  if (mainWindow && contents.id === mainWindow.webContents.id) return false;
  const type = String(contents.getType?.() || '').toLowerCase();
  if (type === 'devtools' || type === 'backgroundpage' || type === 'utility') return false;
  return typeof contents.insertCSS === 'function';
}

async function removeGlobalScrollbarCss(contents) {
  if (!contents || contents.isDestroyed?.()) return;
  const cssKey = globalScrollbarCssKeys.get(contents.id);
  if (!cssKey || typeof contents.removeInsertedCSS !== 'function') return;
  try {
    await contents.removeInsertedCSS(cssKey);
  } catch (_) {}
  globalScrollbarCssKeys.delete(contents.id);
}

async function syncGlobalScrollbarForContents(contents) {
  if (!shouldApplyGlobalScrollbarToContents(contents)) {
    await removeGlobalScrollbarCss(contents);
    return;
  }

  if (globalScrollbarCssKeys.has(contents.id)) {
    return;
  }

  try {
    const cssKey = await contents.insertCSS(GLOBAL_WEBPAGE_SCROLLBAR_CSS, { cssOrigin: 'user' });
    globalScrollbarCssKeys.set(contents.id, cssKey);
  } catch (error) {
    console.warn('[Scrollbar Sync] CSS injection failed:', error?.message || error);
  }
}

function attachGlobalScrollbarToContents(contents) {
  if (!contents || contents.isDestroyed?.()) return;
  if (globalScrollbarObservedContents.has(contents.id)) return;
  globalScrollbarObservedContents.add(contents.id);

  const scheduleSync = () => {
    if (globalScrollbarPendingSyncs.has(contents.id)) return;
    const timer = setImmediate(() => {
      globalScrollbarPendingSyncs.delete(contents.id);
      syncGlobalScrollbarForContents(contents).catch((error) => {
        console.warn('[Scrollbar Sync] Sync failed:', error?.message || error);
      });
    });
    globalScrollbarPendingSyncs.set(contents.id, timer);
  };

  contents.on('dom-ready', scheduleSync);
  contents.on('did-navigate', scheduleSync);
  contents.on('did-navigate-in-page', scheduleSync);
  contents.on('did-frame-finish-load', scheduleSync);
  contents.on('destroyed', () => {
    const timer = globalScrollbarPendingSyncs.get(contents.id);
    if (timer) clearImmediate(timer);
    globalScrollbarPendingSyncs.delete(contents.id);
    globalScrollbarObservedContents.delete(contents.id);
    globalScrollbarCssKeys.delete(contents.id);
  });

  scheduleSync();
}

function resolveTrustedRendererFileRoots() {
  const roots = [];
  try {
    const appPath = path.resolve(app.getAppPath());
    roots.push(path.join(appPath, 'html'));
    roots.push(path.join(appPath, 'game', 'electron'));
  } catch (_) {}
  return roots.filter(Boolean);
}

const TRUSTED_RENDERER_FILE_ROOTS = resolveTrustedRendererFileRoots();

function isTrustedRendererFileUrl(urlObj) {
  try {
    if (!urlObj || urlObj.protocol !== 'file:') return false;
    const filePath = path.resolve(fileURLToPath(urlObj));
    return TRUSTED_RENDERER_FILE_ROOTS.some((root) => isSameOrSubFsPath(filePath, root));
  } catch (_) {
    return false;
  }
}

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
    if (!TRUSTED_RENDERER_PROTOCOLS.has(parsed.protocol)) return false;
    return isTrustedRendererFileUrl(parsed);
  } catch (_) {
    return false;
  }
}

function isTrustedInternalWindowUrl(url = '') {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return false;
  try {
    return isTrustedRendererFileUrl(new URL(rawUrl));
  } catch (_) {
    return false;
  }
}

function attachInternalWindowNavigationGuards(targetWindow, label = 'window', options = {}) {
  if (!targetWindow?.webContents) return;
  const allowExternalHttpPopups = options?.allowExternalHttpPopups === true;

  targetWindow.webContents.setWindowOpenHandler?.(({ url }) => {
    if (allowExternalHttpPopups) {
      try {
        const parsed = new URL(String(url || '').trim());
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: getOmxPopupWindowOptions(targetWindow)
          };
        }
      } catch (_) {}
    }
    console.warn(`[Security] Blocked popup from ${label}: ${url || 'unknown'}`);
    return { action: 'deny' };
  });

  const blockUnexpectedNavigation = (event, url) => {
    if (isTrustedInternalWindowUrl(url)) return;
    event.preventDefault();
    console.warn(`[Security] Blocked navigation from ${label}: ${url || 'unknown'}`);
  };

  targetWindow.webContents.on('will-navigate', blockUnexpectedNavigation);
  targetWindow.webContents.on('will-redirect', blockUnexpectedNavigation);
}

function attachExternalPopupAllowance(contents) {
  if (!contents || contents.isDestroyed?.() || typeof contents.setWindowOpenHandler !== 'function') return;

  contents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(String(url || '').trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const hostContents = contents.hostWebContents || contents;
        const hostWindow = BrowserWindow.fromWebContents(hostContents) || mainWindow || null;
        return {
          action: 'allow',
          overrideBrowserWindowOptions: getOmxPopupWindowOptions(hostWindow)
        };
      }
    } catch (_) {}
    return { action: 'deny' };
  });
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

const OMX_APP_ROOT = path.resolve(__dirname, '../../');
const OMX_GAMES_ROOT = path.resolve(OMX_APP_ROOT, 'game', 'electron');
const OMX_LAN_SERVER_ENTRY = path.resolve(OMX_GAMES_ROOT, 'chessly electron', 'java', 'lanServer.js');
const OMX_LAN_DEFAULT_PORT = 3001;
const OMX_MCP_MODULE = path.resolve(OMX_APP_ROOT, 'mcp', 'server.mjs');
const OMX_MCP_BOOTSTRAP = path.resolve(OMX_APP_ROOT, 'java', 'main', 'mcpBootstrap.cjs');
const OMX_OMCHAT_ROOT = path.resolve(OMX_APP_ROOT, 'Om-chat');
const OMX_OMCHAT_ENTRY = path.resolve(OMX_OMCHAT_ROOT, 'server', 'index.js');
const OMX_OMCHAT_NGROK_HELPER = path.resolve(OMX_OMCHAT_ROOT, 'scripts', 'run-with-ngrok.js');
const OMX_OMCHAT_BG_LAUNCHER = path.resolve(OMX_OMCHAT_ROOT, 'backgroundLauncher.js');
const OMX_OMCHAT_BG_PID_FILE = path.resolve(OMX_OMCHAT_ROOT, '.background-server.pid');
const OMX_OMCHAT_BG_URL_FILE = path.resolve(OMX_OMCHAT_ROOT, '.background-server.url');
const OMX_MCP_BG_PID_FILE = path.resolve(__dirname, '../../.mcp-background.pid');
const OMX_MCP_BG_CONFIG_FILE = path.resolve(__dirname, '../../.mcp-background.json');
const OMX_OMCHAT_DEFAULT_PORT = 3031;
const OMX_FIREWALL_RULE_STATE_VERSION = 2;
const OMX_ALLOWED_SCRIPT_ENTRY_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);
const OMX_ALLOWED_RENDERER_ENTRY_EXTENSIONS = new Set(['.html', '.htm']);
const OMX_ALLOW_UNSAFE_STANDALONE_ENTRY = String(process.env.OMX_ALLOW_UNSAFE_STANDALONE_ENTRY || '').trim() === '1';
const PDF_VIEWER_REDIRECT_TTL_MS = 15000;
const SERVER_STATUS_CACHE_TTL_MS = 1200;
const GPU_INFO_CACHE_TTL_MS = 10000;
const SAFE_DOWNLOAD_PROTOCOLS = new Set(['http:', 'https:']);
const EXTENDED_DOWNLOAD_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:']);
const BLOCKED_OPEN_PATH_EXTENSIONS = new Set([
    '.appx', '.apk', '.bat', '.cmd', '.com', '.cpl', '.dll', '.exe', '.hta',
    '.jar', '.js', '.jse', '.lnk', '.mjs', '.msi', '.msp', '.ps1', '.psm1',
    '.reg', '.scr', '.sh', '.url', '.vb', '.vbe', '.vbs', '.wsf'
]);
const recentPdfViewerRedirects = new Map();
const serverStatusCache = new Map();
let gpuInfoCache = null;

function normalizeHeaderValue(value) {
    if (Array.isArray(value)) return value.join('; ');
    return String(value || '');
}

function isPdfMimeType(mimeType) {
    const normalized = normalizeHeaderValue(mimeType).split(';', 1)[0].trim().toLowerCase();
    return normalized === 'application/pdf';
}

function isPdfUrl(targetUrl) {
    try {
        const parsed = new URL(String(targetUrl || '').trim());
        const pathname = decodeURIComponent(parsed.pathname || '').toLowerCase();
        return pathname.endsWith('.pdf');
    } catch (_) {
        return /\.pdf(?:$|[?#])/i.test(String(targetUrl || '').trim());
    }
}

function isAttachmentDisposition(contentDisposition) {
    return /\battachment\b/i.test(normalizeHeaderValue(contentDisposition));
}

function pruneRecentPdfViewerRedirects(now = Date.now()) {
    for (const [url, ts] of recentPdfViewerRedirects.entries()) {
        if ((now - ts) > PDF_VIEWER_REDIRECT_TTL_MS) recentPdfViewerRedirects.delete(url);
    }
}

function rememberPdfViewerRedirect(targetUrl) {
    const normalized = String(targetUrl || '').trim();
    if (!normalized) return;
    pruneRecentPdfViewerRedirects();
    recentPdfViewerRedirects.set(normalized, Date.now());
}

function wasRecentlyRedirectedToPdfViewer(targetUrl) {
    const normalized = String(targetUrl || '').trim();
    if (!normalized) return false;
    pruneRecentPdfViewerRedirects();
    return recentPdfViewerRedirects.has(normalized);
}

function shouldOpenPdfInViewer({ url, mimeType, filename, contentDisposition, explicitDownload }) {
    if (explicitDownload) return false;
    if (isAttachmentDisposition(contentDisposition)) return false;
    if (isPdfMimeType(mimeType)) return true;
    if (String(path.extname(String(filename || '')).toLowerCase()) === '.pdf') return true;
    return isPdfUrl(url);
}

function invalidateServerStatusCache(name) {
    if (name) {
        serverStatusCache.delete(String(name).trim().toLowerCase());
        return;
    }
    serverStatusCache.clear();
}

async function getCachedServerStatus(name, producer) {
    const key = String(name || '').trim().toLowerCase();
    const now = Date.now();
    const cached = serverStatusCache.get(key);
    if (cached && (now - cached.timestamp) < SERVER_STATUS_CACHE_TTL_MS) {
        return cached.value;
    }
    const value = await producer();
    serverStatusCache.set(key, { value, timestamp: now });
    return value;
}

async function getCachedGpuInfoPayload() {
    const now = Date.now();
    if (gpuInfoCache && (now - gpuInfoCache.timestamp) < GPU_INFO_CACHE_TTL_MS) {
        return { ...gpuInfoCache.value };
    }

    if (!app.isReady()) await app.whenReady();
    let value = {
      availableMemory: 0,
      totalMemoryMB: 0,
      dedicatedMemoryMB: 0,
      sharedMemoryMB: 0,
      isIntegrated: false,
      name: '',
      source: 'unknown'
    };
    try {
        const info = await app.getGPUInfo('complete');
        const electronInfo = extractGpuInfoPayload(info);
        if (electronInfo.availableMemory > 0) {
          value = electronInfo;
        }
    } catch (_) {
        // ignore and fall back
    }

    if (process.platform === 'win32') {
      try {
        const dxdiagInfo = await getWindowsDxdiagGpuInfoPayload();
        if (
          dxdiagInfo.availableMemory > 0
          && (
            !value.availableMemory
            || value.availableMemory <= 0
            || (!dxdiagInfo.isIntegrated && value.isIntegrated)
            || dxdiagInfo.dedicatedMemoryMB > value.dedicatedMemoryMB
            || (value.isIntegrated && dxdiagInfo.availableMemory < value.availableMemory)
          )
        ) {
          value = dxdiagInfo;
        }
      } catch (_) {
        // ignore and return best-known value
      }

      try {
        const controllerInfo = await getWindowsVideoControllerInfoPayload();
        if (
          controllerInfo.availableMemory > 0
          && (
            !value.availableMemory
            || value.availableMemory <= 0
            || (controllerInfo.isIntegrated && value.isIntegrated && (!value.dedicatedMemoryMB || value.dedicatedMemoryMB <= 0))
            || (controllerInfo.isIntegrated && !value.isIntegrated && !value.dedicatedMemoryMB)
          )
        ) {
          value = controllerInfo;
        }
      } catch (_) {
        // ignore and return best-known value
      }
    }

    gpuInfoCache = { value, timestamp: now };
    return { ...value };
}

function isBrowserOpenableLocalFile(filePath) {
    const ext = path.extname(String(filePath || '')).toLowerCase();
    return ['.pdf', '.htm', '.html', '.xhtml', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
}

function isTextBasedLocalFile(filePath) {
    const ext = path.extname(String(filePath || '')).toLowerCase();
    return [
        '.txt', '.md', '.markdown', '.log', '.ini', '.cfg', '.conf', '.env',
        '.json', '.jsonc', '.yaml', '.yml', '.xml', '.csv', '.tsv',
        '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx',
        '.css', '.scss', '.sass', '.less',
        '.html', '.htm', '.xhtml'
    ].includes(ext);
}

async function openTextFileInEditor(filePath) {
    if (process.platform === 'win32') {
        await new Promise((resolve, reject) => {
            execFile('notepad.exe', [filePath], (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        return;
    }

    const openError = await shell.openPath(filePath);
    if (openError) throw new Error(openError);
}

function normalizeNetworkUrl(rawUrl, allowedProtocols = SAFE_DOWNLOAD_PROTOCOLS) {
    const value = String(rawUrl || '').trim();
    if (!value) throw new Error('URL is required');
    let parsed;
    try {
        parsed = new URL(value);
    } catch (_) {
        throw new Error('Invalid URL');
    }
    if (!allowedProtocols.has(parsed.protocol)) {
        throw new Error(`Unsupported URL protocol: ${parsed.protocol || 'unknown'}`);
    }
    if (parsed.username || parsed.password) {
        throw new Error('URLs with embedded credentials are not allowed');
    }
    return parsed.toString();
}

function validateSafeOpenPath(targetPath) {
    const abs = path.resolve(String(targetPath || ''));
    if (!abs) throw new Error('Path is required');
    if (!isPathInSafeDirectories(abs)) {
        throw new Error('Access denied: Path outside allowed directories');
    }
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
        return abs;
    }
    if (!stat.isFile()) {
        throw new Error('Only files and directories can be opened');
    }
    const ext = path.extname(abs).toLowerCase();
    if (BLOCKED_OPEN_PATH_EXTENSIONS.has(ext)) {
        throw new Error(`Blocked potentially executable file type: ${ext || '(none)'}`);
    }
    return abs;
}

function validateLocalEntryFile(targetPath, options = {}) {
    const raw = String(targetPath || '').trim();
    if (!raw) throw new Error('Entry path is required');
    const resolved = path.resolve(raw);
    const allowedExtensions = options.allowedExtensions instanceof Set
        ? options.allowedExtensions
        : OMX_ALLOWED_SCRIPT_ENTRY_EXTENSIONS;
    const ext = path.extname(resolved).toLowerCase();
    if (allowedExtensions.size && !allowedExtensions.has(ext)) {
        throw new Error(`Unsupported entry extension: ${ext || '(none)'}`);
    }
    if (!fs.existsSync(resolved)) throw new Error('Entry file does not exist');
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) throw new Error('Entry path must be a file');

    const allowedRoots = Array.isArray(options.allowedRoots) ? options.allowedRoots.filter(Boolean) : [];
    if (!OMX_ALLOW_UNSAFE_STANDALONE_ENTRY && allowedRoots.length) {
        const allowed = allowedRoots.some((root) => isSameOrSubFsPath(resolved, root));
        if (!allowed) throw new Error('Entry path is outside allowed directories');
    }
    return resolved;
}

const standaloneEntryArg = process.argv.find(arg => arg.startsWith('--standalone-entry='));
let standaloneEntry = null;
if (standaloneEntryArg) {
    const requestedEntry = standaloneEntryArg.slice('--standalone-entry='.length);
    try {
        standaloneEntry = validateLocalEntryFile(requestedEntry, {
            allowedRoots: [OMX_APP_ROOT],
            allowedExtensions: OMX_ALLOWED_SCRIPT_ENTRY_EXTENSIONS
        });
    } catch (error) {
        console.error('[Security] Blocked invalid standalone entry:', requestedEntry, error?.message || error);
    }
}
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

const chesslyApp = !isStandaloneLaunch ? require('../../game/electron/chessly electron/java/main.js') : null;
const goApp = !isStandaloneLaunch ? require('../../game/electron/go electron/java/main.js') : null;

let llamaServerProcess = null;
let llamaNgrokProcess = null;
let llamaServerStartInProgress = false;
let scraperLlamaServerProcess = null;
let scraperLlamaServerStartInProgress = false;
let scraperLlamaStartedByApp = false;
let scraperLlamaActiveSessions = 0;
let llamaMemoryGuardInterval = null;
const LLAMA_GUARD_DEFAULTS = Object.freeze({
  enabled: true,
  warnRamPercent: 88,
  stopRamPercent: 93,
  minFreeRamMB: 2048,
  consecutiveHits: 2,
  sampleIntervalMs: 2000,
  drainPeriodMs: 15000
});
let llamaMemoryGuardState = {
  enabled: LLAMA_GUARD_DEFAULTS.enabled,
  pressure: 'idle',
  criticalHits: 0,
  isDraining: false,
  drainStartedAt: 0,
  lastSample: null,
  lastAction: 'Watching system memory.',
  lastWarningAt: 0,
  lastTriggeredAt: 0
};
let lanServerProcess = null;
let mcpServerProcess = null;
let omChatServerProcess = null;
let omChatNgrokProcess = null;
let omChatBackgroundProcess = null;
let openWebUiProcess = null;
let openWebUiStartInProgress = false;
let openWebUiManualStop = false;
let lanServerInstance = global.omxLanServer || null;
const SERVER_LOG_LIMIT = 500;
const OPEN_WEBUI_ENV_NAME = 'omx-open-webui';
const OPEN_WEBUI_PYTHON_VERSION = '3.12';
const OPEN_WEBUI_HOST = '127.0.0.1';
const OPEN_WEBUI_PORT = 8081;
const OPEN_WEBUI_CONDA_TOS_CHANNELS = [
  'https://repo.anaconda.com/pkgs/main',
  'https://repo.anaconda.com/pkgs/r',
  'https://repo.anaconda.com/pkgs/msys2'
];
const OPEN_WEBUI_START_TIMEOUT_MS = 3 * 60 * 1000;
const OPEN_WEBUI_START_IDLE_GRACE_MS = 45 * 1000;
const OPEN_WEBUI_START_MAX_TIMEOUT_MS = 10 * 60 * 1000;
const serverLogs = {
  llama: [],
  lan: [],
  mcp: [],
  omchat: [],
  openwebui: []
};
const serverStarts = {
  llama: null,
  lan: null,
  mcp: null,
  omchat: null,
  openwebui: null
};
const serverConfigs = {
  llama: null,
  lan: null,
  mcp: null,
  omchat: null,
  openwebui: null
};
let mcpModule = null;
let omChatModule = null;

function configureOmChatStorageEnvironment() {
  const existing = String(process.env.OMX_OMCHAT_DATA_DIR || process.env.OMCHAT_DATA_DIR || '').trim();
  if (existing) return path.resolve(existing);

  try {
    const userDataPath = app.getPath('userData');
    if (!userDataPath) return '';

    const storageDir = path.join(userDataPath, 'om-chat');
    process.env.OMX_OMCHAT_DATA_DIR = storageDir;
    process.env.OMCHAT_DATA_DIR = storageDir;
    return storageDir;
  } catch (_) {
    return '';
  }
}

global.serverLogs = serverLogs;
global.lanServer = lanServerInstance;
global.omxLanServer = lanServerInstance;

function loadLanServerClass() {
  if (!fs.existsSync(OMX_LAN_SERVER_ENTRY)) {
    throw new Error('LAN server entry not found.');
  }
  return require(OMX_LAN_SERVER_ENTRY);
}

function getOmChatModuleSync() {
  if (!fs.existsSync(OMX_OMCHAT_ENTRY)) {
    throw new Error('Om Chat server entry not found.');
  }
  configureOmChatStorageEnvironment();
  return require(OMX_OMCHAT_ENTRY);
}

async function loadMcpModule() {
  if (mcpModule) return mcpModule;
  mcpModule = await import(pathToFileURL(OMX_MCP_MODULE).href);
  return mcpModule;
}

async function loadOmChatModule() {
  if (omChatModule) return omChatModule;
  configureOmChatStorageEnvironment();
  omChatModule = await import(pathToFileURL(OMX_OMCHAT_ENTRY).href);
  return omChatModule;
}

function loadOmChatNgrokHelper() {
  if (!fs.existsSync(OMX_OMCHAT_NGROK_HELPER)) {
    throw new Error('Om Chat ngrok helper not found.');
  }
  return require(OMX_OMCHAT_NGROK_HELPER);
}

function execFileAsync(command, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        error,
        stdout: String(stdout || ''),
        stderr: String(stderr || '')
      });
    });
  });
}

function getScraperLlamaExecutableFromEnv() {
  return String(
    process.env.OMX_SCRAPER_LLAMA_EXECUTABLE
    || process.env.SCRAPER_LLAMA_EXECUTABLE
    || process.env.OMX_LLAMA_EXECUTABLE
    || process.env.LLAMA_SERVER_EXECUTABLE
    || 'C:\\llama.cpp\\llama-server.exe'
  ).trim();
}

function getScraperLlamaHostFromEnv() {
  return String(
    process.env.OMX_SCRAPER_LLAMA_HOST
    || process.env.SCRAPER_LLAMA_HOST
    || '127.0.0.1'
  ).trim() || '127.0.0.1';
}

function getScraperLlamaPortFromEnv() {
  const raw = Number(
    process.env.OMX_SCRAPER_LLAMA_PORT
    || process.env.SCRAPER_LLAMA_PORT
    || 8091
  );
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 8091;
}

function getScraperLlamaModelsPathFromEnv() {
  return String(
    process.env.OMX_SCRAPER_LLAMA_MODELS_PATH
    || process.env.SCRAPER_LLAMA_MODELS_PATH
    || process.env.OMX_LLAMA_MODELS_PATH
    || process.env.LLAMA_MODELS_PATH
    || 'C:\\llama.cpp\\models'
  ).trim();
}

function getScraperLlamaModelFromEnv() {
  return String(
    process.env.OMX_SCRAPER_LLAMA_MODEL
    || process.env.SCRAPER_LLAMA_MODEL
    || process.env.OMX_SCRAPER_LLM_MODEL
    || process.env.SCRAPER_LLM_MODEL
    || ''
  ).trim();
}

function getScraperLlamaContextLengthFromEnv() {
  const raw = Number(
    process.env.OMX_SCRAPER_LLAMA_CONTEXT_LENGTH
    || process.env.SCRAPER_LLAMA_CONTEXT_LENGTH
    || 4096
  );
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 4096;
}

function getScraperLlamaGpuLayersFromEnv() {
  const raw = Number(
    process.env.OMX_SCRAPER_LLAMA_GPU_LAYERS
    || process.env.SCRAPER_LLAMA_GPU_LAYERS
    || -1
  );
  return Number.isFinite(raw) ? Math.round(raw) : -1;
}

function getScraperLlamaThreadsFromEnv() {
  const raw = Number(
    process.env.OMX_SCRAPER_LLAMA_THREADS
    || process.env.SCRAPER_LLAMA_THREADS
    || Math.max(4, Math.min(16, os.cpus()?.length || 4))
  );
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 4;
}

function getScraperLlamaSystemPromptFromEnv() {
  return String(
    process.env.OMX_SCRAPER_LLAMA_SYSTEM_PROMPT
    || process.env.SCRAPER_LLAMA_SYSTEM_PROMPT
    || ''
  ).trim();
}

function getScraperLlamaApiBaseUrl() {
  return `http://${getScraperLlamaHostFromEnv()}:${getScraperLlamaPortFromEnv()}`;
}

async function resolveScraperLlamaModelPath() {
  const configuredModel = getScraperLlamaModelFromEnv();
  const modelsPath = getScraperLlamaModelsPathFromEnv();
  let modelPath = '';

  if (configuredModel) {
    modelPath = path.isAbsolute(configuredModel)
      ? configuredModel
      : path.join(modelsPath || '', configuredModel);
  } else if (modelsPath) {
    const entries = await fs.promises.readdir(modelsPath, { withFileTypes: true });
    const firstModel = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .find((name) => /\.gguf$/i.test(name) && !/^mmproj[-_]?.+\.gguf$/i.test(name));
    if (firstModel) {
      modelPath = path.join(modelsPath, firstModel);
    }
  }

  const resolvedModelPath = path.resolve(String(modelPath || '').trim());
  if (!resolvedModelPath) {
    throw new Error('SCRAPER_LLAMA_MODEL is not configured and no GGUF model was found in SCRAPER_LLAMA_MODELS_PATH.');
  }

  const stat = await fs.promises.stat(resolvedModelPath);
  if (!stat.isFile()) {
    throw new Error('SCRAPER_LLAMA_MODEL does not point to a valid GGUF file.');
  }

  return resolvedModelPath;
}

async function ensureScraperLlamaServerRunning() {
  const executable = getScraperLlamaExecutableFromEnv();
  const host = getScraperLlamaHostFromEnv();
  const port = getScraperLlamaPortFromEnv();
  const contextLength = String(getScraperLlamaContextLengthFromEnv());
  const gpuLayers = String(getScraperLlamaGpuLayersFromEnv());
  const threads = String(getScraperLlamaThreadsFromEnv());
  const systemPrompt = getScraperLlamaSystemPromptFromEnv();

  const modelPath = await resolveScraperLlamaModelPath();
  const baseUrl = getScraperLlamaApiBaseUrl();

  if (await checkTcpPort(host, port)) {
    scraperLlamaStartedByApp = false;
    return {
      success: true,
      alreadyRunning: true,
      startedByApp: false,
      executable,
      host,
      port,
      modelPath,
      baseUrl
    };
  }

  if (isServerProcessActive(scraperLlamaServerProcess)) {
    return {
      success: true,
      alreadyRunning: true,
      startedByApp: scraperLlamaStartedByApp,
      executable,
      host,
      port,
      modelPath,
      baseUrl
    };
  }

  if (scraperLlamaServerStartInProgress) {
    return { success: false, error: 'Scraper llama.cpp server is already starting.' };
  }

  scraperLlamaServerStartInProgress = true;
  try {
    const siblingFiles = await listSiblingFilesForModel(modelPath);
    const launch = prepareLlamaLaunch({
      executable,
      modelPath,
      contextLength,
      gpuLayers,
      port,
      threads,
      host,
      systemPrompt,
      siblingFiles
    });

    scraperLlamaServerProcess = spawn(executable, launch.args, {
      cwd: path.dirname(executable),
      windowsHide: true,
      stdio: 'ignore'
    });

    const spawnedProcess = scraperLlamaServerProcess;
    scraperLlamaStartedByApp = true;

    const startupState = await Promise.race([
      new Promise((resolve) => {
        spawnedProcess.once('error', (error) => {
          resolve({ ok: false, error: error?.message || 'Failed to launch scraper llama.cpp server.' });
        });
        spawnedProcess.once('exit', (code, signal) => {
          resolve({ ok: false, error: `Scraper llama.cpp server exited early (code: ${code ?? 'null'}, signal: ${signal ?? 'none'}).` });
        });
      }),
      wait(1200).then(() => ({ ok: isServerProcessActive(spawnedProcess) }))
    ]);

    if (!startupState?.ok) {
      scraperLlamaServerProcess = null;
      scraperLlamaStartedByApp = false;
      return { success: false, error: startupState?.error || 'Scraper llama.cpp server failed to stay running.' };
    }

    const ready = await waitForServerReady({
      host,
      port,
      proc: spawnedProcess,
      timeoutMs: 60000
    });

    if (!ready) {
      await terminateManagedChildProcess(spawnedProcess);
      if (scraperLlamaServerProcess === spawnedProcess) {
        scraperLlamaServerProcess = null;
      }
      scraperLlamaStartedByApp = false;
      return { success: false, error: `Scraper llama.cpp server did not open ${baseUrl} within 60 seconds.` };
    }

    spawnedProcess.once('exit', () => {
      if (scraperLlamaServerProcess === spawnedProcess) {
        scraperLlamaServerProcess = null;
      }
      scraperLlamaStartedByApp = false;
      scraperLlamaActiveSessions = 0;
    });

    return {
      success: true,
      startedByApp: true,
      executable,
      host,
      port,
      modelPath,
      baseUrl
    };
  } catch (error) {
    scraperLlamaServerProcess = null;
    scraperLlamaStartedByApp = false;
    return { success: false, error: error?.message || 'Failed to start scraper llama.cpp server.' };
  } finally {
    scraperLlamaServerStartInProgress = false;
  }
}

async function startScraperLlamaSession() {
  const startup = await ensureScraperLlamaServerRunning();
  if (!startup?.success) return startup;
  scraperLlamaActiveSessions += 1;
  return {
    ...startup,
    activeSessions: scraperLlamaActiveSessions
  };
}

async function stopScraperLlamaSession(options = {}) {
  const force = options?.force === true;
  if (force) {
    scraperLlamaActiveSessions = 0;
  } else {
    scraperLlamaActiveSessions = Math.max(0, scraperLlamaActiveSessions - 1);
  }

  if (scraperLlamaActiveSessions > 0) {
    return { success: true, running: true, activeSessions: scraperLlamaActiveSessions };
  }

  if (scraperLlamaStartedByApp && isServerProcessActive(scraperLlamaServerProcess)) {
    const proc = scraperLlamaServerProcess;
    scraperLlamaServerProcess = null;
    scraperLlamaStartedByApp = false;
    await terminateManagedChildProcess(proc);
    return { success: true, stopped: true, activeSessions: 0 };
  }

  return { success: true, stopped: false, activeSessions: 0 };
}

async function callScraperLlamaGenerate({ prompt, systemInstruction = '', temperature, maxTokens }) {
  const startup = await ensureScraperLlamaServerRunning();
  if (!startup?.success) {
    throw new Error(startup?.error || 'llama.cpp is unavailable.');
  }

  const shouldStopAfter = scraperLlamaActiveSessions === 0 && startup.startedByApp;
  try {
    const response = await fetch(`${startup.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: path.basename(startup.modelPath || 'local-model.gguf'),
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: String(systemInstruction || '') }] : []),
          { role: 'user', content: String(prompt || '') }
        ],
        stream: false,
        temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.3,
        max_tokens: Number.isFinite(Number(maxTokens)) ? Math.max(96, Math.min(4096, Math.round(Number(maxTokens)))) : 700
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`llama.cpp generate failed: ${response.status}${detail ? ` ${detail}` : ''}`);
    }

    const payload = await response.json().catch(() => ({}));
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      throw new Error('llama.cpp returned an empty response.');
    }

    return {
      text,
      provider: 'llama.cpp',
      model: path.basename(startup.modelPath || ''),
      baseUrl: startup.baseUrl
    };
  } finally {
    if (shouldStopAfter) {
      await stopScraperLlamaSession({ force: true }).catch(() => {});
    }
  }
}

function sanitizeScraperArtifactSegment(value, fallback = 'artifact') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function getScraperResearchArtifactsRoot() {
  return path.join(app.getPath('userData'), 'scraper-llama-artifacts');
}

function getScraperResearchSessionDir(sessionId) {
  return path.join(
    getScraperResearchArtifactsRoot(),
    sanitizeScraperArtifactSegment(sessionId, 'session')
  );
}

async function writeScraperResearchArtifact({ sessionId, fileName, content }) {
  const normalizedSessionId = sanitizeScraperArtifactSegment(sessionId, 'session');
  const normalizedFileName = sanitizeScraperArtifactSegment(fileName, 'checkpoint') + '.md';
  const sessionDir = getScraperResearchSessionDir(normalizedSessionId);
  await fs.promises.mkdir(sessionDir, { recursive: true });
  const filePath = path.join(sessionDir, normalizedFileName);
  await fs.promises.writeFile(filePath, String(content || ''), 'utf8');
  return {
    success: true,
    sessionId: normalizedSessionId,
    fileName: normalizedFileName,
    filePath
  };
}

async function listScraperResearchArtifacts(sessionId) {
  const normalizedSessionId = sanitizeScraperArtifactSegment(sessionId, 'session');
  const sessionDir = getScraperResearchSessionDir(normalizedSessionId);
  try {
    const entries = await fs.promises.readdir(sessionDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') continue;
      const filePath = path.join(sessionDir, entry.name);
      const content = await fs.promises.readFile(filePath, 'utf8').catch(() => '');
      files.push({
        fileName: entry.name,
        filePath,
        content: String(content || '')
      });
    }
    files.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }));
    return { success: true, sessionId: normalizedSessionId, files };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { success: true, sessionId: normalizedSessionId, files: [] };
    }
    throw error;
  }
}

async function cleanupScraperResearchArtifacts(sessionId) {
  const normalizedSessionId = sanitizeScraperArtifactSegment(sessionId, 'session');
  const sessionDir = getScraperResearchSessionDir(normalizedSessionId);
  try {
    await fs.promises.rm(sessionDir, { recursive: true, force: true });
    return { success: true, sessionId: normalizedSessionId };
  } catch (error) {
    return { success: false, sessionId: normalizedSessionId, error: error?.message || 'Failed to clean scraper artifacts.' };
  }
}

function getOpenWebUiLocalUrl() {
  return `http://${OPEN_WEBUI_HOST}:${OPEN_WEBUI_PORT}`;
}

function getOpenWebUiWorkingDir() {
  try {
    return path.join(app.getPath('userData'), 'open-webui');
  } catch (_) {
    return path.resolve(process.cwd(), 'open-webui');
  }
}

function getOpenWebUiSecretKeyPath() {
  return path.join(getOpenWebUiWorkingDir(), '.webui_secret_key');
}

function getOrCreateOpenWebUiSecretKey() {
  const secretPath = getOpenWebUiSecretKeyPath();
  try {
    const existing = fs.existsSync(secretPath)
      ? fs.readFileSync(secretPath, 'utf8').trim()
      : '';
    if (existing && Buffer.byteLength(existing, 'utf8') >= 32) return existing;
  } catch (_) {}

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, generated, 'utf8');
  } catch (_) {}
  return generated;
}

function resolveFfmpegExecutable() {
  const candidateDirs = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : '',
    process.env.ProgramFiles || '',
    process.env['ProgramFiles(x86)'] || ''
  ]
    .map((value) => unwrapWrappedQuotes(value))
    .filter(Boolean);

  const candidates = [
    process.env.FFMPEG_BINARY,
    process.env.FFMPEG_PATH,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'miniconda3', 'Library', 'bin', 'ffmpeg.exe') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Miniconda3', 'Library', 'bin', 'ffmpeg.exe') : '',
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, 'Library', 'bin', 'ffmpeg.exe') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.1-full_build', 'bin', 'ffmpeg.exe') : ''
  ]
    .map((value) => unwrapWrappedQuotes(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }

  const packageNamePatterns = [/^Gyan\.FFmpeg/i, /ffmpeg/i];
  const executableNamePatterns = [/^ffmpeg(?:\.exe)?$/i];
  const searchRoots = [...new Set(candidateDirs)];

  const walkForExecutable = (rootDir, depth = 0) => {
    if (!rootDir || depth > 4) return '';
    let entries = [];
    try {
      entries = fs.readdirSync(rootDir, { withFileTypes: true });
    } catch (_) {
      return '';
    }

    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isFile() && executableNamePatterns.some((pattern) => pattern.test(entry.name))) {
        return fullPath;
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(rootDir, entry.name);
      const shouldDive = depth === 0
        ? packageNamePatterns.some((pattern) => pattern.test(entry.name))
        : true;
      if (!shouldDive) continue;
      const found = walkForExecutable(fullPath, depth + 1);
      if (found) return found;
    }

    return '';
  };

  for (const rootDir of searchRoots) {
    const found = walkForExecutable(rootDir, 0);
    if (found) return found;
  }

  return '';
}

function resolveHuggingFaceToken() {
  const candidates = [
    process.env.OMX_HF_TOKEN,
    process.env.HF_TOKEN,
    process.env.HUGGINGFACEHUB_API_TOKEN,
    process.env.HUGGINGFACE_HUB_TOKEN,
    process.env.HUGGING_FACE_HUB_TOKEN,
    process.env.HUGGINGFACE_TOKEN
  ];

  for (const candidate of candidates) {
    const token = String(candidate || '').trim();
    if (token) return token;
  }

  return '';
}

function buildOpenWebUiChildEnv(localUrl) {
  const ffmpegPath = resolveFfmpegExecutable();
  const ffmpegDir = ffmpegPath ? path.dirname(ffmpegPath) : '';
  const windowsDir = String(process.env.WINDIR || 'C:\\Windows').trim() || 'C:\\Windows';
  const system32Dir = path.join(windowsDir, 'System32');
  const powerShellDir = path.join(system32Dir, 'WindowsPowerShell', 'v1.0');
  const cmdExePath = path.join(system32Dir, 'cmd.exe');
  const powerShellExePath = path.join(powerShellDir, 'powershell.exe');
  const secretKey = getOrCreateOpenWebUiSecretKey();
  const hfToken = resolveHuggingFaceToken();
  const childEnv = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    WEBUI_AUTH: 'False',
    WEBUI_AUTO_LOGIN: 'True',
    WEBUI_SECRET_KEY: secretKey,
    CORS_ALLOW_ORIGIN: localUrl,
    USER_AGENT: process.env.USER_AGENT || 'Om-X Open WebUI Launcher',
    ComSpec: process.env.ComSpec || cmdExePath,
    COMSPEC: process.env.COMSPEC || process.env.ComSpec || cmdExePath
  };

  childEnv.PATH = [system32Dir, powerShellDir, childEnv.PATH].filter(Boolean).join(path.delimiter);
  childEnv.Path = childEnv.PATH;

  if (fs.existsSync(powerShellExePath)) {
    childEnv.POWERSHELL_EXE = powerShellExePath;
  }

  if (!String(childEnv.HF_HUB_DISABLE_SYMLINKS_WARNING || '').trim()) {
    childEnv.HF_HUB_DISABLE_SYMLINKS_WARNING = '1';
  }

  if (hfToken) {
    childEnv.HF_TOKEN = hfToken;
    childEnv.HUGGINGFACEHUB_API_TOKEN = hfToken;
    childEnv.HUGGINGFACE_HUB_TOKEN = hfToken;
    childEnv.HUGGING_FACE_HUB_TOKEN = hfToken;
  }

  if (ffmpegPath) {
    childEnv.FFMPEG_BINARY = ffmpegPath;
    childEnv.FFMPEG_PATH = ffmpegPath;
    childEnv.IMAGEIO_FFMPEG_EXE = ffmpegPath;
    childEnv.PYDUB_FFMPEG_PATH = ffmpegPath;
    childEnv.PATH = [ffmpegDir, childEnv.PATH].filter(Boolean).join(path.delimiter);
  } else {
    childEnv.PYTHONWARNINGS = [
      childEnv.PYTHONWARNINGS,
      'ignore::RuntimeWarning:pydub.utils'
    ].filter(Boolean).join(',');
  }

  return { childEnv, ffmpegPath, hfTokenConfigured: Boolean(hfToken) };
}

function unwrapWrappedQuotes(value = '') {
  let normalized = String(value || '').trim();
  while (
    normalized.length >= 2
    && ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

async function terminateManagedChildProcess(child) {
  if (!child) return;
  const pid = Number(child.pid);
  const hasExitListener = typeof child.once === 'function';
  const isPidAlive = () => {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (_) {
      return false;
    }
  };
  const alive = () => isServerProcessActive(child) || isPidAlive();
  const waitForExit = (timeoutMs = 4000) => new Promise((resolve) => {
    if (!alive()) {
      resolve(true);
      return;
    }

    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      resolve(value);
    };

    if (hasExitListener) {
      child.once('exit', () => finish(true));
    } else {
      pollTimer = setInterval(() => {
        if (!alive()) finish(true);
      }, 200);
    }

    timeoutTimer = setTimeout(() => finish(!alive()), timeoutMs);
  });

  if (process.platform === 'win32') {
    if (Number.isInteger(pid) && pid > 0) {
      await execFileAsync('taskkill', ['/pid', String(pid), '/T', '/F'], { timeout: 15000 });
    } else {
      try { child.kill(); } catch (_) {}
    }
    return;
  }

  if (!alive()) return;

  try { process.kill(pid, 'SIGTERM'); } catch (_) {}

  const exitedCleanly = await waitForExit(4000);
  if (exitedCleanly || !alive()) return;

  console.warn(`[ProcessKill] PID ${pid} did not exit after SIGTERM; sending SIGKILL`);
  try { process.kill(pid, 'SIGKILL'); } catch (_) {}
  await waitForExit(2000);
}

async function terminateProcessListeningOnPort(port) {
  const normalizedPort = Number(port);
  if (!Number.isInteger(normalizedPort) || normalizedPort <= 0) return false;

  if (process.platform === 'win32') {
    const script = [
      `$port = ${normalizedPort}`,
      '$conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue',
      'if (-not $conns) { exit 0 }',
      '$pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique',
      'foreach ($p in $pids) {',
      '  if ($p -and $p -ne $PID) {',
      '    try { Stop-Process -Id $p -Force -ErrorAction Stop } catch {}',
      '  }',
      '}',
      'exit 0'
    ].join('; ');
    const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: 15000 });
    return result.ok;
  }

  if (process.platform === 'darwin') {
    const lsof = await execFileAsync('lsof', ['-ti', `tcp:${normalizedPort}`, '-sTCP:LISTEN'], { timeout: 15000 });
    if (!lsof.ok || !lsof.stdout.trim()) return false;

    const victims = lsof.stdout
      .split(/\s+/)
      .map(Number)
      .filter((victimPid) => Number.isInteger(victimPid) && victimPid > 0 && victimPid !== process.pid);

    for (const victimPid of victims) {
      try { process.kill(victimPid, 'SIGTERM'); } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 800));
      try { process.kill(victimPid, 'SIGKILL'); } catch (_) {}
    }

    return victims.length > 0;
  }

  const ss = await execFileAsync('ss', ['-tlnpH', `sport = :${normalizedPort}`], { timeout: 15000 });
  let pids = [];

  if (ss.ok && ss.stdout.trim()) {
    const pidMatches = ss.stdout.matchAll(/pid=(\d+)/g);
    for (const match of pidMatches) {
      const victimPid = Number(match[1]);
      if (Number.isInteger(victimPid) && victimPid > 0 && victimPid !== process.pid) {
        pids.push(victimPid);
      }
    }
  }

  if (pids.length === 0) {
    const lsof = await execFileAsync('lsof', ['-ti', `tcp:${normalizedPort}`, '-sTCP:LISTEN'], { timeout: 15000 });
    if (lsof.ok && lsof.stdout.trim()) {
      pids = lsof.stdout
        .split(/\s+/)
        .map(Number)
        .filter((victimPid) => Number.isInteger(victimPid) && victimPid > 0 && victimPid !== process.pid);
    }
  }

  for (const victimPid of pids) {
    try { process.kill(victimPid, 'SIGTERM'); } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 800));
    try { process.kill(victimPid, 'SIGKILL'); } catch (_) {}
  }

  return pids.length > 0;
}

async function terminateOpenWebUiProcesses() {
  if (process.platform === 'win32') {
    const script = [
      "$patterns = @(",
      `  '${OPEN_WEBUI_ENV_NAME}'.ToLowerInvariant(),`,
      "  'open-webui serve',",
      "  'open_webui'",
      ")",
      "$self = $PID",
      "$procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {",
      "  $cmd = [string]($_.CommandLine)",
      "  if ([string]::IsNullOrWhiteSpace($cmd)) { return $false }",
      "  $lower = $cmd.ToLowerInvariant()",
      "  return ($patterns | Where-Object { $lower.Contains($_) }).Count -gt 0",
      "}",
      "foreach ($proc in $procs) {",
      "  $pid = [int]$proc.ProcessId",
      "  if ($pid -and $pid -ne $self) {",
      "    try { Stop-Process -Id $pid -Force -ErrorAction Stop } catch {}",
      "  }",
      "}",
      "exit 0"
    ].join('; ');

    const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: 15000 });
    return result.ok;
  }

  const patterns = [
    OPEN_WEBUI_ENV_NAME,
    'open-webui serve',
    'open_webui'
  ];

  let anyKilled = false;
  for (const pattern of patterns) {
    const termResult = await execFileAsync('pkill', ['-TERM', '-f', pattern], { timeout: 15000 });
    if (termResult.ok) anyKilled = true;
  }

  if (anyKilled) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    for (const pattern of patterns) {
      await execFileAsync('pkill', ['-KILL', '-f', pattern], { timeout: 15000 });
    }
  }

  return anyKilled;
}

async function resolveCondaExecutable() {
  const envCandidates = [
    process.env.CONDA_EXE,
    process.env.MAMBA_EXE,
    process.env.MINICONDA_HOME ? path.join(process.env.MINICONDA_HOME, 'Scripts', 'conda.exe') : '',
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, 'Scripts', 'conda.exe') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'miniconda3', 'Scripts', 'conda.exe') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Miniconda3', 'Scripts', 'conda.exe') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'miniconda3', 'Scripts', 'conda.exe') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Miniconda3', 'Scripts', 'conda.exe') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'anaconda3', 'Scripts', 'conda.exe') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Anaconda3', 'Scripts', 'conda.exe') : ''
  ].map((value) => unwrapWrappedQuotes(value)).filter(Boolean);

  for (const candidate of envCandidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }

  const whereRes = await execFileAsync('where', ['conda']);
  if (!whereRes.ok) return '';
  const found = whereRes.stdout
    .split(/\r?\n/)
    .map((line) => unwrapWrappedQuotes(line))
    .find((line) => line && /\.exe$/i.test(line));
  return found || '';
}

function resolveCondaActivationScript(condaExe = '') {
  const exePath = unwrapWrappedQuotes(condaExe);
  if (!exePath) return '';
  try {
    const scriptsDir = path.dirname(exePath);
    const rootDir = path.dirname(scriptsDir);
    const candidates = [
      path.join(rootDir, 'condabin', 'conda.bat'),
      path.join(scriptsDir, 'conda.bat'),
      path.join(scriptsDir, 'activate.bat')
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) return candidate;
    }
  } catch (_) {}
  return '';
}

async function resolveOpenWebUiPythonExecutable() {
  const candidatePaths = [
    process.env.PYTHON_EXECUTABLE,
    process.env.PYTHON_HOME ? path.join(process.env.PYTHON_HOME, 'python.exe') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python312', 'python.exe') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python312-32', 'python.exe') : '',
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Python312', 'python.exe') : '',
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Python', 'Python312', 'python.exe') : '',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Python312-32', 'python.exe') : '',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Python', 'Python312-32', 'python.exe') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe') : ''
  ]
    .map((value) => unwrapWrappedQuotes(value))
    .filter(Boolean);

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }

  const whereRes = await execFileAsync('where', ['python']);
  if (!whereRes.ok) return '';
  const found = whereRes.stdout
    .split(/\r?\n/)
    .map((line) => unwrapWrappedQuotes(line))
    .find((line) => line && /\.exe$/i.test(line));
  return found || '';
}

async function detectOpenWebUiPythonInstalled() {
  const versionPattern = OPEN_WEBUI_PYTHON_VERSION.replace(/\./g, '\\.');
  const pyRes = await execFileAsync('py', [`-${OPEN_WEBUI_PYTHON_VERSION}`, '--version']);
  if (pyRes.ok && new RegExp(`Python\\s+${versionPattern}(\\.|$)`, 'i').test(`${pyRes.stdout}\n${pyRes.stderr}`)) {
    return true;
  }

  const pythonRes = await execFileAsync('python', ['--version']);
  if (pythonRes.ok && new RegExp(`Python\\s+${versionPattern}(\\.|$)`, 'i').test(`${pythonRes.stdout}\n${pythonRes.stderr}`)) {
    return true;
  }

  const pythonExe = await resolveOpenWebUiPythonExecutable();
  if (!pythonExe) return false;
  const absolutePythonRes = await execFileAsync(pythonExe, ['--version']);
  return absolutePythonRes.ok && new RegExp(`Python\\s+${versionPattern}(\\.|$)`, 'i').test(`${absolutePythonRes.stdout}\n${absolutePythonRes.stderr}`);
}

async function listCondaEnvs(condaExe) {
  const res = await execFileAsync(condaExe, ['env', 'list']);
  if (!res.ok) return [];
  return res.stdout.split(/\r?\n/).map((line) => String(line || '').trim()).filter(Boolean);
}

function getOpenWebUiCondaTosRoots(condaExe = '') {
  const roots = [
    os.homedir ? path.join(os.homedir(), '.conda', 'tos') : '',
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.conda', 'tos') : '',
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, 'conda-meta', 'tos') : '',
    process.env.ProgramData ? path.join(process.env.ProgramData, 'conda', 'tos') : 'C:\\ProgramData\\conda\\tos'
  ];

  const exePath = unwrapWrappedQuotes(condaExe);
  if (exePath) {
    try {
      const scriptsDir = path.dirname(exePath);
      const condaRoot = path.dirname(scriptsDir);
      roots.push(path.join(condaRoot, 'conda-meta', 'tos'));
    } catch (_) {}
  }

  return [...new Set(
    roots
      .map((value) => unwrapWrappedQuotes(value))
      .filter(Boolean)
      .map((value) => path.resolve(value))
  )];
}

function readOpenWebUiCondaTosRecords(condaExe = '') {
  const records = [];
  const visit = (dirPath, depth = 0) => {
    if (!dirPath || depth > 2) return;

    let entries = [];
    try {
      if (!fs.existsSync(dirPath)) return;
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath, depth + 1);
        continue;
      }

      if (!entry.isFile() || !/\.json$/i.test(entry.name)) continue;

      try {
        const stat = fs.statSync(fullPath);
        const payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        records.push({
          ...payload,
          __file: fullPath,
          __mtimeMs: Number(stat?.mtimeMs || 0)
        });
      } catch (_) {}
    }
  };

  for (const root of getOpenWebUiCondaTosRoots(condaExe)) {
    visit(root, 0);
  }

  return records;
}

async function getOpenWebUiCondaTosStatus(condaExe) {
  const acceptedByChannel = Object.fromEntries(
    OPEN_WEBUI_CONDA_TOS_CHANNELS.map((channel) => [channel, false])
  );

  const storedRecords = readOpenWebUiCondaTosRecords(condaExe);
  if (storedRecords.length > 0) {
    const latestByChannel = new Map();

    for (const record of storedRecords) {
      const channel = String(record?.base_url || record?.channel || record?.url || '').trim();
      if (!channel || !(channel in acceptedByChannel)) continue;

      const sortKey = Math.max(
        Number(record?.__mtimeMs || 0),
        Number(Date.parse(String(record?.acceptance_timestamp || '')) || 0),
        Number(Date.parse(String(record?.updated_at || '')) || 0),
        Number(Date.parse(String(record?.created_at || '')) || 0)
      );
      const accepted = Boolean(record?.tos_accepted === true || record?.accepted === true);
      const previous = latestByChannel.get(channel);
      if (!previous || sortKey >= previous.sortKey) {
        latestByChannel.set(channel, { accepted, sortKey });
      }
    }

    for (const channel of OPEN_WEBUI_CONDA_TOS_CHANNELS) {
      if (latestByChannel.has(channel)) {
        acceptedByChannel[channel] = latestByChannel.get(channel).accepted === true;
      }
    }

    const foundKnownChannelRecord = OPEN_WEBUI_CONDA_TOS_CHANNELS.some((channel) => latestByChannel.has(channel));
    if (foundKnownChannelRecord) return acceptedByChannel;
  }

  if (!condaExe) return acceptedByChannel;

  const jsonRes = await execFileAsync(condaExe, ['tos', '--json'], { timeout: 20000 });
  if (jsonRes.ok) {
    try {
      const payload = JSON.parse(String(jsonRes.stdout || '{}'));
      const records = []
        .concat(Array.isArray(payload) ? payload : [])
        .concat(Array.isArray(payload?.channels) ? payload.channels : [])
        .concat(Array.isArray(payload?.data) ? payload.data : [])
        .concat(Array.isArray(payload?.tos) ? payload.tos : []);

      for (const record of records) {
        const channel = String(
          record?.base_url
          || record?.channel
          || record?.url
          || record?.name
          || record?.channel_url
          || ''
        ).trim();
        if (!channel || !(channel in acceptedByChannel)) continue;

        const acceptedValue = record?.tos_accepted ?? record?.accepted ?? record?.accepted_at ?? record?.accepted_on ?? record?.status ?? '';
        const normalizedAccepted = String(acceptedValue || '').trim().toLowerCase();
        acceptedByChannel[channel] = Boolean(
          record?.tos_accepted === true
          || record?.accepted === true
          || record?.accepted_at
          || record?.accepted_on
          || (normalizedAccepted && normalizedAccepted !== 'false' && normalizedAccepted !== 'no' && normalizedAccepted !== 'rejected' && normalizedAccepted !== 'null')
        );
      }

      return acceptedByChannel;
    } catch (_) {}
  }

  const textRes = await execFileAsync(condaExe, ['tos'], { timeout: 20000 });
  const output = `${textRes.stdout || ''}\n${textRes.stderr || ''}`;
  for (const channel of OPEN_WEBUI_CONDA_TOS_CHANNELS) {
    const escapedChannel = channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const line = output
      .split(/\r?\n/)
      .find((entry) => new RegExp(escapedChannel, 'i').test(entry));
    if (!line) continue;

    const normalizedLine = line.trim().toLowerCase();
    acceptedByChannel[channel] = !(
      !normalizedLine
      || /\brejected\b/i.test(normalizedLine)
      || /\bnot accepted\b/i.test(normalizedLine)
      || /\bpending\b/i.test(normalizedLine)
    );
  }

  return acceptedByChannel;
}

async function getOpenWebUiSetupState() {
  const condaExe = await resolveCondaExecutable();
  const pythonInstalled = await detectOpenWebUiPythonInstalled();
  const minicondaInstalled = Boolean(condaExe);
  const ffmpegInstalled = Boolean(resolveFfmpegExecutable());
  const localUrl = getOpenWebUiLocalUrl();
  const portActive = await checkTcpPort(OPEN_WEBUI_HOST, OPEN_WEBUI_PORT);
  const running = portActive;
  const managedRunning = isServerProcessActive(openWebUiProcess);

  let envExists = false;
  let packageInstalled = false;
  let tosAcceptedByChannel = Object.fromEntries(
    OPEN_WEBUI_CONDA_TOS_CHANNELS.map((channel) => [channel, false])
  );
  if (!running && condaExe) {
    tosAcceptedByChannel = await getOpenWebUiCondaTosStatus(condaExe);
    const envs = await listCondaEnvs(condaExe);
    envExists = envs.some((line) => new RegExp(`(^|\\s|[\\\\/])${OPEN_WEBUI_ENV_NAME}(\\s|$)`, 'i').test(line));
    if (envExists) {
      const pipShow = await execFileAsync(condaExe, ['run', '-n', OPEN_WEBUI_ENV_NAME, 'pip', 'show', 'open-webui'], { timeout: 20000 });
      packageInstalled = pipShow.ok;
    }
  }

  let phase = 'ready';
  let title = 'Open WebUI is ready to launch.';
  let message = 'Click launch to start Open WebUI in the managed Miniconda environment.';
  let commands = [];
  let incompleteItems = [];

  if (!pythonInstalled || !minicondaInstalled || !ffmpegInstalled) {
    phase = 'install-prereqs';
    const missingPrereqs = [];
    if (!pythonInstalled) {
      missingPrereqs.push({
        label: `Python ${OPEN_WEBUI_PYTHON_VERSION}`,
        command: `winget install -e --id Python.Python.${OPEN_WEBUI_PYTHON_VERSION}`
      });
    }
    if (!minicondaInstalled) {
      missingPrereqs.push({
        label: 'Miniconda',
        command: 'winget install -e --id Anaconda.Miniconda3'
      });
    }
    if (!ffmpegInstalled) {
      missingPrereqs.push({
        label: 'FFmpeg',
        command: 'winget install -e --id Gyan.FFmpeg'
      });
    }
    incompleteItems = missingPrereqs.map((item) => item.label);
    commands = missingPrereqs.map((item) => item.command);
    title = missingPrereqs.length === 1
      ? 'Install the remaining Open WebUI prerequisite.'
      : `Complete ${missingPrereqs.length} remaining Open WebUI prerequisites.`;
    message = 'Om-X scanned this device and only these missing prerequisites still need attention. Run them in order, then click the Open WebUI icon again.';
  } else if (!envExists || !packageInstalled) {
    phase = 'setup-env';
    const missingTosCommands = OPEN_WEBUI_CONDA_TOS_CHANNELS
      .filter((channel) => !tosAcceptedByChannel[channel])
      .map((channel) => `conda tos accept --override-channels --channel ${channel}`);

    if (missingTosCommands.length > 0) {
      incompleteItems = missingTosCommands.map((command) => {
        const channel = command.split('--channel ')[1] || '';
        return `Conda Terms of Service: ${channel}`;
      });
      title = missingTosCommands.length === 1
        ? 'Accept the remaining Conda Terms of Service.'
        : `Accept ${missingTosCommands.length} remaining Conda Terms of Service entries.`;
      message = 'Om-X scanned this device and only these incomplete Conda setup steps are still required. Run them in order, then click the Open WebUI icon again.';
      commands = missingTosCommands;
    } else if (!envExists) {
      incompleteItems = ['Create the Open WebUI Conda environment'];
      title = 'Create the Open WebUI Conda environment.';
      message = 'Om-X scanned this device and the remaining step is to create the managed Conda environment. Run this command, then click the Open WebUI icon again.';
      commands = [
        `conda create -n ${OPEN_WEBUI_ENV_NAME} python=${OPEN_WEBUI_PYTHON_VERSION} -y`
      ];
    } else if (!packageInstalled) {
      incompleteItems = ['Activate the Conda environment', 'Install Open WebUI'];
      title = 'Install Open WebUI in the Conda environment.';
      message = 'Om-X scanned this device and only these final setup steps remain. Run them in order, then click the Open WebUI icon again.';
      commands = [
        `conda activate ${OPEN_WEBUI_ENV_NAME}`,
        'pip install open-webui'
      ];
    }
  } else if (running) {
    phase = 'running';
    title = 'Open WebUI is already running.';
    message = 'Opening the existing local instance.';
  }

  return {
    success: true,
    phase,
    title,
    message,
    commands,
    running,
    managedRunning,
    ffmpegInstalled,
    pythonInstalled,
    minicondaInstalled,
    packageInstalled,
    envExists,
    tosAcceptedByChannel,
    incompleteItems,
    ready: running,
    localUrl,
    envName: OPEN_WEBUI_ENV_NAME
  };
}

async function stopOpenWebUiInternal() {
  const hadManagedProcess = isServerProcessActive(openWebUiProcess);
  const child = openWebUiProcess;
  openWebUiProcess = null;
  openWebUiStartInProgress = false;
  openWebUiManualStop = true;
  serverStarts.openwebui = null;
  serverConfigs.openwebui = null;

  const tasks = [];

  if (hadManagedProcess && child) {
    tasks.push(terminateManagedChildProcess(child));
  }

  tasks.push(
    checkTcpPort(OPEN_WEBUI_HOST, OPEN_WEBUI_PORT).then((inUse) =>
      inUse ? terminateProcessListeningOnPort(OPEN_WEBUI_PORT) : Promise.resolve(false)
    )
  );

  tasks.push(terminateOpenWebUiProcesses());

  await Promise.race([
    Promise.allSettled(tasks),
    new Promise((resolve) => setTimeout(resolve, 7000))
  ]);
}

function pushServerLog(name, type, data) {
  if (!serverLogs[name]) return;
  const lines = String(data || '').split(/\r?\n|\r/).filter(Boolean);
  if (lines.length === 0) return;
  const now = Date.now();
  lines.forEach((line) => {
    serverLogs[name].push({ ts: now, type, message: line });
  });
  if (serverLogs[name].length > SERVER_LOG_LIMIT) {
    serverLogs[name].splice(0, serverLogs[name].length - SERVER_LOG_LIMIT);
  }
}

function getServerProcess(name) {
  if (name === 'llama') return llamaServerProcess;
  if (name === 'lan') return lanServerProcess;
  if (name === 'mcp') return mcpServerProcess;
  if (name === 'omchat') return omChatServerProcess;
  if (name === 'openwebui') return openWebUiProcess;
  return null;
}

function getServerStatusPayload(name) {
  const proc = getServerProcess(name);
  return {
    name,
    running: isServerProcessActive(proc),
    pid: proc?.pid || null,
    startedAt: serverStarts[name] || null,
    config: serverConfigs[name] || null
  };
}

function isServerProcessActive(proc) {
  return Boolean(
    proc
    && typeof proc.kill === 'function'
    && proc.pid
    && proc.killed !== true
    && proc.exitCode == null
  );
}

function createInProcessServerHandle(name) {
  return {
    pid: process.pid,
    killed: false,
    kill: () => {
      pushServerLog(name, 'info', 'Server handle closed.');
      return true;
    }
  };
}

function readStartupState() {
  try {
    return JSON.parse(fs.readFileSync(startupStatePath, 'utf8'));
  } catch (_) {
    return {};
  }
}

function writeStartupState(nextState) {
  try {
    fs.mkdirSync(path.dirname(startupStatePath), { recursive: true });
    fs.writeFileSync(startupStatePath, JSON.stringify(nextState, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.warn('[Startup] Failed to persist startup state:', error?.message || error);
    return false;
  }
}

function hasHandledFirewallRules(ports = []) {
  const state = readStartupState();
  const firewallState = state?.firewallRules;
  if (!firewallState || Number(firewallState.version) !== OMX_FIREWALL_RULE_STATE_VERSION) return false;
  const handledPorts = new Set((firewallState.ports || []).map((port) => Number(port)));
  return ports.every((port) => handledPorts.has(Number(port)));
}

function markFirewallRulesHandled(ports = [], metadata = {}) {
  const state = readStartupState();
  const existingPorts = Array.isArray(state?.firewallRules?.ports) ? state.firewallRules.ports : [];
  state.firewallRules = {
    version: OMX_FIREWALL_RULE_STATE_VERSION,
    platform: process.platform,
    ports: [...new Set(
      [...existingPorts, ...ports]
        .map((port) => Number(port))
        .filter((port) => Number.isFinite(port) && port > 0)
    )],
    handledAt: new Date().toISOString(),
    ...metadata
  };
  writeStartupState(state);
}

function getWindowsFirewallRuleArgs(port) {
  return [
    'advfirewall', 'firewall', 'add', 'rule',
    `name=OmApp-LAN-${port}`,
    'dir=in',
    'action=allow',
    'protocol=TCP',
    `localport=${port}`
  ];
}

function classifyWindowsFirewallResult(error, stdout = '', stderr = '') {
  const output = `${stdout}\n${stderr}\n${error?.message || ''}`;
  const alreadyExists = /already exists|cannot create a file when that file already exists/i.test(output);
  const requiresElevation = /requested operation requires elevation|access is denied/i.test(output);
  return {
    ok: !error || alreadyExists,
    alreadyExists,
    requiresElevation,
    output
  };
}

function addWindowsFirewallRule(port) {
  return new Promise((resolve) => {
    execFile(
      'netsh',
      getWindowsFirewallRuleArgs(port),
      { windowsHide: true },
      (error, stdout = '', stderr = '') => {
        resolve(classifyWindowsFirewallResult(error, stdout, stderr));
      }
    );
  });
}

function addWindowsFirewallRuleElevated(port) {
  return new Promise((resolve) => {
    const escapedArgs = getWindowsFirewallRuleArgs(port)
      .map((arg) => `'${String(arg).replace(/'/g, "''")}'`)
      .join(', ');
    const command = [
      `$argList = @(${escapedArgs})`,
      "$proc = Start-Process -FilePath 'netsh' -ArgumentList $argList -Verb RunAs -WindowStyle Hidden -Wait -PassThru",
      'exit $proc.ExitCode'
    ].join('; ');

    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-Command', command
      ],
      { windowsHide: true },
      (error, stdout = '', stderr = '') => {
        resolve(classifyWindowsFirewallResult(error, stdout, stderr));
      }
    );
  });
}

function ensureFirewallRules(ports = [OMX_LAN_DEFAULT_PORT, OMX_OMCHAT_DEFAULT_PORT]) {
  const normalizedPorts = [...new Set(
    ports
      .map((port) => Number(port))
      .filter((port) => Number.isFinite(port) && port > 0)
  )];

  if (!normalizedPorts.length || hasHandledFirewallRules(normalizedPorts)) {
    return false;
  }

  if (process.platform === 'win32') {
    normalizedPorts.forEach(async (port) => {
      const firstAttempt = await addWindowsFirewallRule(port);
      if (firstAttempt.ok) {
        markFirewallRulesHandled([port], { mode: process.platform });
        return;
      }

      if (firstAttempt.requiresElevation) {
        console.info(`[Firewall] Requesting Windows permission for LAN port ${port}.`);
        const elevatedAttempt = await addWindowsFirewallRuleElevated(port);
        if (elevatedAttempt.ok) {
          markFirewallRulesHandled([port], { mode: process.platform });
          return;
        }
        console.warn(`[Firewall] Elevated rule setup failed for port ${port}:`, elevatedAttempt.output.trim() || 'unknown error');
        return;
      }

      console.warn(`[Firewall] netsh rule setup failed for port ${port}:`, firstAttempt.output.trim() || 'unknown error');
    });
    return true;
  }

  if (process.platform === 'darwin') {
    markFirewallRulesHandled(normalizedPorts, { mode: process.platform });
    console.info('[Firewall] macOS will prompt for incoming connections when the LAN servers first listen.');
    return false;
  }

  markFirewallRulesHandled(normalizedPorts, { mode: process.platform });
  console.info('[Firewall] Skipping automatic firewall changes on this platform.');
  return false;
}

function getResolvedLanIp() {
  try {
    const omChatApi = getOmChatModuleSync();
    return String(omChatApi.getPrimaryNetworkIp?.() || '127.0.0.1');
  } catch (error) {
    console.warn('[Network] Failed to resolve LAN IP:', error?.message || error);
    return '127.0.0.1';
  }
}

function emitResolvedLanIp() {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('lan-ip-resolved', getResolvedLanIp());
  } catch (error) {
    console.warn('[Network] Failed to send LAN IP to renderer:', error?.message || error);
  }
}

function attachLanHostWindow(targetWindow = mainWindow) {
  try {
    if (!lanServerInstance || typeof lanServerInstance.setHostWindow !== 'function') return;
    if (!targetWindow || targetWindow.isDestroyed?.()) {
      lanServerInstance.setHostWindow(null);
      return;
    }
    lanServerInstance.setHostWindow(targetWindow);
  } catch (error) {
    console.warn('[LanServer] Failed to attach host window:', error?.message || error);
  }
}

function syncLanRuntimeState() {
  const status = lanServerInstance?.getStatus?.() || { isRunning: false, players: [], maxPlayers: null, serverInfo: null };
  if (!status.isRunning) {
    lanServerProcess = null;
    serverStarts.lan = null;
    serverConfigs.lan = null;
    return status;
  }

  lanServerProcess = lanServerProcess || createInProcessServerHandle('lan');
  serverStarts.lan = serverStarts.lan || Date.now();
  serverConfigs.lan = {
    host: '0.0.0.0',
    ip: status.serverInfo?.ip || null,
    port: status.serverInfo?.port || OMX_LAN_DEFAULT_PORT,
    url: status.serverInfo?.url || null,
    addresses: status.serverInfo?.addresses || []
  };
  return status;
}

function normalizeOmChatUrl(value) {
  const normalized = String(value || '').trim().replace(/[\/]+$/, '');
  return normalized ? `${normalized}/` : '';
}

async function listSiblingFilesForModel(modelPath) {
  const resolvedModelPath = path.resolve(String(modelPath || ''));
  if (!resolvedModelPath) return [];
  const modelDir = path.dirname(resolvedModelPath);
  const entries = await fs.promises.readdir(modelDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(modelDir, entry.name));
}

async function listFilesRecursive(rootDir) {
  const absRoot = path.resolve(String(rootDir || '').trim());
  if (!absRoot) return [];

  const results = [];
  const queue = [absRoot];

  while (queue.length) {
    const currentDir = queue.shift();
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

async function buildLlamaModelEntries(modelsPath) {
  const abs = path.resolve(String(modelsPath || '').trim());
  if (!abs) {
    throw new Error('Invalid models path.');
  }
  addTrustedFolderPath(abs);
  if (!isPathInSafeDirectories(abs)) {
    throw new Error('Access denied: Path outside allowed directories');
  }

  const allFiles = await listFilesRecursive(abs);

  return allFiles
    .filter((filePath) => /\.gguf$/i.test(filePath))
    .filter((filePath) => !/^mmproj[-_]?.+\.gguf$/i.test(path.basename(filePath)))
    .map((filePath) => {
      const modelDir = path.dirname(filePath);
      const siblingFiles = allFiles.filter((candidatePath) => path.dirname(candidatePath) === modelDir);
      const relativeName = path.relative(abs, filePath) || path.basename(filePath);
      const launch = prepareLlamaLaunch({
        modelPath: filePath,
        siblingFiles
      });
      return normalizeModelEntry({
        name: relativeName,
        path: filePath,
        type: launch.modelType,
        mmprojPath: launch.mmprojPath,
        supportsVision: launch.supportsVision,
        warnings: launch.warnings
      });
    });
}

function syncLlamaServerConfig(config = {}) {
  const requestedType = String(config.serverType || serverConfigs.llama?.serverType || '').trim().toLowerCase();
  const safeType = ['ngrok', 'lan', 'local'].includes(requestedType)
    ? requestedType
    : (String(config.host || serverConfigs.llama?.host || '127.0.0.1').trim() === '0.0.0.0' ? 'lan' : 'local');
  const safeHost = String(config.host || serverConfigs.llama?.host || (safeType === 'lan' ? '0.0.0.0' : '127.0.0.1')).trim()
    || (safeType === 'lan' ? '0.0.0.0' : '127.0.0.1');
  const safePort = Number(config.port || serverConfigs.llama?.port || 8080);
  const launchHost = ['0.0.0.0', '::'].includes(safeHost) ? '127.0.0.1' : safeHost;
  const localUrl = `http://${launchHost}:${safePort}`;
  const publicUrl = String(config.publicUrl ?? serverConfigs.llama?.publicUrl ?? '').trim();
  const url = normalizeOmChatUrl(publicUrl || localUrl);

  serverConfigs.llama = {
    ...(serverConfigs.llama || {}),
    executable: config.executable || serverConfigs.llama?.executable || null,
    modelPath: config.modelPath || serverConfigs.llama?.modelPath || null,
    modelType: config.modelType || serverConfigs.llama?.modelType || 'text',
    supportsVision: typeof config.supportsVision === 'boolean' ? config.supportsVision : Boolean(serverConfigs.llama?.supportsVision),
    mmprojPath: config.mmprojPath ?? serverConfigs.llama?.mmprojPath ?? null,
    warnings: Array.isArray(config.warnings) ? config.warnings : (serverConfigs.llama?.warnings || []),
    command: String(config.command || serverConfigs.llama?.command || ''),
    contextLength: String(config.contextLength || serverConfigs.llama?.contextLength || '4096'),
    gpuLayers: String(config.gpuLayers || serverConfigs.llama?.gpuLayers || '0'),
    kvCacheMode: String(config.kvCacheMode || serverConfigs.llama?.kvCacheMode || 'auto'),
    kvModeResolved: String(config.kvModeResolved || serverConfigs.llama?.kvModeResolved || 'q8'),
    cacheTypeK: String(config.cacheTypeK || serverConfigs.llama?.cacheTypeK || ''),
    cacheTypeV: String(config.cacheTypeV || serverConfigs.llama?.cacheTypeV || ''),
    estimatedKvCacheMB: Number(config.estimatedKvCacheMB || serverConfigs.llama?.estimatedKvCacheMB || 0),
    optimizationStatus: String(config.optimizationStatus || serverConfigs.llama?.optimizationStatus || ''),
    threads: String(config.threads || serverConfigs.llama?.threads || '4'),
    systemPrompt: String(config.systemPrompt ?? serverConfigs.llama?.systemPrompt ?? ''),
    guardSettings: normalizeLlamaGuardSettings(config.guardSettings || serverConfigs.llama?.guardSettings || {}),
    serverType: safeType,
    host: safeHost,
    launchHost,
    port: safePort,
    localUrl,
    publicUrl: publicUrl || null,
    url
  };

  return serverConfigs.llama;
}

async function getLlamaStatusPayload() {
  const config = serverConfigs.llama || null;
  const readinessHost = config?.launchHost || config?.host || '127.0.0.1';
  const ready = isServerProcessActive(llamaServerProcess) && readinessHost && config?.port
    ? await checkTcpPort(readinessHost, config.port)
    : false;

  return {
    name: 'llama',
    starting: llamaServerStartInProgress,
    running: isServerProcessActive(llamaServerProcess) && ready,
    ready,
    pid: llamaServerProcess?.pid || null,
    tunnelPid: llamaNgrokProcess?.pid || null,
    ngrokRunning: isServerProcessActive(llamaNgrokProcess),
    startedAt: serverStarts.llama || null,
    config,
    guard: {
      ...llamaMemoryGuardState,
      settings: normalizeLlamaGuardSettings(config?.guardSettings || {}),
      lastSample: llamaMemoryGuardState.lastSample || sampleLlamaMemoryGuard()
    }
  };
}

function clearLlamaPublicUrl() {
  if (!serverConfigs.llama) return;
  const localUrl = serverConfigs.llama.localUrl || `http://${serverConfigs.llama.launchHost || '127.0.0.1'}:${serverConfigs.llama.port || 8080}`;
  serverConfigs.llama.publicUrl = null;
  serverConfigs.llama.url = normalizeOmChatUrl(localUrl);
}

async function ensureLlamaNgrokTunnel(config = {}) {
  const helper = loadOmChatNgrokHelper();
  const port = Number(config.port || serverConfigs.llama?.port || 8080);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Invalid llama port for ngrok tunnel.');
  }

  if (isServerProcessActive(llamaNgrokProcess)) {
    return serverConfigs.llama?.publicUrl || '';
  }

  const settings = helper.resolveNgrokSettings(process.env);
  const existingPublicUrl = await helper.fetchNgrokPublicUrl?.({
    apiUrl: settings.apiUrl,
    port,
    requirePortMatch: true
  }).catch(() => '') || '';

  if (existingPublicUrl) {
    syncLlamaServerConfig({
      port,
      publicUrl: existingPublicUrl,
      serverType: 'ngrok'
    });
    pushServerLog('llama', 'info', `Reusing existing ngrok tunnel: ${existingPublicUrl}`);
    return existingPublicUrl;
  }

  const child = helper.startNgrokProcess({
    port,
    cwd: (process.resourcesPath && require('fs').existsSync(process.resourcesPath) ? process.resourcesPath : OMX_OMCHAT_ROOT),
    settings,
    onLog: (label, message) => pushServerLog('llama', label === 'err' ? 'error' : 'info', `[ngrok:${label}] ${message}`)
  });

  pushServerLog('llama', 'info', `Starting ngrok via ${child.omxCommandLabel || settings.bin}`);

  let publicUrl = '';
  try {
    publicUrl = await helper.discoverNgrokPublicUrl({ child, settings, port, requirePortMatch: true });
  } catch (error) {
    await helper.stopNgrokProcess(child).catch(() => {});
    clearLlamaPublicUrl();
    throw error;
  }

  if (!publicUrl) {
    await helper.stopNgrokProcess(child).catch(() => {});
    clearLlamaPublicUrl();
    throw new Error(`ngrok tunnel was not discovered. Checked ${settings.apiUrl}`);
  }

  llamaNgrokProcess = child;
  child.once('error', async (error) => {
    if (llamaNgrokProcess !== child) return;
    pushServerLog('llama', 'error', `Llama ngrok failed: ${error?.message || error}`);
    llamaNgrokProcess = null;
    clearLlamaPublicUrl();
  });
  child.once('exit', async (code, signal) => {
    if (llamaNgrokProcess !== child) return;
    if (helper.isNgrokAlreadyOnline?.(child)) {
      llamaNgrokProcess = null;
      pushServerLog('llama', 'info', 'Reusing the already-running ngrok endpoint.');
      return;
    }
    llamaNgrokProcess = null;
    clearLlamaPublicUrl();
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    pushServerLog('llama', child.omxManualStop ? 'info' : 'error', child.omxManualStop ? 'Llama ngrok tunnel stopped.' : `Llama ngrok tunnel exited (${reason}).`);
  });

  syncLlamaServerConfig({
    port,
    publicUrl,
    serverType: 'ngrok'
  });
  pushServerLog('llama', 'success', `Llama public URL: ${publicUrl}`);
  return publicUrl;
}

async function stopLlamaNgrokTunnelInternal() {
  if (!isServerProcessActive(llamaNgrokProcess)) {
    clearLlamaPublicUrl();
    return false;
  }

  const helper = loadOmChatNgrokHelper();
  const child = llamaNgrokProcess;
  llamaNgrokProcess = null;
  child.omxManualStop = true;
  await helper.stopNgrokProcess(child).catch(() => {});
  clearLlamaPublicUrl();
  pushServerLog('llama', 'info', 'Llama ngrok tunnel stopped.');
  return true;
}

function syncOmChatServerConfig({ host, port, accessInfo }) {
  const safeHost = String(host || serverConfigs.omchat?.host || '0.0.0.0').trim() || '0.0.0.0';
  const safePort = Number(port || serverConfigs.omchat?.port || OMX_OMCHAT_DEFAULT_PORT);
  const nextAccessInfo = accessInfo || serverConfigs.omchat?.accessInfo || {};
  const launchHost = nextAccessInfo.localHost || (['0.0.0.0', '::'].includes(safeHost) ? 'localhost' : safeHost);
  const localUrl = nextAccessInfo.localUrl || serverConfigs.omchat?.localUrl || `http://${launchHost}:${safePort}`;
  const publicUrl = nextAccessInfo.publicUrl || null;

  serverConfigs.omchat = {
    ...(serverConfigs.omchat || {}),
    host: safeHost,
    launchHost,
    port: safePort,
    url: normalizeOmChatUrl(publicUrl || localUrl),
    localUrl,
    publicUrl,
    networkUrl: nextAccessInfo.networkUrl || null,
    addresses: nextAccessInfo.addresses || [],
    accessInfo: nextAccessInfo
  };

  return serverConfigs.omchat;
}

function buildOmChatStartPayload(runtimeStatus, fallback = {}) {
  const accessInfo = runtimeStatus?.accessInfo || fallback.accessInfo || serverConfigs.omchat?.accessInfo || null;
  const host = String(fallback.host || runtimeStatus?.host || serverConfigs.omchat?.host || '0.0.0.0').trim() || '0.0.0.0';
  const port = Number(fallback.port || runtimeStatus?.port || serverConfigs.omchat?.port || OMX_OMCHAT_DEFAULT_PORT);
  const config = syncOmChatServerConfig({ host, port, accessInfo });

  return {
    success: true,
    alreadyRunning: Boolean(fallback.alreadyRunning),
    pid: omChatServerProcess?.pid || null,
    tunnelPid: omChatNgrokProcess?.pid || null,
    host,
    launchHost: config.launchHost,
    port,
    url: config.url,
    localUrl: config.localUrl,
    networkUrl: config.networkUrl,
    publicUrl: config.publicUrl || null,
    addresses: config.addresses,
    accessInfo: config.accessInfo,
    ngrokRunning: isServerProcessActive(omChatNgrokProcess)
  };
}

async function clearOmChatPublicBaseUrl() {
  try {
    const moduleRef = await loadOmChatModule();
    const omChatApi = moduleRef?.default || moduleRef;
    const status = omChatApi.setPublicBaseUrl?.('') || omChatApi.getStatus?.() || null;
    const accessInfo = status?.accessInfo || serverConfigs.omchat?.accessInfo || null;
    if (serverConfigs.omchat) {
      syncOmChatServerConfig({
        host: serverConfigs.omchat.host,
        port: serverConfigs.omchat.port,
        accessInfo
      });
    }
    return status;
  } catch (_) {
    if (serverConfigs.omchat) {
      serverConfigs.omchat.publicUrl = null;
      serverConfigs.omchat.url = normalizeOmChatUrl(serverConfigs.omchat.localUrl);
    }
    return null;
  }
}

async function ensureOmChatNgrokTunnel(config = {}, runtimeStatus = null) {
  const helper = loadOmChatNgrokHelper();
  const status = runtimeStatus || (await getOmChatStatusPayload());
  const port = Number(status?.port || serverConfigs.omchat?.port || config.port || OMX_OMCHAT_DEFAULT_PORT);
  const host = String(status?.host || serverConfigs.omchat?.host || config.host || '0.0.0.0').trim() || '0.0.0.0';

  if (isServerProcessActive(omChatNgrokProcess)) {
    return buildOmChatStartPayload(status, { host, port });
  }

  const settings = helper.resolveNgrokSettings(process.env);
  const existingPublicUrl = await helper.fetchNgrokPublicUrl?.({
    apiUrl: settings.apiUrl,
    port,
    requirePortMatch: true
  }).catch(() => '') || '';

  if (existingPublicUrl) {
    const moduleRef = await loadOmChatModule();
    const omChatApi = moduleRef?.default || moduleRef;
    const updatedStatus = omChatApi.setPublicBaseUrl?.(existingPublicUrl) || omChatApi.getStatus?.() || status;
    syncOmChatServerConfig({ host, port, accessInfo: updatedStatus?.accessInfo || status?.accessInfo || null });
    pushServerLog('omchat', 'info', `Reusing existing ngrok tunnel: ${updatedStatus?.accessInfo?.publicUrl || existingPublicUrl}`);
    return buildOmChatStartPayload(updatedStatus, { host, port });
  }

  const child = helper.startNgrokProcess({
    port,
    cwd: (process.resourcesPath && require('fs').existsSync(process.resourcesPath) ? process.resourcesPath : OMX_OMCHAT_ROOT),
    settings,
    onLog: (label, message) => pushServerLog('omchat', label === 'err' ? 'error' : 'info', `[ngrok:${label}] ${message}`)
  });

  pushServerLog('omchat', 'info', `Starting ngrok via ${child.omxCommandLabel || settings.bin}`);

  let publicUrl = '';
  try {
    publicUrl = await helper.discoverNgrokPublicUrl({ child, settings, port, requirePortMatch: true });
  } catch (error) {
    await helper.stopNgrokProcess(child).catch(() => {});
    await clearOmChatPublicBaseUrl();
    throw error;
  }

  if (!publicUrl) {
    await helper.stopNgrokProcess(child).catch(() => {});
    await clearOmChatPublicBaseUrl();
    throw new Error(`ngrok tunnel was not discovered. Checked ${settings.apiUrl}`);
  }

  omChatNgrokProcess = child;
  child.once('error', async (error) => {
    if (omChatNgrokProcess !== child) return;
    pushServerLog('omchat', 'error', `Om Chat ngrok failed: ${error?.message || error}`);
    omChatNgrokProcess = null;
    await clearOmChatPublicBaseUrl();
  });
  child.once('exit', async (code, signal) => {
    if (omChatNgrokProcess !== child) return;
    if (helper.isNgrokAlreadyOnline?.(child)) {
      omChatNgrokProcess = null;
      pushServerLog('omchat', 'info', 'Reusing the already-running ngrok endpoint.');
      return;
    }
    omChatNgrokProcess = null;
    await clearOmChatPublicBaseUrl();
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    pushServerLog('omchat', child.omxManualStop ? 'info' : 'error', child.omxManualStop ? 'Om Chat ngrok tunnel stopped.' : `Om Chat ngrok tunnel exited (${reason}).`);
  });

  const moduleRef = await loadOmChatModule();
  const omChatApi = moduleRef?.default || moduleRef;
  const updatedStatus = omChatApi.setPublicBaseUrl?.(publicUrl) || omChatApi.getStatus?.() || status;
  syncOmChatServerConfig({ host, port, accessInfo: updatedStatus?.accessInfo || status?.accessInfo || null });
  pushServerLog('omchat', 'success', `Om Chat public URL: ${updatedStatus?.accessInfo?.publicUrl || publicUrl}`);
  return buildOmChatStartPayload(updatedStatus, { host, port });
}

async function stopOmChatNgrokTunnelInternal() {
  if (!isServerProcessActive(omChatNgrokProcess)) {
    await clearOmChatPublicBaseUrl();
    return false;
  }

  const helper = loadOmChatNgrokHelper();
  const child = omChatNgrokProcess;
  omChatNgrokProcess = null;
  child.omxManualStop = true;
  await helper.stopNgrokProcess(child).catch(() => {});
  await clearOmChatPublicBaseUrl();
  pushServerLog('omchat', 'info', 'Om Chat ngrok tunnel stopped.');
  return true;
}

async function getOmChatStatusPayload() {
  try {
    const omChatApi = getOmChatModuleSync();
    const runtimeStatus = omChatApi?.getStatus?.() || {
      isRunning: false,
      host: null,
      port: null,
      accessInfo: null
    };

    if (runtimeStatus?.accessInfo) {
      syncOmChatServerConfig({
        host: runtimeStatus.host || serverConfigs.omchat?.host || '0.0.0.0',
        port: runtimeStatus.port || serverConfigs.omchat?.port || OMX_OMCHAT_DEFAULT_PORT,
        accessInfo: runtimeStatus.accessInfo
      });
    }

    const readinessHost = runtimeStatus?.accessInfo?.localHost || serverConfigs.omchat?.launchHost || runtimeStatus?.host;
    const ready = runtimeStatus?.isRunning && readinessHost && runtimeStatus?.port
      ? await checkTcpPort(readinessHost, runtimeStatus.port)
      : false;

    if (!ready && isBackgroundServerRunning()) {
      const bgUrl = getBackgroundServerUrl();
      if (bgUrl) {
        return {
          isRunning: true,
          ready: true,
          pid: null,
          tunnelPid: null,
          ngrokRunning: false,
          startedAt: serverStarts.omchat || null,
          config: serverConfigs.omchat || null,
          alwaysOnBackground: true
        };
      }
    }

    return {
      ...runtimeStatus,
      isRunning: Boolean(runtimeStatus?.isRunning) && ready,
      ready,
      pid: omChatServerProcess?.pid || null,
      tunnelPid: omChatNgrokProcess?.pid || null,
      ngrokRunning: isServerProcessActive(omChatNgrokProcess),
      startedAt: serverStarts.omchat || null,
      config: serverConfigs.omchat || null
    };
  } catch (error) {
    if (isBackgroundServerRunning()) {
      const bgUrl = getBackgroundServerUrl();
      if (bgUrl) {
        return {
          isRunning: true,
          ready: true,
          pid: null,
          tunnelPid: null,
          ngrokRunning: false,
          startedAt: serverStarts.omchat || null,
          config: serverConfigs.omchat || null,
          alwaysOnBackground: true
        };
      }
    }
    return {
      isRunning: false,
      ready: false,
      pid: null,
      tunnelPid: omChatNgrokProcess?.pid || null,
      ngrokRunning: isServerProcessActive(omChatNgrokProcess),
      startedAt: serverStarts.omchat || null,
      config: serverConfigs.omchat || null,
      error: error?.message || 'Om Chat status unavailable.'
    };
  }
}

function getLanStatusPayload() {
  const status = syncLanRuntimeState();
  return {
    ...status,
    ready: Boolean(status?.isRunning),
    pid: lanServerProcess?.pid || null,
    startedAt: serverStarts.lan || null,
    config: serverConfigs.lan || null
  };
}

function isBackgroundServerRunning() {
  try {
    if (!fs.existsSync(OMX_OMCHAT_BG_PID_FILE)) return false;
    const pid = Number(fs.readFileSync(OMX_OMCHAT_BG_PID_FILE, 'utf-8').trim());
    if (!pid || Number.isNaN(pid)) return false;
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function readMcpBackgroundConfig() {
  try {
    if (!fs.existsSync(OMX_MCP_BG_CONFIG_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(OMX_MCP_BG_CONFIG_FILE, 'utf-8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      host: String(parsed.host || '127.0.0.1').trim() || '127.0.0.1',
      port: Number(parsed.port || 3000) || 3000,
      enabledTools: (parsed.enabledTools && typeof parsed.enabledTools === 'object') ? parsed.enabledTools : {}
    };
  } catch (_) {
    return null;
  }
}

function writeMcpBackgroundMetadata(pid, config = {}) {
  try {
    fs.writeFileSync(OMX_MCP_BG_PID_FILE, String(pid || '').trim(), 'utf-8');
    fs.writeFileSync(OMX_MCP_BG_CONFIG_FILE, JSON.stringify({
      host: String(config.host || '127.0.0.1').trim() || '127.0.0.1',
      port: Number(config.port || 3000) || 3000,
      enabledTools: (config.enabledTools && typeof config.enabledTools === 'object') ? config.enabledTools : {}
    }, null, 2), 'utf-8');
  } catch (_) {}
}

function clearMcpBackgroundMetadata() {
  try { if (fs.existsSync(OMX_MCP_BG_PID_FILE)) fs.unlinkSync(OMX_MCP_BG_PID_FILE); } catch (_) {}
  try { if (fs.existsSync(OMX_MCP_BG_CONFIG_FILE)) fs.unlinkSync(OMX_MCP_BG_CONFIG_FILE); } catch (_) {}
}

function isMcpBackgroundRunning() {
  try {
    if (!fs.existsSync(OMX_MCP_BG_PID_FILE)) return false;
    const pid = Number(fs.readFileSync(OMX_MCP_BG_PID_FILE, 'utf-8').trim());
    if (!pid || Number.isNaN(pid)) return false;
    process.kill(pid, 0);
    return true;
  } catch (_) {
    clearMcpBackgroundMetadata();
    return false;
  }
}

async function stopMcpBackground() {
  try {
    if (!fs.existsSync(OMX_MCP_BG_PID_FILE)) {
      clearMcpBackgroundMetadata();
      return false;
    }
    const pid = Number(fs.readFileSync(OMX_MCP_BG_PID_FILE, 'utf-8').trim());
    if (pid && !Number.isNaN(pid)) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch (_) {
        if (process.platform === 'win32') {
          await execFileAsync('taskkill', ['/pid', String(pid), '/T', '/F'], { timeout: 15000 });
        }
      }
    }
  } catch (_) {}
  clearMcpBackgroundMetadata();
  return true;
}

function resolveMcpEnabledTools(inputTools = {}) {
  return {
    wiki: inputTools?.wiki !== false,
    webSearch: inputTools?.webSearch !== false,
    duckduckgo: inputTools?.duckduckgo !== false,
    tavily: inputTools?.tavily !== false,
    news: inputTools?.news !== false,
    diagramGeneration: inputTools?.diagram === false ? false : inputTools?.diagramGeneration !== false,
    diagramModification: inputTools?.diagram === false ? false : inputTools?.diagramModification !== false,
    diagramValidation: inputTools?.diagram === false ? false : inputTools?.diagramValidation !== false,
    diagramLayout: inputTools?.diagram === false ? false : inputTools?.diagramLayout !== false,
    diagramAnalysis: inputTools?.diagram === false ? false : inputTools?.diagramAnalysis !== false,
    diagramUtilities: inputTools?.diagram === false ? false : inputTools?.diagramUtilities !== false
  };
}

function resolveMcpLlmConfig(settings = cachedSettings || DEFAULT_SETTINGS) {
  const runtimeSettings = settings || DEFAULT_SETTINGS;
  const activeProvider = String(runtimeSettings?.activeProvider || runtimeSettings?.llm?.provider || 'google').trim() || 'google';
  const providerConfig = runtimeSettings?.providers?.[activeProvider] || {};
  const llmBaseUrl = String(
    providerConfig?.baseUrl
    || (activeProvider === 'openai-compatible' ? runtimeSettings?.aiConfig?.openaiCompatible?.baseUrl : '')
    || ''
  ).trim();
  const llmModel = String(
    providerConfig?.model
    || runtimeSettings?.llm?.model
    || getSharedLlmModelForProvider(activeProvider)
    || ''
  ).trim();
  const llmApiKey = String(
    providerConfig?.key
    || runtimeSettings?.llm?.key
    || getSharedLlmApiKeyFromEnv(activeProvider)
    || ''
  ).trim();

  return {
    provider: activeProvider,
    baseUrl: llmBaseUrl,
    apiKey: llmApiKey,
    model: llmModel
  };
}

function buildMcpRuntimeConfig(config = {}) {
  const existingConfig = serverConfigs.mcp || {};
  const host = String(config.host || existingConfig.host || '127.0.0.1').trim() || '127.0.0.1';
  const rawPort = Number(config.port || existingConfig.port || 3000);
  const port = Number.isFinite(rawPort) ? Math.min(65535, Math.max(1, Math.round(rawPort))) : 3000;
  const enabledTools = resolveMcpEnabledTools(config?.enabledTools || existingConfig?.enabledTools || {});
  return { host, port, enabledTools };
}

function stripKvCacheArgs(args = []) {
  const cleaned = [];
  for (let i = 0; i < args.length; i += 1) {
    const current = String(args[i] || '');
    if (current === '--cache-type-k' || current === '--cache-type-v') {
      i += 1;
      continue;
    }
    cleaned.push(args[i]);
  }
  return cleaned;
}

async function startMcpBackground(config = {}) {
  const host = String(config.host || '127.0.0.1').trim() || '127.0.0.1';
  const rawPort = Number(config.port || 3000);
  const port = Number.isFinite(rawPort) ? Math.min(65535, Math.max(1, Math.round(rawPort))) : 3000;
  const enabledTools = resolveMcpEnabledTools(config.enabledTools || {});

  if (!fs.existsSync(OMX_MCP_BOOTSTRAP)) {
    return { success: false, error: 'MCP bootstrap entry not found.' };
  }

  if (isMcpBackgroundRunning()) {
    const bgConfig = readMcpBackgroundConfig();
    return {
      success: true,
      alreadyRunning: true,
      host: String(bgConfig?.host || host).trim() || host,
      port: Number(bgConfig?.port || port) || port,
      enabledTools: bgConfig?.enabledTools || enabledTools
    };
  }

  clearMcpBackgroundMetadata();

  const webApiKeys = getScraperWebApiKeysFromEnv();
  const llm = resolveMcpLlmConfig();
  const childEnv = {
    ...process.env,
    MCP_SERVER_OPTIONS: JSON.stringify({
      host,
      port,
      enabledTools,
      apiKeys: {
        serpApiKey: webApiKeys.serpapi,
        tavilyApiKey: webApiKeys.tavily,
        newsApiKey: webApiKeys.newsapi
      },
      llm
    })
  };

  return await new Promise((resolve) => {
    let settled = false;
    const child = spawn(process.execPath, [OMX_MCP_BOOTSTRAP, 'mcp'], {
      detached: true,
      stdio: 'ignore',
      cwd: OMX_APP_ROOT,
      env: childEnv
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.once('error', (error) => {
      clearMcpBackgroundMetadata();
      finish({ success: false, error: error?.message || 'Failed to spawn MCP background server.' });
    });

    const waitStart = Date.now();
    const timeoutMs = 15000;
    const pollReady = async () => {
      if (settled) return;
      const ready = await checkTcpPort(host, port, 900);
      if (ready) {
        writeMcpBackgroundMetadata(child.pid, { host, port, enabledTools });
        child.unref();
        finish({ success: true, host, port, enabledTools, pid: child.pid, alwaysOnBackground: true });
        return;
      }

      const hasExited = child.exitCode != null || child.signalCode != null;
      if (hasExited) {
        clearMcpBackgroundMetadata();
        finish({ success: false, error: 'MCP background process exited before server became ready.' });
        return;
      }

      if ((Date.now() - waitStart) >= timeoutMs) {
        clearMcpBackgroundMetadata();
        try {
          process.kill(child.pid, 'SIGTERM');
        } catch (_) {}
        finish({ success: false, error: `MCP server did not become ready at http://${host}:${port}/mcp` });
        return;
      }

      setTimeout(() => { void pollReady(); }, 400);
    };

    void pollReady();
  });
}

function getBackgroundServerUrl() {
  try {
    if (fs.existsSync(OMX_OMCHAT_BG_URL_FILE)) {
      return fs.readFileSync(OMX_OMCHAT_BG_URL_FILE, 'utf-8').trim() || '';
    }
  } catch (_) {}
  return '';
}

function cleanupBackgroundFiles() {
  try { if (fs.existsSync(OMX_OMCHAT_BG_PID_FILE)) fs.unlinkSync(OMX_OMCHAT_BG_PID_FILE); } catch (_) {}
  try { if (fs.existsSync(OMX_OMCHAT_BG_URL_FILE)) fs.unlinkSync(OMX_OMCHAT_BG_URL_FILE); } catch (_) {}
  const ngrokPidPath = path.resolve(OMX_OMCHAT_ROOT, '.background-ngrok.pid');
  try { if (fs.existsSync(ngrokPidPath)) fs.unlinkSync(ngrokPidPath); } catch (_) {}
}

function killBackgroundServer() {
  try {
    if (fs.existsSync(OMX_OMCHAT_BG_PID_FILE)) {
      const pid = Number(fs.readFileSync(OMX_OMCHAT_BG_PID_FILE, 'utf-8').trim());
      if (pid && !Number.isNaN(pid)) {
        try { process.kill(pid, 'SIGTERM'); } catch (_) {}
      }
    }
    const ngrokPidPath = path.resolve(OMX_OMCHAT_ROOT, '.background-ngrok.pid');
    if (fs.existsSync(ngrokPidPath)) {
      const ngrokPid = Number(fs.readFileSync(ngrokPidPath, 'utf-8').trim());
      if (ngrokPid && !Number.isNaN(ngrokPid)) {
        try { process.kill(ngrokPid, 'SIGTERM'); } catch (_) {}
      }
    }
    cleanupBackgroundFiles();
    return true;
  } catch (_) {
    cleanupBackgroundFiles();
    return false;
  }
}

async function startOmChatBackground(config = {}) {
  const port = Number(config.port || OMX_OMCHAT_DEFAULT_PORT);
  const host = String(config.host || '0.0.0.0').trim() || '0.0.0.0';
  const useNgrok = config.useNgrok === true;
  const omchatSettings = cachedSettings?.omchat || {};

  if (!fs.existsSync(OMX_OMCHAT_BG_LAUNCHER)) {
    return { success: false, error: 'Background launcher not found.' };
  }

  if (isBackgroundServerRunning()) {
    const url = getBackgroundServerUrl();
    return { success: true, url, alreadyRunning: true };
  }

  cleanupBackgroundFiles();

  const bgConfig = JSON.stringify({
    port,
    host,
    useNgrok,
    localDbPath: omchatSettings.localDbPath || '',
    sessionSecret: process.env.OMX_OMCHAT_SESSION_SECRET || 'omx-omchat-dev-secret'
  });

  const bgEnv = {
    ...process.env,
    DB_MODE: 'local',
    LOCAL_DB_PATH: omchatSettings.localDbPath || '',
    TRUST_PROXY: useNgrok ? '1' : '0'
  };

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [OMX_OMCHAT_BG_LAUNCHER, bgConfig], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      cwd: OMX_OMCHAT_ROOT,
      env: bgEnv
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { child.disconnect(); } catch (_) {}
        if (isBackgroundServerRunning()) {
          const url = getBackgroundServerUrl();
          resolve({ success: true, url, delayed: true });
        } else {
          resolve({ success: false, error: 'Background server timed out.' });
        }
      }
    }, useNgrok ? 30000 : 15000);

    child.on('message', (msg) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      try { child.disconnect(); } catch (_) {}
      if (msg?.success) {
        omChatBackgroundProcess = child;
        resolve({ success: true, url: msg.url });
      } else {
        resolve({ success: false, error: msg?.error || 'Failed to start background server.' });
      }
    });

    child.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ success: false, error: err?.message || 'Failed to spawn background server.' });
    });

    child.unref();
  });
}

async function startOmChatServerInternal(config = {}) {
  invalidateServerStatusCache('omchat');
  const existingConfig = serverConfigs.omchat || {};
  const port = Number(config.port || existingConfig.port || OMX_OMCHAT_DEFAULT_PORT);
  const host = String(config.host || existingConfig.host || '0.0.0.0').trim() || '0.0.0.0';
  const preferredUseNgrok = !Boolean(cachedSettings?.omchat?.useLocalIpOnly);
  const useNgrok = Object.prototype.hasOwnProperty.call(config, 'useNgrok')
    ? config.useNgrok === true
    : preferredUseNgrok;
  const alwaysOn = Boolean(cachedSettings?.omchat?.alwaysOn);

  if (!fs.existsSync(OMX_OMCHAT_ENTRY)) {
    return { success: false, error: 'Om Chat server entry not found.' };
  }

  if (alwaysOn) {
    if (isBackgroundServerRunning()) {
      const url = getBackgroundServerUrl();
      if (url) {
        serverStarts.omchat = serverStarts.omchat || Date.now();
        syncOmChatServerConfig({ host, port, accessInfo: null });
        return { success: true, url, alreadyRunning: true, alwaysOn: true, publicUrl: url };
      }
    }
    pushServerLog(
      'omchat',
      'info',
      `Starting OmChat in background mode (Always On${useNgrok ? ' with ngrok' : ' local-only'})...`
    );
    const result = await startOmChatBackground({ port, host, useNgrok });
    if (result?.success) {
      serverStarts.omchat = Date.now();
      syncOmChatServerConfig({ host, port, accessInfo: null });
      pushServerLog('omchat', 'success', `OmChat background server running at ${result.url || 'http://localhost:' + port}`);
    }
    return { ...result, alwaysOn: true };
  }

  if (!isServerProcessActive(omChatServerProcess) && isServerProcessActive(omChatNgrokProcess)) {
    await stopOmChatNgrokTunnelInternal().catch(() => {});
  }

  if (useNgrok && !process.env.TRUST_PROXY) {
    process.env.TRUST_PROXY = '1';
  } else if (!useNgrok) {
    process.env.TRUST_PROXY = '0';
  }

  if (isServerProcessActive(omChatServerProcess)) {
    const currentStatus = await getOmChatStatusPayload();
    if (!useNgrok && isServerProcessActive(omChatNgrokProcess)) {
      await stopOmChatNgrokTunnelInternal().catch(() => {});
    }
    if (useNgrok) {
      try {
        return await ensureOmChatNgrokTunnel({ ...config, host, port }, currentStatus);
      } catch (error) {
        return {
          ...buildOmChatStartPayload(currentStatus, { host, port, alreadyRunning: true }),
          success: false,
          error: error?.message || 'Failed to start ngrok tunnel.',
          tunnelError: error?.message || 'Failed to start ngrok tunnel.',
          alreadyRunning: true
        };
      }
    }
    return buildOmChatStartPayload(currentStatus, { host, port, alreadyRunning: true });
  }

  try {
    // Configure DB mode from settings - MUST be set BEFORE loading OmChat module
    const omchatSettings = cachedSettings?.omchat || {};
    process.env.DB_MODE = 'local';
    if (omchatSettings.localDbPath) {
      process.env.LOCAL_DB_PATH = omchatSettings.localDbPath;
    }
    const dbInfo = 'Using local DB' + (omchatSettings.localDbPath ? ' at ' + omchatSettings.localDbPath : ' (default location)');
    pushServerLog('omchat', 'info', dbInfo);
    if (!useNgrok) {
      await clearOmChatPublicBaseUrl().catch(() => {});
    }

    const moduleRef = await loadOmChatModule();
    const omChatApi = moduleRef?.default || moduleRef;
    const status = await omChatApi.startServer({
      host,
      port,
      trustProxy: useNgrok ? 1 : undefined,
      sessionSecret: String(config.sessionSecret || process.env.OMX_OMCHAT_SESSION_SECRET || 'omx-omchat-dev-secret')
    });

    omChatServerProcess = createInProcessServerHandle('omchat');
    serverStarts.omchat = Date.now();
    syncOmChatServerConfig({ host, port, accessInfo: status?.accessInfo || null });

    ensureFirewallRules([port]);
    pushServerLog('omchat', 'success', `Om Chat server listening at ${serverConfigs.omchat.localUrl}`);
    if (serverConfigs.omchat.networkUrl) {
      pushServerLog('omchat', 'info', `Om Chat LAN URL: ${serverConfigs.omchat.networkUrl}`);
    }
    emitResolvedLanIp();

    if (useNgrok) {
      try {
        return await ensureOmChatNgrokTunnel({ ...config, host, port }, status);
      } catch (error) {
        try {
          await stopOmChatServerInternal();
        } catch (_) {}
        return {
          success: false,
          error: error?.message || 'Failed to start ngrok tunnel.',
          tunnelError: error?.message || 'Failed to start ngrok tunnel.'
        };
      }
    }

    return buildOmChatStartPayload(status, { host, port });
  } catch (error) {
    await stopOmChatNgrokTunnelInternal().catch(() => {});
    omChatServerProcess = null;
    serverStarts.omchat = null;
    serverConfigs.omchat = null;
    pushServerLog('omchat', 'error', error?.stack || error?.message || String(error));
    return { success: false, error: error?.message || 'Failed to start Om Chat server.' };
  }
}

async function stopOmChatServerInternal() {
  invalidateServerStatusCache('omchat');

  if (isBackgroundServerRunning() && !isServerProcessActive(omChatServerProcess)) {
    killBackgroundServer();
    serverStarts.omchat = null;
    serverConfigs.omchat = null;
    emitResolvedLanIp();
    return { success: true };
  }

  if (!isServerProcessActive(omChatServerProcess)) {
    await stopOmChatNgrokTunnelInternal().catch(() => {});
    return { success: false, error: 'Om Chat server is not running.' };
  }

  await stopOmChatNgrokTunnelInternal().catch(() => {});

  try {
    const moduleRef = await loadOmChatModule();
    const omChatApi = moduleRef?.default || moduleRef;
    await omChatApi.stopServer();
    omChatServerProcess.kill();
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to stop Om Chat server.' };
  }

  omChatServerProcess = null;
  serverStarts.omchat = null;
  serverConfigs.omchat = null;
  emitResolvedLanIp();
  return { success: true };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkTcpPort(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (_) {}
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    try {
      socket.connect(Number(port), String(host || '127.0.0.1'));
    } catch (_) {
      finish(false);
    }
  });
}

async function waitForServerReady({
  host,
  port,
  proc,
  timeoutMs = 10000,
  getLastActivityTime = null,
  idleGraceMs = 0,
  maxTimeoutMs = timeoutMs
}) {
  const startedAt = Date.now();
  while (true) {
    if (!isServerProcessActive(proc)) return false;
    if (await checkTcpPort(host, port)) return true;
    const now = Date.now();
    if ((now - startedAt) >= maxTimeoutMs) return false;
    if ((now - startedAt) >= timeoutMs) {
      const lastActivityTime = typeof getLastActivityTime === 'function'
        ? Number(getLastActivityTime())
        : Number.NaN;
      const idleForMs = Number.isFinite(lastActivityTime)
        ? (now - lastActivityTime)
        : Number.POSITIVE_INFINITY;
      if (!idleGraceMs || idleForMs >= idleGraceMs) return false;
    }
    await wait(200);
  }
}

function clearLlamaMemoryGuard() {
  if (llamaMemoryGuardInterval) {
    clearInterval(llamaMemoryGuardInterval);
    llamaMemoryGuardInterval = null;
  }
  llamaMemoryGuardState.criticalHits = 0;
  llamaMemoryGuardState.isDraining = false;
  llamaMemoryGuardState.drainStartedAt = 0;
  if (llamaMemoryGuardState.pressure !== 'tripped') {
    llamaMemoryGuardState.pressure = isServerProcessActive(llamaServerProcess) ? 'safe' : 'idle';
  }
  invalidateServerStatusCache('llama');
}

async function forceStopLlamaServer(reason = 'Llama server stopped.') {
  if (!isServerProcessActive(llamaServerProcess)) return;
  pushServerLog('llama', 'error', reason);
  mainWindow?.webContents?.send('llama-server-output', { type: 'error', data: `${reason}\n` });
  llamaMemoryGuardState.pressure = 'tripped';
  llamaMemoryGuardState.lastAction = reason;
  llamaMemoryGuardState.lastTriggeredAt = Date.now();
  invalidateServerStatusCache('llama');
  clearLlamaMemoryGuard();
  const proc = llamaServerProcess;
  await terminateManagedChildProcess(proc);
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeLlamaGuardSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const enabledRaw = String(source.enabled ?? LLAMA_GUARD_DEFAULTS.enabled).trim().toLowerCase();
  const enabled = enabledRaw === 'false' || enabledRaw === 'disabled' || enabledRaw === '0'
    ? false
    : Boolean(source.enabled ?? LLAMA_GUARD_DEFAULTS.enabled);

  const warnRamPercent = clampNumber(source.warnRamPercent, LLAMA_GUARD_DEFAULTS.warnRamPercent, 60, 99);
  const stopRamPercent = clampNumber(source.stopRamPercent, LLAMA_GUARD_DEFAULTS.stopRamPercent, warnRamPercent + 1, 99);
  const minFreeRamMB = clampNumber(source.minFreeRamMB, LLAMA_GUARD_DEFAULTS.minFreeRamMB, 256, 32768);
  const consecutiveHits = Math.round(clampNumber(source.consecutiveHits, LLAMA_GUARD_DEFAULTS.consecutiveHits, 1, 10));
  const sampleIntervalMs = Math.round(clampNumber(source.sampleIntervalMs, LLAMA_GUARD_DEFAULTS.sampleIntervalMs, 1000, 10000));
  const drainPeriodMs = Math.round(clampNumber(source.drainPeriodMs, LLAMA_GUARD_DEFAULTS.drainPeriodMs, 5000, 60000));

  return {
    enabled,
    warnRamPercent,
    stopRamPercent,
    minFreeRamMB,
    consecutiveHits,
    sampleIntervalMs,
    drainPeriodMs
  };
}

function sampleLlamaMemoryGuard() {
  const totalRam = Number(os.totalmem() || 0);
  const freeRam = Number(os.freemem() || 0);
  const usedRam = Math.max(0, totalRam - freeRam);
  const totalMB = totalRam > 0 ? Math.round(totalRam / (1024 * 1024)) : 0;
  const freeMB = freeRam > 0 ? Math.round(freeRam / (1024 * 1024)) : 0;
  const usedMB = usedRam > 0 ? Math.round(usedRam / (1024 * 1024)) : 0;
  const usedPercent = totalRam > 0 ? Number(((usedRam / totalRam) * 100).toFixed(1)) : 0;

  return {
    ts: Date.now(),
    totalMB,
    freeMB,
    usedMB,
    usedPercent
  };
}

function startLlamaMemoryGuard() {
  clearLlamaMemoryGuard();
  const settings = normalizeLlamaGuardSettings(serverConfigs.llama?.guardSettings || {});
  llamaMemoryGuardState = {
    ...llamaMemoryGuardState,
    enabled: settings.enabled,
    pressure: settings.enabled ? 'safe' : 'disabled',
    criticalHits: 0,
    isDraining: false,
    drainStartedAt: 0,
    lastSample: sampleLlamaMemoryGuard(),
    lastAction: settings.enabled ? 'Watching system memory.' : 'Protection is disabled.',
    lastWarningAt: 0
  };
  invalidateServerStatusCache('llama');

  llamaMemoryGuardInterval = setInterval(() => {
    if (!isServerProcessActive(llamaServerProcess)) {
      clearLlamaMemoryGuard();
      return;
    }
    try {
      const nextSettings = normalizeLlamaGuardSettings(serverConfigs.llama?.guardSettings || settings);
      const sample = sampleLlamaMemoryGuard();
      llamaMemoryGuardState.enabled = nextSettings.enabled;
      llamaMemoryGuardState.lastSample = sample;

      if (!nextSettings.enabled) {
        llamaMemoryGuardState.pressure = 'disabled';
        llamaMemoryGuardState.criticalHits = 0;
        llamaMemoryGuardState.isDraining = false;
        llamaMemoryGuardState.drainStartedAt = 0;
        llamaMemoryGuardState.lastAction = 'Protection is disabled.';
        invalidateServerStatusCache('llama');
        return;
      }

      const warning = sample.usedPercent >= nextSettings.warnRamPercent || sample.freeMB <= nextSettings.minFreeRamMB;
      const critical = sample.usedPercent >= nextSettings.stopRamPercent || sample.freeMB <= nextSettings.minFreeRamMB;
      const now = Date.now();

      if (critical) {
        llamaMemoryGuardState.criticalHits += 1;
      } else {
        llamaMemoryGuardState.criticalHits = 0;
      }

      if (llamaMemoryGuardState.isDraining && !critical) {
        llamaMemoryGuardState.isDraining = false;
        llamaMemoryGuardState.drainStartedAt = 0;
        llamaMemoryGuardState.criticalHits = 0;
        llamaMemoryGuardState.pressure = warning ? 'warning' : 'safe';
        llamaMemoryGuardState.lastAction = 'System memory recovered during drain mode. Om-X kept the model loaded.';
        invalidateServerStatusCache('llama');
        return;
      }

      llamaMemoryGuardState.pressure = critical
        ? (llamaMemoryGuardState.isDraining ? 'overloaded' : 'critical')
        : warning
          ? 'warning'
          : 'safe';

      if (warning && !critical) {
        if ((now - Number(llamaMemoryGuardState.lastWarningAt || 0)) >= 15000) {
          const warningMessage = `[WARN] Memory pressure high: system RAM is at ${sample.usedPercent}% used with ${sample.freeMB} MB free. Om-X is watching to avoid a freeze.`;
          llamaMemoryGuardState.lastWarningAt = now;
          llamaMemoryGuardState.lastAction = warningMessage;
          pushServerLog('llama', 'warning', warningMessage);
          mainWindow?.webContents?.send('llama-server-output', { type: 'stderr', data: `${warningMessage}\n` });
        }
      } else if (!warning && !llamaMemoryGuardState.isDraining) {
        llamaMemoryGuardState.lastAction = 'Watching system memory.';
      }

      if (critical && llamaMemoryGuardState.criticalHits >= nextSettings.consecutiveHits) {
        if (!llamaMemoryGuardState.isDraining) {
          llamaMemoryGuardState.isDraining = true;
          llamaMemoryGuardState.drainStartedAt = now;
          llamaMemoryGuardState.pressure = 'overloaded';
          llamaMemoryGuardState.lastAction = `Llama protection manager entered drain mode for ${Math.round(nextSettings.drainPeriodMs / 1000)}s because system RAM reached ${sample.usedPercent}% used with only ${sample.freeMB} MB free. In-flight requests may finish before unload.`;
          pushServerLog('llama', 'warning', llamaMemoryGuardState.lastAction);
          mainWindow?.webContents?.send('llama-server-output', { type: 'stderr', data: `${llamaMemoryGuardState.lastAction}\n` });
        } else if ((now - Number(llamaMemoryGuardState.drainStartedAt || 0)) >= nextSettings.drainPeriodMs) {
          forceStopLlamaServer(`Llama protection manager ejected the model after a ${Math.round(nextSettings.drainPeriodMs / 1000)}s drain window because system RAM remained at ${sample.usedPercent}% used with only ${sample.freeMB} MB free. Server stopped to prevent a system freeze.`);
          return;
        }
      }

      invalidateServerStatusCache('llama');
    } catch (_) {}
  }, settings.sampleIntervalMs);
}


// Temporary debugging aid for main window only.
const TEMP_MAIN_AUTO_OPEN_DEVTOOLS = false;
const trustedFolders = new Set();  // Track user-selected trusted folders

function addTrustedFolderPath(folderPath) {
  const abs = path.resolve(String(folderPath || ''));
  if (!abs) return '';
  trustedFolders.add(abs);
  return abs;
}

function trustPathForServerOperator(targetPath, options = {}) {
  const abs = path.resolve(String(targetPath || ''));
  if (!abs) return '';
  const folderPath = options.directoryOnly ? abs : path.dirname(abs);
  return addTrustedFolderPath(folderPath);
}

function getEventBrowserWindow(event) {
  try {
    return BrowserWindow.fromWebContents(event?.sender) || null;
  } catch (_) {
    return null;
  }
}

function ensureTrustedServerControlSender(event) {
  const senderWin = getEventBrowserWindow(event);
  if (!senderWin || senderWin.isDestroyed()) {
    throw new Error('Unauthorized server control request');
  }
  const allowedWindows = [mainWindow]
    .filter((win) => win && !win.isDestroyed());
  if (!allowedWindows.includes(senderWin)) {
    throw new Error('Unauthorized server control request');
  }
  return senderWin;
}

const AUTHORIZED_RENDERER_PAGES = Object.freeze({
  mainWindow: Object.freeze(['/html/windows/main.html']),
  system: Object.freeze(['/html/windows/system.html']),
  scraper: Object.freeze(['/html/pages/scraper.html']),
  siteSettings: Object.freeze(['/html/pages/site-settings.html']),
  serverOperator: Object.freeze(['/html/pages/server-operator.html']),
  privilegedSettings: Object.freeze([
    '/html/windows/system.html',
    '/html/pages/scraper.html'
  ]),
  siteInfoRead: Object.freeze([
    '/html/windows/main.html',
    '/html/pages/site-settings.html'
  ]),
  mainOrServerOperator: Object.freeze([
    '/html/windows/main.html',
    '/html/pages/server-operator.html',
    '/html/pages/vision-chat.html'
  ])
});

function getAuthorizedRendererPathname(event) {
  const senderUrl = getIpcSenderUrl(event);
  if (!senderUrl) return '';
  try {
    const parsed = new URL(senderUrl);
    if (parsed.protocol !== 'file:') return '';
    return decodeURIComponent(parsed.pathname || '').replace(/\\/g, '/').toLowerCase();
  } catch (_) {
    return '';
  }
}

function isAuthorizedRendererPage(event, allowedPageSuffixes = []) {
  const pathname = getAuthorizedRendererPathname(event);
  if (!pathname || !Array.isArray(allowedPageSuffixes) || !allowedPageSuffixes.length) return false;
  return allowedPageSuffixes.some((suffix) => pathname.endsWith(String(suffix || '').toLowerCase()));
}

function assertAuthorizedRendererPage(event, allowedPageSuffixes, channel) {
  if (isAuthorizedRendererPage(event, allowedPageSuffixes)) return;
  const senderUrl = getIpcSenderUrl(event) || 'unknown';
  console.warn(`[Security][IPC] Blocked page-scoped ${channel} from ${senderUrl}`);
  throw new Error(`Unauthorized IPC call: ${channel}`);
}

function withAuthorizedRendererPages(allowedPageSuffixes, channel, handler) {
  return async (event, ...args) => {
    assertAuthorizedRendererPage(event, allowedPageSuffixes, channel);
    return handler(event, ...args);
  };
}

function isSameOrSubFsPath(targetPath, basePath) {
  const target = path.resolve(String(targetPath || ''));
  const base = path.resolve(String(basePath || ''));
  if (!target || !base) return false;
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function isPathInSafeDirectories(targetPath) {
  try {
    const abs = path.resolve(String(targetPath || ''));
    if (!abs) return false;
    
    // Check against user-trusted folders first
    for (const trustedDir of trustedFolders) {
      try {
        if (trustedDir && isSameOrSubFsPath(abs, trustedDir)) {
          return true;
        }
      } catch (e) {}
    }
    
    // Define safe directories with proper error handling
    const safeDirectories = [];
    
    // Try each path individually to avoid one failure blocking others
    try { safeDirectories.push(path.resolve(app.getPath('userData'))); } catch (e) {}
    try { safeDirectories.push(path.resolve(app.getPath('documents'))); } catch (e) {}
    try { safeDirectories.push(path.resolve(app.getPath('downloads'))); } catch (e) {}
    try { safeDirectories.push(path.resolve(app.getPath('desktop'))); } catch (e) {}
    try { safeDirectories.push(path.resolve(app.getPath('pictures'))); } catch (e) {}
    try { safeDirectories.push(path.resolve(app.getPath('music'))); } catch (e) {}
    try { safeDirectories.push(path.resolve(app.getPath('videos'))); } catch (e) {}
    
    // Add system temp and app directories only
    safeDirectories.push(path.resolve(os.tmpdir()));
    
    // Allow app directory for bundled/local resources
    safeDirectories.push(path.resolve(app.getAppPath()));
    
    // Check if the target path is within any safe directory
    for (const safeDir of safeDirectories) {
      try {
        if (safeDir && isSameOrSubFsPath(abs, safeDir)) {
          return true;
        }
      } catch (e) {}
    }
    
    console.warn('[Security] Path blocked - not in trusted or safe directories:', abs);
    return false;
  } catch (e) {
    console.warn('[Security] Path validation error:', e?.message);
    return false;
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

if (!app.isPackaged) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}
app.commandLine.appendSwitch('process-per-site');
app.commandLine.appendSwitch('enable-gpu-rasterization');
const allowFileAccessFromFiles = !app.isPackaged
    || String(process.env.OMX_ALLOW_FILE_ACCESS_FROM_FILES || '').trim() === '1';
if (allowFileAccessFromFiles) {
    app.commandLine.appendSwitch('allow-file-access-from-files');
    if (app.isPackaged) {
        console.warn('[Security] Enabled allow-file-access-from-files via OMX_ALLOW_FILE_ACCESS_FROM_FILES=1');
    }
}
// Suppress noisy non-fatal Chromium internals (e.g. blink.mojom.Widget rejects on teardown).
app.commandLine.appendSwitch('log-level', '3');

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
const startupStatePath = path.join(app.getPath('userData'), 'startup-state.json');
const vtSiteCacheDir = path.join(app.getPath('userData'), 'virustotal-site-cache');
const VT_SITE_CACHE_BUCKETS = Object.freeze(['safe', 'danger', 'suspicious', 'unknown']);
const VT_SITE_CACHE_FILES = Object.freeze({
  safe: path.join(vtSiteCacheDir, 'safe.json'),
  danger: path.join(vtSiteCacheDir, 'danger.json'),
  suspicious: path.join(vtSiteCacheDir, 'suspicious.json'),
  unknown: path.join(vtSiteCacheDir, 'unknown.json')
});

const SCRAPES_DIR = path.join(os.homedir(), 'Desktop', 'Om-X Scrapes');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.omx');
  app.setName('Om-X');
}

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
  return undefined;
}

const WINDOW_ICON = resolveWindowIcon('app');
const WINDOW_ICON_IMAGE = (() => {
  if (!WINDOW_ICON) return null;
  try {
    const icon = nativeImage.createFromPath(WINDOW_ICON);
    return icon && !icon.isEmpty() ? icon : null;
  } catch (_) {
    return null;
  }
})();
const BROWSER_WINDOW_ICON = WINDOW_ICON_IMAGE || WINDOW_ICON;
let pendingAppLaunch = null;

function getOmxPopupWindowOptions(parentWindow = null) {
  return {
    parent: parentWindow || undefined,
    width: 520,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: '#18181b',
    title: 'Om-X',
    icon: BROWSER_WINDOW_ICON || undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: TEMP_MAIN_AUTO_OPEN_DEVTOOLS
    }
  };
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
}

function handleLaunchArgs(args) {
    const parsed = parseLaunchArgs(args || []);
    handleParsedLaunch(parsed);
}

function createDesktopShortcut(appId) {
    if (process.platform !== 'win32') {
        return { success: false, error: 'Desktop shortcuts are only supported on Windows.' };
    }
    const appNames = {};
    const name = appNames[appId] || 'Om-X App';
    const shortcutPath = path.join(app.getPath('desktop'), `${name}.lnk`);
    const target = process.execPath;
    const args = `--omx-app=${appId}`;
    const description = `Launch ${name} in Om-X`;
    const options = { target, args, description };
    if (WINDOW_ICON) options.icon = WINDOW_ICON;
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
    { id: 'startpage', name: 'Startpage', url: 'https://www.startpage.com/sp/search?query=%s', keyword: 'sp', icon: 'https://www.startpage.com/favicon.ico', category: 'QUERY_URL' },
    { id: 'wiki', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/', keyword: 'w', icon: 'https://www.wikipedia.org/favicon.ico', category: 'DIRECT_URL' },
    { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s', keyword: 'yt', icon: 'https://www.youtube.com/favicon.ico', category: 'QUERY_URL' },
    { id: 'vyntr', name: 'Vyntr', url: 'https://vyntr.com/search?q=%s', keyword: 'vy', icon: 'https://vyntr.com/favicon.ico', category: 'QUERY_URL' }
  ],
  defaultSearchEngineId: 'google',
  theme: 'noir',
  downloadPath: app.getPath('downloads'),
  features: {
    enableHistory: true,
    enableAntivirus: true,
    enableFirewall: true,
    enableVirusTotal: false,
    enableAdultContentBlock: isAdultContentBlockEnabledFromEnv(),
    showLoadingAnimation: false
  },
  security: {
    virusTotal: {},
    popupBlocker: {
      enabled: true
    },
    cookieShield: {
      enabled: true,
      blockThirdPartyRequestCookies: true,
      blockThirdPartyResponseCookies: true
    }
  },
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
  llm: {
    provider: 'google',
    key: '',
    model: 'gemini-3-flash-preview'
  },
  youtubeAddon: {
    enabled: true,
    hideShorts: true,
    hideHomeSuggestions: true,
    hideSuggestions: false,
    blurThumbnails: false,
    hideChats: false,
    hideHeaderControls: true,
    blackAndWhiteMode: false,
    cleanUi: false,
    hideAddonIcon: false,
    fastForwardAds: true
  },
  shortcuts: { 
    'new-tab': 'Ctrl+T',
    'open-scraber': 'Alt+T',
    'close-tab': 'Ctrl+W',
    'toggle-sidebar': 'Ctrl+[',
    'toggle-system': 'Alt+S',
    'toggle-bookmarks': 'Ctrl+Shift+B',
    'toggle-devtools': 'Ctrl+B',
    'toggle-fullscreen': 'F11',
    'quit-app': 'Ctrl+Shift+Q'
  },
  omchat: {
    localDbPath: '',
    useLocalIpOnly: false,
    alwaysOn: false
  },
  mcp: {
    alwaysOn: false
  },
  websiteUiPreferences: {},
  websitePermissions: {}
};

function normalizeYouTubeAddonSettings(youtubeAddon = {}) {
  const nextYoutubeAddon = youtubeAddon && typeof youtubeAddon === 'object' ? youtubeAddon : {};
  return {
    ...DEFAULT_SETTINGS.youtubeAddon,
    ...nextYoutubeAddon,
    enabled: nextYoutubeAddon.enabled ?? DEFAULT_SETTINGS.youtubeAddon.enabled,
    hideShorts: nextYoutubeAddon.hideShorts ?? DEFAULT_SETTINGS.youtubeAddon.hideShorts,
    hideHomeSuggestions: nextYoutubeAddon.hideHomeSuggestions ?? DEFAULT_SETTINGS.youtubeAddon.hideHomeSuggestions,
    hideSuggestions: nextYoutubeAddon.hideSuggestions ?? DEFAULT_SETTINGS.youtubeAddon.hideSuggestions,
    blurThumbnails: nextYoutubeAddon.blurThumbnails ?? DEFAULT_SETTINGS.youtubeAddon.blurThumbnails,
    hideChats: nextYoutubeAddon.hideChats ?? DEFAULT_SETTINGS.youtubeAddon.hideChats,
    hideHeaderControls: nextYoutubeAddon.hideHeaderControls ?? DEFAULT_SETTINGS.youtubeAddon.hideHeaderControls,
    blackAndWhiteMode: nextYoutubeAddon.blackAndWhiteMode ?? DEFAULT_SETTINGS.youtubeAddon.blackAndWhiteMode,
    cleanUi: nextYoutubeAddon.cleanUi ?? DEFAULT_SETTINGS.youtubeAddon.cleanUi,
    hideAddonIcon: nextYoutubeAddon.hideAddonIcon ?? DEFAULT_SETTINGS.youtubeAddon.hideAddonIcon,
    fastForwardAds: nextYoutubeAddon.fastForwardAds ?? DEFAULT_SETTINGS.youtubeAddon.fastForwardAds
  };
}

function normalizeAiChatSettings(aiChat = {}) {
  const nextAiChat = aiChat && typeof aiChat === 'object' ? aiChat : {};
  return {
    ...nextAiChat
  };
}

function normalizeSearchEngineName(value, fallback = '') {
  const normalized = String(value ?? fallback ?? '').trim();
  return normalized || String(fallback || '').trim() || 'Search';
}

function normalizeSearchEngineKeyword(value, fallback = '') {
  const normalized = String(value ?? fallback ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, '');
  return normalized || String(fallback || '').trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');
}

function normalizeSearchEngineUrl(rawUrl, allowedProtocols, fallback = '') {
  const value = String(rawUrl ?? fallback ?? '').trim();
  if (!value) return '';
  const probe = value.replace(/%s/g, 'omx-query');
  try {
    const parsed = new URL(probe);
    return allowedProtocols.has(parsed.protocol) ? value : '';
  } catch (_) {
    return '';
  }
}

function normalizeSearchEngineCategory(value, fallback = 'QUERY_URL') {
  const allowed = new Set(['QUERY_URL', 'DIRECT_URL', 'AI_URL', 'INTERACTIVE']);
  const normalized = String(value || fallback || 'QUERY_URL').trim().toUpperCase();
  return allowed.has(normalized) ? normalized : 'QUERY_URL';
}

function normalizeSearchEngines(entries = [], fallbackEntries = DEFAULT_SETTINGS.searchEngines) {
  const fallbackList = Array.isArray(fallbackEntries) && fallbackEntries.length
    ? fallbackEntries
    : DEFAULT_SETTINGS.searchEngines;
  const removedEngineIds = new Set(['yahoo', 'chatgpt', 'deepseek', 'perplexity']);
  const requiredFallbackIds = new Set(['startpage', 'vyntr']);
  if (!Array.isArray(entries) || entries.length === 0) {
    return fallbackList.map((entry) => ({ ...entry }));
  }

  const fallbackById = new Map(
    fallbackList.map((entry, index) => [String(entry?.id || `engine-${index + 1}`), entry])
  );
  const seenIds = new Set();
  const normalized = [];

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const rawEntryId = String(entry.id || '').trim().toLowerCase();
    if (removedEngineIds.has(rawEntryId)) return;

    const fallback = fallbackById.get(String(entry.id || '').trim()) || null;
    const idBase = String(entry.id || fallback?.id || `engine-${index + 1}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `engine-${index + 1}`;
    let id = idBase;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${idBase}-${suffix++}`;
    }
    seenIds.add(id);

    const name = normalizeSearchEngineName(entry.name, fallback?.name);
    const keyword = normalizeSearchEngineKeyword(entry.keyword, fallback?.keyword);
    const url = normalizeSearchEngineUrl(entry.url, new Set(['http:', 'https:', 'file:']), fallback?.url);
    if (!url) return;
    const icon = normalizeSearchEngineUrl(entry.icon, new Set(['http:', 'https:', 'file:', 'data:']), fallback?.icon)
      || String(fallback?.icon || '');
    const category = normalizeSearchEngineCategory(entry.category, fallback?.category);

    normalized.push({ id, name, url, keyword, icon, category });
  });

  fallbackList.forEach((entry) => {
    const fallbackId = String(entry?.id || '').trim().toLowerCase();
    if (!fallbackId || !requiredFallbackIds.has(fallbackId) || seenIds.has(fallbackId)) return;
    seenIds.add(fallbackId);
    normalized.push({ ...entry });
  });

  return normalized.length > 0 ? normalized : fallbackList.map((entry) => ({ ...entry }));
}

function normalizeDefaultSearchEngineId(value, searchEngines = DEFAULT_SETTINGS.searchEngines) {
  const fallbackId = String(DEFAULT_SETTINGS.defaultSearchEngineId || 'google');
  const requestedId = String(value || '').trim().toLowerCase();
  const availableIds = new Set(
    Array.isArray(searchEngines) ? searchEngines.map((entry) => String(entry?.id || '').trim().toLowerCase()).filter(Boolean) : []
  );
  if (requestedId && availableIds.has(requestedId)) return requestedId;
  return availableIds.has(fallbackId) ? fallbackId : (searchEngines[0]?.id || fallbackId);
}

function getMainWindowHtmlPath(settings = cachedSettings) {
  return path.join(__dirname, '../../html/windows', 'main.html');
}

let mainWindow = null;
let previewWindow = null;
let securityManager = null;
let antivirusEngine = null;
let virusTotalClient = null;
const vtWebsiteSafetyIndex = new Map();
const vtWebsiteSafetyInflight = new Map();
let vtWebsiteSafetyLoaded = false;
let cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

function applyPreferredWebTheme() {
  try {
    // Prefer sites' native dark UI whenever they support it.
    nativeTheme.themeSource = 'dark';
  } catch (_) {}
}
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

function normalizeWebsitePermissions(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = {};
  for (const [origin, permissions] of Object.entries(source)) {
    const safeOrigin = String(origin || '').trim().toLowerCase();
    if (!safeOrigin) continue;
    if (!permissions || typeof permissions !== 'object') continue;
    const next = {};
    for (const [permission, decision] of Object.entries(permissions)) {
      const safePermission = String(permission || '').trim().toLowerCase();
      const safeDecision = decision === 'allow' ? 'allow' : (decision === 'deny' ? 'deny' : '');
      if (!safePermission || !safeDecision) continue;
      next[safePermission] = safeDecision;
    }
    if (Object.keys(next).length) normalized[safeOrigin] = next;
  }
  return normalized;
}

function normalizeWebsiteUiPreferences(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = {};
  for (const [origin, preferences] of Object.entries(source)) {
    const safeOrigin = getSiteOriginFromUrl(origin);
    if (!safeOrigin || !preferences || typeof preferences !== 'object') continue;
    const next = {};
    if (preferences.hideWindowControls === true) {
      next.hideWindowControls = true;
    }
    if (Object.keys(next).length) normalized[safeOrigin] = next;
  }
  return normalized;
}

function normalizePermissionName(permission = '') {
  const value = String(permission || '').trim().toLowerCase();
  if (value === 'audiocapture') return 'microphone';
  if (value === 'videocapture') return 'camera';
  if (value === 'pointerlock') return 'pointer-lock';
  if (value === 'midisysex') return 'midi-sysex';
  if (value === 'windowmanagement') return 'window-management';
  if (value === 'localfonts') return 'fonts';
  if (value === 'clipboard-write') return 'clipboard';
  if (value === 'clipboard-sanitized-write') return 'clipboard';
  if (value === 'clipboard-read') return 'clipboard';
  if (value === 'idle-detection') return 'your-device-use';
  if (value === 'sensors') return 'motion-sensors';
  if (value === 'window-placement') return 'window-management';
  if (value === 'local-fonts') return 'fonts';
  if (value === 'speaker-selection') return 'sound';
  if (value === 'background-fetch') return 'background-sync';
  if (value === 'display-capture') return 'display-capture';
  return value;
}

function getPermissionDecisionKeys(permission = '', details = {}) {
  const normalized = normalizePermissionName(permission);
  if (normalized !== 'media') return [normalized];

  const mediaTypes = Array.isArray(details?.mediaTypes) ? details.mediaTypes.map((item) => String(item || '').toLowerCase()) : [];
  const keys = [];
  if (mediaTypes.includes('audio')) keys.push('microphone');
  if (mediaTypes.includes('video')) keys.push('camera');
  return keys.length ? keys : ['microphone', 'camera'];
}

function getPermissionLabel(permission = '') {
  const normalized = normalizePermissionName(permission);
  const labels = {
    'top-level-storage-access': 'access top-level storage',
    'storage-access': 'access site storage',
    'clipboard-sanitized-write': 'write to your clipboard',
    'clipboard-read': 'read your clipboard'
  };
  return labels[normalized] || getSitePermissionDefinition(normalized)?.title || `use ${humanizePermissionKey(normalized)}`;
}

const SITE_PERMISSION_DEFINITIONS = Object.freeze([
  { key: 'geolocation', title: 'Location', defaultDecision: 'ask' },
  { key: 'camera', title: 'Camera', defaultDecision: 'ask' },
  { key: 'microphone', title: 'Microphone', defaultDecision: 'ask' },
  { key: 'notifications', title: 'Notifications', defaultDecision: 'ask' },
  { key: 'midi', title: 'MIDI device control', defaultDecision: 'ask' },
  { key: 'midi-sysex', title: 'MIDI device control & reprogram', defaultDecision: 'ask' },
  { key: 'clipboard', title: 'Clipboard', defaultDecision: 'ask' },
  { key: 'sound', title: 'Sound', defaultDecision: 'allow' },
  { key: 'storage-access', title: 'Site storage access', defaultDecision: 'ask' },
  { key: 'your-device-use', title: 'Your device use', defaultDecision: 'ask' },
  { key: 'window-management', title: 'Window management', defaultDecision: 'ask' },
  { key: 'fonts', title: 'Fonts', defaultDecision: 'ask' },
  { key: 'top-level-storage-access', title: 'Top-level storage access', defaultDecision: 'ask' },
  { key: 'fullscreen', title: 'Fullscreen', defaultDecision: 'ask' },
  { key: 'pointer-lock', title: 'Pointer lock', defaultDecision: 'ask' },
  { key: 'display-capture', title: 'Screen capture', defaultDecision: 'ask' }
]);

const SITE_PERMISSION_DEFINITION_MAP = new Map(
  SITE_PERMISSION_DEFINITIONS.map((entry) => [entry.key, entry])
);

function getSitePermissionDefinition(permission = '') {
  return SITE_PERMISSION_DEFINITION_MAP.get(normalizePermissionName(permission)) || null;
}

function humanizePermissionKey(permission = '') {
  return String(permission || '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Permission';
}

function getSitePermissionDefinitionsForOrigin(origin = '') {
  const safeOrigin = String(origin || '').trim().toLowerCase();
  const storedPermissions = normalizeWebsitePermissions(cachedSettings?.websitePermissions)?.[safeOrigin] || {};
  const fallbackDefinitions = Object.keys(storedPermissions).map((key) => {
    const normalizedKey = normalizePermissionName(key);
    return SITE_PERMISSION_DEFINITION_MAP.get(normalizedKey) || {
      key: normalizedKey,
      title: humanizePermissionKey(normalizedKey),
      defaultDecision: 'ask'
    };
  });

  const merged = new Map();
  [...SITE_PERMISSION_DEFINITIONS, ...fallbackDefinitions].forEach((definition) => {
    merged.set(definition.key, definition);
  });
  return [...merged.values()];
}

function getSiteSession() {
  return mainWindow?.webContents?.session || session.defaultSession;
}

function normalizeSiteSettingsUrl(rawUrl = '') {
  const safe = String(rawUrl || '').trim();
  if (!safe) return '';
  try {
    const parsed = new URL(safe);
    if (!['http:', 'https:'].includes(String(parsed.protocol || '').toLowerCase())) return '';
    return parsed.href;
  } catch (_) {
    return '';
  }
}

function getSiteOriginFromUrl(rawUrl = '') {
  const safeUrl = normalizeSiteSettingsUrl(rawUrl);
  if (!safeUrl) return '';
  try {
    return new URL(safeUrl).origin.toLowerCase();
  } catch (_) {
    return '';
  }
}

function getSitePermissionEntries(origin = '') {
  return getSitePermissionDefinitionsForOrigin(origin).map((definition) => {
    const storedDecision = getStoredPermissionDecision(origin, definition.key);
    const effectiveDecision = storedDecision || definition.defaultDecision || 'ask';
    return {
      key: definition.key,
      label: definition.title,
      description: definition.description || '',
      defaultDecision: definition.defaultDecision || 'ask',
      storedDecision: storedDecision || '',
      effectiveDecision
    };
  });
}

async function getSiteSettingsSnapshot(rawUrl = '') {
  const url = normalizeSiteSettingsUrl(rawUrl);
  if (!url) {
    return { success: false, error: 'A valid website URL is required.' };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return { success: false, error: 'A valid website URL is required.' };
  }

  const origin = parsed.origin.toLowerCase();
  const hostname = String(parsed.hostname || '').toLowerCase();
  const secure = parsed.protocol === 'https:';
  const permissionEntries = getSitePermissionEntries(origin);
  const allowedCount = permissionEntries.filter((entry) => entry.effectiveDecision === 'allow').length;
  const blockedCount = permissionEntries.filter((entry) => entry.effectiveDecision === 'deny').length;

  let cookies = [];
  try {
    cookies = await getSiteSession().cookies.get({ url });
  } catch (_) {}

  const cookieCount = Array.isArray(cookies) ? cookies.length : 0;
  const cookieBytes = Array.isArray(cookies)
    ? cookies.reduce((total, cookie) => total + Buffer.byteLength(`${cookie?.name || ''}=${cookie?.value || ''}`, 'utf8'), 0)
    : 0;

  return {
    success: true,
    site: {
      url,
      origin,
      hostname,
      protocol: parsed.protocol,
      secure,
      cookiesCount: cookieCount,
      cookiesBytes: cookieBytes,
      permissions: permissionEntries,
      permissionsSummary: {
        allowed: allowedCount,
        blocked: blockedCount,
        ask: permissionEntries.length - allowedCount - blockedCount
      }
    }
  };
}

async function updateSitePermissionSetting(rawUrl = '', permission = '', decision = '') {
  const origin = getSiteOriginFromUrl(rawUrl);
  const safePermission = normalizePermissionName(permission);
  const safeDecision = String(decision || '').trim().toLowerCase();
  if (!origin) return { success: false, error: 'A valid website URL is required.' };
  if (!SITE_PERMISSION_DEFINITION_MAP.has(safePermission)) {
    return { success: false, error: 'Unsupported permission.' };
  }

  const nextPermissions = normalizeWebsitePermissions(cachedSettings?.websitePermissions);
  if (safeDecision === 'allow' || safeDecision === 'deny') {
    nextPermissions[origin] = {
      ...(nextPermissions[origin] || {}),
      [safePermission]: safeDecision
    };
  } else {
    if (nextPermissions[origin]) {
      delete nextPermissions[origin][safePermission];
      if (!Object.keys(nextPermissions[origin]).length) delete nextPermissions[origin];
    }
  }

  cachedSettings.websitePermissions = nextPermissions;
  const didSave = await saveSettings(cachedSettings);
  if (!didSave) {
    return { success: false, error: 'Failed to save site permission.' };
  }
  return getSiteSettingsSnapshot(rawUrl);
}

async function resetSitePermissionSettings(rawUrl = '') {
  const origin = getSiteOriginFromUrl(rawUrl);
  if (!origin) return { success: false, error: 'A valid website URL is required.' };

  const nextPermissions = normalizeWebsitePermissions(cachedSettings?.websitePermissions);
  delete nextPermissions[origin];
  cachedSettings.websitePermissions = nextPermissions;
  const didSave = await saveSettings(cachedSettings);
  if (!didSave) {
    return { success: false, error: 'Failed to reset site permissions.' };
  }
  return getSiteSettingsSnapshot(rawUrl);
}

async function clearSiteStorageData(rawUrl = '') {
  const url = normalizeSiteSettingsUrl(rawUrl);
  if (!url) return { success: false, error: 'A valid website URL is required.' };
  const origin = getSiteOriginFromUrl(url);
  if (!origin) return { success: false, error: 'A valid website URL is required.' };

  try {
    const targetSession = getSiteSession();
    await targetSession.clearStorageData({
      origin,
      storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
    });
    return getSiteSettingsSnapshot(url);
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to clear site data.' };
  }
}

function getRequestOrigin(details = {}, contents = null) {
  const candidates = [
    details?.requestingOrigin,
    details?.embeddingOrigin
  ];
  for (const candidate of candidates) {
    try {
      if (!candidate) continue;
      return new URL(candidate).origin.toLowerCase();
    } catch (_) {}
  }
  try {
    const url = contents?.getURL?.() || '';
    if (url) return new URL(url).origin.toLowerCase();
  } catch (_) {}
  return '';
}

function getStoredPermissionDecision(origin = '', permission = '') {
  const safeOrigin = String(origin || '').trim().toLowerCase();
  const safePermission = normalizePermissionName(permission);
  return cachedSettings?.websitePermissions?.[safeOrigin]?.[safePermission] || null;
}

async function persistPermissionDecision(origin = '', permission = '', decision = '') {
  const safeOrigin = String(origin || '').trim().toLowerCase();
  const safePermission = normalizePermissionName(permission);
  const safeDecision = decision === 'allow' ? 'allow' : (decision === 'deny' ? 'deny' : '');
  if (!safeOrigin || !safePermission || !safeDecision) return false;

  const nextPermissions = normalizeWebsitePermissions(cachedSettings?.websitePermissions);
  nextPermissions[safeOrigin] = {
    ...(nextPermissions[safeOrigin] || {}),
    [safePermission]: safeDecision
  };
  cachedSettings.websitePermissions = nextPermissions;
  return saveSettings(cachedSettings);
}

const configuredPermissionSessions = new WeakSet();

function configureSitePermissions(targetSession) {
  if (!targetSession || configuredPermissionSessions.has(targetSession)) return;
  configuredPermissionSessions.add(targetSession);

  targetSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const decisionKeys = getPermissionDecisionKeys(permission, details);
    const origin = getRequestOrigin({ requestingOrigin, ...(details || {}) }, webContents);
    return decisionKeys.every((key) => getStoredPermissionDecision(origin, key) === 'allow');
  });

  targetSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    const decisionKeys = getPermissionDecisionKeys(permission, details);
    const normalizedPermission = decisionKeys[0] || normalizePermissionName(permission);
    const origin = getRequestOrigin(details, webContents);
    const storedDecisions = decisionKeys.map((key) => getStoredPermissionDecision(origin, key));
    if (storedDecisions.every((decision) => decision === 'allow')) return callback(true);
    if (storedDecisions.some((decision) => decision === 'deny')) return callback(false);

    const hostWindow = BrowserWindow.fromWebContents(webContents) || mainWindow;
    const siteLabel = origin || 'This site';
    const permissionLabel = getPermissionLabel(normalizedPermission);

    dialog.showMessageBox(hostWindow || undefined, {
      type: 'question',
      buttons: ['Allow Once', 'Always Allow', 'Block'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Website Permission Request',
      message: `${siteLabel} wants to ${permissionLabel}.`,
      detail: `Om-X will let this website ${permissionLabel} only if you approve it.`
    }).then(async ({ response }) => {
      if (response === 1) {
        const results = await Promise.all(decisionKeys.map((key) => persistPermissionDecision(origin, key, 'allow')));
        callback(results.every(Boolean));
        return;
      }
      if (response === 0) {
        callback(true);
        return;
      }
      await Promise.all(decisionKeys.map((key) => persistPermissionDecision(origin, key, 'deny')));
      callback(false);
    }).catch(() => callback(false));
  });
}


async function safeWriteJson(filePath, data) {
    const tempPath = filePath + '.tmp';
    try {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
        await fs.promises.rename(tempPath, filePath);
        return true;
    } catch (e) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return false;
    }
}

function readJsonArraySync(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function createCachedJsonListStore(filePath, maxItems) {
  let loaded = false;
  let items = [];
  let flushTimer = null;
  let flushPromise = Promise.resolve(true);

  function cloneCurrentItems() {
    return items.slice();
  }

  function ensureLoaded() {
    if (loaded) return;
    items = readJsonArraySync(filePath);
    loaded = true;
  }

  function get() {
    ensureLoaded();
    return cloneCurrentItems();
  }

  function set(nextItems) {
    ensureLoaded();
    items = Array.isArray(nextItems) ? nextItems.slice(0, maxItems) : [];
    return cloneCurrentItems();
  }

  async function flush() {
    ensureLoaded();
    const snapshot = cloneCurrentItems();
    flushPromise = flushPromise
      .catch(() => true)
      .then(() => safeWriteJson(filePath, snapshot));
    return flushPromise;
  }

  function scheduleFlush(delayMs = 150) {
    ensureLoaded();
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, delayMs);
  }

  return {
    get,
    set,
    scheduleFlush,
    flush
  };
}

async function saveSettings(nextSettings = cachedSettings) {
  const normalizedSearchEngines = normalizeSearchEngines(nextSettings?.searchEngines);
  const normalizedSettings = normalizeLockedSecuritySettings({
    ...DEFAULT_SETTINGS,
    ...(nextSettings || {}),
    features: {
      ...DEFAULT_SETTINGS.features,
      ...(nextSettings?.features || {})
    },
    security: {
      ...DEFAULT_SETTINGS.security,
      ...(nextSettings?.security || {}),
      virusTotal: normalizeVirusTotalSettings(nextSettings?.security?.virusTotal)
    },
    aiChat: {
      ...normalizeAiChatSettings(nextSettings?.aiChat)
    },
    youtubeAddon: normalizeYouTubeAddonSettings(nextSettings?.youtubeAddon),
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...(nextSettings?.shortcuts || {})
    },
    llm: normalizeSharedLlmSettings(nextSettings?.llm),
    searchEngines: normalizedSearchEngines,
    defaultSearchEngineId: normalizeDefaultSearchEngineId(nextSettings?.defaultSearchEngineId, normalizedSearchEngines),
    omchat: {
      ...DEFAULT_SETTINGS.omchat,
      ...(nextSettings?.omchat || {})
    },
    mcp: {
      ...DEFAULT_SETTINGS.mcp,
      ...(nextSettings?.mcp || {})
    },
    websiteUiPreferences: normalizeWebsiteUiPreferences(nextSettings?.websiteUiPreferences),
    websitePermissions: normalizeWebsitePermissions(nextSettings?.websitePermissions)
  });
  normalizedSettings.aiConfig = normalizePersistedAiConfig(normalizedSettings.aiConfig);
  cachedSettings = normalizedSettings;
  const success = await safeWriteJson(settingsPath, normalizedSettings);
  if (!success) return false;
  applyPreferredWebTheme();
  configureSecurity(normalizedSettings, mainWindow);
  broadcast('settings-updated', normalizedSettings);
  return true;
}

const historyStore = createCachedJsonListStore(historyPath, 5000);
const bookmarksStore = createCachedJsonListStore(bookmarksPath, 500);
const downloadsStore = createCachedJsonListStore(downloadsPath, 100);

const getStoredHistory = () => historyStore.get();
const getStoredBookmarks = () => bookmarksStore.get();
const getStoredDownloads = () => downloadsStore.get();

function upsertStoredDownload(downloadData) {
  const normalized = downloadData && typeof downloadData === 'object'
    ? { ...downloadData }
    : null;
  if (!normalized?.id) return;
  const targetId = String(normalized.id).trim();
  const list = getStoredDownloads().filter((item) => String(item?.id || '').trim() !== targetId);
  list.unshift(normalized);
  downloadsStore.set(list);
  downloadsStore.scheduleFlush();
}

function persistAndBroadcastDownload(downloadData) {
  if (!downloadData?.id) return;
  upsertStoredDownload(downloadData);
  broadcast('download-update', { ...downloadData });
}

function normalizeSiteSafetyUrl(rawUrl = '') {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    const protocol = parsed.protocol.toLowerCase();
    const hostname = String(parsed.hostname || '').trim().toLowerCase();
    if (!hostname) return '';
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${protocol}//${hostname}${port}/`;
  } catch (_) {
    return '';
  }
}

function getSiteSafetyHostname(rawUrl = '') {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    return String(parsed.hostname || '').trim().toLowerCase();
  } catch (_) {
    return '';
  }
}

function toIsoTimestamp(value, fallback = null) {
  const time = Date.parse(String(value || '').trim());
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function toNonNegativeInt(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : fallback;
}

function normalizeSiteSafetyStats(rawStats = {}) {
  return {
    malicious: toNonNegativeInt(rawStats?.malicious, 0),
    suspicious: toNonNegativeInt(rawStats?.suspicious, 0),
    harmless: toNonNegativeInt(rawStats?.harmless, 0),
    undetected: toNonNegativeInt(rawStats?.undetected, 0),
    timeout: toNonNegativeInt(rawStats?.timeout, 0)
  };
}

function calculateSiteSafetyRiskScore(stats = {}) {
  const normalizedStats = normalizeSiteSafetyStats(stats);
  const totalVotes =
    normalizedStats.malicious +
    normalizedStats.suspicious +
    normalizedStats.harmless +
    normalizedStats.undetected;
  return totalVotes > 0
    ? Math.round(((normalizedStats.malicious + normalizedStats.suspicious) / totalVotes) * 100)
    : 0;
}

function normalizeStoredSiteRiskLevel(value = 'unknown') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'safe') return 'clean';
  if (normalized === 'unsafe') return 'danger';
  if (normalized === 'warn') return 'suspicious';
  return normalized || 'unknown';
}

function deriveSiteSafetyRiskLevel(stats = {}, riskScore = null, fallback = 'unknown') {
  const normalizedStats = normalizeSiteSafetyStats(stats);
  const totalVotes =
    normalizedStats.malicious +
    normalizedStats.suspicious +
    normalizedStats.harmless +
    normalizedStats.undetected;
  const scoreValue = Number(riskScore);
  const normalizedRiskScore = Number.isFinite(scoreValue) && scoreValue >= 0
    ? Math.round(scoreValue)
    : calculateSiteSafetyRiskScore(normalizedStats);

  if (totalVotes === 0) {
    return normalizeStoredSiteRiskLevel(fallback);
  }
  if (normalizedRiskScore < 5) return 'clean';
  if (normalizedStats.malicious >= 3 || normalizedRiskScore >= 15) return 'danger';
  if (normalizedStats.malicious > 0 || normalizedStats.suspicious > 0) return 'suspicious';
  if (normalizedStats.harmless > 0 && normalizedStats.malicious === 0 && normalizedStats.suspicious === 0) return 'clean';
  if (normalizedStats.undetected > 0) return 'unknown';
  return normalizeStoredSiteRiskLevel(fallback);
}

function sanitizeSiteSafetyDetections(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => ({
      engine: String(entry?.engine || '').trim(),
      category: String(entry?.category || '').trim().toLowerCase(),
      result: String(entry?.result || '').trim()
    }))
    .filter((entry) => entry.engine || entry.result || entry.category)
    .slice(0, 12);
}

function mapSiteRiskLevelToBucket(riskLevel = 'unknown') {
  const normalized = String(riskLevel || '').trim().toLowerCase();
  if (normalized === 'clean' || normalized === 'safe') return 'safe';
  if (normalized === 'danger' || normalized === 'unsafe') return 'danger';
  if (normalized === 'suspicious' || normalized === 'warn') return 'suspicious';
  return 'unknown';
}

function getSiteSafetyLabel(bucket = 'unknown') {
  switch (String(bucket || '').trim().toLowerCase()) {
    case 'safe':
      return 'Safe';
    case 'danger':
      return 'Danger';
    case 'suspicious':
      return 'Suspicious';
    default:
      return 'Unknown';
  }
}

function readJsonArrayFile(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeStoredSiteSafetyEntry(entry = {}, fallbackBucket = 'unknown') {
  const siteKey = normalizeSiteSafetyUrl(entry?.siteKey || entry?.url || entry?.lastSourceUrl || '');
  if (!siteKey) return null;

  const stats = normalizeSiteSafetyStats(entry?.stats || {});
  const riskScore = toNonNegativeInt(entry?.riskScore, calculateSiteSafetyRiskScore(stats));
  const riskLevel = deriveSiteSafetyRiskLevel(stats, riskScore, entry?.riskLevel || fallbackBucket);
  const bucket = mapSiteRiskLevelToBucket(riskLevel);

  const firstSeenAt = toIsoTimestamp(entry?.firstSeenAt, null);
  const lastScannedAt = toIsoTimestamp(entry?.lastScannedAt, firstSeenAt);
  const fallbackVisitedAt = lastScannedAt || firstSeenAt || new Date().toISOString();

  return {
    siteKey,
    url: siteKey,
    hostname: getSiteSafetyHostname(siteKey),
    bucket,
    riskLevel,
    safety: getSiteSafetyLabel(bucket),
    safe: bucket === 'safe',
    riskScore,
    stats,
    categories: Array.isArray(entry?.categories)
      ? entry.categories.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 24)
      : [],
    detections: sanitizeSiteSafetyDetections(entry?.detections || []),
    engineCount: toNonNegativeInt(entry?.engineCount, 0),
    reason: String(entry?.reason || '').trim(),
    scanDate: toIsoTimestamp(entry?.scanDate, null),
    firstSeenAt,
    lastScannedAt,
    lastVisitedAt: toIsoTimestamp(entry?.lastVisitedAt, fallbackVisitedAt),
    visitCount: Math.max(0, toNonNegativeInt(entry?.visitCount, 0)),
    lastSourceUrl: String(entry?.lastSourceUrl || siteKey).trim() || siteKey
  };
}

function serializeSiteSafetyEntry(entry = {}) {
  return {
    siteKey: entry.siteKey,
    url: entry.url,
    hostname: entry.hostname,
    bucket: entry.bucket,
    riskLevel: entry.riskLevel,
    safety: entry.safety,
    safe: entry.safe,
    riskScore: entry.riskScore,
    stats: normalizeSiteSafetyStats(entry.stats || {}),
    categories: Array.isArray(entry.categories) ? entry.categories : [],
    detections: sanitizeSiteSafetyDetections(entry.detections || []),
    engineCount: toNonNegativeInt(entry.engineCount, 0),
    reason: String(entry.reason || '').trim(),
    scanDate: entry.scanDate || null,
    firstSeenAt: entry.firstSeenAt || null,
    lastScannedAt: entry.lastScannedAt || null,
    lastVisitedAt: entry.lastVisitedAt || null,
    visitCount: Math.max(0, toNonNegativeInt(entry.visitCount, 0)),
    lastSourceUrl: String(entry.lastSourceUrl || entry.siteKey || '').trim()
  };
}

async function loadSiteSafetyCache() {
  if (vtWebsiteSafetyLoaded) return;

  await fs.promises.mkdir(vtSiteCacheDir, { recursive: true });
  for (const bucket of VT_SITE_CACHE_BUCKETS) {
    const filePath = VT_SITE_CACHE_FILES[bucket];
    if (!fs.existsSync(filePath)) {
      await safeWriteJson(filePath, []);
    }
    const entries = readJsonArrayFile(filePath);
    entries.forEach((entry) => {
      const normalized = normalizeStoredSiteSafetyEntry(entry, bucket);
      if (!normalized) return;
      const existing = vtWebsiteSafetyIndex.get(normalized.siteKey);
      const normalizedStamp = Date.parse(normalized.lastScannedAt || normalized.firstSeenAt || 0) || 0;
      const existingStamp = existing ? (Date.parse(existing.lastScannedAt || existing.firstSeenAt || 0) || 0) : 0;
      if (!existing || normalizedStamp >= existingStamp) {
        vtWebsiteSafetyIndex.set(normalized.siteKey, normalized);
      }
    });
  }

  vtWebsiteSafetyLoaded = true;
}

async function persistSiteSafetyCache() {
  await fs.promises.mkdir(vtSiteCacheDir, { recursive: true });

  const groupedEntries = {
    safe: [],
    danger: [],
    suspicious: [],
    unknown: []
  };

  for (const entry of vtWebsiteSafetyIndex.values()) {
    const bucket = VT_SITE_CACHE_BUCKETS.includes(entry?.bucket) ? entry.bucket : 'unknown';
    groupedEntries[bucket].push(serializeSiteSafetyEntry(entry));
  }

  const sortByRecent = (a, b) => {
    const aStamp = Date.parse(a?.lastVisitedAt || a?.lastScannedAt || a?.firstSeenAt || 0) || 0;
    const bStamp = Date.parse(b?.lastVisitedAt || b?.lastScannedAt || b?.firstSeenAt || 0) || 0;
    return bStamp - aStamp;
  };

  await Promise.all(
    VT_SITE_CACHE_BUCKETS.map((bucket) => {
      groupedEntries[bucket].sort(sortByRecent);
      return safeWriteJson(VT_SITE_CACHE_FILES[bucket], groupedEntries[bucket]);
    })
  );
}

function buildSiteSafetyResponse(entry, extra = {}) {
  return {
    success: true,
    siteKey: entry.siteKey,
    url: entry.lastSourceUrl || entry.siteKey,
    hostname: entry.hostname,
    safety: entry.safety,
    bucket: entry.bucket,
    riskLevel: entry.riskLevel,
    safe: entry.safe,
    riskScore: entry.riskScore,
    stats: entry.stats,
    categories: entry.categories,
    detections: entry.detections,
    engineCount: entry.engineCount,
    reason: entry.reason,
    scanDate: entry.scanDate,
    firstSeenAt: entry.firstSeenAt,
    lastScannedAt: entry.lastScannedAt,
    lastVisitedAt: entry.lastVisitedAt,
    visitCount: entry.visitCount,
    ...extra
  };
}

function buildSiteSafetyError(rawUrl, safety, extra = {}) {
  const siteKey = normalizeSiteSafetyUrl(rawUrl);
  return {
    success: false,
    siteKey,
    url: String(rawUrl || '').trim(),
    hostname: getSiteSafetyHostname(rawUrl),
    safety: String(safety || 'Unknown').trim() || 'Unknown',
    bucket: 'unknown',
    riskLevel: 'unknown',
    safe: false,
    riskScore: 0,
    stats: normalizeSiteSafetyStats(),
    categories: [],
    detections: [],
    engineCount: 0,
    reason: String(extra?.error || safety || '').trim(),
    scanDate: null,
    firstSeenAt: null,
    lastScannedAt: null,
    lastVisitedAt: null,
    visitCount: 0,
    ...extra
  };
}

async function rememberSiteSafetyReport(rawUrl, report, options = {}) {
  if (!report?.success) return null;

  const siteKey = normalizeSiteSafetyUrl(rawUrl);
  if (!siteKey) return null;

  await loadSiteSafetyCache();

  const existing = vtWebsiteSafetyIndex.get(siteKey) || null;
  const now = new Date().toISOString();
  const bucket = mapSiteRiskLevelToBucket(report.riskLevel);
  const previousVisits = Math.max(0, toNonNegativeInt(existing?.visitCount, 0));
  const nextVisitCount = options.recordVisit ? previousVisits + 1 : Math.max(1, previousVisits);

  const normalized = normalizeStoredSiteSafetyEntry({
    siteKey,
    url: siteKey,
    bucket,
    riskLevel: report.riskLevel,
    riskScore: report.riskScore,
    stats: report.stats,
    categories: report.categories,
    detections: report.detections,
    engineCount: report.engineCount,
    reason: report.reason,
    scanDate: report.scanDate,
    firstSeenAt: existing?.firstSeenAt || now,
    lastScannedAt: now,
    lastVisitedAt: options.recordVisit || !existing ? now : (existing?.lastVisitedAt || now),
    visitCount: nextVisitCount,
    lastSourceUrl: String(options.visitedUrl || rawUrl || siteKey).trim() || siteKey
  }, bucket);

  if (!normalized) return null;

  vtWebsiteSafetyIndex.set(siteKey, normalized);
  await persistSiteSafetyCache();
  return normalized;
}

async function ensureSiteSafetyStatus(rawUrl, options = {}) {
  const siteKey = normalizeSiteSafetyUrl(rawUrl);
  if (!siteKey) {
    return buildSiteSafetyError(rawUrl, 'Not available for this page', { code: 'not_scannable' });
  }

  await loadSiteSafetyCache();

  const existing = vtWebsiteSafetyIndex.get(siteKey) || null;
  if (existing && options.forceScan !== true) {
    if (options.recordVisit) {
      const touched = normalizeStoredSiteSafetyEntry({
        ...existing,
        lastVisitedAt: new Date().toISOString(),
        lastSourceUrl: String(rawUrl || existing.lastSourceUrl || existing.siteKey).trim() || existing.siteKey,
        visitCount: Math.max(0, toNonNegativeInt(existing.visitCount, 0)) + 1
      }, existing.bucket);
      if (touched) {
        vtWebsiteSafetyIndex.set(siteKey, touched);
        await persistSiteSafetyCache();
        return buildSiteSafetyResponse(touched, { cached: true, source: 'cache' });
      }
    }
    return buildSiteSafetyResponse(existing, { cached: true, source: 'cache' });
  }

  if (options.allowScan === false) {
    return buildSiteSafetyError(rawUrl, 'Not scanned', { code: 'cache_miss' });
  }

  const vtEnabled = cachedSettings?.features?.enableVirusTotal ?? false;
  if (!virusTotalClient) virusTotalClient = new VirusTotalClient(cachedSettings);
  else virusTotalClient.updateSettings(cachedSettings);
  const apiKey = String(options.apiKey || getVirusTotalApiKeyFromEnv() || virusTotalClient.getApiKey() || '').trim();

  if (!vtEnabled) {
    return buildSiteSafetyError(siteKey, 'VirusTotal disabled', { code: 'vt_disabled' });
  }
  if (!apiKey) {
    return buildSiteSafetyError(siteKey, 'VirusTotal key missing', { code: 'vt_key_missing' });
  }

  if (vtWebsiteSafetyInflight.has(siteKey) && options.forceScan !== true) {
    return await vtWebsiteSafetyInflight.get(siteKey);
  }

  const scanPromise = (async () => {
    try {
      const report = await virusTotalClient.scanUrlDetailed(siteKey, {
        apiKey,
        force: true,
        timeoutMs: 9000
      });

      if (!report?.success) {
        return buildSiteSafetyError(siteKey, report?.error || 'Check failed', {
          code: 'scan_failed',
          error: report?.error || 'Check failed'
        });
      }

      const stored = await rememberSiteSafetyReport(siteKey, report, {
        visitedUrl: rawUrl,
        recordVisit: options.recordVisit === true
      });

      return stored
        ? buildSiteSafetyResponse(stored, { cached: false, source: 'scan' })
        : buildSiteSafetyError(siteKey, 'Check failed', { code: 'cache_store_failed' });
    } catch (error) {
      return buildSiteSafetyError(siteKey, error?.message || 'Check failed', {
        code: 'scan_failed',
        error: error?.message || 'Check failed'
      });
    } finally {
      vtWebsiteSafetyInflight.delete(siteKey);
    }
  })();

  vtWebsiteSafetyInflight.set(siteKey, scanPromise);
  return await scanPromise;
}

function normalizeMemoryValueToMB(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num > 262144 && num < 1e12) {
    return Math.round(num / (1024 * 1024));
  }
  return Math.round(num);
}

function extractGpuInfoPayload(info) {
  const payload = {
    availableMemory: 0,
    totalMemoryMB: 0,
    dedicatedMemoryMB: 0,
    sharedMemoryMB: 0,
    isIntegrated: false,
    name: '',
    source: 'electron'
  };

  const gpuDevice = Array.isArray(info?.gpuDevice) ? info.gpuDevice[0] : null;
  if (gpuDevice) {
    payload.name = String(gpuDevice.deviceString || gpuDevice.vendorString || '').trim();
    const active = gpuDevice.active !== false;
    payload.isIntegrated = active && /intel|uhd|iris|integrated/i.test(payload.name);
  }

  const aux = info?.auxAttributes && typeof info.auxAttributes === 'object' ? info.auxAttributes : {};
  const dedicatedCandidates = [
    aux.dedicatedVideoMemory,
    aux.dedicatedSystemMemory,
    gpuDevice?.videoMemory,
    gpuDevice?.dedicatedVideoMemory
  ].map(normalizeMemoryValueToMB).filter(Boolean);

  const sharedCandidates = [
    aux.sharedSystemMemory,
    gpuDevice?.sharedSystemMemory
  ].map(normalizeMemoryValueToMB).filter(Boolean);

  const totalCandidates = [
    aux.totalVideoMemory
  ].map(normalizeMemoryValueToMB).filter(Boolean);

  payload.dedicatedMemoryMB = dedicatedCandidates.length ? Math.max(...dedicatedCandidates) : 0;
  payload.sharedMemoryMB = sharedCandidates.length ? Math.max(...sharedCandidates) : 0;
  payload.totalMemoryMB = totalCandidates.length
    ? Math.max(...totalCandidates)
    : Math.max(payload.dedicatedMemoryMB + payload.sharedMemoryMB, payload.dedicatedMemoryMB, payload.sharedMemoryMB);

  payload.availableMemory = getGpuUsableMemoryMB(payload);
  return payload;
}

function getGpuUsableMemoryMB(device = {}) {
  const dedicated = Math.max(0, Number(device?.dedicatedMemoryMB || 0));
  const shared = Math.max(0, Number(device?.sharedMemoryMB || 0));
  const total = Math.max(0, Number(device?.totalMemoryMB || 0));
  const isIntegrated = device?.isIntegrated === true;

  if (dedicated > 0) return dedicated;
  if (!isIntegrated) return total || shared || 0;

  const integratedCandidate = total || shared || 0;
  if (!integratedCandidate) return 0;
  if (integratedCandidate <= 4096) return integratedCandidate;
  return Math.min(integratedCandidate, 2048);
}

function parseDxdiagDisplayValue(line = '') {
  const match = String(line || '').match(/:\s*([0-9]+(?:\.[0-9]+)?)\s*MB/i);
  return match ? Math.round(Number(match[1])) : 0;
}

function parseDxdiagGpuInfo(text = '') {
  const raw = String(text || '');
  if (!raw.trim()) return null;

  const sections = raw.split(/-{10,}\r?\nDisplay Devices\r?\n-{10,}/i);
  const displayBlock = sections.length > 1 ? sections[1] : raw;
  const deviceBlocks = displayBlock.split(/\r?\n(?=\s*Card name:)/).map((block) => block.trim()).filter(Boolean);
  if (!deviceBlocks.length) return null;

  const parseDevice = (block) => {
    const lines = block.split(/\r?\n/);
    const getLine = (label) => lines.find((line) => line.trim().toLowerCase().startsWith(label.toLowerCase()));
    const nameLine = getLine('Card name:');
    const displayMemoryLine = getLine('Display Memory:');
    const dedicatedMemoryLine = getLine('Dedicated Memory:');
    const sharedMemoryLine = getLine('Shared Memory:');
    const hybridLine = getLine('Hybrid Graphics GPU:');

    const name = nameLine ? nameLine.split(':').slice(1).join(':').trim() : '';
    const dedicatedMemoryMB = parseDxdiagDisplayValue(dedicatedMemoryLine);
    const sharedMemoryMB = parseDxdiagDisplayValue(sharedMemoryLine);
    const totalMemoryMB = parseDxdiagDisplayValue(displayMemoryLine) || dedicatedMemoryMB + sharedMemoryMB;
    const isIntegrated = /integrated/i.test(String(hybridLine || '')) || /intel|uhd|iris/i.test(name);
    const availableMemory = getGpuUsableMemoryMB({ dedicatedMemoryMB, sharedMemoryMB, totalMemoryMB, isIntegrated });

    return {
      availableMemory,
      totalMemoryMB,
      dedicatedMemoryMB,
      sharedMemoryMB,
      isIntegrated,
      name,
      source: 'dxdiag'
    };
  };

  const parsedDevices = deviceBlocks.map(parseDevice).filter((device) => device.availableMemory > 0);
  if (!parsedDevices.length) return null;
  return parsedDevices.sort((a, b) => {
    if ((b.dedicatedMemoryMB || 0) !== (a.dedicatedMemoryMB || 0)) {
      return (b.dedicatedMemoryMB || 0) - (a.dedicatedMemoryMB || 0);
    }
    if (a.isIntegrated !== b.isIntegrated) {
      return Number(a.isIntegrated) - Number(b.isIntegrated);
    }
    if ((b.totalMemoryMB || 0) !== (a.totalMemoryMB || 0)) {
      return (b.totalMemoryMB || 0) - (a.totalMemoryMB || 0);
    }
    return (b.availableMemory || 0) - (a.availableMemory || 0);
  })[0];
}

function parseBytesToMB(value = 0) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric / (1024 * 1024));
}

function parseWindowsVideoControllerInfo(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return null;
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const devices = items.map((item) => {
    const name = String(item?.Name || item?.VideoProcessor || '').trim();
    const adapterRAMMB = parseBytesToMB(item?.AdapterRAM);
    const isIntegrated = /intel|uhd|iris|integrated/i.test(name);
    return {
      availableMemory: adapterRAMMB,
      totalMemoryMB: adapterRAMMB,
      dedicatedMemoryMB: adapterRAMMB,
      sharedMemoryMB: 0,
      isIntegrated,
      name,
      source: 'cim'
    };
  }).filter((device) => device.availableMemory > 0);

  if (!devices.length) return null;
  return devices.sort((a, b) => {
    if (a.isIntegrated !== b.isIntegrated) return Number(b.isIntegrated) - Number(a.isIntegrated);
    return (b.availableMemory || 0) - (a.availableMemory || 0);
  })[0];
}

function getWindowsVideoControllerInfoPayload() {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,VideoProcessor | ConvertTo-Json -Compress"
      ],
      { windowsHide: true, timeout: 10000 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        const parsed = parseWindowsVideoControllerInfo(stdout);
        if (parsed) {
          resolve(parsed);
          return;
        }
        reject(new Error('Video controller memory could not be parsed.'));
      }
    );
  });
}

function getWindowsDxdiagGpuInfoPayload() {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(os.tmpdir(), `omx-dxdiag-${process.pid}.txt`);
    execFile(
      'dxdiag.exe',
      ['/whql:off', '/t', outputPath],
      { windowsHide: true, timeout: 15000 },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          const text = fs.readFileSync(outputPath, 'utf8');
          const parsed = parseDxdiagGpuInfo(text);
          if (parsed) {
            resolve(parsed);
            return;
          }
          reject(new Error('dxdiag GPU memory could not be parsed.'));
        } catch (readError) {
          reject(readError);
        } finally {
          try { fs.unlinkSync(outputPath); } catch (_) {}
        }
      }
    );
  });
}

ipcMain.handle('bookmarks-get', () => getStoredBookmarks());
ipcMain.handle('bookmarks-add', async (_event, bookmark = {}) => {
  const list = getStoredBookmarks();
  const url = String(bookmark.url || '').trim();
  if (!url) return list;
  const now = Date.now();
  const existingIndex = list.findIndex((item) => item.url === url);
  const base = {
    id: String(bookmark.id || `bm-${now}-${Math.random().toString(36).slice(2, 8)}`),
    url,
    title: String(bookmark.title || url),
    favicon: String(bookmark.favicon || ''),
    createdAt: Number(bookmark.createdAt || now)
  };
  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...base, id: list[existingIndex].id };
  } else {
    list.unshift(base);
  }
  const nextList = bookmarksStore.set(list);
  bookmarksStore.scheduleFlush();
  return nextList;
});
ipcMain.handle('bookmarks-delete', async (_event, id) => {
  const list = getStoredBookmarks().filter((item) => item.id !== id);
  const nextList = bookmarksStore.set(list);
  bookmarksStore.scheduleFlush();
  return nextList;
});

ipcMain.handle('history-get', () => getStoredHistory());
ipcMain.handle('history-push', async (_event, item = {}) => {
  const list = getStoredHistory();
  const url = String(item.url || '').trim();
  if (!url) return list;
  const entry = {
    id: String(item.id || `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    url,
    title: String(item.title || url),
    favicon: String(item.favicon || ''),
    timestamp: Number(item.timestamp || Date.now())
  };
  list.unshift(entry);
  const nextList = historyStore.set(list);
  historyStore.scheduleFlush();
  return nextList;
});
ipcMain.handle('history-delete', async (_event, timestamp) => {
  const ts = Number(timestamp);
  const list = getStoredHistory().filter((item) => Number(item.timestamp) !== ts);
  const nextList = historyStore.set(list);
  historyStore.scheduleFlush();
  return nextList;
});
ipcMain.handle('history-clear', async () => {
  historyStore.set([]);
  await historyStore.flush();
  return true;
});

// Downloads management
const getStoredDownloadById = (id) => {
  const target = String(id || '').trim();
  if (!target) return null;
  return getStoredDownloads().find((item) => String(item?.id || '').trim() === target) || null;
};

const resolveDownloadPath = (id) => {
  const active = activeDownloadItems.get(String(id || '').trim());
  const activePath = active?.resolveSavePath?.() || (active?.item && typeof active.item.getSavePath === 'function' ? active.item.getSavePath() : null);
  const stored = getStoredDownloadById(id);
  return activePath || stored?.savePath || stored?.path || '';
};

ipcMain.handle('downloads-get', () => getStoredDownloads());

ipcMain.handle('downloads-clear', async () => {
  downloadsStore.set([]);
  await downloadsStore.flush();
  return true;
});

ipcMain.handle('downloads-open-file', async (_event, id) => {
  try {
    const filePath = resolveDownloadPath(id);
    if (!filePath || !fs.existsSync(filePath)) return false;
    if (isTextBasedLocalFile(filePath)) {
      await openTextFileInEditor(filePath);
      return { success: true, handledInternally: false };
    }
    if (isBrowserOpenableLocalFile(filePath)) {
      return {
        success: true,
        handledInternally: true,
        url: pathToFileURL(filePath).toString()
      };
    }
    await shell.openPath(filePath);
    return { success: true, handledInternally: false };
  } catch (_) {
    return { success: false };
  }
});

ipcMain.handle('downloads-show-in-folder', async (_event, id) => {
  try {
    const filePath = resolveDownloadPath(id);
    if (!filePath || !fs.existsSync(filePath)) return false;
    shell.showItemInFolder(filePath);
    return true;
  } catch (_) {
    return false;
  }
});

ipcMain.handle('downloads-pause', async (_event, id) => {
  const entry = activeDownloadItems.get(String(id || '').trim());
  if (!entry?.item || entry.cancelRequested) return false;
  try { entry.item.pause(); return true; } catch (_) { return false; }
});

ipcMain.handle('downloads-resume', async (_event, id) => {
  const entry = activeDownloadItems.get(String(id || '').trim());
  if (!entry?.item || entry.cancelRequested) return false;
  try { entry.item.resume(); return true; } catch (_) { return false; }
});

ipcMain.handle('downloads-cancel', async (_event, id) => {
  const targetId = String(id || '').trim();
  const entry = activeDownloadItems.get(targetId);
  if (!entry?.item || !entry.data) return false;
  if (entry.cancelRequested || ['cancelled', 'completed', 'blocked', 'interrupted'].includes(String(entry.data.state || '').toLowerCase())) {
    return true;
  }

  entry.cancelRequested = true;
  entry.data.state = 'cancelled';
  entry.data.reason = 'Cancelled by user';

  try { entry.data.receivedBytes = entry.item.getReceivedBytes(); } catch (_) {}
  try { entry.data.totalBytes = entry.item.getTotalBytes(); } catch (_) {}

  const resolvedPath = entry.resolveSavePath?.() || '';
  entry.data.savePath = resolvedPath || entry.data.savePath || '';
  entry.data.saveDir = entry.data.savePath ? path.dirname(entry.data.savePath) : (entry.data.saveDir || '');

  activeDownloadItems.delete(targetId);
  persistAndBroadcastDownload(entry.data);

  try {
    entry.item.cancel();
    return true;
  } catch (_) {
    return false;
  }
});

ipcMain.on('notification-show', (_event, payload = {}) => {
  const title = String(payload?.title || '').trim() || 'Notification';
  const message = String(payload?.message ?? payload?.body ?? '').trim();
  const source = String(payload?.source || '').trim();
  const type = String(payload?.type || '').trim().toLowerCase() || 'info';
  const url = String(payload?.url || '').trim();
  const tabId = payload?.tabId ?? null;

  broadcast('notification', {
    title,
    message,
    source,
    type,
    url,
    tabId,
    icon: String(payload?.icon || '').trim(),
    timestamp: Date.now()
  });
});

ipcMain.handle('downloads-start', async (event, url, options = {}) => {
  try {
    const targetUrl = normalizeNetworkUrl(url, EXTENDED_DOWNLOAD_PROTOCOLS);

    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.saveAs || opts.filename) {
      pendingSaveAs.set(targetUrl, {
        saveAs: Boolean(opts.saveAs),
        filename: opts.filename ? String(opts.filename).trim() : null
      });
    }

    const senderWindow = BrowserWindow.fromWebContents(event?.sender) || mainWindow;
    if (!senderWindow || senderWindow.isDestroyed()) throw new Error('No active window available');
    senderWindow.webContents.downloadURL(targetUrl);
    return { success: true };
  } catch (error) {
    console.error('[Downloads] start failed:', error);
    return { success: false, error: error?.message || 'Download failed' };
  }
});

ipcMain.handle('llama:get-gpu-info', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'llama:get-gpu-info', async () => {
  return getCachedGpuInfoPayload();
}));

ipcMain.handle('mcp:start-server', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'mcp:start-server', async (event, config = {}) => {
  ensureTrustedServerControlSender(event);
  if (mcpServerProcess && !mcpServerProcess.killed) {
    return { success: false, error: 'MCP server is already running.' };
  }

  const { host, port, enabledTools } = buildMcpRuntimeConfig(config);
  if (!Object.values(enabledTools).some(Boolean)) {
    return { success: false, error: 'Enable at least one MCP tool before starting the server.' };
  }

  if (!fs.existsSync(OMX_MCP_MODULE)) {
    return { success: false, error: 'MCP server entry not found.' };
  }

  const alwaysOn = Boolean(cachedSettings?.mcp?.alwaysOn);
  if (alwaysOn) {
    const backgroundResult = await startMcpBackground({ host, port, enabledTools });
    if (!backgroundResult?.success) {
      return backgroundResult;
    }
    serverStarts.mcp = serverStarts.mcp || Date.now();
    serverConfigs.mcp = {
      host: backgroundResult.host || host,
      port: backgroundResult.port || port,
      enabledTools: backgroundResult.enabledTools || enabledTools
    };
    pushServerLog('mcp', 'success', `MCP background server listening at http://${serverConfigs.mcp.host}:${serverConfigs.mcp.port}/mcp`);
    pushServerLog('mcp', 'info', 'MCP started in Always On background mode.');
    return {
      success: true,
      pid: backgroundResult.pid || null,
      host: serverConfigs.mcp.host,
      port: serverConfigs.mcp.port,
      enabledTools: serverConfigs.mcp.enabledTools,
      alwaysOnBackground: true,
      alreadyRunning: Boolean(backgroundResult.alreadyRunning)
    };
  }

  if (isMcpBackgroundRunning()) {
    const bgConfig = readMcpBackgroundConfig();
    const bgHost = String(bgConfig?.host || host).trim() || host;
    const bgPort = Number(bgConfig?.port || port) || port;
    serverConfigs.mcp = {
      host: bgHost,
      port: bgPort,
      enabledTools: bgConfig?.enabledTools || enabledTools
    };
    return {
      success: true,
      pid: null,
      host: bgHost,
      port: bgPort,
      enabledTools: bgConfig?.enabledTools || enabledTools,
      alreadyRunning: true,
      alwaysOnBackground: true
    };
  }

  try {
    const webApiKeys = getScraperWebApiKeysFromEnv();
    const llm = resolveMcpLlmConfig();

    const moduleRef = await loadMcpModule();
    await moduleRef.startServer({
      host,
      port,
      enabledTools,
      apiKeys: {
        serpApiKey: webApiKeys.serpapi,
        tavilyApiKey: webApiKeys.tavily,
        newsApiKey: webApiKeys.newsapi
      },
      llm: {
        provider: llm.provider,
        baseUrl: llm.baseUrl,
        apiKey: llm.apiKey,
        model: llm.model
      }
    });
    mcpServerProcess = {
      pid: process.pid,
      killed: false,
      kill: () => {
        mcpServerProcess.killed = true;
        return true;
      }
    };
    serverStarts.mcp = Date.now();
    serverConfigs.mcp = {
      host,
      port,
      enabledTools,
      llm: {
        provider: llm.provider,
        baseUrl: llm.baseUrl,
        model: llm.model
      }
    };
    pushServerLog('mcp', 'info', `MCP HTTP server listening at http://${host}:${port}/mcp`);
    pushServerLog('mcp', 'info', `OpenAI-compatible chat endpoint listening at http://${host}:${port}/v1/chat/completions`);
    mainWindow?.webContents?.send('mcp-server-output', { type: 'stdout', data: `MCP HTTP server listening at http://${host}:${port}/mcp\n` });
    mainWindow?.webContents?.send('mcp-server-output', { type: 'stdout', data: `OpenAI-compatible chat endpoint listening at http://${host}:${port}/v1/chat/completions\n` });
    mainWindow?.webContents?.send('mcp-server-output', { type: 'stdout', data: `Enabled MCP tool groups: ${Object.entries(enabledTools).filter(([, enabled]) => enabled).map(([name]) => name).join(', ')}\n` });
    return { success: true, pid: mcpServerProcess.pid, host, port, enabledTools };
  } catch (e) {
    mcpServerProcess = null;
    serverStarts.mcp = null;
    serverConfigs.mcp = null;
    pushServerLog('mcp', 'error', e?.stack || e?.message || String(e));
    mainWindow?.webContents?.send('mcp-server-output', { type: 'error', data: `${e?.stack || e?.message || String(e)}\n` });
    return { success: false, error: e?.message || 'Failed to start MCP server.' };
  }
}));

ipcMain.handle('mcp:stop-server', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'mcp:stop-server', async (event) => {
  ensureTrustedServerControlSender(event);
  if (!mcpServerProcess || mcpServerProcess.killed) {
    if (isMcpBackgroundRunning()) {
      await stopMcpBackground();
      serverStarts.mcp = null;
      serverConfigs.mcp = null;
      return { success: true, alwaysOnBackground: true };
    }
    return { success: false, error: 'MCP server is not running.' };
  }
  try {
    const moduleRef = await loadMcpModule();
    await moduleRef.stopServer();
    mcpServerProcess.kill();
  } catch (e) {}
  serverStarts.mcp = null;
  serverConfigs.mcp = null;
  mcpServerProcess = null;
  return { success: true };
}));

ipcMain.handle('omchat:start-server', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'omchat:start-server', async (event, config = {}) => {
  ensureTrustedServerControlSender(event);
  return startOmChatServerInternal(config);
}));

ipcMain.handle('omchat:stop-server', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'omchat:stop-server', async (event) => {
  ensureTrustedServerControlSender(event);
  return stopOmChatServerInternal();
}));

ipcMain.handle('omchat:check-background', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'omchat:check-background', async (event) => {
  ensureTrustedServerControlSender(event);
  const running = isBackgroundServerRunning();
  const url = running ? getBackgroundServerUrl() : '';
  return { running, url };
}));

ipcMain.handle('omchat:kill-background', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'omchat:kill-background', async (event) => {
  ensureTrustedServerControlSender(event);
  const killed = killBackgroundServer();
  return { success: killed };
}));

ipcMain.handle('omchat:select-db-folder', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.system, 'omchat:select-db-folder', async (event) => {
  ensureTrustedServerControlSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select OmChat Local Database Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths?.length) return { success: false, canceled: true };
  return { success: true, folderPath: result.filePaths[0] };
}));

ipcMain.handle('omchat:get-db-config', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.system, 'omchat:get-db-config', async (event) => {
  ensureTrustedServerControlSender(event);
  const settings = cachedSettings || {};
  const omchat = settings.omchat || {};
  return {
    localDbPath: omchat.localDbPath || ''
  };
}));

ipcMain.handle('openwebui:get-status', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'openwebui:get-status', async (event) => {
  ensureTrustedServerControlSender(event);
  return getOpenWebUiSetupState();
}));

ipcMain.handle('openwebui:probe', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'openwebui:probe', async (event) => {
  ensureTrustedServerControlSender(event);
  const localUrl = getOpenWebUiLocalUrl();
  const running = await checkTcpPort(OPEN_WEBUI_HOST, OPEN_WEBUI_PORT);
  return {
    success: true,
    running,
    localUrl
  };
}));

ipcMain.handle('openwebui:start', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'openwebui:start', async (event) => {
  ensureTrustedServerControlSender(event);

  const state = await getOpenWebUiSetupState();
  if (state.running) {
    return { success: true, alreadyRunning: true, localUrl: state.localUrl };
  }

  if (state.phase === 'install-prereqs' || state.phase === 'setup-env') {
    return { success: false, needsSetup: true, ...state };
  }

  if (isServerProcessActive(openWebUiProcess)) {
    return { success: false, alreadyStarting: true, error: 'Open WebUI is still starting. Please wait.', localUrl: state.localUrl };
  }

  if (openWebUiStartInProgress) {
    return { success: false, alreadyStarting: true, error: 'Open WebUI is already starting.', localUrl: state.localUrl };
  }

  const condaExe = await resolveCondaExecutable();
  if (!condaExe) {
    return { success: false, error: 'Miniconda was not found. Install Miniconda first.', needsSetup: true, ...state };
  }
  const condaActivateScript = resolveCondaActivationScript(condaExe);
  if (!condaActivateScript) {
    return { success: false, error: 'Miniconda activation script was not found. Please reinstall Miniconda.', needsSetup: true, ...state };
  }

  const localUrl = getOpenWebUiLocalUrl();
  const workingDir = getOpenWebUiWorkingDir();
  try {
    fs.mkdirSync(workingDir, { recursive: true });
  } catch (_) {}

  openWebUiStartInProgress = true;
  pushServerLog('openwebui', 'info', `Starting Open WebUI on ${localUrl}`);
  pushServerLog('openwebui', 'info', `Activating Miniconda env: ${OPEN_WEBUI_ENV_NAME}`);

  try {
    const cmdExe = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    const normalizedCondaActivateScript = unwrapWrappedQuotes(condaActivateScript);
    const command = `call ${normalizedCondaActivateScript} activate ${OPEN_WEBUI_ENV_NAME} && open-webui serve --host ${OPEN_WEBUI_HOST} --port ${OPEN_WEBUI_PORT}`;
    const { childEnv, ffmpegPath, hfTokenConfigured } = buildOpenWebUiChildEnv(localUrl);
    let openWebUiLastActivityAt = Date.now();
    pushServerLog('openwebui', 'info', 'Launching Open WebUI with local auth disabled so the UI opens directly.');
    pushServerLog('openwebui', 'info', `Using CORS_ALLOW_ORIGIN=${localUrl}`);
    pushServerLog('openwebui', 'info', ffmpegPath ? `Using ffmpeg from ${ffmpegPath}` : 'ffmpeg was not found on PATH. Suppressing the pydub warning; audio transcoding may stay unavailable until ffmpeg is installed.');
    pushServerLog('openwebui', 'info', hfTokenConfigured
      ? 'Using Hugging Face token from the Om-X environment for Open WebUI downloads.'
      : 'HF_TOKEN is not set. First launch may take longer while Open WebUI downloads Hugging Face assets anonymously.');
    pushServerLog('openwebui', 'info', 'First launch can take a few minutes while Open WebUI applies migrations and downloads required models.');
    openWebUiProcess = spawn(cmdExe, ['/d', '/c', `"${command}"`], {
      cwd: workingDir,
      stdio: 'pipe',
      env: childEnv,
      windowsHide: true,
      windowsVerbatimArguments: true
    });

    serverStarts.openwebui = Date.now();
    serverConfigs.openwebui = {
      envName: OPEN_WEBUI_ENV_NAME,
      host: OPEN_WEBUI_HOST,
      launchHost: OPEN_WEBUI_HOST,
      port: OPEN_WEBUI_PORT,
      localUrl
    };

    openWebUiProcess.stdout.on('data', (data) => {
      const text = data.toString();
      openWebUiLastActivityAt = Date.now();
      pushServerLog('openwebui', 'info', text);
      mainWindow?.webContents?.send('openwebui-output', { type: 'info', data: text });
    });
    openWebUiProcess.stderr.on('data', (data) => {
      const text = data.toString();
      openWebUiLastActivityAt = Date.now();
      pushServerLog('openwebui', 'warn', text);
      mainWindow?.webContents?.send('openwebui-output', { type: 'warn', data: text });
    });
    openWebUiProcess.on('error', (error) => {
      const text = error?.message || String(error);
      pushServerLog('openwebui', 'error', text);
      mainWindow?.webContents?.send('openwebui-output', { type: 'error', data: text });
    });
    openWebUiProcess.on('exit', (code, signal) => {
      openWebUiStartInProgress = false;
      openWebUiProcess = null;
      serverStarts.openwebui = null;
      serverConfigs.openwebui = null;
      const wasManualStop = openWebUiManualStop;
      openWebUiManualStop = false;
      const reason = `Open WebUI exited (${code ?? 'null'}${signal ? `, ${signal}` : ''}).`;
      pushServerLog('openwebui', wasManualStop || Number(code) === 0 ? 'info' : 'error', reason);
      mainWindow?.webContents?.send('openwebui-exit', { code, signal, manualStop: wasManualStop });
    });

    const spawnedProcess = openWebUiProcess;
    const ready = await waitForServerReady({
      host: OPEN_WEBUI_HOST,
      port: OPEN_WEBUI_PORT,
      proc: spawnedProcess,
      timeoutMs: OPEN_WEBUI_START_TIMEOUT_MS,
      getLastActivityTime: () => openWebUiLastActivityAt,
      idleGraceMs: OPEN_WEBUI_START_IDLE_GRACE_MS,
      maxTimeoutMs: OPEN_WEBUI_START_MAX_TIMEOUT_MS
    });

    if (!ready) {
      const processExited = !isServerProcessActive(spawnedProcess);
      const slowStartHint = hfTokenConfigured
        ? 'The local service stayed up but never opened its port after several minutes.'
        : 'The local service stayed up but never opened its port after several minutes. Adding HF_TOKEN to .env and restarting Om-X can help first-run downloads finish faster.';
      const error = processExited
        ? 'Open WebUI exited before it became available.'
        : `Open WebUI did not open ${localUrl}. ${slowStartHint}`;
      pushServerLog('openwebui', 'error', error);
      openWebUiManualStop = true;
      await terminateManagedChildProcess(spawnedProcess);
      if (openWebUiProcess === spawnedProcess) {
        openWebUiProcess = null;
      }
      serverStarts.openwebui = null;
      serverConfigs.openwebui = null;
      return { success: false, error };
    }

    pushServerLog('openwebui', 'success', `Open WebUI is available at ${localUrl}`);
    return { success: true, localUrl };
  } catch (error) {
    openWebUiProcess = null;
    serverStarts.openwebui = null;
    serverConfigs.openwebui = null;
    return { success: false, error: error?.message || 'Failed to start Open WebUI.' };
  } finally {
    openWebUiStartInProgress = false;
  }
}));

ipcMain.handle('openwebui:stop', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'openwebui:stop', async (event) => {
  ensureTrustedServerControlSender(event);
  await stopOpenWebUiInternal();
  pushServerLog('openwebui', 'info', 'Open WebUI stopped.');
  return { success: true };
}));

ipcMain.handle('ollama:kill-for-tab-close', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'ollama:kill-for-tab-close', async (_event, options = {}) => {
  if (process.platform !== 'win32') {
    return { success: false, skipped: true, error: 'taskkill is only available on Windows.' };
  }

  const killPython = options?.killPython === true;
  const runs = [];
  for (let i = 0; i < 2; i++) {
    runs.push(await execFileAsync('taskkill', ['/F', '/IM', 'ollama.exe'], { timeout: 15000 }));
  }
  if (killPython) {
    runs.push(await execFileAsync('taskkill', ['/IM', 'python.exe', '/F'], { timeout: 15000 }));
  }

  return {
    success: runs.every((run) => run?.ok),
    runs
  };
}));

ipcMain.handle('server:get-status', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainOrServerOperator, 'server:get-status', async (_event, name) => {
  const serverName = String(name || '').trim().toLowerCase();
  if (serverName === 'lan') {
    return getCachedServerStatus('lan', async () => getLanStatusPayload());
  }
  if (serverName === 'omchat') {
    return getCachedServerStatus('omchat', () => getOmChatStatusPayload());
  }
  if (serverName === 'mcp') {
    return getCachedServerStatus('mcp', async () => {
      const status = getServerStatusPayload('mcp');
      const readinessHost = status.config?.launchHost || status.config?.localHost || status.config?.host;
      const ready = readinessHost && status.config?.port
        ? await checkTcpPort(readinessHost, status.config.port)
        : false;
      if (!ready && isMcpBackgroundRunning()) {
        const bgConfig = readMcpBackgroundConfig();
        const bgHost = bgConfig?.host || '127.0.0.1';
        const bgPort = Number(bgConfig?.port || 3000) || 3000;
        const bgReady = await checkTcpPort(bgHost, bgPort);
        return {
          success: true,
          status: {
            name: 'mcp',
            running: bgReady,
            ready: bgReady,
            pid: null,
            startedAt: serverStarts.mcp || null,
            config: bgConfig ? { ...bgConfig, host: bgHost, port: bgPort } : (serverConfigs.mcp || null),
            alwaysOnBackground: bgReady
          }
        };
      }
      return { success: true, status: { ...status, running: status.running && ready, ready } };
    });
  }
  if (serverName === 'llama') {
    const status = await getCachedServerStatus('llama', () => getLlamaStatusPayload());
    return { success: true, status };
  }
  if (!serverLogs[serverName]) {
    return { success: false, error: 'Unknown server.' };
  }
  return getCachedServerStatus(serverName, async () => {
    const status = getServerStatusPayload(serverName);
    const readinessHost = status.config?.launchHost || status.config?.localHost || status.config?.host;
    const ready = readinessHost && status.config?.port
      ? await checkTcpPort(readinessHost, status.config.port)
      : false;
    return { success: true, status: { ...status, running: status.running && ready, ready } };
  });
}));

ipcMain.handle('server:get-logs', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainOrServerOperator, 'server:get-logs', async (_event, name) => {
  const serverName = String(name || '').trim().toLowerCase();
  if (!serverLogs[serverName]) {
    return { success: false, error: 'Unknown server.' };
  }
  return { success: true, logs: serverLogs[serverName] };
}));

ipcMain.handle('llama:scan-models', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'llama:scan-models', async (event, modelsPath) => {
  ensureTrustedServerControlSender(event);
  try {
    const models = await buildLlamaModelEntries(modelsPath);
    return { success: true, models };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to scan models folder.', models: [] };
  }
}));

ipcMain.handle('llama:prepare-launch', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'llama:prepare-launch', async (event, config = {}) => {
  ensureTrustedServerControlSender(event);
  try {
    const model = String(config.model || '').trim();
    const modelsPath = String(config.modelsPath || '').trim();
    if (modelsPath) {
      addTrustedFolderPath(modelsPath);
    }
    const modelPath = path.isAbsolute(model) ? model : path.join(modelsPath || '', model);
    if (!modelPath) {
      return { success: false, error: 'Model path is required.' };
    }
    const resolvedModelPath = path.resolve(modelPath);
    trustPathForServerOperator(resolvedModelPath);
    if (!isPathInSafeDirectories(resolvedModelPath)) {
      return { success: false, error: 'Access denied: Path outside allowed directories.' };
    }
    const stat = await fs.promises.stat(resolvedModelPath);
    const siblingFiles = await listSiblingFilesForModel(resolvedModelPath);
    const gpuInfo = await getCachedGpuInfoPayload().catch(() => ({ availableMemory: 0, isIntegrated: false }));
    const memorySample = llamaMemoryGuardState?.lastSample || sampleLlamaMemoryGuard();
    const launch = prepareLlamaLaunch({
      executable: config.executable,
      cliPath: config.cliPath,
      modelPath: resolvedModelPath,
      contextLength: config.contextLength,
      gpuLayers: config.gpuLayers,
      kvCacheMode: config.kvCacheMode,
      port: config.port,
      threads: config.threads,
      host: config.host,
      systemPrompt: config.systemPrompt,
      siblingFiles,
      fileSizeMB: Math.max(1, Math.round(Number(stat.size || 0) / (1024 * 1024))),
      availableVramMB: Number(gpuInfo?.availableMemory || 0),
      availableRamMB: Number(memorySample?.freeMB || 0),
      memoryPressure: String(llamaMemoryGuardState?.pressure || 'safe').trim().toLowerCase()
    });
    return { success: true, ...launch };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to prepare llama launch.' };
  }
}));

ipcMain.handle('llama:start-server', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'llama:start-server', async (event, config = {}) => {
  ensureTrustedServerControlSender(event);
  invalidateServerStatusCache('llama');
  const existingConfig = serverConfigs.llama || {};
  const executable = String(config.executable || existingConfig.executable || '').trim();
  const model = String(config.model || '').trim();
  const modelsPath = String(config.modelsPath || '').trim();
  if (!executable || !model) {
    return { success: false, error: 'Executable and model are required.' };
  }

  if (modelsPath) {
    addTrustedFolderPath(modelsPath);
  }
  if (executable) {
    trustPathForServerOperator(executable);
  }

  const modelPath = path.isAbsolute(model) ? model : path.join(modelsPath || '', model);
  const contextLength = String(config.contextLength || existingConfig.contextLength || '4096');
  const gpuLayers = String(config.gpuLayers || existingConfig.gpuLayers || '0');
  const kvCacheMode = String(config.kvCacheMode || existingConfig.kvCacheMode || 'auto').trim().toLowerCase() || 'auto';
  const port = Number(config.port || existingConfig.port || 8080);
  const threads = String(config.threads || existingConfig.threads || '4');
  const systemPrompt = String(config.systemPrompt ?? existingConfig.systemPrompt ?? '').trim();
  const guardSettings = normalizeLlamaGuardSettings(config.guardSettings || existingConfig.guardSettings || {});
  const serverType = String(config.serverType || config.host || existingConfig.serverType || existingConfig.host || 'local').trim().toLowerCase();
  const host = serverType === 'lan' || serverType === '0.0.0.0'
    ? '0.0.0.0'
    : '127.0.0.1';
  const launchHost = ['0.0.0.0', '::'].includes(host) ? '127.0.0.1' : host;
  const resolvedModelPath = path.resolve(modelPath);
  trustPathForServerOperator(resolvedModelPath);

  if (!isPathInSafeDirectories(resolvedModelPath)) {
    return { success: false, error: 'Access denied: Path outside allowed directories.' };
  }

  let siblingFiles = [];
  let launch = null;
  try {
    const modelStat = await fs.promises.stat(resolvedModelPath);
    if (!modelStat.isFile()) {
      return { success: false, error: 'Selected model file is missing or invalid.' };
    }
    siblingFiles = await listSiblingFilesForModel(resolvedModelPath);
    const gpuInfo = await getCachedGpuInfoPayload().catch(() => ({ availableMemory: 0, isIntegrated: false }));
    const memorySample = llamaMemoryGuardState?.lastSample || sampleLlamaMemoryGuard();
    launch = prepareLlamaLaunch({
      executable,
      modelPath: resolvedModelPath,
      contextLength,
      gpuLayers,
      kvCacheMode,
      port,
      threads,
      host,
      systemPrompt,
      siblingFiles,
      fileSizeMB: Math.max(1, Math.round(Number(modelStat.size || 0) / (1024 * 1024))),
      availableVramMB: Number(gpuInfo?.availableMemory || 0),
      availableRamMB: Number(memorySample?.freeMB || 0),
      memoryPressure: String(llamaMemoryGuardState?.pressure || 'safe').trim().toLowerCase()
    });
  } catch (error) {
    return { success: false, error: error?.message || 'Selected model file is missing or invalid.' };
  }

  if (isServerProcessActive(llamaServerProcess)) {
    const effectiveContextLength = String(launch.adjustedContextLength || contextLength);
    const syncedConfig = syncLlamaServerConfig({
      executable,
      modelPath: launch.modelPath,
      modelType: launch.modelType,
      supportsVision: launch.supportsVision,
      mmprojPath: launch.mmprojPath,
      warnings: launch.warnings,
      command: launch.command,
      contextLength: effectiveContextLength,
      gpuLayers,
      kvCacheMode: launch.kvCacheMode,
      kvModeResolved: launch.kvModeResolved,
      cacheTypeK: launch.cacheTypeK,
      cacheTypeV: launch.cacheTypeV,
      estimatedKvCacheMB: launch.estimatedKvCacheMB,
      optimizationStatus: launch.optimizationStatus,
      port,
      threads,
      systemPrompt,
      guardSettings,
      host,
      serverType
    });
    if (serverType === 'ngrok') {
      try {
        await ensureLlamaNgrokTunnel({ port: syncedConfig.port });
      } catch (error) {
        return { success: false, error: error?.message || 'Failed to start llama ngrok tunnel.' };
      }
    } else {
      await stopLlamaNgrokTunnelInternal().catch(() => {});
    }
    return {
      success: true,
      alreadyRunning: true,
      pid: llamaServerProcess?.pid || null,
      serverType: syncedConfig.serverType,
      host: syncedConfig.host,
      launchHost: syncedConfig.launchHost,
      port: syncedConfig.port,
      modelPath: syncedConfig.modelPath,
      modelType: syncedConfig.modelType,
      supportsVision: syncedConfig.supportsVision,
      mmprojPath: syncedConfig.mmprojPath,
      warnings: syncedConfig.warnings,
      command: syncedConfig.command,
      kvCacheMode: syncedConfig.kvCacheMode,
      kvModeResolved: syncedConfig.kvModeResolved,
      cacheTypeK: syncedConfig.cacheTypeK,
      cacheTypeV: syncedConfig.cacheTypeV,
      estimatedKvCacheMB: syncedConfig.estimatedKvCacheMB,
      optimizationStatus: syncedConfig.optimizationStatus,
      localUrl: syncedConfig.localUrl,
      publicUrl: syncedConfig.publicUrl || '',
      url: syncedConfig.url,
      ngrokRunning: isServerProcessActive(llamaNgrokProcess),
      tunnelPid: llamaNgrokProcess?.pid || null
    };
  }

  if (llamaServerStartInProgress) {
    return { success: false, alreadyStarting: true, error: 'Llama server is already starting. Please wait.' };
  }

  let args = Array.isArray(launch?.args) ? launch.args : [];
  let activeLaunch = {
    ...launch
  };

  llamaServerStartInProgress = true;
  invalidateServerStatusCache('llama');
  try {
    const attachLlamaProcessListeners = (proc) => {
      proc.stdout.on('data', (data) => {
        pushServerLog('llama', 'info', data.toString());
        mainWindow?.webContents?.send('llama-server-output', { type: 'stdout', data: data.toString() });
      });
      proc.stderr.on('data', (data) => {
        pushServerLog('llama', 'warning', data.toString());
        mainWindow?.webContents?.send('llama-server-output', { type: 'stderr', data: data.toString() });
      });
      proc.on('error', (err) => {
        pushServerLog('llama', 'error', err?.message || String(err));
        mainWindow?.webContents?.send('llama-server-output', { type: 'error', data: err?.message || String(err) });
      });
      proc.on('exit', (code, signal) => {
        llamaServerStartInProgress = false;
        invalidateServerStatusCache('llama');
        clearLlamaMemoryGuard();
        serverStarts.llama = null;
        mainWindow?.webContents?.send('llama-server-exit', { code, signal });
        llamaServerProcess = null;
        void stopLlamaNgrokTunnelInternal().catch(() => {});
        serverConfigs.llama = null;
      });
    };
    const spawnLlamaProcess = (spawnArgs) => spawn(executable, spawnArgs, {
      cwd: path.dirname(executable),
      stdio: 'pipe'
    });
    llamaServerProcess = spawnLlamaProcess(args);
    attachLlamaProcessListeners(llamaServerProcess);
    startLlamaMemoryGuard();
    serverStarts.llama = Date.now();
    syncLlamaServerConfig({
      executable,
      modelPath: activeLaunch.modelPath,
      modelType: activeLaunch.modelType,
      supportsVision: activeLaunch.supportsVision,
      mmprojPath: activeLaunch.mmprojPath,
      warnings: activeLaunch.warnings,
      command: activeLaunch.command,
      contextLength: String(activeLaunch.adjustedContextLength || contextLength),
      gpuLayers,
      kvCacheMode: activeLaunch.kvCacheMode,
      kvModeResolved: activeLaunch.kvModeResolved,
      cacheTypeK: activeLaunch.cacheTypeK,
      cacheTypeV: activeLaunch.cacheTypeV,
      estimatedKvCacheMB: activeLaunch.estimatedKvCacheMB,
      optimizationStatus: activeLaunch.optimizationStatus,
      port,
      threads,
      systemPrompt,
      guardSettings,
      host,
      serverType
    });
    activeLaunch.warnings.forEach((warning) => {
      pushServerLog('llama', 'warning', warning);
      mainWindow?.webContents?.send('llama-server-output', { type: 'stderr', data: `${warning}\n` });
    });
    if (activeLaunch.cacheTypeK || activeLaunch.cacheTypeV) {
      const kvMessage = `[AUTO] KV cache optimized: ${activeLaunch.cacheTypeK || 'default'} / ${activeLaunch.cacheTypeV || 'default'} (${activeLaunch.optimizationStatus || 'Auto'}). Estimated KV memory: ${activeLaunch.estimatedKvCacheMB || 0} MB.`;
      pushServerLog('llama', 'info', kvMessage);
      mainWindow?.webContents?.send('llama-server-output', { type: 'stdout', data: `${kvMessage}\n` });
    }

    const spawnedProcess = llamaServerProcess;
    const startupState = await Promise.race([
      new Promise((resolve) => {
        spawnedProcess.once('error', (err) => {
          resolve({ ok: false, error: err?.message || 'Failed to launch llama server.' });
        });
        spawnedProcess.once('exit', (code, signal) => {
          resolve({ ok: false, error: `Llama server exited early (code: ${code ?? 'null'}, signal: ${signal ?? 'none'}).` });
        });
      }),
      wait(1200).then(() => ({ ok: isServerProcessActive(spawnedProcess) }))
    ]);

    if (!startupState?.ok) {
      if (activeLaunch?.hasKvCacheOverrides) {
        const fallbackArgs = stripKvCacheArgs(args);
        const fallbackMessage = 'KV flags may be unsupported by this llama.cpp build. Retrying launch without KV cache flags.';
        pushServerLog('llama', 'warning', fallbackMessage);
        mainWindow?.webContents?.send('llama-server-output', { type: 'stderr', data: `${fallbackMessage}\n` });
        clearLlamaMemoryGuard();
        if (llamaServerProcess === spawnedProcess) {
          llamaServerProcess = null;
        }
        serverStarts.llama = null;
        llamaServerProcess = spawnLlamaProcess(fallbackArgs);
        attachLlamaProcessListeners(llamaServerProcess);
        args = fallbackArgs;
        startLlamaMemoryGuard();
        serverStarts.llama = Date.now();
        activeLaunch = {
          ...activeLaunch,
          cacheTypeK: '',
          cacheTypeV: '',
          estimatedKvCacheMB: 0,
          kvModeResolved: 'fallback-default',
          optimizationStatus: 'Fallback: Unsupported KV Flags',
          hasKvCacheOverrides: false,
          warnings: Array.from(new Set([...(Array.isArray(activeLaunch.warnings) ? activeLaunch.warnings : []), fallbackMessage])),
          command: buildLlamaServerCommand({
            executable,
            modelPath: activeLaunch.modelPath,
            contextLength: activeLaunch.adjustedContextLength || contextLength,
            gpuLayers,
            port,
            threads,
            host,
            mmprojPath: activeLaunch.mmprojPath || '',
            cacheTypeK: '',
            cacheTypeV: ''
          })
        };
        syncLlamaServerConfig({
          executable,
          modelPath: activeLaunch.modelPath,
          modelType: activeLaunch.modelType,
          supportsVision: activeLaunch.supportsVision,
          mmprojPath: activeLaunch.mmprojPath,
          warnings: activeLaunch.warnings,
          command: activeLaunch.command,
          contextLength: String(activeLaunch.adjustedContextLength || contextLength),
          gpuLayers,
          kvCacheMode: activeLaunch.kvCacheMode,
          kvModeResolved: activeLaunch.kvModeResolved,
          cacheTypeK: activeLaunch.cacheTypeK,
          cacheTypeV: activeLaunch.cacheTypeV,
          estimatedKvCacheMB: activeLaunch.estimatedKvCacheMB,
          optimizationStatus: activeLaunch.optimizationStatus,
          port,
          threads,
          systemPrompt,
          guardSettings,
          host,
          serverType
        });
        const retryProcess = llamaServerProcess;
        const retryState = await Promise.race([
          new Promise((resolve) => {
            retryProcess.once('error', (err) => resolve({ ok: false, error: err?.message || 'Failed to launch llama server.' }));
            retryProcess.once('exit', (code, signal) => resolve({ ok: false, error: `Llama server exited early (code: ${code ?? 'null'}, signal: ${signal ?? 'none'}).` }));
          }),
          wait(1200).then(() => ({ ok: isServerProcessActive(retryProcess) }))
        ]);
        if (!retryState?.ok) {
          clearLlamaMemoryGuard();
          if (llamaServerProcess === retryProcess) llamaServerProcess = null;
          serverStarts.llama = null;
          await stopLlamaNgrokTunnelInternal().catch(() => {});
          serverConfigs.llama = null;
          return { success: false, error: retryState?.error || startupState?.error || 'Llama server failed to stay running.' };
        }
      } else {
      clearLlamaMemoryGuard();
      if (llamaServerProcess === spawnedProcess) {
        llamaServerProcess = null;
      }
      serverStarts.llama = null;
      await stopLlamaNgrokTunnelInternal().catch(() => {});
      serverConfigs.llama = null;
      return { success: false, error: startupState?.error || 'Llama server failed to stay running.' };
      }
    }

    const ready = await waitForServerReady({
      host: launchHost,
      port,
      proc: llamaServerProcess,
      timeoutMs: 60000
    });

    if (!ready) {
      const error = `Llama server process started but did not open http://${launchHost}:${port} within 60 seconds.`;
      pushServerLog('llama', 'error', error);
      mainWindow?.webContents?.send('llama-server-output', { type: 'error', data: `${error}\n` });
      clearLlamaMemoryGuard();
      await terminateManagedChildProcess(llamaServerProcess);
      if (llamaServerProcess) {
        llamaServerProcess = null;
      }
      serverStarts.llama = null;
      await stopLlamaNgrokTunnelInternal().catch(() => {});
      serverConfigs.llama = null;
      return { success: false, error };
    }

    let syncedConfig = syncLlamaServerConfig({
      executable,
      modelPath: activeLaunch.modelPath,
      modelType: activeLaunch.modelType,
      supportsVision: activeLaunch.supportsVision,
      mmprojPath: activeLaunch.mmprojPath,
      warnings: activeLaunch.warnings,
      command: activeLaunch.command,
      contextLength: String(activeLaunch.adjustedContextLength || contextLength),
      gpuLayers,
      kvCacheMode: activeLaunch.kvCacheMode,
      kvModeResolved: activeLaunch.kvModeResolved,
      cacheTypeK: activeLaunch.cacheTypeK,
      cacheTypeV: activeLaunch.cacheTypeV,
      estimatedKvCacheMB: activeLaunch.estimatedKvCacheMB,
      optimizationStatus: activeLaunch.optimizationStatus,
      port,
      threads,
      systemPrompt,
      guardSettings,
      host,
      serverType
    });

    if (serverType === 'ngrok') {
      try {
        const publicUrl = await ensureLlamaNgrokTunnel({ port: syncedConfig.port });
        syncedConfig = syncLlamaServerConfig({
          ...syncedConfig,
          publicUrl,
          serverType
        });
      } catch (error) {
        const tunnelError = error?.message || 'Failed to start llama ngrok tunnel.';
        pushServerLog('llama', 'error', tunnelError);
        clearLlamaMemoryGuard();
        await terminateManagedChildProcess(llamaServerProcess);
        if (llamaServerProcess) {
          llamaServerProcess = null;
        }
        serverStarts.llama = null;
        await stopLlamaNgrokTunnelInternal().catch(() => {});
        serverConfigs.llama = null;
        return { success: false, error: tunnelError };
      }
    } else {
      await stopLlamaNgrokTunnelInternal().catch(() => {});
    }

    return {
      success: true,
      pid: llamaServerProcess?.pid || null,
      serverType: syncedConfig.serverType,
      host: syncedConfig.host,
      launchHost: syncedConfig.launchHost,
      port: syncedConfig.port,
      modelPath: syncedConfig.modelPath,
      modelType: syncedConfig.modelType,
      supportsVision: syncedConfig.supportsVision,
      mmprojPath: syncedConfig.mmprojPath,
      warnings: syncedConfig.warnings,
      command: syncedConfig.command,
      kvCacheMode: syncedConfig.kvCacheMode,
      kvModeResolved: syncedConfig.kvModeResolved,
      cacheTypeK: syncedConfig.cacheTypeK,
      cacheTypeV: syncedConfig.cacheTypeV,
      estimatedKvCacheMB: syncedConfig.estimatedKvCacheMB,
      optimizationStatus: syncedConfig.optimizationStatus,
      localUrl: syncedConfig.localUrl,
      publicUrl: syncedConfig.publicUrl || '',
      url: syncedConfig.url,
      ngrokRunning: isServerProcessActive(llamaNgrokProcess),
      tunnelPid: llamaNgrokProcess?.pid || null
    };
  } catch (e) {
    llamaServerProcess = null;
    serverStarts.llama = null;
    await stopLlamaNgrokTunnelInternal().catch(() => {});
    serverConfigs.llama = null;
    return { success: false, error: e?.message || 'Failed to start llama server.' };
  } finally {
    llamaServerStartInProgress = false;
    invalidateServerStatusCache('llama');
 }
}));

ipcMain.handle('llama:stop-server', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'llama:stop-server', async (event) => {
  ensureTrustedServerControlSender(event);
  invalidateServerStatusCache('llama');
  const wasRunning = isServerProcessActive(llamaServerProcess);
  if (!wasRunning && !isServerProcessActive(llamaNgrokProcess)) {
    return { success: false, error: 'Llama server is not running.' };
  }

  clearLlamaMemoryGuard();
  if (wasRunning) {
    await terminateManagedChildProcess(llamaServerProcess);
  }

  await stopLlamaNgrokTunnelInternal().catch(() => {});
  return { success: true };
}));

ipcMain.handle('llama:send-command', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'llama:send-command', async (event, command) => {
  ensureTrustedServerControlSender(event);
  if (!isServerProcessActive(llamaServerProcess) || !llamaServerProcess.stdin) {
    return { success: false, error: 'Llama server is not running.' };
  }
  try {
    llamaServerProcess.stdin.write(`${String(command || '').trim()}\n`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || 'Failed to send command.' };
  }
}));

ipcMain.handle('llama:check-model-size', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'llama:check-model-size', async (_event, modelsPath, modelName) => {
  const basePath = String(modelsPath || '').trim();
  const name = String(modelName || '').trim();
  if (!basePath || !name) {
    return { size: 0, canLoad: true, availableMemory: 0, error: 'Invalid model path.' };
  }

  const modelPath = path.isAbsolute(name) ? name : path.join(basePath, name);
  try {
    const stat = await fs.promises.stat(modelPath);
    const sizeMB = Math.max(1, Math.round(stat.size / (1024 * 1024)));

    const { availableMemory } = await getCachedGpuInfoPayload();

    const canLoad = availableMemory > 0 ? sizeMB <= (availableMemory * 0.95) : true;
    return { size: sizeMB, canLoad, availableMemory };
  } catch (e) {
    return { size: 0, canLoad: true, availableMemory: 0, error: e?.message || 'Unable to read model size.' };
  }
}));

function getVirusTotalApiKeyFromEnv() {
  return String(
    process.env.OMX_VIRUSTOTAL_API_KEY
    || process.env.VIRUSTOTAL_API_KEY
    || process.env.VT_API_KEY
    || ''
  ).trim();
}

function splitEnvKeyList(value) {
  return String(value || '')
    .split(/[\r\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getScraperGroqKeysFromEnv() {
  const indexedKeys = [
    process.env.OMX_SCRAPER_GROQ_KEY_1,
    process.env.OMX_SCRAPER_GROQ_KEY_2,
    process.env.OMX_SCRAPER_GROQ_KEY_3,
    process.env.SCRAPER_GROQ_KEY_1,
    process.env.SCRAPER_GROQ_KEY_2,
    process.env.SCRAPER_GROQ_KEY_3,
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY
  ];

  return Array.from(new Set([
    ...splitEnvKeyList(process.env.OMX_SCRAPER_GROQ_KEYS),
    ...splitEnvKeyList(process.env.SCRAPER_GROQ_KEYS),
    ...indexedKeys.map((value) => String(value || '').trim()).filter(Boolean)
  ])).slice(0, 3);
}

function getSharedLlmApiKeyFromEnv(provider = '') {
  const normalized = String(provider || '').trim().toLowerCase();
  switch (normalized) {
    case 'google':
      return String(
        process.env.OMX_GOOGLE_API_KEY
        || process.env.GOOGLE_API_KEY
        || process.env.GEMINI_API_KEY
        || ''
      ).trim();
    case 'openai':
      return String(
        process.env.OMX_OPENAI_API_KEY
        || process.env.OPENAI_API_KEY
        || ''
      ).trim();
    case 'groq':
      return String(
        process.env.OMX_GROQ_API_KEY
        || process.env.GROQ_API_KEY
        || ''
      ).trim();
    case 'openrouter':
      return String(
        process.env.OMX_OPENROUTER_API_KEY
        || process.env.OPENROUTER_API_KEY
        || ''
      ).trim();
    case 'mistral':
      return String(
        process.env.OMX_MISTRAL_API_KEY
        || process.env.MISTRAL_API_KEY
        || ''
      ).trim();
    case 'sarvamai':
      return String(
        process.env.OMX_SARVAMAI_API_KEY
        || process.env.SARVAMAI_API_KEY
        || process.env.SARVAM_API_KEY
        || ''
      ).trim();
    default:
      return '';
  }
}

function getScraperGroqModelFromEnv() {
  return String(
    process.env.OMX_SCRAPER_GROQ_MODEL
    || process.env.SCRAPER_GROQ_MODEL
    || process.env.SCRAPER_LLM_MODEL
    || 'qwen/qwen3-32b'
  ).trim() || 'qwen/qwen3-32b';
}

function getSharedLlmModelForProvider(provider = '') {
  switch (String(provider || '').trim().toLowerCase()) {
    case 'openai':
      return String(
        process.env.OMX_OPENAI_MODEL
        || process.env.OPENAI_MODEL
        || 'gpt-4o-mini'
      ).trim() || 'gpt-4o-mini';
    case 'groq':
      return String(
        process.env.OMX_GROQ_MODEL
        || process.env.GROQ_MODEL
        || 'llama-3.3-70b-versatile'
      ).trim() || 'llama-3.3-70b-versatile';
    case 'openrouter':
      return String(
        process.env.OMX_OPENROUTER_MODEL
        || process.env.OPENROUTER_MODEL
        || 'nvidia/nemotron-3-super-120b-a12b:free'
      ).trim() || 'nvidia/nemotron-3-super-120b-a12b:free';
    case 'mistral':
      return String(
        process.env.OMX_MISTRAL_MODEL
        || process.env.MISTRAL_MODEL
        || 'mistral-medium'
      ).trim() || 'mistral-medium';
    case 'sarvamai':
      return String(
        process.env.OMX_SARVAMAI_MODEL
        || process.env.SARVAMAI_MODEL
        || process.env.SARVAM_MODEL
        || 'sarvam-m'
      ).trim() || 'sarvam-m';
    case 'google':
    default:
      return String(
        process.env.OMX_GOOGLE_MODEL
        || process.env.GOOGLE_MODEL
        || process.env.GEMINI_MODEL
        || 'gemini-3-flash-preview'
      ).trim() || 'gemini-3-flash-preview';
  }
}

function normalizeSharedLlmSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const provider = String(source.provider || DEFAULT_SETTINGS.llm.provider || 'google').trim() || 'google';
  return {
    provider,
    key: '',
    model: getSharedLlmModelForProvider(provider)
  };
}

function getScraperWebApiKeysFromEnv() {
  return {
    serpapi: String(
      process.env.OMX_SCRAPER_SERPAPI_KEY
      || process.env.SCRAPER_SERPAPI_KEY
      || process.env.SERPAPI_KEY
      || process.env.SERP_API_KEY
      || ''
    ).trim(),
    tavily: String(
      process.env.OMX_SCRAPER_TAVILY_KEY
      || process.env.OMX_SCRAPER_TAVILY_API_KEY
      || process.env.SCRAPER_TAVILY_KEY
      || process.env.SCRAPER_TAVILY_API_KEY
      || process.env.TAVILY_API_KEY
      || process.env.TAVILY_KEY
      || ''
    ).trim(),
    newsapi: String(
      process.env.OMX_SCRAPER_NEWSAPI_KEY
      || process.env.SCRAPER_NEWSAPI_KEY
      || process.env.NEWSAPI_KEY
      || process.env.NEWS_API_KEY
      || ''
    ).trim()
  };
}

function stripScraperWebApiKeys(keys = {}) {
  const next = keys && typeof keys === 'object' ? { ...keys } : {};
  delete next.scrapeSerp;
  delete next.serpapi;
  delete next.tavily;
  delete next.newsapi;
  return next;
}

function normalizePersistedAiConfig(aiConfig = {}) {
  const source = aiConfig && typeof aiConfig === 'object' ? { ...aiConfig } : {};
  const nextKeys = stripScraperWebApiKeys(source.keys || {});
  if (Object.keys(nextKeys).length) source.keys = nextKeys;
  else delete source.keys;
  return source;
}

function mergeScraperWebApiKeysIntoAiConfig(aiConfig = {}) {
  const source = aiConfig && typeof aiConfig === 'object' ? { ...aiConfig } : {};
  const envKeys = getScraperWebApiKeysFromEnv();
  const mergedKeys = {
    ...stripScraperWebApiKeys(source.keys || {}),
    ...(envKeys.serpapi ? { scrapeSerp: envKeys.serpapi, serpapi: envKeys.serpapi } : {}),
    ...(envKeys.tavily ? { tavily: envKeys.tavily } : {}),
    ...(envKeys.newsapi ? { newsapi: envKeys.newsapi } : {})
  };
  if (Object.keys(mergedKeys).length) source.keys = mergedKeys;
  else delete source.keys;
  return source;
}

function getRuntimeSettingsWithScraperWebApiKeys(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  return {
    ...source,
    aiConfig: mergeScraperWebApiKeysIntoAiConfig(source.aiConfig || {})
  };
}

function normalizeVirusTotalSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  return {
    ...DEFAULT_SETTINGS.security.virusTotal,
    ...source
  };
}

function normalizeLockedSecuritySettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const features = source.features && typeof source.features === 'object' ? source.features : {};
  const security = source.security && typeof source.security === 'object' ? source.security : {};
  const popupBlocker = security.popupBlocker && typeof security.popupBlocker === 'object'
    ? security.popupBlocker
    : {};
  const cookieShield = security.cookieShield && typeof security.cookieShield === 'object'
    ? security.cookieShield
    : {};

  return {
    ...source,
    features: {
      ...features,
      enableFirewall: true,
      enableAntivirus: true,
      enableAdultContentBlock: isAdultContentBlockEnabledFromEnv()
    },
    security: {
      ...security,
      popupBlocker: {
        ...popupBlocker,
        enabled: popupBlocker.enabled === true
      },
      cookieShield: {
        ...cookieShield,
        enabled: true,
        blockThirdPartyRequestCookies: true,
        blockThirdPartyResponseCookies: true
      }
    }
  };
}

let initialExtensionsPromise = Promise.resolve();

try {
  if (fs.existsSync(settingsPath)) {
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const normalizedSearchEngines = normalizeSearchEngines(saved?.searchEngines);
    const normalizedYouTubeAddon = normalizeYouTubeAddonSettings(saved?.youtubeAddon);

    cachedSettings = normalizeLockedSecuritySettings({
      ...DEFAULT_SETTINGS,
      ...saved,
      features: {
        ...DEFAULT_SETTINGS.features,
        ...(saved?.features || {})
      },
      security: {
        ...DEFAULT_SETTINGS.security,
        ...(saved?.security || {}),
        virusTotal: normalizeVirusTotalSettings(saved?.security?.virusTotal)
      },
      aiChat: {
        ...normalizeAiChatSettings(saved?.aiChat)
      },
      youtubeAddon: normalizedYouTubeAddon,
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        ...(saved?.shortcuts || {})
      },
      llm: normalizeSharedLlmSettings(saved?.llm),
      searchEngines: normalizedSearchEngines,
      defaultSearchEngineId: normalizeDefaultSearchEngineId(saved?.defaultSearchEngineId, normalizedSearchEngines),
      websiteUiPreferences: normalizeWebsiteUiPreferences(saved?.websiteUiPreferences),
      websitePermissions: normalizeWebsitePermissions(saved?.websitePermissions)
    });
  }
  cachedSettings.llm = normalizeSharedLlmSettings(cachedSettings?.llm);
  cachedSettings.aiConfig = normalizePersistedAiConfig(cachedSettings?.aiConfig);
  cachedSettings.websiteUiPreferences = normalizeWebsiteUiPreferences(cachedSettings?.websiteUiPreferences);
  cachedSettings.websitePermissions = normalizeWebsitePermissions(cachedSettings?.websitePermissions);
  cachedSettings = normalizeLockedSecuritySettings(cachedSettings);

  applyPreferredWebTheme();
  // Built-in CSS customizations must be ready after Electron's ready event.
  initialExtensionsPromise = (async () => {
    await app.whenReady();
    await syncShortsHideForAllWebContents(cachedSettings);
  })().catch(e => {
    console.warn('[Built-in CSS] initial load failed', e);
  });
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

function getExtensionsBaseDir() {
    const candidates = [];
    try {
        if (process.resourcesPath) {
            candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'java', 'extension'));
            candidates.push(path.join(process.resourcesPath, 'app', 'java', 'extension'));
        }
    } catch (_) {}
    candidates.push(path.join(__dirname, '..', 'extension'));
    for (const candidate of candidates) {
        try {
            if (candidate && fs.existsSync(candidate)) return candidate;
        } catch (_) {}
    }
    return candidates[candidates.length - 1];
}

const shortsHideCssKeys = new Map();
const shortsHideObservedContents = new Set();
const shortsHidePendingSyncs = new Map();
const shortsHideAppliedSignatures = new Map();
let shortsHideCssTextCache = null;
let shortsHideCssCacheMtimeMs = 0;
let shortsHideWebContentsHookBound = false;

function isYouTubeGuestUrl(url = '') {
    try {
        const host = new URL(String(url || '')).hostname.toLowerCase();
        return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    } catch (_) {
        return false;
    }
}

function getShortsHideCssPath() {
    return path.join(getExtensionsBaseDir(), 'shorts hide', 'injectable.css');
}

async function getShortsHideCssText() {
    try {
        const cssPath = getShortsHideCssPath();
        const stat = await fs.promises.stat(cssPath);
        if (typeof shortsHideCssTextCache === 'string' && stat.mtimeMs === shortsHideCssCacheMtimeMs) {
            return shortsHideCssTextCache;
        }
        const rawCss = await fs.promises.readFile(cssPath, 'utf8');
        shortsHideCssCacheMtimeMs = stat.mtimeMs;
        shortsHideCssTextCache = String(rawCss || '')
            .replace(/^\s*outline\s*:[^;]+;\s*$/gim, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    } catch (error) {
        shortsHideCssTextCache = '';
        shortsHideCssCacheMtimeMs = 0;
        console.warn('[Shorts Hide] Failed to read injectable.css:', error?.message || error);
    }
    return shortsHideCssTextCache;
}

async function removeShortsHideCss(contents) {
    if (!contents || contents.isDestroyed?.()) return;
    const cssKey = shortsHideCssKeys.get(contents.id);
    if (!cssKey || typeof contents.removeInsertedCSS !== 'function') return;
    try {
        await contents.removeInsertedCSS(cssKey);
    } catch (_) {}
    shortsHideCssKeys.delete(contents.id);
    shortsHideAppliedSignatures.delete(contents.id);
}

async function syncShortsHideForContents(contents, settings = cachedSettings) {
    if (!contents || contents.isDestroyed?.()) return;

    const currentUrl = String(contents.getURL?.() || '').trim();
    // Shorts are always hidden on YouTube - no toggle needed
    if (!isYouTubeGuestUrl(currentUrl)) {
        await removeShortsHideCss(contents);
        return;
    }

    const cssText = await getShortsHideCssText();
    if (!cssText || typeof contents.insertCSS !== 'function') {
        await removeShortsHideCss(contents);
        return;
    }

    const signature = `${currentUrl}|${shortsHideCssCacheMtimeMs}`;
    if (shortsHideCssKeys.has(contents.id) && shortsHideAppliedSignatures.get(contents.id) === signature) {
        return;
    }

    await removeShortsHideCss(contents);

    try {
        const cssKey = await contents.insertCSS(cssText);
        shortsHideCssKeys.set(contents.id, cssKey);
        shortsHideAppliedSignatures.set(contents.id, signature);
    } catch (error) {
        console.warn('[Shorts Hide] CSS injection failed:', error?.message || error);
    }
}

function attachShortsHideToContents(contents) {
    if (!contents || contents.isDestroyed?.()) return;
    if (shortsHideObservedContents.has(contents.id)) return;
    shortsHideObservedContents.add(contents.id);

    const scheduleSync = () => {
        if (shortsHidePendingSyncs.has(contents.id)) return;
        const timer = setImmediate(() => {
            shortsHidePendingSyncs.delete(contents.id);
            syncShortsHideForContents(contents).catch((error) => {
                console.warn('[Shorts Hide] Sync failed:', error?.message || error);
            });
        });
        shortsHidePendingSyncs.set(contents.id, timer);
    };

    contents.on('dom-ready', scheduleSync);
    contents.on('did-navigate', scheduleSync);
    contents.on('did-navigate-in-page', scheduleSync);
    contents.on('destroyed', () => {
        const timer = shortsHidePendingSyncs.get(contents.id);
        if (timer) clearImmediate(timer);
        shortsHidePendingSyncs.delete(contents.id);
        shortsHideObservedContents.delete(contents.id);
        shortsHideCssKeys.delete(contents.id);
        shortsHideAppliedSignatures.delete(contents.id);
    });

    scheduleSync();
}

async function syncShortsHideForAllWebContents(settings = cachedSettings) {
    const allContents = webContents.getAllWebContents();
    for (const contents of allContents) {
        if (!contents || contents.isDestroyed?.()) continue;
        attachShortsHideToContents(contents);
        await syncShortsHideForContents(contents, settings);
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
    const commands = ['take-screenshot','toggle-bookmarks','new-tab','open-scraber','close-tab','toggle-sidebar','toggle-system'];
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

function openMainBrowserWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

let alwaysOnStartupPromise = null;
function bootstrapAlwaysOnServices() {
  if (alwaysOnStartupPromise) return alwaysOnStartupPromise;

  alwaysOnStartupPromise = (async () => {
    const omchatAlwaysOn = Boolean(cachedSettings?.omchat?.alwaysOn);
    const mcpAlwaysOn = Boolean(cachedSettings?.mcp?.alwaysOn);
    if (!omchatAlwaysOn && !mcpAlwaysOn) {
      return;
    }

    if (omchatAlwaysOn) {
      const useNgrok = !Boolean(cachedSettings?.omchat?.useLocalIpOnly);
      const omchatResult = await startOmChatServerInternal({ useNgrok });
      if (!omchatResult?.success) {
        pushServerLog('omchat', 'error', `Always On startup failed: ${omchatResult?.error || 'Unknown error'}`);
      } else {
        pushServerLog('omchat', 'info', 'Always On startup: OmChat is running.');
      }
    }

    if (mcpAlwaysOn) {
      const { host, port, enabledTools } = buildMcpRuntimeConfig({});
      if (!Object.values(enabledTools).some(Boolean)) {
        pushServerLog('mcp', 'error', 'Always On startup skipped because all MCP tools are disabled.');
        return;
      }

      const mcpResult = await startMcpBackground({ host, port, enabledTools });
      if (!mcpResult?.success) {
        pushServerLog('mcp', 'error', `Always On startup failed: ${mcpResult?.error || 'Unknown error'}`);
      } else {
        serverStarts.mcp = serverStarts.mcp || Date.now();
        serverConfigs.mcp = {
          host: mcpResult.host || host,
          port: mcpResult.port || port,
          enabledTools: mcpResult.enabledTools || enabledTools
        };
        pushServerLog('mcp', 'info', `Always On startup: MCP ready at http://${serverConfigs.mcp.host}:${serverConfigs.mcp.port}/mcp`);
      }
    }
  })().catch((error) => {
    pushServerLog('mcp', 'error', error?.stack || error?.message || String(error));
  });

  return alwaysOnStartupPromise;
}

function createMainWindow() {
  configureSitePermissions(session.defaultSession);
  mainWindow = new BrowserWindow({
    width: 960, height: 640, 
    frame: false, 
    titleBarStyle: 'hidden', 
    show: false,
    icon: BROWSER_WINDOW_ICON,
    backgroundColor: '#18181b',
    webPreferences: { 
      preload: path.join(__dirname, '../preload.js'), 
      webviewTag: true, 
      plugins: true,
      contextIsolation: true, 
      nodeIntegration: false, 
      webSecurity: true,  // Security: Enable web security
      sandbox: true,       // Security: Enable sandbox
      devTools: TEMP_MAIN_AUTO_OPEN_DEVTOOLS
    }
  });
  attachInternalWindowNavigationGuards(mainWindow, 'main window', { allowExternalHttpPopups: true });
  if (BROWSER_WINDOW_ICON && typeof mainWindow.setIcon === 'function') {
    try { mainWindow.setIcon(BROWSER_WINDOW_ICON); } catch (_) {}
  }
  attachLanHostWindow(mainWindow);
  configureSitePermissions(mainWindow.webContents.session);
  if (!shortsHideWebContentsHookBound) {
    shortsHideWebContentsHookBound = true;
    app.on('web-contents-created', (_event, contents) => {
      if (contents && typeof contents.setMaxListeners === 'function') {
        contents.setMaxListeners(50);
      }
      attachShortsHideToContents(contents);
      attachGlobalScrollbarToContents(contents);
      attachExternalPopupAllowance(contents);
    });
  }
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences) => {
    // Keep guest webviews locked down while still allowing Chromium's PDF viewer.
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    webPreferences.webSecurity = true;
    webPreferences.sandbox = true;
    webPreferences.plugins = true;
    webPreferences.nativeWindowOpen = true;

    const preloadPath = webPreferences.preload || webPreferences.preloadURL;
    if (!preloadPath) return;

    try {
      webPreferences.preload = validateLocalEntryFile(preloadPath, {
        allowedRoots: [OMX_APP_ROOT],
        allowedExtensions: OMX_ALLOWED_SCRIPT_ENTRY_EXTENSIONS
      });
    } catch (error) {
      console.warn('[Security] Blocked untrusted webview preload:', error?.message || error);
      delete webPreferences.preload;
      delete webPreferences.preloadURL;
    }
  });
  mainWindow.webContents.on('did-finish-load', () => {
    emitResolvedLanIp();
  });
  mainWindow.loadFile(getMainWindowHtmlPath(cachedSettings));
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
    if (TEMP_MAIN_AUTO_OPEN_DEVTOOLS) {
      try {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      } catch (_) {}
    }
    
  });

  mainWindow.on('closed', () => { 
    if (lanServerInstance?.hostWindow === mainWindow) {
      attachLanHostWindow(null);
    }
    if (previewWindow) previewWindow.close(); 
    mainWindow = null; 
  });

  mainWindow.webContents.session.on('will-download', (event, item, wc) => {
      const id = Date.now().toString() + Math.random().toString().slice(2,5);
      const url = item.getURL();
      const pending = pendingSaveAs.get(url);
      if (pending) pendingSaveAs.delete(url);
      const filename = pending?.filename ? path.basename(pending.filename) : item.getFilename();
      const filenameExt = path.extname(filename || '').toLowerCase();
      const mimeType = typeof item.getMimeType === 'function' ? item.getMimeType() : '';
      const contentDisposition = typeof item.getContentDisposition === 'function' ? item.getContentDisposition() : '';
      const shouldInlinePdf =
        wc &&
        !wc.isDestroyed?.() &&
        shouldOpenPdfInViewer({
          url,
          mimeType,
          filename,
          contentDisposition,
          explicitDownload: Boolean(pending)
        }) &&
        !wasRecentlyRedirectedToPdfViewer(url);

      if (shouldInlinePdf) {
          event.preventDefault();
          rememberPdfViewerRedirect(url);
          setImmediate(() => {
              wc.loadURL(url).catch((error) => {
                  console.error('[PDF] Failed to open PDF in Chromium viewer:', error);
              });
          });
          return;
      }

      const defaultDir = (cachedSettings.downloadPath && fs.existsSync(cachedSettings.downloadPath))
        ? cachedSettings.downloadPath
        : app.getPath('downloads');

      let savePath = path.join(defaultDir, filename || 'download');
      if (pending?.saveAs) {
          const chosen = dialog.showSaveDialogSync(mainWindow, { defaultPath: savePath });
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
      const downloadEntry = {
          item,
          data,
          resolveSavePath,
          cancelRequested: false
      };
      activeDownloadItems.set(id, downloadEntry);
      broadcast('download-update', data);

      const blockCurrentDownload = (reason, quarantinePath = '') => {
          data.state = 'blocked';
          data.reason = reason || 'Blocked by security policy';
          if (quarantinePath) data.quarantinePath = quarantinePath;
          downloadEntry.cancelRequested = true;
          try { item.cancel(); } catch (_) {}
          activeDownloadItems.delete(id);
          persistAndBroadcastDownload(data);
      };

      const runThreatGate = async () => {
          if (!shouldThreatScan) return;
          if (!antivirusEngine) return;
          if (downloadEntry.cancelRequested) return;
          data.state = 'scanning';
          data.reason = 'Running security scan...';
          broadcast('download-update', data);

          try { item.pause(); } catch (_) {}

          try {
              if (antivirusEngine) {
                  if (downloadEntry.cancelRequested) return;
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

          } catch (error) {
              console.warn('[Security] Download pre-scan failed (open fail):', error?.message || error);
          }

          if (!downloadEntry.cancelRequested && data.state !== 'blocked') {
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
          if (downloadEntry.cancelRequested) return;
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

          data.state = downloadEntry.cancelRequested && state !== 'completed' ? 'cancelled' : state;
          data.receivedBytes = item.getReceivedBytes();
          data.totalBytes = item.getTotalBytes();
          data.savePath = resolveSavePath();
          data.saveDir = path.dirname(data.savePath || savePath);
          activeDownloadItems.delete(id);

          if (data.state === 'completed' && shouldThreatScan) {
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

              } catch (scanError) {
                  console.warn('[Security] Download post-scan failed (open fail):', scanError?.message || scanError);
              }
          }

          persistAndBroadcastDownload(data);
      });
  });
}

function createPreviewWindow(url) {
    if (previewWindow) {
        previewWindow.show(); previewWindow.focus();
        previewWindow.webContents.send('preview-load', url);
        return;
    }
    previewWindow = new BrowserWindow({
        width: 860, height: 640, frame: false, transparent: true, alwaysToTop: true, parent: mainWindow, show: false,
        icon: BROWSER_WINDOW_ICON,
        webPreferences: { preload: path.join(__dirname, '../preload.js'), webviewTag: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, sandbox: true, devTools: false }
    });
    attachInternalWindowNavigationGuards(previewWindow, 'preview window');
    const theme = cachedSettings.theme || 'noir';
    previewWindow.loadFile(path.join(__dirname, '../../html/windows/preview.html'), { query: { url, theme } });
    previewWindow.once('ready-to-show', () => previewWindow.show());
    previewWindow.on('closed', () => previewWindow = null);
}

ipcMain.on('window-minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('window-maximize-only', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w?.isMaximized?.()) w?.maximize?.();
});
ipcMain.on('window-maximize', (e) => { const w = BrowserWindow.fromWebContents(e.sender); w?.isMaximized() ? w.unmaximize() : w?.maximize(); });
ipcMain.on('window-close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('window-open-main', () => openMainBrowserWindow());
ipcMain.on('window-toggle-devtools', (e) => {
    toggleDevTools(BrowserWindow.fromWebContents(e.sender));
});
ipcMain.handle('app-restart', async () => {
    const nextArgs = process.argv.slice(1).filter((arg) => !String(arg || '').startsWith('--main-process='));
    app.relaunch({ args: nextArgs });
    app.exit(0);
    return true;
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

ipcMain.on('open-tab', (e, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('open-tab', url);
    }
});

ipcMain.on('preview-open', (e, url) => createPreviewWindow(url));
ipcMain.on('preview-close', () => { if (previewWindow) previewWindow.close(); });
ipcMain.on('preview-to-tab', (e, url) => { if (previewWindow) previewWindow.close(); if (mainWindow) mainWindow.webContents.send('open-tab', url); });

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
        const config = (gameConfig && typeof gameConfig === 'object') ? gameConfig : {};
        const { id, name, gamePath, preloadPath } = config;
        const windowConfig = (config.windowConfig && typeof config.windowConfig === 'object') ? config.windowConfig : {};
        
        // Resolve paths relative to app root
        const fullGamePath = validateLocalEntryFile(path.resolve(__dirname, '../../', String(gamePath || '')), {
            allowedRoots: [OMX_GAMES_ROOT],
            allowedExtensions: OMX_ALLOWED_RENDERER_ENTRY_EXTENSIONS
        });
        const fullPreloadPath = preloadPath
            ? validateLocalEntryFile(path.resolve(__dirname, '../../', String(preloadPath || '')), {
                allowedRoots: [OMX_APP_ROOT],
                allowedExtensions: OMX_ALLOWED_SCRIPT_ENTRY_EXTENSIONS
            })
            : null;
        
        // Create new independent BrowserWindow for the game
        const gameWindow = new BrowserWindow({
            width: windowConfig.width || 800,
            height: windowConfig.height || 600,
            title: windowConfig.title || name,
            resizable: windowConfig.resizable !== false,
            backgroundColor: windowConfig.backgroundColor || '#1a1a2e',
            icon: BROWSER_WINDOW_ICON,
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
        attachInternalWindowNavigationGuards(gameWindow, `electron game ${id || name || 'window'}`);
        
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
        const config = (gameConfig && typeof gameConfig === 'object') ? gameConfig : {};
        const id = String(config.id || '').trim();
        const name = String(config.name || id || 'Standalone game');
        const gamePath = String(config.gamePath || '').trim();

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
        const gameMainFile = validateLocalEntryFile(path.resolve(appDir, '../../', gamePath), {
            allowedRoots: [OMX_GAMES_ROOT],
            allowedExtensions: OMX_ALLOWED_SCRIPT_ENTRY_EXTENSIONS
        });
        
        // Spawn Electron with the game's main.js, using root node_modules
        const gameProcess = require('child_process').spawn(
            process.execPath,
            [`--standalone-entry=${gameMainFile}`],
            {
                cwd: appDir, // Use Om-X working directory for node_modules
                detached: true,
                stdio: ['ignore', 'ignore', 'pipe'],
                env: {
                    ...process.env,
                    NODE_PATH: rootNodeModules
                }
            }
        );

        gameProcess.stderr?.on('data', (data) => {
            console.error(`[${name}] ${data.toString().trim()}`);
        });
        
        // Detach the process so it runs independently
        gameProcess.unref();
        
        // Track the process
        if (!global.standaloneGames) global.standaloneGames = {};
        global.standaloneGames[id] = gameProcess;

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

ipcMain.handle('files:read-dir', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'files:read-dir', async (e, dirPath) => {
    try {
        const abs = path.resolve(String(dirPath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        const files = await fs.promises.readdir(abs);
        return files;
    } catch (e) {
        return [];
    }
}));

function isPrivilegedSettingsSender(event) {
  return isAuthorizedRendererPage(event, AUTHORIZED_RENDERER_PAGES.privilegedSettings);
}

function cloneSettings(settings) {
  try {
    return JSON.parse(JSON.stringify(settings || {}));
  } catch (_) {
    return {};
  }
}

function redactSensitiveSettings(settings) {
  const redacted = cloneSettings(settings);
  if (redacted?.llm) {
    redacted.llm.key = '';
  }
  if (redacted?.aiConfig?.keys && typeof redacted.aiConfig.keys === 'object') {
    for (const key of Object.keys(redacted.aiConfig.keys)) {
      redacted.aiConfig.keys[key] = '';
    }
  }
  if (Array.isArray(redacted?.aiConfig?.providers)) {
    redacted.aiConfig.providers = redacted.aiConfig.providers.map((p) => (
      p && typeof p === 'object' ? { ...p, key: '' } : p
    ));
  }
  if (redacted?.aiConfig?.browserSettings?.providers && typeof redacted.aiConfig.browserSettings.providers === 'object') {
    const nextProviders = {};
    for (const [providerId, providerCfg] of Object.entries(redacted.aiConfig.browserSettings.providers)) {
      if (providerCfg && typeof providerCfg === 'object') {
        nextProviders[providerId] = { ...providerCfg, key: '' };
      } else {
        nextProviders[providerId] = providerCfg;
      }
    }
    redacted.aiConfig.browserSettings.providers = nextProviders;
  }
  return redacted;
}

function preserveSensitiveSettings(currentSettings, nextSettings) {
  const preserved = cloneSettings(nextSettings);
  const current = currentSettings || {};
  if (!preserved.security) preserved.security = {};
  preserved.security.virusTotal = normalizeVirusTotalSettings(preserved.security.virusTotal);

  const currentAi = current?.aiConfig || {};
  const nextAi = preserved?.aiConfig && typeof preserved.aiConfig === 'object'
    ? { ...preserved.aiConfig }
    : {};

  if (currentAi.keys && typeof currentAi.keys === 'object') {
    const nextKeys = nextAi.keys && typeof nextAi.keys === 'object' ? { ...nextAi.keys } : {};
    for (const [key, value] of Object.entries(currentAi.keys)) {
      if (nextKeys[key] === undefined || nextKeys[key] === '') nextKeys[key] = value;
    }
    nextAi.keys = nextKeys;
  }

  const currentProviders = currentAi?.browserSettings?.providers;
  if (currentProviders && typeof currentProviders === 'object') {
    const nextBrowserSettings = nextAi.browserSettings && typeof nextAi.browserSettings === 'object'
      ? { ...nextAi.browserSettings }
      : {};
    const nextProviders = nextBrowserSettings.providers && typeof nextBrowserSettings.providers === 'object'
      ? { ...nextBrowserSettings.providers }
      : {};
    for (const [providerId, providerCfg] of Object.entries(currentProviders)) {
      const incoming = nextProviders[providerId];
      if (!incoming || typeof incoming !== 'object') {
        nextProviders[providerId] = { ...providerCfg };
        continue;
      }
      if ((incoming.key === undefined || incoming.key === '') && providerCfg && typeof providerCfg === 'object') {
        nextProviders[providerId] = { ...incoming, key: providerCfg.key };
      }
    }
    nextBrowserSettings.providers = nextProviders;
    nextAi.browserSettings = nextBrowserSettings;
  }

  if (Array.isArray(currentAi.providers) && Array.isArray(nextAi.providers)) {
    const prior = new Map();
    for (const item of currentAi.providers) {
      if (!item || typeof item !== 'object') continue;
      prior.set(`${String(item.provider || '')}::${String(item.model || '')}`, String(item.key || ''));
    }
    nextAi.providers = nextAi.providers.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const id = `${String(item.provider || '')}::${String(item.model || '')}`;
      if (item.key === undefined || item.key === '') {
        const priorKey = prior.get(id);
        if (priorKey) return { ...item, key: priorKey };
      }
      return item;
    });
  }

  preserved.aiConfig = normalizePersistedAiConfig(nextAi);
  return preserved;
}

ipcMain.handle('settings-get', (event) => (
  isPrivilegedSettingsSender(event) ? cloneSettings(cachedSettings) : redactSensitiveSettings(cachedSettings)
));

ipcMain.handle('env:get-info', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.system, 'env:get-info', async () => {
  const target = resolvePrimaryOmxEnvPath();
  return {
    success: true,
    path: target,
    exists: fs.existsSync(target)
  };
}));

ipcMain.handle('env:replace-file', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.system, 'env:replace-file', async (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || null;
  const selection = await dialog.showOpenDialog(senderWindow, {
    title: 'Select replacement .env file',
    properties: ['openFile'],
    filters: [
      { name: 'Environment files', extensions: ['env', 'txt'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (selection.canceled || !selection.filePaths?.length) {
    return { success: false, canceled: true };
  }

  const sourcePath = path.resolve(selection.filePaths[0]);
  const targetPath = resolvePrimaryOmxEnvPath();
  try {
    const nextContent = fs.readFileSync(sourcePath, 'utf8');
    const validation = validateImportedEnvContent(nextContent);
    if (!validation.valid) {
      return {
        success: false,
        error: `${validation.error}. Use a real env file, not the empty template.`
      };
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (fs.existsSync(targetPath)) {
      fs.copyFileSync(targetPath, `${targetPath}.backup`);
    }
    fs.writeFileSync(targetPath, nextContent, 'utf8');
    const reload = reloadPrimaryOmxEnvFile();
    const secureNormalizedSettings = normalizeLockedSecuritySettings(cachedSettings);
    cachedSettings = secureNormalizedSettings;
    configureSecurity(secureNormalizedSettings, mainWindow);
    broadcast('settings-updated', secureNormalizedSettings);
    return {
      success: true,
      sourcePath,
      targetPath,
      keyCount: reload.keys.length,
      enableAdultContentBlock: secureNormalizedSettings?.features?.enableAdultContentBlock === true
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Failed to replace .env file.'
    };
  }
}));


ipcMain.handle('settings-save', async (e, s) => {
  const incoming = s || {};
  const normalizedSearchEngines = normalizeSearchEngines(incoming?.searchEngines ?? cachedSettings?.searchEngines);
  const normalizedYouTubeAddon = normalizeYouTubeAddonSettings(
    incoming?.youtubeAddon ?? cachedSettings?.youtubeAddon
  );
  const normalizedSettings = normalizeLockedSecuritySettings({
    ...cachedSettings,
    ...incoming,
    features: {
      ...DEFAULT_SETTINGS.features,
      ...(cachedSettings?.features || {}),
      ...(incoming?.features || {})
    },
    security: {
      ...DEFAULT_SETTINGS.security,
      ...(cachedSettings?.security || {}),
      ...(incoming?.security || {}),
      virusTotal: normalizeVirusTotalSettings(incoming?.security?.virusTotal),
      popupBlocker: {
        ...DEFAULT_SETTINGS.security.popupBlocker,
        ...(cachedSettings?.security?.popupBlocker || {}),
        ...(incoming?.security?.popupBlocker || {})
      },
      cookieShield: {
        ...DEFAULT_SETTINGS.security.cookieShield,
        ...(cachedSettings?.security?.cookieShield || {}),
        ...(incoming?.security?.cookieShield || {})
      }
    },
    aiChat: {
      ...normalizeAiChatSettings({
        ...(cachedSettings?.aiChat || {}),
        ...(incoming?.aiChat || {})
      })
    },
    youtubeAddon: normalizedYouTubeAddon,
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...(cachedSettings?.shortcuts || {}),
      ...(incoming?.shortcuts || {})
    },
    searchEngines: normalizedSearchEngines,
    defaultSearchEngineId: normalizeDefaultSearchEngineId(
      incoming?.defaultSearchEngineId ?? cachedSettings?.defaultSearchEngineId ?? DEFAULT_SETTINGS.defaultSearchEngineId,
      normalizedSearchEngines
    ),
    llm: normalizeSharedLlmSettings(incoming?.llm ?? cachedSettings?.llm),
    omchat: {
      ...DEFAULT_SETTINGS.omchat,
      ...(cachedSettings?.omchat || {}),
      ...(incoming?.omchat || {}),
      localDbPath: String(incoming?.omchat?.localDbPath ?? cachedSettings?.omchat?.localDbPath ?? '').trim(),
      useLocalIpOnly: Boolean(incoming?.omchat?.useLocalIpOnly ?? cachedSettings?.omchat?.useLocalIpOnly ?? DEFAULT_SETTINGS.omchat.useLocalIpOnly),
      alwaysOn: Boolean(incoming?.omchat?.alwaysOn ?? cachedSettings?.omchat?.alwaysOn ?? DEFAULT_SETTINGS.omchat.alwaysOn)
    },
    mcp: {
      ...DEFAULT_SETTINGS.mcp,
      ...(cachedSettings?.mcp || {}),
      ...(incoming?.mcp || {}),
      alwaysOn: Boolean(incoming?.mcp?.alwaysOn ?? cachedSettings?.mcp?.alwaysOn ?? DEFAULT_SETTINGS.mcp.alwaysOn)
    },
    websiteUiPreferences: normalizeWebsiteUiPreferences(incoming?.websiteUiPreferences ?? cachedSettings?.websiteUiPreferences),
    websitePermissions: normalizeWebsitePermissions(incoming?.websitePermissions ?? cachedSettings?.websitePermissions)
  });
  normalizedSettings.aiConfig = normalizePersistedAiConfig(normalizedSettings.aiConfig);
  const secureNormalizedSettings = isPrivilegedSettingsSender(e)
    ? normalizedSettings
    : preserveSensitiveSettings(cachedSettings, normalizedSettings);
  cachedSettings = secureNormalizedSettings;
  const success = await safeWriteJson(settingsPath, secureNormalizedSettings);
  if (success) {
    applyPreferredWebTheme();
    configureSecurity(secureNormalizedSettings, mainWindow);
    await syncShortsHideForAllWebContents(secureNormalizedSettings);
    broadcast('settings-updated', secureNormalizedSettings);
  }
  return success;
});

ipcMain.handle('security:get-site-safety-status', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'security:get-site-safety-status', async (_event, payload = {}) => {
  try {
    const url = String(payload?.url || '').trim();
    if (!url) return buildSiteSafetyError('', 'No URL available', { code: 'missing_url' });
    return await ensureSiteSafetyStatus(url, {
      apiKey: String(payload?.apiKey || '').trim(),
      allowScan: payload?.allowScan !== false,
      forceScan: payload?.forceScan === true,
      recordVisit: payload?.recordVisit === true
    });
  } catch (error) {
    return buildSiteSafetyError(String(payload?.url || '').trim(), error?.message || 'Check failed', {
      code: 'scan_failed',
      error: error?.message || 'Check failed'
    });
  }
}));

ipcMain.handle('security:prime-site-safety-scan', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.mainWindow, 'security:prime-site-safety-scan', async (_event, payload = {}) => {
  try {
    const url = String(payload?.url || '').trim();
    if (!url) return buildSiteSafetyError('', 'No URL available', { code: 'missing_url' });
    return await ensureSiteSafetyStatus(url, {
      apiKey: String(payload?.apiKey || '').trim(),
      allowScan: true,
      forceScan: payload?.forceScan === true,
      recordVisit: payload?.recordVisit !== false
    });
  } catch (error) {
    return buildSiteSafetyError(String(payload?.url || '').trim(), error?.message || 'Check failed', {
      code: 'scan_failed',
      error: error?.message || 'Check failed'
    });
  }
}));

ipcMain.handle('security:get-site-settings', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.siteInfoRead, 'security:get-site-settings', async (_event, payload = {}) => {
  return getSiteSettingsSnapshot(String(payload?.url || '').trim());
}));

ipcMain.handle('security:set-site-permission', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.siteSettings, 'security:set-site-permission', async (_event, payload = {}) => {
  return updateSitePermissionSetting(
    String(payload?.url || '').trim(),
    String(payload?.permission || '').trim(),
    String(payload?.decision || '').trim()
  );
}));

ipcMain.handle('security:reset-site-permissions', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.siteSettings, 'security:reset-site-permissions', async (_event, payload = {}) => {
  return resetSitePermissionSettings(String(payload?.url || '').trim());
}));

ipcMain.handle('security:clear-site-data', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.siteSettings, 'security:clear-site-data', async (_event, payload = {}) => {
  return clearSiteStorageData(String(payload?.url || '').trim());
}));

ipcMain.handle('system-open-path', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'system-open-path', async (e, targetPath) => {
    try {
        const safePath = validateSafeOpenPath(targetPath);
        const openError = await shell.openPath(safePath);
        return !openError;
    } catch (e) {
        console.warn('[Security] system-open-path blocked:', e?.message || e);
        return false;
    }
}));

ipcMain.handle('system-get-user-data-path', () => app.getPath('userData'));

ipcMain.handle('system-get-local-ip', () => {
  return getResolvedLanIp();
});



// Image Scraping Persistence Handlers
ipcMain.handle('ai:save-images-to-desktop', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'ai:save-images-to-desktop', async (event, images) => {
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
}));

ipcMain.handle('ai:get-desktop-scrapes', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'ai:get-desktop-scrapes', async () => {
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
}));

async function generateAIFailureReport(params, error) {
    try {
        const defaultDir = cachedSettings.downloadPath && fs.existsSync(cachedSettings.downloadPath) ? cachedSettings.downloadPath : app.getPath('downloads');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(defaultDir, `Omni-Intelligence-Failure-Report-${timestamp}.txt`);
        
        let reportContent = `--- OMNI INTELLIGENCE CORE FAILURE REPORT ---
Timestamp: ${new Date().toLocaleString()}
Application Version: ${app.getVersion()}

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
    const settings = getRuntimeSettingsWithScraperWebApiKeys(cachedSettings || DEFAULT_SETTINGS);
    
    // Config resolution
    const activeProvider = settings.activeProvider || 'google';
    const contextDefaults = settings.llm || (context === 'writer' ? settings.writer?.api : settings.translator?.api);
    const config = configOverride || contextDefaults || { provider: activeProvider, key: '', model: '' };
    const targetProvider = String(config?.provider || activeProvider || 'google').trim() || 'google';
    const resolvedConfig = {
        ...config,
        provider: targetProvider,
        key: String(config?.key || getSharedLlmApiKeyFromEnv(targetProvider) || '').trim(),
        model: String(config?.model || getSharedLlmModelForProvider(targetProvider) || '').trim()
    };
    const aiConfig = {
        ...(settings.aiConfig || {}),
        searchMode,
        wikiMode,
        videoMode,
        searchDepth,
        defaultSearchEngineId: settings.defaultSearchEngineId || DEFAULT_SETTINGS.defaultSearchEngineId || 'google'
    };
    if (config?.temperature !== undefined) aiConfig.temperature = config.temperature;
    if (config?.maxTokens !== undefined) aiConfig.maxOutputTokens = config.maxTokens;

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
            if (context === 'translator' && targetProvider === 'sarvamai') {
                const key = String(resolvedConfig.key || '').trim();
                if (!key) return { error: 'SarvamAI API key is required for translator.' };

                const sourceLanguage = toSarvamLanguageCode(source || 'auto', 'auto');
                const targetLanguage = toSarvamLanguageCode(target || settings.translator?.defaultTarget || 'en', 'en-IN');
                const model = String(resolvedConfig.model || '').trim() || 'sarvam-m';
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

            const llamaRuntime = serverConfigs.llama
                ? {
                    modelPath: serverConfigs.llama.modelPath || '',
                    modelType: serverConfigs.llama.modelType || '',
                    supportsVision: Boolean(serverConfigs.llama.supportsVision),
                    mmprojPath: serverConfigs.llama.mmprojPath || ''
                }
                : null;
            const result = await aiProvider.performTask(promptInput, {
                provider: targetProvider,
                model: resolvedConfig.model,
                keyOverride: resolvedConfig.key || '',
                tools: params.tools,
                systemInstruction: params.systemInstruction,
                aiConfig: {
                    ...aiConfig,
                    llama: llamaRuntime
                },
                temperature: resolvedConfig.temperature,
                maxTokens: resolvedConfig.maxTokens,
                baseUrl: resolvedConfig.baseUrl || ''
            });
            
            const response = typeof result === 'string' ? { text: result.trim() } : result;
            if (!response.provider) response.provider = targetProvider;
            return response; 
        } catch (error) { 
            console.error("[Main Process AI Task Error]:", error);
            await generateAIFailureReport(params, error);
            return { error: error.message }; 
        }
    };
    
    return await execute();
};

ipcMain.handle('ai-perform-task', (e, p) => performAITask(e, p));
ipcMain.handle('translator-perform', (e, p) => performAITask(e, { ...p, context: 'translator' }));
ipcMain.handle('writer-perform', (e, p) => performAITask(e, { ...p, context: 'writer' }));

ipcMain.handle('scraper:get-llama-config', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:get-llama-config', async () => ({
    executable: getScraperLlamaExecutableFromEnv(),
    host: getScraperLlamaHostFromEnv(),
    port: getScraperLlamaPortFromEnv(),
    modelsPath: getScraperLlamaModelsPathFromEnv(),
    model: getScraperLlamaModelFromEnv(),
    contextLength: getScraperLlamaContextLengthFromEnv(),
    gpuLayers: getScraperLlamaGpuLayersFromEnv(),
    threads: getScraperLlamaThreadsFromEnv(),
    systemPrompt: getScraperLlamaSystemPromptFromEnv(),
    baseUrl: getScraperLlamaApiBaseUrl()
})));

ipcMain.handle('scraper:llama:session-start', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:llama:session-start', async () => {
    try {
        return await startScraperLlamaSession();
    } catch (error) {
        return { success: false, error: error?.message || 'Failed to start scraper llama.cpp session.' };
    }
}));

ipcMain.handle('scraper:llama:session-stop', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:llama:session-stop', async () => {
    try {
        return await stopScraperLlamaSession();
    } catch (error) {
        return { success: false, error: error?.message || 'Failed to stop scraper llama.cpp session.' };
    }
}));

ipcMain.handle('scraper:llama:generate', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:llama:generate', async (_event, payload = {}) => {
    try {
        return await callScraperLlamaGenerate(payload || {});
    } catch (error) {
        return { error: error?.message || 'Scraper llama.cpp request failed.' };
    }
}));

ipcMain.handle('scraper:research-artifact-write', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:research-artifact-write', async (_event, payload = {}) => {
    try {
        return await writeScraperResearchArtifact(payload || {});
    } catch (error) {
        return { success: false, error: error?.message || 'Failed to write scraper research artifact.' };
    }
}));

ipcMain.handle('scraper:research-artifact-list', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:research-artifact-list', async (_event, sessionId) => {
    try {
        return await listScraperResearchArtifacts(sessionId);
    } catch (error) {
        return { success: false, error: error?.message || 'Failed to list scraper research artifacts.', files: [] };
    }
}));

ipcMain.handle('scraper:research-artifact-cleanup', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:research-artifact-cleanup', async (_event, sessionId) => {
    try {
        return await cleanupScraperResearchArtifacts(sessionId);
    } catch (error) {
        return { success: false, error: error?.message || 'Failed to cleanup scraper research artifacts.' };
    }
}));

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

ipcMain.handle('scraper:get-groq-keys', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:get-groq-keys', async (_event) => getScraperGroqKeysFromEnv()));
ipcMain.handle('scraper:get-groq-model', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:get-groq-model', async (_event) => getScraperGroqModelFromEnv()));
ipcMain.handle('scraper:get-web-api-keys', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:get-web-api-keys', async (_event) => getScraperWebApiKeysFromEnv()));

ipcMain.handle('scraper:get-usage-stats', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.scraper, 'scraper:get-usage-stats', async (_event) => {
    try {
        const webApiKeys = getScraperWebApiKeysFromEnv();
        const serpKey = String(webApiKeys.serpapi || '').trim();
        const tavilyKey = String(webApiKeys.tavily || '').trim();
        const newsApiKey = String(webApiKeys.newsapi || '').trim();

        const providers = [];

        if (serpKey) {
            try {
                const serpUrl = `https://serpapi.com/account.json?api_key=${encodeURIComponent(serpKey)}`;
                const res = await fetch(serpUrl, { signal: AbortSignal.timeout(12000) });
                if (!res.ok) {
                    throw new Error(`SerpAPI account request failed: ${res.status}`);
                }
                const data = await res.json();
                const limit = Number(data?.searches_per_month || 0);
                const used = Number(data?.this_month_usage || 0);
                const remaining = Number(
                    data?.plan_searches_left ?? data?.total_searches_left ?? Math.max(limit - used, 0)
                );
                providers.push({
                    id: 'serpapi',
                    name: 'SerpAPI',
                    configured: true,
                    status: 'ok',
                    plan: String(data?.plan_name || data?.plan_id || 'Configured'),
                    monthlyLimit: Number.isFinite(limit) ? limit : 0,
                    usedThisMonth: Number.isFinite(used) ? used : 0,
                    remainingThisMonth: Number.isFinite(remaining) ? remaining : 0,
                    details: {
                        extraCredits: Number(data?.extra_credits || 0),
                        hourlyRateLimit: Number(data?.account_rate_limit_per_hour || 0),
                        lastHourSearches: Number(data?.last_hour_searches || 0)
                    }
                });
            } catch (error) {
                providers.push({
                    id: 'serpapi',
                    name: 'SerpAPI',
                    configured: true,
                    status: 'error',
                    error: error?.message || 'Failed to load SerpAPI usage.'
                });
            }
        } else {
            providers.push({
                id: 'serpapi',
                name: 'SerpAPI',
                configured: false,
                status: 'missing_key',
                error: 'SerpAPI key is not saved.'
            });
        }

        if (tavilyKey) {
            try {
                const res = await fetch('https://api.tavily.com/usage', {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${tavilyKey}`
                    },
                    signal: AbortSignal.timeout(12000)
                });
                if (!res.ok) {
                    throw new Error(`Tavily usage request failed: ${res.status}`);
                }
                const data = await res.json();
                const keyInfo = data?.key || {};
                const limitCandidates = [
                    data?.account?.plan_limit,
                    data?.account?.planLimit,
                    data?.account?.monthly_limit,
                    data?.account?.monthlyLimit,
                    keyInfo?.limit,
                    keyInfo?.plan_limit,
                    keyInfo?.monthly_limit
                ].map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
                const usageCandidates = [
                    keyInfo?.usage,
                    data?.account?.plan_usage,
                    data?.account?.planUsage,
                    data?.account?.search_usage,
                    data?.account?.searchUsage,
                    keyInfo?.search_usage
                ].map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0);
                const limit = limitCandidates.length ? limitCandidates[0] : 0;
                const used = usageCandidates.length ? usageCandidates[0] : 0;
                const remaining = Math.max(limit - used, 0);
                providers.push({
                    id: 'tavily',
                    name: 'Tavily',
                    configured: true,
                    status: 'ok',
                    plan: String(data?.account?.current_plan || 'Configured'),
                    monthlyLimit: Number.isFinite(limit) ? limit : 0,
                    usedThisMonth: Number.isFinite(used) ? used : 0,
                    remainingThisMonth: Number.isFinite(remaining) ? remaining : 0,
                    details: {
                        accountPlanLimit: Number(data?.account?.plan_limit || 0),
                        accountPlanUsage: Number(data?.account?.plan_usage || 0),
                        searchUsage: Number(data?.account?.search_usage || keyInfo?.search_usage || 0)
                    }
                });
            } catch (error) {
                providers.push({
                    id: 'tavily',
                    name: 'Tavily',
                    configured: true,
                    status: 'error',
                    error: error?.message || 'Failed to load Tavily usage.'
                });
            }
        } else {
            providers.push({
                id: 'tavily',
                name: 'Tavily',
                configured: false,
                status: 'missing_key',
                error: 'Tavily key is not saved.'
            });
        }

        if (newsApiKey) {
            try {
                const parseOptionalHeaderNumber = (headerValue) => {
                    if (headerValue === null || headerValue === undefined || headerValue === '') {
                        return null;
                    }
                    const parsed = Number(headerValue);
                    return Number.isFinite(parsed) ? parsed : null;
                };
                const res = await fetch('https://newsapi.org/v2/top-headlines?country=us&pageSize=1', {
                    method: 'GET',
                    headers: {
                        'X-Api-Key': newsApiKey
                    },
                    signal: AbortSignal.timeout(12000)
                });
                if (!res.ok) {
                    let apiError = '';
                    try {
                        const errData = await res.json();
                        apiError = errData?.message || errData?.code || '';
                    } catch {}
                    throw new Error(apiError || `NewsAPI request failed: ${res.status}`);
                }
                const data = await res.json();
                const limitHeader = parseOptionalHeaderNumber(res.headers.get('X-RateLimit-Limit'));
                const remainingHeader = parseOptionalHeaderNumber(res.headers.get('X-RateLimit-Remaining'));
                const resetHeader = res.headers.get('X-RateLimit-Reset');
                const monthlyLimit = limitHeader;
                const remainingThisMonth = remainingHeader;
                const usedThisMonth = (
                    monthlyLimit !== null && remainingThisMonth !== null
                ) ? Math.max(monthlyLimit - remainingThisMonth, 0) : null;
                providers.push({
                    id: 'newsapi',
                    name: 'NewsAPI',
                    configured: true,
                    status: 'ok',
                    plan: resetHeader ? 'Tracked' : 'Validated',
                    monthlyLimit,
                    usedThisMonth,
                    remainingThisMonth,
                    details: {
                        totalResults: Number(data?.totalResults || 0),
                        rateLimitReset: resetHeader || ''
                    }
                });
            } catch (error) {
                providers.push({
                    id: 'newsapi',
                    name: 'NewsAPI',
                    configured: true,
                    status: 'error',
                    error: error?.message || 'Failed to load NewsAPI usage.'
                });
            }
        } else {
            providers.push({
                id: 'newsapi',
                name: 'NewsAPI',
                configured: false,
                status: 'missing_key',
                error: 'NewsAPI key is not saved.'
            });
        }

        return { success: true, providers, fetchedAt: Date.now() };
    } catch (error) {
        return { success: false, error: error?.message || 'Failed to load scraper usage stats.' };
    }
}));

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

ipcMain.handle('dialog-select-file', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'dialog-select-file', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
}));

ipcMain.handle('dialog-select-folder', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'dialog-select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
}));

ipcMain.handle('dialog-open-custom', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'dialog-open-custom', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths;
}));


// Security: Validate all file paths to prevent directory traversal attacks
ipcMain.handle('fs-read-file', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'fs-read-file', async (e, filePath) => {
    try {
        const abs = path.resolve(String(filePath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        return await fs.promises.readFile(abs, 'utf8');
    } catch(e) {
        console.warn('[Security] fs-read-file blocked:', e?.message);
        return null;
    }
}));

ipcMain.handle('fs-trust-folder', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'fs-trust-folder', async (e, folderPath) => {
    try {
        const abs = path.resolve(String(folderPath || ''));
        if (!abs) throw new Error('Invalid folder path');
        
        // Verify the folder exists and is a directory
        const stat = await fs.promises.stat(abs);
        if (!stat.isDirectory()) throw new Error('Path is not a directory');
        
        addTrustedFolderPath(abs);
        return { success: true, path: abs };
    } catch(e) {
        console.warn('[Security] fs-trust-folder failed:', e?.message);
        return { success: false, error: e?.message };
    }
}));

ipcMain.handle('fs-read-dir', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'fs-read-dir', async (e, dirPath) => {
    try {
        const abs = path.resolve(String(dirPath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        
        // Use withFileTypes to get both name and type, then filter for files only
        const entries = await fs.promises.readdir(abs, { withFileTypes: true });
        
        // Return only files, as strings (just the names)
        return entries
            .filter(dirent => dirent.isFile())
            .map(dirent => dirent.name);
    } catch(e) {
        console.warn('[Security] fs-read-dir blocked:', e?.message);
        return [];
    }
}));

ipcMain.handle('fs-stat-path', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'fs-stat-path', async (e, targetPath) => {
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
}));

ipcMain.handle('fs-create-file', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'fs-create-file', async (e, { path: filePath, content }) => {
    try {
        const abs = path.resolve(String(filePath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        await fs.promises.writeFile(abs, String(content || ''));
        return true;
    } catch(e) {
        console.warn('[Security] fs-create-file blocked:', e?.message);
        return false;
    }
}));

ipcMain.handle('fs-create-folder', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'fs-create-folder', async (e, dirPath) => {
    try {
        const abs = path.resolve(String(dirPath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        await fs.promises.mkdir(abs, { recursive: true });
        return true;
    } catch(e) {
        console.warn('[Security] fs-create-folder blocked:', e?.message);
        return false;
    }
}));

ipcMain.handle('fs-delete-path', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'fs-delete-path', async (e, targetPath) => {
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
}));

ipcMain.handle('fs-rename-path', withAuthorizedRendererPages(AUTHORIZED_RENDERER_PAGES.serverOperator, 'fs-rename-path', async (e, { oldPath, newPath }) => {
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
}));

if (!isStandaloneLikeLaunch) {
  app.whenReady().then(async () => {
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

    ipcMain.handle('app-shortcut:create', (event, { appId }) => {
      return createDesktopShortcut(appId);
    });

    app.on('web-contents-created', (event, contents) => registerGlobalShortcuts(contents));
    websearch.registerHandlers(() => getRuntimeSettingsWithScraperWebApiKeys(cachedSettings), {
      isAuthorizedSender: (event) => isAuthorizedRendererPage(event, AUTHORIZED_RENDERER_PAGES.scraper)
    });
    await initialExtensionsPromise;
    createMainWindow();
    void bootstrapAlwaysOnServices();
  }).catch(err => {
    console.error('[Om-X] Startup Error:', err);
  });
}

// Minimal launch for mini-app shortcuts
if (isMiniLaunch) {
  app.whenReady().then(() => {
    try {
      if (miniAppId === 'chessly-electron') {
        chesslyApp?.openWindow?.({ embedded: true });
      } else if (miniAppId === 'go-electron') {
        goApp?.openWindow?.({ embedded: true });
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
