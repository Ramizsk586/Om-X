function updateUiFromStats(stats) {
  const enabled      = stats?.enabled !== false;
  const blockedCount = Number(stats?.blockedCount ?? 0);
  const skippedCount = Number(stats?.skippedCount ?? 0);

  const blockedEl  = document.getElementById("blocked-count");
  const skippedEl  = document.getElementById("skipped-count");
  const toggleEl   = document.getElementById("toggle-switch");
  const statusText = document.getElementById("status-text");
  const statusDot  = document.getElementById("status-dot");

  if (blockedEl)  blockedEl.textContent  = String(blockedCount);
  if (skippedEl)  skippedEl.textContent  = String(skippedCount);
  if (toggleEl)   toggleEl.checked       = enabled;
  if (statusText) statusText.textContent = enabled ? "Active" : "Paused";
  if (statusDot) {
    statusDot.classList.remove("active", "paused");
    statusDot.classList.add(enabled ? "active" : "paused");
  }
}

function sendMessage(msg) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(msg, res => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(res ?? null);
      });
    } catch (_) { resolve(null); }
  });
}

async function refreshStats() {
  const stats = await sendMessage({ type: "GET_STATS" });
  if (stats) updateUiFromStats(stats);
}

async function updateFooter() {
  const footer = document.getElementById("footer-text");
  if (!footer) return;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url  = tabs?.[0]?.url || "";
    footer.textContent = /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(url)
      ? "Running on YouTube"
      : "Open YouTube to activate";
  } catch (_) {
    footer.textContent = "Open YouTube to activate";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const toggleSwitch = document.getElementById("toggle-switch");

  // Lock strict mode on startup
  await sendMessage({ type: "UPDATE_OPTIONS", strictMode: true, debug: false });
  await refreshStats();
  await updateFooter();

  if (toggleSwitch) {
    toggleSwitch.addEventListener("change", async () => {
      const enabled  = toggleSwitch.checked;
      // Write to storage FIRST so content script reacts instantly via onChanged
      chrome.storage.local.set({ enabled });
      const response = await sendMessage({ type: "SET_ENABLED", enabled });
      if (response) updateUiFromStats(response);
    });
  }

  setInterval(async () => {
    await refreshStats();
    await updateFooter();
  }, 2000);
});
