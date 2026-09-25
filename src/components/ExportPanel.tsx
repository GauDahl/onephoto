import { useState } from 'react';
import type { AspectRatio, ExportFormat, ExportOptions, QualityPreset } from '../types';

interface Props {
  processing: boolean;
  webpSupported: boolean;
  onExport: (opts: ExportOptions) => void;
}

const RATIOS: AspectRatio[] = ['original', '1:1', '4:5', '3:4', '4:3', '16:9', '9:16'];

export default function ExportPanel({ processing, webpSupported, onExport }: Props) {
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [maxDim, setMaxDim] = useState<string>('original');
  const [ratio, setRatio] = useState<AspectRatio>('original');

  const effectiveFormat: ExportFormat = format === 'webp' && !webpSupported ? 'jpeg' : format;

  return (
    <section className="card" aria-label="Export">
      <h2>Export</h2>

      <div className="field">
        <label htmlFor="ex-format">Format</label>
        <select id="ex-format" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          <option value="jpeg">JPG</option>
          <option value="png">PNG (lossless)</option>
          {webpSupported && <option value="webp">WebP</option>}
        </select>
      </div>
      {format === 'webp' && !webpSupported && (
        <p className="muted small">WebP is not supported in this browser — export will fall back to JPG.</p>
      )}

      <div className="field">
        <label htmlFor="ex-quality">Quality</label>
        <select id="ex-quality" value={quality} onChange={(e) => setQuality(e.target.value as QualityPreset)}>
          <option value="high">High (print / archive)</option>
          <option value="medium">Medium (sharing)</option>
          <option value="web">Web (small files)</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="ex-size">Output size</label>
        <select id="ex-size" value={maxDim} onChange={(e) => setMaxDim(e.target.value)}>
          <option value="original">Original resolution</option>
          <option value="4096">4096px max dimension</option>
          <option value="2048">2048px max dimension</option>
          <option value="1600">1600px max dimension</option>
          <option value="1080">1080px max dimension</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="ex-ratio">Aspect ratio</label>
        <select id="ex-ratio" value={ratio} onChange={(e) => setRatio(e.target.value as AspectRatio)}>
          {RATIOS.map((r) => (
            <option key={r} value={r}>{r === 'original' ? 'Original (or version crop)' : r}</option>
          ))}
        </select>
      </div>

      <button
        className="btn primary block"
        disabled={processing}
        onClick={() =>
          onExport({
            format: effectiveFormat,
            quality,
            maxDimension: maxDim === 'original' ? null : Number(maxDim),
            ratio,
          })
        }
      >
        {processing ? 'Processing…' : '⬇ Export image'}
      </button>
      <p className="muted small" style={{ marginBottom: 0, marginTop: 8 }}>
        The original file is never modified; exports are new files.
      </p>
    </section>
  );
}
