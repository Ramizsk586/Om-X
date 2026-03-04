(() => {
  const THEME_ALIAS_MAP = {
    dark: 'midnight-blend',
    glass: 'prism',
    midnight: 'nordic',
    shadow: 'charcoal',
    abyss: 'deep-ocean',
    eclipse: 'twilight',
    ocean: 'ocean-waves',
    ember: 'ember-glow',
    noir: 'onyx',
    slate: 'steel-blue',
    mocha: 'honey-amber'
  };

  const els = {
    workspace: document.getElementById('workspace'),
    canvasEditor: document.getElementById('canvas-editor'),
    divider: document.getElementById('pane-divider'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    btnSend: document.getElementById('btn-send'),
    btnAiConfigToggle: document.getElementById('btn-ai-config-toggle'),
    aiConfigPanel: document.getElementById('ai-config-panel'),
    aiProviderSelect: document.getElementById('ai-provider-select'),
    aiModelSelect: document.getElementById('ai-model-select'),
    btnAiRefreshModels: document.getElementById('btn-ai-refresh-models'),
    btnAiApplyConfig: document.getElementById('btn-ai-apply-config'),
    canvasBold: document.getElementById('canvas-bold'),
    canvasItalic: document.getElementById('canvas-italic'),
    canvasUnderline: document.getElementById('canvas-underline'),
    loading: document.getElementById('loading-indicator'),
    btnMinimizeWindow: document.getElementById('btn-minimize-window'),
    btnMaximizeWindow: document.getElementById('btn-maximize-window'),
    btnCloseWindow: document.getElementById('btn-close-window')
  };

  const state = {
    splitPercent: 34,
    dragging: false,
    settings: {},
    provider: 'google',
    model: 'gemini-3-flash-preview',
    key: '',
    baseUrl: '',
    providerModels: {}
  };

  const SPLIT_KEY = 'omni_canvas_split_percent_v2';
  const AI_OVERRIDE_KEY = 'omni_canvas_ai_override_v1';
  const AI_MODELS_KEY = 'omni_canvas_provider_models_v1';

  const PROVIDERS = {
    google: { name: 'Google Gemini', models: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash'] },
    offline: { name: 'Offline Bot', models: ['offline-bot-v1'] },
    eliza: { name: 'Eliza 1966', models: ['doctor'] },
    lmstudio: { name: 'LM Studio', models: [] },
    llamacpp: { name: 'llama.cpp (Local)', models: [] },
    openrouter: { name: 'OpenRouter', models: ['google/gemini-2.0-flash-001', 'anthropic/claude-3.5-sonnet'] },
    groq: { name: 'Groq', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
    mistral: { name: 'Mistral AI', models: ['mistral-medium', 'mistral-large-latest'] },
    sarvamai: { name: 'SarvamAI', models: ['sarvam-translate:v1', 'mayura:v1'] },
    'openai-compatible': { name: 'OpenAI Compatible', models: [] }
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const resolveThemeId = (theme) => {
    const key = String(theme || '').trim();
    if (!key) return 'midnight-blend';
    return THEME_ALIAS_MAP[key] || key;
  };

  const applyThemeClass = (theme) => {
    const resolved = resolveThemeId(theme);
    document.body.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) document.body.classList.remove(cls);
    });
    document.body.classList.add(`theme-${resolved}`);
  };

  const uniq = (items) => Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean)));

  const readJsonStorage = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const writeJsonStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  };

  const providerLabel = (provider) => PROVIDERS[provider]?.name || String(provider || '').replace(/[-_]/g, ' ');

  const resolveProviderBaseUrl = (settings, provider, providerConfig = null) => {
    const direct = providerConfig?.baseUrl;
    if (direct) return String(direct).trim();
    if (provider === 'lmstudio') return String(settings?.aiConfig?.lmStudio?.baseUrl || '').trim();
    if (provider === 'llamacpp') return String(settings?.aiConfig?.llamacpp?.baseUrl || '').trim();
    if (provider === 'openai-compatible') return String(settings?.aiConfig?.openaiCompatible?.baseUrl || '').trim();
    return '';
  };

  const providerModels = (provider, settings = state.settings) => {
    const preset = Array.isArray(PROVIDERS[provider]?.models) ? PROVIDERS[provider].models : [];
    const dynamic = Array.isArray(state.providerModels?.[provider]) ? state.providerModels[provider] : [];
    const settingsModel = settings?.providers?.[provider]?.model;
    return uniq([...dynamic, ...preset, settingsModel]);
  };

  const providerIds = (settings = state.settings) => {
    const configured = settings?.providers && typeof settings.providers === 'object' ? Object.keys(settings.providers) : [];
    return uniq([...configured, settings?.activeProvider, ...Object.keys(PROVIDERS)]);
  };

  const getCanvasText = () => String(els.canvasEditor?.innerText || '').replace(/\u00a0/g, ' ').trimEnd();

  const setCanvasText = (text) => {
    if (!els.canvasEditor) return;
    els.canvasEditor.textContent = String(text || '');
  };

  const focusCanvasEditor = () => {
    els.canvasEditor?.focus();
  };

  const execFormat = (command) => {
    focusCanvasEditor();
    try {
      document.execCommand(command, false, null);
    } catch (_) {}
  };

  const setLoading = (value) => {
    if (!els.loading || !els.btnSend) return;
    els.loading.classList.toggle('hidden', !value);
    els.btnSend.disabled = !!value;
  };

  const appendMessage = (role, text) => {
    if (!els.chatMessages) return;
    const line = document.createElement('div');
    line.className = `msg ${role}`;
    line.textContent = String(text || '').trim();
    els.chatMessages.appendChild(line);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  };

  const stripThink = (text) => String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\[think\][\s\S]*?\[\/think\]/gi, '')
    .trim();

  const extractCodeBlock = (text) => {
    const match = String(text || '').match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
    return match ? match[1].trimEnd() : null;
  };

  const firstLine = (text) => {
    const line = String(text || '').replace(/```[\s\S]*?```/g, ' ').split(/\r?\n/).map((x) => x.trim()).find(Boolean) || '';
    return line.length > 140 ? `${line.slice(0, 139)}...` : line;
  };

  const setSplitPercent = (percent) => {
    state.splitPercent = clamp(Number(percent) || 34, 25, 80);
    if (!els.workspace) return;
    const right = 100 - state.splitPercent;
    els.workspace.style.gridTemplateColumns = `${state.splitPercent}% 8px ${right}%`;
  };

  const loadSplit = () => {
    try {
      const raw = localStorage.getItem(SPLIT_KEY);
      if (!raw) return;
      setSplitPercent(parseFloat(raw));
    } catch (_) {}
  };

  const saveSplit = () => {
    try {
      localStorage.setItem(SPLIT_KEY, String(state.splitPercent));
    } catch (_) {}
  };

  const setAiPanelOpen = (open) => {
    if (!els.aiConfigPanel) return;
    els.aiConfigPanel.classList.toggle('hidden', !open);
    els.btnAiConfigToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const populateProviderSelect = () => {
    if (!els.aiProviderSelect) return;
    const ids = providerIds(state.settings);
    const previous = els.aiProviderSelect.value;
    els.aiProviderSelect.innerHTML = '';
    ids.forEach((provider) => {
      const option = document.createElement('option');
      option.value = provider;
      option.textContent = providerLabel(provider);
      els.aiProviderSelect.appendChild(option);
    });
    const fallback = ids.includes(state.provider) ? state.provider : (ids[0] || 'google');
    els.aiProviderSelect.value = ids.includes(previous) ? previous : fallback;
  };

  const populateModelSelect = (provider, preferred = '') => {
    if (!els.aiModelSelect) return;
    const models = providerModels(provider, state.settings);
    const selected = preferred || state.model;
    els.aiModelSelect.innerHTML = '';
    models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      els.aiModelSelect.appendChild(option);
    });
    if (!models.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No models found';
      els.aiModelSelect.appendChild(option);
    }
    const hasSelected = models.includes(selected);
    els.aiModelSelect.value = hasSelected ? selected : (models[0] || '');
  };

  const readAiOverride = () => {
    const value = readJsonStorage(AI_OVERRIDE_KEY, {});
    return {
      provider: String(value.provider || '').trim(),
      model: String(value.model || '').trim()
    };
  };

  const saveAiOverride = (provider, model) => {
    writeJsonStorage(AI_OVERRIDE_KEY, { provider, model });
  };

  const refreshPanelFromState = () => {
    if (!els.aiProviderSelect || !els.aiModelSelect) return;
    populateProviderSelect();
    const provider = els.aiProviderSelect.value || state.provider;
    populateModelSelect(provider, provider === state.provider ? state.model : '');
  };

  const syncModelConfig = (settings) => {
    state.settings = settings || {};
    const override = readAiOverride();
    const available = providerIds(settings);
    const fallbackProvider = settings?.activeProvider || 'google';
    const provider = available.includes(override.provider) ? override.provider : fallbackProvider;
    const pConfig = settings?.providers?.[provider] || {};
    const modelList = providerModels(provider, settings);
    const nextModel = modelList.includes(override.model)
      ? override.model
      : (pConfig.model || modelList[0] || (provider === 'google' ? 'gemini-3-flash-preview' : ''));

    state.provider = provider;
    state.model = nextModel;
    state.key = pConfig.key || '';
    state.baseUrl = resolveProviderBaseUrl(settings, provider, pConfig);

    refreshPanelFromState();
  };

  const loadSettings = async () => {
    applyThemeClass('midnight-blend');
    try {
      const settings = await window.browserAPI?.settings?.get?.();
      syncModelConfig(settings);
      applyThemeClass(settings?.theme || 'midnight-blend');
    } catch (_) {
      applyThemeClass('midnight-blend');
    }
  };

  const runAiTask = async (instruction) => {
    const canvasContent = getCanvasText();
    const prompt = [
      `Instruction: ${instruction}`,
      'Return two parts only:',
      '1) First line: short status message.',
      '2) One markdown code block containing full updated canvas text.',
      '',
      'Current canvas text:',
      canvasContent
    ].join('\n');

    const response = await window.browserAPI?.ai?.performTask?.({
      promptOverride: prompt,
      configOverride: {
        provider: state.provider,
        model: state.model,
        key: state.key,
        baseUrl: state.baseUrl
      }
    });

    if (!response) return { error: 'No response from AI.' };
    if (response.error) return { error: response.error };
    return { text: stripThink(response.text || '') };
  };

  const refreshModelsForProvider = async (provider, silent = false) => {
    if (!provider) return;
    const pConfig = state.settings?.providers?.[provider] || {};
    const apiKey = String(pConfig.key || '').trim();
    const baseUrl = resolveProviderBaseUrl(state.settings, provider, pConfig);
    const previousText = els.btnAiRefreshModels?.textContent;
    if (els.btnAiRefreshModels) {
      els.btnAiRefreshModels.disabled = true;
      els.btnAiRefreshModels.textContent = 'Refreshing...';
    }
    try {
      const result = await window.browserAPI?.ai?.verifyAndListModels?.({ provider, apiKey, baseUrl });
      if (!result?.success) throw new Error(result?.error || 'Unable to load models');
      const ids = uniq(result?.models || []);
      if (ids.length) {
        state.providerModels[provider] = ids;
        writeJsonStorage(AI_MODELS_KEY, state.providerModels);
        populateModelSelect(provider, ids[0]);
      }
      if (!silent) appendMessage('ai', `Loaded ${ids.length} model(s) for ${providerLabel(provider)}.`);
    } catch (error) {
      if (!silent) appendMessage('ai', `Error: ${String(error?.message || 'Failed to refresh models')}`);
    } finally {
      if (els.btnAiRefreshModels) {
        els.btnAiRefreshModels.disabled = false;
        els.btnAiRefreshModels.textContent = previousText || 'Refresh';
      }
    }
  };

  const applyAiConfigFromPanel = () => {
    const provider = String(els.aiProviderSelect?.value || '').trim();
    const model = String(els.aiModelSelect?.value || '').trim();
    if (!provider || !model) return;
    const pConfig = state.settings?.providers?.[provider] || {};

    state.provider = provider;
    state.model = model;
    state.key = pConfig.key || '';
    state.baseUrl = resolveProviderBaseUrl(state.settings, provider, pConfig);
    saveAiOverride(provider, model);
    setAiPanelOpen(false);
    appendMessage('ai', `Switched to ${providerLabel(provider)} / ${model}.`);
  };

  const handleSend = async () => {
    const userText = String(els.chatInput?.value || '').trim();
    if (!userText) return;

    appendMessage('user', userText);
    els.chatInput.value = '';
    setLoading(true);

    try {
      const res = await runAiTask(userText);
      if (res.error) {
        appendMessage('ai', `Error: ${res.error}`);
        return;
      }

      const nextCanvas = extractCodeBlock(res.text);
      if (nextCanvas !== null) setCanvasText(nextCanvas);

      appendMessage('ai', firstLine(res.text) || 'Canvas updated.');
    } catch (error) {
      appendMessage('ai', `Error: ${String(error?.message || 'Unknown error')}`);
    } finally {
      setLoading(false);
    }
  };

  const startDrag = (event) => {
    if (!els.divider || !els.workspace) return;
    state.dragging = true;
    els.divider.classList.add('dragging');
    event.preventDefault();
  };

  const moveDrag = (event) => {
    if (!state.dragging || !els.workspace) return;
    if (window.innerWidth <= 920) return;
    const rect = els.workspace.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const percent = (relativeX / rect.width) * 100;
    setSplitPercent(percent);
  };

  const stopDrag = () => {
    if (!state.dragging) return;
    state.dragging = false;
    if (els.divider) els.divider.classList.remove('dragging');
    saveSplit();
  };

  const wireEvents = () => {
    els.btnMinimizeWindow?.addEventListener('click', () => window.browserAPI?.window?.minimize?.());
    els.btnMaximizeWindow?.addEventListener('click', () => window.browserAPI?.window?.toggleMaximize?.());
    els.btnCloseWindow?.addEventListener('click', () => window.browserAPI?.window?.close?.());

    els.btnSend?.addEventListener('click', handleSend);

    els.chatInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    });

    els.divider?.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('mouseleave', stopDrag);

    els.btnAiConfigToggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      const isHidden = els.aiConfigPanel?.classList.contains('hidden');
      setAiPanelOpen(!!isHidden);
      if (isHidden) refreshPanelFromState();
    });

    els.aiProviderSelect?.addEventListener('change', () => {
      populateModelSelect(els.aiProviderSelect.value);
    });

    els.btnAiRefreshModels?.addEventListener('click', () => {
      refreshModelsForProvider(String(els.aiProviderSelect?.value || state.provider));
    });

    els.btnAiApplyConfig?.addEventListener('click', applyAiConfigFromPanel);

    els.canvasBold?.addEventListener('click', () => execFormat('bold'));
    els.canvasItalic?.addEventListener('click', () => execFormat('italic'));
    els.canvasUnderline?.addEventListener('click', () => execFormat('underline'));

    document.addEventListener('click', (event) => {
      if (!els.aiConfigPanel || els.aiConfigPanel.classList.contains('hidden')) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (els.aiConfigPanel.contains(target) || els.btnAiConfigToggle?.contains(target)) return;
      setAiPanelOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setAiPanelOpen(false);
    });

    window.browserAPI?.onSettingsUpdated?.((settings) => {
      syncModelConfig(settings);
      applyThemeClass(settings?.theme || 'midnight-blend');
    });
  };

  const init = async () => {
    setSplitPercent(state.splitPercent);
    loadSplit();
    state.providerModels = readJsonStorage(AI_MODELS_KEY, {});
    setAiPanelOpen(false);
    await loadSettings();
    wireEvents();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
