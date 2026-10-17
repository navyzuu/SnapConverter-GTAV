// Cross-runtime ImageData factory (browser DOM, Web Worker, and Node.js unit tests)
export function createImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(new Uint8ClampedArray(data.buffer as ArrayBuffer, data.byteOffset, data.length), width, height);
  }
  return { data, width, height, colorSpace: 'srgb' } as unknown as ImageData;
}

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

  return createImageData(out, width, height);
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
  return createImageData(output, width, height);
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

  return createImageData(output, width, height);
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

  return createImageData(output, width, height);
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
  return createImageData(output, width, height);
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
  return createImageData(output, width, height);
}

// Luminance-preserving High-Pass Texture Clarity filter.
// Operates strictly on luminance to prevent chroma ringing / color drift.
// Enhances micro-textures (asphalt, reflections, metallic paint, fabric, skin grain)
// without smoothing or generating cartoon-like flat surfaces.
export function applyLuminanceSharpen(
  imageData: ImageData,
  amount: number,
  radius: number = 1
): ImageData {
  if (amount <= 0) return imageData;
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);

  // 1. Extract luminance map
  const lum = new Float32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    lum[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 2. Separable box blur for high-pass baseline
  const blurredH = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          sum += lum[rowOffset + nx];
          count++;
        }
      }
      blurredH[rowOffset + x] = sum / count;
    }
  }

  const blurredV = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          sum += blurredH[ny * width + x];
          count++;
        }
      }
      blurredV[y * width + x] = sum / count;
    }
  }

  // 3. High-pass differential sharpening
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const origL = lum[j];
    const diff = origL - blurredV[j];

    // Filter out subtle noise floor (< 1.5) but sharpen distinct edges and micro-textures
    if (Math.abs(diff) >= 1.5) {
      const delta = diff * amount;
      output[i]     = Math.min(255, Math.max(0, data[i]     + delta));
      output[i + 1] = Math.min(255, Math.max(0, data[i + 1] + delta));
      output[i + 2] = Math.min(255, Math.max(0, data[i + 2] + delta));
    }
  }

  return createImageData(output, width, height);
}

// AMD FidelityFX Robust Contrast Adaptive Sharpening (RCAS).
// Standard game-engine spatial reconstruction filter (MIT License / AMD).
// Analyzes 5-tap neighborhood (Center, North, South, West, East),
// bounds sharpening to local contrast limits, and employs a noise detector
// to avoid noise amplification. Does NOT alter color, does NOT hallucinate pixels,
// and does NOT smear or smooth faces/textures into cartoon plastic.
export function applyFSR_RCAS(imageData: ImageData, sharpness: number = 0.8): ImageData {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);
  const FSR_RCAS_LIMIT = 0.1875; // AMD FSR 1.0 limit

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    const upOffset = (y - 1) * width;
    const downOffset = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const ci = (rowOffset + x) * 4;
      const bi = (upOffset + x) * 4;
      const di = (rowOffset + (x - 1)) * 4;
      const fi = (rowOffset + (x + 1)) * 4;
      const hi = (downOffset + x) * 4;

      const eR = data[ci] / 255,   eG = data[ci + 1] / 255,   eB = data[ci + 2] / 255;
      const bR = data[bi] / 255,   bG = data[bi + 1] / 255,   bB = data[bi + 2] / 255;
      const dR = data[di] / 255,   dG = data[di + 1] / 255,   dB = data[di + 2] / 255;
      const fR = data[fi] / 255,   fG = data[fi + 1] / 255,   fB = data[fi + 2] / 255;
      const hR = data[hi] / 255,   hG = data[hi + 1] / 255,   hB = data[hi + 2] / 255;

      // Luma
      const bL = bB * 0.5 + (bR * 0.5 + bG);
      const dL = dB * 0.5 + (dR * 0.5 + dG);
      const eL = eB * 0.5 + (eR * 0.5 + eG);
      const fL = fB * 0.5 + (fR * 0.5 + fG);
      const hL = hB * 0.5 + (hR * 0.5 + hG);

      // Noise detection
      let nz = 0.25 * bL + 0.25 * dL + 0.25 * fL + 0.25 * hL - eL;
      const maxL = Math.max(bL, dL, eL, fL, hL);
      const minL = Math.min(bL, dL, eL, fL, hL);
      const diffL = maxL - minL;
      if (diffL > 0.0001) {
        nz = Math.min(1.0, Math.max(0.0, Math.abs(nz) / diffL));
        nz = -0.5 * nz + 1.0;
      } else {
        nz = 1.0;
      }

      // Min & max of 4 ring neighbors
      const mn4R = Math.min(bR, dR, fR, hR);
      const mn4G = Math.min(bG, dG, fG, hG);
      const mn4B = Math.min(bB, dB, fB, hB);
      const mx4R = Math.max(bR, dR, fR, hR);
      const mx4G = Math.max(bG, dG, fG, hG);
      const mx4B = Math.max(bB, dB, fB, hB);

      // Limiters (prevent ringing and halos)
      const hitMinR = mx4R > 0.0001 ? Math.min(mn4R, eR) / (4.0 * mx4R) : 0;
      const hitMinG = mx4G > 0.0001 ? Math.min(mn4G, eG) / (4.0 * mx4G) : 0;
      const hitMinB = mx4B > 0.0001 ? Math.min(mn4B, eB) / (4.0 * mx4B) : 0;

      const hitMaxR = (1.0 - Math.max(mx4R, eR)) / Math.max(0.0001, 4.0 * (1.0 - mn4R));
      const hitMaxG = (1.0 - Math.max(mx4G, eG)) / Math.max(0.0001, 4.0 * (1.0 - mn4G));
      const hitMaxB = (1.0 - Math.max(mx4B, eB)) / Math.max(0.0001, 4.0 * (1.0 - mn4B));

      const lobeR = Math.max(-hitMinR, -hitMaxR);
      const lobeG = Math.max(-hitMinG, -hitMaxG);
      const lobeB = Math.max(-hitMinB, -hitMaxB);

      let lobe = Math.max(-FSR_RCAS_LIMIT, Math.min(Math.max(lobeR, lobeG, lobeB), 0.0)) * sharpness;
      lobe *= nz;

      const rcpL = 1.0 / (4.0 * lobe + 1.0);
      output[ci]     = Math.min(255, Math.max(0, Math.round(((lobe * (bR + dR + hR + fR) + eR) * rcpL) * 255)));
      output[ci + 1] = Math.min(255, Math.max(0, Math.round(((lobe * (bG + dG + hG + fG) + eG) * rcpL) * 255)));
      output[ci + 2] = Math.min(255, Math.max(0, Math.round(((lobe * (bB + dB + hB + fB) + eB) * rcpL) * 255)));
    }
  }

  return createImageData(output, width, height);
}

// GTA V RAGE Engine Specular Clearcoat & Metallic Micro-Roughness.
// Restores automotive clearcoat reflection falloff (Fresnel specular highlights)
// and metallic flake micro-grain that prevents vehicles from looking like flat sanded primer.
export function applyGTAMetallicSpecular(
  imageData: ImageData,
  glossLevel: number = 0, // 0 - 100
  grainLevel: number = 0  // 0 - 100
): ImageData {
  if (glossLevel <= 0 && grainLevel <= 0) return imageData;
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);

  const glossFactor = glossLevel / 100;
  const grainFactor = (grainLevel / 100) * 14;

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // 1. Specular highlight curve: boosts reflections on car curves, metallic edges, and light sources
    let specularDelta = 0;
    if (glossFactor > 0 && luma > 0.18) {
      const normLuma = (luma - 0.18) / 0.82;
      specularDelta = Math.pow(normLuma, 1.8) * 55 * glossFactor;
    }

    // 2. Metallic micro-grain (RAGE vehicle clear-coat flakes)
    // Applied in midtones to restore physical vehicle texture
    let grainDelta = 0;
    if (grainFactor > 0 && luma > 0.08 && luma < 0.94) {
      const midtoneWeight = Math.sin(luma * Math.PI);
      const flake = (rand() - 0.5) * 2;
      grainDelta = flake * grainFactor * midtoneWeight;
    }

    const netDelta = specularDelta + grainDelta;
    if (netDelta !== 0) {
      output[i]     = Math.min(255, Math.max(0, Math.round(r + netDelta)));
      output[i + 1] = Math.min(255, Math.max(0, Math.round(g + netDelta)));
      output[i + 2] = Math.min(255, Math.max(0, Math.round(b + netDelta)));
    }
  }

  return createImageData(output, width, height);
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
