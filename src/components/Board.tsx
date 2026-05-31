import type { BoardState, PieceType } from '../lib/pieces';
import { PIECE_DISPLAY, squareToIndex } from '../lib/pieces';

interface Props {
  boardState: BoardState;
  lastMove?: string;
  flipped?: boolean;
  selectedSquare?: string | null;
  highlightSquares?: string[];
  sourceSquares?: string[];
  onSquareClick?: (square: string) => void;
  selectedHandPiece?: { type: PieceType; player: 'sente' | 'gote' } | null;
  onHandClick?: (piece: PieceType, player: 'sente' | 'gote') => void;
}

const COL_LABELS_NORMAL  = ['９', '８', '７', '６', '５', '４', '３', '２', '１'];
const ROW_LABELS_NORMAL  = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const COL_LABELS_FLIPPED = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
const ROW_LABELS_FLIPPED = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];

function HandArea({
  pieces, label, player, selectedType, onHandClick,
}: {
  pieces: Partial<Record<PieceType, number>>;
  label: string;
  player: 'sente' | 'gote';
  selectedType?: PieceType | null;
  onHandClick?: (piece: PieceType, player: 'sente' | 'gote') => void;
}) {
  const entries = Object.entries(pieces).filter(([, v]) => v && v > 0);
  return (
    <div className="flex flex-wrap items-center gap-1 rounded bg-amber-50 px-2 py-1 min-h-8">
      <span className="text-xs text-gray-500 mr-1">{label}：</span>
      {entries.length === 0 && <span className="text-xs text-gray-400">なし</span>}
      {entries.map(([type, cnt]) => {
        const t = type as PieceType;
        const isSelected = selectedType === t;
        return (
          <span
            key={t}
            onClick={() => onHandClick?.(t, player)}
            className={`inline-flex items-center gap-0.5 text-sm font-bold rounded px-0.5
              ${player === 'gote' ? 'text-red-700' : 'text-gray-900'}
              ${onHandClick ? 'cursor-pointer' : ''}
              ${isSelected ? 'bg-blue-300' : onHandClick ? 'hover:bg-amber-200' : ''}`}
          >
            {PIECE_DISPLAY[t]}
            {cnt! > 1 && <span className="text-xs font-normal">{cnt}</span>}
          </span>
        );
      })}
    </div>
  );
}

export default function Board({
  boardState, lastMove, flipped = false,
  selectedSquare, highlightSquares, sourceSquares, onSquareClick,
  selectedHandPiece, onHandClick,
}: Props) {
  const { board, hand } = boardState;

  const lastIdx    = lastMove && lastMove !== 'same' ? squareToIndex(lastMove) : null;
  const selIdx     = selectedSquare ? squareToIndex(selectedSquare) : null;
  const hlIdxSet   = new Set((highlightSquares ?? []).map(sq => squareToIndex(sq).join()));
  const srcIdxSet  = new Set((sourceSquares ?? []).map(sq => squareToIndex(sq).join()));

  const colLabels = flipped ? COL_LABELS_FLIPPED : COL_LABELS_NORMAL;
  const rowLabels = flipped ? ROW_LABELS_FLIPPED : ROW_LABELS_NORMAL;

  function actual(ri: number, ci: number): [number, number] {
    return flipped ? [8 - ri, 8 - ci] : [ri, ci];
  }

  function cellToSquare(ri: number, ci: number): string {
    return flipped ? `${ci + 1}${9 - ri}` : `${9 - ci}${ri + 1}`;
  }

  const senteHandSelected = selectedHandPiece?.player === 'sente' ? selectedHandPiece.type : null;
  const goteHandSelected  = selectedHandPiece?.player === 'gote'  ? selectedHandPiece.type : null;

  return (
    <div className="flex flex-col gap-1 select-none">
      {/* 上の持ち駒 */}
      {flipped
        ? <HandArea pieces={hand.sente} label="▲持ち駒" player="sente"
            selectedType={senteHandSelected} onHandClick={onHandClick} />
        : <HandArea pieces={hand.gote}  label="△持ち駒" player="gote"
            selectedType={goteHandSelected} onHandClick={onHandClick} />
      }

      <div className="relative">
        <div className="flex pl-6 pr-0 mb-0.5">
          {colLabels.map(l => (
            <div key={l} className="flex-1 text-center text-xs text-gray-500">{l}</div>
          ))}
          <div className="w-5" />
        </div>

        <div className="flex">
          <div
            className="grid border border-gray-700"
            style={{ gridTemplateColumns: 'repeat(9, 1fr)', gridTemplateRows: 'repeat(9, 1fr)' }}
          >
            {Array.from({ length: 9 }, (_, ri) =>
              Array.from({ length: 9 }, (_, ci) => {
                const [ari, aci] = actual(ri, ci);
                const piece  = board[ari]?.[aci] ?? null;
                const sq     = cellToSquare(ri, ci);
                const key    = [ari, aci].join();

                const isLast = lastIdx !== null && lastIdx[0] === ari && lastIdx[1] === aci;
                const isSel  = selIdx !== null  && selIdx[0]  === ari && selIdx[1]  === aci;
                const isHl   = hlIdxSet.has(key);
                const isSrc  = srcIdxSet.has(key);

                const isGote = piece?.player === 'gote';
                const shouldRotate = flipped ? !isGote : isGote;

                let bg = (ri + ci) % 2 === 0 ? 'bg-amber-100' : 'bg-amber-50';
                if (isSrc)  bg = 'bg-sky-100';
                if (isLast) bg = 'bg-yellow-200';
                if (isHl)   bg = 'bg-green-200';
                if (isSel)  bg = 'bg-blue-300';

                return (
                  <div
                    key={`${ri}-${ci}`}
                    onClick={() => onSquareClick?.(sq)}
                    className={`flex items-center justify-center border border-gray-400 aspect-square
                      ${bg} ${onSquareClick ? 'cursor-pointer active:brightness-75' : ''}`}
                    style={{ width: 'min(9.5vw, 52px)', height: 'min(9.5vw, 52px)' }}
                  >
                    {piece && (
                      <span
                        className={`font-bold leading-none select-none
                          ${isGote ? 'text-red-700' : 'text-gray-900'}
                          ${shouldRotate ? 'rotate-180' : ''}`}
                        style={{ fontSize: 'min(3.5vw, 18px)' }}
                      >
                        {PIECE_DISPLAY[piece.type]}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-col ml-0.5">
            {rowLabels.map(l => (
              <div
                key={l}
                className="flex items-center justify-center text-xs text-gray-500"
                style={{ height: 'min(9.5vw, 52px)' }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 下の持ち駒 */}
      {flipped
        ? <HandArea pieces={hand.gote}  label="△持ち駒" player="gote"
            selectedType={goteHandSelected} onHandClick={onHandClick} />
        : <HandArea pieces={hand.sente} label="▲持ち駒" player="sente"
            selectedType={senteHandSelected} onHandClick={onHandClick} />
      }
    </div>
  );
}
