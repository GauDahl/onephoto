/**
 * Export pipeline: canvas -> JPEG/PNG/WebP with quality presets, dimension
 * control, downloads, and ZIP generation for batch mode (fflate, browser-side).
 */
import { zipSync } from 'fflate';
import type { ExportFormat, QualityPreset } from '../types';

export function qualityValue(q: QualityPreset, format: ExportFormat): number {
  if (format === 'png') return 1; // PNG is lossless
  switch (q) {
    case 'high': return 0.92;
    case 'medium': return 0.8;
    case 'web': return 0.68;
  }
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality?: number,
): Promise<Blob> {
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality ?? 0.92),
  );
  if (!blob) throw new Error('export-failed');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function buildZip(entries: { name: string; blob: Blob }[]): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  for (const e of entries) {
    files[e.name] = new Uint8Array(await e.blob.arrayBuffer());
  }
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '_') || 'photo';
}

export function fileNameFor(fileName: string, mode: string, format: ExportFormat): string {
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${baseName(fileName)}-${mode}.${ext}`;
}
