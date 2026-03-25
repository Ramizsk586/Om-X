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
    virusTotalConfig: document.getElementById('virustotal-config'),
    btnOpenVirusTotalPopup: document.getElementById('btn-open-virustotal-popup'),
    virusTotalPopup: document.getElementById('virustotal-popup'),
    btnCloseVirusTotalPopup: document.getElementById('btn-close-virustotal-popup'),
    virusTotalApiKey: document.getElementById('virustotal-api-key'),
    featVirusTotalUrlScan: document.getElementById('feat-virustotal-url-scan'),
    featVirusTotalFileScan: document.getElementById('feat-virustotal-file-scan'),
    btnVerifyVirusTotal: document.getElementById('btn-verify-virustotal'),
    virusTotalVerifyStatus: document.getElementById('virustotal-verify-status'),
    virusTotalQuotaCard: document.getElementById('virustotal-quota-card'),
    virusTotalDailyUsed: document.getElementById('virustotal-daily-used'),
    virusTotalDailyLimit: document.getElementById('virustotal-daily-limit'),
    virusTotalMonthlyLeft: document.getElementById('virustotal-monthly-left'),
    virusTotalMonthlyLimit: document.getElementById('virustotal-monthly-limit'),
    virusTotalLinkTools: document.getElementById('virustotal-link-tools'),
    virusTotalLinkInput: document.getElementById('virustotal-link-input'),
    btnScanVirusTotalLink: document.getElementById('btn-scan-virustotal-link'),
    btnClearVirusTotalLink: document.getElementById('btn-clear-virustotal-link'),
    virusTotalLinkStatus: document.getElementById('virustotal-link-status'),
    virusTotalLinkResult: document.getElementById('virustotal-link-result'),
    // Block List Panel
    blockInputDomain: document.getElementById('block-input-domain'),
    btnAddBlock: document.getElementById('btn-add-block'),
    blockListContainer: document.getElementById('block-list-container'),
    // Whitelist Panel
    whitelistInputDomain: document.getElementById('whitelist-input-domain'),
    btnAddWhitelist: document.getElementById('btn-add-whitelist'),
    whitelistContainer: document.getElementById('whitelist-container'),
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
  let virusTotalLinkScanToken = 0;
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

  function setVirusTotalStatus(message = '', type = '') {
    if (!els.virusTotalVerifyStatus) return;
    els.virusTotalVerifyStatus.textContent = message;
    els.virusTotalVerifyStatus.className = `virustotal-status ${type}`.trim();
  }

  function setVirusTotalQuotaCard(payload = null) {
    if (!els.virusTotalQuotaCard) return;

    const formatQuota = (value) => Number.isFinite(value) ? Number(value).toLocaleString() : 'N/A';
    const setText = (el, value) => {
      if (el) el.textContent = formatQuota(value);
    };

    if (!payload || !payload.success) {
      setText(els.virusTotalDailyUsed, null);
      setText(els.virusTotalDailyLimit, null);
      setText(els.virusTotalMonthlyLeft, null);
      setText(els.virusTotalMonthlyLimit, null);
      els.virusTotalQuotaCard.classList.add('is-hidden');
      return;
    }

    const dailyUsed = Number.isFinite(payload.dailyUsed) ? Number(payload.dailyUsed) : null;
    const dailyLimit = Number.isFinite(payload.dailyQuota) ? Number(payload.dailyQuota) : null;
    const monthlyLeft = Number.isFinite(payload.monthlyLeft) ? Number(payload.monthlyLeft) : null;
    const monthlyLimit = Number.isFinite(payload.monthlyQuota) ? Number(payload.monthlyQuota) : null;

    setText(els.virusTotalDailyUsed, dailyUsed);
    setText(els.virusTotalDailyLimit, dailyLimit);
    setText(els.virusTotalMonthlyLeft, monthlyLeft);
    setText(els.virusTotalMonthlyLimit, monthlyLimit);
    els.virusTotalQuotaCard.classList.remove('is-hidden');
  }

  function setVirusTotalPopupVisible(visible) {
    if (!els.virusTotalPopup) return;
    const shouldShow = Boolean(visible && els.featVirusTotal?.checked);
    els.virusTotalPopup.classList.toggle('hidden', !shouldShow);
    els.virusTotalPopup.setAttribute('aria-hidden', String(!shouldShow));
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setVirusTotalLinkToolsVisible(visible) {
    if (!els.virusTotalLinkTools) return;
    els.virusTotalLinkTools.classList.toggle('is-hidden', !visible);
  }

  function setVirusTotalLinkStatus(message = '', type = '') {
    if (!els.virusTotalLinkStatus) return;
    els.virusTotalLinkStatus.textContent = message;
    els.virusTotalLinkStatus.className = `virustotal-status ${type}`.trim();
  }

  function renderVirusTotalLinkReport(report = null) {
    if (!els.virusTotalLinkResult) return;
    if (!report || !report.success) {
      els.virusTotalLinkResult.innerHTML = '';
      els.virusTotalLinkResult.classList.add('is-hidden');
      return;
    }

    const riskLevel = String(report.riskLevel || 'unknown').toLowerCase();
    const riskLabel = riskLevel === 'danger'
      ? 'Unsafe'
      : riskLevel === 'suspicious'
        ? 'Suspicious'
        : riskLevel === 'clean'
          ? 'Safe'
          : 'Unknown';
    const stats = report.stats || {};
    const categories = Array.isArray(report.categories) && report.categories.length
      ? report.categories.join(', ')
      : 'Uncategorized';
    const scanDate = report.scanDate ? new Date(report.scanDate).toLocaleString() : 'N/A';
    const detections = Array.isArray(report.detections) ? report.detections : [];
    const detectionRows = detections.length
      ? detections.map((row) => {
          const engine = escapeHtml(row.engine || 'Unknown Engine');
          const result = escapeHtml(row.result || row.category || 'flagged');
          return `<div class="virustotal-detection-item"><strong>${engine}</strong>: ${result}</div>`;
        }).join('')
      : '<div class="virustotal-detection-item">No flagged engines in the current URL analysis.</div>';

    els.virusTotalLinkResult.innerHTML = `
      <div class="virustotal-risk-header">
        <span class="virustotal-risk-badge ${escapeHtml(riskLevel)}">${escapeHtml(riskLabel)}</span>
        <span class="virustotal-risk-score">Risk Score: ${Number(report.riskScore || 0)}%</span>
      </div>
      <div class="virustotal-url-line">${escapeHtml(report.url || '')}</div>
      <div class="virustotal-stats-grid">
        <div class="virustotal-stat"><div class="k">Malicious</div><div class="v">${Number(stats.malicious || 0)}</div></div>
        <div class="virustotal-stat"><div class="k">Suspicious</div><div class="v">${Number(stats.suspicious || 0)}</div></div>
        <div class="virustotal-stat"><div class="k">Harmless</div><div class="v">${Number(stats.harmless || 0)}</div></div>
        <div class="virustotal-stat"><div class="k">Undetected</div><div class="v">${Number(stats.undetected || 0)}</div></div>
      </div>
      <div class="virustotal-meta-line">Categories: ${escapeHtml(categories)}</div>
      <div class="virustotal-meta-line">Reputation: ${Number(report.reputation || 0)} | Engines: ${Number(report.engineCount || 0)} | Last Scan: ${escapeHtml(scanDate)}</div>
      <div class="virustotal-meta-line">${escapeHtml(report.reason || '')}</div>
      <div class="virustotal-detections">
        <div class="virustotal-detections-title">Flagged Engines</div>
        ${detectionRows}
      </div>
    `;
    els.virusTotalLinkResult.classList.remove('is-hidden');
  }

  function resetVirusTotalLinkScan({ preserveInput = true } = {}) {
    if (!preserveInput && els.virusTotalLinkInput) {
      els.virusTotalLinkInput.value = '';
    }
    setVirusTotalLinkStatus('', '');
    renderVirusTotalLinkReport(null);
  }

  function syncVirusTotalLinkTools() {
    const hasApiKey = Boolean(els.virusTotalApiKey?.value.trim());
    const enabled = Boolean(els.featVirusTotal?.checked);
    const shouldShow = enabled && hasApiKey;
    setVirusTotalLinkToolsVisible(shouldShow);
    if (!shouldShow) {
      resetVirusTotalLinkScan();
    }
  }

  function syncVirusTotalVisibility() {
    if (!els.virusTotalConfig) return;
    const enabled = Boolean(els.featVirusTotal?.checked);
    els.virusTotalConfig.classList.toggle('is-hidden', !enabled);
    if (!enabled) {
      setVirusTotalStatus('', '');
      setVirusTotalQuotaCard(null);
      setVirusTotalLinkToolsVisible(false);
      resetVirusTotalLinkScan();
      setVirusTotalPopupVisible(false);
      return;
    }
    syncVirusTotalLinkTools();
  }

  function syncAdblockerToggles() {
    if (!els.adblockerTogglesContainer) return;
    const enabled = Boolean(els.featAdblockerMaster?.checked);
    els.adblockerTogglesContainer.style.opacity = enabled ? '1' : '0.5';
    els.adblockerTogglesContainer.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  async function scanVirusTotalLink() {
    const targetUrl = String(els.virusTotalLinkInput?.value || '').trim();
    const apiKey = String(els.virusTotalApiKey?.value || '').trim();

    if (!targetUrl) {
      setVirusTotalLinkStatus('Paste a link first.', 'error');
      renderVirusTotalLinkReport(null);
      els.virusTotalLinkInput?.focus();
      return;
    }

    if (!apiKey) {
      setVirusTotalLinkStatus('Enter and verify API key first.', 'error');
      renderVirusTotalLinkReport(null);
      els.virusTotalApiKey?.focus();
      return;
    }

    if (!window.browserAPI?.security?.scanVirusTotalUrl) {
      setVirusTotalLinkStatus('Link scanner unavailable. Restart app.', 'error');
      renderVirusTotalLinkReport(null);
      return;
    }

    const requestToken = ++virusTotalLinkScanToken;
    if (els.btnScanVirusTotalLink) {
      els.btnScanVirusTotalLink.disabled = true;
      els.btnScanVirusTotalLink.textContent = 'Scanning...';
    }
    setVirusTotalLinkStatus('Scanning link on VirusTotal...', '');
    renderVirusTotalLinkReport(null);

    try {
      const result = await window.browserAPI.security.scanVirusTotalUrl({ url: targetUrl, apiKey });
      if (requestToken !== virusTotalLinkScanToken) return;

      if (!result?.success) {
        setVirusTotalLinkStatus(result?.error || 'VirusTotal scan failed.', 'error');
        return;
      }

      renderVirusTotalLinkReport(result);

      const riskLevel = String(result.riskLevel || 'unknown').toLowerCase();
      if (riskLevel === 'danger') {
        setVirusTotalLinkStatus('Unsafe verdict returned for this link.', 'error');
      } else if (riskLevel === 'suspicious') {
        setVirusTotalLinkStatus('Suspicious signals were detected for this link.', 'warn');
      } else if (riskLevel === 'clean') {
        setVirusTotalLinkStatus('Safe verdict returned for this link.', 'success');
      } else {
        setVirusTotalLinkStatus('No strong verdict was returned for this link.', '');
      }
    } catch (error) {
      if (requestToken !== virusTotalLinkScanToken) return;
      setVirusTotalLinkStatus(error?.message || 'VirusTotal scan failed.', 'error');
      renderVirusTotalLinkReport(null);
    } finally {
      if (requestToken === virusTotalLinkScanToken && els.btnScanVirusTotalLink) {
        els.btnScanVirusTotalLink.disabled = false;
        els.btnScanVirusTotalLink.textContent = 'Scan Link';
      }
    }
  }

  bindLlmOperatorCards();

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

  async function runOmChatTransfer(kind = 'backup') {
    const isBackup = kind === 'backup';
    const invoke = isBackup ? window.browserAPI?.omChat?.syncDatabases : window.browserAPI?.omChat?.importDatabases;
    if (!invoke) {
      resetOmChatSyncLog();
      setOmChatSyncModalVisible(true);
      if (els.omchatSyncStatus) {
        els.omchatSyncStatus.textContent = 'Sync service is unavailable. Restart the app.';
      }
      appendOmChatSyncLog('Sync API missing. Please restart Om-X to load the latest preload.');
      setOmChatSyncProgress(0);
      return;
    }
    resetOmChatSyncLog();
    setOmChatSyncModalVisible(true);
    const localPath = String(els.omchatLocalDbPath?.value || '').trim();
    if (!localPath) {
      if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = 'Select a local folder first.';
      appendOmChatSyncLog('Please choose a local database folder before backup/import.');
      setOmChatSyncProgress(0);
      return;
    }
    appendOmChatSyncLog(isBackup ? 'Starting backup...' : 'Starting download...');
    setOmChatSyncProgress(5);
    if (els.omchatSyncBtn) {
      els.omchatSyncBtn.disabled = true;
      els.omchatSyncBtn.textContent = 'Working...';
    }
    if (els.omchatImportBtn) {
      els.omchatImportBtn.disabled = true;
      els.omchatImportBtn.textContent = 'Working...';
    }
    try {
      const result = await invoke();
      if (!result?.success) {
        if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = result?.error || 'Operation failed.';
        appendOmChatSyncLog(result?.error || 'Operation failed.');
      }
    } catch (error) {
      if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = error?.message || 'Operation failed.';
      appendOmChatSyncLog(error?.message || 'Operation failed.');
    } finally {
      if (els.omchatSyncBtn) {
        els.omchatSyncBtn.disabled = false;
        els.omchatSyncBtn.textContent = 'Backup Now';
      }
      if (els.omchatImportBtn) {
        els.omchatImportBtn.disabled = false;
        els.omchatImportBtn.textContent = 'Download Zip';
      }
    }
  }

  els.omchatSyncBtn?.addEventListener('click', async () => runOmChatTransfer('backup'));
  els.omchatImportBtn?.addEventListener('click', async () => runOmChatTransfer('import'));

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
        if (els.omchatSyncStatus) els.omchatSyncStatus.textContent = payload?.mode === 'import' ? 'Download completed.' : 'Backup completed.';
        appendOmChatSyncLog(payload?.mode === 'import' ? 'Download completed.' : 'Backup completed.');
        setOmChatSyncProgress(100);
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
      setVirusTotalPopupVisible(false);
      setActivePanel(targetId);
    });
  });

  const initialNav = document.querySelector('.sys-nav-item.active');
  if (initialNav?.dataset?.target) {
    setActivePanel(initialNav.dataset.target);
  }


  function renderBlockList(blocklist = []) {
    if (!els.blockListContainer) return;
    
    if (!Array.isArray(blocklist) || blocklist.length === 0) {
      els.blockListContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #71717a;"><p style="margin: 0; margin-bottom: 8px;">No blocked sites yet</p><span style="font-size: 12px;">Add domains above to block them</span></div>';
      return;
    }
    
    els.blockListContainer.innerHTML = '';
    [...blocklist].reverse().forEach((domain) => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255, 100, 100, 0.02);';
      const info = document.createElement('div');
      info.style.cssText = 'flex: 1; min-width: 0;';
      const title = document.createElement('div');
      title.style.cssText = 'color: #fff; font-weight: 500; font-size: 14px; word-break: break-all;';
      title.textContent = String(domain || '');
      const description = document.createElement('div');
      description.style.cssText = 'color: #71717a; font-size: 12px; margin-top: 4px;';
      description.textContent = 'Blocked by security system';
      info.appendChild(title);
      info.appendChild(description);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-block';
      removeBtn.dataset.domain = String(domain || '');
      removeBtn.style.cssText = 'background: rgba(255,100,100,0.2); color: #ff6464; border: 1px solid rgba(255,100,100,0.3); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; flex-shrink: 0; margin-left: 12px; white-space: nowrap;';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', (event) => {
        const targetDomain = event.currentTarget?.dataset?.domain;
        const updated = (currentSettings.blocklist || []).filter(d => d !== targetDomain);
        currentSettings.blocklist = updated;
        window.omniSettings.blocklist = updated;
        renderBlockList(updated);
      });

      item.appendChild(info);
      item.appendChild(removeBtn);
      els.blockListContainer.appendChild(item);
    });
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
      window.omniSettings = currentSettings;
      
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
      
      if (els.virusTotalApiKey) els.virusTotalApiKey.value = s.security?.virusTotal?.apiKey || '';
      if (els.featVirusTotalUrlScan) els.featVirusTotalUrlScan.checked = s.security?.virusTotal?.scanUrls ?? true;
      if (els.featVirusTotalFileScan) els.featVirusTotalFileScan.checked = s.security?.virusTotal?.scanExecutables ?? true;
      syncVirusTotalVisibility();
      setVirusTotalStatus('', '');
      resetVirusTotalLinkScan();

      syncLlmOperatorSelection(getFallbackLlmProvider(s));

      // Load OmChat DB settings
      const omchatSettings = s.omchat || {};
      if (els.omchatLocalDbPath) els.omchatLocalDbPath.value = omchatSettings.localDbPath || '';
      syncOmChatMongoToggle();

      // Load blocklist
      renderBlockList(s.blocklist || []);
      
      // Load whitelist
      renderWhitelist(s.adBlockerWhitelist || []);

      selectedTheme = applyThemeClass(s.theme || 'noir');
      renderShortcuts(s.shortcuts || {});
    } catch(e) { console.error("Settings load error:", e); }
  }

  if (els.btnSave) {
    els.btnSave.onclick = async () => {
      const newShortcuts = {};
      document.querySelectorAll('.shortcut-input').forEach(i => newShortcuts[i.dataset.key] = i.value.trim());
      const omchatPath = els.omchatLocalDbPath?.value.trim() || '';
      if (!omchatPath) {
        if (els.status) {
          els.status.textContent = 'Select an OmChat local folder before saving.';
          els.status.className = 'save-status visible error';
        }
        return;
      }

      const nextSettings = {
        ...window.omniSettings,
        features: { 
            ...window.omniSettings.features, 
            enableHistory: true,
            showLoadingAnimation: els.featLoadingAnim?.checked ?? false,
            enableFirewall: true, 
            enableAntivirus: true,
            enableVirusTotal: els.featVirusTotal?.checked ?? false
        },
        security: {
            ...(window.omniSettings.security || {}),
            virusTotal: {
                ...(window.omniSettings.security?.virusTotal || {}),
                apiKey: els.virusTotalApiKey?.value.trim() || '',
                scanUrls: els.featVirusTotalUrlScan?.checked ?? true,
                scanExecutables: els.featVirusTotalFileScan?.checked ?? true,
                blockOnSuspicious: true
            },
            popupBlocker: {
                ...(window.omniSettings.security?.popupBlocker || {}),
                enabled: true
            },
            cookieShield: {
                ...(window.omniSettings.security?.cookieShield || {}),
                enabled: true,
                blockThirdPartyRequestCookies: true,
                blockThirdPartyResponseCookies: true
            },
            sessionGuard: {
                ...(window.omniSettings.security?.sessionGuard || {}),
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
        shortcuts: newShortcuts,
        blocklist: currentSettings.blocklist || [],
        adBlockerWhitelist: currentSettings.adBlockerWhitelist || [],
        openDevToolsOnStart: false
      };
      els.btnSave.disabled = true; els.btnSave.textContent = "Saving...";
      const success = await window.browserAPI.settings.save(nextSettings);
      if (els.status) {
          els.status.textContent = success ? 'Saved.' : 'Error.';
          els.status.className = `save-status visible ${success ? '' : 'error'}`;
      }
      currentSettings = nextSettings;
      window.omniSettings = nextSettings;
      setTimeout(() => { if (els.status) els.status.classList.remove('visible'); els.btnSave.disabled = false; els.btnSave.textContent = "Save Changes"; }, 2000);
    };
  }

  // Block list handlers
  if (els.btnAddBlock) {
    els.btnAddBlock.addEventListener('click', () => {
      const domain = els.blockInputDomain?.value.trim();
      if (!domain) return;
      
      // Clean the domain (remove protocol if present)
      let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      if (!currentSettings.blocklist) currentSettings.blocklist = [];
      if (!currentSettings.blocklist.includes(cleanDomain)) {
        currentSettings.blocklist.push(cleanDomain);
        window.omniSettings.blocklist = currentSettings.blocklist;
        renderBlockList(currentSettings.blocklist);
        if (els.blockInputDomain) els.blockInputDomain.value = '';
      }
    });
  }

  // Allow Enter key to add domain
  if (els.blockInputDomain) {
    els.blockInputDomain.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') els.btnAddBlock?.click();
    });
  }

  // Whitelist handlers
  function renderWhitelist(whitelist = []) {
    if (!els.whitelistContainer) return;
    
    if (!Array.isArray(whitelist) || whitelist.length === 0) {
      els.whitelistContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #71717a;"><p style="margin: 0; margin-bottom: 8px;">No whitelisted sites yet</p><span style="font-size: 12px;">Add domains above to reduce ad blocking on them</span></div>';
      return;
    }
    
    els.whitelistContainer.innerHTML = '';
    [...whitelist].reverse().forEach((domain) => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(16,185,129,0.02);';
      const info = document.createElement('div');
      info.style.cssText = 'flex: 1; min-width: 0;';
      const title = document.createElement('div');
      title.style.cssText = 'color: #fff; font-weight: 500; font-size: 14px; word-break: break-all;';
      title.textContent = String(domain || '');
      const description = document.createElement('div');
      description.style.cssText = 'color: #71717a; font-size: 12px; margin-top: 4px;';
      description.textContent = 'Ad blocker reduced to popup-only mode';
      info.appendChild(title);
      info.appendChild(description);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-whitelist';
      removeBtn.dataset.domain = String(domain || '');
      removeBtn.style.cssText = 'background: rgba(16,185,129,0.2); color: #10b981; border: 1px solid rgba(16,185,129,0.3); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; flex-shrink: 0; margin-left: 12px; white-space: nowrap;';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', (event) => {
        const targetDomain = event.currentTarget?.dataset?.domain;
        const updated = (currentSettings.adBlockerWhitelist || []).filter(d => d !== targetDomain);
        currentSettings.adBlockerWhitelist = updated;
        window.omniSettings.adBlockerWhitelist = updated;
        renderWhitelist(updated);
      });

      item.appendChild(info);
      item.appendChild(removeBtn);
      els.whitelistContainer.appendChild(item);
    });
  }

  if (els.btnAddWhitelist) {
    els.btnAddWhitelist.addEventListener('click', () => {
      const domain = els.whitelistInputDomain?.value.trim();
      if (!domain) return;
      
      // Clean the domain (remove protocol if present)
      let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      if (!currentSettings.adBlockerWhitelist) currentSettings.adBlockerWhitelist = [];
      if (!currentSettings.adBlockerWhitelist.includes(cleanDomain)) {
        currentSettings.adBlockerWhitelist.push(cleanDomain);
        window.omniSettings.adBlockerWhitelist = currentSettings.adBlockerWhitelist;
        renderWhitelist(currentSettings.adBlockerWhitelist);
        if (els.whitelistInputDomain) els.whitelistInputDomain.value = '';
      }
    });
  }

  // Allow Enter key to add whitelisted domain
  if (els.whitelistInputDomain) {
    els.whitelistInputDomain.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') els.btnAddWhitelist?.click();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (els.virusTotalPopup && !els.virusTotalPopup.classList.contains('hidden')) {
      setVirusTotalPopupVisible(false);
    }
  });

  if (els.featVirusTotal) {
    els.featVirusTotal.addEventListener('change', syncVirusTotalVisibility);
  }

  if (els.featAdblockerMaster) {
    els.featAdblockerMaster.addEventListener('change', syncAdblockerToggles);
  }

  if (els.virusTotalApiKey) {
    els.virusTotalApiKey.addEventListener('input', () => {
      setVirusTotalStatus('', '');
      setVirusTotalQuotaCard(null);
      syncVirusTotalLinkTools();
    });
  }

  if (els.btnOpenVirusTotalPopup) {
    els.btnOpenVirusTotalPopup.addEventListener('click', () => {
      syncVirusTotalLinkTools();
      setVirusTotalPopupVisible(true);
    });
  }

  if (els.btnCloseVirusTotalPopup) {
    els.btnCloseVirusTotalPopup.addEventListener('click', () => {
      setVirusTotalPopupVisible(false);
    });
  }

  if (els.virusTotalPopup) {
    els.virusTotalPopup.addEventListener('click', (event) => {
      if (event.target === els.virusTotalPopup) {
        setVirusTotalPopupVisible(false);
      }
    });
  }

  if (els.btnVerifyVirusTotal) {
    els.btnVerifyVirusTotal.addEventListener('click', async () => {
      const apiKey = els.virusTotalApiKey?.value.trim() || '';
      if (!apiKey) {
        setVirusTotalQuotaCard(null);
        setVirusTotalStatus('Enter API key first.', 'error');
        return;
      }
      if (!window.browserAPI?.security?.verifyVirusTotalKey) {
        setVirusTotalQuotaCard(null);
        setVirusTotalStatus('Security bridge unavailable. Restart app.', 'error');
        return;
      }

      els.btnVerifyVirusTotal.disabled = true;
      els.btnVerifyVirusTotal.textContent = 'Verifying...';
      setVirusTotalStatus('Connecting to VirusTotal...', '');

      try {
        const result = await window.browserAPI.security.verifyVirusTotalKey(apiKey);
        if (result?.success) {
          setVirusTotalQuotaCard(result);
          syncVirusTotalLinkTools();
          const details = [];
          if (Number.isFinite(result?.dailyUsed)) {
            details.push(`Daily used: ${Number(result.dailyUsed).toLocaleString()}`);
          }
          if (Number.isFinite(result?.dailyQuota)) {
            details.push(`Daily limit: ${Number(result.dailyQuota).toLocaleString()}`);
          }
          if (Number.isFinite(result?.monthlyLeft)) {
            details.push(`Monthly left: ${Number(result.monthlyLeft).toLocaleString()}`);
          }
          if (Number.isFinite(result?.monthlyQuota)) {
            details.push(`Monthly limit: ${Number(result.monthlyQuota).toLocaleString()}`);
          }
          const detailText = details.length ? ` ${details.join(' | ')}` : '';
          setVirusTotalStatus(`Verified as ${result.userName || 'account'}.${detailText}`, 'success');
          return;
        }
        setVirusTotalQuotaCard(null);
        renderVirusTotalLinkReport(null);
        setVirusTotalStatus(result?.error || 'Verification failed.', 'error');
      } catch (error) {
        setVirusTotalQuotaCard(null);
        renderVirusTotalLinkReport(null);
        setVirusTotalStatus(error?.message || 'Verification failed.', 'error');
      } finally {
        els.btnVerifyVirusTotal.disabled = false;
        els.btnVerifyVirusTotal.textContent = 'Verify API';
      }
    });
  }

  if (els.btnScanVirusTotalLink) {
    els.btnScanVirusTotalLink.addEventListener('click', () => {
      scanVirusTotalLink();
    });
  }

  if (els.btnClearVirusTotalLink) {
    els.btnClearVirusTotalLink.addEventListener('click', () => {
      virusTotalLinkScanToken += 1;
      resetVirusTotalLinkScan({ preserveInput: false });
      els.virusTotalLinkInput?.focus();
    });
  }

  if (els.virusTotalLinkInput) {
    els.virusTotalLinkInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      scanVirusTotalLink();
    });
  }

  load();
});
