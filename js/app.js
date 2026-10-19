/* ═══════════════════════════════════════════════
   app.js  —  Navigation · Timer · Results
   ═══════════════════════════════════════════════ */

const SCREENS = ['home', 'draw', 'results', 'library'];

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
  if (to === 'library') onEnterLibrary();
}

/* ─── Home ─── */
function onEnterHome() {
  stopTimer();
  const btn = document.getElementById('btn-start');
  if (btn) btn.blur();
  // Ensure objects-bar is not left in pressed state
  const objBar = document.querySelector('.objects-bar');
  if (objBar) { objBar.classList.remove('is-pressed'); objBar.blur(); }
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

/* ─── Library screen ─── */
function onEnterLibrary() {

  // ── Bug 2 fix: accidental card activation on entry ──
  // When the user taps "50 Objects" (home screen), the pointerdown fires on
  // .objects-bar and a window-level pointerup listener is armed. By the time
  // the finger lifts, the library grid has slid in and the browser can
  // dispatch a synthetic pointerdown/click onto whichever doodle-card now
  // occupies the same screen coordinates. Blocking pointer-events on the
  // grid for the same guard window prevents any card from receiving that
  // residual touch event.
  const grid = document.getElementById('lib-grid');
  if (grid) {
    grid.style.pointerEvents = 'none';
    setTimeout(() => { grid.style.pointerEvents = ''; }, 450);
  }

  // Reset search
  const input = document.getElementById('lib-search-input');
  const clearBtn = document.getElementById('lib-search-clear');
  if (input) { input.value = ''; input.blur(); }
  if (clearBtn) clearBtn.classList.remove('visible');
  libFilterObjects('');

  // Scroll the lib-main back to top
  const libMain = document.querySelector('#screen-library .lib-main');
  if (libMain) libMain.scrollTop = 0;
  document.getElementById('screen-library').scrollTop = 0;
}

function libFilterObjects(query) {
  const q = query.toLowerCase().trim();
  const cards = document.querySelectorAll('#lib-grid .doodle-card[data-name]');
  const counter = document.getElementById('lib-counter');
  const emptyEl = document.getElementById('lib-empty');
  let visible = 0;

  cards.forEach(card => {
    const name  = card.getAttribute('data-name') || '';
    const idx   = card.getAttribute('data-index') || '';
    const match = !q || name.includes(q) || idx.includes(q);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  if (counter) {
    counter.innerHTML = '<span class="msi secondary" style="font-size:16px">category</span> Showing <strong style="color:var(--on-surface);margin:0 2px">' + visible + '</strong> of 50 objects';
  }

  if (emptyEl) {
    if (visible === 0) {
      emptyEl.classList.add('visible');
    } else {
      emptyEl.classList.remove('visible');
    }
  }
}

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

  const SELECTOR = 'button, .btn-primary-3d, .btn-identify, .clear-btn, .swatch, .tool-btn, .size-btn, .btn-circle, .btn-circle-sm, .btn-try-again, .btn-back-home, .objects-bar, .doodle-card';
  // Screen-changing controls must use the browser's native click only.
  // Manually calling click() on pointerup can switch screens before the
  // original touch sequence finishes, allowing the gesture to affect the
  // newly revealed library or drawing canvas.
  const NATIVE_CLICK_ONLY = '.objects-bar, #btn-start, .btn-circle, .btn-back-home, .btn-try-again';

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

      // Preserve the manual click fallback for ordinary controls only.
      // Navigation controls rely on the native click, which stays associated
      // with the original pointer target and cannot bleed into the next screen.
      if (upEvt && upEvt.type === 'pointerup' && !btn.matches(NATIVE_CLICK_ONLY)) {
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

  // Keep library cards' original tactile press/release feel.
  document.querySelectorAll('.doodle-card').forEach(card => {
    card.addEventListener('mouseleave', () => card.classList.remove('is-pressed'));
  });

  // Init library search
  const libInput   = document.getElementById('lib-search-input');
  const libClear   = document.getElementById('lib-search-clear');
  const libResetBtn = document.getElementById('lib-reset-btn');

  if (libInput) {
    libInput.addEventListener('input', e => {
      libFilterObjects(e.target.value);
      if (libClear) libClear.classList.toggle('visible', e.target.value.length > 0);
    });
  }
  if (libClear) {
    libClear.addEventListener('click', () => {
      if (libInput) { libInput.value = ''; libInput.focus(); }
      libFilterObjects('');
      libClear.classList.remove('visible');
    });
  }
  if (libResetBtn) {
    libResetBtn.addEventListener('click', () => {
      if (libInput) { libInput.value = ''; libInput.focus(); }
      libFilterObjects('');
      if (libClear) libClear.classList.remove('visible');
    });
  }

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace('#', '');
  const targetScreen = params.get('screen') || hash;
  if (targetScreen && SCREENS.includes(targetScreen) && targetScreen !== 'home') {
    navigate(targetScreen);
  } else {
    onEnterHome();
  }
  console.log('[Doodle] App ready with tactile Touch 1 engine.');
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash && SCREENS.includes(hash)) {
    navigate(hash);
  }
});
