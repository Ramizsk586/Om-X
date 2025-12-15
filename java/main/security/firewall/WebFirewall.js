
const path = require('path');
const { MALWARE_DOMAINS } = require('../blocklists/malwareDomains');
const { PORN_DOMAINS } = require('../../blocker/pornDomains');
const { AD_RULES } = require('../../blocker/adblockRules');
const { EXPLICIT_KEYWORDS, NEUTRAL_KEYWORDS, SEARCH_INTENT_BLOCK } = require('../../blocker/keywordRules');
const { EDUCATION_ALLOWLIST } = require('../blocklists/educationAllowlist');
const { GoogleGenAI } = require('@google/genai');

class WebFirewall {
  constructor(settings) {
    this.updateSettings(settings);
    this.requestLog = new Map();
    this.aiDecisionCache = new Map();
  }

  updateSettings(settings) {
    // Prefer specific Safe Search Key if available, otherwise use Global Provider Key
    let aiKey = settings?.features?.safeSearchKey;
    if (!aiKey) {
        aiKey = settings?.providers?.google?.key || process.env.API_KEY;
    }

    this.config = {
      enabled: settings?.features?.enableFirewall ?? true,
      safeSearch: settings?.features?.enableSafeSearch ?? true,
      adBlock: settings?.features?.enableAdBlocker ?? true,
      aiKey: aiKey,
      strictMode: settings?.features?.strictSecurity ?? false
    };
  }

  async analyzeRequest(details) {
    if (!this.config.enabled) return { action: 'allow' };

    const { url, resourceType } = details;
    const isMainFrame = resourceType === 'main_frame';
    
    // Parse URL safely
    let urlObj;
    try {
        urlObj = new URL(url);
    } catch(e) {
        return { action: 'allow' }; // Fail open on bad URLs to avoid breakage
    }

    const hostname = urlObj.hostname.toLowerCase();
    const fullText = (hostname + urlObj.pathname + urlObj.search).toLowerCase();

    // --- LAYER 1: Sanitization (Critical Security) ---
    // Always block credentials in URL regardless of context
    if (urlObj.username || urlObj.password) {
      if (isMainFrame) return { action: 'block', type: 'phishing' };
      return { action: 'cancel' };
    }

    // --- LAYER 2: AdBlocking (Performance) ---
    if (this.config.adBlock && this.checkAdBlock(url)) {
      return { action: 'cancel' };
    }

    // --- LAYER 3: AI Priority Verification (Safe Search) ---
    // If Safe Search is enabled and we have an API Key, use AI as PRIMARY arbiter for navigation.
    let aiPassed = false;
    
    if (isMainFrame && this.config.safeSearch && this.config.aiKey) {
        try {
            // Check if explicitly trusted education site (Fast Bypass to save AI tokens)
            const isTrustedEdu = EDUCATION_ALLOWLIST.some(d => 
                hostname === d || hostname.endsWith('.' + d) || (d === '.edu' && hostname.endsWith('.edu'))
            );

            if (!isTrustedEdu) {
                const aiDecision = await this.checkWithAI(url);
                
                if (aiDecision === false) {
                    // AI explicitly said BLOCK
                    return { action: 'block', type: 'adult' };
                } else if (aiDecision === true) {
                    // AI explicitly said SAFE
                    aiPassed = true;
                }
                // If AI returns null/undefined (error), we fall through to hardcoded rules
            } else {
                aiPassed = true; // Education sites are implicitly safe unless hard rules say otherwise
            }
        } catch (e) {
            console.warn("WebFirewall AI Error:", e);
            // Fallthrough to hardcoded rules
        }
    }

    // --- LAYER 4: Hardcoded Fallback Rules ---
    // Only apply if AI didn't explicitly pass it, OR if we want defense-in-depth for malware
    
    // 4a. Malware/Phishing (Always active regardless of AI Safe Search)
    if (MALWARE_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
      if (isMainFrame) return { action: 'block', type: 'malware' };
      return { action: 'cancel' };
    }

    // 4b. Explicit Content (Fallback if AI failed or didn't run)
    if (this.config.safeSearch && !aiPassed) {
        // Domain Blacklist
        if (PORN_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
            if (isMainFrame) return { action: 'block', type: 'adult' };
            return { action: 'cancel' };
        }

        // Explicit Keywords
        const hasExplicit = EXPLICIT_KEYWORDS.some(k => this.containsWholeWord(fullText, k));
        if (hasExplicit) {
            if (isMainFrame) return { action: 'block', type: 'adult' };
            return { action: 'cancel' };
        }

        // Search Intent
        const hasBadSearchIntent = SEARCH_INTENT_BLOCK.some(phrase => fullText.includes(phrase));
        if (hasBadSearchIntent) {
             if (isMainFrame) return { action: 'block', type: 'adult' };
             return { action: 'cancel' };
        }
        
        // Note: Neutral keywords are ignored here if AI failed, 
        // to avoid false positives (e.g. "breast cancer") when AI isn't available.
    }

    // --- Safe Search Enforcer (Query Param) ---
    if (this.config.safeSearch) {
       const safeUrl = this.enforceSafeSearch(urlObj);
       if (safeUrl) return { action: 'redirect', url: safeUrl };
    }

    return { action: 'allow' };
  }

  analyzeHeaders(details) {
      if (!this.config.enabled) return { cancel: false };
      return { responseHeaders: details.responseHeaders };
  }

  checkAdBlock(url) {
      const cleanUrl = url.replace(/(^\w+:|^)\/\//, '');
      return AD_RULES.some(rule => {
          const domainPart = rule.replace('*://*.', '').replace('/*', '');
          return cleanUrl.includes(domainPart);
      });
  }

  containsWholeWord(text, word) {
      // Simple boundary check
      return new RegExp(`\\b${word}\\b`, 'i').test(text);
  }

  enforceSafeSearch(urlObj) {
      const hostname = urlObj.hostname;
      if (hostname.includes('google.') && urlObj.pathname.startsWith('/search')) {
         if (!urlObj.searchParams.has('safe') || urlObj.searchParams.get('safe') !== 'active') {
             urlObj.searchParams.set('safe', 'active');
             return urlObj.toString();
         }
      }
      if (hostname.includes('bing.com')) {
         if (!urlObj.searchParams.has('adlt') || urlObj.searchParams.get('adlt') !== 'strict') {
             urlObj.searchParams.set('adlt', 'strict');
             return urlObj.toString();
         }
      }
      if (hostname.includes('duckduckgo.com')) {
         if (!urlObj.searchParams.has('kp') || urlObj.searchParams.get('kp') !== '1') {
             urlObj.searchParams.set('kp', '1'); // Strict
             return urlObj.toString();
         }
      }
      return null;
  }

  async checkWithAI(url) {
      // 1. Check Cache
      if (this.aiDecisionCache.has(url)) return this.aiDecisionCache.get(url);
      
      // 2. Allow Localhost/Files
      if (url.startsWith('file:') || url.includes('localhost')) return true;

      try {
          const ai = new GoogleGenAI({ apiKey: this.config.aiKey });
          
          // STRICT System Prompt for Intent Analysis
          const prompt = `
            SYSTEM: You are a strict Content Safety Classifier for a browser.
            TASK: Analyze the INTENT of the URL and Query.
            Distinguish between PORNOGRAPHY (Block) and EDUCATION/HEALTH/NEWS (Safe).

            INPUT URL: "${url}"

            RULES:
            1. Pornography, explicit sexual acts, arousal content -> BLOCK
            2. Sex education, biology, medical info, news, art -> SAFE
            3. Ambiguous but not explicit -> SAFE

            EXAMPLES:
            - "sex education for teens" -> SAFE
            - "how to use a condom" -> SAFE
            - "breast cancer symptoms" -> SAFE
            - "free sex videos" -> BLOCK
            - "xxx porn hub" -> BLOCK
            - "human anatomy vagina" -> SAFE

            OUTPUT:
            Reply with exactly one word: SAFE or BLOCK.
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: { thinkingConfig: { thinkingBudget: 0 } } // Low latency
          });
          
          const text = response.text.trim().toUpperCase();
          const isSafe = text.includes('SAFE');
          
          // Cache the decision
          this.aiDecisionCache.set(url, isSafe);
          
          // Limit cache size
          if (this.aiDecisionCache.size > 1000) {
              const firstKey = this.aiDecisionCache.keys().next().value;
              this.aiDecisionCache.delete(firstKey);
          }

          return isSafe;
      } catch(e) {
          console.error("AI Check Failed:", e);
          // Return null to indicate failure (trigger fallback)
          return null; 
      }
  }
}

module.exports = WebFirewall;
