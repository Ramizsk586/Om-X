(function () {
  'use strict';
  if (window.OmxPathSelectionTool && typeof window.OmxPathSelectionTool.create === 'function') return;

  function hasUsablePath(path) {
    return !!(path && Array.isArray(path.points) && path.points.length >= 1);
  }

  function clamp(v, min, max) {
    v = Number(v);
    if (!Number.isFinite(v)) v = min;
    return Math.min(max, Math.max(min, v));
  }

  function pointInRect(point, rect) {
    if (!point || !rect) return false;
    return point.x >= rect.x && point.x <= (rect.x + rect.width) && point.y >= rect.y && point.y <= (rect.y + rect.height);
  }

  function expandRect(rect, pad) {
    const p = Math.max(0, Number(pad) || 0);
    return {
      x: rect.x - p,
      y: rect.y - p,
      width: rect.width + (p * 2),
      height: rect.height + (p * 2)
    };
  }

  function copyPoint(point) {
    return point ? { x: Number(point.x) || 0, y: Number(point.y) || 0 } : null;
  }

  function PathSelectionTool(host) {
    this.host = host || {};
    this.toolActive = false;
    this.selected = false;
    this.dragging = false;
    this.dragMoved = false;
    this.lastPoint = null;
    this.startPoint = null;
  }

  PathSelectionTool.prototype._getPath = function () {
    if (this.host && typeof this.host.getPenPath === 'function') return this.host.getPenPath();
    return null;
  };

  PathSelectionTool.prototype._hasPath = function () {
    const path = this._getPath();
    if (hasUsablePath(path)) return true;
    if (this.host && typeof this.host.isPenPathUsable === 'function') {
      try { return !!this.host.isPenPathUsable(); } catch (_) { return false; }
    }
    return false;
  };

  PathSelectionTool.prototype._getBounds = function () {
    if (this.host && typeof this.host.getPenBounds === 'function') return this.host.getPenBounds();
    return null;
  };

  PathSelectionTool.prototype._render = function () {
    if (this.host && typeof this.host.requestRender === 'function') this.host.requestRender();
  };

  PathSelectionTool.prototype._status = function (message, tone) {
    if (this.host && typeof this.host.setStatus === 'function') this.host.setStatus(message, tone || 'info');
  };

  PathSelectionTool.prototype._history = function (label, muted) {
    if (this.host && typeof this.host.pushHistory === 'function') this.host.pushHistory(label, !!muted);
  };

  PathSelectionTool.prototype._syncSelection = function () {
    if (this._hasPath()) return;
    this.selected = false;
    this.dragging = false;
    this.dragMoved = false;
    this.lastPoint = null;
    this.startPoint = null;
  };

  PathSelectionTool.prototype.setToolActive = function (active) {
    this.toolActive = !!active;
    if (!this.toolActive) this.cancelDrag();
    this._syncSelection();
  };

  PathSelectionTool.prototype.clearSelection = function (options) {
    const silent = !!(options && options.silent);
    if (!this.selected && !this.dragging) return false;
    this.selected = false;
    this.cancelDrag();
    if (!silent) this._status('Path selection cleared.', 'info');
    this._render();
    return true;
  };

  PathSelectionTool.prototype.selectPath = function (options) {
    this._syncSelection();
    if (!this._hasPath()) return false;
    this.selected = true;
    this.cancelDrag();
    if (this.host && typeof this.host.clearPenAnchorSelection === 'function') {
      this.host.clearPenAnchorSelection();
    }
    if (!(options && options.noRender)) this._render();
    if (!(options && options.silent)) this._status('Path selected.', 'success');
    return true;
  };

  PathSelectionTool.prototype.cancelDrag = function () {
    this.dragging = false;
    this.dragMoved = false;
    this.lastPoint = null;
    this.startPoint = null;
  };

  PathSelectionTool.prototype._hitTest = function (point) {
    if (!point || !this._hasPath()) return false;
    if (this.host && typeof this.host.hitTestPenPath === 'function') {
      const hit = this.host.hitTestPenPath(point, 10);
      if (hit === true) return true;
      if (hit && typeof hit === 'object' && hit.hit) return true;
    }
    const bounds = this._getBounds();
    if (!bounds) return false;
    return pointInRect(point, expandRect(bounds, 10));
  };

  PathSelectionTool.prototype.handlePointerDown = function (point) {
    this._syncSelection();
    if (!this._hasPath()) {
      this.selected = false;
      this._status('No path to select. Use the Pen Tool first.', 'info');
      this._render();
      return { handled: true, startDrag: false };
    }

    if (!this._hitTest(point)) {
      if (this.selected) {
        this.selected = false;
        this.cancelDrag();
        this._status('Path deselected.', 'info');
        this._render();
      }
      return { handled: true, startDrag: false };
    }

    if (this.host && typeof this.host.clearPenAnchorSelection === 'function') {
      this.host.clearPenAnchorSelection();
    }
    this.selected = true;
    this.dragging = true;
    this.dragMoved = false;
    this.startPoint = copyPoint(point);
    this.lastPoint = copyPoint(point);
    this._render();
    return { handled: true, startDrag: true };
  };

  PathSelectionTool.prototype.handlePointerMove = function (point) {
    this._syncSelection();
    if (!this.dragging || !this.selected || !point || !this.lastPoint) return false;

    const dx = (Number(point.x) || 0) - (Number(this.lastPoint.x) || 0);
    const dy = (Number(point.y) || 0) - (Number(this.lastPoint.y) || 0);
    if (Math.abs(dx) + Math.abs(dy) < 0.001) return false;

    if (!this.host || typeof this.host.movePenPath !== 'function') return false;
    const moved = this.host.movePenPath(dx, dy);
    if (!moved) return false;

    this.lastPoint = copyPoint(point);
    this.dragMoved = true;
    this._render();
    return true;
  };

  PathSelectionTool.prototype.handlePointerUp = function () {
    const hadSelection = this.selected;
    const moved = !!this.dragMoved;
    this.cancelDrag();
    this._syncSelection();
    if (!hadSelection) return false;

    if (moved) {
      this._history('Move path');
      this._status('Path moved.', 'success');
    } else {
      this._status('Path selected. Drag to move it, Enter to apply, Delete to clear.', 'success');
    }
    this._render();
    return true;
  };

  PathSelectionTool.prototype.handleKeyDown = function (event) {
    if (!this.toolActive) return false;
    this._syncSelection();
    if (!this.selected || !event) return false;

    const key = String(event.key || '').toLowerCase();
    if (key === 'escape') {
      event.preventDefault();
      this.clearSelection();
      return true;
    }
    if ((key === 'backspace' || key === 'delete') && this.host && typeof this.host.clearPenPath === 'function') {
      event.preventDefault();
      const hadPath = this._hasPath();
      const result = this.host.clearPenPath({ silent: true });
      this.selected = false;
      this.cancelDrag();
      if (result !== false || hadPath) {
        this._history('Delete path');
        this._status('Path deleted.', 'success');
        this._render();
        return true;
      }
    }
    return false;
  };

  PathSelectionTool.prototype.render = function (ctx) {
    this._syncSelection();
    if (!ctx || (!this.toolActive && !this.selected)) return;
    const path = this._getPath();
    if (!hasUsablePath(path)) return;

    const bounds = this._getBounds();
    if (!bounds) return;

    const pad = this.selected ? 8 : 6;
    const x = bounds.x - pad;
    const y = bounds.y - pad;
    const w = Math.max(0, bounds.width + (pad * 2));
    const h = Math.max(0, bounds.height + (pad * 2));
    const isSelected = !!this.selected;

    ctx.save();
    ctx.setLineDash(isSelected ? [7, 4] : [5, 4]);
    ctx.lineWidth = isSelected ? 1.2 : 1;
    ctx.strokeStyle = isSelected ? 'rgba(120, 190, 255, 0.95)' : 'rgba(120, 190, 255, 0.38)';
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.setLineDash([]);

    if (isSelected) {
      const handles = [
        [x, y],
        [x + (w / 2), y],
        [x + w, y],
        [x, y + (h / 2)],
        [x + w, y + (h / 2)],
        [x, y + h],
        [x + (w / 2), y + h],
        [x + w, y + h]
      ];
      for (const handle of handles) {
        ctx.fillStyle = '#dfe7ff';
        ctx.strokeStyle = 'rgba(9, 12, 18, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.fillRect(Math.round(handle[0] - 3), Math.round(handle[1] - 3), 6, 6);
        ctx.strokeRect(Math.round(handle[0] - 3) + 0.5, Math.round(handle[1] - 3) + 0.5, 5, 5);
      }

      const label = 'Path';
      ctx.font = '600 11px Segoe UI, sans-serif';
      const textW = Math.ceil(ctx.measureText(label).width);
      const labelX = x + 6;
      const labelY = y - 22;
      ctx.fillStyle = 'rgba(12, 16, 25, 0.92)';
      ctx.strokeStyle = 'rgba(120, 190, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const bw = textW + 14;
      const bh = 18;
      const r = 8;
      ctx.moveTo(labelX + r, labelY);
      ctx.lineTo(labelX + bw - r, labelY);
      ctx.quadraticCurveTo(labelX + bw, labelY, labelX + bw, labelY + r);
      ctx.lineTo(labelX + bw, labelY + bh - r);
      ctx.quadraticCurveTo(labelX + bw, labelY + bh, labelX + bw - r, labelY + bh);
      ctx.lineTo(labelX + r, labelY + bh);
      ctx.quadraticCurveTo(labelX, labelY + bh, labelX, labelY + bh - r);
      ctx.lineTo(labelX, labelY + r);
      ctx.quadraticCurveTo(labelX, labelY, labelX + r, labelY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dfe7ff';
      ctx.fillText(label, labelX + 7, labelY + 13);
    }

    ctx.restore();
  };

  window.OmxPathSelectionTool = {
    create: function (host) {
      try {
        return new PathSelectionTool(host);
      } catch (error) {
        console.error('[ImageEditor][PathSelectionTool] init failed:', error);
        return null;
      }
    }
  };
})();
