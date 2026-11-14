// ホーム画面用アイコン（白地に太い黒の○）をPNGで作る．依存なし．
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

function icon(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const cx = size / 2, cy = size / 2, R = size * 0.34, w = size * 0.07;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // 4×4 のスーパーサンプリングで縁をなめらかに
      let ink = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const d = Math.hypot(x + (sx + 0.5) / 4 - cx, y + (sy + 0.5) / 4 - cy);
        if (Math.abs(d - R) < w) ink++;
      }
      const v = Math.round(255 * (1 - ink / 16));
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = raw[o + 1] = raw[o + 2] = v;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const s of [180, 192, 512]) writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), icon(s));
