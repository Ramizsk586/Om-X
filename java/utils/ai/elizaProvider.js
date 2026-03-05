const Eliza = require('eliza');
const fs = require('fs');
const path = require('path');

// An Eliza provider for the Omni AI subsystem.  By default it uses the
// 1966 DOCTOR script built into the `eliza` npm package.  A few simple
// enhancements give it a more dynamic feel:
//  * randomness is enabled unless explicitly disabled via options
//  * memory size can be configured through aiConfig.elizaMemSize
//  * if the bot produces a very short/generic reply it will fall back
//    to the offline bot and append the supplemental text
//  * exported helper `listScripts` enumerates the raw script files
//    stored in `java/Eliza/scripts` (future work could allow dynamic
//    script switching)

// utility used by fallback logic to avoid expensive `require` cycles
let cachedAiProvider = null;
function getAiProvider() {
    if (!cachedAiProvider) {
        cachedAiProvider = require('./aiProvider');
    }
    return cachedAiProvider;
}

const ELIZA_SCRIPT_DIR = path.join(__dirname, '..', '..', 'Eliza', 'scripts');
const SCRIPT_CACHE_TTL_MS = 60 * 1000;
const MAX_SCRIPT_LINES = 1200;
const ELIZA_STOP_WORDS = new Set([
    'about', 'after', 'again', 'against', 'also', 'always', 'among', 'been', 'being', 'between',
    'both', 'cannot', 'could', 'does', 'doing', 'done', 'each', 'else', 'from', 'have', 'having',
    'into', 'just', 'like', 'make', 'many', 'more', 'most', 'much', 'only', 'other', 'over',
    'same', 'some', 'such', 'than', 'that', 'their', 'there', 'these', 'they', 'this', 'those',
    'through', 'under', 'very', 'what', 'when', 'where', 'which', 'while', 'with', 'would',
    'your', 'you', 'are', 'and', 'for', 'the', 'was', 'were', 'why', 'how'
]);
let cachedScriptCorpus = null;

function normalizeText(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractTokens(value = '') {
    const tokens = normalizeText(value).toLowerCase().match(/[a-z]{3,}/g) || [];
    return [...new Set(tokens.filter((token) => !ELIZA_STOP_WORDS.has(token)))];
}

function getLastUserText(contents = []) {
    for (let i = contents.length - 1; i >= 0; i -= 1) {
        const msg = contents[i];
        if (!msg || msg.role !== 'user') continue;
        if (Array.isArray(msg.parts)) {
            return normalizeText(msg.parts.map((p) => p?.text || '').join(' '));
        }
        return normalizeText(msg.text || '');
    }
    return '';
}

function getScriptMode(options = {}) {
    const configured = String(options.aiConfig?.elizaScriptMode || '').trim().toLowerCase();
    if (configured === 'all') return 'all';
    return 'doctor';
}

function isModeAllowedScript(fileName = '', mode = 'doctor') {
    if (mode === 'all') return true;
    return /doctor/i.test(fileName);
}

function loadScriptCorpus() {
    const now = Date.now();
    if (cachedScriptCorpus && cachedScriptCorpus.expiresAt > now) {
        return cachedScriptCorpus;
    }

    const files = [];
    const lines = [];

    try {
        for (const name of fs.readdirSync(ELIZA_SCRIPT_DIR)) {
            if (!name.endsWith('.txt')) continue;
            files.push(name);
            const fullPath = path.join(ELIZA_SCRIPT_DIR, name);
            const raw = fs.readFileSync(fullPath, 'utf8');
            const rawLines = raw.split(/\r?\n/);
            for (const rawLine of rawLines) {
                const trimmed = normalizeText(rawLine);
                if (!trimmed) continue;
                if (trimmed.startsWith(';')) continue;
                if (trimmed.startsWith('(') || trimmed.startsWith(')')) continue;
                if (trimmed.length < 24) continue;

                const cleaned = normalizeText(
                    trimmed
                        .replace(/^[^A-Za-z]+/, '')
                        .replace(/[^A-Za-z0-9.,!?'"`\-\s]/g, ' ')
                );
                if (cleaned.length < 24) continue;

                const lowered = cleaned.toLowerCase();
                lines.push({
                    file: name,
                    text: cleaned,
                    lower: lowered,
                    tokens: extractTokens(lowered)
                });
                if (lines.length >= MAX_SCRIPT_LINES) break;
            }
            if (lines.length >= MAX_SCRIPT_LINES) break;
        }
    } catch (_) {
        // best-effort corpus loading
    }

    cachedScriptCorpus = {
        expiresAt: now + SCRIPT_CACHE_TTL_MS,
        files,
        lines
    };
    return cachedScriptCorpus;
}

function scoreScriptLine(line = {}, queryTokens = []) {
    if (!line || !Array.isArray(queryTokens) || queryTokens.length === 0) return 0;
    let score = 0;
    const tokenSet = new Set(line.tokens || []);
    for (const token of queryTokens) {
        if (!tokenSet.has(token)) continue;
        score += token.length >= 7 ? 4 : 3;
    }
    return score;
}

function findScriptSupplement(userText = '', options = {}) {
    const query = normalizeText(userText);
    if (!query) return null;

    const queryTokens = extractTokens(query);
    if (queryTokens.length === 0) return null;

    const mode = getScriptMode(options);
    const preferredScript = String(options.aiConfig?.elizaScriptFile || '').trim().toLowerCase();
    const corpus = loadScriptCorpus();

    let candidates = (corpus.lines || []).filter((entry) => isModeAllowedScript(entry.file, mode));
    if (preferredScript) {
        const preferred = candidates.filter((entry) => entry.file.toLowerCase() === preferredScript);
        if (preferred.length > 0) candidates = preferred;
    }
    if (candidates.length === 0) return null;

    let bestLine = null;
    let bestScore = 0;
    for (const entry of candidates) {
        const score = scoreScriptLine(entry, queryTokens);
        if (score > bestScore) {
            bestScore = score;
            bestLine = entry;
        }
    }

    if (!bestLine || bestScore < 5) return null;
    return bestLine.text;
}


/**
 * Run an Eliza bot over the supplied contents array (the same format
 * used by `aiProvider.performTask`).  Only entries with
 * `role==='user'` are fed to the engine; previous model turns are
 * ignored.  The last user transform result is returned.
 */
function runEliza(contents = [], options = {}) {
    // allow caller to disable randomness or adjust memory size
    const noRandomFlag = Boolean(options.noRandom || options.aiConfig?.elizaNoRandom);
    const bot = new Eliza(noRandomFlag);
    if (options.aiConfig && Number.isFinite(options.aiConfig.elizaMemSize)) {
        bot.memSize = options.aiConfig.elizaMemSize;
    }

    let reply = '';
    for (const msg of contents) {
        if (!msg || msg.role !== 'user') continue;
        const text = Array.isArray(msg.parts)
            ? msg.parts.map((p) => p.text || '').join('').trim()
            : String(msg.text || '').trim();
        if (!text) continue;
        reply = bot.transform(text);
    }

    if (!reply) {
        return bot.getInitial();
    }
    return reply;
}

/**
 * `performTask` signature mirrors the other providers.  We ignore most
 * of the options, since Eliza is entirely self‑contained.
 */
async function performTask(input = {}, options = {}) {
    // `input` is expected to have a `contents` array; allow old callers to
    // pass the array directly.
    const contents = Array.isArray(input) ? input : input.contents || [];
    const lastUserText = getLastUserText(contents);

    const reply = runEliza(contents, options);

    // optional "boost" – if the response is very short or one of the
    // stock fallback phrases, ask the offline bot for a supplement and
    // append it.  This makes the history feel "smarter" without
    // discarding the original Eliza flavour.
    let finalText = reply;
    const genericTriggers = [
        "i am at a loss for words.",
        "please go on.",
        "i'm not sure i understand you fully.",
        "that is interesting. please continue."
    ];
    const lower = reply.trim().toLowerCase();
    const isGeneric = genericTriggers.some((g) => lower.includes(g));
    const needsSupport = isGeneric || reply.trim().length < 24;

    // Script boost: when Eliza returns a generic/short reply, enrich with a
    // relevant line from bundled ELIZA script files.
    const scriptBoostEnabled = options.aiConfig?.elizaScriptBoost !== false;
    if (needsSupport && scriptBoostEnabled && lastUserText) {
        const supplement = findScriptSupplement(lastUserText, options);
        if (supplement) {
            finalText = `${reply}\n\n(ELIZA script) ${supplement}`;
        }
    }

    // Enhanced boost can append the offline bot when Eliza is too generic.
    const enhancedEnabled = Boolean(options.enhanced || options.aiConfig?.elizaEnhanced);
    if (needsSupport && enhancedEnabled) {
        try {
            const ai = getAiProvider();
            const offline = await ai.performTask({ contents }, { provider: 'offline' });
            if (offline && offline.text) {
                console.log('[Eliza] appending offline fallback');
                finalText = `${reply}\n\n(Aside) ${offline.text}`;
            }
        } catch (e) {
            console.warn('[Eliza] enhanced fallback failed:', e);
        }
    }

    return {
        text: finalText,
        provider: 'eliza',
        functionCalls: [],
        functionResponses: [],
        usedSources: [],
        webSources: [],
        searchResults: []
    };
}

module.exports = {
    performTask,
    // expose runEliza for potential testing or future UI hooks
    runEliza,
    // list the available script files (names only) so UI code can present a
    // picker in the future.
    listScripts: () => {
        try {
            return fs.readdirSync(ELIZA_SCRIPT_DIR).filter((f) => f.endsWith('.txt'));
        } catch {
            return [];
        }
    }
};
