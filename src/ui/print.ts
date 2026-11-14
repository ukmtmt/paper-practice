// A4プリント：子ども用（問題のみ）と保護者用（読み上げ台本・正答）
import { go, h, mount } from '../dom';
import { all, type PrintSet } from '../db';
import { problemFromKey, SKILL_BY_ID } from '../skills';
import { svgOf } from '../render';
import type { Problem } from '../types';

const MARU = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫';

/** 正答の場所を言葉で（保護者用） */
export function answerText(p: Problem): string {
  if (p.paperOnly) return '見本と同じ線が引けていれば正答';
  const cols = p.cols ?? p.choices.length;
  const r = Math.floor(p.answer / cols) + 1;
  const c = (p.answer % cols) + 1;
  const rows = Math.ceil(p.choices.length / cols);
  return rows > 1 ? `上から${r}段目・左から${c}番目` : `左から${c}番目`;
}

function childQ(p: Problem, k: number): HTMLElement {
  const cols = p.cols ?? p.choices.length;
  if (p.paperOnly) {
    return h(
      'div',
      { class: 'pq dotsq' },
      h('div', { class: 'no' }, MARU[k]),
      h('div', { class: 'dotsrow', html: svgOf(p.stimulus!) + svgOf(p.choices[0]) }),
    );
  }
  return h(
    'div',
    { class: 'pq' },
    h('div', { class: 'no' }, MARU[k]),
    h(
      'div',
      {},
      p.stimulus ? h('div', { class: 'stimp', html: svgOf(p.stimulus) }) : null,
      h('div', { class: 'chp', style: `grid-template-columns: repeat(${cols}, 1fr)`, html: p.choices.map((c) => svgOf(c)).join('') }),
    ),
  );
}

export async function printView(id: number): Promise<void> {
  const ps = await all<PrintSet>('prints');
  const set = ps.find((x) => x.id === id);
  if (!set) return mount(h('p', {}, 'プリントが見つかりません．'));
  const probs = set.keys.map(problemFromKey);
  const date = new Date(set.at).toLocaleDateString('ja-JP');
  const doPrint = (cls: string) => {
    document.body.className = cls;
    window.print();
  };

  // 子ども用：実際の高さを測って，A4の印刷範囲（約250mm）に収まるようにページを分ける
  const qs = probs.map((p, k) => childQ(p, k));
  const probe = h('div', { class: 'sheet child-sheet', style: 'position:absolute;visibility:hidden;left:-9999px' }, ...qs);
  document.body.append(probe);
  const MM = 96 / 25.4;
  const LIMIT = 250 * MM;
  const heights = qs.map((q) => q.getBoundingClientRect().height + 8 * MM);
  probe.remove();
  const pages: HTMLElement[][] = [];
  let cur: HTMLElement[] = [];
  let used = 0;
  qs.forEach((q, i) => {
    if (used + heights[i] > LIMIT && cur.length) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(q);
    used += heights[i];
  });
  if (cur.length) pages.push(cur);

  const childSheets = pages.map((pg, i) =>
    h(
      'div',
      { class: 'sheet child-sheet' },
      h('h2', {}, h('span', {}, `プリント No.${set.id}`), h('span', {}, `${i + 1} / ${pages.length}`)),
      ...pg,
    ),
  );

  const parentSheet = h(
    'div',
    { class: 'sheet parent-sheet' },
    h('h2', {}, h('span', {}, `プリント No.${set.id}　保護者用（読み上げ台本・正答）`), h('span', {}, date)),
    h(
      'table',
      { class: 'ptable' },
      h('tr', {}, h('th', {}, '番号'), h('th', {}, '読み上げる文'), h('th', {}, '正答'), h('th', {}, '技能')),
      ...probs.map((p, i) =>
        h(
          'tr',
          {},
          h('td', {}, MARU[i]),
          h('td', {}, p.speech),
          h('td', {}, answerText(p), h('div', { style: 'font-size:9pt' }, p.explain)),
          h('td', {}, `${SKILL_BY_ID[p.skill].name}（${p.level === 1 ? '基礎' : '標準'}）`, h('div', { style: 'font-size:8pt;color:#555' }, p.key)),
        ),
      ),
    ),
    h('p', { style: 'font-size:9pt' }, '読み上げは1問につき1回を目安にする．子どもには鉛筆で選んだ絵に○を付けさせる．終わったら保護者画面の「結果入力」で1問ずつ記録する．'),
  );

  mount(
    h(
      'div',
      {},
      h(
        'div',
        { class: 'printbar' },
        h('button', { class: 'btn', onclick: () => go('#parent/prints') }, '← もどる'),
        h('button', { class: 'btn primary', onclick: () => doPrint('only-child') }, '子ども用を印刷'),
        h('button', { class: 'btn', onclick: () => doPrint('only-parent') }, '保護者用を印刷'),
        h('span', { class: 'note' }, '印刷設定：A4・縦・倍率100%（拡大縮小なし）'),
      ),
      ...childSheets,
      parentSheet,
    ),
  );
}
