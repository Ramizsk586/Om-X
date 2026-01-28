import { isBlocked } from '../block.js';

export class TabManager {
  constructor(tabListContainerId, webviewContainerId, onTabStateChange, onContextMenu, onTabContextMenu) {
    this.tabListContainer = document.getElementById(tabListContainerId);
    this.webviewContainer = document.getElementById(webviewContainerId);
    this.loader = document.getElementById('loading-indicator');
    this.findingLabel = document.getElementById('finding-label');
    this.findingTimer = document.getElementById('finding-timer');
    
    this.onTabStateChange = onTabStateChange; 
    this.onContextMenu = onContextMenu;
    this.onTabContextMenu = onTabContextMenu;
    
    this.miniPlayer = document.getElementById('mini-player');
    this.sidebarControls = document.getElementById('sidebar-footer-controls');
    this.playerTitle = document.getElementById('player-title');
    this.playerSource = document.getElementById('player-source');
    this.playerPlayIcon = document.getElementById('icon-play');
    this.playerPauseIcon = document.getElementById('icon-pause');
    
    this.btnPrev = document.getElementById('player-btn-prev');
    this.btnNext = document.getElementById('player-btn-next');
    this.btnToggle = document.getElementById('player-btn-toggle');

    this.HOME_URL = new URL('../../../html/pages/home.html', import.meta.url).href;
    this.HISTORY_URL = new URL('../../../html/pages/history.html', import.meta.url).href;
    this.SECURITY_DEFENSE_URL = new URL('../../../html/pages/security-defense.html', import.meta.url).href;
    this.PRELOAD_URL = new URL('../../../preload.js', import.meta.url).href;
    
    this.APP_ICON = "../../assets/icons/app.ico";
    this.SETTINGS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l2.39-.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l0.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-0.24,1.13-0.56,1.62-0.94l2.39.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z'/%3E%3C/svg%3E";
    this.IMAGE_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    this.TEXT_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'/%3E%3C/svg%3E";
    this.HISTORY_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 6v5l4.28 2.54.72-1.21-3.5-2.08V9H12z'/%3E%3C/svg%3E";
    this.GAMES_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    this.SHIELD_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff5252'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z'/%3E%3C/svg%3E";
    this.LOCAL_AI_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M21 16.5C21 16.88 20.79 17.21 20.47 17.38L12.57 21.82C12.41 21.94 12.21 22 12 22C11.79 22 11.59 21.94 11.43 21.82L3.53 17.38C3.21 17.21 3 16.88 3 16.5V7.5C3 7.12 3.21 6.79 3.53 6.62L11.43 2.18C11.59 2.06 11.79 2 12 2C12.21 2 12.41 2.06 12.57 2.18L20.47 6.62C20.79 6.79 21 7.12 21 7.5V16.5Z'/%3E%3C/svg%3E";

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

    this.tabs = [];
    this.activeTabId = null;
    this.nextTabId = 1;
    this.activeAudioTabId = null; 
    this.settings = null;
    this.findingInterval = null;
    this.findingStartTime = 0;

    this.loadSettings();
    this.setupPlayerControls();

    this.SUSPEND_TIMEOUT = 5 * 60 * 1000; 
    setInterval(() => this.checkSuspension(), 60000);
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
         this.settings = settings;
     } catch(e) {}
  }

  checkUrlSafety(url) {
    if (!url) return { safe: true };
    if (url.startsWith('file:') || url.startsWith('data:') || url.startsWith('about:') || url.includes('security-defense.html')) {
        return { safe: true };
    }
    return { safe: true };
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
    const isLocalAIPage = finalUrl.includes('local-ai-manager.html');

    const { tabItem, titleEl, iconEl } = this.createTabUI(id, { 
        isSystemPage, isImgStudio, isTextStudio, isHistoryPage, isGamesPage, isDefensePage, isLocalAIPage
    });
    const tabState = {
      id, webview: null, tabItem, titleEl, iconEl, url: finalUrl,
      lastAccessed: Date.now(), suspended: false, isSystemPage, isImgStudio,
      isTextStudio, isHistoryPage, isGamesPage, isDefensePage, isLocalAIPage, isLoading: true,
      customIcon: false, audible: false,
      interactiveSearch: options.interactiveSearch || null
    };
    this.tabs.push(tabState);
    this.tabListContainer.appendChild(tabItem);
    this.createWebviewForTab(tabState);
    this.setActiveTab(id);
    return id;
  }

  createTabUI(id, flags) {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    let iconSrc = this.APP_ICON;
    let title = 'Loading...';
    if (flags.isSystemPage) { iconSrc = this.SETTINGS_ICON; title = 'System'; } 
    else if (flags.isImgStudio) { iconSrc = this.IMAGE_STUDIO_ICON; title = 'Image Studio'; } 
    else if (flags.isTextStudio) { iconSrc = this.TEXT_STUDIO_ICON; title = 'Text Studio'; } 
    else if (flags.isHistoryPage) { iconSrc = this.HISTORY_ICON; title = 'History'; } 
    else if (flags.isGamesPage) { iconSrc = this.GAMES_ICON; title = 'Games'; } 
    else if (flags.isLocalAIPage) { iconSrc = this.LOCAL_AI_ICON; title = 'Neural Station'; }
    else if (flags.isDefensePage) { iconSrc = this.SHIELD_ICON; title = 'Security Alert'; tabItem.classList.add('defense-tab'); } 
    else tabItem.title = 'New Tab';
    const audioIcon = document.createElement('div');
    audioIcon.innerHTML = `<svg class="tab-audio-icon" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.1-.9-2-2-2s-2 .9-2 2v6c0 1.1.9 2 2 2z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
    const iconEl = document.createElement('img');
    iconEl.className = 'tab-favicon';
    iconEl.src = iconSrc;
    iconEl.onerror = () => { iconEl.src = this.APP_ICON; };
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
    webview.preload = this.PRELOAD_URL;
    webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no');
    webview.setAttribute('allowpopups', 'yes');
    this._attachWebviewListeners(webview, tabState);
    this.webviewContainer.appendChild(webview);
    webview.src = tabState.url;
    tabState.webview = webview;
    tabState.suspended = false;
    tabState.tabItem.classList.remove('suspended');

    if (this.settings && this.settings.openDevToolsOnStart) {
        webview.addEventListener('dom-ready', () => {
            webview.openDevTools({ mode: 'detach' });
        });
    }
  }

  _startFindingAnimation() {
    const enabled = this.settings?.features?.showLoadingAnimation !== false;
    if (!enabled) return;
    
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
    webview.addEventListener('did-start-loading', () => {
      tabState.isLoading = true;
      if (this.activeTabId === tabState.id && this.loader) {
          const enabled = this.settings?.features?.showLoadingAnimation !== false;
          if (enabled) {
            this.loader.classList.remove('hidden');
            this._startFindingAnimation();
          }
      }
    });
    webview.addEventListener('did-stop-loading', () => {
      tabState.isLoading = false;
      if (this.activeTabId === tabState.id && this.loader) {
          this.loader.classList.add('hidden');
          this._stopFindingAnimation();
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
        if(!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage) {
            const pageTitle = webview.getTitle();
            if (pageTitle) {
                tabState.titleEl.textContent = pageTitle;
                tabState.tabItem.title = pageTitle;
                if (this.activeAudioTabId === tabState.id) this.playerTitle.textContent = pageTitle;
            }
        }
      } catch (e) {}
      if (this.activeTabId === tabState.id) {
        try { this.onTabStateChange(webview.getURL(), false); } catch (e) { }
      }
    });
    webview.addEventListener('dom-ready', () => {
       if (this.activeTabId === tabState.id && this.loader) {
           this.loader.classList.add('hidden');
           this._stopFindingAnimation();
       }
    });
    webview.addEventListener('page-title-updated', (e) => {
       if(!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !tabState.isLocalAIPage) {
           tabState.titleEl.textContent = e.title;
           tabState.tabItem.title = e.title;
           if (this.activeAudioTabId === tabState.id) this.playerTitle.textContent = e.title;
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
       if (event.channel === 'run-html') {
           const content = event.args[0];
           const url = `data:text/html;charset=utf-8,${encodeURIComponent(content)}`;
           this.createTab(url);
       } else if (event.channel === 'open-tab') {
           const url = event.args[0];
           this.createTab(url);
       }
    });
    webview.addEventListener('crashed', () => {
      tabState.titleEl.textContent = "Crashed";
    });
  }

  updateMiniPlayerState(tab, isPlaying) {
      if (isPlaying && tab) {
          this.activeAudioTabId = tab.id;
          this.playerTitle.textContent = tab.titleEl.textContent || 'Unknown Track';
          try {
              const u = new URL(tab.url);
              this.playerSource.textContent = u.hostname.replace('www.','');
          } catch(e) { this.playerSource.textContent = 'Web Source'; }
          this.playerPlayIcon.classList.add('hidden');
          this.playerPauseIcon.classList.remove('hidden');
          if (this.miniPlayer) {
              this.miniPlayer.classList.remove('hidden');
              this.miniPlayer.classList.add('is-playing');
          }
          if (this.sidebarControls) this.sidebarControls.classList.add('hidden');
      } else {
          this.activeAudioTabId = null;
          this.playerPlayIcon.classList.remove('hidden');
          this.playerPauseIcon.classList.add('hidden');
          if (this.miniPlayer) {
              this.miniPlayer.classList.add('hidden');
              this.miniPlayer.classList.remove('is-playing');
          }
          if (this.sidebarControls) this.sidebarControls.classList.remove('hidden');
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
        if (tab.isLoading && enabled) {
            this.loader.classList.remove('hidden');
            this._startFindingAnimation();
        } else {
            this.loader.classList.add('hidden');
            this._stopFindingAnimation();
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