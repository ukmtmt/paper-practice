// Visual を SVG 文字列に描く．画面とA4プリントで同じ描画を使う．
import type { Visual } from './types';
import { labelOf } from './cards';

// assets/cards/{id}.png（ChatGPTで作った絵）．まだない絵は仮表示にする．
const IMAGES = import.meta.glob('../assets/cards/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;
const urlOf = (id: string): string | undefined => IMAGES[`../assets/cards/${id}.png`];

export const hasImage = (id: string): boolean => urlOf(id) !== undefined;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** 1枚の絵を (x, y) を中心に一辺 s で描く */
function cardAt(id: string, x: number, y: number, s: number): string {
  const url = urlOf(id);
  if (url) return `<image href="${url}" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet"/>`;
  const fs = Math.max(8, s / 5);
  return (
    `<rect x="${x - s / 2 + 2}" y="${y - s / 2 + 2}" width="${s - 4}" height="${s - 4}" rx="${s / 10}" fill="none" stroke="#000" stroke-dasharray="4 3"/>` +
    `<text x="${x}" y="${y + fs / 3}" font-size="${fs}" text-anchor="middle">${esc(labelOf(id))}</text>`
  );
}

/** 描画サイズ（縦横比）．w×h のビューボックスに描く */
export function aspectOf(v: Visual): [number, number] {
  switch (v.kind) {
    case 'scatter':
      return [200, 150];
    case 'pair':
      return [420, 150];
    case 'row':
      return [v.ids.length * 60, 60];
    case 'circles':
      return [120, 120];
    default:
      return [120, 120];
  }
}

export function svgOf(v: Visual, opts: { frame?: boolean } = {}): string {
  const [w, h] = aspectOf(v);
  const frame = opts.frame ?? v.kind !== 'card';
  const body = draw(v, w, h);
  const border = frame ? `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#000" stroke-width="2"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="sans-serif">${border}${body}</svg>`;
}

function draw(v: Visual, w: number, h: number): string {
  switch (v.kind) {
    case 'card':
      return cardAt(v.id, w / 2, h / 2, Math.min(w, h) * 0.9);
    case 'scatter': {
      const s = v.items.length > 8 ? 36 : 42;
      return v.items.map((it) => cardAt(it.id, it.x * w, it.y * h, s)).join('');
    }
    case 'circles': {
      // 最大10個を 4列で並べる
      const cols = v.n <= 4 ? v.n : v.n <= 6 ? 3 : 4;
      const rows = Math.ceil(v.n / cols);
      const r = 11;
      const gx = w / (cols + 1);
      const gy = h / (rows + 1);
      let out = '';
      for (let i = 0; i < v.n; i++) {
        const cx = gx * ((i % cols) + 1);
        const cy = gy * (Math.floor(i / cols) + 1);
        out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-width="2.5"/>`;
      }
      return out;
    }
    case 'pair': {
      const sub = (x: Visual, dx: number) =>
        `<g transform="translate(${dx},0)"><rect x="1" y="1" width="198" height="148" fill="none" stroke="#000" stroke-width="2"/>${draw(x, 200, 150)}</g>`;
      return `<rect width="${w}" height="${h}" fill="#fff"/>` + sub(v.left, 0) + sub(v.right, 220);
    }
    case 'row':
      return v.ids
        .map((id, i) =>
          id
            ? cardAt(id, i * 60 + 30, 30, 52)
            : `<rect x="${i * 60 + 6}" y="6" width="48" height="48" fill="none" stroke="#000" stroke-width="2.5"/>`,
        )
        .join('');
    case 'cells': {
      const m = 10;
      const c = (Math.min(w, h) - 2 * m) / v.size;
      let out = '';
      for (let r = 0; r < v.size; r++)
        for (let k = 0; k < v.size; k++) {
          const on = v.cells.some((x) => x[0] === r && x[1] === k);
          out += `<rect x="${m + k * c}" y="${m + r * c}" width="${c}" height="${c}" fill="${on ? '#000' : '#fff'}" stroke="#000" stroke-width="1.5"/>`;
        }
      return out;
    }
    case 'dots': {
      const m = 14;
      const g = (Math.min(w, h) - 2 * m) / (v.size - 1);
      const p = ([r, c]: readonly [number, number]) => [m + c * g, m + r * g];
      let out = v.segments
        .map(([a, b]) => {
          const [x1, y1] = p(a);
          const [x2, y2] = p(b);
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="3" stroke-linecap="round"/>`;
        })
        .join('');
      for (let r = 0; r < v.size; r++) for (let c = 0; c < v.size; c++) {
        const [x, y] = p([r, c]);
        out += `<circle cx="${x}" cy="${y}" r="3.5" fill="#000"/>`;
      }
      return out;
    }
  }
}
