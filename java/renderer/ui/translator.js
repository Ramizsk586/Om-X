/**
 * OMNI TRANSLATOR MODULE
 * Handles the translation popup UI and dynamic viewport-aware neural translation.
 */
import { UnifiedTranslator } from '../translate.js';

export class TranslatorUI {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.popup = document.getElementById('translator-popup');
    this.handle = document.getElementById('translator-drag-handle');
    this.btnClose = document.getElementById('btn-close-translator');
    this.sourceTextEl = document.getElementById('translator-source-text');
    this.outputTextEl = document.getElementById('translator-output-text');
    this.sourceLangSelect = document.getElementById('translator-popup-source');
    this.targetLangSelect = document.getElementById('translator-popup-target');
    this.btnTranslate = document.getElementById('btn-perform-translation');
    this.btnCopy = document.getElementById('btn-copy-translation');

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
    
    if (this.btnTranslate) {
      this.btnTranslate.onclick = () => this.performSelectionTranslation();
    }

    if (this.btnCopy) {
      this.btnCopy.onclick = () => this.copyToClipboard();
    }
  }

  show(selectionText, x, y) {
    const popupWidth = 420;
    const popupHeight = 350;
    let left = x;
    let top = y;

    if (left + popupWidth > window.innerWidth) left = window.innerWidth - popupWidth - 20;
    if (top + popupHeight > window.innerHeight) top = window.innerHeight - popupHeight - 20;

    this.popup.style.left = `${Math.max(10, left)}px`;
    this.popup.style.top = `${Math.max(10, top)}px`;
    this.popup.style.bottom = 'auto';
    this.popup.style.right = 'auto';

    this.sourceTextEl.textContent = selectionText;
    this.outputTextEl.textContent = "Adjust settings and click translate...";
    this.sourceLangSelect.value = "auto";
    this.popup.classList.remove('hidden');
  }

  hide() {
    this.popup.classList.add('hidden');
  }

  async performSelectionTranslation() {
    const text = this.sourceTextEl.textContent;
    const target = this.targetLangSelect.value;
    const source = this.sourceLangSelect.value;

    if (!text || text.trim().length === 0) return;

    this.outputTextEl.textContent = 'Processing translation...';
    this.outputTextEl.style.opacity = '0.6';
    this.outputTextEl.style.color = '';
    this.outputTextEl.style.fontSize = '';
    this.btnTranslate.disabled = true;

    try {
      // Use Unified Translator Engine instead of direct API call
      const result = await UnifiedTranslator.perform({ text, target, source });
      
      if (result.error) {
        this.outputTextEl.textContent = `Translation Error: ${String(result.error)}`;
        this.outputTextEl.style.opacity = '1';
        this.outputTextEl.style.color = '#ff5252';
        this.outputTextEl.style.fontSize = '12px';
      } else if (result.text) {
        this.outputTextEl.textContent = result.text;
        this.outputTextEl.style.opacity = '1';
        this.outputTextEl.style.color = '';
        this.outputTextEl.style.fontSize = '';
      } else {
        this.outputTextEl.textContent = 'Provider returned an empty response.';
        this.outputTextEl.style.opacity = '1';
        this.outputTextEl.style.color = '#ff5252';
        this.outputTextEl.style.fontSize = '';
      }
    } catch (e) {
      console.error("Translation logic error:", e);
      this.outputTextEl.textContent = 'Internal error communicating with AI bridge.';
      this.outputTextEl.style.opacity = '1';
      this.outputTextEl.style.color = '#ff5252';
      this.outputTextEl.style.fontSize = '';
    } finally {
      this.btnTranslate.disabled = false;
    }
  }

  copyToClipboard() {
    const text = this.outputTextEl.textContent;
    if (text && !text.includes("Adjust settings") && !text.includes("Processing translation")) {
      navigator.clipboard.writeText(text);
      const originalColor = this.btnCopy.style.color;
      this.btnCopy.style.color = "var(--accent-color)";
      setTimeout(() => this.btnCopy.style.color = originalColor, 1000);
    }
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
