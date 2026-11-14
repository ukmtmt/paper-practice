// 言語：語頭音，仲間分け，反対語（固定の組）
import type { Skill, Visual } from '../types';
import { Rng } from '../rng';
import { CARDS, CARD_BY_ID, CATEGORY_NAME, OPPOSITES, SUPER_CATEGORY, initialOf, seion, type Card } from '../cards';
import { basicCheck, keyOf, placeAnswer } from './common';

const INITIAL_OK = CARDS.filter((c) => !c.noInitial && c.category !== 'kazoe');
const cardV = (c: Card): Visual => ({ kind: 'card', id: c.id });
const cardOf = (v: Visual): Card | undefined => (v.kind === 'card' ? CARD_BY_ID[v.id] : undefined);

export const initial: Skill = {
  id: 'initial',
  domain: 'gengo',
  name: 'あたまの おと',
  weight: 1,
  levels: [1, 2],
  generate(level, seed) {
    const rng = new Rng(seed);
    // 標準：みほんと同じ音で始まる別の絵を選ぶ．同じ頭の音の絵が2枚以上ある音だけ使う
    const pool =
      level === 1 ? INITIAL_OK : INITIAL_OK.filter((c) => INITIAL_OK.filter((d) => initialOf(d) === initialOf(c)).length >= 2);
    const sample = rng.pick(pool);
    const mora = initialOf(sample);
    const target = level === 1 ? sample : rng.pick(pool.filter((c) => c !== sample && initialOf(c) === mora));
    // 誤答は濁点を外しても頭の音が違う絵（ぶ と ふ のような紛らわしい組を避ける）
    const others = INITIAL_OK.filter((c) => seion(initialOf(c)) !== seion(mora));
    const wrongs = rng.sample(others, 3);
    const { choices, answer } = placeAnswer(rng, cardV(target), wrongs.map(cardV));
    return {
      key: keyOf('initial', level, seed),
      skill: 'initial',
      level,
      speech:
        level === 1
          ? `「${mora}」の おとから はじまる ものに まるを つけましょう．`
          : `みほんの えと おなじ おとから はじまる ものに まるを つけましょう．`,
      caption: level === 1 ? `「${mora}」から はじまる もの` : 'みほんと おなじ おとで はじまる もの',
      stimulus: level === 1 ? undefined : cardV(sample),
      choices,
      cols: 4,
      answer,
      explain:
        level === 1
          ? `${target.name}は 「${mora}」から はじまる．`
          : `${sample.name}も ${target.name}も 「${mora}」から はじまる．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    const mora =
      p.level === 1 ? p.caption.match(/「(.)」/)?.[1] : p.stimulus && cardOf(p.stimulus) ? initialOf(cardOf(p.stimulus)!) : undefined;
    if (!mora) return '基準の音がない';
    const cs = p.choices.map(cardOf);
    if (cs.some((c) => !c || c.noInitial)) return '語頭音に使えない絵がある';
    const hits = cs.map((c) => initialOf(c!) === mora);
    if (hits.filter(Boolean).length !== 1) return `同じ音の選択肢が${hits.filter(Boolean).length}個`;
    const confusing = cs.filter((c, i) => !hits[i] && seion(initialOf(c!)) === seion(mora));
    if (confusing.length) return '濁点違いの紛らわしい誤答がある';
    if (p.stimulus && p.choices.some((c) => JSON.stringify(c) === JSON.stringify(p.stimulus))) return '見本と同じ絵が選択肢にある';
    return hits[p.answer] ? null : '正答が違う';
  },
};

const GROUPABLE = CARDS.filter((c) => c.category !== 'kazoe');

export const odd: Skill = {
  id: 'odd',
  domain: 'gengo',
  name: 'なかまはずれ',
  weight: 1,
  levels: [1, 2],
  generate(level, seed) {
    const rng = new Rng(seed);
    let main: Card[];
    let outlier: Card;
    if (level === 1) {
      const cat = rng.pick(['kudamono', 'yasai', 'doubutsu', 'norimono', 'dougu', 'mushi'] as const);
      main = rng.sample(
        GROUPABLE.filter((c) => c.category === cat),
        3,
      );
      outlier = rng.pick(GROUPABLE.filter((c) => SUPER_CATEGORY[c.category] !== SUPER_CATEGORY[cat]));
    } else {
      // 近い仲間どうし：くだもの対やさい，どうぶつ対むし
      const [a, b] = rng.pick([
        ['kudamono', 'yasai'],
        ['yasai', 'kudamono'],
        ['doubutsu', 'mushi'],
        ['mushi', 'doubutsu'],
      ] as const);
      const usable = GROUPABLE.filter((c) => !c.ambiguousProduce);
      main = rng.sample(
        usable.filter((c) => c.category === a),
        3,
      );
      outlier = rng.pick(usable.filter((c) => c.category === b));
    }
    const { choices, answer } = placeAnswer(rng, cardV(outlier), main.map(cardV));
    return {
      key: keyOf('odd', level, seed),
      skill: 'odd',
      level,
      speech: 'なかまで ない ものに まるを つけましょう．',
      caption: 'なかまで ない もの',
      choices,
      cols: 4,
      answer,
      explain: `ほかは ${CATEGORY_NAME[main[0].category]}．${outlier.name}は ${CATEGORY_NAME[outlier.category]}．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    const cs = p.choices.map(cardOf);
    if (cs.some((c) => !c)) return '絵でない選択肢';
    const cats = cs.map((c) => c!.category);
    const counts = new Map<string, number>();
    cats.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
    if (counts.size !== 2) return `分類が${counts.size}種類`;
    const minority = cats.filter((x) => counts.get(x) === 1);
    if (minority.length !== 1) return '仲間はずれが1つに決まらない';
    if (p.level === 2 && cs.some((c) => c!.ambiguousProduce)) return 'くだもの・やさいがあいまいな絵がある';
    return counts.get(cats[p.answer]) === 1 ? null : '正答が違う';
  },
};

/** 反対語は組が固定なので，シードは「どの絵を見本にするか」と並び順だけを決める */
export const opposite: Skill = {
  id: 'opposite',
  domain: 'gengo',
  name: 'はんたいの ことば',
  weight: 0.8,
  levels: [1],
  generate(level, seed) {
    const rng = new Rng(seed);
    const pair = rng.pick(OPPOSITES);
    const flip = rng.next() < 0.5;
    const shown = flip ? pair.b : pair.a;
    const partner = flip ? pair.a : pair.b;
    const otherImgs = OPPOSITES.filter((x) => x.group !== pair.group).flatMap((x) => [x.a, x.b]);
    const wrongs = rng.sample(otherImgs, 3);
    const v = (x: { id: string }): Visual => ({ kind: 'card', id: x.id });
    const { choices, answer } = placeAnswer(rng, v(partner), wrongs.map(v));
    return {
      key: keyOf('opposite', level, seed),
      skill: 'opposite',
      level,
      speech: `みほんは 「${shown.word}」 ようすです．「${shown.word}」の はんたいの ようすの ものに まるを つけましょう．`,
      caption: `「${shown.word}」の はんたい`,
      stimulus: v(shown),
      choices,
      cols: 4,
      answer,
      explain: `「${shown.word}」の はんたいは 「${partner.word}」．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    if (p.stimulus?.kind !== 'card') return '見本がない';
    const sid = p.stimulus.id;
    const pair = OPPOSITES.find((x) => x.a.id === sid || x.b.id === sid);
    if (!pair) return '見本が反対語の組にない';
    const partner = pair.a.id === sid ? pair.b.id : pair.a.id;
    const ids = p.choices.map((c) => (c.kind === 'card' ? c.id : ''));
    if (ids.filter((x) => x === partner).length !== 1) return '対になる絵が1つでない';
    const sameGroup = ids.filter((x) => x !== partner && OPPOSITES.some((o) => o.group === pair.group && (o.a.id === x || o.b.id === x)));
    if (sameGroup.length) return '意味の近い組の絵が誤答にある';
    return ids[p.answer] === partner ? null : '正答が違う';
  },
};
