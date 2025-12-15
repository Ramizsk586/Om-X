
// Layer 1-3: Renderer-side fast blocking
// This runs synchronously in the UI thread to provide immediate feedback.
// Deep inspection is handled by the Main Process Firewall (AI Layer).

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// Safe domains that should never be blocked by the renderer check
const ALLOWLIST_DOMAINS = [
  'wikipedia.org', 'github.com', 'stackoverflow.com', 'medium.com',
  'linkedin.com', 'gitlab.com', 'google.com', 'bing.com',
  'docs.google.com', 'dev.to', 'ncbi.nlm.nih.gov', 'khanacademy.org',
  'coursera.org', 'edx.org', 'duckduckgo.com', 'who.int', 'mayoclinic.org'
];

const BLOCKED_DOMAINS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'onlyfans.com',
  'thepiratebay.org', '1337x.to', 'chaturbate.com', 'livejasmin.com'
];

// Only block purely explicit terms here.
// Neutral terms like 'sex' or 'anatomy' are deferred to the Main Process AI.
const EXPLICIT_KEYWORDS = [
  'porn', 'xxx', 'hentai', 'henti', 'nsfw', 'milf', 
  'gangbang', 'threesome', 'x-rated', 'blowjob'
];

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    u.searchParams.sort();
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch (e) {
    return url;
  }
}

function isDomainMatch(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function containsWholeWord(text, word) {
  const pattern = new RegExp(`\\b${word}\\b`, 'i');
  return pattern.test(text);
}

/**
 * Synchronous check for immediate decisions.
 * Returns: { status: 'SAFE' | 'BLOCKED', reason: string, type: string }
 */
export function isBlocked(rawUrl) {
  // FAST PATH: Allow local files, data URIs, and internal pages immediately
  if (rawUrl.startsWith('file:') || rawUrl.startsWith('data:') || rawUrl.startsWith('about:') || rawUrl.startsWith('chrome:')) {
    return { status: 'SAFE' };
  }

  try {
    const urlObj = new URL(rawUrl);
    const hostname = urlObj.hostname.toLowerCase();
    
    // 1. Blocked Domains (Immediate Block)
    if (BLOCKED_DOMAINS.some(d => isDomainMatch(hostname, d))) {
      return { status: 'BLOCKED', reason: 'Explicit Domain Match', type: 'adult' };
    }

    // 2. Allowlist Bypass (Trust Education)
    if (ALLOWLIST_DOMAINS.some(d => isDomainMatch(hostname, d))) {
      return { status: 'SAFE' };
    }

    // 3. Keyword Analysis (Only Explicit)
    const textToCheck = (hostname + ' ' + urlObj.pathname + ' ' + urlObj.search).toLowerCase();
    
    const strongMatch = EXPLICIT_KEYWORDS.find(k => containsWholeWord(textToCheck, k));
    if (strongMatch) {
      return { status: 'BLOCKED', reason: 'Explicit Keyword Detected', type: 'adult', keyword: strongMatch };
    }

    // Neutral terms (sex, breast, etc.) fall through to SAFE here.
    // They will be caught by the Main Process WebFirewall which has AI context awareness.

    return { status: 'SAFE' };
  } catch(e) {
    return { status: 'SAFE' };
  }
}
