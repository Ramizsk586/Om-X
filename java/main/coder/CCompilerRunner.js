const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
  normalizeCompilerRequest,
  splitCommandLineArgs,
  buildCompilerCandidates,
  getCompilerProfileLabel
} = require('./CCompilerProfiles');
const { runInbuiltCProgram } = require('./InbuiltCBasicRunner');

const KNOWN_C_COMPILER_PROBES = Object.freeze([
  { id: 'clang', command: 'clang', label: 'Clang', versionArgs: ['--version'] },
  { id: 'gcc', command: 'gcc', label: 'GCC', versionArgs: ['--version'] },
  { id: 'cc', command: 'cc', label: 'CC', versionArgs: ['--version'] },
  { id: 'tcc', command: 'tcc', label: 'Tiny C Compiler (tcc)', versionArgs: ['-v'] }
]);

let compilerSearchDirsCache = null;

function isPathLikeCommand(command) {
  const cmd = String(command || '').trim();
  if (!cmd) return false;
  return /[\\/]/.test(cmd) || /^[A-Za-z]:/.test(cmd);
}

function safeStatSync(target) {
  try {
    return fs.statSync(target);
  } catch (_) {
    return null;
  }
}

function isExistingFile(target) {
  const stat = safeStatSync(target);
  return Boolean(stat && stat.isFile());
}

function isExistingDirectory(target) {
  const stat = safeStatSync(target);
  return Boolean(stat && stat.isDirectory());
}

function addUniqueString(out, seen, value) {
  const text = String(value || '').trim();
  if (!text) return;
  const normalized = process.platform === 'win32' ? text.toLowerCase() : text;
  if (seen.has(normalized)) return;
  seen.add(normalized);
  out.push(text);
}

function listPathDirectoriesFromEnv() {
  const envPath = String(process.env.PATH || process.env.Path || '').trim();
  if (!envPath) return [];
  return envPath
    .split(path.delimiter)
    .map((entry) => String(entry || '').trim().replace(/^"+|"+$/g, ''))
    .filter(Boolean);
}

function getKnownWindowsCompilerDirectories() {
  const dirs = [];
  const seen = new Set();
  const addDir = (dir) => {
    if (!dir) return;
    const resolved = path.resolve(String(dir));
    if (!isExistingDirectory(resolved)) return;
    addUniqueString(dirs, seen, resolved);
  };

  listPathDirectoriesFromEnv().forEach(addDir);

  const systemDrive = String(process.env.SystemDrive || 'C:').trim() || 'C:';
  const userProfile = String(process.env.USERPROFILE || '').trim();
  const localAppData = String(process.env.LOCALAPPDATA || '').trim();
  const programData = String(process.env.ProgramData || '').trim() || path.join(systemDrive, 'ProgramData');
  const chocolateyInstall = String(process.env.ChocolateyInstall || '').trim();

  [
    path.join(systemDrive, 'MinGW', 'bin'),
    path.join(systemDrive, 'mingw', 'bin'),
    path.join(systemDrive, 'mingw64', 'bin'),
    path.join(systemDrive, 'TDM-GCC-64', 'bin'),
    path.join(systemDrive, 'TDM-GCC-32', 'bin'),
    path.join(systemDrive, 'msys64', 'mingw64', 'bin'),
    path.join(systemDrive, 'msys64', 'mingw32', 'bin'),
    path.join(systemDrive, 'msys64', 'ucrt64', 'bin'),
    path.join(systemDrive, 'msys64', 'clang64', 'bin'),
    path.join(systemDrive, 'msys64', 'clang32', 'bin'),
    programData ? path.join(programData, 'chocolatey', 'bin') : '',
    programData ? path.join(programData, 'chocolatey', 'lib', 'mingw', 'tools', 'install', 'mingw64', 'bin') : '',
    chocolateyInstall ? path.join(chocolateyInstall, 'bin') : '',
    chocolateyInstall ? path.join(chocolateyInstall, 'lib', 'mingw', 'tools', 'install', 'mingw64', 'bin') : '',
    userProfile ? path.join(userProfile, 'scoop', 'shims') : '',
    userProfile ? path.join(userProfile, 'scoop', 'apps', 'gcc', 'current', 'bin') : '',
    userProfile ? path.join(userProfile, 'scoop', 'apps', 'mingw', 'current', 'bin') : '',
    localAppData ? path.join(localAppData, 'Programs', 'mingw64', 'bin') : ''
  ].forEach(addDir);

  return dirs;
}

function getCompilerSearchDirectories() {
  if (Array.isArray(compilerSearchDirsCache)) return compilerSearchDirsCache;
  if (process.platform === 'win32') {
    compilerSearchDirsCache = getKnownWindowsCompilerDirectories();
  } else {
    const dirs = [];
    const seen = new Set();
    listPathDirectoriesFromEnv().forEach((entry) => {
      if (!isExistingDirectory(entry)) return;
      addUniqueString(dirs, seen, path.resolve(entry));
    });
    compilerSearchDirsCache = dirs;
  }
  return compilerSearchDirsCache;
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

  if (isPathLikeCommand(cmd)) {
    return out;
  }

  const searchDirs = getCompilerSearchDirectories();
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

function runProcessCapture(command, args = [], options = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let outputTruncated = false;
    const maxOutputBytes = Math.max(4096, Number(options.maxOutputBytes) || (512 * 1024));
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 15000);
    let totalBytes = 0;
    let child = null;
    let timeout = null;
    const stdinText = options.stdinText == null ? '' : String(options.stdinText);

    const finish = (partial = {}) => {
      if (settled) return;
      settled = true;
      try { if (timeout) clearTimeout(timeout); } catch (_) {}
      resolve({
        ok: false,
        code: null,
        signal: null,
        stdout,
        stderr,
        timedOut,
        outputTruncated,
        ...partial
      });
    };

    const append = (kind, chunk) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
      if (!text) return;
      totalBytes += Buffer.byteLength(text, 'utf8');
      if (kind === 'stdout') stdout += text;
      else stderr += text;
      if (totalBytes > maxOutputBytes && child && !child.killed) {
        outputTruncated = true;
        try { child.kill(); } catch (_) {}
      }
    };

    try {
      child = spawn(String(command || ''), Array.isArray(args) ? args.map((v) => String(v)) : [], {
        cwd: options.cwd ? path.resolve(String(options.cwd)) : undefined,
        windowsHide: true,
        shell: false
      });
    } catch (error) {
      finish({
        error: error?.message || String(error),
        spawnErrorCode: error?.code || ''
      });
      return;
    }

    timeout = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch (_) {}
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => append('stdout', chunk));
    child.stderr?.on('data', (chunk) => append('stderr', chunk));
    if (child.stdin) {
      try {
        if (stdinText) child.stdin.write(stdinText);
      } catch (_) {}
      try { child.stdin.end(); } catch (_) {}
      try { child.stdin.on('error', () => {}); } catch (_) {}
    }

    child.on('error', (error) => {
      finish({
        error: error?.message || String(error),
        spawnErrorCode: error?.code || ''
      });
    });

    child.on('close', (code, signal) => {
      finish({
        ok: Number(code) === 0 && !timedOut && !outputTruncated,
        code: Number.isFinite(Number(code)) ? Number(code) : null,
        signal: signal || null,
        error: timedOut ? 'Process timed out' : (outputTruncated ? 'Process output exceeded limit' : '')
      });
    });
  });
}

function firstNonEmptyLine(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const t = String(line || '').trim();
    if (t) return t;
  }
  return '';
}

async function detectAvailableCCompilers(options = {}) {
  const timeoutMs = Math.max(400, Number(options.timeoutMs) || 2000);
  const maxOutputBytes = Math.max(4096, Number(options.maxOutputBytes) || (48 * 1024));
  const found = [];
  const seenIds = new Set();

  for (const probe of KNOWN_C_COMPILER_PROBES) {
    let res = null;
    let usedCommand = String(probe.command || '').trim();
    const invocationCandidates = resolveCommandInvocationCandidates(probe.command);
    for (const invocation of invocationCandidates) {
      const probeRes = await runProcessCapture(invocation, probe.versionArgs || ['--version'], {
        timeoutMs,
        maxOutputBytes
      });
      if (!probeRes.ok && String(probeRes.spawnErrorCode || '').toUpperCase() === 'ENOENT') {
        continue;
      }
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

function parseCCompilerDiagnostics(outputText, sourcePath, options = {}) {
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
    const match = line.match(/^(.*):(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note)\s*:\s*(.+)$/i);
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
    const message = String(match[5] || '').trim();
    if (!message) continue;
    const diag = {
      line: Math.max(1, Number(match[2]) || 1),
      col: Math.max(1, Number(match[3]) || 1),
      severity: /error/.test(level) ? 'error' : 'warning',
      code: `compiler:${level}`,
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

function buildCompileArgs(candidate, sourcePath, exePath, extraArgsText) {
  const defaults = Array.isArray(candidate?.defaultFlags) ? candidate.defaultFlags : [];
  const extraArgs = splitCommandLineArgs(extraArgsText);
  return [
    ...defaults,
    ...extraArgs,
    sourcePath,
    '-o',
    exePath
  ];
}

function buildNoCompilerFoundError(config, candidates) {
  const tried = (Array.isArray(candidates) ? candidates : []).map((c) => String(c.command || c.label || '').trim()).filter(Boolean);
  const profile = String(config?.profile || 'inbuilt');
  if (profile === 'custom') {
    return {
      message: 'Custom compiler command was not found. Check the command/path in Coder Settings.',
      tried
    };
  }
  if (profile === 'inbuilt') {
    return {
      message: 'No C compiler found in PATH. Install clang, gcc, or tcc to use Play for C files.',
      tried
    };
  }
  return {
    message: `${getCompilerProfileLabel(profile)} compiler was not found in PATH. Install it or switch compiler backend in Coder Settings.`,
    tried
  };
}

async function runCSourceFile(options = {}) {
  const sourcePath = path.resolve(String(options.sourcePath || options.path || ''));
  if (String(path.extname(sourcePath) || '').toLowerCase() !== '.c') {
    return { success: false, phase: 'compile', error: 'Play supports .c source files only' };
  }
  const config = normalizeCompilerRequest(options);
  if (config.profile === 'inbuilt') {
    return runInbuiltCProgram({
      sourcePath,
      timeoutMs: 1000,
      maxOutputBytes: 512 * 1024,
      stdin: options.stdinText || options.stdin || options.input || ''
    });
  }
  const candidates = buildCompilerCandidates(config);
  if (!candidates.length) {
    return {
      success: false,
      phase: 'compile',
      compiler: '',
      compilerProfile: config.profile,
      error: 'Custom compiler is selected but no command is configured in Coder Settings.',
      tried: []
    };
  }

  const sourceDir = path.dirname(sourcePath);
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'omx-coder-c-run-'));
  const exeName = process.platform === 'win32' ? 'program.exe' : 'program.out';
  const exePath = path.join(tmpDir, exeName);
  let compiler = '';
  let compileRes = null;
  let chosenCandidate = null;

  try {
    for (const candidate of candidates) {
      const invocationCandidates = resolveCommandInvocationCandidates(candidate.command);
      for (const commandCandidate of invocationCandidates) {
        const args = buildCompileArgs(candidate, sourcePath, exePath, config.extraArgs);
        const res = await runProcessCapture(commandCandidate, args, {
          cwd: sourceDir,
          timeoutMs: 20000,
          maxOutputBytes: 768 * 1024
        });
        if (!res.ok && String(res.spawnErrorCode || '').toUpperCase() === 'ENOENT') {
          continue;
        }
        compiler = String(candidate.label || candidate.command || '').trim();
        chosenCandidate = { ...candidate, command: String(commandCandidate || '').trim() };
        compileRes = res;
        break;
      }
      if (compileRes) break;
    }

    if (!compileRes) {
      const noCompiler = buildNoCompilerFoundError(config, candidates);
      return {
        success: false,
        phase: 'compile',
        error: noCompiler.message,
        compiler: '',
        compilerProfile: config.profile,
        tried: noCompiler.tried
      };
    }

    const compileOutput = [String(compileRes.stdout || ''), String(compileRes.stderr || '')].filter(Boolean).join('\n').trim();
    const diagnostics = parseCCompilerDiagnostics(compileOutput, sourcePath, { cwd: sourceDir });

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
          : (compileRes.outputTruncated ? 'Compiler output exceeded limit' : (compileRes.error || `Compiler exited with code ${compileRes.code ?? 'unknown'}`))
      };
    }

    const runRes = await runProcessCapture(exePath, [], {
      cwd: sourceDir,
      timeoutMs: 12000,
      maxOutputBytes: 768 * 1024,
      stdinText: options.stdinText || options.stdin || options.input || ''
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
            : (runRes.outputTruncated ? 'Program output exceeded limit' : (runRes.error || `Program exited with code ${runRes.code ?? 'unknown'}`)))
    };
  } finally {
    try { await fs.promises.rm(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = {
  runCSourceFile,
  parseCCompilerDiagnostics,
  runProcessCapture,
  detectAvailableCCompilers,
  getCompilerSearchDirectories
};
