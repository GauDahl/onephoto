import type { AnalysisResult } from '../types';
import { CATEGORY_LABELS } from '../presets/presets';
import { OUTPUT_MODES } from '../presets/presets';

const METERS: { key: keyof AnalysisResult; label: string }[] = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'sharpness', label: 'Detail' },
  { key: 'noise', label: 'Noise' },
  { key: 'dynamicRange', label: 'Dynamic range' },
];

export default function AnalysisPanel({ analysis }: { analysis: AnalysisResult }) {
  const suggested = OUTPUT_MODES.find((m) => m.id === analysis.suggestedPreset);
  return (
    <section className="card" aria-label="Photo analysis">
      <h2>Analysis</h2>
      <div className="category-row">
        <span className="category-badge">{CATEGORY_LABELS[analysis.category]}</span>
        <span className="confidence">{Math.round(analysis.confidence * 100)}% confident</span>
      </div>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        Suggested treatment: <strong>{suggested?.label ?? 'Professional'}</strong>
      </p>

      <div className="meters">
        {METERS.map(({ key, label }) => {
          const v = Math.round((analysis[key] as number) * 100);
          return (
            <div className="meter" key={key}>
              <div className="meter-head"><span>{label}</span><span>{v}</span></div>
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${v}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="swatches" aria-label="Dominant colours">
        {analysis.dominantColors.map((c) => (
          <span key={c} className="swatch" style={{ background: c }} title={c} />
        ))}
      </div>

      <p className="muted small">
        White balance reads {analysis.temperature > 0.08 ? 'warm' : analysis.temperature < -0.08 ? 'cool' : 'neutral'}
        {' '}· {analysis.orientation} · {analysis.width}×{analysis.height}px
        {analysis.isGrayscale ? ' · monochrome source' : ''}
      </p>
      <p className="muted small privacy-inline">🛡 Analysed on-device with transparent heuristics — no AI, no uploads.</p>
    </section>
  );
}
