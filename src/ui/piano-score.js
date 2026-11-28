const PITCHES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B', 'C'];
const SHORTCUTS = 'awsedftgyhujk';
const DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6, 7];
const LOW_C = 60, HIGH_C = 72;
const STAFF_BOTTOM = 58, LINE = 9;
const STAFF_WIDTH = 366, STAFF_LEFT = 16, STAFF_RIGHT = 352;
const MEASURES_PER_STAFF = 2;

const pitchIndex = (midi) => Number.isInteger(midi) && midi >= LOW_C && midi <= HIGH_C ? midi - LOW_C : -1;
export const pianoNoteName = (midi, keySignature) => keySignature === 'F' && midi === 70 ? 'B♭' : PITCHES[pitchIndex(midi)] ?? '';
export const pianoTimeSignature = (score) => score.timeSignature ?? [score.beatsPerBar, 4];
export function pianoMidiForKey(key) {
  const i = typeof key === 'string' && key.length === 1 ? SHORTCUTS.indexOf(key.toLowerCase()) : -1;
  return i < 0 ? null : LOW_C + i;
}

export function pianoKeyboardHTML() {
  const buttons = PITCHES.map((name, i) => {
    const black = name.endsWith('♯'), midi = LOW_C + i;
    const label = `${name.replace('♯', ' sharp')}${i === 12 ? ' 5' : ' 4'}`;
    const shown = midi === LOW_C ? 'C₄' : midi === HIGH_C ? 'C₅' : name;
    const shortcut = SHORTCUTS[i].toUpperCase();
    const offset = black ? ` style="--piano-gap:${DIATONIC[i] + 1}"` : '';
    return `<button type="button" class="piano-key ${black ? 'piano-key-black' : 'piano-key-white'}" data-piano-midi="${midi}"${offset} aria-label="${label}" aria-keyshortcuts="${shortcut}"><span class="piano-pitch" aria-hidden="true">${shown}</span><kbd aria-hidden="true">${shortcut}</kbd></button>`;
  });
  return `<div class="piano-keyboard" role="group" aria-label="Piano keyboard">${buttons.join('')}</div>`;
}

function measures(score) {
  return score.measureStarts.map((start, bar) => {
    let beat = 0;
    return score.notes.slice(start, score.measureStarts[bar + 1]).map((note, offset) => {
      const written = { ...note, index: start + offset, beat };
      beat += note.beats;
      return written;
    });
  });
}

export function pianoStaffStarts(score) {
  return measures(score).filter((_, i) => i % MEASURES_PER_STAFF === 0).map(([note]) => note?.index ?? 0);
}

const line = (x1, y1, x2, y2, css = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${css ? ` class="${css}"` : ''}/>`;

// A treble clef drawn with paths so its shape does not depend on a symbol font being installed.
const CLEF = '<path class="piano-clef" d="M27 62c8 4 11-3 7-13L24 27c-4-9-2-17 2-20 4 8 2 16-5 21-8 7-11 15-6 21 5 7 17 5 18-1 2-6-4-10-9-8-4 2-3 7 0 8m3 14c-7-1-9-6-5-8 4-2 8 2 5 5"/>';

function writtenNote(note, x, next, key, showNames) {
  const { midi, beats, index } = note;
  const pitch = pitchIndex(midi), step = key === 'F' && midi === 70 ? 6 : DIATONIC[pitch];
  const y = STAFF_BOTTOM - (step - 2) * LINE / 2;
  const accidental = pianoNoteName(midi, key).slice(1);
  const inKey = (key === 'G' && midi === 66) || (key === 'F' && midi === 70);
  const up = step < 6, stem = up ? x + 4.1 : x - 4.1, tip = y + (up ? -24 : 24);
  const dotted = beats === .75 || beats === 1.5 || beats === 3;
  const classes = index === next ? ' is-current' : index < next ? ' is-complete' : '';
  return `<g class="piano-written-note${classes}" data-piano-note="${index}"${index === next ? ' aria-current="step"' : ''}>
    ${index === next ? `<rect class="piano-note-cue" x="${x - 12}" y="5" width="24" height="76" rx="5"/>` : ''}
    ${midi === LOW_C || midi === LOW_C + 1 ? line(x - 7.5, y, x + 7.5, y, 'piano-ledger') : ''}
    ${accidental && !inKey ? `<text class="piano-accidental" x="${x - 10}" y="${y + 4}">${accidental}</text>` : ''}
    <ellipse class="${beats >= 2 ? 'piano-open-head' : 'piano-filled-head'}" cx="${x}" cy="${y}" rx="${beats >= 4 ? 5.5 : 4.6}" ry="3.15" transform="rotate(-18 ${x} ${y})"/>
    ${beats < 4 ? line(stem, y, stem, tip, 'piano-stem') : ''}
    ${beats < 1 ? `<path class="piano-flag" d="M${stem} ${tip}q${up ? 12 : 9} ${up ? 7 : -7} ${up ? 4 : 5} ${up ? 13 : -14}"/>` : ''}
    ${dotted ? `<circle class="piano-dot" cx="${x + 8.5}" cy="${step % 2 === 0 ? y - 4.5 : y}" r="1.5"/>` : ''}
    ${showNames ? `<text class="piano-written-label" x="${x}" y="87">${pianoNoteName(midi, key)}</text>` : ''}
  </g>`;
}

/** Show two measures at a time so stems and accidentals remain readable on a phone. */
export function pianoStaffHTML(score, nextIndex = 0, { showNames = true } = {}) {
  const bars = measures(score);
  const current = bars.findIndex((bar) => bar.some(({ index }) => index === nextIndex));
  const start = Math.floor((current < 0 ? bars.length - 1 : current) / MEASURES_PER_STAFF) * MEASURES_PER_STAFF;
  const system = bars.slice(start, start + MEASURES_PER_STAFF);
  const last = start + system.length;
  const measuresLabel = last - start === 1 ? `Measure ${last}` : `Measures ${start + 1}–${last}`;
  const [numerator, denominator] = pianoTimeSignature(score);
  const keyMark = { F: '<text class="piano-key-signature" x="42" y="44">♭</text>', G: '<text class="piano-key-signature" x="42" y="28">♯</text>' }[score.keySignature] ?? '';
  const left = keyMark ? 77 : 68;
  const width = (STAFF_RIGHT - left) / MEASURES_PER_STAFF;
  const noteWidth = width - 18;
  const written = system.map((bar, i) => {
    const end = left + (i + 1) * width, final = start + i + 1 === bars.length;
    return bar.map((note) => writtenNote(note, left + i * width + 10 + note.beat * noteWidth / score.beatsPerBar, nextIndex, score.keySignature, showNames)).join('')
      + line(end, STAFF_BOTTOM - 4 * LINE, end, STAFF_BOTTOM, 'piano-bar')
      + (final ? line(end - 3, STAFF_BOTTOM - 4 * LINE, end - 3, STAFF_BOTTOM, 'piano-bar') : '');
  }).join('');
  return `<figure class="piano-paper"><figcaption><b>Sheet music</b><span>${measuresLabel} of ${bars.length}</span></figcaption>
    <svg class="piano-staff" viewBox="0 0 ${STAFF_WIDTH} 94" role="img" aria-label="Treble staff, ${score.keySignature} major, ${numerator}/${denominator} time, ${measuresLabel.toLowerCase()} of ${bars.length}">
      <rect class="piano-paper-fill" width="366" height="94" rx="6"/>
      ${Array.from({ length: 5 }, (_, i) => line(STAFF_LEFT, STAFF_BOTTOM - i * LINE, left + system.length * width, STAFF_BOTTOM - i * LINE, 'piano-staff-line')).join('')}
      ${CLEF}
      ${keyMark}
      <text class="piano-time-signature" x="${left - 19}" y="37">${numerator}<tspan x="${left - 19}" y="55">${denominator}</tspan></text>
      ${written}
    </svg></figure>`;
}
