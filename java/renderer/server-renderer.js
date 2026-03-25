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
                <span class="terminal-line-message">No important llama events yet. Start the server to see errors, start/stop activity, and server links.</span>
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

function isLlamaOperatorLogEntry(entry = {}) {
    const type = String(entry?.type || '').trim().toLowerCase();
    const message = String(entry?.message || '').trim();
    if (!message) return false;

    if (type === 'error') return true;

    if (/https?:\/\/\S+/i.test(message)) return true;

    if (/(^|\b)(starting llama server|llama server started successfully|stopping llama server|llama server stopped|server exited with code|server listening on|api endpoint:|public url:|llama public url:)(\b|$)/i.test(message)) {
        return true;
    }

    if (/(^|\b)(failed|error|exception|timed out|cannot|unable|denied|invalid|triggered|ejected)(\b|$)/i.test(message)) {
        return true;
    }

    return false;
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
        this.guardStatusInterval = null;
        this.latestModelInfo = null;
        this.latestSystemProfile = null;
        this.latestCompatibility = null;
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
        this.startGuardStatusPolling();
        this.log('Llama Server Manager initialized', 'info');
        console.log('[LlamaServer] Initialization complete');
    }

    async updateGPUDisplay() {
        const memoryEl = document.getElementById('gpu-memory-available');
        if (!memoryEl) return;

        const available = await this.getAvailableGPUMemory();
        memoryEl.textContent = `${available} MB`;
        this.updateCompatibilityCalculator();
    }

    setupIPCListeners() {
        if (window.browserAPI && window.browserAPI.llama) {
            window.browserAPI.llama.onOutput((data) => {
                const type = data.type === 'stderr' ? 'warning' : (data.type === 'error' ? 'error' : 'info');
                String(data.data || '')
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .forEach((line) => this.log(line, type, { forceDisplay: false }));
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
                this.refreshGuardStatus({ silent: true });
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

        const inputs = [
            'context-length',
            'gpu-layers',
            'llama-port',
            'llama-threads',
            'llama-host',
            'llama-system-prompt',
            'llama-guard-enabled',
            'llama-guard-warn-percent',
            'llama-guard-stop-percent',
            'llama-guard-min-free-mb',
            'llama-guard-consecutive-hits'
        ];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => this.saveSettings());
                input.addEventListener('input', () => {
                    this.updateManualCommand();
                    if (id === 'llama-port' || id === 'llama-host') {
                        this.updateEndpoint();
                    }
                    if (id === 'context-length' || id === 'gpu-layers') {
                        this.updateCompatibilityCalculator();
                    }
                });
            }
        });

        // Copy command button
        const copyBtn = document.getElementById('btn-copy-llama-command');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyLlamaCommand());
        }

        const copyServerBtn = document.getElementById('btn-copy-llama-server-command');
        if (copyServerBtn) {
            copyServerBtn.addEventListener('click', () => this.copyLlamaServerCommand());
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

    getSystemPrompt() {
        return String(document.getElementById('llama-system-prompt')?.value || '').trim();
    }

    getGuardSettings() {
        return {
            enabled: (document.getElementById('llama-guard-enabled')?.value || 'enabled') !== 'disabled',
            warnRamPercent: Number(document.getElementById('llama-guard-warn-percent')?.value || '88'),
            stopRamPercent: Number(document.getElementById('llama-guard-stop-percent')?.value || '93'),
            minFreeRamMB: Number(document.getElementById('llama-guard-min-free-mb')?.value || '2048'),
            consecutiveHits: Number(document.getElementById('llama-guard-consecutive-hits')?.value || '2')
        };
    }

    applyGuardSettings(settings = {}) {
        const enabledInput = document.getElementById('llama-guard-enabled');
        if (enabledInput) enabledInput.value = settings.enabled === false ? 'disabled' : 'enabled';

        const warnInput = document.getElementById('llama-guard-warn-percent');
        if (warnInput && Number.isFinite(Number(settings.warnRamPercent))) warnInput.value = String(settings.warnRamPercent);

        const stopInput = document.getElementById('llama-guard-stop-percent');
        if (stopInput && Number.isFinite(Number(settings.stopRamPercent))) stopInput.value = String(settings.stopRamPercent);

        const freeInput = document.getElementById('llama-guard-min-free-mb');
        if (freeInput && Number.isFinite(Number(settings.minFreeRamMB))) freeInput.value = String(settings.minFreeRamMB);

        const hitsInput = document.getElementById('llama-guard-consecutive-hits');
        if (hitsInput && Number.isFinite(Number(settings.consecutiveHits))) hitsInput.value = String(settings.consecutiveHits);
    }

    updateGuardStatus(guard = null) {
        const statusEl = document.getElementById('llama-guard-status');
        const usedEl = document.getElementById('llama-guard-ram-used');
        const freeEl = document.getElementById('llama-guard-ram-free');
        const actionEl = document.getElementById('llama-guard-last-action');

        const pressureLabels = {
            idle: 'Idle',
            safe: 'Protected',
            warning: 'Warning',
            critical: 'Critical',
            tripped: 'Model Ejected',
            disabled: 'Disabled'
        };

        const pressure = String(guard?.pressure || 'idle').trim().toLowerCase();
        if (statusEl) statusEl.textContent = pressureLabels[pressure] || 'Idle';
        if (usedEl) {
            usedEl.textContent = Number.isFinite(Number(guard?.lastSample?.usedPercent))
                ? `${guard.lastSample.usedPercent}% (${guard.lastSample.usedMB} MB)`
                : '--';
        }
        if (freeEl) {
            freeEl.textContent = Number.isFinite(Number(guard?.lastSample?.freeMB))
                ? `${guard.lastSample.freeMB} MB`
                : '--';
        }
        if (actionEl) {
            actionEl.textContent = String(guard?.lastAction || 'Watching system memory.');
        }
    }

    startGuardStatusPolling() {
        if (this.guardStatusInterval) {
            clearInterval(this.guardStatusInterval);
        }
        this.guardStatusInterval = setInterval(() => {
            this.refreshGuardStatus({ silent: true });
        }, 4000);
    }

    escapePowerShellDoubleQuotedString(value) {
        return String(value || '').replace(/`/g, '``').replace(/"/g, '`"');
    }

    formatGB(value) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric <= 0) return '0.00 GB';
        if (numeric < 10) return `${numeric.toFixed(2)} GB`;
        return `${numeric.toFixed(1)} GB`;
    }

    getColorForPercent(percent) {
        if (percent < 60) return 'var(--success)';
        if (percent < 90) return 'var(--warning)';
        return 'var(--danger)';
    }

    parseModelMetadata(modelName, info = null) {
        const raw = String(modelName || '').trim();
        const lower = raw.toLowerCase();
        const sizeMB = Number(info?.size || 0);

        const paramPatterns = [
            /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)b/i,
            /(\d+(?:\.\d+)?)b/i,
            /(\d+(?:\.\d+)?)m/i
        ];

        let paramsB = null;
        for (const pattern of paramPatterns) {
            const match = lower.match(pattern);
            if (!match) continue;
            if (pattern.source.includes('x')) {
                paramsB = Number(match[1]) * Number(match[2]);
            } else if (match[0].endsWith('m')) {
                paramsB = Number(match[1]) / 1000;
            } else {
                paramsB = Number(match[1]);
            }
            break;
        }
        if (!Number.isFinite(paramsB) || paramsB <= 0) {
            paramsB = sizeMB > 0 ? Math.max(1, Math.round((sizeMB / 1024) * 1.8)) : 7;
        }

        const quantMap = [
            { pattern: /q2[_-]?k/i, name: 'Q2_K', bits: 2 },
            { pattern: /q3[_-]?(k|km|ks|m)/i, name: 'Q3_K_M', bits: 3 },
            { pattern: /q4[_-]?(k[_-]?m|km|k|0|1|m)/i, name: 'Q4_K_M', bits: 4 },
            { pattern: /q5[_-]?(k[_-]?m|km|k|m)/i, name: 'Q5_K_M', bits: 5 },
            { pattern: /q6[_-]?k/i, name: 'Q6_K', bits: 6 },
            { pattern: /q8[_-]?0|q8/i, name: 'Q8_0', bits: 8 },
            { pattern: /fp16|f16/i, name: 'FP16', bits: 16 },
            { pattern: /fp32|f32/i, name: 'FP32', bits: 32 },
            { pattern: /gptq/i, name: 'GPTQ-4', bits: 4.5 },
            { pattern: /awq/i, name: 'AWQ', bits: 8 },
            { pattern: /iq4/i, name: 'IQ4', bits: 4 },
            { pattern: /iq3/i, name: 'IQ3', bits: 3 },
            { pattern: /iq2/i, name: 'IQ2', bits: 2 }
        ];

        let quant = { name: 'Q4_K_M', bits: 4 };
        for (const candidate of quantMap) {
            if (candidate.pattern.test(lower)) {
                quant = { name: candidate.name, bits: candidate.bits };
                break;
            }
        }

        let arch = 'transformer';
        if (/mixtral|moe|8x\d+b|experts?/i.test(lower)) arch = 'moe';
        else if (/mamba/i.test(lower)) arch = 'mamba';
        else if (/qwen/i.test(lower)) arch = 'qwen';
        else if (/llama|mistral|gemma|phi|deepseek/i.test(lower)) arch = 'transformer';

        return {
            modelName: raw,
            paramsB,
            quantName: quant.name,
            bits: quant.bits,
            arch,
            actualSizeGB: sizeMB > 0 ? sizeMB / 1024 : 0
        };
    }

    estimateLayers(paramsB, arch) {
        if (arch === 'moe') return Math.round(Math.max(16, Math.log2(paramsB * 8) * 8));
        if (arch === 'mamba') return Math.round(paramsB * 5.5 + 12);
        const layerMap = [[0.5, 12], [1, 16], [3, 26], [7, 32], [13, 40], [30, 60], [70, 80], [120, 96], [180, 112], [405, 128]];
        for (const [params, layers] of layerMap) {
            if (paramsB <= params) return layers;
        }
        return Math.round(paramsB * 0.32);
    }

    estimateHiddenSize(paramsB, arch) {
        if (arch === 'mamba') return Math.round(Math.sqrt(paramsB * 1e9 / 12));
        const sizeMap = [[0.5, 1024], [1, 2048], [3, 3200], [7, 4096], [13, 5120], [30, 6656], [70, 8192], [120, 9216], [180, 10240], [405, 16384]];
        for (const [params, hidden] of sizeMap) {
            if (paramsB <= params) return hidden;
        }
        return Math.round(Math.sqrt(paramsB * 1e9 / 64));
    }

    calcModelWeightsGB(paramsB, bits, actualSizeGB = 0) {
        if (actualSizeGB > 0) return actualSizeGB;
        const overhead = bits < 8 ? 1.05 : 1.02;
        return (paramsB * 1e9 * bits / 8 / 1e9) * overhead;
    }

    calcKVCacheGB(paramsB, contextLength, arch, bits) {
        const layers = this.estimateLayers(paramsB, arch);
        const hidden = this.estimateHiddenSize(paramsB, arch);
        const dtypeBytes = Math.max(2, bits / 8);
        const kvBytes = 2 * layers * hidden * contextLength * dtypeBytes;
        return kvBytes / 1e9;
    }

    calcOverheadGB(modelGB) {
        return Math.max(0.5, modelGB * 0.08);
    }

    async getSystemMemoryProfile() {
        if (window.browserAPI?.servers?.getStatus) {
            try {
                const statusRes = await window.browserAPI.servers.getStatus('llama');
                const sample = statusRes?.status?.guard?.lastSample;
                if (sample) {
                    const profile = {
                        totalRamGB: Number(sample.totalMB || 0) / 1024,
                        freeRamGB: Number(sample.freeMB || 0) / 1024,
                        usedRamGB: Number(sample.usedMB || 0) / 1024,
                        usedPercent: Number(sample.usedPercent || 0)
                    };
                    this.latestSystemProfile = profile;
                    return profile;
                }
            } catch (_) {}
        }

        return this.latestSystemProfile || {
            totalRamGB: 16,
            freeRamGB: 8,
            usedRamGB: 8,
            usedPercent: 50
        };
    }

    buildCompatibilityRecommendations(summary) {
        const recos = [];
        const {
            runMode,
            totalRequiredGB,
            availableVramGB,
            availableRamGB,
            paramsB,
            bits,
            contextLength,
            quantName,
            modelWeightsGB,
            kvCacheGB,
            layers,
            gpuLayers
        } = summary;

        if (runMode === 'none') {
            recos.push({ tone: 'danger', text: `This model needs about ${this.formatGB(totalRequiredGB * 1.1)} of usable memory, but the system currently has only ${this.formatGB(availableVramGB + availableRamGB)} available.` });
            recos.push({ tone: 'warning', text: `Try a smaller model or a stronger quantization. A Q4 or Q3 variant of roughly ${Math.max(1, Math.floor(paramsB / 2))}B would be much safer on this machine.` });
            return recos;
        }

        if (bits <= 3) {
            recos.push({ tone: 'warning', text: `Low-bit quantization (${bits}-bit) should fit more easily, but quality loss is noticeable. Q4_K_M is usually the better balance when it fits.` });
        } else if (quantName === 'Q4_K_M' || bits === 4) {
            recos.push({ tone: 'success', text: `Q4-class quantization is usually the sweet spot here: much smaller than FP16 while keeping strong quality.` });
        } else if (bits >= 8) {
            recos.push({ tone: 'info', text: `This is a higher-precision file. If memory gets tight, a Q5_K_M or Q4_K_M build would save a lot of space with small quality loss.` });
        }

        if (kvCacheGB > modelWeightsGB * 0.5) {
            recos.push({ tone: 'warning', text: `KV cache is heavy at the current context length. Dropping context from ${contextLength} to ${Math.max(1024, Math.round(contextLength / 2 / 512) * 512)} would noticeably reduce memory pressure.` });
        }

        if (runMode === 'partial') {
            recos.push({ tone: 'warning', text: `This should run in hybrid GPU+RAM mode with about ${gpuLayers}/${layers} layers on GPU. It will work, but speed will be limited by CPU/RAM offload.` });
        } else if (runMode === 'cpu') {
            recos.push({ tone: 'warning', text: `This looks CPU-only on current free resources. It may still run, but expect slow generation compared with full GPU fit.` });
        } else if (runMode === 'full') {
            recos.push({ tone: 'success', text: `This model should fully fit in current GPU memory. You have headroom for this setup and can likely increase context moderately if needed.` });
        }

        return recos;
    }

    async updateCompatibilityCalculator(info = this.latestModelInfo) {
        const labelEl = document.getElementById('llama-compat-label');
        const descEl = document.getElementById('llama-compat-desc');
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        if (!this.selectedModel) {
            this.latestCompatibility = null;
            setText('llama-compat-params', '--');
            setText('llama-compat-quant', '--');
            setText('llama-compat-mode', '--');
            setText('llama-compat-gpu-layers', '--');
            setText('llama-compat-weights', '--');
            setText('llama-compat-kv', '--');
            setText('llama-compat-total', '--');
            setText('llama-compat-arch', '--');
            const metersEl = document.getElementById('llama-compat-meters');
            if (metersEl) metersEl.innerHTML = '';
            const configBody = document.getElementById('llama-compat-config-body');
            if (configBody) {
                configBody.innerHTML = '<tr><td style="padding: 10px 12px; color: var(--text-dim); border-bottom: 1px solid var(--border);">Status</td><td style="padding: 10px 12px; color: var(--text); border-bottom: 1px solid var(--border);">Select a model to calculate</td></tr>';
            }
            const recosEl = document.getElementById('llama-compat-recos');
            if (recosEl) recosEl.innerHTML = '';
            if (labelEl) labelEl.textContent = 'Waiting for model selection';
            if (descEl) descEl.textContent = 'Choose a `.gguf` model and Om-X will estimate params, quantization, KV cache, memory overhead, and whether it fits your current system.';
            return;
        }

        const metadata = this.parseModelMetadata(this.selectedModel, info || null);
        const system = await this.getSystemMemoryProfile();
        const availableVramGB = (await this.getAvailableGPUMemory()) / 1024;
        const availableRamGB = Math.max(0.5, Number(system.freeRamGB || 0));
        const contextLength = Number(document.getElementById('context-length')?.value || 4096);
        const layers = this.estimateLayers(metadata.paramsB, metadata.arch);
        const modelWeightsGB = this.calcModelWeightsGB(metadata.paramsB, metadata.bits, metadata.actualSizeGB);
        const kvCacheGB = this.calcKVCacheGB(metadata.paramsB, contextLength, metadata.arch, metadata.bits);
        const overheadGB = this.calcOverheadGB(modelWeightsGB);
        const totalRequiredGB = modelWeightsGB + kvCacheGB + overheadGB;

        const canGpuFull = availableVramGB > 0 && availableVramGB >= totalRequiredGB;
        const canGpuPartial = availableVramGB > 0 && availableVramGB >= modelWeightsGB * 0.35 && availableRamGB >= Math.max(1, (totalRequiredGB - availableVramGB) * 1.1);
        const canCpuOnly = availableRamGB >= totalRequiredGB * 1.1;

        let runMode = 'none';
        let label = 'Not Compatible';
        let desc = `This setup needs about ${this.formatGB(totalRequiredGB)} before safety margin, which is beyond current free memory.`;
        if (canGpuFull) {
            runMode = 'full';
            label = 'Compatible on GPU';
            desc = `The selected model should fit fully in current GPU memory with this context length.`;
        } else if (canGpuPartial) {
            runMode = 'partial';
            label = 'Compatible with GPU + RAM Offload';
            desc = `The model should run in hybrid mode by placing some layers on GPU and the rest in system RAM.`;
        } else if (canCpuOnly) {
            runMode = 'cpu';
            label = 'Compatible on CPU RAM Only';
            desc = `The model should run from system RAM only, but inference will be slower than a full GPU fit.`;
        }

        let gpuLayers = 0;
        if (runMode === 'full') gpuLayers = layers;
        else if (runMode === 'partial') gpuLayers = Math.max(1, Math.min(layers, Math.floor((availableVramGB / Math.max(totalRequiredGB, 0.01)) * layers)));

        this.latestCompatibility = {
            runMode,
            totalRequiredGB,
            availableVramGB,
            availableRamGB,
            modelWeightsGB,
            kvCacheGB,
            layers,
            gpuLayers
        };

        setText('llama-compat-params', `${metadata.paramsB.toFixed(metadata.paramsB < 10 ? 1 : 0)}B`);
        setText('llama-compat-quant', `${metadata.quantName} (${metadata.bits}-bit)`);
        setText('llama-compat-mode', runMode === 'full' ? 'Full GPU' : runMode === 'partial' ? 'Hybrid' : runMode === 'cpu' ? 'CPU Only' : 'Insufficient');
        setText('llama-compat-gpu-layers', `${gpuLayers} / ${layers}`);
        setText('llama-compat-weights', this.formatGB(modelWeightsGB));
        setText('llama-compat-kv', this.formatGB(kvCacheGB));
        setText('llama-compat-total', this.formatGB(totalRequiredGB));
        setText('llama-compat-arch', `${String(metadata.arch).toUpperCase()} (~${layers} layers)`);

        if (labelEl) labelEl.textContent = label;
        if (descEl) descEl.textContent = desc;

        const statusEl = document.getElementById('model-status');
        if (statusEl) {
            statusEl.textContent = runMode === 'full'
                ? 'Compatible'
                : runMode === 'partial'
                    ? 'Hybrid Fit'
                    : runMode === 'cpu'
                        ? 'CPU Only'
                        : 'Not Compatible';
        }

        const warningEl = document.getElementById('model-warning');
        const warningTextEl = document.getElementById('model-warning-text');
        if (warningEl) {
            if (runMode === 'none') warningEl.classList.remove('hidden');
            else warningEl.classList.add('hidden');
        }
        if (warningTextEl) {
            warningTextEl.textContent = runMode === 'none'
                ? `This model needs about ${this.formatGB(totalRequiredGB)} plus safety margin, which is higher than current free GPU + RAM capacity.`
                : runMode === 'partial'
                    ? 'This model should work with GPU + RAM offload. Expect slower performance than a full VRAM fit.'
                    : runMode === 'cpu'
                        ? 'This model should work from system RAM only. It is compatible, but generation speed will be limited.'
                        : 'Model should fit the current system.';
        }

        const metersEl = document.getElementById('llama-compat-meters');
        if (metersEl) {
            const vramPercent = Math.min(100, (totalRequiredGB / Math.max(availableVramGB, 0.1)) * 100);
            const ramPercent = Math.min(100, (totalRequiredGB / Math.max(availableRamGB, 0.1)) * 100);
            metersEl.innerHTML = [
                { label: 'Available GPU Memory', value: `${this.formatGB(Math.min(totalRequiredGB, availableVramGB))} / ${this.formatGB(availableVramGB)}`, pct: vramPercent },
                { label: 'Free System RAM', value: `${this.formatGB(totalRequiredGB)} / ${this.formatGB(availableRamGB)}`, pct: ramPercent }
            ].map((item) => `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
                        <span style="color: var(--text-dim);">${item.label}</span>
                        <span style="color: var(--text);">${item.value}</span>
                    </div>
                    <div style="height: 8px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden;">
                        <div style="height: 100%; width: ${Math.min(100, item.pct)}%; background: ${this.getColorForPercent(item.pct)}; border-radius: 999px;"></div>
                    </div>
                </div>
            `).join('');
        }

        const configBody = document.getElementById('llama-compat-config-body');
        if (configBody) {
            const rows = [
                ['Detected model file', metadata.modelName],
                ['Current context', `${contextLength} tokens`],
                ['Recommended GPU layers', runMode === 'none' ? '0' : runMode === 'full' ? 'All layers' : `${gpuLayers} of ${layers}`],
                ['Suggested threads', runMode === 'cpu' ? `${Math.min(navigator.hardwareConcurrency || 8, 8)}` : `${Math.min(navigator.hardwareConcurrency || 4, 4)}`],
                ['Suggested quant', runMode === 'none' ? 'Try Q4_K_M / Q3_K_M / smaller model' : metadata.quantName],
                ['Current system RAM', `${this.formatGB(system.totalRamGB)} total, ${this.formatGB(system.freeRamGB)} free`]
            ];
            configBody.innerHTML = rows.map(([key, value]) => `
                <tr>
                    <td style="padding: 10px 12px; color: var(--text-dim); border-bottom: 1px solid var(--border); white-space: nowrap;">${escapeHtml(key)}</td>
                    <td style="padding: 10px 12px; color: var(--text); border-bottom: 1px solid var(--border);">${escapeHtml(String(value))}</td>
                </tr>
            `).join('');
        }

        const recosEl = document.getElementById('llama-compat-recos');
        if (recosEl) {
            const recommendations = this.buildCompatibilityRecommendations({
                runMode,
                totalRequiredGB,
                availableVramGB,
                availableRamGB,
                paramsB: metadata.paramsB,
                bits: metadata.bits,
                contextLength,
                quantName: metadata.quantName,
                modelWeightsGB,
                kvCacheGB,
                layers,
                gpuLayers
            });
            recosEl.innerHTML = recommendations.map((item) => {
                const color = item.tone === 'success' ? 'var(--success)' : item.tone === 'warning' ? 'var(--warning)' : item.tone === 'danger' ? 'var(--danger)' : 'var(--accent-light)';
                return `
                    <div style="display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,0.02);">
                        <div style="width: 8px; height: 8px; border-radius: 999px; margin-top: 6px; background: ${color}; flex: 0 0 auto;"></div>
                        <div style="font-size: 12px; line-height: 1.6; color: var(--text);">${item.text}</div>
                    </div>
                `;
            }).join('');
        }
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
        const systemPrompt = this.getSystemPrompt();
        const systemPromptArg = systemPrompt
            ? ` --system-prompt "${this.escapePowerShellDoubleQuotedString(systemPrompt)}"`
            : '';

        return `& "${this.llamaPath}" -m "${modelPath}" -c ${contextLength} -ngl ${gpuLayers} --port ${port} -t ${threads} --host ${host}${systemPromptArg}`;
    }

    updateManualCommand() {
        const cliCommandEl = document.getElementById('llama-manual-command');
        if (cliCommandEl) {
            cliCommandEl.textContent = this.generateManualCommand();
        }

        const serverCommandEl = document.getElementById('llama-server-command');
        if (serverCommandEl) {
            serverCommandEl.textContent = this.generateServerCommand() || 'Configure server executable and model to generate llama-server command...';
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

    copyLlamaServerCommand() {
        const command = this.generateServerCommand();
        if (command) {
            navigator.clipboard.writeText(command).then(() => {
                this.log('Server command copied to clipboard!', 'success');
            }).catch(err => {
                console.error('[LlamaServer] Failed to copy server command:', err);
                this.log('Failed to copy server command', 'error');
            });
        } else {
            this.log('Configure server executable and model first', 'warning');
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
            this.latestModelInfo = null;
            this.updateModelInfo(null);
            const modelEl = document.getElementById('llama-status-model');
            if (modelEl) modelEl.textContent = 'Model: --';
            await this.updateCompatibilityCalculator(null);
            return;
        }

        this.log(`Model selected: ${modelName}`, 'info');
        this.updateManualCommand();
        
        // Update status bar model
        const modelEl = document.getElementById('llama-status-model');
        if (modelEl) modelEl.textContent = `Model: ${modelName}`;
        
        await this.checkModelRequirements(modelName);
        await this.updateCompatibilityCalculator(this.latestModelInfo);
    }

    async checkModelRequirements(modelName) {
        this.updateManualCommand();
        await this.checkModelRequirements(modelName);
    }

    async checkModelRequirements(modelName) {
        if (window.browserAPI && window.browserAPI.llama) {
            try {
                const info = await window.browserAPI.llama.checkModelSize(this.modelsPath, modelName);
                this.latestModelInfo = info;
                this.updateModelInfo(info);
            } catch (err) {
                console.error('[LlamaServer] Error checking model:', err);
                this.latestModelInfo = null;
            }
        } else {
            this.latestModelInfo = null;
            this.estimateModelSize(modelName);
        }
        await this.updateCompatibilityCalculator(this.latestModelInfo);
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
        this.updateCompatibilityCalculator(info || this.latestModelInfo);
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

        await this.updateCompatibilityCalculator(this.latestModelInfo);
        if (this.latestCompatibility?.runMode === 'none') {
            this.log('Cannot load model: current system compatibility check says it does not fit available GPU + RAM.', 'error');
            return;
        }

        const contextLength = document.getElementById('context-length').value || '4096';
        const gpuLayers = document.getElementById('gpu-layers').value || '-1';
        const port = document.getElementById('llama-port').value || '8080';
        const threads = document.getElementById('llama-threads').value || '4';
        const serverType = this.normalizeServerType(document.getElementById('llama-host').value || 'local');
        const bindHost = this.resolveBindHost(serverType);
        const systemPrompt = this.getSystemPrompt();
        const guardSettings = this.getGuardSettings();

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
                    systemPrompt,
                    guardSettings,
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
                    this.refreshGuardStatus({ silent: true });
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

    log(message, type = 'info', options = {}) {
        const text = String(message ?? '');
        const { forceDisplay = true } = options;
        const level = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
        console[level](`[LlamaServer] ${text}`);

        const output = document.getElementById('llama-terminal-output');
        if (!output) return;
        const entry = {
            type,
            source: 'Llama',
            message: text
        };
        if (!forceDisplay && !isLlamaOperatorLogEntry(entry)) {
            return;
        }
        appendTerminalLine(output, {
            ...entry
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
                host: document.getElementById('llama-host')?.value || '127.0.0.1',
                systemPrompt: document.getElementById('llama-system-prompt')?.value || '',
                guardSettings: this.getGuardSettings()
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

                if (typeof settings.systemPrompt === 'string') {
                    const input = document.getElementById('llama-system-prompt');
                    if (input) input.value = settings.systemPrompt;
                }

                if (settings.guardSettings && typeof settings.guardSettings === 'object') {
                    this.applyGuardSettings(settings.guardSettings);
                } else {
                    this.applyGuardSettings();
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
                this.applyGuardSettings(status?.guard?.settings || status?.config?.guardSettings || this.getGuardSettings());
                this.updateGuardStatus(status?.guard || null);
            } else {
                this.isRunning = false;
                this.startTime = null;
                this.setStatus('offline');
                this.updateEndpoint();
                this.updateGuardStatus(statusRes?.status?.guard || null);
            }

            await this.refreshLogs({ silent: true });
            await this.refreshGuardStatus({ silent: true });
        } catch (e) {
            console.warn('[LlamaServer] Failed to load runtime state:', e);
        }
    }

    async refreshGuardStatus(options = {}) {
        if (!window.browserAPI?.servers) return;

        const { silent = false } = options;
        try {
            const statusRes = await window.browserAPI.servers.getStatus('llama');
            if (statusRes?.success) {
                const sample = statusRes.status?.guard?.lastSample;
                if (sample) {
                    this.latestSystemProfile = {
                        totalRamGB: Number(sample.totalMB || 0) / 1024,
                        freeRamGB: Number(sample.freeMB || 0) / 1024,
                        usedRamGB: Number(sample.usedMB || 0) / 1024,
                        usedPercent: Number(sample.usedPercent || 0)
                    };
                }
                this.updateGuardStatus(statusRes.status?.guard || null);
                this.updateCompatibilityCalculator(this.latestModelInfo);
                return;
            }

            if (!silent) {
                this.log(`Failed to refresh protection status: ${statusRes?.error || 'Unknown error'}`, 'error');
            }
        } catch (e) {
            console.warn('[LlamaServer] Failed to refresh protection status:', e);
            if (!silent) {
                this.log(`Failed to refresh protection status: ${e.message || e}`, 'error');
            }
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
                    hydrateLogOutput(output, (logsRes.logs || []).filter((entry) => isLlamaOperatorLogEntry(entry)));
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
            news: true,
            diagram: true
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
            ['mcp-tool-news', 'news'],
            ['mcp-tool-diagram', 'diagram']
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
            'mcp-tool-news': 'news',
            'mcp-tool-diagram': 'diagram'
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







