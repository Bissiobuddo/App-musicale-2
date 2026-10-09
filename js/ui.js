// Componenti grafici condivisi: selettori, tastiera di pianoforte, diagrammi
// di accordi e manico della chitarra (SVG).

import { ROOTS, parseNote, noteName, fmtInt } from './theory.js';
import { playNote } from './audio.js';

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function rootOptions(selected) {
  return ROOTS.map((r) => `<option value="${r}" ${r === selected ? 'selected' : ''}>${noteName(parseNote(r))}</option>`).join('');
}

export function optionsFrom(obj, selected, label = (v) => v.name) {
  return Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(label(v, k))}</option>`).join('');
}

// Stato per vista persistito in localStorage
export function store(key, defaults) {
  let data = { ...defaults };
  try { Object.assign(data, JSON.parse(localStorage.getItem('armonia:' + key) || '{}')); } catch { /* ignorato */ }
  return new Proxy(data, {
    set(t, k, v) {
      t[k] = v;
      try { localStorage.setItem('armonia:' + key, JSON.stringify(t)); } catch { /* ignorato */ }
      return true;
    },
  });
}

// Pulsanti a scelta singola: <div class="seg">...
export function segmented(name, options, selected) {
  return `<div class="seg" data-seg="${name}">${options.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(selected) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}

// ---------- Pianoforte ----------
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const PIANO_DEFS = `<defs>
  <linearGradient id="pkW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d4ff"/><stop offset=".85" stop-color="#f7f5ff"/><stop offset="1" stop-color="#c9c2f0"/></linearGradient>
  <linearGradient id="pkB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1530"/><stop offset=".9" stop-color="#2c2550"/><stop offset="1" stop-color="#4a3f80"/></linearGradient>
</defs>`;
const isBlack = (m) => !WHITE_PCS.includes(((m % 12) + 12) % 12);

/**
 * marks: Map<midi, {label, cls}> — cls: 'root' | 'tone' | 'soft' | 'active'
 */
export function pianoSVG({ from = 48, to = 72, marks = new Map(), height = 120 } = {}) {
  while (isBlack(from)) from--;
  while (isBlack(to)) to++;
  const W = 28, H = height, BW = 18, BH = H * 0.62;
  let whites = [], blacks = [], x = 0;
  for (let m = from; m <= to; m++) {
    if (!isBlack(m)) { whites.push({ m, x }); x += W; } else blacks.push({ m, x: x - BW / 2 });
  }
  const key = (k, black) => {
    const mk = marks.get(k.m);
    const cls = `key ${black ? 'black' : 'white'} ${mk ? 'm-' + (mk.cls || 'tone') : ''}`;
    const w = black ? BW : W, h = black ? BH : H;
    let label = '';
    if (mk && mk.label) {
      const cy = black ? BH - 14 : H - 16;
      label = `<circle cx="${k.x + w / 2}" cy="${cy}" r="${black ? 8.5 : 11}" class="dot dot-${mk.cls || 'tone'}"/>` +
        `<text x="${k.x + w / 2}" y="${cy + 3.5}" class="dot-t ${mk.label.length > 3 ? 'small' : ''}">${esc(mk.label)}</text>`;
    }
    return `<g data-midi="${k.m}" class="pk"><rect x="${k.x}" y="0" width="${w}" height="${h}" rx="${black ? 3 : 4}" class="${cls}"/>${label}</g>`;
  };
  return `<svg class="piano" viewBox="-1 -1 ${x + 2} ${H + 2}" role="img" aria-label="Tastiera">${PIANO_DEFS}${whites.map((k) => key(k, false)).join('')}${blacks.map((k) => key(k, true)).join('')}</svg>`;
}

// Rende suonabili i tasti del pianoforte dentro un contenitore
export function bindPiano(el) {
  el.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('[data-midi]');
    if (!g || !g.closest('svg.piano')) return;
    playNote(+g.dataset.midi, { dur: 1.2 });
    g.classList.add('pressed');
    setTimeout(() => g.classList.remove('pressed'), 180);
  });
}

// ---------- Diagramma accordo (chitarra / ukulele) ----------
export function chordDiagramSVG({ frets, labels = [], classes = [], barre = null, stringNames = [] }) {
  const n = frets.length;
  const SP = 26, FH = 30, NF = 5, L = 30, T = 34;
  const fretted = frets.filter((f) => f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 0;
  const start = maxF <= NF ? 1 : minF;
  const W = L + SP * (n - 1) + 24, H = T + FH * NF + 26;
  let s = '';
  for (let i = 0; i <= NF; i++) {
    const y = T + i * FH;
    s += `<line x1="${L}" y1="${y}" x2="${L + SP * (n - 1)}" y2="${y}" class="${i === 0 && start === 1 ? 'nut' : 'fret'}"/>`;
  }
  for (let i = 0; i < n; i++) s += `<line x1="${L + i * SP}" y1="${T}" x2="${L + i * SP}" y2="${T + FH * NF}" class="string"/>`;
  if (start > 1) s += `<text x="${L - 10}" y="${T + FH / 2 + 4}" class="fretno">${start}</text>`;
  if (barre && barre.from < barre.to) {
    const y = T + (barre.fret - start + 0.5) * FH;
    s += `<rect x="${L + barre.from * SP - 11}" y="${y - 11}" width="${(barre.to - barre.from) * SP + 22}" height="22" rx="11" class="barre"/>`;
  }
  frets.forEach((f, i) => {
    const x = L + i * SP;
    if (f < 0) s += `<text x="${x}" y="${T - 10}" class="xo">×</text>`;
    else if (f === 0) s += `<circle cx="${x}" cy="${T - 14}" r="7" class="open ${classes[i] || ''}"/><text x="${x}" y="${T - 11}" class="open-t">${esc(labels[i] || '')}</text>`;
    else {
      const y = T + (f - start + 0.5) * FH;
      s += `<circle cx="${x}" cy="${y}" r="11" class="dot dot-${classes[i] || 'tone'}"/><text x="${x}" y="${y + 3.5}" class="dot-t ${(labels[i] || '').length > 3 ? 'small' : ''}">${esc(labels[i] || '')}</text>`;
    }
    if (stringNames[i]) s += `<text x="${x}" y="${H - 4}" class="sname">${esc(stringNames[i])}</text>`;
  });
  return `<svg class="diagram" viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(W * 1.3)}px" role="img">${s}</svg>`;
}

// ---------- Manico completo (scale) ----------
/** marks(stringIdx, fret) => {label, cls} | null ; corde dalla più grave */
export function fretboardSVG({ tuning, frets = 15, marks }) {
  const n = tuning.length;
  const FW = 46, SP = 24, L = 26, T = 14;
  const W = L + FW * frets + 10, H = T + SP * (n - 1) + 30;
  let s = '';
  const yOf = (i) => T + (n - 1 - i) * SP; // corda più acuta in alto
  for (const f of [3, 5, 7, 9, 15, 17]) if (f <= frets) s += `<circle cx="${L + (f - 0.5) * FW}" cy="${T + (SP * (n - 1)) / 2}" r="5" class="inlay"/>`;
  if (frets >= 12) {
    s += `<circle cx="${L + 11.5 * FW}" cy="${T + SP * (n - 1) * 0.25}" r="5" class="inlay"/><circle cx="${L + 11.5 * FW}" cy="${T + SP * (n - 1) * 0.75}" r="5" class="inlay"/>`;
  }
  for (let f = 0; f <= frets; f++) {
    s += `<line x1="${L + f * FW}" y1="${T}" x2="${L + f * FW}" y2="${T + SP * (n - 1)}" class="${f === 0 ? 'nut' : 'fret'}"/>`;
    if (f > 0) s += `<text x="${L + (f - 0.5) * FW}" y="${H - 6}" class="fretno-b">${f}</text>`;
  }
  for (let i = 0; i < n; i++) s += `<line x1="${L}" y1="${yOf(i)}" x2="${L + FW * frets}" y2="${yOf(i)}" class="string"/>`;
  for (let i = 0; i < n; i++) {
    for (let f = 0; f <= frets; f++) {
      const mk = marks(i, f);
      if (!mk) continue;
      const x = f === 0 ? L - 13 : L + (f - 0.5) * FW;
      s += `<g data-midi="${tuning[i] + f}" class="fb-note"><circle cx="${x}" cy="${yOf(i)}" r="10" class="dot dot-${mk.cls || 'tone'}"/><text x="${x}" y="${yOf(i) + 3.5}" class="dot-t ${mk.label.length > 3 ? 'small' : ''}">${esc(mk.label)}</text></g>`;
    }
  }
  return `<div class="hscroll"><svg class="fretboard" viewBox="0 0 ${W} ${H}" style="min-width:${Math.round(W * 0.8)}px" role="img">${s}</svg></div>`;
}

export function bindFretboard(el, timbre = 'pluck') {
  el.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.fb-note');
    if (g) playNote(+g.dataset.midi, { dur: 1.2, timbre });
  });
}

export const intLabel = (sym) => (sym === '1' ? 'R' : fmtInt(sym));

// Colore per funzione dell'intervallo: fondamentale, terza, settima, altri
export function intClass(sym) {
  if (sym === '1' || sym === '8') return 'root';
  if (/^b?3$/.test(sym)) return 'third';
  if (/7$/.test(sym)) return 'seventh';
  return 'tone';
}

export const LEGEND = `<div class="legend"><span><i class="int-root"></i>Fondamentale</span><span><i class="int-third"></i>Terza</span><span><i class="int-tone"></i>Quinta / altri</span><span><i class="int-seventh"></i>Settima</span></div>`;
