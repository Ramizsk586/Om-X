


// Removed top-level import to prevent crash if network is unavailable or module fails to load.
// import { GoogleGenAI } from "@google/genai";

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('canvas-container');

  // UI Elements
  const btnUndo = document.getElementById('btn-undo');
  const btnCopy = document.getElementById('btn-copy');
  const btnSave = document.getElementById('btn-save');
  const btnImport = document.getElementById('btn-import');
  const toolBtns = document.querySelectorAll('.tool-btn');
  
  // Context Panels
  const brushSettings = document.getElementById('brush-settings');
  const selectionSettings = document.getElementById('selection-settings');
  const cropSettings = document.getElementById('crop-settings');
  
  // Tool Controls
  const brushSizeInput = document.getElementById('brush-size');
  const brushSizeVal = document.getElementById('brush-size-val');
  const brushColorInput = document.getElementById('brush-color');
  const btnApplyCrop = document.getElementById('btn-apply-crop');
  
  // Selection Actions
  const btnSelBlur = document.getElementById('btn-sel-blur');
  const btnSelMagicErase = document.getElementById('btn-sel-magic-erase');
  const btnSelRemove = document.getElementById('btn-sel-remove');
  
  // AI Controls
  const btnAiRemoveBg = document.getElementById('btn-ai-remove-bg');
  const aiStatus = document.getElementById('ai-status');

  // Filters
  const filterSliders = document.querySelectorAll('.filter-slider');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const btnRotate = document.getElementById('btn-rotate');

  // State
  const state = {
    // We now use an editable canvas layer instead of the raw Image object for the base layer
    // This allows pixel manipulation (erasing) on the background image.
    baseLayer: document.createElement('canvas'),
    baseCtx: null,
    
    // Layers
    drawingCanvas: document.createElement('canvas'),
    drawingCtx: null,

    history: [],

    // Tools
    tool: 'cursor', // 'cursor', 'brush', 'crop', 'select', 'lasso'
    brush: { size: 5, color: '#ff0000', isDrawing: false, lastPos: null },
    
    // Selection state (Shared for Crop and Select)
    selection: { active: false, start: null, current: null }, 
    
    // Lasso state
    lasso: { active: false, points: [] },

    // Image Adjustments
    filters: {
      brightness: 100,
      contrast: 100,
      grayscale: 0,
      blur: 0
    }
  };

  state.drawingCtx = state.drawingCanvas.getContext('2d');
  state.baseCtx = state.baseLayer.getContext('2d');

  // --- API Setup ---
  let GoogleGenAI = null;
  let aiConfig = { apiKey: '', provider: 'google' };

  // Load Module
  try {
     const module = await import("@google/genai");
     GoogleGenAI = module.GoogleGenAI;
  } catch (e) {
     console.warn("AI Module failed to load. AI features will be disabled.", e);
  }

  // Helper to load config
  async function loadAIConfig() {
      try {
          const settings = await window.browserAPI.settings.get();
          if (settings) {
              const active = settings.activeProvider || 'google';
              const pConfig = settings.providers?.[active];
              aiConfig.provider = active;
              aiConfig.apiKey = pConfig?.key || window.env?.API_KEY || '';
          } else {
              aiConfig.apiKey = window.env?.API_KEY || '';
          }
      } catch(e) {
          aiConfig.apiKey = window.env?.API_KEY || '';
      }
  }

  // Initial load
  await loadAIConfig();

  // --- Initialization ---

  function loadImage(src) {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      // Clean start
      state.history = [];
      state.drawingCtx.clearRect(0,0,state.drawingCanvas.width, state.drawingCanvas.height);
      resetFiltersUI();
      resizeCanvas(img.width, img.height);
      
      // Draw image to base layer canvas
      state.baseCtx.clearRect(0, 0, img.width, img.height);
      state.baseCtx.drawImage(img, 0, 0);
      
      render();
    };
    img.src = src;
  }
  
  if (window.editorAPI && window.editorAPI.onImage) {
    window.editorAPI.onImage((dataUrl) => {
      loadImage(dataUrl);
    });
  }

  // Fallback check if nothing loaded after brief delay
  setTimeout(() => {
    if (state.baseLayer.width === 0 || state.baseLayer.width === 300) { // Default 300 on empty canvas
       // Initial empty state
       resizeCanvas(container.clientWidth, container.clientHeight);
       render();
    }
  }, 500);

  function saveStateToHistory() {
    if (state.history.length > 10) state.history.shift(); 
    // Save the entire composited view as a restoration point
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tctx = temp.getContext('2d');
    
    // Draw current composition
    const f = state.filters;
    tctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) grayscale(${f.grayscale}%) blur(${f.blur}px)`;
    tctx.drawImage(state.baseLayer, 0, 0);
    tctx.filter = 'none';
    tctx.drawImage(state.drawingCanvas, 0, 0);
    
    state.history.push(temp.toDataURL());
  }

  function restoreStateFromHistory() {
    if (state.history.length === 0) return;
    const previous = state.history.pop();
    const img = new Image();
    img.onload = () => {
      // Upon restore, we flatten everything to the base layer
      resizeCanvas(img.width, img.height);
      state.baseCtx.clearRect(0, 0, img.width, img.height);
      state.baseCtx.drawImage(img, 0, 0);
      
      state.drawingCtx.clearRect(0, 0, state.drawingCanvas.width, state.drawingCanvas.height);
      resetFiltersUI();
      render();
    };
    img.src = previous;
  }

  function resizeCanvas(w, h) {
    canvas.width = w;
    canvas.height = h;
    state.drawingCanvas.width = w;
    state.drawingCanvas.height = h;
    state.baseLayer.width = w;
    state.baseLayer.height = h;
  }

  // --- Rendering ---

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fallback if no image content (check dimensions or pixel data presence?)
    if (state.baseLayer.width === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Drop image or click Import', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Base Image with Filters
    ctx.save();
    const f = state.filters;
    ctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) grayscale(${f.grayscale}%) blur(${f.blur}px)`;
    ctx.drawImage(state.baseLayer, 0, 0);
    ctx.restore();

    // Drawings
    ctx.drawImage(state.drawingCanvas, 0, 0);

    // Overlay (Crop, Select, Lasso)
    if (state.tool === 'lasso' && state.lasso.points.length > 0) {
        drawLassoOverlay();
    } else if ((state.tool === 'crop' || state.tool === 'select') && state.selection.start && state.selection.current) {
        drawSelectionOverlay(state.tool === 'crop');
    }
  }

  function drawLassoOverlay() {
      ctx.save();
      ctx.strokeStyle = '#7c4dff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      
      const pts = state.lasso.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i=1; i<pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
      }
      
      // Close loop visually if needed
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(124, 77, 255, 0.1)';
      ctx.fill();
      
      ctx.restore();
  }

  function drawSelectionOverlay(isCrop) {
    const start = state.selection.start;
    const curr = state.selection.current;
    
    const x = Math.min(start.x, curr.x);
    const y = Math.min(start.y, curr.y);
    const w = Math.abs(curr.x - start.x);
    const h = Math.abs(curr.y - start.y);

    ctx.save();
    
    if (isCrop) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, y); 
        ctx.fillRect(0, y + h, canvas.width, canvas.height - (y + h));
        ctx.fillRect(0, y, x, h);
        ctx.fillRect(x + w, y, canvas.width - (x + w), h);
        ctx.strokeStyle = '#fff';
    } else {
        ctx.fillStyle = 'rgba(124, 77, 255, 0.1)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#7c4dff';
    }
    
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  // --- Tool Interactions ---

  canvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasCoordinates(e);

    if (state.tool === 'brush') {
      state.brush.isDrawing = true;
      state.brush.lastPos = pos;
      saveStateToHistory(); 
      state.drawingCtx.fillStyle = state.brush.color;
      state.drawingCtx.beginPath();
      state.drawingCtx.arc(pos.x, pos.y, state.brush.size / 2, 0, Math.PI * 2);
      state.drawingCtx.fill();
      render();
    } else if (state.tool === 'crop' || state.tool === 'select') {
      state.selection.active = true;
      state.selection.start = pos;
      state.selection.current = pos;
      render();
    } else if (state.tool === 'lasso') {
      state.lasso.active = true;
      state.lasso.points = [pos];
      render();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const pos = getCanvasCoordinates(e);

    if (state.tool === 'brush' && state.brush.isDrawing) {
      const last = state.brush.lastPos;
      state.drawingCtx.beginPath();
      state.drawingCtx.moveTo(last.x, last.y);
      state.drawingCtx.lineTo(pos.x, pos.y);
      state.drawingCtx.strokeStyle = state.brush.color;
      state.drawingCtx.lineWidth = state.brush.size;
      state.drawingCtx.lineCap = 'round';
      state.drawingCtx.lineJoin = 'round';
      state.drawingCtx.stroke();
      state.brush.lastPos = pos;
      render();
    } else if ((state.tool === 'crop' || state.tool === 'select') && state.selection.active) {
      state.selection.current = pos;
      render();
    } else if (state.tool === 'lasso' && state.lasso.active) {
      state.lasso.points.push(pos);
      render();
    }
  });

  window.addEventListener('mouseup', () => {
    if (state.tool === 'brush') {
      state.brush.isDrawing = false;
    } else if (state.tool === 'crop' || state.tool === 'select') {
      state.selection.active = false;
      const hasSel = state.selection.start && state.selection.current;
      if (hasSel) {
          if (state.tool === 'crop') cropSettings.classList.remove('hidden');
          if (state.tool === 'select') selectionSettings.classList.remove('hidden');
      }
    } else if (state.tool === 'lasso') {
        if (state.lasso.active) {
            state.lasso.active = false;
            // Show selection tools for lasso too
            selectionSettings.classList.remove('hidden');
            render();
        }
    }
  });

  // --- Tool Switching ---

  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const toolId = btn.id;
      if (toolId === 'tool-cursor') state.tool = 'cursor';
      if (toolId === 'tool-brush') state.tool = 'brush';
      if (toolId === 'tool-crop') state.tool = 'crop';
      if (toolId === 'tool-select') state.tool = 'select';
      if (toolId === 'tool-lasso') state.tool = 'lasso';

      canvas.style.cursor = state.tool === 'brush' ? 'crosshair' : (state.tool === 'crop' || state.tool === 'select' || state.tool === 'lasso' ? 'cell' : 'default');

      brushSettings.classList.toggle('hidden', state.tool !== 'brush');
      cropSettings.classList.add('hidden');
      selectionSettings.classList.add('hidden');
      
      // Clear Selection if switching
      state.selection.start = null;
      state.lasso.points = [];
      render();
    });
  });

  // --- Actions ---

  // Helper: Get Clipping Path for Current Selection
  function createSelectionPath(ctx) {
      ctx.beginPath();
      if (state.tool === 'lasso' && state.lasso.points.length > 2) {
          const pts = state.lasso.points;
          ctx.moveTo(pts[0].x, pts[0].y);
          for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
      } else if (state.tool === 'select' && state.selection.start && state.selection.current) {
          const start = state.selection.start;
          const curr = state.selection.current;
          const x = Math.min(start.x, curr.x);
          const y = Math.min(start.y, curr.y);
          const w = Math.abs(curr.x - start.x);
          const h = Math.abs(curr.y - start.y);
          ctx.rect(x, y, w, h);
      }
  }

  // 1. REMOVE / CUT AREA
  btnSelRemove.addEventListener('click', () => {
      saveStateToHistory();
      
      state.baseCtx.save();
      createSelectionPath(state.baseCtx);
      state.baseCtx.clip();
      state.baseCtx.clearRect(0, 0, state.baseLayer.width, state.baseLayer.height);
      state.baseCtx.restore();
      
      render();
      selectionSettings.classList.add('hidden');
      state.selection.start = null;
      state.lasso.points = [];
  });

  // 2. BLUR AREA
  btnSelBlur.addEventListener('click', () => {
      saveStateToHistory();

      // Create a temp canvas for the blur operation
      const tempC = document.createElement('canvas');
      tempC.width = state.baseLayer.width;
      tempC.height = state.baseLayer.height;
      const tctx = tempC.getContext('2d');
      
      // Draw image
      tctx.drawImage(state.baseLayer, 0, 0);
      
      // Apply blur to everything in temp
      // Note: A more efficient way would be to blur only the bounding box, 
      // but this is simpler for arbitrary paths.
      const blurredC = document.createElement('canvas');
      blurredC.width = tempC.width;
      blurredC.height = tempC.height;
      const bctx = blurredC.getContext('2d');
      bctx.filter = 'blur(10px)';
      bctx.drawImage(tempC, 0, 0);
      bctx.filter = 'none';
      
      // Now draw the blurred version ON TOP of the base layer, masked by selection
      state.baseCtx.save();
      createSelectionPath(state.baseCtx);
      state.baseCtx.clip();
      state.baseCtx.drawImage(blurredC, 0, 0);
      state.baseCtx.restore();

      render();
      selectionSettings.classList.add('hidden');
      state.selection.start = null;
      state.lasso.points = [];
  });

  // 3. AI REMOVE BACKGROUND
  btnAiRemoveBg.addEventListener('click', async () => {
     await loadAIConfig();
     
     if (!GoogleGenAI || !aiConfig.apiKey) {
         alert("API Key not found or AI module failed to load.");
         return;
     }
     
     if (aiConfig.provider !== 'google') {
        alert("Image editing currently requires Google Gemini provider. Please switch in System settings.");
        return;
     }
     
     saveStateToHistory();
     aiStatus.classList.remove('hidden');
     btnAiRemoveBg.disabled = true;

     try {
         // Create a composite of base layer + filters + drawings to send to AI
         const temp = document.createElement('canvas');
         temp.width = canvas.width;
         temp.height = canvas.height;
         const tctx = temp.getContext('2d');
         const f = state.filters;
         tctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) grayscale(${f.grayscale}%) blur(${f.blur}px)`;
         tctx.drawImage(state.baseLayer, 0, 0);
         tctx.filter = 'none';
         tctx.drawImage(state.drawingCanvas, 0, 0);
         
         const base64Data = temp.toDataURL('image/png').split(',')[1];
         const aiClient = new GoogleGenAI({ apiKey: aiConfig.apiKey });
         
         const response = await aiClient.models.generateContent({
             model: 'gemini-2.5-flash-image', 
             contents: {
                 parts: [
                     { inlineData: { mimeType: 'image/png', data: base64Data } },
                     { text: 'Remove the background from this image. Return the image with transparency.' }
                 ]
             }
         });
         
         let newImageData = null;
         if (response.candidates?.[0]?.content?.parts) {
             for (const part of response.candidates[0].content.parts) {
                 if (part.inlineData && part.inlineData.data) {
                     newImageData = part.inlineData.data;
                     break;
                 }
             }
         }

         if (newImageData) {
             const newImg = new Image();
             newImg.onload = () => {
                 resizeCanvas(newImg.width, newImg.height);
                 state.baseCtx.clearRect(0,0, newImg.width, newImg.height);
                 state.baseCtx.drawImage(newImg, 0, 0);
                 
                 state.drawingCtx.clearRect(0,0, canvas.width, canvas.height);
                 resetFiltersUI();
                 render();
                 aiStatus.classList.add('hidden');
                 btnAiRemoveBg.disabled = false;
             };
             newImg.src = `data:image/png;base64,${newImageData}`;
         } else {
             throw new Error("No image returned");
         }

     } catch (e) {
         console.error(e);
         aiStatus.textContent = "Error";
         setTimeout(() => {
             aiStatus.textContent = "Processing...";
             aiStatus.classList.add('hidden');
             btnAiRemoveBg.disabled = false;
         }, 2000);
     }
  });

  // 4. MAGIC ERASE
  btnSelMagicErase.addEventListener('click', async () => {
     if (state.tool === 'select' && (!state.selection.start || !state.selection.current)) return;
     if (state.tool === 'lasso' && state.lasso.points.length < 3) return;
     
     await loadAIConfig();
     if (!GoogleGenAI || !aiConfig.apiKey) {
         alert("API Key missing or AI module not loaded.");
         return;
     }
     if (aiConfig.provider !== 'google') {
        alert("Magic Erase currently requires Google Gemini provider.");
        return;
     }

     saveStateToHistory();
     
     btnSelMagicErase.textContent = "Erasing...";
     btnSelMagicErase.disabled = true;

     // Prepare composite image
     const tempC = document.createElement('canvas');
     tempC.width = canvas.width;
     tempC.height = canvas.height;
     const tctx = tempC.getContext('2d');
     tctx.drawImage(state.baseLayer, 0, 0);
     tctx.drawImage(state.drawingCanvas, 0, 0);
     
     // Draw selection mask on top in RED for the AI to identify
     tctx.fillStyle = '#FF0000';
     tctx.strokeStyle = '#FF0000';
     tctx.lineWidth = 2;
     
     createSelectionPath(tctx);
     tctx.fill();
     tctx.stroke();
     
     const base64Data = tempC.toDataURL('image/png').split(',')[1];

     try {
         const aiClient = new GoogleGenAI({ apiKey: aiConfig.apiKey });
         const response = await aiClient.models.generateContent({
             model: 'gemini-2.5-flash-image',
             contents: {
                 parts: [
                     { inlineData: { mimeType: 'image/png', data: base64Data } },
                     { text: 'Remove the object covered by the red area and fill in the background seamlessly. Do not include the red area in the output.' }
                 ]
             }
         });
         
         let newImageData = null;
         if (response.candidates?.[0]?.content?.parts) {
             for (const part of response.candidates[0].content.parts) {
                 if (part.inlineData) {
                     newImageData = part.inlineData.data;
                     break;
                 }
             }
         }

         if (newImageData) {
             const newImg = new Image();
             newImg.onload = () => {
                 state.baseCtx.clearRect(0,0, canvas.width, canvas.height);
                 state.baseCtx.drawImage(newImg, 0, 0);
                 
                 state.drawingCtx.clearRect(0,0, canvas.width, canvas.height);
                 resetFiltersUI();
                 state.selection.start = null;
                 state.lasso.points = [];
                 selectionSettings.classList.add('hidden');
                 render();
                 
                 btnSelMagicErase.textContent = "Magic Erase";
                 btnSelMagicErase.disabled = false;
                 btnSelMagicErase.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="margin-right:6px;"><path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l-1.4 2.5L13.2 14 15.6 15.4 17 18l1.4-2.6L20.8 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zM11 10c0-3.31 2.69-6 6-6s6 2.69 6 6-2.69 6-6 6-6-2.69-6-6z"/></svg>');
             };
             newImg.src = `data:image/png;base64,${newImageData}`;
         } else {
             throw new Error("Failed to generate image");
         }

     } catch (e) {
         console.error(e);
         btnSelMagicErase.textContent = "Failed";
         setTimeout(() => {
            btnSelMagicErase.disabled = false;
            btnSelMagicErase.textContent = "Magic Erase"; 
         }, 2000);
     }
  });


  // --- Helper: Crop Apply ---
  btnApplyCrop.addEventListener('click', () => {
    if (!state.selection.start || !state.selection.current) return;
    
    const start = state.selection.start;
    const curr = state.selection.current;
    const x = Math.min(start.x, curr.x);
    const y = Math.min(start.y, curr.y);
    const w = Math.abs(curr.x - start.x);
    const h = Math.abs(curr.y - start.y);

    if (w < 10 || h < 10) return;

    saveStateToHistory();

    const tempC = document.createElement('canvas');
    tempC.width = w;
    tempC.height = h;
    const tctx = tempC.getContext('2d');
    
    // Draw base layer cropped
    tctx.drawImage(state.baseLayer, x, y, w, h, 0, 0, w, h);
    
    // Draw drawing layer cropped
    tctx.drawImage(state.drawingCanvas, x, y, w, h, 0, 0, w, h);

    const newImg = new Image();
    newImg.onload = () => {
        resizeCanvas(w, h);
        state.baseCtx.clearRect(0,0,w,h);
        state.baseCtx.drawImage(newImg, 0, 0);
        state.drawingCtx.clearRect(0,0,w,h);
        
        resetFiltersUI(); 
        
        state.selection.start = null;
        cropSettings.classList.add('hidden');
        document.getElementById('tool-cursor').click();
    };
    newImg.src = tempC.toDataURL();
  });

  // --- Helpers ---
  function resetFiltersUI() {
    state.filters = { brightness: 100, contrast: 100, grayscale: 0, blur: 0 };
    filterSliders.forEach(s => {
      const f = s.dataset.filter;
      s.value = state.filters[f];
      const label = document.getElementById(`val-${f}`);
      if(label) label.textContent = state.filters[f] + (f === 'blur' ? 'px' : '%');
    });
  }

  // --- Basic Actions ---
  brushSizeInput.addEventListener('input', (e) => {
    state.brush.size = parseInt(e.target.value);
    brushSizeVal.textContent = state.brush.size + 'px';
  });
  brushColorInput.addEventListener('input', (e) => {
    state.brush.color = e.target.value;
  });

  filterSliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      state.filters[e.target.dataset.filter] = e.target.value;
      const label = document.getElementById(`val-${e.target.dataset.filter}`);
      if(label) label.textContent = e.target.value + (e.target.dataset.filter === 'blur' ? 'px' : '%');
      render();
    });
  });

  btnResetFilters.addEventListener('click', () => {
    resetFiltersUI();
    render();
  });

  btnRotate.addEventListener('click', () => {
     saveStateToHistory();
     const w = canvas.width;
     const h = canvas.height;
     const temp = document.createElement('canvas');
     temp.width = h;
     temp.height = w;
     const tctx = temp.getContext('2d');
     tctx.translate(h/2, w/2);
     tctx.rotate(90 * Math.PI / 180);
     tctx.drawImage(state.baseLayer, -w/2, -h/2);
     tctx.drawImage(state.drawingCanvas, -w/2, -h/2);

     const newImg = new Image();
     newImg.onload = () => {
         resizeCanvas(h, w);
         state.baseCtx.clearRect(0,0,h,w);
         state.baseCtx.drawImage(newImg, 0, 0);
         state.drawingCtx.clearRect(0,0,h,w);
         resetFiltersUI();
         render();
     };
     newImg.src = temp.toDataURL();
  });
  
  // Import
  if(btnImport) {
      btnImport.addEventListener('click', async () => {
          if (window.browserAPI && window.browserAPI.files) {
              const dataUrl = await window.browserAPI.files.openImage();
              if (dataUrl) loadImage(dataUrl);
          }
      });
  }

  btnUndo.addEventListener('click', restoreStateFromHistory);

  btnSave.addEventListener('click', () => {
     // Composite final image
     const temp = document.createElement('canvas');
     temp.width = canvas.width;
     temp.height = canvas.height;
     const tctx = temp.getContext('2d');
     
     const f = state.filters;
     tctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) grayscale(${f.grayscale}%) blur(${f.blur}px)`;
     tctx.drawImage(state.baseLayer, 0, 0);
     tctx.filter = 'none';
     tctx.drawImage(state.drawingCanvas, 0, 0);

     if(window.browserAPI && window.browserAPI.files) {
         window.browserAPI.files.saveImage(temp.toDataURL('image/png'), `omx-edit-${Date.now()}.png`);
     } else {
        const link = document.createElement('a');
        link.download = `omx-edit-${Date.now()}.png`;
        link.href = temp.toDataURL('image/png');
        link.click();
     }
  });

  btnCopy.addEventListener('click', () => {
     const temp = document.createElement('canvas');
     temp.width = canvas.width;
     temp.height = canvas.height;
     const tctx = temp.getContext('2d');
     
     const f = state.filters;
     tctx.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) grayscale(${f.grayscale}%) blur(${f.blur}px)`;
     tctx.drawImage(state.baseLayer, 0, 0);
     tctx.filter = 'none';
     tctx.drawImage(state.drawingCanvas, 0, 0);

    temp.toBlob(blob => {
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item]).then(() => {
        btnCopy.textContent = "Copied!";
        setTimeout(() => btnCopy.textContent = "Copy", 1000);
      });
    });
  });
});