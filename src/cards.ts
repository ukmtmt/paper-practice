// 絵カード集．IDは assets/cards/{id}.png のファイル名と一致させる（依頼文 v1-0 §3・§4）．

export type Category = 'kudamono' | 'yasai' | 'doubutsu' | 'norimono' | 'dougu' | 'mushi' | 'kazoe';

export interface Card {
  id: string;
  /** 子どもに求める呼び名（ひらがな） */
  name: string;
  category: Category;
  /** 別名で読むと頭の音が変わる，または拗音で始まる．語頭音の問題に使わない． */
  noInitial?: boolean;
  /** くだもの・やさいの区別があいまい．仲間分けの「くだもの対やさい」に使わない． */
  ambiguousProduce?: boolean;
}

export const CATEGORY_NAME: Record<Category, string> = {
  kudamono: 'くだもの',
  yasai: 'やさい',
  doubutsu: 'どうぶつ',
  norimono: 'のりもの',
  dougu: 'みのまわりの もの',
  mushi: 'むし',
  kazoe: 'かぞえる',
};

/** 仲間分けで「遠い」とみなす大分類 */
export const SUPER_CATEGORY: Record<Category, string> = {
  kudamono: 'tabemono',
  yasai: 'tabemono',
  doubutsu: 'ikimono',
  mushi: 'ikimono',
  norimono: 'norimono',
  dougu: 'dougu',
  kazoe: 'kazoe',
};

const c = (id: string, name: string, category: Category, extra: Partial<Card> = {}): Card => ({
  id,
  name,
  category,
  ...extra,
});

export const CARDS: Card[] = [
  c('ringo', 'りんご', 'kudamono'),
  c('mikan', 'みかん', 'kudamono'),
  c('ichigo', 'いちご', 'kudamono', { ambiguousProduce: true }),
  c('banana', 'ばなな', 'kudamono'),
  c('budou', 'ぶどう', 'kudamono'),
  c('suika', 'すいか', 'kudamono', { ambiguousProduce: true }),
  c('momo', 'もも', 'kudamono'),
  c('meron', 'めろん', 'kudamono', { ambiguousProduce: true }),
  c('tomato', 'とまと', 'yasai', { ambiguousProduce: true }),
  c('ninjin', 'にんじん', 'yasai'),
  c('daikon', 'だいこん', 'yasai'),
  c('kabocha', 'かぼちゃ', 'yasai'),
  c('nasu', 'なす', 'yasai'),
  c('tamanegi', 'たまねぎ', 'yasai'),
  c('kyabetsu', 'きゃべつ', 'yasai', { noInitial: true }),
  c('inu', 'いぬ', 'doubutsu'),
  c('neko', 'ねこ', 'doubutsu'),
  c('usagi', 'うさぎ', 'doubutsu'),
  c('zou', 'ぞう', 'doubutsu'),
  c('kirin', 'きりん', 'doubutsu'),
  c('saru', 'さる', 'doubutsu'),
  c('kuma', 'くま', 'doubutsu'),
  c('buta', 'ぶた', 'doubutsu'),
  c('kame', 'かめ', 'doubutsu'),
  c('kuruma', 'くるま', 'norimono', { noInitial: true }),
  c('densha', 'でんしゃ', 'norimono'),
  c('basu', 'ばす', 'norimono'),
  c('hikouki', 'ひこうき', 'norimono'),
  c('fune', 'ふね', 'norimono'),
  c('jitensha', 'じてんしゃ', 'norimono'),
  c('torakku', 'とらっく', 'norimono'),
  c('shoubousha', 'しょうぼうしゃ', 'norimono', { noInitial: true }),
  c('kasa', 'かさ', 'dougu'),
  c('hasami', 'はさみ', 'dougu'),
  c('enpitsu', 'えんぴつ', 'dougu'),
  c('kutsu', 'くつ', 'dougu'),
  c('boushi', 'ぼうし', 'dougu'),
  c('koppu', 'こっぷ', 'dougu', { noInitial: true }),
  c('tokei', 'とけい', 'dougu'),
  c('kaban', 'かばん', 'dougu', { noInitial: true }),
  c('isu', 'いす', 'dougu'),
  c('tsukue', 'つくえ', 'dougu'),
  c('chou', 'ちょう', 'mushi', { noInitial: true }),
  c('tonbo', 'とんぼ', 'mushi'),
  c('semi', 'せみ', 'mushi'),
  c('ari', 'あり', 'mushi'),
  c('kabutomushi', 'かぶとむし', 'mushi'),
  c('tentoumushi', 'てんとうむし', 'mushi'),
  c('hoshi', 'ほし', 'kazoe'),
  c('hana', 'はな', 'kazoe'),
];

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((x) => [x.id, x]));

/** 反対語の組．group が同じ組どうしは意味が近いので，互いの誤答選択肢に使わない． */
export interface OppositePair {
  a: { id: string; word: string };
  b: { id: string; word: string };
  group: 'size' | 'amount' | 'state' | 'speed' | 'weight' | 'temp';
}

export const OPPOSITES: OppositePair[] = [
  { a: { id: 'hantai_ookii', word: 'おおきい' }, b: { id: 'hantai_chiisai', word: 'ちいさい' }, group: 'size' },
  { a: { id: 'hantai_nagai', word: 'ながい' }, b: { id: 'hantai_mijikai', word: 'みじかい' }, group: 'size' },
  { a: { id: 'hantai_takai', word: 'たかい' }, b: { id: 'hantai_hikui', word: 'ひくい' }, group: 'size' },
  { a: { id: 'hantai_futoi', word: 'ふとい' }, b: { id: 'hantai_hosoi', word: 'ほそい' }, group: 'size' },
  { a: { id: 'hantai_ooi', word: 'おおい' }, b: { id: 'hantai_sukunai', word: 'すくない' }, group: 'amount' },
  { a: { id: 'hantai_atarashii', word: 'あたらしい' }, b: { id: 'hantai_furui', word: 'ふるい' }, group: 'state' },
  { a: { id: 'hantai_aiteiru', word: 'あいている' }, b: { id: 'hantai_shimatteiru', word: 'しまっている' }, group: 'state' },
  { a: { id: 'hantai_hayai', word: 'はやい' }, b: { id: 'hantai_osoi', word: 'おそい' }, group: 'speed' },
  { a: { id: 'hantai_omoi', word: 'おもい' }, b: { id: 'hantai_karui', word: 'かるい' }, group: 'weight' },
  { a: { id: 'hantai_atsui', word: 'あつい' }, b: { id: 'hantai_tsumetai', word: 'つめたい' }, group: 'temp' },
];

/** 画像IDから表示名（画像がないときの仮表示に使う） */
export function labelOf(id: string): string {
  if (CARD_BY_ID[id]) return CARD_BY_ID[id].name;
  for (const p of OPPOSITES) {
    if (p.a.id === id) return p.a.word;
    if (p.b.id === id) return p.b.word;
  }
  return id;
}

/** 語頭の1文字（拗音・促音で始まる語は noInitial で除外済み） */
export function initialOf(card: Card): string {
  return card.name[0];
}

/** 濁点・半濁点を外した清音（ぶ→ふ）．語頭音の誤答選択肢で紛らわしさを避けるのに使う． */
export function seion(ch: string): string {
  const n = ch.normalize('NFD').replace(/[゙゚]/g, '');
  return n.normalize('NFC');
}
