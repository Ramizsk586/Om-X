const { app, webContents } = require('electron');
const WebFirewall = require('./firewall/WebFirewall');
const vaultManager = require('./vault/VaultManager');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { AD_ALLOWLIST, CATEGORIES } = require('../blocker/adblockRules');

class SecurityManager {
  constructor(session, settings, mainWindow, virusTotalClient = null) {
    this.session = session;
    this.settings = settings;
    this.mainWindow = mainWindow;
    this.virusTotalClient = virusTotalClient;
    this.firewall = new WebFirewall(settings, virusTotalClient);
    this.adblock = { rules: [], regexes: [], allowlist: new Set() };
    this.cookieShieldLogCache = new Set();
    this.adBlockCountsByWebContentsId = new Map();
    this.totalAdBlockCount = 0;
    
    // Updated to point to security-defense.html as site-lock.html is removed
    this.defensePagePath = path.join(app.getAppPath(), 'html', 'pages', 'security-defense.html');
    
    this.verifyPathIntegrity();
    this.init();
  }

  /**
   * Fail-fast assertion to log path resolution on startup.
   */
  verifyPathIntegrity() {
    if (fs.existsSync(this.defensePagePath)) {
      console.log(`[Om-X Security] Authority verified at: ${this.defensePagePath}`);
    } else {
      console.error(`[Om-X Security] CRITICAL: Security-Defense source not found!`);
      console.error(`[Om-X Security] Resolved Path: ${this.defensePagePath}`);
    }
  }

  updateSettings(newSettings) {
    this.settings = newSettings;
    if (this.virusTotalClient && this.firewall) {
      this.firewall.virusTotalClient = this.virusTotalClient;
    }
    this.firewall.updateSettings(newSettings);
    this.buildAdblockRules();
    this.applyNetworkFilters();
  }

  init() {
    this.buildAdblockRules();
    this.applyNetworkFilters();
    this.setupPopupBlocking();
    this.setupIpcHandlers();
  }

  buildAdblockRules() {
    const cfg = this.settings?.adBlocker || {};
    const enabled = cfg.enabled !== false;
    if (!enabled) {
      this.adblock = { rules: [], regexes: [], allowlist: new Set() };
      return;
    }

    const rules = [];
    if (cfg.blockNetwork !== false) rules.push(...CATEGORIES.NETWORKS);
    if (cfg.blockTrackers !== false) rules.push(...CATEGORIES.TRACKERS);
    if (cfg.blockSocial !== false) rules.push(...CATEGORIES.SOCIAL);
    if (cfg.blockMiners !== false) rules.push(...CATEGORIES.MINERS);

    const custom = Array.isArray(cfg.customRules) ? cfg.customRules : [];
    for (const line of custom) {
      if (!line || line.startsWith('!') || line.startsWith('#')) continue;
      rules.push(...this.normalizeCustomRule(line));
    }

    const uniqueRules = Array.from(new Set(rules));
    const regexes = uniqueRules.map(r => this.wildcardToRegex(r)).filter(Boolean);
    this.adblock = { rules: uniqueRules, regexes, allowlist: new Set(AD_ALLOWLIST) };
  }

  normalizeCustomRule(rule) {
    const r = rule.trim();
    if (!r) return [];
    if (r.startsWith('||')) {
      const domain = r.replace(/^\|\|/, '').replace(/\^/g, '').replace(/\/\*?$/, '');
      return [`*://*.${domain}/*`, `*://${domain}/*`];
    }
    if (r.includes('://') || r.includes('*')) return [r];
    return [`*://*.${r}/*`, `*://${r}/*`];
  }

  wildcardToRegex(pattern) {
    if (!pattern || typeof pattern !== 'string') return null;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regex = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(regex);
  }

  shouldBlockAd(details) {
    const cfg = this.settings?.adBlocker || {};
    if (cfg.enabled === false) return false;
    const { url, resourceType } = details;
    const isMainFrame = resourceType === 'main_frame' || resourceType === 'mainFrame';
    let urlObj;
    try { urlObj = new URL(url); } catch (e) { return false; }
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const pathname = (urlObj.pathname || '').toLowerCase();

    // Allowlist only bypasses main_frame loads to avoid breaking core sites
    if (isMainFrame && this.adblock.allowlist.has(hostname)) return false;

    // Avoid blocking internal or file URLs
    if (url.startsWith('file:') || url.startsWith('chrome:')) return false;

    // Never block core YouTube media streams. Ad requests can fail separately,
    // but blocking `videoplayback` breaks real video/audio rendering.
    if (hostname.endsWith('googlevideo.com') && pathname.includes('/videoplayback')) {
      return false;
    }
    if (resourceType === 'media' && (hostname.endsWith('googlevideo.com') || hostname.endsWith('youtube.com'))) {
      return false;
    }

    // Do not block main_frame by default to reduce false positives
    if (isMainFrame) return false;

    for (const rx of this.adblock.regexes) {
      if (rx.test(url)) return true;
    }
    return false;
  }

  getCookieShieldConfig() {
    const cfg = this.settings?.security?.cookieShield || {};
    return {
      enabled: cfg.enabled !== false,
      blockThirdPartyRequestCookies: cfg.blockThirdPartyRequestCookies !== false,
      blockThirdPartyResponseCookies: cfg.blockThirdPartyResponseCookies !== false
    };
  }

  normalizeSiteIdentityFromHostname(hostname = '') {
    const value = String(hostname || '').trim().toLowerCase().replace(/:\d+$/, '');
    if (!value) return '';
    const parts = value.split('.').filter(Boolean);
    if (parts.length <= 2) return value;

    // Lightweight eTLD+1 heuristic for common multi-part suffixes.
    const multiPartSuffixes = new Set([
      'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
      'com.au', 'net.au', 'org.au',
      'co.in', 'com.br', 'com.mx', 'co.jp'
    ]);
    const tail2 = parts.slice(-2).join('.');
    const tail3 = parts.slice(-3).join('.');
    if (multiPartSuffixes.has(tail2) && parts.length >= 3) return tail3;
    return tail2;
  }

  getSiteIdentityFromUrl(rawUrl = '') {
    try {
      const parsed = new URL(String(rawUrl || '').trim());
      if (!/^https?:$/i.test(parsed.protocol)) return '';
      return this.normalizeSiteIdentityFromHostname(parsed.hostname);
    } catch (_) {
      return '';
    }
  }

  getTopLevelSiteIdentity(details = {}) {
    const referrerSite = this.getSiteIdentityFromUrl(details.referrer || '');
    if (referrerSite) return referrerSite;

    try {
      const wc = webContents.fromId(details.webContentsId);
      if (wc && !wc.isDestroyed()) {
        const currentSite = this.getSiteIdentityFromUrl(wc.getURL());
        if (currentSite) return currentSite;
      }
    } catch (_) {}

    return '';
  }

  isThirdPartySubresource(details = {}) {
    const resourceType = details.resourceType || '';
    const isMainFrame = resourceType === 'main_frame' || resourceType === 'mainFrame';
    if (isMainFrame) return false;

    const targetSite = this.getSiteIdentityFromUrl(details.url || '');
    const topSite = this.getTopLevelSiteIdentity(details);
    if (!targetSite || !topSite) return false;

    return targetSite !== topSite;
  }

  stripCookieRequestHeaders(headers = {}) {
    const next = { ...(headers || {}) };
    for (const key of Object.keys(next)) {
      const lower = key.toLowerCase();
      if (lower === 'cookie' || lower === 'cookie2') {
        delete next[key];
      }
    }
    return next;
  }

  stripSetCookieResponseHeaders(headers = {}) {
    const next = { ...(headers || {}) };
    for (const key of Object.keys(next)) {
      if (key.toLowerCase() === 'set-cookie') {
        delete next[key];
      }
    }
    return next;
  }

  logCookieShieldAction(details, phase) {
    try {
      const targetSite = this.getSiteIdentityFromUrl(details.url || '');
      const topSite = this.getTopLevelSiteIdentity(details);
      if (!targetSite || !topSite) return;
      const key = `${phase}|${topSite}|${targetSite}`;
      if (this.cookieShieldLogCache.has(key)) return;
      this.cookieShieldLogCache.add(key);
      if (this.cookieShieldLogCache.size > 200) {
        const first = this.cookieShieldLogCache.values().next().value;
        if (first) this.cookieShieldLogCache.delete(first);
      }
      console.warn(`[CookieShield] Blocked ${phase} cookies for third-party request: ${topSite} -> ${targetSite}`);
    } catch (_) {}
  }

  /**
   * Modern conversion of absolute file path to URI.
   * Includes type and reason for the defense renderer.
   */
  getLockScreenUrl(targetUrl, type = 'sitelock', reason = 'Access Restricted') {
    try {
        const fileUrl = pathToFileURL(this.defensePagePath).href;
        const url = new URL(fileUrl);
        url.searchParams.set('url', targetUrl);
        url.searchParams.set('type', type);
        url.searchParams.set('reason', reason);
        return url.toString();
    } catch(e) {
        console.error("[Om-X Security] URL Generation Logic Error:", e);
        return 'about:blank';
    }
  }

  applyNetworkFilters() {
    this.session.webRequest.onBeforeRequest(null);
    const filter = { urls: ["*://*/*", "https://*/*", "http://*/*"] };

    this.session.webRequest.onBeforeRequest(filter, (details, callback) => {
       const { url, resourceType } = details;
       const isMainFrame = resourceType === 'main_frame' || resourceType === 'mainFrame';

       // 1. SYSTEM BYPASS: Prevent infinite loops on system pages
       if (url.startsWith('file:') || url.includes('security-defense.html') || url.startsWith('chrome:')) {
           return callback({ cancel: false });
       }

       // 2. AD SHIELD: Block known ad/tracker endpoints (sub-resources only)
       if (this.shouldBlockAd(details)) {
           this.recordAdBlock(details);
           return callback({ cancel: true });
       }

       // 3. FIREWALL SEIZURE LOGIC
       this.firewall.analyzeRequest(details).then(analysis => {
            // For main-frame blocking, avoid redirectURL-to-file because Chromium may reject it as ERR_UNSAFE_REDIRECT.
            if (analysis.action === 'block' && isMainFrame) {
                const lockUrl = this.getLockScreenUrl(url, analysis.type || 'sitelock', analysis.reason);
                try {
                    const targetWc = webContents.fromId(details.webContentsId);
                    if (targetWc && !targetWc.isDestroyed()) {
                        setImmediate(() => {
                            targetWc.loadURL(lockUrl).catch((e) => {
                                console.error('[Om-X Security] Failed to load defense page:', e?.message || e);
                            });
                        });
                    }
                } catch (e) {
                    console.error('[Om-X Security] Failed to resolve blocked webContents:', e?.message || e);
                }
                return callback({ cancel: true });
            }
            callback({ cancel: false });
       }).catch(err => {
           console.error("[Om-X Security] Firewall Exception (Fail-Open):", err);
           callback({ cancel: false });
       });
    });

    this.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      const cfg = this.getCookieShieldConfig();
      if (!cfg.enabled || !cfg.blockThirdPartyRequestCookies) {
        return callback({ requestHeaders: details.requestHeaders });
      }

      if (this.isThirdPartySubresource(details)) {
        const strippedHeaders = this.stripCookieRequestHeaders(details.requestHeaders);
        if (JSON.stringify(strippedHeaders) !== JSON.stringify(details.requestHeaders || {})) {
          this.logCookieShieldAction(details, 'request');
          return callback({ requestHeaders: strippedHeaders });
        }
      }

      callback({ requestHeaders: details.requestHeaders });
    });

    this.session.webRequest.onHeadersReceived(filter, (details, callback) => {
      const cfg = this.getCookieShieldConfig();
      if (!cfg.enabled || !cfg.blockThirdPartyResponseCookies) {
        return callback({ responseHeaders: details.responseHeaders });
      }

      if (this.isThirdPartySubresource(details)) {
        const strippedHeaders = this.stripSetCookieResponseHeaders(details.responseHeaders);
        if (JSON.stringify(strippedHeaders) !== JSON.stringify(details.responseHeaders || {})) {
          this.logCookieShieldAction(details, 'response');
          return callback({ responseHeaders: strippedHeaders });
        }
      }

      callback({ responseHeaders: details.responseHeaders });
    });
  }

  getBlockedSites() {
    return this.firewall.getBlockedSites();
  }

  clearBlockedSites() {
    this.firewall.blockedSites = [];
  }

  recordAdBlock(details = {}) {
    const wcId = Number(details.webContentsId);
    this.totalAdBlockCount += 1;
    if (!Number.isFinite(wcId) || wcId <= 0) return;
    const current = this.adBlockCountsByWebContentsId.get(wcId) || 0;
    this.adBlockCountsByWebContentsId.set(wcId, current + 1);
  }

  getAdBlockStats(webContentsId) {
    const id = Number(webContentsId);
    return {
      count: Number.isFinite(id) && id > 0 ? (this.adBlockCountsByWebContentsId.get(id) || 0) : 0,
      totalCount: this.totalAdBlockCount
    };
  }

  setupPopupBlocking() {
      app.on('web-contents-created', (event, contents) => {
          if (contents && typeof contents.id === 'number') {
              contents.once('destroyed', () => {
                  this.adBlockCountsByWebContentsId.delete(contents.id);
              });
          }
          contents.setWindowOpenHandler((details) => {
              if (details.url.startsWith('file:') || details.url.includes('security-defense.html')) return { action: 'allow' };
              return { action: 'deny' };
          });
      });
  }

  setupIpcHandlers() {
    const { ipcMain } = require('electron');
    
    // Get list of currently blocked sites
    ipcMain.handle('security:get-blocked-sites', () => {
      return this.getBlockedSites();
    });
    
    // Clear blocked sites log
    ipcMain.handle('security:clear-blocked-sites', () => {
      this.clearBlockedSites();
      return true;
    });

    ipcMain.handle('security:get-adblock-stats', (_event, payload = {}) => {
      return this.getAdBlockStats(payload?.webContentsId);
    });
  }
}

module.exports = SecurityManager;
