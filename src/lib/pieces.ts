// 駒の種類
export type PieceType =
  | '歩' | '香' | '桂' | '銀' | '金' | '角' | '飛' | '王' | '玉'
  | 'と' | '成香' | '成桂' | '成銀' | '馬' | '龍';

export type Player = 'sente' | 'gote';

export interface Piece {
  type: PieceType;
  player: Player;
}

// 盤面: board[row][col], row 0=1段目(上), col 0=9筋
export type Board = (Piece | null)[][];

export interface HandPieces {
  sente: Partial<Record<PieceType, number>>;
  gote: Partial<Record<PieceType, number>>;
}

export interface BoardState {
  board: Board;
  hand: HandPieces;
  lastTo?: string;
}

// 成り対応
const PROMOTE_MAP: Partial<Record<PieceType, PieceType>> = {
  '歩': 'と',
  '香': '成香',
  '桂': '成桂',
  '銀': '成銀',
  '角': '馬',
  '飛': '龍',
};

// 成り駒 → 元の駒
const DEMOTE_MAP: Partial<Record<PieceType, PieceType>> = {
  'と': '歩',
  '成香': '香',
  '成桂': '桂',
  '成銀': '銀',
  '馬': '角',
  '龍': '飛',
};

export function promote(t: PieceType): PieceType {
  return PROMOTE_MAP[t] ?? t;
}

export function demote(t: PieceType): PieceType {
  return DEMOTE_MAP[t] ?? t;
}

// 表示用文字（盤面上）
export const PIECE_DISPLAY: Record<PieceType, string> = {
  '歩': '歩', '香': '香', '桂': '桂', '銀': '銀', '金': '金',
  '角': '角', '飛': '飛', '王': '王', '玉': '玉',
  'と': 'と', '成香': '杏', '成桂': '圭', '成銀': '全', '馬': '馬', '龍': '龍',
};

// KIF 座標文字列 "xy" → [row, col] インデックス (0-based)
// x=筋(9=左端), y=段(1=上端)
export function squareToIndex(sq: string): [number, number] {
  const col = 9 - parseInt(sq[0]!); // 9筋→col=0, 1筋→col=8
  const row = parseInt(sq[1]!) - 1; // 1段→row=0, 9段→row=8
  return [row, col];
}

// 平手初期配置
export function initialBoard(): BoardState {
  const board: Board = Array.from({ length: 9 }, () => Array(9).fill(null));

  function place(sq: string, type: PieceType, player: Player) {
    const [r, c] = squareToIndex(sq);
    board[r]![c] = { type, player };
  }

  // 後手 (gote) 1〜3段目
  const goteBack: PieceType[] = ['香', '桂', '銀', '金', '玉', '金', '銀', '桂', '香'];
  goteBack.forEach((t, i) => place(`${9 - i}1`, t, 'gote'));
  place('82', '飛', 'gote');
  place('22', '角', 'gote');
  for (let x = 1; x <= 9; x++) place(`${x}3`, '歩', 'gote');

  // 先手 (sente) 7〜9段目
  const senteBack: PieceType[] = ['香', '桂', '銀', '金', '王', '金', '銀', '桂', '香'];
  senteBack.forEach((t, i) => place(`${9 - i}9`, t, 'sente'));
  place('28', '飛', 'sente');
  place('88', '角', 'sente');
  for (let x = 1; x <= 9; x++) place(`${x}7`, '歩', 'sente');

  return { board, hand: { sente: {}, gote: {} } };
}
