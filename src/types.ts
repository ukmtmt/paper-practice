export type Domain = 'suryo' | 'zukei' | 'gengo' | 'joshiki';
/** 1 基礎，2 標準，3 発展 */
export type Level = 1 | 2 | 3;

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
  | { kind: 'dots'; size: number; segments: [Cell, Cell][] }
  /** シーソー．tilt は 1 なら右が下がる，-1 なら左が下がる，0 はつりあい */
  | { kind: 'seesaw'; left: string[]; right: string[]; tilt: -1 | 0 | 1 }
  /** シーソーを縦に並べる */
  | { kind: 'stack'; items: Visual[] };

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
  /** 正答の選択肢番号．複答では複数．紙専用の問題は空 */
  answers: number[];
  /** 「ぜんぶ まるを」型の複答問題 */
  multi?: boolean;
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
  /** 出題に必要な絵（すべて揃うまで出題しない） */
  requires?: string[];
  generate(level: Level, seed: number): Problem;
  /** 生成とは独立に，画面に出る内容だけから正答の一意性を検査する．問題なければ null */
  check(p: Problem): string | null;
}
