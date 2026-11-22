// The skill guides and the Resources index, drawn from src/game/skillguide.js.
//
//  - A gathering skill's guide lists every node (level, XP, what it gives and
//    how often, tool, respawn, the regions that hold one) with Go, Map and the
//    auto-gather tick boxes.
//  - A making skill's guide lists every recipe (level, XP, inputs with what
//    you hold in the bag and bank, the station and where to find one) and
//    whether you can make it now.
//  - A fighting skill's guide lists its perks, the gear its levels unlock and
//    where to train.
//  - Resources: a searchable index of every material and product. An item's
//    page says where it comes from and what it goes into, one step further
//    too; tapping any item opens its own page, so the whole production tree
//    can be walked. Back steps out again.
//
// Long lists are drawn a page at a time ("Show more"), so the guides stay quick
// on phones. Every tappable thing is a <button>, so a phone sheet's drag never
// swallows the tap (see PRESSABLE in ui.js).
import { getItem, ITEMS } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { SKILLS } from '../data/skills.js';
import { OBJECTS } from '../data/objects.js';
import { formatNumber, AOrAn } from '../core/utils.js';
import { XP_RATE } from '../config.js';
import { itemIconSVG, skillIconSVG, playIconHTML } from '../render/icons.js';
import { chanceText, codexHabitats } from '../game/codex.js';
import { unlockLadder, skillTeleportOf, skillTeleportWait, skillTeleport } from '../game/skillunlocks.js';
import { STATION_BY_ID } from '../data/transport.js';
import { toolLadder } from '../game/tools.js';
import { levelHaulPct, LEVEL_HAUL_PER, LEVEL_HAUL_CAP } from '../game/levelhaul.js';
import {
  SKILL_GUIDES, GATHER_SKILLS, COMBAT_SKILLS, TOOL_NAMES, gatherSources, recipesFor, recipeLabel, recipeKindTitle, canMake,
  regionsOf, nearestObject, groveList, fishSpotList, itemEntry, searchResources, RESOURCE_CATS, resourceIndex, perkLadder, gearTiers, trainingSpots, bestSpotsFor, combatExtras,
} from '../game/skillguide.js';

export const PAGE = 30;
// Mining, Woodcutting and Fishing: tick the kinds you want and auto gather
// works through exactly those, taking turns between them.
const PICK_SKILLS = new Set(['mining', 'woodcutting', 'fishing']);
const AUTO_TEXT = {
  woodcutting: 'when a tree, rock or spot runs dry, move on to the next one nearby. Gather more than one kind (say copper and tin) and it takes turns between them',
  mining: 'when a tree, rock or spot runs dry, move on to the next one nearby. Gather more than one kind (say copper and tin) and it takes turns between them',
  fishing: 'when a tree, rock or spot runs dry, move on to the next one nearby. Gather more than one kind (say copper and tin) and it takes turns between them',
  hunter: 'when a trap or trail runs dry, move on to the next one nearby',
  farming: 'harvest ripe patches and replant with your best seed, patch after patch',
  thieving: 'keep picking the same pocket after each try',
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iname = (id) => (ITEMS[id] ? getItem(id).name : id);
const aOrAn = (w) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
const qtyText = (min, max) => (max > min ? `${formatNumber(min)}-${formatNumber(max)} × ` : min > 1 ? `${formatNumber(min)} × ` : '');
/** A tappable item: icon and name, opening its Resources page. */
const itemBtn = (id, extra = '', size = 20) => `<button type="button" class="sgx-item" data-item="${esc(id)}" title="${esc(iname(id))}">${itemIconSVG(id, size)}<span>${extra}${esc(iname(id))}</span></button>`;
const regionsText = (zs, n = 4) => (zs.length ? esc(zs.slice(0, n).join(', ')) + (zs.length > n ? ` and ${zs.length - n} more` : '') : 'nowhere on the map yet');
const pagedMore = (shown, total) => (total > shown ? `<button type="button" class="cx-more sgx-more" data-more="1">Show more (${formatNumber(total - shown)} left)</button>` : '');

/** "Auto gather: 3 picked (Runite, Adamantite, Magic tree) · Untick all (3)", across
 *  every skill, or '' when nothing is ticked. The button carries data-untick. */
export function gatherPicksHTML(game) {
  const ids = [...(game.gatherPicks || [])];
  if (!ids.length) return '';
  const names = ids.map((id) => OBJECTS[id]?.name || id);
  return `<div class="sgx-picked"><span><b>Auto gather:</b> ${ids.length} picked (${esc(names.slice(0, 6).join(', '))}${names.length > 6 ? ` and ${names.length - 6} more` : ''})</span>`
    + `<button type="button" class="wm-go" data-untick="1">Untick all (${ids.length})</button></div>`;
}

// ---------------- Rows ----------------

/** The XP you really get for one log, fish, ore or make: the listed amount
 *  times the game's XP rate and the life-skill boost for your level, as
 *  Skills.addXp adds it (golden hours, worn as a bonus on top, left out). */
export function realXp(game, skill, xp) {
  return (xp || 0) * XP_RATE * (game?.skills?.lifeXpMult ? game.skills.lifeXpMult(skill) : 1);
}
/** That XP as a badge beside a row's name. */
export const xpBadge = (n, each = true) => `<span class="sgx-xp" title="Experience you get${each ? ' for each one' : ''}">+${formatNumber(Math.round(n))} xp${each ? ' each' : ''}</span>`;

function sourceRowHTML(game, s, st) {
  const lvl = game.skills.level(s.skill);
  const ok = lvl >= s.level;
  const picking = PICK_SKILLS.has(s.skill) && ok && s.objIds;
  const ticked = picking && s.objIds.every((id) => game.gatherPicks.has(id));
  const facts = [s.tool && `needs ${TOOL_NAMES[s.tool] || s.tool}`,
    s.respawn !== undefined && s.objIds && s.skill !== 'agility' && (s.respawn ? `respawns in ${Math.round(s.respawn * 0.6)}s` : 'never runs dry'),
    s.lasts > 1 && `about ${s.lasts} a node`].filter(Boolean).join(' · ');
  const gives = s.gives.map((g) => `<span class="sgx-give${g.rare ? ' rare' : ''}">${itemBtn(g.id, qtyText(g.min || 1, g.max || 1))}<i>${g.chance >= 0.999 ? '' : chanceText(g.chance)}</i></span>`).join('');
  const where = s.objIds ? regionsOf(game, s.objIds) : s.npcId ? npcRegions(game, s.npcId) : null;
  const spot = s.spot && s.spot !== s.name ? ` <small>at ${esc(aOrAn(s.spot.toLowerCase()))}</small>` : '';
  return `<div class="sg-row sgx-row${ok ? '' : ' locked'}">`
    + (picking ? `<label class="sg-pick" title="Auto gather this"><input type="checkbox" data-pick="${esc(s.objIds.join(','))}"${ticked ? ' checked' : ''}></label>` : '')
    + `<span class="sg-lvl">${s.level}</span><span class="sg-text sgx-text"><b>${esc(s.name)}${spot} ${xpBadge(realXp(game, s.skill, s.xp))}</b><span>${facts}${s.note && !s.spot ? ` · ${esc(s.note)}` : ''}</span>`
    + (gives ? `<span class="sgx-gives">${gives}</span>` : '')
    + (where ? `<span class="sgx-where">&#128205; ${regionsText(where)}</span>` : '') + '</span>'
    + `<span class="sgx-btns">${s.objIds ? `<button type="button" class="wm-go" data-go="${esc(s.objIds.join(','))}"${ok ? '' : ' disabled'}>Go</button><button type="button" class="wm-go cx-map" data-map="${esc(s.objIds.join(','))}" data-label="${esc(s.name)}">Map</button>`
      : s.npcId ? `<button type="button" class="wm-go" data-npc="${esc(s.npcId)}">Go</button>` : ''}</span></div>`;
}

function recipeRowHTML(game, r, { showSkill = false } = {}) {
  const c = canMake(game, r);
  const ins = c.inputs.map((i) => {
    const enough = i.bag >= i.qty ? 'have' : i.bag + i.bank >= i.qty ? 'bank' : 'short';
    return `<span class="sgx-in ${enough}">${itemBtn(i.id, `${i.qty} × `)}<i title="In your bag · in the bank">${formatNumber(i.bag)}${i.bank ? ` · ${formatNumber(i.bank)} banked` : ''}</i></span>`;
  }).join('');
  const status = !c.levelOk ? `<span class="sgx-st lock">Needs ${esc(skillName(r.skill))} ${r.level}</span>`
    : c.ok ? `<span class="sgx-st ok">Can make${c.times > 1 ? ` ×${formatNumber(c.times)}` : ''}${c.tool ? '' : ` (bring ${TOOL_NAMES[r.tool]})`}</span>`
    : c.okWithBank ? '<span class="sgx-st bank">Inputs in the bank</span>' : '<span class="sgx-st short">Need inputs</span>';
  const out = r.output ? itemBtn(r.output.id, r.output.max ? qtyText(r.output.qty, r.output.max) : r.output.qty > 1 ? `${r.output.qty} × ` : '', 24) : `<b>${esc(recipeLabel(r))}</b>`;
  const facts = [showSkill && `${skillName(r.skill)} ${r.level}`, recipeKindTitle(r.kind) !== skillName(r.skill) && recipeKindTitle(r.kind),
    r.stations.length ? `at ${r.stations.map((o) => aOrAn(OBJECTS[o]?.name.toLowerCase() || o)).join(' or ')}` : '', r.tool && `needs ${TOOL_NAMES[r.tool]}`, r.note].filter(Boolean).join(' · ');
  return `<div class="sg-row sgx-row${c.levelOk ? '' : ' locked'}"><span class="sg-lvl">${r.level}</span>`
    + `<span class="sg-text sgx-text"><span class="sgx-out">${out}${r.harvestXp ? `<span class="sgx-xp" title="Experience for planting, then for each crop you pick">+${formatNumber(Math.round(realXp(game, r.skill, r.xp)))} xp to plant · +${formatNumber(Math.round(realXp(game, r.skill, r.harvestXp)))} each picked</span>` : xpBadge(realXp(game, r.skill, r.xp))}${status}</span><span>${esc(facts)}</span>`
    + `<span class="sgx-ins">${r.kind === 'farm' || r.kind === 'burn' || r.kind === 'bury' ? '' : '<small>From</small>'}${ins}</span></span></div>`;
}

function npcRegions(game, npcId) {
  const zs = new Set();
  for (const n of game.npcs || []) if (n.npcId === npcId && !n.temporary) { const z = game.world.zoneAt?.(n.spawnX ?? n.x, n.spawnY ?? n.y)?.name; if (z) zs.add(z); }
  return [...zs];
}
function nearestNpc(game, npcId, region = null) {
  const p = game.player;
  let best = null, bd = Infinity;
  for (const n of game.npcs || []) {
    if (n.npcId !== npcId || n.temporary || n.wave) continue;
    const x = n.spawnX ?? n.x, y = n.spawnY ?? n.y;
    if (region && game.world.zoneAt?.(x, y)?.name !== region) continue;
    const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}

// ---------------- Views ----------------

function headHTML(game, skill) {
  const lvl = game.skills.level(skill);
  return `<div class="sg-head"><span class="skill-icon">${skillIconSVG(skill, 44)}</span><div><b>${esc(skillName(skill))} · level ${lvl}</b><span>${esc(SKILL_GUIDES[skill].use)}</span></div></div>`;
}

/** A life skill's unlock ladder (10/25/50/75/99), each rung locked or unlocked,
 *  with the skill's teleport button once it's open. '' for other skills. */
export function unlockLadderHTML(game, skill) {
  const lvl = game.skills.level(skill);
  const ladder = unlockLadder(skill, lvl);
  if (!ladder.length) return '';
  const tp = skillTeleportOf(game, skill), wait = skillTeleportWait(game);
  return `<div class="sgx-unlocks"><b>${playIconHTML('ui-skill_unlock', 18)} Unlocks</b>${ladder.map((u) => `<div class="sgx-unlock${u.unlocked ? ' on' : ''}">`
    + `<span class="sg-lvl">${u.level}</span><span><b>${u.unlocked ? '&#10003; ' : '&#128274; '}${esc(u.name)}</b><small>${esc(u.desc)}</small></span></div>`).join('')}`
    + (tp ? `<button type="button" class="wm-go sgx-tp" data-skilltp="${esc(skill)}"${wait ? ' disabled' : ''}>Teleport to ${esc(STATION_BY_ID[tp]?.name || tp)}${wait ? ` (${Math.ceil(wait * 0.6)}s)` : ''}</button>` : '')
    + '</div>';
}

/** A gathering skill's tool ladder (tooltiers.js): each tier's level, its
 *  tools and what they add, the one in use ticked. '' for other skills. */
export function toolLadderHTML(game, skill) {
  const rows = toolLadder(game, skill);
  if (!rows.length) return '';
  const tiers = [...new Set(rows.map((r) => r.tier))];
  // Your level's own steady bonus (levelhaul.js): a chance of one more of each haul.
  const lv = game.skills.level(skill), lp = levelHaulPct(lv);
  const lvLine = `<div class="sgx-unlock on"><span class="sg-lvl">${lv}</span><span><b>Your level</b> <small>${Math.round(lp * 10) / 10}% chance of a bonus one with each haul (+${LEVEL_HAUL_PER}% a level, up to ${LEVEL_HAUL_CAP}%); it never uses up the tree or rock</small></span></div>`;
  return `<div class="sgx-unlocks sgx-tools"><b>Tools <small>(the best one you carry and can use is picked for you)</small></b>${lvLine}${tiers.map((t) => {
    const rs = rows.filter((r) => r.tier === t), use = rs.some((r) => r.inUse);
    return `<div class="sgx-unlock${rs[0].usable ? ' on' : ''}"><span class="sg-lvl">${rs[0].level}</span><span><span class="sgx-gives">${rs.map((r) => itemBtn(r.id, r.inUse ? '&#10003; ' : '', 18)).join('')}</span>`
      + `<small>${esc(rs[0].bonus)}${use ? ' (in use)' : ''}</small></span></div>`;
  }).join('')}</div>`;
}

// How to start Hunter: the snare, where to get another, the first traps and bait.
const HUNTER_START = '<div class="sgx-howto"><b>How to start:</b> you begin with a hunting snare (a spare costs 10 coins at the Kampong General Store or Kranji Farm Supplies). '
  + 'The first traps are the bird snares just north of Kampong Glam. Carry hunter bait for more XP and a chance of double catches.</div>';

/** Firemaking's own start button: light a fire right here, best logs first
 *  (game.startFiremaking), with what you'd burn and what you're missing. */
export function fireStartHTML(game) {
  const tinder = game.hasTool('tinderbox');
  const logs = game.burnableLogs();
  const n = logs.reduce((t, id) => t + game.inventory.count(id), 0);
  const ok = tinder && logs.length > 0;
  const why = !tinder ? 'You need a tinderbox (the Kampong Guide hands one out).'
    : logs.length ? `Burns your best logs first: ${esc(iname(logs[0]))}${logs.length > 1 ? ` then ${logs.length - 1} more kind${logs.length > 2 ? 's' : ''}` : ''} (${formatNumber(n)} in your bag).`
      : 'No logs you can burn in your bag: chop some trees first.';
  return `<div class="sgx-howto sg-fire"><button type="button" class="wm-go sg-fire-btn" data-fire="1"${ok ? '' : ' disabled'}>Light a fire here</button><span>${why}</span></div>`;
}

function toolbarHTML(st, chips, placeholder) {
  return `<div class="cx-filters sgx-bar"><input class="bank-search cx-search sgx-search" type="search" placeholder="${esc(placeholder)}" value="${esc(st.search || '')}" aria-label="Search">`
    + `<button type="button" class="wm-go sgx-res" data-resources="1">Resources</button></div>`
    + (chips.length > 1 ? `<div class="sgx-chips">${chips.map((c) => `<button type="button" class="sgx-chip${st.filter === c.id ? ' on' : ''}" data-filter="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>` : '');
}

/** The rows of a skill guide that match the search and filter: { html, total }. */
export function skillListHTML(game, skill, st) {
  const t = (st.search || '').trim().toLowerCase();
  const lvl = game.skills.level(skill);
  let rows;
  if (GATHER_SKILLS.includes(skill) && skill !== 'farming') {
    let list = gatherSources().filter((s) => s.skill === skill);
    if (t) list = list.filter((s) => s.name.toLowerCase().includes(t) || s.gives.some((g) => iname(g.id).toLowerCase().includes(t)) || regionsOf(game, s.objIds || []).some((z) => z.toLowerCase().includes(t)));
    if (st.filter === 'now') list = list.filter((s) => s.level <= lvl);
    if (st.filter === 'next') list = list.filter((s) => s.level > lvl);
    rows = list.map((s) => () => sourceRowHTML(game, s, st));
  } else {
    let list = recipesFor(skill);
    if (t) list = list.filter((r) => recipeLabel(r).toLowerCase().includes(t) || r.inputs.some((i) => iname(i.id).toLowerCase().includes(t)));
    if (st.filter === 'now') list = list.filter((r) => canMake(game, r).ok);
    else if (st.filter === 'level') list = list.filter((r) => r.level <= lvl);
    else if (st.filter === 'next') list = list.filter((r) => r.level > lvl);
    else if (st.filter && st.filter.startsWith('kind:')) list = list.filter((r) => r.kind === st.filter.slice(5));
    rows = list.map((r) => () => recipeRowHTML(game, r));
  }
  const shown = st.shown || PAGE;
  const html = rows.slice(0, shown).map((f) => f()).join('');
  return { total: rows.length, html: `<div class="cx-count">${formatNumber(rows.length)} ${rows.length === 1 ? 'entry' : 'entries'}${rows.length > shown ? `, showing ${formatNumber(shown)}` : ''}</div>`
    + (html || '<div class="modal-hint">Nothing matches.</div>') + pagedMore(shown, rows.length) };
}

/** A fighting skill's guide: perks, gear by level, its extra list, and where to train. */
export function combatGuideHTML(game, skill) {
  const lvl = game.skills.level(skill);
  let html = '';
  const perks = perkLadder(skill);
  if (perks.length) {
    html += `<div class="skill-group">Passive perks <small>(one every 20 levels; past 200 they rank up)</small></div>`
      + perks.map((p) => `<div class="sg-row${lvl >= p.level ? ' sgx-got' : ' locked'}"><span class="sg-lvl">${p.level}</span><span class="sg-text"><b>${esc(p.name)}</b><span>${esc(p.desc)}</span></span></div>`).join('');
  }
  const gearSkill = skill === 'hitpoints' ? null : skill;
  const tiers = gearSkill ? gearTiers(gearSkill) : [];
  if (tiers.length) {
    html += `<div class="skill-group">Gear your level unlocks</div>` + tiers.map((tr) => `<div class="sg-row${lvl >= tr.level ? ' sgx-got' : ' locked'}"><span class="sg-lvl">${tr.level}</span><span class="sg-text sgx-text"><span class="sgx-gives">`
      + tr.ids.slice(0, 6).map((id) => itemBtn(id)).join('') + (tr.ids.length > 6 ? `<small>and ${tr.ids.length - 6} more</small>` : '') + '</span></span></div>').join('');
  }
  const ex = combatExtras(skill);
  if (ex) {
    html += `<div class="skill-group">${esc(ex.title)}</div>` + ex.rows.map((r) => `<div class="sg-row${!r.level || lvl >= r.level ? '' : ' locked'}">${r.level ? `<span class="sg-lvl">${r.level}</span>` : ''}<span class="sg-text sgx-text"><b>${r.items?.length === 1 && r.items[0] && ITEMS[r.items[0]] && !r.level ? itemBtn(r.items[0]) : esc(r.name)}</b><span>${esc(r.text)}</span>`
      + (r.items && r.level ? `<span class="sgx-gives">${r.items.map((id) => itemBtn(id)).join('')}</span>` : '') + '</span></div>').join('');
    if (ex.rewards) html += `<div class="skill-group">Slayer point rewards</div>` + ex.rewards.map((r) => `<div class="sg-row"><span class="sg-text sgx-text"><span class="sgx-out">${itemBtn(r.id, r.qty > 1 ? `${formatNumber(r.qty)} × ` : '')}</span><span>${r.cost} Slayer points</span></span></div>`).join('');
  }
  if (skill === 'prayer') html += `<div class="skill-group">Bones</div>` + recipesFor('prayer').map((r) => recipeRowHTML(game, r)).join('');
  const cl = game.skills.combatLevel?.() || lvl;
  const pickFor = (ids) => ids.reduce((b, id) => (Math.abs(getNpc(id).level - cl) < Math.abs(getNpc(b).level - cl) ? id : b), ids[0]);
  const spotRow = (s, ids, text) => {
    const pick = pickFor(ids);
    return `<div class="sg-row"><span class="sg-lvl">${s.p25}</span><span class="sg-text"><b>${esc(s.region)}</b><span>${text}, e.g. ${esc(getNpc(pick).name)} (${getNpc(pick).level})</span></span>`
      + `<span class="sgx-btns"><button type="button" class="wm-go" data-npc="${esc(pick)}" data-region="${esc(s.region)}">Go</button></span></div>`;
  };
  const best = bestSpotsFor(game, cl);
  if (best.length) html += `<div class="skill-group">Best places for your combat level (${cl})</div>` + best.map((s) => spotRow(s, s.near, `${s.near.length} kinds of monster near your level`)).join('');
  const spots = trainingSpots(game);
  if (spots.length) html += `<div class="skill-group">Every region <small>(most of its monsters' levels)</small></div>` + spots.map((s) => spotRow(s, s.ids, `Mostly level ${s.p25}-${s.p75} (${s.lo}-${s.hi} in all)`)).join('');
  return html;
}

/** The Resources index list for a search and shelf: { html, total }. */
export function resourcesListHTML(game, st) {
  const list = searchResources(st.search || '', st.cat || 'all');
  const shown = st.shown || PAGE;
  const rows = list.slice(0, shown).map((e) => {
    const bag = game.inventory?.count?.(e.id) || 0, bank = game.bank?.count?.(e.id) || 0;
    const cat = RESOURCE_CATS.find((c) => c.id === e.cat)?.name || '';
    return `<button type="button" class="cx-row sgx-res-row" data-item="${esc(e.id)}">${itemIconSVG(e.id, 32)}<span class="cx-row-main"><span class="cx-row-top"><b>${esc(e.name)}</b></span>`
      + `<span class="cx-row-sub">${esc(cat)}${bag || bank ? ` · you have ${formatNumber(bag)}${bank ? ` (+${formatNumber(bank)} banked)` : ''}` : ''}</span></span></button>`;
  }).join('');
  return { total: list.length, html: `<div class="cx-count">${formatNumber(list.length)} of ${formatNumber(resourceIndex().length)} resources</div><div class="cx-list">${rows || '<div class="modal-hint">Nothing matches.</div>'}</div>` + pagedMore(shown, list.length) };
}

/** One item's page: where it comes from and what it goes into. */
export function itemPageHTML(game, id, st = {}) {
  const e = itemEntry(id);
  const it = getItem(id);
  const bag = game.inventory?.count?.(id) || 0, bank = game.bank?.count?.(id) || 0;
  let html = `<div class="sgx-item-head">${itemIconSVG(id, 56)}<div><b>${esc(e.name)}</b><span class="cx-examine">${esc(it.examine || '')}</span>`
    + `<span class="cx-note">${esc(RESOURCE_CATS.find((c) => c.id === e.cat)?.name || '')} · you have ${formatNumber(bag)}${bank ? `, ${formatNumber(bank)} in the bank` : ''}${it.value ? ` · worth ${formatNumber(it.value)} coins` : ''}</span></div></div>`;
  // ---- Where it comes from ----
  const by = (k) => e.sources.filter((s) => s.kind === k);
  let from = '';
  const nodes = by('node').sort((a, b) => a.source.level - b.source.level);
  if (nodes.length) {
    from += `<h4>Gathered</h4>` + nodes.map((n) => {
      const s = n.source, ok = game.skills.level(s.skill) >= s.level;
      const zs = s.objIds ? regionsOf(game, s.objIds) : s.npcId ? npcRegions(game, s.npcId) : [];
      return `<div class="sg-row sgx-row${ok ? '' : ' locked'}"><span class="sg-lvl">${s.level}</span><span class="sg-text sgx-text"><b>${esc(s.name)}${s.spot && s.spot !== s.name ? ` <small>(${esc(s.spot)})</small>` : ''} <small>${esc(skillName(s.skill))} · ${formatNumber(Math.round(realXp(game, s.skill, s.xp)))} xp each${n.chance < 0.999 ? ` · ${chanceText(n.chance)}` : ''}${n.max > 1 ? ` · ${n.min}-${n.max} at a time` : ''}</small></b>`
        + `<span>${s.tool ? `Needs ${esc(TOOL_NAMES[s.tool] || s.tool)} · ` : ''}&#128205; ${regionsText(zs)}</span></span>`
        + `<span class="sgx-btns">${s.objIds ? `<button type="button" class="wm-go" data-go="${esc(s.objIds.join(','))}"${ok ? '' : ' disabled'}>Go</button><button type="button" class="wm-go cx-map" data-map="${esc(s.objIds.join(','))}" data-label="${esc(s.name)}">Map</button>` : s.npcId ? `<button type="button" class="wm-go" data-npc="${esc(s.npcId)}">Go</button>` : ''}</span></div>`;
    }).join('');
  }
  const made = by('recipe');
  if (made.length) from += `<h4>Made</h4>` + made.map((s) => recipeRowHTML(game, s.recipe, { showSkill: true })).join('');
  // Monsters and bosses apart: a boss's ten rolls a kill would otherwise bury
  // the everyday creatures you can farm.
  const hab = codexHabitats(game);
  const dropList = (title, list, key, n) => {
    if (!list.length) return '';
    const shownN = st[key] ? list.length : n;
    return `<h4>${title} <small>(${formatNumber(list.length)}; rough chance a kill)</small></h4><div class="sgx-drops">`
      + list.slice(0, shownN).map((d) => `<div class="sgx-drop"><span><b>${esc(d.name)}</b> <small>lvl ${formatNumber(d.level)} · ${esc((hab.get(d.npcId) || []).slice(0, 2).join(', '))}</small></span><i>${d.max > 1 ? `${formatNumber(d.min)}-${formatNumber(d.max)} · ` : ''}${chanceText(d.chance)}</i><button type="button" class="wm-go" data-npc="${esc(d.npcId)}">Go</button></div>`).join('')
      + '</div>' + (list.length > shownN ? `<button type="button" class="cx-more" data-all="${key}">Show all ${formatNumber(list.length)}</button>` : '');
  };
  from += dropList('Monster drops', by('drop').filter((d) => !d.boss), 'allDrops', 8);
  from += dropList('Boss drops', by('drop').filter((d) => d.boss), 'allBoss', 4);
  const misc = [];
  for (const s of by('raredrop')) misc.push(`The rare drop table: a small chance on any kill (${chanceText(s.chance)} of its rolls)`);
  for (const s of by('shop')) misc.push(`Bought at ${esc(s.name)} for ${formatNumber(s.price)} coins`);
  for (const s of by('nest')) misc.push(`A bird's nest from Woodcutting (${chanceText(s.chance)} of nests)`);
  for (const s of by('casket')) misc.push(`${AOrAn(esc(s.tier))} clue's reward casket (${chanceText(s.chance)} a roll)`);
  for (const s of by('cull')) misc.push(`Now and then from culling harmless ${esc(s.from.join(', ').replace(/_/g, ' '))}`);
  for (const s of by('token')) misc.push(`Pest Control token shop: ${s.qty} for ${s.cost} tokens`);
  for (const s of by('slayer')) misc.push(`Slayer rewards: ${formatNumber(s.qty)} for ${s.cost} points`);
  if (misc.length) from += `<h4>Other ways</h4><ul class="sgx-ul">${misc.map((m) => `<li>${m}</li>`).join('')}</ul>`;
  html += `<div class="cx-sec"><h3 class="sgx-h3">Where it comes from</h3>${from || '<div class="modal-hint">Nowhere but quests and rewards.</div>'}</div>`;
  // ---- What it's used in ----
  let used = '';
  if (e.recipes.length) {
    used += e.recipes.map((r) => {
      const then = r.output && e.then.find((t) => t.via === r.output.id);
      return recipeRowHTML(game, r, { showSkill: true })
        + (then?.makes.length ? `<div class="sgx-then"><small>${esc(iname(r.output.id))} then makes</small> ${then.makes.slice(0, st.allThen ? 999 : 10).map((x) => itemBtn(x, '', 18)).join('')}${then.makes.length > 10 && !st.allThen ? `<button type="button" class="sgx-chip" data-allthen="1">+${then.makes.length - 10} more</button>` : ''}</div>` : '');
    }).join('');
  }
  const other = e.other;
  if (other.length) used += `<h4>Other uses</h4><ul class="sgx-ul">${other.map((o) => `<li>${esc(o.text)}</li>`).join('')}</ul>`;
  if (e.noUse) used = '<div class="sgx-nouse">Used in: nothing (sell it or offer it at the shrine)</div>' + used;
  html += `<div class="cx-sec"><h3 class="sgx-h3">Used in${e.recipes.length ? ` <small>(${e.recipes.length} recipe${e.recipes.length === 1 ? '' : 's'})</small>` : ''}</h3>${used}</div>`;
  return html;
}

// ---------------- The window ----------------

/** Open a skill's guide (skill set) or the Resources index (skill null, maybe at an item). */
export function openSkillGuide(ui, skill, { itemId = null } = {}) {
  const game = ui.game;
  // The views stack: Back pops one. Each view keeps its own search, filter and page.
  const stack = [];
  if (skill) stack.push({ view: 'skill', skill, filter: 'all', search: '', shown: PAGE });
  if (!skill || itemId) stack.push({ view: 'resources', cat: 'all', search: '', shown: PAGE });
  if (itemId) stack.push({ view: 'item', id: itemId });
  const top = () => stack[stack.length - 1];
  let listEl = null;

  const titleFor = (v) => (v.view === 'skill' ? `${skillName(v.skill)} guide` : v.view === 'item' ? iname(v.id) : 'Resources');
  const drawList = () => {
    const v = top();
    if (!listEl) return;
    listEl.innerHTML = v.view === 'skill' ? skillListHTML(game, v.skill, v).html : resourcesListHTML(game, v).html;
  };
  const push = (v, body) => { top().scroll = body.scrollTop; stack.push(v); render(body); body.scrollTop = 0; };

  const render = (body) => {
    const v = top();
    if (ui.modal) ui.modal.title = titleFor(v);
    if (ui.el?.modalTitle) ui.el.modalTitle.textContent = titleFor(v);
    body.innerHTML = '';
    listEl = null;
    if (stack.length > 1) body.insertAdjacentHTML('beforeend', `<button type="button" class="cx-back" data-back="1">&#8592; ${esc(titleFor(stack[stack.length - 2]))}</button>`);
    if (v.view === 'skill') renderSkill(body, v);
    else if (v.view === 'resources') {
      body.insertAdjacentHTML('beforeend', '<div class="modal-hint sgx-intro">Every material and product in the game. Tap one to see where it comes from and what it makes.</div>'
        + toolbarHTML(v, [], 'Search resources…').replace('<button type="button" class="wm-go sgx-res" data-resources="1">Resources</button>', '')
        + `<div class="sgx-chips">${[{ id: 'all', name: 'All' }, ...RESOURCE_CATS].map((c) => `<button type="button" class="sgx-chip${v.cat === c.id ? ' on' : ''}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>`);
      listEl = document.createElement('div');
      listEl.className = 'sgx-list';
      body.appendChild(listEl);
      drawList();
    } else {
      const page = document.createElement('div');
      page.className = 'cx-entry sgx-page';
      page.innerHTML = itemPageHTML(game, v.id, v);
      body.appendChild(page);
    }
    wireSearch(body);
  };

  const renderSkill = (body, v) => {
    const sk = v.skill;
    body.insertAdjacentHTML('beforeend', headHTML(game, sk));
    if (sk === 'hunter') body.insertAdjacentHTML('beforeend', HUNTER_START);
    if (sk === 'firemaking') body.insertAdjacentHTML('beforeend', fireStartHTML(game));
    body.insertAdjacentHTML('beforeend', unlockLadderHTML(game, sk));
    body.insertAdjacentHTML('beforeend', toolLadderHTML(game, sk));
    if (AUTO_TEXT[sk]) {
      body.insertAdjacentHTML('beforeend', `<button type="button" class="sg-auto${game.autoGather ? ' on' : ''}" data-auto="1"><span class="ab-switch" aria-hidden="true"><i></i></span><span><b>Auto gather</b> ${game.autoGather ? 'On' : 'Off'}: ${AUTO_TEXT[sk]}</span></button>`);
    }
    if (GATHER_SKILLS.includes(sk)) body.insertAdjacentHTML('beforeend', gatherPicksHTML(game));
    if (PICK_SKILLS.has(sk)) {
      const lvl = game.skills.level(sk);
      const n = gatherSources().filter((s) => s.skill === sk && s.level <= lvl && s.objIds?.every((id) => game.gatherPicks.has(id))).length;
      body.insertAdjacentHTML('beforeend', `<div class="sg-picks"><span>Tick what auto gather should do${n ? ` (<b>${n}</b> ticked)` : ' (none ticked: it does whatever you start on)'}.</span>${n ? '<button type="button" class="wm-go" data-start="1">Start</button>' : ''}</div>`);
    }
    // Each station on its own line: the regions that have one, Go and Map.
    for (const o of SKILL_GUIDES[sk].where || []) {
      const zs = regionsOf(game, [o]);
      body.insertAdjacentHTML('beforeend', `<div class="sgx-station"><span><b>${esc(OBJECTS[o]?.name || o)}</b>: ${zs.length ? regionsText(zs, 6) : 'light one anywhere'}</span>`
        + (zs.length ? `<span class="sgx-btns"><button type="button" class="wm-go" data-go="${esc(o)}">Go</button><button type="button" class="wm-go cx-map" data-map="${esc(o)}" data-label="${esc(OBJECTS[o]?.name || o)}">Map</button></span>` : '') + '</div>');
    }
    // Woodcutting: the groves, each thick with one kind of tree; Mining: the
    // quarries, each thick with one kind of rock (groves.js).
    if (sk === 'woodcutting' || sk === 'mining') {
      for (const g of groveList(game, sk === 'mining' ? 'quarry' : 'grove')) {
        body.insertAdjacentHTML('beforeend', `<div class="sgx-station"><span><b>${esc(g.name)}</b>: ${g.count} ${esc(g.tree.toLowerCase())}s (level ${g.level}), ${esc(g.region)}</span>`
          + `<span class="sgx-btns"><button type="button" class="wm-go" data-grove="${esc(g.id)}">Go</button><button type="button" class="wm-go cx-map" data-gmap="${esc(g.id)}">Map</button></span></div>`);
      }
    }
    // Fishing: each kind of spot and its one fish, and where to find it (fishspots.js).
    if (sk === 'fishing') {
      for (const f of fishSpotList(game)) {
        body.insertAdjacentHTML('beforeend', `<div class="sgx-station"><span><b>${esc(f.name)}</b>: ${esc(f.fish.toLowerCase())} (level ${f.level}, ${esc(f.tool)}), ${regionsText(f.regions, 3)}</span>`
          + `<span class="sgx-btns"><button type="button" class="wm-go" data-go="${esc(f.objId)}">Go</button><button type="button" class="wm-go cx-map" data-map="${esc(f.objId)}" data-label="${esc(f.name)}">Map</button></span></div>`);
      }
    }
    if (COMBAT_SKILLS.includes(sk)) {
      body.insertAdjacentHTML('beforeend', `<div class="cx-filters sgx-bar"><button type="button" class="wm-go sgx-res" data-resources="1">Resources</button></div>`);
      const div = document.createElement('div');
      div.innerHTML = combatGuideHTML(game, sk);
      body.appendChild(div);
      return;
    }
    const chips = [{ id: 'all', name: 'All' }];
    if (GATHER_SKILLS.includes(sk) && sk !== 'farming') chips.push({ id: 'now', name: 'Can do now' }, { id: 'next', name: 'Coming up' });
    else {
      chips.push({ id: 'now', name: 'Can make now' }, { id: 'level', name: 'Have the level' }, { id: 'next', name: 'Coming up' });
      const kinds = [...new Set(recipesFor(sk).map((r) => r.kind))];
      if (kinds.length > 1) for (const k of kinds) chips.push({ id: `kind:${k}`, name: recipeKindTitle(k) });
    }
    body.insertAdjacentHTML('beforeend', toolbarHTML(v, chips, GATHER_SKILLS.includes(sk) && sk !== 'farming' ? 'Search nodes, items…' : 'Search recipes…'));
    listEl = document.createElement('div');
    listEl.className = 'sgx-list';
    body.appendChild(listEl);
    drawList();
  };

  // The search box redraws only the list, so it keeps focus (and the phone keyboard) while typing.
  const wireSearch = (body) => {
    const inp = body.querySelector('.sgx-search');
    if (!inp) return;
    inp.addEventListener('input', () => { const v = top(); v.search = inp.value; v.shown = PAGE; drawList(); });
  };

  // One listener for every button in the window (rows come and go as the filters change).
  const onClick = (ev) => {
    const body = ui.el?.modalBody;
    const t = ev.target.closest?.('button, input[type="checkbox"]');
    if (!t || !body || !body.contains(t) || ui.modal?.kind !== 'skillguide') return;
    const v = top(), d = t.dataset;
    if (d.back) { stack.pop(); render(body); body.scrollTop = top().scroll || 0; }
    else if (d.item) push({ view: 'item', id: d.item }, body);
    else if (d.resources) push({ view: 'resources', cat: 'all', search: '', shown: PAGE }, body);
    else if (d.more) { v.shown = (v.shown || PAGE) + PAGE; drawList(); }
    else if (d.all) { v[d.all] = true; const sc = body.scrollTop; render(body); body.scrollTop = sc; }
    else if (d.allthen) { v.allThen = true; render(body); }
    else if (d.filter) { v.filter = d.filter; v.shown = PAGE; render(body); }
    else if (d.cat) { v.cat = d.cat; v.shown = PAGE; render(body); }
    else if (d.auto) { game.toggleAutoGather(); render(body); }
    else if (d.untick) { game.clearGatherPicks(); const sc = body.scrollTop; render(body); body.scrollTop = sc; }
    else if (d.start) { game.startGatherPicks(); ui.closeModal(); }
    else if (d.fire) { ui.closeModal(); game.startFiremaking(); }
    else if (d.pick) { game.toggleGatherPick(d.pick.split(',')); const sc = body.scrollTop; render(body); body.scrollTop = sc; }
    else if (d.skilltp) { if (skillTeleport(game, d.skilltp)) ui.closeModal(); }
    else if (d.go) game.goToNearest(d.go.split(','));
    else if (d.grove || d.gmap) {
      // A grove's trees stand on every other tile from its corner (x0, y0); Go heads for the nearest one.
      const g = (game.world.groves || []).find((x) => x.id === (d.grove || d.gmap));
      if (g && d.gmap) ui.openWorldMap({ x: g.cx, y: g.cy, label: g.name });
      else if (g) {
        const here = game.playerTile(), mine = game.world.objects.filter((o) => o.objId === g.objId && o.x >= g.x0 && o.x <= g.x1 && o.y >= g.y0 && o.y <= g.y1);
        const o = mine.sort((a, b) => Math.hypot(a.x - here.x, a.y - here.y) - Math.hypot(b.x - here.x, b.y - here.y))[0];
        if (o) game.goToObject(o);
      }
    }
    else if (d.map) { const spot = nearestObject(game, d.map.split(',')); if (spot) ui.openWorldMap({ x: spot.x, y: spot.y, label: d.label || '' }); }
    else if (d.npc) {
      const spot = nearestNpc(game, d.npc, d.region || null) || nearestNpc(game, d.npc);
      if (spot) { ui.closeModal(); game.travelToTile({ x: spot.x, y: spot.y }); } else game.msg?.("I can't find one of those anywhere.", 'system');
    }
  };

  ui.openModal(skill ? `${skillName(skill)} guide` : 'Resources', render);
  ui.modal.kind = 'skillguide';
  if (ui.el?.modalBody) ui.el.modalBody.scrollTop = 0;   // the body is shared: don't open where the last window was scrolled to
  // The modal body outlives this window, so the listener is set once and checks which window is open.
  const body = ui.el?.modalBody;
  if (body && !body._sgxWired) { body._sgxWired = true; body.addEventListener('click', (ev) => ui._sgxClick?.(ev)); }
  ui._sgxClick = onClick;
}
