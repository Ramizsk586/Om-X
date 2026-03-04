const crypto = require('crypto');
const fs = require('fs');

const VT_API_BASE = 'https://www.virustotal.com/api/v3';
const DEFAULT_TIMEOUT_MS = 7000;
const URL_CACHE_TTL_MS = 30 * 60 * 1000;
const FILE_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

class VirusTotalClient {
  constructor(settings = {}) {
    this.urlCache = new Map();
    this.fileCache = new Map();
    this.updateSettings(settings);
  }

  updateSettings(settings = {}) {
    const cfg = settings?.security?.virusTotal || {};
    this.enabled = settings?.features?.enableVirusTotal ?? false;
    this.apiKey = String(cfg.apiKey || '').trim();
    this.scanUrls = cfg.scanUrls !== false;
    this.scanExecutables = cfg.scanExecutables !== false;
    this.blockOnSuspicious = cfg.blockOnSuspicious !== false;
  }

  isConfigured(apiKeyOverride = '') {
    const key = this.getApiKey(apiKeyOverride);
    return Boolean(this.enabled && key);
  }

  getApiKey(apiKeyOverride = '') {
    return String(apiKeyOverride || this.apiKey || '').trim();
  }

  shouldBlockStats(stats = {}) {
    const malicious = Number(stats.malicious || 0);
    const suspicious = Number(stats.suspicious || 0);
    if (malicious > 0) return true;
    if (this.blockOnSuspicious && suspicious > 0) return true;
    return false;
  }

  static toUrlId(url) {
    return Buffer.from(url)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  static normalizeUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (!/^https?:$/i.test(parsed.protocol)) return null;
      parsed.hash = '';
      return parsed.toString();
    } catch (_) {
      return null;
    }
  }

  async requestJson(endpoint, options = {}) {
    const {
      method = 'GET',
      body = undefined,
      headers = {},
      apiKey = '',
      timeoutMs = DEFAULT_TIMEOUT_MS
    } = options;

    const reqHeaders = {
      Accept: 'application/json',
      'x-apikey': apiKey,
      ...headers
    };

    let response;
    try {
      response = await fetch(`${VT_API_BASE}${endpoint}`, {
        method,
        headers: reqHeaders,
        body,
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      return { ok: false, status: 0, data: null, text: '', error: error.message };
    }

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      text
    };
  }

  readCache(cache, key) {
    if (!cache.has(key)) return null;
    const cached = cache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }
    return cached.value;
  }

  writeCache(cache, key, value, ttlMs) {
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  parseStats(rawStats = {}) {
    return {
      malicious: Number(rawStats.malicious || 0),
      suspicious: Number(rawStats.suspicious || 0),
      harmless: Number(rawStats.harmless || 0),
      undetected: Number(rawStats.undetected || 0),
      timeout: Number(rawStats.timeout || 0)
    };
  }

  formatReason(label, stats) {
    const malicious = Number(stats?.malicious || 0);
    const suspicious = Number(stats?.suspicious || 0);
    if (malicious > 0 && suspicious > 0) {
      return `${label}: ${malicious} malicious, ${suspicious} suspicious detections`;
    }
    if (malicious > 0) {
      return `${label}: ${malicious} malicious detections`;
    }
    if (suspicious > 0) {
      return `${label}: ${suspicious} suspicious detections`;
    }
    return `${label}: no active detections`;
  }

  deriveRiskLevel(stats = {}) {
    const malicious = Number(stats.malicious || 0);
    const suspicious = Number(stats.suspicious || 0);
    const harmless = Number(stats.harmless || 0);
    const undetected = Number(stats.undetected || 0);
    if (malicious > 0) return 'danger';
    if (suspicious > 0) return 'suspicious';
    if (harmless > 0 && malicious === 0 && suspicious === 0) return 'clean';
    if (undetected > 0) return 'unknown';
    return 'unknown';
  }

  summarizeEngineResults(rawResults = {}) {
    const rows = Object.entries(rawResults || {}).map(([engineName, value]) => ({
      engine: engineName,
      category: String(value?.category || 'undetected').toLowerCase(),
      result: value?.result || '',
      method: value?.method || ''
    }));

    rows.sort((a, b) => {
      const rank = (cat) => {
        if (cat === 'malicious') return 0;
        if (cat === 'suspicious') return 1;
        if (cat === 'harmless') return 3;
        return 2;
      };
      return rank(a.category) - rank(b.category);
    });

    return rows;
  }

  async fetchUrlAttributes(normalizedUrl, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const urlId = VirusTotalClient.toUrlId(normalizedUrl);
    const lookup = await this.requestJson(`/urls/${urlId}`, { apiKey, timeoutMs });

    if (lookup.ok) {
      return { success: true, attributes: lookup.data?.data?.attributes || {}, id: urlId };
    }

    if (lookup.status !== 404) {
      return { success: false, error: `VirusTotal lookup failed (${lookup.status}).` };
    }

    const submit = await this.requestJson('/urls', {
      method: 'POST',
      apiKey,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: normalizedUrl }).toString(),
      timeoutMs
    });

    if (!submit.ok) {
      return { success: false, error: `VirusTotal submit failed (${submit.status}).` };
    }

    const analysisId = submit.data?.data?.id;
    if (!analysisId) {
      return { success: false, error: 'VirusTotal returned invalid analysis ID.' };
    }

    const poll = await this.pollAnalysis(analysisId, apiKey, timeoutMs);
    if (!poll.success) {
      return { success: false, error: poll.error || 'VirusTotal analysis timed out.' };
    }

    const secondLookup = await this.requestJson(`/urls/${urlId}`, { apiKey, timeoutMs });
    if (!secondLookup.ok) {
      return { success: false, error: `VirusTotal lookup failed after analysis (${secondLookup.status}).` };
    }

    return { success: true, attributes: secondLookup.data?.data?.attributes || {}, id: urlId };
  }

  async verifyApiKey(apiKeyOverride = '') {
    const key = this.getApiKey(apiKeyOverride);
    if (!key) return { success: false, error: 'VirusTotal API key is required.' };

    const result = await this.requestJson('/users/current', { apiKey: key, timeoutMs: 6500 });
    if (!result.ok) {
      return {
        success: false,
        error: `VirusTotal verification failed (${result.status}).`
      };
    }

    const attrs = result.data?.data?.attributes || {};
    const userName = attrs.username || result.data?.data?.id || 'verified-user';
    const toNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

    const quotaContainers = [
      attrs.quotas,
      attrs.api_quotas,
      attrs.user_quotas,
      attrs.quota,
      attrs.api_quota,
      attrs.group_quotas,
      attrs.current_plan?.quotas,
      attrs.subscription?.quotas
    ].filter((node) => node && typeof node === 'object');

    const pickQuotaNode = (keys = []) => {
      for (const container of quotaContainers) {
        for (const keyName of keys) {
          const value = container?.[keyName];
          if (value && typeof value === 'object') return value;
        }
      }
      return {};
    };

    const readLimit = (node) => toNumber(
      node?.allowed ?? node?.limit ?? node?.quota ?? node?.max ?? node?.total
    );
    const readUsed = (node) => toNumber(
      node?.used ?? node?.consumed ?? node?.usage ?? node?.count ?? node?.current ?? node?.spent
    );
    const readRemaining = (node) => toNumber(
      node?.remaining ?? node?.left ?? node?.available ?? node?.balance
    );

    const dailyNode = pickQuotaNode([
      'api_requests_daily',
      'daily_api_requests',
      'daily',
      'daily_requests',
      'requests_daily'
    ]);
    const monthlyNode = pickQuotaNode([
      'api_requests_monthly',
      'monthly_api_requests',
      'monthly',
      'monthly_requests',
      'requests_monthly'
    ]);

    let dailyQuota = readLimit(dailyNode);
    const dailyUsed = readUsed(dailyNode);
    const dailyRemaining = readRemaining(dailyNode);

    let monthlyQuota = readLimit(monthlyNode);
    const monthlyUsed = readUsed(monthlyNode);
    let monthlyLeft = readRemaining(monthlyNode);
    if (monthlyLeft === null && monthlyQuota !== null && monthlyUsed !== null) {
      monthlyLeft = Math.max(0, monthlyQuota - monthlyUsed);
    }

    let dailyLeft = dailyRemaining;
    if (dailyLeft === null && dailyQuota !== null && dailyUsed !== null) {
      dailyLeft = Math.max(0, dailyQuota - dailyUsed);
    }

    // Fallback for public/free keys when VT does not return quota objects.
    if (dailyQuota === null) dailyQuota = 500;
    if (monthlyQuota === null) monthlyQuota = 15500;
    if (dailyLeft === null && dailyUsed !== null) {
      dailyLeft = Math.max(0, dailyQuota - dailyUsed);
    }
    if (monthlyLeft === null && monthlyUsed !== null) {
      monthlyLeft = Math.max(0, monthlyQuota - monthlyUsed);
    }

    return {
      success: true,
      userName,
      dailyQuota,
      dailyUsed,
      dailyLeft,
      monthlyQuota,
      monthlyUsed,
      monthlyLeft
    };
  }

  async wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async pollAnalysis(analysisId, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const result = await this.requestJson(`/analyses/${analysisId}`, {
        apiKey,
        timeoutMs
      });
      if (result.ok) {
        const status = result.data?.data?.attributes?.status;
        if (status === 'completed') {
          const stats = this.parseStats(result.data?.data?.attributes?.stats || {});
          return { success: true, stats };
        }
      }
      await this.wait(900);
    }
    return { success: false, error: 'VirusTotal analysis timeout.' };
  }

  async scanUrl(rawUrl, options = {}) {
    const normalizedUrl = VirusTotalClient.normalizeUrl(rawUrl);
    if (!normalizedUrl) return { safe: true, skipped: true, reason: 'Invalid URL format.' };

    if (!this.scanUrls) return { safe: true, skipped: true, reason: 'URL scanning disabled.' };

    const key = this.getApiKey(options.apiKey);
    if (!this.enabled || !key) {
      return { safe: true, skipped: true, reason: 'VirusTotal disabled or API key missing.' };
    }

    let cacheKey = `url:${normalizedUrl}`;
    try {
      const parsed = new URL(normalizedUrl);
      cacheKey = `url:${parsed.hostname.toLowerCase()}`;
    } catch (_) {}
    const cached = this.readCache(this.urlCache, cacheKey);
    if (cached) return cached;

    const urlId = VirusTotalClient.toUrlId(normalizedUrl);
    let stats = null;

    const lookup = await this.requestJson(`/urls/${urlId}`, {
      apiKey: key,
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS
    });

    if (lookup.ok) {
      stats = this.parseStats(lookup.data?.data?.attributes?.last_analysis_stats || {});
    } else if (lookup.status === 404) {
      const submit = await this.requestJson('/urls', {
        method: 'POST',
        apiKey: key,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url: normalizedUrl }).toString(),
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS
      });

      if (submit.ok) {
        const analysisId = submit.data?.data?.id;
        if (analysisId) {
          const poll = await this.pollAnalysis(analysisId, key, options.timeoutMs || DEFAULT_TIMEOUT_MS);
          if (poll.success) stats = poll.stats;
        }
      }
    }

    if (!stats) {
      const fallback = { safe: true, blocked: false, reason: 'VirusTotal URL scan unavailable.', stats: null };
      this.writeCache(this.urlCache, cacheKey, fallback, 3 * 60 * 1000);
      return fallback;
    }

    const blocked = this.shouldBlockStats(stats);
    const result = {
      safe: !blocked,
      blocked,
      stats,
      reason: this.formatReason('URL reputation', stats)
    };
    this.writeCache(this.urlCache, cacheKey, result, URL_CACHE_TTL_MS);
    return result;
  }

  async scanUrlDetailed(rawUrl, options = {}) {
    const normalizedUrl = VirusTotalClient.normalizeUrl(rawUrl);
    if (!normalizedUrl) {
      return { success: false, error: 'Invalid URL format. Use http:// or https://.' };
    }

    if (!this.scanUrls && !options.force) {
      return { success: false, error: 'VirusTotal URL scanning is disabled in settings.' };
    }

    const key = this.getApiKey(options.apiKey);
    if (!key) {
      return { success: false, error: 'VirusTotal API key is missing.' };
    }

    const fetched = await this.fetchUrlAttributes(normalizedUrl, key, options.timeoutMs || DEFAULT_TIMEOUT_MS);
    if (!fetched.success) {
      return { success: false, error: fetched.error || 'VirusTotal URL lookup failed.' };
    }

    const attributes = fetched.attributes || {};
    const stats = this.parseStats(attributes.last_analysis_stats || {});
    const blocked = this.shouldBlockStats(stats);
    const riskLevel = this.deriveRiskLevel(stats);

    const categoriesMap = attributes.categories && typeof attributes.categories === 'object'
      ? attributes.categories
      : {};
    const categories = Array.from(new Set(Object.values(categoriesMap).filter(Boolean)));

    const engines = this.summarizeEngineResults(attributes.last_analysis_results || {});
    const detections = engines
      .filter((row) => row.category === 'malicious' || row.category === 'suspicious')
      .slice(0, 12);

    const totalVotes = stats.malicious + stats.suspicious + stats.harmless + stats.undetected;
    const riskScore = totalVotes > 0 ? Math.round(((stats.malicious + stats.suspicious) / totalVotes) * 100) : 0;

    const scanTimestamp = Number(attributes.last_analysis_date || 0);

    return {
      success: true,
      url: normalizedUrl,
      id: fetched.id,
      safe: !blocked,
      blocked,
      riskLevel,
      riskScore,
      reputation: Number(attributes.reputation || 0),
      categories,
      stats,
      detections,
      engineCount: engines.length,
      reason: this.formatReason('URL reputation', stats),
      scanDate: scanTimestamp > 0 ? new Date(scanTimestamp * 1000).toISOString() : null
    };
  }

  async calculateFileHash(filePath) {
    return new Promise((resolve) => {
      try {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', () => resolve(''));
      } catch (_) {
        resolve('');
      }
    });
  }

  async scanFileHash(hash, options = {}) {
    const cleanHash = String(hash || '').trim().toLowerCase();
    if (!cleanHash) return { safe: true, skipped: true, reason: 'Missing file hash.' };

    const key = this.getApiKey(options.apiKey);
    if (!this.enabled || !key) {
      return { safe: true, skipped: true, reason: 'VirusTotal disabled or API key missing.' };
    }

    const cacheKey = `file:${cleanHash}`;
    const cached = this.readCache(this.fileCache, cacheKey);
    if (cached) return cached;

    const lookup = await this.requestJson(`/files/${cleanHash}`, {
      apiKey: key,
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS
    });

    if (lookup.status === 404) {
      const result = { safe: true, blocked: false, unknown: true, reason: 'Hash not found in VirusTotal index.' };
      this.writeCache(this.fileCache, cacheKey, result, 30 * 60 * 1000);
      return result;
    }

    if (!lookup.ok) {
      const result = { safe: true, blocked: false, reason: 'VirusTotal file lookup unavailable.' };
      this.writeCache(this.fileCache, cacheKey, result, 5 * 60 * 1000);
      return result;
    }

    const stats = this.parseStats(lookup.data?.data?.attributes?.last_analysis_stats || {});
    const blocked = this.shouldBlockStats(stats);
    const result = {
      safe: !blocked,
      blocked,
      stats,
      reason: this.formatReason('File reputation', stats)
    };
    this.writeCache(this.fileCache, cacheKey, result, FILE_CACHE_TTL_MS);
    return result;
  }

  async scanFileByPath(filePath, options = {}) {
    if (!this.scanExecutables) {
      return { safe: true, skipped: true, reason: 'Executable scanning disabled.' };
    }
    if (!filePath || !fs.existsSync(filePath)) {
      return { safe: true, skipped: true, reason: 'File not found.' };
    }
    const hash = await this.calculateFileHash(filePath);
    if (!hash) return { safe: true, skipped: true, reason: 'Failed to hash file.' };
    const result = await this.scanFileHash(hash, options);
    return { ...result, sha256: hash };
  }
}

module.exports = VirusTotalClient;
