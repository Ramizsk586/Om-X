(() => {
  'use strict';

  const api = window.coderAPI || {};
  const SESSION_KEY = 'omx-coder-session-v1';
  const MAX_AI_LOG_ITEMS = 120;
  const MAX_FILE_LIST_FOR_AI = 240;
  const MAX_AI_CONTEXT_CHARS = 24000;
  const MAX_EDIT_LINES = 220;
  const MAX_REVISIONS_PER_FILE = 40;
  const MAX_EDITOR_DIAGNOSTIC_CHARS = 180000;
  const MAX_EDITOR_DIAGNOSTIC_ITEMS = 18;
  const TREE_IGNORED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'out']);
  const IMAGE_FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg']);
  const SEARCH_BINARY_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg',
    'pdf', 'zip', 'rar', '7z', 'gz', 'tgz', 'exe', 'dll', 'so', 'dylib',
    'woff', 'woff2', 'ttf', 'eot', 'otf', 'mp3', 'wav', 'ogg', 'mp4', 'mov', 'avi', 'mkv'
  ]);
  const ALLOWED_AI_FUNCTIONS = new Set(['applyEdit', 'createFile', 'deleteFile', 'getFile', 'renameFile', 'listFiles']);
  const AI_CHAT_ENABLED = false;
  const SIDE_PANEL_MODES = ['explorer', 'search', 'source', 'run', 'extensions', 'extension'];
  const DEFAULT_SIDE_PANEL_WIDTHS = Object.freeze({
    explorer: 240,
    search: 300,
    source: 300,
    run: 300,
    extensions: 320,
    extension: 340
  });
  const DEFAULT_CODER_SETTINGS = Object.freeze({
    cCompilerProfile: 'inbuilt',
    cCompilerCustomCommand: '',
    cCompilerExtraArgs: '',
    cppCompilerProfile: 'inbuilt',
    cppCompilerCustomCommand: '',
    cppCompilerExtraArgs: ''
  });
  const warnedExtensionPayloadIssues = new Set();

  function safeString(value) {
    return typeof value === 'string' ? value : '';
  }

  function warnExtensionPayloadIssue(field, value, context = '') {
    const key = `${context}:${field}`;
    if (warnedExtensionPayloadIssues.has(key)) return;
    warnedExtensionPayloadIssues.add(key);
    console.warn(`[Coder][Extensions] Invalid external data (${context}): ${field}`, value);
  }

  if (!window.__coderRendererSafetyNetInstalled) {
    window.__coderRendererSafetyNetInstalled = true;
    window.addEventListener('error', (event) => {
      console.error('[Renderer Crash]', event?.error || event?.message || event);
    });
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Renderer Crash] Unhandled promise rejection:', event?.reason || event);
    });
  }

  const state = {
    projectRoot: '',
    treeChildren: [],
    expandedDirs: new Set(),
    explorerOpen: true,
    sidePanelMode: 'explorer',
    sidePanelWidths: { ...DEFAULT_SIDE_PANEL_WIDTHS },
    activeExtensionActivityId: '',
    selectedPath: '',
    tabs: [],
    files: new Map(),
    activePath: '',
    extensionDetailView: null,
    extensionWebviewPanels: new Map(),
    activeExtensionWebviewPanelId: '',
    extensionDetailCache: {},
    extensionDetailRequestSeq: 0,
    externalLanguageDiagnostics: new Map(),
    aiOpen: false,
    aiSidebarWidth: 480,
    aiSettingsOpen: false,
    pendingAiBatch: null,
    aiLog: [],
    sessionSaveTimer: null,
    toastTimer: null,
    dialogResolver: null,
    dialogRestoreFocus: null,
    sideResize: null,
    aiResize: null,
    dragScroll: null,
    dragScrollSuppressClickUntil: 0,
    editorDiagnosticsPopup: {
      open: false,
      x: 16,
      y: 16,
      width: 560,
      drag: null
    },
    searchPanel: {
      query: '',
      replaceQuery: '',
      showReplace: false,
      includePattern: '',
      excludePattern: '',
      matchCase: false,
      wholeWord: false,
      useRegex: false,
      loading: false,
      searched: false,
      requestSeq: 0,
      searchTimer: null,
      error: '',
      results: [],
      collapsedFiles: {},
      summary: {
        filesScanned: 0,
        filesConsidered: 0,
        filesMatched: 0,
        totalMatches: 0,
        durationMs: 0,
        limitedByFileCap: false,
        limitedByMatchCap: false,
        skippedBinary: 0,
        skippedLarge: 0
      }
    },
    runPanel: {
      configId: 'auto',
      consoleMode: 'integratedTerminal',
      stopOnEntry: false,
      autoSaveBeforeRun: true,
      lastDebugUrl: '',
      lastAction: '',
      lastActionKind: '',
      lastActionAt: 0,
      sectionExpanded: {
        variables: true,
        watch: false,
        callStack: true,
        breakpoints: true
      }
    },
    sourceControl: {
      loading: false,
      loaded: false,
      requestSeq: 0,
      actionRunning: '',
      gitInstalled: null,
      gitVersion: '',
      isRepo: false,
      repoRoot: '',
      branch: '',
      upstream: '',
      ahead: 0,
      behind: 0,
      detached: false,
      hasCommits: false,
      clean: true,
      counts: { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
      changes: [],
      userNameDraft: '',
      userEmailDraft: '',
      remoteUrlDraft: '',
      branchDraft: 'main',
      commitMessage: '',
      statusError: '',
      lastActionError: '',
      lastActionOutput: '',
      lastActionName: '',
      lastActionOk: null,
      lastRefreshedAt: 0
    },
    extensionCatalog: [],
    extensionCommands: [],
    extensionActivityItems: [],
    extensionHostStatus: 'unknown',
    extensionEventUnsub: null,
    extensionErrors: {},
    extensionDocChangeTimer: null,
    extensionWebviewHostBound: false,
    coderTerminalEventUnsub: null,
    coderSettingsOpen: false,
    coderSettings: { ...DEFAULT_CODER_SETTINGS },
    cCompilerDiscovery: {
      loading: false,
      loaded: false,
      error: '',
      compilers: [],
      requestSeq: 0,
      lastScanAt: 0
    },
    cppCompilerDiscovery: {
      loading: false,
      loaded: false,
      error: '',
      compilers: [],
      requestSeq: 0,
      lastScanAt: 0
    },
    coderTerminal: {
      open: false,
      cwd: '',
      input: '',
      lines: [],
      partialLine: null,
      busy: false,
      sessionId: '',
      history: [],
      historyIndex: -1,
      requestSeq: 0
    },
    coderRunResultPanel: {
      open: false,
      title: '',
      meta: '',
      sections: [],
      outputText: '',
      fullOutputText: '',
      outputKind: 'stdout',
      inputText: '',
      busy: false,
      filePath: '',
      requestSeq: 0,
      lastRunMeta: ''
    },
    marketplaceQuery: '',
    marketplaceQueryInput: '',
    marketplaceResults: [],
    marketplaceTotal: 0,
    marketplaceLoading: false,
    marketplaceError: '',
    marketplaceSearched: false,
    marketplaceSearchTimer: null,
    marketplaceInstalling: '',
    marketplaceRequestSeq: 0
  };

  function normalizeCoderCompilerProfile(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'inbuilt';
    if (raw === 'auto') return 'inbuilt';
    if (raw === 'other') return 'custom';
    if (['inbuilt', 'gcc', 'clang', 'cc', 'tcc', 'custom'].includes(raw)) return raw;
    return 'inbuilt';
  }

  function normalizeCoderCppCompilerProfile(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'inbuilt';
    if (raw === 'auto') return 'inbuilt';
    if (raw === 'other') return 'custom';
    if (raw === 'g++') return 'gxx';
    if (raw === 'clang++') return 'clangxx';
    if (raw === 'cl') return 'msvc';
    if (['inbuilt', 'gxx', 'clangxx', 'cpp', 'clangcl', 'msvc', 'custom'].includes(raw)) return raw;
    return 'inbuilt';
  }

  function normalizeCoderSettings(input = {}) {
    const src = (input && typeof input === 'object') ? input : {};
    const cCustomCommand = String(src.cCompilerCustomCommand || '').trim().slice(0, 512);
    const cExtraArgs = String(src.cCompilerExtraArgs || '').trim().slice(0, 1024);
    const cppProfileInput = (src.cppCompilerProfile !== undefined) ? src.cppCompilerProfile : src.cCompilerProfile;
    const cppCustomCommandInput = (src.cppCompilerCustomCommand !== undefined) ? src.cppCompilerCustomCommand : src.cCompilerCustomCommand;
    const cppExtraArgsInput = (src.cppCompilerExtraArgs !== undefined) ? src.cppCompilerExtraArgs : src.cCompilerExtraArgs;
    const cppCustomCommand = String(cppCustomCommandInput || '').trim().slice(0, 512);
    const cppExtraArgs = String(cppExtraArgsInput || '').trim().slice(0, 1024);
    return {
      cCompilerProfile: normalizeCoderCompilerProfile(src.cCompilerProfile),
      cCompilerCustomCommand: cCustomCommand,
      cCompilerExtraArgs: cExtraArgs,
      cppCompilerProfile: normalizeCoderCppCompilerProfile(cppProfileInput),
      cppCompilerCustomCommand: cppCustomCommand,
      cppCompilerExtraArgs: cppExtraArgs
    };
  }

  function getCoderSettings() {
    state.coderSettings = normalizeCoderSettings(state.coderSettings || DEFAULT_CODER_SETTINGS);
    return state.coderSettings;
  }

  function getEffectiveCoderSettingsForRun() {
    const saved = normalizeCoderSettings(getCoderSettings());
    let effective = { ...saved };

    if (state.coderSettingsOpen) {
      effective = normalizeCoderSettings({
        cCompilerProfile: els['coder-settings-c-compiler']?.value || saved.cCompilerProfile,
        cCompilerCustomCommand: els['coder-settings-c-custom-command']?.value || saved.cCompilerCustomCommand,
        cCompilerExtraArgs: els['coder-settings-c-custom-args']?.value || saved.cCompilerExtraArgs,
        cppCompilerProfile: els['coder-settings-cpp-compiler']?.value || saved.cppCompilerProfile,
        cppCompilerCustomCommand: els['coder-settings-cpp-custom-command']?.value || saved.cppCompilerCustomCommand,
        cppCompilerExtraArgs: els['coder-settings-cpp-custom-args']?.value || saved.cppCompilerExtraArgs
      });
    }

    const cDiscovery = getCCompilerDiscoveryState();
    if (cDiscovery.loaded) {
      const available = new Set(getAvailableCCompilerProfilesForSettings().map((x) => x.id));
      if (effective.cCompilerProfile !== 'custom' && !available.has(effective.cCompilerProfile)) {
        effective.cCompilerProfile = 'inbuilt';
      }
    }
    const cppDiscovery = getCppCompilerDiscoveryState();
    if (cppDiscovery.loaded) {
      const available = new Set(getAvailableCppCompilerProfilesForSettings().map((x) => x.id));
      if (effective.cppCompilerProfile !== 'custom' && !available.has(effective.cppCompilerProfile)) {
        effective.cppCompilerProfile = 'inbuilt';
      }
    }

    return effective;
  }

  function getCCompilerDiscoveryState() {
    if (!state.cCompilerDiscovery || typeof state.cCompilerDiscovery !== 'object') {
      state.cCompilerDiscovery = {
        loading: false,
        loaded: false,
        error: '',
        compilers: [],
        requestSeq: 0,
        lastScanAt: 0
      };
    }
    if (!Array.isArray(state.cCompilerDiscovery.compilers)) state.cCompilerDiscovery.compilers = [];
    return state.cCompilerDiscovery;
  }

  function getCppCompilerDiscoveryState() {
    if (!state.cppCompilerDiscovery || typeof state.cppCompilerDiscovery !== 'object') {
      state.cppCompilerDiscovery = {
        loading: false,
        loaded: false,
        error: '',
        compilers: [],
        requestSeq: 0,
        lastScanAt: 0
      };
    }
    if (!Array.isArray(state.cppCompilerDiscovery.compilers)) state.cppCompilerDiscovery.compilers = [];
    return state.cppCompilerDiscovery;
  }

  function normalizeDetectedCCompilers(list) {
    const src = Array.isArray(list) ? list : [];
    const seen = new Set();
    const out = [];
    for (const item of src) {
      const id = normalizeCoderCompilerProfile(item?.id || item?.profile || '');
      if (!['gcc', 'clang', 'cc', 'tcc'].includes(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        label: String(item?.label || '').trim(),
        command: String(item?.command || id).trim(),
        version: String(item?.version || '').trim()
      });
    }
    const order = { gcc: 1, clang: 2, cc: 3, tcc: 4 };
    out.sort((a, b) => (order[a.id] || 99) - (order[b.id] || 99));
    return out;
  }

  function normalizeDetectedCppCompilers(list) {
    const src = Array.isArray(list) ? list : [];
    const seen = new Set();
    const out = [];
    for (const item of src) {
      const id = normalizeCoderCppCompilerProfile(item?.id || item?.profile || '');
      if (!['gxx', 'clangxx', 'cpp', 'clangcl', 'msvc'].includes(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        label: String(item?.label || '').trim(),
        command: String(item?.command || id).trim(),
        version: String(item?.version || '').trim()
      });
    }
    const order = { gxx: 1, clangxx: 2, cpp: 3, clangcl: 4, msvc: 5 };
    out.sort((a, b) => (order[a.id] || 99) - (order[b.id] || 99));
    return out;
  }

  function getCCompilerProfileSelectLabel(profileId) {
    const id = normalizeCoderCompilerProfile(profileId);
    if (id === 'inbuilt') return 'Inbuilt';
    if (id === 'gcc') return 'GCC';
    if (id === 'clang') return 'Clang';
    if (id === 'cc') return 'CC';
    if (id === 'tcc') return 'Tiny C Compiler (tcc)';
    if (id === 'custom') return 'Other (Custom)';
    return 'Inbuilt';
  }

  function getCppCompilerProfileSelectLabel(profileId) {
    const id = normalizeCoderCppCompilerProfile(profileId);
    if (id === 'inbuilt') return 'Inbuilt';
    if (id === 'gxx') return 'G++';
    if (id === 'clangxx') return 'Clang++';
    if (id === 'cpp') return 'C++';
    if (id === 'clangcl') return 'clang-cl';
    if (id === 'msvc') return 'MSVC (cl.exe)';
    if (id === 'custom') return 'Other (Custom)';
    return 'Inbuilt';
  }

  function getAvailableCCompilerProfilesForSettings() {
    const discovery = getCCompilerDiscoveryState();
    const profiles = [{ id: 'inbuilt', label: getCCompilerProfileSelectLabel('inbuilt') }];
    const detected = Array.isArray(discovery.compilers) ? discovery.compilers : [];
    detected.forEach((item) => {
      const id = normalizeCoderCompilerProfile(item?.id);
      if (!['gcc', 'clang', 'cc', 'tcc'].includes(id)) return;
      profiles.push({
        id,
        label: getCCompilerProfileSelectLabel(id),
        command: String(item?.command || '').trim(),
        version: String(item?.version || '').trim()
      });
    });
    return profiles;
  }

  function getAvailableCppCompilerProfilesForSettings() {
    const discovery = getCppCompilerDiscoveryState();
    const profiles = [{ id: 'inbuilt', label: getCppCompilerProfileSelectLabel('inbuilt') }];
    const detected = Array.isArray(discovery.compilers) ? discovery.compilers : [];
    detected.forEach((item) => {
      const id = normalizeCoderCppCompilerProfile(item?.id);
      if (!['gxx', 'clangxx', 'cpp', 'clangcl', 'msvc'].includes(id)) return;
      profiles.push({
        id,
        label: getCppCompilerProfileSelectLabel(id),
        command: String(item?.command || '').trim(),
        version: String(item?.version || '').trim()
      });
    });
    return profiles;
  }

  function repopulateCCompilerSelect(preferredProfile) {
    const select = els['coder-settings-c-compiler'];
    if (!select) return 'inbuilt';
    const options = getAvailableCCompilerProfilesForSettings();
    const preferred = normalizeCoderCompilerProfile(preferredProfile || select.value || 'inbuilt');
    const selectedId = options.some((o) => o.id === preferred) ? preferred : 'inbuilt';
    const previousValue = String(select.value || '');
    select.innerHTML = options.map((opt) => `<option value="${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</option>`).join('');
    select.value = selectedId;
    if (select.value !== selectedId) select.value = 'inbuilt';
    if (previousValue && previousValue !== select.value) {
      // preserve user awareness when a previously saved compiler is no longer available
      // (e.g. PATH changed); we silently fall back to inbuilt in the UI.
    }
    return String(select.value || 'inbuilt');
  }

  function repopulateCppCompilerSelect(preferredProfile) {
    const select = els['coder-settings-cpp-compiler'];
    if (!select) return 'inbuilt';
    const options = getAvailableCppCompilerProfilesForSettings();
    const preferred = normalizeCoderCppCompilerProfile(preferredProfile || select.value || 'inbuilt');
    const selectedId = options.some((o) => o.id === preferred) ? preferred : 'inbuilt';
    const previousValue = String(select.value || '');
    select.innerHTML = options.map((opt) => `<option value="${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</option>`).join('');
    select.value = selectedId;
    if (select.value !== selectedId) select.value = 'inbuilt';
    if (previousValue && previousValue !== select.value) {
      // preserve user awareness when a previously saved compiler is no longer available
      // (e.g. PATH changed); we silently fall back to inbuilt in the UI.
    }
    return String(select.value || 'inbuilt');
  }

  function renderDetectedCCompilerUi() {
    const discovery = getCCompilerDiscoveryState();
    const statusEl = els['coder-settings-c-scan-status'];
    const chipRow = els['coder-settings-c-chip-row'];
    const rescanBtn = els['btn-coder-settings-rescan-compilers'];
    const detected = Array.isArray(discovery.compilers) ? discovery.compilers : [];

      if (statusEl) {
      statusEl.classList.remove('error', 'ok');
      let msg = 'Detecting installed compilers...';
      if (discovery.loading) {
        msg = 'Scanning device for installed compilers (PATH + common folders)...';
      } else if (discovery.error) {
        msg = `Compiler scan failed: ${String(discovery.error || '').trim() || 'unknown error'} (Inbuilt is still available)`;
        statusEl.classList.add('error');
      } else if (discovery.loaded && !detected.length) {
        msg = 'No system compiler detected on this device. Only Inbuilt is available.';
      } else if (detected.length) {
        msg = `Detected ${detected.length} compiler${detected.length === 1 ? '' : 's'} on this device.`;
        statusEl.classList.add('ok');
      }
      statusEl.textContent = msg;
    }

    if (rescanBtn) {
      rescanBtn.disabled = Boolean(discovery.loading);
      rescanBtn.textContent = discovery.loading ? 'Scanning...' : 'Rescan';
    }

    if (chipRow) {
      const chips = ['<span class="coder-settings-chip"><span class="k">Inbuilt</span><span class="v">Always available</span></span>'];
      detected.forEach((item) => {
        const label = getCCompilerProfileSelectLabel(item.id);
        const version = String(item.version || '').trim();
        chips.push(`
          <span class="coder-settings-chip" title="${escapeHtml(version || item.command || label)}">
            <span class="k">${escapeHtml(label)}</span>
            <span class="v">${escapeHtml(version || item.command || 'Detected')}</span>
          </span>
        `);
      });
      chipRow.innerHTML = chips.join('');
    }
  }

  function renderDetectedCppCompilerUi() {
    const discovery = getCppCompilerDiscoveryState();
    const statusEl = els['coder-settings-cpp-scan-status'];
    const chipRow = els['coder-settings-cpp-chip-row'];
    const rescanBtn = els['btn-coder-settings-rescan-cpp-compilers'];
    const detected = Array.isArray(discovery.compilers) ? discovery.compilers : [];

    if (statusEl) {
      statusEl.classList.remove('error', 'ok');
      let msg = 'Detecting installed C++ compilers...';
      if (discovery.loading) {
        msg = 'Scanning device for installed C++ compilers (PATH + common folders)...';
      } else if (discovery.error) {
        msg = `C++ compiler scan failed: ${String(discovery.error || '').trim() || 'unknown error'} (Inbuilt is still available)`;
        statusEl.classList.add('error');
      } else if (discovery.loaded && !detected.length) {
        msg = 'No system C++ compiler detected on this device. Only Inbuilt is available.';
      } else if (detected.length) {
        msg = `Detected ${detected.length} C++ compiler${detected.length === 1 ? '' : 's'} on this device.`;
        statusEl.classList.add('ok');
      }
      statusEl.textContent = msg;
    }

    if (rescanBtn) {
      rescanBtn.disabled = Boolean(discovery.loading);
      rescanBtn.textContent = discovery.loading ? 'Scanning...' : 'Rescan';
    }

    if (chipRow) {
      const chips = ['<span class="coder-settings-chip"><span class="k">Inbuilt</span><span class="v">Always available</span></span>'];
      detected.forEach((item) => {
        const label = getCppCompilerProfileSelectLabel(item.id);
        const version = String(item.version || '').trim();
        chips.push(`
          <span class="coder-settings-chip" title="${escapeHtml(version || item.command || label)}">
            <span class="k">${escapeHtml(label)}</span>
            <span class="v">${escapeHtml(version || item.command || 'Detected')}</span>
          </span>
        `);
      });
      chipRow.innerHTML = chips.join('');
    }
  }

  async function refreshDetectedCCompilers(options = {}) {
    const discovery = getCCompilerDiscoveryState();
    const force = options?.force === true;
    const now = Date.now();
    if (!force && discovery.loaded && !discovery.loading && (now - Number(discovery.lastScanAt || 0)) < 15000) {
      renderDetectedCCompilerUi();
      repopulateCCompilerSelect(getCoderSettings().cCompilerProfile);
      renderCoderSettingsPanel();
      return discovery.compilers;
    }

    discovery.loading = true;
    discovery.error = '';
    const reqId = (Number(discovery.requestSeq) || 0) + 1;
    discovery.requestSeq = reqId;
    renderDetectedCCompilerUi();
    repopulateCCompilerSelect(getCoderSettings().cCompilerProfile);
    renderCoderSettingsPanel();

    try {
      if (!api.run?.listCCompilers) throw new Error('Compiler scan API unavailable');
      const result = await api.run.listCCompilers();
      if (getCCompilerDiscoveryState().requestSeq !== reqId) return getCCompilerDiscoveryState().compilers;
      discovery.compilers = normalizeDetectedCCompilers(result?.compilers || []);
      discovery.loaded = true;
      discovery.loading = false;
      discovery.error = result?.success === false ? String(result?.error || 'scan failed') : '';
      discovery.lastScanAt = Date.now();
    } catch (error) {
      if (getCCompilerDiscoveryState().requestSeq !== reqId) return getCCompilerDiscoveryState().compilers;
      discovery.compilers = [];
      discovery.loaded = true;
      discovery.loading = false;
      discovery.error = String(error?.message || error || 'scan failed');
      discovery.lastScanAt = Date.now();
    }

    renderDetectedCCompilerUi();
    repopulateCCompilerSelect(getCoderSettings().cCompilerProfile);
    renderCoderSettingsPanel();
    return discovery.compilers;
  }

  async function refreshDetectedCppCompilers(options = {}) {
    const discovery = getCppCompilerDiscoveryState();
    const force = options?.force === true;
    const now = Date.now();
    if (!force && discovery.loaded && !discovery.loading && (now - Number(discovery.lastScanAt || 0)) < 15000) {
      renderDetectedCppCompilerUi();
      repopulateCppCompilerSelect(getCoderSettings().cppCompilerProfile);
      renderCoderSettingsPanel();
      return discovery.compilers;
    }

    discovery.loading = true;
    discovery.error = '';
    const reqId = (Number(discovery.requestSeq) || 0) + 1;
    discovery.requestSeq = reqId;
    renderDetectedCppCompilerUi();
    repopulateCppCompilerSelect(getCoderSettings().cppCompilerProfile);
    renderCoderSettingsPanel();

    try {
      if (!api.run?.listCppCompilers) throw new Error('C++ compiler scan API unavailable');
      const result = await api.run.listCppCompilers();
      if (getCppCompilerDiscoveryState().requestSeq !== reqId) return getCppCompilerDiscoveryState().compilers;
      discovery.compilers = normalizeDetectedCppCompilers(result?.compilers || []);
      discovery.loaded = true;
      discovery.loading = false;
      discovery.error = result?.success === false ? String(result?.error || 'scan failed') : '';
      discovery.lastScanAt = Date.now();
    } catch (error) {
      if (getCppCompilerDiscoveryState().requestSeq !== reqId) return getCppCompilerDiscoveryState().compilers;
      discovery.compilers = [];
      discovery.loaded = true;
      discovery.loading = false;
      discovery.error = String(error?.message || error || 'scan failed');
      discovery.lastScanAt = Date.now();
    }

    renderDetectedCppCompilerUi();
    repopulateCppCompilerSelect(getCoderSettings().cppCompilerProfile);
    renderCoderSettingsPanel();
    return discovery.compilers;
  }

  const els = {};

  document.addEventListener('DOMContentLoaded', () => {
    bindElements();
    injectRuntimeStyles();
    bindEvents();
    renderAll();
    void initExtensionsBridge();
    void restoreSession();
  });

  function bindElements() {
    const ids = [
      'workspace',
      'project-pill',
      'tree-wrap',
      'tree-empty',
      'tree-root',
      'explorer-panel-title',
      'explorer-actions',
      'panel-search',
      'panel-search-body',
      'panel-source',
      'panel-source-body',
      'panel-run',
      'panel-run-body',
      'panel-extensions',
      'panel-extensions-body',
      'panel-extension-view',
      'panel-extension-view-body',
      'tab-bar',
      'editor-empty',
      'editor-pane',
      'line-numbers',
      'code-stack',
      'code-highlight',
      'code-input',
      'extension-detail-view',
      'status-main',
      'status-file',
      'status-language',
      'status-cursor',
      'btn-open-folder',
      'btn-open-file',
      'btn-save',
      'btn-save-all',
      'btn-undo',
      'btn-terminal',
      'btn-run',
      'btn-toggle-ai',
      'btn-rail-explorer',
      'btn-rail-search',
      'btn-rail-source',
      'btn-rail-run-panel',
      'btn-rail-extensions-panel',
      'btn-rail-account',
      'btn-rail-settings-panel',
      'coder-settings-panel',
      'btn-coder-settings-close',
      'btn-coder-settings-cancel',
      'btn-coder-settings-save',
      'coder-settings-c-compiler',
      'coder-settings-c-scan-status',
      'coder-settings-c-chip-row',
      'btn-coder-settings-rescan-compilers',
      'coder-settings-c-custom-command',
      'coder-settings-c-custom-args',
      'coder-settings-c-custom-wrap',
      'coder-settings-cpp-compiler',
      'coder-settings-cpp-scan-status',
      'coder-settings-cpp-chip-row',
      'btn-coder-settings-rescan-cpp-compilers',
      'coder-settings-cpp-custom-command',
      'coder-settings-cpp-custom-args',
      'coder-settings-cpp-custom-wrap',
      'btn-ai-settings',
      'btn-ai-clear-chat',
      'btn-ai-close',
      'btn-ai-send',
      'btn-ai-approve',
      'btn-ai-reject',
      'btn-new-file',
      'btn-new-folder',
      'btn-rename-path',
      'btn-delete-path',
      'btn-refresh-tree',
      'btn-empty-open-folder',
      'btn-empty-open-file',
      'btn-win-min',
      'btn-win-max',
      'btn-win-close',
      'ai-sidebar',
      'side-resize-handle',
      'ai-resize-handle',
      'ai-settings-panel',
      'btn-ai-settings-close',
      'btn-ai-settings-cancel',
      'btn-ai-settings-save',
      'ai-settings-provider',
      'ai-settings-model',
      'ai-settings-key',
      'ai-settings-baseurl',
      'ai-chat',
      'ai-pending',
      'pending-meta',
      'pending-list',
      'ai-prompt',
      'ai-meta',
      'ai-log-list',
      'toast',
      'coder-terminal-panel',
      'coder-terminal-resize-handle',
      'btn-coder-tab-terminal',
      'btn-coder-tab-output',
      'btn-coder-terminal-clear',
      'btn-coder-terminal-close',
      'btn-coder-terminal-run',
      'coder-terminal-output',
      'coder-terminal-input',
      'coder-terminal-meta',
      'coder-terminal-shell-pill',
      'coder-terminal-input-row',
      'coder-output-panel',
      'coder-output-stdin',
      'coder-terminal-cwd',
      'coder-run-result-panel',
      'btn-coder-run-result-close',
      'btn-coder-run-result-dismiss',
      'btn-coder-run-result-rerun',
      'coder-run-result-title',
      'coder-run-result-meta',
      'coder-run-result-body',
      'coder-run-result-input',
      'coder-dialog',
      'coder-dialog-title',
      'coder-dialog-body',
      'coder-dialog-input',
      'btn-coder-dialog-cancel',
      'btn-coder-dialog-confirm'
    ];
    ids.forEach((id) => { els[id] = document.getElementById(id); });
  }

  function injectRuntimeStyles() {
    if (document.getElementById('coder-runtime-styles')) return;
    const style = document.createElement('style');
    style.id = 'coder-runtime-styles';
    style.textContent = `
      .rail-btn svg {
        width: 20px;
        height: 20px;
        display: block;
        pointer-events: none;
      }
      .rail-btn svg * {
        pointer-events: none;
      }
      .line-numbers .line.changed {
        background: rgba(40, 194, 255, 0.10);
        color: #ccefff;
        box-shadow: inset 2px 0 0 rgba(40, 194, 255, 0.45);
      }
      .line-numbers .line.diag-error,
      .line-numbers .line.diag-warning {
        position: relative;
        cursor: pointer;
      }
      .line-numbers .line.diag-error {
        color: #ffd4d4;
        box-shadow: inset 2px 0 0 rgba(255, 97, 97, 0.55);
        background: rgba(255, 97, 97, 0.07);
      }
      .line-numbers .line.diag-warning {
        color: #ffe7a8;
        box-shadow: inset 2px 0 0 rgba(255, 196, 87, 0.5);
        background: rgba(255, 196, 87, 0.06);
      }
      .line-numbers .line.diag-error::after,
      .line-numbers .line.diag-warning::after {
        content: '';
        position: absolute;
        right: 4px;
        top: 50%;
        width: 5px;
        height: 5px;
        transform: translateY(-50%);
        border-radius: 999px;
      }
      .line-numbers .line.diag-error::after {
        background: #ff6161;
        box-shadow: 0 0 0 2px rgba(255, 97, 97, 0.18);
      }
      .line-numbers .line.diag-warning::after {
        background: #ffc457;
        box-shadow: 0 0 0 2px rgba(255, 196, 87, 0.14);
      }
      .code-input::selection {
        background: rgba(86, 156, 214, 0.18) !important;
        color: transparent !important;
        -webkit-text-fill-color: transparent;
      }
      .code-input::-moz-selection {
        background: rgba(86, 156, 214, 0.18) !important;
        color: transparent !important;
      }
      .editor-diagnostics-panel {
        position: absolute;
        left: 12px;
        top: 12px;
        right: auto;
        bottom: auto;
        width: min(560px, calc(100% - 24px));
        max-width: calc(100% - 16px);
        z-index: 6;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        background: rgba(13, 15, 20, 0.92);
        box-shadow: 0 10px 28px rgba(0,0,0,0.25);
        backdrop-filter: blur(6px);
        overflow: hidden;
      }
      .editor-diagnostics-panel.dragging {
        box-shadow: 0 14px 34px rgba(0,0,0,0.34);
        border-color: rgba(66, 163, 255, 0.28);
      }
      .editor-diagnostics-panel.hidden {
        display: none !important;
      }
      .editor-diagnostics-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
        cursor: move;
        user-select: none;
      }
      .editor-diagnostics-head-right {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .editor-diagnostics-head-right[data-editor-diag-drag-handle] {
        flex: 1;
        min-width: 0;
      }
      .editor-diagnostics-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #e7eefc;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .editor-diagnostics-title .dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #ff6161;
        box-shadow: 0 0 0 2px rgba(255, 97, 97, 0.18);
      }
      .editor-diagnostics-title .dot.warning {
        background: #ffc457;
        box-shadow: 0 0 0 2px rgba(255, 196, 87, 0.14);
      }
      .editor-diagnostics-title .dot.ok {
        background: #4cd68a;
        box-shadow: 0 0 0 2px rgba(76, 214, 138, 0.14);
      }
      .editor-diagnostics-summary {
        color: #aeb9cc;
        font-size: 11px;
      }
      .editor-diagnostics-close {
        border: 1px solid rgba(255,255,255,0.09);
        background: rgba(255,255,255,0.02);
        color: #d9e4f6;
        min-width: 22px;
        height: 22px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
        padding: 0;
      }
      .editor-diagnostics-close:hover,
      .editor-diagnostics-close:focus-visible {
        outline: none;
        background: rgba(255,255,255,0.06);
      }
      .editor-diagnostics-list {
        display: grid;
        max-height: min(44vh, 300px);
        overflow: auto;
      }
      .editor-diagnostics-item {
        width: 100%;
        text-align: left;
        border: 0;
        border-top: 1px solid rgba(255,255,255,0.04);
        background: transparent;
        color: inherit;
        cursor: pointer;
        padding: 7px 10px 8px;
        display: grid;
        gap: 4px;
      }
      .editor-diagnostics-item:first-child {
        border-top: 0;
      }
      .editor-diagnostics-item:hover,
      .editor-diagnostics-item:focus-visible {
        outline: none;
        background: rgba(255,255,255,0.03);
      }
      .editor-diagnostics-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .editor-diagnostics-sev {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 700;
      }
      .editor-diagnostics-sev::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 999px;
      }
      .editor-diagnostics-sev.error { color: #ffd0d0; }
      .editor-diagnostics-sev.error::before { background: #ff6161; }
      .editor-diagnostics-sev.warning { color: #ffe0a3; }
      .editor-diagnostics-sev.warning::before { background: #ffc457; }
      .editor-diagnostics-loc {
        color: #9eb0cb;
        font-size: 10px;
        font-family: "JetBrains Mono", Consolas, monospace;
      }
      .editor-diagnostics-msg {
        color: #e1eafa;
        font-size: 12px;
        line-height: 1.25;
      }
      .editor-diagnostics-fix {
        color: #b5f0b3;
        font-size: 11px;
        line-height: 1.25;
      }
      .editor-diagnostics-empty {
        padding: 8px 10px;
        color: #9bb18b;
        font-size: 11px;
      }
      .tree-root-label {
        margin: 8px 8px 6px;
        padding: 7px 9px;
        border-radius: 9px;
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
        font-size: 10px;
        color: #d7e2f4;
        font-family: "JetBrains Mono", Consolas, monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tree-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }
      .tree-icon svg {
        width: 14px;
        height: 14px;
        display: block;
      }
      .editor-pane.image-preview-mode {
        grid-template-columns: 1fr !important;
      }
      .coder-image-preview {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        overflow: auto;
        background:
          radial-gradient(700px 260px at 20% -10%, rgba(10,132,255,0.08), transparent 60%),
          linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0));
      }
      .coder-image-preview.hidden {
        display: none !important;
      }
      .coder-image-preview-frame {
        display: grid;
        gap: 8px;
        justify-items: center;
        min-width: min-content;
      }
      .coder-image-preview img {
        display: block;
        max-width: min(100%, 2200px);
        max-height: min(100%, 2200px);
        object-fit: contain;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.08);
        background:
          linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.02) 75%),
          linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.02) 75%);
        background-position: 0 0, 8px 8px;
        background-size: 16px 16px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.35);
      }
      .coder-image-preview-meta {
        color: #b6c1d2;
        font-size: 11px;
        font-family: "JetBrains Mono", Consolas, monospace;
        text-align: center;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(0,0,0,0.25);
        border: 1px solid rgba(255,255,255,0.06);
      }
      .coder-image-preview-note {
        color: #ffb9b9;
        font-size: 12px;
      }
      .workspace.side-mode-explorer .explorer {
        display: grid !important;
      }
      .workspace.side-mode-search .explorer,
      .workspace.side-mode-source .explorer,
      .workspace.side-mode-run .explorer,
      .workspace.side-mode-extension .explorer,
      .workspace.side-mode-extensions .explorer {
        display: none !important;
      }
      .activity-panel {
        grid-column: 2;
        grid-row: 1;
        min-width: 0;
        display: none;
        grid-template-rows: auto 1fr;
        border-right: 1px solid #2a2a2a;
        background: #1f1f1f;
        overflow: hidden;
      }
      .workspace.side-mode-search .panel-search,
      .workspace.side-mode-source .panel-source,
      .workspace.side-mode-run .panel-run,
      .workspace.side-mode-extension .panel-extension-view,
      .workspace.side-mode-extensions .panel-extensions {
        display: grid;
      }
      .workspace.explorer-collapsed .activity-panel {
        display: none !important;
      }
      .workspace.ai-open .activity-panel {
        display: none !important;
      }
      .activity-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 8px 4px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.03);
      }
      .activity-panel-actions {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .activity-panel-actions .icon-btn.icon-only {
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 4px;
        border: 1px solid transparent;
        background: transparent;
        color: #d1d1d1;
        cursor: pointer;
      }
      .activity-panel-actions .icon-btn.icon-only:hover {
        background: #343438;
        color: #ffffff;
      }
      .activity-panel-actions .icon-btn.icon-only svg {
        width: 14px;
        height: 14px;
        pointer-events: none;
      }
      .activity-panel-actions .icon-btn.icon-only svg * {
        pointer-events: none;
      }
      .activity-rail .rail-btn.ext-contrib-btn img {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        object-fit: cover;
        display: block;
        pointer-events: none;
      }
      .activity-rail .rail-btn.ext-contrib-btn .ext-contrib-fallback {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
        color: #e6eef8;
        background: rgba(255,255,255,0.08);
        pointer-events: none;
      }
      .activity-panel-body {
        padding: 8px;
        overflow: auto;
      }
      #panel-extensions-body {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      #panel-extensions-body::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
      .side-panel-stack {
        display: grid;
        gap: 8px;
      }
      .side-panel-card {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        background: rgba(255,255,255,0.02);
        padding: 10px;
      }
      .side-panel-card h4 {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #d7e2f4;
        text-transform: uppercase;
      }
      .side-panel-card p {
        margin: 0;
        color: #aeb8c7;
        line-height: 1.4;
      }
      .side-tools {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .side-tool-btn {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: rgba(255,255,255,0.03);
        color: #dde7f4;
        padding: 6px 8px;
        font-size: 12px;
        cursor: pointer;
      }
      .side-tool-btn:hover {
        background: rgba(255,255,255,0.06);
      }
      .side-tool-btn.danger {
        color: #ffb9b9;
        border-color: rgba(255, 91, 91, 0.2);
      }
      .side-meta {
        font-size: 11px;
        color: #9aa6ba;
      }
      .search-panel {
        display: grid;
        gap: 8px;
      }
      .search-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .search-topbar .title {
        color: #dce7f6;
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .search-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      .search-icon-btn {
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
        color: #c8d4e6;
        border-radius: 7px;
        min-width: 28px;
        height: 26px;
        padding: 0 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        cursor: pointer;
        font-size: 11px;
        line-height: 1;
      }
      .search-icon-btn:hover {
        background: rgba(255,255,255,0.05);
      }
      .search-icon-btn.active {
        border-color: rgba(78, 167, 255, 0.35);
        background: rgba(78, 167, 255, 0.12);
        color: #e7f3ff;
      }
      .search-icon-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .search-query-shell {
        display: grid;
        gap: 6px;
      }
      .search-query-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
      }
      .search-collapse-btn {
        width: 26px;
        height: 26px;
        border-radius: 7px;
        border: 1px solid rgba(78, 167, 255, 0.35);
        background: rgba(78, 167, 255, 0.08);
        color: #d9ebff;
        display: grid;
        place-items: center;
        cursor: pointer;
        font-size: 10px;
      }
      .search-collapse-btn:hover {
        background: rgba(78, 167, 255, 0.14);
      }
      .search-input-wrap {
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: rgba(255,255,255,0.03);
        padding: 0 6px 0 8px;
      }
      .search-input-wrap:focus-within {
        border-color: rgba(78, 167, 255, 0.55);
        box-shadow: 0 0 0 1px rgba(78, 167, 255, 0.2);
      }
      .search-input {
        width: 100%;
        min-width: 0;
        border: 0;
        background: transparent;
        color: #eef3fb;
        padding: 7px 0;
        font-size: 12px;
        outline: none;
      }
      .search-input::placeholder {
        color: #8da0bc;
      }
      .search-input-tools {
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .search-toggle-btn {
        border: 0;
        background: transparent;
        color: #b0bfd5;
        padding: 3px 4px;
        min-width: 22px;
        height: 22px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 11px;
        line-height: 1;
      }
      .search-toggle-btn:hover {
        background: rgba(255,255,255,0.05);
        color: #dbe7f7;
      }
      .search-toggle-btn.active {
        background: rgba(78, 167, 255, 0.14);
        color: #e9f5ff;
        box-shadow: inset 0 0 0 1px rgba(78, 167, 255, 0.24);
      }
      .search-run-btn {
        height: 26px;
        min-width: 54px;
      }
      .search-replace-row {
        display: grid;
        grid-template-columns: 26px minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
      }
      .search-replace-row.hidden {
        display: none;
      }
      .search-replace-placeholder {
        width: 26px;
      }
      .search-filter-grid {
        display: grid;
        gap: 6px;
      }
      .search-filter-field {
        display: grid;
        gap: 4px;
      }
      .search-filter-field label {
        color: #aebbd0;
        font-size: 10px;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      .search-filter-field input {
        width: 100%;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: rgba(255,255,255,0.03);
        color: #e6eef8;
        padding: 7px 8px;
        font-size: 12px;
        outline: none;
      }
      .search-filter-field input:focus {
        border-color: rgba(78, 167, 255, 0.5);
        box-shadow: 0 0 0 1px rgba(78, 167, 255, 0.2);
      }
      .search-summary-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }
      .search-summary-main {
        color: #d7e2f4;
        font-size: 11px;
      }
      .search-summary-main .muted {
        color: #97a8c1;
      }
      .search-summary-flags {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .search-chip {
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.02);
        color: #b9c7da;
        border-radius: 999px;
        padding: 3px 7px;
        font-size: 10px;
        line-height: 1;
      }
      .search-chip.warn {
        color: #ffdfac;
        border-color: rgba(255, 180, 79, 0.18);
        background: rgba(255, 180, 79, 0.07);
      }
      .search-chip.error {
        color: #ffcbcb;
        border-color: rgba(255, 91, 91, 0.2);
        background: rgba(255, 91, 91, 0.07);
      }
      .search-results {
        display: grid;
        gap: 8px;
      }
      .search-results-loading {
        color: #c6d4e8;
        font-size: 12px;
      }
      .search-empty {
        color: #aeb9ca;
        font-size: 12px;
        line-height: 1.45;
      }
      .search-file-group {
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        background: rgba(255,255,255,0.015);
        overflow: hidden;
      }
      .search-file-group.collapsed .search-match-list {
        display: none;
      }
      .search-file-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        padding: 6px 6px 4px;
      }
      .search-file-head-main {
        width: 100%;
        border: 0;
        background: transparent;
        color: inherit;
        padding: 2px 3px;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        text-align: left;
        cursor: pointer;
        border-radius: 7px;
      }
      .search-file-head-main:hover {
        background: rgba(255,255,255,0.025);
      }
      .search-file-head-main:focus-visible {
        outline: 1px solid rgba(78, 167, 255, 0.4);
        outline-offset: -1px;
      }
      .search-file-chevron {
        color: #96aacc;
        font-size: 10px;
      }
      .search-file-main {
        min-width: 0;
      }
      .search-file-name {
        color: #e5edf9;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .search-file-path {
        margin-top: 2px;
        color: #8da1bc;
        font-size: 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .search-file-count {
        color: #c8d6ea;
        font-size: 10px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 999px;
        padding: 2px 6px;
      }
      .search-file-open {
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
        color: #c8d4e7;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 10px;
        cursor: pointer;
        align-self: center;
      }
      .search-file-open:hover {
        background: rgba(255,255,255,0.05);
      }
      .search-match-list {
        border-top: 1px solid rgba(255,255,255,0.04);
        padding: 4px;
        display: grid;
        gap: 3px;
      }
      .search-match-row {
        width: 100%;
        border: 0;
        background: transparent;
        color: inherit;
        border-radius: 7px;
        padding: 6px 7px;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        text-align: left;
        cursor: pointer;
      }
      .search-match-row:hover {
        background: rgba(255,255,255,0.03);
      }
      .search-match-row:focus-visible {
        outline: 1px solid rgba(78, 167, 255, 0.4);
        outline-offset: -1px;
      }
      .search-match-line {
        color: #9ab0ce;
        font-size: 10px;
        min-width: 28px;
        text-align: right;
      }
      .search-match-col {
        color: #869ab5;
        font-size: 10px;
        min-width: 32px;
        text-align: right;
      }
      .search-match-snippet {
        min-width: 0;
        color: #d3dfef;
        font-size: 11px;
        font-family: "JetBrains Mono", Consolas, monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .search-match-snippet .dim {
        color: #9baec8;
      }
      .search-match-snippet mark {
        background: rgba(255, 201, 61, 0.23);
        color: #fff2bf;
        border-radius: 3px;
        padding: 0 1px;
      }
      .search-result-more {
        margin: 2px 6px 4px 42px;
        color: #94a7c4;
        font-size: 10px;
      }
      .search-result-more button {
        border: 0;
        background: transparent;
        color: #b8d4ff;
        cursor: pointer;
        padding: 0;
        font-size: 10px;
      }
      .search-error-box {
        border: 1px solid rgba(255, 91, 91, 0.16);
        background: rgba(255, 91, 91, 0.06);
        color: #ffd0d0;
        border-radius: 8px;
        padding: 8px;
        font-size: 11px;
        line-height: 1.4;
      }
      @media (max-width: 380px) {
        .search-file-head {
          grid-template-columns: minmax(0, 1fr);
        }
        .search-file-open {
          display: none;
        }
      }
      .side-tool-btn.primary {
        border-color: rgba(0, 120, 212, 0.85);
        background: #0e639c;
        color: #ffffff;
      }
      .side-tool-btn.primary:hover {
        background: #1177bb;
      }
      .run-panel {
        display: grid;
        gap: 8px;
      }
      .run-hero-card {
        background:
          linear-gradient(180deg, rgba(14,99,156,0.12), rgba(14,99,156,0.02) 40%, rgba(255,255,255,0.015)),
          rgba(255,255,255,0.02);
      }
      .run-hero-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .run-hero-title {
        margin: 0;
        color: #eef4fe;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.2;
      }
      .run-hero-sub {
        margin-top: 4px;
        color: #a9bbd6;
        font-size: 11px;
        line-height: 1.35;
      }
      .run-badge {
        flex: 0 0 auto;
        font-size: 10px;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 999px;
        border: 1px solid rgba(78, 167, 255, 0.28);
        color: #d8ebff;
        background: rgba(78, 167, 255, 0.12);
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .run-badge.warn {
        border-color: rgba(255, 170, 79, 0.28);
        color: #ffe1b0;
        background: rgba(255, 170, 79, 0.10);
      }
      .run-badge.muted {
        border-color: rgba(255,255,255,0.10);
        color: #c7d1df;
        background: rgba(255,255,255,0.03);
      }
      .run-field-label {
        display: block;
        margin: 0 0 5px;
        color: #b9c7da;
        font-size: 11px;
        letter-spacing: 0.03em;
      }
      .run-launch-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
      }
      .run-select,
      .run-option-select {
        width: 100%;
        min-width: 0;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: rgba(255,255,255,0.035);
        color: #e6eef8;
        padding: 7px 9px;
        font-size: 12px;
        outline: none;
      }
      .run-select:focus,
      .run-option-select:focus {
        border-color: rgba(64, 156, 255, 0.9);
        box-shadow: 0 0 0 1px rgba(64, 156, 255, 0.25);
      }
      .run-launch-row .side-tool-btn {
        min-width: 104px;
      }
      .run-quick-actions {
        margin-top: 8px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .run-quick-actions .side-tool-btn {
        justify-content: center;
      }
      .run-options-grid {
        margin-top: 8px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px 8px;
        align-items: center;
      }
      .run-check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #c3d0e3;
        min-width: 0;
      }
      .run-check input {
        margin: 0;
        accent-color: #0e639c;
      }
      .run-option-field {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .run-option-field label {
        font-size: 11px;
        color: #b9c7da;
      }
      .run-option-field .run-option-select {
        padding: 5px 8px;
        font-size: 11px;
        border-radius: 7px;
      }
      .run-last-action {
        margin-top: 8px;
        padding: 7px 8px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
        color: #cbd8ea;
        font-size: 11px;
        line-height: 1.35;
      }
      .run-last-action.success {
        border-color: rgba(93, 214, 135, 0.18);
        background: rgba(93, 214, 135, 0.06);
        color: #c8f2d7;
      }
      .run-last-action.warn {
        border-color: rgba(255, 180, 79, 0.18);
        background: rgba(255, 180, 79, 0.05);
        color: #ffe2b2;
      }
      .run-last-action.error {
        border-color: rgba(255, 91, 91, 0.18);
        background: rgba(255, 91, 91, 0.06);
        color: #ffc7c7;
      }
      .run-group {
        padding: 0;
        overflow: hidden;
      }
      .run-group-head {
        margin: 0;
      }
      .run-group-toggle {
        width: 100%;
        border: 0;
        background: transparent;
        color: inherit;
        padding: 9px 10px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 8px;
        align-items: center;
        text-align: left;
        cursor: pointer;
      }
      .run-group-toggle:hover {
        background: rgba(255,255,255,0.03);
      }
      .run-group-toggle:focus-visible {
        outline: 1px solid rgba(78, 167, 255, 0.5);
        outline-offset: -1px;
      }
      .run-group-chevron {
        color: #9ab2d2;
        font-size: 10px;
      }
      .run-group-title {
        min-width: 0;
      }
      .run-group-name {
        color: #dce7f6;
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .run-group-meta {
        margin-top: 2px;
        color: #8ea0ba;
        font-size: 10px;
        line-height: 1.25;
      }
      .run-group-count {
        color: #93a7c4;
        font-size: 10px;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 999px;
        padding: 2px 6px;
      }
      .run-group-body {
        border-top: 1px solid rgba(255,255,255,0.05);
        padding: 8px 10px 10px;
        display: grid;
        gap: 6px;
      }
      .run-group.collapsed .run-group-body {
        display: none;
      }
      .run-kv {
        display: grid;
        gap: 6px;
      }
      .run-kv-row {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px;
        align-items: center;
        border: 1px solid rgba(255,255,255,0.04);
        border-radius: 8px;
        background: rgba(255,255,255,0.015);
        padding: 6px 7px;
        min-width: 0;
      }
      .run-kv-tag {
        font-size: 10px;
        line-height: 1;
        padding: 3px 5px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        color: #bdd0ea;
        background: rgba(255,255,255,0.03);
        white-space: nowrap;
      }
      .run-kv-value {
        min-width: 0;
        color: #d4e0ef;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .run-kv-value code {
        font-family: "JetBrains Mono", Consolas, monospace;
        color: #c7dbf9;
        font-size: 11px;
      }
      .run-empty-note {
        margin: 0;
        color: #aeb9ca;
        font-size: 11px;
        line-height: 1.4;
      }
      .run-section-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 2px;
      }
      .run-compact-list {
        display: grid;
        gap: 4px;
      }
      .run-compact-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border: 1px solid rgba(255,255,255,0.04);
        border-radius: 8px;
        background: rgba(255,255,255,0.015);
        padding: 5px 7px;
        min-width: 0;
      }
      .run-compact-row .label {
        color: #d6e0ef;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .run-compact-row .value {
        color: #97a9c4;
        font-size: 10px;
        white-space: nowrap;
      }
      .run-muted-inline {
        color: #8da0bc;
        font-size: 11px;
      }
      @media (max-width: 360px) {
        .run-quick-actions,
        .run-options-grid {
          grid-template-columns: 1fr;
        }
      }
      .sc-grid {
        display: grid;
        gap: 8px;
      }
      .sc-fields {
        display: grid;
        gap: 8px;
      }
      .sc-field {
        display: grid;
        gap: 4px;
      }
      .sc-field label {
        font-size: 11px;
        color: #b8c4d8;
      }
      .sc-field input,
      .sc-field textarea {
        width: 100%;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: rgba(255,255,255,0.03);
        color: #e5edf8;
        padding: 7px 8px;
        font-size: 12px;
        outline: none;
      }
      .sc-field input:focus,
      .sc-field textarea:focus {
        border-color: rgba(78, 167, 255, 0.5);
        box-shadow: 0 0 0 1px rgba(78, 167, 255, 0.25);
      }
      .sc-field textarea {
        min-height: 58px;
        resize: vertical;
      }
      .sc-stat-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .sc-stat-chip {
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px;
        background: rgba(255,255,255,0.02);
        padding: 6px 8px;
        display: grid;
        gap: 2px;
      }
      .sc-stat-chip .k {
        font-size: 10px;
        color: #9aa6ba;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .sc-stat-chip .v {
        font-size: 12px;
        color: #e4edf9;
        font-family: "JetBrains Mono", Consolas, monospace;
      }
      .sc-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .sc-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        color: #d9e2f2;
        background: rgba(255,255,255,0.03);
      }
      .sc-badge.warn {
        color: #ffd89a;
        border-color: rgba(255, 193, 81, 0.25);
        background: rgba(255, 193, 81, 0.08);
      }
      .sc-badge.error {
        color: #ffb9b9;
        border-color: rgba(255, 91, 91, 0.2);
        background: rgba(255, 91, 91, 0.08);
      }
      .sc-step-list {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 6px;
      }
      .sc-step-list li {
        color: #c8d3e5;
        line-height: 1.35;
      }
      .sc-step-list li.done {
        color: #9fd7b4;
      }
      .sc-step-list li code {
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
      }
      .sc-change-list {
        display: grid;
        gap: 4px;
        max-height: 220px;
        overflow: auto;
      }
      .sc-change-row {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px;
        align-items: center;
        border: 1px solid rgba(255,255,255,0.04);
        border-radius: 8px;
        background: rgba(255,255,255,0.015);
        padding: 5px 7px;
      }
      .sc-change-row code {
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
        color: #bfd3ef;
      }
      .sc-change-row .path {
        min-width: 0;
        color: #d5dfef;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-output {
        margin: 0;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(0,0,0,0.2);
        color: #d5e0f2;
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 220px;
        overflow: auto;
      }
      .ext-list {
        display: grid;
        gap: 6px;
      }
      .ext-item {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        background: rgba(255,255,255,0.02);
        padding: 10px;
        display: grid;
        gap: 8px;
      }
      .ext-item .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .ext-item .title {
        min-width: 0;
        font-weight: 600;
        color: #eaf0fa;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ext-item .sub {
        font-size: 11px;
        color: #9aa6ba;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ext-badge {
        font-size: 9px;
        line-height: 1;
        padding: 2px 5px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.08);
        color: #d9e2f2;
        background: rgba(255,255,255,0.03);
      }
      .ext-badge.off {
        color: #cdb8b8;
        border-color: rgba(255, 113, 113, 0.18);
        background: rgba(255, 91, 91, 0.08);
      }
      .cmd-list {
        display: grid;
        gap: 6px;
      }
      .cmd-item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 6px;
        align-items: center;
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px;
        background: rgba(255,255,255,0.015);
        padding: 6px 8px;
      }
      .cmd-item code {
        color: #cfd9ea;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ext-market-search {
        display: grid;
        gap: 8px;
      }
      .ext-market-search .search-box {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: center;
      }
      .ext-market-search input {
        width: 100%;
        min-width: 0;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: rgba(255,255,255,0.035);
        color: #e6eef8;
        padding: 8px 10px;
        outline: none;
      }
      .ext-market-search input:focus {
        border-color: rgba(64, 156, 255, 0.9);
        box-shadow: 0 0 0 1px rgba(64, 156, 255, 0.25);
      }
      .ext-market-list {
        display: grid;
        gap: 6px;
      }
      .ext-market-item {
        display: grid;
        grid-template-columns: 34px minmax(0,1fr);
        gap: 7px;
        align-items: start;
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 7px;
        background: rgba(255,255,255,0.015);
        padding: 5px 6px;
        cursor: pointer;
        transition: border-color 120ms ease, background-color 120ms ease;
      }
      .ext-market-item:hover {
        border-color: rgba(78, 167, 255, 0.22);
        background: rgba(78, 167, 255, 0.04);
      }
      .ext-market-item:focus-visible {
        outline: none;
        border-color: rgba(78, 167, 255, 0.45);
        box-shadow: 0 0 0 1px rgba(78, 167, 255, 0.2);
        background: rgba(78, 167, 255, 0.06);
      }
      .ext-market-item img,
      .ext-market-item .icon-fallback {
        width: 28px;
        height: 28px;
        border-radius: 5px;
        background: #16181d;
        border: 1px solid rgba(255,255,255,0.06);
        object-fit: cover;
      }
      .ext-market-item .icon-fallback {
        display: grid;
        place-items: center;
        color: #b6c2d8;
        font-size: 9px;
        font-weight: 700;
      }
      .ext-market-item .main {
        min-width: 0;
        display: grid;
        gap: 0;
      }
      .ext-market-item .name {
        color: #eaf0fa;
        font-weight: 600;
        font-size: 11px;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ext-market-item .desc {
        color: #b7c0cf;
        font-size: 10px;
        line-height: 1.2;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ext-market-item .publisher {
        color: #8fa4c5;
        font-size: 9px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ext-market-item .sub {
        color: #90a3c1;
        font-size: 9px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: "JetBrains Mono", Consolas, monospace;
      }
      .ext-market-item .meta {
        color: #9aa6ba;
        font-size: 9px;
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .ext-market-item .meta span {
        display: inline-flex;
        align-items: center;
        padding: 0 4px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
      }
      .tab.special-tab .tab-name {
        max-width: 240px;
      }
      .ext-installed-item .row-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 4px;
      }
      .ext-installed-item .row-top .name {
        min-width: 0;
        flex: 1 1 auto;
      }
      .ext-installed-item .row-top .ext-badge {
        flex: 0 0 auto;
      }
      .ext-installed-item .status-note {
        color: #d0b070;
        font-size: 9px;
        line-height: 1.2;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ext-installed-item .error-note {
        color: #ffb2b2;
        font-size: 9px;
        line-height: 1.2;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ext-installed-item .installed-meta {
        color: #9aa6ba;
        font-size: 9px;
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .ext-market-install {
        border: 1px solid rgba(0, 120, 212, 0.8);
        background: #0e639c;
        color: #ffffff;
        border-radius: 6px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 12px;
        min-width: 64px;
      }
      .ext-market-install:hover {
        background: #1177bb;
      }
      .ext-market-install:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .ext-market-open {
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.02);
        color: #dbe5f5;
        border-radius: 6px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 11px;
      }
      .ext-market-open:hover {
        background: rgba(255,255,255,0.05);
      }
      .ext-market-empty {
        color: #aeb9ca;
        font-size: 12px;
        line-height: 1.4;
      }
      .ext-contrib-panel {
        display: grid;
        gap: 8px;
      }
      .ext-contrib-view-list {
        display: grid;
        gap: 6px;
      }
      .ext-contrib-view-item {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        background: rgba(255,255,255,0.02);
        padding: 8px;
      }
      .ext-contrib-view-item .name {
        color: #e8eef9;
        font-size: 12px;
        font-weight: 600;
      }
      .ext-contrib-view-item .meta {
        margin-top: 4px;
        color: #9fb0c8;
        font-size: 11px;
        font-family: "JetBrains Mono", Consolas, monospace;
      }
      .extension-detail-pane {
        display: grid;
        grid-template-rows: 1fr;
        grid-template-columns: minmax(0, 1fr) !important;
        overflow: hidden;
        background: #1e1e1e;
      }
      .ext-detail-scroll {
        overflow: auto;
        min-height: 0;
      }
      .ext-detail-wrap {
        padding: 18px 22px 56px;
        display: grid;
        gap: 16px;
      }
      .ext-detail-hero {
        display: grid;
        grid-template-columns: 112px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      .ext-detail-icon,
      .ext-detail-icon-fallback {
        width: 112px;
        height: 112px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08);
        background: #141414;
        object-fit: cover;
      }
      .ext-detail-icon-fallback {
        display: grid;
        place-items: center;
        color: #e6eefb;
        font-size: 42px;
        font-weight: 700;
      }
      .ext-detail-title {
        margin: 0;
        font-size: 16px;
        line-height: 1.25;
        color: #f3f5fb;
      }
      .ext-detail-publisher {
        margin-top: 6px;
        color: #aeb8c7;
        font-size: 13px;
      }
      .ext-detail-desc {
        margin-top: 10px;
        color: #d3dbea;
        line-height: 1.45;
        font-size: 13px;
      }
      .ext-detail-meta {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ext-detail-meta span {
        font-size: 11px;
        color: #c8d2e3;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 999px;
        padding: 4px 8px;
        background: rgba(255,255,255,0.02);
      }
      .ext-detail-actions {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ext-detail-actions .ext-market-install {
        height: auto;
        padding: 7px 12px;
      }
      .ext-detail-main {
        display: grid;
        gap: 10px;
        align-content: start;
      }
      .ext-detail-tabs {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        padding-bottom: 4px;
      }
      .ext-detail-tab {
        border: 0;
        background: transparent;
        color: #aebbd1;
        padding: 8px 10px;
        border-radius: 7px;
        cursor: pointer;
        font-size: 12px;
        line-height: 1;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ext-detail-tab:hover {
        background: rgba(255,255,255,0.04);
        color: #dce7f7;
      }
      .ext-detail-tab.active {
        color: #eef5ff;
        background: rgba(78, 167, 255, 0.12);
        box-shadow: inset 0 0 0 1px rgba(78, 167, 255, 0.28);
      }
      .ext-detail-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 240px;
        gap: 14px;
        align-items: start;
      }
      .ext-detail-side-stack {
        display: grid;
        gap: 12px;
        align-content: start;
        margin-top: 8px;
        padding-bottom: 10px;
      }
      .ext-detail-card {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        background: rgba(255,255,255,0.02);
        padding: 12px;
      }
      .ext-detail-card h4 {
        margin: 0 0 10px;
        color: #e6eefb;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .ext-detail-card p {
        margin: 0;
        color: #b8c3d6;
        line-height: 1.5;
        font-size: 12px;
      }
      .ext-detail-props {
        display: grid;
        gap: 8px;
      }
      .ext-detail-prop {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        font-size: 12px;
      }
      .ext-detail-prop .k {
        color: #90a0b8;
      }
      .ext-detail-prop .v {
        color: #dbe6f7;
        word-break: break-word;
      }
      .ext-detail-prop .v code {
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
      }
      .ext-detail-empty {
        height: 100%;
        display: grid;
        place-items: center;
        color: #a8b5c8;
        padding: 20px;
        text-align: center;
      }
      .ext-feature-layout {
        display: grid;
        grid-template-columns: 264px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }
      .ext-feature-nav {
        display: grid;
        gap: 4px;
        align-content: start;
        border-right: 1px solid rgba(255,255,255,0.06);
        padding-right: 8px;
      }
      .ext-feature-nav-item {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        text-align: left;
        border: 1px solid transparent;
        background: transparent;
        color: #c0ccdf;
        border-radius: 8px;
        padding: 7px 10px;
        cursor: pointer;
        font-size: 12px;
      }
      .ext-feature-nav-item:hover {
        background: rgba(255,255,255,0.03);
        color: #e8f0fb;
      }
      .ext-feature-nav-item.active {
        background: rgba(14, 119, 214, 0.28);
        border-color: rgba(78, 167, 255, 0.38);
        color: #eff6ff;
      }
      .ext-feature-nav-count {
        color: #cfe3ff;
        font-size: 11px;
        border-radius: 999px;
        padding: 1px 7px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        min-width: 24px;
        text-align: center;
      }
      .ext-feature-nav-item.active .ext-feature-nav-count {
        background: rgba(255,255,255,0.12);
        border-color: rgba(255,255,255,0.16);
      }
      .ext-feature-content {
        min-width: 0;
      }
      .ext-feature-section {
        display: grid;
        gap: 10px;
      }
      .ext-feature-section h3 {
        margin: 0;
        color: #edf4ff;
        font-size: 17px;
        line-height: 1.25;
      }
      .ext-feature-empty {
        margin: 0;
        color: #aebbd0;
        font-size: 12px;
      }
      .ext-feature-dim {
        color: #9cabc0;
      }
      .ext-feature-kv-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .ext-feature-kv {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        background: rgba(255,255,255,0.02);
        padding: 9px 10px;
        display: grid;
        gap: 4px;
      }
      .ext-feature-kv .k {
        color: #92a3bb;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .ext-feature-kv .v {
        color: #e2ecfa;
        font-size: 12px;
        word-break: break-word;
      }
      .ext-feature-callout {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 10px 12px;
        line-height: 1.45;
        font-size: 12px;
        color: #dce7f6;
        background: rgba(255,255,255,0.02);
      }
      .ext-feature-callout.info {
        border-color: rgba(78, 167, 255, 0.22);
        background: rgba(78, 167, 255, 0.06);
      }
      .ext-feature-callout.warn {
        border-color: rgba(255, 192, 86, 0.28);
        background: rgba(255, 192, 86, 0.06);
        color: #ffe6b4;
      }
      .ext-feature-callout.error {
        border-color: rgba(255, 107, 107, 0.28);
        background: rgba(255, 107, 107, 0.06);
        color: #ffd0d0;
      }
      .ext-feature-callout code {
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
      }
      .ext-feature-block {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        background: rgba(255,255,255,0.02);
        padding: 10px;
        display: grid;
        gap: 8px;
      }
      .ext-feature-block-title {
        color: #dce6f6;
        font-size: 12px;
        font-weight: 600;
      }
      .ext-feature-chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .ext-feature-bullet-list {
        margin: 0;
        padding-left: 16px;
        color: #d6e0f0;
        display: grid;
        gap: 6px;
      }
      .ext-feature-bullet-list code {
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
      }
      .ext-feature-inline-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .ext-feature-inline-tags code {
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 6px;
        padding: 2px 5px;
      }
      .ext-feature-table-wrap {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        overflow: auto;
        background: rgba(255,255,255,0.015);
      }
      .ext-feature-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 560px;
      }
      .ext-feature-table th,
      .ext-feature-table td {
        padding: 9px 10px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 12px;
        color: #d8e3f4;
      }
      .ext-feature-table th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #26292f;
        color: #e7effc;
        font-weight: 600;
      }
      .ext-feature-table tbody tr:hover td {
        background: rgba(255,255,255,0.02);
      }
      .ext-feature-table td code {
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 11px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 6px;
        padding: 1px 4px;
      }
      .ext-readme {
        color: #c7d3e8;
        line-height: 1.6;
        font-size: 13px;
      }
      .ext-readme h1, .ext-readme h2, .ext-readme h3, .ext-readme h4 {
        margin: 18px 0 8px;
        color: #eef3fc;
        line-height: 1.25;
      }
      .ext-readme h1 { font-size: 24px; }
      .ext-readme h2 { font-size: 20px; }
      .ext-readme h3 { font-size: 16px; }
      .ext-readme h4 { font-size: 14px; }
      .ext-readme p {
        margin: 8px 0;
        overflow-wrap: anywhere;
      }
      .ext-readme p[align="center"] {
        text-align: center;
      }
      .ext-readme ul {
        margin: 8px 0 8px 18px;
        padding: 0;
      }
      .ext-readme ol {
        margin: 8px 0 8px 18px;
        padding: 0;
      }
      .ext-readme li {
        margin: 3px 0;
      }
      .ext-readme blockquote {
        margin: 10px 0;
        padding: 8px 12px;
        border-left: 3px solid rgba(78, 167, 255, 0.45);
        background: rgba(78, 167, 255, 0.06);
        color: #d6e4fb;
        border-radius: 0 8px 8px 0;
      }
      .ext-readme code {
        font-family: "JetBrains Mono", Consolas, monospace;
        font-size: 12px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 6px;
        padding: 1px 5px;
      }
      .ext-readme pre {
        margin: 10px 0;
        background: #15171c;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 10px;
        padding: 10px 12px;
        overflow: auto;
      }
      .ext-readme pre code {
        background: transparent;
        border: 0;
        border-radius: 0;
        padding: 0;
        display: block;
        white-space: pre;
      }
      .ext-readme a {
        color: #4ea7ff;
        text-decoration: none;
      }
      .ext-readme a:hover {
        text-decoration: underline;
      }
      .ext-readme img {
        max-width: 100%;
        height: auto;
        vertical-align: middle;
        border-radius: 8px;
      }
      .ext-readme p a > img {
        display: inline-block;
        margin: 2px 4px 4px 0;
      }
      .ext-readme p[align="center"] a > img {
        margin-left: 4px;
        margin-right: 4px;
      }
      .ext-readme a > img + img {
        margin-left: 4px;
      }
      .ext-readme table {
        width: max-content;
        min-width: 100%;
        max-width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        display: block;
        overflow: auto;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        background: rgba(255,255,255,0.02);
      }
      .ext-readme thead {
        background: rgba(255,255,255,0.03);
      }
      .ext-readme th,
      .ext-readme td {
        border: 1px solid rgba(255,255,255,0.06);
        padding: 7px 9px;
        text-align: left;
        vertical-align: top;
        font-size: 12px;
        line-height: 1.35;
      }
      .ext-readme th {
        color: #eaf1fe;
        font-weight: 600;
      }
      .ext-readme td {
        color: #cbd7ea;
      }
      .ext-readme td img,
      .ext-readme th img {
        max-width: min(220px, 100%);
      }
      .ext-readme hr {
        border: 0;
        border-top: 1px solid rgba(255,255,255,0.08);
        margin: 14px 0;
      }
      @media (max-width: 1180px) {
        .ext-detail-grid {
          grid-template-columns: 1fr;
        }
        .ext-detail-side-stack {
          margin-top: 14px;
        }
        .ext-feature-layout {
          grid-template-columns: 1fr;
        }
        .ext-feature-nav {
          border-right: 0;
          padding-right: 0;
          grid-auto-flow: row;
        }
      }
      @media (max-width: 900px) {
        .ext-feature-kv-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function bindEvents() {
    onClick('btn-open-folder', openFolderViaDialog);
    onClick('btn-empty-open-folder', openFolderViaDialog);
    onClick('btn-open-file', openFileViaDialog);
    onClick('btn-empty-open-file', openFileViaDialog);
    onClick('btn-save', () => void saveActiveFile());
    onClick('btn-save-all', () => void saveAllFiles());
    onClick('btn-undo', () => executeEditorCommand('undo'));
    onClick('btn-terminal', () => void openCoderTerminalPanel());
    onClick('btn-run', () => void runActiveFile());
    onClick('btn-toggle-ai', () => toggleAiSidebar());
    onClick('btn-rail-explorer', () => toggleExplorerPane());
    onClick('btn-rail-search', () => openSidePanelMode('search'));
    onClick('btn-rail-source', () => openSidePanelMode('source'));
    onClick('btn-rail-run-panel', () => openSidePanelMode('run'));
    onClick('btn-rail-extensions-panel', () => void openExtensionsPanel());
    onClick('btn-rail-account', () => showToast('Account panel is not implemented in Coder yet', 'warn'));
    onClick('btn-rail-settings-panel', () => void openCoderSettingsPanel());
    onClick('btn-coder-settings-close', () => toggleCoderSettingsPanel(false));
    onClick('btn-coder-settings-cancel', () => toggleCoderSettingsPanel(false));
    onClick('btn-coder-settings-save', () => saveCoderSettingsPanel());
    onClick('btn-coder-settings-rescan-compilers', () => void refreshDetectedCCompilers({ force: true }));
    onClick('btn-coder-settings-rescan-cpp-compilers', () => void refreshDetectedCppCompilers({ force: true }));
    onClick('btn-ai-settings', () => void openAiSettingsPanel());
    onClick('btn-ai-clear-chat', () => clearAiChatMessages());
    onClick('btn-ai-close', () => toggleAiSidebar(false));
    onClick('btn-ai-settings-close', () => toggleAiSettingsPanel(false));
    onClick('btn-ai-settings-cancel', () => toggleAiSettingsPanel(false));
    onClick('btn-ai-settings-save', () => void saveAiSettingsPanel());
    onClick('btn-ai-send', () => void generateAiEdits());
    onClick('btn-ai-approve', () => void approvePendingAiChanges());
    onClick('btn-ai-reject', rejectPendingAiChanges);
    onClick('btn-new-file', () => void createFileFromExplorer());
    onClick('btn-new-folder', () => void createFolderFromExplorer());
    onClick('btn-rename-path', () => void renameSelectedPath());
    onClick('btn-delete-path', () => void deleteSelectedPath());
    onClick('btn-refresh-tree', () => void refreshTree());
    onClick('btn-coder-dialog-cancel', () => closeCoderDialog({ confirmed: false }));
    onClick('btn-coder-dialog-confirm', () => closeCoderDialog({ confirmed: true }));
    onClick('btn-coder-terminal-clear', clearCoderTerminalOutput);
    onClick('btn-coder-terminal-close', () => void handleCoderTerminalCloseAction());
    onClick('btn-coder-terminal-run', () => void runCoderTerminalFromInput());
    onClick('btn-coder-tab-terminal', () => setCoderTerminalActiveTab('terminal'));
    onClick('btn-coder-tab-output', () => setCoderTerminalActiveTab('output'));
    onClick('btn-coder-run-result-close', () => toggleCoderRunResultPanel(false));
    onClick('btn-coder-run-result-dismiss', () => toggleCoderRunResultPanel(false));
    onClick('btn-coder-run-result-rerun', () => void rerunCoderCRunFromResultPanel());
    els['side-resize-handle']?.addEventListener('pointerdown', startSidePanelResize);
    els['ai-resize-handle']?.addEventListener('pointerdown', startAiSidebarResize);
    els['coder-terminal-resize-handle']?.addEventListener('pointerdown', startCoderTerminalResize);

    onClick('btn-win-min', () => api.window?.minimize?.());
    onClick('btn-win-max', () => api.window?.toggleMaximize?.());
    onClick('btn-win-close', () => {
      if (hasDirtyFiles() && !window.confirm('You have unsaved changes. Close Coder anyway?')) return;
      api.window?.close?.();
    });

    els['tree-root']?.addEventListener('click', (event) => void handleTreeClick(event));
    els['tree-root']?.addEventListener('dblclick', (event) => void handleTreeDoubleClick(event));
    els['tab-bar']?.addEventListener('click', (event) => handleTabBarClick(event));
    els['line-numbers']?.addEventListener('click', (event) => handleLineNumbersClick(event));
    els['code-stack']?.addEventListener('click', (event) => handleEditorDiagnosticsClick(event));
    els['code-stack']?.addEventListener('pointerdown', (event) => handleEditorDiagnosticsPointerDown(event));

    els['code-input']?.addEventListener('input', onCodeInput);
    els['code-input']?.addEventListener('scroll', syncEditorScroll);
    els['code-input']?.addEventListener('click', updateCursorStatus);
    els['code-input']?.addEventListener('keyup', updateCursorStatus);
    els['code-input']?.addEventListener('mouseup', updateCursorStatus);
    els['code-input']?.addEventListener('keydown', handleEditorKeydown);

    els['ai-prompt']?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (event.isComposing) return;
      if (event.shiftKey) return; // allow multi-line input with Shift+Enter
      event.preventDefault();
      void generateAiEdits();
    });

    els['ai-sidebar']?.addEventListener('click', (event) => {
      const promptBtn = event.target.closest('[data-ai-prompt]');
      if (promptBtn) {
        const promptText = String(promptBtn.dataset.aiPrompt || '').trim();
        if (els['ai-prompt'] && promptText) {
          els['ai-prompt'].value = promptText;
          toggleAiSidebar(true);
          els['ai-prompt'].focus();
          els['ai-prompt'].setSelectionRange(els['ai-prompt'].value.length, els['ai-prompt'].value.length);
        }
        return;
      }

      const actionBtn = event.target.closest('[data-ai-action]');
      if (!actionBtn) return;
      const action = String(actionBtn.dataset.aiAction || '');

      if (action === 'focus-prompt') {
        toggleAiSidebar(true);
        els['ai-prompt']?.focus();
        return;
      }

      if (action === 'new-chat') {
        if (els['ai-chat']) els['ai-chat'].innerHTML = '';
        if (state.pendingAiBatch) {
          state.pendingAiBatch = null;
          renderPendingAi();
        }
        setMainStatus('Ready');
        showToast('Started a new AI chat', 'success');
      }
    });

    els['coder-dialog-input']?.addEventListener('input', syncCoderDialogConfirmState);
    els['coder-dialog-input']?.addEventListener('keydown', handleCoderDialogInputKeydown);
    els['coder-terminal-input']?.addEventListener('keydown', (event) => void handleCoderTerminalInputKeydown(event));
    els['coder-run-result-input']?.addEventListener('keydown', (event) => void handleCoderRunResultInputKeydown(event));
    els['coder-run-result-input']?.addEventListener('input', () => {
      const panel = getCoderRunResultPanelState();
      panel.inputText = String(els['coder-run-result-input']?.value || '');
    });
    if (!state.coderTerminalEventUnsub && api.terminal?.onEvent) {
      state.coderTerminalEventUnsub = api.terminal.onEvent((payload) => {
        void handleCoderTerminalRuntimeEvent(payload);
      });
    }
    els['coder-output-stdin']?.addEventListener('keydown', (event) => void handleCoderOutputStdinKeydown(event));
    els['coder-output-stdin']?.addEventListener('input', () => syncCoderRunResultInputDraft());
    els['coder-settings-c-compiler']?.addEventListener('change', () => renderCoderSettingsPanel());
    els['coder-settings-cpp-compiler']?.addEventListener('change', () => renderCoderSettingsPanel());
    els['coder-terminal-panel']?.addEventListener('click', (event) => {
      if (!event.target.closest('.coder-terminal-card')) {
        toggleCoderTerminalPanel(false);
      }
    });
    els['coder-run-result-panel']?.addEventListener('click', (event) => {
      if (!event.target.closest('.coder-run-result-card')) {
        toggleCoderRunResultPanel(false);
      }
    });
    els['coder-settings-panel']?.addEventListener('click', (event) => {
      if (!event.target.closest('.coder-settings-card')) {
        toggleCoderSettingsPanel(false);
      }
    });
    els['coder-dialog']?.addEventListener('click', (event) => {
      if (!event.target.closest('.coder-dialog-card')) {
        closeCoderDialog({ confirmed: false });
      }
    });

    els['workspace']?.addEventListener('click', (event) => void handleSidePanelClick(event));
    els['workspace']?.addEventListener('input', (event) => handleSidePanelInput(event));
    els['workspace']?.addEventListener('keydown', (event) => void handleSidePanelKeydown(event));
    updateExplorerActionButtons();
    bindDragScrollHandlers();

    window.addEventListener('keydown', handleGlobalShortcuts);
    window.addEventListener('resize', () => {
      renderWorkspaceLayout();
      applyCoderTerminalPanelHeight();
    });
    window.addEventListener('pointermove', (event) => handleEditorDiagnosticsPointerMove(event), true);
    window.addEventListener('pointerup', (event) => handleEditorDiagnosticsPointerUp(event), true);
    window.addEventListener('pointercancel', (event) => handleEditorDiagnosticsPointerUp(event), true);
    document.addEventListener('pointerdown', (event) => handleEditorDiagnosticsOutsidePointerDown(event), true);
    window.addEventListener('beforeunload', (event) => {
      saveSession();
      if (!hasDirtyFiles()) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  function onClick(id, fn) {
    els[id]?.addEventListener('click', fn);
  }

  function bindDragScrollHandlers() {
    if (window.__coderDragScrollBound) return;
    window.__coderDragScrollBound = true;
    document.addEventListener('pointerdown', onDragScrollPointerDown, true);
    window.addEventListener('pointermove', onDragScrollPointerMove, true);
    window.addEventListener('pointerup', onDragScrollPointerEnd, true);
    window.addEventListener('pointercancel', onDragScrollPointerEnd, true);
    document.addEventListener('click', onDragScrollCaptureClick, true);
  }

  function dragScrollSelectors() {
    return [
      '.tree-wrap',
      '.tabs',
      '.activity-panel-body',
      '.sc-change-list',
      '.sc-output',
      '.coder-image-preview',
      '.ext-detail-scroll',
      '.ext-readme pre',
      '.ai-chat',
      '.ai-preview-code',
      '.diff-block pre'
    ].join(', ');
  }

  function getDragScrollContainer(target) {
    const start = target instanceof Element ? target : target?.parentElement;
    if (!start || typeof start.closest !== 'function') return null;
    // Do not hijack clicks from interactive cards/buttons (extension items are div[role=button]).
    if (start.closest('input, textarea, select, option, button, a, [contenteditable="true"], .tab-close, [data-side-action], [data-ext-detail-action], [role="button"]')) return null;
    const container = start.closest(dragScrollSelectors());
    if (!container) return null;
    const canScrollX = (Number(container.scrollWidth) - Number(container.clientWidth)) > 1;
    const canScrollY = (Number(container.scrollHeight) - Number(container.clientHeight)) > 1;
    if (!canScrollX && !canScrollY) return null;
    return container;
  }

  function onDragScrollPointerDown(event) {
    if (event.defaultPrevented) return;
    if (state.sideResize || state.aiResize) return;
    if (Number(event.button) !== 0) return;
    const container = getDragScrollContainer(event.target);
    if (!container) return;
    state.dragScroll = {
      pointerId: event.pointerId,
      container,
      startX: Number(event.clientX || 0),
      startY: Number(event.clientY || 0),
      scrollLeft: Number(container.scrollLeft || 0),
      scrollTop: Number(container.scrollTop || 0),
      moved: false
    };
    container.classList.add('drag-scroll-active');
    try { container.setPointerCapture?.(event.pointerId); } catch (_) {}
  }

  function onDragScrollPointerMove(event) {
    const drag = state.dragScroll;
    if (!drag) return;
    if (drag.pointerId !== event.pointerId) return;
    const container = drag.container;
    if (!(container instanceof Element)) {
      state.dragScroll = null;
      return;
    }
    const dx = Number(event.clientX || 0) - drag.startX;
    const dy = Number(event.clientY || 0) - drag.startY;
    if (!drag.moved && (Math.abs(dx) + Math.abs(dy)) < 4) return;
    drag.moved = true;
    container.scrollLeft = drag.scrollLeft - dx;
    container.scrollTop = drag.scrollTop - dy;
    try { event.preventDefault(); } catch (_) {}
  }

  function onDragScrollPointerEnd(event) {
    const drag = state.dragScroll;
    if (!drag) return;
    if (event?.pointerId !== undefined && drag.pointerId !== event.pointerId) return;
    try { drag.container?.classList?.remove('drag-scroll-active'); } catch (_) {}
    if (drag.moved) {
      state.dragScrollSuppressClickUntil = Date.now() + 120;
    }
    state.dragScroll = null;
  }

  function onDragScrollCaptureClick(event) {
    const until = Number(state.dragScrollSuppressClickUntil) || 0;
    if (!until) return;
    if (Date.now() > until) {
      state.dragScrollSuppressClickUntil = 0;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    state.dragScrollSuppressClickUntil = 0;
  }

  function renderAll() {
    renderProjectPill();
    renderWorkspaceLayout();
    renderSidePanelMode();
    renderTree();
    renderTabs();
    renderEditorShell();
    renderCoderTerminalPanel();
    renderCoderRunResultPanel();
    renderCoderSettingsPanel();
    renderAiSidebar();
    renderPendingAi();
    renderAiLog();
    updateExplorerActionButtons();
    setMainStatus('Ready');
  }

  function openSidePanelMode(mode) {
    const next = String(mode || '').trim() || 'explorer';
    if (state.sidePanelMode === next) {
      state.explorerOpen = state.explorerOpen === false;
      renderSidePanelMode();
      renderWorkspaceLayout();
      if (next === 'search' && state.explorerOpen !== false) queueMicrotask(() => focusSearchPanelQueryInput(false));
      if (next === 'source' && state.explorerOpen !== false) void refreshSourceControlState({ silent: true });
      scheduleSessionSave();
      return;
    }
    state.sidePanelMode = next;
    state.explorerOpen = true;
    renderSidePanelMode();
    renderWorkspaceLayout();
    if (next === 'search') queueMicrotask(() => focusSearchPanelQueryInput(false));
    if (next === 'source') void refreshSourceControlState({ silent: true });
    scheduleSessionSave();
  }

  async function openExtensionsPanel() {
    const willToggleClosed = state.sidePanelMode === 'extensions' && state.explorerOpen !== false;
    if (!willToggleClosed) {
      clearTimeout(state.marketplaceSearchTimer);
      state.marketplaceRequestSeq = (Number(state.marketplaceRequestSeq) || 0) + 1; // cancel in-flight responses
      state.marketplaceQuery = '';
      state.marketplaceQueryInput = '';
      state.marketplaceResults = [];
      state.marketplaceTotal = 0;
      state.marketplaceLoading = false;
      state.marketplaceError = '';
      state.marketplaceSearched = false;
    }
    openSidePanelMode('extensions');
    if (willToggleClosed || state.explorerOpen === false) return;
    await refreshExtensionsBridgeState({ silent: true });
    renderSidePanelMode();
    queueMicrotask(() => focusExtensionsMarketplaceQueryInput(false));
  }

  function renderSidePanelMode() {
    const mode = state.sidePanelMode || 'explorer';
    const extSearchFocusSnapshot = captureExtensionsSearchFocusState(mode);
    const workspaceEl = els['workspace'];
    if (workspaceEl) {
      workspaceEl.classList.remove(
        'side-mode-explorer',
        'side-mode-search',
        'side-mode-source',
        'side-mode-run',
        'side-mode-extensions',
        'side-mode-extension'
      );
      workspaceEl.classList.add(`side-mode-${mode}`);
    }

    if (mode === 'search' && els['panel-search-body']) {
      els['panel-search-body'].innerHTML = renderSearchPanelHtml();
      const sp = ensureSearchPanelState();
      if (sp.query.trim() && !sp.loading && !sp.searched) {
        void runSearchPanelQuery({ source: 'open-panel' });
      }
    }
    if (mode === 'source' && els['panel-source-body']) {
      els['panel-source-body'].innerHTML = renderSourceControlPanelHtml();
    }
    if (mode === 'run' && els['panel-run-body']) {
      els['panel-run-body'].innerHTML = renderRunPanelHtml();
    }
    if (mode === 'extensions' && els['panel-extensions-body']) {
      els['panel-extensions-body'].innerHTML = renderExtensionsPanelHtml();
      restoreExtensionsSearchFocusState(extSearchFocusSnapshot);
    }
    if (mode === 'extension' && els['panel-extension-view-body']) {
      els['panel-extension-view-body'].innerHTML = renderExtensionContribPanelHtml();
    }

    renderRailButtons();
  }

  function captureExtensionsSearchFocusState(mode) {
    if (mode !== 'extensions') return null;
    const input = document.getElementById('ext-marketplace-query');
    if (!input || document.activeElement !== input) return null;
    return {
      value: String(input.value || ''),
      start: Number.isFinite(input.selectionStart) ? input.selectionStart : null,
      end: Number.isFinite(input.selectionEnd) ? input.selectionEnd : null,
      direction: input.selectionDirection || 'none',
      scrollLeft: Number(input.scrollLeft || 0)
    };
  }

  function restoreExtensionsSearchFocusState(snapshot) {
    if (!snapshot) return;
    const input = document.getElementById('ext-marketplace-query');
    if (!input) return;
    if (typeof snapshot.value === 'string' && input.value !== snapshot.value) {
      input.value = snapshot.value;
    }
    try {
      input.focus({ preventScroll: true });
    } catch (_) {
      input.focus();
    }
    if (typeof snapshot.start === 'number' && typeof snapshot.end === 'number') {
      try {
        input.setSelectionRange(snapshot.start, snapshot.end, snapshot.direction || 'none');
      } catch (_) {
        // ignore
      }
    }
    if (typeof snapshot.scrollLeft === 'number') {
      input.scrollLeft = snapshot.scrollLeft;
    }
  }

  function renderRailButtons() {
    const mode = state.sidePanelMode || 'explorer';
    const map = {
      explorer: els['btn-rail-explorer'],
      search: els['btn-rail-search'],
      source: els['btn-rail-source'],
      run: els['btn-rail-run-panel'],
      extensions: els['btn-rail-extensions-panel'],
      extension: els['btn-rail-extensions-panel']
    };
    Object.values(map).forEach((btn) => btn?.classList.remove('active'));
    els['btn-rail-settings-panel']?.classList.remove('active');
    if (state.explorerOpen !== false && map[mode]) {
      map[mode].classList.add('active');
    } else if (state.explorerOpen !== false && map['explorer']) {
      map['explorer'].classList.add('active');
    }
    els['btn-rail-settings-panel']?.classList.toggle('active', Boolean(state.coderSettingsOpen));
    if (els['btn-rail-explorer']) {
      els['btn-rail-explorer'].setAttribute('aria-pressed', (state.explorerOpen !== false && mode === 'explorer') ? 'true' : 'false');
    }
  }

  function renderExtensionRailButtons() {
    const rail = document.querySelector('.activity-rail');
    const spacer = rail?.querySelector('.rail-spacer');
    if (!rail || !spacer) return;
    rail.querySelectorAll('.rail-btn.ext-contrib-btn').forEach((node) => node.remove());

    const items = Array.isArray(state.extensionActivityItems) ? state.extensionActivityItems : [];
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rail-btn ext-contrib-btn';
      btn.dataset.extRailId = item.id;
      btn.title = item.title || item.containerId || item.extensionId || 'Extension';
      btn.setAttribute('aria-label', item.title || item.containerId || item.extensionId || 'Extension');
      if (state.explorerOpen !== false && state.sidePanelMode === 'extension' && state.activeExtensionActivityId === item.id) {
        btn.classList.add('active');
      }

      if (item.iconUrl) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.src = item.iconUrl;
        img.onerror = () => {
          const fallback = document.createElement('span');
          fallback.className = 'ext-contrib-fallback';
          fallback.textContent = String((item.title || item.containerId || item.extensionId || 'E')[0] || 'E').toUpperCase();
          img.replaceWith(fallback);
        };
        btn.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'ext-contrib-fallback';
        fallback.textContent = String((item.title || item.containerId || item.extensionId || 'E')[0] || 'E').toUpperCase();
        btn.appendChild(fallback);
      }

      btn.addEventListener('click', async () => {
        try {
          const containerId = String(item.containerId || '').trim();
          if (containerId && typeof api.extensions?.activateActivityContainer === 'function') {
            await api.extensions.activateActivityContainer(containerId);
          }
          openExtensionContribPanel(item.id);
        } catch (error) {
          console.error('[Coder][Extension Rail] Button click failed:', error);
        }
      });

      rail.insertBefore(btn, spacer);
    }
  }

  function getActiveExtensionActivityItem() {
    const id = String(state.activeExtensionActivityId || '').trim();
    if (!id) return null;
    const items = Array.isArray(state.extensionActivityItems) ? state.extensionActivityItems : [];
    return items.find((item) => item.id === id) || null;
  }

  function openExtensionContribPanel(itemId) {
    const id = String(itemId || '').trim();
    const item = (Array.isArray(state.extensionActivityItems) ? state.extensionActivityItems : []).find((x) => x.id === id);
    if (!item) return;
    state.activeExtensionActivityId = id;
    state.sidePanelMode = 'extension';
    state.explorerOpen = true;
    renderSidePanelMode();
    renderWorkspaceLayout();
    scheduleSessionSave();
  }

  function renderExtensionContribPanelHtml() {
    const item = getActiveExtensionActivityItem();
    if (!item) {
      return `
        <div class="ext-contrib-panel">
          <div class="side-panel-card">
            <p>Select an extension activity icon to open its contributed view.</p>
          </div>
        </div>
      `;
    }

    const ext = (Array.isArray(state.extensionCatalog) ? state.extensionCatalog : []).find((x) => String(x.id || '') === item.extensionId);
    const views = Array.isArray(item.views) ? item.views : [];
    return `
      <div class="ext-contrib-panel">
        <div class="side-panel-card">
          <h4>${escapeHtml(item.title || 'Extension View')}</h4>
          <p>Coder detected this VS Code activity-bar contribution from <strong>${escapeHtml(ext?.displayName || item.extensionId)}</strong>.</p>
          <p style="margin-top:8px;">This panel is a compatibility placeholder while workbench/webview APIs are being added step by step.</p>
          <div class="side-tools" style="margin-top:10px;">
            <button class="side-tool-btn" data-side-action="open-extensions-panel">Open Extensions</button>
            <button class="side-tool-btn" data-side-action="extensions-installed-details" data-extension-id="${escapeHtml(item.extensionId)}">Extension Details</button>
          </div>
        </div>
        <div class="side-panel-card">
          <h4>Contributed Views</h4>
          ${views.length ? `<div class="ext-contrib-view-list">${views.map((view) => `
            <div class="ext-contrib-view-item">
              <div class="name">${escapeHtml(view.name || view.id || 'View')}</div>
              <div class="meta">${escapeHtml(view.id || '')}</div>
            </div>
          `).join('')}</div>` : '<p>No view metadata available.</p>'}
        </div>
        <div class="side-panel-card">
          <h4>Compatibility</h4>
          <p>Needed APIs still in progress: webview views/panels, auth/session integration, terminals, and more workbench APIs.</p>
        </div>
      </div>
    `;
  }

  function ensureSearchPanelState() {
    if (!state.searchPanel || typeof state.searchPanel !== 'object') state.searchPanel = {};
    const sp = state.searchPanel;
    sp.query = String(sp.query || '');
    sp.replaceQuery = String(sp.replaceQuery || '');
    sp.showReplace = Boolean(sp.showReplace);
    sp.includePattern = String(sp.includePattern || '');
    sp.excludePattern = String(sp.excludePattern || '');
    sp.matchCase = Boolean(sp.matchCase);
    sp.wholeWord = Boolean(sp.wholeWord);
    sp.useRegex = Boolean(sp.useRegex);
    sp.loading = Boolean(sp.loading);
    sp.searched = Boolean(sp.searched);
    sp.requestSeq = Number(sp.requestSeq) || 0;
    sp.searchTimer = sp.searchTimer || null;
    sp.error = String(sp.error || '');
    sp.results = Array.isArray(sp.results) ? sp.results : [];
    sp.collapsedFiles = (sp.collapsedFiles && typeof sp.collapsedFiles === 'object') ? sp.collapsedFiles : {};
    const summary = (sp.summary && typeof sp.summary === 'object') ? sp.summary : {};
    sp.summary = {
      filesScanned: Number(summary.filesScanned) || 0,
      filesConsidered: Number(summary.filesConsidered) || 0,
      filesMatched: Number(summary.filesMatched) || 0,
      totalMatches: Number(summary.totalMatches) || 0,
      durationMs: Number(summary.durationMs) || 0,
      limitedByFileCap: Boolean(summary.limitedByFileCap),
      limitedByMatchCap: Boolean(summary.limitedByMatchCap),
      skippedBinary: Number(summary.skippedBinary) || 0,
      skippedLarge: Number(summary.skippedLarge) || 0
    };
    return sp;
  }

  function captureSearchPanelFocusState() {
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement)) return null;
    const allowed = new Set(['search-query-input', 'search-replace-input', 'search-include-input', 'search-exclude-input']);
    if (!allowed.has(active.id)) return null;
    return {
      id: active.id,
      value: String(active.value || ''),
      start: Number.isFinite(active.selectionStart) ? active.selectionStart : null,
      end: Number.isFinite(active.selectionEnd) ? active.selectionEnd : null,
      direction: active.selectionDirection || 'none',
      scrollLeft: Number(active.scrollLeft || 0)
    };
  }

  function restoreSearchPanelFocusState(snapshot) {
    if (!snapshot || !snapshot.id) return;
    const input = document.getElementById(snapshot.id);
    if (!(input instanceof HTMLInputElement)) return;
    try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    if (typeof snapshot.start === 'number' && typeof snapshot.end === 'number') {
      try { input.setSelectionRange(snapshot.start, snapshot.end, snapshot.direction || 'none'); } catch (_) {}
    }
    if (typeof snapshot.scrollLeft === 'number') input.scrollLeft = snapshot.scrollLeft;
  }

  function focusSearchPanelQueryInput(selectAll = false) {
    const input = document.getElementById('search-query-input');
    if (!(input instanceof HTMLInputElement)) return;
    try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    if (selectAll) {
      try { input.setSelectionRange(0, input.value.length); } catch (_) {}
    } else {
      try {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      } catch (_) {}
    }
  }

  function focusExtensionsMarketplaceQueryInput(selectAll = false) {
    const input = document.getElementById('ext-marketplace-query');
    if (!(input instanceof HTMLInputElement)) return;
    try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    if (selectAll) {
      try { input.setSelectionRange(0, input.value.length); } catch (_) {}
    } else {
      try {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      } catch (_) {}
    }
  }

  function renderSearchPanelIfVisible() {
    if (state.sidePanelMode !== 'search' || !els['panel-search-body']) return;
    const focusSnapshot = captureSearchPanelFocusState();
    els['panel-search-body'].innerHTML = renderSearchPanelHtml();
    restoreSearchPanelFocusState(focusSnapshot);
  }

  function resetSearchPanelResults(options = {}) {
    const sp = ensureSearchPanelState();
    clearTimeout(sp.searchTimer);
    sp.searchTimer = null;
    sp.requestSeq = (Number(sp.requestSeq) || 0) + 1; // cancel in-flight async search loops
    sp.loading = false;
    sp.searched = false;
    sp.error = '';
    sp.results = [];
    sp.collapsedFiles = {};
    sp.summary = {
      filesScanned: 0,
      filesConsidered: 0,
      filesMatched: 0,
      totalMatches: 0,
      durationMs: 0,
      limitedByFileCap: false,
      limitedByMatchCap: false,
      skippedBinary: 0,
      skippedLarge: 0
    };
    if (options.preserveQuery === false) {
      sp.query = '';
      sp.replaceQuery = '';
      sp.includePattern = '';
      sp.excludePattern = '';
    }
  }

  function scheduleSearchPanelRun(options = {}) {
    const sp = ensureSearchPanelState();
    clearTimeout(sp.searchTimer);
    const immediate = options.immediate === true;
    const delay = immediate ? 0 : (Number(options.delayMs) || 260);
    const q = String(sp.query || '').trim();
    if (!q) {
      resetSearchPanelResults({ preserveQuery: true });
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      return;
    }
    sp.searchTimer = setTimeout(() => {
      void runSearchPanelQuery({ source: options.source || 'input' });
    }, delay);
  }

  function escapeRegexForSearch(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isSearchWordChar(ch) {
    return /^[A-Za-z0-9_]$/.test(String(ch || ''));
  }

  function isWholeWordSearchMatch(text, start, end) {
    const s = String(text || '');
    const before = start > 0 ? s[start - 1] : '';
    const after = end < s.length ? s[end] : '';
    return !isSearchWordChar(before) && !isSearchWordChar(after);
  }

  function buildSearchPanelRegex(searchState) {
    const sp = searchState || ensureSearchPanelState();
    const rawQuery = String(sp.query || '');
    if (!rawQuery.trim()) return { regex: null, error: '' };
    const source = sp.useRegex ? rawQuery : escapeRegexForSearch(rawQuery);
    const flags = `g${sp.matchCase ? '' : 'i'}`;
    try {
      return { regex: new RegExp(source, flags), error: '' };
    } catch (error) {
      return { regex: null, error: error?.message || String(error) };
    }
  }

  function compileSearchFilterPatterns(rawValue) {
    const tokens = String(rawValue || '')
      .split(/[\n,;]+/)
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    return tokens.map((pattern) => {
      const normalized = pattern.replace(/\\/g, '/');
      const wildcard = /[*?]/.test(normalized);
      const hasSlash = normalized.includes('/');
      let regex = null;
      if (wildcard) {
        try {
          regex = globPatternToSearchRegex(normalized);
        } catch (_) {
          regex = null;
        }
      }
      return { raw: pattern, pattern: normalized, wildcard, hasSlash, regex };
    });
  }

  function globPatternToSearchRegex(pattern) {
    const raw = String(pattern || '').trim().replace(/\\/g, '/');
    let out = '';
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === '*') {
        if (raw[i + 1] === '*') {
          out += '.*';
          i += 1;
        } else {
          out += '[^/]*';
        }
        continue;
      }
      if (ch === '?') {
        out += '[^/]';
        continue;
      }
      out += escapeRegexForSearch(ch);
    }
    return new RegExp(`^${out}$`, 'i');
  }

  function searchPathMatchesPattern(relPath, basename, compiled) {
    if (!compiled) return false;
    const target = compiled.hasSlash ? String(relPath || '') : String(basename || '');
    if (compiled.wildcard && compiled.regex) {
      return compiled.regex.test(target);
    }
    return target.toLowerCase().includes(String(compiled.pattern || '').toLowerCase());
  }

  function searchPathPassesFilters(relPath, includePatterns, excludePatterns) {
    const normalizedRel = String(relPath || '').replace(/\\/g, '/');
    const base = basenamePath(normalizedRel).toLowerCase();

    if (Array.isArray(includePatterns) && includePatterns.length) {
      const included = includePatterns.some((compiled) => searchPathMatchesPattern(normalizedRel.toLowerCase(), base, compiled));
      if (!included) return false;
    }

    if (Array.isArray(excludePatterns) && excludePatterns.length) {
      const excluded = excludePatterns.some((compiled) => searchPathMatchesPattern(normalizedRel.toLowerCase(), base, compiled));
      if (excluded) return false;
    }

    return true;
  }

  function buildSearchMatchSnippet(lineText, matchStartInLine, matchEndInLine, maxLen = 140) {
    const line = String(lineText || '').replace(/\t/g, '  ');
    let start = Math.max(0, Number(matchStartInLine) || 0);
    let end = Math.max(start, Number(matchEndInLine) || start);
    if (line.length <= maxLen) {
      return {
        prefixEllipsis: false,
        suffixEllipsis: false,
        before: line.slice(0, start),
        match: line.slice(start, end),
        after: line.slice(end)
      };
    }

    const matchLen = Math.max(1, end - start);
    const idealLeft = Math.max(0, start - Math.floor((maxLen - matchLen) * 0.45));
    let sliceStart = idealLeft;
    let sliceEnd = Math.min(line.length, sliceStart + maxLen);
    if ((sliceEnd - sliceStart) < maxLen) sliceStart = Math.max(0, sliceEnd - maxLen);
    if (start < sliceStart) sliceStart = start;
    if (end > sliceEnd) {
      sliceEnd = end;
      sliceStart = Math.max(0, sliceEnd - maxLen);
    }

    const localStart = Math.max(0, start - sliceStart);
    const localEnd = Math.max(localStart, end - sliceStart);
    const sliced = line.slice(sliceStart, sliceEnd);
    return {
      prefixEllipsis: sliceStart > 0,
      suffixEllipsis: sliceEnd < line.length,
      before: sliced.slice(0, localStart),
      match: sliced.slice(localStart, localEnd),
      after: sliced.slice(localEnd)
    };
  }

  function collectSearchPanelMatchesForFile(content, regex, options = {}) {
    const text = String(content ?? '');
    const wholeWord = options.wholeWord === true;
    const maxMatches = Math.max(1, Number(options.maxMatches) || 80);
    const out = [];
    const re = new RegExp(regex.source, regex.flags);
    re.lastIndex = 0;

    while (out.length < maxMatches) {
      const match = re.exec(text);
      if (!match) break;
      const start = Number(match.index) || 0;
      const value = String(match[0] ?? '');
      const end = start + value.length;

      if (value.length === 0) {
        re.lastIndex = start + 1;
        continue;
      }

      if (wholeWord && !isWholeWordSearchMatch(text, start, end)) {
        if (re.lastIndex <= start) re.lastIndex = end;
        continue;
      }

      const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      let lineEnd = text.indexOf('\n', end);
      if (lineEnd < 0) lineEnd = text.length;
      const rawLine = text.slice(lineStart, lineEnd).replace(/\r/g, '');
      const lineLoc = lineColFromOffset(text, start);
      const matchStartInLine = Math.max(0, start - lineStart);
      const matchEndInLine = Math.max(matchStartInLine + 1, end - lineStart);
      const snippet = buildSearchMatchSnippet(rawLine, matchStartInLine, matchEndInLine, 150);

      out.push({
        start,
        end,
        line: lineLoc.line,
        col: lineLoc.col,
        before: snippet.before,
        match: snippet.match || value,
        after: snippet.after,
        prefixEllipsis: snippet.prefixEllipsis,
        suffixEllipsis: snippet.suffixEllipsis
      });

      if (re.lastIndex <= start) re.lastIndex = end;
    }

    return out;
  }

  function renderSearchPanelSummaryHtml(sp) {
    const summary = sp.summary || {};
    const q = String(sp.query || '').trim();
    if (!q) {
      return `
        <div class="search-summary-row">
          <div class="search-summary-main"><span class="muted">Type to search across the workspace</span></div>
          <div class="search-summary-flags"></div>
        </div>
      `;
    }
    const mainBits = [];
    if (sp.loading) {
      mainBits.push('Searching...');
    } else if (sp.error) {
      mainBits.push('Search error');
    } else if (sp.searched) {
      mainBits.push(`${summary.totalMatches || 0} result${(summary.totalMatches || 0) === 1 ? '' : 's'} in ${summary.filesMatched || 0} file${(summary.filesMatched || 0) === 1 ? '' : 's'}`);
      mainBits.push(`<span class="muted">${summary.filesConsidered || 0}/${summary.filesScanned || 0} files scanned</span>`);
      if (summary.durationMs) mainBits.push(`<span class="muted">${Math.max(1, Math.round(summary.durationMs))} ms</span>`);
    } else {
      mainBits.push('<span class="muted">Press Enter to search</span>');
    }

    const flags = [];
    if (summary.limitedByFileCap) flags.push('<span class="search-chip warn">file cap</span>');
    if (summary.limitedByMatchCap) flags.push('<span class="search-chip warn">match cap</span>');
    if (summary.skippedBinary) flags.push(`<span class="search-chip">binary ${escapeHtml(String(summary.skippedBinary))}</span>`);
    if (summary.skippedLarge) flags.push(`<span class="search-chip">large ${escapeHtml(String(summary.skippedLarge))}</span>`);
    if (sp.error) flags.push('<span class="search-chip error">invalid pattern</span>');

    return `
      <div class="search-summary-row">
        <div class="search-summary-main">${mainBits.join(' • ')}</div>
        <div class="search-summary-flags">${flags.join('')}</div>
      </div>
    `;
  }

  function renderSearchPanelResultsHtml(sp) {
    const hasWorkspace = Boolean(state.projectRoot);
    if (!hasWorkspace) {
      return `
        <div class="search-empty">Open a project folder to search across files.</div>
        <div class="side-tools" style="margin-top:8px;">
          <button class="side-tool-btn" data-side-action="open-folder">Open Folder</button>
          <button class="side-tool-btn" data-side-action="refresh-tree">Refresh Explorer</button>
        </div>
      `;
    }

    const q = String(sp.query || '').trim();
    if (!q) {
      return `
        <div class="search-empty">Search scans workspace files and groups matches by file. Use include/exclude globs like <code>src/**</code> or <code>*.test.js</code>.</div>
      `;
    }

    if (sp.loading) {
      return `<div class="search-results-loading">Searching workspace...</div>`;
    }

    if (sp.error) {
      return `<div class="search-error-box">${escapeHtml(sp.error)}</div>`;
    }

    if (!sp.searched) {
      return `<div class="search-empty">Press <code>Enter</code> or click Search to run the query.</div>`;
    }

    if (!Array.isArray(sp.results) || sp.results.length === 0) {
      return `<div class="search-empty">No results found for <code>${escapeHtml(q)}</code>.</div>`;
    }

    return sp.results.map((fileGroup) => {
      const filePath = String(fileGroup.filePath || '');
      const rel = String(fileGroup.relativePath || filePath);
      const dir = dirnamePath(rel).replace(/\\/g, '/');
      const fileName = basenamePath(rel);
      const collapsed = Boolean(sp.collapsedFiles?.[filePath]);
      const shownMatches = Array.isArray(fileGroup.matches) ? fileGroup.matches : [];
      const totalCount = Number(fileGroup.totalCount) || shownMatches.length;
      const hiddenCount = Math.max(0, totalCount - shownMatches.length);
      const rows = shownMatches.map((m) => `
        <button type="button"
          class="search-match-row"
          data-side-action="search-open-result"
          data-file-path="${escapeHtml(filePath)}"
          data-start="${escapeHtml(String(m.start))}"
          data-end="${escapeHtml(String(m.end))}"
          title="${escapeHtml(`${rel}:${m.line}:${m.col}`)}">
          <span class="search-match-line">${escapeHtml(String(m.line))}</span>
          <span class="search-match-snippet">
            ${m.prefixEllipsis ? '<span class="dim">…</span>' : ''}
            <span class="dim">${escapeHtml(m.before || '')}</span><mark>${escapeHtml(m.match || '')}</mark><span class="dim">${escapeHtml(m.after || '')}</span>
            ${m.suffixEllipsis ? '<span class="dim">…</span>' : ''}
          </span>
          <span class="search-match-col">C${escapeHtml(String(m.col))}</span>
        </button>
      `).join('');

      return `
        <div class="search-file-group ${collapsed ? 'collapsed' : ''}">
          <div class="search-file-head">
            <button type="button"
              class="search-file-head-main"
              data-side-action="search-toggle-file"
              data-file-path="${escapeHtml(filePath)}"
              aria-expanded="${collapsed ? 'false' : 'true'}">
              <span class="search-file-chevron" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
              <span class="search-file-main">
                <div class="search-file-name">${escapeHtml(fileName || rel)}</div>
                <div class="search-file-path">${escapeHtml(dir === '.' ? '' : dir)}</div>
              </span>
              <span class="search-file-count">${escapeHtml(String(totalCount))}</span>
            </button>
            <button type="button" class="search-file-open" data-side-action="search-open-file" data-file-path="${escapeHtml(filePath)}">Open</button>
          </div>
          <div class="search-match-list">
            ${rows}
            ${hiddenCount > 0 ? `<div class="search-result-more">+ ${escapeHtml(String(hiddenCount))} more matches in this file</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSearchPanelHtml() {
    const sp = ensureSearchPanelState();
    const hasWorkspace = Boolean(state.projectRoot);
    const queryHasText = Boolean(String(sp.query || '').trim());

    return `
      <div class="side-panel-stack search-panel">
        <div class="side-panel-card">
          <div class="search-topbar">
            <div class="title">Search</div>
            <div class="search-toolbar">
              <button class="search-icon-btn" type="button" data-side-action="search-refresh" title="Refresh Search" aria-label="Refresh Search">${sp.loading ? '...' : '↻'}</button>
              <button class="search-icon-btn" type="button" data-side-action="search-clear" title="Clear Search" aria-label="Clear Search">×</button>
              <button class="search-icon-btn" type="button" data-side-action="open-folder" title="Open Folder" aria-label="Open Folder">+Folder</button>
            </div>
          </div>

          <div class="search-query-shell" style="margin-top:8px;">
            <div class="search-query-row">
              <button class="search-collapse-btn" type="button" data-side-action="search-toggle-replace" title="${sp.showReplace ? 'Hide Replace' : 'Show Replace'}" aria-label="${sp.showReplace ? 'Hide Replace' : 'Show Replace'}">${sp.showReplace ? '▾' : '▸'}</button>
              <div class="search-input-wrap">
                <input id="search-query-input" class="search-input" type="text" value="${escapeHtml(sp.query)}" placeholder="Search" autocomplete="off" spellcheck="false">
                <div class="search-input-tools">
                  <button class="search-toggle-btn ${sp.matchCase ? 'active' : ''}" type="button" data-side-action="search-toggle-case" title="Match Case" aria-pressed="${sp.matchCase ? 'true' : 'false'}">Aa</button>
                  <button class="search-toggle-btn ${sp.wholeWord ? 'active' : ''}" type="button" data-side-action="search-toggle-word" title="Match Whole Word" aria-pressed="${sp.wholeWord ? 'true' : 'false'}">ab</button>
                  <button class="search-toggle-btn ${sp.useRegex ? 'active' : ''}" type="button" data-side-action="search-toggle-regex" title="Use Regular Expression" aria-pressed="${sp.useRegex ? 'true' : 'false'}">.*</button>
                </div>
              </div>
              <button class="search-icon-btn search-run-btn" type="button" data-side-action="search-run" ${queryHasText ? '' : 'disabled'}>Search</button>
            </div>

            <div class="search-replace-row ${sp.showReplace ? '' : 'hidden'}">
              <div class="search-replace-placeholder"></div>
              <div class="search-input-wrap">
                <input id="search-replace-input" class="search-input" type="text" value="${escapeHtml(sp.replaceQuery)}" placeholder="Replace (coming soon)" autocomplete="off" spellcheck="false">
                <div class="search-input-tools">
                  <button class="search-toggle-btn" type="button" data-side-action="search-replace-all" title="Replace All (coming soon)">⇄</button>
                </div>
              </div>
              <button class="search-icon-btn" type="button" data-side-action="search-replace-all" disabled>Replace</button>
            </div>

            <div class="search-filter-grid">
              <div class="search-filter-field">
                <label for="search-include-input">Files To Include</label>
                <input id="search-include-input" type="text" value="${escapeHtml(sp.includePattern)}" placeholder="e.g. src/**, *.js" autocomplete="off" spellcheck="false">
              </div>
              <div class="search-filter-field">
                <label for="search-exclude-input">Files To Exclude</label>
                <input id="search-exclude-input" type="text" value="${escapeHtml(sp.excludePattern)}" placeholder="e.g. node_modules/**, dist/**" autocomplete="off" spellcheck="false">
              </div>
            </div>
          </div>

          <div style="margin-top:8px;">
            ${renderSearchPanelSummaryHtml(sp)}
          </div>
        </div>

        <div class="side-panel-card">
          ${hasWorkspace ? `<p class="side-meta" style="margin-bottom:8px;">Workspace: <code>${escapeHtml(toProjectRelative(state.projectRoot) || state.projectRoot || '')}</code></p>` : ''}
          <div class="search-results">
            ${renderSearchPanelResultsHtml(sp)}
          </div>
        </div>
      </div>
    `;
  }

  async function openSearchPanelResult(filePath, start, end) {
    const target = normalizePath(filePath);
    if (!target) return false;
    const ok = await openFile(target, { silent: false });
    if (!ok) return false;

    const file = state.files.get(target);
    if (!file) return false;
    const max = file.content.length;
    const safeStart = clamp(Number(start) || 0, 0, max);
    const safeEnd = clamp(Number(end) || safeStart, safeStart, max);
    file.selectionStart = safeStart;
    file.selectionEnd = safeEnd;

    if (state.activePath !== target) {
      activateTab(target);
    }

    const textarea = els['code-input'];
    if (textarea && state.activePath === target) {
      textarea.selectionStart = safeStart;
      textarea.selectionEnd = safeEnd;
      try { textarea.focus(); } catch (_) {}
      const loc = lineColFromOffset(file.content, safeStart);
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
      textarea.scrollTop = Math.max(0, (loc.line - 4) * lineHeight);
      syncEditorScroll();
      updateCursorStatus();
    }
    return true;
  }

  async function runSearchPanelQuery(options = {}) {
    const sp = ensureSearchPanelState();
    const query = String(sp.query || '').trim();
    const projectRoot = normalizePath(state.projectRoot || '');
    const startTime = performance?.now ? performance.now() : Date.now();
    const nextSeq = (Number(sp.requestSeq) || 0) + 1;
    sp.requestSeq = nextSeq;
    clearTimeout(sp.searchTimer);
    sp.searchTimer = null;

    if (!query) {
      resetSearchPanelResults({ preserveQuery: true });
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      return;
    }

    if (!projectRoot) {
      sp.loading = false;
      sp.searched = true;
      sp.error = '';
      sp.results = [];
      sp.summary = {
        filesScanned: 0,
        filesConsidered: 0,
        filesMatched: 0,
        totalMatches: 0,
        durationMs: 0,
        limitedByFileCap: false,
        limitedByMatchCap: false,
        skippedBinary: 0,
        skippedLarge: 0
      };
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      return;
    }

    const built = buildSearchPanelRegex(sp);
    if (!built.regex) {
      sp.loading = false;
      sp.searched = true;
      sp.error = built.error || 'Invalid search pattern';
      sp.results = [];
      sp.summary = {
        filesScanned: 0,
        filesConsidered: 0,
        filesMatched: 0,
        totalMatches: 0,
        durationMs: 0,
        limitedByFileCap: false,
        limitedByMatchCap: false,
        skippedBinary: 0,
        skippedLarge: 0
      };
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      return;
    }

    const includePatterns = compileSearchFilterPatterns(sp.includePattern);
    const excludePatterns = compileSearchFilterPatterns(sp.excludePattern);

    sp.loading = true;
    sp.searched = true;
    sp.error = '';
    renderSearchPanelIfVisible();

    const MAX_FILES_SCAN = 900;
    const MAX_TOTAL_MATCHES = 500;
    const MAX_MATCHES_PER_FILE = 120;
    const DISPLAY_MATCHES_PER_FILE = 24;
    const MAX_FILE_CHARS = 700000;

    try {
      const files = await listFilesInDirectory(projectRoot, { recursive: true, maxFiles: MAX_FILES_SCAN });
      if (ensureSearchPanelState().requestSeq !== nextSeq) return;
      const summary = {
        filesScanned: Array.isArray(files) ? files.length : 0,
        filesConsidered: 0,
        filesMatched: 0,
        totalMatches: 0,
        durationMs: 0,
        limitedByFileCap: Array.isArray(files) && files.length >= MAX_FILES_SCAN,
        limitedByMatchCap: false,
        skippedBinary: 0,
        skippedLarge: 0
      };
      const results = [];
      const newCollapsed = {};

      for (const filePath of (Array.isArray(files) ? files : [])) {
        if (ensureSearchPanelState().requestSeq !== nextSeq) return;
        if (summary.totalMatches >= MAX_TOTAL_MATCHES) {
          summary.limitedByMatchCap = true;
          break;
        }

        const normalized = normalizePath(filePath);
        if (!normalized) continue;
        const rel = (toProjectRelative(normalized) || normalized).replace(/\\/g, '/');
        if (!searchPathPassesFilters(rel, includePatterns, excludePatterns)) continue;

        const ext = extensionOf(normalized).toLowerCase();
        if (SEARCH_BINARY_EXTENSIONS.has(ext) || IMAGE_FILE_EXTENSIONS.has(ext)) {
          summary.skippedBinary += 1;
          continue;
        }

        let content = null;
        const openFileState = state.files.get(normalized);
        if (openFileState && typeof openFileState.content === 'string') {
          content = openFileState.content;
        } else {
          try { await api.files?.allowPath?.(normalized, 'file'); } catch (_) {}
          content = await api.files?.read?.(normalized);
        }
        if (ensureSearchPanelState().requestSeq !== nextSeq) return;
        if (typeof content !== 'string') continue;
        if (content.includes('\u0000')) {
          summary.skippedBinary += 1;
          continue;
        }
        if (content.length > MAX_FILE_CHARS) {
          summary.skippedLarge += 1;
          continue;
        }

        summary.filesConsidered += 1;
        const remaining = MAX_TOTAL_MATCHES - summary.totalMatches;
        const fileMatches = collectSearchPanelMatchesForFile(content, built.regex, {
          wholeWord: sp.wholeWord,
          maxMatches: Math.max(1, Math.min(MAX_MATCHES_PER_FILE, remaining))
        });
        if (!fileMatches.length) continue;

        summary.filesMatched += 1;
        summary.totalMatches += fileMatches.length;
        if (summary.totalMatches >= MAX_TOTAL_MATCHES) summary.limitedByMatchCap = true;

        const preservedCollapsed = Boolean(sp.collapsedFiles?.[normalized]);
        newCollapsed[normalized] = preservedCollapsed;
        results.push({
          filePath: normalized,
          relativePath: rel,
          totalCount: fileMatches.length,
          matches: fileMatches.slice(0, DISPLAY_MATCHES_PER_FILE)
        });
      }

      if (ensureSearchPanelState().requestSeq !== nextSeq) return;

      sp.results = results;
      sp.collapsedFiles = newCollapsed;
      sp.error = '';
      sp.summary = {
        ...summary,
        durationMs: (performance?.now ? performance.now() : Date.now()) - startTime
      };
    } catch (error) {
      if (ensureSearchPanelState().requestSeq !== nextSeq) return;
      sp.results = [];
      sp.error = error?.message || String(error);
      sp.summary = {
        filesScanned: 0,
        filesConsidered: 0,
        filesMatched: 0,
        totalMatches: 0,
        durationMs: (performance?.now ? performance.now() : Date.now()) - startTime,
        limitedByFileCap: false,
        limitedByMatchCap: false,
        skippedBinary: 0,
        skippedLarge: 0
      };
    } finally {
      if (ensureSearchPanelState().requestSeq !== nextSeq) return;
      sp.loading = false;
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      if (options.source === 'manual') {
        if (!sp.error) setMainStatus('Search complete');
      }
    }
  }

  async function handleSearchPanelSideAction(action, btn) {
    const act = String(action || '');
    if (!act.startsWith('search-')) return false;
    const sp = ensureSearchPanelState();

    if (act === 'search-run' || act === 'search-refresh') {
      await runSearchPanelQuery({ source: 'manual' });
      return true;
    }

    if (act === 'search-clear') {
      resetSearchPanelResults({ preserveQuery: false });
      renderSearchPanelIfVisible();
      queueMicrotask(() => focusSearchPanelQueryInput(false));
      scheduleSessionSave();
      return true;
    }

    if (act === 'search-toggle-replace') {
      sp.showReplace = !sp.showReplace;
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      return true;
    }

    if (act === 'search-toggle-case') {
      sp.matchCase = !sp.matchCase;
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      scheduleSearchPanelRun({ immediate: true, source: 'toggle' });
      return true;
    }

    if (act === 'search-toggle-word') {
      sp.wholeWord = !sp.wholeWord;
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      scheduleSearchPanelRun({ immediate: true, source: 'toggle' });
      return true;
    }

    if (act === 'search-toggle-regex') {
      sp.useRegex = !sp.useRegex;
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      scheduleSearchPanelRun({ immediate: true, source: 'toggle' });
      return true;
    }

    if (act === 'search-replace-all') {
      showToast('Replace in files is not implemented yet', 'warn');
      return true;
    }

    if (act === 'search-toggle-file') {
      const path = normalizePath(btn?.dataset?.filePath || '');
      if (!path) return true;
      sp.collapsedFiles[path] = !Boolean(sp.collapsedFiles[path]);
      renderSearchPanelIfVisible();
      scheduleSessionSave();
      return true;
    }

    if (act === 'search-open-file') {
      const path = normalizePath(btn?.dataset?.filePath || '');
      if (!path) return true;
      await openFile(path);
      return true;
    }

    if (act === 'search-open-result') {
      const path = normalizePath(btn?.dataset?.filePath || '');
      const start = Number(btn?.dataset?.start);
      const end = Number(btn?.dataset?.end);
      if (!path) return true;
      await openSearchPanelResult(path, start, end);
      return true;
    }

    return false;
  }

  function resetSourceControlState(options = {}) {
    const prev = state.sourceControl && typeof state.sourceControl === 'object' ? state.sourceControl : {};
    const preserveDrafts = options.preserveDrafts !== false;
    const preserveGitInfo = options.preserveGitInfo === true;
    state.sourceControl = {
      loading: false,
      loaded: false,
      requestSeq: Number(prev.requestSeq) || 0,
      actionRunning: '',
      gitInstalled: preserveGitInfo ? (prev.gitInstalled ?? null) : null,
      gitVersion: preserveGitInfo ? String(prev.gitVersion || '') : '',
      isRepo: preserveGitInfo ? prev.isRepo === true : false,
      repoRoot: preserveGitInfo ? String(prev.repoRoot || '') : '',
      branch: preserveGitInfo ? String(prev.branch || '') : '',
      upstream: preserveGitInfo ? String(prev.upstream || '') : '',
      ahead: preserveGitInfo ? (Number(prev.ahead) || 0) : 0,
      behind: preserveGitInfo ? (Number(prev.behind) || 0) : 0,
      detached: preserveGitInfo ? prev.detached === true : false,
      hasCommits: preserveGitInfo ? prev.hasCommits === true : false,
      clean: preserveGitInfo ? prev.clean === true : true,
      counts: preserveGitInfo && prev.counts ? { ...prev.counts } : { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
      changes: preserveGitInfo && Array.isArray(prev.changes) ? [...prev.changes] : [],
      userNameDraft: preserveDrafts ? String(prev.userNameDraft || '') : '',
      userEmailDraft: preserveDrafts ? String(prev.userEmailDraft || '') : '',
      remoteUrlDraft: preserveDrafts ? String(prev.remoteUrlDraft || '') : '',
      branchDraft: preserveDrafts ? (String(prev.branchDraft || '').trim() || 'main') : 'main',
      commitMessage: preserveDrafts ? String(prev.commitMessage || '') : '',
      statusError: '',
      lastActionError: '',
      lastActionOutput: '',
      lastActionName: '',
      lastActionOk: null,
      lastRefreshedAt: 0
    };
  }

  function getSourceControlRepoPath() {
    return normalizePath(state.projectRoot || '');
  }

  function getSourceControlTargetBranch() {
    const sc = state.sourceControl || {};
    return String(sc.branchDraft || sc.branch || 'main').trim() || 'main';
  }

  function renderSourceControlPanelIfVisible() {
    if (state.sidePanelMode === 'source') renderSidePanelMode();
  }

  function buildSourceControlOutputText(result = {}) {
    const chunks = [];
    const out = String(result.stdout || '').trim();
    const err = String(result.stderr || '').trim();
    const msg = String(result.error || '').trim();
    if (out) chunks.push(out);
    if (err) chunks.push(err);
    if (msg && !chunks.includes(msg)) chunks.push(msg);
    if (result.timedOut) chunks.push('Git command timed out.');
    return chunks.join('\n\n').trim();
  }

  function applySourceControlStatus(status = {}, options = {}) {
    const sc = state.sourceControl;
    if (!sc || !status || typeof status !== 'object') return;
    const overwriteDrafts = options.overwriteDrafts === true;

    sc.gitInstalled = status.gitInstalled === false ? false : (status.gitInstalled === true ? true : sc.gitInstalled);
    sc.gitVersion = String(status.gitVersion || sc.gitVersion || '');
    sc.statusError = String(status.error || '');
    sc.loaded = true;
    sc.lastRefreshedAt = Date.now();
    sc.isRepo = status.isRepo === true;

    if (!sc.isRepo) {
      sc.repoRoot = '';
      sc.branch = '';
      sc.upstream = '';
      sc.ahead = 0;
      sc.behind = 0;
      sc.detached = false;
      sc.hasCommits = false;
      sc.clean = true;
      sc.counts = { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 };
      sc.changes = [];
      return;
    }

    sc.repoRoot = String(status.repoRoot || '');
    sc.branch = String(status.branch || '');
    sc.upstream = String(status.upstream || '');
    sc.ahead = Number(status.ahead) || 0;
    sc.behind = Number(status.behind) || 0;
    sc.detached = status.detached === true;
    sc.hasCommits = status.hasCommits === true;
    sc.clean = status.clean === true;
    sc.counts = status.counts && typeof status.counts === 'object'
      ? {
          total: Number(status.counts.total) || 0,
          staged: Number(status.counts.staged) || 0,
          unstaged: Number(status.counts.unstaged) || 0,
          untracked: Number(status.counts.untracked) || 0,
          conflicted: Number(status.counts.conflicted) || 0
        }
      : { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 };
    sc.changes = Array.isArray(status.changes)
      ? status.changes.map((item) => ({
          code: String(item?.code || '').slice(0, 2),
          path: String(item?.path || '').trim()
        })).filter((item) => item.path)
      : [];

    const nextUserName = String(status.userName || '').trim();
    const nextUserEmail = String(status.userEmail || '').trim();
    const nextRemoteUrl = String(status.remoteUrl || '').trim();
    const nextBranch = String(status.branch || '').trim();
    if (nextUserName && (overwriteDrafts || !String(sc.userNameDraft || '').trim())) sc.userNameDraft = nextUserName;
    if (nextUserEmail && (overwriteDrafts || !String(sc.userEmailDraft || '').trim())) sc.userEmailDraft = nextUserEmail;
    if (nextRemoteUrl && (overwriteDrafts || !String(sc.remoteUrlDraft || '').trim())) sc.remoteUrlDraft = nextRemoteUrl;
    if (nextBranch && (overwriteDrafts || !String(sc.branchDraft || '').trim() || String(sc.branchDraft || '') === 'main')) sc.branchDraft = nextBranch;
    if (!String(sc.branchDraft || '').trim()) sc.branchDraft = 'main';
  }

  async function refreshSourceControlState(options = {}) {
    if (!state.sourceControl || typeof state.sourceControl !== 'object') {
      resetSourceControlState({ preserveDrafts: true, preserveGitInfo: false });
    }
    const sc = state.sourceControl;
    const repoPath = getSourceControlRepoPath();
    sc.requestSeq = (Number(sc.requestSeq) || 0) + 1;
    const requestSeq = sc.requestSeq;
    sc.loading = true;
    if (!options.preserveErrors) sc.statusError = '';
    renderSourceControlPanelIfVisible();

    if (!repoPath) {
      sc.loading = false;
      sc.loaded = true;
      sc.gitInstalled = sc.gitInstalled ?? null;
      sc.isRepo = false;
      sc.repoRoot = '';
      sc.branch = '';
      sc.upstream = '';
      sc.clean = true;
      sc.counts = { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 };
      sc.changes = [];
      renderSourceControlPanelIfVisible();
      return;
    }

    if (!api.git?.status) {
      sc.loading = false;
      sc.loaded = true;
      sc.gitInstalled = false;
      sc.isRepo = false;
      sc.statusError = 'Git API is unavailable in Coder';
      renderSourceControlPanelIfVisible();
      return;
    }

    try {
      const result = await api.git.status(repoPath);
      if (requestSeq !== sc.requestSeq) return;
      sc.loading = false;
      if (!result?.success) {
        sc.loaded = true;
        sc.gitInstalled = result?.gitInstalled === false ? false : sc.gitInstalled;
        sc.isRepo = false;
        sc.statusError = String(result?.error || 'Failed to load Git status');
      } else {
        applySourceControlStatus(result, { overwriteDrafts: false });
        if (!options.silent) setMainStatus('Source Control refreshed');
      }
    } catch (error) {
      if (requestSeq !== sc.requestSeq) return;
      sc.loading = false;
      sc.loaded = true;
      sc.statusError = error?.message || String(error);
    }
    renderSourceControlPanelIfVisible();
  }

  async function runSourceControlAction(actionKey, actionLabel, runner) {
    const sc = state.sourceControl;
    if (!sc) return { success: false, error: 'Source Control state unavailable' };
    if (sc.actionRunning) return { success: false, error: 'Another Git action is already running' };
    sc.actionRunning = actionKey;
    sc.lastActionError = '';
    sc.lastActionName = actionLabel;
    renderSourceControlPanelIfVisible();
    setMainStatus(`${actionLabel}...`);

    try {
      const result = await runner();
      sc.actionRunning = '';
      sc.lastActionOk = Boolean(result?.success);
      sc.lastActionError = result?.success ? '' : String(result?.error || `${actionLabel} failed`);
      sc.lastActionOutput = buildSourceControlOutputText(result?.output || {});
      if (result?.status?.success) {
        applySourceControlStatus(result.status, { overwriteDrafts: false });
      } else if (result?.status && typeof result.status === 'object' && typeof result.status.error === 'string') {
        sc.statusError = result.status.error;
      }
      renderSourceControlPanelIfVisible();
      if (result?.success) {
        setMainStatus(`${actionLabel} complete`);
        showToast(actionLabel, 'success');
      } else {
        setMainStatus(`${actionLabel} failed`);
        showToast(`${actionLabel} failed: ${sc.lastActionError || 'unknown error'}`, 'error');
      }
      return result;
    } catch (error) {
      sc.actionRunning = '';
      sc.lastActionOk = false;
      sc.lastActionError = error?.message || String(error);
      sc.lastActionOutput = '';
      renderSourceControlPanelIfVisible();
      setMainStatus(`${actionLabel} failed`);
      showToast(`${actionLabel} failed`, 'error');
      return { success: false, error: sc.lastActionError };
    }
  }

  function buildSourceControlGuideSteps(sc = state.sourceControl || {}) {
    const repoOpen = Boolean(state.projectRoot);
    const gitInstalled = sc.gitInstalled === true;
    const isRepo = sc.isRepo === true;
    const branchName = getSourceControlTargetBranch();
    const remoteUrl = String(sc.remoteUrlDraft || '').trim();
    const userName = String(sc.userNameDraft || '').trim();
    const commitMsg = String(sc.commitMessage || '').trim();
    const changes = Number(sc.counts?.total) || 0;

    return [
      {
        done: repoOpen,
        text: repoOpen ? `Project folder selected: ${toProjectRelative(state.projectRoot) || basenamePath(state.projectRoot) || state.projectRoot}` : 'Open a project folder in Coder',
        hint: repoOpen ? '' : 'Click Open Folder'
      },
      {
        done: gitInstalled,
        text: gitInstalled ? `Git detected (${sc.gitVersion || 'installed'})` : 'Git must be installed on this device',
        hint: gitInstalled ? '' : 'Install Git and reopen Source Control'
      },
      {
        done: !repoOpen || !gitInstalled || isRepo,
        text: isRepo ? `Repository ready (${sc.branch || branchName || 'branch'})` : `Initialize a Git repository (${branchName})`,
        hint: isRepo ? '' : 'Click Initialize Repo'
      },
      {
        done: !repoOpen || !gitInstalled || !isRepo || Boolean(userName),
        text: userName ? `Git user name saved: ${userName}` : 'Save Git user name (and optional email)',
        hint: userName ? '' : 'Fill Git User Name and click Save Git Setup'
      },
      {
        done: !repoOpen || !gitInstalled || !isRepo || Boolean(remoteUrl),
        text: remoteUrl ? `Remote origin saved` : 'Save repository link (remote origin URL)',
        hint: remoteUrl ? remoteUrl : 'Paste repository URL and click Save Git Setup'
      },
      {
        done: !repoOpen || !gitInstalled || !isRepo || changes === 0,
        text: changes === 0 ? 'No local changes to commit' : `Stage changes (${changes} file${changes === 1 ? '' : 's'})`,
        hint: changes > 0 ? 'Click Stage All' : ''
      },
      {
        done: !repoOpen || !gitInstalled || !isRepo || !changes || Boolean(commitMsg),
        text: 'Write a commit message and commit your changes',
        hint: commitMsg ? `Ready: git commit -m "${commitMsg.slice(0, 32)}${commitMsg.length > 32 ? '...' : ''}"` : 'Enter a commit message'
      },
      {
        done: false,
        text: `Pull latest changes from remote before push`,
        hint: `Command: git pull origin ${branchName}`
      },
      {
        done: false,
        text: `Push your code to remote`,
        hint: `Command: git push -u origin ${branchName}`
      }
    ];
  }

  function renderSourceControlPanelHtml() {
    const sc = state.sourceControl || {};
    const repoPath = getSourceControlRepoPath();
    const actionRunning = String(sc.actionRunning || '');
    const branchTarget = getSourceControlTargetBranch();
    const actionBusy = Boolean(actionRunning);
    const disableIf = (cond) => (cond ? 'disabled' : '');
    const changes = Array.isArray(sc.changes) ? sc.changes : [];
    const counts = sc.counts && typeof sc.counts === 'object' ? sc.counts : { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 };
    const steps = buildSourceControlGuideSteps(sc);
    const remoteUrl = String(sc.remoteUrlDraft || '').trim();
    const canRunRepoActions = Boolean(repoPath && sc.gitInstalled === true && sc.isRepo);
    const canPushPull = canRunRepoActions && Boolean(remoteUrl) && Boolean(branchTarget);
    const repoDisplay = sc.repoRoot ? (toProjectRelative(sc.repoRoot) || sc.repoRoot) : (repoPath ? (toProjectRelative(repoPath) || repoPath) : '');

    if (!repoPath) {
      return `
        <div class="side-panel-stack">
          <div class="side-panel-card">
            <p>Open a project folder to use Git Source Control in Coder.</p>
          </div>
          <div class="side-panel-card">
            <div class="side-tools">
              <button class="side-tool-btn" data-side-action="open-folder">Open Folder</button>
            </div>
          </div>
        </div>
      `;
    }

    const changesHtml = changes.length
      ? `
        <div class="sc-change-list">
          ${changes.slice(0, 60).map((item) => `
            <div class="sc-change-row" title="${escapeHtml(item.path || '')}">
              <code>${escapeHtml(item.code || '??')}</code>
              <div class="path">${escapeHtml(item.path || '')}</div>
            </div>
          `).join('')}
        </div>
        ${changes.length > 60 ? `<p class="side-meta" style="margin-top:8px;">Showing 60 of ${changes.length} changed files.</p>` : ''}
      `
      : '<p>No local changes detected.</p>';

    const stepHtml = `
      <ol class="sc-step-list">
        ${steps.map((step) => `
          <li class="${step.done ? 'done' : ''}">
            ${escapeHtml(step.text || '')}
            ${step.hint ? `<div class="side-meta">${escapeHtml(step.hint)}</div>` : ''}
          </li>
        `).join('')}
      </ol>
    `;

    return `
      <div class="side-panel-stack">
        <div class="side-panel-card">
          <h4>Repository</h4>
          <p>${sc.loading ? 'Checking Git and repository status...' : (sc.gitInstalled === false ? 'Git is not detected on this device.' : (sc.isRepo ? 'Git repository detected in current project.' : 'Project folder is open, but this is not a Git repository yet.'))}</p>
          <div class="sc-badges" style="margin-top:8px;">
            <span class="sc-badge ${sc.gitInstalled === false ? 'error' : ''}">${sc.gitInstalled === false ? 'Git Missing' : (sc.gitVersion || 'Git')}</span>
            <span class="sc-badge ${sc.isRepo ? '' : 'warn'}">${sc.isRepo ? 'Repository' : 'Not Repo'}</span>
            <span class="sc-badge">${escapeHtml(branchTarget)}</span>
            ${sc.upstream ? `<span class="sc-badge">${escapeHtml(sc.upstream)}</span>` : ''}
            ${actionRunning ? `<span class="sc-badge warn">Running: ${escapeHtml(actionRunning)}</span>` : ''}
          </div>
          ${repoDisplay ? `<p class="side-meta" style="margin-top:8px;">Path: ${escapeHtml(repoDisplay)}</p>` : ''}
          ${sc.statusError ? `<p class="side-meta" style="margin-top:8px; color:#ffb9b9;">${escapeHtml(sc.statusError)}</p>` : ''}
          <div class="side-tools" style="margin-top:8px;">
            <button class="side-tool-btn" data-side-action="git-refresh" ${disableIf(actionBusy)}>Refresh</button>
            <button class="side-tool-btn" data-side-action="git-init" ${disableIf(actionBusy || sc.gitInstalled !== true || sc.isRepo === true)}>Initialize Repo</button>
          </div>
        </div>

        <div class="side-panel-card">
          <h4>Git Setup</h4>
          <div class="sc-fields">
            <div class="sc-field">
              <label for="sc-git-user-name">Git User Name</label>
              <input id="sc-git-user-name" type="text" value="${escapeHtml(sc.userNameDraft || '')}" placeholder="Your Name" autocomplete="off" spellcheck="false">
            </div>
            <div class="sc-field">
              <label for="sc-git-user-email">Git Email (optional)</label>
              <input id="sc-git-user-email" type="text" value="${escapeHtml(sc.userEmailDraft || '')}" placeholder="you@example.com" autocomplete="off" spellcheck="false">
            </div>
            <div class="sc-field">
              <label for="sc-git-remote-url">Repository Link (origin URL)</label>
              <input id="sc-git-remote-url" type="text" value="${escapeHtml(sc.remoteUrlDraft || '')}" placeholder="https://github.com/user/repo.git" autocomplete="off" spellcheck="false">
            </div>
            <div class="sc-field">
              <label for="sc-git-branch">Branch</label>
              <input id="sc-git-branch" type="text" value="${escapeHtml(branchTarget)}" placeholder="main" autocomplete="off" spellcheck="false">
            </div>
          </div>
          <div class="side-tools" style="margin-top:8px;">
            <button class="side-tool-btn" data-side-action="git-save-config" ${disableIf(actionBusy || sc.gitInstalled !== true || sc.isRepo !== true)}>Save Git Setup</button>
          </div>
          <p class="side-meta" style="margin-top:8px;">Saves local repo config (<code>user.name</code>, optional <code>user.email</code>) and remote <code>origin</code> URL.</p>
        </div>

        <div class="side-panel-card">
          <h4>Repository Status</h4>
          <div class="sc-stat-grid">
            <div class="sc-stat-chip"><div class="k">Changes</div><div class="v">${escapeHtml(String(counts.total || 0))}</div></div>
            <div class="sc-stat-chip"><div class="k">Staged</div><div class="v">${escapeHtml(String(counts.staged || 0))}</div></div>
            <div class="sc-stat-chip"><div class="k">Unstaged</div><div class="v">${escapeHtml(String(counts.unstaged || 0))}</div></div>
            <div class="sc-stat-chip"><div class="k">Untracked</div><div class="v">${escapeHtml(String(counts.untracked || 0))}</div></div>
            <div class="sc-stat-chip"><div class="k">Ahead</div><div class="v">${escapeHtml(String(sc.ahead || 0))}</div></div>
            <div class="sc-stat-chip"><div class="k">Behind</div><div class="v">${escapeHtml(String(sc.behind || 0))}</div></div>
          </div>
          <div class="side-tools" style="margin-top:8px;">
            <button class="side-tool-btn" data-side-action="git-stage-all" ${disableIf(actionBusy || !canRunRepoActions || !changes.length)}>Stage All</button>
            <button class="side-tool-btn" data-side-action="git-pull" ${disableIf(actionBusy || !canRunRepoActions)}>Pull</button>
            <button class="side-tool-btn" data-side-action="git-push" ${disableIf(actionBusy || !canRunRepoActions)}>Push</button>
          </div>
          <p class="side-meta" style="margin-top:8px;">Pull/Push target: <code>origin ${escapeHtml(branchTarget)}</code></p>
        </div>

        <div class="side-panel-card">
          <h4>Commit</h4>
          <div class="sc-field">
            <label for="sc-git-commit-message">Commit Message</label>
            <textarea id="sc-git-commit-message" placeholder="feat: describe your change">${escapeHtml(sc.commitMessage || '')}</textarea>
          </div>
          <div class="side-tools" style="margin-top:8px;">
            <button class="side-tool-btn" data-side-action="git-commit" ${disableIf(actionBusy || !canRunRepoActions)}>Commit</button>
            <button class="side-tool-btn" data-side-action="git-refresh" ${disableIf(actionBusy)}>Refresh Status</button>
          </div>
          <p class="side-meta" style="margin-top:8px;">Tip: save files before commit so Git sees the latest editor content.</p>
        </div>

        <div class="side-panel-card">
          <h4>Step By Step Push / Pull</h4>
          ${stepHtml}
        </div>

        <div class="side-panel-card">
          <h4>Changes</h4>
          ${changesHtml}
        </div>

        ${(sc.lastActionError || sc.lastActionOutput)
          ? `<div class="side-panel-card">
               <h4>${escapeHtml(sc.lastActionName || 'Git Output')}</h4>
               ${sc.lastActionError ? `<p style="color:#ffb9b9; margin-bottom:8px;">${escapeHtml(sc.lastActionError)}</p>` : ''}
               ${sc.lastActionOutput ? `<pre class="sc-output">${escapeHtml(sc.lastActionOutput)}</pre>` : ''}
             </div>`
          : ''}
      </div>
    `;
  }

  function ensureRunPanelState() {
    if (!state.runPanel || typeof state.runPanel !== 'object') state.runPanel = {};
    const rp = state.runPanel;
    rp.configId = String(rp.configId || 'auto').trim() || 'auto';
    rp.consoleMode = ['integratedTerminal', 'internalConsole', 'externalTerminal'].includes(String(rp.consoleMode || ''))
      ? String(rp.consoleMode)
      : 'integratedTerminal';
    rp.stopOnEntry = Boolean(rp.stopOnEntry);
    rp.autoSaveBeforeRun = rp.autoSaveBeforeRun !== false;
    rp.lastDebugUrl = String(rp.lastDebugUrl || '');
    rp.lastAction = String(rp.lastAction || '');
    rp.lastActionKind = String(rp.lastActionKind || '');
    rp.lastActionAt = Number(rp.lastActionAt) || 0;
    const sectionExpanded = (rp.sectionExpanded && typeof rp.sectionExpanded === 'object') ? rp.sectionExpanded : {};
    rp.sectionExpanded = {
      variables: sectionExpanded.variables !== false,
      watch: Boolean(sectionExpanded.watch),
      callStack: sectionExpanded.callStack !== false,
      breakpoints: sectionExpanded.breakpoints !== false
    };
    return rp;
  }

  function getRunPanelLaunchPath() {
    const root = normalizePath(state.projectRoot || '');
    if (!root) return '';
    return joinPath(root, '.vscode', 'launch.json');
  }

  function getRunPanelProfile() {
    const activePath = normalizePath(state.activePath || '');
    const hasFile = Boolean(activePath);
    const ext = extensionOf(activePath).toLowerCase();
    const relativePath = activePath ? (toProjectRelative(activePath) || activePath) : '';
    const fileName = activePath ? basenamePath(activePath) : '';
    const profile = {
      hasFile,
      activePath,
      relativePath,
      fileName,
      ext,
      engineLabel: 'No file',
      supportLabel: 'Idle',
      supportTone: 'muted',
      description: 'Open a file to start a run/debug session.',
      builtInRun: false,
      builtInDebugPreview: false,
      debugTerminalRecommended: false,
      browserUrlHelpful: false,
      kind: 'none'
    };

    if (!hasFile) return profile;

    if (ext === 'html' || ext === 'htm') {
      profile.engineLabel = 'HTML Preview';
      profile.supportLabel = 'Built-in Preview';
      profile.supportTone = 'ok';
      profile.description = 'Built-in sandboxed HTML preview is available. Debug sections mirror VS Code layout while debugger APIs are still in progress.';
      profile.builtInRun = true;
      profile.builtInDebugPreview = true;
      profile.browserUrlHelpful = true;
      profile.kind = 'html';
      return profile;
    }

    if (['js', 'mjs', 'cjs'].includes(ext)) {
      profile.engineLabel = 'Node.js';
      profile.supportLabel = 'Setup Required';
      profile.supportTone = 'warn';
      profile.description = 'Node debugging UI is ready, but runtime debugger integration is not implemented yet. Use launch.json and terminal workflow as a placeholder.';
      profile.debugTerminalRecommended = true;
      profile.kind = 'node';
      return profile;
    }

    if (['ts', 'tsx', 'jsx'].includes(ext)) {
      profile.engineLabel = 'JavaScript / TypeScript';
      profile.supportLabel = 'Setup Required';
      profile.supportTone = 'warn';
      profile.description = 'Configure a build/run task and launch.json. The panel now matches the VS Code workflow, but execution backends are still limited in Coder.';
      profile.debugTerminalRecommended = true;
      profile.browserUrlHelpful = true;
      profile.kind = 'web-script';
      return profile;
    }

    if (ext === 'c') {
      profile.engineLabel = 'C Compiler';
      profile.supportLabel = 'Built-in Compile & Run';
      profile.supportTone = 'ok';
      profile.description = 'Play uses the compiler selected in Coder Settings. Inbuilt uses Coder Mini C (basic subset). Choose GCC/Clang/CC/TCC for full compiler support. clangd diagnostics are shown when published.';
      profile.builtInRun = true;
      profile.kind = 'c';
      return profile;
    }

    if (['cpp', 'cc', 'cxx', 'c++'].includes(ext)) {
      profile.engineLabel = 'C++ Compiler';
      profile.supportLabel = 'Built-in Compile & Run';
      profile.supportTone = 'ok';
      profile.description = 'Play uses the compiler selected in Coder Settings. Inbuilt uses Coder Mini C++ (basic subset). Choose G++/Clang++/C++ (or custom) for broader C++ support.';
      profile.builtInRun = true;
      profile.kind = 'cpp';
      return profile;
    }

    if (ext === 'h') {
      profile.engineLabel = 'C Header';
      profile.supportLabel = 'Not Runnable';
      profile.supportTone = 'warn';
      profile.description = 'Header files are not directly runnable. Open a .c file and use Play to compile and run.';
      profile.kind = 'c-header';
      return profile;
    }

    if (['hpp', 'hh', 'hxx'].includes(ext)) {
      profile.engineLabel = 'C++ Header';
      profile.supportLabel = 'Not Runnable';
      profile.supportTone = 'warn';
      profile.description = 'Header files are not directly runnable. Open a .cpp/.cc/.cxx file and use Play to compile and run.';
      profile.kind = 'cpp-header';
      return profile;
    }

    profile.engineLabel = (detectLanguage(activePath) || 'Text').replace(/^\w/, (m) => m.toUpperCase());
    profile.supportLabel = 'Manual Setup';
    profile.supportTone = 'muted';
    profile.description = 'Add a workspace launch.json configuration to define how this file type should run.';
    profile.kind = 'generic';
    return profile;
  }

  function getRunPanelConfigOptions(profile = getRunPanelProfile()) {
    const options = [];
    const autoLabel = profile.hasFile
      ? `Auto Detect (${profile.engineLabel})`
      : 'Auto Detect';
    options.push({ id: 'auto', label: autoLabel });

    if (profile.kind === 'html') {
      options.push({ id: 'html-preview', label: 'HTML Preview (Built-in)' });
      options.push({ id: 'browser-url', label: 'Attach Browser URL (Preview UI)', comingSoon: true });
    } else if (profile.kind === 'node') {
      options.push({ id: 'node-current', label: 'Node.js: Current File', comingSoon: true });
      options.push({ id: 'node-launch', label: 'Node.js: launch.json', comingSoon: true });
    } else if (profile.kind === 'web-script') {
      options.push({ id: 'browser-url', label: 'Attach Browser URL', comingSoon: true });
      options.push({ id: 'launch-json', label: 'launch.json (Workspace)', comingSoon: true });
    } else if (profile.hasFile) {
      options.push({ id: 'launch-json', label: 'launch.json (Workspace)', comingSoon: true });
    }

    if (!options.some((opt) => opt.id === 'launch-json')) {
      options.push({ id: 'launch-json', label: 'launch.json (Workspace)', comingSoon: true });
    }

    return options;
  }

  function renderRunGroupCard(key, title, meta, count, bodyHtml, expanded) {
    const safeKey = escapeHtml(String(key || ''));
    const safeTitle = escapeHtml(String(title || ''));
    const safeMeta = escapeHtml(String(meta || ''));
    const safeCount = escapeHtml(String(count ?? '0'));
    return `
      <div class="side-panel-card run-group ${expanded ? '' : 'collapsed'}" data-run-group="${safeKey}">
        <div class="run-group-head">
          <button class="run-group-toggle" type="button" data-side-action="run-toggle-section" data-run-section="${safeKey}" aria-expanded="${expanded ? 'true' : 'false'}">
            <span class="run-group-chevron" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
            <span class="run-group-title">
              <div class="run-group-name">${safeTitle}</div>
              <div class="run-group-meta">${safeMeta}</div>
            </span>
            <span class="run-group-count">${safeCount}</span>
          </button>
        </div>
        <div class="run-group-body">
          ${bodyHtml}
        </div>
      </div>
    `;
  }

  function formatRunPanelTime(ts) {
    const n = Number(ts) || 0;
    if (!n) return '';
    try {
      return new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function renderRunPanelHtml() {
    const rp = ensureRunPanelState();
    const profile = getRunPanelProfile();
    const configs = getRunPanelConfigOptions(profile);
    if (!configs.some((opt) => opt.id === rp.configId)) rp.configId = 'auto';

    const activeFile = profile.hasFile ? profile.relativePath : 'No file selected';
    const activeLabel = profile.hasFile ? escapeHtml(activeFile) : '<span class="run-muted-inline">No active editor file</span>';
    const launchPath = getRunPanelLaunchPath();
    const launchPathLabel = launchPath ? (toProjectRelative(launchPath) || launchPath) : '.vscode/launch.json';
    const hasWorkspace = Boolean(state.projectRoot);
    const canRunNow = profile.builtInRun;
    const canDebugNow = profile.builtInDebugPreview;
    const badgeClass = profile.supportTone === 'warn'
      ? 'warn'
      : (profile.supportTone === 'muted' ? 'muted' : '');
    const disabledNoFile = profile.hasFile ? '' : 'disabled';

    const configOptionsHtml = configs.map((opt) => {
      const label = `${opt.label}${opt.comingSoon ? ' (coming soon)' : ''}`;
      return `<option value="${escapeHtml(opt.id)}" ${rp.configId === opt.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');

    const lastActionHtml = rp.lastAction
      ? `<div class="run-last-action ${escapeHtml(rp.lastActionKind || '')}">
           <div>${escapeHtml(rp.lastAction)}</div>
           ${rp.lastActionAt ? `<div class="run-muted-inline" style="margin-top:3px;">Last action: ${escapeHtml(formatRunPanelTime(rp.lastActionAt))}</div>` : ''}
         </div>`
      : '';

    const variablesBody = profile.hasFile
      ? `
        <div class="run-kv">
          <div class="run-kv-row">
            <span class="run-kv-tag">FILE</span>
            <div class="run-kv-value"><code>${escapeHtml(activeFile)}</code></div>
          </div>
          <div class="run-kv-row">
            <span class="run-kv-tag">ENGINE</span>
            <div class="run-kv-value">${escapeHtml(profile.engineLabel)}</div>
          </div>
          <div class="run-kv-row">
            <span class="run-kv-tag">STATUS</span>
            <div class="run-kv-value">${canRunNow ? 'Ready for built-in preview/run' : 'Waiting for launch.json / backend integration'}</div>
          </div>
        </div>
      `
      : `<p class="run-empty-note">Open a file to inspect debug context.</p>`;

    const watchBody = `
      <p class="run-empty-note">No watch expressions yet. This section is included to match VS Code’s debug layout.</p>
      <div class="run-section-actions">
        <button class="side-tool-btn" data-side-action="run-open-launch-json">${hasWorkspace ? 'Open launch.json' : 'Open Folder'}</button>
      </div>
    `;

    const callStackBody = `
      <div class="run-compact-list">
        <div class="run-compact-row">
          <span class="label">${profile.hasFile ? escapeHtml(profile.fileName || 'current file') : 'session'}</span>
          <span class="value">${rp.lastAction ? 'last run target' : 'inactive'}</span>
        </div>
        <div class="run-compact-row">
          <span class="label">${canDebugNow ? 'Preview Session' : 'Debugger Backend'}</span>
          <span class="value">${canDebugNow ? 'UI-only debug preview' : 'coming soon'}</span>
        </div>
      </div>
    `;

    const breakpointsBody = `
      <p class="run-empty-note">Breakpoint gutter and runtime pause/resume are not implemented yet in Coder.</p>
      <div class="run-kv">
        <div class="run-kv-row">
          <span class="run-kv-tag">TIP</span>
          <div class="run-kv-value">Use <code>${escapeHtml(launchPathLabel)}</code> to prepare VS Code-compatible configs now.</div>
        </div>
      </div>
    `;

    return `
      <div class="side-panel-stack run-panel">
        <div class="side-panel-card run-hero-card">
          <div class="run-hero-head">
            <div>
              <h4 class="run-hero-title">Start Debug Session</h4>
              <div class="run-hero-sub">${escapeHtml(profile.description)}</div>
            </div>
            <span class="run-badge ${badgeClass}">${escapeHtml(profile.supportLabel)}</span>
          </div>

          <label class="run-field-label" for="run-config-select">Run Configuration</label>
          <div class="run-launch-row">
            <select id="run-config-select" class="run-select" aria-label="Run configuration">
              ${configOptionsHtml}
            </select>
            <button class="side-tool-btn primary" data-side-action="run-debug-start" ${disabledNoFile}>Start</button>
          </div>

          <div class="run-quick-actions">
            <button class="side-tool-btn" data-side-action="run-no-debug" ${disabledNoFile}>Run Without Debugging</button>
            <button class="side-tool-btn" data-side-action="run-open-launch-json">${hasWorkspace ? 'Open launch.json' : 'Open Folder'}</button>
            <button class="side-tool-btn" data-side-action="run-debug-terminal">${profile.debugTerminalRecommended ? 'JavaScript Debug Terminal' : 'Debug Terminal'}</button>
            <button class="side-tool-btn" data-side-action="run-debug-url">${rp.lastDebugUrl ? 'Debug URL (Recent)' : 'Debug URL'}</button>
          </div>

          <div class="run-options-grid">
            <label class="run-check">
              <input id="run-auto-save-before-run" type="checkbox" ${rp.autoSaveBeforeRun ? 'checked' : ''}>
              <span>Auto save before run</span>
            </label>
            <label class="run-check">
              <input id="run-stop-on-entry" type="checkbox" ${rp.stopOnEntry ? 'checked' : ''}>
              <span>Stop on entry</span>
            </label>
            <div class="run-option-field">
              <label for="run-console-select">Console</label>
              <select id="run-console-select" class="run-option-select" aria-label="Debug console output">
                <option value="integratedTerminal" ${rp.consoleMode === 'integratedTerminal' ? 'selected' : ''}>Integrated</option>
                <option value="internalConsole" ${rp.consoleMode === 'internalConsole' ? 'selected' : ''}>Internal</option>
                <option value="externalTerminal" ${rp.consoleMode === 'externalTerminal' ? 'selected' : ''}>External</option>
              </select>
            </div>
            <div class="run-option-field">
              <label>Active</label>
              <div class="run-muted-inline" title="${profile.hasFile ? escapeHtml(activeFile) : 'No file selected'}">${activeLabel}</div>
            </div>
          </div>

          ${lastActionHtml}
        </div>

        ${renderRunGroupCard(
          'variables',
          'Variables',
          'Current file and debug context',
          profile.hasFile ? 3 : 0,
          variablesBody,
          rp.sectionExpanded.variables
        )}

        ${renderRunGroupCard(
          'watch',
          'Watch',
          'Expressions and quick checks',
          0,
          watchBody,
          rp.sectionExpanded.watch
        )}

        ${renderRunGroupCard(
          'callStack',
          'Call Stack',
          'Session frames and threads',
          rp.lastAction ? 1 : 0,
          callStackBody,
          rp.sectionExpanded.callStack
        )}

        ${renderRunGroupCard(
          'breakpoints',
          'Breakpoints',
          'Editor breakpoints and exceptions',
          0,
          breakpointsBody,
          rp.sectionExpanded.breakpoints
        )}

        <div class="side-panel-card">
          <h4>Workspace Launch</h4>
          <p>${hasWorkspace
            ? `Create or open <code>${escapeHtml(launchPathLabel)}</code> for VS Code-compatible debug configurations.`
            : 'Open a project folder first to create .vscode/launch.json in the workspace root.'}</p>
          <div class="side-tools" style="margin-top:8px;">
            <button class="side-tool-btn" data-side-action="run-open-launch-json">${hasWorkspace ? 'Create / Open launch.json' : 'Open Folder'}</button>
            <button class="side-tool-btn" data-side-action="run-refresh-panel">Refresh Panel</button>
          </div>
        </div>
      </div>
    `;
  }

  function markRunPanelLastAction(text, kind = 'info') {
    const rp = ensureRunPanelState();
    rp.lastAction = String(text || '').trim();
    rp.lastActionKind = ['success', 'warn', 'error', 'info'].includes(String(kind || '')) ? String(kind) : 'info';
    rp.lastActionAt = Date.now();
    scheduleSessionSave();
  }

  function buildSuggestedLaunchJson() {
    const activePath = normalizePath(state.activePath || '');
    const rel = activePath ? (toProjectRelative(activePath) || basenamePath(activePath)) : '';
    const ext = extensionOf(activePath).toLowerCase();
    const normalizedRel = String(rel || 'index.html').replace(/\\/g, '/');
    const htmlTarget = (ext === 'html' || ext === 'htm') ? normalizedRel : 'index.html';
    const configurations = [];

    configurations.push({
      type: 'node',
      request: 'launch',
      name: 'Run Current File (Node.js)',
      program: '${file}',
      cwd: '${workspaceFolder}',
      console: 'integratedTerminal'
    });

    configurations.push({
      type: 'pwa-chrome',
      request: 'launch',
      name: 'Open HTML File (Browser)',
      file: '${workspaceFolder}/' + htmlTarget
    });

    return `${JSON.stringify({ version: '0.2.0', configurations }, null, 2)}\n`;
  }

  async function createOrOpenRunLaunchJson() {
    const root = normalizePath(state.projectRoot || '');
    if (!root) {
      await openFolderViaDialog();
      return false;
    }

    const writer = api.files?.write || ((path, content) => api.files?.createFile?.(path, content));
    if (!writer) {
      showToast('Write API unavailable', 'error');
      markRunPanelLastAction('launch.json open failed: write API unavailable', 'error');
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return false;
    }

    const vscodeDir = joinPath(root, '.vscode');
    const launchPath = joinPath(vscodeDir, 'launch.json');

    try {
      const dirStat = await api.files?.stat?.(vscodeDir);
      if (!dirStat?.exists) {
        const madeDir = await api.files?.createFolder?.(vscodeDir);
        if (!madeDir) {
          showToast('Failed to create .vscode folder', 'error');
          markRunPanelLastAction('Failed to create .vscode folder', 'error');
          if (state.sidePanelMode === 'run') renderSidePanelMode();
          return false;
        }
      }

      const launchStat = await api.files?.stat?.(launchPath);
      let created = false;
      if (!launchStat?.exists) {
        const ok = await writer(launchPath, buildSuggestedLaunchJson());
        if (!ok) {
          showToast('Failed to create launch.json', 'error');
          markRunPanelLastAction('Failed to create .vscode/launch.json', 'error');
          if (state.sidePanelMode === 'run') renderSidePanelMode();
          return false;
        }
        created = true;
        addAiLog(`Manual createFile ${toProjectRelative(launchPath) || launchPath}`, 'info');
      }

      await refreshTree();
      await openFile(launchPath, { silent: false });
      markRunPanelLastAction(`${created ? 'Created' : 'Opened'} ${toProjectRelative(launchPath) || launchPath}`, created ? 'success' : 'info');
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return true;
    } catch (error) {
      showToast(`launch.json error: ${error?.message || error}`, 'error');
      markRunPanelLastAction(`launch.json error: ${error?.message || error}`, 'error');
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return false;
    }
  }

  async function openRunDebugUrlPrompt() {
    const rp = ensureRunPanelState();
    const input = await promptExplorerInput({
      title: 'Debug URL',
      message: 'Open a URL for browser debugging preview (http/https).',
      confirmLabel: 'Open',
      value: rp.lastDebugUrl || 'http://localhost:3000',
      placeholder: 'http://localhost:3000'
    });
    if (!input) return false;

    const url = String(input || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      showToast('Enter a valid http/https URL', 'warn');
      markRunPanelLastAction('Debug URL rejected (invalid URL)', 'warn');
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return false;
    }

    rp.lastDebugUrl = url;
    try {
      window.open(url, '_blank', 'noopener');
      showToast('Opened URL in browser', 'success');
      markRunPanelLastAction(`Opened debug URL: ${url}`, 'success');
    } catch (_) {
      showToast('Unable to open URL', 'error');
      markRunPanelLastAction(`Failed to open debug URL: ${url}`, 'error');
    }
    if (state.sidePanelMode === 'run') renderSidePanelMode();
    return true;
  }

  async function startRunPanelSession(options = {}) {
    const debug = options.debug !== false;
    const rp = ensureRunPanelState();
    const profile = getRunPanelProfile();
    if (!profile.hasFile) {
      showToast('Open a file to run or debug', 'warn');
      markRunPanelLastAction(debug ? 'Debug requested without an active file' : 'Run requested without an active file', 'warn');
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return false;
    }

    if (debug && rp.configId === 'browser-url') {
      await openRunDebugUrlPrompt();
      return true;
    }

    if (['launch-json', 'node-launch', 'node-current'].includes(String(rp.configId || ''))
      && !profile.builtInRun && !profile.builtInDebugPreview) {
      showToast('This configuration needs launch.json + backend integration. Opening launch.json setup.', 'warn');
      await createOrOpenRunLaunchJson();
      markRunPanelLastAction(`Prepared launch.json setup for ${profile.fileName}`, 'warn');
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return true;
    }

    const activeFile = state.files.get(state.activePath);
    if (rp.autoSaveBeforeRun && activeFile?.dirty) {
      const saved = await saveActiveFile();
      if (!saved) {
        showToast('Save failed. Run canceled.', 'error');
        markRunPanelLastAction('Run canceled because auto-save failed', 'error');
        if (state.sidePanelMode === 'run') renderSidePanelMode();
        return false;
      }
    }

    if (debug) {
      if (profile.builtInDebugPreview) {
        const ok = await runActiveFile();
        if (ok) {
          showToast('Debug UI started in preview mode (breakpoints are not implemented yet)', 'warn');
          markRunPanelLastAction(`Started preview debug session for ${profile.fileName}`, 'success');
        } else {
          markRunPanelLastAction(`Failed to start preview debug session for ${profile.fileName}`, 'error');
        }
      } else {
        showToast('Debugger backend is not implemented yet. Configure launch.json for later compatibility.', 'warn');
        markRunPanelLastAction(`Debug setup prepared for ${profile.fileName} (backend pending)`, 'warn');
      }
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return true;
    }

    const ok = await runActiveFile();
    if (profile.kind === 'c' && profile.builtInRun) {
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return true;
    }
    const builtInLabel = profile.kind === 'html' ? 'built-in preview' : 'built-in runner';
    if (profile.builtInRun && ok) {
      markRunPanelLastAction(`Ran ${profile.fileName} using ${builtInLabel}`, 'success');
    } else if (profile.builtInRun && !ok) {
      markRunPanelLastAction(`Failed to run ${profile.fileName} in ${builtInLabel}`, 'error');
    } else {
      markRunPanelLastAction(`Run requested for ${profile.fileName} (backend pending for ${profile.engineLabel})`, 'warn');
    }
    if (state.sidePanelMode === 'run') renderSidePanelMode();
    return true;
  }

  async function handleRunPanelSideAction(action, btn) {
    const act = String(action || '');
    if (!act.startsWith('run-')) return false;

    if (act === 'run-toggle-section') {
      const section = String(btn?.dataset?.runSection || '').trim();
      const rp = ensureRunPanelState();
      if (section && Object.prototype.hasOwnProperty.call(rp.sectionExpanded, section)) {
        rp.sectionExpanded[section] = !rp.sectionExpanded[section];
        scheduleSessionSave();
        if (state.sidePanelMode === 'run') renderSidePanelMode();
      }
      return true;
    }

    if (act === 'run-refresh-panel') {
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return true;
    }

    if (act === 'run-open-launch-json') {
      await createOrOpenRunLaunchJson();
      return true;
    }

    if (act === 'run-debug-terminal') {
      showToast('JavaScript Debug Terminal is not implemented yet in Coder', 'warn');
      markRunPanelLastAction('JavaScript Debug Terminal requested (coming soon)', 'warn');
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return true;
    }

    if (act === 'run-debug-url') {
      await openRunDebugUrlPrompt();
      return true;
    }

    if (act === 'run-debug-start') {
      await startRunPanelSession({ debug: true });
      return true;
    }

    if (act === 'run-no-debug' || act === 'run-active') {
      await startRunPanelSession({ debug: false });
      return true;
    }

    return false;
  }

  function renderExtensionsPanelHtml() {
    const extensions = Array.isArray(state.extensionCatalog) ? state.extensionCatalog : [];
    const searchQuery = String(state.marketplaceQuery || '');
    const searchInputValue = String(state.marketplaceQueryInput ?? state.marketplaceQuery ?? '');
    const marketResults = Array.isArray(state.marketplaceResults) ? state.marketplaceResults : [];
    const marketLoading = Boolean(state.marketplaceLoading);
    const marketError = String(state.marketplaceError || '');
    const showMarketplaceCard = Boolean(state.marketplaceSearched || marketLoading || marketError || marketResults.length);

    let html = `
      <div class="side-panel-stack">
        <div class="side-panel-card">
          <div class="ext-market-search">
            <div class="search-box">
              <input id="ext-marketplace-query" type="text" value="${escapeHtml(searchInputValue)}" placeholder="Search Extensions in Marketplace" autocomplete="off" spellcheck="false">
              <button class="side-tool-btn" data-side-action="extensions-marketplace-search">Search</button>
            </div>
            <div class="side-meta">Marketplace: Open VSX | Host: ${escapeHtml(state.extensionHostStatus || 'unknown')}</div>
          </div>
        </div>
    `;

    if (showMarketplaceCard) {
      html += `
        <div class="side-panel-card">
          <h4>Marketplace</h4>
          ${marketLoading ? '<p class="ext-market-empty">Searching marketplace...</p>' : ''}
          ${!marketLoading && marketError ? `<p class="ext-market-empty">Search failed: ${escapeHtml(marketError)}</p>` : ''}
          ${!marketLoading && !marketError ? renderMarketplaceResultsHtml(marketResults, searchQuery) : ''}
        </div>
      `;
    }

    if (!extensions.length) {
      html += `
        <div class="side-panel-card">
          <h4>Installed</h4>
          <p>No Coder extensions installed yet. Install a VSIX package to load compatible command/language extensions.</p>
        </div>
      `;
    } else {
      html += `
        <div class="side-panel-card">
          <h4>Installed</h4>
        </div>
        <div class="ext-list">
      `;
      for (const ext of extensions) {
        html += renderInstalledExtensionItemHtml(ext);
      }
      html += `</div>`;
    }

    html += `</div>`;

    return html;
  }

  function renderInstalledExtensionItemHtml(ext = {}) {
    const enabled = ext.enabled !== false;
    const extId = String(ext.id || '');
    const displayName = String(ext.displayName || ext.name || extId || 'Extension');
    const desc = String(ext.description || '').trim();
    const iconUrl = String(ext.iconUrl || '').trim();
    const publisher = String(ext.publisherDisplayName || ext.publisher || '').trim();
    const runtimeCommands = Array.isArray(ext.commands) ? ext.commands.length : 0;
    const contributesCommands = countContributedCommands(ext.contributes);
    const hasRuntime = runtimeCommands > 0;
    const err = String(state.extensionErrors?.[extId] || '').trim();

    const metaBits = [];
    if (ext.version) metaBits.push(`v${ext.version}`);
    if (runtimeCommands > 0) metaBits.push(`${runtimeCommands} runtime command${runtimeCommands === 1 ? '' : 's'}`);
    if (contributesCommands > 0) metaBits.push(`${contributesCommands} contributed`);

    return `
      <div class="ext-market-item ext-installed-item" data-side-action="extensions-installed-details" data-extension-id="${escapeHtml(extId)}" tabindex="0" role="button" aria-label="Open details for ${escapeHtml(displayName)}" title="Open extension details and README">
        ${iconUrl
          ? `<img src="${escapeHtml(iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;icon-fallback&quot;>${escapeHtml((displayName[0] || 'E').toUpperCase())}</div>'">`
          : `<div class="icon-fallback">${escapeHtml((displayName[0] || 'E').toUpperCase())}</div>`}
        <div class="main">
          <div class="row-top">
            <div class="name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
            <span class="ext-badge ${enabled ? '' : 'off'}">${enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div class="desc">${escapeHtml(desc || 'No description')}</div>
          <div class="publisher" title="${escapeHtml(publisher)}">${escapeHtml(publisher || 'Unknown publisher')}</div>
          <div class="sub" title="${escapeHtml(extId)}">${escapeHtml(extId)}</div>
          <div class="installed-meta">${metaBits.map((m) => `<span>${escapeHtml(m)}</span>`).join('')}</div>
          ${err ? `<div class="error-note">Activation/runtime error: ${escapeHtml(err)}</div>` : ''}
        </div>
      </div>
    `;
  }

  function countContributedCommands(contributes) {
    const commands = contributes && Array.isArray(contributes.commands) ? contributes.commands : [];
    return commands.length;
  }

  function normalizeExtensionDetail(detail = {}) {
    if (!detail || typeof detail !== 'object') return null;
    const id = String(detail.id || '').trim();
    const displayName = String(detail.displayName || detail.name || id || 'Extension').trim();
    if (!id && !displayName) return null;
    const explicitName = String(detail.name || '').trim();
    const explicitNamespace = String(detail.namespace || detail.publisher || '').trim();
    const parsedIdParts = id && id.includes('.') ? id.split('.').map((v) => String(v || '').trim()).filter(Boolean) : [];
    const namespace = explicitNamespace || (parsedIdParts.length > 1 ? parsedIdParts[0] : '');
    const name = explicitName || (parsedIdParts.length > 1 ? parsedIdParts.slice(1).join('.') : '');
    const publisher = String(detail.publisher || namespace).trim();
    return {
      source: String(detail.source || 'marketplace'),
      id: id || displayName,
      name,
      namespace,
      displayName,
      description: String(detail.description || '').trim(),
      publisher,
      publisherDisplayName: String(detail.publisherDisplayName || publisher || namespace || '').trim(),
      version: String(detail.version || '').trim(),
      iconUrl: String(detail.iconUrl || '').trim(),
      homepageUrl: String(detail.homepageUrl || '').trim(),
      downloadCount: Number(detail.downloadCount) || 0,
      averageRating: Number(detail.averageRating) || 0,
      reviewCount: Number(detail.reviewCount) || 0,
      installed: Boolean(detail.installed),
      enabled: detail.enabled !== false,
      runtimeCommands: Number(detail.runtimeCommands || 0) || 0,
      contributedCommands: Number(detail.contributedCommands || 0) || 0,
      commands: Array.isArray(detail.commands) ? detail.commands : [],
      activationEvents: Array.isArray(detail.activationEvents) ? detail.activationEvents.map((v) => String(v || '').trim()).filter(Boolean) : [],
      enabledApiProposals: Array.isArray(detail.enabledApiProposals) ? detail.enabledApiProposals.map((v) => String(v || '').trim()).filter(Boolean) : [],
      contributes: detail.contributes && typeof detail.contributes === 'object' ? detail.contributes : {},
      compatibilityMode: String(detail.compatibilityMode || '').trim(),
      runtimeError: String(detail.runtimeError || '').trim(),
      mayNeedUnsupportedApis: Boolean(detail.mayNeedUnsupportedApis),
      categories: Array.isArray(detail.categories) ? detail.categories.map((v) => String(v || '').trim()).filter(Boolean) : [],
      tags: Array.isArray(detail.tags) ? detail.tags.map((v) => String(v || '').trim()).filter(Boolean) : [],
      license: String(detail.license || '').trim(),
      repositoryUrl: String(detail.repositoryUrl || '').trim(),
      timestamp: detail.timestamp || '',
      publishedDate: detail.publishedDate || '',
      lastUpdated: detail.lastUpdated || '',
      files: detail.files && typeof detail.files === 'object' ? detail.files : {},
      allVersions: Array.isArray(detail.allVersions) ? detail.allVersions.map((v) => String(v || '')).filter(Boolean) : [],
      engines: detail.engines && typeof detail.engines === 'object' ? detail.engines : {},
      readmeMarkdown: String(detail.readmeMarkdown || '').trim(),
      detailLoading: Boolean(detail.detailLoading),
      detailLoaded: Boolean(detail.detailLoaded),
      detailError: String(detail.detailError || '').trim(),
      detailTab: String(detail.detailTab || '').trim() || '',
      featureSection: String(detail.featureSection || '').trim() || ''
    };
  }

  function openExtensionDetailView(detailInput = {}) {
    const detail = normalizeExtensionDetail(detailInput);
    if (!detail) return;
    if (!detail.detailTab) detail.detailTab = 'details';
    if (!detail.featureSection) detail.featureSection = 'runtime-status';
    const currentFile = state.activePath && state.files.has(state.activePath) ? state.activePath : '';
    const previous = state.extensionDetailView?.prevFilePath && state.files.has(state.extensionDetailView.prevFilePath)
      ? state.extensionDetailView.prevFilePath
      : '';
    state.extensionDetailView = {
      ...detail,
      active: true,
      prevFilePath: currentFile || previous || ''
    };
    state.activeExtensionWebviewPanelId = '';
    state.activePath = '';
    renderTabs();
    renderEditorShell();
    void loadExtensionDetailFromMarketplace({ force: false });
    scheduleSessionSave();
  }

  function activateExtensionDetailView() {
    if (!state.extensionDetailView) return;
    if (state.activePath && state.files.has(state.activePath)) {
      state.extensionDetailView.prevFilePath = state.activePath;
    }
    state.extensionDetailView.active = true;
    state.activeExtensionWebviewPanelId = '';
    state.activePath = '';
    renderTabs();
    renderEditorShell();
    scheduleSessionSave();
  }

  function closeExtensionDetailView() {
    if (!state.extensionDetailView) return;
    const restorePath = state.extensionDetailView.prevFilePath && state.files.has(state.extensionDetailView.prevFilePath)
      ? state.extensionDetailView.prevFilePath
      : (state.tabs.find((p) => state.files.has(p)) || '');
    state.extensionDetailView = null;
    if (restorePath) {
      activateTab(restorePath);
      return;
    }
    state.activePath = '';
    renderTabs();
    renderEditorShell();
    scheduleSessionSave();
  }

  function refreshOpenExtensionDetailViewFromState() {
    const detail = state.extensionDetailView;
    if (!detail) return;
    const extId = String(detail.id || '').trim();
    if (!extId) return;

    if (detail.source === 'installed') {
      const ext = (Array.isArray(state.extensionCatalog) ? state.extensionCatalog : [])
        .find((entry) => String(entry?.id || '').trim() === extId);
      if (ext) {
        const runtimeCommands = Array.isArray(ext.commands) ? ext.commands.length : 0;
        const contributedCommands = countContributedCommands(ext.contributes);
        const err = String(state.extensionErrors?.[extId] || '').trim();
        const mayNeedUnsupportedApis = ext.enabled !== false && runtimeCommands === 0 &&
          (contributedCommands > 0 || /codex|kilo|copilot|agent|chat/i.test(extId));
        const next = normalizeExtensionDetail({
          ...ext,
          source: 'installed',
          installed: true,
          runtimeCommands,
          contributedCommands,
          runtimeError: err,
          mayNeedUnsupportedApis
        });
        if (next) {
          state.extensionDetailView = {
            ...mergeExtensionDetailSummary(detail, next),
            active: detail.active === true,
            prevFilePath: detail.prevFilePath || ''
          };
        }
      }
    } else {
      const item = (Array.isArray(state.marketplaceResults) ? state.marketplaceResults : [])
        .find((entry) => String(entry?.id || '').trim() === extId);
      if (item) {
        const next = normalizeExtensionDetail({
          ...item,
          source: 'marketplace',
          installed: Array.isArray(state.extensionCatalog) && state.extensionCatalog.some((ext) => String(ext.id || '') === extId),
          compatibilityMode: 'controlled-vscode'
        });
        if (next) {
          state.extensionDetailView = {
            ...mergeExtensionDetailSummary(detail, next),
            active: detail.active === true,
            prevFilePath: detail.prevFilePath || ''
          };
        }
      } else if (Array.isArray(state.extensionCatalog) && state.extensionCatalog.some((ext) => String(ext.id || '').trim() === extId)) {
        const ext = state.extensionCatalog.find((entry) => String(entry?.id || '').trim() === extId);
        if (ext) {
          const runtimeCommands = Array.isArray(ext.commands) ? ext.commands.length : 0;
          const contributedCommands = countContributedCommands(ext.contributes);
          const err = String(state.extensionErrors?.[extId] || '').trim();
          const mayNeedUnsupportedApis = ext.enabled !== false && runtimeCommands === 0 &&
            (contributedCommands > 0 || /codex|kilo|copilot|agent|chat/i.test(extId));
          const next = normalizeExtensionDetail({
            ...ext,
            source: 'installed',
            installed: true,
            runtimeCommands,
            contributedCommands,
            runtimeError: err,
            mayNeedUnsupportedApis
          });
          if (next) {
            state.extensionDetailView = {
              ...mergeExtensionDetailSummary(detail, next),
              active: detail.active === true,
              prevFilePath: detail.prevFilePath || ''
            };
          }
        }
      }
    }

    if (state.extensionDetailView && !state.extensionDetailView.detailLoaded && !state.extensionDetailView.detailLoading) {
      void loadExtensionDetailFromMarketplace({ force: false });
    }

    if (state.extensionDetailView?.active) {
      renderTabs();
      renderEditorShell();
    }
  }

  function mergeExtensionDetailSummary(existing, next) {
    const prev = existing && typeof existing === 'object' ? existing : {};
    const cur = next && typeof next === 'object' ? next : {};
    const mergedFiles = { ...(prev.files || {}) };
    if (cur.files && typeof cur.files === 'object') Object.assign(mergedFiles, cur.files);
    const nextCategories = Array.isArray(cur.categories) && cur.categories.length ? cur.categories : (Array.isArray(prev.categories) ? prev.categories : []);
    const nextTags = Array.isArray(cur.tags) && cur.tags.length ? cur.tags : (Array.isArray(prev.tags) ? prev.tags : []);
    const nextVersions = Array.isArray(cur.allVersions) && cur.allVersions.length ? cur.allVersions : (Array.isArray(prev.allVersions) ? prev.allVersions : []);
    const nextEngines = (cur.engines && Object.keys(cur.engines).length) ? cur.engines : (prev.engines || {});
    const nextCommands = Array.isArray(cur.commands) && cur.commands.length ? cur.commands : (Array.isArray(prev.commands) ? prev.commands : []);
    const nextActivationEvents = Array.isArray(cur.activationEvents) && cur.activationEvents.length ? cur.activationEvents : (Array.isArray(prev.activationEvents) ? prev.activationEvents : []);
    const nextApiProposals = Array.isArray(cur.enabledApiProposals) && cur.enabledApiProposals.length ? cur.enabledApiProposals : (Array.isArray(prev.enabledApiProposals) ? prev.enabledApiProposals : []);
    const nextContributes = (cur.contributes && Object.keys(cur.contributes).length) ? cur.contributes : (prev.contributes || {});
    return {
      ...prev,
      ...cur,
      files: mergedFiles,
      categories: nextCategories,
      tags: nextTags,
      allVersions: nextVersions,
      engines: nextEngines,
      commands: nextCommands,
      activationEvents: nextActivationEvents,
      enabledApiProposals: nextApiProposals,
      contributes: nextContributes,
      license: cur.license || prev.license || '',
      repositoryUrl: cur.repositoryUrl || prev.repositoryUrl || '',
      timestamp: cur.timestamp || prev.timestamp || '',
      publishedDate: cur.publishedDate || prev.publishedDate || '',
      lastUpdated: cur.lastUpdated || prev.lastUpdated || '',
      readmeMarkdown: cur.readmeMarkdown || prev.readmeMarkdown || '',
      detailTab: cur.detailTab || prev.detailTab || '',
      featureSection: cur.featureSection || prev.featureSection || '',
      detailLoaded: cur.detailLoaded === true || prev.detailLoaded === true,
      detailLoading: cur.detailLoading === true,
      detailError: cur.detailError || prev.detailError || ''
    };
  }

  function getExtensionDetailMarketplaceCoords(detail = state.extensionDetailView) {
    if (!detail || typeof detail !== 'object') return null;
    const namespace = String(detail.namespace || detail.publisher || '').trim();
    const name = String(detail.name || '').trim();
    const version = String(detail.version || '').trim();
    if (!namespace || !name) return null;
    return { namespace, name, version };
  }

  function getExtensionDetailCacheKey(detail = state.extensionDetailView) {
    const coords = getExtensionDetailMarketplaceCoords(detail);
    if (!coords) return '';
    return `${coords.namespace}.${coords.name}@${coords.version || 'latest'}`.toLowerCase();
  }

  function extensionDetailNeedsReadmeRetry(detail = {}) {
    if (!detail || typeof detail !== 'object') return false;
    const readmeMarkdown = String(detail.readmeMarkdown || '').trim();
    const readmeUrl = String(detail?.files?.readme || '').trim();
    return Boolean(readmeUrl && !readmeMarkdown);
  }

  function createExtensionDetailCacheEntry(detail = {}) {
    const normalized = normalizeExtensionDetail(detail);
    if (!normalized) return null;
    const {
      detailTab,
      featureSection,
      detailLoading,
      detailLoaded,
      detailError,
      ...cacheable
    } = normalized;
    return {
      ...cacheable,
      detailLoading: false,
      detailLoaded: !extensionDetailNeedsReadmeRetry(normalized),
      detailError: ''
    };
  }

  async function loadExtensionDetailFromMarketplace(options = {}) {
    const detail = state.extensionDetailView;
    if (!detail) return;
    const coords = getExtensionDetailMarketplaceCoords(detail);
    if (!coords) return;
    if (!api.extensions?.marketplaceDetails) return;
    const cacheKey = getExtensionDetailCacheKey(detail);
    const force = options.force === true;

    if (!force && cacheKey && state.extensionDetailCache && state.extensionDetailCache[cacheKey]) {
      const cached = normalizeExtensionDetail(state.extensionDetailCache[cacheKey]);
      const cacheNeedsRetry = extensionDetailNeedsReadmeRetry(cached);
      if (cached && !cacheNeedsRetry && state.extensionDetailView && String(state.extensionDetailView.id || '') === String(detail.id || '')) {
        state.extensionDetailView = {
          ...state.extensionDetailView,
          ...cached,
          active: state.extensionDetailView.active === true,
          prevFilePath: state.extensionDetailView.prevFilePath || '',
          detailTab: state.extensionDetailView.detailTab || 'details',
          featureSection: state.extensionDetailView.featureSection || 'runtime-status',
          detailLoading: false,
          detailLoaded: true,
          detailError: ''
        };
        if (state.extensionDetailView.active) renderEditorShell();
        return;
      }
    }

    const reqSeq = (Number(state.extensionDetailRequestSeq) || 0) + 1;
    state.extensionDetailRequestSeq = reqSeq;
    state.extensionDetailView = {
      ...detail,
      detailLoading: true,
      detailError: '',
      detailLoaded: Boolean(detail.detailLoaded && detail.readmeMarkdown)
    };
    if (state.extensionDetailView.active) renderEditorShell();

    try {
      const result = await api.extensions.marketplaceDetails(coords);
      if (state.extensionDetailRequestSeq !== reqSeq) return;
      if (!state.extensionDetailView || String(state.extensionDetailView.id || '') !== String(detail.id || '')) return;
      const err = String(result?.error || '').trim();
      if (err) {
        state.extensionDetailView = {
          ...state.extensionDetailView,
          detailLoading: false,
          detailLoaded: false,
          detailError: err
        };
        if (state.extensionDetailView.active) renderEditorShell();
        return;
      }
      const enriched = normalizeExtensionDetail({
        ...(state.extensionDetailView || {}),
        ...(result || {}),
        source: state.extensionDetailView?.source || detail.source || 'marketplace',
        installed: state.extensionDetailView?.installed === true || detail.installed === true,
        compatibilityMode: state.extensionDetailView?.compatibilityMode || 'controlled-vscode'
      });
      if (!enriched) return;
      const needsReadmeRetry = extensionDetailNeedsReadmeRetry(enriched);
      state.extensionDetailView = {
        ...(state.extensionDetailView || {}),
        ...enriched,
        active: state.extensionDetailView?.active === true,
        prevFilePath: state.extensionDetailView?.prevFilePath || '',
        detailTab: state.extensionDetailView?.detailTab || detail.detailTab || 'details',
        featureSection: state.extensionDetailView?.featureSection || detail.featureSection || 'runtime-status',
        detailLoading: false,
        detailLoaded: !needsReadmeRetry,
        detailError: ''
      };
      if (cacheKey) {
        if (!needsReadmeRetry) {
          const cacheEntry = createExtensionDetailCacheEntry(enriched);
          if (cacheEntry) {
            state.extensionDetailCache = {
              ...(state.extensionDetailCache || {}),
              [cacheKey]: cacheEntry
            };
          }
        } else if (state.extensionDetailCache?.[cacheKey]) {
          const nextCache = { ...(state.extensionDetailCache || {}) };
          delete nextCache[cacheKey];
          state.extensionDetailCache = nextCache;
        }
      }
      if (state.extensionDetailView.active) renderEditorShell();
    } catch (error) {
      if (state.extensionDetailRequestSeq !== reqSeq) return;
      if (!state.extensionDetailView || String(state.extensionDetailView.id || '') !== String(detail.id || '')) return;
      state.extensionDetailView = {
        ...state.extensionDetailView,
        detailLoading: false,
        detailLoaded: false,
        detailError: error?.message || String(error)
      };
      if (state.extensionDetailView.active) renderEditorShell();
    }
  }

  function renderMarketplaceResultsHtml(items, query) {
    const list = Array.isArray(items) ? items : [];
    const q = String(query || '').trim();
    if (!q) return '<p class="ext-market-empty">Type a search term to find extensions.</p>';
    if (!list.length) return '<p class="ext-market-empty">No marketplace results found.</p>';

    return `
      <div class="ext-market-list">
        ${list.slice(0, 18).map((item) => renderMarketplaceResultItemHtml(item)).join('')}
      </div>
    `;
  }

  function renderMarketplaceResultItemHtml(item = {}) {
    const displayName = String(item.displayName || item.name || item.id || 'Extension');
    const namespace = String(item.namespace || '').trim();
    const name = String(item.name || '').trim();
    const version = String(item.version || '').trim();
    const id = String(item.id || (namespace && name ? `${namespace}.${name}` : '')).trim();
    const desc = String(item.description || '').trim();
    const publisher = String(item.publisherDisplayName || namespace || '').trim();
    const iconUrl = String(item.iconUrl || '').trim();
    const installing = state.marketplaceInstalling === id;
    const installed = Array.isArray(state.extensionCatalog) && state.extensionCatalog.some((ext) => String(ext.id || '') === id);

    const metrics = [];
    if (installing) metrics.push('Installing...');
    else if (installed) metrics.push('Installed');
    if (Number(item.downloadCount) > 0) metrics.push(`${formatCompactNumber(Number(item.downloadCount))} installs`);
    if (Number(item.averageRating) > 0) metrics.push(`${Number(item.averageRating).toFixed(1)}★`);
    if (version) metrics.push(`v${version}`);

    return `
      <div class="ext-market-item"
        data-side-action="extensions-marketplace-details"
        data-ext-id="${escapeHtml(id)}"
        data-ext-namespace="${escapeHtml(namespace)}"
        data-ext-name="${escapeHtml(name)}"
        data-ext-version="${escapeHtml(version)}"
        data-ext-display-name="${escapeHtml(displayName)}"
        tabindex="0"
        role="button"
        aria-label="Open details for ${escapeHtml(displayName)}"
        title="Open extension details and README">
        ${iconUrl
          ? `<img src="${escapeHtml(iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;icon-fallback&quot;>${escapeHtml((displayName[0] || 'E').toUpperCase())}</div>'">`
          : `<div class="icon-fallback">${escapeHtml((displayName[0] || 'E').toUpperCase())}</div>`}
        <div class="main">
          <div class="name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
          <div class="desc">${escapeHtml(desc || 'No description')}</div>
          <div class="publisher" title="${escapeHtml(publisher)}">${escapeHtml(publisher || namespace || 'Unknown publisher')}</div>
          <div class="meta">${metrics.map((m) => `<span>${escapeHtml(m)}</span>`).join('')}</div>
        </div>
      </div>
    `;
  }

  async function handleSourceControlSideAction(action, btn) {
    const sc = state.sourceControl;
    if (!String(action || '').startsWith('git-')) return false;
    if (!sc) return true;

    const repoPath = getSourceControlRepoPath();
    const branch = getSourceControlTargetBranch();
    const remote = String(sc.remoteUrlDraft || '').trim() ? 'origin' : 'origin';

    if (action === 'git-refresh') {
      await refreshSourceControlState();
      return true;
    }

    if (!repoPath) {
      showToast('Open a project folder first', 'warn');
      return true;
    }

    if (!api.git) {
      showToast('Git API is unavailable in Coder', 'error');
      return true;
    }

    if (action === 'git-init') {
      await runSourceControlAction('git-init', 'Initialized Git repository', () =>
        api.git.init({ repoPath, branch })
      );
      return true;
    }

    if (action === 'git-save-config') {
      await runSourceControlAction('git-save-config', 'Saved Git setup', () =>
        api.git.saveConfig({
          repoPath,
          userName: String(sc.userNameDraft || '').trim(),
          userEmail: String(sc.userEmailDraft || '').trim(),
          remoteUrl: String(sc.remoteUrlDraft || '').trim(),
          branch
        })
      );
      return true;
    }

    if (action === 'git-stage-all') {
      if (hasDirtyFiles()) {
        const shouldSave = await confirmExplorerAction({
          title: 'Save Before Staging',
          message: 'You have unsaved files. Save all files before running Git Stage All?',
          confirmLabel: 'Save & Stage'
        });
        if (!shouldSave) return true;
        const saved = await saveAllFiles();
        if (!saved) return true;
      }
      await runSourceControlAction('git-stage-all', 'Staged all changes', () => api.git.stageAll(repoPath));
      return true;
    }

    if (action === 'git-commit') {
      const message = String(sc.commitMessage || '').trim();
      if (!message) {
        showToast('Enter a commit message first', 'warn');
        return true;
      }
      if (hasDirtyFiles()) {
        const shouldSave = await confirmExplorerAction({
          title: 'Save Before Commit',
          message: 'You have unsaved files. Save all files before commit?',
          confirmLabel: 'Save & Commit'
        });
        if (!shouldSave) return true;
        const saved = await saveAllFiles();
        if (!saved) return true;
      }
      const result = await runSourceControlAction('git-commit', 'Commit created', () => api.git.commit(repoPath, message));
      if (result?.success) {
        sc.commitMessage = '';
        renderSourceControlPanelIfVisible();
      }
      return true;
    }

    if (action === 'git-pull') {
      if (!String(sc.remoteUrlDraft || '').trim()) {
        showToast('Save the repository link (origin URL) first', 'warn');
        return true;
      }
      await runSourceControlAction('git-pull', 'Pulled latest changes', () =>
        api.git.pull({ repoPath, remote, branch, rebase: false })
      );
      return true;
    }

    if (action === 'git-push') {
      if (!String(sc.remoteUrlDraft || '').trim()) {
        showToast('Save the repository link (origin URL) first', 'warn');
        return true;
      }
      await runSourceControlAction('git-push', 'Pushed to remote', () =>
        api.git.push({ repoPath, remote, branch, setUpstream: true })
      );
      return true;
    }

    return false;
  }

  function handleSourceControlSideInput(target) {
    const sc = state.sourceControl;
    if (!sc || !target?.id) return false;
    if (target.id === 'sc-git-user-name') {
      sc.userNameDraft = String(target.value || '');
      scheduleSessionSave();
      return true;
    }
    if (target.id === 'sc-git-user-email') {
      sc.userEmailDraft = String(target.value || '');
      scheduleSessionSave();
      return true;
    }
    if (target.id === 'sc-git-remote-url') {
      sc.remoteUrlDraft = String(target.value || '');
      scheduleSessionSave();
      return true;
    }
    if (target.id === 'sc-git-branch') {
      sc.branchDraft = String(target.value || '');
      scheduleSessionSave();
      return true;
    }
    if (target.id === 'sc-git-commit-message') {
      sc.commitMessage = String(target.value || '');
      scheduleSessionSave();
      return true;
    }
    return false;
  }

  async function handleSourceControlSideKeydown(event) {
    const target = event?.target;
    if (!target?.id) return false;

    if (target.id === 'sc-git-commit-message' && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      await handleSourceControlSideAction('git-commit', null);
      return true;
    }

    if ((target.id === 'sc-git-remote-url' || target.id === 'sc-git-user-name' || target.id === 'sc-git-user-email' || target.id === 'sc-git-branch')
      && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await handleSourceControlSideAction('git-save-config', null);
      return true;
    }

    return false;
  }

  async function handleSidePanelClick(event) {
    const detailActionEl = event.target.closest('[data-ext-detail-action]');
    if (detailActionEl) {
      const detailAction = String(detailActionEl.dataset.extDetailAction || '');
      if (detailAction === 'close') {
        closeExtensionDetailView();
      } else if (detailAction === 'switch-tab') {
        if (!state.extensionDetailView) return;
        state.extensionDetailView.detailTab = String(detailActionEl.dataset.extDetailTab || 'details').trim() || 'details';
        if (!state.extensionDetailView.featureSection) state.extensionDetailView.featureSection = 'runtime-status';
        renderEditorShell();
        scheduleSessionSave();
      } else if (detailAction === 'feature-section') {
        if (!state.extensionDetailView) return;
        state.extensionDetailView.detailTab = 'features';
        state.extensionDetailView.featureSection = String(detailActionEl.dataset.extDetailSection || 'runtime-status').trim() || 'runtime-status';
        renderEditorShell();
        scheduleSessionSave();
      }
      return;
    }

    const btn = event.target.closest('[data-side-action]');
    if (!btn) return;
    const action = String(btn.dataset.sideAction || '');

    if (await handleSourceControlSideAction(action, btn)) {
      return;
    }
    if (await handleSearchPanelSideAction(action, btn)) {
      return;
    }
    if (await handleRunPanelSideAction(action, btn)) {
      return;
    }

    if (action === 'extensions-marketplace-details') {
      const extId = String(btn.dataset.extId || '').trim();
      const namespace = String(btn.dataset.extNamespace || '').trim();
      const name = String(btn.dataset.extName || '').trim();
      const version = String(btn.dataset.extVersion || '').trim();
      const displayName = String(btn.dataset.extDisplayName || '').trim();
      const item = (Array.isArray(state.marketplaceResults) ? state.marketplaceResults : [])
        .find((entry) => {
          const entryId = String(entry?.id || '').trim();
          const entryNamespace = String(entry?.namespace || entry?.publisher || '').trim();
          const entryName = String(entry?.name || '').trim();
          if (entryId && extId && entryId === extId) return true;
          if (namespace && name && entryNamespace && entryName) {
            return entryNamespace.localeCompare(namespace, undefined, { sensitivity: 'accent' }) === 0 &&
              entryName.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0;
          }
          return false;
        });
      if (!item && !(namespace && name)) {
        showToast('Could not open extension details. Try searching again.', 'warn');
        return;
      }
      openExtensionDetailView({
        ...(item || {}),
        id: extId || (namespace && name ? `${namespace}.${name}` : ''),
        namespace: (item && item.namespace) || namespace,
        name: (item && item.name) || name,
        version: (item && item.version) || version,
        displayName: (item && item.displayName) || displayName || name || extId || 'Extension',
        source: 'marketplace',
        installed: Array.isArray(state.extensionCatalog) && state.extensionCatalog.some((ext) => {
          const installedId = String(ext.id || '').trim();
          if (extId && installedId === extId) return true;
          if (!(namespace && name)) return false;
          const extNs = String(ext.namespace || ext.publisher || '').trim();
          const extName = String(ext.name || '').trim();
          return Boolean(extNs && extName &&
            extNs.localeCompare(namespace, undefined, { sensitivity: 'accent' }) === 0 &&
            extName.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0);
        }),
        compatibilityMode: 'controlled-vscode'
      });
      return;
    }

    if (action === 'extensions-installed-details') {
      const extId = String(btn.dataset.extensionId || '').trim();
      const ext = (Array.isArray(state.extensionCatalog) ? state.extensionCatalog : [])
        .find((entry) => String(entry?.id || '').trim() === extId);
      if (!ext) return;
      const runtimeCommands = Array.isArray(ext.commands) ? ext.commands.length : 0;
      const contributedCommands = countContributedCommands(ext.contributes);
      const err = String(state.extensionErrors?.[extId] || '').trim();
      const mayNeedUnsupportedApis = ext.enabled !== false && runtimeCommands === 0 &&
        (contributedCommands > 0 || /codex|kilo|copilot|agent|chat/i.test(extId));
      openExtensionDetailView({
        ...ext,
        source: 'installed',
        installed: true,
        runtimeCommands,
        contributedCommands,
        runtimeError: err,
        mayNeedUnsupportedApis
      });
      return;
    }

    if (action === 'open-folder') {
      await openFolderViaDialog();
      return;
    }
    if (action === 'open-file') {
      await openFileViaDialog();
      return;
    }
    if (action === 'refresh-tree') {
      await refreshTree();
      return;
    }
    if (action === 'run-active') {
      await runActiveFile();
      return;
    }
    if (action === 'open-extensions-panel') {
      await openExtensionsPanel();
      return;
    }
    if (action === 'extensions-refresh') {
      await refreshExtensionsBridgeState();
      renderSidePanelMode();
      return;
    }
    if (action === 'extensions-marketplace-search') {
      const input = document.getElementById('ext-marketplace-query');
      const rawValue = String(input?.value || state.marketplaceQueryInput || state.marketplaceQuery || '');
      const query = rawValue.trim();
      state.marketplaceQueryInput = rawValue;
      state.marketplaceQuery = query;
      await searchExtensionsMarketplace(query, { immediate: true });
      return;
    }
    if (action === 'extensions-marketplace-install') {
      const namespace = String(btn.dataset.extNamespace || '').trim();
      const name = String(btn.dataset.extName || '').trim();
      const version = String(btn.dataset.extVersion || '').trim();
      const extId = namespace && name ? `${namespace}.${name}` : '';
      if (!namespace || !name) return;
      if (!api.extensions?.installMarketplace) {
        showToast('Marketplace install is unavailable', 'error');
        return;
      }
      state.marketplaceInstalling = extId;
      renderSidePanelMode();
      if (state.extensionDetailView?.active) renderEditorShell();
      const result = await api.extensions.installMarketplace({ namespace, name, version });
      state.marketplaceInstalling = '';
      if (!result?.success) {
        showToast(`Marketplace install failed: ${result?.error || 'unknown error'}`, 'error');
        renderSidePanelMode();
        if (state.extensionDetailView?.active) renderEditorShell();
        return;
      }
      await refreshExtensionsBridgeState({ silent: true });
      renderSidePanelMode();
      if (state.extensionDetailView?.active) renderEditorShell();
      showToast(`Installed ${result.extension?.displayName || result.extension?.id || extId}`, 'success');
      return;
    }
    if (action === 'extensions-marketplace-open') {
      const url = String(btn.dataset.url || '').trim();
      if (!url) return;
      try {
        window.open(url, '_blank', 'noopener');
      } catch (_) {
        showToast('Unable to open marketplace page', 'warn');
      }
      return;
    }
    if (action === 'extensions-install') {
      if (!api.extensions?.selectAndInstallVsix) {
        showToast('Extension install API unavailable', 'error');
        return;
      }
      const result = await api.extensions.selectAndInstallVsix();
      if (result?.canceled) return;
      if (!result?.success) {
        showToast(`Install failed: ${result?.error || 'unknown error'}`, 'error');
        return;
      }
      await refreshExtensionsBridgeState();
      renderSidePanelMode();
      showToast(`Installed ${result.extension?.displayName || result.extension?.id || 'extension'}`, 'success');
      return;
    }
    if (action === 'extensions-toggle') {
      const extId = String(btn.dataset.extensionId || '');
      if (!extId || !api.extensions?.setEnabled) return;
      const currentlyEnabled = btn.dataset.enabled === '1';
      const result = await api.extensions.setEnabled(extId, !currentlyEnabled);
      if (!result?.success) {
        showToast(`Update failed: ${result?.error || 'unknown error'}`, 'error');
        return;
      }
      await refreshExtensionsBridgeState();
      renderSidePanelMode();
      return;
    }
    if (action === 'extensions-uninstall') {
      const extId = String(btn.dataset.extensionId || '');
      if (!extId || !api.extensions?.uninstall) return;
      const ok = await confirmExplorerAction({
        title: 'Uninstall Extension',
        message: `Uninstall "${extId}" from Coder?`,
        confirmLabel: 'Uninstall',
        danger: true
      });
      if (!ok) return;
      const result = await api.extensions.uninstall(extId);
      if (!result?.success) {
        showToast(`Uninstall failed: ${result?.error || 'unknown error'}`, 'error');
        return;
      }
      await refreshExtensionsBridgeState();
      renderSidePanelMode();
      showToast('Extension removed', 'success');
      return;
    }
    if (action === 'extensions-run-command') {
      const commandId = String(btn.dataset.commandId || '');
      if (!commandId || !api.extensions?.executeCommand) return;
      const result = await api.extensions.executeCommand(commandId, []);
      if (result?.success === false) {
        showToast(`Command failed: ${result?.error || 'unknown error'}`, 'error');
      } else {
        showToast(`Ran ${commandId}`, 'success');
      }
      return;
    }
  }

  function handleSidePanelInput(event) {
    const target = event.target;
    if (!target) return;
    if (handleSourceControlSideInput(target)) return;
    if (target.id === 'search-query-input') {
      const sp = ensureSearchPanelState();
      sp.query = String(target.value || '');
      sp.error = '';
      scheduleSessionSave();
      scheduleSearchPanelRun({ source: 'query' });
      return;
    }
    if (target.id === 'search-replace-input') {
      const sp = ensureSearchPanelState();
      sp.replaceQuery = String(target.value || '');
      scheduleSessionSave();
      return;
    }
    if (target.id === 'search-include-input') {
      const sp = ensureSearchPanelState();
      sp.includePattern = String(target.value || '');
      scheduleSessionSave();
      scheduleSearchPanelRun({ source: 'include' });
      return;
    }
    if (target.id === 'search-exclude-input') {
      const sp = ensureSearchPanelState();
      sp.excludePattern = String(target.value || '');
      scheduleSessionSave();
      scheduleSearchPanelRun({ source: 'exclude' });
      return;
    }
    if (target.id === 'run-config-select') {
      const rp = ensureRunPanelState();
      rp.configId = String(target.value || 'auto').trim() || 'auto';
      scheduleSessionSave();
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return;
    }
    if (target.id === 'run-console-select') {
      const rp = ensureRunPanelState();
      rp.consoleMode = String(target.value || 'integratedTerminal');
      scheduleSessionSave();
      return;
    }
    if (target.id === 'run-auto-save-before-run') {
      const rp = ensureRunPanelState();
      rp.autoSaveBeforeRun = Boolean(target.checked);
      scheduleSessionSave();
      return;
    }
    if (target.id === 'run-stop-on-entry') {
      const rp = ensureRunPanelState();
      rp.stopOnEntry = Boolean(target.checked);
      scheduleSessionSave();
      return;
    }
    if (target.id === 'ext-marketplace-query') {
      state.marketplaceQueryInput = String(target.value || '');
    }
  }

  async function handleSidePanelKeydown(event) {
    const target = event.target;
    if (!target) return;
    if (await handleSourceControlSideKeydown(event)) return;
    if ((target.id === 'search-query-input' || target.id === 'search-include-input' || target.id === 'search-exclude-input')
      && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const sp = ensureSearchPanelState();
      if (target.id === 'search-query-input') sp.query = String(target.value || '');
      if (target.id === 'search-include-input') sp.includePattern = String(target.value || '');
      if (target.id === 'search-exclude-input') sp.excludePattern = String(target.value || '');
      await runSearchPanelQuery({ source: 'manual' });
      return;
    }
    if (target.id === 'ext-marketplace-query' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      state.marketplaceQueryInput = String(target.value || '');
      state.marketplaceQuery = String(target.value || '').trim();
      await searchExtensionsMarketplace(state.marketplaceQuery, { immediate: true });
    }
  }

  function scheduleExtensionsMarketplaceSearch(query) {
    clearTimeout(state.marketplaceSearchTimer);
    const q = String(query || '').trim();
    if (!q) {
      state.marketplaceResults = [];
      state.marketplaceTotal = 0;
      state.marketplaceError = '';
      state.marketplaceLoading = false;
      state.marketplaceSearched = false;
      if (state.sidePanelMode === 'extensions') renderSidePanelMode();
      return;
    }
    if (q.length < 2) {
      // Avoid firing/re-rendering on the first character while the user is still typing.
      return;
    }
    state.marketplaceSearchTimer = setTimeout(() => {
      void searchExtensionsMarketplace(q);
    }, 320);
  }

  async function searchExtensionsMarketplace(query, options = {}) {
    const q = String(query || '').trim();
    const requestSeq = (Number(state.marketplaceRequestSeq) || 0) + 1;
    state.marketplaceRequestSeq = requestSeq;
    if (!api.extensions?.marketplaceSearch) {
      state.marketplaceError = 'Marketplace API unavailable';
      state.marketplaceLoading = false;
      state.marketplaceSearched = true;
      if (state.sidePanelMode === 'extensions') renderSidePanelMode();
      return;
    }
    if (!q) {
      state.marketplaceResults = [];
      state.marketplaceTotal = 0;
      state.marketplaceError = '';
      state.marketplaceLoading = false;
      state.marketplaceSearched = false;
      if (state.sidePanelMode === 'extensions') renderSidePanelMode();
      return;
    }

    state.marketplaceQuery = q;
    state.marketplaceLoading = true;
    state.marketplaceError = '';
    if (state.sidePanelMode === 'extensions') renderSidePanelMode();

    try {
      const result = await api.extensions.marketplaceSearch(q, { size: 18 });
      if (state.marketplaceRequestSeq !== requestSeq) return;
      const items = Array.isArray(result?.items) ? [...result.items] : [];
      items.sort((a, b) => {
        const aDownloads = Number(a?.downloadCount) || 0;
        const bDownloads = Number(b?.downloadCount) || 0;
        if (bDownloads !== aDownloads) return bDownloads - aDownloads;

        const aRating = Number(a?.averageRating) || 0;
        const bRating = Number(b?.averageRating) || 0;
        if (bRating !== aRating) return bRating - aRating;

        const aName = String(a?.displayName || a?.name || a?.id || '');
        const bName = String(b?.displayName || b?.name || b?.id || '');
        return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
      });
      state.marketplaceResults = items;
      state.marketplaceTotal = Number(result?.total) || state.marketplaceResults.length;
      state.marketplaceError = String(result?.error || '');
      state.marketplaceSearched = true;
    } catch (error) {
      if (state.marketplaceRequestSeq !== requestSeq) return;
      state.marketplaceResults = [];
      state.marketplaceTotal = 0;
      state.marketplaceError = error?.message || String(error);
      state.marketplaceSearched = true;
    } finally {
      if (state.marketplaceRequestSeq !== requestSeq) return;
      state.marketplaceLoading = false;
      refreshOpenExtensionDetailViewFromState();
      if (state.sidePanelMode === 'extensions') renderSidePanelMode();
      if (!options.immediate && state.marketplaceError) {
        // avoid toast spam for debounce requests
      }
    }
  }

  function formatCompactNumber(value) {
    const n = Number(value) || 0;
    if (n >= 1000000) return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return String(n);
  }

  function normalizeExtensionCommandEntry(raw, context = 'extensions.listCommands') {
    if (!raw || typeof raw !== 'object') {
      warnExtensionPayloadIssue('command.record', raw, context);
      return null;
    }
    const id = safeString(raw.id || raw.commandId).trim();
    if (!id) {
      warnExtensionPayloadIssue('command.id', raw?.id, context);
      return null;
    }
    const extensionId = safeString(raw.extensionId).trim();
    if (!extensionId) warnExtensionPayloadIssue('command.extensionId', raw?.extensionId, context);
    return {
      id,
      title: safeString(raw.title).trim() || id,
      extensionId,
      source: safeString(raw.source).trim(),
      windowId: Number(raw.windowId) || 0
    };
  }

  function normalizeExtensionCatalogEntry(raw, context = 'extensions.list') {
    if (!raw || typeof raw !== 'object') {
      warnExtensionPayloadIssue('record', raw, context);
      return null;
    }
    const id = safeString(raw.id).trim();
    if (!id) {
      warnExtensionPayloadIssue('id', raw?.id, context);
      return null;
    }
    if (typeof raw.displayName !== 'string' && raw.displayName != null) warnExtensionPayloadIssue(`${id}.displayName`, raw.displayName, context);
    if (typeof raw.description !== 'string' && raw.description != null) warnExtensionPayloadIssue(`${id}.description`, raw.description, context);
    if (typeof raw.version !== 'string' && raw.version != null) warnExtensionPayloadIssue(`${id}.version`, raw.version, context);
    if (typeof raw.publisher !== 'string' && raw.publisher != null) warnExtensionPayloadIssue(`${id}.publisher`, raw.publisher, context);

    const name = safeString(raw.name).trim() || id.split('.').slice(-1)[0] || id;
    const publisher = safeString(raw.publisher).trim() || id.split('.')[0] || 'unknown';
    const version = safeString(raw.version).trim() || '0.0.0';
    const displayName = safeString(raw.displayName).trim() || name || id;
    return {
      id,
      displayName,
      name,
      publisher,
      publisherDisplayName: safeString(raw.publisherDisplayName).trim() || publisher,
      version,
      description: safeString(raw.description).trim(),
      enabled: raw.enabled !== false,
      activationEvents: Array.isArray(raw.activationEvents)
        ? raw.activationEvents.map((v) => safeString(v).trim()).filter(Boolean)
        : [],
      contributes: raw.contributes && typeof raw.contributes === 'object' ? raw.contributes : {},
      enabledApiProposals: Array.isArray(raw.enabledApiProposals)
        ? raw.enabledApiProposals.map((v) => safeString(v).trim()).filter(Boolean)
        : [],
      installPath: safeString(raw.installPath).trim(),
      iconUrl: safeString(raw.iconUrl).trim(),
      browser: safeString(raw.browser).trim(),
      compatibilityMode: safeString(raw.compatibilityMode).trim() || 'controlled-vscode',
      commands: Array.isArray(raw.commands)
        ? raw.commands.map((cmd) => normalizeExtensionCommandEntry(cmd, `${context}.commands`)).filter(Boolean)
        : []
    };
  }

  async function initExtensionsBridge() {
    if (!api.extensions) return;
    try {
      if (typeof state.extensionEventUnsub === 'function') {
        try { state.extensionEventUnsub(); } catch (_) {}
      }
      if (typeof api.extensions.onEvent === 'function') {
        state.extensionEventUnsub = api.extensions.onEvent((payload) => {
          void handleExtensionsBridgeEvent(payload);
        });
      }
      await refreshExtensionsBridgeState({ silent: true });
      renderExtensionRailButtons();
      bindExtensionsDebugApi();
      notifyExtensionsEditorEvent('coderReady', {
        projectRoot: state.projectRoot || '',
        activePath: state.activePath || ''
      });
    } catch (error) {
      console.warn('[Coder][Extensions] init failed:', error);
    }
  }

  async function refreshExtensionsBridgeState(options = {}) {
    if (!api.extensions) return;
    try {
      const [catalog, commands] = await Promise.all([
        Promise.resolve(api.extensions.list?.()),
        Promise.resolve(api.extensions.listCommands?.())
      ]);
      state.extensionCatalog = Array.isArray(catalog)
        ? catalog.map((ext) => normalizeExtensionCatalogEntry(ext, 'extensions.list')).filter(Boolean)
        : [];
      state.extensionCommands = Array.isArray(commands)
        ? commands.map((cmd) => normalizeExtensionCommandEntry(cmd, 'extensions.listCommands')).filter(Boolean)
        : [];
      state.extensionActivityItems = buildExtensionActivityItems(state.extensionCatalog);
      if (state.activeExtensionActivityId) {
        const stillExists = state.extensionActivityItems.some((item) => item.id === state.activeExtensionActivityId);
        if (!stillExists) {
          state.activeExtensionActivityId = '';
          if (state.sidePanelMode === 'extension') state.sidePanelMode = 'extensions';
        }
      }
      const validIds = new Set(state.extensionCatalog.map((ext) => String(ext?.id || '')).filter(Boolean));
      if (state.extensionErrors && typeof state.extensionErrors === 'object') {
        const nextErrors = {};
        for (const [id, msg] of Object.entries(state.extensionErrors)) {
          if (validIds.has(id)) nextErrors[id] = msg;
        }
        state.extensionErrors = nextErrors;
      }
      if (!options.silent && state.extensionCatalog.length) {
        setMainStatus(`Extensions: ${state.extensionCatalog.filter((ext) => ext.enabled !== false).length} enabled`);
      }
      renderRailButtons();
      refreshOpenExtensionDetailViewFromState();
    } catch (error) {
      console.warn('[Coder][Extensions] refresh failed:', error);
    }
  }

  function buildExtensionActivityItems(extensions) {
    const list = Array.isArray(extensions) ? extensions : [];
    const out = [];
    for (const ext of list) {
      if (!ext || ext.enabled === false) continue;
      const contributes = ext.contributes && typeof ext.contributes === 'object' ? ext.contributes : {};
      const viewsContainers = contributes.viewsContainers && typeof contributes.viewsContainers === 'object'
        ? contributes.viewsContainers
        : {};
      const activityContainers = Array.isArray(viewsContainers.activitybar) ? viewsContainers.activitybar : [];
      const viewsByContainer = contributes.views && typeof contributes.views === 'object' ? contributes.views : {};

      for (const rawItem of activityContainers) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const containerId = String(rawItem.id || '').trim();
        if (!containerId) continue;
        const title = String(rawItem.title || containerId).trim() || containerId;
        const iconUrl = resolveExtensionContributionIconUrl(ext, rawItem.icon);
        const rawViews = Array.isArray(viewsByContainer[containerId]) ? viewsByContainer[containerId] : [];
        const views = rawViews.map((view) => ({
          id: String(view?.id || '').trim(),
          name: String(view?.name || view?.id || '').trim()
        }));
        out.push({
          id: `extview:${String(ext.id || '').trim()}:${containerId}`,
          extensionId: String(ext.id || '').trim(),
          containerId,
          title,
          iconUrl,
          views
        });
      }
    }
    return out;
  }

  function resolveExtensionContributionIconUrl(ext, iconValue) {
    if (!iconValue) return '';
    const raw = typeof iconValue === 'string'
      ? iconValue
      : (iconValue && typeof iconValue === 'object' ? (iconValue.dark || iconValue.light || '') : '');
    const icon = String(raw || '').trim();
    if (!icon) return '';
    if (/^(https?:|data:|file:)/i.test(icon)) return icon;
    const installPath = normalizePath(ext?.installPath || '');
    if (!installPath) return '';
    const abs = joinPath(installPath, icon);
    return pathToFileUrl(abs);
  }

  function pathToFileUrl(filePath) {
    const p = normalizePath(filePath);
    if (!p) return '';
    const slash = p.replace(/\\/g, '/');
    return `file:///${encodeURI(slash)}`;
  }

  function bindExtensionsDebugApi() {
    if (window.__coderExtensionsDebugBound) return;
    window.__coderExtensionsDebugBound = true;
    window.coderExtensions = {
      list: () => api.extensions?.list?.(),
      installVsix: (filePath) => api.extensions?.installVsix?.(filePath),
      selectAndInstallVsix: () => api.extensions?.selectAndInstallVsix?.(),
      setEnabled: (id, enabled) => api.extensions?.setEnabled?.(id, enabled),
      uninstall: (id) => api.extensions?.uninstall?.(id),
      listCommands: () => api.extensions?.listCommands?.(),
      run: (commandId, ...args) => api.extensions?.executeCommand?.(commandId, args)
    };
  }

  async function handleExtensionsBridgeEvent(payload) {
    if (!payload || typeof payload !== 'object') return;
    const type = String(payload.type || '').trim();

    if (type === 'host-status') {
      state.extensionHostStatus = String(payload.status || 'unknown');
      if (state.extensionHostStatus === 'exited') {
        showToast('Coder extension host stopped', 'warn');
      }
      if (state.sidePanelMode === 'extensions') renderSidePanelMode();
      return;
    }

    if (type === 'extensions-changed' || type === 'commands-changed') {
      await refreshExtensionsBridgeState({ silent: true });
      renderExtensionRailButtons();
      if (state.sidePanelMode === 'extensions') renderSidePanelMode();
      return;
    }

    if (type === 'window-message') {
      const level = payload.severity === 'error' ? 'error' : (payload.severity === 'warn' ? 'warn' : 'success');
      if (payload.message) showToast(String(payload.message), level);
      return;
    }

    if (type === 'window-open-text-document') {
      const targetPath = normalizePath(payload.path || '');
      if (targetPath) await openFile(targetPath, { silent: false });
      return;
    }

    if (type === 'extension-activation') {
      const extId = String(payload.extensionId || '').trim();
      const phase = String(payload.phase || '').trim().toLowerCase();
      if (extId && (phase === 'start' || phase === 'activated')) {
        if (state.extensionErrors && typeof state.extensionErrors === 'object' && state.extensionErrors[extId]) {
          const nextErrors = { ...(state.extensionErrors || {}) };
          delete nextErrors[extId];
          state.extensionErrors = nextErrors;
        }
        if (state.sidePanelMode === 'extensions') renderSidePanelMode();
      }
      return;
    }

    if (type === 'extension-webview') {
      handleExtensionWebviewBridgeEvent(payload);
      return;
    }

    if (type === 'language-provider') {
      handleExtensionLanguageProviderBridgeEvent(payload);
      return;
    }

    if (type === 'extension-error' && payload.message) {
      const extId = safeString(payload.extensionId).trim();
      const message = safeString(payload.message);
      if (typeof payload.message !== 'string') warnExtensionPayloadIssue(`${extId || 'unknown'}.message`, payload.message, 'extension-error-event');
      if (extId) {
        state.extensionErrors = {
          ...(state.extensionErrors || {}),
          [extId]: message
        };
      }
      showToast(`Extension error: ${message}`, 'error');
      if (state.sidePanelMode === 'extensions') renderSidePanelMode();
    }
  }

  function handleExtensionLanguageProviderBridgeEvent(payload) {
    const method = String(payload?.method || '').trim();
    if (method !== 'languages.publishDiagnostics') return;
    const params = payload?.params && typeof payload.params === 'object' ? payload.params : {};
    const filePath = normalizePath(String(params.path || '').trim());
    if (!filePath) return;
    const collectionName = String(params.name || 'diagnostics').trim() || 'diagnostics';
    const extensionId = String(payload?.extensionId || '').trim() || 'extension';
    const sourceKey = `ext:${extensionId}:${collectionName}`;
    setExternalDiagnosticsForPath(sourceKey, filePath, Array.isArray(params.diagnostics) ? params.diagnostics : []);

    const openFileRef = state.files.get(filePath);
    if (!openFileRef) return;
    updateFileDiagnostics(openFileRef);
    if (state.activePath === filePath) {
      renderCodeHighlight();
      renderLineNumbers();
      renderEditorDiagnosticsPanel(openFileRef);
      updateCursorStatus();
    }
  }

  function notifyExtensionsEditorEvent(eventName, payload = {}) {
    if (!api.extensions?.notifyEditorEvent) return;
    try {
      const maybePromise = api.extensions.notifyEditorEvent(String(eventName || ''), payload);
      if (maybePromise && typeof maybePromise.catch === 'function') maybePromise.catch(() => {});
    } catch (_) {}
  }

  function ensureExtensionWebviewStyles() {
    if (document.getElementById('coder-webview-runtime-styles')) return;
    const style = document.createElement('style');
    style.id = 'coder-webview-runtime-styles';
    style.textContent = `
      .extension-webview-pane {
        padding: 0;
        background: #1e1e1e;
      }
      .ext-webview-shell {
        display: grid;
        grid-template-rows: auto 1fr;
        width: 100%;
        height: 100%;
        min-height: 0;
      }
      .ext-webview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: #1b1b1b;
      }
      .ext-webview-title {
        font-size: 12px;
        color: #d7e2f4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ext-webview-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: #9fb3cb;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 999px;
        padding: 2px 6px;
        background: rgba(255,255,255,0.02);
      }
      .ext-webview-frame {
        width: 100%;
        height: 100%;
        border: 0;
        background: #ffffff;
      }
      .ext-webview-empty {
        height: 100%;
        display: grid;
        place-items: center;
        color: #aeb8c7;
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureExtensionWebviewHostElement() {
    ensureExtensionWebviewStyles();
    let host = document.getElementById('extension-webview-view');
    if (host) {
      els['extension-webview-view'] = host;
      return host;
    }
    const editorView = document.querySelector('.editor-view');
    if (!editorView) return null;
    host = document.createElement('div');
    host.id = 'extension-webview-view';
    host.className = 'editor-pane hidden extension-webview-pane';
    host.setAttribute('aria-live', 'polite');
    const editorPane = document.getElementById('editor-pane');
    if (editorPane && editorPane.parentNode === editorView) editorView.insertBefore(host, editorPane);
    else editorView.appendChild(host);
    els['extension-webview-view'] = host;
    return host;
  }

  function ensureExtensionDetailHostElement() {
    let host = document.getElementById('extension-detail-view');
    if (host) {
      els['extension-detail-view'] = host;
      return host;
    }
    const editorView = document.querySelector('.editor-view');
    if (!editorView) return null;
    host = document.createElement('div');
    host.id = 'extension-detail-view';
    host.className = 'editor-pane hidden extension-detail-pane';
    host.setAttribute('aria-live', 'polite');
    const editorPane = document.getElementById('editor-pane');
    if (editorPane && editorPane.parentNode === editorView) editorView.insertBefore(host, editorPane);
    else editorView.appendChild(host);
    els['extension-detail-view'] = host;
    return host;
  }

  function ensureEditorDiagnosticsHostElement() {
    const stack = els['code-stack'];
    if (!stack) return null;
    let host = stack.querySelector('.editor-diagnostics-panel');
    if (!host) {
      host = document.createElement('div');
      host.className = 'editor-diagnostics-panel hidden';
      host.setAttribute('aria-live', 'polite');
      stack.appendChild(host);
    }
    els['editor-diagnostics-panel'] = host;
    return host;
  }

  function ensureEditorDiagnosticsPopupState() {
    if (!state.editorDiagnosticsPopup || typeof state.editorDiagnosticsPopup !== 'object') {
      state.editorDiagnosticsPopup = { open: false, x: 16, y: 16, width: 560, positioned: false, drag: null };
    }
    const popup = state.editorDiagnosticsPopup;
    popup.open = Boolean(popup.open);
    popup.x = Number.isFinite(Number(popup.x)) ? Number(popup.x) : 16;
    popup.y = Number.isFinite(Number(popup.y)) ? Number(popup.y) : 16;
    popup.width = clamp(Number(popup.width) || 560, 320, 760);
    popup.positioned = Boolean(popup.positioned);
    if (!popup.drag || typeof popup.drag !== 'object') popup.drag = null;
    return popup;
  }

  function positionEditorDiagnosticsPopup(hostEl, options = {}) {
    const host = hostEl || els['editor-diagnostics-panel'] || ensureEditorDiagnosticsHostElement();
    const stack = els['code-stack'];
    if (!host || !stack) return;
    const popup = ensureEditorDiagnosticsPopupState();

    const margin = 8;
    const stackWidth = Math.max(0, Math.floor(stack.clientWidth || 0));
    const stackHeight = Math.max(0, Math.floor(stack.clientHeight || 0));
    if (!stackWidth || !stackHeight) return;

    const availableWidth = Math.max(220, stackWidth - (margin * 2));
    const minWidth = Math.min(320, availableWidth);
    const maxWidth = Math.max(minWidth, availableWidth);
    const width = clamp(Math.floor(popup.width || 560), minWidth, maxWidth);
    popup.width = width;
    host.style.width = `${width}px`;
    host.style.maxWidth = `${Math.max(0, stackWidth - margin * 2)}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';

    const hostRect = host.getBoundingClientRect();
    const panelWidth = Math.max(260, Math.round(hostRect.width || width));
    const panelHeight = Math.max(96, Math.round(hostRect.height || 180));

    if (options.reset || !popup.positioned) {
      popup.x = margin + 4;
      popup.y = Math.max(margin, stackHeight - panelHeight - (margin + 2));
      popup.positioned = true;
    }

    const maxX = Math.max(margin, stackWidth - panelWidth - margin);
    const maxY = Math.max(margin, stackHeight - panelHeight - margin);
    popup.x = clamp(Math.round(Number(popup.x) || margin), margin, maxX);
    popup.y = clamp(Math.round(Number(popup.y) || margin), margin, maxY);

    host.style.left = `${popup.x}px`;
    host.style.top = `${popup.y}px`;
  }

  function toggleEditorDiagnosticsPopup(force) {
    const popup = ensureEditorDiagnosticsPopupState();
    const next = typeof force === 'boolean' ? force : !popup.open;
    const file = state.activePath ? state.files.get(state.activePath) : null;
    if (next && !file) {
      showToast('Open a code file to view problems', 'warn');
      return;
    }
    popup.open = next;
    renderEditorDiagnosticsPanel(file || null);
    if (next) {
      const host = ensureEditorDiagnosticsHostElement();
      if (host) positionEditorDiagnosticsPopup(host, { reset: false });
    }
  }

  function closeEditorDiagnosticsPopup() {
    toggleEditorDiagnosticsPopup(false);
  }

  function handleEditorDiagnosticsOutsidePointerDown(event) {
    const popup = ensureEditorDiagnosticsPopupState();
    if (!popup.open) return;
    const host = els['editor-diagnostics-panel'] || document.querySelector('.editor-diagnostics-panel');
    if (!host || host.classList.contains('hidden')) return;
    if (host.contains(event.target)) return;
    closeEditorDiagnosticsPopup();
  }

  function handleEditorDiagnosticsPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const handle = event.target.closest('[data-editor-diag-drag-handle]');
    if (!handle) return;
    const host = ensureEditorDiagnosticsHostElement();
    if (!host || host.classList.contains('hidden') || !host.contains(handle)) return;
    const popup = ensureEditorDiagnosticsPopupState();
    popup.drag = {
      pointerId: Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : null,
      startClientX: Number(event.clientX) || 0,
      startClientY: Number(event.clientY) || 0,
      startX: Number(popup.x) || 16,
      startY: Number(popup.y) || 16
    };
    host.classList.add('dragging');
    try { handle.setPointerCapture?.(event.pointerId); } catch (_) {}
    event.preventDefault();
  }

  function handleEditorDiagnosticsPointerMove(event) {
    const popup = ensureEditorDiagnosticsPopupState();
    const drag = popup.drag;
    if (!drag) return;
    if (drag.pointerId !== null && Number.isFinite(Number(event.pointerId)) && Number(event.pointerId) !== drag.pointerId) return;
    popup.x = (drag.startX || 0) + ((Number(event.clientX) || 0) - (drag.startClientX || 0));
    popup.y = (drag.startY || 0) + ((Number(event.clientY) || 0) - (drag.startClientY || 0));
    popup.positioned = true;
    positionEditorDiagnosticsPopup();
    event.preventDefault();
  }

  function handleEditorDiagnosticsPointerUp(event) {
    const popup = ensureEditorDiagnosticsPopupState();
    const drag = popup.drag;
    if (!drag) return;
    if (drag.pointerId !== null && Number.isFinite(Number(event.pointerId)) && Number(event.pointerId) !== drag.pointerId) return;
    popup.drag = null;
    els['editor-diagnostics-panel']?.classList.remove('dragging');
  }

  function getActiveExtensionWebviewPanel() {
    const id = String(state.activeExtensionWebviewPanelId || '').trim();
    if (!id) return null;
    return state.extensionWebviewPanels.get(id) || null;
  }

  function normalizeWebviewPanelPayload(panel = {}) {
    const panelId = String(panel.panelId || '').trim();
    if (!panelId) return null;
    const existing = state.extensionWebviewPanels.get(panelId) || {};
    return {
      ...existing,
      panelId,
      extensionId: String(panel.extensionId || existing.extensionId || '').trim(),
      windowId: Number(panel.windowId || existing.windowId) || 0,
      viewType: String(panel.viewType || existing.viewType || '').trim(),
      title: String(panel.title || existing.title || 'Webview'),
      html: typeof panel.html === 'string' ? panel.html : (typeof existing.html === 'string' ? existing.html : ''),
      options: panel.options && typeof panel.options === 'object' ? { ...(existing.options || {}), ...panel.options } : (existing.options || {}),
      visible: panel.visible !== false,
      active: panel.active !== false,
      token: String(existing.token || `wv_${Math.random().toString(36).slice(2)}_${Date.now()}`),
      pendingInboundMessages: Array.isArray(existing.pendingInboundMessages) ? existing.pendingInboundMessages : [],
      frameReady: existing.frameReady === true,
      frameWindow: existing.frameWindow || null,
      renderNonce: (Number(existing.renderNonce) || 0) + 1
    };
  }

  function handleExtensionWebviewBridgeEvent(payload) {
    const action = String(payload.action || '').trim();
    if (!action) return;

    if (action === 'create' || action === 'update') {
      const normalized = normalizeWebviewPanelPayload(payload.panel || {});
      if (!normalized) return;
      state.extensionWebviewPanels.set(normalized.panelId, normalized);
      if (normalized.active || !state.activeExtensionWebviewPanelId) {
        state.activeExtensionWebviewPanelId = normalized.panelId;
        state.activePath = '';
        if (state.extensionDetailView) state.extensionDetailView.active = false;
      }
      renderTabs();
      if (getActiveExtensionWebviewPanel()?.panelId === normalized.panelId) renderEditorShell();
      return;
    }

    if (action === 'dispose') {
      const panelId = String(payload.panelId || '').trim();
      if (!panelId) return;
      const wasActive = state.activeExtensionWebviewPanelId === panelId;
      state.extensionWebviewPanels.delete(panelId);
      if (wasActive) {
        const next = [...state.extensionWebviewPanels.keys()][0] || '';
        state.activeExtensionWebviewPanelId = next;
        if (!next && state.extensionDetailView) state.extensionDetailView.active = true;
      }
      renderTabs();
      renderEditorShell();
      return;
    }

    if (action === 'postMessage') {
      const panelId = String(payload.panelId || '').trim();
      if (!panelId) return;
      const panel = state.extensionWebviewPanels.get(panelId);
      if (!panel) return;
      postMessageToExtensionWebviewFrame(panelId, payload.message ?? null);
    }
  }

  function activateExtensionWebviewPanel(panelId) {
    const id = String(panelId || '').trim();
    if (!id || !state.extensionWebviewPanels.has(id)) return;
    if (state.extensionDetailView) state.extensionDetailView.active = false;
    state.activePath = '';
    state.activeExtensionWebviewPanelId = id;
    renderTabs();
    renderEditorShell();
  }

  function closeExtensionWebviewPanel(panelId, options = {}) {
    const id = String(panelId || '').trim();
    if (!id) return;
    const panel = state.extensionWebviewPanels.get(id);
    if (!panel) return;
    state.extensionWebviewPanels.delete(id);
    if (state.activeExtensionWebviewPanelId === id) {
      const next = [...state.extensionWebviewPanels.keys()][0] || '';
      state.activeExtensionWebviewPanelId = next;
      if (!next && state.extensionDetailView) state.extensionDetailView.active = true;
    }
    renderTabs();
    renderEditorShell();
    if (options.notifyHost !== false) {
      try { api.extensions?.webviewUserClose?.(id); } catch (_) {}
    }
  }

  function buildExtensionWebviewSrcdoc(panel) {
    const token = String(panel?.token || '');
    const panelId = String(panel?.panelId || '');
    const bodyHtml = String(panel?.html || '');
    const bridgeScript = `
<script>
(function(){
  const PANEL_ID = ${JSON.stringify(panelId)};
  const TOKEN = ${JSON.stringify(token)};
  let stateVal = undefined;
  function emitToParent(type, payload){
    try {
      parent.postMessage({ __omxCoderWebview: 1, dir: 'from-iframe', panelId: PANEL_ID, token: TOKEN, type: type, payload: payload || null }, '*');
    } catch (_) {}
  }
  window.acquireVsCodeApi = function(){
    return {
      postMessage: function(message){ emitToParent('message', message); return true; },
      setState: function(next){ stateVal = next; return next; },
      getState: function(){ return stateVal; }
    };
  };
  window.addEventListener('message', function(ev){
    const data = ev && ev.data;
    if (!data || data.__omxCoderWebview !== 1 || data.dir !== 'to-iframe') return;
    if (String(data.panelId || '') !== PANEL_ID) return;
    if (String(data.token || '') !== TOKEN) return;
    try {
      window.dispatchEvent(new MessageEvent('message', { data: data.payload }));
    } catch (_) {}
  });
  document.addEventListener('click', function(ev){
    const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    const href = String(a.getAttribute('href') || '').trim();
    if (!href) return;
    if (href.startsWith('#')) return;
    ev.preventDefault();
  }, true);
  window.addEventListener('DOMContentLoaded', function(){ emitToParent('ready', { ok: true }); });
})();
</script>`;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: file:; style-src 'unsafe-inline' data: file:; font-src data: file:; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; media-src 'none'; object-src 'none';">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${bridgeScript}
</head>
<body>
${bodyHtml}
</body>
</html>`;
  }

  function postMessageToExtensionWebviewFrame(panelId, message) {
    const panel = state.extensionWebviewPanels.get(String(panelId || '').trim());
    if (!panel) return;
    const host = ensureExtensionWebviewHostElement();
    const iframe = host?.querySelector(`iframe[data-panel-id="${cssEscape(panel.panelId)}"]`);
    if (iframe?.contentWindow && panel.frameReady) {
      panel.frameWindow = iframe.contentWindow;
      try {
        iframe.contentWindow.postMessage({
          __omxCoderWebview: 1,
          dir: 'to-iframe',
          panelId: panel.panelId,
          token: panel.token,
          payload: message ?? null
        }, '*');
      } catch (_) {}
      return;
    }
    panel.pendingInboundMessages = [...(panel.pendingInboundMessages || []), message ?? null].slice(-100);
    state.extensionWebviewPanels.set(panel.panelId, panel);
  }

  function flushExtensionWebviewPendingMessages(panelId) {
    const panel = state.extensionWebviewPanels.get(String(panelId || '').trim());
    if (!panel || !Array.isArray(panel.pendingInboundMessages) || panel.pendingInboundMessages.length === 0) return;
    const queue = panel.pendingInboundMessages.slice();
    panel.pendingInboundMessages = [];
    state.extensionWebviewPanels.set(panel.panelId, panel);
    queue.forEach((msg) => postMessageToExtensionWebviewFrame(panel.panelId, msg));
  }

  async function handleExtensionWebviewFrameMessage(event) {
    const data = event?.data;
    if (!data || data.__omxCoderWebview !== 1 || data.dir !== 'from-iframe') return;
    const panelId = String(data.panelId || '').trim();
    if (!panelId) return;
    const panel = state.extensionWebviewPanels.get(panelId);
    if (!panel) return;
    if (String(data.token || '') !== String(panel.token || '')) return;
    if (panel.frameWindow && event.source && panel.frameWindow !== event.source) return;

    const type = String(data.type || '').trim();
    if (type === 'ready') {
      panel.frameReady = true;
      panel.frameWindow = event.source || panel.frameWindow || null;
      state.extensionWebviewPanels.set(panelId, panel);
      flushExtensionWebviewPendingMessages(panelId);
      return;
    }
    if (type === 'message') {
      try {
        await api.extensions?.webviewPostMessage?.(panelId, data.payload ?? null);
      } catch (_) {}
    }
  }

  function renderExtensionWebviewPanel() {
    const host = ensureExtensionWebviewHostElement();
    if (!host) return;
    const panel = getActiveExtensionWebviewPanel();
    if (!panel) {
      host.innerHTML = '<div class="ext-webview-empty">No extension webview panel is open.</div>';
      return;
    }
    const title = escapeHtml(String(panel.title || panel.viewType || panel.panelId || 'Webview'));
    const subtitle = escapeHtml(String(panel.viewType || 'webview'));
    host.innerHTML = `
      <div class="ext-webview-shell">
        <div class="ext-webview-head">
          <div class="ext-webview-title">${title}</div>
          <div class="ext-webview-badge">${subtitle}</div>
        </div>
        <iframe
          class="ext-webview-frame"
          data-panel-id="${escapeHtml(panel.panelId)}"
          sandbox="allow-scripts allow-forms allow-modals"
          referrerpolicy="no-referrer"
          title="${title}"
        ></iframe>
      </div>
    `;
    const iframe = host.querySelector('iframe');
    if (!iframe) return;
    panel.frameReady = false;
    panel.frameWindow = null;
    state.extensionWebviewPanels.set(panel.panelId, panel);
    iframe.srcdoc = buildExtensionWebviewSrcdoc(panel);
  }

  function scheduleExtensionDocumentChangeEvent() {
    const file = state.activePath ? state.files.get(state.activePath) : null;
    if (!file) return;
    if (state.extensionDocChangeTimer) clearTimeout(state.extensionDocChangeTimer);
    state.extensionDocChangeTimer = setTimeout(() => {
      state.extensionDocChangeTimer = null;
      const current = state.activePath ? state.files.get(state.activePath) : null;
      if (!current || !current.path) return;
      current.extensionDocVersion = (Number(current.extensionDocVersion) || 1) + 1;
      const maxContentBytes = 1024 * 1024;
      const bytes = typeof current.content === 'string' ? new Blob([current.content]).size : 0;
      notifyExtensionsEditorEvent('fileChanged', {
        path: current.path,
        language: current.language || detectLanguage(current.path),
        version: current.extensionDocVersion,
        content: bytes <= maxContentBytes ? current.content : ''
      });
    }, 220);
  }

  function renderProjectPill() {
    if (!els['project-pill']) return;
    if (!state.projectRoot) {
      els['project-pill'].textContent = 'No project selected';
      els['project-pill'].title = 'No project selected';
      return;
    }
    const label = basenamePath(state.projectRoot) || state.projectRoot;
    els['project-pill'].textContent = label;
    els['project-pill'].title = state.projectRoot;
  }

  function renderTree() {
    if (!els['tree-root'] || !els['tree-empty']) return;
    els['tree-root'].innerHTML = '';

    if (!state.projectRoot) {
      els['tree-empty'].classList.remove('hidden');
      updateExplorerActionButtons();
      return;
    }

    els['tree-empty'].classList.add('hidden');

    const list = document.createElement('ul');
    list.className = 'tree-list';
    const rootNode = {
      name: basenamePath(state.projectRoot) || state.projectRoot,
      path: state.projectRoot,
      type: 'dir',
      children: state.treeChildren
    };
    list.appendChild(renderTreeNode(rootNode, 0, { isRoot: true }));
    els['tree-root'].appendChild(list);
    updateTreeSelectionVisual();
    updateExplorerActionButtons();
  }

  function treeFolderIconSvg(isOpen) {
    if (isOpen) {
      return `
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M1.4 4.2A1 1 0 0 1 2.4 3.2h3.3l1 1.1h6.8a1 1 0 0 1 1 1V6H1.4z" fill="#d3a24f"/>
          <path d="M1.4 6h13.2v5.1a1 1 0 0 1-1 1H2.4a1 1 0 0 1-1-1z" fill="#f0bf61" stroke="#9b6720" stroke-width=".7" stroke-linejoin="round"/>
        </svg>
      `;
    }
    return `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M1.4 4.2A1 1 0 0 1 2.4 3.2h3.3l1 1.1h6.8a1 1 0 0 1 1 1V6H1.4z" fill="#be8a39"/>
        <path d="M1.4 6h13.2v5.1a1 1 0 0 1-1 1H2.4a1 1 0 0 1-1-1z" fill="#d79b42" stroke="#875516" stroke-width=".7" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function treeFileIconSpec(filePath) {
    const base = basenamePath(filePath).toLowerCase();
    const ext = extensionOf(filePath);

    if (base === 'package.json') return { accent: '#f59e0b', kind: 'config', label: 'NPM' };
    if (base === 'package-lock.json' || base.endsWith('.lock')) return { accent: '#8b5cf6', kind: 'config', label: 'LK' };
    if (base === '.gitignore' || base === '.gitattributes') return { accent: '#f97316', kind: 'config', label: 'GI' };
    if (base === '.env' || base.startsWith('.env.')) return { accent: '#22c55e', kind: 'config', label: 'ENV' };
    if (base === 'readme.md') return { accent: '#38bdf8', kind: 'markdown', label: 'MD' };

    if (['html', 'htm'].includes(ext)) return { accent: '#f97316', kind: 'code', label: 'HT' };
    if (ext === 'css') return { accent: '#3b82f6', kind: 'code', label: 'CS' };
    if (['js', 'mjs', 'cjs'].includes(ext)) return { accent: '#facc15', kind: 'code', label: 'JS' };
    if (['ts', 'tsx'].includes(ext)) return { accent: '#2563eb', kind: 'code', label: 'TS' };
    if (ext === 'jsx') return { accent: '#06b6d4', kind: 'code', label: 'JSX' };
    if (ext === 'json') return { accent: '#10b981', kind: 'config', label: 'JSN' };
    if (ext === 'md') return { accent: '#60a5fa', kind: 'markdown', label: 'MD' };
    if (['yml', 'yaml', 'toml', 'ini', 'cfg'].includes(ext)) return { accent: '#14b8a6', kind: 'config', label: 'CFG' };
    if (ext === 'xml') return { accent: '#fb7185', kind: 'config', label: 'XML' };
    if (ext === 'svg') return { accent: '#fb923c', kind: 'image', label: 'SVG' };
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'].includes(ext)) return { accent: '#ec4899', kind: 'image', label: 'IMG' };
    if (ext === 'pdf') return { accent: '#ef4444', kind: 'file', label: 'PDF' };
    if (ext === 'txt') return { accent: '#94a3b8', kind: 'text', label: 'TXT' };
    if (ext === 'py') return { accent: '#3b82f6', kind: 'code', label: 'PY' };
    if (ext === 'java') return { accent: '#f97316', kind: 'code', label: 'JV' };
    if (ext === 'go') return { accent: '#22d3ee', kind: 'code', label: 'GO' };
    if (ext === 'rs') return { accent: '#f97316', kind: 'code', label: 'RS' };
    if (ext === 'c') return { accent: '#60a5fa', kind: 'code', label: 'C' };
    if (['cpp', 'cc', 'cxx', 'c++'].includes(ext)) return { accent: '#3b82f6', kind: 'code', label: 'C+' };
    if (['h', 'hpp', 'hh', 'hxx'].includes(ext)) return { accent: '#93c5fd', kind: 'header', label: 'H' };
    if (['sh', 'ps1', 'bat', 'cmd'].includes(ext)) return { accent: '#84cc16', kind: 'script', label: 'SH' };
    if (['sql', 'db', 'sqlite'].includes(ext)) return { accent: '#a78bfa', kind: 'data', label: 'DB' };
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { accent: '#f59e0b', kind: 'archive', label: 'ZIP' };

    return { accent: '#94a3b8', kind: 'file', label: (ext || 'FILE').slice(0, 3).toUpperCase() };
  }

  function treeFileIconSvg(filePath) {
    const spec = treeFileIconSpec(filePath);
    const accent = spec.accent || '#94a3b8';
    const label = String(spec.label || '').replace(/[^A-Za-z0-9+]/g, '').slice(0, 3).toUpperCase();
    if (spec.kind === 'image') {
      return `
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4 1.5h5.2L13 5.3V14a.8.8 0 0 1-.8.8H4A.8.8 0 0 1 3.2 14V2.3A.8.8 0 0 1 4 1.5z" fill="#111827" stroke="#64748b" stroke-width=".7" stroke-linejoin="round"/>
          <path d="M9.2 1.5v3a.8.8 0 0 0 .8.8h3" fill="#1f2937" stroke="#64748b" stroke-width=".7" stroke-linejoin="round"/>
          <rect x="4.2" y="8.5" width="7.8" height="4.1" rx=".7" fill="${accent}" opacity=".95"/>
          <path d="M4.9 11.9l2.1-1.9 1.3 1.2 1.9-2.1 1.1 1.2v1.6H4.9z" fill="#fff" opacity=".9"/>
          <circle cx="6.2" cy="9.5" r=".7" fill="#fff" opacity=".95"/>
        </svg>
      `;
    }

    let overlay = `<text x="8.1" y="11.45" text-anchor="middle" font-size="2.95" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="#0b0d10">${label || 'FI'}</text>`;
    if (spec.kind === 'markdown' || spec.kind === 'text') {
      overlay = `
        <path d="M5 8.4h6M5 10.2h6M5 12h4.6" stroke="#0b0d10" stroke-width=".9" stroke-linecap="round" opacity=".92"/>
      `;
    } else if (spec.kind === 'config') {
      overlay = `
        <text x="8.1" y="11.5" text-anchor="middle" font-size="3.2" font-weight="700" font-family="Consolas, monospace" fill="#0b0d10">{}</text>
      `;
    } else if (spec.kind === 'script') {
      overlay = `
        <path d="M5.1 9.1h5.8M5.1 11.4h3.8" stroke="#0b0d10" stroke-width=".9" stroke-linecap="round" opacity=".95"/>
        <path d="M5.1 7.3l1.2.8-1.2.8" fill="none" stroke="#0b0d10" stroke-width=".95" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    } else if (spec.kind === 'archive') {
      overlay = `
        <path d="M8.1 8v4.7M7.2 8.2h1.8M7.2 9.3h1.8M7.2 10.4h1.8M7.2 11.5h1.8" stroke="#0b0d10" stroke-width=".8" stroke-linecap="round"/>
      `;
    } else if (spec.kind === 'data') {
      overlay = `
        <ellipse cx="8.1" cy="8.6" rx="2.7" ry="1.1" fill="none" stroke="#0b0d10" stroke-width=".85"/>
        <path d="M5.4 8.6v2.7c0 .7 1.2 1.3 2.7 1.3s2.7-.6 2.7-1.3V8.6" fill="none" stroke="#0b0d10" stroke-width=".85"/>
      `;
    } else if (spec.kind === 'header') {
      overlay = `
        <text x="8.1" y="11.45" text-anchor="middle" font-size="3.2" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="#0b0d10">H</text>
      `;
    }

    return `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4 1.5h5.2L13 5.3V14a.8.8 0 0 1-.8.8H4A.8.8 0 0 1 3.2 14V2.3A.8.8 0 0 1 4 1.5z" fill="#111827" stroke="#64748b" stroke-width=".7" stroke-linejoin="round"/>
        <path d="M9.2 1.5v3a.8.8 0 0 0 .8.8h3" fill="#1f2937" stroke="#64748b" stroke-width=".7" stroke-linejoin="round"/>
        <rect x="4.2" y="8.3" width="7.8" height="4.3" rx=".8" fill="${accent}" opacity=".95"/>
        ${overlay}
      </svg>
    `;
  }

  function renderTreeNode(node, depth, options = {}) {
    const li = document.createElement('li');
    li.className = 'tree-node';

    const row = document.createElement('div');
    row.className = `tree-row ${node.type === 'dir' ? 'folder' : 'file'}`;
    if (options.isRoot) row.classList.add('tree-root-row');
    row.dataset.path = node.path;
    row.dataset.type = node.type;
    if (node.type !== 'dir') row.dataset.ext = extensionOf(node.path || node.name || '');
    if (options.isRoot) row.title = node.path;

    const indent = document.createElement('span');
    indent.className = 'tree-indent';
    indent.style.width = `${depth * 14}px`;
    row.appendChild(indent);

    const chevron = document.createElement('span');
    chevron.className = 'tree-chevron';
    const isExpandedDir = node.type === 'dir' && state.expandedDirs.has(node.path);
    chevron.textContent = node.type === 'dir' ? (isExpandedDir ? '\u25BE' : '\u25B8') : '';
    row.appendChild(chevron);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = node.type === 'dir'
      ? treeFolderIconSvg(isExpandedDir || !!options.isRoot)
      : treeFileIconSvg(node.path || node.name);
    row.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = node.name;
    name.title = node.path;
    row.appendChild(name);

    li.appendChild(row);

    if (node.type === 'dir' && state.expandedDirs.has(node.path) && Array.isArray(node.children) && node.children.length > 0) {
      const childList = document.createElement('ul');
      childList.className = 'tree-list';
      node.children.forEach((child) => childList.appendChild(renderTreeNode(child, depth + 1)));
      li.appendChild(childList);
    }

    return li;
  }

  async function handleTreeClick(event) {
    const row = event.target.closest('.tree-row');
    if (!row) return;
    const path = normalizePath(row.dataset.path || '');
    const type = row.dataset.type;
    if (!path) return;

    state.selectedPath = path;
    updateTreeSelectionVisual();
    updateExplorerActionButtons();
    scheduleSessionSave();

    const clickedChevron = event.target.classList?.contains('tree-chevron');
    if (type === 'dir') {
      if (clickedChevron) {
        await toggleFolderExpansion(path);
      }
      return;
    }

    if (type === 'file') {
      await openFile(path);
    }
  }

  async function handleTreeDoubleClick(event) {
    const row = event.target.closest('.tree-row');
    if (!row) return;
    const path = normalizePath(row.dataset.path || '');
    const type = row.dataset.type;
    if (type === 'dir' && path) {
      await toggleFolderExpansion(path);
    }
  }

  async function toggleFolderExpansion(dirPath) {
    const normalized = normalizePath(dirPath);
    if (!normalized) return;
    if (state.expandedDirs.has(normalized)) state.expandedDirs.delete(normalized);
    else state.expandedDirs.add(normalized);
    await refreshTree();
  }

  function updateTreeSelectionVisual() {
    if (!els['tree-root']) return;
    els['tree-root'].querySelectorAll('.tree-row.selected').forEach((el) => el.classList.remove('selected'));
    if (!state.selectedPath) {
      updateExplorerActionButtons();
      return;
    }
    const selector = `.tree-row[data-path="${cssEscape(state.selectedPath)}"]`;
    const row = els['tree-root'].querySelector(selector);
    if (row) row.classList.add('selected');
    updateExplorerActionButtons();
  }

  function renderTabs() {
    if (!els['tab-bar']) return;
    els['tab-bar'].innerHTML = '';
    state.extensionWebviewPanels.forEach((panel, panelId) => {
      if (!panel) return;
      const webviewTab = document.createElement('div');
      webviewTab.className = `tab special-tab${state.activeExtensionWebviewPanelId === panelId ? ' active' : ''}`;
      webviewTab.dataset.specialTab = 'extension-webview';
      webviewTab.dataset.webviewPanelId = panelId;

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = String(panel.title || panel.viewType || 'Webview');
      name.title = panel.viewType || panelId;

      const dirty = document.createElement('span');
      dirty.className = 'tab-dirty';
      dirty.textContent = '';

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.dataset.closeWebviewPanel = panelId;
      close.title = 'Close webview tab';
      close.textContent = '\u00D7';

      webviewTab.appendChild(name);
      webviewTab.appendChild(dirty);
      webviewTab.appendChild(close);
      els['tab-bar'].appendChild(webviewTab);
    });
    if (state.extensionDetailView) {
      const detailTab = document.createElement('div');
      detailTab.className = `tab special-tab${state.extensionDetailView.active ? ' active' : ''}`;
      detailTab.dataset.specialTab = 'extension-detail';

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = `Extension: ${state.extensionDetailView.displayName || state.extensionDetailView.id || 'Details'}`;
      name.title = state.extensionDetailView.id || '';

      const dirty = document.createElement('span');
      dirty.className = 'tab-dirty';
      dirty.textContent = '';

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.dataset.closeSpecialTab = 'extension-detail';
      close.title = 'Close extension details';
      close.textContent = '\u00D7';

      detailTab.appendChild(name);
      detailTab.appendChild(dirty);
      detailTab.appendChild(close);
      els['tab-bar'].appendChild(detailTab);
    }
    state.tabs.forEach((filePath) => {
      const file = state.files.get(filePath);
      if (!file) return;
      const tab = document.createElement('div');
      tab.className = `tab${!state.extensionDetailView?.active && filePath === state.activePath ? ' active' : ''}`;
      tab.dataset.path = filePath;

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = basenamePath(filePath);
      name.title = filePath;

      const dirty = document.createElement('span');
      dirty.className = 'tab-dirty';
      dirty.textContent = file.dirty ? '\u25CF' : '';
      dirty.title = file.dirty ? 'Unsaved changes' : '';

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.dataset.closeTab = filePath;
      close.title = 'Close tab';
      close.textContent = '\u00D7';

      tab.appendChild(name);
      tab.appendChild(dirty);
      tab.appendChild(close);
      els['tab-bar'].appendChild(tab);
    });
  }

  function handleTabBarClick(event) {
    const closeBtn = event.target.closest('.tab-close');
    if (closeBtn) {
      const webviewPanelId = String(closeBtn.dataset.closeWebviewPanel || '').trim();
      if (webviewPanelId) {
        closeExtensionWebviewPanel(webviewPanelId);
        return;
      }
      if (String(closeBtn.dataset.closeSpecialTab || '') === 'extension-detail') {
        closeExtensionDetailView();
        return;
      }
      const filePath = normalizePath(closeBtn.dataset.closeTab || '');
      if (filePath) void closeTab(filePath);
      return;
    }
    const tab = event.target.closest('.tab');
    if (!tab) return;
    if (String(tab.dataset.specialTab || '') === 'extension-webview') {
      activateExtensionWebviewPanel(String(tab.dataset.webviewPanelId || ''));
      return;
    }
    if (String(tab.dataset.specialTab || '') === 'extension-detail') {
      activateExtensionDetailView();
      return;
    }
    const filePath = normalizePath(tab.dataset.path || '');
    if (!filePath) return;
    activateTab(filePath);
  }

  function handleLineNumbersClick(event) {
    const lineEl = event.target.closest('.line[data-diag-index]');
    if (!lineEl) return;
    const idx = Number(lineEl.dataset.diagIndex);
    if (!Number.isFinite(idx)) return;
    focusEditorDiagnosticByIndex(idx);
  }

  function handleEditorDiagnosticsClick(event) {
    const actionBtn = event.target.closest('[data-editor-diag-action]');
    if (actionBtn) {
      const action = String(actionBtn.dataset.editorDiagAction || '');
      if (action === 'close') {
        closeEditorDiagnosticsPopup();
        return;
      }
    }
    const btn = event.target.closest('[data-editor-diag-index]');
    if (!btn) return;
    const idx = Number(btn.dataset.editorDiagIndex);
    if (!Number.isFinite(idx)) return;
    focusEditorDiagnosticByIndex(idx);
  }

  function renderEditorShell() {
    ensureExtensionDetailHostElement();
    ensureEditorDiagnosticsHostElement();
    if (getActiveExtensionWebviewPanel()) {
      ensureExtensionWebviewHostElement();
      els['editor-empty']?.classList.add('hidden');
      els['editor-pane']?.classList.add('hidden');
      els['extension-detail-view']?.classList.add('hidden');
      els['extension-webview-view']?.classList.remove('hidden');
      renderExtensionWebviewPanel();
      const activeWebview = getActiveExtensionWebviewPanel();
      setFileStatus(`Webview: ${activeWebview?.title || activeWebview?.viewType || 'Extension'}`);
      setLanguageStatus('Webview');
      if (els['status-cursor']) els['status-cursor'].textContent = 'Panel';
      renderEditorDiagnosticsPanel(null);
      updateExplorerActionButtons();
      return;
    }

    els['extension-webview-view']?.classList.add('hidden');
    if (state.extensionDetailView?.active) {
      els['editor-empty']?.classList.add('hidden');
      els['editor-pane']?.classList.add('hidden');
      els['extension-detail-view']?.classList.remove('hidden');
      renderExtensionDetailView();
      setFileStatus(`Extension: ${state.extensionDetailView.displayName || state.extensionDetailView.id || 'Details'}`);
      setLanguageStatus('Extension');
      if (els['status-cursor']) els['status-cursor'].textContent = 'Details';
      renderEditorDiagnosticsPanel(null);
      updateExplorerActionButtons();
      return;
    }

    els['extension-detail-view']?.classList.add('hidden');
    const file = state.activePath ? state.files.get(state.activePath) : null;

    if (!file) {
      els['editor-empty']?.classList.remove('hidden');
      els['editor-pane']?.classList.add('hidden');
      els['extension-detail-view']?.classList.add('hidden');
      if (els['code-input']) els['code-input'].value = '';
      if (els['code-highlight']) els['code-highlight'].innerHTML = '';
      if (els['line-numbers']) els['line-numbers'].innerHTML = '<div class="line">1</div>';
      renderEditorDiagnosticsPanel(null);
      setFileStatus('No file');
      setLanguageStatus('Plain Text');
      updateCursorStatus();
      updateExplorerActionButtons();
      return;
    }

    els['editor-empty']?.classList.add('hidden');
    els['editor-pane']?.classList.remove('hidden');

    if (els['code-input'] && els['code-input'].value !== file.content) {
      els['code-input'].value = file.content;
      if (typeof file.selectionStart === 'number' && typeof file.selectionEnd === 'number') {
        const max = file.content.length;
        els['code-input'].selectionStart = clamp(file.selectionStart, 0, max);
        els['code-input'].selectionEnd = clamp(file.selectionEnd, 0, max);
      }
    }

    updateFileDiagnostics(file);
    renderCodeHighlight();
    renderLineNumbers();
    renderEditorDiagnosticsPanel(file);
    syncEditorScroll();
    setFileStatus(toProjectRelative(file.path) || basenamePath(file.path));
    setLanguageStatus(languageLabel(file.language));
    updateCursorStatus();
    updateExplorerActionButtons();
  }

  function formatExtensionDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    try {
      return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) {
      return d.toISOString().slice(0, 10);
    }
  }

  function sanitizeHttpUrl(url) {
    const u = String(url || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function sanitizeReadmeImageUrl(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^(?:javascript|vbscript):/i.test(u)) return '';
    if (/^data:/i.test(u)) return /^data:image\//i.test(u) ? u : '';
    return u;
  }

  function renderMarkdownInline(text) {
    let out = escapeHtml(String(text || ''));
    out = out.replace(/\[!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)\]\((https?:\/\/[^)\s]+)\)/gi, (_m, alt, imgUrl, imgTitle, hrefUrl) => {
      const safeImg = sanitizeReadmeImageUrl(imgUrl);
      const safeHref = sanitizeHttpUrl(hrefUrl);
      if (!safeImg) return '';
      const imgAttrs = [
        `src="${escapeHtml(safeImg)}"`,
        `alt="${escapeHtml(alt || '')}"`,
        'loading="lazy"',
        'referrerpolicy="no-referrer"'
      ];
      if (imgTitle) imgAttrs.push(`title="${escapeHtml(imgTitle)}"`);
      const imgHtml = `<img ${imgAttrs.join(' ')}>`;
      if (!safeHref) return imgHtml;
      return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${imgHtml}</a>`;
    });
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, alt, url, title) => {
      const safe = sanitizeReadmeImageUrl(url);
      if (!safe) return '';
      const attrs = [
        `src="${escapeHtml(safe)}"`,
        `alt="${escapeHtml(alt || '')}"`,
        'loading="lazy"',
        'referrerpolicy="no-referrer"'
      ];
      if (title) attrs.push(`title="${escapeHtml(title)}"`);
      return `<img ${attrs.join(' ')}>`;
    });
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_m, label, url) => {
      const safe = sanitizeHttpUrl(url);
      if (!safe) return `${label}`;
      return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    });
    return out;
  }

  function sanitizeReadmeHtmlFragment(html) {
    const raw = String(html || '').trim();
    if (!raw) return '';
    if (typeof DOMParser === 'undefined') return escapeHtml(raw);

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${raw}</div>`, 'text/html');
    const root = doc.body?.firstElementChild;
    if (!root) return '';

    const allowedTags = new Set([
      'p', 'div', 'span', 'br', 'hr',
      'a', 'img',
      'picture', 'source',
      'strong', 'b', 'em', 'i',
      'code', 'pre',
      'ul', 'ol', 'li',
      'blockquote',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'
    ]);

    const allowedAlign = new Set(['left', 'right', 'center']);

    const sanitizeAttrValue = (tag, name, value) => {
      const attr = String(name || '').toLowerCase();
      const v = String(value ?? '').trim();
      if (!v) return '';

      if (tag === 'a' && attr === 'href') {
        const safe = sanitizeHttpUrl(v);
        return safe || '';
      }
      if (tag === 'img' && attr === 'src') {
        const safe = sanitizeReadmeImageUrl(v);
        return safe || '';
      }
      if ((tag === 'img' || tag === 'source') && attr === 'srcset') {
        if (/javascript:|vbscript:/i.test(v)) return '';
        return v;
      }
      if (tag === 'source' && (attr === 'type' || attr === 'media' || attr === 'sizes')) {
        return v;
      }
      if ((tag === 'a' && attr === 'title') || (tag === 'img' && (attr === 'alt' || attr === 'title'))) {
        return v;
      }
      if ((tag === 'img' && (attr === 'width' || attr === 'height'))
        || ((tag === 'td' || tag === 'th') && (attr === 'colspan' || attr === 'rowspan'))) {
        const num = parseInt(v, 10);
        if (!Number.isFinite(num) || num <= 0) return '';
        return String(Math.min(num, 5000));
      }
      if ((tag === 'p' || tag === 'div' || tag === 'span' || tag === 'td' || tag === 'th') && attr === 'align') {
        const normalized = v.toLowerCase();
        return allowedAlign.has(normalized) ? normalized : '';
      }
      return '';
    };

    const renderNode = (node) => {
      if (!node) return '';
      if (node.nodeType === Node.TEXT_NODE) {
        return escapeHtml(node.textContent || '');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = String(node.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
        return '';
      }
      if (!allowedTags.has(tag)) {
        return Array.from(node.childNodes || []).map(renderNode).join('');
      }

      const attrs = [];
      if (tag === 'a') {
        attrs.push('target="_blank"', 'rel="noopener noreferrer"');
      }
      if (tag === 'img') {
        attrs.push('loading="lazy"', 'referrerpolicy="no-referrer"');
      }

      Array.from(node.attributes || []).forEach((attr) => {
        const key = String(attr.name || '').toLowerCase();
        if (key.startsWith('on')) return;
        const safe = sanitizeAttrValue(tag, key, attr.value);
        if (!safe) return;
        attrs.push(`${escapeHtml(key)}="${escapeHtml(safe)}"`);
      });

      const inner = Array.from(node.childNodes || []).map(renderNode).join('');
      const open = `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`;
      if (tag === 'img' || tag === 'br' || tag === 'hr') return open;
      return `${open}${inner}</${tag}>`;
    };

    return Array.from(root.childNodes || []).map(renderNode).join('');
  }

  function isReadmeRawHtmlLine(line) {
    const t = String(line || '').trim();
    if (!t) return false;
    if (t.startsWith('<!--')) return true;
    return /^<\/?[A-Za-z][^>]*>/.test(t) || /^<\/?[A-Za-z][^>]*$/.test(t);
  }

  function hasOpenReadmeHtmlComment(lines) {
    const joined = Array.isArray(lines) ? lines.join('\n') : '';
    if (!joined) return false;
    const openCount = (joined.match(/<!--/g) || []).length;
    const closeCount = (joined.match(/-->/g) || []).length;
    return openCount > closeCount;
  }

  function hasOpenReadmeHtmlTag(lines) {
    const joined = Array.isArray(lines) ? lines.join('\n') : '';
    if (!joined) return false;
    const lastLt = joined.lastIndexOf('<');
    const lastGt = joined.lastIndexOf('>');
    return lastLt > lastGt;
  }

  function isReadmeRawHtmlContinuationLine(line, currentHtmlLines) {
    const t = String(line || '').trim();
    if (!t) return false;
    if (isReadmeRawHtmlLine(t)) return true;
    if (!Array.isArray(currentHtmlLines) || !currentHtmlLines.length) return false;
    if (hasOpenReadmeHtmlComment(currentHtmlLines)) return true;
    if (!hasOpenReadmeHtmlTag(currentHtmlLines)) return false;
    if (/^\/?>$/.test(t)) return true;
    if (/^[A-Za-z_:][A-Za-z0-9:._-]*\s*=/.test(t)) return true;
    return false;
  }

  function parseReadmeTableRow(line) {
    let s = String(line || '').trim();
    if (!s.includes('|')) return null;
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    const cells = s.split('|').map((cell) => String(cell || '').trim());
    if (!cells.length) return null;
    return cells;
  }

  function isReadmeTableDividerLine(line) {
    const cells = parseReadmeTableRow(line);
    if (!cells || !cells.length) return false;
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  }

  function renderMarkdownTableHtml(headerCells, dividerLine, bodyRows) {
    const headers = Array.isArray(headerCells) ? headerCells : [];
    const rows = Array.isArray(bodyRows) ? bodyRows : [];
    if (!headers.length) return '';

    const dividerCells = parseReadmeTableRow(dividerLine) || [];
    const aligns = dividerCells.map((cell) => {
      const t = String(cell || '').trim();
      if (/^:-+:$/.test(t)) return 'center';
      if (/^-+:$/.test(t)) return 'right';
      if (/^:-+$/.test(t)) return 'left';
      return '';
    });

    const alignAttr = (index) => (aligns[index] ? ` align="${escapeHtml(aligns[index])}"` : '');
    const renderCells = (cells, tag) => cells.map((cell, idx) =>
      `<${tag}${alignAttr(idx)}>${renderMarkdownInline(cell)}</${tag}>`).join('');

    return `
      <table>
        <thead><tr>${renderCells(headers, 'th')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${renderCells(row, 'td')}</tr>`).join('')}</tbody>
      </table>
    `;
  }

  function renderExtensionReadmeHtml(markdown) {
    const source = String(markdown || '').replace(/\r\n/g, '\n');
    if (!source.trim()) return '';

    const lines = source.split('\n');
    const out = [];
    let inCode = false;
    let codeLang = '';
    let paragraph = [];
    let listItems = [];
    let htmlBlockLines = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      out.push(`<p>${renderMarkdownInline(paragraph.join(' ').trim())}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (!listItems.length) return;
      out.push(`<ul>${listItems.map((item) => `<li>${renderMarkdownInline(item)}</li>`).join('')}</ul>`);
      listItems = [];
    };
    const flushHtmlBlock = () => {
      if (!htmlBlockLines.length) return;
      const html = sanitizeReadmeHtmlFragment(htmlBlockLines.join('\n'));
      if (html) out.push(html);
      htmlBlockLines = [];
    };

    for (let i = 0; i < lines.length; i += 1) {
      const rawLine = lines[i];
      const line = String(rawLine ?? '');
      if (/^```/.test(line.trim())) {
        flushParagraph();
        flushList();
        flushHtmlBlock();
        if (!inCode) {
          inCode = true;
          codeLang = line.trim().slice(3).trim();
          out.push(`<pre><code${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ''}>`);
        } else {
          out.push('</code></pre>');
          inCode = false;
          codeLang = '';
        }
        continue;
      }

      if (inCode) {
        out.push(`${escapeHtml(line)}\n`);
        continue;
      }

      if (htmlBlockLines.length && isReadmeRawHtmlContinuationLine(line, htmlBlockLines)) {
        flushParagraph();
        flushList();
        htmlBlockLines.push(line);
        const nextLine = String(lines[i + 1] ?? '');
        if (!isReadmeRawHtmlContinuationLine(nextLine, htmlBlockLines)) {
          flushHtmlBlock();
        }
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        flushHtmlBlock();
        continue;
      }

      if (isReadmeRawHtmlLine(line)) {
        flushParagraph();
        flushList();
        htmlBlockLines.push(line);
        const nextLine = String(lines[i + 1] ?? '');
        if (!isReadmeRawHtmlContinuationLine(nextLine, htmlBlockLines)) {
          flushHtmlBlock();
        }
        continue;
      }

      const nextLine = String(lines[i + 1] ?? '');
      if (line.includes('|') && isReadmeTableDividerLine(nextLine)) {
        const headerCells = parseReadmeTableRow(line);
        if (headerCells && headerCells.length) {
          flushParagraph();
          flushList();
          flushHtmlBlock();
          const bodyRows = [];
          let j = i + 2;
          while (j < lines.length) {
            const rowLine = String(lines[j] ?? '');
            if (!rowLine.trim()) break;
            if (!rowLine.includes('|')) break;
            const rowCells = parseReadmeTableRow(rowLine);
            if (!rowCells || !rowCells.length) break;
            bodyRows.push(rowCells);
            j += 1;
          }
          out.push(renderMarkdownTableHtml(headerCells, nextLine, bodyRows));
          i = j - 1;
          continue;
        }
      }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        flushHtmlBlock();
        const level = Math.min(4, heading[1].length);
        out.push(`<h${level}>${renderMarkdownInline(heading[2].trim())}</h${level}>`);
        continue;
      }

      if (/^\s*---+\s*$/.test(line)) {
        flushParagraph();
        flushList();
        flushHtmlBlock();
        out.push('<hr>');
        continue;
      }

      const list = line.match(/^\s*[-*]\s+(.+)$/);
      if (list) {
        flushParagraph();
        flushHtmlBlock();
        listItems.push(list[1].trim());
        continue;
      }

      flushHtmlBlock();
      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    flushHtmlBlock();
    if (inCode) out.push('</code></pre>');
    return out.join('');
  }

  function isCodexLikeExtensionDetail(detail = {}) {
    const id = String(detail?.id || '').trim();
    const name = String(detail?.displayName || detail?.name || '').trim();
    return /openai\.(chatgpt|codex)|(^|[.\s-])codex($|[.\s-])/i.test(id) || /codex/i.test(name);
  }

  function getExtensionContributes(detail = {}) {
    return detail?.contributes && typeof detail.contributes === 'object' ? detail.contributes : {};
  }

  function getExtensionActivationEvents(detail = {}) {
    return Array.isArray(detail.activationEvents) ? detail.activationEvents.map((v) => String(v || '').trim()).filter(Boolean) : [];
  }

  function getExtensionApiProposals(detail = {}) {
    return Array.isArray(detail.enabledApiProposals) ? detail.enabledApiProposals.map((v) => String(v || '').trim()).filter(Boolean) : [];
  }

  function collectExtensionFeatureCommandRows(detail = {}) {
    const contributes = getExtensionContributes(detail);
    const contributed = Array.isArray(contributes.commands) ? contributes.commands : [];
    const runtime = Array.isArray(detail.commands) ? detail.commands : [];
    const keybindings = Array.isArray(contributes.keybindings) ? contributes.keybindings : [];
    const menus = contributes.menus && typeof contributes.menus === 'object' ? contributes.menus : {};
    const map = new Map();

    const ensureRow = (id) => {
      const key = String(id || '').trim();
      if (!key) return null;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title: key,
          category: '',
          keys: new Set(),
          menuContexts: new Set(),
          runtimeRegistered: false
        });
      }
      return map.get(key);
    };

    for (const cmd of contributed) {
      const row = ensureRow(cmd?.command || cmd?.id);
      if (!row) continue;
      const category = typeof cmd?.category === 'string'
        ? cmd.category
        : (cmd?.category && typeof cmd.category === 'object' ? String(cmd.category.value || cmd.category.label || '') : '');
      row.title = String(cmd?.title || row.title || row.id);
      if (category && !row.category) row.category = category;
    }

    for (const cmd of runtime) {
      const row = ensureRow(cmd?.id);
      if (!row) continue;
      row.runtimeRegistered = true;
      if (cmd?.title) row.title = String(cmd.title);
      if (cmd?.when) row.menuContexts.add(String(cmd.when));
    }

    for (const kb of keybindings) {
      const row = ensureRow(kb?.command);
      if (!row) continue;
      const keyParts = [kb?.key, kb?.mac, kb?.linux, kb?.win].map((v) => String(v || '').trim()).filter(Boolean);
      keyParts.forEach((k) => row.keys.add(k));
    }

    for (const [menuId, entries] of Object.entries(menus)) {
      if (!Array.isArray(entries)) continue;
      for (const item of entries) {
        const row = ensureRow(item?.command);
        if (!row) continue;
        row.menuContexts.add(String(menuId || '').trim());
      }
    }

    return [...map.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }));
  }

  function collectExtensionConfigurationSettings(detail = {}) {
    const contributes = getExtensionContributes(detail);
    const root = contributes.configuration;
    const out = [];

    const pushProperty = (key, schema, scopeLabel) => {
      const s = schema && typeof schema === 'object' ? schema : {};
      const type = Array.isArray(s.type) ? s.type.join(' | ') : String(s.type || '').trim();
      out.push({
        key: String(key || '').trim(),
        title: String(s.title || '').trim(),
        description: String(s.markdownDescription || s.description || '').trim(),
        type: type || (s.enum ? 'enum' : ''),
        defaultValue: Object.prototype.hasOwnProperty.call(s, 'default') ? s.default : undefined,
        scopeLabel: String(scopeLabel || '').trim()
      });
    };

    const walk = (node, scopeLabel = '') => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach((entry) => walk(entry, scopeLabel));
        return;
      }
      if (typeof node !== 'object') return;
      const nextScope = String(node.title || node.id || scopeLabel || '').trim();
      if (node.properties && typeof node.properties === 'object') {
        for (const [key, schema] of Object.entries(node.properties)) {
          pushProperty(key, schema, nextScope);
        }
      }
      ['allOf', 'oneOf', 'anyOf'].forEach((listKey) => {
        if (Array.isArray(node[listKey])) node[listKey].forEach((entry) => walk(entry, nextScope));
      });
    };

    walk(root);
    return out.sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }));
  }

  function collectExtensionViewContainers(detail = {}) {
    const contributes = getExtensionContributes(detail);
    const vc = contributes.viewsContainers && typeof contributes.viewsContainers === 'object' ? contributes.viewsContainers : {};
    const groups = [];
    for (const location of ['activitybar', 'panel']) {
      const items = Array.isArray(vc[location]) ? vc[location] : [];
      for (const item of items) {
        groups.push({
          location,
          id: String(item?.id || '').trim(),
          title: String(item?.title || item?.id || '').trim(),
          icon: typeof item?.icon === 'string' ? item.icon : (item?.icon?.dark || item?.icon?.light || '')
        });
      }
    }
    return groups;
  }

  function collectExtensionViews(detail = {}) {
    const contributes = getExtensionContributes(detail);
    const raw = contributes.views && typeof contributes.views === 'object' ? contributes.views : {};
    const rows = [];
    for (const [containerId, list] of Object.entries(raw)) {
      const views = Array.isArray(list) ? list : [];
      for (const view of views) {
        rows.push({
          containerId: String(containerId || '').trim(),
          id: String(view?.id || '').trim(),
          name: String(view?.name || view?.id || '').trim(),
          when: String(view?.when || '').trim(),
          type: String(view?.type || '').trim()
        });
      }
    }
    return rows;
  }

  function collectExtensionLanguages(detail = {}) {
    const contributes = getExtensionContributes(detail);
    const list = Array.isArray(contributes.languages) ? contributes.languages : [];
    return list.map((lang) => ({
      id: String(lang?.id || '').trim(),
      aliases: Array.isArray(lang?.aliases) ? lang.aliases.map((v) => String(v || '').trim()).filter(Boolean) : [],
      extensions: Array.isArray(lang?.extensions) ? lang.extensions.map((v) => String(v || '').trim()).filter(Boolean) : [],
      filenames: Array.isArray(lang?.filenames) ? lang.filenames.map((v) => String(v || '').trim()).filter(Boolean) : []
    })).filter((lang) => lang.id || lang.aliases.length || lang.extensions.length || lang.filenames.length);
  }

  function collectExtensionCustomEditors(detail = {}) {
    const contributes = getExtensionContributes(detail);
    const list = Array.isArray(contributes.customEditors) ? contributes.customEditors : [];
    return list.map((item) => ({
      viewType: String(item?.viewType || '').trim(),
      displayName: String(item?.displayName || item?.viewType || '').trim(),
      priority: String(item?.priority || '').trim(),
      selectors: Array.isArray(item?.selector) ? item.selector.map((sel) => String(sel?.filenamePattern || '').trim()).filter(Boolean) : []
    })).filter((row) => row.viewType || row.displayName);
  }

  function getExtensionDetailFeatureSections(detail = {}) {
    const commands = collectExtensionFeatureCommandRows(detail);
    const activationEvents = getExtensionActivationEvents(detail);
    const apiProposals = getExtensionApiProposals(detail);
    const customEditors = collectExtensionCustomEditors(detail);
    const languages = collectExtensionLanguages(detail);
    const settings = collectExtensionConfigurationSettings(detail);
    const viewContainers = collectExtensionViewContainers(detail);
    const views = collectExtensionViews(detail);
    return [
      { id: 'runtime-status', label: 'Runtime Status', count: null },
      { id: 'activation-events', label: 'Activation Events', count: activationEvents.length },
      { id: 'api-proposals', label: 'API Proposals', count: apiProposals.length },
      { id: 'commands', label: 'Commands', count: commands.length },
      { id: 'custom-editors', label: 'Custom Editors', count: customEditors.length },
      { id: 'programming-languages', label: 'Programming Languages', count: languages.length },
      { id: 'settings', label: 'Settings', count: settings.length },
      { id: 'view-containers', label: 'View Containers', count: viewContainers.length },
      { id: 'views', label: 'Views', count: views.length }
    ];
  }

  function renderExtensionFeatureRowsTable(columns = [], rows = []) {
    if (!Array.isArray(rows) || !rows.length) {
      return '<p class="ext-feature-empty">No data available for this section.</p>';
    }
    return `
      <div class="ext-feature-table-wrap">
        <table class="ext-feature-table">
          <thead>
            <tr>${columns.map((col) => `<th>${escapeHtml(String(col.label || ''))}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                ${columns.map((col) => `<td>${typeof col.render === 'function' ? col.render(row) : escapeHtml(String(row?.[col.key] ?? ''))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderExtensionFeatureContentHtml(detail = {}, sectionId = 'runtime-status') {
    const contributes = getExtensionContributes(detail);
    const activationEvents = getExtensionActivationEvents(detail);
    const apiProposals = getExtensionApiProposals(detail);
    const commands = collectExtensionFeatureCommandRows(detail);
    const customEditors = collectExtensionCustomEditors(detail);
    const languages = collectExtensionLanguages(detail);
    const settings = collectExtensionConfigurationSettings(detail);
    const viewContainers = collectExtensionViewContainers(detail);
    const views = collectExtensionViews(detail);
    const codexLike = isCodexLikeExtensionDetail(detail);
    const runtimeError = String(detail.runtimeError || detail.detailError || '').trim();
    const runtimeCommands = Array.isArray(detail.commands) ? detail.commands : [];
    const hostStatus = String(state.extensionHostStatus || 'unknown');
    const unsupportedCodexApis = apiProposals.filter((id) => /chatSessionsProvider|languageModelProxy/i.test(id));

    if (sectionId === 'runtime-status') {
      const contributedCount = Array.isArray(contributes.commands) ? contributes.commands.length : 0;
      const viewCount = views.length;
      const vcCount = viewContainers.length;
      const settingsCount = settings.length;
      return `
        <div class="ext-feature-section">
          <h3>Runtime Status</h3>
          <div class="ext-feature-kv-grid">
            <div class="ext-feature-kv"><div class="k">Extension Host</div><div class="v">${escapeHtml(hostStatus)}</div></div>
            <div class="ext-feature-kv"><div class="k">Enabled</div><div class="v">${detail.enabled !== false ? 'Yes' : 'No'}</div></div>
            <div class="ext-feature-kv"><div class="k">Compatibility</div><div class="v">${escapeHtml(String(detail.compatibilityMode || 'controlled-vscode'))}</div></div>
            <div class="ext-feature-kv"><div class="k">Runtime Commands</div><div class="v">${escapeHtml(String(runtimeCommands.length || detail.runtimeCommands || 0))}</div></div>
            <div class="ext-feature-kv"><div class="k">Contributed Commands</div><div class="v">${escapeHtml(String(contributedCount))}</div></div>
            <div class="ext-feature-kv"><div class="k">Views / Containers</div><div class="v">${escapeHtml(`${viewCount} / ${vcCount}`)}</div></div>
            <div class="ext-feature-kv"><div class="k">Settings</div><div class="v">${escapeHtml(String(settingsCount))}</div></div>
            <div class="ext-feature-kv"><div class="k">Activation Events</div><div class="v">${escapeHtml(String(activationEvents.length))}</div></div>
          </div>
          ${runtimeError ? `<div class="ext-feature-callout error">Runtime error: ${escapeHtml(runtimeError)}</div>` : ''}
          ${codexLike ? `
            <div class="ext-feature-callout ${unsupportedCodexApis.length ? 'warn' : 'info'}">
              <strong>Codex / ChatGPT Extension Compatibility</strong><br>
              Coder can load the extension manifest, commands, views, settings, and webview panels in compatibility mode. 
              ${unsupportedCodexApis.length
                ? `Some VS Code proposed APIs requested by this extension are not implemented yet in Coder: <code>${escapeHtml(unsupportedCodexApis.join(', '))}</code>. Use Codex CLI as the functional fallback for those capabilities.`
                : 'Core compatibility mode is active. If a command does not run, check the Commands section and runtime status.'}
            </div>
          ` : ''}
          ${runtimeCommands.length ? `
            <div class="ext-feature-block">
              <div class="ext-feature-block-title">Runtime Registered Commands</div>
              <div class="ext-feature-chip-list">
                ${runtimeCommands.slice(0, 20).map((cmd) => `<button class="side-tool-btn" data-side-action="extensions-run-command" data-command-id="${escapeHtml(String(cmd.id || ''))}">${escapeHtml(String(cmd.id || cmd.title || 'command'))}</button>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    if (sectionId === 'activation-events') {
      return `
        <div class="ext-feature-section">
          <h3>Activation Events</h3>
          ${activationEvents.length
            ? `<ul class="ext-feature-bullet-list">${activationEvents.map((ev) => `<li><code>${escapeHtml(ev)}</code></li>`).join('')}</ul>`
            : '<p class="ext-feature-empty">No activation events declared.</p>'}
        </div>
      `;
    }

    if (sectionId === 'api-proposals') {
      return `
        <div class="ext-feature-section">
          <h3>API Proposals</h3>
          ${apiProposals.length
            ? `<ul class="ext-feature-bullet-list">${apiProposals.map((ev) => `<li><code>${escapeHtml(ev)}</code></li>`).join('')}</ul>`
            : '<p class="ext-feature-empty">No enabled API proposals declared.</p>'}
        </div>
      `;
    }

    if (sectionId === 'commands') {
      return `
        <div class="ext-feature-section">
          <h3>Commands</h3>
          ${renderExtensionFeatureRowsTable(
            [
              { label: 'ID', render: (row) => `<code>${escapeHtml(row.id)}</code>` },
              { label: 'Title', render: (row) => escapeHtml(`${row.category ? `${row.category}: ` : ''}${row.title || row.id}`) },
              { label: 'Keyboard Shortcuts', render: (row) => row.keys?.size ? `<div class="ext-feature-inline-tags">${[...row.keys].slice(0, 4).map((k) => `<code>${escapeHtml(k)}</code>`).join('')}</div>` : '<span class="ext-feature-dim">-</span>' },
              { label: 'Menu Contexts', render: (row) => row.menuContexts?.size ? `<div class="ext-feature-inline-tags">${[...row.menuContexts].slice(0, 4).map((k) => `<code>${escapeHtml(k)}</code>`).join('')}</div>` : '<span class="ext-feature-dim">-</span>' }
            ],
            commands
          )}
        </div>
      `;
    }

    if (sectionId === 'custom-editors') {
      return `
        <div class="ext-feature-section">
          <h3>Custom Editors</h3>
          ${renderExtensionFeatureRowsTable(
            [
              { label: 'View Type', render: (row) => `<code>${escapeHtml(row.viewType || '')}</code>` },
              { label: 'Display Name', key: 'displayName' },
              { label: 'Priority', key: 'priority' },
              { label: 'Selectors', render: (row) => row.selectors?.length ? row.selectors.map((s) => `<code>${escapeHtml(s)}</code>`).join(' ') : '<span class="ext-feature-dim">-</span>' }
            ],
            customEditors
          )}
        </div>
      `;
    }

    if (sectionId === 'programming-languages') {
      return `
        <div class="ext-feature-section">
          <h3>Programming Languages</h3>
          ${renderExtensionFeatureRowsTable(
            [
              { label: 'Language ID', render: (row) => `<code>${escapeHtml(row.id || '')}</code>` },
              { label: 'Aliases', render: (row) => row.aliases?.length ? escapeHtml(row.aliases.join(', ')) : '<span class="ext-feature-dim">-</span>' },
              { label: 'Extensions', render: (row) => row.extensions?.length ? row.extensions.slice(0, 8).map((s) => `<code>${escapeHtml(s)}</code>`).join(' ') : '<span class="ext-feature-dim">-</span>' },
              { label: 'Filenames', render: (row) => row.filenames?.length ? row.filenames.slice(0, 6).map((s) => `<code>${escapeHtml(s)}</code>`).join(' ') : '<span class="ext-feature-dim">-</span>' }
            ],
            languages
          )}
        </div>
      `;
    }

    if (sectionId === 'settings') {
      return `
        <div class="ext-feature-section">
          <h3>Settings</h3>
          ${renderExtensionFeatureRowsTable(
            [
              { label: 'ID', render: (row) => `<code>${escapeHtml(row.key || '')}</code>` },
              { label: 'Title', render: (row) => escapeHtml(row.title || row.scopeLabel || '-') },
              { label: 'Type', render: (row) => row.type ? `<code>${escapeHtml(row.type)}</code>` : '<span class="ext-feature-dim">-</span>' },
              { label: 'Default', render: (row) => (row.defaultValue !== undefined) ? `<code>${escapeHtml(truncateText(JSON.stringify(row.defaultValue), 120))}</code>` : '<span class="ext-feature-dim">-</span>' }
            ],
            settings
          )}
        </div>
      `;
    }

    if (sectionId === 'view-containers') {
      return `
        <div class="ext-feature-section">
          <h3>View Containers</h3>
          ${renderExtensionFeatureRowsTable(
            [
              { label: 'Location', render: (row) => `<code>${escapeHtml(row.location || '')}</code>` },
              { label: 'ID', render: (row) => `<code>${escapeHtml(row.id || '')}</code>` },
              { label: 'Title', key: 'title' },
              { label: 'Icon', render: (row) => row.icon ? `<code>${escapeHtml(row.icon)}</code>` : '<span class="ext-feature-dim">-</span>' }
            ],
            viewContainers
          )}
        </div>
      `;
    }

    if (sectionId === 'views') {
      return `
        <div class="ext-feature-section">
          <h3>Views</h3>
          ${renderExtensionFeatureRowsTable(
            [
              { label: 'Container', render: (row) => `<code>${escapeHtml(row.containerId || '')}</code>` },
              { label: 'ID', render: (row) => `<code>${escapeHtml(row.id || '')}</code>` },
              { label: 'Name', key: 'name' },
              { label: 'When', render: (row) => row.when ? `<code>${escapeHtml(row.when)}</code>` : '<span class="ext-feature-dim">-</span>' }
            ],
            views
          )}
        </div>
      `;
    }

    return '<p class="ext-feature-empty">Unknown feature section.</p>';
  }

  function renderExtensionFeaturesPaneHtml(detail = {}) {
    const sections = getExtensionDetailFeatureSections(detail);
    const allowed = new Set(sections.map((s) => s.id));
    const active = allowed.has(String(detail.featureSection || '')) ? String(detail.featureSection) : 'runtime-status';
    const navHtml = sections.map((section) => {
      const countHtml = Number.isFinite(Number(section.count))
        ? `<span class="ext-feature-nav-count">${escapeHtml(String(section.count))}</span>`
        : '';
      return `
        <button type="button"
          class="ext-feature-nav-item ${active === section.id ? 'active' : ''}"
          data-ext-detail-action="feature-section"
          data-ext-detail-section="${escapeHtml(section.id)}">
          <span>${escapeHtml(section.label)}</span>
          ${countHtml}
        </button>
      `;
    }).join('');

    return `
      <div class="ext-feature-layout">
        <div class="ext-feature-nav">${navHtml}</div>
        <div class="ext-feature-content">
          ${renderExtensionFeatureContentHtml(detail, active)}
        </div>
      </div>
    `;
  }

  function renderExtensionDetailView() {
    const host = els['extension-detail-view'];
    const detail = state.extensionDetailView;
    if (!host) return;
    if (!detail) {
      host.innerHTML = '<div class="ext-detail-empty">Select an extension to view details.</div>';
      return;
    }

    const displayName = String(detail.displayName || detail.name || detail.id || 'Extension');
    const publisher = String(detail.publisherDisplayName || detail.publisher || detail.namespace || '').trim();
    const desc = String(detail.description || '').trim();
    const version = String(detail.version || '').trim();
    const homepageUrl = sanitizeHttpUrl(detail.homepageUrl || '');
    const repositoryUrl = sanitizeHttpUrl(detail.repositoryUrl || '');
    const iconUrl = String(detail.iconUrl || '').trim();
    const installed = Boolean(detail.installed);
    const installedEntry = (Array.isArray(state.extensionCatalog) ? state.extensionCatalog : []).find((ext) => {
      const installedId = String(ext?.id || '').trim();
      const detailId = String(detail.id || '').trim();
      if (installedId && detailId && installedId === detailId) return true;
      const extNs = String(ext?.namespace || ext?.publisher || '').trim();
      const extName = String(ext?.name || '').trim();
      const detailNs = String(detail.namespace || '').trim();
      const detailName = String(detail.name || '').trim();
      return Boolean(extNs && extName && detailNs && detailName &&
        extNs.localeCompare(detailNs, undefined, { sensitivity: 'accent' }) === 0 &&
        extName.localeCompare(detailName, undefined, { sensitivity: 'accent' }) === 0);
    }) || null;
    const installedId = String(installedEntry?.id || detail.id || '').trim();
    const enabled = installedEntry ? installedEntry.enabled !== false : (detail.enabled !== false);
    const runtimeCommands = Number(detail.runtimeCommands || 0) || 0;
    const contributedCommands = Number(detail.contributedCommands || 0) || 0;
    const installing = state.marketplaceInstalling === detail.id;
    const installedNow = installed || Boolean(installedEntry);
    const metrics = [];
    if (Number(detail.downloadCount) > 0) metrics.push(`${formatCompactNumber(Number(detail.downloadCount))} installs`);
    if (Number(detail.averageRating) > 0) metrics.push(`${Number(detail.averageRating).toFixed(1)}★${Number(detail.reviewCount) > 0 ? ` (${Number(detail.reviewCount)})` : ''}`);
    if (version) metrics.push(`v${version}`);
    if (detail.source === 'installed') metrics.push(enabled ? 'Enabled' : 'Disabled');

    const installRows = [];
    if (detail.id) installRows.push(['Identifier', detail.id]);
    if (version) installRows.push(['Version', version]);
    if (detail.lastUpdated || detail.timestamp) installRows.push(['Last Updated', formatExtensionDate(detail.lastUpdated || detail.timestamp)]);
    if (detail.license) installRows.push(['License', detail.license]);

    const marketRows = [];
    if (publisher) marketRows.push(['Publisher', publisher]);
    if (detail.downloadCount) marketRows.push(['Downloads', formatCompactNumber(detail.downloadCount)]);
    if (detail.averageRating) marketRows.push(['Rating', `${Number(detail.averageRating).toFixed(1)}${detail.reviewCount ? ` (${detail.reviewCount})` : ''}`]);
    if (detail.namespaceAccess) marketRows.push(['Access', detail.namespaceAccess]);

    const err = String(detail.runtimeError || detail.detailError || '').trim();

    const readmeHtml = renderExtensionReadmeHtml(detail.readmeMarkdown || '');
    const categories = Array.isArray(detail.categories) ? detail.categories : [];
    const tags = Array.isArray(detail.tags) ? detail.tags : [];
    const activationEvents = Array.isArray(detail.activationEvents) ? detail.activationEvents : [];
    const detailTab = String(detail.detailTab || '').trim() === 'features' ? 'features' : 'details';
    const readmeStatus = detail.detailLoading
      ? '<div class="ext-detail-card"><h4>Loading Details</h4><p>Fetching extension metadata and README from Open VSX...</p></div>'
      : (err && !readmeHtml
          ? `<div class="ext-detail-card"><h4>Details</h4><p style="color:#ffb9b9;">${escapeHtml(err)}</p></div>`
          : '');
    const detailTabsHtml = `
      <div class="ext-detail-tabs" role="tablist" aria-label="Extension detail tabs">
        <button type="button"
          class="ext-detail-tab ${detailTab === 'details' ? 'active' : ''}"
          role="tab"
          aria-selected="${detailTab === 'details' ? 'true' : 'false'}"
          data-ext-detail-action="switch-tab"
          data-ext-detail-tab="details">
          Details
        </button>
        <button type="button"
          class="ext-detail-tab ${detailTab === 'features' ? 'active' : ''}"
          role="tab"
          aria-selected="${detailTab === 'features' ? 'true' : 'false'}"
          data-ext-detail-action="switch-tab"
          data-ext-detail-tab="features">
          Features
        </button>
      </div>
    `;

    host.innerHTML = `
      <div class="ext-detail-scroll">
        <div class="ext-detail-wrap">
          <div class="ext-detail-hero">
            ${iconUrl
              ? `<img class="ext-detail-icon" src="${escapeHtml(iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;ext-detail-icon-fallback&quot;>${escapeHtml((displayName[0] || 'E').toUpperCase())}</div>'">`
              : `<div class="ext-detail-icon-fallback">${escapeHtml((displayName[0] || 'E').toUpperCase())}</div>`}
            <div>
              <h2 class="ext-detail-title">${escapeHtml(displayName)}</h2>
              <div class="ext-detail-publisher">${escapeHtml(publisher || 'Unknown publisher')}</div>
              <div class="ext-detail-desc">${escapeHtml(desc || 'No description provided.')}</div>
              ${metrics.length ? `<div class="ext-detail-meta">${metrics.map((m) => `<span>${escapeHtml(m)}</span>`).join('')}</div>` : ''}
              <div class="ext-detail-actions">
                ${installedNow
                  ? `<button class="side-tool-btn" data-side-action="extensions-toggle" data-extension-id="${escapeHtml(installedId)}" data-enabled="${enabled ? '1' : '0'}">${enabled ? 'Disable' : 'Enable'}</button>
                     <button class="side-tool-btn danger" data-side-action="extensions-uninstall" data-extension-id="${escapeHtml(installedId)}">Uninstall</button>`
                  : `<button class="ext-market-install" data-side-action="extensions-marketplace-install" data-ext-namespace="${escapeHtml(detail.namespace || '')}" data-ext-name="${escapeHtml(detail.name || '')}" data-ext-version="${escapeHtml(version)}" ${installing ? 'disabled' : ''}>${installing ? 'Installing...' : 'Install'}</button>`}
                ${homepageUrl ? `<button class="ext-market-open" data-side-action="extensions-marketplace-open" data-url="${escapeHtml(homepageUrl)}">Open</button>` : ''}
                <button class="side-tool-btn" data-ext-detail-action="close">Close Tab</button>
              </div>
            </div>
          </div>

          <div class="ext-detail-grid">
            <div class="ext-detail-main">
              ${detailTabsHtml}
              ${detailTab === 'features'
                ? renderExtensionFeaturesPaneHtml(detail)
                : `
                  ${readmeStatus}
                  ${readmeHtml ? `<div class="ext-detail-card ext-readme-card"><h4>Details</h4><div class="ext-readme">${readmeHtml}</div></div>` : ''}
                  ${!readmeHtml && !readmeStatus ? `<div class="ext-detail-card"><h4>Details</h4><p>${escapeHtml(desc || 'No details available for this extension.')}</p></div>` : ''}
                  ${(activationEvents.length || runtimeCommands || contributedCommands)
                    ? `<div class="ext-detail-card">
                        <h4>Features</h4>
                        <div class="ext-detail-props">
                          ${runtimeCommands ? `<div class="ext-detail-prop"><div class="k">Runtime</div><div class="v">${escapeHtml(String(runtimeCommands))} command(s)</div></div>` : ''}
                          ${contributedCommands ? `<div class="ext-detail-prop"><div class="k">Contributed</div><div class="v">${escapeHtml(String(contributedCommands))} command(s)</div></div>` : ''}
                          ${activationEvents.length ? `<div class="ext-detail-prop"><div class="k">Activation</div><div class="v">${escapeHtml(activationEvents.slice(0, 6).join(', '))}${activationEvents.length > 6 ? ' ...' : ''}</div></div>` : ''}
                        </div>
                      </div>`
                    : ''}
                `}
            </div>
            <div class="ext-detail-side-stack">
              <div class="ext-detail-card">
                <h4>Installation</h4>
                <div class="ext-detail-props">
                  ${installRows.map(([k, v]) => `
                    <div class="ext-detail-prop">
                      <div class="k">${escapeHtml(k)}</div>
                      <div class="v">${escapeHtml(String(v))}</div>
                    </div>
                  `).join('') || '<p>No installation metadata.</p>'}
                </div>
              </div>
              ${marketRows.length ? `<div class="ext-detail-card">
                <h4>Marketplace</h4>
                <div class="ext-detail-props">
                  ${marketRows.map(([k, v]) => `
                    <div class="ext-detail-prop">
                      <div class="k">${escapeHtml(k)}</div>
                      <div class="v">${escapeHtml(String(v))}</div>
                    </div>
                  `).join('')}
                </div>
              </div>` : ''}
              ${categories.length ? `<div class="ext-detail-card"><h4>Categories</h4><div class="ext-detail-meta">${categories.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div></div>` : ''}
              ${tags.length ? `<div class="ext-detail-card"><h4>Tags</h4><div class="ext-detail-meta">${tags.slice(0, 20).map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div></div>` : ''}
              ${(homepageUrl || repositoryUrl || sanitizeHttpUrl(detail.files?.changelog || '') || sanitizeHttpUrl(detail.files?.license || '')) ? `
                <div class="ext-detail-card">
                  <h4>Resources</h4>
                  <div class="side-tools">
                    ${homepageUrl ? `<button class="side-tool-btn" data-side-action="extensions-marketplace-open" data-url="${escapeHtml(homepageUrl)}">Homepage</button>` : ''}
                    ${repositoryUrl ? `<button class="side-tool-btn" data-side-action="extensions-marketplace-open" data-url="${escapeHtml(repositoryUrl)}">Repository</button>` : ''}
                    ${sanitizeHttpUrl(detail.files?.changelog || '') ? `<button class="side-tool-btn" data-side-action="extensions-marketplace-open" data-url="${escapeHtml(sanitizeHttpUrl(detail.files.changelog))}">Changelog</button>` : ''}
                    ${sanitizeHttpUrl(detail.files?.license || '') ? `<button class="side-tool-btn" data-side-action="extensions-marketplace-open" data-url="${escapeHtml(sanitizeHttpUrl(detail.files.license))}">License</button>` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function diagnosticsSeverityRank(severity) {
    return String(severity || '').toLowerCase() === 'error' ? 2 : 1;
  }

  function makeEditorDiagnostic(partial = {}) {
    return {
      line: Math.max(1, Math.floor(Number(partial.line) || 1)),
      col: Math.max(1, Math.floor(Number(partial.col) || 1)),
      severity: String(partial.severity || 'warning').toLowerCase() === 'error' ? 'error' : 'warning',
      code: String(partial.code || '').trim(),
      message: String(partial.message || '').trim() || 'Issue detected',
      suggestion: String(partial.suggestion || '').trim()
    };
  }

  function editorDiagnosticSeverityFromExternal(value) {
    if (value === 0) return 'error'; // vscode.DiagnosticSeverity.Error
    if (typeof value === 'string' && /error/i.test(value)) return 'error';
    return 'warning';
  }

  function normalizeExternalEditorDiagnostic(input = {}) {
    if (!input || typeof input !== 'object') return null;
    const range = input.range && typeof input.range === 'object' ? input.range : {};
    const start = range.start && typeof range.start === 'object' ? range.start : {};
    const hasRange = Number.isFinite(Number(start.line)) || Number.isFinite(Number(start.character));
    const line = hasRange ? Number(start.line) : Number(input.line);
    const character = hasRange ? Number(start.character) : (Number(input.col) - 1);
    const codeRaw = (input.code && typeof input.code === 'object') ? (input.code.value ?? input.code.target ?? '') : (input.code ?? '');
    const source = String(input.source || '').trim();
    const code = String(codeRaw || '').trim();
    const msg = String(input.message || '').trim();
    if (!msg) return null;
    return makeEditorDiagnostic({
      line: Number.isFinite(line) ? (hasRange ? (line + 1) : line) : 1,
      col: Number.isFinite(character) ? (hasRange ? (character + 1) : Math.max(1, character + 1)) : 1,
      severity: editorDiagnosticSeverityFromExternal(input.severity),
      code: source && code ? `${source}:${code}` : (code || source || ''),
      message: msg
    });
  }

  function normalizeExternalDiagnosticsList(list) {
    const out = [];
    const seen = new Set();
    for (const item of Array.isArray(list) ? list : []) {
      const diag = normalizeExternalEditorDiagnostic(item);
      if (!diag) continue;
      const key = `${diag.severity}|${diag.line}|${diag.col}|${diag.code}|${diag.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(diag);
    }
    return sortEditorDiagnostics(out);
  }

  function setExternalDiagnosticsForPath(sourceKey, filePath, diagnostics) {
    const key = String(sourceKey || '').trim();
    const normalizedPath = normalizePath(filePath);
    if (!key || !normalizedPath) return;
    if (!(state.externalLanguageDiagnostics instanceof Map)) state.externalLanguageDiagnostics = new Map();

    const normalizedDiagnostics = normalizeExternalDiagnosticsList(diagnostics);
    const pathEntry = (state.externalLanguageDiagnostics.get(normalizedPath) && typeof state.externalLanguageDiagnostics.get(normalizedPath) === 'object')
      ? { ...state.externalLanguageDiagnostics.get(normalizedPath) }
      : {};

    if (normalizedDiagnostics.length) {
      pathEntry[key] = normalizedDiagnostics;
      state.externalLanguageDiagnostics.set(normalizedPath, pathEntry);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(pathEntry, key)) {
      delete pathEntry[key];
    }
    if (Object.keys(pathEntry).length) state.externalLanguageDiagnostics.set(normalizedPath, pathEntry);
    else state.externalLanguageDiagnostics.delete(normalizedPath);
  }

  function getExternalDiagnosticsForPath(filePath) {
    const normalizedPath = normalizePath(filePath);
    if (!normalizedPath || !(state.externalLanguageDiagnostics instanceof Map)) return [];
    const pathEntry = state.externalLanguageDiagnostics.get(normalizedPath);
    if (!pathEntry || typeof pathEntry !== 'object') return [];
    const out = [];
    const seen = new Set();
    for (const list of Object.values(pathEntry)) {
      for (const diag of Array.isArray(list) ? list : []) {
        if (!diag || typeof diag !== 'object') continue;
        const normalized = makeEditorDiagnostic(diag);
        const key = `${normalized.severity}|${normalized.line}|${normalized.col}|${normalized.code}|${normalized.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(normalized);
      }
    }
    return sortEditorDiagnostics(out);
  }

  function setCompilerDiagnosticsForPath(filePath, diagnostics) {
    setExternalDiagnosticsForPath('compiler:c-run', filePath, diagnostics);
  }

  function parseCRunCompilerOutputDiagnostics(output, filePath) {
    const text = String(output || '');
    const normalizedTarget = normalizePath(filePath);
    if (!text || !normalizedTarget) return [];
    const out = [];
    const seen = new Set();
    const targetLower = normalizedTarget.toLowerCase();
    const targetBase = basenamePath(normalizedTarget).toLowerCase();

    for (const rawLine of text.split(/\r?\n/)) {
      const line = String(rawLine || '').trim();
      if (!line) continue;
      const m = line.match(/^(.*):(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note)\s*:\s*(.+)$/i);
      if (!m) continue;
      const diagPathRaw = String(m[1] || '').trim().replace(/^["']|["']$/g, '');
      const diagPath = normalizePath(diagPathRaw) || normalizePath(resolvePathLike(diagPathRaw, { baseDir: dirnamePath(normalizedTarget) }));
      const diagLower = String(diagPath || '').toLowerCase();
      const diagBase = basenamePath(diagPath || diagPathRaw).toLowerCase();
      if (!(diagLower === targetLower || (!diagPath && diagBase === targetBase) || (diagLower && diagBase === targetBase && /[\\/]/.test(diagLower.charAt(Math.max(0, diagLower.length - targetBase.length - 1))) && diagLower.endsWith(targetBase)))) {
        continue;
      }
      const level = String(m[4] || '').toLowerCase();
      const message = String(m[5] || '').trim();
      const diag = makeEditorDiagnostic({
        line: Number(m[2]) || 1,
        col: Number(m[3]) || 1,
        severity: /error/.test(level) ? 'error' : 'warning',
        code: `compiler:${level}`,
        message
      });
      const key = `${diag.severity}|${diag.line}|${diag.col}|${diag.code}|${diag.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(diag);
    }

    return sortEditorDiagnostics(out);
  }

  function isInbuiltCppAwaitingMoreInput(result, diagnostics = []) {
    const compiler = String(result?.compiler || '').toLowerCase();
    const profile = String(result?.compilerProfile || '').toLowerCase();
    const errorText = String(result?.error || '').toLowerCase();
    const inbuiltCpp = compiler.includes('inbuilt-mini-cpp') || (profile === 'inbuilt' && compiler.includes('cpp'));
    if (!inbuiltCpp) return false;
    if (/requested more input|cin/.test(errorText) && /input|stdin/.test(errorText)) return true;
    return Array.isArray(diagnostics)
      && diagnostics.some((diag) => String(diag?.code || '').toLowerCase() === 'inbuilt-cpp:stdin-eof');
  }

  function sortEditorDiagnostics(list) {
    return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
      if ((a.line || 0) !== (b.line || 0)) return (a.line || 0) - (b.line || 0);
      if ((a.col || 0) !== (b.col || 0)) return (a.col || 0) - (b.col || 0);
      return diagnosticsSeverityRank(b.severity) - diagnosticsSeverityRank(a.severity);
    });
  }

  function fileDiagnosticsLanguage(file) {
    if (!file) return '';
    const lang = String(file.language || '').trim().toLowerCase();
    if (lang === 'html' || lang === 'css' || lang === 'c') return lang;
    if (lang === 'plaintext') {
      const ext = extensionOf(file.path || '');
      if (ext === 'c' || ext === 'h') return 'c';
    }
    return '';
  }

  function applyFileDiagnostics(file, diagnostics = [], meta = {}) {
    if (!file || typeof file !== 'object') return;
    const sorted = sortEditorDiagnostics(diagnostics).slice(0, MAX_EDITOR_DIAGNOSTIC_ITEMS);
    const lineIndex = {};
    let errorCount = 0;
    let warningCount = 0;
    sorted.forEach((diag, index) => {
      if (diag.severity === 'error') errorCount += 1;
      else warningCount += 1;
      const key = String(diag.line || 1);
      const existing = lineIndex[key];
      if (!existing || diagnosticsSeverityRank(diag.severity) > diagnosticsSeverityRank(existing.severity)) {
        lineIndex[key] = {
          index,
          severity: diag.severity,
          message: diag.message
        };
      }
    });
    file.diagnostics = sorted;
    file.diagnosticLineIndex = lineIndex;
    file.diagnosticSummary = {
      total: sorted.length,
      errors: errorCount,
      warnings: warningCount,
      language: String(meta.language || fileDiagnosticsLanguage(file) || ''),
      skipped: Boolean(meta.skipped),
      reason: String(meta.reason || '')
    };
  }

  function pushUniqueDiagnostic(out, partial, seen) {
    const diag = makeEditorDiagnostic(partial);
    const key = `${diag.severity}|${diag.line}|${diag.col}|${diag.code}|${diag.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(diag);
  }

  function maskHtmlRawTextBlocks(source) {
    let text = String(source || '');
    const rawTextTags = ['script', 'style', 'textarea', 'title'];
    for (const tag of rawTextTags) {
      const regex = new RegExp(`(<${tag}\\b[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'ig');
      text = text.replace(regex, (_m, open, inner, close) => `${open}${String(inner || '').replace(/[^\n]/g, ' ')}${close}`);
    }
    return text;
  }

  function analyzeHtmlDiagnostics(text) {
    const source = String(text || '');
    const masked = maskHtmlRawTextBlocks(source);
    const out = [];
    const seen = new Set();
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const stack = [];

    let commentSearchFrom = 0;
    while (true) {
      const start = masked.indexOf('<!--', commentSearchFrom);
      if (start < 0) break;
      const end = masked.indexOf('-->', start + 4);
      if (end < 0) {
        const loc = lineColFromOffset(masked, start);
        pushUniqueDiagnostic(out, {
          line: loc.line,
          col: loc.col,
          severity: 'error',
          code: 'html-unclosed-comment',
          message: 'Unclosed HTML comment.',
          suggestion: 'Add `-->` to close the comment.'
        }, seen);
        break;
      }
      commentSearchFrom = end + 3;
    }

    const tagRegex = /<!--[\s\S]*?-->|<\/?[A-Za-z][\w:-]*(?:\s[^<>]*?)?>/g;
    let match;
    while ((match = tagRegex.exec(masked))) {
      const token = String(match[0] || '');
      if (!token || token.startsWith('<!--')) continue;
      const tokenLoc = lineColFromOffset(masked, match.index);
      const tagMatch = token.match(/^<\/?\s*([A-Za-z][\w:-]*)/);
      if (!tagMatch) continue;
      const tagName = String(tagMatch[1] || '').toLowerCase();
      const isClosing = /^<\//.test(token);
      const selfClosing = /\/>\s*$/.test(token);
      const attrChunk = token
        .replace(/^<\/?\s*[A-Za-z][\w:-]*/, '')
        .replace(/\/?>\s*$/, '');
      const dblQuotes = (attrChunk.match(/"/g) || []).length;
      const sglQuotes = (attrChunk.match(/'/g) || []).length;
      if ((dblQuotes % 2) !== 0 || (sglQuotes % 2) !== 0) {
        pushUniqueDiagnostic(out, {
          line: tokenLoc.line,
          col: tokenLoc.col,
          severity: 'error',
          code: 'html-attr-quote',
          message: `Attribute quotes look unbalanced in <${tagName}>.`,
          suggestion: 'Close the missing quote in the tag attributes.'
        }, seen);
      }

      if (isClosing) {
        if (!stack.length) {
          pushUniqueDiagnostic(out, {
            line: tokenLoc.line,
            col: tokenLoc.col,
            severity: 'error',
            code: 'html-unexpected-close',
            message: `Unexpected closing tag </${tagName}>.`,
            suggestion: `Remove </${tagName}> or add a matching <${tagName}> before it.`
          }, seen);
          continue;
        }
        const top = stack[stack.length - 1];
        if (top.tag === tagName) {
          stack.pop();
          continue;
        }
        pushUniqueDiagnostic(out, {
          line: tokenLoc.line,
          col: tokenLoc.col,
          severity: 'error',
          code: 'html-mismatch-close',
          message: `Closing tag </${tagName}> does not match open <${top.tag}>.`,
          suggestion: `Change it to </${top.tag}> or close <${top.tag}> before closing <${tagName}>.`
        }, seen);
        const idx = [...stack].reverse().findIndex((entry) => entry.tag === tagName);
        if (idx >= 0) {
          stack.splice(stack.length - 1 - idx, idx + 1);
        } else {
          // keep stack as-is to report missing closing tags later
        }
        continue;
      }

      if (!selfClosing && !voidTags.has(tagName)) {
        stack.push({ tag: tagName, line: tokenLoc.line, col: tokenLoc.col });
      }
    }

    stack.slice(-8).forEach((entry) => {
      pushUniqueDiagnostic(out, {
        line: entry.line,
        col: entry.col,
        severity: 'error',
        code: 'html-unclosed-tag',
        message: `Tag <${entry.tag}> is not closed.`,
        suggestion: `Add </${entry.tag}> before the end of the document.`
      }, seen);
    });

    return sortEditorDiagnostics(out);
  }

  function collectBracketDiagnostics(text, options = {}) {
    const source = String(text || '');
    const out = [];
    const seen = new Set();
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const closingToOpen = { ')': '(', ']': '[', '}': '{' };
    const stack = [];
    let inBlockComment = false;
    let blockCommentStart = null;
    let inLineComment = false;
    let inString = '';
    let stringStart = null;
    let escaped = false;
    let line = 1;
    let col = 0;

    const allowLineComment = options.allowLineComment === true;
    const allowBlockComment = options.allowBlockComment !== false;
    const allowSingleQuote = options.allowSingleQuote !== false;
    const allowDoubleQuote = options.allowDoubleQuote !== false;

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      const next = source[i + 1] || '';
      col += 1;

      if (inLineComment) {
        if (ch === '\n') {
          inLineComment = false;
          line += 1;
          col = 0;
        }
        continue;
      }

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i += 1;
          col += 1;
          continue;
        }
        if (ch === '\n') {
          line += 1;
          col = 0;
        }
        continue;
      }

      if (inString) {
        if (ch === '\n') {
          pushUniqueDiagnostic(out, {
            line: stringStart?.line || line,
            col: stringStart?.col || 1,
            severity: 'error',
            code: `${options.codePrefix || 'syntax'}-string`,
            message: 'String literal is not closed before end of line.',
            suggestion: `Add the closing ${inString} quote.`
          }, seen);
          inString = '';
          stringStart = null;
          escaped = false;
          line += 1;
          col = 0;
          continue;
        }
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === inString) {
          inString = '';
          stringStart = null;
        }
        continue;
      }

      if (allowLineComment && ch === '/' && next === '/') {
        inLineComment = true;
        i += 1;
        col += 1;
        continue;
      }
      if (allowBlockComment && ch === '/' && next === '*') {
        inBlockComment = true;
        blockCommentStart = { line, col };
        i += 1;
        col += 1;
        continue;
      }
      if ((allowDoubleQuote && ch === '"') || (allowSingleQuote && ch === '\'')) {
        inString = ch;
        stringStart = { line, col };
        escaped = false;
        continue;
      }
      if (pairs[ch]) {
        stack.push({ open: ch, close: pairs[ch], line, col });
      } else if (closingToOpen[ch]) {
        const top = stack[stack.length - 1];
        if (!top || top.close !== ch) {
          pushUniqueDiagnostic(out, {
            line,
            col,
            severity: 'error',
            code: `${options.codePrefix || 'syntax'}-close`,
            message: `Unexpected '${ch}'.`,
            suggestion: `Remove '${ch}' or add a matching '${closingToOpen[ch]}' before it.`
          }, seen);
        } else {
          stack.pop();
        }
      }

      if (ch === '\n') {
        line += 1;
        col = 0;
      }
    }

    if (inString) {
      pushUniqueDiagnostic(out, {
        line: stringStart?.line || line,
        col: stringStart?.col || 1,
        severity: 'error',
        code: `${options.codePrefix || 'syntax'}-string-eof`,
        message: 'Unclosed string literal at end of file.',
        suggestion: `Add the closing ${inString} quote.`
      }, seen);
    }
    if (inBlockComment) {
      pushUniqueDiagnostic(out, {
        line: blockCommentStart?.line || line,
        col: blockCommentStart?.col || 1,
        severity: 'error',
        code: `${options.codePrefix || 'syntax'}-comment`,
        message: 'Unclosed block comment.',
        suggestion: 'Add `*/` to close the comment.'
      }, seen);
    }
    stack.slice(-10).forEach((entry) => {
      pushUniqueDiagnostic(out, {
        line: entry.line,
        col: entry.col,
        severity: 'error',
        code: `${options.codePrefix || 'syntax'}-open`,
        message: `Missing closing '${entry.close}' for '${entry.open}'.`,
        suggestion: `Add '${entry.close}' to close '${entry.open}'.`
      }, seen);
    });

    return sortEditorDiagnostics(out);
  }

  function analyzeCssDiagnostics(text) {
    const source = String(text || '');
    const out = collectBracketDiagnostics(source, {
      allowLineComment: false,
      allowBlockComment: true,
      allowSingleQuote: true,
      allowDoubleQuote: true,
      codePrefix: 'css'
    });
    const seen = new Set(out.map((d) => `${d.severity}|${d.line}|${d.col}|${d.code}|${d.message}`));
    const lines = source.split('\n');

    let inBlockComment = false;
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const rawLine = String(lines[i] ?? '');
      let lineText = rawLine;
      if (inBlockComment) {
        const endIdx = lineText.indexOf('*/');
        if (endIdx >= 0) {
          lineText = lineText.slice(endIdx + 2);
          inBlockComment = false;
        } else {
          continue;
        }
      }
      while (true) {
        const startIdx = lineText.indexOf('/*');
        if (startIdx < 0) break;
        const endIdx = lineText.indexOf('*/', startIdx + 2);
        if (endIdx < 0) {
          lineText = lineText.slice(0, startIdx);
          inBlockComment = true;
          break;
        }
        lineText = `${lineText.slice(0, startIdx)} ${lineText.slice(endIdx + 2)}`;
      }

      const trimmed = lineText.trim();
      const lineNo = i + 1;
      const openCount = (lineText.match(/\{/g) || []).length;
      const closeCount = (lineText.match(/\}/g) || []).length;
      const insideBefore = braceDepth > 0;

      if (trimmed && insideBefore && !/[{}]/.test(trimmed)) {
        if (!trimmed.startsWith('@') && !trimmed.startsWith('--')) {
          if (!trimmed.includes(':') && /^[A-Za-z_-]/.test(trimmed)) {
            pushUniqueDiagnostic(out, {
              line: lineNo,
              col: Math.max(1, rawLine.indexOf(trimmed) + 1),
              severity: 'error',
              code: 'css-missing-colon',
              message: 'Possible CSS declaration is missing `:`.',
              suggestion: 'Use `property: value;` inside CSS rule blocks.'
            }, seen);
          } else if (trimmed.includes(':') && !/[;{]\s*$/.test(trimmed) && !trimmed.endsWith('}')) {
            pushUniqueDiagnostic(out, {
              line: lineNo,
              col: Math.max(1, rawLine.length),
              severity: 'warning',
              code: 'css-missing-semicolon',
              message: 'CSS declaration may be missing a semicolon.',
              suggestion: 'Add `;` at the end of the declaration.'
            }, seen);
          }
        }
      }

      braceDepth = Math.max(0, braceDepth + openCount - closeCount);
    }

    return sortEditorDiagnostics(out);
  }

  function analyzeCDiagnostics(text) {
    const source = String(text || '');
    const out = collectBracketDiagnostics(source, {
      allowLineComment: true,
      allowBlockComment: true,
      allowSingleQuote: true,
      allowDoubleQuote: true,
      codePrefix: 'c'
    });
    const seen = new Set(out.map((d) => `${d.severity}|${d.line}|${d.col}|${d.code}|${d.message}`));
    const lines = source.split('\n');

    let inBlockComment = false;
    for (let i = 0; i < lines.length; i += 1) {
      const raw = String(lines[i] ?? '');
      let lineText = raw;
      if (inBlockComment) {
        const endIdx = lineText.indexOf('*/');
        if (endIdx < 0) continue;
        lineText = lineText.slice(endIdx + 2);
        inBlockComment = false;
      }
      while (true) {
        const startIdx = lineText.indexOf('/*');
        if (startIdx < 0) break;
        const endIdx = lineText.indexOf('*/', startIdx + 2);
        if (endIdx < 0) {
          lineText = lineText.slice(0, startIdx);
          inBlockComment = true;
          break;
        }
        lineText = `${lineText.slice(0, startIdx)} ${lineText.slice(endIdx + 2)}`;
      }
      lineText = lineText.replace(/\/\/.*$/, '');
      lineText = lineText.replace(/"(?:\\.|[^"\\])*"/g, '""');
      lineText = lineText.replace(/'(?:\\.|[^'\\])*'/g, "''");
      const trimmed = lineText.trim();
      if (!trimmed) continue;
      const lineNo = i + 1;

      if (trimmed.startsWith('#')) continue;
      if (/^[{}]+$/.test(trimmed)) continue;
      if (/^(?:else|do)\b/.test(trimmed)) continue;
      if (/^(?:case\b|default\b).*\:\s*$/.test(trimmed)) continue;
      if (/^(?:if|for|while|switch)\s*\(/.test(trimmed)) continue;
      if (/[{}:;,]\s*$/.test(trimmed)) continue;
      if (/\\\s*$/.test(trimmed)) continue;
      if (/^(?:struct|enum|union|typedef)\b.*\{$/.test(trimmed)) continue;

      const nextNonEmpty = (() => {
        for (let j = i + 1; j < lines.length; j += 1) {
          const t = String(lines[j] ?? '').trim();
          if (!t) continue;
          return t;
        }
        return '';
      })();
      if (/\)\s*$/.test(trimmed) && /^\{/.test(nextNonEmpty)) continue;

      pushUniqueDiagnostic(out, {
        line: lineNo,
        col: Math.max(1, raw.length),
        severity: 'warning',
        code: 'c-missing-semicolon',
        message: 'Statement may be missing a semicolon.',
        suggestion: 'Add `;` at the end of the statement (or `{` if this starts a block).'
      }, seen);
    }

    return sortEditorDiagnostics(out);
  }

  function analyzeEditorDiagnosticsForFile(file) {
    if (!file || typeof file !== 'object') return { diagnostics: [], meta: { language: '' } };
    const language = fileDiagnosticsLanguage(file);
    if (!language) return { diagnostics: [], meta: { language: '' } };
    const text = String(file.content || '');
    if (text.length > MAX_EDITOR_DIAGNOSTIC_CHARS) {
      return { diagnostics: [], meta: { language, skipped: true, reason: 'file-too-large' } };
    }
    try {
      if (language === 'html') return { diagnostics: analyzeHtmlDiagnostics(text), meta: { language } };
      if (language === 'css') return { diagnostics: analyzeCssDiagnostics(text), meta: { language } };
      if (language === 'c') return { diagnostics: analyzeCDiagnostics(text), meta: { language } };
      return { diagnostics: [], meta: { language } };
    } catch (error) {
      return {
        diagnostics: [makeEditorDiagnostic({
          line: 1,
          col: 1,
          severity: 'warning',
          code: 'diagnostics-fallback',
          message: `Diagnostics parser failed: ${error?.message || error}`,
          suggestion: 'Continue editing; parser fallback can be improved.'
        })],
        meta: { language }
      };
    }
  }

  function updateFileDiagnostics(file) {
    if (!file || typeof file !== 'object') return;
    const local = analyzeEditorDiagnosticsForFile(file);
    const external = getExternalDiagnosticsForPath(file.path);
    const language = String(local?.meta?.language || fileDiagnosticsLanguage(file) || '');
    let diagnostics = Array.isArray(local?.diagnostics) ? local.diagnostics : [];
    const meta = { ...(local?.meta || {}), language };

    if (external.length) {
      if (language === 'c') {
        diagnostics = external;
      } else {
        const merged = [];
        const seen = new Set();
        for (const diag of [...external, ...diagnostics]) {
          if (!diag || typeof diag !== 'object') continue;
          const normalized = makeEditorDiagnostic(diag);
          const key = `${normalized.severity}|${normalized.line}|${normalized.col}|${normalized.code}|${normalized.message}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(normalized);
        }
        diagnostics = sortEditorDiagnostics(merged);
      }
      meta.externalDiagnostics = external.length;
      meta.source = language === 'c' ? 'extension/compiler' : 'mixed';
    }

    applyFileDiagnostics(file, diagnostics, meta);
  }

  function renderEditorDiagnosticsPanel(file) {
    const host = ensureEditorDiagnosticsHostElement();
    if (!host) return;
    const popup = ensureEditorDiagnosticsPopupState();

    const diagnostics = Array.isArray(file?.diagnostics) ? file.diagnostics : [];
    const summary = file?.diagnosticSummary && typeof file.diagnosticSummary === 'object'
      ? file.diagnosticSummary
      : { total: 0, errors: 0, warnings: 0, skipped: false, reason: '' };
    const show = Boolean(file && popup.open);

    host.classList.toggle('hidden', !show);

    if (!show) {
      host.innerHTML = '';
      host.classList.remove('dragging');
      return;
    }

    const total = Number(summary.total || diagnostics.length) || diagnostics.length;
    const errors = Number(summary.errors || 0);
    const warnings = Number(summary.warnings || 0);
    const summaryBits = [];
    if (errors) summaryBits.push(`${errors} error${errors === 1 ? '' : 's'}`);
    if (warnings) summaryBits.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
    if (!summaryBits.length) summaryBits.push(diagnostics.length ? `${total} issue${total === 1 ? '' : 's'}` : 'No problems');
    const dotClass = errors ? 'error' : (warnings ? 'warning' : 'ok');

    host.innerHTML = `
      <div class="editor-diagnostics-head">
        <div class="editor-diagnostics-head-right" data-editor-diag-drag-handle="1">
          <div class="editor-diagnostics-title">
            <span class="dot ${dotClass}"></span>
            <span>Problems</span>
          </div>
          <div class="editor-diagnostics-summary">${escapeHtml(summaryBits.join(' • '))}</div>
        </div>
        <div class="editor-diagnostics-head-right">
          <div class="editor-diagnostics-summary">Alt+P</div>
          <button type="button" class="editor-diagnostics-close" data-editor-diag-action="close" aria-label="Close problems panel" title="Close (Alt+P)">×</button>
        </div>
      </div>
      <div class="editor-diagnostics-list">
        ${diagnostics.length ? diagnostics.map((diag, index) => `
          <button type="button" class="editor-diagnostics-item" data-editor-diag-index="${escapeHtml(String(index))}">
            <div class="editor-diagnostics-row">
              <span class="editor-diagnostics-sev ${escapeHtml(diag.severity)}">${escapeHtml(diag.severity)}</span>
              <span class="editor-diagnostics-loc">Ln ${escapeHtml(String(diag.line))}, Col ${escapeHtml(String(diag.col))}</span>
              ${diag.code ? `<span class="editor-diagnostics-loc">${escapeHtml(diag.code)}</span>` : ''}
            </div>
            <div class="editor-diagnostics-msg">${escapeHtml(diag.message)}</div>
            ${diag.suggestion ? `<div class="editor-diagnostics-fix">Quick Fix: ${escapeHtml(diag.suggestion)}</div>` : ''}
          </button>
        `).join('') : `<div class="editor-diagnostics-empty">No problems detected in this file.</div>`}
      </div>
    `;
    positionEditorDiagnosticsPopup(host);
  }

  function focusEditorDiagnosticByIndex(index) {
    const file = state.activePath ? state.files.get(state.activePath) : null;
    if (!file || !Array.isArray(file.diagnostics)) return;
    const diag = file.diagnostics[Math.max(0, Math.floor(Number(index) || 0))];
    if (!diag) return;
    const textarea = els['code-input'];
    if (textarea) {
      const lineStart = offsetFromLine(file.content, diag.line);
      const nextLineStart = offsetFromLine(file.content, diag.line + 1);
      const lineEndExclusive = Math.max(lineStart, nextLineStart - 1);
      const caret = clamp(lineStart + Math.max(0, (Number(diag.col) || 1) - 1), lineStart, lineEndExclusive);
      textarea.selectionStart = caret;
      textarea.selectionEnd = caret;
      file.selectionStart = caret;
      file.selectionEnd = caret;
      const lineHeight = 18;
      const targetTop = Math.max(0, (Math.max(1, diag.line) - 3) * lineHeight);
      textarea.scrollTop = targetTop;
      syncEditorScroll();
      updateCursorStatus();
      try { textarea.focus({ preventScroll: true }); } catch (_) { textarea.focus(); }
    }
  }

  function renderCodeHighlight() {
    const file = state.activePath ? state.files.get(state.activePath) : null;
    if (!file || !els['code-highlight']) return;
    let html = highlightCode(file.content, file.language);
    if (html.length === 0) html = '&nbsp;';
    if (file.content.endsWith('\n')) html += '\n';
    els['code-highlight'].innerHTML = html;
  }

  function renderLineNumbers() {
    const file = state.activePath ? state.files.get(state.activePath) : null;
    if (!els['line-numbers']) return;
    const totalLines = countLines(file?.content || '');
    const highlight = file?.lastAiLineRange && file.lastAiLineRange.expiresAt > Date.now() ? file.lastAiLineRange : null;
    const diagIndex = file?.diagnosticLineIndex && typeof file.diagnosticLineIndex === 'object'
      ? file.diagnosticLineIndex
      : null;
    const parts = [];
    for (let i = 1; i <= totalLines; i += 1) {
      const changed = highlight && i >= highlight.startLine && i <= highlight.endLine;
      const diag = diagIndex ? diagIndex[String(i)] : null;
      const diagClass = diag ? ` diag-${diag.severity === 'error' ? 'error' : 'warning'}` : '';
      const diagAttr = diag ? ` data-diag-index="${escapeHtml(String(diag.index))}"` : '';
      const titleAttr = diag?.message ? ` title="${escapeHtml(diag.message)}"` : '';
      parts.push(`<div class="line${changed ? ' changed' : ''}${diagClass}"${diagAttr}${titleAttr}>${i}</div>`);
    }
    els['line-numbers'].innerHTML = parts.join('');
    els['line-numbers'].scrollTop = els['code-input']?.scrollTop || 0;
  }

  function syncEditorScroll() {
    if (!els['code-input']) return;
    if (els['code-highlight']) {
      els['code-highlight'].scrollTop = els['code-input'].scrollTop;
      els['code-highlight'].scrollLeft = els['code-input'].scrollLeft;
    }
    if (els['line-numbers']) {
      els['line-numbers'].scrollTop = els['code-input'].scrollTop;
    }
  }

  function onCodeInput() {
    const file = state.activePath ? state.files.get(state.activePath) : null;
    if (!file || !els['code-input']) return;
    file.content = els['code-input'].value;
    file.dirty = file.content !== file.savedContent;
    file.selectionStart = els['code-input'].selectionStart;
    file.selectionEnd = els['code-input'].selectionEnd;
    updateFileDiagnostics(file);
    renderCodeHighlight();
    renderLineNumbers();
    renderEditorDiagnosticsPanel(file);
    renderTabs();
    updateCursorStatus();
    scheduleExtensionDocumentChangeEvent();
    scheduleSessionSave();
  }

  function handleEditorKeydown(event) {
    if (!els['code-input']) return;

    if (event.key === 'Tab') {
      event.preventDefault();
      insertTextAtSelection('  ');
      return;
    }

    if (event.key === 'Enter') {
      const textarea = els['code-input'];
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = textarea.value.slice(0, start);
      const lineStart = before.lastIndexOf('\n') + 1;
      const currentLine = before.slice(lineStart);
      const indentMatch = currentLine.match(/^[\t ]+/);
      const indent = indentMatch ? indentMatch[0] : '';
      event.preventDefault();
      insertTextAtSelection(`\n${indent}`);
      textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length;
      onCodeInput();
      return;
    }
  }

  function insertTextAtSelection(text) {
    const textarea = els['code-input'];
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(text, start, end, 'end');
    onCodeInput();
  }

  function executeEditorCommand(command) {
    const textarea = els['code-input'];
    if (!textarea || !state.activePath) return;
    textarea.focus();
    try {
      document.execCommand(command);
      queueMicrotask(() => onCodeInput());
    } catch (_) {
      showToast(`${command === 'undo' ? 'Undo' : 'Redo'} is not available`, 'warn');
    }
  }

  function updateCursorStatus() {
    if (!els['status-cursor']) return;
    const textarea = els['code-input'];
    const file = state.activePath ? state.files.get(state.activePath) : null;
    if (!textarea || !file) {
      els['status-cursor'].textContent = 'Ln 1, Col 1';
      return;
    }
    file.selectionStart = textarea.selectionStart;
    file.selectionEnd = textarea.selectionEnd;
    const { line, col } = lineColFromOffset(file.content, textarea.selectionStart);
    els['status-cursor'].textContent = `Ln ${line}, Col ${col}`;
  }

  async function openFolderViaDialog() {
    if (!api.files?.selectFolder) {
      showToast('Folder picker API unavailable', 'error');
      return;
    }
    const folder = await api.files.selectFolder();
    if (!folder) return;
    await loadProject(folder);
    showToast('Project folder opened', 'success');
  }

  async function loadProject(folderPath) {
    state.projectRoot = normalizePath(folderPath);
    state.expandedDirs.clear();
    if (state.projectRoot) state.expandedDirs.add(state.projectRoot);
    resetSearchPanelResults({ preserveQuery: true });
    resetSourceControlState({ preserveDrafts: true, preserveGitInfo: false });
    if (state.projectRoot) {
      try { await api.files?.allowPath?.(state.projectRoot, 'dir'); } catch (_) {}
    }
    if (state.selectedPath && !isSameOrSubPath(state.selectedPath, state.projectRoot)) state.selectedPath = state.projectRoot;
    renderProjectPill();
    await refreshTree();
    void refreshSourceControlState({ silent: true });
    notifyExtensionsEditorEvent('workspaceLoaded', {
      projectRoot: state.projectRoot || '',
      selectedPath: state.selectedPath || ''
    });
    renderSearchPanelIfVisible();
    scheduleSessionSave();
  }

  async function refreshTree() {
    if (!state.projectRoot) {
      state.treeChildren = [];
      renderTree();
      return;
    }
    setMainStatus('Loading project tree...');
    try {
      state.treeChildren = await readDirectoryChildren(state.projectRoot, 0);
      renderTree();
      setMainStatus('Ready');
    } catch (error) {
      console.error('[Coder] Failed to refresh tree:', error);
      showToast(`Explorer refresh failed: ${error.message || error}`, 'error');
      setMainStatus('Explorer refresh failed');
    }
  }

  async function readDirectoryChildren(dirPath, depth) {
    const names = await api.files?.readDir?.(dirPath);
    const out = [];
    const entries = Array.isArray(names) ? names : [];

    for (const name of entries) {
      if (!name || name === '.' || name === '..') continue;
      if (depth > 0 && TREE_IGNORED_DIRS.has(String(name))) continue;
      const fullPath = joinPath(dirPath, name);
      const stat = await api.files?.stat?.(fullPath);
      if (!stat?.exists) continue;
      const type = stat.isDirectory ? 'dir' : 'file';
      const node = { name: String(name), path: normalizePath(fullPath), type, children: null };
      if (type === 'dir' && state.expandedDirs.has(node.path)) {
        node.children = await readDirectoryChildren(node.path, depth + 1);
      }
      out.push(node);
    }

    out.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return out;
  }

  async function openFileViaDialog() {
    if (!api.files?.selectFile) {
      showToast('File picker API unavailable', 'error');
      return;
    }
    const filePath = await api.files.selectFile([
      { name: 'Code Files', extensions: ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'md', 'txt', 'c', 'h'] },
      { name: 'All Files', extensions: ['*'] }
    ]);
    if (!filePath) return;
    await openFile(filePath);
  }

  async function openFile(filePath, options = {}) {
    const normalized = normalizePath(filePath);
    if (!normalized) return false;

    if (state.files.has(normalized)) {
      activateTab(normalized);
      return true;
    }

    let content = options.content;
    if (typeof content !== 'string') {
      try { await api.files?.allowPath?.(normalized, 'file'); } catch (_) {}
      content = await api.files?.read?.(normalized);
    }

    if (typeof content !== 'string') {
      if (!options.silent) showToast(`Unable to open file: ${basenamePath(normalized)}`, 'error');
      return false;
    }

    const file = {
      path: normalized,
      content,
      savedContent: typeof options.savedContent === 'string' ? options.savedContent : content,
      dirty: Boolean(options.dirty),
      language: detectLanguage(normalized),
      revisions: [],
      selectionStart: 0,
      selectionEnd: 0,
      lastAiLineRange: null
    };
    state.files.set(normalized, file);
    if (!state.tabs.includes(normalized)) state.tabs.push(normalized);

    if (options.activate !== false) {
      activateTab(normalized);
    } else {
      renderTabs();
      renderEditorShell();
    }

    if (!options.silent) {
      state.selectedPath = normalized;
      updateTreeSelectionVisual();
      showToast(`Opened ${basenamePath(normalized)}`, 'success');
    }
    notifyExtensionsEditorEvent('fileOpened', {
      path: normalized,
      language: file.language,
      projectRoot: state.projectRoot || '',
      content: file.content
    });
    scheduleSessionSave();
    return true;
  }

  function activateTab(filePath) {
    const normalized = normalizePath(filePath);
    if (!state.files.has(normalized)) return;
    if (state.activePath && state.files.has(state.activePath) && els['code-input']) {
      const prev = state.files.get(state.activePath);
      prev.selectionStart = els['code-input'].selectionStart;
      prev.selectionEnd = els['code-input'].selectionEnd;
    }
    state.activePath = normalized;
    state.activeExtensionWebviewPanelId = '';
    if (state.extensionDetailView) state.extensionDetailView.active = false;
    state.selectedPath = normalized;
    renderTabs();
    renderEditorShell();
    updateTreeSelectionVisual();
    els['code-input']?.focus();
    const file = state.files.get(normalized);
    notifyExtensionsEditorEvent('activeEditorChanged', {
      path: normalized,
      language: file?.language || detectLanguage(normalized),
      projectRoot: state.projectRoot || ''
    });
    scheduleSessionSave();
  }

  async function closeTab(filePath) {
    const normalized = normalizePath(filePath);
    const file = state.files.get(normalized);
    if (!file) return;
    if (file.dirty && !window.confirm(`Close ${basenamePath(normalized)} without saving?`)) return;

    const index = state.tabs.indexOf(normalized);
    if (index >= 0) state.tabs.splice(index, 1);
    state.files.delete(normalized);

    if (state.activePath === normalized) {
      const next = state.tabs[index] || state.tabs[index - 1] || '';
      state.activePath = next;
    }

    renderTabs();
    renderEditorShell();
    notifyExtensionsEditorEvent('activeEditorChanged', {
      path: state.activePath || '',
      language: state.activePath ? (state.files.get(state.activePath)?.language || detectLanguage(state.activePath)) : 'plaintext',
      projectRoot: state.projectRoot || ''
    });
    scheduleSessionSave();
  }

  async function saveActiveFile() {
    if (!state.activePath) return false;
    return saveFile(state.activePath, { reason: 'manual-save' });
  }

  async function saveAllFiles() {
    const dirtyPaths = state.tabs.filter((p) => state.files.get(p)?.dirty);
    if (dirtyPaths.length === 0) {
      showToast('No unsaved files', 'warn');
      return true;
    }
    let successCount = 0;
    for (const filePath of dirtyPaths) {
      const ok = await saveFile(filePath, { reason: 'save-all' });
      if (ok) successCount += 1;
    }
    showToast(`Saved ${successCount}/${dirtyPaths.length} file(s)`, successCount === dirtyPaths.length ? 'success' : 'warn');
    return successCount === dirtyPaths.length;
  }

  async function saveFile(filePath, meta = {}) {
    const normalized = normalizePath(filePath);
    const file = state.files.get(normalized);
    if (!file) return false;

    const writer = api.files?.write || ((path, content) => api.files?.createFile?.(path, content));
    if (!writer) {
      showToast('Write API unavailable', 'error');
      return false;
    }

    const changed = file.content !== file.savedContent;
    const before = file.savedContent;
    const ok = await writer(normalized, file.content);
    if (!ok) {
      showToast(`Save failed: ${basenamePath(normalized)}`, 'error');
      setMainStatus('Save failed');
      return false;
    }

    if (changed) {
      recordRevision(file, {
        reason: meta.reason || 'save',
        beforeContent: before,
        afterContent: file.content
      });
    }

    file.savedContent = file.content;
    file.dirty = false;
    renderTabs();
    renderEditorShell();
    setMainStatus(`Saved ${basenamePath(normalized)}`);
    notifyExtensionsEditorEvent('fileSaved', {
      path: normalized,
      language: file.language,
      projectRoot: state.projectRoot || '',
      content: file.content
    });
    scheduleSessionSave();
    return true;
  }

  function recordRevision(file, revision) {
    if (!file) return;
    file.revisions.push({
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      reason: revision.reason || 'edit',
      beforeContent: String(revision.beforeContent ?? ''),
      afterContent: String(revision.afterContent ?? '')
    });
    if (file.revisions.length > MAX_REVISIONS_PER_FILE) {
      file.revisions.splice(0, file.revisions.length - MAX_REVISIONS_PER_FILE);
    }
  }

  async function createFileFromExplorer() {
    const baseDir = await resolveCreateBaseDirectory();
    if (!baseDir) {
      showToast('Open a folder first to create files', 'warn');
      return;
    }
    const input = await promptExplorerInput({
      title: 'Create File',
      message: 'New file path (relative or absolute):',
      value: '',
      confirmLabel: 'Create'
    });
    if (!input) return;
    const filePath = resolveWorkspacePath(input, { baseDir });
    if (!filePath) return;
    if (!isPathAllowed(filePath)) {
      showToast('Path is outside the current project scope', 'error');
      return;
    }
    const exists = await api.files?.stat?.(filePath);
    if (exists?.exists) {
      showToast('A file or folder already exists at that path', 'warn');
      return;
    }
    const ok = await api.files?.createFile?.(filePath, '');
    if (!ok) {
      showToast('Failed to create file', 'error');
      return;
    }
    await refreshTree();
    await openFile(filePath);
    addAiLog(`Manual createFile ${toProjectRelative(filePath) || filePath}`, 'info');
  }

  async function createFolderFromExplorer() {
    const baseDir = await resolveCreateBaseDirectory();
    if (!baseDir) {
      showToast('Open a folder first to create folders', 'warn');
      return;
    }
    const input = await promptExplorerInput({
      title: 'Create Folder',
      message: 'New folder path (relative or absolute):',
      value: '',
      confirmLabel: 'Create'
    });
    if (!input) return;
    const dirPath = resolveWorkspacePath(input, { baseDir });
    if (!dirPath) return;
    if (!isPathAllowed(dirPath)) {
      showToast('Path is outside the current project scope', 'error');
      return;
    }
    const ok = await api.files?.createFolder?.(dirPath);
    if (!ok) {
      showToast('Failed to create folder', 'error');
      return;
    }
    state.expandedDirs.add(dirPath);
    state.selectedPath = dirPath;
    await refreshTree();
    addAiLog(`Manual createFolder ${toProjectRelative(dirPath) || dirPath}`, 'info');
  }

  async function renameSelectedPath() {
    const target = normalizePath(state.selectedPath || state.activePath || '');
    if (!target) {
      showToast('Select a file or folder to rename', 'warn');
      return;
    }
    const currentDisplay = toProjectRelative(target) || target;
    const input = await promptExplorerInput({
      title: 'Rename Path',
      message: `Rename path:\n${currentDisplay}`,
      value: currentDisplay,
      confirmLabel: 'Rename'
    });
    if (!input) return;
    const nextPath = resolveWorkspacePath(input, { baseDir: state.projectRoot || dirnamePath(target) });
    if (!nextPath || normalizePath(nextPath) === target) return;
    if (!isPathAllowed(nextPath)) {
      showToast('Target path is outside the current project scope', 'error');
      return;
    }
    const ok = await api.files?.renamePath?.(target, nextPath);
    if (!ok) {
      showToast('Rename failed', 'error');
      return;
    }
    updateStatePathsAfterRename(target, nextPath);
    if (state.projectRoot && normalizePath(state.projectRoot) === target) {
      state.projectRoot = normalizePath(nextPath);
    }
    await refreshTree();
    renderProjectPill();
    renderTabs();
    renderEditorShell();
    notifyExtensionsEditorEvent('workspaceScopeChanged', {
      oldPath: target,
      newPath: nextPath,
      projectRoot: state.projectRoot || ''
    });
    addAiLog(`Manual rename ${currentDisplay} -> ${toProjectRelative(nextPath) || nextPath}`, 'info');
    showToast('Renamed', 'success');
  }

  async function deleteSelectedPath() {
    const target = normalizePath(state.selectedPath || state.activePath || '');
    if (!target) {
      showToast('Select a file or folder to delete', 'warn');
      return;
    }
    const label = toProjectRelative(target) || target;
    const confirmed = await confirmExplorerAction({
      title: 'Delete Path',
      message: `Delete "${label}"?\nThis cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) return;

    const ok = await api.files?.deletePath?.(target);
    if (!ok) {
      showToast('Delete failed', 'error');
      return;
    }
    removeStatePathsAfterDelete(target);
    if (state.projectRoot && normalizePath(state.projectRoot) === target) {
      state.projectRoot = '';
      state.expandedDirs.clear();
      state.treeChildren = [];
      state.selectedPath = '';
      resetSourceControlState({ preserveDrafts: true, preserveGitInfo: false });
    }
    await refreshTree();
    renderProjectPill();
    renderTabs();
    renderEditorShell();
    notifyExtensionsEditorEvent('workspaceLoaded', {
      projectRoot: state.projectRoot || '',
      selectedPath: state.selectedPath || ''
    });
    addAiLog(`Manual delete ${label}`, 'info');
    showToast('Deleted', 'success');
  }

  async function resolveCreateBaseDirectory() {
    const selected = normalizePath(state.selectedPath || '');
    if (selected) {
      const stat = await api.files?.stat?.(selected);
      if (stat?.exists) {
        if (stat.isDirectory) return selected;
        return dirnamePath(selected);
      }
    }
    if (state.projectRoot) return state.projectRoot;
    if (state.activePath) return dirnamePath(state.activePath);
    return '';
  }

  async function runActiveFile(options = {}) {
    const requestedPath = String(options?.path || '').trim();
    const targetPath = requestedPath || state.activePath;
    if (!targetPath) {
      showToast('Open a file to run', 'warn');
      return false;
    }
    const file = state.files.get(targetPath);
    if (!file) return false;
    const ext = extensionOf(file.path).toLowerCase();
    const isCSourceFile = ext === 'c';
    const isCppSourceFile = ['cpp', 'cc', 'cxx', 'c++'].includes(ext);
    const isCHeaderFile = ext === 'h';
    const isCppHeaderFile = ['hpp', 'hh', 'hxx'].includes(ext);

    if (ext === 'html' || ext === 'htm') {
      const result = await api.preview?.openHtml?.({
        content: file.content,
        baseDir: dirnamePath(file.path),
        title: `${basenamePath(file.path)} - Preview`
      });
      if (result?.success === false) {
        showToast(`Preview failed: ${result.error || 'unknown error'}`, 'error');
        return false;
      }
      setMainStatus(`Previewing ${basenamePath(file.path)}`);
      showToast('HTML preview opened (sandboxed)', 'success');
      return true;
    }

    if (isCHeaderFile || isCppHeaderFile) {
      showToast(isCppHeaderFile ? 'Open a .cpp/.cc/.cxx source file to compile and run' : 'Open a .c source file to compile and run', 'warn');
      setMainStatus('Header files are not directly runnable');
      return false;
    }

    if (isCSourceFile || isCppSourceFile) {
      const isCppRun = isCppSourceFile;
      const languageLabel = isCppRun ? 'C++' : 'C';
      const compileAndRun = isCppRun ? api.run?.compileAndRunCpp : api.run?.compileAndRunC;
      if (!compileAndRun) {
        showToast(`${languageLabel} run API unavailable in Coder`, 'error');
        setMainStatus(`${languageLabel} run unavailable`);
        return false;
      }

      const coderSettings = getEffectiveCoderSettingsForRun();
      const compilerProfileForRun = isCppRun ? coderSettings.cppCompilerProfile : coderSettings.cCompilerProfile;
      const customCompilerCommandForRun = isCppRun ? coderSettings.cppCompilerCustomCommand : coderSettings.cCompilerCustomCommand;
      const extraCompilerArgsForRun = isCppRun ? coderSettings.cppCompilerExtraArgs : coderSettings.cCompilerExtraArgs;
      if (compilerProfileForRun === 'custom' && !customCompilerCommandForRun) {
        showToast(`Set a custom ${languageLabel} compiler command in Coder Settings first`, 'warn');
        openCoderSettingsPanel();
        return false;
      }

      const rp = ensureRunPanelState();
      if (file.dirty && rp.autoSaveBeforeRun !== false) {
        const saved = await saveActiveFile();
        if (!saved) {
          showToast(`Save failed. ${languageLabel} run canceled.`, 'error');
          setMainStatus(`${languageLabel} run canceled`);
          return false;
        }
      } else if (file.dirty) {
        showToast(`Save the file before running ${languageLabel} code (or enable Auto Save Before Run)`, 'warn');
        setMainStatus(`${languageLabel} run requires saved file`);
        return false;
      }

      const result = await compileAndRun({
        path: file.path,
        compilerProfile: compilerProfileForRun,
        customCompilerCommand: customCompilerCommandForRun,
        extraCompilerArgs: extraCompilerArgsForRun,
        stdinText: String(options?.cStdinText ?? '')
      });

      const compilerDiagnostics = Array.isArray(result?.diagnostics) && result.diagnostics.length
        ? result.diagnostics
        : parseCRunCompilerOutputDiagnostics(String(result?.output || result?.compileOutput || ''), file.path);
      const awaitingMoreInput = isCppRun && isInbuiltCppAwaitingMoreInput(result, compilerDiagnostics);
      const effectiveDiagnostics = awaitingMoreInput ? [] : compilerDiagnostics;
      openCoderCRunResultPanel(file.path, result, compilerDiagnostics, {
        stdinText: String(options?.cStdinDisplayText ?? options?.cStdinText ?? ''),
        stdinSessionText: String(options?.cStdinText ?? ''),
        awaitingInteractiveInput: awaitingMoreInput,
        languageLabel
      });
      setCompilerDiagnosticsForPath(file.path, effectiveDiagnostics);
      const currentFile = state.files.get(file.path);
      if (currentFile) {
        updateFileDiagnostics(currentFile);
        if (state.activePath === file.path) {
          renderCodeHighlight();
          renderLineNumbers();
          renderEditorDiagnosticsPanel(currentFile);
          updateCursorStatus();
        }
      }

      if (!result?.success) {
        if (awaitingMoreInput) {
          setMainStatus(`${languageLabel} program is waiting for more input`);
          markRunPanelLastAction(`Awaiting additional stdin input for ${basenamePath(file.path)} (${String(result?.compiler || 'inbuilt')})`, 'info');
          if (state.sidePanelMode === 'run') renderSidePanelMode();
          return true;
        }
        const phase = String(result?.phase || 'run');
        const msg = String(result?.error || `${phase} failed`).trim() || `${phase} failed`;
        const compilerName = String(result?.compiler || '').trim();
        showToast(`${phase === 'compile' ? 'Compile' : 'Run'} failed${compilerName ? ` (${compilerName})` : ''}: ${msg}`, 'error');
        setMainStatus(`${languageLabel} ${phase === 'compile' ? 'compile' : 'run'} failed: ${basenamePath(file.path)}`);
        markRunPanelLastAction(`${languageLabel} ${phase === 'compile' ? 'compile' : 'run'} failed for ${basenamePath(file.path)}${compilerName ? ` (${compilerName})` : ''}`, 'error');
        if (phase === 'compile' && compilerDiagnostics.length) {
          const popup = ensureEditorDiagnosticsPopupState();
          popup.open = true;
          renderEditorDiagnosticsPanel(currentFile || file);
        }
        if (state.sidePanelMode === 'run') renderSidePanelMode();
        return false;
      }

      const compilerName = String(result.compiler || 'compiler').trim() || 'compiler';
      const outputText = String(result.output || '').trim();
      const outputFirstLine = outputText ? String(outputText.split(/\r?\n/).find((line) => String(line || '').trim()) || '').trim() : '';
      if (outputFirstLine) {
        showToast(`${languageLabel} program finished (${compilerName}): ${truncateText(outputFirstLine, 96)}`, 'success');
      } else {
        showToast(`${languageLabel} program finished (${compilerName})`, 'success');
      }
      setMainStatus(`Ran ${basenamePath(file.path)} with ${compilerName}`);
      markRunPanelLastAction(`Ran ${basenamePath(file.path)} with ${compilerName}${outputFirstLine ? ` | ${truncateText(outputFirstLine, 72)}` : ''}`, 'success');
      if (state.sidePanelMode === 'run') renderSidePanelMode();
      return true;
    }

    showToast('Play currently supports HTML preview and C/C++ compile/run (configure compiler in Coder Settings).', 'warn');
    return false;
  }

  function toggleAiSidebar(force) {
    if (!AI_CHAT_ENABLED) {
      state.aiOpen = false;
      state.aiSettingsOpen = false;
      renderAiSidebar();
      return;
    }
    state.aiOpen = typeof force === 'boolean' ? force : !state.aiOpen;
    if (!state.aiOpen) state.aiSettingsOpen = false;
    renderAiSidebar();
    scheduleSessionSave();
  }

  function toggleExplorerPane(force) {
    if (state.sidePanelMode !== 'explorer' && force !== false) {
      state.sidePanelMode = 'explorer';
      state.explorerOpen = true;
      renderSidePanelMode();
      renderWorkspaceLayout();
      scheduleSessionSave();
      return;
    }
    if (state.aiOpen && force !== false) {
      state.aiOpen = false;
      state.aiSettingsOpen = false;
      state.explorerOpen = typeof force === 'boolean' ? force : true;
      renderAiSidebar();
      scheduleSessionSave();
      return;
    }
    state.explorerOpen = typeof force === 'boolean' ? force : !state.explorerOpen;
    renderSidePanelMode();
    renderWorkspaceLayout();
    scheduleSessionSave();
  }

  function renderWorkspaceLayout() {
    const aiOpen = Boolean(state.aiOpen);
    const explorerOpen = state.explorerOpen !== false;
    const workspaceEl = els['workspace'];
    if (workspaceEl) {
      const railWidth = Math.round(document.querySelector('.activity-rail')?.getBoundingClientRect?.().width || 46);
      const workspaceWidth = Math.round(workspaceEl.getBoundingClientRect().width || window.innerWidth || 0);
      const sideMode = state.sidePanelMode || 'explorer';
      const sidePreferredFallback = DEFAULT_SIDE_PANEL_WIDTHS[sideMode] || DEFAULT_SIDE_PANEL_WIDTHS.explorer;
      const sidePreferredStored = Number(state.sidePanelWidths?.[sideMode]);
      const sidePreferred = Number.isFinite(sidePreferredStored) && sidePreferredStored > 0
        ? sidePreferredStored
        : sidePreferredFallback;
      const sideMin = 210;
      const sideMax = Math.max(sideMin, workspaceWidth - railWidth - 220);
      const sideClamped = clamp(sidePreferred, sideMin, sideMax);
      if (!state.sidePanelWidths || typeof state.sidePanelWidths !== 'object') {
        state.sidePanelWidths = { ...DEFAULT_SIDE_PANEL_WIDTHS };
      }
      state.sidePanelWidths[sideMode] = sideClamped;
      workspaceEl.style.setProperty('--coder-side-width', `${sideClamped}px`);

      const minWidth = 320;
      const maxWidth = Math.max(minWidth, workspaceWidth - railWidth - 260);
      const preferred = Number.isFinite(Number(state.aiSidebarWidth)) ? Number(state.aiSidebarWidth) : 480;
      const clampedWidth = clamp(preferred, minWidth, maxWidth);
      state.aiSidebarWidth = clampedWidth;
      workspaceEl.style.setProperty('--ai-left-width', `${clampedWidth}px`);
    }
    workspaceEl?.classList.toggle('ai-open', aiOpen);
    workspaceEl?.classList.toggle('explorer-collapsed', !aiOpen && !explorerOpen);
    document.body.classList.toggle('side-resizing', Boolean(state.sideResize));
    document.body.classList.toggle('ai-resizing', Boolean(state.aiResize));
    if (ensureEditorDiagnosticsPopupState().open) {
      positionEditorDiagnosticsPopup();
    }
    renderRailButtons();
  }

  function isCoderSettingsPanelOpen() {
    return Boolean(state.coderSettingsOpen);
  }

  function renderCoderSettingsPanel() {
    const panel = els['coder-settings-panel'];
    if (!panel) return;
    const open = Boolean(state.coderSettingsOpen);
    panel.classList.toggle('hidden', !open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    renderDetectedCCompilerUi();
    renderDetectedCppCompilerUi();
    const cProfile = normalizeCoderCompilerProfile(repopulateCCompilerSelect(els['coder-settings-c-compiler']?.value || getCoderSettings().cCompilerProfile));
    const cppProfile = normalizeCoderCppCompilerProfile(repopulateCppCompilerSelect(els['coder-settings-cpp-compiler']?.value || getCoderSettings().cppCompilerProfile));
    els['coder-settings-c-custom-wrap']?.classList.toggle('hidden', cProfile !== 'custom');
    els['coder-settings-cpp-custom-wrap']?.classList.toggle('hidden', cppProfile !== 'custom');
  }

  function loadCoderSettingsPanel() {
    const settings = getCoderSettings();
    repopulateCCompilerSelect(settings.cCompilerProfile);
    repopulateCppCompilerSelect(settings.cppCompilerProfile);
    if (els['coder-settings-c-custom-command']) els['coder-settings-c-custom-command'].value = settings.cCompilerCustomCommand || '';
    if (els['coder-settings-c-custom-args']) els['coder-settings-c-custom-args'].value = settings.cCompilerExtraArgs || '';
    if (els['coder-settings-cpp-custom-command']) els['coder-settings-cpp-custom-command'].value = settings.cppCompilerCustomCommand || '';
    if (els['coder-settings-cpp-custom-args']) els['coder-settings-cpp-custom-args'].value = settings.cppCompilerExtraArgs || '';
    renderCoderSettingsPanel();
  }

  function toggleCoderSettingsPanel(force) {
    state.coderSettingsOpen = typeof force === 'boolean' ? force : !state.coderSettingsOpen;
    renderCoderSettingsPanel();
    renderRailButtons();
  }

  async function openCoderSettingsPanel() {
    loadCoderSettingsPanel();
    toggleCoderSettingsPanel(true);
    setMainStatus('Coder settings');
    await Promise.allSettled([
      refreshDetectedCCompilers({ force: true }),
      refreshDetectedCppCompilers({ force: true })
    ]);
  }

  function saveCoderSettingsPanel() {
    const selectedCProfile = normalizeCoderCompilerProfile(els['coder-settings-c-compiler']?.value || 'inbuilt');
    const selectedCppProfile = normalizeCoderCppCompilerProfile(els['coder-settings-cpp-compiler']?.value || 'inbuilt');
    const availableCProfiles = new Set(getAvailableCCompilerProfilesForSettings().map((x) => x.id));
    const availableCppProfiles = new Set(getAvailableCppCompilerProfilesForSettings().map((x) => x.id));
    const effectiveCProfile = availableCProfiles.has(selectedCProfile) ? selectedCProfile : 'inbuilt';
    const effectiveCppProfile = availableCppProfiles.has(selectedCppProfile) ? selectedCppProfile : 'inbuilt';
    const next = normalizeCoderSettings({
      cCompilerProfile: effectiveCProfile,
      cCompilerCustomCommand: els['coder-settings-c-custom-command']?.value || '',
      cCompilerExtraArgs: els['coder-settings-c-custom-args']?.value || '',
      cppCompilerProfile: effectiveCppProfile,
      cppCompilerCustomCommand: els['coder-settings-cpp-custom-command']?.value || '',
      cppCompilerExtraArgs: els['coder-settings-cpp-custom-args']?.value || ''
    });

    if (next.cCompilerProfile === 'custom' && !next.cCompilerCustomCommand) {
      showToast('Enter a custom C compiler command or choose another backend', 'warn');
      els['coder-settings-c-custom-command']?.focus();
      return false;
    }
    if (next.cppCompilerProfile === 'custom' && !next.cppCompilerCustomCommand) {
      showToast('Enter a custom C++ compiler command or choose another backend', 'warn');
      els['coder-settings-cpp-custom-command']?.focus();
      return false;
    }

    state.coderSettings = next;
    scheduleSessionSave();
    toggleCoderSettingsPanel(false);
    showToast(`Coder settings saved (C: ${next.cCompilerProfile}, C++: ${next.cppCompilerProfile})`, 'success');
    setMainStatus(`Compiler backends updated (C: ${next.cCompilerProfile}, C++: ${next.cppCompilerProfile})`);
    return true;
  }

  function getCoderTerminalState() {
    if (!state.coderTerminal || typeof state.coderTerminal !== 'object') {
      state.coderTerminal = {
        open: false,
        cwd: '',
        input: '',
        lines: [],
        partialLine: null,
        busy: false,
        sessionId: '',
        history: [],
        historyIndex: -1,
        requestSeq: 0,
        panelHeight: 300,
        activeTab: 'terminal'
      };
    }
    if (!Array.isArray(state.coderTerminal.lines)) state.coderTerminal.lines = [];
    if (!state.coderTerminal.partialLine || typeof state.coderTerminal.partialLine !== 'object') {
      state.coderTerminal.partialLine = null;
    } else {
      const p = state.coderTerminal.partialLine;
      const kind = String(p.kind || 'stdout').replace(/[^a-z0-9_-]/gi, '') || 'stdout';
      const text = String(p.text ?? '');
      state.coderTerminal.partialLine = { kind, text };
    }
    state.coderTerminal.sessionId = String(state.coderTerminal.sessionId || '');
    if (!Array.isArray(state.coderTerminal.history)) state.coderTerminal.history = [];
    state.coderTerminal.panelHeight = Number(state.coderTerminal.panelHeight) || 300;
    state.coderTerminal.activeTab = String(state.coderTerminal.activeTab || 'terminal') === 'output' ? 'output' : 'terminal';
    return state.coderTerminal;
  }

  function getCoderRunResultPanelState() {
    if (!state.coderRunResultPanel || typeof state.coderRunResultPanel !== 'object') {
      state.coderRunResultPanel = {
        open: false,
        title: '',
        meta: '',
      sections: [],
      outputText: '',
      fullOutputText: '',
      outputKind: 'stdout',
      inputText: '',
      stdinSessionText: '',
      awaitingInteractiveInput: false,
      busy: false,
        filePath: '',
        requestSeq: 0,
        lastRunMeta: ''
      };
    }
    if (!Array.isArray(state.coderRunResultPanel.sections)) state.coderRunResultPanel.sections = [];
    if (typeof state.coderRunResultPanel.outputText !== 'string') state.coderRunResultPanel.outputText = '';
    if (typeof state.coderRunResultPanel.fullOutputText !== 'string') state.coderRunResultPanel.fullOutputText = '';
    if (typeof state.coderRunResultPanel.outputKind !== 'string') state.coderRunResultPanel.outputKind = 'stdout';
    if (typeof state.coderRunResultPanel.inputText !== 'string') state.coderRunResultPanel.inputText = '';
    if (typeof state.coderRunResultPanel.stdinSessionText !== 'string') state.coderRunResultPanel.stdinSessionText = '';
    state.coderRunResultPanel.awaitingInteractiveInput = state.coderRunResultPanel.awaitingInteractiveInput === true;
    if (typeof state.coderRunResultPanel.filePath !== 'string') state.coderRunResultPanel.filePath = '';
    if (typeof state.coderRunResultPanel.lastRunMeta !== 'string') state.coderRunResultPanel.lastRunMeta = '';
    state.coderRunResultPanel.busy = state.coderRunResultPanel.busy === true;
    state.coderRunResultPanel.requestSeq = Number(state.coderRunResultPanel.requestSeq) || 0;
    return state.coderRunResultPanel;
  }

  function isCoderTerminalPanelOpen() {
    return Boolean(els['coder-terminal-panel'] && !els['coder-terminal-panel'].classList.contains('hidden'));
  }

  function isCoderRunResultPanelOpen() {
    return Boolean(els['coder-run-result-panel'] && !els['coder-run-result-panel'].classList.contains('hidden'));
  }

  function getDefaultCoderTerminalCwd() {
    return normalizePath(state.projectRoot || '') || (state.activePath ? dirnamePath(state.activePath) : '');
  }

  function ensureCoderTerminalCwd() {
    const term = getCoderTerminalState();
    const next = normalizePath(term.cwd || '') || getDefaultCoderTerminalCwd();
    term.cwd = next || '';
    return term.cwd;
  }

  function trimCoderTerminalLines() {
    const term = getCoderTerminalState();
    const maxLines = 700;
    if (term.lines.length > maxLines) {
      term.lines.splice(0, term.lines.length - maxLines);
    }
  }

  function flushCoderTerminalPartialLine() {
    const term = getCoderTerminalState();
    const partial = term.partialLine;
    if (!partial || typeof partial !== 'object') return;
    term.lines.push({
      kind: String(partial.kind || 'stdout'),
      text: String(partial.text ?? '')
    });
    term.partialLine = null;
    trimCoderTerminalLines();
  }

  function appendCoderTerminalLine(text, kind = 'stdout') {
    flushCoderTerminalPartialLine();
    const term = getCoderTerminalState();
    const lineKind = String(kind || 'stdout').trim() || 'stdout';
    const raw = String(text ?? '');
    const parts = raw.split(/\r?\n/);
    if (!parts.length) parts.push('');
    parts.forEach((part) => {
      term.lines.push({ kind: lineKind, text: String(part ?? '') });
    });
    trimCoderTerminalLines();
  }

  function appendCoderTerminalChunk(text, kind = 'stdout') {
    const value = String(text || '');
    if (!value) return;
    const term = getCoderTerminalState();
    const lineKind = String(kind || 'stdout').trim() || 'stdout';
    let normalized = value.replace(/\r\n/g, '\n');

    if (term.partialLine && String(term.partialLine.kind || '') !== lineKind) {
      flushCoderTerminalPartialLine();
    }

    if (term.partialLine && String(term.partialLine.kind || '') === lineKind) {
      normalized = `${String(term.partialLine.text || '')}${normalized}`;
      term.partialLine = null;
    }

    const parts = normalized.split('\n');
    const hasTrailingNewline = normalized.endsWith('\n');
    const completeCount = hasTrailingNewline ? parts.length : Math.max(0, parts.length - 1);

    for (let i = 0; i < completeCount; i += 1) {
      term.lines.push({
        kind: lineKind,
        text: String(parts[i] ?? '')
      });
    }

    if (!hasTrailingNewline) {
      term.partialLine = {
        kind: lineKind,
        text: String(parts[parts.length - 1] ?? '')
      };
    } else {
      term.partialLine = null;
    }

    trimCoderTerminalLines();
  }

  function appendCoderTerminalOutputBlock(text, kind = 'stdout') {
    const value = String(text || '');
    if (!value) return;
    appendCoderTerminalChunk(value, kind);
  }

  function isCoderTerminalSessionActive() {
    const term = getCoderTerminalState();
    return Boolean(term.busy && String(term.sessionId || ''));
  }

  async function writeCoderTerminalSessionInput(rawInputText) {
    const term = getCoderTerminalState();
    const sessionId = String(term.sessionId || '').trim();
    if (!sessionId) return false;
    if (!api.terminal?.write) {
      appendCoderTerminalLine('Interactive terminal input API unavailable', 'stderr');
      return false;
    }
    const raw = String(rawInputText ?? '');
    try {
      const res = await api.terminal.write({
        sessionId,
        data: `${raw}\n`
      });
      if (!res?.success) {
        appendCoderTerminalLine(`Failed to send input: ${String(res?.error || 'Unknown error')}`, 'stderr');
        renderCoderTerminalPanel(true);
        return false;
      }
      // Pipe-based stdin does not echo typed input like a TTY, so echo locally.
      appendCoderTerminalChunk(`${raw}\n`, 'stdout');
      renderCoderTerminalPanel(true);
      return true;
    } catch (error) {
      appendCoderTerminalLine(`Failed to send input: ${error?.message || error}`, 'stderr');
      renderCoderTerminalPanel(true);
      return false;
    }
  }

  async function stopCoderTerminalActiveSession(options = {}) {
    const term = getCoderTerminalState();
    const sessionId = String(term.sessionId || '').trim();
    if (!sessionId) return false;
    if (!api.terminal?.stop) {
      appendCoderTerminalLine('Interactive terminal stop API unavailable', 'stderr');
      renderCoderTerminalPanel(true);
      return false;
    }
    try {
      const res = await api.terminal.stop({ sessionId });
      if (!res?.success) {
        appendCoderTerminalLine(`Failed to stop process: ${String(res?.error || 'Unknown error')}`, 'stderr');
        renderCoderTerminalPanel(true);
        return false;
      }
      if (options?.echoCancel !== false) appendCoderTerminalLine('^C', 'stderr');
      renderCoderTerminalPanel(true);
      return true;
    } catch (error) {
      appendCoderTerminalLine(`Failed to stop process: ${error?.message || error}`, 'stderr');
      renderCoderTerminalPanel(true);
      return false;
    }
  }

  async function handleCoderTerminalCloseAction() {
    if (isCoderTerminalSessionActive()) {
      await stopCoderTerminalActiveSession({ echoCancel: false });
    }
    toggleCoderTerminalPanel(false);
  }

  async function handleCoderTerminalRuntimeEvent(payload) {
    const term = getCoderTerminalState();
    const sessionId = String(payload?.sessionId || '').trim();
    if (!sessionId) return;
    if (!term.sessionId && !term.busy) return;
    if (term.sessionId && term.sessionId !== sessionId) return;
    const type = String(payload?.type || '').trim().toLowerCase();
    if (!type) return;

    if (type === 'stdout' || type === 'stderr') {
      appendCoderTerminalChunk(String(payload?.data || ''), type);
      renderCoderTerminalPanel(true);
      return;
    }

    if (type === 'exit') {
      if (term.sessionId === sessionId || (!term.sessionId && term.busy)) {
        flushCoderTerminalPartialLine();
        term.sessionId = '';
        term.busy = false;
      }
      const exitCode = Number.isFinite(Number(payload?.exitCode)) ? Number(payload.exitCode) : null;
      const errorText = String(payload?.error || '');
      const success = payload?.success === true && exitCode === 0;
      if (success) {
        appendCoderTerminalLine('Exit code: 0', 'success');
      } else {
        const codeLabel = exitCode == null ? 'error' : String(exitCode);
        appendCoderTerminalLine(`Exit code: ${codeLabel}${errorText ? ` | ${errorText}` : ''}`, 'stderr');
      }
      renderCoderTerminalPanel(true);
      queueMicrotask(() => {
        try { els['coder-terminal-input']?.focus?.(); } catch (_) {}
      });
    }
  }

  function clearCoderTerminalOutput() {
    const term = getCoderTerminalState();
    if (term.activeTab === 'output') {
      const out = getCoderRunResultPanelState();
      out.outputText = '';
      out.outputKind = 'stdout';
      out.meta = '';
      out.lastRunMeta = '';
      out.busy = false;
      out.open = false;
      renderCoderRunResultPanel();
      return;
    }
    term.lines = [];
    term.partialLine = null;
    renderCoderTerminalPanel(true);
  }

  function toggleCoderTerminalPanel(force) {
    const term = getCoderTerminalState();
    term.open = typeof force === 'boolean' ? force : !term.open;
    renderCoderTerminalPanel(term.open);
  }

  async function openCoderTerminalPanel() {
    const term = getCoderTerminalState();
    ensureCoderTerminalCwd();
    term.activeTab = 'terminal';
    toggleCoderTerminalPanel(true);
    queueMicrotask(() => {
      try { els['coder-terminal-input']?.focus?.(); } catch (_) {}
    });
  }

  function getCoderTerminalHeightBounds() {
    const panel = els['coder-terminal-panel'];
    const parent = panel?.parentElement;
    const parentHeight = Math.round(parent?.getBoundingClientRect?.().height || 0);
    const minHeight = 160;
    let maxHeight = 520;
    if (parentHeight > 0) {
      maxHeight = Math.max(minHeight, parentHeight - 90);
    } else {
      maxHeight = Math.max(minHeight, Math.round((window.innerHeight || 900) * 0.7));
    }
    return { minHeight, maxHeight };
  }

  function applyCoderTerminalPanelHeight() {
    const panel = els['coder-terminal-panel'];
    if (!panel) return;
    const term = getCoderTerminalState();
    const bounds = getCoderTerminalHeightBounds();
    const next = clamp(Math.round(Number(term.panelHeight) || 300), bounds.minHeight, bounds.maxHeight);
    term.panelHeight = next;
    panel.style.height = `${next}px`;
  }

  function getCoderTerminalCardElement() {
    return els['coder-terminal-panel']?.querySelector?.('.coder-terminal-card') || null;
  }

  function setCoderTerminalActiveTab(tab, options = {}) {
    const term = getCoderTerminalState();
    term.activeTab = String(tab || '').trim().toLowerCase() === 'output' ? 'output' : 'terminal';
    if (options?.openPanel !== false) term.open = true;
    renderCoderTerminalPanel(Boolean(options?.scrollToBottom));
  }

  function isCoderTerminalOutputTabActive() {
    const term = getCoderTerminalState();
    return Boolean(term.open && term.activeTab === 'output');
  }

  function syncCoderRunResultInputDraft(sourceEl = null) {
    const panel = getCoderRunResultPanelState();
    const src = sourceEl || document.activeElement;
    let value = String(panel.inputText || '');

    if (src === els['coder-output-stdin'] || src === els['coder-run-result-input']) {
      value = String(src?.value || '');
    } else if (isCoderTerminalOutputTabActive() && els['coder-output-stdin']) {
      value = String(els['coder-output-stdin'].value || '');
    } else if (els['coder-run-result-input']) {
      value = String(els['coder-run-result-input'].value || panel.inputText || '');
    }

    panel.inputText = value;
    return value;
  }

  async function handleCoderOutputStdinKeydown(event) {
    if (!isCoderTerminalOutputTabActive()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setCoderTerminalActiveTab('terminal');
      queueMicrotask(() => {
        try { els['coder-terminal-input']?.focus?.(); } catch (_) {}
      });
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      syncCoderRunResultInputDraft(event.target);
      await rerunCoderCRunFromResultPanel();
      return;
    }
    queueMicrotask(() => syncCoderRunResultInputDraft(event.target));
  }

  function renderCoderTerminalTabUi() {
    const term = getCoderTerminalState();
    const activeTab = term.activeTab === 'output' ? 'output' : 'terminal';
    const card = getCoderTerminalCardElement();
    card?.classList.toggle('mode-output', activeTab === 'output');
    card?.classList.toggle('mode-terminal', activeTab === 'terminal');

    const terminalTab = els['btn-coder-tab-terminal'];
    const outputTab = els['btn-coder-tab-output'];
    terminalTab?.classList.toggle('active', activeTab === 'terminal');
    outputTab?.classList.toggle('active', activeTab === 'output');
    if (terminalTab) terminalTab.setAttribute('aria-current', activeTab === 'terminal' ? 'page' : 'false');
    if (outputTab) outputTab.setAttribute('aria-current', activeTab === 'output' ? 'page' : 'false');

    if (els['coder-terminal-shell-pill']) {
      els['coder-terminal-shell-pill'].textContent = activeTab === 'output' ? 'output' : 'powershell';
    }
    if (els['btn-coder-terminal-run']) {
      const showRun = activeTab === 'terminal';
      els['btn-coder-terminal-run'].style.display = showRun ? '' : 'none';
    }
    if (els['coder-terminal-input-row']) {
      els['coder-terminal-input-row'].style.display = activeTab === 'terminal' ? '' : 'none';
    }
    if (els['coder-output-panel']) {
      els['coder-output-panel'].style.display = activeTab === 'output' ? '' : 'none';
    }
  }

  function renderCoderTerminalViewport(scrollToBottom = false) {
    const term = getCoderTerminalState();
    const outputEl = els['coder-terminal-output'];
    if (!outputEl) return;

    if (term.activeTab === 'output') {
      const panelState = getCoderRunResultPanelState();
      const raw = String(panelState.outputText || '').replace(/\r\n/g, '\n');
      const kind = String(panelState.outputKind || 'stdout').replace(/[^a-z0-9_-]/gi, '') || 'stdout';
      const lines = raw ? raw.split('\n') : ['No compiler output yet'];
      outputEl.innerHTML = lines.map((line) => {
        return `<div class="coder-terminal-line ${kind}">${line ? escapeHtml(line) : '&nbsp;'}</div>`;
      }).join('');
      queueMicrotask(() => {
        try { outputEl.scrollTop = outputEl.scrollHeight; } catch (_) {}
      });
      return;
    }

    const lines = [
      ...(term.lines.length ? term.lines : []),
      ...(term.partialLine ? [term.partialLine] : [])
    ];
    outputEl.innerHTML = lines.map((line) => {
      const cls = String(line?.kind || 'stdout').replace(/[^a-z0-9_-]/gi, '') || 'stdout';
      const text = String(line?.text ?? '');
      return `<div class="coder-terminal-line ${cls}">${text ? escapeHtml(text) : '&nbsp;'}</div>`;
    }).join('');
    if (scrollToBottom || term.open) {
      queueMicrotask(() => {
        try { outputEl.scrollTop = outputEl.scrollHeight; } catch (_) {}
      });
    }
  }

  function renderCoderTerminalPanel(scrollToBottom = false) {
    const term = getCoderTerminalState();
    const panel = els['coder-terminal-panel'];
    applyCoderTerminalPanelHeight();
    if (panel) {
      panel.classList.toggle('hidden', !term.open);
      panel.setAttribute('aria-hidden', term.open ? 'false' : 'true');
    }
    renderCoderTerminalTabUi();
    renderCoderTerminalViewport(scrollToBottom);
    if (els['coder-terminal-meta']) {
      if (term.activeTab === 'output') {
        const rr = getCoderRunResultPanelState();
        const metaText = rr.busy ? 'Running...' : String(rr.meta || rr.lastRunMeta || 'Compiler output');
        els['coder-terminal-meta'].textContent = metaText || 'Compiler output';
      } else {
        els['coder-terminal-meta'].textContent = isCoderTerminalSessionActive() ? 'Process running...' : (term.busy ? 'Running command...' : 'Ready');
      }
    }
    if (els['coder-terminal-cwd']) {
      const cwd = ensureCoderTerminalCwd();
      els['coder-terminal-cwd'].textContent = formatCoderTerminalPrompt(cwd);
    }
    if (els['coder-terminal-input']) {
      if (els['coder-terminal-input'] !== document.activeElement && typeof term.input === 'string') {
        els['coder-terminal-input'].value = term.input;
      }
      els['coder-terminal-input'].disabled = Boolean(term.busy && !term.sessionId);
      els['coder-terminal-input'].placeholder = term.sessionId
        ? 'Type input for running program and press Enter'
        : 'Type a command and press Enter';
    }
    {
      const rr = getCoderRunResultPanelState();
      const hasFile = Boolean(String(rr.filePath || '').trim());
      const awaitingInteractiveInput = rr.awaitingInteractiveInput === true;
      if (els['coder-output-stdin']) {
        if (els['coder-output-stdin'] !== document.activeElement) {
          els['coder-output-stdin'].value = String(rr.inputText || '');
        }
        els['coder-output-stdin'].disabled = rr.busy || !hasFile;
        els['coder-output-stdin'].placeholder = rr.busy
          ? 'Running...'
          : (hasFile
              ? (awaitingInteractiveInput
                  ? 'Type next input value and press Enter'
                  : 'Type program input and press Enter to rerun')
              : 'No runnable C/C++ output selected');
      }
    }
    if (els['btn-coder-terminal-run']) els['btn-coder-terminal-run'].disabled = term.busy;
    if (els['btn-terminal']) els['btn-terminal'].classList.toggle('active', term.open);
  }

  function startCoderTerminalResize(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const panel = els['coder-terminal-panel'];
    if (!panel || panel.classList.contains('hidden')) return;
    event.preventDefault();

    const term = getCoderTerminalState();
    const bounds = getCoderTerminalHeightBounds();
    const currentHeight = Math.round(panel.getBoundingClientRect().height || Number(term.panelHeight) || 300);
    state.coderTerminalResize = {
      pointerId: event.pointerId,
      startY: Number(event.clientY || 0),
      startHeight: clamp(currentHeight, bounds.minHeight, bounds.maxHeight),
      minHeight: bounds.minHeight,
      maxHeight: bounds.maxHeight
    };
    document.body.classList.add('terminal-resizing');

    try { els['coder-terminal-resize-handle']?.setPointerCapture?.(event.pointerId); } catch (_) {}
    window.addEventListener('pointermove', onCoderTerminalResizeMove);
    window.addEventListener('pointerup', stopCoderTerminalResize);
    window.addEventListener('pointercancel', stopCoderTerminalResize);
  }

  function onCoderTerminalResizeMove(event) {
    const drag = state.coderTerminalResize;
    if (!drag) return;
    const term = getCoderTerminalState();
    const deltaY = Number(event.clientY || 0) - drag.startY;
    term.panelHeight = clamp(drag.startHeight - deltaY, drag.minHeight, drag.maxHeight);
    applyCoderTerminalPanelHeight();
  }

  function stopCoderTerminalResize(event) {
    if (!state.coderTerminalResize) return;
    if (event?.pointerId !== undefined && state.coderTerminalResize.pointerId !== undefined) {
      if (event.type !== 'pointercancel' && event.pointerId !== state.coderTerminalResize.pointerId) return;
    }
    state.coderTerminalResize = null;
    document.body.classList.remove('terminal-resizing');
    applyCoderTerminalPanelHeight();
    window.removeEventListener('pointermove', onCoderTerminalResizeMove);
    window.removeEventListener('pointerup', stopCoderTerminalResize);
    window.removeEventListener('pointercancel', stopCoderTerminalResize);
    scheduleSessionSave();
  }

  function normalizeTerminalCdArg(rawArg) {
    let arg = String(rawArg || '').trim();
    if (!arg) return '';
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
      arg = arg.slice(1, -1).trim();
    }
    return arg;
  }

  async function runCoderTerminalBuiltInCd(rawArg) {
    const term = getCoderTerminalState();
    const arg = normalizeTerminalCdArg(rawArg);
    let next = '';
    if (!arg) {
      next = getDefaultCoderTerminalCwd() || term.cwd || '';
    } else if (arg === '~') {
      next = getDefaultCoderTerminalCwd() || term.cwd || '';
    } else {
      next = resolveWorkspacePath(arg, { baseDir: term.cwd || getDefaultCoderTerminalCwd() || '' });
      if (!next) next = normalizePath(arg);
    }
    next = normalizePath(next);
    if (!next) {
      appendCoderTerminalLine('cd: path is empty', 'stderr');
      return;
    }
    try {
      const stat = await api.files?.stat?.(next);
      if (!stat?.exists) {
        appendCoderTerminalLine(`cd: path not found: ${next}`, 'stderr');
        return;
      }
      if (!stat?.isDirectory) {
        appendCoderTerminalLine(`cd: not a directory: ${next}`, 'stderr');
        return;
      }
      term.cwd = next;
      appendCoderTerminalLine(`Changed directory to ${next}`, 'success');
    } catch (error) {
      appendCoderTerminalLine(`cd failed: ${error?.message || error}`, 'stderr');
    }
  }

  function formatCoderTerminalPrompt(cwd) {
    const dir = normalizePath(cwd || '') || '';
    return dir ? `PS ${dir}>` : 'PS >';
  }

  async function executeCoderTerminalCommand(commandText) {
    const term = getCoderTerminalState();
    const command = String(commandText || '').trim();
    if (!command || term.busy) return false;

    ensureCoderTerminalCwd();
    appendCoderTerminalLine(`${formatCoderTerminalPrompt(term.cwd)} ${command}`, 'command');

    if (!term.history.length || term.history[term.history.length - 1] !== command) {
      term.history.push(command);
      if (term.history.length > 120) term.history.splice(0, term.history.length - 120);
    }
    term.historyIndex = term.history.length;
    term.input = '';

    if (/^(clear|cls)$/i.test(command)) {
      term.lines = [];
      renderCoderTerminalPanel(true);
      return true;
    }
    if (/^pwd$/i.test(command)) {
      appendCoderTerminalLine(term.cwd || '(default process cwd)', 'stdout');
      renderCoderTerminalPanel(true);
      return true;
    }
    const cdMatch = command.match(/^cd(?:\s+(.+))?$/i);
    if (cdMatch) {
      await runCoderTerminalBuiltInCd(cdMatch[1] || '');
      renderCoderTerminalPanel(true);
      return true;
    }

    if (!api.terminal?.start && !api.terminal?.exec) {
      appendCoderTerminalLine('Terminal API unavailable in Coder', 'stderr');
      renderCoderTerminalPanel(true);
      return false;
    }

    term.busy = true;
    renderCoderTerminalPanel();
    const reqId = (Number(term.requestSeq) || 0) + 1;
    term.requestSeq = reqId;

    if (api.terminal?.start) {
      try {
        const res = await api.terminal.start({
          command,
          cwd: term.cwd || '',
          timeoutMs: 0,
          maxOutputBytes: 1024 * 1024
        });
        if (getCoderTerminalState().requestSeq !== reqId) {
          if (res?.sessionId) {
            try { await api.terminal.stop?.({ sessionId: res.sessionId }); } catch (_) {}
          }
          return false;
        }
        if (!res?.success || !res?.sessionId) {
          appendCoderTerminalLine(`Terminal command failed: ${String(res?.error || 'Failed to start process')}`, 'stderr');
          term.busy = false;
          renderCoderTerminalPanel(true);
          return false;
        }
        if (!term.busy) {
          renderCoderTerminalPanel(true);
          return true;
        }
        term.sessionId = String(res.sessionId || '');
        term.busy = true;
        renderCoderTerminalPanel(true);
        return true;
      } catch (error) {
        appendCoderTerminalLine(`Terminal command failed: ${error?.message || error}`, 'stderr');
        term.busy = false;
        renderCoderTerminalPanel(true);
        return false;
      }
    }

    try {
      const res = await api.terminal.exec({
        command,
        cwd: term.cwd || '',
        timeoutMs: 30000,
        maxOutputBytes: 1024 * 1024
      });
      if (getCoderTerminalState().requestSeq !== reqId) return false;
      appendCoderTerminalOutputBlock(String(res?.stdout || ''), 'stdout');
      appendCoderTerminalOutputBlock(String(res?.stderr || ''), 'stderr');
      flushCoderTerminalPartialLine();
      if (res?.success) {
        appendCoderTerminalLine('Exit code: 0', 'success');
      } else {
        const codeLabel = Number.isFinite(Number(res?.exitCode)) ? String(res.exitCode) : 'error';
        appendCoderTerminalLine(`Exit code: ${codeLabel}${res?.error ? ` | ${String(res.error)}` : ''}`, 'stderr');
      }
      return Boolean(res?.success);
    } catch (error) {
      appendCoderTerminalLine(`Terminal command failed: ${error?.message || error}`, 'stderr');
      return false;
    } finally {
      if (getCoderTerminalState().requestSeq === reqId) {
        term.busy = false;
        term.sessionId = '';
        renderCoderTerminalPanel(true);
        queueMicrotask(() => {
          try { els['coder-terminal-input']?.focus?.(); } catch (_) {}
        });
      }
    }
  }

  async function runCoderTerminalFromInput() {
    const term = getCoderTerminalState();
    const inputEl = els['coder-terminal-input'];
    const rawValue = String(inputEl?.value ?? term.input ?? '');
    term.input = '';
    if (inputEl) inputEl.value = '';
    if (isCoderTerminalSessionActive()) {
      return writeCoderTerminalSessionInput(rawValue);
    }
    const value = rawValue.trim();
    if (!value) return false;
    return executeCoderTerminalCommand(value);
  }

  async function handleCoderTerminalInputKeydown(event) {
    const term = getCoderTerminalState();
    const sessionActive = isCoderTerminalSessionActive();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await runCoderTerminalFromInput();
      return;
    }
    if (sessionActive && event.ctrlKey && !event.shiftKey && String(event.key || '').toLowerCase() === 'c') {
      event.preventDefault();
      await stopCoderTerminalActiveSession();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      toggleCoderTerminalPanel(false);
      return;
    }
    if (sessionActive) {
      queueMicrotask(() => {
        term.input = String(els['coder-terminal-input']?.value || '');
      });
      return;
    }
    if (event.key === 'ArrowUp') {
      if (!term.history.length) return;
      event.preventDefault();
      if (term.historyIndex < 0) term.historyIndex = term.history.length;
      term.historyIndex = Math.max(0, term.historyIndex - 1);
      const v = String(term.history[term.historyIndex] || '');
      term.input = v;
      if (els['coder-terminal-input']) {
        els['coder-terminal-input'].value = v;
        els['coder-terminal-input'].setSelectionRange(v.length, v.length);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      if (!term.history.length) return;
      event.preventDefault();
      if (term.historyIndex < 0) term.historyIndex = term.history.length;
      term.historyIndex = Math.min(term.history.length, term.historyIndex + 1);
      const v = term.historyIndex >= term.history.length ? '' : String(term.history[term.historyIndex] || '');
      term.input = v;
      if (els['coder-terminal-input']) {
        els['coder-terminal-input'].value = v;
        els['coder-terminal-input'].setSelectionRange(v.length, v.length);
      }
      return;
    }
    queueMicrotask(() => {
      term.input = String(els['coder-terminal-input']?.value || '');
    });
  }

  async function handleCoderRunResultInputKeydown(event) {
    if (!isCoderRunResultPanelOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      toggleCoderRunResultPanel(false);
      return;
    }
    const key = String(event.key || '').toLowerCase();
    if (key === 'enter' && !event.shiftKey) {
      event.preventDefault();
      await rerunCoderCRunFromResultPanel();
      return;
    }
    queueMicrotask(() => {
      const panel = getCoderRunResultPanelState();
      panel.inputText = String(els['coder-run-result-input']?.value || '');
    });
  }

  function toggleCoderRunResultPanel(force) {
    const panel = getCoderRunResultPanelState();
    panel.open = typeof force === 'boolean' ? force : !panel.open;
    renderCoderRunResultPanel();
  }

  function renderCoderRunResultPanel() {
    const panelState = getCoderRunResultPanelState();
    const panel = els['coder-run-result-panel'];
    if (panel) {
      panel.classList.toggle('hidden', !panelState.open);
      panel.setAttribute('aria-hidden', panelState.open ? 'false' : 'true');
    }
    if (els['coder-run-result-title']) els['coder-run-result-title'].textContent = String(panelState.title || 'Run Result');
    if (els['coder-run-result-meta']) {
      const metaText = panelState.busy
        ? 'Running...'
        : String(panelState.meta || panelState.lastRunMeta || '');
      els['coder-run-result-meta'].textContent = metaText;
    }
    if (els['coder-run-result-body']) {
      const raw = String(panelState.outputText || '').replace(/\r\n/g, '\n');
      const kind = String(panelState.outputKind || 'stdout').replace(/[^a-z0-9_-]/gi, '') || 'stdout';
      const lines = raw ? raw.split('\n') : ['No output'];
      els['coder-run-result-body'].innerHTML = lines.map((line) => {
        return `<div class="coder-terminal-line ${kind}">${line ? escapeHtml(line) : '&nbsp;'}</div>`;
      }).join('');
      queueMicrotask(() => {
        try { els['coder-run-result-body'].scrollTop = els['coder-run-result-body'].scrollHeight; } catch (_) {}
      });
    }
    if (els['coder-run-result-input']) {
      if (els['coder-run-result-input'] !== document.activeElement) {
        els['coder-run-result-input'].value = String(panelState.inputText || '');
      }
      els['coder-run-result-input'].disabled = panelState.busy;
    }
    if (els['btn-coder-run-result-rerun']) {
      const hasFile = Boolean(String(panelState.filePath || '').trim());
      els['btn-coder-run-result-rerun'].disabled = panelState.busy || !hasFile;
    }
    if (els['btn-coder-run-result-dismiss']) {
      els['btn-coder-run-result-dismiss'].disabled = panelState.busy;
    }
    renderCoderTerminalPanel(panelState.open === false && getCoderTerminalState().activeTab === 'output');
  }

  function openCoderRunResultPanel(payload = {}) {
    const panel = getCoderRunResultPanelState();
    panel.title = String(payload.title || 'Run Result');
    panel.meta = String(payload.meta || '');
    panel.lastRunMeta = panel.meta;
    panel.sections = [];
    panel.outputText = String(payload.outputText || '');
    panel.fullOutputText = typeof payload.fullOutputText === 'string'
      ? payload.fullOutputText
      : panel.outputText;
    panel.outputKind = String(payload.outputKind || 'stdout');
    if (typeof payload.inputText === 'string') panel.inputText = payload.inputText;
    panel.stdinSessionText = typeof payload.stdinSessionText === 'string' ? payload.stdinSessionText : '';
    panel.awaitingInteractiveInput = payload.awaitingInteractiveInput === true;
    panel.filePath = String(payload.filePath || panel.filePath || '');
    panel.busy = false;
    if (!panel.outputText && Array.isArray(payload.sections)) {
      panel.outputText = payload.sections
        .map((section) => String(section?.text || '').trim())
        .filter(Boolean)
        .join('\n\n');
      panel.fullOutputText = panel.outputText;
      panel.outputKind = String(payload.outputKind || 'stdout');
    }
    panel.open = false;
    const term = getCoderTerminalState();
    term.open = true;
    term.activeTab = 'output';
    renderCoderRunResultPanel();
    queueMicrotask(() => {
      try { els['coder-terminal-output']?.scrollTo?.({ top: els['coder-terminal-output']?.scrollHeight || 0 }); } catch (_) {}
    });
  }

  function openCoderCRunResultPanel(filePath, result, diagnostics = [], options = {}) {
    const languageLabel = String(options?.languageLabel || 'C').trim() || 'C';
    const fileName = basenamePath(filePath || '') || (languageLabel === 'C++' ? 'program.cpp' : 'program.c');
    const ok = Boolean(result?.success);
    const awaitingInteractiveInput = options?.awaitingInteractiveInput === true;
    const previousPanel = getCoderRunResultPanelState();
    const previousFilePath = normalizePath(previousPanel.filePath || '');
    const currentFilePath = normalizePath(filePath || '');
    const phase = String(result?.phase || (ok ? 'run' : 'compile')).trim() || 'run';
    const compilerName = String(result?.compiler || (result?.compilerProfile === 'inbuilt' ? 'inbuilt-mini-c' : '') || '').trim();
    const compileText = String(result?.compileOutput || (phase === 'compile' ? (result?.output || '') : '') || '').trim();
    const runText = String(phase === 'run' ? (result?.output || '') : '').trim();
    const errText = String(result?.error || '').trim();
    const diagList = Array.isArray(diagnostics) ? diagnostics : [];
    const compileOutputIsBanner = /used coder inbuilt/i.test(compileText);
    let outputText = '';
    let outputKind = ok ? 'stdout' : 'stderr';
    if (ok && phase === 'run') {
      outputText = runText || '';
      if (!outputText && compileText && !compileOutputIsBanner) {
        outputText = compileText;
      }
      if (!outputText) outputText = '(program finished with no output)';
      if (compileText && runText && !compileOutputIsBanner) {
        outputText = `${compileText}\n\n${runText}`;
      }
    } else if (phase === 'run') {
      outputText = runText || '';
      if (!outputText && errText && !awaitingInteractiveInput) outputText = errText;
      if (!outputText && errText && awaitingInteractiveInput && !/requested more input|stdin/i.test(errText)) {
        outputText = errText;
      }
      if (!outputText && compileText && !compileOutputIsBanner) {
        outputText = compileText;
      }
      if (!outputText && diagList.length) {
        outputText = diagList.slice(0, 80).map((diag) => {
          const line = Math.max(1, Number(diag?.line) || 1);
          const col = Math.max(1, Number(diag?.col) || 1);
          const sev = String(diag?.severity || 'warning').toUpperCase();
          const msg = String(diag?.message || '').trim();
          return `Ln ${line}, Col ${col} [${sev}] ${msg}`;
        }).join('\n');
      }
      if (!outputText) {
        outputText = awaitingInteractiveInput
          ? 'Program is waiting for more input. Type the next input value and press Enter.'
          : (errText || 'Program run failed.');
      }
      outputKind = awaitingInteractiveInput ? 'stdout' : 'stderr';
    } else {
      outputText = compileText || errText || '';
      if (!outputText && diagList.length) {
        outputText = diagList.slice(0, 80).map((diag) => {
          const line = Math.max(1, Number(diag?.line) || 1);
          const col = Math.max(1, Number(diag?.col) || 1);
          const sev = String(diag?.severity || 'warning').toUpperCase();
          const msg = String(diag?.message || '').trim();
          return `Ln ${line}, Col ${col} [${sev}] ${msg}`;
        }).join('\n');
      }
      if (!outputText) outputText = errText || 'Compilation failed.';
    }
    if (result?.timedOut) {
      outputText = outputText ? `${outputText}\n\nProcess timed out.` : 'Process timed out.';
      outputKind = 'stderr';
    }
    if (result?.outputTruncated) {
      outputText = outputText ? `${outputText}\n\n(output truncated)` : '(output truncated)';
    }

    const metaBits = [];
    if (awaitingInteractiveInput) {
      metaBits.push('Awaiting input');
      if (compilerName) metaBits.push(compilerName);
      metaBits.push('phase: run');
    } else {
      metaBits.push(ok ? 'Completed' : 'Failed');
      if (!ok && compilerName) metaBits.push(compilerName);
      if (!ok && phase) metaBits.push(`phase: ${phase}`);
    }
    const stdinDisplayText = typeof options.stdinText === 'string' ? options.stdinText : '';
    const stdinSessionText = typeof options.stdinSessionText === 'string'
      ? options.stdinSessionText
      : stdinDisplayText;
    let displayOutputText = outputText;
    const previousSessionInput = String(previousPanel.stdinSessionText || '');
    const previousFullOutput = String(previousPanel.fullOutputText || '');
    const continuingInteractiveFlow = Boolean(
      currentFilePath
      && previousFilePath
      && currentFilePath === previousFilePath
      && (awaitingInteractiveInput || previousPanel.awaitingInteractiveInput === true)
      && stdinSessionText.startsWith(previousSessionInput)
      && previousFullOutput
    );
    if (continuingInteractiveFlow) {
      if (outputText.startsWith(previousFullOutput)) {
        displayOutputText = outputText.slice(previousFullOutput.length);
      } else {
        let i = 0;
        const limit = Math.min(previousFullOutput.length, outputText.length);
        while (i < limit && previousFullOutput.charAt(i) === outputText.charAt(i)) i += 1;
        displayOutputText = outputText.slice(i);
      }
      if (displayOutputText && !/^[\r\n]/.test(displayOutputText)) {
        displayOutputText = displayOutputText.replace(/^[ \t]+/, '');
      }
      if (!displayOutputText) {
        displayOutputText = awaitingInteractiveInput
          ? 'Waiting for next input...'
          : '(no new output)';
      }
    }
    openCoderRunResultPanel({
      title: `${languageLabel} Run Result - ${fileName}`,
      meta: metaBits.join(' | '),
      filePath: String(filePath || ''),
      inputText: awaitingInteractiveInput ? '' : stdinDisplayText,
      stdinSessionText,
      awaitingInteractiveInput,
      outputText: displayOutputText,
      fullOutputText: outputText,
      outputKind
    });
  }

  async function rerunCoderCRunFromResultPanel(options = {}) {
    const panel = getCoderRunResultPanelState();
    if (panel.busy) return false;
    const filePath = String(panel.filePath || '').trim();
    if (!filePath) {
      showToast('No source file is linked to this run output', 'warn');
      return false;
    }
    syncCoderRunResultInputDraft();
    const hasStdinTextOverride = Object.prototype.hasOwnProperty.call(options, 'stdinTextOverride');
    const hasStdinDisplayOverride = Object.prototype.hasOwnProperty.call(options, 'stdinDisplayOverride');
    let rawInputText = hasStdinDisplayOverride
      ? String(options.stdinDisplayOverride ?? '')
      : String(panel.inputText ?? '');
    let stdinText = '';

    if (hasStdinTextOverride) {
      stdinText = String(options.stdinTextOverride ?? '');
      if (!options?.preserveRawStdin && stdinText && !/[\r\n]$/.test(stdinText)) stdinText = `${stdinText}\n`;
      panel.stdinSessionText = stdinText;
    } else if (panel.awaitingInteractiveInput) {
      const nextChunk = String(rawInputText || '');
      const normalizedChunk = /[\r\n]$/.test(nextChunk) ? nextChunk : `${nextChunk}\n`;
      stdinText = `${String(panel.stdinSessionText || '')}${normalizedChunk}`;
      panel.stdinSessionText = stdinText;
      rawInputText = '';
    } else {
      stdinText = rawInputText && !/[\r\n]$/.test(rawInputText) ? `${rawInputText}\n` : rawInputText;
      panel.stdinSessionText = stdinText;
    }

    panel.inputText = rawInputText;
    if (els['coder-run-result-input'] && els['coder-run-result-input'] !== document.activeElement) {
      els['coder-run-result-input'].value = rawInputText;
    }
    if (els['coder-output-stdin'] && els['coder-output-stdin'] !== document.activeElement) {
      els['coder-output-stdin'].value = rawInputText;
    }
    panel.busy = true;
    panel.outputText = 'Running...';
    panel.outputKind = 'info';
    panel.requestSeq = (Number(panel.requestSeq) || 0) + 1;
    const reqId = panel.requestSeq;
    renderCoderRunResultPanel();
    try {
      return await runActiveFile({
        path: filePath,
        cStdinText: stdinText,
        cStdinDisplayText: rawInputText
      });
    } finally {
      const current = getCoderRunResultPanelState();
      if (current.requestSeq === reqId && current.busy) {
        current.busy = false;
        renderCoderRunResultPanel();
      }
    }
  }

  function renderAiSidebar() {
    if (!AI_CHAT_ENABLED) {
      state.aiOpen = false;
      state.aiSettingsOpen = false;
    }
    const open = AI_CHAT_ENABLED && state.aiOpen;
    renderWorkspaceLayout();
    els['btn-toggle-ai']?.classList.toggle('active', open);
    els['btn-toggle-ai']?.setAttribute('aria-hidden', AI_CHAT_ENABLED ? 'false' : 'true');
    els['ai-sidebar']?.classList.toggle('hidden', !AI_CHAT_ENABLED);
    els['ai-settings-panel']?.classList.toggle('hidden', !AI_CHAT_ENABLED || !state.aiSettingsOpen);
    if (els['ai-settings-panel']) {
      els['ai-settings-panel'].setAttribute('aria-hidden', (AI_CHAT_ENABLED && state.aiSettingsOpen) ? 'false' : 'true');
    }
  }

  function toggleAiSettingsPanel(force) {
    if (!AI_CHAT_ENABLED) return;
    state.aiSettingsOpen = typeof force === 'boolean' ? force : !state.aiSettingsOpen;
    if (state.aiSettingsOpen) state.aiOpen = true;
    renderAiSidebar();
  }

  async function openAiSettingsPanel() {
    if (!AI_CHAT_ENABLED) {
      showToast('AI chat is removed from Coder', 'warn');
      return;
    }
    if (!api.settings?.get) {
      showToast('Settings API unavailable', 'error');
      return;
    }
    toggleAiSidebar(true);
    await loadAiSettingsPanel();
    toggleAiSettingsPanel(true);
  }

  function startSidePanelResize(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (state.aiOpen) return;
    if (state.explorerOpen === false) return;
    const workspaceEl = els['workspace'];
    if (!workspaceEl) return;
    event.preventDefault();

    const sideMode = state.sidePanelMode || 'explorer';
    const railWidth = Math.round(document.querySelector('.activity-rail')?.getBoundingClientRect?.().width || 46);
    const workspaceWidth = Math.round(workspaceEl.getBoundingClientRect().width || window.innerWidth || 0);
    const minWidth = 210;
    const maxWidth = Math.max(minWidth, workspaceWidth - railWidth - 220);
    const cssWidth = parseFloat(getComputedStyle(workspaceEl).getPropertyValue('--coder-side-width'));
    const currentWidth = Math.round(
      Number.isFinite(cssWidth)
        ? cssWidth
        : (Number(state.sidePanelWidths?.[sideMode]) || (DEFAULT_SIDE_PANEL_WIDTHS[sideMode] || 240))
    );

    state.sideResize = {
      pointerId: event.pointerId,
      mode: sideMode,
      startX: Number(event.clientX || 0),
      startWidth: clamp(currentWidth, minWidth, maxWidth),
      minWidth,
      maxWidth
    };
    renderWorkspaceLayout();

    try { els['side-resize-handle']?.setPointerCapture?.(event.pointerId); } catch (_) {}
    window.addEventListener('pointermove', onSidePanelResizeMove);
    window.addEventListener('pointerup', stopSidePanelResize);
    window.addEventListener('pointercancel', stopSidePanelResize);
  }

  function onSidePanelResizeMove(event) {
    const drag = state.sideResize;
    if (!drag) return;
    const delta = Number(event.clientX || 0) - drag.startX;
    if (!state.sidePanelWidths || typeof state.sidePanelWidths !== 'object') {
      state.sidePanelWidths = { ...DEFAULT_SIDE_PANEL_WIDTHS };
    }
    state.sidePanelWidths[drag.mode] = clamp(drag.startWidth + delta, drag.minWidth, drag.maxWidth);
    renderWorkspaceLayout();
  }

  function stopSidePanelResize(event) {
    if (!state.sideResize) return;
    if (event?.pointerId !== undefined && state.sideResize.pointerId !== undefined) {
      if (event.type !== 'pointercancel' && event.pointerId !== state.sideResize.pointerId) return;
    }
    state.sideResize = null;
    renderWorkspaceLayout();
    window.removeEventListener('pointermove', onSidePanelResizeMove);
    window.removeEventListener('pointerup', stopSidePanelResize);
    window.removeEventListener('pointercancel', stopSidePanelResize);
    scheduleSessionSave();
  }

  async function loadAiSettingsPanel() {
    try {
      const settings = await api.settings.get();
      const activeProvider = String(settings?.activeProvider || 'google').trim() || 'google';
      const providerCfg = settings?.providers?.[activeProvider] || {};

      if (els['ai-settings-provider']) els['ai-settings-provider'].value = activeProvider;
      if (els['ai-settings-model']) els['ai-settings-model'].value = String(providerCfg?.model || '').trim();
      if (els['ai-settings-key']) els['ai-settings-key'].value = String(providerCfg?.key || '').trim();

      let baseUrl = String(providerCfg?.baseUrl || '').trim();
      if (!baseUrl) {
        if (activeProvider === 'lmstudio') baseUrl = String(settings?.aiConfig?.lmStudio?.baseUrl || '').trim();
        if (activeProvider === 'llamacpp') baseUrl = String(settings?.aiConfig?.llamacpp?.baseUrl || '').trim();
        if (activeProvider === 'openai-compatible') baseUrl = String(settings?.aiConfig?.openaiCompatible?.baseUrl || '').trim();
      }
      if (els['ai-settings-baseurl']) els['ai-settings-baseurl'].value = baseUrl;
    } catch (error) {
      showToast(`Failed to load AI settings: ${error.message || error}`, 'error');
    }
  }

  async function saveAiSettingsPanel() {
    if (!api.settings?.get || !api.settings?.save) {
      showToast('Settings save API unavailable', 'error');
      return;
    }

    const provider = String(els['ai-settings-provider']?.value || 'google').trim() || 'google';
    const model = String(els['ai-settings-model']?.value || '').trim();
    const key = String(els['ai-settings-key']?.value || '').trim();
    const baseUrl = String(els['ai-settings-baseurl']?.value || '').trim();

    try {
      const settings = (await api.settings.get()) || {};
      settings.activeProvider = provider;
      settings.providers = settings.providers || {};
      settings.providers[provider] = {
        ...(settings.providers[provider] || {}),
        model,
        key,
        baseUrl
      };

      settings.aiConfig = settings.aiConfig || {};
      if (provider === 'lmstudio') {
        settings.aiConfig.lmStudio = { ...(settings.aiConfig.lmStudio || {}), baseUrl };
      } else if (provider === 'llamacpp') {
        settings.aiConfig.llamacpp = { ...(settings.aiConfig.llamacpp || {}), baseUrl };
      } else if (provider === 'openai-compatible') {
        settings.aiConfig.openaiCompatible = { ...(settings.aiConfig.openaiCompatible || {}), baseUrl };
      }

      const ok = await api.settings.save(settings);
      if (!ok) throw new Error('settings-save returned false');

      addAiLog(`AI settings saved (${provider}${model ? ` / ${model}` : ''})`, 'info');
      showToast('AI settings saved', 'success');
      toggleAiSettingsPanel(false);
      setMainStatus('AI settings saved');
    } catch (error) {
      console.error('[Coder AI] settings save failed:', error);
      showToast(`Failed to save AI settings: ${error.message || error}`, 'error');
      setMainStatus('AI settings save failed');
    }
  }

  function appendAiMessage(text, kind = 'assistant', options = {}) {
    if (!els['ai-chat']) return;
    const msg = document.createElement('div');
    msg.className = `ai-msg ${kind}`;
    if (options.variant) msg.dataset.variant = String(options.variant);
    if (options.state) msg.dataset.state = String(options.state);
    if (Array.isArray(options.classes)) {
      options.classes.forEach((cls) => {
        if (typeof cls === 'string' && cls.trim()) msg.classList.add(cls.trim());
      });
    }

    const finalText = String(text || '').trim() || (kind === 'assistant' ? '(empty response)' : '');
    const useTypewriter = shouldTypewriteAiMessage(kind, finalText, options);
    if (!useTypewriter) {
      msg.textContent = finalText;
    }

    els['ai-chat'].appendChild(msg);
    scrollAiChatToBottom();

    if (useTypewriter) {
      streamAiMessageText(msg, finalText);
    }
  }

  function shouldTypewriteAiMessage(kind, text, options = {}) {
    return false;
  }

  function appendAiCliStep(text, state = 'done') {
    appendAiMessage(text, 'assistant', {
      variant: 'cli',
      state,
      stream: false
    });
  }

  function appendAiStagedActionSteps(actions = []) {
    const list = Array.isArray(actions) ? actions : [];
    if (!list.length) return;
    const max = 8;
    list.slice(0, max).forEach((action, index) => {
      appendAiCliStep(`Step ${index + 1}: ${formatAiActionForChat(action)}`, 'done');
    });
    appendAiActionPreviewCards(list);
    if (list.length > max) {
      appendAiCliStep(`+${list.length - max} more staged change(s) ready for review`, 'info');
    }
  }

  function appendAiActionPreviewCards(actions = []) {
    const list = Array.isArray(actions) ? actions : [];
    const previewMax = 3;
    list.slice(0, previewMax).forEach((action, index) => appendAiActionPreviewCard(action, index));
    if (list.length > previewMax) {
      appendAiCliStep(`Preview shows first ${previewMax} change(s). Open Pending AI Changes for full diff review.`, 'info');
    }
  }

  function appendAiActionPreviewCard(action, index = 0) {
    if (!els['ai-chat'] || !action) return;

    const card = document.createElement('div');
    card.className = 'ai-preview-card';
    card.style.setProperty('--ai-preview-delay', `${Math.max(0, Math.min(8, index)) * 45}ms`);

    const head = document.createElement('div');
    head.className = 'ai-preview-head';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'ai-preview-badge';
    typeBadge.classList.add(String(action.type || 'change').replace(/[^a-z0-9_-]/gi, '') || 'change');
    typeBadge.textContent = formatAiPreviewTypeLabel(action.type);
    head.appendChild(typeBadge);

    const pathLabel = document.createElement('code');
    pathLabel.className = 'ai-preview-path';
    pathLabel.textContent = formatAiPreviewPath(action);
    head.appendChild(pathLabel);
    card.appendChild(head);

    const meta = document.createElement('div');
    meta.className = 'ai-preview-meta';
    meta.textContent = formatAiPreviewMeta(action);
    card.appendChild(meta);

    const snippet = document.createElement('pre');
    snippet.className = 'ai-preview-code';
    snippet.textContent = buildAiPreviewSnippet(action);
    card.appendChild(snippet);

    els['ai-chat'].appendChild(card);
    scrollAiChatToBottom();
  }

  function formatAiPreviewTypeLabel(type) {
    const t = String(type || '').trim();
    if (t === 'applyEdit') return 'Edited file';
    if (t === 'createFile') return 'Created file';
    if (t === 'deleteFile') return 'Deleted file';
    if (t === 'renameFile') return 'Renamed file';
    return 'Change';
  }

  function formatAiPreviewPath(action) {
    if (!action || typeof action !== 'object') return '';
    if (action.type === 'renameFile') {
      const from = toProjectRelative(action.oldPath) || action.oldPath || '';
      const to = toProjectRelative(action.newPath) || action.newPath || '';
      return `${from} -> ${to}`;
    }
    const path = action.filePath || action.newPath || action.oldPath || '';
    return toProjectRelative(path) || path;
  }

  function formatAiPreviewMeta(action) {
    if (!action || typeof action !== 'object') return '';
    if (action.type === 'applyEdit') {
      const rangeLabel = String(action?.resolvedRange?.label || '').trim();
      const changedLines = action?.lineRange
        ? `${Math.max(1, (action.lineRange.endLine || action.lineRange.startLine || 1) - (action.lineRange.startLine || 1) + 1)} line(s)`
        : '';
      return [rangeLabel, changedLines].filter(Boolean).join(' • ') || 'Incremental edit';
    }
    if (action.type === 'createFile') {
      return `${countLines(String(action.content || ''))} line(s)`;
    }
    if (action.type === 'deleteFile') {
      return `${countLines(String(action.beforePreview || ''))} preview line(s) removed`;
    }
    if (action.type === 'renameFile') {
      return 'Path change';
    }
    return '';
  }

  function buildAiPreviewSnippet(action) {
    if (!action || typeof action !== 'object') return '';
    if (action.type === 'renameFile') {
      return `from ${toProjectRelative(action.oldPath) || action.oldPath || ''}\n  to ${toProjectRelative(action.newPath) || action.newPath || ''}`;
    }

    let snippet = '';
    if (action.type === 'deleteFile') {
      snippet = String(action.beforePreview || '(deleted)');
    } else if (action.type === 'createFile') {
      snippet = String(action.afterPreview || action.content || '(new file)');
    } else {
      snippet = String(action.afterPreview || action.newContent || action.summary || '');
    }

    snippet = snippet.replace(/\r\n/g, '\n').trim();
    if (!snippet) snippet = '(no preview)';
    return truncateText(snippet, 520);
  }

  function formatAiActionForChat(action) {
    if (!action || typeof action !== 'object') return 'Prepared change';
    if (action.type === 'applyEdit') {
      const file = toProjectRelative(action.filePath) || action.filePath || 'file';
      const label = String(action?.resolvedRange?.label || action?.summary || 'edit').replace(/^.*\((.*)\)$/, '$1');
      return `Edit ${file}${label ? ` (${label})` : ''}`;
    }
    if (action.type === 'createFile') {
      const file = toProjectRelative(action.filePath) || action.filePath || 'file';
      return `Create ${file}`;
    }
    if (action.type === 'deleteFile') {
      const file = toProjectRelative(action.filePath) || action.filePath || 'file';
      return `Delete ${file}`;
    }
    if (action.type === 'renameFile') {
      const from = toProjectRelative(action.oldPath) || action.oldPath || 'file';
      const to = toProjectRelative(action.newPath) || action.newPath || 'file';
      return `Rename ${from} -> ${to}`;
    }
    return String(action.summary || action.type || 'Prepared change');
  }

  function looksLikeRawAiPlanDump(text) {
    const raw = String(text || '').trim();
    if (!raw) return false;
    if (/<think[\s>]|<\/think>/i.test(raw)) return true;
    if (/^```/m.test(raw) && /json/i.test(raw)) return true;
    if (raw.length > 180 && /"newContent"\s*:/.test(raw)) return true;
    if ((raw.startsWith('{') || raw.startsWith('[')) && /"calls"\s*:|"function"\s*:|"arguments"\s*:/.test(raw)) return true;
    if (/^\s*(thinking|reasoning|analysis)\s*:/im.test(raw)) return true;
    return false;
  }

  function stripAiThinkingText(text) {
    let value = String(text || '');
    if (!value) return '';
    value = value.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, ' ');
    value = value.replace(/```(?:json)?[\s\S]*?```/gi, (block) => (looksLikeRawAiPlanDump(block) ? ' ' : block));
    value = value.replace(/^\s*(thinking|reasoning|analysis)\s*:.*$/gim, '');
    return value.trim();
  }

  function sanitizeAiVisiblePlanMessage(text) {
    const raw = stripAiThinkingText(text);
    if (!raw) return '';
    if (looksLikeRawAiPlanDump(raw)) return '';
    const filtered = raw
      .split(/\r?\n/)
      .filter((line) => !/^\s*["']?(function|arguments|newContent|rangeOrSelector|filePath|calls)\b/i.test(line.trim()))
      .join('\n')
      .trim();
    if (!filtered || looksLikeRawAiPlanDump(filtered)) return '';
    if (filtered.length > 320) return `${filtered.slice(0, 317).trimEnd()}...`;
    return filtered;
  }

  function summarizeAiCallsForChat(calls = []) {
    const list = Array.isArray(calls) ? calls : [];
    if (!list.length) return '';
    const counts = new Map();
    list.forEach((call) => {
      const fn = String(call?.function || call?.name || 'unknown').trim() || 'unknown';
      counts.set(fn, (counts.get(fn) || 0) + 1);
    });
    const parts = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fn, count]) => `${count} ${fn}`);
    return `Plan ready: ${list.length} call(s) (${parts.join(', ')}).`;
  }

  function streamAiMessageText(el, text) {
    if (!el) return;
    const content = String(text || '');
    if (!content) {
      el.textContent = '';
      return;
    }

    let index = 0;
    el.classList.add('streaming');
    el.textContent = '';

    const tick = () => {
      if (!el.isConnected) return;
      if (index >= content.length) {
        el.classList.remove('streaming');
        scrollAiChatToBottom();
        return;
      }

      const remaining = content.length - index;
      let step = 1;
      if (remaining > 240) step = 6;
      else if (remaining > 140) step = 4;
      else if (remaining > 60) step = 3;
      else if (remaining > 20) step = 2;

      index = Math.min(content.length, index + step);
      el.textContent = content.slice(0, index);
      scrollAiChatToBottom();

      const lastChar = content[index - 1] || '';
      const delay = /[.!?]/.test(lastChar) ? 22 : /[,;:]/.test(lastChar) ? 14 : /\s/.test(lastChar) ? 9 : 7;
      setTimeout(tick, delay);
    };

    tick();
  }

  function scrollAiChatToBottom() {
    if (!els['ai-chat']) return;
    els['ai-chat'].scrollTop = els['ai-chat'].scrollHeight;
  }

  function clearAiChatMessages(options = {}) {
    const preservePending = options?.preservePending !== false;
    if (els['ai-chat']) els['ai-chat'].innerHTML = '';
    state.aiLog = [];
    renderAiLog();
    if (!preservePending && state.pendingAiBatch) {
      state.pendingAiBatch = null;
      renderPendingAi();
    }
    setMainStatus('Chat cleared');
    showToast(preservePending && state.pendingAiBatch ? 'Chat cleared (pending changes kept)' : 'Chat cleared', 'success');
    scheduleSessionSave();
  }

  function startAiSidebarResize(event) {
    if (!AI_CHAT_ENABLED) return;
    if (!state.aiOpen) return;
    if (event.button !== undefined && event.button !== 0) return;
    const workspaceEl = els['workspace'];
    if (!workspaceEl) return;
    event.preventDefault();

    const railWidth = Math.round(document.querySelector('.activity-rail')?.getBoundingClientRect?.().width || 46);
    const workspaceWidth = Math.round(workspaceEl.getBoundingClientRect().width || window.innerWidth || 0);
    const minWidth = 320;
    const maxWidth = Math.max(minWidth, workspaceWidth - railWidth - 260);
    const currentWidth = Math.round(els['ai-sidebar']?.getBoundingClientRect().width || state.aiSidebarWidth || 480);

    state.aiResize = {
      pointerId: event.pointerId,
      startX: Number(event.clientX || 0),
      startWidth: clamp(currentWidth, minWidth, maxWidth),
      minWidth,
      maxWidth
    };
    renderWorkspaceLayout();

    try { els['ai-resize-handle']?.setPointerCapture?.(event.pointerId); } catch (_) {}
    window.addEventListener('pointermove', onAiSidebarResizeMove);
    window.addEventListener('pointerup', stopAiSidebarResize);
    window.addEventListener('pointercancel', stopAiSidebarResize);
  }

  function onAiSidebarResizeMove(event) {
    const drag = state.aiResize;
    if (!drag) return;
    const delta = Number(event.clientX || 0) - drag.startX;
    state.aiSidebarWidth = clamp(drag.startWidth + delta, drag.minWidth, drag.maxWidth);
    renderWorkspaceLayout();
  }

  function stopAiSidebarResize(event) {
    if (!state.aiResize) return;
    if (event?.pointerId !== undefined && state.aiResize.pointerId !== undefined) {
      if (event.type !== 'pointercancel' && event.pointerId !== state.aiResize.pointerId) return;
    }
    state.aiResize = null;
    renderWorkspaceLayout();
    window.removeEventListener('pointermove', onAiSidebarResizeMove);
    window.removeEventListener('pointerup', stopAiSidebarResize);
    window.removeEventListener('pointercancel', stopAiSidebarResize);
    scheduleSessionSave();
  }

  function addAiLog(text, level = 'info') {
    state.aiLog.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      level,
      text: String(text || '')
    });
    if (state.aiLog.length > MAX_AI_LOG_ITEMS) state.aiLog.length = MAX_AI_LOG_ITEMS;
    renderAiLog();
    scheduleSessionSave();
  }

  function renderAiLog() {
    if (!els['ai-log-list']) return;
    els['ai-log-list'].innerHTML = '';
    state.aiLog.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'ai-log-item';
      row.innerHTML = `<span class="time">${formatClock(entry.ts)}</span>${escapeHtml(entry.text)}`;
      els['ai-log-list'].appendChild(row);
    });
  }

  async function generateAiEdits() {
    if (!AI_CHAT_ENABLED) {
      showToast('AI chat is removed from Coder', 'warn');
      return;
    }
    const prompt = String(els['ai-prompt']?.value || '').trim();
    if (!prompt) {
      showToast('Enter an AI prompt first', 'warn');
      return;
    }

    toggleAiSidebar(true);
    appendAiMessage(prompt, 'user');
    addAiLog(`AI request: ${prompt.slice(0, 120)}`, 'info');
    if (els['ai-prompt']) els['ai-prompt'].value = '';
    setMainStatus('AI generating edit plan...');

    const llmConfig = await getActiveLlmConfig().catch((error) => {
      appendAiMessage(`Failed to load AI settings: ${error.message || error}`, 'error');
      setMainStatus('AI settings unavailable');
      return null;
    });
    if (!llmConfig) return;

    appendAiCliStep('1/4 Loading workspace context', 'running');
    const workspaceSummary = await buildWorkspaceSummaryForAI();
    const indexedFiles = Array.isArray(workspaceSummary?.workspaceFiles) ? workspaceSummary.workspaceFiles.length : 0;
    appendAiCliStep(`1/4 Context ready (${indexedFiles} file${indexedFiles === 1 ? '' : 's'} indexed)`, 'done');
    const aiPrompt = buildAiPlannerPrompt(prompt, workspaceSummary);
    const systemInstruction = buildAiPlannerSystemInstruction();

    appendAiCliStep('2/4 Generating function-based edit plan', 'running');

    try {
      const response = await api.ai?.performTask?.({
        promptOverride: aiPrompt,
        systemInstruction,
        context: 'writer',
        searchMode: false,
        wikiMode: false,
        videoMode: false,
        searchDepth: 'quick',
        configOverride: {
          provider: llmConfig.provider,
          key: llmConfig.key || '',
          model: llmConfig.model || '',
          baseUrl: llmConfig.baseUrl || ''
        }
      });

      if (response?.error) {
        throw new Error(response.error);
      }

      const plan = parseAiPlanResponse(response);
      if (!plan) {
        appendAiCliStep('2/4 Plan parse failed', 'error');
        appendAiMessage('AI returned a response that could not be converted into function calls. Ask it to return strict JSON call plans only.', 'error');
        addAiLog('AI response did not contain a valid JSON call plan', 'warn');
        setMainStatus('AI plan parse failed');
        return;
      }

      appendAiCliStep(`2/4 Plan received (${(plan.calls || []).length} call(s))`, 'done');
      if (plan.message) appendAiMessage(plan.message, 'assistant');
      if (plan.warnings?.length) plan.warnings.forEach((w) => appendAiMessage(w, 'error'));

      appendAiCliStep('3/4 Validating and staging previews', 'running');
      const staged = await stageAiCalls(plan.calls || []);
      if (staged.readLogs.length) {
        staged.readLogs.forEach((msg) => addAiLog(msg, 'info'));
      }
      if (staged.errors.length) {
        staged.errors.forEach((err) => appendAiMessage(err, 'error'));
      }

      if (staged.errors.length && staged.actions.length > 0) {
        appendAiCliStep(`3/4 Staging completed with ${staged.errors.length} warning/error item(s)`, 'warn');
      } else if (staged.errors.length) {
        appendAiCliStep(`3/4 Staging failed (${staged.errors.length} error${staged.errors.length === 1 ? '' : 's'})`, 'error');
      } else {
        appendAiCliStep('3/4 Preview staging complete', 'done');
      }

      if (staged.actions.length === 0) {
        if (!staged.errors.length) appendAiMessage('No mutating function calls were staged. Ask for a concrete edit plan with applyEdit/createFile/etc.', 'error');
        appendAiCliStep('4/4 No reviewable changes were produced', 'warn');
        addAiLog('AI produced no staged changes', 'warn');
        renderPendingAi();
        setMainStatus('No pending AI changes');
        return;
      }

      state.pendingAiBatch = {
        id: `batch-${Date.now()}`,
        prompt,
        createdAt: Date.now(),
        assistantMessage: plan.message || '',
        actions: staged.actions
      };
      renderPendingAi();
      const changedFiles = [...new Set(staged.actions.map((a) => a.filePath || a.newPath || a.oldPath).filter(Boolean))];
      appendAiStagedActionSteps(staged.actions);
      appendAiCliStep(`4/4 Ready for review (${staged.actions.length} change(s) across ${changedFiles.length} file(s))`, 'done');
      appendAiMessage(`Staged ${staged.actions.length} change(s) across ${changedFiles.length} file(s). Review and approve to apply.`, 'assistant', { classes: ['summary'] });
      addAiLog(`AI staged ${staged.actions.length} change(s)`, 'info');
      setMainStatus('AI changes staged for review');
    } catch (error) {
      console.error('[Coder AI] generateAiEdits failed:', error);
      appendAiMessage(`AI error: ${error.message || error}`, 'error');
      addAiLog(`AI error: ${error.message || error}`, 'error');
      setMainStatus('AI request failed');
    }
  }

  function buildAiPlannerSystemInstruction() {
    return [
      'You are the Coder mini app AI planner for OM-X Browser.',
      'Return ONLY a JSON object for a function-call edit plan.',
      'Never return markdown fences unless absolutely necessary.',
      'Use these callable functions exactly: applyEdit, createFile, deleteFile, getFile, renameFile, listFiles.',
      'Prefer multiple small targeted applyEdit calls over full-file replacement.',
      `Do not use applyEdit with full-file replacement on files larger than ${MAX_EDIT_LINES} lines.`,
      'Use line-range edits or exact search selectors whenever possible.',
      'All mutating calls will be previewed and require user approval before applying.',
      'Output schema:',
      '{"message":"short summary","calls":[{"function":"applyEdit","arguments":{"filePath":"relative/or/absolute","rangeOrSelector":{"type":"line","startLine":1,"endLine":3},"newContent":"..."}}]}'
    ].join('\n');
  }

  async function buildWorkspaceSummaryForAI() {
    const active = state.activePath ? state.files.get(state.activePath) : null;
    const selected = state.selectedPath ? state.files.get(state.selectedPath) : null;
    const fileList = state.projectRoot ? await listFilesInDirectory(state.projectRoot, { recursive: true, maxFiles: MAX_FILE_LIST_FOR_AI }) : [];
    const openTabs = state.tabs.map((p) => ({
      path: p,
      relative: toProjectRelative(p) || p,
      dirty: Boolean(state.files.get(p)?.dirty)
    }));

    const activeText = active ? truncateText(active.content, Math.floor(MAX_AI_CONTEXT_CHARS * 0.7)) : '';
    const selectedText = selected && selected.path !== active?.path ? truncateText(selected.content, 6000) : '';

    return {
      projectRoot: state.projectRoot || null,
      selectedPath: state.selectedPath || null,
      activeFile: active ? {
        path: active.path,
        relativePath: toProjectRelative(active.path) || active.path,
        language: active.language,
        dirty: active.dirty,
        lineCount: countLines(active.content),
        content: activeText,
        contentTruncated: activeText.length < active.content.length
      } : null,
      selectedOpenFile: selected ? {
        path: selected.path,
        relativePath: toProjectRelative(selected.path) || selected.path,
        language: selected.language,
        content: selectedText,
        contentTruncated: selectedText.length < selected.content.length
      } : null,
      openTabs,
      workspaceFiles: fileList.map((p) => toProjectRelative(p) || p)
    };
  }

  function buildAiPlannerPrompt(userPrompt, summary) {
    const promptPayload = {
      userRequest: userPrompt,
      workspace: summary,
      constraints: {
        previewRequired: true,
        approvalRequired: true,
        incrementalEdits: true,
        callableFunctions: [...ALLOWED_AI_FUNCTIONS]
      },
      selectorGuidance: {
        preferred: [
          { type: 'line', shape: { type: 'line', startLine: 10, endLine: 14 } },
          { type: 'search', shape: { type: 'search', pattern: 'exact text to replace', occurrence: 1 } }
        ],
        fallback: { type: 'full', note: `Only for small files (<= ${MAX_EDIT_LINES} lines).` }
      }
    };
    return JSON.stringify(promptPayload, null, 2);
  }

  async function getActiveLlmConfig() {
    const settings = await api.settings?.get?.();
    const activeProvider = String(settings?.activeProvider || 'google').trim();
    const providerCfg = settings?.providers?.[activeProvider] || {};
    let baseUrl = String(providerCfg?.baseUrl || '').trim();
    if (!baseUrl) {
      if (activeProvider === 'lmstudio') baseUrl = String(settings?.aiConfig?.lmStudio?.baseUrl || '').trim();
      if (activeProvider === 'llamacpp') baseUrl = String(settings?.aiConfig?.llamacpp?.baseUrl || '').trim();
      if (activeProvider === 'openai-compatible') baseUrl = String(settings?.aiConfig?.openaiCompatible?.baseUrl || '').trim();
    }
    return {
      provider: activeProvider,
      key: String(providerCfg?.key || '').trim(),
      model: String(providerCfg?.model || '').trim(),
      baseUrl
    };
  }

  function parseAiPlanResponse(response) {
    const warnings = [];

    const nativeCalls = Array.isArray(response?.functionCalls)
      ? response.functionCalls.map((fc) => ({ function: fc?.name, arguments: fc?.args || {} }))
      : [];

    if (nativeCalls.length > 0) {
      const safeMessage = sanitizeAiVisiblePlanMessage(response?.text || '');
      return {
        message: safeMessage || summarizeAiCallsForChat(nativeCalls),
        calls: nativeCalls,
        warnings
      };
    }

    const raw = String(response?.text || '').trim();
    const parsed = parseJsonLoose(raw);
    if (!parsed) return null;

    let calls = [];
    let message = '';
    if (Array.isArray(parsed)) {
      calls = parsed;
    } else {
      message = sanitizeAiVisiblePlanMessage(parsed.message || parsed.summary || '');
      calls = parsed.calls || parsed.actions || parsed.toolCalls || [];
      if (!Array.isArray(calls) && Array.isArray(parsed.functionCalls)) {
        calls = parsed.functionCalls;
      }
    }

    const normalizedCalls = [];
    for (const call of Array.isArray(calls) ? calls : []) {
      if (!call) continue;
      if (typeof call === 'string') continue;
      const fn = String(call.function || call.name || '').trim();
      const args = call.arguments || call.args || {};
      if (!fn) continue;
      normalizedCalls.push({ function: fn, arguments: args });
    }

    if (!message && raw && normalizedCalls.length === 0) {
      warnings.push('AI returned JSON but no executable calls were found.');
    }

    if (!message && normalizedCalls.length > 0) {
      message = summarizeAiCallsForChat(normalizedCalls);
    }

    return { message, calls: normalizedCalls, warnings };
  }

  async function stageAiCalls(calls) {
    const actions = [];
    const errors = [];
    const readLogs = [];
    const simulator = createWorkspaceSimulator();

    for (const rawCall of calls) {
      const fn = String(rawCall?.function || rawCall?.name || '').trim();
      if (!ALLOWED_AI_FUNCTIONS.has(fn)) {
        errors.push(`Unsupported AI function "${fn}"`);
        continue;
      }

      try {
        if (fn === 'getFile') {
          const target = resolveWorkspacePath(rawCall.arguments?.path || rawCall.arguments?.filePath || '');
          if (!target) throw new Error('getFile requires path');
          if (!isPathAllowed(target)) throw new Error('getFile path is outside project scope');
          const content = await simulator.readFile(target);
          if (content == null) throw new Error(`File not found: ${toProjectRelative(target) || target}`);
          readLogs.push(`AI getFile ${toProjectRelative(target) || target} (${countLines(content)} lines)`);
          continue;
        }

        if (fn === 'listFiles') {
          const targetDir = resolveWorkspacePath(rawCall.arguments?.directory || rawCall.arguments?.path || state.projectRoot || '');
          if (!targetDir) throw new Error('listFiles requires directory or open project');
          if (!isPathAllowed(targetDir)) throw new Error('listFiles directory is outside project scope');
          const files = await listFilesInDirectory(targetDir, { recursive: true, maxFiles: 120 });
          readLogs.push(`AI listFiles ${toProjectRelative(targetDir) || targetDir} -> ${files.length} file(s)`);
          continue;
        }

        if (fn === 'applyEdit') {
          const staged = await stageApplyEdit(rawCall.arguments || {}, simulator);
          actions.push(staged);
          continue;
        }

        if (fn === 'createFile') {
          const staged = await stageCreateFile(rawCall.arguments || {}, simulator);
          actions.push(staged);
          continue;
        }

        if (fn === 'deleteFile') {
          const staged = await stageDeleteFile(rawCall.arguments || {}, simulator);
          actions.push(staged);
          continue;
        }

        if (fn === 'renameFile') {
          const staged = await stageRenameFile(rawCall.arguments || {}, simulator);
          actions.push(staged);
          continue;
        }
      } catch (error) {
        const fnLabel = fn || 'unknown';
        errors.push(`${fnLabel}: ${error.message || error}`);
      }
    }

    return { actions, errors, readLogs };
  }

  function createWorkspaceSimulator() {
    const fileCache = new Map();
    const deleted = new Set();
    const renames = new Map();
    const created = new Set();

    const resolveCurrentPath = (path) => {
      const normalized = normalizePath(path);
      for (const [from, to] of renames.entries()) {
        if (normalized === from) return to;
        if (isSameOrSubPath(normalized, from)) {
          return normalizePath(`${to}${normalized.slice(from.length)}`);
        }
      }
      return normalized;
    };

    return {
      async readFile(path) {
        let resolved = resolveCurrentPath(path);
        if (deleted.has(resolved)) return null;
        if (fileCache.has(resolved)) return fileCache.get(resolved);
        if (state.files.has(resolved)) {
          const content = state.files.get(resolved).content;
          fileCache.set(resolved, content);
          return content;
        }
        const content = await api.files?.read?.(resolved);
        if (typeof content !== 'string') return null;
        fileCache.set(resolved, content);
        return content;
      },
      async existsFile(path) {
        const resolved = resolveCurrentPath(path);
        if (deleted.has(resolved)) return false;
        if (fileCache.has(resolved)) return true;
        if (state.files.has(resolved)) return true;
        const stat = await api.files?.stat?.(resolved);
        return Boolean(stat?.exists && stat.isFile);
      },
      setFile(path, content) {
        const resolved = resolveCurrentPath(path);
        deleted.delete(resolved);
        fileCache.set(resolved, String(content ?? ''));
        created.add(resolved);
      },
      deleteFile(path) {
        const resolved = resolveCurrentPath(path);
        deleted.add(resolved);
        fileCache.delete(resolved);
      },
      renameFile(oldPath, newPath) {
        const oldResolved = resolveCurrentPath(oldPath);
        const newResolved = normalizePath(newPath);
        const content = fileCache.has(oldResolved)
          ? fileCache.get(oldResolved)
          : (state.files.get(oldResolved)?.content);
        if (typeof content === 'string') fileCache.set(newResolved, content);
        fileCache.delete(oldResolved);
        deleted.add(oldResolved);
        renames.set(oldResolved, newResolved);
      }
    };
  }

  async function stageApplyEdit(args, simulator) {
    const filePath = resolveWorkspacePath(args.filePath || args.path || '');
    if (!filePath) throw new Error('applyEdit requires filePath');
    if (!isPathAllowed(filePath)) throw new Error('applyEdit target is outside project scope');

    const current = await simulator.readFile(filePath);
    if (typeof current !== 'string') throw new Error(`File not found: ${toProjectRelative(filePath) || filePath}`);

    const selector = args.rangeOrSelector ?? args.range ?? args.selector ?? null;
    const replacement = String(args.newContent ?? '');
    const resolved = resolveEditRange(current, selector);

    const beforeLineCount = countLines(current.slice(resolved.start, resolved.end));
    if (resolved.kind === 'full' && countLines(current) > MAX_EDIT_LINES) {
      throw new Error(`Full-file overwrite blocked for files > ${MAX_EDIT_LINES} lines`);
    }
    if (beforeLineCount > MAX_EDIT_LINES && resolved.kind !== 'search') {
      throw new Error(`Edit range too large (${beforeLineCount} lines). Split into smaller edits.`);
    }

    const next = `${current.slice(0, resolved.start)}${replacement}${current.slice(resolved.end)}`;
    simulator.setFile(filePath, next);

    const afterStart = resolved.start;
    const afterEnd = resolved.start + replacement.length;
    const lineRange = rangeToLineRange(next, afterStart, afterEnd);

    return {
      type: 'applyEdit',
      filePath,
      selector,
      resolvedRange: resolved,
      newContent: replacement,
      beforeFull: current,
      afterFull: next,
      beforePreview: previewAroundRange(current, resolved.start, resolved.end),
      afterPreview: previewAroundRange(next, afterStart, afterEnd),
      summary: `${toProjectRelative(filePath) || filePath} (${resolved.label})`,
      lineRange
    };
  }

  async function stageCreateFile(args, simulator) {
    const filePath = resolveWorkspacePath(args.path || args.filePath || '');
    if (!filePath) throw new Error('createFile requires path');
    if (!isPathAllowed(filePath)) throw new Error('createFile target is outside project scope');
    const exists = await simulator.existsFile(filePath);
    if (exists) throw new Error(`File already exists: ${toProjectRelative(filePath) || filePath}`);
    const content = String(args.content ?? '');
    simulator.setFile(filePath, content);

    return {
      type: 'createFile',
      filePath,
      content,
      beforePreview: '(new file)',
      afterPreview: truncateText(content, 1200),
      summary: `${toProjectRelative(filePath) || filePath}`
    };
  }

  async function stageDeleteFile(args, simulator) {
    const filePath = resolveWorkspacePath(args.path || args.filePath || '');
    if (!filePath) throw new Error('deleteFile requires path');
    if (!isPathAllowed(filePath)) throw new Error('deleteFile target is outside project scope');
    const current = await simulator.readFile(filePath);
    if (typeof current !== 'string') throw new Error(`File not found: ${toProjectRelative(filePath) || filePath}`);
    simulator.deleteFile(filePath);

    return {
      type: 'deleteFile',
      filePath,
      beforePreview: truncateText(current, 1200),
      afterPreview: '(deleted)',
      summary: `${toProjectRelative(filePath) || filePath}`
    };
  }

  async function stageRenameFile(args, simulator) {
    const oldPath = resolveWorkspacePath(args.oldPath || args.from || '');
    const newPath = resolveWorkspacePath(args.newPath || args.to || '');
    if (!oldPath || !newPath) throw new Error('renameFile requires oldPath and newPath');
    if (!isPathAllowed(oldPath) || !isPathAllowed(newPath)) throw new Error('renameFile path is outside project scope');
    const exists = await simulator.existsFile(oldPath);
    if (!exists) throw new Error(`Source file not found: ${toProjectRelative(oldPath) || oldPath}`);
    const targetExists = await simulator.existsFile(newPath);
    if (targetExists) throw new Error(`Target already exists: ${toProjectRelative(newPath) || newPath}`);
    simulator.renameFile(oldPath, newPath);

    return {
      type: 'renameFile',
      oldPath,
      newPath,
      beforePreview: toProjectRelative(oldPath) || oldPath,
      afterPreview: toProjectRelative(newPath) || newPath,
      summary: `${toProjectRelative(oldPath) || oldPath} -> ${toProjectRelative(newPath) || newPath}`
    };
  }

  function renderPendingAi() {
    const batch = state.pendingAiBatch;
    const hasPending = Boolean(batch && Array.isArray(batch.actions) && batch.actions.length > 0);
    els['ai-pending']?.classList.toggle('hidden', !hasPending);
    if (!hasPending) {
      if (els['pending-list']) els['pending-list'].innerHTML = '';
      if (els['pending-meta']) els['pending-meta'].textContent = 'Review before applying';
      return;
    }

    const files = new Set();
    batch.actions.forEach((a) => {
      if (a.filePath) files.add(a.filePath);
      if (a.oldPath) files.add(a.oldPath);
      if (a.newPath) files.add(a.newPath);
    });
    if (els['pending-meta']) {
      els['pending-meta'].textContent = `${batch.actions.length} change(s) \u2022 ${files.size} file(s) \u2022 Review before applying`;
    }

    if (!els['pending-list']) return;
    els['pending-list'].innerHTML = '';
    batch.actions.forEach((action, index) => {
      const item = document.createElement('div');
      item.className = 'pending-item';

      const summary = document.createElement('div');
      summary.className = 'pending-summary';
      const label = document.createElement('span');
      label.textContent = `${index + 1}. ${action.type}`;
      const code = document.createElement('code');
      code.textContent = action.summary || '';
      summary.appendChild(label);
      summary.appendChild(code);
      item.appendChild(summary);

      const diff = document.createElement('div');
      diff.className = 'diff-grid';

      const beforeBlock = document.createElement('div');
      beforeBlock.className = 'diff-block before';
      beforeBlock.innerHTML = `<header>Before</header><pre>${escapeHtml(String(action.beforePreview ?? ''))}</pre>`;
      diff.appendChild(beforeBlock);

      const afterBlock = document.createElement('div');
      afterBlock.className = 'diff-block after';
      afterBlock.innerHTML = `<header>After</header><pre>${escapeHtml(String(action.afterPreview ?? ''))}</pre>`;
      diff.appendChild(afterBlock);

      item.appendChild(diff);
      els['pending-list'].appendChild(item);
    });
  }

  async function approvePendingAiChanges() {
    const batch = state.pendingAiBatch;
    if (!batch?.actions?.length) return;
    setMainStatus('Applying AI changes...');
    appendAiCliStep(`Applying ${batch.actions.length} staged change(s)`, 'running');

    const writer = api.files?.write || ((path, content) => api.files?.createFile?.(path, content));
    if (!writer) {
      showToast('Write API unavailable', 'error');
      return;
    }

    try {
      const touchedPaths = new Set();
      let firstHighlight = null;

      for (const action of batch.actions) {
        if (action.type === 'applyEdit') {
          const ok = await writer(action.filePath, action.afterFull);
          if (!ok) throw new Error(`Failed to write ${toProjectRelative(action.filePath) || action.filePath}`);

          let file = state.files.get(action.filePath);
          if (!file) {
            await openFile(action.filePath, { silent: true });
            file = state.files.get(action.filePath);
          }
          if (file) {
            recordRevision(file, {
              reason: 'ai-applyEdit',
              beforeContent: file.content,
              afterContent: action.afterFull
            });
            file.content = action.afterFull;
            file.savedContent = action.afterFull;
            file.dirty = false;
            file.language = detectLanguage(action.filePath);
            setTemporaryAiLineHighlight(file, action.lineRange);
            if (!firstHighlight) firstHighlight = { filePath: action.filePath, lineRange: action.lineRange };
          }
          touchedPaths.add(action.filePath);
          addAiLog(`AI applyEdit ${toProjectRelative(action.filePath) || action.filePath}`, 'info');
          continue;
        }

        if (action.type === 'createFile') {
          const ok = await writer(action.filePath, action.content);
          if (!ok) throw new Error(`Failed to create ${toProjectRelative(action.filePath) || action.filePath}`);

          await openFile(action.filePath, { content: action.content, savedContent: action.content, dirty: false, activate: false, silent: true });
          touchedPaths.add(action.filePath);
          addAiLog(`AI createFile ${toProjectRelative(action.filePath) || action.filePath}`, 'info');
          if (!firstHighlight) firstHighlight = { filePath: action.filePath, lineRange: { startLine: 1, endLine: Math.max(1, countLines(action.content)) } };
          continue;
        }

        if (action.type === 'deleteFile') {
          const ok = await api.files?.deletePath?.(action.filePath);
          if (!ok) throw new Error(`Failed to delete ${toProjectRelative(action.filePath) || action.filePath}`);
          removeStatePathsAfterDelete(action.filePath);
          touchedPaths.add(action.filePath);
          addAiLog(`AI deleteFile ${toProjectRelative(action.filePath) || action.filePath}`, 'info');
          continue;
        }

        if (action.type === 'renameFile') {
          const ok = await api.files?.renamePath?.(action.oldPath, action.newPath);
          if (!ok) throw new Error(`Failed to rename ${toProjectRelative(action.oldPath) || action.oldPath}`);
          updateStatePathsAfterRename(action.oldPath, action.newPath);
          touchedPaths.add(action.oldPath);
          touchedPaths.add(action.newPath);
          addAiLog(`AI renameFile ${toProjectRelative(action.oldPath) || action.oldPath} -> ${toProjectRelative(action.newPath) || action.newPath}`, 'info');
          if (!firstHighlight) firstHighlight = { filePath: action.newPath, lineRange: null };
          continue;
        }
      }

      state.pendingAiBatch = null;
      renderPendingAi();
      renderTabs();
      renderEditorShell();
      await refreshTree();

      if (firstHighlight?.filePath) {
        activateTab(firstHighlight.filePath);
        if (firstHighlight.lineRange) {
          selectEditorLines(firstHighlight.lineRange.startLine, firstHighlight.lineRange.endLine);
          flashEditorChange();
        }
      }

      setMainStatus(`Applied ${batch.actions.length} AI change(s)`);
      appendAiCliStep(`Applied ${batch.actions.length} change(s) successfully`, 'done');
      showToast('AI changes applied', 'success');
      scheduleSessionSave();
    } catch (error) {
      console.error('[Coder AI] apply failed:', error);
      appendAiCliStep('Apply failed', 'error');
      appendAiMessage(`Failed to apply staged changes: ${error.message || error}`, 'error');
      addAiLog(`AI apply failed: ${error.message || error}`, 'error');
      setMainStatus('AI apply failed');
      showToast('AI apply failed', 'error');
    }
  }

  function rejectPendingAiChanges() {
    if (!state.pendingAiBatch?.actions?.length) return;
    const count = state.pendingAiBatch.actions.length;
    state.pendingAiBatch = null;
    renderPendingAi();
    addAiLog(`Rejected ${count} staged AI change(s)`, 'warn');
    appendAiCliStep(`Discarded ${count} staged change(s)`, 'warn');
    appendAiMessage(`Rejected ${count} staged change(s).`, 'assistant');
    setMainStatus('AI changes rejected');
  }

  function setTemporaryAiLineHighlight(file, lineRange) {
    if (!file || !lineRange) return;
    file.lastAiLineRange = {
      startLine: Math.max(1, lineRange.startLine || 1),
      endLine: Math.max(lineRange.startLine || 1, lineRange.endLine || lineRange.startLine || 1),
      expiresAt: Date.now() + 3200
    };
    if (file.path === state.activePath) renderLineNumbers();
    setTimeout(() => {
      const current = state.files.get(file.path);
      if (!current?.lastAiLineRange) return;
      if (current.lastAiLineRange.expiresAt <= Date.now()) {
        current.lastAiLineRange = null;
        if (current.path === state.activePath) renderLineNumbers();
      }
    }, 3400);
  }

  function selectEditorLines(startLine, endLine) {
    const file = state.activePath ? state.files.get(state.activePath) : null;
    const textarea = els['code-input'];
    if (!file || !textarea) return;
    const start = offsetFromLine(file.content, startLine);
    const end = offsetFromLine(file.content, endLine + 1);
    textarea.focus();
    textarea.selectionStart = start;
    textarea.selectionEnd = end;
    updateCursorStatus();
  }

  function flashEditorChange() {
    if (!els['code-stack']) return;
    els['code-stack'].classList.remove('flash-change');
    // force reflow
    void els['code-stack'].offsetWidth;
    els['code-stack'].classList.add('flash-change');
    setTimeout(() => els['code-stack']?.classList.remove('flash-change'), 900);
  }

  async function restoreSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;
      state.explorerOpen = data.explorerOpen !== false;
      state.sidePanelMode = ['explorer', 'search', 'source', 'run'].includes(String(data.sidePanelMode || ''))
        ? String(data.sidePanelMode)
        : 'explorer';
      state.sidePanelWidths = { ...DEFAULT_SIDE_PANEL_WIDTHS };
      if (data.sidePanelWidths && typeof data.sidePanelWidths === 'object') {
        SIDE_PANEL_MODES.forEach((mode) => {
          const value = Number(data.sidePanelWidths[mode]);
          if (!Number.isFinite(value) || value <= 0) return;
          state.sidePanelWidths[mode] = clamp(value, 210, 900);
        });
      }
      if (data.sourceControlDrafts && typeof data.sourceControlDrafts === 'object' && state.sourceControl) {
        const drafts = data.sourceControlDrafts;
        state.sourceControl.userNameDraft = String(drafts.userName || '').trim();
        state.sourceControl.userEmailDraft = String(drafts.userEmail || '').trim();
        state.sourceControl.remoteUrlDraft = String(drafts.remoteUrl || '').trim();
        state.sourceControl.branchDraft = String(drafts.branch || '').trim() || 'main';
        state.sourceControl.commitMessage = String(drafts.commitMessage || '');
      }
      if (data.searchPanel && typeof data.searchPanel === 'object') {
        const saved = data.searchPanel;
        const sp = ensureSearchPanelState();
        sp.query = String(saved.query || '');
        sp.replaceQuery = String(saved.replaceQuery || '');
        sp.showReplace = Boolean(saved.showReplace);
        sp.includePattern = String(saved.includePattern || '');
        sp.excludePattern = String(saved.excludePattern || '');
        sp.matchCase = Boolean(saved.matchCase);
        sp.wholeWord = Boolean(saved.wholeWord);
        sp.useRegex = Boolean(saved.useRegex);
      }
      if (data.runPanel && typeof data.runPanel === 'object') {
        const run = data.runPanel;
        const rp = ensureRunPanelState();
        rp.configId = String(run.configId || rp.configId || 'auto').trim() || 'auto';
        rp.consoleMode = ['integratedTerminal', 'internalConsole', 'externalTerminal'].includes(String(run.consoleMode || ''))
          ? String(run.consoleMode)
          : rp.consoleMode;
        rp.stopOnEntry = Boolean(run.stopOnEntry);
        rp.autoSaveBeforeRun = run.autoSaveBeforeRun !== false;
        rp.lastDebugUrl = String(run.lastDebugUrl || '');
        if (run.sectionExpanded && typeof run.sectionExpanded === 'object') {
          rp.sectionExpanded.variables = run.sectionExpanded.variables !== false;
          rp.sectionExpanded.watch = Boolean(run.sectionExpanded.watch);
          rp.sectionExpanded.callStack = run.sectionExpanded.callStack !== false;
          rp.sectionExpanded.breakpoints = run.sectionExpanded.breakpoints !== false;
        }
      }
      state.coderSettings = normalizeCoderSettings(data.coderSettings || DEFAULT_CODER_SETTINGS);
      state.coderSettingsOpen = false;
      {
        const h = Number(data.coderTerminalHeight);
        if (Number.isFinite(h) && h > 0) getCoderTerminalState().panelHeight = clamp(h, 160, 900);
      }
      state.aiSidebarWidth = clamp(Number(data.aiSidebarWidth) || 480, 280, 900);
      state.aiOpen = false;
      state.aiLog = [];
      renderSidePanelMode();
      renderWorkspaceLayout();
      renderAiSidebar();
      renderAiLog();
      setMainStatus('Ready');
      if (state.sidePanelMode === 'source' && state.explorerOpen !== false) {
        void refreshSourceControlState({ silent: true });
      }
    } catch (error) {
      console.warn('[Coder] Failed to restore session:', error);
      setMainStatus('Ready');
    }
  }

  function scheduleSessionSave() {
    clearTimeout(state.sessionSaveTimer);
    state.sessionSaveTimer = setTimeout(saveSession, 250);
  }

  function saveSession() {
    try {
      const sp = ensureSearchPanelState();
      const rp = ensureRunPanelState();
      const snapshot = {
        projectRoot: state.projectRoot || '',
        expandedDirs: [...state.expandedDirs],
        tabs: [...state.tabs],
        activePath: state.activePath || '',
        selectedPath: state.selectedPath || '',
        explorerOpen: state.explorerOpen !== false,
        sidePanelMode: state.sidePanelMode || 'explorer',
        sidePanelWidths: { ...(state.sidePanelWidths || DEFAULT_SIDE_PANEL_WIDTHS) },
        searchPanel: {
          query: String(sp.query || ''),
          replaceQuery: String(sp.replaceQuery || ''),
          showReplace: Boolean(sp.showReplace),
          includePattern: String(sp.includePattern || ''),
          excludePattern: String(sp.excludePattern || ''),
          matchCase: Boolean(sp.matchCase),
          wholeWord: Boolean(sp.wholeWord),
          useRegex: Boolean(sp.useRegex)
        },
        runPanel: {
          configId: String(rp.configId || 'auto'),
          consoleMode: String(rp.consoleMode || 'integratedTerminal'),
          stopOnEntry: Boolean(rp.stopOnEntry),
          autoSaveBeforeRun: rp.autoSaveBeforeRun !== false,
          lastDebugUrl: String(rp.lastDebugUrl || ''),
          sectionExpanded: {
            variables: rp.sectionExpanded.variables !== false,
            watch: Boolean(rp.sectionExpanded.watch),
            callStack: rp.sectionExpanded.callStack !== false,
            breakpoints: rp.sectionExpanded.breakpoints !== false
          }
        },
        coderSettings: { ...normalizeCoderSettings(state.coderSettings || DEFAULT_CODER_SETTINGS) },
        coderTerminalHeight: Math.round(Number(getCoderTerminalState().panelHeight) || 300),
        sourceControlDrafts: {
          userName: String(state.sourceControl?.userNameDraft || ''),
          userEmail: String(state.sourceControl?.userEmailDraft || ''),
          remoteUrl: String(state.sourceControl?.remoteUrlDraft || ''),
          branch: String(state.sourceControl?.branchDraft || ''),
          commitMessage: String(state.sourceControl?.commitMessage || '')
        },
        aiSidebarWidth: Number(state.aiSidebarWidth) || 480,
        aiOpen: state.aiOpen,
        aiLog: state.aiLog.slice(0, MAX_AI_LOG_ITEMS)
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    } catch (_) {
      // best effort
    }
  }

  function handleGlobalShortcuts(event) {
    if (isCoderDialogOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCoderDialog({ confirmed: false });
      }
      return;
    }

    const target = event.target;
    const inAiPrompt = target === els['ai-prompt'];
    const inTerminalInput = target === els['coder-terminal-input'];
    const inRunResultInput = target === els['coder-run-result-input'];
    const key = String(event.key || '').toLowerCase();

    if (isCoderTerminalPanelOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        toggleCoderTerminalPanel(false);
        return;
      }
      if (inTerminalInput) {
        if ((event.ctrlKey || event.metaKey) && key === 'l') {
          event.preventDefault();
          clearCoderTerminalOutput();
          return;
        }
        return;
      }
    }

    if (isCoderRunResultPanelOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        toggleCoderRunResultPanel(false);
        return;
      }
      if (inRunResultInput) {
        return;
      }
    }

    if (isCoderSettingsPanelOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        toggleCoderSettingsPanel(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        saveCoderSettingsPanel();
        return;
      }
      return;
    }

    if (!event.ctrlKey && !event.metaKey && event.altKey && key === 'p') {
      event.preventDefault();
      toggleEditorDiagnosticsPopup();
      return;
    }

    if (event.key === 'Escape' && ensureEditorDiagnosticsPopupState().open) {
      event.preventDefault();
      closeEditorDiagnosticsPopup();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault();
      if (event.shiftKey) void saveAllFiles();
      else void saveActiveFile();
      return;
    }

    if (!inAiPrompt && (event.ctrlKey || event.metaKey) && key === 'o') {
      event.preventDefault();
      if (event.shiftKey) void openFolderViaDialog();
      else void openFileViaDialog();
      return;
    }

    if (!inAiPrompt && event.key === 'F5') {
      event.preventDefault();
      void runActiveFile();
      return;
    }

    if (!inAiPrompt && (event.ctrlKey || event.metaKey) && key === 'k') {
      event.preventDefault();
      toggleAiSidebar();
      return;
    }

    if (!inAiPrompt && (event.ctrlKey || event.metaKey) && key === '`') {
      event.preventDefault();
      void openCoderTerminalPanel();
      return;
    }

    if (!inAiPrompt && (event.ctrlKey || event.metaKey) && key === 'b') {
      event.preventDefault();
      toggleExplorerPane();
    }
  }

  function setMainStatus(text) {
    if (els['status-main']) els['status-main'].textContent = String(text || 'Ready');
  }

  function setFileStatus(text) {
    if (els['status-file']) els['status-file'].textContent = String(text || 'No file');
  }

  function setLanguageStatus(text) {
    if (els['status-language']) els['status-language'].textContent = String(text || 'Plain Text');
  }

  function showToast(text, type = 'success') {
    if (!els['toast']) return;
    clearTimeout(state.toastTimer);
    els['toast'].textContent = String(text || '');
    els['toast'].className = `toast ${type}`;
    els['toast'].classList.add('show');
    state.toastTimer = setTimeout(() => {
      els['toast']?.classList.remove('show');
    }, 2400);
  }

  function updateExplorerActionButtons() {
    const canCreate = Boolean(state.projectRoot || state.activePath);
    const canMutateSelection = Boolean(state.selectedPath || state.activePath);

    if (els['btn-new-file']) els['btn-new-file'].disabled = !canCreate;
    if (els['btn-new-folder']) els['btn-new-folder'].disabled = !canCreate;
    if (els['btn-rename-path']) els['btn-rename-path'].disabled = !canMutateSelection;
    if (els['btn-delete-path']) els['btn-delete-path'].disabled = !canMutateSelection;
  }

  function isCoderDialogOpen() {
    return Boolean(els['coder-dialog'] && !els['coder-dialog'].classList.contains('hidden'));
  }

  function syncCoderDialogConfirmState() {
    const confirmBtn = els['btn-coder-dialog-confirm'];
    const inputEl = els['coder-dialog-input'];
    if (!confirmBtn || !inputEl || inputEl.classList.contains('hidden')) return;
    confirmBtn.disabled = !String(inputEl.value || '').trim();
  }

  function handleCoderDialogInputKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCoderDialog({ confirmed: false });
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      closeCoderDialog({ confirmed: true });
    }
  }

  function closeCoderDialog(result = { confirmed: false }) {
    if (!state.dialogResolver) return;
    const resolver = state.dialogResolver;
    state.dialogResolver = null;

    const dialogEl = els['coder-dialog'];
    if (dialogEl) {
      dialogEl.classList.add('hidden');
      dialogEl.setAttribute('aria-hidden', 'true');
    }

    const inputEl = els['coder-dialog-input'];
    const payload = {
      confirmed: Boolean(result?.confirmed),
      value: inputEl && !inputEl.classList.contains('hidden') ? String(inputEl.value || '') : ''
    };

    const restoreEl = state.dialogRestoreFocus;
    state.dialogRestoreFocus = null;
    try {
      resolver(payload);
    } finally {
      try { restoreEl?.focus?.(); } catch (_) {}
    }
  }

  async function openCoderDialog(options = {}) {
    const dialogEl = els['coder-dialog'];
    const titleEl = els['coder-dialog-title'];
    const bodyEl = els['coder-dialog-body'];
    const inputEl = els['coder-dialog-input'];
    const confirmBtn = els['btn-coder-dialog-confirm'];
    const cancelBtn = els['btn-coder-dialog-cancel'];

    if (!dialogEl || !titleEl || !bodyEl || !inputEl || !confirmBtn || !cancelBtn) {
      return { confirmed: false, value: '' };
    }

    if (state.dialogResolver) closeCoderDialog({ confirmed: false });

    const mode = options.mode === 'confirm' ? 'confirm' : 'prompt';
    titleEl.textContent = String(options.title || 'Action');
    bodyEl.textContent = String(options.message || '');
    confirmBtn.textContent = String(options.confirmLabel || 'OK');
    cancelBtn.textContent = String(options.cancelLabel || 'Cancel');
    confirmBtn.classList.toggle('danger', Boolean(options.danger));
    confirmBtn.classList.toggle('primary', !options.danger);

    if (mode === 'confirm') {
      inputEl.classList.add('hidden');
      inputEl.value = '';
      confirmBtn.disabled = false;
    } else {
      inputEl.classList.remove('hidden');
      inputEl.value = String(options.value ?? '');
      inputEl.placeholder = String(options.placeholder || '');
      syncCoderDialogConfirmState();
    }

    state.dialogRestoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogEl.classList.remove('hidden');
    dialogEl.setAttribute('aria-hidden', 'false');

    const focusTarget = mode === 'confirm' ? confirmBtn : inputEl;
    queueMicrotask(() => {
      try {
        focusTarget.focus();
        if (focusTarget === inputEl) inputEl.setSelectionRange(0, inputEl.value.length);
      } catch (_) {}
    });

    return new Promise((resolve) => {
      state.dialogResolver = resolve;
    });
  }

  async function promptExplorerInput(options = {}) {
    if (!els['coder-dialog']) {
      try {
        return window.prompt(String(options.message || ''), String(options.value ?? ''));
      } catch (_) {
        return null;
      }
    }
    const result = await openCoderDialog({ ...options, mode: 'prompt' });
    if (!result?.confirmed) return null;
    const value = String(result.value || '').trim();
    return value || null;
  }

  async function confirmExplorerAction(options = {}) {
    if (!els['coder-dialog']) {
      try {
        return Boolean(window.confirm(String(options.message || 'Are you sure?')));
      } catch (_) {
        return false;
      }
    }
    const result = await openCoderDialog({ ...options, mode: 'confirm' });
    return Boolean(result?.confirmed);
  }

  function hasDirtyFiles() {
    for (const file of state.files.values()) {
      if (file.dirty) return true;
    }
    return false;
  }

  function updateStatePathsAfterRename(oldPath, newPath) {
    const oldN = normalizePath(oldPath);
    const newN = normalizePath(newPath);
    if (!oldN || !newN) return;

    const replacements = [];
    for (const tabPath of [...state.tabs]) {
      if (tabPath === oldN || isSameOrSubPath(tabPath, oldN)) {
        const next = normalizePath(`${newN}${tabPath.slice(oldN.length)}`);
        replacements.push([tabPath, next]);
      }
    }

    replacements.forEach(([prev, next]) => {
      const file = state.files.get(prev);
      if (file) {
        state.files.delete(prev);
        file.path = next;
        file.language = detectLanguage(next);
        state.files.set(next, file);
      }
      const idx = state.tabs.indexOf(prev);
      if (idx >= 0) state.tabs[idx] = next;
      if (state.activePath === prev) state.activePath = next;
      if (state.selectedPath === prev || isSameOrSubPath(state.selectedPath, prev)) {
        state.selectedPath = normalizePath(`${next}${state.selectedPath.slice(prev.length)}`);
      }
    });

    const nextExpanded = new Set();
    state.expandedDirs.forEach((path) => {
      if (path === oldN || isSameOrSubPath(path, oldN)) {
        nextExpanded.add(normalizePath(`${newN}${path.slice(oldN.length)}`));
      } else {
        nextExpanded.add(path);
      }
    });
    state.expandedDirs = nextExpanded;
  }

  function removeStatePathsAfterDelete(targetPath) {
    const target = normalizePath(targetPath);
    if (!target) return;

    const toClose = state.tabs.filter((p) => p === target || isSameOrSubPath(p, target));
    toClose.forEach((p) => {
      state.files.delete(p);
    });
    state.tabs = state.tabs.filter((p) => !(p === target || isSameOrSubPath(p, target)));

    if (state.activePath && (state.activePath === target || isSameOrSubPath(state.activePath, target))) {
      state.activePath = state.tabs[0] || '';
    }
    if (state.selectedPath && (state.selectedPath === target || isSameOrSubPath(state.selectedPath, target))) {
      state.selectedPath = state.projectRoot && state.projectRoot !== target ? state.projectRoot : '';
    }

    const nextExpanded = new Set();
    state.expandedDirs.forEach((p) => {
      if (!(p === target || isSameOrSubPath(p, target))) nextExpanded.add(p);
    });
    state.expandedDirs = nextExpanded;
  }

  async function listFilesInDirectory(dirPath, options = {}) {
    const recursive = options.recursive !== false;
    const maxFiles = Number(options.maxFiles || 120);
    const out = [];

    async function walk(current, depth) {
      if (out.length >= maxFiles) return;
      const names = await api.files?.readDir?.(current);
      if (!Array.isArray(names)) return;
      const sorted = [...names].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }));
      for (const name of sorted) {
        if (out.length >= maxFiles) break;
        if (!name || name === '.' || name === '..') continue;
        const full = joinPath(current, name);
        const stat = await api.files?.stat?.(full);
        if (!stat?.exists) continue;
        if (stat.isDirectory) {
          if (TREE_IGNORED_DIRS.has(String(name))) continue;
          if (recursive) await walk(full, depth + 1);
        } else if (stat.isFile) {
          out.push(normalizePath(full));
        }
      }
    }

    const root = normalizePath(dirPath);
    if (!root) return [];
    await walk(root, 0);
    return out;
  }

  function resolveEditRange(content, rangeOrSelector) {
    const text = String(content ?? '');
    if (rangeOrSelector == null || rangeOrSelector === '') {
      return { start: 0, end: text.length, kind: 'full', label: 'full file (default)' };
    }

    if (typeof rangeOrSelector === 'string') {
      const raw = rangeOrSelector.trim();
      if (!raw || raw.toLowerCase() === 'full') {
        return { start: 0, end: text.length, kind: 'full', label: 'full file' };
      }
      const lineMatch = raw.match(/^lines?\s*:\s*(\d+)\s*-\s*(\d+)$/i);
      if (lineMatch) {
        const startLine = Number(lineMatch[1]);
        const endLine = Number(lineMatch[2]);
        return resolveLineRange(text, startLine, endLine);
      }
      const searchMatch = raw.match(/^search\s*:\s*([\s\S]+)$/i);
      if (searchMatch) {
        return resolveSearchRange(text, { pattern: searchMatch[1], occurrence: 1 });
      }
      throw new Error(`Unsupported selector string: ${raw}`);
    }

    if (typeof rangeOrSelector === 'object') {
      const type = String(rangeOrSelector.type || '').toLowerCase();
      if (!type || type === 'full') {
        return { start: 0, end: text.length, kind: 'full', label: 'full file' };
      }
      if (type === 'line' || type === 'lines') {
        return resolveLineRange(text, Number(rangeOrSelector.startLine), Number(rangeOrSelector.endLine ?? rangeOrSelector.startLine));
      }
      if (type === 'search' || type === 'selector') {
        return resolveSearchRange(text, {
          pattern: String(rangeOrSelector.pattern ?? ''),
          occurrence: Number(rangeOrSelector.occurrence || 1)
        });
      }
    }

    throw new Error('Unsupported rangeOrSelector format');
  }

  function resolveLineRange(content, startLine, endLine) {
    const total = countLines(content);
    if (!Number.isFinite(startLine) || startLine < 1) throw new Error('Invalid startLine');
    if (!Number.isFinite(endLine) || endLine < startLine) throw new Error('Invalid endLine');
    const safeStart = clamp(Math.floor(startLine), 1, total);
    const safeEnd = clamp(Math.floor(endLine), safeStart, total);
    const start = offsetFromLine(content, safeStart);
    const end = offsetFromLine(content, safeEnd + 1);
    return {
      start,
      end,
      kind: 'line',
      label: `lines ${safeStart}-${safeEnd}`,
      startLine: safeStart,
      endLine: safeEnd
    };
  }

  function resolveSearchRange(content, { pattern, occurrence }) {
    const needle = String(pattern ?? '');
    if (!needle) throw new Error('Search selector requires pattern');
    let index = -1;
    let from = 0;
    let remaining = Math.max(1, Math.floor(occurrence || 1));
    while (remaining > 0) {
      index = content.indexOf(needle, from);
      if (index < 0) break;
      from = index + needle.length;
      remaining -= 1;
    }
    if (index < 0) throw new Error('Search pattern not found');
    return {
      start: index,
      end: index + needle.length,
      kind: 'search',
      label: `search "${truncateText(needle, 48)}"`
    };
  }

  function rangeToLineRange(content, start, end) {
    const startLoc = lineColFromOffset(content, start);
    const endLoc = lineColFromOffset(content, Math.max(start, end));
    return {
      startLine: startLoc.line,
      endLine: Math.max(startLoc.line, endLoc.line)
    };
  }

  function previewAroundRange(content, start, end) {
    const text = String(content ?? '');
    const startLine = lineColFromOffset(text, clamp(start, 0, text.length)).line;
    const endLine = lineColFromOffset(text, clamp(end, 0, text.length)).line;
    const first = Math.max(1, startLine - 2);
    const last = Math.min(countLines(text), endLine + 2);
    const lines = text.split('\n');
    const out = [];
    for (let ln = first; ln <= last; ln += 1) {
      out.push(`${String(ln).padStart(4, ' ')} | ${lines[ln - 1] ?? ''}`);
    }
    return truncateText(out.join('\n'), 1600);
  }

  function buildGenericTokenizer(language) {
    const keywordSets = {
      javascript: new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'class', 'extends', 'import', 'from', 'export', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'null', 'true', 'false']),
      json: new Set(['true', 'false', 'null']),
      css: new Set(['@media', '@keyframes', '@supports', 'display', 'position', 'color', 'background', 'border', 'padding', 'margin', 'grid', 'flex', 'transform', 'transition']),
      c: new Set(['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', '_Bool', '_Complex', '_Imaginary']),
      html: new Set([])
    };
    const keywords = keywordSets[language] || keywordSets.javascript;
    const tokenRegex = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|[{}()[\];,.<>:=+\-/*%!&|^~?]+|\s+|./g;
    return (source) => {
      let html = '';
      for (const token of String(source || '').match(tokenRegex) || []) {
        if (/^\s+$/.test(token)) {
          html += escapeHtml(token);
        } else if (/^\/\*/.test(token) || /^\/\//.test(token)) {
          html += `<span class="tok-comment">${escapeHtml(token)}</span>`;
        } else if (/^["'`]/.test(token)) {
          html += `<span class="tok-string">${escapeHtml(token)}</span>`;
        } else if (/^\d/.test(token)) {
          html += `<span class="tok-number">${escapeHtml(token)}</span>`;
        } else if (keywords.has(token)) {
          html += `<span class="tok-keyword">${escapeHtml(token)}</span>`;
        } else if (/^[{}()[\];,.<>:=+\-/*%!&|^~?]+$/.test(token)) {
          html += `<span class="tok-operator">${escapeHtml(token)}</span>`;
        } else {
          html += escapeHtml(token);
        }
      }
      return html;
    };
  }

  const tokenizeJsLike = buildGenericTokenizer('javascript');
  const tokenizeCss = buildGenericTokenizer('css');
  const tokenizeJson = buildGenericTokenizer('json');
  const tokenizeC = buildGenericTokenizer('c');

  function highlightCode(source, language) {
    const text = String(source ?? '');
    if (language === 'html') return highlightHtml(text);
    if (language === 'css') return tokenizeCss(text);
    if (language === 'json') return tokenizeJson(text);
    if (language === 'c') return tokenizeC(text);
    return tokenizeJsLike(text);
  }

  function highlightHtml(text) {
    const regex = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|[^<"'0-9]+|./g;
    let out = '';
    const tokens = String(text || '').match(regex) || [];
    for (const token of tokens) {
      if (/^<!--/.test(token)) {
        out += `<span class="tok-comment">${escapeHtml(token)}</span>`;
      } else if (/^<\/?[A-Za-z]/.test(token)) {
        out += highlightHtmlTagToken(token);
      } else if (/^["']/.test(token)) {
        out += `<span class="tok-string">${escapeHtml(token)}</span>`;
      } else if (/^\d/.test(token)) {
        out += `<span class="tok-number">${escapeHtml(token)}</span>`;
      } else {
        out += escapeHtml(token);
      }
    }
    return out;
  }

  function highlightHtmlTagToken(token) {
    const isClosing = /^<\//.test(token);
    const endMatch = token.endsWith('/>') ? '/>' : token.endsWith('>') ? '>' : '';
    let inner = token.slice(isClosing ? 2 : 1, endMatch ? -endMatch.length : token.length);
    const spaceIdx = inner.search(/\s/);
    const tagName = (spaceIdx >= 0 ? inner.slice(0, spaceIdx) : inner).trim();
    const attrs = spaceIdx >= 0 ? inner.slice(spaceIdx) : '';
    let out = '';
    out += escapeHtml(isClosing ? '</' : '<');
    if (tagName) out += `<span class="tok-tag">${escapeHtml(tagName)}</span>`;
    if (attrs) {
      out += attrs.replace(/([^\s=\/>]+)(\s*=\s*)("[^"]*"|'[^']*')?/g, (m, name, eq, value) => {
        if (!eq) return escapeHtml(m);
        const valuePart = value ? `<span class="tok-string">${escapeHtml(value)}</span>` : '';
        return `<span class="tok-attr">${escapeHtml(name)}</span>${escapeHtml(eq)}${valuePart}`;
      }).replace(/&lt;|&gt;/g, (s) => s);
    }
    out += escapeHtml(endMatch);
    return out;
  }

  function detectLanguage(filePath) {
    const ext = extensionOf(filePath);
    if (ext === 'html' || ext === 'htm') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'c' || ext === 'h') return 'c';
    if (ext === 'json') return 'json';
    if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(ext)) return 'javascript';
    return 'plaintext';
  }

  function languageLabel(lang) {
    switch (lang) {
      case 'javascript': return 'JavaScript';
      case 'html': return 'HTML';
      case 'css': return 'CSS';
      case 'c': return 'C';
      case 'json': return 'JSON';
      default: return 'Plain Text';
    }
  }

  function extensionOf(filePath) {
    const base = basenamePath(filePath);
    const idx = base.lastIndexOf('.');
    if (idx < 0) return '';
    return base.slice(idx + 1).toLowerCase();
  }

  function basenamePath(filePath) {
    const p = normalizePath(filePath);
    if (!p) return '';
    const parts = p.split('\\');
    return parts[parts.length - 1] || p;
  }

  function dirnamePath(filePath) {
    const p = normalizePath(filePath);
    if (!p) return '';
    if (/^[A-Za-z]:\\$/.test(p)) return p;
    const idx = p.lastIndexOf('\\');
    if (idx <= 0) return p;
    const dir = p.slice(0, idx);
    if (/^[A-Za-z]:$/.test(dir)) return `${dir}\\`;
    return dir;
  }

  function joinPath(base, child) {
    const c = String(child || '');
    if (/^[A-Za-z]:[\\/]/.test(c) || c.startsWith('\\\\')) return normalizePath(c);
    if (!base) return normalizePath(c);
    return normalizePath(`${normalizePath(base)}\\${c}`);
  }

  function normalizePath(input) {
    let p = String(input || '').trim();
    if (!p) return '';
    p = p.replace(/\//g, '\\');
    p = p.replace(/\\+/g, '\\');
    if (/^[A-Za-z]:\\/.test(p)) p = `${p[0].toUpperCase()}${p.slice(1)}`;
    if (p.length > 3 && p.endsWith('\\')) p = p.replace(/\\+$/, '');
    return p;
  }

  function toProjectRelative(filePath) {
    const p = normalizePath(filePath);
    const root = normalizePath(state.projectRoot);
    if (!p || !root) return '';
    if (p === root) return '.';
    if (!isSameOrSubPath(p, root)) return '';
    const suffix = p.slice(root.length).replace(/^\\/, '');
    return suffix || '.';
  }

  function isSameOrSubPath(path, base) {
    const p = normalizePath(path).toLowerCase();
    const b = normalizePath(base).toLowerCase();
    if (!p || !b) return false;
    return p === b || p.startsWith(`${b}\\`);
  }

  function isPathAllowed(absPath) {
    const target = normalizePath(absPath);
    if (!target) return false;
    if (state.projectRoot) return isSameOrSubPath(target, state.projectRoot);
    if (state.activePath) return isSameOrSubPath(target, dirnamePath(state.activePath));
    return true;
  }

  function resolveWorkspacePath(inputPath, options = {}) {
    let raw = String(inputPath || '').trim();
    if (!raw) return '';
    raw = raw.replace(/^\.([\\/]|$)/, '');
    if (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith('\\\\')) return normalizePath(raw);

    const baseDir = normalizePath(options.baseDir || '') || (state.projectRoot ? normalizePath(state.projectRoot) : (state.activePath ? dirnamePath(state.activePath) : ''));
    if (!baseDir) return normalizePath(raw);
    return joinPath(baseDir, raw);
  }

  function countLines(text) {
    const s = String(text ?? '');
    if (s.length === 0) return 1;
    let count = 1;
    for (let i = 0; i < s.length; i += 1) {
      if (s.charCodeAt(i) === 10) count += 1;
    }
    return count;
  }

  function lineColFromOffset(text, offset) {
    const s = String(text ?? '');
    const safe = clamp(Number(offset) || 0, 0, s.length);
    let line = 1;
    let col = 1;
    for (let i = 0; i < safe; i += 1) {
      if (s.charCodeAt(i) === 10) {
        line += 1;
        col = 1;
      } else {
        col += 1;
      }
    }
    return { line, col };
  }

  function offsetFromLine(text, lineNumber) {
    const s = String(text ?? '');
    const targetLine = Math.max(1, Math.floor(Number(lineNumber) || 1));
    if (targetLine === 1) return 0;
    let line = 1;
    for (let i = 0; i < s.length; i += 1) {
      if (s.charCodeAt(i) === 10) {
        line += 1;
        if (line === targetLine) return i + 1;
      }
    }
    return s.length;
  }

  function parseJsonLoose(rawText) {
    const raw = String(rawText || '').trim();
    if (!raw) return null;

    const candidates = [raw];
    const fencedMatches = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
    if (fencedMatches?.[1]) candidates.push(fencedMatches[1].trim());

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1));

    const firstBracket = raw.indexOf('[');
    const lastBracket = raw.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) candidates.push(raw.slice(firstBracket, lastBracket + 1));

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (_) {
        // try next
      }
    }
    return null;
  }

  function truncateText(text, max = 1200) {
    const s = String(text ?? '');
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 16))}\n...[truncated]`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatClock(ts) {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return '--:--:--';
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function cssEscape(str) {
    if (window.CSS?.escape) return window.CSS.escape(String(str));
    return String(str).replace(/["\\#.;:[\]()<>~=+*^$|]/g, '\\$&');
  }
})();
