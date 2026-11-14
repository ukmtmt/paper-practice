// 出題する技能・難易度の選択と，保護者画面の集計（純粋関数）
import type { Attempt, Session } from './db';
import type { Level, Skill } from './types';
import { Rng } from './rng';
import { keyOf } from './gen/common';

/** 集計に使う記録：途中でやめた本番風セットの解答は除く */
export function usable(attempts: Attempt[], sessions: Session[]): Attempt[] {
  const incomplete = new Set(sessions.filter((s) => s.mode === 'mock' && !s.completed).map((s) => s.id));
  return attempts.filter((a) => !incomplete.has(a.sessionId));
}

const bySkill = (attempts: Attempt[], skill: string) =>
  attempts.filter((a) => a.skill === skill).sort((a, b) => b.at - a.at);

/** 直近5問の誤答率（未解答も誤答に数える）．記録がなければ undefined */
export function recentWrongRate(attempts: Attempt[], skill: string): number | undefined {
  const r = bySkill(attempts, skill).slice(0, 5);
  if (!r.length) return undefined;
  return r.filter((a) => a.result !== 'correct').length / r.length;
}

/** 優先度：頻出の重み ×（直近の誤答が多いほど高く，未実施も高め） */
export function priority(attempts: Attempt[], s: Skill): number {
  const w = recentWrongRate(attempts, s.id);
  return s.weight * (w === undefined ? 1.6 : 1 + 2 * w);
}

/** 基礎で直近3問正解なら標準へ，標準で直近2問続けて誤答なら基礎へ戻す */
export function levelFor(attempts: Attempt[], s: Skill): Level {
  if (!s.levels.includes(2)) return 1;
  const r = bySkill(attempts, s.id);
  const last = r[0]?.level ?? 1;
  if (last === 1) {
    const l1 = r.filter((a) => a.level === 1).slice(0, 3);
    return l1.length === 3 && l1.every((a) => a.result === 'correct') && r[0].result === 'correct' ? 2 : 1;
  }
  const l2 = r.filter((a) => a.level === 2).slice(0, 2);
  return l2.length === 2 && l2.every((a) => a.result !== 'correct') ? 1 : 2;
}

function weightedPick<T>(rng: Rng, xs: T[], w: (x: T) => number): T {
  const total = xs.reduce((s, x) => s + w(x), 0);
  let r = rng.next() * total;
  for (const x of xs) {
    r -= w(x);
    if (r <= 0) return x;
  }
  return xs[xs.length - 1];
}

/**
 * きょうのれんしゅう：n問の key を作る．
 * 3領域から最低1問ずつ，残りは優先度で重み付け．同じ技能は3問以上続けない．
 */
export function planSession(skills: Skill[], attempts: Attempt[], n: number, seed: number): string[] {
  const rng = new Rng(seed);
  const screen = skills.filter((s) => !s.paperOnly);
  const pr = (s: Skill) => priority(attempts, s);
  const picked: Skill[] = [];
  for (const d of ['suryo', 'zukei', 'gengo'] as const) {
    if (picked.length < n) picked.push(weightedPick(rng, screen.filter((s) => s.domain === d), pr));
  }
  while (picked.length < n) {
    const count = (s: Skill) => picked.filter((x) => x === s).length;
    // 同じ技能は最大2問まで
    const pool = screen.filter((s) => count(s) < 2);
    picked.push(weightedPick(rng, pool, pr));
  }
  const order = arrange(rng, picked);
  return order.map((s) => keyOf(s.id, levelFor(attempts, s), (rng.next() * 0xffffffff) >>> 0));
}

/** 同じ技能が隣り合わないように並べる（できる範囲で） */
function arrange(rng: Rng, xs: Skill[]): Skill[] {
  for (let t = 0; t < 50; t++) {
    const a = rng.shuffle(xs);
    if (a.every((x, i) => i === 0 || a[i - 1] !== x)) return a;
  }
  return rng.shuffle(xs);
}

/** プリント用：指定した技能から n 問 */
export function planPrint(skills: Skill[], attempts: Attempt[], n: number, seed: number): string[] {
  const rng = new Rng(seed);
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const s = skills[i % skills.length];
    keys.push(keyOf(s.id, levelFor(attempts, s), (rng.next() * 0xffffffff) >>> 0));
  }
  return keys;
}

export interface SkillStat {
  skill: Skill;
  screen: { n: number; correct: number };
  paper: { n: number; correct: number };
  retry: { n: number; correct: number };
  level: Level;
  priority: number;
}

export function stats(skills: Skill[], attempts: Attempt[]): SkillStat[] {
  const tally = (xs: Attempt[]) => ({ n: xs.length, correct: xs.filter((a) => a.result === 'correct').length });
  return skills.map((s) => {
    const mine = attempts.filter((a) => a.skill === s.id);
    return {
      skill: s,
      screen: tally(mine.filter((a) => a.firstTime && a.mode !== 'paper')),
      paper: tally(mine.filter((a) => a.firstTime && a.mode === 'paper')),
      retry: tally(mine.filter((a) => !a.firstTime)),
      level: levelFor(attempts, s),
      priority: priority(attempts, s),
    };
  });
}
