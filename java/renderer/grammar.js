const toRegExpSafe = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const preserveCase = (source, replacement) => {
  if (!source || !replacement) return replacement;
  if (source.toUpperCase() === source) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
};

export class OfflineGrammarEngine {
  constructor() {
    this.loaded = false;
    this.data = null;
  }

  async load() {
    if (this.loaded) return this.data;
    const base = new URL('../data/grammar/', import.meta.url);
    const readJson = async (name) => {
      const res = await fetch(new URL(name, base));
      if (!res.ok) throw new Error(`Failed to load ${name}`);
      return res.json();
    };

    const [
      spellingCommon,
      spellingConfusions,
      spellingDictionary,
      grammarArticles,
      grammarPatterns,
      grammarStyle
    ] = await Promise.all([
      readJson('spelling_common.json'),
      readJson('spelling_confusions.json'),
      readJson('spelling_dictionary.json'),
      readJson('grammar_articles.json'),
      readJson('grammar_patterns.json'),
      readJson('grammar_style.json')
    ]);

    this.data = {
      spellingCommon,
      spellingConfusions,
      spellingDictionary,
      grammarArticles,
      grammarPatterns,
      grammarStyle
    };
    this.loaded = true;
    return this.data;
  }

  async analyze(text, mode = 'both') {
    const source = String(text || '');
    const data = await this.load();
    let working = source;
    const issues = [];

    if (mode === 'both' || mode === 'spelling') {
      working = this.applySpellingChecks(working, issues, data);
    }
    if (mode === 'both' || mode === 'grammar') {
      working = this.applyGrammarChecks(working, issues, data);
    }

    return {
      original: source,
      corrected: working,
      issues
    };
  }

  applySpellingChecks(text, issues, data) {
    let out = text;
    const common = data.spellingCommon || {};

    Object.entries(common).forEach(([wrong, right]) => {
      const re = new RegExp(`\\b${toRegExpSafe(wrong)}\\b`, 'gi');
      out = out.replace(re, (m) => {
        const replacement = preserveCase(m, right);
        issues.push({ type: 'spelling', message: `"${m}" -> "${replacement}"` });
        return replacement;
      });
    });

    const confusions = data.spellingConfusions || {};
    Object.entries(confusions).forEach(([token, tip]) => {
      const re = new RegExp(`\\b${toRegExpSafe(token)}\\b`, 'gi');
      if (re.test(out)) {
        issues.push({ type: 'spelling-hint', message: `Check "${token}": ${tip}` });
      }
    });

    return out;
  }

  applyGrammarChecks(text, issues, data) {
    let out = text;
    const patterns = data.grammarPatterns || {};
    const style = data.grammarStyle || {};
    const articles = data.grammarArticles || {};

    const replacePhrase = (from, to, type = 'grammar') => {
      const re = new RegExp(`\\b${toRegExpSafe(from)}\\b`, 'gi');
      out = out.replace(re, (m) => {
        const replacement = preserveCase(m, to);
        issues.push({ type, message: `"${m}" -> "${replacement}"` });
        return replacement;
      });
    };

    (patterns.replacementPatterns || []).forEach((p) => replacePhrase(p.from, p.to));
    (patterns.subjectVerbPatterns || []).forEach((p) => replacePhrase(p.from, p.to, 'grammar-agreement'));

    if (style.repeatedWord) {
      out = out.replace(/\b([A-Za-z]+)\s+\1\b/gi, (m, w) => {
        issues.push({ type: 'grammar-style', message: `Repeated word "${w}"` });
        return w;
      });
    }

    if (style.doubleSpace) {
      out = out.replace(/ {2,}/g, (m) => {
        issues.push({ type: 'grammar-style', message: 'Extra spaces reduced to one space' });
        return ' ';
      });
    }

    if (style.capitalizePronounI) {
      out = out.replace(/\bi\b/g, () => {
        issues.push({ type: 'grammar-style', message: 'Capitalized pronoun "I"' });
        return 'I';
      });
    }

    if (style.capitalizeSentenceStart) {
      out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1, p2) => {
        issues.push({ type: 'grammar-style', message: 'Capitalized sentence start' });
        return `${p1}${p2.toUpperCase()}`;
      });
    }

    const exceptionAn = new Set((articles.exceptionsAn || []).map((v) => String(v).toLowerCase()));
    const exceptionA = new Set((articles.exceptionsA || []).map((v) => String(v).toLowerCase()));
    out = out.replace(/\b(a|an)\s+([A-Za-z][A-Za-z'-]*)/g, (m, art, word) => {
      const lowerWord = word.toLowerCase();
      const startsWithVowel = /^[aeiou]/i.test(lowerWord);
      let shouldBeAn = startsWithVowel;
      if (exceptionAn.has(lowerWord)) shouldBeAn = true;
      if (exceptionA.has(lowerWord)) shouldBeAn = false;
      const expected = shouldBeAn ? 'an' : 'a';
      if (art.toLowerCase() === expected) return m;
      const replacement = `${preserveCase(art, expected)} ${word}`;
      issues.push({ type: 'grammar-article', message: `"${art} ${word}" -> "${replacement}"` });
      return replacement;
    });

    return out;
  }
}
