const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { sanitizeExtensionHostEnv } = require('./ExtensionPolicy');

class ContentLengthMessageParser {
  constructor(options = {}) {
    this.maxMessageBytes = Math.max(1024, Number(options.maxMessageBytes) || 5 * 1024 * 1024);
    this.buffer = Buffer.alloc(0);
    this.expectedLength = null;
  }

  push(chunk, onMessage) {
    if (!chunk || !chunk.length) return;
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk);
    this._drain(onMessage);
  }

  _drain(onMessage) {
    while (true) {
      if (this.expectedLength == null) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) return;
        const headerText = this.buffer.slice(0, headerEnd).toString('utf8');
        const headers = {};
        for (const line of headerText.split(/\r\n/)) {
          const idx = line.indexOf(':');
          if (idx <= 0) continue;
          const key = line.slice(0, idx).trim().toLowerCase();
          const value = line.slice(idx + 1).trim();
          headers[key] = value;
        }
        const len = Number(headers['content-length']);
        if (!Number.isFinite(len) || len < 0) {
          throw new Error('Invalid Content-Length header');
        }
        if (len > this.maxMessageBytes) {
          throw new Error(`Protocol message exceeds limit (${this.maxMessageBytes} bytes)`);
        }
        this.expectedLength = len;
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      if (this.buffer.length < this.expectedLength) return;
      const body = this.buffer.slice(0, this.expectedLength);
      this.buffer = this.buffer.slice(this.expectedLength);
      this.expectedLength = null;

      if (!body.length) continue;
      let parsed;
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch (error) {
        throw new Error(`Invalid protocol JSON: ${error?.message || error}`);
      }
      onMessage(parsed);
    }
  }
}

function encodeContentLengthMessage(message) {
  const json = JSON.stringify(message ?? null);
  const body = Buffer.from(json, 'utf8');
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8'),
    body
  ]);
}

class ExtensionProcessBroker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = options.logger || console;
    this.getWorkspaceRootsForWindow = options.getWorkspaceRootsForWindow || (() => []);
    this.getExtensionInstallPath = options.getExtensionInstallPath || (() => '');
    this.maxSessions = Math.max(1, Number(options.maxSessions) || 24);
    this.maxMessageBytes = Math.max(1024, Number(options.maxMessageBytes) || 5 * 1024 * 1024);
    this.maxStderrChunkBytes = Math.max(256, Number(options.maxStderrChunkBytes) || 8192);
    this.nextSessionId = 1;
    this.sessions = new Map();
  }

  _emitEvent(payload) {
    this.emit('event', payload);
  }

  _assertWindowId(windowId) {
    const id = Number(windowId) || 0;
    if (!id) throw new Error('windowId is required');
    return id;
  }

  _sanitizeArgs(args) {
    const list = Array.isArray(args) ? args : [];
    if (list.length > 64) throw new Error('Too many process arguments');
    return list.map((arg) => {
      const value = String(arg ?? '');
      if (value.length > 4096) throw new Error('Process argument exceeds limit');
      return value;
    });
  }

  _workspaceRoots(windowId) {
    try {
      const roots = this.getWorkspaceRootsForWindow(this._assertWindowId(windowId));
      return Array.isArray(roots) ? roots.map((p) => path.resolve(String(p))) : [];
    } catch (_) {
      return [];
    }
  }

  _extensionRoot(extensionId) {
    const p = String(this.getExtensionInstallPath(String(extensionId || '')) || '').trim();
    return p ? path.resolve(p) : '';
  }

  _isInsideRoot(root, target) {
    if (!root) return false;
    const absRoot = path.resolve(root);
    const abs = path.resolve(target);
    return abs === absRoot || abs.startsWith(`${absRoot}${path.sep}`);
  }

  _resolveAllowedPath(candidatePath, { extensionId, windowId, allowWorkspace = true, label = 'path' } = {}) {
    const raw = String(candidatePath || '').trim();
    if (!raw) throw new Error(`${label} is required`);
    const abs = path.resolve(raw);
    const extRoot = this._extensionRoot(extensionId);
    const roots = [extRoot, ...(allowWorkspace ? this._workspaceRoots(windowId) : [])].filter(Boolean);
    if (!roots.length) throw new Error(`No approved roots available for ${label}`);
    if (!roots.some((root) => this._isInsideRoot(root, abs))) {
      throw new Error(`${label} is outside approved extension/workspace roots`);
    }
    return abs;
  }

  _resolveSpawnSpec(params = {}, meta = {}) {
    const protocol = String(params.protocol || meta.protocol || '').trim().toLowerCase();
    if (protocol !== 'lsp' && protocol !== 'dap') throw new Error('Unsupported protocol session type');
    const windowId = this._assertWindowId(params.windowId || meta.windowId);
    const extensionId = String(meta.extensionId || params.extensionId || '').trim();
    if (!extensionId) throw new Error('extensionId is required');
    const runtime = String(params.runtime || (params.scriptPath ? 'node' : 'binary')).trim().toLowerCase();
    const extraArgs = this._sanitizeArgs(params.args);

    let command = '';
    let args = [];
    if (runtime === 'node') {
      const scriptPath = this._resolveAllowedPath(params.scriptPath, { extensionId, windowId, label: 'scriptPath' });
      command = process.execPath;
      args = [scriptPath, ...extraArgs];
    } else if (runtime === 'binary') {
      command = this._resolveAllowedPath(params.command, { extensionId, windowId, label: 'command' });
      const ext = path.extname(command).toLowerCase();
      if (ext === '.cmd' || ext === '.bat' || ext === '.ps1') {
        throw new Error('Shell wrapper executables are not allowed; use runtime=node or a direct binary');
      }
      args = extraArgs;
    } else {
      throw new Error(`Unsupported process runtime: ${runtime}`);
    }

    let cwd = '';
    if (params.cwd) {
      cwd = this._resolveAllowedPath(params.cwd, { extensionId, windowId, label: 'cwd' });
    } else {
      cwd = this._workspaceRoots(windowId)[0] || this._extensionRoot(extensionId) || path.dirname(command);
    }
    if (!fs.existsSync(command)) throw new Error('Spawn command not found');

    const env = sanitizeExtensionHostEnv(process.env);
    return { protocol, windowId, extensionId, runtime, command, args, cwd };
  }

  async spawnSession(params = {}, meta = {}) {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Too many active extension protocol sessions (${this.maxSessions})`);
    }
    const spec = this._resolveSpawnSpec(params, meta);
    const sessionId = `${spec.protocol}_${Date.now()}_${this.nextSessionId++}`;

    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: sanitizeExtensionHostEnv(process.env),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true
    });

    const parser = new ContentLengthMessageParser({ maxMessageBytes: this.maxMessageBytes });
    const session = {
      id: sessionId,
      protocol: spec.protocol,
      windowId: spec.windowId,
      extensionId: spec.extensionId,
      runtime: spec.runtime,
      command: spec.command,
      args: spec.args.slice(),
      cwd: spec.cwd,
      proc: child,
      parser,
      createdAt: Date.now()
    };
    this.sessions.set(sessionId, session);

    child.stdout?.on('data', (chunk) => {
      try {
        parser.push(chunk, (message) => {
          this._emitEvent({
            type: 'protocol-message',
            protocol: session.protocol,
            sessionId,
            windowId: session.windowId,
            extensionId: session.extensionId,
            message
          });
        });
      } catch (error) {
        this._emitEvent({
          type: 'protocol-error',
          protocol: session.protocol,
          sessionId,
          windowId: session.windowId,
          extensionId: session.extensionId,
          message: error?.message || String(error)
        });
      }
    });

    child.stderr?.on('data', (chunk) => {
      const text = Buffer.from(chunk || []).toString('utf8').slice(0, this.maxStderrChunkBytes);
      this._emitEvent({
        type: 'protocol-stderr',
        protocol: session.protocol,
        sessionId,
        windowId: session.windowId,
        extensionId: session.extensionId,
        text
      });
    });

    child.on('error', (error) => {
      this._emitEvent({
        type: 'protocol-error',
        protocol: session.protocol,
        sessionId,
        windowId: session.windowId,
        extensionId: session.extensionId,
        message: error?.message || String(error)
      });
    });

    child.on('exit', (code, signal) => {
      this.sessions.delete(sessionId);
      this._emitEvent({
        type: 'protocol-exit',
        protocol: session.protocol,
        sessionId,
        windowId: session.windowId,
        extensionId: session.extensionId,
        code: Number.isFinite(code) ? code : null,
        signal: signal || null
      });
    });

    this._emitEvent({
      type: 'protocol-spawn',
      protocol: session.protocol,
      sessionId,
      windowId: session.windowId,
      extensionId: session.extensionId,
      pid: child.pid || 0,
      command: path.basename(spec.command)
    });

    return {
      sessionId,
      protocol: session.protocol,
      pid: child.pid || 0,
      command: path.basename(spec.command),
      cwd: session.cwd
    };
  }

  async sendMessage(params = {}, meta = {}) {
    const sessionId = String(params.sessionId || '').trim();
    if (!sessionId) throw new Error('sessionId is required');
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Protocol session not found');
    const windowId = this._assertWindowId(meta.windowId || params.windowId || session.windowId);
    if (session.windowId !== windowId) throw new Error('Protocol session does not belong to this Coder window');
    const extensionId = String(meta.extensionId || params.extensionId || '').trim();
    if (extensionId && session.extensionId !== extensionId) throw new Error('Protocol session does not belong to this extension');
    if (!session.proc || session.proc.killed) throw new Error('Protocol process is not running');

    const message = params.message;
    if (message == null || typeof message !== 'object') throw new Error('message object is required');
    const encoded = encodeContentLengthMessage(message);
    if (encoded.length > this.maxMessageBytes + 1024) {
      throw new Error(`Encoded protocol message exceeds limit (${this.maxMessageBytes} bytes)`);
    }
    await new Promise((resolve, reject) => {
      session.proc.stdin.write(encoded, (error) => (error ? reject(error) : resolve()));
    });
    return { ok: true };
  }

  async stopSession(params = {}, meta = {}) {
    const sessionId = String(params.sessionId || '').trim();
    if (!sessionId) throw new Error('sessionId is required');
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: true, stopped: false };
    const windowId = this._assertWindowId(meta.windowId || params.windowId || session.windowId);
    if (session.windowId !== windowId) throw new Error('Protocol session does not belong to this Coder window');
    const extensionId = String(meta.extensionId || params.extensionId || '').trim();
    if (extensionId && session.extensionId !== extensionId) throw new Error('Protocol session does not belong to this extension');
    try {
      session.proc.kill();
    } catch (_) {}
    return { ok: true, stopped: true };
  }

  async stopForWindow(windowId) {
    const wid = Number(windowId) || 0;
    if (!wid) return;
    const stops = [];
    for (const session of this.sessions.values()) {
      if (session.windowId !== wid) continue;
      stops.push(this.stopSession({ sessionId: session.id, windowId: wid }, { windowId: wid, extensionId: session.extensionId }).catch(() => null));
    }
    await Promise.allSettled(stops);
  }

  async stopForExtension(extensionId) {
    const extId = String(extensionId || '').trim();
    if (!extId) return;
    const stops = [];
    for (const session of this.sessions.values()) {
      if (session.extensionId !== extId) continue;
      stops.push(this.stopSession({ sessionId: session.id, windowId: session.windowId }, { windowId: session.windowId, extensionId: extId }).catch(() => null));
    }
    await Promise.allSettled(stops);
  }
}

module.exports = ExtensionProcessBroker;
