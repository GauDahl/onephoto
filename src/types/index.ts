/**
 * Shared domain types for OnePhoto.
 * ImageDataLike mirrors the browser ImageData shape so that the pure
 * processing modules can run in the browser, in a Web Worker AND in
 * Node (vitest) without any DOM dependency.
 */

export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Adjustments {
  exposure: number;      // -1 .. 1   (stops-like multiplier)
  brightness: number;    // -1 .. 1   (additive offset)
  contrast: number;      // -1 .. 1   (around mid gray)
  highlights: number;    // -1 .. 1   (negative = recover)
  shadows: number;       // -1 .. 1   (positive = lift)
  whites: number;        // -1 .. 1
  blacks: number;        // -1 .. 1
  temperature: number;   // -1 .. 1   (negative = cooler, positive = warmer)
  tint: number;          // -1 .. 1
  saturation: number;    // -1 .. 1   (-1 = full monochrome)
  vibrance: number;      // -1 .. 1   (protects already-saturated / bright tones)
  clarity: number;       // -1 .. 1   (local contrast)
  sharpness: number;     // -1 .. 1   (unsharp mask)
  noiseReduction: number;//  0 .. 1   (edge-preserving smoothing)
  vignette: number;      //  0 .. 1
  grain: number;         //  0 .. 1
  fade: number;          //  0 .. 1   (filmic black lift)
}

export function defaultAdjustments(): Adjustments {
  return {
    exposure: 0, brightness: 0, contrast: 0, highlights: 0, shadows: 0,
    whites: 0, blacks: 0, temperature: 0, tint: 0, saturation: 0,
    vibrance: 0, clarity: 0, sharpness: 0, noiseReduction: 0,
    vignette: 0, grain: 0, fade: 0,
  };
}

export type PhotoCategory =
  | 'portrait' | 'people' | 'landscape' | 'outdoor' | 'indoor'
  | 'night' | 'city' | 'food' | 'architecture' | 'lowlight' | 'sunset'
  | 'general';

export type OutputMode =
  | 'original' | 'professional' | 'portrait' | 'instagram' | 'linkedin'
  | 'wallpaper' | 'print' | 'cinematic' | 'night' | 'bw' | 'expensive';

export type AspectRatio =
  | 'original' | '1:1' | '4:5' | '3:4' | '4:3' | '16:9' | '9:16';

export type ExportFormat = 'jpeg' | 'png' | 'webp';
export type QualityPreset = 'high' | 'medium' | 'web';

export interface ExportOptions {
  format: ExportFormat;
  quality: QualityPreset;
  maxDimension: number | null;
  ratio: AspectRatio;
}

export interface AnalysisResult {
  width: number;
  height: number;
  aspect: number;
  orientation: 'landscape' | 'portrait' | 'square';
  brightness: number;     // 0..1 mean luminance
  exposure: number;       // -1..1 deviation from ideal (positive = too bright)
  contrast: number;       // 0..1 luminance std-dev
  saturation: number;     // 0..1 mean HSL saturation
  temperature: number;    // -1..1 estimated WB offset (positive = image is warm)
  tint: number;           // -1..1 estimated tint offset
  highlights: number;     // 0..1 strength of bright tail
  shadows: number;        // 0..1 strength of deep shadows
  sharpness: number;      // 0..1 (Laplacian variance, normalised)
  noise: number;          // 0..1 (high-frequency MAD, normalised)
  dynamicRange: number;   // 0..1 (5th-95th percentile spread)
  skinRatio: number;      // 0..1 fraction of skin-tone pixels
  warmRatio: number;      // 0..1 fraction of warm colourful pixels
  isGrayscale: boolean;
  dominantColors: string[];
  category: PhotoCategory;
  confidence: number;     // 0..1
  suggestedPreset: OutputMode;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PresetBuild {
  adjustments: Adjustments;
  crop: AspectRatio;
  note: string;
}
