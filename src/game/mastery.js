import { getItem } from '../data/items.js';
import { WEAPON_TYPE_NAMES } from '../data/classes.js';
import { QUALITY } from './loot.js';

// Gear mastery and enchanting.
//
// Mastery belongs to a GEAR TYPE: a weapon's type (every sword shares Sword
// mastery, every bow of a kind its bow mastery) or, for other gear, its slot
// and armour family (every plate body shares Plate body mastery), or the slot
// alone when it has no family (every ring shares Ring mastery). So moving up a
// tier keeps the mastery you earned, and there is nothing to carry across.
// Mastery is earned by fighting: every kill gives each gear type you are
// wearing mastery points (1 for a monster, 5 for a champion, 25 for a boss).
// Points climb through seven ranks, and each rank adds a share of the item's
// base combat stats. There is no risk and nothing to pay: using your gear is
// what makes it better. (Spare gear of the same type can be sacrificed to it
// too, see salvage.js.)
//
// Quality (loot.js) is something else: it belongs to one copy, and multiplies
// that copy's stats, mastery included (see qualityBonuses).
//
// Enchanting adds up to three bonus lines to an item (keyed by item id, so
// every copy shares them): crit chance, crit damage, armour pierce, lifesteal,
// attack speed, boss damage, attack or magic bonus %. Each attempt costs
// upgrade stones and coins, offers three random lines and you keep the one you
// pick. An upgrade ward lets you reroll the offer.

export const STONE = 'upgrade_stone';
export const WARD = 'upgrade_ward';

// The combat stats mastery raises (speed is never changed).
const STATS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'magicStr', 'dance', 'crit', 'hp'];

// gain: the total extra share of the item's base stats at that rank; abbr: the
// short tag shown on item icons.
// Auto battle racks up kills quickly (about 75 a minute at a good spot), so the
// ranks are spread out: Adept in a few minutes, Ascended after many hours.
// (The top rank was called Legendary, the same word as a quality tier; renamed
// so the two systems never share a name.)
export const MASTERY_RANKS = [
  { name: 'Novice', abbr: '', points: 0, gain: 0 },
  { name: 'Adept', abbr: 'A', points: 250, gain: 0.10 },
  { name: 'Skilled', abbr: 'S', points: 1000, gain: 0.25 },
  { name: 'Expert', abbr: 'E', points: 3000, gain: 0.45 },
  { name: 'Master', abbr: 'M', points: 8000, gain: 0.70 },
  { name: 'Grandmaster', abbr: 'GM', points: 20000, gain: 1.00 },
  { name: 'Ascended', abbr: 'AS', points: 50000, gain: 1.40 },
];
export const MAX_RANK = MASTERY_RANKS.length - 1;
/** From this rank up, ranking up earns a banner as well as a chat message. */
export const BANNER_RANK = 4;   // Master

// Short names for a slot in a gear type's name ("Plate helm", "Ring").
const SLOT_WORDS = { head: 'helm', body: 'body', legs: 'legs', hands: 'gloves', feet: 'boots', shield: 'shield', cape: 'cape', amulet: 'amulet', ring: 'ring' };
const FAMILY_WORDS = { plate: 'Plate', leather: 'Scout leather', hide: 'Hide', robes: 'Robe', dancewear: 'Dancewear' };

/** The gear type an item's mastery belongs to: 'weapon:sword', 'body:plate',
 *  'ring:any' (a slot with no family), 'weapon:tool' (an axe or pickaxe in hand).
 *  Always has a colon, so it can never be mistaken for an item id (old saves
 *  kept mastery by item id: see Equipment.load). */
export function masteryType(id) {
  let eq;
  try { eq = getItem(id).equip; } catch { return `item:${id}`; }
  if (!eq) return `item:${id}`;
  if (eq.slot === 'weapon') return `weapon:${eq.weaponType || 'tool'}`;
  return `${eq.slot}:${eq.family || 'any'}`;
}

/** A gear type's name for the player: "Sword", "Plate body", "Ring". */
export function masteryTypeName(id) {
  const [slot, kind] = masteryType(id).split(':');
  if (slot === 'weapon') {
    if (kind === 'tool') return 'Tool';
    const plural = WEAPON_TYPE_NAMES[kind] || kind;
    const one = plural.replace(/staves$/, 'staff').replace(/s$/, '');
    return one.charAt(0).toUpperCase() + one.slice(1);
  }
  const word = SLOT_WORDS[slot] || slot;
  if (kind === 'any' || !FAMILY_WORDS[kind]) return word.charAt(0).toUpperCase() + word.slice(1);
  return `${FAMILY_WORDS[kind]} ${word}`;
}

/** Mastery points a kill is worth to each piece you wear. */
export function killMastery(npc) {
  return npc.def?.boss ? 25 : npc.champion ? 5 : 1;
}

/** Rank index (0 Novice .. 6 Ascended) for a number of points. */
export function rankFor(points = 0) {
  let r = 0;
  for (let i = 1; i < MASTERY_RANKS.length; i++) if (points >= MASTERY_RANKS[i].points) r = i;
  return r;
}

/** Progress towards the next rank: { rank, next (null at the top), need, frac }. */
export function rankProgress(points = 0) {
  const rank = rankFor(points);
  if (rank >= MAX_RANK) return { rank, next: null, need: 0, frac: 1 };
  const from = MASTERY_RANKS[rank].points, to = MASTERY_RANKS[rank + 1].points;
  return { rank, next: rank + 1, need: to - points, frac: (points - from) / (to - from) };
}

/** An item's bonuses at a mastery rank: each stat it has gains its share
 *  (and at least +rank, so small stats still move). */
export function masteryBonuses(base = {}, rank = 0) {
  if (!rank) return base;
  const out = { ...base };
  const g = MASTERY_RANKS[rank].gain;
  for (const k of STATS) if (base[k]) out[k] = base[k] + Math.max(rank, Math.round(base[k] * g));
  return out;
}

/** One copy's bonuses at its quality: each stat the mastered bonuses have
 *  (from the item's base stats) grows by the quality's share, at least +1, so
 *  quality multiplies with mastery. A plain copy is unchanged. */
export function qualityBonuses(base = {}, current = base, q = null) {
  const Q = QUALITY[q];
  if (!Q) return current;
  const out = { ...current };
  for (const k of STATS) if (base[k] > 0 && current[k] > 0) out[k] = Math.max(current[k] + 1, Math.round(current[k] * (1 + Q.gain)));
  return out;
}

// ---------------- Enchanting ----------------
export const MAX_ENCHANTS = 3;
const SLOT_STONES = [10, 25, 50];
// Base size of each line; it grows with the item's level requirement.
export const ENCHANT_STEP = { crit: 1, critDmg: 3, pierce: 1, lifesteal: 1, haste: 1, bossDmg: 2, atkPct: 2, magPct: 2 };
export const ENCHANT_LABELS = {
  crit: 'crit chance', critDmg: 'crit damage', pierce: 'armour pierce', lifesteal: 'lifesteal',
  haste: 'attack speed', bossDmg: 'boss damage', atkPct: 'physical damage bonus', magPct: 'magic bonus',
};

/** The item's level: its highest skill requirement (1 if it has none). */
export function reqLevel(id) {
  return Math.max(1, ...Object.values(getItem(id).equip?.req || {}));
}

/** Is this a caster's item (it rolls Magic bonus % rather than Physical damage bonus %)? */
export function isMagicItem(id) {
  const eq = getItem(id).equip || {};
  return eq.combatType === 'magic' || eq.style === 'magic' || eq.family === 'robes';
}

/** The stats this item's enchant lines can roll. */
export function enchantPool(id) {
  return ['crit', 'critDmg', 'pierce', 'lifesteal', 'haste', 'bossDmg', isMagicItem(id) ? 'magPct' : 'atkPct'];
}

/** How big a line of `stat` is on this item. */
export function enchantValue(id, stat) {
  return Math.max(1, Math.round(ENCHANT_STEP[stat] * (1 + reqLevel(id) / 40)));
}

/** What the next enchant costs, given how many lines the item has. A full
 *  item (replacing a line) pays the third slot's price. */
export function enchantCost(id, lines = 0) {
  const slot = Math.min(lines, MAX_ENCHANTS - 1);
  return { stones: SLOT_STONES[slot], coins: Math.round((getItem(id).value || 0) * 0.5) + 200 };
}

/** Three different random lines to choose from. */
export function rollEnchantOffers(id, rand = Math.random, n = 3) {
  const pool = enchantPool(id).slice();
  const out = [];
  while (out.length < n && pool.length) {
    const stat = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    out.push({ stat, value: enchantValue(id, stat) });
  }
  return out;
}

/** "+6% crit chance" */
export function enchantLabel(line) {
  return `+${line.value}% ${ENCHANT_LABELS[line.stat] || line.stat}`;
}

/** Add an item's enchant lines to its bonuses. */
export function enchantedBonuses(current = {}, lines = []) {
  if (!lines.length) return current;
  const out = { ...current };
  for (const l of lines) out[l.stat] = (out[l.stat] || 0) + l.value;
  return out;
}

// ---------------- Old saves ----------------
// Before mastery, gear had upgrade levels (+1..+15) and refine stars (★1..★15),
// each adding a share of the base stats. These are the old formulas, kept only
// to convert an old save fairly.
function oldUpgradeGain(level) {
  let g = 0;
  for (let l = 1; l <= level; l++) g += l <= 5 ? 0.08 : l <= 10 ? 0.1 : 0.15;
  return g;
}
function oldRefineGain(level) {
  let g = 0;
  for (let l = 1; l <= level; l++) g += l <= 9 ? 0.06 : l <= 12 ? 0.1 : 0.15;
  return g;
}

/** Convert an item's old upgrade and refine levels: the mastery points of the
 *  highest rank whose gain is no more than the old total (at least Adept if it
 *  had been upgraded at all), and one free enchant line per 5 refine stars. */
export function migrateOld(id, upgrade = 0, refine = 0, rand = Math.random) {
  const total = oldUpgradeGain(upgrade) + oldRefineGain(refine);
  let rank = 0;
  for (let i = 0; i < MASTERY_RANKS.length; i++) if (MASTERY_RANKS[i].gain <= total + 1e-9) rank = i;
  if (upgrade + refine > 0) rank = Math.max(1, rank);
  const lines = [];
  for (let i = 0; i < Math.min(MAX_ENCHANTS, Math.floor(refine / 5)); i++) lines.push(rollEnchantOffers(id, rand, 1)[0]);
  return { points: MASTERY_RANKS[rank].points, lines };
}
