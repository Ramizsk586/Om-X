import { TabManager } from './ui/tabs.js';
import { SidePanel } from './ui/sidePanel.js';
import { ScreenshotOverlay } from './ui/screenshotOverlay.js';
import { BookmarkPanel } from './ui/bookmarkPanel.js';
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

  const downloadToast = document.getElementById('download-toast');
  const dlFilename = downloadToast?.querySelector('.dl-toast-filename');
  const dlStatus = downloadToast?.querySelector('.dl-toast-status');
  const dlFill = downloadToast?.querySelector('.dl-toast-fill');
  
  const HOME_URL = new URL('../../html/pages/home.html', import.meta.url).href;
  const SETTINGS_URL = new URL('../../html/windows/system.html', import.meta.url).href;
  const HISTORY_URL = new URL('../../html/pages/history.html', import.meta.url).href;
  const DOWNLOADS_URL = new URL('../../html/pages/downloads.html', import.meta.url).href;
  const AI_CHAT_URL = new URL('../../html/pages/omni-chat.html', import.meta.url).href;
  const NEURAL_HUB_URL = new URL('../../html/windows/neural-hub.html', import.meta.url).href;
  const TODO_STATION_URL = new URL('../../html/pages/todo.html', import.meta.url).href;
  const GAMES_URL = new URL('../../html/pages/games.html', import.meta.url).href;
  
  let cachedSettings = null;
  let currentTabContextId = null;
  let currentImageToDownload = null;
  let toastTimeout = null;

  const webviewContextMenu = document.getElementById('webview-context-menu');
  const tabContextMenu = document.getElementById('tab-context-menu');

  const closeAllContextMenus = () => { 
      webviewContextMenu?.classList.add('hidden'); 
      tabContextMenu?.classList.add('hidden'); 
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

      const add = (label, icon, click) => {
          const item = document.createElement('div');
          item.className = 'context-menu-item';
          item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="${icon}" fill="currentColor"/></svg><span>${label}</span>`;
          item.onclick = () => { click(); webviewContextMenu.classList.add('hidden'); };
          webviewContextMenu.appendChild(item);
      };

      if (params.selectionText) {
          add('Attach to Omni AI', 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z', () => attachToAIChat(params.selectionText));
          add('Read Selection', 'M12 14c1.66 0 3-1.34 3-3V5c0-1.1-.9-2-2-2s-2 .9-2 2v6c0 1.1.9 2 2 2z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z', () => window.speechManager.speak(params.selectionText));
          add('Improve with Writer', 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', () => writerUI.show(params.selectionText, params.selectionX || params.x, params.selectionY || params.y));
          add('Translate Selection', 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2H1v2H11.17c-.71 2.06-1.75 4.05-3.04 5.81-1.01-1.12-1.87-2.34-2.57-3.64H4.5c.81 1.63 1.83 3.17 3.03 4.58L3.06 18.06l1.41 1.41 4.7-4.7 3.13 3.13 1.98-1.83z', () => translatorUI.show(params.selectionText, params.selectionX || params.x, params.selectionY || params.y));
          
          add('Google Translate', 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2H11.17c-.71 2.06-1.75 4.05-3.04 5.81-1.01-1.12-1.87-2.34-2.57-3.64H4.5c.81 1.63 1.83 3.17 3.03 4.58L3.06 18.06l1.41 1.41 4.7-4.7 3.13 3.13 1.98-1.83z', () => {
              const encodedText = encodeURIComponent(params.selectionText);
              const translateUrl = `https://translate.google.co.in/?sl=auto&tl=bn&text=${encodedText}&op=translate`;
              tabManager.createTab(translateUrl);
          });

          const defEngine = cachedSettings?.searchEngines?.find(e => e.id === (cachedSettings.defaultSearchEngineId || 'google'));
          if (defEngine) {
              add(`Search ${defEngine.name}`, 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z', () => {
                  const searchUrl = defEngine.url.replace('%s', encodeURIComponent(params.selectionText));
                  tabManager.createTab(searchUrl);
              });
          }
          // Improved Copy Logic with explicit focus to ensure standard clipboard operations work in the webview context
          add('Copy', 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z', () => {
              if (activeWebview) {
                  activeWebview.focus();
                  activeWebview.copy();
              }
          });
          webviewContextMenu.appendChild(document.createElement('div')).style.cssText = "height:1px; background:rgba(255,255,255,0.1); margin:2px 0;";
      } else {
          add('Back', 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z', () => activeWebview?.goBack());
          add('Reload', 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z', () => activeWebview?.reload());
      }

      if (params.isEditable) {
          add('Paste', 'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z', () => activeWebview?.paste());
      }

      if (params.linkURL) {
          add('Open Link in New Tab', 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z', () => tabManager.createTab(params.linkURL));
      }
      
      if (params.hasImageContents || params.srcURL) {
          add('Download Image...', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z', () => openImageDownloadOptions(params.srcURL));
          add('Open Image in New Tab', 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z', () => tabManager.createTab(params.srcURL));
      }

      webviewContextMenu.appendChild(document.createElement('div')).style.cssText = "height:1px; background:rgba(255,255,255,0.1); margin:4px 0;";
      add('Inspect Element', 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z', () => {
          if (activeWebview) {
              activeWebview.inspectElement(params.x, params.y);
          }
      });

      webviewContextMenu.style.left = `${params.x}px`;
      webviewContextMenu.style.top = `${params.y}px`;
      webviewContextMenu.classList.remove('hidden');
  };

  const handleTabContextMenu = async (id, x, y) => {
      closeAllContextMenus();
      currentTabContextId = id;
      if (!tabContextMenu) return;
      
      tabContextMenu.style.left = `${x}px`;
      tabContextMenu.style.top = `${y}px`;
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
      }
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

  const applyTheme = (theme) => {
    document.body.className = `theme-${theme || 'dark'}`;
  };

  const openAppTab = (url) => {
      const existing = tabManager.tabs.find(t => t.url === url);
      if (existing) tabManager.setActiveTab(existing.id); else tabManager.createTab(url);
      if (featuresHomePopup) featuresHomePopup.classList.add('hidden');
  };

  const loadSettings = async (injectedSettings = null) => {
      try {
          cachedSettings = injectedSettings || await window.browserAPI.settings.get();
          if (cachedSettings) {
              applyTheme(cachedSettings.theme);
              const { features } = cachedSettings;
              if (features) {
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
              }
          }
      } catch(e) { console.warn("Settings failed in renderer", e); }
  };

  await loadSettings(); 

  if (window.browserAPI.onSettingsUpdated) {
    window.browserAPI.onSettingsUpdated((settings) => loadSettings(settings));
  }

  if (window.browserAPI.downloads && window.browserAPI.downloads.onUpdate) {
      window.browserAPI.downloads.onUpdate((item) => {
          if (!downloadToast) return;
          downloadToast.classList.remove('hidden');
          if (dlFilename) dlFilename.textContent = item.filename;
          if (item.state === 'progressing') {
              const percent = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0;
              if (dlStatus) dlStatus.textContent = `${percent}% - Downloading...`;
              if (dlFill) dlFill.style.width = `${percent}%`;
          } else if (item.state === 'completed') {
              if (dlStatus) dlStatus.textContent = 'Download Complete';
              if (dlFill) dlFill.style.width = '100%';
              if (toastTimeout) clearTimeout(toastTimeout);
              toastTimeout = setTimeout(() => downloadToast.classList.add('hidden'), 3000);
          } else if (item.state === 'interrupted' || item.state === 'cancelled') {
              if (dlStatus) dlStatus.textContent = 'Download Cancelled/Failed';
              if (dlFill) dlFill.style.width = '100%';
              if (toastTimeout) clearTimeout(toastTimeout);
              toastTimeout = setTimeout(() => downloadToast.classList.add('hidden'), 3000);
          }
      });
  }

  if (downloadToast) {
      downloadToast.onclick = () => {
          openAppTab(DOWNLOADS_URL);
          downloadToast.classList.add('hidden');
      };
  }

  const sidePanel = new SidePanel();
  const tabManager = new TabManager('tab-list-container', 'webview-container', (url) => {
      const controls = document.querySelector('.window-controls');
      const isHome = url === HOME_URL || url?.includes('pages/home.html');
      controls?.classList.toggle('hidden', !isHome);
  }, handleWebviewContextMenu, handleTabContextMenu);
  tabManager.createTab();

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
          else if (command === 'close-tab') { if (tabManager.activeTabId) tabManager.closeTab(tabManager.activeTabId); } 
          else if (command === 'toggle-sidebar') { sidePanel.toggle(); } 
          else if (command === 'toggle-ai') { openAppTab(AI_CHAT_URL); } 
          else if (command === 'toggle-system') { openAppTab(SETTINGS_URL); } 
          else if (command === 'take-screenshot') {
              const webview = tabManager.getActiveWebview();
              if (webview) webview.capturePage().then(img => screenshotOverlay.start(img));
          }
          else if (command === 'toggle-bookmarks') { bookmarkPanel.toggle(); }
      });
  }

  if (window.browserAPI.onOpenFile) {
    window.browserAPI.onOpenFile((filePath) => {
        if (tabManager.activeTabId) {
            tabManager.navigateTo(filePath);
        } else {
            tabManager.createTab(filePath);
        }
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
  document.getElementById('btn-nav-downloads').onclick = () => openAppTab(DOWNLOADS_URL);
  document.getElementById('btn-nav-ai-chat').onclick = () => openAppTab(AI_CHAT_URL);
  document.getElementById('tile-ai-chat').onclick = () => openAppTab(AI_CHAT_URL);
  document.getElementById('tile-todo-station').onclick = () => openAppTab(TODO_STATION_URL);
  document.getElementById('tile-games').onclick = () => openAppTab(GAMES_URL);
  document.getElementById('tile-neural-hub').onclick = () => openAppTab(NEURAL_HUB_URL);
  
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
    { name: 'Planet', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' },
    { name: 'Fire', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-5.52-4.5-13.33-4.5-13.33zM14.5 14c0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5z"/></svg>' },
    { name: 'Star', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' }
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

  window.addEventListener('mousedown', (e) => { 
      if (!webviewContextMenu?.contains(e.target) && !tabContextMenu?.contains(e.target)) closeAllContextMenus(); 
  });
  window.closeAllContextMenus = closeAllContextMenus;

  const bookmarkPanel = new BookmarkPanel(tabManager);
  const translatorUI = new TranslatorUI(tabManager);
  const writerUI = new WriterUI(tabManager);
  const screenshotOverlay = new ScreenshotOverlay(async (url) => window.browserAPI.downloads.start(url, { saveAs: true }));
});