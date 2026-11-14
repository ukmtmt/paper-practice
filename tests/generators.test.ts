import { describe, expect, it } from 'vitest';
import { SKILLS, problemFromKey } from '../src/skills';
import { CARDS, OPPOSITES, SEASON_CARDS } from '../src/cards';

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

  it.skipIf(skill.paperOnly)('正答をずらす・欠く・足すと検査が失敗する（検査が働いている）', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = skill.generate(level, seed);
      const n = p.choices.length;
      const wrongs = [...Array(n).keys()].filter((k) => !p.answers.includes(k));
      const shifted = { ...p, answers: p.answers.map((a) => (a + 1) % n) };
      if (JSON.stringify([...shifted.answers].sort()) !== JSON.stringify([...p.answers].sort()))
        expect(skill.check(shifted), `ずらす seed ${seed}`).not.toBeNull();
      if (p.multi) {
        expect(skill.check({ ...p, answers: p.answers.slice(1) }), `欠く seed ${seed}`).not.toBeNull();
        expect(skill.check({ ...p, answers: [...p.answers, wrongs[0]] }), `足す seed ${seed}`).not.toBeNull();
      }
    }
  });

  it('シードを変えると問題が変わる', () => {
    const keys = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const p = skill.generate(level, seed);
      keys.add(JSON.stringify([p.stimulus, p.choices, p.caption]));
    }
    expect(keys.size).toBeGreaterThan(id === 'opposite' ? 15 : id === 'weight' && level === 1 ? 30 : 40);
  });
});

it('絵のIDが依頼文と重複しない', () => {
  const ids = [...CARDS.map((c) => c.id), ...OPPOSITES.flatMap((p) => [p.a.id, p.b.id]), ...SEASON_CARDS.map((c) => c.id)];
  expect(new Set(ids).size).toBe(ids.length);
  expect(SEASON_CARDS.length).toBe(28);
  expect(CARDS.length).toBe(50);
  expect(OPPOSITES.length).toBe(10);
});
