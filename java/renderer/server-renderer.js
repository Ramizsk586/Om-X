/**
  * Minecraft Panel Renderer
  * Manages the Minecraft Bedrock server and AI player
  */

function appendTerminalLine(outputEl, entry = {}) {
    if (!outputEl) return;
    const shouldStickToBottom = Math.abs((outputEl.scrollTop + outputEl.clientHeight) - outputEl.scrollHeight) < 48;
    const emptyState = outputEl.querySelector('.terminal-line.empty');
    if (emptyState) {
        emptyState.remove();
    }
    const line = document.createElement('div');
    const type = entry?.type || 'info';
    const timestamp = entry?.ts ? new Date(entry.ts).toLocaleTimeString() : new Date().toLocaleTimeString();
    const source = String(entry?.source || 'System').trim() || 'System';
    const message = String(entry?.message || '').trim() || 'No message';
    const levelLabelMap = {
        info: 'INFO',
        success: 'OK',
        error: 'ERROR',
        warning: 'WARN',
        command: 'CMD'
    };
    const levelLabel = levelLabelMap[type] || String(type).toUpperCase();
    line.className = `terminal-line ${type}`;
    line.innerHTML = `
        <span class="terminal-line-meta">${timestamp}</span>
        <span class="terminal-line-source">${escapeHtml(source)}</span>
        <span class="terminal-line-level">${escapeHtml(levelLabel)}</span>
        <span class="terminal-line-message">${escapeHtml(message)}</span>
    `;
    outputEl.appendChild(line);
    if (shouldStickToBottom) {
        requestAnimationFrame(() => {
            outputEl.scrollTop = outputEl.scrollHeight;
        });
    }
}

function hydrateLogOutput(outputEl, logs) {
    if (!outputEl || !Array.isArray(logs)) return;
    outputEl.innerHTML = '';
    if (!logs.length) {
        outputEl.innerHTML = `
            <div class="terminal-line empty info">
                <span class="terminal-line-message">No server logs yet. Start one of the MCP servers to begin streaming structured output.</span>
            </div>
        `;
        return;
    }
    logs.forEach((entry) => {
        appendTerminalLine(outputEl, entry);
    });
    requestAnimationFrame(() => {
        outputEl.scrollTop = outputEl.scrollHeight;
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateMcpRuntimeStatus(statusElementId, status) {
    const labels = {
        offline: 'Offline',
        starting: 'Starting...',
        online: 'Online'
    };
    const normalizedStatus = Object.prototype.hasOwnProperty.call(labels, status) ? status : 'offline';
    const statusEl = document.getElementById(statusElementId);
    if (!statusEl) return;
    statusEl.textContent = labels[normalizedStatus];
    statusEl.dataset.state = normalizedStatus;
    const cardEl = statusEl.closest('.mcp-runtime-card');
    if (cardEl) {
        cardEl.dataset.status = normalizedStatus;
    }
}

class MinecraftRenderer {
    constructor() {
        this.initialized = false;
        console.log('[Minecraft] Constructor called');
    }

    async init() {
        console.log('[Minecraft] Initializing...');
        console.log('[Minecraft] window.browserAPI available:', !!window.browserAPI);
        this.initialized = true;
        
        // Wait for DOM to be fully ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        
        console.log('[Minecraft] Initialization complete');
    }

    setupEventListeners() {
        console.log('[Minecraft] Setting up event listeners...');

        const panelFromQuery = new URLSearchParams(window.location.search).get('panel');
        const requestedPanel = String(panelFromQuery || '').trim();
        const hasRequestedPanel = requestedPanel
            && document.querySelector(`.panel#panel-${CSS.escape(requestedPanel)}`);
        this.switchPanel(hasRequestedPanel ? requestedPanel : 'llama');

        console.log('[Minecraft] Event listeners setup complete');
    }

    switchPanel(panelName) {
        console.log(`[Minecraft] Switching to panel: ${panelName}`);

        // Update panels
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${panelName}`);
        });
    }
}

class LlamaServerRenderer {
    constructor() {
        this.llamaProcess = null;
        this.isRunning = false;
        this.llamaPath = null;
        this.llamaCliPath = null;
        this.modelsPath = null;
        this.selectedModel = null;
        this.startTime = null;
        this.uptimeInterval = null;
        this.initialized = false;
        this.launchCommand = '';
        console.log('[LlamaServer] Constructor called');
    }

    init() {
        console.log('[LlamaServer] Initializing...');
        this.initialized = true;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }

        this.setupIPCListeners();
        this.loadSettings();
        this.loadRuntimeState();
        this.updateGPUDisplay();
        this.updateManualCommand();
        this.log('Llama Server Manager initialized', 'info');
        console.log('[LlamaServer] Initialization complete');
    }

    async updateGPUDisplay() {
        const memoryEl = document.getElementById('gpu-memory-available');
        if (!memoryEl) return;

        const available = await this.getAvailableGPUMemory();
        memoryEl.textContent = `${available} MB`;
    }

    setupIPCListeners() {
        if (window.browserAPI && window.browserAPI.llama) {
            window.browserAPI.llama.onOutput((data) => {
                const type = data.type === 'stderr' ? 'warning' : (data.type === 'error' ? 'error' : 'info');
                String(data.data || '')
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .forEach((line) => this.log(line, type));
            });
            window.browserAPI.llama.onExit((data) => {
                this.log(`Server exited with code: ${data.code}`, 'error');
                this.isRunning = false;
                this.startTime = null;
                this.setStatus('offline');
                if (this.uptimeInterval) {
                    clearInterval(this.uptimeInterval);
                    this.uptimeInterval = null;
                }
                const startBtn = document.getElementById('btn-start-llama');
                const stopBtn = document.getElementById('btn-stop-llama');
                if (startBtn) startBtn.disabled = false;
                if (stopBtn) {
                    stopBtn.disabled = true;
                    stopBtn.textContent = 'Stop Server';
                }
                this.updateEndpoint();
            });
        }
    }

    setupEventListeners() {
        console.log('[LlamaServer] Setting up event listeners...');

        const browseLlamaBtn = document.getElementById('btn-browse-llama');
        const browseLlamaCliBtn = document.getElementById('btn-browse-llama-cli');
        const browseModelsBtn = document.getElementById('btn-browse-models');
        const scanModelsBtn = document.getElementById('btn-scan-models');
        const modelSelect = document.getElementById('model-select');
        const startLlamaBtn = document.getElementById('btn-start-llama');
        const stopLlamaBtn = document.getElementById('btn-stop-llama');
        const refreshLogsBtn = document.getElementById('btn-refresh-llama-logs');

        if (browseLlamaBtn) {
            browseLlamaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForLlamaExecutable();
            });
        }

        if (browseLlamaCliBtn) {
            browseLlamaCliBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForLlamaCliExecutable();
            });
        }

        if (browseModelsBtn) {
            browseModelsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForModelsFolder();
            });
        }

        if (scanModelsBtn) {
            scanModelsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.scanModelsFolder();
            });
        }

        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                this.onModelSelected(e.target.value);
                this.updateManualCommand();
            });
        }

        if (startLlamaBtn) {
            startLlamaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startServer();
            });
        }

        if (stopLlamaBtn) {
            stopLlamaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stopServer();
            });
        }

        if (refreshLogsBtn) {
            refreshLogsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.refreshLogs();
            });
        }

        ['llama-path-input', 'llama-cli-path-input', 'models-path-input'].forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('change', () => this.onPathInputChanged(id, input.value));
            input.addEventListener('input', () => this.onPathInputChanged(id, input.value, { save: false }));
        });

        const inputs = ['context-length', 'gpu-layers', 'llama-port', 'llama-threads', 'llama-host'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => this.saveSettings());
                input.addEventListener('input', () => {
                    this.updateManualCommand();
                    if (id === 'llama-port' || id === 'llama-host') {
                        this.updateEndpoint();
                    }
                });
            }
        });

        // Copy command button
        const copyBtn = document.getElementById('btn-copy-llama-command');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyLlamaCommand());
        }

        console.log('[LlamaServer] Event listeners setup complete');
    }

    generateManualCommand() {
        const cliPath = this.resolveCliPath();
        if (!cliPath) {
            return 'Configure server or CLI executable and model to generate llama-cli command...';
        }

        const modelPath = this.selectedModel ? `${this.modelsPath}\\${this.selectedModel}` : 'path\\to\\model.gguf';
        const contextLength = document.getElementById('context-length')?.value || '4096';
        const gpuLayers = document.getElementById('gpu-layers')?.value || '-1';
        const threads = document.getElementById('llama-threads')?.value || '4';

        return `& "${cliPath}" -m "${modelPath}" -c ${contextLength} -ngl ${gpuLayers} -t ${threads} --color auto`;
    }

    generateServerCommand() {
        if (!this.llamaPath || !this.selectedModel) {
            return '';
        }

        const modelPath = this.modelsPath ? `${this.modelsPath}\\${this.selectedModel}` : this.selectedModel;
        const contextLength = document.getElementById('context-length')?.value || '4096';
        const gpuLayers = document.getElementById('gpu-layers')?.value || '-1';
        const port = document.getElementById('llama-port')?.value || '8080';
        const threads = document.getElementById('llama-threads')?.value || '4';
        const serverType = this.normalizeServerType(document.getElementById('llama-host')?.value || 'local');
        const host = this.resolveBindHost(serverType);

        return `& "${this.llamaPath}" -m "${modelPath}" -c ${contextLength} -ngl ${gpuLayers} --port ${port} -t ${threads} --host ${host}`;
    }

    updateManualCommand() {
        const commandEl = document.getElementById('llama-manual-command');
        if (commandEl) {
            commandEl.textContent = this.generateManualCommand();
        }
    }

    copyLlamaCommand() {
        const command = this.generateManualCommand();
        if (command && !command.includes('Configure server or CLI executable')) {
            navigator.clipboard.writeText(command).then(() => {
                this.log('Command copied to clipboard!', 'success');
            }).catch(err => {
                console.error('[LlamaServer] Failed to copy:', err);
                this.log('Failed to copy command', 'error');
            });
        } else {
            this.log('Configure executable and model first', 'warning');
        }
    }

    resolveCliPath() {
        const cliPath = String(this.llamaCliPath || '').trim();
        if (cliPath) return cliPath;

        const serverPath = String(this.llamaPath || '').trim();
        if (!serverPath) return '';

        return serverPath.replace(/llama-server(\.exe)?$/i, 'llama-cli$1');
    }

    normalizeServerType(value) {
        const next = String(value || '').trim().toLowerCase();
        if (next === 'ngrok') return 'ngrok';
        if (next === 'lan' || next === '0.0.0.0') return 'lan';
        return 'local';
    }

    resolveBindHost(serverType) {
        return this.normalizeServerType(serverType) === 'lan' ? '0.0.0.0' : '127.0.0.1';
    }

    onPathInputChanged(id, rawValue, options = {}) {
        const save = options.save !== false;
        const value = String(rawValue || '').trim();

        if (id === 'llama-path-input') this.llamaPath = value;
        if (id === 'llama-cli-path-input') this.llamaCliPath = value;
        if (id === 'models-path-input') this.modelsPath = value;

        if (save) this.saveSettings();
        this.updateManualCommand();
    }

    async browseForLlamaExecutable() {
        console.log('[LlamaServer] browseForLlamaExecutable called');

        if (window.browserAPI && window.browserAPI.files) {
            try {
                const filters = [
                    { name: 'Executable', extensions: ['exe'] },
                    { name: 'All Files', extensions: ['*'] }
                ];
                const filePath = await window.browserAPI.files.selectFile(filters);

                if (filePath) {
                    // Trust the parent directory of the executable
                    try {
                        const parentDir = filePath.substring(0, filePath.lastIndexOf('\\') || filePath.lastIndexOf('/'));
                        if (parentDir) {
                            const trustResult = await window.browserAPI.files.trustFolder(parentDir);
                            if (trustResult.success) {
                                console.log('[LlamaServer] Folder trusted:', trustResult.path);
                            }
                        }
                    } catch (trustErr) {
                        console.error('[LlamaServer] Failed to trust folder:', trustErr);
                    }
                    
                    const pathInput = document.getElementById('llama-path-input');
                    if (pathInput) {
                        pathInput.value = filePath;
                        this.llamaPath = filePath;
                        this.saveSettings();
                        this.updateManualCommand();
                        this.log(`Llama server executable selected: ${filePath}`, 'info');
                    }
                }
            } catch (err) {
                console.error('[LlamaServer] Dialog error:', err);
                this.showPathPrompt('llama');
            }
        } else {
            this.showPathPrompt('llama');
        }
    }

    async browseForLlamaCliExecutable() {
        console.log('[LlamaServer] browseForLlamaCliExecutable called');

        if (window.browserAPI && window.browserAPI.files) {
            try {
                const filters = [
                    { name: 'Executable', extensions: ['exe'] },
                    { name: 'All Files', extensions: ['*'] }
                ];
                const filePath = await window.browserAPI.files.selectFile(filters);

                if (filePath) {
                    try {
                        const parentDir = filePath.substring(0, filePath.lastIndexOf('\\') || filePath.lastIndexOf('/'));
                        if (parentDir) {
                            await window.browserAPI.files.trustFolder(parentDir);
                        }
                    } catch (trustErr) {
                        console.error('[LlamaServer] Failed to trust CLI folder:', trustErr);
                    }

                    const pathInput = document.getElementById('llama-cli-path-input');
                    if (pathInput) {
                        pathInput.value = filePath;
                        this.llamaCliPath = filePath;
                        this.saveSettings();
                        this.updateManualCommand();
                        this.log(`Llama CLI executable selected: ${filePath}`, 'info');
                    }
                }
            } catch (err) {
                console.error('[LlamaServer] Dialog error:', err);
                this.showPathPrompt('llama-cli');
            }
        } else {
            this.showPathPrompt('llama-cli');
        }
    }

    async browseForModelsFolder() {
        console.log('[LlamaServer] browseForModelsFolder called');

        if (window.browserAPI && window.browserAPI.files) {
            try {
                const folderPath = await window.browserAPI.files.selectFolder();

                if (folderPath) {
                    console.log('[LlamaServer] Selected folder path:', folderPath);
                    
                    // Register the folder as trusted for file access
                    try {
                        const trustResult = await window.browserAPI.files.trustFolder(folderPath);
                        console.log('[LlamaServer] Trust result:', trustResult);
                        if (trustResult && trustResult.success) {
                            console.log('[LlamaServer] Folder trusted:', trustResult.path);
                            this.log(`Folder trusted for access: ${trustResult.path}`, 'success');
                        } else if (trustResult && trustResult.error) {
                            console.error('[LlamaServer] Trust failed:', trustResult.error);
                            this.log(`Failed to trust folder: ${trustResult.error}`, 'error');
                        }
                    } catch (trustErr) {
                        console.error('[LlamaServer] Failed to call trustFolder:', trustErr);
                        this.log(`Error trusting folder: ${trustErr?.message || trustErr}`, 'error');
                    }
                    
                    const pathInput = document.getElementById('models-path-input');
                    if (pathInput) {
                        pathInput.value = folderPath;
                        this.modelsPath = folderPath;
                        this.saveSettings();
                        this.updateManualCommand();
                        this.log(`Models folder selected: ${folderPath}`, 'info');
                    }
                }
            } catch (err) {
                console.error('[LlamaServer] Dialog error:', err);
                this.showPathPrompt('models');
            }
        } else {
            this.showPathPrompt('models');
        }
    }

    async showPathPrompt(type) {
        const placeholderMap = {
            llama: 'C:\\llama.cpp\\llama-server.exe',
            'llama-cli': 'C:\\llama.cpp\\llama-cli.exe',
            models: 'C:\\llama.cpp\\models'
        };
        const labelMap = {
            llama: 'llama-server.exe',
            'llama-cli': 'llama-cli.exe',
            models: 'models folder'
        };
        const placeholder = placeholderMap[type] || '';
        const userPath = prompt(`Enter the path to ${labelMap[type] || type}:`, placeholder);
        if (userPath) {
            // Try to trust the folder/path if it's models
            if (type === 'models' && window.browserAPI && window.browserAPI.files) {
                try {
                    const trustResult = await window.browserAPI.files.trustFolder(userPath);
                    console.log('[LlamaServer] Manual path trusted:', trustResult);
                } catch (e) {
                    console.error('[LlamaServer] Failed to trust manual path:', e);
                }
            }
            
            if (type === 'llama') {
                const pathInput = document.getElementById('llama-path-input');
                if (pathInput) {
                    pathInput.value = userPath;
                    this.llamaPath = userPath;
                    // Trust the parent directory of executable
                    if (window.browserAPI && window.browserAPI.files) {
                        try {
                            const parentDir = userPath.substring(0, userPath.lastIndexOf('\\') || userPath.lastIndexOf('/'));
                            if (parentDir) {
                                await window.browserAPI.files.trustFolder(parentDir);
                            }
                        } catch (e) {
                            console.error('[LlamaServer] Failed to trust exe folder:', e);
                        }
                    }
                }
            } else if (type === 'llama-cli') {
                const pathInput = document.getElementById('llama-cli-path-input');
                if (pathInput) {
                    pathInput.value = userPath;
                    this.llamaCliPath = userPath;
                    if (window.browserAPI && window.browserAPI.files) {
                        try {
                            const parentDir = userPath.substring(0, userPath.lastIndexOf('\\') || userPath.lastIndexOf('/'));
                            if (parentDir) {
                                await window.browserAPI.files.trustFolder(parentDir);
                            }
                        } catch (e) {
                            console.error('[LlamaServer] Failed to trust CLI folder:', e);
                        }
                    }
                }
            } else {
                const pathInput = document.getElementById('models-path-input');
                if (pathInput) {
                    pathInput.value = userPath;
                    this.modelsPath = userPath;
                }
            }
            this.saveSettings();
            this.updateManualCommand();
        }
    }

    async scanModelsFolder() {
        console.log('[LlamaServer] scanModelsFolder called');
        const pathInput = document.getElementById('models-path-input');
        if (!pathInput) {
            this.log('Models folder path not set', 'error');
            return;
        }

        const folderPath = pathInput.value.trim();
        if (!folderPath) {
            this.log('Please select a models folder first', 'error');
            return;
        }

        console.log('[LlamaServer] Scanning folder:', folderPath);
        this.log(`Scanning models folder: ${folderPath}`, 'info');

        // Re-trust the folder before scanning
        if (window.browserAPI && window.browserAPI.files) {
            try {
                console.log('[LlamaServer] Re-trusting folder before scan...');
                const trustResult = await window.browserAPI.files.trustFolder(folderPath);
                console.log('[LlamaServer] Re-trust result:', trustResult);
            } catch (trustErr) {
                console.error('[LlamaServer] Re-trust failed:', trustErr);
            }
        }

        if (window.browserAPI && window.browserAPI.files) {
            try {
                console.log('[LlamaServer] Calling readDir for:', folderPath);
                const files = await window.browserAPI.files.readDir(folderPath);
                console.log('[LlamaServer] Files found:', files);
                
                // Handle both string filenames and Dirent objects
                const ggufFiles = files
                    .map(f => {
                        // Extract filename if it's a Dirent object, otherwise use as-is
                        const filename = typeof f === 'string' ? f : (f.name || String(f));
                        return filename;
                    })
                    .filter(filename => {
                        const name = String(filename).toLowerCase();
                        return name.endsWith('.gguf');
                    });

                console.log('[LlamaServer] GGUF files found:', ggufFiles);

                if (ggufFiles.length === 0) {
                    this.log('No .gguf model files found in the folder', 'warning');
                    return;
                }

                this.log(`Found ${ggufFiles.length} model(s)`, 'success');
                this.populateModelSelect(ggufFiles);
                this.showModelSection();
                this.updateManualCommand();
            } catch (err) {
                console.error('[LlamaServer] Error scanning folder:', err);
                this.log(`Error scanning folder: ${err.message || err}`, 'error');
            }
        } else {
            this.log('File API not available', 'error');
        }
    }

    populateModelSelect(models) {
        const select = document.getElementById('model-select');
        if (!select) return;

        select.innerHTML = '<option value="">-- Select a model --</option>';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            select.appendChild(option);
        });
    }

    showModelSection() {
        const modelSection = document.getElementById('llama-model-section');
        if (modelSection) {
            modelSection.classList.remove('hidden');
        }
    }

    async onModelSelected(modelName) {
        this.selectedModel = modelName;
        this.saveSettings();

        if (!modelName) {
            this.updateModelInfo(null);
            const modelEl = document.getElementById('llama-status-model');
            if (modelEl) modelEl.textContent = 'Model: --';
            return;
        }

        this.log(`Model selected: ${modelName}`, 'info');
        this.updateManualCommand();
        
        // Update status bar model
        const modelEl = document.getElementById('llama-status-model');
        if (modelEl) modelEl.textContent = `Model: ${modelName}`;
        
        await this.checkModelRequirements(modelName);
    }

    async checkModelRequirements(modelName) {
        this.updateManualCommand();
        await this.checkModelRequirements(modelName);
    }

    async checkModelRequirements(modelName) {
        if (window.browserAPI && window.browserAPI.llama) {
            try {
                const info = await window.browserAPI.llama.checkModelSize(this.modelsPath, modelName);
                this.updateModelInfo(info);
            } catch (err) {
                console.error('[LlamaServer] Error checking model:', err);
            }
        } else {
            this.estimateModelSize(modelName);
        }
    }

    estimateModelSize(modelName) {
        const sizeEl = document.getElementById('model-size');
        const statusEl = document.getElementById('model-status');
        const warningEl = document.getElementById('model-warning');
        const warningTextEl = document.getElementById('model-warning-text');

        let estimatedSize = 0;
        const modelLower = modelName.toLowerCase();

        if (modelLower.includes('7b')) {
            estimatedSize = 4500;
        } else if (modelLower.includes('8b') || modelLower.includes('8x7b')) {
            estimatedSize = 5500;
        } else if (modelLower.includes('13b') || modelLower.includes('13x')) {
            estimatedSize = 8500;
        } else if (modelLower.includes('14b') || modelLower.includes('14x')) {
            estimatedSize = 9500;
        } else if (modelLower.includes('20b') || modelLower.includes('20x')) {
            estimatedSize = 13000;
        } else if (modelLower.includes('27b') || modelLower.includes('27x')) {
            estimatedSize = 18000;
        } else if (modelLower.includes('30b') || modelLower.includes('30x')) {
            estimatedSize = 20000;
        } else if (modelLower.includes('34b') || modelLower.includes('34x')) {
            estimatedSize = 22000;
        } else if (modelLower.includes('40b') || modelLower.includes('40x')) {
            estimatedSize = 26000;
        } else if (modelLower.includes('70b') || modelLower.includes('70x')) {
            estimatedSize = 40000;
        } else if (modelLower.includes('120b') || modelLower.includes('120x')) {
            estimatedSize = 65000;
        } else {
            estimatedSize = 4000;
        }

        if (modelLower.includes('q4_k_m') || modelLower.includes('q4km')) {
            estimatedSize *= 0.7;
        } else if (modelLower.includes('q5_k_m') || modelLower.includes('q5km')) {
            estimatedSize *= 0.85;
        } else if (modelLower.includes('q6_k') || modelLower.includes('q6k')) {
            estimatedSize *= 0.95;
        } else if (modelLower.includes('q8_0') || modelLower.includes('q8')) {
            estimatedSize *= 1.2;
        } else if (modelLower.includes('q2_k') || modelLower.includes('q2k')) {
            estimatedSize *= 0.55;
        } else if (modelLower.includes('q3_k') || modelLower.includes('q3k')) {
            estimatedSize *= 0.65;
        }

        estimatedSize = Math.round(estimatedSize);

        if (sizeEl) {
            sizeEl.textContent = `~${estimatedSize} MB`;
        }

        this.canLoadModel(estimatedSize);
    }

    async getAvailableGPUMemory() {
        if (window.browserAPI && window.browserAPI.llama) {
            try {
                const gpuInfo = await window.browserAPI.llama.getGPUInfo();
                return gpuInfo.availableMemory || 8000;
            } catch (err) {
                return 8000;
            }
        }
        return 8000;
    }

    async canLoadModel(modelSizeMB) {
        const availableMemory = await this.getAvailableGPUMemory();
        const maxAllowed = availableMemory * 0.95;

        const statusEl = document.getElementById('model-status');
        const warningEl = document.getElementById('model-warning');
        const warningTextEl = document.getElementById('model-warning-text');

        if (statusEl) {
            statusEl.textContent = modelSizeMB > maxAllowed ? 'Too Large' : 'Compatible';
        }

        if (modelSizeMB > maxAllowed) {
            if (warningEl) warningEl.classList.remove('hidden');
            if (warningTextEl) {
                warningTextEl.textContent = `Model requires ~${modelSizeMB} MB but only ${Math.round(maxAllowed)} MB is available (95% of ${availableMemory} MB). Please select a smaller model or use a device with more GPU memory.`;
            }
            return false;
        } else {
            if (warningEl) warningEl.classList.add('hidden');
            return true;
        }
    }

    updateModelInfo(info) {
        const sizeEl = document.getElementById('model-size');
        const statusEl = document.getElementById('model-status');

        if (sizeEl) {
            sizeEl.textContent = info ? `${info.size} MB` : '--';
        }

        if (statusEl && info) {
            statusEl.textContent = info.canLoad ? 'Compatible' : 'Too Large';
        }
    }

    async startServer() {
        console.log('[LlamaServer] startServer called');

        if (this.isRunning) {
            this.log('Llama server is already running!', 'warning');
            return;
        }

        if (!this.llamaPath) {
            this.log('Please select the llama-server executable first', 'error');
            return;
        }

        if (!this.selectedModel) {
            this.log('Please select a model first', 'error');
            return;
        }

        const modelSizeEl = document.getElementById('model-size');
        const statusEl = document.getElementById('model-status');
        if (statusEl && statusEl.textContent === 'Too Large') {
            this.log('Cannot load model: it exceeds GPU memory limit', 'error');
            return;
        }

        const contextLength = document.getElementById('context-length').value || '4096';
        const gpuLayers = document.getElementById('gpu-layers').value || '-1';
        const port = document.getElementById('llama-port').value || '8080';
        const threads = document.getElementById('llama-threads').value || '4';
        const serverType = this.normalizeServerType(document.getElementById('llama-host').value || 'local');
        const bindHost = this.resolveBindHost(serverType);

        this.log('Starting Llama Server...', 'info');
        this.launchCommand = this.generateServerCommand();
        if (this.launchCommand) {
            this.log(`Launch command: ${this.launchCommand}`, 'command');
        }
        this.setStatus('starting');

        const startBtn = document.getElementById('btn-start-llama');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Starting...';
        }

        if (window.browserAPI && window.browserAPI.llama) {
            try {
                const result = await window.browserAPI.llama.startServer({
                    executable: this.llamaPath,
                    model: this.selectedModel,
                    modelsPath: this.modelsPath,
                    contextLength,
                    gpuLayers,
                    port,
                    threads,
                    host: bindHost,
                    serverType
                });

                if (result.success) {
                    this.isRunning = true;
                    this.startTime = Date.now();
                    this.setStatus('online');
                    this.log('Llama server started successfully!', 'success');
                    const localUrl = String(result.localUrl || `http://localhost:${port}`).replace(/[\\/]+$/, '');
                    this.log(`Server listening on ${localUrl}`, 'info');
                    if (result.publicUrl) {
                        this.log(`Public URL: ${result.publicUrl}`, 'success');
                    }
                    this.log(`API endpoint: ${result.publicUrl || localUrl}/v1/chat/completions`, 'info');
                    this.startUptimeCounter();
                    this.updateEndpoint({
                        port: result.port || port,
                        host: result.host || bindHost,
                        serverType: result.serverType || serverType,
                        publicUrl: result.publicUrl || ''
                    });

                    // Update status bar
                    const modelEl = document.getElementById('llama-status-model');
                    if (modelEl) modelEl.textContent = `Model: ${this.selectedModel}`;
                } else {
                    this.isRunning = false;
                    this.startTime = null;
                    this.log(`Failed to start server: ${result.error}`, 'error');
                    this.setStatus('offline');
                    const startBtn = document.getElementById('btn-start-llama');
                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.textContent = 'Start Server';
                    }
                }
            } catch (err) {
                console.error('[LlamaServer] Error starting server:', err);
                this.isRunning = false;
                this.startTime = null;
                this.log(`Error starting server: ${err.message || err}`, 'error');
                this.setStatus('offline');
                const startBtn = document.getElementById('btn-start-llama');
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.textContent = 'Start Server';
                }
            }
        } else {
            this.isRunning = false;
            this.startTime = null;
            this.log('Llama API not available', 'error');
            this.setStatus('offline');
            const startBtn = document.getElementById('btn-start-llama');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = 'Start Server';
            }
        }
    }

    async stopServer() {
        console.log('[LlamaServer] stopServer called');

        if (!this.isRunning) {
            this.log('Llama server is not running.', 'warning');
            return;
        }

        this.log('Stopping Llama server...', 'info');

        const stopBtn = document.getElementById('btn-stop-llama');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.textContent = 'Stopping...';
        }

        if (window.browserAPI && window.browserAPI.llama) {
            try {
                const result = await window.browserAPI.llama.stopServer();
                if (result.success) {
                    this.isRunning = false;
                    this.llamaProcess = null;
                    this.setStatus('offline');
                    this.log('Llama server stopped.', 'success');

                    if (this.uptimeInterval) {
                        clearInterval(this.uptimeInterval);
                        this.uptimeInterval = null;
                    }

                    // Reset uptime display
                    const uptimeEl = document.getElementById('llama-status-uptime');
                    if (uptimeEl) uptimeEl.textContent = '00:00:00';

                    const startBtn = document.getElementById('btn-start-llama');
                    const stopBtn = document.getElementById('btn-stop-llama');
                    if (startBtn) startBtn.disabled = false;
                    if (stopBtn) {
                        stopBtn.disabled = true;
                        stopBtn.textContent = 'Stop Server';
                    }
                    this.updateEndpoint();
                } else {
                    if (String(result.error || '').includes('not running')) {
                        this.isRunning = false;
                        this.llamaProcess = null;
                        this.setStatus('offline');
                        if (this.uptimeInterval) {
                            clearInterval(this.uptimeInterval);
                            this.uptimeInterval = null;
                        }
                        const uptimeEl = document.getElementById('llama-status-uptime');
                        if (uptimeEl) uptimeEl.textContent = '00:00:00';
                        const startBtn = document.getElementById('btn-start-llama');
                        if (startBtn) startBtn.disabled = false;
                        this.updateEndpoint();
                    }
                    this.log(`Failed to stop server: ${result.error}`, 'error');
                    const stopBtn = document.getElementById('btn-stop-llama');
                    if (stopBtn) {
                        stopBtn.disabled = !this.isRunning;
                        stopBtn.textContent = 'Stop Server';
                    }
                }
            } catch (err) {
                console.error('[LlamaServer] Error stopping server:', err);
                this.log(`Error stopping server: ${err.message || err}`, 'error');
                const stopBtn = document.getElementById('btn-stop-llama');
                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.textContent = 'Stop Server';
                }
            }
        }
    }

    log(message, type = 'info') {
        const text = String(message ?? '');
        const level = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
        console[level](`[LlamaServer] ${text}`);

        const output = document.getElementById('llama-terminal-output');
        if (!output) return;
        appendTerminalLine(output, {
            type,
            source: 'Llama',
            message: text
        });

        while (output.children.length > 1000) {
            output.removeChild(output.firstChild);
        }
    }

    setStatus(status) {
        const statusDot = document.getElementById('llama-status-dot');
        const statusLabel = document.getElementById('llama-status-label');
        const startBtn = document.getElementById('btn-start-llama');
        const stopBtn = document.getElementById('btn-stop-llama');

        const statusMap = {
            'offline': 'Offline',
            'starting': 'Starting...',
            'online': 'Online'
        };

        if (statusDot) {
            statusDot.className = 'status-dot-small';
            if (status === 'online') statusDot.classList.add('online');
            if (status === 'starting') statusDot.classList.add('starting');
        }

        if (statusLabel) {
            statusLabel.textContent = `Server ${statusMap[status] || 'Unknown'}`;
        }

        // Update buttons
        if (startBtn) {
            startBtn.disabled = status === 'online' || status === 'starting';
        }
        if (stopBtn) {
            stopBtn.disabled = status !== 'online';
        }
    }

    startUptimeCounter() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
        }

        this.uptimeInterval = setInterval(() => {
            if (!this.startTime) return;

            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');

            const uptimeEl = document.getElementById('llama-status-uptime');
            if (uptimeEl) {
                uptimeEl.textContent = `${hours}:${minutes}:${seconds}`;
            }
        }, 1000);
    }

    updateEndpoint(portOrOptions, host) {
        let port = portOrOptions;
        let nextHost = host;
        let serverType = this.normalizeServerType(document.getElementById('llama-host')?.value || 'local');
        let publicUrl = '';

        if (portOrOptions && typeof portOrOptions === 'object') {
            port = portOrOptions.port;
            nextHost = portOrOptions.host;
            serverType = this.normalizeServerType(portOrOptions.serverType || serverType);
            publicUrl = String(portOrOptions.publicUrl || '').trim();
        }

        const endpointEl = document.getElementById('llama-status-endpoint');
        if (endpointEl) {
            const resolvedPort = String(port || document.getElementById('llama-port')?.value || '8080');
            const resolvedHost = String(nextHost || this.resolveBindHost(serverType));
            if (serverType === 'ngrok' && publicUrl) {
                endpointEl.textContent = publicUrl;
                return;
            }
            const displayHost = resolvedHost === '0.0.0.0' ? '0.0.0.0' : 'localhost';
            endpointEl.textContent = `http://${displayHost}:${resolvedPort}`;
        }
    }

    saveSettings() {
        try {
            const settings = {
                llamaPath: this.llamaPath,
                llamaCliPath: this.llamaCliPath,
                modelsPath: this.modelsPath,
                selectedModel: this.selectedModel,
                contextLength: document.getElementById('context-length')?.value || '4096',
                gpuLayers: document.getElementById('gpu-layers')?.value || '-1',
                port: document.getElementById('llama-port')?.value || '8080',
                threads: document.getElementById('llama-threads')?.value || '4',
                host: document.getElementById('llama-host')?.value || '127.0.0.1'
            };
            localStorage.setItem('llama-server-settings', JSON.stringify(settings));
            console.log('[LlamaServer] Settings saved');
            this.updateEndpoint({
                port: settings.port,
                host: this.resolveBindHost(settings.host),
                serverType: settings.host
            });
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    loadSettings() {
        console.log('[LlamaServer] loadSettings called');
        try {
            const saved = localStorage.getItem('llama-server-settings');
            if (saved) {
                console.log('[LlamaServer] Found saved settings');
                const settings = JSON.parse(saved);

                this.llamaPath = settings.llamaPath;
                this.llamaCliPath = settings.llamaCliPath;
                this.modelsPath = settings.modelsPath;
                this.selectedModel = settings.selectedModel;
                const savedHost = this.normalizeServerType(settings.host || settings.serverType || 'local');

                const pathInput = document.getElementById('llama-path-input');
                if (pathInput && this.llamaPath) pathInput.value = this.llamaPath;

                const cliPathInput = document.getElementById('llama-cli-path-input');
                if (cliPathInput && this.llamaCliPath) cliPathInput.value = this.llamaCliPath;

                const modelsInput = document.getElementById('models-path-input');
                if (modelsInput && this.modelsPath) modelsInput.value = this.modelsPath;

                // Update status bar model if selected
                const modelEl = document.getElementById('llama-status-model');
                if (modelEl && this.selectedModel) {
                    modelEl.textContent = `Model: ${this.selectedModel}`;
                }

                if (this.modelsPath) {
                    this.scanModelsFolder();
                }

                if (settings.contextLength) {
                    const input = document.getElementById('context-length');
                    if (input) input.value = settings.contextLength;
                }

                if (settings.gpuLayers) {
                    const input = document.getElementById('gpu-layers');
                    if (input) input.value = settings.gpuLayers;
                }

                if (settings.port) {
                    const input = document.getElementById('llama-port');
                    if (input) input.value = settings.port;
                }

                if (settings.threads) {
                    const input = document.getElementById('llama-threads');
                    if (input) input.value = settings.threads;
                }

                if (savedHost) {
                    const input = document.getElementById('llama-host');
                    if (input) input.value = savedHost;
                }

                this.updateManualCommand();
                this.updateEndpoint({
                    port: settings.port || '8080',
                    host: this.resolveBindHost(savedHost),
                    serverType: savedHost
                });
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    async loadRuntimeState() {
        if (!window.browserAPI?.servers) return;
        try {
            const statusRes = await window.browserAPI.servers.getStatus('llama');
            if (statusRes?.success && statusRes.status?.running) {
                const status = statusRes.status;
                this.isRunning = true;
                this.startTime = status.startedAt || Date.now();
                this.setStatus('online');
                this.startUptimeCounter();
                this.updateEndpoint({
                    port: status?.config?.port || status?.port || '8080',
                    host: status?.config?.host || status?.host || '127.0.0.1',
                    serverType: status?.config?.serverType || status?.config?.host || 'local',
                    publicUrl: status?.config?.publicUrl || ''
                });

                const modelEl = document.getElementById('llama-status-model');
                if (modelEl && status?.config?.modelPath) {
                    const parts = String(status.config.modelPath).split(/[/\\]/);
                    modelEl.textContent = `Model: ${parts.at(-1) || this.selectedModel || '--'}`;
                }

                const startBtn = document.getElementById('btn-start-llama');
                const stopBtn = document.getElementById('btn-stop-llama');
                if (startBtn) {
                    startBtn.disabled = true;
                    startBtn.style.opacity = '0.5';
                }
                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.style.opacity = '1';
                }
            } else {
                this.isRunning = false;
                this.startTime = null;
                this.setStatus('offline');
                this.updateEndpoint();
            }

            await this.refreshLogs({ silent: true });
        } catch (e) {
            console.warn('[LlamaServer] Failed to load runtime state:', e);
        }
    }

    async refreshLogs(options = {}) {
        if (!window.browserAPI?.servers) return;

        const { silent = false } = options;
        const refreshBtn = document.getElementById('btn-refresh-llama-logs');
        const output = document.getElementById('llama-terminal-output');
        const originalLabel = refreshBtn?.innerHTML;

        try {
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = 'Refreshing...';
            }

            const logsRes = await window.browserAPI.servers.getLogs('llama');
            if (logsRes?.success) {
                if (output) {
                    hydrateLogOutput(output, logsRes.logs);
                }
                return;
            }

            if (!silent) {
                this.log(`Failed to refresh logs: ${logsRes?.error || 'Unknown error'}`, 'error');
            }
        } catch (e) {
            console.warn('[LlamaServer] Failed to refresh logs:', e);
            if (!silent) {
                this.log(`Failed to refresh logs: ${e.message || e}`, 'error');
            }
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = originalLabel || 'Refresh';
            }
        }
    }
}

class UnifiedMcpServerRenderer {
    constructor() {
        this.isRunning = false;
        this.host = '127.0.0.1';
        this.port = 3000;
        this.startTime = null;
        this.uptimeInterval = null;
        this.enabledTools = {
            wiki: true,
            webSearch: true,
            duckduckgo: true,
            tavily: true,
            news: true
        };
    }

    init() {
        this.setupEventListeners();
        this.setupIPCListeners();
        this.loadSettings();
        this.loadRuntimeState();
        this.updateEndpointDisplay();
        this.updateToolSummary();
        this.switchMcpTab('config');
    }

    setupEventListeners() {
        document.querySelectorAll('.mcp-tab').forEach((tab) => {
            tab.addEventListener('click', () => this.switchMcpTab(tab.dataset.mcpTab));
        });
        document.getElementById('btn-start-mcp')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.startServer();
        });
        document.getElementById('btn-stop-mcp')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.stopServer();
        });
        document.getElementById('btn-copy-mcp-http')?.addEventListener('click', () => this.copyEndpoint('http'));
        document.getElementById('btn-copy-mcp-sse')?.addEventListener('click', () => this.copyEndpoint('sse'));

        const hostInput = document.getElementById('mcp-host');
        const portInput = document.getElementById('mcp-port');
        hostInput?.addEventListener('input', () => {
            this.host = hostInput.value.trim() || '127.0.0.1';
            this.saveSettings();
            this.updateEndpointDisplay();
        });
        portInput?.addEventListener('input', () => {
            const nextPort = Number(portInput.value);
            this.port = Number.isFinite(nextPort) ? nextPort : 3000;
            this.saveSettings();
            this.updateEndpointDisplay();
        });

        [
            ['mcp-tool-wiki', 'wiki'],
            ['mcp-tool-web-search', 'webSearch'],
            ['mcp-tool-ddg', 'duckduckgo'],
            ['mcp-tool-tavily', 'tavily'],
            ['mcp-tool-news', 'news']
        ].forEach(([id, key]) => {
            const input = document.getElementById(id);
            input?.addEventListener('change', () => {
                this.enabledTools[key] = !!input.checked;
                this.saveSettings();
                this.updateToolSummary();
            });
        });
    }

    setupIPCListeners() {
        if (!window.browserAPI?.mcp) return;
        window.browserAPI.mcp.onOutput((data) => {
            const type = data.type === 'stderr' ? 'warning' : (data.type === 'error' ? 'error' : 'info');
            String(data.data || '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .forEach((line) => this.log(line, type));
            if (data.type === 'stdout' && data.data.includes('listening at')) {
                this.setStatus('online');
            }
        });
        window.browserAPI.mcp.onExit((data) => {
            this.log(`Server exited with code: ${data.code}`, 'error');
            this.applyStoppedState();
        });
    }

    switchMcpTab(tabName) {
        if (!tabName) return;
        document.querySelectorAll('.mcp-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.mcpTab === tabName);
        });
        document.querySelectorAll('.mcp-tab-content').forEach((content) => {
            content.classList.toggle('active', content.id === `mcp-tab-${tabName}`);
        });
    }

    getEnabledToolEntries() {
        return Object.entries(this.enabledTools).filter(([, enabled]) => enabled);
    }

    updateToolSummary() {
        const toolInputMap = {
            'mcp-tool-wiki': 'wiki',
            'mcp-tool-web-search': 'webSearch',
            'mcp-tool-ddg': 'duckduckgo',
            'mcp-tool-tavily': 'tavily',
            'mcp-tool-news': 'news'
        };
        Object.entries(toolInputMap).forEach(([id, key]) => {
            const input = document.getElementById(id);
            if (input) input.checked = !!this.enabledTools[key];
        });

        const names = this.getEnabledToolEntries().map(([key]) => {
            if (key === 'webSearch') return 'Web Search';
            if (key === 'duckduckgo') return 'DuckDuckGo';
            return key.charAt(0).toUpperCase() + key.slice(1);
        });
        const count = names.length;
        const summary = count > 0
            ? `${count} tool groups enabled: ${names.join(', ')}.`
            : 'No tool groups enabled. Turn on at least one tool before starting the server.';
        const countLabel = `${count} ${count === 1 ? 'group' : 'groups'}`;

        const badgeEl = document.getElementById('mcp-enabled-count-badge');
        const runtimeEl = document.getElementById('mcp-enabled-tools-runtime');
        if (badgeEl) badgeEl.textContent = `${count} Enabled`;
        if (runtimeEl) runtimeEl.textContent = countLabel;
    }

    updateEndpointDisplay() {
        const base = `http://${this.host}:${this.port}`;
        const hostInput = document.getElementById('mcp-host');
        const portInput = document.getElementById('mcp-port');
        const hostDisplay = document.getElementById('mcp-host-display');
        const portDisplay = document.getElementById('mcp-port-display');
        const httpEl = document.getElementById('mcp-endpoint-http');
        const sseEl = document.getElementById('mcp-endpoint-sse');
        const runtimeEndpointEl = document.getElementById('mcp-runtime-endpoint');

        if (hostInput && hostInput.value !== this.host) hostInput.value = this.host;
        if (portInput && portInput.value !== String(this.port)) portInput.value = String(this.port);
        if (hostDisplay) hostDisplay.textContent = this.host;
        if (portDisplay) portDisplay.textContent = String(this.port);
        if (httpEl) httpEl.textContent = `${base}/mcp`;
        if (sseEl) sseEl.textContent = `${base}/sse`;
        if (runtimeEndpointEl) runtimeEndpointEl.textContent = `${base}/mcp`;
    }

    async copyEndpoint(type) {
        const endpoint = `http://${this.host}:${this.port}/${type === 'sse' ? 'sse' : 'mcp'}`;
        try {
            await navigator.clipboard.writeText(endpoint);
            this.log(`Copied ${endpoint}`, 'success');
        } catch (_) {
            this.log('Failed to copy endpoint.', 'error');
        }
    }

    async startServer() {
        if (this.isRunning) {
            this.log('MCP server is already running.', 'warning');
            return;
        }
        if (!window.browserAPI?.mcp) {
            this.log('MCP API not available.', 'error');
            return;
        }
        if (this.getEnabledToolEntries().length === 0) {
            this.log('Enable at least one MCP tool before starting the server.', 'warning');
            this.switchMcpTab('config');
            return;
        }

        const startBtn = document.getElementById('btn-start-mcp');
        const stopBtn = document.getElementById('btn-stop-mcp');
        this.setStatus('starting');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Starting...';
        }

        try {
            const result = await window.browserAPI.mcp.startServer({
                host: this.host,
                port: this.port,
                enabledTools: this.enabledTools
            });
            if (!result?.success) {
                this.setStatus('offline');
                this.log(result?.error || 'Failed to start MCP server.', 'error');
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.textContent = 'Start Server';
                }
                return;
            }
            this.isRunning = true;
            this.startTime = Date.now();
            this.setStatus('online');
            this.startUptimeCounter();
            this.log(`Unified MCP server started with ${this.getEnabledToolEntries().length} tool groups.`, 'success');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.style.opacity = '0.5';
                startBtn.textContent = 'Start Server';
            }
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.style.opacity = '1';
            }
        } catch (error) {
            this.setStatus('offline');
            this.log(error?.message || String(error), 'error');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = 'Start Server';
            }
        }
    }

    async stopServer() {
        if (!this.isRunning || !window.browserAPI?.mcp) return;
        const stopBtn = document.getElementById('btn-stop-mcp');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.textContent = 'Stopping...';
        }
        try {
            const result = await window.browserAPI.mcp.stopServer();
            if (!result?.success) {
                this.log(result?.error || 'Failed to stop MCP server.', 'error');
                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.textContent = 'Stop Server';
                }
                return;
            }
            this.log('Unified MCP server stopped.', 'success');
            this.applyStoppedState();
        } catch (error) {
            this.log(error?.message || String(error), 'error');
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.textContent = 'Stop Server';
            }
        }
    }

    applyStoppedState() {
        this.isRunning = false;
        this.setStatus('offline');
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
            this.uptimeInterval = null;
        }
        const startBtn = document.getElementById('btn-start-mcp');
        const stopBtn = document.getElementById('btn-stop-mcp');
        const uptimeEl = document.getElementById('mcp-uptime');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            startBtn.textContent = 'Start Server';
        }
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.style.opacity = '0.5';
            stopBtn.textContent = 'Stop Server';
        }
        if (uptimeEl) uptimeEl.textContent = '00:00:00';
    }

    setStatus(status) {
        updateMcpRuntimeStatus('mcp-status-text', status);
    }

    log(message, type = 'info', source = 'MCP') {
        const output = document.getElementById('mcp-terminal-output');
        if (!output) return;
        appendTerminalLine(output, {
            type,
            message,
            source,
            ts: Date.now()
        });
    }

    clearConsole() {
        const output = document.getElementById('mcp-terminal-output');
        if (!output) return;
        output.innerHTML = `
            <div class="terminal-line empty info">
                <span class="terminal-line-message">Console cleared. New MCP server output will appear here.</span>
            </div>
        `;
    }

    startUptimeCounter() {
        if (this.uptimeInterval) clearInterval(this.uptimeInterval);
        this.uptimeInterval = setInterval(() => {
            const uptime = Date.now() - this.startTime;
            const hours = Math.floor(uptime / 3600000).toString().padStart(2, '0');
            const minutes = Math.floor((uptime % 3600000) / 60000).toString().padStart(2, '0');
            const seconds = Math.floor((uptime % 60000) / 1000).toString().padStart(2, '0');
            const uptimeEl = document.getElementById('mcp-uptime');
            if (uptimeEl) uptimeEl.textContent = `${hours}:${minutes}:${seconds}`;
        }, 1000);
    }

    saveSettings() {
        try {
            localStorage.setItem('mcp-server-settings', JSON.stringify({
                host: this.host,
                port: this.port,
                enabledTools: this.enabledTools
            }));
        } catch (e) {
            console.error('[MCP] Failed to save settings:', e);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('mcp-server-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.host = settings.host || this.host;
                this.port = Number(settings.port) || this.port;
                this.enabledTools = { ...this.enabledTools, ...(settings.enabledTools || {}) };
            }
            this.updateEndpointDisplay();
            this.updateToolSummary();
        } catch (e) {
            console.error('[MCP] Failed to load settings:', e);
        }
    }

    async loadRuntimeState() {
        if (!window.browserAPI?.servers) return;
        try {
            const statusRes = await window.browserAPI.servers.getStatus('mcp');
            if (statusRes?.success && statusRes.status?.config?.enabledTools) {
                this.enabledTools = { ...this.enabledTools, ...statusRes.status.config.enabledTools };
            }
            if (statusRes?.success && statusRes.status?.running) {
                const status = statusRes.status;
                this.isRunning = true;
                this.startTime = status.startedAt || Date.now();
                if (status.config?.host) this.host = status.config.host;
                if (status.config?.port) this.port = Number(status.config.port) || this.port;
                this.setStatus('online');
                this.startUptimeCounter();
                const startBtn = document.getElementById('btn-start-mcp');
                const stopBtn = document.getElementById('btn-stop-mcp');
                if (startBtn) {
                    startBtn.disabled = true;
                    startBtn.style.opacity = '0.5';
                }
                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.style.opacity = '1';
                }
            }
            this.updateEndpointDisplay();
            this.updateToolSummary();

            const logsRes = await window.browserAPI.servers.getLogs('mcp');
            if (logsRes?.success) {
                const output = document.getElementById('mcp-terminal-output');
                hydrateLogOutput(output, (logsRes.logs || []).map((entry) => ({ ...entry, source: 'MCP' })));
            }
        } catch (e) {
            console.warn('[MCP] Failed to load runtime state:', e);
        }
    }
}

class PocketTTSRenderer {
    constructor() {
        this.pocketttsProcess = null;
        this.isPocketttsRunning = false;
        this.pocketttsPath = null;
        this.startTime = null;
        this.uptimeInterval = null;
        console.log('[PocketTTS] Constructor called');
    }

    init() {
        console.log('[PocketTTS] Initializing...');
        this.setupEventListeners();
        this.setupIPCListeners();
        this.loadSettings();
        console.log('[PocketTTS] Initialization complete');
    }

    setupIPCListeners() {
        if (window.browserAPI && window.browserAPI.pocketTTS) {
            window.browserAPI.pocketTTS.onOutput((data) => {
                if (data.type === 'stdout') {
                    const lines = data.data.trim().split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            this.log(line, 'info');
                            // Check if server has actually started
                            if (line.includes('Application startup complete') || line.includes('Uvicorn running on')) {
                                if (!this.isPocketttsRunning) {
                                    this.isPocketttsRunning = true;
                                    this.setStatus('online');
                                    this.startUptimeCounter();
                                    // Update buttons
                                    const startBtn = document.getElementById('btn-start-pockettts');
                                    const stopBtn = document.getElementById('btn-stop-pockettts');
                                    if (startBtn) {
                                        startBtn.disabled = true;
                                        startBtn.style.opacity = '0.5';
                                    }
                                    if (stopBtn) {
                                        stopBtn.disabled = false;
                                        stopBtn.style.opacity = '1';
                                    }
                                }
                            }
                        }
                    });
                } else if (data.type === 'stderr') {
                    const lines = data.data.trim().split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            this.log(line, 'warning');
                        }
                    });
                } else if (data.type === 'error') {
                    this.log(data.data, 'error');
                }
            });

            window.browserAPI.pocketTTS.onExit((data) => {
                this.log(`Server exited with code: ${data.code}`, 'error');
                this.isPocketttsRunning = false;
                this.setStatus('offline');
                if (this.uptimeInterval) {
                    clearInterval(this.uptimeInterval);
                    this.uptimeInterval = null;
                }
                const startBtn = document.getElementById('btn-start-pockettts');
                const stopBtn = document.getElementById('btn-stop-pockettts');
                if (startBtn) startBtn.disabled = false;
                if (stopBtn) {
                    stopBtn.disabled = true;
                    stopBtn.textContent = 'Stop';
                }
            });
        }
    }

    setupEventListeners() {
        console.log('[PocketTTS] Setting up event listeners...');

        // Local server controls
        const browsePocketttsBtn = document.getElementById('btn-browse-pockettts');
        const startPocketttsBtn = document.getElementById('btn-start-pockettts');
        const stopPocketttsBtn = document.getElementById('btn-stop-pockettts');
        const clearPocketttsBtn = document.getElementById('btn-clear-pockettts');

        if (browsePocketttsBtn) {
            browsePocketttsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForPocketttsExecutable();
            });
        }

        if (startPocketttsBtn) {
            startPocketttsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startPocketttsServer();
            });
        }

        if (stopPocketttsBtn) {
            stopPocketttsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stopPocketttsServer();
            });
        }

        if (clearPocketttsBtn) {
            clearPocketttsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearTerminal();
            });
        }

        // Save settings on path change
        const pocketttsPathInput = document.getElementById('pockettts-server-path');
        if (pocketttsPathInput) {
            pocketttsPathInput.addEventListener('change', () => this.saveSettings());
        }

        // Command input handler
        const commandInput = document.getElementById('pockettts-command-input');
        if (commandInput) {
            commandInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.isPocketttsRunning) {
                    const command = commandInput.value.trim();
                    if (command) {
                        this.log(`> ${command}`, 'command');
                        this.sendCommand(command);
                        commandInput.value = '';
                    }
                }
            });
        }

        console.log('[PocketTTS] Event listeners setup complete');
    }

    async sendCommand(command) {
        console.log('[PocketTTS] Sending command:', command);
        
        if (window.browserAPI && window.browserAPI.pocketTTS) {
            try {
                // Note: pocketTTS doesn't support commands, but we can log it
                this.log(`Command not supported by Pocket TTS: ${command}`, 'warning');
            } catch (err) {
                console.error('[PocketTTS] Error:', err);
                this.log(`Error: ${err.message || err}`, 'error');
            }
        } else {
            this.log('Pocket TTS API not available', 'error');
        }
    }

    async browseForPocketttsExecutable() {
        console.log('[PocketTTS] browseForPocketttsExecutable called');

        if (window.browserAPI && window.browserAPI.files) {
            try {
                const filters = [
                    { name: 'Executable', extensions: ['exe'] },
                    { name: 'All Files', extensions: ['*'] }
                ];
                const filePath = await window.browserAPI.files.selectFile(filters);

                if (filePath) {
                    const pathInput = document.getElementById('pockettts-server-path');
                    const currentPathEl = document.getElementById('pockettts-current-path');
                    if (pathInput) {
                        pathInput.value = filePath;
                    }
                    this.pocketttsPath = filePath;
                    if (currentPathEl) {
                        currentPathEl.textContent = filePath;
                    }
                    this.saveSettings();
                    this.log(`Pocket TTS executable selected: ${filePath}`, 'info');
                }
            } catch (err) {
                console.error('[PocketTTS] Dialog error:', err);
                this.showPathPrompt();
            }
        } else {
            this.showPathPrompt();
        }
    }

    showPathPrompt() {
        const path = prompt('Enter the path to pocket-tts.exe:', 'C:\\pocket-tts\\pocket-tts.exe');
        if (path) {
            const pathInput = document.getElementById('pockettts-server-path');
            const currentPathEl = document.getElementById('pockettts-current-path');
            if (pathInput) {
                pathInput.value = path;
            }
            this.pocketttsPath = path;
            if (currentPathEl) {
                currentPathEl.textContent = path;
            }
            this.saveSettings();
        }
    }

    async startPocketttsServer() {
        if (!this.pocketttsPath) {
            this.log('Please select the Pocket TTS executable first', 'error');
            return;
        }

        this.log('Starting Pocket TTS Server...', 'info');
        this.setStatus('starting');

        const startBtn = document.getElementById('btn-start-pockettts');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Starting...';
        }

        if (window.browserAPI && window.browserAPI.pocketTTS) {
            try {
                const result = await window.browserAPI.pocketTTS.startServer({
                    executable: this.pocketttsPath
                });
                if (result.success) {
                    this.isPocketttsRunning = true;
                    this.startTime = Date.now();
                    this.setStatus('online');
                    this.log('Pocket TTS server started!', 'success');
                    this.startUptimeCounter();

                    const startBtn = document.getElementById('btn-start-pockettts');
                    const stopBtn = document.getElementById('btn-stop-pockettts');
                    const cmdInput = document.getElementById('pockettts-command-input');
                    
                    if (startBtn) {
                        startBtn.disabled = true;
                        startBtn.style.opacity = '0.5';
                    }
                    if (stopBtn) {
                        stopBtn.disabled = false;
                        stopBtn.style.opacity = '1';
                    }
                    
                    if (cmdInput) {
                        cmdInput.readOnly = false;
                        cmdInput.placeholder = 'Type command and press Enter...';
                        cmdInput.style.color = 'var(--text)';
                        cmdInput.focus();
                    }

                    document.getElementById('pockettts-current-path').textContent = this.pocketttsPath;
                } else {
                    this.log(`Failed to start: ${result.error}`, 'error');
                    this.setStatus('offline');
                    const startBtn = document.getElementById('btn-start-pockettts');
                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.textContent = 'Start';
                    }
                }
            } catch (err) {
                this.log(`Error: ${err.message || err}`, 'error');
                this.setStatus('offline');
                const startBtn = document.getElementById('btn-start-pockettts');
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.textContent = 'Start';
                }
            }
        } else {
            this.log('Pocket TTS API not available', 'error');
            this.setStatus('offline');
            const startBtn = document.getElementById('btn-start-pockettts');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = 'Start';
            }
        }
    }

    async stopPocketttsServer() {
        console.log('[PocketTTS] stopPocketttsServer called');

        if (!this.isPocketttsRunning) {
            this.log('Pocket TTS server is not running.', 'warning');
            return;
        }

        this.log('Stopping Pocket TTS server...', 'info');

        const stopBtn = document.getElementById('btn-stop-pockettts');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.textContent = 'Stopping...';
        }

        if (window.browserAPI && window.browserAPI.pocketTTS) {
            try {
                const result = await window.browserAPI.pocketTTS.stopServer();

                if (result.success) {
                    this.isPocketttsRunning = false;
                    if (this.uptimeInterval) {
                        clearInterval(this.uptimeInterval);
                        this.uptimeInterval = null;
                    }
                    this.log('Pocket TTS server stopped.', 'success');
                    this.setStatus('offline');

                    const startBtn = document.getElementById('btn-start-pockettts');
                    const stopBtn = document.getElementById('btn-stop-pockettts');
                    const cmdInput = document.getElementById('pockettts-command-input');
                    
                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.style.opacity = '1';
                    }
                    if (stopBtn) {
                        stopBtn.disabled = true;
                        stopBtn.style.opacity = '0.5';
                    }
                    
                    // Keep command input editable for quick retries
                    if (cmdInput) {
                        cmdInput.readOnly = false;
                        cmdInput.placeholder = 'Type command and press Enter...';
                        cmdInput.style.color = 'var(--text)';
                        cmdInput.value = '';
                    }
                    
                    // Reset status metrics
                    const uptimeEl = document.getElementById('pockettts-uptime');
                    if (uptimeEl) uptimeEl.textContent = '00:00:00';
                } else {
                    this.log(`Failed to stop server: ${result.error}`, 'error');
                    const stopBtn = document.getElementById('btn-stop-pockettts');
                    if (stopBtn) {
                        stopBtn.disabled = false;
                        stopBtn.textContent = 'Stop';
                    }
                }
            } catch (err) {
                console.error('[PocketTTS] Error stopping server:', err);
                this.log(`Error stopping server: ${err.message || err}`, 'error');
                const stopBtn = document.getElementById('btn-stop-pockettts');
                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.textContent = 'Stop';
                }
            }
        }
    }

    setStatus(status) {
        const colors = {
            offline: 'var(--danger)',
            starting: 'var(--warning)',
            online: 'var(--success)'
        };
        const labels = {
            offline: 'Offline',
            starting: 'Starting...',
            online: 'Online'
        };
        
        // Update simplified status indicator
        const statusIndicator = document.getElementById('pockettts-status-indicator');
        const statusText = document.getElementById('pockettts-status-text');
        const infoStatus = document.getElementById('pockettts-info-status');
        
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator';
            if (status === 'online') statusIndicator.classList.add('online');
            if (status === 'starting') statusIndicator.classList.add('starting');
        }
        
        if (statusText) {
            statusText.textContent = `Server ${labels[status]}`;
        }

        if (infoStatus) {
            infoStatus.textContent = labels[status];
        }
    }

    log(message, type = 'info') {
        const output = document.getElementById('pockettts-terminal-output');
        if (!output) return;

        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        line.textContent = `[${timestamp}] ${message}`;
        output.appendChild(line);
        
        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            output.scrollTop = output.scrollHeight;
        });

        // Limit lines to prevent memory issues
        while (output.children.length > 1000) {
            output.removeChild(output.firstChild);
        }
    }

    clearTerminal() {
        const output = document.getElementById('pockettts-terminal-output');
        if (output) {
            output.innerHTML = '<div class="terminal-line info">Terminal cleared.</div>';
        }
    }

    startUptimeCounter() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
        }
        this.uptimeInterval = setInterval(() => {
            const uptime = Date.now() - this.startTime;
            const hours = Math.floor(uptime / 3600000).toString().padStart(2, '0');
            const minutes = Math.floor((uptime % 3600000) / 60000).toString().padStart(2, '0');
            const seconds = Math.floor((uptime % 60000) / 1000).toString().padStart(2, '0');
            const uptimeEl = document.getElementById('pockettts-uptime');
            if (uptimeEl) {
                uptimeEl.textContent = `${hours}:${minutes}:${seconds}`;
            }
        }, 1000);
    }

    saveSettings() {
        try {
            const settings = {
                pocketttsPath: this.pocketttsPath
            };
            localStorage.setItem('pockettts-server-settings', JSON.stringify(settings));
            console.log('[PocketTTS] Settings saved');
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    loadSettings() {
        console.log('[PocketTTS] loadSettings called');
        try {
            const saved = localStorage.getItem('pockettts-server-settings');
            if (saved) {
                console.log('[PocketTTS] Found saved settings');
                const settings = JSON.parse(saved);

                this.pocketttsPath = settings.pocketttsPath;
                console.log('[PocketTTS] Loaded pocketttsPath:', this.pocketttsPath);

                const pathInput = document.getElementById('pockettts-server-path');
                const currentPathEl = document.getElementById('pockettts-current-path');
                if (pathInput && this.pocketttsPath) {
                    pathInput.value = this.pocketttsPath;
                    console.log('[PocketTTS] Set path input value');
                }
                if (currentPathEl && this.pocketttsPath) {
                    currentPathEl.textContent = this.pocketttsPath;
                    console.log('[PocketTTS] Set current path display');
                }
            } else {
                console.log('[PocketTTS] No saved settings found');
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

// Initialize when DOM is ready
console.log('[Minecraft] Script loaded, waiting for DOM...');

function initMinecraft() {
    console.log('[Minecraft] DOM ready, creating instance...');
    try {
        window.minecraftRenderer = new MinecraftRenderer();
        window.minecraftRenderer.init();
        console.log('[Minecraft] Successfully initialized');
    } catch (err) {
        console.error('[Minecraft] Initialization error:', err);
    }

    try {
        window.llamaServerRenderer = new LlamaServerRenderer();
        window.llamaServerRenderer.init();
        console.log('[LlamaServer] Successfully initialized');
    } catch (err) {
        console.error('[LlamaServer] Initialization error:', err);
    }
if (document.getElementById('panel-pocket-tts')) {
        try {
            window.pocketTTSRenderer = new PocketTTSRenderer();
            window.pocketTTSRenderer.init();
            console.log('[PocketTTS] Successfully initialized');
        } catch (err) {
            console.error('[PocketTTS] Initialization error:', err);
        }
    }

    if (document.getElementById('panel-mcp')) {
        try {
            window.mcpServerRenderer = new UnifiedMcpServerRenderer();
            window.mcpServerRenderer.init();
            console.log('[MCP] Successfully initialized');
        } catch (err) {
            console.error('[MCP] Initialization error:', err);
        }
    }

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMinecraft);
} else {
    initMinecraft();
}







