import { RESPONSE_DB, KEYWORD_MAP } from '../data/responseDatabase.js';

const TOPIC_DEFS = [
  { key: 'shortcuts list', title: 'Keyboard Shortcuts', category: 'Shortcuts', tag: 'Shortcut Matrix' },
  { key: 'how api works', title: 'API Verification and Failover', category: 'API & AI', tag: 'API Pipeline' },
  { key: 'translator logic', title: 'Translator System Logic', category: 'Translator', tag: 'Translator' },
  { key: 'feature workflows', title: 'Feature Workflows', category: 'Workflows', tag: 'Workflow Map' },
  { key: 'privacy-details', title: 'Privacy and Data Safety', category: 'Security', tag: 'Privacy' },
  { key: 'guardian-technical', title: 'Zero-Trust Guardian', category: 'Security', tag: 'Guardian' },
  { key: 'how to use', title: 'How to Use Om-X', category: 'Guides', tag: 'Usage' },
  { key: 'features', title: 'Features Overview', category: 'Guides', tag: 'Features' },
  { key: 'architecture', title: 'Architecture', category: 'Technical', tag: 'Architecture' },
  { key: 'ui map', title: 'UI Map', category: 'Reference', tag: 'UI IDs' },
  { key: 'panels', title: 'Panel Index', category: 'Reference', tag: 'Panels' },
  { key: 'navigation map', title: 'Navigation Map', category: 'Reference', tag: 'Navigation' },
  { key: 'buttons', title: 'Button Coverage', category: 'Reference', tag: 'Controls' },
  { key: 'page modules', title: 'Page Modules', category: 'Reference', tag: 'Pages' },
  { key: 'search matrix info', title: 'Search Matrix', category: 'Search', tag: 'Search Matrix' },
  { key: 'system requirements', title: 'System Requirements', category: 'Technical', tag: 'Requirements' },
  { key: 'update lineage', title: 'Version Lineage', category: 'Release', tag: 'Versions' }
];

const SYSTEM_PANEL_HINTS = Object.freeze({
  'panel-system': 'General app behavior and startup features.',
  'panel-security': 'Firewall, antivirus, VirusTotal, and cookie shield controls.',
  'panel-password-vault': 'Vault lock/unlock and credential protection.',
  'panel-appearance': 'Theme and visual appearance preferences.',
  'panel-shortcuts': 'Global keyboard shortcut mappings.',
  'panel-search-matrix': 'Search engine routing and keyword setup.',
  'panel-adblocker': 'Ad shield controls and safe-sites access.',
  'panel-block': 'Blocked domain/site management.',
  'panel-advanced': 'Advanced runtime and diagnostics controls.',
  'panel-creator': 'Creator information and links.',
  'panel-about': 'App version/build details.'
});

const HUB_PANEL_HINTS = Object.freeze({
  'panel-hub-dashboard': 'Telemetry and active AI profile status.',
  'panel-hub-translator': 'Translator provider/model configuration.',
  'panel-hub-writer': 'Writer provider/model and rewrite behavior.',
  'panel-hub-llm-chat': 'Quick launch cards for cloud AI chat services.',
  'panel-hub-animations': 'Loading animation selection and save.',
  'panel-hub-panel-tools': 'External utility tools launcher.',
  'panel-hub-help': 'In-app searchable help entry point.'
});

const MAIN_NAV_HINTS = Object.freeze({
  'btn-nav-home': 'Open Home/New Tab surface.',
  'btn-nav-ai-chat': 'Open Omni Chat page.',
  'btn-nav-history': 'Open History page.',
  'btn-nav-settings': 'Open System settings window.',
  'btn-nav-downloads': 'Toggle Downloads panel.',
  'tile-ai-chat': 'Home tile quick launch for AI Chat.',
  'tile-todo-station': 'Home tile for Todo Station.',
  'tile-games': 'Home tile for Games.',
  'tile-neural-hub': 'Home tile for Neural Hub.',
  'tile-history': 'Home tile for History.',
  'tile-minecraft': 'Home tile for Server Operator.'
});

function plainText(value) {
  return String(value || '')
    .replace(/`/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[*_>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMeaningfulLine(text) {
  const lines = String(text || '').split('\n').map((line) => plainText(line)).filter(Boolean);
  return lines[0] || 'No summary available.';
}

function collectAliasesByTarget(map = {}) {
  const out = new Map();
  Object.entries(map).forEach(([alias, target]) => {
    const key = String(target || '').toLowerCase();
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(alias);
  });
  return out;
}

const aliasesByTarget = collectAliasesByTarget(KEYWORD_MAP);

function buildCatalog() {
  return TOPIC_DEFS.map((topic) => {
    const raw = RESPONSE_DB[topic.key];
    const content = Array.isArray(raw) ? raw.join('\n\n') : String(raw || '');
    const aliases = aliasesByTarget.get(topic.key.toLowerCase()) || [];
    return {
      ...topic,
      content,
      summary: firstMeaningfulLine(content),
      aliases
    };
  }).filter((item) => item.content.trim().length > 0);
}

const state = {
  allItems: [],
  visibleItems: [],
  activeId: '',
  detailMode: false,
  liveShortcutLines: []
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function matches(item, query) {
  if (!query) return true;
  const bag = [
    item.title,
    item.category,
    item.key,
    item.tag,
    item.summary,
    item.content,
    ...(item.aliases || [])
  ].join(' ').toLowerCase();
  return bag.includes(query);
}

function groupByCategory(items) {
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  });
  return groups;
}

function normalizeLine(line) {
  return String(line || '')
    .replace(/^\s*[-*]\s+/, '')
    .replace(/^\s*\d+[\.\)]\s+/, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/`/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDetailSections(text, item = null) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const sections = [];
  let current = { title: 'Overview', points: [] };

  for (const raw of lines) {
    const markdownHead = raw.match(/^#{1,6}\s+(.+)$/);
    const strongHead = raw.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (markdownHead || strongHead) {
      if (current.points.length) sections.push(current);
      current = {
        title: normalizeLine((markdownHead ? markdownHead[1] : strongHead[1]) || 'Overview'),
        points: []
      };
      continue;
    }
    const clean = normalizeLine(raw);
    if (!clean) continue;
    current.points.push(clean);
  }
  if (current.points.length) sections.push(current);
  const result = sections.length ? sections : [{ title: 'Overview', points: [normalizeLine(text)] }];

  if (item?.key === 'shortcuts list' && Array.isArray(state.liveShortcutLines) && state.liveShortcutLines.length) {
    result.push({
      title: 'Live Shortcut Mapping',
      points: state.liveShortcutLines
    });
  }

  return result;
}

function isTableLine(line) {
  return /^\|.*\|$/.test(String(line || '').trim());
}

function splitTableCells(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparatorLine(line) {
  const cells = splitTableCells(line);
  if (!cells.length) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function sectionToBlocks(section) {
  const blocks = [];
  const rows = Array.isArray(section?.points) ? section.points : [];
  for (let i = 0; i < rows.length; i += 1) {
    const line = String(rows[i] || '').trim();
    if (!line) continue;
    if (isTableLine(line) && i + 1 < rows.length && isTableSeparatorLine(rows[i + 1])) {
      const header = splitTableCells(line);
      const tableRows = [];
      i += 2;
      while (i < rows.length && isTableLine(rows[i])) {
        const cells = splitTableCells(rows[i]);
        tableRows.push(cells);
        i += 1;
      }
      i -= 1;
      blocks.push({ type: 'table', header, rows: tableRows });
      continue;
    }
    blocks.push({ type: 'point', text: line });
  }
  return blocks;
}

function buildKeyPoints(sections) {
  return (sections || [])
    .flatMap((section) => section.points || [])
    .map((line) => String(line || '').trim())
    .filter((line) => line && !isTableLine(line) && !isTableSeparatorLine(line))
    .slice(0, 8);
}

function renderSectionBlocks(section) {
  const blocks = sectionToBlocks(section);
  const out = [];
  let pointBuffer = [];

  const flushPoints = () => {
    if (!pointBuffer.length) return;
    out.push(`<ul>${pointBuffer.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`);
    pointBuffer = [];
  };

  for (const block of blocks) {
    if (block.type === 'point') {
      pointBuffer.push(block.text);
      continue;
    }
    flushPoints();
    const headerHtml = block.header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
    const rowsHtml = block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    out.push(`<div class="help-table-wrap"><table class="help-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`);
  }
  flushPoints();
  return out.join('');
}

function setDetailMode(enabled) {
  state.detailMode = !!enabled;
  const shell = document.querySelector('.help-shell');
  if (!shell) return;
  shell.classList.toggle('detail-mode', state.detailMode);
}

function renderList(query = '') {
  const list = document.getElementById('help-list');
  const note = document.getElementById('help-note');
  if (!list || !note) return;

  const q = String(query || '').trim().toLowerCase();
  const visible = state.allItems.filter((item) => matches(item, q));
  state.visibleItems = visible;

  if (!visible.length) {
    list.innerHTML = '<div class="help-empty">No results found. Try words like "translator", "api", "shortcut", "security", or "panel".</div>';
    note.textContent = q ? 'Found 0 results' : 'No help cards available';
    state.activeId = '';
    return;
  }

  const grouped = groupByCategory(visible);
  const html = Array.from(grouped.entries()).map(([category, items]) => {
    const cards = items.map((item) => `
      <button type="button" class="help-card ${state.activeId === item.key ? 'active' : ''}" data-help-key="${escapeHtml(item.key)}">
        <div class="help-card-top">
          <h3 class="help-card-title">${escapeHtml(item.title)}</h3>
          <span class="help-key">${escapeHtml(item.tag)}</span>
        </div>
        <p class="help-card-desc">${escapeHtml(item.summary)}</p>
      </button>
    `).join('');
    return `<section><div class="help-cat-head">${escapeHtml(category)}</div>${cards}</section>`;
  }).join('');

  list.innerHTML = html;
  note.textContent = q
    ? `Found ${visible.length} result${visible.length === 1 ? '' : 's'}`
    : `Showing ${visible.length} help card${visible.length === 1 ? '' : 's'}`;
}

function renderDetail(item) {
  const shell = document.querySelector('.help-shell');
  const title = document.getElementById('help-detail-title');
  const category = document.getElementById('help-detail-category');
  const key = document.getElementById('help-detail-key');
  const summary = document.getElementById('help-detail-summary');
  const points = document.getElementById('help-detail-points');
  const content = document.getElementById('help-detail-content');
  const aliases = document.getElementById('help-detail-aliases');
  if (!shell || !title || !category || !key || !summary || !points || !content || !aliases) return;

  if (!item) {
    setDetailMode(false);
    title.textContent = 'Select a help card';
    category.textContent = 'Category';
    key.textContent = 'Source Key';
    summary.textContent = 'Pick any category card to open page module details.';
    points.innerHTML = '<li>Use search or scroll categories to find a topic.</li>';
    content.innerHTML = '<div class="help-section"><h4>Details</h4><ul><li>Full module details will appear after selecting a card.</li></ul></div>';
    aliases.textContent = 'Aliases for this topic will appear here.';
    return;
  }

  setDetailMode(true);
  state.activeId = item.key;
  title.textContent = item.title;
  category.textContent = item.category;
  key.textContent = item.key;
  summary.textContent = item.summary;
  const sections = parseDetailSections(item.content, item);
  const keyPoints = buildKeyPoints(sections);
  points.innerHTML = keyPoints.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  content.innerHTML = sections.map((section) => {
    return `<section class="help-section"><h4>${escapeHtml(section.title)}</h4>${renderSectionBlocks(section)}</section>`;
  }).join('');
  aliases.textContent = item.aliases.length
    ? item.aliases.join(', ')
    : 'No aliases mapped for this topic.';
}

function bindEvents() {
  const search = document.getElementById('help-search');
  const list = document.getElementById('help-list');
  const back = document.getElementById('help-back-btn');
  if (search) {
    search.addEventListener('input', () => {
      renderList(search.value);
      if (state.detailMode) setDetailMode(false);
    });
  }
  if (list) {
    list.addEventListener('click', (event) => {
      const card = event.target.closest('.help-card');
      if (!card) return;
      const key = card.dataset.helpKey || '';
      const item = state.visibleItems.find((entry) => entry.key === key);
      if (!item) return;
      renderDetail(item);
      renderList(search?.value || '');
    });
  }
  if (back) {
    back.addEventListener('click', () => {
      setDetailMode(false);
    });
  }
}

async function injectShortcutCard() {
  try {
    const settings = await window.browserAPI.settings.get();
    const shortcuts = settings?.shortcuts || {};
    const lines = Object.entries(shortcuts).map(([command, shortcut]) => `${command}: ${shortcut || 'Unassigned'}`);
    state.liveShortcutLines = lines;
  } catch (_) {}
}

function extractMatches(text, regex) {
  const out = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) out.push(match[1]);
  }
  return Array.from(new Set(out));
}

async function readHtml(relativePath) {
  try {
    const url = new URL(`../../${relativePath}`, import.meta.url);
    const res = await fetch(url);
    if (!res.ok) return '';
    return await res.text();
  } catch (_) {
    return '';
  }
}

function toLines(ids, hintMap = {}) {
  return (ids || []).map((id) => `${id}: ${hintMap[id] || 'Panel/module available in this app section.'}`);
}

async function injectPanelScanCards() {
  const [systemHtml, hubHtml, extensionsHtml, mainHtml] = await Promise.all([
    readHtml('html/windows/system.html'),
    readHtml('html/windows/neural-hub.html'),
    readHtml('html/windows/extensions.html'),
    readHtml('html/windows/main.html')
  ]);

  const systemTargets = extractMatches(systemHtml, /data-target="(panel-[^"]+)"/g);
  const hubTargets = extractMatches(hubHtml, /data-target="(panel-hub-[^"]+)"/g);
  const extensionPanels = extractMatches(extensionsHtml, /id="(panel-[^"]+)"/g);
  const mainNavButtons = extractMatches(mainHtml, /id="(btn-nav-[^"]+)"/g);
  const homeTiles = extractMatches(mainHtml, /id="(tile-[^"]+)"/g);

  const cards = [];
  if (systemTargets.length) {
    cards.push({
      key: 'live-system-panels',
      title: 'System Panels (Live Scan)',
      category: 'Panel Scan',
      tag: 'System',
      summary: `Detected ${systemTargets.length} system panel targets from system window.`,
      content: [
        'System panel IDs and purpose:',
        ...toLines(systemTargets, SYSTEM_PANEL_HINTS)
      ].join('\n'),
      aliases: ['system panels', 'panel-system', 'settings panels', 'live scan']
    });
  }

  if (hubTargets.length) {
    cards.push({
      key: 'live-neural-hub-panels',
      title: 'Neural Hub Panels (Live Scan)',
      category: 'Panel Scan',
      tag: 'Neural Hub',
      summary: `Detected ${hubTargets.length} Neural Hub panel targets.`,
      content: [
        'Neural Hub panel IDs and purpose:',
        ...toLines(hubTargets, HUB_PANEL_HINTS)
      ].join('\n'),
      aliases: ['neural hub panels', 'panel-hub', 'hub tabs', 'live scan']
    });
  }

  if (extensionPanels.length) {
    cards.push({
      key: 'live-extension-panels',
      title: 'Extensions Window Panels (Live Scan)',
      category: 'Panel Scan',
      tag: 'Extensions',
      summary: `Detected ${extensionPanels.length} extensions window panel id(s).`,
      content: [
        'Extensions window panel IDs:',
        ...toLines(extensionPanels, { 'panel-extensions': 'Extension cards with enable/disable controls.' })
      ].join('\n'),
      aliases: ['extensions panel', 'panel-extensions', 'ublock panel']
    });
  }

  const navItems = [...mainNavButtons, ...homeTiles];
  if (navItems.length) {
    cards.push({
      key: 'live-main-navigation',
      title: 'Main Navigation & Home Tiles (Live Scan)',
      category: 'Panel Scan',
      tag: 'Navigation',
      summary: `Detected ${mainNavButtons.length} sidebar nav buttons and ${homeTiles.length} home tiles.`,
      content: [
        'Main navigation and home launch IDs:',
        ...toLines(navItems, MAIN_NAV_HINTS)
      ].join('\n'),
      aliases: ['btn-nav', 'tile', 'home tiles', 'navigation ids']
    });
  }

  state.allItems.push(...cards);
}

async function init() {
  state.allItems = buildCatalog();
  await injectShortcutCard();
  await injectPanelScanCards();
  bindEvents();
  renderList('');
  renderDetail(null);
}

document.addEventListener('DOMContentLoaded', init);
