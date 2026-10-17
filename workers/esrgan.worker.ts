/// <reference lib="webworker" />

// Real-ESRGAN-anime 4x upscaling via ONNX Runtime Web (WASM backend).
//
// Model setup:
//   1. Download realesr-animevideov3.pth from https://github.com/xinntao/Real-ESRGAN/releases
//   2. Export to ONNX: python scripts/export_onnx.py -i realesr-animevideov3.pth -o public/models/realesrgan-anime-4x.onnx
//   OR use a community pre-converted ONNX from HuggingFace / GitHub releases.
//
// Model spec: input [1, 3, H, W] float32 in [0,1] → output [1, 3, 4H, 4W] float32 in [0,1]

import * as ort from 'onnxruntime-web';

// WASM runtime served from /public/onnx/ (copied from node_modules at setup time).
// All inference stays 100% local — nothing leaves the browser.
ort.env.wasm.wasmPaths = '/onnx/';

const MODEL_URL = '/models/realesrgan-general-4x.onnx';

// Tiling constants — balance between memory usage and tile-seam quality
const TILE    = 256; // input patch size (256×256)
const OVERLAP = 16;  // overlap on each side to hide seam artifacts
const STEP    = TILE - 2 * OVERLAP; // 224 effective pixels per tile step
const SCALE   = 4;

// ── IndexedDB model cache ─────────────────────────────────────────────────────

const DB_NAME  = 'snapconvert-esrgan';
const DB_STORE = 'models';
const DB_KEY   = 'realesrgan-general-4x-v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function loadFromCache(): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch { return null; }
}

async function saveToCache(data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(data, DB_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch { /* non-critical */ }
}

// ── Session singleton ─────────────────────────────────────────────────────────

let session: ort.InferenceSession | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (session) return session;

  let modelData = await loadFromCache();

  if (!modelData) {
    post({ type: 'status', message: 'Downloading Real-ESRGAN Photo model (~4.8MB, cached after first use)...' });
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(
      `Model not found. Place realesrgan-general-4x.onnx in public/models/`
    );
    modelData = await res.arrayBuffer();
    await saveToCache(modelData);
  }

  post({ type: 'status', message: 'Loading Real-ESRGAN Photo model into WASM...' });
  session = await ort.InferenceSession.create(modelData, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  return session;
}

// ── Tensor helpers ────────────────────────────────────────────────────────────

// RGBA Uint8 [H×W×4] → CHW Float32 [1,3,H,W] in [0,1]
function toTensor(px: Uint8ClampedArray, w: number, h: number): ort.Tensor {
  const hw  = h * w;
  const chw = new Float32Array(3 * hw);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = y * w + x;
      chw[di]        = px[si]   / 255; // R
      chw[hw  + di]  = px[si+1] / 255; // G
      chw[2*hw + di] = px[si+2] / 255; // B
    }
  }
  return new ort.Tensor('float32', chw, [1, 3, h, w]);
}

// ── Worker message handler ────────────────────────────────────────────────────

const post = (self as unknown as DedicatedWorkerGlobalScope).postMessage.bind(self);

interface InferRequest { id: number; imageData: ImageData }

self.onmessage = async (e: MessageEvent<InferRequest>) => {
  const { id, imageData } = e.data;

  try {
    const sess = await getSession();
    const inputName  = sess.inputNames[0];
    const outputName = sess.outputNames[0];

    const { data, width, height } = imageData;
    const outW = width  * SCALE;
    const outH = height * SCALE;
    const output = new Uint8ClampedArray(outW * outH * 4);

    const tilesX = Math.ceil(width  / STEP);
    const tilesY = Math.ceil(height / STEP);
    const total  = tilesX * tilesY;
    let done = 0;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const x0 = tx * STEP;
        const y0 = ty * STEP;

        // Input patch bounds with overlap, clamped to image edges
        const ix0 = Math.max(0, x0 - OVERLAP);
        const iy0 = Math.max(0, y0 - OVERLAP);
        const ix1 = Math.min(width,  x0 + STEP + OVERLAP);
        const iy1 = Math.min(height, y0 + STEP + OVERLAP);
        const iw = ix1 - ix0, ih = iy1 - iy0;

        // Extract tile; pad remaining TILE×TILE area with edge replication
        const tile = new Uint8ClampedArray(TILE * TILE * 4);
        for (let ry = 0; ry < TILE; ry++) {
          for (let rx = 0; rx < TILE; rx++) {
            const cRy = Math.min(ry, ih - 1);
            const cRx = Math.min(rx, iw - 1);
            const si = ((iy0 + cRy) * width + (ix0 + cRx)) * 4;
            const di = (ry * TILE + rx) * 4;
            tile[di] = data[si]; tile[di+1] = data[si+1];
            tile[di+2] = data[si+2]; tile[di+3] = 255;
          }
        }

        // Run inference
        const results  = await sess.run({ [inputName]: toTensor(tile, TILE, TILE) });
        const outFloat = results[outputName].data as Float32Array;
        const tW  = TILE * SCALE;
        const tHW = tW * tW;

        // Crop overlap region from upscaled tile output, place into final buffer
        const cropX = (x0 - ix0) * SCALE;
        const cropY = (y0 - iy0) * SCALE;
        const copyW = Math.min(STEP, width  - x0) * SCALE;
        const copyH = Math.min(STEP, height - y0) * SCALE;

        for (let ry = 0; ry < copyH; ry++) {
          for (let rx = 0; rx < copyW; rx++) {
            const si = (cropY + ry) * tW + (cropX + rx);
            const di = ((y0 * SCALE + ry) * outW + (x0 * SCALE + rx)) * 4;
            output[di]   = Math.min(255, Math.max(0, Math.round(outFloat[si]          * 255)));
            output[di+1] = Math.min(255, Math.max(0, Math.round(outFloat[tHW   + si]  * 255)));
            output[di+2] = Math.min(255, Math.max(0, Math.round(outFloat[2*tHW + si]  * 255)));
            output[di+3] = 255;
          }
        }

        done++;
        post({ id, progress: Math.round(done / total * 100) });
      }
    }

    const result = new ImageData(output, outW, outH);
    post({ id, imageData: result }, [result.data.buffer]);
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : 'ESRGAN inference failed' });
  }
};
