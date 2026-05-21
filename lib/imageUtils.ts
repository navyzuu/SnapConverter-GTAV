// JPEG DCT deblocking: targets 8x8 block boundaries with a 4-pixel-wide smooth band.
// Pixels closer to the boundary get stronger smoothing; real edges (diff >= 28) are skipped.
export function applyJpegDeblock(imageData: ImageData, strength: number): ImageData {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data);
  const T = 28; // edge threshold — GTA V artifacts are typically <20, real edges are 30+

  // Horizontal boundaries (every 8 rows)
  for (let bY = 8; bY < height; bY += 8) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        // Check discontinuity exactly at the block seam
        if (Math.abs(
          data[((bY - 1) * width + x) * 4 + c] -
          data[(bY * width + x) * 4 + c]
        ) >= T) continue;

        // Smooth 4 rows: [bY-2, bY-1, bY, bY+1] with weights [0.3, 0.7, 0.7, 0.3]
        const offsets = [-2, -1, 0, 1];
        const ws      = [0.3, 0.7, 0.7, 0.3];
        for (let i = 0; i < 4; i++) {
          const row = bY + offsets[i];
          if (row < 1 || row >= height - 1) continue;
          const ci = (row * width + x) * 4 + c;
          const pi = ((row - 1) * width + x) * 4 + c;
          const ni = ((row + 1) * width + x) * 4 + c;
          const t = strength * ws[i];
          out[ci] = Math.round(data[ci] * (1 - t) + (data[pi] + data[ci] + data[ni]) / 3 * t);
        }
      }
    }
  }

  // Vertical boundaries (every 8 cols) — reads from out so horizontal pass is preserved
  for (let bX = 8; bX < width; bX += 8) {
    for (let y = 0; y < height; y++) {
      for (let c = 0; c < 3; c++) {
        if (Math.abs(
          out[(y * width + bX - 1) * 4 + c] -
          out[(y * width + bX) * 4 + c]
        ) >= T) continue;

        const offsets = [-2, -1, 0, 1];
        const ws      = [0.3, 0.7, 0.7, 0.3];
        for (let i = 0; i < 4; i++) {
          const col = bX + offsets[i];
          if (col < 1 || col >= width - 1) continue;
          const ci = (y * width + col) * 4 + c;
          const pi = (y * width + col - 1) * 4 + c;
          const ni = (y * width + col + 1) * 4 + c;
          const t = strength * ws[i];
          out[ci] = Math.round(out[ci] * (1 - t) + (out[pi] + out[ci] + out[ni]) / 3 * t);
        }
      }
    }
  }

  return new ImageData(out, width, height);
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

// Diagonal anti-aliasing via Sobel gradient angle detection.
//
// For each pixel, computes the luminance Sobel gradient direction:
//   - Flat (mag < 15): skip — no edge here.
//   - Near-horizontal (angle 75°–105°) or near-vertical (0°–15°, 165°–180°): skip —
//     these are clean straight edges that should stay sharp.
//   - Diagonal zone (15°–75° and 105°–165°): apply Gaussian 3×3 at `strength` —
//     this is where staircase aliasing from GTA V's low-res rendering lives.
//
// Result: staircase steps on diagonal lines are softened; horizontal/vertical edges
// and flat regions are completely untouched.
export function applyDiagonalSmooth(imageData: ImageData, strength: number = 0.5): ImageData {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const ci = (y * width + x) * 4;

      const tlI = ((y-1)*width+(x-1))*4, tcI = ((y-1)*width+x)*4, trI = ((y-1)*width+(x+1))*4;
      const mlI = (y*width+(x-1))*4,                               mrI = (y*width+(x+1))*4;
      const blI = ((y+1)*width+(x-1))*4, bcI = ((y+1)*width+x)*4, brI = ((y+1)*width+(x+1))*4;

      const L = (i: number) => 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      const tl = L(tlI), tc = L(tcI), tr = L(trI);
      const ml = L(mlI),               mr = L(mrI);
      const bl = L(blI), bc = L(bcI), br = L(brI);

      const gx = (tr + 2*mr + br) - (tl + 2*ml + bl);
      const gy = (bl + 2*bc + br) - (tl + 2*tc + tr);
      const mag = Math.sqrt(gx*gx + gy*gy);

      if (mag < 15) continue;

      const angle = Math.abs(Math.atan2(gy, gx) * 180 / Math.PI);
      // Keep clean horizontal and vertical edges sharp; smooth everything in between.
      if ((angle >= 75 && angle <= 105) || angle <= 15 || angle >= 165) continue;

      for (let c = 0; c < 3; c++) {
        const v = data[ci + c];
        const blur = (
          data[tlI+c] + 2*data[tcI+c] + data[trI+c] +
          2*data[mlI+c] + 4*v + 2*data[mrI+c] +
          data[blI+c] + 2*data[bcI+c] + data[brI+c]
        ) / 16;
        out[ci + c] = Math.round(v * (1 - strength) + blur * strength);
      }
    }
  }

  return new ImageData(out, width, height);
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
