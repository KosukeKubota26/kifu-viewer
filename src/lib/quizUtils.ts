import type { GameNode } from './kifParser';

// DFS でクイズ対象局面を収集する（root 除外）
// 1) children >= 2 かつ非打ち駒あり（複数候補局面）
// 2) children == 1（非打ち駒）かつその子への相手応手が 2 以上（重要局面）
export function collectQuizPositions(root: GameNode): GameNode[] {
  const result: GameNode[] = [];
  function dfs(node: GameNode) {
    if (node.moveNumber > 0) {
      if (node.children.length >= 2) {
        const hasNonDrop = node.children.some(c => !c.isDrop);
        if (hasNonDrop) result.push(node);
      } else if (node.children.length === 1 && !node.children[0]!.isDrop) {
        if (node.children[0]!.children.length >= 2) result.push(node);
      }
    }
    for (const child of node.children) dfs(child);
  }
  dfs(root);
  return result;
}

// 次の手番視点で最善の子ノードを返す
// 評価値がない子が混在する場合は評価値を持つ子のみで比較; 全員無評価なら children[0]
export function getBestChild(parent: GameNode): GameNode {
  const children = parent.children;
  if (children.length === 1) return children[0]!;

  const withEval = children.filter(c => c.evaluation !== undefined);
  if (withEval.length === 0) return children[0]!;

  // 次に指す側のプレイヤー（全 children で共通）
  const nextPlayer = children[0]!.player;

  return withEval.reduce((best, c) => {
    const bv = best.evaluation!;
    const cv = c.evaluation!;
    return nextPlayer === 'sente' ? (cv > bv ? c : best) : (cv < bv ? c : best);
  });
}
