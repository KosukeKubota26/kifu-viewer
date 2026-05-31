import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameNode, GameTree } from './lib/kifParser';
import { parseKifFile, pathToNode } from './lib/kifParser';
import { buildBoardState } from './lib/shogiBoard';
import type { BoardState, PieceType } from './lib/pieces';
import { initialBoard } from './lib/pieces';
import { collectQuizPositions, getBestChild } from './lib/quizUtils';
import Board from './components/Board';
import Controls from './components/Controls';
import EvalBar from './components/EvalBar';
import MoveTree from './components/MoveTree';
import CandidateList from './components/CandidateList';
import FileDropZone from './components/FileDropZone';
import QuizPanel from './components/QuizPanel';
import type { QuizState } from './components/QuizPanel';

export default function App() {
  const [tree, setTree] = useState<GameTree | null>(null);
  const [currentNode, setCurrentNode] = useState<GameNode | null>(null);
  const [boardState, setBoardState] = useState<BoardState>(initialBoard());
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [selectedDropPiece, setSelectedDropPiece] = useState<{ type: PieceType; player: 'sente' | 'gote' } | null>(null);
  const [scrollTree, setScrollTree] = useState(false);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [transitionSteps, setTransitionSteps] = useState<GameNode[]>([]);
  // null でなければ「次クイズへの遷移が完了、クリックでクイズ開始」状態
  const [pendingQuizStart, setPendingQuizStart] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  async function handleFile(file: File) {
    try {
      setError(null);
      const t = await parseKifFile(file);
      setTree(t);
      setCurrentNode(t.root);
      setBoardState(initialBoard());
      setSelectedSquare(null);
      setSelectedDropPiece(null);
      setQuizState(null);
    } catch (e) {
      setError(`ファイルの読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const navigate = useCallback((node: GameNode, fromTree = false) => {
    if (!tree) return;
    const path = pathToNode(tree.root, node);
    setBoardState(buildBoardState(path));
    setCurrentNode(node);
    setSelectedSquare(null);
    setSelectedDropPiece(null);
    setScrollTree(fromTree);
  }, [tree]);

  function goFirst() { if (tree) navigate(tree.root); }
  function goPrev()  { if (currentNode?.parent) navigate(currentNode.parent); }
  function goNext()  { if (currentNode && currentNode.children.length > 0) navigate(currentNode.children[0]!); }
  function goLast()  {
    if (!currentNode) return;
    let n = currentNode;
    while (n.children.length > 0) n = n.children[0]!;
    navigate(n);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (quizState) return;
      if (e.key === 'ArrowLeft')       goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowUp')    goFirst();
      else if (e.key === 'ArrowDown')  goLast();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (quizState) return;
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (dx > 50) goPrev();
    else if (dx < -50) goNext();
    touchStartX.current = null;
  }

  // ---- クイズ機能 ----

  // correctChild から target まで子ノードを辿る前向きパスを返す（見つからなければ空）
  function findPathForward(from: GameNode, target: GameNode): GameNode[] {
    function dfs(node: GameNode, path: GameNode[]): GameNode[] | null {
      if (node.id === target.id) return path;
      for (const child of node.children) {
        const found = dfs(child, [...path, child]);
        if (found) return found;
      }
      return null;
    }
    return dfs(from, []) ?? [];
  }

  function orderByConnectivity(sorted: GameNode[]): GameNode[] {
    if (sorted.length <= 1) return sorted;
    const remaining = [...sorted];
    const result: GameNode[] = [remaining.shift()!];
    while (remaining.length > 0) {
      const cur = result[result.length - 1]!;
      const best = getBestChild(cur);
      let bestIdx = -1, bestLen = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const path = findPathForward(best, remaining[i]!);
        if (path.length > 0 && path.length < bestLen) {
          bestLen = path.length;
          bestIdx = i;
        }
      }
      result.push(bestIdx >= 0 ? remaining.splice(bestIdx, 1)[0]! : remaining.shift()!);
    }
    return result;
  }

  function startQuiz() {
    if (!tree) return;
    const nearPlayer = flipped ? 'gote' : 'sente';
    const positions = orderByConnectivity(
      collectQuizPositions(tree.root)
        .filter(p => p.children[0]?.player === nearPlayer)
        .sort((a, b) => a.moveNumber - b.moveNumber)
    );
    if (positions.length === 0) return;
    setTransitionSteps([]);
    setPendingQuizStart(null);
    navigate(positions[0]!);
    setQuizState({
      positions,
      index: 0,
      phase: 'question',
      answeredChild: null,
      correctChild: null,
      correct: 0,
      total: 0,
      answers: new Array(positions.length).fill(null),
    });
  }

  function advanceToNextQuestion(nextIndex: number, doNavigate = true) {
    const nextAnswer = quizState!.answers[nextIndex] ?? null;
    if (doNavigate && nextIndex < quizState!.positions.length) {
      navigate(quizState!.positions[nextIndex]!);
    }
    setTransitionSteps([]);
    setPendingQuizStart(null);
    setQuizState(prev => prev ? {
      ...prev,
      index: nextIndex,
      phase: nextAnswer ? 'answered' : 'question',
      answeredChild: nextAnswer?.answeredChild ?? null,
      correctChild: nextAnswer?.correctChild ?? null,
    } : null);
  }

  function nextQuestion() {
    if (!quizState) return;
    const nextIndex = quizState.index + 1;

    // 遷移完了・クイズ開始待ち
    if (pendingQuizStart !== null) {
      advanceToNextQuestion(pendingQuizStart, false); // すでに盤面は到達済み
      return;
    }

    // 遷移ステップ中: 1手進める
    if (transitionSteps.length > 0) {
      const [next, ...remaining] = transitionSteps;
      navigate(next!);
      if (remaining.length === 0) {
        // 最後のステップを踏んだ → 次クリックでクイズ開始
        setPendingQuizStart(nextIndex);
      } else {
        setTransitionSteps(remaining);
      }
      return;
    }

    // 正解していた場合のみ前向き遷移を試みる
    const wasCorrect = quizState.answeredChild !== null &&
      quizState.answeredChild.id === quizState.correctChild?.id;

    if (wasCorrect && quizState.correctChild && nextIndex < quizState.positions.length) {
      const nextQuizPos = quizState.positions[nextIndex]!;
      const path = findPathForward(quizState.correctChild, nextQuizPos);
      if (path.length > 0) {
        // 最初のステップへ進む
        navigate(path[0]!);
        const remaining = path.slice(1);
        if (remaining.length === 0) {
          // path[0] が次のクイズ局面 → 次クリックでクイズ開始
          setPendingQuizStart(nextIndex);
        } else {
          setTransitionSteps(remaining);
        }
        return;
      }
    }

    // パスなし or 不正解 or 諦め → 直接ジャンプ
    advanceToNextQuestion(nextIndex);
  }

  function prevQuestion() {
    // 遷移中・待機中はキャンセルして現在の問題に戻る
    if (transitionSteps.length > 0 || pendingQuizStart !== null) {
      setTransitionSteps([]);
      setPendingQuizStart(null);
      navigate(quizState!.positions[quizState!.index]!);
      return;
    }
    if (!quizState || quizState.index <= 0) return;
    const prevIndex = quizState.index - 1;
    navigate(quizState.positions[prevIndex]!);
    const prevAnswer = quizState.answers[prevIndex] ?? null;
    setQuizState(prev => prev ? {
      ...prev,
      index: prevIndex,
      phase: prevAnswer ? 'answered' : 'question',
      answeredChild: prevAnswer?.answeredChild ?? null,
      correctChild: prevAnswer?.correctChild ?? null,
    } : null);
  }

  function giveUp() {
    setTransitionSteps([]);
    setPendingQuizStart(null);
    if (!quizState || !currentNode || quizState.phase !== 'question') return;
    const best = getBestChild(currentNode);
    const alreadyAnswered = quizState.answers[quizState.index] != null;
    navigate(best);
    setQuizState(prev => {
      if (!prev) return null;
      const newAnswers = [...prev.answers];
      if (!alreadyAnswered) {
        newAnswers[prev.index] = { answeredChild: null, correctChild: best, wasCorrect: false };
      }
      return { ...prev, phase: 'answered', answeredChild: null, correctChild: best, answers: newAnswers };
    });
  }

  function quitQuiz() {
    setQuizState(null);
    setTransitionSteps([]);
    setPendingQuizStart(null);
    setSelectedSquare(null);
    setSelectedDropPiece(null);
  }

  // ---- 持ち駒クリック ----

  function onHandClick(type: PieceType, player: 'sente' | 'gote') {
    if (quizState && quizState.phase !== 'question') return;
    setSelectedSquare(null);
    setSelectedDropPiece(prev =>
      prev?.type === type && prev?.player === player ? null : { type, player }
    );
  }

  // ---- 盤面クリック ----

  const validFromSquares = useMemo(() => {
    const set = new Set<string>();
    for (const child of currentNode?.children ?? []) {
      if (!child.isDrop && child.fromSquare) set.add(child.fromSquare);
    }
    return set;
  }, [currentNode]);

  const selectedMoves = useMemo(() => {
    if (!selectedSquare || !currentNode) return [];
    return currentNode.children
      .filter(c => c.fromSquare === selectedSquare)
      .map(c => ({
        node: c,
        toSquare: c.toSquare === 'same' ? (boardState.lastTo ?? '') : c.toSquare,
      }))
      .filter(m => m.toSquare);
  }, [selectedSquare, currentNode, boardState.lastTo]);

  const highlightSquares = useMemo(
    () => selectedMoves.map(m => m.toSquare),
    [selectedMoves],
  );

  const sourceSquares = useMemo(
    () => [...validFromSquares],
    [validFromSquares],
  );

  function recordQuizAnswer(match: GameNode) {
    if (!currentNode || !quizState || quizState.phase !== 'question') return;
    const best = getBestChild(currentNode);
    const isCorrect = match.id === best.id;
    const alreadyAnswered = quizState.answers[quizState.index] != null;
    navigate(match);
    setQuizState(prev => {
      if (!prev) return null;
      const newAnswers = [...prev.answers];
      if (!alreadyAnswered) {
        newAnswers[prev.index] = { answeredChild: match, correctChild: best, wasCorrect: isCorrect };
      }
      return {
        ...prev,
        phase: 'answered',
        answeredChild: match,
        correctChild: best,
        correct: prev.correct + (!alreadyAnswered && isCorrect ? 1 : 0),
        total: prev.total + (!alreadyAnswered ? 1 : 0),
        answers: newAnswers,
      };
    });
  }

  function onSquareClick(sq: string) {
    if (!currentNode) return;
    if (quizState && quizState.phase !== 'question') return;

    // 持ち駒選択中 → 打ち駒として処理
    if (selectedDropPiece) {
      const match = currentNode.children.find(c => {
        const childTo = c.toSquare === 'same' ? (boardState.lastTo ?? '') : c.toSquare;
        return c.isDrop && c.pieceType === selectedDropPiece.type && childTo === sq;
      });
      if (match) {
        if (quizState && quizState.phase === 'question') {
          recordQuizAnswer(match);
        } else {
          navigate(match);
        }
      } else {
        setSelectedDropPiece(null);
      }
      return;
    }

    // ---- クイズモード ----
    if (quizState && quizState.phase === 'question') {
      if (selectedSquare === sq) { setSelectedSquare(null); return; }
      if (selectedSquare) {
        const match = currentNode.children.find(c => {
          const childTo = c.toSquare === 'same' ? (boardState.lastTo ?? '') : c.toSquare;
          return !c.isDrop && c.fromSquare === selectedSquare && childTo === sq;
        });
        if (match) { recordQuizAnswer(match); return; }
      }
      setSelectedSquare(sq);
      return;
    }

    // ---- 通常モード ----
    if (selectedSquare === sq) { setSelectedSquare(null); return; }
    if (selectedSquare) {
      const match = selectedMoves.find(m => m.toSquare === sq);
      if (match) { navigate(match.node); return; }
    }
    if (validFromSquares.has(sq)) { setSelectedSquare(sq); return; }
    setSelectedSquare(null);
  }

  // クイズ用ハイライト（回答後に正解手を表示）
  const quizHighlightSquares = useMemo(() => {
    if (!quizState || quizState.phase !== 'answered' || !quizState.correctChild) return [];
    const c = quizState.correctChild;
    const to = c.toSquare === 'same' ? (boardState.lastTo ?? '') : c.toSquare;
    return to ? [to] : [];
  }, [quizState, boardState.lastTo]);

  const quizSourceSquares = useMemo(() => {
    if (!quizState || quizState.phase !== 'answered' || !quizState.correctChild) return [];
    const c = quizState.correctChild;
    return !c.isDrop && c.fromSquare ? [c.fromSquare] : [];
  }, [quizState]);

  const boardHighlightSquares = quizState ? quizHighlightSquares : highlightSquares;
  const boardSourceSquares    = quizState ? quizSourceSquares    : sourceSquares;

  function countMainLine(root: GameNode): number {
    let n = root; let count = 0;
    while (n.children.length > 0) { n = n.children[0]!; count++; }
    return count;
  }

  const canPrev    = !!currentNode?.parent;
  const canNext    = !!currentNode && currentNode.children.length > 0;
  const moveNumber = currentNode?.moveNumber ?? 0;
  const totalMoves = tree ? countMainLine(tree.root) : 0;
  const node       = currentNode && currentNode.moveNumber > 0 ? currentNode : null;

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
        <h1 className="font-bold text-base truncate">
          {tree ? tree.title : '棋譜ビューワー'}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {tree && !quizState && (
            <button
              className="text-xs bg-indigo-600 hover:bg-indigo-500 rounded px-2 py-1 font-bold"
              onClick={startQuiz}
            >
              クイズ
            </button>
          )}
          {tree && quizState && (
            <button
              className="text-xs bg-orange-600 hover:bg-orange-500 rounded px-2 py-1"
              onClick={quitQuiz}
            >
              クイズ終了
            </button>
          )}
          <button
            className="text-xs bg-gray-600 hover:bg-gray-500 rounded px-2 py-1"
            onClick={() => {
              setTree(null);
              setCurrentNode(null);
              setBoardState(initialBoard());
              setSelectedSquare(null);
              setSelectedDropPiece(null);
              setQuizState(null);
            }}
          >
            ファイルを変更
          </button>
        </div>
      </header>

      {!tree ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <p className="text-center text-gray-600 mb-4 font-medium">将棋棋譜ビューワー</p>
            <FileDropZone onFile={handleFile} />
            {error && (
              <p className="mt-3 text-red-600 text-sm text-center">{error}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
          <div className="flex flex-col items-center gap-2 p-3 lg:w-auto lg:shrink-0">
            <Board
              boardState={boardState}
              lastMove={boardState.lastTo}
              flipped={flipped}
              selectedSquare={selectedSquare}
              highlightSquares={boardHighlightSquares}
              sourceSquares={boardSourceSquares}
              onSquareClick={onSquareClick}
              selectedHandPiece={selectedDropPiece}
              onHandClick={onHandClick}
            />

            {quizState ? (
              <button
                onClick={() => setFlipped(v => !v)}
                className={`rounded px-2 py-1.5 text-xs font-bold border
                  ${flipped ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 hover:bg-gray-200 border-gray-300'}`}
              >
                盤反転
              </button>
            ) : (
              <Controls
                onFirst={goFirst}
                onPrev={goPrev}
                onNext={goNext}
                onLast={goLast}
                onFlip={() => setFlipped(v => !v)}
                canPrev={canPrev}
                canNext={canNext}
                moveNumber={moveNumber}
                totalMoves={totalMoves}
                flipped={flipped}
              />
            )}

            {!quizState && (
              <div className="w-full max-w-sm">
                <EvalBar
                  evaluation={node?.evaluation}
                  depth={node?.depth}
                  engine={node?.engine}
                />
              </div>
            )}

            <div className="w-full max-w-sm lg:hidden">
              {quizState ? (
                <QuizPanel
                  quizState={quizState}
                  onNextQuestion={nextQuestion}
                  onPrevQuestion={prevQuestion}
                  onGiveUp={giveUp}
                  onQuitQuiz={quitQuiz}
                  transitionStepsLeft={transitionSteps.length}
                  isReadyToStart={pendingQuizStart !== null}
                />
              ) : (
                <CandidateList candidates={node?.candidates} comment={node?.comment} />
              )}
            </div>
          </div>

          <div className={`flex-1 flex flex-col overflow-hidden border-t lg:border-t-0 lg:border-l border-gray-200${quizState ? ' hidden lg:flex' : ''}`}>
            {quizState ? (
              <div className="p-4 flex-1 overflow-y-auto">
                <QuizPanel
                  quizState={quizState}
                  onNextQuestion={nextQuestion}
                  onPrevQuestion={prevQuestion}
                  onGiveUp={giveUp}
                  onQuitQuiz={quitQuiz}
                  transitionStepsLeft={transitionSteps.length}
                  isReadyToStart={pendingQuizStart !== null}
                />
              </div>
            ) : (
              <>
                <div className="hidden lg:block p-3 border-b border-gray-200 min-h-16">
                  <CandidateList candidates={node?.candidates} comment={node?.comment} />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <p className="text-xs text-gray-400 mb-1 px-1">棋譜ツリー</p>
                  <MoveTree
                    root={tree.root}
                    currentNode={currentNode ?? tree.root}
                    onSelect={n => navigate(n, true)}
                    scrollToSelected={scrollTree}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
