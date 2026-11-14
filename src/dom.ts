type Child = Node | string | null | undefined | false;

/** 小さな要素生成ヘルパー．on〜 は イベント，それ以外は属性 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') e.innerHTML = String(v);
    else if (k === 'style' && typeof v === 'string') e.setAttribute('style', v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export function mount(...nodes: Node[]): void {
  const app = document.getElementById('app')!;
  app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
}

export const uid = (): string =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/** 長押し（ms）で発火するボタン */
export function longPress(btn: HTMLElement, ms: number, fire: () => void): void {
  let t: number | undefined;
  const start = (e: Event) => {
    e.preventDefault();
    btn.classList.add('pressing');
    t = window.setTimeout(() => {
      btn.classList.remove('pressing');
      fire();
    }, ms);
  };
  const cancel = () => {
    btn.classList.remove('pressing');
    clearTimeout(t);
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

let router: () => void = () => {};
export const setRouter = (fn: () => void) => (router = fn);

/** 画面遷移．同じハッシュへの遷移でも描き直す */
export function go(hash: string): void {
  const cur = location.hash.replace(/^#/, '');
  const next = hash.replace(/^#/, '');
  if (cur === next) router();
  else location.hash = next;
}
