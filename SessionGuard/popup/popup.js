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

// Detect if running in OM-X iframe context
const isOmXContext = window !== window.parent && !window.chrome?.runtime;

document.addEventListener('DOMContentLoaded', () => {
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
      document.getElementById('sessionCount').textContent = data.tabsCount || 0;
      document.getElementById('statusBadge').textContent = data.enabled ? 'Active' : 'Disabled';
      
      // Show current domain info
      if (data.domain) {
        renderDomains([data.domain + ' (current)']);
      }
    } else {
      // Fallback: show basic info
      applySettings({ settings: { enabled: true }, blockedAttempts: 0, alertCount: 0 });
    }
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
function renderSessions(sessions) {
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
    const age = Math.floor((Date.now() - session.createdAt) / 1000);
    const ageStr = age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;

    html += `
      <div class="session-item" data-domain="${domain}">
        <div>
          <div class="session-domain">${domain}</div>
          <div class="session-info">Tab ${session.tabId} · ${ageStr}</div>
        </div>
        <div class="session-status">
          <button class="session-lock ${session.locked ? 'locked' : 'unlocked'}" data-domain="${domain}" data-tab="${session.tabId}">
            ${session.locked ? '🔒 Locked' : '🔓 Unlocked'}
          </button>
        </div>
      </div>`;
  }
  list.innerHTML = html;

  // Attach event delegation (single listener instead of N)
  list.querySelectorAll('.session-lock').forEach(btn => {
    btn.addEventListener('click', handleLockToggle);
  });
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
function renderDomains(domains) {
  const list = document.getElementById('domainList');
  
  let html = '';
  for (const domain of domains) {
    html += `
      <div class="domain-item" data-domain="${domain}">
        <span class="domain-name">${domain}</span>
        <button class="btn-remove" data-domain="${domain}" title="Remove">×</button>
      </div>`;
  }
  list.innerHTML = html;

  // Event delegation for remove buttons
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

  addBtn.addEventListener('click', () => addDomain(input));
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addDomain(input);
  });

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
