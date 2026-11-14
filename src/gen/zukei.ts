// 図形：同じ形・回転，位置，点図形（紙専用）
import type { Cell, Level, Problem, Skill, Visual } from '../types';
import { Rng } from '../rng';
import { CARDS, CARD_BY_ID } from '../cards';
import { banme, basicCheck, keyOf, placeAnswer } from './common';

// ---- マス目図形の操作 ----

const rot90 = (cells: Cell[], size: number): Cell[] => cells.map(([r, c]) => [c, size - 1 - r] as const);
const mirror = (cells: Cell[], size: number): Cell[] => cells.map(([r, c]) => [r, size - 1 - c] as const);

/** 平行移動を除いた正規形（文字列） */
function norm(cells: Cell[]): string {
  const minR = Math.min(...cells.map((x) => x[0]));
  const minC = Math.min(...cells.map((x) => x[1]));
  return cells
    .map(([r, c]) => `${r - minR},${c - minC}`)
    .sort()
    .join(';');
}

function rotations(cells: Cell[], size: number): Cell[][] {
  const out = [cells];
  for (let i = 0; i < 3; i++) out.push(rot90(out[out.length - 1], size));
  return out;
}

/** 回転で重なる形か */
const sameUnderRotation = (a: Cell[], b: Cell[], size: number) => rotations(a, size).some((r) => norm(r) === norm(b));

/** マス目内で連結な図形をランダムに育てる */
function growShape(rng: Rng, size: number, k: number): Cell[] {
  const start: Cell = [rng.int(0, size - 1), rng.int(0, size - 1)];
  const cells: Cell[] = [start];
  const has = (r: number, c: number) => cells.some((x) => x[0] === r && x[1] === c);
  while (cells.length < k) {
    const [r, c] = rng.pick(cells);
    const [dr, dc] = rng.pick([
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]);
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size && !has(nr, nc)) cells.push([nr, nc]);
  }
  return cells;
}

/** 1マスだけ別の場所に動かした図形（連結を保つ） */
function moveOne(rng: Rng, cells: Cell[], size: number): Cell[] {
  for (let t = 0; t < 200; t++) {
    const i = rng.int(0, cells.length - 1);
    const rest = cells.filter((_, j) => j !== i);
    const [r, c] = rng.pick(rest);
    const [dr, dc] = rng.pick([
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]);
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
    if (cells.some((x) => x[0] === nr && x[1] === nc)) continue;
    const next = [...rest, [nr, nc] as const];
    if (connected(next)) return next;
  }
  throw new Error('moveOne: 変形できない');
}

function connected(cells: Cell[]): boolean {
  const key = (x: Cell) => `${x[0]},${x[1]}`;
  const all = new Set(cells.map(key));
  const seen = new Set([key(cells[0])]);
  const stack = [cells[0]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      const k = `${r + dr},${c + dc}`;
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([r + dr, c + dc]);
      }
    }
  }
  return seen.size === cells.length;
}

const cellsOf = (v: Visual): Cell[] => (v.kind === 'cells' ? v.cells : []);

export const shape: Skill = {
  id: 'shape',
  domain: 'zukei',
  name: 'おなじ かたち・まわした かたち',
  weight: 1,
  levels: [1, 2],
  generate(level, seed) {
    // 条件を満たす図形が出るまでシードを進める（決定的）
    for (let s = seed; ; s = (s + 0x9e3779b9) >>> 0) {
      const p = tryShape(level, seed, s);
      if (p) return p;
    }
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    if (p.stimulus?.kind !== 'cells') return '見本がない';
    const size = p.stimulus.size;
    const base = p.stimulus.cells;
    // 回転・裏返しで重なる形は「同じ形」とも読めるので，基礎でも誤答には使わない
    const congruent = (c: Cell[]) => sameUnderRotation(base, c, size) || sameUnderRotation(mirror(base, size), c, size);
    const match = p.level === 1 ? (c: Cell[]) => congruent(c) : (c: Cell[]) => sameUnderRotation(base, c, size);
    const hits = p.choices.map((c) => match(cellsOf(c)));
    if (hits.filter(Boolean).length !== 1) return `一致する選択肢が${hits.filter(Boolean).length}個`;
    return hits[p.answers[0]] ? null : '正答が違う';
  },
};

function tryShape(level: Level, seed: number, s: number): Problem | null {
  const rng = new Rng(s);
  const size = level === 1 ? 3 : 4;
  const k = level === 1 ? rng.int(4, 5) : rng.int(5, 7);
  const base = growShape(rng, size, k);
  const rots = rotations(base, size).map(norm);
  // 回転対称な形や左右対称な形は，回転・裏返しの区別ができないので使わない
  if (new Set(rots).size !== 4) return null;
  const mir = mirror(base, size);
  if (sameUnderRotation(base, mir, size)) return null;

  let correct: Cell[];
  let wrongs: Cell[][];
  if (level === 1) {
    correct = base;
    wrongs = [];
    for (let t = 0; t < 50 && wrongs.length < 3; t++) {
      const w = moveOne(rng, base, size);
      if (sameUnderRotation(base, w, size) || sameUnderRotation(mir, w, size)) continue;
      if (wrongs.some((x) => norm(x) === norm(w))) continue;
      wrongs.push(w);
    }
    if (wrongs.length < 3) return null;
  } else {
    const turn = rng.int(1, 3);
    correct = rotations(base, size)[turn];
    const mirRots = rotations(mir, size);
    const m1 = mirRots[rng.int(0, 3)];
    const m2 = mirRots.find((x) => norm(x) !== norm(m1))!;
    const changed = rotations(moveOne(rng, base, size), size)[rng.int(0, 3)];
    if (sameUnderRotation(base, changed, size) || sameUnderRotation(mir, changed, size)) return null;
    wrongs = [m1, m2, changed];
  }
  const { choices, answer } = placeAnswer(
    rng,
    { kind: 'cells', size, cells: correct },
    wrongs.map((c): Visual => ({ kind: 'cells', size, cells: c })),
  );
  return {
    key: keyOf('shape', level, seed),
    skill: 'shape',
    level,
    speech:
      level === 1
        ? 'みほんと おなじ かたちに まるを つけましょう．'
        : 'みほんの かたちを くるっと まわすと どれに なりますか．あう ものに まるを つけましょう．うらがえしては いけません．',
    caption: level === 1 ? 'みほんと おなじ かたち' : 'まわすと どれ？',
    stimulus: { kind: 'cells', size, cells: base },
    choices,
    cols: 4,
    answers: [answer],
    explain:
      level === 1
        ? 'くろい ますの ばしょを ひとつずつ みほんと くらべる．'
        : 'まわしても くろい ますの ならびかたは かわらない．うらがえした かたちは ちがう．',
  };
}

// ---- 位置 ----

const PLACEABLE = CARDS.filter((c) => c.category !== 'kazoe').map((c) => c.id);

type Dir = 'うえ' | 'した' | 'ひだり' | 'みぎ';
const NUM = ['いち', 'に', 'さん', 'よん', 'ご'];

/** 指示文から「どちらから何番目」を読み取る（1〜2段） */
function parsePosition(caption: string): { dir: Dir; no: number }[] {
  return [...caption.matchAll(/(うえ|した|ひだり|みぎ)から (\S+?)ばんめ/g)].map((m) => ({
    dir: m[1] as Dir,
    no: NUM.indexOf(m[2]) + 1,
  }));
}

/** 指示どおりに数えたときの行・列（0始まり） */
function locate(steps: { dir: Dir; no: number }[], rows: number, cols: number): { r: number; c: number } {
  let r = 0;
  let c = 0;
  for (const { dir, no } of steps) {
    if (dir === 'うえ') r = no - 1;
    if (dir === 'した') r = rows - no;
    if (dir === 'ひだり') c = no - 1;
    if (dir === 'みぎ') c = cols - no;
  }
  return { r, c };
}

/** 解説用：数える道すじの各マスに付ける番号（例：「↓2 →3」） */
export function positionMarks(p: Problem): Map<number, string> {
  const cols = p.cols ?? p.choices.length;
  const rows = Math.ceil(p.choices.length / cols);
  const steps = parsePosition(p.caption);
  const { r, c } = locate(steps, rows, cols);
  const arrow: Record<Dir, string> = { うえ: '↓', した: '↑', ひだり: '→', みぎ: '←' };
  const marks = new Map<number, string[]>();
  const add = (rr: number, cc: number, s: string) => {
    const i = rr * cols + cc;
    marks.set(i, [...(marks.get(i) ?? []), s]);
  };
  for (const { dir, no } of steps) {
    for (let k = 1; k <= no; k++) {
      if (dir === 'うえ') add(k - 1, c, `${arrow[dir]}${k}`);
      if (dir === 'した') add(rows - k, c, `${arrow[dir]}${k}`);
      if (dir === 'ひだり') add(r, k - 1, `${arrow[dir]}${k}`);
      if (dir === 'みぎ') add(r, cols - k, `${arrow[dir]}${k}`);
    }
  }
  return new Map([...marks].map(([i, v]) => [i, v.join(' ')]));
}

export const position: Skill = {
  id: 'position',
  domain: 'zukei',
  name: 'ばしょ（なんばんめ）',
  weight: 0.9,
  levels: [1, 2, 3],
  generate(level, seed) {
    const rng = new Rng(seed);
    let rows: number;
    let cols: number;
    let steps: { dir: Dir; no: number }[];
    if (level === 1) {
      // 基礎：1列だけ．うえ・した・ひだり・みぎ をそれぞれ単独で
      const dir = rng.pick(['うえ', 'した', 'ひだり', 'みぎ'] as const);
      const n = 5;
      [rows, cols] = dir === 'うえ' || dir === 'した' ? [n, 1] : [1, n];
      steps = [{ dir, no: rng.int(1, n) }];
    } else {
      const n = level === 2 ? 3 : 4;
      rows = cols = n;
      const v: Dir = level === 2 || rng.next() < 0.5 ? 'うえ' : 'した';
      const hz: Dir = level === 2 || rng.next() < 0.5 ? 'ひだり' : 'みぎ';
      steps = [
        { dir: v, no: rng.int(1, n) },
        { dir: hz, no: rng.int(1, n) },
      ];
    }
    const ids = rng.sample(PLACEABLE, rows * cols);
    const { r, c } = locate(steps, rows, cols);
    const v = steps.map((s) => `${s.dir}から ${banme(s.no)}`).join('，');
    return {
      key: keyOf('position', level, seed),
      skill: 'position',
      level,
      speech: `${v}に ある ものに まるを つけましょう．`,
      caption: v,
      choices: ids.map((id): Visual => ({ kind: 'card', id })),
      cols,
      answers: [r * cols + c],
      explain: `${v}は ${CARD_BY_ID[ids[r * cols + c]].name}．${steps.map((s) => `${s.dir}から`).join('，')} ゆびで ひとつずつ かぞえる．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    const cols = p.cols!;
    const rows = Math.ceil(p.choices.length / cols);
    const steps = parsePosition(p.caption);
    if (!steps.length || steps.some((s) => s.no < 1)) return '指示文を読めない';
    const lim = (d: Dir) => (d === 'うえ' || d === 'した' ? rows : cols);
    if (steps.some((s) => s.no > lim(s.dir))) return '番号が並びの数を超えている';
    if (p.level === 1 && (rows !== 1 && cols !== 1)) return '基礎が1列でない';
    const { r, c } = locate(steps, rows, cols);
    return p.answers[0] === r * cols + c ? null : '正答の位置が違う';
  },
};

// ---- 点図形（紙専用） ----

export const dots: Skill = {
  id: 'dots',
  domain: 'zukei',
  name: 'てんせんを うつす',
  weight: 0.8,
  paperOnly: true,
  levels: [1, 2],
  generate(level, seed) {
    const rng = new Rng(seed);
    const size = level === 1 ? 4 : 5;
    const nSeg = level === 1 ? rng.int(4, 5) : rng.int(6, 8);
    const dirs =
      level === 1
        ? [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
          ]
        : [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ];
    const segs: [Cell, Cell][] = [];
    const segKey = (a: Cell, b: Cell) => [a.join(','), b.join(',')].sort().join('-');
    let cur: Cell = [rng.int(0, size - 1), rng.int(0, size - 1)];
    for (let t = 0; t < 500 && segs.length < nSeg; t++) {
      const [dr, dc] = rng.pick(dirs);
      const nxt: Cell = [cur[0] + dr, cur[1] + dc];
      if (nxt[0] < 0 || nxt[0] >= size || nxt[1] < 0 || nxt[1] >= size) continue;
      if (segs.some(([a, b]) => segKey(a, b) === segKey(cur, nxt))) continue;
      segs.push([cur, nxt]);
      cur = nxt;
    }
    return {
      key: keyOf('dots', level, seed),
      skill: 'dots',
      level,
      speech: 'ひだりの みほんと おなじように，みぎの てんを せんで むすびましょう．',
      caption: 'みほんと おなじように せんを ひく',
      stimulus: { kind: 'dots', size, segments: segs },
      choices: [{ kind: 'dots', size, segments: [] }],
      answers: [],
      paperOnly: true,
      explain: 'はじめの てんを きめて，みほんの せんを ひとつずつ たどる．',
    };
  },
  check(p) {
    if (p.stimulus?.kind !== 'dots') return '見本がない';
    const { size, segments } = p.stimulus;
    if (segments.length < 4) return '線が少なすぎる';
    const inside = (x: Cell) => x[0] >= 0 && x[0] < size && x[1] >= 0 && x[1] < size;
    if (!segments.every(([a, b]) => inside(a) && inside(b))) return '点の外に出ている';
    return null;
  },
};
