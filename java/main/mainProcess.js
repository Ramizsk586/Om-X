const { app, BrowserWindow, BrowserView, ipcMain, Menu, screen, dialog, session, shell, webContents, crashReporter, protocol, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec, execFile } = require('child_process');
const https = require('https');
const net = require('net');
const os = require('os');
const { MongoClient } = require('mongodb');
const { pathToFileURL, fileURLToPath } = require('url');
const dotenv = require('dotenv');

function loadOmxEnvFiles() {
  const candidates = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../Om-chat/.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'Om-chat', '.env'),
    path.join(path.dirname(process.execPath || ''), '.env'),
    path.join(path.dirname(process.execPath || ''), 'Om-chat', '.env'),
    process.resourcesPath ? path.join(process.resourcesPath, '.env') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'Om-chat', '.env') : ''
  ];

  const seen = new Set();
  for (const candidate of candidates) {
    const target = String(candidate || '').trim();
    if (!target || seen.has(target)) continue;
    seen.add(target);
    dotenv.config({ path: target, override: false });
  }
}

loadOmxEnvFiles();
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

const TRUSTED_RENDERER_PROTOCOLS = new Set(['file:', 'http:', 'https:']);
const TRUSTED_LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

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
  try { roots.push(path.resolve(app.getAppPath())); } catch (_) {}
  try { roots.push(path.resolve(process.resourcesPath || '')); } catch (_) {}
  try { roots.push(path.resolve(process.cwd())); } catch (_) {}
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

function isTrustedLoopbackRendererUrl(urlObj) {
  try {
    if (!urlObj) return false;
    if (!['http:', 'https:'].includes(String(urlObj.protocol || '').toLowerCase())) return false;
    return TRUSTED_LOOPBACK_HOSTNAMES.has(String(urlObj.hostname || '').toLowerCase());
  } catch (_) {
    return false;
  }
}

const BUILTIN_EXTENSION_POLICIES = Object.freeze({});

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
    if (parsed.protocol === 'file:') return isTrustedRendererFileUrl(parsed);
    return isTrustedLoopbackRendererUrl(parsed);
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

const OMX_APP_ROOT = path.resolve(__dirname, '../../');
const OMX_GAMES_ROOT = path.resolve(OMX_APP_ROOT, 'game', 'electron');
const OMX_LAN_SERVER_ENTRY = path.resolve(OMX_GAMES_ROOT, 'chessly electron', 'java', 'lanServer.js');
const OMX_LAN_DEFAULT_PORT = 3001;
const OMX_MCP_MODULE = path.resolve(OMX_APP_ROOT, 'mcp', 'server.mjs');
const OMX_OMCHAT_ROOT = path.resolve(OMX_APP_ROOT, 'Om-chat');
const OMX_OMCHAT_ENTRY = path.resolve(OMX_OMCHAT_ROOT, 'server', 'index.js');
const OMX_OMCHAT_NGROK_HELPER = path.resolve(OMX_OMCHAT_ROOT, 'scripts', 'run-with-ngrok.js');
const OMX_OMCHAT_DEFAULT_PORT = 3031;
const OMX_FIREWALL_RULE_STATE_VERSION = 2;
const OMX_ALLOWED_SCRIPT_ENTRY_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);
const OMX_ALLOWED_RENDERER_ENTRY_EXTENSIONS = new Set(['.html', '.htm']);
const OMX_ALLOW_UNSAFE_STANDALONE_ENTRY = String(process.env.OMX_ALLOW_UNSAFE_STANDALONE_ENTRY || '').trim() === '1';
const PDF_VIEWER_REDIRECT_TTL_MS = 15000;
const SERVER_STATUS_CACHE_TTL_MS = 1200;
const GPU_INFO_CACHE_TTL_MS = 10000;
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
    let availableMemory = 0;
    let source = 'fallback';
    try {
        const info = await app.getGPUInfo('complete');
        availableMemory = extractGpuMemoryMB(info);
        if (availableMemory > 0) source = 'electron';
    } catch (_) {
        // ignore and fall back
    }
    if (!availableMemory) availableMemory = 8000;

    const value = { availableMemory, source };
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
let llamaMemoryGuardInterval = null;
let lanServerProcess = null;
let mcpServerProcess = null;
let omChatServerProcess = null;
let omChatNgrokProcess = null;
let lanServerInstance = global.omxLanServer || null;
const SERVER_LOG_LIMIT = 500;
const serverLogs = {
  llama: [],
  lan: [],
  mcp: [],
  omchat: []
};
const serverStarts = {
  llama: null,
  lan: null,
  mcp: null,
  omchat: null
};
const serverConfigs = {
  llama: null,
  lan: null,
  mcp: null,
  omchat: null
};
let mcpModule = null;
let omChatModule = null;
let isServerShutdownInProgress = false;
let hasCompletedServerShutdown = false;

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

function pushServerLog(name, type, data) {
  if (!serverLogs[name]) return;
  const lines = String(data || '').split(/\r?\n/).filter(Boolean);
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

async function startLanServerInternal() {
  invalidateServerStatusCache('lan');
  const LanServer = loadLanServerClass();
  if (!(lanServerInstance instanceof LanServer)) {
    lanServerInstance = global.omxLanServer instanceof LanServer
      ? global.omxLanServer
      : new LanServer(mainWindow);
  }

  global.lanServer = lanServerInstance;
  global.omxLanServer = lanServerInstance;
  attachLanHostWindow(mainWindow);

  const info = await lanServerInstance.start();
  const status = syncLanRuntimeState();
  ensureFirewallRules([OMX_LAN_DEFAULT_PORT]);
  pushServerLog('lan', 'success', `LAN server listening at ${info?.url || status?.serverInfo?.url || 'unavailable'}`);
  emitResolvedLanIp();
  return status;
}

async function stopLanServerInternal() {
  invalidateServerStatusCache('lan');
  if (!lanServerInstance?.getStatus?.().isRunning) {
    syncLanRuntimeState();
    return false;
  }

  try {
    lanServerInstance.stop();
    pushServerLog('lan', 'info', 'LAN server stopped.');
  } finally {
    syncLanRuntimeState();
    emitResolvedLanIp();
  }

  return true;
}

function normalizeOmChatUrl(value) {
  const normalized = String(value || '').trim().replace(/[\/]+$/, '');
  return normalized ? `${normalized}/` : '';
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
    contextLength: String(config.contextLength || serverConfigs.llama?.contextLength || '4096'),
    gpuLayers: String(config.gpuLayers || serverConfigs.llama?.gpuLayers || '-1'),
    threads: String(config.threads || serverConfigs.llama?.threads || '4'),
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
    running: isServerProcessActive(llamaServerProcess) && ready,
    ready,
    pid: llamaServerProcess?.pid || null,
    tunnelPid: llamaNgrokProcess?.pid || null,
    ngrokRunning: isServerProcessActive(llamaNgrokProcess),
    startedAt: serverStarts.llama || null,
    config
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
    const runtimeStatus = omChatApi.getStatus?.() || {
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

async function startOmChatServerInternal(config = {}) {
  invalidateServerStatusCache('omchat');
  const existingConfig = serverConfigs.omchat || {};
  const port = Number(config.port || existingConfig.port || OMX_OMCHAT_DEFAULT_PORT);
  const host = String(config.host || existingConfig.host || '0.0.0.0').trim() || '0.0.0.0';
  const useNgrok = config.useNgrok === true;

  if (!fs.existsSync(OMX_OMCHAT_ENTRY)) {
    return { success: false, error: 'Om Chat server entry not found.' };
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

let omchatSyncRunning = false;

function resolveOmChatLocalDbPath() {
  const configured = String(cachedSettings?.omchat?.localDbPath || '').trim();
  if (configured) return configured;
  const envPath = String(process.env.LOCAL_DB_PATH || '').trim();
  if (envPath) return envPath;
  return path.join(process.cwd(), 'omchat-local-db');
}

function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeJsonArray(filePath, data = []) {
  const safe = Array.isArray(data) ? data : [];
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(safe, null, 0), 'utf8');
}

function buildKeyFromFields(doc, fields) {
  if (!doc || typeof doc !== 'object') return null;
  const parts = fields.map((field) => String(doc[field] ?? '').trim());
  if (parts.some((part) => !part)) return null;
  return parts.join('|');
}

function extractComparableTimestamp(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const candidates = [
    doc.updatedAt,
    doc.lastActiveAt,
    doc.createdAt,
    doc.joinedAt,
    doc.bannedAt,
    doc.expiresAt
  ];
  for (const value of candidates) {
    if (!value) continue;
    const stamp = value instanceof Date ? value.getTime() : Date.parse(String(value));
    if (Number.isFinite(stamp)) return stamp;
  }
  return null;
}

function stripMongoId(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const clone = { ...doc };
  delete clone._id;
  return clone;
}

function resolveSyncConflict(localDoc, mongoDoc) {
  if (localDoc && !mongoDoc) return localDoc;
  if (mongoDoc && !localDoc) return mongoDoc;
  if (!localDoc || !mongoDoc) return localDoc || mongoDoc;

  const localStamp = extractComparableTimestamp(localDoc);
  const mongoStamp = extractComparableTimestamp(mongoDoc);
  if (localStamp != null && mongoStamp != null) {
    return localStamp >= mongoStamp ? localDoc : mongoDoc;
  }
  if (localStamp != null && mongoStamp == null) return localDoc;
  if (mongoStamp != null && localStamp == null) return mongoDoc;
  return mongoDoc;
}

async function syncOmChatDatabases(event) {
  if (omchatSyncRunning) {
    return { success: false, error: 'A backup is already running.' };
  }
  omchatSyncRunning = true;

  const sendProgress = (payload) => {
    try {
      event?.sender?.send('omchat-sync-progress', payload);
    } catch (_) {}
  };

  const sendDone = (payload) => {
    try {
      event?.sender?.send('omchat-sync-done', payload);
    } catch (_) {}
  };

  const localDbDir = resolveOmChatLocalDbPath();
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  if (!mongoUri) {
    const error = 'MongoDB URI is not configured in .env.';
    sendDone({ success: false, error });
    omchatSyncRunning = false;
    return { success: false, error };
  }

  const collections = [
    { local: 'users', mongo: 'users', key: ['id'] },
    { local: 'servers', mongo: 'servers', key: ['id'] },
    { local: 'channels', mongo: 'channels', key: ['id'] },
    { local: 'roles', mongo: 'roles', key: ['id'] },
    { local: 'members', mongo: 'members', key: ['userId', 'serverId'] },
    { local: 'invites', mongo: 'invites', key: ['code'] },
    { local: 'bans', mongo: 'bans', key: ['userId', 'serverId'] },
    { local: 'chatMessages', mongo: 'chat_messages', key: ['id'] },
    { local: 'dmConversations', mongo: 'dm_conversations', key: ['id'] },
    { local: 'uploadBlobs', mongo: 'upload_blobs', key: ['sha256'] },
    { local: 'refreshTokens', mongo: 'refresh_tokens', key: ['token'] },
    { local: 'deviceTokens', mongo: 'device_tokens', key: ['token'] },
    { local: 'sessionLogs', mongo: 'session_log', key: ['id'] },
    { local: 'otpCodes', mongo: 'otpcodes', key: ['email'] }
  ];

  const client = new MongoClient(mongoUri, { ignoreUndefined: true });

  try {
    sendProgress({ status: 'Connecting to MongoDB...', percent: 2, message: 'Connecting to MongoDB...' });
    await client.connect();
    const db = client.db('omchat');
    sendProgress({ status: 'MongoDB connected.', percent: 6, message: 'MongoDB connected.' });

    const totalCollections = collections.length;
    let completedCollections = 0;

    for (const entry of collections) {
      const percentBase = 6 + Math.round((completedCollections / totalCollections) * 88);
      sendProgress({
        status: `Backing up ${entry.local}...`,
        percent: percentBase,
        message: `Uploading ${entry.local} -> ${entry.mongo}`
      });

      const localPath = path.join(localDbDir, `${entry.local}.json`);
      const localRows = readJsonArray(localPath);

      const mongoCollection = db.collection(entry.mongo);
      let upserted = 0;
      for (const row of localRows) {
        const key = buildKeyFromFields(row, entry.key);
        if (!key) continue;
        await mongoCollection.replaceOne(
          buildMongoFilter(entry.key, row),
          stripMongoId(row),
          { upsert: true }
        );
        upserted += 1;
      }

      completedCollections += 1;
      sendProgress({
        status: `Backed up ${entry.local}.`,
        percent: 6 + Math.round((completedCollections / totalCollections) * 88),
        message: `${entry.local}: ${upserted} records uploaded`
      });
    }

    sendProgress({ status: 'Finalizing backup...', percent: 98, message: 'Finalizing backup...' });
    sendDone({ success: true, mode: 'backup' });
    return { success: true };
  } catch (error) {
    const message = error?.message || 'Database backup failed.';
    sendDone({ success: false, error: message, mode: 'backup' });
    return { success: false, error: message };
  } finally {
    try {
      await client.close();
    } catch (_) {}
    omchatSyncRunning = false;
  }
}

async function importOmChatDatabases(event) {
  if (omchatSyncRunning) {
    return { success: false, error: 'A download is already running.' };
  }
  omchatSyncRunning = true;

  const sendProgress = (payload) => {
    try {
      event?.sender?.send('omchat-sync-progress', payload);
    } catch (_) {}
  };

  const sendDone = (payload) => {
    try {
      event?.sender?.send('omchat-sync-done', payload);
    } catch (_) {}
  };

  const localDbDir = resolveOmChatLocalDbPath();
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  if (!mongoUri) {
    const error = 'MongoDB URI is not configured in .env.';
    sendDone({ success: false, error, mode: 'import' });
    omchatSyncRunning = false;
    return { success: false, error };
  }

  const collections = [
    { local: 'users', mongo: 'users' },
    { local: 'servers', mongo: 'servers' },
    { local: 'channels', mongo: 'channels' },
    { local: 'roles', mongo: 'roles' },
    { local: 'members', mongo: 'members' },
    { local: 'invites', mongo: 'invites' },
    { local: 'bans', mongo: 'bans' },
    { local: 'chatMessages', mongo: 'chat_messages' },
    { local: 'dmConversations', mongo: 'dm_conversations' },
    { local: 'uploadBlobs', mongo: 'upload_blobs' },
    { local: 'refreshTokens', mongo: 'refresh_tokens' },
    { local: 'deviceTokens', mongo: 'device_tokens' },
    { local: 'sessionLogs', mongo: 'session_log' },
    { local: 'otpCodes', mongo: 'otpcodes' }
  ];

  const client = new MongoClient(mongoUri, { ignoreUndefined: true });

  try {
    sendProgress({ status: 'Connecting to MongoDB...', percent: 2, message: 'Connecting to MongoDB...' });
    await client.connect();
    const db = client.db('omchat');
    sendProgress({ status: 'MongoDB connected.', percent: 6, message: 'MongoDB connected.' });

    const defaultName = `omchat-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Save OmChat Backup Zip',
      defaultPath: path.join(app.getPath('downloads'), defaultName),
      filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) {
      const error = 'Download canceled.';
      sendDone({ success: false, error, mode: 'import' });
      return { success: false, error };
    }

    const output = fs.createWriteStream(saveResult.filePath);
    const archive = require('archiver')('zip', { zlib: { level: 9 } });
    const downloadId = `dl-omchat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const downloadStart = Date.now();
    const zipPromise = new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
    });
    archive.pipe(output);

    const totalCollections = collections.length;
    let completedCollections = 0;

    for (const entry of collections) {
      const percentBase = 6 + Math.round((completedCollections / totalCollections) * 88);
      sendProgress({
        status: `Downloading ${entry.local}...`,
        percent: percentBase,
        message: `Adding ${entry.mongo} -> ${entry.local}.json`
      });

      const mongoCollection = db.collection(entry.mongo);
      const mongoRows = await mongoCollection.find({}).toArray();
      const cleaned = Array.isArray(mongoRows)
        ? mongoRows.map((row) => stripMongoId(row))
        : [];
      const payload = JSON.stringify(cleaned, null, 0);
      archive.append(payload, { name: `${entry.local}.json` });

      completedCollections += 1;
      sendProgress({
        status: `Added ${entry.local}.`,
        percent: 6 + Math.round((completedCollections / totalCollections) * 88),
        message: `${entry.local}: ${cleaned.length} records`
      });
    }

    sendProgress({ status: 'Finalizing zip...', percent: 98, message: 'Finalizing zip...' });
    await archive.finalize();
    await zipPromise;

    try {
      const stat = fs.statSync(saveResult.filePath);
      const data = {
        id: downloadId,
        filename: path.basename(saveResult.filePath),
        totalBytes: stat.size,
        receivedBytes: stat.size,
        state: 'completed',
        startTime: downloadStart,
        url: 'omchat://backup',
        speed: 0,
        savePath: saveResult.filePath,
        saveDir: path.dirname(saveResult.filePath)
      };
      const list = getStoredDownloads();
      list.unshift(data);
      downloadsStore.set(list);
      downloadsStore.scheduleFlush();
      broadcast('download-update', data);
    } catch (_) {}
    sendDone({ success: true, mode: 'import' });
    return { success: true };
  } catch (error) {
    const message = error?.message || 'Database download failed.';
    sendDone({ success: false, error: message, mode: 'import' });
    return { success: false, error: message };
  } finally {
    try {
      await client.close();
    } catch (_) {}
    omchatSyncRunning = false;
  }
}

function buildMongoFilter(fields, doc) {
  const filter = {};
  for (const field of fields) {
    filter[field] = doc?.[field];
  }
  return filter;
}

async function getOmChatMongoStats() {
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  if (!mongoUri) {
    return { success: false, error: 'MongoDB URI is not configured in .env.' };
  }
  const client = new MongoClient(mongoUri, { ignoreUndefined: true });
  try {
    await client.connect();
    const targetDbName = 'omchat';
    const db = client.db(targetDbName);
    const stats = await db.command({ dbStats: 1, scale: 1 });
    const fsUsedSize = Number.isFinite(stats.fsUsedSize) ? stats.fsUsedSize : null;
    const fsTotalSize = Number.isFinite(stats.fsTotalSize) ? stats.fsTotalSize : null;
    const freeBytes = fsUsedSize != null && fsTotalSize != null ? Math.max(0, fsTotalSize - fsUsedSize) : null;
    let clusterStats = null;
    try {
      const admin = client.db().admin();
      const list = await admin.listDatabases();
      const dbNames = (list?.databases || [])
        .map((entry) => entry?.name)
        .filter((name) => typeof name === 'string' && name && !['admin', 'local', 'config'].includes(name));
      if (dbNames.length) {
        let totalData = 0;
        let totalStorage = 0;
        let totalIndex = 0;
        for (const name of dbNames) {
          try {
            const entryStats = await client.db(name).command({ dbStats: 1, scale: 1 });
            if (Number.isFinite(entryStats.dataSize)) totalData += entryStats.dataSize;
            if (Number.isFinite(entryStats.storageSize)) totalStorage += entryStats.storageSize;
            if (Number.isFinite(entryStats.indexSize)) totalIndex += entryStats.indexSize;
          } catch (_) {}
        }
        clusterStats = {
          dataSize: totalData,
          storageSize: totalStorage,
          indexSize: totalIndex,
          dbCount: dbNames.length
        };
      }
    } catch (_) {}
    return {
      success: true,
      stats: {
        dataSize: Number.isFinite(stats.dataSize) ? stats.dataSize : null,
        storageSize: Number.isFinite(stats.storageSize) ? stats.storageSize : null,
        indexSize: Number.isFinite(stats.indexSize) ? stats.indexSize : null,
        fsUsedSize,
        fsTotalSize,
        freeBytes,
        dbName: targetDbName,
        cluster: clusterStats
      }
    };
  } catch (error) {
    return { success: false, error: error?.message || 'Failed to read MongoDB stats.' };
  } finally {
    try {
      await client.close();
    } catch (_) {}
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveNodeExecutable() {
  const candidates = [
    String(process.env.OMX_NODE_EXECUTABLE || '').trim(),
    String(process.env.NODE || '').trim(),
    String(process.argv0 || '').trim()
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const normalized = candidate.replace(/^"+|"+$/g, '');
      if (!normalized) continue;
      if (fs.existsSync(normalized)) return normalized;
      if (/node(?:\.exe)?$/i.test(path.basename(normalized))) return normalized;
    } catch (_) {}
  }

  return process.platform === 'win32' ? 'node.exe' : 'node';
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

async function waitForServerReady({ host, port, proc, timeoutMs = 10000 }) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    if (!isServerProcessActive(proc)) return false;
    if (await checkTcpPort(host, port)) return true;
    await wait(200);
  }
  return false;
}

function clearLlamaMemoryGuard() {
  if (llamaMemoryGuardInterval) {
    clearInterval(llamaMemoryGuardInterval);
    llamaMemoryGuardInterval = null;
  }
}

function forceStopLlamaServer(reason = 'Llama server stopped.') {
  if (!isServerProcessActive(llamaServerProcess)) return;
  pushServerLog('llama', 'error', reason);
  mainWindow?.webContents?.send('llama-server-output', { type: 'error', data: `${reason}\n` });
  clearLlamaMemoryGuard();
  try {
    llamaServerProcess.kill();
  } catch (e) {
    try {
      if (llamaServerProcess.pid && process.platform === 'win32') {
        exec(`taskkill /pid ${llamaServerProcess.pid} /T /F`);
      }
    } catch (_) {}
  }
}

function startLlamaMemoryGuard() {
  clearLlamaMemoryGuard();
  llamaMemoryGuardInterval = setInterval(() => {
    if (!isServerProcessActive(llamaServerProcess)) {
      clearLlamaMemoryGuard();
      return;
    }
    try {
      const totalRam = Number(os.totalmem() || 0);
      const freeRam = Number(os.freemem() || 0);
      if (totalRam <= 0) return;
      const usedRatio = (totalRam - freeRam) / totalRam;
      if (usedRatio >= 0.95) {
        const usedPercent = (usedRatio * 100).toFixed(1);
        forceStopLlamaServer(`Llama RAM guard triggered: system memory usage reached ${usedPercent}% of total RAM. Model unloaded and server stopped.`);
      }
    } catch (_) {}
  }, 2000);
}

async function shutdownManagedServers() {
  if (hasCompletedServerShutdown) return;
  if (isServerShutdownInProgress) return;
  isServerShutdownInProgress = true;

  try {
    if (isServerProcessActive(llamaServerProcess)) {
      pushServerLog('llama', 'info', 'Om-X is closing. Stopping llama server.');
      clearLlamaMemoryGuard();
      try {
        llamaServerProcess.kill();
      } catch (_) {
        try {
          if (llamaServerProcess?.pid && process.platform === 'win32') {
            exec(`taskkill /pid ${llamaServerProcess.pid} /T /F`);
          }
        } catch (_) {}
      }
      serverStarts.llama = null;
      serverConfigs.llama = null;
    }
    await stopLlamaNgrokTunnelInternal().catch(() => {});

    if (mcpServerProcess && mcpServerProcess.killed !== true) {
      pushServerLog('mcp', 'info', 'Om-X is closing. Stopping MCP server.');
      try {
        const moduleRef = await loadMcpModule();
        await moduleRef.stopServer();
      } catch (_) {}
      try {
        mcpServerProcess.kill();
      } catch (_) {}
      mcpServerProcess = null;
      serverStarts.mcp = null;
      serverConfigs.mcp = null;
    }

    if (lanServerInstance?.getStatus?.().isRunning) {
      pushServerLog('lan', 'info', 'Om-X is closing. Stopping LAN server.');
      try {
        lanServerInstance.stop();
      } catch (_) {}
      lanServerProcess = null;
      serverStarts.lan = null;
      serverConfigs.lan = null;
    }

    if (isServerProcessActive(omChatServerProcess) || isServerProcessActive(omChatNgrokProcess)) {
      pushServerLog('omchat', 'info', 'Om-X is closing. Stopping Om Chat server.');
      try {
        await stopOmChatNgrokTunnelInternal();
      } catch (_) {}
      if (isServerProcessActive(omChatServerProcess)) {
        try {
          const moduleRef = await loadOmChatModule();
          const omChatApi = moduleRef?.default || moduleRef;
          await omChatApi.stopServer();
        } catch (_) {}
        try {
          omChatServerProcess.kill();
        } catch (_) {}
      }
      omChatServerProcess = null;
      serverStarts.omchat = null;
      serverConfigs.omchat = null;
    }
  } finally {
    hasCompletedServerShutdown = true;
    isServerShutdownInProgress = false;
  }
}
// Temporary debugging aid for main window only.
const TEMP_MAIN_AUTO_OPEN_DEVTOOLS = false;
const trustedFolders = new Set();  // Track user-selected trusted folders

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

const WINDOW_ICON = resolveWindowIcon('app');

const MINECRAFT_WINDOW_ICON = (() => {
  const minecraftIconPath = ['ico', 'png', 'icns']
    .map((ext) => path.join(ICONS_DIR, `minecraft.${ext}`))
    .find((p) => fs.existsSync(p));
  if (minecraftIconPath) return minecraftIconPath;
  try {
    const dataUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%235d8c38'/%3E%3Cpath d='M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h4v4H8V8zm6 0h2v2h-2V8zm0 4h2v2h-2v-2zM8 14h4v2H8v-2z' fill='%23f7faf7'/%3E%3C/svg%3E";
    const icon = nativeImage.createFromDataURL(dataUrl);
    if (icon && !icon.isEmpty()) return icon;
  } catch (_) {}
  return HAS_ICON ? DISPLAY_ICON : undefined;
})();
let pendingAppLaunch = null;

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
    enableAdultContentBlock: true,
    showLoadingAnimation: false
  },
  security: {
    virusTotal: {
      apiKey: '',
      scanUrls: true,
      scanExecutables: true,
      blockOnSuspicious: true
    },
    popupBlocker: {
      enabled: true
    },
    cookieShield: {
      enabled: true,
      blockThirdPartyRequestCookies: true,
      blockThirdPartyResponseCookies: true
    }
  },
  blocklist: [],
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
  aiChat: {
    duckAiHideSidebar: false
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
    dbMode: 'local',
    localDbPath: '',
    useLocalIpOnly: false
  }
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

function normalizeBuiltInExtensionSettings(extensions = {}) {
  const nextExtensions = { ...(extensions || {}) };
  delete nextExtensions['shorts hide'];
  const availableExtensions = new Set();
  try {
    const extensionsBaseDir = getExtensionsBaseDir();
    if (extensionsBaseDir && fs.existsSync(extensionsBaseDir)) {
      const entries = fs.readdirSync(extensionsBaseDir, { withFileTypes: true });
      entries.forEach((entry) => {
        if (entry.isDirectory()) availableExtensions.add(entry.name);
      });
    }
  } catch (_) {}

  return Object.fromEntries(
    Object.entries({
      ...DEFAULT_SETTINGS.extensions,
      ...nextExtensions
    }).filter(([name]) => availableExtensions.has(name))
  );
}

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

const historyStore = createCachedJsonListStore(historyPath, 5000);
const bookmarksStore = createCachedJsonListStore(bookmarksPath, 500);
const downloadsStore = createCachedJsonListStore(downloadsPath, 100);

const getStoredHistory = () => historyStore.get();
const getStoredBookmarks = () => bookmarksStore.get();
const getStoredDownloads = () => downloadsStore.get();

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
  const vtUrlScanEnabled = cachedSettings?.security?.virusTotal?.scanUrls ?? true;
  if (!virusTotalClient) virusTotalClient = new VirusTotalClient(cachedSettings);
  else virusTotalClient.updateSettings(cachedSettings);
  const apiKey = String(options.apiKey || getVirusTotalApiKeyFromEnv() || virusTotalClient.getApiKey() || '').trim();

  if (!vtEnabled) {
    return buildSiteSafetyError(siteKey, 'VirusTotal disabled', { code: 'vt_disabled' });
  }
  if (!vtUrlScanEnabled) {
    return buildSiteSafetyError(siteKey, 'URL scanning disabled', { code: 'vt_url_scan_disabled' });
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

function extractGpuMemoryMB(info) {
  const candidates = [];
  const pushCandidate = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    // Treat large values as bytes.
    if (num > 262144 && num < 1e12) {
      candidates.push(num / (1024 * 1024));
      return;
    }
    candidates.push(num);
  };
  const visit = (value) => {
    if (!value) return;
    if (typeof value === 'number') {
      pushCandidate(value);
      return;
    }
    if (typeof value === 'string') {
      const match = value.match(/(\d+(\.\d+)?)/);
      if (match) pushCandidate(match[1]);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        const keyLower = String(key).toLowerCase();
        if (keyLower.includes('memory') || keyLower.includes('vram')) {
          pushCandidate(val);
        }
        visit(val);
      }
    }
  };
  visit(info);
  const filtered = candidates
    .map((n) => Math.round(n))
    .filter((n) => n > 256 && n < 262144);
  if (!filtered.length) return 0;
  return Math.max(...filtered);
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
  const activePath = active && typeof active.getSavePath === 'function' ? active.getSavePath() : null;
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
  const item = activeDownloadItems.get(String(id || '').trim());
  if (!item) return false;
  try { item.pause(); return true; } catch (_) { return false; }
});

ipcMain.handle('downloads-resume', async (_event, id) => {
  const item = activeDownloadItems.get(String(id || '').trim());
  if (!item) return false;
  try { item.resume(); return true; } catch (_) { return false; }
});

ipcMain.handle('downloads-cancel', async (_event, id) => {
  const item = activeDownloadItems.get(String(id || '').trim());
  if (!item) return false;
  try { item.cancel(); return true; } catch (_) { return false; }
});

ipcMain.handle('downloads-start', async (event, url, options = {}) => {
  try {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) throw new Error('URL is required');

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

ipcMain.handle('llama:get-gpu-info', async () => {
  return getCachedGpuInfoPayload();
});

ipcMain.handle('mcp:start-server', async (_event, config = {}) => {
  if (mcpServerProcess && !mcpServerProcess.killed) {
    return { success: false, error: 'MCP server is already running.' };
  }

  const port = Number(config.port || 3000);
  const host = String(config.host || '127.0.0.1').trim() || '127.0.0.1';
  const webApiKeys = getScraperWebApiKeysFromEnv();
  const enabledTools = {
    wiki: config?.enabledTools?.wiki !== false,
    webSearch: config?.enabledTools?.webSearch !== false,
    duckduckgo: config?.enabledTools?.duckduckgo !== false,
    tavily: config?.enabledTools?.tavily !== false,
    news: config?.enabledTools?.news !== false,
    diagram: config?.enabledTools?.diagram !== false
  };
  if (!Object.values(enabledTools).some(Boolean)) {
    return { success: false, error: 'Enable at least one MCP tool before starting the server.' };
  }

  if (!fs.existsSync(OMX_MCP_MODULE)) {
    return { success: false, error: 'MCP server entry not found.' };
  }

  try {
    const moduleRef = await loadMcpModule();
    await moduleRef.startServer({
      host,
      port,
      enabledTools,
      apiKeys: {
        serpApiKey: webApiKeys.serpapi,
        tavilyApiKey: webApiKeys.tavily,
        newsApiKey: webApiKeys.newsapi
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
    serverConfigs.mcp = { host, port, enabledTools };
    pushServerLog('mcp', 'info', `MCP HTTP server listening at http://${host}:${port}/mcp`);
    mainWindow?.webContents?.send('mcp-server-output', { type: 'stdout', data: `MCP HTTP server listening at http://${host}:${port}/mcp\n` });
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
});

ipcMain.handle('mcp:stop-server', async () => {
  if (!mcpServerProcess || mcpServerProcess.killed) {
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
});

ipcMain.handle('omchat:start-server', async (event, config = {}) => {
  ensureTrustedServerControlSender(event);
  return startOmChatServerInternal(config);
});

ipcMain.handle('omchat:stop-server', async (event) => {
  ensureTrustedServerControlSender(event);
  return stopOmChatServerInternal();
});

ipcMain.handle('omchat:select-db-folder', async (event) => {
  ensureTrustedServerControlSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select OmChat Local Database Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths?.length) return { success: false, canceled: true };
  return { success: true, folderPath: result.filePaths[0] };
});

ipcMain.handle('omchat:get-db-config', async (event) => {
  ensureTrustedServerControlSender(event);
  const settings = cachedSettings || {};
  const omchat = settings.omchat || {};
  return {
    dbMode: omchat.dbMode || 'local',
    localDbPath: omchat.localDbPath || '',
    hasMongoUri: Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim())
  };
});

ipcMain.handle('omchat:sync-db', async (event) => {
  ensureTrustedServerControlSender(event);
  return syncOmChatDatabases(event);
});

ipcMain.handle('omchat:import-db', async (event) => {
  ensureTrustedServerControlSender(event);
  return importOmChatDatabases(event);
});

ipcMain.handle('omchat:get-mongo-stats', async (event) => {
  ensureTrustedServerControlSender(event);
  return getOmChatMongoStats();
});

ipcMain.handle('server:get-status', async (_event, name) => {
  const serverName = String(name || '').trim().toLowerCase();
  if (serverName === 'lan') {
    return getCachedServerStatus('lan', async () => getLanStatusPayload());
  }
  if (serverName === 'omchat') {
    return getCachedServerStatus('omchat', () => getOmChatStatusPayload());
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
});

ipcMain.handle('server:get-logs', async (_event, name) => {
  const serverName = String(name || '').trim().toLowerCase();
  if (!serverLogs[serverName]) {
    return { success: false, error: 'Unknown server.' };
  }
  return { success: true, logs: serverLogs[serverName] };
});

ipcMain.handle('llama:start-server', async (_event, config = {}) => {
  invalidateServerStatusCache('llama');
  const existingConfig = serverConfigs.llama || {};
  const executable = String(config.executable || existingConfig.executable || '').trim();
  const model = String(config.model || '').trim();
  const modelsPath = String(config.modelsPath || '').trim();
  if (!executable || !model) {
    return { success: false, error: 'Executable and model are required.' };
  }

  const modelPath = path.isAbsolute(model) ? model : path.join(modelsPath || '', model);
  const contextLength = String(config.contextLength || existingConfig.contextLength || '4096');
  const gpuLayers = String(config.gpuLayers || existingConfig.gpuLayers || '-1');
  const port = Number(config.port || existingConfig.port || 8080);
  const threads = String(config.threads || existingConfig.threads || '4');
  const serverType = String(config.serverType || config.host || existingConfig.serverType || existingConfig.host || 'local').trim().toLowerCase();
  const host = serverType === 'lan' || serverType === '0.0.0.0'
    ? '0.0.0.0'
    : '127.0.0.1';
  const launchHost = ['0.0.0.0', '::'].includes(host) ? '127.0.0.1' : host;

  if (isServerProcessActive(llamaServerProcess)) {
    const syncedConfig = syncLlamaServerConfig({
      executable,
      modelPath,
      contextLength,
      gpuLayers,
      port,
      threads,
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
      localUrl: syncedConfig.localUrl,
      publicUrl: syncedConfig.publicUrl || '',
      url: syncedConfig.url,
      ngrokRunning: isServerProcessActive(llamaNgrokProcess),
      tunnelPid: llamaNgrokProcess?.pid || null
    };
  }

  const args = ['-m', modelPath, '-c', contextLength, '-ngl', gpuLayers, '--port', String(port), '-t', threads, '--host', host];

  try {
    llamaServerProcess = spawn(executable, args, {
      cwd: path.dirname(executable),
      stdio: 'pipe'
    });
    startLlamaMemoryGuard();
    serverStarts.llama = Date.now();
    syncLlamaServerConfig({
      executable,
      modelPath,
      contextLength,
      gpuLayers,
      port,
      threads,
      host,
      serverType
    });

    llamaServerProcess.stdout.on('data', (data) => {
      pushServerLog('llama', 'info', data.toString());
      mainWindow?.webContents?.send('llama-server-output', { type: 'stdout', data: data.toString() });
    });
    llamaServerProcess.stderr.on('data', (data) => {
      pushServerLog('llama', 'warning', data.toString());
      mainWindow?.webContents?.send('llama-server-output', { type: 'stderr', data: data.toString() });
    });
    llamaServerProcess.on('error', (err) => {
      pushServerLog('llama', 'error', err?.message || String(err));
      mainWindow?.webContents?.send('llama-server-output', { type: 'error', data: err?.message || String(err) });
    });
    llamaServerProcess.on('exit', (code, signal) => {
      invalidateServerStatusCache('llama');
      clearLlamaMemoryGuard();
      serverStarts.llama = null;
      mainWindow?.webContents?.send('llama-server-exit', { code, signal });
      llamaServerProcess = null;
      void stopLlamaNgrokTunnelInternal().catch(() => {});
      serverConfigs.llama = null;
    });
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
      clearLlamaMemoryGuard();
      if (llamaServerProcess === spawnedProcess) {
        llamaServerProcess = null;
      }
      serverStarts.llama = null;
      await stopLlamaNgrokTunnelInternal().catch(() => {});
      serverConfigs.llama = null;
      return { success: false, error: startupState?.error || 'Llama server failed to stay running.' };
    }

    const ready = await waitForServerReady({
      host: launchHost,
      port,
      proc: spawnedProcess,
      timeoutMs: 60000
    });

    if (!ready) {
      const error = `Llama server process started but did not open http://${launchHost}:${port} within 60 seconds.`;
      pushServerLog('llama', 'error', error);
      mainWindow?.webContents?.send('llama-server-output', { type: 'error', data: `${error}\n` });
      clearLlamaMemoryGuard();
      try {
        spawnedProcess.kill();
      } catch (_) {
        try {
          if (spawnedProcess.pid && process.platform === 'win32') {
            exec(`taskkill /pid ${spawnedProcess.pid} /T /F`);
          }
        } catch (_) {}
      }
      if (llamaServerProcess === spawnedProcess) {
        llamaServerProcess = null;
      }
      serverStarts.llama = null;
      await stopLlamaNgrokTunnelInternal().catch(() => {});
      serverConfigs.llama = null;
      return { success: false, error };
    }

    let syncedConfig = syncLlamaServerConfig({
      executable,
      modelPath,
      contextLength,
      gpuLayers,
      port,
      threads,
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
        try {
          spawnedProcess.kill();
        } catch (_) {
          try {
            if (spawnedProcess.pid && process.platform === 'win32') {
              exec(`taskkill /pid ${spawnedProcess.pid} /T /F`);
            }
          } catch (_) {}
        }
        if (llamaServerProcess === spawnedProcess) {
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
      pid: spawnedProcess?.pid || null,
      serverType: syncedConfig.serverType,
      host: syncedConfig.host,
      launchHost: syncedConfig.launchHost,
      port: syncedConfig.port,
      modelPath: syncedConfig.modelPath,
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
  }
});

ipcMain.handle('llama:stop-server', async () => {
  invalidateServerStatusCache('llama');
  const wasRunning = isServerProcessActive(llamaServerProcess);
  if (!wasRunning && !isServerProcessActive(llamaNgrokProcess)) {
    return { success: false, error: 'Llama server is not running.' };
  }

  clearLlamaMemoryGuard();
  if (wasRunning) {
    try {
      llamaServerProcess.kill();
    } catch (e) {
      try {
        if (llamaServerProcess.pid && process.platform === 'win32') {
          exec(`taskkill /pid ${llamaServerProcess.pid} /T /F`);
        }
      } catch (_) {}
    }
  }

  await stopLlamaNgrokTunnelInternal().catch(() => {});
  return { success: true };
});

ipcMain.handle('llama:send-command', async (_event, command) => {
  if (!isServerProcessActive(llamaServerProcess) || !llamaServerProcess.stdin) {
    return { success: false, error: 'Llama server is not running.' };
  }
  try {
    llamaServerProcess.stdin.write(`${String(command || '').trim()}\n`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || 'Failed to send command.' };
  }
});

ipcMain.handle('llama:check-model-size', async (_event, modelsPath, modelName) => {
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

    const canLoad = sizeMB <= (availableMemory * 0.95);
    return { size: sizeMB, canLoad, availableMemory };
  } catch (e) {
    return { size: 0, canLoad: true, availableMemory: 0, error: e?.message || 'Unable to read model size.' };
  }
});

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
    ...source,
    apiKey: '',
    scanUrls: true,
    scanExecutables: true,
    blockOnSuspicious: true
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
      enableAntivirus: true
    },
    security: {
      ...security,
      popupBlocker: {
        ...popupBlocker,
        enabled: true
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
        ...DEFAULT_SETTINGS.aiChat,
        ...(saved?.aiChat || {})
      },
      youtubeAddon: normalizedYouTubeAddon,
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        ...(saved?.shortcuts || {})
      },
      llm: normalizeSharedLlmSettings(saved?.llm),
      extensions: normalizeBuiltInExtensionSettings(saved?.extensions),
      searchEngines: normalizedSearchEngines,
      defaultSearchEngineId: normalizeDefaultSearchEngineId(saved?.defaultSearchEngineId, normalizedSearchEngines),
      blocklist: normalizeBlocklistEntries(saved?.blocklist)
    });
  }
  cachedSettings.llm = normalizeSharedLlmSettings(cachedSettings?.llm);
  cachedSettings.aiConfig = normalizePersistedAiConfig(cachedSettings?.aiConfig);
  cachedSettings = normalizeLockedSecuritySettings(cachedSettings);

  applyPreferredWebTheme();
  // Built-in extensions must be loaded after Electron's ready event.
  initialExtensionsPromise = (async () => {
    await app.whenReady();
    await applyExtensions(cachedSettings);
    await syncShortsHideForAllWebContents(cachedSettings);
  })().catch(e => {
    console.warn('[Extensions] initial load failed', e);
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

async function fileExists(targetPath) {
    try {
        await fs.promises.access(targetPath);
        return true;
    } catch (_) {
        return false;
    }
}

function pickManifestIcon(manifest = {}) {
    const preferredSizes = ['128', '96', '64', '48', '32', '24', '16'];
    const candidates = [];

    if (manifest && typeof manifest.icons === 'object' && manifest.icons) {
        candidates.push(manifest.icons);
    }

    const actionIcon = manifest?.action?.default_icon || manifest?.browser_action?.default_icon;
    if (actionIcon && typeof actionIcon === 'object') {
        candidates.push(actionIcon);
    } else if (typeof actionIcon === 'string' && actionIcon.trim()) {
        return actionIcon.trim();
    }

    for (const iconMap of candidates) {
        for (const size of preferredSizes) {
            if (iconMap[size]) return String(iconMap[size]).trim();
        }
        const fallback = Object.values(iconMap).find((value) => typeof value === 'string' && value.trim());
        if (fallback) return String(fallback).trim();
    }

    return '';
}

async function findExtensionIconFallback(extensionRootDir) {
    const candidates = [
        'icons/icon_128.png', 'icons/icon128.png', 'icons/icon-128.png',
        'icons/icon_64.png', 'icons/icon64.png', 'icons/icon-64.png',
        'icons/icon_48.png', 'icons/icon48.png', 'icons/icon-48.png',
        'icons/icon_32.png', 'icons/icon32.png', 'icons/icon-32.png',
        'icons/icon_16.png', 'icons/icon16.png', 'icons/icon-16.png',
        'img/icon_128.png', 'img/icon_64.png', 'img/icon_48.png',
        'img/icon_32.png', 'img/icon_16.png', 'img/icon.png',
        'assets/icon_128.png', 'assets/icon.png',
        'icon_128.png', 'icon128.png', 'icon-128.png',
        'icon_64.png', 'icon64.png', 'icon-64.png',
        'icon_48.png', 'icon48.png', 'icon-48.png',
        'icon_32.png', 'icon32.png', 'icon-32.png',
        'icon_16.png', 'icon16.png', 'icon-16.png',
        'logo.png', 'logo.svg', 'icon.png', 'icon.svg'
    ];

    for (const rel of candidates) {
        const candidatePath = path.join(extensionRootDir, rel);
        if (await fileExists(candidatePath)) {
            return pathToFileURL(candidatePath).href;
        }
    }
    return '';
}

async function resolveManifestMessageToken(rawValue, extensionRootDir, manifest = {}) {
    const value = String(rawValue || '').trim();
    const tokenMatch = /^__MSG_(.+)__$/.exec(value);
    if (!tokenMatch) return value;

    const key = tokenMatch[1];
    const locale = String(manifest?.default_locale || 'en').trim() || 'en';
    const localeFile = path.join(extensionRootDir, '_locales', locale, 'messages.json');

    try {
        const messages = JSON.parse(await fs.promises.readFile(localeFile, 'utf8'));
        const localized = messages?.[key]?.message;
        return typeof localized === 'string' && localized.trim() ? localized.trim() : value;
    } catch (_) {
        return value;
    }
}

async function readExtensionManifestMeta(extensionFolderPath) {
    const manifestPath = path.join(extensionFolderPath, 'manifest.json');
    try {
        const manifestRaw = await fs.promises.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestRaw);
        const iconPath = pickManifestIcon(manifest);
        let icon = '';
        if (iconPath) {
            if (/^(https?:|data:|file:)/i.test(iconPath)) {
                icon = iconPath;
            } else {
                const normalizedIconPath = iconPath.replace(/^[/\\]+/, '');
                icon = pathToFileURL(path.join(extensionFolderPath, normalizedIconPath)).href;
            }
        }
        if (!icon) {
            icon = await findExtensionIconFallback(extensionFolderPath);
        }

        const displayName = await resolveManifestMessageToken(manifest?.name, extensionFolderPath, manifest);
        const description = await resolveManifestMessageToken(manifest?.description, extensionFolderPath, manifest);

        return {
            folderPath: extensionFolderPath,
            manifestPath,
            manifest,
            icon,
            displayName: displayName || '',
            description: description || '',
            version: String(manifest?.version || '').trim(),
            manifestVersion: Number(manifest?.manifest_version) || null
        };
    } catch (_) {
        return null;
    }
}

function getBuiltinExtensionPolicy(extensionName) {
    return BUILTIN_EXTENSION_POLICIES[String(extensionName || '').trim()] || null;
}

function getSessionExtensionsApi(ses) {
    if (!ses) return null;
    return ses.extensions && typeof ses.extensions === 'object' ? ses.extensions : ses;
}

function getAllSessionExtensions(ses) {
    const extApi = getSessionExtensionsApi(ses);
    if (!extApi || typeof extApi.getAllExtensions !== 'function') return [];
    try {
        return extApi.getAllExtensions() || [];
    } catch (_) {
        return [];
    }
}

async function loadSessionExtension(ses, extensionPath, options = {}) {
    const extApi = getSessionExtensionsApi(ses);
    if (!extApi || typeof extApi.loadExtension !== 'function') {
        throw new Error('Electron session extension API is unavailable.');
    }
    return extApi.loadExtension(extensionPath, options);
}

function removeSessionExtension(ses, extensionId) {
    const extApi = getSessionExtensionsApi(ses);
    if (!extApi || typeof extApi.removeExtension !== 'function') return;
    return extApi.removeExtension(extensionId);
}

async function ensureCleanDir(dirPath) {
    try { await fs.promises.rm(dirPath, { recursive: true, force: true }); } catch (_) {}
    await fs.promises.mkdir(dirPath, { recursive: true });
}

async function copyDirectoryRecursive(sourceDir, destinationDir, options = {}) {
    const filter = typeof options.filter === 'function' ? options.filter : null;
    await fs.promises.mkdir(destinationDir, { recursive: true });
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(sourceDir, entry.name);
        const dstPath = path.join(destinationDir, entry.name);
        if (filter && !(await filter(srcPath, entry, dstPath))) {
            continue;
        }
        if (entry.isDirectory()) {
            await copyDirectoryRecursive(srcPath, dstPath, options);
        } else if (entry.isFile()) {
            await fs.promises.copyFile(srcPath, dstPath);
        }
    }
}

async function copyFileIfPresent(sourcePath, destinationPath) {
    if (!(await fileExists(sourcePath))) return false;
    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.promises.copyFile(sourcePath, destinationPath);
    return true;
}

async function isManifestRuntimeUsable(manifestDir) {
    try {
        const manifestPath = path.join(manifestDir, 'manifest.json');
        const raw = await fs.promises.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(raw);

        const normalizeRel = (value) => String(value || '').trim().replace(/^[/\\]+/, '');
        const mustExist = async (value) => {
            const rel = normalizeRel(value);
            if (!rel) return true;
            return fileExists(path.join(manifestDir, rel));
        };

        const bg = manifest?.background || {};
        if (typeof bg.page === 'string' && !(await mustExist(bg.page))) return false;
        if (typeof bg.service_worker === 'string' && !(await mustExist(bg.service_worker))) return false;
        if (Array.isArray(bg.scripts)) {
            for (const scriptPath of bg.scripts) {
                if (!(await mustExist(scriptPath))) return false;
            }
        }

        const popupPath = manifest?.action?.default_popup || manifest?.browser_action?.default_popup;
        if (typeof popupPath === 'string' && !(await mustExist(popupPath))) return false;

        return true;
    } catch (_) {
        return false;
    }
}

async function resolvePreferredExtensionFolder(sourceDir, extensionName = '') {
    return resolveExtensionFolder(sourceDir, { prepareBuild: false });
}

function isAllowedBuiltinRuntimePath(sourceDir, resolvedDir, policy) {
    if (!policy || !Array.isArray(policy.runtimeCandidates) || policy.runtimeCandidates.length === 0) return true;
    const sourceAbs = path.resolve(String(sourceDir || ''));
    const resolvedAbs = path.resolve(String(resolvedDir || ''));
    return policy.runtimeCandidates.some((relativePath) => {
        const candidateAbs = path.resolve(sourceAbs, relativePath);
        return resolvedAbs === candidateAbs;
    });
}

function validateExtensionSafety(extensionName, sourceDir, resolvedDir, manifestMeta) {
    if (!manifestMeta || !manifestMeta.manifest || !manifestMeta.manifestPath) {
        return { safe: false, error: 'Invalid extension manifest.' };
    }

    const sourceAbs = path.resolve(String(sourceDir || ''));
    const resolvedAbs = path.resolve(String(resolvedDir || ''));
    if (!isSameOrSubFsPath(resolvedAbs, sourceAbs)) {
        return { safe: false, error: 'Resolved extension path escapes source directory.' };
    }

    const manifestVersion = Number(manifestMeta.manifestVersion) || Number(manifestMeta.manifest?.manifest_version) || 0;
    if (![2, 3].includes(manifestVersion)) {
        return { safe: false, error: `Unsupported manifest_version: ${manifestVersion || 'unknown'}.` };
    }

    const manifest = manifestMeta.manifest || {};
    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions.map((p) => String(p || '').trim()).filter(Boolean) : [];
    const hostPermissions = Array.isArray(manifest.host_permissions) ? manifest.host_permissions.map((p) => String(p || '').trim()).filter(Boolean) : [];

    if (permissions.length > 80 || hostPermissions.length > 200) {
        return { safe: false, error: 'Extension requests too many permissions.' };
    }

    const globallyBlockedPermissions = new Set(['nativeMessaging', 'proxy']);
    for (const permission of permissions) {
        if (globallyBlockedPermissions.has(permission)) {
            return { safe: false, error: `Blocked permission requested: ${permission}` };
        }
    }

    const policy = getBuiltinExtensionPolicy(extensionName);
    if (!policy) return { safe: true };

    if (!isAllowedBuiltinRuntimePath(sourceDir, resolvedDir, policy)) {
        return { safe: false, error: 'Built-in extension resolved to a non-approved runtime path.' };
    }

    if (policy.allowedManifestVersions && !policy.allowedManifestVersions.has(manifestVersion)) {
        return { safe: false, error: `Manifest version ${manifestVersion} is not allowed for built-in extension.` };
    }

    for (const permission of permissions) {
        if (policy.blockedPermissions?.has(permission)) {
            return { safe: false, error: `Built-in extension requested blocked permission: ${permission}` };
        }
    }

    return { safe: true };
}

// attempt to prepare an extension directory before loading it
async function resolveExtensionFolder(dir, options = {}) {
    const shouldPrepareBuild = options.prepareBuild === true;
    // if the directory itself contains a manifest, use it
    const manifestPath = path.join(dir, 'manifest.json');
    if (await fileExists(manifestPath)) return dir;

    // if there's a package.json, run npm install and maybe build
    const pkgPath = path.join(dir, 'package.json');
    if (shouldPrepareBuild && await fileExists(pkgPath)) {
        try {
            const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
            // install dependencies (production only)
            await new Promise((resolve, reject) => {
                const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
                const child = spawn(cmd, ['install', '--production'], { cwd: dir, stdio: 'ignore' });
                child.on('error', reject);
                child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('npm install failed')));
            });
            if (pkg.scripts && pkg.scripts.build) {
                await new Promise((resolve, reject) => {
                    const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
                    const child = spawn(cmd, ['run', 'build'], { cwd: dir, stdio: 'inherit' });
                    child.on('error', reject);
                    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('npm run build failed')));
                });
            }
        } catch (e) {
            console.warn('[Extensions] prepare failed for', dir, e.message);
        }
    }

    // look for common output directories
    const candidates = [
        path.join(dir, 'src'),
        path.join(dir, 'dist'),
        path.join(dir, 'dist', 'extension'),
        path.join(dir, 'dist', 'chrome'),
        path.join(dir, 'dist', 'chromium'),
        path.join(dir, 'dist', 'chrome-mv3'),
        path.join(dir, 'dist', 'mv3'),
        path.join(dir, 'build'),
        path.join(dir, 'build', 'chrome'),
        path.join(dir, 'build', 'chromium'),
        path.join(dir, 'build', 'extension'),
        path.join(dir, 'out'),
        path.join(dir, 'out', 'chrome'),
        path.join(dir, 'out', 'chromium'),
        path.join(dir, 'unpacked'),
        path.join(dir, 'unpacked', 'chrome'),
        path.join(dir, 'unpacked', 'chromium'),
        path.join(dir, 'web_ext_build'),
        path.join(dir, 'extension'),
        path.join(dir, 'platform', 'chromium'),
        path.join(dir, 'platform', 'mv3', 'chromium'),
        path.join(dir, 'platform', 'mv3', 'extension')
    ];
    for (const cand of candidates) {
        if (await fileExists(path.join(cand, 'manifest.json')) && await isManifestRuntimeUsable(cand)) return cand;
    }

    // final fallback: check one nested level for unpacked builds
    try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const candidateDir = path.join(dir, entry.name);
            if (await fileExists(path.join(candidateDir, 'manifest.json')) && await isManifestRuntimeUsable(candidateDir)) return candidateDir;
            try {
                const nestedEntries = await fs.promises.readdir(candidateDir, { withFileTypes: true });
                for (const nestedEntry of nestedEntries) {
                    if (!nestedEntry.isDirectory()) continue;
                    const nestedCandidateDir = path.join(candidateDir, nestedEntry.name);
                    if (await fileExists(path.join(nestedCandidateDir, 'manifest.json')) && await isManifestRuntimeUsable(nestedCandidateDir)) {
                        return nestedCandidateDir;
                    }
                }
            } catch (_) {}
        }
    } catch (_) {
        // ignore and return null below
    }

    return null;
}

async function ensureExtensionLoaded(dir, extensionName = '') {
    try {
        if (!app.isReady()) {
            await app.whenReady();
        }
        let realDir = null;
        try {
            realDir = await resolvePreferredExtensionFolder(dir, extensionName);
        } catch (e) {
            if (getBuiltinExtensionPolicy(extensionName)) {
                return { success: false, error: e?.message || 'Built-in extension runtime preparation failed.' };
            }
            return { success: false, error: e?.message || 'Extension resolution failed.' };
        }
        if (!realDir) {
            return { success: false, error: 'manifest.json not found (build the extension or place unpacked folder here)' };
        }

        const manifestMeta = await readExtensionManifestMeta(realDir);
        const safety = validateExtensionSafety(extensionName, dir, realDir, manifestMeta);
        if (!safety.safe) {
            return { success: false, error: safety.error || 'Extension safety validation failed.' };
        }

        const ses = session.defaultSession;
        const expectedName = String(extensionName || manifestMeta?.name || '').trim();
        const normalizedRealDir = path.resolve(realDir).toLowerCase();
        try {
            const inventory = getAllSessionExtensions(ses);
            for (const ext of inventory) {
                const extName = String(ext?.name || '').trim();
                const extPath = path.resolve(String(ext?.path || '')).toLowerCase();
                if (!ext?.id) continue;
                if (extPath === normalizedRealDir) {
                    return {
                        success: true,
                        extension: { id: ext.id, name: ext.name, version: ext.version, path: ext.path },
                        changed: false
                    };
                }
                if (expectedName && extName === expectedName) {
                    try { removeSessionExtension(ses, String(ext.id)); } catch (_) {}
                }
            }
        } catch (_) {}
        const ext = await loadSessionExtension(ses, realDir, { allowFileAccess: false });
        return { success: true, extension: { id: ext.id, name: ext.name, version: ext.version, path: ext.path }, changed: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// keep track of currently loaded extensions by folder name
const loadedExtensions = {};
// capture any load errors per extension
const extensionErrors = {};

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

async function applyExtensions(settings) {
    if (!app.isReady()) {
        await app.whenReady();
    }
    // extensions live alongside the main directory (../extension)
    const extDir = getExtensionsBaseDir();
    // ensure the folder exists so readdir won't error
    try { await fs.promises.mkdir(extDir, { recursive: true }); } catch (e) {}
    try {
        let didChangeExtensionState = false;
        const entries = await fs.promises.readdir(extDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const name = entry.name;
            const dir = path.join(extDir, name);
            const builtInPolicy = getBuiltinExtensionPolicy(name);
            const shouldEnable = settings.extensions?.[name]?.enabled === true || (settings.extensions?.[name]?.enabled == null && builtInPolicy?.enabledByDefault === true);
            const already = loadedExtensions[name];
            if (shouldEnable && !already) {
                const res = await ensureExtensionLoaded(dir, name);
                if (res.success) {
                    loadedExtensions[name] = res.extension;
                    delete extensionErrors[name];
                    if (res.changed !== false) didChangeExtensionState = true;
                } else {
                    extensionErrors[name] = res.error;
                    console.warn('[Extensions] failed to load', name, res.error);
                }
            } else if (!shouldEnable && already) {
                await unloadExtensionFromSession(name, already);
                delete loadedExtensions[name];
                delete extensionErrors[name];
                didChangeExtensionState = true;
            }
        }
        if (didChangeExtensionState) {
            reloadAllBrowserWebContents();
        }
    } catch (e) {
        console.warn('[Extensions] scan error:', e);
    }
}

async function unloadExtensionFromSession(extensionName, trackedExtension = null) {
    if (!app.isReady()) {
        await app.whenReady();
    }
    const ses = session.defaultSession;
    if (!ses) return;

    const candidateIds = new Set();
    if (trackedExtension?.id) candidateIds.add(String(trackedExtension.id));

    try {
        const inventory = getAllSessionExtensions(ses);
        for (const ext of inventory) {
            const extName = String(ext?.name || '').trim();
            const extPath = String(ext?.path || '').trim().toLowerCase();
            if (
                extName === extensionName ||
                extPath.endsWith(`\\${String(extensionName || '').trim().toLowerCase()}`) ||
                extPath.includes(`\\${String(extensionName || '').trim().toLowerCase()}\\`)
            ) {
                if (ext?.id) candidateIds.add(String(ext.id));
            }
        }
    } catch (_) {}

    for (const extId of candidateIds) {
        try {
            removeSessionExtension(ses, extId);
        } catch (_) {}
    }
}

function reloadAllBrowserWebContents() {
    const allContents = webContents.getAllWebContents();
    allContents.forEach((contents) => {
        try {
            if (!contents || contents.isDestroyed?.() || contents.isCrashed?.()) return;
            if (contents.getType?.() !== 'webview') return;
            const currentUrl = String(contents.getURL?.() || '').trim();
            if (!/^https?:/i.test(currentUrl)) return;
            contents.reloadIgnoringCache?.();
        } catch (_) {}
    });
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

function attachMiniAppContextMenu(hostWindow, options = {}) {
  if (!hostWindow || hostWindow.isDestroyed()) return;
  const getPageContents = typeof options.getPageContents === 'function'
    ? options.getPageContents
    : () => hostWindow.webContents;
  const includeNavigation = options.includeNavigation !== false;
  const includeDeveloper = options.includeDeveloper !== false;

  const bindMenu = (sourceContents) => {
    if (!sourceContents || sourceContents.isDestroyed?.()) return;
    sourceContents.on('context-menu', (event, params = {}) => {
      event.preventDefault();
      const pageContents = getPageContents();
      const template = [];

      template.push({
        label: 'System',
        submenu: [
          { label: 'Open Main Om-X Browser', click: () => openMainBrowserWindow() },
          {
            label: 'Minimize',
            enabled: !!hostWindow && !hostWindow.isDestroyed?.(),
            click: () => {
              try { hostWindow?.minimize?.(); } catch (_) {}
            }
          },
          {
            label: hostWindow?.isMaximized?.() ? 'Restore' : 'Maximize',
            enabled: !!hostWindow && !hostWindow.isDestroyed?.(),
            click: () => {
              try {
                if (hostWindow?.isMaximized?.()) hostWindow.unmaximize();
                else hostWindow?.maximize?.();
              } catch (_) {}
            }
          },
          {
            label: 'Close',
            enabled: !!hostWindow && !hostWindow.isDestroyed?.(),
            click: () => {
              try { hostWindow?.close?.(); } catch (_) {}
            }
          }
        ]
      });

      template.push({
        label: 'Page',
        submenu: [
          {
            label: 'Back',
            enabled: includeNavigation && !!pageContents && pageContents.canGoBack?.(),
            click: () => {
              if (includeNavigation && pageContents?.canGoBack?.()) pageContents.goBack();
            }
          },
          {
            label: 'Forward',
            enabled: includeNavigation && !!pageContents && pageContents.canGoForward?.(),
            click: () => {
              if (includeNavigation && pageContents?.canGoForward?.()) pageContents.goForward();
            }
          },
          {
            label: 'Reload',
            enabled: !!pageContents,
            click: () => {
              try { pageContents?.reload?.(); } catch (_) {}
            }
          }
        ]
      });

      if (includeDeveloper) {
        template.push({
          label: 'Developer',
          submenu: [
            {
              label: 'Toggle DevTools',
              click: () => {
                try { toggleDevTools(hostWindow); } catch (_) {}
              }
            },
            {
              label: 'Inspect Element',
              click: () => {
                try {
                  const x = Number(params.x) || 0;
                  const y = Number(params.y) || 0;
                  sourceContents.inspectElement(x, y);
                } catch (_) {}
              }
            }
          ]
        });
      }

      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window: hostWindow });
    });
  };

  bindMenu(hostWindow.webContents);
  if (Array.isArray(options.extraContents)) {
    options.extraContents.forEach((wc) => bindMenu(wc));
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 960, height: 640, 
    frame: false, 
    titleBarStyle: 'hidden', 
    show: false,
    icon: WINDOW_ICON,
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
  attachLanHostWindow(mainWindow);
  if (!shortsHideWebContentsHookBound) {
    shortsHideWebContentsHookBound = true;
    app.on('web-contents-created', (_event, contents) => {
      attachShortsHideToContents(contents);
      attachGlobalScrollbarToContents(contents);
    });
  }
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences) => {
    // Keep guest webviews locked down while still allowing Chromium's PDF viewer.
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    webPreferences.webSecurity = true;
    webPreferences.sandbox = true;
    webPreferences.plugins = true;

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
          downloadsStore.set(list);
          downloadsStore.scheduleFlush();
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
          downloadsStore.set(list);
          downloadsStore.scheduleFlush();
          broadcast('download-update', data);
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
        icon: WINDOW_ICON,
        webPreferences: { preload: path.join(__dirname, '../preload.js'), webviewTag: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, sandbox: true, devTools: false }
    });
    const theme = cachedSettings.theme || 'noir';
    previewWindow.loadFile(path.join(__dirname, '../../html/windows/preview.html'), { query: { url, theme } });
    previewWindow.once('ready-to-show', () => previewWindow.show());
    previewWindow.on('closed', () => previewWindow = null);
}

ipcMain.on('window-minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
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
            icon: WINDOW_ICON,
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
        const abs = path.resolve(String(dirPath || ''));
        if (!isPathInSafeDirectories(abs)) throw new Error('Access denied: Path outside allowed directories');
        const files = await fs.promises.readdir(abs);
        return files;
    } catch (e) {
        return [];
    }
});

function isPrivilegedSettingsSender(event) {
  const senderUrl = getIpcSenderUrl(event);
  if (!senderUrl) return false;
  try {
    const parsed = new URL(senderUrl);
    if (parsed.protocol !== 'file:') return false;
    const pathname = decodeURIComponent(parsed.pathname || '').replace(/\\/g, '/').toLowerCase();
    return pathname.endsWith('/html/windows/system.html')
      || pathname.endsWith('/html/pages/scraper.html');
  } catch (_) {
    return false;
  }
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
  if (redacted?.security?.virusTotal) {
    redacted.security.virusTotal.apiKey = '';
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
      virusTotal: normalizeVirusTotalSettings({
        ...(cachedSettings?.security?.virusTotal || {}),
        ...(incoming?.security?.virusTotal || {})
      }),
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
      ...DEFAULT_SETTINGS.aiChat,
      ...(cachedSettings?.aiChat || {}),
      ...(incoming?.aiChat || {})
    },
    youtubeAddon: normalizedYouTubeAddon,
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...(cachedSettings?.shortcuts || {}),
      ...(incoming?.shortcuts || {})
    },
    extensions: normalizeBuiltInExtensionSettings({
      ...(cachedSettings?.extensions || {}),
      ...(incoming?.extensions || {})
    }),
    searchEngines: normalizedSearchEngines,
    defaultSearchEngineId: normalizeDefaultSearchEngineId(
      incoming?.defaultSearchEngineId ?? cachedSettings?.defaultSearchEngineId ?? DEFAULT_SETTINGS.defaultSearchEngineId,
      normalizedSearchEngines
    ),
    llm: normalizeSharedLlmSettings(incoming?.llm ?? cachedSettings?.llm),
    blocklist: normalizeBlocklistEntries(incoming?.blocklist ?? cachedSettings?.blocklist),
    omchat: {
      ...DEFAULT_SETTINGS.omchat,
      ...(cachedSettings?.omchat || {}),
      ...(incoming?.omchat || {}),
      dbMode: String(incoming?.omchat?.dbMode ?? cachedSettings?.omchat?.dbMode ?? 'local') === 'mongo' ? 'mongo' : 'local',
      localDbPath: String(incoming?.omchat?.localDbPath ?? cachedSettings?.omchat?.localDbPath ?? '').trim(),
      useLocalIpOnly: Boolean(incoming?.omchat?.useLocalIpOnly ?? cachedSettings?.omchat?.useLocalIpOnly ?? DEFAULT_SETTINGS.omchat.useLocalIpOnly)
    }
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
    // extension state may have changed
    await applyExtensions(secureNormalizedSettings);
    await syncShortsHideForAllWebContents(secureNormalizedSettings);
    broadcast('settings-updated', secureNormalizedSettings);
  }
  return success;
});

ipcMain.handle('security:get-site-safety-status', async (_event, payload = {}) => {
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
});

ipcMain.handle('security:prime-site-safety-scan', async (_event, payload = {}) => {
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
});

ipcMain.handle('system-open-path', async (e, targetPath) => {
    try { if (!targetPath) return false; await shell.openPath(targetPath); return true; } catch (e) { return false; }
});

ipcMain.handle('system-get-user-data-path', () => app.getPath('userData'));

ipcMain.handle('system-get-local-ip', () => {
  return getResolvedLanIp();
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

            const result = await aiProvider.performTask(promptInput, {
                provider: targetProvider,
                model: resolvedConfig.model,
                keyOverride: resolvedConfig.key || '',
                tools: params.tools,
                systemInstruction: params.systemInstruction,
                aiConfig: aiConfig,
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

ipcMain.handle('scraper:get-groq-keys', async (_event) => getScraperGroqKeysFromEnv());
ipcMain.handle('scraper:get-groq-model', async (_event) => getScraperGroqModelFromEnv());
ipcMain.handle('scraper:get-web-api-keys', async (_event) => getScraperWebApiKeysFromEnv());

ipcMain.handle('scraper:get-usage-stats', async (_event) => {
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

ipcMain.handle('fs-trust-folder', async (e, folderPath) => {
    try {
        const abs = path.resolve(String(folderPath || ''));
        if (!abs) throw new Error('Invalid folder path');
        
        // Verify the folder exists and is a directory
        const stat = await fs.promises.stat(abs);
        if (!stat.isDirectory()) throw new Error('Path is not a directory');
        
        trustedFolders.add(abs);
        return { success: true, path: abs };
    } catch(e) {
        console.warn('[Security] fs-trust-folder failed:', e?.message);
        return { success: false, error: e?.message };
    }
});

ipcMain.handle('fs-read-dir', async (e, dirPath) => {
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
    websearch.registerHandlers(() => getRuntimeSettingsWithScraperWebApiKeys(cachedSettings));
    await initialExtensionsPromise;
    createMainWindow();
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

app.on('before-quit', (event) => {
  if (hasCompletedServerShutdown || isServerShutdownInProgress) {
    return;
  }
  event.preventDefault();
  Promise.allSettled([
    bookmarksStore.flush(),
    historyStore.flush(),
    downloadsStore.flush()
  ])
    .then(() => shutdownManagedServers())
    .catch((error) => {
      console.error('[Shutdown] Failed to stop managed servers cleanly:', error);
    })
    .finally(() => {
      app.quit();
    });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });



