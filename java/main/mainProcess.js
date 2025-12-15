


const { app, BrowserWindow, ipcMain, Menu, screen, dialog, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { AD_RULES, AD_ALLOWLIST } = require('./blocker/adblockRules');
const { spawn } = require('child_process');
const os = require('os');
const UpdateManager = require('./updater/UpdateManager'); // Import Updater

// --- Suppress Security Warnings ---
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// --- Memory Optimization Flags ---
app.commandLine.appendSwitch('process-per-site');
app.commandLine.appendSwitch('renderer-process-limit', '3'); // Reduced for RAM optimization
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048'); // Cap heap size
app.commandLine.appendSwitch('wm-window-animations-disabled');
app.commandLine.appendSwitch('disable-site-isolation-trials'); // Significant RAM saving for iframes

// Optional: GPU rasterization for smoothness
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Suppress Autofill noise in DevTools
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');

const isMac = process.platform === 'darwin';
const settingsPath = path.join(app.getPath('userData'), 'user-settings.json');
const historyPath = path.join(app.getPath('userData'), 'user-history.json');
const bookmarksPath = path.join(app.getPath('userData'), 'user-bookmarks.json');
const downloadsPath = path.join(app.getPath('userData'), 'user-downloads.json');

// --- Default Settings ---
const DEFAULT_SETTINGS = {
  searchEngines: [
    { 
      id: 'yt-default', 
      name: 'YouTube', 
      trigger: 'Ctrl+Y', 
      url: 'https://www.youtube.com/results?search_query=%s',
      icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64'
    }
  ],
  openDevToolsOnStart: false,
  features: { 
    enableScreenshot: true,
    enableTextStudio: true,
    enableHistory: true, // Default ON
    enableAdBlocker: true 
  },
  shortcuts: { 
    'take-screenshot': 'Ctrl+Shift+S',
    'open-studio': 'Ctrl+Shift+E',
    'open-text-studio': 'Ctrl+Shift+X',
    'toggle-bookmarks': 'Ctrl+Shift+B',
    'new-tab': 'Ctrl+T',
    'close-tab': 'Ctrl+W',
    'toggle-sidebar': 'Ctrl+[',
    'toggle-ai': 'Ctrl+Space',
    'toggle-system': 'Alt+S',
    'toggle-devtools': 'Ctrl+B'
  }
};

// Keep global references to prevent garbage collection
let mainWindow = null;
let updateManager = null; // Update Manager Ref
let dragInterval = null;
let cachedSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
// Active downloads memory cache
let activeDownloads = {}; 

// Load settings initially
try {
  if (fs.existsSync(settingsPath)) {
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    cachedSettings = { ...DEFAULT_SETTINGS, ...saved };
    // Ensure nested defaults
    if (!cachedSettings.searchEngines) cachedSettings.searchEngines = DEFAULT_SETTINGS.searchEngines;
    if (!cachedSettings.features) cachedSettings.features = { ...DEFAULT_SETTINGS.features, ...cachedSettings.features };
    if (!cachedSettings.shortcuts) cachedSettings.shortcuts = DEFAULT_SETTINGS.shortcuts;
  }
} catch (e) { 
  console.error('Error loading initial settings:', e); 
}

// Remove the default Electron menu
Menu.setApplicationMenu(null);

// --- Ad Blocker Logic ---
function configureAdBlocker(enable) {
  const ses = session.defaultSession;
  if (!ses) return;

  if (enable) {
    console.log('[AdBlock] Enabled. Rules:', AD_RULES.length);
    ses.webRequest.onBeforeRequest(
      { urls: AD_RULES },
      (details, callback) => {
        // Check allowlist (prevent breakage on specific sites)
        // CRITICAL FIX: details.initiator can be null/undefined for browser-initiated requests
        if (details.initiator && AD_ALLOWLIST.some(domain => details.initiator.includes(domain))) {
             // console.log('[AdBlock] Allowed (Allowlist):', details.url);
             return callback({ cancel: false });
        }
        
        // Block
        // console.log('[AdBlock] Blocked:', details.url);
        callback({ cancel: true });
      }
    );
  } else {
    console.log('[AdBlock] Disabled.');
    // Passing null unregisters the listener
    ses.webRequest.onBeforeRequest({ urls: AD_RULES }, null);
  }
}

// --- Global Shortcut Handler ---
function registerGlobalShortcuts(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    
    // Normalize Key
    const key = input.key.toLowerCase();
    const url = contents.getURL() || '';
    const isSystemPage = url.includes('system.html');

    // Helper to check shortcuts from config
    const checkShortcut = (trigger) => {
       if (!trigger) return false;
       const parts = trigger.toLowerCase().split('+');
       let triggerKey = parts[parts.length - 1];
       
       // Handle Special Keys mapping from UI string to Electron key
       if (triggerKey === 'space') triggerKey = ' ';
       
       const wantsCtrl = parts.includes('ctrl');
       const wantsAlt = parts.includes('alt');
       const wantsShift = parts.includes('shift');
       
       // On Mac, "Ctrl" in the UI configuration maps to Meta (Command)
       const isCtrlPressed = isMac ? input.meta : input.control;
       
       if (wantsCtrl && !isCtrlPressed) return false;
       if (!wantsCtrl && isCtrlPressed) return false;
       
       if (wantsAlt !== input.alt) return false;
       if (wantsShift !== input.shift) return false;
       
       return key === triggerKey; 
    };

    const shortcuts = cachedSettings.shortcuts || DEFAULT_SETTINGS.shortcuts;

    // 1. Search Engine Shortcuts
    if (!isSystemPage && cachedSettings.searchEngines && cachedSettings.searchEngines.length > 0) {
       const shortcut = cachedSettings.searchEngines.find(eng => checkShortcut(eng.trigger));
       if (shortcut) {
           event.preventDefault();
           if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.webContents.send('browser-search-shortcut', shortcut);
           }
           return;
       }
    }
    
    // 2. Feature Shortcuts
    if (!isSystemPage) {
       if (cachedSettings.features?.enableScreenshot && checkShortcut(shortcuts['take-screenshot'])) {
          event.preventDefault();
          if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.webContents.send('app-shortcut', 'take-screenshot');
          }
          return;
       }
       
       if (checkShortcut(shortcuts['open-studio'])) {
          event.preventDefault();
          if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.webContents.send('app-shortcut', 'open-studio');
          }
          return;
       }

       if (cachedSettings.features?.enableTextStudio && checkShortcut(shortcuts['open-text-studio'])) {
          event.preventDefault();
          if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.webContents.send('app-shortcut', 'open-text-studio');
          }
          return;
       }
       
       if (checkShortcut(shortcuts['toggle-bookmarks'])) {
          event.preventDefault();
          if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.webContents.send('app-shortcut', 'toggle-bookmarks');
          }
          return;
       }
    }

    // 3. General Browser Shortcuts
    if (mainWindow && !mainWindow.isDestroyed()) {
        const actions = {
            'new-tab': 'new-tab',
            'close-tab': 'close-tab',
            'toggle-sidebar': 'toggle-sidebar',
            'toggle-ai': 'toggle-ai',
            'toggle-system': 'toggle-system',
            'toggle-devtools': 'toggle-devtools'
        };

        for (const [actionKey, command] of Object.entries(actions)) {
            // Check if the input matches the configured shortcut for this action
            if (checkShortcut(shortcuts[actionKey])) {
                event.preventDefault();
                mainWindow.webContents.send('app-shortcut', command);
                return;
            }
        }

        // Hardcoded fallback for Copy URL (Ctrl+LeftArrow)
        const isCtrl = isMac ? input.meta : input.control;
        if (isCtrl && key === 'arrowleft') {
            event.preventDefault();
            mainWindow.webContents.send('app-shortcut', 'copy-current-url');
            return;
        }

        // Hardcoded fallback for Go Home (Alt+H)
        if (input.alt && key === 'h') {
             event.preventDefault();
             mainWindow.webContents.send('app-shortcut', 'go-home');
             return;
        }
    }
  });
}

// --- Terminal Process Management ---
let ptyProcess = null;

ipcMain.on('terminal-init', (event, cwd) => {
  if (ptyProcess && !ptyProcess.killed) {
      try { ptyProcess.kill(); } catch(e){}
  }

  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  // Use provided CWD or fallback to home
  const workingDirectory = (cwd && fs.existsSync(cwd)) ? cwd : os.homedir();

  try {
      ptyProcess = spawn(shell, [], {
        cwd: workingDirectory,
        env: process.env,
        shell: true
      });

      ptyProcess.stdout.on('data', (data) => {
        if (!event.sender.isDestroyed()) {
            event.sender.send('terminal-incoming', data.toString());
        }
      });

      ptyProcess.stderr.on('data', (data) => {
        if (!event.sender.isDestroyed()) {
            event.sender.send('terminal-incoming', data.toString());
        }
      });

      ptyProcess.on('exit', (code) => {
        if (!event.sender.isDestroyed()) {
            event.sender.send('terminal-incoming', `\r\n[Process exited with code ${code}]`);
        }
      });
      
      event.sender.send('terminal-incoming', `Welcome to Om-X Terminal (${shell})\r\nDirectory: ${workingDirectory}\r\n`);
      
  } catch(e) {
      event.sender.send('terminal-incoming', `Failed to start shell: ${e.message}\r\n`);
  }
});

ipcMain.on('terminal-input', (event, data) => {
  if (ptyProcess && !ptyProcess.killed) {
    try {
        ptyProcess.stdin.write(data);
    } catch(e) {
        console.error("Terminal write error", e);
    }
  }
});

// --- Download Persistence Helpers ---
function getStoredDownloads() {
    try {
        if (fs.existsSync(downloadsPath)) {
            return JSON.parse(fs.readFileSync(downloadsPath, 'utf8'));
        }
    } catch(e) { console.error(e); }
    return [];
}

function saveStoredDownloads(list) {
    try {
        // Keep last 100 items
        if(list.length > 100) list = list.slice(0, 100);
        fs.writeFileSync(downloadsPath, JSON.stringify(list, null, 2));
    } catch(e) { console.error(e); }
}

function updateDownloadItem(data) {
    let list = getStoredDownloads();
    const idx = list.findIndex(i => i.id === data.id);
    if(idx !== -1) {
        list[idx] = { ...list[idx], ...data };
    } else {
        list.unshift(data);
    }
    saveStoredDownloads(list);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    transparent: false, 
    frame: false, // Frameless for custom look
    titleBarStyle: 'hidden', 
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../assets/icons/app.ico'),
    backgroundColor: '#19191e', 
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload.js'),
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false, 
      backgroundThrottling: true, 
      webSecurity: false 
    }
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(__dirname, '../../html/windows/main.html'));

  // Initialize Updater
  updateManager = new UpdateManager(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    const shouldOpenDevTools = cachedSettings.openDevToolsOnStart === true;
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // --- Download Handler ---
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
      const id = Date.now().toString() + Math.random().toString().slice(2,5);
      const filename = item.getFilename();
      const startTime = Date.now();
      
      const downloadData = {
          id,
          filename,
          path: '', // Set when done or updated
          totalBytes: item.getTotalBytes(),
          receivedBytes: 0,
          state: 'progressing', // progressing, completed, cancelled, interrupted
          startTime,
          url: item.getURL()
      };

      activeDownloads[id] = downloadData;
      
      // Initial Broadcast
      mainWindow.webContents.send('download-update', downloadData);
      
      item.on('updated', (event, state) => {
          if (state === 'interrupted') {
              downloadData.state = 'interrupted';
          } else if (state === 'progressing') {
              if (item.isPaused()) {
                  downloadData.state = 'paused';
              } else {
                  downloadData.state = 'progressing';
              }
          }
          downloadData.receivedBytes = item.getReceivedBytes();
          downloadData.path = item.getSavePath();
          
          activeDownloads[id] = downloadData;
          mainWindow.webContents.send('download-update', downloadData);
      });

      item.on('done', (event, state) => {
          downloadData.state = state; // completed, cancelled, interrupted
          downloadData.path = item.getSavePath();
          downloadData.receivedBytes = item.getReceivedBytes();
          
          delete activeDownloads[id];
          updateDownloadItem(downloadData); // Save to disk
          mainWindow.webContents.send('download-update', downloadData);
      });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

// --- IPC Handlers ---

ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.on('window-toggle-devtools', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.webContents.toggleDevTools({ mode: 'detach' });
});

ipcMain.on('editor-load-image', (event, dataUrl) => {
  event.sender.send('editor-load-image', dataUrl);
});

ipcMain.handle('settings-get', () => {
  return cachedSettings;
});

ipcMain.handle('settings-save', (event, settings) => {
  try {
    cachedSettings = settings; 
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // Update Ad Blocker State
    configureAdBlocker(settings.features?.enableAdBlocker !== false);

    // Notify renderer of changes so it can update UI immediately
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('settings-updated', settings);
    }

    return true;
  } catch (e) { 
    console.error('Error saving settings:', e);
    return false; 
  }
});

// --- History Handlers ---
ipcMain.handle('history-get', async () => {
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }
    return [];
  } catch (e) {
    console.error('Error reading history', e);
    return [];
  }
});

ipcMain.handle('history-push', async (event, item) => {
  try {
    // Check if History is enabled before pushing
    if (cachedSettings.features && cachedSettings.features.enableHistory === false) {
       return true; // silently ignore
    }

    let history = [];
    if (fs.existsSync(historyPath)) {
       try {
         history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
       } catch(e) { history = []; }
    }
    
    // Simple logic: Add to top, remove duplicates of exact URL if recent
    history = history.filter(h => h.url !== item.url); 
    history.unshift(item);
    
    // Limit to 500 entries
    if (history.length > 500) history = history.slice(0, 500);
    
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving history', e);
    return false;
  }
});

ipcMain.handle('history-delete', async (event, timestamp) => {
  try {
     if (fs.existsSync(historyPath)) {
        let history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        history = history.filter(h => h.timestamp !== timestamp);
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        return history;
     }
     return [];
  } catch(e) { return []; }
});

ipcMain.handle('history-clear', async () => {
    try {
        fs.writeFileSync(historyPath, JSON.stringify([], null, 2));
        return true;
    } catch(e) { return false; }
});

// --- Bookmarks Handlers ---
ipcMain.handle('bookmarks-get', async () => {
  try {
    if (fs.existsSync(bookmarksPath)) {
      return JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
    }
    return [];
  } catch (e) {
    console.error('Error reading bookmarks', e);
    return [];
  }
});

ipcMain.handle('bookmarks-add', async (event, bookmark) => {
  try {
    let bookmarks = [];
    if (fs.existsSync(bookmarksPath)) {
       try {
         bookmarks = JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
       } catch(e) { bookmarks = []; }
    }
    
    // Add new bookmark
    bookmarks.push({ ...bookmark, id: Date.now().toString(), timestamp: Date.now() });
    
    fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarks, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving bookmark', e);
    return false;
  }
});

ipcMain.handle('bookmarks-delete', async (event, id) => {
  try {
    if (fs.existsSync(bookmarksPath)) {
       let bookmarks = JSON.parse(fs.readFileSync(bookmarksPath, 'utf8'));
       bookmarks = bookmarks.filter(b => b.id !== id);
       fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarks, null, 2));
       return bookmarks;
    }
    return [];
  } catch(e) { return []; }
});

// --- Download Handlers ---
ipcMain.handle('downloads-get', async () => {
    // Combine active active in memory with stored history
    const stored = getStoredDownloads();
    // Prepend active ones that might not be in file yet
    const activeList = Object.values(activeDownloads);
    
    // Merge: active ones override stored ones if IDs collide (they shouldn't usually)
    const combined = [...activeList, ...stored];
    // De-dupe by ID
    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
    
    return unique.sort((a,b) => b.startTime - a.startTime);
});

ipcMain.handle('downloads-open-file', async (event, id) => {
    let list = await ipcMain.handlers['downloads-get']();
    const item = list.find(i => i.id === id);
    if(item && item.path) {
        shell.openPath(item.path);
    }
});

ipcMain.handle('downloads-show-in-folder', async (event, id) => {
    let list = await ipcMain.handlers['downloads-get']();
    const item = list.find(i => i.id === id);
    if(item && item.path) {
        shell.showItemInFolder(item.path);
    }
});

ipcMain.handle('downloads-clear', async () => {
    saveStoredDownloads([]);
    return true;
});

// --- File System Operations for Text Editor ---
ipcMain.handle('fs-read-dir', async (event, dirPath) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    // Sort: Folders first, then files
    return items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: path.join(dirPath, item.name)
    })).sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
  } catch (e) {
    console.error('Error reading dir', e);
    return [];
  }
});

ipcMain.handle('fs-create-file', async (event, { path: filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content || '', 'utf8');
    return true;
  } catch (e) {
    console.error('Error creating file', e);
    return false;
  }
});

ipcMain.handle('fs-create-folder', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
       fs.mkdirSync(dirPath, { recursive: true });
       return true;
    }
    return false;
  } catch (e) {
    console.error('Error creating folder', e);
    return false;
  }
});

ipcMain.handle('fs-delete-path', async (event, targetPath) => {
  try {
    if (fs.existsSync(targetPath)) {
       const stat = fs.statSync(targetPath);
       if (stat.isDirectory()) {
          fs.rmSync(targetPath, { recursive: true, force: true });
       } else {
          fs.unlinkSync(targetPath);
       }
       return true;
    }
    return false;
  } catch (e) {
    console.error('Error deleting path', e);
    return false;
  }
});

ipcMain.handle('fs-rename-path', async (event, { oldPath, newPath }) => {
  try {
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        return true;
    }
    return false;
  } catch (e) {
    console.error('Error renaming path', e);
    return false;
  }
});


ipcMain.handle('dialog-open-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  if (filePaths && filePaths.length > 0) {
    return filePaths[0];
  }
  return null;
});

// --- Dialog Handlers ---

ipcMain.handle('dialog-save-image', async (event, { dataUrl, defaultName }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { filePath } = await dialog.showSaveDialog(win, {
        defaultPath: defaultName || 'screenshot.png',
        filters: [{ name: 'Images', extensions: ['png', 'jpg'] }]
    });

    if (filePath) {
        try {
            const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(filePath, base64Data, 'base64');
            return true;
        } catch (e) {
            console.error('Failed to save file', e);
            return false;
        }
    }
    return false;
});

ipcMain.handle('dialog-save-text', async (event, { content, defaultName }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultName || 'untitled.txt',
      filters: [
          { name: 'Source Files', extensions: ['js', 'html', 'css', 'json', 'ts', 'py', 'java', 'c', 'cpp', 'xml', 'yaml', 'md', 'txt'] },
          { name: 'All Files', extensions: ['*'] }
      ]
  });

  if (filePath) {
      try {
          fs.writeFileSync(filePath, content, 'utf8');
          // Return the actual file path so renderer can update the UI
          return { success: true, filePath };
      } catch (e) {
          console.error('Failed to save text file', e);
          return { success: false, error: e.message };
      }
  }
  return { success: false, canceled: true };
});

ipcMain.handle('dialog-open-image', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    
    if (filePaths && filePaths.length > 0) {
        try {
            const file = fs.readFileSync(filePaths[0]);
            const ext = path.extname(filePaths[0]).slice(1);
            return `data:image/${ext};base64,${file.toString('base64')}`;
        } catch (e) {
            console.error('Failed to open file', e);
            return null;
        }
    }
    return null;
});

ipcMain.handle('dialog-open-text', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
            { name: 'Code & Text', extensions: ['js', 'html', 'css', 'json', 'ts', 'py', 'java', 'c', 'cpp', 'xml', 'yaml', 'md', 'txt'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (filePaths && filePaths.length > 0) {
        try {
            const content = fs.readFileSync(filePaths[0], 'utf8');
            return { success: true, content, filePath: filePaths[0] };
        } catch (e) {
            console.error('Failed to open file', e);
            return { success: false, error: e.message };
        }
    }
    return { success: false, canceled: true };
});

// --- Window Dragging Logic ---
ipcMain.on('window-drag-start', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const cursorStart = screen.getCursorScreenPoint();
  const winBounds = win.getBounds();
  const offset = {
    x: cursorStart.x - winBounds.x,
    y: cursorStart.y - winBounds.y
  };

  if (dragInterval) clearInterval(dragInterval);

  dragInterval = setInterval(() => {
    try {
      if (win.isDestroyed()) {
        clearInterval(dragInterval);
        return;
      }
      const cursor = screen.getCursorScreenPoint();
      win.setBounds({
        x: cursor.x - offset.x,
        y: cursor.y - offset.y,
        width: winBounds.width,
        height: winBounds.height
      });
    } catch (e) {
      clearInterval(dragInterval);
    }
  }, 16); 
});

ipcMain.on('window-drag-end', () => {
  if (dragInterval) {
    clearInterval(dragInterval);
    dragInterval = null;
  }
});

app.whenReady().then(() => {
  // Init Ad Blocker state based on cached settings
  configureAdBlocker(cachedSettings.features?.enableAdBlocker !== false);

  app.on('web-contents-created', (e, contents) => {
    registerGlobalShortcuts(contents);
  });

  createMainWindow();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  // Cleanup terminal process
  if (ptyProcess && !ptyProcess.killed) {
      try { ptyProcess.kill(); } catch(e){}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
