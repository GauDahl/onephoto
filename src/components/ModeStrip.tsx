import type { OutputMode } from '../types';
import { OUTPUT_MODES } from '../presets/presets';

interface Props {
  mode: OutputMode;
  onChange: (mode: OutputMode) => void;
}

export default function ModeStrip({ mode, onChange }: Props) {
  const active = OUTPUT_MODES.find((m) => m.id === mode);
  return (
    <section className="card" aria-label="Output versions">
      <h2>Versions from this original</h2>
      <div className="chips">
        {OUTPUT_MODES.map((m) => (
          <button
            key={m.id}
            className={`chip ${m.id === mode ? 'active' : ''}`}
            onClick={() => onChange(m.id)}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>
      {active && <p className="muted small" style={{ marginBottom: 0 }}>{active.hint}</p>}
    </section>
  );
}
