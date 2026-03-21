const DEFAULT_STATE = {
  enabled:      true,
  blockedCount: 0,
  skippedCount: 0,
  strictMode:   true,
  debug:        false
};

function isYouTubeUrl(url) {
  return /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(String(url || ""));
}

function isTrustedSender(sender) {
  return isYouTubeUrl(sender?.url || sender?.tab?.url || "");
}

async function ensureRulesetEnabled(enabled) {
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds:  enabled ? ["main_rules"] : [],
      disableRulesetIds: enabled ? [] : ["main_rules"]
    });
  } catch (e) {
    console.error("[BG] ruleset toggle failed:", e);
  }
}

async function getStatsResponse() {
  const s = await chrome.storage.local.get([
    "enabled", "blockedCount", "skippedCount"
  ]);
  return {
    enabled:      s.enabled      !== false,
    blockedCount: Number(s.blockedCount ?? 0),
    skippedCount: Number(s.skippedCount ?? 0),
    strictMode:   true,
    debug:        false
  };
}

async function incrementCounter(key, amount) {
  const n = Math.max(0, Number(amount) || 0);
  if (n < 1) return;
  const cur = await chrome.storage.local.get([key]);
  await chrome.storage.local.set({ [key]: Number(cur[key] ?? 0) + n });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
    await chrome.storage.local.set({
      ...DEFAULT_STATE,
      ...existing,
      strictMode: true, // always force strict on
      debug: false
    });
    await ensureRulesetEnabled(existing.enabled ?? DEFAULT_STATE.enabled);
  } catch (e) {
    console.error("[BG] install error:", e);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const s = await chrome.storage.local.get(["enabled"]);
    await ensureRulesetEnabled(s.enabled !== false);
  } catch (e) {
    console.error("[BG] startup error:", e);
  }
});

// ── Message handler ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const stats = await getStatsResponse();

    switch (message?.type) {
      case "GET_STATS":
        sendResponse(stats);
        break;

      case "GET_OPTIONS":
        sendResponse({ strictMode: true, debug: false });
        break;

      case "SET_ENABLED": {
        const next = message.enabled !== false;
        await chrome.storage.local.set({ enabled: next });
        await ensureRulesetEnabled(next);
        sendResponse({ ...stats, enabled: next });
        break;
      }

      case "UPDATE_OPTIONS":
        await chrome.storage.local.set({ strictMode: true, debug: false });
        sendResponse({ strictMode: true, debug: false });
        break;

      case "INCREMENT_BLOCKED":
        if (!isTrustedSender(sender)) { sendResponse({ ok: false }); break; }
        await incrementCounter("blockedCount", message.amount ?? 1);
        sendResponse({ ok: true });
        break;

      case "INCREMENT_SKIPPED":
        if (!isTrustedSender(sender)) { sendResponse({ ok: false }); break; }
        await incrementCounter("skippedCount", message.amount ?? 1);
        sendResponse({ ok: true });
        break;

      case "RESET_STATS":
        await chrome.storage.local.set({ blockedCount: 0, skippedCount: 0 });
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  })().catch(e => {
    console.error("[BG] error:", e);
    sendResponse({ ok: false, error: "Internal error" });
  });

  return true;
});
