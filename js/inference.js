/* ═══════════════════════════════════════════════
   inference.js  —  ONNX Runtime Web
   Model: models/doodlio_model.onnx
   ═══════════════════════════════════════════════ */

const MODEL_PATH = './models/doodlio_model.onnx';

// 50 Quick,Draw! class labels — matching DoodlioNet Colab CATEGORIES exact ID order (0..49)
const CLASSES = [
  'airplane', 'apple', 'banana', 'bicycle', 'bird',  // 0..4
  'bridge', 'bus', 'butterfly', 'camera', 'car',  // 5..9
  'castle', 'cat', 'church', 'clock', 'cloud',  // 10..14
  'coffee_cup', 'cookie', 'cup', 'dog', 'donut',  // 15..19
  'drums', 'duck', 'elephant', 'envelope', 'fish',  // 20..24
  'flower', 'frog', 'guitar', 'headphones', 'house',  // 25..29
  'houseplant', 'ice_cream', 'leaf', 'lightning', 'moon',  // 30..34
  'mug', 'mushroom', 'palm_tree', 'piano', 'pizza',  // 35..39
  'rabbit', 'sailboat', 'scissors', 'speedboat', 'star',  // 40..44
  'sun', 'traffic_light', 'tree', 'umbrella', 'wine_glass',  // 45..49
];

// Material Symbol icon names for pred bars
const CLASS_ICON = {
  'airplane':'flight', 'apple':'nutrition', 'banana':'nutrition', 'bicycle':'pedal_bike', 'bird':'flutter_dash',
  'bridge':'architecture', 'bus':'directions_bus', 'butterfly':'flutter_dash', 'camera':'photo_camera', 'car':'directions_car',
  'castle':'fort', 'cat':'pets', 'church':'church', 'clock':'schedule', 'cloud':'cloud',
  'coffee_cup':'local_cafe', 'cookie':'cookie', 'cup':'local_cafe', 'dog':'pets', 'donut':'donut_large',
  'drums':'music_note', 'duck':'flutter_dash', 'elephant':'pets', 'envelope':'mail', 'fish':'set_meal',
  'flower':'local_florist', 'frog':'pets', 'guitar':'music_note', 'headphones':'headphones', 'house':'home',
  'houseplant':'potted_plant', 'ice_cream':'icecream', 'leaf':'eco', 'lightning':'bolt', 'moon':'dark_mode',
  'mug':'sports_bar', 'mushroom':'spa', 'palm_tree':'park', 'piano':'piano', 'pizza':'local_pizza',
  'rabbit':'pets', 'sailboat':'sailing', 'scissors':'content_cut', 'speedboat':'directions_boat', 'star':'star',
  'sun':'wb_sunny', 'traffic_light':'traffic', 'tree':'park', 'umbrella':'beach_access', 'wine_glass':'wine_bar',
  // Aliases for compatibility
  'coffee cup':'local_cafe', 'ice cream':'icecream', 'palm tree':'park', 'traffic light':'traffic', 'wine glass':'wine_bar'
};

// Emoji for display name
const CLASS_EMOJI = {
  'airplane':'✈️', 'apple':'🍎', 'banana':'🍌', 'bicycle':'🚲', 'bird':'🐦',
  'bridge':'🌉', 'bus':'🚌', 'butterfly':'🦋', 'camera':'📷', 'car':'🚗',
  'castle':'🏰', 'cat':'🐱', 'church':'⛪', 'clock':'⏰', 'cloud':'☁️',
  'coffee_cup':'☕', 'cookie':'🍪', 'cup':'🥤', 'dog':'🐶', 'donut':'🍩',
  'drums':'🥁', 'duck':'🦆', 'elephant':'🐘', 'envelope':'✉️', 'fish':'🐟',
  'flower':'🌸', 'frog':'🐸', 'guitar':'🎸', 'headphones':'🎧', 'house':'🏠',
  'houseplant':'🪴', 'ice_cream':'🍦', 'leaf':'🍃', 'lightning':'⚡', 'moon':'🌙',
  'mug':'🍺', 'mushroom':'🍄', 'palm_tree':'🌴', 'piano':'🎹', 'pizza':'🍕',
  'rabbit':'🐰', 'sailboat':'⛵', 'scissors':'✂️', 'speedboat':'🚤', 'star':'⭐',
  'sun':'☀️', 'traffic_light':'🚦', 'tree':'🌳', 'umbrella':'☂️', 'wine_glass':'🍷',
  // Aliases for compatibility
  'coffee cup':'☕', 'ice cream':'🍦', 'palm tree':'🌴', 'traffic light':'🚦', 'wine glass':'🍷'
};

const EXPLANATIONS = {
  leaf:          "The CNN extracted hierarchical stroke contours, recognizing distinctive lobed leaf margins and stem structures characteristic of the 'leaf' class.",
  flower:        "Petal radial arrangements around a central circle were detected, consistent with the 'flower' class probability distribution.",
  tree:          "Vertical trunk stroke with branching upper contours matched the hierarchical 'tree' class feature maps.",
  sun:           "Central circular region with radiating line strokes matched the symmetric 'sun' class softmax peak.",
  cat:           "Pointed ear peaks, circular head contour, and facial features matched the 'cat' class template.",
  dog:           "Floppy ear shapes and muzzle contour were extracted, consistent with 'dog' class feature activations.",
  bird:          "Rounded body with beak and wing contours were recognized matching the 'bird' class cluster.",
  fish:          "Elliptical body with triangular fin and tail strokes aligned to 'fish' class softmax output.",
  house:         "Triangular roof with rectangular body geometry matched the 'house' class spatial pattern.",
  car:           "Rectangular body with circular wheel features matched the 'car' class learned representation.",
  airplane:      "Elongated horizontal body with delta-wing strokes matched the 'airplane' class feature vector.",
  bicycle:       "Circular wheel contours connected by a frame matched the 'bicycle' class hierarchical features.",
  pizza:         "Circular outline with internal radial segments matched the 'pizza' class distribution.",
  star:          "Pointed radial strokes from a center point matched the 'star' class stroke pattern.",
  clock:         "Circular outline with radial lines matched the 'clock' class feature activations.",
  moon:          "Crescent-shaped arc with high curvature matched the 'moon' class softmax cluster.",
  coffee_cup:    "Curved cup contour with handle and rim features matched the 'coffee cup' class learned representation.",
  ice_cream:     "Conical base with rounded swirl contours matched the 'ice cream' class probability distribution.",
  houseplant:    "Pot base with radiating leaf contours matched the 'houseplant' class feature maps.",
  palm_tree:     "Slender trunk with radiating fronds matched the 'palm tree' class spatial geometry.",
  traffic_light: "Vertical rectangular housing with distinct circular lamp features matched the 'traffic light' class template.",
  wine_glass:    "Stemmed base with flared bowl contour matched the 'wine glass' class distribution."
};
const DEFAULT_EXPLANATION = "The Convolutional Neural Network extracted hierarchical stroke features and spatial patterns, recognizing distinctive contours characteristic of the predicted class.";

let session      = null;
let modelLoaded  = false;
let modelState   = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
let modelError   = null;
let modelPromise = null;
const modelStateListeners = [];

function isModelReady() {
  return modelState === 'ready' && session !== null;
}

function onModelStateChange(listener) {
  if (typeof listener !== 'function') return;
  modelStateListeners.push(listener);
  try {
    listener(modelState, modelError);
  } catch (err) {
    console.error('[Doodle] Error in modelState listener:', err);
  }
}

function notifyModelState() {
  for (const listener of modelStateListeners) {
    try {
      listener(modelState, modelError);
    } catch (err) {
      console.error('[Doodle] Error in modelState listener:', err);
    }
  }
}

/* ── Asynchronous Singleton Model Loader ── */
async function loadModel() {
  if (modelState === 'ready' && session) {
    return session;
  }
  if (modelState === 'loading' && modelPromise) {
    return modelPromise;
  }

  modelState = 'loading';
  modelLoaded = false;
  modelError = null;
  notifyModelState();

  modelPromise = (async () => {
    try {
      if (typeof ort === 'undefined') throw new Error('ONNX Runtime Web (ort) not available');
      ort.env.wasm.numThreads = 1;
      session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      modelLoaded = true;
      modelState = 'ready';
      modelError = null;
      console.log('[Doodle] ✓ Model loaded & ready |', session.inputNames, '→', session.outputNames);
      notifyModelState();
      return session;
    } catch (err) {
      session = null;
      modelLoaded = false;
      modelState = 'error';
      modelError = err.message || 'Model failed to load';
      console.warn('[Doodle] Model loading failed:', modelError);
      notifyModelState();
      throw err;
    } finally {
      modelPromise = null;
    }
  })();

  return modelPromise;
}

/* ── Preprocess: canvas → Float32[1,1,28,28] ── */
function preprocessCanvas(canvas) {
  const SIZE = 28;
  const off  = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
  const ctx  = off.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Fast bounding-box calculation from stroke points (takes 0.05ms)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasValidStroke = false;

  if (typeof strokes !== 'undefined' && strokes && strokes.length > 0) {
    const dpr = window.devicePixelRatio || 1;
    for (const stroke of strokes) {
      for (const pt of stroke) {
        if (pt.eraser) continue;
        hasValidStroke = true;
        const x = pt.x * dpr;
        const y = pt.y * dpr;
        const r = (pt.size || 8) * dpr * 0.7;
        if (x - r < minX) minX = x - r;
        if (y - r < minY) minY = y - r;
        if (x + r > maxX) maxX = x + r;
        if (y + r > maxY) maxY = y + r;
      }
    }
  }

  if (!hasValidStroke) {
    const srcCtx = canvas.getContext('2d');
    const imgData = srcCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    let found = false;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const a = data[i + 3];
        if (a > 20) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (r < 235 || g < 235 || b < 235) {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }
    if (!found) {
      minX = 0; minY = 0; maxX = canvas.width; maxY = canvas.height;
    }
  }

  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(canvas.width, Math.ceil(maxX));
  maxY = Math.min(canvas.height, Math.ceil(maxY));

  const strokeW = maxX - minX;
  const strokeH = maxY - minY;

  if (strokeW <= 0 || strokeH <= 0) return new Float32Array(SIZE * SIZE);

  // Fit centered inside 28x28 with 4px padding (active 20x20 area matching Quick, Draw! CNN)
  const targetSize = 20;
  const maxDim = Math.max(strokeW, strokeH);
  const scale = targetSize / maxDim;
  const drawW = Math.max(1, strokeW * scale);
  const drawH = Math.max(1, strokeH * scale);
  const dx = (SIZE - drawW) / 2;
  const dy = (SIZE - drawH) / 2;

  ctx.drawImage(canvas, minX, minY, strokeW, strokeH, dx, dy, drawW, drawH);

  // Read only 28x28 (784 pixels)
  const px  = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const out = new Float32Array(SIZE * SIZE);
  let maxInk = 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const gray = px[i*4]*0.299 + px[i*4+1]*0.587 + px[i*4+2]*0.114;
    out[i] = (255 - gray) / 255;   // invert: ink=1, bg=0
    if (out[i] > maxInk) maxInk = out[i];
  }

  // Scale stroke intensity to full dynamic range [0, 1] to match training preprocessing
  if (maxInk > 0.05) {
    for (let i = 0; i < SIZE * SIZE; i++) {
      out[i] = Math.min(1.0, out[i] / maxInk);
    }
  }

  return out;
}

function softmax(a) {
  const m = Math.max(...a);
  const e = a.map(x => Math.exp(x - m));
  const s = e.reduce((a,b) => a+b, 0);
  return e.map(x => x / s);
}

/* ── Run inference ── */
async function runInference(canvas) {
  if (!isModelReady()) {
    throw new Error('AI Model is not ready yet');
  }
  try {
    const raw = preprocessCanvas(canvas);
    const t   = new ort.Tensor('float32', raw, [1, 1, 28, 28]);
    const res = await session.run({ [session.inputNames[0]]: t });
    const probs = softmax(Array.from(res[session.outputNames[0]].data));
    const indexed = probs.map((p, i) => ({ label: CLASSES[i], prob: p }));
    indexed.sort((a, b) => b.prob - a.prob);
    const top3 = indexed.slice(0, 3);
    return {
      top: top3[0],
      predictions: top3,
      explanation: EXPLANATIONS[top3[0].label] || DEFAULT_EXPLANATION,
      isDemo: false
    };
  } catch(e) {
    console.error('[Doodle] Inference error:', e);
    throw e;
  }
}

// Automatically initiate background model loading without blocking page or navigation
loadModel().catch(() => {});
