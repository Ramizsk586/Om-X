/**
 * OMNI WRITER ENGINE
 * Simplified UI Logic
 */

const PROVIDERS = {
    google: { models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'] },
    groq: { models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
    openrouter: { models: ['google/gemini-2.0-flash-001', 'anthropic/claude-3.5-sonnet'] },
    mistral: { models: ['mistral-medium', 'mistral-large-latest'] },
    cohere: { models: ['command-r', 'command-r-plus'] },
    ollama: { models: [] }
};

export const UnifiedWriter = {
    async perform(data) {
        const settings = await window.browserAPI.settings.get();
        const config = settings.writer || { protocol: 'balanced', api: { provider: 'google', key: '', model: 'gemini-3-flash-preview' } };
        
        const prompts = {
            balanced: "Fix grammar and typos: ",
            professional: "Make this formal and professional: ",
            creative: "Make this fluent and creative: "
        };

        try {
            const result = await window.browserAPI.ai.performTask({
                text: (prompts[data.mode] || prompts.balanced) + data.text,
                configOverride: config.api
            });
            return result;
        } catch (e) {
            return { error: "Writer engine unreachable. Check settings." };
        }
    }
};

export async function mountWriterPanel(mountPoint) {
    if (!mountPoint || mountPoint.dataset.mounted) return;
    mountPoint.dataset.mounted = "true";

    try {
        const res = await fetch('./writer.html');
        mountPoint.innerHTML = res.ok ? await res.text() : `<div style="color:#ef4444; padding:20px;">Template not found.</div>`;
    } catch (e) {
        mountPoint.innerHTML = `<div style="color:#ef4444; padding:20px;">Interface Load Error</div>`;
        return;
    }

    const els = {
        provider: mountPoint.querySelector('#writer-provider-select'),
        apiKey: mountPoint.querySelector('#writer-api-key'),
        apiKeyGroup: mountPoint.querySelector('#writer-api-key-group'),
        model: mountPoint.querySelector('#writer-model-select'),
        customModel: mountPoint.querySelector('#writer-custom-model'),
        btnVerify: mountPoint.querySelector('#btn-verify-writer'),
        verifyStatus: mountPoint.querySelector('#writer-verify-status'),
        btnSave: mountPoint.querySelector('#btn-save-writer'),
        status: mountPoint.querySelector('#writer-status')
    };

    let localConfig = { protocol: 'balanced', api: { provider: 'google', key: '', model: 'gemini-3-flash-preview' } };

    const updateModels = async () => {
        const p = els.provider.value;
        els.model.innerHTML = '';
        els.apiKeyGroup.style.display = p === 'ollama' ? 'none' : 'block';

        if (p === 'ollama') {
            els.verifyStatus.textContent = 'Scanning...';
            try {
                const res = await fetch('http://localhost:11434/api/tags');
                const data = await res.json();
                (data.models || []).forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.name; opt.textContent = m.name;
                    els.model.appendChild(opt);
                });
                els.verifyStatus.textContent = '';
            } catch (e) {
                els.model.innerHTML = '<option value="">Ollama Offline</option>';
                els.verifyStatus.textContent = 'OFFLINE';
            }
        } else {
            (PROVIDERS[p]?.models || []).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m; opt.textContent = m;
                els.model.appendChild(opt);
            });
        }

        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Other (Custom ID)...';
        els.model.appendChild(customOpt);

        els.customModel.classList.toggle('hidden', els.model.value !== 'custom');
    };

    els.provider.onchange = updateModels;
    els.model.onchange = () => {
        els.customModel.classList.toggle('hidden', els.model.value !== 'custom');
        if (els.model.value === 'custom') els.customModel.focus();
    };

    els.btnVerify.onclick = async () => {
        const p = els.provider.value;
        const key = els.apiKey.value.trim();
        const m = els.model.value === 'custom' ? els.customModel.value.trim() : els.model.value;

        if (!key && p !== 'ollama') {
            els.verifyStatus.textContent = 'Key Required';
            els.verifyStatus.style.color = '#ef4444';
            return;
        }

        els.verifyStatus.textContent = 'Verifying...';
        els.verifyStatus.style.color = '#71717a';
        try {
            const res = await window.browserAPI.ai.performTask({
                text: "ping",
                configOverride: { provider: p, key: key, model: m }
            });
            if (res && !res.error) {
                els.verifyStatus.textContent = 'Verified';
                els.verifyStatus.style.color = '#10b981';
            } else throw new Error();
        } catch (e) {
            els.verifyStatus.textContent = 'Failed';
            els.verifyStatus.style.color = '#ef4444';
        }
    };

    els.btnSave.onclick = async () => {
        const full = await window.browserAPI.settings.get();
        const finalModel = els.model.value === 'custom' ? els.customModel.value.trim() : els.model.value;

        localConfig.api = { 
            provider: els.provider.value, 
            key: els.apiKey.value.trim(), 
            model: finalModel 
        };
        await window.browserAPI.settings.save({ ...full, writer: localConfig });
    };

    const load = async () => {
        const s = await window.browserAPI.settings.get();
        if (s.writer) localConfig = s.writer;
        
        els.provider.value = localConfig.api?.provider || 'google';
        els.apiKey.value = localConfig.api?.key || '';
        
        await updateModels();
        
        const savedModel = localConfig.api?.model;
        const isKnown = PROVIDERS[els.provider.value]?.models.includes(savedModel);
        if (savedModel) {
            if (isKnown) {
                els.model.value = savedModel;
            } else {
                els.model.value = 'custom';
                els.customModel.value = savedModel;
                els.customModel.classList.remove('hidden');
            }
        }
    };

    load();
}