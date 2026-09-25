/**
 * OnePhoto local image analysis.
 *
 * Honest heuristic computer vision - no fake "AI" claims. Computes exposure,
 * contrast, saturation, white-balance estimates, tonal distribution, sharpness
 * (Laplacian variance), noise (high-frequency MAD), dynamic range, dominant
 * colours, skin-tone ratio and orientation, then classifies the photo into a
 * category with a rule-based expert system.
 *
 * Face detection: when the browser exposes the Shape Detection API
 * (window.FaceDetector) it can be plugged in via the AI provider layer.
 * Here we fall back to the skin-tone heuristic, exactly as documented.
 */
import type { AnalysisResult, ImageDataLike, OutputMode, PhotoCategory } from '../types';
import { clamp, isSkinTone, luminance, rgbToHsl } from './color';

interface Features {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  sharpness: number;
  noise: number;
  dynamicRange: number;
  skinRatio: number;
  warmRatio: number;
  isGrayscale: boolean;
  dominantColors: string[];
  aspect: number;
}

function classify(f: Features): { category: PhotoCategory; confidence: number } {
  const dark = f.brightness < 0.3;
  const veryDark = f.brightness < 0.16;

  // Ordered expert rules: most specific signals first.
  if (veryDark && f.noise > 0.35) return { category: 'lowlight', confidence: 0.82 };
  if (dark && f.contrast > 0.5 && f.saturation > 0.28) return { category: 'city', confidence: 0.74 };
  if (dark) return { category: 'night', confidence: 0.7 };
  if (f.skinRatio > 0.08 && f.sharpness < 0.55) {
    return { category: 'portrait', confidence: clamp(0.6 + f.skinRatio, 0, 0.92) };
  }
  if (f.skinRatio > 0.03) return { category: 'people', confidence: 0.62 };
  if (f.warmRatio > 0.45 && f.brightness < 0.68 && f.saturation > 0.32) {
    return { category: 'sunset', confidence: 0.66 };
  }
  if (f.aspect >= 1.2 && f.dynamicRange > 0.55 && f.sharpness > 0.45) {
    return { category: 'landscape', confidence: 0.64 };
  }
  if (f.aspect >= 1.15 && f.sharpness > 0.5 && f.saturation < 0.28) {
    return { category: 'architecture', confidence: 0.6 };
  }
  if (f.warmRatio > 0.32 && f.brightness < 0.58) return { category: 'indoor', confidence: 0.58 };
  if (f.brightness > 0.55 && f.saturation > 0.2) return { category: 'outdoor', confidence: 0.55 };
  return { category: 'general', confidence: 0.5 };
}

function suggestedPresetFor(category: PhotoCategory): OutputMode {
  switch (category) {
    case 'portrait':
    case 'people':
      return 'portrait';
    case 'night':
    case 'city':
    case 'lowlight':
      return 'night';
    case 'sunset':
      return 'cinematic';
    default:
      return 'professional';
  }
}

export function analyzeImageData(img: ImageDataLike): AnalysisResult {
  const { width: w, height: h, data: d } = img;
  const n = w * h;

  const hist = new Float64Array(256);
  let sumLum = 0, sumSq = 0, sumSat = 0;
  let skin = 0, warm = 0, colorful = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  const colorCount = new Map<number, number>();

  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = d[p], g = d[p + 1], b = d[p + 2];
    const lum = luminance(r, g, b);
    hist[Math.min(255, lum | 0)]++;
    sumLum += lum;
    sumSq += lum * lum;
    const [hue, sat, lig] = rgbToHsl(r, g, b);
    sumSat += sat;
    if (sat > 0.25 && lig > 0.15 && lig < 0.9) {
      colorful++;
      if (hue >= 10 && hue <= 55) warm++;
    }
    if (isSkinTone(r, g, b)) skin++;
    rSum += r; gSum += g; bSum += b;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    colorCount.set(key, (colorCount.get(key) ?? 0) + 1);
  }

  const meanLum = sumLum / (n * 255);
  const stdLum = Math.sqrt(Math.max(0, sumSq / n - (sumLum / n) ** 2)) / 255;
  const saturation = sumSat / n;

  const percentile = (p: number): number => {
    let acc = 0;
    const target = p * n;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= target) return i / 255;
    }
    return 1;
  };

  const p02 = percentile(0.02), p50 = percentile(0.5), p98 = percentile(0.98);
  const highlights = clamp((p98 - 0.8) * 3, 0, 1);
  const shadows = clamp((0.2 - p02) * 3, 0, 1);
  const dynamicRange = clamp(p98 - p02, 0, 1);

  // White-balance estimate via the grey-world assumption (documented heuristic).
  const meanR = rSum / n, meanG = gSum / n, meanB = bSum / n;
  const temperature = clamp(((meanR - meanB) / 255) * 3, -1, 1);
  const tint = clamp(((meanG - (meanR + meanB) / 2) / 255) * 4, -1, 1);

  // Sharpness: variance of the Laplacian. Noise: MAD of the high-frequency
  // residual against a 4-neighbour mean. Both computed on the luminance plane.
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    gray[i] = d[p] * 0.2126 + d[p + 1] * 0.7152 + d[p + 2] * 0.0722;
  }
  let lapSum = 0, lapSq = 0, lapCnt = 0;
  const hf: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w];
      lapSum += lap; lapSq += lap * lap; lapCnt++;
      hf.push(Math.abs(gray[i] - (gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] + gray[i]) / 5));
    }
  }
  const lapVar = lapSq / lapCnt - (lapSum / lapCnt) ** 2;
  const sharpness = clamp(lapVar / 900, 0, 1);
  hf.sort((a, b) => a - b);
  const noise = clamp((hf[(hf.length / 2) | 0] || 0) / 32, 0, 1);

  const dominantColors = [...colorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const r = ((key >> 8) & 0xf) * 17;
      const g = ((key >> 4) & 0xf) * 17;
      const b = (key & 0xf) * 17;
      return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    });

  const features: Features = {
    brightness: meanLum,
    contrast: stdLum,
    saturation,
    temperature,
    tint,
    highlights,
    shadows,
    sharpness,
    noise,
    dynamicRange,
    skinRatio: skin / n,
    warmRatio: colorful > 0 ? warm / colorful : 0,
    isGrayscale: saturation < 0.06,
    dominantColors,
    aspect: w / h,
  };

  const { category, confidence } = classify(features);

  return {
    width: w,
    height: h,
    aspect: w / h,
    orientation: w > h ? 'landscape' : h > w ? 'portrait' : 'square',
    brightness: meanLum,
    exposure: clamp((meanLum - p50) * 2, -1, 1),
    contrast: stdLum,
    saturation,
    temperature,
    tint,
    highlights,
    shadows,
    sharpness,
    noise,
    dynamicRange,
    skinRatio: features.skinRatio,
    warmRatio: features.warmRatio,
    isGrayscale: features.isGrayscale,
    dominantColors,
    category,
    confidence,
    suggestedPreset: suggestedPresetFor(category),
  };
}
