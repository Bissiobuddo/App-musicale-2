import {
  CHORDS, parseNote, pc, noteName, chordNotes, chordSymbol, chordMidis, intervalBetween, fmtInt, diatonicChords,
} from '../theory.js';
import { playChord, playSequence, ac, createGroup } from '../audio.js';
import { $, store, rootOptions, segmented, pianoSVG, bindPiano, intLabel, intClass, LEGEND } from '../ui.js';
import { chordTypeOptions } from './chords.js';

const INV_NAMES = ['Stato fondamentale', 'Primo rivolto', 'Secondo rivolto', 'Terzo rivolto'];
const BASS_NAMES = ['fondamentale al basso', 'terza al basso', 'quinta al basso', 'settima al basso'];
const FIG = { 3: ['5/3', '6', '6/4'], 4: ['7', '6/5', '4/3', '4/2'] };
const USE = {
  3: [
    'Il suono più stabile e “pieno”: il basso è la fondamentale.',
    'Più leggero e mobile: ottimo per linee di basso che salgono o scendono per grado.',
    'Instabile: si usa soprattutto di passaggio o come “6/4 cadenzale” prima della dominante.',
  ],
  4: [
    'Il suono completo dell’accordo di settima.',
    'Terza al basso: morbido, collega bene gli accordi.',
    'Quinta al basso: suono equilibrato, di passaggio.',
    'Settima al basso: molto teso, il basso tende a scendere di grado.',
  ],
};

// Sceglie il rivolto più vicino al precedente (condotta delle parti)
export function closest(prev, midis) {
  const cands = [];
  for (let k = 0; k < midis.length; k++) {
    const inv = midis.map((m, i) => (i < k ? m + 12 : m)).sort((a, b) => a - b);
    for (const o of [-24, -12, 0, 12]) cands.push({ k, m: inv.map((x) => x + o) });
  }
  const cost = (c) => c.m.reduce((s, x, i) => s + Math.abs(x - (prev[i] ?? prev[prev.length - 1])), 0) + Math.abs(c.m[0] - 55) * 0.05;
  const inRange = cands.filter((c) => c.m[0] >= 47 && c.m[c.m.length - 1] <= 79);
  return (inRange.length ? inRange : cands).sort((a, b) => cost(a) - cost(b))[0];
}

export default {
  id: 'rivolti',
  title: 'Rivolti',
  icon: '🔄',
  desc: 'Rivolti di triadi e quadriadi: nota al basso, intervalli, sigle e condotta delle parti.',
  render(el) {
    const st = store('inversions', { root: 'C', type: 'maj', label: 'notes' });
    let group = null;
    el.innerHTML = `
      <h1>Rivolti degli accordi</h1>
      <p class="muted">Un accordo è “rivoltato” quando al basso non c’è la fondamentale. Le note restano le stesse, ma cambia la nota più grave: cambia il colore e la stabilità.</p>
      <div class="controls">
        <label class="field">Fondamentale<select id="root">${rootOptions(st.root)}</select></label>
        <label class="field">Accordo<select id="type">${chordTypeOptions(st.type, ['triade', 'quadriade'])}</select></label>
        <div class="field">Etichette${segmented('label', [['notes', 'Note'], ['ints', 'Intervalli']], st.label)}</div>
      </div>
      <div id="out"></div>`;
    const out = $('#out', el);

    const draw = () => {
      if (CHORDS[st.type].ints.length > 4 || st.type === 'p5') st.type = 'maj';
      const root = parseNote(st.root);
      const c = CHORDS[st.type];
      const notes = chordNotes(root, st.type);
      const base = chordMidis(root, st.type, 60);
      const n = notes.length;
      const cards = notes.map((_, k) => {
        const order = [...Array(n).keys()].map((i) => (i + k) % n);
        const midis = base.map((m, i) => (i < k ? m + 12 : m)).sort((a, b) => a - b);
        const marks = new Map(order.map((idx, j) => [midis[j], { label: st.label === 'ints' ? intLabel(c.ints[idx]) : noteName(notes[idx]), cls: intClass(c.ints[idx]) }]));
        const bass = notes[order[0]];
        const fromBass = order.slice(1).map((idx) => intervalBetween(bass, notes[idx]));
        const name = chordSymbol(root, st.type) + (k ? '/' + noteName(bass) : '');
        return `<div class="card">
          <div class="row" style="justify-content:space-between">
            <div><b style="font-size:1.3rem">${name}</b><div class="muted small">${INV_NAMES[k]} · ${BASS_NAMES[k]}</div></div>
            <button class="btn" data-inv="${k}">▶</button>
          </div>
          <p class="notes-line">${order.map((i) => noteName(notes[i])).join(' – ')}</p>
          ${pianoSVG({ from: 60, to: 84, marks, height: 90 })}
          <p class="small">Intervalli dal basso: ${fromBass.map((iv) => `<span class="pill">${iv.name.toLowerCase()}</span>`).join(' ')}</p>
          <p class="small">Numerica (basso continuo): <b>${(FIG[n] || [])[k] || ''}</b></p>
          <p class="small muted">${(USE[n] || [])[k] || ''}</p>
        </div>`;
      }).join('');

      // condotta delle parti su I–IV–V–I (o i–iv–V–i se l'accordo è minore)
      const minor = c.ints.includes('b3');
      const dia = diatonicChords(root, minor ? 'harmonic' : 'major');
      const prog = [dia[0], dia[3], dia[4], dia[0]];
      const rootPos = prog.map((d) => chordMidis(d.root, d.type, 48));
      let prev = chordMidis(prog[0].root, prog[0].type, 60);
      const smooth = prog.map((d, i) => {
        if (i === 0) return { k: 0, m: prev };
        const r = closest(prev, chordMidis(d.root, d.type, 60));
        prev = r.m;
        return r;
      });
      const label = (d, s) => {
        const ns = chordNotes(d.root, d.type);
        const bassPc = s.m[0] % 12;
        const bass = ns.find((x) => pc(x) === bassPc) || d.root;
        return chordSymbol(d.root, d.type) + (bass.letter !== d.root.letter ? '/' + noteName(bass) : '');
      };

      out.innerHTML = `
        ${LEGEND}
        <div class="grid grid-2" style="margin-top:1rem">${cards}</div>
        <h2>A cosa servono: condotta delle parti</h2>
        <p class="muted small">Usando i rivolti, passando da un accordo all’altro le voci si muovono il meno possibile: il suono è più fluido e professionale.</p>
        <div class="grid grid-2">
          <div class="card"><h3>Tutto in stato fondamentale</h3>
            <p class="notes-line">${prog.map((d) => chordSymbol(d.root, d.type)).join(' → ')}</p>
            <button class="btn" id="playRoot">▶ Ascolta</button></div>
          <div class="card"><h3>Con i rivolti più vicini</h3>
            <p class="notes-line">${prog.map((d, i) => label(d, smooth[i])).join(' → ')}</p>
            <button class="btn primary" id="playSmooth">▶ Ascolta</button></div>
        </div>
        <div class="info small">Sigla “a barra”: <b>C/E</b> significa accordo di Do con Mi al basso. Regola pratica: tieni ferme le note in comune tra due accordi e muovi le altre per grado.</div>`;

      out.querySelectorAll('[data-inv]').forEach((b) => (b.onclick = () => {
        const k = +b.dataset.inv;
        const m = base.map((x, i) => (i < k ? x + 12 : x)).sort((a, b2) => a - b2);
        playSequence(m, { gap: 0.2, dur: 0.6 });
        setTimeout(() => playChord(m), m.length * 200 + 150);
      }));
      const playProg = (list) => {
        if (group) group.stop();
        group = createGroup();
        const t0 = ac().currentTime + 0.05;
        list.forEach((m, i) => playChord(m, { time: t0 + i * 1.1, dur: 1.2, dest: group.node }));
      };
      $('#playRoot', out).onclick = () => playProg(rootPos);
      $('#playSmooth', out).onclick = () => playProg(smooth.map((s) => s.m));
    };

    $('#root', el).onchange = (e) => { st.root = e.target.value; draw(); };
    $('#type', el).onchange = (e) => { st.type = e.target.value; draw(); };
    el.addEventListener('segchange', (e) => { if (e.detail.name === 'label') { st.label = e.detail.value; draw(); } });
    bindPiano(out);
    draw();
    return () => group && group.stop();
  },
};
