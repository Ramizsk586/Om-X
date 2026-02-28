const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { EventEmitter } = require('events');
const ExtensionAuditLogger = require('./ExtensionAuditLogger');
const ExtensionCommandRegistry = require('./ExtensionCommandRegistry');
const ExtensionHostBridge = require('./ExtensionHostBridge');
const ExtensionWorkspaceBroker = require('./ExtensionWorkspaceBroker');
const ExtensionProcessBroker = require('./ExtensionProcessBroker');
const ConfigurationManager = require('./ConfigurationManager');
const FileSystemWatcherManager = require('./FileSystemWatcherManager');
const VsixInstaller = require('./VsixInstaller');

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

class ExtensionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = options.logger || console;
    this.coderDataDir = path.resolve(String(options.coderDataDir));
    this.indexPath = path.join(this.coderDataDir, 'extensions-index.json');
    this.storagePath = path.join(this.coderDataDir, 'extension-state.json');
    this.notifyRenderer = options.notifyRenderer || (() => {});
    this.getWorkspaceRootsForWindow = options.getWorkspaceRootsForWindow || (() => []);

    this.audit = new ExtensionAuditLogger({ rootDir: this.coderDataDir });
    this.commands = new ExtensionCommandRegistry();
    this.configuration = new ConfigurationManager({ logger: this.logger });
    this.fileSystemWatcher = new FileSystemWatcherManager({ logger: this.logger });
    this.workspaceBroker = new ExtensionWorkspaceBroker(options.workspaceBrokerOptions || {});
    this.processBroker = new ExtensionProcessBroker({
      logger: this.logger,
      getWorkspaceRootsForWindow: (wid) => this._getWorkspaceRoots(wid),
      getExtensionInstallPath: (extId) => this._getExtensionInstallPath(extId)
    });
    this.vsixInstaller = new VsixInstaller({ coderDataDir: this.coderDataDir, logger: this.logger });
    this.host = new ExtensionHostBridge({ hostScriptPath: options.hostScriptPath, logger: this.logger });
    this.host.setRequestHandler((method, params, meta) => this._handleHostRequest(method, params, meta));
    this.host.on('event', (payload) => this._handleHostEvent(payload));
    this.processBroker.on('event', (payload) => this._handleProcessBrokerEvent(payload));
    this.configuration.on('configuration-changed', (event) => this._handleConfigurationChanged(event));
    this.fileSystemWatcher.on('file-event', (event) => this._handleFileEvent(event));

    this.index = { extensions: [] };
    this.storage = { global: {}, workspace: {} };
    this.windowState = new Map();
    this.webviewPanels = new Map();
    this.warnedExtensionMetadata = new Set();
    this.started = false;
    this.startPromise = null;
  }

  async ensureStarted() {
    if (this.started) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = (async () => {
      await fs.promises.mkdir(this.coderDataDir, { recursive: true });
      this.index = await this._readJson(this.indexPath, { extensions: [] });
      if (!Array.isArray(this.index.extensions)) this.index.extensions = [];
      await this._rehydrateExtensionIndexMetadata();
      this.storage = await this._readJson(this.storagePath, { global: {}, workspace: {} });
      await this.host.start();
      await this.host.request('host.initialize', {
        protocolVersion: 1,
        compatibilityMode: 'controlled-vscode'
      });
      await this._syncHostExtensions();
      await this.host.request('host.activateByEvent', { event: 'onStartupFinished' }).catch(() => null);
      this.started = true;
    })();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async attachWindow(windowId) {
    const id = Number(windowId) || 0;
    if (!id) return;
    await this.ensureStarted();
    if (!this.windowState.has(id)) this.windowState.set(id, { editor: null });
    
    // Load workspace configuration and file watchers
    const roots = this._getWorkspaceRoots(id);
    this.configuration.setWorkspaceRoots(id, roots);
    this.fileSystemWatcher.setWorkspaceRoots(id, roots);
    
    await this._syncWindowWorkspace(id);
    this._emit(id, 'host-status', { status: 'ready' });
  }

  async detachWindow(windowId) {
    const id = Number(windowId) || 0;
    if (!id) return;
    
    // Cleanup configuration and file watchers
    this.configuration.detachWindow(id);
    this.fileSystemWatcher.detachWindow(id);
    
    for (const [panelId, panel] of [...this.webviewPanels.entries()]) {
      if (Number(panel?.windowId) !== id) continue;
      this.webviewPanels.delete(panelId);
      this._emit(id, 'extension-webview', { action: 'dispose', panelId });
    }
    await this.processBroker.stopForWindow(id).catch(() => {});
    this.windowState.delete(id);
    this.commands.clearForWindow(id);
    await this.host.notify('host.detachWindow', { windowId: id }).catch(() => {});
    this._emit(id, 'commands-changed', { commands: [] });
  }

  async listExtensions({ windowId } = {}) {
    await this.ensureStarted();
    const wid = Number(windowId) || 0;
    const cmds = this.commands.list({ windowId: wid });
    const out = [];
    for (const ext of this.index.extensions) {
      const normalized = this._normalizeExtensionRecord(ext, 'listExtensions');
      if (!normalized) continue;
      out.push({
        id: normalized.id,
        displayName: normalized.displayName,
        name: normalized.name,
        publisher: normalized.publisher,
        publisherDisplayName: normalized.publisherDisplayName,
        version: normalized.version,
        description: normalized.description,
        enabled: normalized.enabled !== false,
        activationEvents: normalized.activationEvents,
        contributes: normalized.contributes,
        enabledApiProposals: normalized.enabledApiProposals,
        installPath: normalized.installPath,
        iconUrl: this._toExtensionIconUrl(normalized),
        browser: normalized.browser,
        compatibilityMode: 'controlled-vscode',
        commands: cmds.filter((c) => safeString(c?.extensionId).trim() === normalized.id)
      });
    }
    return out;
  }

  async listCommands({ windowId } = {}) {
    await this.ensureStarted();
    return this.commands.list({ windowId: Number(windowId) || 0 });
  }

  async installVsix({ windowId, vsixPath }) {
    await this.ensureStarted();
    const installed = await this.vsixInstaller.installVsix(vsixPath);
    const record = this._normalizeExtensionRecord({
      id: installed.id,
      name: installed.name,
      publisher: installed.publisher,
      version: installed.version,
      displayName: installed.displayName,
      description: installed.description,
      publisherDisplayName: installed.publisherDisplayName || installed.publisher,
      engines: installed.engines || {},
      main: installed.main,
      browser: installed.browser || '',
      icon: installed.icon || '',
      activationEvents: installed.activationEvents || [],
      contributes: installed.contributes || {},
      enabledApiProposals: Array.isArray(installed?.manifest?.enabledApiProposals) ? installed.manifest.enabledApiProposals : [],
      installPath: installed.installPath,
      enabled: true,
      installedAt: Date.now()
    }, 'installVsix');
    if (!record) throw new Error('Extension metadata is invalid after VSIX install');
    this.index.extensions = this.index.extensions.filter((ext) => ext.id !== record.id);
    this.index.extensions.push(record);
    await this._writeJson(this.indexPath, this.index);
    await this._syncHostExtensions();
    await this.audit.log({ component: 'coder.extensions', action: 'install-vsix', windowId, extensionId: record.id, path: vsixPath });
    this._emitAll('extensions-changed', { reason: 'install', extensionId: record.id });
    return { success: true, extension: record };
  }

  async setExtensionEnabled({ windowId, extensionId, enabled }) {
    await this.ensureStarted();
    const item = this.index.extensions.find((ext) => ext.id === String(extensionId || ''));
    if (!item) return { success: false, error: 'Extension not found' };
    item.enabled = enabled !== false;
    if (item.enabled === false) {
      await this.processBroker.stopForExtension(item.id).catch(() => {});
    }
    await this._writeJson(this.indexPath, this.index);
    await this._syncHostExtensions();
    await this.audit.log({ component: 'coder.extensions', action: item.enabled ? 'enable' : 'disable', windowId, extensionId: item.id });
    this._emitAll('extensions-changed', { reason: item.enabled ? 'enable' : 'disable', extensionId: item.id });
    return { success: true, extension: item };
  }

  async uninstallExtension({ windowId, extensionId }) {
    await this.ensureStarted();
    const id = String(extensionId || '');
    const item = this.index.extensions.find((ext) => ext.id === id);
    if (!item) return { success: false, error: 'Extension not found' };
    for (const [panelId, panel] of [...this.webviewPanels.entries()]) {
      if (String(panel?.extensionId || '') !== id) continue;
      this.webviewPanels.delete(panelId);
      this._emit(Number(panel.windowId) || 0, 'extension-webview', { action: 'dispose', panelId });
    }
    await this.processBroker.stopForExtension(id).catch(() => {});
    this.index.extensions = this.index.extensions.filter((ext) => ext.id !== id);
    await this._writeJson(this.indexPath, this.index);
    if (item.installPath) await fs.promises.rm(item.installPath, { recursive: true, force: true }).catch(() => {});
    await this._syncHostExtensions();
    await this.audit.log({ component: 'coder.extensions', action: 'uninstall', windowId, extensionId: id });
    this._emitAll('extensions-changed', { reason: 'uninstall', extensionId: id });
    return { success: true };
  }

  async executeCommand({ windowId, commandId, args, source }) {
    await this.ensureStarted();
    const wid = Number(windowId) || 0;
    const cmd = this.commands.get(commandId);
    if (!cmd || cmd.enabled === false) throw new Error(`Command not found: ${commandId}`);
    if (cmd.windowId && wid && cmd.windowId !== wid) throw new Error('Command is not registered for this Coder window');
    await this.audit.log({ component: 'coder.extensions', action: 'execute-command', source: source || 'renderer', windowId: wid, commandId, extensionId: cmd.extensionId || '' });
    await this.host.request('host.activateByEvent', { event: `onCommand:${commandId}`, windowId: wid }).catch(() => null);
    return this.host.request('host.executeCommand', { windowId: wid, commandId, args: Array.isArray(args) ? args.slice(0, 20) : [] });
  }

  async notifyEditorEvent({ windowId, event, payload }) {
    await this.ensureStarted();
    const wid = Number(windowId) || 0;
    if (!wid) return { success: false, error: 'windowId is required' };
    if (!this.windowState.has(wid)) this.windowState.set(wid, { editor: null });
    if (event === 'workspaceLoaded' || event === 'workspaceScopeChanged') {
      await this._syncWindowWorkspace(wid);
    }
    if (event === 'fileOpened' || event === 'activeEditorChanged') {
      this.windowState.get(wid).editor = payload || null;
    }
    await this.host.notify('host.notifyEditorEvent', {
      windowId: wid,
      event: String(event || ''),
      payload: payload || {},
      workspaceRoots: this._getWorkspaceRoots(wid)
    }).catch((error) => this.logger.warn?.('[Coder][Extensions] notifyEditorEvent failed:', error?.message || error));
    return { success: true };
  }

  async handleWebviewRendererMessage({ windowId, panelId, message }) {
    await this.ensureStarted();
    const wid = Number(windowId) || 0;
    const id = String(panelId || '').trim();
    if (!wid || !id) throw new Error('windowId and panelId are required');
    const panel = this.webviewPanels.get(id);
    if (!panel || Number(panel.windowId) !== wid) throw new Error('Webview panel not found');
    await this.host.notify('host.webviewEvent', {
      action: 'message',
      panelId: id,
      windowId: wid,
      extensionId: panel.extensionId,
      message: message ?? null
    }).catch((error) => this.logger.warn?.('[Coder][Extensions] host.webviewEvent(message) failed:', error?.message || error));
    return { ok: true };
  }

  async handleWebviewRendererClosed({ windowId, panelId }) {
    await this.ensureStarted();
    const wid = Number(windowId) || 0;
    const id = String(panelId || '').trim();
    if (!wid || !id) throw new Error('windowId and panelId are required');
    const panel = this.webviewPanels.get(id);
    if (!panel || Number(panel.windowId) !== wid) return { ok: true, closed: false };
    this.webviewPanels.delete(id);
    await this.host.notify('host.webviewEvent', {
      action: 'dispose',
      panelId: id,
      windowId: wid,
      extensionId: panel.extensionId
    }).catch((error) => this.logger.warn?.('[Coder][Extensions] host.webviewEvent(dispose) failed:', error?.message || error));
    return { ok: true, closed: true };
  }

  async _syncHostExtensions() {
    const normalized = [];
    for (const ext of this.index.extensions) {
      const item = this._normalizeExtensionRecord(ext, 'syncHostExtensions');
      if (item) normalized.push(item);
    }
    await this.host.request('host.syncExtensions', {
      extensions: normalized.map((ext) => ({
        id: ext.id,
        name: ext.name,
        publisher: ext.publisher,
        version: ext.version,
        displayName: ext.displayName,
        description: ext.description,
        main: ext.main,
        browser: ext.browser,
        activationEvents: ext.activationEvents,
        contributes: ext.contributes,
        enabled: ext.enabled !== false,
        installPath: ext.installPath
      }))
    });
    for (const wid of this.windowState.keys()) {
      await this._syncWindowWorkspace(wid);
    }
  }

  async _syncWindowWorkspace(windowId) {
    const roots = this._getWorkspaceRoots(windowId);
    await this.host.notify('host.setWorkspaceRoots', { windowId, roots }).catch(() => {});
  }

  _getWorkspaceRoots(windowId) {
    try {
      const roots = this.getWorkspaceRootsForWindow(windowId);
      return Array.isArray(roots) ? roots.map((p) => path.resolve(String(p))) : [];
    } catch (_) {
      return [];
    }
  }

  async _handleHostRequest(method, params = {}, meta = {}) {
    const windowId = Number(meta.windowId || params.windowId) || 0;
    switch (method) {
      case 'commands.register':
        this.commands.register({ id: params.id, title: params.title, source: 'extension', extensionId: params.extensionId || meta.extensionId || '', windowId });
        this._emit(windowId, 'commands-changed', { commands: this.commands.list({ windowId }) });
        return { success: true };
      case 'commands.unregister':
        this.commands.unregister(params.id, { extensionId: params.extensionId || meta.extensionId || '', windowId });
        this._emit(windowId, 'commands-changed', { commands: this.commands.list({ windowId }) });
        return { success: true };
      case 'commands.execute':
        return this.executeCommand({ windowId, commandId: params.commandId, args: params.args, source: 'extension-host' });
      case 'workspace.readFile':
        return this.workspaceBroker.readFile({ ...params, windowId });
      case 'workspace.writeFile':
        return this.workspaceBroker.writeFile({ ...params, windowId });
      case 'workspace.stat':
        return this.workspaceBroker.stat({ ...params, windowId });
      case 'workspace.readDirectory':
        return this.workspaceBroker.readDirectory({ ...params, windowId });
      case 'workspace.createDirectory':
        return this.workspaceBroker.createDirectory({ ...params, windowId });
      case 'workspace.deletePath':
        return this.workspaceBroker.deletePath({ ...params, windowId });
      case 'workspace.renamePath':
        return this.workspaceBroker.renamePath({ ...params, windowId });
      case 'workspace.listFiles':
        return this.workspaceBroker.listFiles({ ...params, windowId });
      case 'workspace.findFiles':
        return this.workspaceBroker.findFiles({ ...params, windowId });
      case 'workspace.getConfiguration': {
        const section = params.section ? String(params.section).trim() : '';
        const config = this.configuration.getConfiguration(section, windowId, params.resource);
        return { ok: true, configuration: config };
      }
      case 'workspace.createFileSystemWatcher': {
        const watcherId = String(params.watcherId || '').trim();
        if (!watcherId) throw new Error('watcherId is required');
        return this.fileSystemWatcher.createWatcher(watcherId, {
          globPattern: params.globPattern,
          ignoreCreate: params.ignoreCreateEvents,
          ignoreChange: params.ignoreChangeEvents,
          ignoreDelete: params.ignoreDeleteEvents,
          windowId,
          extensionId: params.extensionId || meta.extensionId || ''
        });
      }
      case 'workspace.removeFileSystemWatcher': {
        const watcherId = String(params.watcherId || '').trim();
        if (!watcherId) throw new Error('watcherId is required');
        const removed = this.fileSystemWatcher.removeWatcher(watcherId);
        return { ok: true, removed };
      }
      case 'webview.createPanel': {
        const panelId = String(params.panelId || '').trim();
        if (!panelId) throw new Error('webview panelId is required');
        const extensionId = String(params.extensionId || meta.extensionId || '').trim();
        if (!extensionId) throw new Error('extensionId is required');
        const panel = {
          panelId,
          extensionId,
          windowId,
          viewType: String(params.viewType || '').trim(),
          title: String(params.title || '').trim() || 'Webview',
          options: params.options && typeof params.options === 'object' ? { ...params.options } : {},
          html: typeof params.html === 'string' ? params.html : '',
          visible: params.visible !== false,
          active: params.active !== false
        };
        this.webviewPanels.set(panelId, panel);
        this._emit(windowId, 'extension-webview', { action: 'create', panel: { ...panel } });
        return { ok: true, panelId };
      }
      case 'webview.updatePanel': {
        const panelId = String(params.panelId || '').trim();
        const panel = this.webviewPanels.get(panelId);
        if (!panel) throw new Error('Webview panel not found');
        if (Number(panel.windowId) !== windowId) throw new Error('Webview panel is not in this Coder window');
        if (typeof params.title === 'string') panel.title = params.title;
        if (typeof params.html === 'string') panel.html = params.html;
        if (params.options && typeof params.options === 'object') panel.options = { ...panel.options, ...params.options };
        if (typeof params.visible === 'boolean') panel.visible = params.visible;
        if (typeof params.active === 'boolean') panel.active = params.active;
        this._emit(windowId, 'extension-webview', { action: 'update', panel: { ...panel } });
        return { ok: true };
      }
      case 'webview.disposePanel': {
        const panelId = String(params.panelId || '').trim();
        const panel = this.webviewPanels.get(panelId);
        if (!panel) return { ok: true, disposed: false };
        if (Number(panel.windowId) !== windowId) throw new Error('Webview panel is not in this Coder window');
        this.webviewPanels.delete(panelId);
        this._emit(windowId, 'extension-webview', { action: 'dispose', panelId });
        return { ok: true, disposed: true };
      }
      case 'webview.postMessage': {
        const panelId = String(params.panelId || '').trim();
        const panel = this.webviewPanels.get(panelId);
        if (!panel) throw new Error('Webview panel not found');
        if (Number(panel.windowId) !== windowId) throw new Error('Webview panel is not in this Coder window');
        this._emit(windowId, 'extension-webview', { action: 'postMessage', panelId, message: params.message ?? null });
        return { ok: true };
      }
      case 'lsp.spawn':
        return this.processBroker.spawnSession({ ...params, protocol: 'lsp', windowId }, { ...meta, windowId });
      case 'lsp.send':
        return this.processBroker.sendMessage({ ...params, sessionId: params.sessionId, windowId }, { ...meta, windowId });
      case 'lsp.stop':
        return this.processBroker.stopSession({ ...params, sessionId: params.sessionId, windowId }, { ...meta, windowId });
      case 'dap.spawn':
        return this.processBroker.spawnSession({ ...params, protocol: 'dap', windowId }, { ...meta, windowId });
      case 'dap.send':
        return this.processBroker.sendMessage({ ...params, sessionId: params.sessionId, windowId }, { ...meta, windowId });
      case 'dap.stop':
        return this.processBroker.stopSession({ ...params, sessionId: params.sessionId, windowId }, { ...meta, windowId });
      case 'window.showMessage':
        this._emit(windowId, 'window-message', { severity: params.severity || 'info', message: String(params.message || ''), source: meta.extensionId || params.source || 'extension' });
        return { ok: true };
      case 'window.showTextDocument':
        this._emit(windowId, 'window-open-text-document', { path: params.path || params.filePath || '' });
        return { ok: true };
      case 'languages.registerProvider':
      case 'languages.unregisterProvider':
      case 'languages.publishDiagnostics':
        this._emit(windowId, 'language-provider', { method, params, extensionId: meta.extensionId || '' });
        return { ok: true };
      case 'storage.get':
        return { value: this._storageRead(meta, params) };
      case 'storage.set':
        this._storageWrite(meta, params, params.value ?? null);
        await this._writeJson(this.storagePath, this.storage);
        return { ok: true };
      case 'audit.log':
        await this.audit.log({ component: 'coder.extensions.host', windowId, extensionId: meta.extensionId || '', ...params });
        return { ok: true };
      default:
        throw new Error(`Unsupported extension host bridge method: ${method}`);
    }
  }

  _storageBucket(scope) {
    const key = scope === 'workspace' ? 'workspace' : 'global';
    if (!this.storage[key] || typeof this.storage[key] !== 'object') this.storage[key] = {};
    return this.storage[key];
  }

  _storageKey(meta, params) {
    return String(meta.extensionId || params.extensionId || '').trim();
  }

  _storageRead(meta, params) {
    const key = this._storageKey(meta, params);
    if (!key) return null;
    const bucket = this._storageBucket(params.scope);
    return bucket[key] ?? null;
  }

  _storageWrite(meta, params, value) {
    const key = this._storageKey(meta, params);
    if (!key) throw new Error('extensionId is required');
    const bucket = this._storageBucket(params.scope);
    bucket[key] = value;
  }

  _handleHostEvent(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'host-status') {
      this._emitAll('host-status', payload);
      if (payload.status && payload.status !== 'heartbeat-ok') {
        this.audit.log({
          component: 'coder.extensions.host',
          action: 'host-status',
          status: payload.status,
          code: payload.code ?? null,
          signal: payload.signal ?? null,
          message: payload.message || ''
        }).catch(() => {});
      }
      return;
    }
    if (payload.type === 'extension-activation') {
      const wid = Number(payload.windowId) || 0;
      this._emit(wid, 'extension-activation', payload);
      this.audit.log({
        component: 'coder.extensions.host',
        action: 'extension-activation',
        windowId: wid,
        extensionId: payload.extensionId || '',
        event: payload.event || '',
        phase: payload.phase || '',
        activated: payload.activated === true,
        message: payload.message || ''
      }).catch(() => {});
      return;
    }
    if (payload.type === 'extension-error') {
      this._emit(Number(payload.windowId) || 0, 'extension-error', payload);
      this.audit.log({ component: 'coder.extensions.host', action: 'extension-error', ...payload }).catch(() => {});
      return;
    }
    if (payload.type === 'host-log') {
      this.audit.log({ component: 'coder.extensions.host', action: 'log', level: payload.level || 'info', message: payload.message || '' }).catch(() => {});
    }
  }

  _handleConfigurationChanged(event) {
    if (!event || typeof event !== 'object') return;
    const windowId = Number(event.windowId) || 0;
    if (!windowId) return;

    // Notify extension host about configuration change
    this.host.notify('host.configurationChanged', {
      windowId,
      configuration: event.configuration || {}
    }).catch((error) => {
      this.logger.debug?.('[Coder][Extensions] host.configurationChanged failed:', error?.message);
    });

    // Emit to renderer as well
    this._emit(windowId, 'configuration-changed', { configuration: event.configuration });
  }

  _handleFileEvent(event) {
    if (!event || typeof event !== 'object') return;
    const windowId = Number(event.windowId) || 0;
    if (!windowId) return;

    // Notify extension host about file system event
    this.host.notify('host.fileSystemEvent', {
      watcherId: event.watcherId,
      windowId,
      filePath: event.filePath,
      type: event.type
    }).catch((error) => {
      this.logger.debug?.('[Coder][Extensions] host.fileSystemEvent failed:', error?.message);
    });

    // Audit file events
    this.audit.log({
      component: 'coder.extensions.fs-watcher',
      action: 'file-event',
      windowId,
      extensionId: event.extensionId || '',
      watcherId: event.watcherId || '',
      type: event.type,
      filePath: event.filePath
    }).catch(() => {});
  }

  _emit(windowId, type, payload = {}) {
    this.notifyRenderer(Number(windowId) || 0, { type, ...payload });
  }

  _emitAll(type, payload = {}) {
    for (const wid of this.windowState.keys()) this._emit(wid, type, payload);
  }

  _getExtensionInstallPath(extensionId) {
    const id = String(extensionId || '').trim();
    if (!id) return '';
    return String(this.index.extensions.find((ext) => ext.id === id)?.installPath || '');
  }

  _handleProcessBrokerEvent(payload) {
    if (!payload || typeof payload !== 'object') return;
    const windowId = Number(payload.windowId) || 0;
    const extensionId = String(payload.extensionId || '');
    const protocol = String(payload.protocol || '').toLowerCase();

    this.host.notify('host.protocolEvent', payload).catch(() => {});
    const shouldForwardToRenderer =
      windowId && (payload.type !== 'protocol-message' || protocol === 'dap');
    if (shouldForwardToRenderer) this._emit(windowId, 'extension-protocol', payload);

    const action = payload.type ? `protocol-${String(payload.type)}` : 'protocol-event';
    const auditEntry = {
      component: 'coder.extensions.protocol',
      action,
      protocol,
      windowId,
      extensionId,
      sessionId: payload.sessionId || ''
    };
    if (payload.type === 'protocol-error') auditEntry.message = payload.message || '';
    if (payload.type === 'protocol-exit') {
      auditEntry.code = payload.code ?? null;
      auditEntry.signal = payload.signal ?? null;
    }
    if (payload.type === 'protocol-spawn') {
      auditEntry.command = payload.command || '';
      auditEntry.pid = Number(payload.pid) || 0;
    }
    if (payload.type !== 'protocol-message') {
      this.audit.log(auditEntry).catch(() => {});
    }
  }

  _warnExtensionMetadata(field, ext, context, extraMessage = '') {
    const id = safeString(ext?.id).trim() || '<unknown>';
    const key = `${context}:${id}:${field}`;
    if (this.warnedExtensionMetadata.has(key)) return;
    this.warnedExtensionMetadata.add(key);
    const suffix = extraMessage ? ` ${extraMessage}` : '';
    this.logger.warn?.(`[Coder][Extensions] Invalid metadata (${context}) for ${id}: ${field}.${suffix}`, ext?.[field]);
  }

  _normalizeExtensionRecord(ext, context = 'runtime') {
    if (!isPlainObject(ext)) {
      this._warnExtensionMetadata('record', { id: '<unknown>', record: ext }, context, 'Expected object');
      return null;
    }
    const id = safeString(ext.id).trim();
    if (!id) {
      this._warnExtensionMetadata('id', ext, context, 'Missing required id; skipping record');
      return null;
    }
    const name = safeString(ext.name).trim() || id.split('.').slice(-1)[0] || 'extension';
    const publisher = safeString(ext.publisher).trim() || id.split('.')[0] || 'unknown';
    const version = safeString(ext.version).trim() || '0.0.0';
    const displayName = safeString(ext.displayName).trim() || name || id;
    const description = safeString(ext.description).trim();
    const installPath = safeString(ext.installPath).trim();

    if (typeof ext.displayName !== 'string' && ext.displayName != null) this._warnExtensionMetadata('displayName', ext, context, 'Coercing to safe string');
    if (typeof ext.publisher !== 'string' && ext.publisher != null) this._warnExtensionMetadata('publisher', ext, context, 'Coercing to safe string');
    if (typeof ext.version !== 'string' && ext.version != null) this._warnExtensionMetadata('version', ext, context, 'Coercing to safe string');
    if (typeof ext.description !== 'string' && ext.description != null) this._warnExtensionMetadata('description', ext, context, 'Coercing to safe string');
    if (!installPath) {
      this._warnExtensionMetadata('installPath', ext, context, 'Missing installPath; skipping record');
      return null;
    }

    return {
      ...ext,
      id,
      name,
      publisher,
      version,
      displayName,
      description,
      publisherDisplayName: safeString(ext.publisherDisplayName).trim() || publisher,
      main: safeString(ext.main).trim(),
      browser: safeString(ext.browser).trim(),
      icon: safeString(ext.icon).trim(),
      installPath,
      activationEvents: Array.isArray(ext.activationEvents) ? ext.activationEvents : [],
      contributes: isPlainObject(ext.contributes) ? ext.contributes : {},
      enabledApiProposals: Array.isArray(ext.enabledApiProposals) ? ext.enabledApiProposals : [],
      enabled: ext.enabled !== false
    };
  }

  _toExtensionIconUrl(ext) {
    try {
      const rel = safeString(ext?.icon).trim();
      const root = safeString(ext?.installPath).trim();
      if (!rel || !root) return '';
      const abs = path.resolve(root, rel);
      if (!(abs === path.resolve(root) || abs.startsWith(`${path.resolve(root)}${path.sep}`))) return '';
      return pathToFileURL(abs).toString();
    } catch (_) {
      return '';
    }
  }

  async _readJson(filePath, fallback) {
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  async _writeJson(filePath, data) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async _rehydrateExtensionIndexMetadata() {
    if (!Array.isArray(this.index.extensions) || !this.index.extensions.length) return;
    let changed = false;
    for (const ext of this.index.extensions) {
      const installPath = safeString(ext?.installPath).trim();
      if (!installPath) continue;
      const manifestPath = path.join(installPath, 'package.json');
      try {
        const raw = await fs.promises.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(raw);
        const localized = await this.vsixInstaller.localizeManifest(manifest, installPath);
        const normalized = this.vsixInstaller.validateManifest(localized, installPath);
        const before = JSON.stringify({
          displayName: ext.displayName,
          description: ext.description,
          icon: ext.icon,
          browser: ext.browser,
          main: ext.main,
          publisherDisplayName: ext.publisherDisplayName
        });
        ext.displayName = normalized.displayName || ext.displayName || ext.name;
        ext.description = normalized.description || ext.description || '';
        ext.icon = normalized.icon || ext.icon || '';
        ext.main = normalized.main || ext.main || '';
        ext.browser = normalized.browser || ext.browser || '';
        ext.publisherDisplayName = normalized.publisherDisplayName || ext.publisherDisplayName || ext.publisher || '';
        ext.contributes = normalized.contributes || ext.contributes || {};
        ext.activationEvents = normalized.activationEvents || ext.activationEvents || [];
        ext.enabledApiProposals = Array.isArray(normalized?.manifest?.enabledApiProposals)
          ? normalized.manifest.enabledApiProposals
          : (Array.isArray(ext.enabledApiProposals) ? ext.enabledApiProposals : []);
        const after = JSON.stringify({
          displayName: ext.displayName,
          description: ext.description,
          icon: ext.icon,
          browser: ext.browser,
          main: ext.main,
          publisherDisplayName: ext.publisherDisplayName
        });
        if (before !== after) changed = true;
      } catch (_) {
        // keep existing cached metadata
      }
      const normalized = this._normalizeExtensionRecord(ext, 'rehydrate');
      if (normalized) {
        const beforeNormalized = JSON.stringify(ext);
        Object.assign(ext, normalized);
        if (beforeNormalized !== JSON.stringify(ext)) changed = true;
      }
    }
    if (changed) {
      await this._writeJson(this.indexPath, this.index);
    }
  }
}

module.exports = ExtensionManager;
