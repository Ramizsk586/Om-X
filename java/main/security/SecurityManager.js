const { app, webContents } = require('electron');
const WebFirewall = require('./firewall/WebFirewall');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

class SecurityManager {
  constructor(session, settings, mainWindow, virusTotalClient = null) {
    this.session = session;
    this.settings = settings;
    this.mainWindow = mainWindow;
    this.virusTotalClient = virusTotalClient;
    this.firewall = new WebFirewall(settings, virusTotalClient);
    
    this.blockedDefensePagePath = path.join(app.getAppPath(), 'html', 'pages', 'security-defense-blocked.html');
    
    this.verifyPathIntegrity();
    this.init();
  }

  /**
   * Fail-fast assertion to log path resolution on startup.
   */
  verifyPathIntegrity() {
    if (!fs.existsSync(this.blockedDefensePagePath)) {
      console.error(`[Om-X Security] CRITICAL: Security-Defense blocked page source not found!`);
      console.error(`[Om-X Security] Resolved Path: ${this.blockedDefensePagePath}`);
    }
  }

  resolveDefensePagePath() {
    return this.blockedDefensePagePath;
  }

  isDefensePageUrl(url = '') {
    const value = String(url || '');
    return value.includes('security-defense-blocked.html');
  }

  updateSettings(newSettings) {
    this.settings = newSettings;
    if (this.virusTotalClient && this.firewall) {
      this.firewall.virusTotalClient = this.virusTotalClient;
    }
    this.firewall.updateSettings(newSettings);
    this.applyNetworkFilters();
  }

  init() {
    this.applyNetworkFilters();
    this.setupPopupBlocking();
    this.setupIpcHandlers();
  }

  getCookieShieldConfig() {
    const cfg = this.settings?.security?.cookieShield || {};
    return {
      enabled: cfg.enabled !== false,
      blockThirdPartyRequestCookies: cfg.blockThirdPartyRequestCookies !== false,
      blockThirdPartyResponseCookies: cfg.blockThirdPartyResponseCookies !== false
    };
  }

  getPopupBlockerConfig() {
    const cfg = this.settings?.security?.popupBlocker || {};
    return {
      enabled: cfg.enabled !== false
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
    const candidateKeys = ['referrer', 'initiator', 'originUrl', 'documentURL', 'firstPartyURL'];
    for (const key of candidateKeys) {
      const site = this.getSiteIdentityFromUrl(details?.[key] || '');
      if (site) return site;
    }

    try {
      const wc = webContents.fromId(details.webContentsId);
      if (wc && !wc.isDestroyed()) {
        const currentSite = this.getSiteIdentityFromUrl(wc.getURL());
        if (currentSite) return currentSite;
      }
    } catch (_) {}

    return '';
  }

  normalizeResourceType(resourceType = '') {
    const value = String(resourceType || '').trim().toLowerCase();
    if (value === 'mainframe') return 'main_frame';
    if (value === 'subframe') return 'sub_frame';
    return value;
  }
  isThirdPartySubresource(details = {}) {
    const resourceType = this.normalizeResourceType(details.resourceType);
    const isMainFrame = resourceType === 'main_frame';
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
    } catch (_) {}
  }

  /**
   * Modern conversion of absolute file path to URI.
   * Includes type and reason for the defense renderer.
   */
  getLockScreenUrl(targetUrl, type = 'custom_block', reason = 'Access Restricted') {
    try {
        const pagePath = this.resolveDefensePagePath(type);
        const fileUrl = pathToFileURL(pagePath).href;
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
       const url = String(details?.url || '');
       const resourceType = this.normalizeResourceType(details?.resourceType);
       const isMainFrame = resourceType === 'main_frame';

       // 1. SYSTEM BYPASS: Prevent infinite loops on system pages
       if (url.startsWith('file:') || this.isDefensePageUrl(url) || url.startsWith('chrome:')) {
           return callback({ cancel: false });
       }

       // 2. FIREWALL SEIZURE LOGIC
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

  setupPopupBlocking() {
      app.on('web-contents-created', (event, contents) => {
          contents.setWindowOpenHandler((details) => {
              const targetUrl = String(details?.url || '').trim();
              if (!targetUrl) return { action: 'deny' };
              if (targetUrl.startsWith('file:') || this.isDefensePageUrl(targetUrl)) return { action: 'allow' };
              if (!this.getPopupBlockerConfig().enabled) return { action: 'allow' };

              // Electron 33 may deny popup creation before the renderer webview sees a
              // usable new-window event, so convert guest popups into browser tabs here.
              try {
                  if (contents.getType?.() === 'webview' && this.mainWindow && !this.mainWindow.isDestroyed?.()) {
                      this.mainWindow.webContents.send('open-tab', targetUrl);
                  }
              } catch (error) {
                  console.warn('[Security] Failed to redirect popup into tab:', error?.message || error);
              }

              // Never allow guest pages to spawn separate native popup windows.
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
  }
}

module.exports = SecurityManager;
