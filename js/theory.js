// Nucleo di teoria musicale: note scritte correttamente (enarmonia), intervalli,
// accordi, scale e tonalità.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const IT_NAMES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const ACC_SYM = { '-2': '♭♭', '-1': '♭', '0': '', '1': '♯', '2': '♯♯' };

let notation = 'it';
export const setNotation = (n) => { notation = n; };
export const getNotation = () => notation;

// ---------- Note ----------
export function parseNote(s) {
  const letter = LETTERS.indexOf(s[0].toUpperCase());
  let acc = 0;
  for (const ch of s.slice(1)) {
    if (ch === '#' || ch === '♯') acc++;
    else if (ch === 'b' || ch === '♭') acc--;
  }
  return { letter, acc };
}

export const pc = (n) => (((LETTER_PC[n.letter] + n.acc) % 12) + 12) % 12;

export function noteName(n, nt) {
  if (typeof nt !== 'string') nt = notation; // consente .map(noteName)
  const base = nt === 'it' ? IT_NAMES[n.letter] : LETTERS[n.letter];
  return base + ACC_SYM[n.acc];
}

export const noteId = (n) => LETTERS[n.letter] + (n.acc > 0 ? '#'.repeat(n.acc) : 'b'.repeat(-n.acc));

// Fondamentali selezionabili (con grafia più comune)
export const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Nome di una nota MIDI (senza contesto: usa diesis/bemolle più comuni)
const PC_DEFAULT = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const pcName = (p, nt = notation) => noteName(parseNote(PC_DEFAULT[((p % 12) + 12) % 12]), nt);
export const midiName = (m, nt = notation) => pcName(m % 12, nt) + (Math.floor(m / 12) - 1);

// ---------- Intervalli ----------
export const INTERVALS = {
  '1':   { deg: 0, semi: 0, name: 'Unisono' },
  'b2':  { deg: 1, semi: 1, name: 'Seconda minore' },
  '2':   { deg: 1, semi: 2, name: 'Seconda maggiore' },
  '#2':  { deg: 1, semi: 3, name: 'Seconda aumentata' },
  'b3':  { deg: 2, semi: 3, name: 'Terza minore' },
  '3':   { deg: 2, semi: 4, name: 'Terza maggiore' },
  '4':   { deg: 3, semi: 5, name: 'Quarta giusta' },
  '#4':  { deg: 3, semi: 6, name: 'Quarta aumentata' },
  'b5':  { deg: 4, semi: 6, name: 'Quinta diminuita' },
  '5':   { deg: 4, semi: 7, name: 'Quinta giusta' },
  '#5':  { deg: 4, semi: 8, name: 'Quinta aumentata' },
  'b6':  { deg: 5, semi: 8, name: 'Sesta minore' },
  '6':   { deg: 5, semi: 9, name: 'Sesta maggiore' },
  'bb7': { deg: 6, semi: 9, name: 'Settima diminuita' },
  'b7':  { deg: 6, semi: 10, name: 'Settima minore' },
  '7':   { deg: 6, semi: 11, name: 'Settima maggiore' },
  '8':   { deg: 7, semi: 12, name: 'Ottava' },
  'b9':  { deg: 8, semi: 13, name: 'Nona minore' },
  '9':   { deg: 8, semi: 14, name: 'Nona maggiore' },
  '#9':  { deg: 8, semi: 15, name: 'Nona aumentata' },
  '11':  { deg: 10, semi: 17, name: 'Undicesima giusta' },
  '#11': { deg: 10, semi: 18, name: 'Undicesima aumentata' },
  'b13': { deg: 12, semi: 20, name: 'Tredicesima minore' },
  '13':  { deg: 12, semi: 21, name: 'Tredicesima maggiore' },
};

export const fmtInt = (sym) => sym.replace(/b/g, '♭').replace(/#/g, '♯');

export function transpose(note, sym) {
  const iv = INTERVALS[sym];
  const letter = (note.letter + iv.deg) % 7;
  const target = (pc(note) + iv.semi) % 12;
  let acc = target - LETTER_PC[letter];
  acc = ((((acc + 6) % 12) + 12) % 12) - 6;
  return { letter, acc };
}

// Intervallo (entro l'ottava) tra due note scritte, b sopra a
const EXTRA_INTERVALS = { '3,4': 'Quarta diminuita', '2,2': 'Terza diminuita', '5,10': 'Sesta aumentata' };
export function intervalBetween(a, b) {
  const deg = (b.letter - a.letter + 7) % 7;
  const semi = (pc(b) - pc(a) + 12) % 12;
  for (const [sym, iv] of Object.entries(INTERVALS)) {
    if (iv.deg === deg && iv.semi === semi) return { sym, name: iv.name, semi };
  }
  return { sym: '?', name: EXTRA_INTERVALS[`${deg},${semi}`] || `${semi} semitoni`, semi };
}

// Significato di ogni intervallo come funzione dentro un accordo
export const INTERVAL_ROLE = {
  '1': 'Fondamentale: dà il nome all’accordo ed è il suo “centro di gravità”.',
  'b3': 'Terza minore: rende l’accordo minore, colore scuro e malinconico.',
  '3': 'Terza maggiore: rende l’accordo maggiore, colore luminoso e stabile.',
  '2': 'Seconda (sus2): sostituisce la terza, suono aperto e ambiguo (né maggiore né minore).',
  '4': 'Quarta (sus4): sostituisce la terza e crea una tensione che “vuole” scendere sulla terza.',
  'b5': 'Quinta diminuita: forma un tritono con la fondamentale, instabile e teso.',
  '5': 'Quinta giusta: rinforza la fondamentale, dà stabilità e corpo. Spesso si può omettere.',
  '#5': 'Quinta aumentata: tensione sospesa che spinge verso l’alto, suono sognante/misterioso.',
  '6': 'Sesta: colore dolce, retrò/jazz; non crea tensione come la settima.',
  'bb7': 'Settima diminuita: rende l’accordo simmetrico (tutte terze minori), massima tensione.',
  'b7': 'Settima minore: suono “dominante”/blues; con la terza maggiore forma un tritono che vuole risolvere.',
  '7': 'Settima maggiore: colore morbido e sognante, tipico di jazz, bossa e pop raffinato.',
  'b9': 'Nona minore: tensione forte e drammatica, tipica degli accordi di dominante.',
  '9': 'Nona: colore aperto e moderno, arricchisce senza cambiare la funzione.',
  '#9': 'Nona aumentata: il suono “Hendrix”, maggiore e minore insieme.',
  '11': 'Undicesima: colore sospeso, tipico degli accordi minori.',
  '#11': 'Undicesima aumentata: colore lidio, brillante e moderno.',
  '13': 'Tredicesima: colore ricco, tipico del jazz sugli accordi di dominante.',
};

// ---------- Accordi ----------
export const CHORDS = {
  maj:    { sym: '',       name: 'Maggiore',              ints: ['1', '3', '5'], cat: 'triade', char: 'Stabile, luminoso, “felice”.' },
  m:      { sym: 'm',      name: 'Minore',                ints: ['1', 'b3', '5'], cat: 'triade', char: 'Stabile ma scuro, malinconico.' },
  dim:    { sym: '°',      name: 'Diminuita',             ints: ['1', 'b3', 'b5'], cat: 'triade', char: 'Instabile e teso, vuole risolvere.' },
  aug:    { sym: '+',      name: 'Aumentata',             ints: ['1', '3', '#5'], cat: 'triade', char: 'Sospesa, misteriosa, simmetrica.' },
  sus2:   { sym: 'sus2',   name: 'Sospesa di 2ª',         ints: ['1', '2', '5'], cat: 'triade', char: 'Aperta, ariosa, ambigua.' },
  sus4:   { sym: 'sus4',   name: 'Sospesa di 4ª',         ints: ['1', '4', '5'], cat: 'triade', char: 'Tesa, chiede di risolvere sulla terza.' },
  p5:     { sym: '5',      name: 'Power chord (bicordo)', ints: ['1', '5'], cat: 'triade', char: 'Neutro e potente, tipico del rock.' },
  maj7:   { sym: 'maj7',   name: 'Settima maggiore',      ints: ['1', '3', '5', '7'], cat: 'quadriade', char: 'Morbido, sognante, raffinato.' },
  dom7:   { sym: '7',      name: 'Settima di dominante',  ints: ['1', '3', '5', 'b7'], cat: 'quadriade', char: 'Tensione che spinge a risolvere; anima del blues.' },
  m7:     { sym: 'm7',     name: 'Minore settima',        ints: ['1', 'b3', '5', 'b7'], cat: 'quadriade', char: 'Morbido, soul, rilassato.' },
  m7b5:   { sym: 'm7♭5',   name: 'Semidiminuito (ø)',     ints: ['1', 'b3', 'b5', 'b7'], cat: 'quadriade', char: 'Scuro e instabile; il “ii” delle tonalità minori.' },
  dim7:   { sym: '°7',     name: 'Diminuito settima',     ints: ['1', 'b3', 'b5', 'bb7'], cat: 'quadriade', char: 'Massima tensione, simmetrico, drammatico.' },
  mMaj7:  { sym: 'm(maj7)', name: 'Minore settima maggiore', ints: ['1', 'b3', '5', '7'], cat: 'quadriade', char: 'Cupo e cinematografico (film noir, spy).' },
  maj7s5: { sym: 'maj7♯5', name: 'Settima maggiore ♯5',   ints: ['1', '3', '#5', '7'], cat: 'quadriade', char: 'Luminoso e sospeso, molto moderno.' },
  sus47:  { sym: '7sus4',  name: 'Settima sospesa',       ints: ['1', '4', '5', 'b7'], cat: 'quadriade', char: 'Dominante “morbida”, aperta.' },
  six:    { sym: '6',      name: 'Sesta',                 ints: ['1', '3', '5', '6'], cat: 'quadriade', char: 'Dolce, vintage, swing.' },
  m6:     { sym: 'm6',     name: 'Minore sesta',          ints: ['1', 'b3', '5', '6'], cat: 'quadriade', char: 'Minore elegante, un po’ jazz/tango.' },
  add9:   { sym: 'add9',   name: 'Add 9',                 ints: ['1', '3', '5', '9'], cat: 'estesi', char: 'Maggiore con un colore aperto e moderno.' },
  madd9:  { sym: 'm(add9)', name: 'Minore add 9',         ints: ['1', 'b3', '5', '9'], cat: 'estesi', char: 'Minore delicato e malinconico.' },
  dom9:   { sym: '9',      name: 'Nona di dominante',     ints: ['1', '3', '5', 'b7', '9'], cat: 'estesi', char: 'Dominante funky e ricca.' },
  maj9:   { sym: 'maj9',   name: 'Nona maggiore',         ints: ['1', '3', '5', '7', '9'], cat: 'estesi', char: 'Raffinatissimo, jazz/neo-soul.' },
  m9:     { sym: 'm9',     name: 'Minore nona',           ints: ['1', 'b3', '5', 'b7', '9'], cat: 'estesi', char: 'Morbido e profondo, neo-soul.' },
  dom7b9: { sym: '7♭9',    name: 'Settima ♭9',            ints: ['1', '3', '5', 'b7', 'b9'], cat: 'estesi', char: 'Dominante drammatica, verso il minore.' },
};

export const CHORD_CATS = { triade: 'Triadi', quadriade: 'Quadriadi', estesi: 'Accordi estesi' };

export function chordNotes(root, type) {
  return CHORDS[type].ints.map((i) => transpose(root, i));
}

export const chordSymbol = (root, type, nt = notation) => noteName(root, nt) + CHORDS[type].sym;

// MIDI a partire da una fondamentale in una certa ottava (default ottava 3: C3 = 48)
export const rootMidi = (root, base = 48) => base + pc(root);
export const chordMidis = (root, type, base = 48) => {
  const r = rootMidi(root, base);
  return CHORDS[type].ints.map((i) => r + INTERVALS[i].semi);
};

// Identifica il tipo di accordo dai semitoni (per accordi diatonici)
export function identifyChord(semis) {
  const key = [...semis].sort((a, b) => a - b).join(',');
  for (const [k, c] of Object.entries(CHORDS)) {
    if (c.ints.map((i) => INTERVALS[i].semi % 12).sort((a, b) => a - b).join(',') === key) return k;
  }
  return null;
}

// ---------- Scale ----------
export const SCALES = {
  major:     { name: 'Maggiore (ionica)', ints: ['1', '2', '3', '4', '5', '6', '7'], desc: 'La scala di riferimento: luminosa e stabile. Da qui si ricavano tutte le altre.' },
  minor:     { name: 'Minore naturale (eolia)', ints: ['1', '2', 'b3', '4', '5', 'b6', 'b7'], desc: 'Relativa della maggiore (stesse note, parte dal 6° grado). Malinconica.' },
  harmonic:  { name: 'Minore armonica', ints: ['1', '2', 'b3', '4', '5', 'b6', '7'], desc: 'Minore naturale con la 7ª alzata: crea la sensibile e l’accordo di dominante maggiore (V). Suono “orientale” per la 2ª aumentata tra ♭6 e 7.' },
  melodic:   { name: 'Minore melodica', ints: ['1', '2', 'b3', '4', '5', '6', '7'], desc: 'Minore con 6ª e 7ª alzate: evita la 2ª aumentata e rende la melodia più fluida (in classica solo in salita; nel jazz sempre).' },
  dorian:    { name: 'Dorica', ints: ['1', '2', 'b3', '4', '5', '6', 'b7'], desc: 'Minore con la 6ª maggiore: minore “speranzoso”, tipica di funk, jazz e rock (es. Santana).' },
  phrygian:  { name: 'Frigia', ints: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'], desc: 'Minore con la ♭2: scura, spagnoleggiante, metal.' },
  lydian:    { name: 'Lidia', ints: ['1', '2', '3', '#4', '5', '6', '7'], desc: 'Maggiore con la ♯4: sognante, sospesa, da colonna sonora.' },
  mixolydian:{ name: 'Misolidia', ints: ['1', '2', '3', '4', '5', '6', 'b7'], desc: 'Maggiore con la ♭7: rock, blues, folk. È la scala dell’accordo di dominante.' },
  locrian:   { name: 'Locria', ints: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'], desc: 'Con la ♭5: instabilissima. Si usa sull’accordo semidiminuito.' },
  pentMaj:   { name: 'Pentatonica maggiore', ints: ['1', '2', '3', '5', '6'], desc: '5 note, nessun semitono: impossibile “sbagliare”. Country, pop, folk.' },
  pentMin:   { name: 'Pentatonica minore', ints: ['1', 'b3', '4', '5', 'b7'], desc: 'La scala più usata per improvvisare in rock e blues.' },
  blues:     { name: 'Blues', ints: ['1', 'b3', '4', 'b5', '5', 'b7'], desc: 'Pentatonica minore + la “blue note” (♭5).' },
  wholeTone: { name: 'Esatonale (toni interi)', ints: ['1', '2', '3', '#4', '#5', 'b7'], desc: 'Solo toni interi: sognante, impressionista (Debussy).' },
  chromatic: { name: 'Cromatica', ints: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'], desc: 'Tutti i 12 semitoni.' },
};

export const scaleNotes = (root, type) => SCALES[type].ints.map((i) => transpose(root, i));

export const stepName = (s) => ({ 1: 'S', 2: 'T', 3: 'T+S', 4: '2T' }[s] || `${s}`);
export function scaleSteps(type) {
  const semis = SCALES[type].ints.map((i) => INTERVALS[i].semi).concat(12);
  return semis.slice(1).map((s, i) => s - semis[i]);
}

// ---------- Armonia diatonica ----------
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const ROMAN_SUFFIX = { maj: '', m: '', dim: '°', aug: '+', maj7: 'maj7', dom7: '7', m7: '7', m7b5: 'ø7', dim7: '°7', mMaj7: '(maj7)', maj7s5: '+maj7' };
const LOWER = new Set(['m', 'dim', 'm7', 'm7b5', 'dim7', 'mMaj7']);
export function roman(deg, type) {
  const r = LOWER.has(type) ? ROMAN[deg].toLowerCase() : ROMAN[deg];
  return r + (ROMAN_SUFFIX[type] ?? CHORDS[type].sym);
}

export const FUNCTIONS = ['T', 'S', 'T', 'S', 'D', 'T', 'D'];
export const FUNCTION_NAMES = { T: 'Tonica', S: 'Sottodominante', D: 'Dominante' };
export const DEGREE_NAMES = ['Tonica', 'Sopratonica', 'Mediante', 'Sottodominante', 'Dominante', 'Sopradominante', 'Sensibile'];

// Accordi costruiti per terze sovrapposte su ogni grado di una scala eptafonica
export function diatonicChords(root, scaleType, seventh = false) {
  const notes = scaleNotes(root, scaleType);
  return notes.map((n, d) => {
    const idx = seventh ? [0, 2, 4, 6] : [0, 2, 4];
    const cn = idx.map((k) => notes[(d + k) % 7]);
    const semis = cn.map((x) => (pc(x) - pc(n) + 12) % 12);
    const type = identifyChord(semis);
    return { deg: d, root: n, notes: cn, type, roman: roman(d, type), fn: FUNCTIONS[d] };
  });
}

// ---------- Circolo delle quinte ----------
export const CIRCLE = [
  { maj: 'C', min: 'A', acc: 0 },
  { maj: 'G', min: 'E', acc: 1 },
  { maj: 'D', min: 'B', acc: 2 },
  { maj: 'A', min: 'F#', acc: 3 },
  { maj: 'E', min: 'C#', acc: 4 },
  { maj: 'B', min: 'G#', acc: 5, enh: { maj: 'Cb', min: 'Ab', acc: -7 } },
  { maj: 'F#', min: 'D#', acc: 6, enh: { maj: 'Gb', min: 'Eb', acc: -6 } },
  { maj: 'Db', min: 'Bb', acc: -5, enh: { maj: 'C#', min: 'A#', acc: 7 } },
  { maj: 'Ab', min: 'F', acc: -4 },
  { maj: 'Eb', min: 'C', acc: -3 },
  { maj: 'Bb', min: 'G', acc: -2 },
  { maj: 'F', min: 'D', acc: -1 },
];
export const SHARP_ORDER = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
export const FLAT_ORDER = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];
export const keySignature = (acc) => (acc >= 0 ? SHARP_ORDER.slice(0, acc) : FLAT_ORDER.slice(0, -acc)).map(parseNote);
