import { useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
}

export default function FileDropZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors
        ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <p className="text-gray-500 text-sm">KIF ファイルをドロップ</p>
      <p className="text-gray-400 text-xs">または</p>
      <button
        className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700"
        onClick={() => inputRef.current?.click()}
      >
        ファイルを選択
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".kif,.KIF"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}
