interface Props {
  evaluation?: number;
  depth?: number;
  engine?: string;
}

// 評価値を 0〜1 の比率に変換（先手有利 → 1、後手有利 → 0）
function evalToRatio(ev: number): number {
  // sigmoid で 0〜1 に変換、1000cp ≒ 75%
  const clamped = Math.max(-3000, Math.min(3000, ev));
  return 1 / (1 + Math.exp(-clamped / 600));
}

export default function EvalBar({ evaluation, depth, engine }: Props) {
  if (evaluation === undefined) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
        <div className="h-4 flex-1 rounded bg-gray-200" />
        <span>評価値なし</span>
      </div>
    );
  }

  const ratio = evalToRatio(evaluation);
  const sentePercent = ratio * 100;
  const gotePercent = 100 - sentePercent;
  const label = evaluation > 0 ? `▲+${evaluation}` : evaluation < 0 ? `△+${Math.abs(evaluation)}` : '互角';

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center gap-2">
        {/* バー */}
        <div className="flex-1 h-5 rounded overflow-hidden flex bg-gray-800">
          <div
            className="bg-gray-100 transition-all duration-300"
            style={{ width: `${sentePercent}%` }}
          />
          <div
            className="bg-gray-800 transition-all duration-300"
            style={{ width: `${gotePercent}%` }}
          />
        </div>
        {/* 数値 */}
        <span className={`text-sm font-bold w-20 text-right ${evaluation > 0 ? 'text-blue-700' : evaluation < 0 ? 'text-red-700' : 'text-gray-600'}`}>
          {label}
        </span>
      </div>
      {(depth !== undefined || engine) && (
        <p className="text-xs text-gray-400 truncate">
          {depth !== undefined && `深さ ${depth}`}
          {depth !== undefined && engine && ' | '}
          {engine}
        </p>
      )}
    </div>
  );
}
