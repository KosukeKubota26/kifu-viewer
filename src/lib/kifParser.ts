export interface GameNode {
  id: string;
  moveNumber: number;
  notation: string;
  fromSquare: string;
  toSquare: string;
  pieceType: string;
  promoted: boolean;
  isDrop: boolean;
  player: 'sente' | 'gote';
  comment: string;
  evaluation?: number;
  depth?: number;
  engine?: string;
  candidates?: string;
  children: GameNode[];
  parent?: GameNode;
}

export interface GameTree {
  root: GameNode;
  title: string;
}

let nodeIdCounter = 0;
function newId(): string {
  return String(++nodeIdCounter);
}

function makeRoot(): GameNode {
  return {
    id: '0',
    moveNumber: 0,
    notation: '開始局面',
    fromSquare: '',
    toSquare: '',
    pieceType: '',
    promoted: false,
    isDrop: false,
    player: 'sente',
    comment: '',
    children: [],
  };
}

// 全角数字 (１-９ = U+FF11..U+FF19) → 半角数字
function fwDigit(c: string): string {
  const code = c.charCodeAt(0);
  return code >= 0xFF11 && code <= 0xFF19 ? String(code - 0xFF10) : c;
}

// 漢数字 → 半角数字
const KANJI_NUM: Record<string, string> = {
  '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
  '六': '6', '七': '7', '八': '8', '九': '9',
};

// 全角数字+漢数字の2文字 → ASCII 2桁 ("xy" 形式)
// 例: "７六" → "76"
function toAsciiSquare(s: string): string {
  return fwDigit(s[0] ?? '') + (KANJI_NUM[s[1] ?? ''] ?? s[1] ?? '');
}

// 指し手行の形式:
//    1 ７六歩(77)   ( 0:00/00:00:00)+
//   27 ８七歩打     ( 0:00/00:00:00)
//   25 同　歩(87)   ( 0:00/00:00:00)
// ▲/△ は行中に現れない。プレイヤーは手番の奇偶で判断する。
const MOVE_RE = /^\s+(\d{1,3})\s+(.+?)\s+\(\s*[\d:]+\/[\d:]+\)\+?$/;

interface RawMove {
  number: number;
  player: 'sente' | 'gote';
  rawNotation: string;
}

function parseMoveLine(line: string): RawMove | null {
  const m = MOVE_RE.exec(line);
  if (!m) return null;
  const num = parseInt(m[1]!);
  return {
    number: num,
    player: num % 2 === 1 ? 'sente' : 'gote',
    rawNotation: m[2]!.trim(),
  };
}

// 分岐ヘッダー: "変化：23手" or "分岐F23:"
const BRANCH_RE = /^(?:分岐F|変化[：:]\s*)(\d+)/;

function parseBranchHeader(line: string): number | null {
  const m = BRANCH_RE.exec(line);
  return m ? parseInt(m[1]!) : null;
}

function parseNotation(rawNotation: string, player: 'sente' | 'gote'): {
  notation: string;
  toSquare: string;
  fromSquare: string;
  pieceType: string;
  promoted: boolean;
  isDrop: boolean;
} {
  let s = rawNotation;
  let promoted = false;
  let isDrop = false;
  let fromSquare = '';

  s = s.replace('不成', '');

  // from-square: 末尾 "(NN)" ASCII 2桁
  const fromMatch = /\((\d{2})\)\s*$/.exec(s);
  if (fromMatch) {
    fromSquare = fromMatch[1]!;
    s = s.slice(0, fromMatch.index).trim();
  }

  // 打ち
  if (s.endsWith('打')) {
    isDrop = true;
    s = s.slice(0, -1);
  }

  // 成り
  if (s.endsWith('成')) {
    promoted = true;
    s = s.slice(0, -1);
  }

  // to-square: "同" or 全角数字+漢数字の2文字
  let toSquare = '';
  if (s.startsWith('同')) {
    toSquare = 'same';
    s = s.replace(/^同[　\s]*/, '');
  } else {
    const code = s.charCodeAt(0);
    if (code >= 0xFF11 && code <= 0xFF19) {
      toSquare = toAsciiSquare(s);
      s = s.slice(2);
    }
  }

  const pieceType = s.trim();
  const playerMark = player === 'sente' ? '▲' : '△';
  const notation = `${playerMark}${rawNotation}`;

  return { notation, toSquare, fromSquare, pieceType, promoted, isDrop };
}

function rawToNode(raw: RawMove, parent: GameNode): GameNode {
  const { notation, toSquare, fromSquare, pieceType, promoted, isDrop } =
    parseNotation(raw.rawNotation, raw.player);
  return {
    id: newId(),
    moveNumber: raw.number,
    notation,
    fromSquare,
    toSquare,
    pieceType,
    promoted,
    isDrop,
    player: raw.player,
    comment: '',
    children: [],
    parent,
  };
}

interface Section {
  branchAt: number | null;
  moves: RawMove[];
  comments: Map<number, { comment: string; evaluation?: number; depth?: number; engine?: string; candidates?: string }>;
}

function parseSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { branchAt: null, moves: [], comments: new Map() };
  let pendingComment = '';
  let pendingEval: number | undefined;
  let pendingDepth: number | undefined;
  let pendingEngine: string | undefined;
  let pendingCandidates: string | undefined;
  let lastMoveNum = 0;

  function flushComment(moveNum: number) {
    if (pendingComment || pendingEval !== undefined || pendingCandidates) {
      current.comments.set(moveNum, {
        comment: pendingComment,
        evaluation: pendingEval,
        depth: pendingDepth,
        engine: pendingEngine,
        candidates: pendingCandidates,
      });
      pendingComment = '';
      pendingEval = undefined;
      pendingDepth = undefined;
      pendingEngine = undefined;
      pendingCandidates = undefined;
    }
  }

  for (const line of lines) {
    const branchAt = parseBranchHeader(line);
    if (branchAt !== null) {
      flushComment(lastMoveNum);
      sections.push(current);
      current = { branchAt, moves: [], comments: new Map() };
      lastMoveNum = 0;
      continue;
    }

    const raw = parseMoveLine(line);
    if (raw) {
      flushComment(raw.number - 1);
      current.moves.push(raw);
      lastMoveNum = raw.number;
      continue;
    }

    if (line.startsWith('*')) {
      const body = line.slice(1).trim();
      if (body.startsWith('#評価値=')) {
        // 複数の評価ブロックがある場合は最後（より深い解析）を採用
        pendingEval = parseInt(body.slice('#評価値='.length));
      } else if (body.startsWith('#深さ=')) {
        pendingDepth = parseInt(body.slice('#深さ='.length));
      } else if (body.startsWith('#エンジン=')) {
        pendingEngine = body.slice('#エンジン='.length);
      } else if (body.startsWith('#候補手=')) {
        pendingCandidates = body.slice('#候補手='.length);
      } else if (body.startsWith('#読み筋=')) {
        // YaneuraOu 等が出力する読み筋を候補手として扱う
        pendingCandidates = body.slice('#読み筋='.length);
      } else if (!body.startsWith('#')) {
        if (pendingComment) pendingComment += '\n';
        pendingComment += body;
      }
    }
  }
  flushComment(lastMoveNum);
  sections.push(current);

  return sections;
}

function buildMainLine(root: GameNode, section: Section): void {
  let prev = root;
  for (const raw of section.moves) {
    const info = section.comments.get(raw.number);
    const node = rawToNode(raw, prev);
    if (info) {
      node.comment = info.comment;
      node.evaluation = info.evaluation;
      node.depth = info.depth;
      node.engine = info.engine;
      node.candidates = info.candidates;
    }
    prev.children.push(node);
    prev = node;
  }
}

// 分岐セクション: 同じ手番の候補が複数ある場合、最後に追加されたノードを親とする
// (ファイル順 = DFS pre-order なので、最後の候補 = 直前のセクションの末端)
function buildBranchLine(root: GameNode, section: Section): void {
  const parentMoveNum = section.branchAt! - 1;
  const candidates: GameNode[] = [];
  function collect(node: GameNode) {
    if (node.moveNumber === parentMoveNum) candidates.push(node);
    for (const c of node.children) collect(c);
  }
  collect(root);

  if (candidates.length === 0) return;
  const parent = candidates[candidates.length - 1]!;

  let prev = parent;
  for (const raw of section.moves) {
    const info = section.comments.get(raw.number);
    const node = rawToNode(raw, prev);
    if (info) {
      node.comment = info.comment;
      node.evaluation = info.evaluation;
      node.depth = info.depth;
      node.engine = info.engine;
      node.candidates = info.candidates;
    }
    prev.children.push(node);
    prev = node;
  }
}

function decodeKif(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('shift-jis').decode(buffer);
  }
}

export async function parseKifFile(file: File): Promise<GameTree> {
  nodeIdCounter = 0;
  const buffer = await file.arrayBuffer();
  const text = decodeKif(buffer);
  const lines = text.split(/\r?\n/);

  const sections = parseSections(lines);
  const root = makeRoot();

  if (sections.length > 0 && sections[0]) {
    buildMainLine(root, sections[0]);
  }
  for (let i = 1; i < sections.length; i++) {
    const s = sections[i];
    if (s && s.branchAt !== null && s.moves.length > 0) {
      buildBranchLine(root, s);
    }
  }

  const title = file.name.replace(/\.kif$/i, '');
  return { root, title };
}

export function pathToNode(root: GameNode, target: GameNode): GameNode[] {
  function dfs(node: GameNode, path: GameNode[]): GameNode[] | null {
    const newPath = [...path, node];
    if (node.id === target.id) return newPath;
    for (const child of node.children) {
      const result = dfs(child, newPath);
      if (result) return result;
    }
    return null;
  }
  return dfs(root, []) ?? [root];
}
