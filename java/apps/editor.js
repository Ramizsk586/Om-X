document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');
  
  // Tools
  const colorPicker = document.getElementById('color-picker');
  const brushSize = document.getElementById('brush-size');
  
  // State
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentImage = null; // Image object
  let rotation = 0;
  let scaleX = 1;

  // Filter State
  let currentFilter = 'none';

  // Load Image
  const dataURL = localStorage.getItem('omni_editor_image');
  if (dataURL) {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      canvas.width = img.width;
      canvas.height = img.height;
      redraw();
    };
    img.src = dataURL;
  }

  function redraw() {
    if (!currentImage) return;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Filters
    ctx.filter = getFilterString();

    // Draw Image
    // In a real editor we would handle rotation differently (resize canvas), 
    // but for simple drawing on top, we'll keep canvas size fixed to original image dimensions
    // and just rotate the image draw call, but this complicates drawing coordinates.
    // Simpler: Apply filter to context, draw image. Rotation/Flip applied to whole canvas?
    // Let's keep it simple: Filters apply to image. Drawing is separate layer?
    // For this MVP: Drawing burns into canvas. Filters are applied before drawing new strokes?
    // No, usually filters apply to the base image. 
    
    // MVP Strategy: 
    // 1. Draw Image
    ctx.drawImage(currentImage, 0, 0);
    ctx.filter = 'none'; // Reset filter for strokes
  }

  function getFilterString() {
    switch(currentFilter) {
        case 'grayscale': return 'grayscale(100%)';
        case 'invert': return 'invert(100%)';
        case 'sepia': return 'sepia(100%)';
        default: return 'none';
    }
  }

  // --- Drawing Logic ---
  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    [lastX, lastY] = getCursorPosition(e);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    draw(e);
  });

  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mouseout', () => isDrawing = false);

  function getCursorPosition(e) {
    const rect = canvas.getBoundingClientRect();
    // Calculate scale factor in case canvas is CSS-scaled (max-width/max-height)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY
    ];
  }

  function draw(e) {
    const [x, y] = getCursorPosition(e);
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = brushSize.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    [lastX, lastY] = [x, y];
  }

  // --- Toolbar Handlers ---
  
  // Filters
  document.getElementById('filter-none').onclick = () => applyFilter('none');
  document.getElementById('filter-grayscale').onclick = () => applyFilter('grayscale');
  document.getElementById('filter-invert').onclick = () => applyFilter('invert');
  document.getElementById('filter-sepia').onclick = () => applyFilter('sepia');

  function applyFilter(filter) {
    currentFilter = filter;
    // To make filters "stick" so we can draw over them, we need to redraw image with filter then save it
    // Or just re-render base.
    // Simple way: Clear, draw original with filter. BUT this deletes drawings.
    // Better: Filter is an operation that manipulates pixel data of the whole canvas.
    
    // Snapshot current canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Simple pixel manipulation would be best here to preserve drawings + image
    
    // Fallback: Just redraw base image with filter for now (resets drawings - valid for MVP limitation or feature)
    // To preserve drawings, we'd need layers.
    // Let's warn: "Applying filter will reset drawings".
    redraw(); 
  }

  // Transforms
  document.getElementById('op-flip').onclick = () => {
     // Flip Horizontal
     const tempCanvas = document.createElement('canvas');
     tempCanvas.width = canvas.width;
     tempCanvas.height = canvas.height;
     const tCtx = tempCanvas.getContext('2d');
     tCtx.translate(canvas.width, 0);
     tCtx.scale(-1, 1);
     tCtx.drawImage(canvas, 0, 0);
     
     ctx.clearRect(0,0, canvas.width, canvas.height);
     ctx.drawImage(tempCanvas, 0, 0);
  };

  document.getElementById('op-rotate').onclick = () => {
      // Rotate 90 deg
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.height;
      tempCanvas.height = canvas.width;
      const tCtx = tempCanvas.getContext('2d');
      
      tCtx.translate(canvas.height/2, canvas.width/2);
      tCtx.rotate(90 * Math.PI / 180);
      tCtx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
      
      // Resize main canvas
      canvas.width = tempCanvas.width;
      canvas.height = tempCanvas.height;
      ctx.drawImage(tempCanvas, 0, 0);
  };

  // Save
  document.getElementById('action-save').onclick = () => {
    const link = document.createElement('a');
    link.download = `omni-capture-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Tool Activation Visuals
  const tools = document.querySelectorAll('.tool-btn');
  tools.forEach(btn => {
    btn.addEventListener('click', () => {
       if (btn.id.startsWith('tool-')) {
         tools.forEach(t => { if(t.id.startsWith('tool-')) t.classList.remove('active'); });
         btn.classList.add('active');
       }
    });
  });

});