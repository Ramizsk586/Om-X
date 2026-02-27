(() => {
  const PROVIDER_OPTIONS = [
    { id: 'google', label: 'Google Gemini' },
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'groq', label: 'Groq' },
    { id: 'mistral', label: 'Mistral AI' },
    { id: 'sarvamai', label: 'SarvamAI' },
    { id: 'lmstudio', label: 'LM Studio (Local)' },
    { id: 'llamacpp', label: 'llama.cpp (Local)' },
    { id: 'openai-compatible', label: 'OpenAI Compatible' }
  ];

  const DEFAULT_MODELS = {
    google: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash'],
    openrouter: ['google/gemini-2.0-flash-001', 'anthropic/claude-3.5-sonnet'],
    groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    mistral: ['mistral-medium', 'mistral-large-latest'],
    sarvamai: [],
    lmstudio: [],
    llamacpp: [],
    'openai-compatible': []
  };

  const PROVIDERS_REQUIRING_KEY = new Set(['google', 'openrouter', 'groq', 'mistral', 'sarvamai']);
  const RTL_LANGS = new Set(['Arabic', 'Hebrew', 'Urdu', 'Persian']);

  const LANGUAGE_CODES = {
    auto: '',
    English: 'en',
    Hindi: 'hi',
    Bengali: 'bn',
    Spanish: 'es',
    French: 'fr',
    German: 'de',
    Portuguese: 'pt',
    Italian: 'it',
    Dutch: 'nl',
    Polish: 'pl',
    Russian: 'ru',
    Ukrainian: 'uk',
    Greek: 'el',
    Turkish: 'tr',
    Arabic: 'ar',
    Hebrew: 'he',
    Urdu: 'ur',
    Persian: 'fa',
    'Chinese (Simplified)': 'zh-Hans',
    'Chinese (Traditional)': 'zh-Hant',
    Japanese: 'ja',
    Korean: 'ko',
    Thai: 'th',
    Vietnamese: 'vi',
    Indonesian: 'id',
    Malay: 'ms',
    Tamil: 'ta',
    Telugu: 'te',
    Kannada: 'kn',
    Malayalam: 'ml',
    Marathi: 'mr',
    Punjabi: 'pa',
    Gujarati: 'gu',
    Swahili: 'sw'
  };

  const els = {
    modelPill: document.getElementById('model-pill'),
    providerSelect: document.getElementById('provider-select-canvas'),
    modelSelect: document.getElementById('model-select-canvas'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    btnApplyModel: document.getElementById('btn-apply-model'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    btnSend: document.getElementById('btn-send'),
    styleSelect: document.getElementById('style-select'),
    languageSelect: document.getElementById('language-select'),
    btnNew: document.getElementById('btn-new'),
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    btnMinimize: document.getElementById('btn-minimize'),
    btnMaximize: document.getElementById('btn-maximize'),
    btnClose: document.getElementById('btn-close'),
    filenameInput: document.getElementById('filename-input'),
    btnViewToggle: document.getElementById('btn-view-toggle'),
    canvasEditor: document.getElementById('canvas-editor'),
    canvasHighlight: document.getElementById('canvas-highlight'),
    canvasPreview: document.getElementById('canvas-preview'),
    loading: document.getElementById('loading-indicator'),
    contextFooter: document.getElementById('canvas-context-footer')
  };

  const state = {
    settings: {},
    config: { provider: 'google', model: 'gemini-3-flash-preview', key: '', baseUrl: '', aiConfig: null },
    providerModelsCache: {},
    history: [''],
    historyIndex: 0,
    isPreview: false,
    isLoading: false,
    historyTimer: null
  };

  const ACTION_PROMPTS = {
    suggest: 'Suggest improvements to clarity, structure, and flow.',
    improve: 'Improve the writing with tighter language and clearer structure.',
    comment: 'Add concise inline comments that explain why changes help.',
    colorize: 'Add tasteful emphasis and headings to improve readability.'
  };

  const parseProviderModelCache = () => {
    try {
      return JSON.parse(localStorage.getItem('omni_provider_models') || '{}');
    } catch {
      return {};
    }
  };

  const persistProviderModelCache = () => {
    localStorage.setItem('omni_provider_models', JSON.stringify(state.providerModelsCache || {}));
  };

  const normalizeOneLine = (text, maxLen = 140) => {
    const value = (text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    if (value.length <= maxLen) return value;
    return `${value.slice(0, maxLen - 1)}...`;
  };

  const stripThink = (text) => {
    if (!text) return '';
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/\[think\][\s\S]*?\[\/think\]/gi, '')
      .trim();
  };

  const extractCodeBlock = (text) => {
    if (!text) return null;
    const match = text.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
    return match ? match[1].trimEnd() : null;
  };

  const firstLineWithoutCode = (text) => {
    if (!text) return '';
    const noCode = text.replace(/```[\s\S]*?```/g, ' ').trim();
    const first = noCode.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
    return normalizeOneLine(first);
  };

  const appendMessage = (role, text) => {
    if (!els.chatMessages) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = role === 'ai' ? normalizeOneLine(text) : text;
    els.chatMessages.appendChild(bubble);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  };

  const setLoading = (value) => {
    state.isLoading = value;
    if (els.loading) {
      els.loading.classList.toggle('hidden', !value);
    }
  };

  const getProviderSettings = (provider) => {
    return state.settings?.providers?.[provider] || {};
  };

  const providerBaseUrl = (provider) => {
    if (provider === 'lmstudio') return getProviderSettings('lmstudio').baseUrl || '';
    if (provider === 'llamacpp') return getProviderSettings('llamacpp').baseUrl || '';
    if (provider === 'openai-compatible') return getProviderSettings('openai-compatible').baseUrl || '';
    return '';
  };

  const providerKey = (provider) => {
    const fromProviderSettings = getProviderSettings(provider).key || '';
    if (fromProviderSettings) return fromProviderSettings;
    if (state.config.provider === provider) return state.config.key || '';
    return '';
  };

  const updateModelPill = () => {
    if (!els.modelPill) return;
    const provider = state.config.provider || 'unknown';
    const model = state.config.model || 'default';
    els.modelPill.textContent = `Model: ${provider} / ${model}`;
  };

  const updateHistoryButtons = () => {
    if (els.btnUndo) els.btnUndo.disabled = state.historyIndex <= 0;
    if (els.btnRedo) els.btnRedo.disabled = state.historyIndex >= state.history.length - 1;
  };

  const selectedLanguage = () => els.languageSelect?.value || 'auto';

  const isRtlLanguageSelected = () => RTL_LANGS.has(selectedLanguage());

  const applyEditorLanguageMeta = () => {
    const selected = selectedLanguage();
    const code = LANGUAGE_CODES[selected] || '';
    const langCode = code || 'en';
    document.documentElement.setAttribute('lang', langCode);
    if (els.canvasEditor) els.canvasEditor.setAttribute('lang', langCode);
    if (els.canvasPreview) els.canvasPreview.setAttribute('lang', langCode);
  };

  const applyEditorDirection = () => {
    if (!els.canvasEditor || !els.canvasHighlight) return;
    const text = els.canvasEditor.value || '';
    const hasRtl = /[\u0590-\u08FF]/.test(text);
    const direction = isRtlLanguageSelected() || hasRtl ? 'rtl' : 'ltr';
    const align = direction === 'rtl' ? 'right' : 'left';
    els.canvasEditor.style.direction = direction;
    els.canvasEditor.style.textAlign = align;
    els.canvasHighlight.style.direction = direction;
    els.canvasHighlight.style.textAlign = align;
    if (els.canvasPreview) {
      els.canvasPreview.style.direction = direction;
      els.canvasPreview.style.textAlign = align;
    }
  };

  const escapeHtml = (value) => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const highlightMarkdown = (value) => {
    if (!value) return '';
    let text = escapeHtml(value);
    text = text.replace(/(^|\n)(#{1,6}\s.+)/g, '$1<span class="hl-heading">$2</span>');
    text = text.replace(/(\*\*|__)(.*?)\1/g, '<span class="hl-strong">$2</span>');
    text = text.replace(/(\*|_)([^*_]+)\1/g, '<span class="hl-em">$2</span>');
    text = text.replace(/`([^`]+)`/g, '<span class="hl-code">$1</span>');
    text = text.replace(/(^|\n)>\s?(.+)/g, '$1<span class="hl-quote">&gt; $2</span>');
    text = text.replace(/(^|\n)```[\s\S]*?```/g, (match) => `<span class="hl-block">${match}</span>`);
    text = text.replace(/(^|\n)(\/\/.*)/g, '$1<span class="hl-comment">$2</span>');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="hl-link">$1</span>');
    return text;
  };

  const updateHighlight = () => {
    if (!els.canvasHighlight || !els.canvasEditor) return;
    els.canvasHighlight.innerHTML = highlightMarkdown(els.canvasEditor.value || '');
  };

  const updatePreview = () => {
    if (!els.canvasPreview || !els.canvasEditor || !state.isPreview) return;
    const raw = els.canvasEditor.value || '';
    if (window.marked) {
      els.canvasPreview.innerHTML = window.marked.parse(raw);
    } else {
      els.canvasPreview.textContent = raw;
    }
  };

  const syncScroll = () => {
    if (!els.canvasHighlight || !els.canvasEditor) return;
    els.canvasHighlight.scrollTop = els.canvasEditor.scrollTop;
    els.canvasHighlight.scrollLeft = els.canvasEditor.scrollLeft;
  };

  const setCanvasContent = (content, record = true) => {
    if (!els.canvasEditor) return;
    els.canvasEditor.value = content;
    applyEditorDirection();
    updatePreview();
    updateHighlight();
    syncScroll();
    if (record) {
      const current = state.history[state.historyIndex] || '';
      if (content !== current) {
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(content);
        state.historyIndex = state.history.length - 1;
        updateHistoryButtons();
      }
    }
  };

  const scheduleHistoryUpdate = () => {
    if (!els.canvasEditor) return;
    if (state.historyTimer) clearTimeout(state.historyTimer);
    state.historyTimer = setTimeout(() => {
      setCanvasContent(els.canvasEditor.value, true);
      state.historyTimer = null;
    }, 350);
  };

  const toggleView = () => {
    state.isPreview = !state.isPreview;
    if (els.canvasPreview) els.canvasPreview.classList.toggle('hidden', !state.isPreview);
    if (els.canvasEditor) els.canvasEditor.classList.toggle('hidden', state.isPreview);
    if (els.btnViewToggle) els.btnViewToggle.textContent = state.isPreview ? 'Edit' : 'Preview';
    updatePreview();
  };

  const showContextFooter = () => {
    if (!els.contextFooter) return;
    updateHistoryButtons();
    els.contextFooter.classList.remove('hidden');
  };

  const hideContextFooter = () => {
    if (!els.contextFooter) return;
    els.contextFooter.classList.add('hidden');
  };

  const populateProviderSelect = () => {
    if (!els.providerSelect) return;
    els.providerSelect.innerHTML = '';
    PROVIDER_OPTIONS.forEach((provider) => {
      const opt = document.createElement('option');
      opt.value = provider.id;
      opt.textContent = provider.label;
      els.providerSelect.appendChild(opt);
    });
  };

  const modelOptionsForProvider = (provider) => {
    const cached = Array.isArray(state.providerModelsCache[provider]) ? state.providerModelsCache[provider] : [];
    if (cached.length) return cached;
    return DEFAULT_MODELS[provider] || [];
  };

  const ensureModelOption = (value) => {
    if (!els.modelSelect || !value) return;
    const exists = Array.from(els.modelSelect.options).some((opt) => opt.value === value);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      els.modelSelect.insertBefore(opt, els.modelSelect.lastElementChild);
    }
  };

  const populateModelSelect = (provider, preferredModel = '') => {
    if (!els.modelSelect) return;
    const options = modelOptionsForProvider(provider);
    els.modelSelect.innerHTML = '';

    options.forEach((modelId) => {
      const opt = document.createElement('option');
      opt.value = modelId;
      opt.textContent = modelId;
      els.modelSelect.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Other (Custom ID)...';
    els.modelSelect.appendChild(customOpt);

    if (preferredModel && options.includes(preferredModel)) {
      els.modelSelect.value = preferredModel;
      return;
    }
    if (preferredModel && !options.includes(preferredModel)) {
      ensureModelOption(preferredModel);
      els.modelSelect.value = preferredModel;
      return;
    }
    if (options.length) {
      els.modelSelect.value = options[0];
    } else {
      els.modelSelect.value = 'custom';
    }
  };

  const fetchProviderModels = async (provider, force = false) => {
    if (!window.browserAPI?.ai?.verifyAndListModels) return false;
    if (!force && Array.isArray(state.providerModelsCache[provider]) && state.providerModelsCache[provider].length > 0) {
      return true;
    }

    const key = providerKey(provider);
    if (PROVIDERS_REQUIRING_KEY.has(provider) && !key) return false;

    const baseUrl = providerBaseUrl(provider);
    if ((provider === 'lmstudio' || provider === 'llamacpp' || provider === 'openai-compatible') && !baseUrl) {
      return false;
    }

    const res = await window.browserAPI.ai.verifyAndListModels({
      provider,
      apiKey: key || '',
      baseUrl: baseUrl || ''
    });

    if (!res?.success || !Array.isArray(res.models)) return false;
    const deduped = Array.from(new Set(res.models.filter(Boolean)));
    if (deduped.length === 0) return false;
    state.providerModelsCache[provider] = deduped;
    persistProviderModelCache();
    return true;
  };

  const resolveSelectedModel = async () => {
    if (!els.modelSelect) return '';
    if (els.modelSelect.value !== 'custom') return els.modelSelect.value;
    const custom = window.prompt('Enter custom model ID:', state.config.model || '');
    if (!custom || !custom.trim()) return '';
    const trimmed = custom.trim();
    ensureModelOption(trimmed);
    els.modelSelect.value = trimmed;
    return trimmed;
  };

  const applyModelSelection = async () => {
    const provider = els.providerSelect?.value || state.config.provider;
    const model = await resolveSelectedModel();
    if (!model) {
      appendMessage('ai', 'Select a model first.');
      return;
    }

    const settings = await window.browserAPI?.settings?.get?.();
    if (!settings) {
      appendMessage('ai', 'Failed to load settings.');
      return;
    }

    const providers = { ...(settings.providers || {}) };
    const existing = providers[provider] || {};
    providers[provider] = {
      ...existing,
      model,
      key: existing.key || '',
      baseUrl: existing.baseUrl || providerBaseUrl(provider) || ''
    };

    const updatedSettings = {
      ...settings,
      activeProvider: provider,
      providers
    };

    const ok = await window.browserAPI?.settings?.save?.(updatedSettings);
    if (!ok) {
      appendMessage('ai', 'Failed to save model.');
      return;
    }

    state.settings = updatedSettings;
    state.config.provider = provider;
    state.config.model = model;
    state.config.key = providers[provider].key || '';
    state.config.baseUrl = providers[provider].baseUrl || '';
    updateModelPill();
    appendMessage('ai', normalizeOneLine(`Model switched to ${provider} / ${model}`));
  };

  const refreshModelsForCurrentProvider = async () => {
    const provider = els.providerSelect?.value || state.config.provider;
    if (els.btnRefreshModels) {
      els.btnRefreshModels.disabled = true;
      els.btnRefreshModels.textContent = 'Refreshing...';
    }
    try {
      const ok = await fetchProviderModels(provider, true);
      const preferred = state.config.provider === provider ? state.config.model : '';
      populateModelSelect(provider, preferred);
      appendMessage('ai', ok ? 'Model list refreshed.' : 'Unable to refresh model list.');
    } finally {
      if (els.btnRefreshModels) {
        els.btnRefreshModels.disabled = false;
        els.btnRefreshModels.textContent = 'Refresh';
      }
    }
  };

  const loadConfig = async () => {
    try {
      state.providerModelsCache = parseProviderModelCache();
      const settings = await window.browserAPI?.settings?.get?.();
      state.settings = settings || {};
      const provider = settings?.activeProvider || 'google';
      const pConfig = settings?.providers?.[provider] || {};
      state.config = {
        provider,
        key: pConfig.key || '',
        model: pConfig.model || (provider === 'google' ? 'gemini-3-flash-preview' : ''),
        baseUrl: pConfig.baseUrl || '',
        aiConfig: settings?.aiConfig || null
      };
      populateProviderSelect();
      if (els.providerSelect) els.providerSelect.value = provider;
      populateModelSelect(provider, state.config.model);
      await fetchProviderModels(provider, false);
      populateModelSelect(provider, state.config.model);
    } catch (e) {
      console.warn('[OmniCanvas] Config load failed', e);
    }
    updateModelPill();
  };

  const buildLanguageHint = () => {
    const selected = selectedLanguage();
    if (selected === 'auto') return 'Preserve and support all scripts/languages already used in the document.';
    return `Write the document in ${selected} and preserve proper script punctuation.`;
  };

  const extractUpdatedMarkdown = (text) => {
    if (!text) return null;
    const fromCodeBlock = extractCodeBlock(text);
    if (fromCodeBlock !== null) return fromCodeBlock;

    const cleaned = text.trim();
    if (!cleaned) return null;
    const lines = cleaned.split(/\r?\n/);
    if (lines.length <= 1) return null;

    const remainder = lines.slice(1).join('\n').trim();
    return remainder || null;
  };

  const runAiTask = async (prompt, systemInstruction) => {
    const result = await window.browserAPI?.ai?.performTask?.({
      promptOverride: prompt,
      configOverride: {
        provider: state.config.provider,
        model: state.config.model,
        key: state.config.key,
        baseUrl: state.config.baseUrl
      },
      systemInstruction
    });
    if (!result) return { error: 'No response from AI.' };
    if (result.error) return { error: result.error };
    return { text: stripThink(result.text || '') };
  };

  const canvasSystemInstruction = () => {
    return [
      'You are Omni Canvas, an advanced multilingual markdown co-editor.',
      'Response format is strict:',
      '1) First line: one short status sentence, max 14 words, single line.',
      '2) Then one markdown code block containing the FULL updated document only.',
      'Do not output anything outside those two parts.'
    ].join('\n');
  };

  const handleChatSend = async () => {
    const input = els.chatInput?.value?.trim() || '';
    if (!input || state.isLoading) return;

    appendMessage('user', input);
    els.chatInput.value = '';

    const canvasContent = els.canvasEditor?.value || '';
    const selectedStyle = els.styleSelect?.value || 'default';
    const styleHint = selectedStyle === 'default' ? 'Use a balanced, professional style.' : `Preferred writing style: ${selectedStyle}.`;
    const languageHint = buildLanguageHint();
    const prompt = [
      `User request: ${input}`,
      styleHint,
      languageHint,
      'Current Markdown document:',
      canvasContent
    ].join('\n\n');

    setLoading(true);
    const response = await runAiTask(prompt, canvasSystemInstruction());
    setLoading(false);

    if (response.error) {
      appendMessage('ai', normalizeOneLine(`Error: ${response.error}`));
      return;
    }

    const newContent = extractUpdatedMarkdown(response.text);
    if (newContent !== null) {
      setCanvasContent(newContent, true);
    }

    const summary = firstLineWithoutCode(response.text) || (newContent !== null ? 'Canvas updated.' : 'No update returned.');
    appendMessage('ai', summary);
  };

  const handleCanvasAction = async (action) => {
    if (state.isLoading) return;
    const canvasContent = els.canvasEditor?.value || '';
    const actionPrompt = ACTION_PROMPTS[action] || 'Improve the document.';
    const selectedStyle = els.styleSelect?.value || 'default';
    const styleHint = selectedStyle === 'default' ? 'Use a balanced, professional style.' : `Preferred writing style: ${selectedStyle}.`;
    const languageHint = buildLanguageHint();
    const prompt = [
      `Action request: ${actionPrompt}`,
      styleHint,
      languageHint,
      'Current Markdown document:',
      canvasContent
    ].join('\n\n');

    setLoading(true);
    const response = await runAiTask(prompt, canvasSystemInstruction());
    setLoading(false);

    if (response.error) {
      appendMessage('ai', normalizeOneLine(`Error: ${response.error}`));
      return;
    }

    const newContent = extractUpdatedMarkdown(response.text);
    if (newContent !== null) {
      setCanvasContent(newContent, true);
    }
    const summary = firstLineWithoutCode(response.text) || `Applied: ${action}`;
    appendMessage('ai', summary);
  };

  const wireEvents = () => {
    if (els.btnSend) els.btnSend.addEventListener('click', handleChatSend);
    if (els.chatInput) {
      els.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleChatSend();
        }
      });
    }

    if (els.providerSelect) {
      els.providerSelect.addEventListener('change', async () => {
        const provider = els.providerSelect.value;
        populateModelSelect(provider, '');
        await fetchProviderModels(provider, false);
        populateModelSelect(provider, '');
      });
    }

    if (els.btnRefreshModels) {
      els.btnRefreshModels.addEventListener('click', refreshModelsForCurrentProvider);
    }

    if (els.btnApplyModel) {
      els.btnApplyModel.addEventListener('click', applyModelSelection);
    }

    if (els.btnNew) {
      els.btnNew.addEventListener('click', () => {
        state.history = [''];
        state.historyIndex = 0;
        setCanvasContent('', false);
        updateHistoryButtons();
      });
    }

    if (els.btnUndo) {
      els.btnUndo.addEventListener('click', () => {
        if (state.historyIndex > 0) {
          state.historyIndex -= 1;
          setCanvasContent(state.history[state.historyIndex], false);
          updateHistoryButtons();
        }
      });
    }

    if (els.btnRedo) {
      els.btnRedo.addEventListener('click', () => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex += 1;
          setCanvasContent(state.history[state.historyIndex], false);
          updateHistoryButtons();
        }
      });
    }

    if (els.btnClearChat) {
      els.btnClearChat.addEventListener('click', () => {
        if (els.chatMessages) els.chatMessages.innerHTML = '';
      });
    }

    if (els.btnMinimize) {
      els.btnMinimize.addEventListener('click', () => window.browserAPI?.window?.minimize?.());
    }

    if (els.btnMaximize) {
      els.btnMaximize.addEventListener('click', () => window.browserAPI?.window?.toggleMaximize?.());
    }

    if (els.btnClose) {
      els.btnClose.addEventListener('click', () => window.browserAPI?.window?.close?.());
    }

    if (els.btnViewToggle) {
      els.btnViewToggle.addEventListener('click', toggleView);
    }

    if (els.canvasEditor) {
      els.canvasEditor.addEventListener('input', () => {
        applyEditorDirection();
        updatePreview();
        updateHighlight();
        scheduleHistoryUpdate();
      });
      els.canvasEditor.addEventListener('scroll', syncScroll);
    }

    if (els.languageSelect) {
      els.languageSelect.addEventListener('change', () => {
        applyEditorLanguageMeta();
        applyEditorDirection();
      });
    }

    if (els.contextFooter) {
      document.addEventListener('contextmenu', (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest('#canvas-context-footer')) return;
        e.preventDefault();
        showContextFooter();
      });

      document.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target?.closest('#canvas-context-footer')) {
          hideContextFooter();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideContextFooter();
      });

      els.contextFooter.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          hideContextFooter();
        });
      });
    }

    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.getAttribute('data-action');
        if (action) handleCanvasAction(action);
      });
    });
  };

  const init = async () => {
    await loadConfig();
    setCanvasContent('', false);
    updateHistoryButtons();
    wireEvents();
    updatePreview();
    updateHighlight();
    applyEditorLanguageMeta();
    applyEditorDirection();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
