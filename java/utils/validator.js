
export const Validator = {
  /**
   * Validates API Keys based on provider patterns.
   * @param {string} key 
   * @param {string} provider 'google' | 'openrouter' | 'groq'
   * @returns {boolean}
   */
  isValidApiKey: (key, provider) => {
    if (!key || typeof key !== 'string') return false;
    const k = key.trim();
    if (k.length < 10) return false;

    switch (provider) {
      case 'google':
        // usually starts with AIza...
        return k.startsWith('AI');
      case 'openrouter':
        return k.startsWith('sk-or-');
      case 'groq':
        return k.startsWith('gsk_');
      case 'openai':
        return k.startsWith('sk-');
      default:
        // Basic length check for unknown providers
        return k.length > 20;
    }
  },

  /**
   * Checks if a filename is valid for the OS (basic check).
   * @param {string} filename 
   * @returns {boolean}
   */
  isValidFilename: (filename) => {
    if (!filename || filename.length > 255) return false;
    // Reserved characters in Windows/Unix
    // < > : " / \ | ? *
    const illegal = /[<>:"/\\|?*\x00-\x1F]/g;
    return !illegal.test(filename) && filename.trim() !== '' && !/^\s+$/.test(filename);
  },

  /**
   * Basic HTML sanitization to prevent XSS in UI rendering.
   * @param {string} str 
   * @returns {string}
   */
  escapeHtml: (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Validates if a string is a safe color hex code.
   * @param {string} hex 
   * @returns {boolean}
   */
  isValidHexColor: (hex) => {
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
  }
};
