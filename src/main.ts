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
  if (name === 'parent') return gate(() => void parentView(a || 'records', b));
  if (name === 'print') return gate(() => void printView(Number(a)));
  lockParent();
  await childHome(() => go('#parent'));
}

setRouter(() => void route());
window.addEventListener('hashchange', () => void route());
void route();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
