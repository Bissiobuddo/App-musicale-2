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
  const freq = midiToFreq(midi);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  g.connect(dest || master);
  const oscs = [];

  if (timbre === 'pluck') {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(Math.min(freq * 10, 12000), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.2, 200), t + dur * 0.6);
    o.connect(f).connect(g);
    oscs.push(o);
  } else {
    // somma di armoniche che decadono: timbro simile a un piano elettrico
    const partials = [[1, 1], [2, 0.42], [3, 0.18], [4, 0.09], [5, 0.04]];
    for (const [h, a] of partials) {
      if (freq * h > 16000) continue;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * h;
      const pg = c.createGain();
      pg.gain.setValueAtTime(a, t);
      pg.gain.exponentialRampToValueAtTime(a * 0.02 + 0.0001, t + dur / h);
      o.connect(pg).connect(g);
      oscs.push(o);
    }
  }
  oscs.forEach((o) => { o.start(t); o.stop(t + dur + 0.05); });
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
