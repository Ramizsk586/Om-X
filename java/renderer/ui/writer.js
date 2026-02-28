/**
 * OMNI WRITER UI MODULE
 * Handles the rewriting popup and viewport selection replacement.
 */
import { UnifiedWriter } from '../writer.js';

export class WriterUI {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.popup = document.getElementById('writer-popup');
    this.handle = document.getElementById('writer-drag-handle');
    this.btnClose = document.getElementById('btn-close-writer');
    this.sourceTextEl = document.getElementById('writer-source-text');
    this.outputTextEl = document.getElementById('writer-output-text');
    this.modeSelect = document.getElementById('writer-popup-mode');
    this.btnRewrite = document.getElementById('btn-perform-write');
    this.btnImplement = document.getElementById('btn-implement-write');

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
    
    if (this.btnRewrite) {
      this.btnRewrite.onclick = () => this.performRewrite();
    }

    if (this.btnImplement) {
      this.btnImplement.onclick = () => this.implementRewrittenText();
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
    this.outputTextEl.textContent = "Click rewrite to improve your text...";
    this.btnImplement.disabled = true;
    this.popup.classList.remove('hidden');
  }

  hide() {
    this.popup.classList.add('hidden');
  }

  async performRewrite() {
    const text = this.sourceTextEl.textContent;
    const mode = this.modeSelect.value;

    if (!text || text.trim().length === 0) return;

    this.outputTextEl.innerHTML = "<i style='opacity:0.6'>Omni is rewriting...</i>";
    this.btnRewrite.disabled = true;
    this.btnImplement.disabled = true;

    try {
      const result = await UnifiedWriter.perform({ text, mode });
      
      if (result.error) {
        this.outputTextEl.innerHTML = `<span style="color:#ff5252; font-size:12px;"><b>Error:</b> ${result.error}</span>`;
      } else if (result.text) {
        this.outputTextEl.textContent = result.text;
        this.btnImplement.disabled = false;
      } else {
        this.outputTextEl.innerHTML = `<span style="color:#ff5252;">Provider returned an empty response.</span>`;
      }
    } catch (e) {
      console.error("Writer logic error:", e);
      this.outputTextEl.innerHTML = `<span style="color:#ff5252;">Internal error communicating with AI bridge.</span>`;
    } finally {
      this.btnRewrite.disabled = false;
    }
  }

  async implementRewrittenText() {
    const webview = this.tabManager.getActiveWebview();
    if (!webview) return;

    const rewritten = this.outputTextEl.textContent;
    if (!rewritten || rewritten.includes("Omni is rewriting")) return;

    // Use insertText command to replace the selection in the webview
    // This works correctly for inputs and contenteditables
    const script = `
        (function() {
            try {
                document.execCommand('insertText', false, \`${rewritten.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
                return true;
            } catch(e) {
                console.error("Implementation failed", e);
                return false;
            }
        })();
    `;

    webview.executeJavaScript(script).then(() => {
        this.hide();
    }).catch(console.error);
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