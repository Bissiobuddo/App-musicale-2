import { setNotation } from './theory.js';
import { $, $$, store } from './ui.js';
import home from './views/home.js';
import chords from './views/chords.js';
import triads from './views/triads.js';
import intervals from './views/intervals.js';
import scales from './views/scales.js';
import inversions from './views/inversions.js';
import progressions from './views/progressions.js';
import circle from './views/circle.js';
import tuner from './views/tuner.js';
import metronome from './views/metronome.js';

export const VIEWS = [chords, triads, intervals, scales, inversions, progressions, circle, tuner, metronome];
const routes = Object.fromEntries([home, ...VIEWS].map((v) => [v.id, v]));

const settings = store('settings', { notation: 'it' });
setNotation(settings.notation);

const sidebar = $('#sidebar');
sidebar.innerHTML = `<a href="#/" data-id="">🏠 <span>Home</span></a>` +
  VIEWS.map((v) => `<a href="#/${v.id}" data-id="${v.id}">${v.icon} <span>${v.title}</span></a>`).join('') +
  `<div class="nav-foot">Installa l’app: menu del browser → “Aggiungi a schermata Home” / “Installa app”.</div>`;

let cleanup = null;
function render() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  const view = routes[id] || home;
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  // contenitore nuovo ad ogni vista: i listener della vista precedente vengono scartati
  const host = document.createElement('div');
  host.className = 'view-' + (view.id || 'home');
  $('#view').replaceChildren(host);
  document.title = view.id ? `${view.title} · Armonia` : 'Armonia';
  cleanup = view.render(host, { views: VIEWS });
  $$('a', sidebar).forEach((a) => a.classList.toggle('active', a.dataset.id === view.id));
  document.body.classList.remove('nav-open');
  window.scrollTo(0, 0);
}

// Notazione Do Re Mi / C D E
const nt = $('#notationToggle');
const syncNt = () => $$('button', nt).forEach((b) => b.classList.toggle('on', b.dataset.v === settings.notation));
nt.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  settings.notation = b.dataset.v;
  setNotation(b.dataset.v);
  syncNt();
  render();
});
syncNt();

$('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
window.addEventListener('hashchange', render);

// Gestione generica dei controlli segmentati
document.addEventListener('click', (e) => {
  const b = e.target.closest('.seg[data-seg] button');
  if (!b) return;
  const seg = b.parentElement;
  $$('button', seg).forEach((x) => x.classList.toggle('on', x === b));
  seg.dispatchEvent(new CustomEvent('segchange', { bubbles: true, detail: { name: seg.dataset.seg, value: b.dataset.v } }));
});

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
