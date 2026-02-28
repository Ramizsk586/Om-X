const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');

const MODEL_PRESETS = [];

class LocalModelController {
    constructor() {
        this.modelDir = path.join(app.getPath('userData'), 'local_models');
        if (!fs.existsSync(this.modelDir)) fs.mkdirSync(this.modelDir, { recursive: true });

        this.childProcess = null;
        this.activeModelId = null;
        this.activeDownloadRequest = null;
        this.models = {}; 
        this.loadExistingModels();
    }

    loadExistingModels() {
        try {
            const files = fs.readdirSync(this.modelDir);
            MODEL_PRESETS.forEach(p => {
                const fullPath = path.join(this.modelDir, p.filename);
                if (fs.existsSync(fullPath)) this.models[p.id] = { ...p, path: fullPath };
            });
            files.forEach(file => {
                if (file.endsWith('.gguf')) {
                    const id = file.replace('.gguf', '');
                    if (!this.models[id]) this.models[id] = { id, name: id, filename: file, path: path.join(this.modelDir, file) };
                }
            });
        } catch (e) { console.error("[Local AI] Scan failed:", e); }
    }

    getEngineStatus() {
        return 'unsupported';
    }

    async downloadWithRedirects(url, dest, onProgress) {
        return new Promise((resolve, reject) => {
            const headers = { 'User-Agent': 'Om-X/1.4.5', 'Accept': '*/*' };

            const req = https.get(url, { headers }, (res) => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    return resolve(this.downloadWithRedirects(res.headers.location, dest, onProgress));
                }
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

                const total = parseInt(res.headers['content-length'] || '0', 10);
                let downloaded = 0;
                const file = fs.createWriteStream(dest);

                res.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (total > 0 && onProgress) onProgress(Math.round((downloaded / total) * 100));
                });
                res.pipe(file);
                file.on('finish', () => { file.close(() => { this.activeDownloadRequest = null; resolve(); }); });
            });

            req.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
            this.activeDownloadRequest = req;
        });
    }

    cancelDownload() {
        if (this.activeDownloadRequest) {
            this.activeDownloadRequest.destroy();
            this.activeDownloadRequest = null;
            return true;
        }
        return false;
    }

    async downloadModel(modelId, webContents) {
        const preset = MODEL_PRESETS.find(p => p.id === modelId);
        if (!preset) return;
        const targetPath = path.join(this.modelDir, preset.filename);
        try {
            webContents.send('local-model:status-updated', { modelId, status: 'downloading' });
            await this.downloadWithRedirects(preset.url, targetPath, (progress) => {
                webContents.send('local-model:download-progress', { modelId, progress });
            });
            this.models[modelId] = { ...preset, path: targetPath };
            webContents.send('local-model:status-updated', { modelId, status: 'downloaded' });
        } catch (e) {
            webContents.send('local-model:status-updated', { modelId, status: 'not_installed', error: e.message });
        }
    }



    unloadModel() {
        if (this.childProcess) {
            this.childProcess.kill('SIGKILL');
            this.childProcess = null;
            this.activeModelId = null;
        }
    }

    registerHandlers() {
        ipcMain.handle('local-model:status', () => {
            this.loadExistingModels();
            const statusMap = {};
            MODEL_PRESETS.forEach(p => statusMap[p.id] = (this.childProcess && this.activeModelId === p.id) ? 'loaded' : (fs.existsSync(path.join(this.modelDir, p.filename)) ? 'downloaded' : (this.activeDownloadRequest ? 'downloading' : 'not_installed')));
            return { statuses: statusMap, presets: MODEL_PRESETS, activeModelId: this.activeModelId, engineStatus: this.getEngineStatus() };
        });
        ipcMain.handle('local-model:download-preset', (e, id) => this.downloadModel(id, e.sender));
        ipcMain.handle('local-model:cancel-download', () => this.cancelDownload());
        ipcMain.handle('local-model:unload', () => this.unloadModel());
        ipcMain.handle('local-model:gpu-metrics', async () => new Promise(r => exec('nvidia-smi', err => r({ usage: err ? 2 : 5, usedMem: 512, totalMem: 4096 }))));
    }
}

module.exports = new LocalModelController();