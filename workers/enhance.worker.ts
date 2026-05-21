/// <reference lib="webworker" />

import {
  applyJpegDeblock,
  applyBilateralFilter,
  applyGaussianBlurN,
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
      // Step 1: JPEG-specific deblocking — only touches 8×8 block boundaries where
      // the discontinuity is small enough to be an artifact (not a real edge).
      // edgeThreshold=22 means shadows and color transitions are left completely alone.
      current = applyJpegDeblock(current, 0.75);

      // Step 2: Very tight bilateral (colorSigma=10) cleans up intra-block ringing.
      // colorSigma=10 means only pixels within ±10 intensity blend together —
      // real shading gradients (±30+) are not touched, so car form is preserved.
      current = applyBilateralFilter(current, 1.5, 10);

      // Step 3: Restore micro-contrast lost in smoothing steps
      current = applyUnsharpMask(current, 0.7, 1, 6);
    }

    // Sharpen at original resolution — stays proportional at any display/download size
    if (sharpen > 0) {
      const amount = 0.5 + (sharpen / 10) * 1.8;
      const blurPasses = sharpen <= 4 ? 1 : 2;
      const threshold = Math.max(4, 13 - sharpen);
      current = applyUnsharpMask(current, amount, blurPasses, threshold);
    }

    // Upscale after all processing — enlarges an already-clean image
    if (upscale > 1) {
      const canvas = imageDataToOffscreenCanvas(current);
      const upscaled = stepUpscale(canvas, upscale as 2 | 4 | 8);
      current = offscreenCanvasToImageData(upscaled);
    }

    if (brightness !== 0 || contrast !== 0) {
      current = applyBrightnessContrast(current, brightness, contrast);
    }

    // Saturation — draw source onto a separate canvas (fixes self-draw bug)
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
