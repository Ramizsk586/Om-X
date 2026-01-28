
import { RESPONSE_DB, KEYWORD_MAP } from '../data/responseDatabase.js';

export class QuickBot {
  
  /**
   * Normalizes text for lookup.
   * @param {string} text 
   */
  static normalize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/gi, '') // Remove punctuation
      .trim()
      .replace(/\s+/g, ' '); // Collapse multiple spaces
  }

  /**
   * Attempts to find a local response.
   * @param {string} input 
   * @returns {string|null} The response text or null if no match.
   */
  static findMatch(input) {
    const cleanInput = this.normalize(input);

    // 1. Exact Match (O(1))
    if (RESPONSE_DB[cleanInput]) {
      return this.getRandom(RESPONSE_DB[cleanInput]);
    }

    // 2. Keyword Mapping (O(1))
    // Check if the input *contains* specific phrases mapped to keys
    for (const [keyword, targetKey] of Object.entries(KEYWORD_MAP)) {
      if (cleanInput.includes(keyword)) {
        if (RESPONSE_DB[targetKey]) {
          return this.getRandom(RESPONSE_DB[targetKey]);
        }
      }
    }

    // 3. "Starts With" Heuristics (O(N)) - Keep this list short
    const startsWithChecks = [
      "hi", "hello", "hey", "thanks", "thank you"
    ];
    
    for (const start of startsWithChecks) {
      if (cleanInput.startsWith(start + " ")) {
        // e.g. "Hi Omni" -> matches "hi"
        return this.getRandom(RESPONSE_DB[start]);
      }
    }

    return null;
  }

  static getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
