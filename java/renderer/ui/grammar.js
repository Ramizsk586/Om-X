import { OfflineGrammarEngine } from '../grammar.js';

export class GrammarUI {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.popup = document.getElementById('grammar-popup');
    this.handle = document.getElementById('grammar-drag-handle');
    this.btnClose = document.getElementById('btn-close-grammar');
    this.sourceTextEl = document.getElementById('grammar-source-text');
    this.outputTextEl = document.getElementById('grammar-output-text');
    this.modeSelect = document.getElementById('grammar-popup-mode');
    this.btnCheck = document.getElementById('btn-perform-grammar-check');
    this.btnImplement = document.getElementById('btn-implement-grammar');
    this.btnCopy = document.getElementById('btn-copy-grammar');
    this.summaryEl = document.getElementById('grammar-summary');
    this.engine = new OfflineGrammarEngine();
    this.lastResult = null;

    this.isDragging = false;
    this.dragStartPos = { x: 0, y: 0 };
    this.popupStartPos = { x: 0, y: 0 };

    this.init();
  }

  init() {
    if (!this.popup) return;

    if (this.handle) {
      this.handle.addEventListener('mousedown', (e) => this.onMouseDown(e));
      document.addEventListener('mousemove', (e) => this.onMouseMove(e));
      document.addEventListener('mouseup', () => this.onMouseUp());
    }

    if (this.btnClose) this.btnClose.onclick = () => this.hide();
    if (this.btnCheck) this.btnCheck.onclick = () => this.performCheck();
    if (this.btnImplement) this.btnImplement.onclick = () => this.implementCorrectedText();
    if (this.btnCopy) this.btnCopy.onclick = () => this.copyToClipboard();
  }

  show(selectionText, x, y, preferredMode = 'both') {
    if (!this.popup) return;
    const popupWidth = 450;
    const popupHeight = 380;
    let left = x;
    let top = y;

    if (left + popupWidth > window.innerWidth) left = window.innerWidth - popupWidth - 20;
    if (top + popupHeight > window.innerHeight) top = window.innerHeight - popupHeight - 20;

    this.popup.style.left = `${Math.max(10, left)}px`;
    this.popup.style.top = `${Math.max(10, top)}px`;
    this.popup.style.bottom = 'auto';
    this.popup.style.right = 'auto';

    this.sourceTextEl.textContent = selectionText || '';
    this.outputTextEl.textContent = 'Click check to run offline grammar and spelling analysis...';
    if (this.summaryEl) this.summaryEl.textContent = 'Mode: Offline only';
    this.modeSelect.value = ['both', 'grammar', 'spelling'].includes(preferredMode) ? preferredMode : 'both';
    this.btnImplement.disabled = true;
    this.lastResult = null;
    this.popup.classList.remove('hidden');
  }

  hide() {
    if (this.popup) this.popup.classList.add('hidden');
  }

  async performCheck() {
    const text = String(this.sourceTextEl?.textContent || '').trim();
    const mode = this.modeSelect?.value || 'both';
    if (!text) return;

    this.outputTextEl.textContent = 'Checking offline grammar engine...';
    if (this.summaryEl) this.summaryEl.textContent = 'Analyzing...';
    this.btnCheck.disabled = true;
    this.btnImplement.disabled = true;

    try {
      const result = await this.engine.analyze(text, mode);
      this.lastResult = result;
      const issues = result.issues || [];

      const issueLines = issues.slice(0, 40).map((issue, idx) => `${idx + 1}. ${issue.message}`);
      this.outputTextEl.textContent = result.corrected || text;
      if (this.summaryEl) {
        this.summaryEl.textContent = issues.length
          ? `Found ${issues.length} item(s)\n${issueLines.join('\n')}`
          : 'No issues found';
      }
      this.btnImplement.disabled = false;
    } catch (e) {
      console.error('[GrammarUI] Check error:', e);
      this.outputTextEl.textContent = 'Offline grammar checker failed to load rules.';
      if (this.summaryEl) this.summaryEl.textContent = String(e?.message || e);
    } finally {
      this.btnCheck.disabled = false;
    }
  }

  async implementCorrectedText() {
    const webview = this.tabManager.getActiveWebview();
    const corrected = this.lastResult?.corrected || this.outputTextEl?.textContent || '';
    if (!webview || !corrected) return;

    const safe = corrected.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const script = `
      (function() {
        try {
          document.execCommand('insertText', false, \`${safe}\`);
          return true;
        } catch (_) {
          return false;
        }
      })();
    `;

    webview.executeJavaScript(script).catch(console.error);
    this.hide();
  }

  copyToClipboard() {
    const text = this.outputTextEl?.textContent || '';
    if (!text || text.includes('Click check')) return;
    navigator.clipboard.writeText(text).catch(() => {});
  }

  onMouseDown(e) {
    this.isDragging = true;
    this.dragStartPos = { x: e.clientX, y: e.clientY };
    this.popupStartPos = { x: this.popup.offsetLeft, y: this.popup.offsetTop };
    document.body.style.cursor = 'move';
    e.preventDefault();
  }

  onMouseMove(e) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartPos.x;
    const dy = e.clientY - this.dragStartPos.y;
    let newX = this.popupStartPos.x + dx;
    let newY = this.popupStartPos.y + dy;
    const maxX = window.innerWidth - this.popup.offsetWidth;
    const maxY = window.innerHeight - this.popup.offsetHeight;
    this.popup.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
    this.popup.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
  }

  onMouseUp() {
    this.isDragging = false;
    document.body.style.cursor = 'default';
  }
}
