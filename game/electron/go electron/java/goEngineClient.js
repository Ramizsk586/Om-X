// Gamehub/games/go/java/goEngineClient.js
const { spawn } = require('child_process');

class GoEngineClient {
  constructor(cmd, args = []) {
    try {
        this.proc = spawn(cmd, args);
    } catch (e) {
        console.error(`Failed to spawn engine: ${cmd} with args ${args}`, e);
        throw e;
    }
    
    this.queue = [];
    this.currentResolve = null;
    this.buffer = '';

    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', data => this._handleOutput(data));
    this.proc.stderr.on('data', data => console.error(`[GoEngine STDERR] ${data}`));
    this.proc.on('close', (code) => console.log(`GoEngine process exited with code ${code}`));
    this.proc.on('error', (err) => console.error('GoEngine process error:', err));
  }

  _handleOutput(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue; // Skip empty lines

      // GTP responses start with '=' (success) or '?' (failure)
      if (trimmedLine.startsWith('=') || trimmedLine.startsWith('?')) {
        if (this.currentResolve) {
          const resolve = this.currentResolve;
          this.currentResolve = null;
          resolve(trimmedLine);
          this._flushQueue();
        }
      }
    }
  }

  _flushQueue() {
    if (this.queue.length === 0 || this.currentResolve) return;
    const { cmd, resolve } = this.queue.shift();
    this.currentResolve = resolve;
    this.proc.stdin.write(cmd + '\n');
  }

  send(cmd) {
    return new Promise((resolve, reject) => {
      // Add a timeout to prevent hanging on long operations (genmove might take time)
      const timeout = cmd.startsWith('genmove') ? 300000 : 10000;
      const timeoutId = setTimeout(() => {
          if (this.currentResolve) {
            this.currentResolve = null;
            reject(new Error(`GTP command timed out after ${timeout}ms: ${cmd}`));
            this._flushQueue(); // Try to process next command
          }
      }, timeout);

      const resolveWrapper = (result) => {
          clearTimeout(timeoutId);
          resolve(result);
      };

      this.queue.push({ cmd, resolve: resolveWrapper });
      this._flushQueue();
    });
  }

  close() {
    this.proc.kill();
  }
}

module.exports = GoEngineClient;
