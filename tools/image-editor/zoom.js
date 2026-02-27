(function () {
  'use strict';
  if (window.OmxZoomTool && typeof window.OmxZoomTool.create === 'function') return;

  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.min(b, Math.max(a, v));
  }

  function clonePoint(point) {
    if (!point) return null;
    return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  }

  function normalizeRect(a, b) {
    if (!a || !b) return null;
    const x1 = Number(a.x) || 0;
    const y1 = Number(a.y) || 0;
    const x2 = Number(b.x) || 0;
    const y2 = Number(b.y) || 0;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  function dist(a, b) {
    if (!a || !b) return 0;
    const dx = (Number(a.x) || 0) - (Number(b.x) || 0);
    const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
    return Math.sqrt((dx * dx) + (dy * dy));
  }

  function ZoomTool(host) {
    this.host = host || {};
    this.toolActive = false;
    this.dragging = false;
    this.dragMoved = false;
    this.dragStart = null;
    this.dragCurrent = null;
    this.previewRect = null;
  }

  ZoomTool.prototype._hasImage = function () {
    if (this.host && typeof this.host.hasImage === 'function') return !!this.host.hasImage();
    return false;
  };

  ZoomTool.prototype._status = function (message, tone) {
    if (this.host && typeof this.host.setStatus === 'function') this.host.setStatus(message, tone || 'info');
  };

  ZoomTool.prototype._render = function () {
    if (this.host && typeof this.host.requestRender === 'function') this.host.requestRender();
  };

  ZoomTool.prototype._zoomAt = function (point, factor) {
    if (!point || !this.host || typeof this.host.zoomAtPoint !== 'function') return false;
    return !!this.host.zoomAtPoint(point.x, point.y, factor);
  };

  ZoomTool.prototype._zoomToRect = function (rect) {
    if (!rect || !this.host || typeof this.host.zoomToRect !== 'function') return false;
    return !!this.host.zoomToRect(rect);
  };

  ZoomTool.prototype._isZoomOutIntent = function (event) {
    if (!event) return false;
    return !!(event.altKey || event.shiftKey);
  };

  ZoomTool.prototype._clearPreview = function () {
    const had = !!this.previewRect;
    this.previewRect = null;
    this.dragStart = null;
    this.dragCurrent = null;
    this.dragMoved = false;
    this.dragging = false;
    return had;
  };

  ZoomTool.prototype.setToolActive = function (active) {
    this.toolActive = !!active;
    if (!this.toolActive) {
      const had = this._clearPreview();
      if (had) this._render();
    }
  };

  ZoomTool.prototype.handlePointerDown = function (point) {
    if (!this._hasImage()) {
      this._status('Zoom Tool: import an image first.', 'info');
      return { handled: true, startDrag: false };
    }
    this.dragging = true;
    this.dragMoved = false;
    this.dragStart = clonePoint(point);
    this.dragCurrent = clonePoint(point);
    this.previewRect = null;
    return { handled: true, startDrag: true };
  };

  ZoomTool.prototype.handlePointerMove = function (point) {
    if (!this.dragging || !this.dragStart || !point) return false;
    this.dragCurrent = clonePoint(point);
    const distance = dist(this.dragStart, this.dragCurrent);
    if (distance >= 9) {
      this.dragMoved = true;
      this.previewRect = normalizeRect(this.dragStart, this.dragCurrent);
      this._render();
      return true;
    }
    if (this.previewRect) {
      this.previewRect = null;
      this._render();
      return true;
    }
    return false;
  };

  ZoomTool.prototype.handlePointerUp = function (point, event) {
    if (!this.dragging) return false;
    const endPoint = clonePoint(point) || this.dragCurrent || this.dragStart;
    const usedBox = !!(this.dragMoved && this.previewRect && this.previewRect.width >= 12 && this.previewRect.height >= 12);
    const previewRect = this.previewRect ? {
      x: this.previewRect.x,
      y: this.previewRect.y,
      width: this.previewRect.width,
      height: this.previewRect.height
    } : null;
    this._clearPreview();

    if (usedBox && previewRect) {
      const ok = this._zoomToRect(previewRect);
      if (ok) this._status('Zoomed to selection.', 'success');
      else this._status('Zoom box canceled.', 'info');
      this._render();
      return ok;
    }

    if (!endPoint) return false;
    const zoomOut = this._isZoomOutIntent(event);
    const factor = zoomOut ? (1 / 1.25) : 1.25;
    const ok = this._zoomAt(endPoint, factor);
    if (ok) {
      this._status(zoomOut ? 'Zoomed out.' : 'Zoomed in.', 'success');
    }
    return ok;
  };

  ZoomTool.prototype.cancelDrag = function () {
    const had = this._clearPreview();
    if (had) this._render();
  };

  ZoomTool.prototype.render = function (ctx) {
    if (!ctx || !this.toolActive || !this.previewRect || !this.dragMoved) return;
    const r = this.previewRect;
    if (!(r.width > 1 && r.height > 1)) return;

    const x = r.x;
    const y = r.y;
    const w = r.width;
    const h = r.height;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.lineDashOffset = 5;
    ctx.strokeStyle = 'rgba(10,12,18,0.95)';
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.setLineDash([]);

    const label = 'Zoom';
    ctx.font = '600 11px Segoe UI, sans-serif';
    const tw = Math.ceil(ctx.measureText(label).width);
    const lx = x + 6;
    const ly = Math.max(4, y - 20);
    const bw = tw + 14;
    const bh = 16;
    ctx.fillStyle = 'rgba(12,16,25,0.92)';
    ctx.strokeStyle = 'rgba(120,190,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const rad = 6;
    ctx.moveTo(lx + rad, ly);
    ctx.lineTo(lx + bw - rad, ly);
    ctx.quadraticCurveTo(lx + bw, ly, lx + bw, ly + rad);
    ctx.lineTo(lx + bw, ly + bh - rad);
    ctx.quadraticCurveTo(lx + bw, ly + bh, lx + bw - rad, ly + bh);
    ctx.lineTo(lx + rad, ly + bh);
    ctx.quadraticCurveTo(lx, ly + bh, lx, ly + bh - rad);
    ctx.lineTo(lx, ly + rad);
    ctx.quadraticCurveTo(lx, ly, lx + rad, ly);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#dfe7ff';
    ctx.fillText(label, lx + 7, ly + 12);

    ctx.restore();
  };

  window.OmxZoomTool = {
    create: function (host) {
      try {
        return new ZoomTool(host);
      } catch (error) {
        console.error('[ImageEditor][ZoomTool] init failed:', error);
        return null;
      }
    }
  };
})();
