const path = require('path');
const fs = require('fs');

class ExtensionWorkspaceBroker {
  constructor(options = {}) {
    this.makeEventForWindowId = options.makeEventForWindowId;
    this.getWorkspaceRootsForWindow = options.getWorkspaceRootsForWindow;
    this.assertCoderPathAllowed = options.assertCoderPathAllowed;
    this.normalizeRequiredFsPath = options.normalizeRequiredFsPath;
    this.canRenameCoderPathTo = options.canRenameCoderPathTo;
    this.rewriteCoderScopesAfterRename = options.rewriteCoderScopesAfterRename;
    this.maxFindEntries = Number(options.maxFindEntries) || 500;
    this.maxFileReadBytes = Number(options.maxFileReadBytes) || 2 * 1024 * 1024;
    this.maxFileWriteBytes = Number(options.maxFileWriteBytes) || 4 * 1024 * 1024;
    this.maxDirectoryEntries = Number(options.maxDirectoryEntries) || 2000;
  }

  _requireWindowId(windowId) {
    const id = Number(windowId) || 0;
    if (!id) throw new Error('windowId is required');
    return id;
  }

  _getEvent(windowId) {
    const event = this.makeEventForWindowId?.(windowId);
    if (!event?.sender) throw new Error('Coder window is unavailable');
    return event;
  }

  _getRoots(windowId) {
    const roots = this.getWorkspaceRootsForWindow?.(windowId);
    return Array.isArray(roots) ? roots.map((p) => path.resolve(String(p))) : [];
  }

  _resolveTarget(windowId, inputPath, label = 'path') {
    const id = this._requireWindowId(windowId);
    const raw = String(inputPath || '').trim();
    if (!raw) throw new Error(`${label} is required`);

    let abs;
    if (path.isAbsolute(raw)) {
      abs = this.normalizeRequiredFsPath(raw, label);
    } else {
      const roots = this._getRoots(id);
      if (!roots.length) throw new Error('No approved workspace scope is available');
      abs = this.normalizeRequiredFsPath(path.join(roots[0], raw), label);
    }
    return this.assertCoderPathAllowed(this._getEvent(id), abs, label);
  }

  async readFile(params = {}) {
    const abs = this._resolveTarget(params.windowId, params.path, 'path');
    const stat = await fs.promises.stat(abs);
    if (!stat.isFile()) throw new Error('Target path is not a file');
    if (stat.size > this.maxFileReadBytes) {
      throw new Error(`File exceeds broker read limit (${this.maxFileReadBytes} bytes)`);
    }
    const encoding = params.encoding === 'base64' ? null : 'utf8';
    const content = await fs.promises.readFile(abs, encoding || undefined);
    return {
      path: abs,
      encoding: encoding ? 'utf8' : 'base64',
      content: encoding ? content : Buffer.from(content).toString('base64')
    };
  }

  async writeFile(params = {}) {
    const abs = this._resolveTarget(params.windowId, params.path, 'path');
    const encoding = params.encoding === 'base64' ? 'base64' : 'utf8';
    const raw = params.content ?? '';
    const data = encoding === 'base64' ? Buffer.from(String(raw), 'base64') : String(raw);
    const byteLength = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data, 'utf8');
    if (byteLength > this.maxFileWriteBytes) {
      throw new Error(`File exceeds broker write limit (${this.maxFileWriteBytes} bytes)`);
    }
    await fs.promises.writeFile(abs, data);
    return { ok: true, path: abs };
  }

  async stat(params = {}) {
    try {
      const abs = this._resolveTarget(params.windowId, params.path, 'path');
      const stat = await fs.promises.stat(abs);
      return {
        exists: true,
        path: abs,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        size: stat.size,
        mtimeMs: stat.mtimeMs
      };
    } catch (_) {
      return { exists: false, isFile: false, isDirectory: false, size: 0, mtimeMs: 0 };
    }
  }

  async readDirectory(params = {}) {
    const abs = this._resolveTarget(params.windowId, params.path, 'path');
    const stat = await fs.promises.stat(abs);
    if (!stat.isDirectory()) throw new Error('Target path is not a directory');
    const dirents = await fs.promises.readdir(abs, { withFileTypes: true });
    return dirents
      .slice(0, this.maxDirectoryEntries)
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : (entry.isFile() ? 'file' : 'other')
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
  }

  async createDirectory(params = {}) {
    const abs = this._resolveTarget(params.windowId, params.path, 'path');
    await fs.promises.mkdir(abs, { recursive: true });
    return { ok: true, path: abs };
  }

  async deletePath(params = {}) {
    const abs = this._resolveTarget(params.windowId, params.path, 'path');
    const stat = await fs.promises.stat(abs);
    if (stat.isDirectory()) await fs.promises.rm(abs, { recursive: true, force: false });
    else await fs.promises.unlink(abs);
    return { ok: true, path: abs };
  }

  async renamePath(params = {}) {
    const id = this._requireWindowId(params.windowId);
    const oldAbs = this.normalizeRequiredFsPath(params.oldPath, 'oldPath');
    const event = this._getEvent(id);
    this.assertCoderPathAllowed(event, oldAbs, 'oldPath');
    const newRaw = String(params.newPath || '').trim();
    const roots = this._getRoots(id);
    if (!path.isAbsolute(newRaw) && !roots.length) {
      throw new Error('No approved workspace scope is available');
    }
    const newAbs = path.isAbsolute(newRaw)
      ? this.normalizeRequiredFsPath(newRaw, 'newPath')
      : this.normalizeRequiredFsPath(path.join(roots[0], newRaw), 'newPath');
    if (!this.canRenameCoderPathTo(event, oldAbs, newAbs)) {
      throw new Error('Rename target is outside the approved Coder workspace');
    }
    await fs.promises.rename(oldAbs, newAbs);
    this.rewriteCoderScopesAfterRename(event, oldAbs, newAbs);
    return { ok: true, oldPath: oldAbs, newPath: newAbs };
  }

  async listFiles(params = {}) {
    const windowId = this._requireWindowId(params.windowId);
    const startPath = params.path
      ? this._resolveTarget(windowId, params.path, 'path')
      : (this._getRoots(windowId)[0] || null);
    if (!startPath) return [];
    const maxEntries = Math.max(1, Math.min(this.maxFindEntries, Number(params.maxEntries) || this.maxFindEntries));
    const out = [];
    const stack = [startPath];
    while (stack.length && out.length < maxEntries) {
      const current = stack.pop();
      let stat;
      try {
        stat = await fs.promises.stat(current);
      } catch (_) {
        continue;
      }
      if (stat.isDirectory()) {
        let entries = [];
        try {
          entries = await fs.promises.readdir(current, { withFileTypes: true });
        } catch (_) {
          entries = [];
        }
        for (const entry of entries.reverse()) {
          const next = path.join(current, entry.name);
          if (entry.isDirectory()) stack.push(next);
          else if (entry.isFile()) out.push(next);
          if (out.length >= maxEntries) break;
        }
      } else if (stat.isFile()) {
        out.push(current);
      }
    }
    return out;
  }

  async findFiles(params = {}) {
    const include = String(params.include || '').trim().toLowerCase();
    const files = await this.listFiles(params);
    if (!include) return files;
    return files.filter((p) => p.toLowerCase().includes(include));
  }
}

module.exports = ExtensionWorkspaceBroker;
