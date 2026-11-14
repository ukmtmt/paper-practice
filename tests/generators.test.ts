import { describe, expect, it } from 'vitest';
import { SKILLS, problemFromKey } from '../src/skills';
import { CARDS, OPPOSITES } from '../src/cards';

const N = 1000;

describe.each(SKILLS.flatMap((s) => s.levels.map((level) => [s.id, level] as const)))('%s level %i', (id, level) => {
  const skill = SKILLS.find((s) => s.id === id)!;

  it(`${N}問すべてで正答が一つに決まる`, () => {
    const errors: string[] = [];
    for (let seed = 1; seed <= N; seed++) {
      const p = skill.generate(level, seed);
      const e = skill.check(p);
      if (e) errors.push(`seed ${seed}: ${e}`);
    }
    expect(errors.slice(0, 5)).toEqual([]);
  });

  it('同じシードから同じ問題ができ，key から再生成できる', () => {
    for (const seed of [1, 42, 123456789, 4294967295]) {
      const a = skill.generate(level, seed);
      expect(skill.generate(level, seed)).toEqual(a);
      expect(problemFromKey(a.key)).toEqual(a);
    }
  });

  it.skipIf(skill.paperOnly)('正答番号をずらすと検査が失敗する（検査が働いている）', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = skill.generate(level, seed);
      const bad = { ...p, answer: (p.answer + 1) % p.choices.length };
      expect(skill.check(bad), `seed ${seed}`).not.toBeNull();
    }
  });

  it('シードを変えると問題が変わる', () => {
    const keys = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const p = skill.generate(level, seed);
      keys.add(JSON.stringify([p.stimulus, p.choices, p.caption]));
    }
    expect(keys.size).toBeGreaterThan(id === 'opposite' ? 15 : 40);
  });
});

it('絵のIDが依頼文と重複しない', () => {
  const ids = [...CARDS.map((c) => c.id), ...OPPOSITES.flatMap((p) => [p.a.id, p.b.id])];
  expect(new Set(ids).size).toBe(ids.length);
  expect(CARDS.length).toBe(50);
  expect(OPPOSITES.length).toBe(10);
});
