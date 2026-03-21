const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

function asString(value) {
  return String(value || '').trim();
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return '';
}

function uniquePaths(paths = []) {
  const seen = new Set();
  const result = [];

  for (const filePath of paths) {
    const normalized = asString(filePath);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function getCandidateSettingsPaths() {
  const home = os.homedir();
  const appData = asString(process.env.APPDATA);
  const xdgConfigHome = asString(process.env.XDG_CONFIG_HOME);

  return uniquePaths([
    process.env.SCRABER_SETTINGS_PATH,
    process.env.SCRAPER_SETTINGS_PATH,
    process.env.OMX_USER_SETTINGS_PATH,
    appData ? path.join(appData, 'om-x', 'user-settings.json') : '',
    appData ? path.join(appData, 'Om-X', 'user-settings.json') : '',
    xdgConfigHome ? path.join(xdgConfigHome, 'om-x', 'user-settings.json') : '',
    path.join(home, '.config', 'om-x', 'user-settings.json'),
    path.join(home, 'Library', 'Application Support', 'om-x', 'user-settings.json')
  ]);
}

function loadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function extractGroqConfig(settings) {
  if (!settings || typeof settings !== 'object') return { apiKey: '', model: '' };

  const aiConfig = settings.aiConfig || {};
  const providerConfig = aiConfig?.browserSettings?.providers?.groq || {};
  const providerRows = Array.isArray(aiConfig.providers)
    ? aiConfig.providers.filter((entry) => asString(entry?.provider).toLowerCase() === 'groq')
    : [];

  const scraperConfig = aiConfig?.scraper || {};
  const scraperKeys = Array.isArray(scraperConfig?.groqKeys)
    ? scraperConfig.groqKeys.map((entry) => asString(entry)).filter(Boolean)
    : [];

  const llmConfig = settings.llm || {};
  const llmProvider = asString(llmConfig.provider).toLowerCase();
  const providerRowWithKey = providerRows.find((entry) => asString(entry?.key));
  const providerRowWithModel = providerRows.find((entry) => asString(entry?.model));

  const apiKey = firstNonEmpty([
    process.env.GROQ_API_KEY,
    process.env.GROQ_KEY,
    aiConfig?.keys?.groq,
    aiConfig?.keys?.groqApiKey,
    providerConfig?.key,
    providerRowWithKey?.key,
    scraperKeys[0],
    scraperConfig?.groqKey,
    llmProvider === 'groq' ? llmConfig.key : ''
  ]);

  const model = firstNonEmpty([
    process.env.GROQ_MODEL,
    aiConfig?.keys?.groqModel,
    providerConfig?.model,
    providerRowWithModel?.model,
    llmProvider === 'groq' ? llmConfig.model : '',
    DEFAULT_MODEL
  ]);

  return { apiKey, model };
}

function readGroqConfigFromScraberSettings() {
  const paths = getCandidateSettingsPaths();
  for (const filePath of paths) {
    const parsed = loadJson(filePath);
    if (!parsed) continue;
    const config = extractGroqConfig(parsed);
    if (config.apiKey) {
      return { ...config, sourcePath: filePath };
    }
  }

  return { apiKey: '', model: DEFAULT_MODEL, sourcePath: '' };
}

function withTimeoutSignal(timeoutMs = 20000) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function compactAnswer(rawText) {
  const lines = decodeHtmlEntities(rawText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return 'I could not generate a response right now.';
  return lines.slice(0, 3).join('\n');
}

async function askGroqShortAnswer(question, context = {}) {
  const query = asString(question);
  if (!query) {
    throw new Error('empty_question');
  }

  const config = readGroqConfigFromScraberSettings();
  if (!config.apiKey) {
    throw new Error('groq_api_key_missing');
  }

  const systemPrompt = [
    'You are Om AI inside Om Chat.',
    'Reply in 1 to 3 short lines only.',
    'Sound friendly, chill, expressive, and human like a close online friend.',
    'Use natural contractions and casual phrasing.',
    'You can use 0 to 2 fitting emojis when they match the mood.',
    'Be playful when the user is playful, warm when the user is casual, and helpful without sounding robotic.',
    'Never sound corporate, stiff, or overly formal.'
  ].join(' ');

  const scopeHint = [
    context.serverName ? `Server: ${context.serverName}.` : '',
    context.channelName ? `Channel: ${context.channelName}.` : '',
    context.username ? `User: ${context.username}.` : ''
  ].join(' ').trim();

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    signal: withTimeoutSignal(25000),
    body: JSON.stringify({
      model: config.model || DEFAULT_MODEL,
      temperature: 0.85,
      max_tokens: 180,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${scopeHint}\n\nQuestion: ${query}`.trim() }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = asString(data?.error?.message) || `groq_http_${response.status}`;
    throw new Error(apiMessage);
  }

  const content = asString(data?.choices?.[0]?.message?.content);
  return compactAnswer(content);
}

module.exports = {
  askGroqShortAnswer,
  readGroqConfigFromScraberSettings
};


