// 保護者用：記録・プリント・結果入力・設定
import { go, h, mount } from '../dom';
import {
  all,
  exportAll,
  getSettings,
  importAll,
  nextPrintId,
  put,
  saveSettings,
  type Attempt,
  type PrintSet,
  type Result,
  type Session,
  type Settings,
} from '../db';
import { availableSkills, levelFor, planPrint, stats, usable } from '../select';
import { DOMAIN_NAME, SKILLS, SKILL_BY_ID, problemFromKey } from '../skills';
import { newSeed } from '../rng';
import { setRate, speak, stopSpeech, waitVoices } from '../speech';
import { answerText } from './print';
import { LEVEL_NAME } from '../gen/common';
import { hasImage } from '../render';
import { startFocus } from './child';
import type { Level } from '../types';

let unlocked = false;
export const lockParent = () => (unlocked = false);

/** 計算問題のロック（子どもが誤って入らないように） */
export function gate(then: () => void): void {
  if (unlocked) return then();
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 4 + Math.floor(Math.random() * 6);
  const input = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'こたえ' });
  const check = () => {
    if (Number(input.value.normalize("NFKC").trim()) === a + b) { // 日本語キーボードの全角数字も受け付ける
      unlocked = true;
      then();
    } else input.value = '';
  };
  mount(
    h(
      'div',
      { class: 'gate' },
      h('div', {}, '保護者の方へ'),
      h('div', {}, `${a} + ${b} = ?`),
      input,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go('') }, 'もどる'), h('button', { class: 'btn primary', onclick: check }, 'ひらく')),
    ),
  );
  input.addEventListener('keydown', (e) => e.key === 'Enter' && check());
  input.focus();
}

const TABS: [string, string][] = [
  ['focus', '種類を選んで練習'],
  ['records', '学習記録'],
  ['prints', 'プリント'],
  ['enter', '結果入力'],
  ['settings', '設定・データ'],
];

export async function parentView(tab: string, arg?: string): Promise<void> {
  stopSpeech();
  const body = h('div');
  mount(
    h(
      'div',
      { class: 'parent' },
      h('h1', {}, h('span', {}, '保護者画面'), h('button', { class: 'btn', onclick: () => (unlocked = false, go('')) }, '子ども画面へ')),
      h('div', { class: 'tabs' }, ...TABS.map(([id, label]) => h('button', { class: id === tab ? 'on' : '', onclick: () => go(`#parent/${id}`) }, label))),
      body,
    ),
  );
  if (tab === 'focus') await focusView(body);
  else if (tab === 'records') await records(body);
  else if (tab === 'prints') await prints(body);
  else if (tab === 'enter') await enter(body, arg ? Number(arg) : undefined);
  else await settingsView(body);
}

const pct = (x: { n: number; correct: number }) => (x.n ? `${x.correct}/${x.n}` : '−');

/** 種類を選んで連続練習：技能・問題数・難易度を選び，子どもに渡して始める */
async function focusView(body: HTMLElement): Promise<void> {
  const attempts = usable(await all<Attempt>('attempts'), await all<Session>('sessions'));
  const skills = availableSkills(SKILLS, hasImage).filter((s) => !s.paperOnly);
  const st = stats(skills, attempts);
  let chosen = [...st].sort((a, b) => b.priority - a.priority)[0].skill.id;
  const list = h('div');
  const levelSel = h('select');
  const fillLevels = () => {
    const sk = SKILL_BY_ID[chosen];
    const now = levelFor(attempts, sk);
    levelSel.replaceChildren(
      h('option', { value: 'auto' }, `自動（今は${LEVEL_NAME[now]}から．2問続けて正解で上げ，間違えたら下げる）`),
      ...sk.levels.map((l) => h('option', { value: String(l) }, `${LEVEL_NAME[l]}だけ`)),
    );
  };
  const renderList = () => {
    list.replaceChildren(
      ...st.map((x) =>
        h(
          'label',
          { class: 'chk', style: 'display:flex' },
          h('input', {
            type: 'radio',
            name: 'focus-skill',
            value: x.skill.id,
            checked: x.skill.id === chosen,
            onchange: () => {
              chosen = x.skill.id;
              fillLevels();
            },
          }),
          `${DOMAIN_NAME[x.skill.domain]}：${x.skill.name}`,
          h('span', { class: 'note' }, `　画面 ${pct(x.screen)}・紙 ${pct(x.paper)}`),
        ),
      ),
    );
  };
  renderList();
  fillLevels();
  const count = h('select', {}, ...[5, 6, 8, 10].map((n) => h('option', { value: n, selected: n === 8 }, `${n}問`)));
  const start = () => {
    const lv = levelSel.value === 'auto' ? 'auto' : (Number(levelSel.value) as Level);
    void startFocus({ skill: chosen, n: Number(count.value), level: lv });
  };
  body.append(
    h('div', { class: 'card' }, h('b', {}, '練習する種類'), list),
    h('div', { class: 'row' }, '問題数', count, '難易度', levelSel),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: start }, 'この内容で子どもに渡す')),
    h('p', { class: 'note' }, '初期選択は「次に練習する候補」の先頭．発展では「ぜんぶ まるを」の複答が出る技能がある（同じ数・頭の音・仲間・季節）．'),
  );
}

async function records(body: HTMLElement): Promise<void> {
  const attempts = usable(await all<Attempt>('attempts'), await all<Session>('sessions'));
  const st = stats(SKILLS, attempts);
  const next = [...st].filter((s) => !s.skill.paperOnly).sort((a, b) => b.priority - a.priority).slice(0, 3);
  body.append(
    h(
      'div',
      { class: 'card' },
      h('b', {}, '次に練習する候補：'),
      next.map((s) => `${DOMAIN_NAME[s.skill.domain]}「${s.skill.name}」`).join('，'),
      h('div', { class: 'note' }, '直近5問の誤答（画面・紙の両方）と暫定頻出の重みから算出．「きょうのれんしゅう」はこの順で多めに出題する．'),
    ),
    h(
      'table',
      {},
      h(
        'tr',
        {},
        h('th', {}, '領域'),
        h('th', {}, '技能'),
        h('th', { class: 'num' }, '画面（初見）'),
        h('th', { class: 'num' }, '紙（初見）'),
        h('th', { class: 'num' }, '解き直し'),
        h('th', { class: 'num' }, '次の難易度'),
      ),
      ...st.map((s) =>
        h(
          'tr',
          {},
          h('td', {}, DOMAIN_NAME[s.skill.domain]),
          h('td', {}, s.skill.name, s.skill.paperOnly ? '（紙専用）' : '', s.skill.requires && !s.skill.requires.every(hasImage) ? '（絵の準備待ち）' : ''),
          h('td', { class: 'num' }, s.skill.paperOnly ? '' : pct(s.screen)),
          h('td', { class: 'num' }, pct(s.paper)),
          h('td', { class: 'num' }, pct(s.retry)),
          h('td', { class: 'num' }, LEVEL_NAME[s.level]),
        ),
      ),
    ),
    h('p', { class: 'note' }, '正答数/実施数．途中でやめた本番風セットは集計に含めない．'),
  );
  const sessions = (await all<Session>('sessions')).filter((s) => s.mode === 'mock').sort((a, b) => b.at - a.at).slice(0, 5);
  if (sessions.length) {
    const atts = await all<Attempt>('attempts');
    body.append(
      h('h3', {}, '本番風セット（直近5回）'),
      h(
        'table',
        {},
        ...sessions.map((s) => {
          const mine = atts.filter((a) => a.sessionId === s.id);
          return h(
            'tr',
            {},
            h('td', {}, new Date(s.at).toLocaleString('ja-JP')),
            h('td', {}, s.completed ? '完了' : '途中でやめた'),
            h('td', { class: 'num' }, `${mine.filter((a) => a.result === 'correct').length}/${s.keys.length}`),
          );
        }),
      ),
    );
  }
}

async function prints(body: HTMLElement): Promise<void> {
  const attempts = usable(await all<Attempt>('attempts'), await all<Session>('sessions'));
  const st = stats(SKILLS, attempts);
  // 初期選択：優先度の高い3技能＋点図形
  const top = new Set([...st].filter((s) => !s.skill.paperOnly).sort((a, b) => b.priority - a.priority).slice(0, 3).map((s) => s.skill.id));
  top.add('dots');
  const boxes = availableSkills(SKILLS, hasImage).map((s) => {
    const cb = h('input', { type: 'checkbox', value: s.id, checked: top.has(s.id) });
    return { cb, el: h('label', { class: 'chk' }, cb, `${DOMAIN_NAME[s.domain]}：${s.name}`) };
  });
  const count = h('select', {}, ...[4, 6, 8, 10].map((n) => h('option', { value: n, selected: n === 6 }, `${n}問`)));
  const create = async () => {
    const chosen = boxes.filter((b) => b.cb.checked).map((b) => SKILL_BY_ID[b.cb.value]);
    if (!chosen.length) return alert('技能を1つ以上選んでください');
    const keys = planPrint(chosen, attempts, Number(count.value), newSeed());
    const set: PrintSet = { id: await nextPrintId(), at: Date.now(), keys, entered: false };
    await put('prints', set);
    go(`#print/${set.id}`);
  };
  const list = (await all<PrintSet>('prints')).sort((a, b) => b.id - a.id);
  body.append(
    h('div', { class: 'card' }, h('b', {}, '新しいプリントを作る'), h('div', {}, ...boxes.map((b) => b.el)), h('div', { class: 'row' }, count, h('button', { class: 'btn primary', onclick: create }, '作成して印刷画面へ'))),
    h('p', { class: 'note' }, '初期選択は「次に練習する候補」の3技能と点図形．難易度は技能ごとの記録から自動で決まる．'),
    h(
      'table',
      {},
      h('tr', {}, h('th', {}, 'No.'), h('th', {}, '作成日'), h('th', { class: 'num' }, '問題数'), h('th', {}, '結果'), h('th', {}, '')),
      ...list.map((p) =>
        h(
          'tr',
          {},
          h('td', {}, String(p.id)),
          h('td', {}, new Date(p.at).toLocaleDateString('ja-JP')),
          h('td', { class: 'num' }, String(p.keys.length)),
          h('td', {}, p.entered ? '入力済み' : '未入力'),
          h(
            'td',
            {},
            h('button', { class: 'btn', onclick: () => go(`#print/${p.id}`) }, '印刷'),
            ' ',
            h('button', { class: 'btn', onclick: () => go(`#parent/enter/${p.id}`) }, '結果入力'),
          ),
        ),
      ),
    ),
  );
}

const TAGS = ['聞き漏らし', '印の付け方の誤り'];

async function enter(body: HTMLElement, id?: number): Promise<void> {
  const list = (await all<PrintSet>('prints')).sort((a, b) => b.id - a.id);
  const set = list.find((p) => p.id === id) ?? list.find((p) => !p.entered) ?? list[0];
  if (!set) return void body.append(h('p', {}, 'まだプリントがありません．「プリント」で作成してください．'));
  const settings = await getSettings();
  setRate(settings.rate);
  await waitVoices();
  const attempts = await all<Attempt>('attempts');
  const prevKeys = new Set(attempts.filter((a) => a.sessionId !== `print-${set.id}`).map((a) => a.key));
  const saved = new Map(attempts.filter((a) => a.sessionId === `print-${set.id}`).map((a) => [a.key, a]));
  const probs = set.keys.map(problemFromKey);
  const state = probs.map((p) => ({ result: saved.get(p.key)?.result as Result | undefined, tags: new Set(saved.get(p.key)?.tags ?? []) }));

  const pick = h('select', { onchange: (e: Event) => go(`#parent/enter/${(e.target as HTMLSelectElement).value}`) }, ...list.map((p) => h('option', { value: p.id, selected: p.id === set.id }, `プリント No.${p.id}${p.entered ? '（入力済み）' : ''}`)));
  const rows = h('div');
  const msg = h('span', { class: 'note' });
  const renderRows = () => {
    rows.replaceChildren(
      ...probs.map((p, i) => {
        const s = state[i];
        const b = (r: Result, label: string) =>
          h('button', { class: `btn ${s.result === r ? 'sel' : ''}`, onclick: () => ((s.result = r), renderRows()) }, label);
        return h(
          'div',
          { class: 'card' },
          h('div', { class: 'row' }, h('b', {}, `${i + 1}．`), h('button', { class: 'btn', onclick: () => speak(p.speech, () => {}) }, '🔈 読み上げ'), h('span', {}, p.speech)),
          h('div', { class: 'note' }, `正答：${answerText(p)}　／　${SKILL_BY_ID[p.skill].name}（${LEVEL_NAME[p.level]}）`),
          h(
            'div',
            { class: 'row mark3' },
            b('correct', '○ 正答'),
            b('wrong', '× 誤答'),
            b('none', '− 未解答'),
            ...TAGS.map((t) => {
              const cb = h('input', { type: 'checkbox', checked: s.tags.has(t), onchange: () => (s.tags.has(t) ? s.tags.delete(t) : s.tags.add(t)) });
              return h('label', { class: 'chk' }, cb, t);
            }),
          ),
        );
      }),
    );
  };
  renderRows();
  const save = async () => {
    if (state.some((s) => !s.result)) return void (msg.textContent = 'すべての問題に ○・×・− を付けてください．');
    for (const [i, p] of probs.entries()) {
      const a: Attempt = {
        id: `print-${set.id}:${i}`,
        at: saved.get(p.key)?.at ?? Date.now(),
        key: p.key,
        skill: p.skill,
        domain: SKILL_BY_ID[p.skill].domain,
        level: p.level,
        mode: 'paper',
        firstTime: !prevKeys.has(p.key),
        result: state[i].result!,
        tags: [...state[i].tags],
        sessionId: `print-${set.id}`,
      };
      await put('attempts', a);
    }
    await put('prints', { ...set, entered: true });
    msg.textContent = '保存しました．間違えた技能は次回の練習で優先されます．';
  };
  body.append(
    h('div', { class: 'row' }, pick, h('button', { class: 'btn', onclick: () => go(`#print/${set.id}`) }, '印刷画面')),
    h('p', { class: 'note' }, '紙で出題するときは，各問の「🔈 読み上げ」を番号順に押す．子ども用プリントにはこの画面を見せない．'),
    rows,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, '結果を保存'), msg),
  );
}

async function settingsView(body: HTMLElement): Promise<void> {
  const s = await getSettings();
  const sel = (key: keyof Settings, opts: [number, string][]) =>
    h(
      'select',
      { onchange: async (e: Event) => saveSettings({ ...(await getSettings()), [key]: Number((e.target as HTMLSelectElement).value) }) },
      ...opts.map(([v, l]) => h('option', { value: v, selected: s[key] === v }, l)),
    );
  const voice = await waitVoices();
  const cached = 'caches' in window ? (await caches.keys()).length > 0 : false;
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  const file = h('input', { type: 'file', accept: 'application/json' });
  const msg = h('div', { class: 'note' });

  const doExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `paper-practice-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    msg.textContent = `書き出しました（記録 ${data.attempts.length}件）．ファイルアプリやAirDropで保管してください．`;
  };
  const doImport = async () => {
    const f = file.files?.[0];
    if (!f) return void (msg.textContent = 'ファイルを選んでください．');
    if (!confirm('この端末の記録をすべて，選んだファイルの内容に置き換えます．よろしいですか？')) return;
    try {
      await importAll(JSON.parse(await f.text()));
      msg.textContent = '読み込みました．';
    } catch (e) {
      msg.textContent = `読み込めませんでした：${(e as Error).message}`;
    }
  };

  body.append(
    h(
      'div',
      { class: 'card' },
      h('b', {}, '本番風セット'),
      h('div', { class: 'row' }, '読み上げ回数', sel('mockReplays', [[1, '1回'], [2, '2回'], [0, '制限なし']]), '問題数', sel('mockSize', [[6, '6問'], [8, '8問'], [10, '10問']])),
      h('div', { class: 'note' }, '学校の筆記の作法（読み上げ回数など）が分かったら合わせる．'),
    ),
    h('div', { class: 'card' }, h('b', {}, '練習'), h('div', { class: 'row' }, '1回の問題数', sel('practiceSize', [[5, '5問'], [6, '6問'], [7, '7問'], [8, '8問']]))),
    h(
      'div',
      { class: 'card' },
      h('b', {}, '読み上げ'),
      h(
        'div',
        { class: 'row' },
        '速さ',
        sel('rate', [[0.8, 'ゆっくり'], [0.9, 'ふつう'], [1, 'はやめ']]),
        h('button', { class: 'btn', onclick: async () => (setRate((await getSettings()).rate), speak('りんごと おなじ かずの ものに まるを つけましょう．', () => {})) }, '試しに読む'),
      ),
      h('div', { class: 'note' }, voice ? '日本語の音声が使えます．' : '日本語の音声が見つかりません．iPadの設定 → アクセシビリティ → 読み上げコンテンツ → 声 で日本語を追加してください．'),
    ),
    h(
      'div',
      { class: 'card' },
      h('b', {}, 'オフライン・保存'),
      h('div', {}, `オフライン用の保存：${cached ? '済み' : '未（ホーム画面に追加したアプリで一度開くと保存されます）'}`),
      h('div', {}, `記録の自動削除の防止：${persisted ? '有効' : '未設定'}`),
      !persisted &&
        h('button', { class: 'btn', onclick: async () => (await navigator.storage?.persist?.(), settingsView((body.replaceChildren(), body))) }, '自動削除を防ぐよう依頼する'),
    ),
    h(
      'div',
      { class: 'card' },
      h('b', {}, '記録の書き出し・読み込み'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: doExport }, '書き出す（JSON）')),
      h('div', { class: 'row' }, file, h('button', { class: 'btn', onclick: doImport }, '読み込む（置き換え）')),
      msg,
      h('div', { class: 'note' }, '学習記録はこの端末の中だけに保存され，外部には送信しません．'),
    ),
    h('p', { class: 'note' }, h('a', { href: './samples.html' }, 'サンプル問題と絵カードの確認ページ')),
  );
}
