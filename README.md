# SnapConverter-GTAV

> Convert GTA V Snapmatic photos to JPEG — locally, instantly, privately. No upload required.

**SnapConverter-GTAV** is a browser-based tool that extracts embedded JPEG data from GTA V Snapmatic binary files and applies AI-style image enhancement — all 100% client-side with zero server uploads.

---

## Features

- **Snapmatic → JPEG conversion** — reads GTA V Snapmatic binary format and extracts the embedded JPEG
- **Batch processing** — drop multiple files at once, converts up to 5 files concurrently
- **JPEG deblocking** — removes DCT block artifacts (the "interlaced grid" look from GTA V compression)
- **AI-style enhancement** powered by Web Workers + OffscreenCanvas:
  - Upscale 1× / 2× / 4× / 8× using progressive bicubic interpolation
  - Sharpen via Unsharp Masking (industry-standard, 10 levels)
  - Brightness / Contrast sliders (−50 to +50)
  - Deblock + Denoise (JPEG artifact removal without over-smoothing)
- **Enhancement presets**: Original · Cinematic · Vivid · Clean
- **Before / After slider** — drag to compare original vs enhanced
- **Batch ZIP download** — download all converted files as a `.zip`
- **Privacy first** — zero network requests, runs entirely in your browser

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
| Batch Download | JSZip |
| Fonts | Space Mono · DM Sans (via `next/font`) |

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

Files are named like `PGTA5xxxxxxxx` with **no file extension**. That is the Snapmatic format.

### Converting

1. Open the app at `localhost:3000`
2. Drag your Snapmatic file(s) onto the drop zone, or click to browse
3. Files are converted instantly — the original JPEG is extracted from the binary
4. Use the **Before/After slider** to compare the result

### Enhancing

Use the **Enhancement Panel** on the right side:

| Preset | Effect |
|---|---|
| **Original** | No processing — raw converted JPEG |
| **Cinematic** | High contrast, slight desaturation, sharp |
| **Vivid** | Boosted saturation, strong sharpening |
| **Clean** | JPEG deblocking + denoise + upscale 2× |

Or expand **Manual controls** to fine-tune:
- **Upscale** — enlarges the image using progressive step-upscaling
- **Sharpen** — Unsharp Masking at original resolution (stays proportional at any size)
- **Brightness / Contrast** — pixel-level adjustments
- **Deblock + Denoise** — JPEG-specific deblocking filter targeting 8×8 DCT boundaries, followed by a tight bilateral filter. Does not over-smooth — real edges and shading are preserved.

### Downloading

- **Single file** → saved as `filename_enhanced.jpg` (JPEG, 95% quality)
- **Multiple files** → downloaded as `snapconvert_batch.zip`

---

## How It Works

### Snapmatic Format

GTA V Snapmatic files are binary files that contain an embedded standard JPEG. The conversion scans for the JPEG magic bytes (`FF D8 FF`) and end-of-image marker (`FF D9`) and slices the JPEG out directly.

```
[Snapmatic binary header] [FF D8 FF ... JPEG data ... FF D9] [trailing data]
```

Reference: [gta-snap-to-jpg](https://github.com/smtchahal/gta-snap-to-jpg)

### Enhancement Pipeline

All processing runs in a **Web Worker** so the UI never freezes:

```
Input JPEG
  → [if Deblock+Denoise]
      → JPEG Deblock    (smooth 8×8 block boundaries, skip real edges)
      → Bilateral Filter (colorSigma=10, only blends near-identical pixels)
      → Micro-contrast restore (light Unsharp Mask)
  → [if Sharpen > 0]
      → Unsharp Mask at original resolution
  → [if Upscale > 1×]
      → Progressive 2× step upscaling (imageSmoothingQuality: high)
  → [Brightness / Contrast]
  → [Saturation]
  → Output JPEG (95% quality)
```

**Why JPEG deblocking looks natural:**
- Standard filters blur everything equally → "makeup" effect
- This deblocking only touches pixels *at* the 8-pixel boundaries where compression artifacts live
- Pixels with color difference > 22 intensity units are treated as real edges and skipped entirely

---

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout + font loading
│   ├── page.tsx            # Single-page app with GSAP Flip transitions
│   └── globals.css         # Design tokens, scanline overlay, custom cursor
├── components/
│   ├── Hero.tsx            # Landing hero with GSAP entrance animation
│   ├── DropZone.tsx        # Drag-drop with GSAP hover glow
│   ├── ConversionPanel.tsx # Preview + controls layout
│   ├── EnhancementPanel.tsx# Preset buttons + manual sliders
│   ├── BeforeAfter.tsx     # GSAP Draggable comparison slider
│   ├── ProgressBar.tsx     # GSAP-animated progress + counter
│   ├── DownloadButton.tsx  # Download with SVG checkmark animation
│   └── Navbar.tsx
├── lib/
│   ├── snapmatic.ts        # Core JPEG extraction from Snapmatic binary
│   ├── imageUtils.ts       # Canvas helpers: bilateral, deblock, unsharp mask, upscale
│   └── enhance.ts          # Web Worker singleton wrapper
├── workers/
│   └── enhance.worker.ts   # OffscreenCanvas image processing pipeline
└── hooks/
    ├── useFileProcessor.ts # State machine: idle → converting → preview → result
    └── useGSAP.ts          # GSAP context + cleanup hook
```

---

## Development Notes

- All image processing is client-side — no server, no API keys, no data leaves the browser
- Web Worker prevents UI thread blocking during heavy operations (bilateral filter ~2–4s for 960×536)
- Object URLs are revoked after use to prevent memory leaks
- GSAP animations are cleaned up via `gsap.context().revert()` on unmount

---

## Deployment

This app deploys to **Vercel** with zero configuration:

```bash
npx vercel
```

Or connect your GitHub repo to Vercel for automatic deployments on push.

For **GitHub Pages**, the app requires Node.js server capabilities (Next.js SSR), so use Vercel or Railway instead.

---

## License

MIT — do whatever you want with it.

---

*Built with Next.js 14 · Inspired by [gta-snap-to-jpg](https://github.com/smtchahal/gta-snap-to-jpg)*
