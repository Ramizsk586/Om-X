
import { isBlocked } from '../block.js';

export class TabManager {
  constructor(tabListContainerId, webviewContainerId, onTabStateChange, onContextMenu) {
    this.tabListContainer = document.getElementById(tabListContainerId);
    this.webviewContainer = document.getElementById(webviewContainerId);
    this.loader = document.getElementById('loading-indicator');
    this.onTabStateChange = onTabStateChange; 
    this.onContextMenu = onContextMenu;
    
    // Paths
    this.HOME_URL = new URL('../../../html/pages/home.html', import.meta.url).href;
    this.HISTORY_URL = new URL('../../../html/pages/history.html', import.meta.url).href;
    this.SECURITY_DEFENSE_URL = new URL('../../../html/pages/security-defense.html', import.meta.url).href;
    this.PRELOAD_URL = new URL('../../../preload.js', import.meta.url).href;
    
    // Icons
    this.SETTINGS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62-.94l2.39-.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'/%3E%3C/svg%3E";
    this.IMAGE_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    this.TEXT_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'/%3E%3C/svg%3E";
    this.HISTORY_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 6v5l4.28 2.54.72-1.21-3.5-2.08V9H12z'/%3E%3C/svg%3E";
    this.GAMES_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    this.SHIELD_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff5252'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

    this.tabs = [];
    this.activeTabId = null;
    this.nextTabId = 1;
    this.safeSearchEnabled = true;

    this.loadSettings();

    if (window.browserAPI && window.browserAPI.onSettingsUpdated) {
        window.browserAPI.onSettingsUpdated((settings) => {
            if (settings && settings.features) {
                this.safeSearchEnabled = settings.features.enableSafeSearch !== false;
            }
        });
    }

    this.SUSPEND_TIMEOUT = 5 * 60 * 1000; 
    setInterval(() => this.checkSuspension(), 60000);
  }

  async loadSettings() {
     try {
         const settings = await window.browserAPI.settings.get();
         if (settings && settings.features) {
             this.safeSearchEnabled = settings.features.enableSafeSearch !== false;
         }
     } catch(e) {}
  }

  // --- PRE-NAVIGATION SECURITY CHECK ---
  // Returns formatted URL (safe) or Defense URL (blocked)
  checkUrlSafety(url) {
    if (!url) return { safe: true };
    
    // 1. Bypass Internal / Local
    if (url.startsWith('file:') || url.startsWith('data:') || url.startsWith('about:') || url.includes('security-defense.html')) {
        return { safe: true };
    }

    // 2. Renderer-Side Safety Check
    if (this.safeSearchEnabled) {
        const check = isBlocked(url);
        if (check.status === 'BLOCKED') {
            return {
                safe: false,
                type: check.type || 'policy',
                reason: check.reason,
                originalUrl: url
            };
        }
    }
    
    return { safe: true };
  }

  createDefenseUrl(type, url, reason) {
      const safeUrl = encodeURIComponent(url);
      const safeReason = encodeURIComponent(reason || 'Blocked by Safety Policy');
      return `${this.SECURITY_DEFENSE_URL}?type=${type}&url=${safeUrl}&reason=${safeReason}`;
  }
  
  /**
   * Primary method for navigation.
   * Checks safety BEFORE telling the webview to load.
   */
  navigateTo(url) {
    if (!url) return;

    // 1. Perform Safety Check
    const safety = this.checkUrlSafety(url);
    let finalUrl = url;

    if (!safety.safe) {
        // Redirect to defense page immediately
        // This prevents Electron from ever attempting to load the bad URL
        finalUrl = this.createDefenseUrl(safety.type, safety.originalUrl, safety.reason);
    }

    if (this.activeTabId) {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) {
        // If tab is suspended, restore it first
        if (tab.suspended) {
            this.restoreTab(tab);
        }
        
        if (tab.webview) {
            // Webview only receives safe/approved URLs now
            tab.webview.src = finalUrl;
            return;
        }
      }
    }
    
    // Fallback: create new tab if navigation in current is impossible
    this.createTab(finalUrl);
  }

  createTab(url) {
    // 1. Validate Initial URL
    const targetUrlRaw = url || this.HOME_URL;
    const safety = this.checkUrlSafety(targetUrlRaw);
    let finalUrl = targetUrlRaw;
    
    if (!safety.safe) {
        finalUrl = this.createDefenseUrl(safety.type, safety.originalUrl, safety.reason);
    }

    const id = this.nextTabId++;
    
    // Identify internal pages
    const isSystemPage = finalUrl.includes('system.html');
    const isImgStudio = finalUrl.includes('image-editor.html');
    const isTextStudio = finalUrl.includes('text-editor.html');
    const isHistoryPage = finalUrl.includes('history.html');
    const isGamesPage = finalUrl.includes('games.html');
    const isDefensePage = finalUrl.includes('security-defense.html');

    const { tabItem, titleEl, iconEl } = this.createTabUI(id, { 
        isSystemPage, isImgStudio, isTextStudio, isHistoryPage, isGamesPage, isDefensePage 
    });

    const tabState = {
      id, 
      webview: null,
      tabItem,
      titleEl,
      iconEl,
      url: finalUrl,
      lastAccessed: Date.now(),
      suspended: false,
      isSystemPage,
      isImgStudio,
      isTextStudio,
      isHistoryPage,
      isGamesPage,
      isDefensePage,
      isLoading: true,
      customIcon: false
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
    
    let iconSrc = '../../assets/icons/app.ico';
    let title = 'Loading...';

    if (flags.isSystemPage) {
        iconSrc = this.SETTINGS_ICON;
        title = 'System';
    } else if (flags.isImgStudio) {
        iconSrc = this.IMAGE_STUDIO_ICON;
        title = 'Image Studio';
    } else if (flags.isTextStudio) {
        iconSrc = this.TEXT_STUDIO_ICON;
        title = 'Text Studio';
    } else if (flags.isHistoryPage) {
        iconSrc = this.HISTORY_ICON;
        title = 'History';
    } else if (flags.isGamesPage) {
        iconSrc = this.GAMES_ICON;
        title = 'Games';
    } else if (flags.isDefensePage) {
        iconSrc = this.SHIELD_ICON;
        title = 'Security Alert';
        tabItem.classList.add('defense-tab');
    } else {
        tabItem.title = 'New Tab';
    }

    const iconEl = document.createElement('img');
    iconEl.className = 'tab-favicon';
    iconEl.src = iconSrc;
    iconEl.onerror = () => { iconEl.style.visibility = 'hidden'; };
    
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerHTML = '<svg viewBox="0 0 12 12"><path d="M1 1l10 10M1 11L11 1" stroke="currentColor" stroke-width="2"/></svg>';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.closeTab(id);
    };

    tabItem.appendChild(iconEl);
    tabItem.appendChild(titleEl);
    tabItem.appendChild(closeBtn);
    tabItem.onclick = () => this.setActiveTab(id);

    return { tabItem, titleEl, iconEl };
  }

  createWebviewForTab(tabState) {
    const webview = document.createElement('webview');
    webview.preload = this.PRELOAD_URL;
    webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no');
    webview.setAttribute('allowpopups', 'yes');
    
    this._attachWebviewListeners(webview, tabState);
    this.webviewContainer.appendChild(webview);
    
    // Set src directly - safety check was already done in createTab/navigateTo
    webview.src = tabState.url;

    tabState.webview = webview;
    tabState.suspended = false;
    tabState.tabItem.classList.remove('suspended');
  }

  _attachWebviewListeners(webview, tabState) {
    webview.addEventListener('context-menu', (e) => {
        if (this.onContextMenu) this.onContextMenu(e.params);
    });

    // Handle in-page navigation (clicking links)
    webview.addEventListener('will-navigate', (e) => {
        if (!this.safeSearchEnabled) return;
        
        const safety = this.checkUrlSafety(e.url);
        
        if (!safety.safe) {
            // STOP the bad navigation instantly
            e.preventDefault();
            
            // Redirect to defense page
            const defenseUrl = this.createDefenseUrl(safety.type, safety.originalUrl, safety.reason);
            webview.src = defenseUrl;
        }
    });

    webview.addEventListener('did-start-loading', () => {
      tabState.isLoading = true;
      if (this.activeTabId === tabState.id && this.loader) this.loader.classList.remove('hidden');
    });

    webview.addEventListener('did-stop-loading', () => {
      tabState.isLoading = false;
      if (this.activeTabId === tabState.id && this.loader) this.loader.classList.add('hidden');
      
      // Update Title
      try {
        if(!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage) {
            const pageTitle = webview.getTitle();
            if (pageTitle) {
                tabState.titleEl.textContent = pageTitle;
                tabState.tabItem.title = pageTitle;
            }
        }
      } catch (e) {}

      if (this.activeTabId === tabState.id) {
        try { this.onTabStateChange(webview.getURL(), false); } catch (e) { }
      }
    });
    
    webview.addEventListener('dom-ready', () => {
       if (this.activeTabId === tabState.id && this.loader) this.loader.classList.add('hidden');
    });
    
    webview.addEventListener('did-fail-load', (e) => {
       tabState.isLoading = false;
       if (this.activeTabId === tabState.id && this.loader) this.loader.classList.add('hidden');
       
       // Ignore common expected errors:
       // -3: ERR_ABORTED (User cancelled or prevented)
       // -2: ERR_FAILED (Blocked by main process firewall)
       // -20: ERR_BLOCKED_BY_CLIENT (Blocked by client rules)
       const ignoredCodes = [-3, -2, -20];
       if (!ignoredCodes.includes(e.errorCode)) {
           console.warn('Page failed to load:', e.validatedURL, e.errorCode, e.errorDescription);
       }
    });
    
    webview.addEventListener('page-title-updated', (e) => {
       if(!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage) {
           tabState.titleEl.textContent = e.title;
           tabState.tabItem.title = e.title;
       }
    });
    
    webview.addEventListener('page-favicon-updated', (e) => {
       if (!tabState.customIcon && !tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && e.favicons && e.favicons.length > 0) {
         tabState.iconEl.src = e.favicons[0];
         tabState.iconEl.style.visibility = 'visible';
       }
    });

    webview.addEventListener('did-navigate', (e) => {
      tabState.url = e.url; 
      // History Logic
      if (!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !tabState.isDefensePage && !e.url.includes('html/pages/home.html') && !e.url.startsWith('data:') && !e.url.startsWith('file:')) {
          if (window.browserAPI && window.browserAPI.history) {
             window.browserAPI.history.push({
                 title: webview.getTitle() || e.url,
                 url: e.url,
                 timestamp: Date.now(),
                 favicon: tabState.iconEl.src
             });
          }
      }
      if (this.activeTabId === tabState.id) {
        this.onTabStateChange(e.url, false);
      }
    });
    
    webview.addEventListener('new-window', (e) => {
      // Must prevent default to handle tab creation manually
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
       } 
    });

    webview.addEventListener('crashed', () => {
      console.warn(`Tab ${tabState.id} crashed`);
      tabState.titleEl.textContent = "Crashed";
    });
  }

  // --- Optimization ---
  checkSuspension() {
      const now = Date.now();
      this.tabs.forEach(t => {
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
      if(window.gc) window.gc();
  }

  restoreTab(tab) {
      if (!tab.suspended) return;
      this.createWebviewForTab(tab);
  }

  showLoader() {
      if (this.loader) this.loader.classList.remove('hidden');
  }

  closeTab(id) {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index === -1) return;
    const tab = this.tabs[index];
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
    if (window.gc) window.gc(); 
  }

  updateTabIcon(id, dataUri) {
      const tab = this.tabs.find(t => t.id === id);
      if (tab) {
          tab.iconEl.src = dataUri;
          tab.iconEl.style.visibility = 'visible';
          tab.customIcon = true;
      }
  }

  setActiveTab(id) {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;
    this.activeTabId = id;
    if (this.loader) {
        if (tab.isLoading) this.loader.classList.remove('hidden');
        else this.loader.classList.add('hidden');
    }
    if (tab.suspended) this.restoreTab(tab);
    tab.lastAccessed = Date.now();

    this.tabs.forEach(t => {
      if (t.id === id) {
        if(t.webview) {
            t.webview.classList.remove('hidden');
            setTimeout(() => { try { t.webview.focus(); } catch(e){} }, 50); 
            try { this.onTabStateChange(t.webview.getURL(), false); } catch(e) { this.onTabStateChange(t.url, false); }
        }
        t.tabItem.classList.add('active');
      } else {
        if (t.webview) {
            t.webview.classList.add('hidden');
            t.webview.blur();
        }
        t.tabItem.classList.remove('active');
      }
    });
  }

  getActiveWebview() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    return tab ? tab.webview : null;
  }
}
