import { describe, it, expect } from 'vitest';
import { qualityValue, baseName, fileNameFor } from './exporter';

describe('exporter helpers', () => {
  it('maps quality presets to sensible encoder values', () => {
    expect(qualityValue('high', 'jpeg')).toBe(0.92);
    expect(qualityValue('medium', 'webp')).toBe(0.8);
    expect(qualityValue('web', 'jpeg')).toBe(0.68);
    expect(qualityValue('high', 'png')).toBe(1); // PNG is lossless
  });

  it('builds safe base names', () => {
    expect(baseName('holiday photo (1).jpg')).toBe('holiday_photo__1_');
    expect(baseName('IMG_0001.HEIC')).toBe('IMG_0001');
  });

  it('builds export file names with mode and extension', () => {
    expect(fileNameFor('beach.jpg', 'cinematic', 'jpeg')).toBe('beach-cinematic.jpg');
    expect(fileNameFor('beach.jpg', 'bw', 'png')).toBe('beach-bw.png');
    expect(fileNameFor('beach.jpg', 'portrait', 'webp')).toBe('beach-portrait.webp');
  });
});
