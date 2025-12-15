



import { TabManager } from './ui/tabs.js';
import { AISidebar } from './ui/aiSidebar.js';
import { SidePanel } from './ui/sidePanel.js';
import { ScreenshotOverlay } from './ui/screenshotOverlay.js';
import { BookmarkPanel } from './ui/bookmarkPanel.js';

document.addEventListener('DOMContentLoaded', async () => {
  // --- UI Elements ---
  const searchOverlay = document.getElementById('search-overlay');
  const overlayInput = document.getElementById('overlay-input');
  const searchIconContainer = document.querySelector('.search-icon');
  
  // Resolve URLs
  const HOME_URL = new URL('../../html/pages/home.html', import.meta.url).href;
  const SETTINGS_URL = new URL('../../html/windows/system.html', import.meta.url).href;
  const IMG_EDITOR_URL = new URL('../../html/windows/image-editor.html', import.meta.url).href;
  const TEXT_EDITOR_URL = new URL('../../html/windows/text-editor.html', import.meta.url).href;
  const HISTORY_URL = new URL('../../html/pages/history.html', import.meta.url).href;
  const DOWNLOADS_URL = new URL('../../html/pages/downloads.html', import.meta.url).href;
  const GAMES_URL = new URL('../../html/pages/games.html', import.meta.url).href;
  
  // Default Search Icon (SVG) - Corrected path
  const DEFAULT_ICON_HTML = `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 12 14 9.5 14z"/></svg>`;

  let activeSearchEngine = null;
  let cachedSettings = null;

  // --- Sidebar Buttons ---
  const btnNavHome = document.getElementById('btn-nav-home');
  const btnNavHistory = document.getElementById('btn-nav-history');
  const btnNavImgStudio = document.getElementById('btn-nav-img-studio');
  const btnNavTextStudio = document.getElementById('btn-nav-text-studio');
  const btnNavGames = document.getElementById('btn-nav-games');
  const btnNavSettings = document.getElementById('btn-nav-settings');
  const btnNavDownloads = document.getElementById('btn-nav-downloads');
  const btnNewTab = document.getElementById('btn-new-tab');

  // --- Helpers ---
  const loadSettings = async (injectedSettings = null) => {
      try {
          if (injectedSettings) {
             cachedSettings = injectedSettings;
          } else {
             cachedSettings = await window.browserAPI.settings.get();
          }
          
          if (cachedSettings && cachedSettings.features) {
              // Text Studio Visibility
              if (cachedSettings.features.enableTextStudio === false) {
                  if (btnNavTextStudio) btnNavTextStudio.style.display = 'none';
              } else {
                  if (btnNavTextStudio) btnNavTextStudio.style.display = 'flex';
              }

              // Image Studio Visibility (Controlled by Screenshot/Image Studio feature toggle)
              if (cachedSettings.features.enableScreenshot === false) {
                  if (btnNavImgStudio) btnNavImgStudio.style.display = 'none';
              } else {
                  if (btnNavImgStudio) btnNavImgStudio.style.display = 'flex';
              }

              // History Visibility
              if (cachedSettings.features.enableHistory === false) {
                  if (btnNavHistory) btnNavHistory.style.display = 'none';
              } else {
                  if (btnNavHistory) btnNavHistory.style.display = 'flex';
              }
          }
      } catch(e) {
          console.warn("Failed to load settings in renderer", e);
      }
  };

  await loadSettings(); // Initial load

  if (window.browserAPI.onSettingsUpdated) {
    window.browserAPI.onSettingsUpdated((settings) => {
        loadSettings(settings);
    });
  }

  const showOverlay = (show, engine = null) => {
    if (show) {
      loadSettings(); // Refresh settings on open
      searchOverlay.classList.remove('hidden');
      overlayInput.value = '';
      
      activeSearchEngine = engine;

      // Update Icon with Fallback Logic
      if (engine) {
        const shortName = (engine.name || '??').substring(0, 2).toUpperCase();
        searchIconContainer.innerHTML = `
          <div class="search-avatar-container">
            <img src="${engine.icon || ''}" class="search-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
            <div class="search-avatar-text" style="display: none;">${shortName}</div>
          </div>
        `;
        if (!engine.icon) {
           const img = searchIconContainer.querySelector('img');
           if(img) img.onerror(); 
        }
        overlayInput.placeholder = `Search ${engine.name}...`;
      } else {
        let defaultName = 'Search or enter address';
        if (cachedSettings && cachedSettings.defaultSearchEngineId && cachedSettings.searchEngines) {
           const def = cachedSettings.searchEngines.find(e => e.id === cachedSettings.defaultSearchEngineId);
           if (def) defaultName = `Search ${def.name} or type address`;
        }

        searchIconContainer.innerHTML = DEFAULT_ICON_HTML;
        overlayInput.placeholder = defaultName;
      }
      setTimeout(() => {
        overlayInput.focus();
      }, 50);
    } else {
      searchOverlay.classList.add('hidden');
      setTimeout(() => {
        activeSearchEngine = null;
        searchIconContainer.innerHTML = DEFAULT_ICON_HTML;
      }, 300);
    }
  };

  // --- Initialize Components ---
  let aiSidebar;
  let sidePanel;
  try {
    sidePanel = new SidePanel();
  } catch (err) {
    console.error('Failed to initialize SidePanel:', err);
  }

  // --- Initialize TabManager ---
  let tabManager;
  try {
    tabManager = new TabManager(
      'tab-list-container', 
      'webview-container', 
      (url, isNewTab) => {
        const controls = document.querySelector('.window-controls');
        if (controls) {
            const isHome = url === HOME_URL || (url && url.includes('html/pages/home.html'));
            if (isHome) {
                controls.classList.remove('hidden');
            } else {
                controls.classList.add('hidden');
            }
        }
      }
    );
    tabManager.createTab();
  } catch (err) {
    console.error('Failed to initialize TabManager:', err);
  }

  try {
    aiSidebar = new AISidebar(tabManager);
  } catch (err) {
    console.error('Failed to initialize AISidebar:', err);
  }
  
  // --- Screenshot Manager ---
  const screenshotOverlay = new ScreenshotOverlay(async (dataUrl) => {
    try {
        const filename = `screenshot-${Date.now()}.png`;
        await window.browserAPI.files.saveImage(dataUrl, filename);
    } catch(e) {
        console.error("Failed to save screenshot:", e);
    }
  });

  // --- Bookmark Panel ---
  let bookmarkPanel;
  try {
    bookmarkPanel = new BookmarkPanel(tabManager);
  } catch (err) {
    console.error('Failed to initialize BookmarkPanel:', err);
  }

  // --- Sidebar Navigation Controls ---

  if (btnNavHome) {
    btnNavHome.addEventListener('click', () => {
      if (tabManager) {
        const wv = tabManager.getActiveWebview();
        if (wv) {
           const currentUrl = wv.getURL();
           // Do nothing if already on home page
           if (currentUrl === HOME_URL || currentUrl.endsWith('html/pages/home.html')) return;
           
           wv.src = HOME_URL;
        } else {
           tabManager.createTab(HOME_URL);
        }
      }
    });
  }

  const openAppTab = (appUrl) => {
      if (tabManager) {
          const existing = tabManager.tabs.find(t => t.url && t.url.includes(appUrl.split('/').pop()));
          if (existing) {
             tabManager.setActiveTab(existing.id);
          } else {
             tabManager.createTab(appUrl);
          }
      }
  };

  if (btnNavImgStudio) {
      btnNavImgStudio.addEventListener('click', () => openAppTab(IMG_EDITOR_URL));
  }
  
  if (btnNavTextStudio) {
      btnNavTextStudio.addEventListener('click', () => openAppTab(TEXT_EDITOR_URL));
  }

  if (btnNavGames) {
      btnNavGames.addEventListener('click', () => openAppTab(GAMES_URL));
  }

  if (btnNavHistory) {
    btnNavHistory.addEventListener('click', () => openAppTab(HISTORY_URL));
  }

  if (btnNavDownloads) {
    btnNavDownloads.addEventListener('click', () => openAppTab(DOWNLOADS_URL));
  }

  const openSettings = () => {
    if (tabManager) {
      const existing = tabManager.tabs.find(t => t.url && t.url.includes('system.html'));
      if (existing) {
        tabManager.setActiveTab(existing.id);
      } else {
        tabManager.createTab(SETTINGS_URL);
      }
    }
  };

  if (btnNavSettings) {
    btnNavSettings.addEventListener('click', openSettings);
  }
  
  if (btnNewTab) {
    btnNewTab.addEventListener('click', () => {
      if (tabManager) tabManager.createTab();
      showOverlay(true);
    });
  }

  // --- Window Controls ---
  const btnMin = document.getElementById('btn-min');
  const btnMax = document.getElementById('btn-max');
  const btnClose = document.getElementById('btn-close');

  if (btnMin) btnMin.addEventListener('click', () => window.browserAPI.window.minimize());
  if (btnMax) btnMax.addEventListener('click', () => window.browserAPI.window.toggleMaximize());
  if (btnClose) btnClose.addEventListener('click', () => window.browserAPI.window.close());

  // --- Command Handler ---
  const handleCommand = async (command) => {
    switch (command) {
      case 'new-tab':
        if (tabManager) tabManager.createTab();
        showOverlay(true);
        break;
      
      case 'close-tab':
        if (tabManager && tabManager.activeTabId) {
          tabManager.closeTab(tabManager.activeTabId);
        }
        break;
      
      case 'focus-search':
        showOverlay(true);
        break;
        
      case 'toggle-ai':
        if (aiSidebar) aiSidebar.toggle();
        break;
        
      case 'toggle-sidebar':
        if (sidePanel) sidePanel.toggle();
        break;
        
      case 'toggle-devtools':
        if (window.browserAPI?.window?.toggleDevTools) {
          window.browserAPI.window.toggleDevTools();
        }
        break;

      case 'toggle-system':
        openSettings();
        break;

      case 'toggle-bookmarks':
        if (bookmarkPanel) bookmarkPanel.toggle();
        break;
        
      case 'open-studio':
        openAppTab(IMG_EDITOR_URL);
        break;

      case 'open-text-studio':
        openAppTab(TEXT_EDITOR_URL);
        break;
        
      case 'go-home':
        if (tabManager) {
          const activeWebview = tabManager.getActiveWebview();
          if (activeWebview) {
             const currentUrl = activeWebview.getURL();
             // Do nothing if already on home page
             if (currentUrl === HOME_URL || currentUrl.endsWith('html/pages/home.html')) return;
             activeWebview.src = HOME_URL;
          } else {
            tabManager.createTab(HOME_URL);
          }
        }
        break;
        
      case 'reload-tab':
        if (tabManager) {
          const activeWebview = tabManager.getActiveWebview();
          if (activeWebview) activeWebview.reload();
        }
        break;

      case 'copy-current-url':
        if (tabManager) {
          const activeWebview = tabManager.getActiveWebview();
          if (activeWebview) {
             const url = activeWebview.getURL();
             if (url) {
               navigator.clipboard.writeText(url);
             }
          }
        }
        break;
      
      case 'take-screenshot':
        if (tabManager) {
          const activeWebview = tabManager.getActiveWebview();
          if (activeWebview) {
             try {
                const image = await activeWebview.capturePage(); 
                screenshotOverlay.start(image);
             } catch(e) {
                console.error("Screenshot capture failed", e);
             }
          }
        }
        break;
    }
  };

  if (window.browserAPI && window.browserAPI.onShortcut) {
    window.browserAPI.onShortcut(handleCommand);
  }
  
  if (window.browserAPI && window.browserAPI.onSearchShortcut) {
      window.browserAPI.onSearchShortcut((engine) => {
          showOverlay(true, engine);
      });
  }

  // --- Search Overlay Logic ---
  if (overlayInput && tabManager) {
    overlayInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let query = overlayInput.value.trim();
        if (query) {
          let finalUrl = '';
          
          let targetUrl = '';
          
          if (activeSearchEngine && activeSearchEngine.url) {
              targetUrl = activeSearchEngine.url;
          } else if (cachedSettings && cachedSettings.defaultSearchEngineId) {
              const engines = cachedSettings.searchEngines || [];
              const def = engines.find(eng => eng.id === cachedSettings.defaultSearchEngineId);
              if (def) {
                  targetUrl = def.url;
              } else {
                  targetUrl = 'https://www.google.com/search?q=%s';
              }
          } else {
              targetUrl = 'https://www.google.com/search?q=%s';
          }

          if (!query.startsWith('http://') && !query.startsWith('https://') && !query.startsWith('about:') && !query.startsWith('file:')) {
             if (query.includes('.') && !query.includes(' ')) {
                 finalUrl = 'https://' + query;
             } else {
                 if (targetUrl.includes('%25s')) targetUrl = targetUrl.replace(/%25s/g, '%s');
                 if (targetUrl.includes('%S')) targetUrl = targetUrl.replace(/%S/g, '%s');
                 
                 if (targetUrl.includes('%s')) {
                    finalUrl = targetUrl.replace('%s', encodeURIComponent(query));
                 } else {
                     try {
                        const urlObj = new URL(targetUrl);
                        if (urlObj.hostname.includes('wikipedia.org')) {
                            finalUrl = `${urlObj.origin}/w/index.php?search=${encodeURIComponent(query)}`;
                        } else {
                            finalUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                        }
                     } catch(e) {
                        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                    }
                 }
             }
          } else {
             finalUrl = query;
          }
          
          // IMMEDIATE FEEDBACK: Show overlay closing and trigger nav
          showOverlay(false);
          tabManager.showLoader();

          // Use navigateTo instead of direct src manipulation to handle loading states better
          tabManager.navigateTo(finalUrl);
        }
      } else if (e.key === 'Escape') {
        showOverlay(false);
      }
    });
  }

  if (searchOverlay) {
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) {
        showOverlay(false);
      }
    });
  }

  // --- Icon Picker Logic ---
  const ICON_PATHS = [
      // Row 1: General
      `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>`, // Globe
      `<path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>`, // Briefcase
      `<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>`, // Code
      `<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>`, // People
      `<path d="M8 5v14l11-7z"/>`, // Play
      
      // Row 2
      `<path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>`, // Music
      `<path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>`, // Game
      `<path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>`, // Shopping
      `<path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>`, // Book
      `<path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>`, // Mail
      
      // Row 3
      `<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>`, // Cloud
      `<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>`, // Heart
      `<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>`, // Star
      `<path d="M7 2v11h3v9l7-12h-4l4-8z"/>`, // Bolt
      `<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>`, // Shield
      
      // Row 4
      `<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>`, // Edit
      `<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>`, // Calendar
      `<path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>`, // Map
      `<path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>`, // Chat
      `<path d="M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23-1.07 1.42-3.32 3.06-4.22 6.64-1.13 4.49 1.63 7.9 3.97 9.85.99.82 2.37.52 3.12-.48 2.01-2.71.86-4.88 2.94-5.78zM12 22C6.48 22 2 17.52 2 12c0-2.82 1.18-5.36 3.08-7.18.59-.57 1.57-.31 1.76.51.27 1.17 1.25 2.15 2.37 2.15.54 0 1.04-.21 1.42-.56.91-.84 2.36-.57 2.92.54C14.77 10.1 16.51 12 16.51 12c0 2.49-2.02 4.51-4.51 4.51-2.49 0-4.51-2.02-4.51-4.51 0-1.24 1-2.25 2.25-2.25.62 0 1.12.5 1.12 1.12s-.5 1.12-1.12 1.12c-.62 0-1.13.51-1.13 1.13 0 .62.51 1.13 1.13 1.13.62 0 1.13.51 1.13 1.13 0 .62-.51 1.13-1.13 1.13-1.86 0-3.38-1.51-3.38-3.38 0-.93.38-1.78 1-2.38 1.26 1.43 3.07 2.38 5.12 2.38 3.86 0 7-3.14 7-7 0-.48-.05-.95-.14-1.41 2.5 1.83 4.14 4.77 4.14 8.08 0 5.52-4.48 10-10 10z"/>` // Fire
  ];

  const iconPickerOverlay = document.getElementById('icon-picker-overlay');
  const iconGrid = document.getElementById('icon-grid');
  const btnClosePicker = document.getElementById('btn-close-picker');
  const changeIconBtn = document.getElementById('ctx-change-icon');

  if (iconGrid) {
      // Render Icons
      ICON_PATHS.forEach(pathData => {
          const btn = document.createElement('div');
          btn.className = 'icon-option';
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">${pathData}</svg>`;
          btn.addEventListener('click', () => {
              if (contextMenuTargetId && tabManager) {
                  // Create Data URI for the SVG
                  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%237c4dff">${pathData}</svg>`;
                  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
                  
                  tabManager.updateTabIcon(contextMenuTargetId, dataUri);
                  iconPickerOverlay.classList.add('hidden');
              }
          });
          iconGrid.appendChild(btn);
      });
  }

  if (btnClosePicker) {
      btnClosePicker.addEventListener('click', () => {
          iconPickerOverlay.classList.add('hidden');
      });
  }
  
  // Close picker on outside click
  if (iconPickerOverlay) {
      iconPickerOverlay.addEventListener('click', (e) => {
          if (e.target === iconPickerOverlay) {
              iconPickerOverlay.classList.add('hidden');
          }
      });
  }

  // --- Tab Context Menu Logic ---
  const contextMenu = document.getElementById('tab-context-menu');
  const tabList = document.getElementById('tab-list-container');
  let contextMenuTargetUrl = '';
  let contextMenuTargetTitle = '';
  let contextMenuTargetId = null;
  let contextMenuTargetFavicon = '';

  const hideContextMenu = () => {
    if (contextMenu) contextMenu.classList.add('hidden');
  };

  if (tabList && contextMenu) {
    tabList.addEventListener('contextmenu', (e) => {
      const tabItem = e.target.closest('.tab-item');
      if (tabItem && tabManager) {
        e.preventDefault();
        const tabData = tabManager.tabs.find(t => t.tabItem === tabItem);
        if (tabData) {
            contextMenuTargetId = tabData.id;
            contextMenuTargetUrl = tabData.url;
            contextMenuTargetTitle = tabData.titleEl.textContent || 'New Shortcut';
            contextMenuTargetFavicon = tabData.iconEl.src;
            
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.classList.remove('hidden');
        }
      }
    });

    document.addEventListener('click', hideContextMenu);
    
    // Connect Close Tab Button
    document.getElementById('ctx-close-tab')?.addEventListener('click', () => {
       if (contextMenuTargetId) {
           tabManager.closeTab(contextMenuTargetId);
       }
    });

    // Connect Bookmark Button
    document.getElementById('ctx-bookmark-tab')?.addEventListener('click', () => {
       if (bookmarkPanel && contextMenuTargetUrl) {
           bookmarkPanel.addBookmark(contextMenuTargetUrl, contextMenuTargetTitle, contextMenuTargetFavicon);
       }
    });

    // Connect Change Icon Button
    if (changeIconBtn) {
        changeIconBtn.addEventListener('click', () => {
            if (iconPickerOverlay) {
                iconPickerOverlay.classList.remove('hidden');
            }
        });
    }
    
    document.getElementById('ctx-refresh')?.addEventListener('click', () => {
       if (contextMenuTargetId) {
           const tab = tabManager.tabs.find(t => t.id === contextMenuTargetId);
           if (tab && tab.webview) {
               tab.webview.reload();
           }
       }
    });

    document.getElementById('ctx-copy-url')?.addEventListener('click', () => {
       if (contextMenuTargetUrl) {
           navigator.clipboard.writeText(contextMenuTargetUrl);
       }
    });
    
    document.getElementById('ctx-make-shortcut')?.addEventListener('click', async () => {
       if (contextMenuTargetUrl && contextMenuTargetTitle) {
          try {
             const settings = await window.browserAPI.settings.get();
             if (!settings.searchEngines) settings.searchEngines = [];
             
             const letter = contextMenuTargetTitle.charAt(0).toUpperCase().replace(/[^A-Z]/, 'S');
             const trigger = `Ctrl+Shift+${letter}`;
             
             let icon = '';
             try {
                let domain = new URL(contextMenuTargetUrl).hostname;
                icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
             } catch(e) {}

             let finalEngineUrl = contextMenuTargetUrl;
             try {
                const urlObj = new URL(finalEngineUrl);
                const params = new URLSearchParams(urlObj.search);
                const searchKeys = ['q', 's', 'search', 'query', 'k', 'keyword'];
                let foundParam = false;
                for (const key of searchKeys) {
                    if (params.has(key)) {
                        params.set(key, '%s');
                        urlObj.search = params.toString();
                        finalEngineUrl = urlObj.toString().replace('%25s', '%s');
                        foundParam = true;
                        break;
                    }
                }
                if (!foundParam && urlObj.hostname.includes('wikipedia.org')) {
                    finalEngineUrl = `${urlObj.origin}/w/index.php?search=%s`;
                }
             } catch(e) {}

             settings.searchEngines.push({
                id: Date.now().toString(),
                name: contextMenuTargetTitle.substring(0, 15), 
                trigger: trigger,
                url: finalEngineUrl,
                icon: icon
             });
             
             await window.browserAPI.settings.save(settings);
             alert(`Shortcut created: ${trigger} for ${contextMenuTargetTitle}\n(Use this shortcut to search this site)`);
             
          } catch(e) {
             console.error(e);
          }
       }
    });
  }
});