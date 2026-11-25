// Archaeology's rules (the tables are in src/data/archaeology.js): a dig at a
// site, the relics it turns up, the whole trench at once, and the museum.
// Kept out of game.js: the game's tick runs resolveExcavate through
// _tickContinuous, as it does resolveFish, so auto gather, the skill unlocks,
// streaks, lucky finds and the level haul all work a dig site as they do a
// spot. Restoring is an ordinary recipe at the restoration bench (trades-style,
// resolveRecipe), so "Restore all" and the making batches come with it.
import { getItem, ITEMS } from '../data/items.js';
import { TILE } from '../config.js';
import { aOrAn, weightedPick } from '../core/utils.js';
import { DIG_TAG, DIG_SITE_BY_ID, RELIC_CHANCE, RELIC_SET_BONUS, MUSEUM_SETS, MUSEUM_SET_BY_ID, museumPage } from '../data/archaeology.js';
import { NODE_JACKPOT, SEAM_MULT, HUNT_STOCK, jackpotBase, tallyWhole, many } from './jackpot.js';
import { toolBonus } from './tools.js';
import { mulberry32 } from './pets.js';

/** What the trowel you carry adds, as a tool tier does: { speed, yield, find } (tooltiers.js). */
export const digBonus = (game) => toolBonus(game, DIG_TAG);

// Rolls of their own, so the relics never shift Math.random (the seeded tests replay it).
let roll = mulberry32((Date.now() ^ 0x2c1b3c6d) >>> 0);
/** Swap the generator (tests). */
export function setDigRand(fn) { roll = fn; }

const objCenter = (obj) => ({ x: obj.x * TILE + TILE / 2, y: obj.y * TILE + TILE / 2 - 6 });

/** How many museum sets you have finished. */
export const setsDone = (game) => MUSEUM_SETS.filter((m) => game.collection?.done?.has(museumPage(m.id))).length;
/** A dig's chance of an encrusted relic: the base, your trowel's rare-find share, and the finished sets. */
export const relicChance = (game, tb = digBonus(game)) => RELIC_CHANCE * (1 + tb.find) * (1 + RELIC_SET_BONUS * setsDone(game));

// ---------------- A dig ----------------
/** One dig at a site (action.obj). Returns true to keep digging, false to stop. */
export function resolveExcavate(game, action) {
  const { obj } = action, def = obj.def, c = def.catches?.[0];
  if (!c) return false;
  const lvl = game.skills.level('archaeology');
  if (lvl < c.level) { game.msg(`You need an Archaeology level of ${c.level} to dig here.`); return false; }
  if (game.inventory.canAdd(c.id, 1) <= 0) { game.msg('Your inventory is too full to hold any more.'); return false; }
  const tb = digBonus(game);
  game.inventory.add(c.id, 1);
  game.skills.addXp('archaeology', c.xp);
  // A better trowel: now and then a second one (no XP for it, as a Hunter's second catch).
  let n = 1;
  if (tb.yield > 0 && roll() < tb.yield) { game.inventory.add(c.id, 1); n++; }
  const name = getItem(c.id).name.toLowerCase();
  const fc = objCenter(obj);
  game.spawnPoof?.(fc.x, fc.y, def.color || '#c8a070');
  game.bus.emit('sfx', 'gather');
  game.msg(n > 1 ? `You dig up two ${many(name)}.` : `You dig up ${aOrAn(name)}.`);
  const site = DIG_SITE_BY_ID[def.site || obj.objId];
  if (site && roll() < relicChance(game, tb)) findRelic(game, site, lvl);
  digJackpot(game, obj, { xpEach: c.xp });   // now and then the whole trench at once
  return true;   // sites never run dry
}

/** An encrusted relic from the site's table, the plainer finds likelier. */
export function findRelic(game, site, lvl = 1) {
  const r = weightedPick(site.relics);
  game.inventory.add(r.encrusted, 1);
  const rare = r.weight <= 15;
  game.spawnSparkle?.(game.player, rare ? '#ffd24a' : '#e8d8b0', rare ? 14 : 8);
  game.msg(`Your trowel scrapes something: ${aOrAn(getItem(r.encrusted).name.toLowerCase())}! Restore it at a restoration bench.`, 'level');
  if (lvl < r.level) game.msg(`(You need Archaeology ${r.level} to restore it.)`, 'system');
  return r.encrusted;
}

// The whole trench (as Hunter's whole flock and Diving's whole reef bed): about
// one dig in 20 turns up a rich layer, ten times a stock of 1-14 finds of the
// site's material at once, with XP for each. A site never runs dry, so it
// carries on as before after it.
export function digJackpot(game, obj, { xpEach }) {
  if (!NODE_JACKPOT.on || roll() >= jackpotBase(game.skills?.level?.('archaeology'))) return 0;
  const c = obj.def.catches[0];
  const n = SEAM_MULT * (HUNT_STOCK[0] + Math.floor(roll() * (HUNT_STOCK[1] - HUNT_STOCK[0] + 1)));
  game.inventory.add(c.id, n);   // (stackable: the bag always has room)
  tallyWhole(c.id, n);
  game.skills.addXp('archaeology', xpEach * n);
  const name = getItem(c.id).name;
  game.msg(`A rich layer! You dig up ${n.toLocaleString('en-GB')} ${many(name.toLowerCase())} at once!`, 'level');
  game.banner?.(`<span class="big">Whole trench!</span>+${n.toLocaleString('en-GB')} ${name}`);
  game.addHitsplat?.(game.player, 0, { text: `Whole trench! +${n}` });
  const fc = objCenter(obj);
  game.spawnPoof?.(fc.x, fc.y, obj.def.color || '#c8a070'); game.spawnPoof?.(fc.x - 8, fc.y + 4, '#ffffff');
  game.spawnSparkle?.(game.player, '#e8c46a', 14);
  game.bus.emit('sfx', 'dropepic');
  return n;
}

// ---------------- The museum ----------------
/** A set's state: { set, page, got (ids given), have (ids in your bag, not yet given), done }. */
export function museumSet(game, setId) {
  const m = MUSEUM_SET_BY_ID[setId], page = museumPage(setId);
  const given = (id) => (game.collection?.log?.[page]?.[id] || 0) > 0;
  return { set: m, page, got: m.items.filter(given), have: m.items.filter((id) => !given(id) && game.inventory.count(id) > 0),
    done: !!game.collection?.done?.has(page) };
}
/** Every set, lowest first. */
export const museumSets = (game) => MUSEUM_SETS.map((m) => museumSet(game, m.id));

/** Give the curator every restored artefact in your bag that a set still
 *  wants (one of each). A set finished by it pays its coins and XP (and the
 *  Collection log gives its title). Returns { given: [ids], finished: [set ids] }. */
export function donateAll(game) {
  const given = [], finished = [];
  for (const m of MUSEUM_SETS) {
    const st = museumSet(game, m.id);
    for (const id of st.have) {
      game.inventory.remove(id, 1);
      game.collection.record(st.page, id, 1);
      given.push(id);
    }
    if (!st.done && game.collection.done.has(st.page)) { finished.push(m.id); rewardSet(game, m); }
  }
  if (given.length) {
    game.msg(`Curator Siti: "Wah, ${given.length === 1 ? `${aOrAn(getItem(given[0]).name.toLowerCase())}` : `${given.length} lovely pieces`}! Thank you, I'll put ${given.length === 1 ? 'it' : 'them'} on show."`, 'game');
    game.bus.emit('museum');
    game.saveSoon = true;
  }
  return { given, finished };
}
function rewardSet(game, m) {
  game.inventory.add('coins', m.coins);
  const xp = game.skills.addXp('archaeology', m.xp);
  game.msg(`Museum set complete: ${m.name}! The curator pays you ${m.coins.toLocaleString('en-GB')} coins, and you learn ${Math.round(xp).toLocaleString('en-GB')} Archaeology XP. Relics turn up a little more often now.`, 'level');
  game.banner?.(`<span class="big">${m.name} complete!</span>${m.coins.toLocaleString('en-GB')} coins · title "${m.title}"`);
}

/** An artefact's set, or null (for the bag's tooltip and the curator's window). */
export const artefactSet = (id) => (ITEMS[id]?.artefact ? MUSEUM_SET_BY_ID[ITEMS[id].artefact] : null);
