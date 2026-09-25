/**
 * Smart cropping.
 *
 * No native face-detection dependency: we compute a saliency grid (edge
 * strength + colour energy per cell), then search for the window with the
 * target aspect ratio that keeps the most salient content. For portrait
 * ratios we bias toward the classic upper-third head position, which is the
 * documented fallback when face detection is unavailable.
 */
import type { AspectRatio, CropRect, ImageDataLike } from '../types';
import { luminance, rgbToHsl } from '../analysis/color';

export function ratioNumber(r: AspectRatio): number | null {
  if (r === 'original') return null;
  const [a, b] = r.split(':').map(Number);
  return a / b;
}

export function centerCrop(w: number, h: number, ratio: number): CropRect {
  let cw = w, ch = h;
  if (w / h > ratio) cw = h * ratio;
  else ch = w / ratio;
  cw = Math.floor(cw); ch = Math.floor(ch);
  return { x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2), width: cw, height: ch };
}

export function smartCrop(img: ImageDataLike, ratio: number, portraitBias = false): CropRect {
  const { width: w, height: h } = img;
  if (Math.abs(w / h - ratio) < 0.01) return { x: 0, y: 0, width: w, height: h };

  const gw = 64;
  const gh = Math.max(8, Math.round((gw * h) / w));
  const sal = new Float32Array(gw * gh);
  const cnt = new Float32Array(gw * gh);
  const d = img.data;

  for (let y = 0; y < h; y++) {
    const cy = Math.min(gh - 1, ((y * gh) / h) | 0);
    for (let x = 0; x < w; x++) {
      const cx = Math.min(gw - 1, ((x * gw) / w) | 0);
      const p = (y * w + x) * 4;
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const here = luminance(r, g, b);
      let energy = 0;
      if (x + 1 < w) {
        const q = p + 4;
        energy += Math.abs(here - luminance(d[q], d[q + 1], d[q + 2]));
      }
      if (y + 1 < h) {
        const q = p + w * 4;
        energy += Math.abs(here - luminance(d[q], d[q + 1], d[q + 2]));
      }
      const [, sat] = rgbToHsl(r, g, b);
      energy += sat * 30;
      const idx = cy * gw + cx;
      sal[idx] += energy;
      cnt[idx]++;
    }
  }
  for (let i = 0; i < sal.length; i++) sal[i] = cnt[i] > 0 ? sal[i] / cnt[i] : 0;

  const meanSal = sal.reduce((a, b) => a + b, 0) / sal.length;

  // Integral image for O(1) window sums.
  const I = new Float64Array((gw + 1) * (gh + 1));
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      I[(y + 1) * (gw + 1) + (x + 1)] =
        sal[y * gw + x] + I[y * (gw + 1) + (x + 1)] + I[(y + 1) * (gw + 1) + x] - I[y * (gw + 1) + x];
    }
  }
  const rectSum = (x0: number, y0: number, x1: number, y1: number) =>
    I[y1 * (gw + 1) + x1] - I[y0 * (gw + 1) + x1] - I[y1 * (gw + 1) + x0] + I[y0 * (gw + 1) + x0];

  const fullW = ratio > w / h ? w : h * ratio;
  const fullH = fullW / ratio;

  let best: CropRect | null = null;
  let bestScore = -Infinity;

  for (const scale of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]) {
    const cw = Math.min(w, Math.floor(fullW * scale));
    const ch = Math.floor(cw / ratio);
    if (cw < w * 0.5 || ch < h * 0.5) continue;
    const stepX = Math.max(1, Math.floor((w - cw) / 16)) || 1;
    const stepY = Math.max(1, Math.floor((h - ch) / 16)) || 1;
    for (let y = 0; y + ch <= h; y += stepY) {
      for (let x = 0; x + cw <= w; x += stepX) {
        const gx0 = Math.floor((x * gw) / w), gy0 = Math.floor((y * gh) / h);
        const gx1 = Math.max(gx0 + 1, Math.ceil(((x + cw) * gw) / w));
        const gy1 = Math.max(gy0 + 1, Math.ceil(((y + ch) * gh) / h));
        let score = rectSum(gx0, gy0, Math.min(gw, gx1), Math.min(gh, gy1)) / ((gx1 - gx0) * (gy1 - gy0));
        if (portraitBias) {
          const cyNorm = (y + ch * 0.35) / h;
          score += Math.exp(-(((cyNorm - 0.38) ** 2) / (2 * 0.12 * 0.12))) * meanSal * 0.35;
        }
        score -= (1 - scale) * meanSal * 0.15; // prefer keeping more of the frame
        if (score > bestScore) {
          bestScore = score;
          best = { x, y, width: cw, height: ch };
        }
      }
    }
    if (best && scale <= 0.9) break; // good enough, avoid over-cropping
  }

  return best ?? centerCrop(w, h, ratio);
}
