const state = {
  images: [],
  history: []
};

const els = {
  status: document.getElementById('vision-status'),
  serverStatus: document.getElementById('vision-server-status'),
  history: document.getElementById('vision-history'),
  preview: document.getElementById('vision-preview'),
  warning: document.getElementById('vision-warning'),
  chat: document.getElementById('vision-chat'),
  fileInput: document.getElementById('vision-file'),
  prompt: document.getElementById('vision-prompt'),
  send: document.getElementById('vision-send'),
  modelChip: document.getElementById('vision-model-chip')
};

const visionToken = '<fake_token_around_image><image><fake_token_around_image>';

const setStatus = (message, isWarning = false) => {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.toggle('warning', Boolean(isWarning));
};

const setWarning = (message) => {
  if (!els.warning) return;
  els.warning.textContent = message || '';
};

const setServerStatus = (message) => {
  if (!els.serverStatus) return;
  els.serverStatus.textContent = message;
};

const appendHistory = (label) => {
  if (!els.history) return;
  const item = document.createElement('div');
  item.className = 'history-item';
  item.textContent = label;
  els.history.prepend(item);
};

const appendChat = (role, text) => {
  if (!els.chat) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  els.chat.appendChild(bubble);
  els.chat.scrollTop = els.chat.scrollHeight;
  return bubble;
};

const showTypingBubble = () => {
  if (!els.chat) return null;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble assistant';
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  els.chat.appendChild(bubble);
  els.chat.scrollTop = els.chat.scrollHeight;
  return bubble;
};

const typewriter = async (element, text, speed = 18) => {
  if (!element) return;
  element.textContent = '';
  for (let i = 0; i < text.length; i += 1) {
    element.textContent += text[i];
    await new Promise((resolve) => setTimeout(resolve, speed));
  }
};

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    const base64 = result.includes(',') ? result.split(',')[1] : result;
    resolve(base64);
  };
  reader.onerror = () => reject(new Error('Failed to read image'));
  reader.readAsDataURL(file);
});

const getServerBaseUrl = async () => {
  let host = '127.0.0.1';
  let port = '8080';
  try {
    const statusRes = await window.browserAPI?.servers?.getStatus?.('llama');
    if (statusRes?.success && statusRes.status?.config) {
      const cfg = statusRes.status.config;
      host = String(cfg.launchHost || cfg.host || host);
      port = String(cfg.port || port);
      if (els.modelChip && cfg.modelPath) {
        const parts = String(cfg.modelPath).split(/[/\\]/);
        els.modelChip.textContent = parts.at(-1) || 'Vision model';
      }
    }
  } catch (_) {}

  try {
    const raw = localStorage.getItem('llama-server-settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.host) host = String(s.host).trim() || host;
      if (s?.port) port = String(s.port).trim() || port;
    }
  } catch (_) {}

  if (host === '0.0.0.0' || host === 'ngrok' || host === 'local' || host === 'localhost' || host === '') {
    host = '127.0.0.1';
  }
  if (host.startsWith('http://') || host.startsWith('https://')) {
    const parsed = new URL(host);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
  }
  return `http://${host}:${port}`;
};

const detectVisionCapability = async () => {
  try {
    const statusRes = await window.browserAPI?.servers?.getStatus?.('llama');
    if (statusRes?.success && statusRes.status?.config) {
      const cfg = statusRes.status.config;
      const vision = Boolean(cfg.supportsVision || cfg.mmprojPath || String(cfg.modelType || '').toLowerCase() === 'vision');
      setStatus(vision ? 'Vision-capable model detected' : 'Text-only model detected', !vision);
      if (!cfg.mmprojPath && vision) {
        setWarning('mmproj is missing. Vision requests will fail until a projector is configured.');
      } else {
        setWarning('');
      }
      return vision;
    }
  } catch (_) {}
  setStatus('Unable to confirm model capability. Start the llama server first.', true);
  return false;
};

const updatePreview = () => {
  if (!els.preview) return;
  if (!state.images.length) {
    els.preview.textContent = 'No image';
    return;
  }
  const first = state.images[0];
  const img = document.createElement('img');
  img.src = first.dataUrl;
  const label = document.createElement('span');
  label.textContent = state.images.length > 1
    ? `${first.file.name} +${state.images.length - 1}`
    : first.file.name;
  els.preview.innerHTML = '';
  els.preview.appendChild(img);
  els.preview.appendChild(label);
};

const buildPrompt = (question) => {
  const prefix = Array.from({ length: state.images.length }, () => visionToken).join('\n');
  return `${prefix} ${question}`.trim();
};

const sendVisionRequest = async () => {
  const question = String(els.prompt?.value || '').trim();
  if (!question) {
    setWarning('Please enter a question.');
    return;
  }
  if (!state.images.length) {
    setWarning('Please upload at least one image.');
    return;
  }
  setWarning('');
  appendChat('user', question);
  appendHistory(question.slice(0, 60));

  const baseUrl = await getServerBaseUrl();
  setServerStatus(`Server: ${baseUrl}`);
  const prompt = buildPrompt(question);
  const image_data = state.images.map((image, idx) => ({ data: image.base64, id: idx }));

  try {
    const typingBubble = showTypingBubble();
    const res = await fetch(`${baseUrl}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_data,
        n_predict: 128,
        temperature: 0.2,
        stream: false
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Server error ${res.status}`);
    }
    const data = await res.json();
    const answer = String(data?.content || data?.choices?.[0]?.text || '').trim();
    if (typingBubble) typingBubble.remove();
    const bubble = appendChat('assistant', '');
    await typewriter(bubble, answer || 'No response received.', 14);
  } catch (err) {
    const bubble = appendChat('assistant', '');
    await typewriter(bubble, `Error: ${err?.message || err}`, 10);
  }
};

const init = async () => {
  await detectVisionCapability();
  setServerStatus('Server: --');

  if (els.fileInput) {
    els.fileInput.addEventListener('change', async (event) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      state.images = [];
      for (const file of files) {
        const base64 = await readFileAsBase64(file);
        state.images.push({ file, base64, dataUrl: URL.createObjectURL(file) });
      }
      updatePreview();
    });
  }

  if (els.send) {
    els.send.addEventListener('click', () => sendVisionRequest());
  }
  if (els.prompt) {
    els.prompt.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendVisionRequest();
      }
    });
  }
};

init();
