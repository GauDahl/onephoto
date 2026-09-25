import { useEffect, useState } from 'react';
import UploadZone from './components/UploadZone';
import CompareSlider from './components/CompareSlider';
import AnalysisPanel from './components/AnalysisPanel';
import ModeStrip from './components/ModeStrip';
import ManualEditor from './components/ManualEditor';
import ExportPanel from './components/ExportPanel';
import BatchPanel from './components/BatchPanel';
import { usePhotoEditor } from './hooks/usePhotoEditor';

export default function App() {
  const editor = usePhotoEditor();
  const [view, setView] = useState<'single' | 'batch'>('single');
  const [showOriginal, setShowOriginal] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('onephoto-theme') as 'dark' | 'light') || 'dark',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('onephoto-theme', theme);
  }, [theme]);

  const [webpSupported] = useState(
    () => document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'),
  );

  useEffect(() => {
    if (!editor.error) return;
    const t = window.setTimeout(() => editor.clearError(), 6000);
    return () => window.clearTimeout(t);
  }, [editor.error, editor.clearError]);

  const compareUrl =
    showOriginal || editor.isPristineOriginal ? editor.originalUrl : editor.editedUrl;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>◉</span>
          <div>
            <h1>OnePhoto</h1>
            <p className="muted small">One photo. Every version.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="privacy-chip" title="All processing happens in your browser">
            🛡 On-device
          </span>
          <button
            className={`btn ${view === 'batch' ? 'primary' : ''}`}
            onClick={() => setView(view === 'single' ? 'batch' : 'single')}
          >
            {view === 'single' ? 'Batch mode' : 'Single photo'}
          </button>
          <button
            className="btn"
            aria-label="Toggle dark / light theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {view === 'batch' ? (
        <BatchPanel onBack={() => setView('single')} />
      ) : editor.status === 'idle' || (editor.status === 'error' && !editor.originalUrl) ? (
        <section className="hero">
          <div className="hero-copy">
            <h2>Upload one photo.<br />Get every version.</h2>
            <p>
              OnePhoto analyses your picture, works out what it is, applies a
              professional-grade edit, and generates Portrait, Instagram,
              LinkedIn, Wallpaper, Cinematic, Black &amp; White and more —
              without your photo ever leaving your device.
            </p>
            <UploadZone onFiles={(fs) => void editor.loadFiles(fs)} />
            {editor.status === 'error' && <p className="error-text">{editor.error}</p>}
          </div>
        </section>
      ) : editor.status === 'loading' ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p>Analysing your photo…</p>
        </div>
      ) : (
        <main className="workspace">
          <aside className="col col-left">
            {editor.analysis && <AnalysisPanel analysis={editor.analysis} />}
            <ModeStrip mode={editor.mode} onChange={editor.setMode} />
            <ExportPanel
              processing={editor.processing}
              webpSupported={webpSupported}
              onExport={(opts) => void editor.exportCurrent(opts)}
            />
          </aside>

          <section className="col col-center">
            <div className="compare-toggle" role="group" aria-label="Compare">
              <button
                className={`btn ${!showOriginal && !editor.isPristineOriginal ? 'primary' : ''}`}
                onClick={() => setShowOriginal(false)}
              >
                Edited
              </button>
              <button
                className={`btn ${showOriginal || editor.isPristineOriginal ? 'primary' : ''}`}
                onClick={() => setShowOriginal(true)}
              >
                Original
              </button>
            </div>
            <CompareSlider
              before={editor.originalUrl}
              after={compareUrl}
              processing={editor.processing}
              same={editor.isPristineOriginal}
            />
          </section>

          <aside className="col col-right">
            {editor.current && (
              <ManualEditor
                current={editor.current}
                canUndo={editor.canUndo}
                canRedo={editor.canRedo}
                onSlider={editor.setSlider}
                onCommit={editor.commit}
                onUndo={editor.undo}
                onRedo={editor.redo}
                onAuto={editor.resetManual}
                savedPresets={editor.savedPresets}
                onSavePreset={editor.savePreset}
                onApplySaved={editor.applySavedPreset}
              />
            )}
          </aside>
        </main>
      )}

      {editor.error && editor.originalUrl && <div className="toast">{editor.error}</div>}

      <footer className="footer muted small">
        OnePhoto processes everything locally in your browser — your photos never leave your device
        unless you explicitly configure an external AI service.
      </footer>
    </div>
  );
}
