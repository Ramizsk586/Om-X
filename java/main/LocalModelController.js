const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec, execSync } = require('child_process');
const https = require('https');

const LLAMA_VERSION = "b4618";
const LLAMA_RELEASES = {
    win32: { url: `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-win-avx2-x64.zip`, exe: 'llama-server.exe' },
    darwin: { url: `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-macos-arm64.zip`, exe: 'llama-server' },
    linux: { url: `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-ubuntu-x64.zip`, exe: 'llama-server' }
};

const MODEL_PRESETS = [
    {
        id: 'gemma-3-270m',
        name: 'Gemma 3 270M IT',
        description: 'Advanced ultra-compact model by Google. Optimized for rapid on-device reasoning.',
        url: 'https://huggingface.co/unsloth/gemma-3-270m-it-GGUF/resolve/main/gemma-3-270m-it-Q4_K_M.gguf',
        filename: 'gemma-3-270m-it-Q4_K_M.gguf'
    }
];

class LocalModelController {
    constructor() {
        this.modelDir = path.join(app.getPath('userData'), 'local_models');
        this.binDir = path.join(app.getPath('userData'), 'llama_bin');
        if (!fs.existsSync(this.modelDir)) fs.mkdirSync(this.modelDir, { recursive: true });
        if (!fs.existsSync(this.binDir)) fs.mkdirSync(this.binDir, { recursive: true });

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
        const cfg = LLAMA_RELEASES[process.platform];
        if (!cfg) return 'unsupported';
        return fs.existsSync(path.join(this.binDir, cfg.exe)) ? 'installed' : 'not_installed';
    }

    async downloadWithRedirects(url, dest, onProgress) {
        return new Promise((resolve, reject) => {
            const headers = { 'User-Agent': 'Om-X/1.4.5', 'Accept': '*/*' };
            if (process.env.HF_TOKEN && url.includes('huggingface.co')) headers['Authorization'] = `Bearer ${process.env.HF_TOKEN}`;

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

    async installEngine(webContents) {
        const cfg = LLAMA_RELEASES[process.platform];
        if (!cfg) return;
        const zipPath = path.join(this.binDir, 'llama_engine.zip');
        try {
            webContents.send('local-engine:status-updated', { status: 'downloading', progress: 0 });
            await this.downloadWithRedirects(cfg.url, zipPath, (p) => webContents.send('local-engine:status-updated', { status: 'downloading', progress: p }));
            webContents.send('local-engine:status-updated', { status: 'extracting' });
            if (process.platform === 'win32') execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${this.binDir}' -Force"`);
            else execSync(`unzip -o "${zipPath}" -d "${this.binDir}"`);
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            webContents.send('local-engine:status-updated', { status: 'installed' });
        } catch (e) { webContents.send('local-engine:status-updated', { status: 'not_installed', error: e.message }); }
    }

    loadModel(modelId, webContents) {
        if (this.childProcess) return;
        const model = this.models[modelId];
        if (!model) return;
        const binPath = path.join(this.binDir, LLAMA_RELEASES[process.platform].exe);
        this.activeModelId = modelId;
        this.childProcess = spawn(binPath, ['-m', model.path, '--port', '8081', '--ngl', '99', '--ctx-size', '2048']);
        this.childProcess.on('exit', () => {
            this.childProcess = null; this.activeModelId = null;
            const allWindows = require('electron').webContents.getAllWebContents();
            allWindows.forEach(wc => { if (!wc.isDestroyed()) wc.send('local-model:status-updated', { modelId, status: 'downloaded' }); });
        });
        webContents.send('local-model:status-updated', { modelId, status: 'loaded' });
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
        ipcMain.handle('local-engine:install', (e) => this.installEngine(e.sender));
        ipcMain.handle('local-model:download-preset', (e, id) => this.downloadModel(id, e.sender));
        ipcMain.handle('local-model:cancel-download', () => this.cancelDownload());
        ipcMain.handle('local-model:load', (e, id) => this.loadModel(id, e.sender));
        ipcMain.handle('local-model:unload', () => this.unloadModel());
        ipcMain.handle('local-model:gpu-metrics', async () => new Promise(r => exec('nvidia-smi', err => r({ usage: err ? 2 : 5, usedMem: 512, totalMem: 4096 }))));
    }
}

module.exports = new LocalModelController();