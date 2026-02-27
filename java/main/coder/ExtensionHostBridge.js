const path = require('path');
const { EventEmitter } = require('events');
const { fork } = require('child_process');
const { sanitizeExtensionHostEnv } = require('./ExtensionPolicy');

class ExtensionHostBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.hostScriptPath = path.resolve(String(options.hostScriptPath));
    this.logger = options.logger || console;
    this.child = null;
    this.started = false;
    this.nextId = 1;
    this.pending = new Map();
    this.requestHandler = null;
    this.heartbeatTimer = null;
    this.heartbeatIntervalMs = Math.max(5000, Number(options.heartbeatIntervalMs) || 20000);
    this.heartbeatTimeoutMs = Math.max(1000, Number(options.heartbeatTimeoutMs) || 7000);
    this.heartbeatInFlight = false;
  }

  setRequestHandler(handler) {
    this.requestHandler = typeof handler === 'function' ? handler : null;
  }

  async start() {
    if (this.child && !this.child.killed) return;
    const child = fork(this.hostScriptPath, [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: sanitizeExtensionHostEnv(process.env),
      execArgv: [],
      windowsHide: true
    });
    this.child = child;
    this.started = true;

    child.on('message', (message) => {
      void this._handleMessage(message);
    });

    child.on('exit', (code, signal) => {
      this._stopHeartbeat();
      this.started = false;
      this.child = null;
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`Extension host exited (${code ?? 'unknown'}${signal ? `, ${signal}` : ''})`));
      }
      this.pending.clear();
      this.emit('event', { type: 'host-status', status: 'exited', code, signal });
    });

    child.on('error', (error) => {
      this.emit('event', {
        type: 'host-status',
        status: 'error',
        message: error?.message || String(error)
      });
    });

    this._startHeartbeat();
    this.emit('event', { type: 'host-status', status: 'started' });
  }

  async stop() {
    if (!this.child) return;
    this._stopHeartbeat();
    try {
      await this.request('host.shutdown', {}, {}, 2000);
    } catch (_) {
      // best effort
    }
    try {
      this.child.kill();
    } catch (_) {}
    this.child = null;
    this.started = false;
  }

  async request(method, params = {}, meta = {}, timeoutMs = 15000) {
    await this.start();
    if (!this.child) throw new Error('Extension host is unavailable');

    const id = `m_${Date.now()}_${this.nextId++}`;
    const payload = { t: 'req', id, method, params, meta };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Extension host request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child.send(payload);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async notify(method, params = {}, meta = {}) {
    await this.start();
    if (!this.child) throw new Error('Extension host is unavailable');
    this.child.send({ t: 'notify', method, params, meta });
  }

  async _handleMessage(message) {
    if (!message || typeof message !== 'object') return;

    if (message.t === 'res') {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.ok === false) {
        const error = new Error(message.error?.message || 'Extension host error');
        error.code = message.error?.code;
        pending.reject(error);
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.t === 'event') {
      this.emit('event', message.payload || message);
      return;
    }

    if (message.t === 'req') {
      if (!this.requestHandler) {
        this._sendReply(message.id, false, null, { code: 'ERR_NO_HANDLER', message: 'No host request handler configured' });
        return;
      }
      try {
        const result = await this.requestHandler(message.method, message.params || {}, message.meta || {});
        this._sendReply(message.id, true, result, null);
      } catch (error) {
        this._sendReply(message.id, false, null, {
          code: error?.code || 'ERR_MAIN_BRIDGE',
          message: error?.message || String(error)
        });
      }
    }
  }

  _sendReply(id, ok, result, error) {
    if (!this.child) return;
    try {
      this.child.send(ok ? { t: 'res', id, ok: true, result } : { t: 'res', id, ok: false, error });
    } catch (_) {
      // best effort
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    if (!this.heartbeatIntervalMs) return;
    this.heartbeatTimer = setInterval(() => {
      void this._heartbeatTick();
    }, this.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  _stopHeartbeat() {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.heartbeatInFlight = false;
  }

  async _heartbeatTick() {
    if (!this.child || this.heartbeatInFlight) return;
    this.heartbeatInFlight = true;
    try {
      await this.request('host.ping', {}, {}, this.heartbeatTimeoutMs);
    } catch (error) {
      this.emit('event', {
        type: 'host-status',
        status: 'heartbeat-failed',
        message: error?.message || String(error)
      });
    } finally {
      this.heartbeatInFlight = false;
    }
  }
}

module.exports = ExtensionHostBridge;
