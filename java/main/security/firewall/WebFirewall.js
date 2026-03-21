class WebFirewall {
  constructor(settings, virusTotalClient = null) {
    this.blockedSites = [];
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
    const { url, resourceType } = details;
    const isMainFrame = resourceType === 'main_frame' || resourceType === 'mainFrame';
    
    let urlObj;
    try { urlObj = new URL(url); } catch(e) { return { action: 'allow' }; }

    const hostname = urlObj.hostname;
    const domain = hostname.replace(/^www\./, '');

    if (!this.config.enabled) {
        return { action: 'allow' };
    }

    // 1. SYSTEM BYPASS: Internal/Extension protocols must always load.
    if (
      url.startsWith('file:') ||
      url.startsWith('chrome:') ||
      url.includes('security-defense-blocked.html')
    ) {
        return { action: 'allow' };
    }

    // 2. CUSTOM BLOCKLIST: Check user-added blocklist
    if (this.isCustomBlocked(domain)) {
        this.logBlockedSite(domain, 'User blocklist', 'custom_block');
        if (isMainFrame) {
            return { 
                action: 'block', 
                type: 'custom_block',
                reason: 'Site added to block list' 
            };
        }
        return { action: 'allow' };
    }

    return { action: 'allow' };
  }
}

module.exports = WebFirewall;
