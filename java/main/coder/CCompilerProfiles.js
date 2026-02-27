function normalizeCompilerProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'inbuilt';
  if (raw === 'auto') return 'inbuilt';
  if (raw === 'other') return 'custom';
  if (['inbuilt', 'gcc', 'clang', 'cc', 'tcc', 'custom'].includes(raw)) return raw;
  return 'inbuilt';
}

function stripWrappingQuotes(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function normalizeCompilerRequest(input = {}) {
  const src = (input && typeof input === 'object') ? input : {};
  return {
    profile: normalizeCompilerProfile(src.compilerProfile || src.compiler || src.profile),
    customCommand: stripWrappingQuotes(src.customCompilerCommand || src.customCommand || '').slice(0, 512),
    extraArgs: String(src.extraCompilerArgs || src.compilerArgs || '').trim().slice(0, 1024)
  };
}

function splitCommandLineArgs(text) {
  const src = String(text || '');
  if (!src.trim()) return [];
  const out = [];
  let buf = '';
  let quote = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src.charAt(i);
    if (quote) {
      if (ch === '\\' && quote === '"' && i + 1 < src.length) {
        const next = src.charAt(i + 1);
        if (next === '"' || next === '\\') {
          buf += next;
          i += 1;
          continue;
        }
      }
      if (ch === quote) {
        quote = '';
        continue;
      }
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (buf) {
        out.push(buf);
        buf = '';
        if (out.length >= 64) break;
      }
      continue;
    }
    buf += ch;
  }
  if (buf && out.length < 64) out.push(buf);
  return out;
}

function getDefaultFlagsForCandidate(candidateId) {
  const id = String(candidateId || '').trim().toLowerCase();
  if (id === 'tcc') return ['-Wall'];
  return ['-std=c11', '-Wall', '-Wextra'];
}

function createCandidate(id, command) {
  return {
    id: String(id || '').trim().toLowerCase(),
    command: String(command || '').trim(),
    label: String(command || '').trim(),
    defaultFlags: getDefaultFlagsForCandidate(id)
  };
}

function buildCompilerCandidates(configInput = {}) {
  const config = normalizeCompilerRequest(configInput);
  const profile = config.profile;
  if (profile === 'inbuilt') return [];
  if (profile === 'custom') {
    if (!config.customCommand) return [];
    return [{
      id: 'custom',
      command: config.customCommand,
      label: config.customCommand,
      defaultFlags: ['-std=c11', '-Wall', '-Wextra']
    }];
  }
  if (profile === 'gcc') return [createCandidate('gcc', 'gcc')];
  if (profile === 'clang') return [createCandidate('clang', 'clang')];
  if (profile === 'cc') return [createCandidate('cc', 'cc')];
  if (profile === 'tcc') return [createCandidate('tcc', 'tcc')];
  return [
    createCandidate('clang', 'clang'),
    createCandidate('gcc', 'gcc'),
    createCandidate('cc', 'cc'),
    createCandidate('tcc', 'tcc')
  ];
}

function getCompilerProfileLabel(profile) {
  const id = normalizeCompilerProfile(profile);
  if (id === 'inbuilt') return 'Inbuilt';
  if (id === 'gcc') return 'GCC';
  if (id === 'clang') return 'Clang';
  if (id === 'cc') return 'CC';
  if (id === 'tcc') return 'TCC';
  if (id === 'custom') return 'Custom';
  return 'Inbuilt';
}

module.exports = {
  normalizeCompilerProfile,
  normalizeCompilerRequest,
  splitCommandLineArgs,
  buildCompilerCandidates,
  getCompilerProfileLabel
};
