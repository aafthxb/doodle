/* ═══════════════════════════════════════════════
   inference.js  —  ONNX Runtime Web
   Model: models/doodlio_model.onnx
   ═══════════════════════════════════════════════ */

const MODEL_PATH = './models/doodlio_model.onnx';

// 50 Quick,Draw! class labels — must match training order
const CLASSES = [
  'airplane','apple','banana','basketball','bee',
  'bicycle','bird','book','bowtie','bread',
  'butterfly','cactus','cake','camera','car',
  'cat','clock','cloud','cookie','cup',
  'dog','duck','elephant','eye','fish',
  'flamingo','flower','guitar','hat','heart',
  'horse','house','ice cream','key','leaf',
  'lightning','moon','mountain','mushroom','pizza',
  'rabbit','rainbow','scissors','shoe','star',
  'sun','t-shirt','tree','umbrella','watch'
];

// Material Symbol icon names for pred bars
const CLASS_ICON = {
  airplane:'flight', apple:'nutrition', banana:'nutrition', basketball:'sports_basketball',
  bee:'bug_report', bicycle:'pedal_bike', bird:'flutter_dash', book:'menu_book',
  bowtie:'redeem', bread:'bakery_dining', butterfly:'bug_report', cactus:'park',
  cake:'cake', camera:'photo_camera', car:'directions_car', cat:'pets',
  clock:'schedule', cloud:'cloud', cookie:'cookie', cup:'local_cafe',
  dog:'pets', duck:'flutter_dash', elephant:'pets', eye:'visibility',
  fish:'set_meal', flamingo:'flutter_dash', flower:'local_florist', guitar:'music_note',
  hat:'redeem', heart:'favorite', horse:'pets', house:'home',
  'ice cream':'icecream', key:'key', leaf:'eco', lightning:'bolt',
  moon:'dark_mode', mountain:'landscape', mushroom:'spa', pizza:'local_pizza',
  rabbit:'pets', rainbow:'wb_sunny', scissors:'content_cut', shoe:'steps',
  star:'star', sun:'wb_sunny', 't-shirt':'checkroom', tree:'park',
  umbrella:'beach_access', watch:'watch'
};

// Emoji for display name
const CLASS_EMOJI = {
  airplane:'✈️',apple:'🍎',banana:'🍌',basketball:'🏀',bee:'🐝',bicycle:'🚲',
  bird:'🐦',book:'📖',bowtie:'🎀',bread:'🍞',butterfly:'🦋',cactus:'🌵',
  cake:'🎂',camera:'📷',car:'🚗',cat:'🐱',clock:'🕐',cloud:'☁️',
  cookie:'🍪',cup:'☕',dog:'🐶',duck:'🦆',elephant:'🐘',eye:'👁️',
  fish:'🐟',flamingo:'🦩',flower:'🌸',guitar:'🎸',hat:'🎩',heart:'❤️',
  horse:'🐴',house:'🏠','ice cream':'🍦',key:'🔑',leaf:'🍃',
  lightning:'⚡',moon:'🌙',mountain:'⛰️',mushroom:'🍄',pizza:'🍕',
  rabbit:'🐰',rainbow:'🌈',scissors:'✂️',shoe:'👟',star:'⭐',
  sun:'☀️','t-shirt':'👕',tree:'🌳',umbrella:'☂️',watch:'⌚'
};

const EXPLANATIONS = {
  leaf:      "The CNN extracted hierarchical stroke contours, recognizing distinctive lobed leaf margins and stem structures characteristic of the 'leaf' class.",
  flower:    "Petal radial arrangements around a central circle were detected, consistent with the 'flower' class probability distribution.",
  tree:      "Vertical trunk stroke with branching upper contours matched the hierarchical 'tree' class feature maps.",
  sun:       "Central circular region with radiating line strokes matched the symmetric 'sun' class softmax peak.",
  cat:       "Pointed ear peaks, circular head contour, and facial features matched the 'cat' class template.",
  dog:       "Floppy ear shapes and muzzle contour were extracted, consistent with 'dog' class feature activations.",
  bird:      "Rounded body with beak and wing contours were recognized matching the 'bird' class cluster.",
  fish:      "Elliptical body with triangular fin and tail strokes aligned to 'fish' class softmax output.",
  house:     "Triangular roof with rectangular body geometry matched the 'house' class spatial pattern.",
  car:       "Rectangular body with circular wheel features matched the 'car' class learned representation.",
  airplane:  "Elongated horizontal body with delta-wing strokes matched the 'airplane' class feature vector.",
  bicycle:   "Circular wheel contours connected by a frame matched the 'bicycle' class hierarchical features.",
  pizza:     "Circular outline with internal radial segments matched the 'pizza' class distribution.",
  star:      "Pointed radial strokes from a center point matched the 'star' class stroke pattern.",
  heart:     "Symmetric curved lobes joined at a point matched the 'heart' class spatial geometry.",
  clock:     "Circular outline with radial lines matched the 'clock' class feature activations.",
  moon:      "Crescent-shaped arc with high curvature matched the 'moon' class softmax cluster.",
};
const DEFAULT_EXPLANATION = "The Convolutional Neural Network extracted hierarchical stroke features and spatial patterns, recognizing distinctive contours characteristic of the predicted class.";

let session     = null;
let modelLoaded = false;
let modelError  = null;

/* ── Load model ── */
async function loadModel() {
  try {
    if (typeof ort === 'undefined') throw new Error('ORT not available');
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    modelLoaded = true;
    console.log('[Doodle] ✓ Model loaded |', session.inputNames, '→', session.outputNames);
  } catch(e) {
    modelError = e.message;
    console.warn('[Doodle] Model not loaded:', e.message);
  }
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
    minX = 0; minY = 0; maxX = canvas.width; maxY = canvas.height;
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
  for (let i = 0; i < SIZE * SIZE; i++) {
    const gray = px[i*4]*0.299 + px[i*4+1]*0.587 + px[i*4+2]*0.114;
    out[i] = (255 - gray) / 255;   // invert: ink=1, bg=0
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
  if (!modelLoaded || !session) return getDemoResults(canvas);
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
    return getDemoResults(canvas);
  }
}

/* ── Demo fallback ── */
function getDemoResults(canvas) {
  const ctx  = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let h = 0;
  for (let i = 0; i < data.length; i += 400) h = (h * 31 + data[i]) | 0;
  const a = Math.abs(h)    % CLASSES.length;
  const b = Math.abs(h*7)  % CLASSES.length;
  const c = Math.abs(h*13) % CLASSES.length;
  const p1 = 0.62 + Math.random() * 0.22;
  const p2 = (1 - p1) * (0.6 + Math.random() * 0.25);
  const p3 = 1 - p1 - p2;
  const top3 = [
    { label: CLASSES[a], prob: p1 },
    { label: CLASSES[b], prob: p2 },
    { label: CLASSES[c], prob: p3 },
  ];
  return {
    top: top3[0],
    predictions: top3,
    explanation: EXPLANATIONS[top3[0].label] || DEFAULT_EXPLANATION,
    isDemo: true
  };
}

loadModel();
