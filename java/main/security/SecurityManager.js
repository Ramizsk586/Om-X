const { app } = require('electron');
const WebFirewall = require('./firewall/WebFirewall');
const vaultManager = require('./vault/VaultManager');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

class SecurityManager {
  constructor(session, settings, mainWindow) {
    this.session = session;
    this.settings = settings;
    this.mainWindow = mainWindow;
    this.firewall = new WebFirewall(settings);
    
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
    this.firewall.updateSettings(newSettings);
    this.applyNetworkFilters();
  }

  init() {
    this.applyNetworkFilters();
    this.setupPopupBlocking();
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

       // 1. SYSTEM BYPASS: Prevent infinite loops on system pages
       if (url.startsWith('file:') || url.includes('security-defense.html') || url.startsWith('chrome:')) {
           return callback({ cancel: false });
       }

       // 2. FIREWALL SEIZURE LOGIC
       this.firewall.analyzeRequest(details).then(analysis => {
            // Seize main_frame ONLY to ensure defense page is visible and sub-resources don't hang.
            if (analysis.action === 'block' && resourceType === 'main_frame') {
                const lockUrl = this.getLockScreenUrl(url, analysis.type || 'sitelock', analysis.reason);
                return callback({ redirectURL: lockUrl });
            }
            callback({ cancel: false });
       }).catch(err => {
           console.error("[Om-X Security] Firewall Exception (Fail-Open):", err);
           callback({ cancel: false });
       });
    });

    this.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => callback({ requestHeaders: details.requestHeaders }));
    this.session.webRequest.onHeadersReceived(filter, (details, callback) => callback({ responseHeaders: details.responseHeaders }));
  }

  setupPopupBlocking() {
      app.on('web-contents-created', (event, contents) => {
          contents.setWindowOpenHandler((details) => {
              if (details.url.startsWith('file:') || details.url.includes('security-defense.html')) return { action: 'allow' };
              return { action: 'deny' };
          });
      });
  }
}

module.exports = SecurityManager;