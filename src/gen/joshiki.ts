// 常識：季節
import type { Skill, Visual } from '../types';
import { Rng } from '../rng';
import { SEASON_ALL, SEASON_CARDS, SEASON_NAME, type Season, type SeasonCard } from '../cards';
import { basicCheck, keyOf, placeMany, sameSet } from './common';

const SEASONS: Season[] = ['haru', 'natsu', 'aki', 'fuyu'];
const seasonOf = (id: string) => SEASON_ALL.find((c) => c.id === id)?.season;
const cardV = (c: SeasonCard): Visual => ({ kind: 'card', id: c.id });

export const season: Skill = {
  id: 'season',
  domain: 'joshiki',
  name: 'きせつ',
  weight: 0.8,
  levels: [1, 2, 3],
  requires: SEASON_CARDS.map((c) => c.id),
  generate(level, seed) {
    const rng = new Rng(seed);
    const s = rng.pick(SEASONS);
    const S = SEASON_NAME[s];
    const inS = SEASON_ALL.filter((c) => c.season === s);
    const outS = SEASON_ALL.filter((c) => c.season !== s);
    let corrects: SeasonCard[];
    let wrongs: SeasonCard[];
    let speech: string;
    let caption: string;
    let explain: string;
    if (level === 1) {
      corrects = rng.sample(inS, 1);
      wrongs = rng.sample(outS, 3);
      speech = `${S}の ものに まるを つけましょう．`;
      caption = `${S}の もの`;
      explain = `${corrects[0].name}は ${S}．`;
    } else if (level === 2) {
      // 標準：その季節で ない物を1つ（3つは同じ季節）
      corrects = rng.sample(outS, 1);
      wrongs = rng.sample(inS, 3);
      speech = `${S}で ない ものに まるを つけましょう．`;
      caption = `${S}で ない もの`;
      explain = `${corrects[0].name}は ${SEASON_NAME[corrects[0].season]}．ほかは ${S}．`;
    } else {
      const k = rng.int(2, 3);
      corrects = rng.sample(inS, k);
      wrongs = rng.sample(outS, 6 - k);
      speech = `${S}の ものに ぜんぶ まるを つけましょう．`;
      caption = `${S}の もの（ぜんぶ）`;
      explain = `${S}の ものは ${corrects.map((c) => c.name).join('，')}．`;
    }
    const { choices, answers } = placeMany(rng, corrects.map(cardV), wrongs.map(cardV));
    return {
      key: keyOf('season', level, seed),
      skill: 'season',
      level,
      speech,
      caption,
      choices,
      cols: level === 3 ? 3 : 4,
      answers,
      multi: level === 3 || undefined,
      explain,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    const s = SEASONS.find((x) => p.caption.startsWith(SEASON_NAME[x]));
    if (!s) return '季節を読めない';
    const ss = p.choices.map((c) => (c.kind === 'card' ? seasonOf(c.id) : undefined));
    if (ss.some((x) => !x)) return '季節の絵でない選択肢';
    const hits = ss.map((x) => (p.caption.includes('で ない') ? x !== s : x === s));
    if (!p.multi && hits.filter(Boolean).length !== 1) return `あてはまる選択肢が${hits.filter(Boolean).length}個`;
    return sameSet(hits, p.answers) ? null : '正答の組み合わせが違う';
  },
};
