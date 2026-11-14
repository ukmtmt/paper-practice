import './style.css';
import { childHome } from './ui/child';
import { gate, lockParent, parentView } from './ui/parent';
import { printView } from './ui/print';
import { stopSpeech } from './speech';
import { go, setRouter } from './dom';

async function route(): Promise<void> {
  stopSpeech();
  document.body.className = '';
  const [name, a, b] = location.hash.replace(/^#/, '').split('/');
  if (name === 'parent') return gate(() => void parentView(a || 'focus', b));
  if (name === 'print') return gate(() => void printView(Number(a)));
  lockParent();
  await childHome(() => go('#parent'));
}

setRouter(() => void route());
window.addEventListener('hashchange', () => void route());
void route();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // 新しい版が入ったら，練習中でなければ（ホーム画面にいるとき）読み込み直す
  let updated = false;
  const reloadIfIdle = () => {
    if (updated && location.hash.replace(/^#/, '') === '') location.reload();
  };
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // 初回のインストールでは読み込み直さない
    updated = true;
    reloadIfIdle();
  });
  window.addEventListener('hashchange', reloadIfIdle);
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
