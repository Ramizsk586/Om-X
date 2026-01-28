
const { app, ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const aiGuardian = require('./AIGuardian');

class VaultManager {
  constructor() {
    this.vaultPath = path.join(app.getPath('userData'), 'password-vault.json');
    this.trustPath = path.join(app.getPath('userData'), 'trusted-sites-manifest.json');
    this.configPath = path.join(app.getPath('userData'), 'vault-config.json');
    
    // Core Authority: Load persisted master key or default to '1234'
    this.masterHash = this.loadMasterHash();
    
    this.isUnlocked = false;
    
    // Manifest of user-trusted identities (Permanent Bypass)
    this.trustedManifest = new Set();
    
    // ACTIVE AUTHORIZATIONS (In-Memory Only, per-session/tab)
    this.tabAuthorizations = new Map();
    
    this.loadManifests();
  }

  loadMasterHash() {
    try {
        if (fs.existsSync(this.configPath)) {
            const cfg = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            if (cfg.masterHash) return cfg.masterHash;
        }
    } catch (e) { console.error("[Vault] Config Load Failure:", e); }
    return crypto.createHash('sha256').update('1234').digest('hex');
  }

  saveMasterHash(hash) {
    try {
        fs.writeFileSync(this.configPath, JSON.stringify({ masterHash: hash }));
        this.masterHash = hash;
        return true;
    } catch (e) {
        console.error("[Vault] Config Save Failure:", e);
        return false;
    }
  }

  loadManifests() {
    try {
      if (fs.existsSync(this.trustPath)) {
          const data = JSON.parse(fs.readFileSync(this.trustPath, 'utf8'));
          this.trustedManifest = new Set(data.map(d => aiGuardian.getPrimaryIdentity(d)));
      }
    } catch (e) { console.error("[Vault] Manifest Load Failure:", e); }
  }

  saveManifests() {
    try {
        fs.writeFileSync(this.trustPath, JSON.stringify(Array.from(this.trustedManifest)));
    } catch(e) { console.error("[Vault] Persistence Failure:", e); }
  }

  /**
   * Primary Authority Check for the Firewall.
   * Logic: Trusted > Dynamic Session Grants.
   */
  isAuthorized(tabId, hostname) {
    if (!hostname) return true;
    const identity = aiGuardian.getPrimaryIdentity(hostname);
    
    // 1. Permanent User Trust (Explicit Override)
    if (this.trustedManifest.has(identity)) return true;

    // 2. Check tab-scoped temporary grants (Session based)
    const authorizedDomains = this.tabAuthorizations.get(tabId);
    return !!(authorizedDomains && authorizedDomains.has(identity));
  }

  authorizeDomainForTab(tabId, hostname, password) {
    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    if (inputHash === this.masterHash) {
        const identity = aiGuardian.getPrimaryIdentity(hostname);
        
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
    ipcMain.handle('vault:verify-lock', (e, { domain, password }) => {
        return this.authorizeDomainForTab(e.sender.id, domain, password);
    });

    ipcMain.handle('vault:change-passkey', (e, { current, next }) => {
        const currentHash = crypto.createHash('sha256').update(current).digest('hex');
        if (currentHash === this.masterHash) {
            const nextHash = crypto.createHash('sha256').update(next).digest('hex');
            return this.saveMasterHash(nextHash);
        }
        return false;
    });

    // --- Trust Management (Override) ---
    ipcMain.handle('vault:sites-trust', (e, domain) => {
        const identity = aiGuardian.getPrimaryIdentity(domain);
        this.trustedManifest.add(identity);
        aiGuardian.resetRiskForDomain(domain);
        this.saveManifests();
        return true;
    });

    ipcMain.handle('vault:sites-is-trusted', (e, domain) => {
        const identity = aiGuardian.getPrimaryIdentity(domain);
        return this.trustedManifest.has(identity);
    });

    // --- Password Management ---
    ipcMain.handle('vault:unlock', async (e, pass) => {
        const success = (crypto.createHash('sha256').update(pass).digest('hex') === this.masterHash);
        if (success) this.isUnlocked = true;
        return success;
    });

    ipcMain.handle('vault:lock', () => { this.lock(); return true; });
    ipcMain.handle('vault:status', () => this.isUnlocked);
    
    ipcMain.handle('vault:list', async () => {
        if (!this.isUnlocked) return [];
        try {
            if (fs.existsSync(this.vaultPath)) {
                return JSON.parse(fs.readFileSync(this.vaultPath, 'utf8')).map(e => ({...e, password: '••••••••'}));
            }
        } catch (e) { return []; }
        return [];
    });

    ipcMain.handle('vault:add', async (e, entry) => {
        if (!this.isUnlocked) return false;
        try {
            const list = fs.existsSync(this.vaultPath) ? JSON.parse(fs.readFileSync(this.vaultPath, 'utf8')) : [];
            list.push({ ...entry, id: Date.now().toString() });
            fs.writeFileSync(this.vaultPath, JSON.stringify(list, null, 2));
            return true;
        } catch (e) { return false; }
    });

    ipcMain.handle('vault:delete', async (e, id) => {
        if (!this.isUnlocked) return false;
        try {
            const list = JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'));
            const filtered = list.filter(item => item.id !== id);
            fs.writeFileSync(this.vaultPath, JSON.stringify(filtered, null, 2));
            return true;
        } catch (e) { return false; }
    });
  }
}

module.exports = new VaultManager();
