import { isBlocked } from '../block.js';

export class TabManager {
  constructor(tabListContainerId, webviewContainerId, onTabStateChange, onContextMenu, onTabContextMenu, onTabClose) {
    this.tabListContainer = document.getElementById(tabListContainerId);
    this.webviewContainer = document.getElementById(webviewContainerId);
    this.loader = document.getElementById('loading-indicator');
    this.findingLabel = document.getElementById('finding-label');
    this.findingTimer = document.getElementById('finding-timer');
    
    this.onTabStateChange = onTabStateChange; 
    this.onContextMenu = onContextMenu;
    this.onTabContextMenu = onTabContextMenu;
    this.onTabClose = onTabClose;
    
    this.miniPlayer = document.getElementById('mini-player');
    this.sidebarControls = document.getElementById('sidebar-footer-controls');
    this.playerTitle = document.getElementById('player-title');
    this.playerSource = document.getElementById('player-source');
    this.playerPlayIcon = document.getElementById('icon-play');
    this.playerPauseIcon = document.getElementById('icon-pause');
    
    this.btnPrev = document.getElementById('player-btn-prev');
    this.btnNext = document.getElementById('player-btn-next');
    this.btnToggle = document.getElementById('player-btn-toggle');

    // Apply initial music player design after a short delay to ensure DOM is ready
    if (this.miniPlayer) {
      setTimeout(() => this.applyMusicPlayerDesign(), 100);
    }

    this.HOME_URL = new URL('../../../html/pages/home.html', import.meta.url).href;
    this.HISTORY_URL = new URL('../../../html/pages/history.html', import.meta.url).href;
    this.SECURITY_BLOCKED_DEFENSE_URL = new URL('../../../html/pages/security-defense-blocked.html', import.meta.url).href;
    this.PRELOAD_URL = new URL('../../preload.js', import.meta.url).href;
    this.WEBVIEW_PRELOAD_URL = new URL('../../webviewPreload.js', import.meta.url).href;
    this.APP_ROOT_URL = new URL('../../../', import.meta.url).href;
    this.OMX_ICON_URL = new URL('../../../assets/icons/app.ico', import.meta.url).href;
    
    this.APP_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'/%3E%3C/svg%3E";
    this.SETTINGS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l2.39-.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l0.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-0.24,1.13-0.56,1.62-0.94l2.39.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z'/%3E%3C/svg%3E";
    this.TEXT_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'/%3E%3C/svg%3E";
    this.HISTORY_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 6v5l4.28 2.54.72-1.21-3.5-2.08V9H12z'/%3E%3C/svg%3E";
    this.GAMES_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    this.SHIELD_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff5252'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z'/%3E%3C/svg%3E";
    this.HOME_ICON = this.OMX_ICON_URL;
    this.CHAT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2347c44e'%3E%3Cpath d='M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z'/%3E%3C/svg%3E";
    this.TODO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff9800'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E";
    this.AI_SETTINGS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='4' width='12' height='12' rx='3' fill='%230f172a'/%3E%3Crect x='5.5' y='6.5' width='7' height='2' rx='1' fill='%2338bdf8'/%3E%3Crect x='5.5' y='10' width='5.5' height='2' rx='1' fill='%237c3aed'/%3E%3Ccircle cx='16.5' cy='16.5' r='3.5' fill='none' stroke='%23f59e0b' stroke-width='2'/%3E%3Cpath d='M19 19l2.5 2.5' stroke='%23f59e0b' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E";
    this.MINECRAFT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%235d8c38'%3E%3Cpath d='M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h4v4H8V8zm6 0h2v2h-2V8zm0 4h2v2h-2v-2zM8 14h4v2H8v-2z'/%3E%3C/svg%3E";

    this.STATUS_MESSAGES = [
        "Initiating Neural Link...",
        "Resolving Protocol...",
        "Establishing Secure Path...",
        "Handshaking with host...",
        "Syncing Data Frames...",
        "Verifying Encryption...",
        "Mapping Response Matrix...",
        "Rendering UI layers..."
    ];

    // Static music player designs (must match neuralHubRenderer.js)
    this.MUSIC_PLAYER_DESIGNS = [
        { id: 'classic', name: 'Classic Zen', className: 'player-classic' },
        { id: 'modern', name: 'Modern Gradient', className: 'player-modern' },
        { id: 'dark', name: 'Dark Theme', className: 'player-dark' },
        { id: 'neon', name: 'Neon Pulse', className: 'player-neon' }
    ];

    this.tabs = [];
    this.activeTabId = null;
    this.nextTabId = 1;
    this.activeAudioTabId = null; 
    this.settings = null;
    this.findingInterval = null;
    this.findingStartTime = 0;
    this.loaderActiveTabId = null;

    this.loadSettings();
    this.setupPlayerControls();

    this.SUSPEND_TIMEOUT = 30 * 1000;
    this.SUSPEND_CHECK_INTERVAL = 10 * 1000;
    setInterval(() => this.checkSuspension(), this.SUSPEND_CHECK_INTERVAL);
  }

  _normalizeUrlForCompare(url) {
    return String(url || '').trim().toLowerCase();
  }

  isPdfUrl(url = '') {
    const value = String(url || '').trim();
    if (!value) return false;
    try {
      const parsed = new URL(value, window.location.href);
      return decodeURIComponent(parsed.pathname || '').toLowerCase().endsWith('.pdf');
    } catch (_) {
      return /\.pdf(?:$|[?#])/i.test(value);
    }
  }

  isLocalOrHostedAiUrl(url = '') {
    const value = String(url || '').trim();
    if (!value) return false;
    try {
      const parsed = new URL(value, window.location.href);
      const host = String(parsed.hostname || '').toLowerCase();
      return host === 'duck.ai' || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    } catch (_) {
      return false;
    }
  }

  isTrustedHostPageUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'file:') return false;
      const normalizedUrl = this._normalizeUrlForCompare(parsed.href);
      const normalizedRoot = this._normalizeUrlForCompare(this.APP_ROOT_URL);
      return normalizedUrl.startsWith(normalizedRoot);
    } catch (_) {
      return false;
    }
  }

  setupPlayerControls() {
      if (this.btnToggle) {
          this.btnToggle.addEventListener('click', () => {
              if (this.activeAudioTabId) {
                  const tab = this.tabs.find(t => t.id === this.activeAudioTabId);
                  if (tab && tab.webview) {
                      tab.webview.executeJavaScript(`
                        (function() {
                            const media = document.querySelector('video, audio');
                            if (media) {
                                if (media.paused) media.play(); else media.pause();
                            } else {
                                if (navigator.mediaSession) {
                                    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', keyCode: 32 }));
                                }
                            }
                        })();
                      `);
                  }
              }
          });
      }
      if (this.btnPrev) {
          this.btnPrev.addEventListener('click', () => {
              if(this.activeAudioTabId) this.sendMediaKey(this.activeAudioTabId, 'ArrowLeft');
          });
      }
      if (this.btnNext) {
          this.btnNext.addEventListener('click', () => {
              if(this.activeAudioTabId) this.sendMediaKey(this.activeAudioTabId, 'ArrowRight');
          });
      }
  }

  sendMediaKey(tabId, key) {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab && tab.webview) {
          tab.webview.executeJavaScript(`
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', code: '${key}', bubbles: true }));
          `);
      }
  }

  async loadSettings() {
     try {
         const settings = await window.browserAPI.settings.get();
         this.updateSettings(settings);
     } catch(e) {}
  }

  updateSettings(settings = {}) {
    this.settings = settings || {};
    this.tabs.forEach((tab) => {
      if (!tab?.webview) return;
      tab.webview.setAttribute('allowpopups', 'yes');
      this.applyGlobalWebsiteCss(tab.webview);
      this.applyYouTubeAddon(tab.webview);
      this.applyDuckAiSidebarPreference(tab.webview);
      this.applyVyntrSearchCleanup(tab.webview);
    });
  }

  getYouTubeAddonConfig() {
    const cfg = this.settings?.youtubeAddon || {};
    return {
      enabled: cfg.enabled !== false,
      hideHomeSuggestions: cfg.hideHomeSuggestions !== false,
      blurThumbnails: cfg.blurThumbnails === true,
      hideChats: cfg.hideChats === true,
      hideHeaderControls: cfg.hideHeaderControls !== false,
      blackAndWhiteMode: cfg.blackAndWhiteMode === true,
      cleanUi: cfg.cleanUi === true
    };
  }

  getYouTubeAddonCss(config = {}) {
    if (!config?.enabled) return '';

    const homeAttr = 'data-omx-hide-home-suggestions';
    const cleanAttr = 'data-omx-yt-clean-ui';
    const blurAttr = 'data-omx-blur-thumbnails';
    const bwAttr = 'data-omx-yt-bw';
    const rules = [];

    if (config.hideChats) {
      rules.push('ytd-live-chat-frame, #chat, #chat-container, ytd-comments#comments, #comments, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] { display: none !important; }');
    }

    if (config.hideHeaderControls) {
      rules.push(`
ytd-masthead,
#masthead-container,
ytd-masthead #start,
ytd-masthead #center,
ytd-masthead #end,
ytd-masthead #guide-button,
ytd-masthead ytd-topbar-logo-renderer,
ytd-masthead #logo,
ytd-masthead ytd-searchbox,
ytd-masthead yt-searchbox,
ytd-masthead #voice-search-button,
ytd-search-sub-menu-renderer,
ytd-search-sub-menu-renderer #filter-menu,
ytd-feed-filter-chip-bar-renderer,
yt-chip-cloud-renderer,
#chips-wrapper,
#chips,
iron-selector#chips {
  display: none !important;
}
html {
  --ytd-masthead-height: 0px !important;
}
body,
ytd-app,
#content,
#page-manager,
ytd-browse,
ytd-two-column-browse-results-renderer,
ytd-rich-grid-renderer,
ytd-search,
ytd-search #primary,
ytd-search ytd-two-column-search-results-renderer,
ytd-browse[page-subtype="home"] #contents,
ytd-browse[page-subtype="subscriptions"] #contents,
ytd-rich-grid-renderer #contents,
ytd-search #contents {
  padding-top: 0 !important;
  margin-top: 0 !important;
}
ytd-browse[page-subtype="home"] #header,
ytd-browse[page-subtype="subscriptions"] #header,
ytd-rich-grid-renderer #header,
ytd-search #header,
ytd-two-column-browse-results-renderer #header {
  display: none !important;
}
ytd-page-manager,
ytd-browse[page-subtype="home"],
ytd-browse[page-subtype="subscriptions"],
ytd-search,
ytd-watch-flexy {
  padding-top: 0 !important;
  margin-top: 0 !important;
}
      `);
    }

    if (config.blackAndWhiteMode) {
      rules.push(`html[${bwAttr}="1"] { filter: grayscale(1) !important; }`);
    }

    if (config.blurThumbnails) {
      rules.push(`html[${blurAttr}="1"] a#thumbnail yt-image, html[${blurAttr}="1"] a#thumbnail img, html[${blurAttr}="1"] ytd-thumbnail yt-image, html[${blurAttr}="1"] ytd-thumbnail img, html[${blurAttr}="1"] ytd-video-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-video-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-grid-video-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-grid-video-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-rich-item-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-rich-item-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-compact-video-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-compact-video-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-playlist-video-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-playlist-video-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-reel-item-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-reel-item-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-shorts-lockup-view-model a#thumbnail yt-image, html[${blurAttr}="1"] ytd-shorts-lockup-view-model a#thumbnail img { filter: blur(12px) !important; }`);
    }

    if (config.hideHomeSuggestions) {
      rules.push(`html[${homeAttr}="1"] ytd-rich-grid-renderer ytd-rich-item-renderer, html[${homeAttr}="1"] ytd-rich-section-renderer, html[${homeAttr}="1"] ytd-reel-shelf-renderer, html[${homeAttr}="1"] ytd-watch-flexy #secondary, html[${homeAttr}="1"] ytd-watch-flexy #secondary-inner, html[${homeAttr}="1"] ytd-watch-next-secondary-results-renderer, html[${homeAttr}="1"] ytd-watch-next-secondary-results-renderer #related, html[${homeAttr}="1"] #items.ytd-watch-next-secondary-results-renderer, html[${homeAttr}="1"] ytd-compact-video-renderer, html[${homeAttr}="1"] ytd-compact-autoplay-renderer, html[${homeAttr}="1"] .ytp-endscreen-content, html[${homeAttr}="1"] .ytp-endscreen-next, html[${homeAttr}="1"] .ytp-ce-element, html[${homeAttr}="1"] .ytp-videowall-still, html[${homeAttr}="1"] .ytp-upnext, html[${homeAttr}="1"] .ytp-pause-overlay { display: none !important; }`);
    }

    if (config.cleanUi) {
      rules.push(`
html[${cleanAttr}="1"],
html[${cleanAttr}="1"] body,
html[${cleanAttr}="1"] ytd-app,
html[${cleanAttr}="1"] #content,
html[${cleanAttr}="1"] #page-manager,
html[${cleanAttr}="1"] ytd-watch-flexy,
html[${cleanAttr}="1"] #columns {
  background: #000 !important;
}
html[${cleanAttr}="1"] body {
  overflow: hidden !important;
}
html[${cleanAttr}="1"] ytd-masthead,
html[${cleanAttr}="1"] #guide,
html[${cleanAttr}="1"] tp-yt-app-drawer,
html[${cleanAttr}="1"] #secondary,
html[${cleanAttr}="1"] #secondary-inner,
html[${cleanAttr}="1"] ytd-watch-next-secondary-results-renderer,
html[${cleanAttr}="1"] #related,
html[${cleanAttr}="1"] #below,
html[${cleanAttr}="1"] #meta,
html[${cleanAttr}="1"] #meta-contents,
html[${cleanAttr}="1"] #info,
html[${cleanAttr}="1"] #info-section,
html[${cleanAttr}="1"] #description,
html[${cleanAttr}="1"] #description-inner,
html[${cleanAttr}="1"] #comments,
html[${cleanAttr}="1"] ytd-comments,
html[${cleanAttr}="1"] ytd-watch-metadata,
html[${cleanAttr}="1"] ytd-video-secondary-info-renderer,
html[${cleanAttr}="1"] ytd-video-owner-renderer,
html[${cleanAttr}="1"] ytd-structured-description-content-renderer,
html[${cleanAttr}="1"] ytd-engagement-panel-section-list-renderer,
html[${cleanAttr}="1"] ytd-playlist-panel-renderer,
html[${cleanAttr}="1"] ytd-merch-shelf-renderer,
html[${cleanAttr}="1"] ytd-reel-shelf-renderer,
html[${cleanAttr}="1"] .ytp-endscreen-content,
html[${cleanAttr}="1"] .ytp-ce-element,
html[${cleanAttr}="1"] .ytp-upnext,
html[${cleanAttr}="1"] .ytp-pause-overlay {
  display: none !important;
}
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] {
  min-height: 100vh !important;
  height: 100vh !important;
  background: #000 !important;
  padding: 0 !important;
}
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #columns {
  min-height: 100vh !important;
  height: 100vh !important;
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin: 0 !important;
  padding: clamp(20px, 4vw, 48px) !important;
  box-sizing: border-box !important;
}
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #primary {
  max-width: min(100%, 1280px) !important;
  width: min(100%, 1280px) !important;
  margin: 0 !important;
  padding: 0 !important;
  float: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #primary-inner {
  width: 100% !important;
  margin: 0 auto !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #player,
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #full-bleed-container,
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #player-full-bleed-container,
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #player-container-outer {
  max-width: min(100%, 1280px) !important;
  width: 100% !important;
  margin: 0 auto !important;
  overflow: visible !important;
}
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #player-container-inner,
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #player-theater-container,
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #movie_player,
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] .html5-video-player,
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] .html5-video-container {
  max-width: min(100%, 1280px) !important;
  width: 100% !important;
  margin: 0 auto !important;
  border-radius: 28px !important;
  overflow: hidden !important;
  background: #000 !important;
}
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #player-container-inner,
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] #movie_player {
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
}
html[${cleanAttr}="1"] ytd-watch-flexy[flexy] video.html5-main-video {
  border-radius: inherit !important;
}
      `);
    }

    return rules.join('\n');
  }

  async syncWebviewInsertedCss(webview, cacheKey, cssText) {
    if (!webview) return;
    const existingKey = webview[cacheKey];
    if (existingKey && typeof webview.removeInsertedCSS === 'function') {
      try {
        await webview.removeInsertedCSS(existingKey);
      } catch (_) {}
    }
    delete webview[cacheKey];

    const nextCss = String(cssText || '').trim();
    if (!nextCss || typeof webview.insertCSS !== 'function') return;

    try {
      webview[cacheKey] = await webview.insertCSS(nextCss);
    } catch (error) {
      console.warn('[Webview CSS] CSS injection failed:', error?.message || error);
    }
  }

  isWebsiteUrl(url = '') {
    try {
      const protocol = new URL(url, window.location.href).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  getGlobalWebsiteCss() {
    return `
html,
body {
  overflow-x: hidden !important;
  max-width: 100% !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

* {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}
    `;
  }

  async applyGlobalWebsiteCss(webview) {
    if (!webview) return;
    const currentUrl = webview.getURL ? webview.getURL() : '';
    const cssText = this.isWebsiteUrl(currentUrl) ? this.getGlobalWebsiteCss() : '';
    await this.syncWebviewInsertedCss(webview, '__omxGlobalWebsiteCssKey', cssText);
  }

  isYouTubeUrl(url = '') {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    } catch (e) {
      return false;
    }
  }

  getDuckAiChatConfig() {
    const cfg = this.settings?.aiChat || {};
    return {
      hideSidebar: cfg.duckAiHideSidebar === true
    };
  }

  isDuckAiChatUrl(url = '') {
    try {
      const parsed = new URL(url);
      const host = String(parsed.hostname || '').toLowerCase();
      return (host === 'duck.ai' || host.endsWith('.duck.ai')) && parsed.pathname.startsWith('/chat');
    } catch (_) {
      return false;
    }
  }

  isVyntrSearchUrl(url = '') {
    try {
      const parsed = new URL(url);
      const host = String(parsed.hostname || '').toLowerCase();
      return (host === 'vyntr.com' || host.endsWith('.vyntr.com')) && parsed.pathname.startsWith('/search');
    } catch (_) {
      return false;
    }
  }

  getYouTubeAddonScript(config = {}) {
    const cfg = config;
    return `
      (function() {
        try {
          const root = document.documentElement;
          const styleId = 'omx-yt-addon-style';
          const stateKey = '__omxYtAddonState';
          const homeAttr = 'data-omx-hide-home-suggestions';
          const cleanAttr = 'data-omx-yt-clean-ui';
          const blurAttr = 'data-omx-blur-thumbnails';
          const bwAttr = 'data-omx-yt-bw';
          const blurMarkerAttr = 'data-omx-thumb-blur';

          const state = window[stateKey] || (window[stateKey] = {});
          if (state.timer) clearInterval(state.timer);
          if (state.homeTimer) clearInterval(state.homeTimer);
          if (state.cleanTimer) clearInterval(state.cleanTimer);
          if (state.blurObserver) state.blurObserver.disconnect();
          if (state.blurFrame) cancelAnimationFrame(state.blurFrame);
          state.blurQueued = false;

          const clearInlineBlur = () => {
            document.querySelectorAll('[' + blurMarkerAttr + '="1"]').forEach(node => {
              if (node && node.style) {
                node.style.removeProperty('filter');
                node.style.removeProperty('transform');
                node.style.removeProperty('will-change');
                node.removeAttribute(blurMarkerAttr);
              }
            });
          };

          let style = document.getElementById(styleId);
          if (!${cfg.enabled}) {
            clearInlineBlur();
            if (style) style.remove();
            root.removeAttribute(homeAttr);
            root.removeAttribute(cleanAttr);
            root.removeAttribute(blurAttr);
            root.removeAttribute(bwAttr);
            return;
          }

          const isHomePath = () => {
            try {
              const host = location.hostname;
              if (!/youtube\\.com$/.test(host)) return false;
              return location.pathname === '/' || location.pathname === '';
            } catch (e) { return false; }
          };

          const isWatchPath = () => {
            try {
              const host = location.hostname;
              if (!/youtube\\.com$/.test(host)) return false;
              return location.pathname === '/watch' || location.pathname.startsWith('/watch');
            } catch (e) { return false; }
          };

          const updateHomeAttr = () => {
            const hideSuggestions = ${cfg.hideHomeSuggestions} && (isHomePath() || isWatchPath());
            root.setAttribute(homeAttr, hideSuggestions ? '1' : '0');
          };
          updateHomeAttr();
          state.homeTimer = setInterval(updateHomeAttr, 750);

          const updateCleanUiAttr = () => {
            const shouldCleanUi = ${cfg.cleanUi} && isWatchPath();
            root.setAttribute(cleanAttr, shouldCleanUi ? '1' : '0');
          };
          updateCleanUiAttr();
          state.cleanTimer = setInterval(updateCleanUiAttr, 750);

          if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            (document.head || root).appendChild(style);
          }

          const rules = [];

          ${cfg.hideChats ? `
          rules.push('ytd-live-chat-frame, #chat, #chat-container, ytd-comments#comments, #comments, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] { display: none !important; }');
          ` : ''}

          ${cfg.blackAndWhiteMode ? `
          root.setAttribute(bwAttr, '1');
          rules.push('html[' + bwAttr + '="1"] { filter: grayscale(1) !important; }');
          ` : `root.setAttribute(bwAttr, '0');`}

          ${cfg.blurThumbnails ? `
          root.setAttribute(blurAttr, '1');
          rules.push('html[' + blurAttr + '="1"] a#thumbnail yt-image, html[' + blurAttr + '="1"] a#thumbnail img, html[' + blurAttr + '="1"] ytd-thumbnail yt-image, html[' + blurAttr + '="1"] ytd-thumbnail img, html[' + blurAttr + '="1"] ytd-video-renderer a#thumbnail yt-image, html[' + blurAttr + '="1"] ytd-video-renderer a#thumbnail img, html[' + blurAttr + '="1"] ytd-grid-video-renderer a#thumbnail yt-image, html[' + blurAttr + '="1"] ytd-grid-video-renderer a#thumbnail img, html[' + blurAttr + '="1"] ytd-rich-item-renderer a#thumbnail yt-image, html[' + blurAttr + '="1"] ytd-rich-item-renderer a#thumbnail img, html[' + blurAttr + '="1"] ytd-compact-video-renderer a#thumbnail yt-image, html[' + blurAttr + '="1"] ytd-compact-video-renderer a#thumbnail img, html[' + blurAttr + '="1"] ytd-playlist-video-renderer a#thumbnail yt-image, html[' + blurAttr + '="1"] ytd-playlist-video-renderer a#thumbnail img, html[' + blurAttr + '="1"] ytd-reel-item-renderer a#thumbnail yt-image, html[' + blurAttr + '="1"] ytd-reel-item-renderer a#thumbnail img, html[' + blurAttr + '="1"] ytd-shorts-lockup-view-model a#thumbnail yt-image, html[' + blurAttr + '="1"] ytd-shorts-lockup-view-model a#thumbnail img { filter: blur(12px) !important; }');
          ` : `root.setAttribute(blurAttr, '0'); clearInlineBlur();`}

          ${cfg.hideHomeSuggestions ? `
          rules.push('html[' + homeAttr + '="1"] ytd-rich-grid-renderer ytd-rich-item-renderer, html[' + homeAttr + '="1"] ytd-rich-section-renderer, html[' + homeAttr + '="1"] ytd-reel-shelf-renderer, html[' + homeAttr + '="1"] ytd-watch-flexy #secondary, html[' + homeAttr + '="1"] ytd-watch-flexy #secondary-inner, html[' + homeAttr + '="1"] ytd-watch-next-secondary-results-renderer, html[' + homeAttr + '="1"] ytd-watch-next-secondary-results-renderer #related, html[' + homeAttr + '="1"] #items.ytd-watch-next-secondary-results-renderer, html[' + homeAttr + '="1"] ytd-compact-video-renderer, html[' + homeAttr + '="1"] ytd-compact-autoplay-renderer, html[' + homeAttr + '="1"] .ytp-endscreen-content, html[' + homeAttr + '="1"] .ytp-endscreen-next, html[' + homeAttr + '="1"] .ytp-ce-element, html[' + homeAttr + '="1"] .ytp-videowall-still, html[' + homeAttr + '="1"] .ytp-upnext, html[' + homeAttr + '="1"] .ytp-pause-overlay { display: none !important; }');
          ` : ''}

          style.textContent = rules.join('\\n');

          if (${cfg.blurThumbnails}) {
            const thumbSelector = 'a#thumbnail, ytd-thumbnail, ytd-playlist-thumbnail, ytd-rich-grid-media, ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, ytd-shorts-lockup-view-model, ytd-moving-thumbnail-renderer';
            const applyBlur = () => {
              clearInlineBlur();
              document.querySelectorAll(thumbSelector).forEach(host => {
                const target = host.querySelector && (host.querySelector('img.yt-core-image, yt-image, yt-img-shadow, img, #img') || host) || host;
                if (target && target.style && target.getAttribute(blurMarkerAttr) !== '1') {
                  target.setAttribute(blurMarkerAttr, '1');
                  target.style.setProperty('filter', 'blur(12px)', 'important');
                }
              });
            };
            applyBlur();
            state.blurObserver = new MutationObserver(() => {
              if (state.blurQueued) return;
              state.blurQueued = true;
              state.blurFrame = requestAnimationFrame(() => {
                state.blurQueued = false;
                applyBlur();
              });
            });
            state.blurObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
          }
        } catch(e) {
          console.warn('[YouTube Addon Error]', e);
        }
      })();
    `;
  }

  async applyYouTubeAddon(webview) {
    try {
      if (!webview || !webview.getURL) return;
      const config = this.getYouTubeAddonConfig();
      const url = webview.getURL();
      const isYouTubePage = this.isYouTubeUrl(url);
      await this.syncWebviewInsertedCss(
        webview,
        '__omxYouTubeAddonCssKey',
        isYouTubePage ? this.getYouTubeAddonCss(config) : ''
      );
      if (!isYouTubePage) return;
      const script = this.getYouTubeAddonScript(config);
      await webview.executeJavaScript(script, true);
    } catch (e) {
      console.warn('[YouTube Addon] Script execution failed:', e?.message);
    }
  }

  getDuckAiSidebarScript(config = {}) {
    const cfg = config;
    return `
      (function() {
        try {
          const shouldHide = ${cfg.hideSidebar ? 'true' : 'false'};
          const host = String(location.hostname || '').toLowerCase();
          if (!(host === 'duck.ai' || host.endsWith('.duck.ai'))) return false;
          if (!String(location.pathname || '').startsWith('/chat')) return false;

          const stateKey = '__omxDuckAiSidebarState';
          const hiddenAttr = 'data-omx-duck-hidden';
          const layoutAttr = 'data-omx-duck-layout';
          const state = window[stateKey] || (window[stateKey] = {});

          if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
          }
          if (state.raf) {
            cancelAnimationFrame(state.raf);
            state.raf = 0;
          }

          const propKey = (prop) => prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
          const rememberStyle = (node, prop, value) => {
            if (!node || !node.style) return;
            const key = 'omxDuck' + propKey(prop);
            const priKey = key + 'Priority';
            if (!(key in node.dataset)) node.dataset[key] = node.style.getPropertyValue(prop) || '';
            if (!(priKey in node.dataset)) node.dataset[priKey] = node.style.getPropertyPriority(prop) || '';
            node.style.setProperty(prop, value, 'important');
          };
          const restoreStyle = (node, prop) => {
            if (!node || !node.style) return;
            const key = 'omxDuck' + propKey(prop);
            const priKey = key + 'Priority';
            const previous = node.dataset[key];
            const priority = node.dataset[priKey] || '';
            if (typeof previous === 'undefined') {
              node.style.removeProperty(prop);
              return;
            }
            if (previous) node.style.setProperty(prop, previous, priority);
            else node.style.removeProperty(prop);
            delete node.dataset[key];
            delete node.dataset[priKey];
          };

          const sidebarProps = [
            'display',
            'width',
            'min-width',
            'max-width',
            'flex',
            'flex-basis',
            'margin',
            'margin-left',
            'margin-right',
            'padding',
            'padding-left',
            'padding-right',
            'border',
            'border-left',
            'border-right',
            'opacity',
            'overflow',
            'pointer-events'
          ];
          const layoutProps = ['grid-template-columns', 'grid-template-areas', 'gap', 'padding-left', 'margin-left'];

          const restoreAll = () => {
            document.querySelectorAll('[' + hiddenAttr + '="1"]').forEach((node) => {
              sidebarProps.forEach((prop) => restoreStyle(node, prop));
              node.removeAttribute(hiddenAttr);
            });
            document.querySelectorAll('[' + layoutAttr + '="1"]').forEach((node) => {
              layoutProps.forEach((prop) => restoreStyle(node, prop));
              node.removeAttribute(layoutAttr);
            });
          };

          const scoreNode = (node) => {
            if (!node || node === document.body || node === document.documentElement) return 0;
            const rect = node.getBoundingClientRect();
            if (rect.width < 40 || rect.width > Math.min(window.innerWidth * 0.35, 340)) return 0;
            if (rect.height < Math.min(window.innerHeight * 0.45, 260)) return 0;
            if (rect.left > Math.max(48, window.innerWidth * 0.08)) return 0;

            const computed = window.getComputedStyle(node);
            const interactiveCount = node.querySelectorAll('button, a, [role="button"]').length;
            const svgCount = node.querySelectorAll('svg').length;
            if (interactiveCount < 3 && svgCount < 3) return 0;

            const signature = String(node.className || '') + ' ' + String(node.id || '');
            let score = interactiveCount * 20 + Math.min(svgCount, 10) * 8;
            if (node.matches('aside, nav, [role="navigation"]')) score += 60;
            if (/(sidebar|side|rail|drawer|nav|menu|panel)/i.test(signature)) score += 50;
            if (computed.position === 'sticky' || computed.position === 'fixed') score += 24;
            if (computed.display === 'flex' || computed.display === 'grid') score += 16;
            score += Math.max(0, Math.round(160 - rect.left));
            score += Math.max(0, Math.round(160 - rect.width));
            return score;
          };

          const collectCandidates = () => {
            const nodes = new Set();
            const selectors = [
              'aside',
              'nav',
              '[role="navigation"]',
              '[class*="sidebar"]',
              '[class*="side-bar"]',
              '[class*="side_nav"]',
              '[class*="side-nav"]',
              '[class*="sidenav"]',
              '[class*="rail"]',
              '[class*="drawer"]',
              '[class*="panel"]'
            ].join(', ');

            document.querySelectorAll(selectors).forEach((node) => nodes.add(node));
            const buttonNodes = Array.from(document.querySelectorAll('button, a, [role="button"]'))
              .filter((node) => {
                const rect = node.getBoundingClientRect();
                return rect.left < Math.max(80, window.innerWidth * 0.1) && rect.top < window.innerHeight * 0.95;
              })
              .slice(0, 40);

            buttonNodes.forEach((node) => {
              let current = node;
              let depth = 0;
              while (current && current !== document.body && depth < 6) {
                nodes.add(current);
                current = current.parentElement;
                depth += 1;
              }
            });

            return Array.from(nodes);
          };

          const findSidebar = () => {
            let bestNode = null;
            let bestScore = 0;
            collectCandidates().forEach((node) => {
              const score = scoreNode(node);
              if (score > bestScore) {
                bestScore = score;
                bestNode = node;
              }
            });
            return bestNode;
          };

          const adjustLayout = (node) => {
            let current = node?.parentElement || null;
            let hops = 0;
            while (current && current !== document.body && hops < 5) {
              const computed = window.getComputedStyle(current);
              if (computed.display === 'grid') {
                current.setAttribute(layoutAttr, '1');
                rememberStyle(current, 'grid-template-columns', 'minmax(0, 1fr)');
                rememberStyle(current, 'gap', '0');
                rememberStyle(current, 'padding-left', '0');
              } else if (computed.display === 'flex' && String(computed.flexDirection || '').startsWith('row')) {
                current.setAttribute(layoutAttr, '1');
                rememberStyle(current, 'gap', '0');
                rememberStyle(current, 'margin-left', '0');
              }
              current = current.parentElement;
              hops += 1;
            }
          };

          const hideSidebar = () => {
            const sidebar = findSidebar();
            if (!sidebar) return false;
            sidebar.setAttribute(hiddenAttr, '1');
            rememberStyle(sidebar, 'display', 'none');
            rememberStyle(sidebar, 'width', '0');
            rememberStyle(sidebar, 'min-width', '0');
            rememberStyle(sidebar, 'max-width', '0');
            rememberStyle(sidebar, 'flex', '0 0 0');
            rememberStyle(sidebar, 'flex-basis', '0');
            rememberStyle(sidebar, 'margin', '0');
            rememberStyle(sidebar, 'padding', '0');
            rememberStyle(sidebar, 'border', '0');
            rememberStyle(sidebar, 'opacity', '0');
            rememberStyle(sidebar, 'overflow', 'hidden');
            rememberStyle(sidebar, 'pointer-events', 'none');
            adjustLayout(sidebar);
            return true;
          };

          restoreAll();
          if (!shouldHide) return true;

          const run = () => {
            state.raf = 0;
            hideSidebar();
          };

          run();
          state.observer = new MutationObserver(() => {
            if (state.raf) return;
            state.raf = requestAnimationFrame(run);
          });
          state.observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });
          return true;
        } catch (error) {
          console.warn('[Duck AI Panel] Script execution failed:', error);
          return false;
        }
      })();
    `;
  }

  async applyDuckAiSidebarPreference(webview) {
    try {
      if (!webview || !webview.getURL) return;
      const url = webview.getURL();
      if (!this.isDuckAiChatUrl(url)) return;
      const script = this.getDuckAiSidebarScript(this.getDuckAiChatConfig());
      await webview.executeJavaScript(script, true);
    } catch (e) {
      console.warn('[Duck AI Panel] Script execution failed:', e?.message);
    }
  }

  getVyntrSearchCleanupScript() {
    return `
      (function() {
        try {
          const host = String(location.hostname || '').toLowerCase();
          if (!(host === 'vyntr.com' || host.endsWith('.vyntr.com'))) return false;
          if (!String(location.pathname || '').startsWith('/search')) return false;

          const stateKey = '__omxVyntrSidebarState';
          const hiddenAttr = 'data-omx-vyntr-hidden';
          const menuTerms = ['home', 'registry', 'chatbot', 'premium', 'api', 'more'];
          const state = window[stateKey] || (window[stateKey] = {});

          if (state.observer) state.observer.disconnect();
          if (state.raf) cancelAnimationFrame(state.raf);

          const textOf = (node) => String(node?.innerText || node?.textContent || '')
            .replace(/\\s+/g, ' ')
            .trim()
            .toLowerCase();

          const scoreNode = (node) => {
            if (!node || node === document.body || node === document.documentElement) return 0;
            const text = textOf(node);
            if (!text) return 0;

            const rect = node.getBoundingClientRect();
            if (rect.width < 120 || rect.width > Math.min(window.innerWidth * 0.42, 420)) return 0;
            if (rect.height < 240) return 0;
            if (rect.left > Math.max(100, window.innerWidth * 0.2)) return 0;

            const matches = menuTerms.filter((term) => text.includes(term)).length;
            if (matches < 4) return 0;

            let score = matches * 100;
            if (text.includes('vyntr')) score += 80;
            if (rect.top < window.innerHeight * 0.2) score += 24;
            score += Math.max(0, Math.round(340 - rect.width));
            return score;
          };

          const collectCandidates = () => {
            const candidates = new Set();
            const candidateSelector = [
              'aside',
              'nav',
              '[role="navigation"]',
              '[class*="sidebar"]',
              '[class*="side-bar"]',
              '[class*="side_nav"]',
              '[class*="side-nav"]',
              '[class*="sidenav"]',
              '[class*="navigation"]',
              '[class*="menu"]',
              '[class*="drawer"]'
            ].join(', ');

            document.querySelectorAll(candidateSelector).forEach((node) => candidates.add(node));

            const labelSelector = 'a, button, span, div, p';
            const labelNodes = Array.from(document.querySelectorAll(labelSelector)).filter((node) => {
              const text = textOf(node);
              return menuTerms.includes(text) || text === 'vyntr';
            }).slice(0, 80);

            labelNodes.forEach((node) => {
              let current = node;
              let depth = 0;
              while (current && current !== document.body && depth < 6) {
                candidates.add(current);
                current = current.parentElement;
                depth += 1;
              }
            });

            return Array.from(candidates);
          };

          const findSidebar = () => {
            let best = null;
            let bestScore = 0;
            collectCandidates().forEach((node) => {
              const score = scoreNode(node);
              if (score > bestScore) {
                best = node;
                bestScore = score;
              }
            });
            return best;
          };

          const collapseLayout = (node) => {
            let current = node?.parentElement || null;
            let hops = 0;
            while (current && current !== document.body && hops < 5) {
              const computed = window.getComputedStyle(current);
              if (computed.display === 'grid') {
                current.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
                current.style.setProperty('grid-template-areas', '"main"', 'important');
                current.style.setProperty('padding-left', '0', 'important');
              } else if (computed.display === 'flex' && String(computed.flexDirection || '').startsWith('row')) {
                current.style.setProperty('gap', '0', 'important');
              }
              current = current.parentElement;
              hops += 1;
            }
          };

          const hideSidebar = () => {
            const sidebar = findSidebar();
            if (!sidebar) return false;
            sidebar.setAttribute(hiddenAttr, '1');
            sidebar.style.setProperty('display', 'none', 'important');
            sidebar.style.setProperty('width', '0', 'important');
            sidebar.style.setProperty('min-width', '0', 'important');
            sidebar.style.setProperty('max-width', '0', 'important');
            sidebar.style.setProperty('overflow', 'hidden', 'important');
            collapseLayout(sidebar);
            return true;
          };

          const run = () => {
            state.raf = 0;
            hideSidebar();
          };

          run();
          state.observer = new MutationObserver(() => {
            if (state.raf) return;
            state.raf = requestAnimationFrame(run);
          });
          state.observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });
          return true;
        } catch (error) {
          console.warn('[Vyntr Cleanup] Script execution failed:', error);
          return false;
        }
      })();
    `;
  }

  async applyVyntrSearchCleanup(webview) {
    try {
      if (!webview || !webview.getURL) return;
      const url = webview.getURL();
      if (!this.isVyntrSearchUrl(url)) return;
      await webview.executeJavaScript(this.getVyntrSearchCleanupScript(), true);
    } catch (e) {
      console.warn('[Vyntr Cleanup] Script execution failed:', e?.message);
    }
  }

  _looksLikeLocalPath(target = '') {
    const raw = String(target || '').trim();
    if (!raw) return false;
    return /^[A-Za-z]:[\\/]/.test(raw) || /^\\\\[^\\]+\\[^\\]+/.test(raw) || /^[\\/]/.test(raw) || /^[.]{1,2}[\\/]/.test(raw);
  }

  checkUrlSafety(url) {
    const rawUrl = String(url || '').trim();
    if (!rawUrl) {
      return {
        safe: false,
        type: 'invalid-url',
        originalUrl: '',
        reason: 'URL is empty'
      };
    }
    if (rawUrl.includes('security-defense-blocked.html')) {
      return { safe: true, originalUrl: rawUrl };
    }
    // Keep compatibility for app flows that pass an OS path instead of a file:// URL.
    if (this._looksLikeLocalPath(rawUrl)) {
      return { safe: true, originalUrl: rawUrl };
    }

    let parsed;
    try {
      parsed = new URL(rawUrl, window.location.href);
    } catch (_) {
      return {
        safe: false,
        type: 'invalid-url',
        originalUrl: rawUrl,
        reason: 'Malformed URL'
      };
    }

    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol === 'javascript:' || protocol === 'vbscript:' || protocol === 'devtools:') {
      return {
        safe: false,
        type: 'blocked-scheme',
        originalUrl: parsed.href,
        reason: `Blocked URL scheme: ${protocol}`
      };
    }

    const allowedProtocols = new Set(['http:', 'https:', 'file:', 'about:', 'data:']);
    if (!allowedProtocols.has(protocol)) {
      return {
        safe: false,
        type: 'blocked-scheme',
        originalUrl: parsed.href,
        reason: `Unsupported URL scheme: ${protocol || '(none)'}`
      };
    }

    if (protocol === 'about:' && parsed.href !== 'about:blank') {
      return {
        safe: false,
        type: 'blocked-url',
        originalUrl: parsed.href,
        reason: 'Only about:blank is allowed'
      };
    }

    if ((protocol === 'http:' || protocol === 'https:') && !parsed.hostname) {
      return {
        safe: false,
        type: 'invalid-url',
        originalUrl: parsed.href,
        reason: 'HTTP/HTTPS URL must include a hostname'
      };
    }

    try {
      const blocked = isBlocked(parsed.href);
      if (blocked && typeof blocked === 'object' && String(blocked.status || '').toUpperCase() === 'BLOCKED') {
        return {
          safe: false,
          type: 'blocked-site',
          originalUrl: parsed.href,
          reason: String(blocked.reason || 'Blocked by policy')
        };
      }
    } catch (_) {}

    return { safe: true, originalUrl: parsed.href };
  }

  createDefenseUrl(type, url, reason) {
      const defenseBase = this.SECURITY_BLOCKED_DEFENSE_URL;
      const safeUrl = encodeURIComponent(url);
      const safeReason = encodeURIComponent(reason || 'Blocked by Safety Policy');
      return `${defenseBase}?type=${type}&url=${safeUrl}&reason=${safeReason}`;
  }
  
  navigateTo(url, options = {}) {
    if (!url) return;
    const safety = this.checkUrlSafety(url);
    let finalUrl = url;
    
    if (!safety.safe) {
        finalUrl = this.createDefenseUrl(safety.type, safety.originalUrl, safety.reason);
    }

    if (this.activeTabId) {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) {
        tab.interactiveSearch = options.interactiveSearch || null;
        if (tab.suspended) this.restoreTab(tab);
        if (tab.webview) {
            tab.webview.src = finalUrl;
            return;
        }
      }
    }
    this.createTab(finalUrl, options);
  }

  createTab(url, options = {}) {
    const targetUrlRaw = url || this.HOME_URL;
    const safety = this.checkUrlSafety(targetUrlRaw);
    
    let finalUrl = targetUrlRaw;
    if (!safety.safe) {
        finalUrl = this.createDefenseUrl(safety.type, safety.originalUrl, safety.reason);
    }

    const id = this.nextTabId++;
    const isSystemPage = finalUrl.includes('system.html');
    const isTextStudio = finalUrl.includes('text-editor.html');
    const isHistoryPage = finalUrl.includes('history.html');
    const isGamesPage = finalUrl.includes('games.html');
    const isDefensePage = finalUrl.includes('security-defense-blocked.html');
    const isHomePage = finalUrl.includes('home.html');
    const isTodoPage = finalUrl.includes('todo.html');
    const isScraberPage = finalUrl.includes('scraper.html');
    const isServerOperatorPage = finalUrl.includes('server-operator.html');
    const isLocalAIPage = this.isLocalOrHostedAiUrl(finalUrl);

    const { tabItem, titleEl, iconEl, spinnerEl } = this.createTabUI(id, {
        isSystemPage, isTextStudio, isHistoryPage, isGamesPage, isDefensePage,
        isHomePage, isTodoPage, isScraberPage, isServerOperatorPage, isLocalAIPage
    }, finalUrl);
    const tabState = {
      id, webview: null, tabItem, titleEl, iconEl, spinnerEl, url: finalUrl,
      lastAccessed: Date.now(), suspended: false, isSystemPage,
      isTextStudio, isHistoryPage, isGamesPage, isDefensePage,
      isHomePage, isTodoPage, isScraberPage, isServerOperatorPage, isLocalAIPage,
      isLoading: true, isMainFrameLoading: true, customIcon: false, audible: false,
      interactiveSearch: options.interactiveSearch || null
    };
    this.tabs.push(tabState);
    this.tabListContainer.appendChild(tabItem);
    this._setTabLoadingVisual(tabState, true);
    this.createWebviewForTab(tabState);
    this.setActiveTab(id);
    return id;
  }

  _hashSeed(seed = '') {
    let h = 0;
    const s = String(seed || '');
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  _escapeSvgText(value = '') {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  _createTabFallbackIcon(url = '', id = 0, title = '') {
    const palette = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e', '#ec4899', '#0ea5e9'];
    let letter = 'N';
    try {
      const parsed = new URL(String(url || ''), window.location.href);
      if (parsed.hostname && parsed.hostname !== 'localhost') {
        letter = parsed.hostname.replace(/^www\./, '').charAt(0).toUpperCase() || 'N';
      } else if (parsed.pathname) {
        letter = parsed.pathname.replace(/\/+/g, '').charAt(0).toUpperCase() || 'N';
      }
    } catch (_) {
      letter = String(title || 'N').trim().charAt(0).toUpperCase() || 'N';
    }
    const seed = `${url}|${id}|${title}`;
    const color = palette[this._hashSeed(seed) % palette.length];
    const safeLetter = this._escapeSvgText(letter);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
         <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="${color}"/>
         <text x="12" y="16" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="11" font-weight="700" fill="#ffffff">${safeLetter}</text>
       </svg>`
    )}`;
  }

  createTabUI(id, flags, url = '') {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    let iconSrc = this.APP_ICON;
    let title = 'Loading...';
    if (flags.isHomePage) { iconSrc = this.HOME_ICON; title = 'Home'; }
    else if (flags.isServerOperatorPage) { iconSrc = this.MINECRAFT_ICON; title = 'Server'; }
    else if (flags.isSystemPage) { iconSrc = this.SETTINGS_ICON; title = 'System'; }
    else if (flags.isTextStudio) { iconSrc = this.TEXT_STUDIO_ICON; title = 'Text Studio'; }
    else if (flags.isHistoryPage) { iconSrc = this.HISTORY_ICON; title = 'History'; }
    else if (flags.isGamesPage) { iconSrc = this.GAMES_ICON; title = 'Games'; }
    else if (flags.isTodoPage) { iconSrc = this.TODO_ICON; title = 'Todo'; }
    else if (flags.isScraberPage) { iconSrc = this.AI_SETTINGS_ICON; title = 'Scraper'; }
    else if (flags.isLocalAIPage) { iconSrc = this.CHAT_ICON; title = 'AI Chat'; }
    else if (flags.isDefensePage) { iconSrc = this.SHIELD_ICON; title = 'Security Alert'; tabItem.classList.add('defense-tab'); }
    else {
      title = 'New Tab';
      iconSrc = this._createTabFallbackIcon(url, id, title);
      tabItem.title = 'New Tab';
    }
    const audioIcon = document.createElement('div');
    audioIcon.innerHTML = `<svg class="tab-audio-icon" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.1-.9-2-2-2s-2 .9-2 2v6c0 1.1.9 2 2 2z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
    const iconWrapEl = document.createElement('span');
    iconWrapEl.className = 'tab-icon-wrap';
    const iconEl = document.createElement('img');
    iconEl.className = 'tab-favicon';
    iconEl.src = iconSrc;
    iconEl.onerror = () => { iconEl.src = this._createTabFallbackIcon(url, id, title); };
    const spinnerEl = document.createElement('span');
    spinnerEl.className = 'tab-loading-spinner hidden';
    iconWrapEl.appendChild(iconEl);
    iconWrapEl.appendChild(spinnerEl);
    iconWrapEl.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.createTab();
    });
    iconWrapEl.addEventListener('contextmenu', (e) => {
      const leftPanel = document.getElementById('left-panel');
      const isSidebarCollapsed = leftPanel?.classList.contains('collapsed');
      if (!isSidebarCollapsed) return;
      e.preventDefault();
      e.stopPropagation();
      this.closeTab(id);
    });
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = title;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerHTML = '<svg viewBox="0 0 12 12"><path d="M1 1l10 10M1 11L11 1" stroke="currentColor" stroke-width="2"/></svg>';
    closeBtn.onclick = (e) => { e.stopPropagation(); this.closeTab(id); };
    tabItem.appendChild(audioIcon.firstChild);
    tabItem.appendChild(iconWrapEl);
    tabItem.appendChild(titleEl);
    tabItem.appendChild(closeBtn);
    tabItem.onclick = () => this.setActiveTab(id);
    tabItem.oncontextmenu = (e) => {
        const leftPanel = document.getElementById('left-panel');
        const isSidebarCollapsed = leftPanel?.classList.contains('collapsed');
        if (isSidebarCollapsed && e.target instanceof Element && e.target.closest('.tab-icon-wrap')) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (this.onTabContextMenu) this.onTabContextMenu(id, e.clientX, e.clientY);
    };
    return { tabItem, titleEl, iconEl, spinnerEl };
  }

  _setTabLoadingVisual(tabState, isLoading) {
    if (!tabState) return;
    tabState.tabItem?.classList.toggle('loading', !!isLoading);
    tabState.iconEl?.classList.toggle('hidden-by-loader', !!isLoading);
    tabState.spinnerEl?.classList.toggle('hidden', !isLoading);
  }

  createWebviewForTab(tabState) {
    const webview = document.createElement('webview');
    const trustedHostPage = this.isTrustedHostPageUrl(tabState.url);
    webview.preload = trustedHostPage ? this.PRELOAD_URL : this.WEBVIEW_PRELOAD_URL;
    webview.setAttribute('plugins', 'on');
    webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no, sandbox=yes, plugins=yes');
    webview.setAttribute('allowpopups', 'yes');
    this._attachWebviewListeners(webview, tabState);
    this.webviewContainer.appendChild(webview);
    webview.src = tabState.url;
    tabState.webview = webview;
    tabState.suspended = false;
    tabState.tabItem.classList.remove('suspended');

    // Dev tools no longer open automatically - user can open manually if needed
    // if (this.settings && this.settings.openDevToolsOnStart) {
    //     webview.addEventListener('dom-ready', () => {
    //         webview.openDevTools({ mode: 'detach' });
    //     });
    // }
    // DevTools disabled

    webview.addEventListener('dom-ready', async () => {
        try {
            await this.applyGlobalWebsiteCss(webview);
            await this.applyYouTubeAddon(webview);
            const currentUrl = webview.getURL ? webview.getURL() : '';
            if (this.isDuckAiChatUrl(currentUrl)) {
                await this.applyDuckAiSidebarPreference(webview);
            }
            if (this.isVyntrSearchUrl(currentUrl)) {
                await this.applyVyntrSearchCleanup(webview);
            }
        } catch (e) {}
    });
  }

  _startFindingAnimation() {
    const enabled = this.settings?.features?.showLoadingAnimation !== false;
    if (!enabled) return;
    
    // Apply the selected loading animation from localStorage
    this._applyLoadingAnimation();
    
    if (this.findingInterval) clearInterval(this.findingInterval);
    this.findingStartTime = performance.now();
    let msgIdx = 0;
    if (this.findingLabel) this.findingLabel.textContent = this.STATUS_MESSAGES[0];
    
    this.findingInterval = setInterval(() => {
        const elapsed = (performance.now() - this.findingStartTime) / 1000;
        if (this.findingTimer) this.findingTimer.textContent = elapsed.toFixed(3) + 's';
        if (Math.random() > 0.85) {
            msgIdx = (msgIdx + 1) % this.STATUS_MESSAGES.length;
            if (this.findingLabel) this.findingLabel.textContent = this.STATUS_MESSAGES[msgIdx];
        }
    }, 16);
  }

  _stopFindingAnimation() {
      if (this.findingInterval) clearInterval(this.findingInterval);
      this.findingInterval = null;
      
      // Hide all animation containers when stopping
      const containers = document.querySelectorAll('.anim-container');
      if (containers) {
          containers.forEach(container => {
              container.classList.add('hidden');
          });
      }
  }

  _applyLoadingAnimation() {
      // Get the selected animation from localStorage (default to 'wave')
      const selectedAnimation = localStorage.getItem('loading_animation') || 'wave';
      
      // Hide all animation containers first
      const containers = document.querySelectorAll('.anim-container');
      if (containers) {
          containers.forEach(container => {
              container.classList.add('hidden');
          });
      }
      
      // Show the selected animation container
      const selectedContainer = document.getElementById(`anim-${selectedAnimation}-container`);
      if (selectedContainer) {
          selectedContainer.classList.remove('hidden');
      } else {
          // Fallback to pulse if the selected one doesn't exist
          const fallbackContainer = document.getElementById('anim-pulse-container');
          if (fallbackContainer) {
              fallbackContainer.classList.remove('hidden');
          }
      }
  }

  _attachWebviewListeners(webview, tabState) {
    webview.addEventListener('context-menu', (e) => {
        if (this.onContextMenu) this.onContextMenu(e.params);
    });

    const dismissMenus = () => {
        if (window.closeAllContextMenus) window.closeAllContextMenus();
    };
    webview.addEventListener('focus', dismissMenus);
    webview.addEventListener('mousedown', dismissMenus);

    webview.addEventListener('will-navigate', (e) => {
        const safety = this.checkUrlSafety(e.url);
        if (!safety.safe) {
            e.preventDefault();
            const defenseUrl = this.createDefenseUrl(safety.type, safety.originalUrl, safety.reason);
            webview.src = defenseUrl;
        }
    });
    webview.addEventListener('media-started-playing', () => {
        tabState.audible = true;
        this.cancelScheduledSuspension(tabState);
        tabState.tabItem.classList.add('audible');
        this.updateMiniPlayerState(tabState, true);
    });
    webview.addEventListener('media-paused', () => {
        tabState.audible = false;
        tabState.tabItem.classList.remove('audible');
        if (tabState.id !== this.activeTabId) {
            this.scheduleSuspension(tabState);
        }
        setTimeout(() => {
            if (this.activeAudioTabId === tabState.id && !tabState.audible) {
                const otherPlaying = this.tabs.find(t => t.audible);
                if (otherPlaying) this.updateMiniPlayerState(otherPlaying, true);
                else this.updateMiniPlayerState(null, false);
            }
        }, 500);
    });
    webview.addEventListener('did-start-navigation', (e) => {
      if (!e?.isMainFrame) return;
      tabState.isMainFrameLoading = true;
      tabState.isLoading = true;
      this._setTabLoadingVisual(tabState, true);
      if (this.activeTabId === tabState.id && this.loader) {
        const enabled = this.settings?.features?.showLoadingAnimation !== false;
        if (enabled) {
          this.loader.classList.remove('hidden');
          this._startFindingAnimation();
          this.loaderActiveTabId = tabState.id;
        }
      }
    });

    webview.addEventListener('did-start-loading', () => {
      // Keep background activity silent. Only main-frame navigation should show loader.
      if (!tabState.isMainFrameLoading) return;
      // Prevent duplicate loader restarts from repeated Chromium start events.
      if (tabState.isLoading) return;
      tabState.isLoading = true;
      this._setTabLoadingVisual(tabState, true);
      if (this.activeTabId === tabState.id && this.loader) {
          const enabled = this.settings?.features?.showLoadingAnimation !== false;
          if (enabled) {
            this.loader.classList.remove('hidden');
            this._startFindingAnimation();
            this.loaderActiveTabId = tabState.id;
          }
      }
    });
    webview.addEventListener('did-stop-loading', () => {
      if (!tabState.isLoading) return;
      tabState.isLoading = false;
      tabState.isMainFrameLoading = false;
      this._setTabLoadingVisual(tabState, false);
      if (this.activeTabId === tabState.id && this.loader) {
          this.loader.classList.add('hidden');
          this._stopFindingAnimation();
      }
      if (this.loaderActiveTabId === tabState.id) this.loaderActiveTabId = null;
      
      if (tabState.interactiveSearch) {
        const query = tabState.interactiveSearch;
        tabState.interactiveSearch = null;
        const js = `
          (function() {
            const q = ${JSON.stringify(query)};
            let attempts = 0;
            const maxAttempts = 40;
            const tryInject = () => {
              const input = document.querySelector('textarea[data-testid]') || 
                            document.querySelector('textarea') || 
                            document.querySelector('[contenteditable="true"]');
              if (input) {
                input.focus();
                if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
                  input.value = q;
                } else {
                  input.textContent = q;
                }
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                setTimeout(() => {
                  const enter = (type) => new KeyboardEvent(type, { 
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true 
                  });
                  input.dispatchEvent(enter('keydown'));
                  input.dispatchEvent(enter('keypress'));
                  input.dispatchEvent(enter('keyup'));
                }, 50);
              } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(tryInject, 100);
              }
            };
            tryInject();
          })();
        `;
        webview.executeJavaScript(js).catch(() => {});
      }

      try {
        if(!tabState.isSystemPage && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage) {
            const pageTitle = webview.getTitle();
            if (pageTitle) {
                tabState.titleEl.textContent = pageTitle;
                tabState.tabItem.title = pageTitle;
                if (this.activeAudioTabId === tabState.id && this.playerTitle) this.playerTitle.textContent = pageTitle;
            }
        }
      } catch (e) {}
      if (this.activeTabId === tabState.id) {
        try { this.onTabStateChange(webview.getURL(), false); } catch (e) { }
      }
    });
    webview.addEventListener('dom-ready', () => {
       tabState.isMainFrameLoading = false;
       if (!tabState.isLoading) this._setTabLoadingVisual(tabState, false);
       if (this.activeTabId === tabState.id && this.loader) {
           this.loader.classList.add('hidden');
           this._stopFindingAnimation();
       }
    });
    webview.addEventListener('page-title-updated', (e) => {
       if(!tabState.isSystemPage && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage) {
           tabState.titleEl.textContent = e.title;
           tabState.tabItem.title = e.title;
           if (this.activeAudioTabId === tabState.id && this.playerTitle) this.playerTitle.textContent = e.title;
       }
    });
    webview.addEventListener('page-favicon-updated', (e) => {
       if (!tabState.customIcon && !tabState.isSystemPage && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage && e.favicons && e.favicons.length > 0) {
         tabState.iconEl.src = e.favicons[0];
         if (!tabState.isLoading) tabState.iconEl.style.visibility = 'visible';
       }
    });
    webview.addEventListener('did-navigate', (e) => {
      tabState.url = e.url; 
      if (this.isPdfUrl(e.url) && !tabState.customIcon) {
        tabState.titleEl.textContent = webview.getTitle() || 'PDF Viewer';
      }
      if (!tabState.isSystemPage && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage && !e.url.includes('html/pages/home.html') && !e.url.startsWith('data:') && !e.url.startsWith('file:')) {
          if (window.browserAPI && window.browserAPI.history) {
             window.browserAPI.history.push({
                 title: webview.getTitle() || e.url,
                 url: e.url, timestamp: Date.now(), favicon: tabState.iconEl.src
             });
          }
      }
      window.dispatchEvent(new CustomEvent('website-visited', { detail: { id: tabState.id, url: e.url } }));
      if (this.activeTabId === tabState.id) this.onTabStateChange(e.url, false);
      setTimeout(() => {
        this.applyGlobalWebsiteCss(webview);
        this.applyYouTubeAddon(webview);
      }, 120);
      if (this.isDuckAiChatUrl(e.url)) {
        setTimeout(() => {
          this.applyDuckAiSidebarPreference(webview);
        }, 120);
      }
      if (this.isVyntrSearchUrl(e.url)) {
        setTimeout(() => {
          this.applyVyntrSearchCleanup(webview);
        }, 150);
      }
    });
    webview.addEventListener('did-navigate-in-page', (e) => {
      tabState.url = e.url;
      if (this.activeTabId === tabState.id) this.onTabStateChange(e.url, false);
      setTimeout(() => {
        this.applyGlobalWebsiteCss(webview);
        this.applyYouTubeAddon(webview);
      }, 100);
      if (this.isDuckAiChatUrl(e.url)) {
        setTimeout(() => {
          this.applyDuckAiSidebarPreference(webview);
        }, 100);
      }
      if (this.isVyntrSearchUrl(e.url)) {
        setTimeout(() => {
          this.applyVyntrSearchCleanup(webview);
        }, 100);
      }
    });
    webview.addEventListener('new-window', (e) => {
      e.preventDefault();
      const safety = this.checkUrlSafety(e.url);
      let destUrl = e.url;
      if (!safety.safe) {
          destUrl = this.createDefenseUrl(safety.type, safety.originalUrl, safety.reason);
      }
      this.createTab(destUrl);
    });
    webview.addEventListener('ipc-message', (event) => {
       const senderUrl = (webview.getURL && webview.getURL()) || tabState.url || '';
       const trustedHostMessage = this.isTrustedHostPageUrl(senderUrl);
       if (!trustedHostMessage) {
           if (event.channel === 'run-html' || event.channel === 'open-tab' || event.channel === 'open-devtools' || event.channel === 'show-search-overlay') {
               console.warn('[Tabs] Blocked host IPC message from untrusted page:', event.channel, senderUrl);
               return;
           }
       }
       if (event.channel === 'run-html') {
           const content = event.args[0];
           const url = `data:text/html;charset=utf-8,${encodeURIComponent(content)}`;
           this.createTab(url);
       } else if (event.channel === 'open-tab') {
           const url = event.args[0];
           this.createTab(url);
       } else if (event.channel === 'open-devtools') {
           try { webview.openDevTools({ mode: 'detach' }); } catch (e) {}
       } else if (event.channel === 'show-search-overlay') {
           window.dispatchEvent(new CustomEvent('omx-show-search-overlay'));
       }
    });
    webview.addEventListener('crashed', () => {
      tabState.isLoading = false;
      tabState.isMainFrameLoading = false;
      this._setTabLoadingVisual(tabState, false);
      tabState.titleEl.textContent = "Crashed";
    });
    webview.addEventListener('did-fail-load', (event) => {
      if (!event?.isMainFrame) return;
      tabState.isLoading = false;
      tabState.isMainFrameLoading = false;
      this._setTabLoadingVisual(tabState, false);
      const attemptedUrl = String(event.validatedURL || tabState.url || '').trim();
      const reason = `${event.errorDescription || 'Unknown load error'} (${event.errorCode ?? 'n/a'})`;
      console.error('[Tabs] Main-frame load failed:', attemptedUrl, reason);
      tabState.titleEl.textContent = 'Load Failed';
      tabState.tabItem.title = attemptedUrl || 'Load Failed';
    });
    webview.addEventListener('console-message', (event) => {
      const level = Number(event?.level);
      const sourceId = String(event?.sourceId || '');
      if (level >= 2 || /renderer|home\.html|system\.html|server-operator\.html/i.test(sourceId)) {
        console.log('[Webview]', sourceId || 'unknown', `line ${event?.line || 0}:`, event?.message || '');
      }
    });
  }

  updateMiniPlayerState(tab, isPlaying) {
      const hasMiniPlayerUi = !!(this.miniPlayer || this.playerTitle || this.playerSource || this.playerPlayIcon || this.playerPauseIcon);
      if (!hasMiniPlayerUi) {
          this.activeAudioTabId = (isPlaying && tab) ? tab.id : null;
          if (this.sidebarControls) this.sidebarControls.classList.remove('hidden');
          return;
      }

      if (isPlaying && tab) {
          this.activeAudioTabId = tab.id;
          if (this.playerTitle) {
              this.playerTitle.textContent = tab.titleEl.textContent || 'Unknown Track';
          }
          try {
              const u = new URL(tab.url);
              if (this.playerSource) this.playerSource.textContent = u.hostname.replace('www.','');
          } catch(e) {
              if (this.playerSource) this.playerSource.textContent = 'Web Source';
          }
          if (this.playerPlayIcon) this.playerPlayIcon.classList.add('hidden');
          if (this.playerPauseIcon) this.playerPauseIcon.classList.remove('hidden');
          if (this.miniPlayer) {
              // Check if music player is enabled
              const musicPlayerEnabled = window.musicPlayerManager ? window.musicPlayerManager.isEnabled() : true;
              if (musicPlayerEnabled) {
                  this.miniPlayer.classList.remove('hidden');
                  this.miniPlayer.classList.add('is-playing');
                  // Apply the selected music player design
                  const { designId, enabled: playerEnabled } = this.getMusicPlayerDesignFromStorage();
                  
                  if (playerEnabled) {
                      // Remove all design classes
                      this.MUSIC_PLAYER_DESIGNS.forEach(design => {
                          this.miniPlayer.classList.remove(design.className);
                      });
                      
                      // Apply selected design
                      const selectedDesign = this.MUSIC_PLAYER_DESIGNS.find(d => d.id === designId);
                      if (selectedDesign) {
                          this.miniPlayer.classList.add(selectedDesign.className);
                          console.log('[Music Player] Applied design:', selectedDesign.name);
                      } else {
                          console.warn('[Music Player] Design not found for ID:', designId);
                          this.miniPlayer.classList.add('player-classic');
                      }
                  }
              } else {
                  this.miniPlayer.classList.add('hidden');
              }
          }
          // Always show sidebar controls when sidebar is collapsed, even when audio is playing
          const leftPanel = document.getElementById('left-panel');
          const isSidebarCollapsed = leftPanel && leftPanel.classList.contains('collapsed');
          if (this.sidebarControls && !isSidebarCollapsed) {
              this.sidebarControls.classList.add('hidden');
          }
      } else {
          this.activeAudioTabId = null;
          if (this.playerPlayIcon) this.playerPlayIcon.classList.remove('hidden');
          if (this.playerPauseIcon) this.playerPauseIcon.classList.add('hidden');
          if (this.miniPlayer) {
              this.miniPlayer.classList.add('hidden');
              this.miniPlayer.classList.remove('is-playing');
          }
          if (this.sidebarControls) this.sidebarControls.classList.remove('hidden');
      }
  }

  // Get music player design from localStorage
  getMusicPlayerDesignFromStorage() {
      try {
          const designId = localStorage.getItem('music_player_design') || 'classic';
          const enabled = localStorage.getItem('music_player_enabled') !== 'false';
          return { designId, enabled };
      } catch (e) {
          console.error('[Music Player] Error reading from localStorage:', e);
          return { designId: 'classic', enabled: true };
      }
  }

  // Apply music player design class to mini player
  applyMusicPlayerDesign() {
      if (!this.miniPlayer) {
          return;
      }
      
      // Get settings from localStorage (works independently of musicPlayerManager)
      const { designId, enabled } = this.getMusicPlayerDesignFromStorage();
      
      console.log('[Music Player] Applying design - ID:', designId, 'Enabled:', enabled);
      
      // Remove all existing design classes first
      this.MUSIC_PLAYER_DESIGNS.forEach(design => {
          this.miniPlayer.classList.remove(design.className);
      });
      
      if (!enabled) {
          console.log('[Music Player] Player is disabled, design not applied');
          return;
      }
      
      // Apply selected design
      const selectedDesign = this.MUSIC_PLAYER_DESIGNS.find(d => d.id === designId);
      
      if (selectedDesign) {
          this.miniPlayer.classList.add(selectedDesign.className);
          console.log('[Music Player] Successfully applied design:', selectedDesign.name, 'Class:', selectedDesign.className);
      } else {
          // Fallback to classic if design not found
          console.warn('[Music Player] Design not found for ID:', designId, '- using classic');
          this.miniPlayer.classList.add('player-classic');
      }
  }

  checkSuspension() {
      const now = Date.now();
      this.tabs.forEach(t => {
          if (t.audible) return;
          if (t.id !== this.activeTabId && !t.suspended && now - t.lastAccessed > this.SUSPEND_TIMEOUT) { 
             this.suspendTab(t);
          }
      });
  }

  cancelScheduledSuspension(tab) {
      if (!tab?.suspensionTimer) return;
      clearTimeout(tab.suspensionTimer);
      tab.suspensionTimer = null;
  }

  scheduleSuspension(tab) {
      if (!tab || tab.id === this.activeTabId || tab.suspended || tab.audible) return;
      this.cancelScheduledSuspension(tab);
      const remaining = Math.max(1000, this.SUSPEND_TIMEOUT - (Date.now() - tab.lastAccessed));
      tab.suspensionTimer = setTimeout(() => {
          tab.suspensionTimer = null;
          if (tab.id !== this.activeTabId && !tab.suspended && !tab.audible) {
              this.suspendTab(tab);
          }
      }, remaining);
  }

  suspendTab(tab) {
      if (!tab.webview) return;
      this.cancelScheduledSuspension(tab);
      try { tab.url = tab.webview.getURL(); tab.webview.blur(); } catch(e){}
      tab.webview.remove();
      tab.webview = null;
      tab.suspended = true;
      tab.tabItem.classList.add('suspended');
  }

  restoreTab(tab) {
      if (!tab.suspended) return;
      this.cancelScheduledSuspension(tab);
      this.createWebviewForTab(tab);
  }

  closeTab(id) {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index === -1) return;
    const tab = this.tabs[index];
    if (this.activeAudioTabId === id) this.updateMiniPlayerState(null, false);
    this.cancelScheduledSuspension(tab);
    if (tab.webview) { try { tab.webview.blur(); } catch(e){} tab.webview.remove(); }
    if (tab.tabItem) tab.tabItem.remove();
    this.tabs.splice(index, 1);
    
    // Notify about tab closure for cleanup
    if (this.onTabClose) this.onTabClose(id);
    
    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        const nextIndex = Math.min(index, this.tabs.length - 1);
        this.setActiveTab(this.tabs[nextIndex].id);
      } else {
        this.activeTabId = null;
        this.createTab(); 
      }
    }
  }

  updateTabIcon(id, dataUri) {
      const tab = this.tabs.find(t => t.id === id);
      if (tab) {
          tab.customIcon = true; 
          tab.iconEl.src = dataUri;
          if (!tab.isLoading) tab.iconEl.style.visibility = 'visible';
          tab.iconEl.style.display = 'block';
      }
  }

  setActiveTab(id) {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;
    this.activeTabId = id;
    if (this.loader) {
        const enabled = this.settings?.features?.showLoadingAnimation !== false;
        if (tab.isLoading && tab.isMainFrameLoading && enabled) {
            if (this.loaderActiveTabId !== tab.id || this.loader.classList.contains('hidden')) {
                this.loader.classList.remove('hidden');
                this._startFindingAnimation();
                this.loaderActiveTabId = tab.id;
            }
        } else {
            this.loader.classList.add('hidden');
            this._stopFindingAnimation();
            if (!tab.isLoading) this.loaderActiveTabId = null;
        }
    }
    if (tab.suspended) this.restoreTab(tab);
    tab.lastAccessed = Date.now();
    this.cancelScheduledSuspension(tab);
    this.tabs.forEach(t => {
      if (t.id === id) {
        if(t.webview) {
            t.webview.classList.remove('hidden');
            setTimeout(() => { try { t.webview.focus(); } catch(e){} }, 50); 
            try { this.onTabStateChange(t.webview.getURL(), false); } catch (e) { this.onTabStateChange(t.url, false); }
        }
        t.tabItem.classList.add('active');
        window.dispatchEvent(new CustomEvent('tab-activated', { detail: { id } }));
      } else {
        if (t.webview) { t.webview.classList.add('hidden'); t.webview.blur(); }
        this.scheduleSuspension(t);
        t.tabItem.classList.remove('active');
      }
    });
  }

  getActiveWebview() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    return tab ? tab.webview : null;
  }
}


