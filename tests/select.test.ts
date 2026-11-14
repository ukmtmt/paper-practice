import { describe, expect, it } from 'vitest';
import { availableSkills, levelFor, stepLevel } from '../src/select';
import { SKILLS, SKILL_BY_ID } from '../src/skills';
import type { Attempt } from '../src/db';
import type { Level } from '../src/types';

const att = (skill: string, level: Level, result: Attempt['result'], at: number): Attempt => ({
  id: `${skill}:${at}`, at, key: `${skill}:${level}:${at}`, skill, domain: 'zukei', level, mode: 'practice', firstTime: true, result, sessionId: 's',
});

describe('levelFor', () => {
  const pos = SKILL_BY_ID.position;
  it('記録がなければ基礎', () => expect(levelFor([], pos)).toBe(1));
  it('同じ段階で3問続けて正解なら上がる', () => {
    expect(levelFor([1, 2, 3].map((t) => att('position', 1, 'correct', t)), pos)).toBe(2);
    expect(levelFor([1, 2, 3].map((t) => att('position', 2, 'correct', t)), pos)).toBe(3);
  });
  it('最上段では上がらない', () => expect(levelFor([1, 2, 3].map((t) => att('position', 3, 'correct', t)), pos)).toBe(3));
  it('2問続けて誤答なら下がる', () => expect(levelFor([1, 2].map((t) => att('position', 2, 'wrong', t)), pos)).toBe(1));
  it('最新が誤答なら上がらない', () =>
    expect(levelFor([att('position', 1, 'correct', 1), att('position', 1, 'correct', 2), att('position', 1, 'correct', 3), att('position', 1, 'wrong', 4)], pos)).toBe(1));
});

it('季節の絵が揃うまで季節の問題は出さない', () => {
  expect(availableSkills(SKILLS, () => false).some((s) => s.id === 'season')).toBe(false);
  expect(availableSkills(SKILLS, () => true).some((s) => s.id === 'season')).toBe(true);
});

it('位置の基礎は1列で，4方向すべてが出る', () => {
  const dirs = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const p = SKILL_BY_ID.position.generate(1, seed);
    expect(p.cols === 1 || p.cols === p.choices.length).toBe(true);
    dirs.add(p.caption.split('から')[0]);
  }
  expect([...dirs].sort()).toEqual(['うえ', 'した', 'ひだり', 'みぎ'].sort());
});

describe('stepLevel（連続練習の途中の難易度）', () => {
  const L: Level[] = [1, 2, 3];
  it('2問続けて正解で1段上がる', () => {
    let st = { level: 1 as Level, streak: 0 };
    st = stepLevel(L, st.level, st.streak, 'correct');
    expect(st).toEqual({ level: 1, streak: 1 });
    st = stepLevel(L, st.level, st.streak, 'correct');
    expect(st).toEqual({ level: 2, streak: 0 });
  });
  it('誤答・未解答で1段下がる．基礎より下には行かない', () => {
    expect(stepLevel(L, 3, 1, 'wrong')).toEqual({ level: 2, streak: 0 });
    expect(stepLevel(L, 1, 1, 'none')).toEqual({ level: 1, streak: 0 });
  });
  it('最上段では上がらない', () => expect(stepLevel(L, 3, 1, 'correct')).toEqual({ level: 3, streak: 2 }));
  it('段階が1つだけの技能は変わらない', () => expect(stepLevel([1], 1, 5, 'correct').level).toBe(1));
});
