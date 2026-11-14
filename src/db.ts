// 端末内保存（IndexedDB）．学習記録は外部に送信しない．
import type { Domain, Level } from './types';

export type Mode = 'practice' | 'mock' | 'paper';
export type Result = 'correct' | 'wrong' | 'none';

export interface Attempt {
  /** セッションID＋問題番号．同じ問題を二重に保存しない */
  id: string;
  at: number;
  key: string;
  skill: string;
  domain: Domain;
  level: Level;
  mode: Mode;
  /** 同じ key を以前に解いたことがなければ true（初見） */
  firstTime: boolean;
  result: Result;
  tags?: string[];
  sessionId: string;
}

export interface Session {
  id: string;
  at: number;
  mode: Mode;
  keys: string[];
  /** 最後まで終えたか．途中でやめた本番風セットは集計で区別する */
  completed: boolean;
}

export interface PrintSet {
  id: number;
  at: number;
  keys: string[];
  entered: boolean;
}

export interface Settings {
  mockReplays: number; // 本番風の読み上げ回数．0 は無制限
  mockSize: number;
  practiceSize: number;
  rate: number; // 読み上げの速さ
}

export const DEFAULT_SETTINGS: Settings = { mockReplays: 1, mockSize: 8, practiceSize: 6, rate: 0.9 };

const STORES = ['attempts', 'sessions', 'prints', 'kv'] as const;
type Store = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('paper-practice', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('attempts', { keyPath: 'id' });
        db.createObjectStore('sessions', { keyPath: 'id' });
        db.createObjectStore('prints', { keyPath: 'id' });
        db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req ? req.result : (undefined as T));
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const all = <T>(store: Store) => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
export const put = (store: Exclude<Store, 'kv'>, value: unknown) => tx(store, 'readwrite', (s) => s.put(value));

export async function getSettings(): Promise<Settings> {
  const v = await tx<Settings | undefined>('kv', 'readonly', (s) => s.get('settings') as IDBRequest<Settings | undefined>);
  return { ...DEFAULT_SETTINGS, ...(v ?? {}) };
}
export const saveSettings = (v: Settings) => tx('kv', 'readwrite', (s) => s.put(v, 'settings'));

export async function nextPrintId(): Promise<number> {
  const ps = await all<PrintSet>('prints');
  return ps.reduce((m, p) => Math.max(m, p.id), 0) + 1;
}

// ---- 書き出し・読み込み ----

export interface Backup {
  app: 'paper-practice';
  version: 1;
  exportedAt: string;
  attempts: Attempt[];
  sessions: Session[];
  prints: PrintSet[];
  settings: Settings;
}

export async function exportAll(): Promise<Backup> {
  return {
    app: 'paper-practice',
    version: 1,
    exportedAt: new Date().toISOString(),
    attempts: await all<Attempt>('attempts'),
    sessions: await all<Session>('sessions'),
    prints: await all<PrintSet>('prints'),
    settings: await getSettings(),
  };
}

/** 端末内の記録をすべて置き換える */
export async function importAll(b: Backup): Promise<void> {
  if (b.app !== 'paper-practice' || b.version !== 1) throw new Error('このアプリの書き出しファイルではありません');
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([...STORES], 'readwrite');
    for (const s of STORES) t.objectStore(s).clear();
    b.attempts.forEach((x) => t.objectStore('attempts').put(x));
    b.sessions.forEach((x) => t.objectStore('sessions').put(x));
    b.prints.forEach((x) => t.objectStore('prints').put(x));
    t.objectStore('kv').put({ ...DEFAULT_SETTINGS, ...b.settings }, 'settings');
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
