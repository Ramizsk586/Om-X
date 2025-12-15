



export class ScreenshotOverlay {
  constructor(onCapture) {
    this.onCapture = onCapture;
    this.layer = document.getElementById('screenshot-layer');
    this.canvas = document.getElementById('screenshot-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.btnFull = document.getElementById('btn-ss-full');
    this.btnSave = document.getElementById('btn-ss-save');
    this.btnCancel = document.getElementById('btn-ss-cancel');

    this.sourceImage = null; // HTMLImageElement
    this.isSelecting = false;
    this.startPos = { x: 0, y: 0 };
    this.currentPos = { x: 0, y: 0 };
    
    this.init();
  }

  init() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));

    this.btnFull.addEventListener('click', () => {
      if (this.sourceImage) {
        this.finish(this.sourceImage.src);
      }
    });
    
    // Manual Save trigger (if no selection made but want full screen save)
    if(this.btnSave) {
        this.btnSave.addEventListener('click', () => {
             if (this.sourceImage) {
                 this.finish(this.sourceImage.src);
             }
        });
    }

    this.btnCancel.addEventListener('click', () => this.hide());
  }

  start(nativeImage) {
    const dataUrl = nativeImage.toDataURL();
    this.sourceImage = new Image();
    this.sourceImage.onload = () => {
      this.layer.classList.add('active');
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.render();
    };
    this.sourceImage.src = dataUrl;
  }

  hide() {
    this.layer.classList.remove('active');
    this.sourceImage = null;
    this.isSelecting = false;
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
    // We assume the screenshot matches the window size, which capturePage generally does for viewport
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
    // Crop Logic
    const temp = document.createElement('canvas');
    temp.width = w;
    temp.height = h;
    const tctx = temp.getContext('2d');
    
    // Draw only the selected part from source
    // Note: We use sourceImage dimensions relative to screen.
    // If DPI scaling issues arise, we might need adjustments, but typical Electron capture matches window pixels.
    tctx.drawImage(this.sourceImage, x, y, w, h, 0, 0, w, h);
    
    this.finish(temp.toDataURL());
  }

  finish(dataUrl) {
    this.hide();
    if (this.onCapture) this.onCapture(dataUrl);
  }
}