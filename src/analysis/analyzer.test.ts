import { describe, it, expect } from 'vitest';
import { analyzeImageData } from './analyzer';
import type { ImageDataLike } from '../types';

function makeImage(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      const p = (y * w + x) * 4;
      data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

// Deterministic pseudo-random so tests are stable.
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe('image analyzer', () => {
  it('reports near-zero brightness for a black frame', () => {
    const a = analyzeImageData(makeImage(32, 32, () => [5, 5, 8]));
    expect(a.brightness).toBeLessThan(0.1);
    expect(a.isGrayscale).toBe(true);
  });

  it('classifies a very dark, noisy frame as night or low light', () => {
    const rnd = lcg(42);
    const a = analyzeImageData(makeImage(48, 48, () => {
      const v = 20 + rnd() * 30;
      return [v, v, v + 5];
    }));
    expect(['night', 'lowlight']).toContain(a.category);
  });

  it('detects a soft skin-toned image as portrait', () => {
    const a = analyzeImageData(makeImage(40, 40, () => [215, 165, 135]));
    expect(a.category).toBe('portrait');
    expect(a.skinRatio).toBeGreaterThan(0.9);
  });

  it('classifies a bright, sharp, wide image as landscape', () => {
    const rnd = lcg(7);
    const a = analyzeImageData(makeImage(96, 48, () => {
      const v = 90 + rnd() * 150;
      return [v * 0.7, v * 0.85, v];
    }));
    expect(a.category).toBe('landscape');
    expect(a.orientation).toBe('landscape');
    expect(a.aspect).toBeCloseTo(2, 5);
  });

  it('estimates warm white balance on an orange frame', () => {
    const a = analyzeImageData(makeImage(24, 24, () => [230, 150, 60]));
    expect(a.temperature).toBeGreaterThan(0.2);
  });

  it('suggests the night preset for dark frames', () => {
    const a = analyzeImageData(makeImage(32, 32, () => [12, 14, 22]));
    expect(a.suggestedPreset).toBe('night');
  });
});
