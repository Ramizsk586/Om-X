const DEFAULT_STATE = {
  enabled: true,
  blockedCount: 0,
  skippedCount: 0,
  strictMode: false,
  debug: false
};

function isYouTubeUrl(url) {
  return /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(String(url || ""));
}

function isTrustedSender(sender) {
  return isYouTubeUrl(sender?.url || sender?.tab?.url || "");
}

async function ensureRulesetEnabled(enabled) {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? ["main_rules"] : [],
    disableRulesetIds: enabled ? [] : ["main_rules"]
  });
}

async function getState() {
  return chrome.storage.local.get([
    "enabled",
    "blockedCount",
    "skippedCount",
    "strictMode",
    "debug"
  ]);
}

async function getStatsResponse() {
  const state = await getState();
  return {
    enabled: state.enabled !== false,
    blockedCount: Number(state.blockedCount ?? 0),
    skippedCount: Number(state.skippedCount ?? 0),
    strictMode: state.strictMode === true,
    debug: state.debug === true
  };
}

async function incrementCounter(key, amount) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (safeAmount < 1) {
    return;
  }

  const current = await chrome.storage.local.get([key]);
  const nextValue = Number(current[key] ?? 0) + safeAmount;
  await chrome.storage.local.set({ [key]: nextValue });
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
    await chrome.storage.local.set({ ...DEFAULT_STATE, ...existing });

    const enabled = existing.enabled ?? DEFAULT_STATE.enabled;
    await ensureRulesetEnabled(enabled);
  } catch (error) {
    console.error("Failed during install/update:", error);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const state = await getStatsResponse();
    await ensureRulesetEnabled(state.enabled);
  } catch (error) {
    console.error("Failed to restore ruleset state:", error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const stats = await getStatsResponse();

    if (message?.type === "GET_STATS") {
      sendResponse(stats);
      return;
    }

    if (message?.type === "GET_OPTIONS") {
      sendResponse({ strictMode: stats.strictMode, debug: stats.debug });
      return;
    }

    if (message?.type === "SET_ENABLED") {
      const nextEnabled = message.enabled !== false;
      await chrome.storage.local.set({ enabled: nextEnabled });
      await ensureRulesetEnabled(nextEnabled);

      sendResponse({
        enabled: nextEnabled,
        blockedCount: stats.blockedCount,
        skippedCount: stats.skippedCount,
        strictMode: stats.strictMode,
        debug: stats.debug
      });
      return;
    }

    if (message?.type === "UPDATE_OPTIONS") {
      const nextStrictMode = message.strictMode === true;
      const nextDebug = message.debug === true;
      await chrome.storage.local.set({
        strictMode: nextStrictMode,
        debug: nextDebug
      });
      sendResponse({ strictMode: nextStrictMode, debug: nextDebug });
      return;
    }

    if (message?.type === "INCREMENT_BLOCKED") {
      if (!isTrustedSender(_sender)) {
        sendResponse({ ok: false, error: "Untrusted sender" });
        return;
      }
      await incrementCounter("blockedCount", message.amount ?? 1);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "INCREMENT_SKIPPED") {
      if (!isTrustedSender(_sender)) {
        sendResponse({ ok: false, error: "Untrusted sender" });
        return;
      }
      await incrementCounter("skippedCount", message.amount ?? 1);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "RESET_STATS") {
      await chrome.storage.local.set({ blockedCount: 0, skippedCount: 0 });
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
  })().catch((error) => {
    console.error("Message handler error:", error);
    sendResponse({ ok: false, error: "Internal error" });
  });

  return true;
});
