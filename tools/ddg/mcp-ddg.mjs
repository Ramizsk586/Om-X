const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 10; SM-M515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 6.0; E5533) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.101 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 8.1.0; AX1082) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.83 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 8.1.0; TM-MID1020A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.96 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 9; POT-LX1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36 Edg/97.0.1072.71",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36 Edg/98.0.1108.62",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36",
  "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:97.0) Gecko/20100101 Firefox/97.0",
  "Opera/9.80 (Android 7.0; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16"
];

function spoofHeaders() {
  return {
    "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://duckduckgo.com/",
    "Origin": "https://duckduckgo.com",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0"
  };
}

async function fetchDdgHtml(url) {
  const res = await fetch(url, { method: "GET", headers: spoofHeaders() });
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`);
  }
  return await res.text();
}

function extractVqd(html = "") {
  const match = String(html).match(/vqd=['"]?([^"']+)['"]?/) || String(html).match(/\.vqd=['"]?([^"']+)['"]?/);
  return match ? match[1] : "";
}

function normalizeDdgUrl(rawUrl = "") {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  try {
    if (raw.includes("uddg=")) {
      return decodeURIComponent(raw.split("uddg=")[1].split("&")[0]) || raw;
    }
  } catch {
    return raw;
  }
  return raw;
}

function decodeHtmlEntities(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value = "") {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractWebResults(html = "", limit = 5) {
  const links = [];
  const seen = new Set();

  const push = (label = "", url = "", snippet = "") => {
    const cleanUrl = normalizeDdgUrl(url);
    if (!cleanUrl || seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    const cleanLabel = stripHtml(label || "Untitled") || "Untitled";
    const cleanSnippet = stripHtml(snippet || "");
    links.push({ title: cleanLabel, url: cleanUrl, snippet: cleanSnippet });
  };

  const resultBlockRegex = /<div[^>]*class="[^"]*\bresult__body\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let blockMatch;
  while ((blockMatch = resultBlockRegex.exec(html)) !== null && links.length < limit) {
    const block = blockMatch[1];
    const linkMatch = block.match(/<a[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]*href="([^"]*uddg=[^"]+|https?:\/\/[^"]+)"[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const snippetMatch =
      block.match(/<(?:a|div|span)[^>]*class="[^"]*\bresult__snippet\b[^"]*"[\s\S]*?>([\s\S]*?)<\/(?:a|div|span)>/i) ||
      block.match(/<(?:a|div|span)[^>]*class="[^"]*\bresult__extras__url\b[^"]*"[\s\S]*?>([\s\S]*?)<\/(?:a|div|span)>/i);
    push(linkMatch[2], linkMatch[1], snippetMatch ? snippetMatch[1] : "");
  }

  if (links.length === 0) {
    const regex = /<a[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gim;
    let match;
    while (links.length < limit && (match = regex.exec(html))) {
      push(match[2], match[1], "");
    }
  }

  if (links.length === 0) {
    const liteRegex = /<a[^>]*class="[^"]*\bresult-link\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gim;
    let match;
    while (links.length < limit && (match = liteRegex.exec(html))) {
      const rest = html.slice(match.index, match.index + 1200);
      const snippetMatch =
        rest.match(/<td[^>]*class="[^"]*\bresult-snippet\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i) ||
        rest.match(/<span[^>]*class="[^"]*\bfld-url\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      push(match[2], match[1], snippetMatch ? snippetMatch[1] : "");
    }
  }

  if (links.length === 0) {
    const redirectedLinkRegex = /<a[^>]*href="([^"]*uddg=[^"]+|https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gim;
    let match;
    while (links.length < limit && (match = redirectedLinkRegex.exec(html))) {
      const href = String(match[1] || "");
      if (!href.includes("uddg=") && !/^https?:\/\//i.test(href)) continue;
      const label = stripHtml(match[2]);
      if (!label || label.length < 3) continue;
      push(label, href, "");
    }
  }

  return links.slice(0, limit);
}

function isLikelyVideoUrl(url = "") {
  const u = String(url || "").toLowerCase();
  if (!u) return false;
  if (u.includes("youtube.com/watch") || u.includes("youtu.be/")) return true;
  if (u.includes("vimeo.com/")) return true;
  if (u.includes("dailymotion.com/video/") || u.includes("dai.ly/")) return true;
  if (u.includes("twitch.tv/videos/")) return true;
  if (u.includes("tiktok.com/") && u.includes("/video/")) return true;
  return false;
}

function parseVideoMeta(url = "") {
  const u = String(url || "").trim();
  const lower = u.toLowerCase();
  let source = "Video";
  let videoId = null;
  let thumbnail = null;

  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    source = "YouTube";
    const watchMatch = u.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    const shortMatch = u.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    videoId = (watchMatch && watchMatch[1]) || (shortMatch && shortMatch[1]) || null;
    if (videoId) thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  } else if (lower.includes("vimeo.com")) {
    source = "Vimeo";
    const match = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (match && match[1]) {
      videoId = match[1];
      thumbnail = `https://vumbnail.com/${videoId}.jpg`;
    }
  } else if (lower.includes("dailymotion.com") || lower.includes("dai.ly")) {
    source = "Dailymotion";
    const match = u.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/i);
    if (match && match[1]) {
      videoId = match[1];
      thumbnail = `https://www.dailymotion.com/thumbnail/video/${videoId}`;
    }
  } else if (lower.includes("twitch.tv")) {
    source = "Twitch";
  } else if (lower.includes("tiktok.com")) {
    source = "TikTok";
  }

  return { source, videoId, thumbnail };
}

export async function ddgWebSearch({ query, maxResults = 5, safeSearch = "moderate", page = 1 } = {}) {
  const q = String(query || "").trim();
  if (!q) {
    throw new Error("Query is required.");
  }

  const limit = Math.max(1, Math.min(10, Number(maxResults) || 5));
  const pageNum = Math.max(1, Number(page) || 1);
  const safe = String(safeSearch || "moderate").toLowerCase();

  const url = new URL("https://duckduckgo.com/html/");
  url.searchParams.set("q", q);
  if (safe !== "moderate") {
    url.searchParams.set("p", safe === "strict" ? "-1" : "1");
  }
  if (pageNum > 1) {
    url.searchParams.set("s", String((limit * (pageNum - 1)) || 0));
  }

  let html = "";
  let results = [];
  try {
    html = await fetchDdgHtml(url.toString());
    results = extractWebResults(html, limit);
  } catch (e) {
    // continue to lite fallback
  }

  if (results.length === 0) {
    const liteUrl = new URL("https://duckduckgo.com/lite/");
    liteUrl.searchParams.set("q", q);
    if (safe !== "moderate") {
      liteUrl.searchParams.set("kp", safe === "strict" ? "1" : "-1");
    }
    if (pageNum > 1) {
      liteUrl.searchParams.set("s", String((limit * (pageNum - 1)) || 0));
    }
    html = await fetchDdgHtml(liteUrl.toString());
    results = extractWebResults(html, limit);
  }

  return {
    query: q,
    source: "duckduckgo",
    results
  };
}

export async function ddgImageSearch({ query, maxResults = 10, safeSearch = "moderate" } = {}) {
  const q = String(query || "").trim();
  if (!q) {
    throw new Error("Query is required.");
  }
  const limit = Math.max(1, Math.min(20, Number(maxResults) || 10));
  const safe = String(safeSearch || "moderate").toLowerCase();

  const searchUrl = new URL("https://duckduckgo.com/");
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("iax", "images");
  searchUrl.searchParams.set("ia", "images");

  const html = await fetchDdgHtml(searchUrl.toString());
  const vqd = extractVqd(html);
  if (!vqd) {
    return { query: q, source: "duckduckgo", results: [] };
  }

  const imgUrl = new URL("https://duckduckgo.com/i.js");
  imgUrl.searchParams.set("q", q);
  imgUrl.searchParams.set("o", "json");
  imgUrl.searchParams.set("l", "us-en");
  imgUrl.searchParams.set("vqd", vqd);
  imgUrl.searchParams.set("f", ",,,,,");
  if (safe !== "moderate") {
    imgUrl.searchParams.set("p", safe === "strict" ? "-1" : "1");
  }

  const res = await fetch(imgUrl.toString(), { method: "GET", headers: spoofHeaders() });
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const results = (data.results || [])
    .slice(0, limit)
    .map((r) => ({
      title: r.title || r.source || "Image",
      image: r.image || r.thumbnail || "",
      thumbnail: r.thumbnail || "",
      url: r.url || r.source || ""
    }))
    .filter((r) => r.image);

  return {
    query: q,
    source: "duckduckgo",
    results
  };
}

export async function ddgVideoSearch({ query, maxResults = 5 } = {}) {
  const q = String(query || "").trim();
  if (!q) {
    throw new Error("Query is required.");
  }
  const limit = Math.max(1, Math.min(10, Number(maxResults) || 5));
  const videos = [];
  const seen = new Set();

  const collectFrom = async (searchQuery) => {
    const res = await ddgWebSearch({ query: searchQuery, maxResults: 10 });
    for (const item of res.results || []) {
      if (videos.length >= limit) break;
      if (!item?.url || !isLikelyVideoUrl(item.url)) continue;
      const meta = parseVideoMeta(item.url);
      const key = `${meta.source}:${meta.videoId || item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      videos.push({
        title: item.title || `${meta.source} Video`,
        url: item.url,
        snippet: item.snippet || "",
        source: meta.source,
        thumbnail: meta.thumbnail || ""
      });
    }
  };

  await collectFrom(q);
  if (videos.length < limit) await collectFrom(`${q} site:youtube.com`);
  if (videos.length < limit) await collectFrom(`${q} site:vimeo.com`);
  if (videos.length < limit) await collectFrom(`${q} site:dailymotion.com`);
  if (videos.length < limit) await collectFrom(`${q} site:twitch.tv/videos`);
  if (videos.length < limit) await collectFrom(`${q} site:tiktok.com`);

  return {
    query: q,
    source: "duckduckgo",
    results: videos.slice(0, limit)
  };
}
