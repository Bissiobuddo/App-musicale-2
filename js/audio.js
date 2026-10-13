// Sintetizzatore Web Audio leggero: suono "piano", "pizzicato" e click del metronomo.

let ctx = null;
let master = null;

export function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const midiToFreq = (m, a4 = 440) => a4 * 2 ** ((m - 69) / 12);

// Un gruppo permette di silenziare in un colpo solo tutte le note programmate.
export function createGroup() {
  const c = ac();
  const g = c.createGain();
  g.connect(master);
  return {
    node: g,
    stop() {
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setValueAtTime(0, c.currentTime);
      setTimeout(() => g.disconnect(), 100);
    },
  };
}

export function playNote(midi, { time = 0, dur = 1.5, vel = 0.5, timbre = 'piano', dest = null } = {}) {
  const c = ac();
  const t = Math.max(time || c.currentTime, c.currentTime);
  const out = dest || master;
  (VOICES[timbre] || VOICES.piano)(c, t, midiToFreq(midi), Math.max(dur, 0.05), vel, out, midi);
}

// Inviluppo percussivo: attacco rapido e decadimento esponenziale
function percEnv(c, t, vel, dur, out) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  g.connect(out);
  return g;
}
// Inviluppo sostenuto: attacco, tenuta per tutta la durata, rilascio
function sustEnv(c, t, vel, dur, out, attack = 0.01, release = 0.08) {
  const g = c.createGain();
  const a = Math.min(attack, dur * 0.5);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + a);
  g.gain.setValueAtTime(vel, t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + release);
  g.connect(out);
  return { g, end: t + dur + release + 0.02 };
}
const osc = (c, type, freq, dest, t, end, detune = 0) => {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  o.connect(dest);
  o.start(t);
  o.stop(end);
  return o;
};

// Corda pizzicata (Karplus-Strong): buffer pre-calcolato per ogni nota
const ksCache = new Map();
function ksBuffer(c, midi, freq) {
  if (ksCache.has(midi)) return ksCache.get(midi);
  const sr = c.sampleRate;
  const period = Math.max(2, Math.floor(sr / freq));
  const n = Math.floor(sr * 3);
  const buf = c.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 1; i < period; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const nx = idx + 1 === period ? 0 : idx + 1;
    const v = ring[idx];
    d[i] = v;
    ring[idx] = (v + ring[nx]) * 0.4985;
    idx = nx;
  }
  const res = { buf, rate: (freq * period) / sr };
  ksCache.set(midi, res);
  return res;
}

const VOICES = {
  // somma di armoniche che decadono: timbro di pianoforte morbido
  piano(c, t, f, dur, vel, out) {
    const g = percEnv(c, t, vel, dur, out);
    for (const [h, a] of [[1, 1], [2, 0.42], [3, 0.18], [4, 0.09], [5, 0.04]]) {
      if (f * h > 16000) continue;
      const pg = c.createGain();
      pg.gain.setValueAtTime(a, t);
      pg.gain.exponentialRampToValueAtTime(a * 0.02 + 0.0001, t + dur / h);
      pg.connect(g);
      osc(c, 'sine', f * h, pg, t, t + dur + 0.05);
    }
  },
  pluck(c, t, f, dur, vel, out) {
    const g = percEnv(c, t, vel, dur, out);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 2;
    fl.frequency.setValueAtTime(Math.min(f * 10, 12000), t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 200), t + dur * 0.6);
    fl.connect(g);
    osc(c, 'sawtooth', f, fl, t, t + dur + 0.05);
  },
  // chitarra acustica: corda pizzicata reale
  guitar(c, t, f, dur, vel, out, midi) {
    const { buf, rate } = ksBuffer(c, midi, f);
    const d = Math.min(dur, 2.9);
    const g = c.createGain();
    g.gain.setValueAtTime(vel * 1.6, t);
    g.gain.setValueAtTime(vel * 1.6, t + d * 0.85);
    g.gain.linearRampToValueAtTime(0, t + d);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 5000;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.connect(fl).connect(g).connect(out);
    src.start(t);
    src.stop(t + d + 0.02);
  },
  // piano elettrico: sintesi FM con "campanella" iniziale
  epiano(c, t, f, dur, vel, out) {
    const g = percEnv(c, t, vel, Math.max(dur, 0.6), out);
    const car = c.createOscillator();
    car.frequency.value = f;
    const mod = c.createOscillator();
    mod.frequency.value = f;
    const mg = c.createGain();
    mg.gain.setValueAtTime(f * 1.8, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.9);
    mod.connect(mg).connect(car.frequency);
    car.connect(g);
    const bell = c.createGain();
    bell.gain.setValueAtTime(0.12, t);
    bell.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    bell.connect(g);
    const end = t + Math.max(dur, 0.6) + 0.05;
    osc(c, 'sine', f * 7, bell, t, t + 0.3);
    [car, mod].forEach((o) => { o.start(t); o.stop(end); });
  },
  // organo a registri (drawbar)
  organ(c, t, f, dur, vel, out) {
    const { g, end } = sustEnv(c, t, vel, dur, out, 0.01, 0.06);
    for (const [h, a] of [[0.5, 0.45], [1, 1], [2, 0.6], [3, 0.35], [4, 0.25], [6, 0.12]]) {
      const pg = c.createGain();
      pg.gain.value = a * 0.5;
      pg.connect(g);
      osc(c, 'sine', f * h, pg, t, end);
    }
  },
  // pad sintetico: due dente di sega leggermente scordati, filtrati
  pad(c, t, f, dur, vel, out) {
    const { g, end } = sustEnv(c, t, vel, dur, out, 0.25, 0.5);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = Math.min(2400, f * 5);
    fl.Q.value = 0.8;
    fl.connect(g);
    osc(c, 'sawtooth', f, fl, t, end, -9);
    osc(c, 'sawtooth', f, fl, t, end, 9);
    osc(c, 'triangle', f / 2, fl, t, end);
  },
  // basso: triangolo + sinusoide con filtro che si chiude
  bass(c, t, f, dur, vel, out) {
    const { g, end } = sustEnv(c, t, vel, dur, out, 0.005, 0.06);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 3;
    fl.frequency.setValueAtTime(f * 9, t);
    fl.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.25);
    fl.connect(g);
    osc(c, 'triangle', f, fl, t, end);
    osc(c, 'sine', f, g, t, end);
    osc(c, 'sawtooth', f, fl, t, end).detune.value = 3;
  },
};

// ---------- Batteria sintetizzata ----------
let noiseBuf = null;
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** k cassa, s rullante, h hi-hat chiuso, o hi-hat aperto, r ride, c rim, p clap */
export function drum(kind, time, vel = 0.8, dest = null) {
  const c = ac();
  const t = Math.max(time, c.currentTime);
  const out = dest || master;
  const g = c.createGain();
  g.connect(out);
  const nz = (dur, type, freq, q = 1) => {
    const s = c.createBufferSource();
    s.buffer = noise(c);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    s.connect(f).connect(g);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
  };
  const decay = (peak, d) => {
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
  };
  switch (kind) {
    case 'k': {
      decay(vel * 1.1, 0.42);
      const o = osc(c, 'sine', 150, g, t, t + 0.45);
      o.frequency.setValueAtTime(155, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.14);
      break;
    }
    case 's': {
      decay(vel * 0.5, 0.2);
      nz(0.22, 'highpass', 1400);
      const tg = c.createGain();
      tg.gain.setValueAtTime(vel * 0.45, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      tg.connect(out);
      const o = osc(c, 'triangle', 220, tg, t, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
      break;
    }
    case 'h': decay(vel * 0.2, 0.05); nz(0.06, 'highpass', 7500); break;
    case 'o': decay(vel * 0.18, 0.32); nz(0.34, 'highpass', 7000); break;
    case 'r': decay(vel * 0.14, 0.55); nz(0.58, 'bandpass', 8000, 0.7); break;
    case 'c': decay(vel * 0.35, 0.05); nz(0.04, 'bandpass', 2600, 3); osc(c, 'triangle', 1700, g, t, t + 0.05); break;
    case 'p': {
      g.gain.setValueAtTime(vel * 0.45, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.012);
      g.gain.setValueAtTime(vel * 0.45, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.032);
      g.gain.setValueAtTime(vel * 0.5, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      nz(0.22, 'bandpass', 1500, 1.2);
      break;
    }
    default: break;
  }
}

export function playChord(midis, { time = 0, strum = 0, dur = 2, timbre = 'piano', dest = null, vel = 0.55 } = {}) {
  const c = ac();
  const t0 = time || c.currentTime + 0.02;
  const v = vel / Math.sqrt(midis.length);
  midis.forEach((m, i) => playNote(m, { time: t0 + i * strum, dur, vel: v, timbre, dest }));
}

export function playSequence(midis, { gap = 0.4, dur = 0.8, timbre = 'piano', dest = null } = {}) {
  const c = ac();
  const t0 = c.currentTime + 0.02;
  midis.forEach((m, i) => playNote(m, { time: t0 + i * gap, dur, vel: 0.5, timbre, dest }));
  return midis.length * gap;
}

export function click(time, kind = 'beat', dest = null) {
  const c = ac();
  const freq = { accent: 1760, beat: 1100, sub: 760 }[kind];
  const vol = { accent: 0.9, beat: 0.6, sub: 0.3 }[kind];
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  o.connect(f).connect(g).connect(dest || master);
  o.start(time);
  o.stop(time + 0.06);
}

// Tono di riferimento continuo (accordatore)
export function tone(freq, dur = 2) {
  const c = ac();
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.03);
  g.gain.setValueAtTime(0.35, t + dur - 0.3);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
