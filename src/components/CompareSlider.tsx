import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  before: string;   // data/object URL of the original
  after: string;    // data/object URL of the edited version
  processing?: boolean;
  same?: boolean;   // original mode with no edits: show a single image
}

/** Interactive before/after comparison with drag divider, wheel zoom and pan. */
export default function CompareSlider({ before, after, processing, same }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoomMode, setZoomMode] = useState(false);
  const dragRef = useRef<null | { kind: 'divider' } | { kind: 'pan'; x: number; y: number }>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(1, z * (e.deltaY < 0 ? 1.12 : 0.9))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => { if (zoom === 1) setOffset({ x: 0, y: 0 }); }, [zoom]);

  const moveDivider = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    setPos(Math.min(97, Math.max(3, ((e.clientX - rect.left) / rect.width) * 100)));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (zoomMode && zoom > 1) {
      dragRef.current = { kind: 'pan', x: e.clientX - offset.x, y: e.clientY - offset.y };
    } else {
      dragRef.current = { kind: 'divider' };
      if (!same) moveDivider(e);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'divider') { if (!same && !zoomMode) moveDivider(e); }
    else setOffset({ x: e.clientX - d.x, y: e.clientY - d.y });
  };

  const stop = () => { dragRef.current = null; };

  return (
    <div className="compare-shell">
      <div className="compare-toolbar">
        <button
          className={`btn tiny ${zoomMode ? 'active' : ''}`}
          onClick={() => setZoomMode((v) => !v)}
          title="Toggle zoom & pan mode"
        >
          {zoomMode ? '✋ Pan mode' : '🔍 Zoom mode'}
        </button>
        <div className="zoom-controls">
          <button className="btn tiny" aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(1, z / 1.25))}>−</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn tiny" aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(4, z * 1.25))}>+</button>
        </div>
        {processing && <span className="processing-chip">Processing…</span>}
      </div>

      <div
        ref={ref}
        className={`compare ${zoomMode ? 'pan-mode' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <div
          className="compare-inner"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        >
          <img className="compare-img" src={before} alt="Original" draggable={false} />
          {!same && (
            <img
              className="compare-img overlay"
              src={after}
              alt="Edited"
              draggable={false}
              style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
            />
          )}
        </div>
        {!same && (
          <div className="compare-divider" style={{ left: `${pos}%` }}>
            <div className="compare-handle">‹ ›</div>
          </div>
        )}
        <span className="compare-tag left">{same ? 'ORIGINAL — NO EDITS' : 'ORIGINAL'}</span>
        {!same && <span className="compare-tag right">EDITED</span>}
      </div>
    </div>
  );
}
