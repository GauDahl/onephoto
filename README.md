# OnePhoto

**One photo in — every version out.**

Upload one photograph → OnePhoto analyses it, detects what kind of photo it is,
applies a restrained, professional-grade enhancement, and generates every
purpose-specific version you need (Portrait, Instagram, LinkedIn, Wallpaper,
Print, Cinematic, Night/City, Black & White…). All of it happens **locally in
your browser** — no server, no uploads, no account.

![Status](https://img.shields.io/badge/status-working%20local%20app-5fbf77)
![Stack](https://img.shields.io/badge/stack-React%20%C2%B7%20TypeScript%20%C2%B7%20Vite-d9a441)
![Privacy](https://img.shields.io/badge/privacy-photos%20stay%20on%20device-0d0e11)

---

## ✨ Features

| Area | What it does |
| --- | --- |
| **Auto analysis** | Estimates brightness, exposure, contrast, saturation, white balance, highlights/shadows, sharpness, noise, dynamic range, dominant colours, orientation, skin-tone ratio — then classifies the photo (Portrait, Landscape, Night, City, Food, Sunset, …) with a confidence score. |
| **Professional auto-edit** | A real pixel engine (not CSS filters): exposure, brightness, contrast, highlights, shadows, whites, blacks, temperature, tint, saturation, vibrance, clarity, sharpness, edge-preserving noise reduction, vignette, fade, grain, crop, rotate/resize on export. |
| **Purpose presets** | Professional, Portrait, Instagram (4:5), LinkedIn (1:1), Wallpaper (9:16), Print, Cinematic, Night/City, Black & White — and **“Look Expensive”**, the most restrained mode of all. |
| **Smart crop** | Saliency-based intelligent cropping for 1:1, 4:5, 3:4, 4:3, 16:9, 9:16, with an upper-third bias for portrait crops (documented fallback instead of face detection). |
| **Before / After** | Draggable comparison divider, wheel zoom, pan, touch support, plus a simple *Original \| Edited* toggle. |
| **Manual editor** | All 15+ sliders with numeric readouts, Reset, Undo/Redo, hold-to-compare, Auto, save/load custom presets (localStorage). |
| **Batch mode** | Drop many photos, each is analysed individually (or force one treatment), processed in a Web Worker, previewed, and exported as a **ZIP**. One failed image never stops the batch. |
| **Export** | JPG / PNG / WebP (with graceful fallback), quality presets (High / Medium / Web), output-size control, never overwrites your original. |
| **Privacy** | 100% local processing. Your photos stay on your device unless *you* explicitly configure an external AI service. |
| **Theming** | Premium dark UI + light mode, responsive from phones to large monitors. |

> **Honesty note:** the built-in analysis is transparent, rule-based computer
> vision (statistics + heuristics). It is **not** marketed as “AI”. An optional
> AI provider layer exists (see below) if you want to add learned models later.

## 📸 Screenshots

_Placeholders — add your own after first run:_

| Upload | Analysis + Versions | Compare + Fine-tune |
| --- | --- | --- |
| `docs/screens/upload.png` | `docs/screens/workspace.png` | `docs/screens/compare.png` |

## 🚀 Quick start

```bash
# 1. Clone
git clone https://github.com/<you>/onephoto.git
cd onephoto

# 2. Install (Node 18+)
npm install

# 3. Run locally
npm run dev        # http://localhost:5173

# 4. Tests
npm test

# 5. Production build
npm run build      # outputs dist/
npm run preview    # serve the production build locally
```

## 🌐 Deployment

### GitHub Pages — automatic (recommended)

The repo includes `.github/workflows/deploy.yml`.

1. Push this repo to GitHub (`main` branch).
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` runs tests, builds, and deploys.

### GitHub Pages — manual

```bash
npm run deploy     # builds and pushes dist/ to the gh-pages branch
# Then set Settings → Pages → Source: Deploy from a branch → gh-pages
```

The Vite `base` is set to `./`, so the app also works on project pages
(`https://<you>.github.io/onephoto/`) and when installed as a home-screen app
on iPad/iPhone/Android (see `public/manifest.webmanifest`).

## 🧠 Optional AI configuration

The app works **without any configuration**. The AI layer is an abstraction,
not a dependency:

```
src/ai/providers.ts
  ImageAnalysisProvider      // e.g. true face detection, semantic tags
  ImageEnhancementProvider   // e.g. learned enhancement models
```

| Question | Answer |
| --- | --- |
| What would it add? | True face-aware cropping, semantic categories, learned enhancement beyond the local engine. |
| Why is it optional? | Local heuristics already cover analysis + editing well enough for a shipping product. |
| Where does the key go? | **Server-side only.** A backend you control proxies the provider. `VITE_AI_API_KEY` exists solely for local experiments. |
| How to configure | Copy `.env.example` → `.env`, set `VITE_AI_PROVIDER=http` plus your endpoint URLs. See `src/ai/providers.ts`. |
| Estimated cost | Entirely up to your provider (OpenAI, Replicate, …). The app itself makes zero calls by default. |
| Privacy impact | Images would leave the device **only** when the provider is enabled — the UI states the local default everywhere. |

## 🏗 Architecture

Clean separation: **pure processing** (testable, worker-capable, DOM-free) vs
**browser glue** (canvas, downloads) vs **UI** (React components).

```
src/
├── analysis/          # pure computer vision
│   ├── analyzer.ts        # statistics + rule-based classification
│   ├── color.ts           # colour math helpers
│   └── analyzer.test.ts
├── editor/            # pure edit engine (no DOM)
│   ├── engine.ts          # pixel pipeline: tone, colour, clarity, NR, vignette, grain
│   ├── crop.ts            # saliency smart-crop + ratio math
│   ├── engine.test.ts
│   └── crop.test.ts
├── presets/           # analysis-driven preset recipes
│   └── presets.ts         # autoBase() + per-mode grades + merge helpers
├── export/            # canvas → JPG/PNG/WebP, ZIP (fflate)
│   ├── exporter.ts
│   └── exporter.test.ts
├── ai/
│   └── providers.ts       # optional provider abstraction (defaults to local)
├── worker/
│   └── process.worker.ts  # batch pipeline off the main thread
├── hooks/
│   └── usePhotoEditor.ts  # load → analyse → preset → manual → history → export
├── components/        # UploadZone, CompareSlider, AnalysisPanel, ModeStrip,
│                      # ManualEditor, ExportPanel, BatchPanel
├── utils/             # canvas helpers, friendly error mapping
└── types/             # shared domain types (ImageDataLike is DOM-free)
```

**Why it stays fast on large photos:** previews render at ≤1600 px; the
original full-resolution pixels are kept only for final export, where the
*same pure pipeline* re-runs once. Batch mode runs inside a Web Worker with
transferred buffers, so the UI never blocks and memory is released promptly.

## 🔒 Privacy

- All analysis and enhancement runs locally in your browser.
- No photo is ever uploaded, stored, or sent anywhere by default.
- Nothing persists except your own saved presets and theme choice
  (localStorage, on your device).
- The footer and UI say so explicitly — “Your photos stay on your device
  unless an optional external AI service is enabled.”

## ⚠️ Limitations (honest list)

- Face *presence* is inferred from skin-tone heuristics, not true detection;
  portrait crop bias uses composition rules instead of face landmarks.
- Noise reduction and sharpening are classical DSP, not learned models —
  extreme high-ISO images have a ceiling on what they can recover.
- Browser memory caps the practical input size (roughly < 50 MP); enormous
  images get a friendly error, not a crash.
- WebP export falls back to JPG on browsers without support.
- The analyzer can be fooled (a warm indoor scene may read as “sunset”);
  every automatic decision can be overridden manually.

## 🗺 Roadmap

- [ ] Face detection via the Shape Detection API where available (provider slot exists)
- [ ] Horizon / straighten detection for the “Look Expensive” crop step
- [ ] Histogram and curves view in the manual editor
- [ ] Per-version batch export (one ZIP with every mode per photo)
- [ ] PWA offline caching + share-target (“Share to OnePhoto” on mobile)
- [ ] Optional self-hostable backend example (FastAPI) for the AI providers

## 🧪 Testing

```bash
npm test        # vitest — engine, analyzer, crop, exporter helpers
```

Tests cover: preset/engine math (exposure, contrast, identity, vignette,
white balance, monochrome conversion, tonal masks), analysis heuristics
(night, portrait, landscape detection, WB estimation), crop calculations,
and export naming/quality logic. UI behaviour is kept thin and delegated to
these tested pure functions.

## 📄 License

MIT — see [LICENSE](LICENSE). Built with React, TypeScript and Vite.
