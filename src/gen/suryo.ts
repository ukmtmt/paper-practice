// 数量：数える，同じ数，多い・少ない，系列
import type { Level, Problem, Skill, Visual } from '../types';
import { Rng } from '../rng';
import { CARDS, CARD_BY_ID } from '../cards';
import { basicCheck, countOf, kazu, keyOf, nearDistractors, placeAnswer, placeMany, sameSet, scatter } from './common';

const COUNTABLE = CARDS.filter((c) => ['kudamono', 'yasai', 'mushi', 'kazoe'].includes(c.category)).map((c) => c.id);
const ROWABLE = CARDS.filter((c) => c.category !== 'kazoe').map((c) => c.id);
const name = (id: string) => CARD_BY_ID[id].name;

export const count: Skill = {
  id: 'count',
  domain: 'suryo',
  name: 'かずを かぞえる',
  weight: 1,
  levels: [1, 2],
  generate(level: Level, seed: number): Problem {
    const rng = new Rng(seed);
    const [target, ...others] = rng.sample(COUNTABLE, 3);
    const n = level === 1 ? rng.int(3, 7) : rng.int(4, 10);
    const ids = Array(n).fill(target);
    if (level === 2) {
      const m = Math.min(12 - n, rng.int(2, 5));
      for (let i = 0; i < m; i++) ids.push(rng.pick(others));
    }
    const stimulus = scatter(rng, rng.shuffle(ids));
    const wrong = nearDistractors(rng, n, 3, 1, 10, 2).map((k): Visual => ({ kind: 'circles', n: k }));
    const { choices, answer } = placeAnswer(rng, { kind: 'circles', n }, wrong);
    return {
      key: keyOf('count', level, seed),
      skill: 'count',
      level,
      speech: `${name(target)}は いくつ ありますか．${name(target)}と おなじ かずの まるが かいてある はこに まるを つけましょう．`,
      caption: `${name(target)}は いくつ？`,
      stimulus,
      choices,
      cols: 4,
      answers: [answer],
      explain: `${name(target)}を ひとつずつ ゆびで おさえて かぞえると ${kazu(n)}．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    if (p.stimulus?.kind !== 'scatter') return '見本がない';
    const target = p.caption.split('は いくつ')[0];
    const id = CARDS.find((c) => c.name === target)?.id;
    const n = countOf(p.stimulus, id);
    const hits = p.choices.filter((c) => countOf(c) === n).length;
    if (hits !== 1) return `数が一致する選択肢が${hits}個`;
    if (countOf(p.choices[p.answers[0]]) !== n) return '正答の数が違う';
    return null;
  },
};

export const sameCount: Skill = {
  id: 'sameCount',
  domain: 'suryo',
  name: 'おなじ かず',
  weight: 1,
  levels: [1, 2, 3],
  generate(level, seed) {
    const rng = new Rng(seed);
    const [sample, ...rest] = rng.sample(COUNTABLE, 7);
    const n = level === 1 ? rng.int(3, 6) : rng.int(5, 9);
    if (level === 3) {
      // 発展：おなじ数の物を すべて選ぶ（6つのうち2〜3つ）
      const k = rng.int(2, 3);
      const wrongNs = Array.from({ length: 6 - k }, () => nearDistractors(rng, n, 1, 1, 10, 2)[0]);
      const corrects = Array.from({ length: k }, (_, i) => scatter(rng, Array(n).fill(rest[i])));
      const wrongs = wrongNs.map((m, i) => scatter(rng, Array(m).fill(rest[k + i])));
      const { choices, answers } = placeMany(rng, corrects, wrongs);
      return {
        key: keyOf('sameCount', level, seed),
        skill: 'sameCount',
        level,
        speech: `みほんの ${name(sample)}と おなじ かずの ものに ぜんぶ まるを つけましょう．`,
        caption: 'みほんと おなじ かず（ぜんぶ）',
        stimulus: scatter(rng, Array(n).fill(sample)),
        choices,
        cols: 3,
        answers,
        multi: true,
        explain: `みほんは ${kazu(n)}．${kazu(n)}の ものは ${kazu(k)} ある．`,
      };
    }
    const wrongNs = nearDistractors(rng, n, 3, 1, 10, level === 1 ? 3 : 2);
    const wrong = wrongNs.map((k, i) => scatter(rng, Array(k).fill(rest[i + 1])));
    const { choices, answer } = placeAnswer(rng, scatter(rng, Array(n).fill(rest[0])), wrong);
    return {
      key: keyOf('sameCount', level, seed),
      skill: 'sameCount',
      level,
      speech: `みほんの ${name(sample)}と おなじ かずの ものに まるを つけましょう．`,
      caption: 'みほんと おなじ かず',
      stimulus: scatter(rng, Array(n).fill(sample)),
      choices,
      cols: 2,
      answers: [answer],
      explain: `みほんは ${kazu(n)}．おなじ ${kazu(n)}の ものを さがす．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    if (!p.stimulus) return '見本がない';
    const n = countOf(p.stimulus);
    const hits = p.choices.map((c) => countOf(c) === n);
    if (!p.multi && hits.filter(Boolean).length !== 1) return `同数の選択肢が${hits.filter(Boolean).length}個`;
    return sameSet(hits, p.answers) ? null : '正答の組み合わせが違う';
  },
};

export const compare: Skill = {
  id: 'compare',
  domain: 'suryo',
  name: 'おおい・すくない',
  weight: 1,
  levels: [1, 2],
  generate(level, seed) {
    const rng = new Rng(seed);
    const [a, b] = rng.sample(COUNTABLE, 2);
    if (level === 1) {
      const na = rng.int(3, 8);
      let nb = rng.int(3, 8);
      while (Math.abs(na - nb) < 2) nb = rng.int(3, 8);
      const more = na > nb ? 0 : 1;
      const askMore = rng.next() < 0.5;
      const choices = [scatter(rng, Array(na).fill(a)), scatter(rng, Array(nb).fill(b))];
      const answer = askMore ? more : 1 - more;
      const word = askMore ? 'おおい' : 'すくない';
      return {
        key: keyOf('compare', level, seed),
        skill: 'compare',
        level,
        speech: `${name(a)}と ${name(b)}では，どちらが ${word}ですか．${word} ほうに まるを つけましょう．`,
        caption: `どちらが ${word}？`,
        choices,
        cols: 2,
        answers: [answer],
        explain: `${name(a)}は ${kazu(na)}，${name(b)}は ${kazu(nb)}．`,
      };
    }
    const na = rng.int(3, 9);
    let nb = rng.int(3, 9);
    while (na === nb || Math.abs(na - nb) > 4) nb = rng.int(3, 9);
    const d = Math.abs(na - nb);
    const wrong = nearDistractors(rng, d, 3, 1, 6, 3).map((k): Visual => ({ kind: 'circles', n: k }));
    const { choices, answer } = placeAnswer(rng, { kind: 'circles', n: d }, wrong);
    return {
      key: keyOf('compare', level, seed),
      skill: 'compare',
      level,
      speech: `${name(a)}と ${name(b)}では，おおい ほうが いくつ おおいですか．その かずの まるが かいてある はこに まるを つけましょう．`,
      caption: 'いくつ おおい？',
      stimulus: { kind: 'pair', left: scatter(rng, Array(na).fill(a)), right: scatter(rng, Array(nb).fill(b)) },
      choices,
      cols: 4,
      answers: [answer],
      explain: `${name(a)}は ${kazu(na)}，${name(b)}は ${kazu(nb)}．ひとつずつ せんで むすぶと ${kazu(d)} あまる．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    if (p.level === 1) {
      const [x, y] = p.choices.map((c) => countOf(c));
      if (x === y) return '同数';
      const askMore = p.caption.includes('おおい');
      const want = askMore ? (x > y ? 0 : 1) : x < y ? 0 : 1;
      return p.answers[0] === want ? null : '正答が違う';
    }
    if (p.stimulus?.kind !== 'pair') return '見本がない';
    const d = Math.abs(countOf(p.stimulus.left) - countOf(p.stimulus.right));
    const hits = p.choices.filter((c) => countOf(c) === d).length;
    if (hits !== 1) return `差が一致する選択肢が${hits}個`;
    return countOf(p.choices[p.answers[0]]) === d ? null : '正答が違う';
  },
};

const PATTERNS: Record<1 | 2, number[][]> = {
  1: [
    [0, 1],
    [0, 1, 2],
  ],
  2: [
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 2],
    [0, 0, 1, 2],
  ],
};

/** 空欄を埋めた列が「周期 p ≤ 長さ/2 で繰り返す」なら true */
function periodic(row: string[]): boolean {
  for (let p = 2; p <= row.length / 2; p++) {
    if (row.every((x, i) => x === row[i % p])) return true;
  }
  return false;
}

export const sequence: Skill = {
  id: 'sequence',
  domain: 'suryo',
  name: 'きまりの ならび',
  weight: 0.8,
  levels: [1, 2],
  generate(level, seed) {
    const rng = new Rng(seed);
    const pat = rng.pick(PATTERNS[level === 1 ? 1 : 2]);
    const kinds = Math.max(...pat) + 1;
    const pool = rng.sample(ROWABLE, kinds + 2);
    const used = pool.slice(0, kinds);
    const len = level === 1 ? 8 : 9;
    const full = Array.from({ length: len }, (_, i) => used[pat[i % pat.length]]);
    const blank = rng.int(pat.length, len - 1);
    const ids: (string | null)[] = [...full];
    ids[blank] = null;
    const correct = full[blank];
    const nChoices = level === 1 ? 3 : 4;
    const wrongIds = rng.shuffle([...used.filter((x) => x !== correct), ...pool.slice(kinds)]).slice(0, nChoices - 1);
    const { choices, answer } = placeAnswer(
      rng,
      { kind: 'card', id: correct },
      wrongIds.map((id): Visual => ({ kind: 'card', id })),
    );
    return {
      key: keyOf('sequence', level, seed),
      skill: 'sequence',
      level,
      speech: 'えが きまりの とおりに ならんで います．あいている ところに はいる ものに まるを つけましょう．',
      caption: 'あいている ところに はいるのは？',
      stimulus: { kind: 'row', ids },
      choices,
      answers: [answer],
      explain: `「${pat.map((i) => name(used[i])).join('，')}」の じゅんばんの くりかえし．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    if (p.stimulus?.kind !== 'row') return '見本がない';
    const row = p.stimulus.ids;
    const ok = p.choices.map((c) => c.kind === 'card' && periodic(row.map((x) => x ?? c.id)));
    const hits = ok.filter(Boolean).length;
    if (hits !== 1) return `きまりに合う選択肢が${hits}個`;
    return ok[p.answers[0]] ? null : '正答が違う';
  },
};

// ---- 重さくらべ（シーソー） ----

/** シーソーに載せるのは大きさの近い くだもの・やさいだけ（すいかとたまねぎのように現実の重さと矛盾する組を避ける） */
const PRODUCE = ['ringo', 'mikan', 'momo', 'tomato', 'tamanegi', 'nasu'];

/** どちらが重いかをシーソーで示す（重い方 heavy が下がる）．左右はランダム */
function seesaw(rng: Rng, heavy: string, light: string): Visual {
  return rng.next() < 0.5 ? { kind: 'seesaw', left: [heavy], right: [light], tilt: -1 } : { kind: 'seesaw', left: [light], right: [heavy], tilt: 1 };
}

/** シーソーの集まりから「a は b より重い」の関係を読み取る */
function heavierPairs(v: Visual): [string, string][] {
  const list = v.kind === 'stack' ? v.items : [v];
  return list.flatMap((s): [string, string][] =>
    s.kind === 'seesaw' && s.tilt !== 0 && s.left.length === 1 && s.right.length === 1
      ? [s.tilt === -1 ? [s.left[0], s.right[0]] : [s.right[0], s.left[0]]]
      : [],
  );
}

/** 関係から，ほかのどれよりも重い（軽い）と確定する物．1つに決まらなければ null */
function extreme(pairs: [string, string][], items: string[], heaviest: boolean): string | null {
  // 推移律で閉包をとる
  const gt = new Set(pairs.map(([a, b]) => `${a}>${b}`));
  let changed = true;
  while (changed) {
    changed = false;
    for (const x of gt) for (const y of gt) {
      const [a, b] = x.split('>');
      const [c, d] = y.split('>');
      if (b === c && !gt.has(`${a}>${d}`)) {
        gt.add(`${a}>${d}`);
        changed = true;
      }
    }
  }
  const win = items.filter((x) => items.every((y) => y === x || gt.has(heaviest ? `${x}>${y}` : `${y}>${x}`)));
  return win.length === 1 ? win[0] : null;
}

export const weight: Skill = {
  id: 'weight',
  domain: 'suryo',
  name: 'おもさくらべ（シーソー）',
  weight: 0.9,
  levels: [1, 2, 3],
  generate(level, seed) {
    const rng = new Rng(seed);
    if (level === 3) {
      // 発展：つりあい．A 1こ と B k こ がつりあう．A m こ は B なんこ？
      const [a, b] = rng.sample(PRODUCE, 2);
      const k = rng.int(2, 3);
      const m = rng.int(2, 3);
      const ans = k * m;
      const wrong = nearDistractors(rng, ans, 3, 2, 10, 3).map((x): Visual => ({ kind: 'circles', n: x }));
      const { choices, answer } = placeAnswer(rng, { kind: 'circles', n: ans }, wrong);
      return {
        key: keyOf('weight', level, seed),
        skill: 'weight',
        level,
        speech: `${name(a)} ひとつと ${name(b)} ${kazu(k)}が つりあって います．${name(a)} ${kazu(m)}と つりあうのは，${name(b)} いくつですか．その かずの まるが かいてある はこに まるを つけましょう．`,
        caption: `${name(a)} ${kazu(m)}と つりあうのは ${name(b)} いくつ？`,
        stimulus: { kind: 'seesaw', left: [a], right: Array(k).fill(b), tilt: 0 },
        choices,
        cols: 4,
        answers: [answer],
        explain: `${name(a)} ひとつが ${name(b)} ${kazu(k)}ぶん．${name(a)}が ${kazu(m)}なら ${name(b)}は ${kazu(ans)}．`,
      };
    }
    const n = level === 1 ? 2 : 3;
    const order = rng.sample(PRODUCE, n); // 重い順
    const askHeavy = rng.next() < 0.5;
    const word = askHeavy ? 'おもい' : 'かるい';
    let stimulus: Visual;
    if (level === 1) stimulus = seesaw(rng, order[0], order[1]);
    else stimulus = { kind: 'stack', items: rng.shuffle([seesaw(rng, order[0], order[1]), seesaw(rng, order[1], order[2])]) };
    const target = askHeavy ? order[0] : order[n - 1];
    const { choices, answers } = placeMany(rng, [{ kind: 'card', id: target } as Visual], order.filter((x) => x !== target).map((id): Visual => ({ kind: 'card', id })));
    const q = level === 1 ? `${word} ほう` : `いちばん ${word} もの`;
    return {
      key: keyOf('weight', level, seed),
      skill: 'weight',
      level,
      speech: `シーソーは おもい ほうが したに さがります．${q}に まるを つけましょう．`,
      caption: `${q}は どれ？`,
      stimulus,
      choices,
      cols: n,
      answers,
      explain:
        level === 1
          ? `したに さがって いる ${name(order[0])}の ほうが おもい．`
          : `${name(order[0])}は ${name(order[1])}より おもく，${name(order[1])}は ${name(order[2])}より おもい．おもい じゅんに ${order.map(name).join('，')}．`,
    };
  },
  check(p) {
    const e = basicCheck(p);
    if (e) return e;
    if (!p.stimulus) return '見本がない';
    if (p.level === 3) {
      const s = p.stimulus;
      if (s.kind !== 'seesaw' || s.tilt !== 0 || s.left.length !== 1) return 'つりあいの図でない';
      const m = ['', 'ひとつ', 'ふたつ', 'みっつ'].indexOf(p.caption.split(' ')[1].replace(/と$/, ''));
      if (m < 1) return '個数を読めない';
      const want = s.right.length * m;
      const hits = p.choices.map((c) => countOf(c) === want);
      if (hits.filter(Boolean).length !== 1) return `答えの数の選択肢が${hits.filter(Boolean).length}個`;
      return sameSet(hits, p.answers) ? null : '正答が違う';
    }
    const items = p.choices.map((c) => (c.kind === 'card' ? c.id : ''));
    const heavy = p.caption.includes('おもい');
    const x = extreme(heavierPairs(p.stimulus), items, heavy);
    if (!x) return 'いちばんが1つに決まらない';
    return sameSet(items.map((i) => i === x), p.answers) ? null : '正答が違う';
  },
};
