// The UI for gathering extras and teleports (game/gathering.js, game/teleports.js):
//  - the Town (K) and Grave (R) teleport buttons, in the card of auto switches
//    (on phones that card folds into the Auto button, so they're there too);
//  - Cikgu Surya's skilling contracts window;
//  - tracker lines for today's contracts and a gathering streak.
// Kept out of ui.js, which only installs this and asks for the tracker lines.

import { Gathering, STREAK_XP_STEP, streakTier, contractStreakMult } from '../game/gathering.js';
import { Teleports, TOWN_KEY, GRAVE_KEY, CAST_TICKS, TOWN_COOLDOWN_TICKS } from '../game/teleports.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { skillIconSVG } from '../render/icons.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const skillName = (id) => SKILL_BY_ID[id]?.name || id;

/** Tracker lines: a running gathering streak and today's unfinished contracts. */
export function lifeTrackerRows(ui) {
  const g = ui.game, rows = [];
  const s = g.gathering?.streak;
  if (s && s.count >= 5) {
    const tier = streakTier(s.count);
    rows.push(`<div class="trk-row"><span class="trk-ic">${skillIconSVG(s.skill, 14)}</span>${esc(skillName(s.skill))} streak <span class="trk-prog">${s.count}${tier ? ` · +${Math.round(tier * STREAK_XP_STEP * 100)}% XP` : ''}</span></div>`);
  }
  const c = g.gathering?.contracts;
  if (c && c.day === g.todayKey?.()) {
    for (const k of c.list.filter((x) => !x.done).slice(0, 2)) {
      rows.push(`<div class="trk-row"><span class="trk-ic">${skillIconSVG(k.skill, 14)}</span>${esc(Gathering.contractText(k))} <span class="trk-prog">${k.have}/${k.need}</span></div>`);
    }
  }
  return rows;
}

/** Cikgu Surya's contracts board. */
export function openSkillContracts(ui) {
  const g = ui.game, G = g.gathering;
  if (!G) return;
  G.ensureContracts();
  const render = (body) => {
    const c = G.contracts;
    const mult = Math.round((contractStreakMult(c.streak) - 1) * 100);
    body.innerHTML = '<div class="dialogue"><div class="speaker">Cikgu Surya</div>'
      + 'Three skilling contracts a day, lah! Gather at the nodes I name and I pay the moment you finish, '
      + 'coins and a good helping of XP. Clear all three for a bonus, and come back tomorrow to build a streak.</div>'
      + `<div class="lsx-list">${c.list.map((k) => `<div class="lsx-row${k.done ? ' done' : ''}">`
        + `<span class="lsx-ic">${skillIconSVG(k.skill, 26)}</span>`
        + `<span class="lsx-text"><b>${esc(Gathering.contractText(k))}</b><small>${esc(skillName(k.skill))} · ${k.done ? 'done' : `${k.have}/${k.need}`} · ${Math.round(k.coins * contractStreakMult(c.streak))} coins, ${k.xp} XP</small></span>`
        + `<span class="lsx-bar"><i style="width:${Math.round((k.have / k.need) * 100)}%"></i></span></div>`).join('')
        || '<div class="lsx-row">No contracts today: train a gathering skill first.</div>'}</div>`
      + `<div class="modal-hint">Contract streak: <b>${c.streak}</b> day${c.streak === 1 ? '' : 's'}${mult ? ` (+${mult}% pay)` : ''}. `
      + 'Gathering in a row builds a streak of its own (more XP, likelier lucky finds), and the resource zones on the world map are the busiest places to do it.</div>';
  };
  ui.openModal('Skilling contracts', render);
  ui.modal.kind = 'skillcontracts';
}

/** The Town and Grave buttons, added to the auto switches' card. */
class TeleportButtons {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = null;
    this._sig = '';
  }
  _panel() {
    if (this.el || typeof document === 'undefined') return this.el;
    const row = document.getElementById('auto-row');
    if (!row) return null;
    const el = document.createElement('div');
    el.id = 'tp-row';
    el.innerHTML = `<button id="tp-town" class="tp-btn" type="button" title="Teleport to Kampong Glam (${TOWN_KEY}): stand still for ${Teleports.secs(CAST_TICKS)}s; recharges in ${Math.round(TOWN_COOLDOWN_TICKS * 0.6 / 60 * 10) / 10} minutes">`
      + `<b class="ab-label">Town <kbd>${TOWN_KEY}</kbd></b><span class="ab-status"></span></button>`
      + `<button id="tp-grave" class="tp-btn hidden" type="button" title="Teleport to your gravestone (${GRAVE_KEY}): stand still for ${Teleports.secs(CAST_TICKS)}s">`
      + `<b class="ab-label">Grave <kbd>${GRAVE_KEY}</kbd></b><span class="ab-status"></span></button>`;
    el.querySelector('#tp-town').addEventListener('click', () => this.game.teleports?.start('town'));
    el.querySelector('#tp-grave').addEventListener('click', () => this.game.teleports?.start('grave'));
    const cfg = document.getElementById('auto-battle-cfg');
    if (cfg) row.insertBefore(el, cfg); else row.appendChild(el);
    this.el = el;
    return el;
  }
  render() {
    const T = this.game.teleports, el = this._panel();
    if (!el || !T) return;
    const town = T.status('town'), grave = T.status('grave');
    const sig = `${town.status}|${grave.status}|${T.hasGrave()}`;
    if (sig === this._sig) return;
    this._sig = sig;
    const set = (b, st) => {
      b.querySelector('.ab-status').textContent = st.status;
      b.classList.toggle('on', !!st.busy);
      b.classList.toggle('wait', !st.ready && !st.busy);
    };
    set(el.querySelector('#tp-town'), town);
    const gb = el.querySelector('#tp-grave');
    gb.classList.toggle('hidden', !T.hasGrave());
    set(gb, grave);
  }
}

/** Wire it all up (once, from UI.init). */
export function installLifeSkillUI(ui) {
  if (ui._lifeSkillUI) return;
  ui._lifeSkillUI = true;
  const bus = ui.game.bus;
  const tp = new TeleportButtons(ui);
  for (const ev of ['tick', 'teleport', 'play']) bus.on(ev, () => tp.render());
  tp.render();
  // The dialogue closes itself after its option runs, so open the board just after.
  bus.on('skillcontractsopen', () => setTimeout(() => openSkillContracts(ui), 0));
  const refresh = () => {
    if (ui.modal?.kind === 'skillcontracts' && ui.el?.modalBody) ui.modal.render(ui.el.modalBody);
    ui.renderTracker?.();
  };
  for (const ev of ['skillcontracts', 'gatherstreak']) bus.on(ev, () => (ui._soon ? ui._soon('lifeskill', refresh, 250) : refresh()));
}
