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
const SITE_SETTINGS_URL   = new URL('../../html/pages/site-settings.html',     import.meta.url).href;
const BOOKMARK_FALLBACK_ICON = new URL('../../assets/icons/app.ico',           import.meta.url).href;
const GOOGLE_ICON_URL     = new URL('../../assets/icons/google.svg',           import.meta.url).href;
const GOOGLE_GMAIL_ICON_URL = new URL('../../assets/icons/gmail.svg',          import.meta.url).href;
const GOOGLE_YOUTUBE_ICON_URL = new URL('../../assets/icons/youtube.svg',      import.meta.url).href;
const GOOGLE_DRIVE_ICON_URL = new URL('../../assets/icons/Google_Drive.svg',   import.meta.url).href;
const GOOGLE_MAPS_ICON_URL = new URL('../../assets/icons/google_maps.svg',     import.meta.url).href;
const GOOGLE_CALENDAR_ICON_URL = new URL('../../assets/icons/Google_Calendar.svg', import.meta.url).href;
const GOOGLE_GEMINI_ICON_URL = new URL('../../assets/icons/Google_Gemini.svg', import.meta.url).href;
const GOOGLE_PHOTOS_ICON_URL = new URL('../../assets/icons/Google_Photos.svg', import.meta.url).href;
const GOOGLE_TRANSLATE_ICON_URL = new URL('../../assets/icons/Google_Translate.svg', import.meta.url).href;
const OMCHAT_PUBLIC_DISPLAY_URL = 'https://omchat.42web.io/';
const OFFICIAL_OMX_WEBSITE = 'https://omx.kesug.com/';
const FIRST_RUN_WEBSITE_KEY = 'omx:first-run-official-website-opened:v1';
const CUSTOM_TOP_APPS_KEY = 'omx:custom-top-apps:v1';
const CUSTOM_TOP_APPS_MAX = 5;

const OM_CHAT_DEFAULT_PORT = 3031;
const DUCK_AI_URL          = 'https://duck.ai/chat';
const getUrlIdentity = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, window.location.href);
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
    } catch (_) {
        return raw.split(/[?#]/, 1)[0].trim().toLowerCase();
    }
};
const isServerOperatorAppUrl = (value = '') => getUrlIdentity(value) === getUrlIdentity(SERVER_OPERATOR_URL);
const GOOGLE_QUICK_APPS = Object.freeze([
    {
        id: 'search',
        label: 'Search',
        url: 'https://www.google.com/',
        icon: GOOGLE_ICON_URL
    },
    {
        id: 'gmail',
        label: 'Gmail',
        url: 'https://mail.google.com/',
        icon: GOOGLE_GMAIL_ICON_URL
    },
    {
        id: 'youtube',
        label: 'YouTube',
        url: 'https://www.youtube.com/',
        icon: GOOGLE_YOUTUBE_ICON_URL
    },
    {
        id: 'drive',
        label: 'Drive',
        url: 'https://drive.google.com/',
        icon: GOOGLE_DRIVE_ICON_URL
    },
    {
        id: 'maps',
        label: 'Maps',
        url: 'https://maps.google.com/',
        icon: GOOGLE_MAPS_ICON_URL
    },
    {
        id: 'calendar',
        label: 'Calendar',
        url: 'https://calendar.google.com/',
        icon: GOOGLE_CALENDAR_ICON_URL
    },
    {
        id: 'gemini',
        label: 'Gemini',
        url: 'https://gemini.google.com/',
        icon: GOOGLE_GEMINI_ICON_URL
    },
    {
        id: 'photos',
        label: 'Photos',
        url: 'https://photos.google.com/',
        icon: GOOGLE_PHOTOS_ICON_URL
    },
    {
        id: 'translate',
        label: 'Translate',
        url: 'https://translate.google.com/',
        icon: GOOGLE_TRANSLATE_ICON_URL
    }
]);

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
    const quickPanelGoogle              = document.getElementById('quick-panel-google');
    const quickPanelApps                = document.getElementById('quick-panel-apps');
    const quickPanelYoutubeAddon        = document.getElementById('quick-panel-youtube-addon');
    const quickPanelDuckAi              = document.getElementById('quick-panel-duck-ai');
    const quickPanelNavigation          = document.getElementById('quick-panel-navigation');
    const quickPanelSessionGuard        = document.getElementById('quick-panel-sessionguard');
    const quickPanelBookmarks           = document.getElementById('quick-panel-bookmarks');
    const quickPanelScraper             = document.getElementById('quick-panel-scraper');
    const quickPanelTodoStation         = document.getElementById('quick-panel-todo-station');
    const quickPanelGames               = document.getElementById('quick-panel-games');
    const quickPanelLlamaServer         = document.getElementById('quick-panel-llama-server');
    const quickPanelMcpServer           = document.getElementById('quick-panel-mcp-server');
    const quickPanelDiscord             = document.getElementById('quick-panel-discord');
    const googleAppsPanel               = document.getElementById('google-apps-panel');
    const googleAppsGrid                = document.getElementById('google-apps-grid');
    const customAppsPanel               = document.getElementById('custom-apps-panel');
    const customAppsGrid                = document.getElementById('custom-apps-grid');
    const customAppEditorOverlay        = document.getElementById('custom-app-editor-overlay');
    const customAppEditorStatus         = document.getElementById('custom-app-editor-status');
    const customAppName                 = document.getElementById('custom-app-name');
    const customAppUrl                  = document.getElementById('custom-app-url');
    const customAppEditorCancel         = document.getElementById('custom-app-editor-cancel');
    const customAppEditorSave           = document.getElementById('custom-app-editor-save');
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
    const siteNotificationStack         = document.getElementById('site-notification-stack');
    const youtubeAddonPanel             = document.getElementById('youtube-addon-panel') || document.getElementById('youtube-addon-popup');
    const youtubeAddonToggleHome        = document.getElementById('youtube-addon-toggle-home');
    const youtubeAddonToggleBlur        = document.getElementById('youtube-addon-toggle-blur');
    const youtubeAddonToggleChat        = document.getElementById('youtube-addon-toggle-chat');
    const youtubeAddonToggleBw          = document.getElementById('youtube-addon-toggle-bw');
    const youtubeAddonToggleAdSkipper   = document.getElementById('youtube-addon-toggle-adskipper');
    const duckAiPanel                   = document.getElementById('duck-ai-panel');
    const duckAiToggleSidebar           = document.getElementById('duck-ai-toggle-sidebar');
    const omchatLaunchOverlay           = document.getElementById('omchat-launch-overlay');
    const omchatLaunchClose             = document.getElementById('omchat-launch-close');
    const omchatLaunchStatus            = document.getElementById('omchat-launch-status');
    const omchatLaunchLog               = document.getElementById('omchat-launch-log');
    const openWebUiButton               = document.getElementById('btn-open-webui');
    const openWebUiOverlay              = document.getElementById('openwebui-overlay');
    const openWebUiClose                = document.getElementById('openwebui-close');
    const openWebUiStatus               = document.getElementById('openwebui-status');
    const openWebUiTimer                = document.getElementById('openwebui-timer');
    const openWebUiCommandsNote         = document.getElementById('openwebui-commands-note');
    const openWebUiCommands             = document.getElementById('openwebui-commands');
    const openWebUiLog                  = document.getElementById('openwebui-log');
    const sessionGuardOverlay           = document.getElementById('sessionguard-overlay');
    const sessionGuardIframe            = document.getElementById('sessionguard-iframe');
    const SESSIONGUARD_POPUP_URL        = new URL('../../SessionGuard/popup/popup.html', import.meta.url).href;
    const webviewContextMenu            = document.getElementById('webview-context-menu');
    const tabContextMenu                = document.getElementById('tab-context-menu');
    const ctxHideWindowControlsMenuItem = document.getElementById('ctx-hide-window-controls');
    const ctxSessionPopupsMenuItem      = document.getElementById('ctx-session-popups');
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
    let activeSiteNotifications = [];
    let screenshotDelaySeconds = 0;
    let bookmarkItems         = [];
    let pendingBookmarkTab    = null;
    const darkModeTabs        = new Set();
    let tabManager            = null;
    let omchatLogPollTimer    = null;
    let omchatLogLastCount    = 0;
    let customTopApps         = [];
    let openWebUiLogPollTimer = null;
    let openWebUiLogLastCount = 0;
    let openWebUiTerminalRenderState = {
        currentLineEl: null,
        pendingOverwrite: false,
        ansiState: {
            bold: false,
            italic: false,
            dim: false,
            fg: ''
        }
    };
    let openWebUiTimerInterval = null;
    let openWebUiTimerState    = {
        active: false,
        startedAt: 0,
        finishedAt: 0,
        etaMs: null,
        stageLabel: '',
        finalLabel: '',
        finalType: ''
    };
    let openWebUiTabId        = null;
    let openWebUiTabUrl       = '';
    let llamaWebUiTabId       = null;
    let llamaWebUiTabUrl      = '';
    let openWebUiProbeState   = { checked: false, running: false, localUrl: '' };
    const hasOpenWebUiLiveOutput = Boolean(window.browserAPI?.openWebUI?.onOutput);
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

    const secondaryTopPanelBackdrop = document.createElement('div');
    secondaryTopPanelBackdrop.id        = 'secondary-top-panel-backdrop';
    secondaryTopPanelBackdrop.className = 'secondary-top-panel-backdrop hidden';
    document.body.appendChild(secondaryTopPanelBackdrop);

    // ── SITE-INFO OVERLAY (built once) ────────────────────────────────────────
    // Previously siteInfoOverlay.innerHTML was assigned TWICE; the first
    // assignment was immediately overwritten.  Now it is written once.
    const siteInfoOverlay = document.createElement('div');
    siteInfoOverlay.id        = 'site-info-overlay';
    siteInfoOverlay.className = 'site-info-top-panel hidden';
    siteInfoOverlay.innerHTML = `
      <div id="site-info-panel" class="site-info-card">
        <div class="site-info-header chrome">
          <div class="site-info-header-main">
            <div id="site-info-host" class="site-info-host">This site</div>
            <div id="site-info-origin" class="site-info-origin"></div>
          </div>
          <div class="site-info-actions">
            <button id="site-info-open-settings" class="site-info-action" type="button" title="Open site settings">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 3h7v7"></path>
                <path d="M10 14 21 3"></path>
                <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>
              </svg>
            </button>
            <button id="site-info-close" class="site-info-action close" type="button" title="Close">&times;</button>
          </div>
        </div>
        <div id="site-info-list" class="site-info-list chrome"></div>
      </div>`;
    document.body.appendChild(siteInfoOverlay);

    // ── MP4 LINKS POPUP OVERLAY ──────────────────────────────────────────────
    const mp4LinksOverlay = document.createElement('div');
    mp4LinksOverlay.id        = 'mp4-links-overlay';
    mp4LinksOverlay.className = 'modal-overlay hidden';
    mp4LinksOverlay.innerHTML = `
      <div class="shortcut-modal" style="max-width:min(600px,calc(100vw - 40px));max-height:min(500px,70vh);display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div class="modal-title" style="margin:0;">MP4 Links Found</div>
          <button id="btn-close-mp4-links" class="modal-btn secondary" style="padding:6px 12px;">Close</button>
        </div>
        <div id="mp4-links-count" style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:8px;"></div>
        <div id="mp4-links-list" style="
            flex:1;overflow-y:auto;border-radius:10px;
            background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);
            padding:8px;min-height:100px;"></div>
        <div class="modal-actions" style="margin-top:12px;">
          <button id="btn-copy-mp4-links" class="modal-btn secondary">Copy All Links</button>
          <button id="btn-mp4-links-done" class="modal-btn primary">Done</button>
        </div>
      </div>`;
    document.body.appendChild(mp4LinksOverlay);

    const siteInfoPanel = document.getElementById('site-info-panel');
    const siteInfoHost = document.getElementById('site-info-host');
    const siteInfoOrigin = document.getElementById('site-info-origin');
    const siteInfoList  = document.getElementById('site-info-list');
    const siteInfoClose = document.getElementById('site-info-close');
    const siteInfoOpenSettings = document.getElementById('site-info-open-settings');
    const mp4LinksList  = document.getElementById('mp4-links-list');
    const mp4LinksCount = document.getElementById('mp4-links-count');
    let siteInfoRefreshToken = 0;
    let latestSiteInfoUrl = '';
    
    // MP4 Links popup handlers
    const showMp4LinksPopup = (links) => {
        if (!mp4LinksOverlay || !mp4LinksList || !mp4LinksCount) return;
        mp4LinksCount.textContent = `Found ${links.length} .mp4 link${links.length !== 1 ? 's' : ''}:`;
        
        if (links.length === 0) {
            mp4LinksList.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);">No .mp4 links found on this page.</div>';
        } else {
            const fragment = document.createDocumentFragment();
            links.forEach((link, index) => {
                const row = document.createElement('div');
                row.style.cssText = `
                    padding:8px 10px;margin-bottom:4px;border-radius:8px;
                    background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
                    font-size:11px;word-break:break-all;color:rgba(255,255,255,0.85);
                    display:flex;align-items:center;gap:8px;`;

                const indexLabel = document.createElement('span');
                indexLabel.style.cssText = 'color:rgba(255,255,255,0.3);min-width:20px;';
                indexLabel.textContent = `${index + 1}.`;

                const linkLabel = document.createElement('span');
                linkLabel.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                linkLabel.title = String(link || '');
                linkLabel.textContent = String(link || '');

                const copyButton = document.createElement('button');
                copyButton.type = 'button';
                copyButton.textContent = 'Copy';
                copyButton.style.cssText = `
                    background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);
                    color:rgba(255,255,255,0.8);padding:4px 8px;border-radius:6px;cursor:pointer;font-size:10px;`;
                copyButton.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(String(link || ''));
                        copyButton.textContent = 'Copied!';
                    } catch (_) {
                        copyButton.textContent = 'Error';
                    }
                    setTimeout(() => {
                        copyButton.textContent = 'Copy';
                    }, 1500);
                });

                row.append(indexLabel, linkLabel, copyButton);
                fragment.appendChild(row);
            });
            mp4LinksList.replaceChildren(fragment);
        }
        mp4LinksOverlay.classList.remove('hidden');
    };
    
    const hideMp4LinksPopup = () => {
        if (mp4LinksOverlay) mp4LinksOverlay.classList.add('hidden');
    };
    
    // Close handlers for MP4 links popup
    document.getElementById('btn-close-mp4-links')?.addEventListener('click', hideMp4LinksPopup);
    document.getElementById('btn-mp4-links-done')?.addEventListener('click', hideMp4LinksPopup);
    document.getElementById('btn-copy-mp4-links')?.addEventListener('click', () => {
        if (foundMp4Links.length > 0) {
            navigator.clipboard.writeText(foundMp4Links.join('\n')).then(() => {
                document.getElementById('btn-copy-mp4-links').textContent = 'Copied!';
                setTimeout(() => {
                    document.getElementById('btn-copy-mp4-links').textContent = 'Copy All Links';
                }, 1500);
            }).catch(() => {
                document.getElementById('btn-copy-mp4-links').textContent = 'Error';
                setTimeout(() => {
                    document.getElementById('btn-copy-mp4-links').textContent = 'Copy All Links';
                }, 1500);
            });
        }
    });
    mp4LinksOverlay?.addEventListener('click', (e) => {
        if (e.target === mp4LinksOverlay) hideMp4LinksPopup();
    });

    // ── HELPERS ───────────────────────────────────────────────────────────────
    const hideFeaturesHomePopup = () => featuresHomePopup?.classList.add('hidden');

    const renderGoogleAppsPanel = () => {
        if (!googleAppsGrid) return;
        googleAppsGrid.innerHTML = GOOGLE_QUICK_APPS.map((app) => `
            <button class="google-app-launch" type="button" data-url="${escapeHtml(app.url)}" data-app-id="${escapeHtml(app.id)}" title="${escapeHtml(app.label)}">
                <span class="google-app-launch-icon">
                    <img src="${escapeHtml(app.icon)}" alt="" aria-hidden="true">
                </span>
                <span class="google-app-launch-label">${escapeHtml(app.label)}</span>
            </button>
        `).join('');
    };

    const normalizeCustomAppUrl = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) ? raw : `https://${raw}`;
        try {
            const parsed = new URL(withProtocol);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch (_) {
            return '';
        }
    };

    const normalizeCustomAppName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 28);

    const getCustomAppIconUrl = (url) => {
        try {
            const parsed = new URL(String(url || ''));
            return `${parsed.origin}/favicon.ico`;
        } catch (_) {
            return '';
        }
    };

    const getCustomAppBadge = (name, url) => {
        const label = normalizeCustomAppName(name);
        if (label) return label.charAt(0).toUpperCase();
        try {
            return new URL(String(url || '')).hostname.charAt(0).toUpperCase() || '?';
        } catch (_) {
            return '?';
        }
    };

    const saveCustomTopApps = () => {
        try {
            localStorage.setItem(CUSTOM_TOP_APPS_KEY, JSON.stringify(customTopApps.slice(0, CUSTOM_TOP_APPS_MAX)));
        } catch (error) {
            console.warn('[Apps Panel] Failed to save custom apps', error);
        }
    };

    const loadCustomTopApps = () => {
        try {
            const raw = localStorage.getItem(CUSTOM_TOP_APPS_KEY);
            const parsed = JSON.parse(raw || '[]');
            customTopApps = Array.isArray(parsed)
                ? parsed
                    .map((entry, index) => {
                        const name = normalizeCustomAppName(entry?.name || entry?.label || '');
                        const url = normalizeCustomAppUrl(entry?.url || '');
                        if (!name || !url) return null;
                        return {
                            id: String(entry?.id || `app-${Date.now()}-${index}`),
                            name,
                            url
                        };
                    })
                    .filter(Boolean)
                    .slice(0, CUSTOM_TOP_APPS_MAX)
                : [];
        } catch (error) {
            console.warn('[Apps Panel] Failed to load custom apps', error);
            customTopApps = [];
        }
    };

    const setCustomAppEditorStatus = (message, type = '') => {
        if (!customAppEditorStatus) return;
        customAppEditorStatus.textContent = message;
        customAppEditorStatus.className = `custom-app-editor-status ${type}`.trim();
    };

    const renderCustomAppsPanel = () => {
        if (!customAppsGrid) return;
        const canAddMoreApps = customTopApps.length < CUSTOM_TOP_APPS_MAX;
        const tiles = customTopApps.map((app) => `
            <div class="custom-app-item" data-app-id="${escapeHtml(app.id)}">
                <button class="google-app-launch custom-app-launch" type="button" data-action="open" data-url="${escapeHtml(app.url)}" data-app-id="${escapeHtml(app.id)}" title="${escapeHtml(app.name)}">
                    <span class="google-app-launch-icon">
                        <img class="custom-app-favicon" src="${escapeHtml(getCustomAppIconUrl(app.url))}" alt="" aria-hidden="true">
                        <span class="custom-app-launch-icon-badge">${escapeHtml(getCustomAppBadge(app.name, app.url))}</span>
                    </span>
                    <span class="google-app-launch-label">${escapeHtml(app.name)}</span>
                </button>
            </div>
        `);

        if (canAddMoreApps) {
            tiles.push(`
                <button class="google-app-launch custom-app-plus" type="button" data-action="add" title="Add app">
                    <span class="google-app-launch-icon">
                        <span class="custom-app-plus-icon">+</span>
                    </span>
                    <span class="google-app-launch-label">Add App</span>
                </button>
            `);
        }

        customAppsGrid.innerHTML = tiles.join('');
        customAppsGrid.querySelectorAll('.custom-app-favicon').forEach((img) => {
            const iconWrap = img.closest('.google-app-launch-icon');
            const fallback = iconWrap?.querySelector('.custom-app-launch-icon-badge');
            const showFallback = () => {
                img.classList.add('is-hidden');
                fallback?.classList.add('is-visible');
            };
            const showFavicon = () => {
                img.classList.remove('is-hidden');
                fallback?.classList.remove('is-visible');
            };
            img.addEventListener('error', showFallback, { once: true });
            img.addEventListener('load', showFavicon, { once: true });
            if (img.complete && (!img.naturalWidth || !img.naturalHeight)) showFallback();
        });
    };

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

    const getTabRuntimeUrl = (tab = null) => {
        if (tab?.webview) {
            try {
                const currentUrl = tab.webview.getURL?.();
                if (currentUrl) return String(currentUrl).trim();
            } catch (_) {}
            const src = String(tab.webview.getAttribute?.('src') || tab.webview.src || '').trim();
            if (src) return src;
        }
        return String(tab?.url || '').trim();
    };

    const normalizeWebsiteOrigin = (rawUrl = '') => {
        const safe = String(rawUrl || '').trim();
        if (!safe) return '';
        try {
            const parsed = new URL(safe, window.location.href);
            return /^https?:$/i.test(parsed.protocol) ? parsed.origin.toLowerCase() : '';
        } catch (_) {
            return '';
        }
    };

    const getWebsiteUiPreferences = (settings = cachedSettings) => {
        const source = settings?.websiteUiPreferences;
        if (!source || typeof source !== 'object') return {};
        const normalized = {};
        for (const [origin, preferences] of Object.entries(source)) {
            const safeOrigin = normalizeWebsiteOrigin(origin);
            if (!safeOrigin || !preferences || typeof preferences !== 'object') continue;
            if (preferences.hideWindowControls === true) {
                normalized[safeOrigin] = { hideWindowControls: true };
            }
        }
        return normalized;
    };

    const isWindowControlsHiddenForUrl = (rawUrl = '') => {
        const origin = normalizeWebsiteOrigin(rawUrl);
        if (!origin) return false;
        return getWebsiteUiPreferences()?.[origin]?.hideWindowControls === true;
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
    const isVisiblePanel = (element) => Boolean(element && !element.classList.contains('hidden'));

    const syncSecondaryTopPanelBackdrop = () => {
        const shouldShowBackdrop =
            isVisiblePanel(googleAppsPanel) ||
            isVisiblePanel(customAppsPanel) ||
            isVisiblePanel(navigationTopPanel) ||
            isVisiblePanel(bookmarkTopPanel) ||
            isVisiblePanel(youtubeAddonPanel) ||
            isVisiblePanel(duckAiPanel) ||
            isVisiblePanel(siteInfoOverlay) ||
            isVisiblePanel(sessionGuardOverlay);
        secondaryTopPanelBackdrop?.classList.toggle('hidden', !shouldShowBackdrop);
    };

    const setSiteInfoVisible  = (v) => {
        siteInfoOverlay?.classList.toggle('hidden', !v);
        syncSecondaryTopPanelBackdrop();
    };
    const hideSiteInfoPopup   = ()  => setSiteInfoVisible(false);

    const formatBytes = (value = 0) => {
        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit += 1;
        }
        return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
    };

    const renderSiteInfoRows = (payload = {}) => {
        if (!siteInfoList) return;
        const host = String(payload.host || 'This site');
        const origin = String(payload.origin || '');
        if (siteInfoHost) siteInfoHost.textContent = host;
        if (siteInfoOrigin) siteInfoOrigin.textContent = origin;

        const rows = [
            {
                action: payload.siteSettingsClickable ? 'settings' : 'none',
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>`,
                label: payload.connectionLabel || 'Connection',
                value: payload.connectionValue || 'Unknown',
                tone: payload.connectionTone || 'info'
            },
            {
                action: 'none',
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"></path><path d="m9.5 12 1.7 1.7L15 10"></path></svg>`,
                label: 'Site safety',
                value: payload.safetyValue || 'Not scanned',
                tone: payload.safetyTone || 'neutral'
            },
            {
                action: payload.siteSettingsClickable ? 'settings' : 'none',
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 12a9 9 0 1 1-9-9c0 1.7 1.3 3 3 3s3-1.3 3-3c1.66 0 3 1.34 3 3 0 .7-.24 1.35-.64 1.87A3 3 0 0 0 21 12Z"></path><circle cx="8.5" cy="12.5" r="1"></circle><circle cx="12" cy="16" r="1"></circle><circle cx="15.5" cy="10.5" r="1"></circle></svg>`,
                label: 'Cookies and site data',
                value: payload.cookiesValue || 'Unavailable',
                tone: 'neutral'
            },
            {
                action: payload.siteSettingsClickable ? 'settings' : 'none',
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c0 .66.39 1.26 1 1.55.18.08.37.13.56.13H21a2 2 0 1 1 0 4h-.09c-.66 0-1.26.39-1.55 1Z"></path></svg>`,
                label: 'Permissions',
                value: payload.permissionsValue || 'Default',
                tone: 'neutral'
            },
            {
                action: payload.linksClickable ? 'links' : 'none',
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M10 13a5 5 0 0 0 7.54.54l2.92-2.92a5 5 0 0 0-7.07-7.08L11.72 5"></path><path d="M14 11a5 5 0 0 0-7.54-.54L3.54 13.4a5 5 0 0 0 7.07 7.07L12.28 19"></path></svg>`,
                label: 'Video links',
                value: payload.linksValue || '0 found',
                tone: payload.linksClickable ? 'info' : 'neutral'
            },
            {
                action: 'settings',
                icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M14 3h7v7"></path><path d="M10 14 21 3"></path><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path></svg>`,
                label: 'Site settings',
                value: 'Open in new tab',
                tone: 'neutral'
            }
        ];

        siteInfoList.innerHTML = rows.map((row) => `
            <button class="site-info-row chrome ${row.action !== 'none' ? 'is-clickable' : ''}" type="button" data-action="${escapeHtml(row.action)}">
              <span class="site-info-row-icon">${row.icon}</span>
              <span class="site-info-row-copy">
                <span class="site-info-row-label">${escapeHtml(row.label)}</span>
                <span class="site-info-row-value" data-tone="${escapeHtml(row.tone || 'neutral')}">${escapeHtml(row.value)}</span>
              </span>
              <span class="site-info-row-arrow">${row.action === 'settings' ? '&#8599;' : '&#8250;'}</span>
            </button>
        `).join('');
    };

    let foundMp4Links = [];
    
    const scanForMp4Links = async (webview) => {
        if (!webview?.executeJavaScript) return [];
        try {
            const result = await webview.executeJavaScript(`
                (() => {
                    const links = new Set();
                    // Check all elements with src attribute
                    const allElements = document.querySelectorAll('*[src]');
                    allElements.forEach(el => {
                        const src = el.getAttribute('src');
                        if (src && src.toLowerCase().includes('.mp4')) {
                            links.add(src);
                        }
                    });
                    // Check all anchor tags with href attribute
                    const anchors = document.querySelectorAll('a[href]');
                    anchors.forEach(a => {
                        const href = a.getAttribute('href');
                        if (href && href.toLowerCase().includes('.mp4')) {
                            try {
                                links.add(new URL(href, document.baseURI).href);
                            } catch (e) {
                                links.add(href);
                            }
                        }
                    });
                    // Check all source tags
                    const sources = document.querySelectorAll('source[src]');
                    sources.forEach(source => {
                        const src = source.getAttribute('src');
                        if (src && src.toLowerCase().includes('.mp4')) {
                            links.add(src);
                        }
                    });
                    // Check for inline onclick with .mp4
                    const onclickElements = document.querySelectorAll('[onclick]');
                    onclickElements.forEach(el => {
                        const onclick = el.getAttribute('onclick');
                        if (onclick) {
                            const matches = onclick.match(/https?:\\/\\/[^"'\\s]+\\.mp4/gi);
                            if (matches) {
                                matches.forEach(m => links.add(m));
                            }
                        }
                    });
                    // Check for data attributes with .mp4
                    const dataElements = document.querySelectorAll('[data-src], [data-url], [data-video]');
                    dataElements.forEach(el => {
                        ['data-src', 'data-url', 'data-video'].forEach(attr => {
                            const val = el.getAttribute(attr);
                            if (val && val.toLowerCase().includes('.mp4')) {
                                links.add(val);
                            }
                        });
                    });
                    // Also check innerHTML for video URLs
                    const bodyHtml = document.body.innerHTML;
                    const urlMatches = bodyHtml.match(/https?:\\/\\/[^"'\\s<>]+\\.mp4/gi);
                    if (urlMatches) {
                        urlMatches.forEach(url => links.add(url));
                    }
                    return Array.from(links);
                })()
            `);
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.warn('Failed to scan for .mp4 links:', e);
            return [];
        }
    };
    
    const openSiteSettingsTab = (rawUrl = '') => {
        const currentUrl = String(rawUrl || latestSiteInfoUrl || '').trim();
        if (!isHttpWebsiteUrl(currentUrl)) return;
        tabManager.createTab(`${SITE_SETTINGS_URL}?url=${encodeURIComponent(currentUrl)}`);
        hideSiteInfoPopup();
    };

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
            renderSiteInfoRows(buildSiteInfoRows({ url: 'No active website', safety: 'Not scanned', links: '0' }));
            return;
        }

        const currentUrl = String(activeTab?.url || activeWebview?.getURL?.() || '').trim();
        latestSiteInfoUrl = currentUrl;
        let hostLabel = 'This site';
        let originLabel = currentUrl || '';
        try {
            const parsed = new URL(currentUrl);
            hostLabel = parsed.hostname || hostLabel;
            originLabel = parsed.origin || originLabel;
        } catch (_) {}
        renderSiteInfoRows({
            host: hostLabel,
            origin: originLabel,
            connectionLabel: 'Checking connection',
            connectionValue: isHttpWebsiteUrl(currentUrl)
                ? (currentUrl.startsWith('https:') ? 'Your connection to this site is encrypted' : 'This page is not using HTTPS')
                : 'Not available for this page',
            connectionTone: 'info',
            safetyValue: 'Checking safety...',
            safetyTone: 'info',
            cookiesValue: 'Loading site data...',
            permissionsValue: 'Loading permissions...',
            linksValue: 'Scanning...',
            linksClickable: false
        });

        let siteSafety = null;
        let siteSettings = null;
        let mp4Links = [];
        
        if (isHttpWebsiteUrl(currentUrl)) {
            try {
                siteSafety = await window.browserAPI?.security?.getSiteSafetyStatus?.({ url: currentUrl, allowScan: true });
            } catch (_) {}
            try {
                siteSettings = await window.browserAPI?.security?.getSiteSettings?.({ url: currentUrl });
            } catch (_) {}
        }
        
        // Scan for .mp4 links
        if (activeWebview) {
            try {
                mp4Links = await scanForMp4Links(activeWebview);
                foundMp4Links = mp4Links;
            } catch (_) {}
        }
        
        if (token !== siteInfoRefreshToken) return;

        const site = siteSettings?.success ? (siteSettings.site || {}) : {};
        const safetyLabel = resolveSiteSafetyLabel(siteSafety, currentUrl);
        const permissionsSummary = site.permissionsSummary || {};
        const allowedCount = Number(permissionsSummary.allowed) || 0;
        const blockedCount = Number(permissionsSummary.blocked) || 0;
        const connectionLabel = site.secure ? 'Connection is secure' : 'Connection';
        const connectionValue = isHttpWebsiteUrl(currentUrl)
            ? `${safetyLabel}${site.secure ? '' : ' • This page is not using HTTPS'}`
            : 'Not available for this page';
        const cookiesCount = Number(site.cookiesCount) || 0;
        const cookiesBytes = Number(site.cookiesBytes) || 0;
        const cookiesValue = `${cookiesCount} cookie${cookiesCount === 1 ? '' : 's'} • ${formatBytes(cookiesBytes)}`;
        const permissionsValue = blockedCount > 0
            ? `${allowedCount} allowed, ${blockedCount} blocked`
            : allowedCount > 0
                ? `${allowedCount} allowed, others ask`
                : 'Ask (default)';
        const normalizedConnectionValue = isHttpWebsiteUrl(currentUrl)
            ? (site.secure ? 'Your connection to this site is encrypted' : 'This page is not using HTTPS')
            : 'Not available for this page';
        const normalizedCookiesValue = `${cookiesCount} cookie${cookiesCount === 1 ? '' : 's'} • ${formatBytes(cookiesBytes)}`;
        const safetyTone = siteSafety?.success ? (siteSafety?.safe === false ? 'warn' : 'ok') : 'warn';
        const normalizedLinksValue = mp4Links.length > 0 ? `${mp4Links.length} found` : 'No video links found';

        renderSiteInfoRows({
            host: site.hostname || hostLabel,
            origin: site.origin || originLabel,
            siteSettingsClickable: isHttpWebsiteUrl(currentUrl),
            connectionLabel,
            connectionValue: normalizedConnectionValue,
            connectionTone: site.secure ? 'ok' : 'warn',
            safetyValue: safetyLabel,
            safetyTone,
            cookiesValue: normalizedCookiesValue,
            permissionsValue,
            linksValue: normalizedLinksValue,
            linksClickable: mp4Links.length > 0
        });
    };

    const openSiteInfoPopup = async () => {
        hideFeaturesHomePopup();
        setCustomAppsPanelVisible(false);
        setNavigationTopPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        setSessionGuardVisible(false);
        setSiteInfoVisible(true);
        await refreshSiteInfoPopup();
    };

    siteInfoPanel?.addEventListener('mousedown', e => e.stopPropagation());

    siteInfoClose?.addEventListener('click', hideSiteInfoPopup);
    siteInfoOpenSettings?.addEventListener('click', () => openSiteSettingsTab());
    
    siteInfoList?.addEventListener('click', (e) => {
        const row = e.target.closest('.site-info-row[data-action]');
        const action = String(row?.dataset?.action || '').trim();
        if (!action || action === 'none') return;
        if (action === 'links' && foundMp4Links.length > 0) {
            showMp4LinksPopup(foundMp4Links);
            return;
        }
        if (action === 'settings') {
            openSiteSettingsTab();
        }
    });

    // ── SESSIONGUARD HELPERS ──────────────────────────────────────────────────
    const setSessionGuardVisible = (visible) => {
        if (!sessionGuardOverlay) return;
        sessionGuardOverlay.classList.toggle('hidden', !visible);
        if (visible && sessionGuardIframe) {
            sessionGuardIframe.src = SESSIONGUARD_POPUP_URL;
        } else if (!visible && sessionGuardIframe) {
            sessionGuardIframe.src = '';
        }
        syncSecondaryTopPanelBackdrop();
    };

    const toggleSessionGuardPanel = () => {
        hideFeaturesHomePopup();
        const isVisible = !sessionGuardOverlay?.classList.contains('hidden');
        setCustomAppsPanelVisible(false);
        setNavigationTopPanelVisible(false);
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        setSiteInfoVisible(false);
        setSessionGuardVisible(!isVisible);
    };

    sessionGuardOverlay?.addEventListener('click', (e) => {
        if (e.target === sessionGuardOverlay) setSessionGuardVisible(false);
    });

    // Handle SessionGuard popup data requests (from iframe)
    window.addEventListener('message', async (e) => {
        if (e.data?.type === 'GET_SESSIONGUARD_DATA') {
            const activeWebview = tabManager?.getActiveWebview?.();
            const stats = activeWebview ? await tabManager.getSessionGuardStats(activeWebview) : null;
            const sessionGuardEnabled = cachedSettings?.security?.sessionGuard?.enabled !== false;
            
            if (sessionGuardIframe?.contentWindow) {
                sessionGuardIframe.contentWindow.postMessage({
                    type: 'SESSIONGUARD_DATA',
                    enabled: sessionGuardEnabled,
                    threatsBlocked: stats?.threatsBlocked || 0,
                    tabsCount: tabManager?.tabs?.length || 0,
                    domain: stats?.domain || 'unknown'
                }, '*');
            }
        }
    });

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

        // Position context menu, keeping it within window bounds
        const menuWidth = webviewContextMenu.offsetWidth || 220;
        const menuHeight = webviewContextMenu.offsetHeight || 300;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let left = params.x;
        let top = params.y;
        
        // Adjust horizontal position if menu would go off right edge
        if (left + menuWidth > windowWidth) {
            left = windowWidth - menuWidth - 10;
        }
        // Ensure minimum left position
        if (left < 10) left = 10;
        
        // Adjust vertical position if menu would go off bottom edge
        if (top + menuHeight > windowHeight) {
            top = windowHeight - menuHeight - 10;
        }
        // Ensure minimum top position
        if (top < 10) top = 10;
        
        webviewContextMenu.style.left = `${left}px`;
        webviewContextMenu.style.top  = `${top}px`;
        showContextMenuBackdrop();
        webviewContextMenu.classList.remove('hidden');
    };

    // ── TAB CONTEXT MENU ──────────────────────────────────────────────────────
    const handleTabContextMenu = async (id, x, y) => {
        closeAllContextMenus();
        currentTabContextId = id;
        if (!tabContextMenu) return;
        
        // Position tab context menu, keeping it within window bounds
        const menuWidth = tabContextMenu.offsetWidth || 180;
        const menuHeight = tabContextMenu.offsetHeight || 200;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let left = x;
        let top = y;
        
        if (left + menuWidth > windowWidth) {
            left = windowWidth - menuWidth - 10;
        }
        if (left < 10) left = 10;
        
        if (top + menuHeight > windowHeight) {
            top = windowHeight - menuHeight - 10;
        }
        if (top < 10) top = 10;
        
        tabContextMenu.style.left = `${left}px`;
        tabContextMenu.style.top  = `${top}px`;
        showContextMenuBackdrop();
        tabContextMenu.classList.remove('hidden');

        const tab = tabManager.tabs.find(t => t.id === id);
        if (tab) {
            if (ctxDarkMode) {
                const isDarkMode = darkModeTabs.has(id);
                const span = ctxDarkMode.querySelector('span');
                if (span) span.textContent = isDarkMode ? 'Disable Dark Mode' : 'Enable Dark Mode';
                ctxDarkMode.style.color = isDarkMode ? '#4fc3f7' : '';
            }

            if (ctxHideWindowControlsMenuItem) {
                const tabUrl = getTabRuntimeUrl(tab);
                const isWebsiteTab = isHttpWebsiteUrl(tabUrl);
                const span = ctxHideWindowControlsMenuItem.querySelector('span');
                const isHiddenForSite = isWebsiteTab && isWindowControlsHiddenForUrl(tabUrl);
                ctxHideWindowControlsMenuItem.classList.toggle('hidden', !isWebsiteTab);
                if (span) {
                    span.textContent = isHiddenForSite ? 'Show Window Controls' : 'Hide Window Controls';
                }
                ctxHideWindowControlsMenuItem.style.color = isHiddenForSite ? '#ffb74d' : '';
            }

            if (ctxSessionPopupsMenuItem) {
                ctxSessionPopupsMenuItem.classList.add('hidden');
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
            'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2-2zm0 16H8V7h11v14z',
            () => sidePanel.restore()
        );

        // Position within window bounds
        const spMenuWidth = sidePanelContextMenu.offsetWidth || 180;
        const spMenuHeight = sidePanelContextMenu.offsetHeight || 200;
        let spLeft = Math.min(x, window.innerWidth - spMenuWidth - 10);
        let spTop = Math.min(y, window.innerHeight - spMenuHeight - 10);
        if (spLeft < 10) spLeft = 10;
        if (spTop < 10) spTop = 10;

        sidePanelContextMenu.style.left = `${spLeft}px`;
        sidePanelContextMenu.style.top  = `${spTop}px`;
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

        // Position within window bounds
        const hsMenuWidth = hiddenSidebarContextMenu.offsetWidth || 180;
        const hsMenuHeight = hiddenSidebarContextMenu.offsetHeight || 150;
        let hsLeft = Math.min(x, window.innerWidth - hsMenuWidth - 10);
        let hsTop = Math.min(y, window.innerHeight - hsMenuHeight - 10);
        if (hsLeft < 10) hsLeft = 10;
        if (hsTop < 10) hsTop = 10;

        hiddenSidebarContextMenu.style.left = `${hsLeft}px`;
        hiddenSidebarContextMenu.style.top  = `${hsTop}px`;
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
    const openAppTab = (url, options = {}) => {
        const targetUrl = String(url || '').trim();
        if (!targetUrl) return;
        const isServerOperatorTarget = isServerOperatorAppUrl(targetUrl);
        const existing = options.isOmChat
            ? tabManager.tabs.find(t => t.isOmChat)
            : isServerOperatorTarget
                ? tabManager.tabs.find(t => isServerOperatorAppUrl(t.url))
                : tabManager.tabs.find(t => t.url === targetUrl);
        if (existing) {
            if (options.isOmChat) {
                existing.isOmChat = true;
                existing.noSuspend = true;
                if (existing.url !== targetUrl) {
                    existing.url = targetUrl;
                    if (existing.webview) {
                        existing.webview.src = targetUrl;
                    }
                }
            } else if (isServerOperatorTarget && existing.url !== targetUrl) {
                existing.url = targetUrl;
                if (existing.webview) {
                    existing.webview.src = targetUrl;
                }
            }
            tabManager.setActiveTab(existing.id);
        } else {
            tabManager.createTab(targetUrl, options);
        }
        featuresHomePopup?.classList.add('hidden');
    };

    const openUrlInCurrentTab = (url, options = {}) => {
        const targetUrl = String(url || '').trim();
        if (!targetUrl) return;
        hideFeaturesHomePopup();
        setGoogleAppsPanelVisible(false);
        setCustomAppsPanelVisible(false);
        if (typeof tabManager?.navigateTo === 'function') {
            tabManager.navigateTo(targetUrl, options);
            return;
        }
        openAppTab(targetUrl, options);
    };

    const syncWindowControlsVisibility = () => {
        const controls = document.querySelector('.window-controls');
        if (!controls) return;
        const activeTabId = tabManager?.activeTabId ?? null;
        const hideForOpenWebUi = activeTabId != null && activeTabId === openWebUiTabId;
        const hideForLlamaWebUi = activeTabId != null && activeTabId === llamaWebUiTabId;
        const hideForWebsitePreference = isWindowControlsHiddenForUrl(getActiveTabUrl());
        controls.classList.toggle('hidden', hideForOpenWebUi || hideForLlamaWebUi || hideForWebsitePreference);
    };

    const buildOmChatUrl = (host = 'localhost', port = OM_CHAT_DEFAULT_PORT, pathname = '/') => {
        const safeHost = String(host || 'localhost').trim() || 'localhost';
        const safePort = Number(port) || OM_CHAT_DEFAULT_PORT;
        const safePath = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${String(pathname || '')}`;
        return `http://${safeHost}:${safePort}${safePath}`;
    };

    const openOpenWebUiTab = (url) => {
        const localUrl = String(url || openWebUiTabUrl || '').trim();
        if (!localUrl) return false;
        openAppTab(localUrl, { isOpenWebUi: true });
        setTimeout(() => {
            const activeId = tabManager?.activeTabId ?? null;
            if (activeId != null) {
                openWebUiTabId = activeId;
                openWebUiTabUrl = localUrl;
                syncWindowControlsVisibility();
            }
        }, 0);
        return true;
    };

    const openLlamaWebUiTab = (url = '') => {
        const targetUrl = String(url || llamaWebUiTabUrl || getLlamaServerUrl() || '').trim();
        if (!targetUrl) return false;
        openAppTab(targetUrl);
        setTimeout(() => {
            const activeId = tabManager?.activeTabId ?? null;
            if (activeId != null) {
                llamaWebUiTabId = activeId;
                llamaWebUiTabUrl = targetUrl;
                syncWindowControlsVisibility();
            }
        }, 0);
        return true;
    };

    const refreshOpenWebUiProbe = async () => {
        if (!window.browserAPI?.openWebUI?.probe) return openWebUiProbeState;
        try {
            const probe = await window.browserAPI.openWebUI.probe();
            if (probe?.success) {
                openWebUiProbeState = {
                    checked: true,
                    running: Boolean(probe.running),
                    localUrl: String(probe.localUrl || '').trim()
                };
                if (openWebUiProbeState.localUrl) {
                    openWebUiTabUrl = openWebUiProbeState.localUrl;
                }
            }
        } catch (_) {}
        return openWebUiProbeState;
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

    const resolveLlamaStatusUrl = (status = {}) => {
        const cfg = status?.config || {};
        const candidates = [
            cfg.url,
            cfg.publicUrl,
            cfg.localUrl,
            cfg.launchHost && cfg.port ? `http://${cfg.launchHost}:${cfg.port}` : '',
            status?.host && status?.port ? `http://${status.host}:${status.port}` : ''
        ].map((value) => String(value || '').trim()).filter(Boolean);
        return candidates[0] || '';
    };

    const getAiChatTargetUrl = async () => {
        try {
            const statusRes = await window.browserAPI?.servers?.getStatus?.('llama');
            if (statusRes?.success && statusRes.status?.running) {
                const resolved = resolveLlamaStatusUrl(statusRes.status);
                if (resolved) {
                    llamaWebUiTabUrl = resolved;
                    return resolved;
                }
                const fallbackUrl = getLlamaServerUrl();
                llamaWebUiTabUrl = fallbackUrl;
                return fallbackUrl;
            }
        } catch (error) {
            console.warn('[AI Chat] Local AI status check failed:', error?.message || error);
        }
        return DUCK_AI_URL;
    };

    const openAiChatTarget = async () => {
        hideFeaturesHomePopup();
        const targetUrl = String(await getAiChatTargetUrl() || '').trim();
        if (!targetUrl) return;
        const llamaUrl = String(llamaWebUiTabUrl || getLlamaServerUrl() || '').trim();
        if (llamaUrl && targetUrl === llamaUrl) {
            openLlamaWebUiTab(targetUrl);
            return;
        }
        openAppTab(targetUrl);
    };

    const setOmChatLaunchVisible = (visible) => {
        if (!omchatLaunchOverlay) return;
        omchatLaunchOverlay.classList.toggle('hidden', !visible);
    };

    const resetOmChatLaunchLog = () => {
        if (omchatLaunchLog) omchatLaunchLog.innerHTML = '';
        omchatLogLastCount = 0;
    };

    const setOmChatLaunchStatus = (message, type = '') => {
        if (!omchatLaunchStatus) return;
        omchatLaunchStatus.textContent = message;
        omchatLaunchStatus.className = `omchat-launch-status ${type}`.trim();
    };

    const appendOmChatLaunchLog = (message, type = 'info') => {
        if (!omchatLaunchLog) return;
        const line = document.createElement('div');
        line.className = `line ${type}`;
        line.textContent = message;
        omchatLaunchLog.appendChild(line);
        omchatLaunchLog.scrollTop = omchatLaunchLog.scrollHeight;
    };

    const stopOmChatLogPolling = () => {
        if (omchatLogPollTimer) {
            clearInterval(omchatLogPollTimer);
            omchatLogPollTimer = null;
        }
    };

    const pollOmChatLogs = async () => {
        if (!window.browserAPI?.servers?.getLogs) return;
        try {
            const res = await window.browserAPI.servers.getLogs('omchat');
            if (!res?.success || !Array.isArray(res.logs)) return;
            const logs = res.logs;
            if (logs.length <= omchatLogLastCount) return;
            const fresh = logs.slice(omchatLogLastCount);
            omchatLogLastCount = logs.length;
            fresh.forEach((entry) => {
                const ts = entry?.ts ? new Date(entry.ts).toLocaleTimeString() : '';
                const label = entry?.type || 'info';
                const prefix = ts ? `[${ts}] ` : '';
                appendOmChatLaunchLog(`${prefix}${entry?.message || ''}`, label === 'warn' ? 'warn' : label);
            });
        } catch (_) {}
    };

    const startOmChatLogPolling = () => {
        stopOmChatLogPolling();
        omchatLogLastCount = 0;
        pollOmChatLogs();
        omchatLogPollTimer = setInterval(pollOmChatLogs, 600);
    };

    if (window.browserAPI?.omChat?.onOutput) {
        window.browserAPI.omChat.onOutput((payload = {}) => {
            const msg = String(payload?.data || '').trim();
            if (!msg) return;
            appendOmChatLaunchLog(msg, payload?.type || 'info');
        });
    }
    if (window.browserAPI?.omChat?.onExit) {
        window.browserAPI.omChat.onExit((payload = {}) => {
            const code = payload?.code != null ? `code ${payload.code}` : 'unknown code';
            const signal = payload?.signal ? `signal ${payload.signal}` : '';
            const message = `OmChat process exited (${code}${signal ? `, ${signal}` : ''}).`;
            setOmChatLaunchStatus(message, 'error');
            appendOmChatLaunchLog(message, 'error');
        });
    }

    const launchOmChat = async () => {
        hideFeaturesHomePopup();
        setOmChatLaunchVisible(true);
        resetOmChatLaunchLog();
        setOmChatLaunchStatus('Starting OmChat server...', '');
        const useLocalIpOnly = Boolean(cachedSettings?.omchat?.useLocalIpOnly);
        const alwaysOn = Boolean(cachedSettings?.omchat?.alwaysOn);
        const getOmChatDisplayUrl = (actualUrl = '') => useLocalIpOnly ? String(actualUrl || '').trim() : OMCHAT_PUBLIC_DISPLAY_URL;

        if (!cachedSettings?.omchat?.localDbPath) {
            const message = 'OmChat local folder is not set. Please choose a folder in Settings > OmChat.';
            setOmChatLaunchStatus(message, 'error');
            appendOmChatLaunchLog(message, 'error');
            return;
        }

        if (alwaysOn) {
            appendOmChatLaunchLog('Always On enabled — checking background server...', 'info');
            try {
                const bg = await window.browserAPI.omChat.checkBackground();
                if (bg?.running && bg?.url) {
                    let serverUrl = String(bg.url).trim().replace(/[/\\]+$/, '');
                    if (!/^https?:\/\//i.test(serverUrl)) serverUrl = `http://${serverUrl}`;
                    window.__omxOmChatNetworkUrl = `${serverUrl}/`;
                    try {
                        const omOrigin = new URL(window.__omxOmChatNetworkUrl).origin;
                        tabManager?.registerOmChatOrigin?.(omOrigin);
                    } catch (_) {}
                    openAppTab(window.__omxOmChatNetworkUrl, { isOmChat: true });
                    setOmChatLaunchStatus('Connected to background server.', 'success');
                    appendOmChatLaunchLog(`Connected to ${getOmChatDisplayUrl(window.__omxOmChatNetworkUrl)}`, 'success');
                    return;
                }
            } catch (_) {}
            appendOmChatLaunchLog('Starting background server...', 'info');
        } else {
            appendOmChatLaunchLog(useLocalIpOnly ? 'Launching OmChat on local IP...' : 'Launching OmChat with ngrok...', 'info');
        }
        startOmChatLogPolling();
        try {
            const result = await window.browserAPI.omChat.startServer({ useNgrok: !useLocalIpOnly });
            if (!result?.success) {
                console.error('[Om Chat] Failed to start server:', result?.error || 'Unknown error');
                setOmChatLaunchStatus(result?.error || 'Om Chat failed to start.', 'error');
                appendOmChatLaunchLog(result?.error || 'Om Chat failed to start.', 'error');
                return;
            }
            if (alwaysOn && result?.url) {
                let serverUrl = String(result.url).trim().replace(/[/\\]+$/, '');
                if (!/^https?:\/\//i.test(serverUrl)) serverUrl = `http://${serverUrl}`;
                window.__omxOmChatNetworkUrl = `${serverUrl}/`;
                try {
                    const omOrigin = new URL(window.__omxOmChatNetworkUrl).origin;
                    tabManager?.registerOmChatOrigin?.(omOrigin);
                } catch (_) {}
                openAppTab(window.__omxOmChatNetworkUrl, { isOmChat: true });
                setOmChatLaunchStatus('Background server online.', 'success');
                appendOmChatLaunchLog(`Opened ${getOmChatDisplayUrl(window.__omxOmChatNetworkUrl)}`, 'success');
                return;
            }
            if (useLocalIpOnly) {
                let localUrl = String(result?.networkUrl || result?.localUrl || '').trim().replace(/[/\\]+$/, '');
                if (!localUrl) {
                    const message = result?.error || 'Local OmChat URL was not created.';
                    console.error('[Om Chat] Local URL unavailable:', message);
                    setOmChatLaunchStatus(message, 'error');
                    appendOmChatLaunchLog(message, 'error');
                    return;
                }
                if (!/^https?:\/\//i.test(localUrl)) {
                    localUrl = `http://${localUrl}`;
                } else if (/^https:\/\//i.test(localUrl)) {
                    localUrl = localUrl.replace(/^https:/i, 'http:');
                }
                window.__omxOmChatNetworkUrl = `${localUrl}/`;
                try {
                    const omOrigin = new URL(window.__omxOmChatNetworkUrl).origin;
                    tabManager?.registerOmChatOrigin?.(omOrigin);
                } catch (_) {}
                openAppTab(window.__omxOmChatNetworkUrl, { isOmChat: true });
                setOmChatLaunchStatus('Server online on local IP. Opening login page...', 'success');
                appendOmChatLaunchLog(`Opened ${getOmChatDisplayUrl(window.__omxOmChatNetworkUrl)}`, 'success');
                return;
            }
            const publicUrl = String(result?.publicUrl || result?.accessInfo?.publicUrl || '').trim().replace(/[/\\]+$/, '');
            if (!publicUrl) {
                const message = result?.tunnelError || result?.error || 'ngrok public URL was not created.';
                console.error('[Om Chat] Public tunnel unavailable:', message);
                setOmChatLaunchStatus(message, 'error');
                appendOmChatLaunchLog(message, 'error');
                return;
            }
            window.__omxOmChatNetworkUrl = `${publicUrl}/`;
            try {
                const omOrigin = new URL(window.__omxOmChatNetworkUrl).origin;
                tabManager?.registerOmChatOrigin?.(omOrigin);
            } catch (_) {}
            openAppTab(window.__omxOmChatNetworkUrl, { isOmChat: true });
            setOmChatLaunchStatus('Server online. Opening login page...', 'success');
            appendOmChatLaunchLog(`Opened ${getOmChatDisplayUrl(window.__omxOmChatNetworkUrl)}`, 'success');
        } catch (error) {
            console.error('[Om Chat] Launcher failed:', error);
            setOmChatLaunchStatus(error?.message || 'Om Chat failed to start.', 'error');
            appendOmChatLaunchLog(error?.message || 'Om Chat failed to start.', 'error');
        }
    };

    // ── PANEL VISIBILITY HELPERS ──────────────────────────────────────────────
    const setOpenWebUiVisible = (visible) => {
        if (!openWebUiOverlay) return;
        openWebUiOverlay.classList.toggle('hidden', !visible);
    };

    const OPEN_WEBUI_LOG_TYPE_COLORS = Object.freeze({
        info: 'rgba(255,255,255,0.82)',
        warn: '#f59e0b',
        error: '#f87171',
        success: '#4ade80'
    });

    const OPEN_WEBUI_ANSI_FG_COLORS = Object.freeze({
        30: '#111827',
        31: '#f87171',
        32: '#4ade80',
        33: '#fbbf24',
        34: '#60a5fa',
        35: '#f472b6',
        36: '#22d3ee',
        37: '#f3f4f6',
        90: '#9ca3af',
        91: '#fca5a5',
        92: '#86efac',
        93: '#fde68a',
        94: '#93c5fd',
        95: '#f9a8d4',
        96: '#67e8f9',
        97: '#ffffff'
    });

    const createOpenWebUiAnsiState = () => ({
        bold: false,
        italic: false,
        dim: false,
        fg: ''
    });

    const createOpenWebUiTerminalRenderState = () => ({
        currentLineEl: null,
        pendingOverwrite: false,
        ansiState: createOpenWebUiAnsiState()
    });

    const createOpenWebUiTimerState = () => ({
        active: false,
        startedAt: 0,
        finishedAt: 0,
        etaMs: null,
        stageLabel: '',
        finalLabel: '',
        finalType: ''
    });

    const stripOpenWebUiAnsi = (value = '') => String(value || '').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');

    const normalizeOpenWebUiTimerTimestamp = (value) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) return numeric;
        const parsed = Date.parse(String(value || ''));
        return Number.isFinite(parsed) ? parsed : Date.now();
    };

    const formatOpenWebUiDuration = (ms = 0) => {
        const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const parseOpenWebUiDurationToken = (token = '') => {
        const normalized = String(token || '').trim().replace(/^\[/, '').replace(/\]$/, '');
        if (!normalized || normalized.includes('?')) return null;
        const parts = normalized.split(':').map((piece) => Number.parseInt(piece, 10));
        if (parts.some((value) => !Number.isFinite(value))) return null;
        if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
        if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000;
        return null;
    };

    const setOpenWebUiTimerMessage = (message = '', type = '') => {
        if (!openWebUiTimer) return;
        openWebUiTimer.textContent = message;
        openWebUiTimer.className = ['openwebui-launch-timer', type].filter(Boolean).join(' ');
        openWebUiTimer.classList.toggle('hidden-panel', !String(message || '').trim());
    };

    const stopOpenWebUiTimerTicker = () => {
        if (openWebUiTimerInterval) {
            clearInterval(openWebUiTimerInterval);
            openWebUiTimerInterval = null;
        }
    };

    const updateOpenWebUiTimerDisplay = () => {
        if (!openWebUiTimer) return;
        if (!openWebUiTimerState.active && !openWebUiTimerState.finishedAt) {
            setOpenWebUiTimerMessage('');
            return;
        }

        const endAt = openWebUiTimerState.finishedAt || Date.now();
        const startedAt = openWebUiTimerState.startedAt || endAt;
        const elapsedMs = Math.max(0, endAt - startedAt);

        if (openWebUiTimerState.finishedAt) {
            const finalLabel = openWebUiTimerState.finalLabel || 'Ready in';
            setOpenWebUiTimerMessage(`${finalLabel} ${formatOpenWebUiDuration(elapsedMs)}`, openWebUiTimerState.finalType);
            return;
        }

        const parts = [`Elapsed ${formatOpenWebUiDuration(elapsedMs)}`];
        if (Number.isFinite(openWebUiTimerState.etaMs) && openWebUiTimerState.etaMs >= 0) {
            parts.push(`ETA ${formatOpenWebUiDuration(openWebUiTimerState.etaMs)}`);
        } else {
            parts.push('ETA calculating...');
        }
        if (openWebUiTimerState.stageLabel) {
            parts.push(openWebUiTimerState.stageLabel);
        }
        setOpenWebUiTimerMessage(parts.join(' | '));
    };

    const beginOpenWebUiTimer = (stageLabel = 'Preparing Open WebUI...', startedAt = Date.now()) => {
        openWebUiTimerState = {
            ...createOpenWebUiTimerState(),
            active: true,
            startedAt: normalizeOpenWebUiTimerTimestamp(startedAt),
            stageLabel: String(stageLabel || '').trim()
        };
        if (!openWebUiTimerInterval) {
            openWebUiTimerInterval = setInterval(updateOpenWebUiTimerDisplay, 1000);
        }
        updateOpenWebUiTimerDisplay();
    };

    const finishOpenWebUiTimer = (finalLabel = 'Ready in', finalType = 'success', finishedAt = Date.now()) => {
        const normalizedFinishedAt = normalizeOpenWebUiTimerTimestamp(finishedAt);
        if (!openWebUiTimerState.startedAt) {
            openWebUiTimerState.startedAt = normalizedFinishedAt;
        }
        openWebUiTimerState.active = false;
        openWebUiTimerState.finishedAt = normalizedFinishedAt;
        openWebUiTimerState.etaMs = 0;
        openWebUiTimerState.finalLabel = finalLabel;
        openWebUiTimerState.finalType = finalType;
        updateOpenWebUiTimerDisplay();
        stopOpenWebUiTimerTicker();
    };

    const resetOpenWebUiTimer = () => {
        stopOpenWebUiTimerTicker();
        openWebUiTimerState = createOpenWebUiTimerState();
        setOpenWebUiTimerMessage('');
    };

    const ensureOpenWebUiTerminalLine = (type = 'info') => {
        if (!openWebUiLog) return null;
        const normalizedType = ['warn', 'error', 'success'].includes(type) ? type : 'info';
        if (!openWebUiTerminalRenderState.currentLineEl) {
            const line = document.createElement('div');
            line.className = `line terminal-line ${normalizedType}`;
            openWebUiLog.appendChild(line);
            openWebUiTerminalRenderState.currentLineEl = line;
        }
        if (openWebUiTerminalRenderState.pendingOverwrite) {
            openWebUiTerminalRenderState.currentLineEl.textContent = '';
            openWebUiTerminalRenderState.currentLineEl.className = `line terminal-line ${normalizedType}`;
            openWebUiTerminalRenderState.pendingOverwrite = false;
            openWebUiTerminalRenderState.ansiState = createOpenWebUiAnsiState();
        }
        return openWebUiTerminalRenderState.currentLineEl;
    };

    const appendOpenWebUiBlankLine = (type = 'info') => {
        if (!openWebUiLog) return;
        const normalizedType = ['warn', 'error', 'success'].includes(type) ? type : 'info';
        const line = document.createElement('div');
        line.className = `line terminal-line ${normalizedType}`;
        openWebUiLog.appendChild(line);
    };

    const applyOpenWebUiAnsiCodes = (codes = []) => {
        const parsedCodes = Array.isArray(codes) && codes.length ? codes : ['0'];
        for (let index = 0; index < parsedCodes.length; index += 1) {
            const rawCode = String(parsedCodes[index] || '').trim();
            const code = rawCode === '' ? 0 : Number.parseInt(rawCode, 10);
            if (!Number.isFinite(code)) continue;

            if (code === 38 || code === 48) {
                const mode = Number.parseInt(parsedCodes[index + 1], 10);
                if (mode === 5) index += 2;
                else if (mode === 2) index += 4;
                continue;
            }

            if (code === 0) {
                openWebUiTerminalRenderState.ansiState = createOpenWebUiAnsiState();
                continue;
            }
            if (code === 1) {
                openWebUiTerminalRenderState.ansiState.bold = true;
                continue;
            }
            if (code === 2) {
                openWebUiTerminalRenderState.ansiState.dim = true;
                continue;
            }
            if (code === 3) {
                openWebUiTerminalRenderState.ansiState.italic = true;
                continue;
            }
            if (code === 22) {
                openWebUiTerminalRenderState.ansiState.bold = false;
                openWebUiTerminalRenderState.ansiState.dim = false;
                continue;
            }
            if (code === 23) {
                openWebUiTerminalRenderState.ansiState.italic = false;
                continue;
            }
            if (code === 39) {
                openWebUiTerminalRenderState.ansiState.fg = '';
                continue;
            }
            if (Object.prototype.hasOwnProperty.call(OPEN_WEBUI_ANSI_FG_COLORS, code)) {
                openWebUiTerminalRenderState.ansiState.fg = OPEN_WEBUI_ANSI_FG_COLORS[code];
            }
        }
    };

    const appendOpenWebUiStyledText = (text = '', type = 'info') => {
        if (!text) return;
        const line = ensureOpenWebUiTerminalLine(type);
        if (!line) return;
        const span = document.createElement('span');
        span.className = 'terminal-fragment';
        if (openWebUiTerminalRenderState.ansiState.bold) span.classList.add('bold');
        if (openWebUiTerminalRenderState.ansiState.italic) span.classList.add('italic');
        if (openWebUiTerminalRenderState.ansiState.dim) span.classList.add('dim');
        const resolvedColor = openWebUiTerminalRenderState.ansiState.fg || OPEN_WEBUI_LOG_TYPE_COLORS[type] || OPEN_WEBUI_LOG_TYPE_COLORS.info;
        if (resolvedColor) span.style.color = resolvedColor;
        span.textContent = text;
        line.appendChild(span);
    };

    const renderOpenWebUiTerminalText = (text = '', type = 'info') => {
        const cleaned = String(text || '').replace(/\x1B\[[0-9;?]*[A-LN-Za-ln-z]/g, '');
        if (!cleaned) return;
        const sgrPattern = /\x1B\[([0-9;]*)m/g;
        let cursor = 0;
        let match;
        while ((match = sgrPattern.exec(cleaned))) {
            if (match.index > cursor) {
                appendOpenWebUiStyledText(cleaned.slice(cursor, match.index), type);
            }
            applyOpenWebUiAnsiCodes(String(match[1] || '').split(';'));
            cursor = sgrPattern.lastIndex;
        }
        if (cursor < cleaned.length) {
            appendOpenWebUiStyledText(cleaned.slice(cursor), type);
        }
    };

    const appendOpenWebUiTerminalChunk = (chunk = '', type = 'info') => {
        if (!openWebUiLog) return;
        const text = String(chunk ?? '');
        if (!text) return;

        let buffer = '';
        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];

            if (char === '\r' || char === '\n') {
                if (buffer) {
                    renderOpenWebUiTerminalText(buffer, type);
                    buffer = '';
                }

                if (char === '\r' && text[index + 1] === '\n') {
                    openWebUiTerminalRenderState.currentLineEl = null;
                    openWebUiTerminalRenderState.pendingOverwrite = false;
                    index += 1;
                    continue;
                }

                if (char === '\r') {
                    openWebUiTerminalRenderState.pendingOverwrite = true;
                    continue;
                }

                if (!openWebUiTerminalRenderState.currentLineEl) {
                    appendOpenWebUiBlankLine(type);
                }
                openWebUiTerminalRenderState.currentLineEl = null;
                openWebUiTerminalRenderState.pendingOverwrite = false;
                continue;
            }

            buffer += char;
        }

        if (buffer) {
            renderOpenWebUiTerminalText(buffer, type);
        }

        openWebUiLog.scrollTop = openWebUiLog.scrollHeight;
    };

    const ingestOpenWebUiTimerSignal = (message = '', meta = {}) => {
        const observedAt = normalizeOpenWebUiTimerTimestamp(meta?.ts);
        const lines = stripOpenWebUiAnsi(message).split(/\r?\n|\r/);

        lines.forEach((rawLine) => {
            const line = String(rawLine || '').replace(/^\[[^\]]+\]\s*/, '').trim();
            if (!line) return;

            if (/^Starting Open WebUI on /i.test(line)) {
                beginOpenWebUiTimer('Starting Open WebUI', observedAt);
                return;
            }

            const progressMatch = line.match(/^([^:]+):\s*(\d+)%\|.*?\|\s*(\d+)\/(\d+)\s*\[([^<\]]+)(?:<([^,\]]+))?/i);
            if (progressMatch) {
                const stageBase = String(progressMatch[1] || '').replace(/\s+/g, ' ').trim();
                const percent = Math.max(0, Math.min(100, Number.parseInt(progressMatch[2], 10) || 0));
                const elapsedMs = parseOpenWebUiDurationToken(progressMatch[5]);
                const remainingMs = parseOpenWebUiDurationToken(progressMatch[6]);

                if (!openWebUiTimerState.active || openWebUiTimerState.finishedAt) {
                    beginOpenWebUiTimer(stageBase || 'Preparing Open WebUI...', observedAt);
                }

                if (Number.isFinite(elapsedMs)) {
                    const inferredStart = observedAt - elapsedMs;
                    if (!openWebUiTimerState.startedAt || inferredStart < openWebUiTimerState.startedAt) {
                        openWebUiTimerState.startedAt = inferredStart;
                    }
                }

                openWebUiTimerState.active = true;
                openWebUiTimerState.finishedAt = 0;
                openWebUiTimerState.finalLabel = '';
                openWebUiTimerState.finalType = '';
                openWebUiTimerState.stageLabel = stageBase ? `${stageBase} (${percent}%)` : `Progress ${percent}%`;
                openWebUiTimerState.etaMs = Number.isFinite(remainingMs) ? remainingMs : null;
                updateOpenWebUiTimerDisplay();
                return;
            }

            if (/Waiting for application startup/i.test(line)) {
                if (!openWebUiTimerState.active || openWebUiTimerState.finishedAt) {
                    beginOpenWebUiTimer('Waiting for application startup', observedAt);
                }
                openWebUiTimerState.stageLabel = 'Waiting for application startup';
                openWebUiTimerState.etaMs = null;
                updateOpenWebUiTimerDisplay();
                return;
            }

            if (/Started server process/i.test(line)) {
                if (!openWebUiTimerState.active || openWebUiTimerState.finishedAt) {
                    beginOpenWebUiTimer('Starting local server', observedAt);
                }
                openWebUiTimerState.stageLabel = 'Starting local server';
                openWebUiTimerState.etaMs = null;
                updateOpenWebUiTimerDisplay();
                return;
            }

            if (/^Activating Miniconda env:/i.test(line)) {
                if (!openWebUiTimerState.active || openWebUiTimerState.finishedAt) {
                    beginOpenWebUiTimer('Activating Miniconda environment', observedAt);
                }
                openWebUiTimerState.stageLabel = 'Activating Miniconda environment';
                openWebUiTimerState.etaMs = null;
                updateOpenWebUiTimerDisplay();
                return;
            }

            if (/^First launch can take a few minutes/i.test(line)) {
                if (!openWebUiTimerState.active || openWebUiTimerState.finishedAt) {
                    beginOpenWebUiTimer('Preparing first launch', observedAt);
                }
                openWebUiTimerState.stageLabel = 'Preparing first launch';
                openWebUiTimerState.etaMs = null;
                updateOpenWebUiTimerDisplay();
                return;
            }

            if (/Open WebUI is available at /i.test(line) || /^Opened https?:\/\//i.test(line)) {
                finishOpenWebUiTimer('Ready in', 'success', observedAt);
                return;
            }

            if (/Open WebUI stopped\./i.test(line)) {
                finishOpenWebUiTimer('Stopped after', '', observedAt);
                return;
            }

            if (/Open WebUI failed|Open WebUI did not open |exited before it became available|Local URL missing from launcher result/i.test(line)) {
                finishOpenWebUiTimer('Failed after', 'error', observedAt);
                return;
            }

            if (/Open WebUI process exited|Open WebUI exited \(/i.test(line)) {
                finishOpenWebUiTimer('Exited after', 'error', observedAt);
            }
        });
    };

    const resetOpenWebUiLog = () => {
        if (openWebUiLog) openWebUiLog.innerHTML = '';
        openWebUiLogLastCount = 0;
        openWebUiTerminalRenderState = createOpenWebUiTerminalRenderState();
    };

    const setOpenWebUiStatusMessage = (message, type = '') => {
        if (!openWebUiStatus) return;
        openWebUiStatus.textContent = message;
        openWebUiStatus.className = `omchat-launch-status ${type}`.trim();
    };

    const appendOpenWebUiLog = (message, type = 'info', meta = {}) => {
        ingestOpenWebUiTimerSignal(message, meta);
        appendOpenWebUiTerminalChunk(message, type);
    };

    const setOpenWebUiCommands = (commands = [], note = '') => {
        if (openWebUiCommandsNote) {
            openWebUiCommandsNote.textContent = note || '';
            openWebUiCommandsNote.classList.toggle('hidden-panel', !note);
        }
        if (!openWebUiCommands) return;
        openWebUiCommands.innerHTML = '';
        const fragment = document.createDocumentFragment();
        commands.forEach((command, index) => {
            const card = document.createElement('div');
            card.className = 'setup-command-card';
            card.innerHTML = `
                <div class="setup-command-step">Step ${index + 1}</div>
                <div class="setup-command-code">${escapeHtml(command)}</div>
            `;
            fragment.appendChild(card);
        });
        openWebUiCommands.appendChild(fragment);
        openWebUiCommands.classList.toggle('hidden-panel', commands.length === 0);
    };

    const setOpenWebUiMode = (mode) => {
        const showCommands = mode === 'commands';
        const showLogs = mode === 'logs';
        openWebUiCommands?.classList.toggle('hidden-panel', !showCommands);
        openWebUiCommandsNote?.classList.toggle('hidden-panel', !showCommands || !String(openWebUiCommandsNote?.textContent || '').trim());
        openWebUiLog?.classList.toggle('hidden-panel', !showLogs);
    };

    const stopOpenWebUiLogPolling = () => {
        if (openWebUiLogPollTimer) {
            clearInterval(openWebUiLogPollTimer);
            openWebUiLogPollTimer = null;
        }
    };

    const pollOpenWebUiLogs = async () => {
        if (!window.browserAPI?.servers?.getLogs) return;
        try {
            const res = await window.browserAPI.servers.getLogs('openwebui');
            if (!res?.success || !Array.isArray(res.logs)) return;
            const logs = res.logs;
            if (logs.length <= openWebUiLogLastCount) return;
            const fresh = logs.slice(openWebUiLogLastCount);
            openWebUiLogLastCount = logs.length;
            fresh.forEach((entry) => {
                const label = entry?.type || 'info';
                appendOpenWebUiLog(String(entry?.message || ''), label === 'warn' ? 'warn' : label, { ts: entry?.ts });
            });
        } catch (_) {}
    };

    const startOpenWebUiLogPolling = () => {
        if (hasOpenWebUiLiveOutput) return;
        stopOpenWebUiLogPolling();
        openWebUiLogLastCount = 0;
        pollOpenWebUiLogs();
        openWebUiLogPollTimer = setInterval(pollOpenWebUiLogs, 600);
    };

    if (window.browserAPI?.openWebUI?.onOutput) {
        window.browserAPI.openWebUI.onOutput((payload = {}) => {
            const msg = String(payload?.data ?? '');
            if (!msg) return;
            appendOpenWebUiLog(msg, payload?.type || 'info', { ts: Date.now() });
        });
    }
    if (window.browserAPI?.openWebUI?.onExit) {
        window.browserAPI.openWebUI.onExit((payload = {}) => {
            const manualStop = Boolean(payload?.manualStop);
            const code = payload?.code != null ? `code ${payload.code}` : 'unknown code';
            const signal = payload?.signal ? `signal ${payload.signal}` : '';
            const message = manualStop ? 'Open WebUI stopped.' : `Open WebUI process exited (${code}${signal ? `, ${signal}` : ''}).`;
            const isError = !manualStop && Number(payload?.code) !== 0;
            openWebUiProbeState = {
                checked: true,
                running: false,
                localUrl: openWebUiTabUrl || ''
            };
            setOpenWebUiStatusMessage(message, isError ? 'error' : '');
            if (openWebUiTimerState.active) {
                finishOpenWebUiTimer(manualStop ? 'Stopped after' : 'Exited after', isError ? 'error' : '', Date.now());
            }
            appendOpenWebUiLog(message, isError ? 'error' : 'info', { ts: Date.now() });
        });
    }

    const showOpenWebUiCommands = (state = {}) => {
        setOpenWebUiVisible(true);
        resetOpenWebUiLog();
        resetOpenWebUiTimer();
        setOpenWebUiMode('commands');
        setOpenWebUiStatusMessage(state?.title || 'Open WebUI setup required.', '');
        setOpenWebUiCommands(state?.commands || [], state?.message || '');
    };

    const launchOpenWebUi = async () => {
        hideFeaturesHomePopup();
        setOpenWebUiVisible(true);
        setOpenWebUiCommands([], '');
        resetOpenWebUiLog();
        resetOpenWebUiTimer();
        beginOpenWebUiTimer('Checking Open WebUI...');
        setOpenWebUiMode('commands');
        setOpenWebUiStatusMessage('Checking Open WebUI...', '');

        if (openWebUiProbeState.checked && openWebUiProbeState.running) {
            if (openOpenWebUiTab(openWebUiProbeState.localUrl)) {
                resetOpenWebUiTimer();
                setOpenWebUiVisibleSafe(false);
                return;
            }
        }

        const quickProbe = await refreshOpenWebUiProbe();
        if (quickProbe?.running) {
            if (openOpenWebUiTab(quickProbe.localUrl)) {
                resetOpenWebUiTimer();
                setOpenWebUiVisibleSafe(false);
                return;
            }
        }

        const status = await window.browserAPI?.openWebUI?.getStatus?.();
        if (!status?.success) {
            setOpenWebUiMode('commands');
            setOpenWebUiStatusMessage(status?.error || 'Unable to check Open WebUI status.', 'error');
            setOpenWebUiCommands([], 'Open WebUI status could not be read.');
            finishOpenWebUiTimer('Failed after', 'error');
            return;
        }

        if (status.phase === 'running') {
            const runningUrl = String(status.localUrl || openWebUiTabUrl || '').trim();
            openWebUiProbeState = {
                checked: true,
                running: true,
                localUrl: runningUrl
            };
            if (openOpenWebUiTab(runningUrl)) {
                resetOpenWebUiTimer();
                setOpenWebUiVisibleSafe(false);
                return;
            }
        }

        if (status.phase === 'install-prereqs' || status.phase === 'setup-env') {
            showOpenWebUiCommands(status);
            return;
        }

        setOpenWebUiMode('logs');
        setOpenWebUiStatusMessage(status.phase === 'running' ? 'Open WebUI is already running. Opening local UI...' : 'Starting Open WebUI...', '');
        openWebUiTimerState.stageLabel = 'Starting Open WebUI';
        updateOpenWebUiTimerDisplay();
        startOpenWebUiLogPolling();

        try {
            const result = await window.browserAPI.openWebUI.start();
            if (!result?.success) {
                if (result?.needsSetup) {
                    stopOpenWebUiLogPolling();
                    showOpenWebUiCommands(result);
                    return;
                }
                const message = result?.error || 'Open WebUI failed to start.';
                setOpenWebUiStatusMessage(message, 'error');
                finishOpenWebUiTimer('Failed after', 'error');
                appendOpenWebUiLog(message, 'error', { ts: Date.now() });
                return;
            }

            const localUrl = String(result.localUrl || status.localUrl || '').trim();
            if (!localUrl) {
                setOpenWebUiStatusMessage('Open WebUI started but no local URL was returned.', 'error');
                finishOpenWebUiTimer('Failed after', 'error');
                appendOpenWebUiLog('Local URL missing from launcher result.', 'error', { ts: Date.now() });
                return;
            }

            openWebUiProbeState = {
                checked: true,
                running: true,
                localUrl
            };
            openOpenWebUiTab(localUrl);
            setOpenWebUiStatusMessage(result.alreadyRunning ? 'Open WebUI is already online.' : 'Open WebUI is online. Opening local UI...', 'success');
            finishOpenWebUiTimer('Ready in', 'success');
            appendOpenWebUiLog(`Opened ${localUrl}`, 'success', { ts: Date.now() });
        } catch (error) {
            const message = error?.message || 'Open WebUI failed to start.';
            setOpenWebUiStatusMessage(message, 'error');
            finishOpenWebUiTimer('Failed after', 'error');
            appendOpenWebUiLog(message, 'error', { ts: Date.now() });
        }
    };

    const setGoogleAppsPanelVisible     = (v) => {
        googleAppsPanel?.classList.toggle('hidden', !v);
        quickPanelGoogle?.setAttribute('aria-expanded', v ? 'true' : 'false');
        syncSecondaryTopPanelBackdrop();
    };
    const setCustomAppsPanelVisible     = (v) => {
        customAppsPanel?.classList.toggle('hidden', !v);
        quickPanelApps?.setAttribute('aria-expanded', v ? 'true' : 'false');
        syncSecondaryTopPanelBackdrop();
    };
    const setBookmarkPanelVisible       = (v) => {
        bookmarkTopPanel?.classList.toggle('hidden', !v);
        syncSecondaryTopPanelBackdrop();
    };
    const setNavigationTopPanelVisible  = (v) => {
        navigationTopPanel?.classList.toggle('hidden', !v);
        syncSecondaryTopPanelBackdrop();
    };
    const setBookmarkEditorVisible      = (v) => bookmarkEditorOverlay?.classList.toggle('hidden', !v);
    const setCustomAppEditorVisible     = (v) => customAppEditorOverlay?.classList.toggle('hidden', !v);
    const setOmChatLaunchVisibleSafe    = (v) => {
        setOmChatLaunchVisible(v);
        if (!v) stopOmChatLogPolling();
    };
    const setOpenWebUiVisibleSafe       = (v) => {
        setOpenWebUiVisible(v);
        if (!v) {
            stopOpenWebUiLogPolling();
            resetOpenWebUiTimer();
        }
    };

    const setYouTubeAddonVisible = (visible) => {
        if (!youtubeAddonPanel) return;
        youtubeAddonPanel.classList.toggle('hidden', !visible);
        syncSecondaryTopPanelBackdrop();
    };

    const setDuckAiPanelVisible = (visible) => {
        duckAiPanel?.classList.toggle('hidden', !visible);
        syncSecondaryTopPanelBackdrop();
    };

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
        hideSidebar: true
    });

    const canShowYouTubeAddon = () => {
        const yt = getYouTubeAddonSettings(cachedSettings);
        return yt.enabled && isYouTubeUrl(getActiveTabUrl());
    };

    const canShowDuckAiPanel = () => isDuckAiChatUrl(getActiveTabUrl());

    // SessionGuard protected domains (must match extension's domain_manager.js)
    const SESSIONGUARD_DOMAINS = new Set([
        'discord.com', 'youtube.com', 'instagram.com', 'facebook.com',
        'twitter.com', 'x.com', 'github.com', 'linkedin.com', 'reddit.com',
        'google.com', 'netflix.com', 'amazon.com', 'twitch.tv', 'tiktok.com',
        'spotify.com', 'apple.com', 'microsoft.com', 'slack.com', 'zoom.us',
        'zoom.com', 'dropbox.com', 'outlook.com', 'live.com'
    ]);

    const isSessionGuardProtectedDomain = (url) => {
        try {
            const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
            for (const domain of SESSIONGUARD_DOMAINS) {
                if (hostname === domain || hostname.endsWith('.' + domain)) return true;
            }
        } catch (_) {}
        return false;
    };

    const canShowSessionGuardPanel = () => {
        const currentUrl = getActiveTabUrl();
        if (!currentUrl) return false;
        if (!tabManager?.isWebsiteUrl?.(currentUrl)) return false;
        return isSessionGuardProtectedDomain(currentUrl);
    };

    // Debounced to prevent repeated reflows when tab navigation fires rapidly.
    const syncSiteToolQuickLaunchButtons = debounce(() => {
        setFeatureTileAvailability(quickPanelYoutubeAddon, canShowYouTubeAddon(), 'YouTube Addon', 'Open YouTube to use');
        setFeatureTileAvailability(quickPanelDuckAi,       canShowDuckAiPanel(),  'Duck AI',       'Open Duck AI chat to use');
        setFeatureTileAvailability(quickPanelSessionGuard, canShowSessionGuardPanel(), 'SessionGuard',  'Open a protected site (YouTube, Discord, etc.)');
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
            setYouTubeAddonVisible(false);
        }
        if (youtubeAddonToggleHome)     youtubeAddonToggleHome.checked      = !!yt.cleanUi;
        if (youtubeAddonToggleBlur)     youtubeAddonToggleBlur.checked      = !!yt.blurThumbnails;
        if (youtubeAddonToggleChat)     youtubeAddonToggleChat.checked      = !!yt.hideChats;
        if (youtubeAddonToggleBw)       youtubeAddonToggleBw.checked        = !!yt.blackAndWhiteMode;
        if (youtubeAddonToggleAdSkipper) youtubeAddonToggleAdSkipper.checked = !!yt.adSkipper;
    };

    const syncDuckAiPanel = () => {
        if (!duckAiPanel) return;
        if (!canShowDuckAiPanel()) setDuckAiPanelVisible(false);
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
        setGoogleAppsPanelVisible(false);
        setCustomAppsPanelVisible(false);
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        const isHidden = navigationTopPanel?.classList.contains('hidden');
        setNavigationTopPanelVisible(isHidden);
        if (isHidden) syncNavigationTopPanelButtons();
    };

    const toggleGoogleAppsPanel = () => {
        hideFeaturesHomePopup();
        setCustomAppsPanelVisible(false);
        setNavigationTopPanelVisible(false);
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        const isHidden = googleAppsPanel?.classList.contains('hidden');
        setGoogleAppsPanelVisible(isHidden);
    };

    const openCustomAppEditor = () => {
        if (customTopApps.length >= CUSTOM_TOP_APPS_MAX) {
            setCustomAppEditorStatus(`You can save up to ${CUSTOM_TOP_APPS_MAX} apps.`, 'error');
            setCustomAppEditorVisible(true);
            return;
        }
        if (customAppName) customAppName.value = '';
        if (customAppUrl) customAppUrl.value = '';
        setCustomAppEditorStatus(`Save up to ${CUSTOM_TOP_APPS_MAX} apps in this panel.`, '');
        setCustomAppEditorVisible(true);
        customAppName?.focus();
    };

    const closeCustomAppEditor = () => {
        setCustomAppEditorVisible(false);
        setCustomAppEditorStatus(`Save up to ${CUSTOM_TOP_APPS_MAX} apps in this panel.`, '');
    };

    const addCustomTopApp = () => {
        const name = normalizeCustomAppName(customAppName?.value || '');
        const url = normalizeCustomAppUrl(customAppUrl?.value || '');
        if (!name) {
            setCustomAppEditorStatus('Please enter an app name.', 'error');
            customAppName?.focus();
            return;
        }
        if (!url) {
            setCustomAppEditorStatus('Please enter a valid http or https URL.', 'error');
            customAppUrl?.focus();
            return;
        }
        if (customTopApps.length >= CUSTOM_TOP_APPS_MAX) {
            setCustomAppEditorStatus(`Only ${CUSTOM_TOP_APPS_MAX} apps can be saved here.`, 'error');
            return;
        }
        if (customTopApps.some((entry) => entry.url === url)) {
            setCustomAppEditorStatus('That app URL is already saved.', 'error');
            customAppUrl?.focus();
            return;
        }
        customTopApps.push({
            id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            url
        });
        saveCustomTopApps();
        renderCustomAppsPanel();
        closeCustomAppEditor();
    };

    const removeCustomTopApp = (appId) => {
        const id = String(appId || '').trim();
        if (!id) return;
        customTopApps = customTopApps.filter((entry) => entry.id !== id);
        saveCustomTopApps();
        renderCustomAppsPanel();
    };

    const toggleCustomAppsPanel = () => {
        hideFeaturesHomePopup();
        setGoogleAppsPanelVisible(false);
        setNavigationTopPanelVisible(false);
        setYouTubeAddonVisible(false);
        setDuckAiPanelVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        const isHidden = customAppsPanel?.classList.contains('hidden');
        setCustomAppsPanelVisible(isHidden);
    };

    const toggleYouTubeAddonPanel = () => {
        if (!canShowYouTubeAddon()) return;
        setNavigationTopPanelVisible(false);
        setGoogleAppsPanelVisible(false);
        setCustomAppsPanelVisible(false);
        setDuckAiPanelVisible(false);
        setSessionGuardVisible(false);
        setBookmarkPanelVisible(false);
        setBookmarkEditorVisible(false);
        setYouTubeAddonVisible(youtubeAddonPanel?.classList.contains('hidden'));
    };

    const toggleDuckAiPanel = () => {
        if (!canShowDuckAiPanel()) return;
        setNavigationTopPanelVisible(false);
        setGoogleAppsPanelVisible(false);
        setCustomAppsPanelVisible(false);
        setYouTubeAddonVisible(false);
        setSessionGuardVisible(false);
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
        setGoogleAppsPanelVisible(false);
        setCustomAppsPanelVisible(false);
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

    const primeActiveYouTubeCleanUiActivation = async () => {
        const wv = tabManager?.getActiveWebview?.();
        if (!wv || !isYouTubeWatchUrl(getActiveTabUrl())) return false;
        try {
            const primed = await wv.executeJavaScript(`
                try {
                    sessionStorage.setItem('omxYtCleanUiReloadsRemaining', '2');
                    sessionStorage.setItem('omxYtCleanUiAdBlockUntil', String(Date.now() + 10000));
                    true;
                } catch (_) {
                    false;
                }
            `, true);
            return primed === true;
        } catch (error) {
            console.warn('[YouTube Addon] Failed to prime clean UI activation:', error);
            return false;
        }
    };

    const settingsAPI = window.browserAPI?.settings || {
        get: async () => ({}),
        save: async () => false
    };

    const persistWebsiteUiPreferencesForUrl = async (rawUrl = '', partialPreferences = {}) => {
        const origin = normalizeWebsiteOrigin(rawUrl);
        if (!origin) return false;
        try {
            if (!cachedSettings) cachedSettings = await settingsAPI.get();
            const nextWebsiteUiPreferences = {
                ...getWebsiteUiPreferences(cachedSettings)
            };
            const merged = {
                ...(nextWebsiteUiPreferences[origin] || {}),
                ...(partialPreferences || {})
            };
            if (merged.hideWindowControls === true) {
                nextWebsiteUiPreferences[origin] = { hideWindowControls: true };
            } else {
                delete nextWebsiteUiPreferences[origin];
            }
            const nextSettings = {
                ...(cachedSettings || {}),
                websiteUiPreferences: nextWebsiteUiPreferences
            };
            cachedSettings = nextSettings;
            tabManager?.updateSettings?.(nextSettings);
            syncWindowControlsVisibility();
            const success = await settingsAPI.save(nextSettings);
            if (!success) console.warn('[Tab Context Menu] Failed to save website UI preferences.');
            return success;
        } catch (error) {
            console.warn('[Tab Context Menu] Failed to persist website UI preferences:', error);
            return false;
        }
    };

    const persistYouTubeAddonPreferences = async (partialYoutubeAddon = {}, options = {}) => {
        if (_ytSavePending) return;
        _ytSavePending = true;
        try {
            if (!cachedSettings) cachedSettings = await settingsAPI.get();
            const prev = getYouTubeAddonSettings(cachedSettings);
            const next = { ...(cachedSettings?.youtubeAddon || {}), ...partialYoutubeAddon };
            const shouldReload = options.reloadOnEnable === true
                && prev.cleanUi !== true && next.cleanUi === true
                && isYouTubeWatchUrl(getActiveTabUrl());
            const nextSettings = { ...(cachedSettings || {}), youtubeAddon: next };
            cachedSettings = nextSettings;
            syncYouTubeAddonPanel();
            tabManager?.updateSettings?.(nextSettings);
            const success = await settingsAPI.save(nextSettings);
            if (!success) console.warn('[YouTube Addon] Failed to save settings.');
            if (success && shouldReload) {
                const primed = await primeActiveYouTubeCleanUiActivation();
                window.setTimeout(reloadActiveYouTubeWatchPage, primed ? 50 : 0);
            }
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
            if (!cachedSettings) cachedSettings = await settingsAPI.get();
            const nextSettings = { ...(cachedSettings || {}), aiChat: { ...(cachedSettings?.aiChat || {}), ...partialAiChat } };
            cachedSettings = nextSettings;
            syncDuckAiPanel();
            tabManager?.updateSettings?.(nextSettings);
            const success = await settingsAPI.save(nextSettings);
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

        youtubeAddonToggleHome?.addEventListener('change',      () => persistYouTubeAddonPreferences({ cleanUi: youtubeAddonToggleHome.checked }, { reloadOnEnable: youtubeAddonToggleHome.checked }));
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
            cachedSettings = injectedSettings || await settingsAPI.get();
            if (cachedSettings) {
                applyTheme(cachedSettings.theme);
                screenshotDelaySeconds = cachedSettings.screenshot?.delaySeconds ?? 0;
                updateDelayLabel(screenshotDelaySeconds);
                syncYouTubeAddonPanel();
                syncDuckAiPanel();
                syncSiteToolQuickLaunchButtons();
                tabManager?.updateSettings?.(cachedSettings);
                syncWindowControlsVisibility();
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
            const settings = await settingsAPI.get();
            settings.screenshot = settings.screenshot || {};
            settings.screenshot.delaySeconds = screenshotDelaySeconds;
            await settingsAPI.save(settings);
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

    // ── SIDEBAR NAVIGATION ────────────────────────────────────────────────────
    const handleSidebarHomeAction = () => {
        const willShowFeatures = featuresHomePopup?.classList.contains('hidden') ?? false;
        setGoogleAppsPanelVisible(false);
        setCustomAppsPanelVisible(false);
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
        bindClick(document.getElementById('btn-nav-ai-chat'),  async () => { await openAiChatTarget(); });
        bindClick(document.getElementById('btn-nav-downloads'),() => { hideFeaturesHomePopup(); openAppTab(DOWNLOADS_URL); });
        bindClick(openWebUiButton, async () => { await launchOpenWebUi(); });
        bindClick(btnNavNewTab,                           () => searchSystem.handleNewTabRequest());
    };

    // ── DOWNLOADS TOAST ────────────────────────────────────────────────────────
    const escapeNotificationText = (value = '') => escapeHtml(String(value || ''));

    const removeSiteNotification = (id) => {
        const index = activeSiteNotifications.findIndex(item => item.id === id);
        if (index === -1) return;
        const [entry] = activeSiteNotifications.splice(index, 1);
        if (entry?.timer) clearTimeout(entry.timer);
        if (!entry?.element) return;
        entry.element.classList.add('is-hiding');
        setTimeout(() => entry.element.remove(), 240);
    };

    const showSiteNotification = (payload = {}) => {
        if (!siteNotificationStack) return;

        const title = String(payload.title || '').trim() || 'Notification';
        const message = String(payload.message ?? payload.body ?? '').trim();
        const source = String(payload.source || '').trim();
        const type = String(payload.type || '').trim().toLowerCase() || 'info';
        const icon = String(payload.icon || '').trim();
        const notificationId = `site-note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const card = document.createElement('div');
        card.className = `site-notification-card type-${escapeNotificationText(type)}`;
        card.tabIndex = 0;

        const iconMarkup = icon
            ? `<img src="${escapeNotificationText(icon)}" alt="">`
            : `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7v3.59L3.29 14.3A1 1 0 0 0 4 16h16a1 1 0 0 0 .71-1.7L19 12.59V9a7 7 0 0 0-7-7zm0 20a3 3 0 0 0 2.83-2H9.17A3 3 0 0 0 12 22z"/></svg>`;

        card.innerHTML = `
            <div class="site-notification-icon">${iconMarkup}</div>
            <div class="site-notification-body">
                <div class="site-notification-title">${escapeNotificationText(title)}</div>
                ${source ? `<div class="site-notification-source">${escapeNotificationText(source)}</div>` : ''}
                ${message ? `<div class="site-notification-message">${escapeNotificationText(message)}</div>` : ''}
            </div>
            <button class="site-notification-close" type="button" aria-label="Close notification">x</button>
        `;

        const closeButton = card.querySelector('.site-notification-close');
        closeButton?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeSiteNotification(notificationId);
        });

        const activateRelatedTab = () => {
            const targetTabId = payload?.tabId;
            if (targetTabId != null && tabManager?.setActiveTab) {
                tabManager.setActiveTab(targetTabId);
            } else if (payload?.url) {
                tabManager?.createTab?.(payload.url);
            }
            removeSiteNotification(notificationId);
        };

        if (payload?.tabId != null || payload?.url) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', activateRelatedTab);
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activateRelatedTab();
                }
            });
        }

        siteNotificationStack.prepend(card);
        const timer = setTimeout(() => removeSiteNotification(notificationId), type === 'error' || type === 'warning' ? 7000 : 5600);
        activeSiteNotifications.unshift({ id: notificationId, element: card, timer });

        while (activeSiteNotifications.length > 4) {
            const oldest = activeSiteNotifications[activeSiteNotifications.length - 1];
            removeSiteNotification(oldest?.id);
        }
    };

    const downloadsBridge = window.browserAPI?.downloads;

    if (dlCancelBtn) {
        dlCancelBtn.onclick = async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!activeToastDownloadId) return;
            if (!downloadsBridge?.cancel) return;
            dlCancelBtn.disabled = true;
            if (dlStatus) dlStatus.textContent = 'Cancelling...';
            try {
                await downloadsBridge.cancel(activeToastDownloadId);
            } catch (error) {
                console.error('[Downloads] Toast cancel failed', error);
            } finally {
                dlCancelBtn.disabled = false;
            }
        };
    }

    if (downloadsBridge?.onUpdate) {
        downloadsBridge.onUpdate((item) => {
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
    if (window.browserAPI?.notifications?.onReceive) {
        window.browserAPI.notifications.onReceive((payload) => {
            showSiteNotification(payload || {});
        });
    }

    let sidePanel = null;
    try { sidePanel = new SidePanel(); } catch (error) { console.error('[Renderer] Failed to initialize SidePanel', error); }

    let translatorUI   = null;
    let writerUI       = null;
    let screenshotOverlay = null;

    tabManager = new TabManager(
        'tab-list-container', 'webview-container',
        (url) => {
            syncWindowControlsVisibility();
            primeSiteSafetyScan(url);
            syncYouTubeAddonPanel();
            syncDuckAiPanel();
            syncSiteToolQuickLaunchButtons();
        },
        handleWebviewContextMenu,
        handleTabContextMenu,
        async (tabId, tabInfo = {}) => {
            darkModeTabs.delete(tabId);
            if (tabId === openWebUiTabId) {
                openWebUiTabId = null;
                syncWindowControlsVisibility();
            }
            if (tabId === llamaWebUiTabId) {
                llamaWebUiTabId = null;
                syncWindowControlsVisibility();
            }
            if ((tabInfo?.isScraberPage || tabInfo?.isOpenWebUiPage) && window.browserAPI?.app?.killOllamaForTabClose) {
                try {
                    await window.browserAPI.app.killOllamaForTabClose({
                        killPython: tabInfo?.isOpenWebUiPage === true
                    });
                } catch (error) {
                    console.warn('[Renderer] Failed to kill Ollama after tab close:', error);
                }
            }
        }
    );
    tabManager.createTab();

    try {
        const hasOpenedOfficialSite = localStorage.getItem(FIRST_RUN_WEBSITE_KEY) === '1';
        if (!hasOpenedOfficialSite) {
            localStorage.setItem(FIRST_RUN_WEBSITE_KEY, '1');
            tabManager.createTab(OFFICIAL_OMX_WEBSITE);
        }
    } catch (error) {
        console.warn('[Renderer] Failed to persist first-run official website state.', error);
    }

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
    const searchSystem = initSearchSystem({ tabManager, settingsAPI, HOME_URL });

    bindSidebarNavigation();

    // ── TAB CONTEXT MENU BUTTONS ───────────────────────────────────────────────
    const ctxBookmarkTab = document.getElementById('ctx-bookmark-tab');
    const ctxCopyUrl     = document.getElementById('ctx-copy-url');
    const ctxDarkMode    = document.getElementById('ctx-dark-mode');
    const ctxHideWindowControls = ctxHideWindowControlsMenuItem;
    const ctxSessionPopups = ctxSessionPopupsMenuItem;

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
    if (ctxHideWindowControls) ctxHideWindowControls.onclick = async () => {
        const tab = tabManager.tabs.find(t => t.id === currentTabContextId);
        const tabUrl = getTabRuntimeUrl(tab);
        closeAllContextMenus();
        if (!isHttpWebsiteUrl(tabUrl)) return;
        const nextHiddenState = !isWindowControlsHiddenForUrl(tabUrl);
        await persistWebsiteUiPreferencesForUrl(tabUrl, { hideWindowControls: nextHiddenState });
    };
    if (ctxSessionPopups) ctxSessionPopups.onclick = () => {
        const tab = tabManager.tabs.find(t => t.id === currentTabContextId);
        const tabUrl = getTabRuntimeUrl(tab);
        closeAllContextMenus();
        if (!isHttpWebsiteUrl(tabUrl)) return;
        const nextAllowedState = !tabManager.areSessionPopupsAllowed(tabUrl);
        tabManager.setSessionPopupPermission(tabUrl, nextAllowedState);
        if (nextAllowedState && tab?.id != null) {
            tabManager.recreateTabWebview(tab.id);
        }
    };

    // ── QUICK-PANEL BUTTONS ────────────────────────────────────────────────────
    googleAppsGrid?.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('.google-app-launch') : null;
        if (!button) return;
        const targetUrl = String(button.getAttribute('data-url') || '').trim();
        if (!targetUrl) return;
        openUrlInCurrentTab(targetUrl);
    });

    if (quickPanelGoogle)       quickPanelGoogle.onclick       = () => toggleGoogleAppsPanel();
    if (quickPanelBookmarks)    quickPanelBookmarks.onclick    = () => openBookmarkPanel();
    if (quickPanelNavigation)   quickPanelNavigation.onclick   = () => toggleNavigationTopPanel();
    if (quickPanelSessionGuard) quickPanelSessionGuard.onclick = () => { if (canShowSessionGuardPanel()) { hideFeaturesHomePopup(); toggleSessionGuardPanel(); } };
    if (quickPanelApps)         quickPanelApps.onclick         = () => { hideFeaturesHomePopup(); toggleCustomAppsPanel(); };
    if (quickPanelYoutubeAddon) quickPanelYoutubeAddon.onclick = () => { if (canShowYouTubeAddon()) { hideFeaturesHomePopup(); toggleYouTubeAddonPanel(); } };
    if (quickPanelDuckAi)       quickPanelDuckAi.onclick       = () => { if (canShowDuckAiPanel())  { hideFeaturesHomePopup(); toggleDuckAiPanel();       } };
    if (quickPanelScraper)      quickPanelScraper.onclick      = () => { hideFeaturesHomePopup(); openAppTab(SCRABER_URL); };
    if (quickPanelTodoStation)  quickPanelTodoStation.onclick  = () => { hideFeaturesHomePopup(); openAppTab(TODO_STATION_URL); };
    if (quickPanelGames)        quickPanelGames.onclick        = () => { hideFeaturesHomePopup(); openAppTab(GAMES_URL); };
    if (quickPanelLlamaServer)  quickPanelLlamaServer.onclick  = () => { hideFeaturesHomePopup(); openAppTab(`${SERVER_OPERATOR_URL}?panel=llama`); };
    if (quickPanelMcpServer)    quickPanelMcpServer.onclick    = () => { hideFeaturesHomePopup(); openAppTab(`${SERVER_OPERATOR_URL}?panel=mcp`); };
    if (quickPanelDiscord)      quickPanelDiscord.onclick      = () => {
        window.browserAPI?.window?.maximize?.();
        launchOmChat();
    };

    btnTopNavBack?.addEventListener('click',    () => handleNavigationTopAction('back'));
    btnTopNavForward?.addEventListener('click', () => handleNavigationTopAction('forward'));

    omchatLaunchClose?.addEventListener('click', () => setOmChatLaunchVisibleSafe(false));
    omchatLaunchOverlay?.addEventListener('mousedown', (event) => {
        if (event.target === omchatLaunchOverlay) setOmChatLaunchVisibleSafe(false);
    });
    openWebUiClose?.addEventListener('click', () => setOpenWebUiVisibleSafe(false));

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
    customAppEditorCancel?.addEventListener('click', closeCustomAppEditor);
    customAppEditorOverlay?.addEventListener('mousedown', (event) => {
        if (event.target === customAppEditorOverlay) closeCustomAppEditor();
    });
    const _saveCustomAppOnEnter = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addCustomTopApp();
        }
    };
    customAppName?.addEventListener('keydown', _saveCustomAppOnEnter);
    customAppUrl?.addEventListener('keydown', _saveCustomAppOnEnter);
    customAppEditorSave?.addEventListener('click', addCustomTopApp);
    customAppsGrid?.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-action]');
        const action = String(trigger?.dataset?.action || '');
        if (!trigger || !action) return;
        if (action === 'add') {
            openCustomAppEditor();
            return;
        }
        if (action === 'open') openUrlInCurrentTab(trigger.dataset.url || '');
    });
    customAppsGrid?.addEventListener('contextmenu', (event) => {
        const trigger = event.target.closest('.custom-app-launch[data-app-id]');
        if (!trigger) return;
        event.preventDefault();
        event.stopPropagation();
        removeCustomTopApp(trigger.dataset.appId || '');
    });

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
            setCustomAppsPanelVisible(false);
            setNavigationTopPanelVisible(false);
            setBookmarkPanelVisible(false);
            setBookmarkEditorVisible(false);
            closeCustomAppEditor();
            setOmChatLaunchVisibleSafe(false);
            setOpenWebUiVisibleSafe(false);
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
            else if (key === 'g') { if (canShowSessionGuardPanel()) { e.preventDefault(); toggleSessionGuardPanel(); } }
        }
    });

    // ── EVENT LISTENERS ────────────────────────────────────────────────────────
    document.addEventListener('mousedown', (e) => {
        const targetTag     = String(e?.target?.tagName || '').toUpperCase();
        const clickedWebview = targetTag === 'WEBVIEW';

        if (featuresHomePopup && !featuresHomePopup.classList.contains('hidden')) {
            if (!featuresHomePopup.contains(e.target) && !btnNavHome?.contains?.(e.target)) hideFeaturesHomePopup();
        }
        if (googleAppsPanel && !googleAppsPanel.classList.contains('hidden')) {
            if (!googleAppsPanel.contains(e.target) && !quickPanelGoogle?.contains?.(e.target)) setGoogleAppsPanelVisible(false);
        }
        if (customAppsPanel && !customAppsPanel.classList.contains('hidden')) {
            if (!customAppsPanel.contains(e.target) && !quickPanelApps?.contains?.(e.target)) setCustomAppsPanelVisible(false);
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
        if (sessionGuardOverlay && !sessionGuardOverlay.classList.contains('hidden')) {
            if (e.target === sessionGuardOverlay) setSessionGuardVisible(false);
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
            else if (command === 'open-scraber')   { hideFeaturesHomePopup(); openAppTab(SCRABER_URL); }
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
            tabManager.createTab(filePath);
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
    renderGoogleAppsPanel();
    loadCustomTopApps();
    renderCustomAppsPanel();
    setupYouTubeAddonEvents();
    setupDuckAiPanelEvents();
    refreshBookmarks();
    syncSiteToolQuickLaunchButtons();
    syncNavigationTopPanelButtons();
    refreshOpenWebUiProbe().catch(() => {});

    loadSettings().catch(e => console.warn('Initial settings load failed', e));

    if (window.browserAPI.onSettingsUpdated) {
        window.browserAPI.onSettingsUpdated(settings => loadSettings(settings));
    }
});
