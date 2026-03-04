const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const {
  splitCommandLineArgs
} = require('./CCompilerProfiles');
const {
  runProcessCapture,
  parseCCompilerDiagnostics,
  getCompilerSearchDirectories
} = require('./CCompilerRunner');
const { runInbuiltCppProgram } = require('./InbuiltCppBasicRunner');

const KNOWN_CPP_COMPILER_PROBES = Object.freeze([
  { id: 'clangxx', command: 'clang++', label: 'Clang++', versionArgs: ['--version'] },
  { id: 'gxx', command: 'g++', label: 'G++', versionArgs: ['--version'] },
  { id: 'cpp', command: 'c++', label: 'C++', versionArgs: ['--version'] },
  { id: 'clangcl', command: 'clang-cl', label: 'clang-cl', versionArgs: ['--version'] },
  { id: 'msvc', command: 'cl', label: 'MSVC (cl.exe)', versionArgs: [] }
]);

const CPP_LIMITS_DEFAULTS = Object.freeze({
  inbuiltTimeoutMs: 120000,
  inbuiltMaxOutputBytes: 128 * 1024 * 1024,
  compileTimeoutMs: 180000,
  compileMaxOutputBytes: 64 * 1024 * 1024,
  runTimeoutMs: 300000,
  runMaxOutputBytes: 128 * 1024 * 1024
});

function coerceLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.trunc(n);
  return Math.max(min, Math.min(max, int));
}

function resolveCppRunLimits(options = {}) {
  const src = (options && typeof options === 'object') ? options : {};
  const timeoutInput = src.timeoutMs;
  const maxOutputInput = src.maxOutputBytes;
  return {
    inbuiltTimeoutMs: coerceLimit(src.inbuiltTimeoutMs, CPP_LIMITS_DEFAULTS.inbuiltTimeoutMs, 250, 30 * 60 * 1000),
    inbuiltMaxOutputBytes: coerceLimit(src.inbuiltMaxOutputBytes, CPP_LIMITS_DEFAULTS.inbuiltMaxOutputBytes, 64 * 1024, 256 * 1024 * 1024),
    compileTimeoutMs: coerceLimit(src.compileTimeoutMs ?? timeoutInput, CPP_LIMITS_DEFAULTS.compileTimeoutMs, 2000, 15 * 60 * 1000),
    compileMaxOutputBytes: coerceLimit(src.compileMaxOutputBytes ?? maxOutputInput, CPP_LIMITS_DEFAULTS.compileMaxOutputBytes, 64 * 1024, 256 * 1024 * 1024),
    runTimeoutMs: coerceLimit(src.runTimeoutMs ?? timeoutInput, CPP_LIMITS_DEFAULTS.runTimeoutMs, 1000, 30 * 60 * 1000),
    runMaxOutputBytes: coerceLimit(src.runMaxOutputBytes ?? maxOutputInput, CPP_LIMITS_DEFAULTS.runMaxOutputBytes, 64 * 1024, 256 * 1024 * 1024)
  };
}

function buildInbuiltCppWorkerErrorResult(message, phase = 'run') {
  const msg = String(message || 'Inbuilt C++ worker failed');
  return {
    success: false,
    phase: String(phase || 'run'),
    compiler: 'inbuilt-mini-cpp',
    compilerProfile: 'inbuilt',
    error: msg,
    diagnostics: [{
      line: 1,
      col: 1,
      severity: 'error',
      code: 'inbuilt-cpp:worker',
      message: msg
    }]
  };
}

function runInbuiltCppProgramInWorker(options = {}, limits = {}) {
  return new Promise((resolve) => {
    const workerPath = path.join(__dirname, 'InbuiltCppWorker.js');
    const timeoutMs = coerceLimit(
      limits?.inbuiltTimeoutMs ?? options?.timeoutMs,
      CPP_LIMITS_DEFAULTS.inbuiltTimeoutMs,
      250,
      30 * 60 * 1000
    );
    const hardTimeoutMs = coerceLimit(
      limits?.inbuiltWorkerTimeoutMs,
      timeoutMs + 8000,
      1000,
      30 * 60 * 1000
    );
    const payload = {
      ...((options && typeof options === 'object') ? options : {}),
      timeoutMs,
      maxOutputBytes: coerceLimit(
        limits?.inbuiltMaxOutputBytes ?? options?.maxOutputBytes,
        CPP_LIMITS_DEFAULTS.inbuiltMaxOutputBytes,
        64 * 1024,
        256 * 1024 * 1024
      )
    };

    let settled = false;
    let timer = null;
    let worker = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { if (timer) clearTimeout(timer); } catch (_) {}
      try { worker?.removeAllListeners?.(); } catch (_) {}
      try { worker?.terminate?.(); } catch (_) {}
      resolve(result);
    };

    try {
      worker = new Worker(workerPath);
    } catch (error) {
      // Fallback path if Worker cannot be created in this runtime.
      runInbuiltCppProgram(payload)
        .then((res) => finish(res))
        .catch((err) => finish(buildInbuiltCppWorkerErrorResult(err?.message || err)));
      return;
    }

    timer = setTimeout(() => {
      finish(buildInbuiltCppWorkerErrorResult(`Inbuilt C++ worker timed out after ${hardTimeoutMs}ms`, 'run'));
    }, hardTimeoutMs);

    worker.on('message', (message) => {
      const type = String(message?.type || '').toLowerCase();
      if (type === 'result') {
        finish(message?.result || buildInbuiltCppWorkerErrorResult('Inbuilt C++ worker returned empty result'));
        return;
      }
      if (type === 'error') {
        finish(buildInbuiltCppWorkerErrorResult(message?.error || 'Inbuilt C++ worker execution failed'));
      }
    });

    worker.on('error', (error) => {
      finish(buildInbuiltCppWorkerErrorResult(error?.message || error));
    });

    worker.on('exit', (code) => {
      if (settled) return;
      if (Number(code) === 0) {
        finish(buildInbuiltCppWorkerErrorResult('Inbuilt C++ worker exited without returning a result'));
        return;
      }
      finish(buildInbuiltCppWorkerErrorResult(`Inbuilt C++ worker exited with code ${code}`));
    });

    try {
      worker.postMessage({ options: payload });
    } catch (error) {
      finish(buildInbuiltCppWorkerErrorResult(error?.message || error));
    }
  });
}

function isPathLikeCommand(command) {
  const cmd = String(command || '').trim();
  if (!cmd) return false;
  return /[\\/]/.test(cmd) || /^[A-Za-z]:/.test(cmd);
}

function addUniqueString(out, seen, value) {
  const text = String(value || '').trim();
  if (!text) return;
  const normalized = process.platform === 'win32' ? text.toLowerCase() : text;
  if (seen.has(normalized)) return;
  seen.add(normalized);
  out.push(text);
}

function isExistingFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch (_) {
    return false;
  }
}

function getExecutableNameCandidates(command) {
  const cmd = String(command || '').trim();
  if (!cmd) return [];
  if (process.platform !== 'win32') return [cmd];
  if (/\.(exe|cmd|bat)$/i.test(cmd)) return [cmd];
  return [`${cmd}.exe`, `${cmd}.cmd`, `${cmd}.bat`, cmd];
}

function resolveCommandInvocationCandidates(command) {
  const cmd = String(command || '').trim();
  if (!cmd) return [];
  const out = [];
  const seen = new Set();
  addUniqueString(out, seen, cmd);
  if (isPathLikeCommand(cmd)) return out;

  const searchDirs = Array.isArray(getCompilerSearchDirectories()) ? getCompilerSearchDirectories() : [];
  const names = getExecutableNameCandidates(cmd);
  for (const dir of searchDirs) {
    for (const name of names) {
      const full = path.join(dir, name);
      if (!isExistingFile(full)) continue;
      addUniqueString(out, seen, full);
    }
  }
  return out;
}

function firstNonEmptyLine(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const t = String(line || '').trim();
    if (t) return t;
  }
  return '';
}

function detectCppCompilerFamily(commandOrId) {
  const raw = String(commandOrId || '').trim().toLowerCase();
  if (!raw) return 'gnu';
  const base = path.basename(raw).toLowerCase();
  if (base === 'cl' || base === 'cl.exe' || base === 'clang-cl' || base === 'clang-cl.exe' || raw === 'msvc' || raw === 'clangcl') {
    return 'msvc';
  }
  return 'gnu';
}

function createCppCandidate(id, command, label, defaultFlags, family) {
  return {
    id: String(id || '').trim().toLowerCase(),
    command: String(command || '').trim(),
    label: String(label || command || id).trim(),
    defaultFlags: Array.isArray(defaultFlags) ? defaultFlags.slice() : [],
    family: String(family || detectCppCompilerFamily(id || command)).trim().toLowerCase()
  };
}

async function detectAvailableCppCompilers(options = {}) {
  const timeoutMs = Math.max(400, Number(options.timeoutMs) || 2000);
  const maxOutputBytes = Math.max(4096, Number(options.maxOutputBytes) || (48 * 1024));
  const found = [];
  const seenIds = new Set();

  for (const probe of KNOWN_CPP_COMPILER_PROBES) {
    let res = null;
    let usedCommand = String(probe.command || '').trim();
    const invocationCandidates = resolveCommandInvocationCandidates(probe.command);
    for (const invocation of invocationCandidates) {
      const probeRes = await runProcessCapture(invocation, probe.versionArgs || ['--version'], {
        timeoutMs,
        maxOutputBytes
      });
      if (!probeRes.ok && String(probeRes.spawnErrorCode || '').toUpperCase() === 'ENOENT') continue;
      res = probeRes;
      usedCommand = String(invocation || probe.command || '').trim();
      break;
    }
    if (!res) continue;
    const id = String(probe.id || '').trim().toLowerCase();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    const versionLine = firstNonEmptyLine([String(res.stdout || ''), String(res.stderr || '')].filter(Boolean).join('\n'));
    found.push({
      id,
      command: usedCommand,
      label: String(probe.label || probe.command || id).trim(),
      version: versionLine ? versionLine.slice(0, 180) : ''
    });
  }
  return found;
}

function normalizeCppCompilerRequest(input = {}) {
  const src = (input && typeof input === 'object') ? input : {};
  const raw = String(src.compilerProfile || src.compiler || src.profile || 'auto').trim().toLowerCase();
  let profile = raw;
  if (!profile || profile === 'auto') profile = 'auto';
  if (profile === 'gcc') profile = 'gxx';
  if (profile === 'clang') profile = 'clangxx';
  if (profile === 'cc') profile = 'cpp';
  if (profile === 'g++') profile = 'gxx';
  if (profile === 'clang++') profile = 'clangxx';
  if (profile === 'clang-cl') profile = 'clangcl';
  if (profile === 'cl') profile = 'msvc';
  if (!['auto', 'inbuilt', 'gxx', 'clangxx', 'cpp', 'clangcl', 'msvc', 'custom'].includes(profile)) profile = 'auto';
  const customCommand = String(src.customCompilerCommand || src.customCommand || '').trim().replace(/^"+|"+$/g, '');
  const extraArgs = String(src.extraCompilerArgs || src.compilerArgs || '').trim();
  return { profile, customCommand, extraArgs };
}

function buildCppCompilerCandidates(config) {
  const profile = String(config?.profile || 'auto');
  if (profile === 'inbuilt') return [];
  if (profile === 'custom') {
    if (!config.customCommand) return [];
    const family = detectCppCompilerFamily(config.customCommand);
    return [createCppCandidate(
      'custom',
      config.customCommand,
      config.customCommand,
      family === 'msvc' ? ['/nologo', '/EHsc', '/W3'] : ['-Wall', '-Wextra'],
      family
    )];
  }
  if (profile === 'gxx') return [createCppCandidate('gxx', 'g++', 'G++', ['-Wall', '-Wextra'], 'gnu')];
  if (profile === 'clangxx') return [createCppCandidate('clangxx', 'clang++', 'Clang++', ['-Wall', '-Wextra'], 'gnu')];
  if (profile === 'cpp') return [createCppCandidate('cpp', 'c++', 'C++', ['-Wall', '-Wextra'], 'gnu')];
  if (profile === 'clangcl') return [createCppCandidate('clangcl', 'clang-cl', 'clang-cl', ['/nologo', '/EHsc', '/W3'], 'msvc')];
  if (profile === 'msvc') return [createCppCandidate('msvc', 'cl', 'MSVC (cl.exe)', ['/nologo', '/EHsc', '/W3'], 'msvc')];
  return [
    createCppCandidate('clangxx', 'clang++', 'Clang++', ['-Wall', '-Wextra'], 'gnu'),
    createCppCandidate('gxx', 'g++', 'G++', ['-Wall', '-Wextra'], 'gnu'),
    createCppCandidate('cpp', 'c++', 'C++', ['-Wall', '-Wextra'], 'gnu'),
    createCppCandidate('clangcl', 'clang-cl', 'clang-cl', ['/nologo', '/EHsc', '/W3'], 'msvc'),
    createCppCandidate('msvc', 'cl', 'MSVC (cl.exe)', ['/nologo', '/EHsc', '/W3'], 'msvc')
  ];
}

function buildCppCompileArgs(candidate, sourcePaths, exePath, extraArgsText, options = {}) {
  const sourceList = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
  const defaults = Array.isArray(candidate?.defaultFlags) ? candidate.defaultFlags : [];
  const extraArgs = splitCommandLineArgs(extraArgsText);
  const family = detectCppCompilerFamily(candidate?.family || candidate?.id || candidate?.command);
  const standardFlag = String(options.standardFlag || '').trim();
  const linkExtraArgs = Array.isArray(options.linkExtraArgs) ? options.linkExtraArgs.map((v) => String(v)) : [];
  const includeExtraArgs = Array.isArray(options.includeExtraArgs) ? options.includeExtraArgs.map((v) => String(v)) : [];
  if (family === 'msvc') {
    return [
      '/TP',
      ...defaults,
      ...(standardFlag ? [standardFlag] : []),
      ...extraArgs,
      ...includeExtraArgs,
      ...sourceList,
      `/Fe${exePath}`,
      ...linkExtraArgs
    ];
  }
  return [...defaults, ...(standardFlag ? [standardFlag] : []), ...extraArgs, ...includeExtraArgs, ...sourceList, '-o', exePath, ...linkExtraArgs];
}

function userSpecifiedCppStandardArg(extraArgsText) {
  const args = splitCommandLineArgs(extraArgsText);
  return args.some((arg) => /^-std=/.test(String(arg || '')) || /^\/std:/i.test(String(arg || '')));
}

function userSpecifiedCppThreadFlag(extraArgsText) {
  const args = splitCommandLineArgs(extraArgsText);
  return args.some((arg) => /^-pthread$/i.test(String(arg || '')));
}

function userSpecifiedCppFilesystemCompatFlag(extraArgsText) {
  const args = splitCommandLineArgs(extraArgsText);
  return args.some((arg) => String(arg || '').toLowerCase() === '-lstdc++fs');
}

function getCppStandardFallbacks(candidate, config, extraArgsText) {
  if (userSpecifiedCppStandardArg(extraArgsText)) return [''];
  const family = detectCppCompilerFamily(candidate?.family || candidate?.id || candidate?.command);
  if (family === 'msvc') {
    return ['/std:c++latest', '/std:c++20', '/std:c++17', '/std:c++14'];
  }
  return ['-std=gnu++23', '-std=c++23', '-std=gnu++20', '-std=c++20', '-std=gnu++17', '-std=c++17', '-std=gnu++14', '-std=c++14'];
}

function isLikelyLinkerError(outputText) {
  const text = String(outputText || '');
  if (!text) return false;
  return /undefined reference|unresolved external|LNK20\d{2}|collect2:\s*error|ld(?:\.exe)?:/i.test(text);
}

function isLikelyFilesystemLinkError(outputText) {
  const text = String(outputText || '');
  if (!text) return false;
  return /(filesystem|std::filesystem)/i.test(text) && /undefined reference|unresolved external|LNK20\d{2}/i.test(text);
}

function isLikelyPthreadLinkError(outputText) {
  const text = String(outputText || '');
  if (!text) return false;
  return /(pthread_|__gthread_|std::thread|condition_variable|mutex)/i.test(text) && /undefined reference|cannot find -lpthread|ld(?:\.exe)?:/i.test(text);
}

function isLikelyWinsockLinkError(outputText) {
  const text = String(outputText || '');
  if (!text) return false;
  return /(WSAStartup|WSACleanup|closesocket|socket|bind|listen|accept|recv|send|getaddrinfo|freeaddrinfo)/i.test(text)
    && /undefined reference|unresolved external|LNK20\d{2}/i.test(text);
}

function isLikelyOpenMpLinkError(outputText) {
  const text = String(outputText || '');
  if (!text) return false;
  return /(omp_get_|GOMP_|__kmpc_|openmp)/i.test(text)
    && /undefined reference|unresolved external|LNK20\d{2}/i.test(text);
}

function splitUserExtraArgs(extraArgsText) {
  return splitCommandLineArgs(extraArgsText).map((v) => String(v || '').trim()).filter(Boolean);
}

function userHasArg(extraArgsText, predicate) {
  const args = splitUserExtraArgs(extraArgsText);
  return args.some((arg) => {
    try { return Boolean(predicate(arg)); } catch (_) { return false; }
  });
}

function buildIncludeArgsForCompilerFamily(family, includeDirs = []) {
  const out = [];
  const seen = new Set();
  const isMsvc = String(family || '').toLowerCase() === 'msvc';
  for (const dir of (Array.isArray(includeDirs) ? includeDirs : [])) {
    const raw = String(dir || '').trim();
    if (!raw) continue;
    const resolved = path.resolve(raw);
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isMsvc) out.push(`/I${resolved}`);
    else out.push(`-I${resolved}`);
  }
  return out;
}

function isLikelyMissingHeaderError(outputText) {
  const text = String(outputText || '');
  if (!text) return false;
  return /fatal error:.*No such file or directory|fatal error C1083: Cannot open include file|file not found/i.test(text);
}

function extractMissingHeaderNames(outputText) {
  const text = String(outputText || '');
  const found = [];
  const seen = new Set();
  const regexes = [
    /fatal error:\s*([^\s:][^:\n]*)\s*:\s*No such file or directory/gi,
    /fatal error C1083:\s*Cannot open include file:\s*'([^']+)'/gi,
    /fatal error:\s*'([^']+)'\s*file not found/gi,
    /fatal error:\s*"([^"]+)"\s*file not found/gi
  ];
  const addName = (value) => {
    const raw = String(value || '').trim().replace(/^["'<]|[>"']$/g, '');
    if (!raw) return;
    const base = path.basename(raw);
    if (!base) return;
    const key = process.platform === 'win32' ? base.toLowerCase() : base;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(base);
  };
  for (const re of regexes) {
    let m = null;
    while ((m = re.exec(text))) {
      addName(m[1]);
      if (found.length >= 12) break;
    }
    if (found.length >= 12) break;
  }
  return found;
}

function appendCompileNotesText(compileOutput, notes = []) {
  const items = Array.isArray(notes) ? notes.map((n) => String(n || '').trim()).filter(Boolean) : [];
  const base = String(compileOutput || '').trim();
  if (!items.length) return base;
  const noteText = items.map((n) => `[Coder C++] ${n}`).join('\n');
  return base ? `${noteText}\n${base}` : noteText;
}

async function listSiblingCppSourcesForRetry(sourceDir, sourcePath, options = {}) {
  const limit = Math.max(1, Number(options.limit) || 12);
  let entries = [];
  try {
    entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  const sourceAbs = path.resolve(String(sourcePath || ''));
  const sourceAbsNorm = process.platform === 'win32' ? sourceAbs.toLowerCase() : sourceAbs;
  const out = [];
  for (const entry of entries) {
    try {
      if (!entry || !entry.isFile || !entry.isFile()) continue;
      const name = String(entry.name || '');
      if (!name || name.startsWith('.')) continue;
      if (!isCppSourceExtension(path.extname(name))) continue;
      const full = path.resolve(sourceDir, name);
      const fullNorm = process.platform === 'win32' ? full.toLowerCase() : full;
      if (fullNorm === sourceAbsNorm) continue;
      const definesMain = await fileLikelyDefinesMain(full);
      if (definesMain) continue;
      out.push(full);
      if (out.length >= limit) break;
    } catch (_) {}
  }
  out.sort((a, b) => String(a).localeCompare(String(b)));
  return out;
}

function isExistingDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch (_) {
    return false;
  }
}

function findCppProjectRoot(startDir) {
  let current = path.resolve(String(startDir || '.'));
  const markers = ['CMakeLists.txt', 'compile_commands.json', '.git', 'meson.build', 'vcpkg.json'];
  while (true) {
    for (const marker of markers) {
      try {
        if (fs.existsSync(path.join(current, marker))) return current;
      } catch (_) {}
    }
    const parent = path.dirname(current);
    if (!parent || parent === current) break;
    current = parent;
  }
  return path.resolve(String(startDir || '.'));
}

function shouldSkipProjectTraversalDir(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return true;
  return new Set([
    '.git', '.hg', '.svn', '.idea', '.vscode', '.vs',
    'node_modules', 'dist', 'build', 'out', 'bin', 'obj', 'target',
    'cmake-build-debug', 'cmake-build-release', '__pycache__'
  ]).has(n);
}

async function listProjectCppSourcesForRetry(rootDir, sourcePath, options = {}) {
  const start = path.resolve(String(rootDir || '.'));
  if (!isExistingDirectory(start)) return [];
  const maxDepth = Math.max(1, Number(options.maxDepth) || 4);
  const limit = Math.max(1, Number(options.limit) || 32);
  const sourceAbs = path.resolve(String(sourcePath || ''));
  const sourceAbsNorm = process.platform === 'win32' ? sourceAbs.toLowerCase() : sourceAbs;
  const out = [];
  const queue = [{ dir: start, depth: 0 }];
  const seenDirs = new Set([process.platform === 'win32' ? start.toLowerCase() : start]);
  while (queue.length && out.length < limit) {
    const next = queue.shift();
    if (!next) break;
    let entries = [];
    try {
      entries = await fs.promises.readdir(next.dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      if (!entry) continue;
      const name = String(entry.name || '');
      if (!name || name === '.' || name === '..') continue;
      const full = path.resolve(next.dir, name);
      if (entry.isDirectory && entry.isDirectory()) {
        if (next.depth >= maxDepth) continue;
        if (shouldSkipProjectTraversalDir(name)) continue;
        const key = process.platform === 'win32' ? full.toLowerCase() : full;
        if (seenDirs.has(key)) continue;
        seenDirs.add(key);
        queue.push({ dir: full, depth: next.depth + 1 });
        continue;
      }
      if (!entry.isFile || !entry.isFile()) continue;
      if (!isCppSourceExtension(path.extname(name))) continue;
      const fullNorm = process.platform === 'win32' ? full.toLowerCase() : full;
      if (fullNorm === sourceAbsNorm) continue;
      const definesMain = await fileLikelyDefinesMain(full);
      if (definesMain) continue;
      out.push(full);
      if (out.length >= limit) break;
    }
  }
  out.sort((a, b) => String(a).localeCompare(String(b)));
  return out;
}

async function findIncludeDirsForHeaders(projectRoot, sourceDir, headerNames = [], options = {}) {
  const names = (Array.isArray(headerNames) ? headerNames : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!names.length) return [];
  const maxDepth = Math.max(1, Number(options.maxDepth) || 4);
  const maxDirs = Math.max(1, Number(options.maxDirs) || 16);
  const maxFilesScanned = Math.max(200, Number(options.maxFilesScanned) || 3000);
  const roots = [];
  const addRoot = (p) => {
    const value = String(p || '').trim();
    if (!value) return;
    const resolved = path.resolve(value);
    if (!isExistingDirectory(resolved)) return;
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (roots.some((r) => (process.platform === 'win32' ? r.toLowerCase() : r) === key)) return;
    roots.push(resolved);
  };
  addRoot(sourceDir);
  addRoot(projectRoot);
  addRoot(path.join(projectRoot, 'include'));
  addRoot(path.join(projectRoot, 'src'));
  addRoot(path.join(projectRoot, 'lib'));
  addRoot(path.join(projectRoot, 'third_party'));
  addRoot(path.join(projectRoot, 'external'));

  const namesSet = new Set(names.map((n) => (process.platform === 'win32' ? n.toLowerCase() : n)));
  const foundDirs = [];
  const foundDirSet = new Set();
  let scannedFiles = 0;

  for (const root of roots) {
    const queue = [{ dir: root, depth: 0 }];
    const seenDirs = new Set([process.platform === 'win32' ? root.toLowerCase() : root]);
    while (queue.length && foundDirs.length < maxDirs && scannedFiles < maxFilesScanned) {
      const next = queue.shift();
      if (!next) break;
      let entries = [];
      try {
        entries = await fs.promises.readdir(next.dir, { withFileTypes: true });
      } catch (_) {
        continue;
      }
      for (const entry of entries) {
        if (!entry) continue;
        const name = String(entry.name || '');
        if (!name || name === '.' || name === '..') continue;
        const full = path.resolve(next.dir, name);
        if (entry.isDirectory && entry.isDirectory()) {
          if (next.depth >= maxDepth) continue;
          if (shouldSkipProjectTraversalDir(name)) continue;
          const key = process.platform === 'win32' ? full.toLowerCase() : full;
          if (seenDirs.has(key)) continue;
          seenDirs.add(key);
          queue.push({ dir: full, depth: next.depth + 1 });
          continue;
        }
        if (!entry.isFile || !entry.isFile()) continue;
        scannedFiles += 1;
        const fileName = process.platform === 'win32' ? name.toLowerCase() : name;
        if (!namesSet.has(fileName)) continue;
        const dirKey = process.platform === 'win32' ? next.dir.toLowerCase() : next.dir;
        if (foundDirSet.has(dirKey)) continue;
        foundDirSet.add(dirKey);
        foundDirs.push(next.dir);
        if (foundDirs.length >= maxDirs) break;
      }
    }
    if (foundDirs.length >= maxDirs || scannedFiles >= maxFilesScanned) break;
  }
  return foundDirs;
}

async function fileLikelyDefinesMain(filePath) {
  let text = '';
  try {
    text = await fs.promises.readFile(String(filePath || ''), 'utf8');
  } catch (_) {
    return false;
  }
  if (!text) return false;
  const stripped = String(text)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
  return /\b(?:int|auto|signed|unsigned|long|short)\s+main\s*\(/.test(stripped);
}

function isCppSourceExtension(ext) {
  const e = String(ext || '').toLowerCase();
  return ['.cpp', '.cc', '.cxx', '.c++'].includes(e);
}

function buildNoCppCompilerFoundResult(config, candidates = []) {
  const tried = (Array.isArray(candidates) ? candidates : [])
    .map((c) => String(c?.command || c?.label || '').trim())
    .filter(Boolean);
  const profile = String(config?.profile || 'auto').toLowerCase();
  if (profile === 'custom') {
    return {
      success: false,
      phase: 'compile',
      compiler: '',
      compilerProfile: 'custom',
      error: 'Custom C++ compiler command was not found. Check the command/path in Coder Settings.',
      tried
    };
  }
  return null;
}

function parseMsvcCppCompilerDiagnostics(outputText, sourcePath, options = {}) {
  const output = String(outputText || '');
  const sourceAbs = path.resolve(String(sourcePath || ''));
  if (!output || !sourceAbs) return [];
  const cwd = options.cwd ? path.resolve(String(options.cwd)) : path.dirname(sourceAbs);
  const targetLower = sourceAbs.toLowerCase();
  const targetBase = path.basename(sourceAbs).toLowerCase();
  const seen = new Set();
  const out = [];

  for (const rawLine of output.split(/\r?\n/)) {
    const line = String(rawLine || '').trim();
    if (!line) continue;
    const match = line.match(/^(.*)\((\d+)(?:,(\d+))?\)\s*:\s*(fatal error|error|warning|note)\s*(?:([A-Za-z]+\d+))?\s*:\s*(.+)$/i);
    if (!match) continue;
    const filePart = String(match[1] || '').trim().replace(/^["']|["']$/g, '');
    let abs = '';
    try {
      abs = path.resolve(filePart);
    } catch (_) {
      try { abs = path.resolve(cwd, filePart); } catch (_) { abs = ''; }
    }
    const absLower = String(abs || '').toLowerCase();
    const baseLower = path.basename(abs || filePart).toLowerCase();
    const sepIdx = absLower ? (absLower.length - targetBase.length - 1) : -1;
    const hasSepBeforeBase = sepIdx >= 0 && /[\\/]/.test(absLower.charAt(sepIdx));
    if (!(absLower === targetLower || (!absLower && baseLower === targetBase) || (baseLower === targetBase && hasSepBeforeBase && absLower.endsWith(targetBase)))) {
      continue;
    }

    const level = String(match[4] || 'warning').toLowerCase();
    const codeId = String(match[5] || '').trim();
    const message = String(match[6] || '').trim();
    if (!message) continue;
    const diag = {
      line: Math.max(1, Number(match[2]) || 1),
      col: Math.max(1, Number(match[3]) || 1),
      severity: /error/.test(level) ? 'error' : 'warning',
      code: codeId ? `compiler:${codeId.toLowerCase()}` : `compiler:${level}`,
      message
    };
    const key = `${diag.severity}|${diag.line}|${diag.col}|${diag.code}|${diag.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diag);
    if (out.length >= 80) break;
  }

  out.sort((a, b) => {
    if ((a.line || 0) !== (b.line || 0)) return (a.line || 0) - (b.line || 0);
    if ((a.col || 0) !== (b.col || 0)) return (a.col || 0) - (b.col || 0);
    return String(a.message || '').localeCompare(String(b.message || ''));
  });
  return out;
}

function parseCppCompilerDiagnostics(outputText, sourcePath, options = {}) {
  const gnuLike = parseCCompilerDiagnostics(outputText, sourcePath, options);
  const msvcLike = parseMsvcCppCompilerDiagnostics(outputText, sourcePath, options);
  if (!msvcLike.length) return gnuLike;
  if (!gnuLike.length) return msvcLike;
  const out = [];
  const seen = new Set();
  for (const diag of [...gnuLike, ...msvcLike]) {
    const key = `${diag.severity}|${diag.line}|${diag.col}|${diag.code}|${diag.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diag);
  }
  out.sort((a, b) => {
    if ((a.line || 0) !== (b.line || 0)) return (a.line || 0) - (b.line || 0);
    if ((a.col || 0) !== (b.col || 0)) return (a.col || 0) - (b.col || 0);
    return String(a.message || '').localeCompare(String(b.message || ''));
  });
  return out;
}

async function runCppSourceFile(options = {}) {
  const sourcePath = path.resolve(String(options.sourcePath || options.path || ''));
  const ext = String(path.extname(sourcePath) || '').toLowerCase();
  if (!isCppSourceExtension(ext)) {
    return { success: false, phase: 'compile', error: 'Play supports .cpp/.cc/.cxx source files for C++' };
  }

  const limits = resolveCppRunLimits(options);
  const config = normalizeCppCompilerRequest(options);
  const sourceDir = path.dirname(sourcePath);
  const stdinText = options.stdinText || options.stdin || options.input || '';

  if (config.profile === 'inbuilt') {
    return runInbuiltCppProgramInWorker({
      sourcePath,
      timeoutMs: limits.inbuiltTimeoutMs,
      maxOutputBytes: limits.inbuiltMaxOutputBytes,
      stdin: stdinText
    }, limits);
  }

  const candidates = buildCppCompilerCandidates(config);
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'omx-coder-cpp-run-'));
  const exeName = process.platform === 'win32' ? 'program.exe' : 'program.out';
  const exePath = path.join(tmpDir, exeName);
  let compiler = '';
  let compileRes = null;
  let chosenCandidate = null;
  let compileInfo = {
    standardFlag: '',
    sourcePaths: [sourcePath],
    includeExtraArgs: [],
    linkExtraArgs: [],
    notes: []
  };

  try {
    for (const candidate of candidates) {
      const invocations = resolveCommandInvocationCandidates(candidate.command);
      for (const invocation of invocations) {
        let invocationExecuted = false;
        const standardFlags = getCppStandardFallbacks(candidate, config, config.extraArgs);
        const family = detectCppCompilerFamily(candidate?.family || candidate?.id || candidate?.command);
        for (const standardFlag of standardFlags) {
          const primaryArgs = buildCppCompileArgs(candidate, [sourcePath], exePath, config.extraArgs, { standardFlag });
          let res = await runProcessCapture(invocation, primaryArgs, {
            cwd: sourceDir,
            timeoutMs: limits.compileTimeoutMs,
            maxOutputBytes: limits.compileMaxOutputBytes
          });
          if (!res.ok && String(res.spawnErrorCode || '').toUpperCase() === 'ENOENT') {
            invocationExecuted = false;
            break;
          }
          invocationExecuted = true;
          let chosenRes = res;
          let chosenNotes = [];
          let chosenSources = [sourcePath];
          let chosenIncludeExtraArgs = [];
          let chosenLinkExtraArgs = [];

          const baseOutput = [String(res.stdout || ''), String(res.stderr || '')].filter(Boolean).join('\n');
          if (!res.ok) {
            const retryVariants = [];
            const seenRetryKeys = new Set();
            const addRetryVariant = (variant) => {
              const extraSources = Array.isArray(variant?.extraSources) ? variant.extraSources.map((v) => String(v)) : [];
              const includeExtraArgs = Array.isArray(variant?.includeExtraArgs) ? variant.includeExtraArgs.map((v) => String(v)) : [];
              const linkExtraArgs = Array.isArray(variant?.linkExtraArgs) ? variant.linkExtraArgs.map((v) => String(v)) : [];
              const notes = Array.isArray(variant?.notes) ? variant.notes.map((v) => String(v)) : [];
              const key = `${extraSources.join('|')}::${includeExtraArgs.join('|')}::${linkExtraArgs.join('|')}`;
              if (seenRetryKeys.has(key)) return;
              seenRetryKeys.add(key);
              retryVariants.push({ extraSources, includeExtraArgs, linkExtraArgs, notes });
            };

            const linkerFailure = isLikelyLinkerError(baseOutput);
            const headerFailure = isLikelyMissingHeaderError(baseOutput);
            const projectRoot = findCppProjectRoot(sourceDir);
            let siblingSources = [];
            let projectSources = [];

            if (linkerFailure) {
              siblingSources = await listSiblingCppSourcesForRetry(sourceDir, sourcePath, { limit: 16 });
              if (siblingSources.length) {
                const namesPreview = siblingSources.slice(0, 4).map((p) => path.basename(p)).join(', ');
                addRetryVariant({
                  extraSources: siblingSources,
                  notes: [`Retried link with ${siblingSources.length + 1} C++ sources (${namesPreview}${siblingSources.length > 4 ? ', ...' : ''})`]
                });
              }
              if (!siblingSources.length || siblingSources.length < 2) {
                projectSources = await listProjectCppSourcesForRetry(projectRoot, sourcePath, { maxDepth: 4, limit: 28 });
                if (projectSources.length) {
                  const preview = projectSources.slice(0, 4).map((p) => path.basename(p)).join(', ');
                  addRetryVariant({
                    extraSources: projectSources,
                    notes: [`Retried link with project C++ sources (${projectSources.length + 1} files; ${preview}${projectSources.length > 4 ? ', ...' : ''})`]
                  });
                }
              }
            }

            const reusableSources = siblingSources.length ? siblingSources : projectSources;

            if (headerFailure) {
              const missingHeaders = extractMissingHeaderNames(baseOutput);
              const hasUserInclude = userHasArg(config.extraArgs, (arg) => /^-I/i.test(String(arg)) || /^\/I/i.test(String(arg)));
              const includeDirs = await findIncludeDirsForHeaders(projectRoot, sourceDir, missingHeaders, {
                maxDepth: 4,
                maxDirs: 16,
                maxFilesScanned: 4000
              });
              if (includeDirs.length && !hasUserInclude) {
                const includeExtraArgs = buildIncludeArgsForCompilerFamily(family, includeDirs);
                const includePreview = includeDirs.slice(0, 4).map((p) => path.basename(p)).join(', ');
                addRetryVariant({
                  includeExtraArgs,
                  notes: [`Retried compile with inferred include dirs (${includePreview}${includeDirs.length > 4 ? ', ...' : ''})`]
                });
                if (reusableSources.length) {
                  addRetryVariant({
                    extraSources: reusableSources,
                    includeExtraArgs,
                    notes: ['Retried compile with inferred include dirs and additional project sources']
                  });
                }
              }
            }

            if (family === 'gnu' && linkerFailure && isLikelyFilesystemLinkError(baseOutput) && !userSpecifiedCppFilesystemCompatFlag(config.extraArgs)) {
              addRetryVariant({
                linkExtraArgs: ['-lstdc++fs'],
                notes: ['Retried link with -lstdc++fs for older std::filesystem toolchains']
              });
              if (reusableSources.length) {
                addRetryVariant({
                  extraSources: reusableSources,
                  linkExtraArgs: ['-lstdc++fs'],
                  notes: ['Retried link with additional sources and -lstdc++fs']
                });
              }
            }

            if (family === 'gnu' && linkerFailure && isLikelyPthreadLinkError(baseOutput) && !userSpecifiedCppThreadFlag(config.extraArgs)) {
              addRetryVariant({
                linkExtraArgs: ['-pthread'],
                notes: ['Retried link with -pthread']
              });
              if (reusableSources.length) {
                addRetryVariant({
                  extraSources: reusableSources,
                  linkExtraArgs: ['-pthread'],
                  notes: ['Retried link with additional sources and -pthread']
                });
              }
            }

            if (family === 'gnu' && linkerFailure && isLikelyWinsockLinkError(baseOutput) && !userHasArg(config.extraArgs, (arg) => String(arg).toLowerCase() === '-lws2_32')) {
              addRetryVariant({
                linkExtraArgs: ['-lws2_32'],
                notes: ['Retried link with -lws2_32 for Winsock symbols']
              });
              if (reusableSources.length) {
                addRetryVariant({
                  extraSources: reusableSources,
                  linkExtraArgs: ['-lws2_32'],
                  notes: ['Retried link with additional sources and -lws2_32']
                });
              }
            }

            if (family === 'msvc' && linkerFailure && isLikelyWinsockLinkError(baseOutput) && !userHasArg(config.extraArgs, (arg) => /^(ws2_32\.lib|winsock2\.lib)$/i.test(arg))) {
              addRetryVariant({
                linkExtraArgs: ['ws2_32.lib'],
                notes: ['Retried link with ws2_32.lib for Winsock symbols']
              });
              if (reusableSources.length) {
                addRetryVariant({
                  extraSources: reusableSources,
                  linkExtraArgs: ['ws2_32.lib'],
                  notes: ['Retried link with additional sources and ws2_32.lib']
                });
              }
            }

            if (family === 'gnu' && linkerFailure && isLikelyOpenMpLinkError(baseOutput) && !userHasArg(config.extraArgs, (arg) => String(arg).toLowerCase() === '-fopenmp')) {
              addRetryVariant({
                linkExtraArgs: ['-fopenmp'],
                notes: ['Retried build with -fopenmp for OpenMP symbols']
              });
              if (reusableSources.length) {
                addRetryVariant({
                  extraSources: reusableSources,
                  linkExtraArgs: ['-fopenmp'],
                  notes: ['Retried build with additional sources and -fopenmp']
                });
              }
            }

            if (family === 'msvc' && linkerFailure && isLikelyOpenMpLinkError(baseOutput) && !userHasArg(config.extraArgs, (arg) => /^\/openmp(?::|$)/i.test(arg))) {
              addRetryVariant({
                linkExtraArgs: ['/openmp'],
                notes: ['Retried build with /openmp for OpenMP symbols']
              });
              if (reusableSources.length) {
                addRetryVariant({
                  extraSources: reusableSources,
                  linkExtraArgs: ['/openmp'],
                  notes: ['Retried build with additional sources and /openmp']
                });
              }
            }

            for (const variant of retryVariants) {
              const args = buildCppCompileArgs(
                candidate,
                [sourcePath, ...variant.extraSources],
                exePath,
                config.extraArgs,
                {
                  standardFlag,
                  includeExtraArgs: variant.includeExtraArgs,
                  linkExtraArgs: variant.linkExtraArgs
                }
              );
              const retryRes = await runProcessCapture(invocation, args, {
                cwd: sourceDir,
                timeoutMs: limits.compileTimeoutMs,
                maxOutputBytes: limits.compileMaxOutputBytes
              });
              if (!retryRes.ok && String(retryRes.spawnErrorCode || '').toUpperCase() === 'ENOENT') {
                continue;
              }
              chosenRes = retryRes;
              chosenSources = [sourcePath, ...variant.extraSources];
              chosenIncludeExtraArgs = variant.includeExtraArgs.slice();
              chosenLinkExtraArgs = variant.linkExtraArgs.slice();
              chosenNotes = [].concat(variant.notes || []);
              if (retryRes.ok) break;
            }
          }

          compiler = String(candidate.label || candidate.command || '').trim();
          chosenCandidate = { ...candidate, command: String(invocation || '').trim() };
          compileRes = chosenRes;
          compileInfo = {
            standardFlag: standardFlag || '',
            sourcePaths: chosenSources,
            includeExtraArgs: chosenIncludeExtraArgs,
            linkExtraArgs: chosenLinkExtraArgs,
            notes: chosenNotes
          };
          if (compileRes.ok) break;
        }
        if (!invocationExecuted && !compileRes) continue;
        break;
      }
      if (compileRes) break;
    }

    if (!compileRes) {
      const noCompiler = buildNoCppCompilerFoundResult(config, candidates);
      if (noCompiler) return noCompiler;
      return runInbuiltCppProgramInWorker({
        sourcePath,
        timeoutMs: limits.inbuiltTimeoutMs,
        maxOutputBytes: limits.inbuiltMaxOutputBytes,
        stdin: stdinText
      }, limits);
    }

    const compileOutputRaw = [String(compileRes.stdout || ''), String(compileRes.stderr || '')].filter(Boolean).join('\n').trim();
    const compileNotes = Array.isArray(compileInfo.notes) ? compileInfo.notes.slice() : [];
    if (compileInfo.standardFlag) {
      compileNotes.unshift(`${compileRes.ok ? 'Compiled' : 'Tried'} using ${compileInfo.standardFlag}`);
    }
    const compileOutput = appendCompileNotesText(compileOutputRaw, compileNotes);
    const diagnostics = parseCppCompilerDiagnostics(compileOutput, sourcePath, { cwd: sourceDir });
    if (!compileRes.ok) {
      return {
        success: false,
        phase: 'compile',
        compiler,
        compilerProfile: config.profile,
        compilerCommand: String(chosenCandidate?.command || '').trim(),
        output: compileOutput,
        diagnostics,
        exitCode: compileRes.code,
        timedOut: compileRes.timedOut === true,
        error: compileRes.timedOut
          ? 'Compiler timed out'
          : (compileRes.outputTruncated ? `Compiler output exceeded limit (${limits.compileMaxOutputBytes} bytes)` : (compileRes.error || `Compiler exited with code ${compileRes.code ?? 'unknown'}`))
      };
    }

    const runRes = await runProcessCapture(exePath, [], {
      cwd: sourceDir,
      timeoutMs: limits.runTimeoutMs,
      maxOutputBytes: limits.runMaxOutputBytes,
      stdinText
    });
    const runOutput = [String(runRes.stdout || ''), String(runRes.stderr || '')].filter(Boolean).join('\n').trim();
    const success = Boolean(runRes.ok);
    return {
      success,
      phase: 'run',
      compiler,
      compilerProfile: config.profile,
      compilerCommand: String(chosenCandidate?.command || '').trim(),
      compileOutput,
      output: runOutput,
      diagnostics,
      exitCode: runRes.code,
      timedOut: runRes.timedOut === true,
      error: success
        ? ''
        : (runRes.timedOut
            ? 'Program execution timed out'
            : (runRes.outputTruncated ? `Program output exceeded limit (${limits.runMaxOutputBytes} bytes)` : (runRes.error || `Program exited with code ${runRes.code ?? 'unknown'}`)))
    };
  } finally {
    try { await fs.promises.rm(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = {
  runCppSourceFile,
  detectAvailableCppCompilers,
  parseCppCompilerDiagnostics
};
