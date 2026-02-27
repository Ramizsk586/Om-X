const BLOCKED_BUILTINS = new Set([
  'fs',
  'fs/promises',
  'child_process',
  'cluster',
  'worker_threads',
  'net',
  'tls',
  'dgram',
  'http',
  'https',
  'http2',
  'inspector',
  'module',
  'vm'
]);

const ALLOWED_BUILTINS = new Set([
  'assert',
  'buffer',
  'events',
  'os',
  'path',
  'querystring',
  'stream',
  'string_decoder',
  'timers',
  'tty',
  'url',
  'util'
]);

function sanitizeExtensionHostEnv(sourceEnv = process.env) {
  const allowedKeys = new Set([
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'TMPDIR',
    'HOME',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
    'PATH',
    'PATHEXT',
    'COMSPEC',
    'LANG'
  ]);

  const env = { NODE_ENV: 'production' };
  for (const [key, value] of Object.entries(sourceEnv || {})) {
    if (!allowedKeys.has(key)) continue;
    env[key] = value;
  }
  return env;
}

function isBuiltinAllowed(modName) {
  const name = String(modName || '').trim();
  if (!name) return false;
  if (BLOCKED_BUILTINS.has(name)) return false;
  return ALLOWED_BUILTINS.has(name);
}

module.exports = {
  BLOCKED_BUILTINS,
  ALLOWED_BUILTINS,
  sanitizeExtensionHostEnv,
  isBuiltinAllowed
};
