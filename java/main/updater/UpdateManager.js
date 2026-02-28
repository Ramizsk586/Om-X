
const { app, ipcMain, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

let autoUpdater;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (e) {
  console.warn('[UpdateManager] electron-updater module not found.');
  class MockAutoUpdater extends EventEmitter {
    constructor() { super(); this.autoDownload = false; this.allowDowngrade = false; }
    checkForUpdates() { return Promise.resolve(null); }
    downloadUpdate() { return Promise.resolve([]); }
    quitAndInstall() { }
  }
  autoUpdater = new MockAutoUpdater();
}

class UpdateManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.cacheDir = path.join(app.getPath('userData'), 'installer-cache');
    this.repoUrl = 'https://api.github.com/repos/Ramizsk586/Om-X/releases';
    
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.configureUpdater();
    this.registerIPC();
    this.cleanupOldInstallers();
  }

  async cleanupOldInstallers() {
      try {
          const files = await fs.promises.readdir(this.cacheDir);
          const now = Date.now();
          const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

          for (const file of files) {
              const fullPath = path.join(this.cacheDir, file);
              const stats = await fs.promises.stat(fullPath);
              if (now - stats.mtimeMs > MAX_AGE) {
                  await fs.promises.unlink(fullPath);
                  console.log(`[UpdateManager] Purged old installer: ${file}`);
              }
          }
      } catch (e) {
          console.error('[UpdateManager] Cleanup error:', e);
      }
  }

  configureUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.allowDowngrade = true;

    autoUpdater.on('checking-for-update', () => {
      this.sendToUI('update-status', { status: 'checking', msg: 'Syncing with GitHub...' });
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

    autoUpdater.on('update-downloaded', (info) => {
      this.sendToUI('update-status', { status: 'downloaded', info });
    });
  }

  async getHistory() {
    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: this.repoUrl,
        headers: { 'User-Agent': 'Om-X-Browser-Updater' }
      });

      request.on('response', (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          try {
            const releases = JSON.parse(body);
            const currentVer = app.getVersion();
            
            const history = releases.map(rel => {
              const version = rel.tag_name.replace('v', '');
              const asset = rel.assets.find(a => a.name.endsWith('.exe') || a.name.endsWith('.AppImage') || a.name.endsWith('.dmg'));
              const localPath = path.join(this.cacheDir, asset ? asset.name : `Om-X-${version}-installer`);
              
              return {
                version: version,
                installDate: new Date(rel.published_at).getTime(),
                isCurrent: version === currentVer,
                installerExists: fs.existsSync(localPath),
                installerPath: localPath,
                downloadUrl: asset ? asset.browser_download_url : null,
                notes: rel.body
              };
            });
            resolve(history);
          } catch (e) {
            console.error('History Parse Error', e);
            resolve([]);
          }
        });
      });

      request.on('error', (err) => {
        console.error('History Fetch Error', err);
        resolve([]);
      });

      request.end();
    });
  }

  async downloadSpecificVersion(version, url) {
    if (!url) return { success: false, msg: 'No download asset found for this release.' };
    
    const fileName = url.split('/').pop();
    const targetPath = path.join(this.cacheDir, fileName);

    this.sendToUI('update-status', { status: 'downloading', percent: 0, version });

    return new Promise((resolve) => {
      const request = net.request(url);
      const fileStream = fs.createWriteStream(targetPath);
      
      let receivedBytes = 0;
      let totalBytes = 0;

      request.on('response', (response) => {
        totalBytes = parseInt(response.headers['content-length'], 10) || 1;
        
        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          fileStream.write(chunk);
          const percent = (receivedBytes / totalBytes) * 100;
          this.sendToUI('update-status', { status: 'downloading', percent, version });
        });

        response.on('end', () => {
          fileStream.end();
          this.sendToUI('update-status', { status: 'downloaded', version });
          resolve({ success: true, path: targetPath });
        });
      });

      request.on('error', (err) => {
        fileStream.close();
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        resolve({ success: false, msg: err.message });
      });

      request.end();
    });
  }

  registerIPC() {
    ipcMain.handle('updater-check', () => autoUpdater.checkForUpdates());
    ipcMain.handle('updater-download', () => autoUpdater.downloadUpdate());
    ipcMain.handle('updater-install', () => autoUpdater.quitAndInstall(false, true));
    ipcMain.handle('updater-get-history', () => this.getHistory());
    
    ipcMain.handle('updater-rollback', async (event, version) => {
      const history = await this.getHistory();
      const target = history.find(h => h.version === version);
      
      if (!target) return { success: false, msg: 'Release not found on GitHub.' };

      if (target.installerExists) {
        await shell.openPath(target.installerPath);
        setTimeout(() => app.quit(), 1500);
        return { success: true };
      } else {
        const download = await this.downloadSpecificVersion(version, target.downloadUrl);
        if (download.success) {
          await shell.openPath(download.path);
          setTimeout(() => app.quit(), 1500);
          return { success: true };
        }
        return download;
      }
    });
  }

  sendToUI(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

module.exports = UpdateManager;
