import { chooseFirstJourney, chooseFirstDestination, FIRST_JOURNEY_PLACES, FIRST_JOURNEY_TITLE, skipFirstJourney } from '../game/firstjourney.js';
import { bestSource } from '../game/whatnext.js';
import { knownBossMove } from '../game/bosspractice.js';
import { openBossPractice } from './bosspracticeui.js';
import { finishResumeTask, resumeTaskText } from '../game/resumetask.js';

const PLACES = {
  'Bukit Timah': 'Explore the forest trails.',
  'MacRitchie Reservoir': 'Find fishing spots by the water.',
  Chinatown: 'Visit the market and meet Madam Tan.',
};

export function openFirstJourney(ui) {
  const game = ui.game;
  game.firstJourney ||= { phase: 'offer' };
  const j = game.firstJourney;
  if (j.phase === 'done' || j.phase === 'skipped') {
    return game.msg(j.phase === 'done' ? 'You have completed your first journey.' : 'You chose to explore independently.', 'system');
  }
  ui.openModal(FIRST_JOURNEY_TITLE, (body) => {
    const choices = j.phase === 'explore' ? FIRST_JOURNEY_PLACES.map((name) => [name, PLACES[name], () => chooseFirstDestination(game, name)])
      : j.phase === 'offer' ? [
        ['Combat', 'Defeat a rat on the slopes, then bank some loot.', () => chooseFirstJourney(game, 'combat')],
        ['Gathering', 'Chop a tree and take your first logs to the bank.', () => chooseFirstJourney(game, 'gather')],
      ] : [];
    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = j.phase === 'explore' ? 'Visit a district of your choice to earn 250 coins for future trips.'
      : 'Start with whichever sounds fun. You can leave this quest at any time.';
    body.appendChild(hint);
    for (const [title, detail, choose] of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'set-act';
      button.textContent = `${title} · ${detail}`;
      button.addEventListener('click', () => { ui.closeModal(); choose(); });
      body.appendChild(button);
    }
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'set-act';
    skip.textContent = 'Explore independently';
    skip.addEventListener('click', () => { skipFirstJourney(game); ui.closeModal(); });
    body.appendChild(skip);
  });
}

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function installJourneyNotices(ui) {
  const previous = ui.noticeAct;
  ui.noticeAct = (action) => {
    if (action === 'resume-task' || action === 'dismiss-resume') {
      if (finishResumeTask(ui.game, action === 'resume-task') || action === 'dismiss-resume') ui.lane?.dismissTag('resume-task');
    } else if (action.startsWith('practice:')) openBossPractice(ui, action.slice(9));
    else if (action.startsWith('unlock:')) {
      const skill = action.slice(7), unlock = ui.progressionUnlocks?.get(skill);
      if (!unlock) return;
      if (unlock.source && !unlock.source.depleted && ui.game.goToObject(unlock.source)) return;
      if (unlock.gear) ui.showPanelView('equipment');
      else ui.openSkillGuide(skill);
    } else previous?.call(ui, action);
  };
  ui.game.bus.on('bosslesson', ({ id, name, tip }) => {
    const button = knownBossMove(id)?.hazards?.length
      ? ` <button type="button" class="nl-act" data-act="practice:${esc(id)}">Practise</button>` : '';
    ui.lane?.push({ kind: 'note', key: `bosslesson:${id}`, priority: 2, ttl: 16000,
      html: `<b>${esc(name)}</b> · ${esc(tip)}${button}` });
  });
}

export function showResumeNotice(ui) {
  const game = ui.game;
  if (!game.resumeTask) return;
  const place = game.currentZoneName || 'Singapore';
  ui.lane?.push({ kind: 'note', key: 'resume-task', tag: 'resume-task', priority: 2, ttl: 20000,
    html: `<b>Back in ${esc(place)}</b> · ${esc(resumeTaskText(game))} <button type="button" class="nl-act" data-act="resume-task">Resume</button> <button type="button" class="nl-act" data-act="dismiss-resume">Dismiss</button>` });
}

export function showProgressionUnlock(ui, skill, from, to, news) {
  if (!ui.lane || !(news.gather.length || news.make.length || news.gear.length)) return;
  const pick = news.gather.length
    ? bestSource(ui.game, skill, (s) => s.level > from && s.level <= to)
    : null;
  const title = pick?.src.name || news.gather[0] || news.make[0] || news.gear[0];
  const gear = !news.gather.length && !news.make.length;
  (ui.progressionUnlocks ||= new Map()).set(skill, { source: pick?.obj, gear });
  const place = pick && ui.game.world.zoneAt(pick.obj.x, pick.obj.y)?.name;
  ui.lane.push({ kind: 'note', key: `unlock:${skill}:${to}`, tag: `unlock:${skill}`, priority: 1, ttl: 8500,
    html: `<b>Unlocked: ${esc(title)}</b>${place ? ` · ${esc(place)}` : ''} <button type="button" class="nl-act" data-act="unlock:${esc(skill)}">${pick ? 'Go' : gear ? 'Gear' : 'Skill guide'}</button>` });
}
