const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { Blob: BufferBlob, File: BufferFile } = require('buffer');
const { TextEncoder, TextDecoder } = require('util');
const { BLOCKED_BUILTINS, ALLOWED_BUILTINS, sanitizeExtensionHostEnv } = require('../main/coder/ExtensionPolicy');

const streamWeb = (() => {
  try {
    return require('stream/web');
  } catch (_) {
    return {};
  }
})();

const urlModule = (() => {
  try {
    return require('url');
  } catch (_) {
    return {};
  }
})();

const perfHooks = (() => {
  try {
    return require('perf_hooks');
  } catch (_) {
    return {};
  }
})();

const nodeCrypto = (() => {
  try {
    return require('crypto');
  } catch (_) {
    return {};
  }
})();

const workerThreads = (() => {
  try {
    return require('worker_threads');
  } catch (_) {
    return {};
  }
})();

const undiciModule = (() => {
  try {
    return require('undici');
  } catch (_) {
    return {};
  }
})();

const CLANGD_EXTENSION_IDS = new Set([
  'llvm-vs-code-extensions.vscode-clangd'
]);

// clangd's bundled extension host code uses a few Node built-ins to spawn/manage the language server.
const CLANGD_EXTRA_ALLOWED_BUILTINS = new Set([
  'async_hooks',
  'child_process',
  'constants',
  'crypto',
  'fs',
  'fs/promises',
  'http',
  'https',
  'net',
  'punycode',
  'zlib'
]);

// Kilo Code needs filesystem access for local state/task/workspace helpers.
// Keep this scoped to the extension id instead of opening fs for all extensions.
const KILOCODE_EXTENSION_IDS = new Set([
  'kilocode.kilo-code'
]);

const KILOCODE_EXTRA_ALLOWED_BUILTINS = new Set([
  'async_hooks',
  'child_process',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'module',
  'net',
  'perf_hooks',
  'process',
  'punycode',
  'readline',
  'stream/consumers',
  'stream/promises',
  'stream/web',
  'timers/promises',
  'tls',
  'util/types',
  'v8',
  'worker_threads',
  'zlib'
]);

const pending = new Map();
let nextRpcId = 1;

const NativeAbortController = typeof globalThis.AbortController === 'function' ? globalThis.AbortController : null;
const NativeAbortSignal = typeof globalThis.AbortSignal === 'function' ? globalThis.AbortSignal : null;
const NativeEvent = typeof globalThis.Event === 'function' ? globalThis.Event : null;
const NativeEventTarget = typeof globalThis.EventTarget === 'function' ? globalThis.EventTarget : null;
const NativeCustomEvent = typeof globalThis.CustomEvent === 'function' ? globalThis.CustomEvent : null;
const NativeDOMException = typeof globalThis.DOMException === 'function' ? globalThis.DOMException : null;
const NativeBlob = typeof globalThis.Blob === 'function'
  ? globalThis.Blob
  : (typeof BufferBlob === 'function' ? BufferBlob : undefined);
const NativeFile = typeof globalThis.File === 'function'
  ? globalThis.File
  : (typeof BufferFile === 'function' ? BufferFile : undefined);
const NativeFormData = typeof globalThis.FormData === 'function' ? globalThis.FormData : undefined;
const NativeHeaders = typeof globalThis.Headers === 'function' ? globalThis.Headers : undefined;
const NativeRequest = typeof globalThis.Request === 'function' ? globalThis.Request : undefined;
const NativeResponse = typeof globalThis.Response === 'function' ? globalThis.Response : undefined;
const NativeFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined;
const NativeCryptoObject = (globalThis.crypto && typeof globalThis.crypto === 'object')
  ? globalThis.crypto
  : (nodeCrypto.webcrypto && typeof nodeCrypto.webcrypto === 'object' ? nodeCrypto.webcrypto : undefined);
const NativeStructuredClone = typeof globalThis.structuredClone === 'function'
  ? globalThis.structuredClone.bind(globalThis)
  : undefined;
const NativeAtob = typeof globalThis.atob === 'function' ? globalThis.atob.bind(globalThis) : undefined;
const NativeBtoa = typeof globalThis.btoa === 'function' ? globalThis.btoa.bind(globalThis) : undefined;
const NativeQueueMicrotask = typeof globalThis.queueMicrotask === 'function'
  ? globalThis.queueMicrotask.bind(globalThis)
  : ((cb) => Promise.resolve().then(cb));
const NativeMessageChannel = typeof globalThis.MessageChannel === 'function'
  ? globalThis.MessageChannel
  : (typeof workerThreads.MessageChannel === 'function' ? workerThreads.MessageChannel : undefined);
const NativeMessagePort = typeof globalThis.MessagePort === 'function'
  ? globalThis.MessagePort
  : (typeof workerThreads.MessagePort === 'function' ? workerThreads.MessagePort : undefined);
const NativeBroadcastChannel = typeof globalThis.BroadcastChannel === 'function'
  ? globalThis.BroadcastChannel
  : (typeof workerThreads.BroadcastChannel === 'function' ? workerThreads.BroadcastChannel : undefined);
const NativeWebSocket = typeof globalThis.WebSocket === 'function'
  ? globalThis.WebSocket
  : (typeof undiciModule.WebSocket === 'function' ? undiciModule.WebSocket : undefined);
const NativeEventSource = typeof globalThis.EventSource === 'function'
  ? globalThis.EventSource
  : (typeof undiciModule.EventSource === 'function' ? undiciModule.EventSource : undefined);
const NativeWorker = typeof globalThis.Worker === 'function'
  ? globalThis.Worker
  : (typeof workerThreads.Worker === 'function' ? workerThreads.Worker : undefined);
const NativePerformance = (globalThis.performance && typeof globalThis.performance.now === 'function')
  ? globalThis.performance
  : ((perfHooks.performance && typeof perfHooks.performance.now === 'function')
    ? perfHooks.performance
    : { now: () => Date.now() });
const NativePerformanceObserver = typeof globalThis.PerformanceObserver === 'function'
  ? globalThis.PerformanceObserver
  : (typeof perfHooks.PerformanceObserver === 'function' ? perfHooks.PerformanceObserver : undefined);
const NativePerformanceEntry = typeof globalThis.PerformanceEntry === 'function'
  ? globalThis.PerformanceEntry
  : (typeof perfHooks.PerformanceEntry === 'function' ? perfHooks.PerformanceEntry : undefined);
const NativePerformanceMark = typeof globalThis.PerformanceMark === 'function'
  ? globalThis.PerformanceMark
  : (typeof perfHooks.PerformanceMark === 'function' ? perfHooks.PerformanceMark : undefined);
const NativePerformanceMeasure = typeof globalThis.PerformanceMeasure === 'function'
  ? globalThis.PerformanceMeasure
  : (typeof perfHooks.PerformanceMeasure === 'function' ? perfHooks.PerformanceMeasure : undefined);
const NativeURL = typeof globalThis.URL === 'function'
  ? globalThis.URL
  : (typeof urlModule.URL === 'function' ? urlModule.URL : null);
const NativeURLSearchParams = typeof globalThis.URLSearchParams === 'function'
  ? globalThis.URLSearchParams
  : (typeof urlModule.URLSearchParams === 'function' ? urlModule.URLSearchParams : null);
const NativeReadableStream = typeof globalThis.ReadableStream === 'function'
  ? globalThis.ReadableStream
  : (typeof streamWeb.ReadableStream === 'function' ? streamWeb.ReadableStream : null);
const NativeWritableStream = typeof globalThis.WritableStream === 'function'
  ? globalThis.WritableStream
  : (typeof streamWeb.WritableStream === 'function' ? streamWeb.WritableStream : null);
const NativeTransformStream = typeof globalThis.TransformStream === 'function'
  ? globalThis.TransformStream
  : (typeof streamWeb.TransformStream === 'function' ? streamWeb.TransformStream : null);
const NativeByteLengthQueuingStrategy = typeof globalThis.ByteLengthQueuingStrategy === 'function'
  ? globalThis.ByteLengthQueuingStrategy
  : (typeof streamWeb.ByteLengthQueuingStrategy === 'function' ? streamWeb.ByteLengthQueuingStrategy : null);
const NativeCountQueuingStrategy = typeof globalThis.CountQueuingStrategy === 'function'
  ? globalThis.CountQueuingStrategy
  : (typeof streamWeb.CountQueuingStrategy === 'function' ? streamWeb.CountQueuingStrategy : null);
const NativeTextEncoderStream = typeof globalThis.TextEncoderStream === 'function'
  ? globalThis.TextEncoderStream
  : (typeof streamWeb.TextEncoderStream === 'function' ? streamWeb.TextEncoderStream : null);
const NativeTextDecoderStream = typeof globalThis.TextDecoderStream === 'function'
  ? globalThis.TextDecoderStream
  : (typeof streamWeb.TextDecoderStream === 'function' ? streamWeb.TextDecoderStream : null);
const NativeCompressionStream = typeof globalThis.CompressionStream === 'function'
  ? globalThis.CompressionStream
  : (typeof streamWeb.CompressionStream === 'function' ? streamWeb.CompressionStream : null);
const NativeDecompressionStream = typeof globalThis.DecompressionStream === 'function'
  ? globalThis.DecompressionStream
  : (typeof streamWeb.DecompressionStream === 'function' ? streamWeb.DecompressionStream : null);

class FallbackAbortSignal {
  constructor() {
    this.aborted = false;
    this.reason = undefined;
    this.onabort = null;
    this._listeners = new Set();
  }
  addEventListener(type, listener) {
    if (type !== 'abort' || typeof listener !== 'function') return;
    this._listeners.add(listener);
  }
  removeEventListener(type, listener) {
    if (type !== 'abort' || typeof listener !== 'function') return;
    this._listeners.delete(listener);
  }
  dispatchEvent(event) {
    if (event?.type !== 'abort') return true;
    for (const fn of [...this._listeners]) {
      try { fn.call(this, event); } catch (_) {}
    }
    if (typeof this.onabort === 'function') {
      try { this.onabort.call(this, event); } catch (_) {}
    }
    return true;
  }
  throwIfAborted() {
    if (!this.aborted) return;
    const err = this.reason instanceof Error ? this.reason : new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  }
  static abort(reason) {
    const ctrl = new FallbackAbortController();
    ctrl.abort(reason);
    return ctrl.signal;
  }
  static timeout(ms) {
    const ctrl = new FallbackAbortController();
    const timeoutMs = Math.max(0, Number(ms) || 0);
    setTimeout(() => ctrl.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    return ctrl.signal;
  }
}

class FallbackAbortController {
  constructor() {
    this.signal = new FallbackAbortSignal();
  }
  abort(reason) {
    const signal = this.signal;
    if (!signal || signal.aborted) return;
    signal.aborted = true;
    signal.reason = reason;
    signal.dispatchEvent({ type: 'abort', target: signal });
  }
}

const AbortControllerCompat = NativeAbortController || FallbackAbortController;
const AbortSignalCompat = NativeAbortSignal || FallbackAbortSignal;

class FallbackEvent {
  constructor(type, options = {}) {
    this.type = typeof type === 'string' ? type : '';
    this.bubbles = Boolean(options?.bubbles);
    this.cancelable = Boolean(options?.cancelable);
    this.composed = Boolean(options?.composed);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.timeStamp = Date.now();
  }
  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
  stopPropagation() {}
  stopImmediatePropagation() {}
}

class FallbackCustomEvent extends FallbackEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = Object.prototype.hasOwnProperty.call(options, 'detail') ? options.detail : null;
  }
}

class FallbackEventTarget {
  constructor() {
    this._listeners = new Map();
  }
  addEventListener(type, listener) {
    const eventType = typeof type === 'string' ? type : '';
    if (!eventType || typeof listener !== 'function') return;
    if (!this._listeners.has(eventType)) this._listeners.set(eventType, new Set());
    this._listeners.get(eventType).add(listener);
  }
  removeEventListener(type, listener) {
    const eventType = typeof type === 'string' ? type : '';
    if (!eventType || typeof listener !== 'function') return;
    this._listeners.get(eventType)?.delete(listener);
  }
  dispatchEvent(event) {
    const evt = event && typeof event === 'object' ? event : new FallbackEvent(String(event || ''));
    if (!evt.type) return true;
    if (!evt.target) evt.target = this;
    evt.currentTarget = this;
    const listeners = this._listeners.get(evt.type);
    if (!listeners || !listeners.size) return !evt.defaultPrevented;
    for (const fn of [...listeners]) {
      try { fn.call(this, evt); } catch (_) {}
    }
    return !evt.defaultPrevented;
  }
}

class FallbackDOMException extends Error {
  constructor(message = '', name = 'Error') {
    super(typeof message === 'string' ? message : String(message ?? ''));
    this.name = typeof name === 'string' && name.trim() ? name : 'Error';
  }
}

const EventCompat = NativeEvent || FallbackEvent;
const EventTargetCompat = NativeEventTarget || FallbackEventTarget;
const CustomEventCompat = NativeCustomEvent || FallbackCustomEvent;
const DOMExceptionCompat = NativeDOMException || FallbackDOMException;

const state = {
  initialized: false,
  extensions: new Map(), // id -> metadata
  activated: new Map(), // id -> { exports, context, windowId }
  commands: new Map(), // commandId -> { extensionId, handler, windowId }
  workspaceRootsByWindow: new Map(),
  activeEditorByWindow: new Map(),
  workspaceContainsSatisfied: new Set(),
  windowEventsByWindow: new Map(),
  fileWatchersByWindow: new Map(),
  protocolEventsByWindow: new Map(),
  webviewPanels: new Map(),
  nextWebviewPanelId: 1,
  lspSessions: new Map(),
  dapSessions: new Map(),
  debugAdapterFactories: new Map(),
  nextWatcherId: 1,
  configurationOverridesByWindow: new Map(),
  // PHASE 2: Dynamic Activity Bar Containers
  activitybarContainers: new Map() // containerId -> { extensionId, title, iconPath, isActive }
};
const warnedUnsupportedApis = new Set();
const warnedMalformedValues = new Set();

function send(msg) { if (typeof process.send === 'function') process.send(msg); }
function sendEvent(payload) { send({ t: 'event', payload }); }
function sendRes(id, ok, result, error) { send(ok ? { t: 'res', id, ok: true, result } : { t: 'res', id, ok: false, error }); }

function brokerRequest(method, params = {}, meta = {}, timeoutMs = 15000) {
  const id = `h_${Date.now()}_${nextRpcId++}`;
  send({ t: 'req', id, method, params, meta });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Main broker timeout: ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
  });
}

function handleBrokerResponse(msg) {
  const p = pending.get(msg.id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(msg.id);
  if (msg.ok === false) {
    const err = new Error(msg.error?.message || 'Main broker error');
    err.code = msg.error?.code;
    p.reject(err);
  } else {
    p.resolve(msg.result);
  }
}

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function warnMalformedValue(key, value, message, extId = '', windowId = 0) {
  const warnKey = `${key}:${String(extId || '')}:${Number(windowId) || 0}`;
  if (warnedMalformedValues.has(warnKey)) return;
  warnedMalformedValues.add(warnKey);
  sendEvent({
    type: 'host-log',
    level: 'warn',
    extensionId: String(extId || ''),
    windowId: Number(windowId) || 0,
    message: `${message}${value === undefined ? '' : ` | value=${String(value)}`}`
  });
}

function cloneConfigValue(value) {
  if (Array.isArray(value)) return value.map((v) => cloneConfigValue(v));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneConfigValue(v);
    return out;
  }
  return value;
}

function getWindowConfigurationOverrides(windowId) {
  const key = Number(windowId) || 0;
  if (!state.configurationOverridesByWindow.has(key)) state.configurationOverridesByWindow.set(key, {});
  return state.configurationOverridesByWindow.get(key);
}

function normalizeConfigLookupKey(section, key) {
  const sectionText = safeString(section).trim();
  const keyText = safeString(key).trim();
  if (!sectionText) return keyText;
  if (!keyText) return sectionText;
  if (keyText === sectionText || keyText.startsWith(`${sectionText}.`)) return keyText;
  return `${sectionText}.${keyText}`;
}

function collectConfigurationSchema() {
  const schema = new Map();
  for (const ext of state.extensions.values()) {
    const contributes = ext?.contributes && typeof ext.contributes === 'object' ? ext.contributes : {};
    const rawConfig = contributes.configuration;
    const entries = Array.isArray(rawConfig) ? rawConfig : (rawConfig && typeof rawConfig === 'object' ? [rawConfig] : []);
    for (const entry of entries) {
      const props = entry?.properties && typeof entry.properties === 'object' ? entry.properties : {};
      for (const [rawKey, configDef] of Object.entries(props)) {
        const key = safeString(rawKey).trim();
        if (!key || schema.has(key)) continue;
        const type = configDef && typeof configDef === 'object'
          ? (typeof configDef.type === 'string' ? configDef.type : '')
          : '';
        const hasDefault = Boolean(configDef && typeof configDef === 'object' && Object.prototype.hasOwnProperty.call(configDef, 'default'));
        schema.set(key, {
          type,
          hasDefault,
          defaultValue: hasDefault ? cloneConfigValue(configDef.default) : undefined
        });
      }
    }
  }
  return schema;
}

function fallbackValueForConfigType(type) {
  switch (safeString(type).trim().toLowerCase()) {
    case 'string': return '';
    case 'boolean': return false;
    case 'number': return 0;
    case 'array': return [];
    case 'object': return {};
    default: return undefined;
  }
}

function makeConfigurationChangeEvent(changedKey) {
  const key = safeString(changedKey).trim();
  return {
    affectsConfiguration(candidate) {
      const target = safeString(candidate).trim();
      if (!key || !target) return false;
      return key === target || key.startsWith(`${target}.`) || target.startsWith(`${key}.`);
    }
  };
}

function ensureInside(root, target) {
  const absRoot = path.resolve(root);
  const abs = path.resolve(target);
  if (!(abs === absRoot || abs.startsWith(`${absRoot}${path.sep}`))) {
    throw new Error('Path escapes extension root');
  }
  return abs;
}

function toFileUriObject(filePath) {
  const p = path.resolve(String(filePath || ''));
  return {
    fsPath: p,
    path: p,
    scheme: 'file',
    toString() { return `file://${p.replace(/\\/g, '/')}`; },
    with(change = {}) {
      const nextScheme = String(change.scheme || 'file');
      if (nextScheme === 'file') return toFileUriObject(change.path || change.fsPath || p);
      const rawPath = String(change.path || change.fsPath || p);
      return {
        fsPath: nextScheme === 'untitled' ? '' : rawPath,
        path: rawPath,
        scheme: nextScheme,
        toString() { return `${nextScheme}:${rawPath}`; },
        with() { return this; }
      };
    }
  };
}

function disposable(fn) {
  let done = false;
  return { dispose() { if (done) return; done = true; try { fn?.(); } catch (_) {} } };
}

/**
 * PHASE 1 & 4: Strict Array Enforcement Utility
 * Ensures values are always arrays. This prevents "forEach is not a function" errors.
 * Must be used for ALL array-returning APIs.
 */
function ensureArray(value) {
  if (Array.isArray(value)) return value;
  console.warn('[EnsureArray] Non-array value received:', typeof value, value);
  return [];
}

function warnUnsupportedApi(extId, windowId, apiName) {
  const key = `${String(extId || '')}:${String(apiName || '')}`;
  if (warnedUnsupportedApis.has(key)) return;
  warnedUnsupportedApis.add(key);
  sendEvent({
    type: 'host-log',
    level: 'warn',
    extensionId: extId,
    windowId,
    message: `Partial VS Code API in Coder: ${apiName}`
  });
}

function createEventEmitterShim() {
  const listeners = new Set();
  const event = (listener, thisArgs) => {
    if (typeof listener !== 'function') return disposable();
    const wrapped = thisArgs ? listener.bind(thisArgs) : listener;
    listeners.add(wrapped);
    return disposable(() => listeners.delete(wrapped));
  };
  return {
    event,
    fire(value) {
      for (const fn of [...listeners]) {
        try { fn(value); } catch (_) {}
      }
    },
    dispose() { listeners.clear(); }
  };
}

function getWindowEventBus(windowId) {
  const key = Number(windowId) || 0;
  if (!state.windowEventsByWindow.has(key)) {
    state.windowEventsByWindow.set(key, {
      onDidChangeActiveTextEditor: createEventEmitterShim(),
      onDidOpenTextDocument: createEventEmitterShim(),
      onDidSaveTextDocument: createEventEmitterShim(),
      onDidChangeTextDocument: createEventEmitterShim(),
      onDidChangeConfiguration: createEventEmitterShim(),
      onDidChangeVisibleTextEditors: createEventEmitterShim(),
      onDidChangeWindowState: createEventEmitterShim()
    });
  }
  return state.windowEventsByWindow.get(key);
}

function getProtocolEventBus(windowId) {
  const key = Number(windowId) || 0;
  if (!state.protocolEventsByWindow.has(key)) {
    state.protocolEventsByWindow.set(key, {
      lspMessage: createEventEmitterShim(),
      lspExit: createEventEmitterShim(),
      lspError: createEventEmitterShim(),
      lspStderr: createEventEmitterShim(),
      dapMessage: createEventEmitterShim(),
      dapExit: createEventEmitterShim(),
      dapError: createEventEmitterShim(),
      dapStderr: createEventEmitterShim()
    });
  }
  return state.protocolEventsByWindow.get(key);
}

function getFileWatchers(windowId) {
  const key = Number(windowId) || 0;
  if (!state.fileWatchersByWindow.has(key)) state.fileWatchersByWindow.set(key, new Map());
  return state.fileWatchersByWindow.get(key);
}

function clearWindowRuntime(windowId) {
  const key = Number(windowId) || 0;
  state.workspaceRootsByWindow.delete(key);
  state.activeEditorByWindow.delete(key);
  state.configurationOverridesByWindow.delete(key);
  state.windowEventsByWindow.delete(key);
  state.fileWatchersByWindow.delete(key);
  state.protocolEventsByWindow.delete(key);
  for (const [cmdId, meta] of [...state.commands.entries()]) {
    if (Number(meta?.windowId) === key) state.commands.delete(cmdId);
  }
  for (const token of [...state.workspaceContainsSatisfied]) {
    if (String(token).startsWith(`${key}:`)) state.workspaceContainsSatisfied.delete(token);
  }
  for (const [id, session] of [...state.lspSessions.entries()]) {
    if (Number(session?.windowId) === key) state.lspSessions.delete(id);
  }
  for (const [id, session] of [...state.dapSessions.entries()]) {
    if (Number(session?.windowId) === key) state.dapSessions.delete(id);
  }
  for (const [factoryKey, factoryMeta] of [...state.debugAdapterFactories.entries()]) {
    if (Number(factoryMeta?.windowId) === key) state.debugAdapterFactories.delete(factoryKey);
  }
  for (const [panelId, runtime] of [...state.webviewPanels.entries()]) {
    if (Number(runtime?.windowId) !== key) continue;
    try { runtime.disposeFromRenderer?.(); } catch (_) {}
    state.webviewPanels.delete(panelId);
  }
}

function unregisterCommandsForExtension(extensionId) {
  const target = String(extensionId || '').trim();
  if (!target) return;
  for (const [cmdId, meta] of [...state.commands.entries()]) {
    if (String(meta?.extensionId || '') === target) state.commands.delete(cmdId);
  }
}

function normalizeFsWatcherPattern(globPattern) {
  if (globPattern == null) return '';
  if (typeof globPattern === 'string') return globPattern;
  if (typeof globPattern === 'object') {
    if (typeof globPattern.pattern === 'string') return globPattern.pattern;
    if (typeof globPattern.fsPath === 'string') return globPattern.fsPath;
  }
  return String(globPattern || '');
}

function matchesFsWatcherPattern(pattern, filePath) {
  const normalizedPath = String(filePath || '').replace(/\\/g, '/').toLowerCase();
  const normalizedPattern = String(pattern || '').replace(/\\/g, '/').toLowerCase().trim();
  if (!normalizedPattern || normalizedPattern === '**/*' || normalizedPattern === '*') return true;
  const compact = normalizedPattern.replace(/\*\*/g, '').replace(/\*/g, '');
  if (!compact) return true;
  return normalizedPath.includes(compact);
}

function emitFileWatcherEvent(windowId, changeType, filePath) {
  const watchers = getFileWatchers(windowId);
  if (!watchers.size || !filePath) return;
  const uri = { fsPath: String(filePath), path: String(filePath), scheme: 'file', toString() { return `file://${String(filePath).replace(/\\/g, '/')}`; } };
  for (const watcher of watchers.values()) {
    if (!watcher || !matchesFsWatcherPattern(watcher.pattern, filePath)) continue;
    if (changeType === 'create' && !watcher.ignoreCreateEvents) watcher.onDidCreate.fire(uri);
    if (changeType === 'change' && !watcher.ignoreChangeEvents) watcher.onDidChange.fire(uri);
    if (changeType === 'delete' && !watcher.ignoreDeleteEvents) watcher.onDidDelete.fire(uri);
  }
}

function getProtocolSessionMap(protocol) {
  const key = String(protocol || '').toLowerCase();
  if (key === 'lsp') return state.lspSessions;
  if (key === 'dap') return state.dapSessions;
  throw new Error(`Unsupported protocol: ${protocol}`);
}

function getProtocolSession(protocol, sessionId, { extensionId = '', windowId = 0 } = {}) {
  const map = getProtocolSessionMap(protocol);
  const key = String(sessionId || '').trim();
  if (!key) throw new Error('sessionId is required');
  const session = map.get(key);
  if (!session) throw new Error(`${String(protocol || '').toUpperCase()} session not found`);
  if (windowId && Number(session.windowId) !== Number(windowId)) throw new Error('Protocol session is not in this Coder window');
  if (extensionId && String(session.extensionId) !== String(extensionId)) throw new Error('Protocol session is not owned by this extension');
  return session;
}

function setProtocolSession(protocol, session) {
  const map = getProtocolSessionMap(protocol);
  map.set(String(session.sessionId), session);
}

function deleteProtocolSession(protocol, sessionId) {
  const map = getProtocolSessionMap(protocol);
  map.delete(String(sessionId || ''));
}

function getWebviewPanelState(panelId) {
  return state.webviewPanels.get(String(panelId || '').trim()) || null;
}

function createWebviewPanelRuntime({ extId, windowId, viewType, title, showOptions, options = {} }) {
  const panelId = `wv_${Date.now()}_${state.nextWebviewPanelId++}`;
  const disposeEmitter = createEventEmitterShim();
  const viewStateEmitter = createEventEmitterShim();
  const msgEmitter = createEventEmitterShim();
  let disposed = false;
  let panelTitle = String(title || '');
  let panelOptions = options && typeof options === 'object' ? { ...options } : {};
  let panelHtml = '';

  const webview = {};
  Object.defineProperty(webview, 'html', {
    get() { return panelHtml; },
    set(value) {
      panelHtml = String(value ?? '');
      if (disposed) return;
      void brokerRequest('webview.updatePanel', {
        panelId,
        html: panelHtml
      }, { extensionId: extId, windowId }).catch((error) => {
        sendEvent({ type: 'extension-error', extensionId: extId, windowId, message: error?.message || String(error) });
      });
    }
  });
  Object.defineProperty(webview, 'options', {
    get() { return panelOptions; },
    set(value) {
      panelOptions = value && typeof value === 'object' ? { ...value } : {};
      if (disposed) return;
      void brokerRequest('webview.updatePanel', {
        panelId,
        options: panelOptions
      }, { extensionId: extId, windowId }).catch(() => {});
    }
  });
  webview.cspSource = `omx-coder-webview-${panelId}`;
  webview.asWebviewUri = (uri) => uri;
  webview.postMessage = async (message) => {
    if (disposed) return false;
    await brokerRequest('webview.postMessage', { panelId, message }, { extensionId: extId, windowId });
    return true;
  };
  webview.onDidReceiveMessage = msgEmitter.event;

  const panel = {
    get viewType() { return String(viewType || ''); },
    get title() { return panelTitle; },
    set title(value) {
      panelTitle = String(value ?? '');
      if (disposed) return;
      void brokerRequest('webview.updatePanel', { panelId, title: panelTitle }, { extensionId: extId, windowId }).catch(() => {});
    },
    options: panelOptions,
    viewColumn: showOptions || null,
    visible: true,
    active: true,
    webview,
    reveal() {
      if (disposed) return;
      panel.visible = true;
      panel.active = true;
      void brokerRequest('webview.updatePanel', { panelId, visible: true, active: true }, { extensionId: extId, windowId }).catch(() => {});
      viewStateEmitter.fire({ webviewPanel: panel });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      state.webviewPanels.delete(panelId);
      void brokerRequest('webview.disposePanel', { panelId }, { extensionId: extId, windowId }).catch(() => {});
      disposeEmitter.fire(undefined);
      disposeEmitter.dispose();
      viewStateEmitter.dispose();
      msgEmitter.dispose();
    },
    onDidDispose: disposeEmitter.event,
    onDidChangeViewState: viewStateEmitter.event
  };

  state.webviewPanels.set(panelId, {
    panelId,
    extensionId: extId,
    windowId,
    panel,
    emitters: { disposeEmitter, viewStateEmitter, msgEmitter },
    setVisibility(visible, active) {
      panel.visible = visible !== false;
      panel.active = active !== false;
      viewStateEmitter.fire({ webviewPanel: panel });
    },
    disposeFromRenderer() {
      if (disposed) return;
      disposed = true;
      state.webviewPanels.delete(panelId);
      disposeEmitter.fire(undefined);
      disposeEmitter.dispose();
      viewStateEmitter.dispose();
      msgEmitter.dispose();
    }
  });

  void brokerRequest('webview.createPanel', {
    panelId,
    extensionId: extId,
    viewType,
    title: panelTitle || String(viewType || 'Webview'),
    options: panelOptions,
    html: panelHtml,
    visible: true,
    active: true
  }, { extensionId: extId, windowId }).catch((error) => {
    sendEvent({ type: 'extension-error', extensionId: extId, windowId, message: error?.message || String(error) });
  });

  return panel;
}

function handleWebviewEventNotification(payload = {}) {
  const action = String(payload.action || '').trim();
  const panelId = String(payload.panelId || '').trim();
  if (!action || !panelId) return { ok: false };
  const runtime = getWebviewPanelState(panelId);
  if (!runtime) return { ok: true, handled: false };
  if (action === 'message') {
    runtime.emitters?.msgEmitter?.fire(payload.message);
    return { ok: true, handled: true };
  }
  if (action === 'dispose') {
    runtime.disposeFromRenderer?.();
    return { ok: true, handled: true };
  }
  if (action === 'viewState') {
    runtime.setVisibility(payload.visible !== false, payload.active !== false);
    return { ok: true, handled: true };
  }
  return { ok: true, handled: false };
}

async function spawnProtocolSession(protocol, params = {}, meta = {}) {
  const extId = String(meta.extensionId || params.extensionId || '').trim();
  const windowId = Number(meta.windowId || params.windowId) || 0;
  if (!extId) throw new Error('extensionId is required');
  if (!windowId) throw new Error('windowId is required');
  const options = {
    runtime: params.runtime,
    scriptPath: params.scriptPath,
    command: params.command,
    args: Array.isArray(params.args) ? params.args : [],
    cwd: params.cwd
  };
  const result = await brokerRequest(`${protocol}.spawn`, options, { extensionId: extId, windowId }, 30000);
  const sessionId = String(result?.sessionId || '').trim();
  if (!sessionId) throw new Error(`Failed to start ${protocol} session`);
  const session = {
    sessionId,
    protocol: String(protocol),
    windowId,
    extensionId: extId,
    forwardEditorEvents: params.forwardEditorEvents !== false,
    languageIds: Array.isArray(params.languageIds) ? params.languageIds.map((x) => String(x || '').toLowerCase()).filter(Boolean) : [],
    documentVersions: new Map(),
    meta: {
      runtime: params.runtime || (params.scriptPath ? 'node' : 'binary'),
      label: String(params.label || ''),
      command: String(result?.command || ''),
      pid: Number(result?.pid) || 0
    }
  };
  setProtocolSession(protocol, session);
  return { sessionId, protocol, pid: session.meta.pid, command: session.meta.command };
}

async function sendProtocolMessage(protocol, params = {}, meta = {}) {
  const extId = String(meta.extensionId || params.extensionId || '').trim();
  const windowId = Number(meta.windowId || params.windowId) || 0;
  const session = getProtocolSession(protocol, params.sessionId, { extensionId: extId, windowId });
  return brokerRequest(`${protocol}.send`, { sessionId: session.sessionId, message: params.message }, { extensionId: session.extensionId, windowId: session.windowId }, 15000);
}

async function stopProtocolSession(protocol, params = {}, meta = {}) {
  const extId = String(meta.extensionId || params.extensionId || '').trim();
  const windowId = Number(meta.windowId || params.windowId) || 0;
  const session = getProtocolSession(protocol, params.sessionId, { extensionId: extId, windowId });
  deleteProtocolSession(protocol, session.sessionId);
  return brokerRequest(`${protocol}.stop`, { sessionId: session.sessionId }, { extensionId: session.extensionId, windowId: session.windowId }, 10000);
}

async function stopProtocolSessionsForExtension(extensionId) {
  const extId = String(extensionId || '').trim();
  if (!extId) return;
  const stops = [];
  for (const [sessionId, session] of [...state.lspSessions.entries()]) {
    if (String(session?.extensionId) !== extId) continue;
    state.lspSessions.delete(sessionId);
    stops.push(brokerRequest('lsp.stop', { sessionId }, { extensionId: extId, windowId: Number(session.windowId) || 0 }, 5000).catch(() => null));
  }
  for (const [sessionId, session] of [...state.dapSessions.entries()]) {
    if (String(session?.extensionId) !== extId) continue;
    state.dapSessions.delete(sessionId);
    stops.push(brokerRequest('dap.stop', { sessionId }, { extensionId: extId, windowId: Number(session.windowId) || 0 }, 5000).catch(() => null));
  }
  await Promise.allSettled(stops);
}

function protocolBusEventName(protocol, payloadType) {
  const p = String(protocol || '').toLowerCase();
  if (payloadType === 'protocol-message') return `${p}Message`;
  if (payloadType === 'protocol-exit') return `${p}Exit`;
  if (payloadType === 'protocol-error') return `${p}Error`;
  if (payloadType === 'protocol-stderr') return `${p}Stderr`;
  return '';
}

function handleProtocolEventNotification(payload = {}) {
  const protocol = String(payload.protocol || '').toLowerCase();
  const sessionId = String(payload.sessionId || '').trim();
  const windowId = Number(payload.windowId) || 0;
  if (!protocol || !windowId) return { ok: false };
  const bus = getProtocolEventBus(windowId);
  const eventName = protocolBusEventName(protocol, payload.type);
  if (eventName && bus[eventName]?.fire) bus[eventName].fire(payload);
  if (sessionId && (payload.type === 'protocol-exit' || payload.type === 'protocol-error')) {
    deleteProtocolSession(protocol, sessionId);
  }
  return { ok: true };
}

function buildDidOpenMessage(filePath, languageId, text, version) {
  return {
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri: toFileUriObject(filePath).toString(),
        languageId: String(languageId || 'plaintext'),
        version: Number(version) || 1,
        text: String(text ?? '')
      }
    }
  };
}

function buildDidChangeMessage(filePath, text, version) {
  return {
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: {
        uri: toFileUriObject(filePath).toString(),
        version: Number(version) || 1
      },
      contentChanges: [{ text: String(text ?? '') }]
    }
  };
}

function buildDidSaveMessage(filePath, text) {
  return {
    jsonrpc: '2.0',
    method: 'textDocument/didSave',
    params: {
      textDocument: { uri: toFileUriObject(filePath).toString() },
      text: typeof text === 'string' ? text : ''
    }
  };
}

async function forwardEditorEventToLspSessions(windowId, ev, payload = {}) {
  const wid = Number(windowId) || 0;
  if (!wid) return;
  const sessions = [...state.lspSessions.values()].filter((s) => Number(s.windowId) === wid && s.forwardEditorEvents !== false);
  if (!sessions.length) return;

  const filePath = String(payload.path || '').trim();
  const language = String(payload.language || 'plaintext').toLowerCase();
  const shouldRouteToSession = (session) => !session.languageIds?.length || session.languageIds.includes(language);

  for (const session of sessions) {
    if (!shouldRouteToSession(session)) continue;
    if (!filePath) continue;
    try {
      if (ev === 'fileOpened') {
        let text = typeof payload.content === 'string' ? payload.content : null;
        if (text == null) {
          const read = await brokerRequest('workspace.readFile', { path: filePath, encoding: 'utf8' }, { extensionId: session.extensionId, windowId: wid }).catch(() => null);
          text = typeof read?.content === 'string' ? read.content : '';
        }
        const version = 1;
        session.documentVersions.set(filePath, version);
        await brokerRequest('lsp.send', { sessionId: session.sessionId, message: buildDidOpenMessage(filePath, language, text, version) }, { extensionId: session.extensionId, windowId: wid });
      } else if (ev === 'fileChanged') {
        if (typeof payload.content !== 'string') continue;
        const nextVersion = (Number(session.documentVersions.get(filePath)) || 1) + 1;
        session.documentVersions.set(filePath, nextVersion);
        await brokerRequest('lsp.send', { sessionId: session.sessionId, message: buildDidChangeMessage(filePath, payload.content, nextVersion) }, { extensionId: session.extensionId, windowId: wid });
      } else if (ev === 'fileSaved') {
        let text = typeof payload.content === 'string' ? payload.content : '';
        if (!text) {
          const read = await brokerRequest('workspace.readFile', { path: filePath, encoding: 'utf8' }, { extensionId: session.extensionId, windowId: wid }).catch(() => null);
          if (typeof read?.content === 'string') text = read.content;
        }
        await brokerRequest('lsp.send', { sessionId: session.sessionId, message: buildDidSaveMessage(filePath, text) }, { extensionId: session.extensionId, windowId: wid });
      }
    } catch (error) {
      sendEvent({
        type: 'host-log',
        level: 'warn',
        windowId: wid,
        extensionId: session.extensionId,
        message: `LSP forward ${ev} failed (${session.sessionId}): ${error?.message || error}`
      });
    }
  }
}

function createMemento(extensionId, scope) {
  return {
    async get(_key, defaultValue = undefined) {
      const result = await brokerRequest('storage.get', { extensionId, scope }, { extensionId });
      return result?.value == null ? defaultValue : result.value;
    },
    async update(key, value) {
      const current = await this.get(null, {});
      const next = (current && typeof current === 'object') ? { ...current } : {};
      if (key == null) {
        await brokerRequest('storage.set', { extensionId, scope, value }, { extensionId });
        return;
      }
      next[String(key)] = value;
      await brokerRequest('storage.set', { extensionId, scope, value: next }, { extensionId });
    }
  };
}

function createSecretStorage(extensionId) {
  const prefix = '__secret__:';
  const onDidChangeEmitter = createEventEmitterShim();
  return {
    onDidChange: onDidChangeEmitter.event,
    async get(key) {
      const bag = await brokerRequest('storage.get', { extensionId, scope: 'global' }, { extensionId });
      const value = bag?.value && typeof bag.value === 'object' ? bag.value[`${prefix}${String(key || '')}`] : undefined;
      return value == null ? undefined : String(value);
    },
    async store(key, value) {
      const bag = await brokerRequest('storage.get', { extensionId, scope: 'global' }, { extensionId });
      const next = (bag?.value && typeof bag.value === 'object') ? { ...bag.value } : {};
      next[`${prefix}${String(key || '')}`] = String(value ?? '');
      await brokerRequest('storage.set', { extensionId, scope: 'global', value: next }, { extensionId });
      onDidChangeEmitter.fire({ key: String(key || '') });
    },
    async delete(key) {
      const bag = await brokerRequest('storage.get', { extensionId, scope: 'global' }, { extensionId });
      const next = (bag?.value && typeof bag.value === 'object') ? { ...bag.value } : {};
      delete next[`${prefix}${String(key || '')}`];
      await brokerRequest('storage.set', { extensionId, scope: 'global', value: next }, { extensionId });
      onDidChangeEmitter.fire({ key: String(key || '') });
    }
  };
}

function createVscodeShim(ext, windowId) {
  const extId = (ext && typeof ext === 'object' ? ext.id : '') || '';
  let providerSeq = 0;
  const shim = {};
  const eventBus = getWindowEventBus(windowId);
  const protocolBus = getProtocolEventBus(windowId);
  const makeFileUri = (filePath) => {
    const p = path.resolve(String(filePath || ''));
    return {
      fsPath: p,
      path: p,
      scheme: 'file',
      toString() { return `file://${p.replace(/\\/g, '/')}`; },
      with(change = {}) {
        const nextScheme = String(change.scheme || 'file');
        if (nextScheme === 'file') return makeFileUri(change.path || change.fsPath || p);
        const rawPath = String(change.path || change.fsPath || p);
        return {
          fsPath: nextScheme === 'untitled' ? '' : rawPath,
          path: rawPath,
          scheme: nextScheme,
          toString() { return `${nextScheme}:${rawPath}`; },
          with(nextChange = {}) { return this; }
        };
      }
    };
  };
  const uriFromValue = (uriOrPath) => {
    if (typeof uriOrPath === 'string') return makeFileUri(uriOrPath);
    if (uriOrPath && typeof uriOrPath === 'object' && uriOrPath.scheme && typeof uriOrPath.path === 'string') return uriOrPath;
    return makeFileUri(uriOrPath?.fsPath || '');
  };
  const makeTextDocument = (uriOrPath, content = '', languageId = 'plaintext') => {
    const uri = uriFromValue(uriOrPath);
    const text = String(content ?? '');
    return {
      uri,
      fileName: uri.fsPath,
      languageId: String(languageId || 'plaintext'),
      version: 1,
      isDirty: false,
      getText() { return text; }
    };
  };

  shim.commands = {
    registerCommand(id, handler) {
      const commandId = String(id || '').trim();
      if (!commandId || typeof handler !== 'function') throw new Error('registerCommand(id, handler) is required');
      state.commands.set(commandId, { extensionId: extId, handler, windowId });
      void brokerRequest('commands.register', { id: commandId, title: commandId, extensionId: extId }, { extensionId: extId, windowId }).catch((error) => {
        sendEvent({ type: 'extension-error', extensionId: extId, windowId, message: error?.message || String(error) });
      });
      return disposable(() => {
        state.commands.delete(commandId);
        void brokerRequest('commands.unregister', { id: commandId, extensionId: extId }, { extensionId: extId, windowId }).catch(() => {});
      });
    },
    async executeCommand(commandId, ...args) {
      if (state.commands.has(commandId)) return state.commands.get(commandId).handler(...args);
      return brokerRequest('commands.execute', { commandId, args }, { extensionId: extId, windowId });
    },
    registerTextEditorCommand(id, handler) {
      return this.registerCommand(id, async (...args) => {
        const editor = shim.window.activeTextEditor;
        return handler(editor, null, ...args);
      });
    }
  };

  shim.workspace = {
    get rootPath() {
      const roots = state.workspaceRootsByWindow.get(windowId) || [];
      return roots[0] || undefined;
    },
    get workspaceFolders() {
      const roots = state.workspaceRootsByWindow.get(windowId) || [];
      return roots.map((root) => ({ uri: { fsPath: root, path: root, scheme: 'file' }, name: path.basename(root) || root }));
    },
    fs: {
      async readFile(uriOrPath) {
        const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath;
        const result = await brokerRequest('workspace.readFile', { path: p, encoding: 'base64' }, { extensionId: extId, windowId });
        return Buffer.from(String(result?.content || ''), 'base64');
      },
      async writeFile(uriOrPath, bytes) {
        const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath;
        const b64 = Buffer.isBuffer(bytes) ? bytes.toString('base64') : Buffer.from(bytes || []).toString('base64');
        return brokerRequest('workspace.writeFile', { path: p, content: b64, encoding: 'base64' }, { extensionId: extId, windowId });
      },
      async stat(uriOrPath) {
        const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath;
        return brokerRequest('workspace.stat', { path: p }, { extensionId: extId, windowId });
      },
      async readDirectory(uriOrPath) {
        const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath;
        const out = await brokerRequest('workspace.readDirectory', { path: p }, { extensionId: extId, windowId });
        console.log('[API RETURN] workspace.readDirectory:', out, 'isArray:', Array.isArray(out));
        return ensureArray(Array.isArray(out) ? out.map((x) => [x.name, x.type]) : []);
      },
      async createDirectory(uriOrPath) {
        const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath;
        return brokerRequest('workspace.createDirectory', { path: p }, { extensionId: extId, windowId });
      },
      async delete(uriOrPath) {
        const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath;
        return brokerRequest('workspace.deletePath', { path: p }, { extensionId: extId, windowId });
      },
      async rename(oldUriOrPath, newUriOrPath) {
        const oldPath = typeof oldUriOrPath === 'string' ? oldUriOrPath : oldUriOrPath?.fsPath;
        const newPath = typeof newUriOrPath === 'string' ? newUriOrPath : newUriOrPath?.fsPath;
        return brokerRequest('workspace.renamePath', { oldPath, newPath }, { extensionId: extId, windowId });
      }
    },
    async findFiles(include) {
      const files = await brokerRequest('workspace.findFiles', { include: String(include || '') }, { extensionId: extId, windowId });
      console.log('[API RETURN] workspace.findFiles:', files, 'isArray:', Array.isArray(files));
      return ensureArray(Array.isArray(files) ? files.map((p) => makeFileUri(p)) : []);
    },
    async openTextDocument(uriOrPath) {
      const uri = uriFromValue(uriOrPath);
      if (!uri?.fsPath) return makeTextDocument(uri, '', 'plaintext');
      try {
        const result = await brokerRequest('workspace.readFile', { path: uri.fsPath, encoding: 'utf8' }, { extensionId: extId, windowId });
        const doc = makeTextDocument(uri, result?.content || '', 'plaintext');
        eventBus.onDidOpenTextDocument.fire(doc);
        return doc;
      } catch (_) {
        return makeTextDocument(uri, '', 'plaintext');
      }
    },
    getWorkspaceFolder(uriOrPath) {
      const uri = uriFromValue(uriOrPath);
      const roots = state.workspaceRootsByWindow.get(windowId) || [];
      const hit = roots.find((root) => uri.fsPath === root || uri.fsPath.startsWith(`${root}${path.sep}`));
      return hit ? { uri: makeFileUri(hit), name: path.basename(hit) || hit } : undefined;
    },
    asRelativePath(uriOrPath) {
      const uri = uriFromValue(uriOrPath);
      const roots = state.workspaceRootsByWindow.get(windowId) || [];
      const hit = roots.find((root) => uri.fsPath === root || uri.fsPath.startsWith(`${root}${path.sep}`));
      if (!hit) return uri.fsPath;
      return path.relative(hit, uri.fsPath) || '.';
    },
    getConfiguration(section) {
      const sectionText = safeString(section).trim();
      return {
        get(key, def) {
          const fullKey = normalizeConfigLookupKey(sectionText, key);
          const overrides = getWindowConfigurationOverrides(windowId);
          if (fullKey && Object.prototype.hasOwnProperty.call(overrides, fullKey)) {
            return cloneConfigValue(overrides[fullKey]);
          }
          const schema = collectConfigurationSchema();
          const hit = fullKey ? schema.get(fullKey) : undefined;
          if (hit?.hasDefault) return cloneConfigValue(hit.defaultValue);
          if (def !== undefined) return def;
          if (hit?.type) {
            warnMalformedValue(
              `config-default-missing:${fullKey}`,
              undefined,
              `[Coder][Extensions] Configuration key has no default, using safe fallback: ${fullKey}`,
              extId,
              windowId
            );
            return cloneConfigValue(fallbackValueForConfigType(hit.type));
          }
          return undefined;
        },
        has(key) {
          const fullKey = normalizeConfigLookupKey(sectionText, key);
          const overrides = getWindowConfigurationOverrides(windowId);
          if (fullKey && Object.prototype.hasOwnProperty.call(overrides, fullKey)) return true;
          const schema = collectConfigurationSchema();
          return Boolean(fullKey && schema.has(fullKey));
        },
        inspect(key) {
          const fullKey = normalizeConfigLookupKey(sectionText, key);
          if (!fullKey) return undefined;
          const overrides = getWindowConfigurationOverrides(windowId);
          const schema = collectConfigurationSchema();
          const schemaHit = schema.get(fullKey);
          return {
            key: fullKey,
            defaultValue: schemaHit?.hasDefault ? cloneConfigValue(schemaHit.defaultValue) : undefined,
            globalValue: Object.prototype.hasOwnProperty.call(overrides, fullKey) ? cloneConfigValue(overrides[fullKey]) : undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined
          };
        },
        async update(key, value) {
          const fullKey = normalizeConfigLookupKey(sectionText, key);
          if (!fullKey) return;
          const overrides = getWindowConfigurationOverrides(windowId);
          overrides[fullKey] = cloneConfigValue(value);
          eventBus.onDidChangeConfiguration.fire(makeConfigurationChangeEvent(fullKey));
        }
      };
    },
    createFileSystemWatcher(globPattern, ignoreCreateEvents = false, ignoreChangeEvents = false, ignoreDeleteEvents = false) {
      const watcherId = `${extId}:watcher:${windowId}:${state.nextWatcherId++}`;
      const watcher = {
        id: watcherId,
        extensionId: extId,
        pattern: normalizeFsWatcherPattern(globPattern),
        ignoreCreateEvents: ignoreCreateEvents === true,
        ignoreChangeEvents: ignoreChangeEvents === true,
        ignoreDeleteEvents: ignoreDeleteEvents === true,
        onDidCreate: createEventEmitterShim(),
        onDidChange: createEventEmitterShim(),
        onDidDelete: createEventEmitterShim()
      };
      getFileWatchers(windowId).set(watcherId, watcher);
      return {
        onDidCreate: watcher.onDidCreate.event,
        onDidChange: watcher.onDidChange.event,
        onDidDelete: watcher.onDidDelete.event,
        dispose() {
          watcher.onDidCreate.dispose();
          watcher.onDidChange.dispose();
          watcher.onDidDelete.dispose();
          getFileWatchers(windowId).delete(watcherId);
        }
      };
    },
    isTrusted: true,
    onDidSaveTextDocument: eventBus.onDidSaveTextDocument.event,
    onDidOpenTextDocument: eventBus.onDidOpenTextDocument.event,
    onDidChangeTextDocument: eventBus.onDidChangeTextDocument.event,
    onDidChangeConfiguration: eventBus.onDidChangeConfiguration.event
  };

  shim.window = {
    async showInformationMessage(message) { return brokerRequest('window.showMessage', { severity: 'info', message: String(message || '') }, { extensionId: extId, windowId }); },
    async showWarningMessage(message) { return brokerRequest('window.showMessage', { severity: 'warn', message: String(message || '') }, { extensionId: extId, windowId }); },
    async showErrorMessage(message) { return brokerRequest('window.showMessage', { severity: 'error', message: String(message || '') }, { extensionId: extId, windowId }); },
    async showTextDocument(uriOrPath) {
      const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath;
      return brokerRequest('window.showTextDocument', { path: p }, { extensionId: extId, windowId });
    },
    createOutputChannel(name) {
      const prefix = `[${String(name || extId)}]`;
      return {
        appendLine(line) { void brokerRequest('window.showMessage', { severity: 'info', message: `${prefix} ${String(line || '')}` }, { extensionId: extId, windowId }).catch(() => {}); },
        append() {},
        clear() {},
        show() {},
        hide() {},
        dispose() {}
      };
    },
    createStatusBarItem() {
      return {
        text: '',
        tooltip: '',
        command: undefined,
        name: '',
        show() {},
        hide() {},
        dispose() {}
      };
    },
    createTextEditorDecorationType(options = {}) {
      return {
        key: `decor-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        options,
        dispose() {}
      };
    },
    registerTreeDataProvider() {
      warnUnsupportedApi(extId, windowId, 'window.registerTreeDataProvider');
      return disposable();
    },
    createTreeView(viewId) {
      warnUnsupportedApi(extId, windowId, `window.createTreeView(${String(viewId || '')})`);
      return {
        title: '',
        description: '',
        message: '',
        reveal() { return Promise.resolve(); },
        onDidChangeSelection() { return disposable(); },
        onDidChangeVisibility() { return disposable(); },
        dispose() {}
      };
    },
    registerWebviewViewProvider(viewId) {
      warnUnsupportedApi(extId, windowId, `window.registerWebviewViewProvider(${String(viewId || '')})`);
      return disposable();
    },
    createWebviewPanel(viewType, title, showOptions, options = {}) {
      return createWebviewPanelRuntime({ extId, windowId, viewType, title, showOptions, options });
    },
    async showQuickPick(items, options = {}) {
      const list = Array.isArray(items) ? items : [];
      const pick = list[0];
      if (pick == null) return undefined;
      if (options && options.canPickMany) return [pick];
      return pick;
    },
    async showInputBox(options = {}) {
      const value = typeof options.value === 'string' ? options.value : '';
      return value || undefined;
    },
    async withProgress(_options, task) {
      const progress = { report() {} };
      const token = { isCancellationRequested: false, onCancellationRequested() { return disposable(); } };
      return task(progress, token);
    },
    get activeTextEditor() {
      const active = state.activeEditorByWindow.get(windowId);
      if (!active?.path) return null;
      return {
        document: { uri: makeFileUri(active.path), languageId: active.language || 'plaintext', fileName: active.path },
        selection: null,
        selections: [],
        edit: async () => false,
        revealRange() {}
      };
    },
    get visibleTextEditors() {
      const active = this.activeTextEditor;
      const result = active ? [active] : [];
      console.log('[API RETURN] window.visibleTextEditors:', result, 'isArray:', Array.isArray(result));
      return ensureArray(result);
    },
    onDidChangeActiveTextEditor: eventBus.onDidChangeActiveTextEditor.event,
    onDidChangeVisibleTextEditors: eventBus.onDidChangeVisibleTextEditors.event,
    onDidChangeWindowState: eventBus.onDidChangeWindowState.event
  };

  shim.languages = {
    registerCompletionItemProvider(language) {
      const providerId = `${extId}:completion:${++providerSeq}`;
      void brokerRequest('languages.registerProvider', { provider: 'completion', language, providerId }, { extensionId: extId, windowId }).catch(() => {});
      return disposable(() => { void brokerRequest('languages.unregisterProvider', { providerId }, { extensionId: extId, windowId }).catch(() => {}); });
    },
    registerHoverProvider(language) {
      const providerId = `${extId}:hover:${++providerSeq}`;
      void brokerRequest('languages.registerProvider', { provider: 'hover', language, providerId }, { extensionId: extId, windowId }).catch(() => {});
      return disposable(() => { void brokerRequest('languages.unregisterProvider', { providerId }, { extensionId: extId, windowId }).catch(() => {}); });
    },
    registerDefinitionProvider(language) {
      const providerId = `${extId}:definition:${++providerSeq}`;
      void brokerRequest('languages.registerProvider', { provider: 'definition', language, providerId }, { extensionId: extId, windowId }).catch(() => {});
      return disposable(() => { void brokerRequest('languages.unregisterProvider', { providerId }, { extensionId: extId, windowId }).catch(() => {}); });
    },
    registerCodeActionsProvider(language) {
      const providerId = `${extId}:codeActions:${++providerSeq}`;
      void brokerRequest('languages.registerProvider', { provider: 'codeActions', language, providerId }, { extensionId: extId, windowId }).catch(() => {});
      return disposable(() => { void brokerRequest('languages.unregisterProvider', { providerId }, { extensionId: extId, windowId }).catch(() => {}); });
    },
    setTextDocumentLanguage(document, languageId) {
      const doc = document && typeof document === 'object' ? { ...document } : makeTextDocument('', '', String(languageId || 'plaintext'));
      doc.languageId = String(languageId || doc.languageId || 'plaintext');
      return Promise.resolve(doc);
    },
    match(selector, document) {
      const selectors = Array.isArray(selector) ? selector : [selector];
      const doc = document && typeof document === 'object' ? document : {};
      const uriScheme = String(doc?.uri?.scheme || 'file');
      const languageId = String(doc?.languageId || '');
      for (const sel of selectors) {
        if (!sel) continue;
        if (typeof sel === 'string') {
          if (sel === '*' || sel === languageId) return 10;
          continue;
        }
        if (typeof sel !== 'object') continue;
        const schemeOk = !sel.scheme || String(sel.scheme) === uriScheme;
        const langOk = !sel.language || String(sel.language) === languageId;
        if (schemeOk && langOk) return 10;
      }
      return 0;
    },
    createDiagnosticCollection(name = extId) {
      const coll = String(name || extId);
      return { async set(uriOrPath, diagnostics) { const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath; await brokerRequest('languages.publishDiagnostics', { name: coll, path: p, diagnostics: Array.isArray(diagnostics) ? diagnostics : [] }, { extensionId: extId, windowId }); }, dispose() {} };
    }
  };

  shim.debug = {
    registerDebugAdapterDescriptorFactory(type, factory) {
      const debugType = String(type || '').trim();
      if (!debugType || !factory) throw new Error('registerDebugAdapterDescriptorFactory(type, factory) is required');
      const key = `${extId}:${windowId}:${debugType}`;
      state.debugAdapterFactories.set(key, { extensionId: extId, windowId, type: debugType, factory });
      void brokerRequest('audit.log', {
        action: 'debug-adapter-factory-register',
        type: debugType
      }, { extensionId: extId, windowId }).catch(() => {});
      return disposable(() => state.debugAdapterFactories.delete(key));
    },
    registerDebugConfigurationProvider(type) {
      warnUnsupportedApi(extId, windowId, `debug.registerDebugConfigurationProvider(${String(type || '')})`);
      return disposable();
    },
    async startDebugging() {
      warnUnsupportedApi(extId, windowId, 'debug.startDebugging');
      return false;
    },
    onDidStartDebugSession() { return disposable(); },
    onDidTerminateDebugSession() { return disposable(); },
    onDidReceiveDebugSessionCustomEvent() { return disposable(); }
  };

  shim.__coder = {
    protocolVersion: 1,
    lsp: {
      async spawn(config = {}) {
        return spawnProtocolSession('lsp', config, { extensionId: extId, windowId });
      },
      async send(sessionId, message) {
        return sendProtocolMessage('lsp', { sessionId, message }, { extensionId: extId, windowId });
      },
      async stop(sessionId) {
        return stopProtocolSession('lsp', { sessionId }, { extensionId: extId, windowId });
      },
      onDidReceiveMessage: protocolBus.lspMessage.event,
      onDidExit: protocolBus.lspExit.event,
      onDidError: protocolBus.lspError.event,
      onDidStderr: protocolBus.lspStderr.event
    },
    dap: {
      async spawn(config = {}) {
        return spawnProtocolSession('dap', config, { extensionId: extId, windowId });
      },
      async send(sessionId, message) {
        return sendProtocolMessage('dap', { sessionId, message }, { extensionId: extId, windowId });
      },
      async stop(sessionId) {
        return stopProtocolSession('dap', { sessionId }, { extensionId: extId, windowId });
      },
      onDidReceiveMessage: protocolBus.dapMessage.event,
      onDidExit: protocolBus.dapExit.event,
      onDidError: protocolBus.dapError.event,
      onDidStderr: protocolBus.dapStderr.event
    }
  };

  shim.authentication = {
    async getSession() {
      warnUnsupportedApi(extId, windowId, 'authentication.getSession');
      return null;
    },
    onDidChangeSessions() { return disposable(); },
    async getAccounts() { return []; }
  };
  shim.env = {
    appName: 'Coder',
    appRoot: '',
    language: 'en',
    uiKind: 1,
    machineId: `coder-${process.pid}`,
    sessionId: `coder-session-${process.pid}`,
    uriScheme: 'omx-coder',
    clipboard: {
      async readText() { return ''; },
      async writeText() {}
    },
    async openExternal() {
      warnUnsupportedApi(extId, windowId, 'env.openExternal');
      return false;
    },
    async asExternalUri(uri) { return uriFromValue(uri); }
  };
  shim.extensions = {
    get all() {
      const result = [...state.extensions.values()].map((e) => ({
        id: e.id,
        extensionPath: e.installPath,
        extensionUri: makeFileUri(e.installPath),
        packageJSON: e.manifest || {},
        isActive: state.activated.has(e.id),
        exports: state.activated.get(e.id)?.exports,
        async activate() {
          await activateExtension(e.id, windowId);
          return state.activated.get(e.id)?.exports;
        }
      }));
      console.log('[API RETURN] extensions.all:', result, 'isArray:', Array.isArray(result));
      return ensureArray(result);
    },
    getExtension(id) {
      const key = String(id || '').trim();
      const result = this.all.find((e) => e.id === key);
      console.log('[API RETURN] extensions.getExtension:', id, 'found:', !!result);
      return result;
    },
    onDidChange() { return disposable(); }
  };
  shim.Uri = {
    file(filePath) { return makeFileUri(filePath); },
    parse(value) {
      const raw = String(value || '');
      if (/^file:\/\//i.test(raw)) {
        const p = decodeURI(raw.replace(/^file:\/+/, ''));
        return makeFileUri(process.platform === 'win32' && /^[A-Za-z]:\//.test(p) ? p.replace(/\//g, '\\') : p);
      }
      return { scheme: raw.split(':')[0] || 'unknown', path: raw, fsPath: '', toString() { return raw; } };
    },
    joinPath(base, ...segments) {
      const uri = uriFromValue(base);
      return makeFileUri(path.join(uri.fsPath || '', ...segments.map((s) => String(s || ''))));
    }
  };
  shim.EventEmitter = class {
    constructor() {
      const impl = createEventEmitterShim();
      this.event = impl.event;
      this.fire = impl.fire;
      this.dispose = impl.dispose;
    }
  };
  const toPosition = (valueLine, valueChar) => {
    if (valueLine && typeof valueLine === 'object') {
      return {
        line: Math.max(0, Number(valueLine.line) || 0),
        character: Math.max(0, Number(valueLine.character) || 0)
      };
    }
    return {
      line: Math.max(0, Number(valueLine) || 0),
      character: Math.max(0, Number(valueChar) || 0)
    };
  };
  const toRange = (startLike, startCharOrEndLike, endLine, endChar) => {
    if (startLike && typeof startLike === 'object' && startLike.start && startLike.end) {
      return {
        start: toPosition(startLike.start),
        end: toPosition(startLike.end)
      };
    }
    if (startLike && typeof startLike === 'object' && startCharOrEndLike && typeof startCharOrEndLike === 'object') {
      return {
        start: toPosition(startLike),
        end: toPosition(startCharOrEndLike)
      };
    }
    return {
      start: toPosition(startLike, startCharOrEndLike),
      end: toPosition(endLine, endChar)
    };
  };
  shim.Position = class {
    constructor(line = 0, character = 0) {
      this.line = Math.max(0, Number(line) || 0);
      this.character = Math.max(0, Number(character) || 0);
    }
    isBefore(other) {
      const rhs = toPosition(other);
      return this.line < rhs.line || (this.line === rhs.line && this.character < rhs.character);
    }
  };
  shim.Range = class {
    constructor(startLineOrStart, startCharOrEnd, endLine, endChar) {
      const range = toRange(startLineOrStart, startCharOrEnd, endLine, endChar);
      this.start = new shim.Position(range.start.line, range.start.character);
      this.end = new shim.Position(range.end.line, range.end.character);
    }
    contains(position) {
      const p = toPosition(position);
      if (p.line < this.start.line || p.line > this.end.line) return false;
      if (p.line === this.start.line && p.character < this.start.character) return false;
      if (p.line === this.end.line && p.character > this.end.character) return false;
      return true;
    }
  };
  shim.Selection = class extends shim.Range {
    constructor(anchorLineOrAnchor, anchorCharOrActive, activeLine, activeChar) {
      const anchor = (anchorLineOrAnchor && typeof anchorLineOrAnchor === 'object' && anchorLineOrAnchor.line !== undefined)
        ? toPosition(anchorLineOrAnchor)
        : toPosition(anchorLineOrAnchor, anchorCharOrActive);
      const active = (anchorLineOrAnchor && typeof anchorLineOrAnchor === 'object' && anchorLineOrAnchor.line !== undefined)
        ? toPosition(anchorCharOrActive)
        : toPosition(activeLine, activeChar);
      super(anchor, active);
      this.anchor = new shim.Position(anchor.line, anchor.character);
      this.active = new shim.Position(active.line, active.character);
    }
  };
  shim.Location = class {
    constructor(uri, range) {
      this.uri = uriFromValue(uri);
      this.range = range instanceof shim.Range ? range : new shim.Range(range?.start || { line: 0, character: 0 }, range?.end || { line: 0, character: 0 });
    }
  };
  shim.TextEditorRevealType = {
    Default: 0,
    InCenter: 1,
    InCenterIfOutsideViewport: 2,
    AtTop: 3
  };
  shim.CancellationError = class extends Error {
    constructor(message = 'Canceled') {
      super(String(message || 'Canceled'));
      this.name = 'CancellationError';
    }
  };
  shim.ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
  shim.DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };
  shim.CompletionItemKind = {
    Text: 0, Method: 1, Function: 2, Constructor: 3, Field: 4, Variable: 5, Class: 6, Interface: 7, Module: 8, Property: 9,
    Unit: 10, Value: 11, Enum: 12, Keyword: 13, Snippet: 14, Color: 15, File: 16, Reference: 17, Folder: 18, EnumMember: 19,
    Constant: 20, Struct: 21, Event: 22, Operator: 23, TypeParameter: 24
  };
  shim.SymbolKind = {
    File: 0, Module: 1, Namespace: 2, Package: 3, Class: 4, Method: 5, Property: 6, Field: 7, Constructor: 8, Enum: 9,
    Interface: 10, Function: 11, Variable: 12, Constant: 13, String: 14, Number: 15, Boolean: 16, Array: 17, Object: 18,
    Key: 19, Null: 20, EnumMember: 21, Struct: 22, Event: 23, Operator: 24, TypeParameter: 25
  };
  shim.InlayHintKind = { Type: 1, Parameter: 2 };
  shim.CompletionItem = class {
    constructor(label = '', kind = shim.CompletionItemKind.Text) {
      this.label = label;
      this.kind = kind;
      this.detail = '';
      this.documentation = '';
    }
  };
  shim.CompletionList = class {
    constructor(items = [], isIncomplete = false) {
      this.items = Array.isArray(items) ? items : [];
      this.isIncomplete = isIncomplete === true;
    }
  };
  shim.SnippetString = class {
    constructor(value = '') {
      this.value = String(value || '');
    }
    appendText(text) {
      this.value += String(text || '');
      return this;
    }
  };
  shim.CodeLens = class {
    constructor(range, command) {
      this.range = range instanceof shim.Range ? range : new shim.Range(range?.start || { line: 0, character: 0 }, range?.end || { line: 0, character: 0 });
      this.command = command;
    }
  };
  shim.DocumentLink = class {
    constructor(range, target) {
      this.range = range instanceof shim.Range ? range : new shim.Range(range?.start || { line: 0, character: 0 }, range?.end || { line: 0, character: 0 });
      this.target = target;
    }
  };
  shim.CodeAction = class {
    constructor(title = '', kind = undefined) {
      this.title = String(title || '');
      this.kind = kind;
      this.diagnostics = [];
      this.edit = undefined;
      this.command = undefined;
    }
  };
  shim.CodeActionKind = {
    Empty: '',
    QuickFix: 'quickfix',
    Refactor: 'refactor',
    RefactorExtract: 'refactor.extract',
    RefactorInline: 'refactor.inline',
    RefactorRewrite: 'refactor.rewrite',
    Source: 'source',
    SourceOrganizeImports: 'source.organizeImports',
    SourceFixAll: 'source.fixAll'
  };
  shim.Diagnostic = class {
    constructor(range, message = '', severity = shim.DiagnosticSeverity.Error) {
      this.range = range instanceof shim.Range ? range : new shim.Range(range?.start || { line: 0, character: 0 }, range?.end || { line: 0, character: 0 });
      this.message = String(message || '');
      this.severity = Number.isFinite(Number(severity)) ? Number(severity) : shim.DiagnosticSeverity.Error;
      this.source = '';
      this.code = undefined;
      this.tags = undefined;
      this.relatedInformation = undefined;
    }
  };
  shim.SymbolInformation = class {
    constructor(name, kind, containerName, location) {
      this.name = String(name || '');
      this.kind = Number.isFinite(Number(kind)) ? Number(kind) : shim.SymbolKind.Null;
      this.containerName = String(containerName || '');
      this.location = location instanceof shim.Location
        ? location
        : new shim.Location(location?.uri || location?.targetUri || '', location?.range || location?.targetSelectionRange || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } });
    }
  };
  shim.CallHierarchyItem = class {
    constructor(kind, name, detail, uri, range, selectionRange) {
      this.kind = Number.isFinite(Number(kind)) ? Number(kind) : shim.SymbolKind.Null;
      this.name = String(name || '');
      this.detail = String(detail || '');
      this.uri = uriFromValue(uri);
      this.range = range instanceof shim.Range ? range : new shim.Range(range?.start || { line: 0, character: 0 }, range?.end || { line: 0, character: 0 });
      this.selectionRange = selectionRange instanceof shim.Range ? selectionRange : new shim.Range(selectionRange?.start || this.range.start, selectionRange?.end || this.range.end);
      this.tags = undefined;
    }
  };
  shim.TypeHierarchyItem = class {
    constructor(kind, name, detail, uri, range, selectionRange) {
      this.kind = Number.isFinite(Number(kind)) ? Number(kind) : shim.SymbolKind.Null;
      this.name = String(name || '');
      this.detail = String(detail || '');
      this.uri = uriFromValue(uri);
      this.range = range instanceof shim.Range ? range : new shim.Range(range?.start || { line: 0, character: 0 }, range?.end || { line: 0, character: 0 });
      this.selectionRange = selectionRange instanceof shim.Range ? selectionRange : new shim.Range(selectionRange?.start || this.range.start, selectionRange?.end || this.range.end);
      this.tags = undefined;
    }
  };
  shim.InlayHint = class {
    constructor(position, label, kind) {
      this.position = position instanceof shim.Position ? position : new shim.Position(position?.line || 0, position?.character || 0);
      this.label = label;
      this.kind = kind;
      this.paddingLeft = false;
      this.paddingRight = false;
      this.tooltip = undefined;
      this.textEdits = undefined;
    }
  };
  shim.ThemeIcon = class { constructor(id) { this.id = String(id || ''); } };
  shim.TreeItem = class { constructor(label) { this.label = label; } };
  shim.TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
  shim.StatusBarAlignment = { Left: 1, Right: 2 };
  shim.ViewColumn = { Active: -1, One: 1, Two: 2, Three: 3 };
  shim.UIKind = { Desktop: 1, Web: 2 };
  shim.ExtensionMode = { Production: 1, Development: 2, Test: 3 };
  shim.ProgressLocation = { Notification: 15, Window: 10, SourceControl: 1 };
  shim.MarkdownString = class { constructor(value = '') { this.value = String(value); } appendMarkdown(v) { this.value += String(v || ''); return this; } appendText(v) { this.value += String(v || ''); return this; } };
  shim.Disposable = class {
    constructor(callOnDispose) {
      this._callOnDispose = typeof callOnDispose === 'function' ? callOnDispose : null;
    }
    dispose() {
      try { this._callOnDispose?.(); } finally { this._callOnDispose = null; }
    }
    static from(...items) {
      const itemList = ensureArray(items);
      return new shim.Disposable(() => itemList.forEach((i) => i?.dispose?.()));
    }
  };
  return shim;
}

function createContext(ext, windowId = 0) {
  const installPath = path.resolve(String(ext?.installPath || ''));
  const extId = String(ext?.id || '').trim();
  const wid = Number(windowId) || 0;
  const safeExtId = extId.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'extension';
  const parentDir = path.dirname(installPath);
  const baseStorageDir = path.basename(parentDir).toLowerCase() === 'extensions'
    ? path.join(path.dirname(parentDir), 'extension-storage')
    : path.join(parentDir, 'extension-storage');
  const globalStoragePath = path.join(baseStorageDir, safeExtId);
  const storagePath = path.join(globalStoragePath, `workspace-${wid || 0}`);
  const logPath = path.join(globalStoragePath, 'logs');
  try { fs.mkdirSync(globalStoragePath, { recursive: true }); } catch (_) {}
  try { fs.mkdirSync(storagePath, { recursive: true }); } catch (_) {}
  try { fs.mkdirSync(logPath, { recursive: true }); } catch (_) {}

  return {
    subscriptions: [],
    extensionPath: installPath,
    extensionUri: toFileUriObject(installPath),
    extension: {
      id: extId,
      extensionPath: installPath,
      extensionUri: toFileUriObject(installPath),
      packageJSON: ext?.manifest || {},
      isActive: true
    },
    globalState: createMemento(extId, 'global'),
    workspaceState: createMemento(extId, 'workspace'),
    secrets: createSecretStorage(extId),
    globalStoragePath,
    globalStorageUri: toFileUriObject(globalStoragePath),
    storagePath,
    storageUri: toFileUriObject(storagePath),
    logPath,
    logUri: toFileUriObject(logPath),
    extensionMode: 1,
    asAbsolutePath(rel) { return ensureInside(installPath, path.join(installPath, String(rel || ''))); }
  };
}

function loadExtensionModule(ext, windowId) {
  if (!ext || typeof ext !== 'object') {
    throw new Error('Extension object is required and must be an object');
  }
  if (!ext.installPath || !ext.main) {
    throw new Error(`Extension ${ext.id || 'unknown'} is missing required properties: installPath or main`);
  }
  const cache = new Map();
  const extId = String(ext?.id || '').trim();
  const clangdCompatMode = CLANGD_EXTENSION_IDS.has(extId);
  const kiloCodeCompatMode = KILOCODE_EXTENSION_IDS.has(extId);

  function isBuiltinAllowedForThisExtension(spec, builtinSpec) {
    if (ALLOWED_BUILTINS.has(spec) || ALLOWED_BUILTINS.has(builtinSpec)) return true;
    if (clangdCompatMode && CLANGD_EXTRA_ALLOWED_BUILTINS.has(builtinSpec)) return true;
    if (kiloCodeCompatMode && KILOCODE_EXTRA_ALLOWED_BUILTINS.has(builtinSpec)) return true;
    return false;
  }

  function isBuiltinBlockedForThisExtension(spec, builtinSpec) {
    if (!(BLOCKED_BUILTINS.has(spec) || BLOCKED_BUILTINS.has(builtinSpec))) return false;
    if (clangdCompatMode && CLANGD_EXTRA_ALLOWED_BUILTINS.has(builtinSpec)) return false;
    if (kiloCodeCompatMode && KILOCODE_EXTRA_ALLOWED_BUILTINS.has(builtinSpec)) return false;
    return true;
  }

  function resolveLoadablePath(candidatePath) {
    const base = ensureInside(ext.installPath, candidatePath);
    const tryPaths = [];
    const statSafe = (p) => {
      try { return fs.statSync(p); } catch (_) { return null; }
    };

    tryPaths.push(base);
    if (!path.extname(base)) {
      tryPaths.push(`${base}.js`, `${base}.json`);
      tryPaths.push(path.join(base, 'index.js'), path.join(base, 'index.json'));
    }

    for (const p of tryPaths) {
      const st = statSafe(p);
      if (!st) continue;
      if (st.isFile()) return ensureInside(ext.installPath, p);
    }

    throw new Error(`Module file not found: ${base}`);
  }

  function localRequire(request, fromFile) {
    const spec = String(request || '').trim();
    if (!spec) throw new Error('Empty require()');
    if (spec === 'vscode') return createVscodeShim(ext, windowId);
    const builtinSpec = spec.startsWith('node:') ? spec.slice(5) : spec;
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const target = resolveLoadablePath(path.resolve(path.dirname(fromFile), spec));
      return loadFile(target);
    }
    if (isBuiltinBlockedForThisExtension(spec, builtinSpec)) throw new Error(`Blocked module: ${spec}`);
    if (isBuiltinAllowedForThisExtension(spec, builtinSpec)) return require(builtinSpec);
    throw new Error(`Module not allowed: ${spec}`);
  }

  function loadFile(filePath) {
    if (!ext || typeof ext !== 'object' || !ext.installPath) {
      throw new Error('Extension context is invalid or missing installPath');
    }
    const abs = ensureInside(ext.installPath, filePath);
    if (cache.has(abs)) return cache.get(abs).exports;
    if (abs.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
      cache.set(abs, { exports: parsed });
      return parsed;
    }
    const code = fs.readFileSync(abs, 'utf8');
    const mod = { exports: {} };
    cache.set(abs, mod);
    const sandboxProcessEnv = sanitizeExtensionHostEnv(process.env);
    const navigatorShim = {
      userAgent: `CoderExtensionHost/${String(process.versions?.node || '')}`,
      platform: String(process.platform || ''),
      language: 'en-US',
      languages: ['en-US', 'en'],
      hardwareConcurrency: Math.max(1, Number(os.cpus?.().length) || 4),
      onLine: true
    };
    const makeSandboxStream = (fd) => ({
      fd: Number(fd) || 0,
      isTTY: false,
      writable: true,
      readable: Number(fd) === 0,
      write() { return true; },
      end() {},
      on() { return this; },
      once() { return this; },
      off() { return this; },
      addListener() { return this; },
      removeListener() { return this; },
      removeAllListeners() { return this; }
    });
    const nodeVersionRaw = safeString(process.version).trim();
    const nodeEngineVersion = safeString(process.versions?.node).trim();
    const sandboxProcessVersion = nodeVersionRaw || (nodeEngineVersion ? `v${nodeEngineVersion}` : 'v0.0.0');
    if (!nodeVersionRaw && !nodeEngineVersion) {
      warnMalformedValue(
        'process.version',
        process.version,
        'Missing process.version in extension sandbox; using fallback value',
        ext.id,
        windowId
      );
    }
    const releaseNameRaw = safeString(process.release?.name).trim();
    const releaseLtsRaw = safeString(process.release?.lts).trim();
    const sandboxProcessRelease = {
      ...(process.release && typeof process.release === 'object' ? process.release : {}),
      name: releaseNameRaw || 'node'
    };
    if (releaseLtsRaw) sandboxProcessRelease.lts = releaseLtsRaw;
    const sandboxProcess = {
      platform: safeString(process.platform),
      arch: safeString(process.arch),
      version: sandboxProcessVersion,
      release: sandboxProcessRelease,
      env: { ...sandboxProcessEnv },
      versions: { ...(process.versions || {}) },
      cwd: () => process.cwd(),
      nextTick: process.nextTick.bind(process),
      pid: Number(process.pid) || 0,
      execPath: String(process.execPath || ''),
      argv0: safeString(process.argv0 || process.execPath || 'node'),
      argv: [String(process.execPath || 'node'), 'coder-extension-host'],
      title: safeString(process.title || 'node'),
      uptime: typeof process.uptime === 'function' ? process.uptime.bind(process) : (() => 0),
      hrtime: typeof process.hrtime === 'function' ? process.hrtime.bind(process) : (() => [0, 0]),
      memoryUsage: typeof process.memoryUsage === 'function' ? process.memoryUsage.bind(process) : (() => ({})),
      stdin: makeSandboxStream(0),
      stdout: makeSandboxStream(1),
      stderr: makeSandboxStream(2),
      on() { return this; },
      once() { return this; },
      off() { return this; },
      addListener() { return this; },
      removeListener() { return this; },
      removeAllListeners() { return this; },
      emitWarning() {}
    };
    const sandbox = {
      module: mod,
      exports: mod.exports,
      require: (r) => localRequire(r, abs),
      __filename: abs,
      __dirname: path.dirname(abs),
      console,
      Buffer,
      TextEncoder,
      TextDecoder,
      Blob: NativeBlob,
      File: NativeFile,
      FormData: NativeFormData,
      Headers: NativeHeaders,
      Request: NativeRequest,
      Response: NativeResponse,
      fetch: NativeFetch,
      crypto: NativeCryptoObject,
      structuredClone: NativeStructuredClone,
      atob: NativeAtob,
      btoa: NativeBtoa,
      queueMicrotask: NativeQueueMicrotask,
      MessageChannel: NativeMessageChannel,
      MessagePort: NativeMessagePort,
      BroadcastChannel: NativeBroadcastChannel,
      WebSocket: NativeWebSocket,
      EventSource: NativeEventSource,
      Worker: NativeWorker,
      performance: NativePerformance,
      PerformanceObserver: NativePerformanceObserver,
      PerformanceEntry: NativePerformanceEntry,
      PerformanceMark: NativePerformanceMark,
      PerformanceMeasure: NativePerformanceMeasure,
      URL: NativeURL,
      URLSearchParams: NativeURLSearchParams,
      ReadableStream: NativeReadableStream,
      WritableStream: NativeWritableStream,
      TransformStream: NativeTransformStream,
      ByteLengthQueuingStrategy: NativeByteLengthQueuingStrategy,
      CountQueuingStrategy: NativeCountQueuingStrategy,
      TextEncoderStream: NativeTextEncoderStream,
      TextDecoderStream: NativeTextDecoderStream,
      CompressionStream: NativeCompressionStream,
      DecompressionStream: NativeDecompressionStream,
      Event: EventCompat,
      EventTarget: EventTargetCompat,
      CustomEvent: CustomEventCompat,
      DOMException: DOMExceptionCompat,
      navigator: navigatorShim,
      AbortController: AbortControllerCompat,
      AbortSignal: AbortSignalCompat,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      process: sandboxProcess
    };
    // Compatibility: many bundled extensions assume Node's global object exists.
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    sandbox.window = sandbox;
    vm.createContext(sandbox, { name: `coder-ext:${ext.id}` });
    const wrapped = `(function(exports, require, module, __filename, __dirname){${code}\n})`;
    const fn = vm.runInContext(wrapped, sandbox, { filename: abs, timeout: 1000 });
    fn(mod.exports, sandbox.require, mod, abs, path.dirname(abs));
    return mod.exports;
  }

  const entry = resolveLoadablePath(path.join(ext.installPath, String(ext.main || '')));
  return loadFile(entry);
}

function shouldActivate(ext, eventName) {
  if (ext.enabled === false) return false;
  const events = Array.isArray(ext.activationEvents) ? ext.activationEvents : [];
  if (!events.length) return eventName === 'onStartupFinished';
  return events.includes('*') || events.includes(eventName);
}

function listWorkspaceContainsEvents(ext) {
  const events = Array.isArray(ext?.activationEvents) ? ext.activationEvents : [];
  return events
    .map((value) => String(value || '').trim())
    .filter((value) => value.startsWith('workspaceContains:') && value.length > 'workspaceContains:'.length);
}

/**
 * PHASE 2: Parse and register activity bar containers from extension manifest
 */
function resolveActivitybarContainers(ext) {
  if (!ext || typeof ext !== 'object') return [];
  
  const {id: extId, installPath, contributes} = ext;
  if (!extId || !installPath || !contributes || typeof contributes !== 'object') return [];
  
  const containers = [];
  const viewsContainers = contributes.viewsContainers;
  if (!viewsContainers || typeof viewsContainers !== 'object') return containers;
  
  const activitybar = viewsContainers.activitybar;
  if (!Array.isArray(activitybar)) return containers;
  
  for (const container of activitybar) {
    if (!container || typeof container !== 'object') continue;
    
    const containerId = safeString(container.id).trim();
    const title = safeString(container.title).trim();
    let iconPath = safeString(container.icon).trim();
    
    if (!containerId || !title) {
      console.warn(`[PHASE 2] Extension ${extId}: viewsContainer missing id or title`);
      continue;
    }
    
    // Resolve icon path relative to extension root if it's a relative path
    if (iconPath && !path.isAbsolute(iconPath)) {
      iconPath = path.join(installPath, iconPath);
    }
    
    containers.push({
      extensionId: extId,
      containerId,
      title,
      iconPath
    });
  }
  
  return containers;
}

/**
 * PHASE 2: Register extension's activity bar containers
 */
function registerActivitybarContainers(ext) {
  const containers = resolveActivitybarContainers(ext);
  
  for (const container of containers) {
    const {extensionId, containerId, title, iconPath} = container;
    
    state.activitybarContainers.set(containerId, {
      extensionId,
      containerId,
      title,
      iconPath,
      isActive: false
    });
    
    // Emit event to renderer
    sendEvent({
      type: 'extension-activity-container-registered',
      extensionId,
      containerId,
      title,
      iconPath
    });
    
    console.log(`[PHASE 2] Registered activity bar container: ${containerId} for ${extensionId}`);
  }
}

/**
 * PHASE 2: Unregister extension's activity bar containers
 */
function unregisterActivitybarContainers(extensionId) {
  const toDelete = [];
  for (const [containerId, container] of state.activitybarContainers.entries()) {
    if (container.extensionId === extensionId) {
      toDelete.push(containerId);
    }
  }
  
  for (const containerId of toDelete) {
    state.activitybarContainers.delete(containerId);
    sendEvent({
      type: 'extension-activity-container-unregistered',
      containerId,
      extensionId: extensionId
    });
    console.log(`[PHASE 2] Unregistered activity bar container: ${containerId}`);
  }
}

async function maybeActivateWorkspaceContains(windowId, reason = 'workspaceContains') {
  const wid = Number(windowId) || 0;
  if (!wid) return { checked: 0, activated: 0 };
  const roots = state.workspaceRootsByWindow.get(wid) || [];
  if (!roots.length) return { checked: 0, activated: 0 };

  let checked = 0;
  let activated = 0;
  for (const ext of state.extensions.values()) {
    if (!ext || ext.enabled === false || state.activated.has(ext.id)) continue;
    for (const activationEvent of listWorkspaceContainsEvents(ext)) {
      const pattern = activationEvent.slice('workspaceContains:'.length).trim();
      if (!pattern) continue;
      const cacheKey = `${wid}:${ext.id}:${pattern}`;
      if (state.workspaceContainsSatisfied.has(cacheKey)) continue;
      checked += 1;
      try {
        const files = await brokerRequest(
          'workspace.findFiles',
          { include: pattern, maxEntries: 1 },
          { extensionId: ext.id, windowId: wid },
          10000
        );
        if (Array.isArray(files) && files.length > 0) {
          state.workspaceContainsSatisfied.add(cacheKey);
          if (await activateExtension(ext.id, wid, activationEvent)) activated += 1;
        }
      } catch (error) {
        sendEvent({
          type: 'extension-activation',
          phase: 'workspaceContains-error',
          extensionId: ext.id,
          windowId: wid,
          event: activationEvent,
          message: error?.message || String(error),
          reason
        });
      }
    }
  }
  return { checked, activated };
}

async function activateExtension(extId, windowId, activationEvent = '') {
  const ext = state.extensions.get(extId);
  if (!ext || ext.enabled === false) return false;
  if (state.activated.has(extId)) return true;
  
  try {
    sendEvent({
      type: 'extension-activation',
      phase: 'start',
      extensionId: extId,
      windowId: Number(windowId) || 0,
      event: String(activationEvent || '')
    });
    const exportsObj = loadExtensionModule(ext, windowId);
    const context = createContext(ext, windowId);
    state.activated.set(extId, { exports: exportsObj, context, windowId });
    if (exportsObj && typeof exportsObj.activate === 'function') {
      await Promise.resolve(exportsObj.activate(context));
    }
    sendEvent({
      type: 'extension-activation',
      phase: 'activated',
      extensionId: extId,
      windowId: Number(windowId) || 0,
      event: String(activationEvent || ''),
      activated: true
    });
    sendEvent({ type: 'host-log', level: 'info', message: `Activated ${extId}` });
    
    return true;
  } catch (error) {
    const errorMsg = error?.message || String(error);
    state.activated.delete(extId);
    sendEvent({
      type: 'extension-activation',
      phase: 'error',
      extensionId: extId,
      windowId: Number(windowId) || 0,
      event: String(activationEvent || ''),
      message: `Failed to activate extension: ${errorMsg}`
    });
    sendEvent({
      type: 'extension-error',
      extensionId: extId,
      windowId: Number(windowId) || 0,
      message: `Failed to activate extension: ${errorMsg}`
    });
    throw error;
  }
}

async function deactivateExtension(extId) {
  const runtime = state.activated.get(extId);
  if (!runtime) return;
  for (const [panelId, panelRuntime] of [...state.webviewPanels.entries()]) {
    if (String(panelRuntime?.extensionId || '') !== String(extId || '')) continue;
    try { panelRuntime.panel?.dispose?.(); } catch (_) {}
    state.webviewPanels.delete(panelId);
  }
  await stopProtocolSessionsForExtension(extId).catch(() => {});
  try { if (typeof runtime.exports?.deactivate === 'function') await Promise.resolve(runtime.exports.deactivate()); } catch (_) {}
  for (const d of runtime.context?.subscriptions || []) { try { d?.dispose?.(); } catch (_) {} }
  for (const [commandId, meta] of [...state.commands.entries()]) {
    if (String(meta?.extensionId || '') !== String(extId || '')) continue;
    state.commands.delete(commandId);
    void brokerRequest(
      'commands.unregister',
      { id: commandId, extensionId: extId },
      { extensionId: extId, windowId: Number(meta?.windowId) || 0 }
    ).catch(() => {});
  }
  
  // PHASE 2: Unregister activity bar containers on deactivation
  unregisterActivitybarContainers(extId);
  
  state.activated.delete(extId);
}

async function handleReq(method, params = {}) {
  switch (method) {
    case 'host.initialize':
      state.initialized = true;
      return { ok: true };
    case 'host.ping':
      return { ok: true, ts: Date.now() };
    case 'host.webviewEvent':
      return handleWebviewEventNotification(params || {});
    case 'host.protocolEvent':
      return handleProtocolEventNotification(params || {});
    case 'host.syncExtensions': {
      const list = Array.isArray(params.extensions) ? params.extensions : [];
      const seen = new Set();
      for (const item of list) {
        const rawId = safeString(item?.id).trim();
        const rawInstallPath = safeString(item?.installPath).trim();
        if (!rawId) {
          warnMalformedValue('syncExtensions:missing-id', item?.id, '[Coder][Extensions] Ignoring extension with missing id during sync');
          continue;
        }
        if (!rawInstallPath) {
          warnMalformedValue(`syncExtensions:missing-installPath:${rawId}`, item?.installPath, `[Coder][Extensions] Ignoring extension ${rawId} with missing installPath`);
          continue;
        }
        seen.add(rawId);
        const prev = state.extensions.get(rawId);
        
        // Validate and sanitize manifest/packageJSON
        const manifest = item?.manifest && typeof item.manifest === 'object' && !Array.isArray(item.manifest) ? item.manifest : {};
        if (item?.manifest && typeof item.manifest !== 'object') {
          warnMalformedValue(`syncExtensions:manifest:${rawId}`, item.manifest, `[Coder][Extensions] Non-object manifest received for ${rawId}; using empty object`, rawId);
        }
        
        // Validate activationEvents is array
        const activationEvents = Array.isArray(item?.activationEvents) ? item.activationEvents : [];
        if (item?.activationEvents && !Array.isArray(item.activationEvents)) {
          warnMalformedValue(`syncExtensions:activationEvents:${rawId}`, item.activationEvents, `[Coder][Extensions] Non-array activationEvents received for ${rawId}; using empty array`, rawId);
        }
        
        // Validate contributes is object
        const contributes = item?.contributes && typeof item.contributes === 'object' && !Array.isArray(item.contributes) ? item.contributes : {};
        if (item?.contributes && (typeof item.contributes !== 'object' || Array.isArray(item.contributes))) {
          warnMalformedValue(`syncExtensions:contributes:${rawId}`, item.contributes, `[Coder][Extensions] Non-object contributes received for ${rawId}; using empty object`, rawId);
        }
        
        const next = {
          id: rawId,
          name: safeString(item?.name).trim() || rawId.split('.').slice(-1)[0] || 'extension',
          publisher: safeString(item?.publisher).trim() || rawId.split('.')[0] || 'unknown',
          version: safeString(item?.version).trim() || '0.0.0',
          displayName: safeString(item?.displayName).trim() || safeString(item?.name).trim() || rawId,
          description: safeString(item?.description).trim(),
          browser: safeString(item?.browser).trim(),
          installPath: path.resolve(rawInstallPath),
          enabled: item.enabled !== false,
          main: safeString(item?.main).trim() || '',
          manifest,
          activationEvents,
          contributes,
          iconUrl: safeString(item?.iconUrl).trim() || ''
        };
        if (typeof item?.displayName !== 'string') {
          warnMalformedValue(`syncExtensions:displayName:${rawId}`, item?.displayName, `[Coder][Extensions] Non-string displayName received for ${rawId}; using safe fallback`, rawId);
        }
        if (typeof item?.publisher !== 'string') {
          warnMalformedValue(`syncExtensions:publisher:${rawId}`, item?.publisher, `[Coder][Extensions] Non-string publisher received for ${rawId}; using safe fallback`, rawId);
        }
        if (typeof item?.version !== 'string') {
          warnMalformedValue(`syncExtensions:version:${rawId}`, item?.version, `[Coder][Extensions] Non-string version received for ${rawId}; using safe fallback`, rawId);
        }
        if (typeof item?.description !== 'string' && item?.description != null) {
          warnMalformedValue(`syncExtensions:description:${rawId}`, item?.description, `[Coder][Extensions] Non-string description received for ${rawId}; coercing to empty`, rawId);
        }
        state.extensions.set(rawId, next);
        
        // PHASE 2: Register activity bar containers (even if extension not activated yet)
        if (!prev || prev.enabled === false) {
          registerActivitybarContainers(next);
        }
        
        if (prev && prev.enabled !== false && next.enabled === false) {
          await deactivateExtension(rawId).catch(() => {});
          unregisterActivitybarContainers(rawId);
        }
      }
      for (const id of [...state.extensions.keys()]) {
        if (seen.has(id)) continue;
        await deactivateExtension(id).catch(() => {});
        state.extensions.delete(id);
      }
      for (const token of [...state.workspaceContainsSatisfied]) {
        const [, extId] = String(token).split(':');
        if (extId && !state.extensions.has(extId)) state.workspaceContainsSatisfied.delete(token);
      }
      return { ok: true, count: state.extensions.size };
    }
    case 'host.setWorkspaceRoots': {
      const wid = Number(params.windowId) || 0;
      for (const token of [...state.workspaceContainsSatisfied]) {
        if (String(token).startsWith(`${wid}:`)) state.workspaceContainsSatisfied.delete(token);
      }
      state.workspaceRootsByWindow.set(wid, Array.isArray(params.roots) ? params.roots.map((p) => path.resolve(String(p))) : []);
      await maybeActivateWorkspaceContains(wid, 'setWorkspaceRoots').catch(() => null);
      return { ok: true };
    }
    case 'host.detachWindow':
      clearWindowRuntime(Number(params.windowId) || 0);
      return { ok: true };
    case 'host.notifyEditorEvent': {
      const windowId = Number(params.windowId) || 0;
      const ev = String(params.event || '');
      const payload = params.payload || {};
      const eventBus = getWindowEventBus(windowId);
      if (Array.isArray(params.workspaceRoots)) state.workspaceRootsByWindow.set(windowId, params.workspaceRoots.map((p) => path.resolve(String(p))));
      if (ev === 'fileOpened' || ev === 'activeEditorChanged') {
        state.activeEditorByWindow.set(windowId, { path: payload.path || '', language: payload.language || 'plaintext' });
        const activeEditor = createVscodeShim({ id: '__event__' }, windowId).window.activeTextEditor;
        eventBus.onDidChangeActiveTextEditor.fire(activeEditor);
        eventBus.onDidChangeVisibleTextEditors.fire(activeEditor ? [activeEditor] : []);
        if (ev === 'fileOpened' && payload.path) {
          eventBus.onDidOpenTextDocument.fire({
            uri: { fsPath: payload.path, path: payload.path, scheme: 'file' },
            fileName: payload.path,
            languageId: payload.language || 'plaintext',
            version: 1,
            isDirty: false,
            getText() { return ''; }
          });
        }
        const langEvent = payload.language ? `onLanguage:${payload.language}` : '';
        if (langEvent) {
          for (const ext of state.extensions.values()) {
            if (!shouldActivate(ext, langEvent)) continue;
            try { await activateExtension(ext.id, windowId, langEvent); } catch (e) {
              sendEvent({ type: 'extension-error', extensionId: ext.id, windowId, message: e?.message || String(e) });
              sendEvent({ type: 'extension-activation', phase: 'error', extensionId: ext.id, windowId, event: langEvent, message: e?.message || String(e) });
            }
          }
        }
      }
      if (ev === 'fileSaved' && payload.path) {
        const doc = {
          uri: { fsPath: payload.path, path: payload.path, scheme: 'file' },
          fileName: payload.path,
          languageId: payload.language || 'plaintext',
          version: 1,
          isDirty: false,
          getText() { return ''; }
        };
        eventBus.onDidSaveTextDocument.fire(doc);
        eventBus.onDidChangeTextDocument.fire({ document: doc, contentChanges: [], reason: 'save' });
        emitFileWatcherEvent(windowId, 'change', payload.path);
      }
      if (ev === 'fileChanged' && payload.path) {
        const doc = {
          uri: { fsPath: payload.path, path: payload.path, scheme: 'file' },
          fileName: payload.path,
          languageId: payload.language || 'plaintext',
          version: Number(payload.version) || 1,
          isDirty: true,
          getText() { return typeof payload.content === 'string' ? payload.content : ''; }
        };
        eventBus.onDidChangeTextDocument.fire({
          document: doc,
          contentChanges: typeof payload.content === 'string' ? [{ text: payload.content }] : [],
          reason: 'edit'
        });
        emitFileWatcherEvent(windowId, 'change', payload.path);
      }
      if (ev === 'workspaceScopeChanged') {
        if (payload.oldPath) emitFileWatcherEvent(windowId, 'delete', payload.oldPath);
        if (payload.newPath) emitFileWatcherEvent(windowId, 'create', payload.newPath);
      }
      if (ev === 'fileOpened' || ev === 'fileChanged' || ev === 'fileSaved') {
        await forwardEditorEventToLspSessions(windowId, ev, payload).catch(() => null);
      }
      if (ev === 'workspaceLoaded' || ev === 'workspaceScopeChanged') {
        await maybeActivateWorkspaceContains(windowId, ev).catch(() => null);
      }
      return { ok: true };
    }
    case 'host.activateByEvent': {
      const eventName = String(params.event || '');
      const windowId = Number(params.windowId) || 0;
      let activated = 0;
      for (const ext of state.extensions.values()) {
        if (!shouldActivate(ext, eventName)) continue;
        try {
          if (await activateExtension(ext.id, windowId, eventName)) activated += 1;
        } catch (e) {
          sendEvent({ type: 'extension-error', extensionId: ext.id, windowId, message: e?.message || String(e) });
          sendEvent({ type: 'extension-activation', phase: 'error', extensionId: ext.id, windowId, event: eventName, message: e?.message || String(e) });
        }
      }
      return { ok: true, activated };
    }
    case 'host.lspSpawn':
      return spawnProtocolSession('lsp', params, params);
    case 'host.lspSend':
      return sendProtocolMessage('lsp', params, params);
    case 'host.lspStop':
      return stopProtocolSession('lsp', params, params);
    case 'host.dapSpawn':
      return spawnProtocolSession('dap', params, params);
    case 'host.dapSend':
      return sendProtocolMessage('dap', params, params);
    case 'host.dapStop':
      return stopProtocolSession('dap', params, params);
    case 'host.executeCommand': {
      const id = String(params.commandId || '').trim();
      const cmd = state.commands.get(id);
      if (!cmd) throw new Error(`Command not registered: ${id}`);
      return Promise.resolve(cmd.handler(...(Array.isArray(params.args) ? params.args : [])));
    }
    case 'host.activateActivityContainer': {
      // PHASE 2 & 3: Activate extension when activity bar container is clicked
      const containerId = safeString(params.containerId).trim();
      const windowId = Number(params.windowId) || 0;
      
      if (!containerId) return { ok: false, error: 'containerId required' };
      
      const container = state.activitybarContainers.get(containerId);
      if (!container) return { ok: false, error: 'Container not found' };
      
      const { extensionId } = container;
      const viewActivationEvent = `onView:${containerId}`;
      
      try {
        console.log(`[PHASE 3] Activating container ${containerId} for extension ${extensionId}`);
        
        // Try to activate with onView event
        const ext = state.extensions.get(extensionId);
        if (ext && shouldActivate(ext, viewActivationEvent)) {
          await activateExtension(extensionId, windowId, viewActivationEvent);
        } else if (ext) {
          // Extension doesn't require activation for this view, just mark container as active
          console.log(`[PHASE 3] Extension ${extensionId} doesn't require activation for ${viewActivationEvent}`);
        }
        
        // Emit event that container was activated
        sendEvent({
          type: 'activity-container-activated',
          containerId,
          extensionId
        });
        
        return { ok: true, activated: true };
      } catch (error) {
        console.error(`[PHASE 3] Failed to activate container ${containerId}:`, error);
        return { ok: false, error: error?.message || 'Activation failed' };
      }
    }
    case 'host.shutdown':
      for (const extId of [...state.activated.keys()]) await deactivateExtension(extId).catch(() => {});
      setTimeout(() => process.exit(0), 10).unref?.();
      return { ok: true };
    default:
      throw new Error(`Unsupported extension host method: ${method}`);
  }
}

process.on('message', (msg) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'res') { handleBrokerResponse(msg); return; }
  if (msg.t === 'notify') { void handleReq(msg.method, msg.params).catch((e) => sendEvent({ type: 'host-log', level: 'error', message: e?.message || String(e) })); return; }
  if (msg.t === 'req') {
    void handleReq(msg.method, msg.params)
      .then((result) => sendRes(msg.id, true, result))
      .catch((e) => sendRes(msg.id, false, null, { code: e?.code || 'ERR_HOST', message: e?.message || String(e) }));
  }
});

sendEvent({ type: 'host-status', status: 'booted' });
