/**
 * Create a sliding-window in-memory store for rate-limit counters.
 * @returns {{consume: (key: string, windowMs: number, max: number) => {allowed: boolean, remaining: number, retryAfterMs: number}}} Store helpers.
 */
function createWindowStore() {
  const buckets = new Map();

  /**
   * Prune stale buckets to keep memory bounded on small machines.
   * @param {number} [now] Reference timestamp.
   * @returns {void}
   */
  function prune(now = Date.now()) {
    for (const [key, record] of buckets.entries()) {
      const timestamps = Array.isArray(record?.timestamps) ? record.timestamps : [];
      const windowMs = Number(record?.windowMs) || 0;
      const lastTimestamp = timestamps[timestamps.length - 1] || 0;
      if (!timestamps.length || !windowMs || lastTimestamp <= (now - windowMs)) {
        buckets.delete(key);
      }
    }
  }

  /**
   * Consume one request from the sliding window.
   * @param {string} key Rate-limit key.
   * @param {number} windowMs Sliding-window duration in milliseconds.
   * @param {number} max Maximum requests allowed in the window.
   * @returns {{allowed: boolean, remaining: number, retryAfterMs: number}} Consume result.
   */
  function consume(key, windowMs, max) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const existingRecord = buckets.get(key) || { timestamps: [], windowMs };
    const bucket = existingRecord.timestamps.filter((timestamp) => timestamp > cutoff);
    bucket.push(now);
    buckets.set(key, { timestamps: bucket, windowMs });

    if (buckets.size > 5000) prune(now);

    const remaining = Math.max(0, max - bucket.length);
    const retryAfterMs = bucket.length > max ? Math.max(1, windowMs - (now - bucket[0])) : 0;
    return { allowed: bucket.length <= max, remaining, retryAfterMs };
  }

  return { consume };
}

/**
 * Resolve the best-effort client IP address from a request.
 * @param {import('express').Request} req Express request object.
 * @returns {string} Forwarded or direct IP address.
 */
function getRequestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Build the user-or-IP key for HTTP rate limiting.
 * @param {import('express').Request} req Express request object.
 * @returns {string} User key for authenticated requests, otherwise IP key.
 */
function resolveRequestKey(req) {
  const userId = req.user?.id || req.session?.userId || '';
  return userId ? `user:${userId}` : `ip:${getRequestIp(req)}`;
}

/**
 * Create Express middleware for a sliding-window in-memory limiter.
 * @param {{windowMs: number, max: number, keyGenerator?: (req: import('express').Request) => string|Promise<string>, errorCode?: string}} options Rate-limit options.
 * @returns {import('express').RequestHandler} Express middleware.
 */
function createExpressRateLimit({ windowMs, max, keyGenerator = resolveRequestKey, errorCode = 'rate_limited' }) {
  const store = createWindowStore();

  return async function expressRateLimit(req, res, next) {
    try {
      const key = await Promise.resolve(keyGenerator(req));
      const result = store.consume(key, windowMs, max);
      if (result.allowed) return next();

      res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(429).json({ error: errorCode });
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Create a Socket.IO event limiter using the same sliding-window model.
 * @param {{windowMs: number, max: number}} options Rate-limit options.
 * @returns {(socket: import('socket.io').Socket, scope?: string) => {allowed: boolean, remaining: number, retryAfterMs: number}} Socket consume helper.
 */
function createSocketRateLimiter({ windowMs, max }) {
  const store = createWindowStore();

  return function socketRateLimit(socket, scope = 'default') {
    const userId = socket.request?.user?.id || socket.request?.session?.userId || '';
    const ip = socket.handshake?.address || socket.conn?.remoteAddress || 'unknown';
    const key = `${scope}:${userId ? `user:${userId}` : `ip:${ip}`}`;
    return store.consume(key, windowMs, max);
  };
}

module.exports = {
  createExpressRateLimit,
  createSocketRateLimiter,
  createWindowStore,
  getRequestIp,
  resolveRequestKey
};
