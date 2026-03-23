// OMX Security Blocklist Manager
// Stores and checks blocked/malicious URLs

const STORAGE_KEY = 'omx_blocked_sites';
const VIRUSTOTAL_THRESHOLD = 5; // Flag as malicious if 5+ engines detect it

// Load blocked sites from localStorage
function getBlocklist() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (_) {
    return [];
  }
}

// Save blocked sites to localStorage
function saveBlocklist(list) {
  try {
    // Keep only last 1000 entries to prevent storage bloat
    const trimmed = list.slice(-1000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_) {}
}

// Check if URL or its domain is blocked
export function isBlocked(url) {
  try {
    const blocklist = getBlocklist();
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const fullUrl = parsed.href.toLowerCase();

    for (const entry of blocklist) {
      const blockedHost = entry.hostname.toLowerCase();
      // Exact host match or subdomain match
      if (hostname === blockedHost || hostname.endsWith('.' + blockedHost)) {
        return {
          status: 'BLOCKED',
          reason: entry.reason || 'Blocked by security policy',
          detectedBy: entry.detectedBy || 'VirusTotal',
          detections: entry.detections || 0
        };
      }
    }
    return { status: 'SAFE' };
  } catch (_) {
    return { status: 'SAFE' };
  }
}

// Add URL to blocklist
export function addToBlocklist(url, reason = 'Malicious website', detectedBy = 'VirusTotal', detections = 0) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    
    const blocklist = getBlocklist();
    
    // Check if already blocked
    const exists = blocklist.some(entry => entry.hostname === hostname);
    if (exists) return;

    blocklist.push({
      hostname: hostname,
      url: parsed.href,
      reason: reason,
      detectedBy: detectedBy,
      detections: detections,
      blockedAt: Date.now()
    });

    saveBlocklist(blocklist);
    console.log(`[Security] Blocked: ${hostname} - ${reason}`);
  } catch (_) {}
}

// Remove URL from blocklist
export function removeFromBlocklist(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    
    let blocklist = getBlocklist();
    blocklist = blocklist.filter(entry => entry.hostname !== hostname);
    saveBlocklist(blocklist);
  } catch (_) {}
}

// Get all blocked sites
export function getBlockedSites() {
  return getBlocklist();
}

// Clear entire blocklist
export function clearBlocklist() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

// Check URL against VirusTotal API
// Returns: { isMalicious: boolean, detections: number, reason: string }
export async function checkVirusTotal(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    
    // Use VirusTotal API v3 URL report
    const apiUrl = `https://www.virustotal.com/api/v3/urls`;
    
    // For URL scanning, we submit the URL as form data
    const formData = new URLSearchParams();
    formData.append('url', url);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-apikey': '', // API key will be injected from settings
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      // Try GET request for existing analysis
      const getUrl = `https://www.virustotal.com/api/v3/urls/${encodeURIComponent(url)}`;
      const getResponse = await fetch(getUrl, {
        headers: {
          'x-apikey': ''
        }
      });
      
      if (!getResponse.ok) {
        return { isMalicious: false, detections: 0, reason: 'API check failed', error: true };
      }

      const data = await getResponse.json();
      const stats = data?.data?.attributes?.last_analysis_stats || {};
      const malicious = stats.malicious || 0;
      const suspicious = stats.suspicious || 0;
      const totalDetections = malicious + suspicious;

      return {
        isMalicious: totalDetections >= VIRUSTOTAL_THRESHOLD,
        detections: totalDetections,
        maliciousDetections: malicious,
        suspiciousDetections: suspicious,
        reason: totalDetections >= VIRUSTOTAL_THRESHOLD 
          ? `Detected by ${totalDetections} security engines` 
          : 'Safe'
      };
    }

    const data = await response.json();
    const urlId = data?.data?.id;
    
    // Get analysis results
    const analysisUrl = `https://www.virustotal.com/api/v3/urls/${urlId}`;
    const analysisResponse = await fetch(analysisUrl, {
      headers: {
        'x-apikey': ''
      }
    });

    if (!analysisResponse.ok) {
      return { isMalicious: false, detections: 0, reason: 'Analysis failed', error: true };
    }

    const analysisData = await analysisResponse.json();
    const stats = analysisData?.data?.attributes?.last_analysis_stats || {};
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const totalDetections = malicious + suspicious;

    return {
      isMalicious: totalDetections >= VIRUSTOTAL_THRESHOLD,
      detections: totalDetections,
      maliciousDetections: malicious,
      suspiciousDetections: suspicious,
      reason: totalDetections >= VIRUSTOTAL_THRESHOLD 
        ? `Detected by ${totalDetections} security engines` 
        : 'Safe'
    };
  } catch (error) {
    console.warn('[Security] VirusTotal check failed:', error);
    return { isMalicious: false, detections: 0, reason: 'Check failed', error: true };
  }
}

// Simple hostname-based check using known malicious patterns
// This is a local fallback that doesn't require API
export function checkKnownMaliciousPatterns(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // Known malicious URL patterns
    const maliciousPatterns = [
      // Phishing patterns
      /paypal.*-.*secure/i,
      /bank.*-.*login/i,
      /amazon.*-.*signin/i,
      /apple.*-.*id/i,
      /microsoft.*-.*account/i,
      /netflix.*-.*billing/i,
      
      // Suspicious TLDs commonly used for malware
      /\.top\//i,
      /\.xyz\//i,
      /\.buzz\//i,
      /\.tk\//i,
      /\.ml\//i,
      /\.ga\//i,
      /\.cf\//i,
      
      // IP-based URLs (often malicious)
      /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
      
      // URL shorteners with suspicious paths
      /bit\.ly\/[a-zA-Z0-9]{6,}/i,
      /tinyurl\.com\/[a-zA-Z0-9]{6,}/i,
      
      // Typosquatting patterns
      /g00gle/i,
      /faceb00k/i,
      /amaz0n/i,
      /paypa1/i,
      /micr0soft/i,
      /app1e/i,
      /netf1ix/i,
      /instagr4m/i,
      /what5app/i,
      /you2ube/i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(hostname) || pattern.test(fullUrl)) {
        return {
          isSuspicious: true,
          reason: 'Matches known malicious pattern',
          pattern: pattern.toString()
        };
      }
    }

    return { isSuspicious: false, reason: 'No patterns matched' };
  } catch (_) {
    return { isSuspicious: false, reason: 'URL parse failed' };
  }
}
