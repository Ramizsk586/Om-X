function updateUiFromStats(stats) {
  const enabled = stats?.enabled !== false;
  const blockedCount = Number(stats?.blockedCount ?? 0);
  const skippedCount = Number(stats?.skippedCount ?? 0);
  const strictMode = stats?.strictMode === true;
  const debug = stats?.debug === true;

  const blockedCountEl = document.getElementById("blocked-count");
  const skippedCountEl = document.getElementById("skipped-count");
  const toggleSwitchEl = document.getElementById("toggle-switch");
  const strictModeToggleEl = document.getElementById("strict-mode-toggle");
  const debugToggleEl = document.getElementById("debug-toggle");
  const statusTextEl = document.getElementById("status-text");
  const statusDotEl = document.getElementById("status-dot");

  if (blockedCountEl) blockedCountEl.textContent = String(blockedCount);
  if (skippedCountEl) skippedCountEl.textContent = String(skippedCount);
  if (toggleSwitchEl) toggleSwitchEl.checked = enabled;
  if (strictModeToggleEl) strictModeToggleEl.checked = strictMode;
  if (debugToggleEl) debugToggleEl.checked = debug;
  if (statusTextEl) statusTextEl.textContent = enabled ? "Active" : "Paused";

  if (statusDotEl) {
    statusDotEl.classList.remove("active", "paused");
    statusDotEl.classList.add(enabled ? "active" : "paused");
  }
}

function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve(null);
          return;
        }
        resolve(response ?? null);
      });
    } catch (error) {
      void error;
      resolve(null);
    }
  });
}

async function refreshStats() {
  const stats = await sendMessage({ type: "GET_STATS" });
  if (stats) {
    updateUiFromStats(stats);
  }
}

async function refreshOptions() {
  const options = await sendMessage({ type: "GET_OPTIONS" });
  if (!options) {
    return;
  }

  const strictModeToggleEl = document.getElementById("strict-mode-toggle");
  const debugToggleEl = document.getElementById("debug-toggle");
  if (strictModeToggleEl) strictModeToggleEl.checked = options.strictMode === true;
  if (debugToggleEl) debugToggleEl.checked = options.debug === true;
}

async function updateFooterForActiveTab() {
  const footer = document.getElementById("footer-text");
  if (!footer) {
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeUrl = tabs?.[0]?.url || "";
    const isYouTube = /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(activeUrl);
    footer.textContent = isYouTube
      ? "Running on YouTube"
      : "Open YouTube to activate";
  } catch (error) {
    void error;
    footer.textContent = "Open YouTube to activate";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const toggleSwitch = document.getElementById("toggle-switch");
  const strictModeToggle = document.getElementById("strict-mode-toggle");
  const debugToggle = document.getElementById("debug-toggle");
  const resetBtn = document.getElementById("reset-btn");
  const blockedCountEl = document.getElementById("blocked-count");
  const skippedCountEl = document.getElementById("skipped-count");

  await refreshStats();
  await refreshOptions();
  await updateFooterForActiveTab();

  if (toggleSwitch) {
    toggleSwitch.addEventListener("change", async () => {
      const response = await sendMessage({
        type: "SET_ENABLED",
        enabled: toggleSwitch.checked
      });
      if (response) {
        updateUiFromStats(response);
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      await sendMessage({ type: "RESET_STATS" });
      if (blockedCountEl) blockedCountEl.textContent = "0";
      if (skippedCountEl) skippedCountEl.textContent = "0";
      await refreshStats();
    });
  }

  async function saveOptions() {
    await sendMessage({
      type: "UPDATE_OPTIONS",
      strictMode: strictModeToggle?.checked === true,
      debug: debugToggle?.checked === true
    });
    await refreshStats();
  }

  if (strictModeToggle) {
    strictModeToggle.addEventListener("change", saveOptions);
  }

  if (debugToggle) {
    debugToggle.addEventListener("change", saveOptions);
  }

  setInterval(async () => {
    await refreshStats();
    await updateFooterForActiveTab();
  }, 2000);
});
