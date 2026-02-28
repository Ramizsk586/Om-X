/**
 * Extension Host Runtime
 * Manages extension lifecycle and provides VS Code API to extensions
 */

(function(global) {
  'use strict';

  // Get vscode shim
  const vscode = global.vscode;

  // Extension Host class
  class ExtensionHost {
    constructor(coderAPI) {
      this._coderAPI = coderAPI || {};
      this._extensions = new Map();
      this._extensionContexts = new Map();
      this._commands = new Map();
      this._authProviders = new Map();
      this._terminals = new Map();
      this._textDocuments = new Map();
      this._activeEditor = null;
      this._workspaceFolders = [];
      this._disposables = [];

      // Initialize workspace state
      this._workspaceStateStorage = {
        _data: {},
        getItem: function(key) { return this._data[key] || null; },
        setItem: function(key, value) { this._data[key] = value; }
      };

      // Initialize global state
      this._globalStateStorage = {
        _data: {},
        getItem: function(key) { return this._data[key] || null; },
        setItem: function(key, value) { this._data[key] = value; }
      };

      // Configuration
      this._configuration = new vscode.ConfigurationCollection();

      // Initialize APIs
      this._initWorkspaceAPI();
      this._initWindowAPI();
      this._initCommandsAPI();
      this._initAuthenticationAPI();
      this._initExtensionsAPI();
      this._initEnvAPI();
    }

    // Initialize workspace API
    _initWorkspaceAPI() {
      const self = this;

      vscode.workspace = {
        // Workspace folders
        get workspaceFolders() {
          return self._workspaceFolders;
        },

        name: self._workspaceFolders[0]?.name || 'Workspace',
        
        // File system
        fs: {
          readFile: async (uri) => {
            const path = uri.path || uri.toString();
            const content = await self._coderAPI.files?.read?.(path);
            return new TextEncoder().encode(content || '');
          },
          writeFile: async (uri, content) => {
            const path = uri.path || uri.toString();
            const text = new TextDecoder().decode(content);
            return self._coderAPI.files?.write?.(path, text);
          },
          stat: async (uri) => {
            const path = uri.path || uri.toString();
            const stat = await self._coderAPI.files?.stat?.(path);
            return stat ? {
              type: stat.isDirectory ? 2 : (stat.isFile ? 1 : 0),
              size: stat.size || 0,
              mtime: stat.mtime || Date.now(),
              ctime: stat.ctime || Date.now()
            } : null;
          },
          readDirectory: async (uri) => {
            const path = uri.path || uri.toString();
            const entries = await self._coderAPI.files?.readDir?.(path);
            return entries?.map(e => [e.name, e.isDirectory ? 2 : 1]) || [];
          },
          createDirectory: async (uri) => {
            const path = uri.path || uri.toString();
            return self._coderAPI.files?.createFolder?.(path);
          },
          delete: async (uri, options) => {
            const path = uri.path || uri.toString();
            return self._coderAPI.files?.deletePath?.(path);
          },
          rename: async (oldUri, newUri, options) => {
            const oldPath = oldUri.path || oldUri.toString();
            const newPath = newUri.path || newUri.toString();
            return self._coderAPI.files?.renamePath?.(oldPath, newPath);
          },
          copy: async (source, destination, options) => {
            // Not implemented
          }
        },

        // Text documents
        get textDocuments() {
          return Array.from(self._textDocuments.values());
        },

        openTextDocument: async (uriOrPath) => {
          let uri;
          if (typeof uriOrPath === 'string') {
            if (uriOrPath.startsWith('file://') || uriOrPath.startsWith('/') || uriOrPath.match(/^[A-Za-z]:/)) {
              uri = vscode.Uri.parse(uriOrPath);
            } else {
              uri = vscode.Uri.file(uriOrPath);
            }
          } else {
            uri = uriOrPath;
          }

          const path = uri.path || uri.toString();
          const content = await self._coderAPI.files?.read?.(path) || '';
          
          // Detect language from extension
          const ext = path.split('.').pop().toLowerCase();
          const langMap = {
            'js': 'javascript', 'jsx': 'javascript',
            'ts': 'typescript', 'tsx': 'typescript',
            'html': 'html', 'htm': 'html',
            'css': 'css', 'scss': 'scss', 'less': 'less',
            'json': 'json', 'md': 'markdown',
            'py': 'python', 'rb': 'ruby',
            'java': 'java', 'cpp': 'cpp', 'c': 'c',
            'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml'
          };
          const languageId = langMap[ext] || 'plaintext';

          const doc = new vscode.TextDocument(uri, languageId, content);
          self._textDocuments.set(uri.toString(), doc);
          return doc;
        },

        // Save document
        saveTextDocument: async (document) => {
          const path = document.uri.path || document.uri.toString();
          return self._coderAPI.files?.write?.(path, document.getText());
        },

        // Apply workspace edit
        applyEdit: async (edit) => {
          const entries = edit.entries || [];
          for (const entry of entries) {
            const doc = self._textDocuments.get(entry.resource.toString());
            if (doc) {
              const isValidRange = (r) => r && r.start && r.end;
              if (isValidRange(entry.range)) {
                doc.edit(builder => {
                  builder.replace(entry.range, entry.newText || '');
                });
              }
            }
          }
          return true;
        },

        // Get configuration
        getConfiguration: (section, resource) => {
          // Try to get from coder API (remote configuration)
          if (self._coderAPI.workspace?.getConfiguration) {
            return self._coderAPI.workspace.getConfiguration(section, resource);
          }
          // Fallback to local cache
          return self._configuration.get(section, resource);
        },

        // Events
        onDidChangeWorkspaceFolders: new vscode.EventEmitter(),
        onDidChangeConfiguration: new vscode.EventEmitter(),
        onDidOpenTextDocument: new vscode.EventEmitter(),
        onDidCloseTextDocument: new vscode.EventEmitter(),
        onDidChangeTextDocument: new vscode.EventEmitter(),
        onWillSaveTextDocument: new vscode.EventEmitter(),
        onDidSaveTextDocument: new vscode.EventEmitter()
      };
    }

    // Initialize window API
    _initWindowAPI() {
      const self = this;

      vscode.window = {
        // Active editor
        get activeTextEditor() {
          return self._activeEditor;
        },

        // Editors
        get visibleTextEditors() {
          return self._activeEditor ? [self._activeEditor] : [];
        },

        // Open text editor
        showTextDocument: async (document, column, preserveFocus) => {
          const doc = document instanceof vscode.TextDocument 
            ? document 
            : await vscode.workspace.openTextDocument(document);
          
          self._activeEditor = new vscode.TextEditor(doc);
          
          // Notify extension host
          vscode.workspace.onDidOpenTextDocument.fire(doc);
          
          return self._activeEditor;
        },

        // Create terminal
        createTerminal: (options = {}) => {
          const terminal = new vscode.Terminal({
            name: options.name || 'Terminal',
            cwd: options.cwd,
            env: options.env
          });

          // Register terminal with coder API
          if (self._coderAPI.terminal?.start) {
            const termId = 'vscode-terminal-' + Date.now();
            
            terminal._onData.fire = (data) => {
              // Handle terminal output
            };

            terminal._startTerminal = async () => {
              try {
                const result = await self._coderAPI.terminal.start({
                  command: options.shellPath || 'powershell',
                  cwd: options.cwd || '.',
                  sessionId: termId
                });
                if (result?.sessionId) {
                  terminal._sessionId = result.sessionId;
                }
              } catch (e) {
                console.error('[ExtensionHost] Terminal start error:', e);
              }
            };
          }

          self._terminals.set(terminal, terminal);
          return terminal;
        },

        // Dialogs - show information message
        showInformationMessage: async (message, ...items) => {
          // For now, just log to console in extension context
          console.log('[VSCode] Information:', message);
          return items[0];
        },

        // Warning message
        showWarningMessage: async (message, ...items) => {
          console.warn('[VSCode] Warning:', message);
          return items[0];
        },

        // Error message
        showErrorMessage: async (message, ...items) => {
          console.error('[VSCode] Error:', message);
          return items[0];
        },

        // Show input box
        showInputBox: async (options = {}) => {
          // Basic implementation - extensions need UI integration
          console.log('[VSCode] Input box requested:', options);
          return options.value || '';
        },

        // Show quick pick
        showQuickPick: async (items, options = {}) => {
          console.log('[VSCode] Quick pick requested:', options);
          if (Array.isArray(items) && items.length > 0) {
            return items[0];
          }
          return undefined;
        },

        // Create webview panel
        createWebviewPanel: (viewType, title, showOptions, webviewOptions = {}) => {
          const panel = new vscode.WebviewPanel(viewType, title, {
            ...showOptions,
            ...webviewOptions,
            visible: true,
            active: true
          });

          // Create webview object for the panel
          panel._webview = {
            html: '',
            set html(value) {
              // Post to actual webview
              if (self._coderAPI.extensions?.webviewPostMessage) {
                self._coderAPI.extensions.webviewPostMessage(panel._id, {
                  type: 'setHtml',
                  html: value
                });
              }
            },
            postMessage: (message) => {
              if (self._coderAPI.extensions?.webviewPostMessage) {
                self._coderAPI.extensions.webviewPostMessage(panel._id, message);
              }
            },
            onDidReceiveMessage: new vscode.EventEmitter()
          };

          panel._id = viewType + '-' + Date.now();

          // Show the panel via coder API
          if (self._coderAPI.extensions?.activateActivityContainer) {
            self._coderAPI.extensions.activateActivityContainer(viewType);
          }

          return panel;
        },

        // Status bar
        setStatusBarMessage: (text, timeoutOrThenable, thenable) => {
          // Not implemented in Coder
          return new vscode.Disposable(() => {});
        },

        // Progress
        withProgress: async (options, task) => {
          // Basic progress API
          return task({
            report: (value) => {
              console.log('[VSCode] Progress:', value);
            }
          });
        },

        // Workbench
        showWorkspaceFolderPick: async (options) => {
          return self._workspaceFolders[0] || null;
        },

        // Events
        onDidChangeActiveTextEditor: new vscode.EventEmitter(),
        onDidChangeVisibleTextEditors: new vscode.EventEmitter(),
        onDidChangeTextEditorSelection: new vscode.EventEmitter(),
        onDidChangeTextEditorViewColumn: new vscode.EventEmitter()
      };
    }

    // Initialize commands API
    _initCommandsAPI() {
      const self = this;

      vscode.commands = {
        registerCommand: (command, handler) => {
          self._commands.set(command, handler);
          
          // Register with coder API
          if (self._coderAPI.extensions?.executeCommand) {
            // Already registered via IPC
          }

          return new vscode.Disposable(() => {
            self._commands.delete(command);
          });
        },

        registerTextEditorCommand: (command, handler) => {
          return vscode.commands.registerCommand(command, (args) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
              return handler(editor, args);
            }
          });
        },

        executeCommand: async (command, ...args) => {
          const handler = self._commands.get(command);
          if (handler) {
            return handler(...args);
          }
          
          // Try coder API command
          if (self._coderAPI.extensions?.executeCommand) {
            return self._coderAPI.extensions.executeCommand(command, args);
          }
          
          return undefined;
        },

        getCommands: () => {
          return Array.from(self._commands.keys());
        }
      };
    }

    // Initialize authentication API
    _initAuthenticationAPI() {
      const self = this;

      vscode.authentication = {
        // Get session
        getSession: async (providerId, scopes, options) => {
          const provider = self._authProviders.get(providerId);
          if (provider) {
            const sessions = await provider.getSessions(scopes);
            if (sessions.length > 0) {
              return sessions[0];
            }
            // Try to create session
            if (options?.createIfNone !== false) {
              return provider.createSession(scopes);
            }
          }
          return undefined;
        },

        // Register authentication provider
        registerAuthenticationProvider: (id, label, provider) => {
          self._authProviders.set(id, provider);
          return new vscode.Disposable(() => {
            self._authProviders.delete(id);
          });
        },

        // Sessions
        onDidChangeAuthenticationProviders: new vscode.EventEmitter()
      };
    }

    // Initialize extensions API
    _initExtensionsAPI() {
      const self = this;

      vscode.extensions = {
        // Get all extensions
        getExtension: (extensionId) => {
          return self._extensions.get(extensionId) || null;
        },

        // Get all extensions
        getExtensions: () => {
          return Array.from(self._extensions.values());
        },

        // On change
        onDidChange: new vscode.EventEmitter()
      };
    }

    // Initialize env API
    _initEnvAPI() {
      vscode.env = {
        language: navigator.language || 'en',
        platform: navigator.platform,
        machineId: 'coder-' + Date.now(),
        sessionId: 'session-' + Date.now(),
        appName: 'Om-X Coder',
        appRoot: '',

        openExternal: async (uri) => {
          // Open in default browser
          const url = uri.toString();
          window.open(url, '_blank');
          return true;
        },

        asAbsolutePath: (relativePath) => {
          return relativePath;
        }
      };
    }

    // Create extension context
    createExtensionContext(extension) {
      const self = this;
      
      // Create unique ID for context
      const contextId = extension.id || 'extension-' + Date.now();

      // Workspace state (per workspace)
      const workspaceState = new vscode.Memento(this._workspaceStateStorage, contextId + '-ws-');

      // Global state (persisted)
      const globalState = new vscode.Memento(this._globalStateStorage, contextId + '-gs-');

      // Extension context
      const context = {
        subscriptions: [],
        workspaceState: workspaceState,
        globalState: globalState,
        extensionPath: extension.path || '',
        extensionUri: vscode.Uri.file(extension.path || ''),
        extension: extension,
        environmentVariableCollection: null,

        // Register disposable
        subscribe: (disposable) => {
          context.subscriptions.push(disposable);
        }
      };

      // Store context
      this._extensionContexts.set(contextId, context);

      return context;
    }

    // Activate extension
    activateExtension(extensionId) {
      const extension = this._extensions.get(extensionId);
      if (!extension) {
        return Promise.reject(new Error(`Extension ${extensionId} not found`));
      }

      // Create context if not exists
      if (!this._extensionContexts.has(extensionId)) {
        this.createExtensionContext(extension);
      }

      // Activate
      if (extension.activate) {
        try {
          return Promise.resolve(extension.activate());
        } catch (e) {
          return Promise.reject(e);
        }
      }

      return Promise.resolve();
    }

    // Deactivate extension
    deactivateExtension(extensionId) {
      const context = this._extensionContexts.get(extensionId);
      if (context) {
        // Dispose all subscriptions
        context.subscriptions.forEach(sub => {
          if (sub && sub.dispose) {
            try {
              sub.dispose();
            } catch (e) {
              console.error('[ExtensionHost] Dispose error:', e);
            }
          }
        });
        this._extensionContexts.delete(extensionId);
      }
    }

    // Register extension
    registerExtension(extension) {
      this._extensions.set(extension.id, extension);
    }

    // Set workspace folders
    setWorkspaceFolders(folders) {
      this._workspaceFolders = folders || [];
      vscode.workspace.onDidChangeWorkspaceFolders.fire({
        added: folders || [],
        removed: []
      });
    }

    // Get coder API
    getCoderAPI() {
      return this._coderAPI;
    }

    // Set coder API (can be updated)
    setCoderAPI(api) {
      this._coderAPI = api;
      // Setup configuration change listener if available
      if (api?.workspace?.onConfigurationChanged) {
        api.workspace.onConfigurationChanged((config) => {
          this.notifyConfigurationChanged(config);
        });
      }
    }

    // Handle configuration change notification
    notifyConfigurationChanged(configuration) {
      this._configuration = configuration;
      // Fire configuration change event for all listening extensions
      if (vscode.workspace?.onDidChangeConfiguration) {
        vscode.workspace.onDidChangeConfiguration.fire({
          affectsConfiguration: (section) => {
            // Simple implementation - could be more sophisticated
            return !section || section.length === 0;
          }
        });
      }
    }
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionHost;
  } else {
    global.ExtensionHost = ExtensionHost;
    // Also expose to window if in browser context
    if (typeof window !== 'undefined') {
      window.ExtensionHost = ExtensionHost;
    }
  }

})(typeof window !== 'undefined' ? window : global);
