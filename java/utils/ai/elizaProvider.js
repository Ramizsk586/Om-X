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
    if (isGeneric && options.enhanced) {
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
        const dir = path.join(__dirname, '..', 'Eliza', 'scripts');
        try {
            return fs.readdirSync(dir).filter((f) => f.endsWith('.txt'));
        } catch {
            return [];
        }
    }
};
