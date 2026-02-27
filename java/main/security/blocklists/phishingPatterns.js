
// Layer 2B: Phishing Pattern Detection (v1.0)
// Regex patterns and behavioral indicators for phishing detection
// Last updated: January 2026

const PHISHING_PATTERNS = [
  // Generic account verification phishing
  /account[-_]?verif/i,
  /verify[-_]?account/i,
  /confirm[-_]?(identity|account|payment)/i,
  /urgent[-_]?action/i,
  /immediate[-_]?action/i,
  /update[-_]?payment/i,
  /confirm[-_]?payment/i,
  
  // Banking & Finance Phishing
  /secure[-_]?login/i,
  /bank[-_]?login/i,
  /online[-_]?banking/i,
  /verify[-_]?bank/i,
  /update[-_]?bank[-_]?details/i,
  
  // Cryptocurrency Phishing
  /wallet[-_]?connect/i,
  /verify[-_]?crypto/i,
  /confirm[-_]?wallet/i,
  /sign[-_]?transaction/i,
  
  // System/Software Phishing
  /system[-_]?alert/i,
  /critical[-_]?update/i,
  /urgent[-_]?update/i,
  /pc[-_]?infected/i,
  /your[-_]?pc[-_]?is/i,
  /security[-_]?warning/i,
  /virus[-_]?detected/i,
];

// Suspicious domain patterns
const SUSPICIOUS_PATTERNS = [
  // Typosquatting (common misspellings)
  /goog1e/i,           // google
  /faceb00k/i,         // facebook
  /amaz0n/i,           // amazon
  /app1e/i,            // apple
  /micr0soft/i,        // microsoft
  /paypa1/i,           // paypal
  /youtu6e/i,          // youtube
  
  // Lookalike domains
  /-secure/i,
  /-verify/i,
  /-official/i,
  /-support/i,
  /-service/i,
  /-account/i,
  
  // Suspicious TLDs often used for phishing
  /\.work$/i,
  /\.tech$/i,
  /\.cloud$/i,
  /\.online$/i,
  /\.site$/i,
  /\.space$/i,
  /\.xyz$/i,
];

// Brand names that are frequently spoofed
const BRAND_SPOOFING = [
  'google',
  'facebook',
  'amazon',
  'apple',
  'microsoft',
  'paypal',
  'youtube',
  'netflix',
  'instagram',
  'whatsapp',
  'telegram',
  'discord',
  'steam',
  'origin',
  'epic',
  'bank of america',
  'chase',
  'wells fargo',
  'citibank',
  'irs',
  'social security'
];

/**
 * Check if a domain/URL matches phishing patterns
 * @param {string} url - URL or domain to check
 * @returns {object} Detection result
 */
function detectPhishingPattern(url) {
  if (!url) return { detected: false };
  
  const lowerUrl = url.toLowerCase();
  
  for (const pattern of PHISHING_PATTERNS) {
    if (pattern.test(lowerUrl)) {
      return {
        detected: true,
        type: 'phishing_pattern',
        pattern: pattern.toString(),
        risk: 'high'
      };
    }
  }
  
  return { detected: false };
}

/**
 * Check if domain contains suspicious patterns
 * @param {string} domain - Domain to check
 * @returns {object} Detection result
 */
function detectSuspiciousPattern(domain) {
  if (!domain) return { detected: false };
  
  const lowerDomain = domain.toLowerCase();
  
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(lowerDomain)) {
      return {
        detected: true,
        type: 'suspicious_pattern',
        pattern: pattern.toString(),
        risk: 'medium'
      };
    }
  }
  
  return { detected: false };
}

/**
 * Check if domain contains brand spoofing attempts
 * @param {string} domain - Domain to check
 * @returns {object} Detection result
 */
function detectBrandSpoofing(domain) {
  if (!domain) return { detected: false };
  
  const lowerDomain = domain.toLowerCase();
  
  for (const brand of BRAND_SPOOFING) {
    // Check for close matches (might have slight modifications)
    if (lowerDomain.includes(brand.replace(/\s+/g, ''))) {
      // Check if it's not the official domain
      const officialPattern = new RegExp(`^([a-z0-9-]+\\.)?${brand.replace(/\s+/g, '')}\\.`, 'i');
      if (!officialPattern.test(lowerDomain)) {
        return {
          detected: true,
          type: 'brand_spoofing',
          brand: brand,
          risk: 'high'
        };
      }
    }
  }
  
  return { detected: false };
}

/**
 * Comprehensive phishing detection
 * @param {string} url - URL to analyze
 * @returns {object} Combined detection result
 */
function analyzeForPhishing(url) {
  if (!url) return { threat_level: 'none', threats: [] };
  
  const threats = [];
  let threat_level = 'none';
  
  // Parse domain from URL
  let domain = url;
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname;
  } catch (e) {
    // If parsing fails, work with what we have
  }
  
  // Check each detection type
  const phishing = detectPhishingPattern(url);
  const suspicious = detectSuspiciousPattern(domain);
  const spoofing = detectBrandSpoofing(domain);
  
  if (phishing.detected) {
    threats.push(phishing);
    threat_level = 'high';
  }
  
  if (spoofing.detected) {
    threats.push(spoofing);
    threat_level = 'high';
  }
  
  if (suspicious.detected) {
    threats.push(suspicious);
    if (threat_level === 'none') threat_level = 'medium';
  }
  
  return {
    url: url,
    domain: domain,
    threat_level: threat_level,
    threats: threats,
    is_suspicious: threats.length > 0
  };
}

module.exports = {
  PHISHING_PATTERNS,
  SUSPICIOUS_PATTERNS,
  BRAND_SPOOFING,
  detectPhishingPattern,
  detectSuspiciousPattern,
  detectBrandSpoofing,
  analyzeForPhishing
};
