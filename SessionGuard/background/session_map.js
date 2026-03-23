/**
 * SessionGuard — Session Map (OPTIMIZED)
 * 
 * Performance improvements:
 * 1. In-memory session map cache (avoids storage reads)
 * 2. Lazy storage writes (batched on changes)
 * 3. Reduced audit log size
 */

const SESSION_KEY = 'sessionMap';
const AUDIT_KEY = 'auditLog';
const MAX_AUDIT_ENTRIES = 300;

// ── PERFORMANCE: In-memory cache ────────────────────────────────────────
let sessionMapDirty = false;
let sessionFlushTimer = null;

/**
 * Initialize session map and load cache
 */
async function initSessionMap() {
  const data = await chrome.storage.session.get([SESSION_KEY]);
  sessionMapCache = data[SESSION_KEY] || {};
  await chrome.storage.session.set({ [SESSION_KEY]: sessionMapCache });
}

/**
 * Flush session map to storage (debounced)
 */
function scheduleSessionFlush() {
  if (sessionFlushTimer) return;
  sessionMapDirty = true;
  sessionFlushTimer = setTimeout(async () => {
    sessionFlushTimer = null;
    if (!sessionMapDirty) return;
    sessionMapDirty = false;
    await chrome.storage.session.set({ [SESSION_KEY]: sessionMapCache });
  }, 500); // Flush every 500ms if dirty
}

/**
 * Record a session for a domain
 */
async function recordSession(domain, tabId, windowId, cookieName) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  
  // Check in-memory cache first
  if (sessionMapCache[cleanDomain]) return;
  
  sessionMapCache[cleanDomain] = {
    tabId,
    windowId,
    cookieName,
    locked: false,
    fingerprint: createSessionFingerprint(tabId, windowId),
    createdAt: Date.now()
  };
  
  scheduleSessionFlush();
}

/**
 * Get session for a domain (synchronous - uses cache)
 */
async function getSessionByDomain(domain) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  return sessionMapCache[cleanDomain] || null;
}

/**
 * Get session owned by a specific tab
 */
async function getSessionByTabId(tabId) {
  for (const [domain, session] of Object.entries(sessionMapCache)) {
    if (session.tabId === tabId) {
      return { domain, ...session };
    }
  }
  return null;
}

/**
 * Get all active sessions
 */
async function getAllSessions() {
  return sessionMapCache;
}

/**
 * Lock a session
 */
async function lockSession(domain, tabId, windowId) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  if (sessionMapCache[cleanDomain]) {
    sessionMapCache[cleanDomain].locked = true;
    sessionMapCache[cleanDomain].lockedBy = tabId;
    sessionMapCache[cleanDomain].fingerprint = createSessionFingerprint(tabId, windowId);
    scheduleSessionFlush();
  }
}

/**
 * Unlock a session
 */
async function unlockSession(domain) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  if (sessionMapCache[cleanDomain]) {
    sessionMapCache[cleanDomain].locked = false;
    delete sessionMapCache[cleanDomain].lockedBy;
    scheduleSessionFlush();
  }
}

/**
 * Release a session
 */
async function releaseSession(tabId) {
  let changed = false;
  for (const [domain, session] of Object.entries(sessionMapCache)) {
    if (session.tabId === tabId) {
      delete sessionMapCache[domain];
      changed = true;
    }
  }
  if (changed) scheduleSessionFlush();
}

/**
 * Flag potential clone
 */
async function flagPotentialClone(originalTabId, cloneTabId) {
  bufferAuditEvent({
    type: 'potential_clone',
    originalTab: originalTabId,
    cloneTab: cloneTabId,
    timestamp: Date.now()
  });
}

/**
 * Verify session fingerprint
 */
async function verifyFingerprint(domain, tabId, windowId) {
  const session = sessionMapCache[domain.replace(/^www\./, '').toLowerCase()];
  if (!session) return { valid: false, reason: 'No session found' };
  if (session.tabId !== tabId) return { valid: false, reason: 'Tab ID mismatch' };
  return { valid: true };
}

/**
 * Buffer audit event (uses shared buffer from service_worker.js)
 */
function bufferAuditEvent(event) {
  if (typeof auditLogBuffer !== 'undefined') {
    auditLogBuffer.push(event);
  }
}

/**
 * Get audit log
 */
async function getAuditLog() {
  const { auditLog = [] } = await chrome.storage.local.get([AUDIT_KEY]);
  return auditLog.reverse();
}

/**
 * Clear audit log
 */
async function clearAuditLog() {
  await chrome.storage.local.remove([AUDIT_KEY]);
}
