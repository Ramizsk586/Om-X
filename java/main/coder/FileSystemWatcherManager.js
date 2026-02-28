const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * File System Watcher for Extensions
 * Monitors file changes and emits events to extensions
 */
class FileSystemWatcherManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = options.logger || console;
    this.workspaceRoots = new Map(); // windowId -> [root paths]
    this.watchers = new Map(); // watcherId -> watcher info
    this.fileWatchers = new Map(); // root -> fs.FSWatcher
    this.pendingEvents = new Map(); // root -> pending file change events
    this.debounceMs = 100;
    this.maxWatchersPerWindow = 1000;
  }

  /**
   * Set workspace roots for a window
   */
  setWorkspaceRoots(windowId, roots) {
    const id = Number(windowId) || 0;
    if (!id || !Array.isArray(roots)) return;

    // Clear old watchers for this window
    for (const [watcherId, info] of [...this.watchers.entries()]) {
      if (info.windowId === id) {
        this._removeWatcher(watcherId);
      }
    }

    this.workspaceRoots.set(id, roots.map(r => path.resolve(String(r))));
    
    // Start watching workspace roots
    for (const root of roots) {
      this._watchRoot(path.resolve(String(root)));
    }
  }

  /**
   * Register a file system watcher
   */
  createWatcher(watcherId, { globPattern, ignoreCreate, ignoreChange, ignoreDelete, windowId, extensionId }) {
    const id = String(watcherId || '').trim();
    const wid = Number(windowId) || 0;
    if (!id) throw new Error('watcherId is required');

    const watched = this.watchers.get(id);
    if (watched) throw new Error(`Watcher ${id} already registered`);

    // Check limit
    const windowWatchers = [...this.watchers.values()].filter(w => w.windowId === wid).length;
    if (windowWatchers >= this.maxWatchersPerWindow) {
      throw new Error(`Too many file watchers for window (limit: ${this.maxWatchersPerWindow})`);
    }

    const watcher = {
      id,
      windowId: wid,
      extensionId: String(extensionId || '').trim(),
      globPattern: String(globPattern || '**/*'),
      ignoreCreate: ignoreCreate === true,
      ignoreChange: ignoreChange === true,
      ignoreDelete: ignoreDelete === true,
      createdAt: Date.now()
    };

    this.watchers.set(id, watcher);
    return { ok: true, watcherId: id };
  }

  /**
   * Unregister a file system watcher
   */
  removeWatcher(watcherId) {
    return this._removeWatcher(watcherId);
  }

  /**
   * Emit file system event to all matching watchers
   */
  emitFileEvent(filePath, type, windowId) {
    const wid = Number(windowId) || 0;
    const absPath = path.resolve(String(filePath || ''));

    // Find matching watchers
    for (const [watcherId, watcher] of this.watchers.entries()) {
      // Check if this watcher cares about this event
      if (type === 'create' && watcher.ignoreCreate) continue;
      if (type === 'change' && watcher.ignoreChange) continue;
      if (type === 'delete' && watcher.ignoreDelete) continue;

      // Check if correct window
      if (wid && watcher.windowId !== 0 && watcher.windowId !== wid) continue;

      // Check if path matches glob pattern
      if (this._globMatches(watcher.globPattern, absPath)) {
        this.emit('file-event', {
          watcherId,
          extensionId: watcher.extensionId,
          windowId: watcher.windowId,
          filePath: absPath,
          type,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Watch root directory for changes
   */
  _watchRoot(root) {
    if (this.fileWatchers.has(root)) return;

    try {
      if (!fs.existsSync(root)) return;

      const watcher = fs.watch(root, { recursive: true, persistent: false }, (eventType, filename) => {
        if (!filename) return;

        const filePath = path.join(root, String(filename || ''));
        
        // Debounce events
        this._debounceFileEvent(root, filePath, eventType === 'rename' ? 'change' : 'change');
      });

      this.fileWatchers.set(root, watcher);

      watcher.on('error', (err) => {
        this.logger.debug?.(`[Watcher] Error watching ${root}:`, err?.message);
        this._closeWatcher(root);
      });
    } catch (error) {
      this.logger.debug?.(`[Watcher] Failed to watch ${root}:`, error?.message);
    }
  }

  /**
   * Debounce file events to avoid duplicates
   */
  _debounceFileEvent(root, filePath, type) {
    const key = `${root}:${filePath}`;
    
    if (this.pendingEvents.has(key)) {
      clearTimeout(this.pendingEvents.get(key).timer);
    }

    const timer = setTimeout(() => {
      this.pendingEvents.delete(key);
      
      // Determine actual event type
      let eventType = 'change';
      try {
        if (!fs.existsSync(filePath)) {
          eventType = 'delete';
        }
      } catch (_) {
        eventType = 'delete';
      }

      // Emit to all affected windows
      for (const [windowId] of this.workspaceRoots) {
        this.emitFileEvent(filePath, eventType, windowId);
      }
    }, this.debounceMs);

    this.pendingEvents.set(key, { timer, timestamp: Date.now() });
  }

  /**
   * Check if file path matches glob pattern
   */
  _globMatches(pattern, filePath) {
    // Simple glob matching
    // For now, implement basic patterns: *, **, ?
    const isAbsolute = path.isAbsolute(filePath);
    const normalizedPath = path.normalize(filePath);

    // Convert glob pattern to regex
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\\\*/g, '[^/]*') // * matches anything except /
      .replace(/\\\*\\\*/g, '.*'); // ** matches everything

    // Try matching just filename
    const filename = path.basename(filePath);
    try {
      if (new RegExp(`^${regexPattern}$`).test(filename)) return true;
      if (new RegExp(`^${regexPattern}$`).test(normalizedPath)) return true;
    } catch (_) {}

    // Simple fallback: check if file ends with pattern or contains directory
    if (pattern === '**/*') return true;
    if (normalizedPath.includes(pattern)) return true;

    return false;
  }

  /**
   * Internal: Remove watcher
   */
  _removeWatcher(watcherId) {
    const id = String(watcherId || '').trim();
    if (!id) return false;

    if (this.watchers.has(id)) {
      this.watchers.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Close file watcher for a root
   */
  _closeWatcher(root) {
    try {
      const watcher = this.fileWatchers.get(root);
      if (watcher) {
        watcher.close();
        this.fileWatchers.delete(root);
      }
    } catch (error) {
      this.logger.debug?.(`[Watcher] Error closing watcher for ${root}:`, error?.message);
    }
  }

  /**
   * Cleanup on window close
   */
  detachWindow(windowId) {
    const id = Number(windowId) || 0;
    if (!id) return;

    // Remove watchers for this window
    for (const [watcherId, watcher] of [...this.watchers.entries()]) {
      if (watcher.windowId === id) {
        this.watchers.delete(watcherId);
      }
    }

    this.workspaceRoots.delete(id);
  }

  /**
   * Full cleanup
   */
  destroy() {
    // Close all file watchers
    for (const watcher of this.fileWatchers.values()) {
      try {
        watcher.close();
      } catch (_) {}
    }
    this.fileWatchers.clear();
    this.watchers.clear();
    this.workspaceRoots.clear();

    // Clear pending debounces
    for (const pending of this.pendingEvents.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingEvents.clear();
  }

  /**
   * Get watcher info
   */
  getWatcher(watcherId) {
    return this.watchers.get(String(watcherId || '').trim()) || null;
  }

  /**
   * List all watchers
   */
  listWatchers(windowId) {
    const wid = Number(windowId) || 0;
    return [...this.watchers.values()].filter(w => !wid || w.windowId === wid);
  }
}

module.exports = FileSystemWatcherManager;
