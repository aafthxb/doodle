/* ═══════════════════════════════════════════════
   app.js  —  Navigation · Timer · Results
   ═══════════════════════════════════════════════ */

const SCREENS = ['home', 'draw', 'results'];

/* ─── Navigation ─── */
function navigate(to) {
  const fromEl = document.querySelector('.screen.active');
  const fromId = fromEl ? fromEl.id.replace('screen-', '') : 'home';
  const toEl   = document.getElementById('screen-' + to);
  if (!toEl || fromId === to) return;

  const fromIdx = SCREENS.indexOf(fromId);
  const toIdx   = SCREENS.indexOf(to);
  const dir     = toIdx >= fromIdx ? 'anim-right' : 'anim-left';

  // Hide current
  fromEl.classList.remove('active');
  fromEl.classList.remove('anim-right', 'anim-left');

  // Show next
  toEl.classList.add('active');
  toEl.classList.remove('anim-right', 'anim-left');
  void toEl.offsetWidth;            // force reflow
  toEl.classList.add(dir);

  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

  // lifecycle
  if (to === 'draw')    onEnterDraw();
  if (to === 'home')    onEnterHome();
  if (to === 'results') onEnterResults();
}

/* ─── Home ─── */
function onEnterHome() {
  stopTimer();
  const btn = document.getElementById('btn-start');
  if (btn) btn.blur();
}

/* ─── Draw screen ─── */
let timerInterval = null;
let timerSecs     = 105;

function onEnterDraw() {
  // reset tool state
  isEraser     = false;
  currentColor = '#E77E64';
  currentSize  = 8;

  // re-init canvas
  initCanvas();
  strokes = []; redoStack = [];

  // reset swatches to default
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.remove('selected');
    s.innerHTML = '';
  });
  const first = document.querySelector('.swatch[data-name="Warm Coral"]');
  if (first) {
    first.classList.add('selected');
    first.innerHTML = '<span class="msi" style="color:white;font-size:16px">check</span>';
  }
  const nameEl = document.getElementById('active-color-name');
  if (nameEl) nameEl.textContent = 'Warm Coral';

  // reset tools
  setTool('pen');
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  const defSize = document.querySelector('.size-btn[data-px="8"]');
  if (defSize) defSize.classList.add('active');

  // Ensure identify button reflects current model loading state
  updateIdentifyButtonState();

  startTimer();
}

function startTimer() {
  stopTimer();
  timerSecs = 105;
  renderTimer();
  timerInterval = setInterval(() => {
    timerSecs--;
    renderTimer();
    if (timerSecs <= 0) {
      stopTimer();
      if (typeof isModelReady === 'function' && isModelReady()) {
        identifyDrawing();
      }
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function renderTimer() {
  const m    = Math.floor(Math.max(0, timerSecs) / 60);
  const s    = Math.max(0, timerSecs) % 60;
  const txt  = `${m}:${s.toString().padStart(2,'0')}`;
  const el   = document.getElementById('timer-text');
  const chip = document.getElementById('timer-chip');
  if (el)   el.textContent = txt;
  if (chip) {
    chip.classList.remove('warning','danger');
    if (timerSecs <= 15)      chip.classList.add('danger');
    else if (timerSecs <= 30) chip.classList.add('warning');
  }
}

/* ─── Model State & Identify Button Control ─── */
function updateIdentifyButtonState() {
  const btn = document.getElementById('btn-identify');
  if (!btn) return;

  const state = (typeof modelState !== 'undefined') ? modelState : 'loading';

  if (state === 'ready') {
    btn.disabled = false;
    btn.classList.remove('is-disabled', 'is-retry');
    btn.onclick = identifyDrawing;
    btn.innerHTML = `
      <span class="msi" style="font-size:22px">auto_awesome</span>
      <span>Identify Drawing ✨</span>
    `;
  } else if (state === 'error') {
    btn.disabled = false;
    btn.classList.remove('is-disabled');
    btn.classList.add('is-retry');
    btn.onclick = retryModelLoad;
    btn.innerHTML = `
      <span class="msi" style="font-size:22px">refresh</span>
      <span>Model load failed · Retry ↺</span>
    `;
  } else {
    // 'idle' or 'loading'
    btn.disabled = true;
    btn.classList.remove('is-retry');
    btn.classList.add('is-disabled');
    btn.onclick = null;
    btn.innerHTML = `
      <span class="msi msi-spin" style="font-size:22px">progress_activity</span>
      <span>Preparing AI model…</span>
    `;
  }
}

function retryModelLoad(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (typeof loadModel === 'function') {
    loadModel().catch(err => {
      console.warn('[Doodle] Retry load failed:', err.message);
    });
  }
}

// Connect model state listener
if (typeof onModelStateChange === 'function') {
  onModelStateChange(() => {
    updateIdentifyButtonState();
  });
}

/* ─── Identify ─── */
async function identifyDrawing() {
  const btn = document.getElementById('btn-identify');
  if (btn && btn.disabled) return;
  if (typeof isModelReady === 'function' && !isModelReady()) {
    console.warn('[Doodle] Identify called before model was ready');
    return;
  }
  stopTimer();

  if (strokes.length === 0 && !canvasHasContent()) {
    // shake the canvas card
    const card = document.getElementById('canvasCard');
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.75';
    btn.style.transform = 'scale(0.98)';
  }

  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('hidden');

  try {
    // Allow browser one paint frame to display overlay
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 60)));

    const result = await runInference(drawCanvas);
    copyToResultCanvas();
    renderResults(result);
    overlay.classList.add('hidden');
    navigate('results');
  } catch (err) {
    console.error('[Doodle] Identify error:', err);
    overlay.classList.add('hidden');
    alert('Model error during inference. Please try again.');
  } finally {
    if (btn) {
      btn.style.opacity = '';
      btn.style.transform = '';
      updateIdentifyButtonState();
    }
  }
}

/* ─── Results screen ─── */
function onEnterResults() { /* rendering done before navigate */ }

function renderResults({ top, predictions, explanation, isDemo }) {
  const pct   = Math.round(top.prob * 100);
  const emoji = CLASS_EMOJI[top.label] || '🎨';

  // Match chip
  document.getElementById('result-match-pct').textContent = `${pct}% Match`;

  // Name
  document.getElementById('result-name').textContent =
    capitalize(top.label) + ' ' + emoji;

  // Explanation (flag demo mode)
  document.getElementById('result-explanation').textContent = isDemo
    ? `[Demo mode — add doodlio_model.onnx to /models/ for live inference] ${explanation}`
    : explanation;

  // Bars
  const container = document.getElementById('pred-bars');
  container.innerHTML = '';

  predictions.forEach(({ label, prob }, i) => {
    const p    = Math.round(prob * 100);
    const icon = CLASS_ICON[label] || 'category';
    const rank = i + 1;

    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <div class="bar-meta">
        <span class="bar-label ${rank===1?'secondary':'on-surface'}">
          <span class="msi ${rank===1?'primary':'on-surface-variant'}" style="font-size:16px">${icon}</span>
          ${capitalize(label)}
        </span>
        <span class="bar-pct-${rank}">${p}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill bar-fill-${rank}" style="width:0%" data-w="${p}"></div>
      </div>
    `;
    container.appendChild(row);
  });

  // animate bars on next frame
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.bar-fill').forEach(b => {
      b.style.width = b.dataset.w + '%';
    });
  }));
}

/* ─── Try Again ─── */
function tryAgain() {
  navigate('draw');
}

/* ─── Helpers ─── */
function capitalize(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ─── Tactile Mobile Button Feedback & Touch 1 Guarantee ─── */
function initTactileButtons() {
  // Enables iOS Safari :active pseudo-classes across all elements
  document.addEventListener('touchstart', () => {}, { passive: true });

  const SELECTOR = 'button, .btn-primary-3d, .btn-identify, .clear-btn, .swatch, .tool-btn, .size-btn, .btn-circle, .btn-circle-sm, .btn-try-again, .btn-back-home';

  // Prevent double execution when both pointerup and native click occur
  document.addEventListener('click', (e) => {
    const btn = e.target.closest(SELECTOR);
    if (!btn) return;
    const lastFired = parseInt(btn.dataset.lastFired || '0', 10);
    // If our pointerup already triggered this button within 350ms, stop duplicate
    if (e.isTrusted && Date.now() - lastFired < 350) {
      e.preventDefault();
      e.stopImmediatePropagation();
    } else {
      btn.dataset.lastFired = Date.now();
    }
  }, true);

  // Guaranteed tactile press animation + Touch 1 tap dispatch
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest(SELECTOR);
    if (!btn || btn.disabled) return;

    btn.classList.add('is-pressed');
    const pressTime = Date.now();

    const release = (upEvt) => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);

      // 100ms tactile frame for visual feedback
      const elapsed = Date.now() - pressTime;
      const minDuration = 100;
      if (elapsed < minDuration) {
        setTimeout(() => btn.classList.remove('is-pressed'), minDuration - elapsed);
      } else {
        btn.classList.remove('is-pressed');
      }

      // If finger lifted inside button bounds, guarantee immediate action
      if (upEvt && upEvt.type === 'pointerup') {
        const rect = btn.getBoundingClientRect();
        if (
          upEvt.clientX >= rect.left && upEvt.clientX <= rect.right &&
          upEvt.clientY >= rect.top  && upEvt.clientY <= rect.bottom
        ) {
          const lastFired = parseInt(btn.dataset.lastFired || '0', 10);
          if (Date.now() - lastFired > 350) {
            btn.dataset.lastFired = Date.now();
            btn.click();
          }
        }
      }
    };

    window.addEventListener('pointerup', release, { once: true });
    window.addEventListener('pointercancel', release, { once: true });
  }, { passive: true });
}

/* ─── Bootstrap ─── */
document.addEventListener('DOMContentLoaded', () => {
  initTactileButtons();
  updateIdentifyButtonState();
  onEnterHome();
  console.log('[Doodle] App ready with tactile Touch 1 engine.');
});
