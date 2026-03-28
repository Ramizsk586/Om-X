const SHORTCUT_LABELS = {
    'new-tab': 'New Tab',
    'open-scraber': 'Open Scraper Tab',
    'close-tab': 'Close Active Tab',
    'toggle-sidebar': 'Sidebar Collapse',
    'toggle-system': 'System Settings',
    'take-screenshot': 'Quick Screenshot',
    'toggle-devtools': 'Inspect Tools',
    'toggle-fullscreen': 'Fullscreen',
    'quit-app': 'Safe Exit'
};

const THEME_ALIAS_MAP = {
    dark: 'noir',
    glass: 'prism',
    midnight: 'nordic',
    shadow: 'charcoal',
    abyss: 'deep-ocean',
    eclipse: 'twilight',
    ocean: 'ocean-waves',
    ember: 'ember-glow',
    noir: 'onyx',
    slate: 'steel-blue',
    mocha: 'honey-amber'
};

const LLM_PROVIDERS = {
    google: { name: 'Google Gemini', models: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash'] },
    openai: { name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1'] },
    groq: { name: 'Groq', models: ['llama-3.3-70b-versatile'] },
    openrouter: { name: 'OpenRouter', models: ['nvidia/nemotron-3-super-120b-a12b:free'] },
    mistral: { name: 'Mistral AI', models: ['mistral-medium'] },
    sarvamai: { name: 'SarvamAI', models: ['sarvam-m'] }
};

const resolveThemeId = (theme) => {
    const key = String(theme || '').trim();
    if (!key) return 'noir';
    return THEME_ALIAS_MAP[key] || key;
};

const applyThemeClass = (theme) => {
    const resolvedTheme = resolveThemeId(theme);
    const body = document.body;
    if (!body) return resolvedTheme;
    body.classList.forEach((cls) => {
        if (cls.startsWith('theme-')) body.classList.remove(cls);
    });
    body.classList.add(`theme-${resolvedTheme}`);
    return resolvedTheme;
};

  document.addEventListener('DOMContentLoaded', async () => {
  const els = {
    // System Panel
    // Features
    featLoadingAnim: document.getElementById('feat-loading-anim'),
    // Shared LLM
    llmOperatorCards: document.querySelectorAll('.llm-operator-card'),
    btnReplaceEnvFile: document.getElementById('btn-replace-env-file'),
    // Security Panel
    featFirewall: document.getElementById('feat-firewall'),
    featAntivirus: document.getElementById('feat-antivirus'),
    featPopupBlocker: document.getElementById('feat-popup-blocker'),
    featVirusTotal: document.getElementById('feat-virustotal'),
    featCookieShield: document.getElementById('feat-cookie-shield'),
    featCookieThirdParty: document.getElementById('feat-cookie-third-party'),
    featSessionGuard: document.getElementById('feat-sessionguard'),
    featOmchatLocalIp: document.getElementById('feat-omchat-local-ip'),
    featOmchatAlwaysOn: document.getElementById('feat-omchat-always-on'),
    featMcpAlwaysOn: document.getElementById('feat-mcp-always-on'),
    // Ad Blocker Panel
    featAdblockerMaster: document.getElementById('feat-adblocker-master'),
    featAdblockerPopups: document.getElementById('feat-adblocker-popups'),
    featAdblockerFloating: document.getElementById('feat-adblocker-floating'),
    featAdblockerBanners: document.getElementById('feat-adblocker-banners'),
    featAdblockerVideo: document.getElementById('feat-adblocker-video'),
    featAdblockerSocial: document.getElementById('feat-adblocker-social'),
    featAdblockerTrackers: document.getElementById('feat-adblocker-trackers'),
    featAdblockerSearch: document.getElementById('feat-adblocker-search'),
    adblockerTogglesContainer: document.getElementById('adblocker-toggles-container'),
    // Footer / UI
    btnSave: document.getElementById('btn-save-settings'),
    status: document.getElementById('save-status'),
    navItems: document.querySelectorAll('.sys-nav-item'),
    panels: document.querySelectorAll('.settings-panel'),
    shortcutsContainer: document.getElementById('shortcuts-container'),
    actionsFooter: document.querySelector('.actions-footer'),
    // Creator Panel Elements
    projectsGrid: document.getElementById('creator-projects-grid'),
    statRepos: document.querySelector('.stat-box-compact:nth-child(1) .value'),
    statFollowers: document.querySelector('.stat-box-compact:nth-child(2) .value'),
    // OmChat Panel Elements
    omchatLocalSection: document.getElementById('omchat-local-section'),
    omchatLocalDbPath: document.getElementById('omchat-local-db-path'),
    omchatBrowseLocalDb: document.getElementById('omchat-browse-local-db'),
    omchatSyncBtn: document.getElementById('omchat-sync-btn'),
    omchatImportBtn: document.getElementById('omchat-import-btn'),
    omchatDeleteBtn: document.getElementById('omchat-delete-btn'),
    omchatSyncModal: document.getElementById('omchat-sync-modal'),
    omchatSyncClose: document.getElementById('omchat-sync-close'),
    omchatSyncStatus: document.getElementById('omchat-sync-status'),
    omchatSyncLog: document.getElementById('omchat-sync-log'),
    omchatSyncBar: document.getElementById('omchat-sync-bar'),
    omchatMongoStats: document.getElementById('omchat-mongo-stats'),
    omchatMongoStatsLine: document.getElementById('omchat-mongo-stats-line'),
    omchatMongoStatsSub: document.getElementById('omchat-mongo-stats-sub'),
  };

  let currentSettings = {};
  let selectedTheme = 'noir';
  let selectedLlmProvider = 'google';

  const syncLlmOperatorSelection = (provider = 'google') => {
    selectedLlmProvider = String(provider || 'google').trim() || 'google';
    els.llmOperatorCards?.forEach((card) => {
      const isActive = card.dataset.provider === selectedLlmProvider;
      card.classList.toggle('active', isActive);
      card.setAttribute('aria-pressed', String(isActive));
    });
  };

  const bindLlmOperatorCards = () => {
    els.llmOperatorCards?.forEach((card) => {
      card.addEventListener('click', () => {
        syncLlmOperatorSelection(card.dataset.provider || 'google');
      });
    });
  };

  const getFallbackLlmProvider = (settings = {}) => {
    const llmConfig = settings.llm || settings.translator?.api || settings.writer?.api || {};
    const provider = String(llmConfig.provider || 'google').trim();
    if (LLM_PROVIDERS[provider]) return provider;
    return 'google';
  };

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function syncAdblockerToggles() {
    if (!els.adblockerTogglesContainer) return;
    const enabled = Boolean(els.featAdblockerMaster?.checked);
    els.adblockerTogglesContainer.style.opacity = enabled ? '1' : '0.5';
    els.adblockerTogglesContainer.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  bindLlmOperatorCards();
  els.btnReplaceEnvFile?.addEventListener('click', async () => {
    if (!window.browserAPI?.envFile?.replace) return;
    els.btnReplaceEnvFile.disabled = true;
    try {
      const result = await window.browserAPI.envFile.replace();
      if (result?.canceled) return;
      if (result?.success) {
        if (els.status) {
          els.status.textContent = `.env replaced. ${result.keyCount || 0} keys loaded.`;
          els.status.className = 'save-status visible';
        }
      } else if (els.status) {
        els.status.textContent = result?.error || 'Failed to replace .env.';
        els.status.className = 'save-status visible error';
      }
    } catch (error) {
      if (els.status) {
        els.status.textContent = error?.message || 'Failed to replace .env.';
        els.status.className = 'save-status visible error';
      }
    } finally {
      els.btnReplaceEnvFile.disabled = false;
      setTimeout(() => {
        if (els.status) els.status.classList.remove('visible');
      }, 2500);
    }
  });

  // ─── OmChat MongoDB Toggle & Local Folder Browse ─────────────────
  function syncOmChatMongoToggle() {
    if (els.omchatLocalSection) {
      els.omchatLocalSection.style.display = '';
    }
    if (els.omchatMongoStats) {
      els.omchatMongoStats.style.display = '';
    }
    void refreshOmChatMongoStats();
  }

  function setOmChatSyncModalVisible(visible) {
    if (!els.omchatSyncModal) return;
    const shouldShow = Boolean(visible);
    els.omchatSyncModal.classList.toggle('hidden', !shouldShow);
    els.omchatSyncModal.setAttribute('aria-hidden', String(!shouldShow));
  }

  function resetOmChatSyncLog() {
    if (els.omchatSyncLog) els.omchatSyncLog.innerHTML = '';
    if (els.omchatSyncBar) els.omchatSyncBar.style.width = '0%';
    if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = 'Preparing backup...';
  }

  function appendOmChatSyncLog(message = '') {
    if (!els.omchatSyncLog) return;
    const line = document.createElement('div');
    line.textContent = message;
    els.omchatSyncLog.appendChild(line);
    els.omchatSyncLog.scrollTop = els.omchatSyncLog.scrollHeight;
  }

  function setOmChatSyncProgress(percent = 0) {
    if (!els.omchatSyncBar) return;
    const safe = Math.max(0, Math.min(100, Number(percent) || 0));
    els.omchatSyncBar.style.width = `${safe}%`;
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes)) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  async function refreshOmChatMongoStats() {
    if (!window.browserAPI?.omChat?.getMongoStats) return;
    if (!els.omchatMongoStatsLine || !els.omchatMongoStatsSub) return;
    els.omchatMongoStatsLine.textContent = 'MongoDB storage: Loading...';
    els.omchatMongoStatsSub.textContent = 'Free: --';
    try {
      const result = await window.browserAPI.omChat.getMongoStats();
      if (!result?.success) {
        els.omchatMongoStatsLine.textContent = result?.error || 'MongoDB stats unavailable.';
        els.omchatMongoStatsSub.textContent = 'Free: --';
        return;
      }
      const stats = result.stats || {};
      const used = Number.isFinite(stats.fsUsedSize) ? stats.fsUsedSize : null;
      const total = Number.isFinite(stats.fsTotalSize) ? stats.fsTotalSize : null;
      const free = Number.isFinite(stats.freeBytes) ? stats.freeBytes : null;
      const dataSize = Number.isFinite(stats.dataSize) ? stats.dataSize : null;
      const storageSize = Number.isFinite(stats.storageSize) ? stats.storageSize : null;
      const cluster = stats.cluster || {};
      const clusterData = Number.isFinite(cluster.dataSize) ? cluster.dataSize : null;
      const clusterStorage = Number.isFinite(cluster.storageSize) ? cluster.storageSize : null;
      const dbName = String(stats.dbName || '').trim() || 'omchat';
      const primaryText = used != null && total != null
        ? `${formatBytes(used)} used of ${formatBytes(total)}`
        : clusterData != null && clusterStorage != null
          ? `${formatBytes(clusterData)} data, ${formatBytes(clusterStorage)} storage`
          : storageSize != null && dataSize != null
            ? `${formatBytes(dataSize)} data, ${formatBytes(storageSize)} storage`
            : 'Usage details unavailable';
      const freeText = free != null
        ? `Free: ${formatBytes(free)}`
        : dataSize != null && storageSize != null
          ? `Database (${dbName}): ${formatBytes(dataSize)} data, ${formatBytes(storageSize)} storage`
          : 'Free: N/A';
      const label = clusterData != null && clusterStorage != null ? 'MongoDB storage (cluster)' : 'MongoDB storage';
      els.omchatMongoStatsLine.textContent = `${label}: ${primaryText}`;
      els.omchatMongoStatsSub.textContent = freeText;
    } catch (error) {
      els.omchatMongoStatsLine.textContent = error?.message || 'MongoDB stats unavailable.';
      els.omchatMongoStatsSub.textContent = 'Free: --';
    }
  }

  els.omchatBrowseLocalDb?.addEventListener('click', async () => {
    if (!window.browserAPI?.omChat?.selectDbFolder) return;
    const result = await window.browserAPI.omChat.selectDbFolder();
    if (result?.success && result.folderPath) {
      if (els.omchatLocalDbPath) els.omchatLocalDbPath.value = result.folderPath;
    }
  });

  els.omchatSyncClose?.addEventListener('click', () => setOmChatSyncModalVisible(false));

  function setOmChatActionButtonsBusy(isBusy = false, activeKind = 'backup') {
    if (els.omchatSyncBtn) {
      els.omchatSyncBtn.disabled = isBusy;
      els.omchatSyncBtn.textContent = isBusy && activeKind === 'backup' ? 'Working...' : 'Backup Now';
    }
    if (els.omchatImportBtn) {
      els.omchatImportBtn.disabled = isBusy;
      els.omchatImportBtn.textContent = isBusy && activeKind === 'import' ? 'Working...' : 'Download Zip';
    }
    if (els.omchatDeleteBtn) {
      els.omchatDeleteBtn.disabled = isBusy;
      els.omchatDeleteBtn.textContent = isBusy && activeKind === 'delete' ? 'Deleting...' : 'Delete Backup';
    }
  }

  async function runOmChatTransfer(kind = 'backup') {
    const isBackup = kind === 'backup';
    const isImport = kind === 'import';
    const isDelete = kind === 'delete';
    const invoke = isBackup
      ? window.browserAPI?.omChat?.syncDatabases
      : isImport
        ? window.browserAPI?.omChat?.importDatabases
        : window.browserAPI?.omChat?.deleteMongoBackup;
    if (!invoke) {
      resetOmChatSyncLog();
      setOmChatSyncModalVisible(true);
      if (els.omchatSyncStatus) {
        els.omchatSyncStatus.textContent = 'MongoDB service is unavailable. Restart the app.';
      }
      appendOmChatSyncLog('Sync API missing. Please restart Om-X to load the latest preload.');
      setOmChatSyncProgress(0);
      return;
    }
    resetOmChatSyncLog();
    setOmChatSyncModalVisible(true);
    const requiresLocalPath = isBackup;
    const localPath = String(els.omchatLocalDbPath?.value || '').trim();
    if (requiresLocalPath && !localPath) {
      if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = 'Select a local folder first.';
      appendOmChatSyncLog('Please choose a local database folder before running a backup.');
      setOmChatSyncProgress(0);
      return;
    }
    appendOmChatSyncLog(
      isBackup ? 'Starting backup...' : isImport ? 'Starting download...' : 'Starting MongoDB cleanup...'
    );
    setOmChatSyncProgress(5);
    setOmChatActionButtonsBusy(true, kind);
    try {
      const result = await invoke();
      if (!result?.success) {
        if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = result?.error || 'Operation failed.';
        appendOmChatSyncLog(result?.error || 'Operation failed.');
      } else if (isBackup || isDelete) {
        void refreshOmChatMongoStats();
      }
    } catch (error) {
      if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = error?.message || 'Operation failed.';
      appendOmChatSyncLog(error?.message || 'Operation failed.');
    } finally {
      setOmChatActionButtonsBusy(false, kind);
    }
  }

  els.omchatSyncBtn?.addEventListener('click', async () => runOmChatTransfer('backup'));
  els.omchatImportBtn?.addEventListener('click', async () => runOmChatTransfer('import'));
  els.omchatDeleteBtn?.addEventListener('click', async () => {
    const confirmed = window.confirm('Delete all OmChat backup data from MongoDB? This cannot be undone.');
    if (!confirmed) return;
    await runOmChatTransfer('delete');
  });

  if (window.browserAPI?.omChat?.onSyncProgress) {
    window.browserAPI.omChat.onSyncProgress((payload = {}) => {
      if (payload?.status && els.omchatSyncStatus) {
        els.omchatSyncStatus.textContent = payload.status;
      }
      if (typeof payload?.percent === 'number') {
        setOmChatSyncProgress(payload.percent);
      }
      if (payload?.message) {
        appendOmChatSyncLog(payload.message);
      }
    });
  }

  if (window.browserAPI?.omChat?.onSyncDone) {
    window.browserAPI.omChat.onSyncDone((payload = {}) => {
      if (payload?.success) {
        const mode = payload?.mode;
        const completeLabel =
          mode === 'import' ? 'Download completed.' :
          mode === 'delete' ? 'MongoDB backup deleted.' :
          'Backup completed.';
        if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = completeLabel;
        appendOmChatSyncLog(completeLabel);
        setOmChatSyncProgress(100);
        if (mode === 'backup' || mode === 'delete') {
          void refreshOmChatMongoStats();
        }
      } else if (payload?.error) {
        if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = payload.error;
        appendOmChatSyncLog(payload.error);
      }
    });
  }
  function setActivePanel(targetId) {
    const resolved = String(targetId || '').trim() || 'panel-system';
    const targetPanel = document.getElementById(resolved);
    if (!targetPanel) return;

    els.panels.forEach(p => {
      const isActive = p.id === resolved;
      p.classList.toggle('active', isActive);
      if (isActive && resolved === 'panel-creator') syncCreatorGitHub();
      if (isActive && resolved === 'panel-search-matrix') loadMatrixSearchPanel();
      // Vault panel removed.
    });

    if (els.actionsFooter) {
      if (resolved === 'panel-creator') {
        els.actionsFooter.style.display = 'none';
      } else {
        els.actionsFooter.style.display = 'flex';
      }
    }
  }

  // --- Core Navigation ---
  els.navItems.forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = event.currentTarget?.dataset?.target;
      if (!targetId) return;
      els.navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setActivePanel(targetId);
    });
  });

  const initialNav = document.querySelector('.sys-nav-item.active');
  if (initialNav?.dataset?.target) {
    setActivePanel(initialNav.dataset.target);
  }

  // --- Load function ---
  // Vault panel removed.

  function loadMatrixSearchPanel() {
      const p = document.getElementById('panel-search-matrix');
      if (p && !p.dataset.mounted) {
          import('./matrix-search.js').then(m => m.mountMatrixSearchPanel(p));
      }
  }

  // --- Creator Sync ---
  async function syncCreatorGitHub() {
    try {
        const [userRes, reposRes] = await Promise.all([
            fetch('https://api.github.com/users/Ramizsk586'),
            fetch('https://api.github.com/users/Ramizsk586/repos?sort=updated&per_page=10')
        ]);
        
        let userData = null;
        let reposData = [];

        if (userRes.ok) {
            const text = await userRes.text();
            try { userData = JSON.parse(text); } catch(e) {}
        }
        if (reposRes.ok) {
            const text = await reposRes.text();
            try { reposData = JSON.parse(text); } catch(e) {}
        }
        
        if (userData) {
            if (els.statRepos) els.statRepos.textContent = userData.public_repos || '0';
            if (els.statFollowers) els.statFollowers.textContent = userData.followers || '0';
        }
        
        renderCreatorPortfolio(reposData);
    } catch (e) {
        console.error("Creator sync failed:", e);
        renderCreatorPortfolio([]);
    }
  }

  function renderCreatorPortfolio(repos) {
      if (!els.projectsGrid) return;
      els.projectsGrid.innerHTML = '';
      
      const omxTile = document.createElement('div');
      omxTile.className = 'project-tile-compact';
      omxTile.style.borderLeft = '3px solid var(--accent-color)';
      omxTile.innerHTML = `
          <div class="proj-header">
              <div class="proj-tag">Core</div>
          </div>
          <span class="proj-name">Om-X Browser Intelligence</span>
          <p class="proj-desc">AI-first browsing ecosystem featuring deep Gemini integration and Zero-Trust guardian security.</p>
      `;
      omxTile.onclick = () => window.browserAPI.openTab('https://github.com/Ramizsk586/Om-X');
      els.projectsGrid.appendChild(omxTile);

      const dynamicRepos = (Array.isArray(repos) ? repos : []).filter(r => r.name !== 'Om-X').slice(0, 5);
      dynamicRepos.forEach((repo, idx) => {
          const safeName = escapeHtml(repo.name || 'Repository');
          const safeDesc = escapeHtml(repo.description || 'System component and development logic.');
          const tile = document.createElement('div');
          tile.className = 'project-tile-compact';
          tile.innerHTML = `
              <div class="proj-header">
                  <div class="proj-tag">Module</div>
              </div>
              <span class="proj-name">${safeName}</span>
              <p class="proj-desc">${safeDesc}</p>
          `;
          tile.onclick = () => window.browserAPI.openTab(repo.html_url);
          els.projectsGrid.appendChild(tile);
      });

      const tiles = els.projectsGrid.querySelectorAll('.project-tile-compact');
      tiles.forEach((t, i) => setTimeout(() => t.classList.add('visible'), i * 50));
  }


  function setupRecorder(inputEl) {
      if (!inputEl) return;
      inputEl.readOnly = true; inputEl.style.cursor = 'pointer'; 
      inputEl.addEventListener('keydown', (e) => {
          e.preventDefault(); e.stopPropagation();
          const keys = [];
          if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
          if (e.altKey) keys.push('Alt');
          if (e.shiftKey) keys.push('Shift');
          if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
              let keyName = e.key.toUpperCase();
              if (keyName === ' ') keyName = 'Space';
              keys.push(keyName);
              inputEl.value = keys.join('+');
              inputEl.blur();
          }
      });
  }

  function renderShortcuts(shortcuts) {
    if (!els.shortcutsContainer) return;
    els.shortcutsContainer.innerHTML = '';
    Object.keys(SHORTCUT_LABELS).forEach(key => {
        const row = document.createElement('div');
        row.className = 'toggle-row';
        const info = document.createElement('div');
        info.className = 'toggle-info';
        const title = document.createElement('span');
        title.className = 'toggle-title';
        title.textContent = SHORTCUT_LABELS[key];
        info.appendChild(title);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'shortcut-input';
        input.dataset.key = key;
        input.value = String(shortcuts[key] || '');
        input.style.cssText = 'width: 160px; text-align: right; background: #27272a; border-radius: 6px; padding: 6px; color: #fff; font-family: monospace; border: 1px solid #3f3f46; cursor: pointer;';

        row.appendChild(info);
        row.appendChild(input);
        setupRecorder(input);
        els.shortcutsContainer.appendChild(row);
    });
  }


  async function load(injectedSettings = null) {
    try {
      currentSettings = injectedSettings || await window.browserAPI.settings.get();
      // Authority sync: Sub-panels depend on this object being global to avoid stale saves
      window.omxSettings = currentSettings;
      
      const s = currentSettings;
      
      if (els.featLoadingAnim) els.featLoadingAnim.checked = s.features?.showLoadingAnimation ?? false;

      if (els.featFirewall) els.featFirewall.checked = s.features?.enableFirewall ?? true;
      if (els.featAntivirus) els.featAntivirus.checked = s.features?.enableAntivirus ?? true;
      if (els.featPopupBlocker) els.featPopupBlocker.checked = s.security?.popupBlocker?.enabled ?? true;
      if (els.featVirusTotal) els.featVirusTotal.checked = s.features?.enableVirusTotal ?? false;
      if (els.featCookieShield) els.featCookieShield.checked = s.security?.cookieShield?.enabled ?? true;
      if (els.featCookieThirdParty) {
        const req = s.security?.cookieShield?.blockThirdPartyRequestCookies ?? true;
        const res = s.security?.cookieShield?.blockThirdPartyResponseCookies ?? true;
        els.featCookieThirdParty.checked = Boolean(req && res);
      }
      if (els.featSessionGuard) els.featSessionGuard.checked = s.security?.sessionGuard?.enabled ?? true;
      if (els.featOmchatLocalIp) els.featOmchatLocalIp.checked = s.omchat?.useLocalIpOnly ?? false;
      if (els.featOmchatAlwaysOn) els.featOmchatAlwaysOn.checked = s.omchat?.alwaysOn ?? false;
      if (els.featMcpAlwaysOn) els.featMcpAlwaysOn.checked = s.mcp?.alwaysOn ?? false;
      
      // Load Ad Blocker settings (default OFF)
      const adBlocker = s.adBlocker || {};
      if (els.featAdblockerMaster) els.featAdblockerMaster.checked = adBlocker.enabled ?? false;
      if (els.featAdblockerPopups) els.featAdblockerPopups.checked = adBlocker.blockPopups ?? false;
      if (els.featAdblockerFloating) els.featAdblockerFloating.checked = adBlocker.blockFloating ?? false;
      if (els.featAdblockerBanners) els.featAdblockerBanners.checked = adBlocker.blockBanners ?? false;
      if (els.featAdblockerVideo) els.featAdblockerVideo.checked = adBlocker.blockVideoAds ?? false;
      if (els.featAdblockerSocial) els.featAdblockerSocial.checked = adBlocker.blockSocialAds ?? false;
      if (els.featAdblockerTrackers) els.featAdblockerTrackers.checked = adBlocker.blockTrackers ?? false;
      if (els.featAdblockerSearch) els.featAdblockerSearch.checked = adBlocker.cleanSearchEngines ?? false;
      syncAdblockerToggles();
      
      syncLlmOperatorSelection(getFallbackLlmProvider(s));

      // Load OmChat DB settings
      const omchatSettings = s.omchat || {};
      if (els.omchatLocalDbPath) els.omchatLocalDbPath.value = omchatSettings.localDbPath || '';
      syncOmChatMongoToggle();

      selectedTheme = applyThemeClass(s.theme || 'noir');
      renderShortcuts(s.shortcuts || {});
    } catch(e) { console.error("Settings load error:", e); }
  }

  if (els.btnSave) {
    els.btnSave.onclick = async () => {
      const newShortcuts = {};
      document.querySelectorAll('.shortcut-input').forEach(i => newShortcuts[i.dataset.key] = i.value.trim());
      const omchatPath = els.omchatLocalDbPath?.value.trim() || currentSettings.omchat?.localDbPath || '';

      const nextSettings = {
        ...window.omxSettings,
        features: { 
            ...window.omxSettings.features, 
            enableHistory: true,
            showLoadingAnimation: els.featLoadingAnim?.checked ?? false,
            enableFirewall: true, 
            enableAntivirus: true,
            enableVirusTotal: els.featVirusTotal?.checked ?? false
        },
        security: {
            ...(window.omxSettings.security || {}),
            virusTotal: {
                ...(window.omxSettings.security?.virusTotal || {})
            },
            popupBlocker: {
                ...(window.omxSettings.security?.popupBlocker || {}),
                enabled: true
            },
            cookieShield: {
                ...(window.omxSettings.security?.cookieShield || {}),
                enabled: true,
                blockThirdPartyRequestCookies: true,
                blockThirdPartyResponseCookies: true
            },
            sessionGuard: {
                ...(window.omxSettings.security?.sessionGuard || {}),
                enabled: els.featSessionGuard?.checked ?? true
            }
        },
        adBlocker: {
            enabled: els.featAdblockerMaster?.checked ?? false,
            blockPopups: els.featAdblockerPopups?.checked ?? false,
            blockFloating: els.featAdblockerFloating?.checked ?? false,
            blockBanners: els.featAdblockerBanners?.checked ?? false,
            blockVideoAds: els.featAdblockerVideo?.checked ?? false,
            blockSocialAds: els.featAdblockerSocial?.checked ?? false,
            blockTrackers: els.featAdblockerTrackers?.checked ?? false,
            cleanSearchEngines: els.featAdblockerSearch?.checked ?? false
        },
        theme: selectedTheme,
        llm: {
            provider: selectedLlmProvider || 'google'
        },
        omchat: {
            dbMode: 'local',
            localDbPath: omchatPath,
            useLocalIpOnly: els.featOmchatLocalIp?.checked ?? false,
            alwaysOn: els.featOmchatAlwaysOn?.checked ?? false
        },
        mcp: {
            ...(window.omxSettings.mcp || {}),
            alwaysOn: els.featMcpAlwaysOn?.checked ?? false
        },
        shortcuts: newShortcuts,
        openDevToolsOnStart: false
      };
      els.btnSave.disabled = true; els.btnSave.textContent = "Saving...";
      const success = await window.browserAPI.settings.save(nextSettings);
      if (els.status) {
          els.status.textContent = success ? 'Saved.' : 'Error.';
          els.status.className = `save-status visible ${success ? '' : 'error'}`;
      }
      currentSettings = nextSettings;
      window.omxSettings = nextSettings;
      setTimeout(() => { if (els.status) els.status.classList.remove('visible'); els.btnSave.disabled = false; els.btnSave.textContent = "Save Changes"; }, 2000);
    };
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
  });

  if (els.featAdblockerMaster) {
    els.featAdblockerMaster.addEventListener('change', syncAdblockerToggles);
  }

  load();
});
