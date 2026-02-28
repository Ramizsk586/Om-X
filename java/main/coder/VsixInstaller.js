const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function runSpawn(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stderr = '';
    child.stderr?.on('data', (buf) => { stderr += String(buf || ''); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve({ code: 0, stderr });
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

class VsixInstaller {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.warnedManifestFields = new Set();
    this.coderDataDir = path.resolve(String(options.coderDataDir || '.'));
    this.extensionsRoot = path.join(this.coderDataDir, 'extensions');
    // Large modern AI extensions (e.g. Codex/Copilot-family) can exceed 100MB.
    // Keep a hard cap, but raise it to allow real-world installs while still
    // preventing unbounded archive extraction.
    this.maxVsixBytes = Number(options.maxVsixBytes) || 512 * 1024 * 1024;
    // Install compatibility gate only (runtime API support still depends on Coder's extension host).
    this.coderVscodeApiVersion = String(options.coderVscodeApiVersion || '1.109.4');
  }

  _warnManifestField(field, value, message) {
    const key = `${field}:${message}`;
    if (this.warnedManifestFields.has(key)) return;
    this.warnedManifestFields.add(key);
    this.logger.warn?.(`[Coder][Extensions] ${message}`, value);
  }

  async installVsix(vsixPath) {
    const source = path.resolve(String(vsixPath || ''));
    if (!source.toLowerCase().endsWith('.vsix')) {
      throw new Error('Only .vsix packages are supported');
    }

    const stat = await fs.promises.stat(source);
    if (!stat.isFile()) throw new Error('VSIX path is not a file');
    if (stat.size > this.maxVsixBytes) {
      throw new Error(`VSIX exceeds maximum size (${this.maxVsixBytes} bytes)`);
    }

    await fs.promises.mkdir(this.extensionsRoot, { recursive: true });
    const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'omx-coder-vsix-'));
    const extractDir = path.join(tmpRoot, 'extract');
    await fs.promises.mkdir(extractDir, { recursive: true });

    try {
      await this.extractArchive(source, extractDir);
      const { manifest, packageRoot } = await this.readManifest(extractDir);
      const localizedManifest = await this.localizeManifest(manifest, packageRoot);
      const metadata = this.validateManifest(localizedManifest, packageRoot);
      const finalDirName = `${metadata.id}-${metadata.version}`;
      const finalDir = path.join(this.extensionsRoot, finalDirName);
      await fs.promises.rm(finalDir, { recursive: true, force: true });
      await fs.promises.cp(packageRoot, finalDir, { recursive: true, force: true, errorOnExist: false });
      await this.rejectNativeBinaries(finalDir);

      return {
        ...metadata,
        installPath: finalDir
      };
    } finally {
      await fs.promises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
  }

  async extractArchive(source, extractDir) {
    if (process.platform === 'win32') {
      let archivePath = source;
      let cleanupArchive = '';
      try {
        if (String(source).toLowerCase().endsWith('.vsix')) {
          cleanupArchive = path.join(path.dirname(extractDir), `archive-${Date.now()}.zip`);
          await fs.promises.copyFile(source, cleanupArchive);
          archivePath = cleanupArchive;
        }
        const src = safeString(archivePath).replace(/'/g, "''");
        const dst = safeString(extractDir).replace(/'/g, "''");
        const cmd = `Expand-Archive -LiteralPath '${src}' -DestinationPath '${dst}' -Force`;
        await runSpawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd]);
      } finally {
        if (cleanupArchive) {
          await fs.promises.rm(cleanupArchive, { force: true }).catch(() => {});
        }
      }
      return;
    }
    throw new Error('VSIX extraction is currently implemented for Windows only in Coder');
  }

  async readManifest(extractDir) {
    const candidates = [
      path.join(extractDir, 'extension', 'package.json'),
      path.join(extractDir, 'package.json')
    ];
    for (const manifestPath of candidates) {
      try {
        const raw = await fs.promises.readFile(manifestPath, 'utf8');
        return {
          manifest: JSON.parse(raw),
          packageRoot: path.dirname(manifestPath)
        };
      } catch (_) {
        // try next
      }
    }
    throw new Error('VSIX package.json manifest not found');
  }

  async localizeManifest(manifest, packageRoot) {
    const nlsPath = path.join(packageRoot, 'package.nls.json');
    let table = null;
    try {
      const raw = await fs.promises.readFile(nlsPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') table = parsed;
    } catch (_) {
      table = null;
    }
    if (!table) return manifest;

    const replaceLocalizedString = (value) => {
      if (typeof value !== 'string') return value;
      return value.replace(/%([^%]+)%/g, (full, key) => {
        const hit = table[key];
        return typeof hit === 'string' ? hit : full;
      });
    };

    const walk = (node) => {
      if (Array.isArray(node)) return node.map(walk);
      if (!node || typeof node !== 'object') return replaceLocalizedString(node);
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    };

    return walk(manifest);
  }

  validateManifest(manifest, packageRoot) {
    if (typeof manifest?.name !== 'string') this._warnManifestField('name', manifest?.name, 'Unexpected non-string manifest.name');
    if (typeof manifest?.publisher !== 'string') this._warnManifestField('publisher', manifest?.publisher, 'Unexpected non-string manifest.publisher');
    if (typeof manifest?.version !== 'string') this._warnManifestField('version', manifest?.version, 'Unexpected non-string manifest.version');
    if (manifest?.description != null && typeof manifest?.description !== 'string') this._warnManifestField('description', manifest?.description, 'Unexpected non-string manifest.description');

    const name = safeString(manifest?.name).trim();
    const publisher = safeString(manifest?.publisher).trim();
    const version = safeString(manifest?.version).trim();
    const mainEntry = safeString(manifest?.main || manifest?.browser).trim();
    const browserEntry = safeString(manifest?.browser).trim();
    const iconEntry = safeString(manifest?.icon).trim();

    if (!name || !publisher || !version) throw new Error('Extension manifest is missing required metadata');
    if (!mainEntry) throw new Error('Extension manifest must define a "main" entry for Coder compatibility mode');
    this.validateEngineCompatibility(manifest?.engines || {});

    const id = `${publisher}.${name}`;
    const mainAbs = path.resolve(packageRoot, mainEntry);
    if (!mainAbs.startsWith(path.resolve(packageRoot))) {
      throw new Error('Extension main entry escapes package root');
    }

    let icon = '';
    if (iconEntry) {
      const iconAbs = path.resolve(packageRoot, iconEntry);
      if (!iconAbs.startsWith(path.resolve(packageRoot))) {
        throw new Error('Extension icon path escapes package root');
      }
      icon = iconEntry.replace(/\\/g, '/');
    }

    return {
      id,
      name,
      publisher,
      publisherDisplayName: safeString(manifest?.publisherDisplayName || manifest?.author?.name || publisher),
      version,
      displayName: safeString(manifest?.displayName || name),
      description: safeString(manifest?.description),
      engines: manifest?.engines || {},
      main: mainEntry.replace(/\\/g, '/'),
      browser: browserEntry ? browserEntry.replace(/\\/g, '/') : '',
      icon,
      activationEvents: Array.isArray(manifest?.activationEvents) ? manifest.activationEvents : [],
      contributes: manifest?.contributes || {},
      manifest
    };
  }

  validateEngineCompatibility(engines) {
    const vscodeRange = String(engines?.vscode || '').trim();
    if (!vscodeRange) return;
    if (!this._satisfiesEngineRange(this.coderVscodeApiVersion, vscodeRange)) {
      throw new Error(`Extension requires VS Code ${vscodeRange}, but Coder compatibility mode provides ${this.coderVscodeApiVersion}`);
    }
  }

  _parseSemver(version) {
    const normalized = String(version || '').trim().replace(/^v/i, '').split('-')[0];
    const m = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
    if (!m) return null;
    return [Number(m[1]) || 0, Number(m[2]) || 0, Number(m[3]) || 0];
  }

  _compareSemver(a, b) {
    for (let i = 0; i < 3; i += 1) {
      if (a[i] > b[i]) return 1;
      if (a[i] < b[i]) return -1;
    }
    return 0;
  }

  _normalizeWildcardRange(range) {
    const raw = String(range || '').trim();
    if (!raw || raw === '*') return '*';
    const m = raw.match(/^(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/i);
    if (!m) return '';
    const major = m[1];
    const minor = m[2];
    const patch = m[3];
    if (!minor || minor === 'x' || minor === '*') return `>=${major}.0.0 <${Number(major) + 1}.0.0`;
    if (!patch || patch === 'x' || patch === '*') return `>=${major}.${minor}.0 <${major}.${Number(minor) + 1}.0`;
    return `=${major}.${minor}.${patch}`;
  }

  _satisfiesComparator(versionArr, comparator) {
    const token = String(comparator || '').trim();
    if (!token) return true;
    if (token === '*') return true;
    if (/^\d+(?:\.(?:\d+|x|\*))?(?:\.(?:\d+|x|\*))?$/i.test(token)) {
      const expanded = this._normalizeWildcardRange(token);
      return this._satisfiesRangeAnd(versionArr, expanded);
    }

    const m = token.match(/^(>=|<=|>|<|=|\^|~)?\s*v?([0-9]+(?:\.[0-9]+)?(?:\.[0-9]+)?(?:-[A-Za-z0-9.-]+)?)$/);
    if (!m) return false;
    const op = m[1] || '=';
    const base = this._parseSemver(m[2]);
    if (!base) return false;
    const cmp = this._compareSemver(versionArr, base);

    if (op === '=') return cmp === 0;
    if (op === '>') return cmp > 0;
    if (op === '>=') return cmp >= 0;
    if (op === '<') return cmp < 0;
    if (op === '<=') return cmp <= 0;
    if (op === '^') {
      if (cmp < 0) return false;
      const upper = [base[0] + 1, 0, 0];
      return this._compareSemver(versionArr, upper) < 0;
    }
    if (op === '~') {
      if (cmp < 0) return false;
      const upper = [base[0], base[1] + 1, 0];
      return this._compareSemver(versionArr, upper) < 0;
    }
    return false;
  }

  _satisfiesRangeAnd(versionArr, rangeText) {
    const range = String(rangeText || '').trim();
    if (!range || range === '*') return true;
    const compact = this._normalizeWildcardRange(range);
    if (compact && compact !== range) return this._satisfiesRangeAnd(versionArr, compact);
    const parts = range.split(/\s+/).filter(Boolean);
    if (!parts.length) return true;
    return parts.every((part) => this._satisfiesComparator(versionArr, part));
  }

  _satisfiesEngineRange(version, rangeExpression) {
    const versionArr = this._parseSemver(version);
    if (!versionArr) return false;
    const branches = String(rangeExpression || '').split('||').map((s) => s.trim()).filter(Boolean);
    if (!branches.length) return true;
    return branches.some((branch) => this._satisfiesRangeAnd(versionArr, branch));
  }

  async rejectNativeBinaries(rootDir) {
    const stack = [rootDir];
    while (stack.length) {
      const current = stack.pop();
      const entries = await fs.promises.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.node')) {
          throw new Error(`Native module is not allowed in Coder extension compatibility mode: ${entry.name}`);
        }
      }
    }
  }
}

module.exports = VsixInstaller;
