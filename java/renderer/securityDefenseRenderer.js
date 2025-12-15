document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') || 'policy';
  const url = params.get('url') || 'Unknown';
  const reason = params.get('reason') || 'Security Policy Enforcement';

  const body = document.body;
  const titleEl = document.getElementById('defense-title');
  const reasonEl = document.getElementById('defense-reason');
  const typeEl = document.getElementById('threat-type');
  const targetEl = document.getElementById('target-url');
  const detailTime = document.getElementById('detail-time');
  
  // Set Theme
  body.classList.add(`theme-${type}`);

  // Set Content based on Type
  const contentMap = {
    adult: {
      title: "Content Restricted",
      desc: "This page was blocked because it contains adult or explicit content inconsistent with your Safe Search settings."
    },
    malware: {
      title: "Malware Threat",
      desc: "Access blocked. This site is known to distribute malware or malicious software that can harm your device."
    },
    phishing: {
      title: "Deceptive Site",
      desc: "This might be a phishing attempt. The site may try to trick you into revealing passwords or financial information."
    },
    download: {
      title: "Unsafe Download",
      desc: "A file download was blocked because it appears suspicious or malicious."
    },
    policy: {
      title: "Access Denied",
      desc: "This request was blocked by your Firewall or Security Policy settings."
    }
  };

  const config = contentMap[type] || contentMap.policy;

  titleEl.textContent = config.title;
  reasonEl.textContent = config.desc;
  typeEl.textContent = type.toUpperCase();
  
  // Mask URL for safety visual
  let displayUrl = url;
  try {
    if (url.startsWith('http')) {
      const u = new URL(url);
      displayUrl = u.hostname;
      if (u.pathname.length > 1) displayUrl += '/...';
    }
  } catch(e) {}
  targetEl.textContent = displayUrl;
  targetEl.title = url;

  // Details
  detailTime.textContent = new Date().toLocaleString();

  // Buttons
  document.getElementById('btn-back').addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // If no history, go home
      window.browserAPI.navigate('../../html/pages/home.html');
    }
  });

  document.getElementById('btn-details').addEventListener('click', () => {
    document.getElementById('technical-details').classList.toggle('hidden');
  });
});