
// Layer 2 & 3: Keyword Rules
// Used for URL analysis and Search Query Intent detection.

// 1. EXPLICIT INTENT - Always Block
// These words have almost no educational context in a standard URL/Search string without qualification.
const EXPLICIT_KEYWORDS = [
  "porn", "prn", "xxx", "x-rated", "hentai", "henti", "nsfw",
  "milf", "fuck", "dick", "cock", "pussy", "blowjob", "anal",
  "cum", "orgasm", "gangbang", "threesome", "bdsm", "fetish",
  "incest", "rape", "escort", "camgirl", "livesex", "hardcore"
];

// 2. NEUTRAL / ANATOMICAL - Requires AI Context
// These words appear in both porn AND education/health.
// DO NOT BLOCK ON THESE ALONE. Trigger AI Intent Analysis.
const NEUTRAL_KEYWORDS = [
  "sex", "penis", "vagina", "intercourse", "breast", "boobs", "tits",
  "reproductive", "genital", "sexual", "puberty", "nude", "naked",
  "sperm", "pregnancy", "condom", "std", "sti", "erotic",
  "contraception", "libido", "erection", "masturbation"
];

// 3. SEARCH INTENT SPECIFIC
// Phrases that indicate clear pornographic intent in search queries.
const SEARCH_INTENT_BLOCK = [
  "video xxx", "free porn", "sex video", "nude pics",
  "onlyfans leak", "sex tape", "adult movie", "hot sex",
  "sex scene", "nude scene", "viral sex"
];

module.exports = { EXPLICIT_KEYWORDS, NEUTRAL_KEYWORDS, SEARCH_INTENT_BLOCK };
