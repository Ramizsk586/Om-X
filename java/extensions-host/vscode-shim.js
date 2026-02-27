(function(global) {
  'use strict';

  // Event emitter class for VS Code events
  class EventEmitter {
    constructor() {
      this.listeners = new Map();
    }

    event(listener) {
      const wrappedListener = (...args) => {
        try {
          listener(...args);
        } catch (e) {
          console.error('[VSCode Shim] Event listener error:', e);
        }
      };
      
      if (!this.listeners.has(listener)) {
        this.listeners.set(listener, []);
      }
      this.listeners.get(listener).push(wrappedListener);

      // Return disposable
      return {
        dispose: () => {
          const listeners = this.listeners.get(listener);
          if (listeners) {
            const idx = listeners.indexOf(wrappedListener);
            if (idx !== -1) listeners.splice(idx, 1);
          }
        }
      };
    }

    fire(...args) {
      this.listeners.forEach((listeners) => {
        listeners.forEach(listener => {
          try {
            listener(...args);
          } catch (e) {
            console.error('[VSCode Shim] Event fire error:', e);
          }
        });
      });
    }
  }

  // Disposable class
  class Disposable {
    constructor(callback) {
      this.callback = callback;
    }

    dispose() {
      if (this.callback) {
        this.callback();
        this.callback = null;
      }
    }
  }

  // Memento class for workspace/global state
  class Memento {
    constructor(storage, prefix = '') {
      this._storage = storage;
      this._prefix = prefix;
    }

    get(key, defaultValue) {
      const value = this._storage.getItem(this._prefix + key);
      if (value === null || value === undefined) {
        return defaultValue;
      }
      try {
        return JSON.parse(value);
      } catch {
        return defaultValue;
      }
    }

    update(key, value) {
      this._storage.setItem(this._prefix + key, JSON.stringify(value));
    }
  }

  // Configuration collection
  class ConfigurationCollection {
    constructor() {
      this._data = {};
    }

    get(section, resource) {
      const key = section || '';
      const parts = key.split('.');
      let value = this._data;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return undefined;
        }
      }
      return value;
    }

    update(section, value, resource) {
      const key = section || '';
      const parts = key.split('.');
      let target = this._data;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) {
          target[parts[i]] = {};
        }
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
    }
  }

  // Text document for editor
  class TextDocument {
    constructor(uri, languageId, content) {
      this._uri = uri;
      this._languageId = languageId;
      this._content = content;
      this._isDirty = false;
      this._version = 1;
    }

    get uri() { return this._uri; }
    get languageId() { return this._languageId; }
    get fileName() { return this._uri.path || this._uri.toString(); }
    get isDirty() { return this._isDirty; }
    get isUntitled() { return this._uri.scheme === 'untitled'; }

    getText() {
      return this._content;
    }

    getLineCount() {
      return this._content.split('\n').length;
    }

    lineAt(lineOrPosition) {
      const lines = this._content.split('\n');
      const lineNum = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
      return {
        lineNumber: lineNum + 1,
        text: lines[lineNum] || '',
        range: {
          start: { line: lineNum, character: 0 },
          end: { line: lineNum, character: (lines[lineNum] || '').length }
        }
      };
    }

    offsetAt(position) {
      const lines = this._content.split('\n');
      let offset = 0;
      for (let i = 0; i < position.line && i < lines.length; i++) {
        offset += lines[i].length + 1;
      }
      offset += position.character;
      return offset;
    }

    positionAt(offset) {
      const lines = this._content.split('\n');
      let currentOffset = 0;
      for (let i = 0; i < lines.length; i++) {
        if (currentOffset + lines[i].length >= offset) {
          return {
            line: i,
            character: offset - currentOffset
          };
        }
        currentOffset += lines[i].length + 1;
      }
      return { line: lines.length - 1, character: 0 };
    }
  }

  // Text editor
  class TextEditor {
    constructor(document, options = {}) {
      this._document = document;
      this._options = options;
      this._selections = [];
    }

    get document() { return this._document; }
    get options() { return this._options; }
    get viewColumn() { return 1; }

    get selection() {
      return this._selections[0] || {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 }
      };
    }

    get selections() {
      return this._selections;
    }

    edit(callback) {
      const editBuilder = {
        replace: (range, text) => {
          // Apply replacement to content
          const lines = this._document._content.split('\n');
          const startLine = range.start.line;
          const endLine = range.end.line;
          const startChar = range.start.character;
          const endChar = range.end.character;

          if (startLine === endLine) {
            const line = lines[startLine];
            lines[startLine] = line.substring(0, startChar) + text + line.substring(endChar);
          } else {
            const firstLine = lines[startLine];
            const lastLine = lines[endLine];
            lines[startLine] = firstLine.substring(0, startChar) + text + lastLine.substring(endChar);
            lines.splice(startLine + 1, endLine - startLine);
          }
          this._document._content = lines.join('\n');
          this._document._version++;
        },
        insert: (position, text) => {
          this.replace(
            { start: position, end: position },
            text
          );
        },
        delete: (range) => {
          this.replace(range, '');
        }
      };
      callback(editBuilder);
      this._document._isDirty = true;
      return Promise.resolve(true);
    }

    setSelection(selection) {
      this._selections = Array.isArray(selection) ? selection : [selection];
    }

    revealRange(range, revealType = 1) {
      // No-op for now - scroll handling
    }
  }

  // URI class
  class Uri {
    constructor(scheme, authority, path, query, fragment) {
      this.scheme = scheme;
      this.authority = authority;
      this.path = path;
      this.query = query;
      this.fragment = fragment;
    }

    static parse(str) {
      // Simple URI parser
      const match = str.match(/^([a-z]+):(\/\/([^/]+))?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
      if (!match) {
        return new Uri('file', '', str, '', '');
      }
      return new Uri(
        match[1] || 'file',
        match[3] || '',
        match[4] || '/',
        match[5] ? match[5].substring(1) : '',
        match[6] ? match[6].substring(1) : ''
      );
    }

    static file(path) {
      return Uri.parse('file://' + path);
    }

    toString() {
      let result = this.scheme + ':';
      if (this.authority) {
        result += '//' + this.authority;
      }
      result += this.path;
      if (this.query) result += '?' + this.query;
      if (this.fragment) result += '#' + this.fragment;
      return result;
    }

    with(changes) {
      return new Uri(
        changes.scheme || this.scheme,
        changes.authority || this.authority,
        changes.path || this.path,
        changes.query || this.query,
        changes.fragment || this.fragment
      );
    }
  }

  // Workspace edit for applyEdit
  class WorkspaceEdit {
    constructor() {
      this._entries = [];
    }

    replace(resource, range, newText) {
      this._entries.push({ type: 'replace', resource, range, newText });
    }

    insert(resource, position, newText) {
      this._entries.push({ type: 'insert', resource, position, newText });
    }

    delete(resource, range) {
      this._entries.push({ type: 'delete', resource, range });
    }

    get entries() {
      return this._entries;
    }
  }

  // Quick pick item
  class QuickPickItem {
    constructor(label, description, detail) {
      this.label = label;
      this.description = description;
      this.detail = detail;
      this.picked = false;
    }
  }

  // Input box options
  class InputBoxOptions {
    constructor(options = {}) {
      this.title = options.title || '';
      this.prompt = options.prompt || '';
      this.value = options.value || '';
      this.placeHolder = options.placeHolder || '';
      this.password = options.password || false;
      this.validateInput = options.validateInput || null;
    }
  }

  // Terminal for VS Code API
  class Terminal {
    constructor(options = {}) {
      this._name = options.name || 'Terminal';
      this._processId = null;
      this._exitStatus = null;
      this._isDisposed = false;
      this._onData = new EventEmitter();
      this._onExit = new EventEmitter();
    }

    get name() { return this._name; }
    get processId() { return this._processId; }
    get exitStatus() { return this._exitStatus; }
    get creationOptions() { return {}; }

    get onDidClose() { return this._onExit.event; }
    get onDidWriteData() { return this._onData.event; }

    show(preserveFocus) {
      // Terminal visibility - handled by Coder
    }

    hide() {
      // Terminal visibility
    }

    write(data) {
      if (!this._isDisposed) {
        this._onData.fire(data);
      }
    }

    executeCommand(command) {
      // Write command to terminal
      this.write(command + '\r');
    }

    dispose() {
      if (!this._isDisposed) {
        this._isDisposed = true;
        this._exitStatus = { code: 0, reason: 'disposed' };
        this._onExit.fire(this._exitStatus);
      }
    }
  }

  // Authentication session
  class AuthenticationSession {
    constructor(id, accessToken, account, scopes) {
      this.id = id;
      this.accessToken = accessToken;
      this.account = { id: account.id, label: account.label };
      this.scopes = scopes;
    }
  }

  // Authentication provider
  class AuthenticationProvider {
    constructor(id, label, callback) {
      this.id = id;
      this.label = label;
      this._callback = callback;
      this._sessions = [];
      this._onDidChangeSessions = new EventEmitter();
    }

    get onDidChangeSessions() {
      return this._onDidChangeSessions.event;
    }

    async getSessions(scopes) {
      return this._sessions.filter(s => 
        scopes.every(scope => s.scopes.includes(scope))
      );
    }

    async createSession(scopes, token) {
      const session = new AuthenticationSession(
        'session-' + Date.now(),
        token || 'token',
        { id: 'account', label: 'Account' },
        scopes
      );
      this._sessions.push(session);
      this._onDidChangeSessions.fire({ added: [session], removed: [] });
      return session;
    }

    async removeSession(id) {
      const idx = this._sessions.findIndex(s => s.id === id);
      if (idx !== -1) {
        const removed = this._sessions.splice(idx, 1);
        this._onDidChangeSessions.fire({ added: [], removed });
      }
    }
  }

  // Webview panel
  class WebviewPanel {
    constructor(viewType, title, options) {
      this.viewType = viewType;
      this.title = title;
      this._options = options || {};
      this._html = '';
      this._isDisposed = false;
      this._onDidDispose = new EventEmitter();
      this._onDidChangeViewState = new EventEmitter();
      this._onDidReceiveMessage = new EventEmitter();
    }

    get options() { return this._options; }
    get webview() { return this._webview; }
    set webview(value) { this._webview = value; }
    get visible() { return !this._isDisposed && this._options.visible !== false; }
    get active() { return this._options.active !== false; }

    get onDidDispose() { return this._onDidDispose.event; }
    get onDidChangeViewState() { return this._onDidChangeViewState.event; }
    get onDidReceiveMessage() { return this._onDidReceiveMessage.event; }

    setHtml(html) {
      this._html = html;
      if (this._webview) {
        this._webview.html = html;
      }
    }

    postMessage(message) {
      if (this._webview) {
        this._webview.postMessage(message);
      }
    }

    show(preserveFocus) {
      this._options.visible = true;
      this._onDidChangeViewState.fire({ webviewPanel: this });
    }

    hide() {
      this._options.visible = false;
      this._onDidChangeViewState.fire({ webviewPanel: this });
    }

    dispose() {
      if (!this._isDisposed) {
        this._isDisposed = true;
        this._onDidDispose.fire(this);
      }
    }
  }

  // Webview namespace
  const webview = {
    WebviewPanel: WebviewPanel,
    WebviewView: null // To be implemented
  };

  // Create the VS Code API object
  const vscode = {
    // Version
    version: '1.75.0',

    // URI
    Uri: Uri,

    // Event
    EventEmitter: EventEmitter,
    Disposable: Disposable,
    Memento: Memento,

    // Configuration
    ConfigurationCollection: ConfigurationCollection,

    // Documents
    TextDocument: TextDocument,
    TextEditor: TextEditor,
    TextEditorEdit: null,

    // Workspace edit
    WorkspaceEdit: WorkspaceEdit,

    // Quick pick
    QuickPickItem: QuickPickItem,
    InputBoxOptions: InputBoxOptions,

    // Terminal
    Terminal: Terminal,

    // Authentication
    AuthenticationSession: AuthenticationSession,
    AuthenticationProvider: AuthenticationProvider,

    // Webview
    webview: webview,

    // Workspace (to be initialized by extension host)
    workspace: null,

    // Window (to be initialized by extension host)
    window: null,

    // Commands (to be initialized by extension host)
    commands: null,

    // Authentication (to be initialized by extension host)
    authentication: null,

    // Extensions (to be initialized by extension host)
    extensions: null,

    // Env (to be initialized by extension host)
    env: null,

    // Languages (to be initialized by extension host)
    languages: null,

    // Tree view (to be initialized)
    TreeView: null,
    TreeItem: null,

    // Progress API
    ProgressLocation: {
      Notification: 1,
      Window: 2,
      SourceControl: 3
    }
  };

  // Export to global
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = vscode;
  } else {
    global.vscode = vscode;
    // Also expose to window if in browser context
    if (typeof window !== 'undefined') {
      window.vscode = vscode;
    }
  }

})(typeof window !== 'undefined' ? window : global);
