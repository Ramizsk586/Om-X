const VT_API_BASE = 'https://www.virustotal.com/api/v3';
const DEFAULT_TIMEOUT_MS = 7000;

function resolveVirusTotalApiKey() {
  return String(
    process.env.OMX_VIRUSTOTAL_API_KEY
    || process.env.VIRUSTOTAL_API_KEY
    || process.env.VT_API_KEY
    || ''
  ).trim();
}

class VirusTotalClient {
  constructor(settings = {}) {
    this.updateSettings(settings);
  }

  updateSettings(settings = {}) {
    this.enabled = settings?.features?.enableVirusTotal ?? false;
    this.apiKey = resolveVirusTotalApiKey();
  }

  isConfigured(apiKeyOverride = '') {
    const key = this.getApiKey(apiKeyOverride);
    return Boolean(this.enabled && key);
  }

  getApiKey(apiKeyOverride = '') {
    return String(apiKeyOverride || this.apiKey || '').trim();
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

  calculateRiskScore(stats = {}) {
    const malicious = Number(stats.malicious || 0);
    const suspicious = Number(stats.suspicious || 0);
    const harmless = Number(stats.harmless || 0);
    const undetected = Number(stats.undetected || 0);
    const totalVotes = malicious + suspicious + harmless + undetected;
    return totalVotes > 0 ? Math.round(((malicious + suspicious) / totalVotes) * 100) : 0;
  }

  deriveRiskLevel(stats = {}, riskScore = null) {
    const malicious = Number(stats.malicious || 0);
    const suspicious = Number(stats.suspicious || 0);
    const harmless = Number(stats.harmless || 0);
    const undetected = Number(stats.undetected || 0);
    const scoreValue = Number(riskScore);
    const normalizedRiskScore = Number.isFinite(scoreValue) && scoreValue >= 0
      ? Math.round(scoreValue)
      : this.calculateRiskScore(stats);

    if (normalizedRiskScore < 5 && (harmless > 0 || undetected > 0 || malicious > 0 || suspicious > 0)) {
      return 'clean';
    }
    if (malicious >= 3 || normalizedRiskScore >= 15) return 'danger';
    if (malicious > 0 || suspicious > 0) return 'suspicious';
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

  async scanUrlDetailed(rawUrl, options = {}) {
    const normalizedUrl = VirusTotalClient.normalizeUrl(rawUrl);
    if (!normalizedUrl) {
      return { success: false, error: 'Invalid URL format. Use http:// or https://.' };
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
    const riskScore = this.calculateRiskScore(stats);
    const riskLevel = this.deriveRiskLevel(stats, riskScore);
    const blocked = riskLevel === 'danger' || riskLevel === 'suspicious';

    const categoriesMap = attributes.categories && typeof attributes.categories === 'object'
      ? attributes.categories
      : {};
    const categories = Array.from(new Set(Object.values(categoriesMap).filter(Boolean)));

    const engines = this.summarizeEngineResults(attributes.last_analysis_results || {});
    const detections = engines
      .filter((row) => row.category === 'malicious' || row.category === 'suspicious')
      .slice(0, 12);

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

}

module.exports = VirusTotalClient;
