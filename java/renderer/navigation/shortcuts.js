
/**
 * Registry for keyboard shortcuts.
 */
export class ShortcutRegistry {
  constructor() {
    this.shortcuts = new Map();
    
    document.addEventListener('keydown', (e) => {
        // Fix A: Input-Safe Shortcut Guard
        // If an input is focused, only allow shortcuts if command modifiers are present (prevents intercepting normal typing)
        const el = document.activeElement;
        const isInput = el && (['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);
        if (isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
            return;
        }

        const key = this.getCombo(e);
        if (this.shortcuts.has(key)) {
            e.preventDefault();
            this.shortcuts.get(key)();
        }
    });
  }

  register(combo, callback) {
    this.shortcuts.set(combo.toLowerCase(), callback);
  }

  getCombo(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }
}
