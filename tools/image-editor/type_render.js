(function () {
  'use strict';
  if (window.OmxTypeTool && typeof window.OmxTypeTool.create === 'function') return;

  const FONTS = ['Segoe UI', 'Arial', 'Verdana', 'Tahoma', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Courier New', 'Consolas', 'Impact'];
  let nextId = 1;

  function n(v, d) { v = Number(v); return Number.isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, n(v, a))); }
  function rgba(hex, alpha, fb) {
    const m = String(hex || '').match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    let r = 255, g = 255, b = 255;
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      const x = parseInt(h, 16); r = (x >> 16) & 255; g = (x >> 8) & 255; b = x & 255;
    } else if (Array.isArray(fb)) { r = fb[0] || 255; g = fb[1] || 255; b = fb[2] || 255; }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + clamp(alpha, 0, 1) + ')';
  }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }

  function ensureStyles() {
    if (document.getElementById('omx-type-style')) return;
    const st = document.createElement('style');
    st.id = 'omx-type-style';
    st.textContent = `
      .right-sidebar{position:relative}
      .omx-type-panel,.omx-type-panel *{box-sizing:border-box}
      .omx-type-panel{
        position:absolute;top:0;right:0;bottom:0;z-index:25;
        width:min(460px,calc(100vw - 56px));min-height:0;overflow:hidden;
        background:#0f1013;border-left:1px solid #20222a;
        box-shadow:-16px 0 28px rgba(0,0,0,.28);
        display:grid;grid-template-rows:38px minmax(0,1fr);
        transform:translateX(106%);transition:transform .18s ease
      }
      .omx-type-panel.open{transform:translateX(0)}
      .omx-type-head{
        display:flex;align-items:center;justify-content:space-between;
        padding:0 10px;background:#101219;border-bottom:1px solid #20222a
      }
      .omx-type-head b{font-size:12px;font-weight:600;color:#eef1ff;letter-spacing:.02em}
      .omx-type-head span{
        font-size:10px;color:#b8c0d3;border:1px solid #2a2d38;background:#151822;
        border-radius:999px;padding:2px 7px
      }
      .omx-type-body{
        min-height:0;height:100%;
        display:block;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
        padding:8px 8px 10px;
        scrollbar-width:thin;scrollbar-color:#2a2d38 transparent
      }
      .omx-type-body::-webkit-scrollbar{width:8px}
      .omx-type-body::-webkit-scrollbar-track{background:transparent}
      .omx-type-body::-webkit-scrollbar-thumb{background:#2a2d38;border-radius:999px}
      .omx-type-sec{
        margin:0 0 8px 0;
        border:1px solid #20222a;background:#11131a;border-radius:10px;
        overflow:visible
      }
      .omx-type-sec:last-of-type{margin-bottom:0}
      .omx-type-sec>h4{
        margin:0;padding:8px 10px;
        font-size:11px;font-weight:600;color:#e7ecff;
        border-bottom:1px solid rgba(255,255,255,.03);background:#11131a
      }
      .omx-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px}
      .omx-type-field{display:grid;gap:4px;min-width:0}
      .omx-type-field.full{grid-column:1/-1}
      .omx-type-field label{font-size:10px;color:#b8c0d3;line-height:1.2}
      .omx-type-field input,
      .omx-type-field select,
      .omx-type-field textarea{
        width:100%;min-width:0;
        border:1px solid #2a2d38;background:#151822;color:#e7ecff;
        border-radius:8px;padding:5px 7px;font-size:11px;line-height:1.25;
        outline:none;box-shadow:none
      }
      .omx-type-field input:hover,.omx-type-field select:hover,.omx-type-field textarea:hover{border-color:#33384a}
      .omx-type-field input:focus,.omx-type-field select:focus,.omx-type-field textarea:focus{
        border-color:#4d87ff;box-shadow:0 0 0 2px rgba(77,135,255,.12)
      }
      .omx-type-field input:disabled,.omx-type-field select:disabled,.omx-type-field textarea:disabled{opacity:.55;cursor:not-allowed}
      .omx-type-field textarea{min-height:60px;max-height:180px;resize:vertical;line-height:1.35}
      .omx-type-field input[type=color]{height:30px;padding:2px}
      .omx-type-check{
        display:inline-flex;align-items:center;gap:6px;min-height:30px;
        border:1px solid #2a2d38;background:#151822;border-radius:8px;
        padding:0 8px;color:#dbe2f5;font-size:11px;line-height:1.2
      }
      .omx-type-check input{accent-color:#4d87ff;margin:0}
      .omx-type-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:8px}
      .omx-type-btn{
        border:1px solid #2a2d38;background:#151822;color:#dde4f6;
        border-radius:8px;padding:6px 7px;min-height:30px;
        font-size:11px;font-weight:500;line-height:1.15;cursor:pointer
      }
      .omx-type-btn:hover{background:#1b1f2c;border-color:#33384a}
      .omx-type-btn:disabled{opacity:.45;cursor:not-allowed}
      .omx-type-btn.danger{border-color:#4a3038;background:#24181c;color:#ffdbe0}
      .omx-type-btn.danger:hover{background:#2c1b20;border-color:#644049}
      .omx-type-list{display:grid;gap:4px;padding:0 8px 8px}
      .omx-type-row{
        display:grid;grid-template-columns:18px 1fr auto;gap:6px;align-items:center;
        padding:6px 7px;border:1px solid #20222a;background:#12141c;border-radius:8px;
        min-width:0;cursor:pointer
      }
      .omx-type-row:hover{border-color:#2a2d38;background:#141722}
      .omx-type-row.active{border-color:#4d87ff;background:rgba(77,135,255,.08);box-shadow:inset 0 0 0 1px rgba(77,135,255,.14)}
      .omx-type-row .name{font-size:11px;color:#e7ecff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .omx-type-row .meta{font-size:10px;color:#b8c0d3}
      .omx-type-empty{padding:8px;font-size:11px;color:#9fb0d4}
      .omx-type-tip{
        margin-top:8px;padding:8px 10px;font-size:10px;line-height:1.4;color:#9fb0d4;
        border:1px solid #20222a;border-radius:8px;background:#11131a
      }
      @media (max-width:760px){
        .omx-type-panel{width:min(100vw - 12px,420px)}
        .omx-type-grid{grid-template-columns:1fr}
        .omx-type-actions{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(st);
  }

  function defaultLayer(x, y, text) {
    const id = 'txt-' + (nextId++);
    return {
      id: id, name: 'Text ' + id.slice(4), visible: true, text: text || 'New Text',
      x: n(x, 0), y: n(y, 0),
      fontFamily: 'Segoe UI', fontSize: 44, fontWeight: '600', fontStyle: 'normal', align: 'left',
      lineHeight: 1.2, letterSpacing: 0, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, warpArc: 0, caseMode: 'none',
      blendMode: 'source-over', opacity: 1, fillColor: '#f8fbff', fillOpacity: 1,
      strokeEnabled: false, strokeColor: '#0a0d15', strokeWidth: 2,
      shadowEnabled: false, shadowColor: '#000000', shadowOpacity: 0.45, shadowBlur: 10, shadowOffsetX: 6, shadowOffsetY: 6,
      glowEnabled: false, glowColor: '#67a7ff', glowOpacity: 0.3, glowBlur: 14,
      bevelEnabled: false, bevelSize: 2, bevelStrength: 0.45, bevelHighlightColor: '#ffffff', bevelHighlightOpacity: 0.55, bevelShadowColor: '#070a10', bevelShadowOpacity: 0.4
    };
  }

  function TypeTool(host) {
    this.host = host || {};
    this.layers = [];
    this.selectedId = null;
    this.toolActive = false;
    this.drag = { active: false, layerId: null, offsetX: 0, offsetY: 0, moved: false };
    this.measureCanvas = document.createElement('canvas');
    this.measureCtx = this.measureCanvas.getContext('2d');
    this.els = { inputs: {}, actions: {} };
    ensureStyles();
    this._buildPanel();
    this.refreshPanel();
  }

  TypeTool.prototype._img = function () { return this.host.getImage ? this.host.getImage() : null; };
  TypeTool.prototype._rect = function () { return this.host.getImageDrawRect ? this.host.getImageDrawRect() : null; };
  TypeTool.prototype._map = function (x, y, o) { return this.host.canvasToImage ? this.host.canvasToImage(x, y, o) : null; };
  TypeTool.prototype._render = function () { if (this.host.requestRender) this.host.requestRender(); };
  TypeTool.prototype._status = function (m, t) { if (this.host.setStatus) this.host.setStatus(m, t || 'info'); };
  TypeTool.prototype._hist = function (m, muted) { if (this.host.pushHistory) this.host.pushHistory(m, muted); };
  TypeTool.prototype._dirty = function () { if (this.host.markDirty) this.host.markDirty(); };
  TypeTool.prototype._sel = function () { return this.layers.find((l) => l.id === this.selectedId) || null; };

  TypeTool.prototype.setToolActive = function (active) {
    this.toolActive = !!active;
    if (this.els.panel) this.els.panel.classList.toggle('open', this.toolActive);
    if (this.toolActive) this.refreshPanel();
  };

  TypeTool.prototype._buildPanel = function () {
    const parent = this.host.rightSidebarEl || document.querySelector('.right-sidebar');
    if (!parent) return;
    const p = document.createElement('div');
    p.className = 'omx-type-panel';
    p.innerHTML = `
      <div class="omx-type-head"><b>Type / Character</b><span>Advanced</span></div>
      <div class="omx-type-body">
        <section class="omx-type-sec">
          <h4>Text Layers</h4>
          <div class="omx-type-actions">
            <button class="omx-type-btn" data-act="add" type="button">+ Text</button>
            <button class="omx-type-btn" data-act="dup" type="button">Duplicate</button>
            <button class="omx-type-btn danger" data-act="del" type="button">Delete</button>
          </div>
          <div class="omx-type-list" data-role="list"></div>
          <div class="omx-type-empty" data-role="empty" hidden>No text layers. Click on the image with Type tool.</div>
        </section>
        <section class="omx-type-sec">
          <h4>Content</h4>
          <div class="omx-type-grid"><div class="omx-type-field full"><label>Text</label><textarea data-prop="text" spellcheck="false"></textarea></div></div>
        </section>
        <section class="omx-type-sec">
          <h4>Character</h4>
          <div class="omx-type-grid">
            <div class="omx-type-field full"><label>Font Family</label><select data-prop="fontFamily"></select></div>
            <div class="omx-type-field"><label>Size</label><input data-prop="fontSize" type="number" min="6" max="500" step="1"></div>
            <div class="omx-type-field"><label>Weight</label><select data-prop="fontWeight"><option>300</option><option>400</option><option>500</option><option>600</option><option>700</option><option>800</option></select></div>
            <div class="omx-type-field"><label>Style</label><select data-prop="fontStyle"><option value="normal">Normal</option><option value="italic">Italic</option></select></div>
            <div class="omx-type-field"><label>Align</label><select data-prop="align"><option>left</option><option>center</option><option>right</option></select></div>
            <div class="omx-type-field"><label>Case</label><select data-prop="caseMode"><option value="none">Original</option><option value="upper">UPPER</option><option value="lower">lower</option></select></div>
            <div class="omx-type-field"><label>Line Height</label><input data-prop="lineHeight" type="number" min="0.6" max="4" step="0.05"></div>
            <div class="omx-type-field"><label>Letter Space</label><input data-prop="letterSpacing" type="number" min="-10" max="50" step="0.1"></div>
          </div>
        </section>
        <section class="omx-type-sec">
          <h4>Transform</h4>
          <div class="omx-type-grid">
            <div class="omx-type-field"><label>Rotation</label><input data-prop="rotation" type="number" min="-360" max="360" step="1"></div>
            <div class="omx-type-field"><label>Opacity %</label><input data-prop="opacity" type="number" min="0" max="100" step="1"></div>
            <div class="omx-type-field"><label>Scale X %</label><input data-prop="scaleX" type="number" min="10" max="400" step="1"></div>
            <div class="omx-type-field"><label>Scale Y %</label><input data-prop="scaleY" type="number" min="10" max="400" step="1"></div>
            <div class="omx-type-field"><label>Skew X</label><input data-prop="skewX" type="number" min="-60" max="60" step="1"></div>
            <div class="omx-type-field"><label>Warp Arc</label><input data-prop="warpArc" type="number" min="-100" max="100" step="1"></div>
            <div class="omx-type-field full"><label>Blend Mode</label><select data-prop="blendMode"><option value="source-over">Normal</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="multiply">Multiply</option><option value="soft-light">Soft Light</option><option value="lighter">Lighten (Add)</option></select></div>
          </div>
        </section>
        <section class="omx-type-sec">
          <h4>Fill & Stroke</h4>
          <div class="omx-type-grid">
            <div class="omx-type-field"><label>Fill Color</label><input data-prop="fillColor" type="color"></div>
            <div class="omx-type-field"><label>Fill Opacity %</label><input data-prop="fillOpacity" type="number" min="0" max="100" step="1"></div>
            <div class="omx-type-field full"><label class="omx-type-check"><input data-prop="strokeEnabled" type="checkbox"> Enable Stroke</label></div>
            <div class="omx-type-field"><label>Stroke Color</label><input data-prop="strokeColor" type="color"></div>
            <div class="omx-type-field"><label>Stroke Width</label><input data-prop="strokeWidth" type="number" min="0" max="40" step="0.25"></div>
          </div>
        </section>
        <section class="omx-type-sec">
          <h4>Shadow / Bevel / Glow</h4>
          <div class="omx-type-grid">
            <div class="omx-type-field full"><label class="omx-type-check"><input data-prop="shadowEnabled" type="checkbox"> Drop Shadow</label></div>
            <div class="omx-type-field"><label>Shadow Color</label><input data-prop="shadowColor" type="color"></div>
            <div class="omx-type-field"><label>Shadow Opacity %</label><input data-prop="shadowOpacity" type="number" min="0" max="100" step="1"></div>
            <div class="omx-type-field"><label>Shadow Blur</label><input data-prop="shadowBlur" type="number" min="0" max="80" step="1"></div>
            <div class="omx-type-field"><label>Shadow X</label><input data-prop="shadowOffsetX" type="number" min="-200" max="200" step="1"></div>
            <div class="omx-type-field"><label>Shadow Y</label><input data-prop="shadowOffsetY" type="number" min="-200" max="200" step="1"></div>
            <div class="omx-type-field full"><label class="omx-type-check"><input data-prop="bevelEnabled" type="checkbox"> Bevel</label></div>
            <div class="omx-type-field"><label>Bevel Size</label><input data-prop="bevelSize" type="number" min="0" max="20" step="0.5"></div>
            <div class="omx-type-field"><label>Bevel Strength %</label><input data-prop="bevelStrength" type="number" min="0" max="100" step="1"></div>
            <div class="omx-type-field"><label>Hi Color</label><input data-prop="bevelHighlightColor" type="color"></div>
            <div class="omx-type-field"><label>Hi Opacity %</label><input data-prop="bevelHighlightOpacity" type="number" min="0" max="100" step="1"></div>
            <div class="omx-type-field"><label>Low Color</label><input data-prop="bevelShadowColor" type="color"></div>
            <div class="omx-type-field"><label>Low Opacity %</label><input data-prop="bevelShadowOpacity" type="number" min="0" max="100" step="1"></div>
            <div class="omx-type-field full"><label class="omx-type-check"><input data-prop="glowEnabled" type="checkbox"> Outer Glow</label></div>
            <div class="omx-type-field"><label>Glow Color</label><input data-prop="glowColor" type="color"></div>
            <div class="omx-type-field"><label>Glow Opacity %</label><input data-prop="glowOpacity" type="number" min="0" max="100" step="1"></div>
            <div class="omx-type-field full"><label>Glow Blur</label><input data-prop="glowBlur" type="number" min="0" max="80" step="1"></div>
          </div>
        </section>
        <div class="omx-type-tip">Photoshop-style text controls: font, spacing, transform, fill/stroke, shadow, bevel, glow, blend mode.</div>
      </div>`;
    parent.appendChild(p);
    this.els.panel = p;
    this.els.list = p.querySelector('[data-role="list"]');
    this.els.empty = p.querySelector('[data-role="empty"]');
    this.els.actions.add = p.querySelector('[data-act="add"]');
    this.els.actions.dup = p.querySelector('[data-act="dup"]');
    this.els.actions.del = p.querySelector('[data-act="del"]');
    p.querySelectorAll('[data-prop]').forEach((el) => { this.els.inputs[el.getAttribute('data-prop')] = el; });
    const family = this.els.inputs.fontFamily;
    if (family) { family.innerHTML = FONTS.map((f) => '<option value="' + esc(f) + '">' + esc(f) + '</option>').join(''); }
    this.els.actions.add.addEventListener('click', () => this.addAtCenter());
    this.els.actions.dup.addEventListener('click', () => this.duplicateSelected());
    this.els.actions.del.addEventListener('click', () => this.removeSelected());
    this.els.list.addEventListener('click', (e) => this.onListClick(e));
    Object.keys(this.els.inputs).forEach((k) => {
      const el = this.els.inputs[k];
      const fn = () => this.onControl(k);
      el.addEventListener('input', fn);
      el.addEventListener('change', fn);
    });
  };

  TypeTool.prototype.addAtCenter = function () {
    const img = this._img();
    if (!img) { this._status('Import an image first, then add text.', 'info'); return; }
    this.layers.push(defaultLayer(img.width * 0.2, img.height * 0.2, 'New Text'));
    this.selectedId = this.layers[this.layers.length - 1].id;
    this.refreshPanel(); this._render(); this._dirty(); this._hist('Add text layer');
    this._status('Text layer added. Edit the content and effects from the Type panel.', 'success');
  };

  TypeTool.prototype.onListClick = function (e) {
    const row = e.target.closest('.omx-type-row');
    if (!row) return;
    const id = row.getAttribute('data-id');
    if (e.target.closest('[data-toggle-vis]')) {
      const l = this.layers.find((x) => x.id === id); if (!l) return;
      l.visible = !l.visible; this.refreshPanel(); this._render(); this._dirty();
      return;
    }
    this.selectedId = id; this.refreshPanel(false); this._render();
  };

  TypeTool.prototype._read = function (k, el) {
    if (el.type === 'checkbox') return !!el.checked;
    if (el.type === 'color') return String(el.value || '#ffffff');
    const raw = String(el.value || '');
    return raw;
  };

  TypeTool.prototype.onControl = function (k) {
    const l = this._sel(); if (!l) return;
    const el = this.els.inputs[k]; if (!el) return;
    let v = this._read(k, el);
    if (['fontSize', 'lineHeight', 'letterSpacing', 'rotation', 'opacity', 'fillOpacity', 'scaleX', 'scaleY', 'skewX', 'warpArc', 'strokeWidth', 'shadowOpacity', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'glowOpacity', 'glowBlur', 'bevelSize', 'bevelStrength', 'bevelHighlightOpacity', 'bevelShadowOpacity'].includes(k)) v = n(v, 0);
    if (k === 'fontSize') l[k] = clamp(v, 6, 500);
    else if (k === 'lineHeight') l[k] = clamp(v, 0.6, 4);
    else if (k === 'letterSpacing') l[k] = clamp(v, -10, 60);
    else if (k === 'rotation') l[k] = clamp(v, -360, 360);
    else if (k === 'opacity' || k === 'fillOpacity' || k === 'shadowOpacity' || k === 'glowOpacity' || k === 'bevelStrength' || k === 'bevelHighlightOpacity' || k === 'bevelShadowOpacity') l[k] = clamp(v / 100, 0, 1);
    else if (k === 'scaleX' || k === 'scaleY') l[k] = clamp(v / 100, 0.1, 4);
    else if (k === 'skewX') l[k] = clamp(v, -60, 60);
    else if (k === 'warpArc') l[k] = clamp(v, -100, 100);
    else if (k === 'strokeWidth') l[k] = clamp(v, 0, 40);
    else if (k === 'shadowBlur' || k === 'glowBlur') l[k] = clamp(v, 0, 80);
    else if (k === 'bevelSize') l[k] = clamp(v, 0, 20);
    else l[k] = v;
    if (k === 'text') l.name = (String(l.text || '').trim().split(/\s+/).slice(0, 3).join(' ') || l.name || 'Text').slice(0, 34);
    this._dirty(); this.refreshPanel(false); this._render();
  };

  TypeTool.prototype.refreshPanel = function (relist) {
    if (relist !== false) {
      const list = this.els.list; if (list) {
        list.innerHTML = '';
        if (this.els.empty) this.els.empty.hidden = this.layers.length > 0;
        for (let i = this.layers.length - 1; i >= 0; i -= 1) {
          const l = this.layers[i];
          list.insertAdjacentHTML('beforeend',
            '<div class="omx-type-row' + (l.id === this.selectedId ? ' active' : '') + '" data-id="' + esc(l.id) + '">' +
              '<button class="omx-type-btn" style="padding:2px 0;height:20px;border-radius:6px" data-toggle-vis type="button">' + (l.visible ? '&#128065;' : '&#128683;') + '</button>' +
              '<div class="name" title="' + esc(l.name) + '">' + esc(l.name) + '</div>' +
              '<div class="meta">' + Math.round(n(l.fontSize, 0)) + 'px</div>' +
            '</div>');
        }
      }
    }
    const l = this._sel(), ins = this.els.inputs;
    Object.keys(ins).forEach((k) => {
      const el = ins[k], has = !!l; el.disabled = !has;
      if (!has) return;
      if (el.type === 'checkbox') el.checked = !!l[k];
      else if (k === 'opacity' || k === 'fillOpacity' || k === 'shadowOpacity' || k === 'glowOpacity' || k === 'bevelStrength' || k === 'bevelHighlightOpacity' || k === 'bevelShadowOpacity') el.value = String(Math.round(clamp(l[k], 0, 1) * 100));
      else if (k === 'scaleX' || k === 'scaleY') el.value = String(Math.round(clamp(l[k], 0.1, 4) * 100));
      else el.value = String(l[k] != null ? l[k] : '');
    });
    if (this.els.actions.dup) this.els.actions.dup.disabled = !l;
    if (this.els.actions.del) this.els.actions.del.disabled = !l;
  };

  TypeTool.prototype.selectLayerById = function (id, opts) {
    const layer = this.layers.find((x) => x && x.id === id);
    if (!layer) return false;
    this.selectedId = layer.id;
    this.cancelDrag();
    this.refreshPanel(opts && opts.relist !== false);
    if (!(opts && opts.noRender)) this._render();
    if (!(opts && opts.silent)) this._status('Text layer selected.', 'success');
    return true;
  };

  TypeTool.prototype.clearAll = function (opts) {
    if (!this.layers.length) return false;
    this.layers = [];
    this.selectedId = null;
    this.cancelDrag();
    this.refreshPanel();
    if (!(opts && opts.noRender)) this._render();
    if (!(opts && opts.silent)) this._status('Text layers cleared.', 'info');
    return true;
  };

  TypeTool.prototype.duplicateSelected = function () {
    const l = this._sel();
    if (!l) return this._status('Select a text layer to duplicate.', 'info');
    const c = JSON.parse(JSON.stringify(l));
    c.id = 'txt-' + (nextId++);
    c.name = (l.name || 'Text') + ' Copy';
    c.x = n(l.x, 0) + 18;
    c.y = n(l.y, 0) + 18;
    this.layers.push(c);
    this.selectedId = c.id;
    this.refreshPanel(); this._render(); this._dirty(); this._hist('Duplicate text layer');
    this._status('Text layer duplicated.', 'success');
  };

  TypeTool.prototype.removeSelected = function () {
    const l = this._sel();
    if (!l) return false;
    const i = this.layers.findIndex((x) => x.id === l.id);
    if (i < 0) return false;
    this.layers.splice(i, 1);
    this.selectedId = this.layers.length ? this.layers[Math.max(0, i - 1)].id : null;
    this.refreshPanel(); this._render(); this._dirty(); this._hist('Delete text layer');
    this._status('Text layer deleted.', 'success');
    return true;
  };

  TypeTool.prototype._font = function (l) {
    return String(l.fontStyle || 'normal') + ' ' + String(l.fontWeight || '400') + ' ' + Math.max(1, n(l.fontSize, 40)) + 'px "' + String(l.fontFamily || 'Segoe UI').replace(/"/g, '') + '"';
  };

  TypeTool.prototype._normText = function (l) {
    let t = String(l && l.text != null ? l.text : '');
    if (!t) t = ' ';
    if (l.caseMode === 'upper') t = t.toUpperCase();
    else if (l.caseMode === 'lower') t = t.toLowerCase();
    return t;
  };

  TypeTool.prototype._measureLine = function (ctx, txt, letter) {
    txt = String(txt || '');
    if (!txt) return 0;
    if (Math.abs(letter || 0) < 0.001) return ctx.measureText(txt).width;
    let w = 0;
    for (let i = 0; i < txt.length; i += 1) { w += ctx.measureText(txt[i]).width; if (i < txt.length - 1) w += letter; }
    return w;
  };

  TypeTool.prototype._metrics = function (l) {
    const mc = this.measureCtx; if (!mc || !l) return null;
    mc.font = this._font(l);
    const lines = this._normText(l).split(/\r?\n/);
    const letter = n(l.letterSpacing, 0);
    const widths = lines.map((line) => this._measureLine(mc, line, letter));
    const maxW = widths.length ? Math.max.apply(null, widths) : 0;
    const size = Math.max(1, n(l.fontSize, 40));
    const step = Math.max(1, size * clamp(l.lineHeight, 0.6, 4));
    const totalH = Math.max(size, size + ((lines.length - 1) * step));
    const offs = widths.map((w) => (l.align === 'center' ? -w / 2 : (l.align === 'right' ? -w : 0)));
    let xMin = 0, xMax = 0;
    for (let i = 0; i < widths.length; i += 1) {
      const a = offs[i], b = a + widths[i];
      if (i === 0 || a < xMin) xMin = a;
      if (i === 0 || b > xMax) xMax = b;
    }
    const warpAmp = size * (clamp(l.warpArc, -100, 100) / 100) * 0.55;
    const margin = Math.max(5, (l.strokeEnabled ? n(l.strokeWidth, 0) : 0) + 3, (l.glowEnabled ? n(l.glowBlur, 0) : 0) + 4, (l.shadowEnabled ? (Math.abs(n(l.shadowOffsetX, 0)) + Math.abs(n(l.shadowOffsetY, 0)) + n(l.shadowBlur, 0)) : 0) + 4, (l.bevelEnabled ? (n(l.bevelSize, 0) * 2) : 0) + 3, Math.abs(warpAmp) + 3);
    return { lines: lines, widths: widths, offs: offs, letter: letter, size: size, step: step, xMin: xMin, xMax: xMax, yMin: Math.min(0, warpAmp), yMax: totalH + Math.max(0, warpAmp), warpAmp: warpAmp, margin: margin };
  };

  TypeTool.prototype._drawLine = function (ctx, txt, x, y, letter, mode, lineWidth, warpAmp) {
    const method = mode === 'stroke' ? 'strokeText' : 'fillText';
    txt = String(txt || ''); if (!txt) return;
    if (Math.abs(letter) < 0.001 && Math.abs(warpAmp) < 0.001) return ctx[method](txt, x, y);
    let cx = x; const tw = Math.max(1, lineWidth || 1);
    for (let i = 0; i < txt.length; i += 1) {
      const ch = txt[i]; const cw = ctx.measureText(ch).width;
      const t = (((cx - x) + (cw * 0.5)) / tw) - 0.5;
      const wy = Math.abs(warpAmp) > 0.001 ? Math.sin(t * Math.PI) * warpAmp : 0;
      ctx[method](ch, cx, y + wy);
      cx += cw + (i < txt.length - 1 ? letter : 0);
    }
  };

  TypeTool.prototype._applyTransform = function (ctx, l, sxStage, syStage, ax, ay) {
    const rot = (n(l.rotation, 0) * Math.PI) / 180;
    const skew = Math.tan((n(l.skewX, 0) * Math.PI) / 180);
    ctx.translate(ax, ay);
    if (Math.abs(rot) > 0.0001) ctx.rotate(rot);
    if (Math.abs(skew) > 0.0001) ctx.transform(1, 0, skew, 1, 0, 0);
    ctx.scale(sxStage * clamp(l.scaleX, 0.1, 4), syStage * clamp(l.scaleY, 0.1, 4));
  };

  TypeTool.prototype._drawPass = function (ctx, l, m, mode, color, alpha) {
    ctx.save();
    ctx.font = this._font(l);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.globalAlpha = clamp(alpha, 0, 1);
    if (mode === 'stroke') {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.01, n(l.strokeWidth, 1));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 3;
    } else {
      ctx.fillStyle = color;
    }
    for (let i = 0; i < m.lines.length; i += 1) {
      this._drawLine(ctx, m.lines[i], m.offs[i], i * m.step, m.letter, mode, m.widths[i], m.warpAmp);
    }
    ctx.restore();
  };

  TypeTool.prototype.render = function (ctx) {
    if (!ctx || !this.layers.length) return;
    const img = this._img(), r = this._rect();
    if (!img || !r || r.width <= 0 || r.height <= 0) return;
    const sxStage = r.width / img.width, syStage = r.height / img.height;
    for (let i = 0; i < this.layers.length; i += 1) {
      const l = this.layers[i];
      if (!l || !l.visible) continue;
      const m = this._metrics(l); if (!m) continue;
      const ax = r.x + (n(l.x, 0) * sxStage), ay = r.y + (n(l.y, 0) * syStage);
      ctx.save();
      ctx.globalCompositeOperation = String(l.blendMode || 'source-over');
      this._applyTransform(ctx, l, sxStage, syStage, ax, ay);

      if (l.shadowEnabled) {
        ctx.save();
        ctx.translate(n(l.shadowOffsetX, 0), n(l.shadowOffsetY, 0));
        if (n(l.shadowBlur, 0) > 0) ctx.filter = 'blur(' + clamp(l.shadowBlur, 0, 80) + 'px)';
        this._drawPass(ctx, l, m, 'fill', rgba(l.shadowColor, clamp(l.shadowOpacity, 0, 1), [0, 0, 0]), clamp(l.opacity, 0, 1));
        ctx.filter = 'none';
        ctx.restore();
      }
      if (l.glowEnabled) {
        ctx.save();
        if (n(l.glowBlur, 0) > 0) ctx.filter = 'blur(' + clamp(l.glowBlur, 0, 80) + 'px)';
        this._drawPass(ctx, l, m, 'fill', rgba(l.glowColor, clamp(l.glowOpacity, 0, 1), [103, 167, 255]), clamp(l.opacity, 0, 1));
        ctx.filter = 'none';
        ctx.restore();
      }
      if (l.bevelEnabled && n(l.bevelSize, 0) > 0) {
        const bs = clamp(l.bevelSize, 0, 20), k = clamp(l.bevelStrength, 0, 1);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(-bs, -bs);
        this._drawPass(ctx, l, m, 'fill', rgba(l.bevelHighlightColor, clamp(l.bevelHighlightOpacity, 0, 1), [255, 255, 255]), clamp(l.opacity, 0, 1) * k);
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.translate(bs, bs);
        this._drawPass(ctx, l, m, 'fill', rgba(l.bevelShadowColor, clamp(l.bevelShadowOpacity, 0, 1), [0, 0, 0]), clamp(l.opacity, 0, 1) * k);
        ctx.restore();
      }
      if (l.strokeEnabled && n(l.strokeWidth, 0) > 0) this._drawPass(ctx, l, m, 'stroke', rgba(l.strokeColor, 1, [10, 10, 15]), clamp(l.opacity, 0, 1));
      this._drawPass(ctx, l, m, 'fill', rgba(l.fillColor, clamp(l.fillOpacity, 0, 1), [248, 251, 255]), clamp(l.opacity, 0, 1));
      ctx.restore();

      if (this.toolActive && l.id === this.selectedId) this._drawSelection(ctx, l, m, r, sxStage, syStage);
    }
  };

  TypeTool.prototype._drawSelection = function (ctx, l, m, r, sxStage, syStage) {
    const ax = r.x + (n(l.x, 0) * sxStage), ay = r.y + (n(l.y, 0) * syStage);
    const x = m.xMin - m.margin, y = m.yMin - m.margin, w = (m.xMax - m.xMin) + (m.margin * 2), h = (m.yMax - m.yMin) + (m.margin * 2);
    const hs = 4 / Math.max(sxStage, 0.01);
    ctx.save();
    this._applyTransform(ctx, l, sxStage, syStage, ax, ay);
    ctx.lineWidth = Math.max(1 / Math.max(sxStage, 0.01), 1);
    ctx.strokeStyle = 'rgba(133,184,255,.96)';
    ctx.setLineDash([6 / Math.max(sxStage, 0.01), 4 / Math.max(sxStage, 0.01)]);
    ctx.strokeRect(x, y, Math.max(.5, w), Math.max(.5, h));
    ctx.setLineDash([]);
    [[x,y],[x+w/2,y],[x+w,y],[x,y+h/2],[x+w,y+h/2],[x,y+h],[x+w/2,y+h],[x+w,y+h]].forEach(function (p) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(9,12,18,.95)';
      ctx.beginPath(); ctx.rect(p[0]-hs,p[1]-hs,hs*2,hs*2); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  };

  TypeTool.prototype._localToImage = function (l, x, y) {
    let px = x * clamp(l.scaleX, 0.1, 4), py = y * clamp(l.scaleY, 0.1, 4);
    px = px + (Math.tan((n(l.skewX, 0) * Math.PI) / 180) * py);
    const rot = (n(l.rotation, 0) * Math.PI) / 180;
    if (Math.abs(rot) > 0.000001) {
      const c = Math.cos(rot), s = Math.sin(rot), tx = (px * c) - (py * s), ty = (px * s) + (py * c);
      px = tx; py = ty;
    }
    return { x: n(l.x, 0) + px, y: n(l.y, 0) + py };
  };

  TypeTool.prototype._imageToLocal = function (l, x, y) {
    let px = n(x, 0) - n(l.x, 0), py = n(y, 0) - n(l.y, 0);
    const rot = (n(l.rotation, 0) * Math.PI) / 180;
    if (Math.abs(rot) > 0.000001) {
      const c = Math.cos(-rot), s = Math.sin(-rot), tx = (px * c) - (py * s), ty = (px * s) + (py * c);
      px = tx; py = ty;
    }
    px = px - (Math.tan((n(l.skewX, 0) * Math.PI) / 180) * py);
    return { x: px / clamp(l.scaleX, 0.1, 4), y: py / clamp(l.scaleY, 0.1, 4) };
  };

  TypeTool.prototype._hit = function (imgPt) {
    for (let i = this.layers.length - 1; i >= 0; i -= 1) {
      const l = this.layers[i]; if (!l || !l.visible) continue;
      const m = this._metrics(l); if (!m) continue;
      const p = this._imageToLocal(l, imgPt.x, imgPt.y);
      if (p.x >= (m.xMin - m.margin) && p.x <= (m.xMax + m.margin) && p.y >= (m.yMin - m.margin) && p.y <= (m.yMax + m.margin)) return { layer: l, metrics: m };
    }
    return null;
  };

  TypeTool.prototype.handlePointerDown = function (canvasPt, evt) {
    if (!this.toolActive) return { handled: false };
    const img = this._img(); if (!img) return { handled: false };
    const p = canvasPt ? this._map(canvasPt.x, canvasPt.y, true) : null;
    if (!p) return { handled: false };
    const hit = this._hit(p);
    let l = hit && hit.layer;
    if (!l) {
      l = defaultLayer(p.x, p.y, 'New Text');
      this.layers.push(l);
      this.selectedId = l.id;
      this._hist('Add text layer');
      this._status('Text layer created. Use the right Type panel for font and effects.', 'success');
    } else {
      this.selectedId = l.id;
      this._status('Text layer selected. Drag to move, edit style on the right.', 'success');
    }
    this.drag = { active: true, layerId: l.id, offsetX: p.x - n(l.x, 0), offsetY: p.y - n(l.y, 0), moved: false, pointerId: evt && evt.pointerId };
    this.refreshPanel(); this._render(); this._dirty();
    return { handled: true, startDrag: true };
  };

  TypeTool.prototype.startMoveFromCanvas = function (canvasPt, evt) {
    const img = this._img(); if (!img) return { handled: false };
    const p = canvasPt ? this._map(canvasPt.x, canvasPt.y, true) : null;
    if (!p) return { handled: false };
    const hit = this._hit(p);
    if (!hit || !hit.layer) return { handled: false };
    const l = hit.layer;
    this.selectedId = l.id;
    this.drag = { active: true, layerId: l.id, offsetX: p.x - n(l.x, 0), offsetY: p.y - n(l.y, 0), moved: false, pointerId: evt && evt.pointerId };
    this.refreshPanel(false);
    this._render();
    this._status('Text layer selected. Drag to move.', 'success');
    return { handled: true, startDrag: true };
  };

  TypeTool.prototype.handlePointerMove = function (canvasPt) {
    if (!this.drag.active) return false;
    const l = this.layers.find((x) => x.id === this.drag.layerId); if (!l) return false;
    const p = canvasPt ? this._map(canvasPt.x, canvasPt.y, true) : null; if (!p) return false;
    const nx = p.x - this.drag.offsetX, ny = p.y - this.drag.offsetY;
    const dx = nx - n(l.x, 0), dy = ny - n(l.y, 0);
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return false;
    l.x = nx; l.y = ny; if (!this.drag.moved && (Math.abs(dx) + Math.abs(dy)) > 0.25) this.drag.moved = true;
    this._dirty(); this._render();
    return true;
  };

  TypeTool.prototype.handlePointerUp = function () {
    if (!this.drag.active) return false;
    const moved = !!this.drag.moved;
    this.cancelDrag();
    if (moved) { this._hist('Move text layer'); this._status('Text layer moved.', 'success'); }
    return moved;
  };

  TypeTool.prototype.cancelDrag = function () { this.drag = { active: false, layerId: null, offsetX: 0, offsetY: 0, moved: false, pointerId: null }; };

  TypeTool.prototype.handleDoubleClick = function (canvasPt) {
    if (!this.toolActive) return false;
    const p = canvasPt ? this._map(canvasPt.x, canvasPt.y, true) : null; if (!p) return false;
    const hit = this._hit(p); if (!hit) return false;
    this.selectedId = hit.layer.id; this.refreshPanel(); this._render();
    if (this.els.inputs.text) { this.els.inputs.text.focus(); this.els.inputs.text.select(); }
    this._status('Editing text content.', 'success');
    return true;
  };

  TypeTool.prototype.handleKeyDown = function (event) {
    if (!this.toolActive) return false;
    const key = String(event.key || '').toLowerCase();
    const activeEl = document.activeElement;
    const tag = activeEl && activeEl.tagName ? String(activeEl.tagName).toUpperCase() : '';
    const typing = !!(activeEl && (activeEl.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'));
    const l = this._sel();
    if (key === 'enter' && !typing && this.els.inputs.text) { event.preventDefault(); this.els.inputs.text.focus(); this.els.inputs.text.select(); return true; }
    if (!l) return false;
    if ((key === 'backspace' || key === 'delete') && !typing) { event.preventDefault(); this.removeSelected(); return true; }
    if (!typing && ['arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
      const s = event.shiftKey ? 10 : 1; event.preventDefault();
      if (key === 'arrowup') l.y -= s; if (key === 'arrowdown') l.y += s; if (key === 'arrowleft') l.x -= s; if (key === 'arrowright') l.x += s;
      this._dirty(); this._render(); this._status('Text nudged (' + s + 'px).', 'success'); return true;
    }
    if (!typing && (key === '[' || key === ']')) {
      event.preventDefault(); l.fontSize = clamp(n(l.fontSize, 32) + (key === ']' ? 2 : -2), 6, 500);
      this.refreshPanel(false); this._dirty(); this._render(); this._status('Font size: ' + Math.round(l.fontSize) + 'px', 'success'); return true;
    }
    return false;
  };

  TypeTool.prototype.getLayerBoundsImage = function (l) {
    const m = this._metrics(l); if (!m) return null;
    const x = m.xMin - m.margin, y = m.yMin - m.margin, w = (m.xMax - m.xMin) + (m.margin * 2), h = (m.yMax - m.yMin) + (m.margin * 2);
    const pts = [this._localToImage(l, x, y), this._localToImage(l, x + w, y), this._localToImage(l, x + w, y + h), this._localToImage(l, x, y + h)];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) { if (!p) return; if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; });
    return Number.isFinite(minX) ? { x1: minX, y1: minY, x2: maxX, y2: maxY } : null;
  };

  TypeTool.prototype.onCropApplied = function (crop) {
    if (!crop || !this.layers.length) return;
    const x1 = n(crop.srcX, 0), y1 = n(crop.srcY, 0), x2 = x1 + Math.max(1, n(crop.srcW, 1)), y2 = y1 + Math.max(1, n(crop.srcH, 1));
    this.layers = this.layers.filter((l) => {
      const b = this.getLayerBoundsImage(l);
      if (!b) return false;
      const hit = !(b.x2 < x1 || b.y2 < y1 || b.x1 > x2 || b.y1 > y2);
      if (hit) { l.x -= x1; l.y -= y1; }
      return hit;
    });
    if (!this.layers.some((l) => l.id === this.selectedId)) this.selectedId = this.layers.length ? this.layers[this.layers.length - 1].id : null;
    this.refreshPanel(); this._render();
  };

  window.OmxTypeTool = {
    create: function (host) {
      try { return new TypeTool(host); }
      catch (e) { console.error('[ImageEditor][TypeTool] init failed:', e); return null; }
    }
  };
})();
