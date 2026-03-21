const DEFAULT_BASE = "https://en.wikipedia.org";

function stripSearchMarkup(text = "") {
  return String(text)
    .replace(/<span class="searchmatch">/g, "")
    .replace(/<\/span>/g, "");
}

function buildApiUrl(baseUrl = DEFAULT_BASE) {
  const url = new URL(String(baseUrl || DEFAULT_BASE));
  url.pathname = "/w/api.php";
  return url;
}

function buildRestSummaryUrl(baseUrl, title) {
  const base = String(baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  return `${base}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
}

function buildRestMobileSectionsUrl(baseUrl, title, leadOnly = false) {
  const base = String(baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  const path = leadOnly ? "mobile-sections-lead" : "mobile-sections";
  return `${base}/api/rest_v1/page/${path}/${encodeURIComponent(title)}`;
}

function pageUrl(baseUrl, pageId) {
  return `${String(baseUrl || DEFAULT_BASE).replace(/\/$/, "")}/?curid=${pageId}`;
}

export async function wikiSearch({ query, limit = 5, baseUrl = DEFAULT_BASE } = {}) {
  const q = String(query || "").trim();
  if (!q) {
    throw new Error("Query is required.");
  }

  const url = buildApiUrl(baseUrl);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", q);
  url.searchParams.set("srwhat", "text");
  url.searchParams.set("srlimit", String(Math.max(1, Math.min(50, Number(limit) || 5))));
  url.searchParams.set("srinfo", "totalhits");
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const results = (data?.query?.search || []).map((result) => ({
    title: result.title,
    page_id: result.pageid,
    snippet: stripSearchMarkup(result.snippet || ""),
    url: pageUrl(baseUrl, result.pageid)
  }));

  return {
    query: q,
    source: "wikipedia",
    total_hits: data?.query?.general?.totalhits || results.length,
    results
  };
}

export async function wikiPage({ pageId, baseUrl = DEFAULT_BASE } = {}) {
  const id = Number(pageId);
  if (!Number.isFinite(id)) {
    throw new Error("Valid pageId is required.");
  }

  const url = buildApiUrl(baseUrl);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("pageids", String(id));
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(res.statusText || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const page = data?.query?.pages?.[id];
  if (!page || page.missing !== undefined) {
    throw new Error("Page not found or has been deleted.");
  }

  return {
    title: page.title,
    page_id: id,
    url: pageUrl(baseUrl, id),
    content: page.extract ?? "No content available.",
    content_length: (page.extract ?? "").length
  };
}

async function fetchPageTitle(baseUrl, pageId) {
  const url = buildApiUrl(baseUrl);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "info");
  url.searchParams.set("pageids", String(pageId));
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const page = data?.query?.pages?.[pageId];
  return page?.title || null;
}

async function fetchSummary(baseUrl, title) {
  if (!title) return null;
  try {
    const res = await fetch(buildRestSummaryUrl(baseUrl, title));
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data?.title || title,
      description: data?.description || "",
      extract: data?.extract || "",
      extract_html: data?.extract_html || "",
      type: data?.type || "",
      thumbnail: data?.thumbnail?.source || "",
      original_image: data?.originalimage?.source || "",
      lang: data?.lang || "",
      coordinates: data?.coordinates || null
    };
  } catch {
    return null;
  }
}

function normalizeInfoboxItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    label: item?.label?.text || item?.label || "",
    value: item?.value?.text || item?.value || "",
    html: item?.value?.html || ""
  })).filter((item) => item.label || item.value || item.html);
}

async function fetchSections(baseUrl, pageId) {
  const url = buildApiUrl(baseUrl);
  url.searchParams.set("action", "parse");
  url.searchParams.set("pageid", String(pageId));
  url.searchParams.set("prop", "sections");
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  const sections = Array.isArray(data?.parse?.sections) ? data.parse.sections : [];
  return sections.map((s) => ({
    index: s.index,
    anchor: s.anchor || "",
    level: s.level,
    toclevel: s.toclevel || "",
    title: s.line,
    number: s.number || ""
  }));
}

async function fetchInfoboxFromMobileSections(baseUrl, title) {
  if (!title) return null;
  try {
    const res = await fetch(buildRestMobileSectionsUrl(baseUrl, title, true));
    if (!res.ok) return null;
    const data = await res.json();
    const lead = Array.isArray(data?.lead?.sections) ? data.lead.sections : [];
    const infobox = lead.find((section) => section?.infobox)?.infobox;
    if (!infobox) return null;
    return {
      title: infobox?.title || "",
      type: infobox?.type || "",
      items: normalizeInfoboxItems(infobox?.items || [])
    };
  } catch {
    return null;
  }
}

async function fetchInfobox(baseUrl, pageId) {
  const url = buildApiUrl(baseUrl);
  url.searchParams.set("action", "parse");
  url.searchParams.set("pageid", String(pageId));
  url.searchParams.set("prop", "infobox");
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.error) return null;
  return data?.parse?.infobox || null;
}

export async function wikiPageAdvanced({
  pageId,
  baseUrl = DEFAULT_BASE,
  includeSummary = true,
  includeSections = true,
  includeInfobox = true,
  includeContent = true,
  maxSections = 40
} = {}) {
  const id = Number(pageId);
  if (!Number.isFinite(id)) {
    throw new Error("Valid pageId is required.");
  }

  const title = await fetchPageTitle(baseUrl, id);
  const summary = includeSummary ? await fetchSummary(baseUrl, title) : null;
  const sections = includeSections ? await fetchSections(baseUrl, id) : [];
  let infobox = null;
  if (includeInfobox) {
    infobox = await fetchInfoboxFromMobileSections(baseUrl, summary?.title || title);
    if (!infobox) {
      infobox = await fetchInfobox(baseUrl, id);
    }
  }

  let content = "";
  if (includeContent) {
    try {
      const basic = await wikiPage({ pageId: id, baseUrl });
      content = basic?.content || "";
    } catch {
      content = "";
    }
  }

  return {
    title: summary?.title || title || "",
    page_id: id,
    url: pageUrl(baseUrl, id),
    summary,
    sections: Array.isArray(sections) ? sections.slice(0, Math.max(1, Number(maxSections) || 40)) : [],
    infobox,
    content,
    content_length: content.length
  };
}
