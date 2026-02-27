

export class ScreenshotOverlay {
  constructor(onCapture) {
    this.onCapture = onCapture;
    this.overrideCapture = null;
    this.layer = document.getElementById('screenshot-layer');
    this.canvas = document.getElementById('screenshot-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.hintEl = document.getElementById('screenshot-hint');
    this.btnFull = document.getElementById('btn-ss-full');
    this.btnSave = document.getElementById('btn-ss-save');
    this.btnCancel = document.getElementById('btn-ss-cancel');
    this.btnCopy = document.getElementById('btn-ss-copy');
    this.btnWindow = document.getElementById('btn-ss-window');
    
    // Window picker elements
    this.windowPickerOverlay = document.getElementById('window-picker-overlay');
    this.windowPickerContainer = document.getElementById('window-picker-container');
    this.windowPickerList = document.getElementById('window-picker-list');
    this.btnCloseWindowPicker = document.getElementById('btn-close-window-picker');
    
    // Display picker elements
    this.btnDisplay = document.getElementById('btn-ss-display');
    this.displayPickerOverlay = document.getElementById('display-picker-overlay');
    this.displayPickerContainer = document.getElementById('display-picker-container');
    this.displayPickerList = document.getElementById('display-picker-list');
    this.displayVisualMap = document.getElementById('display-visual-map');
    this.btnCloseDisplayPicker = document.getElementById('btn-close-display-picker');

    // Delay capture elements
    this.countdownOverlay = document.getElementById('screenshot-countdown');
    this.countdownNumber = document.getElementById('countdown-number');
    this.btnDelayCancel = document.getElementById('btn-ss-delay-cancel');
    
    this.sourceImage = null; // HTMLImageElement
    this.isSelecting = false;
    this.startPos = { x: 0, y: 0 };
    this.currentPos = { x: 0, y: 0 };
    
    // Window picker state
    this.isWindowPickerActive = false;
    this.hoveredWindow = null;
    this.windows = [];
    
    // Display picker state
    this.isDisplayPickerActive = false;
    this.displays = [];
    this.hoveredDisplay = null;
    
    // DPI scale factor for high-DPI displays
    this.scaleFactor = window.devicePixelRatio || 1;

    // Delay capture state
    this.isDelayActive = false;
    this.delayInterval = null;
    this.delayRemaining = 0;
    this.delayCaptureFn = null;
    
    this.init();
  }

  init() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Full screen button
    this.btnFull.addEventListener('click', () => {
      if (this.sourceImage) {
        this.finish(this.sourceImage.src);
      }
    });
    
    // Save button (full screen if no selection)
    if(this.btnSave) {
        this.btnSave.addEventListener('click', () => {
             if (this.sourceImage) {
                 this.finish(this.sourceImage.src);
             }
        });
    }

    // Copy to clipboard button
    if (this.btnCopy) {
      this.btnCopy.addEventListener('click', () => this.copyToClipboard());
    }

    // Cancel button
    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => this.cancel());
    }
    
    // Window picker button
    if (this.btnWindow) {
      this.btnWindow.addEventListener('click', () => this.showWindowPicker());
    }
    
    // Close window picker button
    if (this.btnCloseWindowPicker) {
      this.btnCloseWindowPicker.addEventListener('click', () => this.hideWindowPicker());
    }
    
    // Display picker button
    if (this.btnDisplay) {
      this.btnDisplay.addEventListener('click', () => this.showDisplayPicker());
    }
    
    // Close display picker button
    if (this.btnCloseDisplayPicker) {
      this.btnCloseDisplayPicker.addEventListener('click', () => this.hideDisplayPicker());
    }

    // Cancel delay button
    if (this.btnDelayCancel) {
      this.btnDelayCancel.addEventListener('click', () => this.cancelDelayCapture());
    }

    // ESC key to cancel
    this._boundKeyHandler = (e) => this.handleKeyPress(e);
    document.addEventListener('keydown', this._boundKeyHandler);
  }

  handleKeyPress(e) {
    if (e.key !== 'Escape') return;
    if (this.isDelayActive) {
      e.preventDefault();
      this.cancelDelayCapture();
      return;
    }
    if (this.layer.classList.contains('active')) {
        e.preventDefault();
        if (this.isWindowPickerActive) {
          this.hideWindowPicker();
        } else if (this.isDisplayPickerActive) {
          this.hideDisplayPicker();
        } else {
          this.cancel();
        }
    }
  }

  cancel() {
    this.showToast('Screenshot cancelled');
    this.hide();
  }

  start(nativeImage, onCaptureOverride = null) {
    this.overrideCapture = onCaptureOverride;
    this.cancelDelayCapture(false);
    const dataUrl = nativeImage.toDataURL();
    this.sourceImage = new Image();
    this.sourceImage.onload = () => {
      this.layer.classList.add('active');
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      
      // Update scale factor in case it changed
      this.scaleFactor = window.devicePixelRatio || 1;
      
      this.render();
    };
    this.sourceImage.src = dataUrl;
  }

  hide() {
    this.layer.classList.remove('active');
    this.sourceImage = null;
    this.isSelecting = false;
    this.isWindowPickerActive = false;
  }

  startDelayCapture(delaySeconds, captureFn, onCaptureOverride = null) {
    if (!captureFn && !this.delayCaptureFn) {
      this.showToast('Capture source unavailable');
      return;
    }
    if (captureFn) this.delayCaptureFn = captureFn;

    if (!delaySeconds || delaySeconds <= 0) {
      this.delayCaptureFn()
        .then(img => this.start(img, onCaptureOverride))
        .catch((err) => {
          console.error('[Screenshot] Capture failed:', err);
          this.showToast('Failed to capture screenshot');
        });
      return;
    }

    this.isDelayActive = true;
    this.delayRemaining = delaySeconds;
    this.showCountdown();
    this.updateCountdownUI();
    this.showToast(`Taking screenshot in ${this.delayRemaining}...`);

    if (this.delayInterval) clearInterval(this.delayInterval);
    this.delayInterval = setInterval(() => {
      this.delayRemaining -= 1;
      if (this.delayRemaining <= 0) {
        this.clearDelayTimer();
        this.hideCountdown();
        const capture = this.delayCaptureFn;
        if (capture) {
          capture()
            .then(img => this.start(img, onCaptureOverride))
            .catch((err) => {
              console.error('[Screenshot] Capture failed:', err);
              this.showToast('Failed to capture screenshot');
            });
        }
        return;
      }
      this.updateCountdownUI();
      this.showToast(`Taking screenshot in ${this.delayRemaining}...`);
    }, 1000);
  }

  updateCountdownUI() {
    if (this.countdownNumber) {
      this.countdownNumber.textContent = String(this.delayRemaining);
      this.countdownNumber.classList.remove('pulse');
      void this.countdownNumber.offsetWidth;
      this.countdownNumber.classList.add('pulse');
    }
  }

  showCountdown() {
    if (this.countdownOverlay) {
      this.countdownOverlay.classList.remove('hidden');
    }
  }

  hideCountdown() {
    if (this.countdownOverlay) {
      this.countdownOverlay.classList.add('hidden');
    }
  }

  clearDelayTimer() {
    if (this.delayInterval) {
      clearInterval(this.delayInterval);
      this.delayInterval = null;
    }
    this.isDelayActive = false;
  }

  cancelDelayCapture(showMessage = true) {
    if (!this.isDelayActive && !this.delayInterval) return;
    this.clearDelayTimer();
    this.hideCountdown();
    if (showMessage) this.showToast('Screenshot cancelled');
  }

  getPos(e) {
    return { x: e.clientX, y: e.clientY };
  }

  onMouseDown(e) {
    this.isSelecting = true;
    this.startPos = this.getPos(e);
    this.currentPos = this.startPos;
    this.render();
  }

  onMouseMove(e) {
    if (!this.isSelecting) return;
    this.currentPos = this.getPos(e);
    this.render();
  }

  onMouseUp(e) {
    if (!this.isSelecting) return;
    this.isSelecting = false;
    
    const x = Math.min(this.startPos.x, this.currentPos.x);
    const y = Math.min(this.startPos.y, this.currentPos.y);
    const w = Math.abs(this.currentPos.x - this.startPos.x);
    const h = Math.abs(this.currentPos.y - this.startPos.y);
    
    if (w > 10 && h > 10) {
      this.captureSelection(x, y, w, h);
    }
  }

  render() {
    if (!this.sourceImage) return;

    // Clear
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Background (Source Image)
    this.ctx.drawImage(this.sourceImage, 0, 0, this.canvas.width, this.canvas.height);

    // 2. Draw Dim Overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 3. Clear/Cutout Selection
    if (this.isSelecting) {
      const x = Math.min(this.startPos.x, this.currentPos.x);
      const y = Math.min(this.startPos.y, this.currentPos.y);
      const w = Math.abs(this.currentPos.x - this.startPos.x);
      const h = Math.abs(this.currentPos.y - this.startPos.y);

      // Redraw source image cleanly inside the rect
      this.ctx.drawImage(this.sourceImage, x, y, w, h, x, y, w, h);
      
      // Border
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([5, 3]);
      this.ctx.strokeRect(x, y, w, h);
      this.ctx.setLineDash([]);
    }
  }

  captureSelection(x, y, w, h) {
    // Crop Logic with proper DPI scaling
    const temp = document.createElement('canvas');
    
    // Calculate scale factors accounting for DPI
    const scaleX = this.sourceImage ? (this.sourceImage.width / this.canvas.width) : 1;
    const scaleY = this.sourceImage ? (this.sourceImage.height / this.canvas.height) : 1;
    
    // Apply scale factor for high-DPI displays
    const sx = Math.round(x * scaleX * this.scaleFactor);
    const sy = Math.round(y * scaleY * this.scaleFactor);
    const sw = Math.round(w * scaleX * this.scaleFactor);
    const sh = Math.round(h * scaleY * this.scaleFactor);

    temp.width = sw;
    temp.height = sh;
    const tctx = temp.getContext('2d');

    // Draw only the selected part from source with proper scaling
    tctx.drawImage(this.sourceImage, sx, sy, sw, sh, 0, 0, sw, sh);

    this.finish(temp.toDataURL());
  }

  async copyToClipboard() {
    try {
      // Create a temporary canvas to get the image data
      const temp = document.createElement('canvas');
      const scaleX = this.sourceImage ? (this.sourceImage.width / this.canvas.width) : 1;
      const scaleY = this.sourceImage ? (this.sourceImage.height / this.canvas.height) : 1;
      
      temp.width = this.canvas.width * scaleX * this.scaleFactor;
      temp.height = this.canvas.height * scaleY * this.scaleFactor;
      const tctx = temp.getContext('2d');
      tctx.drawImage(this.sourceImage, 0, 0, temp.width, temp.height);
      
      // Convert to blob for clipboard
      temp.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/png': blob
              })
            ]);
            this.showToast('Copied to clipboard!');
          } catch (clipboardError) {
            console.error('Clipboard write failed:', clipboardError);
            this.showToast('Failed to copy to clipboard');
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error('Clipboard operation failed:', error);
      this.showToast('Failed to copy to clipboard');
    }
  }

  showToast(message) {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('screenshot-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'screenshot-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(34, 197, 94, 0.95);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 100000;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        transition: opacity 0.3s, transform 0.3s;
      `;
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%)';
    
    // Hide after 2 seconds
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 2000);
  }

  finish(dataUrl) {
    this.hide();
    const handler = this.overrideCapture || this.onCapture;
    this.overrideCapture = null;
    if (handler) handler(dataUrl);
  }

  getCurrentDataUrl() {
    return this.sourceImage?.src || null;
  }

  destroy() {
    // Clean up event listeners
    document.removeEventListener('keydown', this._boundKeyHandler);
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  // ========================================
  // WINDOW PICKER FUNCTIONALITY
  // ========================================

  async showWindowPicker() {
    try {
      this.showToast('Fetching open windows...');
      
      // Request windows from main process
      const result = await window.browserAPI.screenshot.getWindows();
      
      if (!result.success) {
        this.showToast('Failed to get windows');
        return;
      }
      
      this.windows = result.windows;
      
      if (this.windows.length === 0) {
        this.showToast('No other windows found');
        return;
      }
      
      // Build window list HTML
      this.buildWindowList();
      
      // Show window picker overlay
      this.windowPickerOverlay.classList.add('active');
      this.isWindowPickerActive = true;
      
      // Update instruction text
      if (this.hintEl) this.hintEl.textContent = 'Click a window to capture';
      
    } catch (error) {
      console.error('Error showing window picker:', error);
      this.showToast('Failed to open window picker');
    }
  }

  buildWindowList() {
    this.windowPickerList.innerHTML = '';
    
    this.windows.forEach(window => {
      const windowItem = document.createElement('div');
      windowItem.className = 'window-item';
      windowItem.dataset.windowId = window.id;
      
      // Create window info display
      const bounds = window.bounds;
      const sizeInfo = `${bounds.width} × ${bounds.height}`;
      
      windowItem.innerHTML = `
        <div class="window-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
          </svg>
        </div>
        <div class="window-info">
          <div class="window-title">${this.escapeHtml(window.title || 'Untitled')}</div>
          <div class="window-size">${sizeInfo}</div>
        </div>
        <div class="window-select-hint">Click to capture</div>
      `;
      
      // Add hover effect with preview
      windowItem.addEventListener('mouseenter', () => {
        this.highlightWindow(window);
      });
      
      windowItem.addEventListener('mouseleave', () => {
        this.unhighlightWindow();
      });
      
      // Add click handler
      windowItem.addEventListener('click', () => {
        this.captureWindow(window.id);
      });
      
      this.windowPickerList.appendChild(windowItem);
    });
    
    // Add placeholder message if no windows
    if (this.windows.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'window-empty';
      emptyMessage.textContent = 'No other windows are currently open';
      this.windowPickerList.appendChild(emptyMessage);
    }
  }

  async captureWindow(windowId) {
    try {
      this.showToast('Capturing window...');
      
      const result = await window.browserAPI.screenshot.captureWindow(windowId);
      
      if (!result.success) {
        this.showToast('Failed to capture window');
        return;
      }
      
      // Hide window picker
      this.hideWindowPicker();
      
      // Start the overlay with captured image
      this.start(result.dataUrl);
      
      this.showToast('Window captured! Select area or click Full Screen');
      
    } catch (error) {
      console.error('Error capturing window:', error);
      this.showToast('Failed to capture window');
    }
  }

  hideWindowPicker() {
    this.windowPickerOverlay.classList.remove('active');
    this.isWindowPickerActive = false;
    this.unhighlightWindow();
    
    // Reset instruction text
    if (this.hintEl) this.hintEl.textContent = 'Drag to select area';
  }

  highlightWindow(window) {
    if (this.hoveredWindow === window.id) return;
    this.hoveredWindow = window.id;
    
    // Add highlight class to window item
    const windowItem = this.windowPickerList.querySelector(`[data-window-id=\"${window.id}\"]`);
    if (windowItem) {
      windowItem.classList.add('highlighted');
    }
    
    // Could also show a border around the actual window on screen
    // This would require additional IPC calls to draw overlay on target window
  }

  unhighlightWindow() {
    if (this.hoveredWindow) {
      const windowItem = this.windowPickerList.querySelector(`[data-window-id=\"${this.hoveredWindow}\"]`);
      if (windowItem) {
        windowItem.classList.remove('highlighted');
      }
    }
    this.hoveredWindow = null;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========================================
  // DISPLAY PICKER FUNCTIONALITY (Multi-Monitor Support)
  // ========================================

  async showDisplayPicker() {
    try {
      this.showToast('Fetching displays...');
      
      // Request displays from main process
      const result = await window.browserAPI.screenshot.getDisplays();
      
      if (!result.success) {
        this.showToast('Failed to get displays');
        return;
      }
      
      this.displays = result.displays;
      
      if (this.displays.length === 0) {
        this.showToast('No displays found');
        return;
      }
      
      // Build display list HTML
      this.buildDisplayList();
      
      // Build visual map
      this.buildVisualMap();
      
      // Show display picker overlay
      this.displayPickerOverlay.classList.add('active');
      this.isDisplayPickerActive = true;
      
      // Update instruction text
      if (this.hintEl) this.hintEl.textContent = 'Click a display to capture';
      
    } catch (error) {
      console.error('Error showing display picker:', error);
      this.showToast('Failed to open display picker');
    }
  }

  buildDisplayList() {
    this.displayPickerList.innerHTML = '';
    
    this.displays.forEach((display, index) => {
      const displayItem = document.createElement('div');
      displayItem.className = 'display-item';
      displayItem.dataset.displayId = display.id;
      
      // Create display info
      const bounds = display.bounds;
      const resolution = bounds.width + ' × ' + bounds.height;
      const scaleText = display.scaleFactor !== 1 ? ' @ ' + display.scaleFactor + 'x' : '';
      const position = bounds.x !== 0 || bounds.y !== 0 ? 
        '(' + (bounds.x >= 0 ? '+' : '') + bounds.x + ', ' + (bounds.y >= 0 ? '+' : '') + bounds.y + ')' : 
        '(Primary)';
      
      displayItem.innerHTML = `
        <div class="display-icon ${display.isPrimary ? 'primary' : ''}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
          </svg>
        </div>
        <div class="display-info">
          <div class="display-label">${this.escapeHtml(display.label)}</div>
          <div class="display-details">
            <span class="display-resolution">${resolution}${scaleText}</span>
            <span class="display-position">${position}</span>
          </div>
        </div>
        <div class="display-select-hint">Click to capture</div>
      `;
      
      // Add hover effect
      displayItem.addEventListener('mouseenter', () => {
        this.highlightDisplay(display);
      });
      
      displayItem.addEventListener('mouseleave', () => {
        this.unhighlightDisplay();
      });
      
      // Add click handler
      displayItem.addEventListener('click', () => {
        this.captureDisplay(display.id);
      });
      
      this.displayPickerList.appendChild(displayItem);
    });
  }

  buildVisualMap() {
    if (!this.displayVisualMap) return;
    
    this.displayVisualMap.innerHTML = '';
    
    if (this.displays.length <= 1) {
      // Single display - show simple representation
      const singleDisplay = document.createElement('div');
      singleDisplay.className = 'visual-map-single';
      singleDisplay.innerHTML = `
        <svg viewBox="0 0 200 120" width="100%" height="100%">
          <rect x="20" y="20" width="160" height="80" rx="4" fill="#2a2a3a" stroke="#444" stroke-width="2"/>
          <text x="100" y="65" text-anchor="middle" fill="#888" font-size="12">Single Display</text>
        </svg>
      `;
      this.displayVisualMap.appendChild(singleDisplay);
      return;
    }
    
    // Multi-display - calculate scale for visual map
    const allDisplays = this.displays;
    const minX = Math.min(...allDisplays.map(d => d.bounds.x));
    const minY = Math.min(...allDisplays.map(d => d.bounds.y));
    const maxX = Math.max(...allDisplays.map(d => d.bounds.x + d.bounds.width));
    const maxY = Math.max(...allDisplays.map(d => d.bounds.y + d.bounds.height));
    
    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;
    const padding = 20;
    const mapWidth = 200;
    const mapHeight = Math.round((totalHeight / totalWidth) * mapWidth);
    
    const scaleX = (mapWidth - padding * 2) / totalWidth;
    const scaleY = (mapHeight - padding * 2) / totalHeight;
    const visualScale = Math.min(scaleX, scaleY);
    
    const visualMap = document.createElement('div');
    visualMap.className = 'visual-map-container';
    visualMap.style.cssText = 'width: 100%; height: ' + Math.min(150, mapHeight) + 'px; position: relative;';
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + mapWidth + ' ' + mapHeight);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';
    
    const displayColors = ['#4a9eff', '#50c878', '#ff6b6b', '#ffd93d', '#c678dd'];
    
    allDisplays.forEach((display, index) => {
      const bounds = display.bounds;
      const x = padding + (bounds.x - minX) * visualScale;
      const y = padding + (bounds.y - minY) * visualScale;
      const width = bounds.width * visualScale;
      const height = bounds.height * visualScale;
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x.toString());
      rect.setAttribute('y', y.toString());
      rect.setAttribute('width', width.toString());
      rect.setAttribute('height', height.toString());
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', displayColors[index % displayColors.length]);
      rect.setAttribute('stroke', display.isPrimary ? '#fff' : 'none');
      rect.setAttribute('stroke-width', display.isPrimary ? '2' : '0');
      rect.setAttribute('opacity', '0.3');
      rect.dataset.displayId = display.id;
      rect.style.cursor = 'pointer';
      rect.style.transition = 'opacity 0.2s';
      
      rect.addEventListener('mouseenter', () => {
        rect.setAttribute('opacity', '0.6');
        this.highlightDisplay(display);
      });
      
      rect.addEventListener('mouseleave', () => {
        rect.setAttribute('opacity', '0.3');
        this.unhighlightDisplay();
      });
      
      rect.addEventListener('click', () => {
        this.captureDisplay(display.id);
      });
      
      svg.appendChild(rect);
      
      // Add label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (x + width / 2).toString());
      label.setAttribute('y', (y + height / 2).toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('fill', '#fff');
      label.setAttribute('font-size', Math.min(12, width / 4).toString());
      label.setAttribute('font-weight', 'bold');
      label.textContent = (index + 1).toString();
      label.style.pointerEvents = 'none';
      
      svg.appendChild(label);
    });
    
    visualMap.appendChild(svg);
    this.displayVisualMap.appendChild(visualMap);
  }

  async captureDisplay(displayId) {
    try {
      this.showToast('Capturing display...');
      
      const result = await window.browserAPI.screenshot.captureDisplay(displayId);
      
      if (!result.success) {
        this.showToast('Failed to capture display');
        return;
      }
      
      // Hide display picker
      this.hideDisplayPicker();
      
      // Start the overlay with captured image
      this.start(result.dataUrl);
      
      this.showToast('Display captured! Select area or click Full Screen');
      
    } catch (error) {
      console.error('Error capturing display:', error);
      this.showToast('Failed to capture display');
    }
  }

  hideDisplayPicker() {
    this.displayPickerOverlay.classList.remove('active');
    this.isDisplayPickerActive = false;
    this.unhighlightDisplay();
    
    // Reset instruction text
    if (this.hintEl) this.hintEl.textContent = 'Drag to select area';
  }

  highlightDisplay(display) {
    if (this.hoveredDisplay === display.id) return;
    this.hoveredDisplay = display.id;
    
    // Highlight in list
    const displayItem = this.displayPickerList.querySelector('[data-display-id="' + display.id + '"]');
    if (displayItem) {
      displayItem.classList.add('highlighted');
    }
    
    // Highlight in visual map
    if (this.displayVisualMap) {
      const visualRect = this.displayVisualMap.querySelector('[data-display-id="' + display.id + '"]');
      if (visualRect) {
        visualRect.setAttribute('opacity', '0.6');
      }
    }
  }

  unhighlightDisplay() {
    if (this.hoveredDisplay) {
      // Remove highlight from list
      const displayItem = this.displayPickerList.querySelector('[data-display-id="' + this.hoveredDisplay + '"]');
      if (displayItem) {
        displayItem.classList.remove('highlighted');
      }
      
      // Remove highlight from visual map
      if (this.displayVisualMap) {
        const visualRect = this.displayVisualMap.querySelector('[data-display-id="' + this.hoveredDisplay + '"]');
        if (visualRect) {
          visualRect.setAttribute('opacity', '0.3');
        }
      }
    }
    this.hoveredDisplay = null;
  }
}
