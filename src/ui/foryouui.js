// The "For you" section of the Codex window: where to train each life skill
// at your level (with a rough XP an hour), monsters your weapon is strong
// against, the regions with the most monsters at your level, and gear you
// could wear now that beats what you have on. The facts come from
// src/game/foryou.js; the buttons are handled by encyclopediaui.js.
import { getItem } from '../data/items.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { formatNumber } from '../core/utils.js';
import { itemIconSVG } from '../render/icons.js';
import { bestSpotsFor } from '../game/skillguide.js';
import { TRAIN_SKILLS, trainingFor, preyFor, strongRaces, weaponName, gearUpgrades } from '../game/foryou.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const where = (zs, n = 2) => (zs.length ? esc(zs.slice(0, n).join(', ')) + (zs.length > n ? ` +${zs.length - n}` : '') : '');

/** The whole For you page. */
export function forYouHTML(game) {
  if (!game?.skills) return '<div class="modal-hint">Nothing to suggest yet.</div>';
  let html = '<div class="cp-intro">What suits you right now, from your levels and what you wear. XP an hour is a rough "up to": walking and banking are not counted.</div>';
  // ---- Training ----
  html += '<section class="cx-sec"><h3 class="ency-h3">Train your skills</h3>';
  for (const skill of TRAIN_SKILLS) {
    const spots = trainingFor(game, skill, 1);
    const lvl = game.skills.level(skill);
    const s = spots[0];
    html += `<div class="ency-line ency-train"><span><b><span class="ency-link" role="button" tabindex="0" data-ency="skill:${esc(skill)}">${esc(SKILL_BY_ID[skill]?.name || skill)}</span> ${formatNumber(lvl)}</b>` +
      (s ? `: ${esc(s.name)} <small>(lvl ${formatNumber(s.level)} · up to ~${formatNumber(s.xph)} xp/h${s.regions.length ? ` · ${where(s.regions)}` : ''})</small>`
        : ' <small>nothing at this level yet</small>') + '</span>' +
      (s?.objIds ? `<button type="button" class="wm-go" data-go="${esc(s.objIds.join(','))}">Go</button>` : s?.npcId ? `<button type="button" class="wm-go" data-npc="${esc(s.npcId)}">Go</button>` : '') + '</div>';
  }
  html += '</section>';
  // ---- Hunting ----
  const prey = preyFor(game);
  const races = strongRaces(game);
  const fight = game.fightLevel?.() || 1;
  html += `<section class="cx-sec"><h3 class="ency-h3">Hunt at fight level ${formatNumber(fight)}</h3>`;
  if (races.length) html += `<div class="cx-note">Your ${esc(weaponName(game))} is strong against ${races.map((r) => `${r.icon} ${esc(r.name)}`).join(', ')}.</div>`;
  html += prey.length ? prey.map((m) => `<div class="ency-line"><span><span class="ency-link" role="button" tabindex="0" data-ency="monster:${esc(m.id)}">${game.kills?.[m.id] > 0 ? esc(m.name) : `${esc(m.race.icon)} An unknown ${esc(m.race.name.toLowerCase())}`}</span> <small>lvl ${formatNumber(m.level)} · ${where(m.regions)}</small></span>` +
    `<button type="button" class="wm-go" data-npc="${esc(m.id)}">Go</button></div>`).join('')
    : '<div class="modal-hint">No monster near your level is weak to your weapon: try the regions below.</div>';
  const spots = bestSpotsFor(game, fight, 3);
  if (spots.length) {
    html += `<h4 class="ency-h4">Regions with the most monsters at your level</h4><div class="cp-chips">${spots.map((s) =>
      `<button type="button" class="cp-chip ency-chip" data-region="${esc(s.region)}">🗺️ ${esc(s.region)} <small>${formatNumber(s.near.length)}</small></button>`).join('')}</div>`;
  }
  html += '</section>';
  // ---- Gear ----
  const ups = gearUpgrades(game);
  html += '<section class="cx-sec"><h3 class="ency-h3">Gear you could wear now</h3>';
  html += ups.length ? ups.map((u) => `<div class="ency-line ency-gear"><button type="button" class="sgx-item" data-item="${esc(u.id)}">${itemIconSVG(u.id, 28)}<span>${esc(getItem(u.id).name)}</span></button>` +
    `<span class="ency-gear-why"><small>${esc(u.slot)}: +${formatNumber(u.gain)} rating${u.worn ? ` over ${esc(getItem(u.worn).name)}` : ' (slot empty)'}` +
    (u.source ? ` · ${{ node: 'gather', shop: 'buy from', drop: 'drops from' }[u.source.kind]} ${esc(u.source.label)}` : u.make ? ` · make it (${esc(SKILL_BY_ID[u.make.skill]?.name || u.make.skill)} ${formatNumber(u.make.level)})` : '') + '</small></span></div>').join('')
    : '<div class="modal-hint">Nothing you can wear yet beats your gear. Well kitted out!</div>';
  return html + '</section>';
}
