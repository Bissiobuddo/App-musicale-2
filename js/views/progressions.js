import {
  CHORDS, parseNote, noteName, pc, scaleNotes, diatonicChords, chordNotes, chordSymbol, chordMidis, roman,
  FUNCTION_NAMES, intervalBetween,
} from '../theory.js';
import { ac, createGroup, playChord, playNote } from '../audio.js';
import { $, store, rootOptions, segmented, pianoSVG, bindPiano, intLabel, intClass, esc } from '../ui.js';
import { closest } from './inversions.js';

// passi: d = grado (0-6), o = tipo forzato per triadi, o7 = per quadriadi
const P = (d, o, o7) => ({ d, o, o7 });
const PRESETS = {
  major: [
    ['Pop (I–V–vi–IV)', [P(0), P(4), P(5), P(3)]],
    ['Anni ’50 (I–vi–IV–V)', [P(0), P(5), P(3), P(4)]],
    ['Classico (I–IV–V–I)', [P(0), P(3), P(4), P(0)]],
    ['Jazz ii–V–I', [P(1), P(4), P(0), P(0)]],
    ['Malinconico (vi–IV–I–V)', [P(5), P(3), P(0), P(4)]],
    ['Canone di Pachelbel', [P(0), P(4), P(5), P(2), P(3), P(0), P(3), P(4)]],
    ['Turnaround (I–vi–ii–V)', [P(0), P(5), P(1), P(4)]],
    ['Blues 12 battute', [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4].map((d) => P(d, 'dom7', 'dom7'))],
  ],
  minor: [
    ['Minore classico (i–iv–V–i)', [P(0), P(3), P(4, 'maj', 'dom7'), P(0)]],
    ['Epico (i–VI–III–VII)', [P(0), P(5), P(2), P(6)]],
    ['Cadenza andalusa (i–VII–VI–V)', [P(0), P(6), P(5), P(4, 'maj', 'dom7')]],
    ['Rock minore (i–VII–VI–VII)', [P(0), P(6), P(5), P(6)]],
    ['ii–V–i minore', [P(1), P(4, 'maj', 'dom7'), P(0), P(0)]],
    ['Ballad (i–VI–iv–V)', [P(0), P(5), P(3), P(4, 'maj', 'dom7')]],
  ],
};

const RHYTHMS = {
  4: [[1, 1, 1, 1], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 1, 1], [2, 1, 1], [1, 1, 2], [0.5, 0.5, 0.5, 0.5, 2], [1.5, 0.5, 1, 1]],
  2: [[1, 1], [0.5, 0.5, 1], [2], [1, 0.5, 0.5]],
  3: [[1, 1, 1], [2, 1], [1, 0.5, 0.5, 1]],
};
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export default {
  id: 'giri',
  title: 'Giri d’accordi',
  icon: '🔁',
  desc: 'Crea e ascolta giri con triadi o quadriadi, scopri le note per costruire melodie e generane una.',
  render(el) {
    const st = store('progressions', { root: 'C', mode: 'major', quad: 0, bpm: 90, beats: 4, loop: true, melody: true, prog: PRESETS.major[0][1] });
    let melody = null;
    let sel = 0;
    let playing = false, timer = null, group = null, nextIdx = 0, nextTime = 0, timeouts = [];

    el.innerHTML = `
      <h1>Giri d’accordi</h1>
      <p class="muted">Un giro è una sequenza di accordi della tonalità. Ogni accordo ti offre delle note “sicure” (quelle dell’accordo) su cui costruire la melodia: con le triadi ne hai 3, con le quadriadi 4.</p>
      <div class="controls">
        <label class="field">Tonalità<select id="root">${rootOptions(st.root)}</select></label>
        <div class="field">Modo${segmented('mode', [['major', 'Maggiore'], ['minor', 'Minore']], st.mode)}</div>
        <div class="field">Accordi${segmented('quad', [[0, 'Triadi'], [1, 'Quadriadi']], st.quad)}</div>
        <label class="field">Giri pronti<select id="preset"></select></label>
      </div>
      <h2>Accordi della tonalità</h2>
      <p class="muted small">Tocca un accordo per ascoltarlo e aggiungerlo al giro. Colori: <span class="fn-T">Tonica</span> (riposo), <span class="fn-S">Sottodominante</span> (movimento), <span class="fn-D">Dominante</span> (tensione).</p>
      <div class="row" id="palette"></div>
      <h2>Il tuo giro</h2>
      <div class="card">
        <div class="prog" id="prog"></div>
        <div class="controls" style="margin-bottom:0">
          <button class="btn primary big" id="play">▶ Suona</button>
          <label class="field" style="min-width:160px"><span>Tempo: <b id="bpmV">${st.bpm}</b> BPM</span><input type="range" id="bpm" min="40" max="200" value="${st.bpm}"></label>
          <div class="field">Battiti per accordo${segmented('beats', [[2, '2'], [3, '3'], [4, '4']], st.beats)}</div>
          <label class="row small"><input type="checkbox" id="loop" ${st.loop ? 'checked' : ''}> Ripeti</label>
          <button class="btn" id="clear">Svuota</button>
        </div>
      </div>
      <h2>Costruire la melodia</h2>
      <div class="card" id="analysis"></div>
      <div class="card" style="margin-top:1rem">
        <div class="row" style="justify-content:space-between">
          <h3>Melodia generata</h3>
          <div class="row"><button class="btn primary" id="gen">🎲 Genera melodia</button>
          <label class="row small"><input type="checkbox" id="melOn" ${st.melody ? 'checked' : ''}> Suona con il giro</label></div>
        </div>
        <div id="melody"><p class="muted small">Genera una melodia: sui tempi forti usa le note dell’accordo, sui deboli note di passaggio della scala.</p></div>
      </div>
      <div class="info small">
        <b>Come creare melodie sui giri</b>
        <ol style="margin:.4rem 0 0;padding-left:1.2rem">
          <li><b>Arpeggia</b>: suona le note dell’accordo una alla volta. È già una melodia che “sta bene” al 100%.</li>
          <li><b>Tempi forti = note dell’accordo</b> (1 e 3 della battuta): danno stabilità.</li>
          <li><b>Tempi deboli = note di passaggio</b>: collega due note dell’accordo muovendoti per grado nella scala.</li>
          <li><b>Note in comune</b> tra due accordi: tenerle durante il cambio lega le frasi.</li>
          <li><b>Quadriadi</b>: la 7ª è una nota “sicura” in più, con più colore (es. la 7ª maggiore suona sognante).</li>
          <li><b>Chiudi</b> sulla tonica o sulla terza dell’ultimo accordo per un senso di conclusione.</li>
        </ol>
      </div>`;

    const keyScale = () => (st.mode === 'major' ? 'major' : 'minor');
    const keyRoot = () => parseNote(st.root);
    const dia = () => diatonicChords(keyRoot(), keyScale(), !!st.quad);

    const resolve = (step) => {
      const dc = dia()[step.d];
      let type = dc.type;
      if (st.quad && step.o7) type = step.o7;
      else if (!st.quad && step.o) type = step.o;
      return { root: dc.root, type, deg: step.d, roman: roman(step.d, type), fn: dc.fn, notes: chordNotes(dc.root, type) };
    };
    const progChords = () => st.prog.map(resolve);

    // voicing con condotta delle parti per la riproduzione
    const voicings = (chords) => {
      let prev = null;
      return chords.map((c) => {
        const m = chordMidis(c.root, c.type, 48);
        const v = prev ? closest(prev, m.slice(0, 4)).m : m;
        prev = v;
        return v;
      });
    };

    const drawPresets = () => {
      $('#preset', el).innerHTML = `<option value="">— scegli —</option>` + PRESETS[st.mode].map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join('');
    };

    const drawPalette = () => {
      const chords = dia();
      let html = chords.map((c, i) => `<button class="btn deg-btn" data-add="${i}"><b class="fn-${c.fn}">${c.roman}</b>${chordSymbol(c.root, c.type)}<span>${FUNCTION_NAMES[c.fn]}</span></button>`).join('');
      if (st.mode === 'minor') {
        const t = st.quad ? 'dom7' : 'maj';
        html += `<button class="btn deg-btn" data-add="4|${t}"><b class="fn-D">${roman(4, t)}</b>${chordSymbol(chords[4].root, t)}<span>Dominante (armonica)</span></button>`;
      }
      $('#palette', el).innerHTML = html;
    };

    const drawProg = () => {
      const chords = progChords();
      $('#prog', el).innerHTML = chords.length
        ? chords.map((c, i) => `<div class="prog-chord ${i === sel ? 'now' : ''}" data-i="${i}"><button class="x" data-del="${i}" aria-label="Rimuovi">×</button><b>${chordSymbol(c.root, c.type)}</b><small class="fn-${c.fn}">${c.roman}</small></div>`).join('')
        : '<p class="muted">Il giro è vuoto: aggiungi accordi dalla tavolozza o scegli un giro pronto.</p>';
    };

    const drawAnalysis = () => {
      const chords = progChords();
      const box = $('#analysis', el);
      if (!chords.length) { box.innerHTML = '<p class="muted">Aggiungi degli accordi per vedere le note da usare nella melodia.</p>'; return; }
      sel = Math.min(sel, chords.length - 1);
      const c = chords[sel];
      const next = chords[(sel + 1) % chords.length];
      const ints = CHORDS[c.type].ints;
      const tonesPc = c.notes.map(pc);
      const scale = scaleNotes(keyRoot(), keyScale()).filter((n) => !tonesPc.includes(pc(n)) && !c.notes.some((t) => t.letter === n.letter));
      const common = c.notes.filter((n) => next.notes.some((x) => pc(x) === pc(n)));
      const marks = new Map();
      for (let m = 60; m <= 84; m++) {
        const k = tonesPc.indexOf(m % 12);
        if (k >= 0) marks.set(m, { label: noteName(c.notes[k]), cls: intClass(ints[k]) });
        else {
          const s = scale.find((n) => pc(n) === m % 12);
          if (s) marks.set(m, { label: noteName(s), cls: 'soft' });
        }
      }
      box.innerHTML = `
        <div class="row" style="justify-content:space-between">
          <div><span class="muted small">Accordo ${sel + 1} di ${chords.length}</span><div class="big-name">${chordSymbol(c.root, c.type)} <small class="fn-${c.fn}" style="font-size:1rem">${c.roman} · ${FUNCTION_NAMES[c.fn]}</small></div></div>
          <div class="row"><button class="btn" id="aPrev">◀</button><button class="btn" id="aArp">▶ Arpeggio</button><button class="btn" id="aNext">▶▶</button></div>
        </div>
        <p><b>Note dell’accordo (sicure, per i tempi forti):</b> ${c.notes.map((n, k) => `<span class="pill int-${intClass(ints[k])}">${noteName(n)} <small>${intLabel(ints[k])}</small></span>`).join(' ')}</p>
        <p><b>Note di passaggio (scala, per i tempi deboli):</b> ${scale.map((n) => `<span class="pill">${noteName(n)}</span>`).join(' ')}</p>
        <p><b>Note in comune con ${chordSymbol(next.root, next.type)}:</b> ${common.length ? common.map((n) => `<span class="pill tone">${noteName(n)}</span>`).join(' ') : '<span class="muted">nessuna — muoviti per grado verso una nota del prossimo accordo</span>'}</p>
        ${pianoSVG({ from: 60, to: 84, marks, height: 100 })}
        <p class="small muted">Puntini colorati = note dell’accordo · grigi = altre note della scala. Tocca i tasti per provare.</p>
        <details style="margin-top:.6rem"><summary>Tabella di tutto il giro</summary>
          <div class="tbl-wrap"><table>
            <tr><th>#</th><th>Accordo</th><th>Note</th><th>Struttura</th></tr>
            ${chords.map((x, i) => `<tr><td>${i + 1}</td><td><b>${chordSymbol(x.root, x.type)}</b> <span class="small muted">${x.roman}</span></td><td>${x.notes.map(noteName).join(' ')}</td>
              <td class="small">${x.notes.slice(1).map((n, k) => intervalBetween(x.notes[k], n).name.toLowerCase()).join(' + ')}</td></tr>`).join('')}
          </table></div>
        </details>`;
      $('#aPrev', box).onclick = () => { sel = (sel - 1 + chords.length) % chords.length; drawProg(); drawAnalysis(); };
      $('#aNext', box).onclick = () => { sel = (sel + 1) % chords.length; drawProg(); drawAnalysis(); };
      $('#aArp', box).onclick = () => {
        const m = chordMidis(c.root, c.type, 60);
        const t0 = ac().currentTime + 0.02;
        [...m, m[0] + 12].forEach((x, i) => playNote(x, { time: t0 + i * 0.25, dur: 0.8 }));
      };
    };

    // ---------- Melodia ----------
    const generate = () => {
      const chords = progChords();
      if (!chords.length) return;
      const keyPcs = scaleNotes(keyRoot(), keyScale()).map(pc);
      let prev = null;
      melody = chords.map((c, ci) => {
        const tones = c.notes.map(pc);
        // la scala si adatta alle alterazioni dell'accordo (es. sensibile nel V del minore)
        const altered = tones.filter((t) => !keyPcs.includes(t));
        const scalePcs = keyPcs.filter((p) => !altered.some((t) => Math.abs(t - p) === 1 || Math.abs(t - p) === 11)).concat(altered);
        const pool = []; const chordPool = [];
        for (let m = 62; m <= 81; m++) {
          if (scalePcs.includes(m % 12)) pool.push(m);
          if (tones.includes(m % 12)) chordPool.push(m);
        }
        const pattern = rnd(RHYTHMS[st.beats]);
        let t = 0;
        return pattern.map((dur, k) => {
          const last = ci === chords.length - 1 && k === pattern.length - 1;
          const strong = Number.isInteger(t) && t % 2 === 0;
          let m;
          if (last) {
            const finals = chordPool.filter((x) => x % 12 === tones[0]);
            m = finals.sort((a, b) => Math.abs(a - (prev ?? 72)) - Math.abs(b - (prev ?? 72)))[0];
          } else if (prev === null || strong) {
            const ref = prev ?? 69 + Math.floor(Math.random() * 5);
            const near = chordPool.slice().sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref)).slice(0, 3);
            m = rnd(near);
          } else {
            let idx = pool.reduce((bi, x, i) => (Math.abs(x - prev) < Math.abs(pool[bi] - prev) ? i : bi), 0);
            const dir = prev > 76 ? -1 : prev < 66 ? 1 : rnd([-1, 1]);
            idx = Math.max(0, Math.min(pool.length - 1, idx + dir * rnd([1, 1, 1, 2])));
            m = pool[idx];
          }
          prev = m;
          const note = { midi: m, t, dur, ct: tones.includes(m % 12) };
          t += dur;
          return note;
        });
      });
      drawMelody();
    };

    const spell = (midi, chord) => {
      const p = midi % 12;
      return chord.notes.find((n) => pc(n) === p) || scaleNotes(keyRoot(), keyScale()).find((n) => pc(n) === p);
    };

    const drawMelody = () => {
      const box = $('#melody', el);
      const chords = progChords();
      if (!melody || melody.length !== chords.length) { box.innerHTML = '<p class="muted small">Genera una melodia per vederla qui.</p>'; return; }
      box.innerHTML = `<div class="melody">${melody.map((bar, i) => `<div class="mel-bar"><b>${chordSymbol(chords[i].root, chords[i].type)}</b><br>${bar.map((n) => {
        const s = spell(n.midi, chords[i]);
        return `<span class="${n.ct ? 'ct' : 'pt'}">${s ? noteName(s) : n.midi}</span>`;
      }).join(' ')}</div>`).join('')}</div>
      <p class="small muted" style="margin-top:.5rem"><span class="ct" style="color:var(--yellow);font-weight:700">Giallo</span> = nota dell’accordo · grigio = nota di passaggio. Premi ▶ Suona per ascoltarla sopra il giro.</p>`;
    };

    // ---------- Riproduzione ----------
    const highlight = (i) => {
      sel = i;
      drawProg();
      drawAnalysis();
    };
    const tick = () => {
      const c = ac();
      const chords = progChords();
      if (!chords.length) { stop(); return; }
      const vs = voicings(chords);
      const beat = 60 / st.bpm;
      const bar = beat * st.beats;
      while (nextTime < c.currentTime + (document.hidden ? 1.6 : 0.25)) {
        if (nextIdx >= chords.length) {
          if (!st.loop) { const end = (nextTime - c.currentTime) * 1000; timeouts.push(setTimeout(stop, end)); clearInterval(timer); timer = null; return; }
          nextIdx = 0;
        }
        const i = nextIdx;
        const ch = chords[i];
        playChord(vs[i], { time: nextTime, dur: bar * 0.98, dest: group.node, vel: 0.45 });
        playNote(36 + pc(ch.root), { time: nextTime, dur: bar * 0.98, vel: 0.35, dest: group.node, timbre: 'pluck' });
        if (st.melody && melody && melody.length === chords.length) {
          for (const n of melody[i]) playNote(n.midi, { time: nextTime + n.t * beat, dur: n.dur * beat * 1.1 + 0.2, vel: 0.42, dest: group.node, timbre: 'pluck' });
        }
        timeouts.push(setTimeout(() => playing && highlight(i), Math.max(0, (nextTime - c.currentTime) * 1000)));
        nextIdx++;
        nextTime += bar;
      }
    };
    const start = () => {
      if (!st.prog.length) return;
      group = createGroup();
      playing = true;
      nextIdx = 0;
      nextTime = ac().currentTime + 0.1;
      $('#play', el).textContent = '■ Stop';
      tick();
      timer = setInterval(tick, 60);
    };
    function stop() {
      playing = false;
      clearInterval(timer);
      timer = null;
      timeouts.forEach(clearTimeout);
      timeouts = [];
      if (group) group.stop();
      group = null;
      const b = $('#play', el);
      if (b) b.textContent = '▶ Suona';
    }

    const redrawAll = () => { drawPresets(); drawPalette(); drawProg(); drawAnalysis(); drawMelody(); };
    const changed = () => { melody = null; if (playing) stop(); redrawAll(); };

    $('#root', el).onchange = (e) => { st.root = e.target.value; changed(); };
    $('#preset', el).onchange = (e) => {
      if (e.target.value === '') return;
      st.prog = PRESETS[st.mode][+e.target.value][1];
      sel = 0;
      changed();
    };
    el.addEventListener('segchange', (e) => {
      const { name, value } = e.detail;
      if (name === 'mode') { st.mode = value; st.prog = PRESETS[value][0][1]; sel = 0; changed(); }
      if (name === 'quad') { st.quad = +value; if (playing) stop(); redrawAll(); }
      if (name === 'beats') { st.beats = +value; melody = null; drawMelody(); }
    });
    $('#palette', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      const [d, o] = b.dataset.add.split('|');
      const step = o ? P(+d, st.quad ? 'maj' : o, st.quad ? o : 'dom7') : P(+d);
      const c = resolve(step);
      playChord(chordMidis(c.root, c.type, 48));
      st.prog = [...st.prog, step];
      sel = st.prog.length - 1;
      melody = null;
      drawProg(); drawAnalysis(); drawMelody();
    });
    $('#prog', el).addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) {
        st.prog = st.prog.filter((_, i) => i !== +del.dataset.del);
        melody = null;
        if (playing) stop();
        drawProg(); drawAnalysis(); drawMelody();
        return;
      }
      const card = e.target.closest('[data-i]');
      if (card) {
        sel = +card.dataset.i;
        const c = progChords()[sel];
        playChord(chordMidis(c.root, c.type, 48));
        drawProg(); drawAnalysis();
      }
    });
    $('#play', el).onclick = () => (playing ? stop() : start());
    $('#bpm', el).oninput = (e) => { st.bpm = +e.target.value; $('#bpmV', el).textContent = st.bpm; };
    $('#loop', el).onchange = (e) => { st.loop = e.target.checked; };
    $('#melOn', el).onchange = (e) => { st.melody = e.target.checked; };
    $('#clear', el).onclick = () => { st.prog = []; changed(); };
    $('#gen', el).onclick = () => { generate(); if (!playing) start(); };
    bindPiano($('#analysis', el));
    redrawAll();
    return stop;
  },
};
