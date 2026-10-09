// Ricerca automatica delle diteggiature per strumenti a tastiera tastata
// (chitarra, ukulele): genera tutte le posizioni suonabili e le ordina per comodità.

export const TUNINGS = {
  guitar: { name: 'Chitarra', midis: [40, 45, 50, 55, 59, 64], bassRoot: true, minStrings: 4 },
  ukulele: { name: 'Ukulele', midis: [67, 60, 64, 69], bassRoot: false, minStrings: 4 },
};

const cache = new Map();

/**
 * @param {number[]} tuning MIDI delle corde a vuoto (dalla più grave)
 * @param {number[]} pcs classi di altezza dell'accordo
 * @param {number} rootPc fondamentale
 * @param {number[]} optional classi di altezza omissibili (es. la quinta)
 */
export function findVoicings(tuning, pcs, rootPc, optional = [], { bassRoot = true, minStrings = 4, maxSpan = 3, max = 12 } = {}) {
  const key = [tuning, pcs, rootPc, optional, bassRoot, minStrings].join('|');
  if (cache.has(key)) return cache.get(key);

  const n = tuning.length;
  const pcSet = new Set(pcs);
  const required = pcs.filter((p) => !optional.includes(p));
  const found = new Map();

  const evaluate = (fr) => {
    const first = fr.findIndex((f) => f >= 0);
    if (first < 0) return;
    for (let i = first; i < n; i++) if (fr[i] < 0) return; // corde mute solo sui bassi
    if (n - first < minStrings) return;
    const present = new Set();
    for (let i = first; i < n; i++) present.add((tuning[i] + fr[i]) % 12);
    for (const p of required) if (!present.has(p)) return;
    if (bassRoot && (tuning[first] + fr[first]) % 12 !== rootPc) return;

    const fretted = fr.filter((f) => f > 0);
    const minF = fretted.length ? Math.min(...fretted) : 0;
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    if (maxF - minF > maxSpan) return;
    const opens = fr.filter((f) => f === 0).length;

    // conteggio dita, con eventuale barré sul tasto più basso
    let barre = null;
    let fingers = fretted.length;
    if (fingers > 4) {
      const b = fr.findIndex((f) => f === minF);
      for (let i = b; i < n; i++) if (fr[i] < minF) return; // niente corde a vuoto sotto il barré
      const atMin = fr.filter((f) => f === minF).length;
      fingers = fingers - atMin + 1;
      if (fingers > 4) return;
      barre = { fret: minF, from: b, to: n - 1 };
    } else if (minF > 0) {
      const idx = fr.map((f, i) => (f === minF ? i : -1)).filter((i) => i >= 0);
      if (idx.length >= 2 && !fr.slice(idx[0]).some((f) => f >= 0 && f < minF) && fretted.length >= 4) {
        barre = { fret: minF, from: idx[0], to: idx[idx.length - 1] };
      }
    }

    let score = minF * 0.55 + (maxF - minF) * 0.45 + first * 1.0 - (n - first) * 0.3;
    if (opens && maxF > 4) score += 4; // corde a vuoto con posizione alta: scomodo
    if (opens && maxF <= 4) score -= opens * 0.15;
    if (barre) score += 0.6;
    found.set(fr.join(','), { frets: fr, barre, score, base: minF });
  };

  for (let pos = 1; pos <= 12; pos++) {
    const opts = tuning.map((open) => {
      const o = [-1];
      for (const f of [0, pos, pos + 1, pos + 2, pos + 3]) {
        if (f - pos <= maxSpan && pcSet.has((open + f) % 12) && !o.includes(f)) o.push(f);
      }
      return o;
    });
    const cur = new Array(n);
    const dfs = (i) => {
      if (i === n) return evaluate(cur.slice());
      for (const f of opts[i]) { cur[i] = f; dfs(i + 1); }
    };
    dfs(0);
  }

  const res = [...found.values()].sort((a, b) => a.score - b.score).slice(0, max);
  cache.set(key, res);
  return res;
}
