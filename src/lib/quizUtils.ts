import type { GameNode } from './kifParser';

// DFS でクイズ対象局面を収集する（root 除外）
// 1) children >= 2 かつ非打ち駒あり（複数候補局面）
// 2) children == 1（非打ち駒）かつ（孫 >= 2 OR 子にコメントあり）（重要局面）
export function collectQuizPositions(root: GameNode): GameNode[] {
  const result: GameNode[] = [];
  function dfs(node: GameNode) {
    if (node.moveNumber > 0) {
      if (node.children.length >= 2) {
        const hasNonDrop = node.children.some(c => !c.isDrop);
        if (hasNonDrop) result.push(node);
      } else if (node.children.length === 1 && !node.children[0]!.isDrop) {
        const child = node.children[0]!;
        if (child.children.length >= 2 || child.comment) result.push(node);
      }
    }
    for (const child of node.children) dfs(child);
  }
  dfs(root);
  return result;
}

// サブツリー内の全評価値から nextPlayer 視点の最良値を返す
function bestEvalInSubtree(node: GameNode, nextPlayer: 'sente' | 'gote'): number | undefined {
  const evals: number[] = [];
  function dfs(n: GameNode) {
    if (n.evaluation !== undefined) evals.push(n.evaluation);
    for (const c of n.children) dfs(c);
  }
  dfs(node);
  if (evals.length === 0) return undefined;
  return nextPlayer === 'sente' ? Math.max(...evals) : Math.min(...evals);
}

// 次の手番視点で最善の子ノードを返す
// 1) 直接評価値を持つ子のみで比較
// 2) 全員直接評価なし → サブツリー内最良評価でフォールバック
// 3) それもなければ children[0]（主変化）
export function getBestChild(parent: GameNode): GameNode {
  const children = parent.children;
  if (children.length === 1) return children[0]!;

  const nextPlayer = children[0]!.player;
  const withEval = children.filter(c => c.evaluation !== undefined);

  if (withEval.length > 0) {
    return withEval.reduce((best, c) => {
      const bv = best.evaluation!;
      const cv = c.evaluation!;
      return nextPlayer === 'sente' ? (cv > bv ? c : best) : (cv < bv ? c : best);
    });
  }

  // 直接評価なし → サブツリー最良評価でフォールバック
  const withSubEval = children
    .map(c => ({ c, ev: bestEvalInSubtree(c, nextPlayer) }))
    .filter(x => x.ev !== undefined) as { c: GameNode; ev: number }[];

  if (withSubEval.length === 0) return children[0]!;

  return withSubEval.reduce((best, cur) =>
    nextPlayer === 'sente' ? (cur.ev > best.ev ? cur : best) : (cur.ev < best.ev ? cur : best)
  ).c;
}
