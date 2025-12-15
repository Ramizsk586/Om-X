








import { isBlocked, getBlockedPage, getAnalyzingPage, verifySafetyWithAI, getErrorPage } from '../block.js';

export class TabManager {
  constructor(tabListContainerId, webviewContainerId, onTabStateChange) {
    this.tabListContainer = document.getElementById(tabListContainerId);
    this.webviewContainer = document.getElementById(webviewContainerId);
    this.loader = document.getElementById('loading-indicator');
    this.onTabStateChange = onTabStateChange; 
    
    // Resolve absolute path to home.html and preload.js relative to this module
    this.HOME_URL = new URL('../../../html/pages/home.html', import.meta.url).href;
    this.HISTORY_URL = new URL('../../../html/pages/history.html', import.meta.url).href;
    this.PRELOAD_URL = new URL('../../../preload.js', import.meta.url).href;
    
    // Icon for Settings Tab (Gear SVG Data URI)
    this.SETTINGS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62-.94l2.39-.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'/%3E%3C/svg%3E";
    
    // Icon for Image Studio (Palette)
    this.IMAGE_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";
    
    // Icon for Text Studio (Code/Terminal)
    this.TEXT_STUDIO_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'/%3E%3C/svg%3E";

    // Icon for History
    this.HISTORY_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 6v5l4.28 2.54.72-1.21-3.5-2.08V9H12z'/%3E%3C/svg%3E";
    
    // Icon for Games (Gamepad)
    this.GAMES_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c4dff'%3E%3Cpath d='M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/%3E%3C/svg%3E";

    this.tabs = [];
    this.activeTabId = null;
    this.nextTabId = 1;
    this.safeSearchEnabled = true;

    // Load Safe Search Setting
    this.loadSettings();

    // Listen for updates
    if (window.browserAPI && window.browserAPI.onSettingsUpdated) {
        window.browserAPI.onSettingsUpdated((settings) => {
            if (settings && settings.features) {
                this.safeSearchEnabled = settings.features.enableSafeSearch !== false;
            }
        });
    }

    // MEMORY OPTIMIZATION:
    // Check for inactive tabs every minute. If inactive for > 5 mins (was 10), discard webview.
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
  
  // Find a tab by checking if its URL contains a specific string
  findTabByUrl(urlSnippet) {
    return this.tabs.find(t => t.url && t.url.includes(urlSnippet));
  }

  // --- Core Lifecycle ---

  createTab(url) {
    // Default to Home URL if no URL provided
    const targetUrl = url || this.HOME_URL;
    const id = this.nextTabId++;
    
    const isSystemPage = targetUrl.includes('system.html');
    const isImgStudio = targetUrl.includes('image-editor.html');
    const isTextStudio = targetUrl.includes('text-editor.html');
    const isHistoryPage = targetUrl.includes('history.html');
    const isGamesPage = targetUrl.includes('games.html');

    // 1. Create Sidebar UI Element
    const { tabItem, titleEl, iconEl } = this.createTabUI(id, { isSystemPage, isImgStudio, isTextStudio, isHistoryPage, isGamesPage });

    // 2. Create State Object
    const tabState = {
      id, 
      webview: null, // Created on demand or below
      tabItem,
      titleEl,
      iconEl,
      url: targetUrl,
      lastAccessed: Date.now(),
      suspended: false,
      isSystemPage,
      isImgStudio,
      isTextStudio,
      isHistoryPage,
      isGamesPage,
      isLoading: true, // Initially loading
      customIcon: false // Track if icon was manually set
    };
    
    this.tabs.push(tabState);
    this.tabListContainer.appendChild(tabItem);

    // 3. Create actual Webview
    this.createWebviewForTab(tabState);
    
    // 4. Activate
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
        tabItem.title = 'System';
    } else if (flags.isImgStudio) {
        iconSrc = this.IMAGE_STUDIO_ICON;
        title = 'Image Studio';
        tabItem.title = 'Image Studio';
    } else if (flags.isTextStudio) {
        iconSrc = this.TEXT_STUDIO_ICON;
        title = 'Text Studio';
        tabItem.title = 'Text Studio';
    } else if (flags.isHistoryPage) {
        iconSrc = this.HISTORY_ICON;
        title = 'History';
        tabItem.title = 'History';
    } else if (flags.isGamesPage) {
        iconSrc = this.GAMES_ICON;
        title = 'Games';
        tabItem.title = 'Games';
    } else {
        tabItem.title = 'New Tab';
    }

    // Favicon
    const iconEl = document.createElement('img');
    iconEl.className = 'tab-favicon';
    iconEl.src = iconSrc;
    iconEl.onerror = () => { iconEl.style.visibility = 'hidden'; };
    
    // Title
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = title;

    // Close Button
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
    
    // Click to switch
    tabItem.onclick = () => this.setActiveTab(id);

    return { tabItem, titleEl, iconEl };
  }

  createWebviewForTab(tabState) {
    const webview = document.createElement('webview');
    webview.preload = this.PRELOAD_URL;
    
    // SECURITY: Use contextIsolation and enable webSecurity for browsing
    webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no');
    
    webview.setAttribute('allowpopups', 'yes');
    
    // Attach Listeners
    this._attachWebviewListeners(webview, tabState);

    this.webviewContainer.appendChild(webview);
    
    // Handle Block Check Initial Load
    this.handleNavigationRequest(webview, tabState.url);

    tabState.webview = webview;
    tabState.suspended = false;
    tabState.tabItem.classList.remove('suspended');
  }

  // Separated Logic for Check
  async handleNavigationRequest(webview, url) {
     if (!this.safeSearchEnabled || url.startsWith('file:') || url.startsWith('about:') || url.startsWith('data:')) {
         webview.src = url;
         return;
     }

     const check = isBlocked(url);
     
     if (check.status === 'BLOCKED') {
        webview.src = getBlockedPage(url);
     } else if (check.status === 'REVIEW') {
        // Load loading screen
        webview.src = getAnalyzingPage(url);
        
        // Generate request ID to prevent race conditions
        const requestId = Date.now().toString();
        webview.dataset.pendingCheck = requestId;

        // Perform Async Check
        const isSafe = await verifySafetyWithAI(url);
        
        // Race condition check: make sure user didn't navigate away
        if (webview.dataset.pendingCheck !== requestId) return;

        // After check, use loadURL
        if (isSafe) {
           webview.dataset.verifiedUrl = url;
           webview.loadURL(url, { httpReferrer: 'omx-safe-verification' }); 
        } else {
           webview.loadURL(getBlockedPage(url));
        }
     } else {
        webview.src = url;
     }
  }

  navigateTo(url) {
      const active = this.getActiveWebview();
      if (active) {
          // Immediately show visual feedback if using safe search for reviewable content
          if (this.safeSearchEnabled && !url.startsWith('file:') && !url.startsWith('about:') && !url.startsWith('data:')) {
             const check = isBlocked(url);
             if (check.status === 'REVIEW') {
                 // Tag logic for active verification
                 const requestId = Date.now().toString();
                 active.dataset.pendingCheck = requestId;

                 active.src = getAnalyzingPage(url);
                 
                 verifySafetyWithAI(url).then(isSafe => {
                     // Check if valid
                     if (active.dataset.pendingCheck !== requestId) return;
                     
                     if (isSafe) {
                         active.dataset.verifiedUrl = url;
                         active.loadURL(url);
                     } else {
                         active.loadURL(getBlockedPage(url));
                     }
                 });
                 return;
             }
          }
          active.src = url;
      } else {
          this.createTab(url);
      }
  }

  updateTabIcon(tabId, iconDataUrl) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
        tab.iconEl.src = iconDataUrl;
        tab.iconEl.style.visibility = 'visible';
        tab.customIcon = true; // Lock the icon
    }
  }

  _attachWebviewListeners(webview, tabState) {
    // Remove default behavior and implement smart check
    webview.addEventListener('will-navigate', (e) => {
        // 1. Bypass check if Safe Search disabled or local/system url
        if (!this.safeSearchEnabled || e.url.startsWith('file:') || e.url.startsWith('about:') || e.url.startsWith('data:')) {
            return;
        }

        // 2. Bypass check if already verified
        if (webview.dataset.verifiedUrl === e.url) {
            return; 
        }
        
        const check = isBlocked(e.url);
        
        if (check.status === 'BLOCKED') {
            // Replaced webview.stop() with loadURL to prevent ERR_ABORTED errors in console
            // loadURL implicitly cancels the pending navigation
            webview.loadURL(getBlockedPage(e.url));
            return;
        } 
        
        if (check.status === 'REVIEW') {
            // Loop Prevention for Redirects
            if (webview.src === getAnalyzingPage(e.url)) return;

            // Use loadURL to hijack navigation cleanly
            webview.loadURL(getAnalyzingPage(e.url));
            
            // Race condition handling
            const requestId = Date.now().toString();
            webview.dataset.pendingCheck = requestId;
            
            verifySafetyWithAI(e.url).then(isSafe => {
                if (webview.dataset.pendingCheck !== requestId) return;

                if(isSafe) {
                    webview.dataset.verifiedUrl = e.url;
                    webview.loadURL(e.url);
                } else {
                    webview.loadURL(getBlockedPage(e.url));
                }
            });
            return;
        }
    });


    webview.addEventListener('did-start-loading', () => {
      tabState.isLoading = true;
      if (this.activeTabId === tabState.id && this.loader) {
        this.loader.classList.remove('hidden');
      }
    });

    webview.addEventListener('did-stop-loading', () => {
      tabState.isLoading = false;
      if (this.activeTabId === tabState.id && this.loader) {
         this.loader.classList.add('hidden');
      }
      
      // Update Tab Title if generic
      try {
        if(!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage) {
            const pageTitle = webview.getTitle();
            if (pageTitle) {
                tabState.titleEl.textContent = pageTitle;
                tabState.tabItem.title = pageTitle;
            }
        }
      } catch (e) {}

      if (this.activeTabId === tabState.id) {
        try {
          this.onTabStateChange(webview.getURL(), false);
        } catch (e) { }
      }
    });
    
    webview.addEventListener('dom-ready', () => {
       if (this.activeTabId === tabState.id && this.loader) {
          this.loader.classList.add('hidden');
       }
    });
    
    webview.addEventListener('did-fail-load', (e) => {
       tabState.isLoading = false;
       if (this.activeTabId === tabState.id && this.loader) {
          this.loader.classList.add('hidden');
       }
       
       // Ignore aborts (e.g. stop() called)
       if (e.errorCode !== -3) {
           console.warn('Page failed to load:', e.validatedURL, e.errorCode, e.errorDescription);
           webview.loadURL(getErrorPage(e.validatedURL, e.errorCode, e.errorDescription));
       }
    });
    
    webview.addEventListener('page-title-updated', (e) => {
       if(!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage) {
           tabState.titleEl.textContent = e.title;
           tabState.tabItem.title = e.title;
       }
    });
    
    webview.addEventListener('page-favicon-updated', (e) => {
       // Only update favicon if user hasn't set a custom icon
       if (!tabState.customIcon && !tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && e.favicons && e.favicons.length > 0) {
         tabState.iconEl.src = e.favicons[0];
         tabState.iconEl.style.visibility = 'visible';
       }
    });

    webview.addEventListener('did-navigate', (e) => {
      // Clear verification tag on successful navigation to a new place (or same place)
      // to ensure re-loads are re-checked if necessary, or keep it if it matches.
      if (webview.dataset.verifiedUrl !== e.url) {
          delete webview.dataset.verifiedUrl;
      }
      
      // Re-check block (e.g. client side redirect) - but skip if verified
      // And skip if Safe Search disabled, and skip local files
      if (this.safeSearchEnabled && webview.dataset.verifiedUrl !== e.url && !e.url.startsWith('file:') && !e.url.startsWith('about:') && !e.url.startsWith('data:')) {
          const check = isBlocked(e.url);
          if (check.status === 'BLOCKED') {
            webview.loadURL(getBlockedPage(e.url));
            return;
          }
          // Note: If 'REVIEW' hits here (client-side redirect), it will trigger the same loading page flow 
          // essentially blocking instant client redirects. This is acceptable for safety.
      }

      tabState.url = e.url; 
      
      // SAVE HISTORY
      if (!tabState.isSystemPage && !tabState.isImgStudio && !tabState.isTextStudio && !tabState.isHistoryPage && !tabState.isGamesPage && !e.url.includes('html/pages/home.html') && !e.url.startsWith('data:') && !e.url.startsWith('file:')) {
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
      // Basic block check for new windows
      if (this.safeSearchEnabled && !e.url.startsWith('file:') && !e.url.startsWith('about:') && !e.url.startsWith('data:')) {
          const check = isBlocked(e.url);
          if (check.status === 'BLOCKED') {
              this.createTab(getBlockedPage(e.url));
          } else {
              // For REVIEW, we just create the tab, let the tab's internal logic handle the verification
              this.createTab(e.url);
          }
      } else {
          this.createTab(e.url);
      }
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

  // --- Memory Optimization Logic ---

  checkSuspension() {
      const now = Date.now();
      this.tabs.forEach(t => {
          // Never suspend active tab
          if (t.id !== this.activeTabId && !t.suspended) { 
             // Suspend if inactive for too long
             if (now - t.lastAccessed > this.SUSPEND_TIMEOUT) {
                 this.suspendTab(t);
             }
          }
      });
  }

  suspendTab(tab) {
      if (!tab.webview) return;
      
      console.log(`Suspending tab ${tab.id} for memory optimization`);
      
      // Save current state before destruction
      try {
          tab.url = tab.webview.getURL();
          tab.webview.blur(); 
      } catch(e) {}

      // Destroy Webview
      tab.webview.remove();
      tab.webview = null;
      tab.suspended = true;
      
      // Visual Feedback
      tab.tabItem.classList.add('suspended');
      
      // Hint to V8
      if(window.gc) window.gc();
  }

  restoreTab(tab) {
      if (!tab.suspended) return;
      console.log(`Restoring tab ${tab.id}`);
      this.createWebviewForTab(tab);
  }

  // --- Actions ---
  
  showLoader() {
      if (this.loader) this.loader.classList.remove('hidden');
  }

  closeTab(id) {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tab = this.tabs[index];
    
    if (tab.webview) {
        try {
            tab.webview.blur();
        } catch(e){}
        tab.webview.remove();
    }
    if (tab.tabItem) tab.tabItem.remove();
    
    this.tabs.splice(index, 1);
    
    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        // Activate nearest neighbor
        const nextIndex = Math.min(index, this.tabs.length - 1);
        this.setActiveTab(this.tabs[nextIndex].id);
      } else {
        this.activeTabId = null;
        this.createTab(); 
      }
    }
    
    if (window.gc) window.gc(); 
  }

  setActiveTab(id) {
    if (this.activeTabId === id && this.tabs.length > 1) {
       // already active
    }
    
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;
    
    this.activeTabId = id;
    
    // Update Loader visibility based on tab state
    if (this.loader) {
        if (tab.isLoading) {
            this.loader.classList.remove('hidden');
        } else {
            this.loader.classList.add('hidden');
        }
    }
    
    // Wake up if sleeping
    if (tab.suspended) {
        this.restoreTab(tab);
    }
    
    // Update timestamps
    tab.lastAccessed = Date.now();

    this.tabs.forEach(t => {
      if (t.id === id) {
        if(t.webview) {
            t.webview.classList.remove('hidden');
            setTimeout(() => { try { t.webview.focus(); } catch(e){} }, 50); 
            
            try {
                this.onTabStateChange(t.webview.getURL(), false);
            } catch(e) {
                this.onTabStateChange(t.url, false);
            }
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