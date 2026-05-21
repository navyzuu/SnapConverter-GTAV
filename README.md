# SnapConverter-GTAV

Convert GTA V Snapmatic photos to JPEG, locally and privately. No upload required.

**SnapConverter-GTAV** is a browser-based tool that extracts the embedded JPEG from GTA V Snapmatic binary files and lets you enhance the result with filters, upscaling, and AI super-resolution. Everything runs 100% client-side, nothing leaves your browser.

---

## Features

- **Snapmatic to JPEG conversion** - reads the Snapmatic binary and pulls out the embedded JPEG directly
- **Batch processing** - drop multiple files at once, converts up to 5 files concurrently
- **AI upscaling (4x)** - Real-ESRGAN anime video model runs fully in-browser via ONNX Runtime Web, eliminates staircase aliasing and block artifacts
- **Canvas upscaling** - 1x / 2x / 4x / 8x using progressive step-upscaling (fast, no model download)
- **Image enhancement** powered by Web Workers + OffscreenCanvas:
  - Sharpen via Unsharp Masking (10 levels)
  - Brightness and Contrast sliders (-50 to +50)
  - Deblock + Denoise (removes JPEG artifacts without over-smoothing)
  - Saturation control
- **Enhancement presets**: Original, Cinematic, Vivid, Clean
- **Before/After slider** - drag to compare original vs enhanced
- **Batch ZIP download** - download all converted files as a single `.zip`
- **Privacy first** - zero network requests after model download, runs entirely in your browser

---

## Preview

| Drop Zone | Conversion + Enhancement |
|---|---|
| Drop Snapmatic files or click to browse | Adjust presets, compare before/after, download |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript strict) |
| Styling | Tailwind CSS v3 + CSS custom properties |
| Animation | GSAP 3 (Flip, Draggable, ScrollTrigger) |
| Image Processing | Canvas API + OffscreenCanvas (Web Worker) |
| AI Inference | ONNX Runtime Web (WASM, multi-threaded) |
| AI Model | Real-ESRGAN animevideov3 (2.4MB ONNX) |
| Batch Download | JSZip |
| Fonts | Space Mono, DM Sans (via `next/font`) |

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/navyzuu/SnapConverter-GTAV.git
cd SnapConverter-GTAV

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production

```bash
npm run build
npm run start
```

### Type checking

```bash
npm run type-check
```

---

## Usage

### Finding your Snapmatic files

GTA V stores Snapmatic photos in your Documents folder:

```
Documents\Rockstar Games\GTA V\Profiles\<your-profile-id>\
```

Files are named like `PGTA5xxxxxxxx` with **no file extension**. That's the Snapmatic format.

### Converting

1. Open the app at `localhost:3000`
2. Drag your Snapmatic file(s) onto the drop zone, or click to browse
3. The original JPEG gets extracted from the binary instantly
4. Use the Before/After slider to compare the result

### Enhancing

Use the Enhancement Panel on the right side:

| Preset | Effect |
|---|---|
| **Original** | No processing, raw converted JPEG |
| **Cinematic** | High contrast, slight desaturation, sharp |
| **Vivid** | Boosted saturation, strong sharpening |
| **Clean** | JPEG deblocking + denoise + upscale 2x |

Or expand **Manual controls** to fine-tune:
- **AI 4x** - runs Real-ESRGAN animevideov3 fully in-browser. First run downloads and caches the model (~2.4MB). Subsequent runs load from IndexedDB with no re-download.
- **Upscale 1x-8x** - progressive step-upscaling via Canvas API, fast with no model required
- **Sharpen** - Unsharp Masking applied at original resolution so it stays sharp at any size
- **Brightness / Contrast** - pixel-level adjustments
- **Deblock + Denoise** - targets 8x8 DCT block boundaries. Does not blur the whole image, only smooths where compression artifacts are detected.

### Downloading

- Single file: saved as `filename_enhanced.jpg` (JPEG, 95% quality)
- Multiple files: downloaded as `snapconvert_batch.zip`

---

## How It Works

### Snapmatic Format

GTA V Snapmatic files are binary files with an embedded standard JPEG inside. The conversion scans for the JPEG magic bytes (`FF D8 FF`) and the end-of-image marker (`FF D9`) then slices out just the JPEG data.

```
[Snapmatic binary header] [FF D8 FF ... JPEG data ... FF D9] [trailing data]
```

Reference: [gta-snap-to-jpg](https://github.com/smtchahal/gta-snap-to-jpg)

### Enhancement Pipeline

All processing runs in a Web Worker so the UI stays responsive.

**Canvas path (1x/2x/4x/8x):**

```
Input JPEG
  -> [if Deblock+Denoise]  JPEG Deblock + Bilateral Filter
  -> [if Sharpen > 0]      Unsharp Mask
  -> [if Upscale > 1x]     Progressive 2x step upscaling
  -> Brightness / Contrast / Saturation
  -> Output JPEG (95% quality)
```

**AI path (AI 4x):**

```
Input JPEG
  -> ESRGAN Worker: tiled 4x upscale via Real-ESRGAN animevideov3 ONNX
      (256x256 tiles, 16px overlap to hide seam artifacts)
  -> Canvas Worker: Sharpen / Brightness / Contrast / Saturation at upscale=1
  -> Output JPEG (95% quality)
```

The AI model runs in a dedicated Web Worker using ONNX Runtime Web (WASM backend, multi-threaded via SharedArrayBuffer). The model is cached in IndexedDB after the first download.

### AI Model

The bundled model is [realesr-animevideov3](https://github.com/xinntao/Real-ESRGAN) by xinntao, converted from PyTorch to ONNX. It uses the `SRVGGNetCompact` architecture (16 conv layers, 64 features) and is specifically trained for game and animation content - it removes staircase aliasing and block artifacts while keeping edges sharp.

---

## Project Structure

```
app/
  layout.tsx            # Root layout + font loading
  page.tsx              # Single-page app with GSAP Flip transitions
  globals.css           # Design tokens, scanline overlay, custom cursor
components/
  Hero.tsx              # Landing hero with GSAP entrance animation
  DropZone.tsx          # Drag-drop with GSAP hover glow
  ConversionPanel.tsx   # Preview + controls layout
  EnhancementPanel.tsx  # Preset buttons + manual sliders + AI 4x option
  BeforeAfter.tsx       # GSAP Draggable comparison slider
  ProgressBar.tsx       # GSAP-animated progress + counter
  DownloadButton.tsx    # Download with SVG checkmark animation
  Navbar.tsx
lib/
  snapmatic.ts          # Core JPEG extraction from Snapmatic binary
  imageUtils.ts         # Canvas helpers: bilateral, deblock, unsharp mask, upscale
  enhance.ts            # Canvas Web Worker singleton wrapper
  esrgan.ts             # ESRGAN Web Worker singleton wrapper
workers/
  enhance.worker.ts     # OffscreenCanvas image processing pipeline
  esrgan.worker.ts      # ONNX Runtime Web inference with tiled processing
public/
  models/
    realesrgan-anime-4x.onnx   # Real-ESRGAN animevideov3 (2.4MB)
  onnx/
    ort-wasm-simd-threaded.*   # ONNX Runtime WASM + MJS sidecar files
hooks/
  useFileProcessor.ts   # State machine: idle -> converting -> preview -> result
  useGSAP.ts            # GSAP context + cleanup hook
```

---

## Notes

- All image processing is client-side, no server, no API keys, nothing leaves the browser
- COOP/COEP headers are set in `next.config.js` to enable SharedArrayBuffer for multi-threaded WASM inference
- Web Worker prevents the UI from freezing during heavy processing
- The AI model is cached in IndexedDB after the first run, subsequent uses are instant
- Object URLs are revoked after use to prevent memory leaks
- GSAP animations are cleaned up via `gsap.context().revert()` on unmount

---

## Deployment

Deploys to Vercel with zero configuration:

```bash
npx vercel
```

Or connect the GitHub repo to Vercel for automatic deployments on every push.

> **Note:** The COOP/COEP headers required for multi-threaded AI inference must be supported by your hosting provider. Vercel supports custom headers via `next.config.js` out of the box.

Note: GitHub Pages won't work here since Next.js needs a Node.js server. Use Vercel or Railway.

---

## License

MIT, do whatever you want with it.

---

*Built with Next.js 14, inspired by [gta-snap-to-jpg](https://github.com/smtchahal/gta-snap-to-jpg)*
