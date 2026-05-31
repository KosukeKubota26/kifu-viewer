// USI 形式の指し手を人間可読に変換する簡易関数
function usiToReadable(usiMove: string): string {
  if (!usiMove || usiMove === '(none)') return '';

  // 打ち: "P*5e" 形式
  const dropMatch = /^([A-Z])\*(\d)([a-i])$/.exec(usiMove);
  if (dropMatch) {
    const piece = USI_PIECE[dropMatch[1]!] ?? dropMatch[1];
    const col = dropMatch[2];
    const row = USI_ROW[dropMatch[3]!] ?? dropMatch[3];
    return `${col}${row}${piece}打`;
  }

  // 通常手: "7g7f" or "8h2b+" 形式
  const moveMatch = /^(\d)([a-i])(\d)([a-i])(\+)?$/.exec(usiMove);
  if (moveMatch) {
    const fromCol = moveMatch[1];
    const fromRow = USI_ROW[moveMatch[2]!] ?? moveMatch[2];
    const toCol = moveMatch[3];
    const toRow = USI_ROW[moveMatch[4]!] ?? moveMatch[4];
    const prom = moveMatch[5] ? '成' : '';
    return `${fromCol}${fromRow}→${toCol}${toRow}${prom}`;
  }

  return usiMove;
}

const USI_PIECE: Record<string, string> = {
  P: '歩', L: '香', N: '桂', S: '銀', G: '金',
  B: '角', R: '飛', K: '王',
};

const USI_ROW: Record<string, string> = {
  a: '一', b: '二', c: '三', d: '四', e: '五',
  f: '六', g: '七', h: '八', i: '九',
};

interface Props {
  candidates?: string;
  comment?: string;
}

export default function CandidateList({ candidates, comment }: Props) {
  if (!candidates && !comment) return null;

  const moves = candidates
    ? candidates.trim().split(/\s+/).filter(Boolean).slice(0, 10)
    : [];

  return (
    <div className="flex flex-col gap-2 text-sm">
      {comment && (
        <p className="text-gray-700 whitespace-pre-wrap text-xs border-l-2 border-blue-300 pl-2">
          {comment}
        </p>
      )}
      {moves.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">候補手</p>
          <div className="flex flex-wrap gap-1">
            {moves.map((m, i) => (
              <span
                key={i}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700"
                title={m}
              >
                {i + 1}. {usiToReadable(m)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
