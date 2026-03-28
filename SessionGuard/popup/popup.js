/**
 * SessionGuard — Popup Script (OPTIMIZED)
 * 
 * Performance improvements:
 * 1. Cached data loading
 * 2. Reduced DOM operations
 * 3. Efficient event handling
 * 3. OM-X embedded mode support
 */

// Cache for faster popup loading
let cachedSettings = null;
let cachedSessions = null;
let cachedDomains = null;
const OMX_READ_ONLY_TEXT = 'Managed by OM-X in embedded mode';

// Detect if running in OM-X iframe context
const isOmXContext = window !== window.parent && !window.chrome?.runtime;

document.addEventListener('DOMContentLoaded', () => {
  if (isOmXContext) applyOmXEmbeddedMode();
  initTabs();
  loadAllData();
  setupEventListeners();

  if (!isOmXContext && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'ALERT') {
        showToast(message.message);
        loadStats();
      }
    });
  }
});

function injectPanelNotice(panelId, message) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  let note = panel.querySelector('.embedded-note');
  if (!note) {
    note = document.createElement('div');
    note.className = 'embedded-note';
    panel.insertBefore(note, panel.firstChild);
  }
  note.textContent = message;
}

function applyOmXEmbeddedMode() {
  document.body.classList.add('omx-embedded');
  injectPanelNotice('sessionsPanel', 'Live protection stats are available here. Advanced controls stay read-only inside OM-X.');
  injectPanelNotice('domainsPanel', 'Protected domain management is available in SessionGuard extension mode.');
  injectPanelNotice('logPanel', 'Audit log details are available in SessionGuard extension mode.');
  injectPanelNotice('settingsPanel', 'SessionGuard settings are managed by OM-X in the embedded view.');

  const domainInput = document.getElementById('domainInput');
  const addDomain = document.getElementById('addDomain');
  const enableProtection = document.getElementById('enableProtection');
  const strictMode = document.getElementById('strictMode');
  const lockTimeout = document.getElementById('lockTimeout');
  const clearLog = document.getElementById('clearLog');

  [domainInput, addDomain, enableProtection, strictMode, lockTimeout, clearLog].forEach((node) => {
    if (!node) return;
    node.disabled = true;
    node.setAttribute('title', OMX_READ_ONLY_TEXT);
  });
}

// ── OM-X Embedded Mode: Get data from parent window ─────────────────────
async function getOmXData() {
  return new Promise((resolve) => {
    const handler = (e) => {
      if (e.data?.type === 'SESSIONGUARD_DATA') {
        window.removeEventListener('message', handler);
        resolve(e.data);
      }
    };
    window.addEventListener('message', handler);
    // Request data from OM-X parent
    window.parent.postMessage({ type: 'GET_SESSIONGUARD_DATA' }, '*');
    // Timeout fallback
    setTimeout(() => resolve(null), 2000);
  });
}

// ── Load all data in parallel ───────────────────────────────────────────
async function loadAllData() {
  if (isOmXContext) {
    // OM-X embedded mode
    const data = await getOmXData();
    if (data) {
      applySettings({
        settings: { enabled: data.enabled !== false, strictMode: false, lockTimeout: 30000 },
        blockedAttempts: data.threatsBlocked || 0,
        alertCount: 0
      });
      const currentDomain = String(data.domain || '').trim();
      const currentSessions = currentDomain
        ? {
            [currentDomain]: {
              tabId: 'OM-X',
              createdAt: Date.now(),
              locked: data.enabled !== false
            }
          }
        : {};
      renderSessions(currentSessions, { readOnly: true });
      document.getElementById('sessionCount').textContent = currentDomain ? 1 : 0;
      document.getElementById('statusBadge').textContent = data.enabled ? 'Active' : 'Disabled';
      
      // Show current domain info
      renderDomains(currentDomain ? [currentDomain + ' (current)'] : [], { readOnly: true });
    } else {
      // Fallback: show basic info
      applySettings({ settings: { enabled: true }, blockedAttempts: 0, alertCount: 0 });
      renderSessions({}, { readOnly: true });
      renderDomains([], { readOnly: true });
    }
    document.getElementById('logList').innerHTML = '<div class="empty-state">Audit log is available in extension mode.</div>';
    return;
  }

  // Extension mode
  try {
    const [settingsResp, sessionsResp, domainsResp] = await Promise.all([
      new Promise(r => chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, r)),
      new Promise(r => chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, r)),
      new Promise(r => chrome.runtime.sendMessage({ type: 'GET_PROTECTED_DOMAINS' }, r))
    ]);
    
    if (settingsResp) {
      cachedSettings = settingsResp;
      applySettings(settingsResp);
    }
    if (sessionsResp) {
      cachedSessions = sessionsResp.sessions || {};
      renderSessions(cachedSessions);
    }
    if (domainsResp) {
      cachedDomains = domainsResp.protectedDomains || [];
      renderDomains(cachedDomains);
    }
  } catch (e) {
    console.warn('SessionGuard: Failed to load data', e);
  }
}

// ── Tab Navigation ──────────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + 'Panel').classList.add('active');

      if (tab.dataset.tab === 'log') loadAuditLog();
    });
  });
}

// ── Apply Settings to UI ────────────────────────────────────────────────
function applySettings(response) {
  const { settings = {}, blockedAttempts = 0, alertCount = 0 } = response;
  
  document.getElementById('enableProtection').checked = settings.enabled !== false;
  document.getElementById('strictMode').checked = settings.strictMode === true;
  document.getElementById('lockTimeout').value = settings.lockTimeout || 30000;
  document.getElementById('blockedCount').textContent = blockedAttempts;
  document.getElementById('alertCount').textContent = alertCount;
  updateStatusBadge(settings.enabled !== false);
}

function updateStatusBadge(enabled) {
  const badge = document.getElementById('statusBadge');
  badge.textContent = enabled ? 'Protected' : 'Disabled';
  badge.className = 'status-badge ' + (enabled ? 'active' : 'disabled');
}

// ── Render Sessions (efficient DOM update) ──────────────────────────────
function renderSessions(sessions, { readOnly = false } = {}) {
  const list = document.getElementById('sessionList');
  const count = Object.keys(sessions).length;
  document.getElementById('sessionCount').textContent = count;

  if (count === 0) {
    list.innerHTML = '<div class="empty-state">No active sessions</div>';
    return;
  }

  // Build HTML string (faster than individual DOM insertions)
  let html = '';
  for (const [domain, session] of Object.entries(sessions)) {
    const createdAt = Number(session?.createdAt || 0);
    const age = createdAt ? Math.floor((Date.now() - createdAt) / 1000) : 0;
    const ageStr = createdAt
      ? (age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`)
      : 'Current protected site';
    const lockMarkup = readOnly
      ? `<span class="session-lock-indicator ${session.locked ? 'locked' : 'unlocked'}">${session.locked ? 'Protected' : 'Visible'}</span>`
      : `<button class="session-lock ${session.locked ? 'locked' : 'unlocked'}" data-domain="${domain}" data-tab="${session.tabId}">
            ${session.locked ? '🔒 Locked' : '🔓 Unlocked'}
          </button>`;

    html += `
      <div class="session-item" data-domain="${domain}">
        <div>
          <div class="session-domain">${domain}</div>
          <div class="session-info">Tab ${session.tabId} · ${ageStr}</div>
        </div>
        <div class="session-status">
          ${lockMarkup}
        </div>
      </div>`;
  }
  list.innerHTML = html;

  // Attach event delegation (single listener instead of N)
  if (!readOnly) {
    list.querySelectorAll('.session-lock').forEach(btn => {
      btn.addEventListener('click', handleLockToggle);
    });
  }
}

function handleLockToggle(e) {
  const btn = e.target.closest('.session-lock');
  if (!btn) return;
  const domain = btn.dataset.domain;
  const isLocked = btn.classList.contains('locked');
  
  chrome.runtime.sendMessage({
    type: isLocked ? 'UNLOCK_SESSION' : 'LOCK_SESSION',
    domain,
    tabId: parseInt(btn.dataset.tab, 10)
  }, () => {
    btn.classList.toggle('locked');
    btn.classList.toggle('unlocked');
    btn.textContent = btn.classList.contains('locked') ? '🔒 Locked' : '🔓 Unlocked';
  });
}

// ── Render Domains ──────────────────────────────────────────────────────
function renderDomains(domains, { readOnly = false } = {}) {
  const list = document.getElementById('domainList');
  
  let html = '';
  for (const domain of domains) {
    html += `
      <div class="domain-item" data-domain="${domain}">
        <span class="domain-name">${domain}</span>
        ${readOnly ? '' : `<button class="btn-remove" data-domain="${domain}" title="Remove">×</button>`}
      </div>`;
  }
  list.innerHTML = html;

  // Event delegation for remove buttons
  if (readOnly) return;
  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = btn.dataset.domain;
      chrome.runtime.sendMessage({ type: 'REMOVE_DOMAIN', domain }, (resp) => {
        if (resp?.success) {
          btn.closest('.domain-item')?.remove();
        }
      });
    });
  });
}

// ── Load Audit Log ──────────────────────────────────────────────────────
function loadAuditLog() {
  if (isOmXContext) {
    document.getElementById('logList').innerHTML = '<div class="empty-state">Audit log is available in extension mode.</div>';
    return;
  }
  chrome.runtime.sendMessage({ type: 'GET_AUDIT_LOG' }, (response) => {
    if (!response?.log) return;
    renderAuditLog(response.log);
  });
}

function renderAuditLog(log) {
  const list = document.getElementById('logList');

  if (log.length === 0) {
    list.innerHTML = '<div class="empty-state">No events logged</div>';
    return;
  }

  const typeLabels = {
    cookie_read_blocked: 'Cookie Read Blocked',
    cookie_write_blocked: 'Cookie Write Blocked',
    fetch_blocked: 'Fetch Blocked',
    storage_token_detected: 'Token in Storage',
    clone_detected: 'Tab Clone Detected',
    window_opener_blocked: 'Opener Blocked'
  };

  let html = '';
  for (const event of log.slice(0, 30)) {
    const severity = event.type.includes('blocked') ? 'error' : 'warning';
    const typeLabel = typeLabels[event.type] || event.type;
    const time = formatTime(event.timestamp);
    
    html += `
      <div class="log-item ${severity}">
        <div class="log-type">${typeLabel}</div>
        <div class="log-detail">Tab ${event.tabId || event.sourceTabId || 'N/A'}</div>
        <div class="log-time">${time}</div>
      </div>`;
  }
  list.innerHTML = html;
}

// ── Load Stats ──────────────────────────────────────────────────────────
function loadStats() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    if (!response) return;
    document.getElementById('blockedCount').textContent = response.blockedAttempts || 0;
    document.getElementById('alertCount').textContent = response.alertCount || 0;
  });
}

// ── Event Listeners ─────────────────────────────────────────────────────
function setupEventListeners() {
  // Add domain
  const addBtn = document.getElementById('addDomain');
  const input = document.getElementById('domainInput');

  if (isOmXContext) {
    document.getElementById('refreshSessions')?.addEventListener('click', () => loadAllData());
  } else {
    addBtn.addEventListener('click', () => addDomain(input));
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addDomain(input);
    });
  }

  // Settings - skip in OM-X context (settings managed by OM-X)
  if (!isOmXContext) {
    document.getElementById('enableProtection').addEventListener('change', (e) => {
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { enabled: e.target.checked } });
      updateStatusBadge(e.target.checked);
    });

    document.getElementById('strictMode').addEventListener('change', (e) => {
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { strictMode: e.target.checked } });
    });

    document.getElementById('lockTimeout').addEventListener('change', (e) => {
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { lockTimeout: parseInt(e.target.value, 10) } });
    });

    // Refresh & Clear
    document.getElementById('refreshSessions').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (resp) => {
        if (resp?.sessions) renderSessions(resp.sessions);
      });
    });

    document.getElementById('clearLog').addEventListener('click', () => {
      chrome.storage.local.remove(['auditLog'], () => {
        document.getElementById('logList').innerHTML = '<div class="empty-state">No events logged</div>';
      });
    });
  }
}

function addDomain(input) {
  let domain = input.value.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

  if (!domain) return;

  chrome.runtime.sendMessage({ type: 'ADD_DOMAIN', domain }, (resp) => {
    if (resp?.success) {
      input.value = '';
      // Optimistic UI update
      if (cachedDomains) {
        cachedDomains.push(domain);
        renderDomains(cachedDomains);
      }
      showToast(`Added ${domain}`);
    }
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function showToast(message) {
  const toast = document.getElementById('alertToast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}
