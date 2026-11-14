import type { Level, Problem, Visual } from '../types';
import { Rng } from '../rng';

const KAZU = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお'];
const BANME = ['', 'いちばんめ', 'にばんめ', 'さんばんめ', 'よんばんめ', 'ごばんめ'];

export const kazu = (n: number): string => KAZU[n] ?? String(n);
export const banme = (n: number): string => BANME[n] ?? `${n}ばんめ`;

export const keyOf = (skill: string, level: Level, seed: number): string => `${skill}:${level}:${seed}`;

export function parseKey(key: string): { skill: string; level: Level; seed: number } {
  const [skill, level, seed] = key.split(':');
  return { skill, level: Number(level) as Level, seed: Number(seed) };
}

/** 4×3 または 4×4 の区画に1つずつ，少しずらして置く（重なり防止） */
export function scatter(rng: Rng, ids: string[]): Visual {
  const cols = 4;
  const rows = ids.length > 12 ? 4 : ids.length > 8 ? 3 : ids.length > 4 ? 3 : 2;
  const slots = rng.sample(
    Array.from({ length: cols * rows }, (_, i) => i),
    ids.length,
  );
  const items = ids.map((id, k) => {
    const s = slots[k];
    const cx = ((s % cols) + 0.5) / cols;
    const cy = (Math.floor(s / cols) + 0.5) / rows;
    const jx = (rng.next() - 0.5) * 0.25 / cols;
    const jy = (rng.next() - 0.5) * 0.25 / rows;
    return { id, x: cx + jx, y: cy + jy };
  });
  return { kind: 'scatter', items };
}

/** 正答 answer と，それと異なる値 n 個（distinct）を範囲内で近い順に選ぶ */
export function nearDistractors(rng: Rng, answer: number, n: number, min: number, max: number, spread = 3): number[] {
  const pool: number[] = [];
  for (let d = 1; d <= spread; d++) {
    if (answer - d >= min) pool.push(answer - d);
    if (answer + d <= max) pool.push(answer + d);
  }
  if (pool.length < n) {
    for (let v = min; v <= max; v++) if (v !== answer && !pool.includes(v)) pool.push(v);
  }
  return rng.sample(pool, n);
}

/** 正答を選択肢のどこかに混ぜる */
export function placeAnswer(rng: Rng, correct: Visual, wrongs: Visual[]): { choices: Visual[]; answer: number } {
  const answer = rng.int(0, wrongs.length);
  const choices = [...wrongs];
  choices.splice(answer, 0, correct);
  return { choices, answer };
}

export function countOf(v: Visual, id?: string): number {
  if (v.kind === 'scatter') return v.items.filter((x) => id === undefined || x.id === id).length;
  if (v.kind === 'circles') return v.n;
  return -1;
}

/** 共通の検査：正答番号が範囲内，選択肢が重複しない，単答なら正答は1つ */
export function basicCheck(p: Problem): string | null {
  if (p.paperOnly) return null;
  if (!p.answers.length) return '正答がない';
  if (p.answers.some((a) => a < 0 || a >= p.choices.length)) return `正答番号が範囲外: ${p.answers}`;
  if (new Set(p.answers).size !== p.answers.length) return '正答番号が重複している';
  if (!p.multi && p.answers.length !== 1) return '単答なのに正答が複数';
  if (p.multi && p.answers.length < 2) return '複答なのに正答が1つ';
  const seen = new Set(p.choices.map((c) => JSON.stringify(c)));
  if (seen.size !== p.choices.length) return '同じ選択肢が重複している';
  return null;
}

/** 「条件に合う選択肢」の番号の集合が正答と一致するか */
export function sameSet(hits: boolean[], answers: number[]): boolean {
  const want = hits.flatMap((h, i) => (h ? [i] : []));
  return want.length === answers.length && want.every((i) => answers.includes(i));
}

/** 複答：正答 k 個と誤答をまとめて並べ替え，正答の番号を返す */
export function placeMany<T>(rng: Rng, corrects: T[], wrongs: T[]): { choices: T[]; answers: number[] } {
  const tagged = rng.shuffle([...corrects.map((v) => ({ v, ok: true })), ...wrongs.map((v) => ({ v, ok: false }))]);
  return { choices: tagged.map((t) => t.v), answers: tagged.flatMap((t, i) => (t.ok ? [i] : [])) };
}

export const LEVEL_NAME: Record<number, string> = { 1: '基礎', 2: '標準', 3: '発展' };
