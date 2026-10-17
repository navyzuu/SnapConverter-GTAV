/// <reference lib="webworker" />

import {
  applyJpegDeblock,
  applyFSR_RCAS,
  applyGTAMetallicSpecular,
  applyBrightnessContrast,
  stepUpscale,
  imageDataToOffscreenCanvas,
  offscreenCanvasToImageData,
} from '../lib/imageUtils';
import type { UpscaleFactor } from '../lib/enhance';

interface WorkerMessage {
  id: number;
  imageData: ImageData;
  upscale: UpscaleFactor;
  sharpen: number;
  brightness: number;
  contrast: number;
  noiseReduction: boolean;
  saturation: number;
  gloss?: number;
  grain?: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { id, imageData, upscale, sharpen, brightness, contrast, noiseReduction, saturation, gloss, grain } = e.data;

  try {
    let current = imageData;

    // 1. Optional subtle JPEG deblock ONLY if noise reduction is explicitly enabled
    if (noiseReduction) {
      current = applyJpegDeblock(current, 0.7);
    }

    // 2. High-precision progressive step upscale FIRST
    if (upscale > 1) {
      const canvas = imageDataToOffscreenCanvas(current);
      const upscaled = stepUpscale(canvas, upscale as 2 | 4 | 8);
      current = offscreenCanvasToImageData(upscaled);
    }

    // 3. AMD FidelityFX RCAS (Robust Contrast Adaptive Sharpening)
    // Runs at target resolution: restores crisp sub-pixel geometry & decals without cartoon smearing
    const rcasSharpness = sharpen > 0 
      ? Math.min(1.2, 0.4 + (sharpen / 10) * 0.8) 
      : (upscale > 1 ? 0.75 : 0);

    if (rcasSharpness > 0) {
      current = applyFSR_RCAS(current, rcasSharpness);
    }

    // 4. GTA RAGE Engine Clear-Coat Specular & Metallic Roughness
    if ((gloss && gloss > 0) || (grain && grain > 0)) {
      current = applyGTAMetallicSpecular(current, gloss ?? 0, grain ?? 0);
    }

    // 5. Color grading
    if (brightness !== 0 || contrast !== 0) {
      current = applyBrightnessContrast(current, brightness, contrast);
    }

    if (saturation !== 100) {
      const src = imageDataToOffscreenCanvas(current);
      const dest = new OffscreenCanvas(src.width, src.height);
      const ctx = dest.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.filter = `saturate(${saturation}%)`;
      ctx.drawImage(src, 0, 0);
      ctx.filter = 'none';
      current = offscreenCanvasToImageData(dest);
    }

    (self as unknown as DedicatedWorkerGlobalScope).postMessage(
      { id, imageData: current },
      [current.data.buffer]
    );
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({
      id,
      error: err instanceof Error ? err.message : 'Enhancement failed',
    });
  }
};
