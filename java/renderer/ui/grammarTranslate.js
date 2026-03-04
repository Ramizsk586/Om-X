import { OfflineBengaliTranslator } from '../grammarTranslate.js';

export class GrammarTranslateUI {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.popup = document.getElementById('grammar-translate-popup');
    this.handle = document.getElementById('grammar-translate-drag-handle');
    this.btnClose = document.getElementById('btn-close-grammar-translate');
    this.sourceTextEl = document.getElementById('grammar-translate-source-text');
    this.outputTextEl = document.getElementById('grammar-translate-output-text');
    this.summaryEl = document.getElementById('grammar-translate-summary');
    this.btnTranslate = document.getElementById('btn-perform-grammar-translate');
    this.btnImplement = document.getElementById('btn-implement-grammar-translate');
    this.btnCopy = document.getElementById('btn-copy-grammar-translate');
    this.engine = new OfflineBengaliTranslator();
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
    if (this.btnTranslate) this.btnTranslate.onclick = () => this.performTranslate();
    if (this.btnImplement) this.btnImplement.onclick = () => this.implementTranslatedText();
    if (this.btnCopy) this.btnCopy.onclick = () => this.copyToClipboard();
  }

  show(selectionText, x, y) {
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
    this.outputTextEl.textContent = 'Click translate to run offline English -> Bengali translation...';
    this.summaryEl.textContent = 'Mode: Offline only (English -> Bengali)';
    this.btnImplement.disabled = true;
    this.lastResult = null;
    this.popup.classList.remove('hidden');
  }

  hide() {
    if (this.popup) this.popup.classList.add('hidden');
  }

  async performTranslate() {
    const text = String(this.sourceTextEl?.textContent || '').trim();
    if (!text) return;

    this.outputTextEl.textContent = 'Translating with offline Bengali dictionary...';
    this.summaryEl.textContent = 'Analyzing...';
    this.btnTranslate.disabled = true;
    this.btnImplement.disabled = true;

    try {
      const result = await this.engine.translate(text);
      this.lastResult = result;
      this.outputTextEl.textContent = result.translated || text;
      this.summaryEl.textContent =
        `Translated units (word/phrase): ${result.translatedCount}\n` +
        `Unmatched tokens: ${result.unknownCount}\n` +
        'Dictionary: BengaliDictionary.json';
      this.btnImplement.disabled = false;
    } catch (e) {
      console.error('[GrammarTranslateUI] Translation error:', e);
      this.outputTextEl.textContent = 'Offline Bengali translation failed to load dictionary.';
      this.summaryEl.textContent = String(e?.message || e);
    } finally {
      this.btnTranslate.disabled = false;
    }
  }

  async implementTranslatedText() {
    const webview = this.tabManager.getActiveWebview();
    const translated = this.lastResult?.translated || this.outputTextEl?.textContent || '';
    if (!webview || !translated) return;

    const safe = translated.replace(/`/g, '\\`').replace(/\$/g, '\\$');
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
    if (!text || text.includes('Click translate')) return;
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
