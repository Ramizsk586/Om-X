const vaultManager = require('../vault/VaultManager');
const aiGuardian = require('../vault/AIGuardian');
const { MALWARE_DOMAINS } = require('../blocklists/malwareDomains');

class WebFirewall {
  constructor(settings) {
    this.updateSettings(settings);
  }

  updateSettings(settings) {
    this.config = {
      enabled: settings?.features?.enableFirewall ?? true
    };
  }

  /**
   * Final Enforcement Decision.
   * Logic: Seize control of the main_frame for restricted sites (malware or high risk).
   */
  async analyzeRequest(details) {
    const { url, webContentsId, resourceType } = details;
    
    let urlObj;
    try { urlObj = new URL(url); } catch(e) { return { action: 'allow' }; }

    const hostname = urlObj.hostname;
    const identity = aiGuardian.getPrimaryIdentity(hostname);

    // 1. SYSTEM BYPASS: Internal/Extension protocols must always load.
    if (url.startsWith('file:') || url.startsWith('chrome:') || url.includes('security-defense.html')) {
        return { action: 'allow' };
    }

    // 2. USER TRUST: Explicitly trusted domains bypass all security checks.
    if (vaultManager.trustedManifest.has(identity)) {
        return { action: 'allow' };
    }

    // 3. UTILITY BYPASS: Google infrastructure is utility
    if (aiGuardian.utilityHosts.has(identity) && !urlObj.pathname.startsWith('/search')) {
        return { action: 'allow' };
    }

    // 4. AI GUARDIAN BEHAVIORAL ANALYSIS
    const ai = aiGuardian.analyzeNavigation(webContentsId, hostname, details.transitionType, urlObj.pathname);

    // 5. SYSTEM PROTECTOR: MALWARE ONLY (Porn/Adult blocks removed per user request)
    const isMalware = MALWARE_DOMAINS.some(d => hostname.endsWith(d));
    
    const isAuthorized = vaultManager.isAuthorized(webContentsId, hostname);

    // Seizure condition: Malware or behavioral risk exceeds threshold.
    const requiresSeizure = (isMalware || ai.action === 'request_lock');

    if (requiresSeizure && !isAuthorized) {
        if (resourceType === 'main_frame') {
            let reason = 'AI Protector: Behavioral Isolation';
            if (isMalware) reason = 'Malware Threat Detected';
            
            return { 
                action: 'block', 
                type: 'sitelock', 
                reason: reason 
            };
        }
        return { action: 'allow' };
    }

    return { action: 'allow' };
  }
}

module.exports = WebFirewall;