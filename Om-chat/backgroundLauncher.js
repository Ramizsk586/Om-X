const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const serverEntry = path.join(__dirname, 'server', 'index.js');
const ngrokHelperEntry = path.join(__dirname, 'scripts', 'run-with-ngrok.js');
const pidFile = path.join(__dirname, '.background-server.pid');
const urlFile = path.join(__dirname, '.background-server.url');
const ngrokPidFile = path.join(__dirname, '.background-ngrok.pid');

function writePid() {
  try { fs.writeFileSync(pidFile, String(process.pid), 'utf-8'); } catch (_) {}
}

function writeNgrokPid(pid) {
  try { fs.writeFileSync(ngrokPidFile, String(pid), 'utf-8'); } catch (_) {}
}

function cleanupFiles() {
  try { if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile); } catch (_) {}
  try { if (fs.existsSync(urlFile)) fs.unlinkSync(urlFile); } catch (_) {}
  try { if (fs.existsSync(ngrokPidFile)) fs.unlinkSync(ngrokPidFile); } catch (_) {}
}

function writeUrl(url) {
  try { fs.writeFileSync(urlFile, String(url || ''), 'utf-8'); } catch (_) {}
}

async function startNgrokTunnel(port) {
  const ngrok = require(ngrokHelperEntry);
  const settings = ngrok.resolveNgrokSettings(process.env);

  const existingUrl = await ngrok.fetchNgrokPublicUrl({
    apiUrl: settings.apiUrl,
    port,
    requirePortMatch: true
  }).catch(() => '');

  if (existingUrl) {
    return existingUrl;
  }

  const child = ngrok.startNgrokProcess({
    port,
    cwd: __dirname,
    settings,
    onLog: (label, message) => {
      console.log(`[ngrok:${label}] ${message}`);
    }
  });

  writeNgrokPid(child.pid);

  child.once('exit', () => {
    try { if (fs.existsSync(ngrokPidFile)) fs.unlinkSync(ngrokPidFile); } catch (_) {}
  });

  const publicUrl = await ngrok.discoverNgrokPublicUrl({
    child,
    settings,
    port,
    requirePortMatch: true
  });

  return publicUrl;
}

async function main() {
  const config = JSON.parse(process.argv[2] || '{}');
  const port = Number(config.port) || 3031;
  const host = String(config.host || '0.0.0.0').trim() || '0.0.0.0';
  const useNgrok = config.useNgrok === true;

  if (config.localDbPath) {
    process.env.DB_MODE = 'local';
    process.env.LOCAL_DB_PATH = config.localDbPath;
  } else {
    process.env.DB_MODE = 'local';
  }

  process.env.TRUST_PROXY = useNgrok ? '1' : '0';

  writePid();

  let serverRef = null;

  const shutdown = async () => {
    try {
      if (serverRef) await serverRef.stopServer();
    } catch (_) {}
    cleanupFiles();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('exit', () => { cleanupFiles(); });

  try {
    serverRef = require(serverEntry);
    await serverRef.startServer({
      host,
      port,
      sessionSecret: config.sessionSecret || 'omx-omchat-dev-secret',
      trustProxy: useNgrok ? 1 : undefined
    });

    let publicUrl = '';

    if (useNgrok) {
      try {
        publicUrl = await startNgrokTunnel(port);
        if (publicUrl) {
          serverRef.setPublicBaseUrl?.(publicUrl);
        }
      } catch (ngrokErr) {
        console.error('[OmChat BG] ngrok failed:', ngrokErr?.message);
      }
    }

    const finalUrl = publicUrl || `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`;
    writeUrl(finalUrl);

    process.send?.({ success: true, url: finalUrl, publicUrl });
  } catch (error) {
    cleanupFiles();
    process.send?.({ success: false, error: error?.message || String(error) });
    process.exit(1);
  }
}

main().catch((error) => {
  cleanupFiles();
  process.send?.({ success: false, error: error?.message || String(error) });
  process.exit(1);
});
