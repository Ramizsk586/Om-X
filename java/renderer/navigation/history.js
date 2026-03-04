
/**
 * Wrapper for managing navigation history commands.
 */
export class NavigationHistory {
  constructor(webview) {
    this.webview = webview;
  }

  canGoBack() {
    return this.webview && this.webview.canGoBack();
  }

  canGoForward() {
    return this.webview && this.webview.canGoForward();
  }

  goBack() {
    if (this.canGoBack()) this.webview.goBack();
  }

  goForward() {
    if (this.canGoForward()) this.webview.goForward();
  }
  
  reload() {
      if (this.webview) this.webview.reload();
  }
  
  stop() {
      if (this.webview) this.webview.stop();
  }
}
