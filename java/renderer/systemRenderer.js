import { GoogleGenAI } from "@google/genai";

const THEMES = [
    { id: 'midnight', name: 'Default Dark', group: 'Primary' },
    { id: 'grass-green', name: 'Grass Green', group: 'Primary' },
    { id: 'deep-black', name: 'Deep Dark Black', group: 'Primary' },
    { id: 'dark-gray', name: 'Dark Gray', group: 'Primary' },
    { id: 'light-gray', name: 'Light Gray', group: 'Primary' },
    { id: 'sky-pink', name: 'Sky Pink', group: 'Primary' },
    { id: 'zen-minimal', name: 'Zen Minimal', group: 'Calm' },
    { id: 'matcha', name: 'Matcha Calm', group: 'Calm' },
    { id: 'lavender', name: 'Lavender Dream', group: 'Calm' },
    { id: 'ocean', name: 'Deep Ocean', group: 'Calm' }
];

const SHORTCUT_LABELS = {
    'new-tab': 'New Tab',
    'close-tab': 'Close Active Tab',
    'toggle-sidebar': 'Sidebar Collapse',
    'toggle-ai': 'Summon Omni AI',
    'toggle-system': 'System Settings',
    'take-screenshot': 'Quick Screenshot',
    'toggle-bookmarks': 'Bookmark Manager',
    'toggle-devtools': 'Inspect Tools',
    'toggle-fullscreen': 'Fullscreen',
    'quit-app': 'Safe Exit'
};

document.addEventListener('DOMContentLoaded', async () => {
  const els = {
    // System Panel
    homeUrl: document.getElementById('sys-home-url'),
    userAgent: document.getElementById('sys-user-agent'),
    devTools: document.getElementById('devtools-toggle'),
    // Features
    featHistory: document.getElementById('feat-history'),
    featLoadingAnim: document.getElementById('feat-loading-anim'),
    featAiChatBtn: document.getElementById('feat-ai-chat-btn'),
    // Security Panel
    featFirewall: document.getElementById('feat-firewall'),
    featAntivirus: document.getElementById('feat-antivirus'),
    // Adblock Panel
    adBlockMaster: document.getElementById('toggle-adblock-master'),
    adBlockTrackers: document.getElementById('toggle-adblock-trackers'),
    adBlockSocial: document.getElementById('toggle-adblock-social'),
    adBlockMiners: document.getElementById('toggle-adblock-miners'),
    adBlockCosmetic: document.getElementById('toggle-adblock-cosmetic'),
    adBlockCustom: document.getElementById('adblock-custom-rules'),
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
    themeContainer: document.getElementById('theme-categories-container'),
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
  let selectedTheme = 'midnight';

  // --- Core Navigation ---
  els.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      els.navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.dataset.target;
      
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
    });
  });

  // --- Mounting Logic ---
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

  function renderThemeGrid() {
      if (!els.themeContainer) return;
      els.themeContainer.innerHTML = '';
      const groups = [...new Set(THEMES.map(t => t.group))];
      groups.forEach(group => {
          const section = document.createElement('div');
          section.className = 'settings-section-card';
          section.innerHTML = `<span class="card-title">${group} Themes</span><div class="theme-grid"></div>`;
          const grid = section.querySelector('.theme-grid');
          THEMES.filter(t => t.group === group).forEach(theme => {
              const card = document.createElement('div');
              card.className = `theme-card ${selectedTheme === theme.id ? 'active' : ''}`;
              card.innerHTML = `<div class="theme-preview preview-${theme.id}"></div><span class="theme-name">${theme.name}</span>`;
              card.onclick = () => {
                  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
                  card.classList.add('active');
                  selectedTheme = theme.id;
                  document.body.className = `theme-${selectedTheme}`;
              };
              grid.appendChild(card);
          });
          els.themeContainer.appendChild(section);
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
      
      if (els.homeUrl) els.homeUrl.value = s.defaults?.homeUrl || '';
      if (els.userAgent) els.userAgent.value = s.defaults?.userAgent || '';
      if (els.devTools) els.devTools.checked = s.openDevToolsOnStart ?? false;

      if (els.featHistory) els.featHistory.checked = s.features?.enableHistory ?? true;
      if (els.featLoadingAnim) els.featLoadingAnim.checked = s.features?.showLoadingAnimation ?? true;
      if (els.featAiChatBtn) els.featAiChatBtn.checked = s.features?.showAIChatButton ?? true;

      if (els.featFirewall) els.featFirewall.checked = s.features?.enableFirewall ?? true;
      if (els.featAntivirus) els.featAntivirus.checked = s.features?.enableAntivirus ?? true;

      if (els.adBlockMaster) els.adBlockMaster.checked = s.adBlocker?.enabled ?? true;
      if (els.adBlockTrackers) els.adBlockTrackers.checked = s.adBlocker?.blockTrackers ?? true;
      if (els.adBlockSocial) els.adBlockSocial.checked = s.adBlocker?.blockSocial ?? true;
      if (els.adBlockMiners) els.adBlockMiners.checked = s.adBlocker?.blockMiners ?? true;
      if (els.adBlockCosmetic) els.adBlockCosmetic.checked = s.adBlocker?.cosmeticFiltering ?? true;
      if (els.adBlockCustom) els.adBlockCustom.value = (s.adBlocker?.customRules || []).join('\n');

      selectedTheme = s.theme || 'midnight';
      document.body.className = `theme-${selectedTheme}`;
      renderThemeGrid(); renderShortcuts(s.shortcuts || {}); loadAboutInfo();
    } catch(e) { console.error("Settings load error:", e); }
  }

  if (els.btnSave) {
    els.btnSave.onclick = async () => {
      const newShortcuts = {};
      document.querySelectorAll('.shortcut-input').forEach(i => newShortcuts[i.dataset.key] = i.value.trim());

      const nextSettings = {
        ...window.omniSettings,
        defaults: { ...window.omniSettings.defaults, homeUrl: els.homeUrl?.value.trim() || '', userAgent: els.userAgent?.value.trim() || '' },
        features: { 
            ...window.omniSettings.features, 
            enableHistory: els.featHistory?.checked ?? true, 
            showLoadingAnimation: els.featLoadingAnim?.checked ?? true,
            showAIChatButton: els.featAiChatBtn?.checked ?? true,
            enableFirewall: els.featFirewall?.checked ?? true, 
            enableAntivirus: els.featAntivirus?.checked ?? true
        },
        theme: selectedTheme,
        shortcuts: newShortcuts,
        adBlocker: { ...window.omniSettings.adBlocker, enabled: els.adBlockMaster?.checked ?? true, blockTrackers: els.adBlockTrackers?.checked ?? true, blockSocial: els.adBlockSocial?.checked ?? true, blockMiners: els.adBlockMiners?.checked ?? true, cosmeticFiltering: els.adBlockCosmetic?.checked ?? true, customRules: els.adBlockCustom?.value.split('\n').map(l => l.trim()).filter(l => l) || [] },
        openDevToolsOnStart: els.devTools?.checked ?? false
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

  load();
});