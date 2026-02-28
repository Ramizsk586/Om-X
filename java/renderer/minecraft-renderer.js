/**
  * Minecraft Panel Renderer
  * Manages the Minecraft Bedrock server and AI player
  */

class MinecraftRenderer {
    constructor() {
        this.initialized = false;
        console.log('[Minecraft] Constructor called');
    }

    async init() {
        console.log('[Minecraft] Initializing...');
        console.log('[Minecraft] window.browserAPI available:', !!window.browserAPI);
        console.log('[Minecraft] window.browserAPI.mineflayerBot available:', !!(window.browserAPI && window.browserAPI.mineflayerBot));
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
        
        // Navigation
        const navItems = document.querySelectorAll('.nav-item');
        console.log(`[Minecraft] Found ${navItems.length} nav items`);
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                console.log(`[Minecraft] Nav clicked: ${item.dataset.panel}`);
                this.switchPanel(item.dataset.panel);
            });
        });

        console.log('[Minecraft] Event listeners setup complete');
    }

    switchPanel(panelName) {
        console.log(`[Minecraft] Switching to panel: ${panelName}`);
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.panel === panelName);
        });

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
        this.modelsPath = null;
        this.selectedModel = null;
        this.startTime = null;
        this.uptimeInterval = null;
        this.initialized = false;
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
                if (data.type === 'stdout') {
                    const lines = data.data.trim().split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            this.log(line, 'info');
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

            window.browserAPI.llama.onExit((data) => {
                this.log(`Server exited with code: ${data.code}`, 'error');
                this.isRunning = false;
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
            });
        }
    }

    setupEventListeners() {
        console.log('[LlamaServer] Setting up event listeners...');

        // Tab switching
        const llamaTabs = document.querySelectorAll('.llama-tab');
        llamaTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.llamaTab;
                this.switchLlamaTab(tabName);
            });
        });

        const browseLlamaBtn = document.getElementById('btn-browse-llama');
        const browseModelsBtn = document.getElementById('btn-browse-models');
        const scanModelsBtn = document.getElementById('btn-scan-models');
        const modelSelect = document.getElementById('model-select');
        const startLlamaBtn = document.getElementById('btn-start-llama');
        const stopLlamaBtn = document.getElementById('btn-stop-llama');
        const clearLlamaBtn = document.getElementById('btn-clear-llama');
        const commandInput = document.getElementById('llama-command-input');

        if (browseLlamaBtn) {
            browseLlamaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForLlamaExecutable();
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

        if (clearLlamaBtn) {
            clearLlamaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearTerminal();
            });
        }

        // Command input handler
        if (commandInput) {
            commandInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.isRunning) {
                    const command = commandInput.value.trim();
                    if (command) {
                        this.log(`> ${command}`, 'command');
                        this.sendCommand(command);
                        commandInput.value = '';
                    }
                }
            });
        }

        const inputs = ['context-length', 'gpu-layers', 'llama-port', 'llama-threads', 'llama-host'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => this.saveSettings());
                input.addEventListener('input', () => {
                    this.updateManualCommand();
                    // Update status bar endpoint when port or host changes
                    if (id === 'llama-port' || id === 'llama-host') {
                        const port = document.getElementById('llama-port')?.value || '8080';
                        const host = document.getElementById('llama-host')?.value || '127.0.0.1';
                        const displayHost = host === '0.0.0.0' ? '0.0.0.0' : 'localhost';
                        const endpointEl = document.getElementById('llama-status-endpoint');
                        if (endpointEl) {
                            endpointEl.textContent = `http://${displayHost}:${port}`;
                        }
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

    switchLlamaTab(tabName) {
        console.log(`[LlamaServer] Switching to tab: ${tabName}`);
        
        // Update tab buttons
        document.querySelectorAll('.llama-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.llamaTab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.llama-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `llama-tab-${tabName}`);
        });
    }

    async sendCommand(command) {
        console.log('[LlamaServer] Sending command:', command);
        
        if (window.browserAPI && window.browserAPI.llama) {
            try {
                const result = await window.browserAPI.llama.sendCommand(command);
                if (result.success) {
                    console.log('[LlamaServer] Command sent successfully');
                } else {
                    this.log(`Failed to send command: ${result.error}`, 'error');
                }
            } catch (err) {
                console.error('[LlamaServer] Error sending command:', err);
                this.log(`Error sending command: ${err.message || err}`, 'error');
            }
        } else {
            this.log('Llama API not available - command not sent', 'error');
        }
    }

    generateManualCommand() {
        if (!this.llamaPath) {
            return 'Configure server executable and model to generate command...';
        }

        const modelPath = this.selectedModel ? `${this.modelsPath}\\${this.selectedModel}` : 'path\\to\\model.gguf';
        const contextLength = document.getElementById('context-length')?.value || '4096';
        const gpuLayers = document.getElementById('gpu-layers')?.value || '-1';
        const port = document.getElementById('llama-port')?.value || '8080';
        const threads = document.getElementById('llama-threads')?.value || '4';
        const host = document.getElementById('llama-host')?.value || '127.0.0.1';

        return `"${this.llamaPath}" -m "${modelPath}" -c ${contextLength} -ngl ${gpuLayers} --port ${port} -t ${threads} --host ${host}`;
    }

    updateManualCommand() {
        const commandEl = document.getElementById('llama-manual-command');
        if (commandEl) {
            commandEl.textContent = this.generateManualCommand();
        }
    }

    copyLlamaCommand() {
        const command = this.generateManualCommand();
        if (command && !command.includes('Configure server executable')) {
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
        const placeholder = type === 'llama' ? 'C:\\llama.cpp\\llama-server.exe' : 'C:\\llama.cpp\\models';
        const userPath = prompt(`Enter the path to ${type === 'llama' ? 'llama-server.exe' : 'models folder'}:`, placeholder);
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
            } else {
                const pathInput = document.getElementById('models-path-input');
                if (pathInput) {
                    pathInput.value = userPath;
                    this.modelsPath = userPath;
                }
            }
            this.saveSettings();
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
        const host = document.getElementById('llama-host')?.value || '127.0.0.1';

        this.log('Starting Llama Server...', 'info');
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
                    host
                });

                if (result.success) {
                    this.isRunning = true;
                    this.startTime = Date.now();
                    this.setStatus('online');
                    this.log('Llama server started successfully!', 'success');
                    const accessMsg = host === '0.0.0.0' ? 'accessible from network' : 'local only';
                    this.log(`Server listening on http://${host === '0.0.0.0' ? '0.0.0.0' : 'localhost'}:${port} (${accessMsg})`, 'info');
                    this.log(`API endpoint: http://${host === '0.0.0.0' ? '0.0.0.0' : 'localhost'}:${port}/v1/chat/completions`, 'info');
                    this.startUptimeCounter();
                    this.updateEndpoint(port, host);

                    // Update status bar
                    const modelEl = document.getElementById('llama-status-model');
                    if (modelEl) modelEl.textContent = `Model: ${this.selectedModel}`;
                    
                    const cmdInput = document.getElementById('llama-command-input');
                    if (cmdInput) {
                        cmdInput.readOnly = false;
                        cmdInput.focus();
                    }
                } else {
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
                this.log(`Error starting server: ${err.message || err}`, 'error');
                this.setStatus('offline');
                const startBtn = document.getElementById('btn-start-llama');
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.textContent = 'Start Server';
                }
            }
        } else {
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
                } else {
                    this.log(`Failed to stop server: ${result.error}`, 'error');
                    const stopBtn = document.getElementById('btn-stop-llama');
                    if (stopBtn) {
                        stopBtn.disabled = false;
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
        const output = document.getElementById('llama-terminal-output');
        if (!output) {
            console.log(`[LlamaServer] ${message}`);
            return;
        }

        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;

        const timestamp = new Date().toLocaleTimeString();
        line.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;

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
        console.log('[LlamaServer] clearTerminal called');
        const output = document.getElementById('llama-terminal-output');
        if (output) {
            output.innerHTML = '';
            this.log('Terminal cleared', 'info');
        }
    }

    setStatus(status) {
        const statusDot = document.getElementById('llama-status-dot');
        const statusLabel = document.getElementById('llama-status-label');
        const commandInput = document.getElementById('llama-command-input');
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

        // Enable/disable command input based on status
        if (commandInput) {
            if (status === 'online') {
                commandInput.readOnly = false;
                commandInput.placeholder = 'Type command and press Enter...';
                commandInput.style.color = 'var(--text)';
            } else {
                commandInput.readOnly = true;
                commandInput.placeholder = 'Type command and press Enter...';
                commandInput.style.color = 'var(--text-dim)';
            }
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

    updateEndpoint(port, host) {
        const endpointEl = document.getElementById('llama-status-endpoint');
        if (endpointEl) {
            const displayHost = host === '0.0.0.0' ? '0.0.0.0' : 'localhost';
            endpointEl.textContent = `http://${displayHost}:${port}`;
        }
    }

    saveSettings() {
        try {
            const settings = {
                llamaPath: this.llamaPath,
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

            // Update status bar endpoint
            const port = settings.port || '8080';
            const host = settings.host || '127.0.0.1';
            const displayHost = host === '0.0.0.0' ? '0.0.0.0' : 'localhost';
            const endpointEl = document.getElementById('llama-status-endpoint');
            if (endpointEl) {
                endpointEl.textContent = `http://${displayHost}:${port}`;
            }
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
                this.modelsPath = settings.modelsPath;
                this.selectedModel = settings.selectedModel;

                const pathInput = document.getElementById('llama-path-input');
                if (pathInput && this.llamaPath) pathInput.value = this.llamaPath;

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

                if (settings.host) {
                    const input = document.getElementById('llama-host');
                    if (input) input.value = settings.host;
                }
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

/**
 * Server Renderer
 * Manages Cloud and Local Minecraft Bedrock servers
 */
class ServerRenderer {
    constructor() {
        this.bedrockProcess = null;
        this.isBedrockRunning = false;
        this.bedrockPath = null;
        this.startTime = null;
        this.uptimeInterval = null;
        this.currentTab = 'cloud';
        console.log('[ServerRenderer] Constructor called');
    }

    init() {
        console.log('[ServerRenderer] Initializing...');
        this.setupEventListeners();
        this.setupIPCListeners();
        this.loadSettings();
        
        // Ensure correct tab is shown on init
        this.switchTab(this.currentTab);
        
        console.log('[ServerRenderer] Initialization complete');
    }

    setupIPCListeners() {
        if (window.browserAPI && window.browserAPI.bedrockServer) {
            window.browserAPI.bedrockServer.onOutput((data) => {
                if (data.type === 'stdout') {
                    const lines = data.data.trim().split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            this.log(line, 'info');
                            // Check if server has actually started
                            if (line.includes('Server started') || line.includes('IPv4 supported, port:')) {
                                if (!this.isBedrockRunning) {
                                    this.isBedrockRunning = true;
                                    this.setStatus('online');
                                    this.startUptimeCounter();
                                    // Update buttons
                                    const startBtn = document.getElementById('btn-start-bedrock');
                                    const stopBtn = document.getElementById('btn-stop-bedrock');
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

            window.browserAPI.bedrockServer.onExit((data) => {
                this.log(`Server exited with code: ${data.code}`, 'error');
                this.isBedrockRunning = false;
                this.setStatus('offline');
                if (this.uptimeInterval) {
                    clearInterval(this.uptimeInterval);
                    this.uptimeInterval = null;
                }
                const startBtn = document.getElementById('btn-start-bedrock');
                const stopBtn = document.getElementById('btn-stop-bedrock');
                if (startBtn) startBtn.disabled = false;
                if (stopBtn) {
                    stopBtn.disabled = true;
                    stopBtn.textContent = 'Stop Server';
                }
            });
        }
    }

    setupEventListeners() {
        console.log('[ServerRenderer] Setting up event listeners...');

        // Server tabs - scoped to panel-server only
        const serverPanel = document.getElementById('panel-server');
        if (serverPanel) {
            const serverTabs = serverPanel.querySelectorAll('.server-tab[data-tab]');
            serverTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const tabName = tab.dataset.tab;
                    this.switchTab(tabName);
                });
            });
        }

        // Cloud provider cards - handle link clicks to open in new tab
        const cloudProviderCards = document.querySelectorAll('.cloud-provider-card');
        cloudProviderCards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const url = card.getAttribute('href');
                if (url && window.browserAPI) {
                    console.log('[ServerRenderer] Opening cloud provider:', url);
                    window.browserAPI.openTab(url);
                } else if (url) {
                    // Fallback to regular window.open if browserAPI not available
                    window.open(url, '_blank');
                }
            });
        });

        // Local server controls
        const browseBedrockBtn = document.getElementById('btn-browse-bedrock');
        const startBedrockBtn = document.getElementById('btn-start-bedrock');
        const stopBedrockBtn = document.getElementById('btn-stop-bedrock');
        const clearBedrockBtn = document.getElementById('btn-clear-bedrock');

        if (browseBedrockBtn) {
            browseBedrockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForBedrockExecutable();
            });
        }

        if (startBedrockBtn) {
            startBedrockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startBedrockServer();
            });
        }

        if (stopBedrockBtn) {
            stopBedrockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stopBedrockServer();
            });
        }

        if (clearBedrockBtn) {
            clearBedrockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearTerminal();
            });
        }

        // Save settings on path change
        const bedrockPathInput = document.getElementById('bedrock-server-path');
        if (bedrockPathInput) {
            bedrockPathInput.addEventListener('change', () => this.saveSettings());
        }

        // Command input handler
        const commandInput = document.getElementById('bedrock-command-input');
        if (commandInput) {
            commandInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.isBedrockRunning) {
                    const command = commandInput.value.trim();
                    if (command) {
                        this.log(`> ${command}`, 'command');
                        this.sendCommand(command);
                        commandInput.value = '';
                    }
                }
            });
        }

        // Clear button handler
        const clearBtn = document.getElementById('btn-clear-bedrock');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearTerminal();
            });
        }

        console.log('[ServerRenderer] Event listeners setup complete');
    }

    async sendCommand(command) {
        console.log('[ServerRenderer] Sending command:', command);
        
        if (window.browserAPI && window.browserAPI.bedrockServer) {
            try {
                const result = await window.browserAPI.bedrockServer.sendCommand(command);
                if (result.success) {
                    console.log('[ServerRenderer] Command sent successfully');
                } else {
                    this.log(`Failed to send command: ${result.error}`, 'error');
                }
            } catch (err) {
                console.error('[ServerRenderer] Error sending command:', err);
                this.log(`Error sending command: ${err.message || err}`, 'error');
            }
        } else {
            this.log('Bedrock Server API not available - command not sent', 'error');
        }
    }

    switchTab(tabName) {
        console.log(`[ServerRenderer] Switching to tab: ${tabName}`);
        this.currentTab = tabName;

        // Scope to panel-server only
        const serverPanel = document.getElementById('panel-server');
        if (!serverPanel) return;

        // Update tab buttons
        serverPanel.querySelectorAll('.server-tab[data-tab]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        serverPanel.querySelectorAll('.server-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    }

    async browseForBedrockExecutable() {
        console.log('[ServerRenderer] browseForBedrockExecutable called');

        if (window.browserAPI && window.browserAPI.files) {
            try {
                const filters = [
                    { name: 'Executable', extensions: ['exe'] },
                    { name: 'All Files', extensions: ['*'] }
                ];
                const filePath = await window.browserAPI.files.selectFile(filters);

                if (filePath) {
                    const pathInput = document.getElementById('bedrock-server-path');
                    const currentPathEl = document.getElementById('bedrock-current-path');
                    if (pathInput) {
                        pathInput.value = filePath;
                    }
                    this.bedrockPath = filePath;
                    if (currentPathEl) {
                        currentPathEl.textContent = filePath;
                    }
                    this.saveSettings();
                    this.log(`Bedrock server executable selected: ${filePath}`, 'info');
                }
            } catch (err) {
                console.error('[ServerRenderer] Dialog error:', err);
                this.showPathPrompt();
            }
        } else {
            this.showPathPrompt();
        }
    }

    showPathPrompt() {
        const path = prompt('Enter the path to bedrock_server.exe:', 'C:\\bedrock-server\\bedrock_server.exe');
        if (path) {
            const pathInput = document.getElementById('bedrock-server-path');
            const currentPathEl = document.getElementById('bedrock-current-path');
            if (pathInput) {
                pathInput.value = path;
            }
            this.bedrockPath = path;
            if (currentPathEl) {
                currentPathEl.textContent = path;
            }
            this.saveSettings();
        }
    }

    async startBedrockServer() {
        if (!this.bedrockPath) {
            this.log('Please select the bedrock server executable first', 'error');
            return;
        }

        this.log('Starting Bedrock Server...', 'info');
        this.setStatus('starting');

        const startBtn = document.getElementById('btn-start-bedrock');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Starting...';
        }

        if (window.browserAPI && window.browserAPI.bedrockServer) {
            try {
                const result = await window.browserAPI.bedrockServer.startServer({
                    executable: this.bedrockPath
                });
                if (result.success) {
                    this.isBedrockRunning = true;
                    this.startTime = Date.now();
                    this.setStatus('online');
                    this.log('Bedrock server started!', 'success');
                    this.startUptimeCounter();

                    const startBtn = document.getElementById('btn-start-bedrock');
                    const stopBtn = document.getElementById('btn-stop-bedrock');
                    const cmdInput = document.getElementById('bedrock-command-input');
                    
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

                    document.getElementById('bedrock-current-path').textContent = this.bedrockPath;
                    
                    // Reset status metrics
                    const playersEl = document.getElementById('bedrock-players');
                    if (playersEl) playersEl.textContent = '0 / 20';
                } else {
                    this.log(`Failed to start: ${result.error}`, 'error');
                    this.setStatus('offline');
                    const startBtn = document.getElementById('btn-start-bedrock');
                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.textContent = 'Start Server';
                    }
                }
            } catch (err) {
                this.log(`Error: ${err.message || err}`, 'error');
                this.setStatus('offline');
                const startBtn = document.getElementById('btn-start-bedrock');
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.textContent = 'Start Server';
                }
            }
        } else {
            this.log('Bedrock Server API not available', 'error');
            this.setStatus('offline');
            const startBtn = document.getElementById('btn-start-bedrock');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = 'Start Server';
            }
        }
    }

    async stopBedrockServer() {
        console.log('[ServerRenderer] stopBedrockServer called');

        if (!this.isBedrockRunning) {
            this.log('Bedrock server is not running.', 'warning');
            return;
        }

        this.log('Stopping Bedrock server...', 'info');

        const stopBtn = document.getElementById('btn-stop-bedrock');
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.textContent = 'Stopping...';
        }

        if (window.browserAPI && window.browserAPI.bedrockServer) {
            try {
                const result = await window.browserAPI.bedrockServer.stopServer();

                if (result.success) {
                    this.isBedrockRunning = false;
                    if (this.uptimeInterval) {
                        clearInterval(this.uptimeInterval);
                        this.uptimeInterval = null;
                    }
                    this.log('Bedrock server stopped.', 'success');
                    this.setStatus('offline');

                    const startBtn = document.getElementById('btn-start-bedrock');
                    const stopBtn = document.getElementById('btn-stop-bedrock');
                    const cmdInput = document.getElementById('bedrock-command-input');
                    
                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.style.opacity = '1';
                    }
                    if (stopBtn) {
                        stopBtn.disabled = true;
                        stopBtn.style.opacity = '0.5';
                    }
                    
                    // Disable command input when server stops
                    if (cmdInput) {
                        cmdInput.readOnly = true;
                        cmdInput.placeholder = 'Type command and press Enter...';
                        cmdInput.style.color = 'var(--text-dim)';
                        cmdInput.value = '';
                    }
                    
                    // Reset status metrics
                    const uptimeEl = document.getElementById('bedrock-uptime');
                    const playersEl = document.getElementById('bedrock-players');
                    if (uptimeEl) uptimeEl.textContent = '00:00:00';
                    if (playersEl) playersEl.textContent = '0 / 20';
                } else {
                    this.log(`Failed to stop server: ${result.error}`, 'error');
                    const stopBtn = document.getElementById('btn-stop-bedrock');
                    if (stopBtn) {
                        stopBtn.disabled = false;
                        stopBtn.textContent = 'Stop Server';
                    }
                }
            } catch (err) {
                console.error('[ServerRenderer] Error stopping server:', err);
                this.log(`Error stopping server: ${err.message || err}`, 'error');
                const stopBtn = document.getElementById('btn-stop-bedrock');
                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.textContent = 'Stop Server';
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
        const statusIndicator = document.getElementById('bedrock-status-indicator');
        const statusText = document.getElementById('bedrock-status-text');
        
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator';
            if (status === 'online') statusIndicator.classList.add('online');
            if (status === 'starting') statusIndicator.classList.add('starting');
        }
        
        if (statusText) {
            statusText.textContent = `Server ${labels[status]}`;
        }
        
        // Update header status badge
        const headerDot = document.getElementById('status-dot');
        const headerText = document.getElementById('status-text');
        if (headerDot) {
            headerDot.className = `status-dot ${status}`;
        }
        if (headerText) {
            headerText.textContent = `Server ${labels[status]}`;
        }
    }

    log(message, type = 'info') {
        const output = document.getElementById('bedrock-terminal-output');
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
        const output = document.getElementById('bedrock-terminal-output');
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
            const uptimeEl = document.getElementById('bedrock-uptime');
            if (uptimeEl) {
                uptimeEl.textContent = `${hours}:${minutes}:${seconds}`;
            }
        }, 1000);
    }

    saveSettings() {
        try {
            const settings = {
                bedrockPath: this.bedrockPath
            };
            localStorage.setItem('bedrock-server-settings', JSON.stringify(settings));
            console.log('[ServerRenderer] Settings saved');
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    loadSettings() {
        console.log('[ServerRenderer] loadSettings called');
        try {
            const saved = localStorage.getItem('bedrock-server-settings');
            if (saved) {
                console.log('[ServerRenderer] Found saved settings');
                const settings = JSON.parse(saved);

                this.bedrockPath = settings.bedrockPath;
                console.log('[ServerRenderer] Loaded bedrockPath:', this.bedrockPath);

                const pathInput = document.getElementById('bedrock-server-path');
                const currentPathEl = document.getElementById('bedrock-current-path');
                if (pathInput && this.bedrockPath) {
                    pathInput.value = this.bedrockPath;
                    console.log('[ServerRenderer] Set path input value');
                }
                if (currentPathEl && this.bedrockPath) {
                    currentPathEl.textContent = this.bedrockPath;
                    console.log('[ServerRenderer] Set current path display');
                }
            } else {
                console.log('[ServerRenderer] No saved settings found');
            }
        } catch (e) {
            console.error('[ServerRenderer] Failed to load settings:', e);
        }
    }
}

/**
 * Llama CLI Renderer
 * Generates CLI commands for running local LLMs
 */
class LlamaCLIRenderer {
    constructor() {
        this.cliPath = null;
        this.modelPath = null;
        console.log('[LlamaCLI] Constructor called');
    }

    init() {
        console.log('[LlamaCLI] Initializing...');
        this.setupEventListeners();
        this.loadSettings();
        this.generateCommand();
        console.log('[LlamaCLI] Initialization complete');
    }

    setupEventListeners() {
        console.log('[LlamaCLI] Setting up event listeners...');

        // Browse buttons
        const browseCliBtn = document.getElementById('btn-browse-llama-cli');
        const browseModelBtn = document.getElementById('btn-browse-llama-cli-model');
        const copyBtn = document.getElementById('btn-copy-cli-command');

        if (browseCliBtn) {
            browseCliBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForCliExecutable();
            });
        }

        if (browseModelBtn) {
            browseModelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForModel();
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.copyCommand();
            });
        }

        // Input change listeners to regenerate command
        const inputs = ['llama-cli-path-input', 'llama-cli-model-input', 'llama-cli-context', 
                       'llama-cli-gpu-layers', 'llama-cli-threads', 'llama-cli-temp'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    this.generateCommand();
                    this.saveSettings();
                });
            }
        });

        console.log('[LlamaCLI] Event listeners setup complete');
    }

    async browseForCliExecutable() {
        console.log('[LlamaCLI] browseForCliExecutable called');

        if (window.browserAPI && window.browserAPI.files) {
            try {
                const filters = [
                    { name: 'Executable', extensions: ['exe'] },
                    { name: 'All Files', extensions: ['*'] }
                ];
                const filePath = await window.browserAPI.files.selectFile(filters);

                if (filePath) {
                    const pathInput = document.getElementById('llama-cli-path-input');
                    if (pathInput) {
                        pathInput.value = filePath;
                        this.cliPath = filePath;
                        this.saveSettings();
                        this.generateCommand();
                    }
                }
            } catch (err) {
                console.error('[LlamaCLI] Dialog error:', err);
                this.showPathPrompt('cli');
            }
        } else {
            this.showPathPrompt('cli');
        }
    }

    async browseForModel() {
        console.log('[LlamaCLI] browseForModel called');

        if (window.browserAPI && window.browserAPI.files) {
            try {
                const filters = [
                    { name: 'GGUF Models', extensions: ['gguf'] },
                    { name: 'All Files', extensions: ['*'] }
                ];
                const filePath = await window.browserAPI.files.selectFile(filters);

                if (filePath) {
                    const pathInput = document.getElementById('llama-cli-model-input');
                    if (pathInput) {
                        pathInput.value = filePath;
                        this.modelPath = filePath;
                        this.saveSettings();
                        this.generateCommand();
                    }
                }
            } catch (err) {
                console.error('[LlamaCLI] Dialog error:', err);
                this.showPathPrompt('model');
            }
        } else {
            this.showPathPrompt('model');
        }
    }

    showPathPrompt(type) {
        const placeholder = type === 'cli' 
            ? 'C:\\llama.cpp\\llama-cli.exe' 
            : 'C:\\models\\llama-2-7b-chat.gguf';
        const path = prompt(`Enter the path to ${type === 'cli' ? 'llama-cli.exe' : 'model file'}:`, placeholder);
        if (path) {
            if (type === 'cli') {
                const pathInput = document.getElementById('llama-cli-path-input');
                if (pathInput) {
                    pathInput.value = path;
                    this.cliPath = path;
                }
            } else {
                const pathInput = document.getElementById('llama-cli-model-input');
                if (pathInput) {
                    pathInput.value = path;
                    this.modelPath = path;
                }
            }
            this.saveSettings();
            this.generateCommand();
        }
    }

    generateCommand() {
        const cliPath = document.getElementById('llama-cli-path-input')?.value || '';
        const modelPath = document.getElementById('llama-cli-model-input')?.value || '';
        const contextLength = document.getElementById('llama-cli-context')?.value || '2096';
        const gpuLayers = document.getElementById('llama-cli-gpu-layers')?.value || '24';
        const threads = document.getElementById('llama-cli-threads')?.value || '4';
        const temp = document.getElementById('llama-cli-temp')?.value || '0.8';

        const outputEl = document.getElementById('llama-cli-command-output');
        if (!outputEl) return;

        if (!cliPath || !modelPath) {
            outputEl.textContent = 'Select executable and model to generate command...';
            return;
        }

        let command = `& "${cliPath}" -m "${modelPath}"`;
        command += ` -c ${contextLength}`;
        command += ` -ngl ${gpuLayers}`;
        command += ` -t ${threads}`;
        command += ` --temp ${temp}`;
        command += ` --color auto`;

        outputEl.textContent = command;
    }

    async copyCommand() {
        const command = document.getElementById('llama-cli-command-output')?.textContent;
        if (!command || command === 'Select executable and model to generate command...') {
            return;
        }

        try {
            await navigator.clipboard.writeText(command);
            const copyBtn = document.getElementById('btn-copy-cli-command');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copied!
                `;
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            }
        } catch (err) {
            console.error('[LlamaCLI] Failed to copy:', err);
        }
    }

    saveSettings() {
        try {
            const settings = {
                cliPath: document.getElementById('llama-cli-path-input')?.value,
                modelPath: document.getElementById('llama-cli-model-input')?.value,
                contextLength: document.getElementById('llama-cli-context')?.value,
                gpuLayers: document.getElementById('llama-cli-gpu-layers')?.value,
                threads: document.getElementById('llama-cli-threads')?.value,
                temp: document.getElementById('llama-cli-temp')?.value
            };
            localStorage.setItem('llama-cli-settings', JSON.stringify(settings));
            console.log('[LlamaCLI] Settings saved');
        } catch (e) {
            console.error('[LlamaCLI] Failed to save settings:', e);
        }
    }

    loadSettings() {
        console.log('[LlamaCLI] loadSettings called');
        try {
            const saved = localStorage.getItem('llama-cli-settings');
            if (saved) {
                console.log('[LlamaCLI] Found saved settings');
                const settings = JSON.parse(saved);

                const mappings = {
                    'llama-cli-path-input': settings.cliPath,
                    'llama-cli-model-input': settings.modelPath,
                    'llama-cli-context': settings.contextLength,
                    'llama-cli-gpu-layers': settings.gpuLayers,
                    'llama-cli-threads': settings.threads,
                    'llama-cli-temp': settings.temp
                };

                Object.entries(mappings).forEach(([id, value]) => {
                    if (value) {
                        const input = document.getElementById(id);
                        if (input) input.value = value;
                    }
                });

                this.cliPath = settings.cliPath;
                this.modelPath = settings.modelPath;
            }
        } catch (e) {
            console.error('[LlamaCLI] Failed to load settings:', e);
        }
    }
}

const AI_PLAYER_PROVIDERS = {
    google: {
        name: 'Google Gemini',
        models: [
            { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash' },
            { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
        ],
        placeholder: 'AI Studio Key',
        verifyModel: 'gemini-3-flash-preview'
    },
    openai: {
        name: 'OpenAI',
        models: [
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ],
        placeholder: 'sk-...',
        verifyModel: 'gpt-4o-mini'
    },
    anthropic: {
        name: 'Anthropic Claude',
        models: [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
        ],
        placeholder: 'sk-ant-api...',
        verifyModel: 'claude-3-5-sonnet-20241022'
    },
    groq: {
        name: 'Groq',
        models: [
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
            { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
            { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
            { id: 'gemma-7b-it', name: 'Gemma 7B' }
        ],
        placeholder: 'gsk_...',
        verifyModel: 'llama-3.3-70b-versatile'
    },
    mistral: {
        name: 'Mistral AI',
        models: [
            { id: 'mistral-large-latest', name: 'Mistral Large' },
            { id: 'mistral-medium-latest', name: 'Mistral Medium' },
            { id: 'mistral-small-latest', name: 'Mistral Small' },
            { id: 'open-mistral-7b', name: 'Mistral 7B' }
        ],
        placeholder: 'Mistral API Key',
        verifyModel: 'mistral-small-latest'
    },
    openrouter: {
        name: 'OpenRouter',
        models: [
            { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'openai/gpt-4o', name: 'GPT-4o' },
            { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' }
        ],
        placeholder: 'sk-or-...',
        verifyModel: 'google/gemini-2.0-flash-001'
    },
    lmstudio: {
        name: 'LM Studio',
        models: [],
        placeholder: 'No API key required',
        verifyModel: '',
        noKeyRequired: true
    },
    llamacpp: {
        name: 'llama.cpp Server',
        models: [],
        placeholder: 'No API key required',
        verifyModel: '',
        noKeyRequired: true
    },
    'openai-compatible': {
        name: 'OpenAI Compatible',
        models: [],
        placeholder: 'API Key (Optional)',
        verifyModel: '',
        noKeyRequired: true
    }
};

// Use global PROVIDERS from AI settings if available (same instance)
if (typeof PROVIDERS !== 'undefined') {
    Object.keys(PROVIDERS).forEach(key => {
        if (!AI_PLAYER_PROVIDERS[key]) {
            AI_PLAYER_PROVIDERS[key] = PROVIDERS[key];
        }
    });
} else if (typeof window !== 'undefined' && window.PROVIDERS) {
    Object.keys(window.PROVIDERS).forEach(key => {
        if (!AI_PLAYER_PROVIDERS[key]) {
            AI_PLAYER_PROVIDERS[key] = window.PROVIDERS[key];
        }
    });
}

// Make available globally
if (typeof window !== 'undefined') {
    window.AI_PLAYER_PROVIDERS = AI_PLAYER_PROVIDERS;
}

/**
 * AI Player Renderer
 * Manages the AI player agent that connects to Minecraft server
 */
class AIPlayerRenderer {
    constructor() {
        this.isConnected = false;
        this.isPlayerOnline = false;
        this.currentActivity = 'Idle';
        this.botId = null; // Minecraft bot connection ID
        this.settings = {
            provider: 'local', // 'cloud' or 'local'
            cloudProvider: 'openai',
            cloudApiKey: '',
            cloudModel: 'gpt-4o',
            modelMode: 'preset', // 'preset' or 'custom'
            customModelName: '',
            customApiEndpoint: '',
            localServerUrl: 'http://localhost:8080',
            localModelName: '',
            localSystemPrompt: 'You are an advanced Minecraft survival assistant. You can gather resources, craft tools/armor, smelt ore, place torches, manage inventory, build simple shelter, and protect players from hostile mobs. Prefer safe survival actions and explain briefly what you are doing.',
            aiName: 'AI Assistant',
            gameVersion: '',
            uiShowBuildPanel: true,
            autonomy: {
                enabled: true,
                combat: true,
                eat: true,
                light: true,
                inventory: true,
                maintenance: true,
                wander: true
            },
            capabilities: {
                crafting: true,
                eating: true,
                walking: true,
                combat: true,
                lighting: true,
                smelting: true,
                building: true,
                inventory: true
            }
        };
        
        this.providerConfig = AI_PLAYER_PROVIDERS;
        this.activityLog = [];
        this.verifiedProfiles = [];
        this.buildFileData = null;

        // Activity pool for random selection
        this.activityPool = [
            { icon: '🌅', name: 'Morning routine', desc: 'Gather wood and basic resources' },
            { icon: '⛏️', name: 'Mining expedition', desc: 'Collect coal and iron ore' },
            { icon: '🍞', name: 'Break time', desc: 'Cook food and organize inventory' },
            { icon: '🏗️', name: 'Building project', desc: 'Expand base or farm structures' },
            { icon: '🌾', name: 'Farming', desc: 'Harvest crops and replant seeds' },
            { icon: '🛡️', name: 'Defense prep', desc: 'Check perimeter and light up area' },
            { icon: '😴', name: 'Rest', desc: 'Return to bed and sleep through night' },
            { icon: '🎣', name: 'Fishing', desc: 'Catch fish and gather water resources' },
            { icon: '🐄', name: 'Animal farming', desc: 'Breed and feed animals' },
            { icon: '⚒️', name: 'Crafting', desc: 'Create tools and useful items' },
            { icon: '🔍', name: 'Exploration', desc: 'Explore nearby areas for resources' },
            { icon: '💡', name: 'Lighting', desc: 'Light up dark areas and caves' }
        ];
        
        this.playerCheckInterval = null;
        this.inventoryInterval = null;
        console.log('[AIPlayer] Constructor called');
    }

    init() {
        console.log('[AIPlayer] Initializing...');
        this.loadSettings();
        this.setupEventListeners();
        this.setupBotEventListeners();
        this.applyBuildPanelVisibility();
        this.applyAiWindowMode();

        this.startPlayerPresenceChecker();
        this.updateUI();
        this.log('AI Player initialized and ready', 'info');
        console.log('[AIPlayer] Initialization complete');
    }

    setupEventListeners() {
        // Connect button
        const connectBtn = document.getElementById('btn-ai-connect');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.toggleConnection());
        }

        // Check Server button
        const checkServerBtn = document.getElementById('btn-check-server');
        if (checkServerBtn) {
            checkServerBtn.addEventListener('click', () => this.checkServer());
        }

        // Command input
        const commandInput = document.getElementById('ai-command-input');
        const sendCommandBtn = document.getElementById('btn-ai-send-command');
        if (commandInput) {
            commandInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendCommand(commandInput.value);
            });
        }
        if (sendCommandBtn) {
            sendCommandBtn.addEventListener('click', () => {
                const input = document.getElementById('ai-command-input');
                if (input) this.sendCommand(input.value);
            });
        }

        // Quick commands
        const quickCommands = document.querySelectorAll('.ai-quick-command');
        quickCommands.forEach(cmd => {
            cmd.addEventListener('click', () => this.sendCommand(cmd.dataset.command));
        });

        // Capability toggles
        this.bindCapabilityToggles();
        this.bindAutonomyToggles();

        // Server type selection (main panel)
        const mainServerTypeOptions = document.querySelectorAll('.server-type-option[data-type]');
        mainServerTypeOptions.forEach(option => {
            option.addEventListener('click', () => this.selectServerType(option.dataset.type));
        });

        // Tab switching
        const aiTabs = document.querySelectorAll('.ai-tab[data-tab]');
        aiTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const aiPanelRoot = document.getElementById('panel-ai-player');
                if (!aiPanelRoot) return;

                // Remove active class from all tabs
                aiTabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.borderColor = 'transparent';
                    t.style.color = 'var(--text-dim)';
                });

                // Add active class to clicked tab
                tab.classList.add('active');
                tab.style.borderColor = 'var(--accent)';
                tab.style.color = 'var(--accent)';

                // Hide all AI tab content in this panel only
                const tabContents = aiPanelRoot.querySelectorAll('.ai-tab-content[id^="tab-"]');
                tabContents.forEach(content => {
                    content.classList.add('hidden');
                    content.classList.remove('active');
                    content.style.display = 'none';
                });

                // Show selected tab content
                const tabId = 'tab-' + tab.dataset.tab;
                const selectedContent = aiPanelRoot.querySelector('#' + tabId);
                if (selectedContent) {
                    selectedContent.classList.remove('hidden');
                    selectedContent.classList.add('active');
                    selectedContent.style.display = 'block';
                }
            });
        });

        // Clear AI log button
        const clearAiLogBtn = document.getElementById('btn-clear-ai-log');
        if (clearAiLogBtn) {
            clearAiLogBtn.addEventListener('click', () => {
                const aiActivityLog = document.getElementById('ai-activity-log');
                if (aiActivityLog) {
                    aiActivityLog.innerHTML = '<div class="terminal-line info" style="color: var(--text-dim);">Log cleared. Waiting for new activity...</div>';
                }
            });
        }

        // Build panel
        this.setupBuildPanel();
        this.setupPlayerSidebarToggle();

        // Settings button
        const settingsBtn = document.getElementById('btn-ai-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // Open AI window icon
        const openAiWindowBottomBtn = document.getElementById('btn-open-ai-window-bottom');
        if (openAiWindowBottomBtn) {
            openAiWindowBottomBtn.addEventListener('click', async () => {
                if (window.browserAPI?.aiPlayerWindow?.open) {
                    await window.browserAPI.aiPlayerWindow.open();
                }
            });
        }

        // Settings modal close
        const closeBtn = document.getElementById('btn-ai-settings-close');
        const cancelBtn = document.getElementById('btn-ai-settings-cancel');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeSettings());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeSettings());

        // Settings save
        const saveBtn = document.getElementById('btn-ai-settings-save');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveSelectedProfile());

        // Game version input
        const gameVersionInput = document.getElementById('ai-game-version');
        if (gameVersionInput) {
            gameVersionInput.addEventListener('change', () => {
                this.settings.gameVersion = gameVersionInput.value.trim() || '';
                this.saveSettings();
            });
        }

        this.setupAiPanelContextMenu();
    }

    setupAiPanelContextMenu() {
        const panel = document.getElementById('panel-ai-player');
        if (!panel) return;

        let menu = document.getElementById('ai-panel-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'ai-panel-context-menu';
            menu.style.position = 'fixed';
            menu.style.zIndex = '9999';
            menu.style.background = 'var(--bg-panel)';
            menu.style.border = '1px solid var(--border)';
            menu.style.borderRadius = '8px';
            menu.style.boxShadow = '0 12px 30px rgba(0,0,0,0.35)';
            menu.style.padding = '6px';
            menu.style.minWidth = '200px';
            menu.style.display = 'none';
            menu.innerHTML = `
                <button id="ai-panel-open-window" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text); padding:8px 10px; border-radius:6px; cursor:pointer;">
                    Open in Electron Window
                </button>
            `;
            document.body.appendChild(menu);
        }

        const hideMenu = () => { menu.style.display = 'none'; };
        document.addEventListener('click', hideMenu);
        document.addEventListener('scroll', hideMenu, true);
        window.addEventListener('blur', hideMenu);

        panel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
            menu.style.display = 'block';
        });

        const openBtn = document.getElementById('ai-panel-open-window');
        if (openBtn) {
            openBtn.onclick = async () => {
                hideMenu();
                if (window.browserAPI?.aiPlayerWindow?.open) {
                    await window.browserAPI.aiPlayerWindow.open();
                }
            };
        }
    }

    bindCapabilityToggles() {
        const mapping = [
            { id: 'cap-crafting', key: 'crafting' },
            { id: 'cap-eating', key: 'eating' },
            { id: 'cap-walking', key: 'walking' },
            { id: 'cap-combat', key: 'combat' },
            { id: 'cap-lighting', key: 'lighting' },
            { id: 'cap-smelting', key: 'smelting' },
            { id: 'cap-building', key: 'building' },
            { id: 'cap-inventory', key: 'inventory' },
        ];

        mapping.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = this.settings.capabilities?.[key] !== false;
            el.addEventListener('change', () => {
                this.settings.capabilities[key] = !!el.checked;
                this.saveSettings();
                if (key === 'inventory') {
                    if (el.checked) {
                        if (this.isConnected) this.startInventoryPolling();
                    } else {
                        this.stopInventoryPolling();
                        const grid = document.getElementById('player-inventory-grid');
                        if (grid) {
                            grid.innerHTML = '<div style="color: var(--text-dim); font-size: 12px;">Inventory disabled.</div>';
                        }
                    }
                }
            });
        });

        const buildToggle = document.getElementById('ui-build-panel');
        if (buildToggle) {
            buildToggle.checked = this.settings.uiShowBuildPanel !== false;
            buildToggle.addEventListener('change', () => {
                this.settings.uiShowBuildPanel = !!buildToggle.checked;
                this.applyBuildPanelVisibility();
                this.saveSettings();
            });
        }
    }

    bindAutonomyToggles() {
        const mapping = [
            { id: 'auto-enabled', key: 'enabled' },
            { id: 'auto-combat', key: 'combat' },
            { id: 'auto-eat', key: 'eat' },
            { id: 'auto-light', key: 'light' },
            { id: 'auto-inventory', key: 'inventory' },
            { id: 'auto-maintenance', key: 'maintenance' },
            { id: 'auto-wander', key: 'wander' }
        ];

        mapping.forEach(({ id, key }) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.checked = this.settings.autonomy?.[key] !== false;
            el.addEventListener('change', async () => {
                this.settings.autonomy[key] = !!el.checked;
                this.saveSettings();
                if (this.isConnected && this.botId && window.browserAPI?.mineflayerBot?.setAutonomy) {
                    try {
                        await window.browserAPI.mineflayerBot.setAutonomy(this.botId, this.settings.autonomy);
                    } catch (e) {}
                }
            });
        });
    }

    applyBuildPanelVisibility() {
        const show = this.settings.uiShowBuildPanel !== false;
        const buildTabBtn = document.querySelector('.ai-tab[data-tab="build"]');
        const buildPanel = document.getElementById('tab-build');
        if (buildTabBtn) buildTabBtn.style.display = show ? '' : 'none';
        if (buildPanel) buildPanel.style.display = show ? '' : 'none';
    }

    applyAiWindowMode() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') !== 'ai') return;

        document.body.classList.add('ai-window-mode');

        const navItems = document.querySelectorAll('.nav-item[data-panel]');
        navItems.forEach(item => {
            const panel = item.getAttribute('data-panel');
            const keep = panel === 'ai-player' || panel === 'java-server';
            item.style.display = keep ? '' : 'none';
        });

        const panels = document.querySelectorAll('.panel');
        panels.forEach(panel => {
            const keep = panel.id === 'panel-ai-player' || panel.id === 'panel-java-server';
            panel.style.display = keep ? '' : 'none';
        });

        const navWrapper = document.getElementById('nav-wrapper');
        if (navWrapper) navWrapper.classList.remove('collapsed');

        this.setupAiWindowContextMenu();
    }

    setupAiWindowContextMenu() {
        let menu = document.getElementById('ai-window-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'ai-window-context-menu';
            menu.style.position = 'fixed';
            menu.style.zIndex = '9999';
            menu.style.background = 'var(--bg-panel)';
            menu.style.border = '1px solid var(--border)';
            menu.style.borderRadius = '8px';
            menu.style.boxShadow = '0 12px 30px rgba(0,0,0,0.35)';
            menu.style.padding = '6px';
            menu.style.minWidth = '180px';
            menu.style.display = 'none';
            menu.innerHTML = `
                <button data-action="minimize" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text); padding:8px 10px; border-radius:6px; cursor:pointer;">Minimize</button>
                <button data-action="maximize" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text); padding:8px 10px; border-radius:6px; cursor:pointer;">Maximize/Restore</button>
                <button data-action="devtools" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text); padding:8px 10px; border-radius:6px; cursor:pointer;">Dev Tools</button>
                <button data-action="close" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text); padding:8px 10px; border-radius:6px; cursor:pointer;">Close</button>
            `;
            document.body.appendChild(menu);
        }

        const hideMenu = () => { menu.style.display = 'none'; };
        document.addEventListener('click', hideMenu);
        document.addEventListener('scroll', hideMenu, true);
        window.addEventListener('blur', hideMenu);

        document.addEventListener('contextmenu', (e) => {
            const params = new URLSearchParams(window.location.search);
            if (params.get('mode') !== 'ai') return;
            e.preventDefault();
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
            menu.style.display = 'block';
        });

        menu.querySelectorAll('button[data-action]').forEach(btn => {
            btn.onclick = () => {
                hideMenu();
                const action = btn.getAttribute('data-action');
                const win = window.browserAPI?.window;
                if (!win) return;
                if (action === 'minimize') win.minimize();
                if (action === 'maximize') win.toggleMaximize();
                if (action === 'close') win.close();
                if (action === 'devtools' && win.toggleDevTools) win.toggleDevTools();
            };
        });
    }

    loadSettings() {
        const saved = localStorage.getItem('aiPlayerSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
                this.settings.autonomy = {
                    enabled: true,
                    combat: true,
                    eat: true,
                    light: true,
                    inventory: true,
                    maintenance: true,
                    wander: true,
                    ...(parsed.autonomy || {})
                };
                this.settings.capabilities = {
                    crafting: true,
                    eating: true,
                    walking: true,
                    combat: true,
                    lighting: true,
                    smelting: true,
                    building: true,
                    inventory: true,
                    ...(parsed.capabilities || {})
                };
                if (typeof parsed.uiShowBuildPanel === 'boolean') {
                    this.settings.uiShowBuildPanel = parsed.uiShowBuildPanel;
                }

            } catch (e) {
                console.error('[AIPlayer] Failed to parse settings:', e);
            }
        }

        // Populate game version input
        const gameVersionInput = document.getElementById('ai-game-version');
        if (gameVersionInput) {
            gameVersionInput.value = this.settings.gameVersion || '';
        }
    }

    openSettings() {
        this.selectedProfile = null;
        this.loadSavedProfiles();
        const modal = document.getElementById('ai-settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateSelectedProfileUI();
        }
    }

    closeSettings() {
        const modal = document.getElementById('ai-settings-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    loadSavedProfiles() {
        const container = document.getElementById('ai-saved-profiles-list');
        if (!container) return;

        try {
            const profilesRaw = localStorage.getItem('omni_verified_profiles');
            const profiles = profilesRaw ? JSON.parse(profilesRaw) : [];

            if (profiles.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 30px; color: var(--text-dim);">
                        <div style="font-size: 40px; margin-bottom: 10px;">🔑</div>
                        <div style="font-size: 14px;">No saved configurations</div>
                        <div style="font-size: 12px; margin-top: 4px;">Verify an AI in AI Settings first</div>
                    </div>
                `;
                return;
            }

            const providerIcons = {
                openai: '🔑',
                anthropic: '🧠',
                google: '🔷',
                gemini: '🔷',
                groq: '⚡',
                mistral: '🌪️',
                openrouter: '🔀',
                llamacpp: '🦙',
                lmstudio: '📡',
                'openai-compatible': '🔌',
                ollama: '🟣'
            };

            const providerNames = {
                openai: 'OpenAI',
                anthropic: 'Anthropic Claude',
                google: 'Google Gemini',
                gemini: 'Google Gemini',
                groq: 'Groq',
                mistral: 'Mistral AI',
                openrouter: 'OpenRouter',
                llamacpp: 'llama.cpp',
                lmstudio: 'LM Studio',
                'openai-compatible': 'OpenAI Compatible',
                ollama: 'Ollama'
            };

            container.innerHTML = profiles.map((profile, index) => {
                const icon = providerIcons[profile.provider] || '🤖';
                const name = providerNames[profile.provider] || profile.provider;
                return `
                    <div class="saved-profile-item" data-index="${index}" onclick="window.aiPlayerRenderer.selectProfile(${index})">
                        <div class="saved-profile-icon">${icon}</div>
                        <div class="saved-profile-info">
                            <div class="saved-profile-name">${name}</div>
                            <div class="saved-profile-model">${profile.model}</div>
                        </div>
                        <div class="saved-profile-check">✓</div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('[AIPlayer] Failed to load profiles:', e);
            container.innerHTML = '<div style="color: var(--danger); padding: 20px;">Failed to load profiles</div>';
        }
    }

    selectProfile(index) {
        try {
            const profilesRaw = localStorage.getItem('omni_verified_profiles');
            const profiles = profilesRaw ? JSON.parse(profilesRaw) : [];
            this.selectedProfile = profiles[index];

            // Update UI
            document.querySelectorAll('.saved-profile-item').forEach((el, i) => {
                el.classList.toggle('selected', i === index);
            });

            this.updateSelectedProfileUI();
        } catch (e) {
            console.error('[AIPlayer] Failed to select profile:', e);
        }
    }

    updateSelectedProfileUI() {
        const infoEl = document.getElementById('selected-profile-info');
        const noSelEl = document.getElementById('no-selection');
        const saveBtn = document.getElementById('btn-ai-settings-save');
        const provIcon = document.getElementById('selected-provider-icon');
        const provName = document.getElementById('selected-provider-name');
        const modelName = document.getElementById('selected-model-name');

        if (this.selectedProfile) {
            infoEl.style.display = 'block';
            noSelEl.style.display = 'none';
            saveBtn.disabled = false;

            const providerIcons = {
                openai: '🔑', anthropic: '🧠', google: '🔷', gemini: '🔷',
                groq: '⚡', mistral: '🌪️', openrouter: '🔀', llamacpp: '🦙',
                lmstudio: '📡', 'openai-compatible': '🔌', ollama: '🟣'
            };

            const providerNames = {
                openai: 'OpenAI', anthropic: 'Anthropic Claude', google: 'Google Gemini',
                gemini: 'Google Gemini', groq: 'Groq', mistral: 'Mistral AI',
                openrouter: 'OpenRouter', llamacpp: 'llama.cpp', lmstudio: 'LM Studio',
                'openai-compatible': 'OpenAI Compatible', ollama: 'Ollama'
            };

            provIcon.textContent = providerIcons[this.selectedProfile.provider] || '🤖';
            provName.textContent = providerNames[this.selectedProfile.provider] || this.selectedProfile.provider;
            modelName.textContent = this.selectedProfile.model;
        } else {
            infoEl.style.display = 'none';
            noSelEl.style.display = 'block';
            saveBtn.disabled = true;
        }
    }

    saveSelectedProfile() {
        if (!this.selectedProfile) return;

        // Save as AI player settings
        this.settings.cloudProvider = this.selectedProfile.provider;
        this.settings.cloudApiKey = this.selectedProfile.key;
        this.settings.cloudModel = this.selectedProfile.model;
        this.settings.provider = 'cloud';

        localStorage.setItem('aiPlayerSettings', JSON.stringify(this.settings));

        this.closeSettings();
        this.log(`AI Brain: ${this.selectedProfile.provider} - ${this.selectedProfile.model}`, 'success');
    }

    getConnectionSettings() {
        const serverIpInput = document.getElementById('ai-server-ip');
        const serverPortInput = document.getElementById('ai-server-port');
        const playerNameInput = document.getElementById('ai-player-name');
        const gameVersionInput = document.getElementById('ai-game-version');

        // Get values from input fields with defaults
        const serverHost = serverIpInput && serverIpInput.value.trim()
            ? serverIpInput.value.trim()
            : '127.0.0.1';
        
        let serverPort;
        if (serverPortInput && serverPortInput.value.trim()) {
            serverPort = parseInt(serverPortInput.value.trim(), 10);
        } else {
            serverPort = 25565;
        }
        
        const username = playerNameInput && playerNameInput.value.trim() 
            ? playerNameInput.value.trim() 
            : 'AI_Player';
        
        const gameVersion = gameVersionInput && gameVersionInput.value.trim()
            ? gameVersionInput.value.trim()
            : (this.settings.gameVersion || '');

        return {
            serverHost,
            serverPort,
            username,
            gameVersion,
            isJava: true,
            capabilities: this.settings.capabilities
        };
    }

    async checkServer() {
        const settings = this.getConnectionSettings();
        const { serverHost, serverPort } = settings;
        
        const statusIndicator = document.getElementById('server-status-indicator');
        const statusText = document.getElementById('server-status-text');
        const checkBtn = document.getElementById('btn-check-server');
        
        // Update UI to checking state
        if (statusIndicator) {
            statusIndicator.style.background = 'var(--warning)';
            statusIndicator.style.boxShadow = '0 0 8px var(--warning)';
            statusIndicator.style.animation = 'pulse 1s infinite';
        }
        if (statusText) statusText.textContent = 'Checking...';
        if (checkBtn) checkBtn.disabled = true;
        
        this.log(`Checking server at ${serverHost}:${serverPort}...`, 'info');
        
        // Check server connectivity using net socket
        try {
            const result = await this.testTcpConnection(serverHost, serverPort);
            
            if (result.success) {
                // Server is online
                if (statusIndicator) {
                    statusIndicator.style.background = 'var(--success)';
                    statusIndicator.style.boxShadow = '0 0 8px var(--success)';
                    statusIndicator.style.animation = 'none';
                }
                if (statusText) {
                    statusText.textContent = 'Online';
                    statusText.style.color = 'var(--success)';
                }
                this.log(`Server is ONLINE at ${serverHost}:${serverPort}`, 'success');
            } else {
                // Server is offline
                this.handleServerOffline(statusIndicator, statusText, serverHost, serverPort);
            }
        } catch (error) {
            this.handleServerOffline(statusIndicator, statusText, serverHost, serverPort, error.message || 'Connection failed');
        }
        
        if (checkBtn) checkBtn.disabled = false;
    }
    
    handleServerOffline(statusIndicator, statusText, serverHost, serverPort, error = 'Connection failed') {
        if (statusIndicator) {
            statusIndicator.style.background = 'var(--danger)';
            statusIndicator.style.boxShadow = '0 0 8px var(--danger)';
            statusIndicator.style.animation = 'none';
        }
        if (statusText) {
            statusText.textContent = 'Offline';
            statusText.style.color = 'var(--danger)';
        }
        this.log(`Server is OFFLINE at ${serverHost}:${serverPort} - ${error}`, 'error');
    }
    
    testTcpConnection(host, port) {
        return new Promise((resolve) => {
            // For renderer process, we'll use a simple fetch to test HTTP connectivity
            // or fall back to a timeout-based check
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Connection timeout' });
            }, 3000);
            
            // Try to establish TCP connection via Electron's net module if available
            if (window.browserAPI && window.browserAPI.testConnection) {
                window.browserAPI.testConnection(host, port, 3000)
                    .then(result => {
                        clearTimeout(timeout);
                        resolve(result);
                    })
                    .catch(error => {
                        clearTimeout(timeout);
                        resolve({ success: false, error: error.message });
                    });
            } else {
                // Fallback: try to connect via WebSocket or fetch
                // This is a best-effort check
                clearTimeout(timeout);
                
                // Try fetch to see if there's any HTTP response
                fetch(`http://${host}:${port}`, {
                    mode: 'no-cors',
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                }).then(() => {
                    resolve({ success: true });
                }).catch(() => {
                    // Fetch failed but server might still be reachable via TCP
                    // Try a simple socket-like approach using img onload
                    const img = new Image();
                    img.onload = () => resolve({ success: true });
                    img.onerror = () => {
                        // Server might still be online but not responding to HTTP
                        // Return false for offline
                        resolve({ success: false, error: 'Connection failed' });
                    };
                    img.src = `http://${host}:${port}/favicon.ico?t=${Date.now()}`;
                    
                    // Fallback timeout
                    setTimeout(() => resolve({ success: false, error: 'Connection timeout' }), 3000);
                });
            }
        });
    }

    async toggleConnection() {
        if (this.isConnected) {
            await this.disconnect();
        } else {
            const settings = this.getConnectionSettings();
            await this.connect(settings);
        }
    }

    async connect(customSettings = null) {
        try {
            // Check if AI brain is configured
            if (!this.settings.cloudProvider || !this.settings.cloudApiKey) {
                this.log('AI Brain not configured. Please select a profile from Settings.', 'error');
                return;
            }

            this.log(`Using AI Brain: ${this.settings.cloudProvider} - ${this.settings.cloudModel}`, 'info');
            this.log('Connecting AI Player to Minecraft server...', 'info');

            // Get server connection details
            const settings = customSettings || this.getConnectionSettings();
            const { serverHost, serverPort, username, gameVersion } = settings;

            this.log('Connecting AI Player to Java Edition server...', 'info');

            if (window.browserAPI && window.browserAPI.mineflayerBot) {
                this.log('Connecting to Java Edition server with advanced features...', 'info');

                const connectConfig = {
                    serverHost: serverHost,
                    serverPort: serverPort,
                    username: username,
                    auth: 'offline',
                    capabilities: this.settings.capabilities,
                    autonomy: this.settings.autonomy
                };

                if (gameVersion) {
                    connectConfig.version = gameVersion;
                }

                const result = await window.browserAPI.mineflayerBot.connect(connectConfig);

                if (result.success) {
                    this.botId = result.botId;
                    this.isConnected = true;
                    this.isJavaEdition = true;
                    this.updateUI();
                    if (this.settings.capabilities?.inventory !== false) {
                        this.startInventoryPolling();
                    } else {
                        this.stopInventoryPolling();
                    }
                    this.log(`AI Player "${username}" connected to Java server at ${serverHost}:${serverPort}`, 'success');
                    this.log('✨ Advanced features enabled: Pathfinding, Inventory, Block manipulation', 'success');

                    // Announce bot presence
                    await this.sendBotChat(`Hello! I'm ${username} with advanced capabilities!`);

                    // Start behavior
                    if (this.isPlayerOnline) {
                        this.log('Player detected online. AI will follow and protect.', 'info');
                        this.setActivity('Following player');
                    } else {
                        if (this.settings.autonomy?.enabled === false) {
                            this.log('Player offline. Autonomy is disabled in config.', 'info');
                            this.setActivity('Idle');
                        } else {
                            this.log('Player offline. AI autonomy active.', 'info');
                            this.setActivity('Autonomy active');
                        }
                    }
                } else {
                    throw new Error(result.error || 'Failed to connect to Java server');
                }
            } else {
                console.error('[AIPlayer] API check failed:', {
                    browserAPI: !!window.browserAPI,
                    mineflayerBot: !!(window.browserAPI && window.browserAPI.mineflayerBot)
                });
                throw new Error('Java Edition bot support is not available. The mineflayer module failed to load. This usually happens when native dependencies are not properly built. Try running: npm rebuild');
            }

        } catch (error) {
            console.error('[AIPlayer] Connection error:', error);
            const errorMessage = error?.message || '';
            const versionMatch = errorMessage.match(/server is version ([0-9.]+)/i);
            if (versionMatch && versionMatch[1]) {
                const detectedVersion = versionMatch[1];
                const gameVersionInput = document.getElementById('ai-game-version');
                if (gameVersionInput) {
                    gameVersionInput.value = detectedVersion;
                }
                this.settings.gameVersion = detectedVersion;
                try {
                    localStorage.setItem('aiPlayerSettings', JSON.stringify(this.settings));
                } catch (e) {
                    console.warn('[AIPlayer] Failed to persist detected game version:', e);
                }
                this.log(`Detected server version ${detectedVersion}. Updated Game Version field.`, 'warning');
            }
            this.log(`Connection failed: ${error.message}`, 'error');
            this.isConnected = false;
            this.updateUI();
        }
    }

    async disconnect() {
        try {
            if (this.botId && window.browserAPI && window.browserAPI.mineflayerBot) {
                await window.browserAPI.mineflayerBot.disconnect(this.botId);
                this.botId = null;
            }
            
            this.isConnected = false;
            this.isJavaEdition = false;
            this.currentActivity = 'Idle';
            this.stopInventoryPolling();
            this.updateUI();
            this.log('AI Player disconnected from server', 'info');
        } catch (error) {
            console.error('[AIPlayer] Disconnect error:', error);
            this.log(`Disconnect error: ${error.message}`, 'error');
        }
    }

    async sendBotChat(message) {
        if (!this.botId) return;
        
        try {
            if (window.browserAPI && window.browserAPI.mineflayerBot) {
                await window.browserAPI.mineflayerBot.sendChat(this.botId, message);
            }
        } catch (error) {
            console.error('[AIPlayer] Failed to send chat:', error);
        }
    }

    setupBuildPanel() {
        const dropzone = document.getElementById('build-dropzone');
        const fileInput = document.getElementById('build-file-input');
        const fileMeta = document.getElementById('build-file-meta');
        const blockList = document.getElementById('build-block-list');
        const creativeToggle = document.getElementById('build-creative-toggle');
        const startBtn = document.getElementById('btn-build-start');
        const clearBtn = document.getElementById('btn-build-clear');
        const viewToggle = document.getElementById('build-view-toggle');
        const viewFrame = document.getElementById('build-view-frame');
        const viewPanelFrame = document.getElementById('view-panel-frame');

        const setStatus = (text) => {
            if (fileMeta) fileMeta.textContent = text;
        };

        const setBlockList = (html) => {
            if (blockList) blockList.innerHTML = html;
        };

        const refreshButtonState = () => {
            const ready = !!this.buildFileData && creativeToggle && creativeToggle.checked;
            if (startBtn) startBtn.disabled = !ready;
        };

        const handleFiles = (files) => {
            if (!files || !files.length) return;
            const file = files[0];
            this.buildFileData = {
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream'
            };
            setStatus(`Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`);
            setBlockList('<span style="color: var(--text-dim);">Block breakdown not available in preview; AI will attempt in creative mode.</span>');
            refreshButtonState();
        };

        if (dropzone) {
            dropzone.addEventListener('click', () => fileInput && fileInput.click());
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--accent)';
            });
            dropzone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--border)';
            });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--border)';
                handleFiles(e.dataTransfer.files);
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
        }

        if (creativeToggle) {
            creativeToggle.addEventListener('change', refreshButtonState);
        }

        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                if (!this.buildFileData) {
                    this.log('No structure file selected.', 'error');
                    return;
                }
                if (!creativeToggle || !creativeToggle.checked) {
                    this.log('Creative mode required to start building.', 'error');
                    return;
                }
                const { name, size } = this.buildFileData;
                this.log(`Requesting build of ${name} (${Math.round(size / 1024)} KB)`, 'info');
                await this.sendBotChat(`Start building structure: ${name} (creative only).`);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.buildFileData = null;
                setStatus('No file selected');
                setBlockList('No file parsed yet. Upload a schematic to see a breakdown.');
                if (creativeToggle) creativeToggle.checked = false;
                refreshButtonState();
            });
        }

        if (viewToggle) {
            viewToggle.addEventListener('change', async () => {
                if (!this.botId) {
                    this.log('AI not connected. Cannot toggle view.', 'error');
                    viewToggle.checked = false;
                    return;
                }
                const enabled = viewToggle.checked;
                try {
                    const res = await window.browserAPI.mineflayerBot.setViewer(this.botId, enabled);
                    if (!res || !res.success) {
                        this.log(`Viewer error: ${res?.error || 'unknown'}`, 'error');
                        viewToggle.checked = false;
                        return;
                    }
                    if (enabled && viewFrame) {
                        const port = res.port || 3007;
                        viewFrame.src = `http://localhost:${port}`;
                        viewFrame.style.display = 'block';
                        if (viewPanelFrame) viewPanelFrame.src = `http://localhost:${port}`;
                    } else if (viewFrame) {
                        viewFrame.src = 'about:blank';
                        viewFrame.style.display = 'none';
                        if (viewPanelFrame) viewPanelFrame.src = 'about:blank';
                    }
                    this.log(enabled ? 'Viewer started' : 'Viewer stopped', 'info');
                } catch (e) {
                    this.log(`Viewer error: ${e.message}`, 'error');
                    viewToggle.checked = false;
                }
            });
        }
    }

    setupPlayerSidebarToggle() {
        const wrapper = document.getElementById('nav-wrapper');
        const toggle = document.getElementById('nav-toggle');
        if (toggle && wrapper) {
            toggle.addEventListener('click', () => {
                wrapper.classList.toggle('collapsed');
            });
        }
    }

    startInventoryPolling() {
        if (this.settings.capabilities?.inventory === false) {
            this.stopInventoryPolling();
            return;
        }
        this.stopInventoryPolling();
        this.inventoryInterval = setInterval(() => this.refreshInventoryUI(), 10000);
        this.refreshInventoryUI();
    }

    stopInventoryPolling() {
        if (this.inventoryInterval) {
            clearInterval(this.inventoryInterval);
            this.inventoryInterval = null;
        }
    }

    async refreshInventoryUI() {
        const grid = document.getElementById('player-inventory-grid');
        if (!grid) return;

        if (this.settings.capabilities?.inventory === false) {
            grid.innerHTML = '<div style="color: var(--text-dim); font-size: 12px;">Inventory disabled.</div>';
            return;
        }

        if (!this.isConnected || !this.botId || !window.browserAPI || !window.browserAPI.mineflayerBot) {
            grid.innerHTML = '<div style="color: var(--text-dim); font-size: 12px;">AI not connected.</div>';
            return;
        }

        try {
            const res = await window.browserAPI.mineflayerBot.getInventory(this.botId);
            if (!res || !res.success || !res.items) {
                grid.innerHTML = '<div style="color: var(--text-dim); font-size: 12px;">Inventory unavailable.</div>';
                return;
            }

            if (res.items.length === 0) {
                grid.innerHTML = '<div style="color: var(--text-dim); font-size: 12px;">Inventory empty.</div>';
                return;
            }

            grid.innerHTML = res.items.map(item => `
                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
                    <div style="font-weight: 700; color: var(--text); font-size: 13px;">${item.name.replace(/_/g,' ')}</div>
                    <div style="font-size: 12px; color: var(--text-dim);">Count: ${item.count}</div>
                    <div style="font-size: 11px; color: var(--text-dim);">Slot: ${item.slot}</div>
                </div>
            `).join('');
        } catch (e) {
            grid.innerHTML = '<div style="color: var(--text-dim); font-size: 12px;">Error fetching inventory.</div>';
        }
    }

    async executeBotCommand(command, aiResponse = null) {
        if (!this.botId) return;
        
        try {
            if (!window.browserAPI || !window.browserAPI.mineflayerBot) {
                throw new Error('Mineflayer bot not available');
            }
            
            const resolvedResponse = aiResponse || await this.sendLLMRequest(
                `Execute Minecraft command: "${command}". What should the bot do?`
            );
            const result = await window.browserAPI.mineflayerBot.executeAICommand(this.botId, command, resolvedResponse);
            
            if (result && result.success) {
                this.log(`Executed command: ${command}`, 'success');
            } else if (result) {
                this.log(`Command failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('[AIPlayer] Failed to execute command:', error);
            this.log(`Command error: ${error.message}`, 'error');
        }
    }

    async verifyAI() {
        if (!this.settings.cloudProvider) {
            return false;
        }
        return true;
    }

    async sendLLMRequest(prompt) {
        try {
            if (this.settings.provider === 'local') {
                // Local llama server API call
                const response = await fetch(`${this.settings.localServerUrl}/completion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: `${this.settings.localSystemPrompt}\n\nUser: ${prompt}\nAI:`,
                        temperature: 0.7,
                        max_tokens: 500,
                        stop: ['User:', '\nUser:']
                    })
                });

                if (!response.ok) throw new Error('Local server request failed');
                const data = await response.json();
                return data.content || data.choices[0].text;
            }

            // Cloud LLM API calls
            const provider = this.providerConfig[this.settings.cloudProvider];
            if (!provider) throw new Error(`Unknown provider: ${this.settings.cloudProvider}`);

            const modelName = this.settings.cloudModel;

            // Build request based on provider
            let url = provider.baseUrl;
            let headers = {
                'Content-Type': 'application/json'
            };
            let body = {};

            // Add authentication
            if (this.settings.cloudProvider === 'gemini') {
                // Gemini uses API key as query parameter
                url = `${provider.baseUrl}${modelName}:generateContent?key=${this.settings.cloudApiKey}`;
            } else {
                headers[provider.authHeader] = provider.authPrefix + this.settings.cloudApiKey;
            }

            // Add extra headers for OpenRouter
            if (provider.extraHeaders) {
                Object.assign(headers, provider.extraHeaders);
            }

            // Build request body based on provider
            switch (this.settings.cloudProvider) {
                case 'openai':
                case 'groq':
                case 'mistral':
                case 'openrouter':
                    body = {
                        model: modelName,
                        messages: [
                            { role: 'system', content: this.settings.localSystemPrompt },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 500
                    };
                    break;

                case 'anthropic':
                    body = {
                        model: modelName,
                        system: this.settings.localSystemPrompt,
                        messages: [
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: 500,
                        temperature: 0.7
                    };
                    break;

                case 'gemini':
                    body = {
                        contents: [{
                            parts: [{
                                text: `${this.settings.localSystemPrompt}\n\nUser: ${prompt}`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 500
                        }
                    };
                    break;

                case 'cohere':
                    body = {
                        model: modelName,
                        message: prompt,
                        preamble: this.settings.localSystemPrompt,
                        temperature: 0.7,
                        max_tokens: 500
                    };
                    break;

                case 'custom':
                    url = this.settings.customApiEndpoint || provider.baseUrl;
                    body = {
                        model: modelName,
                        messages: [
                            { role: 'system', content: this.settings.localSystemPrompt },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 500
                    };
                    break;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorData}`);
            }

            const data = await response.json();

            // Parse response based on provider
            switch (this.settings.cloudProvider) {
                case 'openai':
                case 'groq':
                case 'mistral':
                case 'openrouter':
                case 'custom':
                    return data.choices[0].message.content;

                case 'anthropic':
                    return data.content[0].text;

                case 'gemini':
                    return data.candidates[0].content.parts[0].text;

                case 'cohere':
                    return data.text;

                default:
                    return data.choices?.[0]?.message?.content || data.content?.[0]?.text || data.text || 'No response';
            }

        } catch (error) {
            console.error('[AIPlayer] LLM request error:', error);
            return `Error: ${error.message}`;
        }
    }

    async sendCommand(command) {
        if (!this.isConnected) {
            this.log('AI Player is not connected to server', 'error');
            return;
        }

        const inputEl = document.getElementById('ai-command-input');
        if (inputEl) inputEl.value = '';

        this.log(`Command received: "${command}"`, 'info');
        this.setActivity(`Executing: ${command}`);

        try {
            const aiResponse = await this.sendLLMRequest(
                `Player command: "${command}". What action should the AI take? Respond with a brief action plan.`
            );

            this.log(`AI Response: ${aiResponse}`, 'success');

            // Execute real Mineflayer action via main process
            await this.executeBotCommand(command, aiResponse);

            // Optional extra handling for direct Minecraft commands
            await this.processMinecraftCommand(command);
        } catch (error) {
            console.error('[AIPlayer] Command error:', error);
            this.log(`Command failed: ${error.message}`, 'error');
            await this.sendBotChat('Sorry, I had trouble with that command.');
        }
    }

    async processMinecraftCommand(command) {
        // Process specific Minecraft commands that can be executed
        const lowerCmd = command.toLowerCase();
        
        // Check for teleport requests
        if (lowerCmd.includes('teleport') || lowerCmd.includes('tp to')) {
            // Would use /tp command if bot has permissions
            // await this.executeBotCommand('tp @p');
        }
        
        // Check for item requests
        if (lowerCmd.includes('give me') || lowerCmd.includes('get me')) {
            // Would try to give items if possible
            // This requires the bot to have inventory management
        }
        
        // Check for time/weather commands
        if (lowerCmd.includes('time') || lowerCmd.includes('day') || lowerCmd.includes('night')) {
            // Would check time and report
        }
        
        if (lowerCmd.includes('weather')) {
            // Would check weather and report
        }
    }

    setActivity(activity) {
        this.currentActivity = activity;
        this.updateUI();
        this.log(`Activity: ${activity}`, 'info');
    }

    startScheduleChecker() {
        return;
        // Check schedule every minute
        this.scheduleInterval = setInterval(() => {
            if (this.isConnected && !this.isPlayerOnline) {
                this.checkSchedule();
            }
        }, 60000);
    }

    checkSchedule() {
        return;
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        this.schedule.forEach(item => {
            if (item.time === currentTime && item.status !== 'Completed') {
                item.status = 'In Progress';
                this.setActivity(item.activity);
                this.updateScheduleUI();
                
                // Mark as completed after 1 hour
                setTimeout(() => {
                    item.status = 'Completed';
                    this.updateScheduleUI();
                }, 3600000);
            }
        });
    }

    followSchedule() {
        return;
        // Use the new timetable system (Minecraft time-based)
        if (!Array.isArray(this.currentTimetable) || this.currentTimetable.length === 0) {
            this.generateTimetable();
        }

        const currentTime = this.currentGameTime || 0;
        let currentItem = null;

        for (let i = this.currentTimetable.length - 1; i >= 0; i--) {
            if (currentTime >= this.currentTimetable[i].gameTime) {
                currentItem = this.currentTimetable[i];
                break;
            }
        }

        if (!currentItem) {
            currentItem = this.currentTimetable[0] || null;
        }

        if (currentItem) {
            this.setActivity(`${currentItem.icon} ${currentItem.name} - ${currentItem.desc}`);
            this.updateTimetableUI();
            this.updateNextActivityPreview();
        }
    }

    // ========== NEW TIMETABLE SYSTEM ==========
    
    selectTimetable(duration) {
        return;
        console.log(`[AIPlayer] Selecting ${duration} minute timetable`);
        this.timetableDuration = duration;
        
        // Update UI
        document.querySelectorAll('.timetable-option').forEach(opt => {
            opt.classList.remove('active');
            opt.style.borderColor = 'transparent';
        });
        const selectedOption = document.querySelector(`.timetable-option[data-duration="${duration}"]`);
        if (selectedOption) {
            selectedOption.classList.add('active');
            selectedOption.style.borderColor = 'var(--accent)';
        }
        
        // Update badge
        const badge = document.getElementById('current-timetable-badge');
        if (badge) {
            badge.textContent = `${duration} Min Cycle`;
        }
        
        // Generate new timetable
        this.generateTimetable();
        this.saveSettings();
        
        this.log(`Switched to ${duration} minute activity cycle`, 'info');
    }
    
    selectServerType() {
        console.log('[AIPlayer] Setting Java Edition as server type');
        
        // Update port and protocol info
        const portInput = document.getElementById('ai-server-port');
        const protocolName = document.getElementById('protocol-name');
        const protocolFeatures = document.getElementById('protocol-features');
        
        if (portInput) portInput.value = '25565';
        if (protocolName) protocolName.textContent = 'mineflayer';
        if (protocolFeatures) protocolFeatures.textContent = 'Advanced pathfinding, block placing/breaking, inventory management';
        
        this.saveSettings();
        this.log('Java Edition selected', 'info');
    }
    
    generateTimetable() {
        return;
        // Calculate number of activities based on duration
        // Minecraft day is 20 minutes, so we divide the timetable duration accordingly
        const cycleCount = Math.ceil(this.timetableDuration / 20);
        const activitiesPerCycle = Math.floor(20 / (this.timetableDuration / cycleCount));
        const totalActivities = Math.max(4, Math.min(12, activitiesPerCycle * cycleCount));
        
        this.currentTimetable = [];
        const usedIndices = new Set();
        
        // Generate random activities
        for (let i = 0; i < totalActivities; i++) {
            let activityIndex;
            do {
                activityIndex = Math.floor(Math.random() * this.activityPool.length);
            } while (usedIndices.has(activityIndex) && usedIndices.size < this.activityPool.length);
            
            usedIndices.add(activityIndex);
            const activity = this.activityPool[activityIndex];
            
            // Calculate approximate Minecraft time for this activity
            // Minecraft day: 0-24000 (0=dawn, 6000=noon, 12000=dusk, 18000=midnight)
            const gameTimeSlot = Math.floor((i / totalActivities) * 24000);
            const displayTime = this.formatGameTime(gameTimeSlot);
            
            this.currentTimetable.push({
                index: i,
                gameTime: gameTimeSlot,
                displayTime: displayTime,
                icon: activity.icon,
                name: activity.name,
                desc: activity.desc,
                status: 'Pending'
            });
        }
        
        // Sort by game time
        this.currentTimetable.sort((a, b) => a.gameTime - b.gameTime);
        
        // Reset activity tracking
        this.currentActivityIndex = -1;
        this.lastActivityTime = 0;
        this.nextActivityTime = this.currentTimetable[0]?.gameTime || 0;
        
        this.updateTimetableUI();
        this.updateNextActivityPreview();
        
        console.log(`[AIPlayer] Generated ${totalActivities} activities for ${this.timetableDuration}min timetable`);
    }
    
    formatGameTime(ticks) {
        // Convert Minecraft ticks to readable time
        // 0 ticks = 06:00 (dawn), 6000 = 12:00 (noon), 12000 = 18:00 (dusk), 18000 = 00:00 (midnight)
        const hour = Math.floor((ticks / 1000 + 6) % 24);
        const minute = Math.floor(((ticks % 1000) / 1000) * 60);
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    
    updateTimetableUI() {
        return;
        const listEl = document.getElementById('ai-schedule-list');
        if (!listEl) return;
        
        listEl.innerHTML = this.currentTimetable.map((item, index) => `
            <div class="ai-schedule-item ${item.status === 'Active' ? 'active' : ''} ${item.status === 'Completed' ? 'completed' : ''}" data-index="${index}">
                <span class="ai-schedule-time">${item.displayTime}</span>
                <span class="ai-schedule-activity">${item.icon} ${item.name} - ${item.desc}</span>
                <span class="ai-schedule-status ${item.status.toLowerCase().replace(' ', '-')}">${item.status}</span>
            </div>
        `).join('');
    }
    
    updateNextActivityPreview() {
        return;
        const previewEl = document.getElementById('next-activity-preview');
        if (!previewEl) return;
        
        if (this.currentActivityIndex === -1) {
            const nextActivity = this.currentTimetable[0];
            if (nextActivity) {
                previewEl.innerHTML = `<span style="color: var(--accent-light);">${nextActivity.icon} ${nextActivity.name}</span> at ${nextActivity.displayTime} (Minecraft time)`;
            } else {
                previewEl.textContent = 'No activities scheduled';
            }
        } else if (this.currentActivityIndex < this.currentTimetable.length - 1) {
            const nextActivity = this.currentTimetable[this.currentActivityIndex + 1];
            previewEl.innerHTML = `<span style="color: var(--accent-light);">${nextActivity.icon} ${nextActivity.name}</span> at ${nextActivity.displayTime} (Minecraft time)`;
        } else {
            previewEl.innerHTML = '<span style="color: var(--success);">✓ All activities completed for this cycle</span>';
        }
    }
    
    startScheduleChecker() {
        return;
        // Check for activity changes every 10 seconds (simulated game time check)
        this.scheduleInterval = setInterval(() => {
            if (this.isConnected && !this.isPlayerOnline) {
                this.checkGameTimeActivity();
            }
        }, 10000);
        
        // Simulate game time progression
        this.gameTimeInterval = setInterval(() => {
            if (this.isConnected) {
                // Advance game time (20 minute day / 24000 ticks = 3.33 ticks per real second)
                this.currentGameTime = (this.currentGameTime + 3.33) % 24000;
            }
        }, 1000);
    }
    
    checkGameTimeActivity() {
        return;
        if (this.currentTimetable.length === 0) return;
        
        // Find if we should start a new activity based on game time
        for (let i = 0; i < this.currentTimetable.length; i++) {
            const activity = this.currentTimetable[i];
            
            // Check if it's time for this activity and it hasn't been started
            if (activity.status === 'Pending' && this.currentGameTime >= activity.gameTime) {
                // Add some randomness - don't trigger exactly at the time, within a window
                const randomDelay = Math.random() * 500; // 0-500 tick delay
                
                if (this.currentGameTime >= activity.gameTime + randomDelay) {
                    // Start this activity
                    activity.status = 'Active';
                    this.currentActivityIndex = i;
                    this.setActivity(`${activity.icon} ${activity.name} - ${activity.desc}`);
                    this.updateTimetableUI();
                    this.updateNextActivityPreview();
                    
                    this.log(`Started activity: ${activity.name} at ${activity.displayTime}`, 'info');
                    
                    // Mark as completed after random duration (2-5 minutes)
                    const activityDuration = (2 + Math.random() * 3) * 60 * 1000; // 2-5 minutes in ms
                    setTimeout(() => {
                        activity.status = 'Completed';
                        this.updateTimetableUI();
                    }, activityDuration);
                    
                    break;
                }
            }
        }
        
        // Check if all activities are completed, regenerate timetable
        const allCompleted = this.currentTimetable.every(a => a.status === 'Completed');
        if (allCompleted && this.currentTimetable.length > 0) {
            setTimeout(() => {
                this.log('All activities completed! Generating new timetable...', 'success');
                this.generateTimetable();
            }, 5000);
        }
    }

    startPlayerPresenceChecker() {
        // Check player presence every 30 seconds (simulated)
        this.playerCheckInterval = setInterval(() => {
            if (this.isConnected) {
                this.checkPlayerPresence();
            }
        }, 30000);
    }

    async checkPlayerPresence() {
        // This would check if the player is online in the Minecraft server
        // For now, we'll simulate this
        const wasOnline = this.isPlayerOnline;
        
        // Simulate player detection (random for demo)
        // In real implementation, this would query the Minecraft server
        // this.isPlayerOnline = await this.queryPlayerOnline();
        
        if (wasOnline !== this.isPlayerOnline) {
            if (this.isPlayerOnline) {
                this.log('Player joined the server!', 'success');
                this.setActivity('Following and protecting player');
            } else {
                this.log('Player left the server', 'info');
                this.setActivity('Autonomy active');
            }
        }
    }

    updateActivityLog() {
        const logEl = document.getElementById('ai-activity-log');
        if (!logEl) return;

        logEl.innerHTML = this.activityLog.map(item => `
            <div class="ai-activity-item">
                <span class="ai-activity-time">${item.time}</span>
                <span class="ai-activity-icon">${item.icon}</span>
                <span>${item.message}</span>
            </div>
        `).join('');
    }

    log(message, type = 'info') {
        const output = document.getElementById('ai-activity-log');
        if (!output) return;

        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;

        const timestamp = new Date().toLocaleTimeString();
        line.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;

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

    setupBotEventListeners() {
        // Set up IPC listeners for bot events (Java Edition only)
        const botApi = window.browserAPI && window.browserAPI.mineflayerBot;
        const handler = async (payload) => {
            const event = payload?.event || payload?.type;
            const data = payload?.data || payload;

            if (event === 'bot-chat-received') {
                this.log(`[Chat] ${data.username}: ${data.message}`, 'info');
            } else if (event === 'ai-command-request') {
                const fromPlayer = data.fromPlayer || data.username || 'Player';
                const command = data.command || data.fullMessage || '';
                if (command) {
                    this.log(`[Command] ${fromPlayer}: ${command}`, 'info');
                    const aiResponse = await this.sendLLMRequest(
                        `Player "${fromPlayer}" said: "${command}". Decide the best survival action and respond briefly.`
                    );
                    await this.executeBotCommand(command, aiResponse);
                }
            } else if (event === 'bot-error') {
                this.log(`[Error] ${data.error || data.message}`, 'error');
            } else if (event === 'bot-spawned') {
                this.log('AI Player spawned in world', 'success');
                this.refreshInventoryUI();
            } else if (event === 'bot-death') {
                this.log('AI Player died', 'error');
            } else if (event === 'bot-kicked') {
                this.log(`AI Player was kicked: ${data.reason}`, 'error');
                this.disconnect();
            }
        };

        if (botApi && typeof botApi.onBotEvent === 'function') {
            botApi.onBotEvent(handler);
        } else if (botApi && typeof botApi.onEvent === 'function') {
            botApi.onEvent(handler);
        }
    }

    saveSettings() {
        try {
            const settings = {
                provider: this.settings.provider,
                cloudProvider: this.settings.cloudProvider,
                cloudApiKey: this.settings.cloudApiKey,
                cloudModel: this.settings.cloudModel,
                modelMode: this.settings.modelMode,
                customModelName: this.settings.customModelName,
                customApiEndpoint: this.settings.customApiEndpoint,
                localServerUrl: this.settings.localServerUrl,
                localModelName: this.settings.localModelName,
                localSystemPrompt: this.settings.localSystemPrompt,
                aiName: this.settings.aiName,
                gameVersion: this.settings.gameVersion,
                uiShowBuildPanel: this.settings.uiShowBuildPanel,
                autonomy: this.settings.autonomy,
                capabilities: this.settings.capabilities
            };
            localStorage.setItem('aiPlayerSettings', JSON.stringify(settings));
            console.log('[AIPlayer] Settings saved');
        } catch (e) {
            console.error('[AIPlayer] Failed to save settings:', e);
        }
    }

    updateScheduleUI() {
        this.schedule.forEach(item => {
            const statusEl = document.getElementById(`schedule-${item.time}`);
            if (statusEl) {
                statusEl.textContent = item.status;
                statusEl.className = 'ai-schedule-status' + (item.status === 'In Progress' ? ' active' : '');
            }
        });
    }

    updateUI() {
        // Update status indicator
        const indicator = document.getElementById('ai-status-indicator');
        const message = document.getElementById('ai-status-message');
        const connectBtn = document.getElementById('btn-ai-connect');
        
        if (indicator) {
            indicator.className = 'ai-status-indicator' + 
                (this.isConnected ? ' online' : '') + 
                (this.currentActivity !== 'Idle' ? ' thinking' : '');
        }
        
        if (message) {
            if (this.isConnected) {
                message.textContent = `Connected - ${this.currentActivity}`;
            } else {
                message.textContent = 'Disconnected';
            }
        }

        if (connectBtn) {
            connectBtn.innerHTML = this.isConnected ? `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7" transform="rotate(180 12 12)"/>
                </svg>
                Disconnect
            ` : `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                Connect to Server
            `;
            connectBtn.className = this.isConnected ? 'btn danger' : 'btn success';
        }
    }
}

class JavaServerRenderer {
    constructor() {
        this.javaProcess = null;
        this.isRunning = false;
        this.serverPath = null;
        this.minRam = 2;
        this.maxRam = 4;
        this.port = 25565;
        this.javaExecutable = 'java.exe';
        this.startTime = null;
        this.uptimeInterval = null;
        console.log('[JavaServer] Constructor called');
    }

    init() {
        console.log('[JavaServer] Initializing...');
        this.setupEventListeners();
        this.setupIPCListeners();
        this.loadSettings();
        this.updateCommandPreview();
        this.log('Java Server Manager initialized', 'info');
        console.log('[JavaServer] Initialization complete');
    }

    setupIPCListeners() {
        if (window.browserAPI && window.browserAPI.javaServer) {
            window.browserAPI.javaServer.onOutput((data) => {
                if (data.type === 'stdout') {
                    const lines = data.data.trim().split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            this.log(line, 'info');
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

            window.browserAPI.javaServer.onExit((data) => {
                this.log(`Server exited with code: ${data.code}`, 'error');
                this.isRunning = false;
                this.setStatus('stopped');
                
                if (this.uptimeInterval) {
                    clearInterval(this.uptimeInterval);
                    this.uptimeInterval = null;
                }
                
                const startBtn = document.getElementById('btn-start-java-server');
                const stopBtn = document.getElementById('btn-stop-java-server');
                
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.style.opacity = '1';
                }
                if (stopBtn) {
                    stopBtn.disabled = true;
                    stopBtn.style.opacity = '0.5';
                }
            });
        }
    }

    setupEventListeners() {
        console.log('[JavaServer] Setting up event listeners...');

        // Browse button
        const browseBtn = document.getElementById('btn-browse-java-folder');
        if (browseBtn) {
            browseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.browseForServerFolder();
            });
        }

        // Start button
        const startBtn = document.getElementById('btn-start-java-server');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startServer();
            });
        }

        // Stop button
        const stopBtn = document.getElementById('btn-stop-java-server');
        if (stopBtn) {
            stopBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stopServer();
            });
        }

        // Clear console button
        const clearBtn = document.getElementById('btn-clear-java-console');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearConsole();
            });
        }

        // Input listeners for settings
        const inputs = ['java-server-path', 'java-min-ram', 'java-max-ram', 'java-port', 'java-executable'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    this.saveSettings();
                    this.updateCommandPreview();
                });
                input.addEventListener('input', () => {
                    this.updateSettingsFromInputs();
                    this.updateCommandPreview();
                });
            }
        });

        console.log('[JavaServer] Event listeners setup complete');
    }

    updateSettingsFromInputs() {
        const pathInput = document.getElementById('java-server-path');
        const minRamInput = document.getElementById('java-min-ram');
        const maxRamInput = document.getElementById('java-max-ram');
        const portInput = document.getElementById('java-port');
        const javaExecInput = document.getElementById('java-executable');

        if (pathInput) this.serverPath = pathInput.value.trim();
        if (minRamInput) this.minRam = parseInt(minRamInput.value) || 2;
        if (maxRamInput) this.maxRam = parseInt(maxRamInput.value) || 4;
        if (portInput) this.port = parseInt(portInput.value) || 25565;
        if (javaExecInput) this.javaExecutable = javaExecInput.value.trim() || 'java.exe';
    }

    generateCommand() {
        if (!this.serverPath) {
            return 'Select a server folder to generate command...';
        }
        
        const javaPath = this.javaExecutable || 'java';
        return `${javaPath} -Xmx${this.maxRam}G -Xms${this.minRam}G -jar server.jar`;
    }

    updateCommandPreview() {
        const commandEl = document.getElementById('java-command-preview');
        if (commandEl) {
            commandEl.textContent = this.generateCommand();
        }
    }

    async browseForServerFolder() {
        console.log('[JavaServer] browseForServerFolder called');

        if (window.browserAPI && window.browserAPI.files) {
            try {
                const folderPath = await window.browserAPI.files.selectFolder();

                if (folderPath) {
                    const pathInput = document.getElementById('java-server-path');
                    if (pathInput) {
                        pathInput.value = folderPath;
                        this.serverPath = folderPath;
                        this.saveSettings();
                        this.updateCommandPreview();
                        this.log(`Server folder selected: ${folderPath}`, 'info');
                    }
                }
            } catch (err) {
                console.error('[JavaServer] Dialog error:', err);
                this.showPathPrompt();
            }
        } else {
            this.showPathPrompt();
        }
    }

    showPathPrompt() {
        const path = prompt('Enter the path to your Minecraft server folder:', 'C:\\MinecraftServer');
        if (path) {
            const pathInput = document.getElementById('java-server-path');
            if (pathInput) {
                pathInput.value = path;
                this.serverPath = path;
                this.saveSettings();
                this.updateCommandPreview();
            }
        }
    }

    async startServer() {
        this.updateSettingsFromInputs();
        
        if (!this.serverPath) {
            this.log('Please select a server folder first', 'error');
            return;
        }

        // Validate RAM settings
        if (this.minRam > this.maxRam) {
            this.log('Min RAM cannot be greater than Max RAM', 'error');
            return;
        }

        this.log('Starting Java Server...', 'info');
        this.setStatus('starting');

        const startBtn = document.getElementById('btn-start-java-server');
        const stopBtn = document.getElementById('btn-stop-java-server');
        
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.style.opacity = '0.5';
        }
        
        if (stopBtn) {
            stopBtn.disabled = false;
            stopBtn.style.opacity = '1';
        }

        const config = {
            serverPath: this.serverPath,
            minRam: this.minRam,
            maxRam: this.maxRam,
            port: this.port,
            javaExecutable: this.javaExecutable
        };

        if (window.browserAPI && window.browserAPI.javaServer) {
            try {
                const result = await window.browserAPI.javaServer.startServer(config);

                if (result.success) {
                    this.isRunning = true;
                    this.startTime = Date.now();
                    this.startUptimeCounter();
                    this.log(`Server started with PID: ${result.pid}`, 'success');
                    this.setStatus('running');
                    
                    // Update status indicator in header
                    const statusDot = document.getElementById('status-dot');
                    const statusText = document.getElementById('status-text');
                    if (statusDot) statusDot.classList.add('online');
                    if (statusText) statusText.textContent = 'Server Running';
                } else {
                    this.log(`Failed to start server: ${result.error}`, 'error');
                    this.setStatus('stopped');
                    
                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.style.opacity = '1';
                    }
                    if (stopBtn) {
                        stopBtn.disabled = true;
                        stopBtn.style.opacity = '0.5';
                    }
                }
            } catch (err) {
                console.error('[JavaServer] Error starting server:', err);
                this.log(`Error starting server: ${err.message || err}`, 'error');
                this.setStatus('stopped');
                
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.style.opacity = '1';
                }
                if (stopBtn) {
                    stopBtn.disabled = true;
                    stopBtn.style.opacity = '0.5';
                }
            }
        } else {
            this.log('Java Server API not available', 'error');
            this.setStatus('stopped');
            
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.style.opacity = '1';
            }
            if (stopBtn) {
                stopBtn.disabled = true;
                stopBtn.style.opacity = '0.5';
            }
        }
    }

    async stopServer() {
        this.log('Stopping server...', 'info');

        const startBtn = document.getElementById('btn-start-java-server');
        const stopBtn = document.getElementById('btn-stop-java-server');
        
        if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.textContent = 'Stopping...';
        }

        if (window.browserAPI && window.browserAPI.javaServer) {
            try {
                const result = await window.browserAPI.javaServer.stopServer();

                if (result.success) {
                    this.isRunning = false;
                    if (this.uptimeInterval) {
                        clearInterval(this.uptimeInterval);
                        this.uptimeInterval = null;
                    }
                    this.log('Server stopped.', 'success');
                    this.setStatus('stopped');

                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.style.opacity = '1';
                    }
                    if (stopBtn) {
                        stopBtn.disabled = true;
                        stopBtn.style.opacity = '0.5';
                        stopBtn.textContent = 'Stop Server';
                    }

                    // Update status indicator in header
                    const statusDot = document.getElementById('status-dot');
                    const statusText = document.getElementById('status-text');
                    if (statusDot) statusDot.classList.remove('online');
                    if (statusText) statusText.textContent = 'Server Offline';
                } else {
                    this.log(`Failed to stop server: ${result.error}`, 'error');
                    if (stopBtn) {
                        stopBtn.disabled = false;
                        stopBtn.textContent = 'Stop Server';
                    }
                }
            } catch (err) {
                console.error('[JavaServer] Error stopping server:', err);
                this.log(`Error stopping server: ${err.message || err}`, 'error');
                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.textContent = 'Stop Server';
                }
            }
        }
    }

    setStatus(status) {
        const statusIndicator = document.getElementById('java-status-indicator');
        const statusText = document.getElementById('java-status-text');
        
        if (statusIndicator) {
            statusIndicator.className = 'java-status-indicator';
            if (status === 'running') statusIndicator.classList.add('online');
            if (status === 'starting') statusIndicator.classList.add('starting');
        }
        
        if (statusText) {
            const labels = {
                stopped: 'Server Stopped',
                starting: 'Starting...',
                running: 'Server Running'
            };
            statusText.textContent = labels[status] || status;
        }
    }

    log(message, type = 'info') {
        const output = document.getElementById('java-console-output');
        if (!output) return;

        const line = document.createElement('div');
        line.className = `java-console-line ${type}`;
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

    clearConsole() {
        const output = document.getElementById('java-console-output');
        if (output) {
            output.innerHTML = '<div class="java-console-line info">Console cleared.</div>';
        }
    }

    startUptimeCounter() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
        }
        this.uptimeInterval = setInterval(() => {
            if (this.isRunning && this.startTime) {
                const uptime = Date.now() - this.startTime;
                const hours = Math.floor(uptime / 3600000).toString().padStart(2, '0');
                const minutes = Math.floor((uptime % 3600000) / 60000).toString().padStart(2, '0');
                const seconds = Math.floor((uptime % 60000) / 1000).toString().padStart(2, '0');
                const uptimeEl = document.getElementById('java-uptime');
                if (uptimeEl) {
                    uptimeEl.textContent = `${hours}:${minutes}:${seconds}`;
                }
            }
        }, 1000);
    }

    saveSettings() {
        try {
            const settings = {
                serverPath: this.serverPath,
                minRam: this.minRam,
                maxRam: this.maxRam,
                port: this.port,
                javaExecutable: this.javaExecutable
            };
            localStorage.setItem('java-server-settings', JSON.stringify(settings));
            console.log('[JavaServer] Settings saved');
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    loadSettings() {
        console.log('[JavaServer] loadSettings called');
        try {
            const saved = localStorage.getItem('java-server-settings');
            if (saved) {
                console.log('[JavaServer] Found saved settings');
                const settings = JSON.parse(saved);

                this.serverPath = settings.serverPath || null;
                this.minRam = settings.minRam || 2;
                this.maxRam = settings.maxRam || 4;
                this.port = settings.port || 25565;
                this.javaExecutable = settings.javaExecutable || 'java.exe';

                // Update UI inputs
                const pathInput = document.getElementById('java-server-path');
                const minRamInput = document.getElementById('java-min-ram');
                const maxRamInput = document.getElementById('java-max-ram');
                const portInput = document.getElementById('java-port');
                const javaExecInput = document.getElementById('java-executable');

                if (pathInput && this.serverPath) {
                    pathInput.value = this.serverPath;
                }
                if (minRamInput) {
                    minRamInput.value = this.minRam;
                }
                if (maxRamInput) {
                    maxRamInput.value = this.maxRam;
                }
                if (portInput) {
                    portInput.value = this.port;
                }
                if (javaExecInput) {
                    javaExecInput.value = this.javaExecutable;
                }

                console.log('[JavaServer] Settings loaded successfully');
            } else {
                console.log('[JavaServer] No saved settings found');
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
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
                    
                    // Disable command input when server stops
                    if (cmdInput) {
                        cmdInput.readOnly = true;
                        cmdInput.placeholder = 'Type command and press Enter...';
                        cmdInput.style.color = 'var(--text-dim)';
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

    try {
        window.serverRenderer = new ServerRenderer();
        window.serverRenderer.init();
        console.log('[ServerRenderer] Successfully initialized');
    } catch (err) {
        console.error('[ServerRenderer] Initialization error:', err);
    }

    try {
        window.llamaCLIRenderer = new LlamaCLIRenderer();
        window.llamaCLIRenderer.init();
        console.log('[LlamaCLI] Successfully initialized');
    } catch (err) {
        console.error('[LlamaCLI] Initialization error:', err);
    }

    try {
        window.aiPlayerRenderer = new AIPlayerRenderer();
        window.aiPlayerRenderer.init();
        console.log('[AIPlayer] Successfully initialized');
    } catch (err) {
        console.error('[AIPlayer] Initialization error:', err);
    }

    try {
        window.pocketTTSRenderer = new PocketTTSRenderer();
        window.pocketTTSRenderer.init();
        console.log('[PocketTTS] Successfully initialized');
    } catch (err) {
        console.error('[PocketTTS] Initialization error:', err);
    }

    try {
        window.javaServerRenderer = new JavaServerRenderer();
        window.javaServerRenderer.init();
        console.log('[JavaServer] Successfully initialized');
    } catch (err) {
        console.error('[JavaServer] Initialization error:', err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMinecraft);
} else {
    initMinecraft();
}
