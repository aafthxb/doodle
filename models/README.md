# /models/

Place your trained ONNX model file here:

```
doodle_model.onnx
```

Expected model spec:
- Input:  [1, 1, 28, 28]  — float32, normalized grayscale (0.0 = white, 1.0 = black ink)
- Output: [1, 50]          — logits over 50 Quick,Draw! classes (softmax applied in app)

Once the file is in this folder and the page is served, the app will auto-load
and run live CNN inference on your drawings.
