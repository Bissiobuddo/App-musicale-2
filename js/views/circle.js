import {
  CIRCLE, parseNote, noteName, keySignature, scaleNotes, diatonicChords, chordSymbol, chordMidis, FUNCTION_NAMES, transpose,
} from '../theory.js';
import { playChord } from '../audio.js';
import { $, store, esc } from '../ui.js';

const CX = 200, CY = 200;
const R_OUT = 192, R_MID = 132, R_IN = 82;

function arc(r1, r2, a1, a2) {
  const p = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  const [x1, y1] = p(r2, a1), [x2, y2] = p(r2, a2), [x3, y3] = p(r1, a2), [x4, y4] = p(r1, a1);
  return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`;
}
const accText = (a) => (a === 0 ? '' : a > 0 ? `${a}♯` : `${-a}♭`);

export default {
  id: 'circolo',
  title: 'Circolo delle quinte',
  icon: '⭕',
  desc: 'Circolo interattivo: armature, tonalità relative, accordi della tonalità e funzioni.',
  render(el) {
    const st = store('circle', { i: 0, minor: false, enh: false });
    el.innerHTML = `
      <h1>Circolo delle quinte</h1>
      <p class="muted">In senso orario ogni tonalità è una quinta sopra la precedente e aggiunge un ♯; in senso antiorario (per quarte) aggiunge un ♭. Anello esterno: tonalità maggiori; interno: le relative minori (stesse note).</p>
      <div class="grid grid-2" style="align-items:start">
        <div class="circle-wrap" id="svgWrap"></div>
        <div id="info"></div>
      </div>
      <div class="info small">
        <b>Come usarlo:</b> le 6 caselle evidenziate attorno alla tonalità scelta (3 maggiori + 3 minori) sono gli accordi principali della tonalità: <b>IV – I – V</b> fuori, <b>ii – vi – iii</b> dentro. Accordi vicini sul cerchio “suonano bene” insieme. Muoversi in senso antiorario (V → I) è il movimento più forte dell’armonia tonale.
      </div>`;

    const draw = () => {
      const k = CIRCLE[st.i];
      const useEnh = st.enh && k.enh;
      const key = useEnh ? k.enh : k;
      const tonic = parseNote(st.minor ? key.min : key.maj);
      const scaleType = st.minor ? 'minor' : 'major';
      const step = 2 * Math.PI / 12;

      // caselle diatoniche: maggiori i-1,i,i+1 ; minori i-1,i,i+1
      const near = (j) => [(st.i + 11) % 12, st.i, (st.i + 1) % 12].includes(j);
      let svg = '';
      CIRCLE.forEach((c, j) => {
        const a1 = -Math.PI / 2 + (j - 0.5) * step, a2 = a1 + step, am = (a1 + a2) / 2;
        const selMaj = !st.minor && j === st.i, selMin = st.minor && j === st.i;
        const mx = CX + ((R_OUT + R_MID) / 2) * Math.cos(am), my = CY + ((R_OUT + R_MID) / 2) * Math.sin(am);
        const nx = CX + ((R_MID + R_IN) / 2) * Math.cos(am), ny = CY + ((R_MID + R_IN) / 2) * Math.sin(am);
        const ax = CX + (R_OUT - 11) * Math.cos(am), ay = CY + (R_OUT - 11) * Math.sin(am);
        const majName = noteName(parseNote(c.maj)) + (c.enh ? '/' + noteName(parseNote(c.enh.maj)) : '');
        const minName = noteName(parseNote(c.min)) + 'm';
        svg += `<path d="${arc(R_MID, R_OUT, a1, a2)}" class="seg-maj ${selMaj ? 'sel' : near(j) ? 'diat' : ''}" data-j="${j}" data-m="0"/>`;
        svg += `<path d="${arc(R_IN, R_MID, a1, a2)}" class="seg-min ${selMin ? 'sel' : near(j) ? 'diat' : ''}" data-j="${j}" data-m="1"/>`;
        svg += `<text x="${mx}" y="${my + 6}" class="lbl ${selMaj ? 'on' : ''}" style="font-size:${majName.length > 5 ? 11 : 16}px">${esc(majName)}</text>`;
        svg += `<text x="${nx}" y="${ny + 5}" class="lbl ${selMin ? 'on' : ''}" style="font-size:${minName.length > 5 ? 10 : 13}px">${esc(minName)}</text>`;
        svg += `<text x="${ax}" y="${ay + 3}" class="acc">${accText(c.acc)}</text>`;
      });
      const sig = keySignature(key.acc);
      svg += `<circle cx="${CX}" cy="${CY}" r="${R_IN - 2}" class="center"/>`;
      svg += `<text x="${CX}" y="${CY - 6}" class="lbl" style="font-size:18px">${noteName(tonic)}${st.minor ? 'm' : ''}</text>`;
      svg += `<text x="${CX}" y="${CY + 16}" class="acc" style="font-size:13px">${sig.length ? accText(key.acc) : 'nessuna alterazione'}</text>`;
      $('#svgWrap', el).innerHTML = `<svg class="circle" viewBox="0 0 400 400">${svg}</svg>`;

      const dia = diatonicChords(tonic, scaleType);
      const rel = st.minor ? transpose(tonic, 'b3') : transpose(tonic, '6');
      const dom = dia[4], sub = dia[3];
      $('#info', el).innerHTML = `<div class="card">
        <div class="big-name">${noteName(tonic)} ${st.minor ? 'minore' : 'maggiore'}</div>
        ${k.enh ? `<button class="btn" id="enh" style="margin:.4rem 0">⇄ Enarmonica: ${noteName(parseNote(useEnh ? k[st.minor ? 'min' : 'maj'] : k.enh[st.minor ? 'min' : 'maj']))}</button>` : ''}
        <p><b>Armatura:</b> ${sig.length ? `${accText(key.acc)} — ${sig.map(noteName).join(', ')}` : 'nessun ♯ o ♭'}</p>
        <p><b>Scala:</b> ${scaleNotes(tonic, scaleType).map(noteName).join(' – ')}</p>
        <p><b>Relativa ${st.minor ? 'maggiore' : 'minore'}:</b> ${noteName(rel)}${st.minor ? '' : 'm'} (stesse note, stessa armatura)</p>
        <p><b>Dominante (V):</b> ${chordSymbol(dom.root, dom.type)} · <b>Sottodominante (IV):</b> ${chordSymbol(sub.root, sub.type)}</p>
        <h3 style="margin-top:1rem">Accordi della tonalità</h3>
        <div class="row">${dia.map((c, j) => `<button class="btn deg-btn" data-ch="${j}"><b class="fn-${c.fn}">${c.roman}</b>${chordSymbol(c.root, c.type)}<span>${FUNCTION_NAMES[c.fn]}</span></button>`).join('')}</div>
        <p class="small muted" style="margin-top:.6rem">Ordine dei diesis: Fa Do Sol Re La Mi Si · Ordine dei bemolle: Si Mi La Re Sol Do Fa (al contrario).</p>
      </div>`;
      $('#info', el).querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => {
        const c = dia[+b.dataset.ch];
        playChord(chordMidis(c.root, c.type, 48));
      }));
      const eb = $('#enh', el);
      if (eb) eb.onclick = () => { st.enh = !st.enh; draw(); };
    };

    $('#svgWrap', el).addEventListener('click', (e) => {
      const p = e.target.closest('path[data-j]');
      if (!p) return;
      st.i = +p.dataset.j;
      st.minor = p.dataset.m === '1';
      st.enh = false;
      draw();
      const k = CIRCLE[st.i];
      const t = parseNote(st.minor ? k.min : k.maj);
      playChord(chordMidis(t, st.minor ? 'm' : 'maj', 48));
    });
    draw();
  },
};
