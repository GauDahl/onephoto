/** Browser-only canvas helpers (kept out of the pure processing modules). */
import type { CropRect, ImageDataLike } from '../types';

export function decodeImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode-failed'));
    };
    img.src = url;
  });
}

export function drawScaled(
  source: HTMLImageElement | HTMLCanvasElement,
  maxDim: number,
): HTMLCanvasElement {
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageDataLike {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: id.data, width: id.width, height: id.height };
}

export function imageDataToCanvas(img: ImageDataLike): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  const id = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  ctx.putImageData(id, 0, 0);
  return canvas;
}

export function cropCanvas(source: HTMLCanvasElement, rect: CropRect): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    source,
    rect.x, rect.y, rect.width, rect.height,
    0, 0, rect.width, rect.height,
  );
  return canvas;
}
