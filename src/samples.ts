// 確認用ページ：技能・難易度ごとのサンプル問題と，絵カード一覧
import { SKILLS, DOMAIN_NAME } from './skills';
import { CARDS, OPPOSITES, SEASON_CARDS } from './cards';
import { svgOf, hasImage } from './render';
import { LEVEL_NAME } from './gen/common';

const root = document.getElementById('root')!;
const nav = document.getElementById('nav')!;
const PER = 3;

let html = '';
for (const s of SKILLS) {
  for (const level of s.levels) {
    const anchor = `${s.id}-${level}`;
    nav.insertAdjacentHTML('beforeend', `<a href="#${anchor}">${DOMAIN_NAME[s.domain]}：${s.name}（${LEVEL_NAME[level]}）</a>`);
    html += `<h2 id="${anchor}">${DOMAIN_NAME[s.domain]}：${s.name}（${LEVEL_NAME[level]}）${s.paperOnly ? '【紙専用】' : ''}</h2>`;
    for (let i = 1; i <= PER; i++) {
      const p = s.generate(level, i * 7919);
      const err = s.check(p);
      html += `<div class="prob">
        <div class="meta">${p.key}${err ? ` <b class="missing">検査エラー: ${err}</b>` : ''}</div>
        <div class="speech">🔈 ${p.speech}</div>
        ${p.stimulus ? `<div class="stim">みほん：${svgOf(p.stimulus)}</div>` : ''}
        <div class="choices" style="grid-template-columns: repeat(${p.cols ?? p.choices.length}, 1fr)">
          ${p.choices.map((c, k) => `<div class="choice ${p.answers.includes(k) ? 'ok' : ''}">${svgOf(c)}</div>`).join('')}
        </div>
        <div class="explain">解説：${p.explain}</div>
      </div>`;
    }
  }
}

nav.insertAdjacentHTML('beforeend', '<a href="#gallery">絵カード一覧</a>');
const all = [...CARDS.map((c) => ({ id: c.id, name: c.name })), ...OPPOSITES.flatMap((p) => [p.a, p.b]).map((x) => ({ id: x.id, name: x.word })), ...SEASON_CARDS.map((c) => ({ id: c.id, name: c.name }))];
const missing = all.filter((x) => !hasImage(x.id)).length;
html += `<h2 id="gallery">絵カード一覧（${all.length}枚中 画像なし ${missing}枚）</h2><div class="gallery">`;
for (const x of all) {
  html += `<figure>${svgOf({ kind: 'card', id: x.id }, { frame: false })}<figcaption class="${hasImage(x.id) ? '' : 'missing'}">${x.name}<br><small>${x.id}.png</small></figcaption></figure>`;
}
html += '</div>';
root.innerHTML = html;
