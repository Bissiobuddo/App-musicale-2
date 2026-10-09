import { parseNote, noteName, transpose, rootMidi } from '../theory.js';
import { playNote, playChord } from '../audio.js';
import { $, store, rootOptions, segmented, pianoSVG, bindPiano, esc } from '../ui.js';

// semitoni, simbolo, nome, rapporto, consonanza, carattere, perché, esempi
const DATA = [
  [0, '1', 'Unisono', '1:1', 'Consonanza perfetta', 'Identità, fusione totale.', 'Stessa frequenza: le onde coincidono perfettamente.', '—'],
  [1, 'b2', 'Seconda minore', '16:15', 'Dissonanza', 'Tensione, inquietudine, attrito.', 'Frequenze vicinissime creano “battimenti” (vibrazione ruvida). È la distanza tra sensibile e tonica: vuole risolvere.', '“Lo squalo” (tema), “Für Elise” (Mi–Re♯)'],
  [2, '2', 'Seconda maggiore', '9:8', 'Dissonanza (lieve)', 'Movimento, passo naturale della melodia.', 'Rapporto ancora complesso, ma abbastanza largo da suonare morbido: è il “passo” base delle scale.', '“Fra Martino”, “Tanti auguri” (2ª nota)'],
  [3, 'b3', 'Terza minore', '6:5', 'Consonanza imperfetta', 'Malinconia, dolcezza, colore minore.', 'Rapporto semplice → consonante. Determina il carattere minore di accordi e scale.', '“Smoke on the Water”, “Greensleeves”'],
  [4, '3', 'Terza maggiore', '5:4', 'Consonanza imperfetta', 'Luminosità, gioia, colore maggiore.', 'È il 5° armonico naturale di una nota: per questo l’accordo maggiore suona “naturale”.', '“Oh When the Saints”, “Kumbaya”'],
  [5, '4', 'Quarta giusta', '4:3', 'Consonanza perfetta*', 'Apertura, solennità, attesa.', 'Rapporto molto semplice. È il rivolto della quinta. *Sopra il basso nella teoria classica è trattata come dissonanza.', '“Marcia nuziale” (Wagner), “Amazing Grace”'],
  [6, '#4', 'Tritono (4ª aum. / 5ª dim.)', '45:32', 'Dissonanza', 'Instabilità massima, mistero, “diabolus in musica”.', 'Divide l’ottava esattamente a metà: è simmetrico e instabile. Negli accordi di dominante (tra 3ª e ♭7) è il motore che spinge a risolvere sulla tonica.', '“Maria” (West Side Story), sigla dei Simpson'],
  [7, '5', 'Quinta giusta', '3:2', 'Consonanza perfetta', 'Stabilità, potenza, apertura.', 'Il rapporto più semplice dopo l’ottava: è il 3° armonico. Base del circolo delle quinte e dei power chord.', '“Star Wars” (tema), “Brilla brilla la stellina”'],
  [8, 'b6', 'Sesta minore', '8:5', 'Consonanza imperfetta', 'Struggente, drammatica, nostalgica.', 'Rivolto della terza maggiore. Tende a scendere sulla quinta.', '“The Entertainer” (Mi–Do), “Love Story”'],
  [9, '6', 'Sesta maggiore', '5:3', 'Consonanza imperfetta', 'Calda, aperta, affettuosa.', 'Rivolto della terza minore: rapporto semplice, molto cantabile.', '“My Bonnie”, “Dashing through the snow” (Jingle Bells)'],
  [10, 'b7', 'Settima minore', '16:9', 'Dissonanza', 'Tensione morbida, blues, attesa.', 'Rapporto complesso: crea una tensione che chiede di risolvere, ma in modo meno aspro della 7ª maggiore.', '“Star Trek” (tema originale), “Somewhere” (West Side Story)'],
  [11, '7', 'Settima maggiore', '15:8', 'Dissonanza', 'Tensione acuta, sognante se in accordo.', 'A un semitono dall’ottava: “vuole” salire. Nell’accordo maj7 diventa un colore elegante.', '“Take On Me” (ritornello), “Pure Imagination”'],
  [12, '8', 'Ottava', '2:1', 'Consonanza perfetta', 'Stessa nota, più acuta: completezza.', 'Frequenza doppia: le onde si sovrappongono perfettamente, per questo le diamo lo stesso nome.', '“Over the Rainbow”, “Singin’ in the Rain”'],
];

export default {
  id: 'intervalli',
  title: 'Intervalli',
  icon: '📏',
  desc: 'Tutti gli intervalli: semitoni, consonanza, carattere, perché suonano così e brani di esempio. Con quiz d’ascolto.',
  render(el) {
    const st = store('intervals', { root: 'C', sel: 4, mode: 'mel' });
    el.innerHTML = `
      <h1>Intervalli e perché</h1>
      <p class="muted">Un intervallo è la distanza tra due note, misurata in semitoni. Il suo “carattere” dipende da quanto è semplice il rapporto tra le frequenze: più è semplice, più l’intervallo suona consonante (stabile).</p>
      <div class="controls">
        <label class="field">Nota di partenza<select id="root">${rootOptions(st.root)}</select></label>
        <div class="field">Ascolto${segmented('mode', [['mel', 'Melodico ↑'], ['down', 'Melodico ↓'], ['harm', 'Armonico']], st.mode)}</div>
      </div>
      <div id="detail"></div>
      <h2>Tabella degli intervalli</h2>
      <div class="card tbl-wrap"><table id="tbl"></table></div>
      <h2>Quiz d’ascolto</h2>
      <div class="card" id="quiz"></div>
      <div class="info small"><b>Rivolto di un intervallo:</b> capovolgendo un intervallo (la nota grave va all’ottava sopra) la somma dei numeri fa sempre 9 e la qualità si inverte: 3M ↔ 6m, 2m ↔ 7M, 4G ↔ 5G, tritono ↔ tritono.</div>`;

    const play = (semi) => {
      const r = rootMidi(parseNote(st.root), 60);
      if (st.mode === 'harm') playChord([r, r + semi], { dur: 2 });
      else if (st.mode === 'down') { playNote(r + semi, { dur: 0.9 }); setTimeout(() => playNote(r, { dur: 1.2 }), 600); }
      else { playNote(r, { dur: 0.9 }); setTimeout(() => playNote(r + semi, { dur: 1.2 }), 600); }
    };

    const draw = () => {
      const root = parseNote(st.root);
      const r = rootMidi(root, 60);
      const d = DATA[st.sel];
      const top = transpose(root, d[1]);
      $('#detail', el).innerHTML = `<div class="card">
        <div class="row" style="justify-content:space-between">
          <div><div class="big-name">${esc(d[2])}</div><div class="muted">${d[0]} semitoni · rapporto ${d[3]} · ${d[4]}</div></div>
          <button class="btn primary big" id="playSel">▶ Ascolta</button>
        </div>
        <p class="notes-line">${noteName(root)} → ${noteName(top)}</p>
        ${pianoSVG({ from: r, to: r + 12, marks: new Map([[r, { label: noteName(root), cls: 'root' }], [r + d[0], { label: noteName(top), cls: 'tone' }]]), height: 100 })}
        <p><b>Carattere:</b> ${esc(d[5])}</p>
        <p><b>Perché:</b> ${esc(d[6])}</p>
        <p><b>Per ricordarlo:</b> ${esc(d[7])}</p>
      </div>`;
      $('#playSel', el).onclick = () => play(d[0]);
      $('#tbl', el).innerHTML = `<tr><th></th><th>Intervallo</th><th>St</th><th>Esempio</th><th>Tipo</th><th>Carattere</th></tr>` +
        DATA.map((x, i) => `<tr data-i="${i}" style="cursor:pointer;${i === st.sel ? 'background:var(--surface-2)' : ''}">
          <td><button class="btn" data-play="${x[0]}" aria-label="Ascolta">▶</button></td>
          <td><b>${esc(x[2])}</b></td><td>${x[0]}</td><td>${noteName(root)}–${noteName(transpose(root, x[1]))}</td>
          <td class="small">${esc(x[4])}</td><td class="small muted">${esc(x[5])}</td></tr>`).join('');
    };

    $('#tbl', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-play]');
      if (b) { play(+b.dataset.play); return; }
      const tr = e.target.closest('tr[data-i]');
      if (tr) { st.sel = +tr.dataset.i; draw(); play(DATA[st.sel][0]); $('#detail', el).scrollIntoView({ behavior: 'smooth' }); }
    });
    $('#root', el).onchange = (e) => { st.root = e.target.value; draw(); };
    el.addEventListener('segchange', (e) => { if (e.detail.name === 'mode') st.mode = e.detail.value; });
    bindPiano(el);
    draw();

    // ---------- Quiz ----------
    const q = { cur: null, ok: 0, tot: 0, answered: false, level: 'base' };
    const LEVELS = { base: [3, 4, 5, 7, 12], medio: [2, 3, 4, 5, 7, 9, 12], tutti: DATA.slice(1).map((x) => x[0]) };
    const quiz = $('#quiz', el);
    const newQ = () => {
      const pool = LEVELS[q.level];
      q.cur = { semi: pool[Math.floor(Math.random() * pool.length)], base: 55 + Math.floor(Math.random() * 12) };
      q.answered = false;
      drawQuiz();
      playQ();
    };
    const playQ = () => {
      if (!q.cur) return;
      playNote(q.cur.base, { dur: 0.9 });
      setTimeout(() => playNote(q.cur.base + q.cur.semi, { dur: 1.2 }), 650);
    };
    const drawQuiz = () => {
      const pool = LEVELS[q.level];
      quiz.innerHTML = `
        <div class="row" style="justify-content:space-between">
          ${segmented('qlevel', [['base', 'Base'], ['medio', 'Medio'], ['tutti', 'Tutti']], q.level)}
          <span>Punteggio: <b>${q.ok}/${q.tot}</b></span>
        </div>
        <div class="row" style="margin-top:.8rem">
          <button class="btn primary" id="qNew">${q.cur ? 'Nuova domanda' : '▶ Inizia'}</button>
          ${q.cur ? '<button class="btn" id="qRep">🔁 Riascolta</button>' : ''}
        </div>
        ${q.cur ? `<div class="quiz-answers">${pool.map((s) => `<button class="btn" data-ans="${s}">${esc(DATA[s][2])}</button>`).join('')}</div><p id="qMsg" class="small"></p>` : '<p class="muted small">Ascolta due note e indovina l’intervallo.</p>'}`;
      $('#qNew', quiz).onclick = newQ;
      if (q.cur) $('#qRep', quiz).onclick = playQ;
    };
    quiz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ans]');
      if (!b || q.answered) return;
      q.answered = true;
      q.tot++;
      const right = +b.dataset.ans === q.cur.semi;
      if (right) q.ok++;
      b.classList.add(right ? 'right' : 'wrong');
      quiz.querySelector(`[data-ans="${q.cur.semi}"]`).classList.add('right');
      $('#qMsg', quiz).textContent = right ? 'Giusto! 🎉' : `Era: ${DATA[q.cur.semi][2]} (${DATA[q.cur.semi][7]})`;
      quiz.querySelector('.row span b').textContent = `${q.ok}/${q.tot}`;
    });
    quiz.addEventListener('segchange', (e) => { if (e.detail.name === 'qlevel') { q.level = e.detail.value; q.cur = null; drawQuiz(); } });
    drawQuiz();
  },
};
