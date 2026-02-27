
/**
 * Strict check if a string is a valid absolute URL.
 * @param {string} string 
 * @returns {boolean}
 */
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Heuristic to determine if input is intended as a URL or a Search Query.
 * @param {string} input 
 * @returns {boolean} True if likely a URL, False if likely a search query.
 */
export function isLikelyUrl(input) {
  if (!input) return false;
  
  // 1. Check for standard protocols
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(input)) return true;
  
  // 2. Check for Localhost / IP
  if (input.startsWith('localhost') || 
      input.startsWith('127.0.0.1') || 
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(input)) {
      return true;
  }

  // 3. Check for valid domain structure (e.g. example.com)
  // Must have a dot, no spaces, and end with a TLD-like structure (2+ letters)
  const domainRegex = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[a-zA-Z]{2,}$/;
  if (domainRegex.test(input) && !input.includes(' ')) {
      return true;
  }

  // 4. File paths (Unix/Windows)
  if (input.startsWith('/') || /^[a-zA-Z]:\\/.test(input)) {
      return true;
  }

  return false;
}

/**
 * Normalizes input into a navigable URL.
 * Adds 'https://' if missing.
 * @param {string} input 
 * @returns {string}
 */
export function normalizeInput(input) {
  input = input.trim();
  
  // If it's already a valid URL with protocol, return it.
  if (/^[a-zA-Z]+:\/\//.test(input)) {
      return input;
  }

  // Handle localhost specific case
  if (input.startsWith('localhost') || input.startsWith('127.0.0.1')) {
      return `http://${input}`;
  }

  // Default to HTTPS
  return `https://${input}`;
}

/**
 * Composes a search URL from a query and a template.
 * @param {string} query 
 * @param {string} template URL with %s placeholder
 * @returns {string}
 */
export function composeSearchUrl(query, template) {
  if (!template) template = 'https://www.google.com/search?q=%s';
  return template.replace('%s', encodeURIComponent(query));
}

/**
 * Extracts a clean domain name for display.
 * @param {string} url 
 * @returns {string}
 */
export function getDomainName(url) {
  try {
    const u = new URL(url);
    // Handle internal pages
    if (u.protocol === 'file:') return 'Local File';
    if (u.protocol === 'about:') return 'System';
    return u.hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}
