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
    this.SECURITY_DEFENSE_URL = new URL('../../../html/pages/security-defense.html', import.meta.url).href;
    this.PRELOAD_URL = new URL('../../preload.js', import.meta.url).href;
    this.APP_ROOT_URL = new URL('../../../', import.meta.url).href;
    this.OMX_ICON_URL = new URL('../../../assets/icons/app.ico', import.meta.url).href;
    
    this.APP_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z'/%3E%3C/svg%3E";
    this.SETTINGS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l2.39-.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l0.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-0.24,1.13-0.56,1.62-0.94l2.39.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z'/%3E%3C/svg%3E";
    this.IMAGE_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    this.TEXT_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'/%3E%3C/svg%3E";
    this.HISTORY_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 6v5l4.28 2.54.72-1.21-3.5-2.08V9H12z'/%3E%3C/svg%3E";
    this.GAMES_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    this.SHIELD_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff5252'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z'/%3E%3C/svg%3E";
    this.HOME_ICON = this.OMX_ICON_URL;
    this.CHAT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2347c44e'%3E%3Cpath d='M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z'/%3E%3C/svg%3E";
    this.TODO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff9800'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E";
    this.PDF_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f44336'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-8-6z'/%3E%3C/svg%3E";
    this.AI_SETTINGS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239c27b0'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-2h-2v2zm0-4h2V7h-2v6z'/%3E%3C/svg%3E";
    this.NEURAL_HUB_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff6b9d'%3E%3Cpath d='M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm3.5-9c.8 0 1.5-.7 1.5-1.5S16.3 8 15.5 8 14 8.7 14 9.5s.7 1.5 1.5 1.5zm-7 0c.8 0 1.5-.7 1.5-1.5S9.3 8 8.5 8 7 8.7 7 9.5 7.7 11 8.5 11zm3.5 6c-2.3 0-4.3-1.4-5.2-3.4h10.4c-.9 2-2.9 3.4-5.2 3.4z'/%3E%3C/svg%3E";
    this.MINECRAFT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%235d8c38'%3E%3Cpath d='M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h4v4H8V8zm6 0h2v2h-2V8zm0 4h2v2h-2v-2zM8 14h4v2H8v-2z'/%3E%3C/svg%3E";
    this.EXTENSIONS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2360a5fa'%3E%3Cpath d='M20 12a2 2 0 0 0-2-2h-1.26a4.96 4.96 0 0 0-.66-1.59l.89-.89a2 2 0 1 0-2.83-2.83l-.89.89A4.96 4.96 0 0 0 11.66 4V2a2 2 0 1 0-4 0v2H6a2 2 0 0 0-2 2v1.66a4.96 4.96 0 0 0-1.59.66l-.89-.89A2 2 0 0 0 .69 10.26l.89.89A4.96 4.96 0 0 0 1 12.74V14a2 2 0 0 0 2 2h1.26c.14.56.36 1.1.66 1.59l-.89.89a2 2 0 1 0 2.83 2.83l.89-.89c.49.3 1.03.52 1.59.66V22a2 2 0 1 0 4 0v-2h1.66a2 2 0 0 0 2-2v-1.26c.56-.14 1.1-.36 1.59-.66l.89.89a2 2 0 1 0 2.83-2.83l-.89-.89c.3-.49.52-1.03.66-1.59H18a2 2 0 0 0 2-2zM10 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z'/%3E%3C/svg%3E";

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

    this.SUSPEND_TIMEOUT = 5 * 60 * 1000; 
    setInterval(() => this.checkSuspension(), 60000);
  }

  _normalizeUrlForCompare(url) {
    return String(url || '').trim().toLowerCase();
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
      if (tab?.webview) this.applyYouTubeAddon(tab.webview);
    });
  }

  getYouTubeAddonConfig() {
    const cfg = this.settings?.adBlocker || {};
    return {
      enabled: cfg.youtubeAddonEnabled === true,
      hideShorts: cfg.ytHideShorts !== false,
      hideHomeSuggestions: cfg.ytHideHomeSuggestions !== false,
      blurThumbnails: cfg.ytBlurThumbnails === true,
      hideChats: cfg.ytHideChats === true,
      hideSubscribeButton: cfg.ytHideSubscribeButton === true,
      blackAndWhiteMode: cfg.ytBlackAndWhiteMode === true,
      cleanUi: cfg.ytCleanUi === true
    };
  }

  isYouTubeUrl(url = '') {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    } catch (e) {
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
          const blurAttr = 'data-omx-blur-thumbnails';
          const bwAttr = 'data-omx-yt-bw';
          const blurMarkerAttr = 'data-omx-thumb-blur';

          const state = window[stateKey] || (window[stateKey] = {});
          if (state.timer) clearInterval(state.timer);
          if (state.homeTimer) clearInterval(state.homeTimer);
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

          if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            (document.head || root).appendChild(style);
          }

          const rules = [];

          ${cfg.hideShorts ? `
          rules.push('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], a[href^="/shorts"], a[href*="/shorts/"], ytd-guide-entry-renderer a[href^="/shorts"], ytd-mini-guide-entry-renderer a[href^="/shorts"] { display: none !important; }');
          ` : ''}

          ${cfg.hideChats ? `
          rules.push('ytd-live-chat-frame, #chat, #chat-container, ytd-comments#comments, #comments, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] { display: none !important; }');
          ` : ''}

          ${cfg.hideSubscribeButton ? `
          rules.push('ytd-subscribe-button-renderer, yt-subscribe-button-view-model, #subscribe-button, #subscribe-button-shape, #owner-sub-count, tp-yt-paper-button.ytd-subscribe-button-renderer { display: none !important; }');
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

          ${cfg.cleanUi ? `
          rules.push('.ytp-chrome-controls, .ytp-chrome-top, .ytp-chrome-bottom, .ytp-right-controls, .ytp-bottom-row, .ytp-show-cards-button, .ytp-settings-button, .ytp-fullscreen-button, #info, #info-section, #meta-contents, #description, #description-inner, #top-row, #title, #container > #meta, ytd-video-secondary-info-renderer, ytd-watch-metadata, ytd-video-owner-renderer, ytd-channel-name, #owner, #owner-sub-count, #action-buttons, ytd-watch-next-secondary-results-renderer, ytd-watch-next-secondary-results-renderer #related, ytd-structured-description-content-renderer, yt-formatted-string[split-lines], ytd-engagement-panel-section-list-renderer { display: none !important; }');
          ` : ''}

          style.textContent = rules.join('\\n');

          if (${cfg.blurThumbnails}) {
            const thumbSelector = 'a#thumbnail, ytd-thumbnail, ytd-playlist-thumbnail, ytd-rich-grid-media, ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, ytd-shorts-lockup-view-model';
            const applyBlur = () => {
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
      const url = webview.getURL();
      if (!this.isYouTubeUrl(url)) return;
      const script = this.getYouTubeAddonScript(this.getYouTubeAddonConfig());
      await webview.executeJavaScript(script, true);
    } catch (e) {
      console.warn('[YouTube Addon] Script execution failed:', e?.message);
    }
  }

  getCosmeticAdblockCSS() {
    return `
      /* Core ad containers */
      iframe[src*="ads"],
      iframe[id*="google_ads"],
      iframe[name*="google_ads"],
      iframe[id^="aswift_"],
      .adsbygoogle,
      .ad-banner,
      .ad-wrapper,
      .ad-container,
      [aria-label="Advertisement"],
      [id^="div-gpt-ad"],
      amp-ad,
      #taboola-container,
      .outbrain-module,
      .sponsored-content,
      .sponsored,
      [data-ad],
      [data-ads],
      [data-ad-slot],
      [data-ad-unit],
      [data-adtype],
      [data-ad-provider] {
        display: none !important;
      }

      /* YouTube page-level ad surfaces (avoid player controls; keep skip button visible) */
      ytd-ad-slot-renderer,
      ytd-display-ad-renderer,
      ytd-promoted-video-renderer,
      ytd-companion-slot-renderer,
      ytd-action-companion-ad-renderer,
      ytd-in-feed-ad-layout-renderer {
        display: none !important;
      }

      /* Explicitly preserve core player surfaces to avoid false positives. */
      #movie_player,
      .html5-video-player,
      .html5-main-video,
      video.html5-main-video {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
    `;
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
    if (rawUrl.includes('security-defense.html')) {
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
      const safeUrl = encodeURIComponent(url);
      const safeReason = encodeURIComponent(reason || 'Blocked by Safety Policy');
      return `${this.SECURITY_DEFENSE_URL}?type=${type}&url=${safeUrl}&reason=${safeReason}`;
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
    const isImgStudio = finalUrl.includes('image-editor.html');
    const isTextStudio = finalUrl.includes('text-editor.html');
    const isHistoryPage = finalUrl.includes('history.html');
    const isGamesPage = finalUrl.includes('games.html');
    const isDefensePage = finalUrl.includes('security-defense.html');
    const isHomePage = finalUrl.includes('home.html');
    const isAIChatPage = finalUrl.includes('omni-chat.html');
    const isTodoPage = finalUrl.includes('todo.html');
    const isPdfViewerPage = finalUrl.includes('pdf-viewer.html');
    const isAISettingsPage = finalUrl.includes('ai-settings.html');
    const isScraberPage = finalUrl.includes('ai-settings.html#scraber') || finalUrl.includes('ai-settings.html#scraper');
    const isNeuralHubPage = finalUrl.includes('neural-hub.html');
    const isExtensionsPage = finalUrl.includes('extensions.html');
    const isMinecraftPage = finalUrl.includes('minecraft.html');
    const isServerOperatorPage = finalUrl.includes('server-operator.html');

    const { tabItem, titleEl, iconEl } = this.createTabUI(id, {
        isSystemPage, isImgStudio, isTextStudio, isHistoryPage, isGamesPage, isDefensePage,
        isHomePage, isAIChatPage, isTodoPage, isPdfViewerPage, isAISettingsPage, isScraberPage, isNeuralHubPage, isExtensionsPage, isMinecraftPage, isServerOperatorPage
    }, finalUrl);
    const tabState = {
      id, webview: null, tabItem, titleEl, iconEl, url: finalUrl,
      lastAccessed: Date.now(), suspended: false, isSystemPage, isImgStudio,
      isTextStudio, isHistoryPage, isGamesPage, isDefensePage,
      isHomePage, isAIChatPage, isTodoPage, isPdfViewerPage, isAISettingsPage, isScraberPage, isNeuralHubPage, isExtensionsPage, isMinecraftPage, isServerOperatorPage,
      isLoading: true, isMainFrameLoading: true, customIcon: false, audible: false,
      interactiveSearch: options.interactiveSearch || null
    };
    this.tabs.push(tabState);
    this.tabListContainer.appendChild(tabItem);
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
    else if (flags.isNeuralHubPage) { iconSrc = this.NEURAL_HUB_ICON; title = 'Neural Hub'; }
    else if (flags.isExtensionsPage) { iconSrc = this.EXTENSIONS_ICON; title = 'Extensions'; }
    else if (flags.isMinecraftPage) { iconSrc = this.MINECRAFT_ICON; title = 'Minecraft'; }
    else if (flags.isServerOperatorPage) { iconSrc = this.MINECRAFT_ICON; title = 'Server Operator'; }
    else if (flags.isSystemPage) { iconSrc = this.SETTINGS_ICON; title = 'System'; }
    else if (flags.isImgStudio) { iconSrc = this.IMAGE_STUDIO_ICON; title = 'Image Studio'; }
    else if (flags.isTextStudio) { iconSrc = this.TEXT_STUDIO_ICON; title = 'Text Studio'; }
    else if (flags.isHistoryPage) { iconSrc = this.HISTORY_ICON; title = 'History'; }
    else if (flags.isGamesPage) { iconSrc = this.GAMES_ICON; title = 'Games'; }
    else if (flags.isAIChatPage) { iconSrc = this.CHAT_ICON; title = 'AI Chat'; }
    else if (flags.isTodoPage) { iconSrc = this.TODO_ICON; title = 'Todo'; }
    else if (flags.isPdfViewerPage) { iconSrc = this.PDF_ICON; title = 'PDF Viewer'; }
    else if (flags.isScraberPage) { iconSrc = this.AI_SETTINGS_ICON; title = 'Scraber'; }
    else if (flags.isAISettingsPage) { iconSrc = this.AI_SETTINGS_ICON; title = 'AI Settings'; }
    else if (flags.isDefensePage) { iconSrc = this.SHIELD_ICON; title = 'Security Alert'; tabItem.classList.add('defense-tab'); }
    else {
      title = 'New Tab';
      iconSrc = this._createTabFallbackIcon(url, id, title);
      tabItem.title = 'New Tab';
    }
    const audioIcon = document.createElement('div');
    audioIcon.innerHTML = `<svg class="tab-audio-icon" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.1-.9-2-2-2s-2 .9-2 2v6c0 1.1.9 2 2 2z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
    const iconEl = document.createElement('img');
    iconEl.className = 'tab-favicon';
    iconEl.src = iconSrc;
    iconEl.onerror = () => { iconEl.src = this._createTabFallbackIcon(url, id, title); };
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = title;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerHTML = '<svg viewBox="0 0 12 12"><path d="M1 1l10 10M1 11L11 1" stroke="currentColor" stroke-width="2"/></svg>';
    closeBtn.onclick = (e) => { e.stopPropagation(); this.closeTab(id); };
    tabItem.appendChild(audioIcon.firstChild);
    tabItem.appendChild(iconEl);
    tabItem.appendChild(titleEl);
    tabItem.appendChild(closeBtn);
    tabItem.onclick = () => this.setActiveTab(id);
    tabItem.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.onTabContextMenu) this.onTabContextMenu(id, e.clientX, e.clientY);
    };
    return { tabItem, titleEl, iconEl };
  }

  createWebviewForTab(tabState) {
    const webview = document.createElement('webview');
    const trustedHostPage = this.isTrustedHostPageUrl(tabState.url);
    if (trustedHostPage) {
      webview.preload = this.PRELOAD_URL;
    }
    webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no, sandbox=yes');
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
            const cfg = this.settings?.adBlocker;
            if (cfg?.enabled !== false && cfg?.cosmeticFiltering !== false) {
                await webview.insertCSS(this.getCosmeticAdblockCSS());
            }
            const currentUrl = webview.getURL ? webview.getURL() : '';
            if (this.isYouTubeUrl(currentUrl)) {
                await this.applyYouTubeAddon(webview);
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
      // Get the selected animation from localStorage (default to 'pulse')
      const selectedAnimation = localStorage.getItem('loading_animation') || 'pulse';
      
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
        tabState.tabItem.classList.add('audible');
        this.updateMiniPlayerState(tabState, true);
    });
    webview.addEventListener('media-paused', () => {
        tabState.audible = false;
        tabState.tabItem.classList.remove('audible');
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
        if(!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage) {
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
       if (this.activeTabId === tabState.id && this.loader) {
           this.loader.classList.add('hidden');
           this._stopFindingAnimation();
       }
    });
    webview.addEventListener('page-title-updated', (e) => {
       if(!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage) {
           tabState.titleEl.textContent = e.title;
           tabState.tabItem.title = e.title;
           if (this.activeAudioTabId === tabState.id && this.playerTitle) this.playerTitle.textContent = e.title;
       }
    });
    webview.addEventListener('page-favicon-updated', (e) => {
       if (!tabState.customIcon && !tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage && e.favicons && e.favicons.length > 0) {
         tabState.iconEl.src = e.favicons[0];
         tabState.iconEl.style.visibility = 'visible';
       }
    });
    webview.addEventListener('did-navigate', (e) => {
      tabState.url = e.url; 
      if (!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage && !e.url.includes('html/pages/home.html') && !e.url.startsWith('data:') && !e.url.startsWith('file:')) {
          if (window.browserAPI && window.browserAPI.history) {
             window.browserAPI.history.push({
                 title: webview.getTitle() || e.url,
                 url: e.url, timestamp: Date.now(), favicon: tabState.iconEl.src
             });
          }
      }
      if (this.activeTabId === tabState.id) this.onTabStateChange(e.url, false);
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
           if (event.channel === 'run-html' || event.channel === 'open-tab' || event.channel === 'open-devtools') {
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
       }
    });
    webview.addEventListener('crashed', () => {
      tabState.titleEl.textContent = "Crashed";
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

  suspendTab(tab) {
      if (!tab.webview) return;
      try { tab.url = tab.webview.getURL(); tab.webview.blur(); } catch(e){}
      tab.webview.remove();
      tab.webview = null;
      tab.suspended = true;
      tab.tabItem.classList.add('suspended');
  }

  restoreTab(tab) {
      if (!tab.suspended) return;
      this.createWebviewForTab(tab);
  }

  closeTab(id) {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index === -1) return;
    const tab = this.tabs[index];
    if (this.activeAudioTabId === id) this.updateMiniPlayerState(null, false);
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
          tab.iconEl.style.visibility = 'visible';
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
        t.tabItem.classList.remove('active');
      }
    });
  }

  getActiveWebview() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    return tab ? tab.webview : null;
  }
}
