# 将棋棋譜ビューワー - セッション引き継ぎ

## プロジェクト概要

KIF 形式の棋譜ファイルをブラウザで表示するローカル専用 Web アプリ。
分岐・候補手・評価値に対応。スマートフォンでも動作するレスポンシブ UI。

**動作確認済み**: `雁木vs左美濃検討_UTF-8.kif` で盤面・棋譜ツリー・分岐表示が正常に動作。

## 実行環境

- WSL Ubuntu: `~/kifu-viewer/` で `npm run dev` → `http://localhost:5173/`
- Node.js / npm は WSL ネイティブ（`/mnt/c/` 上では chmod EPERM のため不可）
- VSCode Remote-WSL で `~/kifu-viewer/` を直接編集すること

## 技術スタック

- Vite 6 + React 18 + TypeScript 5
- Tailwind CSS v4 (`@tailwindcss/vite` プラグイン)
- 外部ライブラリなし（パーサー・盤面ロジックは自前実装）

## ファイル構成（`~/kifu-viewer/src/`）

```
src/
├── main.tsx               # React エントリポイント
├── App.tsx                # メイン状態管理・レイアウト
├── index.css              # @import "tailwindcss" + 日本語フォント
├── lib/
│   ├── kifParser.ts       # KIF パーサー（最重要）
│   ├── pieces.ts          # 駒定義・初期配置・座標変換
│   └── shogiBoard.ts      # 盤面状態管理（指し手適用）
└── components/
    ├── Board.tsx          # 9×9 盤面 CSS Grid
    ├── MoveTree.tsx       # 棋譜ツリー（分岐折りたたみ）
    ├── EvalBar.tsx        # 評価値バー
    ├── CandidateList.tsx  # 候補手リスト（USI→人間可読変換）
    ├── Controls.tsx       # ⏮◀▶⏭ ナビゲーション
    └── FileDropZone.tsx   # ファイルドロップ＆選択
```

## KIF パーサーの重要仕様（kifParser.ts）

### KIF フォーマットの実際の形式（重要）

```
   1 ７六歩(77)   ( 0:00/00:00:00)+
  25 同　歩(87)   ( 0:00/00:00:00)
  27 ８七歩打     ( 0:00/00:00:00)
変化：23手
```

- **▲/△ は行中に現れない** → 手番の奇偶で判断（奇数=先手、偶数=後手）
- 移動先は **全角数字＋漢数字** （`７六` = col7, row6）→ ASCII `"76"` に変換
- 移動元は ASCII 2桁 `(77)` 形式
- エンジン解析は `*#読み筋=` （`#候補手=` ではない）

### MOVE_RE

```ts
const MOVE_RE = /^\s+(\d{1,3})\s+(.+?)\s{2,}\(\s*[\d:]+\/[\d:]+\)\+?$/;
```

### 座標変換

```ts
function fwDigit(c: string): string {
  const code = c.charCodeAt(0);
  return code >= 0xFF11 && code <= 0xFF19 ? String(code - 0xFF10) : c;
}
const KANJI_NUM: Record<string, string> = {
  '一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'
};
function toAsciiSquare(s: string): string {
  return fwDigit(s[0]??'') + (KANJI_NUM[s[1]??''] ?? s[1]??'');
}
```

### エンコード自動判別

```ts
function decodeKif(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('shift-jis').decode(buffer);
  }
}
```

### 分岐再構築（DFS pre-order アルゴリズム）

`変化：N手` セクションが来たら、ツリー内で `moveNumber === N-1` のノードを全収集し、
**最後に見つかったもの**（= 最もツリー末端寄り）を親とする。
これにより KIF の DFS pre-order 順序が正しく再現される。

## 盤面座標系（pieces.ts）

- `squareToIndex("76")` → `[row=5, col=2]` （0-indexed、row=y-1, col=9-x）
- 先手=通常向き、後手=`rotate-180 text-red-700`
- `toSquare === 'same'` のとき `state.lastTo` を参照

## GameNode インターフェース

```ts
interface GameNode {
  id: string;
  moveNumber: number;
  notation: string;       // "▲７六歩(77)" 形式（表示用）
  fromSquare: string;     // "77" (ASCII 2桁)
  toSquare: string;       // "76" (ASCII 2桁) or "same"
  pieceType: string;      // "歩" 等の漢字
  promoted: boolean;
  isDrop: boolean;
  player: 'sente' | 'gote';
  comment: string;
  evaluation?: number;    // *#評価値=
  depth?: number;         // *#深さ=
  engine?: string;        // *#エンジン=
  candidates?: string;    // *#読み筋= (USI 形式の手順文字列)
  children: GameNode[];   // children[0]=メイン継続, [1..]=分岐
  parent?: GameNode;
}
```

## App.tsx の主要ロジック

- `navigate(node)`: `pathToNode` で root→node のパスを取得 → `buildBoardState` で盤面再現
- キーボード: ←→ で前後、↑↓ で最初/最後
- タッチスワイプ: 50px 閾値で左右スワイプ → 前後移動
- レイアウト: モバイル縦並び / `lg:flex-row` でデスクトップ横並び

## 現在の動作状態

✅ 盤面表示（初期配置・指し手適用）
✅ 棋譜ツリー表示（分岐折りたたみ）
✅ 前後ナビゲーション（ボタン・キーボード・スワイプ）
✅ UTF-8 / Shift-JIS 自動判別
✅ 分岐（変化）の正しい再構築
⚠️ 評価値バー・候補手：コメントの手番対応関係に微妙なズレの可能性あり（未検証）
⚠️ 持ち駒の表示は正しいか要確認（複雑な局面で）
❌ デバッグ用 console.log が kifParser.ts に残っている（要削除）

## 直近で修正した内容

1. MOVE_RE から `▲/△` 要件を除去（実際の KIF に存在しない）
2. 全角数字＋漢数字 → ASCII 2桁への座標変換を追加
3. `#読み筋=` を候補手として取り込む処理を追加
4. UTF-8 / Shift-JIS の自動判別を追加

## サンプルファイル

- `~/kifu-viewer/雁木vs左美濃検討_UTF-8.kif` (UTF-8版)
- YaneuraOu NNUE による検討棋譜、29手本譜＋多数の分岐、評価値・読み筋付き

---

## 続きのプロンプト（次のセッションで冒頭に貼る）

```
以下のコンテキストを引き継いで作業を続けてください。

プロジェクト: ~/kifu-viewer（WSL Ubuntu）で動く将棋棋譜ビューワー
- Vite 6 + React 18 + TypeScript + Tailwind CSS v4
- npm run dev → http://localhost:5173/ で動作中
- 詳細は ~/kifu-viewer/CONTEXT.md を参照

現在の問題と次のタスク:
1. kifParser.ts のデバッグ console.log を削除する
   （console.log('[KIF] ...') の行を4行）
2. [ここに次にやりたいことを書く]

作業するファイルはすべて ~/kifu-viewer/ 以下にあります。
VSCode Remote-WSL で開いているので直接編集可能です。
```
