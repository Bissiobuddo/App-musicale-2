import {
  SCALES, INTERVALS, parseNote, noteName, scaleNotes, scaleSteps, stepName, fmtInt, rootMidi, pc,
  diatonicChords, chordSymbol, chordMidis, FUNCTION_NAMES,
} from '../theory.js';
import { playSequence, playChord } from '../audio.js';
import { TUNINGS } from '../voicings.js';
import {
  $, store, rootOptions, optionsFrom, segmented, pianoSVG, bindPiano, fretboardSVG, bindFretboard, intLabel, esc,
} from '../ui.js';

export default {
  id: 'scale',
  title: 'Scale',
  icon: '🎼',
  desc: 'Scale maggiori, minori, modi, pentatoniche e blues con intervalli, toni/semitoni e manico.',
  render(el) {
    const st = store('scales', { root: 'C', type: 'major', label: 'notes', inst: 'guitar' });
    el.innerHTML = `
      <h1>Scale</h1>
      <p class="muted">Una scala è una sequenza ordinata di note. Ogni scala ha una “formula” di intervalli dalla tonica: è questa a darle il suo carattere.</p>
      <div class="controls">
        <label class="field">Tonica<select id="root">${rootOptions(st.root)}</select></label>
        <label class="field">Scala<select id="type">${optionsFrom(SCALES, st.type)}</select></label>
        <div class="field">Etichette${segmented('label', [['notes', 'Note'], ['ints', 'Intervalli']], st.label)}</div>
      </div>
      <div id="out"></div>`;
    const out = $('#out', el);

    const draw = () => {
      const root = parseNote(st.root);
      const sc = SCALES[st.type];
      const notes = scaleNotes(root, st.type);
      const r = rootMidi(root, 60);
      const midis = sc.ints.map((i) => r + INTERVALS[i].semi);
      const steps = scaleSteps(st.type);
      const lab = (k) => (st.label === 'ints' ? intLabel(sc.ints[k]) : noteName(notes[k]));
      const marks = new Map();
      midis.forEach((m, k) => { marks.set(m, { label: lab(k), cls: k === 0 ? 'root' : 'tone' }); });
      marks.set(r + 12, { label: lab(0), cls: 'root' });
      const byPc = new Map(notes.map((n, k) => [pc(n), k]));
      const tun = TUNINGS[st.inst].midis;
      const fb = fretboardSVG({
        tuning: tun,
        frets: st.inst === 'guitar' ? 15 : 12,
        marks: (i, f) => {
          const k = byPc.get((tun[i] + f) % 12);
          return k === undefined ? null : { label: lab(k), cls: k === 0 ? 'root' : 'tone' };
        },
      });
      const seven = notes.length === 7;
      const tri = seven ? diatonicChords(root, st.type) : [];
      const quad = seven ? diatonicChords(root, st.type, true) : [];

      out.innerHTML = `
        <div class="card">
          <div class="row" style="justify-content:space-between">
            <div><div class="big-name">${noteName(root)} ${esc(sc.name.toLowerCase())}</div></div>
            <div class="row"><button class="btn primary" id="up">▶ Sali</button><button class="btn" id="down">▶ Scendi</button></div>
          </div>
          <p class="muted">${esc(sc.desc)}</p>
          <div class="tbl-wrap"><table>
            <tr><th>Grado</th>${notes.map((_, k) => `<td><b>${k + 1}</b></td>`).join('')}</tr>
            <tr><th>Nota</th>${notes.map((n, k) => `<td><span class="pill ${k === 0 ? 'root' : ''}">${noteName(n)}</span></td>`).join('')}</tr>
            <tr><th>Intervallo</th>${sc.ints.map((i) => `<td>${fmtInt(i)}</td>`).join('')}</tr>
            <tr><th>Nome</th>${sc.ints.map((i) => `<td class="small muted">${INTERVALS[i].name}</td>`).join('')}</tr>
            <tr><th>Passo →</th>${steps.map((s) => `<td><b>${stepName(s)}</b></td>`).join('')}</tr>
          </table></div>
          <p class="small muted">T = tono (2 semitoni), S = semitono. Formula: <b>${steps.map(stepName).join(' – ')}</b></p>
        </div>
        <div class="card" style="margin-top:1rem">${pianoSVG({ from: 60, to: 84, marks })}</div>
        <div class="card" style="margin-top:1rem">
          <div class="row" style="justify-content:space-between;margin-bottom:.5rem"><h3>Sul manico</h3>${segmented('inst', [['guitar', 'Chitarra'], ['ukulele', 'Ukulele']], st.inst)}</div>
          ${fb}
        </div>
        ${seven ? `
        <h2>Accordi della scala (armonizzazione)</h2>
        <p class="muted small">Costruendo una triade (o quadriade) per terze su ogni grado, usando solo le note della scala, si ottengono gli accordi “della tonalità”.</p>
        <div class="card tbl-wrap"><table>
          <tr><th>Grado</th><th>Triade</th><th>Quadriade</th><th>Funzione</th></tr>
          ${tri.map((c, k) => `<tr>
            <td><b>${c.roman}</b></td>
            <td><button class="btn" data-ch="${k}|0">${chordSymbol(c.root, c.type)}</button> <span class="small muted">${c.notes.map(noteName).join(' ')}</span></td>
            <td><button class="btn" data-ch="${k}|1">${chordSymbol(quad[k].root, quad[k].type)}</button> <span class="small muted">${quad[k].roman}</span></td>
            <td class="small fn-${c.fn}">${st.type === 'major' || st.type === 'minor' ? FUNCTION_NAMES[c.fn] : ''}</td></tr>`).join('')}
        </table></div>` : ''}`;

      $('#up', out).onclick = () => playSequence([...midis, r + 12], { gap: 0.32 });
      $('#down', out).onclick = () => playSequence([r + 12, ...midis.slice().reverse()], { gap: 0.32 });
      out.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => {
        const [k, q] = b.dataset.ch.split('|').map(Number);
        const c = (q ? quad : tri)[k];
        playChord(chordMidis(c.root, c.type, 48));
      }));
    };

    $('#root', el).onchange = (e) => { st.root = e.target.value; draw(); };
    $('#type', el).onchange = (e) => { st.type = e.target.value; draw(); };
    el.addEventListener('segchange', (e) => {
      if (e.detail.name === 'label') st.label = e.detail.value;
      if (e.detail.name === 'inst') st.inst = e.detail.value;
      draw();
    });
    bindPiano(out);
    bindFretboard(out);
    draw();
  },
};
