import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pianoKeyboardHTML, pianoMidiForKey, pianoNoteName, pianoStaffHTML, pianoStaffStarts } from '../src/ui/piano-score.js';

test('the piano has eight natural keys, five sharps, and a distinct shortcut for each pitch', () => {
  const keys = pianoKeyboardHTML();
  assert.equal((keys.match(/data-piano-midi=/g) ?? []).length, 13);
  assert.equal((keys.match(/piano-key-white/g) ?? []).length, 8);
  assert.equal((keys.match(/piano-key-black/g) ?? []).length, 5);
  assert.deepEqual([..."Awsedftgyhujk"].map(pianoMidiForKey), Array.from({ length: 13 }, (_, i) => i + 60));
  assert.equal(pianoMidiForKey('ArrowDown'), null);
  assert.equal(pianoNoteName(66), 'F♯');
  assert.match(keys, /data-piano-midi="66"[^>]*aria-label="F sharp 4"/);
  assert.match(keys, /data-piano-midi="72"[^>]*aria-label="C 5"/);
});

test('the two-measure sheet shows note lengths, key signature and the active note', () => {
  const score = {
    keySignature: 'G', beatsPerBar: 3,
    notes: [ { midi: 66, beats: .5 }, { midi: 67, beats: 1.5 }, { midi: 60, beats: 1 },
      { midi: 66, beats: 3 }, { midi: 67, beats: 3 } ],
  };
  const first = pianoStaffHTML(score, 1);
  assert.deepEqual(pianoStaffStarts(score), [0, 4]);
  assert.match(first, /Measures 1–2 of 3/);
  assert.match(first, /G major, 3\/4 time/);
  assert.equal((first.match(/piano-staff-line/g) ?? []).length, 5);
  assert.equal((first.match(/piano-key-signature/g) ?? []).length, 1);
  assert.doesNotMatch(first, /piano-accidental/);
  for (const cls of ['piano-flag', 'piano-dot', 'piano-open-head', 'piano-ledger']) assert.ok(first.includes(cls), cls);
  assert.match(first, /data-piano-note="1" aria-current="step"/);
  const last = pianoStaffHTML(score, 4, { showNames: false });
  assert.match(last, /Measure 3 of 3/);
  assert.match(last, /data-piano-note="4" aria-current="step"/);
  assert.doesNotMatch(last, /piano-written-label/);
});
