import { ISLAND_BY_ID, STAGES, TUNES } from '../data/islandlife.js';
import { MUSIC_PROJECTS, musicBeatMs, musicBeatWindow, musicChartByKey, musicChartNotes, musicProjectChart, musicTuneChart } from '../data/islandmusic.js';
import { atIslandSite, islandBook, islandClaimed, islandMusicAvailable, islandPractised, islandReady, islandSiteTile, learnIslandTune, musicStage, performIslandMusic } from '../game/islandlife.js';
import { lifePerkText } from '../game/lifeperks.js';
import { nextUnlock, skillTeleport, skillTeleportOf } from '../game/skillunlocks.js';
import { skillIconSVG } from '../render/icons.js';
import { bindIslandMarket, islandMarketHTML, islandProgressHTML } from './islandprogressui.js';
import { openIslandPiano } from './islandpianoui.js';

const NOTE_NAMES = ['Low', 'Middle', 'High'];
const button = (label, key, disabled = false, attrs = '') => `<button type="button" class="wm-go" data-music="${key}"${disabled ? ' disabled' : ''}${attrs}>${label}</button>`;
const row = (title, description, actions = '') => `<section class="island-row"><div><b>${title}</b><small>${description}</small></div><div class="island-actions">${actions}</div></section>`;

export function startMusicAttempt(chart) {
  return { chart, score: musicChartNotes(chart), notes: [], timings: [], beatStart: null };
}

// A slip leaves the score and the player's place intact. Timing is only recorded for an optional challenge.
export function playMusicNote(attempt, note, now) {
  if (attempt.notes.length >= attempt.score.length || attempt.score[attempt.notes.length] !== note) return false;
  attempt.notes.push(note);
  if (attempt.beatStart !== null) attempt.timings.push(now - attempt.beatStart);
  return true;
}

export function previewIslandNotes(game, notes, { gap, isActive }) {
  const timers = notes.map((note, i) => setTimeout(() => {
    if (isActive()) game.audio?.play?.(`island-note-${note}`);
  }, i * gap));
  return () => timers.forEach(clearTimeout);
}

function performanceBoard(attempt) {
  const { chart, score, notes, beatStart } = attempt;
  const next = notes.length, beat = beatStart !== null;
  let start = 0;
  const phrases = chart.phrases.map((phrase) => {
    const tokens = phrase.notes.map((note, i) => {
      const step = start + i;
      return `<li${step === next ? ' class="current" aria-current="step"' : step < next ? ' class="passed"' : ''}>${NOTE_NAMES[note]}</li>`;
    }).join('');
    start += phrase.notes.length;
    return `<div>${chart.phrases.length > 1 ? `<b>${phrase.name}</b>` : ''}<ol class="music-phrase" role="list">${tokens}</ol></div>`;
  }).join('');
  return `<section class="island-challenge" aria-labelledby="music-tune">
    <h3 id="music-tune">${chart.name}</h3>
    <p>${beat ? 'Tap when the cue says Play now. You earn full completion XP at any pace.' : 'Play the highlighted note at your own pace. If you miss a note, try it again.'}</p>
    ${chart.partner ? `<p>Your partner’s call <strong>${chart.partner.map((note) => NOTE_NAMES[note]).join(' · ')}</strong> ${button('Hear partner', 'listen:partner')}</p>` : ''}
    <div class="music-phrases" aria-label="Sheet music">${phrases}</div>
    <p class="music-next" id="music-next"><strong>Next note</strong> ${NOTE_NAMES[score[next]]} <span>${next} of ${score.length} notes</span></p>
    ${beat ? '<div class="music-beat" data-beat-cue aria-hidden="true">Get ready</div>' : ''}
    <div class="music-keys" role="group" aria-label="Play a note">
      ${NOTE_NAMES.map((name, note) => button(`${name} <kbd>${note + 1}</kbd>`, `note:${note}`, false, ` aria-label="${name}" aria-keyshortcuts="${note + 1}" aria-describedby="music-next"${note === score[next] ? ' data-next-note' : ''}`)).join('')}
    </div>
    <div class="island-actions music-secondary">
      ${beat ? button('Switch to guided', 'guided') : next === 0 ? button('Try beat challenge (+25% XP max)', 'beat') : ''}
      ${!beat && chart.arrangement === 'standard' ? button('Hear tune', 'listen:tune') : ''}
      ${button('Return to tunes', 'back')}
    </div>
  </section>`;
}

function displayBeat(cue, attempt) {
  if (!cue || typeof requestAnimationFrame !== 'function') return;
  const beat = musicBeatMs(attempt.chart), tolerance = musicBeatWindow(attempt.chart);
  let label = '';
  const draw = (now) => {
    if (!cue.isConnected) return;
    const since = now - attempt.beatStart - (attempt.timings.at(-1) ?? 0);
    const onBeat = Math.abs(since - beat) <= tolerance;
    const next = onBeat ? 'Play now' : since < beat ? 'Get ready' : 'Play to reset the beat';
    if (label !== next) {
      cue.textContent = label = next;
      cue.classList.toggle('on-beat', onBeat);
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

export function openIslandMusic(ui, openSkill) {
  const game = ui.game, book = islandBook(game);
  let attempt = null, message = '', cancelPreview = () => {};
  const go = (stage) => button('Go', `go:${stage.id}`, game.skills.level('music') < stage.level);

  const songs = () => {
    const level = game.skills.level('music'), at = musicStage(game);
    const stages = STAGES.map((stage) => row(stage.name, stage.id === at?.id ? 'You’re here' : `Music level ${stage.level}`, atIslandSite(game, stage) ? '' : go(stage))).join('');
    const tunes = TUNES.map((tune) => {
      const known = book.tunes.includes(tune.id), performed = book.performed.includes(tune.id);
      const teacher = STAGES.find((stage) => stage.id === tune.stage);
      const standard = musicTuneChart(tune.id);
      const play = (chart, label) => button(label, `play:${chart.key}`, !islandMusicAvailable(game, chart));
      const main = known ? play(standard, 'Play') : button('Learn', `learn:${tune.id}`, !islandReady(game) || !at || level < tune.level || !!teacher && teacher.id !== at.id);
      const done = islandClaimed(game, `encore:${tune.id}`);
      const encore = known && performed && level >= 3 ? play(musicTuneChart(tune.id, 'encore'), done ? 'Encore played today' : 'Play encore') : '';
      const arrangements = known && level >= 25 ? play(musicTuneChart(tune.id, 'variation'), 'Play variation') + (level >= 50 ? play(musicTuneChart(tune.id, 'duet'), 'Play duet') : '') : '';
      return row(tune.name, `Level ${tune.level} · ${tune.notes.length} notes${performed ? ' · Performed' : ''}${teacher && !known ? ` · Learn at ${teacher.name}` : ''}`, main + encore + arrangements);
    }).join('');
    const projects = MUSIC_PROJECTS.map((project) => {
      const chart = musicProjectChart(project.id), stage = STAGES.find((entry) => entry.id === project.stage);
      const missing = project.tunes.filter((id) => !book.performed.includes(id));
      const label = islandPractised(game, 'music', chart.key) ? 'Play again' : 'Play set';
      const action = at?.id === stage.id ? button(label, `play:${chart.key}`, !islandMusicAvailable(game, chart)) : level >= project.level ? go(stage) : '';
      const names = chart.phrases.map((phrase) => phrase.name).join(' · ');
      const requirement = missing.length ? ' · Perform each tune first' : '';
      return row(project.name, `Level ${project.level} · ${names}${requirement}`, action);
    }).join('');
    const milestone = nextUnlock('music', level), teleport = skillTeleportOf(game, 'music');
    const reward = milestone || teleport ? row('Skill perks', milestone ? `Level ${milestone.level} · ${milestone.desc}` : 'All skill perks earned', teleport ? button('Skill teleport', 'teleport', !islandReady(game)) : '') : '';
    const stageList = `<h3>Stages</h3>${stages}`, tuneList = `<h3>Tunes</h3>${tunes}`;
    return `<p>${book.tunes.length ? 'Choose a tune at a stage. Guided play earns full XP.' : 'Visit Kampong Glam hawker lane and learn Kopi Waltz. Follow the notes at your own pace.'}</p>
      ${islandProgressHTML(game, 'music')}${row('Piano', 'Play a score to earn Music XP, or try the keyboard.', button('Open piano', 'piano'))}
      ${at ? tuneList + stageList : stageList + tuneList}${islandMarketHTML(game, 'music')}
      <p class="music-progression">Variations at level 25 · Duets at level 50</p>
      <h3>Stage sets</h3>${projects}${reward}`;
  };

  const render = (body, focusKey) => {
    const level = game.skills.level('music');
    body.innerHTML = `<div class="island-panel island-music" style="--island-accent:${ISLAND_BY_ID.music.color}">
      <header>${skillIconSVG('music', 32)}<div><b>Music · Level ${level}</b><small>Combat · ${lifePerkText('music', level)}</small></div></header>
      <div class="island-status" role="status">${message}</div>${attempt ? performanceBoard(attempt) : songs()}</div>`;
    const buttons = [...body.querySelectorAll('[data-music]')];
    for (const control of buttons) control.addEventListener('click', () => action(body, control.dataset.music));
    if (focusKey) buttons.find((control) => control.dataset.music === focusKey && !control.disabled)?.focus({ preventScroll: true });
    if (!attempt) { bindIslandMarket(body, openSkill); return; }
    const panel = body.querySelector('.island-music');
    panel.addEventListener('keydown', (event) => {
      if (!/^[123]$/.test(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) action(body, `note:${Number(event.key) - 1}`);
    });
    if (attempt.beatStart !== null) displayBeat(panel.querySelector('[data-beat-cue]'), attempt);
  };

  function action(body, key) {
    const split = key.indexOf(':'), act = split < 0 ? key : key.slice(0, split), id = split < 0 ? '' : key.slice(split + 1);
    message = '';
    let focus = key;
    if (act === 'piano') { cancelPreview(); openIslandPiano(ui, () => openIslandMusic(ui, openSkill)); return; }
    if (act === 'go') {
      const stage = STAGES.find((entry) => entry.id === id);
      if (stage && game.travelToTile(islandSiteTile(game.world, stage))) { ui.closeModal(); return; }
      message = 'There is no safe route from here.';
    }
    if (act === 'teleport' && (!islandReady(game) || !skillTeleport(game, 'music'))) message = 'Skill teleport is unavailable right now.';
    if (act === 'learn') {
      message = learnIslandTune(game, id) ? 'Tune learned. Choose Play to try it.' : 'You can’t learn that tune at this stage yet.';
      focus = `play:${musicTuneChart(id)?.key}`;
    }
    if (act === 'play') {
      const chart = musicChartByKey(id);
      if (!islandMusicAvailable(game, chart)) message = 'This performance is unavailable here.';
      else { attempt = startMusicAttempt(chart); focus = `note:${attempt.score[0]}`; }
    }
    if (act === 'back') {
      cancelPreview(); focus = `play:${attempt.chart.key}`; attempt = null;
    }
    if (act === 'beat') { attempt.beatStart = performance.now(); focus = `note:${attempt.score[attempt.notes.length]}`; }
    if (act === 'guided') { attempt.beatStart = null; attempt.timings = []; focus = `note:${attempt.score[attempt.notes.length]}`; }
    if (act === 'listen') {
      cancelPreview();
      const turn = attempt, panel = body.querySelector('.island-music');
      const phrase = id === 'partner' ? attempt.chart.partner : attempt.score;
      cancelPreview = previewIslandNotes(game, phrase, { gap: 280, isActive: () => attempt === turn && panel.isConnected });
      return;
    }
    if (act === 'note' && attempt) {
      cancelPreview();
      const note = Number(id), correct = playMusicNote(attempt, note, performance.now());
      if (!correct) message = `Try ${NOTE_NAMES[attempt.score[attempt.notes.length]]}. Your place is saved.`;
      else {
        game.audio?.play?.(`island-note-${note}`);
        if (attempt.notes.length === attempt.score.length) {
          const { chart, notes, timings, beatStart } = attempt;
          const result = performIslandMusic(game, chart.key, notes, { mode: beatStart === null ? 'guided' : 'beat', timings });
          message = result ? `${chart.name} complete.${result.tip ? ` The crowd tipped ${result.tip} coins.` : ''}${result.first ? ' First performance bonus earned.' : ''}${result.quality > 0 ? ` Beat bonus +${Math.round(result.quality * 25)}% XP.` : ''}` : 'This stage is no longer available. Try again when you can perform here.';
          focus = `play:${chart.key}`;
          attempt = null;
        }
      }
    }
    const top = body.scrollTop;
    render(body, focus);
    body.scrollTop = act === 'play' ? 0 : top;
  }

  ui.openModal('Music', render);
  return true;
}
