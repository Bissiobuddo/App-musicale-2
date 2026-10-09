import { CHORDS, INTERVALS, parseNote, noteName, chordNotes, chordSymbol, chordMidis, intervalBetween, fmtInt } from '../theory.js';
import { playChord, playSequence } from '../audio.js';
import { $, store, rootOptions, segmented, pianoSVG, bindPiano, intLabel, intClass, LEGEND, esc } from '../ui.js';

const TRIADS = ['maj', 'm', 'dim', 'aug', 'sus2', 'sus4'];
const QUADS = ['maj7', 'dom7', 'm7', 'm7b5', 'dim7', 'mMaj7', 'maj7s5', 'six', 'm6'];
const SHORT = { 'Terza maggiore': '3M', 'Terza minore': '3m', 'Seconda maggiore': '2M', 'Quarta giusta': '4G', 'Terza diminuita': '3d', 'Seconda minore': '2m', 'Seconda aumentata': '2A', 'Quarta diminuita': '4d' };

const BUILD = [
  ['maj', '7', 'maj7', 'triade maggiore + 7ª maggiore'],
  ['maj', 'b7', 'dom7', 'triade maggiore + 7ª minore'],
  ['m', 'b7', 'm7', 'triade minore + 7ª minore'],
  ['m', '7', 'mMaj7', 'triade minore + 7ª maggiore'],
  ['dim', 'b7', 'm7b5', 'triade diminuita + 7ª minore'],
  ['dim', 'bb7', 'dim7', 'triade diminuita + 7ª diminuita'],
  ['aug', '7', 'maj7s5', 'triade aumentata + 7ª maggiore'],
];

export default {
  id: 'triadi',
  title: 'Triadi e quadriadi',
  icon: '🔺',
  desc: 'Tutti i tipi di triadi e quadriadi con formula, intervalli e carattere.',
  render(el) {
    const st = store('triads', { root: 'C', label: 'ints' });
    el.innerHTML = `
      <h1>Triadi e quadriadi</h1>
      <p class="muted">Una <b>triade</b> è formata da 3 note sovrapposte per terze (fondamentale, terza, quinta). Una <b>quadriade</b> aggiunge una quarta nota: la settima (o la sesta).</p>
      <div class="controls">
        <label class="field">Fondamentale<select id="root">${rootOptions(st.root)}</select></label>
        <div class="field">Etichette${segmented('label', [['notes', 'Note'], ['ints', 'Intervalli']], st.label)}</div>
      </div>
      <div id="out"></div>`;
    const out = $('#out', el);

    const card = (root, type) => {
      const c = CHORDS[type];
      const notes = chordNotes(root, type);
      const midis = chordMidis(root, type, 60);
      const marks = new Map(midis.map((m, i) => [m, { label: st.label === 'ints' ? intLabel(c.ints[i]) : noteName(notes[i]), cls: intClass(c.ints[i]) }]));
      const stack = notes.slice(1).map((n, i) => SHORT[intervalBetween(notes[i], n).name] || intervalBetween(notes[i], n).name).join(' + ');
      return `<div class="card">
        <div class="row" style="justify-content:space-between">
          <div><b style="font-size:1.3rem">${chordSymbol(root, type)}</b> <span class="muted">${esc(c.name)}</span></div>
          <button class="btn" data-play="${type}">▶</button>
        </div>
        <p class="notes-line">${notes.map(noteName).join(' – ')}</p>
        <p class="small">Formula: <b>${c.ints.map(fmtInt).join(' – ')}</b> · Semitoni: ${c.ints.map((i) => INTERVALS[i].semi).join('-')}</p>
        <p class="small">Terze sovrapposte: <b>${stack}</b></p>
        ${pianoSVG({ from: 60, to: Math.max(76, midis[midis.length - 1]), marks, height: 90 })}
        <p class="small muted">${esc(c.char)}</p>
      </div>`;
    };

    const draw = () => {
      const root = parseNote(st.root);
      out.innerHTML = `
        ${LEGEND}
        <h2>Triadi</h2>
        <div class="grid grid-2">${TRIADS.map((t) => card(root, t)).join('')}</div>
        <div class="info small">3M = terza maggiore (4 semitoni), 3m = terza minore (3 semitoni). Le quattro triadi “vere” nascono dalle 4 combinazioni di terze: <b>3M+3m</b> maggiore, <b>3m+3M</b> minore, <b>3m+3m</b> diminuita, <b>3M+3M</b> aumentata. Le sus sostituiscono la terza con la 2ª o la 4ª.</div>
        <h2>Dalla triade alla quadriade</h2>
        <div class="card tbl-wrap"><table>
          <tr><th>Triade</th><th>+ settima</th><th>=</th><th>Quadriade</th></tr>
          ${BUILD.map(([t, s, q, d]) => `<tr><td>${chordSymbol(root, t)}</td><td>${fmtInt(s)} (${INTERVALS[s].name.toLowerCase()})</td><td>→</td><td><b>${chordSymbol(root, q)}</b> <span class="muted small">${d}</span></td></tr>`).join('')}
        </table></div>
        <h2>Quadriadi</h2>
        <div class="grid grid-2">${QUADS.map((t) => card(root, t)).join('')}</div>`;
      out.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => {
        const m = chordMidis(root, b.dataset.play, 60);
        playSequence(m, { gap: 0.22, dur: 0.6 });
        setTimeout(() => playChord(m), m.length * 220 + 150);
      }));
    };
    $('#root', el).onchange = (e) => { st.root = e.target.value; draw(); };
    el.addEventListener('segchange', (e) => { if (e.detail.name === 'label') { st.label = e.detail.value; draw(); } });
    bindPiano(out);
    draw();
  },
};
