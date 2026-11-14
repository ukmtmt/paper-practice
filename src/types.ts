export type Domain = 'suryo' | 'zukei' | 'gengo';
export type Level = 1 | 2;

export type Cell = readonly [number, number]; // [行, 列]

export type Visual =
  | { kind: 'card'; id: string }
  /** 箱の中に絵を散らして置く．x, y は 0〜1 の中心座標 */
  | { kind: 'scatter'; items: { id: string; x: number; y: number }[] }
  /** 箱の中に ○ を n 個 */
  | { kind: 'circles'; n: number }
  /** 左右2つの箱 */
  | { kind: 'pair'; left: Visual; right: Visual }
  /** 絵の列．null は空欄 */
  | { kind: 'row'; ids: (string | null)[] }
  /** size×size のマス目に黒く塗ったマス */
  | { kind: 'cells'; size: number; cells: Cell[] }
  /** size×size の点図形．segments が空なら書き込み用の空欄 */
  | { kind: 'dots'; size: number; segments: [Cell, Cell][] };

export interface Problem {
  /** skill:level:seed．同じ key からは同じ問題が再生成される */
  key: string;
  skill: string;
  level: Level;
  /** 読み上げ文（ひらがな中心） */
  speech: string;
  /** 画面に出す短い文 */
  caption: string;
  stimulus?: Visual;
  choices: Visual[];
  /** 選択肢の並べ方．省略時は1行 */
  cols?: number;
  /** 正答の選択肢番号．紙専用の問題は -1 */
  answer: number;
  explain: string;
  paperOnly?: boolean;
}

export interface Skill {
  id: string;
  domain: Domain;
  name: string;
  /** 暫定頻出の重み（要件定義 §1） */
  weight: number;
  paperOnly?: boolean;
  levels: Level[];
  generate(level: Level, seed: number): Problem;
  /** 生成とは独立に，画面に出る内容だけから正答の一意性を検査する．問題なければ null */
  check(p: Problem): string | null;
}
