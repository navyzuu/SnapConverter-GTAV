// JPEG DCT deblocking: smooths ONLY at 8×8 block boundaries where the discontinuity
// is small (artifact) vs large (real edge). Skips real edges entirely.
// strength 0.0–1.0: how aggressively to blend the boundary pixels.
export function applyJpegDeblock(imageData: ImageData, strength: number): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);
  // Only treat a boundary as an artifact if the across-boundary diff is below this.
  // GTA V blocks typically show ≤20 intensity jump; real edges are 30–120.
  const edgeThreshold = 22;

  // Smooth horizontal block boundaries (rows 8, 16, 24, …)
  for (let y = 8; y < height - 1; y += 8) {
    for (let x = 1; x < width - 1; x++) {
      // Touch 2-pixel band: rows y-1 and y
      for (let by = y - 1; by <= y; by++) {
        if (by <= 0 || by >= height - 1) continue;
        const ci = (by * width + x) * 4;
        const pi = ((by - 1) * width + x) * 4;
        const ni = ((by + 1) * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          if (Math.abs(data[pi + c] - data[ni + c]) < edgeThreshold) {
            output[ci + c] = Math.round(
              data[ci + c] * (1 - strength) +
              (data[pi + c] + data[ci + c] + data[ni + c]) / 3 * strength
            );
          }
        }
      }
    }
  }

  // Smooth vertical block boundaries (cols 8, 16, 24, …)
  for (let x = 8; x < width - 1; x += 8) {
    for (let y = 1; y < height - 1; y++) {
      for (let bx = x - 1; bx <= x; bx++) {
        if (bx <= 0 || bx >= width - 1) continue;
        const ci = (y * width + bx) * 4;
        const pi = (y * width + bx - 1) * 4;
        const ni = (y * width + bx + 1) * 4;
        for (let c = 0; c < 3; c++) {
          if (Math.abs(output[pi + c] - output[ni + c]) < edgeThreshold) {
            output[ci + c] = Math.round(
              output[ci + c] * (1 - strength) +
              (output[pi + c] + output[ci + c] + output[ni + c]) / 3 * strength
            );
          }
        }
      }
    }
  }

  return new ImageData(output, width, height);
}

// Tight bilateral filter: only blends pixels with very similar color (colorSigma=8–12).
// Used as a secondary cleanup after deblocking to reduce ringing within blocks.
export function applyBilateralFilter(
  imageData: ImageData,
  spatialSigma: number,
  colorSigma: number
): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const radius = Math.ceil(spatialSigma * 2);
  const twoSpatialSigma2 = 2 * spatialSigma * spatialSigma;
  const twoColorSigma2 = 2 * colorSigma * colorSigma;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ci = (y * width + x) * 4;
      const cr = data[ci], cg = data[ci + 1], cb = data[ci + 2];
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(width - 1, Math.max(0, x + dx));
          const ni = (ny * width + nx) * 4;
          const nr = data[ni], ng = data[ni + 1], nb = data[ni + 2];
          const colorDiff2 = (cr - nr) * (cr - nr) + (cg - ng) * (cg - ng) + (cb - nb) * (cb - nb);
          const w = Math.exp(-(dx * dx + dy * dy) / twoSpatialSigma2 - colorDiff2 / twoColorSigma2);
          sumR += nr * w; sumG += ng * w; sumB += nb * w; sumW += w;
        }
      }
      output[ci] = sumR / sumW;
      output[ci + 1] = sumG / sumW;
      output[ci + 2] = sumB / sumW;
      output[ci + 3] = data[ci + 3];
    }
  }
  return new ImageData(output, width, height);
}

export function stepUpscale(
  sourceCanvas: OffscreenCanvas,
  factor: 2 | 4 | 8
): OffscreenCanvas {
  let current = sourceCanvas;
  const steps = Math.log2(factor);

  for (let i = 0; i < steps; i++) {
    const next = new OffscreenCanvas(current.width * 2, current.height * 2);
    const ctx = next.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }

  return current;
}

export function applySharpen(imageData: ImageData, level: number): ImageData {
  if (level === 0) return imageData;

  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  // Sharpen kernel: [0,-1,0,-1,5,-1,0,-1,0]
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const t = level / 10;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      let r = 0, g = 0, b = 0;
      let ki = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pidx = ((y + ky) * width + (x + kx)) * 4;
          r += data[pidx] * kernel[ki];
          g += data[pidx + 1] * kernel[ki];
          b += data[pidx + 2] * kernel[ki];
          ki++;
        }
      }

      output[idx] = Math.min(255, Math.max(0, data[idx] * (1 - t) + r * t));
      output[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] * (1 - t) + g * t));
      output[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] * (1 - t) + b * t));
      output[idx + 3] = data[idx + 3];
    }
  }

  // Copy edge pixels unchanged
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        const idx = (y * width + x) * 4;
        output[idx] = data[idx];
        output[idx + 1] = data[idx + 1];
        output[idx + 2] = data[idx + 2];
        output[idx + 3] = data[idx + 3];
      }
    }
  }

  return new ImageData(output, width, height);
}

export function applyBrightnessContrast(
  imageData: ImageData,
  brightness: number,
  contrast: number
): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const contrastFactor = 1 + contrast / 100;

  for (let i = 0; i < data.length; i += 4) {
    output[i] = Math.min(255, Math.max(0, data[i] * contrastFactor + brightness));
    output[i + 1] = Math.min(255, Math.max(0, data[i + 1] * contrastFactor + brightness));
    output[i + 2] = Math.min(255, Math.max(0, data[i + 2] * contrastFactor + brightness));
    output[i + 3] = data[i + 3];
  }

  return new ImageData(output, width, height);
}

export function applyGaussianBlur(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kernelSum = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      let r = 0, g = 0, b = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pidx = ((y + ky) * width + (x + kx)) * 4;
          r += data[pidx] * kernel[ki];
          g += data[pidx + 1] * kernel[ki];
          b += data[pidx + 2] * kernel[ki];
          ki++;
        }
      }
      output[idx] = r / kernelSum;
      output[idx + 1] = g / kernelSum;
      output[idx + 2] = b / kernelSum;
      output[idx + 3] = data[idx + 3];
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        const idx = (y * width + x) * 4;
        output[idx] = data[idx];
        output[idx + 1] = data[idx + 1];
        output[idx + 2] = data[idx + 2];
        output[idx + 3] = data[idx + 3];
      }
    }
  }
  return new ImageData(output, width, height);
}

// Multi-pass Gaussian for stronger denoising
export function applyGaussianBlurN(imageData: ImageData, passes: number): ImageData {
  let result = imageData;
  for (let i = 0; i < passes; i++) result = applyGaussianBlur(result);
  return result;
}

// Unsharp mask: sharpen = original + amount * (original - blurred)
// Applies at original resolution so it stays visible at any display size.
export function applyUnsharpMask(
  imageData: ImageData,
  amount: number,
  blurPasses: number,
  threshold: number
): ImageData {
  if (amount <= 0) return imageData;
  const blurred = applyGaussianBlurN(imageData, blurPasses);
  const { data, width, height } = imageData;
  const bd = blurred.data;
  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = data[i + c] - bd[i + c];
      if (Math.abs(diff) >= threshold) {
        output[i + c] = Math.min(255, Math.max(0, data[i + c] + amount * diff));
      } else {
        output[i + c] = data[i + c];
      }
    }
    output[i + 3] = data[i + 3];
  }
  return new ImageData(output, width, height);
}

export function imageDataToOffscreenCanvas(imageData: ImageData): OffscreenCanvas {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function offscreenCanvasToImageData(canvas: OffscreenCanvas): ImageData {
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
