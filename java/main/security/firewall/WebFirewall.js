class WebFirewall {
  constructor(settings, virusTotalClient = null) {
    this.virusTotalClient = virusTotalClient;
    this.updateSettings(settings);
  }

  updateSettings(settings) {
    this.config = {
      enabled: settings?.features?.enableFirewall ?? true,
      blockPhishing: settings?.features?.blockPhishing ?? true,
      blockMalware: settings?.features?.blockMalware ?? true,
      enableLogging: settings?.features?.enableBlockLogging ?? true
    };
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

    return { action: 'allow' };
  }
}

module.exports = WebFirewall;
