/**
 * Batch processing Web Worker.
 * Receives raw ImageData + desired mode, runs the same pure pipeline as the
 * main thread (analyze -> preset -> engine), returns the processed pixels.
 * One failed image throws inside its own handler and never blocks the batch.
 */
/// <reference lib="webworker" />
import { analyzeImageData } from '../analysis/analyzer';
import { applyAdjustments } from '../editor/engine';
import { buildAdjustmentsForMode } from '../presets/presets';
import type { ImageDataLike, OutputMode } from '../types';

interface JobRequest {
  id: string;
  imageData: ImageDataLike;
  mode: OutputMode | 'auto';
}

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<JobRequest>) => {
  const { id, imageData, mode } = e.data;
  try {
    const analysis = analyzeImageData(imageData);
    const effective: OutputMode =
      mode === 'auto' ? analysis.suggestedPreset : mode;
    const build = buildAdjustmentsForMode(effective, analysis);
    const result = applyAdjustments(imageData, build.adjustments);
    ctx.postMessage(
      { id, ok: true, analysis, adjustments: build.adjustments, crop: build.crop, mode: effective, result },
      [result.data.buffer],
    );
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
