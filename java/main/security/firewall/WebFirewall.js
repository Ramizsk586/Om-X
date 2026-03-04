const vaultManager = require('../vault/VaultManager');
const aiGuardian = require('../vault/AIGuardian');
const { MALWARE_DOMAINS, isMalwareDomain, getThreatInfo } = require('../blocklists/malwareDomains');
const { EDUCATION_ALLOWLIST, isEducationalDomain } = require('../blocklists/educationAllowlist');
const { analyzeForPhishing } = require('../blocklists/phishingPatterns');

class WebFirewall {
  constructor(settings, virusTotalClient = null) {
    this.blockedSites = [];
    this.trustCache = new Set();
    this.virusTotalClient = virusTotalClient;
    this.updateSettings(settings);
  }

  updateSettings(settings) {
    this.config = {
      enabled: settings?.features?.enableFirewall ?? true,
      blockPhishing: settings?.features?.blockPhishing ?? true,
      blockMalware: settings?.features?.blockMalware ?? true,
      enableLogging: settings?.features?.enableBlockLogging ?? true,
      enableVirusTotal: settings?.features?.enableVirusTotal ?? false,
      virusTotalScanUrls: settings?.security?.virusTotal?.scanUrls ?? true
    };
    
    // Load custom blocklist from settings
    if (settings?.blocklist) {
      this.blockedSites = Array.from(new Set(settings.blocklist));
    }
  }

  /**
   * Log blocked domain for UI display
   */
  logBlockedSite(domain, reason, threatType = 'unknown') {
    if (!this.config.enableLogging) return;
    
    // Prevent duplicates
    if (this.blockedSites.includes(domain)) return;
    
    this.blockedSites.push(domain);
    
    // Keep only recent 500 entries
    if (this.blockedSites.length > 500) {
      this.blockedSites = this.blockedSites.slice(-500);
    }
  }

  /**
   * Get list of currently blocked sites
   */
  getBlockedSites() {
    return [...this.blockedSites];
  }

  /**
   * Check custom blocklist
   */
  isCustomBlocked(domain) {
    return this.blockedSites.some(blocked => {
      return domain === blocked || domain.endsWith('.' + blocked);
    });
  }

  /**
   * Final Enforcement Decision (Enhanced).
   * Logic: Seize control of the main_frame for restricted sites (malware, phishing, or high risk).
   */
  async analyzeRequest(details) {
    const { url, webContentsId, resourceType } = details;
    const isMainFrame = resourceType === 'main_frame' || resourceType === 'mainFrame';
    
    let urlObj;
    try { urlObj = new URL(url); } catch(e) { return { action: 'allow' }; }

    const hostname = urlObj.hostname;
    const domain = hostname.replace(/^www\./, '');
    const identity = aiGuardian.getPrimaryIdentity(hostname);

    // 1. SYSTEM BYPASS: Internal/Extension protocols must always load.
    if (url.startsWith('file:') || url.startsWith('chrome:') || url.includes('security-defense.html')) {
        return { action: 'allow' };
    }

    // 2. TRUSTED CACHE: Check cache first for performance
    if (this.trustCache.has(identity)) {
        return { action: 'allow' };
    }

    // 3. USER TRUST: Explicitly trusted domains bypass all security checks.
    if (vaultManager.trustedManifest.has(identity)) {
        this.trustCache.add(identity);
        return { action: 'allow' };
    }

    // 3.5. SESSION AUTHORIZATION: Master-key unlock for this tab/domain should bypass
    // the remaining firewall pipeline (temporary, non-persistent).
    if (vaultManager.isAuthorized(webContentsId, hostname)) {
        return { action: 'allow' };
    }

    // 4. EDUCATIONAL WHITELIST: Allow educational domains
    if (isEducationalDomain(domain)) {
        this.trustCache.add(identity);
        return { action: 'allow' };
    }

    // 5. UTILITY BYPASS: Google infrastructure is utility
    if (aiGuardian.utilityHosts.has(identity) && !urlObj.pathname.startsWith('/search')) {
        return { action: 'allow' };
    }

    // 6. CUSTOM BLOCKLIST: Check user-added blocklist
    if (this.isCustomBlocked(domain)) {
        this.logBlockedSite(domain, 'User blocklist', 'custom_block');
        if (isMainFrame) {
            return { 
                action: 'block', 
                type: 'sitelock', 
                reason: 'Site added to block list' 
            };
        }
        return { action: 'allow' };
    }

    // 7. MALWARE CHECK: Check against malware domains
    if (isMalwareDomain(domain)) {
        const threatInfo = getThreatInfo(domain);
        this.logBlockedSite(domain, 'Malware detected', threatInfo?.category || 'malware');
        
        if (isMainFrame) {
            return { 
                action: 'block', 
                type: 'sitelock', 
                reason: `Threat Detected: ${threatInfo?.category || 'Malware'}`,
                threatType: threatInfo?.category
            };
        }
        return { action: 'allow' };
    }

    // 8. VIRUSTOTAL URL REPUTATION (optional cloud scan for unknown domains)
    if (
      isMainFrame &&
      this.config.enableVirusTotal &&
      this.config.virusTotalScanUrls &&
      !aiGuardian.utilityHosts.has(identity) &&
      this.virusTotalClient?.isConfigured?.()
    ) {
      try {
        const vt = await this.virusTotalClient.scanUrl(url, { timeoutMs: 6000 });
        if (vt?.blocked) {
          this.logBlockedSite(domain, vt.reason || 'VirusTotal URL detection', 'virustotal_url');
          return {
            action: 'block',
            type: 'sitelock',
            reason: `VirusTotal: ${vt.reason || 'URL flagged as dangerous.'}`,
            threatType: 'virustotal'
          };
        }
      } catch (error) {
        console.warn('[Security] VirusTotal URL scan failed:', error?.message || error);
      }
    }

    // 9. PHISHING DETECTION: Pattern-based phishing detection
    if (this.config.blockPhishing) {
      const phishingAnalysis = analyzeForPhishing(url);
      if (phishingAnalysis.is_suspicious && phishingAnalysis.threat_level === 'high') {
            const primaryThreat = phishingAnalysis.threats[0];
            this.logBlockedSite(domain, 'Phishing detected', primaryThreat?.type);
            
            if (isMainFrame) {
                return { 
                    action: 'block', 
                    type: 'sitelock', 
                    reason: `Phishing Alert: ${primaryThreat?.type}`,
                    threatType: 'phishing'
                };
            }
        }
    }

    // 10. AI GUARDIAN BEHAVIORAL ANALYSIS
    const ai = aiGuardian.analyzeNavigation(webContentsId, hostname, details.transitionType, urlObj.pathname);

    // Seizure condition: Behavioral risk exceeds threshold
    if (ai.action === 'request_lock') {
        this.logBlockedSite(domain, 'Behavioral analysis', 'behavioral_risk');
        
        if (isMainFrame) {
            return { 
                action: 'block', 
                type: 'sitelock', 
                reason: 'AI Protector: Behavioral Isolation',
                threatType: 'behavioral'
            };
        }
        return { action: 'allow' };
    }

    return { action: 'allow' };
  }
}

module.exports = WebFirewall;
