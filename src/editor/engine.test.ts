import { describe, it, expect } from 'vitest';
import { applyAdjustments } from './engine';
import { defaultAdjustments, type ImageDataLike } from '../types';

function solid(w: number, h: number, r: number, g: number, b: number): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe('edit engine', () => {
  it('applies exposure as a multiplier', () => {
    const out = applyAdjustments(solid(4, 4, 100, 100, 100), {
      ...defaultAdjustments(), exposure: 1,
    });
    expect(out.data[0]).toBe(200);
  });

  it('pushes tones away from mid gray when contrast is added', () => {
    const out = applyAdjustments(solid(4, 4, 160, 160, 160), {
      ...defaultAdjustments(), contrast: 0.5,
    });
    expect(out.data[0]).toBeGreaterThan(160);
    const dark = applyAdjustments(solid(4, 4, 90, 90, 90), {
      ...defaultAdjustments(), contrast: 0.5,
    });
    expect(dark.data[0]).toBeLessThan(90);
  });

  it('zero adjustments are an identity transform', () => {
    const out = applyAdjustments(solid(8, 8, 37, 111, 201), defaultAdjustments());
    expect(Math.abs(out.data[0] - 37)).toBeLessThanOrEqual(1);
    expect(Math.abs(out.data[1] - 111)).toBeLessThanOrEqual(1);
    expect(Math.abs(out.data[2] - 201)).toBeLessThanOrEqual(1);
  });

  it('vignette darkens corners more than the centre', () => {
    const out = applyAdjustments(solid(64, 64, 180, 180, 180), {
      ...defaultAdjustments(), vignette: 1,
    });
    const corner = out.data[0];
    const centre = out.data[((32 * 64) + 32) * 4];
    expect(corner).toBeLessThan(centre);
    expect(centre).toBeGreaterThan(170);
  });

  it('positive temperature warms reds and cools blues', () => {
    const out = applyAdjustments(solid(4, 4, 128, 128, 128), {
      ...defaultAdjustments(), temperature: 0.5,
    });
    expect(out.data[0]).toBeGreaterThan(128);
    expect(out.data[2]).toBeLessThan(128);
  });

  it('saturation -1 produces neutral gray', () => {
    const out = applyAdjustments(solid(4, 4, 200, 80, 40), {
      ...defaultAdjustments(), saturation: -1,
    });
    expect(out.data[0]).toBe(out.data[1]);
    expect(out.data[1]).toBe(out.data[2]);
  });

  it('highlights recovery pulls bright tones down', () => {
    const out = applyAdjustments(solid(4, 4, 235, 235, 235), {
      ...defaultAdjustments(), highlights: -0.5,
    });
    expect(out.data[0]).toBeLessThan(235);
  });

  it('shadow lift raises dark tones', () => {
    const out = applyAdjustments(solid(4, 4, 25, 25, 25), {
      ...defaultAdjustments(), shadows: 0.5,
    });
    expect(out.data[0]).toBeGreaterThan(25);
  });
});
