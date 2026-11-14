// 端末の日本語音声合成で読み上げる．iOSではタップ操作の中から呼ぶ必要がある．

let rate = 0.9;
export const setRate = (r: number) => (rate = r);

function jaVoice(): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').startsWith('ja'));
  return vs.find((v) => v.localService) ?? vs[0];
}

export function speechAvailable(): boolean {
  return 'speechSynthesis' in window && jaVoice() !== undefined;
}

/** 声の一覧は遅れて届くことがあるので，最大 2 秒待つ */
export function waitVoices(): Promise<boolean> {
  if (!('speechSynthesis' in window)) return Promise.resolve(false);
  if (jaVoice()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => resolve(jaVoice() !== undefined);
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 2000);
  });
}

let token = 0;

/**
 * 読み上げて，終わったら onEnd を呼ぶ．
 * 音声が使えない・終了イベントが来ない場合に備え，文の長さから見積もった時間で必ず終える．
 */
export function speak(text: string, onEnd: () => void): void {
  const my = ++token;
  let finished = false;
  const finish = () => {
    if (finished || my !== token) return;
    finished = true;
    onEnd();
  };
  const estimate = 1500 + (text.length * 220) / rate;
  // 読み上げが始まらなければ見積もり時間で終える．始まったら終了イベントを待つ（安全のため見積もりの3倍で打ち切る）
  let timer = setTimeout(finish, estimate);
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = rate;
  const v = jaVoice();
  if (v) u.voice = v;
  u.onstart = () => {
    clearTimeout(timer);
    timer = setTimeout(finish, estimate * 3);
  };
  u.onend = finish;
  u.onerror = finish;
  speechSynthesis.speak(u);
}

export function stopSpeech(): void {
  token++;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
