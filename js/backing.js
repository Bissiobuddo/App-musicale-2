// Base musicale (footer sempre presente): batteria, basso e accompagnamento
// in loop, con stile, tonalità, accordi, BPM, tempo e strumento modificabili.

import { CHORDS, INTERVALS, parseNote, noteName, transpose, pc, chordSymbol } from './theory.js';
import { ac, createGroup, playNote, drum } from './audio.js';
import { $, $$, store, rootOptions, segmented, esc } from './ui.js';
import { closest } from './views/inversions.js';
import { fretVoicings } from './views/chords.js';

// ---------- Accordi relativi alla tonica ----------
const OFF_INT = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
const ROMAN12 = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];
const MINORISH = new Set(['m', 'm7', 'm7b5', 'dim', 'dim7', 'mMaj7', 'm6', 'm9', 'madd9']);
const TYPES = ['maj', 'm', 'dom7', 'maj7', 'm7', 'm7b5', 'dim', 'dim7', 'aug', 'sus2', 'sus4', 'sus47', 'six', 'm6', 'add9', 'dom9', 'maj9', 'm9'];
const C = (o, t) => ({ o, t });
const romanOf = (ch) => {
  const r = ROMAN12[ch.o];
  return (MINORISH.has(ch.t) ? r.toLowerCase() : r) + (ch.t === 'maj' ? '' : ch.t === 'm' ? '' : CHORDS[ch.t].sym.replace(/^m(?!aj)/, ''));
};

// ---------- Stili ----------
// Griglie: un carattere per suddivisione (sub=4 sedicesimi, sub=3 terzine).
// Batteria: X accento, x colpo, g ghost, . pausa.
// Basso: 1 3 5 6 7 8 (ottava) w (nota di passaggio) A (avvicinamento cromatico al prossimo accordo), - prolunga.
// Accompagnamento: X accordo, x accordo breve, D pennata giù, U pennata su, a arpeggio, - prolunga.
const MAJ = (...a) => a.map(([o, t]) => C(o, t));
export const STYLES = {
  pop: {
    name: 'Pop', icon: '🎤', bpm: 100, sub: 4, inst: 'guitar',
    drums: { k: 'x.....x.x.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
    bass: '1-.11-.11-.15-.5', comp: 'D---D-U-..U-D-U-',
    prog: { major: MAJ([0, 'maj'], [7, 'maj'], [9, 'm'], [5, 'maj']), minor: MAJ([0, 'm'], [8, 'maj'], [3, 'maj'], [10, 'maj']) },
  },
  rock: {
    name: 'Rock', icon: '🎸', bpm: 120, sub: 4, inst: 'guitar',
    drums: { k: 'x.....x.x.x.....', s: '....X.......X...', h: 'X.x.X.x.X.x.X.x.' },
    bass: '1.1.1.1.1.1.1.1.', comp: 'D.D.D.D.D.D.D.D.',
    prog: { major: MAJ([0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj']), minor: MAJ([0, 'm'], [8, 'maj'], [10, 'maj'], [0, 'm']) },
  },
  ballad: {
    name: 'Ballata', icon: '🌙', bpm: 72, sub: 4, inst: 'piano',
    drums: { k: 'x.........x.....', s: '........X.......', h: 'g.g.g.g.g.g.g.g.' },
    bass: '1-------5---1---', comp: 'a.a.a.a.a.a.a.a.',
    prog: { major: MAJ([0, 'maj'], [9, 'm'], [5, 'maj'], [7, 'maj']), minor: MAJ([0, 'm'], [5, 'm'], [8, 'maj'], [7, 'maj']) },
  },
  blues: {
    name: 'Blues shuffle', icon: '🎷', bpm: 92, sub: 3, inst: 'piano', color: 'dom7',
    drums: { k: 'x.....x.....', s: '...X.....X..', h: 'x.xx.xx.xx.x' },
    bass: '1.13.35.56.5', comp: '...X.x...X.x',
    prog: {
      major: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((o) => C(o, 'dom7')),
      minor: [[0, 'm7'], [0, 'm7'], [0, 'm7'], [0, 'm7'], [5, 'm7'], [5, 'm7'], [0, 'm7'], [0, 'm7'], [8, 'dom7'], [7, 'dom7'], [0, 'm7'], [7, 'dom7']].map(([o, t]) => C(o, t)),
    },
  },
  jazz: {
    name: 'Jazz swing', icon: '🎺', bpm: 140, sub: 3, inst: 'piano', color: '7',
    drums: { k: 'g.....g.....', h: '...x.....x..', r: 'x..x.xx..x.x' },
    bass: '1..w..w..A..', comp: 'X....x......',
    prog: { major: MAJ([2, 'm7'], [7, 'dom7'], [0, 'maj7'], [0, 'maj7']), minor: MAJ([2, 'm7b5'], [7, 'dom7'], [0, 'm7'], [0, 'm7']) },
  },
  bossa: {
    name: 'Bossa nova', icon: '🌴', bpm: 132, sub: 4, inst: 'guitar', color: '7',
    drums: { k: 'x..xx..xx..xx..x', c: 'x..x..x...x..x..', h: 'g.g.g.g.g.g.g.g.' },
    bass: '1-----5-1-----5-', comp: 'x..x..x...x..x..',
    prog: { major: MAJ([0, 'maj7'], [0, 'maj7'], [2, 'dom7'], [2, 'dom7'], [2, 'm7'], [7, 'dom7'], [0, 'maj7'], [0, 'maj7']), minor: MAJ([0, 'm7'], [5, 'm7'], [7, 'dom7'], [0, 'm7']) },
  },
  reggae: {
    name: 'Reggae', icon: '🌿', bpm: 76, sub: 4, inst: 'organ',
    drums: { k: '........x.......', c: '........x.......', h: 'g.x.g.x.g.x.g.x.' },
    bass: '1-.1..5-..3-1...', comp: '..x...x...x...x.',
    prog: { major: MAJ([0, 'maj'], [5, 'maj'], [7, 'maj'], [5, 'maj']), minor: MAJ([0, 'm'], [5, 'm'], [0, 'm'], [7, 'm']) },
  },
  funk: {
    name: 'Funk', icon: '🕺', bpm: 100, sub: 4, inst: 'epiano', swing: 0.54,
    drums: { k: 'x.....x...x..x..', s: '....X..g.g..X..g', h: 'xgxgxgxgxgxgxgxg' },
    bass: '1..8..1.5.7.8.1.', comp: '..x.x..x..x.x..x',
    prog: { major: MAJ([0, 'dom9'], [0, 'dom9'], [5, 'dom9'], [5, 'dom9']), minor: MAJ([0, 'm7'], [0, 'm7'], [5, 'dom9'], [5, 'dom9']) },
  },
  waltz: {
    name: 'Valzer', icon: '💃', bpm: 150, sub: 4, inst: 'piano', meters: [3],
    p3: { drums: { k: 'x...........', s: '....g...g...', h: 'x...x...x...' }, bass: '1---........', comp: '....x...x...' },
    prog: { major: MAJ([0, 'maj'], [0, 'maj'], [7, 'dom7'], [7, 'dom7'], [7, 'dom7'], [7, 'dom7'], [0, 'maj'], [0, 'maj']), minor: MAJ([0, 'm'], [5, 'm'], [7, 'dom7'], [0, 'm']) },
  },
  country: {
    name: 'Country', icon: '🤠', bpm: 112, sub: 4, inst: 'guitar',
    drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    bass: '1---....5---....', comp: '....D-U-....D-U-',
    prog: { major: MAJ([0, 'maj'], [0, 'maj'], [5, 'maj'], [5, 'maj'], [7, 'maj'], [7, 'maj'], [0, 'maj'], [0, 'maj']), minor: MAJ([0, 'm'], [5, 'm'], [7, 'maj'], [0, 'm']) },
  },
  disco: {
    name: 'Dance', icon: '🪩', bpm: 120, sub: 4, inst: 'pad',
    drums: { k: 'x...x...x...x...', p: '....x.......x...', h: 'x...x...x...x...', o: '..x...x...x...x.' },
    bass: '1.8.1.8.1.8.1.8.', comp: '..x...x...x...x.',
    prog: { major: MAJ([9, 'm'], [5, 'maj'], [0, 'maj'], [7, 'maj']), minor: MAJ([0, 'm'], [8, 'maj'], [3, 'maj'], [10, 'maj']) },
  },
  lofi: {
    name: 'Lo-fi', icon: '🎧', bpm: 80, sub: 4, inst: 'epiano', swing: 0.6, color: '7',
    drums: { k: 'x......x..x.....', s: '....x.......x...', h: 'x.g.x.g.x.g.x.g.' },
    bass: '1-----..5---..3.', comp: 'X-------X-------',
    prog: { major: MAJ([2, 'm7'], [7, 'dom7'], [0, 'maj7'], [9, 'm7']), minor: MAJ([0, 'm7'], [5, 'm7'], [10, 'dom7'], [3, 'maj7']) },
  },
};

const PRESETS = {
  major: [
    ['Accordo singolo (vamp)', [C(0, 'maj')]],
    ['Pop  I–V–vi–IV', MAJ([0, 'maj'], [7, 'maj'], [9, 'm'], [5, 'maj'])],
    ['Anni ’50  I–vi–IV–V', MAJ([0, 'maj'], [9, 'm'], [5, 'maj'], [7, 'maj'])],
    ['Classico  I–IV–V–I', MAJ([0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj'])],
    ['Malinconico  vi–IV–I–V', MAJ([9, 'm'], [5, 'maj'], [0, 'maj'], [7, 'maj'])],
    ['Rock  I–♭VII–IV–I', MAJ([0, 'maj'], [10, 'maj'], [5, 'maj'], [0, 'maj'])],
    ['Jazz  ii–V–I', MAJ([2, 'm7'], [7, 'dom7'], [0, 'maj7'], [0, 'maj7'])],
    ['Turnaround  I–vi–ii–V', MAJ([0, 'maj'], [9, 'm'], [2, 'm'], [7, 'maj'])],
    ['Blues 12 battute', [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((o) => C(o, 'dom7'))],
    ['Canone di Pachelbel', MAJ([0, 'maj'], [7, 'maj'], [9, 'm'], [4, 'm'], [5, 'maj'], [0, 'maj'], [5, 'maj'], [7, 'maj'])],
  ],
  minor: [
    ['Accordo singolo (vamp)', [C(0, 'm')]],
    ['Epico  i–♭VI–♭III–♭VII', MAJ([0, 'm'], [8, 'maj'], [3, 'maj'], [10, 'maj'])],
    ['Andalusa  i–♭VII–♭VI–V', MAJ([0, 'm'], [10, 'maj'], [8, 'maj'], [7, 'maj'])],
    ['Minore classico  i–iv–V–i', MAJ([0, 'm'], [5, 'm'], [7, 'dom7'], [0, 'm'])],
    ['Rock minore  i–♭VII–♭VI–♭VII', MAJ([0, 'm'], [10, 'maj'], [8, 'maj'], [10, 'maj'])],
    ['Jazz  iiø–V–i', MAJ([2, 'm7b5'], [7, 'dom7'], [0, 'm7'], [0, 'm7'])],
    ['Dorico  i–IV', MAJ([0, 'm7'], [5, 'dom7'])],
    ['Blues minore', STYLES.blues.prog.minor],
  ],
};

const INSTRUMENTS = { piano: 'Pianoforte', epiano: 'Piano elettrico', guitar: 'Chitarra', organ: 'Organo', pad: 'Synth pad', none: 'Nessuno' };
const INST_VEL = { piano: 0.6, epiano: 0.5, guitar: 0.55, organ: 0.28, pad: 0.24 };

// Colora un giro con le quadriadi (jazz, bossa, lo-fi) o le settime di dominante (blues)
function colorize(prog, style) {
  if (!style.color) return prog.map((c) => ({ ...c }));
  return prog.map(({ o, t }) => {
    if (style.color === 'dom7' && t === 'maj') return C(o, 'dom7');
    if (style.color === '7') {
      if (t === 'maj') return C(o, o === 7 ? 'dom7' : 'maj7');
      if (t === 'm') return C(o, 'm7');
      if (t === 'dim') return C(o, 'm7b5');
    }
    return C(o, t);
  });
}

// ---------- Pattern ----------
function parseLane(str) {
  const ev = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '-' && ev.length && ev[ev.length - 1].end === i) { ev[ev.length - 1].len++; ev[ev.length - 1].end++; continue; }
    if (ch === '.' || ch === '-' || ch === ' ') continue;
    ev.push({ i, len: 1, end: i + 1, ch });
  }
  return ev;
}
// 3/4 ricavato dal 4/4: battiti 1, 2 e 4 (mantiene il backbeat sul 2 e sul 3)
const to3 = (str, sub) => (str.length === 3 * sub ? str : str.slice(0, 2 * sub) + str.slice(3 * sub, 4 * sub));
const patCache = new Map();
function patterns(styleId, meter) {
  const key = styleId + meter;
  if (patCache.has(key)) return patCache.get(key);
  const s = STYLES[styleId];
  const src = meter === 3 && s.p3 ? s.p3 : s;
  const conv = (x) => (meter === 3 ? to3(x, s.sub) : x);
  const res = {
    drums: Object.entries(src.drums).map(([k, v]) => [k, parseLane(conv(v))]),
    bass: parseLane(conv(src.bass)),
    comp: parseLane(conv(src.comp)),
  };
  patCache.set(key, res);
  return res;
}
const metersOf = (s) => s.meters || [4, 3];

// ---------- Stato ----------
const st = store('backing', {
  style: 'pop', root: 'C', minor: false, meter: 4, bpm: 100, inst: 'guitar',
  drums: true, bass: true, prog: STYLES.pop.prog.major, custom: false,
});
if (!STYLES[st.style]) st.style = 'pop';
if (!Array.isArray(st.prog) || !st.prog.length) st.prog = STYLES[st.style].prog.major;

let playing = false, group = null, nodes = null, timer = null, raf = 0, wake = null;
let nextBar = 0, barIdx = 0, prevVoicing = null, prevBass = null, uiQueue = [], arpIdx = 0;
let sel = -1, open = false, taps = [];
let shownBar = -1, shownBeat = -1;

const keyRoot = () => parseNote(st.root);
const chordAt = (i) => {
  const ch = st.prog[((i % st.prog.length) + st.prog.length) % st.prog.length];
  const root = transpose(keyRoot(), OFF_INT[ch.o]);
  return { ...ch, root, rootPc: pc(root), semis: CHORDS[ch.t].ints.map((x) => INTERVALS[x].semi) };
};
const symOf = (ch) => chordSymbol(transpose(keyRoot(), OFF_INT[ch.o]), ch.t);
const meterNow = () => (metersOf(STYLES[st.style]).includes(st.meter) ? st.meter : metersOf(STYLES[st.style])[0]);

// ---------- Generazione delle note ----------
function bassMidi(sym, ch, next) {
  const base = 36 + ch.rootPc; // Do2..Si2
  const sem = ch.semis;
  const find = (deg, def) => {
    const k = CHORDS[ch.t].ints.findIndex((x) => INTERVALS[x].deg === deg);
    return k >= 0 ? sem[k] : def;
  };
  const third = find(2, find(1, find(3, 4)));
  const fifth = find(4, 7);
  const seventh = find(6, 12);
  let m;
  switch (sym) {
    case '1': m = base; break;
    case '3': m = base + third; break;
    case '5': m = base + fifth; break;
    case '6': m = base + 9; break;
    case '7': m = base + seventh; break;
    case '8': m = base + 12; break;
    case 'w': {
      const opts = [third, fifth, fifth, 12, 9].map((x) => base + x).filter((x) => x !== prevBass);
      m = opts[Math.floor(Math.random() * opts.length)];
      break;
    }
    case 'A': {
      const nb = 36 + next.rootPc;
      const a = [nb - 1, nb + 1];
      m = prevBass != null && Math.abs(a[1] - prevBass) < Math.abs(a[0] - prevBass) ? a[1] : a[0];
      break;
    }
    default: m = base;
  }
  prevBass = m;
  return m;
}

function voicingFor(ch) {
  if (st.inst === 'guitar') {
    const v = fretVoicings('guitar', ch.root, ch.t)[0];
    if (v) return v.midis;
  }
  const raw = ch.semis.map((s) => 48 + ch.rootPc + s).slice(0, 4);
  let v;
  if (prevVoicing) v = (closest(prevVoicing, raw) || { m: raw }).m;
  else {
    v = raw.map((x) => x + 12).sort((a, b) => a - b);
    while (v[0] > 64) v = v.map((x) => x - 12);
  }
  prevVoicing = v;
  return v;
}

function scheduleBar(t) {
  const style = STYLES[st.style];
  const meter = meterNow();
  const sub = style.sub;
  const beat = 60 / st.bpm;
  const step = beat / sub;
  const swing = style.swing || 0.5;
  const pat = patterns(st.style, meter);
  const ch = chordAt(barIdx);
  const next = chordAt(barIdx + 1);
  const timeOf = (i) => {
    const b = Math.floor(i / sub), k = i % sub;
    const f = sub === 4 ? [0, swing / 2, swing, swing + (1 - swing) / 2][k] : k / sub;
    return t + beat * (b + f);
  };
  const VEL = { X: 1, x: 0.75, g: 0.3 };

  if (st.drums) {
    for (const [lane, evs] of pat.drums) for (const e of evs) drum(lane, timeOf(e.i), VEL[e.ch] ?? 0.75, nodes.drums);
  }
  if (st.bass) {
    for (const e of pat.bass) {
      const m = bassMidi(e.ch, ch, next);
      playNote(m, { time: timeOf(e.i), dur: e.len * step * 0.9, vel: 0.62, timbre: 'bass', dest: nodes.bass });
    }
  }
  if (st.inst !== 'none') {
    const v = voicingFor(ch);
    const timbre = st.inst;
    const base = INST_VEL[timbre] / Math.sqrt(v.length);
    const guitar = timbre === 'guitar';
    const arpSeq = [...v, v[0] + 12, ...v.slice(1).reverse()];
    arpIdx = 0;
    for (const e of pat.comp) {
      const time = timeOf(e.i);
      const len = e.len * step;
      if (e.ch === 'a') {
        playNote(arpSeq[arpIdx++ % arpSeq.length], { time, dur: Math.max(len * 2.5, 0.6), vel: INST_VEL[timbre] * 0.7, timbre, dest: nodes.comp });
        continue;
      }
      const short = e.ch === 'x';
      const dur = short ? Math.min(len, step * 1.5) * 0.85 : len * 0.95 + 0.05;
      let notes = v;
      let gap = guitar ? 0.012 : 0;
      let vel = base * (e.ch === 'X' ? 1.1 : 1);
      if (e.ch === 'U') { notes = v.slice(-4).reverse(); vel *= 0.75; gap = guitar ? 0.009 : 0; }
      notes.forEach((m, i) => playNote(m, { time: time + i * gap, dur: guitar ? Math.max(dur, 0.25) : dur, vel, timbre, dest: nodes.comp }));
    }
  }
  for (let b = 0; b < meter; b++) uiQueue.push({ time: t + b * beat, bar: barIdx, beat: b });
  return meter * beat;
}

function tick() {
  const c = ac();
  const ahead = document.hidden ? 1.6 : 0.3; // in background i timer rallentano
  while (nextBar < c.currentTime + ahead) {
    nextBar += scheduleBar(nextBar);
    barIdx++;
  }
}

function uiLoop() {
  const c = ac();
  let cur = null;
  while (uiQueue.length && uiQueue[0].time <= c.currentTime) cur = uiQueue.shift();
  if (cur) showPosition(cur.bar, cur.beat);
  raf = requestAnimationFrame(uiLoop);
}

async function start() {
  if (!st.prog.length) return;
  const c = ac();
  group = createGroup();
  const mk = (v) => { const g = c.createGain(); g.gain.value = v; g.connect(group.node); return g; };
  nodes = { drums: mk(0.55), bass: mk(0.7), comp: mk(0.9) };
  barIdx = 0;
  prevVoicing = null;
  prevBass = null;
  uiQueue = [];
  nextBar = c.currentTime + 0.12;
  playing = true;
  tick();
  timer = setInterval(tick, 40);
  uiLoop();
  updateBar();
  try { wake = await navigator.wakeLock?.request('screen'); } catch { wake = null; }
}

function stop() {
  playing = false;
  clearInterval(timer);
  cancelAnimationFrame(raf);
  if (group) group.stop();
  group = null;
  shownBar = shownBeat = -1;
  if (wake) wake.release().catch(() => {});
  wake = null;
  updateBar();
  renderBars();
}

// ---------- Interfaccia ----------
let root;

function showPosition(bar, beat) {
  if (bar !== shownBar) {
    shownBar = bar;
    const i = bar % st.prog.length;
    $$('.bk-chip', root).forEach((el) => el.classList.toggle('now', +el.dataset.i === i));
    const ch = st.prog[i], nx = st.prog[(i + 1) % st.prog.length];
    if (ch) {
      $('#bkChord', root).textContent = symOf(ch);
      $('#bkNext', root).textContent = st.prog.length > 1 ? '→ ' + symOf(nx) : '';
    }
  }
  if (beat !== shownBeat) {
    shownBeat = beat;
    $$('.bk-dot', root).forEach((d, k) => d.classList.toggle('on', k === beat));
  }
}

function updateBar() {
  const s = STYLES[st.style];
  const meter = meterNow();
  $('#bkPlay', root).textContent = playing ? '■' : '▶';
  $('#bkPlay', root).classList.toggle('on', playing);
  $('#bkPlay', root).setAttribute('aria-label', playing ? 'Ferma la base' : 'Suona la base');
  $('#bkMeta', root).textContent = `${s.icon} ${s.name} · ${noteName(keyRoot())}${st.minor ? 'm' : ''} · ${st.bpm} BPM · ${meter}/4`;
  if (!playing) {
    $('#bkChord', root).textContent = st.prog.length ? symOf(st.prog[0]) : '—';
    $('#bkNext', root).textContent = st.prog.length > 1 ? '→ ' + symOf(st.prog[1]) : '';
  }
  $('#bkDots', root).innerHTML = '<i class="bk-dot"></i>'.repeat(meter);
  shownBeat = -1;
}

function loadProg(prog) {
  st.prog = colorize(prog, STYLES[st.style]);
  sel = -1;
  renderBars();
  updateBar();
}

function setStyle(id) {
  const s = STYLES[id];
  st.style = id;
  st.bpm = s.bpm;
  st.inst = s.inst;
  if (!metersOf(s).includes(st.meter)) st.meter = metersOf(s)[0];
  if (!st.custom) loadProg(s.prog[st.minor ? 'minor' : 'major']);
  renderPanel();
  updateBar();
}

function renderBars() {
  const box = $('#bkBars', root);
  if (!box) return;
  const cur = playing && shownBar >= 0 ? shownBar % st.prog.length : -1;
  box.innerHTML = st.prog.map((ch, i) => `<button type="button" class="bk-chip ${i === sel ? 'sel' : ''} ${i === cur ? 'now' : ''}" data-i="${i}">
      <b>${esc(symOf(ch))}</b><small>${esc(romanOf(ch))}</small></button>`).join('') +
    `<button type="button" class="bk-chip add" id="bkAdd" aria-label="Aggiungi battuta">+</button>`;
  const ed = $('#bkEditor', root);
  if (sel < 0 || !st.prog[sel]) { ed.hidden = true; return; }
  const ch = st.prog[sel];
  ed.hidden = false;
  ed.innerHTML = `
    <span class="bk-ed-title">Battuta ${sel + 1}</span>
    <label class="field">Accordo<select id="bkDeg">${OFF_INT.map((x, o) => `<option value="${o}" ${o === ch.o ? 'selected' : ''}>${ROMAN12[o]} · ${noteName(transpose(keyRoot(), x))}</option>`).join('')}</select></label>
    <label class="field">Tipo<select id="bkType">${TYPES.map((t) => `<option value="${t}" ${t === ch.t ? 'selected' : ''}>${esc(CHORDS[t].sym || 'maj')} — ${esc(CHORDS[t].name)}</option>`).join('')}</select></label>
    <div class="row">
      <button type="button" class="btn" id="bkHear">▶ Ascolta</button>
      <button type="button" class="btn" id="bkDup">Duplica</button>
      <button type="button" class="btn" id="bkDel" ${st.prog.length < 2 ? 'disabled' : ''}>Elimina</button>
    </div>`;
}

function editBar(patch) {
  const prog = st.prog.map((c) => ({ ...c }));
  Object.assign(prog[sel], patch);
  st.prog = prog;
  st.custom = true;
  renderBars();
  updateBar();
}

function renderPanel() {
  const p = $('#bkPanel', root);
  const s = STYLES[st.style];
  const mode = st.minor ? 'minor' : 'major';
  p.innerHTML = `
    <div class="bk-head">
      <div><h3>Base musicale</h3><p class="muted small">Scegli uno stile e suonaci sopra: il giro si ripete finché non premi stop.</p></div>
      <button type="button" class="icon-btn" id="bkClose" aria-label="Chiudi">✕</button>
    </div>
    <div class="bk-styles">${Object.entries(STYLES).map(([id, x]) => `<button type="button" class="bk-style ${id === st.style ? 'on' : ''}" data-style="${id}"><span>${x.icon}</span>${esc(x.name)}</button>`).join('')}</div>
    <div class="controls">
      <label class="field">Tonalità<select id="bkRoot">${rootOptions(st.root)}</select></label>
      <div class="field">Modo${segmented('bkMode', [['major', 'Maggiore'], ['minor', 'Minore']], mode)}</div>
      <div class="field">Tempo${segmented('bkMeter', metersOf(s).slice().sort().reverse().map((m) => [m, `${m}/4`]), meterNow())}</div>
      <label class="field">Strumento<select id="bkInst">${Object.entries(INSTRUMENTS).map(([k, v]) => `<option value="${k}" ${k === st.inst ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <div class="field">Sezione ritmica<div class="row">
        <label class="bk-toggle"><input type="checkbox" id="bkDrums" ${st.drums ? 'checked' : ''}> Batteria</label>
        <label class="bk-toggle"><input type="checkbox" id="bkBass" ${st.bass ? 'checked' : ''}> Basso</label>
      </div></div>
    </div>
    <div class="bk-bpm">
      <span class="field">Velocità</span>
      <button type="button" class="btn" data-bpm="-5">−5</button>
      <input type="range" id="bkBpm" min="40" max="220" value="${st.bpm}" aria-label="BPM">
      <button type="button" class="btn" data-bpm="5">+5</button>
      <b id="bkBpmV">${st.bpm}</b><span class="muted small">BPM</span>
      <button type="button" class="btn" id="bkTap">Tap</button>
    </div>
    <div class="bk-prog-head">
      <span class="field">Giro di accordi (1 accordo per battuta)</span>
      <select id="bkPreset" aria-label="Giri pronti">
        <option value="">Carica un giro…</option>
        <option value="style">${esc(s.icon + ' Giro tipico ' + s.name)}</option>
        ${PRESETS[mode].map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join('')}
      </select>
    </div>
    <div class="bk-bars" id="bkBars"></div>
    <div class="bk-editor" id="bkEditor" hidden></div>`;
  renderBars();
}

function onPanelClick(e) {
  const t = e.target;
  const styleBtn = t.closest('[data-style]');
  if (styleBtn) { setStyle(styleBtn.dataset.style); return; }
  if (t.closest('#bkClose')) { toggle(false); return; }
  const bpmBtn = t.closest('[data-bpm]');
  if (bpmBtn) { setBpm(st.bpm + +bpmBtn.dataset.bpm); return; }
  if (t.closest('#bkTap')) {
    const now = performance.now();
    taps = taps.filter((x) => now - x < 2500);
    taps.push(now);
    if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
    return;
  }
  if (t.closest('#bkAdd')) {
    const last = st.prog[st.prog.length - 1] || C(0, st.minor ? 'm' : 'maj');
    st.prog = [...st.prog, { ...last }];
    st.custom = true;
    sel = st.prog.length - 1;
    renderBars();
    return;
  }
  const chip = t.closest('.bk-chip[data-i]');
  if (chip) { sel = +chip.dataset.i === sel ? -1 : +chip.dataset.i; renderBars(); return; }
  if (t.closest('#bkHear')) {
    const ch = chordAt(sel);
    const saved = prevVoicing;
    prevVoicing = null;
    voicingFor(ch).forEach((m, i) => playNote(m, { time: ac().currentTime + 0.02 + i * (st.inst === 'guitar' ? 0.02 : 0), dur: 1.6, vel: 0.3, timbre: st.inst === 'none' ? 'piano' : st.inst }));
    prevVoicing = saved;
    return;
  }
  if (t.closest('#bkDup')) {
    st.prog = [...st.prog.slice(0, sel + 1), { ...st.prog[sel] }, ...st.prog.slice(sel + 1)];
    st.custom = true;
    sel++;
    renderBars();
    return;
  }
  if (t.closest('#bkDel') && st.prog.length > 1) {
    st.prog = st.prog.filter((_, i) => i !== sel);
    st.custom = true;
    sel = Math.min(sel, st.prog.length - 1);
    renderBars();
    updateBar();
  }
}

function onPanelChange(e) {
  const t = e.target;
  if (t.id === 'bkRoot') { st.root = t.value; renderBars(); updateBar(); }
  if (t.id === 'bkInst') { st.inst = t.value; prevVoicing = null; }
  if (t.id === 'bkDrums') st.drums = t.checked;
  if (t.id === 'bkBass') st.bass = t.checked;
  if (t.id === 'bkDeg') editBar({ o: +t.value });
  if (t.id === 'bkType') editBar({ t: t.value });
  if (t.id === 'bkPreset' && t.value !== '') {
    const mode = st.minor ? 'minor' : 'major';
    const prog = t.value === 'style' ? STYLES[st.style].prog[mode] : PRESETS[mode][+t.value][1];
    st.custom = t.value !== 'style';
    loadProg(prog);
    t.value = '';
  }
}

function onSeg(e) {
  const { name, value } = e.detail;
  if (name === 'bkMode') {
    st.minor = value === 'minor';
    st.custom = false;
    loadProg(STYLES[st.style].prog[value]);
    renderPanel();
  }
  if (name === 'bkMeter') { st.meter = +value; updateBar(); }
}

function setBpm(v) {
  st.bpm = Math.max(40, Math.min(220, Math.round(v)));
  const r = $('#bkBpm', root), b = $('#bkBpmV', root);
  if (r) r.value = st.bpm;
  if (b) b.textContent = st.bpm;
  updateBar();
}

function toggle(force) {
  open = force ?? !open;
  $('#bkPanel', root).hidden = !open;
  $('#bkOpen', root).setAttribute('aria-expanded', open);
  $('#bkOpen', root).textContent = open ? '⌄' : '⌃';
  root.classList.toggle('open', open);
}

export function mountBacking(parent) {
  root = document.createElement('div');
  root.className = 'bk';
  root.innerHTML = `
    <div class="bk-panel" id="bkPanel" hidden></div>
    <div class="bk-bar">
      <button type="button" class="bk-play" id="bkPlay" aria-label="Suona la base">▶</button>
      <button type="button" class="bk-info" id="bkInfo" aria-label="Impostazioni della base">
        <span class="bk-meta" id="bkMeta"></span>
        <span class="bk-now"><b id="bkChord"></b> <small id="bkNext"></small></span>
      </button>
      <div class="bk-dots" id="bkDots" aria-hidden="true"></div>
      <button type="button" class="icon-btn" id="bkOpen" aria-label="Mostra impostazioni" aria-expanded="false">⌃</button>
    </div>`;
  parent.appendChild(root);
  const panel = $('#bkPanel', root);
  panel.addEventListener('click', onPanelClick);
  panel.addEventListener('change', onPanelChange);
  panel.addEventListener('input', (e) => { if (e.target.id === 'bkBpm') setBpm(+e.target.value); });
  panel.addEventListener('segchange', onSeg);
  $('#bkPlay', root).onclick = () => (playing ? stop() : start());
  $('#bkInfo', root).onclick = () => toggle();
  $('#bkOpen', root).onclick = () => toggle();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) toggle(false); });
  renderPanel();
  updateBar();
}

// Ridisegna i nomi delle note (cambio notazione Do/C)
export function refreshBacking() {
  if (!root) return;
  renderPanel();
  updateBar();
  if (playing) shownBar = -1;
}
