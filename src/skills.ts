import type { Domain, Problem, Skill } from './types';
import { compare, count, sameCount, sequence } from './gen/suryo';
import { dots, position, shape } from './gen/zukei';
import { initial, odd, opposite } from './gen/gengo';
import { parseKey } from './gen/common';

export const SKILLS: Skill[] = [count, sameCount, compare, sequence, shape, position, dots, initial, odd, opposite];
export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const DOMAIN_NAME: Record<Domain, string> = { suryo: 'かず', zukei: 'ずけい', gengo: 'ことば' };

/** key（skill:level:seed）から問題を再生成する */
export function problemFromKey(key: string): Problem {
  const { skill, level, seed } = parseKey(key);
  return SKILL_BY_ID[skill].generate(level, seed);
}
