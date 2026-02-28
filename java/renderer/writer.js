/**
 * OMNI WRITER ENGINE
 * Simplified UI Logic
 */

const PROVIDERS = {
    google: { models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'] },
    openai: { models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1'] },
    groq: { models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
    openrouter: { models: ['google/gemini-2.0-flash-001', 'anthropic/claude-3.5-sonnet'] },
    mistral: { models: ['mistral-medium', 'mistral-large-latest'] },
    sarvamai: { models: ['sarvam-translate:v1', 'mayura:v1'] },
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
        status: mountPoint.querySelector('#writer-status'),
        modeCards: mountPoint.querySelectorAll('.mode-card')
    };

    let localConfig = { protocol: 'balanced', api: { provider: 'google', key: '', model: 'gemini-3-flash-preview' } };
    let dynamicProviderModels = {};
    try {
        dynamicProviderModels = JSON.parse(localStorage.getItem('omni_provider_models') || '{}');
    } catch {
        dynamicProviderModels = {};
    }

    const saveDynamicProviderModels = () => {
        localStorage.setItem('omni_provider_models', JSON.stringify(dynamicProviderModels));
    };

    const providerModels = (provider) => {
        const dynamic = Array.isArray(dynamicProviderModels[provider]) ? dynamicProviderModels[provider] : [];
        if (dynamic.length > 0) return dynamic;
        return PROVIDERS[provider]?.models || [];
    };

    const renderModelOptions = (provider, preferredModel = '') => {
        els.model.innerHTML = '';
        providerModels(provider).forEach((m) => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            els.model.appendChild(opt);
        });

        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Other (Custom ID)...';
        els.model.appendChild(customOpt);

        if (preferredModel) {
            const modelExists = Array.from(els.model.options).some(opt => opt.value === preferredModel);
            if (modelExists) {
                els.model.value = preferredModel;
                els.customModel.classList.add('hidden');
            } else {
                els.model.value = 'custom';
                els.customModel.value = preferredModel;
                els.customModel.classList.remove('hidden');
            }
        }
    };

    const updateModels = async () => {
        const p = els.provider.value;
        els.apiKeyGroup.style.display = p === 'ollama' ? 'none' : 'block';

        if (p === 'ollama') {
            els.verifyStatus.textContent = 'Scanning...';
            els.verifyStatus.className = 'status-text';
            try {
                const res = await fetch('http://localhost:11434/api/tags');
                const data = await res.json();
                els.model.innerHTML = '';
                (data.models || []).forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.name; opt.textContent = m.name;
                    els.model.appendChild(opt);
                });
                const customOpt = document.createElement('option');
                customOpt.value = 'custom';
                customOpt.textContent = 'Other (Custom ID)...';
                els.model.appendChild(customOpt);
                els.verifyStatus.textContent = '';
            } catch (e) {
                els.model.innerHTML = '<option value="">Ollama Offline</option>';
                els.verifyStatus.textContent = 'OFFLINE';
                els.verifyStatus.className = 'status-text error';
            }
        } else {
            renderModelOptions(p);
        }

        els.customModel.classList.toggle('hidden', els.model.value !== 'custom');
    };

    els.provider.onchange = updateModels;
    els.model.onchange = () => {
        els.customModel.classList.toggle('hidden', els.model.value !== 'custom');
        if (els.model.value === 'custom') els.customModel.focus();
    };

    els.modeCards.forEach(card => {
        card.addEventListener('click', () => {
            els.modeCards.forEach(c => {
                c.classList.remove('selected');
                c.classList.remove('active');
            });
            card.classList.add('selected');
            card.classList.add('active');
            localConfig.protocol = card.dataset.mode;
        });
    });

    els.btnVerify.onclick = async () => {
        const p = els.provider.value;
        const key = els.apiKey.value.trim();
        const m = els.model.value === 'custom' ? els.customModel.value.trim() : els.model.value;

        if (!key && p !== 'ollama') {
            els.verifyStatus.textContent = 'Key Required';
            els.verifyStatus.className = 'status-text error';
            return;
        }

        els.verifyStatus.textContent = 'Verifying...';
        els.verifyStatus.className = 'status-text';
        try {
            if (p === 'ollama') {
                const res = await fetch('http://localhost:11434/api/tags');
                if (!res.ok) throw new Error('Ollama offline');
                const data = await res.json();
                const ids = (data.models || []).map(x => x.name).filter(Boolean);
                if (ids.length > 0) {
                    dynamicProviderModels[p] = ids;
                    saveDynamicProviderModels();
                    renderModelOptions(p, m || ids[0]);
                }
            } else {
                const verifyRes = await window.browserAPI.ai.verifyAndListModels({
                    provider: p,
                    apiKey: key || '',
                    baseUrl: ''
                });
                if (!verifyRes?.success) throw new Error(verifyRes?.error || 'Verification failed');

                const ids = Array.from(new Set((verifyRes.models || []).filter(Boolean)));
                if (ids.length > 0) {
                    dynamicProviderModels[p] = ids;
                    saveDynamicProviderModels();
                    renderModelOptions(p, m && ids.includes(m) ? m : ids[0]);
                } else if (p === 'sarvamai') {
                    renderModelOptions(p, m || 'sarvam-translate:v1');
                }
            }

            els.verifyStatus.textContent = 'Verified';
            els.verifyStatus.className = 'status-text success';
        } catch (e) {
            els.verifyStatus.textContent = 'Failed';
            els.verifyStatus.className = 'status-text error';
        }
    };

    els.btnSave.onclick = async () => {
        const full = await window.browserAPI.settings.get();
        const finalModel = els.model.value === 'custom' ? els.customModel.value.trim() : els.model.value;

        localConfig.protocol = localConfig.protocol || 'balanced';
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
        const allKnown = providerModels(els.provider.value);
        const isKnown = allKnown.includes(savedModel);
        if (savedModel) {
            if (isKnown) {
                els.model.value = savedModel;
            } else {
                els.model.value = 'custom';
                els.customModel.value = savedModel;
                els.customModel.classList.remove('hidden');
            }
        }

        const savedMode = localConfig.protocol || 'balanced';
        els.modeCards.forEach(card => {
            if (card.dataset.mode === savedMode) {
                card.classList.add('selected');
                card.classList.add('active');
            } else {
                card.classList.remove('selected');
                card.classList.remove('active');
            }
        });
    };

    load();
}
