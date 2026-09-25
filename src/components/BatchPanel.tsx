/**
 * Batch mode: multiple photos processed in a Web Worker (so the UI stays
 * responsive and one failure never blocks the rest), with ZIP export.
 */
import { useRef, useState } from 'react';
import UploadZone from './UploadZone';
import {
  buildZip,
  canvasToBlob,
  downloadBlob,
  baseName,
  qualityValue,
} from '../export/exporter';
import { decodeImage, drawScaled, imageDataToCanvas, canvasToImageData, cropCanvas } from '../utils/canvas';
import { ratioNumber, smartCrop } from '../editor/crop';
import { friendlyError } from '../utils/errors';
import type { AspectRatio, ExportFormat, ImageDataLike, OutputMode } from '../types';

interface Item {
  id: string;
  name: string;
  file: File;
  status: 'queued' | 'working' | 'done' | 'error';
  previewUrl?: string;
  result?: HTMLCanvasElement;
  resultLabel?: string;
  treatment?: string;
  error?: string;
}

interface WorkerSuccess {
  id: string;
  ok: true;
  analysis: { suggestedPreset: OutputMode };
  crop: string;
  mode: OutputMode;
  result: ImageDataLike;
}
interface WorkerFailure { id: string; ok: false; error: string; }

const STATUS_LABEL: Record<Item['status'], string> = {
  queued: 'Queued',
  working: 'Processing…',
  done: 'Done',
  error: 'Failed',
};

export default function BatchPanel({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<OutputMode | 'auto'>('auto');
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);

  const patch = (id: string, p: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const addFiles = (files: File[]) => {
    setItems((xs) => [
      ...xs,
      ...files.map((f) => ({
        id: `job-${++counter.current}`,
        name: f.name,
        file: f,
        status: 'queued' as const,
      })),
    ]);
  };

  const processOne = (
    worker: Worker,
    item: Item,
    chosen: OutputMode | 'auto',
  ): Promise<void> =>
    new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        cleanup();
        patch(item.id, { status: 'error', error: 'Processing timed out.' });
        resolve();
      }, 90000);

      const onMsg = (e: MessageEvent) => {
        const data = e.data as WorkerSuccess | WorkerFailure;
        if (data?.id !== item.id) return;
        cleanup();
        if (data.ok) {
          try {
            let canvas = imageDataToCanvas(data.result);
            const crop: string = data.crop;
            if (crop && crop !== 'original') {
              const rn = ratioNumber(crop as AspectRatio);
              if (rn) canvas = cropCanvas(canvas, smartCrop(data.result, rn, rn < 0.8));
            }
            const label = `${data.mode}${crop && crop !== 'original' ? `-${String(crop).replace(':', 'x')}` : ''}`;
            patch(item.id, {
              status: 'done',
              result: canvas,
              resultLabel: label,
              treatment: data.mode,
              previewUrl: canvas.toDataURL('image/jpeg', 0.85),
            });
          } catch (err) {
            patch(item.id, { status: 'error', error: friendlyError(err) });
          }
        } else {
          patch(item.id, { status: 'error', error: 'Could not process this image.' });
        }
        resolve();
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        worker.removeEventListener('message', onMsg);
      };

      worker.addEventListener('message', onMsg);
      (async () => {
        try {
          const img = await decodeImage(item.file);
          const canvas = drawScaled(img, 2048);
          const id = canvasToImageData(canvas);
          const copy: ImageDataLike = {
            data: new Uint8ClampedArray(id.data),
            width: id.width,
            height: id.height,
          };
          worker.postMessage(
            { id: item.id, imageData: copy, mode: chosen },
            [copy.data.buffer],
          );
        } catch (err) {
          cleanup();
          patch(item.id, { status: 'error', error: friendlyError(err) });
          resolve();
        }
      })();
    });

  const processAll = async () => {
    const pending = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (!pending.length || busy) return;
    setBusy(true);
    const worker = new Worker(
      new URL('../worker/process.worker.ts', import.meta.url),
      { type: 'module' },
    );
    try {
      // Sequential per-image await: each failure resolves independently.
      for (const item of pending) {
        patch(item.id, { status: 'working', error: undefined });
        await processOne(worker, item, mode);
      }
    } finally {
      worker.terminate();
      setBusy(false);
    }
  };

  const exportZip = async () => {
    const done = items.filter((i) => i.status === 'done' && i.result);
    if (!done.length || busy) return;
    setBusy(true);
    try {
      const entries = [];
      for (const item of done) {
        const blob = await canvasToBlob(item.result!, format, qualityValue('high', format));
        const ext = format === 'jpeg' ? 'jpg' : format;
        entries.push({ name: `${baseName(item.name)}-${item.resultLabel}.${ext}`, blob });
      }
      const zip = await buildZip(entries);
      downloadBlob(zip, 'onephoto-batch.zip');
    } finally {
      setBusy(false);
    }
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const actionable = items.some((i) => i.status === 'queued' || i.status === 'error');

  return (
    <div className="batch-wrap">
      <div className="batch-toolbar" style={{ marginTop: 0 }}>
        <button className="btn" onClick={onBack}>← Single photo</button>
        <select
          aria-label="Treatment"
          value={mode}
          onChange={(e) => setMode(e.target.value as OutputMode | 'auto')}
        >
          <option value="auto">Auto (analyse each photo)</option>
          <option value="professional">Professional</option>
          <option value="portrait">Portrait</option>
          <option value="instagram">Instagram (4:5)</option>
          <option value="linkedin">LinkedIn (1:1)</option>
          <option value="wallpaper">Wallpaper (9:16)</option>
          <option value="cinematic">Cinematic</option>
          <option value="night">Night / City</option>
          <option value="bw">Black &amp; White</option>
          <option value="expensive">Look Expensive</option>
        </select>
        <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          <option value="jpeg">JPG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
        </select>
        <button className="btn primary" disabled={!actionable || busy} onClick={processAll}>
          {busy ? 'Working…' : 'Process all'}
        </button>
        <button className="btn" disabled={!doneCount || busy} onClick={exportZip}>
          ⬇ Export ZIP ({doneCount})
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <UploadZone multiple compact onFiles={addFiles} />
      </div>

      {items.length > 0 && (
        <div className="batch-list">
          {items.map((item) => (
            <div className="batch-item" key={item.id}>
              {item.previewUrl
                ? <img className="batch-thumb" src={item.previewUrl} alt={item.name} />
                : <div className="batch-thumb" aria-hidden>🖼</div>}
              <div>
                <div className="batch-name">{item.name}</div>
                <div className={`batch-status ${item.status}`}>
                  {STATUS_LABEL[item.status]}
                  {item.treatment ? ` · ${item.treatment}` : ''}
                  {item.error ? ` · ${item.error}` : ''}
                </div>
              </div>
              <button
                className="btn tiny"
                onClick={() => setItems((xs) => xs.filter((x) => x.id !== item.id))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
