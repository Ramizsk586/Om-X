
const { app, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

// Robust import: If electron-updater is missing (npm install not run), mock it so app starts.
let autoUpdater;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (e) {
  console.warn('[UpdateManager] "electron-updater" module not found. Update features disabled. Please run "npm install".');
  
  // Mock implementation to prevent crash
  class MockAutoUpdater extends EventEmitter {
    constructor() {
      super();
      this.autoDownload = false;
      this.allowDowngrade = false;
    }
    checkForUpdates() { 
      console.log('[MockUpdater] Check for updates triggered (Simulated)'); 
      return Promise.resolve(null); 
    }
    downloadUpdate() { 
      console.log('[MockUpdater] Download update triggered (Simulated)');
      return Promise.resolve([]); 
    }
    quitAndInstall() { 
      console.log('[MockUpdater] Quit and install triggered (Simulated)'); 
    }
  }
  autoUpdater = new MockAutoUpdater();
}

class UpdateManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.historyPath = path.join(app.getPath('userData'), 'version-history.json');
    this.cacheDir = path.join(app.getPath('userData'), 'installer-cache');
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.configureUpdater();
    this.registerIPC();
    
    // Log current version on startup
    this.recordVersion(app.getVersion());
  }

  configureUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.allowDowngrade = true;

    autoUpdater.on('checking-for-update', () => {
      this.sendToUI('update-status', { status: 'checking', msg: 'Checking for updates...' });
    });

    autoUpdater.on('update-available', (info) => {
      this.sendToUI('update-status', { status: 'available', info });
    });

    autoUpdater.on('update-not-available', () => {
      this.sendToUI('update-status', { status: 'uptodate', msg: 'You are on the latest version.' });
    });

    autoUpdater.on('error', (err) => {
      this.sendToUI('update-status', { status: 'error', msg: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.sendToUI('update-status', { 
        status: 'downloading', 
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    });

    autoUpdater.on('update-downloaded', async (info) => {
      // 1. Cache the installer for future rollback
      await this.cacheInstaller(info);
      
      this.sendToUI('update-status', { status: 'downloaded', info });
    });
  }

  // --- Version History Management ---

  getHistory() {
    try {
      if (fs.existsSync(this.historyPath)) {
        let history = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
        // Mark current version
        const currentVer = app.getVersion();
        return history.map(v => ({
          ...v,
          isCurrent: v.version === currentVer,
          installerExists: fs.existsSync(v.installerPath || '')
        })).sort((a, b) => b.installDate - a.installDate); // Newest first
      }
    } catch (e) { console.error(e); }
    return [];
  }

  recordVersion(version) {
    let history = this.getHistory();
    // If this version isn't in history (or we need to update timestamp), add it
    const existing = history.find(h => h.version === version);
    if (!existing) {
      history.unshift({
        version: version,
        installDate: Date.now(),
        installerPath: null // Will be updated if we downloaded it via app
      });
      this.saveHistory(history);
    }
  }

  async cacheInstaller(info) {
    // electron-updater stores downloaded file in a temp cache.
    // We need to find it and copy it to our persistent cache.
    const downloadedFile = info.downloadedFile; 
    if (downloadedFile && fs.existsSync(downloadedFile)) {
      const fileName = `Om-X-Setup-${info.version}.exe`; // Or AppImage/dmg based on platform
      const targetPath = path.join(this.cacheDir, fileName);
      
      try {
        fs.copyFileSync(downloadedFile, targetPath);
        
        // Update history with installer path
        let history = this.getHistory();
        // Add entry if not exists (likely not for the *incoming* version)
        const existingIdx = history.findIndex(h => h.version === info.version);
        if (existingIdx > -1) {
          history[existingIdx].installerPath = targetPath;
        } else {
          history.unshift({
            version: info.version,
            installDate: Date.now(),
            installerPath: targetPath
          });
        }
        this.saveHistory(history);
        console.log(`[Updater] Cached installer to ${targetPath}`);
      } catch (e) {
        console.error('Failed to cache installer', e);
      }
    }
  }

  saveHistory(history) {
    fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2));
  }

  // --- IPC Handlers ---

  registerIPC() {
    ipcMain.handle('updater-check', () => autoUpdater.checkForUpdates());
    
    ipcMain.handle('updater-download', () => autoUpdater.downloadUpdate());
    
    ipcMain.handle('updater-install', () => autoUpdater.quitAndInstall(false, true));

    ipcMain.handle('updater-get-history', () => this.getHistory());

    ipcMain.handle('updater-rollback', async (event, version) => {
      const history = this.getHistory();
      const target = history.find(h => h.version === version);
      
      if (target && target.installerPath && fs.existsSync(target.installerPath)) {
        // Launch the cached installer
        // We use shell.openPath to run the .exe
        // The installer will detect the existing installation and "Update" (Downgrade) it.
        await shell.openPath(target.installerPath);
        setTimeout(() => app.quit(), 1000); // Quit so installer can write
        return { success: true };
      }
      return { success: false, msg: 'Installer not found in cache.' };
    });
  }

  sendToUI(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

module.exports = UpdateManager;
