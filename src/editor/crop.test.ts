import { describe, it, expect } from 'vitest';
import { centerCrop, ratioNumber, smartCrop } from './crop';
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

describe('crop utilities', () => {
  it('converts ratio labels to numbers', () => {
    expect(ratioNumber('16:9')).toBeCloseTo(16 / 9, 5);
    expect(ratioNumber('1:1')).toBe(1);
    expect(ratioNumber('original')).toBeNull();
  });

  it('centres the crop window', () => {
    const r = centerCrop(1000, 500, 1);
    expect(r.width).toBe(500);
    expect(r.height).toBe(500);
    expect(r.x).toBe(250);
    expect(r.y).toBe(0);
  });

  it('returns the full frame when the aspect already matches', () => {
    const img = makeImage(100, 100, () => [128, 128, 128]);
    const r = smartCrop(img, 1);
    expect(r).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('keeps a salient subject inside the crop window', () => {
    // Dark, detailed subject on the left third; bright flat background.
    const img = makeImage(120, 80, (x, y) => {
      if (x >= 8 && x < 28 && y >= 20 && y < 60) {
        const v = 40 + ((x * 7 + y * 13) % 50);
        return [v, v, v];
      }
      return [240, 240, 240];
    });
    const r = smartCrop(img, 0.5); // narrower than the frame
    expect(r.width / r.height).toBeCloseTo(0.5, 1);
    expect(r.x).toBeLessThanOrEqual(8);
    expect(r.x + r.width).toBeGreaterThanOrEqual(28);
  });
});
