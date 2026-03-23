/**
 * SessionGuard — Domain Manager
 * 
 * Manages the whitelist of protected domains.
 * Provides functions to add, remove, and check domains.
 */

// Default protected domains
const DEFAULT_DOMAINS = [
  'discord.com',
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'github.com',
  'linkedin.com',
  'reddit.com',
  'google.com',
  'netflix.com',
  'amazon.com',
  'twitch.tv',
  'tiktok.com',
  'spotify.com',
  'apple.com',
  'microsoft.com',
  'slack.com',
  'zoom.us',
  'zoom.com',
  'dropbox.com',
  'outlook.com',
  'live.com'
];

/**
 * Initialize domain list if not exists
 */
async function initDomainList() {
  const { protectedDomains } = await chrome.storage.sync.get(['protectedDomains']);
  if (!protectedDomains) {
    await chrome.storage.sync.set({ protectedDomains: DEFAULT_DOMAINS });
    return DEFAULT_DOMAINS;
  }
  return protectedDomains;
}

/**
 * Get all protected domains
 */
async function getProtectedDomains() {
  const { protectedDomains = [] } = await chrome.storage.sync.get(['protectedDomains']);
  return protectedDomains;
}

/**
 * Add a domain to the protected list
 */
async function addProtectedDomain(domain) {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  const { protectedDomains = [] } = await chrome.storage.sync.get(['protectedDomains']);
  if (!protectedDomains.includes(clean)) {
    protectedDomains.push(clean);
    await chrome.storage.sync.set({ protectedDomains });
  }
  return protectedDomains;
}

/**
 * Remove a domain from the protected list
 */
async function removeProtectedDomain(domain) {
  const clean = domain.toLowerCase();
  const { protectedDomains = [] } = await chrome.storage.sync.get(['protectedDomains']);
  const filtered = protectedDomains.filter(d => d !== clean);
  await chrome.storage.sync.set({ protectedDomains: filtered });
  return filtered;
}

/**
 * Check if a domain is protected
 */
async function checkDomainProtected(domain) {
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const protectedDomains = await getProtectedDomains();
  return protectedDomains.some(pd => {
    const cleanPd = pd.replace(/^www\./, '').toLowerCase();
    return cleanDomain === cleanPd || cleanDomain.endsWith('.' + cleanPd);
  });
}
