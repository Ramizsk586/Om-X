import { GoogleGenAI } from "@google/genai";

const THEMES = [
    // Dark & Modern
    { id: 'midnight-blend', name: 'Midnight Blend', group: 'Dark & Modern' },
    { id: 'obsidian', name: 'Obsidian Glass', group: 'Dark & Modern' },
    { id: 'carbon', name: 'Carbon Fiber', group: 'Dark & Modern' },
    { id: 'void', name: 'Deep Void', group: 'Dark & Modern' },
    { id: 'nordic', name: 'Nordic Night', group: 'Dark & Modern' },

    // Light & Clean
    { id: 'arctic', name: 'Arctic White', group: 'Light & Clean' },
    { id: 'pearl', name: 'Pearl Mist', group: 'Light & Clean' },
    { id: 'ivory', name: 'Ivory Clean', group: 'Light & Clean' },
    { id: 'frost', name: 'Winter Frost', group: 'Light & Clean' },

    // Gradient & Glass
    { id: 'aurora', name: 'Aurora Borealis', group: 'Gradient & Glass' },
    { id: 'sunset', name: 'Sunset Gradient', group: 'Gradient & Glass' },
    { id: 'twilight', name: 'Twilight Blend', group: 'Gradient & Glass' },
    { id: 'nebula', name: 'Cosmic Nebula', group: 'Gradient & Glass' },
    { id: 'prism', name: 'Prismatic Glass', group: 'Gradient & Glass' },

    // Pastel & Soft
    { id: 'blossom', name: 'Cherry Blossom', group: 'Pastel & Soft' },
    { id: 'cotton', name: 'Cotton Candy', group: 'Pastel & Soft' },
    { id: 'peach', name: 'Peach Cream', group: 'Pastel & Soft' },
    { id: 'sage', name: 'Soft Sage', group: 'Pastel & Soft' },
    { id: 'mauve', name: 'Dusty Mauve', group: 'Pastel & Soft' },

    // Cyber & Neon
    { id: 'cyber', name: 'Cyber Punk', group: 'Cyber & Neon' },
    { id: 'matrix', name: 'Matrix Code', group: 'Cyber & Neon' },
    { id: 'neon', name: 'Neon Nights', group: 'Cyber & Neon' },
    { id: 'synth', name: 'Synthwave', group: 'Cyber & Neon' },
    { id: 'hacker', name: 'Terminal Green', group: 'Cyber & Neon' },

    // Nature & Organic
    { id: 'forest', name: 'Deep Forest', group: 'Nature & Organic' },
    { id: 'ocean-waves', name: 'Ocean Waves', group: 'Nature & Organic' },
    { id: 'desert', name: 'Desert Sands', group: 'Nature & Organic' },
    { id: 'autumn', name: 'Autumn Leaves', group: 'Nature & Organic' },
    { id: 'tropical', name: 'Tropical Paradise', group: 'Nature & Organic' },

    // NEW THEMES
    // Premium Dark
    { id: 'titanium', name: 'Titanium Dark', group: 'Premium Dark' },
    { id: 'onyx', name: 'Onyx Night', group: 'Premium Dark' },
    { id: 'charcoal', name: 'Charcoal Glass', group: 'Premium Dark' },

    // Fresh Light
    { id: 'crisp-linen', name: 'Crisp Linen', group: 'Fresh Light' },
    { id: 'morning-haze', name: 'Morning Haze', group: 'Fresh Light' },

    // Golden Hour
    { id: 'sunrise-glow', name: 'Sunrise Glow', group: 'Golden Hour' },
    { id: 'honey-amber', name: 'Honey Amber', group: 'Golden Hour' },

    // Soft Pastel
    { id: 'lavender-dream', name: 'Lavender Dream', group: 'Soft Pastel' },
    { id: 'rose-petals', name: 'Rose Petals', group: 'Soft Pastel' },

    // Volcanic & Fire
    { id: 'volcanic-glass', name: 'Volcanic Glass', group: 'Volcanic & Fire' },
    { id: 'ember-glow', name: 'Ember Glow', group: 'Volcanic & Fire' },

    // Dramatic & Intense
    { id: 'crimson-storm', name: 'Crimson Storm', group: 'Dramatic & Intense' },
    { id: 'steel-blue', name: 'Steel Blue', group: 'Professional' },

    // Fresh & Crisp
    { id: 'mint-fresh', name: 'Mint Fresh', group: 'Fresh & Crisp' },
    { id: 'berry-smoothie', name: 'Berry Smoothie', group: 'Smooth & Sweet' },

    // Electric & Vibrant
    { id: 'plasma-purple', name: 'Plasma Purple', group: 'Electric & Vibrant' },
    { id: 'neon-cyan', name: 'Neon Cyan', group: 'Electric & Vibrant' },
    { id: 'solar-flare', name: 'Solar Flare', group: 'Energy & Power' },

    // Deep & Abyssal
    { id: 'deep-ocean', name: 'Deep Ocean', group: 'Deep & Abyssal' },
    { id: 'champagne-gold', name: 'Champagne Gold', group: 'Elegant & Warm' },
    { id: 'frostbite', name: 'Frostbite', group: 'Arctic & Cold' }
];

const SHORTCUT_LABELS = {
    'new-tab': 'New Tab',
    'open-scraber': 'Open Scraber Tab',
    'close-tab': 'Close Active Tab',
    'toggle-sidebar': 'Sidebar Collapse',
    'toggle-ai': 'Summon Omni AI',
    'toggle-system': 'System Settings',
    'take-screenshot': 'Quick Screenshot',
    'toggle-bookmarks': 'Bookmark Manager',
    'toggle-electron-apps': 'Electron Apps Panel',
    'toggle-devtools': 'Inspect Tools',
    'toggle-fullscreen': 'Fullscreen',
    'quit-app': 'Safe Exit'
};

const THEME_ALIAS_MAP = {
    dark: 'midnight-blend',
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

const resolveThemeId = (theme) => {
    const key = String(theme || '').trim();
    if (!key) return 'midnight-blend';
    return THEME_ALIAS_MAP[key] || key;
};

document.addEventListener('DOMContentLoaded', async () => {
  const els = {
    // System Panel
    devTools: document.getElementById('devtools-toggle'),
    devToolsStartup: document.getElementById('devtools-startup-toggle'),
    // Features
    featHistory: document.getElementById('feat-history'),
    featLoadingAnim: document.getElementById('feat-loading-anim'),
    featAiChatBtn: document.getElementById('feat-ai-chat-btn'),
    // Security Panel
    featFirewall: document.getElementById('feat-firewall'),
    featAntivirus: document.getElementById('feat-antivirus'),
    featVirusTotal: document.getElementById('feat-virustotal'),
    featCookieShield: document.getElementById('feat-cookie-shield'),
    featCookieThirdParty: document.getElementById('feat-cookie-third-party'),
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
    virusTotalScanUrl: document.getElementById('virustotal-scan-url'),
    btnScanVirusTotalUrl: document.getElementById('btn-scan-virustotal-url'),
    virusTotalScanStatus: document.getElementById('virustotal-scan-status'),
    virusTotalScanResult: document.getElementById('virustotal-scan-result'),
    // Block List Panel
    blockInputDomain: document.getElementById('block-input-domain'),
    btnAddBlock: document.getElementById('btn-add-block'),
    blockListContainer: document.getElementById('block-list-container'),
    // Adblock Panel
    adBlockMaster: document.getElementById('toggle-adblock-master'),
    adBlockTrackers: document.getElementById('toggle-adblock-trackers'),
    adBlockSocial: document.getElementById('toggle-adblock-social'),
    adBlockMiners: document.getElementById('toggle-adblock-miners'),
    adBlockCosmetic: document.getElementById('toggle-adblock-cosmetic'),
    adBlockYouTubeAddon: document.getElementById('toggle-adblock-youtube-addon'),
    adBlockCustom: document.getElementById('adblock-custom-rules'),
    btnOpenSafeSites: document.getElementById('btn-open-safe-sites'),
    safeSitesPopup: document.getElementById('safe-sites-popup'),
    btnCloseSafeSites: document.getElementById('btn-close-safe-sites'),
    safeSitesList: document.getElementById('safe-sites-list'),
    // Advanced Panel
    btnCheckUpdates: document.getElementById('btn-check-updates'),
    bannerTitle: document.getElementById('banner-status-title'),
    bannerDesc: document.getElementById('banner-status-desc'),
    bannerRing: document.getElementById('banner-status-ring'),
    updateHistory: document.getElementById('update-history-container'),
    // Footer / UI
    btnSave: document.getElementById('btn-save-settings'),
    status: document.getElementById('save-status'),
    navItems: document.querySelectorAll('.sys-nav-item'),
    panels: document.querySelectorAll('.settings-panel'),
    themeCards: document.querySelectorAll('.theme-preview-card'),
    accentOptions: document.querySelectorAll('.accent-color-option'),
    currentThemeName: document.getElementById('current-theme-name'),
    btnSaveTheme: document.getElementById('btn-save-theme'),
    btnSaveAppearance: document.getElementById('btn-save-settings-appearance'),
    shortcutsContainer: document.getElementById('shortcuts-container'),
    actionsFooter: document.querySelector('.actions-footer'),
    // Creator Panel Elements
    projectsGrid: document.getElementById('creator-projects-grid'),
    statRepos: document.querySelector('.stat-box-compact:nth-child(1) .value'),
    statFollowers: document.querySelector('.stat-box-compact:nth-child(2) .value'),
    // About Panel Elements
    aboutVChrome: document.getElementById('about-v-chrome'),
    aboutVElectron: document.getElementById('about-v-electron'),
    aboutVNode: document.getElementById('about-v-node'),
    aboutVV8: document.getElementById('about-v-v8'),
    btnAboutCheckUpdates: document.getElementById('btn-about-check-updates')
  };

  let currentSettings = {};
  let selectedTheme = 'midnight-blend';

  function setVirusTotalStatus(message = '', type = '') {
    if (!els.virusTotalVerifyStatus) return;
    els.virusTotalVerifyStatus.textContent = message;
    els.virusTotalVerifyStatus.className = `virustotal-status ${type}`.trim();
  }

  function setVirusTotalScanStatus(message = '', type = '') {
    if (!els.virusTotalScanStatus) return;
    els.virusTotalScanStatus.textContent = message;
    els.virusTotalScanStatus.className = `virustotal-status ${type}`.trim();
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

  function setSafeSitesPopupVisible(visible) {
    if (!els.safeSitesPopup) return;
    els.safeSitesPopup.classList.toggle('hidden', !visible);
    els.safeSitesPopup.setAttribute('aria-hidden', String(!visible));
  }

  function renderSafeSitesList(sites = []) {
    if (!els.safeSitesList) return;

    els.safeSitesList.innerHTML = '';
    if (!Array.isArray(sites) || sites.length === 0) {
      els.safeSitesList.innerHTML = '<div class="safe-sites-empty">No safe sites marked yet.</div>';
      return;
    }

    sites.forEach((site) => {
      const siteIdentity = String(site || '').trim();
      if (!siteIdentity) return;

      const item = document.createElement('div');
      item.className = 'safe-sites-item';

      const domainEl = document.createElement('div');
      domainEl.className = 'safe-sites-domain';
      domainEl.textContent = siteIdentity;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'safe-sites-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', async () => {
        if (!window.browserAPI?.vault?.sites?.untrust) {
          els.safeSitesList.innerHTML = '<div class="safe-sites-empty error">Safe-site API unavailable. Restart app.</div>';
          return;
        }

        removeBtn.disabled = true;
        removeBtn.textContent = 'Removing...';
        try {
          await window.browserAPI.vault.sites.untrust(siteIdentity);
          await loadTrustedSafeSites();
        } catch (error) {
          removeBtn.disabled = false;
          removeBtn.textContent = 'Remove';
        }
      });

      item.appendChild(domainEl);
      item.appendChild(removeBtn);
      els.safeSitesList.appendChild(item);
    });
  }

  async function loadTrustedSafeSites() {
    if (!els.safeSitesList) return;
    if (!window.browserAPI?.vault?.sites?.listTrusted) {
      els.safeSitesList.innerHTML = '<div class="safe-sites-empty error">Safe-site API unavailable. Restart app.</div>';
      return;
    }

    els.safeSitesList.innerHTML = '<div class="safe-sites-empty">Loading safe sites...</div>';
    try {
      const trustedSites = await window.browserAPI.vault.sites.listTrusted();
      const sorted = Array.isArray(trustedSites)
        ? trustedSites.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))
        : [];
      renderSafeSitesList(sorted);
    } catch (error) {
      els.safeSitesList.innerHTML = `<div class="safe-sites-empty error">${escapeHtml(error?.message || 'Failed to load safe sites.')}</div>`;
    }
  }

  function renderVirusTotalCard(report) {
    if (!els.virusTotalScanResult) return;
    if (!report || !report.success) {
      els.virusTotalScanResult.innerHTML = '';
      els.virusTotalScanResult.classList.add('is-hidden');
      return;
    }

    const stats = report.stats || {};
    const detections = Array.isArray(report.detections) ? report.detections : [];
    const riskLevel = report.riskLevel || 'unknown';
    const riskText = riskLevel === 'danger'
      ? 'Danger'
      : riskLevel === 'suspicious'
        ? 'Suspicious'
        : riskLevel === 'clean'
          ? 'Clean'
          : 'Unknown';
    const scanDate = report.scanDate ? new Date(report.scanDate).toLocaleString() : 'N/A';
    const categories = Array.isArray(report.categories) && report.categories.length > 0
      ? report.categories.join(', ')
      : 'Uncategorized';

    const detectionLines = detections.length > 0
      ? detections.slice(0, 8).map((item) => {
          const engine = escapeHtml(item.engine || 'Unknown Engine');
          const result = escapeHtml(item.result || item.category || 'flagged');
          return `<div class="virustotal-detection-item"><strong>${engine}</strong>: ${result}</div>`;
        }).join('')
      : '<div class="virustotal-detection-item">No malicious engines reported in current analysis.</div>';

    els.virusTotalScanResult.innerHTML = `
      <div class="virustotal-risk-header">
        <div class="virustotal-risk-badge ${escapeHtml(riskLevel)}">${escapeHtml(riskText)}</div>
        <div class="virustotal-meta-line">Risk Score: ${Number(report.riskScore || 0)}%</div>
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
        <div class="virustotal-detections-title">Engine Detections</div>
        ${detectionLines}
      </div>
    `;
    els.virusTotalScanResult.classList.remove('is-hidden');
  }

  function syncVirusTotalVisibility() {
    if (!els.virusTotalConfig) return;
    const enabled = Boolean(els.featVirusTotal?.checked);
    els.virusTotalConfig.classList.toggle('is-hidden', !enabled);
    if (!enabled) {
      setVirusTotalStatus('', '');
      setVirusTotalQuotaCard(null);
      setVirusTotalScanStatus('', '');
      renderVirusTotalCard(null);
      setVirusTotalPopupVisible(false);
      return;
    }
  }

  // --- Core Navigation ---
  els.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      els.navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.dataset.target;
      setSafeSitesPopupVisible(false);
      setVirusTotalPopupVisible(false);
      
      els.panels.forEach(p => {
        const isActive = p.id === targetId;
        p.classList.toggle('active', isActive);
        if (isActive && targetId === 'panel-advanced') loadUpdateHistory();
        if (isActive && targetId === 'panel-creator') syncCreatorGitHub();
        if (isActive && targetId === 'panel-about') loadAboutInfo();
        if (isActive && targetId === 'panel-search-matrix') loadMatrixSearchPanel();
        if (isActive && targetId === 'panel-password-vault') loadVaultPanel();
      });

      if (targetId === 'panel-creator' || targetId === 'panel-about' || targetId === 'panel-password-vault') {
          els.actionsFooter.style.display = 'none';
      } else {
          els.actionsFooter.style.display = 'flex';
      }
      if (targetId === 'panel-appearance') {
          els.actionsFooter.style.display = 'none';
      }
    });
  });

  function renderBlockList(blocklist = []) {
    if (!els.blockListContainer) return;
    
    if (!Array.isArray(blocklist) || blocklist.length === 0) {
      els.blockListContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #71717a;"><p style="margin: 0; margin-bottom: 8px;">No blocked sites yet</p><span style="font-size: 12px;">Websites will appear here as they are blocked by the security firewall</span></div>';
      return;
    }
    
    els.blockListContainer.innerHTML = '';
    blocklist.reverse().forEach((domain, idx) => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255, 100, 100, 0.02);';
      item.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="color: #fff; font-weight: 500; font-size: 14px; word-break: break-all;">${domain}</div>
          <div style="color: #71717a; font-size: 12px; margin-top: 4px;">Blocked by security system</div>
        </div>
        <button class="btn-remove-block" data-domain="${domain}" style="background: rgba(255,100,100,0.2); color: #ff6464; border: 1px solid rgba(255,100,100,0.3); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; flex-shrink: 0; margin-left: 12px; white-space: nowrap;">Remove</button>
      `;
      els.blockListContainer.appendChild(item);
    });
    
    document.querySelectorAll('.btn-remove-block').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const domain = e.target.dataset.domain;
        const updated = (currentSettings.blocklist || []).filter(d => d !== domain);
        currentSettings.blocklist = updated;
        window.omniSettings.blocklist = updated;
        renderBlockList(updated);
      });
    });
  }

  // --- Load function ---
  function loadVaultPanel() {
      const p = document.getElementById('panel-password-vault');
      if (p && !p.dataset.mounted) {
          import('./vault.js').then(m => m.mountVaultPanel(p));
      }
  }

  function loadMatrixSearchPanel() {
      const p = document.getElementById('panel-search-matrix');
      if (p && !p.dataset.mounted) {
          import('./matrix-search.js').then(m => m.mountMatrixSearchPanel(p));
      }
  }

  // --- About Logic ---
  function loadAboutInfo() {
      if (typeof process !== 'undefined' && process.versions) {
          if (els.aboutVChrome) els.aboutVChrome.textContent = process.versions.chrome || 'Unknown';
          if (els.aboutVElectron) els.aboutVElectron.textContent = process.versions.electron || 'Unknown';
          if (els.aboutVNode) els.aboutVNode.textContent = process.versions.node || 'Unknown';
          if (els.aboutVV8) els.aboutVV8.textContent = process.versions.v8 || 'Unknown';
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
          const tile = document.createElement('div');
          tile.className = 'project-tile-compact';
          tile.innerHTML = `
              <div class="proj-header">
                  <div class="proj-tag">Module</div>
              </div>
              <span class="proj-name">${repo.name}</span>
              <p class="proj-desc">${repo.description || 'System component and development logic.'}</p>
          `;
          tile.onclick = () => window.browserAPI.openTab(repo.html_url);
          els.projectsGrid.appendChild(tile);
      });

      const tiles = els.projectsGrid.querySelectorAll('.project-tile-compact');
      tiles.forEach((t, i) => setTimeout(() => t.classList.add('visible'), i * 50));
  }

  function setupAppearancePanel() {
      // Theme card selection
      els.themeCards.forEach(card => {
          card.addEventListener('click', () => {
              // Remove active from all cards
              els.themeCards.forEach(c => c.classList.remove('active'));
              // Add active to clicked card
              card.classList.add('active');
              // Update selected theme
              selectedTheme = resolveThemeId(card.dataset.theme);
              // Update preview text
              if (els.currentThemeName) {
                  els.currentThemeName.textContent = card.querySelector('.theme-name')?.textContent || selectedTheme;
              }
              // Apply theme preview to body
              document.body.className = `theme-${selectedTheme}`;
              // Show unsaved changes indicator
              if (els.btnSave) {
                  els.btnSave.textContent = 'Save Changes*';
                  els.btnSave.style.color = '#7c4dff';
              }
          });
      });

      // Accent color selection
      els.accentOptions.forEach(option => {
          option.addEventListener('click', () => {
              els.accentOptions.forEach(o => o.classList.remove('active'));
              option.classList.add('active');
              // Could add accent color application here
              if (els.btnSave) {
                  els.btnSave.textContent = 'Save Changes*';
                  els.btnSave.style.color = '#7c4dff';
              }
          });
      });

      // Quick save theme button
      if (els.btnSaveTheme) {
          els.btnSaveTheme.addEventListener('click', async () => {
              if (els.btnSave) els.btnSave.click();
          });
      }
      if (els.btnSaveAppearance) {
          els.btnSaveAppearance.addEventListener('click', async () => {
              if (els.btnSave) els.btnSave.click();
          });
      }

      // Set initial active state based on saved theme
      const savedTheme = resolveThemeId(currentSettings.theme || 'midnight-blend');
      els.themeCards.forEach(card => {
          if (resolveThemeId(card.dataset.theme) === savedTheme) {
              card.classList.add('active');
              if (els.currentThemeName) {
                  els.currentThemeName.textContent = card.querySelector('.theme-name')?.textContent || savedTheme;
              }
          } else {
              card.classList.remove('active');
          }
      });
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
        row.innerHTML = `<div class="toggle-info"><span class="toggle-title">${SHORTCUT_LABELS[key]}</span></div><input type="text" class="shortcut-input" data-key="${key}" value="${shortcuts[key] || ''}" style="width: 160px; text-align: right; background: #27272a; border-radius: 6px; padding: 6px; color: #fff; font-family: monospace; border: 1px solid #3f3f46; cursor: pointer;">`;
        setupRecorder(row.querySelector('.shortcut-input'));
        els.shortcutsContainer.appendChild(row);
    });
  }

  async function loadUpdateHistory() {
      try {
          const history = await window.browserAPI.updater.getHistory();
          if (!els.updateHistory) return;
          els.updateHistory.innerHTML = '';
          if (!history || history.length === 0) { 
              els.updateHistory.innerHTML = '<div style="font-size:12px;opacity:0.3;text-align:center;padding:40px;">No updates found.</div>'; 
              return; 
          }
          history.forEach((v, idx) => {
              const item = document.createElement('div');
              item.className = `update-item ${v.isCurrent ? 'current' : ''}`;
              item.innerHTML = `<div class="update-info"><div class="update-version">v${v.version} ${v.isCurrent ? '<span class="badge-current">Installed</span>' : ''}</div><div class="update-meta">Released ${new Date(v.installDate).toLocaleDateString()}</div></div><div class="update-actions"><button class="btn-update-action ${v.isCurrent ? 'secondary' : ''}" data-version="${v.version}">${v.isCurrent ? 'Reinstall' : 'Rollback'}</button></div>`;
              item.querySelector('.btn-update-action').onclick = async () => { 
                  if (els.bannerTitle) els.bannerTitle.textContent = `Preparing v${v.version}...`;
                  await window.browserAPI.updater.rollback(v.version); 
              };
              els.updateHistory.appendChild(item);
          });
      } catch(e) { }
  }

  if (els.btnCheckUpdates) {
      els.btnCheckUpdates.onclick = async () => {
          els.btnCheckUpdates.disabled = true; els.btnCheckUpdates.textContent = "Checking...";
          try { await window.browserAPI.updater.check(); setTimeout(() => { els.btnCheckUpdates.disabled = false; els.btnCheckUpdates.textContent = "Check for Updates"; }, 2000); } catch(e) { els.btnCheckUpdates.disabled = false; }
      };
  }

  async function load(injectedSettings = null) {
    try {
      currentSettings = injectedSettings || await window.browserAPI.settings.get();
      // Authority sync: Sub-panels depend on this object being global to avoid stale saves
      window.omniSettings = currentSettings;
      
      const s = currentSettings;
      
      if (els.devTools) els.devTools.checked = s.openDevToolsOnStart ?? false;
      if (els.devToolsStartup) els.devToolsStartup.checked = s.openDevToolsOnStart ?? false;

      if (els.featHistory) els.featHistory.checked = s.features?.enableHistory ?? true;
      if (els.featLoadingAnim) els.featLoadingAnim.checked = s.features?.showLoadingAnimation ?? true;
      if (els.featAiChatBtn) els.featAiChatBtn.checked = s.features?.showAIChatButton ?? true;

      if (els.featFirewall) els.featFirewall.checked = s.features?.enableFirewall ?? true;
      if (els.featAntivirus) els.featAntivirus.checked = s.features?.enableAntivirus ?? true;
      if (els.featVirusTotal) els.featVirusTotal.checked = s.features?.enableVirusTotal ?? false;
      if (els.featCookieShield) els.featCookieShield.checked = s.security?.cookieShield?.enabled ?? true;
      if (els.featCookieThirdParty) {
        const req = s.security?.cookieShield?.blockThirdPartyRequestCookies ?? true;
        const res = s.security?.cookieShield?.blockThirdPartyResponseCookies ?? true;
        els.featCookieThirdParty.checked = Boolean(req && res);
      }
      if (els.virusTotalApiKey) els.virusTotalApiKey.value = s.security?.virusTotal?.apiKey || '';
      if (els.featVirusTotalUrlScan) els.featVirusTotalUrlScan.checked = s.security?.virusTotal?.scanUrls ?? true;
      if (els.featVirusTotalFileScan) els.featVirusTotalFileScan.checked = s.security?.virusTotal?.scanExecutables ?? true;
      syncVirusTotalVisibility();
      setVirusTotalStatus('', '');
      setVirusTotalScanStatus('', '');
      renderVirusTotalCard(null);

      if (els.adBlockMaster) els.adBlockMaster.checked = s.adBlocker?.enabled ?? true;
      if (els.adBlockTrackers) els.adBlockTrackers.checked = s.adBlocker?.blockTrackers ?? true;
      if (els.adBlockSocial) els.adBlockSocial.checked = s.adBlocker?.blockSocial ?? true;
      if (els.adBlockMiners) els.adBlockMiners.checked = s.adBlocker?.blockMiners ?? true;
      if (els.adBlockCosmetic) els.adBlockCosmetic.checked = s.adBlocker?.cosmeticFiltering ?? true;
      if (els.adBlockYouTubeAddon) els.adBlockYouTubeAddon.checked = s.adBlocker?.youtubeAddonEnabled ?? false;
      if (els.adBlockCustom) els.adBlockCustom.value = (s.adBlocker?.customRules || []).join('\n');

      // Load blocklist
      renderBlockList(s.blocklist || []);

      selectedTheme = resolveThemeId(s.theme || 'midnight-blend');
      document.body.className = `theme-${selectedTheme}`;
      setupAppearancePanel(); renderShortcuts(s.shortcuts || {}); loadAboutInfo();
    } catch(e) { console.error("Settings load error:", e); }
  }

  if (els.btnSave) {
    els.btnSave.onclick = async () => {
      const newShortcuts = {};
      document.querySelectorAll('.shortcut-input').forEach(i => newShortcuts[i.dataset.key] = i.value.trim());

      const nextSettings = {
        ...window.omniSettings,
        features: { 
            ...window.omniSettings.features, 
            enableHistory: els.featHistory?.checked ?? true, 
            showLoadingAnimation: els.featLoadingAnim?.checked ?? true,
            showAIChatButton: els.featAiChatBtn?.checked ?? true,
            enableFirewall: els.featFirewall?.checked ?? true, 
            enableAntivirus: els.featAntivirus?.checked ?? true,
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
            cookieShield: {
                ...(window.omniSettings.security?.cookieShield || {}),
                enabled: els.featCookieShield?.checked ?? true,
                blockThirdPartyRequestCookies: (els.featCookieShield?.checked ?? true) && (els.featCookieThirdParty?.checked ?? true),
                blockThirdPartyResponseCookies: (els.featCookieShield?.checked ?? true) && (els.featCookieThirdParty?.checked ?? true)
            }
        },
        theme: selectedTheme,
        shortcuts: newShortcuts,
        blocklist: currentSettings.blocklist || [],
        adBlocker: { 
            ...window.omniSettings.adBlocker, 
            enabled: els.adBlockMaster?.checked ?? true, 
            blockTrackers: els.adBlockTrackers?.checked ?? true, 
            blockSocial: els.adBlockSocial?.checked ?? true, 
            blockMiners: els.adBlockMiners?.checked ?? true, 
            cosmeticFiltering: els.adBlockCosmetic?.checked ?? true, 
            youtubeAddonEnabled: els.adBlockYouTubeAddon?.checked ?? false,
            customRules: els.adBlockCustom?.value.split('\n').map(l => l.trim()).filter(l => l) || [] 
        },
        openDevToolsOnStart: els.devToolsStartup?.checked ?? false
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

  if (els.btnOpenSafeSites) {
    els.btnOpenSafeSites.addEventListener('click', async () => {
      setSafeSitesPopupVisible(true);
      await loadTrustedSafeSites();
    });
  }

  if (els.btnCloseSafeSites) {
    els.btnCloseSafeSites.addEventListener('click', () => {
      setSafeSitesPopupVisible(false);
    });
  }

  if (els.safeSitesPopup) {
    els.safeSitesPopup.addEventListener('click', (event) => {
      if (event.target === els.safeSitesPopup) {
        setSafeSitesPopupVisible(false);
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (els.safeSitesPopup && !els.safeSitesPopup.classList.contains('hidden')) {
      setSafeSitesPopupVisible(false);
    }
    if (els.virusTotalPopup && !els.virusTotalPopup.classList.contains('hidden')) {
      setVirusTotalPopupVisible(false);
    }
  });

  if (els.featVirusTotal) {
    els.featVirusTotal.addEventListener('change', syncVirusTotalVisibility);
  }

  if (els.btnOpenVirusTotalPopup) {
    els.btnOpenVirusTotalPopup.addEventListener('click', () => {
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
        setVirusTotalStatus(result?.error || 'Verification failed.', 'error');
      } catch (error) {
        setVirusTotalQuotaCard(null);
        setVirusTotalStatus(error?.message || 'Verification failed.', 'error');
      } finally {
        els.btnVerifyVirusTotal.disabled = false;
        els.btnVerifyVirusTotal.textContent = 'Verify API';
      }
    });
  }

  const runManualVirusTotalUrlScan = async () => {
    const targetUrl = els.virusTotalScanUrl?.value.trim() || '';
    if (!targetUrl) {
      setVirusTotalScanStatus('Paste a URL first.', 'error');
      renderVirusTotalCard(null);
      return;
    }

    const apiKey = els.virusTotalApiKey?.value.trim() || '';
    if (!apiKey) {
      setVirusTotalScanStatus('API key is required. Add key and verify first.', 'error');
      renderVirusTotalCard(null);
      return;
    }

    if (!window.browserAPI?.security?.scanVirusTotalUrl) {
      setVirusTotalScanStatus('Security scan bridge unavailable. Restart app.', 'error');
      renderVirusTotalCard(null);
      return;
    }

    if (els.btnScanVirusTotalUrl) {
      els.btnScanVirusTotalUrl.disabled = true;
      els.btnScanVirusTotalUrl.textContent = 'Scanning...';
    }
    setVirusTotalScanStatus('Scanning URL on VirusTotal...', '');
    renderVirusTotalCard(null);

    try {
      const result = await window.browserAPI.security.scanVirusTotalUrl({ url: targetUrl, apiKey });
      if (!result?.success) {
        setVirusTotalScanStatus(result?.error || 'Scan failed.', 'error');
        renderVirusTotalCard(null);
        return;
      }

      renderVirusTotalCard(result);
      if (result.safe) {
        setVirusTotalScanStatus('Scan completed. No active malicious verdict.', 'success');
      } else {
        setVirusTotalScanStatus('Risk detected. This URL is dangerous or suspicious.', 'error');
      }
    } catch (error) {
      setVirusTotalScanStatus(error?.message || 'Scan failed.', 'error');
      renderVirusTotalCard(null);
    } finally {
      if (els.btnScanVirusTotalUrl) {
        els.btnScanVirusTotalUrl.disabled = false;
        els.btnScanVirusTotalUrl.textContent = 'Scan URL';
      }
    }
  };

  if (els.btnScanVirusTotalUrl) {
    els.btnScanVirusTotalUrl.addEventListener('click', runManualVirusTotalUrlScan);
  }

  if (els.virusTotalScanUrl) {
    els.virusTotalScanUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runManualVirusTotalUrlScan();
      }
    });
  }

  // Expose safe sites reload function globally so it can be called from other contexts
  window._reloadSafeSites = loadTrustedSafeSites;

  load();
});
// Listen for site-trusted events from the main renderer and refresh safe sites list if popup is visible
window.addEventListener('site-trusted', async (event) => {
  const safeSitesPopup = document.getElementById('safe-sites-popup');
  if (safeSitesPopup && !safeSitesPopup.classList.contains('hidden') && typeof window._reloadSafeSites === 'function') {
    try {
      await window._reloadSafeSites();
    } catch (error) {
      console.warn('[Safe Sites] Failed to refresh after trust event:', error);
    }
  }
});
