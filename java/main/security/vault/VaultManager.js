const electron = require('electron');
const app = electron.app || (electron.remote && electron.remote.app);
const ipcMain = electron.ipcMain;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const aiGuardian = require('./AIGuardian');

const TRUSTED_VAULT_PROTOCOLS = new Set(['file:', 'mindclone:']);

function getSenderUrl(event) {
  try {
    const frameUrl = event?.senderFrame?.url;
    if (typeof frameUrl === 'string' && frameUrl) return frameUrl;
  } catch (_) {}
  try {
    if (event?.sender && typeof event.sender.getURL === 'function') {
      return event.sender.getURL() || '';
    }
  } catch (_) {}
  return '';
}

function isTrustedVaultCaller(event) {
  const senderUrl = getSenderUrl(event);
  if (!senderUrl) return false;
  try {
    return TRUSTED_VAULT_PROTOCOLS.has(new URL(senderUrl).protocol);
  } catch (_) {
    return false;
  }
}

class VaultManager {
  constructor() {
    const userDataPath = app && typeof app.getPath === 'function'
      ? app.getPath('userData')
      : process.cwd();

    this.vaultPath = path.join(userDataPath, 'password-vault.json');
    this.trustPath = path.join(userDataPath, 'trusted-sites-manifest.json');
    this.configPath = path.join(userDataPath, 'vault-config.json');

    // No hardcoded default passkey fallback. Vault is initialized on first unlock/change-passkey.
    this.masterHash = this.loadMasterHash();
    this.isUnlocked = false;
    this.trustedManifest = new Set();
    this.tabAuthorizations = new Map();

    this.loadManifests();
  }

  loadMasterHash() {
    try {
      if (fs.existsSync(this.configPath)) {
        const cfg = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        if (typeof cfg.masterHash === 'string' && cfg.masterHash.length === 64) return cfg.masterHash;
      }
    } catch (e) {
      console.error('[Vault] Config Load Failure:', e);
    }
    return null;
  }

  saveMasterHash(hash) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({ masterHash: hash }));
      this.masterHash = hash;
      return true;
    } catch (e) {
      console.error('[Vault] Config Save Failure:', e);
      return false;
    }
  }

  loadManifests() {
    try {
      if (fs.existsSync(this.trustPath)) {
        const data = JSON.parse(fs.readFileSync(this.trustPath, 'utf8'));
        this.trustedManifest = new Set(data.map((d) => aiGuardian.getPrimaryIdentity(d)));
      }
    } catch (e) {
      console.error('[Vault] Manifest Load Failure:', e);
    }
  }

  saveManifests() {
    try {
      fs.writeFileSync(this.trustPath, JSON.stringify(Array.from(this.trustedManifest)));
    } catch (e) {
      console.error('[Vault] Persistence Failure:', e);
    }
  }

  isTrustedCaller(event) {
    return isTrustedVaultCaller(event);
  }

  isValidPasskey(pass) {
    return typeof pass === 'string' && pass.trim().length >= 8;
  }

  isAuthorized(tabId, hostname) {
    if (!hostname) return true;
    const identity = aiGuardian.getPrimaryIdentity(hostname);

    if (this.trustedManifest.has(identity)) return true;

    const authorizedDomains = this.tabAuthorizations.get(tabId);
    return !!(authorizedDomains && authorizedDomains.has(identity));
  }

  authorizeDomainForTab(tabId, hostname, password) {
    if (!this.masterHash) return false;
    const inputHash = crypto.createHash('sha256').update(String(password || '')).digest('hex');
    if (inputHash === this.masterHash) {
      const identity = aiGuardian.getPrimaryIdentity(hostname);
      if (!identity) return false;

      if (!this.tabAuthorizations.has(tabId)) {
        this.tabAuthorizations.set(tabId, new Set());
      }

      this.tabAuthorizations.get(tabId).add(identity);
      aiGuardian.resetTab(tabId);
      return true;
    }
    return false;
  }

  lock() {
    this.isUnlocked = false;
    this.tabAuthorizations.clear();
  }

  registerHandlers() {
    if (!ipcMain || typeof ipcMain.handle !== 'function') return;

    ipcMain.handle('vault:verify-lock', (e, { domain, password }) => {
      if (!this.isTrustedCaller(e)) return false;
      if (!this.masterHash) return false;
      return this.authorizeDomainForTab(e.sender.id, domain, password);
    });

    ipcMain.handle('vault:change-passkey', (e, { current, next }) => {
      if (!this.isTrustedCaller(e)) return false;
      if (!this.isValidPasskey(next)) return false;

      if (!this.masterHash) {
        const nextHash = crypto.createHash('sha256').update(next).digest('hex');
        const saved = this.saveMasterHash(nextHash);
        if (saved) this.isUnlocked = true;
        return saved;
      }

      const currentHash = crypto.createHash('sha256').update(String(current || '')).digest('hex');
      if (currentHash !== this.masterHash) return false;

      const nextHash = crypto.createHash('sha256').update(next).digest('hex');
      return this.saveMasterHash(nextHash);
    });

    ipcMain.handle('vault:sites-trust', (e, domain) => {
      if (!this.isTrustedCaller(e)) return false;
      const identity = aiGuardian.getPrimaryIdentity(domain);
      if (!identity) return false;
      this.trustedManifest.add(identity);
      aiGuardian.resetRiskForDomain(domain);
      this.saveManifests();
      return true;
    });

    ipcMain.handle('vault:sites-is-trusted', (e, domain) => {
      if (!this.isTrustedCaller(e)) return false;
      const identity = aiGuardian.getPrimaryIdentity(domain);
      return this.trustedManifest.has(identity);
    });

    ipcMain.handle('vault:sites-list-trusted', (e) => {
      if (!this.isTrustedCaller(e)) return [];
      return Array.from(this.trustedManifest)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    });

    ipcMain.handle('vault:sites-untrust', (e, domain) => {
      if (!this.isTrustedCaller(e)) return false;
      const identity = aiGuardian.getPrimaryIdentity(domain);
      if (!identity) return false;
      const wasRemoved = this.trustedManifest.delete(identity);
      if (wasRemoved) this.saveManifests();
      return wasRemoved;
    });

    ipcMain.handle('vault:unlock', async (e, pass) => {
      if (!this.isTrustedCaller(e)) return false;
      const normalizedPass = String(pass || '');

      // First unlock initializes the vault passkey (must be strong enough).
      if (!this.masterHash) {
        if (!this.isValidPasskey(normalizedPass)) return false;
        const nextHash = crypto.createHash('sha256').update(normalizedPass).digest('hex');
        const saved = this.saveMasterHash(nextHash);
        if (saved) this.isUnlocked = true;
        return saved;
      }

      const success = crypto.createHash('sha256').update(normalizedPass).digest('hex') === this.masterHash;
      if (success) this.isUnlocked = true;
      return success;
    });

    ipcMain.handle('vault:lock', (e) => {
      if (!this.isTrustedCaller(e)) return false;
      this.lock();
      return true;
    });

    ipcMain.handle('vault:status', (e) => {
      if (!this.isTrustedCaller(e)) return false;
      return this.isUnlocked;
    });

    ipcMain.handle('vault:list', async (e) => {
      if (!this.isTrustedCaller(e)) return [];
      if (!this.isUnlocked) return [];
      try {
        if (fs.existsSync(this.vaultPath)) {
          return JSON.parse(fs.readFileSync(this.vaultPath, 'utf8')).map((entry) => ({
            ...entry,
            password: '********'
          }));
        }
      } catch (_) {
        return [];
      }
      return [];
    });

    ipcMain.handle('vault:add', async (e, entry) => {
      if (!this.isTrustedCaller(e)) return false;
      if (!this.isUnlocked) return false;
      try {
        const list = fs.existsSync(this.vaultPath)
          ? JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'))
          : [];
        list.push({ ...entry, id: Date.now().toString() });
        fs.writeFileSync(this.vaultPath, JSON.stringify(list, null, 2));
        return true;
      } catch (_) {
        return false;
      }
    });

    ipcMain.handle('vault:delete', async (e, id) => {
      if (!this.isTrustedCaller(e)) return false;
      if (!this.isUnlocked) return false;
      try {
        const list = JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'));
        const filtered = list.filter((item) => item.id !== id);
        fs.writeFileSync(this.vaultPath, JSON.stringify(filtered, null, 2));
        return true;
      } catch (_) {
        return false;
      }
    });
  }
}

module.exports = new VaultManager();
