const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Configuration Management for Extensions
 * Handles reading, parsing, and watching VS Code settings
 */
class ConfigurationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = options.logger || console;
    this.workspaceRoots = [];
    this.configurations = new Map(); // windowId -> config object
    this.watchers = new Map(); // windowId -> FSWatcher
    this.userConfig = {}; // User-level config
    this.globalConfig = {}; // Global config (fallback)
  }

  /**
   * Set workspace roots for configuration discovery
   */
  setWorkspaceRoots(windowId, roots) {
    const id = Number(windowId) || 0;
    if (!id || !Array.isArray(roots)) return;
    
    // Clear previous watcher
    if (this.watchers.has(id)) {
      try {
        this.watchers.get(id).close();
      } catch (_) {}
      this.watchers.delete(id);
    }

    // Load configuration asynchronously
    this._loadConfiguration(id, roots).catch(error => {
      this.logger.warn?.('[Config] Failed to load configuration:', error?.message);
    });
  }

  /**
   * Get configuration for a specific window/scope
   */
  getConfiguration(section, windowId, resource) {
    const id = Number(windowId) || 0;
    const config = this.configurations.get(id) || {};
    
    if (!section) {
      return this._createConfigurationProxy(config);
    }

    // Navigate to section (e.g., "editor.fontSize" -> config.editor.fontSize)
    const keys = String(section || '').split('.');
    let value = config;
    for (const key of keys) {
      if (!key || typeof value !== 'object') return this._createConfigurationProxy({});
      value = value[key];
    }

    return this._createConfigurationProxy(typeof value === 'object' ? value : {});
  }

  /**
   * Create a configuration proxy with get/update methods
   */
  _createConfigurationProxy(config) {
    return {
      get: (key, defaultValue) => {
        const keys = String(key || '').split('.');
        let value = config;
        for (const k of keys) {
          if (!k || typeof value !== 'object') return defaultValue;
          value = value[k];
        }
        return value ?? defaultValue;
      },

      has: (key) => {
        const keys = String(key || '').split('.');
        let value = config;
        for (const k of keys) {
          if (!k || typeof value !== 'object') return false;
          value = value[k];
        }
        return value !== undefined;
      },

      inspect: (key) => {
        const keys = String(key || '').split('.');
        let value = config;
        for (const k of keys) {
          if (!k || typeof value !== 'object') return { key, defaultValue: undefined };
          value = value[k];
        }
        return {
          key,
          defaultValue: undefined,
          globalValue: undefined,
          workspaceValue: value,
          languageValue: undefined,
          defaultLanguageValue: undefined,
          userValue: undefined,
          workspaceFolderValue: undefined
        };
      },

      update: async (key, value, isGlobal = false) => {
        // Configuration updates would require writing back to settings.json
        // For now, return success but don't persist
        return { ok: true, persisted: false };
      }
    };
  }

  /**
   * Load configuration from workspace
   */
  async _loadConfiguration(windowId, roots) {
    const id = Number(windowId) || 0;
    if (!id) return;

    const root = Array.isArray(roots) && roots[0] ? String(roots[0]) : '';
    if (!root) return;

    try {
      // Load .vscode/settings.json
      const settingsPath = path.join(root, '.vscode', 'settings.json');
      const config = await this._readJsonSafe(settingsPath);

      // Merge with global config
      const merged = { ...this.globalConfig, ...config };
      this.configurations.set(id, merged);

      // Emit configuration change event
      this.emit('configuration-changed', { windowId: id, configuration: merged });

      // Watch for changes
      this._watchConfiguration(id, settingsPath);
    } catch (error) {
      this.logger.debug?.('[Config] Configuration load error:', error?.message);
      this.configurations.set(id, this.globalConfig);
    }
  }

  /**
   * Watch configuration file for changes
   */
  _watchConfiguration(windowId, filePath) {
    const id = Number(windowId) || 0;
    if (!id) return;

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) return;

      // Use fs.watch for change detection
      const watcher = fs.watch(dir, { persistent: false }, async (eventType, filename) => {
        if (eventType !== 'change' || filename !== path.basename(filePath)) return;

        // Small delay to ensure file is written
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const config = await this._readJsonSafe(filePath);
          const merged = { ...this.globalConfig, ...config };
          this.configurations.set(id, merged);
          this.emit('configuration-changed', { windowId: id, configuration: merged });
        } catch (_) {}
      });

      this.watchers.set(id, watcher);
    } catch (error) {
      this.logger.debug?.('[Config] Watch setup failed:', error?.message);
    }
  }

  /**
   * Safely read and parse JSON file
   */
  async _readJsonSafe(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      // Allow comments and trailing commas (VS Code does)
      const cleaned = content
        .replace(/\/\/.*$/gm, '') // Remove comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
      return JSON.parse(cleaned);
    } catch (error) {
      return {};
    }
  }

  /**
   * Set global configuration (fallback for all workspaces)
   */
  setGlobalConfiguration(config) {
    if (typeof config === 'object' && config !== null) {
      this.globalConfig = { ...config };
      // Reload all workspace configurations with new global
      for (const id of this.configurations.keys()) {
        const localConfig = this.configurations.get(id) || {};
        const merged = { ...this.globalConfig, ...localConfig };
        this.configurations.set(id, merged);
      }
    }
  }

  /**
   * Cleanup on window close
   */
  detachWindow(windowId) {
    const id = Number(windowId) || 0;
    if (!id) return;

    if (this.watchers.has(id)) {
      try {
        this.watchers.get(id).close();
      } catch (_) {}
      this.watchers.delete(id);
    }
    this.configurations.delete(id);
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    for (const watcher of this.watchers.values()) {
      try {
        watcher.close();
      } catch (_) {}
    }
    this.watchers.clear();
    this.configurations.clear();
  }
}

module.exports = ConfigurationManager;
