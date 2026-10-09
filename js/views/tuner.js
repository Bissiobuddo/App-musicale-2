import { pcName } from '../theory.js';
import { ac, tone, midiToFreq } from '../audio.js';
import { $, store, segmented } from '../ui.js';

const INSTRUMENTS = {
  guitar: { name: 'Chitarra', strings: [40, 45, 50, 55, 59, 64] },
  ukulele: { name: 'Ukulele', strings: [67, 60, 64, 69] },
  bass: { name: 'Basso', strings: [28, 33, 38, 43] },
  chromatic: { name: 'Cromatico', strings: [] },
};

// Rilevamento dell'altezza per autocorrelazione
function detectPitch(buf, sr) {
  let size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;
  let r1 = 0, r2 = size - 1;
  const th = 0.2;
  for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]) < th) { r1 = i; break; }
  for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]) < th) { r2 = size - i; break; }
  buf = buf.slice(r1, r2);
  size = buf.length;
  const maxLag = Math.min(size, Math.floor(sr / 35));
  const c = new Float32Array(maxLag);
  for (let lag = 0; lag < maxLag; lag++) {
    let s = 0;
    for (let j = 0; j < size - lag; j++) s += buf[j] * buf[j + lag];
    c[lag] = s;
  }
  let d = 0;
  while (d < maxLag - 1 && c[d] > c[d + 1]) d++;
  let maxv = -1, maxp = -1;
  for (let i = d; i < maxLag; i++) if (c[i] > maxv) { maxv = c[i]; maxp = i; }
  if (maxp <= 0 || maxp >= maxLag - 1) return -1;
  const x1 = c[maxp - 1], x2 = c[maxp], x3 = c[maxp + 1];
  const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
  const t0 = a ? maxp - b / (2 * a) : maxp;
  return sr / t0;
}

export default {
  id: 'accordatore',
  title: 'Accordatore',
  icon: '🎙️',
  desc: 'Accordatore cromatico con microfono per chitarra, ukulele e basso, più note di riferimento.',
  render(el) {
    const st = store('tuner', { inst: 'guitar', a4: 440 });
    let stream = null, raf = 0, analyser = null, buf = null, smooth = null, frame = 0;

    el.innerHTML = `
      <h1>Accordatore</h1>
      <p class="muted">Consenti l’accesso al microfono e suona una corda alla volta. L’ago al centro (verde) indica che la nota è intonata.</p>
      <div class="controls">
        <div class="field">Strumento${segmented('inst', Object.entries(INSTRUMENTS).map(([k, v]) => [k, v.name]), st.inst)}</div>
        <label class="field">La₄ di riferimento (Hz)<input type="number" id="a4" min="415" max="466" value="${st.a4}" style="width:100px"></label>
      </div>
      <div class="card tuner-display">
        <div class="tuner-note" id="tNote">—</div>
        <div class="tuner-freq" id="tFreq">&nbsp;</div>
        <svg class="gauge" viewBox="0 0 300 170">
          <defs><linearGradient id="gaugeGrad" x1="0" x2="1"><stop offset="0" stop-color="#ff2d95"/><stop offset=".35" stop-color="#9b5cff"/><stop offset=".5" stop-color="#39ff9f"/><stop offset=".65" stop-color="#9b5cff"/><stop offset="1" stop-color="#ff2d95"/></linearGradient></defs>
          <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="url(#gaugeGrad)" stroke-width="10" stroke-linecap="round" class="gauge-arc"/>
          <path d="M 131.2 31.5 A 120 120 0 0 1 168.8 31.5" class="zone"/>
          ${[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((c) => {
            const a = (c / 50) * (Math.PI / 2) - Math.PI / 2;
            const r1 = c % 50 === 0 || c === 0 ? 100 : 108;
            return `<line class="tick" x1="${150 + r1 * Math.cos(a)}" y1="${150 + r1 * Math.sin(a)}" x2="${150 + 116 * Math.cos(a)}" y2="${150 + 116 * Math.sin(a)}"/>`;
          }).join('')}
          <text x="30" y="168" fill="var(--muted)" font-size="11">−50</text><text x="270" y="168" fill="var(--muted)" font-size="11">+50</text>
          <line class="needle" id="needle" x1="150" y1="150" x2="150" y2="40"/>
          <circle cx="150" cy="150" r="8" class="hub"/>
        </svg>
        <div class="tuner-status" id="tStatus">Premi “Avvia” per iniziare</div>
        <button class="btn primary big" id="micBtn" style="margin-top:1rem">🎙️ Avvia</button>
      </div>
      <h2>Note di riferimento</h2>
      <p class="muted small">Tocca una corda per sentire la nota giusta e accordare a orecchio.</p>
      <div class="row string-btns" id="strings"></div>
      <div class="info small">L’accordatore funziona solo su connessione sicura (https) o in locale. Su Android consenti l’uso del microfono quando il browser lo chiede.</div>`;

    const drawStrings = () => {
      const s = INSTRUMENTS[st.inst].strings;
      $('#strings', el).innerHTML = s.length
        ? s.map((m, i) => `<button class="btn" data-m="${m}">${i + 1}ª ${pcName(m)}<sub>${Math.floor(m / 12) - 1}</sub></button>`).join('')
        : [57, 60, 64, 67, 69].map((m) => `<button class="btn" data-m="${m}">${pcName(m)}<sub>${Math.floor(m / 12) - 1}</sub></button>`).join('');
    };

    const update = (freq) => {
      const note = $('#tNote', el), status = $('#tStatus', el), needle = $('#needle', el);
      if (freq <= 0) return;
      smooth = smooth ? smooth * 0.75 + freq * 0.25 : freq;
      if (Math.abs(freq - smooth) / smooth > 0.06) smooth = freq;
      const f = smooth;
      const midiF = 69 + 12 * Math.log2(f / st.a4);
      let target = Math.round(midiF);
      const strs = INSTRUMENTS[st.inst].strings;
      if (strs.length) {
        const best = strs.reduce((b, m) => (Math.abs(m - midiF) < Math.abs(b - midiF) ? m : b), strs[0]);
        if (Math.abs(best - midiF) < 2.5) target = best;
      }
      const cents = Math.max(-50, Math.min(50, (midiF - target) * 100));
      note.innerHTML = `${pcName(target)}<sub>${Math.floor(target / 12) - 1}</sub>`;
      $('#tFreq', el).textContent = `${f.toFixed(1)} Hz · obiettivo ${midiToFreq(target, st.a4).toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents.toFixed(0)} cent`;
      needle.style.transform = `rotate(${(cents / 50) * 90}deg)`;
      const ok = Math.abs(cents) < 5;
      status.className = 'tuner-status ' + (ok ? 'ok' : cents < 0 ? 'low' : 'high');
      status.textContent = ok ? '✓ Intonato' : cents < 0 ? '↑ Troppo basso: tendi la corda' : '↓ Troppo alto: allenta la corda';
      el.querySelectorAll('#strings .btn').forEach((b) => b.classList.toggle('target', +b.dataset.m === target));
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (++frame % 3) return;
      analyser.getFloatTimeDomainData(buf);
      const f = detectPitch(buf, ac().sampleRate);
      if (f > 25 && f < 2000) update(f);
    };

    const stopMic = () => {
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      const b = $('#micBtn', el);
      if (b) b.textContent = '🎙️ Avvia';
    };

    $('#micBtn', el).onclick = async () => {
      if (stream) { stopMic(); $('#tStatus', el).textContent = 'In pausa'; return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        const c = ac();
        const src = c.createMediaStreamSource(stream);
        analyser = c.createAnalyser();
        analyser.fftSize = 4096;
        buf = new Float32Array(analyser.fftSize);
        src.connect(analyser);
        $('#micBtn', el).textContent = '⏸ Ferma';
        $('#tStatus', el).textContent = 'In ascolto… suona una nota';
        loop();
      } catch (err) {
        $('#tStatus', el).textContent = 'Microfono non disponibile: ' + (err.message || err.name);
        stream = null;
      }
    };
    $('#strings', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (b) tone(midiToFreq(+b.dataset.m, st.a4), 2.5);
    });
    $('#a4', el).onchange = (e) => { st.a4 = Math.max(415, Math.min(466, +e.target.value || 440)); e.target.value = st.a4; };
    el.addEventListener('segchange', (e) => { if (e.detail.name === 'inst') { st.inst = e.detail.value; drawStrings(); } });
    drawStrings();
    return stopMic;
  },
};
