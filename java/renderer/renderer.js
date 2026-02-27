import { TabManager } from './ui/tabs.js';
import { SidePanel } from './ui/sidePanel.js';
import { ScreenshotOverlay } from './ui/screenshotOverlay.js';
import { BookmarkPanel } from './ui/bookmarkPanel.js';
import { ElectronAppsPanel } from './ui/electronAppsPanel.js';
import { DownloadPanel } from './ui/downloadPanel.js';
import { TranslatorUI } from './ui/translator.js';
import { WriterUI } from './ui/writer.js';
import { initSearchSystem } from './search.js';

document.addEventListener('DOMContentLoaded', async () => {
  // --- SPEECH ENGINE INITIALIZATION ---
  window.speechManager = {
    synth: window.speechSynthesis,
    speak: (text) => {
      if (!text) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google'))) || 
                    voices.find(v => v.lang.startsWith('en')) || 
                    voices[0];
      if (voice) utter.voice = voice;
      utter.rate = 1.0;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    },
    stop: () => window.speechSynthesis.cancel()
  };
  window.speechSynthesis.getVoices();

  const iconPickerOverlay = document.getElementById('icon-picker-overlay');
  const iconGrid = document.getElementById('icon-grid');
  const btnClosePicker = document.getElementById('btn-close-picker');

  const shortcutOverlay = document.getElementById('shortcut-modal-overlay');
  const shortcutNameInput = document.getElementById('shortcut-name-input');
  const shortcutKeyRecorder = document.getElementById('shortcut-key-recorder');
  const btnShortcutCancel = document.getElementById('btn-shortcut-cancel');
  const btnShortcutSave = document.getElementById('btn-shortcut-save');

  const featuresHomePopup = document.getElementById('features-home-popup');

  const imageDlOverlay = document.getElementById('image-dl-overlay');
  const imageDlPreview = document.getElementById('image-dl-preview');
  const btnImageDlCancel = document.getElementById('btn-image-dl-cancel');
  const dlFormatBtns = document.querySelectorAll('.dl-format-btn');

  const vtLinkScanOverlay = document.getElementById('vt-link-scan-overlay');
  const vtScanTargetUrl = document.getElementById('vt-scan-target-url');
  const vtScanStatus = document.getElementById('vt-scan-status');
  const vtScanReport = document.getElementById('vt-scan-report');
  const btnVtCloseTop = document.getElementById('btn-vt-close-top');
  const btnVtClose = document.getElementById('btn-vt-close');
  const btnVtOpenLink = document.getElementById('btn-vt-open-link');

  const btnDelay = document.getElementById('btn-ss-delay');
  const delayDropdown = document.getElementById('delay-dropdown');
  const delayLabel = document.getElementById('delay-label');
  const delayOptions = document.querySelectorAll('.delay-option');
  const btnLens = document.getElementById('btn-ss-lens');

  const downloadToast = document.getElementById('download-toast');
  const dlFilename = downloadToast?.querySelector('.dl-toast-filename');
  const dlStatus = downloadToast?.querySelector('.dl-toast-status');
  const dlFill = downloadToast?.querySelector('.dl-toast-fill');
  const dlCancelBtn = document.getElementById('btn-download-toast-cancel');

  const youtubeAddonShell = document.getElementById('youtube-addon-shell');
  const youtubeAddonTrigger = document.getElementById('youtube-addon-trigger');
  const youtubeAddonPopup = document.getElementById('youtube-addon-popup');
  const youtubeAddonToggleShorts = document.getElementById('youtube-addon-toggle-shorts');
  const youtubeAddonToggleHome = document.getElementById('youtube-addon-toggle-home');
  const youtubeAddonToggleBlur = document.getElementById('youtube-addon-toggle-blur');
  const youtubeAddonToggleChat = document.getElementById('youtube-addon-toggle-chat');
  const youtubeAddonToggleSubscribe = document.getElementById('youtube-addon-toggle-subscribe');
  const youtubeAddonToggleAds = document.getElementById('youtube-addon-toggle-ads');
  const youtubeAddonToggleBw = document.getElementById('youtube-addon-toggle-bw');
  
  // Use paths relative to this renderer file (java/renderer) -> project root -> html
  const HOME_URL = new URL('../../html/pages/home.html', import.meta.url).href;
  const SETTINGS_URL = new URL('../../html/windows/system.html', import.meta.url).href;
  const HISTORY_URL = new URL('../../html/pages/history.html', import.meta.url).href;
  const AI_CHAT_URL = new URL('../../html/pages/omni-chat.html', import.meta.url).href;
  const NEURAL_HUB_URL = new URL('../../html/windows/neural-hub.html', import.meta.url).href;
  const TODO_STATION_URL = new URL('../../html/pages/todo.html', import.meta.url).href;
  const GAMES_URL = new URL('../../html/pages/games.html', import.meta.url).href;
  const MINECRAFT_URL = new URL('../../html/pages/minecraft.html', import.meta.url).href;
  const PDF_VIEWER_URL = new URL('../../html/pages/pdf-viewer.html', import.meta.url).href;
  const SCRABER_URL = new URL('../../html/pages/ai-settings.html#scraber', import.meta.url).href;
  
  let cachedSettings = null;
  let currentTabContextId = null;
  let currentImageToDownload = null;
  let toastTimeout = null;
  let activeToastDownloadId = null;
  let screenshotDelaySeconds = 0;
  let vtScanRequestToken = 0;
  const darkModeTabs = new Set(); // Track tabs with dark mode enabled
  let tabManager = null;

  const webviewContextMenu = document.getElementById('webview-context-menu');
  const tabContextMenu = document.getElementById('tab-context-menu');
  const sidePanelContextMenu = document.createElement('div');
  sidePanelContextMenu.id = 'sidebar-context-menu';
  sidePanelContextMenu.className = 'context-menu hidden';
  sidePanelContextMenu.style.cssText = 'position: fixed; background: var(--glass-bg); backdrop-filter: var(--glass-blur); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; min-width: 200px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); z-index: 50001; display: flex; flex-direction: column;';
  document.body.appendChild(sidePanelContextMenu);

  const hiddenSidebarContextMenu = document.createElement('div');
  hiddenSidebarContextMenu.id = 'hidden-sidebar-context-menu';
  hiddenSidebarContextMenu.className = 'context-menu hidden';
  hiddenSidebarContextMenu.style.cssText = 'position: fixed; background: var(--glass-bg); backdrop-filter: var(--glass-blur); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; min-width: 200px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); z-index: 50001; display: flex; flex-direction: column;';
  document.body.appendChild(hiddenSidebarContextMenu);

  const contextMenuBackdrop = document.createElement('div');
  contextMenuBackdrop.id = 'context-menu-backdrop';
  contextMenuBackdrop.className = 'hidden';
  // Keep backdrop below all custom menus (.context-menu uses z-index: 10000)
  // so menu items remain clickable while outside clicks still dismiss.
  contextMenuBackdrop.style.cssText = 'position: fixed; inset: 0; z-index: 9999; background: transparent;';
  document.body.appendChild(contextMenuBackdrop);

  const removeDynamicContextSubmenus = () => {
      document.querySelectorAll('.context-menu-submenu').forEach((el) => el.remove());
      document.querySelectorAll('.context-menu-item.submenu-open').forEach((el) => el.classList.remove('submenu-open'));
  };

  const closeAllContextMenus = () => {
      removeDynamicContextSubmenus();
      webviewContextMenu?.classList.add('hidden');
      tabContextMenu?.classList.add('hidden');
      sidePanelContextMenu?.classList.add('hidden');
      hiddenSidebarContextMenu?.classList.add('hidden');
      contextMenuBackdrop?.classList.add('hidden');
  };

  const showContextMenuBackdrop = () => {
      contextMenuBackdrop?.classList.remove('hidden');
  };

  contextMenuBackdrop.addEventListener('mousedown', (e) => {
      e.preventDefault();
      closeAllContextMenus();
  });

  contextMenuBackdrop.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      closeAllContextMenus();
  });

  const escapeHtml = (value = '') => {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
  };

  const siteInfoOverlay = document.createElement('div');
  siteInfoOverlay.id = 'site-info-overlay';
  siteInfoOverlay.className = 'hidden';
  siteInfoOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 50010;
      background: rgba(1, 6, 18, 0.46);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
      overflow: auto;
  `;
  siteInfoOverlay.innerHTML = `
      <div id="site-info-panel" style="
          width: min(500px, calc(100vw - 14px));
          max-height: calc(100vh - 14px);
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, rgba(14,18,36,0.96), rgba(9,12,26,0.96));
          border: 1px solid rgba(124, 77, 255, 0.18);
          border-radius: 14px;
          box-shadow: 0 26px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04);
          padding: 10px;
          overflow: hidden;
          color: rgba(255,255,255,0.94);
      ">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
              <div>
                  <div style="font-size:14px; font-weight:700; letter-spacing:.02em;">Site Info</div>
                  <div id="site-info-subtitle" style="font-size:10px; color:rgba(255,255,255,0.58); margin-top:1px;">Active tab diagnostics</div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                  <button id="btn-site-info-refresh" type="button" style="
                      border: 1px solid rgba(255,255,255,0.08);
                      background: rgba(255,255,255,0.04);
                      color: rgba(255,255,255,0.88);
                      border-radius: 9px;
                      padding: 6px 9px;
                      font-size: 11px;
                      cursor: pointer;
                  ">Refresh</button>
                  <button id="btn-site-info-close" type="button" style="
                      width: 28px;
                      height: 28px;
                      border-radius: 9px;
                      border: 1px solid rgba(255,255,255,0.08);
                      background: rgba(255,255,255,0.04);
                      color: rgba(255,255,255,0.88);
                      cursor: pointer;
                      font-size: 14px;
                      line-height: 1;
                  ">×</button>
              </div>
          </div>
          <div id="site-info-status" style="
              margin-bottom: 8px;
              border-radius: 10px;
              padding: 7px 9px;
              background: rgba(255,255,255,0.03);
              border: 1px solid rgba(255,255,255,0.05);
              color: rgba(255,255,255,0.72);
              font-size: 11px;
          ">Press Refresh to load details.</div>
          <div id="site-info-grid" style="
              flex: 1 1 auto;
              min-height: 0;
              overflow: auto;
              padding-right: 3px;
              display: grid;
              grid-template-columns: minmax(90px, 110px) minmax(0, 1fr);
              gap: 6px 8px;
              align-content: start;
          "></div>
      </div>
  `;
  document.body.appendChild(siteInfoOverlay);

  const siteInfoPanel = document.getElementById('site-info-panel');
  const siteInfoGrid = document.getElementById('site-info-grid');
  const siteInfoStatus = document.getElementById('site-info-status');
  const siteInfoSubtitle = document.getElementById('site-info-subtitle');
  const btnSiteInfoRefresh = document.getElementById('btn-site-info-refresh');
  const btnSiteInfoClose = document.getElementById('btn-site-info-close');
  let siteInfoRefreshToken = 0;

  const hideSiteInfoPopup = () => {
      siteInfoOverlay?.classList.add('hidden');
  };

  const setSiteInfoStatus = (message, tone = 'neutral') => {
      if (!siteInfoStatus) return;
      const toneStyles = {
          neutral: 'rgba(255,255,255,0.03);rgba(255,255,255,0.05);rgba(255,255,255,0.72)',
          info: 'rgba(79,195,247,0.08);rgba(79,195,247,0.18);rgba(212,241,255,0.92)',
          ok: 'rgba(71,196,78,0.08);rgba(71,196,78,0.2);rgba(221,255,224,0.92)',
          warn: 'rgba(255,193,7,0.08);rgba(255,193,7,0.2);rgba(255,246,205,0.94)',
          error: 'rgba(244,67,54,0.08);rgba(244,67,54,0.2);rgba(255,226,226,0.94)'
      };
      const [bg, border, color] = (toneStyles[tone] || toneStyles.neutral).split(';');
      siteInfoStatus.textContent = message || '';
      siteInfoStatus.style.background = bg;
      siteInfoStatus.style.borderColor = border;
      siteInfoStatus.style.color = color;
  };

  const renderSiteInfoRows = (rows = []) => {
      if (!siteInfoGrid) return;
      siteInfoGrid.innerHTML = rows.map((row) => `
          <div style="
              color: rgba(255,255,255,0.56);
              font-size: 11px;
              letter-spacing: .04em;
              text-transform: uppercase;
              align-self: start;
              padding-top: 2px;
          ">${escapeHtml(row.label)}</div>
          <div style="
              min-width: 0;
              color: rgba(255,255,255,0.95);
              font-size: 11px;
              line-height: 1.3;
              word-break: break-word;
              background: rgba(255,255,255,0.025);
              border: 1px solid rgba(255,255,255,0.04);
              border-radius: 8px;
              padding: 6px 8px;
          ">${escapeHtml(row.value ?? 'N/A')}</div>
      `).join('');
  };

  const formatMs = (value) => {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? `${Math.round(n)} ms` : 'N/A';
  };

  const getActiveTabState = () => {
      if (!tabManager?.tabs?.length || !tabManager?.activeTabId) return null;
      return tabManager.tabs.find(t => t.id === tabManager.activeTabId) || null;
  };

  const getPageTypeLabel = (tab) => {
      if (!tab) return 'Unknown';
      if (tab.isSystemPage) return 'System';
      if (tab.isHistoryPage) return 'History';
      if (tab.isAIChatPage) return 'AI Chat';
      if (tab.isHomePage) return 'Home';
      if (tab.isDefensePage) return 'Security Alert';
      return 'Website';
  };

  const collectWebviewDiagnostics = async (webview) => {
      if (!webview?.executeJavaScript) return {};
      try {
          const result = await Promise.race([
              webview.executeJavaScript(`
                  (async () => {
                      const out = {
                          livePingMs: null,
                          navPingMs: null,
                          loadMs: null,
                          online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
                          lang: typeof navigator !== 'undefined' ? (navigator.language || '') : '',
                          connectionType: '',
                          downlink: null
                      };
                      try {
                          const nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
                          if (nav) {
                              if (Number.isFinite(nav.responseStart) && nav.responseStart > 0) out.navPingMs = Math.round(nav.responseStart);
                              if (Number.isFinite(nav.loadEventEnd) && nav.loadEventEnd > 0) out.loadMs = Math.round(nav.loadEventEnd);
                          }
                      } catch (_) {}
                      try {
                          const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                          if (conn) {
                              out.connectionType = conn.effectiveType || conn.type || '';
                              out.downlink = Number.isFinite(conn.downlink) ? conn.downlink : null;
                          }
                      } catch (_) {}
                      try {
                          const target = (location && /^https?:/i.test(location.href || ''))
                              ? (location.origin || location.href)
                              : '';
                          if (target && typeof fetch === 'function') {
                              const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                              const start = performance.now();
                              let timer = null;
                              if (controller) timer = setTimeout(() => controller.abort(), 1400);
                              try {
                                  await fetch(target, { method: 'HEAD', cache: 'no-store', mode: 'no-cors', signal: controller ? controller.signal : undefined });
                                  out.livePingMs = Math.max(1, Math.round(performance.now() - start));
                              } catch (_) {}
                              if (timer) clearTimeout(timer);
                          }
                      } catch (_) {}
                      return out;
                  })();
              `),
              new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 1800))
          ]);
          return (result && typeof result === 'object') ? result : {};
      } catch (_) {
          return {};
      }
  };

  const buildSiteInfoRows = (data) => ([
      { label: 'URL', value: data.url || 'N/A' },
      { label: 'Title', value: data.title || 'Untitled' },
      { label: 'Host', value: data.host || 'N/A' },
      { label: 'Ping', value: formatMs(data.pingMs) },
      { label: 'Ads Blocked (Tab)', value: String(data.adBlockedCount ?? 0) },
      { label: 'Ads Blocked (Session)', value: String(data.adBlockedTotal ?? 0) },
      { label: 'Protocol', value: data.protocol || 'N/A' },
      { label: 'Secure', value: data.isSecure ? 'Yes (HTTPS)' : 'No' },
      { label: 'Status', value: data.isLoading ? 'Loading' : 'Ready' },
      { label: 'Page Type', value: data.pageType || 'Unknown' },
      { label: 'Audible', value: data.audible ? 'Yes' : 'No' },
      { label: 'Ad Shield', value: data.adShieldEnabled ? 'Enabled' : 'Disabled' },
      { label: 'Load Time', value: formatMs(data.loadMs) },
      { label: 'Connection', value: data.connectionLabel || 'N/A' },
      { label: 'Tab ID', value: String(data.tabId ?? 'N/A') },
      { label: 'Engine ID', value: String(data.webContentsId ?? 'N/A') }
  ]);

  const refreshSiteInfoPopup = async () => {
      const activeTab = getActiveTabState();
      const activeWebview = tabManager?.getActiveWebview?.();
      const token = ++siteInfoRefreshToken;

      if (!activeTab || !activeWebview) {
          siteInfoSubtitle.textContent = 'No active webview';
          renderSiteInfoRows([{ label: 'Message', value: 'Open a website tab and try Alt+G again.' }]);
          setSiteInfoStatus('No active webview tab found.', 'warn');
          return;
      }

      siteInfoSubtitle.textContent = activeTab.titleEl?.textContent || 'Active tab diagnostics';
      setSiteInfoStatus('Collecting page diagnostics...', 'info');

      let runtime = {};
      try {
          runtime = await collectWebviewDiagnostics(activeWebview);
      } catch (_) {}
      if (token !== siteInfoRefreshToken) return;

      let adBlockStats = { count: 0, totalCount: 0 };
      try {
          const wcId = activeWebview.getWebContentsId?.();
          if (wcId && window.browserAPI?.security?.getAdBlockStats) {
              adBlockStats = await window.browserAPI.security.getAdBlockStats(wcId);
          }
      } catch (_) {}
      if (token !== siteInfoRefreshToken) return;

      let parsedUrl = null;
      try { parsedUrl = new URL(activeTab.url || activeWebview.getURL?.() || ''); } catch (_) {}
      const adShieldEnabled = cachedSettings?.adBlocker?.enabled !== false;
      const connectionLabelParts = [];
      if (runtime?.connectionType) connectionLabelParts.push(String(runtime.connectionType));
      if (Number.isFinite(runtime?.downlink)) connectionLabelParts.push(`${runtime.downlink} Mbps`);

      const data = {
          tabId: activeTab.id,
          webContentsId: activeWebview.getWebContentsId?.() || 'N/A',
          url: activeTab.url || activeWebview.getURL?.() || '',
          title: activeTab.titleEl?.textContent || activeWebview.getTitle?.() || '',
          host: parsedUrl?.hostname || '',
          protocol: parsedUrl?.protocol?.replace(':', '').toUpperCase() || '',
          isSecure: parsedUrl?.protocol === 'https:',
          isLoading: !!activeTab.isLoading,
          audible: !!activeTab.audible,
          pageType: getPageTypeLabel(activeTab),
          pingMs: runtime?.livePingMs ?? runtime?.navPingMs ?? null,
          loadMs: runtime?.loadMs ?? null,
          adBlockedCount: Number(adBlockStats?.count) || 0,
          adBlockedTotal: Number(adBlockStats?.totalCount) || 0,
          adShieldEnabled,
          connectionLabel: connectionLabelParts.join(' • ') || (runtime?.online === false ? 'Offline' : '')
      };

      renderSiteInfoRows(buildSiteInfoRows(data));
      const updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSiteInfoStatus(`Updated ${updatedAt}${runtime?.timeout ? ' • ping timed out' : ''}`, runtime?.online === false ? 'warn' : 'ok');
  };

  const openSiteInfoPopup = async () => {
      siteInfoOverlay.classList.remove('hidden');
      await refreshSiteInfoPopup();
  };

  siteInfoOverlay.addEventListener('mousedown', (e) => {
      if (e.target === siteInfoOverlay) hideSiteInfoPopup();
  });
  siteInfoPanel?.addEventListener('mousedown', (e) => e.stopPropagation());
  btnSiteInfoClose?.addEventListener('click', hideSiteInfoPopup);
  btnSiteInfoRefresh?.addEventListener('click', () => { refreshSiteInfoPopup(); });

  const getFileExtensionFromTarget = (target = '') => {
      const raw = String(target || '').trim();
      if (!raw) return '';
      try {
          const url = new URL(raw);
          const pathname = decodeURIComponent(url.pathname || '');
          const dot = pathname.lastIndexOf('.');
          return dot >= 0 ? pathname.slice(dot).toLowerCase() : '';
      } catch (_) {
          const clean = raw.split(/[?#]/)[0];
          const dot = clean.lastIndexOf('.');
          return dot >= 0 ? clean.slice(dot).toLowerCase() : '';
      }
  };

  const resolveOpenedFileTarget = (filePath = '') => {
      const ext = getFileExtensionFromTarget(filePath);
      const pdfStationExtensions = new Set([
          '.pdf', '.doc', '.docx', '.rtf', '.odt', '.ppt', '.pptx', '.xls', '.xlsx'
      ]);
      const directTabExtensions = new Set([
          '.html', '.htm', '.txt', '.md', '.json', '.xml', '.csv', '.log'
      ]);

      if (pdfStationExtensions.has(ext)) {
          return `${PDF_VIEWER_URL}?file=${encodeURIComponent(filePath)}`;
      }
      if (directTabExtensions.has(ext)) {
          return filePath;
      }
      return filePath;
  };

  const hideVtLinkScanOverlay = () => {
      vtLinkScanOverlay?.classList.add('hidden');
  };

  const setVtScanStatus = (message = '', type = '') => {
      if (!vtScanStatus) return;
      vtScanStatus.textContent = message;
      vtScanStatus.className = `vt-scan-status ${type}`.trim();
  };

  const renderVtScanReport = (report) => {
      if (!vtScanReport) return;
      if (!report || !report.success) {
          vtScanReport.innerHTML = '';
          vtScanReport.classList.add('hidden');
          return;
      }

      const stats = report.stats || {};
      const detections = Array.isArray(report.detections) ? report.detections : [];
      const riskLevel = report.riskLevel || 'unknown';
      const riskLabel = riskLevel === 'danger'
        ? 'Danger'
        : riskLevel === 'suspicious'
          ? 'Suspicious'
          : riskLevel === 'clean'
            ? 'Clean'
            : 'Unknown';
      const categories = Array.isArray(report.categories) && report.categories.length
        ? report.categories.join(', ')
        : 'Uncategorized';
      const scanDate = report.scanDate ? new Date(report.scanDate).toLocaleString() : 'N/A';

      const detectionRows = detections.length
        ? detections.slice(0, 10).map((row) => {
            const engine = escapeHtml(row.engine || 'Unknown Engine');
            const result = escapeHtml(row.result || row.category || 'flagged');
            return `<div class="vt-detection-item"><strong>${engine}</strong>: ${result}</div>`;
          }).join('')
        : '<div class="vt-detection-item">No malicious engines reported in current analysis.</div>';

      vtScanReport.innerHTML = `
        <div class="vt-risk-header">
          <span class="vt-risk-badge ${escapeHtml(riskLevel)}">${escapeHtml(riskLabel)}</span>
          <span class="vt-risk-score">Risk Score: ${Number(report.riskScore || 0)}%</span>
        </div>
        <div class="vt-report-url">${escapeHtml(report.url || '')}</div>
        <div class="vt-stats-grid">
          <div class="vt-stat"><div class="vt-stat-k">Malicious</div><div class="vt-stat-v">${Number(stats.malicious || 0)}</div></div>
          <div class="vt-stat"><div class="vt-stat-k">Suspicious</div><div class="vt-stat-v">${Number(stats.suspicious || 0)}</div></div>
          <div class="vt-stat"><div class="vt-stat-k">Harmless</div><div class="vt-stat-v">${Number(stats.harmless || 0)}</div></div>
          <div class="vt-stat"><div class="vt-stat-k">Undetected</div><div class="vt-stat-v">${Number(stats.undetected || 0)}</div></div>
        </div>
        <div class="vt-meta-line">Categories: ${escapeHtml(categories)}</div>
        <div class="vt-meta-line">Reputation: ${Number(report.reputation || 0)} | Engines: ${Number(report.engineCount || 0)} | Last Scan: ${escapeHtml(scanDate)}</div>
        <div class="vt-meta-line">${escapeHtml(report.reason || '')}</div>
        <div class="vt-detections">
          <div class="vt-detections-title">Engine Detections</div>
          ${detectionRows}
        </div>
      `;
      vtScanReport.classList.remove('hidden');
  };

  const openScannedLink = () => {
      const targetUrl = String(vtLinkScanOverlay?.dataset?.targetUrl || '').trim();
      if (targetUrl && tabManager?.createTab) {
          tabManager.createTab(targetUrl);
      }
      hideVtLinkScanOverlay();
  };

  const scanLinkWithVirusTotal = async (rawUrl) => {
      const targetUrl = String(rawUrl || '').trim();
      if (!targetUrl) return;

      if (!vtLinkScanOverlay || !vtScanTargetUrl) {
          return;
      }

      vtLinkScanOverlay.dataset.targetUrl = targetUrl;
      vtScanTargetUrl.textContent = targetUrl;
      if (btnVtOpenLink) btnVtOpenLink.disabled = false;
      renderVtScanReport(null);
      setVtScanStatus('Preparing VirusTotal scan...', '');
      vtLinkScanOverlay.classList.remove('hidden');

      const requestToken = ++vtScanRequestToken;
      let apiKey = String(cachedSettings?.security?.virusTotal?.apiKey || '').trim();

      if (!apiKey) {
          try {
              const latestSettings = await window.browserAPI.settings.get();
              if (requestToken !== vtScanRequestToken) return;
              if (latestSettings) cachedSettings = latestSettings;
              apiKey = String(latestSettings?.security?.virusTotal?.apiKey || '').trim();
          } catch (_) {}
      }

      if (requestToken !== vtScanRequestToken) return;

      if (!apiKey) {
          setVtScanStatus('VirusTotal API key missing. Add it in Settings > Security.', 'error');
          return;
      }

      if (!window.browserAPI?.security?.scanVirusTotalUrl) {
          setVtScanStatus('VirusTotal scanner unavailable. Restart app.', 'error');
          return;
      }

      setVtScanStatus('Scanning URL on VirusTotal...', '');
      try {
          const report = await window.browserAPI.security.scanVirusTotalUrl({ url: targetUrl, apiKey });
          if (requestToken !== vtScanRequestToken) return;

          if (!report?.success) {
              setVtScanStatus(report?.error || 'VirusTotal scan failed.', 'error');
              renderVtScanReport(null);
              return;
          }

          renderVtScanReport(report);
          if (report.safe) {
              setVtScanStatus('Scan complete: no active malicious verdict.', 'success');
          } else {
              setVtScanStatus('Warning: malicious or suspicious detections found.', 'error');
          }
      } catch (error) {
          if (requestToken !== vtScanRequestToken) return;
          setVtScanStatus(error?.message || 'VirusTotal scan failed.', 'error');
          renderVtScanReport(null);
      }
  };

  btnVtCloseTop?.addEventListener('click', hideVtLinkScanOverlay);
  btnVtClose?.addEventListener('click', hideVtLinkScanOverlay);
  btnVtOpenLink?.addEventListener('click', openScannedLink);
  vtLinkScanOverlay?.addEventListener('mousedown', (event) => {
      if (event.target === vtLinkScanOverlay) hideVtLinkScanOverlay();
  });

  // Dark mode CSS to inject into webviews
  const darkModeCSS = `
    /* Om-X Auto Dark Mode - Enhanced */
    :root, html, body {
      background: radial-gradient(circle at 20% 20%, #20232b 0%, #12141a 40%, #0d0f14 100%) !important;
      color: #e5e7eb !important;
      font-family: "Inter", "Segoe UI", system-ui, sans-serif !important;
    }

    *:not(img):not(video):not(canvas):not(svg):not(iframe):not(embed):not(object) {
      background-color: transparent !important;
      color: inherit !important;
      border-color: rgba(255,255,255,0.14) !important;
    }

    a, a:visited, a:link { color: #67e8f9 !important; }
    a:hover { color: #a5f3fc !important; }

    h1, h2, h3, h4, h5, h6 { color: #f8fafc !important; }
    p, li, span, div { color: #e5e7eb !important; }

    /* Cards / panels */
    section, article, .card, .panel, .container, .box {
      background: rgba(255,255,255,0.03) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      backdrop-filter: blur(6px);
      border-radius: 10px;
    }

    /* Form controls */
    input, textarea, select, button {
      background: #1f232d !important;
      color: #e5e7eb !important;
      border: 1px solid rgba(255,255,255,0.12) !important;
      border-radius: 8px !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }
    input::placeholder, textarea::placeholder { color: #9ca3af !important; }
    button { background: linear-gradient(135deg, #2c3140, #252a35) !important; }
    button:hover { background: linear-gradient(135deg, #343a4a, #2b3040) !important; }

    /* Tables */
    table, th, td {
      background: rgba(255,255,255,0.02) !important;
      border-color: rgba(255,255,255,0.1) !important;
    }
    th { background: rgba(255,255,255,0.06) !important; }

    /* Code blocks */
    code, pre {
      background: #1b1f27 !important;
      color: #f8fafc !important;
      border-radius: 8px;
    }

    /* Scrollbars */
    ::-webkit-scrollbar { width: 10px; background: #0f1116 !important; }
    ::-webkit-scrollbar-thumb { background: #303644 !important; border-radius: 10px; }

    /* Media remains bright enough */
    img, video, canvas, svg, iframe, embed, object {
      filter: brightness(0.92) contrast(1.08) !important;
    }

    /* Force common light backgrounds dark */
    [style*="background-color: white"],
    [style*="background-color: #fff"],
    [style*="background-color: #ffffff"] {
      background-color: #111318 !important;
    }
    [style*="color: black"],
    [style*="color: #000"],
    [style*="color: #000000"] {
      color: #e5e7eb !important;
    }
  `;

  // Toggle dark mode for a specific tab
  const toggleDarkModeForTab = async (tabId) => {
      const tab = tabManager.tabs.find(t => t.id === tabId);
      if (!tab || !tab.webview) return;
      
      const isDarkMode = darkModeTabs.has(tabId);
      
      try {
          if (isDarkMode) {
              // Disable dark mode
              await tab.webview.executeJavaScript(`
                  (function() {
                      const style = document.getElementById('omx-dark-mode-style');
                      if (style) {
                          style.remove();
                          return true;
                      }
                      return false;
                  })();
              `);
              darkModeTabs.delete(tabId);
          } else {
              // Enable dark mode
              await tab.webview.executeJavaScript(`
                  (function() {
                      let style = document.getElementById('omx-dark-mode-style');
                      if (!style) {
                          style = document.createElement('style');
                          style.id = 'omx-dark-mode-style';
                          style.textContent = \`${darkModeCSS.replace(/`/g, '\\`')}\`;
                          document.head.appendChild(style);
                          return true;
                      }
                      return false;
                  })();
              `);
              darkModeTabs.add(tabId);
          }
      } catch (e) {
          console.error('[Dark Mode] Failed to toggle dark mode:', e);
      }
  };

  const attachToAIChat = (text) => {
      const chatTab = tabManager.tabs.find(t => t.url === AI_CHAT_URL || t.url.includes('omni-chat.html'));
      if (chatTab && chatTab.webview) {
          chatTab.webview.send('init-image', { text, filename: `Snippet-${Date.now().toString().slice(-4)}.txt` });
          tabManager.setActiveTab(chatTab.id);
      } else {
          const newId = tabManager.createTab(AI_CHAT_URL);
          const checkLoad = setInterval(() => {
              const tab = tabManager.tabs.find(t => t.id === newId);
              if (tab && tab.webview && !tab.isLoading) {
                  clearInterval(checkLoad);
                  setTimeout(() => {
                    tab.webview.send('init-image', { text, filename: `Snippet-${Date.now().toString().slice(-4)}.txt` });
                  }, 300);
              }
          }, 500);
      }
  };

  const handleWebviewContextMenu = (params) => {
      closeAllContextMenus();
      if (!webviewContextMenu) return;
      webviewContextMenu.innerHTML = '';
      const activeWebview = tabManager.getActiveWebview();
      const sidePanelState = sidePanel?.getState?.() || { isHidden: false, isCollapsed: false };

      const createMenuItem = (targetMenu, label, icon) => {
          const item = document.createElement('div');
          item.className = 'context-menu-item';
          item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="${icon}" fill="currentColor"/></svg><span>${label}</span>`;
          targetMenu.appendChild(item);
          return item;
      };

      const addAction = (targetMenu, label, icon, click) => {
          const item = createMenuItem(targetMenu, label, icon);
          item.onclick = () => {
              try { click(); } finally { closeAllContextMenus(); }
          };
          return item;
      };

      const addDivider = (targetMenu, compact = false) => {
          const divider = document.createElement('div');
          divider.style.cssText = `height:1px; background:rgba(255,255,255,0.1); margin:${compact ? '2px' : '4px'} 0;`;
          targetMenu.appendChild(divider);
      };

      const renderEntries = (targetMenu, entries = []) => {
          entries.forEach((entry) => {
              if (!entry) return;
              if (entry.type === 'divider') return addDivider(targetMenu, !!entry.compact);
              if (entry.type === 'action') return addAction(targetMenu, entry.label, entry.icon, entry.click);
          });
      };

      const openSubmenu = (triggerItem, entries) => {
          if (!entries?.length) return;
          const wasOpen = triggerItem.classList.contains('submenu-open');
          removeDynamicContextSubmenus();
          if (wasOpen) return;

          triggerItem.classList.add('submenu-open');

          const submenu = document.createElement('div');
          submenu.className = 'context-menu context-menu-submenu';
          submenu.style.cssText = `
              position: fixed;
              width: 220px;
              z-index: 10001;
              padding: 6px;
              display: flex;
              flex-direction: column;
              gap: 2px;
          `;

          renderEntries(submenu, entries);
          document.body.appendChild(submenu);

          const rect = triggerItem.getBoundingClientRect();
          const submenuRect = submenu.getBoundingClientRect();
          const viewportPadding = 8;
          const gap = 6;
          let left = rect.right + gap;
          let top = rect.top - 2;

          if (left + submenuRect.width > window.innerWidth - viewportPadding) {
              left = rect.left - submenuRect.width - gap;
          }
          if (left < viewportPadding) left = viewportPadding;
          if (top + submenuRect.height > window.innerHeight - viewportPadding) {
              top = window.innerHeight - submenuRect.height - viewportPadding;
          }
          if (top < viewportPadding) top = viewportPadding;

          submenu.style.left = `${left}px`;
          submenu.style.top = `${top}px`;

          submenu.addEventListener('mousedown', (e) => e.stopPropagation());
          submenu.addEventListener('contextmenu', (e) => e.stopPropagation());
      };

      const addSubmenu = (label, icon, entries) => {
          if (!entries?.length) return;
          const item = createMenuItem(webviewContextMenu, label, icon);
          item.style.justifyContent = 'space-between';

          const arrow = document.createElement('span');
          arrow.textContent = '›';
          arrow.style.cssText = 'margin-left:auto; color:rgba(255,255,255,0.6); font-size:16px; line-height:1;';
          item.appendChild(arrow);

          item.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              openSubmenu(item, entries);
          });

          item.addEventListener('mouseenter', () => {
              const openTrigger = webviewContextMenu.querySelector('.context-menu-item.submenu-open');
              if (openTrigger && openTrigger !== item) {
                  openSubmenu(item, entries);
              }
          });

          return item;
      };

      const systemEntries = [
          { type: 'action', label: 'Minimize', icon: 'M19 13H5v-2h14v2z', click: () => window.browserAPI?.window?.minimize?.() },
          { type: 'action', label: 'Maximize / Restore', icon: 'M4 4h16v16H4V4zm2 2v12h12V6H6z', click: () => window.browserAPI?.window?.toggleMaximize?.() },
          { type: 'action', label: 'Close Window', icon: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z', click: () => window.browserAPI?.window?.close?.() }
      ];

      const pageEntries = [
          { type: 'action', label: 'Back', icon: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z', click: () => activeWebview?.goBack() },
          { type: 'action', label: 'Reload', icon: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z', click: () => activeWebview?.reload() }
      ];

      if (!params.selectionText) {
          const yt = getYouTubeAddonSettings(cachedSettings);
          if (yt.enabled) {
              pageEntries.push({ type: 'divider', compact: true });
              if (yt.hideAddonIcon) {
                  pageEntries.push({ type: 'action', label: 'Unhide YouTube Addon', icon: 'M12 5c-7.63 0-11 6.5-11 6.5S4.37 18 12 18s11-6.5 11-6.5S19.63 5 12 5zm0 11c-2.49 0-4.5-2.01-4.5-4.5S9.51 7 12 7s4.5 2.01 4.5 4.5S14.49 16 12 16zm0-7.2A2.7 2.7 0 1 0 12 14.2 2.7 2.7 0 0 0 12 8.8z', click: () => persistYouTubeAddonPreferences({ ytHideAddonIcon: false }) });
              } else {
                  pageEntries.push({ type: 'action', label: 'Hide YouTube Addon', icon: 'M2.1 4.93l1.41-1.41 17.38 17.38-1.41 1.41-2.2-2.2A12.9 12.9 0 0 1 12 21C4.37 21 1 14.5 1 14.5a20.7 20.7 0 0 1 5.08-5.93L2.1 4.93zM12 8a4.5 4.5 0 0 1 4.5 4.5c0 .76-.19 1.48-.52 2.12l-6.1-6.1c.64-.33 1.36-.52 2.12-.52zm0-3c7.63 0 11 6.5 11 6.5a20.57 20.57 0 0 1-3.5 4.55l-1.43-1.43A18.35 18.35 0 0 0 20.6 11.5C19.66 10.24 16.73 7 12 7c-.87 0-1.7.11-2.47.31L7.87 5.65C9.17 5.23 10.55 5 12 5z', click: () => persistYouTubeAddonPreferences({ ytHideAddonIcon: true }) });
              }
          }
      }

      if (params.linkURL) {
          pageEntries.push(
              { type: 'divider', compact: true },
              { type: 'action', label: 'Open Link in New Tab', icon: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z', click: () => tabManager.createTab(params.linkURL) },
              { type: 'action', label: 'Scan URL (VirusTotal)', icon: 'M12 2l8 3v6c0 5-3.4 9.74-8 11-4.6-1.26-8-6-8-11V5l8-3zm-1 6v4H8v2h3v3h2v-3h3v-2h-3V8h-2z', click: () => scanLinkWithVirusTotal(params.linkURL) }
          );
      }

      if (params.hasImageContents || params.srcURL) {
          const imageActions = [
              { type: 'action', label: 'Download Image...', icon: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z', click: () => openImageDownloadOptions(params.srcURL) },
              { type: 'action', label: 'Open Image in New Tab', icon: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z', click: () => tabManager.createTab(params.srcURL) }
          ];

          const imageUrlForLens = String(params.srcURL || '').trim();
          if (/^https?:\/\//i.test(imageUrlForLens)) {
              imageActions.push({
                  type: 'action',
                  label: 'Search with Google Lens',
                  icon: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
                  click: () => {
                      const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrlForLens)}`;
                      tabManager.createTab(lensUrl);
                  }
              });
          }

          pageEntries.push(
              { type: 'divider', compact: true },
              ...imageActions
          );
      }

      const aiEntries = [];
      const editEntries = [];
      if (params.selectionText) {
          aiEntries.push(
              { type: 'action', label: 'Attach to Omni AI', icon: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z', click: () => attachToAIChat(params.selectionText) },
              { type: 'action', label: 'Read Selection', icon: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.1-.9-2-2-2s-2 .9-2 2v6c0 1.1.9 2 2 2z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z', click: () => window.speechManager.speak(params.selectionText) },
              { type: 'action', label: 'Improve with Writer', icon: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', click: () => writerUI.show(params.selectionText, params.selectionX || params.x, params.selectionY || params.y) },
              { type: 'action', label: 'Translate Selection', icon: 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2H1v2H11.17c-.71 2.06-1.75 4.05-3.04 5.81-1.01-1.12-1.87-2.34-2.57-3.64H4.5c.81 1.63 1.83 3.17 3.03 4.58L3.06 18.06l1.41 1.41 4.7-4.7 3.13 3.13 1.98-1.83z', click: () => translatorUI.show(params.selectionText, params.selectionX || params.x, params.selectionY || params.y) },
              {
                  type: 'action',
                  label: 'Google Translate',
                  icon: 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2H1v2H11.17c-.71 2.06-1.75 4.05-3.04 5.81-1.01-1.12-1.87-2.34-2.57-3.64H4.5c.81 1.63 1.83 3.17 3.03 4.58L3.06 18.06l1.41 1.41 4.7-4.7 3.13 3.13 1.98-1.83z',
                  click: () => {
                      const encodedText = encodeURIComponent(params.selectionText);
                      const translateUrl = `https://translate.google.co.in/?sl=auto&tl=bn&text=${encodedText}&op=translate`;
                      tabManager.createTab(translateUrl);
                  }
              }
          );

          const defEngine = cachedSettings?.searchEngines?.find(e => e.id === (cachedSettings.defaultSearchEngineId || 'google'));
          if (defEngine) {
              aiEntries.push({
                  type: 'action',
                  label: `Search ${defEngine.name}`,
                  icon: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
                  click: () => {
                      const searchUrl = defEngine.url.replace('%s', encodeURIComponent(params.selectionText));
                      tabManager.createTab(searchUrl);
                  }
              });
          }

          editEntries.push({
              type: 'action',
              label: 'Copy',
              icon: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
              click: () => {
                  if (activeWebview) {
                      activeWebview.focus();
                      activeWebview.copy();
                  }
              }
          });
      }

      if (params.isEditable) {
          editEntries.push({ type: 'action', label: 'Paste', icon: 'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z', click: () => activeWebview?.paste() });
      }

      addSubmenu('System', 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.81 8.87c-.11.2-.06.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94 0 .33.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.24.23.41.47.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.12-.56 1.62-.94l2.39.96c.22.07.47 0 .59-.22l1.92-3.32c.11-.2.06-.47-.12-.61l-2.01-1.58zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z', systemEntries);
      addSubmenu('Page', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.93 6h-2.95a15.66 15.66 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.51 1.91 3.96h-3.82A13.88 13.88 0 0 1 12 4.04zM4.26 14A8.02 8.02 0 0 1 4 12c0-.69.09-1.36.26-2h3.1c-.05.66-.08 1.33-.08 2s.03 1.34.08 2h-3.1zm.81 2h2.95c.35 1.28.82 2.48 1.38 3.56A8.03 8.03 0 0 1 5.07 16zM8.02 14c-.06-.66-.1-1.33-.1-2s.04-1.34.1-2h3.98v4H8.02zm3.98 5.96A13.9 13.9 0 0 1 10.09 16h3.82A13.9 13.9 0 0 1 12 19.96zM13.98 14v-4h3.98c.06.66.1 1.33.1 2s-.04 1.34-.1 2h-3.98zm.62 5.56A15.66 15.66 0 0 0 15.98 16h2.95a8.03 8.03 0 0 1-4.33 3.56z', pageEntries);
      addSubmenu('AI', 'M12 2l2.2 4.8L19 9l-4.8 2.2L12 16l-2.2-4.8L5 9l4.8-2.2L12 2zm7.5 13 1.1 2.4L23 18.5l-2.4 1.1L19.5 22l-1.1-2.4L16 18.5l2.4-1.1 1.1-2.4zM4.5 14l.85 1.85L7.2 16.7l-1.85.85L4.5 19.4l-.85-1.85L1.8 16.7l1.85-.85L4.5 14z', aiEntries);
      addSubmenu('Edit', 'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H5V4h2v3h10V4h2v16z', editEntries);
      addSubmenu('Developer', 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z', [
          {
              type: 'action',
              label: sidePanelState.isHidden
                  ? 'Show Sidebar'
                  : (sidePanelState.isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'),
              icon: sidePanelState.isHidden
                  ? 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'
                  : (sidePanelState.isCollapsed
                      ? 'M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6-1.41-1.41z'
                      : 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'),
              click: () => {
                  if (sidePanelState.isHidden) sidePanel.show();
                  else sidePanel.toggle();
              }
          },
          !sidePanelState.isHidden && {
              type: 'action',
              label: 'Hide Sidebar',
              icon: 'M11.83 9L15 12.16c.5-.3.83-.86.83-1.5 0-1.66-1.34-3-3-3-.64 0-1.2.25-1.63.7L11.83 9zm8.05 4.34L23 21.07 21.07 23l-2.58-2.59C15.25 22.09 12.67 23 10 23c-4.97 0-9.27-3.11-11-7.5 1.54-3.82 4.61-6.87 8.35-8.24L2.93 3 4.93 1.07 20.88 17.02l-.05.32zM7.53 9.8C7.08 10.16 6.81 10.75 6.81 11.39c0 1.66 1.34 3 3 3 .64 0 1.23-.25 1.63-.61L7.53 9.8z',
              click: () => sidePanel.toggleHidden()
          },
          { type: 'divider', compact: true },
          {
              type: 'action',
              label: 'Inspect Element',
              icon: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
              click: () => {
                  if (activeWebview) activeWebview.inspectElement(params.x, params.y);
              }
          }
      ]);

      webviewContextMenu.style.left = `${params.x}px`;
      webviewContextMenu.style.top = `${params.y}px`;
      showContextMenuBackdrop();
      webviewContextMenu.classList.remove('hidden');
  };

  const handleTabContextMenu = async (id, x, y) => {
      closeAllContextMenus();
      currentTabContextId = id;
      if (!tabContextMenu) return;
      
      tabContextMenu.style.left = `${x}px`;
      tabContextMenu.style.top = `${y}px`;
      showContextMenuBackdrop();
      tabContextMenu.classList.remove('hidden');

      const tab = tabManager.tabs.find(t => t.id === id);
      if (tab) {
          try {
              const isTrusted = await window.browserAPI.vault.sites.isTrusted(tab.url);
              const trustItem = document.getElementById('ctx-trust-site');
              if (trustItem) {
                  trustItem.classList.toggle('hidden', isTrusted);
              }
          } catch (e) {
              console.warn("[Context Menu] Trust check failed:", e);
          }
          
          // Update dark mode menu item text based on current state
          const darkModeItem = document.getElementById('ctx-dark-mode');
          if (darkModeItem) {
              const isDarkMode = darkModeTabs.has(id);
              const span = darkModeItem.querySelector('span');
              if (span) {
                  span.textContent = isDarkMode ? 'Disable Dark Mode' : 'Enable Dark Mode';
              }
              // Add visual indicator when enabled
              darkModeItem.style.color = isDarkMode ? '#4fc3f7' : '';
          }
      }
  };

  const handleSidePanelContextMenu = (x, y) => {
      closeAllContextMenus();
      sidePanelContextMenu.innerHTML = '';

      const addSidebarMenuItem = (label, icon, click) => {
          const item = document.createElement('div');
          item.className = 'context-menu-item';
          item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="${icon}" fill="currentColor"/></svg><span>${label}</span>`;
          item.style.cssText = 'padding: 12px 16px; color: rgba(255,255,255,0.8); font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s ease;';
          item.onclick = () => { click(); sidePanelContextMenu.classList.add('hidden'); };
          item.onmouseover = () => { item.style.background = 'rgba(255,255,255,0.1)'; item.style.color = '#fff'; };
          item.onmouseout = () => { item.style.background = 'transparent'; item.style.color = 'rgba(255,255,255,0.8)'; };
          sidePanelContextMenu.appendChild(item);
      };

      const state = sidePanel.getState();

      // Toggle collapse/expand
      if (!state.isHidden) {
          addSidebarMenuItem(
              state.isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar',
              state.isCollapsed ? 'M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6-1.41-1.41z' : 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
              () => sidePanel.toggle()
          );
      }

      // Toggle hide/show
      addSidebarMenuItem(
          state.isHidden ? 'Show Sidebar' : 'Hide Sidebar',
          state.isHidden ? 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z' : 'M11.83 9L15 12.16c.5-.3.83-.86.83-1.5 0-1.66-1.34-3-3-3-.64 0-1.2.25-1.63.7L11.83 9zm8.05 4.34L23 21.07 21.07 23l-2.58-2.59C15.25 22.09 12.67 23 10 23c-4.97 0-9.27-3.11-11-7.5 1.54-3.82 4.61-6.87 8.35-8.24L2.93 3 4.93 1.07 20.88 17.02l-.05.32zM7.53 9.8C7.08 10.16 6.81 10.75 6.81 11.39c0 1.66 1.34 3 3 3 .64 0 1.23-.25 1.63-.61L7.53 9.8z' ,
          () => sidePanel.toggleHidden()
      );

      // Add divider
      const divider = document.createElement('div');
      divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0;';
      sidePanelContextMenu.appendChild(divider);

      // Restore to full
      addSidebarMenuItem(
          'Restore Full View',
          'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
          () => sidePanel.restore()
      );

      sidePanelContextMenu.style.left = `${x}px`;
      sidePanelContextMenu.style.top = `${y}px`;
      showContextMenuBackdrop();
      sidePanelContextMenu.classList.remove('hidden');
  };

  const handleHiddenSidebarContextMenu = (x, y) => {
      closeAllContextMenus();
      hiddenSidebarContextMenu.innerHTML = '';

      const addHiddenSidebarMenuItem = (label, icon, click) => {
          const item = document.createElement('div');
          item.className = 'context-menu-item';
          item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="${icon}" fill="currentColor"/></svg><span>${label}</span>`;
          item.style.cssText = 'padding: 12px 16px; color: rgba(255,255,255,0.8); font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s ease;';
          item.onclick = () => { click(); hiddenSidebarContextMenu.classList.add('hidden'); };
          item.onmouseover = () => { item.style.background = 'rgba(255,255,255,0.1)'; item.style.color = '#fff'; };
          item.onmouseout = () => { item.style.background = 'transparent'; item.style.color = 'rgba(255,255,255,0.8)'; };
          hiddenSidebarContextMenu.appendChild(item);
      };

      const activeWebview = tabManager.getActiveWebview();

      addHiddenSidebarMenuItem(
          'Show Sidebar',
          'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
          () => sidePanel.show()
      );

      hiddenSidebarContextMenu.appendChild(document.createElement('div')).style.cssText = 'height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0;';

      addHiddenSidebarMenuItem(
          'Back',
          'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
          () => activeWebview?.goBack()
      );

      addHiddenSidebarMenuItem(
          'Reload',
          'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
          () => activeWebview?.reload()
      );

      hiddenSidebarContextMenu.appendChild(document.createElement('div')).style.cssText = 'height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0;';

      addHiddenSidebarMenuItem(
          'Minimize',
          'M19 13H5v-2h14v2z',
          () => window.browserAPI?.window?.minimize?.()
      );

      addHiddenSidebarMenuItem(
          'Maximize / Restore',
          'M4 4h16v16H4V4zm2 2v12h12V6H6z',
          () => window.browserAPI?.window?.toggleMaximize?.()
      );

      addHiddenSidebarMenuItem(
          'Close Window',
          'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
          () => window.browserAPI?.window?.close?.()
      );

      hiddenSidebarContextMenu.style.left = `${x}px`;
      hiddenSidebarContextMenu.style.top = `${y}px`;
      showContextMenuBackdrop();
      hiddenSidebarContextMenu.classList.remove('hidden');
  };

  const syncFocusState = () => {
    const el = document.activeElement;
    const isInput = el && (['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);
    if (window.browserAPI && window.browserAPI.focusChanged) {
        window.browserAPI.focusChanged(!!isInput);
    }
  };

  window.addEventListener('focusin', syncFocusState);
  window.addEventListener('focusout', () => {
      setTimeout(syncFocusState, 0);
  });

  const btnMin = document.getElementById('btn-min');
  const btnMax = document.getElementById('btn-max');
  const btnClose = document.getElementById('btn-close');

  if (btnMin) btnMin.addEventListener('click', () => window.browserAPI.window.minimize());
  if (btnMax) btnMax.addEventListener('click', () => window.browserAPI.window.toggleMaximize());
  if (btnClose) btnClose.addEventListener('click', () => window.browserAPI.window.close());

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

  const applyTheme = (theme) => {
    const resolvedTheme = resolveThemeId(theme);
    document.body.className = `theme-${resolvedTheme}`;
  };

  const openAppTab = (url) => {
      const existing = tabManager.tabs.find(t => t.url === url);
      if (existing) tabManager.setActiveTab(existing.id); else tabManager.createTab(url);
      if (featuresHomePopup) featuresHomePopup.classList.add('hidden');
  };

  const applyFeatureVisibility = (features) => {
      const featureUIMap = {
          'enableHistory': ['btn-nav-history', 'tile-history'],
          'showAIChatButton': ['btn-nav-ai-chat']
      };
      for (const [key, ids] of Object.entries(featureUIMap)) {
          const isEnabled = features[key] !== false;
          ids.forEach(id => {
              const el = document.getElementById(id);
              if (el) {
                  if (isEnabled) el.classList.remove('hidden');
                  else el.classList.add('hidden');
              }
          });
      }
  };

  const getYouTubeAddonSettings = (settings = cachedSettings) => {
      const adBlocker = settings?.adBlocker || {};
      return {
          enabled: adBlocker.youtubeAddonEnabled === true,
          hideShorts: adBlocker.ytHideShorts !== false,
          hideHomeSuggestions: adBlocker.ytHideHomeSuggestions !== false,
          blurThumbnails: adBlocker.ytBlurThumbnails === true,
          hideChats: adBlocker.ytHideChats === true,
          hideSubscribeButton: adBlocker.ytHideSubscribeButton === true,
          blockAds: adBlocker.ytBlockAds === true,
          blackAndWhiteMode: adBlocker.ytBlackAndWhiteMode === true,
          hideAddonIcon: adBlocker.ytHideAddonIcon === true
      };
  };

  const syncYouTubeAddonPanel = () => {
      if (!youtubeAddonShell) return;
      const yt = getYouTubeAddonSettings(cachedSettings);
      youtubeAddonShell.classList.toggle('hidden', !yt.enabled || yt.hideAddonIcon);
      if (!yt.enabled) youtubeAddonPopup?.classList.add('hidden');
      if (youtubeAddonToggleShorts) youtubeAddonToggleShorts.checked = !!yt.hideShorts;
      if (youtubeAddonToggleHome) youtubeAddonToggleHome.checked = !!yt.hideHomeSuggestions;
      if (youtubeAddonToggleBlur) youtubeAddonToggleBlur.checked = !!yt.blurThumbnails;
      if (youtubeAddonToggleChat) youtubeAddonToggleChat.checked = !!yt.hideChats;
      if (youtubeAddonToggleSubscribe) youtubeAddonToggleSubscribe.checked = !!yt.hideSubscribeButton;
      if (youtubeAddonToggleAds) youtubeAddonToggleAds.checked = !!yt.blockAds;
      if (youtubeAddonToggleBw) youtubeAddonToggleBw.checked = !!yt.blackAndWhiteMode;
  };

  const persistYouTubeAddonPreferences = async (partialAdBlocker = {}) => {
      try {
          if (!cachedSettings) cachedSettings = await window.browserAPI.settings.get();
          const nextSettings = {
              ...(cachedSettings || {}),
              adBlocker: {
                  ...(cachedSettings?.adBlocker || {}),
                  ...partialAdBlocker
              }
          };
          cachedSettings = nextSettings;
          syncYouTubeAddonPanel();
          tabManager?.updateSettings?.(nextSettings);
          const success = await window.browserAPI.settings.save(nextSettings);
          if (!success) console.warn('[YouTube Addon] Failed to save settings.');
      } catch (e) {
          console.warn('[YouTube Addon] Save error:', e);
      }
  };

  const setupYouTubeAddonEvents = () => {
      if (!youtubeAddonShell || youtubeAddonShell.dataset.bound === '1') return;
      youtubeAddonShell.dataset.bound = '1';

      youtubeAddonTrigger?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          youtubeAddonPopup?.classList.toggle('hidden');
      });

      youtubeAddonPopup?.addEventListener('click', (e) => {
          e.stopPropagation();
      });

      youtubeAddonToggleShorts?.addEventListener('change', () => {
          persistYouTubeAddonPreferences({ ytHideShorts: youtubeAddonToggleShorts.checked });
      });
      youtubeAddonToggleHome?.addEventListener('change', () => {
          persistYouTubeAddonPreferences({ ytHideHomeSuggestions: youtubeAddonToggleHome.checked });
      });
      youtubeAddonToggleBlur?.addEventListener('change', () => {
          persistYouTubeAddonPreferences({ ytBlurThumbnails: youtubeAddonToggleBlur.checked });
      });
      youtubeAddonToggleChat?.addEventListener('change', () => {
          persistYouTubeAddonPreferences({ ytHideChats: youtubeAddonToggleChat.checked });
      });
      youtubeAddonToggleSubscribe?.addEventListener('change', () => {
          persistYouTubeAddonPreferences({ ytHideSubscribeButton: youtubeAddonToggleSubscribe.checked });
      });
      youtubeAddonToggleAds?.addEventListener('change', () => {
          persistYouTubeAddonPreferences({ ytBlockAds: youtubeAddonToggleAds.checked });
      });
      youtubeAddonToggleBw?.addEventListener('change', () => {
          persistYouTubeAddonPreferences({ ytBlackAndWhiteMode: youtubeAddonToggleBw.checked });
      });

      // Power users can right-click the floating icon to hide it quickly.
      youtubeAddonShell?.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          persistYouTubeAddonPreferences({ ytHideAddonIcon: true });
      });
  };
  setupYouTubeAddonEvents();

  const loadSettings = async (injectedSettings = null) => {
      try {
          cachedSettings = injectedSettings || await window.browserAPI.settings.get();
          if (cachedSettings) {
              applyTheme(cachedSettings.theme);
              screenshotDelaySeconds = cachedSettings.screenshot?.delaySeconds ?? 0;
              updateDelayLabel(screenshotDelaySeconds);
              const features = cachedSettings.features || {
                  enableHistory: true,
                  showAIChatButton: true
              };
              applyFeatureVisibility(features);
              syncYouTubeAddonPanel();
              tabManager?.updateSettings?.(cachedSettings);
          }
      } catch(e) {
          // Ensure defaults show even if settings load fails on startup
          applyFeatureVisibility({ enableHistory: true, showAIChatButton: true });
          syncYouTubeAddonPanel();
          console.warn("Settings failed in renderer", e);
      }
  };

  // Default to showing key buttons before settings are fetched
  applyFeatureVisibility({ enableHistory: true, showAIChatButton: true });
  await loadSettings(); 

  if (window.browserAPI.onSettingsUpdated) {
    window.browserAPI.onSettingsUpdated((settings) => loadSettings(settings));
  }

  if (dlCancelBtn) {
      dlCancelBtn.onclick = async (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!activeToastDownloadId) return;
          dlCancelBtn.disabled = true;
          try {
              await window.browserAPI.downloads.cancel(activeToastDownloadId);
          } catch (error) {
              console.error('[Downloads] Toast cancel failed', error);
          } finally {
              dlCancelBtn.disabled = false;
          }
      };
  }

  if (window.browserAPI.downloads && window.browserAPI.downloads.onUpdate) {
      window.browserAPI.downloads.onUpdate((item) => {
          if (!downloadToast) return;
          const state = String(item?.state || '').toLowerCase();
          const isActiveState = ['progressing', 'paused', 'scanning', 'pending'].includes(state);
          const isTerminalState = ['completed', 'interrupted', 'cancelled', 'blocked'].includes(state);

          if (toastTimeout) {
              clearTimeout(toastTimeout);
              toastTimeout = null;
          }

          downloadToast.classList.remove('hidden');
          if (dlFilename) dlFilename.textContent = item.filename || 'Download';

          if (dlCancelBtn) {
              if (isActiveState && item?.id) {
                  activeToastDownloadId = item.id;
                  dlCancelBtn.disabled = false;
                  dlCancelBtn.classList.remove('hidden');
              } else {
                  activeToastDownloadId = null;
                  dlCancelBtn.disabled = true;
                  dlCancelBtn.classList.add('hidden');
              }
          }

          if (state === 'progressing') {
              const percent = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0;
              if (dlStatus) dlStatus.textContent = `${percent}% - Downloading`;
              if (dlFill) dlFill.style.width = `${percent}%`;
          } else if (state === 'paused') {
              const percent = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0;
              if (dlStatus) dlStatus.textContent = `Paused - ${percent}%`;
              if (dlFill) dlFill.style.width = `${percent}%`;
          } else if (state === 'scanning') {
              if (dlStatus) dlStatus.textContent = item.reason ? `Security scan - ${item.reason}` : 'Security scan in progress';
          } else if (state === 'completed') {
              if (dlStatus) dlStatus.textContent = 'Download Complete';
              if (dlFill) dlFill.style.width = '100%';
              toastTimeout = setTimeout(() => downloadToast.classList.add('hidden'), 3000);
          } else if (state === 'interrupted' || state === 'cancelled') {
              if (dlStatus) dlStatus.textContent = state === 'cancelled' ? 'Download Cancelled' : 'Download Failed';
              if (dlFill) dlFill.style.width = '100%';
              toastTimeout = setTimeout(() => downloadToast.classList.add('hidden'), 3000);
          } else if (state === 'blocked') {
              if (dlStatus) dlStatus.textContent = item.reason ? `Blocked - ${item.reason}` : 'Blocked by security checks';
              if (dlFill) dlFill.style.width = '100%';
              toastTimeout = setTimeout(() => downloadToast.classList.add('hidden'), 3500);
          } else {
              if (dlStatus) dlStatus.textContent = 'Pending...';
              if (!isTerminalState && dlFill && !isActiveState) dlFill.style.width = '0%';
          }

          if (isTerminalState) {
              activeToastDownloadId = null;
              if (dlCancelBtn) {
                  dlCancelBtn.disabled = true;
                  dlCancelBtn.classList.add('hidden');
              }
          }

          if (state === 'pending') {
              if (dlStatus) dlStatus.textContent = item.reason ? `Pending - ${item.reason}` : 'Pending...';
              if (dlFill) dlFill.style.width = '0%';
          }

      });
  }

  // Downloads UI removed; toast click disabled.

  const sidePanel = new SidePanel();
  
  // Initialize UI components early to prevent undefined reference errors
  let bookmarkPanel = null;
  let electronAppsPanel = null;
  let downloadPanel = null;
  let translatorUI = null;
  let writerUI = null;
  let screenshotOverlay = null;
  
  tabManager = new TabManager('tab-list-container', 'webview-container', (url) => {
      const controls = document.querySelector('.window-controls');
      const isHome = url === HOME_URL || url?.includes('pages/home.html');
      controls?.classList.toggle('hidden', !isHome);
  }, handleWebviewContextMenu, handleTabContextMenu, (tabId) => {
      // Clean up dark mode state when tab is closed
      darkModeTabs.delete(tabId);
  });
  tabManager.createTab();
  if (cachedSettings) {
      tabManager.updateSettings?.(cachedSettings);
      syncYouTubeAddonPanel();
  }
  
  // Now initialize the UI components after TabManager is created
    bookmarkPanel = new BookmarkPanel(tabManager);
    electronAppsPanel = new ElectronAppsPanel(tabManager);
    downloadPanel = new DownloadPanel();
    translatorUI = new TranslatorUI(tabManager);
    writerUI = new WriterUI(tabManager);
    screenshotOverlay = new ScreenshotOverlay(async (url) => window.browserAPI.downloads.start(url, { saveAs: true }));

    if (btnDelay && delayDropdown) {
        btnDelay.addEventListener('click', (e) => {
            e.stopPropagation();
            delayDropdown.classList.toggle('hidden');
        });
        delayOptions.forEach((opt) => {
            opt.addEventListener('click', async (e) => {
                e.preventDefault();
                const seconds = Number(opt.dataset.delay || 0);
                await setScreenshotDelay(seconds);
                delayDropdown.classList.add('hidden');
            });
        });
        document.addEventListener('mousedown', (e) => {
            if (!delayDropdown.classList.contains('hidden')) {
                const within = delayDropdown.contains(e.target) || btnDelay.contains(e.target);
                if (!within) delayDropdown.classList.add('hidden');
            }
        });
    }

    if (btnLens) {
        btnLens.addEventListener('click', (e) => {
            e.preventDefault();
            const existing = screenshotOverlay.getCurrentDataUrl();
            if (existing) {
                openLensSearchForImage(existing);
                screenshotOverlay.hide();
                return;
            }
            const webview = tabManager.getActiveWebview();
            if (!webview) return;
            webview.capturePage().then((img) => {
                openLensSearchForImage(img.toDataURL());
                screenshotOverlay.hide();
            }).catch((err) => {
                console.error('[Lens Search] Capture failed:', err);
                screenshotOverlay.showToast('Failed to capture screenshot');
            });
        });
    }
  
    const searchSystem = initSearchSystem({
        tabManager,
        settingsAPI: window.browserAPI.settings,
      HOME_URL
  });

  if (window.browserAPI.onShortcut) {
      window.browserAPI.onShortcut((command) => {
          if (command === 'new-tab') { 
              searchSystem.handleNewTabRequest();
          } 
          else if (command === 'open-scraber') { tabManager.createTab(SCRABER_URL); }
          else if (command === 'close-tab') { if (tabManager.activeTabId) tabManager.closeTab(tabManager.activeTabId); } 
          else if (command === 'toggle-sidebar') { sidePanel.toggle(); } 
          else if (command === 'hide-sidebar') { sidePanel.toggleHidden(); }
          else if (command === 'toggle-ai') { openAppTab(AI_CHAT_URL); } 
          else if (command === 'toggle-system') { openAppTab(SETTINGS_URL); } 
          else if (command === 'take-screenshot') {
              captureActiveWebview();
          }
          else if (command === 'toggle-bookmarks') { bookmarkPanel.toggle(); }
          else if (command === 'toggle-electron-apps') { electronAppsPanel.toggle(); }
      });
  }

  // Keyboard shortcut for hide sidebar: Ctrl+Shift+[ (complements toggle-sidebar shortcut Ctrl+[)
  document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '[') {
          e.preventDefault();
          sidePanel.toggleHidden();
      }
  });

  document.addEventListener('keydown', (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'i') {
          if (isEditableTarget(e.target)) return;
          const overlay = document.getElementById('screenshot-layer');
          if (overlay?.classList.contains('active')) return;
          e.preventDefault();
          captureActiveWebview((dataUrl) => openLensSearchForImage(dataUrl));
      }
  });

  document.addEventListener('keydown', (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'g') {
          if (isEditableTarget(e.target)) return;
          const overlay = document.getElementById('screenshot-layer');
          if (overlay?.classList.contains('active')) return;
          e.preventDefault();
          openSiteInfoPopup();
      }
  });

  // Listen for sidebar context menu event
  document.addEventListener('sidePanelContextMenu', (e) => {
      handleSidePanelContextMenu(e.detail.x, e.detail.y);
  });

  if (window.browserAPI.onOpenFile) {
    window.browserAPI.onOpenFile((filePath) => {
        const targetUrl = resolveOpenedFileTarget(filePath);
        tabManager.createTab(targetUrl);
        if (searchSystem.isVisible()) searchSystem.hide();
    });
  }

  document.getElementById('btn-nav-home').onclick = () => {
    const activeTab = tabManager.tabs.find(t => t.id === tabManager.activeTabId);
    if (activeTab) {
      const isHome = activeTab.url === HOME_URL || activeTab.url.includes('pages/home.html');
      if (isHome) {
        featuresHomePopup.classList.toggle('hidden');
      } else {
        tabManager.navigateTo(HOME_URL);
      }
    } else {
      tabManager.createTab(HOME_URL);
    }
  };

  document.getElementById('tile-history').onclick = () => openAppTab(HISTORY_URL);
  document.getElementById('btn-nav-history').onclick = () => openAppTab(HISTORY_URL);
  document.getElementById('btn-nav-settings').onclick = () => openAppTab(SETTINGS_URL);
  document.getElementById('btn-nav-ai-chat').onclick = () => openAppTab(AI_CHAT_URL);
  const btnNavDownloads = document.getElementById('btn-nav-downloads');
  if (btnNavDownloads) btnNavDownloads.onclick = () => downloadPanel?.toggle(true);
  document.getElementById('tile-ai-chat').onclick = () => openAppTab(AI_CHAT_URL);
  document.getElementById('tile-todo-station').onclick = () => openAppTab(TODO_STATION_URL);
  document.getElementById('tile-games').onclick = () => openAppTab(GAMES_URL);
  document.getElementById('tile-neural-hub').onclick = () => openAppTab(NEURAL_HUB_URL);
  document.getElementById('tile-minecraft').onclick = () => openAppTab(MINECRAFT_URL);
  
  document.getElementById('btn-new-tab').onclick = () => {
      searchSystem.handleNewTabRequest();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchSystem.isVisible()) searchSystem.hide();
      if (iconPickerOverlay) iconPickerOverlay.classList.add('hidden');
      if (shortcutOverlay) shortcutOverlay.classList.add('hidden');
      if (featuresHomePopup) featuresHomePopup.classList.add('hidden');
      if (imageDlOverlay) imageDlOverlay.classList.add('hidden');
      if (vtLinkScanOverlay) vtLinkScanOverlay.classList.add('hidden');
      if (youtubeAddonPopup) youtubeAddonPopup.classList.add('hidden');
      if (siteInfoOverlay) siteInfoOverlay.classList.add('hidden');
      if (translatorUI) translatorUI.hide();
      if (writerUI) writerUI.hide();
      closeAllContextMenus();
    }
  });

  document.addEventListener('mousedown', (e) => {
      if (featuresHomePopup && !featuresHomePopup.classList.contains('hidden')) {
          if (!featuresHomePopup.contains(e.target) && !document.getElementById('btn-nav-home').contains(e.target)) {
              featuresHomePopup.classList.add('hidden');
          }
      }
      if (youtubeAddonPopup && !youtubeAddonPopup.classList.contains('hidden')) {
          if (!youtubeAddonShell?.contains(e.target)) {
              youtubeAddonPopup.classList.add('hidden');
          }
      }
  });

  function setupShortcutRecorder(inputEl) {
    inputEl.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const keys = [];
        if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
        if (e.altKey) keys.push('Alt');
        if (e.shiftKey) keys.push('Shift');
        if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
            let keyName = e.key.toUpperCase();
            if (keyName === ' ') keyName = 'Space';
            keys.push(keyName);
            inputEl.value = keys.join('+');
        }
    });
  }

  if (shortcutKeyRecorder) setupShortcutRecorder(shortcutKeyRecorder);

  const showShortcutModal = (tab) => {
      if (!tab) return;
      shortcutOverlay.classList.remove('hidden');
      shortcutNameInput.value = tab.titleEl.textContent.substring(0, 25);
      shortcutKeyRecorder.value = '';
      shortcutNameInput.focus();
  };

  if (btnShortcutCancel) btnShortcutCancel.onclick = () => shortcutOverlay.classList.add('hidden');

  if (btnShortcutSave) {
      btnShortcutSave.onclick = async () => {
          const name = shortcutNameInput.value.trim();
          const trigger = shortcutKeyRecorder.value.trim();
          if (!name || !trigger) {
              alert("Please provide both a name and a shortcut key.");
              return;
          }
          const tab = tabManager.tabs.find(t => t.id === currentTabContextId);
          if (!tab) return;
          try {
              const settings = await window.browserAPI.settings.get();
              const newId = 'shortcut-' + Date.now();
              const newEngine = {
                  id: newId,
                  name: name,
                  url: tab.url,
                  trigger: trigger,
                  icon: tab.iconEl.src,
                  type: 'url'
              };
              settings.searchEngines = settings.searchEngines || [];
              settings.searchEngines.push(newEngine);
              const success = await window.browserAPI.settings.save(settings);
              if (success) {
                  shortcutOverlay.classList.add('hidden');
              }
          } catch (e) {
              console.error(e);
          }
      };
  }

  const PRESET_ICONS = [
    // Essential & Navigation
    { name: 'Home', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>' },
    { name: 'Chat Bubble', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' },
    { name: 'Downloads', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>' },
    { name: 'History', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 6v5l4.28 2.54.72-1.21-3.5-2.08V9h-1.5z"/></svg>' },
    
    // Content & Tools
    { name: 'Gamepad', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>' },
    { name: 'PDF Document', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-8-6z"/></svg>' },
    { name: 'Shield', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z"/></svg>' },
    { name: 'Checklist', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>' },
    
    // Creative & Media
    { name: 'Palette', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>' },
    { name: 'Brush', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.71 7.71L18.29 5.29c-.39-.39-1.02-.39-1.41 0l-1.06 1.06-2.12-2.12c-.78-.78-2.05-.78-2.83 0L9.17 3.71c-.78-.78-2.05-.78-2.83 0L3.71 6.34c-.39.39-.39 1.02 0 1.41l2.12 2.12L2.3 13.7c-.39.39-.39 1.02 0 1.41l2.83 2.83c.39.39 1.02.39 1.41 0l9.25-9.25 2.12 2.12c.39.39 1.02.39 1.41 0l1.06-1.06 2.12 2.12c.39.39 1.02.39 1.41 0l2.83-2.83c.39-.39.39-1.02 0-1.41z"/></svg>' },
    { name: 'Image', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>' },
    { name: 'Video', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3v2h4V3h-4zm4 8v-2h-4v2h4zm0 8v-2h-4v2h4zM2 7h4V3H2v4zm4 12H2v4h4v-4zm4-14h4V3H10v4zm4 12h-4v4h4v-4zm4-12v4h4V3h-4zm0 12h4v-4h-4v4z"/></svg>' },
    { name: 'Book', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 4h6v2H9V4zm12 14H3V4h.01c0-1.1.9-2 2-2s2 .9 2 2v14h14z"/></svg>' },
    
    // System & Settings
    { name: 'Settings', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22l-1.92 3.32c-.12.22-.07.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>' },
    { name: 'Lock', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5s-5 2.24-5 5v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>' },
    { name: 'Cloud', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>' },
    { name: 'Brain', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>' },
    
    // Neural & AI
    { name: 'Neural Hub', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm3.5-9c.8 0 1.5-.7 1.5-1.5S16.3 8 15.5 8 14 8.7 14 9.5s.7 1.5 1.5 1.5zm-7 0c.8 0 1.5-.7 1.5-1.5S9.3 8 8.5 8 7 8.7 7 9.5 7.7 11 8.5 11zm3.5 6c-2.3 0-4.3-1.4-5.2-3.4h10.4c-.9 2-2.9 3.4-5.2 3.4z"/></svg>' },
    { name: 'Network', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 13h12v2H6zm0-6h12v2H6zm0 12h12v2H6z"/></svg>' },
    { name: 'Star', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' },
    { name: 'Heart', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' },
    { name: 'Zap', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V9h-7V2z"/></svg>' },
    { name: 'Planet', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' },
    { name: 'Fire', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-5.52-4.5-13.33-4.5-13.33zM14.5 14c0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5z"/></svg>' },
    { name: 'Search', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>' },
    { name: 'Translate', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.21-6.54H17V4h-7V2H8v2H1v3h15.97c-.29 1.75-1.1 3.29-2.16 4.53l2.91 2.91c1.88-1.46 3.14-3.16 3.69-5.14h-2.3c-.5 1.23-1.23 2.32-2.15 3.2l2.91 2.91c1.88-1.46 3.14-3.16 3.69-5.14H17c-.33 1.85-1.22 3.58-2.55 4.94l2.5 2.5c.14-.14.27-.28.4-.42l-2.5-2.5zm1.24-6.78c-.5-1.23-1.23-2.32-2.15-3.2L14 7.07c.5 1.23 1.23 2.32 2.15 3.2l-2.04-2.04zM2 12h15c0-1.66-1.34-3-3-3H5c-1.66 0-3 1.34-3 3z"/></svg>' },
    { name: 'Archive', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5c-2.33 0-4.25-1.92-4.25-4.25S9.67 9 12 9s4.25 1.92 4.25 4.25-1.92 4.25-4.25 4.25zm3.5-9h-7c-.41 0-.75-.34-.75-.75s.34-.75.75-.75h7c.41 0 .75.34.75.75s-.34.75-.75.75z"/></svg>' },
    { name: 'Clock', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm-7 0c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z"/></svg>' }
  ];

  if (iconGrid) {
      iconGrid.innerHTML = '';
      PRESET_ICONS.forEach(icon => {
          const opt = document.createElement('div');
          opt.className = 'icon-option';
          opt.title = icon.name;
          opt.innerHTML = icon.svg;
          opt.onclick = () => {
              if (currentTabContextId) {
                  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svg)}`;
                  tabManager.updateTabIcon(currentTabContextId, dataUri);
              }
              iconPickerOverlay.classList.add('hidden');
          };
          iconGrid.appendChild(opt);
      });
  }

  if (btnClosePicker) {
      btnClosePicker.onclick = () => iconPickerOverlay.classList.add('hidden');
  }

  const openImageDownloadOptions = (src) => {
      currentImageToDownload = src;
      if (imageDlPreview) imageDlPreview.src = src;
      imageDlOverlay?.classList.remove('hidden');
  };

  if (btnImageDlCancel) btnImageDlCancel.onclick = () => imageDlOverlay.classList.add('hidden');

  dlFormatBtns.forEach(btn => {
      btn.onclick = async () => {
          const format = btn.dataset.format;
          const src = currentImageToDownload;
          if (!src) return;
          imageDlOverlay.classList.add('hidden');
          try {
              if (format === 'pdf') {
                  const { jsPDF } = await import('jspdf');
                  const img = new Image();
                  img.crossOrigin = "Anonymous";
                  img.onload = () => {
                      const pdf = new jsPDF({
                          orientation: img.width > img.height ? 'landscape' : 'portrait',
                          unit: 'px',
                          format: [img.width, img.height]
                      });
                      pdf.addImage(img, 'JPEG', 0, 0, img.width, img.height);
                      const pdfDataUrl = pdf.output('datauristring');
                      window.browserAPI.downloads.start(pdfDataUrl, { saveAs: true });
                  };
                  img.src = src;
              } else {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  const img = new Image();
                  img.crossOrigin = "Anonymous";
                  img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx.drawImage(img, 0, 0);
                      const mimeType = `image/${format === 'jpeg' ? 'jpeg' : format}`;
                      const dataUrl = canvas.toDataURL(mimeType, 0.9);
                      window.browserAPI.downloads.start(dataUrl, { saveAs: true });
                  };
                  img.src = src;
              }
          } catch (e) {
              window.browserAPI.downloads.start(src, { saveAs: true });
          }
      };
  });

  const isEditableTarget = (target) => {
      if (!target) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

  const openLensSearchForImage = (dataUrl) => {
      if (!dataUrl) return;
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lens Search</title></head><body>
<form id="lens-form" action="https://www.google.com/searchbyimage/upload" method="POST" enctype="multipart/form-data">
  <input id="lens-file" type="file" name="encoded_image">
  <input type="hidden" name="image_url" value="">
</form>
<script>
(async () => {
  const dataUrl = ${JSON.stringify(dataUrl)};
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], 'omx-capture.png', { type: blob.type || 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.getElementById('lens-file');
  input.files = dt.files;
  document.getElementById('lens-form').submit();
})();
</script>
</body></html>`;
      const bridgeUrl = `data:text/html;base64,${btoa(html)}`;
      tabManager.createTab(bridgeUrl);
  };

  function updateDelayLabel(seconds) {
      if (!delayLabel) return;
      if (!seconds || seconds <= 0) delayLabel.textContent = 'No delay';
      else delayLabel.textContent = `${seconds}s delay`;
  }

  const setScreenshotDelay = async (seconds) => {
      screenshotDelaySeconds = Number(seconds) || 0;
      updateDelayLabel(screenshotDelaySeconds);
      try {
          const settings = await window.browserAPI.settings.get();
          settings.screenshot = settings.screenshot || {};
          settings.screenshot.delaySeconds = screenshotDelaySeconds;
          await window.browserAPI.settings.save(settings);
      } catch (e) {
          console.warn('[Screenshot] Failed to save delay setting:', e);
      }
  };

  const captureActiveWebview = (onCaptureOverride = null) => {
      const webview = tabManager.getActiveWebview();
      if (!webview) return;
      const captureFn = () => webview.capturePage();
      if (screenshotDelaySeconds > 0) {
          screenshotOverlay.startDelayCapture(screenshotDelaySeconds, captureFn, onCaptureOverride);
      } else {
          captureFn()
              .then(img => screenshotOverlay.start(img, onCaptureOverride))
              .catch((err) => {
                  console.error('[Screenshot] Capture failed:', err);
                  screenshotOverlay.showToast('Failed to capture screenshot');
              });
      }
  };

  document.getElementById('ctx-close-tab').onclick = () => {
    if (currentTabContextId) tabManager.closeTab(currentTabContextId);
    closeAllContextMenus();
  };
  document.getElementById('ctx-bookmark-tab').onclick = () => {
      const tab = tabManager.tabs.find(t => t.id === currentTabContextId);
      if (tab) bookmarkPanel.addBookmark(tab.url, tab.titleEl.textContent, tab.iconEl.src);
      closeAllContextMenus();
  };
  document.getElementById('ctx-change-icon').onclick = () => {
      iconPickerOverlay.classList.remove('hidden');
      closeAllContextMenus();
  };
  document.getElementById('ctx-refresh').onclick = () => {
      const tab = tabManager.tabs.find(t => t.id === currentTabContextId);
      if (tab && tab.webview) tab.webview.reload();
      closeAllContextMenus();
  };
  document.getElementById('ctx-copy-url').onclick = () => {
      const tab = tabManager.tabs.find(t => t.id === currentTabContextId);
      if (tab) navigator.clipboard.writeText(tab.url);
      closeAllContextMenus();
  };
  document.getElementById('ctx-make-shortcut').onclick = () => {
    const tabId = currentTabContextId;
    closeAllContextMenus(); 
    const tab = tabManager.tabs.find(t => t.id === tabId);
    if (tab) showShortcutModal(tab);
  };
  document.getElementById('ctx-trust-site').onclick = async () => {
    const tabId = currentTabContextId;
    closeAllContextMenus();
    const tab = tabManager.tabs.find(t => t.id === tabId);
    if (tab) {
        const success = await window.browserAPI.vault.sites.trust(tab.url);
        if (success) {
            if (tab.webview) tab.webview.reload();
        }
    }
  };
  document.getElementById('ctx-dark-mode').onclick = () => {
    const tabId = currentTabContextId;
    closeAllContextMenus();
    if (tabId) toggleDarkModeForTab(tabId);
  };

  window.addEventListener('mousedown', (e) => {
      if (!webviewContextMenu?.contains(e.target) && !tabContextMenu?.contains(e.target) && !sidePanelContextMenu?.contains(e.target) && !hiddenSidebarContextMenu?.contains(e.target)) closeAllContextMenus();
  });

  // Right-clicking elsewhere can happen inside page/webview and not always emit a mousedown
  // on the host document in time for our custom menus. Close first, then specific handlers reopen.
  window.addEventListener('contextmenu', () => {
      closeAllContextMenus();
  }, true);

  window.addEventListener('contextmenu', (e) => {
      const state = sidePanel.getState();
      if (state.isHidden) {
          e.preventDefault();
          handleHiddenSidebarContextMenu(e.clientX, e.clientY);
      }
  });
  window.closeAllContextMenus = closeAllContextMenus;
});

