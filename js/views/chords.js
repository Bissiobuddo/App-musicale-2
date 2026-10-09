import {
  CHORDS, CHORD_CATS, INTERVALS, INTERVAL_ROLE, parseNote, noteName, chordNotes, chordSymbol,
  chordMidis, pc, transpose, intervalBetween, fmtInt,
} from '../theory.js';
import { playChord, playSequence } from '../audio.js';
import { findVoicings, TUNINGS } from '../voicings.js';
import {
  $, store, rootOptions, segmented, pianoSVG, bindPiano, chordDiagramSVG, intLabel, intClass, LEGEND, esc,
} from '../ui.js';

export function chordTypeOptions(selected, cats = Object.keys(CHORD_CATS)) {
  return cats.map((c) => `<optgroup label="${CHORD_CATS[c]}">${Object.entries(CHORDS).filter(([, v]) => v.cat === c)
    .map(([k, v]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(v.sym || 'maj')} — ${esc(v.name)}</option>`).join('')}</optgroup>`).join('');
}

// Diteggiature per uno strumento tastato, con etichette (nota o intervallo) per corda
export function fretVoicings(inst, root, type) {
  const t = TUNINGS[inst];
  const ints = CHORDS[type].ints;
  const notes = chordNotes(root, type);
  const optional = ints.length >= 4 && ints.includes('5') ? [pc(transpose(root, '5'))] : [];
  let v = findVoicings(t.midis, notes.map(pc), pc(root), optional, t);
  if (!v.length) v = findVoicings(t.midis, notes.map(pc), pc(root), optional, { ...t, minStrings: 3 });
  return v.map((vo) => ({
    ...vo,
    info: vo.frets.map((f, i) => {
      if (f < 0) return null;
      const k = notes.findIndex((n) => pc(n) === (t.midis[i] + f) % 12);
      return { note: notes[k], sym: ints[k] };
    }),
    midis: vo.frets.map((f, i) => (f < 0 ? null : t.midis[i] + f)).filter((m) => m !== null),
  }));
}

const STRING_NAMES = { guitar: ['E', 'A', 'D', 'G', 'B', 'E'], ukulele: ['G', 'C', 'E', 'A'] };

export function voicingDiagram(inst, vo, labelMode) {
  return chordDiagramSVG({
    frets: vo.frets,
    barre: vo.barre,
    labels: vo.info.map((x) => (x ? (labelMode === 'ints' ? intLabel(x.sym) : noteName(x.note)) : '')),
    classes: vo.info.map((x) => (x ? intClass(x.sym) : '')),
    stringNames: STRING_NAMES[inst].map((s) => noteName(parseNote(s))),
  });
}

export default {
  id: 'accordi',
  title: 'Accordi',
  icon: '🎸',
  desc: 'Accordi per chitarra, pianoforte e ukulele, con intervalli e significato di ogni nota.',
  render(el) {
    const st = store('chords', { root: 'C', type: 'maj', label: 'notes' });
    const vIdx = { guitar: 0, ukulele: 0 };

    el.innerHTML = `
      <h1>Accordi</h1>
      <p class="muted">Scegli fondamentale e tipo: vedi la diteggiatura su ogni strumento, le note, gli intervalli e il ruolo di ciascuna nota.</p>
      <div class="controls">
        <label class="field">Fondamentale<select id="root">${rootOptions(st.root)}</select></label>
        <label class="field">Tipo<select id="type">${chordTypeOptions(st.type)}</select></label>
        <div class="field">Etichette${segmented('label', [['notes', 'Note'], ['ints', 'Intervalli']], st.label)}</div>
      </div>
      <div id="out"></div>`;

    const out = $('#out', el);

    const draw = () => {
      const root = parseNote(st.root);
      const c = CHORDS[st.type];
      const notes = chordNotes(root, st.type);
      const midis = chordMidis(root, st.type, 48);
      const marks = new Map(midis.map((m, i) => [m, { label: st.label === 'ints' ? intLabel(c.ints[i]) : noteName(notes[i]), cls: intClass(c.ints[i]) }]));
      const inst = (key) => {
        const vs = fretVoicings(key, root, st.type);
        if (!vs.length) return `<p class="muted">Nessuna diteggiatura comoda trovata.</p>`;
        vIdx[key] = Math.min(vIdx[key], vs.length - 1);
        const vo = vs[vIdx[key]];
        return `${voicingDiagram(key, vo, st.label)}
          <div class="frets-code">${vo.frets.map((f) => (f < 0 ? 'x' : f)).join(vo.frets.some((f) => f > 9) ? '-' : '')}</div>
          <div class="voicing-nav"><button class="btn" data-prev="${key}">◀</button> Posizione ${vIdx[key] + 1}/${vs.length} <button class="btn" data-next="${key}">▶</button></div>`;
      };

      // struttura per terze sovrapposte
      const sorted = c.ints.map((s, i) => ({ s, n: notes[i], semi: INTERVALS[s].semi })).sort((a, b) => a.semi - b.semi);
      const stack = sorted.slice(1).map((x, i) => {
        const iv = intervalBetween(sorted[i].n, x.n);
        return `<span class="pill">${noteName(sorted[i].n)} → ${noteName(x.n)}: <b>${iv.name.toLowerCase()}</b> (${iv.semi} st)</span>`;
      }).join('');

      out.innerHTML = `
        <div class="card">
          <div class="row" style="justify-content:space-between">
            <div>
              <div class="big-name">${chordSymbol(root, st.type)}</div>
              <div class="muted">${noteName(root)} ${c.name.toLowerCase()} · ${esc(c.char)}</div>
            </div>
            <div class="row">
              <button class="btn primary" id="playChord">▶ Accordo</button>
              <button class="btn" id="playArp">▶ Arpeggio</button>
            </div>
          </div>
          <div class="chips" style="margin-top:.8rem">${notes.map((n, i) => `<span class="pill ${i === 0 ? 'root' : ''}">${noteName(n)} <small>(${fmtInt(c.ints[i])})</small></span>`).join('')}</div>
        </div>
        <div class="grid grid-3" style="margin-top:1rem">
          <div class="card inst-card"><h3>Chitarra <button class="btn" data-strum="guitar">▶</button></h3>${inst('guitar')}</div>
          <div class="card inst-card"><h3>Ukulele <button class="btn" data-strum="ukulele">▶</button></h3>${inst('ukulele')}</div>
        </div>
        <div class="card inst-card" style="margin-top:1rem"><h3>Pianoforte</h3>${pianoSVG({ from: 48, to: Math.max(71, midis[midis.length - 1]), marks })}</div>
        ${LEGEND}
        <h2>Intervalli e significato</h2>
        <div class="card tbl-wrap">
          <table>
            <tr><th>Nota</th><th>Intervallo dalla fondamentale</th><th>Semitoni</th><th>Ruolo nell’accordo</th></tr>
            ${notes.map((n, i) => `<tr><td><b>${noteName(n)}</b></td><td><span class="pill int-${intClass(c.ints[i])}">${intLabel(c.ints[i])}</span> ${INTERVALS[c.ints[i]].name}</td><td>${INTERVALS[c.ints[i]].semi}</td><td class="small">${INTERVAL_ROLE[c.ints[i]] || ''}</td></tr>`).join('')}
          </table>
        </div>
        <h3 style="margin-top:1rem">Come è costruito (intervalli tra note vicine)</h3>
        <div class="chips">${stack}</div>
        <p class="muted small" style="margin-top:.6rem">Gli accordi si costruiscono sovrapponendo terze: maggiore = 3M + 3m, minore = 3m + 3M, diminuito = 3m + 3m, aumentato = 3M + 3M.</p>`;

      $('#playChord', out).onclick = () => playChord(midis);
      $('#playArp', out).onclick = () => playSequence([...midis, midis[0] + 12], { gap: 0.3 });
      out.querySelectorAll('[data-strum]').forEach((b) => (b.onclick = () => {
        const vo = fretVoicings(b.dataset.strum, root, st.type)[vIdx[b.dataset.strum]];
        if (vo) playChord(vo.midis, { strum: 0.035, timbre: 'pluck', dur: 2.5 });
      }));
      out.querySelectorAll('[data-prev],[data-next]').forEach((b) => (b.onclick = () => {
        const k = b.dataset.prev || b.dataset.next;
        const len = fretVoicings(k, root, st.type).length;
        vIdx[k] = (vIdx[k] + (b.dataset.prev ? len - 1 : 1)) % len;
        draw();
        const vo = fretVoicings(k, root, st.type)[vIdx[k]];
        playChord(vo.midis, { strum: 0.035, timbre: 'pluck', dur: 2.5 });
      }));
    };

    $('#root', el).onchange = (e) => { st.root = e.target.value; vIdx.guitar = vIdx.ukulele = 0; draw(); };
    $('#type', el).onchange = (e) => { st.type = e.target.value; vIdx.guitar = vIdx.ukulele = 0; draw(); };
    el.addEventListener('segchange', (e) => { if (e.detail.name === 'label') { st.label = e.detail.value; draw(); } });
    bindPiano(out);
    draw();
  },
};
