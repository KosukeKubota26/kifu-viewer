interface Props {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onFlip: () => void;
  canPrev: boolean;
  canNext: boolean;
  moveNumber: number;
  totalMoves: number;
  flipped: boolean;
}

export default function Controls({
  onFirst, onPrev, onNext, onLast, onFlip,
  canPrev, canNext, moveNumber, totalMoves, flipped,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={onFirst}
        disabled={!canPrev}
        className="rounded px-3 py-2 text-lg font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
        title="最初"
      >
        ⏮
      </button>
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="rounded px-3 py-2 text-lg font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
        title="前の手 (←)"
      >
        ◀
      </button>
      <span className="text-sm text-gray-600 w-24 text-center">
        {moveNumber} / {totalMoves} 手
      </span>
      <button
        onClick={onNext}
        disabled={!canNext}
        className="rounded px-3 py-2 text-lg font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
        title="次の手 (→)"
      >
        ▶
      </button>
      <button
        onClick={onLast}
        disabled={!canNext}
        className="rounded px-3 py-2 text-lg font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
        title="最後"
      >
        ⏭
      </button>
      <button
        onClick={onFlip}
        className={`rounded px-2 py-2 text-sm font-bold border
          ${flipped ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 hover:bg-gray-200 border-gray-300'}`}
        title="盤面反転"
      >
        反転
      </button>
    </div>
  );
}
