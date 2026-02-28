const fs = require('fs');
const path = require('path');

class ExtensionAuditLogger {
  constructor(options = {}) {
    this.rootDir = path.resolve(String(options.rootDir || '.'));
    this.filePath = path.join(this.rootDir, 'extension-audit.log');
    this._ready = false;
    this._queue = Promise.resolve();
  }

  async ensureReady() {
    if (this._ready) return;
    await fs.promises.mkdir(this.rootDir, { recursive: true });
    this._ready = true;
  }

  async log(entry = {}) {
    const record = {
      ts: new Date().toISOString(),
      ...entry
    };
    this._queue = this._queue
      .catch(() => {})
      .then(async () => {
        await this.ensureReady();
        await fs.promises.appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf8');
      })
      .catch((error) => {
        console.warn('[Coder][Extensions][Audit] Failed to write audit log:', error?.message || error);
      });
    return this._queue;
  }
}

module.exports = ExtensionAuditLogger;
