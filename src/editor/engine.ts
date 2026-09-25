/**
 * OnePhoto professional edit engine.
 *
 * A real pixel-processing engine (not CSS filters): a colour/tone pass,
 * luminance-masked tonal controls, HSL saturation/vibrance, separable-box-blur
 * local contrast (clarity), unsharp masking, an edge-preserving noise
 * reducer, radial vignette and deterministic film grain.
 *
 * Everything is a pure function over ImageDataLike so it runs in the main
 * thread, inside Web Workers, and under vitest in Node.
 */
import type { Adjustments, ImageDataLike } from '../types';
import { clamp, clamp255, smoothstep } from '../analysis/color';

const LUM_R = 0.2126, LUM_G = 0.7152, LUM_B = 0.0722;

/** Separable box blur with a running-sum window (fast enough for large photos). */
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const out = new Float32Array(src.length);
  const tmp = new Float32Array(src.length);
  const norm = 1 / (2 * radius + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * norm;
      acc += src[row + Math.min(w - 1, x + radius + 1)] - src[row + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
    }
  }
  return out;
}

/** Edge-preserving smoothing. Only blends where the local neighbourhood is
 *  flat (|centre - neighbour avg| small), so edges and detail survive. */
function reduceNoiseInPlace(src: ImageDataLike, amount: number): void {
  const a = clamp(amount, 0, 1);
  if (a <= 0.001) return;
  const { width: w, height: h, data: d } = src;
  const copy = new Uint8ClampedArray(d);
  const strength = a * 0.8;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const centre = copy[p + c];
        const avg =
          (copy[p - 4 + c] + copy[p + 4 + c] +
           copy[p - w * 4 + c] + copy[p + w * 4 + c]) * 0.25;
        if (Math.abs(centre - avg) < 40) {
          d[p + c] = centre + (avg - centre) * strength;
        }
      }
    }
  }
}

/** Deterministic per-pixel-per-channel hash noise (stable across renders). */
function hashNoise(i: number, seed: number): number {
  let h = ((i + 1) * 2654435761 + seed * 40503) >>> 0;
  h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13;
  return (h & 0xffff) / 0xffff - 0.5;
}

export function applyAdjustments(source: ImageDataLike, adj: Adjustments): ImageDataLike {
  const w = source.width, h = source.height;
  const n = w * h;

  let src = source;
  if (adj.noiseReduction > 0.001) {
    src = { data: new Uint8ClampedArray(source.data), width: w, height: h };
    reduceNoiseInPlace(src, adj.noiseReduction);
  }

  const data = new Uint8ClampedArray(src.data);
  const out: ImageDataLike = { data, width: w, height: h };

  const tempR = 1 + adj.temperature * 0.12;
  const tempB = 1 - adj.temperature * 0.12;
  const tintG = 1 + adj.tint * 0.1;
  const expMul = Math.pow(2, adj.exposure);
  const brightAdd = adj.brightness * 50;
  const con = Math.max(0.2, 1 + adj.contrast);
  const satMul = Math.max(0, 1 + adj.saturation);
  const fade = clamp(adj.fade, 0, 1);
  const fadeMul = 1 - fade * 0.28;
  const fadeAdd = fade * 34;

  // Pass 1: white balance, exposure, brightness, fade, contrast, tonal masks,
  // saturation & vibrance.
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    let r = data[p], g = data[p + 1], b = data[p + 2];

    r *= tempR; g *= tintG; b *= tempB;
    r *= expMul; g *= expMul; b *= expMul;
    r += brightAdd; g += brightAdd; b += brightAdd;
    r = r * fadeMul + fadeAdd; g = g * fadeMul + fadeAdd; b = b * fadeMul + fadeAdd;
    r = (r - 128) * con + 128;
    g = (g - 128) * con + 128;
    b = (b - 128) * con + 128;

    let lum = (r * LUM_R + g * LUM_G + b * LUM_B) / 255;
    const hl = smoothstep(0.55, 0.95, lum);
    const sh = 1 - smoothstep(0.05, 0.45, lum);
    const tonal =
      adj.highlights * 85 * hl +
      adj.shadows * 65 * sh +
      adj.whites * 55 * smoothstep(0.72, 1.0, lum) +
      adj.blacks * -55 * (1 - smoothstep(0.0, 0.28, lum));
    r += tonal; g += tonal; b += tonal;

    lum = r * LUM_R + g * LUM_G + b * LUM_B;
    // Vibrance protects already-bright tones, so it behaves like a pro tool.
    const vibMul = 1 + adj.vibrance * (1 - smoothstep(0.3, 0.8, lum / 255));
    const m = satMul * vibMul;
    r = lum + (r - lum) * m;
    g = lum + (g - lum) * m;
    b = lum + (b - lum) * m;

    data[p] = clamp255(r);
    data[p + 1] = clamp255(g);
    data[p + 2] = clamp255(b);
  }

  // Pass 2: clarity (local contrast on a mid-radius luminance blur).
  const doClarity = Math.abs(adj.clarity) > 0.001;
  const doSharp = Math.abs(adj.sharpness) > 0.001;
  if (doClarity || doSharp) {
    let lumPlane = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      lumPlane[i] = data[p] * LUM_R + data[p + 1] * LUM_G + data[p + 2] * LUM_B;
    }
    if (doClarity) {
      const radius = Math.max(2, Math.round(Math.min(w, h) * 0.008));
      const blur = boxBlur(lumPlane, w, h, radius);
      const k = adj.clarity * 1.6;
      for (let i = 0; i < n; i++) {
        const p = i * 4;
        const delta = (lumPlane[i] - blur[i]) * k;
        data[p] = clamp255(data[p] + delta);
        data[p + 1] = clamp255(data[p + 1] + delta);
        data[p + 2] = clamp255(data[p + 2] + delta);
      }
      for (let i = 0; i < n; i++) {
        const p = i * 4;
        lumPlane[i] = data[p] * LUM_R + data[p + 1] * LUM_G + data[p + 2] * LUM_B;
      }
    }
    if (doSharp) {
      const blur = boxBlur(lumPlane, w, h, 1);
      const k = adj.sharpness * 1.1;
      for (let i = 0; i < n; i++) {
        const p = i * 4;
        const delta = (lumPlane[i] - blur[i]) * k;
        data[p] = clamp255(data[p] + delta);
        data[p + 1] = clamp255(data[p + 1] + delta);
        data[p + 2] = clamp255(data[p + 2] + delta);
      }
    }
  }

  // Pass 3: vignette.
  if (adj.vignette > 0.001) {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const maxD = Math.sqrt(cx * cx + cy * cy);
    const v = adj.vignette * 0.65;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxD;
        const f = 1 - v * smoothstep(0.35, 0.95, dist);
        const p = (y * w + x) * 4;
        data[p] *= f; data[p + 1] *= f; data[p + 2] *= f;
      }
    }
  }

  // Pass 4: film grain (luminance-weighted, so shadows grain more like film).
  if (adj.grain > 0.001) {
    const gAmt = adj.grain * 22;
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const lum = data[p] * LUM_R + data[p + 1] * LUM_G + data[p + 2] * LUM_B;
      const shadowWeight = 1 - lum / 510;
      data[p] = clamp255(data[p] + hashNoise(i, 1) * gAmt * (0.4 + shadowWeight));
      data[p + 1] = clamp255(data[p + 1] + hashNoise(i, 7) * gAmt * (0.4 + shadowWeight));
      data[p + 2] = clamp255(data[p + 2] + hashNoise(i, 13) * gAmt * (0.4 + shadowWeight));
    }
  }

  return out;
}
