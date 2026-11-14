// 子ども用：ホーム → 練習・本番風 → 問題 → おしまい
import { go, h, longPress, mount, uid } from '../dom';
import { all, getSettings, put, type Attempt, type Mode, type Result, type Session } from '../db';
import { planSession, usable } from '../select';
import { SKILLS, SKILL_BY_ID, problemFromKey } from '../skills';
import { svgOf } from '../render';
import { newSeed } from '../rng';
import { setRate, speak, stopSpeech, waitVoices } from '../speech';
import type { Problem } from '../types';

const MARK =
  '<svg class="mark" viewBox="0 0 100 100" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="46" ry="44" fill="none" stroke="#000" stroke-width="4" vector-effect="non-scaling-stroke" style="stroke-width:6px"/></svg>';

export async function childHome(openParent: () => void): Promise<void> {
  const adult = h('button', { class: 'adult', 'aria-label': 'おとなの かた（ながおし）' }, 'おとなの かた（ながおし）', h('span', { class: 'bar' }));
  longPress(adult, 1200, openParent);
  const voiceOk = await waitVoices();
  mount(
    h(
      'div',
      { class: 'home' },
      h('h1', {}, 'ぺーぱー れんしゅう'),
      h('button', { class: 'big primary', onclick: () => startPlay('practice') }, 'きょうの れんしゅう'),
      h('button', { class: 'big', onclick: () => startPlay('mock') }, 'ほんばん みたいに やる'),
      !voiceOk &&
        h('p', { class: 'warn' }, 'この たんまつでは にほんごの よみあげが つかえません．おとなの かたが もんだいを よんで ください．（設定 → 一般 → アクセシビリティ → 読み上げコンテンツ → 声 で日本語の声を追加できます）'),
      adult,
    ),
  );
}

async function startPlay(mode: Mode): Promise<void> {
  const settings = await getSettings();
  setRate(settings.rate);
  const attempts = await all<Attempt>('attempts');
  const sessions = await all<Session>('sessions');
  const n = mode === 'mock' ? settings.mockSize : settings.practiceSize;
  const keys = planSession(SKILLS, usable(attempts, sessions), n, newSeed());
  const session: Session = { id: uid(), at: Date.now(), mode, keys, completed: false };
  await put('sessions', session);
  const seen = new Set(attempts.map((a) => a.key));
  new Player(session, keys.map(problemFromKey), seen, mode === 'mock' ? settings.mockReplays : 0).show();
}

type Phase = 'ready' | 'listening' | 'answering' | 'feedback';

class Player {
  private i = 0;
  private phase: Phase = 'ready';
  private selected: number | null = null;
  private plays = 0;
  private results: Result[] = [];
  private root!: HTMLElement;
  private onVis = () => {
    if (document.hidden && this.phase === 'listening') {
      // 画面を離れたら読み上げを止め，戻ったら聞き直せるようにする（回数には数えない）
      stopSpeech();
      this.plays = Math.max(0, this.plays - 1);
      this.phase = 'ready';
      this.render();
    }
  };

  constructor(
    private session: Session,
    private problems: Problem[],
    private seen: Set<string>,
    /** 本番風の読み上げ回数の上限．0 は無制限（練習） */
    private maxPlays: number,
  ) {
    document.addEventListener('visibilitychange', this.onVis);
  }

  private get p(): Problem {
    return this.problems[this.i];
  }
  private get mock(): boolean {
    return this.session.mode === 'mock';
  }

  show(): void {
    this.root = h('div', { class: 'play' });
    mount(this.root);
    this.render();
  }

  private listen(): void {
    if (this.maxPlays && this.plays >= this.maxPlays) return;
    this.plays++;
    this.phase = 'listening';
    this.render();
    speak(this.p.speech, () => {
      if (this.phase !== 'listening') return;
      this.phase = 'answering';
      this.render();
    });
  }

  private async confirm(): Promise<void> {
    if (this.phase !== 'answering') return;
    this.phase = 'feedback'; // 連打で二重に保存しない
    const p = this.p;
    const result: Result = this.selected === null ? 'none' : this.selected === p.answer ? 'correct' : 'wrong';
    this.results[this.i] = result;
    const a: Attempt = {
      id: `${this.session.id}:${this.i}`,
      at: Date.now(),
      key: p.key,
      skill: p.skill,
      domain: SKILL_BY_ID[p.skill].domain,
      level: p.level,
      mode: this.session.mode,
      firstTime: !this.seen.has(p.key),
      result,
      sessionId: this.session.id,
    };
    await put('attempts', a);
    if (this.mock) return this.next();
    this.render();
    speak(result === 'correct' ? `せいかい．${p.explain}` : `こたえは これ．${p.explain}`, () => {});
  }

  private async next(): Promise<void> {
    stopSpeech();
    if (this.i + 1 >= this.problems.length) return this.finish(true);
    this.i++;
    this.selected = null;
    this.plays = 0;
    this.listen(); // 「つぎへ」のタップの中で読み上げを始める（iOSの制約）
  }

  private async finish(completed: boolean): Promise<void> {
    stopSpeech();
    document.removeEventListener('visibilitychange', this.onVis);
    this.session.completed = completed;
    await put('sessions', this.session);
    if (!completed) return go('');
    this.renderDone();
  }

  private quit(): void {
    const box = h(
      'div',
      { class: 'overlay' },
      h('div', {}, 'おわりに する？'),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'go ghost', onclick: () => box.remove() }, 'つづける'),
        h('button', { class: 'go', onclick: () => this.finish(false) }, 'おわる'),
      ),
    );
    this.root.append(box);
  }

  private render(): void {
    const p = this.p;
    const fb = this.phase === 'feedback';
    const canReplay = !fb && this.phase !== 'listening' && (!this.maxPlays || this.plays < this.maxPlays);
    const cols = p.cols ?? p.choices.length;
    const rows = Math.ceil(p.choices.length / cols);

    const choices = h('div', {
      class: `choices ${p.choices.length > 9 ? 'dense' : ''}`,
      style: `grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, minmax(0, 1fr));`,
    });
    p.choices.forEach((c, k) => {
      const b = h('button', {
        class: `choice ${fb && !this.mock && k === p.answer ? 'answer' : ''}`,
        'aria-label': `${k + 1}ばんめ`,
        disabled: this.phase !== 'answering',
        html: svgOf(c) + (this.selected === k ? MARK : ''),
        onclick: () => {
          if (this.phase !== 'answering') return;
          this.selected = this.selected === k ? null : k;
          this.render();
        },
      });
      choices.append(b);
    });

    const stim = p.stimulus
      ? h('div', { class: 'stim' }, h('span', { class: 'label' }, 'みほん'), h('div', { class: 'pic', html: svgOf(p.stimulus) }))
      : null;

    let footer: HTMLElement;
    if (this.phase === 'ready') {
      footer = h('footer', {}, h('button', { class: 'go', onclick: () => this.listen() }, this.i === 0 && this.plays === 0 ? 'はじめる' : 'もういちど きく'));
    } else if (fb) {
      const ok = this.results[this.i] === 'correct';
      footer = h(
        'footer',
        {},
        h('div', { class: 'feedback' }, h('b', {}, ok ? '⭕ せいかい！' : 'こたえは ふとい わくの もの'), p.explain),
        h('button', { class: 'go', onclick: () => this.next() }, this.i + 1 >= this.problems.length ? 'おしまい' : 'つぎへ'),
      );
    } else {
      footer = h(
        'footer',
        {},
        h('button', { class: 'go', disabled: this.phase !== 'answering', onclick: () => this.confirm() }, this.selected === null ? 'わからない' : 'これに する'),
      );
    }

    this.root.className = `play ph-${this.phase}`;
    this.root.replaceChildren(
      h(
        'header',
        {},
        h('button', {
          class: `icon ${this.phase === 'listening' ? 'listening' : ''}`,
          'aria-label': 'もういちど きく',
          disabled: !canReplay,
          onclick: () => canReplay && this.listen(),
        }, '🔈'),
        h('div', { class: 'caption' }, this.mock ? '' : p.caption),
        h('div', { class: 'progress' }, `${this.i + 1} / ${this.problems.length}`),
        h('button', { class: 'icon small', 'aria-label': 'おわる', onclick: () => this.quit() }, '✕'),
      ),
      h('div', { class: 'stage' }, stim, choices),
      footer,
    );
  }

  private renderDone(): void {
    const ok = this.results.filter((r) => r === 'correct').length;
    const items = this.mock
      ? this.problems.map((p, k) =>
          h(
            'div',
            { class: 'item' },
            h('div', { class: 'res' }, this.results[k] === 'correct' ? '⭕' : this.results[k] === 'none' ? '−' : '✕'),
            h(
              'div',
              { class: 'mini' },
              h('div', {}, `${k + 1}．${p.caption}`),
              h('div', {
                style: `display:grid;gap:6px;grid-template-columns:repeat(${Math.min(p.cols ?? p.choices.length, 8)},1fr)`,
                html: p.choices
                  .map((c, j) => `<div style="border:${j === p.answer ? '4px solid #000' : '1px solid #ccc'};border-radius:6px">${svgOf(c)}</div>`)
                  .join(''),
              }),
              h('div', { class: 'note' }, p.explain),
            ),
          ),
        )
      : [];
    mount(
      h(
        'div',
        { class: 'done' },
        h('h1', {}, this.mock ? `おしまい！ ${ok} / ${this.problems.length}` : `よく がんばったね！ ⭕ ${ok}こ`),
        h('div', { class: 'review' }, ...items),
        h('button', { class: 'go', onclick: () => go('') }, 'もどる'),
      ),
    );
  }
}
