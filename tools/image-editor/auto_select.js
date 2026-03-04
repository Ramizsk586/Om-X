(function () {
  'use strict';
  if (window.OmxAutoSelect && typeof window.OmxAutoSelect.create === 'function') return;

  function n(v, d) {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, n(v, a)));
  }

  function safeStorageGet(key, fallback) {
    try {
      if (!window.localStorage) return fallback;
      const v = window.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function safeStorageSet(key, value) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function AutoSelectController(host) {
    this.host = host || {};
    this.els = this.host.els || {};
    this.enabled = true;
    this.target = 'layer';
    this._init();
  }

  AutoSelectController.prototype._status = function (message, tone) {
    if (this.host && typeof this.host.setStatus === 'function') this.host.setStatus(message, tone || 'info');
  };

  AutoSelectController.prototype._render = function () {
    if (this.host && typeof this.host.requestRender === 'function') this.host.requestRender();
  };

  AutoSelectController.prototype._collect = function (canvasPoint) {
    if (this.host && typeof this.host.collectCandidatesAtCanvasPoint === 'function') {
      const list = this.host.collectCandidatesAtCanvasPoint(canvasPoint);
      return Array.isArray(list) ? list.filter(Boolean) : [];
    }
    return [];
  };

  AutoSelectController.prototype._collectInSelection = function (selection) {
    if (this.host && typeof this.host.collectCandidatesInSelection === 'function') {
      const list = this.host.collectCandidatesInSelection(selection);
      return Array.isArray(list) ? list.filter(Boolean) : [];
    }
    return [];
  };

  AutoSelectController.prototype._startDrag = function (candidate, canvasPoint, event) {
    if (this.host && typeof this.host.startCandidateDrag === 'function') {
      return this.host.startCandidateDrag(candidate, canvasPoint, event) || { handled: false };
    }
    return { handled: false };
  };

  AutoSelectController.prototype._commitSelection = function (candidate, context) {
    if (this.host && typeof this.host.commitCandidateSelection === 'function') {
      return !!this.host.commitCandidateSelection(candidate, context || {});
    }
    return false;
  };

  AutoSelectController.prototype._replaceSelection = function (selection) {
    if (this.host && typeof this.host.replaceCanvasSelection === 'function') {
      return !!this.host.replaceCanvasSelection(selection);
    }
    return false;
  };

  AutoSelectController.prototype._selectionCenter = function (selection) {
    if (!selection) return { x: 0, y: 0 };
    if (selection.kind === 'lasso' && Array.isArray(selection.points) && selection.points.length) {
      let sx = 0, sy = 0, count = 0;
      for (let i = 0; i < selection.points.length; i += 1) {
        const p = selection.points[i];
        if (!p) continue;
        sx += n(p.x, 0);
        sy += n(p.y, 0);
        count += 1;
      }
      if (count) return { x: sx / count, y: sy / count };
    }
    return {
      x: n(selection.x, 0) + (n(selection.width, 0) / 2),
      y: n(selection.y, 0) + (n(selection.height, 0) / 2)
    };
  };

  AutoSelectController.prototype._init = function () {
    const cb = this.els.checkboxEl;
    const sel = this.els.targetSelectEl;

    const savedEnabled = safeStorageGet('omx:image-editor:auto-select:enabled', '1');
    const savedTarget = String(safeStorageGet('omx:image-editor:auto-select:target', 'layer') || 'layer').toLowerCase();

    this.enabled = savedEnabled !== '0';
    this.target = (savedTarget === 'group') ? 'group' : 'layer';

    if (cb) {
      cb.disabled = false;
      cb.checked = this.enabled;
      cb.addEventListener('change', () => {
        this.enabled = !!cb.checked;
        safeStorageSet('omx:image-editor:auto-select:enabled', this.enabled ? '1' : '0');
        this._status('Auto-Select ' + (this.enabled ? 'enabled' : 'disabled') + '.', 'success');
        this._render();
      });
    }

    if (sel) {
      sel.disabled = false;
      sel.value = this.target === 'group' ? 'Group' : 'Layer';
      sel.addEventListener('change', () => {
        const v = String(sel.value || 'Layer').toLowerCase();
        this.target = (v === 'group') ? 'group' : 'layer';
        safeStorageSet('omx:image-editor:auto-select:target', this.target);
        this._status(
          this.target === 'group'
            ? 'Auto-Select target: Group (family-aware object picking).'
            : 'Auto-Select target: Layer (topmost object).',
          'success'
        );
        this._render();
      });
    }
  };

  AutoSelectController.prototype.isEnabled = function () {
    return !!this.enabled;
  };

  AutoSelectController.prototype.getTarget = function () {
    return this.target;
  };

  AutoSelectController.prototype.getMoveHintSuffix = function () {
    if (!this.enabled) return 'Auto-Select off';
    return 'Auto-Select ' + (this.target === 'group' ? 'Group' : 'Layer');
  };

  AutoSelectController.prototype._scoreCandidate = function (candidate, point) {
    const bounds = candidate && candidate.boundsCanvas;
    const px = point ? n(point.x, 0) : 0;
    const py = point ? n(point.y, 0) : 0;
    let centerBonus = 0;
    let sizeBonus = 0;
    if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
      const cx = bounds.x + (bounds.width / 2);
      const cy = bounds.y + (bounds.height / 2);
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt((dx * dx) + (dy * dy));
      const diag = Math.max(1, Math.sqrt((bounds.width * bounds.width) + (bounds.height * bounds.height)));
      centerBonus = clamp(1 - (dist / diag), -0.25, 1.25) * 30;
      const area = Math.max(1, bounds.width * bounds.height);
      sizeBonus = clamp(22 - Math.log(area + 1), -12, 22);
    }

    const kind = String(candidate.kind || '');
    const hitKind = String(candidate.hitKind || '');
    const typePriority =
      kind === 'text' ? 42 :
      kind === 'path' ? 32 :
      kind === 'rectangle' ? 24 : 10;

    const hitPriority =
      hitKind === 'glyph' ? 55 :
      hitKind === 'fill' ? 42 :
      hitKind === 'stroke' ? 36 :
      hitKind === 'path' ? 34 :
      hitKind === 'bounds' ? 22 :
      hitKind === 'bounds-only' ? 12 : 10;

    const exactness = clamp(n(candidate.exactness, 0.5), 0, 1) * 90;
    const areaConfidence = clamp(n(candidate.areaConfidence, 0), 0, 1) * 95;
    const areaCoverage = clamp(n(candidate.areaCoverage, 0), 0, 1) * 55;
    const selectionContain = clamp(n(candidate.selectionContain, 0), 0, 1) * 40;
    const selectedBonus = candidate.selected ? 12 : 0;
    const z = n(candidate.zIndex, 0) * 6;

    return z + typePriority + hitPriority + exactness + areaConfidence + areaCoverage + selectionContain + centerBonus + sizeBonus + selectedBonus;
  };

  AutoSelectController.prototype._chooseLayerCandidate = function (candidates, point) {
    if (!candidates.length) return null;
    let best = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      c._score = this._scoreCandidate(c, point);
      if (!best || c._score > best._score) best = c;
    }
    return best || null;
  };

  AutoSelectController.prototype._chooseGroupCandidate = function (candidates, point) {
    if (!candidates.length) return null;
    const groups = new Map();
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      c._score = this._scoreCandidate(c, point);
      const family = String(c.family || c.kind || 'object');
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family).push(c);
    }

    let bestFamily = null;
    let bestFamilyScore = -Infinity;
    groups.forEach(function (items, family) {
      items.sort(function (a, b) { return (b._score || 0) - (a._score || 0); });
      const top = items[0] ? (items[0]._score || 0) : 0;
      const second = items[1] ? (items[1]._score || 0) * 0.45 : 0;
      const aggregate = top + second + (items.length > 2 ? Math.min(18, (items.length - 2) * 4) : 0);
      if (aggregate > bestFamilyScore) {
        bestFamilyScore = aggregate;
        bestFamily = family;
      }
    });
    if (!bestFamily || !groups.has(bestFamily)) return null;
    const familyItems = groups.get(bestFamily);
    familyItems.sort(function (a, b) { return (b._score || 0) - (a._score || 0); });
    return familyItems[0] || null;
  };

  AutoSelectController.prototype.pickCandidate = function (candidates, point) {
    if (!Array.isArray(candidates) || !candidates.length) return null;
    return this.target === 'group'
      ? this._chooseGroupCandidate(candidates, point)
      : this._chooseLayerCandidate(candidates, point);
  };

  AutoSelectController.prototype.tryStartFromMoveTool = function (canvasPoint, event) {
    if (!this.enabled) return { handled: false };
    const candidates = this._collect(canvasPoint);
    if (!candidates.length) return { handled: false };

    const chosen = this.pickCandidate(candidates, canvasPoint);
    if (!chosen) return { handled: false };

    const result = this._startDrag(chosen, canvasPoint, event) || { handled: false };
    if (result.handled === true && result.startDrag !== false) {
      const label = chosen.label || chosen.kind || 'object';
      const modeLabel = this.target === 'group' ? 'Group' : 'Layer';
      this._status('Auto-Select (' + modeLabel + '): ' + label + ' selected.', 'success');
    }
    return result;
  };

  AutoSelectController.prototype.tryRefineLassoSelection = function (selection, context) {
    if (!this.enabled) return { handled: false, refined: false };
    if (!selection || !selection.kind) return { handled: false, refined: false };
    if (selection.kind !== 'lasso' && selection.kind !== 'marquee') return { handled: false, refined: false };

    const candidates = this._collectInSelection(selection);
    if (!candidates.length) return { handled: false, refined: false };

    const focus = this._selectionCenter(selection);
    const chosen = this.pickCandidate(candidates, focus);
    if (!chosen) return { handled: false, refined: false };

    let snappedSelection = null;
    if (this.host && typeof this.host.createSelectionFromCandidate === 'function') {
      snappedSelection = this.host.createSelectionFromCandidate(chosen, selection, context || {}) || null;
    }

    const committed = this._commitSelection(chosen, Object.assign({ source: 'lasso-auto-select' }, context || {}));
    const replaced = snappedSelection ? this._replaceSelection(snappedSelection) : false;

    const modeLabel = this.target === 'group' ? 'Group' : 'Layer';
    this._status('Lasso Auto-Select (' + modeLabel + '): snapped to ' + (chosen.label || chosen.kind || 'object') + '.', 'success');
    this._render();

    return {
      handled: true,
      refined: true,
      candidate: chosen,
      committed: committed,
      replacedSelection: replaced,
      selection: snappedSelection
    };
  };

  window.OmxAutoSelect = {
    create: function (host) {
      try {
        return new AutoSelectController(host);
      } catch (error) {
        console.error('[ImageEditor][AutoSelect] init failed:', error);
        return null;
      }
    }
  };
})();
