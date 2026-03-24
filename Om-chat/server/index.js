const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const appConfig = require('./config');
const createSession = require('./middleware/session');
const deviceAuthMiddleware = require('./middleware/deviceAuth');
const { createAccessMiddleware, authorizeSocket, readAccessConfig } = require('./middleware/accessControl');
const { createExpressRateLimit } = require('./middleware/rateLimit');
const { ValidationError } = require('./utils/validation');
const { sanitizeAccessInfo } = require('./utils/serializers');
const { initDb } = require('./db');
const connectMongo = require('./db/mongo');

const { authApiRouter, authCompatibilityRouter } = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const serverRoutes = require('./routes/servers');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');
const dmRoutes = require('./routes/dm');
const uploadRoutes = require('./routes/uploads');

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3031;
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const API_RATE_LIMIT_WINDOW_MS = Math.max(5000, Number(process.env.API_RATE_LIMIT_WINDOW_MS || appConfig.rateLimit.api.windowMs));
const API_RATE_LIMIT_MAX = Math.max(30, Number(process.env.API_RATE_LIMIT_MAX || appConfig.rateLimit.api.max));
const UPLOAD_RATE_LIMIT_WINDOW_MS = Math.max(5000, Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 60000));
const UPLOAD_RATE_LIMIT_MAX = Math.max(5, Number(process.env.UPLOAD_RATE_LIMIT_MAX || 20));

let runtime = null;

function firstDefinedValue(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    return value;
  }
  return null;
}

function readEnv(...names) {
  return firstDefinedValue(...names.map((name) => process.env[name]));
}

function parseBooleanFlag(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase());
}

function parsePort(value, fallback) {
  if (value == null || value === '') return fallback;

  const port = Number(value);
  if (Number.isInteger(port) && port >= 0 && port <= 65535) {
    return port;
  }

  throw new Error(`Invalid port: ${value}`);
}

function resolveAppPath(filePath) {
  const targetPath = String(filePath || '').trim();
  if (!targetPath) return '';
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(__dirname, '..', targetPath);
}

function isPrivateIpv4(address) {
  if (/^10\./.test(address)) return true;
  if (/^192\.168\./.test(address)) return true;

  const match = address.match(/^172\.(\d+)\./);
  if (!match) return false;

  const octet = Number(match[1]);
  return octet >= 16 && octet <= 31;
}

function interfaceScore(name) {
  const label = String(name || '').toLowerCase();
  let score = 0;

  if (/(wi-?fi|wireless|wlan)/.test(label)) score += 100;
  if (/(ethernet|local area connection|lan)/.test(label)) score += 80;
  if (/(virtual|vmware|hyper-v|default switch|docker|wsl|loopback|bluetooth|tailscale|zerotier|vethernet|hamachi|tun)/.test(label)) score -= 200;

  return score;
}

function getLanCandidates() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [name, entries] of Object.entries(nets)) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4') continue;
      if (entry.address.startsWith('169.254.')) continue;

      candidates.push({
        name,
        address: entry.address,
        score: interfaceScore(name) + (isPrivateIpv4(entry.address) ? 50 : 0)
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));
  return candidates;
}

function getPrimaryNetworkIp() {
  return getLanCandidates()[0]?.address || '';
}

function addressMatchesPort(address, port) {
  const value = String(address || '').trim();
  return Boolean(value) && value.endsWith(`:${Number(port)}`);
}

function getListeningPidsForPortWindows(port) {
  const probe = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
    encoding: 'utf8',
    windowsHide: true
  });

  if (probe.status !== 0) return [];

  const pids = new Set();
  const lines = String(probe.stdout || '').split(/\r?\n/);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    if (String(parts[0] || '').toUpperCase() !== 'TCP') continue;
    if (!addressMatchesPort(parts[1], port)) continue;
    if (String(parts[3] || '').toUpperCase() !== 'LISTENING') continue;

    const pid = Number(parts[4]);
    if (Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function getListeningPidsForPortPosix(port) {
  const probe = spawnSync('lsof', ['-nP', `-iTCP:${Number(port)}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8'
  });

  if (probe.status !== 0) return [];

  return String(probe.stdout || '')
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function getListeningPidsForPort(port) {
  const safePort = Number(port);
  if (!Number.isInteger(safePort) || safePort <= 0 || safePort > 65535) return [];
  return process.platform === 'win32'
    ? getListeningPidsForPortWindows(safePort)
    : getListeningPidsForPortPosix(safePort);
}

function terminatePid(pid) {
  const safePid = Number(pid);
  if (!Number.isInteger(safePid) || safePid <= 0 || safePid === process.pid) return false;

  const probe = spawnSync(
    process.platform === 'win32' ? 'taskkill' : 'kill',
    process.platform === 'win32' ? ['/PID', String(safePid), '/T', '/F'] : ['-9', String(safePid)],
    {
      stdio: 'ignore',
      windowsHide: true
    }
  );

  return probe.status === 0;
}

async function ensurePortIsAvailable(port) {
  const conflictingPids = getListeningPidsForPort(port).filter((pid) => pid !== process.pid && pid > 4);
  if (!conflictingPids.length) return [];

  for (const pid of conflictingPids) {
    terminatePid(pid);
  }

  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const remainingPids = getListeningPidsForPort(port).filter((pid) => pid !== process.pid && pid > 4);
    if (!remainingPids.length) {
      return conflictingPids;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const remainingPids = getListeningPidsForPort(port).filter((pid) => pid !== process.pid && pid > 4);
  if (remainingPids.length) {
    throw new Error(`Port ${port} is still in use after terminating PID ${remainingPids.join(', ')}`);
  }

  return conflictingPids;
}

function normalizeBaseUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  return value.replace(/[\\/]+$/, '');
}

function normalizeOrigin(origin) {
  try {
    return new URL(String(origin || '').trim()).origin;
  } catch (_) {
    return '';
  }
}

function readForwardedHeader(value) {
  return String(value || '').split(',')[0].trim();
}

function buildRequestOrigin(headers = {}, fallbackProtocol = 'http') {
  const protocol = readForwardedHeader(headers['x-forwarded-proto']) || fallbackProtocol || 'http';
  const host = readForwardedHeader(headers['x-forwarded-host']) || readForwardedHeader(headers.host);
  return host ? normalizeOrigin(`${protocol}://${host}`) : '';
}

function syncAccessInfoOrigin(accessInfo, origin) {
  const normalized = normalizeOrigin(origin);
  if (!accessInfo || !normalized) return normalized;

  const localOrigin = normalizeOrigin(accessInfo.localUrl);
  const networkOrigin = normalizeOrigin(accessInfo.networkUrl);
  if (normalized !== localOrigin && normalized !== networkOrigin) {
    accessInfo.publicUrl = normalized;
    accessInfo.joinBaseUrl = normalized;
  }

  return normalized;
}

function rememberAllowedOrigin(allowedOrigins, origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return '';
  if (allowedOrigins instanceof Set) {
    allowedOrigins.add(normalized);
  }
  return normalized;
}

function getRequestOrigin(req) {
  return buildRequestOrigin(req?.headers || {}, req?.protocol || (req?.socket?.encrypted ? 'https' : 'http'));
}

function getRequestBaseUrl(req, accessInfo = null) {
  return getRequestOrigin(req) || normalizeBaseUrl(accessInfo?.joinBaseUrl || accessInfo?.publicUrl || accessInfo?.localUrl || '');
}

function rememberRequestOrigin(req, allowedOrigins, accessInfo = null) {
  const currentOrigin = getRequestOrigin(req);
  if (!currentOrigin) return '';

  const origin = normalizeOrigin(req.get?.('origin') || '');
  const referer = normalizeOrigin(req.get?.('referer') || '');
  if ((origin && origin !== currentOrigin) || (referer && referer !== currentOrigin)) {
    return currentOrigin;
  }

  rememberAllowedOrigin(allowedOrigins, currentOrigin);
  syncAccessInfoOrigin(accessInfo, currentOrigin);
  return currentOrigin;
}

function getSocketRequestOrigin(socket) {
  return buildRequestOrigin(socket?.handshake?.headers || {}, socket?.request?.socket?.encrypted ? 'https' : 'http');
}

function rememberSocketOrigin(socket, allowedOrigins, accessInfo = null) {
  const currentOrigin = getSocketRequestOrigin(socket);
  if (!currentOrigin) return '';

  const origin = normalizeOrigin(socket?.handshake?.headers?.origin || '');
  if (origin && origin !== currentOrigin) {
    return currentOrigin;
  }

  rememberAllowedOrigin(allowedOrigins, currentOrigin);
  syncAccessInfoOrigin(accessInfo, currentOrigin);
  return currentOrigin;
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPreferredPublicBaseUrl(config = {}) {
  return normalizeBaseUrl(firstDefinedValue(config.publicBaseUrl, readEnv('PUBLIC_BASE_URL')) || '');
}

function getAccessInfo(host, port, protocol = 'http', publicBaseUrl = '') {
  const normalizedHost = String(host || DEFAULT_HOST).trim() || DEFAULT_HOST;
  const isWildcardHost = ['0.0.0.0', '::'].includes(normalizedHost);
  const isLoopbackHost = ['127.0.0.1', 'localhost', '::1'].includes(normalizedHost);
  const localHost = (isWildcardHost || isLoopbackHost) ? 'localhost' : normalizedHost;
  const localUrl = `${protocol}://${localHost}:${port}`;
  const normalizedPublicBaseUrl = normalizeBaseUrl(publicBaseUrl || '');

  const candidates = getLanCandidates();
  const candidateAddresses = [...new Set(candidates.map((item) => item.address))];
  const networkIp = candidateAddresses[0] || '';
  const allowNetworkIpUrls = protocol !== 'https' && !isLoopbackHost;
  const networkUrl = allowNetworkIpUrls && networkIp ? `${protocol}://${networkIp}:${port}` : null;
  const addresses = allowNetworkIpUrls
    ? candidateAddresses.map((address) => ({
      ip: address,
      url: `${protocol}://${address}:${port}`
    }))
    : [];

  return {
    host: normalizedHost,
    port,
    protocol,
    isHttps: protocol === 'https',
    localHost,
    localUrl,
    networkIp,
    networkUrl,
    addresses,
    publicUrl: normalizedPublicBaseUrl,
    joinBaseUrl: normalizedPublicBaseUrl || localUrl
  };
}

function resolveTlsOptions() {
  const certPath = String(readEnv('SSL_CERT_PATH', 'HTTPS_CERT_PATH') || '').trim();
  const keyPath = String(readEnv('SSL_KEY_PATH', 'HTTPS_KEY_PATH') || '').trim();
  const caPath = String(readEnv('SSL_CA_PATH', 'HTTPS_CA_PATH') || '').trim();

  if (!certPath && !keyPath) return null;
  if (!certPath || !keyPath) {
    throw new Error('Both SSL_CERT_PATH and SSL_KEY_PATH are required to enable HTTPS');
  }

  const options = {
    cert: fs.readFileSync(resolveAppPath(certPath)),
    key: fs.readFileSync(resolveAppPath(keyPath))
  };

  if (caPath) {
    options.ca = fs.readFileSync(resolveAppPath(caPath));
  }

  return options;
}

function resolveTrustProxySetting(tlsOptions, config = {}) {
  const explicit = firstDefinedValue(config.trustProxy, readEnv('TRUST_PROXY'));
  if (explicit == null || explicit === '') {
    return tlsOptions || /^https:/i.test(getPreferredPublicBaseUrl(config)) ? 1 : false;
  }

  if (typeof explicit === 'boolean') {
    return explicit ? 1 : false;
  }

  if (parseBooleanFlag(explicit)) {
    return 1;
  }

  return explicit;
}

function collectAllowedOrigins(accessInfo, configuredOrigins = []) {
  const origins = new Set();

  for (const value of [
    ...configuredOrigins,
    accessInfo.localUrl,
    accessInfo.networkUrl,
    accessInfo.publicUrl,
    ...accessInfo.addresses.map((item) => item.url)
  ]) {
    const normalized = normalizeOrigin(value);
    if (normalized) origins.add(normalized);
  }

  return origins;
}

function createCorsOriginHandler(getAllowedOrigins) {
  return (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (normalizedOrigin && getAllowedOrigins().has(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  };
}

function formatHostWithPort(host, port) {
  const value = String(host || '').trim();
  if (!value) return '';

  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end !== -1) {
      const base = value.slice(0, end + 1);
      return port === 443 ? base : `${base}:${port}`;
    }
  }

  const lastColon = value.lastIndexOf(':');
  if (lastColon > -1) {
    const maybePort = value.slice(lastColon + 1);
    if (/^\d+$/.test(maybePort)) {
      const base = value.slice(0, lastColon);
      return port === 443 ? base : `${base}:${port}`;
    }
  }

  return port === 443 ? value : `${value}:${port}`;
}

function buildHttpsRedirectLocation(req, host, port) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const requestHost = forwardedHost || String(req.headers.host || '').trim();
  const fallbackHost = ['0.0.0.0', '::'].includes(String(host || '').trim()) ? 'localhost' : String(host || '').trim();
  const targetHost = formatHostWithPort(requestHost || fallbackHost, port);
  return `https://${targetHost}${req.url || '/'}`;
}

function createRedirectServer({ host, httpsPort }) {
  return createHttpServer((req, res) => {
    const location = buildHttpsRedirectLocation(req, host, httpsPort);
    res.writeHead(308, {
      Location: location,
      'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end(`Redirecting to ${location}`);
  });
}

function createClientRuntimeConfig(req, accessInfo, accessProtected) {
  const currentBaseUrl = getRequestBaseUrl(req, accessInfo) || accessInfo.joinBaseUrl || accessInfo.publicUrl || accessInfo.localUrl;
  return {
    csrfToken: req.session?.csrfToken || '',
    publicBaseUrl: currentBaseUrl,
    socketPath: '/socket.io',
    accessProtected: Boolean(accessProtected)
  };
}

function isWriteMethod(method = 'GET') {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase());
}

function requestOriginAllowed(req, allowedOrigins) {
  const accessInfo = req?.app?.locals?.omChatAccess || null;
  const currentOrigin = rememberRequestOrigin(req, allowedOrigins, accessInfo);

  const origin = normalizeOrigin(req.get?.('origin') || '');
  if (origin) {
    if (origin === currentOrigin) return true;
    return allowedOrigins.has(origin);
  }

  const referer = normalizeOrigin(req.get?.('referer') || '');
  if (referer) {
    if (referer === currentOrigin) return true;
    return allowedOrigins.has(referer);
  }

  return true;
}

function ensureSessionCsrf(req, _res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  next();
}

function createCsrfProtection(getAllowedOrigins) {
  return function csrfProtection(req, res, next) {
    if (!isWriteMethod(req.method)) return next();

    const expected = req.session?.csrfToken || '';
    const received = String(req.get('x-csrf-token') || '').trim();
    if (!expected || received !== expected) {
      return res.status(403).json({ error: 'csrf_invalid' });
    }

    if (!requestOriginAllowed(req, getAllowedOrigins())) {
      return res.status(403).json({ error: 'origin_not_allowed' });
    }

    return next();
  };
}

function applyPublicBaseUrl(targetRuntime, publicBaseUrl) {
  const normalized = normalizeBaseUrl(publicBaseUrl);
  targetRuntime.accessInfo.publicUrl = normalized || '';
  targetRuntime.accessInfo.joinBaseUrl = normalized || targetRuntime.accessInfo.localUrl;
  targetRuntime.originState.allowedOrigins = collectAllowedOrigins(targetRuntime.accessInfo, targetRuntime.configuredOrigins);
  targetRuntime.app.locals.omChatAccess = targetRuntime.accessInfo;
  targetRuntime.io.omChatAccess = targetRuntime.accessInfo;
  return targetRuntime.accessInfo;
}

function createRuntime({ host, port, sessionSecret, tlsOptions, trustProxySetting, redirectPort, publicBaseUrl }) {
  const app = express();
  const protocol = tlsOptions ? 'https' : 'http';
  const configuredOrigins = parseCsv(readEnv('CORS_ALLOWED_ORIGINS', 'CORS_ORIGIN'));
  const accessInfo = getAccessInfo(host, port, protocol, publicBaseUrl);
  const originState = {
    allowedOrigins: collectAllowedOrigins(accessInfo, configuredOrigins)
  };
  const corsOrigin = createCorsOriginHandler(() => originState.allowedOrigins);
  const accessConfig = readAccessConfig();

  if (trustProxySetting) app.set('trust proxy', trustProxySetting);
  app.disable('x-powered-by');

  const httpServer = tlsOptions
    ? createHttpsServer(tlsOptions, app)
    : createHttpServer(app);

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  app.set('io', io);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' }
  }));
  app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
  }));
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  const secureCookies = Boolean(tlsOptions) || appConfig.session.secure || parseBooleanFlag(readEnv('COOKIE_SECURE'));
  const sessionMiddleware = createSession(sessionSecret, { secureCookies, name: appConfig.session.name, maxAge: appConfig.session.maxAgeMs });
  app.use(sessionMiddleware);
  app.use(ensureSessionCsrf);
  app.use((req, _res, next) => {
    rememberRequestOrigin(req, originState.allowedOrigins, accessInfo);
    next();
  });
  app.use(createAccessMiddleware(accessConfig));
  app.use(deviceAuthMiddleware);
  app.use(createCsrfProtection(() => originState.allowedOrigins));

  const apiLimiter = createExpressRateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    max: API_RATE_LIMIT_MAX,
    errorCode: 'api_rate_limited'
  });
  const uploadLimiter = createExpressRateLimit({
    windowMs: UPLOAD_RATE_LIMIT_WINDOW_MS,
    max: UPLOAD_RATE_LIMIT_MAX,
    errorCode: 'upload_rate_limited'
  });

  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });
  io.use((socket, next) => {
    if (!authorizeSocket(socket, accessConfig)) {
      return next(new Error('unauthorized'));
    }

    const origin = normalizeOrigin(socket.handshake?.headers?.origin || '');
    const currentOrigin = rememberSocketOrigin(socket, originState.allowedOrigins, io.omChatAccess || accessInfo);
    if (origin && origin !== currentOrigin && !originState.allowedOrigins.has(origin)) {
      return next(new Error('origin_not_allowed'));
    }

    const expectedCsrf = socket.request?.session?.csrfToken || '';
    const receivedCsrf = String(socket.handshake?.auth?.csrfToken || '').trim();
    const hasAlternateAuth = Boolean(socket.request?.session?.userId || socket.handshake?.auth?.token || socket.handshake?.auth?.deviceToken);
    if (expectedCsrf && receivedCsrf !== expectedCsrf) {
      return next(new Error('csrf_invalid'));
    }
    if (!expectedCsrf && !hasAlternateAuth) {
      return next(new Error('csrf_invalid'));
    }

    return next();
  });

  app.locals.omChatAccess = accessInfo;
  app.locals.omChatAccessProtected = Boolean((accessConfig.username && accessConfig.password) || accessConfig.token);
  io.omChatAccess = accessInfo;

  app.get('/client-config.js', (req, res) => {
    const payload = createClientRuntimeConfig(req, accessInfo, app.locals.omChatAccessProtected);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.type('application/javascript');
    res.send(`window.__OMCHAT_RUNTIME__ = ${JSON.stringify(payload)};`);
  });

  app.get('/api/runtime', (req, res) => {
    const currentBaseUrl = getRequestBaseUrl(req, accessInfo);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      runtime: createClientRuntimeConfig(req, accessInfo, app.locals.omChatAccessProtected),
      access: sanitizeAccessInfo(accessInfo, {
        joinBaseUrl: currentBaseUrl,
        publicUrl: currentBaseUrl
      })
    });
  });

  app.use('/uploads', uploadRoutes);
  app.use('/gif-pack', express.static(path.join(__dirname, '..', 'gif-pack'), { fallthrough: false, dotfiles: 'ignore', maxAge: '1h' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), {
    setHeaders(res, filePath) {
      if (String(filePath || '').toLowerCase().endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
    }
  }));

  app.use('/api/upload', uploadLimiter);
  app.use('/api', apiLimiter);
  app.use('/api/auth', authCompatibilityRouter);
  app.use('/api/device', deviceRoutes);
  app.use('/api', authApiRouter);
  app.use('/api/servers', serverRoutes);
  app.use('/api/channels', channelRoutes);
  app.use('/api/dm', dmRoutes);
  app.use('/api', messageRoutes);

  app.get('/app.html', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
  });

  app.get('/e2e-setup.html', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'e2e-setup.html'));
  });

  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error instanceof ValidationError) {
      return res.status(error.status || 400).json({ error: error.code || 'invalid_request' });
    }

    if (error?.message === 'Origin not allowed by CORS') {
      return res.status(403).json({ error: 'origin_not_allowed' });
    }

    console.error('[Om Chat] Request failed:', error?.stack || error?.message || String(error));

    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: 'server_error' });
    }

    return res.status(500).send('Internal Server Error');
  });

  require('./sockets/chat')(io);

  return {
    app,
    httpServer,
    redirectServer: tlsOptions && redirectPort != null ? createRedirectServer({ host, httpsPort: port }) : null,
    redirectPort,
    io,
    accessInfo,
    originState,
    configuredOrigins,
    accessConfig,
    host,
    port
  };
}

function getStatus() {
  if (!runtime) {
    return {
      isRunning: false,
      host: null,
      port: null,
      redirectPort: null,
      accessInfo: null
    };
  }

  return {
    isRunning: true,
    host: runtime.host,
    port: runtime.port,
    redirectPort: runtime.redirectPort || null,
    accessInfo: runtime.accessInfo
  };
}

async function listenServer(server, port, host) {
  if (!server) return;

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

async function closeServer(server) {
  if (!server) return;

  await new Promise((resolve) => {
    try {
      server.close(() => resolve());
    } catch (_) {
      resolve();
    }
  });
}

async function startServer(config = {}) {
  if (runtime) return getStatus();

  const port = parsePort(firstDefinedValue(config.port, readEnv('PORT'), DEFAULT_PORT), DEFAULT_PORT);
  const host = String(firstDefinedValue(config.host, readEnv('HOST', 'SERVE_HOST'), DEFAULT_HOST)).trim() || DEFAULT_HOST;
  const sessionSecret = String(firstDefinedValue(config.sessionSecret, readEnv('SESSION_SECRET'), appConfig.session.secret));

  if (appConfig.db.mode === 'mongo') {
    await connectMongo();
  }
  await initDb();

  const tlsOptions = resolveTlsOptions();
  const redirectEnabled = Boolean(tlsOptions) && parseBooleanFlag(firstDefinedValue(config.httpsRedirect, readEnv('HTTPS_REDIRECT')));
  const redirectPort = redirectEnabled
    ? parsePort(firstDefinedValue(config.httpPort, readEnv('HTTP_PORT', 'HTTP_REDIRECT_PORT')), null)
    : null;

  if (redirectEnabled && redirectPort == null) {
    throw new Error('Set HTTP_PORT or HTTP_REDIRECT_PORT when HTTPS_REDIRECT is enabled');
  }

  if (redirectPort != null && redirectPort === port) {
    throw new Error('HTTP redirect port must be different from the main PORT');
  }

  const clearedMainPortPids = await ensurePortIsAvailable(port);
  if (clearedMainPortPids.length) {
    console.warn(`[Om Chat] Cleared port ${port} by terminating PID ${clearedMainPortPids.join(', ')}`);
  }

  if (redirectPort != null) {
    const clearedRedirectPortPids = await ensurePortIsAvailable(redirectPort);
    if (clearedRedirectPortPids.length) {
      console.warn(`[Om Chat] Cleared redirect port ${redirectPort} by terminating PID ${clearedRedirectPortPids.join(', ')}`);
    }
  }

  const nextRuntime = createRuntime({
    host,
    port,
    sessionSecret,
    tlsOptions,
    trustProxySetting: resolveTrustProxySetting(tlsOptions, config),
    redirectPort,
    publicBaseUrl: getPreferredPublicBaseUrl(config)
  });

  await listenServer(nextRuntime.httpServer, port, host);

  try {
    await listenServer(nextRuntime.redirectServer, redirectPort, host);
  } catch (error) {
    await closeServer(nextRuntime.httpServer);
    throw error;
  }

  runtime = nextRuntime;
  return getStatus();
}

function setPublicBaseUrl(publicBaseUrl) {
  if (!runtime) return getStatus();
  applyPublicBaseUrl(runtime, publicBaseUrl);
  return getStatus();
}

async function stopServer() {
  if (!runtime) return false;

  const current = runtime;
  runtime = null;

  try {
    current.io?.close?.();
  } catch (_) {}

  await closeServer(current.redirectServer);
  await closeServer(current.httpServer);

  return true;
}

module.exports = {
  startServer,
  stopServer,
  getStatus,
  getAccessInfo,
  getPrimaryNetworkIp,
  setPublicBaseUrl
};

if (require.main === module) {
  startServer().then((status) => {
    const accessInfo = status.accessInfo;
    console.log('\n[Om Chat] Server ready');
    console.log(`[Om Chat] Local:   ${accessInfo.localUrl}`);
    if (accessInfo.publicUrl) {
      console.log(`[Om Chat] Public:  ${accessInfo.publicUrl}`);
    }
    if (status.redirectPort != null) {
      console.log(`[Om Chat] Redirect: http://${accessInfo.localHost}:${status.redirectPort} -> ${accessInfo.localUrl}`);
    }
    console.log(`[Om Chat] Listening at ${status.host}:${status.port}`);
  }).catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}








