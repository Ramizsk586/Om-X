/**
 * SessionGuard — Background Service Worker (OPTIMIZED)
 * 
 * Performance improvements:
 * 1. In-memory domain cache (avoids storage reads on every call)
 * 2. In-memory session map cache
 * 3. Pre-compiled regex patterns
 * 4. Debounced badge updates
 * 5. Batched audit log writes
 * 6. Set-based domain lookups (O(1) vs O(n))
 * 7. Fixed targetDomain.hostname bug
 */

// ── Imports ──────────────────────────────────────────────────────────────
importScripts('domain_manager.js', 'session_map.js');

// ── State ────────────────────────────────────────────────────────────────
let blockedAttempts = 0;
let alertCount = 0;
let settings = {
  enabled: true,
  strictMode: false,
  lockTimeout: 30000
};

// ── PERFORMANCE: In-memory caches ───────────────────────────────────────
let protectedDomainsCache = new Set();
let sessionMapCache = {};
let badgeUpdatePending = false;
let auditLogBuffer = [];
let auditFlushTimer = null;

// ── PERFORMANCE: Pre-compiled regex ─────────────────────────────────────
const TOKEN_COOKIE_RE = /session|sid|ssid|token|auth|jwt|__secure-|__host-|xsrf|csrf|connect\.sid|phpsessid|asp\.net_sessionid|jsessionid|cfduid|_gat|_gid/i;

const DOMAIN_CLEAN_RE = /^www\./;

// ── PERFORMANCE: Domain lookup with cache ────────────────────────────────
function isDomainProtectedSync(domain) {
  const cleanDomain = domain.replace(DOMAIN_CLEAN_RE, '').toLowerCase();
  // O(1) Set lookup instead of O(n) array.some()
  if (protectedDomainsCache.has(cleanDomain)) return true;
  // Check subdomain match
  for (const pd of protectedDomainsCache) {
    if (cleanDomain.endsWith('.' + pd)) return true;
  }
  return false;
}

async function isDomainProtected(domain) {
  // Sync fast path if cache is warm
  if (protectedDomainsCache.size > 0) {
    return isDomainProtectedSync(domain);
  }
  // Cold start: load cache first
  await loadProtectedDomainsCache();
  return isDomainProtectedSync(domain);
}

async function loadProtectedDomainsCache() {
  const { protectedDomains = [] } = await chrome.storage.sync.get(['protectedDomains']);
  protectedDomainsCache = new Set(protectedDomains.map(d => d.replace(DOMAIN_CLEAN_RE, '').toLowerCase()));
}

// ── Initialization ───────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(['settings', 'protectedDomains']);
  if (!existing.settings) {
    await chrome.storage.sync.set({
      settings,
      protectedDomains: DEFAULT_PROTECTED_DOMAINS
    });
  }
  await initSessionMap();
  await loadProtectedDomainsCache();
  updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await initSessionMap();
  await loadProtectedDomainsCache();
  const stored = await chrome.storage.sync.get(['settings']);
  if (stored.settings) settings = stored.settings;
});

// ── Default Protected Domains ────────────────────────────────────────────
const DEFAULT_PROTECTED_DOMAINS = [
  'discord.com', 'youtube.com', 'instagram.com', 'facebook.com',
  'twitter.com', 'x.com', 'github.com', 'linkedin.com', 'reddit.com',
  'google.com', 'netflix.com', 'amazon.com', 'twitch.tv', 'tiktok.com',
  'spotify.com', 'apple.com', 'microsoft.com', 'slack.com', 'zoom.us',
  'zoom.com', 'dropbox.com', 'outlook.com', 'live.com'
];

// ── Session Fingerprint (cached per call) ────────────────────────────────
function createSessionFingerprint(tabId, windowId) {
  return {
    tabId,
    windowId,
    timestamp: Date.now(),
    hash: (tabId * 31 + windowId * 37 + Date.now()).toString(36)
  };
}

// ── Tab Management ───────────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const session = await getSessionByTabId(tabId);
  if (session) {
    chrome.alarms.create(`r-${tabId}`, { when: Date.now() + settings.lockTimeout });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('r-')) {
    const tabId = parseInt(alarm.name.substring(2), 10);
    await releaseSession(tabId);
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.openerTabId) {
    const openerSession = await getSessionByTabId(tab.openerTabId);
    if (openerSession) {
      await flagPotentialClone(tab.openerTabId, tab.id);
    }
  }
});

// ── Cookie Interception ──────────────────────────────────────────────────
chrome.cookies.onChanged.addListener(async (changeInfo) => {
  if (!settings.enabled) return;
  
  const cookie = changeInfo.cookie;
  const domain = cookie.domain.replace(/^\./, '');
  
  if (!isDomainProtectedSync(domain)) return;

  // Token check uses pre-compiled regex
  const isSessionToken = TOKEN_COOKIE_RE.test(cookie.name);
  
  if (changeInfo.removed && changeInfo.cause === 'expired_overwrite') {
    bufferAuditEvent({
      type: 'cookie_expired',
      domain,
      cookieName: cookie.name,
      timestamp: Date.now()
    });
  }
  
  if (!changeInfo.removed && isSessionToken) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      await recordSession(domain, activeTab.id, activeTab.windowId, cookie.name);
    }
  }
});

// ── Web Request Monitoring (FIXED BUG: targetUrl.hostname) ───────────────
chrome.webRequest?.onBeforeSendHeaders?.addListener(
  async (details) => {
    if (!settings.enabled) return { requestHeaders: details.requestHeaders };
    
    const { url, tabId, requestHeaders } = details;
    if (tabId < 0) return { requestHeaders: details.requestHeaders };
    
    try {
      const targetUrl = new URL(url);
      const targetDomain = targetUrl.hostname.replace(DOMAIN_CLEAN_RE, ''); // FIXED: was targetDomain.hostname
      
      if (!isDomainProtectedSync(targetDomain)) return { requestHeaders: details.requestHeaders };
      
      const tabInfo = await chrome.tabs.get(tabId);
      const tabUrl = new URL(tabInfo.url || 'about:blank');
      const tabDomain = tabUrl.hostname.replace(DOMAIN_CLEAN_RE, '');
      
      const isCrossOrigin = !tabDomain.endsWith(targetDomain) && !targetDomain.endsWith(tabDomain);
      
      if (isCrossOrigin && requestHeaders) {
        const cookieHeader = requestHeaders.find(h => h.name.toLowerCase() === 'cookie');
        if (cookieHeader) {
          const session = await getSessionByDomain(targetDomain);
          if (session && session.tabId !== tabId) {
            blockedAttempts++;
            bufferAuditEvent({
              type: 'cookie_header_blocked',
              sourceTabId: tabId,
              targetDomain,
              sessionOwnerTab: session.tabId,
              url: details.url,
              timestamp: Date.now()
            });
            scheduleBadgeUpdate();
            return { requestHeaders: requestHeaders.filter(h => h.name.toLowerCase() !== 'cookie') };
          }
        }
      }
    } catch (e) {}
    
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders', 'blocking']
);

// ── Message Handler (batched audit logging) ──────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(e => {
    sendResponse({ error: e.message });
  });
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_SETTINGS':
      return { settings, blockedAttempts, alertCount };
    
    case 'UPDATE_SETTINGS':
      settings = { ...settings, ...message.settings };
      await chrome.storage.sync.set({ settings });
      return { success: true };
    
    case 'GET_PROTECTED_DOMAINS':
      return { protectedDomains: Array.from(protectedDomainsCache) };
    
    case 'ADD_DOMAIN':
      await addProtectedDomain(message.domain);
      return { success: true };
    
    case 'REMOVE_DOMAIN':
      await removeProtectedDomain(message.domain);
      return { success: true };
    
    case 'GET_SESSIONS':
      return { sessions: sessionMapCache };
    
    case 'GET_AUDIT_LOG':
      return { log: await getAuditLog() };
    
    case 'BLOCKED_ATTEMPT':
      blockedAttempts++;
      scheduleBadgeUpdate();
      return { success: true };
    
    case 'COOKIE_READ_ATTEMPT':
      return await handleCookieReadAttempt(message, sender);
    
    case 'COOKIE_WRITE_ATTEMPT':
      return await handleCookieWriteAttempt(message, sender);
    
    case 'LOCK_SESSION':
      await lockSession(message.domain, message.tabId, message.windowId);
      return { success: true };
    
    case 'UNLOCK_SESSION':
      await unlockSession(message.domain);
      return { success: true };
    
    case 'FETCH_BLOCKED':
      blockedAttempts++;
      bufferAuditEvent({ type: 'fetch_blocked', sourceUrl: message.url, targetDomain: message.targetDomain, tabId: sender.tab?.id, timestamp: Date.now() });
      scheduleBadgeUpdate();
      return { success: true };
    
    case 'STORAGE_TOKEN_DETECTED':
      bufferAuditEvent({ type: 'storage_token_detected', storage: message.storage, key: message.key, pattern: message.pattern, tabId: sender.tab?.id, url: sender.tab?.url, timestamp: Date.now() });
      return { success: true };
    
    case 'CLONE_DETECTED':
      blockedAttempts++;
      bufferAuditEvent({ type: 'clone_detected', originalTab: message.originalTab, cloneTab: message.cloneTab, domain: message.domain, timestamp: Date.now() });
      scheduleBadgeUpdate();
      return { success: true };
    
    case 'WINDOW_OPENER_BLOCKED':
      blockedAttempts++;
      bufferAuditEvent({ type: 'window_opener_blocked', tabId: sender.tab?.id, domain: message.domain, timestamp: Date.now() });
      scheduleBadgeUpdate();
      return { success: true };
    
    default:
      return { error: 'Unknown message type' };
  }
}

// ── Cookie Read Handler ──────────────────────────────────────────────────
async function handleCookieReadAttempt(message, sender) {
  const tabId = sender.tab?.id;
  const sourceUrl = sender.tab?.url;
  
  if (!tabId || !sourceUrl) return { allowed: true };
  
  try {
    const sourceUrlObj = new URL(sourceUrl);
    const sourceDomain = sourceUrlObj.hostname.replace(DOMAIN_CLEAN_RE, '');
    const targetDomain = message.domain.replace(DOMAIN_CLEAN_RE, '');
    
    if (!isDomainProtectedSync(targetDomain)) return { allowed: true };
    
    if (sourceDomain === targetDomain || sourceDomain.endsWith('.' + targetDomain) || targetDomain.endsWith('.' + sourceDomain)) {
      return { allowed: true };
    }
    
    blockedAttempts++;
    scheduleBadgeUpdate();
    bufferAuditEvent({ type: 'cookie_read_blocked', sourceTabId: tabId, sourceDomain, targetDomain, url: sourceUrl, timestamp: Date.now() });
    
    return { allowed: false, reason: 'Cross-tab cookie access blocked by SessionGuard' };
  } catch (e) {
    return { allowed: true };
  }
}

// ── Cookie Write Handler ─────────────────────────────────────────────────
async function handleCookieWriteAttempt(message, sender) {
  const tabId = sender.tab?.id;
  const sourceUrl = sender.tab?.url;
  
  if (!tabId || !sourceUrl) return { allowed: true };
  
  try {
    const sourceDomain = new URL(sourceUrl).hostname.replace(DOMAIN_CLEAN_RE, '');
    const targetDomain = message.domain.replace(DOMAIN_CLEAN_RE, '');
    
    if (!isDomainProtectedSync(targetDomain)) return { allowed: true };
    
    if (sourceDomain === targetDomain || sourceDomain.endsWith('.' + targetDomain)) {
      return { allowed: true };
    }
    
    blockedAttempts++;
    scheduleBadgeUpdate();
    bufferAuditEvent({ type: 'cookie_write_blocked', sourceTabId: tabId, sourceDomain, targetDomain, url: sourceUrl, timestamp: Date.now() });
    
    return { allowed: false, reason: 'Cross-domain cookie write blocked' };
  } catch (e) {
    return { allowed: true };
  }
}

// ── PERFORMANCE: Debounced badge update ──────────────────────────────────
function scheduleBadgeUpdate() {
  if (badgeUpdatePending) return;
  badgeUpdatePending = true;
  setTimeout(() => {
    badgeUpdatePending = false;
    chrome.action.setBadgeText({ text: blockedAttempts > 0 ? String(blockedAttempts) : '' });
    chrome.action.setBadgeBackgroundColor({ color: blockedAttempts > 0 ? '#ef4444' : '#22c55e' });
  }, 200); // Batch updates every 200ms
}

function updateBadge() {
  chrome.action.setBadgeText({ text: blockedAttempts > 0 ? String(blockedAttempts) : '' });
  chrome.action.setBadgeBackgroundColor({ color: blockedAttempts > 0 ? '#ef4444' : '#22c55e' });
}

// ── PERFORMANCE: Batched audit log writes ────────────────────────────────
function bufferAuditEvent(event) {
  auditLogBuffer.push(event);
  
  if (auditFlushTimer) return; // Already scheduled
  
  auditFlushTimer = setTimeout(async () => {
    auditFlushTimer = null;
    const buffer = auditLogBuffer.splice(0); // Take all buffered events
    if (buffer.length === 0) return;
    
    const { auditLog = [] } = await chrome.storage.local.get(['auditLog']);
    auditLog.push(...buffer);
    
    // Keep only last 300 entries
    if (auditLog.length > 300) {
      auditLog.splice(0, auditLog.length - 300);
    }
    
    await chrome.storage.local.set({ auditLog });
  }, 1000); // Flush every 1 second
}

// ── Notification (throttled) ─────────────────────────────────────────────
let lastNotificationTime = 0;
async function notifyUser(tabId, message) {
  alertCount++;
  scheduleBadgeUpdate();
  
  // Throttle notifications (max 1 per 3 seconds)
  const now = Date.now();
  if (now - lastNotificationTime < 3000) return;
  lastNotificationTime = now;
  
  chrome.runtime.sendMessage({ type: 'ALERT', message, tabId, timestamp: now }).catch(() => {});
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/shield128.png', title: 'SessionGuard Alert', message, priority: 2 }).catch(() => {});
}
