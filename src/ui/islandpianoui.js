import { formatNumber } from '../core/utils.js';
import { STAGES } from '../data/islandlife.js';
import { PIANO_SCORES } from '../data/piano.js';
import { finishPianoLesson, islandPractised, islandSiteTile, musicStage, pianoLessonAvailable } from '../game/islandlife.js';
import { unlockFx } from '../game/skillunlocks.js';
import { pianoKeyboardHTML, pianoMidiForKey, pianoNoteName, pianoStaffHTML, pianoStaffStarts } from './piano-score.js';

const action = (name, id) => `<button type="button" class="wm-go" data-piano-action="${id}">${name}</button>`;

export function openIslandPiano(ui, onBack = () => ui.closeModal()) {
  const game = ui.game;
  ui.openModal('Piano', (body) => {
    let score = PIANO_SCORES[0];
    let mode = 'browse', played = [], showNames = true;
    let sheetPage = 0, sheetStarts = pianoStaffStarts(score);
    let playback = null, playbackIndex = null, sounding = null;
    const heldKeys = new Map(), heldPointers = new Map(), flashes = new Map();

    body.innerHTML = `<section class="island-panel island-piano">
      <div class="piano-controls">
        <label class="piano-score-picker">Score <select data-piano-score>${PIANO_SCORES.map((entry) =>
          `<option value="${entry.id}">${entry.name} · Level ${entry.level}</option>`).join('')}</select></label>
        <div class="piano-actions island-actions">
          ${action('Play score', 'practice')}${action('Hear score', 'listen')}${action('Free play', 'free')}
        </div>
      </div>
      <div class="piano-sheet">
        <div class="piano-score-meta"><span data-piano-meta></span><label><input type="checkbox" data-piano-names checked> Note guide</label></div>
        <div data-piano-staff></div>
        <div class="piano-page-actions" data-piano-pages role="group" aria-label="Browse sheet music">${action('Previous measures', 'previous')}${action('Next measures', 'next')}</div>
        <p class="piano-status" data-piano-status role="status"></p>
      </div>
      <div class="piano-keyboard-shell" data-piano-keys>${pianoKeyboardHTML()}</div>
      <div class="piano-footer island-actions">${action('Go to stage', 'travel')}${action('Back to Music', 'back')}</div>
    </section>`;

    const panel = body.querySelector('.island-piano');
    const keyboard = panel.querySelector('[data-piano-keys]');
    const keys = new Map([...keyboard.querySelectorAll('[data-piano-midi]')].map((key) => [Number(key.dataset.pianoMidi), key]));
    const controls = Object.fromEntries([...panel.querySelectorAll('[data-piano-action]')].map((button) => [button.dataset.pianoAction, button]));
    const staff = panel.querySelector('[data-piano-staff]');
    const status = panel.querySelector('[data-piano-status]');
    const meta = panel.querySelector('[data-piano-meta]');
    const pages = panel.querySelector('[data-piano-pages]');

    function syncKey(midi) {
      keys.get(midi)?.classList.toggle('is-pressed', sounding === midi || flashes.has(midi)
        || [...heldKeys.values(), ...heldPointers.values()].includes(midi));
    }

    function drawScore() {
      const practising = mode === 'practice' || mode === 'complete';
      const current = playbackIndex ?? (practising ? played.length : sheetStarts[sheetPage]);
      staff.innerHTML = pianoStaffHTML(score, current, { showNames });
      const next = showNames && mode === 'practice' && playbackIndex === null ? score.notes[played.length]?.midi : null;
      for (const [midi, key] of keys) key.toggleAttribute('data-piano-next', midi === next);
      const level = game.skills.level('music'), stage = musicStage(game);
      const progress = practising ? ` · ${played.length} of ${score.notes.length} notes` : '';
      const mastered = islandPractised(game, 'music', `piano:${score.id}`) ? ' · Completed' : '';
      meta.textContent = `Music ${level} · ${score.beatsPerBar}/4 · ${score.bpm} BPM${mastered}${progress}`;
      controls.practice.disabled = !pianoLessonAvailable(game, score);
      controls.practice.textContent = mode === 'practice' ? 'Restart score' : mode === 'complete' ? 'Play again' : 'Play score';
      controls.travel.hidden = !!stage;
      pages.hidden = practising || playbackIndex !== null || sheetStarts.length <= 1;
      controls.previous.disabled = sheetPage === 0;
      controls.next.disabled = sheetPage === sheetStarts.length - 1;
    }

    function accessMessage() {
      const level = game.skills.level('music'), stage = musicStage(game);
      if (level < score.level) return `Music level ${score.level} is required to earn XP with this score. You can still hear it or play freely.`;
      if (!stage) return 'Practise at a Music stage to earn XP. Free play and score playback are available here.';
      if (!pianoLessonAvailable(game, score)) return 'Practise when it’s safe to perform at this stage.';
      const cleared = islandPractised(game, 'music', `piano:${score.id}`);
      const base = score.xp * (1 + (unlockFx(game, 'music').activityXp || 0)) * (cleared ? 1 : 1.5);
      const xp = formatNumber(Math.round(game.skills.xpAtLevel('music', base)));
      return `${stage.name} · About ${xp} Music XP on completion.`;
    }

    function nextMessage(prefix = '') {
      if (!showNames) { status.textContent = `${prefix}Read the highlighted note on the staff.`; return; }
      const midi = score.notes[played.length].midi;
      const name = midi === 60 ? 'C4' : midi === 72 ? 'C5' : pianoNoteName(midi);
      status.textContent = `${prefix}Next note ${name}.`;
    }

    function stopPlayback() {
      if (!playback) return false;
      clearTimeout(playback.timer);
      playback = null;
      playbackIndex = null;
      const note = sounding;
      sounding = null;
      syncKey(note);
      controls.listen.textContent = 'Hear score';
      return true;
    }

    function hearScore() {
      const run = { chart: score, started: performance.now(), beats: 0, timer: null };
      playback = run;
      controls.listen.textContent = 'Stop playback';
      status.textContent = `Listening to ${run.chart.name}.`;
      const advance = (index) => {
        if (playback !== run || !panel.isConnected || panel.ownerDocument.hidden) { if (playback === run) stopPlayback(); return; }
        const note = run.chart.notes[index];
        if (!note) {
          stopPlayback();
          drawScore();
          if (mode === 'practice') nextMessage('Playback finished. ');
          else status.textContent = 'Playback finished.';
          return;
        }
        const previous = sounding;
        sounding = note.midi;
        playbackIndex = index;
        syncKey(previous);
        syncKey(sounding);
        const duration = note.beats * 60000 / run.chart.bpm;
        game.audio?.playPiano?.(note.midi, duration / 1000);
        drawScore();
        run.beats += note.beats;
        const nextAt = run.started + run.beats * 60000 / run.chart.bpm;
        run.timer = setTimeout(() => advance(index + 1), Math.max(0, nextAt - performance.now()));
      };
      advance(0);
    }

    function playNote(midi) {
      if (!keys.has(midi) || !panel.isConnected) return;
      const stopped = stopPlayback();
      game.audio?.playPiano?.(midi);
      if (mode !== 'practice') {
        if (stopped) drawScore();
        if (mode === 'browse') mode = 'free';
        if (mode === 'free' && (stopped || status.textContent !== 'Free play. Start a score to earn Music XP.')) {
          status.textContent = 'Free play. Start a score to earn Music XP.';
        }
        return;
      }
      if (score.notes[played.length].midi !== midi) {
        if (stopped) drawScore();
        nextMessage('Try again. Your place is kept. ');
        return;
      }
      played.push(midi);
      if (played.length === score.notes.length) {
        // Change mode before awarding XP, so an extra input cannot submit the same performance again.
        mode = 'complete';
        const result = finishPianoLesson(game, score.id, played);
        status.textContent = result
          ? `${score.name} complete. +${formatNumber(result.xp)} Music XP${result.first ? ' with the first-clear bonus' : ''}.`
          : 'Score complete. Return to an available stage to earn Music XP.';
      } else nextMessage();
      drawScore();
    }

    function release(input, id) {
      const midi = input.get(id);
      input.delete(id);
      syncKey(midi);
    }

    function flash(midi) {
      clearTimeout(flashes.get(midi));
      flashes.set(midi, setTimeout(() => { flashes.delete(midi); syncKey(midi); }, 150));
      syncKey(midi);
    }

    // Focus stays on the keyboard while the staff redraws, so computer keys work without reselecting a piano key.
    keyboard.addEventListener('keydown', (event) => {
      const midi = pianoMidiForKey(event.key);
      if (midi == null || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); event.stopPropagation();
      const id = event.code || event.key.toLowerCase();
      if (event.repeat || heldKeys.has(id)) return;
      heldKeys.set(id, midi);
      syncKey(midi);
      playNote(midi);
    });
    keyboard.addEventListener('keyup', (event) => {
      const id = event.code || event.key.toLowerCase();
      if (!heldKeys.has(id)) return;
      event.preventDefault(); event.stopPropagation();
      release(heldKeys, id);
    });
    keyboard.addEventListener('focusout', (event) => {
      if (keyboard.contains(event.relatedTarget)) return;
      for (const id of heldKeys.keys()) release(heldKeys, id);
    });

    for (const [midi, key] of keys) {
      key.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        key.setPointerCapture?.(event.pointerId);
        heldPointers.set(event.pointerId, midi);
        syncKey(midi);
        playNote(midi);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        key.addEventListener(type, (event) => release(heldPointers, event.pointerId));
      }
      key.addEventListener('click', (event) => {
        // Native keyboard and assistive-technology clicks have no pointerdown.
        if (event.detail !== 0) return;
        flash(midi);
        playNote(midi);
      });
    }

    controls.practice.addEventListener('click', () => {
      stopPlayback();
      if (!pianoLessonAvailable(game, score)) { status.textContent = accessMessage(); drawScore(); return; }
      mode = 'practice';
      played = [];
      nextMessage(showNames ? 'Play the highlighted key at your own pace. ' : 'Play at your own pace. ');
      drawScore();
      keys.get(showNames ? score.notes[0].midi : 60)?.focus({ preventScroll: true });
    });
    controls.free.addEventListener('click', () => {
      stopPlayback();
      mode = 'free';
      played = [];
      status.textContent = 'Free play. Start a score to earn Music XP.';
      drawScore();
      keys.get(60)?.focus({ preventScroll: true });
    });
    controls.listen.addEventListener('click', () => {
      if (!stopPlayback()) { hearScore(); return; }
      if (mode === 'practice') nextMessage('Playback stopped. ');
      else status.textContent = accessMessage();
      drawScore();
    });
    controls.back.addEventListener('click', () => { stopPlayback(); onBack(); });
    for (const [name, step] of [['previous', -1], ['next', 1]]) {
      controls[name].addEventListener('click', () => {
        sheetPage += step;
        drawScore();
        if (controls[name].disabled) controls[step > 0 ? 'previous' : 'next'].focus({ preventScroll: true });
      });
    }
    controls.travel.addEventListener('click', () => {
      stopPlayback();
      if (game.travelToTile(islandSiteTile(game.world, STAGES[0]))) ui.closeModal();
      else status.textContent = 'There is no safe route to the stage from here.';
    });
    panel.querySelector('[data-piano-score]').addEventListener('change', (event) => {
      const selected = PIANO_SCORES.find((entry) => entry.id === event.target.value);
      if (!selected) return;
      stopPlayback();
      score = selected;
      sheetStarts = pianoStaffStarts(score);
      sheetPage = 0;
      mode = 'browse';
      played = [];
      status.textContent = accessMessage();
      drawScore();
    });
    panel.querySelector('[data-piano-names]').addEventListener('change', (event) => {
      showNames = event.target.checked;
      drawScore();
      if (mode === 'practice' && playbackIndex === null) nextMessage();
    });
    status.textContent = accessMessage();
    drawScore();
  });
  return true;
}
