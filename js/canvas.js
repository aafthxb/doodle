/* ═══════════════════════════════════════════════
   canvas.js  —  Drawing engine
   ═══════════════════════════════════════════════ */

let drawCanvas   = null;
let drawCtx      = null;
let isPainting   = false;
let currentColor = '#E77E64';
let currentSize  = 8;
let isEraser     = false;

// Stroke-based history for proper undo/redo
let strokes      = [];
let currentStroke= [];
let redoStack    = [];

/* ── Init (called every time draw screen is entered) ── */
function initCanvas() {
  drawCanvas = document.getElementById('draw-canvas');
  drawCtx    = drawCanvas.getContext('2d');

  // High-DPI sizing
  resizeCanvas();

  // Attach pointer events
  if (!drawCanvas._hasPointerListeners) {
    drawCanvas._hasPointerListeners = true;
    drawCanvas.addEventListener('pointerdown', onPointerDown);
    drawCanvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup',       onPointerUp);
    window.addEventListener('pointercancel',   onPointerCancel);
  }

  if (!window._hasResizeListener) {
    window._hasResizeListener = true;
    window.addEventListener('resize', () => { resizeCanvas(); redraw(); });
  }
}

function resizeCanvas() {
  const card = document.getElementById('canvasCard');
  if (!card || !drawCanvas) return;
  const rect = drawCanvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  drawCanvas.width  = rect.width  * dpr;
  drawCanvas.height = rect.height * dpr;
  drawCtx.scale(dpr, dpr);
}

/* ── Coordinate helper ── */
function getPointerPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

/* ── Pointer event handlers (works for touch, mouse, stylus) ── */
function onPointerDown(e) {
  // Only capture primary button (or touch)
  if (e.button !== undefined && e.button !== 0) return;

  isPainting = true;
  redoStack  = [];

  const pos = getPointerPos(e);
  currentStroke = [makePoint(pos)];

  // Draw initial dot
  drawCtx.beginPath();
  drawCtx.arc(pos.x, pos.y, currentSize / 2, 0, Math.PI * 2);
  drawCtx.fillStyle = isEraser ? '#ffffff' : currentColor;
  drawCtx.fill();
}

function onPointerMove(e) {
  if (!isPainting) return;
  const pos = getPointerPos(e);
  currentStroke.push(makePoint(pos));
  renderTail(currentStroke);
}

function onPointerUp(e) {
  if (!isPainting) return;
  isPainting = false;

  if (currentStroke.length > 0) {
    strokes.push(currentStroke);
    currentStroke = [];
  }
}

function onPointerCancel(e) {
  onPointerUp(e);
}

function makePoint(pos) {
  return { x: pos.x, y: pos.y, color: isEraser ? '#ffffff' : currentColor, size: currentSize, eraser: isEraser };
}

function renderTail(pts) {
  if (pts.length < 2) return;
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  drawCtx.beginPath();
  drawCtx.moveTo(a.x, a.y);
  drawCtx.lineTo(b.x, b.y);
  drawCtx.strokeStyle = b.color;
  drawCtx.lineWidth   = b.size;
  drawCtx.lineCap     = 'round';
  drawCtx.lineJoin    = 'round';
  drawCtx.stroke();
}

function redraw() {
  if (!drawCtx || !drawCanvas) return;
  const w = drawCanvas.width  / (window.devicePixelRatio || 1);
  const h = drawCanvas.height / (window.devicePixelRatio || 1);
  drawCtx.clearRect(0, 0, w, h);
  for (const strk of strokes) {
    if (strk.length < 2) continue;
    for (let i = 1; i < strk.length; i++) {
      drawCtx.beginPath();
      drawCtx.moveTo(strk[i-1].x, strk[i-1].y);
      drawCtx.lineTo(strk[i].x,   strk[i].y);
      drawCtx.strokeStyle = strk[i].color;
      drawCtx.lineWidth   = strk[i].size;
      drawCtx.lineCap     = 'round';
      drawCtx.lineJoin    = 'round';
      drawCtx.stroke();
    }
  }
}

/* ── Controls ── */
function clearCanvas() {
  strokes = []; redoStack = []; currentStroke = [];
  if (drawCtx && drawCanvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = drawCanvas.width  / dpr;
    const h = drawCanvas.height / dpr;
    drawCtx.clearRect(0, 0, w, h);
  }
  const btn = document.getElementById('btn-clear');
  if (btn) btn.blur();
}

function undo() {
  if (strokes.length === 0) return;
  redoStack.push(strokes.pop());
  redraw();
}

function redo() {
  if (redoStack.length === 0) return;
  strokes.push(redoStack.pop());
  redraw();
}

function setTool(tool) {
  isEraser = (tool === 'eraser');
  const pen    = document.getElementById('tool-pen');
  const eraser = document.getElementById('tool-eraser');
  if (pen)    pen.classList.toggle('active',    !isEraser);
  if (eraser) eraser.classList.toggle('active',  isEraser);
  if (drawCanvas) drawCanvas.style.cursor = isEraser ? 'cell' : 'crosshair';
}

function setSize(btn, px) {
  currentSize = px;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setColor(el) {
  currentColor = el.dataset.color;
  document.getElementById('active-color-name').textContent = el.dataset.name;
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.remove('selected');
    s.innerHTML = '';
  });
  el.classList.add('selected');
  el.innerHTML = '<span class="msi" style="color:white;font-size:16px">check</span>';
  if (isEraser) setTool('pen');
}

/* ── Export canvas thumbnail to result screen ── */
function copyToResultCanvas() {
  const rc  = document.getElementById('result-canvas');
  const rctx = rc.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  rc.width  = 160 * dpr;
  rc.height = 160 * dpr;
  rctx.scale(dpr, dpr);
  rctx.fillStyle = '#ffffff';
  rctx.fillRect(0, 0, 160, 160);
  const pad = 12;
  rctx.drawImage(drawCanvas, 0, 0,
    drawCanvas.width, drawCanvas.height,
    pad, pad, 160 - pad*2, 160 - pad*2
  );
}

/* ── Check if canvas has content ── */
function canvasHasContent() {
  if (strokes && strokes.length > 0) return true;
  if (!drawCanvas || !drawCtx) return false;
  // If no strokes recorded, fast-check downscaled sample
  return false;
}
