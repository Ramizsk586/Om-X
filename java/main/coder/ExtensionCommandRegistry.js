class ExtensionCommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  register(command = {}) {
    const id = String(command.id || '').trim();
    if (!id) throw new Error('Command id is required');

    const normalized = {
      id,
      title: String(command.title || id),
      source: command.source || 'extension',
      extensionId: command.extensionId ? String(command.extensionId) : '',
      windowId: Number(command.windowId) || 0,
      enabled: command.enabled !== false,
      when: command.when ? String(command.when) : '',
      createdAt: Date.now()
    };

    this.commands.set(id, normalized);
    return normalized;
  }

  unregister(id, options = {}) {
    const key = String(id || '').trim();
    if (!key) return false;
    const existing = this.commands.get(key);
    if (!existing) return false;
    if (options.extensionId && existing.extensionId !== String(options.extensionId)) return false;
    if (options.windowId && Number(existing.windowId) !== Number(options.windowId)) return false;
    this.commands.delete(key);
    return true;
  }

  get(id) {
    return this.commands.get(String(id || '').trim()) || null;
  }

  list(options = {}) {
    const windowId = options.windowId ? Number(options.windowId) : 0;
    const includeDisabled = options.includeDisabled === true;
    return [...this.commands.values()]
      .filter((cmd) => (!windowId || cmd.windowId === 0 || cmd.windowId === windowId))
      .filter((cmd) => includeDisabled || cmd.enabled !== false)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }));
  }

  clearForWindow(windowId) {
    const target = Number(windowId) || 0;
    if (!target) return;
    for (const [id, meta] of this.commands.entries()) {
      if (meta.windowId === target) this.commands.delete(id);
    }
  }

  setEnabled(id, enabled) {
    const existing = this.get(id);
    if (!existing) return null;
    existing.enabled = enabled !== false;
    this.commands.set(existing.id, existing);
    return existing;
  }
}

module.exports = ExtensionCommandRegistry;
