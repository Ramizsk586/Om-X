const electron = require('electron');
const app = electron.app || (electron.remote && electron.remote.app);
const ipcMain = electron.ipcMain;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const aiGuardian = require('./AIGuardian');

const TRUSTED_VAULT_PROTOCOLS = new Set(['file:', 'mindclone:']);

function isSameOrSubFsPath(targetPath, basePath) {
  const target = path.resolve(String(targetPath || ''));
  const base = path.resolve(String(basePath || ''));
  if (!target || !base) return false;
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function getTrustedVaultFileRoots() {
  const roots = [];
  try { roots.push(path.resolve(app.getAppPath())); } catch (_) {}
  try { roots.push(path.resolve(process.resourcesPath || '')); } catch (_) {}
  try { roots.push(path.resolve(process.cwd())); } catch (_) {}
  return roots.filter(Boolean);
}

const TRUSTED_VAULT_FILE_ROOTS = getTrustedVaultFileRoots();

function fileUrlToAbsolutePath(urlObj) {
  let pathname = decodeURIComponent(String(urlObj?.pathname || ''));
  if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(pathname)) {
    pathname = pathname.slice(1);
  }
  return path.resolve(pathname);
}

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
    const parsed = new URL(senderUrl);
    if (!TRUSTED_VAULT_PROTOCOLS.has(parsed.protocol)) return false;
    if (parsed.protocol !== 'file:') return true;
    const filePath = fileUrlToAbsolutePath(parsed);
    return TRUSTED_VAULT_FILE_ROOTS.some((root) => isSameOrSubFsPath(filePath, root));
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
    this.vaultSalt = this.loadVaultSalt();
    this.isUnlocked = false;
    this.sessionKey = null;
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

  loadVaultSalt() {
    try {
      if (fs.existsSync(this.configPath)) {
        const cfg = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        const salt = String(cfg.vaultSalt || '').trim();
        if (/^[a-f0-9]{32,}$/i.test(salt)) return salt.toLowerCase();
      }
    } catch (e) {
      console.error('[Vault] Salt Load Failure:', e);
    }
    return null;
  }

  saveMasterConfig(hash, salt) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify({ masterHash: hash, vaultSalt: salt }));
      this.masterHash = hash;
      this.vaultSalt = salt;
      return true;
    } catch (e) {
      console.error('[Vault] Config Save Failure:', e);
      return false;
    }
  }

  deriveSessionKey(pass, saltHex) {
    try {
      const passText = String(pass || '');
      const salt = Buffer.from(String(saltHex || ''), 'hex');
      if (!passText || !salt.length) return null;
      return crypto.pbkdf2Sync(passText, salt, 150000, 32, 'sha256');
    } catch (_) {
      return null;
    }
  }

  setSessionKeyFromPass(pass) {
    const salt = this.vaultSalt || crypto.randomBytes(16).toString('hex');
    const key = this.deriveSessionKey(pass, salt);
    if (!key) return false;
    this.sessionKey = key;
    this.vaultSalt = salt;
    return true;
  }

  encryptVaultEntries(entries = []) {
    if (!this.sessionKey) throw new Error('Vault session key is not available');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.sessionKey, iv);
    const plaintext = Buffer.from(JSON.stringify(Array.isArray(entries) ? entries : []), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      v: 1,
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: ciphertext.toString('base64')
    };
  }

  decryptVaultEnvelope(envelope) {
    if (!this.sessionKey) throw new Error('Vault session key is not available');
    if (!envelope || typeof envelope !== 'object') return [];
    const iv = Buffer.from(String(envelope.iv || ''), 'base64');
    const tag = Buffer.from(String(envelope.tag || ''), 'base64');
    const data = Buffer.from(String(envelope.data || ''), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.sessionKey, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    return Array.isArray(parsed) ? parsed : [];
  }

  readVaultEntries() {
    try {
      if (!fs.existsSync(this.vaultPath)) return [];
      const raw = fs.readFileSync(this.vaultPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed; // legacy plaintext format
      if (parsed && parsed.v === 1 && parsed.alg === 'aes-256-gcm') {
        return this.decryptVaultEnvelope(parsed);
      }
    } catch (e) {
      console.error('[Vault] Read Failure:', e?.message || e);
    }
    return [];
  }

  writeVaultEntries(entries = []) {
    if (!this.sessionKey) throw new Error('Vault session key is not available');
    const envelope = this.encryptVaultEntries(entries);
    fs.writeFileSync(this.vaultPath, JSON.stringify(envelope, null, 2));
    return true;
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
    this.sessionKey = null;
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
        const salt = crypto.randomBytes(16).toString('hex');
        const nextHash = crypto.createHash('sha256').update(next).digest('hex');
        const saved = this.saveMasterConfig(nextHash, salt);
        if (saved) {
          this.setSessionKeyFromPass(next);
          this.isUnlocked = true;
        }
        return saved;
      }

      const currentHash = crypto.createHash('sha256').update(String(current || '')).digest('hex');
      if (currentHash !== this.masterHash) return false;

      if (!this.setSessionKeyFromPass(current)) return false;
      const existingEntries = this.readVaultEntries();
      const nextSalt = crypto.randomBytes(16).toString('hex');
      const nextHash = crypto.createHash('sha256').update(next).digest('hex');
      const saved = this.saveMasterConfig(nextHash, nextSalt);
      if (!saved) return false;
      if (!this.setSessionKeyFromPass(next)) return false;
      return this.writeVaultEntries(existingEntries);
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
        const salt = crypto.randomBytes(16).toString('hex');
        const nextHash = crypto.createHash('sha256').update(normalizedPass).digest('hex');
        const saved = this.saveMasterConfig(nextHash, salt);
        if (saved) {
          this.setSessionKeyFromPass(normalizedPass);
          this.isUnlocked = true;
        }
        return saved;
      }

      const success = crypto.createHash('sha256').update(normalizedPass).digest('hex') === this.masterHash;
      if (success) {
        this.setSessionKeyFromPass(normalizedPass);
        this.isUnlocked = true;
      }
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
        return this.readVaultEntries().map((entry) => ({
          ...entry,
          password: '********'
        }));
      } catch (_) {
        return [];
      }
      return [];
    });

    ipcMain.handle('vault:add', async (e, entry) => {
      if (!this.isTrustedCaller(e)) return false;
      if (!this.isUnlocked) return false;
      try {
        const list = this.readVaultEntries();
        list.push({ ...entry, id: Date.now().toString() });
        return this.writeVaultEntries(list);
      } catch (_) {
        return false;
      }
    });

    ipcMain.handle('vault:delete', async (e, id) => {
      if (!this.isTrustedCaller(e)) return false;
      if (!this.isUnlocked) return false;
      try {
        const list = this.readVaultEntries();
        const filtered = list.filter((item) => item.id !== id);
        return this.writeVaultEntries(filtered);
      } catch (_) {
        return false;
      }
    });
  }
}

module.exports = new VaultManager();
