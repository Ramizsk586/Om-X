const path = require('path');

function toWindowsSafeString(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function quoteForCommand(value) {
  return `"${toWindowsSafeString(value)}"`;
}

function normalizeSlashes(value) {
  return String(value || '').replace(/[\\/]+/g, '/');
}

function stripExtension(filename) {
  return String(filename || '').replace(/\.[^.]+$/i, '');
}

function normalizeToken(value) {
  return stripExtension(path.basename(String(value || '').trim()))
    .toLowerCase()
    .replace(/^mmproj[-_]?/i, '')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeModelEntry(input = {}) {
  const name = String(input.name || '').trim();
  const modelPath = String(input.path || '').trim();
  const type = String(input.type || 'text').trim().toLowerCase() || 'text';
  const warnings = Array.isArray(input.warnings) ? input.warnings.filter(Boolean) : [];
  const mmprojPath = String(input.mmprojPath || '').trim();

  return {
    name: name || path.basename(modelPath),
    path: modelPath,
    type,
    supportsVision: Boolean(input.supportsVision || type === 'vision'),
    mmprojPath: mmprojPath || null,
    warnings
  };
}

function listMmprojCandidates(siblingFiles = []) {
  return siblingFiles
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .filter((entry) => /\.gguf$/i.test(entry))
    .filter((entry) => /^mmproj[-_]?.+\.gguf$/i.test(path.basename(entry)));
}

function findAssociatedMmproj(modelPath, siblingFiles = []) {
  const modelName = path.basename(String(modelPath || '').trim());
  const modelToken = normalizeToken(modelName);
  const candidates = listMmprojCandidates(siblingFiles).map((candidate) => ({
    raw: candidate,
    base: path.basename(candidate),
    token: normalizeToken(candidate)
  }));
  const nonProjectorModels = siblingFiles
    .map((entry) => String(entry || '').trim())
    .filter((entry) => /\.gguf$/i.test(entry))
    .filter((entry) => !/^mmproj[-_]?.+\.gguf$/i.test(path.basename(entry)));

  if (!modelToken) {
    return {
      mmprojPath: null,
      warnings: [],
      candidates: candidates.map((entry) => entry.raw)
    };
  }

  const exactMatches = candidates.filter((candidate) => candidate.token === modelToken);
  if (exactMatches.length === 1) {
    return {
      mmprojPath: exactMatches[0].raw,
      warnings: [],
      candidates: candidates.map((entry) => entry.raw)
    };
  }

  if (exactMatches.length > 1) {
    return {
      mmprojPath: null,
      warnings: [`Multiple mmproj files match ${modelName}. Pick one manually by renaming unused projector files.`],
      candidates: candidates.map((entry) => entry.raw)
    };
  }

  if (candidates.length === 1 && nonProjectorModels.length === 1) {
    return {
      mmprojPath: candidates[0].raw,
      warnings: [],
      candidates: candidates.map((entry) => entry.raw)
    };
  }

  if (candidates.length > 1) {
    return {
      mmprojPath: null,
      warnings: [`Multiple mmproj files were found for ${modelName}, so Om-X did not guess which projector to use.`],
      candidates: candidates.map((entry) => entry.raw)
    };
  }

  return {
    mmprojPath: null,
    warnings: [],
    candidates: []
  };
}

const capabilityRules = [
  {
    type: 'vision',
    test: ({ modelName, mmprojPath }) => Boolean(mmprojPath) || /(llava|vision|(?:^|[-_])vl(?:[-_]|$)|minicpm-v|qwen2-vl|omni)/i.test(modelName)
  }
];

function detectModelCapability(modelPath, siblingFiles = [], options = {}) {
  const warnings = [];
  const modelName = path.basename(String(modelPath || '').trim());
  const mmprojResult = findAssociatedMmproj(modelPath, siblingFiles);
  warnings.push(...mmprojResult.warnings);

  const context = {
    modelPath: String(modelPath || '').trim(),
    modelName,
    siblingFiles,
    mmprojPath: mmprojResult.mmprojPath,
    options
  };

  const matchedRule = capabilityRules.find((rule) => {
    try {
      return Boolean(rule.test(context));
    } catch (_) {
      return false;
    }
  });

  const modelType = matchedRule?.type || 'text';
  const supportsVision = modelType === 'vision';

  if (supportsVision && !mmprojResult.mmprojPath) {
    warnings.push(`Vision model detected for ${modelName}, but no matching mmproj projector was found. Om-X will fall back to text-only launch.`);
  }

  return {
    modelType,
    supportsVision,
    mmprojPath: mmprojResult.mmprojPath,
    warnings: Array.from(new Set(warnings.filter(Boolean)))
  };
}

function normalizeLaunchConfig(config = {}) {
  const executable = String(config.executable || '').trim();
  const modelPath = String(config.modelPath || config.model || '').trim();
  const contextLength = String(config.contextLength || '4096').trim() || '4096';
  const gpuLayers = String(config.gpuLayers || '-1').trim() || '-1';
  const port = String(config.port || '8080').trim() || '8080';
  const threads = String(config.threads || '4').trim() || '4';
  const host = String(config.host || '127.0.0.1').trim() || '127.0.0.1';
  const systemPrompt = String(config.systemPrompt || '').trim();
  const mmprojPath = String(config.mmprojPath || '').trim();

  return {
    executable,
    modelPath,
    contextLength,
    gpuLayers,
    port,
    threads,
    host,
    systemPrompt,
    mmprojPath
  };
}

function buildLlamaServerArgs(config = {}) {
  const normalized = normalizeLaunchConfig(config);
  const args = [
    '-m',
    normalized.modelPath,
    '-c',
    normalized.contextLength,
    '-ngl',
    normalized.gpuLayers,
    '--port',
    normalized.port,
    '-t',
    normalized.threads,
    '--host',
    normalized.host
  ];

  if (normalized.mmprojPath) {
    args.push('--mmproj', normalized.mmprojPath);
  }

  return args;
}

function buildLlamaServerCommand(config = {}) {
  const normalized = normalizeLaunchConfig(config);
  if (!normalized.executable || !normalized.modelPath) return '';
  const argsList = buildLlamaServerArgs(normalized);
  const args = argsList
    .map((arg, index) => {
      const prev = index > 0 ? argsList[index - 1] : '';
      if (/^-\w|^--/.test(arg)) return arg;
      if (['-c', '-ngl', '--port', '-t'].includes(prev)) return arg;
      return quoteForCommand(arg);
    })
    .join(' ');
  return `& ${quoteForCommand(normalized.executable)} ${args}`;
}

function buildLlamaCliCommand(config = {}) {
  const normalized = normalizeLaunchConfig(config);
  const cliPath = String(config.cliPath || '').trim();
  if (!cliPath || !normalized.modelPath) return '';

  const args = [
    '-m',
    normalized.modelPath,
    '-c',
    normalized.contextLength,
    '-ngl',
    normalized.gpuLayers,
    '-t',
    normalized.threads
  ];
  if (normalized.mmprojPath) {
    args.push('--mmproj', normalized.mmprojPath);
  }
  args.push('--color', 'auto');
  return `& ${quoteForCommand(cliPath)} ${args.map((arg, index) => {
    const prev = index > 0 ? args[index - 1] : '';
    if (/^-\w|^--/.test(arg)) return arg;
    if (['-c', '-ngl', '-t'].includes(prev)) return arg;
    return quoteForCommand(arg);
  }).join(' ')}`;
}

function prepareLlamaLaunch(config = {}) {
  const modelPath = String(config.modelPath || config.model || '').trim();
  const siblingFiles = Array.isArray(config.siblingFiles) ? config.siblingFiles : [];
  const capability = detectModelCapability(modelPath, siblingFiles, config.options || {});
  const warnings = Array.from(new Set([...(Array.isArray(config.warnings) ? config.warnings : []), ...capability.warnings]));
  const normalized = normalizeLaunchConfig({
    ...config,
    modelPath,
    mmprojPath: capability.mmprojPath || ''
  });
  const args = buildLlamaServerArgs(normalized);

  return {
    modelPath,
    modelType: capability.modelType,
    supportsVision: capability.supportsVision,
    mmprojPath: capability.mmprojPath,
    warnings,
    args,
    command: buildLlamaServerCommand({
      ...normalized,
      mmprojPath: capability.mmprojPath || ''
    }),
    cliCommand: buildLlamaCliCommand({
      ...normalized,
      cliPath: config.cliPath,
      mmprojPath: capability.mmprojPath || ''
    })
  };
}

module.exports = {
  normalizeModelEntry,
  findAssociatedMmproj,
  detectModelCapability,
  buildLlamaServerArgs,
  buildLlamaServerCommand,
  prepareLlamaLaunch,
  normalizeSlashes
};
