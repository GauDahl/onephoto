/**
 * Central photo-editing state machine.
 * Owns: load -> analyse -> base preset -> manual deltas -> history -> export.
 * Preview rendering runs at reduced resolution for speed; export re-runs the
 * exact same pure pipeline at full resolution.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Adjustments, AnalysisResult, ExportOptions, ImageDataLike, OutputMode } from '../types';
import { defaultAdjustments } from '../types';
import { analyzeImageData } from '../analysis/analyzer';
import { clamp } from '../analysis/color';
import { applyAdjustments } from '../editor/engine';
import { buildAdjustmentsForMode, isZeroAdjustments, mergeAdjustments, NONNEGATIVE_KEYS } from '../presets/presets';
import { ratioNumber, smartCrop } from '../editor/crop';
import { canvasToBlob, downloadBlob, fileNameFor, qualityValue } from '../export/exporter';
import { cropCanvas, decodeImage, drawScaled, imageDataToCanvas } from '../utils/canvas';
import { friendlyError } from '../utils/errors';

export interface SavedPreset { name: string; adjustments: Adjustments; }

const PRESETS_KEY = 'onephoto-saved-presets';
const HISTORY_LIMIT = 40;
const PREVIEW_DIM = 1600;

interface HistoryEntry { manual: Adjustments; current: Adjustments; }

export function usePhotoEditor() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [mode, setMode] = useState<OutputMode>('professional');
  const [base, setBase] = useState<Adjustments | null>(null);
  const [manual, setManual] = useState<Adjustments | null>(null);
  const [current, setCurrent] = useState<Adjustments | null>(null);
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [originalUrl, setOriginalUrl] = useState('');
  const [editedUrl, setEditedUrl] = useState('');
  const [processing, setProcessing] = useState(false);

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') as SavedPreset[]; }
    catch { return []; }
  });

  const fullCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewIdRef = useRef<ImageDataLike | null>(null);
  const jobRef = useRef(0);

  const clearError = useCallback(() => setError(null), []);

  const loadFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('That file type is not supported. Please choose a JPG, PNG or WebP image.');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const img = await decodeImage(file);
      const full = drawScaled(img, Number.MAX_SAFE_INTEGER);
      fullCanvasRef.current = full;
      const preview = drawScaled(img, PREVIEW_DIM);
      previewIdRef.current = {
        data: preview.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, preview.width, preview.height).data,
        width: preview.width,
        height: preview.height,
      };
      const a = analyzeImageData(previewIdRef.current);
      setAnalysis(a);
      setFileName(file.name);
      setOriginalUrl(preview.toDataURL('image/jpeg', 0.9));
      setPast([]);
      setFuture([]);
      setManual(defaultAdjustments());
      setStatus('ready');
    } catch (err) {
      setError(friendlyError(err));
      setStatus('error');
    }
  }, []);

  // When the analysis or mode changes, rebuild the automatic base edit.
  useEffect(() => {
    if (!analysis) return;
    setBase(buildAdjustmentsForMode(mode, analysis).adjustments);
  }, [analysis, mode]);

  // current = base merged with the user's manual deltas.
  useEffect(() => {
    if (base && manual) setCurrent(mergeAdjustments(base, manual));
  }, [base, manual]);

  // Re-render the edited preview (debounced, job-guarded, low-res for speed).
  useEffect(() => {
    if (!analysis || !previewIdRef.current || !manual) return;
    const job = ++jobRef.current;
    setProcessing(true);
    const t = window.setTimeout(() => {
      try {
        const build = buildAdjustmentsForMode(mode, analysis);
        const adj = mergeAdjustments(build.adjustments, manual);
        const out = applyAdjustments(previewIdRef.current!, adj);
        let canvas = imageDataToCanvas(out);
        const ratio = ratioNumber(build.crop);
        if (ratio) {
          canvas = cropCanvas(canvas, smartCrop(out, ratio, ratio < 0.8));
        }
        if (jobRef.current === job) {
          setEditedUrl(canvas.toDataURL('image/jpeg', 0.92));
          setProcessing(false);
        }
      } catch (err) {
        if (jobRef.current === job) {
          setError(friendlyError(err));
          setProcessing(false);
        }
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [analysis, mode, manual]);

  const setSlider = useCallback((key: keyof Adjustments, value: number) => {
    if (!base || !manual) return;
    const lo = NONNEGATIVE_KEYS.has(key) ? 0 : -1;
    setManual({ ...manual, [key]: clamp(value - base[key], lo, 1) });
  }, [base, manual]);

  const commit = useCallback(() => {
    if (!manual || !current) return;
    setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), { manual, current }]);
    setFuture([]);
  }, [manual, current]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [...f, { manual: manual!, current: current! }]);
    setManual(prev.manual);
  }, [past, manual, current]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    setPast((p) => [...p, { manual: manual!, current: current! }]);
    setManual(next.manual);
  }, [future, manual, current]);

  /** Reset / Auto: throw away manual deltas, keep (or rebuild) the auto edit. */
  const resetManual = useCallback(() => {
    commit();
    setManual(defaultAdjustments());
  }, [commit]);

  const savePreset = useCallback(() => {
    if (!current) return;
    const name = window.prompt('Name this preset:', 'My preset');
    if (!name) return;
    const next = [
      ...savedPresets.filter((p) => p.name !== name),
      { name, adjustments: { ...current } },
    ];
    setSavedPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  }, [current, savedPresets]);

  const applySavedPreset = useCallback((name: string) => {
    const p = savedPresets.find((x) => x.name === name);
    if (!p || !base) return;
    commit();
    const m = defaultAdjustments();
    (Object.keys(m) as (keyof Adjustments)[]).forEach((k) => {
      const lo = NONNEGATIVE_KEYS.has(k) ? 0 : -1;
      m[k] = clamp(p.adjustments[k] - base[k], lo, 1);
    });
    setManual(m);
  }, [savedPresets, base, commit]);

  const exportCurrent = useCallback(async (opts: ExportOptions) => {
    const full = fullCanvasRef.current;
    if (!full || !analysis || !manual) return;
    setProcessing(true);
    try {
      // Let the UI paint before the heavy full-res pass.
      await new Promise((r) => setTimeout(r, 30));
      const source = opts.maxDimension ? drawScaled(full, opts.maxDimension) : full;
      const id = source.getContext('2d', { willReadFrequently: true })!
        .getImageData(0, 0, source.width, source.height);
      const build = buildAdjustmentsForMode(mode, analysis);
      const adj = mergeAdjustments(build.adjustments, manual);
      const out = applyAdjustments({ data: id.data, width: id.width, height: id.height }, adj);
      let canvas = imageDataToCanvas(out);
      const ratio = ratioNumber(opts.ratio !== 'original' ? opts.ratio : build.crop);
      if (ratio) {
        canvas = cropCanvas(canvas, smartCrop(out, ratio, ratio < 0.8));
      }
      const blob = await canvasToBlob(canvas, opts.format, qualityValue(opts.quality, opts.format));
      downloadBlob(blob, fileNameFor(fileName, mode, opts.format));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setProcessing(false);
    }
  }, [analysis, manual, mode, fileName]);

  const isPristineOriginal = mode === 'original' && !!manual && isZeroAdjustments(manual);

  return {
    status, error, clearError, fileName,
    analysis, mode, setMode,
    current, manual,
    loadFiles,
    setSlider, commit, undo, redo, resetManual,
    canUndo: past.length > 0, canRedo: future.length > 0,
    originalUrl, editedUrl, processing,
    savedPresets, savePreset, applySavedPreset,
    exportCurrent, isPristineOriginal,
  };
}

export type PhotoEditor = ReturnType<typeof usePhotoEditor>;
