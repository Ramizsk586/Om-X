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

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
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
  const gpuLayers = String(config.gpuLayers || '0').trim() || '0';
  const port = String(config.port || '8080').trim() || '8080';
  const threads = String(config.threads || '4').trim() || '4';
  const host = String(config.host || '127.0.0.1').trim() || '127.0.0.1';
  const systemPrompt = String(config.systemPrompt || '').trim();
  const mmprojPath = String(config.mmprojPath || '').trim();
  const kvCacheMode = String(config.kvCacheMode || 'auto').trim().toLowerCase() || 'auto';
  const cacheTypeK = String(config.cacheTypeK || '').trim().toLowerCase();
  const cacheTypeV = String(config.cacheTypeV || '').trim().toLowerCase();

  return {
    executable,
    modelPath,
    contextLength,
    gpuLayers,
    port,
    threads,
    host,
    systemPrompt,
    mmprojPath,
    kvCacheMode,
    cacheTypeK,
    cacheTypeV
  };
}

function inferModelParamsB(modelPath, fileSizeMB = 0) {
  const raw = path.basename(String(modelPath || '').trim()).toLowerCase();
  const patterns = [
    /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)b/i,
    /(\d+(?:\.\d+)?)b/i,
    /(\d+(?:\.\d+)?)m/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    if (pattern.source.includes('x')) return Number(match[1]) * Number(match[2]);
    if (match[0].toLowerCase().endsWith('m')) return Number(match[1]) / 1000;
    return Number(match[1]);
  }
  if (Number(fileSizeMB) > 0) {
    return Math.max(1, Math.round((Number(fileSizeMB) / 1024) * 1.8));
  }
  return 7;
}

function estimateLayerCount(paramsB = 7) {
  const size = Number(paramsB || 7);
  const layerMap = [[0.5, 12], [1, 16], [3, 26], [7, 32], [13, 40], [30, 60], [70, 80], [120, 96], [180, 112], [405, 128]];
  for (const [params, layers] of layerMap) {
    if (size <= params) return layers;
  }
  return Math.max(32, Math.round(size * 0.32));
}

function estimateHiddenSize(paramsB = 7) {
  const sizeMap = [[0.5, 1024], [1, 2048], [3, 3200], [7, 4096], [13, 5120], [30, 6656], [70, 8192], [120, 9216], [180, 10240], [405, 16384]];
  const size = Number(paramsB || 7);
  for (const [params, hidden] of sizeMap) {
    if (size <= params) return hidden;
  }
  return 8192;
}

function normalizeKvCacheMode(value = 'auto') {
  const normalized = String(value || 'auto').trim().toLowerCase();
  if (normalized === 'q8' || normalized === 'q8_0') return 'q8';
  if (normalized === 'q5' || normalized === 'q5_0') return 'q5';
  if (normalized === 'q4' || normalized === 'q4_0' || normalized === 'q4_1') return 'q4';
  return 'auto';
}

function getKvCacheTypesForMode(mode = 'auto') {
  switch (normalizeKvCacheMode(mode)) {
    case 'q4':
      return { cacheTypeK: 'q4_0', cacheTypeV: 'q4_0' };
    case 'q5':
      return { cacheTypeK: 'q5_0', cacheTypeV: 'q5_0' };
    case 'q8':
    default:
      return { cacheTypeK: 'q8_0', cacheTypeV: 'q8_0' };
  }
}

function getKvBytesPerValue(cacheType = 'q8_0') {
  switch (String(cacheType || '').trim().toLowerCase()) {
    case 'q2_k':
      return 0.5;
    case 'q4_0':
      return 1;
    case 'q8_0':
    default:
      return 2;
  }
}

function estimateKvCacheMB({ modelPath = '', fileSizeMB = 0, totalLayers = 32, contextLength = 4096, cacheTypeK = 'q8_0', cacheTypeV = 'q8_0' } = {}) {
  const paramsB = inferModelParamsB(modelPath, fileSizeMB);
  const hidden = estimateHiddenSize(paramsB);
  const layers = Math.max(1, Number(totalLayers || estimateLayerCount(paramsB)));
  const ctx = Math.max(256, Number(contextLength || 4096));
  const bytesPerToken = layers * hidden * (getKvBytesPerValue(cacheTypeK) + getKvBytesPerValue(cacheTypeV));
  return Math.max(32, Math.round((bytesPerToken * ctx) / (1024 * 1024)));
}

function pickAutoKvMode(config = {}) {
  const availableVramMB = Math.max(0, Number(config.availableVramMB || 0));
  const contextLength = Math.max(512, Number(config.contextLength || 4096));
  const gpuLayers = Math.max(0, Number(config.gpuLayers || 0));
  const totalLayers = Math.max(1, Number(config.totalLayers || 32));
  const paramsB = inferModelParamsB(config.modelPath, Number(config.fileSizeMB || config.modelSizeMB || 0));
  const pressure = String(config.memoryPressure || 'safe').trim().toLowerCase();

  let mode = availableVramMB > 0 && availableVramMB < 6144
    ? 'q4'
    : availableVramMB > 0 && availableVramMB < 12288
      ? 'q5'
      : 'q8';

  if (paramsB >= 70) mode = mode === 'q8' ? 'q4' : mode;
  if (paramsB >= 30 && contextLength >= 8192) mode = mode === 'q8' ? 'q4' : mode;
  if (contextLength >= 16384 && availableVramMB < 12288) mode = 'q4';
  if (gpuLayers > 0 && gpuLayers < totalLayers && availableVramMB < 8192) mode = mode === 'q8' ? 'q5' : 'q4';

  if (pressure === 'warning' && mode === 'q8') mode = 'q5';
  if (pressure === 'critical') mode = mode === 'q8' ? 'q5' : 'q4';
  if (pressure === 'overloaded' || pressure === 'tripped') mode = 'q4';

  return mode;
}

function optimizeKvCache(config = {}) {
  const normalizedMode = normalizeKvCacheMode(config.kvCacheMode || 'auto');
  const paramsB = inferModelParamsB(config.modelPath, Number(config.fileSizeMB || config.modelSizeMB || 0));
  const totalLayers = Math.max(1, Number(config.totalLayers || estimateLayerCount(paramsB)));
  const originalContextLength = Math.max(512, Math.round(Number(config.contextLength || 4096)));
  const pressure = String(config.memoryPressure || 'safe').trim().toLowerCase();
  const resolvedMode = normalizedMode === 'auto' ? pickAutoKvMode({ ...config, totalLayers }) : normalizedMode;
  const kvTypes = getKvCacheTypesForMode(resolvedMode);

  let adjustedContextLength = originalContextLength;
  let optimizationStatus = normalizedMode === 'auto' ? 'Auto' : 'Manual';

  const freeRamMB = Math.max(0, Number(config.availableRamMB || 0));
  const availableVramMB = Math.max(0, Number(config.availableVramMB || 0));
  const estimatedKvCacheMB = estimateKvCacheMB({
    modelPath: config.modelPath,
    fileSizeMB: Number(config.fileSizeMB || config.modelSizeMB || 0),
    totalLayers,
    contextLength: originalContextLength,
    cacheTypeK: kvTypes.cacheTypeK,
    cacheTypeV: kvTypes.cacheTypeV
  });

  if (pressure === 'overloaded') {
    adjustedContextLength = Math.max(1024, Math.floor(originalContextLength * 0.75));
    optimizationStatus = normalizedMode === 'auto' ? 'Auto: Context Reduced' : 'Manual: Context Reduced';
  } else if (pressure === 'critical') {
    adjustedContextLength = Math.max(1024, Math.floor(originalContextLength * 0.85));
    optimizationStatus = normalizedMode === 'auto' ? 'Auto: Memory Guard Active' : 'Manual';
  } else if (normalizedMode === 'auto') {
    const ramBudgetMB = freeRamMB > 0 ? Math.max(512, Math.floor(freeRamMB * 0.35)) : 0;
    const vramBudgetMB = availableVramMB > 0 ? Math.max(256, Math.floor(availableVramMB * 0.45)) : 0;
    const kvBudgetMB = Math.max(ramBudgetMB, vramBudgetMB);
    if (kvBudgetMB > 0 && estimatedKvCacheMB > kvBudgetMB) {
      const ratio = Math.max(0.25, Math.min(1, kvBudgetMB / Math.max(1, estimatedKvCacheMB)));
      adjustedContextLength = Math.max(1024, Math.floor(originalContextLength * ratio));
      optimizationStatus = 'Auto: Context Reduced';
    }
  }

  const adjustedKvCacheMB = estimateKvCacheMB({
    modelPath: config.modelPath,
    fileSizeMB: Number(config.fileSizeMB || config.modelSizeMB || 0),
    totalLayers,
    contextLength: adjustedContextLength,
    cacheTypeK: kvTypes.cacheTypeK,
    cacheTypeV: kvTypes.cacheTypeV
  });

  return {
    kvCacheMode: normalizedMode,
    kvModeResolved: resolvedMode,
    cacheTypeK: kvTypes.cacheTypeK,
    cacheTypeV: kvTypes.cacheTypeV,
    totalLayers,
    paramsB,
    originalContextLength,
    adjustedContextLength,
    estimatedKvCacheMB: adjustedKvCacheMB,
    optimizationStatus
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
  if (normalized.cacheTypeK) {
    args.push('--cache-type-k', normalized.cacheTypeK);
  }
  if (normalized.cacheTypeV) {
    args.push('--cache-type-v', normalized.cacheTypeV);
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
  if (normalized.cacheTypeK) {
    args.push('--cache-type-k', normalized.cacheTypeK);
  }
  if (normalized.cacheTypeV) {
    args.push('--cache-type-v', normalized.cacheTypeV);
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
  const kvOptimization = optimizeKvCache({
    modelPath,
    fileSizeMB: Number(config.fileSizeMB || config.modelSizeMB || 0),
    modelSizeMB: Number(config.modelSizeMB || config.fileSizeMB || 0),
    contextLength: Number(config.contextLength || 4096),
    gpuLayers: Number(config.gpuLayers || 0),
    availableVramMB: Number(config.availableVramMB || 0),
    availableRamMB: Number(config.availableRamMB || 0),
    totalLayers: Number(config.totalLayers || 0),
    memoryPressure: config.memoryPressure || 'safe',
    kvCacheMode: config.kvCacheMode || 'auto'
  });
  const warnings = Array.from(new Set([
    ...(Array.isArray(config.warnings) ? config.warnings : []),
    ...capability.warnings,
    ...(kvOptimization.adjustedContextLength < kvOptimization.originalContextLength
      ? [`Context reduced from ${kvOptimization.originalContextLength} to ${kvOptimization.adjustedContextLength} to lower KV memory usage.`]
      : [])
  ]));
  const normalized = normalizeLaunchConfig({
    ...config,
    modelPath,
    contextLength: String(kvOptimization.adjustedContextLength || config.contextLength || 4096),
    mmprojPath: capability.mmprojPath || '',
    cacheTypeK: kvOptimization.cacheTypeK,
    cacheTypeV: kvOptimization.cacheTypeV,
    kvCacheMode: kvOptimization.kvCacheMode
  });
  const args = buildLlamaServerArgs(normalized);

  return {
    modelPath,
    modelType: capability.modelType,
    supportsVision: capability.supportsVision,
    mmprojPath: capability.mmprojPath,
    kvCacheMode: kvOptimization.kvCacheMode,
    kvModeResolved: kvOptimization.kvModeResolved,
    cacheTypeK: kvOptimization.cacheTypeK,
    cacheTypeV: kvOptimization.cacheTypeV,
    estimatedKvCacheMB: kvOptimization.estimatedKvCacheMB,
    adjustedContextLength: kvOptimization.adjustedContextLength,
    optimizationStatus: kvOptimization.optimizationStatus,
    hasKvCacheOverrides: Boolean(kvOptimization.cacheTypeK || kvOptimization.cacheTypeV),
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
  optimizeKvCache,
  buildLlamaServerArgs,
  buildLlamaServerCommand,
  prepareLlamaLaunch,
  normalizeSlashes
};
