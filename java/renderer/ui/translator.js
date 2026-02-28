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
    this.btnFullPage = document.getElementById('btn-translate-full-page');
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

    if (this.btnFullPage) {
      this.btnFullPage.onclick = () => this.performFullPageTranslation();
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

    this.outputTextEl.innerHTML = "<i style='opacity:0.6'>Processing translation...</i>";
    this.btnTranslate.disabled = true;

    try {
      // Use Unified Translator Engine instead of direct API call
      const result = await UnifiedTranslator.perform({ text, target, source });
      
      if (result.error) {
        this.outputTextEl.innerHTML = `<span style="color:#ff5252; font-size:12px;"><b>Translation Error:</b> ${result.error}</span>`;
      } else if (result.text) {
        this.outputTextEl.textContent = result.text;
      } else {
        this.outputTextEl.innerHTML = `<span style="color:#ff5252;">Provider returned an empty response.</span>`;
      }
    } catch (e) {
      console.error("Translation logic error:", e);
      this.outputTextEl.innerHTML = `<span style="color:#ff5252;">Internal error communicating with AI bridge.</span>`;
    } finally {
      this.btnTranslate.disabled = false;
    }
  }

  async performFullPageTranslation() {
    const webview = this.tabManager.getActiveWebview();
    if (!webview) return;

    const targetLang = this.targetLangSelect.value;
    const sourceLang = this.sourceLangSelect.value || 'auto';

    this.hide();

    // The full page logic still uses the background IPC directly for simplicity in injection, 
    // or we could potentially bridge the UnifiedTranslator to the webview.
    // For now, keeping the robust batch logic.
    const injectionScript = `
      (async function() {
        const target = '${targetLang}';
        const source = '${sourceLang}';
        const DELIMITER = " [~] ";
        const BATCH_SIZE = 8;
        const DELAY_BETWEEN_BATCHES = 1500;
        
        const processedNodes = new WeakSet();
        const pendingQueue = [];
        let isProcessing = false;

        console.log("Omni: Dynamic Viewport Translation Started (" + target + ")");

        const translateBatch = async (batch) => {
            const texts = batch.map(n => n.textContent.trim());
            const combined = texts.join(DELIMITER);
            
            try {
                // We use the background IPC directly here as UnifiedTranslator is not in the webview scope
                const result = await window.browserAPI.translator.perform({ 
                    text: combined, 
                    target: target,
                    source: source
                });

                if (result && result.text) {
                    const translatedParts = result.text.split(DELIMITER);
                    batch.forEach((node, idx) => {
                        if (translatedParts[idx]) {
                            node.textContent = translatedParts[idx].trim();
                        }
                    });
                }
            } catch (e) {
                console.error("Omni: Batch translation failed", e);
            }
        };

        const processQueue = async () => {
            if (isProcessing || pendingQueue.length === 0) return;
            isProcessing = true;
            try {
                while (pendingQueue.length > 0) {
                    const batch = pendingQueue.splice(0, BATCH_SIZE);
                    await translateBatch(batch);
                    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
                }
            } finally {
                isProcessing = false;
                if (pendingQueue.length > 0) setTimeout(processQueue, 500);
            }
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
                        acceptNode: (node) => {
                            if (processedNodes.has(node)) return NodeFilter.FILTER_REJECT;
                            if (node.textContent.trim().length < 2) return NodeFilter.FILTER_REJECT;
                            const parent = node.parentElement;
                            if (!parent) return NodeFilter.FILTER_REJECT;
                            const tag = parent.tagName;
                            const blacklist = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA', 'SVG', 'CANVAS'];
                            if (blacklist.includes(tag)) return NodeFilter.FILTER_REJECT;
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    });

                    let node;
                    while (node = walker.nextNode()) {
                        processedNodes.add(node);
                        pendingQueue.push(node);
                    }
                    processQueue();
                }
            });
        }, { threshold: 0.1 });

        const targets = 'p, h1, h2, h3, h4, h5, h6, span, li, a, label, div';
        document.querySelectorAll(targets).forEach(el => {
            if (el.innerText && el.innerText.trim().length > 0) {
                observer.observe(el);
            }
        });

        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { 
                        if (node.matches(targets)) observer.observe(node);
                        node.querySelectorAll(targets).forEach(el => observer.observe(el));
                    }
                });
            });
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      })();
    `;

    webview.executeJavaScript(injectionScript).catch(console.error);
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
