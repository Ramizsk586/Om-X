const { contextBridge, ipcRenderer } = require('electron');

/**
 * Helper function to create event emitter for listeners
 */
function createEventListener() {
  const listeners = new Set();
  return {
    add: (callback) => {
      if (typeof callback !== 'function') return () => {};
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    notify: (payload) => {
      listeners.forEach(listener => {
        try { listener(payload); } catch (e) {
          console.error('Event listener error:', e);
        }
      });
    },
    dispose: () => listeners.clear()
  };
}

/**
 * Helper function to create disposable objects
 */
function createDisposable(dispose) {
  return {
    dispose: typeof dispose === 'function' ? dispose : () => {}
  };
}

/**
 * Enhanced Coder API with full VS Code extension capabilities
 */
const coderAPI = {
  version: '1.0.0',

  // ===== WORKSPACE API =====
  workspace: {
    // Folder/file operations
    folders: () => ipcRenderer.invoke('coder:workspace-get-folders'),
    name: () => ipcRenderer.invoke('coder:workspace-get-name'),
    
    // File system operations
    fs: {
      stat: (uri) => ipcRenderer.invoke('coder:fs-stat-path', typeof uri === 'string' ? uri : uri.path),
      readFile: (uri) => ipcRenderer.invoke('coder:fs-read-file', typeof uri === 'string' ? uri : uri.path),
      readDirectory: (uri) => ipcRenderer.invoke('coder:fs-read-dir', typeof uri === 'string' ? uri : uri.path),
      createDirectory: (uri) => ipcRenderer.invoke('coder:fs-create-folder', typeof uri === 'string' ? uri : uri.path),
      writeFile: (uri, content) => ipcRenderer.invoke('coder:fs-write-file', { 
        path: typeof uri === 'string' ? uri : uri.path, 
        content 
      }),
      delete: (uri, options = {}) => ipcRenderer.invoke('coder:fs-delete-path', typeof uri === 'string' ? uri : uri.path),
      rename: (source, target) => ipcRenderer.invoke('coder:fs-rename-path', { 
        oldPath: typeof source === 'string' ? source : source.path, 
        newPath: typeof target === 'string' ? target : target.path 
      }),
      copy: (source, target, options = {}) => ipcRenderer.invoke('coder:fs-copy-path', {
        source: typeof source === 'string' ? source : source.path,
        target: typeof target === 'string' ? target : target.path,
        overwrite: options.overwrite || false
      })
    },

    // Text document operations
    findFiles: (include, exclude, maxResults) => ipcRenderer.invoke('coder:workspace-find-files', { include, exclude, maxResults }),
    openTextDocument: (fileOrUri) => ipcRenderer.invoke('coder:workspace-open-document', 
      typeof fileOrUri === 'string' ? { path: fileOrUri } : fileOrUri),
    saveTextDocument: (document) => ipcRenderer.invoke('coder:workspace-save-document', { uri: document.uri }),
    textDocuments: () => ipcRenderer.invoke('coder:workspace-text-documents'),
    
    // Document events
    onDidCreateFiles: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-file-created', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeFiles: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-file-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidDeleteFiles: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-file-deleted', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidRenameFiles: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-file-renamed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidOpenTextDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-document-opened', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidCloseTextDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-document-closed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeTextDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-document-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidSaveTextDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-document-saved', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),

    // File system watcher
    createFileSystemWatcher: (glob, ignoreCreate, ignoreChange, ignoreDelete) => ({
      onDidCreate: createEventListener().add,
      onDidChange: createEventListener().add,
      onDidDelete: createEventListener().add,
      dispose: () => {}
    }),

    // Configuration
    getConfiguration: (section, scope) => ({
      get: (key, defaultValue) => ipcRenderer.invoke('coder:config-get', { section, key, defaultValue }),
      update: (key, value, isGlobal) => ipcRenderer.invoke('coder:config-update', { section, key, value, isGlobal }),
      has: (key) => ipcRenderer.invoke('coder:config-has', { section, key }),
      inspect: (key) => ipcRenderer.invoke('coder:config-inspect', { section, key })
    }),
    onDidChangeConfiguration: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:config-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),

    // Apply edits
    applyEdit: (edit, metadata) => ipcRenderer.invoke('coder:workspace-apply-edit', { edit, metadata }),
    
    // Create file/folder resources
    createFile: (uri, options = {}) => ipcRenderer.invoke('coder:fs-write-file', {
      path: typeof uri === 'string' ? uri : uri.path,
      content: '',
      create: true,
      overwrite: options.overwrite || false
    }),
    
    // File system provider registration
    registerFileSystemProvider: (scheme, provider, options) =>
      ipcRenderer.invoke('coder:workspace-register-fs-provider', { scheme, options: options || {} }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:workspace-fs-provider-dispose', { id })
      })),
    
    // Globbing/pattern matching
    asRelativePath: (pathOrUri, includeWorkspaceFolder) =>
      ipcRenderer.invoke('coder:workspace-as-relative-path', { path: pathOrUri, includeWorkspaceFolder }),
    
    // Encoding operations
    decode: (content, options) => ipcRenderer.invoke('coder:workspace-decode', { content, options }),
    encode: (content, options) => ipcRenderer.invoke('coder:workspace-encode', { content, options }),
    
    // Get workspace folder
    getWorkspaceFolder: (uri) =>
      ipcRenderer.invoke('coder:workspace-get-folder', { uri: typeof uri === 'string' ? uri : uri.toString() }),
    
    // Notebook operations
    openNotebookDocument: (uri) =>
      ipcRenderer.invoke('coder:workspace-open-notebook', { uri: typeof uri === 'string' ? uri : uri.toString() }),
    
    onDidOpenNotebookDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-notebook-opened', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidCloseNotebookDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-notebook-closed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeNotebookDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-notebook-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidSaveNotebookDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-notebook-saved', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onWillSaveNotebookDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-notebook-will-save', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    
    // Workspace trust
    isTrusted: () => ipcRenderer.invoke('coder:workspace-is-trusted'),
    onDidGrantWorkspaceTrust: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-trust-granted', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    
    // Will save operations
    onWillSaveTextDocument: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-document-will-save', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onWillCreateFiles: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-file-will-create', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onWillDeleteFiles: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-file-will-delete', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onWillRenameFiles: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:workspace-file-will-rename', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    
    // Additional document operations
    notebookDocuments: () => ipcRenderer.invoke('coder:workspace-get-notebook-documents'),
  },

  // ===== WINDOW API =====
  window: {
    // Active elements
    activeTextEditor: () => ipcRenderer.invoke('coder:window-get-active-editor'),
    activeColorTheme: () => ipcRenderer.invoke('coder:window-get-active-theme'),
    visibleTextEditors: () => ipcRenderer.invoke('coder:window-get-visible-editors'),
    activeTerminal: () => ipcRenderer.invoke('coder:window-get-active-terminal'),

    // Show dialogs & messages
    showErrorMessage: (message, ...items) => ipcRenderer.invoke('coder:window-show-error', { message, items }),
    showWarningMessage: (message, ...items) => ipcRenderer.invoke('coder:window-show-warning', { message, items }),
    showInformationMessage: (message, ...items) => ipcRenderer.invoke('coder:window-show-info', { message, items }),

    // Show input boxes
    showInputBox: (options) => ipcRenderer.invoke('coder:window-show-input', options || {}),
    showQuickPick: (items, options) => ipcRenderer.invoke('coder:window-show-quick-pick', { items, options: options || {} }),
    showOpenDialog: (options) => ipcRenderer.invoke('coder:dialog-select-folder'), // Reuse existing
    showSaveDialog: (options) => ipcRenderer.invoke('coder:window-show-save-dialog', options || {}),

    // Text editor operations
    showTextDocument: (documentOrUri, options) => ipcRenderer.invoke('coder:window-show-document', { 
      uri: typeof documentOrUri === 'string' ? documentOrUri : documentOrUri.uri,
      options: options || {}
    }),
    activeTextEditor: () => ipcRenderer.invoke('coder:window-get-active-editor'),

    // Terminal operations
    createTerminal: (nameOrOptions, shellPath, shellArgs) => {
      const options = typeof nameOrOptions === 'string' 
        ? { name: nameOrOptions, shellPath, shellArgs }
        : nameOrOptions;
      return ipcRenderer.invoke('coder:terminal-create', options).then(terminalId => ({
        _id: terminalId,
        name: options.name,
        processId: null,
        exitStatus: null,
        creationOptions: options,
        send: (text, addNewLine = true) => ipcRenderer.invoke('coder:terminal-write', {
          terminalId,
          text: addNewLine ? text + '\r\n' : text
        }),
        show: (preserveFocus = false) => ipcRenderer.invoke('coder:terminal-show', { terminalId, preserveFocus }),
        hide: () => ipcRenderer.invoke('coder:terminal-hide', { terminalId }),
        dispose: () => ipcRenderer.invoke('coder:terminal-dispose', { terminalId }),
        onDidClose: createEventListener().add,
        onDidOpen: createEventListener().add,
        onDidData: createEventListener().add
      }));
    },

    // Webview panels
    createWebviewPanel: (viewType, title, showOptions, options) => 
      ipcRenderer.invoke('coder:window-create-webview', { viewType, title, showOptions, options: options || {} }).then(panelId => ({
        viewType,
        title,
        iconPath: options?.iconPath,
        visible: true,
        active: true,
        panelId,
        webview: {
          html: '',
          options: options?.webviewOptions || {},
          postMessage: async () => false,
          asWebviewUri: (resource) => resource,
          cspSource: 'self',
          onDidReceiveMessage: createEventListener().add
        },
        setHtml: (html) => ipcRenderer.invoke('coder:window-webview-set-html', { panelId, html }),
        postMessage: async () => false,
        show: (preserveFocus = false) => ipcRenderer.invoke('coder:window-webview-show', { panelId, preserveFocus }),
        hide: () => ipcRenderer.invoke('coder:window-webview-hide', { panelId }),
        dispose: () => ipcRenderer.invoke('coder:window-webview-hide', { panelId }),
        onDidChangeViewState: createEventListener().add,
        onDidDispose: createEventListener().add
      })),

    // Custom editors
    registerCustomEditorProvider: (viewType, provider, options) =>
      ipcRenderer.invoke('coder:window-register-custom-editor', { viewType, options: options || {} }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:window-custom-editor-dispose', { id })
      })),
    
    // Webview panel serializer
    registerWebviewPanelSerializer: (viewType, serializer) =>
      ipcRenderer.invoke('coder:window-register-webview-serializer', { viewType }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:window-webview-serializer-dispose', { id })
      })),
    
    // Webview view provider
    registerWebviewViewProvider: (viewId, provider, options) =>
      ipcRenderer.invoke('coder:window-register-webview-view-provider', { viewId, options: options || {} }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:window-webview-view-provider-dispose', { id })
      })),
    
    // URI handler
    registerUriHandler: (handler) =>
      ipcRenderer.invoke('coder:window-register-uri-handler', {}).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:window-uri-handler-dispose', { id })
      })),
    
    // Terminal profile provider
    registerTerminalProfileProvider: (extensionId, provider) =>
      ipcRenderer.invoke('coder:window-register-terminal-profile', { extensionId }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:window-terminal-profile-dispose', { id })
      })),
    
    // Terminal link provider
    registerTerminalLinkProvider: (provider) =>
      ipcRenderer.invoke('coder:window-register-terminal-link-provider', {}).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:window-terminal-link-provider-dispose', { id })
      })),
    
    // Terminal shell integration
    terminals: async () => [],
    
    // Notebook editor
    visibleNotebookEditors: async () => [],
    activeNotebookEditor: async () => null,
    onDidChangeActiveNotebookEditor: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-notebook-editor-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeVisibleNotebookEditors: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-notebook-editors-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeNotebookEditorSelection: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-notebook-selection-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeNotebookEditorVisibleRanges: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-notebook-visible-ranges-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeTerminalShellIntegration: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-terminal-shell-integration-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidEndTerminalShellExecution: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-terminal-execution-ended', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidStartTerminalShellExecution: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-terminal-execution-started', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeTextEditorOptions: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-text-editor-options-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeTextEditorViewColumn: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-text-editor-column-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeTextEditorVisibleRanges: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-text-editor-visible-ranges-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),

    // Status bar
    createStatusBarItem: (idOrAlignment, priority, label) => {
      const id = typeof idOrAlignment === 'string' ? idOrAlignment : `statusbar-${Date.now()}`;
      return ipcRenderer.invoke('coder:window-create-status-item', { id, alignment: idOrAlignment, priority: priority || 0 }).then(itemId => ({
        _id: itemId,
        id,
        name: label || '',
        alignment: idOrAlignment,
        priority: priority || 0,
        text: '',
        tooltip: '',
        color: undefined,
        backgroundColor: undefined,
        command: undefined,
        accessibilityInformation: undefined,
        show: () => ipcRenderer.invoke('coder:window-status-item-show', { itemId }),
        hide: () => ipcRenderer.invoke('coder:window-status-item-hide', { itemId }),
        dispose: () => ipcRenderer.invoke('coder:window-status-item-dispose', { itemId })
      }));
    },
    setStatusBarMessage: (message, timeout) => {
      ipcRenderer.invoke('coder:window-set-status', { message, timeout });
      return createDisposable(() => {
        ipcRenderer.invoke('coder:window-clear-status', { message });
      });
    },
    
    // Input/Output channels
    createInputBox: () => ipcRenderer.invoke('coder:window-create-input-box', {}).then(boxId => ({
      _id: boxId,
      value: '',
      placeholder: '',
      password: false,
      prompt: '',
      title: '',
      step: undefined,
      totalSteps: undefined,
      busy: false,
      enabled: true,
      ignoreFocusOut: false,
      buttons: [],
      validationMessage: '',
      valueSelection: [0, 0],
      onDidAccept: createEventListener().add,
      onDidChangeValue: createEventListener().add,
      onDidHide: createEventListener().add,
      onDidTriggerButton: createEventListener().add,
      show: () => ipcRenderer.invoke('coder:window-input-box-show', { boxId }),
      hide: () => ipcRenderer.invoke('coder:window-input-box-hide', { boxId }),
      dispose: () => ipcRenderer.invoke('coder:window-input-box-dispose', { boxId })
    })),
    createQuickPick: () => ipcRenderer.invoke('coder:window-create-quick-pick', {}).then(pickId => ({
      _id: pickId,
      value: '',
      placeholder: '',
      items: [],
      canSelectMany: false,
      matchOnDescription: false,
      matchOnDetail: false,
      activeItems: [],
      selectedItems: [],
      busy: false,
      enabled: true,
      ignoreFocusOut: false,
      title: '',
      step: undefined,
      totalSteps: undefined,
      buttons: [],
      keepScrollPosition: false,
      onDidAccept: createEventListener().add,
      onDidChangeActive: createEventListener().add,
      onDidChangeSelection: createEventListener().add,
      onDidChangeValue: createEventListener().add,
      onDidHide: createEventListener().add,
      onDidTriggerButton: createEventListener().add,
      onDidTriggerItemButton: createEventListener().add,
      show: () => ipcRenderer.invoke('coder:window-quick-pick-show', { pickId }),
      hide: () => ipcRenderer.invoke('coder:window-quick-pick-hide', { pickId }),
      dispose: () => ipcRenderer.invoke('coder:window-quick-pick-dispose', { pickId })
    })),
    createOutputChannel: (name, languageId) =>
      ipcRenderer.invoke('coder:window-create-output-channel', { name, languageId }).then(channelId => ({
        _id: channelId,
        name,
        append: (value) => ipcRenderer.invoke('coder:window-output-append', { channelId, value }),
        appendLine: (value) => ipcRenderer.invoke('coder:window-output-append-line', { channelId, value }),
        clear: () => ipcRenderer.invoke('coder:window-output-clear', { channelId }),
        show: (preserveFocus) => ipcRenderer.invoke('coder:window-output-show', { channelId, preserveFocus }),
        hide: () => ipcRenderer.invoke('coder:window-output-hide', { channelId }),
        dispose: () => ipcRenderer.invoke('coder:window-output-dispose', { channelId }),
        replace: (value) => ipcRenderer.invoke('coder:window-output-replace', { channelId, value })
      })),
    
    // Text editor decoration
    createTextEditorDecorationType: (options) =>
      ipcRenderer.invoke('coder:window-create-decoration-type', { options }).then(typeId => ({
        _id: typeId,
        key: typeId,
        dispose: () => ipcRenderer.invoke('coder:window-decoration-type-dispose', { typeId })
      })),
    
    // Tabs/Groups
    tabGroups: {
      all: () => ipcRenderer.invoke('coder:window-get-tab-groups'),
      activeTabGroup: () => ipcRenderer.invoke('coder:window-get-active-tab-group'),
      onDidChangeTabGroups: (() => {
        const emitter = createEventListener();
        ipcRenderer.on('coder:window-tabs-group-changed', (_, payload) => emitter.notify(payload));
        return emitter.add;
      })(),
      onDidChangeTabs: (() => {
        const emitter = createEventListener();
        ipcRenderer.on('coder:window-tabs-changed', (_, payload) => emitter.notify(payload));
        return emitter.add;
      })(),
      close: (tabOrGroup, preserveFocus) => ipcRenderer.invoke('coder:window-close-tabs', { tabOrGroup, preserveFocus })
    },

    // Events
    onDidChangeActiveTextEditor: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-editor-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeVisibleTextEditors: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-editors-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeTextEditorSelection: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-selection-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeColorTheme: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-theme-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeWindowState: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:window-state-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidOpenTerminal: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:terminal-opened', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidCloseTerminal: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:terminal-closed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeActiveTerminal: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:terminal-active-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),

    // App-level control
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
  },

  // ===== COMMANDS API =====
  commands: {
    registerCommand: (command, callback, thisArg) => {
      ipcRenderer.invoke('coder:command-register', { command });
      const dispose = ipcRenderer.on('coder:command-execute:' + command, (_, args) => {
        try { 
          callback.apply(thisArg, Array.isArray(args) ? args : [args]); 
        } catch (e) {
          console.error('Command execution error:', e);
        }
      });
      return createDisposable(() => dispose());
    },
    registerTextEditorCommand: (command, callback, thisArg) => {
      return coderAPI.commands.registerCommand(command, callback, thisArg);
    },
    executeCommand: (command, ...args) => ipcRenderer.invoke('coder:command-execute', { command, args }),
    getCommands: (filterInternal = false) => ipcRenderer.invoke('coder:command-list', { filterInternal })
  },

  // ===== LANGUAGES API =====
  languages: {
    createDiagnosticCollection: (name) => ({
      name,
      set: (uri, diagnostics) => ipcRenderer.invoke('coder:diagnostics-set', { uri, diagnostics }),
      delete: (uri) => ipcRenderer.invoke('coder:diagnostics-delete', { uri }),
      clear: () => ipcRenderer.invoke('coder:diagnostics-clear', { name }),
      dispose: () => ipcRenderer.invoke('coder:diagnostics-dispose', { name }),
      has: (uri) => ipcRenderer.invoke('coder:diagnostics-has', { uri }),
      get: (uri) => ipcRenderer.invoke('coder:diagnostics-get', { uri }),
      forEach: (callback) => {}
    }),
    createLanguageStatusItem: (id, selector) =>
      ipcRenderer.invoke('coder:language-status-item-create', { id, selector }).then(itemId => ({
        _id: itemId,
        id,
        name: '',
        text: '',
        detail: '',
        severity: 0,
        command: undefined,
        accessibilityInformation: undefined,
        selector,
        busy: false,
        dispose: () => ipcRenderer.invoke('coder:language-status-item-dispose', { itemId })
      })),
    registerCompletionItemProvider: (selector, provider, triggerCharacters) => 
      ipcRenderer.invoke('coder:language-completions-register', { selector, triggerCharacters }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerHoverProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-hover-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDefinitionProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-definition-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDeclarationProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-declaration-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerImplementationProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-implementation-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerTypeDefinitionProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-type-definition-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerReferenceProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-references-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerRenameProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-rename-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDocumentSymbolProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-symbols-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerWorkspaceSymbolProvider: (provider) =>
      ipcRenderer.invoke('coder:language-workspace-symbols-register', {}).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerCodeActionProvider: (selector, provider, metadata) =>
      ipcRenderer.invoke('coder:language-code-actions-register', { selector, metadata }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerCodeLensProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-codelens-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerSignatureHelpProvider: (selector, provider, triggerCharacters, retriggerCharacters) =>
      ipcRenderer.invoke('coder:language-signature-help-register', { selector, triggerCharacters, retriggerCharacters }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDocumentFormattingEditProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-formatting-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDocumentRangeFormattingEditProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-range-formatting-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerOnTypeFormattingEditProvider: (selector, provider, firstTriggerCharacter, moreTriggerCharacters) =>
      ipcRenderer.invoke('coder:language-ontype-formatting-register', { selector, firstTriggerCharacter, moreTriggerCharacters }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDocumentLinkProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-links-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDocumentColorProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-colors-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerColorProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-color-provider-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerFoldingRangeProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-folding-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerSelectionRangeProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-selection-range-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerCallHierarchyProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-call-hierarchy-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerTypeHierarchyProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-type-hierarchy-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerSemanticTokensProvider: (selector, provider, legend) =>
      ipcRenderer.invoke('coder:language-semantic-tokens-register', { selector, legend }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerInlineValuesProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-inline-values-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerInlineCompletionItemProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-inline-completion-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerLinkedEditingRangeProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-linked-editing-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerInlayHintsProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-inlay-hints-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDocumentDropEditProvider: (selector, provider, metadata) =>
      ipcRenderer.invoke('coder:language-document-drop-register', { selector, metadata }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerDocumentPasteEditProvider: (selector, provider, metadata) =>
      ipcRenderer.invoke('coder:language-document-paste-register', { selector, metadata }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerEvaluatableExpressionProvider: (selector, provider) =>
      ipcRenderer.invoke('coder:language-evaluatable-expression-register', { selector }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerQuickDiffProvider: (selector, provider, options) =>
      ipcRenderer.invoke('coder:language-quick-diff-register', { selector, options }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    registerFileDecorationProvider: (provider) =>
      ipcRenderer.invoke('coder:language-file-decoration-register', {}).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:language-provider-dispose', { id })
      })),
    setLanguageConfiguration: (language, configuration) =>
      ipcRenderer.invoke('coder:language-config-set', { language, configuration }),
    getLanguages: () => ipcRenderer.invoke('coder:language-list'),
    getDiagnostics: (resource) => ipcRenderer.invoke('coder:diagnostics-get-all', { resource }),
    match: (selector, document) => ipcRenderer.invoke('coder:language-match', { selector, document }),
    onDidChangeDiagnostics: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:diagnostics-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })()
  },

  // ===== ENVIRONMENT API =====
  env: {
    // Properties
    appHost: () => ipcRenderer.invoke('coder:env-get', { key: 'appHost' }),
    appName: () => ipcRenderer.invoke('coder:env-get', { key: 'appName' }),
    appRoot: () => ipcRenderer.invoke('coder:env-get', { key: 'appRoot' }),
    language: () => ipcRenderer.invoke('coder:env-get', { key: 'language' }),
    logLevel: () => ipcRenderer.invoke('coder:env-get', { key: 'logLevel' }),
    logUri: () => ipcRenderer.invoke('coder:env-get', { key: 'logUri' }),
    machineId: () => ipcRenderer.invoke('coder:env-get', { key: 'machineId' }),
    remoteName: () => ipcRenderer.invoke('coder:env-get', { key: 'remoteName' }),
    sessionId: () => ipcRenderer.invoke('coder:env-get', { key: 'sessionId' }),
    shell: () => ipcRenderer.invoke('coder:env-get', { key: 'shell' }),
    uiKind: () => ipcRenderer.invoke('coder:env-get', { key: 'uiKind' }),
    uriScheme: () => ipcRenderer.invoke('coder:env-get', { key: 'uriScheme' }),
    isTelemetryEnabled: () => ipcRenderer.invoke('coder:env-get', { key: 'isTelemetryEnabled' }),
    isNewAppInstall: () => ipcRenderer.invoke('coder:env-get', { key: 'isNewAppInstall' }),
    platform: () => ipcRenderer.invoke('coder:env-get', { key: 'platform' }),
    
    // Methods
    asAbsolutePath: (relativePath) => ipcRenderer.invoke('coder:env-absolute-path', { path: relativePath }),
    openExternal: (uri) => ipcRenderer.invoke('coder:env-open-external', { uri: typeof uri === 'string' ? uri : uri.toString() }),
    asExternalUri: (uri) => ipcRenderer.invoke('coder:env-as-external-uri', { uri: typeof uri === 'string' ? uri : uri.toString() }),
    createTelemetryLogger: (sender, options) =>
      ipcRenderer.invoke('coder:env-create-telemetry-logger', { options: options || {} }).then(loggerId => ({
        _id: loggerId,
        isUsageEnabled: true,
        isErrorsEnabled: true,
        logUsage: (eventName, data) => ipcRenderer.invoke('coder:telemetry-log-usage', { loggerId, eventName, data }),
        logError: (errorOrName, data) => ipcRenderer.invoke('coder:telemetry-log-error', { loggerId, error: errorOrName, data }),
        dispose: () => ipcRenderer.invoke('coder:telemetry-logger-dispose', { loggerId }),
        onDidChangeEnableStates: createEventListener().add
      })),
    
    // Clipboard
    clipboard: {
      readText: () => ipcRenderer.invoke('coder:clipboard-read'),
      writeText: (value) => ipcRenderer.invoke('coder:clipboard-write', { value })
    },
    
    // Events
    onDidChangeLogLevel: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:env-log-level-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeShell: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:env-shell-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeTelemetryEnabled: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:env-telemetry-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })()
  },

  // ===== AUTHENTICATION API =====
  authentication: {
    getSession: (providerId, scopes, options) => ipcRenderer.invoke('coder:auth-get-session', { providerId, scopes, options: options || {} }),
    getSessions: (providerId, scopes) => ipcRenderer.invoke('coder:auth-get-sessions', { providerId, scopes }),
    registerAuthenticationProvider: (id, label, provider) => {
      ipcRenderer.invoke('coder:auth-provider-register', { id, label });
      return createDisposable(() => {
        ipcRenderer.invoke('coder:auth-provider-dispose', { id });
      });
    },
    onDidChangeSessions: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:auth-sessions-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })()
  },


  // ===== STORAGE API =====
  context: {
    globalState: {
      get: (key, defaultValue) => ipcRenderer.invoke('coder:storage-global-get', { key, defaultValue }),
      update: (key, value) => ipcRenderer.invoke('coder:storage-global-set', { key, value }),
      setKeysForSync: (keys) => ipcRenderer.invoke('coder:storage-global-sync-keys', { keys })
    },
    workspaceState: {
      get: (key, defaultValue) => ipcRenderer.invoke('coder:storage-workspace-get', { key, defaultValue }),
      update: (key, value) => ipcRenderer.invoke('coder:storage-workspace-set', { key, value })
    },
    globalStorageUri: () => ipcRenderer.invoke('coder:storage-global-uri'),
    workspaceStorageUri: () => ipcRenderer.invoke('coder:storage-workspace-uri'),
    extensionUri: () => null,
    extensionPath: () => null
  },

  // ===== DEBUGGING API =====
  debug: {
    // Variables
    activeDebugSession: () => ipcRenderer.invoke('coder:debug-active-session'),
    activeDebugConsole: {
      append: (value) => ipcRenderer.invoke('coder:debug-console-append', { value }),
      appendLine: (value) => ipcRenderer.invoke('coder:debug-console-append', { value: value + '\n'})
    },
    activeStackItem: () => ipcRenderer.invoke('coder:debug-active-stack-item'),
    breakpoints: () => ipcRenderer.invoke('coder:debug-breakpoints'),
    
    // Breakpoint management
    addBreakpoints: (breakpoints) =>
      ipcRenderer.invoke('coder:debug-add-breakpoints', { breakpoints }),
    removeBreakpoints: (breakpoints) =>
      ipcRenderer.invoke('coder:debug-remove-breakpoints', { breakpoints }),
    
    // Debug session management
    startDebugging: (workspaceFolder, nameOrConfiguration, options) =>
      ipcRenderer.invoke('coder:debug-start', { workspaceFolder, config: nameOrConfiguration, options: options || {} }),
    stopDebugging: (session) =>
      ipcRenderer.invoke('coder:debug-stop', { session: session || null }),
    
    // Debug adapter and configuration
    registerDebugAdapterDescriptorFactory: (debugType, factory) =>
      ipcRenderer.invoke('coder:debug-adapter-factory-register', { debugType }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:debug-adapter-factory-dispose', { id })
      })),
    registerDebugAdapterTrackerFactory: (debugType, factory) =>
      ipcRenderer.invoke('coder:debug-adapter-tracker-factory-register', { debugType }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:debug-adapter-tracker-factory-dispose', { id })
      })),
    registerDebugConfigurationProvider: (debugType, provider, triggerKind) =>
      ipcRenderer.invoke('coder:debug-config-provider-register', { debugType, triggerKind }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:debug-config-provider-dispose', { id })
      })),
    
    // Debug protocol helpers
    asDebugSourceUri: (source, session) =>
      ipcRenderer.invoke('coder:debug-as-debug-source-uri', { source, session: session || null }),
    
    // Events
    onDidChangeActiveDebugSession: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:debug-session-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeActiveStackItem: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:debug-stack-item-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidChangeBreakpoints: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:debug-breakpoints-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidStartDebugSession: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:debug-session-started', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidTerminateDebugSession: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:debug-session-terminated', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidReceiveDebugSessionCustomEvent: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:debug-session-event', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })()
  },

  // ===== TREE VIEW API =====
  treeViewApi: {
    createTreeView: (viewId, options) =>
      ipcRenderer.invoke('coder:tree-view-create', { viewId, showCollapseAll: options?.showCollapseAll }).then(id => ({
        _id: id,
        treeDataProvider: options.treeDataProvider || {},
        title: options.treeDataProvider?.getTitle?.() || '',
        message: '',
        description: '',
        visible: true,
        onDidCollapseElement: createEventListener().add,
        onDidExpandElement: createEventListener().add,
        onDidChangeSelection: createEventListener().add,
        onDidChangeVisibility: createEventListener().add,
        reveal: (element, options) => ipcRenderer.invoke('coder:tree-view-reveal', { id, element, options }),
        dispose: () => ipcRenderer.invoke('coder:tree-view-dispose', { id })
      })),
    registerTreeDataProvider: (viewId, treeDataProvider) =>
      ipcRenderer.invoke('coder:tree-provider-register', { viewId }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:tree-provider-dispose', { id })
      }))
  },

  // ===== SCMS (SOURCE CONTROL) API =====
  scm: {
    createSourceControl: (id, label, rootUri) =>
      ipcRenderer.invoke('coder:scm-create', { id, label, rootUri }).then(scmId => ({
        _id: scmId,
        id,
        label,
        rootUri,
        inputBox: {
          value: '',
          placeholder: 'Message (Ctrl+Enter to commit)',
          get: () => ipcRenderer.invoke('coder:scm-input-get', { scmId }),
          set: (value) => ipcRenderer.invoke('coder:scm-input-set', { scmId, value })
        },
        createResourceGroup: (id, label) => ({
          _id: id,
          id,
          label,
          resourceStates: [],
          hideWhenEmpty: false
        }),
        dispose: () => ipcRenderer.invoke('coder:scm-dispose', { scmId })
      })),
    inputBox: {
      value: '',
      placeholder: 'Message',
      get: () => ipcRenderer.invoke('coder:scm-global-input-get'),
      set: (value) => ipcRenderer.invoke('coder:scm-global-input-set', { value })
    }
  },

  // ===== COMMENTS API =====
  comments: {
    createCommentController: (id, label) =>
      ipcRenderer.invoke('coder:comments-create-controller', { id, label }).then(controllerId => ({
        _id: controllerId,
        id,
        label,
        createCommentThread: (uri, range, comments) =>
          ipcRenderer.invoke('coder:comments-create-thread', { controllerId, uri, range, comments }).then(threadId => ({
            _id: threadId,
            uri,
            range,
            comments,
            canReply: true,
            collapsibleState: 1,
            contextValue: 'commentThread',
            state: 0,
            label: '',
            dispose: () => ipcRenderer.invoke('coder:comments-thread-dispose', { threadId })
          })),
        dispose: () => ipcRenderer.invoke('coder:comments-controller-dispose', { controllerId })
      }))
  },

  // ===== CHAT API =====
  chat: {
    createChatParticipant: (id, handler) =>
      ipcRenderer.invoke('coder:chat-create-participant', { id }).then(participantId => ({
        _id: participantId,
        id,
        requestHandler: handler,
        iconPath: undefined,
        followupProvider: undefined,
        onDidReceiveFeedback: createEventListener().add,
        dispose: () => ipcRenderer.invoke('coder:chat-participant-dispose', { participantId })
      }))
  },

  // ===== NOTEBOOKS API =====
  notebooks: {
    createNotebookController: (id, notebookType, label, handler) =>
      ipcRenderer.invoke('coder:notebooks-create-controller', { id, notebookType, label }).then(controllerId => ({
        _id: controllerId,
        id,
        notebookType,
        label,
        description: '',
        detail: '',
        supportedLanguages: [],
        supportsExecutionOrder: true,
        onDidChangeSelectedNotebooks: createEventListener().add,
        createNotebookCellExecution: (cell) => ({
          cell,
          executionOrder: 0,
          token: { isCancellationRequested: false },
          start: () => {},
          end: (success) => {},
          appendOutput: (output) => {},
          clearOutput: () => {},
          replaceOutput: (output) => {}
        }),
        updateNotebookAffinity: (notebook, affinity) => 
          ipcRenderer.invoke('coder:notebooks-update-affinity', { controllerId, notebook, affinity }),
        dispose: () => ipcRenderer.invoke('coder:notebooks-controller-dispose', { controllerId })
      })),
    registerNotebookCellStatusBarItemProvider: (notebookType, provider) =>
      ipcRenderer.invoke('coder:notebooks-register-statusbar', { notebookType }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:notebooks-statusbar-dispose', { id })
      })),
    createRendererMessaging: (rendererId) => ({
      rendererId,
      onDidReceiveMessage: createEventListener().add,
      postMessage: (message, editor) =>
        ipcRenderer.invoke('coder:notebooks-post-message', { rendererId, message, editor })
    })
  },

  // ===== TESTS API =====
  tests: {
    createTestController: (id, label) =>
      ipcRenderer.invoke('coder:tests-create-controller', { id, label }).then(controllerId => ({
        _id: controllerId,
        id,
        label,
        items: {
          add: (item) => {},
          delete: (id) => {},
          forEach: (callback) => {},
          get: (id) => null,
          replace: (items) => {},
          size: 0
        },
        createTestItem: (id, label, uri) => ({
          id,
          label,
          uri,
          kind: 2,
          range: null,
          children: { add: () => {}, forEach: () => {} },
          canResolveChildren: false,
          parent: null,
          busy: false,
          tags: [],
          description: '',
          sortText: '',
          error: ''
        }),
        createRunProfile: (label, kind, handler, isDefault, tag) =>
          ipcRenderer.invoke('coder:tests-create-profile', { controllerId, label, kind, isDefault }).then(profileId => ({
            _id: profileId,
            label,
            kind,
            isDefault,
            configureHandler: () => {},
            runHandler: handler,
            supportsContinuousRun: false,
            tag,
            onDidChangeDefault: createEventListener().add,
            dispose: () => ipcRenderer.invoke('coder:tests-profile-dispose', { profileId })
          })),
        createTestRun: (request, name, persist) => ({
          task: request.profile,
          name,
          isPersisted: persist || false,
          token: { isCancellationRequested: false },
          passed: (test, duration) => ipcRenderer.invoke('coder:tests-run-passed', { test, duration }),
          failed: (test, message, duration) => ipcRenderer.invoke('coder:tests-run-failed', { test, message, duration }),
          skipped: (test) => ipcRenderer.invoke('coder:tests-run-skipped', { test }),
          errored: (test, message, duration) => ipcRenderer.invoke('coder:tests-run-errored', { test, message, duration }),
          started: (test) => ipcRenderer.invoke('coder:tests-run-started', { test }),
          appendOutput: (output, location, test) => ipcRenderer.invoke('coder:tests-run-output', { output, location, test }),
          end: () => ipcRenderer.invoke('coder:tests-run-end', {}),
          onDidDispose: createEventListener().add
        }),
        invalidateTestResults: (items) => ipcRenderer.invoke('coder:tests-invalidate', { items }),
        dispose: () => ipcRenderer.invoke('coder:tests-controller-dispose', { controllerId })
      }))
  },

  // ===== TASKS API =====
  tasks: {
    registerTaskProvider: (type, provider) =>
      ipcRenderer.invoke('coder:tasks-register-provider', { type }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:tasks-provider-dispose', { id })
      })),
    fetchTasks: (filter) =>
      ipcRenderer.invoke('coder:tasks-fetch', { filter: filter || {} }),
    executeTask: (task) =>
      ipcRenderer.invoke('coder:tasks-execute', { task }).then(executionId => ({
        _id: executionId,
        task,
        terminate: () => ipcRenderer.invoke('coder:tasks-terminate', { executionId })
      })),
    taskExecutions: () => ipcRenderer.invoke('coder:tasks-executions'),
    onDidStartTask: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:tasks-started', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidEndTask: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:tasks-ended', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidStartTaskProcess: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:tasks-process-started', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })(),
    onDidEndTaskProcess: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:tasks-process-ended', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })()
  },

  // ===== LOCALIZATION (L10N) API =====
  l10n: {
    t: (message, ...args) => ipcRenderer.invoke('coder:l10n-translate', { message, args }),
    bundle: undefined,
    uri: undefined
  },

  // ===== LANGUAGE MODEL (LM) API =====
  lm: {
    selectChatModels: (selector) =>
      ipcRenderer.invoke('coder:lm-select-models', { selector: selector || {} }),
    registerLanguageModelChatProvider: (vendor, provider) =>
      ipcRenderer.invoke('coder:lm-register-provider', { vendor }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:lm-provider-dispose', { id })
      })),
    registerMcpServerDefinitionProvider: (id, provider) =>
      ipcRenderer.invoke('coder:lm-register-mcp-provider', { id }).then(providerId => ({
        _id: providerId,
        dispose: () => ipcRenderer.invoke('coder:lm-mcp-provider-dispose', { providerId })
      })),
    registerTool: (name, tool) =>
      ipcRenderer.invoke('coder:lm-register-tool', { name }).then(id => ({
        _id: id,
        dispose: () => ipcRenderer.invoke('coder:lm-tool-dispose', { id })
      })),
    invokeTool: (name, options, token) =>
      ipcRenderer.invoke('coder:lm-invoke-tool', { name, options, token }),
    tools: [],
    onDidChangeChatModels: (() => {
      const emitter = createEventListener();
      ipcRenderer.on('coder:lm-models-changed', (_, payload) => emitter.notify(payload));
      return emitter.add;
    })()
  },

  // ===== ORIGINAL APIs - File/Terminal/Git/Preview/Run =====
  ai: {
    performTask: (params) => ipcRenderer.invoke('ai-perform-task', params)
  },
  files: {
    selectFolder: () => ipcRenderer.invoke('coder:dialog-select-folder'),
    selectFile: (filters) => ipcRenderer.invoke('coder:dialog-select-file', filters),
    allowPath: (targetPath, kind = 'dir') => ipcRenderer.invoke('coder:workspace-allow-path', { path: targetPath, kind }),
    read: (filePath) => ipcRenderer.invoke('coder:fs-read-file', filePath),
    readDir: (dirPath) => ipcRenderer.invoke('coder:fs-read-dir', dirPath),
    stat: (targetPath) => ipcRenderer.invoke('coder:fs-stat-path', targetPath),
    write: (filePath, content = '') => ipcRenderer.invoke('coder:fs-write-file', { path: filePath, content }),
    createFile: (filePath, content = '') => ipcRenderer.invoke('coder:fs-write-file', { path: filePath, content }),
    createFolder: (dirPath) => ipcRenderer.invoke('coder:fs-create-folder', dirPath),
    deletePath: (targetPath) => ipcRenderer.invoke('coder:fs-delete-path', targetPath),
    renamePath: (oldPath, newPath) => ipcRenderer.invoke('coder:fs-rename-path', { oldPath, newPath })
  },
  preview: {
    openHtml: (payload) => ipcRenderer.invoke('coder:preview-open-html', payload),
    close: () => ipcRenderer.invoke('coder:preview-close')
  },
  run: {
    compileAndRunC: (payload = {}) => ipcRenderer.invoke('coder:run-c', payload || {}),
    compileAndRunCpp: (payload = {}) => ipcRenderer.invoke('coder:run-cpp', payload || {}),
    listCCompilers: () => ipcRenderer.invoke('coder:list-c-compilers'),
    listCppCompilers: () => ipcRenderer.invoke('coder:list-cpp-compilers')
  },
  terminal: {
    exec: (payload = {}) => ipcRenderer.invoke('coder:terminal-exec', payload || {}),
    start: (payload = {}) => ipcRenderer.invoke('coder:terminal-start', payload || {}),
    write: (payload = {}) => ipcRenderer.invoke('coder:terminal-write', payload || {}),
    stop: (payload = {}) => ipcRenderer.invoke('coder:terminal-stop', payload || {}),
    onEvent: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => {
        try { callback(payload); } catch (_) {}
      };
      ipcRenderer.on('coder:terminal-event', listener);
      return () => {
        try { ipcRenderer.removeListener('coder:terminal-event', listener); } catch (_) {}
      };
    }
  },
  git: {
    detect: () => ipcRenderer.invoke('coder:git-detect'),
    status: (repoPath) => ipcRenderer.invoke('coder:git-status', { repoPath }),
    init: (payload = {}) => ipcRenderer.invoke('coder:git-init', payload || {}),
    saveConfig: (payload = {}) => ipcRenderer.invoke('coder:git-save-config', payload || {}),
    stageAll: (repoPath) => ipcRenderer.invoke('coder:git-stage-all', { repoPath }),
    commit: (repoPath, message) => ipcRenderer.invoke('coder:git-commit', { repoPath, message }),
    pull: (payload = {}) => ipcRenderer.invoke('coder:git-pull', payload || {}),
    push: (payload = {}) => ipcRenderer.invoke('coder:git-push', payload || {})
  },
  settings: {
    get: () => ipcRenderer.invoke('settings-get'),
    save: (data) => ipcRenderer.invoke('settings-save', data)
  }
};

// ===== UTILITY CLASSES =====
coderAPI.Uri = {
  parse: (str) => str,
  file: (path) => path
};

coderAPI.Disposable = {
  create: (dispose) => createDisposable(dispose),
  from: (...disposables) => ({
    dispose: () => disposables.forEach(d => d?.dispose?.())
  })
};

coderAPI.EventEmitter = {
  create: () => createEventListener()
};

coderAPI.Position = (line, character) => ({ line, character });
coderAPI.Range = (start, end) => ({ start, end });
coderAPI.Selection = (anchor, active) => ({ anchor, active });

// Merge tree view APIs into the primary window namespace without overwriting it.
coderAPI.window = {
  ...(coderAPI.window || {}),
  ...(coderAPI.treeViewApi || {})
};
delete coderAPI.treeViewApi;

// Expose to world
contextBridge.exposeInMainWorld('coderAPI', coderAPI);
