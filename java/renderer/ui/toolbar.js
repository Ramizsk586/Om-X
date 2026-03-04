
export class Toolbar {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.backBtn = document.getElementById('btn-back');
    this.forwardBtn = document.getElementById('btn-forward');
    this.reloadBtn = document.getElementById('btn-reload');
    
    this.initListeners();
  }

  initListeners() {
    // Controls
    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => {
        const wv = this.tabManager.getActiveWebview();
        if (wv && wv.canGoBack()) wv.goBack();
      });
    }

    if (this.forwardBtn) {
      this.forwardBtn.addEventListener('click', () => {
        const wv = this.tabManager.getActiveWebview();
        if (wv && wv.canGoForward()) wv.goForward();
      });
    }

    if (this.reloadBtn) {
      this.reloadBtn.addEventListener('click', () => {
        const wv = this.tabManager.getActiveWebview();
        if (wv) wv.reload();
      });
    }
  }

  // SetUrl is no longer needed for the UI, but we keep the method stub to avoid breaking old references if any exist
  setUrl(url) {
    // No-op
  }
}
