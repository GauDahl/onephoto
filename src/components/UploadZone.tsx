import { useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  compact?: boolean;
}

export default function UploadZone({ onFiles, multiple, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) onFiles(files);
  };

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''} ${compact ? 'compact' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Upload photos"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
      />
      <div className="dropzone-icon" aria-hidden>◉</div>
      <p className="dropzone-title">{compact ? 'Add photos' : 'Drop your photo here'}</p>
      <p className="dropzone-sub">
        {multiple ? 'Add as many as you like' : 'One photo is all it takes'} · JPG, PNG, WebP · processed on your device
      </p>
    </div>
  );
}
