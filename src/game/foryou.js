// "For you": what suits your character right now, for the Codex window's For
// you section (src/ui/foryouui.js). Kept free of the DOM for the tests.
//
//  - Training: for each life skill, the best node or recipe at your level and
//    a rough XP an hour. Worked out from the node's or recipe's XP and the
//    game's own pace (one action a tick, GATHER_SPEED, XP_RATE and the life
//    skill boost), not simulated, so walking, banking and running dry are not
//    counted: treat it as "up to".
//  - Hunting: monsters near your fight level whose race your weapon is strong
//    against (races.js), and the regions with the most monsters at your level.
//  - Gear: for each slot, the best piece you could wear now that beats what you
//    have on (gear.js compareGear: mastery and quality count), and where to get it.
import { getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { weaponsFor, raceOf, RACES, weaponTypeName } from '../data/races.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { XP_RATE, TICK_MS, LIFE_XP_BOOST } from '../config.js';
import { GATHER_SPEED } from './game.js';
import { CODEX_IDS, codexHabitats } from './codex.js';
import { gatherSources, recipesFor, recipeLabel, regionsOf, itemSources } from './skillguide.js';
import { EQUIP_SLOTS } from './equipment.js';
import { gearBySlot, compareGear } from './gear.js';
import { isObtainable } from './discovery.js';
import { nearestSource } from './encyclopedia.js';

// The life skills For you suggests training spots for (Farming grows on its
// own clock, so an hourly rate means little there).
export const TRAIN_SKILLS = ['woodcutting', 'mining', 'fishing', 'hunter', 'thieving', 'agility', 'smithing', 'cooking', 'crafting', 'fletching', 'herblore', 'firemaking'];
export const ACTIONS_PER_HOUR = Math.round((3600000 / TICK_MS) * GATHER_SPEED);

/** Rough XP an hour from `xp` an action in `skill` at your level. */
export function xpPerHour(game, skill, xp) {
  const boost = game?.skills?.lifeXpMult ? game.skills.lifeXpMult(skill) : LIFE_XP_BOOST;
  return Math.round(xp * XP_RATE * boost * ACTIONS_PER_HOUR);
}

/** The best training spots for a skill at your level (two at most), highest XP first:
 *  [{ skill, name, level, xp, xph, objIds?, npcId?, regions, recipe? }]. */
export function trainingFor(game, skill, n = 2) {
  const lvl = game?.skills?.level?.(skill) || 1;
  const out = [];
  const gather = gatherSources().filter((s) => s.skill === skill && s.level <= lvl && s.xp > 0);
  for (const s of gather) {
    out.push({ skill, name: s.spot && s.spot !== s.name ? `${s.name} (${s.spot})` : s.name, level: s.level, xp: s.xp, xph: xpPerHour(game, skill, s.xp),
      objIds: s.objIds, npcId: s.npcId, regions: s.objIds ? regionsOf(game, s.objIds) : [] });
  }
  if (!gather.length) {
    for (const r of recipesFor(skill)) {
      if (r.level > lvl || !(r.xp > 0)) continue;
      out.push({ skill, name: recipeLabel(r), level: r.level, xp: r.xp, xph: xpPerHour(game, skill, r.xp), objIds: r.stations.length ? r.stations : null,
        regions: r.stations.length ? regionsOf(game, r.stations) : [], recipe: r, inputs: r.inputs });
    }
  }
  // Highest XP first; among equals the higher level (usually the better reward).
  out.sort((a, b) => b.xp - a.xp || b.level - a.level);
  // One spot per node kind (a fishing spot lists each catch).
  const seen = new Set(), pick = [];
  for (const e of out) {
    const k = e.objIds ? e.objIds.join(',') + (e.recipe ? e.name : '') : e.npcId || e.name;
    if (seen.has(k)) continue;
    seen.add(k); pick.push(e);
    if (pick.length >= n) break;
  }
  return pick;
}

/** Your weapon type: the one you hold, else your class's. */
export function myWeaponType(game) {
  const w = game?.equipment?.get?.('weapon');
  return (w && getItem(w).equip?.weaponType) || CLASS_BY_ID[game?.jobClass]?.weapon || null;
}

/** Monsters near your fight level that your weapon is strong against, closest
 *  in level first: [{ id, name, level, race, regions }]. Bosses left out. */
export function preyFor(game, n = 8) {
  const type = myWeaponType(game);
  if (!type) return [];
  const fight = game.fightLevel?.() || 1;
  const hab = codexHabitats(game);
  const out = [];
  for (const id of CODEX_IDS) {
    const d = getNpc(id);
    if (d.boss || d.level < fight - 12 || d.level > fight + 6) continue;
    const race = raceOf(d, id);
    if (!weaponsFor(race).strong.includes(type)) continue;
    const regions = hab.get(id) || [];
    if (!regions.length) continue;
    out.push({ id, name: d.name, level: d.level, race: RACES[race], regions });
  }
  // A little under your level first (quick, safe kills), then a little over.
  const score = (e) => Math.abs(e.level - (fight - 2));
  return out.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name)).slice(0, n);
}

/** The races your weapon is strong against, by name. */
export const strongRaces = (game) => {
  const type = myWeaponType(game);
  return type ? Object.entries(RACES).filter(([rid]) => weaponsFor(rid).strong.includes(type)).map(([, r]) => r) : [];
};
export const weaponName = (game) => { const t = myWeaponType(game); return t ? weaponTypeName(t) : ''; };

/** For each slot, the best piece you could wear now that beats what you have
 *  on: [{ slot, id, worn, gain, source }], biggest gain first. */
export function gearUpgrades(game) {
  if (!game?.equipment || !game._canEquipNow) return [];
  const out = [];
  const bySlot = gearBySlot();
  for (const slot of EQUIP_SLOTS) {
    for (const id of bySlot[slot] || []) {
      if (!isObtainable(id) || !game._canEquipNow(id)) continue;
      const c = compareGear(id, game.equipment);
      if (!c || !(c.verdict === 'upgrade' || c.verdict === 'empty') || !(c.ratingDelta > 0)) continue;
      // Only what you could actually get now: a node, shop or monster near your
      // level (nearestSource), or a recipe you have the level for.
      const source = nearestSource(game, id);
      const make = source ? null : itemSources(id).find((x) => x.kind === 'recipe' && (game.skills?.level?.(x.recipe.skill) || 1) >= x.recipe.level)?.recipe;
      if (!source && !make) continue;
      out.push({ slot, id, worn: c.worn, gain: Math.round(c.ratingDelta), source, make: make ? { skill: make.skill, level: make.level } : null });
      break;   // the list is best first: the first that fits is the one
    }
  }
  return out.sort((a, b) => b.gain - a.gain);
}
