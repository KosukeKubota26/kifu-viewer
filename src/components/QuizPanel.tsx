import type { GameNode } from '../lib/kifParser';

export type QuizPhase = 'question' | 'answered';

export interface QuizAnswer {
  answeredChild: GameNode | null;  // null = 諦めた
  correctChild: GameNode;
  wasCorrect: boolean;
}

export interface QuizState {
  positions: GameNode[];
  index: number;
  phase: QuizPhase;
  answeredChild: GameNode | null;
  correctChild: GameNode | null;
  correct: number;
  total: number;
  answers: (QuizAnswer | null)[];
}

interface Props {
  quizState: QuizState;
  onNextQuestion: () => void;
  onPrevQuestion: () => void;
  onGiveUp: () => void;
  onQuitQuiz: () => void;
  transitionStepsLeft?: number;
  isReadyToStart?: boolean;
}

function evalLabel(node: GameNode): string {
  if (node.evaluation === undefined) return '';
  const v = node.evaluation;
  return v > 0 ? `▲+${v}` : v < 0 ? `△+${Math.abs(v)}` : '互角';
}

function getContinuation(node: GameNode): GameNode[] {
  const moves: GameNode[] = [];
  let cur: GameNode | undefined = node.children[0];
  while (cur) {
    moves.push(cur);
    cur = cur.children[0];
  }
  return moves;
}

export default function QuizPanel({ quizState, onNextQuestion, onPrevQuestion, onGiveUp, onQuitQuiz, transitionStepsLeft = 0, isReadyToStart = false }: Props) {
  const { positions, index, phase, answeredChild, correctChild, correct, total } = quizState;
  const isFinished = index >= positions.length;
  const questionNum = Math.min(index + 1, positions.length);
  const totalNum = positions.length;

  const senteCount = positions.filter(p => p.children[0]?.player === 'sente').length;
  const goteCount = totalNum - senteCount;

  if (isFinished) {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="flex flex-col gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
        <h2 className="text-lg font-bold text-center text-gray-800">クイズ終了！</h2>
        <div className="text-center">
          <span className="text-4xl font-bold text-blue-600">{correct}</span>
          <span className="text-xl text-gray-500"> / {total} 問正解</span>
        </div>
        <p className="text-center text-gray-500 text-sm">正解率 {pct}%</p>
        <div className="flex justify-center gap-4 text-xs text-gray-500">
          <span>▲先手番 {senteCount}問</span>
          <span>△後手番 {goteCount}問</span>
        </div>
        <button
          onClick={onQuitQuiz}
          className="w-full rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4"
        >
          棋譜ビューワーに戻る
        </button>
      </div>
    );
  }

  const currentPlayer = positions[index]?.children[0]?.player;
  const isSente = currentPlayer === 'sente';
  const gaveUp = phase === 'answered' && answeredChild === null;
  const isCorrect = !gaveUp && answeredChild?.id === correctChild?.id;

  const continuation = (phase === 'answered' && correctChild) ? getContinuation(correctChild) : [];

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">
          第 {questionNum} 問 / {totalNum} 問
          <span className="text-xs font-normal text-gray-400 ml-1.5">
            （{positions[index]?.moveNumber}手目）
          </span>
        </span>
        <span className="text-xs text-gray-500">
          正解 {correct} / {total}
        </span>
      </div>

      {/* プログレスバー */}
      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${(questionNum - 1) / totalNum * 100}%` }}
        />
      </div>

      {phase === 'question' ? (
        <div className="flex flex-col gap-3">
          <div className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 font-bold text-sm
            ${isSente ? 'bg-gray-800 text-white' : 'bg-red-600 text-white'}`}>
            {isSente ? '▲ 先手番' : '△ 後手番'}
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">次の一手は？</p>
            <p className="text-xs text-gray-500 mt-0.5">盤面上のコマ（または持ち駒）をクリックして手を選んでください</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 手番バッジ（小） */}
          <div className={`inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 font-bold text-xs
            ${isSente ? 'bg-gray-800 text-white' : 'bg-red-600 text-white'}`}>
            {isSente ? '▲ 先手番' : '△ 後手番'}
          </div>

          {/* 正解 / 不正解 / 諦め バッジ */}
          {gaveUp ? (
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 border border-gray-300 px-3 py-2">
              <span className="text-gray-500 text-lg font-bold">－</span>
              <span className="text-gray-600 font-bold">正解を確認</span>
            </div>
          ) : isCorrect ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-100 border border-green-300 px-3 py-2">
              <span className="text-green-600 text-lg font-bold">○</span>
              <div>
                <p className="text-green-700 font-bold">正解！</p>
                {correctChild?.evaluation !== undefined && (
                  <p className="text-sm font-bold text-green-600">{evalLabel(correctChild)}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-3 py-2">
              <span className="text-red-500 text-lg font-bold">✕</span>
              <span className="text-red-700 font-bold">不正解</span>
            </div>
          )}

          {/* 正解手（不正解・諦め時） */}
          {(gaveUp || !isCorrect) && correctChild && (
            <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm">
              <p className="text-xs text-gray-500 mb-0.5">正解の一手</p>
              <p className="font-bold text-gray-900">{correctChild.notation}</p>
              {correctChild.evaluation !== undefined && (
                <p className="text-sm font-bold text-blue-600">{evalLabel(correctChild)}</p>
              )}
            </div>
          )}

          {/* 自分の手（不正解時のみ） */}
          {!gaveUp && !isCorrect && answeredChild && (
            <div className="rounded-lg bg-gray-100 border border-gray-200 px-3 py-2 text-sm">
              <p className="text-xs text-gray-400 mb-0.5">あなたの手</p>
              <p className="text-gray-600">{answeredChild.notation}</p>
              {answeredChild.evaluation !== undefined && (
                <p className="text-xs text-gray-500">{evalLabel(answeredChild)}</p>
              )}
            </div>
          )}

          {/* その後の進行（正解・諦め時） */}
          {(isCorrect || gaveUp) && continuation.length > 0 && (
            <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm">
              <p className="text-xs text-gray-500 mb-1.5">その後の進行</p>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {continuation.map(n => (
                  <span key={n.id}
                    className={`text-xs font-medium ${n.player === 'sente' ? 'text-gray-900' : 'text-red-700'}`}>
                    {n.notation}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ボタン */}
      <div className="flex flex-col gap-2 pt-1">
        {phase === 'answered' && (
          <button
            onClick={onNextQuestion}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 text-sm"
          >
            {transitionStepsLeft > 0
              ? `次の手 → (あと${transitionStepsLeft + 1}手)`
              : isReadyToStart
                ? 'クイズ開始 →'
                : index + 1 < positions.length ? '次の問題 →' : '結果を見る'}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={onPrevQuestion}
            disabled={index === 0}
            className="flex-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 text-gray-600 py-1.5 px-3 text-xs"
          >
            ← 前の問題
          </button>
          {phase === 'question' && (
            <button
              onClick={onGiveUp}
              className="flex-1 rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 py-1.5 px-3 text-xs font-medium"
            >
              諦めて正解を表示
            </button>
          )}
        </div>
        <button
          onClick={onQuitQuiz}
          className="w-full rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 py-1.5 px-4 text-xs"
        >
          クイズを終了
        </button>
      </div>
    </div>
  );
}
