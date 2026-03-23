/**
 * SessionGuard — Token Detector (OPTIMIZED)
 * 
 * Performance improvements:
 * 1. Pre-compiled regex patterns (compiled once, used many times)
 * 2. Early-exit optimizations
 * 3. Reduced string operations
 */

// PERFORMANCE: Pre-compiled regex patterns (compiled once)
const TOKEN_PATTERNS = [
  { name: 'JWT', re: /^eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/, severity: 'high' },
  { name: 'Bearer', re: /^Bearer\s+[A-Za-z0-9_-]{20,}/i, severity: 'high' },
  { name: 'AWSToken', re: /^AKIA[A-Z0-9]{16}$/, severity: 'high' },
  { name: 'PrivateKey', re: /^-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, severity: 'critical' },
  { name: 'APIKey', re: /^(api[_-]?key|apikey|secret[_-]?key)\s*[:=]/i, severity: 'high' },
  { name: 'SessionHex', re: /^[a-f0-9]{32,128}$/, severity: 'medium' },
  { name: 'OAuthToken', re: /^[A-Za-z0-9]{32,128}$/, severity: 'medium' },
  { name: 'LongToken', re: /^[A-Za-z0-9_-]{64,}$/, severity: 'medium' },
  { name: 'UUID', re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, severity: 'low' },
  { name: 'Base64Token', re: /^[A-Za-z0-9+/]{40,}={0,2}$/, severity: 'low' }
];

// PERFORMANCE: Pre-compiled for isTokenRelatedKey
const TOKEN_KEY_RE = /token|session|auth|jwt|sid|ssid|access_token|refresh_token|id_token|secret|bearer|credential|password/i;

/**
 * Detect token pattern in value
 */
function detectTokenPattern(value) {
  if (!value || typeof value !== 'string') return null;

  // PERFORMANCE: Early exit for short values
  if (value.length < 20) return null;

  for (const p of TOKEN_PATTERNS) {
    if (p.re.test(value)) {
      return { pattern: p.name, severity: p.severity };
    }
  }
  return null;
}

/**
 * Check if key looks token-related
 */
function isTokenRelatedKey(key) {
  return key && TOKEN_KEY_RE.test(key);
}

/**
 * Scan string for multiple token patterns
 */
function scanForTokens(value) {
  if (!value) return [];
  const results = [];
  for (const p of TOKEN_PATTERNS) {
    if (p.re.test(value)) {
      results.push({ pattern: p.name, severity: p.severity });
    }
  }
  return results;
}
