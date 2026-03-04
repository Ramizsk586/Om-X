const normalizeKey = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isWordToken = (token = '') => /[A-Za-z]/.test(token);
const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cleanBengaliValue = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const first = raw.split(/[;,]/).map((v) => v.trim()).find(Boolean) || raw;
  return first
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export class OfflineBengaliTranslator {
  constructor() {
    this.loaded = false;
    this.map = new Map();
    this.phraseEntries = [];
    this.maxPhraseWords = 1;
    this.phraseOverrides = new Map([
      ['also known as', 'নামেও পরিচিত'],
      ['flowering plants', 'সপুষ্পক উদ্ভিদ'],
      ['flowering plant', 'সপুষ্পক উদ্ভিদ'],
      ['reproductive structures', 'প্রজনন কাঠামো'],
      ['reproductive structure', 'প্রজনন কাঠামো'],
      ['reproductive structures of flowering plants', 'সপুষ্পক উদ্ভিদের প্রজনন কাঠামো'],
      ['reproductive structure of flowering plant', 'সপুষ্পক উদ্ভিদের প্রজনন কাঠামো'],
      ['are the', 'হলো'],
      ['is the', 'হলো']
    ]);
  }

  async load() {
    if (this.loaded) return this.map;
    const base = new URL('../data/BengaliDictionary/', import.meta.url);
    const [missingRes, mainRes] = await Promise.all([
      fetch(new URL('BengaliDictionary_missing.json', base)).catch(() => null),
      fetch(new URL('BengaliDictionary.json', base))
    ]);
    if (!mainRes.ok) throw new Error('Failed to load BengaliDictionary.json');
    const rows = await mainRes.json();

    if (missingRes && missingRes.ok) {
      const extra = await missingRes.json();
      Object.entries(extra || {}).forEach(([en, bn]) => {
        const key = normalizeKey(en);
        const val = cleanBengaliValue(bn);
        if (!key || !val) return;
        this.map.set(key, val);
      });
    }

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const en = normalizeKey(row?.en || '');
      const bn = cleanBengaliValue(row?.bn || '');
      if (!en || !bn) return;
      if (!this.map.has(en)) this.map.set(en, bn);
    });

    this.phraseOverrides.forEach((bn, en) => {
      const key = normalizeKey(en);
      const val = cleanBengaliValue(bn);
      if (key && val) this.map.set(key, val);
    });

    this.phraseEntries = Array.from(this.map.entries())
      .filter(([en]) => en.includes(' '))
      .map(([en, bn]) => ({ en, bn, words: en.split(/\s+/).length }))
      .sort((a, b) => b.words - a.words);
    this.maxPhraseWords = this.phraseEntries.length ? this.phraseEntries[0].words : 1;

    this.loaded = true;
    return this.map;
  }

  lookupWord(word) {
    const key = normalizeKey(word);
    if (!key) return null;
    if (this.map.has(key)) return this.map.get(key);
    if (key.endsWith('s') && this.map.has(key.slice(0, -1))) return this.map.get(key.slice(0, -1));
    if (key.endsWith('es') && this.map.has(key.slice(0, -2))) return this.map.get(key.slice(0, -2));
    if (key.endsWith('ed') && this.map.has(key.slice(0, -2))) return this.map.get(key.slice(0, -2));
    if (key.endsWith('ing') && this.map.has(key.slice(0, -3))) return this.map.get(key.slice(0, -3));
    return null;
  }

  applySentencePolish(text) {
    let out = String(text || '');
    out = out
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([(\[{])\s+/g, '$1')
      .replace(/\s+([)\]}])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Remove duplicate word joins produced by synonym collisions.
    out = out
      .replace(/\b([^\s,.;:!?]+)\s+(ও|এবং)\s+\1\b/g, '$1')
      .replace(/\b([^\s,.;:!?]+),\s*\1\b/g, '$1');

    // Light fluency fixes for common literal patterns.
    out = out
      .replace(/এছাড়াও পরিচিত হিসেবে/gi, 'নামেও পরিচিত')
      .replace(/পরিচিত হিসেবে/gi, 'নামে পরিচিত')
      .replace(/হয় যে/gi, 'হলো');

    return out;
  }

  applyPhraseMarkers(source) {
    let working = String(source || '');
    const phraseValues = [];

    this.phraseEntries.forEach((entry) => {
      const re = new RegExp(`\\b${escapeRegExp(entry.en).replace(/\s+/g, '\\s+')}\\b`, 'gi');
      working = working.replace(re, () => {
        const marker = `@@PHRASE_${phraseValues.length}@@`;
        phraseValues.push(entry.bn);
        return marker;
      });
    });

    return { working, phraseValues };
  }

  async translate(text) {
    const source = String(text || '');
    await this.load();
    const { working, phraseValues } = this.applyPhraseMarkers(source);
    const tokens = working.split(/(@@PHRASE_\d+@@|[A-Za-z]+(?:['-][A-Za-z]+)*|[^A-Za-z@]+)/g).filter((t) => t !== '');

    let translatedCount = 0;
    let unknownCount = 0;
    const out = tokens.map((token) => {
      const markerMatch = token.match(/^@@PHRASE_(\d+)@@$/);
      if (markerMatch) {
        const idx = Number(markerMatch[1]);
        if (Number.isFinite(idx) && phraseValues[idx]) {
          translatedCount += 1;
          return phraseValues[idx];
        }
        return token;
      }
      if (!isWordToken(token)) return token;
      const found = this.lookupWord(token);
      if (found) {
        translatedCount += 1;
        return found;
      }
      unknownCount += 1;
      return token;
    });

    return {
      original: source,
      translated: this.applySentencePolish(out.join('')),
      translatedCount,
      unknownCount
    };
  }
}
