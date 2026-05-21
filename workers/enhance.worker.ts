/// <reference lib="webworker" />

import {
  applyJpegDeblock,
  applyDiagonalSmooth,
  applyUnsharpMask,
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
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { id, imageData, upscale, sharpen, brightness, contrast, noiseReduction, saturation } = e.data;

  try {
    let current = imageData;

    if (noiseReduction) {
      current = applyJpegDeblock(current, 1.0);
    }

    if (sharpen > 0) {
      const amount = 0.6 + (sharpen / 10) * 1.8;
      const blurPasses = sharpen <= 4 ? 1 : 2;
      const threshold = Math.max(8, 18 - sharpen);
      current = applyUnsharpMask(current, amount, blurPasses, threshold);
    }

    // Diagonal anti-aliasing: uses Sobel gradient angle to target staircase on diagonal
    // edges (15°–75° and 105°–165°). Near-horizontal and near-vertical edges are skipped
    // entirely so they stay crisp. Runs after sharpen so unsharp mask doesn't undo it.
    // Applies to any active enhancement; skipped for "Original" (all defaults).
    const anyEnhancement = noiseReduction || upscale > 1 || sharpen > 0;
    if (anyEnhancement) {
      const aaStrength = noiseReduction ? 0.5 : 0.35;
      current = applyDiagonalSmooth(current, aaStrength);
      if (noiseReduction) {
        // Second pass for Clean preset — accumulates further step reduction
        current = applyDiagonalSmooth(current, aaStrength);
      }
    }

    if (upscale > 1) {
      const canvas = imageDataToOffscreenCanvas(current);
      const upscaled = stepUpscale(canvas, upscale as 2 | 4 | 8);
      current = offscreenCanvasToImageData(upscaled);
    }

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
