/**
 * OnePhoto preset system.
 *
 * Every preset starts from an analysis-driven correction base (fix exposure,
 * neutralise white balance, recover highlights, lift shadows, tune contrast
 * and saturation toward natural targets) and then layers a restrained,
 * purpose-specific grade on top. The goal is always: "looks professionally
 * processed, still looks like a real photograph".
 */
import type { Adjustments, AnalysisResult, AspectRatio, OutputMode, PhotoCategory, PresetBuild } from '../types';
import { defaultAdjustments } from '../types';
import { clamp } from '../analysis/color';

export const OUTPUT_MODES: { id: OutputMode; label: string; hint: string }[] = [
  { id: 'original', label: 'Original', hint: 'Unmodified source photo.' },
  { id: 'professional', label: 'Professional', hint: 'Balanced all-round enhancement.' },
  { id: 'portrait', label: 'Portrait', hint: 'Natural skin tones, controlled light.' },
  { id: 'instagram', label: 'Instagram', hint: '4:5 crop, social-ready grade.' },
  { id: 'linkedin', label: 'LinkedIn', hint: '1:1 professional headshot crop.' },
  { id: 'wallpaper', label: 'Wallpaper', hint: '9:16 crop for phone wallpapers.' },
  { id: 'print', label: 'Print', hint: 'Full-resolution, sharpened for print.' },
  { id: 'cinematic', label: 'Cinematic', hint: 'Restrained filmic grade.' },
  { id: 'night', label: 'Night / City', hint: 'Recovered lights, controlled noise.' },
  { id: 'bw', label: 'B & W', hint: 'Rich monochrome with tonal depth.' },
  { id: 'expensive', label: 'Look Expensive', hint: 'The restrained pro correction.' },
];

export const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  portrait: 'Portrait',
  people: 'People',
  landscape: 'Landscape',
  outdoor: 'Outdoor',
  indoor: 'Indoor',
  night: 'Night',
  city: 'City / Night',
  food: 'Food',
  architecture: 'Architecture',
  lowlight: 'Low light',
  sunset: 'Sunset',
  general: 'General',
};

/** Adjustment keys whose value is clamped to [0,1] rather than [-1,1]. */
export const NONNEGATIVE_KEYS = new Set<keyof Adjustments>([
  'vignette', 'grain', 'fade', 'noiseReduction',
]);

export function mergeAdjustments(base: Adjustments, delta: Adjustments): Adjustments {
  const out = { ...base };
  (Object.keys(base) as (keyof Adjustments)[]).forEach((k) => {
    const lo = NONNEGATIVE_KEYS.has(k) ? 0 : -1;
    out[k] = clamp(base[k] + delta[k], lo, 1);
  });
  return out;
}

export function isZeroAdjustments(a: Adjustments): boolean {
  return (Object.values(a) as number[]).every((v) => Math.abs(v) < 1e-6);
}

/** Analysis-driven correction base shared by all "enhancement" presets. */
function autoBase(a: AnalysisResult): Adjustments {
  const adj = defaultAdjustments();
  adj.exposure = clamp((0.5 - a.brightness) * 0.85, -0.45, 0.45);
  adj.contrast = clamp((0.42 - a.contrast) * 0.55, -0.22, 0.28);
  adj.saturation = clamp((0.38 - a.saturation) * 0.5, -0.3, 0.3);
  adj.temperature = clamp(-a.temperature * 0.7, -0.35, 0.35);
  adj.tint = clamp(-a.tint * 0.7, -0.25, 0.25);
  adj.highlights = clamp(-(a.highlights - 0.25) * 0.6, -0.5, 0.1);
  adj.shadows = clamp((a.shadows - 0.2) * 0.6, -0.1, 0.35);
  adj.whites = clamp((0.55 - a.dynamicRange) * 0.12, -0.08, 0.08);
  adj.blacks = clamp((a.dynamicRange - 0.55) * 0.1, -0.06, 0.1);
  adj.vibrance = 0.1;
  adj.sharpness = clamp(0.28 + (0.55 - a.sharpness) * 0.5, 0.15, 0.65);
  if (a.noise > 0.3) {
    adj.noiseReduction = clamp((a.noise - 0.25) * 0.8, 0, 0.6);
  }
  return adj;
}

export function buildAdjustmentsForMode(mode: OutputMode, a: AnalysisResult): PresetBuild {
  if (mode === 'original') {
    return { adjustments: defaultAdjustments(), crop: 'original', note: 'No adjustments applied.' };
  }

  const base = autoBase(a);

  switch (mode) {
    case 'professional': {
      base.contrast = clamp(base.contrast + 0.04, -1, 1);
      base.clarity = 0.12;
      base.vignette = 0.05;
      return { adjustments: base, crop: 'original', note: 'Balanced exposure, natural colour, gentle detail.' };
    }
    case 'portrait': {
      // Protect skin: slightly desaturate, lift shadows, keep sharpening gentle.
      base.saturation = clamp(base.saturation - 0.06, -1, 1);
      base.vibrance = 0.16;
      base.shadows = clamp(base.shadows + 0.08, -1, 1);
      base.highlights = clamp(base.highlights - 0.06, -1, 1);
      base.sharpness = Math.min(base.sharpness, 0.3);
      base.clarity = 0.06;
      return { adjustments: base, crop: 'original', note: 'Natural skin tones with soft, controlled light.' };
    }
    case 'instagram': {
      base.contrast = clamp(base.contrast + 0.06, -1, 1);
      base.vibrance = clamp(base.vibrance + 0.06, -1, 1);
      base.clarity = 0.14;
      base.vignette = 0.08;
      return { adjustments: base, crop: '4:5', note: 'Social-ready 4:5 with a lively but natural grade.' };
    }
    case 'linkedin': {
      const b = autoBase(a);
      b.contrast = clamp(b.contrast + 0.05, -1, 1);
      b.sharpness = clamp(b.sharpness + 0.05, -1, 1);
      b.vibrance = 0.1;
      b.saturation = clamp(b.saturation - 0.03, -1, 1);
      return { adjustments: b, crop: '1:1', note: 'Crisp, trustworthy 1:1 professional headshot.' };
    }
    case 'wallpaper': {
      base.contrast = clamp(base.contrast + 0.03, -1, 1);
      base.saturation = clamp(base.saturation + 0.03, -1, 1);
      base.clarity = 0.15;
      return { adjustments: base, crop: '9:16', note: 'Punchy 9:16 crop that survives lock-screen overlays.' };
    }
    case 'print': {
      base.contrast = clamp(base.contrast + 0.04, -1, 1);
      base.sharpness = clamp(base.sharpness + 0.1, -1, 0.65);
      base.vibrance = 0.08;
      base.vignette = 0;
      base.grain = 0;
      return { adjustments: base, crop: 'original', note: 'Full frame, sharpened for ink, no stylistic effects.' };
    }
    case 'cinematic': {
      base.contrast = clamp(base.contrast + 0.09, -1, 1);
      base.fade = 0.22;
      base.saturation = clamp(base.saturation - 0.07, -1, 1);
      base.vibrance = 0.05;
      base.temperature = clamp(base.temperature - 0.04, -1, 1);
      base.tint = clamp(base.tint + 0.015, -1, 1);
      base.highlights = clamp(base.highlights - 0.05, -1, 1);
      base.shadows = clamp(base.shadows + 0.04, -1, 1);
      base.blacks = clamp(base.blacks + 0.05, -1, 1);
      base.vignette = 0.14;
      base.grain = 0.07;
      base.clarity = 0.1;
      return { adjustments: base, crop: 'original', note: 'Filmic contrast, subtle grade, gentle halation of blacks.' };
    }
    case 'night': {
      base.highlights = clamp(base.highlights - 0.2, -1, 1);
      base.shadows = clamp(base.shadows + 0.14, -1, 1);
      base.blacks = clamp(base.blacks + 0.04, -1, 1);
      base.noiseReduction = Math.max(base.noiseReduction, 0.45);
      base.contrast = clamp(base.contrast + 0.05, -1, 1);
      base.vibrance = 0.12;
      base.clarity = 0.1;
      base.temperature = clamp(base.temperature - 0.02, -1, 1);
      return { adjustments: base, crop: 'original', note: 'Recovered neon and windows, shadows lifted without crush.' };
    }
    case 'bw': {
      const b = autoBase(a);
      b.saturation = -1;
      b.contrast = clamp(b.contrast + 0.12, -1, 1);
      b.shadows = clamp(b.shadows + 0.06, -1, 1);
      b.highlights = clamp(b.highlights - 0.06, -1, 1);
      b.blacks = clamp(b.blacks + 0.03, -1, 1);
      b.clarity = 0.12;
      b.grain = 0.09;
      b.fade = 0.05;
      b.vibrance = 0;
      return { adjustments: b, crop: 'original', note: 'Monochrome with deliberate tonal separation.' };
    }
    case 'expensive': {
      // "Make it look expensive": the most restrained mode. Fix what is wrong,
      // add almost nothing. Clean white balance, recovered highlights, honest
      // colour, a whisper of contrast and detail.
      const b = defaultAdjustments();
      b.exposure = clamp((0.5 - a.brightness) * 0.6, -0.35, 0.35);
      b.temperature = clamp(-a.temperature * 0.85, -0.4, 0.4);
      b.tint = clamp(-a.tint * 0.85, -0.3, 0.3);
      b.contrast = clamp((0.45 - a.contrast) * 0.35, -0.12, 0.12) + 0.03;
      b.saturation = clamp((0.4 - a.saturation) * 0.35, -0.2, 0.2);
      b.vibrance = 0.08;
      b.highlights = clamp(-(a.highlights - 0.3) * 0.5, -0.4, 0);
      b.shadows = clamp((a.shadows - 0.25) * 0.4, 0, 0.25);
      b.sharpness = 0.3;
      b.clarity = 0.1;
      b.vignette = 0.04;
      if (a.noise > 0.3) b.noiseReduction = clamp((a.noise - 0.25) * 0.7, 0, 0.5);
      return { adjustments: b, crop: 'original', note: 'Invisible correction - balanced, honest, expensive-looking.' };
    }
    default:
      return { adjustments: base, crop: 'original', note: '' };
  }
}

/** Best default export ratio for a mode (used to pre-select the export panel). */
export function defaultRatioForMode(mode: OutputMode, a: AnalysisResult | null): AspectRatio {
  if (!a) return 'original';
  return buildAdjustmentsForMode(mode, a).crop;
}
