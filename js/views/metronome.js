import { ac, click, createGroup } from '../audio.js';
import { $, $$, store, segmented } from '../ui.js';

const TEMPI = [[60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [999, 'Prestissimo']];
const tempoName = (b) => TEMPI.find(([m]) => b < m)[1];

export default {
  id: 'metronomo',
  title: 'Metronomo',
  icon: '⏱️',
  desc: 'Metronomo preciso con tempo in battuta, accenti, suddivisioni e tap tempo.',
  render(el) {
    const st = store('metronome', { bpm: 100, beats: 4, sub: 1, accents: [2, 1, 1, 1] });
    let running = false, timer = null, nextTime = 0, step = 0, raf = 0, queue = [], group = null, wake = null, taps = [];

    // accenti: 2 = forte, 1 = normale, 0 = muto
    const fixAccents = () => {
      const a = st.accents.slice(0, st.beats);
      while (a.length < st.beats) a.push(1);
      st.accents = a;
    };
    fixAccents();

    el.innerHTML = `
      <h1>Metronomo</h1>
      <div class="card metro">
        <div class="bpm" id="bpmV">${st.bpm}</div>
        <div class="tempo-name" id="tempoN">BPM · ${tempoName(st.bpm)}</div>
        <div class="beats" id="beats"></div>
        <div class="bpm-row">
          <button class="btn" data-d="-5">−5</button><button class="btn" data-d="-1">−1</button>
          <input type="range" id="bpm" min="30" max="260" value="${st.bpm}">
          <button class="btn" data-d="1">+1</button><button class="btn" data-d="5">+5</button>
        </div>
        <div class="row" style="justify-content:center;margin-top:1.2rem">
          <button class="btn primary big" id="start">▶ Avvia</button>
          <button class="btn big" id="tap">👆 Tap</button>
        </div>
      </div>
      <div class="controls" style="justify-content:center">
        <div class="field">Battiti per battuta${segmented('beats', [2, 3, 4, 5, 6, 7, 12].map((b) => [b, `${b}/${b === 6 || b === 12 ? 8 : 4}`]), st.beats)}</div>
        <div class="field">Suddivisione${segmented('sub', [[1, '♩'], [2, '♫ 2'], [3, '3 terzine'], [4, '♬ 4']], st.sub)}</div>
      </div>
      <p class="muted small" style="text-align:center">Tocca i cerchi per cambiare accento: forte → normale → muto. Usa “Tap” battendo a tempo per rilevare i BPM.</p>`;

    const drawBeats = () => {
      $('#beats', el).innerHTML = st.accents.map((a, i) => `<div class="beat ${a === 2 ? 'accent' : a === 0 ? 'mute' : ''}" data-b="${i}" title="Battito ${i + 1}"></div>`).join('');
    };
    const setBpm = (b) => {
      st.bpm = Math.max(30, Math.min(260, Math.round(b)));
      $('#bpmV', el).textContent = st.bpm;
      $('#tempoN', el).textContent = `BPM · ${tempoName(st.bpm)}`;
      $('#bpm', el).value = st.bpm;
    };

    const schedule = () => {
      const c = ac();
      while (nextTime < c.currentTime + 0.12) {
        const beat = Math.floor(step / st.sub) % st.beats;
        const isSub = step % st.sub !== 0;
        const acc = st.accents[beat];
        if (isSub) click(nextTime, 'sub', group.node);
        else if (acc > 0) click(nextTime, acc === 2 ? 'accent' : 'beat', group.node);
        if (!isSub) queue.push({ beat, time: nextTime });
        nextTime += 60 / st.bpm / st.sub;
        step = (step + 1) % (st.beats * st.sub);
      }
    };
    const drawLoop = () => {
      const c = ac();
      let cur = null;
      while (queue.length && queue[0].time <= c.currentTime) cur = queue.shift();
      if (cur) $$('.beat', el).forEach((b, i) => b.classList.toggle('now', i === cur.beat));
      raf = requestAnimationFrame(drawLoop);
    };

    const start = async () => {
      running = true;
      group = createGroup();
      step = 0;
      queue = [];
      nextTime = ac().currentTime + 0.08;
      timer = setInterval(schedule, 25);
      schedule();
      drawLoop();
      $('#start', el).textContent = '■ Stop';
      try { wake = await navigator.wakeLock?.request('screen'); } catch { wake = null; }
    };
    const stop = () => {
      running = false;
      clearInterval(timer);
      cancelAnimationFrame(raf);
      if (group) group.stop();
      group = null;
      $$('.beat', el).forEach((b) => b.classList.remove('now'));
      const b = $('#start', el);
      if (b) b.textContent = '▶ Avvia';
      if (wake) wake.release().catch(() => {});
      wake = null;
    };
    const restart = () => { if (running) { stop(); start(); } };

    $('#start', el).onclick = () => (running ? stop() : start());
    $('#bpm', el).oninput = (e) => setBpm(+e.target.value);
    $$('[data-d]', el).forEach((b) => (b.onclick = () => setBpm(st.bpm + +b.dataset.d)));
    $('#tap', el).onclick = () => {
      const now = performance.now();
      taps = taps.filter((t) => now - t < 2500);
      taps.push(now);
      if (taps.length >= 2) {
        const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
        setBpm(60000 / d);
      }
    };
    $('#beats', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]');
      if (!b) return;
      const i = +b.dataset.b;
      const a = st.accents.slice();
      a[i] = (a[i] + 2) % 3;
      st.accents = a;
      drawBeats();
    });
    el.addEventListener('segchange', (e) => {
      if (e.detail.name === 'beats') { st.beats = +e.detail.value; st.accents = [2]; fixAccents(); drawBeats(); restart(); }
      if (e.detail.name === 'sub') { st.sub = +e.detail.value; restart(); }
    });
    const onKey = (e) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); running ? stop() : start(); } };
    document.addEventListener('keydown', onKey);
    drawBeats();
    return () => { stop(); document.removeEventListener('keydown', onKey); };
  },
};
