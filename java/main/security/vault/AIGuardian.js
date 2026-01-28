const crypto = require('crypto');

/**
 * AI GUARDIAN: SECURITY ADVISOR
 * Responsible for intent classification and behavioral pattern detection.
 */
class AIGuardian {
  constructor() {
    // Infrastructure and static assets (Low risk)
    this.utilityHosts = new Set([
        'gstatic.com', 'google-analytics.com', 'googleapis.com', 
        'googletagmanager.com', 'google.co.in', 'google.com',
        'fonts.googleapis.com', 'fonts.gstatic.com', 'maps.google.com',
        'wikipedia.org', 'github.com', 'stackoverflow.com'
    ]);

    this.identityMap = new Map([
        ['youtu.be', 'youtube.com'],
        ['googlevideo.com', 'youtube.com'],
        ['x.com', 'twitter.com']
    ]);

    this.tabRegistry = new Map();
    this.RISK_THRESHOLD_HIGH = 40; 
    this.WINDOW_MS = 15000; 
  }

  getPrimaryIdentity(hostname) {
    if (!hostname) return '';
    let domain = hostname.toLowerCase();
    if (this.identityMap.has(domain)) return this.identityMap.get(domain);
    const parts = domain.split('.');
    if (parts.length > 2) {
        const base = parts.slice(-2).join('.');
        return this.identityMap.get(base) || base;
    }
    return domain;
  }

  resetRiskForDomain(hostname) {
    const targetIdentity = this.getPrimaryIdentity(hostname);
    for (let [tabId, record] of this.tabRegistry.entries()) {
        record.attempts = record.attempts.filter(a => this.getPrimaryIdentity(a.domain) !== targetIdentity);
        if (record.attempts.length === 0) record.riskScore = 0;
        else record.riskScore *= 0.5;
    }
  }

  analyzeNavigation(tabId, hostname, transitionType, path = '') {
    const now = Date.now();
    const identity = this.getPrimaryIdentity(hostname);
    
    // Google infrastructure is utility, but dynamic /search paths are NOT.
    // This allows login/maps to work while inspecting results.
    const isUtility = [...this.utilityHosts].some(h => hostname.endsWith(h));
    const isSearchPath = path.startsWith('/search') || path.startsWith('/results');
    
    if (isUtility && !isSearchPath) return { action: 'allow', score: 0 };

    let record = this.tabRegistry.get(tabId) || { attempts: [], riskScore: 0 };
    const recent = record.attempts.filter(a => (now - a.ts) < this.WINDOW_MS);
    const last = recent[recent.length - 1];
    
    let weight = 0;
    if (recent.length >= 3 && recent.every(a => this.getPrimaryIdentity(a.domain) === identity)) weight += 20;
    if (last && last.domain !== hostname && this.getPrimaryIdentity(last.domain) === identity) weight += 30; 

    record.riskScore = Math.min(100, (record.riskScore * 0.4) + weight);
    record.attempts.push({ ts: now, domain: hostname });
    if (record.attempts.length > 5) record.attempts.shift();

    let result = { action: 'allow', score: record.riskScore };
    if (record.riskScore >= this.RISK_THRESHOLD_HIGH) result.action = 'request_lock'; 

    this.tabRegistry.set(tabId, record);
    return result;
  }

  resetTab(tabId) {
    this.tabRegistry.delete(tabId);
  }
}

module.exports = new AIGuardian();