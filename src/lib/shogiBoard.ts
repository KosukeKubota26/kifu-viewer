import type { GameNode } from './kifParser';
import {
  type BoardState,
  type PieceType,
  type Player,
  initialBoard,
  squareToIndex,
  promote,
  demote,
} from './pieces';

// ノードを1手適用して新しい BoardState を返す
export function applyMove(state: BoardState, node: GameNode): BoardState {
  // deep copy
  const board = state.board.map(row => row.map(cell => cell ? { ...cell } : null));
  const hand = {
    sente: { ...state.hand.sente },
    gote: { ...state.hand.gote },
  };

  const player: Player = node.player;

  if (node.isDrop) {
    // 打ち
    const [toRow, toCol] = squareToIndex(node.toSquare);
    board[toRow]![toCol] = { type: node.pieceType as PieceType, player };
    const h = hand[player];
    const cnt = h[node.pieceType as PieceType] ?? 0;
    if (cnt <= 1) delete h[node.pieceType as PieceType];
    else h[node.pieceType as PieceType] = cnt - 1;
  } else {
    // 通常手 / 成り
    const [toRow, toCol] = squareToIndex(node.toSquare === 'same' ? state.lastTo ?? '55' : node.toSquare);

    // 取った駒を持ち駒に
    const captured = board[toRow]![toCol];
    if (captured) {
      const baseType = demote(captured.type);
      hand[player][baseType] = (hand[player][baseType] ?? 0) + 1;
    }

    // 移動元を空に
    if (node.fromSquare) {
      const [fromRow, fromCol] = squareToIndex(node.fromSquare);
      board[fromRow]![fromCol] = null;
    } else {
      // fromSquare が不明な場合は board から探す
      outer: for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const p = board[r]![c];
          if (p && p.player === player && p.type === (node.pieceType as PieceType)) {
            board[r]![c] = null;
            break outer;
          }
        }
      }
    }

    // 駒を配置 (成りを考慮)
    const pieceType = node.promoted
      ? promote(node.pieceType as PieceType)
      : (node.pieceType as PieceType);
    board[toRow]![toCol] = { type: pieceType, player };
  }

  const lastTo = node.toSquare === 'same' ? state.lastTo : node.toSquare;

  return { board, hand, lastTo };
}

// ルートから指定ノードまで指し手を全て適用した盤面を返す
export function buildBoardState(path: GameNode[]): BoardState {
  let state = initialBoard();
  // path[0] は root (開始局面)、path[1] から実際の手
  for (let i = 1; i < path.length; i++) {
    state = applyMove(state, path[i]!);
  }
  return state;
}

// 相手側から見た場合の盤面を返す（後手視点）
export function flipBoard(state: BoardState): BoardState {
  const board = state.board.slice().reverse().map(row => row.slice().reverse());
  return { ...state, board };
}
