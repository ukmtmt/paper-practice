import { defineConfig, type Plugin } from 'vite';
import { resolve, relative, join } from 'node:path';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** ビルド後の全ファイルを事前キャッシュする Service Worker を書き出す（オフライン起動用） */
function serviceWorker(): Plugin {
  return {
    name: 'precache-sw',
    apply: 'build',
    writeBundle(opts) {
      const dir = opts.dir!;
      const files: string[] = [];
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (f !== 'sw.js' && !f.endsWith('.map')) files.push(relative(dir, p).split('\\').join('/'));
        }
      };
      walk(dir);
      files.sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(dir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const list = JSON.stringify(['./', ...files.map((f) => `./${f}`)], null, 1);
      writeFileSync(
        join(dir, 'sw.js'),
        `// 自動生成（vite.config.ts）
const CACHE = 'pp-${version}';
const FILES = ${list};
self.addEventListener('install', (e) => {
  // HTTPキャッシュを通さずに取得し，古いHTMLを保存しないようにする
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // ページ本体はオンラインなら最新を取り，オフラインのときだけキャッシュを使う（版の食い違いを防ぐ）．
    // GitHub Pages は10分間のHTTPキャッシュを許すので，cache: 'no-cache' で毎回サーバーに確認する
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((r) => (r.ok ? r : Promise.reject(r)))
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
`,
      );
    },
  };
}

export default defineConfig({
  // GitHub Pages のサブパスでも動くよう相対パスで出力する
  base: './',
  plugins: [serviceWorker()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        samples: resolve(__dirname, 'samples.html'),
      },
    },
  },
});
