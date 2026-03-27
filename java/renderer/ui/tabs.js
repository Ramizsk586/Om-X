import { isBlocked, addToBlocklist, checkVirusTotal, checkKnownMaliciousPatterns } from '../block.js';

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
    this.omChatOrigins = new Set();
    
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
    this.SESSIONGUARD_SCRIPT_URL = new URL('../../sessionGuard.js', import.meta.url).href;
    this.TRUSTED_HOST_ROOTS = [
      new URL('../../../html/', import.meta.url).href
    ];
    this.OMX_ICON_URL = new URL('../../../assets/icons/app.ico', import.meta.url).href;
    this.OMCHAT_ICON_URL = new URL('../../../Om-chat/public/assets/omx-browser.png', import.meta.url).href;
    
    this.APP_ICON = this.OMX_ICON_URL;
    this.SETTINGS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l2.39-.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l0.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-0.24,1.13-0.56,1.62-0.94l2.39.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z'/%3E%3C/svg%3E";
    this.TEXT_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'/%3E%3C/svg%3E";
    this.HISTORY_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 6v5l4.28 2.54.72-1.21-3.5-2.08V9H12z'/%3E%3C/svg%3E";
    this.GAMES_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    this.DOWNLOADS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300c2ff'%3E%3Cpath d='M5 20h14v-2H5v2zm7-18v10.17l3.59-3.58L17 10l-5 5-5-5 1.41-1.41L11 12.17V2h1z'/%3E%3C/svg%3E";
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

    this.SUSPEND_TIMEOUT = 30 * 1000; // 30 seconds after leaving tab
    this.SUSPEND_CHECK_INTERVAL = 5 * 1000; // Check every 5 seconds
    setInterval(() => this.checkSuspension(), this.SUSPEND_CHECK_INTERVAL);
  }

  _normalizeUrlForCompare(url) {
    return String(url || '').trim().toLowerCase();
  }

  getSiteOrigin(url = '') {
    const value = String(url || '').trim();
    if (!value) return '';
    try {
      const parsed = new URL(value, window.location.href);
      if (!/^https?:$/i.test(parsed.protocol)) return '';
      return parsed.origin.toLowerCase();
    } catch (_) {
      return '';
    }
  }

  getStoredSitePermission(url = '', permission = '') {
    const origin = this.getSiteOrigin(url);
    const key = String(permission || '').trim().toLowerCase();
    if (!origin || !key) return '';
    const websitePermissions = this.settings?.websitePermissions;
    const decision = websitePermissions?.[origin]?.[key];
    return decision === 'allow' || decision === 'deny' ? decision : '';
  }

  getSitePermissionSnapshot(url = '') {
    const origin = this.getSiteOrigin(url);
    if (!origin) return {};
    const websitePermissions = this.settings?.websitePermissions;
    const stored = websitePermissions?.[origin];
    return stored && typeof stored === 'object' ? { ...stored } : {};
  }

  async applySitePermissions(webview, url = '') {
    if (!webview) return;
    const currentUrl = String(url || (webview.getURL ? webview.getURL() : '') || '').trim();
    const sitePermissions = this.getSitePermissionSnapshot(currentUrl);
    const soundDecision = this.getStoredSitePermission(currentUrl, 'sound');
    const muteAudio = soundDecision === 'deny';

    try {
      if (typeof webview.setAudioMuted === 'function') {
        webview.setAudioMuted(muteAudio);
      }
    } catch (_) {}

    if (!webview.executeJavaScript) return;
    try {
      await webview.executeJavaScript(`
        (() => {
          const permissions = ${JSON.stringify(sitePermissions)};
          const mute = ${muteAudio ? 'true' : 'false'};
          const deny = (key) => permissions[key] === 'deny';
          const blockedError = (name, message) => {
            try {
              return new DOMException(message, name);
            } catch (_) {
              const error = new Error(message);
              error.name = name;
              return error;
            }
          };

          const media = document.querySelectorAll('audio, video');
          media.forEach((element) => {
            element.muted = mute;
            if (mute) {
              element.setAttribute('muted', '');
            } else {
              element.removeAttribute('muted');
            }
          });
          window.__omxSiteSoundBlocked = mute;

          if (deny('fullscreen')) {
            try {
              const blockFullscreen = function blockFullscreen() {
                return Promise.reject(blockedError('NotAllowedError', 'Fullscreen is blocked for this site.'));
              };
              if (Document.prototype.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch?.(() => {});
              }
              if (Element.prototype.requestFullscreen) Element.prototype.requestFullscreen = blockFullscreen;
            } catch (_) {}
          }

          if (deny('pointer-lock')) {
            try {
              if (document.pointerLockElement && document.exitPointerLock) {
                document.exitPointerLock();
              }
              if (Element.prototype.requestPointerLock) {
                Element.prototype.requestPointerLock = function requestPointerLock() {};
              }
            } catch (_) {}
          }

          if (deny('clipboard')) {
            try {
              const clipboardApi = navigator.clipboard || {};
              navigator.clipboard = {
                ...clipboardApi,
                read: () => Promise.reject(blockedError('NotAllowedError', 'Clipboard access is blocked for this site.')),
                readText: () => Promise.reject(blockedError('NotAllowedError', 'Clipboard access is blocked for this site.')),
                write: () => Promise.reject(blockedError('NotAllowedError', 'Clipboard access is blocked for this site.')),
                writeText: () => Promise.reject(blockedError('NotAllowedError', 'Clipboard access is blocked for this site.'))
              };
            } catch (_) {}
            ['copy', 'cut', 'paste'].forEach((eventName) => {
              window.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
              }, true);
            });
          }

          if (deny('geolocation')) {
            try {
              if (navigator.geolocation) {
                const blockGeo = (errorCallback) => {
                  if (typeof errorCallback === 'function') {
                    errorCallback({ code: 1, message: 'Geolocation is blocked for this site.' });
                  }
                };
                navigator.geolocation.getCurrentPosition = (_success, errorCallback) => blockGeo(errorCallback);
                navigator.geolocation.watchPosition = (_success, errorCallback) => {
                  blockGeo(errorCallback);
                  return 0;
                };
              }
            } catch (_) {}
          }

          if (navigator.mediaDevices) {
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);
            const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);
            if (originalGetUserMedia && (deny('camera') || deny('microphone'))) {
              navigator.mediaDevices.getUserMedia = (constraints = {}) => {
                const wantsAudio = constraints === true || !!constraints?.audio;
                const wantsVideo = constraints === true || !!constraints?.video;
                if ((wantsAudio && deny('microphone')) || (wantsVideo && deny('camera'))) {
                  return Promise.reject(blockedError('NotAllowedError', 'Media capture is blocked for this site.'));
                }
                return originalGetUserMedia(constraints);
              };
            }
            if (originalGetDisplayMedia && deny('display-capture')) {
              navigator.mediaDevices.getDisplayMedia = () => Promise.reject(blockedError('NotAllowedError', 'Screen capture is blocked for this site.'));
            }
          }

          if (deny('notifications')) {
            try {
              if (typeof window.Notification === 'function') {
                window.Notification.requestPermission = () => Promise.resolve('denied');
                Object.defineProperty(window.Notification, 'permission', {
                  configurable: true,
                  get: () => 'denied'
                });
              }
            } catch (_) {}
          }

          if (deny('midi') || deny('midi-sysex')) {
            try {
              if (typeof navigator.requestMIDIAccess === 'function') {
                const originalRequestMidIAccess = navigator.requestMIDIAccess.bind(navigator);
                navigator.requestMIDIAccess = (options = {}) => {
                  if (deny('midi') || (options?.sysex && deny('midi-sysex'))) {
                    return Promise.reject(blockedError('NotAllowedError', 'MIDI access is blocked for this site.'));
                  }
                  return originalRequestMidIAccess(options);
                };
              }
            } catch (_) {}
          }

          if (deny('storage-access') || deny('top-level-storage-access')) {
            try {
              if (typeof document.requestStorageAccess === 'function') {
                document.requestStorageAccess = () => Promise.reject(blockedError('NotAllowedError', 'Storage access is blocked for this site.'));
              }
              if (typeof document.hasStorageAccess === 'function') {
                document.hasStorageAccess = () => Promise.resolve(false);
              }
            } catch (_) {}
          }

          if (deny('window-management')) {
            try {
              if (typeof window.getScreenDetails === 'function') {
                window.getScreenDetails = () => Promise.reject(blockedError('NotAllowedError', 'Window management is blocked for this site.'));
              }
            } catch (_) {}
          }

          if (deny('fonts')) {
            try {
              if (typeof window.queryLocalFonts === 'function') {
                window.queryLocalFonts = () => Promise.reject(blockedError('NotAllowedError', 'Local font access is blocked for this site.'));
              }
            } catch (_) {}
          }

          if (deny('your-device-use')) {
            try {
              if (typeof IdleDetector !== 'undefined' && IdleDetector?.requestPermission) {
                IdleDetector.requestPermission = () => Promise.resolve('denied');
              }
            } catch (_) {}
          }
        })();
      `, true);
    } catch (_) {}
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

  registerOmChatOrigin(origin) {
    const safe = String(origin || '').trim();
    if (!safe) return;
    this.omChatOrigins.add(safe);
  }

  isOmChatUrl(url = '') {
    const raw = String(url || '').trim();
    if (!raw) return false;
    try {
      const parsed = new URL(raw, window.location.href);
      if (this.omChatOrigins.has(parsed.origin)) return true;
      const pathname = String(parsed.pathname || '').toLowerCase();
      const host = String(parsed.hostname || '').toLowerCase();
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
      return isLocal && (pathname.endsWith('/app.html') || pathname.endsWith('/e2e-setup.html'));
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
      return this.TRUSTED_HOST_ROOTS.some((root) => {
        const normalizedRoot = this._normalizeUrlForCompare(root);
        return normalizedUrl.startsWith(normalizedRoot);
      });
    } catch (_) {
      return false;
    }
  }

  isBlockedGuestNavigation(currentUrl = '', nextUrl = '') {
    const senderUrl = String(currentUrl || '').trim();
    const destinationUrl = String(nextUrl || '').trim();
    if (!senderUrl || !destinationUrl) return false;
    if (this.isTrustedHostPageUrl(senderUrl)) return false;
    try {
      const parsed = new URL(destinationUrl, window.location.href);
      return String(parsed.protocol || '').toLowerCase() === 'file:';
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
      tab.webview.setAttribute('allowpopups', 'no');
      this.applySitePermissions(tab.webview, tab.webview.getURL ? tab.webview.getURL() : tab.url);
      if (!tab.domReady) return;
      this.applyGlobalWebsiteCss(tab.webview);
      this.applyYouTubeAddon(tab.webview);
      this.applyFloatingAdBlocker(tab.webview);
      this.applyDuckAiSidebarPreference(tab.webview);
      this.applyVyntrSearchCleanup(tab.webview);
    });
  }

  getYouTubeAddonConfig() {
    const cfg = this.settings?.youtubeAddon || {};
    return {
      enabled: cfg.enabled === true,
      cleanUi: cfg.cleanUi === true,
      blurThumbnails: cfg.blurThumbnails === true,
      hideChats: cfg.hideChats === true,
      blackAndWhiteMode: cfg.blackAndWhiteMode === true,
      adSkipper: cfg.adSkipper === true
    };
  }

  getYouTubeAddonCss(config = {}) {
    if (!config?.enabled) return '';

    const cleanUiAttr = 'data-omx-yt-clean-ui';
    const blurAttr = 'data-omx-blur-thumbnails';
    const bwAttr = 'data-omx-yt-bw';
    const rules = [];

    if (config.hideChats) {
      rules.push('ytd-live-chat-frame, #chat, #chat-container, ytd-comments#comments, #comments, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] { display: none !important; }');
    }

    if (config.blackAndWhiteMode) {
      rules.push(`html[${bwAttr}="1"] { filter: grayscale(1) !important; }`);
    }

    if (config.blurThumbnails) {
      rules.push(`html[${blurAttr}="1"] a#thumbnail yt-image, html[${blurAttr}="1"] a#thumbnail img, html[${blurAttr}="1"] ytd-thumbnail yt-image, html[${blurAttr}="1"] ytd-thumbnail img, html[${blurAttr}="1"] ytd-video-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-video-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-grid-video-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-grid-video-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-rich-item-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-rich-item-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-compact-video-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-compact-video-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-playlist-video-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-playlist-video-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-reel-item-renderer a#thumbnail yt-image, html[${blurAttr}="1"] ytd-reel-item-renderer a#thumbnail img, html[${blurAttr}="1"] ytd-shorts-lockup-view-model a#thumbnail yt-image, html[${blurAttr}="1"] ytd-shorts-lockup-view-model a#thumbnail img { filter: blur(12px) !important; }`);
    }

    if (config.cleanUi) {
      rules.push(`
/* ══════════════════════════════════════════════════════
   Clean UI - Fullscreen centered video with auto-sizing
   ══════════════════════════════════════════════════════ */

/* Hide all UI elements */
html[${cleanUiAttr}="1"] ytd-masthead,
html[${cleanUiAttr}="1"] #guide,
html[${cleanUiAttr}="1"] tp-yt-app-drawer,
html[${cleanUiAttr}="1"] #secondary,
html[${cleanUiAttr}="1"] #secondary-inner,
html[${cleanUiAttr}="1"] ytd-watch-next-secondary-results-renderer,
html[${cleanUiAttr}="1"] #related,
html[${cleanUiAttr}="1"] #below,
html[${cleanUiAttr}="1"] #meta,
html[${cleanUiAttr}="1"] #meta-contents,
html[${cleanUiAttr}="1"] #info,
html[${cleanUiAttr}="1"] #info-section,
html[${cleanUiAttr}="1"] #description,
html[${cleanUiAttr}="1"] #description-inner,
html[${cleanUiAttr}="1"] #comments,
html[${cleanUiAttr}="1"] ytd-comments,
html[${cleanUiAttr}="1"] ytd-watch-metadata,
html[${cleanUiAttr}="1"] ytd-video-secondary-info-renderer,
html[${cleanUiAttr}="1"] ytd-video-owner-renderer,
html[${cleanUiAttr}="1"] ytd-structured-description-content-renderer,
html[${cleanUiAttr}="1"] ytd-engagement-panel-section-list-renderer,
html[${cleanUiAttr}="1"] ytd-playlist-panel-renderer,
html[${cleanUiAttr}="1"] ytd-merch-shelf-renderer,
html[${cleanUiAttr}="1"] ytd-reel-shelf-renderer,
html[${cleanUiAttr}="1"] .ytp-endscreen-content,
html[${cleanUiAttr}="1"] .ytp-ce-element,
html[${cleanUiAttr}="1"] .ytp-upnext,
html[${cleanUiAttr}="1"] .ytp-pause-overlay {
  display: none !important;
}

/* Hide scrollbar - let YouTube ambient mode show through */
html[${cleanUiAttr}="1"],
html[${cleanUiAttr}="1"] body,
html[${cleanUiAttr}="1"] ytd-app,
html[${cleanUiAttr}="1"] #content,
html[${cleanUiAttr}="1"] #page-manager,
html[${cleanUiAttr}="1"] ytd-watch-flexy,
html[${cleanUiAttr}="1"] #columns,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] {
  overflow: hidden !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

/* Clear YouTube's default dark surfaces so ambient can fill the full page */
html[${cleanUiAttr}="1"],
html[${cleanUiAttr}="1"] body,
html[${cleanUiAttr}="1"] ytd-app,
html[${cleanUiAttr}="1"] #content,
html[${cleanUiAttr}="1"] #page-manager,
html[${cleanUiAttr}="1"] ytd-watch-flexy,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy],
html[${cleanUiAttr}="1"] ytd-watch-flexy[theater],
html[${cleanUiAttr}="1"] ytd-watch-flexy[fullscreen],
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #columns,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #primary,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #primary-inner,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #full-bleed-container,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player-full-bleed-container,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player-container-outer,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player-container-inner,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #cinematics,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] .html5-video-player,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] .html5-video-container {
  background: transparent !important;
}

html[${cleanUiAttr}="1"],
html[${cleanUiAttr}="1"] body,
html[${cleanUiAttr}="1"] ytd-app {
  --yt-spec-base-background: transparent !important;
  --yt-spec-raised-background: transparent !important;
  --yt-spec-general-background-a: transparent !important;
  --yt-spec-general-background-b: transparent !important;
  --yt-spec-general-background-c: transparent !important;
  --ytd-app-background: transparent !important;
}

/* Enable YouTube ambient mode - let the blurred video colors show as background */
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] {
  height: 100vh !important;
  width: 100vw !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
  /* Let YouTube's ambient gradient show - don't override background */
}

/* Flexbox center the video - allow ambient to fill page */
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #columns {
  height: 100vh !important;
  width: 100vw !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin: 0 !important;
  padding: clamp(10px, 2vw, 32px) !important;
  box-sizing: border-box !important;
  overflow: visible !important;
  background: transparent !important;
}

/* Enable ambient mode on primary */
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #primary {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  float: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: visible !important;
  position: relative !important;
  z-index: 1 !important;
}

/* Primary column - responsive */
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #primary {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  float: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}

html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #primary-inner {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}

/* Player containers - auto resize with window */
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #full-bleed-container,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player-full-bleed-container,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player-container-outer {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  margin: 0 !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* Video player with rounded corners - maintains distance from edges */
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player-container-inner,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #player-theater-container,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #movie_player,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] .html5-video-player,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] .html5-video-container {
  width: calc(100% - clamp(20px, 4vw, 64px)) !important;
  height: calc(100% - clamp(20px, 4vw, 64px)) !important;
  max-width: calc(100% - clamp(20px, 4vw, 64px)) !important;
  max-height: calc(100% - clamp(20px, 4vw, 64px)) !important;
  margin: auto !important;
  border-radius: 16px !important;
  overflow: hidden !important;
  background: transparent !important;
  box-shadow: none !important;
}

html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #cinematics::before,
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] #cinematics::after {
  opacity: 1 !important;
}

/* Video element - responsive */
html[${cleanUiAttr}="1"] ytd-watch-flexy[flexy] video.html5-main-video {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
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

  // ── Floating Ad Blocker ────────────────────────────────────────────────────
  // Targets sticky/fixed/absolute overlays, pop-ups and interstitials on any
  // website EXCEPT YouTube (which has its own addon pipeline).
  // Inline content ads are left alone — only layout-disrupting floaters are removed.

  getAdBlockerSettings() {
    const ab = this.settings?.adBlocker || {};
    return {
      enabled: ab.enabled === true,           // OFF by default
      blockPopups: ab.blockPopups === true,
      blockFloating: ab.blockFloating === true,
      blockBanners: ab.blockBanners === true,
      blockVideoAds: ab.blockVideoAds === true,
      blockSocialAds: ab.blockSocialAds === true,
      blockTrackers: ab.blockTrackers === true,
      cleanSearchEngines: ab.cleanSearchEngines === true
    };
  }

  getFloatingAdBlockerConfig() {
    const ab = this.getAdBlockerSettings();
    return {
      enabled: ab.enabled && ab.blockFloating
    };
  }

  getFloatingAdBlockerCss() {
    return `
/* ══════════════════════════════════════════════════════
   OMX Ad Blocker v5 — Precision CSS Layer
   Targets: floating overlays, known ad network containers,
   inline banner networks, cookie walls, promo sides,
   trackers, analytics, OEM telemetry, and modern ad formats
   ══════════════════════════════════════════════════════ */

/* ── Google Ads / DFP / AdSense ── */
ins.adsbygoogle,
[id*="google_ads_iframe"],
[id*="div-gpt-ad"],
[id^="aswift_"],
[id^="google_ads_frame"],
[class*="adsbygoogle"],
[class*="GoogleActiveViewElement"],
iframe[src*="googlesyndication.com"],
iframe[src*="doubleclick.net"],
iframe[src*="googleadservices.com"],
iframe[src*="adservice.google.com"],
iframe[id*="google_ads"],
iframe[src*="pagead2.googlesyndication.com"],
iframe[src*="afs.googlesyndication.com"] { display: none !important; }

/* ── Modern Programmatic / Prebid / Header Bidding ── */
[id*="google_ads"],
[id*="ad-slot"],
[id*="ad-slot-"],
[class*="ad-slot"],
[class*="ad-slot-"],
div[id^="div-gpt-ad"],
div[id^="adngin-"],
div[id^="ad-slot"],
div[data-google-query-id],
div[data-ad],
div[data-ads],
div[data-ad-slot],
div[data-ad-unit],
div[data-ad-placement],
div[data-ad-refresh],
div[data-google-av-cxn],
div[data-google-av-adk],
div[data-google-av-override],
div[data-google-av-dm],
div[data-google-av-immediate],
div[data-google-av-itpl],
div[data-google-av-slap],
div[data-google-av-cpmav],
div[data-google-av-bocab],
div[data-google-av-override],
div[data-google-av-flags],
div[data-google-av-ufs-integrator-metadata],
/* Sticky footer/header ads */
[class*="sticky-footer-ad"],
[class*="sticky-header-ad"],
[class*="fixed-bottom-ad"],
[class*="fixed-top-ad"],
[class*="bottom-fixed-ad"],
[class*="top-fixed-ad"],
[class*="adhesion-ad"],
[class*="adhesion-unit"],
[class*="anchor-ad"],
[class*="dock-ad"],
/* In-article/native ads */
[class*="in-article-ad"],
[class*="in-article-ad-"],
[class*="infeed-ad"],
[class*="infeed"],
[class*="native-ad"],
[class*="native-ad-"],
[class*="native_ad"],
[class*="recommendation-widget"],
[class*="recommendation-unit"],
[class*="content-recommendation"],
[class*="sponsored-content"],
[class*="sponsored-post"],
[class*="promoted-content"],
[class*="promoted-post"],
/* Video ads */
[class*="video-ad"],
[class*="video-ad-"],
[class*="preroll-ad"],
[class*="midroll-ad"],
[class*="postroll-ad"],
[class*="overlay-ad-video"],
[class*="vast-ad"],
/* Interstitial / full-screen ads */
[class*="interstitial-ad"],
[class*="interstitial-ad-"],
[class*="fullscreen-ad"],
[class*="full-screen-ad"],
[class*="takeover-ad"],
[class*="skin-ad"],
/* Survey/reward walls */
[class*="survey-wall"],
[class*="reward-wall"],
[class*="offerwall"],
[class*="offer-wall"] { display: none !important; }

/* ── Taboola ── */
[id*="taboola"],
[class*="taboola"],
div[data-widget-id*="taboola"],
#taboola-below-article-thumbnails,
.trc_related_container { display: none !important; }

/* ── Outbrain ── */
[id*="outbrain"],
[class*="outbrain"],
.OUTBRAIN,
div[data-widget-id*="outbrain"] { display: none !important; }

/* ── Amazon / Affiliates ── */
iframe[src*="amazon-adsystem.com"],
iframe[src*="assoc-amazon.com"],
[class*="amzn-native-ad"],
iframe[src*="adtago.s3.amazonaws.com"],
iframe[src*="advice-ads.s3.amazonaws.com"] { display: none !important; }

/* ── Major Ad Networks ── */
iframe[src*="openx.net"],
iframe[src*="adnxs.com"],
iframe[src*="criteo.com"],
iframe[src*="rubiconproject.com"],
iframe[src*="pubmatic.com"],
iframe[src*="33across.com"],
iframe[src*="casalemedia.com"],
iframe[src*="smartadserver.com"],
iframe[src*="adform.net"],
iframe[src*="moatads.com"],
iframe[src*="yieldmo.com"],
iframe[src*="sharethrough.com"],
iframe[src*="teads.tv"],
iframe[src*="outbrain.com"],
iframe[src*="taboolasyndication.com"],
iframe[src*="advmaker"],
iframe[src*="adngin"],
iframe[src*="advertising.com"],
iframe[src*="media.net"],
iframe[src*="bidswitch.net"],
iframe[src*="rhythmone.com"],
iframe[src*="undertone.com"],
iframe[src*="yandex.ru/ads"],
iframe[src*="an.yandex.ru"],
iframe[src*="yandex.net"],
iframe[src*="ads.yahoo.com"],
iframe[src*="ads.twitter.com"],
iframe[src*="ads.linkedin.com"],
iframe[src*="ads.pinterest.com"] { display: none !important; }

/* ── AdColony / Unity Ads / Gaming Ads ── */
iframe[src*="adcolony.com"],
iframe[src*="unityads.unity3d.com"],
iframe[src*="ads30.adcolony.com"],
iframe[src*="adc3-launch.adcolony.com"],
iframe[src*="wd.adcolony.com"],
iframe[src*="events3alt.adcolony.com"] { display: none !important; }

/* ── Social Trackers / Pixels ── */
iframe[src*="facebook.com/tr"],
iframe[src*="connect.facebook.net"],
iframe[src*="pixel.facebook.com"],
iframe[src*="an.facebook.com"],
iframe[src*="static.ads-twitter.com"],
iframe[src*="ads-api.twitter.com"],
iframe[src*="analytics.pointdrive.linkedin.com"],
iframe[src*="log.pinterest.com"],
iframe[src*="trk.pinterest.com"],
iframe[src*="events.reddit.com"],
iframe[src*="events.redditmedia.com"],
iframe[src*="ads.youtube.com"],
iframe[src*="ads.tiktok.com"],
iframe[src*="ads-sg.tiktok.com"],
iframe[src*="ads-api.tiktok.com"],
iframe[src*="business-api.tiktok.com"],
iframe[src*="analytics.tiktok.com"] { display: none !important; }

/* ── Analytics & Tracking Scripts ── */
iframe[src*="hotjar.com"],
iframe[src*="hotjar.io"],
iframe[src*="mouseflow.com"],
iframe[src*="luckyorange.com"],
iframe[src*="clarity.ms"],
iframe[src*="sentry.io"],
iframe[src*="bugsnag.com"],
iframe[src*="google-analytics.com"],
iframe[src*="analytics.google.com"],
iframe[src*="ssl.google-analytics.com"],
iframe[src*="click.googleanalytics.com"],
iframe[src*="yandex.ru/metrika"],
iframe[src*="appmetrica.yandex.ru"],
iframe[src*="extmaps-api.yandex.net"],
iframe[src*="offerwall.yandex.net"],
iframe[src*="adfox.yandex.ru"],
iframe[src*="stats.wp.com"] { display: none !important; }

/* ── OEM Telemetry ── */
iframe[src*="samsungads.com"],
iframe[src*="smetrics.samsung.com"],
iframe[src*="nmetrics.samsung.com"],
iframe[src*="samsung-com.112.2o7.net"],
iframe[src*="analytics-api.samsunghealthcn.com"],
iframe[src*="iadsdk.apple.com"],
iframe[src*="metrics.icloud.com"],
iframe[src*="api-adservices.apple.com"],
iframe[src*="data.mistat.xiaomi.com"],
iframe[src*="data.mistat.india.xiaomi.com"],
iframe[src*="data.mistat.rus.xiaomi.com"],
iframe[src*="sdkconfig.ad.xiaomi.com"],
iframe[src*="sdkconfig.ad.intl.xiaomi.com"],
iframe[src*="tracking.rus.miui.com"],
iframe[src*="api.ad.xiaomi.com"],
iframe[src*="adsfs.oppomobile.com"],
iframe[src*="adx.ads.oppomobile.com"],
iframe[src*="ck.ads.oppomobile.com"],
iframe[src*="data.ads.oppomobile.com"],
iframe[src*="click.oneplus.cn"],
iframe[src*="open.oneplus.net"],
iframe[src*="metrics.data.hicloud.com"],
iframe[src*="metrics2.data.hicloud.com"],
iframe[src*="grs.hicloud.com"],
iframe[src*="logservice.hicloud.com"],
iframe[src*="logbak.hicloud.com"],
iframe[src*="bdapi-in-ads.realmemobile.com"],
iframe[src*="bdapi-ads.realmemobile.com"],
iframe[src*="iot-logser.realme.com"],
iframe[src*="iot-eu-logser.realme.com"] { display: none !important; }

/* ── All JSON-scan false hosts — exhaustive explicit rules ─────────── */
/* Amazon S3 ad buckets */
iframe[src*="advice-ads.s3.amazonaws.com"],
iframe[src*="adtago.s3.amazonaws.com"],
iframe[src*="analyticsengine.s3.amazonaws.com"],
iframe[src*="analytics.s3.amazonaws.com"],
/* Google Ads exact subdomains */
iframe[src*="pagead2.googlesyndication.com"],
iframe[src*="afs.googlesyndication.com"],
iframe[src*="pagead2.googleadservices.com"],
iframe[src*="adservice.google.com"],
/* Doubleclick exact subdomains */
iframe[src*="stats.g.doubleclick.net"],
iframe[src*="m.doubleclick.net"],
iframe[src*="static.doubleclick.net"],
iframe[src*="ad.doubleclick.net"],
iframe[src*="mediavisor.doubleclick.net"],
/* AdColony */
iframe[src*="wd.adcolony.com"],
iframe[src*="ads30.adcolony.com"],
iframe[src*="adc3-launch.adcolony.com"],
iframe[src*="events3alt.adcolony.com"],
/* Media.net */
iframe[src*="static.media.net"],
iframe[src*="adservetx.media.net"],
/* Google Analytics */
iframe[src*="google-analytics.com"],
iframe[src*="ssl.google-analytics.com"],
iframe[src*="analytics.google.com"],
iframe[src*="click.googleanalytics.com"],
/* Hotjar exact subdomains */
iframe[src*="adm.hotjar.com"],
iframe[src*="surveys.hotjar.com"],
iframe[src*="insights.hotjar.com"],
iframe[src*="script.hotjar.com"],
iframe[src*="identify.hotjar.com"],
iframe[src*="careers.hotjar.com"],
iframe[src*="events.hotjar.io"],
/* MouseFlow */
iframe[src*="cdn.mouseflow.com"],
iframe[src*="gtm.mouseflow.com"],
iframe[src*="api.mouseflow.com"],
iframe[src*="o2.mouseflow.com"],
iframe[src*="tools.mouseflow.com"],
iframe[src*="cdn-test.mouseflow.com"],
/* FreshMarketer */
iframe[src*="claritybt.freshmarketer.com"],
iframe[src*="fwtracks.freshmarketer.com"],
iframe[src*="freshmarketer.com"],
/* Lucky Orange */
iframe[src*="w1.luckyorange.com"],
iframe[src*="realtime.luckyorange.com"],
iframe[src*="api.luckyorange.com"],
iframe[src*="cdn.luckyorange.com"],
iframe[src*="upload.luckyorange.net"],
iframe[src*="cs.luckyorange.net"],
iframe[src*="settings.luckyorange.net"],
/* Bugsnag / Sentry CDN */
iframe[src*="notify.bugsnag.com"],
iframe[src*="sessions.bugsnag.com"],
iframe[src*="api.bugsnag.com"],
iframe[src*="app.bugsnag.com"],
iframe[src*="browser.sentry-cdn.com"],
iframe[src*="sentry-cdn.com"],
iframe[src*="app.getsentry.com"],
/* Facebook */
iframe[src*="an.facebook.com"],
iframe[src*="pixel.facebook.com"],
/* Twitter */
iframe[src*="ads-api.twitter.com"],
iframe[src*="static.ads-twitter.com"],
/* LinkedIn */
iframe[src*="ads.linkedin.com"],
iframe[src*="analytics.pointdrive.linkedin.com"],
/* Pinterest */
iframe[src*="log.pinterest.com"],
iframe[src*="trk.pinterest.com"],
iframe[src*="ads.pinterest.com"],
/* Reddit */
iframe[src*="events.reddit.com"],
iframe[src*="events.redditmedia.com"],
/* YouTube ads */
iframe[src*="ads.youtube.com"],
/* TikTok */
iframe[src*="analytics.tiktok.com"],
iframe[src*="ads-api.tiktok.com"],
iframe[src*="ads-sg.tiktok.com"],
iframe[src*="ads.tiktok.com"],
iframe[src*="business-api.tiktok.com"],
iframe[src*="analytics-sg.tiktok.com"],
iframe[src*="log.byteoversea.com"],
/* Yahoo */
iframe[src*="ads.yahoo.com"],
iframe[src*="log.fc.yahoo.com"],
iframe[src*="udcm.yahoo.com"],
iframe[src*="geo.yahoo.com"],
iframe[src*="analytics.yahoo.com"],
iframe[src*="analytics.query.yahoo.com"],
iframe[src*="partnerads.ysm.yahoo.com"],
iframe[src*="gemini.yahoo.com"],
iframe[src*="adtech.yahooinc.com"],
/* Yandex */
iframe[src*="adfstat.yandex.ru"],
iframe[src*="appmetrica.yandex.ru"],
iframe[src*="metrika.yandex.ru"],
iframe[src*="extmaps-api.yandex.net"],
iframe[src*="offerwall.yandex.net"],
iframe[src*="adfox.yandex.ru"],
/* Unity Ads */
iframe[src*="webview.unityads.unity3d.com"],
iframe[src*="config.unityads.unity3d.com"],
iframe[src*="adserver.unityads.unity3d.com"],
iframe[src*="auction.unityads.unity3d.com"],
/* Apple */
iframe[src*="metrics.mzstatic.com"],
iframe[src*="iadsdk.apple.com"],
iframe[src*="metrics.icloud.com"],
iframe[src*="api-adservices.apple.com"],
iframe[src*="books-analytics-events.apple.com"],
iframe[src*="notes-analytics-events.apple.com"],
iframe[src*="weather-analytics-events.apple.com"],
/* Samsung */
iframe[src*="smetrics.samsung.com"],
iframe[src*="nmetrics.samsung.com"],
iframe[src*="samsung-com.112.2o7.net"],
iframe[src*="analytics-api.samsunghealthcn.com"],
/* Stats WP */
iframe[src*="stats.wp.com"] { display: none !important; }

/* ── script[src] — blocks CDN-served tracker/ad JS before it executes ── */
script[src*="googlesyndication.com"],
script[src*="googleadservices.com"],
script[src*="pagead2.googlesyndication.com"],
script[src*="pagead2.googleadservices.com"],
script[src*="afs.googlesyndication.com"],
script[src*="doubleclick.net"],
script[src*="ad.doubleclick.net"],
script[src*="google-analytics.com"],
script[src*="ssl.google-analytics.com"],
script[src*="analytics.google.com"],
script[src*="googletagmanager.com"],
script[src*="googletagservices.com"],
script[src*="adservice.google.com"],
script[src*="hotjar.com"],
script[src*="script.hotjar.com"],
script[src*="events.hotjar.io"],
script[src*="cdn.mouseflow.com"],
script[src*="mouseflow.com"],
script[src*="luckyorange.com"],
script[src*="clarity.ms"],
script[src*="browser.sentry-cdn.com"],
script[src*="sentry-cdn.com"],
script[src*="bugsnag.com"],
script[src*="connect.facebook.net"],
script[src*="static.ads-twitter.com"],
script[src*="ads.linkedin.com"],
script[src*="analytics.tiktok.com"],
script[src*="tiktok.com"],
script[src*="log.byteoversea.com"],
script[src*="yandex.ru"],
script[src*="yandex.net"],
script[src*="metrika.yandex.ru"],
script[src*="unityads.unity3d.com"],
script[src*="adcolony.com"],
script[src*="taboolasyndication.com"],
script[src*="taboola.com"],
script[src*="outbrain.com"],
script[src*="media.net"],
script[src*="adservetx.media.net"],
script[src*="static.media.net"],
script[src*="freshmarketer.com"],
script[src*="fwtracks.freshmarketer.com"],
script[src*="stats.wp.com"] { display: none !important; }

/* ── Generic floating / sticky overlays ── */
[id*="adngin-"],
[id*="AdSlot"],
[class*="advert-overlay"], [class*="ad-overlay"],
[class*="ad-float"],       [class*="ad-sticky"],
[class*="ads-sticky"],     [class*="sticky-ad"],
[class*="sticky-ads"],     [class*="float-ad"],
[class*="floating-ad"],    [class*="floatingAd"],
[class*="FloatingAd"],     [class*="ad-popup"],
[class*="adPopup"],        [class*="ad-modal"],
[class*="adModal"],        [class*="popunder"],
[class*="pop-under"],      [class*="interstitial-ad"],
[class*="interstitialAd"], [class*="overlay-ad"],
[class*="overlayAd"],      [class*="banner-fixed"],
[class*="fixed-banner"],   [class*="fixed-ad"],
[class*="fixedAd"],        [class*="bottom-ad"],
[class*="bottomAd"],       [class*="top-ad-bar"],
[class*="topAdBar"],       [class*="sidebar-ad"],
[class*="sidebarAd"],      [class*="right-ad"],
[class*="rightAd"],        [class*="promo-box"],
[class*="promoBox"],       [class*="ad-container"],
[class*="adContainer"],    [class*="ad-wrapper"],
[class*="adWrapper"],      [class*="ad-unit"],
[class*="adUnit"],         [class*="advertisement"],
/* Modern programmatic / header-bidding wrappers */
[class*="gpt-ad"],         [class*="dfp-ad"],
[class*="prebid"],         [class*="header-bidding"],
[class*="adngin"],         [class*="ezoic"],
[class*="mediavine"],      [class*="raptive"],
[class*="adthrive"],       [class*="setupad"],
[class*="taboola-widget"], [class*="outbrain-widget"],
[class*="mgid-widget"],    [class*="revcontent"],
/* React/Next.js ad components often use data-* attrs */
[data-testid*="ad"],       [data-testid*="advertisement"],
[data-testid*="sponsor"],  [data-testid*="promoted"],
[data-component*="ad"],    [data-module*="ad"],
[data-slot*="ad"],         [data-placement*="ad"],
[aria-label*="advertisement"], [aria-label*="sponsored"],
[id*="sticky-ad"],   [id*="stickyAd"],   [id*="sticky_ad"],
[id*="float-ad"],    [id*="floatAd"],    [id*="floating_ad"],
[id*="floatingAd"],  [id*="ad-overlay"], [id*="adOverlay"],
[id*="ad-popup"],    [id*="adPopup"],    [id*="ad-modal"],
[id*="interstitial"],[id*="bottom-banner-ad"], [id*="fixed-ad"],
[id*="sidebar-ad"],  [id*="ad-container"], [id*="ad-wrapper"],
[id*="ad-unit"],     [id*="advertisement"] {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
  opacity: 0 !important;
}

/* ── Inline banner images from ad networks ── */
img[src*="doubleclick.net"],
img[src*="googlesyndication.com"],
img[src*="googleadservices.com"],
img[src*="adnxs.com"],
img[src*="criteo.com"],
img[src*="advmaker"],
img[src*="advertising.com"],
img[src*="yieldmo.com"],
img[src*="media.net"],
img[src*="amazon-adsystem.com"],
img[src*="ads.yahoo.com"] { display: none !important; }

/* ── Heuristic: Standard ad image/banner sizes ── */
/* Leaderboard 728x90 */
img[width="728"][height="90"],
img[width="728px"][height="90px"],
img[style*="width: 728px"][style*="height: 90px"],
img[style*="width:728px"][style*="height:90px"],
a > img[width="728"],
a > img[width="728px"] { display: none !important; }

/* Medium Rectangle 300x250 */
img[width="300"][height="250"],
img[width="300px"][height="250px"],
img[style*="width: 300px"][style*="height: 250px"],
img[style*="width:300px"][style*="height:250px"],
a > img[width="300"],
a > img[width="300px"] { display: none !important; }

/* Large Rectangle 336x280 */
img[width="336"][height="280"],
img[width="336px"][height="280px"],
img[style*="width: 336px"][style*="height: 280px"],
img[style*="width:336px"][style*="height:280px"] { display: none !important; }

/* Wide Skyscraper 160x600 */
img[width="160"][height="600"],
img[width="160px"][height="600px"],
img[style*="width: 160px"][style*="height: 600px"],
img[style*="width:160px"][style*="height:600px"] { display: none !important; }

/* Skyscraper 120x600 */
img[width="120"][height="600"],
img[width="120px"][height="600px"] { display: none !important; }

/* Billboard 970x250 */
img[width="970"][height="250"],
img[width="970px"][height="250px"],
img[style*="width: 970px"][style*="height: 250px"],
img[style*="width:970px"][style*="height:250px"] { display: none !important; }

/* Large Leaderboard 970x90 */
img[width="970"][height="90"],
img[width="970px"][height="90px"] { display: none !important; }

/* Half Page 300x600 */
img[width="300"][height="600"],
img[width="300px"][height="600px"],
img[style*="width: 300px"][style*="height: 600px"],
img[style*="width:300px"][style*="height:600px"] { display: none !important; }

/* Mobile Banner 320x50 */
img[width="320"][height="50"],
img[width="320px"][height="50px"],
img[style*="width: 320px"][style*="height: 50px"],
img[style*="width:320px"][style*="height:50px"] { display: none !important; }

/* Large Mobile 320x100 */
img[width="320"][height="100"],
img[width="320px"][height="100px"] { display: none !important; }

/* Mobile Interstitial 300x250 or 320x480 */
img[width="320"][height="480"],
img[width="320px"][height="480px"] { display: none !important; }

/* Button 120x90 */
img[width="120"][height="90"],
img[width="120px"][height="90px"] { display: none !important; }

/* Micro Bar 88x31 */
img[width="88"][height="31"],
img[width="88px"][height="31px"] { display: none !important; }

/* Small Square 200x200 */
img[width="200"][height="200"],
img[width="200px"][height="200px"] { display: none !important; }

/* Square 250x250 */
img[width="250"][height="250"],
img[width="250px"][height="250px"] { display: none !important; }

/* Banner 468x60 */
img[width="468"][height="60"],
img[width="468px"][height="60px"],
img[style*="width: 468px"][style*="height: 60px"],
img[style*="width:468px"][style*="height:60px"] { display: none !important; }

/* Panorama 980x120 */
img[width="980"][height="120"],
img[width="980px"][height="120px"] { display: none !important; }

/* ── Heuristic: Images inside common ad container classes ── */
[class*="ad-banner"] img,
[class*="adBanner"] img,
[class*="ad-banner-"] img,
[class*="banner-ad"] img,
[class*="bannerAd"] img,
[class*="ad-leaderboard"] img,
[class*="ad-rectangle"] img,
[class*="ad-skyscraper"] img,
[class*="ad-container"] img,
[class*="adContainer"] img,
[class*="ad-wrapper"] img,
[class*="adWrapper"] img,
[class*="ad-slot"] img,
[class*="ad-slot-"] img,
[class*="ad-unit"] img,
[class*="adUnit"] img,
[class*="advertisement"] img,
[class*="advert"] img,
[class*="sponsored-banner"] img,
[class*="promoted-banner"] img,
[class*="promo-banner"] img,
[class*="partner-banner"] img,
[class*="affiliate-banner"] img,
[class*="commercial"] img { display: none !important; }

/* ── Heuristic: Flash/animated banners (SWF, animated GIF) ── */
object[type*="x-shockwave-flash"],
embed[type*="x-shockwave-flash"],
object[data*=".swf"],
embed[src*=".swf"],
img[src*=".gif"][width="728"],
img[src*=".gif"][width="300"],
img[src*=".gif"][width="336"],
img[src*=".gif"][width="160"],
img[src*=".gif"][width="468"],
img[src*=".gif"][width="970"],
img[src*=".gif"][width="320"],
img[src*=".gif"][width="250"] { display: none !important; }

/* ── Heuristic: Ad images with common ad-related alt text ── */
img[alt*="advertisement"],
img[alt*="ad"],
img[alt*="Ad"],
img[alt*="AD"],
img[alt*="sponsor"],
img[alt*="Sponsor"],
img[alt*="SPONSOR"],
img[alt*="promo"],
img[alt*="Promo"],
img[alt*="PROMO"],
img[alt*="banner"],
img[alt*="Banner"],
img[alt*="BANNER"],
img[alt*="click"],
img[alt*="Click"],
img[alt*="CLICK"],
img[alt*="affiliate"],
img[alt*="Affiliate"] { display: none !important; }

/* ── Heuristic: Images with ad-related src paths ── */
img[src*="/ad/"],
img[src*="/ads/"],
img[src*="/adserver/"],
img[src*="/advert/"],
img[src*="/banner/"],
img[src*="/banners/"],
img[src*="/sponsor/"],
img[src*="/promo/"],
img[src*="/affiliate/"],
img[src*="/commercial/"],
img[src*="/partner/"],
img[src*="/click/"],
img[src*="/tracking/"],
img[src*="/pixel/"],
img[src*="/impression/"],
img[src*="/creative/"],
img[src*="/media/ad"],
img[src*="/media/ads"],
img[src*="/assets/ad"],
img[src*="/assets/ads"],
img[src*="/images/ad"],
img[src*="/images/ads"],
img[src*="/img/ad"],
img[src*="/img/ads"],
img[src*="banner.gif"],
img[src*="banner.jpg"],
img[src*="banner.png"],
img[src*="banner.swf"],
img[src*="ad.gif"],
img[src*="ad.jpg"],
img[src*="ad.png"],
img[src*="ad.swf"],
img[src*="promo.gif"],
img[src*="promo.jpg"],
img[src*="promo.png"],
img[src*="sponsor.gif"],
img[src*="sponsor.jpg"],
img[src*="sponsor.png"],
img[src*="advert.gif"],
img[src*="advert.jpg"],
img[src*="advert.png"] { display: none !important; }

/* ── Heuristic: Common IAB ad unit IDs ── */
[id*="ad-banner"],
[id*="adBanner"],
[id*="ad_leaderboard"],
[id*="ad_rectangle"],
[id*="ad_skyscraper"],
[id*="ad-container"],
[id*="ad-wrapper"],
[id*="ad-slot"],
[id*="ad-unit"],
[id*="advertisement"],
[id*="banner-ad"],
[id*="sponsor-banner"],
[id*="promo-banner"],
[id*="partner-banner"],
[id*="affiliate-banner"] { display: none !important; }

/* ── Heuristic: GIF images in anchor tags (animated ad banners) ── */
a[href*="click"] > img[src*=".gif"],
a[href*="redirect"] > img[src*=".gif"],
a[href*="track"] > img[src*=".gif"],
a[href*="affiliate"] > img[src*=".gif"],
a[href*="sponsor"] > img[src*=".gif"],
a[href*="promo"] > img[src*=".gif"],
a[href*="ad."] > img[src*=".gif"],
a[href*="/ad/"] > img[src*=".gif"],
a[href*="/ads/"] > img[src*=".gif"],
a[href*="banner"] > img[src*=".gif"] { display: none !important; }

/* ── Age-gate / confirmation badges (corner overlays) ── */
[class*="age-gate"],   [class*="ageGate"],
[class*="age-check"],  [class*="ageCheck"],
[class*="age-verify"], [class*="ageVerify"],
[id*="age-gate"],      [id*="ageGate"],
[id*="age-check"],     [id*="age-verify"] { display: none !important; }

/* ── Cookie / GDPR consent walls ── */
[class*="cookie-banner"],  [class*="cookieBanner"],
[class*="cookie-consent"], [class*="cookieConsent"],
[class*="cookie-notice"],  [class*="cookieNotice"],
[class*="cookie-wall"],    [class*="cookieWall"],
[class*="gdpr-banner"],    [class*="gdprBanner"],
[class*="gdpr-overlay"],   [class*="gdprOverlay"],
[class*="consent-overlay"],[class*="consentOverlay"],
[class*="consent-banner"], [class*="consentBanner"],
[id*="cookie-banner"],     [id*="cookieBanner"],
[id*="cookie-consent"],    [id*="cookie-notice"],
[id*="gdpr-banner"],       [id*="gdpr-overlay"],
[id*="consent-wall"],      [id*="consentWall"],
[id*="consent-overlay"],   [id*="CybotCookiebotDialog"],
#onetrust-banner-sdk,      #onetrust-consent-sdk,
.cc-banner,                .cc-window,
#cookie-law-info-bar { display: none !important; }

/* ── Sponsored / Promoted Content ── */
[class*="sponsored"],
[class*="sponsor-content"],
[class*="promoted"],
[class*="promote-content"],
[data-ad],[data-ads],[data-ad-slot],[data-ad-unit],
[data-google-query-id] { display: none !important; }

/* ── IronSource / Supersonic ── */
iframe[src*="ironsrc.com"],iframe[src*="iron-source.com"],
iframe[src*="supersonicads.com"],iframe[src*="ironSource.mobi"] { display: none !important; }

/* ── Fastclick ── */
iframe[src*="fastclick.net"],iframe[src*="media.fastclick.net"] { display: none !important; }

/* ── Amazon Advertising ── */
iframe[src*="advertising-api-eu.amazon.com"],
iframe[src*="affiliationjs.s3.amazonaws.com"] { display: none !important; }

/* ── Twitter Advertising ── */
iframe[src*="advertising.twitter.com"],iframe[src*="ads.x.com"],
iframe[src*="ads-api.x.com"] { display: none !important; }

/* ── Pinterest ── */
iframe[src*="ads-dev.pinterest.com"],iframe[src*="analytics.pinterest.com"],
iframe[src*="widgets.pinterest.com"],iframe[src*="ct.pinterest.com"] { display: none !important; }

/* ── Reddit ── */
iframe[src*="ads.reddit.com"],iframe[src*="rereddit.com"],
iframe[src*="d.reddit.com"] { display: none !important; }

/* ── YouTube ── */
iframe[src*="ads.youtube.com"],iframe[src*="s.youtube.com"],
iframe[src*="redirector.googlevideo.com"],iframe[src*="youtubei.googleapis.com"] { display: none !important; }

/* ── Yandex ── */
iframe[src*="appmetrica.yandex.com"],iframe[src*="yandexadexchange.net"],
iframe[src*="mc.yandex.ru"] { display: none !important; }

/* ── Xiaomi ── */
iframe[src*="tracking.intl.miui.com"],iframe[src*="tracking.india.miui.com"],
iframe[src*="tracking.miui.com"] { display: none !important; }

/* ── Samsung ── */
iframe[src*="business.samsungusa.com"],iframe[src*="config.samsungads.com"] { display: none !important; }

/* ── Apple ── */
iframe[src*="securemetrics.apple.com"],iframe[src*="supportmetrics.apple.com"],
iframe[src*="xp.apple.com"] { display: none !important; }

/* ── Facebook / Instagram ── */
iframe[src*="graph.facebook.com"],iframe[src*="tr.facebook.com"],
iframe[src*="graph.instagram.com"],iframe[src*="i.instagram.com"] { display: none !important; }

/* ── Snapchat ── */
iframe[src*="sc-static.net"],iframe[src*="sc-analytics.appspot.com"] { display: none !important; }

/* ── VK / Mail.ru ── */
iframe[src*="vk.com/rtrg"],iframe[src*="ads.vk.com"],
iframe[src*="ad.mail.ru"],iframe[src*="top-fwz1.mail.ru"] { display: none !important; }

/* ── Tumblr ── */
iframe[src*="px.srvcs.tumblr.com"] { display: none !important; }

/* ── Smartclip ── */
iframe[src*="smartclip.net"],iframe[src*="smartclip.com"] { display: none !important; }

/* ── Microsoft Telemetry ── */
iframe[src*="telemetry.microsoft.com"],iframe[src*="watson.telemetry.microsoft.com"],
iframe[src*="settings-win.data.microsoft.com"],iframe[src*="vortex.data.microsoft.com"],
iframe[src*="vortex-win.data.microsoft.com"] { display: none !important; }

/* ── Amazon Device Metrics ── */
iframe[src*="device-metrics-us.amazon.com"],iframe[src*="device-metrics-us-2.amazon.com"],
iframe[src*="mads-eu.amazon.com"] { display: none !important; }

/* ── Roku / Vizio ── */
iframe[src*="ads.roku.com"],iframe[src*="logs.roku.com"],
iframe[src*="ads.vizio.com"],iframe[src*="tvinteractive.tv"],
iframe[src*="tvpixel.com"] { display: none !important; }

/* ── Google / Firebase ── */
iframe[src*="app-measurement.com"],iframe[src*="firebase-settings.crashlytics.com"],
iframe[src*="pagead.l.doubleclick.net"] { display: none !important; }

/* ── CJ Affiliate ── */
iframe[src*="www.anrdoezrs.net"],iframe[src*="www.dpbolvw.net"],
iframe[src*="www.tkqlhce.net"] { display: none !important; }

/* ── Impact ── */
iframe[src*="impact.com"],iframe[src*="api.impact.com"],
iframe[src*="d.impactradius-event.com"] { display: none !important; }

/* ── Awin ── */
iframe[src*="www.awin1.com"],iframe[src*="zenaps.com"] { display: none !important; }

/* ── PartnerStack ── */
iframe[src*="partnerstack.com"],iframe[src*="api.partnerstack.com"] { display: none !important; }

/* ── Refersion ── */
iframe[src*="refersion.com"],iframe[src*="api.refersion.com"] { display: none !important; }

/* ── Skimlinks ── */
iframe[src*="s.skimresources.com"],iframe[src*="t.skimresources.com"],
iframe[src*="go.skimresources.com"],iframe[src*="redirector.skimresources.com"] { display: none !important; }

/* ── Viglink / Sovrn ── */
iframe[src*="redirect.viglink.com"],iframe[src*="cdn.viglink.com"],
iframe[src*="api.viglink.com"] { display: none !important; }

/* ── LiveRamp ── */
iframe[src*="idsync.rlcdn.com"],iframe[src*="api.rlcdn.com"] { display: none !important; }

/* ── MediaMath ── */
iframe[src*="mediamath.com"] { display: none !important; }

/* ── TheTradeDesk ── */
iframe[src*="thetradedesk.com"],iframe[src*="ttd.com"] { display: none !important; }

/* ── Sizmek ── */
iframe[src*="sizmek.com"] { display: none !important; }

/* ── Flashtalking ── */
iframe[src*="flashtalking.com"] { display: none !important; }

/* ── Celtra ── */
iframe[src*="celtra.com"] { display: none !important; }

/* ── Kevel / Adzerk ── */
iframe[src*="kevel.com"],iframe[src*="adzerk.com"] { display: none !important; }

/* ── Improve Digital ── */
iframe[src*="improve-digital.com"],iframe[src*="improvedigital.com"] { display: none !important; }

/* ── Sovrn ── */
iframe[src*="sovrn.com"],iframe[src*="lijit.com"] { display: none !important; }

/* ── Mobile Attribution ── */
iframe[src*="appsflyer.com"],iframe[src*="adjust.com"],
iframe[src*="branch.io"],iframe[src*="bnc.lt"],
iframe[src*="kochava.com"],iframe[src*="singular.net"] { display: none !important; }

/* ── Fingerprinting ── */
iframe[src*="fingerprintjs.com"],iframe[src*="fpjs.io"],
iframe[src*="siftscience.com"],iframe[src*="onetag-sys.com"],
iframe[src*="pippio.com"],iframe[src*="id5-sync.com"],
iframe[src*="tapad.com"],iframe[src*="crwdcntrl.net"],
iframe[src*="prod.uidapi.com"] { display: none !important; }

/* ── CleverTap ── */
iframe[src*="wzrkt.com"],iframe[src*="clevertap-prod.com"] { display: none !important; }

/* ── Consent Management ── */
iframe[src*="cookielaw.org"],iframe[src*="cookiebot.com"],
iframe[src*="trustarc.com"],iframe[src*="privacy-center.org"],
iframe[src*="privacy-mgmt.com"],iframe[src*="usercentrics.eu"],
iframe[src*="onetrust.com"] { display: none !important; }

/* ── Error Trackers ── */
iframe[src*="bugsnag.com"],iframe[src*="sentry-cdn.com"],
iframe[src*="sentry.io"],iframe[src*="rollbar.com"],
iframe[src*="trackjs.com"],iframe[src*="raygun.com"],
iframe[src*="airbrake.io"],iframe[src*="honeybadger.io"],
iframe[src*="loggly.com"],iframe[src*="newrelic.com"],
iframe[src*="nr-data.net"] { display: none !important; }

/* ── A/B Testing ── */
iframe[src*="optimizely.com"],iframe[src*="vwo.com"],
iframe[src*="abtasty.com"],iframe[src*="convert.com"],
iframe[src*="kameleoon.com"],iframe[src*="dynamicyield.com"] { display: none !important; }

/* ── Live Chat Trackers ── */
iframe[src*="intercom.io"],iframe[src*="intercomcdn.com"],
iframe[src*="drift.com"],iframe[src*="driftt.com"] { display: none !important; }

/* ── Video Ads ── */
iframe[src*="imasdk.googleapis.com"],iframe[src*="dai.google.com"],
iframe[src*="g.jwpsrv.com"],iframe[src*="ssl.p.jwpcdn.com"],
iframe[src*="mssl.fwmrm.net"],iframe[src*="connatix.com"],
iframe[src*="brightcove.com"],iframe[src*="innovid.com"],
iframe[src*="tremorhub.com"] { display: none !important; }

/* ── Malvertising ── */
iframe[src*="popads.net"],iframe[src*="popcash.net"],
iframe[src*="propellerclick.com"],iframe[src*="onclickads.net"],
iframe[src*="popmyads.com"],iframe[src*="clickadu.com"],
iframe[src*="trafficjunky.net"],iframe[src*="exoclick.com"],
iframe[src*="juicyads.com"],iframe[src*="coinimp.com"],
iframe[src*="webminepool.com"],iframe[src*="minero.cc"],
iframe[src*="mineralt.io"],iframe[src*="jsecoin.com"],
iframe[src*="crypto-loot.org"],iframe[src*="monerominer.rocks"],
iframe[src*="2giga.link"],iframe[src*="greatis.com"],
iframe[src*="statdynamic.com"] { display: none !important; }

/* ── Ad Networks (missing) ── */
iframe[src*="contextweb.com"],iframe[src*="smartyads.com"],
iframe[src*="ad.gt"],iframe[src*="districtm.net"],
iframe[src*="emxdgt.com"],iframe[src*="betweendigital.com"],
iframe[src*="adkernel.com"],iframe[src*="adtelligent.com"],
iframe[src*="mediavine.com"],iframe[src*="raptive.com"],
iframe[src*="adthrive.com"],iframe[src*="ezoic.com"],
iframe[src*="setupad.com"],iframe[src*="confiant.com"],
iframe[src*="bidswitch.net"],iframe[src*="rhythmone.com"],
iframe[src*="undertone.com"],iframe[src*="33across.com"],
iframe[src*="smartadserver.com"],iframe[src*="adform.net"],
iframe[src*="moatads.com"],iframe[src*="yieldmo.com"],
iframe[src*="sharethrough.com"],iframe[src*="teads.tv"],
iframe[src*="triplelift.com"],iframe[src*="sonobi.com"],
iframe[src*="gumgum.com"],iframe[src*="seedtag.com"],
iframe[src*="kargo.com"],iframe[src*="beachfront.com"],
iframe[src*="springserve.com"],iframe[src*="freewheel.tv"],
iframe[src*="spotxchange.com"],iframe[src*="indexexchange.com"],
iframe[src*="casalemedia.com"],iframe[src*="pubmatic.com"],
iframe[src*="openx.net"],iframe[src*="rubiconproject.com"],
iframe[src*="adroll.com"],iframe[src*="nextroll.com"],
iframe[src*="xandr.com"],iframe[src*="appnexus.com"],
iframe[src*="criteo.com"],iframe[src*="amazon-adsystem.com"],
iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],
iframe[src*="googleadservices.com"],iframe[src*="adservice.google.com"],
iframe[src*="nativo.com"],iframe[src*="mgid.com"],
iframe[src*="revcontent.com"],iframe[src*="content.ad"],
iframe[src*="zergnet.com"],iframe[src*="gravity.com"],
taboola,outbrain { display: none !important; }

/* ── Scroll restore — ad overlays lock body scroll ── */
body.modal-open:not([data-legit-modal]),
body[class*="noscroll"]:not([data-legit]),
body[class*="no-scroll"]:not([data-legit]),
body[class*="overflow-hidden"]:not([data-legit]) {
  overflow: auto !important;
  position: static !important;
}
    `;
  }

  getFloatingAdBlockerScript() {
    return `
(function() {
  try {
    const STATE_KEY = '__omxAdBlocker7';
    const state = window[STATE_KEY] || (window[STATE_KEY] = {});

    if (state.observer)  { state.observer.disconnect();  state.observer = null; }
    if (state.interval)  { clearInterval(state.interval); state.interval = null; }
    if (state.rafId)     { cancelAnimationFrame(state.rafId); state.rafId = null; }
    if (state.navObserver) { state.navObserver.disconnect(); state.navObserver = null; }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 0 — Inject CSS via <style> tag (prepended to <head>)
    //  Runs synchronously so it blocks ad paint BEFORE first render
    // ════════════════════════════════════════════════════════════════
    if (!document.getElementById('__omxAdBlockerStyle')) {
      const s = document.createElement('style');
      s.id = '__omxAdBlockerStyle';
      s.textContent = \`
        ins.adsbygoogle,[id*="google_ads_iframe"],[id*="div-gpt-ad"],[id^="aswift_"],
        [class*="adsbygoogle"],[class*="taboola"],[id*="taboola"],[class*="outbrain"],
        [id*="outbrain"],[class*="ad-slot"],[class*="adSlot"],[class*="ad-unit"],
        [class*="adUnit"],[class*="ad-container"],[class*="adContainer"],
        [class*="ad-wrapper"],[class*="adWrapper"],[class*="ad-banner"],
        [class*="adBanner"],[class*="ad-sticky"],[class*="sticky-ad"],
        [class*="floating-ad"],[class*="floatingAd"],[class*="ad-overlay"],
        [class*="ad-popup"],[class*="adPopup"],[class*="interstitial"],
        [class*="cookie-banner"],[class*="cookieBanner"],[class*="cookie-consent"],
        [class*="gdpr-banner"],[class*="consent-overlay"],[id*="onetrust"],
        .cc-banner,.cc-window,[class*="age-gate"],[class*="ageGate"],
        [class*="mgid"],[id*="mgid"],[class*="revcontent"],[id*="revcontent"],
        [class*="propellerads"],[id*="propellerads"],
        iframe[src*="doubleclick"],iframe[src*="googlesyndication"],
        iframe[src*="adnxs"],iframe[src*="criteo"],iframe[src*="advmaker"],
        iframe[src*="amazon-adsystem"],iframe[src*="aan.amazon"],
        iframe[src*="pubmatic"],iframe[src*="rubiconproject"],iframe[src*="openx"],
        iframe[src*="taboola"],iframe[src*="outbrain"],iframe[src*="media.net"],
        iframe[src*="contextual.media.net"],
        iframe[src*="facebook.com/tr"],iframe[src*="connect.facebook.net"],
        iframe[src*="googleadservices"],iframe[src*="adservice.google.com"],
        iframe[src*="ads.yahoo.com"],iframe[src*="adcolony"],
        iframe[src*="unityads"],iframe[src*="hotjar"],iframe[src*="mouseflow"],
        iframe[src*="luckyorange"],iframe[src*="sentry.io"],
        iframe[src*="bugsnag"],iframe[src*="clarity.ms"],
        iframe[src*="yandex"],iframe[src*="tiktok"],
        iframe[src*="advertising.com"],
        iframe[src*="twitter.com/i/ads"],iframe[src*="ads.linkedin.com"],
        iframe[src*="analytics"],iframe[src*="tracking"],
        iframe[src*="pixel"],iframe[src*="tracker"],
        iframe[src*="samsungads"],iframe[src*="miui"],
        iframe[src*="advice-ads.s3"],iframe[src*="adtago.s3"],
        iframe[src*="analyticsengine.s3"],
        iframe[src*="pagead2.googlesyndication"],iframe[src*="afs.googlesyndication"],
        iframe[src*="pagead2.googleadservices"],iframe[src*="tpc.googlesyndication"],
        iframe[src*="stats.g.doubleclick"],iframe[src*="m.doubleclick"],
        iframe[src*="static.doubleclick"],iframe[src*="ad.doubleclick"],
        iframe[src*="pubads.g.doubleclick"],iframe[src*="securepubads.g.doubleclick"],
        iframe[src*="mediavisor.doubleclick"],
        iframe[src*="wd.adcolony"],iframe[src*="ads30.adcolony"],
        iframe[src*="static.media.net"],iframe[src*="adservetx.media.net"],
        iframe[src*="ssl.google-analytics"],iframe[src*="click.googleanalytics"],
        iframe[src*="adm.hotjar"],iframe[src*="surveys.hotjar"],
        iframe[src*="insights.hotjar"],iframe[src*="script.hotjar"],
        iframe[src*="identify.hotjar"],iframe[src*="careers.hotjar"],
        iframe[src*="events.hotjar.io"],iframe[src*="cdn.mouseflow"],
        iframe[src*="gtm.mouseflow"],iframe[src*="api.mouseflow"],
        iframe[src*="o2.mouseflow"],iframe[src*="tools.mouseflow"],
        iframe[src*="cdn-test.mouseflow"],
        iframe[src*="claritybt.freshmarketer"],iframe[src*="fwtracks.freshmarketer"],
        iframe[src*="freshmarketer"],iframe[src*="w1.luckyorange"],
        iframe[src*="realtime.luckyorange"],iframe[src*="notify.bugsnag"],
        iframe[src*="browser.sentry-cdn"],iframe[src*="sentry-cdn"],
        iframe[src*="an.facebook"],iframe[src*="pixel.facebook"],
        iframe[src*="ads-api.twitter"],iframe[src*="static.ads-twitter"],
        iframe[src*="log.pinterest"],iframe[src*="trk.pinterest"],
        iframe[src*="events.reddit"],iframe[src*="events.redditmedia"],
        iframe[src*="analytics.tiktok"],iframe[src*="ads-api.tiktok"],
        iframe[src*="ads-sg.tiktok"],iframe[src*="business-api.tiktok"],
        iframe[src*="analytics-sg.tiktok"],iframe[src*="log.byteoversea"],
        iframe[src*="log.fc.yahoo"],iframe[src*="udcm.yahoo"],
        iframe[src*="geo.yahoo"],iframe[src*="gemini.yahoo"],
        iframe[src*="adtech.yahooinc"],iframe[src*="analytics.yahoo"],
        iframe[src*="analytics.query.yahoo"],iframe[src*="partnerads.ysm"],
        iframe[src*="appmetrica.yandex"],iframe[src*="adfstat.yandex"],
        iframe[src*="metrika.yandex"],iframe[src*="offerwall.yandex"],
        iframe[src*="adfox.yandex"],iframe[src*="extmaps-api.yandex"],
        iframe[src*="webview.unityads"],iframe[src*="config.unityads"],
        iframe[src*="adserver.unityads"],iframe[src*="auction.unityads"],
        iframe[src*="iot-eu-logser.realme"],iframe[src*="iot-logser.realme"],
        iframe[src*="bdapi-ads.realmemobile"],iframe[src*="bdapi-in-ads.realmemobile"],
        iframe[src*="sdkconfig.ad.xiaomi"],iframe[src*="tracking.rus.miui"],
        iframe[src*="data.mistat.india.xiaomi"],iframe[src*="data.mistat.xiaomi"],
        iframe[src*="data.mistat.rus.xiaomi"],iframe[src*="api.ad.xiaomi"],
        iframe[src*="sdkconfig.ad.intl.xiaomi"],
        iframe[src*="adsfs.oppomobile"],iframe[src*="data.ads.oppomobile"],
        iframe[src*="adx.ads.oppomobile"],iframe[src*="ck.ads.oppomobile"],
        iframe[src*="metrics2.data.hicloud"],iframe[src*="grs.hicloud"],
        iframe[src*="metrics.data.hicloud"],iframe[src*="logservice.hicloud"],
        iframe[src*="logservice1.hicloud"],iframe[src*="logbak.hicloud"],
        iframe[src*="smetrics.samsung"],iframe[src*="nmetrics.samsung"],
        iframe[src*="samsung-com.112.2o7"],iframe[src*="analytics-api.samsunghealthcn"],
        iframe[src*="metrics.mzstatic"],iframe[src*="iadsdk.apple"],
        iframe[src*="metrics.icloud"],iframe[src*="api-adservices.apple"],
        iframe[src*="books-analytics-events.apple"],
        iframe[src*="notes-analytics-events.apple"],
        iframe[src*="weather-analytics-events.apple"],
        iframe[src*="open.oneplus"],iframe[src*="click.oneplus"],
        iframe[src*="stats.wp.com"],
        iframe[src*="static.criteo.net"],iframe[src*="bidder.criteo.com"],
        iframe[src*="cdn.taboola"],iframe[src*="trc.taboola"],
        iframe[src*="images.taboola"],iframe[src*="nr.taboola"],iframe[src*="api.taboola"],
        iframe[src*="log.outbrain"],iframe[src*="widgets.outbrain"],iframe[src*="odb.outbrain"],
        iframe[src*="cdn.mgid"],iframe[src*="servicer.mgid"],
        iframe[src*="bat.bing"],iframe[src*="bingads.microsoft"],iframe[src*="ads.microsoft"],
        iframe[src*="ib.adnxs"],iframe[src*="secure.adnxs"],iframe[src*="acdn.adnxs"],
        iframe[src*="prebid.adnxs"],
        iframe[src*="ads.pubmatic"],iframe[src*="image6.pubmatic"],iframe[src*="hbopenbid.pubmatic"],
        iframe[src*="us-ads.openx"],iframe[src*="rtb.openx"],iframe[src*="u.openx"],iframe[src*="hbopenbid.openx"],
        iframe[src*="pixel.rubiconproject"],iframe[src*="fastlane.rubiconproject"],
        iframe[src*="as.casalemedia"],iframe[src*="htlb.casalemedia"],
        iframe[src*="cdn.indexexchange"],
        iframe[src*="d.applovin"],iframe[src*="rt.applovin"],iframe[src*="ms.applovin"],
        iframe[src*="api.vungle"],
        iframe[src*="live.chartboost"],
        iframe[src*="init.supersonicads"],iframe[src*="outcome-ssp.supersonicads"],
        iframe[src*="api.fyber"],
        iframe[src*="inmobi"],
        iframe[src*="apex.go.sonobi"],
        iframe[src*="c.gumgum"],
        iframe[src*="a.teads.tv"],iframe[src*="cdn.teads.tv"],
        iframe[src*="cdn.kargo"],iframe[src*="sync.kargo"],
        iframe[src*="eb2.3lift"],iframe[src*="tlx.3lift"],
        iframe[src*="d.adroll"],iframe[src*="s.adroll"],
        iframe[src*="cdn.doubleverify"],
        iframe[src*="pixel.adsafeprotected"],iframe[src*="static.adsafeprotected"],
        iframe[src*="fw.adsafeprotected"],iframe[src*="insightexpressai"],
        iframe[src*="btlr.sharethrough"],
        iframe[src*="smartyads"],
        iframe[src*="contextweb"],
        iframe[src*="propellerads"],
        iframe[src*="pangleglobal"],
        iframe[src*="liftoff"],
        iframe[src*="sonobi"],
        script[src*="doubleclick"],script[src*="googlesyndication"],
        script[src*="googleadservices"],script[src*="google-analytics"],
        script[src*="googletagmanager"],script[src*="googletagservices"],
        script[src*="hotjar"],script[src*="mouseflow"],script[src*="luckyorange"],
        script[src*="clarity.ms"],script[src*="sentry"],script[src*="bugsnag"],
        script[src*="connect.facebook"],script[src*="ads-twitter"],
        script[src*="ads.linkedin"],script[src*="tiktok"],script[src*="yandex"],
        script[src*="unityads"],script[src*="adcolony"],
        script[src*="taboola"],script[src*="outbrain"],
        script[src*="media.net"],script[src*="freshmarketer"],
        script[src*="propellerads"],script[src*="bing"],script[src*="pangle"],
        script[src*="criteo"],script[src*="pubmatic"],script[src*="openx"],
        script[src*="rubiconproject"],script[src*="sonobi"],script[src*="adroll"],
        script[src*="liftoff"],script[src*="inmobi"],script[src*="smartyads"],
        script[src*="contextweb"],script[src*="applovin"],script[src*="vungle"],
        script[src*="chartboost"],script[src*="ironsrc"],script[src*="fyber"],
        script[src*="prebid"],script[src*="gumgum"],script[src*="kargo"],
        script[src*="teads"],script[src*="triplelift"],script[src*="sharethrough"],
        script[src*="indexexchange"],script[src*="casalemedia"],script[src*="spotx"],
        script[src*="doubleverify"],script[src*="adsafeprotected"],
        img[src*="doubleclick"],img[src*="googlesyndication"],
        img[src*="advmaker"],img[src*="adnxs"],img[src*="criteo"],
        img[src*="advertising.com"],img[src*="amazon-adsystem"],
        img[src*="googleadservices"],img[src*="adservice.google.com"],
        img[src*="ads.yahoo.com"],img[src*="facebook.com/tr"],
        img[src*="tracking"],img[src*="analytics"],
        img[src*="propellerads"],img[src*="bing"],img[src*="pangle"],
        img[src*="pubmatic"],img[src*="openx"],img[src*="rubiconproject"],
        img[src*="criteo"],img[src*="media.net"],img[src*="taboola"],
        img[src*="outbrain"],img[src*="mgid"],img[src*="revcontent"],
        img[src*="applovin"],img[src*="vungle"],img[src*="chartboost"],
        img[src*="ironsrc"],img[src*="fyber"],img[src*="inmobi"],
        img[src*="sonobi"],img[src*="adroll"],img[src*="liftoff"],
        img[src*="prebid"],img[src*="gumgum"],img[src*="kargo"],
        img[src*="teads"],img[src*="triplelift"],img[src*="sharethrough"],
        img[src*="indexexchange"],img[src*="casalemedia"],img[src*="spotx"],
        img[src*="doubleverify"],img[src*="adsafeprotected"],
        img[src*="smartyads"],img[src*="contextweb"],
        [id*="google_ads"],.google-ad,[class*="google-ad"],
        [id*="adsbygoogle"],.adsbygoogle,
        [id*="taboola"],.taboola,[class*="taboola"],
        [id*="outbrain"],.outbrain,[class*="outbrain"],
        [id*="mgid"],.mgid,[class*="mgid"],
        [id*="revcontent"],.revcontent,[class*="revcontent"],
        [id*="propellerads"],.propellerads,[class*="propellerads"],
        [class*="sponsored"],.sponsored-content,
        [class*="promoted"],.promoted-content,
        [data-ad],[data-ads],[data-ad-slot],[data-ad-unit],
        [data-google-query-id] {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          opacity: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          clip: rect(0,0,0,0) !important;
        }
      \`;
      (document.head || document.documentElement).appendChild(s);
    }

    // ════════════════════════════════════════════════════════════════
    //  AD URL MATCHER v7 — Trie-based subdomain matching + regex paths
    //  All intercept layers share this single source of truth
    //  Enhanced with modern ad networks (2024-2025)
    // ════════════════════════════════════════════════════════════════

    // ROOT domains: any subdomain of these is blocked
    const AD_ROOT_DOMAINS = new Set([
      // Google Ads
      'doubleclick.net','googlesyndication.com','googleadservices.com',
      'googletagmanager.com','googletagservices.com','google-analytics.com',
      // Ad Networks
      'adnxs.com','criteo.com','rubiconproject.com','pubmatic.com','openx.net',
      'casalemedia.com','smartadserver.com','adform.net','moatads.com','yieldmo.com',
      'sharethrough.com','teads.tv','bidswitch.net','rhythmone.com','undertone.com',
      'advertising.com','33across.com','amazon-adsystem.com','assoc-amazon.com',
      'adroll.com','lijit.com','sonobi.com','districtm.io','triplelift.com',
      'indexexchange.com','emxdgt.com','appnexus.com','betweendigital.com',
      'adkernel.com','magnite.com','spotxchange.com','freewheel.tv',
      'adtelligent.com','nativo.com','mediavine.com','raptive.com','adthrive.com',
      'ezoic.com','setupad.com','confiant.com','integral-marketing.com',
      // Taboola & Outbrain & Content Ads
      'taboola.com','taboolasyndication.com','outbrain.com','revcontent.com',
      'content.ad','mgid.com','adngin.com','zergnet.com','gravity.com',
      // Media Networks
      'media.net',
      // AdColony / Digital Turbine
      'adcolony.com','digitalturbine.com','inneractive.com',
      // Analytics & Heatmaps
      'hotjar.com','mouseflow.com','clarity.ms','luckyorange.com',
      'freshmarketer.com','inspectlet.com','crazyegg.com','ptengine.com',
      'quantcast.com','comscore.com','chartbeat.com','parsely.com',
      'segment.com','segment.io','fullstory.com','logrocket.com',
      'heap.io','pendo.io','appcues.com','userpilot.io','chameleon.io',
      'gainsight.com','walkme.com','whatfix.com','userguiding.com',
      // A/B Testing / Personalization
      'optimizely.com','vwo.com','abtasty.com','convert.com',
      'kameleoon.com','splitio','launchdarkly.com','growthbook.io',
      // Social Trackers
      'connect.facebook.net','facebook.net',
      'ads-twitter.com','twitter-analytics.com',
      'pinterest.com','log.pinterest.com',
      'tiktok.com','byteoversea.com','musical.ly','tiktokcdn.com',
      'snap.licdn.com','ads.linkedin.com','linkedin-ei.com',
      // Yahoo / Verizon / Oath
      'adtech.yahooinc.com','adtech.de','adtechus.com','nexage.com',
      'gemini.yahoo.com','advertising.yahoo.com','yahooapis.com',
      // Yandex
      'yandex.ru','yandex.net','yandex.com','yandex.st',
      // Unity / IronSource
      'unity3d.com','unityads.unity3d.com','ironsrc.com','iron-source.com','supersonicads.com',
      'vungle.com','fyber.com','mintegral.com','moloco.com',
      // Error Trackers
      'sentry.io','sentry-cdn.com','bugsnag.com','rollbar.com','trackjs.com',
      'raygun.com','airbrake.io','honeybadger.io','loggly.com',
      // Modern Ad Tech (2024-2025)
      'prebid.org','medianet.com','kargo.com','synacor.com','tidaltv.com',
      'spotxchange.com','spotx.tv','springserve.com','beachfront.com',
      'freewheel.tv','fw.tv','improve-digital.com','improvedigital.com',
      'xandr.com','appnexus.com','liveramp.com','liveramp.com',
      'mediamath.com','thetradedesk.com','ttd.com',
      'sizmek.com','flashtalking.com','celtra.com',
      'kevel.adzerk.net','adzerk.net','kevel.com',
      'gumgum.com','seedtag.com','sharethrough.com',
      'triplelift.com','triple-lift.com',
      'openx.com','openx.net','openx.org',
      'pubmatic.com','pubmatic.net',
      'indexexchange.com','indexww.com','casalemedia.com',
      'magnite.com','rubiconproject.com','spotxchange.com',
      'sovrn.com','lijit.com',
      'medianet.com','media.net',
      'verizonmedia.com','verizon.com','yahoo.com',
      'nativo.com','nativo.net',
      'gumgum.com','gumgum.net',
      'seedtag.com','seedtag.net',
      'kargo.com','kargo.net',
      'synacor.com','synacor.net',
      'tidaltv.com','tidal.com',
      'springserve.com','springserve.net',
      'beachfront.com','beachfront.net',
      'freewheel.tv','freewheel.com',
      'improve-digital.com','improvedigital.com',
      'xandr.com','xandr.net',
      'liveramp.com','liveramp.net',
      'mediamath.com','mediamath.net',
      'thetradedesk.com','ttd.com',
      'sizmek.com','sizmek.net',
      'flashtalking.com','flashtalking.net',
      'celtra.com','celtra.net',
      'kevel.com','kevel.net',
      'adzerk.com','adzerk.net',
      // Connected TV / OTT Ads
      'roku.com','tubi.tv','pluto.tv','xumo.com',
      'samsung.com/tv','lg.com/tv',
      'vizio.com','vizio.io',
      'hulu.com','peacocktv.com',
      // In-app ad networks
      'unity3d.com','ironsrc.com','vungle.com',
      'fyber.com','mintegral.com','moloco.com',
      'chartboost.com','applovin.com','applovin.net',
      'digitalturbine.com','tapjoy.com',
      // Native ad platforms
      'mgid.com','revcontent.com','content.ad',
      'zergnet.com','gravity.com',
      'outbrain.com','outbrain.net',
      'taboola.com','taboolasyndication.com',
      // Marketing Automation / Chat
      'intercom.io','intercomcdn.com','crisp.chat','drift.com',
      'zendesk.com','zopim.com','tawk.to','livechatinc.com',
      'olark.com','livechat.com','freshdesk.com','freshchat.com',
      // OEM Tracking
      'realmemobile.com','miui.com','oppomobile.com',
      'hicloud.com','samsungads.com','samsung-com.112.2o7.net','samsunghealthcn.com',
      'iadsdk.apple.com','mzstatic.com',
      // Misc Trackers
      'mixpanel.com','amplitude.com','kissmetrics.com','woopra.com',
      'clicky.com','statcounter.com','histats.com','w3counter.com',
      'omtrdc.net','demdex.net','everesttech.net','rfihub.com','turn.com',
      'exelator.com','mathtag.com','adsrvr.org','bidr.io','krxd.net',
      'rlcdn.com','bluekai.com','addthis.com','sharethis.com',
      'disqusads.com','carbonads.com','buysellads.com',
      // Microsoft / Bing Ads
      'bing.com','microsoft.com','msads.net','microsoftads.com',
      // Propeller Ads
      'propellerads.com','propellerads.net',
      // AppLovin
      'applovin.com','applovin.net',
      // Vungle / Liftoff
      'vungle.com','liftoff.io','liftoff.com',
      // InMobi
      'inmobi.com','inmobi.net',
      // AdRoll / NextRoll
      'adroll.com','nextroll.com',
      // Pangle / ByteDance Ads
      'pangleglobal.com','pangle.io',
      // Ad Verification
      'doubleverify.com','adsafeprotected.com','iasds.com',
      'whiteops.com','human.io','pixalate.com','aniview.com',
      // Sonobi
      'sonobi.com',
      // ContextWeb / PulsePoint
      'contextweb.com','pulsepoint.com',
      // SmartyAds
      'smartyads.com',
      // Ad.gt
      'ad.gt',
      // Amazon Ads
      'amazon.com','amazon-adsystem.com',
      // Privacy-invasive CDNs
      'd2wy8f7a9ursnm.cloudfront.net',
    ]);

    // EXACT hosts (only this subdomain, not its children)
    const AD_EXACT_HOSTS = new Set([
      // Google Ads
      'adservice.google.com','analytics.google.com','ssl.google-analytics.com',
      'click.googleanalytics.com','pagead2.googlesyndication.com',
      'afs.googlesyndication.com','pagead2.googleadservices.com',
      'tpc.googlesyndication.com','ads.google.com',
      'tagmanager.google.com','optimize.google.com',
      // DoubleClick
      'stats.g.doubleclick.net','m.doubleclick.net','static.doubleclick.net',
      'ad.doubleclick.net','mediavisor.doubleclick.net',
      'securepubads.g.doubleclick.net','googleads.g.doubleclick.net',
      'adclick.g.doubleclick.net','pubads.g.doubleclick.net',
      // Amazon Ads
      'aax.amazon-adsystem.com','c.amazon-adsystem.com',
      's.amazon-adsystem.com','mads.amazon-adsystem.com',
      'aan.amazon.com',
      // Media.net
      'static.media.net','adservetx.media.net','contextual.media.net',
      // Criteo
      'static.criteo.net','bidder.criteo.com',
      // Taboola
      'cdn.taboola.com','trc.taboola.com','images.taboola.com',
      'nr.taboola.com','api.taboola.com',
      // Outbrain
      'log.outbrain.com','widgets.outbrain.com','odb.outbrain.com',
      // MGID
      'cdn.mgid.com','servicer.mgid.com',
      // Bing / Microsoft Ads
      'bat.bing.com','bingads.microsoft.com','ads.microsoft.com',
      // Xandr / AppNexus
      'ib.adnxs.com','secure.adnxs.com','ac.adnxs.com',
      'prebid.adnxs.com','acdn.adnxs.com',
      // PubMatic
      'ads.pubmatic.com','image6.pubmatic.com','hbopenbid.pubmatic.com',
      // OpenX
      'us-ads.openx.net','rtb.openx.net','u.openx.net','hbopenbid.openx.net',
      // Magnite / Rubicon
      'pixel.rubiconproject.com','fastlane.rubiconproject.com',
      'prebid-server.rubiconproject.com',
      // Index Exchange / Casale Media
      'as.casalemedia.com','htlb.casalemedia.com',
      'cdn.indexexchange.com','prebid.indexexchange.com',
      // Yahoo / Oath
      'ads.yahoo.com','geo.yahoo.com','udcm.yahoo.com','log.fc.yahoo.com',
      'analytics.yahoo.com','analytics.query.yahoo.com','partnerads.ysm.yahoo.com',
      'gemini.yahoo.com','adtech.yahooinc.com',
      // Unity Ads
      'auction.unityads.unity3d.com','config.unityads.unity3d.com',
      'adserver.unityads.unity3d.com','webview.unityads.unity3d.com',
      // Yandex
      'adfstat.yandex.ru','appmetrica.yandex.ru','adfox.yandex.ru',
      'metrika.yandex.ru','extmaps-api.yandex.net','offerwall.yandex.net',
      'mc.yandex.ru','counter.ok.ru',
      // AppLovin
      'd.applovin.com','rt.applovin.com','ms.applovin.com',
      // Vungle / Liftoff
      'api.vungle.com',
      // Chartboost
      'live.chartboost.com',
      // IronSource / Supersonic
      'init.supersonicads.com','outcome-ssp.supersonicads.com','ironSource.mobi',
      // Fyber
      'api.fyber.com',
      // InMobi
      'inmobi.com',
      // Sonobi
      'apex.go.sonobi.com',
      // GumGum
      'c.gumgum.com',
      // Teads
      'a.teads.tv','cdn.teads.tv',
      // Kargo
      'cdn.kargo.com','sync.kargo.com',
      // TripleLift
      'eb2.3lift.com','tlx.3lift.com',
      // AdRoll
      'd.adroll.com','s.adroll.com',
      // Ad Verification
      'doubleverify.com','cdn.doubleverify.com',
      'pixel.adsafeprotected.com','static.adsafeprotected.com',
      'fw.adsafeprotected.com','insightexpressai.com',
      // Sharethrough
      'btlr.sharethrough.com',
      // SmartyAds
      'smartyads.com',
      // ContextWeb
      'contextweb.com',
      // Ad.gt
      'ad.gt',
      // SpotX
      'search.spotxchange.com',
      // YouTube Ads
      's.youtube.com','redirector.googlevideo.com','youtubei.googleapis.com',
      // Social Trackers
      'pixel.facebook.com','an.facebook.com','ads.facebook.com',
      'ads-api.facebook.com','analytics.facebook.com',
      'static.ads-twitter.com','ads-api.twitter.com',
      'analytics.twitter.com','scribe.twitter.com',
      'px.ads.linkedin.com','analytics.pointdrive.linkedin.com',
      'trk.pinterest.com','log.pinterest.com','ads.pinterest.com',
      'events.reddit.com','events.redditmedia.com','alb.reddit.com',
      'pixel.reddit.com',
      'analytics.tiktok.com','ads-api.tiktok.com','ads-sg.tiktok.com',
      'ads.tiktok.com','business-api.tiktok.com','analytics-sg.tiktok.com',
      'log.byteoversea.com','mon.tiktokv.com',
      // Pangle / ByteDance
      'pangleglobal.com',
      // OEM Tracking
      'bdapi-in-ads.realmemobile.com','bdapi-ads.realmemobile.com',
      'iot-logser.realme.com','iot-eu-logser.realme.com',
      'api.ad.xiaomi.com','sdkconfig.ad.xiaomi.com','sdkconfig.ad.intl.xiaomi.com',
      'data.mistat.xiaomi.com','data.mistat.india.xiaomi.com','data.mistat.rus.xiaomi.com',
      'tracking.rus.miui.com','data.ads.oppomobile.com','adsfs.oppomobile.com',
      'ck.ads.oppomobile.com','adx.ads.oppomobile.com',
      'logbak.hicloud.com','logservice.hicloud.com','logservice1.hicloud.com',
      'metrics2.data.hicloud.com','grs.hicloud.com','metrics.data.hicloud.com',
      'click.oneplus.cn','open.oneplus.net',
      'nmetrics.samsung.com','smetrics.samsung.com',
      'analytics-api.samsunghealthcn.com','samsung-com.112.2o7.net',
      'metrics.icloud.com','metrics.mzstatic.com','api-adservices.apple.com',
      'books-analytics-events.apple.com','notes-analytics-events.apple.com',
      'weather-analytics-events.apple.com',
      // Analytics / Heatmaps
      'claritybt.freshmarketer.com','fwtracks.freshmarketer.com',
      'api.luckyorange.com','realtime.luckyorange.com','cdn.luckyorange.com',
      'w1.luckyorange.com','upload.luckyorange.net','cs.luckyorange.net',
      'settings.luckyorange.net','static.hotjar.com','script.hotjar.com',
      'insights.hotjar.com','identify.hotjar.com','adm.hotjar.com',
      'surveys.hotjar.com','careers.hotjar.com','events.hotjar.io',
      'cdn.mouseflow.com','gtm.mouseflow.com','api.mouseflow.com',
      'tools.mouseflow.com','o2.mouseflow.com','cdn-test.mouseflow.com',
      // Error tracking
      'browser.sentry-cdn.com','app.getsentry.com',
      'notify.bugsnag.com','sessions.bugsnag.com','api.bugsnag.com','app.bugsnag.com',
      // Misc
      'stats.wp.com',
      'advice-ads.s3.amazonaws.com','adtago.s3.amazonaws.com',
      'analyticsengine.s3.amazonaws.com','analytics.s3.amazonaws.com',
    ]);

    const AD_HOSTS = new Set([
      // Google Ads Network
      'doubleclick.net','googlesyndication.com','googleadservices.com',
      'googletagmanager.com','googletagservices.com','adservice.google.com',
      'google-analytics.com','analytics.google.com','ssl.google-analytics.com',
      'click.googleanalytics.com',
      // Ad Networks
      'adnxs.com','criteo.com','rubiconproject.com','pubmatic.com','openx.net',
      'casalemedia.com','smartadserver.com','adform.net','moatads.com','yieldmo.com',
      'sharethrough.com','teads.tv','bidswitch.net','rhythmone.com','undertone.com',
      'advertising.com','33across.com','amazon-adsystem.com','assoc-amazon.com',
      // Taboola & Outbrain
      'taboola.com','taboolasyndication.com','outbrain.com',
      // Media Networks
      'media.net','adservetx.media.net','static.media.net',
      // AdColony
      'adcolony.com','ads30.adcolony.com','adc3-launch.adcolony.com','wd.adcolony.com','events3alt.adcolony.com',
      // Analytics & Tracking
      'hotjar.com','static.hotjar.com','script.hotjar.com','insights.hotjar.com',
      'identify.hotjar.com','adm.hotjar.com','surveys.hotjar.com','careers.hotjar.com','events.hotjar.io',
      'mouseflow.com','cdn.mouseflow.com','gtm.mouseflow.com','api.mouseflow.com','tools.mouseflow.com','o2.mouseflow.com','cdn-test.mouseflow.com',
      'clarity.ms',
      // Social Trackers
      'facebook.com','pixel.facebook.com','an.facebook.com','connect.facebook.net',
      'static.ads-twitter.com','ads-api.twitter.com',
      'linkedin.com','ads.linkedin.com','analytics.pointdrive.linkedin.com',
      'pinterest.com','ads.pinterest.com','log.pinterest.com','trk.pinterest.com',
      'reddit.com','events.reddit.com','events.redditmedia.com',
      'youtube.com','ads.youtube.com',
      'tiktok.com','ads.tiktok.com','ads-sg.tiktok.com','ads-api.tiktok.com','analytics.tiktok.com','analytics-sg.tiktok.com','business-api.tiktok.com','log.byteoversea.com',
      // Yahoo
      'ads.yahoo.com','geo.yahoo.com','udcm.yahoo.com','log.fc.yahoo.com',
      'analytics.yahoo.com','analytics.query.yahoo.com','partnerads.ysm.yahoo.com',
      'gemini.yahoo.com','adtech.yahooinc.com',
      // Yandex
      'yandex.ru','yandex.net','adfstat.yandex.ru','extmaps-api.yandex.net',
      'appmetrica.yandex.ru','metrika.yandex.ru','offerwall.yandex.net','adfox.yandex.ru',
      'mc.yandex.ru','counter.ok.ru',
      // Unity
      'unity3d.com','unityads.unity3d.com','auction.unityads.unity3d.com',
      'webview.unityads.unity3d.com','config.unityads.unity3d.com','adserver.unityads.unity3d.com',
      // OEM Tracking
      'realme.com','realmemobile.com','bdapi-in-ads.realmemobile.com','bdapi-ads.realmemobile.com','iot-logser.realme.com','iot-eu-logser.realme.com',
      'xiaomi.com','miui.com','api.ad.xiaomi.com','data.mistat.xiaomi.com','data.mistat.india.xiaomi.com','data.mistat.rus.xiaomi.com','sdkconfig.ad.xiaomi.com','sdkconfig.ad.intl.xiaomi.com','tracking.rus.miui.com',
      'oppomobile.com','adsfs.oppomobile.com','adx.ads.oppomobile.com','ck.ads.oppomobile.com','data.ads.oppomobile.com',
      'hicloud.com','metrics.data.hicloud.com','metrics2.data.hicloud.com','grs.hicloud.com','logservice.hicloud.com','logservice1.hicloud.com','logbak.hicloud.com',
      'oneplus.net','oneplus.cn','click.oneplus.cn','open.oneplus.net',
      'samsung.com','samsungads.com','smetrics.samsung.com','nmetrics.samsung.com','samsung-com.112.2o7.net','analytics-api.samsunghealthcn.com',
      'apple.com','icloud.com','mzstatic.com','iadsdk.apple.com','metrics.icloud.com','metrics.mzstatic.com','api-adservices.apple.com','books-analytics-events.apple.com','notes-analytics-events.apple.com','weather-analytics-events.apple.com',
      // Error/Analytics Trackers
      'sentry.io','browser.sentry-cdn.com','app.getsentry.com',
      'bugsnag.com','notify.bugsnag.com','sessions.bugsnag.com','api.bugsnag.com','app.bugsnag.com',
      'd2wy8f7a9ursnm.cloudfront.net',
      // FreshWorks/FreshMarketer
      'freshmarketer.com','claritybt.freshmarketer.com','fwtracks.freshmarketer.com',
      // Lucky Orange
      'luckyorange.com','api.luckyorange.com','realtime.luckyorange.com','cdn.luckyorange.com','w1.luckyorange.com','upload.luckyorange.net','cs.luckyorange.net','settings.luckyorange.net',
      // WP Stats
      'stats.wp.com',
      // Misc Ad Related
      'advice-ads.s3.amazonaws.com','adtago.s3.amazonaws.com','analyticsengine.s3.amazonaws.com','analytics.s3.amazonaws.com',
      // ── All hosts from toolz_adb JSON scans ─────────────────────────────────
      // Google Ads subdomains (exact)
      'afs.googlesyndication.com','pagead2.googlesyndication.com',
      'pagead2.googleadservices.com','adservice.google.com',
      // Doubleclick subdomains (exact)
      'stats.g.doubleclick.net','m.doubleclick.net','static.doubleclick.net',
      'ad.doubleclick.net','mediavisor.doubleclick.net',
      // Media.net subdomains
      'adservetx.media.net','static.media.net',
      // AdColony subdomains
      'ads30.adcolony.com','adc3-launch.adcolony.com','wd.adcolony.com','events3alt.adcolony.com',
      // Google Analytics
      'ssl.google-analytics.com','click.googleanalytics.com',
      // Hotjar subdomains
      'events.hotjar.io','adm.hotjar.com','surveys.hotjar.com','insights.hotjar.com',
      'script.hotjar.com','identify.hotjar.com','careers.hotjar.com',
      // MouseFlow subdomains
      'cdn.mouseflow.com','gtm.mouseflow.com','cdn-test.mouseflow.com',
      'api.mouseflow.com','o2.mouseflow.com','tools.mouseflow.com',
      // Sentry CDN (separate domain from sentry.io)
      'sentry-cdn.com','browser.sentry-cdn.com',
      // Bugsnag subdomains
      'notify.bugsnag.com','sessions.bugsnag.com','api.bugsnag.com','app.bugsnag.com',
      'app.getsentry.com',
      // Social — explicit subdomains
      'pixel.facebook.com','an.facebook.com',
      'static.ads-twitter.com','ads-api.twitter.com',
      'ads.linkedin.com','analytics.pointdrive.linkedin.com',
      'ads.pinterest.com','log.pinterest.com','trk.pinterest.com',
      'events.reddit.com','events.redditmedia.com',
      'ads.youtube.com',
      'log.byteoversea.com','business-api.tiktok.com','analytics-sg.tiktok.com',
      'ads-api.tiktok.com','analytics.tiktok.com','ads.tiktok.com','ads-sg.tiktok.com',
      // Yahoo explicit subdomains
      'ads.yahoo.com','geo.yahoo.com','udcm.yahoo.com','log.fc.yahoo.com',
      'analytics.yahoo.com','analytics.query.yahoo.com','partnerads.ysm.yahoo.com',
      'gemini.yahoo.com','adtech.yahooinc.com',
      // Yandex explicit subdomains
      'adfstat.yandex.ru','appmetrica.yandex.ru','adfox.yandex.ru',
      'metrika.yandex.ru','extmaps-api.yandex.net','offerwall.yandex.net',
      // Unity explicit subdomains
      'auction.unityads.unity3d.com','config.unityads.unity3d.com',
      'adserver.unityads.unity3d.com','webview.unityads.unity3d.com',
      // OEM — Realme
      'bdapi-in-ads.realmemobile.com','bdapi-ads.realmemobile.com',
      'iot-logser.realme.com','iot-eu-logser.realme.com',
      // OEM — Xiaomi / MIUI
      'api.ad.xiaomi.com','sdkconfig.ad.xiaomi.com','sdkconfig.ad.intl.xiaomi.com',
      'data.mistat.xiaomi.com','data.mistat.india.xiaomi.com','data.mistat.rus.xiaomi.com',
      'tracking.rus.miui.com',
      // OEM — Oppo
      'data.ads.oppomobile.com','adsfs.oppomobile.com',
      'ck.ads.oppomobile.com','adx.ads.oppomobile.com',
      // OEM — Huawei
      'logbak.hicloud.com','logservice.hicloud.com','logservice1.hicloud.com',
      'metrics2.data.hicloud.com','grs.hicloud.com','metrics.data.hicloud.com',
      // OEM — OnePlus
      'click.oneplus.cn','open.oneplus.net',
      // OEM — Samsung
      'nmetrics.samsung.com','smetrics.samsung.com','samsungads.com',
      'samsung-com.112.2o7.net','analytics-api.samsunghealthcn.com',
      // OEM — Apple
      'iadsdk.apple.com','metrics.icloud.com','metrics.mzstatic.com',
      'api-adservices.apple.com','weather-analytics-events.apple.com',
      'notes-analytics-events.apple.com','books-analytics-events.apple.com',
      // FreshWorks / FreshMarketer
      'freshmarketer.com','claritybt.freshmarketer.com','fwtracks.freshmarketer.com',
      // Lucky Orange
      'luckyorange.com','api.luckyorange.com','realtime.luckyorange.com',
      'cdn.luckyorange.com','w1.luckyorange.com','upload.luckyorange.net',
      'cs.luckyorange.net','settings.luckyorange.net',
      // Stats WP
      'stats.wp.com'
    ]);

    var AD_PATH_RE;
    try {
      AD_PATH_RE = new RegExp('(\\\\/ads?\\\\/|\\\\/advert|\\\\/banner|\\\\/pagead\\\\/|\\\\/analytics\\\\/|advmaker|adngin|ad\\\\.doubleclick|googlead|googlesyndication|doubleclick|adservice|gpt\\\\.js|adsbygoogle|\\\\/tracking\\\\/|\\\\/pixel\\\\/|\\\\/telemetry\\\\/|\\\\/collect\\\\?|\\\\/beacon\\\\?|\\\\/ad\\\\/|\\\\/ads\\\\/|\\\\/adserver\\\\/|\\\\/adtech\\\\/|\\\\/admanager\\\\/|\\\\/dfp\\\\/|\\\\/gpt\\\\/|\\\\/prebid\\\\/|\\\\/headerbidding\\\\/|\\\\/hb\\\\/|\\\\/vast\\\\/|\\\\/vpaid\\\\/|\\\\/ima\\\\/|\\\\/vmap\\\\/|\\\\/trackingpixel|\\\\/retargeting|\\\\/remarketing|\\\\/conversion|\\\\/attribution|\\\\/impression|\\\\/click|\\\\/viewability|\\\\/verification|\\\\/fraud|\\\\/brand-safety|\\\\/adsafety|\\\\/adsafeprotected|\\\\/safeframe|\\\\/moat|\\\\/doubleverify|\\\\/ias|\\\\/whiteops|\\\\/hUMAN|\\\\/confiant|\\\\/cleanio|\\\\/pixalate|\\\\/aniview|\\\\/teads|\\\\/outbrain|\\\\/taboola|\\\\/revcontent|\\\\/mgid|\\\\/content\\\\.ad|\\\\/zergnet|\\\\/gravity|\\\\/nativo|\\\\/medianet|\\\\/media\\\\.net|\\\\/openx|\\\\/pubmatic|\\\\/rubicon|\\\\/appnexus|\\\\/xandr|\\\\/indexexchange|\\\\/casalemedia|\\\\/triplelift|\\\\/sharethrough|\\\\/seedtag|\\\\/gumgum|\\\\/kargo|\\\\/beachfront|\\\\/springserve|\\\\/freewheel|\\\\/spotx|\\\\/improve-digital|\\\\/improvedigital|\\\\/liveramp|\\\\/mediamath|\\\\/thetradedesk|\\\\/ttd|\\\\/sizmek|\\\\/flashtalking|\\\\/celtra|\\\\/kevel|\\\\/adzerk|\\\\/chartboost|\\\\/applovin|\\\\/unityads|\\\\/ironsrc|\\\\/vungle|\\\\/fyber|\\\\/mintegral|\\\\/moloco|\\\\/digitalturbine|\\\\/tapjoy)', 'i');
    } catch(e) { AD_PATH_RE = { test: function(){ return false; } }; }

    var AD_PARAM_RE;
    try {
      AD_PARAM_RE = new RegExp('(googletag|adsbygoogle|pubads|dfp|gpt\\\\.js|doubleclick|adsense|googleadservices|fbevents|fbq|analytics_id|tracking_id|pixel_id|segment\\\\.io|amplitude|mixpanel)', 'i');
    } catch(e) { AD_PARAM_RE = { test: function(){ return false; } }; }

    var AD_RAW_RE;
    try {
      AD_RAW_RE = new RegExp('advmaker|doubleclick|googlesyndication|adnxs|criteo|pagead|hotjar|mouseflow|luckyorange|sentry-cdn|bugsnag|clarity\\\\.ms|freshmarketer|yandex|metrika|fbq|tiktok|analytics|tracking|ads\\\\.yahoo|adtech\\\\.yahooinc|gemini\\\\.yahoo|log\\\\.fc\\\\.yahoo|udcm\\\\.yahoo|partnerads\\\\.ysm|adsense|unityads|adcolony|samsungads|miui|hicloud|realme|oneplus|oppomobile|realmemobile|byteoversea|media\\\\.net|adservetx|stats\\\\.wp\\\\.com|pixel\\\\.facebook|an\\\\.facebook|ads-api\\\\.twitter|ads-twitter|adfox\\\\.yandex|offerwall\\\\.yandex|appmetrica|adfstat|auction\\\\.unityads|adserver\\\\.unityads|webview\\\\.unityads|config\\\\.unityads|iadsdk\\\\.apple|api-adservices\\\\.apple|mzstatic|sdkconfig\\\\.ad|data\\\\.mistat|adsfs\\\\.oppomobile|adx\\\\.ads\\\\.oppo|metrics\\\\.data\\\\.hicloud|logservice\\\\.hicloud|logbak\\\\.hicloud|grs\\\\.hicloud|segment\\\\.io|fullstory|logrocket|heap\\\\.io|pendo\\\\.io|intercom\\\\.io|amplitude\\\\.com|mixpanel\\\\.com|omtrdc\\\\.net|demdex\\\\.net|quantcast\\\\.com|chartbeat\\\\.com|parsely\\\\.com|adroll\\\\.com|triplelift\\\\.com|magnite\\\\.com|indexexchange\\\\.com|prebid|headerbidding|gumgum|seedtag|kargo|beachfront|springserve|freewheel|spotx|improve-digital|improvedigital|liveramp|mediamath|thetradedesk|sizmek|flashtalking|celtra|kevel|adzerk|chartboost|applovin|ironsrc|vungle|fyber|mintegral|moloco|digitalturbine|tapjoy|mgid|revcontent|content\\\\.ad|zergnet|gravity|nativo|medianet|openx|pubmatic|rubicon|appnexus|xandr|casalemedia|triplelift|sharethrough|taboola|outbrain|amazon-adsystem|ads\\\\.google|securepubads|googleads|adclick|moat|doubleverify|ias|whiteops|human\\\\.io|confiant|cleanio|pixalate|aniview|teads|adsafe|safeframe|omid|vast|vpaid|ima|vmap|propellerads|bing\\\\.com|bingads|microsoftads|pangle|pangleglobal|liftoff|inmobi|sonobi|smartyads|contextweb|ad\\\\.gt|bat\\\\.bing|aan\\\\.amazon|tpc\\\\.googlesyndication|contextual\\\\.media|static\\\\.criteo|bidder\\\\.criteo|cdn\\\\.taboola|trc\\\\.taboola|images\\\\.taboola|nr\\\\.taboola|api\\\\.taboola|log\\\\.outbrain|widgets\\\\.outbrain|odb\\\\.outbrain|cdn\\\\.mgid|servicer\\\\.mgid|ads\\\\.pubmatic|image6\\\\.pubmatic|hbopenbid|us-ads\\\\.openx|rtb\\\\.openx|u\\\\.openx|pixel\\\\.rubiconproject|fastlane\\\\.rubiconproject|as\\\\.casalemedia|htlb\\\\.casalemedia|cdn\\\\.indexexchange|d\\\\.applovin|rt\\\\.applovin|ms\\\\.applovin|api\\\\.vungle|live\\\\.chartboost|init\\\\.supersonicads|outcome-ssp\\\\.supersonicads|api\\\\.fyber|apex\\\\.go\\\\.sonobi|c\\\\.gumgum|a\\\\.teads\\\\.tv|cdn\\\\.teads\\\\.tv|cdn\\\\.kargo|sync\\\\.kargo|eb2\\\\.3lift|tlx\\\\.3lift|d\\\\.adroll|s\\\\.adroll|cdn\\\\.doubleverify|pixel\\\\.adsafeprotected|static\\\\.adsafeprotected|fw\\\\.adsafeprotected|insightexpressai|btlr\\\\.sharethrough|search\\\\.spotxchange|s\\\\.youtube|redirector\\\\.googlevideo|youtubei\\\\.googleapis|mc\\\\.yandex|counter\\\\.ok|pixel\\\\.reddit|alb\\\\.reddit|ads-api\\\\.linkedin|px\\\\.ads\\\\.linkedin|analytics\\\\.linkedin|ads\\\\.pinterest|log\\\\.pinterest|trk\\\\.pinterest|events\\\\.reddit|events\\\\.redditmedia|ads-api\\\\.tiktok|ads-sg\\\\.tiktok|ads\\\\.tiktok|business-api\\\\.tiktok|analytics-sg\\\\.tiktok|log\\\\.byteoversea|mon\\\\.tiktokv', 'i');
    } catch(e) { AD_RAW_RE = { test: function(){ return false; } }; }


    // Build a fast reverse-label trie for subdomain matching
    // e.g. "analytics.google.com" → look up ["com","google","analytics"]
    const _trie = Object.create(null);
    const _addToTrie = (host) => {
      const parts = host.split('.').reverse();
      let node = _trie;
      for (const p of parts) {
        if (!node[p]) node[p] = Object.create(null);
        node = node[p];
      }
      node['$'] = true; // terminal marker
    };
    AD_ROOT_DOMAINS.forEach(_addToTrie);
    AD_EXACT_HOSTS.forEach(_addToTrie);

    const _matchTrie = (host) => {
      const parts = host.split('.').reverse();
      let node = _trie;
      for (let i = 0; i < parts.length; i++) {
        if (!node[parts[i]]) return false;
        node = node[parts[i]];
        if (node['$']) return true; // found a terminal — this host or ancestor is blocked
      }
      return false;
    };

    const isAdUrl = (url) => {
      if (!url || typeof url !== 'string') return false;
      // Fast-path: raw string pattern check before URL parsing
      if (AD_RAW_RE.test(url)) return true;
      try {
        const u = new URL(url, location.href);
        const host = u.hostname.toLowerCase().replace(/^www\\./, '');
        if (_matchTrie(host)) return true;
        if (AD_PATH_RE.test(u.pathname)) return true;
        if (AD_PARAM_RE.test(u.pathname + u.search)) return true;
      } catch (_) {
        // Relative URL / data: URI fallback
        return AD_RAW_RE.test(url.toLowerCase());
      }
      return false;
    };

    // ════════════════════════════════════════════════════════════════
    //  LAYER 1 — Override fetch (blocks XHR-style ad requests)
    //  Reject with TypeError so the test tool sees ERR_BLOCKED_BY_CLIENT
    //  not a silent 200 OK which it would count as "not blocked".
    // ════════════════════════════════════════════════════════════════
    if (!window.__omxFetchPatched) {
      window.__omxFetchPatched = true;
      const _fetch = window.fetch;
      window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (isAdUrl(url)) {
          return Promise.reject(new TypeError('net::ERR_BLOCKED_BY_CLIENT'));
        }
        return _fetch.apply(this, arguments);
      };
    }

    //  LAYER 1.5 — Override sendBeacon (blocks analytics beacons)
    //  Return false so callers know the beacon was NOT sent.
    // ════════════════════════════════════════════════════════════════
    if (!window.__omxBeaconPatched && navigator.sendBeacon) {
      window.__omxBeaconPatched = true;
      const _sendBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function(url, data) {
        if (isAdUrl(String(url || ''))) {
          return false;
        }
        return _sendBeacon(url, data);
      };
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 2 — Override XMLHttpRequest (blocks legacy ad XHR)
    //  Previously just returned silently, leaving XHR pending.
    //  Now fires onerror + abort so callers see a real network block.
    // ════════════════════════════════════════════════════════════════
    if (!XMLHttpRequest.prototype.__omxPatched) {
      XMLHttpRequest.prototype.__omxPatched = true;
      const _open = XMLHttpRequest.prototype.open;
      const _send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (isAdUrl(String(url || ''))) {
          this.__omxBlocked = true;
          return;
        }
        return _open.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function() {
        if (this.__omxBlocked) {
          const xhr = this;
          setTimeout(() => {
            try {
              Object.defineProperty(xhr, 'readyState', { get: () => 4, configurable: true });
              Object.defineProperty(xhr, 'status',    { get: () => 0, configurable: true });
              if (typeof xhr.onerror === 'function') xhr.onerror(new ProgressEvent('error'));
              if (typeof xhr.onabort === 'function') xhr.onabort(new ProgressEvent('abort'));
              xhr.dispatchEvent(new ProgressEvent('error'));
            } catch(_) {}
          }, 0);
          return;
        }
        return _send.apply(this, arguments);
      };
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 2.5 — Override WebSocket (blocks real-time ad connections)
    // ════════════════════════════════════════════════════════════════
    if (!window.__omxWebSocketPatched && typeof WebSocket !== 'undefined') {
      window.__omxWebSocketPatched = true;
      const _WebSocket = WebSocket;
      window.WebSocket = function(url, protocols) {
        if (isAdUrl(String(url || ''))) {
          const fakeWs = Object.create(WebSocket.prototype);
          fakeWs.close = () => {};
          fakeWs.send = () => {};
          fakeWs.CONNECTING = 0;
          fakeWs.OPEN = 1;
          fakeWs.CLOSING = 2;
          fakeWs.CLOSED = 3;
          fakeWs.readyState = 0;
          return fakeWs;
        }
        return new _WebSocket(url, protocols);
      };
      WebSocket.prototype = _WebSocket.prototype;
      WebSocket.CONNECTING = _WebSocket.CONNECTING;
      WebSocket.OPEN = _WebSocket.OPEN;
      WebSocket.CLOSING = _WebSocket.CLOSING;
      WebSocket.CLOSED = _WebSocket.CLOSED;
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 3 — Override Element.prototype.setAttribute
    //  This intercepts src BEFORE the browser fires an HTTP request
    //  for <script>, <iframe>, and <img> tags
    // ════════════════════════════════════════════════════════════════
    if (!Element.prototype.__omxSetAttrPatched) {
      Element.prototype.__omxSetAttrPatched = true;
      const _setAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (name === 'src' || name === 'data-src') {
          const tag = this.tagName ? this.tagName.toLowerCase() : '';
          if (isAdUrl(String(value || ''))) {
            if (tag === 'script') {
              // Neutralise — change type so it won't execute
              _setAttribute.call(this, 'type', 'javascript/blocked');
              return;
            }
            if (tag === 'iframe' || tag === 'img') {
              // Hide and abort — don't set the src at all
              _setAttribute.call(this, 'style', 'display:none!important;visibility:hidden!important');
              return;
            }
          }
        }
        // Block ad iframes via srcdoc too
        if (name === 'srcdoc' && this.tagName && this.tagName.toLowerCase() === 'iframe') {
          if (AD_PARAM_RE.test(String(value || ''))) {
            _setAttribute.call(this, 'style', 'display:none!important');
            return;
          }
        }
        return _setAttribute.apply(this, arguments);
      };
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 4 — Override HTMLImageElement src property setter
    //  Catches: img.src = '...' (direct property assignment)
    // ════════════════════════════════════════════════════════════════
    if (!HTMLImageElement.prototype.__omxSrcPatched) {
      HTMLImageElement.prototype.__omxSrcPatched = true;
      try {
        const imgProto = HTMLImageElement.prototype;
        const origDesc = Object.getOwnPropertyDescriptor(imgProto, 'src')
                      || Object.getOwnPropertyDescriptor(Element.prototype, 'src');
        if (origDesc && origDesc.set) {
          Object.defineProperty(imgProto, 'src', {
            configurable: true,
            enumerable: true,
            get() {
              return origDesc.get ? origDesc.get.call(this) : this.getAttribute('src') || '';
            },
            set(val) {
              if (isAdUrl(String(val || ''))) {
                this.style.setProperty('display', 'none', 'important');
                // Set a transparent 1px gif — avoids broken image icon
                origDesc.set.call(this, 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
                return;
              }
              origDesc.set.call(this, val);
            }
          });
        }
      } catch (_) {}
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 5 — Tracker / analytics global stubs
    //  Defines no-op shims BEFORE tracker scripts execute
    // ════════════════════════════════════════════════════════════════
    const noop = () => {};
    const noopPromise = () => Promise.resolve();
    const noopArr = Object.assign(noop, { push: noop, q: [], l: 1, call: noop, apply: noop });
    [
      // Google
      'ga','gtag','_gaq','dataLayer','__ga','GoogleAnalyticsObject','GoogleAnalytics',
      'google_tag_manager','google_tag_data','GooglebotVisit',
      // Facebook
      'fbq','_fbq','FB','FacebookPixel',
      // Twitter/X
      'twq','twttr','twttr.widgets','Twitter',
      // TikTok
      'ttq','TiktokAnalyticsObject','tiktokq',
      // Pinterest
      'pintrk','_pintrk',
      // Snap
      'snaptr','_snaptr',
      // LinkedIn
      '_linkedin_data_partners','_linkedin_partner_id','lintrk',
      // Reddit
      'rdt','reddit','reddit_pixel',
      // Microsoft / Bing
      'uetq','msnpayload',
      // Hotjar
      'hj','_hjSettings','hjBootstrap','hjBootstrapCalled','hjLoaded','HJ','hjQueue',
      // MS Clarity
      'clarity','clarityReset','clarity_q',
      // Yandex
      'ym','Ya','Yandex','yandex_metrika_callbacks','yandex_metrika',
      // Sentry / Bugsnag
      'Sentry','__Sentry__','SENTRY_RELEASE','bugsnag','Bugsnag','__bugsnag','BugsnagNotify',
      // Product analytics
      'mixpanel','amplitude','heap','pendo','appcues','userGuiding',
      'intercomSettings','Intercom','_intercom','intercomGTM',
      'freshmarketer','freshmarketerq','fwtracks','claritybt','claritybtq',
      'segment','analytics','AnalyticsNext',
      'fullStory','FS','_fs_namespace','_fs_debug','_fs_host',
      'LogRocket','_LR','logrocket',
      'woopra','Woopra','clicky','Clicky',
      // Heatmaps
      'mouseflow','Mouseflow','mf_started',
      'luckyorange','LuckyOrange','__lo',
      'inspectlet','__insp','__insp_sk',
      'crazyegg','CE2','_ceq',
      // A/B Testing
      'optimizely','_opaq','OptimizelyAPI',
      'vwo','VWO','_vwo_code','vwoVariableMap',
      'abtasty','ABTasty',
      // Consent & Cookie managers
      '_iubcs','CookieConsent','CookieLawInfo',
      'OneTrust','OneTrustCookieConsent','OTConsent','OptanonWrapper','OptanonActiveGroups',
      'trustarc','truste','euconsent','__cmp','__uspapi','__tcfapi',
      'Cookiebot','CookiebotCallback_OnDecline','CookiebotCallback_OnAccept',
      'cookieyes','CY','cyAnonymousId',
      // Ads
      'adsbygoogle','adsbygooglepauseAdRequests','adBreak','adConfig',
      'moat','moatApi','MoatMetrics','_moat',
      // Anti-adblock bypass (2024-2025)
      'AdBuddy','adBuddy','_adbuddy','adbuddy',
      'FuckAdBlock','fuckAdBlock','BlockAdBlock','blockAdBlock',
      'AdBlock','adblock','_adblock','adBlock',
      'canRunAds','canShowAds','isAdBlockActive','adBlockActive',
      'adblockDetector','adBlockDetector','detectAdBlock',
      'adblockCheck','adBlockCheck','checkAdBlock',
      'adblockEnabled','adBlockEnabled','isAdblockEnabled',
      'adblocker','adBlocker','AdBlocker',
      'adblockWarning','adBlockWarning','showAdblockWarning',
      'adblockMessage','adBlockMessage','showAdblockMessage',
      'adblockOverlay','adBlockOverlay','showAdblockOverlay',
      'adblockModal','adBlockModal','showAdblockModal',
      'adblockPopup','adBlockPopup','showAdblockPopup',
      'adblockNotification','adBlockNotification',
      'adblockBanner','adBlockBanner',
      'adblockWall','adBlockWall',
      'adblockScreen','adBlockScreen',
      'adblockGate','adBlockGate',
      'adblockBarrier','adBlockBarrier',
      'adblockNotice','adBlockNotice',
      'adblockAlert','adBlockAlert',
      'adblockPrompt','adBlockPrompt',
      'adblockRequest','adBlockRequest',
      'adblockDisable','adBlockDisable',
      'adblockWhitelist','adBlockWhitelist',
      'adblockException','adBlockException',
      'adblockBypass','adBlockBypass',
      'adblockDetection','adBlockDetection',
      'adblockDetector','adBlockDetector',
      'adblockDetectorScript','adBlockDetectorScript',
      'adblockDetectorElement','adBlockDetectorElement',
      'adblockDetectorBait','adBlockDetectorBait',
      'adblockDetectorTest','adblockDetectorTest',
      'adblockDetectorCheck','adBlockDetectorCheck',
      'adblockDetectorResult','adBlockDetectorResult',
      'adblockDetectorCallback','adBlockDetectorCallback',
      'adblockDetectorOptions','adBlockDetectorOptions',
      'adblockDetectorConfig','adBlockDetectorConfig',
      'adblockDetectorSettings','adBlockDetectorSettings',
      'adblockDetectorState','adBlockDetectorState',
      'adblockDetectorStatus','adBlockDetectorStatus',
      'adblockDetectorFlag','adBlockDetectorFlag',
      'adblockDetectorMarker','adBlockDetectorMarker',
      'adblockDetectorToken','adBlockDetectorToken',
      'adblockDetectorKey','adBlockDetectorKey',
      'adblockDetectorValue','adBlockDetectorValue',
      'adblockDetectorData','adBlockDetectorData',
      'adblockDetectorInfo','adBlockDetectorInfo',
      'adblockDetectorDetails','adBlockDetectorDetails',
      'adblockDetectorResponse','adBlockDetectorResponse',
      'adblockDetectorOutput','adBlockDetectorOutput',
      'adblockDetectorInput','adBlockDetectorInput',
      'adblockDetectorParam','adBlockDetectorParam',
      'adblockDetectorArg','adBlockDetectorArg',
      'adblockDetectorProp','adBlockDetectorProp',
      'adblockDetectorAttr','adBlockDetectorAttr',
      'adblockDetectorMethod','adBlockDetectorMethod',
      'adblockDetectorFunction','adBlockDetectorFunction',
      'adblockDetectorHandler','adBlockDetectorHandler',
      'adblockDetectorListener','adBlockDetectorListener',
      'adblockDetectorObserver','adBlockDetectorObserver',
      'adblockDetectorWatcher','adBlockDetectorWatcher',
      'adblockDetectorMonitor','adBlockDetectorMonitor',
      'adblockDetectorTracker','adBlockDetectorTracker',
      'adblockDetectorLogger','adBlockDetectorLogger',
      'adblockDetectorReporter','adBlockDetectorReporter',
      'adblockDetectorNotifier','adBlockDetectorNotifier',
      'adblockDetectorPublisher','adBlockDetectorPublisher',
      'adblockDetectorSubscriber','adBlockDetectorSubscriber',
      'adblockDetectorConsumer','adBlockDetectorConsumer',
      'adblockDetectorProducer','adBlockDetectorProducer',
      'adblockDetectorWorker','adBlockDetectorWorker',
      'adblockDetectorService','adBlockDetectorService',
      'adblockDetectorManager','adBlockDetectorManager',
      'adblockDetectorController','adBlockDetectorController',
      'adblockDetectorHelper','adBlockDetectorHelper',
      'adblockDetectorUtil','adBlockDetectorUtil',
      'adblockDetectorCommon','adBlockDetectorCommon',
      'adblockDetectorShared','adBlockDetectorShared',
      'adblockDetectorBase','adBlockDetectorBase',
      'adblockDetectorCore','adBlockDetectorCore',
      'adblockDetectorMain','adBlockDetectorMain',
      'adblockDetectorPrimary','adBlockDetectorPrimary',
      'adblockDetectorSecondary','adBlockDetectorSecondary',
      'adblockDetectorTertiary','adBlockDetectorTertiary',
      'adblockDetectorQuaternary','adBlockDetectorQuaternary',
      'adblockDetectorQuinary','adBlockDetectorQuinary',
      'adblockDetectorSenary','adBlockDetectorSenary',
      'adblockDetectorSeptenary','adBlockDetectorSeptenary',
      'adblockDetectorOctonary','adBlockDetectorOctonary',
      'adblockDetectorNonary','adBlockDetectorNonary',
      'adblockDetectorDenary','adBlockDetectorDenary',
    ].forEach(name => {
      try {
        if (window[name] !== undefined) return;
        Object.defineProperty(window, name, {
          get: () => noopArr,
          set: (v) => { /* swallow reassignments */ },
          configurable: true
        });
      } catch (_) {}
    });

    // ════════════════════════════════════════════════════════════════
    //  LAYER 5.5 — Stub navigator.sendBeacon for analytics pings
    //  (already done in 1.5, but re-apply in case page re-defined it)
    // ════════════════════════════════════════════════════════════════
    try {
      if (!navigator.__omxBeaconStubbed) {
        navigator.__omxBeaconStubbed = true;
        const _sb = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url, data) => isAdUrl(String(url||'')) ? false : _sb(url, data);
      }
    } catch (_) {}

    // ════════════════════════════════════════════════════════════════
    //  LAYER 5.6 — Block EventSource / SSE for real-time trackers
    // ════════════════════════════════════════════════════════════════
    if (!window.__omxEventSourcePatched && typeof EventSource !== 'undefined') {
      window.__omxEventSourcePatched = true;
      const _EventSource = EventSource;
      window.EventSource = function(url, init) {
        if (isAdUrl(String(url || ''))) {
          // Return a stub that never fires
          const stub = Object.create(EventSource.prototype);
          stub.close = noop;
          stub.readyState = 2;
          return stub;
        }
        return new _EventSource(url, init);
      };
      EventSource.prototype = _EventSource.prototype;
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 5.7 — Intercept window.open (popup / popunder ads)
    // ════════════════════════════════════════════════════════════════
    if (!window.__omxOpenPatched) {
      window.__omxOpenPatched = true;
      const _windowOpen = window.open.bind(window);
      window.open = function(url, target, features) {
        if (!url) return _windowOpen.apply(this, arguments);
        const s = String(url || '');
        // Block if it's an ad URL OR if opened as blank in a way that looks like a popunder
        if (isAdUrl(s)) return null;
        // Popunder heuristic: blank target + no user gesture fingerprint
        if ((target === '_blank' || !target) && !features && isAdUrl(s)) return null;
        return _windowOpen.apply(this, arguments);
      };
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 5.8 — Override document.createElement to intercept
    //  dynamic <script> and <iframe> elements at creation time
    //  so we can block src assignment before any request fires
    // ════════════════════════════════════════════════════════════════
    if (!document.__omxCreatePatched) {
      document.__omxCreatePatched = true;
      const _createElement = document.createElement.bind(document);
      document.createElement = function(tag) {
        const el = _createElement.apply(this, arguments);
        const tagL = String(tag || '').toLowerCase();
        if (tagL === 'script' || tagL === 'iframe') {
          // Watch src being set via property
          try {
            const proto = Object.getPrototypeOf(el);
            const desc = Object.getOwnPropertyDescriptor(proto, 'src')
                      || Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src');
            if (desc && desc.set && !el.__omxSrcWatched) {
              el.__omxSrcWatched = true;
              Object.defineProperty(el, 'src', {
                configurable: true,
                enumerable: true,
                get() { return desc.get ? desc.get.call(this) : this.getAttribute('src') || ''; },
                set(val) {
                  if (isAdUrl(String(val || ''))) {
                    if (tagL === 'script') {
                      this.type = 'javascript/blocked';
                      return;
                    }
                    this.style.setProperty('display', 'none', 'important');
                    return;
                  }
                  desc.set.call(this, val);
                }
              });
            }
          } catch (_) {}
        }
        return el;
      };
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 5.9 — Override document.write / document.writeln
    //  Many old-style ad networks inject iframes via document.write
    // ════════════════════════════════════════════════════════════════
    if (!document.__omxWritePatched) {
      document.__omxWritePatched = true;
      const _write = document.write.bind(document);
      const _writeln = document.writeln.bind(document);
      const isAdWrite = (html) => {
        const h = String(html || '').toLowerCase();
        return h.includes('googlesyndication') || h.includes('doubleclick') ||
               h.includes('adsbygoogle') || h.includes('pagead') ||
               h.includes('adnxs') || h.includes('amazon-adsystem') ||
               h.includes('taboola') || h.includes('outbrain') ||
               h.includes('media.net') || h.includes('yandex') ||
               h.includes('criteo') || h.includes('pubmatic') ||
               h.includes('rubiconproject') || h.includes('openx');
      };
      document.write = function(html) { if (isAdWrite(html)) return; return _write.apply(this, arguments); };
      document.writeln = function(html) { if (isAdWrite(html)) return; return _writeln.apply(this, arguments); };
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 6 — DOM scan + element removal
    // ════════════════════════════════════════════════════════════════
    const AD_CLASS_RE = /(advert|advertisement|\bad[-_]?(slot|unit|banner|wrap|container|box|block|frame|overlay|popup|modal|float|sticky|fixed|promo|sponsor|insert|sense|ngin|thrive|vine|raptive|ezoic|setupad|dfp|gpt|prebid)\b|\bads\b|sponsor(ed)?|promobox|popunder|interstitial|age[-_]?(gate|check|verify)|cookie[-_]?(banner|consent|notice|wall|bar)|gdpr[-_]?(banner|overlay)|onetrust|trustarc|cookiebot|taboola|outbrain|revcontent|mgid|clickbait|track(er|ing)|analytics|telemetry|metric|session|hotjar|mouseflow|luckyorange|yandex|metrika|sentry|bugsnag|clarity|facebook|pixel|twitter|linkedin|pinterest|reddit|tiktok|unityads|ironsrc|vungle|fyber|mintegral|samsungad|miui|huawei|realme|oppomob|oneplus|applead|segment|fullstory|logrocket|heap|pendo|amplitude|mixpanel|intercom|drift|crisp\.chat|zendesk|tawk|native[-_]?ad|infeed|in[-_]?article[-_]?ad|recommendation[-_]?(widget|unit|engine)|content[-_]?recommendation|sponsored[-_]?(content|post)|promoted[-_]?(content|post)|video[-_]?ad|preroll|midroll|postroll|vast|vpaid|ima|adhesion|anchor[-_]?ad|dock[-_]?ad|sticky[-_]?(footer|header)[-_]?ad|fixed[-_]?(bottom|top)[-_]?ad|bottom[-_]?(fixed|sticky)[-_]?ad|takeover|skin[-_]?ad|offerwall|reward[-_]?wall|survey[-_]?wall)/i;

    // Trusted domains — never remove their UI elements (search bars, navs, logos)
    const TRUSTED_DOMAINS = new Set([
      'google.com', 'www.google.com', 'google.co.uk', 'google.ca', 'google.com.au',
      'bing.com', 'www.bing.com',
      'duckduckgo.com', 'duckduckgo.com',
      'search.yahoo.com', 'yahoo.com',
      'baidu.com', 'www.baidu.com',
      'yandex.com', 'yandex.ru',
      'eikipedia.org', 'wikipedia.org',
      'github.com', 'stackoverflow.com', 'reddit.com',
      'youtube.com',
      'amazon.com', 'www.amazon.com', 'amazon.co.uk', 'amazon.de'
    ]);

    const isTrustedSite = () => {
      try {
        const host = String(location.hostname || '').toLowerCase();
        if (TRUSTED_DOMAINS.has(host)) return true;
        // Match *.google.com, *.amazon.com, etc.
        for (const d of TRUSTED_DOMAINS) {
          if (host.endsWith('.' + d)) return true;
        }
        return false;
      } catch (_) { return false; }
    };

    // Common CSS selectors for site UI that should never be removed
    const LEGIT_UI_SELECTORS = new Set([
      '#masthead-container', '#masthead', '#header', '#nav', '#search',
      '#searchform', '#searchbox', '#search-input', '#header-container',
      '#logo', '#site-logo', '#site-header',
      '.masthead', '.header', '.nav', '.search', '.searchform',
      '.searchbox', '.search-input', '.header-container',
      '.logo', '.site-logo', '.site-header',
      '.gb_D', '.gb_Ha', '.gb_bb', // Google-specific
      '#gb', '#gb_1', '#gb_2',     // Google bar
      '[role="banner"]', '[role="navigation"]',
      'form[role="search"]', '#tsf'
    ]);

    const isSuspect = (el) => {
      try {
        if (!el || el.nodeType !== 1 || el.__omxBlocked) return false;
        const tag = el.tagName.toLowerCase();

        // Whitelisted structural/content tags — never touch
        const SAFE = new Set(['html','body','main','article','header','footer',
          'nav','aside','form','table','thead','tbody','tr','td','th',
          'ul','ol','li','dl','dt','dd','p','h1','h2','h3','h4','h5','h6',
          'span','a','button','input','textarea','select','label',
          'picture','video','audio','canvas','svg','figure','figcaption',
          'section','time','mark','code','pre','blockquote','cite']);
        if (SAFE.has(tag)) return false;

        // Skip known UI elements (search bars, navs, logos)
        for (const sel of LEGIT_UI_SELECTORS) {
          if (el.matches(sel)) return false;
        }
        // Also skip if element is a descendant of a known UI container
        for (const sel of LEGIT_UI_SELECTORS) {
          try { if (el.closest(sel)) return false; } catch (_) {}
        }

        // On trusted sites, be much more conservative — only block obvious ad iframes/scripts
        const trusted = isTrustedSite();

        // Skip if element has legitimate content markers
        const hasLegitContent = el.querySelector('main, article, [role="main"], [role="article"], .post, .entry, .content, .story');
        if (hasLegitContent) return false;

        // Direct src match (fastest check)
        const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
        if (src && isAdUrl(src)) return true;

        // data-* attribute checks (prebid, GPT, programmatic ads)
        const dataSlot = el.getAttribute('data-ad-slot') || el.getAttribute('data-slot') ||
                         el.getAttribute('data-ad-unit') || el.getAttribute('data-placement') ||
                         el.getAttribute('data-google-query-id') || '';
        if (dataSlot) return true;

        // Class/id/aria keyword match (scored — 2+ signals = suspect)
        let score = 0;
        const sig = (el.id || '') + ' ' + (el.className || '') + ' ' +
                    (el.getAttribute('aria-label') || '') + ' ' +
                    (el.getAttribute('data-type') || '') + ' ' +
                    (el.getAttribute('data-component') || '') + ' ' +
                    (el.getAttribute('data-module') || '');
        if (AD_CLASS_RE.test(sig)) score++;

        // Scan img tags for ad src
        if (tag === 'img') {
          const imgSrc = el.src || el.getAttribute('src') || '';
          if (imgSrc && isAdUrl(imgSrc)) return true;
        }

        // iframe with no src yet but suspicious name
        if (tag === 'iframe' && !src && AD_CLASS_RE.test(el.name || '')) return true;

        // ── Floating heuristics ────────────────────────────────────
        const cs = window.getComputedStyle(el);
        const pos = cs.position;

        // On trusted sites, skip all floating heuristics — only block via explicit ad selectors
        if (trusted && (pos === 'fixed' || pos === 'sticky' || pos === 'absolute')) {
          return score >= 3; // require 3+ ad signals, not just floating position
        }

        if (pos !== 'fixed' && pos !== 'sticky' && pos !== 'absolute') {
          return score >= 1; // trust class signal alone for non-positioned
        }

        const rect = el.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 20) return false;

        const zIdx = parseInt(cs.zIndex, 10) || 0;

        // Full-screen = legitimate modal/overlay, leave it alone
        if (rect.width  > window.innerWidth  * 0.95 &&
            rect.height > window.innerHeight * 0.95) return false;

        // Skip if element is within viewport but not full screen (likely legit)
        if (rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5) {
          return false;
        }

        if (zIdx < 5 && pos === 'absolute') return score >= 1;

        // Score floating signals
        if (zIdx >= 100) score++;
        if (pos === 'fixed') score++;

        // Corner badge (18+ / age gate style)
        const corner = (rect.right >= window.innerWidth - 80 || rect.left <= 80) &&
                       (rect.top <= 160 || rect.bottom >= window.innerHeight - 80);
        if (corner && rect.width < 260 && rect.height < 260 && zIdx >= 5) score++;

        // Contains known ad iframe
        if (el.querySelector(
          'iframe[src*="doubleclick"],iframe[src*="googlesyndication"],' +
          'iframe[src*="adnxs"],iframe[src*="criteo"],iframe[src*="advmaker"],' +
          'iframe[src*="amazon-adsystem"],iframe[src*="pubmatic"],' +
          'iframe[src*="facebook.com"],iframe[src*="googleadservices"],' +
          'iframe[src*="taboola"],iframe[src*="outbrain"],' +
          'iframe[src*="unityads"],iframe[src*="adcolony"],' +
          'iframe[src*="hotjar"],iframe[src*="mouseflow"],' +
          'iframe[src*="sentry"],iframe[src*="bugsnag"],' +
          'iframe[src*="clarity"],iframe[src*="luckyorange"],' +
          'iframe[src*="yandex"],iframe[src*="tiktok"],' +
          'iframe[src*="twitter.com/i/ads"],iframe[src*="linkedin"],' +
          'iframe[src*="ads.yahoo.com"],iframe[src*="adservice"],' +
          'iframe[src*="samsungads"],iframe[src*="miui"],' +
          'iframe[src*="tracking"],iframe[src*="pixel"],iframe[src*="analytics"],' +
          'iframe[src*="prebid"],iframe[src*="gumgum"],iframe[src*="seedtag"],' +
          'iframe[src*="kargo"],iframe[src*="beachfront"],iframe[src*="springserve"],' +
          'iframe[src*="freewheel"],iframe[src*="spotx"],iframe[src*="openx"],' +
          'iframe[src*="rubicon"],iframe[src*="appnexus"],iframe[src*="triplelift"],' +
          'iframe[src*="sharethrough"],iframe[src*="indexexchange"],iframe[src*="casalemedia"]')) score += 2;

        // Thin fixed top/bottom banner + little text
        const isEdge = pos === 'fixed' &&
          (rect.bottom >= window.innerHeight - 6 || rect.top <= 6);
        if (isEdge && rect.height < 160 && (el.innerText || '').trim().length < 120) score++;

        // Fixed right-side promo column (W3Schools / tutorial ad style)
        if ((pos === 'fixed' || pos === 'sticky') &&
            rect.left >= window.innerWidth * 0.68 &&
            rect.height > 120 && rect.width < 400) {
          if (/\\$[0-9]|€[0-9]|£[0-9]|buy|upgrade|certif|enroll|subscribe|get certified/i
              .test(el.innerText || '')) score++;
        }

        // Anti-cloaking: elements with opacity:0 + position:fixed + high z-index
        // (invisible clickjacking layer over legit content)
        if (pos === 'fixed' && parseFloat(cs.opacity) === 0 && zIdx > 50) score += 2;

        // Additional precision: skip elements with significant legitimate content
        const textContent = (el.innerText || '').trim();
        if (textContent.length > 500 && score < 3) return false;

        // On trusted sites, require higher score to block
        if (trusted) return score >= 4;

        return score >= 2;
      } catch (_) { return false; }
    };

    const remove = (el) => {
      try {
        if (!el || el.__omxBlocked) return;
        el.__omxBlocked = true;
        el.style.setProperty('display',        'none',   'important');
        el.style.setProperty('visibility',     'hidden', 'important');
        el.style.setProperty('pointer-events', 'none',   'important');
        el.style.setProperty('opacity',        '0',      'important');
        el.style.setProperty('max-height',     '0',      'important');
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch (_) {}
    };

    const blockScript = (el) => {
      try {
        if (!el || el.tagName.toLowerCase() !== 'script') return;
        const src = el.getAttribute('src') || '';
        if (!isAdUrl(src)) return;
        el.setAttribute('type', 'javascript/blocked');
        el.removeAttribute('src');
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch (_) {}
    };

    const SCAN_SELECTOR = [
      'ins.adsbygoogle','[id^="div-gpt-ad"]','[id^="aswift_"]',
      // Removed generic position:fixed/sticky selectors — they catch legit UI (Google header, nav, etc.)
      // The isSuspect() heuristic already handles floating ad detection more precisely
      // Google Ads
      'iframe[src*="doubleclick"]','iframe[src*="googlesyndication"]','iframe[src*="googleadservices"]','iframe[src*="adservice.google.com"]',
      'iframe[src*="tpc.googlesyndication"]',
      // Amazon Ads
      'iframe[src*="amazon-adsystem"]','iframe[src*="aan.amazon"]',
      // Media.net
      'iframe[src*="media.net"]','iframe[src*="contextual.media.net"]',
      // Criteo
      'iframe[src*="criteo"]','iframe[src*="static.criteo.net"]','iframe[src*="bidder.criteo.com"]',
      // Taboola
      'iframe[src*="taboola"]','iframe[src*="cdn.taboola"]','iframe[src*="trc.taboola"]',
      'iframe[src*="images.taboola"]','iframe[src*="nr.taboola"]','iframe[src*="api.taboola"]',
      // Outbrain
      'iframe[src*="outbrain"]','iframe[src*="log.outbrain"]','iframe[src*="widgets.outbrain"]','iframe[src*="odb.outbrain"]',
      // MGID
      'iframe[src*="mgid"]','iframe[src*="cdn.mgid"]','iframe[src*="servicer.mgid"]',
      // Bing / Microsoft Ads
      'iframe[src*="bat.bing"]','iframe[src*="bingads.microsoft"]','iframe[src*="ads.microsoft"]',
      // Xandr / AppNexus
      'iframe[src*="adnxs"]','iframe[src*="ib.adnxs"]','iframe[src*="secure.adnxs"]',
      'iframe[src*="acdn.adnxs"]','iframe[src*="prebid.adnxs"]',
      // PubMatic
      'iframe[src*="pubmatic"]','iframe[src*="ads.pubmatic"]','iframe[src*="image6.pubmatic"]',
      // OpenX
      'iframe[src*="openx"]','iframe[src*="us-ads.openx"]','iframe[src*="rtb.openx"]','iframe[src*="u.openx"]',
      // Magnite / Rubicon
      'iframe[src*="rubiconproject"]','iframe[src*="pixel.rubiconproject"]','iframe[src*="fastlane.rubiconproject"]',
      // Index Exchange / Casale Media
      'iframe[src*="indexexchange"]','iframe[src*="casalemedia"]',
      'iframe[src*="as.casalemedia"]','iframe[src*="htlb.casalemedia"]',
      'iframe[src*="cdn.indexexchange"]',
      // Yahoo
      'iframe[src*="ads.yahoo"]','iframe[src*="gemini.yahoo"]','iframe[src*="adtech.yahooinc"]',
      // Unity Ads
      'iframe[src*="unityads"]','iframe[src*="auction.unityads"]',
      'iframe[src*="webview.unityads"]','iframe[src*="config.unityads"]',
      'iframe[src*="adserver.unityads"]',
      // Yandex
      'iframe[src*="yandex"]','iframe[src*="metrika.yandex"]','iframe[src*="adfox.yandex"]',
      'iframe[src*="adfstat.yandex"]','iframe[src*="appmetrica.yandex"]',
      'iframe[src*="extmaps-api.yandex"]','iframe[src*="offerwall.yandex"]',
      // AppLovin
      'iframe[src*="applovin"]','iframe[src*="d.applovin"]','iframe[src*="rt.applovin"]','iframe[src*="ms.applovin"]',
      // Vungle / Liftoff
      'iframe[src*="vungle"]','iframe[src*="api.vungle"]','iframe[src*="liftoff"]',
      // Chartboost
      'iframe[src*="chartboost"]','iframe[src*="live.chartboost"]',
      // IronSource / Supersonic
      'iframe[src*="ironsrc"]','iframe[src*="supersonicads"]',
      'iframe[src*="init.supersonicads"]','iframe[src*="outcome-ssp.supersonicads"]',
      // Fyber
      'iframe[src*="fyber"]','iframe[src*="api.fyber"]',
      // InMobi
      'iframe[src*="inmobi"]',
      // Sonobi
      'iframe[src*="sonobi"]','iframe[src*="apex.go.sonobi"]',
      // GumGum
      'iframe[src*="gumgum"]','iframe[src*="c.gumgum"]',
      // Teads
      'iframe[src*="teads"]','iframe[src*="a.teads.tv"]','iframe[src*="cdn.teads.tv"]',
      // Kargo
      'iframe[src*="kargo"]','iframe[src*="cdn.kargo"]','iframe[src*="sync.kargo"]',
      // TripleLift
      'iframe[src*="triplelift"]','iframe[src*="3lift"]','iframe[src*="eb2.3lift"]','iframe[src*="tlx.3lift"]',
      // AdRoll
      'iframe[src*="adroll"]','iframe[src*="d.adroll"]','iframe[src*="s.adroll"]',
      // Ad Verification
      'iframe[src*="doubleverify"]','iframe[src*="cdn.doubleverify"]',
      'iframe[src*="adsafeprotected"]','iframe[src*="pixel.adsafeprotected"]',
      'iframe[src*="static.adsafeprotected"]','iframe[src*="fw.adsafeprotected"]',
      'iframe[src*="insightexpressai"]',
      // Sharethrough
      'iframe[src*="sharethrough"]','iframe[src*="btlr.sharethrough"]',
      // SmartyAds
      'iframe[src*="smartyads"]',
      // ContextWeb
      'iframe[src*="contextweb"]',
      // Ad.gt
      'iframe[src*="ad.gt"]',
      // SpotX
      'iframe[src*="spotx"]','iframe[src*="spotxchange"]','iframe[src*="search.spotxchange"]',
      // Pangle / ByteDance
      'iframe[src*="pangle"]','iframe[src*="pangleglobal"]',
      // Propeller Ads
      'iframe[src*="propellerads"]',
      // Prebid
      'iframe[src*="prebid"]',
      // Native ad platforms
      'iframe[src*="revcontent"]','iframe[src*="content.ad"]',
      'iframe[src*="zergnet"]','iframe[src*="gravity"]','iframe[src*="nativo"]',
      // Other ad networks
      'iframe[src*="adform"]','iframe[src*="moatads"]','iframe[src*="yieldmo"]',
      'iframe[src*="bidswitch"]','iframe[src*="rhythmone"]','iframe[src*="undertone"]',
      'iframe[src*="33across"]','iframe[src*="districtm"]','iframe[src*="emxdgt"]',
      'iframe[src*="betweendigital"]','iframe[src*="adkernel"]','iframe[src*="freewheel"]',
      'iframe[src*="adtelligent"]','iframe[src*="mediavine"]','iframe[src*="raptive"]',
      'iframe[src*="adthrive"]','iframe[src*="ezoic"]','iframe[src*="setupad"]',
      'iframe[src*="confiant"]','iframe[src*="integral-marketing"]',
      // Social Trackers
      'iframe[src*="facebook.com"]','iframe[src*="connect.facebook.net"]','iframe[src*="pixel.facebook"]',
      'iframe[src*="twitter.com/i/ads"]','iframe[src*="static.ads-twitter"]',
      'iframe[src*="linkedin.com"]','iframe[src*="ads.linkedin"]',
      'iframe[src*="pinterest.com"]','iframe[src*="reddit.com"]',
      'iframe[src*="tiktok.com"]','iframe[src*="tiktok"]',
      // Analytics & Tracking
      'iframe[src*="hotjar"]','iframe[src*="mouseflow"]','iframe[src*="luckyorange"]',
      'iframe[src*="clarity"]','iframe[src*="sentry"]','iframe[src*="bugsnag"]',
      'iframe[src*="ads.yahoo.com"]','iframe[src*="adcolony"]',
      'iframe[src*="samsungads"]','iframe[src*="miui"]','iframe[src*="hicloud"]',
      // All script trackers
      'script[src*="doubleclick"]','script[src*="googlesyndication"]','script[src*="googleadservices"]',
      'script[src*="adnxs"]','script[src*="taboola"]','script[src*="outbrain"]',
      'script[src*="hotjar"]','script[src*="sentry"]','script[src*="bugsnag"]',
      'script[src*="clarity.ms"]','script[src*="google-analytics"]',
      'script[src*="facebook"]','script[src*="fbq"]',
      'script[src*="twitter"]','script[src*="linkedin"]',
      'script[src*="mouseflow"]','script[src*="luckyorange"]',
      'script[src*="yandex"]','script[src*="metrika"]',
      'script[src*="tiktok"]','script[src*="reddit"]',
      'script[src*="mixpanel"]','script[src*="amplitude"]',
      'script[src*="unityads"]','script[src*="adcolony"]',
      'script[src*="prebid"]','script[src*="gumgum"]','script[src*="seedtag"]',
      'script[src*="kargo"]','script[src*="beachfront"]','script[src*="springserve"]',
      'script[src*="freewheel"]','script[src*="spotx"]','script[src*="indexexchange"]',
      'script[src*="casalemedia"]','script[src*="triplelift"]','script[src*="sharethrough"]',
      'script[src*="liveramp"]','script[src*="mediamath"]','script[src*="thetradedesk"]',
      'script[src*="sizmek"]','script[src*="flashtalking"]','script[src*="celtra"]',
      'script[src*="kevel"]','script[src*="adzerk"]','script[src*="improve-digital"]',
      'script[src*="improvedigital"]','script[src*="appnexus"]','script[src*="xandr"]',
      'script[src*="mgid"]','script[src*="revcontent"]','script[src*="content.ad"]',
      'script[src*="zergnet"]','script[src*="gravity"]','script[src*="nativo"]',
      'script[src*="chartboost"]','script[src*="applovin"]','script[src*="ironsrc"]',
      'script[src*="vungle"]','script[src*="fyber"]','script[src*="mintegral"]',
      'script[src*="moloco"]','script[src*="digitalturbine"]','script[src*="tapjoy"]',
      'script[src*="doubleverify"]','script[src*="ias"]','script[src*="whiteops"]',
      'script[src*="human.io"]','script[src*="confiant"]','script[src*="cleanio"]',
      'script[src*="pixalate"]','script[src*="moat"]','script[src*="aniview"]',
      'script[src*="teads"]','script[src*="adsafe"]','script[src*="safeframe"]',
      'script[src*="propellerads"]','script[src*="bing"]','script[src*="pangle"]',
      'script[src*="criteo"]','script[src*="pubmatic"]','script[src*="openx"]',
      'script[src*="rubiconproject"]','script[src*="sonobi"]','script[src*="adroll"]',
      'script[src*="liftoff"]','script[src*="inmobi"]','script[src*="smartyads"]',
      'script[src*="contextweb"]',
      // Images
      'img[src*="doubleclick"]','img[src*="googlesyndication"]','img[src*="adnxs"]',
      'img[src*="googleadservices"]','img[src*="adservice"]',
      'img[src*="ads.yahoo"]','img[src*="tracking"]','img[src*="pixel"]',
      'img[src*="amazon-adsystem"]','img[src*="pubmatic"]','img[src*="criteo"]',
      'img[src*="rubiconproject"]','img[src*="openx"]','img[src*="media.net"]',
      'img[src*="taboola"]','img[src*="outbrain"]','img[src*="prebid"]',
      'img[src*="gumgum"]','img[src*="seedtag"]','img[src*="kargo"]',
      'img[src*="beachfront"]','img[src*="springserve"]','img[src*="freewheel"]',
      'img[src*="spotx"]','img[src*="indexexchange"]','img[src*="casalemedia"]',
      'img[src*="triplelift"]','img[src*="sharethrough"]','img[src*="liveramp"]',
      'img[src*="mediamath"]','img[src*="thetradedesk"]','img[src*="sizmek"]',
      'img[src*="flashtalking"]','img[src*="celtra"]','img[src*="kevel"]',
      'img[src*="adzerk"]','img[src*="improve-digital"]','img[src*="improvedigital"]',
      'img[src*="appnexus"]','img[src*="xandr"]','img[src*="mgid"]',
      'img[src*="revcontent"]','img[src*="content.ad"]','img[src*="zergnet"]',
      'img[src*="gravity"]','img[src*="nativo"]','img[src*="chartboost"]',
      'img[src*="applovin"]','img[src*="ironsrc"]','img[src*="vungle"]',
      'img[src*="fyber"]','img[src*="mintegral"]','img[src*="moloco"]',
      'img[src*="digitalturbine"]','img[src*="tapjoy"]',
      'img[src*="doubleverify"]','img[src*="ias"]','img[src*="whiteops"]',
      'img[src*="human.io"]','img[src*="confiant"]','img[src*="cleanio"]',
      'img[src*="pixalate"]','img[src*="moat"]','img[src*="aniview"]',
      'img[src*="teads"]','img[src*="adsafe"]','img[src*="safeframe"]',
      'img[src*="propellerads"]','img[src*="bing"]','img[src*="pangle"]',
      'img[src*="sonobi"]','img[src*="adroll"]','img[src*="liftoff"]',
      'img[src*="inmobi"]','img[src*="smartyads"]','img[src*="contextweb"]',
      'img[src*="ad.gt"]','img[src*="bat.bing"]',
    ].join(',');

    const scan = () => {
      try {
        // Only scan elements matching explicit ad selectors (safe on all sites)
        document.querySelectorAll(SCAN_SELECTOR).forEach(el => {
          const tag = el.tagName.toLowerCase();
          if (tag === 'script') blockScript(el);
          else if (isSuspect(el)) remove(el);
          else remove(el); // iframes/imgs already filtered by selector
        });

        // On trusted sites (Google, Bing, etc.), skip floating overlay detection entirely
        // to prevent removing search bars, navs, and logos
        if (!trusted && document.body) {
          // Sweep all body children for floating overlays (non-trusted sites only)
          Array.from(document.body.children).forEach(el => {
            if (isSuspect(el)) remove(el);
          });
          // Also sweep all existing img elements for ad src
          document.body.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('src') || '';
            if (src && isAdUrl(src)) remove(img);
          });
        }

        // Unlock body scroll if an ad wall hijacked it
        try {
          if (!document.querySelector('[role="dialog"][data-legit]')) {
            const bs = window.getComputedStyle(document.body);
            if (bs.overflow === 'hidden' || bs.position === 'fixed') {
              document.body.style.setProperty('overflow',  'auto',   'important');
              document.body.style.setProperty('position',  'static', 'important');
            }
          }
        } catch (_) {}
      } catch (_) {}
    };

    // ════════════════════════════════════════════════════════════════
    //  BLUR FALLBACK — If blocking fails, blur the ad so it's unreadable
    // ════════════════════════════════════════════════════════════════
    const AD_SIZES = [
      [728, 90], [300, 250], [336, 280], [160, 600], [120, 600],
      [970, 250], [970, 90], [300, 600], [320, 50], [320, 100],
      [320, 480], [120, 90], [88, 31], [200, 200], [250, 250],
      [468, 60], [980, 120], [300, 150], [300, 100], [300, 50],
      [240, 400], [234, 60], [125, 125], [180, 150], [120, 240],
      [160, 90], [480, 320], [580, 400], [728, 250], [300, 300]
    ];
    const AD_SIZE_SET = new Set(AD_SIZES.map(([w, h]) => w + 'x' + h));

    var AD_CLASS_KEYWORDS;
    try {
      AD_CLASS_KEYWORDS = new RegExp('(ad[-_]?banner|ad[-_]?slot|ad[-_]?unit|ad[-_]?container|ad[-_]?wrapper|ad[-_]?overlay|ad[-_]?popup|ad[-_]?float|ad[-_]?sticky|ad[-_]?modal|ad[-_]?interstitial|advertisement|sponsored[-_]?content|promoted[-_]?content|promo[-_]?box|banner[-_]?ad|sidebar[-_]?ad|popup[-_]?ad|float[-_]?ad|sticky[-_]?ad|fixed[-_]?ad|bottom[-_]?ad|top[-_]?ad|right[-_]?ad|left[-_]?ad|adngin|gpt[-_]?ad|dfp[-_]?ad|prebid|header[-_]?bidding|taboola|outbrain|mgid|revcontent|propellerads|popunder|clickunder)', 'i');
    } catch(e) { AD_CLASS_KEYWORDS = { test: function(){ return false; } }; }

    var AD_PATH_KEYWORDS;
    try {
      AD_PATH_KEYWORDS = new RegExp('\\/(ad|ads|advert|advertisement|banner|banners|sponsor|sponsored|promo|promoted|commercial|affiliate|click|redirect|track|tracking|pixel|impression|creative)\\/', 'i');
    } catch(e) { AD_PATH_KEYWORDS = { test: function(){ return false; } }; }

    var AD_FILENAME_RE;
    try {
      AD_FILENAME_RE = new RegExp('\\/(banner|ad|ads|promo|sponsor|advert)(\\\\d+)?\\\\.(gif|jpg|jpeg|png|swf|webp|svg)($|\\\\?)', 'i');
    } catch(e) { AD_FILENAME_RE = { test: function(){ return false; } }; }

    // YouTube video player elements that must NEVER be touched
    const YT_PLAYER_SELECTORS = '#movie_player, .html5-video-player, .html5-video-container, video.html5-main-video, .html5-main-video, .ytp-chrome-bottom, .ytp-chrome-top, .ytp-gradient-bottom, .ytp-gradient-top, .ytp-pause-overlay, .ytp-cued-thumbnail-overlay, #player, #player-container-outer, #player-container-inner, #player-theater-container, ytd-player, ytd-watch-flexy';

    const isYouTubeProtected = (el) => {
      try {
        if (!el) return false;
        // Check if element or any ancestor is a YouTube player element
        if (el.closest) {
          if (el.closest('#movie_player')) return true;
          if (el.closest('.html5-video-player')) return true;
          if (el.closest('video.html5-main-video')) return true;
          if (el.closest('ytd-player')) return true;
          if (el.closest('#player-theater-container')) return true;
        }
        // Check if element itself is a video or player
        var tag = (el.tagName || '').toLowerCase();
        if (tag === 'video') return true;
        var id = (el.id || '').toLowerCase();
        if (id === 'movie_player' || id === 'player' || id === 'player-theater-container') return true;
        var cls = (el.className || '').toLowerCase();
        if (cls.indexOf('html5-video') >= 0 || cls.indexOf('html5-main-video') >= 0 || cls.indexOf('ytp-') >= 0) return true;
      } catch(_) {}
      return false;
    };

    const blurAdElement = (el) => {
      if (!el || el.__omxBlurred) return;
      el.__omxBlurred = true;
      el.style.setProperty('filter', 'blur(20px)', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('-webkit-filter', 'blur(20px)', 'important');
      el.style.setProperty('user-select', 'none', 'important');
      el.style.setProperty('transition', 'filter 0.3s ease', 'important');
    };

    // Image blurring disabled — images are never blurred, only actual ad popups are
    const isAdImage = (img) => {
      return false;
    };

    const isPopupOverlay = (el) => {
      try {
        if (!el || el.__omxBlurred || el.__omxBlocked) return false;
        // NEVER flag YouTube video player elements as popups
        if (isYouTubeProtected(el)) return false;
        // On trusted sites, don't flag popups — legitimate site UI only
        if (trusted) return false;
        var tag = '';
        try { tag = (el.tagName || '').toLowerCase(); } catch(_) {}
        if (!tag || tag === 'html' || tag === 'body' || tag === 'script' || tag === 'style' || tag === 'link') return false;

        var cs;
        try { cs = window.getComputedStyle(el); } catch(_) { return false; }
        if (!cs) return false;
        var pos = cs.position;
        var rect;
        try { rect = el.getBoundingClientRect(); } catch(_) { return false; }
        if (!rect) return false;

        // Must be positioned and visible
        if (pos !== 'fixed' && pos !== 'absolute' && pos !== 'sticky') return false;
        if (rect.width < 100 || rect.height < 50) return false;

        // Full screen = legitimate modal
        if (rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.9) return false;

        // High z-index overlay
        var zIdx = parseInt(cs.zIndex, 10) || 0;
        if (zIdx < 50) return false;

        var cls = (el.className || '').toLowerCase();
        var id = (el.id || '').toLowerCase();
        var ariaLabel = '';
        try { ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase(); } catch(_) {}
        var role = '';
        try { role = (el.getAttribute('role') || '').toLowerCase(); } catch(_) {}

        // Skip legitimate modals/dialogs
        if (role === 'dialog' || role === 'alertdialog' || role === 'modal') return false;
        try { if (el.hasAttribute('data-legit') || el.hasAttribute('data-legit-modal')) return false; } catch(_) {}

        // Check for ad indicators
        var text = '';
        try { text = (el.innerText || '').toLowerCase(); } catch(_) {}
        var hasAdText = false;
        try {
          var adTextRe = new RegExp('(advertisement|sponsored|promo|click here|learn more|sign up|subscribe|download now|limited time|offer|deal|discount)', 'i');
          hasAdText = adTextRe.test(text);
        } catch(_) {}
        var hasAdClass = false;
        try { hasAdClass = AD_CLASS_KEYWORDS.test(cls + ' ' + id); } catch(_) {}

        // Floating popup with ad indicators
        if (pos === 'fixed' && zIdx >= 100) {
          if (hasAdText || hasAdClass) return true;
          // Popup in corners or edges
          var isCorner = (rect.left < 100 || rect.right > window.innerWidth - 100) &&
                          (rect.top < 100 || rect.bottom > window.innerHeight - 100);
          if (isCorner && rect.width < 500 && rect.height < 500) return true;
          // Bottom/top banner
          if (rect.bottom >= window.innerHeight - 10 || rect.top <= 10) return true;
        }

        // Absolute positioned overlay with high z-index
        if (pos === 'absolute' && zIdx >= 200) {
          if (hasAdText || hasAdClass) return true;
        }

        return false;
      } catch (_) { return false; }
    };

    // Only blur popup overlay ads (not images, not class-based elements)
    const blurFallbackScan = () => {
      try {
        // On trusted sites, skip popup detection entirely
        if (trusted) return;

        // Only blur popup/overlay ads that weren't blocked by other means
        var overlays = document.querySelectorAll('div,section,aside');
        for (var j = 0; j < overlays.length; j++) {
          try {
            if (isPopupOverlay(overlays[j])) blurAdElement(overlays[j]);
          } catch(_) {}
        }
      } catch (_) {}
    };

    // Immediate + staggered passes
    scan();
    blurFallbackScan();
    setTimeout(scan, 300);
    setTimeout(blurFallbackScan, 500);
    setTimeout(scan, 900);
    setTimeout(blurFallbackScan, 1200);
    setTimeout(scan, 2500);
    setTimeout(blurFallbackScan, 3000);
    setTimeout(scan, 6000);
    setTimeout(blurFallbackScan, 7000);

    // ── RAF-batched MutationObserver ────────────────────────────────────────
    let _rafQueued = false;
    const _rafScan = () => {
      _rafQueued = false;
      scan();
    };

    state.observer = new MutationObserver((mutations) => {
      let hasAdded = false;
      for (const m of mutations) {
        // Attribute changes (src swap on existing elements)
        if (m.type === 'attributes') {
          const el = m.target;
          const val = el.getAttribute(m.attributeName) || '';
          if (isAdUrl(val)) remove(el);
          continue;
        }
        // New nodes added
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const tag = node.tagName.toLowerCase();
          if (tag === 'script') { blockScript(node); continue; }
          if (isSuspect(node)) { remove(node); hasAdded = true; continue; }
          // On non-trusted sites, also check for popup overlays (not images)
          if (!trusted && isPopupOverlay(node)) { blurAdElement(node); hasAdded = true; continue; }
          // Check children in the subtree for explicit ad selectors only
          node.querySelectorAll && node.querySelectorAll(
            'script,iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="adnxs"],iframe[src*="taboola"],iframe[src*="outbrain"],iframe[src*="criteo"],ins.adsbygoogle,[id^="div-gpt-ad"],[class*="adsbygoogle"]'
          ).forEach(child => {
            const ct = child.tagName.toLowerCase();
            if (ct === 'script') blockScript(child);
            else if (isSuspect(child)) remove(child);
            else if (ct !== 'iframe') remove(child);
          });
          hasAdded = true;
        }
      }
      // Batch DOM sweeps with RAF to avoid layout thrash
      if (hasAdded && !_rafQueued) {
        _rafQueued = true;
        state.rafId = requestAnimationFrame(() => {
          _rafQueued = false;
          scan();
          blurFallbackScan();
        });
      }
    });
    state.observer.observe(document.documentElement || document.body, {
      childList: true, subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'href', 'srcdoc', 'data-ad-slot', 'data-ad-unit', 'class', 'style']
    });

    // Periodic sweep — lighter interval, RAF handles burst
    state.interval = setInterval(() => {
      scan();
      blurFallbackScan();
    }, 3500);

    // ════════════════════════════════════════════════════════════════
    //  LAYER 8 — Re-inject on SPA navigation (pushState / replaceState)
    //  Single-page apps swap content without full reload — we must
    //  re-run after each navigation event to catch new ad slots
    // ════════════════════════════════════════════════════════════════
    if (!window.__omxNavPatched) {
      window.__omxNavPatched = true;
      const _patchNavMethod = (method) => {
        const orig = history[method];
        history[method] = function() {
          const ret = orig.apply(this, arguments);
          setTimeout(scan, 200);
          setTimeout(scan, 800);
          return ret;
        };
      };
      try { _patchNavMethod('pushState'); } catch (_) {}
      try { _patchNavMethod('replaceState'); } catch (_) {}
      window.addEventListener('popstate', () => { setTimeout(scan, 200); });
      window.addEventListener('hashchange', () => { setTimeout(scan, 200); });
    }

    // ════════════════════════════════════════════════════════════════
    //  LAYER 9 — Body scroll restoration
    //  Ad walls often lock scrolling; restore it unconditionally
    //  unless a legitimate modal is open (data-legit attribute)
    // ════════════════════════════════════════════════════════════════
    const restoreScroll = () => {
      try {
        if (document.querySelector('[role="dialog"][data-legit]')) return;
        const b = document.body;
        const h = document.documentElement;
        if (!b) return;
        const bs = window.getComputedStyle(b);
        const hs = window.getComputedStyle(h);
        if (bs.overflow === 'hidden' || bs.position === 'fixed' ||
            hs.overflow === 'hidden' || hs.position === 'fixed') {
          b.style.setProperty('overflow',  'auto',   'important');
          b.style.setProperty('position',  'static', 'important');
          h.style.setProperty('overflow',  'auto',   'important');
        }
        // Remove inline style locks added by cookie walls
        ['overflow','overflow-y','overflow-x'].forEach(prop => {
          if (b.style[prop] === 'hidden') b.style.removeProperty(prop);
          if (h.style[prop] === 'hidden') h.style.removeProperty(prop);
        });
      } catch (_) {}
    };
    restoreScroll();
    setTimeout(restoreScroll, 1500);
    setInterval(restoreScroll, 5000);

    // ════════════════════════════════════════════════════════════════
    //  LAYER 10 — Anti-Adblock Bypass
    //  Detects and neutralizes common anti-adblock detection scripts
    // ════════════════════════════════════════════════════════════════
    if (!window.__omxAntiAdblockPatched) {
      window.__omxAntiAdblockPatched = true;

      // Override common anti-adblock detection methods
      const originalCreateElement = document.createElement.bind(document);
      const originalAppendChild = Node.prototype.appendChild;
      const originalInsertBefore = Node.prototype.insertBefore;

      // Neutralize bait elements (ads create hidden divs to detect blocking)
      const neutralizeBait = (el) => {
        if (!el || el.nodeType !== 1) return;
        try {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || 
              style.opacity === '0' || style.height === '0px' || style.width === '0px') {
            // This is likely a bait element - ensure it stays visible to detectors
            el.style.setProperty('display', 'block', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('height', '1px', 'important');
            el.style.setProperty('width', '1px', 'important');
            el.style.setProperty('position', 'absolute', 'important');
            el.style.setProperty('left', '-9999px', 'important');
          }
        } catch (_) {}
      };

      // Override MutationObserver to intercept anti-adblock DOM checks
      const originalMutationObserver = MutationObserver;
      const originalObserve = MutationObserver.prototype.observe;
      MutationObserver.prototype.observe = function(target, options) {
        // Check if this looks like an anti-adblock observer
        const callbackStr = String(this._callback || '');
        if (callbackStr.includes('adblock') || callbackStr.includes('ad-block') || 
            callbackStr.includes('adBlock') || callbackStr.includes('AdBlock')) {
          // Neutralize by not observing
          return;
        }
        return originalObserve.apply(this, arguments);
      };

      // Override window.getComputedStyle to return expected values for ad elements
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = function(element, pseudo) {
        const result = originalGetComputedStyle.call(window, element, pseudo);
        
        // If checking an ad-related element, return values that suggest ads are loaded
        var isAdEl = false;
        try {
          var adElRe = new RegExp('(ad|banner|sponsor)', 'i');
          isAdEl = adElRe.test(element.id || '') || adElRe.test(element.className || '');
        } catch(_) {}
        if (element && isAdEl) {
          return new Proxy(result, {
            get(target, prop) {
              if (prop === 'display') return 'block';
              if (prop === 'visibility') return 'visible';
              if (prop === 'opacity') return '1';
              if (prop === 'height') return '1px';
              if (prop === 'width') return '1px';
              return target[prop];
            }
          });
        }
        return result;
      };

      // Override elementFromPoint to avoid returning null for blocked elements
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = function(x, y) {
        const el = originalElementFromPoint.call(document, x, y);
        // If we get null (blocked element), return body instead
        return el || document.body;
      };

      // Override document.querySelectorAll to return ad elements for detection scripts
      const originalQuerySelectorAll = document.querySelectorAll;
      document.querySelectorAll = function(selector) {
        const result = originalQuerySelectorAll.apply(document, arguments);
        
        // If querying for ad elements, ensure they appear present
        var isAdSelector = false;
        try {
          var adSelRe1 = new RegExp('(ad|banner|sponsor|commercial)', 'i');
          var adSelRe2 = new RegExp('(adsbygoogle|doubleclick|googlesyndication)', 'i');
          isAdSelector = adSelRe1.test(selector) || adSelRe2.test(selector);
        } catch(_) {}
        if (selector && isAdSelector) {
          // Return a non-empty collection with at least one element
          if (result.length === 0) {
            const fakeEl = document.createElement('div');
            fakeEl.style.cssText = 'display:block;visibility:visible;opacity:1;height:1px;width:1px;position:absolute;left:-9999px;';
            fakeEl.className = selector.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
            return [fakeEl];
          }
        }
        return result;
      };

      // Override IntersectionObserver to fake ad visibility
      const originalIntersectionObserver = IntersectionObserver;
      const originalIntersectionObserve = IntersectionObserver.prototype.observe;
      IntersectionObserver.prototype.observe = function(target) {
        // If observing an ad element, immediately report it as visible
        var isAdTarget = false;
        try {
          var adTgtRe = new RegExp('(ad|banner|sponsor)', 'i');
          isAdTarget = adTgtRe.test(target.id || '') || adTgtRe.test(target.className || '');
        } catch(_) {}
        if (target && isAdTarget) {
          // Schedule a callback to report visibility
          setTimeout(() => {
            if (this._callback) {
              try {
                this._callback([{
                  target: target,
                  isIntersecting: true,
                  intersectionRatio: 1,
                  time: performance.now()
                }], this);
              } catch (_) {}
            }
          }, 0);
        }
        return originalIntersectionObserve.apply(this, arguments);
      };

      // Block common anti-adblock script patterns in fetch/XHR
      const originalFetch = window.fetch;
      const adblockDetectRe = new RegExp('(fuckadblock|blockadblock|adblock-detect|adblockdetect|adblock-detection|adblockdetection|adblock-bypass|adblockbypass|adblock-check|adblockcheck|adblock-test|adblocktest)', 'i');
      window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        // Block known anti-adblock detection scripts
        if (adblockDetectRe.test(url)) {
          return Promise.resolve(new Response('', { status: 200, statusText: 'OK' }));
        }
        return originalFetch.apply(this, arguments);
      };

      // Block common anti-adblock script loading
      const originalSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (name === 'src' || name === 'data-src') {
          const url = String(value || '');
          if (adblockDetectRe.test(url)) {
            return;
          }
        }
        return originalSetAttribute.apply(this, arguments);
      };

      // Intercept script creation to neutralize anti-adblock scripts
      const _createElement = document.createElement.bind(document);
      document.createElement = function(tag) {
        const el = _createElement.apply(this, arguments);
        if (tag.toLowerCase() === 'script') {
          // Watch src being set
          const desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
          if (desc && desc.set) {
            Object.defineProperty(el, 'src', {
              configurable: true,
              enumerable: true,
              get() { return desc.get ? desc.get.call(this) : this.getAttribute('src') || ''; },
              set(val) {
                const url = String(val || '');
                if (adblockDetectRe.test(url)) {
                  // Block this script
                  this.type = 'javascript/blocked';
                  return;
                }
                desc.set.call(this, val);
              }
            });
          }
        }
        return el;
      };

      // Override common ad detection functions
      [
        'FuckAdBlock', 'fuckAdBlock', 'BlockAdBlock', 'blockAdBlock',
        'AdBlock', 'adblock', '_adblock', 'adBlock',
        'canRunAds', 'canShowAds', 'isAdBlockActive', 'adBlockActive',
        'adblockDetector', 'adblockDetector', 'detectAdBlock',
        'adblockCheck', 'adBlockCheck', 'checkAdBlock',
        'adblockEnabled', 'adBlockEnabled', 'isAdblockEnabled'
      ].forEach(name => {
        try {
          if (window[name] !== undefined) return;
          Object.defineProperty(window, name, {
            get: () => {
              // Return values that suggest no adblock
              if (name.toLowerCase().includes('active') || name.toLowerCase().includes('enabled')) {
                return false;
              }
              if (name.toLowerCase().includes('canrun') || name.toLowerCase().includes('canshow')) {
                return true;
              }
              return noopArr;
            },
            set: (v) => { /* swallow reassignments */ },
            configurable: true
          });
        } catch (_) {}
      });
    }

  } catch (e) {
    console.warn('[OMX AdBlocker v7]', e);
  }
})();
    `;
  }

  // Search engine domains — ad blocker does NOTHING on these sites
  isSearchEngineUrl(url = '') {
    try {
      const host = new URL(url).hostname.toLowerCase();
      // Google search
      if (host === 'google.com' || host.endsWith('.google.com')) return true;
      // Bing
      if (host === 'bing.com' || host.endsWith('.bing.com')) return true;
      // DuckDuckGo
      if (host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com')) return true;
      // Yahoo Search
      if (host === 'search.yahoo.com' || host === 'yahoo.com' || host.endsWith('.yahoo.com')) return true;
      // Baidu
      if (host === 'baidu.com' || host.endsWith('.baidu.com')) return true;
      // Yandex
      if (host === 'yandex.com' || host === 'yandex.ru' || host.endsWith('.yandex.com') || host.endsWith('.yandex.ru')) return true;
      // Brave Search
      if (host === 'search.brave.com' || host.endsWith('.search.brave.com')) return true;
      // Startpage
      if (host === 'startpage.com' || host.endsWith('.startpage.com')) return true;
      // Ecosia
      if (host === 'ecosia.org' || host.endsWith('.ecosia.org')) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  // Check if URL is in the user's ad blocker whitelist
  // Whitelisted sites only get popup ad blocking — 90% less ad blocking power
  isWhitelistedUrl(url = '') {
    try {
      const whitelist = this.settings?.adBlockerWhitelist || [];
      if (!Array.isArray(whitelist) || whitelist.length === 0) return false;

      const checkHost = new URL(url).hostname.toLowerCase().replace(/^www\./, '');

      for (const entry of whitelist) {
        const cleanEntry = String(entry || '').trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
        if (!cleanEntry) continue;
        // Exact match or subdomain match
        if (checkHost === cleanEntry || checkHost.endsWith('.' + cleanEntry)) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Minimal popup-only blocker for whitelisted sites
  // Only blocks popup/overlay ads — no CSS changes, no image blurring, no floating detection
  getPopupOnlyBlockerScript() {
    return `
    (function() {
      try {
        // Only remove popup overlay ads — nothing else
        const POPUP_SELECTOR = 'div[style*="position:fixed"][style*="z-index"]';

        const isPopupAd = (el) => {
          try {
            if (!el) return false;
            const cs = window.getComputedStyle(el);
            if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;

            const rect = el.getBoundingClientRect();
            if (rect.width < 100 || rect.height < 50) return false;
            if (rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.9) return false;

            const zIdx = parseInt(cs.zIndex, 10) || 0;
            if (zIdx < 100) return false;

            const cls = (el.className || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const text = (el.innerText || '').toLowerCase();

            // Check for ad indicators
            const hasAdClass = /ad[-_]?banner|ad[-_]?slot|ad[-_]?container|ad[-_]?overlay|ad[-_]?popup|advertisement|interstitial|popunder/i.test(cls + ' ' + id);
            const hasAdText = /advertisement|sponsored|click here|learn more|sign up|subscribe|download now|limited time|offer|deal/i.test(text);

            // Only block if clear ad indicators are present
            if (hasAdClass || hasAdText) return true;

            // Bottom/top thin banner
            if (cs.position === 'fixed' && (rect.bottom >= window.innerHeight - 10 || rect.top <= 10) && rect.height < 160) {
              if (text.length < 100) return true;
            }

            return false;
          } catch (_) { return false; }
        };

        const scan = () => {
          try {
            document.querySelectorAll(POPUP_SELECTOR).forEach(el => {
              if (isPopupAd(el)) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
              }
            });
          } catch (_) {}
        };

        scan();
        setTimeout(scan, 1000);
        setTimeout(scan, 3000);

        // Watch for new popup ads
        const observer = new MutationObserver(() => scan());
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
      } catch (_) {}
    })();
    `;
  }

  async applyFloatingAdBlocker(webview) {
    try {
      if (!webview || !webview.getURL) return;
      const ab = this.getAdBlockerSettings();
      const url = webview.getURL();

      const isWebsite = this.isWebsiteUrl(url);
      const isYT      = this.isYouTubeUrl(url);
      const isInsta   = this.isInstagramUrl(url);
      const isSearchEngine = this.isSearchEngineUrl(url);
      const isWhitelisted = this.isWhitelistedUrl(url);

      // If ad blocker is completely disabled, clear everything
      if (!ab.enabled) {
        await this.syncWebviewInsertedCss(webview, '__omxFloatAdBlockerCssKey', '');
        return;
      }

      // Skip on search engines unless cleanSearchEngines is enabled
      if (isSearchEngine) {
        if (ab.cleanSearchEngines) {
          await webview.executeJavaScript(this.getPopupOnlyBlockerScript(), true);
        }
        return;
      }

      // Skip on YouTube and Instagram (they have their own handling)
      if (isYT || isInsta) {
        await this.syncWebviewInsertedCss(webview, '__omxFloatAdBlockerCssKey', '');
        return;
      }

      // Whitelisted sites: only block popup ads if enabled
      if (isWhitelisted) {
        await this.syncWebviewInsertedCss(webview, '__omxFloatAdBlockerCssKey', '');
        if (isWebsite && ab.blockPopups) {
          await webview.executeJavaScript(this.getPopupOnlyBlockerScript(), true);
        }
        return;
      }

      // Full ad blocking for non-whitelisted websites
      // Floating ad blocking
      const cssText = (isWebsite && ab.blockFloating) ? this.getFloatingAdBlockerCss() : '';
      await this.syncWebviewInsertedCss(webview, '__omxFloatAdBlockerCssKey', cssText);

      if (isWebsite && ab.blockFloating) {
        await webview.executeJavaScript(this.getFloatingAdBlockerScript(), true);
      }

      // Popup blocking
      if (isWebsite && ab.blockPopups) {
        await webview.executeJavaScript(this.getPopupOnlyBlockerScript(), true);
      }
    } catch (e) {
      console.warn('[Ad Blocker] Failed:', e?.message);
    }
  }

  // Apply adult content image blocker to webview
  async applyAdultContentBlocker(webview) {
    try {
      if (!webview || !webview.executeJavaScript) return;
      
      // Check if adult content blocking is enabled in settings
      const adultBlockEnabled = this.settings?.features?.enableAdultContentBlock !== false;
      if (!adultBlockEnabled) return;
      
      await webview.executeJavaScript(this.getAdultContentBlockerScript(), true);
    } catch (e) {
      console.warn('[Adult Blocker] Failed to apply:', e?.message);
    }
  }
  // ── End Ad Blocker ────────────────────────────────────────────────────────

  // ── Adult Content Image Blocker ─────────────────────────────────────────
  getAdultContentBlockerScript() {
    return `
(function() {
  'use strict';
  
  try {
    if (window.__omxAdultBlocker) return;
    window.__omxAdultBlocker = true;

    const ADULT_DOMAINS = [
      'pornhub','xvideos','xhamster','xnxx','xnxxx',
      'youporn','redtube','tube8','spankbang','tnaflix',
      'slutload','heavy-r','drtuber','beeg','txxx',
      'hclips','fuq','vjav','hdzog','pornone',
      'anyporn','fullporner','cliphunter','inporn',
      'bravotube','porndig','rexxx','tubxporn','pornktube',
      'sexvid','empflix','porntrex','faphouse','fapality',
      'sexu','pornrox','porn300','tubegalore','porngo',
      'shesfreaky','gotporn','yourporn','jizzbo',
      'javhd','javmost','javbus','javlibrary',
      'brazzers','bangbros','realitykings','naughtyamerica',
      'mofos','digitalplayground','kink','vixen','tushy',
      'deeper','slayed','teamskeet','evilangel',
      'chaturbate','myfreecams','cam4','camsoda',
      'bongacams','stripchat','livejasmin','streamate',
      'jerkmate','camversity','onlyfans','fansly','manyvids',
      'xart','sexstories','literotica','hentaihaven',
      'nhentai','hanime','rule34',
      'motherless','imagefap','erome','nuvid',
      'porn.','xxx.','freeones',
      'adultempire','porzo','whoreshub','eroprofile',
      'pornerbros','porntube','xtube',
      'perfectgirls','18porn','teenporn','gayporn',
      'pornhat','theporndude','theporn','pronhub',
      'metaporn','rusporn','artporn','ratxxx','porndeals',
      'thepornart','sentimes','thecut'
    ];

    function isAdultUrl(url) {
      if (!url) return false;
      const lower = url.toLowerCase();
      for (const d of ADULT_DOMAINS) {
        if (lower.includes(d)) return true;
      }
      return false;
    }

    // Inject CSS
    const style = document.createElement('style');
    style.id = 'omx-adult-blocker-style';
    style.textContent = \`
      .omx-adult-blur {
        filter: blur(50px) !important;
        -webkit-filter: blur(50px) !important;
        opacity: 0.3 !important;
        pointer-events: none !important;
        user-select: none !important;
      }
      .omx-adult-wrap {
        position: relative !important;
        pointer-events: none !important;
      }
      .omx-adult-wrap::after {
        content: "🚫" !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(0,0,0,0.95) !important;
        color: #fff !important;
        padding: 10px 20px !important;
        border-radius: 8px !important;
        font-size: 12px !important;
        font-weight: bold !important;
        letter-spacing: 1px !important;
        z-index: 999999 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
      }
      .omx-adult-remove {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
      }
    \`;
    document.head.appendChild(style);

    function checkAndBlur(img) {
      if (!img || img.dataset.omxFiltered) return;
      
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original-url') || '';
      const link = img.closest('a');
      const href = link ? link.href : '';
      
      // Check source text near image (Google shows source labels)
      const container = img.closest('[data-lpage]') || img.closest('[jsname]') || img.closest('.islrc') || img.parentElement?.parentElement;
      const sourceText = container ? container.textContent.toLowerCase() : '';
      
      const combined = src + ' ' + href + ' ' + sourceText;
      
      if (isAdultUrl(combined)) {
        img.dataset.omxFiltered = 'true';
        img.classList.add('omx-adult-blur');
        
        // Try to wrap for label
        const parent = img.parentElement;
        if (parent && !parent.classList.contains('omx-adult-wrap')) {
          parent.classList.add('omx-adult-wrap');
          parent.style.position = 'relative';
        }
        
        // Also hide parent container for Google Images
        const googleContainer = img.closest('[data-lpage]');
        if (googleContainer) {
          googleContainer.classList.add('omx-adult-remove');
        }
      }
    }

    // Hide entire search result cards that reference adult sites
    function hideAdultSearchResults() {
      // Google search result containers
      const selectors = [
        '.g',                    // Standard search results
        '.MjjYud',               // Google result wrapper
        '[data-hveid]',          // Generic result container
        '.tF2Cxc',               // Organic result
      ];

      document.querySelectorAll(selectors.join(',')).forEach(card => {
        if (card.dataset.omxFiltered) return;

        // Only check hrefs and data attributes (URLs), NOT card.textContent
        // This avoids false positives from words like "pornography" in normal text
        const links = Array.from(card.querySelectorAll('a[href]')).map(a => a.getAttribute('href') || '').join(' ');
        const dataAttrs = Array.from(card.attributes).filter(a => a.name.startsWith('data-')).map(a => a.value).join(' ');

        const combined = links + ' ' + dataAttrs;

        if (isAdultUrl(combined)) {
          card.dataset.omxFiltered = 'true';
          card.classList.add('omx-adult-remove');
        }
      });
    }

    // Check for video elements
    function checkAndHideVideo(video) {
      if (!video || video.dataset.omxFiltered) return;
      const src = video.src || '';
      if (isAdultUrl(src)) {
        video.dataset.omxFiltered = 'true';
        video.classList.add('omx-adult-remove');
      }
    }

    function scan() {
      // Scan all images
      document.querySelectorAll('img').forEach(checkAndBlur);
      // Scan all videos
      document.querySelectorAll('video').forEach(checkAndHideVideo);
      // Scan Google Images specific containers
      document.querySelectorAll('[data-lpage]').forEach(el => {
        const href = el.getAttribute('data-lpage') || '';
        if (isAdultUrl(href)) {
          el.classList.add('omx-adult-remove');
        }
      });
      // Hide entire search result cards with adult content
      hideAdultSearchResults();
    }

    // Initial scan
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(scan, 300));
    } else {
      setTimeout(scan, 300);
    }

    // Debounced MutationObserver for dynamic content
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scan, 150);
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Periodic scan for lazy-loaded content
    setInterval(scan, 2000);
    
  } catch (e) {
    console.warn('[Adult Blocker] Error:', e);
  }
})();
    `;
  }
  // ── End Adult Content Blocker ───────────────────────────────────────────

  isYouTubeUrl(url = '') {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    } catch (e) {
      return false;
    }
  }

  isInstagramUrl(url = '') {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'instagram.com' || host.endsWith('.instagram.com');
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
          const cleanUiAttr = 'data-omx-yt-clean-ui';
          const blurAttr = 'data-omx-blur-thumbnails';
          const bwAttr = 'data-omx-yt-bw';
          const adGraceAttr = 'data-omx-yt-ad-grace';
          const blurMarkerAttr = 'data-omx-thumb-blur';
          const reloadRemainingKey = 'omxYtCleanUiReloadsRemaining';
          const adGraceKey = 'omxYtCleanUiAdBlockUntil';

          const state = window[stateKey] || (window[stateKey] = {});
          if (typeof state.cleanup === 'function') {
            try { state.cleanup(); } catch (_) {}
          }
          if (state.adSkipInterval) clearInterval(state.adSkipInterval);
          if (state.adSkipObserver) state.adSkipObserver.disconnect();

          const getSessionNumber = (key) => {
            try {
              const raw = Number(sessionStorage.getItem(key) || '0');
              return Number.isFinite(raw) ? raw : 0;
            } catch (_) {
              return 0;
            }
          };

          const isAdGraceActive = () => getSessionNumber(adGraceKey) > Date.now();

          const refreshAdGraceAttr = () => {
            const active = isAdGraceActive();
            root.setAttribute(adGraceAttr, active ? '1' : '0');
            if (state.adGraceTimer) {
              clearTimeout(state.adGraceTimer);
              state.adGraceTimer = null;
            }
            if (active) {
              const msLeft = Math.max(getSessionNumber(adGraceKey) - Date.now(), 0);
              state.adGraceTimer = setTimeout(() => {
                state.adGraceTimer = null;
                root.setAttribute(adGraceAttr, '0');
              }, msLeft + 50);
            }
            return active;
          };

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
            root.removeAttribute(cleanUiAttr);
            root.removeAttribute(blurAttr);
            root.removeAttribute(bwAttr);
            root.removeAttribute(adGraceAttr);
            // Restore any fast-forwarded video
            try {
              const v = document.querySelector('.html5-main-video') || document.querySelector('video');
              if (v) { v.playbackRate = 1; if (v._omxWasMuted === false) { v.muted = false; delete v._omxWasMuted; } }
            } catch (_) {}
            return;
          }

          const isWatchPath = () => {
            try {
              const host = location.hostname;
              if (!/youtube\\.com$/.test(host)) return false;
              return location.pathname === '/watch' || location.pathname.startsWith('/watch');
            } catch (e) { return false; }
          };

          const scheduleCleanUiRecoveryReload = () => {
            if (!${cfg.cleanUi} || !isWatchPath()) return;
            const remainingReloads = getSessionNumber(reloadRemainingKey);
            if (remainingReloads <= 0) return;
            try {
              sessionStorage.setItem(reloadRemainingKey, String(Math.max(remainingReloads - 1, 0)));
            } catch (_) {}
            if (state.cleanUiReloadTimer) clearTimeout(state.cleanUiReloadTimer);
            state.cleanUiReloadTimer = setTimeout(() => {
              state.cleanUiReloadTimer = null;
              try { location.reload(); } catch (_) {}
            }, remainingReloads > 1 ? 180 : 320);
          };

          const updateCleanUiAttr = () => {
            const shouldCleanUi = ${cfg.cleanUi} && isWatchPath();
            root.setAttribute(cleanUiAttr, shouldCleanUi ? '1' : '0');
          };
          updateCleanUiAttr();
          refreshAdGraceAttr();
          scheduleCleanUiRecoveryReload();

          const onLocationChange = () => {
            if (state.cleanUiFrame) cancelAnimationFrame(state.cleanUiFrame);
            state.cleanUiFrame = requestAnimationFrame(() => {
              state.cleanUiFrame = null;
              updateCleanUiAttr();
              refreshAdGraceAttr();
            });
          };

          window.addEventListener('popstate', onLocationChange);
          window.addEventListener('hashchange', onLocationChange);
          document.addEventListener('yt-navigate-finish', onLocationChange, true);
          document.addEventListener('yt-page-data-updated', onLocationChange, true);

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

          ${cfg.cleanUi ? `
          rules.push('html[' + cleanUiAttr + '="1"] ytd-rich-grid-renderer ytd-rich-item-renderer, html[' + cleanUiAttr + '="1"] ytd-rich-section-renderer, html[' + cleanUiAttr + '="1"] ytd-reel-shelf-renderer, html[' + cleanUiAttr + '="1"] ytd-watch-flexy #secondary, html[' + cleanUiAttr + '="1"] ytd-watch-flexy #secondary-inner, html[' + cleanUiAttr + '="1"] ytd-watch-next-secondary-results-renderer, html[' + cleanUiAttr + '="1"] ytd-watch-next-secondary-results-renderer #related, html[' + cleanUiAttr + '="1"] #items.ytd-watch-next-secondary-results-renderer, html[' + cleanUiAttr + '="1"] ytd-compact-video-renderer, html[' + cleanUiAttr + '="1"] ytd-compact-autoplay-renderer, html[' + cleanUiAttr + '="1"] .ytp-endscreen-content, html[' + cleanUiAttr + '="1"] .ytp-endscreen-next, html[' + cleanUiAttr + '="1"] .ytp-ce-element, html[' + cleanUiAttr + '="1"] .ytp-videowall-still, html[' + cleanUiAttr + '="1"] .ytp-upnext, html[' + cleanUiAttr + '="1"] .ytp-pause-overlay { display: none !important; }');
          ` : ''}

          rules.push('html[' + adGraceAttr + '="1"] .video-ads, html[' + adGraceAttr + '="1"] .ytp-ad-module, html[' + adGraceAttr + '="1"] .ytp-ad-player-overlay, html[' + adGraceAttr + '="1"] .ytp-ad-overlay-container, html[' + adGraceAttr + '="1"] .ytp-ad-survey, html[' + adGraceAttr + '="1"] .ytp-ad-message-container, html[' + adGraceAttr + '="1"] .ytd-display-ad-renderer, html[' + adGraceAttr + '="1"] ytd-promoted-sparkles-web-renderer { display: none !important; visibility: hidden !important; opacity: 0 !important; }');

          style.textContent = rules.join('\\n');

          state.cleanup = () => {
            window.removeEventListener('popstate', onLocationChange);
            window.removeEventListener('hashchange', onLocationChange);
            document.removeEventListener('yt-navigate-finish', onLocationChange, true);
            document.removeEventListener('yt-page-data-updated', onLocationChange, true);
            if (state.cleanUiFrame) {
              cancelAnimationFrame(state.cleanUiFrame);
              state.cleanUiFrame = null;
            }
            if (state.cleanUiReloadTimer) {
              clearTimeout(state.cleanUiReloadTimer);
              state.cleanUiReloadTimer = null;
            }
            if (state.adGraceTimer) {
              clearTimeout(state.adGraceTimer);
              state.adGraceTimer = null;
            }
            if (state.adSkipInterval) {
              clearInterval(state.adSkipInterval);
              state.adSkipInterval = null;
            }
            if (state.adSkipObserver) {
              state.adSkipObserver.disconnect();
              state.adSkipObserver = null;
            }
          };

          // ════════════════════════════════════════════════════════════════
          //  AD SKIPPER — skips skippable ads, fast-forwards the rest
          // ════════════════════════════════════════════════════════════════
          if (${cfg.adSkipper} || isAdGraceActive()) {
            const AD_SPEED = 16;
            const NORMAL_SPEED = 1;
            const SKIP_BTN_SELECTORS = [
              '.ytp-skip-ad-button',
              '.ytp-ad-skip-button',
              '.ytp-ad-skip-button-modern',
              '[class*="skip-ad"]',
              '[class*="skip_ad"]',
            ];

            const isAdPlaying = () => {
              try {
                if (document.querySelector('.ad-showing, .ad-interrupting')) return true;
                const adBadge = document.querySelector('.ytp-ad-badge, .ytp-ad-text');
                if (adBadge && adBadge.offsetParent !== null) return true;
                return false;
              } catch (e) { return false; }
            };

            const tryClickSkip = () => {
              try {
                for (const sel of SKIP_BTN_SELECTORS) {
                  const btn = document.querySelector(sel);
                  if (btn && btn.offsetParent !== null && !btn.disabled) {
                    btn.click();
                    return true;
                  }
                }
              } catch (e) {}
              return false;
            };

            const getAdVideo = () => {
              try {
                return document.querySelector('.html5-main-video') || document.querySelector('video');
              } catch (e) { return null; }
            };

            let wasAdPlaying = false;

            const tick = () => {
              try {
                const graceBlocking = refreshAdGraceAttr();
                const adActive = isAdPlaying();
                const video = getAdVideo();

                if (adActive) {
                  // Try to click skip button first (available after 5s)
                  tryClickSkip();

                  // Fast-forward the ad video
                  if (video && video.playbackRate !== AD_SPEED) {
                    video.playbackRate = AD_SPEED;
                  }
                  if (graceBlocking && video && Number.isFinite(video.duration) && video.duration > 0) {
                    try {
                      video.currentTime = Math.max(video.currentTime || 0, Math.max(video.duration - 0.05, 0));
                    } catch (_) {}
                  }
                  // Mute ad audio so fast playback isn't jarring
                  if (video && !video.muted) {
                    video._omxWasMuted = false;
                    video.muted = true;
                  }
                  wasAdPlaying = true;
                } else if (wasAdPlaying) {
                  // Ad ended — restore normal speed & unmute
                  if (video) {
                    video.playbackRate = NORMAL_SPEED;
                    if (video._omxWasMuted === false) {
                      video.muted = false;
                      delete video._omxWasMuted;
                    }
                  }
                  wasAdPlaying = false;
                }
              } catch (e) {}
            };

            // Clear any existing interval
            if (state.adSkipInterval) clearInterval(state.adSkipInterval);

            // Poll every 300ms — lightweight and catches all ad states
            state.adSkipInterval = setInterval(tick, 800);
            tick();

            // Also react instantly to DOM mutations (skip button appearing)
            if (state.adSkipObserver) state.adSkipObserver.disconnect();
            state.adSkipObserver = new MutationObserver(() => {
              if (isAdPlaying()) {
                tryClickSkip();
                tick();
              } else {
                refreshAdGraceAttr();
              }
            });
            state.adSkipObserver.observe(document.documentElement || document.body, {
              childList: true, subtree: true, attributes: true,
              attributeFilter: ['class']
            });
          }
          // ════════════════════════════════════════════════════════════════
          //  END AD SKIPPER
          // ════════════════════════════════════════════════════════════════

        } catch(e) {
          console.warn('[YouTube Addon Error]', e);
        }
      })();
    `;
  }

  // ── SessionGuard (embedded session protection) ─────────────────────────
  async applySessionGuard(webview) {
    try {
      if (!webview || !webview.getURL) return;
      const url = webview.getURL();
      if (!this.isWebsiteUrl(url)) return;
      
      // Read the SessionGuard script from URL
      const response = await fetch(this.SESSIONGUARD_SCRIPT_URL);
      const script = await response.text();
      await webview.executeJavaScript(script, true);
    } catch (e) {
      console.warn('[SessionGuard] Injection failed:', e?.message);
    }
  }

  // Get SessionGuard stats from a webview
  async getSessionGuardStats(webview) {
    try {
      if (!webview?.executeJavaScript) return null;
      return await webview.executeJavaScript('window.__omxSessionGuardStats || null', true);
    } catch (e) {
      return null;
    }
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

  getDuckDuckGoSearchCleanupScript() {
    return `
      (() => {
        try {
          const state = window.__omxDdgCleanupState || (window.__omxDdgCleanupState = {});
          if (state.styleId && !document.getElementById(state.styleId)) {
            state.styleId = null;
          }

          const hiddenAttr = 'data-omx-ddg-hidden';
          const toText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
          const includesAll = (text, parts) => parts.every((part) => text.includes(part));
          const styleId = state.styleId || 'omx-ddg-cleanup-style';
          state.styleId = styleId;

          if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = \`
              [data-omx-ddg-hidden="1"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                max-height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
              }
            \`;
            (document.head || document.documentElement).appendChild(style);
          }

          const hideNode = (node) => {
            if (!node || node.nodeType !== 1) return false;
            if (node.getAttribute(hiddenAttr) === '1') return false;
            node.setAttribute(hiddenAttr, '1');
            node.style.setProperty('display', 'none', 'important');
            node.style.setProperty('visibility', 'hidden', 'important');
            node.style.setProperty('pointer-events', 'none', 'important');
            node.style.setProperty('max-height', '0', 'important');
            node.style.setProperty('overflow', 'hidden', 'important');
            node.style.setProperty('margin', '0', 'important');
            node.style.setProperty('padding', '0', 'important');
            return true;
          };

          const isSafeCardTarget = (node) => {
            if (!(node instanceof Element)) return false;
            const tag = String(node.tagName || '').toLowerCase();
            if (tag === 'html' || tag === 'body' || tag === 'main') return false;
            if (node.id === 'react-layout' || node.id === '__next' || node.id === 'root') return false;
            const rect = node.getBoundingClientRect?.();
            if (!rect) return false;
            if (rect.width <= 0 || rect.height <= 0) return false;
            if (rect.width > (window.innerWidth * 0.96)) return false;
            if (rect.height > (window.innerHeight * 0.72)) return false;
            return true;
          };

          const findHideTarget = (node, mode = 'card') => {
            let current = node;
            let fallbackTarget = null;
            for (let i = 0; i < 8 && current; i += 1) {
              if (!(current instanceof Element)) break;
              const role = String(current.getAttribute('role') || '').toLowerCase();
              const tag = String(current.tagName || '').toLowerCase();
              const className = String(current.className || '').toLowerCase();
              const testId = String(current.getAttribute('data-testid') || '').toLowerCase();
              const rect = current.getBoundingClientRect?.();
              const isCardLike =
                role === 'button' ||
                tag === 'button' ||
                tag === 'article' ||
                tag === 'section' ||
                tag === 'aside' ||
                tag === 'li' ||
                /card|module|tile|feedback|promo|banner|assistant/.test(className) ||
                /feedback|promo|assistant|menu/.test(testId);
              const isPanelSized =
                !!rect &&
                rect.width >= 220 &&
                rect.width <= (window.innerWidth * 0.96) &&
                rect.height >= 44 &&
                rect.height <= (window.innerHeight * 0.72);
              const isMenuLike =
                role === 'button' ||
                tag === 'button' ||
                tag === 'header' ||
                tag === 'nav' ||
                /menu|header|toolbar/.test(className) ||
                /menu|header/.test(testId);
              if (isSafeCardTarget(current) && isPanelSized) {
                fallbackTarget = current;
              }
              if (mode === 'menu') {
                if (isMenuLike && isSafeCardTarget(current)) return current;
              } else if ((isCardLike || isPanelSized) && isSafeCardTarget(current)) {
                return current;
              }
              current = current.parentElement;
            }
            return fallbackTarget || (isSafeCardTarget(node) ? node : null);
          };

          const getTextMatchElements = (patterns) => {
            const matches = new Set();
            const walker = document.createTreeWalker(
              document.body || document.documentElement,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode(textNode) {
                  const value = toText(textNode.nodeValue);
                  if (!value) return NodeFilter.FILTER_REJECT;
                  const matched = patterns.some((parts) => includesAll(value, parts));
                  return matched ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
              }
            );
            let currentNode = walker.nextNode();
            while (currentNode) {
              if (currentNode.parentElement) matches.add(currentNode.parentElement);
              currentNode = walker.nextNode();
            }
            return Array.from(matches);
          };

          const hideCardsContaining = (patterns) => {
            document.querySelectorAll('button, a, div, span, h1, h2, h3, p').forEach((node) => {
              const text = toText(node.textContent);
              if (!text) return;
              const matched = patterns.some((parts) => includesAll(text, parts));
              if (!matched) return;
              const target = findHideTarget(node, 'card');
              if (target) hideNode(target);
            });
            getTextMatchElements(patterns).forEach((node) => {
              const target = findHideTarget(node, 'card');
              if (target) hideNode(target);
            });
          };

          const removeKnownDdgModules = () => {
            const modulePatterns = [
              ['share', 'feedback'],
              ['protection.', 'privacy.', 'peace of mind.']
            ];
            document.querySelectorAll('body *').forEach((node) => {
              if (!(node instanceof Element)) return;
              if (node.getAttribute(hiddenAttr) === '1') return;
              const text = toText(node.textContent);
              if (!text) return;
              const rect = node.getBoundingClientRect?.();
              if (!rect || rect.width < 220 || rect.height < 40) return;
              if (rect.width > window.innerWidth * 0.96 || rect.height > window.innerHeight * 0.72) return;
              const matched = modulePatterns.some((parts) => includesAll(text, parts));
              if (!matched) return;
              const hasRichContent =
                node.querySelector('button, a, img, svg, [role="button"]') ||
                /download|wikipedia|helpful|inaccuracies/.test(text);
              if (!hasRichContent) return;
              const target = findHideTarget(node, 'card') || node;
              if (target) hideNode(target);
            });
          };

          const hideBySelectors = () => {
            const menuSelectors = [
              '[data-testid="header-aside"]',
              '[data-testid="nav-menu-button"]',
              '[aria-label="Open menu"]',
              '[aria-label="Menu"]',
              'button[title="Menu"]',
              'button[title="Open menu"]',
              'button[aria-haspopup="menu"]'
            ];
            document.querySelectorAll(menuSelectors.join(',')).forEach((node) => {
              const target = findHideTarget(node, 'menu');
              if (target) hideNode(target);
            });
          };

          const apply = () => {
            state.raf = 0;
            hideBySelectors();
            hideCardsContaining([
              ['share', 'feedback'],
              ['protection.', 'privacy.', 'peace of mind.']
            ]);
            removeKnownDdgModules();
          };

          apply();
          clearTimeout(state.retryA);
          clearTimeout(state.retryB);
          clearTimeout(state.retryC);
          state.retryA = setTimeout(apply, 250);
          state.retryB = setTimeout(apply, 800);
          state.retryC = setTimeout(apply, 1600);

          if (state.observer) state.observer.disconnect();
          state.observer = new MutationObserver(() => {
            if (state.raf) return;
            state.raf = requestAnimationFrame(apply);
          });
          state.observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });

          return true;
        } catch (error) {
          console.warn('[DDG Cleanup] Script execution failed:', error);
          return false;
        }
      })();
    `;
  }

  async applyDuckDuckGoSearchCleanup(webview) {
    try {
      if (!webview || !webview.getURL) return;
      const url = webview.getURL();
      if (!this.isDuckDuckGoSearchUrl(url)) return;
      await webview.executeJavaScript(this.getDuckDuckGoSearchCleanupScript(), true);
    } catch (e) {
      console.warn('[DDG Cleanup] Script execution failed:', e?.message);
    }
  }

  isDuckDuckGoSearchUrl(url = '') {
    try {
      const parsed = new URL(url);
      const host = String(parsed.hostname || '').toLowerCase();
      if (!(host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com'))) return false;
      return parsed.pathname === '/' || parsed.pathname === '/html/' || parsed.pathname === '/html';
    } catch (_) {
      return false;
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

  // Security settings
  getSecurityConfig() {
    const cfg = this.settings?.security || {};
    return {
      virusTotalEnabled: cfg.virusTotalEnabled !== false, // enabled by default
      virusTotalApiKey: cfg.virusTotalApiKey || '',
      localPatternCheck: cfg.localPatternCheck !== false // enabled by default
    };
  }

  // Check if URL is malicious and block if necessary
  // Returns: { isMalicious: boolean, reason: string }
  async checkUrlSecurity(url) {
    try {
      // Skip checking for system pages, about:blank, etc.
      if (!url || url.startsWith('file://') || url.startsWith('about:') || url.startsWith('data:')) {
        return { isMalicious: false, reason: 'Internal page' };
      }

      // Skip if already blocked
      const blockedCheck = isBlocked(url);
      if (blockedCheck.status === 'BLOCKED') {
        return { isMalicious: true, reason: blockedCheck.reason || 'Already blocked' };
      }

      const config = this.getSecurityConfig();

      // 1. Local pattern check (fast, no API needed)
      if (config.localPatternCheck) {
        const patternResult = checkKnownMaliciousPatterns(url);
        if (patternResult.isSuspicious) {
          console.warn(`[Security] Suspicious pattern detected: ${url} - ${patternResult.reason}`);
          // Add to blocklist but don't close yet (local patterns can have false positives)
          // Only block if it matches known typosquatting
          if (patternResult.pattern?.includes('typosquat')) {
            addToBlocklist(url, patternResult.reason, 'Local Pattern');
            return { isMalicious: true, reason: patternResult.reason };
          }
        }
      }

      // 2. VirusTotal API check
      if (config.virusTotalEnabled && config.virusTotalApiKey) {
        try {
          const vtResult = await checkVirusTotal(url);
          
          if (vtResult.error) {
            // API error, allow navigation but log
            console.warn('[Security] VirusTotal API error, allowing navigation');
            return { isMalicious: false, reason: 'API unavailable' };
          }

          if (vtResult.isMalicious) {
            // Add to blocklist
            addToBlocklist(
              url, 
              vtResult.reason || `Detected by ${vtResult.detections} engines`, 
              'VirusTotal',
              vtResult.detections
            );
            return { 
              isMalicious: true, 
              reason: vtResult.reason,
              detections: vtResult.detections 
            };
          }

          return { isMalicious: false, reason: 'VirusTotal: Safe' };
        } catch (e) {
          console.warn('[Security] VirusTotal check failed:', e);
          return { isMalicious: false, reason: 'Check failed' };
        }
      }

      return { isMalicious: false, reason: 'Security check skipped' };
    } catch (e) {
      console.warn('[Security] URL security check failed:', e);
      return { isMalicious: false, reason: 'Check error' };
    }
  }

  // Handle malicious URL detection - close tab and block site
  async handleMaliciousUrl(tab, url, reason) {
    try {
      if (tab?.isOmChat) {
        console.warn('[Security] Skipping auto-close for OmChat tab.');
        return;
      }
      console.warn(`[Security] MALICIOUS SITE DETECTED: ${url}`);
      console.warn(`[Security] Reason: ${reason}`);
      console.warn(`[Security] Closing tab and adding to blocklist...`);

      // Add to blocklist
      addToBlocklist(url, reason, 'VirusTotal');

      // Show notification to user (if notification system exists)
      if (window.browserAPI?.notifications) {
        window.browserAPI.notifications.show({
          title: '⚠️ Security Alert',
          body: `Blocked malicious site: ${new URL(url).hostname}\nReason: ${reason}`,
          type: 'warning'
        });
      }

      // Close the tab immediately
      if (tab && tab.id) {
        this.closeTab(tab.id);
      }

      // Create a security alert tab
      const alertUrl = this.createDefenseUrl('malicious-site', url, reason);
      this.createTab(alertUrl);

    } catch (e) {
      console.warn('[Security] Failed to handle malicious URL:', e);
    }
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

    const isOmChat = options.isOmChat === true || this.isOmChatUrl(finalUrl);
    const id = this.nextTabId++;
    const isSystemPage = finalUrl.includes('system.html');
    const isTextStudio = finalUrl.includes('text-editor.html');
    const isHistoryPage = finalUrl.includes('history.html');
    const isGamesPage = finalUrl.includes('games.html');
    const isDefensePage = finalUrl.includes('security-defense-blocked.html');
    const isHomePage = finalUrl.includes('home.html');
    const isTodoPage = finalUrl.includes('todo.html');
    const isDownloadsPage = finalUrl.includes('downloads.html');
    const isScraberPage = finalUrl.includes('scraper.html');
    const isServerOperatorPage = finalUrl.includes('server-operator.html');
    const isLocalAIPage = this.isLocalOrHostedAiUrl(finalUrl);

    if (isScraberPage) {
      const existingScraperTab = this.tabs.find((tab) => tab.isScraberPage);
      if (existingScraperTab) {
        existingScraperTab.noSuspend = true;
        existingScraperTab.lastAccessed = Date.now();
        this.setActiveTab(existingScraperTab.id);
        return existingScraperTab.id;
      }
    }

    const { tabItem, titleEl, iconEl, spinnerEl } = this.createTabUI(id, {
        isSystemPage, isTextStudio, isHistoryPage, isGamesPage, isDefensePage,
        isHomePage, isTodoPage, isDownloadsPage, isScraberPage, isServerOperatorPage, isLocalAIPage, isOmChat
    }, finalUrl);
    const tabState = {
      id, webview: null, tabItem, titleEl, iconEl, spinnerEl, url: finalUrl,
      lastAccessed: Date.now(), suspended: false, isSystemPage,
      isTextStudio, isHistoryPage, isGamesPage, isDefensePage,
      isHomePage, isTodoPage, isDownloadsPage, isScraberPage, isServerOperatorPage, isLocalAIPage,
      isOmChat, noSuspend: isOmChat || isScraberPage,
      isLoading: true, isMainFrameLoading: true, customIcon: isOmChat, audible: false,
      interactiveSearch: options.interactiveSearch || null
    };
    this.tabs.push(tabState);
    this.tabListContainer.appendChild(tabItem);
    this._setTabLoadingVisual(tabState, true);
    this.createWebviewForTab(tabState);
    this.setActiveTab(id);
    return id;
  }

  _createTabFallbackIcon(_url = '', _id = 0, _title = '') {
    return this.OMX_ICON_URL;
  }

  applyOmChatTabIcon(tabState) {
    if (!tabState?.iconEl) return;
    tabState.customIcon = true;
    tabState.iconEl.src = this.OMCHAT_ICON_URL;
    if (!tabState.isLoading) tabState.iconEl.style.visibility = 'visible';
    tabState.iconEl.style.display = 'block';
    if (tabState.titleEl && (!tabState.titleEl.textContent || tabState.titleEl.textContent === 'Loading...' || tabState.titleEl.textContent === 'New Tab')) {
      tabState.titleEl.textContent = 'OmChat';
    }
  }

  createTabUI(id, flags, url = '') {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    let iconSrc = this.APP_ICON;
    let title = 'Loading...';
    if (flags.isOmChat) { iconSrc = this.OMCHAT_ICON_URL; title = 'OmChat'; }
    else if (flags.isHomePage) { iconSrc = this.HOME_ICON; title = 'Home'; }
    else if (flags.isServerOperatorPage) { iconSrc = this.MINECRAFT_ICON; title = 'Server'; }
    else if (flags.isSystemPage) { iconSrc = this.SETTINGS_ICON; title = 'System'; }
    else if (flags.isTextStudio) { iconSrc = this.TEXT_STUDIO_ICON; title = 'Text Studio'; }
    else if (flags.isHistoryPage) { iconSrc = this.HISTORY_ICON; title = 'History'; }
    else if (flags.isGamesPage) { iconSrc = this.GAMES_ICON; title = 'Games'; }
    else if (flags.isTodoPage) { iconSrc = this.TODO_ICON; title = 'Todo'; }
    else if (flags.isDownloadsPage) { iconSrc = this.DOWNLOADS_ICON; title = 'Downloads'; }
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
    webview.setAttribute('allowpopups', 'no');
    this._attachWebviewListeners(webview, tabState);
    this.webviewContainer.appendChild(webview);
    webview.src = tabState.url;
    tabState.webview = webview;
    tabState.suspended = false;
    tabState.domReady = false;
    tabState.tabItem.classList.remove('suspended');

    // Dev tools no longer open automatically - user can open manually if needed
    // if (this.settings && this.settings.openDevToolsOnStart) {
    //     webview.addEventListener('dom-ready', () => {
    //         webview.openDevTools({ mode: 'detach' });
    //     });
    // }
    // DevTools disabled

    // ── Early injection: override browser APIs before page scripts run ──────
    // did-start-loading fires as soon as navigation begins — the document
    // exists but no page scripts have executed yet, so our API overrides
    // (fetch, XHR, setAttribute, Image.src) take effect first.
    webview.addEventListener('did-start-loading', async () => {
      try {
        const url = webview.getURL ? webview.getURL() : '';
        await this.applySitePermissions(webview, url);
        const isWebsite = this.isWebsiteUrl(url);
        const isYT = this.isYouTubeUrl(url);
        const isSearchEngine = this.isSearchEngineUrl(url);
        const isWhitelisted = this.isWhitelistedUrl(url);
        const sessionGuardEnabled = this.settings?.security?.sessionGuard?.enabled !== false;
        const ab = this.getAdBlockerSettings();

        // Skip search engines entirely — do nothing on these pages
        if (isSearchEngine) return;

        // Inject SessionGuard on protected domains (runs early, before page scripts)
        if (isWebsite && sessionGuardEnabled) {
          await this.applySessionGuard(webview);
        }

        // If ad blocker is disabled, skip all ad blocking
        if (!ab.enabled) return;

        // Whitelisted sites: only inject popup blocker if enabled
        if (isWhitelisted && isWebsite) {
          if (ab.blockPopups) {
            await webview.executeJavaScript(this.getPopupOnlyBlockerScript(), true);
          }
          return;
        }

        // Early injection for floating ad blocker (before page scripts)
        if (isWebsite && !isYT && !this.isInstagramUrl(url)) {
          if (ab.blockFloating) {
            await webview.executeJavaScript(this.getFloatingAdBlockerScript(), true);
          }
        }

        // Early injection for popup blocker
        if (isWebsite && ab.blockPopups) {
          await webview.executeJavaScript(this.getPopupOnlyBlockerScript(), true);
        }

        // Early injection for adult content blocker
        const adultBlockEnabled = this.settings?.features?.enableAdultContentBlock !== false;
        if (isWebsite && adultBlockEnabled) {
          await webview.executeJavaScript(this.getAdultContentBlockerScript(), true);
        }
      } catch (_) {}
    });

    webview.addEventListener('dom-ready', async () => {
        try {
            tabState.domReady = true;
            await this.applySitePermissions(webview, webview.getURL ? webview.getURL() : tabState.url);
            await this.applyGlobalWebsiteCss(webview);
            await this.applyYouTubeAddon(webview);
            await this.applyFloatingAdBlocker(webview);
            await this.applyAdultContentBlocker(webview);
            const currentUrl = webview.getURL ? webview.getURL() : '';
            if (this.isDuckAiChatUrl(currentUrl)) {
                await this.applyDuckAiSidebarPreference(webview);
            }
            if (this.isDuckDuckGoSearchUrl(currentUrl)) {
                await this.applyDuckDuckGoSearchCleanup(webview);
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
        if (this.isBlockedGuestNavigation((webview.getURL && webview.getURL()) || tabState.url || '', e.url)) {
            e.preventDefault();
            const defenseUrl = this.createDefenseUrl('blocked-local-navigation', e.url, 'Websites cannot open local app files or local disk paths.');
            webview.src = defenseUrl;
            return;
        }
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
        // Check if media is actually still playing (some sites pause/play rapidly)
        setTimeout(async () => {
            const stillPlaying = await this.isTabPlayingMedia(tabState);
            if (stillPlaying) {
                tabState.audible = true;
                tabState.tabItem.classList.add('audible');
                return;
            }
            // Media really stopped, schedule suspension if not active
            if (tabState.id !== this.activeTabId && !tabState.suspended) {
                this.scheduleSuspension(tabState);
            }
            // Update mini player
            if (this.activeAudioTabId === tabState.id && !tabState.audible) {
                const otherPlaying = this.tabs.find(t => t.audible);
                if (otherPlaying) this.updateMiniPlayerState(otherPlaying, true);
                else this.updateMiniPlayerState(null, false);
            }
        }, 1000); // Wait 1 second to check if media resumes
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

      const finishedUrl = webview.getURL ? webview.getURL() : tabState.url;
      if (this.isDuckDuckGoSearchUrl(finishedUrl)) {
        setTimeout(() => {
          this.applyDuckDuckGoSearchCleanup(webview);
        }, 120);
      }
      
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
        if(!tabState.isSystemPage && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage && !tabState.isDownloadsPage) {
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
       if(!tabState.isSystemPage && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage && !tabState.isDownloadsPage) {
           tabState.titleEl.textContent = e.title;
           tabState.tabItem.title = e.title;
           if (this.activeAudioTabId === tabState.id && this.playerTitle) this.playerTitle.textContent = e.title;
       }
    });
    webview.addEventListener('page-favicon-updated', (e) => {
       if (!tabState.customIcon && !tabState.isSystemPage && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage && !tabState.isDownloadsPage && e.favicons && e.favicons.length > 0) {
         tabState.iconEl.src = e.favicons[0];
         if (!tabState.isLoading) tabState.iconEl.style.visibility = 'visible';
       }
    });
    webview.addEventListener('did-navigate', (e) => {
      const isOmChatNow = this.isOmChatUrl(e.url);
      tabState.isOmChat = isOmChatNow;
      tabState.noSuspend = isOmChatNow;
      if (isOmChatNow) this.applyOmChatTabIcon(tabState);
      tabState.url = e.url; 
      if (this.isPdfUrl(e.url) && !tabState.customIcon) {
        tabState.titleEl.textContent = webview.getTitle() || 'PDF Viewer';
      }
      if (!tabState.isSystemPage && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage && !tabState.isDownloadsPage && !e.url.includes('html/pages/home.html') && !e.url.startsWith('data:') && !e.url.startsWith('file:')) {
          if (window.browserAPI && window.browserAPI.history) {
             window.browserAPI.history.push({
                 title: webview.getTitle() || e.url,
                 url: e.url, timestamp: Date.now(), favicon: tabState.iconEl.src
             });
          }
      }
      window.dispatchEvent(new CustomEvent('website-visited', { detail: { id: tabState.id, url: e.url } }));
      if (this.activeTabId === tabState.id) this.onTabStateChange(e.url, false);

      // ── Security Check: Scan URL for malware/phishing ──────────────────
      // Runs asynchronously - if malicious, closes tab and blocks site
      (async () => {
        try {
          const securityCheck = await this.checkUrlSecurity(e.url);
          if (securityCheck.isMalicious) {
            await this.handleMaliciousUrl(tabState, e.url, securityCheck.reason);
          }
        } catch (err) {
          console.warn('[Security] Check failed:', err);
        }
      })();
      // ── End Security Check ─────────────────────────────────────────────

      setTimeout(() => {
        this.applySitePermissions(webview, e.url);
        this.applyGlobalWebsiteCss(webview);
        this.applyYouTubeAddon(webview);
        this.applyFloatingAdBlocker(webview);
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
      const isOmChatNow = this.isOmChatUrl(e.url);
      tabState.isOmChat = isOmChatNow;
      tabState.noSuspend = isOmChatNow;
      if (isOmChatNow) this.applyOmChatTabIcon(tabState);
      tabState.url = e.url;
      if (this.activeTabId === tabState.id) this.onTabStateChange(e.url, false);
      setTimeout(() => {
        this.applySitePermissions(webview, e.url);
        this.applyGlobalWebsiteCss(webview);
        this.applyYouTubeAddon(webview);
        this.applyFloatingAdBlocker(webview);
      }, 100);
      if (this.isDuckAiChatUrl(e.url)) {
        setTimeout(() => {
          this.applyDuckAiSidebarPreference(webview);
        }, 100);
      }
      if (this.isDuckDuckGoSearchUrl(e.url)) {
        setTimeout(() => {
          this.applyDuckDuckGoSearchCleanup(webview);
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
      if (this.isBlockedGuestNavigation((webview.getURL && webview.getURL()) || tabState.url || '', e.url)) {
          const defenseUrl = this.createDefenseUrl('blocked-local-navigation', e.url, 'Websites cannot open local app files or local disk paths.');
          this.createTab(defenseUrl);
          return;
      }
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
       const isGuestOpenTabRequest = event.channel === 'open-tab';
       if (!trustedHostMessage && !isGuestOpenTabRequest) {
           console.warn('[Tabs] Blocked host IPC message from untrusted page:', event.channel, senderUrl);
           return;
       }
       if (event.channel === 'run-html') {
           const content = event.args[0];
           const url = `data:text/html;charset=utf-8,${encodeURIComponent(content)}`;
           this.createTab(url);
       } else if (event.channel === 'open-tab') {
           const url = String(event.args[0] || '').trim();
           if (!url) return;
           if (this.isBlockedGuestNavigation(senderUrl, url)) {
               const defenseUrl = this.createDefenseUrl('blocked-local-navigation', url, 'Websites cannot open local app files or local disk paths.');
               this.createTab(defenseUrl);
               return;
           }
           let targetUrl = url;
           const safety = this.checkUrlSafety(url);
           if (!safety.safe) {
               targetUrl = this.createDefenseUrl(safety.type, safety.originalUrl, safety.reason);
           }
           this.createTab(targetUrl);
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
      
      // Remove all existing design classes first
      this.MUSIC_PLAYER_DESIGNS.forEach(design => {
          this.miniPlayer.classList.remove(design.className);
      });
      
      if (!enabled) {
          return;
      }
      
      // Apply selected design
      const selectedDesign = this.MUSIC_PLAYER_DESIGNS.find(d => d.id === designId);
      
      if (selectedDesign) {
          this.miniPlayer.classList.add(selectedDesign.className);
      } else {
          // Fallback to classic if design not found
          console.warn('[Music Player] Design not found for ID:', designId, '- using classic');
          this.miniPlayer.classList.add('player-classic');
      }
  }

  // Check if tab has playing video/audio (more reliable than just the audible flag)
  async isTabPlayingMedia(tab) {
    // If audible flag is set, definitely has media playing
    if (tab.audible) return true;
    // If suspended, no media playing
    if (tab.suspended || !tab.webview) return false;
    // Check if there's actually a playing media element
    try {
      const result = await tab.webview.executeJavaScript(`
        (function() {
          try {
            var videos = document.querySelectorAll('video');
            for (var i = 0; i < videos.length; i++) {
              if (!videos[i].paused && videos[i].currentTime > 0 && !videos[i].ended) return true;
            }
            var audios = document.querySelectorAll('audio');
            for (var j = 0; j < audios.length; j++) {
              if (!audios[j].paused && audios[j].currentTime > 0 && !audios[j].ended) return true;
            }
            // Check mediaSession for background audio
            if (navigator.mediaSession && navigator.mediaSession.playbackState === 'playing') return true;
          } catch(e) {}
          return false;
        })();
      `);
      return result === true;
    } catch (_) {
      return false;
    }
  }

  checkSuspension() {
      const now = Date.now();
      this.tabs.forEach(async (t) => {
          // Never suspend the active tab
          if (t.id === this.activeTabId) return;
          // Never suspend if already suspended
          if (t.suspended) return;
          // Check if tab has playing media (async check)
          const hasMedia = await this.isTabPlayingMedia(t);
          if (hasMedia) {
              // Update audible flag if media was detected
              t.audible = true;
              t.tabItem?.classList.add('audible');
              this.cancelScheduledSuspension(t);
              return;
          }
          // Check if enough time has passed since last access
          if (now - t.lastAccessed > this.SUSPEND_TIMEOUT) {
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
      if (!tab || tab.id === this.activeTabId || tab.suspended || tab.audible || tab.noSuspend || tab.isOmChat) return;
      this.cancelScheduledSuspension(tab);
      const remaining = Math.max(1000, this.SUSPEND_TIMEOUT - (Date.now() - tab.lastAccessed));
      tab.suspensionTimer = setTimeout(async () => {
          tab.suspensionTimer = null;
          if (tab.id !== this.activeTabId && !tab.suspended && !tab.noSuspend && !tab.isOmChat) {
              // Double-check media playing before suspending
              const hasMedia = await this.isTabPlayingMedia(tab);
              if (!hasMedia && !tab.audible) {
                  this.suspendTab(tab);
              }
          }
      }, remaining);
  }

  suspendTab(tab) {
      if (!tab.webview || tab.noSuspend || tab.isOmChat) return;
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
        t.lastAccessed = Date.now();
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
