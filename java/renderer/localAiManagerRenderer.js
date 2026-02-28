document.addEventListener('DOMContentLoaded', async () => {
    const els = {
        cpu: document.getElementById('cpu-info'),
        vramTotal: document.getElementById('vram-total'),
        vramUsed: document.getElementById('vram-used'),
        loadText: document.getElementById('current-load-text'),
        modelList: document.getElementById('model-list'),
        presetList: document.getElementById('preset-list'),
        graphCanvas: document.getElementById('gpu-graph'),
        globalEject: document.getElementById('global-eject-area'),
        btnGlobalUnload: document.getElementById('btn-global-unload')
    };

    const ctx = els.graphCanvas.getContext('2d');
    let loadHistory = new Array(50).fill(0);

    const updateGraph = (newVal) => {
        loadHistory.push(newVal); loadHistory.shift();
        const w = els.graphCanvas.width, h = els.graphCanvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(0, h * 0.3); ctx.lineTo(w, h * 0.3); ctx.stroke();
        ctx.strokeStyle = '#7c4dff'; ctx.lineWidth = 2; ctx.beginPath();
        const step = w / (loadHistory.length - 1);
        loadHistory.forEach((val, i) => { const x = i * step, y = h - (val / 100 * h); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke(); ctx.lineTo(w, h); ctx.lineTo(0, h);
        const grad = ctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(124, 77, 255, 0.2)'); grad.addColorStop(1, 'rgba(124, 77, 255, 0)');
        ctx.fillStyle = grad; ctx.fill();
    };

    const renderPresets = (data) => {
        els.presetList.innerHTML = '';
        data.presets.forEach(preset => {
            const status = data.statuses[preset.id];
            const isDownloaded = status === 'downloaded';
            const isDownloading = status === 'downloading';
            const isActive = data.activeModelId === preset.id;
            
            const item = document.createElement('div');
            item.className = 'model-item';
            item.innerHTML = `
                <div class="model-header">
                    <div>
                        <span class="model-name">${preset.name}</span>
                        <p style="font-size:10px; color:#71717a; margin-top:4px;">${preset.description}</p>
                    </div>
                    ${isDownloaded ? `<span class="status-badge downloaded">READY</span>` : ''}
                </div>
                <div id="prog-wrap-${preset.id}" class="${isDownloading ? '' : 'hidden'}" style="margin-bottom:12px;">
                    <div class="progress-container"><div class="progress-fill" id="prog-fill-${preset.id}" style="width: 0%"></div></div>
                </div>
                ${!isDownloaded && !isDownloading ? `<button class="btn-action btn-dl" data-id="${preset.id}">Download Weights</button>` : ''}
                ${isDownloading ? `<button class="btn-action btn-cancel" data-id="${preset.id}">Cancel Download</button>` : ''}
                ${isDownloaded && !isActive ? `<button class="btn-action btn-load" data-id="${preset.id}">Load Model</button>` : ''}
                ${isActive ? `<div style="text-align:center; padding:10px; border:1px solid #10b981; border-radius:8px; color:#10b981; font-size:10px; font-weight:800;">NEURAL LINK ACTIVE</div>` : ''}
            `;

            const btnDl = item.querySelector('.btn-dl');
            if (btnDl) btnDl.onclick = () => window.browserAPI.ai.localModel.downloadPreset(preset.id);
            
            const btnCancel = item.querySelector('.btn-cancel');
            if (btnCancel) btnCancel.onclick = () => window.browserAPI.ai.localModel.cancelDownload();

            const btnLoad = item.querySelector('.btn-load');
            if (btnLoad) btnLoad.onclick = () => window.browserAPI.ai.localModel.load(preset.id);

            els.presetList.appendChild(item);
        });
        els.globalEject.classList.toggle('hidden', !data.activeModelId);
    };

    const pollStatus = async () => {
        const data = await window.browserAPI.ai.localModel.status();
        renderPresets(data); updateEngineUI(data.engineStatus);
        const metrics = await window.browserAPI.ai.localModel.getMetrics();
        els.vramTotal.textContent = (metrics.totalMem / 1024).toFixed(1) + ' GB';
        els.vramUsed.textContent = metrics.usedMem + ' MB USED';
        els.loadText.textContent = metrics.usage + '% LOAD';
        updateGraph(metrics.usage);
    };

    window.browserAPI.ai.localModel.onDownloadProgress((data) => {
        const fill = document.getElementById(`prog-fill-${data.modelId}`);
        if (fill) fill.style.width = data.progress + '%';
    });

    window.browserAPI.ai.localModel.onEngineStatusUpdated((data) => {
        updateEngineUI(data.status);
        if (data.progress && els.engineProg) els.engineProg.style.width = data.progress + '%';
        if (data.status === 'installed') pollStatus();
    });

    window.browserAPI.ai.localModel.onStatusUpdated(() => pollStatus());
    els.btnInstallEngine.onclick = () => window.browserAPI.ai.localModel.installEngine();
    els.btnGlobalUnload.onclick = () => window.browserAPI.ai.localModel.unload();

    els.graphCanvas.width = els.graphCanvas.offsetWidth; els.graphCanvas.height = els.graphCanvas.offsetHeight;
    const info = await window.browserAPI.system.getInfo();
    els.cpu.textContent = info.cpu.split(' ').slice(0,3).join(' ');
    await pollStatus(); setInterval(pollStatus, 2000);
});