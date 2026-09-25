import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Adjustments } from '../types';
import { NONNEGATIVE_KEYS } from '../presets/presets';
import type { SavedPreset } from '../hooks/usePhotoEditor';

interface SliderDef {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
}

const GROUPS: { title: string; sliders: SliderDef[] }[] = [
  {
    title: 'Light',
    sliders: [
      { key: 'exposure', label: 'Exposure', min: -1, max: 1 },
      { key: 'brightness', label: 'Brightness', min: -1, max: 1 },
      { key: 'contrast', label: 'Contrast', min: -1, max: 1 },
      { key: 'highlights', label: 'Highlights', min: -1, max: 1 },
      { key: 'shadows', label: 'Shadows', min: -1, max: 1 },
      { key: 'whites', label: 'Whites', min: -1, max: 1 },
      { key: 'blacks', label: 'Blacks', min: -1, max: 1 },
    ],
  },
  {
    title: 'Colour',
    sliders: [
      { key: 'temperature', label: 'Temperature', min: -1, max: 1 },
      { key: 'tint', label: 'Tint', min: -1, max: 1 },
      { key: 'saturation', label: 'Saturation', min: -1, max: 1 },
      { key: 'vibrance', label: 'Vibrance', min: -1, max: 1 },
    ],
  },
  {
    title: 'Detail',
    sliders: [
      { key: 'clarity', label: 'Clarity', min: -1, max: 1 },
      { key: 'sharpness', label: 'Sharpness', min: -1, max: 1 },
      { key: 'noiseReduction', label: 'Noise reduction', min: 0, max: 1 },
    ],
  },
  {
    title: 'Effects',
    sliders: [
      { key: 'vignette', label: 'Vignette', min: 0, max: 1 },
      { key: 'fade', label: 'Fade', min: 0, max: 1 },
      { key: 'grain', label: 'Grain', min: 0, max: 1 },
    ],
  },
];

interface Props {
  current: Adjustments;
  canUndo: boolean;
  canRedo: boolean;
  onSlider: (key: keyof Adjustments, value: number) => void;
  onCommit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAuto: () => void;
  savedPresets: SavedPreset[];
  onSavePreset: () => void;
  onApplySaved: (name: string) => void;
}

export default function ManualEditor(props: Props) {
  const { current } = props;
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <section className="card" aria-label="Manual adjustments">
      <h2>Fine-tune</h2>

      <div className="editor-actions" style={{ marginTop: 0, marginBottom: 4 }}>
        <button className="btn tiny" disabled={!props.canUndo} onClick={props.onUndo}>↩ Undo</button>
        <button className="btn tiny" disabled={!props.canRedo} onClick={props.onRedo}>↪ Redo</button>
        <button className="btn tiny" onClick={props.onAuto}>⚡ Auto</button>
        <button
          className={`btn tiny ${showOriginal ? 'primary' : ''}`}
          onPointerDown={() => setShowOriginal(true)}
          onPointerUp={() => setShowOriginal(false)}
          onPointerLeave={() => setShowOriginal(false)}
          onClick={() => setShowOriginal((v) => !v)}
        >
          {showOriginal ? 'Showing original' : 'Hold: Original'}
        </button>
      </div>

      {GROUPS.map((group) => (
        <div className="editor-group" key={group.title}>
          <div className="editor-group-title">{group.title}</div>
          {group.sliders.map((s) => {
            const v = current[s.key];
            const pct = ((v - s.min) / (s.max - s.min)) * 100;
            return (
              <div className="slider-row" key={s.key}>
                <label htmlFor={`sl-${s.key}`}>{s.label}</label>
                <input
                  id={`sl-${s.key}`}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={0.01}
                  value={v}
                  style={{ '--p': `${pct}%` } as CSSProperties}
                  onChange={(e) => props.onSlider(s.key, Number(e.target.value))}
                  onPointerUp={props.onCommit}
                  onKeyUp={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') props.onCommit(); }}
                />
                <output>{v.toFixed(2)}</output>
              </div>
            );
          })}
        </div>
      ))}

      <div className="editor-actions">
        <button className="btn tiny" onClick={props.onSavePreset}>＋ Save preset</button>
      </div>
      {props.savedPresets.length > 0 && (
        <div className="saved-presets">
          <label className="muted small" htmlFor="saved-preset">Apply:</label>
          <select id="saved-preset" defaultValue="" onChange={(e) => {
            if (e.target.value) props.onApplySaved(e.target.value);
            e.target.value = '';
          }}>
            <option value="" disabled>My presets…</option>
            {props.savedPresets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
      )}
    </section>
  );
}

