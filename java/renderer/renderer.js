import { TabManager }        from './ui/tabs.js';
import { SidePanel }         from './ui/sidePanel.js';
import { ScreenshotOverlay } from './ui/screenshotOverlay.js';
import { TranslatorUI }      from './ui/translator.js';
import { WriterUI }          from './ui/writer.js';
import { initSearchSystem }  from './search.js';

// ─── STATIC CONSTANTS ────────────────────────────────────────────────────────
// Hoisted out of DOMContentLoaded so they are created exactly once per module.

const THEME_ALIAS_MAP = {
    dark:     'noir',
    glass:    'prism',
    midnight: 'nordic',
    shadow:   'charcoal',
    abyss:    'deep-ocean',
    eclipse:  'twilight',
    ocean:    'ocean-waves',
    ember:    'ember-glow',
    noir:     'onyx',
    slate:    'steel-blue',
    mocha:    'honey-amber'
};

const HOME_URL            = new URL('../../html/pages/home.html',              import.meta.url).href;
const HISTORY_URL         = new URL('../../html/pages/history.html',           import.meta.url).href;
const SETTINGS_URL        = new URL('../../html/windows/system.html',          import.meta.url).href;
const TODO_STATION_URL    = new URL('../../html/pages/todo.html',              import.meta.url).href;
const GAMES_URL           = new URL('../../html/pages/games.html',             import.meta.url).href;
const SERVER_OPERATOR_URL = new URL('../../html/pages/server-operator.html',   import.meta.url).href;
const DOWNLOADS_URL       = new URL('../../html/pages/downloads.html',         import.meta.url).href;
const SCRABER_URL         = new URL('../../html/pages/scraper.html',           import.meta.url).href;
const BOOKMARK_FALLBACK_ICON = new URL('../../assets/icons/app.ico',           import.meta.url).href;

const OM_CHAT_DEFAULT_PORT = 3031;
const DUCK_AI_URL          = 'https://duck.ai/chat';

// Pre-compiled dark-mode CSS injected into webviews (static; created once).
const DARK_MODE_CSS = `
  :root, html, body {
    background: #111318 !important;
    color: #e5e7eb !important;
    color-scheme: dark !important;
  }
  a, a:visited, a:link { color: #8ab4f8 !important; }
  input, textarea, select, button { color-scheme: dark !important; }
  img, video, canvas, svg, iframe, embed, object { filter: none !important; }
  *:not(img):not(video):not(canvas):not(svg):not(iframe):not(embed):not(object) {
    background-color: transparent !important;
    color: inherit !important;
    border-color: rgba(255,255,255,0.14) !important;
  }
  section, article, main, aside, nav, header, footer, .card, .panel, .container, .box {
    background: rgba(255,255,255,0.03) !important;
    border-color: rgba(255,255,255,0.08) !important;
  }
  input, textarea, select, button {
    background: #1f232d !important;
    color: #e5e7eb !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
  }
  input::placeholder, textarea::placeholder { color: #9ca3af !important; }
  code, pre { background: #1b1f27 !important; color: #f8fafc !important; }
`;

// Pre-built script string; uses DARK_MODE_CSS constant above.
const NATIVE_DARK_MODE_SCRIPT = `
  (() => {
    try {
      const root = document.documentElement;
      const head = document.head || root;
      const host = String(location.hostname || '').toLowerCase();
      root.style.setProperty('color-scheme', 'dark', 'important');

      let meta = document.querySelector('meta[name="color-scheme"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'color-scheme');
        meta.dataset.omxInjected = '1';
        head.appendChild(meta);
      }
      meta.setAttribute('content', 'dark light');

      if (!window.__omxOriginalMatchMedia && typeof window.matchMedia === 'function') {
        window.__omxOriginalMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = (query) => {
          const q = String(query || '');
          if (/prefers-color-scheme/i.test(q)) {
            const wantsDark = /dark/i.test(q);
            return {
              matches: wantsDark, media: q, onchange: null,
              addListener() {}, removeListener() {},
              addEventListener() {}, removeEventListener() {},
              dispatchEvent() { return false; }
            };
          }
          return window.__omxOriginalMatchMedia(q);
        };
      }

      try {
        localStorage.setItem('theme', 'dark');
        localStorage.setItem('color-theme', 'dark');
        localStorage.setItem('appearance', 'dark');
      } catch (_) {}

      try {
        document.cookie = 'theme=dark; path=/; SameSite=Lax';
        document.cookie = 'appearance=dark; path=/; SameSite=Lax';
      } catch (_) {}

      const clickDarkControls = () => {
        const nodes = Array.from(document.querySelectorAll(
          'button, a, label, [role="button"], input[type="radio"], input[type="checkbox"]'
        ));
        for (const node of nodes) {
          const text = String(
            node.getAttribute?.('aria-label') ||
            node.getAttribute?.('title') ||
            node.textContent || ''
          ).trim().toLowerCase();
          if (!text) continue;
          if (!/(dark|night)/i.test(text) || !/(theme|appearance|mode|dark|night)/i.test(text)) continue;
          if (node.tagName === 'INPUT') {
            node.checked = true;
            node.dispatchEvent(new Event('input',  { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          node.click?.();
          return true;
        }
        return false;
      };

      if (host.endsWith('wikipedia.org') || host.endsWith('wiktionary.org') || host.endsWith('wikimedia.org')) {
        root.classList.add('skin-theme-clientpref-night', 'theme-dark');
        document.body?.classList?.add('skin-theme-clientpref-night', 'theme-dark');
        try {
          localStorage.setItem('theme', 'dark');
          localStorage.setItem('vector-theme', 'dark');
          localStorage.setItem('skin-theme', 'clientpref-night');
          localStorage.setItem('wikimedia-theme', 'dark');
        } catch (_) {}
        clickDarkControls();
      } else {
        clickDarkControls();
      }

      const bg = window.getComputedStyle(document.body || root).backgroundColor || '';
      const parts = bg.match(/\\d+/g) || [];
      if (parts.length >= 3) {
        const [r, g, b] = parts.slice(0, 3).map(Number);
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        return { fallbackNeeded: luminance > 0.6 };
      }
      return { fallbackNeeded: true };
    } catch (_) {
      return { fallbackNeeded: true };
    }
  })();
`;

// Single-pass HTML escaping via lookup table + one regex call (faster than
// chaining 5 separate String#replace calls).
const _ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const _ESC_RE  = /[&<>"']/g;
const escapeHtml = (value = '') => String(value).replace(_ESC_RE, c => _ESC_MAP[c]);

// ─── SIMPLE DEBOUNCE UTILITY ─────────────────────────────────────────────────
const debounce = (fn, ms) => {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
};

// ─── MAIN INIT ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    // ── SPEECH ENGINE ─────────────────────────────────────────────────────────
    // Voices are loaded once and cached; avoids calling getVoices() on every
    // speak() call which would trigger repeated IPC / synchronous list lookups.
    let _cachedVoices = [];
    const _loadVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length) _cachedVoices = v;
    };
    _loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', _loadVoices);

    window.speechManager = {
        synth: window.speechSynthesis,
        speak(text) {
            if (!text) return;
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            const voices = _cachedVoices;
            const voice  = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google')))
                        || voices.find(v => v.lang.startsWith('en'))
                        || voices[0];
            if (voice) utter.voice = voice;
            utter.rate  = 1.0;
            utter.pitch = 1.0;
            window.speechSynthesis.speak(utter);
        },
        stop() { window.speechSynthesis.cancel(); }
    };

    // ── ELEMENT REFS (queried once) ────────────────────────────────────────────
    const featuresHomePopup             = document.getElementById('features-home-popup');
    const quickPanelYoutubeAddon        = document.getElementById('quick-panel-youtube-addon');
    const quickPanelDuckAi              = document.getElementById('quick-panel-duck-ai');
    const quickPanelNavigation          = document.getElementById('quick-panel-navigation');
    const quickPanelPageInfo            = document.getElementById('quick-panel-page-info');
    const quickPanelBookmarks           = document.getElementById('quick-panel-bookmarks');
    const quickPanelScraper             = document.getElementById('quick-panel-scraper');
    const quickPanelTodoStation         = document.getElementById('quick-panel-todo-station');
    const quickPanelGames               = document.getElementById('quick-panel-games');
    const quickPanelLlamaServer         = document.getElementById('quick-panel-llama-server');
    const quickPanelMcpServer           = document.getElementById('quick-panel-mcp-server');
    const quickPanelDiscord             = document.getElementById('quick-panel-discord');
    const navigationTopPanel            = document.getElementById('navigation-top-panel');
    const btnTopNavBack                 = document.getElementById('btn-top-nav-back');
    const btnTopNavForward              = document.getElementById('btn-top-nav-forward');
    const bookmarkTopPanel              = document.getElementById('bookmark-top-panel');
    const bookmarkTopList               = document.getElementById('bookmark-top-list');
    const bookmarkEditorOverlay         = document.getElementById('bookmark-editor-overlay');
    const bookmarkEditorName            = document.getElementById('bookmark-editor-name');
    const bookmarkEditorIcon            = document.getElementById('bookmark-editor-icon');
    const bookmarkEditorPreviewIcon     = document.getElementById('bookmark-editor-preview-icon');
    const bookmarkEditorPreviewName     = document.getElementById('bookmark-editor-preview-name');
    const bookmarkEditorCancel          = document.getElementById('bookmark-editor-cancel');
    const bookmarkEditorSave            = document.getElementById('bookmark-editor-save');
    const imageDlOverlay                = document.getElementById('image-dl-overlay');
    const imageDlPreview                = document.getElementById('image-dl-preview');
    const btnImageDlCancel              = document.getElementById('btn-image-dl-cancel');
    const dlFormatBtns                  = document.querySelectorAll('.dl-format-btn');
    const btnDelay                      = document.getElementById('btn-ss-delay');
    const delayDropdown                 = document.getElementById('delay-dropdown');
    const delayLabel                    = document.getElementById('delay-label');
    const delayOptions                  = document.querySelectorAll('.delay-option');
    const btnLens                       = document.getElementById('btn-ss-lens');
    const downloadToast                 = document.getElementById('download-toast');
    const dlFilename                    = downloadToast?.querySelector('.dl-toast-filename');
    const dlStatus                      = downloadToast?.querySelector('.dl-toast-status');
    const dlFill                        = downloadToast?.querySelector('.dl-toast-fill');
    const dlCancelBtn                   = document.getElementById('btn-download-toast-cancel');
    const youtubeAddonPanel             = document.getElementById('youtube-addon-panel') || document.getElementById('youtube-addon-popup');
    const youtubeAddonToggleHome        = document.getElementById('youtube-addon-toggle-home');
    const youtubeAddonToggleBlur        = document.getElementById('youtube-addon-toggle-blur');
    const youtubeAddonToggleChat        = document.getElementById('youtube-addon-toggle-chat');
    const youtubeAddonToggleBw          = document.getElementById('youtube-addon-toggle-bw');
    const youtubeAddonToggleAdSkipper   = document.getElementById('youtube-addon-toggle-adskipper');
    const duckAiPanel                   = document.getElementById('duck-ai-panel');
    const duckAiToggleSidebar           = document.getElementById('duck-ai-toggle-sidebar');
    const webviewContextMenu            = document.getElementById('webview-context-menu');
    const tabContextMenu                = document.getElementById('tab-context-menu');
    const btnMin                        = document.getElementById('btn-min');
    const btnMax                        = document.getElementById('btn-max');
    const btnClose                      = document.getElementById('btn-close');
    // Sidebar nav buttons – queried once here (bindSidebarNavigation reuses these refs)
    const btnNavHome                    = document.getElementById('btn-nav-home');
    const btnNavNewTab                  = document.getElementById('btn-new-tab');

    // ── STATE ─────────────────────────────────────────────────────────────────
    let cachedSettings        = null;
    let currentTabContextId   = null;
    let currentImageToDownload = null;
    let toastTimeout          = null;
    let activeToastDownloadId = null;
    let screenshotDelaySeconds = 0;
    let bookmarkItems         = [];
    let pendingBookmarkTab    = null;
    const darkModeTabs        = new Set();
    let tabManager            = null;
    let _settingsLoading      = false;   // guard against parallel loadSettings calls
    let _ytSavePending        = false;   // guard against concurrent persist calls
    let _duckSavePending      = false;

    // ── DYNAMICALLY CREATED CONTEXT-MENU ELEMENTS ─────────────────────────────
    const MENU_STYLE = 'position:fixed;background:var(--glass-bg);backdrop-filter:var(--glass-blur);'
        + 'border:1px solid rgba(255,255,255,0.15);border-radius:12px;min-width:200px;'
        + 'box-shadow:0 20px 40px rgba(0,0,0,0.4);z-index:50001;display:flex;flex-direction:column;';

    const sidePanelContextMenu = document.createElement('div');
    sidePanelContextMenu.id        = 'sidebar-context-menu';
    sidePanelContextMenu.className = 'context-menu hidden';
    sidePanelContextMenu.style.cssText = MENU_STYLE;
    document.body.appendChild(sidePanelContextMenu);

    const hiddenSidebarContextMenu = document.createElement('div');
    hiddenSidebarContextMenu.id        = 'hidden-sidebar-context-menu';
    hiddenSidebarContextMenu.className = 'context-menu hidden';
    hiddenSidebarContextMenu.style.cssText = MENU_STYLE;
    document.body.appendChild(hiddenSidebarContextMenu);

    const contextMenuBackdrop = document.createElement('div');
    contextMenuBackdrop.id        = 'context-menu-backdrop';
    contextMenuBackdrop.className = 'hidden';
    contextMenuBackdrop.style.cssText = 'position:fixed;inset:0;z-index:9999;background:transparent;pointer-events:none;';
    document.body.appendChild(contextMenuBackdrop);

    // ── SITE-INFO OVERLAY (built once) ────────────────────────────────────────
    // Previously siteInfoOverlay.innerHTML was assigned TWICE; the first
    // assignment was immediately overwritten.  Now it is written once.
    const siteInfoOverlay = document.createElement('div');
    siteInfoOverlay.id        = 'site-info-overlay';
    siteInfoOverlay.className = 'site-info-top-panel hidden';
    siteInfoOverlay.innerHTML = `
      <div id="site-info-panel" style="
          width:min(420px,calc(100vw - 20px));
          display:flex;flex-direction:column;
          background:linear-gradient(180deg,rgba(28,29,33,0.98),rgba(34,35,40,0.96));
          border:1px solid rgba(255,255,255,0.08);border-top:none;
          border-radius:0 0 16px 16px;
          box-shadow:0 8px 20px rgba(0,0,0,0.22);
          padding:10px;overflow:hidden;color:rgba(255,255,255,0.94);">
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;
                    padding:1px 2px 8px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="width:100%;text-align:center;font-size:11px;font-weight:700;
                      letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.72);">Page Info</div>
        </div>
        <div id="site-info-grid" style="
            display:grid;grid-template-columns:minmax(86px,108px) minmax(0,1fr);
            gap:6px 8px;align-content:start;"></div>
      </div>`;
    document.body.appendChild(siteInfoOverlay);

    const siteInfoPanel = document.getElementById('site-info-panel');
    const siteInfoGrid  = document.getElementById('site-info-grid');
    let siteInfoRefreshToken = 0;

    // ── HELPERS ───────────────────────────────────────────────────────────────
    const hideFeaturesHomePopup = () => featuresHomePopup?.classList.add('hidden');

    const sanitizeBookmarkIcon = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return BOOKMARK_FALLBACK_ICON;
        try {
            const parsed = new URL(raw, window.location.href);
            return ['http:', 'https:', 'file:', 'data:'].includes(parsed.protocol) ? raw : BOOKMARK_FALLBACK_ICON;
        } catch (_) { return BOOKMARK_FALLBACK_ICON; }
    };

    const resolveThemeId = (theme) => {
        const key = String(theme || '').trim();
        return key ? (THEME_ALIAS_MAP[key] || key) : 'noir';
    };

    const applyTheme = (theme) => {
        document.body.className = `theme-${resolveThemeId(theme)}`;
    };

    const isEditableTarget = (target) => {
        if (!target) return false;
        if (target.isContentEditable) return true;
        return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
    };

    const isHttpWebsiteUrl = (rawUrl = '') => /^https?:\/\//i.test(String(rawUrl || '').trim());

    const isYouTubeUrl = (url = '') => {
        try {
            const host = new URL(url).hostname.toLowerCase();
            return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
        } catch (_) { return false; }
    };

    const isYouTubeWatchUrl = (url = '') => {
        try {
            const parsed = new URL(url);
            const host   = String(parsed.hostname || '').toLowerCase();
            return (host === 'youtube.com' || host.endsWith('.youtube.com'))
                && String(parsed.pathname || '').startsWith('/watch');
        } catch (_) { return false; }
    };

    const isDuckAiChatUrl = (url = '') => {
        try {
            const parsed = new URL(url);
            const host   = String(parsed.hostname || '').toLowerCase();
            return (host === 'duck.ai' || host.endsWith('.duck.ai'))
                && parsed.pathname.startsWith('/chat');
        } catch (_) { return false; }
    };

    const getActiveTabState = () => {
        if (!tabManager?.tabs?.length || !tabManager?.activeTabId) return null;
        return tabManager.tabs.find(t => t.id === tabManager.activeTabId) || null;
    };

    const getActiveTabUrl = () => {
        const wv = tabManager?.getActiveWebview?.();
        if (wv) { try { return wv.getURL(); } catch (_) { return wv.src || ''; } }
        return getActiveTabState()?.url || '';
    };

    const getPageTypeLabel = (tab) => {
        if (!tab) return 'Unknown';
        if (tab.isSystemPage)         return 'System';
        if (tab.isHistoryPage)        return 'History';
        if (tab.isHomePage)           return 'Home';
        if (tab.isDefensePage)        return 'Security Alert';
        return 'Website';
    };

    const formatMs = (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? `${Math.round(n)} ms` : 'N/A';
    };

    // ── CONTEXT MENUS ─────────────────────────────────────────────────────────
    const removeDynamicContextSubmenus = () => {
        // Single querySelectorAll sweep instead of two.
        document.querySelectorAll('.context-menu-submenu, .context-menu-item.submenu-open')
            .forEach(el => {
                if (el.classList.contains('context-menu-submenu')) el.remove();
                else el.classList.remove('submenu-open');
            });
    };

    const closeAllContextMenus = () => {
        removeDynamicContextSubmenus();
        webviewContextMenu?.classList.add('hidden');
        tabContextMenu?.classList.add('hidden');
        sidePanelContextMenu.classList.add('hidden');
        hiddenSidebarContextMenu.classList.add('hidden');
        contextMenuBackdrop.classList.add('hidden');
        contextMenuBackdrop.style.pointerEvents = 'none';
    };

    const showContextMenuBackdrop = () => {
        contextMenuBackdrop.classList.remove('hidden');
        contextMenuBackdrop.style.pointerEvents = 'auto';
    };

    contextMenuBackdrop.addEventListener('mousedown',    (e) => { e.preventDefault(); closeAllContextMenus(); });
    contextMenuBackdrop.addEventListener('contextmenu',  (e) => { e.preventDefault(); closeAllContextMenus(); });

    // ── SITE-INFO HELPERS ─────────────────────────────────────────────────────
    const setSiteInfoVisible  = (v) => siteInfoOverlay?.classList.toggle('hidden', !v);
    const hideSiteInfoPopup   = ()  => setSiteInfoVisible(false);

    const renderSiteInfoRows = (rows = []) => {
        if (!siteInfoGrid) return;
        siteInfoGrid.innerHTML = rows.map(({ label = '', value }) => {
            const lbl = String(label);
            const val = String(value ?? 'N/A');
            let tone  = 'neutral';
            if (lbl.toLowerCase() === 'safety') {
                if      (/^safe$/i.test(val))                                  tone = 'ok';
                else if (/^(danger|unsafe)$/i.test(val) || /failed/i.test(val)) tone = 'error';
                else if (/^suspicious$/i.test(val))                            tone = 'warn';
                else if (/^checking/i.test(val))                               tone = 'info';
            }
            return `<div class="site-info-label">${escapeHtml(lbl)}</div>`
                 + `<div class="site-info-value" data-tone="${escapeHtml(tone)}">${escapeHtml(val)}</div>`;
        }).join('');
    };

    const buildSiteInfoRows = (data) => ([
        { label: 'URL',    value: data.url    || 'N/A' },
        { label: 'Safety', value: data.safety || 'Not scanned' }
    ]);

    const resolveSiteSafetyLabel = (result = null, rawUrl = '') => {
        if (!isHttpWebsiteUrl(rawUrl)) return 'Not available for this page';
        if (!result) return 'Checking safety...';
        return result.success
            ? (String(result.safety || (result.safe ? 'Safe' : 'Unknown')).trim() || 'Unknown')
            : (String(result.safety || result.error || 'Check failed').trim() || 'Check failed');
    };

    const primeSiteSafetyScan = (rawUrl = '') => {
        const currentUrl = String(rawUrl || '').trim();
        if (!isHttpWebsiteUrl(currentUrl) || !window.browserAPI?.security?.primeSiteSafetyScan) return;
        window.browserAPI.security.primeSiteSafetyScan({ url: currentUrl, recordVisit: true }).catch(() => {});
    };

    const collectWebviewDiagnostics = async (webview) => {
        if (!webview?.executeJavaScript) return {};
        try {
            const result = await Promise.race([
                webview.executeJavaScript(`
                  (async () => {
                    const out = {
                      livePingMs: null, navPingMs: null, loadMs: null,
                      online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
                      lang: typeof navigator !== 'undefined' ? (navigator.language || '') : '',
                      connectionType: '', downlink: null
                    };
                    try {
                      const nav = (performance.getEntriesByType?.('navigation') || [])[0] || null;
                      if (nav) {
                        if (Number.isFinite(nav.responseStart) && nav.responseStart > 0) out.navPingMs = Math.round(nav.responseStart);
                        if (Number.isFinite(nav.loadEventEnd)  && nav.loadEventEnd  > 0) out.loadMs   = Math.round(nav.loadEventEnd);
                      }
                    } catch (_) {}
                    try {
                      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                      if (conn) { out.connectionType = conn.effectiveType || conn.type || ''; out.downlink = Number.isFinite(conn.downlink) ? conn.downlink : null; }
                    } catch (_) {}
                    try {
                      const target = (location && /^https?:/i.test(location.href || '')) ? (location.origin || location.href) : '';
                      if (target && typeof fetch === 'function') {
                        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                        const start = performance.now();
                        let timer = null;
                        if (controller) timer = setTimeout(() => controller.abort(), 1400);
                        try {
                          await fetch(target, { method: 'HEAD', cache: 'no-store', mode: 'no-cors', signal: controller?.signal });
                          out.livePingMs = Math.max(1, Math.round(performance.now() - start));
                        } catch (_) {}
                        if (timer) clearTimeout(timer);
                      }
                    } catch (_) {}
                    return out;
                  })();
                `),
                new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 1800))
            ]);
            return (result && typeof result === 'object') ? result : {};
        } catch (_) { return {}; }
    };

    const refreshSiteInfoPopup = async () => {
        const activeTab    = getActiveTabState();
        const activeWebview = tabManager?.getActiveWebview?.();
        const token        = ++siteInfoRefreshToken;

        if (!activeTab && !activeWebview) {
            renderSiteInfoRows(buildSiteInfoRows({ url: 'No active website', safety: 'Not scanned' }));
            return;
        }

        const currentUrl = String(activeTab?.url || activeWebview?.getURL?.() || '').trim();
        renderSiteInfoRows(buildSiteInfoRows({
            url:    currentUrl || 'N/A',
            safety: isHttpWebsiteUrl(currentUrl) ? 'Checking safety...' : 'Not available for this page'
        }));

        let siteSafety = null;
        if (isHttpWebsiteUrl(currentUrl)) {
            try {
                siteSafety = await window.browserAPI?.security?.getSiteSafetyStatus?.({ url: currentUrl, allowScan: true });
            } catch (_) {}
        }
        if (token !== siteInfoRefreshToken) return;

        renderSiteInfoRows(buildSiteInfoRows({
            url:    currentUrl || 'N/A',
            safety: resolveSiteSafetyLabel(siteSafety, currentUrl)
        }));
    };

    const openSiteInfoPopup = async () => {
        hideFeaturesHomePopup();
        setNavigationTopPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        setSiteInfoVisible(true);
        await refreshSiteInfoPopup();
    };

    siteInfoPanel?.addEventListener('mousedown', e => e.stopPropagation());

    // ── DARK MODE FOR TABS ────────────────────────────────────────────────────
    const toggleDarkModeForTab = async (tabId) => {
        const tab = tabManager.tabs.find(t => t.id === tabId);
        if (!tab?.webview) return;
        const isDarkMode = darkModeTabs.has(tabId);
        try {
            if (isDarkMode) {
                await tab.webview.executeJavaScript(`
                  (function() {
                    const style = document.getElementById('omx-dark-mode-style');
                    if (style) style.remove();
                    const meta = document.querySelector('meta[name="color-scheme"][data-omx-injected="1"]');
                    if (meta) meta.remove();
                    try {
                      if (window.__omxOriginalMatchMedia) {
                        window.matchMedia = window.__omxOriginalMatchMedia;
                        delete window.__omxOriginalMatchMedia;
                      }
                    } catch (_) {}
                    try { document.documentElement.style.removeProperty('color-scheme'); } catch (_) {}
                    return true;
                  })();
                `);
                darkModeTabs.delete(tabId);
            } else {
                const nativeResult = await tab.webview.executeJavaScript(NATIVE_DARK_MODE_SCRIPT);
                let fallbackNeeded = !!nativeResult?.fallbackNeeded;
                if (fallbackNeeded) {
                    await new Promise(resolve => setTimeout(resolve, 250));
                    const retry = await tab.webview.executeJavaScript(NATIVE_DARK_MODE_SCRIPT);
                    fallbackNeeded = !!retry?.fallbackNeeded;
                }
                if (fallbackNeeded) {
                    await tab.webview.executeJavaScript(`
                      (function() {
                        let style = document.getElementById('omx-dark-mode-style');
                        if (!style) {
                          style = document.createElement('style');
                          style.id = 'omx-dark-mode-style';
                          style.textContent = \`${DARK_MODE_CSS.replace(/`/g, '\\`')}\`;
                          (document.head || document.documentElement).appendChild(style);
                        }
                        return true;
                      })();
                    `);
                }
                darkModeTabs.add(tabId);
            }
        } catch (e) {
            console.error('[Dark Mode] Failed to toggle dark mode:', e);
        }
    };

    // ── WEBVIEW CONTEXT MENU ──────────────────────────────────────────────────
    const handleWebviewContextMenu = (params) => {
        closeAllContextMenus();
        if (!webviewContextMenu) return;
        webviewContextMenu.innerHTML = '';
        const activeWebview  = tabManager.getActiveWebview();
        const sidePanelState = sidePanel?.getState?.() || { isHidden: false, isCollapsed: false };

        if (params.linkURL) {
            tabManager.createTab(params.linkURL);
            return;
        }

        const createMenuItem = (targetMenu, label, icon) => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="${icon}" fill="currentColor"/></svg><span>${label}</span>`;
            targetMenu.appendChild(item);
            return item;
        };

        const addAction = (targetMenu, label, icon, click) => {
            const item = createMenuItem(targetMenu, label, icon);
            item.onclick = () => { try { click(); } finally { closeAllContextMenus(); } };
            return item;
        };

        const addDivider = (targetMenu, compact = false) => {
            const divider = document.createElement('div');
            divider.style.cssText = `height:1px;background:rgba(255,255,255,0.1);margin:${compact ? '2px' : '4px'} 0;`;
            targetMenu.appendChild(divider);
        };

        const renderEntries = (targetMenu, entries = []) => {
            entries.forEach(entry => {
                if (!entry) return;
                if (entry.type === 'divider') return addDivider(targetMenu, !!entry.compact);
                if (entry.type === 'action')  return addAction(targetMenu, entry.label, entry.icon, entry.click);
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
            submenu.style.cssText = 'position:fixed;width:220px;z-index:10001;padding:6px;display:flex;flex-direction:column;gap:2px;';
            renderEntries(submenu, entries);
            document.body.appendChild(submenu);

            // Single getBoundingClientRect read per positioning cycle
            const rect        = triggerItem.getBoundingClientRect();
            const submenuRect = submenu.getBoundingClientRect();
            const vp          = 8;
            const gap         = 6;
            let left = rect.right + gap;
            let top  = rect.top  - 2;
            if (left + submenuRect.width  > window.innerWidth  - vp) left = rect.left - submenuRect.width - gap;
            if (left < vp) left = vp;
            if (top  + submenuRect.height > window.innerHeight - vp) top  = window.innerHeight - submenuRect.height - vp;
            if (top  < vp) top  = vp;
            submenu.style.left = `${left}px`;
            submenu.style.top  = `${top}px`;

            submenu.addEventListener('mousedown',   e => e.stopPropagation());
            submenu.addEventListener('contextmenu', e => e.stopPropagation());
        };

        const addSubmenu = (label, icon, entries) => {
            if (!entries?.length) return;
            const item = createMenuItem(webviewContextMenu, label, icon);
            item.style.justifyContent = 'space-between';
            const arrow = document.createElement('span');
            arrow.textContent  = '›';
            arrow.style.cssText = 'margin-left:auto;color:rgba(255,255,255,0.6);font-size:16px;line-height:1;';
            item.appendChild(arrow);
            item.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openSubmenu(item, entries); });
            item.addEventListener('mouseenter', () => {
                const openTrigger = webviewContextMenu.querySelector('.context-menu-item.submenu-open');
                if (openTrigger && openTrigger !== item) openSubmenu(item, entries);
            });
            return item;
        };

        const systemEntries = [
            { type: 'action', label: 'Minimize',          icon: 'M19 13H5v-2h14v2z',                                                         click: () => window.browserAPI?.window?.minimize?.() },
            { type: 'action', label: 'Maximize / Restore', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z', click: () => window.browserAPI?.window?.toggleMaximize?.() },
            { type: 'action', label: 'Close',              icon: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z', click: () => window.browserAPI?.window?.close?.() }
        ];

        const pageEntries = [
            { type: 'action', label: 'Back',   icon: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',  click: () => activeWebview?.goBack()   },
            { type: 'action', label: 'Reload', icon: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z', click: () => activeWebview?.reload() }
        ];

        if (params.linkURL) {
            pageEntries.push(
                { type: 'divider', compact: true },
                { type: 'action', label: 'Open Link in New Tab', icon: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z', click: () => tabManager.createTab(params.linkURL) }
            );
        }

        if (params.hasImageContents || params.srcURL) {
            const imageActions = [
                { type: 'action', label: 'Download Image...',    icon: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',  click: () => openImageDownloadOptions(params.srcURL) },
                { type: 'action', label: 'Open Image in New Tab', icon: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z', click: () => tabManager.createTab(params.srcURL) }
            ];
            const imageUrlForLens = String(params.srcURL || '').trim();
            if (/^https?:\/\//i.test(imageUrlForLens)) {
                imageActions.push({
                    type: 'action', label: 'Search with Google Lens',
                    icon: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
                    click: () => tabManager.createTab(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrlForLens)}`)
                });
            }
            pageEntries.push({ type: 'divider', compact: true }, ...imageActions);
        }

        const aiEntries   = [];
        const editEntries = [];

        if (params.selectionText) {
            aiEntries.push(
                { type: 'action', label: 'Read Selection',     icon: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.1-.9-2-2-2s-2 .9-2 2v6c0 1.1.9 2 2 2z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z', click: () => window.speechManager.speak(params.selectionText) },
                { type: 'action', label: 'Improve with Writer', icon: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', click: () => writerUI.show(params.selectionText, params.selectionX || params.x, params.selectionY || params.y) },
                { type: 'action', label: 'Translate Selection', icon: 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2H1v2H11.17c-.71 2.06-1.75 4.05-3.04 5.81-1.01-1.12-1.87-2.34-2.57-3.64H4.5c.81 1.63 1.83 3.17 3.03 4.58L3.06 18.06l1.41 1.41 4.7-4.7 3.13 3.13 1.98-1.83z', click: () => translatorUI.show(params.selectionText, params.selectionX || params.x, params.selectionY || params.y) },
                {
                    type: 'action', label: 'Google Translate',
                    icon: 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2H1v2H11.17c-.71 2.06-1.75 4.05-3.04 5.81-1.01-1.12-1.87-2.34-2.57-3.64H4.5c.81 1.63 1.83 3.17 3.03 4.58L3.06 18.06l1.41 1.41 4.7-4.7 3.13 3.13 1.98-1.83z',
                    click: () => tabManager.createTab(`https://translate.google.co.in/?sl=auto&tl=bn&text=${encodeURIComponent(params.selectionText)}&op=translate`)
                }
            );
            const defEngine = cachedSettings?.searchEngines?.find(e => e.id === (cachedSettings.defaultSearchEngineId || 'google'));
            if (defEngine) {
                aiEntries.push({
                    type: 'action', label: `Search ${defEngine.name}`,
                    icon: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
                    click: () => tabManager.createTab(defEngine.url.replace('%s', encodeURIComponent(params.selectionText)))
                });
            }
            editEntries.push({
                type: 'action', label: 'Copy',
                icon: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
                click: () => { if (activeWebview) { activeWebview.focus(); activeWebview.copy(); } }
            });
        }

        if (params.isEditable) {
            editEntries.push({
                type: 'action', label: 'Paste',
                icon: 'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z',
                click: () => activeWebview?.paste()
            });
        }

        addSubmenu('System',    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.81 8.87c-.11.2-.06.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94 0 .33.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.24.23.41.47.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.12-.56 1.62-.94l2.39.96c.22.07.47 0 .59-.22l1.92-3.32c.11-.2.06-.47-.12-.61l-2.01-1.58zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z', systemEntries);
        addSubmenu('Page',      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.93 6h-2.95a15.66 15.66 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.51 1.91 3.96h-3.82A13.88 13.88 0 0 1 12 4.04zM4.26 14A8.02 8.02 0 0 1 4 12c0-.69.09-1.36.26-2h3.1c-.05.66-.08 1.33-.08 2s.03 1.34.08 2h-3.1zm.81 2h2.95c.35 1.28.82 2.48 1.38 3.56A8.03 8.03 0 0 1 5.07 16zM8.02 14c-.06-.66-.1-1.33-.1-2s.04-1.34.1-2h3.98v4H8.02zm3.98 5.96A13.9 13.9 0 0 1 10.09 16h3.82A13.9 13.9 0 0 1 12 19.96zM13.98 14v-4h3.98c.06.66.1 1.33.1 2s-.04 1.34-.1 2h-3.98zm.62 5.56A15.66 15.66 0 0 0 15.98 16h2.95a8.03 8.03 0 0 1-4.33 3.56z', pageEntries);
        addSubmenu('AI',        'M12 2l2.2 4.8L19 9l-4.8 2.2L12 16l-2.2-4.8L5 9l4.8-2.2L12 2zm7.5 13 1.1 2.4L23 18.5l-2.4 1.1L19.5 22l-1.1-2.4L16 18.5l2.4-1.1 1.1-2.4zM4.5 14l.85 1.85L7.2 16.7l-1.85.85L4.5 19.4l-.85-1.85L1.8 16.7l1.85-.85L4.5 14z', aiEntries);
        addSubmenu('Edit',      'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H5V4h2v3h10V4h2v16z', editEntries);
        addSubmenu('Developer', 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z', [
            {
                type: 'action', label: 'Info',
                icon: 'M11 7h2V5h-2v2zm0 12h2v-8h-2v8zm1-17C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z',
                click: () => openSiteInfoPopup()
            },
            {
                type: 'action',
                label: sidePanelState.isHidden ? 'Show Sidebar' : (sidePanelState.isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'),
                icon:  sidePanelState.isHidden
                    ? 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'
                    : (sidePanelState.isCollapsed ? 'M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6-1.41-1.41z' : 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'),
                click: () => { if (sidePanelState.isHidden) sidePanel.show(); else sidePanel.toggle(); }
            },
            !sidePanelState.isHidden && {
                type: 'action', label: 'Hide Sidebar',
                icon: 'M11.83 9L15 12.16c.5-.3.83-.86.83-1.5 0-1.66-1.34-3-3-3-.64 0-1.2.25-1.63.7L11.83 9zm8.05 4.34L23 21.07 21.07 23l-2.58-2.59C15.25 22.09 12.67 23 10 23c-4.97 0-9.27-3.11-11-7.5 1.54-3.82 4.61-6.87 8.35-8.24L2.93 3 4.93 1.07 20.88 17.02l-.05.32zM7.53 9.8C7.08 10.16 6.81 10.75 6.81 11.39c0 1.66 1.34 3 3 3 .64 0 1.23-.25 1.63-.61L7.53 9.8z',
                click: () => sidePanel.toggleHidden()
            },
            {
                type: 'action', label: 'Inspect Element',
                icon: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
                click: () => { if (activeWebview) activeWebview.inspectElement(params.x, params.y); }
            }
        ]);

        webviewContextMenu.style.left = `${params.x}px`;
        webviewContextMenu.style.top  = `${params.y}px`;
        showContextMenuBackdrop();
        webviewContextMenu.classList.remove('hidden');
    };

    // ── TAB CONTEXT MENU ──────────────────────────────────────────────────────
    const handleTabContextMenu = async (id, x, y) => {
        closeAllContextMenus();
        currentTabContextId = id;
        if (!tabContextMenu) return;
        tabContextMenu.style.left = `${x}px`;
        tabContextMenu.style.top  = `${y}px`;
        showContextMenuBackdrop();
        tabContextMenu.classList.remove('hidden');

        const tab = tabManager.tabs.find(t => t.id === id);
        if (tab) {
            const darkModeItem = document.getElementById('ctx-dark-mode');
            if (darkModeItem) {
                const isDarkMode = darkModeTabs.has(id);
                const span = darkModeItem.querySelector('span');
                if (span) span.textContent = isDarkMode ? 'Disable Dark Mode' : 'Enable Dark Mode';
                darkModeItem.style.color = isDarkMode ? '#4fc3f7' : '';
            }
        }
    };

    // Shared sidebar context-menu item builder (de-duplicates addSidebarMenuItem
    // and addHiddenSidebarMenuItem which were identical).
    const makeSidebarMenuItem = (targetMenu, label, icon, click) => {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="${icon}" fill="currentColor"/></svg><span>${label}</span>`;
        // Hover handled via CSS .context-menu-item:hover rule; no JS events needed.
        item.onclick = () => { click(); targetMenu.classList.add('hidden'); };
        targetMenu.appendChild(item);
    };

    const makeDivider = () => {
        const d = document.createElement('div');
        d.style.cssText = 'height:1px;background:rgba(255,255,255,0.1);margin:4px 0;';
        return d;
    };

    const handleSidePanelContextMenu = (x, y) => {
        closeAllContextMenus();
        sidePanelContextMenu.innerHTML = '';
        const state = sidePanel.getState();

        if (!state.isHidden) {
            makeSidebarMenuItem(sidePanelContextMenu,
                state.isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar',
                state.isCollapsed ? 'M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6-1.41-1.41z' : 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
                () => sidePanel.toggle()
            );
        }
        makeSidebarMenuItem(sidePanelContextMenu,
            state.isHidden ? 'Show Sidebar' : 'Hide Sidebar',
            state.isHidden
                ? 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'
                : 'M11.83 9L15 12.16c.5-.3.83-.86.83-1.5 0-1.66-1.34-3-3-3-.64 0-1.2.25-1.63.7L11.83 9zm8.05 4.34L23 21.07 21.07 23l-2.58-2.59C15.25 22.09 12.67 23 10 23c-4.97 0-9.27-3.11-11-7.5 1.54-3.82 4.61-6.87 8.35-8.24L2.93 3 4.93 1.07 20.88 17.02l-.05.32zM7.53 9.8C7.08 10.16 6.81 10.75 6.81 11.39c0 1.66 1.34 3 3 3 .64 0 1.23-.25 1.63-.61L7.53 9.8z',
            () => sidePanel.toggleHidden()
        );
        sidePanelContextMenu.appendChild(makeDivider());
        makeSidebarMenuItem(sidePanelContextMenu, 'Restore Full View',
            'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
            () => sidePanel.restore()
        );

        sidePanelContextMenu.style.left = `${x}px`;
        sidePanelContextMenu.style.top  = `${y}px`;
        showContextMenuBackdrop();
        sidePanelContextMenu.classList.remove('hidden');
    };

    const handleHiddenSidebarContextMenu = (x, y) => {
        closeAllContextMenus();
        hiddenSidebarContextMenu.innerHTML = '';
        const activeWebview = tabManager.getActiveWebview();

        makeSidebarMenuItem(hiddenSidebarContextMenu, 'Show Sidebar',
            'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
            () => sidePanel.show()
        );
        hiddenSidebarContextMenu.appendChild(makeDivider());
        makeSidebarMenuItem(hiddenSidebarContextMenu, 'Back',
            'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
            () => activeWebview?.goBack()
        );
        makeSidebarMenuItem(hiddenSidebarContextMenu, 'Reload',
            'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
            () => activeWebview?.reload()
        );

        hiddenSidebarContextMenu.style.left = `${x}px`;
        hiddenSidebarContextMenu.style.top  = `${y}px`;
        showContextMenuBackdrop();
        hiddenSidebarContextMenu.classList.remove('hidden');
    };

    // ── FOCUS TRACKING ────────────────────────────────────────────────────────
    const syncFocusState = () => {
        const el = document.activeElement;
        const isInput = el && (['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);
        window.browserAPI?.focusChanged?.(!!isInput);
    };
    window.addEventListener('focusin',  syncFocusState);
    window.addEventListener('focusout', () => queueMicrotask(syncFocusState));   // replaces setTimeout(fn,0)

    // ── WINDOW CONTROLS ───────────────────────────────────────────────────────
    if (btnMin)   btnMin.addEventListener('click',   () => window.browserAPI.window.minimize());
    if (btnMax)   btnMax.addEventListener('click',   () => window.browserAPI.window.toggleMaximize());
    if (btnClose) btnClose.addEventListener('click', () => window.browserAPI.window.close());

    // ── APP-TAB UTILS ─────────────────────────────────────────────────────────
    const openAppTab = (url) => {
        const existing = tabManager.tabs.find(t => t.url === url);
        if (existing) tabManager.setActiveTab(existing.id); else tabManager.createTab(url);
        featuresHomePopup?.classList.add('hidden');
    };

    const buildOmChatUrl = (host = 'localhost', port = OM_CHAT_DEFAULT_PORT, pathname = '/') => {
        const safeHost = String(host || 'localhost').trim() || 'localhost';
        const safePort = Number(port) || OM_CHAT_DEFAULT_PORT;
        const safePath = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${String(pathname || '')}`;
        return `http://${safeHost}:${safePort}${safePath}`;
    };

    const getLlamaServerUrl = () => {
        let host = '127.0.0.1', port = '8080';
        try {
            const raw = localStorage.getItem('llama-server-settings');
            if (raw) {
                const s = JSON.parse(raw);
                if (s?.host) host = String(s.host).trim() || host;
                if (s?.port) port = String(s.port).trim() || port;
            }
        } catch (_) {}
        if (host === '0.0.0.0' || host === 'ngrok') host = '127.0.0.1';
        if (/^https?:\/\//i.test(host)) {
            try {
                const u = new URL(host);
                const finalPort = u.port || port;
                return `${u.protocol}//${u.hostname}${finalPort ? `:${finalPort}` : ''}/`;
            } catch (_) { return host; }
        }
        const cleanedHost = host.replace(/^\/\//, '');
        return cleanedHost.includes(':') && !cleanedHost.startsWith('[')
            ? `http://${cleanedHost}/`
            : `http://${cleanedHost}:${port}/`;
    };

    const getAiChatTargetUrl = async () => {
        try {
            const statusRes = await window.browserAPI?.servers?.getStatus?.('llama');
            if (statusRes?.success && statusRes.status?.running) return getLlamaServerUrl();
        } catch (error) {
            console.warn('[AI Chat] Local AI status check failed:', error?.message || error);
        }
        return DUCK_AI_URL;
    };

    const launchOmChat = async () => {
        hideFeaturesHomePopup();
        try {
            const result = await window.browserAPI.omChat.startServer({ useNgrok: true });
            if (!result?.success) {
                console.error('[Om Chat] Failed to start server:', result?.error || 'Unknown error');
                window.alert(`Om Chat failed to start: ${result?.error || 'Unknown error'}`);
                return;
            }
            const publicUrl = String(result?.publicUrl || result?.accessInfo?.publicUrl || '').trim().replace(/[/\\]+$/, '');
            if (!publicUrl) {
                const message = result?.tunnelError || result?.error || 'ngrok public URL was not created.';
                console.error('[Om Chat] Public tunnel unavailable:', message);
                window.alert(`Om Chat public launch failed: ${message}`);
                return;
            }
            window.__omxOmChatNetworkUrl = `${publicUrl}/`;
            openAppTab(window.__omxOmChatNetworkUrl);
        } catch (error) {
            console.error('[Om Chat] Launcher failed:', error);
            window.alert(`Om Chat failed to start: ${error?.message || error}`);
        }
    };

    // ── PANEL VISIBILITY HELPERS ──────────────────────────────────────────────
    const setBookmarkPanelVisible       = (v) => bookmarkTopPanel?.classList.toggle('hidden', !v);
    const setNavigationTopPanelVisible  = (v) => navigationTopPanel?.classList.toggle('hidden', !v);
    const setBookmarkEditorVisible      = (v) => bookmarkEditorOverlay?.classList.toggle('hidden', !v);

    const setYouTubeAddonVisible = (visible) => {
        if (!youtubeAddonPanel) return;
        youtubeAddonPanel.classList.toggle('hidden', !visible);
    };

    const setDuckAiPanelVisible = (visible) => duckAiPanel?.classList.toggle('hidden', !visible);

    const setFeatureTileAvailability = (button, enabled, activeLabel, inactiveLabel) => {
        if (!button) return;
        const label = enabled ? activeLabel : inactiveLabel;
        button.title              = label;
        button.dataset.tooltip    = label;
        button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    };

    // ── YOUTUBE / DUCKAI SETTINGS ─────────────────────────────────────────────
    const getYouTubeAddonSettings = (settings = cachedSettings) => {
        const yt = settings?.youtubeAddon || {};
        return {
            enabled:              yt.enabled === true,
            cleanUi:              yt.cleanUi === true,
            blurThumbnails:       yt.blurThumbnails === true,
            hideChats:            yt.hideChats === true,
            blackAndWhiteMode:    yt.blackAndWhiteMode === true,
            adSkipper:            yt.adSkipper === true,
            hideAddonIcon:        yt.hideAddonIcon === true
        };
    };

    const getDuckAiChatSettings = (settings = cachedSettings) => ({
        hideSidebar: settings?.aiChat?.duckAiHideSidebar === true
    });

    const canShowYouTubeAddon = () => {
        const yt = getYouTubeAddonSettings(cachedSettings);
        return yt.enabled && isYouTubeUrl(getActiveTabUrl());
    };

    const canShowDuckAiPanel = () => isDuckAiChatUrl(getActiveTabUrl());

    const canShowPageInfoPanel = () => {
        const t = getActiveTabState();
        return !!t && !(t.isSystemPage || t.isTextStudio || t.isHistoryPage || t.isGamesPage
            || t.isDefensePage || t.isHomePage || t.isTodoPage || t.isScraberPage || t.isServerOperatorPage);
    };

    // Debounced to prevent repeated reflows when tab navigation fires rapidly.
    const syncSiteToolQuickLaunchButtons = debounce(() => {
        setFeatureTileAvailability(quickPanelYoutubeAddon, canShowYouTubeAddon(), 'YouTube Addon', 'Open YouTube to use');
        setFeatureTileAvailability(quickPanelDuckAi,       canShowDuckAiPanel(),  'Duck AI',       'Open Duck AI chat to use');
        setFeatureTileAvailability(quickPanelPageInfo,     canShowPageInfoPanel(),'Page Info',     'Unavailable on Om-X panels');
    }, 16);

    const syncNavigationTopPanelButtons = () => {
        const wv = tabManager?.getActiveWebview?.();
        let canGoBack = false, canGoForward = false;
        try { canGoBack = !!wv?.canGoBack?.(); canGoForward = !!wv?.canGoForward?.(); } catch (_) {}
        if (btnTopNavBack)    btnTopNavBack.disabled    = !canGoBack;
        if (btnTopNavForward) btnTopNavForward.disabled = !canGoForward;
    };

    const syncYouTubeAddonPanel = () => {
        if (!youtubeAddonPanel) return;
        const yt = getYouTubeAddonSettings(cachedSettings);
        if (!(yt.enabled && isYouTubeUrl(getActiveTabUrl()))) {
            youtubeAddonPanel.classList.add('hidden');
        }
        if (youtubeAddonToggleHome)     youtubeAddonToggleHome.checked      = !!yt.cleanUi;
        if (youtubeAddonToggleBlur)     youtubeAddonToggleBlur.checked      = !!yt.blurThumbnails;
        if (youtubeAddonToggleChat)     youtubeAddonToggleChat.checked      = !!yt.hideChats;
        if (youtubeAddonToggleBw)       youtubeAddonToggleBw.checked        = !!yt.blackAndWhiteMode;
        if (youtubeAddonToggleAdSkipper) youtubeAddonToggleAdSkipper.checked = !!yt.adSkipper;
    };

    const syncDuckAiPanel = () => {
        if (!duckAiPanel) return;
        if (!canShowDuckAiPanel()) duckAiPanel.classList.add('hidden');
        if (duckAiToggleSidebar) duckAiToggleSidebar.checked = !!getDuckAiChatSettings(cachedSettings).hideSidebar;
    };

    // ── NAVIGATION TOP PANEL ──────────────────────────────────────────────────
    const handleNavigationTopAction = (action) => {
        const wv = tabManager?.getActiveWebview?.();
        if (!wv) return;
        try {
            if (action === 'back'    && wv.canGoBack())    wv.goBack();
            else if (action === 'forward' && wv.canGoForward()) wv.goForward();
        } catch (error) {
            console.warn('[Navigation Top Panel] Failed to run action:', action, error);
        }
        window.setTimeout(syncNavigationTopPanelButtons, 160);
    };

    const toggleNavigationTopPanel = () => {
        hideFeaturesHomePopup();
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        const isHidden = navigationTopPanel?.classList.contains('hidden');
        setNavigationTopPanelVisible(isHidden);
        if (isHidden) syncNavigationTopPanelButtons();
    };

    const toggleYouTubeAddonPanel = () => {
        if (!canShowYouTubeAddon()) return;
        setNavigationTopPanelVisible(false);
        setDuckAiPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        setYouTubeAddonVisible(youtubeAddonPanel?.classList.contains('hidden'));
    };

    const toggleDuckAiPanel = () => {
        if (!canShowDuckAiPanel()) return;
        setNavigationTopPanelVisible(false);
        setYouTubeAddonVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        setDuckAiPanelVisible(duckAiPanel?.classList.contains('hidden'));
    };

    // ── BOOKMARKS ─────────────────────────────────────────────────────────────
    const updateBookmarkEditorPreview = () => {
        const previewName = String(bookmarkEditorName?.value || '').trim() || 'New Bookmark';
        const previewIcon = sanitizeBookmarkIcon(bookmarkEditorIcon?.value || BOOKMARK_FALLBACK_ICON);
        if (bookmarkEditorPreviewName) bookmarkEditorPreviewName.textContent = previewName;
        if (bookmarkEditorPreviewIcon) bookmarkEditorPreviewIcon.src = previewIcon;
    };

    // Uses DocumentFragment → single DOM reflow instead of one per bookmark.
    const renderBookmarkRows = () => {
        if (!bookmarkTopList) return;
        if (!bookmarkItems.length) {
            bookmarkTopList.innerHTML = '<div class="bookmark-top-empty"></div>';
            return;
        }

        const frag = document.createDocumentFragment();
        for (const bookmark of bookmarkItems) {
            const row = document.createElement('button');
            row.type      = 'button';
            row.className = 'bookmark-top-row';
            row.title     = String(bookmark.url || '');

            const icon = document.createElement('img');
            icon.className      = 'bookmark-top-row-icon';
            icon.src            = sanitizeBookmarkIcon(bookmark.favicon);
            icon.alt            = '';
            icon.referrerPolicy = 'no-referrer';
            icon.addEventListener('error', () => { icon.src = BOOKMARK_FALLBACK_ICON; }, { once: true });

            const copy = document.createElement('div');
            copy.className = 'bookmark-top-row-copy';
            copy.innerHTML = `<div class="bookmark-top-row-title">${escapeHtml(bookmark.title || 'Untitled')}</div>`;

            const deleteBtn = document.createElement('button');
            deleteBtn.type      = 'button';
            deleteBtn.className = 'bookmark-top-delete';
            deleteBtn.textContent = 'x';
            deleteBtn.title     = 'Remove bookmark';
            deleteBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                try {
                    bookmarkItems = await window.browserAPI.bookmarks.delete(bookmark.id);
                    renderBookmarkRows();
                } catch (error) {
                    console.error('[Bookmarks] Failed to delete bookmark', error);
                }
            });

            row.appendChild(icon);
            row.appendChild(copy);
            row.appendChild(deleteBtn);
            row.addEventListener('click', () => {
                openAppTab(String(bookmark.url || ''));
                setBookmarkPanelVisible(false);
            });
            frag.appendChild(row);
        }
        bookmarkTopList.innerHTML = '';
        bookmarkTopList.appendChild(frag);
    };

    const refreshBookmarks = async () => {
        if (!window.browserAPI?.bookmarks?.get) return;
        try {
            const bookmarks = await window.browserAPI.bookmarks.get();
            bookmarkItems   = Array.isArray(bookmarks) ? bookmarks.filter(e => e?.url) : [];
            renderBookmarkRows();
        } catch (error) {
            console.error('[Bookmarks] Failed to load bookmarks', error);
        }
    };

    const refreshBookmarkDraft = (tab = getActiveTabState()) => tab;   // hook point – returns tab for callers

    const openBookmarkEditor = (tab = getActiveTabState()) => {
        if (!tab?.url) return;
        pendingBookmarkTab = tab;
        if (bookmarkEditorName) bookmarkEditorName.value = String(tab.titleEl?.textContent || tab.url).trim() || tab.url;
        if (bookmarkEditorIcon) bookmarkEditorIcon.value = sanitizeBookmarkIcon(tab.iconEl?.src || BOOKMARK_FALLBACK_ICON);
        updateBookmarkEditorPreview();
        setBookmarkEditorVisible(true);
        bookmarkEditorName?.focus();
        bookmarkEditorName?.select();
    };

    const saveCurrentTabAsBookmark = async (tab = getActiveTabState()) => {
        if (!tab?.url || !window.browserAPI?.bookmarks?.add) return;
        try {
            bookmarkItems = await window.browserAPI.bookmarks.add({
                url:     tab.url,
                title:   String(bookmarkEditorName?.value || tab.titleEl?.textContent || tab.url).trim() || tab.url,
                favicon: sanitizeBookmarkIcon(bookmarkEditorIcon?.value || tab.iconEl?.src || BOOKMARK_FALLBACK_ICON)
            });
            renderBookmarkRows();
            refreshBookmarkDraft(tab);
            setBookmarkEditorVisible(false);
            pendingBookmarkTab = null;
        } catch (error) {
            console.error('[Bookmarks] Failed to save bookmark', error);
        }
    };

    const openBookmarkPanel = async (tab = getActiveTabState()) => {
        hideFeaturesHomePopup();
        setNavigationTopPanelVisible(false);
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        refreshBookmarkDraft(tab);
        await refreshBookmarks();
        setBookmarkPanelVisible(true);
    };

    // ── YOUTUBE ADDON ─────────────────────────────────────────────────────────
    const reloadActiveYouTubeWatchPage = () => {
        const wv = tabManager?.getActiveWebview?.();
        if (!wv || !isYouTubeWatchUrl(getActiveTabUrl())) return;
        try { wv.reload(); } catch (error) { console.warn('[YouTube Addon] Failed to reload watch page:', error); }
    };

    const persistYouTubeAddonPreferences = async (partialYoutubeAddon = {}, options = {}) => {
        if (_ytSavePending) return;
        _ytSavePending = true;
        try {
            if (!cachedSettings) cachedSettings = await window.browserAPI.settings.get();
            const prev = getYouTubeAddonSettings(cachedSettings);
            const next = { ...(cachedSettings?.youtubeAddon || {}), ...partialYoutubeAddon };
            const shouldReload = options.reloadOnEnable === true
                && prev.cleanUi !== true && next.cleanUi === true
                && isYouTubeWatchUrl(getActiveTabUrl());
            const nextSettings = { ...(cachedSettings || {}), youtubeAddon: next };
            cachedSettings = nextSettings;
            syncYouTubeAddonPanel();
            tabManager?.updateSettings?.(nextSettings);
            const success = await window.browserAPI.settings.save(nextSettings);
            if (!success) console.warn('[YouTube Addon] Failed to save settings.');
            if (success && shouldReload) window.setTimeout(reloadActiveYouTubeWatchPage, 0);
        } catch (e) {
            console.warn('[YouTube Addon] Save error:', e);
        } finally {
            _ytSavePending = false;
        }
    };

    const persistDuckAiPreferences = async (partialAiChat = {}) => {
        if (_duckSavePending) return;
        _duckSavePending = true;
        try {
            if (!cachedSettings) cachedSettings = await window.browserAPI.settings.get();
            const nextSettings = { ...(cachedSettings || {}), aiChat: { ...(cachedSettings?.aiChat || {}), ...partialAiChat } };
            cachedSettings = nextSettings;
            syncDuckAiPanel();
            tabManager?.updateSettings?.(nextSettings);
            const success = await window.browserAPI.settings.save(nextSettings);
            if (!success) console.warn('[Duck AI Panel] Failed to save settings.');
        } catch (e) {
            console.warn('[Duck AI Panel] Save error:', e);
        } finally {
            _duckSavePending = false;
        }
    };

    const setupYouTubeAddonEvents = () => {
        if (!youtubeAddonPanel || youtubeAddonPanel.dataset.bound === '1') return;
        youtubeAddonPanel.dataset.bound = '1';

        youtubeAddonToggleHome?.addEventListener('change',      () => persistYouTubeAddonPreferences({ cleanUi: youtubeAddonToggleHome.checked }));
        youtubeAddonToggleBlur?.addEventListener('change',      () => persistYouTubeAddonPreferences({ blurThumbnails: youtubeAddonToggleBlur.checked }));
        youtubeAddonToggleChat?.addEventListener('change',      () => persistYouTubeAddonPreferences({ hideChats: youtubeAddonToggleChat.checked }));
        youtubeAddonToggleBw?.addEventListener('change',        () => persistYouTubeAddonPreferences({ blackAndWhiteMode: youtubeAddonToggleBw.checked }));
        youtubeAddonToggleAdSkipper?.addEventListener('change',  () => persistYouTubeAddonPreferences({ adSkipper: youtubeAddonToggleAdSkipper.checked }));
    };

    const setupDuckAiPanelEvents = () => {
        if (!duckAiPanel || duckAiPanel.dataset.bound === '1') return;
        duckAiPanel.dataset.bound = '1';
        duckAiToggleSidebar?.addEventListener('change', () => persistDuckAiPreferences({ duckAiHideSidebar: duckAiToggleSidebar.checked }));
    };

    // ── SETTINGS ──────────────────────────────────────────────────────────────
    // Guards against parallel invocations that could cause double-apply.
    const loadSettings = async (injectedSettings = null) => {
        if (_settingsLoading) return;
        _settingsLoading = true;
        try {
            cachedSettings = injectedSettings || await window.browserAPI.settings.get();
            if (cachedSettings) {
                applyTheme(cachedSettings.theme);
                screenshotDelaySeconds = cachedSettings.screenshot?.delaySeconds ?? 0;
                updateDelayLabel(screenshotDelaySeconds);
                syncYouTubeAddonPanel();
                syncDuckAiPanel();
                syncSiteToolQuickLaunchButtons();
                tabManager?.updateSettings?.(cachedSettings);
            }
        } catch (e) {
            syncYouTubeAddonPanel();
            syncDuckAiPanel();
            syncSiteToolQuickLaunchButtons();
            console.warn('Settings failed in renderer', e);
        } finally {
            _settingsLoading = false;
        }
    };

    // ── SCREENSHOT ─────────────────────────────────────────────────────────────
    const updateDelayLabel = (seconds) => {
        if (!delayLabel) return;
        delayLabel.textContent = (!seconds || seconds <= 0) ? 'No delay' : `${seconds}s delay`;
    };

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

    const captureActiveWebview = (onCaptureOverride = null, overlayOptions = {}) => {
        const webview = tabManager.getActiveWebview();
        if (!webview) return;
        const rect = webview.getBoundingClientRect();
        const captureBounds = {
            left:   Math.round(rect.left),
            top:    Math.round(rect.top),
            width:  Math.round(rect.width),
            height: Math.round(rect.height)
        };
        const captureFn = () => webview.capturePage();
        if (screenshotDelaySeconds > 0) {
            screenshotOverlay.startDelayCapture(screenshotDelaySeconds, captureFn, onCaptureOverride, { ...overlayOptions, captureBounds });
        } else {
            captureFn()
                .then(img => screenshotOverlay.start(img, onCaptureOverride, { ...overlayOptions, captureBounds }))
                .catch(err => {
                    console.error('[Screenshot] Capture failed:', err);
                    screenshotOverlay.showToast('Failed to capture screenshot');
                });
        }
    };

    // ── LENS SEARCH ────────────────────────────────────────────────────────────
    const openLensSearchForImage = (dataUrl) => {
        if (!dataUrl) return;
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lens Search</title></head><body>
<form id="lens-form" action="https://lens.google.com/upload" method="POST" enctype="multipart/form-data">
  <input id="lens-file" type="file" name="encoded_image">
  <input type="hidden" name="image_url" value="">
</form>
<script>
(async () => {
  const dataUrl = ${JSON.stringify(dataUrl)};
  const res  = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], 'omx-capture.png', { type: blob.type || 'image/png' });
  const dt   = new DataTransfer();
  dt.items.add(file);
  document.getElementById('lens-file').files = dt.files;
  document.getElementById('lens-form').submit();
})();
<\/script>
</body></html>`;
        tabManager.createTab(`data:text/html;base64,${btoa(html)}`);
    };

    // ── IMAGE DOWNLOAD ─────────────────────────────────────────────────────────
    const openImageDownloadOptions = (src) => {
        currentImageToDownload = src;
        if (imageDlPreview) imageDlPreview.src = src;
        imageDlOverlay?.classList.remove('hidden');
    };

    const loadJsPdfCtor = async () => {
        if (window?.jspdf?.jsPDF) return window.jspdf.jsPDF;
        try {
            const mod  = await import('jspdf');
            const ctor = mod?.jsPDF || mod?.default?.jsPDF || mod?.default || null;
            if (ctor) return ctor;
        } catch (_) {}

        const loadKey = '__omxImageDownloadJsPdfPromise';
        if (!window[loadKey]) {
            window[loadKey] = new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-omx-image-jspdf="1"]');
                if (existing) {
                    if (window?.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
                    existing.addEventListener('load',  () => resolve(window?.jspdf?.jsPDF || null), { once: true });
                    existing.addEventListener('error', () => reject(new Error('Failed to load local jsPDF UMD.')), { once: true });
                    return;
                }
                const script = document.createElement('script');
                script.src   = new URL('../../node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url).href;
                script.async = true;
                script.dataset.omxImageJspdf = '1';
                script.onload  = () => resolve(window?.jspdf?.jsPDF || null);
                script.onerror = () => reject(new Error('Failed to load local jsPDF UMD.'));
                document.head.appendChild(script);
            });
        }
        const ctor = await window[loadKey];
        if (!ctor) throw new Error('Unable to load jsPDF module.');
        return ctor;
    };

    const loadImageForDownload = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload  = () => resolve(img);
        img.onerror = () => reject(new Error('Image failed to load for download export.'));
        img.src     = src;
    });

    const drawImageToCanvas = (img, background = null) => {
        const width  = img.naturalWidth  || img.width;
        const height = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable.');
        if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(img, 0, 0, width, height);
        return canvas;
    };

    const createFittedImagePdf = (jsPDFCtor, canvas) => {
        const pdf       = new jsPDFCtor({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin    = 18;
        const availW    = Math.max(1, pageWidth  - margin * 2);
        const availH    = Math.max(1, pageHeight - margin * 2);
        const scale     = Math.min(availW / canvas.width, availH / canvas.height, 1);
        const drawW     = Math.max(1, Math.round(canvas.width  * scale));
        const drawH     = Math.max(1, Math.round(canvas.height * scale));
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG',
            (pageWidth  - drawW) / 2, (pageHeight - drawH) / 2, drawW, drawH);
        return pdf;
    };

    if (btnImageDlCancel) btnImageDlCancel.onclick = () => imageDlOverlay.classList.add('hidden');

    dlFormatBtns.forEach(btn => {
        btn.onclick = async () => {
            const format = btn.dataset.format;
            const src    = currentImageToDownload;
            if (!src) return;
            imageDlOverlay.classList.add('hidden');
            try {
                if (format === 'pdf') {
                    const [img, jsPDFCtor] = await Promise.all([loadImageForDownload(src), loadJsPdfCtor()]);
                    const canvas   = drawImageToCanvas(img, '#ffffff');
                    const pdf      = createFittedImagePdf(jsPDFCtor, canvas);
                    const pdfDataUrl = pdf.output('datauristring');
                    await window.browserAPI.downloads.start(pdfDataUrl, { saveAs: true, filename: 'image.pdf' });
                } else {
                    const img    = await loadImageForDownload(src);
                    const canvas = drawImageToCanvas(img);
                    const normalizedFormat = format === 'jpg' ? 'jpeg' : format;
                    const dataUrl = canvas.toDataURL(`image/${normalizedFormat}`, 0.9);
                    await window.browserAPI.downloads.start(dataUrl, { saveAs: true, filename: `image.${format}` });
                }
            } catch (e) {
                console.error('[Image Download] Export failed:', e);
                if (format !== 'pdf') await window.browserAPI.downloads.start(src, { saveAs: true });
            }
        };
    });

    // ── FILE HANDLING ──────────────────────────────────────────────────────────
    // resolveOpenedFileTarget used to branch on extension but always returned
    // filePath – simplified to a direct pass-through.
    const resolveOpenedFileTarget = (filePath = '') => filePath;

    // ── SIDEBAR NAVIGATION ────────────────────────────────────────────────────
    const handleSidebarHomeAction = () => {
        const willShowFeatures = featuresHomePopup?.classList.contains('hidden') ?? false;
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        featuresHomePopup?.classList.toggle('hidden', !willShowFeatures);
    };

    const bindSidebarNavigation = () => {
        const bindClick = (element, handler) => {
            if (!element || element.dataset.omxBound === '1') return;
            element.dataset.omxBound = '1';
            element.addEventListener('click', handler);
        };
        bindClick(btnNavHome,                             () => handleSidebarHomeAction());
        bindClick(document.getElementById('btn-nav-history'),  () => { hideFeaturesHomePopup(); openAppTab(HISTORY_URL);   });
        bindClick(document.getElementById('btn-nav-settings'), () => { hideFeaturesHomePopup(); openAppTab(SETTINGS_URL);  });
        bindClick(document.getElementById('btn-nav-ai-chat'),  async () => { hideFeaturesHomePopup(); openAppTab(await getAiChatTargetUrl()); });
        bindClick(document.getElementById('btn-nav-downloads'),() => { hideFeaturesHomePopup(); openAppTab(DOWNLOADS_URL); });
        bindClick(btnNavNewTab,                           () => searchSystem.handleNewTabRequest());
    };

    // ── DOWNLOADS TOAST ────────────────────────────────────────────────────────
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

    if (window.browserAPI.downloads?.onUpdate) {
        window.browserAPI.downloads.onUpdate((item) => {
            if (!downloadToast) return;
            const state         = String(item?.state || '').toLowerCase();
            const isActiveState = ['progressing', 'paused', 'scanning', 'pending'].includes(state);
            const isTerminalState = ['completed', 'interrupted', 'cancelled', 'blocked'].includes(state);

            if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
            downloadToast.classList.remove('hidden');
            if (dlFilename) dlFilename.textContent = item.filename || 'Download';

            if (dlCancelBtn) {
                const showCancel = isActiveState && item?.id;
                activeToastDownloadId = showCancel ? item.id : null;
                dlCancelBtn.disabled = !showCancel;
                dlCancelBtn.classList.toggle('hidden', !showCancel);
            }

            if (state === 'progressing' || state === 'paused') {
                const percent = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0;
                if (dlStatus) dlStatus.textContent = state === 'progressing' ? `${percent}% - Downloading` : `Paused - ${percent}%`;
                if (dlFill)   dlFill.style.width   = `${percent}%`;
            } else if (state === 'scanning') {
                if (dlStatus) dlStatus.textContent = item.reason ? `Security scan - ${item.reason}` : 'Security scan in progress';
            } else if (state === 'completed') {
                if (dlStatus) dlStatus.textContent = 'Download Complete';
                if (dlFill)   dlFill.style.width   = '100%';
                toastTimeout = setTimeout(() => downloadToast.classList.add('hidden'), 3000);
            } else if (state === 'interrupted' || state === 'cancelled') {
                if (dlStatus) dlStatus.textContent = state === 'cancelled' ? 'Download Cancelled' : 'Download Failed';
                if (dlFill)   dlFill.style.width   = '100%';
                toastTimeout = setTimeout(() => downloadToast.classList.add('hidden'), 3000);
            } else if (state === 'blocked') {
                if (dlStatus) dlStatus.textContent = item.reason ? `Blocked - ${item.reason}` : 'Blocked by security checks';
                if (dlFill)   dlFill.style.width   = '100%';
                toastTimeout = setTimeout(() => downloadToast.classList.add('hidden'), 3500);
            } else if (state === 'pending') {
                if (dlStatus) dlStatus.textContent = item.reason ? `Pending - ${item.reason}` : 'Pending...';
                if (dlFill)   dlFill.style.width   = '0%';
            } else {
                if (dlStatus) dlStatus.textContent = 'Pending...';
                if (!isTerminalState && dlFill && !isActiveState) dlFill.style.width = '0%';
            }

            if (isTerminalState) {
                activeToastDownloadId = null;
                if (dlCancelBtn) { dlCancelBtn.disabled = true; dlCancelBtn.classList.add('hidden'); }
            }
        });
    }

    // ── UI COMPONENT INIT ──────────────────────────────────────────────────────
    let sidePanel = null;
    try { sidePanel = new SidePanel(); } catch (error) { console.error('[Renderer] Failed to initialize SidePanel', error); }

    let translatorUI   = null;
    let writerUI       = null;
    let screenshotOverlay = null;

    tabManager = new TabManager(
        'tab-list-container', 'webview-container',
        (url) => {
            const controls = document.querySelector('.window-controls');
            const isHome   = url === HOME_URL || url?.includes('pages/home.html');
            controls?.classList.toggle('hidden', !isHome);
            primeSiteSafetyScan(url);
            syncYouTubeAddonPanel();
            syncDuckAiPanel();
            syncSiteToolQuickLaunchButtons();
        },
        handleWebviewContextMenu,
        handleTabContextMenu,
        (tabId) => darkModeTabs.delete(tabId)   // cleanup on close
    );
    tabManager.createTab();

    if (cachedSettings) {
        tabManager.updateSettings?.(cachedSettings);
        syncYouTubeAddonPanel();
        syncDuckAiPanel();
        syncSiteToolQuickLaunchButtons();
    }

    try { translatorUI    = new TranslatorUI(tabManager);   } catch (e) { console.error('[Renderer] Failed to initialize TranslatorUI', e); }
    try { writerUI        = new WriterUI(tabManager);        } catch (e) { console.error('[Renderer] Failed to initialize WriterUI', e); }
    try {
        screenshotOverlay = new ScreenshotOverlay(
            async (url) => window.browserAPI.downloads.start(url, { saveAs: true })
        );
    } catch (e) { console.error('[Renderer] Failed to initialize ScreenshotOverlay', e); }

    // ── SCREENSHOT DELAY UI ────────────────────────────────────────────────────
    if (btnDelay && delayDropdown) {
        btnDelay.addEventListener('click', (e) => { e.stopPropagation(); delayDropdown.classList.toggle('hidden'); });
        delayOptions.forEach(opt => {
            opt.addEventListener('click', async (e) => {
                e.preventDefault();
                await setScreenshotDelay(Number(opt.dataset.delay || 0));
                delayDropdown.classList.add('hidden');
            });
        });
        document.addEventListener('mousedown', (e) => {
            if (!delayDropdown.classList.contains('hidden')
                && !delayDropdown.contains(e.target) && !btnDelay.contains(e.target)) {
                delayDropdown.classList.add('hidden');
            }
        });
    }

    if (btnLens) {
        btnLens.addEventListener('click', (e) => {
            e.preventDefault();
            const existing = screenshotOverlay.getCurrentDataUrl();
            if (existing) { openLensSearchForImage(existing); screenshotOverlay.hide(); return; }
            const webview = tabManager.getActiveWebview();
            if (!webview) return;
            webview.capturePage()
                .then(img  => screenshotOverlay.start(img, openLensSearchForImage, { lensMode: true }))
                .catch(err => { console.error('[Lens Search] Capture failed:', err); screenshotOverlay.showToast('Failed to capture screenshot'); });
        });
    }

    // ── SEARCH SYSTEM ──────────────────────────────────────────────────────────
    const searchSystem = initSearchSystem({ tabManager, settingsAPI: window.browserAPI.settings, HOME_URL });

    bindSidebarNavigation();

    // ── TAB CONTEXT MENU BUTTONS ───────────────────────────────────────────────
    const ctxBookmarkTab = document.getElementById('ctx-bookmark-tab');
    const ctxCopyUrl     = document.getElementById('ctx-copy-url');
    const ctxDarkMode    = document.getElementById('ctx-dark-mode');

    if (ctxBookmarkTab) ctxBookmarkTab.onclick = () => {
        const tab = tabManager.tabs.find(t => t.id === currentTabContextId);
        if (tab) openBookmarkEditor(tab);
        closeAllContextMenus();
    };
    if (ctxCopyUrl) ctxCopyUrl.onclick = () => {
        const tab = tabManager.tabs.find(t => t.id === currentTabContextId);
        if (tab) navigator.clipboard.writeText(tab.url);
        closeAllContextMenus();
    };
    if (ctxDarkMode) ctxDarkMode.onclick = () => {
        const tabId = currentTabContextId;
        closeAllContextMenus();
        if (tabId) toggleDarkModeForTab(tabId);
    };

    // ── QUICK-PANEL BUTTONS ────────────────────────────────────────────────────
    if (quickPanelBookmarks)    quickPanelBookmarks.onclick    = () => openBookmarkPanel();
    if (quickPanelNavigation)   quickPanelNavigation.onclick   = () => toggleNavigationTopPanel();
    if (quickPanelPageInfo)     quickPanelPageInfo.onclick     = () => { if (canShowPageInfoPanel()) openSiteInfoPopup(); };
    if (quickPanelYoutubeAddon) quickPanelYoutubeAddon.onclick = () => { if (canShowYouTubeAddon()) { hideFeaturesHomePopup(); toggleYouTubeAddonPanel(); } };
    if (quickPanelDuckAi)       quickPanelDuckAi.onclick       = () => { if (canShowDuckAiPanel())  { hideFeaturesHomePopup(); toggleDuckAiPanel();       } };
    if (quickPanelScraper)      quickPanelScraper.onclick      = () => { hideFeaturesHomePopup(); tabManager.createTab(SCRABER_URL); };
    if (quickPanelTodoStation)  quickPanelTodoStation.onclick  = () => { hideFeaturesHomePopup(); openAppTab(TODO_STATION_URL); };
    if (quickPanelGames)        quickPanelGames.onclick        = () => { hideFeaturesHomePopup(); openAppTab(GAMES_URL); };
    if (quickPanelLlamaServer)  quickPanelLlamaServer.onclick  = () => { hideFeaturesHomePopup(); openAppTab(`${SERVER_OPERATOR_URL}?panel=llama`); };
    if (quickPanelMcpServer)    quickPanelMcpServer.onclick    = () => { hideFeaturesHomePopup(); openAppTab(`${SERVER_OPERATOR_URL}?panel=mcp`); };
    if (quickPanelDiscord)      quickPanelDiscord.onclick      = () => launchOmChat();

    btnTopNavBack?.addEventListener('click',    () => handleNavigationTopAction('back'));
    btnTopNavForward?.addEventListener('click', () => handleNavigationTopAction('forward'));

    // ── BOOKMARK EDITOR BINDINGS ───────────────────────────────────────────────
    bookmarkEditorCancel?.addEventListener('click', () => { setBookmarkEditorVisible(false); pendingBookmarkTab = null; });
    bookmarkEditorOverlay?.addEventListener('mousedown', (event) => {
        if (event.target === bookmarkEditorOverlay) { setBookmarkEditorVisible(false); pendingBookmarkTab = null; }
    });
    bookmarkEditorName?.addEventListener('input',   updateBookmarkEditorPreview);
    bookmarkEditorIcon?.addEventListener('input',   updateBookmarkEditorPreview);
    const _saveOnEnter = (event) => {
        if (event.key === 'Enter' && pendingBookmarkTab) { event.preventDefault(); saveCurrentTabAsBookmark(pendingBookmarkTab); }
    };
    bookmarkEditorName?.addEventListener('keydown', _saveOnEnter);
    bookmarkEditorIcon?.addEventListener('keydown', _saveOnEnter);
    bookmarkEditorSave?.addEventListener('click',   () => { if (pendingBookmarkTab) saveCurrentTabAsBookmark(pendingBookmarkTab); });

    // ── MERGED KEYDOWN HANDLER ────────────────────────────────────────────────
    // Previously 4 separate keydown listeners; merged into one delegation pass.
    document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        const alt  = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
        const key  = e.key.toLowerCase();

        // Ctrl+Shift+[ → hide sidebar
        if (ctrl && e.shiftKey && e.key === '[') {
            e.preventDefault();
            sidePanel.toggleHidden();
            return;
        }

        // Escape → close all overlays
        if (e.key === 'Escape') {
            if (searchSystem.isVisible()) searchSystem.hide();
            hideFeaturesHomePopup();
            setNavigationTopPanelVisible(false);
            setBookmarkPanelVisible(false);
            setBookmarkEditorVisible(false);
            if (imageDlOverlay) imageDlOverlay.classList.add('hidden');
            setYouTubeAddonVisible(false);
            setDuckAiPanelVisible(false);
            hideSiteInfoPopup();
            if (translatorUI) translatorUI.hide();
            if (writerUI)     writerUI.hide();
            closeAllContextMenus();
            return;
        }

        if (alt) {
            if (isEditableTarget(e.target)) return;
            const screenshotLayerActive = document.getElementById('screenshot-layer')?.classList.contains('active');
            if (screenshotLayerActive) return;
            if (key === 'i') { e.preventDefault(); captureActiveWebview(openLensSearchForImage, { lensMode: true }); }
            else if (key === 'g') { e.preventDefault(); openSiteInfoPopup(); }
        }
    });

    // ── EVENT LISTENERS ────────────────────────────────────────────────────────
    document.addEventListener('mousedown', (e) => {
        const targetTag     = String(e?.target?.tagName || '').toUpperCase();
        const clickedWebview = targetTag === 'WEBVIEW';

        if (featuresHomePopup && !featuresHomePopup.classList.contains('hidden')) {
            if (!featuresHomePopup.contains(e.target) && !btnNavHome?.contains?.(e.target)) hideFeaturesHomePopup();
        }
        if (navigationTopPanel && !navigationTopPanel.classList.contains('hidden')) {
            if (!navigationTopPanel.contains(e.target) && !quickPanelNavigation?.contains?.(e.target)) setNavigationTopPanelVisible(false);
        }
        if (bookmarkTopPanel && !bookmarkTopPanel.classList.contains('hidden')) {
            if (!bookmarkTopPanel.contains(e.target) && !quickPanelBookmarks?.contains?.(e.target)) setBookmarkPanelVisible(false);
        }
        if (youtubeAddonPanel && !youtubeAddonPanel.classList.contains('hidden')) {
            if (!youtubeAddonPanel.contains(e.target) && !btnNavHome?.contains?.(e.target) && !clickedWebview) setYouTubeAddonVisible(false);
        }
        if (duckAiPanel && !duckAiPanel.classList.contains('hidden')) {
            if (!duckAiPanel.contains(e.target) && !btnNavHome?.contains?.(e.target)) setDuckAiPanelVisible(false);
        }
        if (siteInfoOverlay && !siteInfoOverlay.classList.contains('hidden')) {
            if (!siteInfoOverlay.contains(e.target)) hideSiteInfoPopup();
        }
    });

    document.addEventListener('mousedown', (e) => {
        const submenuMenus = Array.from(document.querySelectorAll('.context-menu-submenu'));
        const insideKnownMenu = [
            webviewContextMenu, tabContextMenu, sidePanelContextMenu, hiddenSidebarContextMenu, ...submenuMenus
        ].some(menu => menu?.contains?.(e.target));
        if (!insideKnownMenu) closeAllContextMenus();
    }, true);

    window.addEventListener('contextmenu', () => closeAllContextMenus(), true);
    window.addEventListener('contextmenu', (e) => {
        if (sidePanel.getState().isHidden) { e.preventDefault(); handleHiddenSidebarContextMenu(e.clientX, e.clientY); }
    });
    window.addEventListener('blur', closeAllContextMenus);
    window.closeAllContextMenus = closeAllContextMenus;

    window.addEventListener('omx-show-search-overlay', () => {
        hideFeaturesHomePopup();
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        searchSystem.show();
    });

    if (window.browserAPI.onShortcut) {
        window.browserAPI.onShortcut((command) => {
            if      (command === 'new-tab')        { hideFeaturesHomePopup(); searchSystem.handleNewTabRequest(); }
            else if (command === 'open-scraber')   { hideFeaturesHomePopup(); tabManager.createTab(SCRABER_URL); }
            else if (command === 'close-tab')      { if (tabManager.activeTabId) tabManager.closeTab(tabManager.activeTabId); }
            else if (command === 'toggle-sidebar') { sidePanel.toggle(); }
            else if (command === 'hide-sidebar')   { sidePanel.toggleHidden(); }
            else if (command === 'toggle-system')  { hideFeaturesHomePopup(); openAppTab(SETTINGS_URL); }
            else if (command === 'take-screenshot') { captureActiveWebview(openLensSearchForImage, { lensMode: true }); }
        });
    }

    document.addEventListener('sidePanelContextMenu', (e) => handleSidePanelContextMenu(e.detail.x, e.detail.y));

    if (window.browserAPI.onOpenFile) {
        window.browserAPI.onOpenFile((filePath) => {
            tabManager.createTab(resolveOpenedFileTarget(filePath));
            if (searchSystem.isVisible()) searchSystem.hide();
        });
    }

    if (window.browserAPI.onOpenTab) {
        window.browserAPI.onOpenTab((url) => {
            if (!url) return;
            hideFeaturesHomePopup();
            tabManager.createTab(url);
            if (searchSystem.isVisible()) searchSystem.hide();
        });
    }

    window.addEventListener('tab-activated', () => {
        if (bookmarkTopPanel && !bookmarkTopPanel.classList.contains('hidden')) refreshBookmarkDraft();
        syncNavigationTopPanelButtons();
        syncYouTubeAddonPanel();
        syncDuckAiPanel();
        syncSiteToolQuickLaunchButtons();
        if (siteInfoOverlay && !siteInfoOverlay.classList.contains('hidden')) refreshSiteInfoPopup();
    });

    window.addEventListener('website-visited', (event) => {
        syncNavigationTopPanelButtons();
        primeSiteSafetyScan(event?.detail?.url || '');
    });

    if (window.browserAPI?.system?.onLanIpResolved) {
        window.browserAPI.system.onLanIpResolved((ipAddress) => {
            window.__omxLanIp = ipAddress;
            window.dispatchEvent(new CustomEvent('omx:lan-ip-resolved', { detail: { ip: ipAddress } }));
        });
    }

    // ── STARTUP ────────────────────────────────────────────────────────────────
    setupYouTubeAddonEvents();
    setupDuckAiPanelEvents();
    refreshBookmarks();
    syncSiteToolQuickLaunchButtons();
    syncNavigationTopPanelButtons();

    loadSettings().catch(e => console.warn('Initial settings load failed', e));

    if (window.browserAPI.onSettingsUpdated) {
        window.browserAPI.onSettingsUpdated(settings => loadSettings(settings));
    }
});