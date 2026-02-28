(function () {
  'use strict';
  if (window.OmxHandTool && typeof window.OmxHandTool.create === 'function') return;

  function clonePoint(point) {
    if (!point) return null;
    return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  }

  function HandTool(host) {
    this.host = host || {};
    this.toolActive = false;
    this.dragging = false;
    this.dragMoved = false;
    this.lastPoint = null;
  }

  HandTool.prototype._hasImage = function () {
    if (this.host && typeof this.host.hasImage === 'function') return !!this.host.hasImage();
    return false;
  };

  HandTool.prototype._panBy = function (dx, dy) {
    if (this.host && typeof this.host.panBy === 'function') return !!this.host.panBy(dx, dy);
    return false;
  };

  HandTool.prototype._status = function (message, tone) {
    if (this.host && typeof this.host.setStatus === 'function') this.host.setStatus(message, tone || 'info');
  };

  HandTool.prototype.setToolActive = function (active) {
    this.toolActive = !!active;
    if (!this.toolActive) this.cancelDrag();
  };

  HandTool.prototype.handlePointerDown = function (point) {
    if (!this._hasImage()) {
      this._status('Hand Tool: import an image first.', 'info');
      return { handled: true, startDrag: false };
    }
    this.dragging = true;
    this.dragMoved = false;
    this.lastPoint = clonePoint(point);
    return { handled: true, startDrag: true };
  };

  HandTool.prototype.handlePointerMove = function (point) {
    if (!this.dragging || !point || !this.lastPoint) return false;
    const dx = (Number(point.x) || 0) - (Number(this.lastPoint.x) || 0);
    const dy = (Number(point.y) || 0) - (Number(this.lastPoint.y) || 0);
    if (Math.abs(dx) + Math.abs(dy) < 0.001) return false;
    this.lastPoint = clonePoint(point);
    if (Math.abs(dx) + Math.abs(dy) >= 0.5) this.dragMoved = true;
    return this._panBy(dx, dy);
  };

  HandTool.prototype.handlePointerUp = function () {
    const moved = !!this.dragMoved;
    this.cancelDrag();
    if (moved) {
      this._status('View panned.', 'success');
      return true;
    }
    return false;
  };

  HandTool.prototype.cancelDrag = function () {
    this.dragging = false;
    this.dragMoved = false;
    this.lastPoint = null;
  };

  window.OmxHandTool = {
    create: function (host) {
      try {
        return new HandTool(host);
      } catch (error) {
        console.error('[ImageEditor][HandTool] init failed:', error);
        return null;
      }
    }
  };
})();
