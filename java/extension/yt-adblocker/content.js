(() => {
  if (window.__YT_AD_BLOCKER_INSTALLED__) {
    return;
  }
  window.__YT_AD_BLOCKER_INSTALLED__ = true;

  const BASE_AD_SELECTORS = [
    ".ytp-ad-overlay-container",
    ".ytp-ad-text-overlay",
    ".ytp-ad-image-overlay",
    ".ytp-ad-skip-button-container",
    ".ytp-ad-module",
    ".ytp-ad-player-overlay",
    ".ytp-ad-progress-list",
    ".ytp-ad-persistent-progress-bar-container",
    "#player-ads",
    "#masthead-ad",
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-promoted-video-renderer",
    "ytd-display-ad-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-companion-slot-renderer",
    "ytd-statement-banner-renderer",
    "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']"
  ];

  const STRICT_EXTRA_SELECTORS = [
    "ytd-rich-item-renderer[is-ad]",
    "ytd-video-masthead-ad-v3-renderer",
    "ytd-banner-promo-renderer"
  ];

  const SKIP_BUTTON_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-skip-ad-button-modern"
  ];

  const CLEANUP_INTERVAL_MS = 1500;

  let observer = null;
  let cleanupIntervalId = null;
  let scheduled = false;
  let running = false;
  let strictMode = false;
  let debugMode = false;
  let pendingBlocked = 0;
  let pendingSkipped = 0;
  let statsFlushTimer = null;
  let restorePlaybackRate = null;
  let storageListenerBound = false;
  let navigationListenerBound = false;

  function safeSendMessage(payload) {
    try {
      if (!chrome?.runtime?.sendMessage) {
        debugLog("chrome.runtime.sendMessage is not available");
        return;
      }

      chrome.runtime.sendMessage(payload, (response) => {
        const ignored = chrome.runtime?.lastError;
        if (ignored) {
          debugLog("Error sending message:", ignored);
        } else {
          debugLog("Message sent successfully:", payload);
        }
      });
    } catch (error) {
      debugLog("Exception in safeSendMessage:", error);
    }
  }

  function debugLog(...args) {
    if (!debugMode) {
      return;
    }
    console.debug("[YT Ad Blocker]", ...args);
  }

  function queueStat(type, amount) {
    if (type === "blocked") {
      pendingBlocked += amount;
    } else if (type === "skipped") {
      pendingSkipped += amount;
    }

    if (statsFlushTimer) {
      return;
    }

    statsFlushTimer = setTimeout(() => {
      statsFlushTimer = null;
      const blockedToSend = pendingBlocked;
      const skippedToSend = pendingSkipped;
      pendingBlocked = 0;
      pendingSkipped = 0;

      if (blockedToSend > 0) {
        safeSendMessage({ type: "INCREMENT_BLOCKED", amount: blockedToSend });
      }

      if (skippedToSend > 0) {
        safeSendMessage({ type: "INCREMENT_SKIPPED", amount: skippedToSend });
      }
    }, 1000);
  }

  function flushPendingStats() {
    if (statsFlushTimer) {
      clearTimeout(statsFlushTimer);
      statsFlushTimer = null;
    }

    const blockedToSend = pendingBlocked;
    const skippedToSend = pendingSkipped;
    pendingBlocked = 0;
    pendingSkipped = 0;

    if (blockedToSend > 0) {
      safeSendMessage({ type: "INCREMENT_BLOCKED", amount: blockedToSend });
    }

    if (skippedToSend > 0) {
      safeSendMessage({ type: "INCREMENT_SKIPPED", amount: skippedToSend });
    }
  }

  function getSelectors() {
    return strictMode
      ? BASE_AD_SELECTORS.concat(STRICT_EXTRA_SELECTORS)
      : BASE_AD_SELECTORS;
  }

  function skipAd() {
    if (!document) {
      return;
    }

    for (const selector of SKIP_BUTTON_SELECTORS) {
      const skipButton = document.querySelector(selector);
      if (skipButton instanceof HTMLElement) {
        skipButton.click();
        queueStat("skipped", 1);
        debugLog("Clicked skip button:", selector);
        return;
      }
    }
  }

  function removeAdElements() {
    if (!document) {
      return;
    }

    let removedCount = 0;
    for (const selector of getSelectors()) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        element.remove();
        removedCount += 1;
      });
    }

    if (removedCount > 0) {
      queueStat("blocked", removedCount);
      debugLog("Removed ad elements:", removedCount);
    }
  }

  function handleUnskippableAd() {
    if (!document) {
      return;
    }

    const video = document.querySelector("video");
    const player =
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player");
    const bodyHasAd = !!document.body?.classList.contains("ad-showing");
    const playerHasAd =
      player instanceof HTMLElement && player.classList.contains("ad-showing");
    const overlayExists = !!document.querySelector(".ytp-ad-player-overlay");
    const adShowing = bodyHasAd || playerHasAd || overlayExists;

    if (
      adShowing &&
      video instanceof HTMLVideoElement &&
      Number.isFinite(video.duration) &&
      video.duration > 0
    ) {
      try {
        if (restorePlaybackRate === null) {
          restorePlaybackRate = video.playbackRate;
        }
        video.currentTime = Math.max(0, video.duration - 0.1);
        video.playbackRate = 16;
        queueStat("skipped", 1);
        debugLog("Fast-forwarded in-stream ad");
      } catch (error) {
        void error;
      }
      return;
    }

    if (restorePlaybackRate !== null && video instanceof HTMLVideoElement) {
      try {
        video.playbackRate = restorePlaybackRate;
      } catch (error) {
        void error;
      } finally {
        restorePlaybackRate = null;
      }
    }
  }

  function runCleanup() {
    if (!running) {
      return;
    }

    skipAd();
    removeAdElements();
    handleUnskippableAd();
  }

  function scheduleCleanup() {
    if (scheduled || !running) {
      return;
    }

    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      runCleanup();
    });
  }

  function observeAndClean() {
    if (!document?.documentElement || !running) {
      return;
    }

    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          scheduleCleanup();
          return;
        }

        if (
          mutation.type === "attributes" &&
          mutation.target instanceof HTMLElement &&
          mutation.target.classList.contains("ad-showing")
        ) {
          scheduleCleanup();
          return;
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  function stop() {
    running = false;
    scheduled = false;

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId);
      cleanupIntervalId = null;
    }

    if (statsFlushTimer) {
      flushPendingStats();
    }
  }

  function start() {
    if (running) {
      return;
    }

    running = true;
    observeAndClean();
    runCleanup();

    cleanupIntervalId = setInterval(() => {
      runCleanup();
    }, CLEANUP_INTERVAL_MS);

    if (!navigationListenerBound) {
      document.addEventListener("yt-navigate-finish", scheduleCleanup, {
        passive: true
      });
      navigationListenerBound = true;
    }
  }

  async function getOptions() {
    try {
      if (!chrome?.storage?.local?.get) {
        return { enabled: true, strictMode: false, debug: false };
      }

      const result = await chrome.storage.local.get([
        "enabled",
        "strictMode",
        "debug"
      ]);

      return {
        enabled: result.enabled !== false,
        strictMode: result.strictMode === true,
        debug: result.debug === true
      };
    } catch (error) {
      void error;
      return { enabled: true, strictMode: false, debug: false };
    }
  }

  function bindStorageListener() {
    if (storageListenerBound || !chrome?.storage?.onChanged) {
      return;
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      if (changes.strictMode) {
        strictMode = changes.strictMode.newValue === true;
        scheduleCleanup();
      }

      if (changes.debug) {
        debugMode = changes.debug.newValue === true;
      }

      if (changes.enabled) {
        const nextEnabled = changes.enabled.newValue !== false;
        if (nextEnabled) {
          start();
          scheduleCleanup();
        } else {
          stop();
        }
      }
    });

    storageListenerBound = true;
  }

  async function init() {
    const options = await getOptions();
    strictMode = options.strictMode;
    debugMode = options.debug;
    bindStorageListener();

    if (!options.enabled) {
      debugLog("Extension disabled via settings");
      return;
    }

    start();

    // Allow native right-click menu
    document.addEventListener('contextmenu', (event) => {
      // Do not interfere with the native context menu
      return;
    });
  }

  init().catch((error) => {
    debugLog("Initialization error", error);
  });
})();
