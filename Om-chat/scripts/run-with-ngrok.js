const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execFile } = require('child_process');
require('../loadEnv');

const { startServer, stopServer, setPublicBaseUrl } = require('../server/index');

const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_POLL_ATTEMPTS = 30;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/[\\/]+$/, '');
}

function extractNgrokTunnelAddr(tunnel) {
  return String(tunnel?.config?.addr || tunnel?.forwards_to || tunnel?.addr || '').trim();
}

function extractNgrokTunnelPort(tunnel) {
  const address = extractNgrokTunnelAddr(tunnel);
  if (!address) return null;

  const match = address.match(/:(\d+)(?:\/?$|\b)/);
  if (!match) return null;

  const port = Number(match[1]);
  return Number.isInteger(port) && port > 0 ? port : null;
}

function isHttpsTunnel(tunnel) {
  return String(tunnel?.public_url || '').trim().toLowerCase().startsWith('https://');
}

function pickNgrokTunnel(tunnels, { port = null, requirePortMatch = false } = {}) {
  const safePort = Number(port);
  const list = Array.isArray(tunnels) ? tunnels : [];
  const matching = Number.isInteger(safePort) && safePort > 0
    ? list.filter((tunnel) => extractNgrokTunnelPort(tunnel) === safePort)
    : list;

  const pool = matching.length ? matching : (requirePortMatch ? [] : list);
  if (!pool.length) return null;

  return pool.find((tunnel) => isHttpsTunnel(tunnel))
    || pool.find((tunnel) => String(tunnel?.public_url || '').trim())
    || null;
}

async function fetchNgrokPublicUrl({
  apiUrl,
  port = null,
  requirePortMatch = false
} = {}) {
  const response = await fetch(apiUrl, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) return '';

  const payload = await response.json();
  const tunnel = pickNgrokTunnel(payload?.tunnels, { port, requirePortMatch });
  return tunnel?.public_url ? trimTrailingSlash(tunnel.public_url) : '';
}

function getNgrokRecentLogText(child) {
  return Array.isArray(child?.omxRecentLogs)
    ? child.omxRecentLogs.map((entry) => String(entry?.message || '').trim()).filter(Boolean).join(' ')
    : '';
}

function isNgrokAlreadyOnline(child) {
  return /ERR_NGROK_334|already online|pooling-enabled/i.test(getNgrokRecentLogText(child));
}

function resolveBundledNgrokPath() {
  const exeName = process.platform === 'win32' ? 'ngrok.exe' : 'ngrok';
  const devPath = path.resolve(__dirname, '..', '..', 'bin', exeName);
  const prodPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'bin', exeName)
    : '';
  const isDev = !process.resourcesPath;

  // ✅ FIXED: When packaged, ALWAYS prefer prodPath (resources/bin/ngrok.exe on disk).
  // The old code did `isDev || fs.existsSync(devPath)` which returned true even for
  // asar-virtual paths, causing spawn to fail with ENOENT in the installed app.
  const preferDev = isDev;
  const primary = preferDev ? devPath : prodPath;
  const secondary = preferDev ? prodPath : devPath;
  const resolved = (primary && fs.existsSync(primary))
    ? primary
    : ((secondary && fs.existsSync(secondary)) ? secondary : (primary || secondary));

  return { isDev, devPath, prodPath, resolved };
}

function resolveNgrokSettings(env = process.env) {
  const pollIntervalMs = Number(env.NGROK_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);
  const pollAttempts = Number(env.NGROK_POLL_ATTEMPTS || DEFAULT_POLL_ATTEMPTS);
  const bundled = resolveBundledNgrokPath();
  const envBin = stripWrappingQuotes(env.NGROK_BIN || '');
  const resolvedBin = envBin || bundled.resolved;

  return {
    bin: String(resolvedBin || '').trim(),
    apiUrl: String(env.NGROK_API_URL || 'http://localhost:4040/api/tunnels').trim() || 'http://localhost:4040/api/tunnels',
    authtoken: String(env.NGROK_AUTHTOKEN || '').trim(),
    domain: String(env.NGROK_DOMAIN || '').trim(),
    region: String(env.NGROK_REGION || '').trim(),
    pollIntervalMs: Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : DEFAULT_POLL_INTERVAL_MS,
    pollAttempts: Number.isFinite(pollAttempts) && pollAttempts > 0 ? pollAttempts : DEFAULT_POLL_ATTEMPTS,
    bundled
  };
}

function buildNgrokArgs(port, settings = resolveNgrokSettings()) {
  const args = ['http', `http://localhost:${Number(port)}`];

  if (settings.authtoken) args.push(`--authtoken=${settings.authtoken}`);
  if (settings.domain) args.push(`--domain=${settings.domain}`);
  if (settings.region) args.push(`--region=${settings.region}`);

  return args;
}

function stripWrappingQuotes(value) {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '');
}

function isWindowsAppsAliasPath(targetPath) {
  const normalized = String(targetPath || '');
  return /\\WindowsApps\\.+\.exe$/i.test(normalized);
}

function resolveCommandPath(command) {
  const normalized = stripWrappingQuotes(command);
  if (!normalized) return '';

  if (/[\\/]/.test(normalized) || path.isAbsolute(normalized)) {
    if (fs.existsSync(normalized)) return normalized;
    if (process.platform === 'win32' && isWindowsAppsAliasPath(normalized)) {
      return normalized;
    }
    return '';
  }

  const probe = process.platform === 'win32'
    ? spawnSync('where.exe', [normalized], { encoding: 'utf8', windowsHide: true })
    : spawnSync('which', [normalized], { encoding: 'utf8' });

  if (probe.status !== 0) {
    return '';
  }

  const matches = String(probe.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (process.platform === 'win32') {
    const preferredMatch = matches.find((item) => /\.(exe|cmd|bat|com)$/i.test(item))
      || matches.find((item) => fs.existsSync(`${item}.cmd`) || fs.existsSync(`${item}.exe`))
      || matches[0];

    if (preferredMatch && !/\.(exe|cmd|bat|com)$/i.test(preferredMatch)) {
      if (fs.existsSync(`${preferredMatch}.cmd`)) return `${preferredMatch}.cmd`;
      if (fs.existsSync(`${preferredMatch}.exe`)) return `${preferredMatch}.exe`;
    }

    return preferredMatch || normalized;
  }

  return matches[0] || normalized;
}

function commandExists(command) {
  return Boolean(resolveCommandPath(command));
}

function resolveNgrokLaunch(port, {
  settings = resolveNgrokSettings(),
  env = process.env
} = {}) {
  const ngrokArgs = buildNgrokArgs(port, settings);
  const preferredBin = stripWrappingQuotes(settings.bin);
  const bundledBin = stripWrappingQuotes(settings?.bundled?.resolved || '');
  const candidates = [];
  const bundledMeta = settings?.bundled || {};

  const addCandidate = (targetBin, source) => {
    const normalizedTarget = stripWrappingQuotes(targetBin);
    if (!normalizedTarget) return;

    const resolvedTarget = resolveCommandPath(normalizedTarget) || '';
    if (!(resolvedTarget || commandExists(normalizedTarget))) return;

    const command = resolvedTarget || normalizedTarget;
    if (candidates.some((item) => stripWrappingQuotes(item.command) === stripWrappingQuotes(command))) {
      return;
    }

    candidates.push({
      command,
      args: ngrokArgs,
      label: normalizedTarget,
      source
    });
  };

  if (preferredBin) {
    addCandidate(preferredBin, preferredBin === bundledMeta.resolved ? 'bundled' : 'bin');
  }

  // If NGROK_BIN points to a bad location, still allow fallback to bundled ngrok.
  if (bundledBin && stripWrappingQuotes(preferredBin) !== bundledBin) {
    addCandidate(bundledBin, 'bundled');
  }

  for (const candidate of candidates) {
    if (commandExists(candidate.command)) {
      return candidate;
    }
  }

  const installHint = preferredBin
    ? `Set NGROK_BIN to a valid ngrok executable path (or remove it to use bundled ngrok). Current value: ${preferredBin}`
    : `Bundled ngrok executable was not found. Expected at: ${bundledMeta.resolved || '(unknown)'}`;

  throw new Error(`ngrok executable was not found. ${installHint}`);
}

function pipeNgrokLogs(stream, label, onLog) {
  if (!stream || typeof onLog !== 'function') return;

  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      const message = line.trim();
      if (message) {
        onLog(label, message);
      }
    }
  });
}

function quoteWindowsCmdArg(value) {
  const next = String(value || '');
  if (!next) return '""';
  if (!/[\s"&()\[\]{}^=;!'+,`~]/.test(next)) return next;
  return `"${next.replace(/"/g, '""')}"`;
}

function startNgrokProcess({
  port,
  cwd = path.resolve(__dirname, '..'),
  settings = resolveNgrokSettings(),
  env = process.env,
  onLog = (label, message) => console.log(`[ngrok:${label}] ${message}`)
} = {}) {
  const safePort = Number(port);
  if (!Number.isFinite(safePort) || safePort <= 0) {
    throw new Error('A valid port is required to start ngrok.');
  }

  const launch = resolveNgrokLaunch(safePort, { settings, env });
  console.log('[Om Chat] Using ngrok path:', launch.command);
  if (/[\\/]/.test(String(launch.command || '')) && !fs.existsSync(launch.command)) {
    throw new Error(`ngrok binary not found at: ${launch.command}`);
  }
  const spawnOptions = {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env
  };
  const needsCmdShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(String(launch.command || ''));
  const commandLine = needsCmdShim
    ? `""${String(launch.command || '').replace(/"/g, '""')}" ${launch.args.map((arg) => quoteWindowsCmdArg(arg)).join(' ')}"`
    : '';
  const recentLogs = [];
  const forwardLog = (label, message) => {
    recentLogs.push({ label, message });
    if (recentLogs.length > 12) {
      recentLogs.shift();
    }
    onLog(label, message);
  };
  const child = needsCmdShim
    ? spawn(process.env.ComSpec || 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      commandLine
    ], {
      ...spawnOptions,
      windowsVerbatimArguments: true
    })
    : spawn(launch.command, launch.args, spawnOptions);

  child.omxCommandLabel = launch.label;
  child.omxLaunchSource = launch.source;
  child.omxRecentLogs = recentLogs;
  pipeNgrokLogs(child.stdout, 'out', forwardLog);
  pipeNgrokLogs(child.stderr, 'err', forwardLog);
  return child;
}

async function discoverNgrokPublicUrl({
  child = null,
  settings = resolveNgrokSettings(),
  apiUrl = settings.apiUrl,
  pollIntervalMs = settings.pollIntervalMs,
  pollAttempts = settings.pollAttempts,
  port = null,
  requirePortMatch = false
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      if (!child) return;
      child.off('error', handleError);
      child.off('exit', handleExit);
    };

    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error || 'ngrok failed')));
    };

    const handleError = (error) => {
      finishReject(error || new Error('ngrok failed to start'));
    };

    const handleExit = (code, signal) => {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      const recentOutput = Array.isArray(child?.omxRecentLogs)
        ? child.omxRecentLogs.map((entry) => String(entry?.message || '').trim()).filter(Boolean).join(' ')
        : '';
      if (/ERR_NGROK_4018|authtoken/i.test(recentOutput)) {
        finishReject(new Error('ngrok requires a verified account and authtoken. Run "ngrok config add-authtoken YOUR_TOKEN" and try again.'));
        return;
      }
      finishReject(new Error(`ngrok exited before the public URL was ready (${reason})`));
    };

    if (child) {
      child.once('error', handleError);
      child.once('exit', handleExit);
    }

    (async () => {
      for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
        try {
          const response = await fetch(apiUrl, {
            headers: { Accept: 'application/json' }
          });

          if (response.ok) {
            const payload = await response.json();
            const tunnel = pickNgrokTunnel(payload?.tunnels, { port, requirePortMatch });
            if (tunnel?.public_url) {
              finishResolve(trimTrailingSlash(tunnel.public_url));
              return;
            }
          }
        } catch (_) {}

        await delay(pollIntervalMs);
      }
      finishResolve('');
    })().catch(finishReject);
  });
}

async function stopNgrokProcess(child) {
  if (!child) return false;

  child.omxManualStop = true;

  if (child.exitCode != null || child.killed) {
    return true;
  }

  if (process.platform === 'win32' && child.pid) {
    await new Promise((resolve) => {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve());
    });
    return true;
  }

  await new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    child.once('exit', finish);
    try {
      child.kill();
    } catch (_) {
      child.off('exit', finish);
      finish();
      return;
    }

    setTimeout(() => {
      child.off('exit', finish);
      finish();
    }, 1500);
  });

  return true;
}

async function runWithNgrok({
  log = console.log,
  errorLog = console.error
} = {}) {
  process.env.HOST = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
  if (!process.env.TRUST_PROXY) {
    process.env.TRUST_PROXY = '1';
  }

  const status = await startServer();
  const accessInfo = status.accessInfo || {};
  const settings = resolveNgrokSettings(process.env);

  log('[Om Chat] Local server ready');
  log(`[Om Chat] Local:  ${accessInfo.localUrl}`);
  if (accessInfo.networkUrl) {
    log(`[Om Chat] LAN:    ${accessInfo.networkUrl}`);
  }

  const existingPublicUrl = await fetchNgrokPublicUrl({
    apiUrl: settings.apiUrl,
    port: status.port,
    requirePortMatch: true
  }).catch(() => '');

  if (existingPublicUrl) {
    const updatedStatus = setPublicBaseUrl(existingPublicUrl);
    const updatedAccess = updatedStatus.accessInfo || accessInfo;
    log(`[Om Chat] Reusing existing ngrok tunnel: ${updatedAccess.publicUrl}`);
    log('[Om Chat] Server is ready for local and internet testing. Press Ctrl+C to stop.');
    return {
      ngrokProcess: null,
      publicUrl: updatedAccess.publicUrl || existingPublicUrl,
      status: updatedStatus,
      reusedExistingTunnel: true
    };
  }

  const ngrokProcess = startNgrokProcess({
    port: status.port,
    settings,
    onLog: (label, message) => log(`[ngrok:${label}] ${message}`)
  });

  log(`[Om Chat] Starting ngrok via: ${ngrokProcess.omxCommandLabel || settings.bin}`);

  const publicUrl = await discoverNgrokPublicUrl({ child: ngrokProcess, settings, port: status.port, requirePortMatch: true });
  if (!publicUrl) {
    await stopNgrokProcess(ngrokProcess);
    throw new Error(`ngrok tunnel was not discovered. Checked ${settings.apiUrl}`);
  }

  const updatedStatus = setPublicBaseUrl(publicUrl);
  const updatedAccess = updatedStatus.accessInfo || accessInfo;
  log(`[Om Chat] Public: ${updatedAccess.publicUrl}`);
  log('[Om Chat] Server is ready for local and internet testing. Press Ctrl+C to stop.');

  return {
    ngrokProcess,
    publicUrl: updatedAccess.publicUrl || publicUrl,
    status: updatedStatus
  };
}

if (require.main === module) {
  let currentNgrokProcess = null;
  let shuttingDown = false;

  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    try {
      await stopNgrokProcess(currentNgrokProcess);
    } catch (_) {}

    try {
      await stopServer();
    } catch (_) {}

    process.exit(exitCode);
  };

  process.on('SIGINT', () => { void shutdown(0); });
  process.on('SIGTERM', () => { void shutdown(0); });
  process.on('uncaughtException', async (error) => {
    console.error(error?.stack || error?.message || String(error));
    await shutdown(1);
  });
  process.on('unhandledRejection', async (error) => {
    console.error(error?.stack || error?.message || String(error));
    await shutdown(1);
  });

  runWithNgrok().then(({ ngrokProcess }) => {
    currentNgrokProcess = ngrokProcess;
    if (!ngrokProcess) {
      return;
    }
    ngrokProcess.once('error', async (error) => {
      if (shuttingDown) return;
      console.error('[Om Chat] Failed to start ngrok:', error?.message || error);
      console.error('[Om Chat] Install ngrok on this device and add it to PATH, or set NGROK_BIN to the ngrok executable path.');
      await shutdown(1);
    });
    ngrokProcess.once('exit', async (code, signal) => {
      if (shuttingDown) return;
      if (isNgrokAlreadyOnline(ngrokProcess)) {
        currentNgrokProcess = null;
        console.log('[Om Chat] Reusing the already-running ngrok endpoint.');
        return;
      }
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      console.error(`[Om Chat] ngrok stopped unexpectedly (${reason}).`);
      await shutdown(typeof code === 'number' && code > 0 ? code : 1);
    });
  }).catch(async (error) => {
    console.error(error?.stack || error?.message || String(error));
    await shutdown(1);
  });
}

module.exports = {
  resolveNgrokSettings,
  buildNgrokArgs,
  commandExists,
  resolveNgrokLaunch,
  startNgrokProcess,
  discoverNgrokPublicUrl,
  fetchNgrokPublicUrl,
  getNgrokRecentLogText,
  isNgrokAlreadyOnline,
  stopNgrokProcess,
  runWithNgrok
};
