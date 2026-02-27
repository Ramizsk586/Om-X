import { RESPONSE_DB, KEYWORD_MAP } from '../data/responseDatabase.js';

export class QuickBot {
  static _prepared = false;
  static _entries = [];
  static _keywordEntries = [];
  static _greetingStarts = ['hi', 'hello', 'hey', 'thanks', 'thank you'];
  static _hinglishHints = new Set([
    'kya', 'kaise', 'kyu', 'kyon', 'mujhe', 'batao', 'samjhao', 'acha', 'accha',
    'sahi', 'galat', 'nahi', 'hain', 'hai', 'kar', 'karo', 'ka', 'ki', 'ke', 'aur'
  ]);
  // NEW: Stopwords to improve keyword matching accuracy
  static _stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 
    'with', 'about', 'of', 'this', 'that', 'it', 'can', 'you', 'i', 'my'
  ]);
  
  static normalize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  static tokenize(text, removeStopWords = true) {
    const tokens = this.normalize(text).split(' ').filter(Boolean);
    if (!removeStopWords) return tokens;
    return tokens.filter(t => !this._stopWords.has(t));
  }

  static prepare() {
    if (this._prepared) return;
    this._entries = Object.keys(RESPONSE_DB).map((key) => ({
      key,
      normalized: this.normalize(key),
      tokens: this.tokenize(key, true)
    }));
    this._keywordEntries = Object.entries(KEYWORD_MAP).map(([keyword, targetKey]) => ({
      keyword: this.normalize(keyword),
      targetKey,
      keywordTokens: this.tokenize(keyword, true)
    }));
    this._prepared = true;
  }

  static tokenOverlap(aTokens, bTokens) {
    if (!aTokens.length || !bTokens.length) return 0;
    const bSet = new Set(bTokens);
    let shared = 0;
    for (const t of aTokens) if (bSet.has(t)) shared++;
    return shared / Math.max(aTokens.length, bTokens.length);
  }

  static withinEditDistanceOne(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; } 
      else {
        edits++;
        if (edits > 1) return false;
        if (la > lb) i++;
        else if (lb > la) j++;
        else { i++; j++; }
      }
    }
    if (i < la || j < lb) edits++;
    return edits <= 1;
  }

  static fuzzyTokenScore(inputTokens, candidateTokens) {
    if (!inputTokens.length || !candidateTokens.length) return 0;
    let matches = 0;
    for (const t of inputTokens) {
      if (candidateTokens.includes(t)) {
        matches++;
        continue;
      }
      if (t.length >= 4 && candidateTokens.some((ct) => this.withinEditDistanceOne(t, ct))) {
        matches += 0.8; // Increased weight for close typos
      }
    }
    return matches / Math.max(inputTokens.length, candidateTokens.length);
  }

  static isHinglish(input, inputTokens) {
    if (!input) return false;
    const normalized = this.normalize(input);
    if (inputTokens.some((t) => this._hinglishHints.has(t))) return true;
    if (/\b(pls|kr|frnd|btw|bro)\b/.test(normalized)) return true;
    return false;
  }

  // UPGRADED: Protects code blocks and specific markdown from being butchered
  static splitSentences(text) {
    const textStr = String(text || '');
    // If it contains a code block, treat the whole block as a single "sentence" conceptually, or just bypass splitting
    if (textStr.includes('```')) {
      return textStr.split(/(?=```)/).map(s => s.trim()).filter(Boolean);
    }
    return textStr
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // UPGRADED: Smarter point extraction that respects existing lists
  static extractKeyPoints(text, maxPoints = 4) {
    const rawLines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
    
    // Check if there are already explicit markdown lists
    const existingList = rawLines.filter(l => l.startsWith('- ') || l.startsWith('* ') || /^\d+\./.test(l));
    if (existingList.length >= 2) {
        return existingList.slice(0, maxPoints).map(l => l.replace(/^[\s\-*•\d.]+/, '').trim());
    }

    const source = this.splitSentences(text);
    const points = [];
    const seen = new Set();
    
    for (const item of source) {
      // Don't extract code blocks as bullet points
      if (item.startsWith('```')) continue; 
      
      const cleaned = item.replace(/^[\s\-*•\d.]+/, '').replace(/\s+/g, ' ').trim();
      if (cleaned.length < 20) continue; // Ignore very short sentences
      
      const key = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!key || seen.has(key)) continue;
      
      seen.add(key);
      points.push(cleaned);
      if (points.length >= maxPoints) break;
    }
    return points;
  }

  // UPGRADED: Advanced Answer Composition with dynamic intent
  static composeAnswer(input, matchedKey, baseResponse, confidence = 0.7) {
    const raw = String(baseResponse || '').trim();
    if (!raw) return null;
    
    const inputTokens = this.tokenize(input, false);
    const hinglish = this.isHinglish(input, inputTokens);

    // Keep short direct responses direct (greetings, simple yes/no).
    if (raw.length <= 160 && !raw.includes('\n')) return raw;

    const sentences = this.splitSentences(raw);
    const hasCodeBlock = raw.includes('```');
    
    // Smart Summarization
    let summary = '';
    if (hasCodeBlock) {
        summary = sentences[0].startsWith('```') ? "Here is the code you requested:" : sentences[0];
    } else {
        summary = sentences[0] || raw.slice(0, 180);
    }

    const points = this.extractKeyPoints(raw, 4);
    const confTag = confidence >= 0.85 ? 'High' : confidence >= 0.7 ? 'Medium' : 'Low';

    // Intent detection for dynamic formatting
    const isHowTo = inputTokens.includes('how') || inputTokens.includes('kaise') || inputTokens.includes('setup');
    const isError = inputTokens.includes('error') || inputTokens.includes('bug') || inputTokens.includes('issue');

    let sectionTitle = isHowTo ? 'Step-by-Step Guide' : isError ? 'Troubleshooting Steps' : 'Key Details';
    let nextHint = '';

    if (hinglish) {
      nextHint = isHowTo ? 'Agar detail mein steps chahiye to batana.' : 
                 isError ? 'Agar abhi bhi error aa raha hai, to logs share karo.' : 
                 'Agar isko aur detail me break karna hai, to batao.';
      
      return [
        `**Quick Summary** ⚡`,
        `${summary}`,
        ``,
        points.length ? `**${sectionTitle}**\n- ${points.join('\n- ')}` : '',
        hasCodeBlock && !summary.includes('```') ? `\n_Includes code snippet below._\n${raw.substring(raw.indexOf('```'))}` : '',
        ``,
        `---`,
        `💡 *${nextHint}* (Match: ${confTag})`
      ].filter(Boolean).join('\n');
    }

    nextHint = isHowTo ? 'If you need me to expand on any specific step, just ask.' : 
               isError ? 'If the issue persists, feel free to paste the exact error log.' : 
               'If you want, I can expand this into a deeper breakdown.';

    return [
      `**Quick Summary** ⚡`,
      `${summary}`,
      ``,
      points.length && !hasCodeBlock ? `**${sectionTitle}**\n- ${points.join('\n- ')}` : '',
      hasCodeBlock && !summary.includes('```') ? `\n${raw.substring(raw.indexOf('```'))}` : '',
      ``,
      `---`,
      `💡 *${nextHint}* (Match: ${confTag})`
    ].filter(Boolean).join('\n');
  }

  static findMatch(input) {
    this.prepare();
    const cleanInput = this.normalize(input);
    const inputTokens = this.tokenize(input, true); // Use stopword-filtered tokens
    if (!cleanInput) return null;

    let selectedKey = null;
    let selectedScore = 0;

    // 1) Exact match
    if (RESPONSE_DB[cleanInput]) {
      selectedKey = cleanInput;
      selectedScore = 1.0;
      const response = this.getRandom(RESPONSE_DB[selectedKey]);
      return this.composeAnswer(input, selectedKey, response, selectedScore) || response;
    }

    // 2) Intent keyword map
    let bestKeyword = { score: 0, targetKey: null };
    for (const k of this._keywordEntries) {
      let score = 0;
      if (cleanInput === k.keyword) score = 1.0;
      else if (cleanInput.includes(k.keyword)) score = 0.90;
      else {
        const overlap = this.tokenOverlap(inputTokens, k.keywordTokens);
        const fuzzy = this.fuzzyTokenScore(inputTokens, k.keywordTokens);
        score = Math.max(overlap * 0.8, fuzzy * 0.75);
      }
      if (score > bestKeyword.score && RESPONSE_DB[k.targetKey]) {
        bestKeyword = { score, targetKey: k.targetKey };
      }
    }

    // 3) Greeting shortcut
    for (const start of this._greetingStarts) {
      if (cleanInput.startsWith(start + " ")) {
        const response = this.getRandom(RESPONSE_DB[start]);
        return response; // Greetings shouldn't use the complex formatted composer
      }
    }

    // 4) Global intent scoring
    let best = { score: 0, key: null };
    for (const entry of this._entries) {
      let score = 0;
      if (cleanInput === entry.normalized) {
        score = 1.0;
      } else if (cleanInput.includes(entry.normalized)) {
        score = 0.88;
      } else {
        const overlap = this.tokenOverlap(inputTokens, entry.tokens);
        const fuzzy = this.fuzzyTokenScore(inputTokens, entry.tokens);
        const lengthPenalty = entry.tokens.length > 0 && inputTokens.length > 0
          ? Math.min(entry.tokens.length, inputTokens.length) / Math.max(entry.tokens.length, inputTokens.length)
          : 0;
        score = (overlap * 0.65) + (fuzzy * 0.30) + (lengthPenalty * 0.05);
      }
      if (score > best.score) best = { score, key: entry.key };
    }

    // 5) Winner resolution
    if (bestKeyword.targetKey && bestKeyword.score >= 0.55 && bestKeyword.score >= (best.score + 0.05)) {
      selectedKey = bestKeyword.targetKey;
      selectedScore = bestKeyword.score;
    }
    if (!selectedKey && best.key && best.score >= 0.62 && RESPONSE_DB[best.key]) {
      selectedKey = best.key;
      selectedScore = best.score;
    }
    if (!selectedKey && bestKeyword.targetKey && bestKeyword.score >= 0.62) {
      selectedKey = bestKeyword.targetKey;
      selectedScore = bestKeyword.score;
    }

    if (selectedKey && RESPONSE_DB[selectedKey]) {
      const response = this.getRandom(RESPONSE_DB[selectedKey]);
      return this.composeAnswer(input, selectedKey, response, selectedScore) || response;
    }

    return null; // Handle fallback outside this class
  }

  static getRandom(arr) {
    if (!Array.isArray(arr)) return arr; 
    return arr[Math.floor(Math.random() * arr.length)];
  }
}