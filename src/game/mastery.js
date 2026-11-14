import { getItem } from '../data/items.js';

// Gear mastery and enchanting. Both belong to an item TYPE (keyed by item id),
// so every copy you own shares them.
//
// Mastery is earned by fighting: every kill gives each piece you are wearing
// mastery points (1 for a monster, 5 for a champion, 25 for a boss). Points
// climb through seven ranks, and each rank adds a share of the item's base
// combat stats. There is no risk and nothing to pay: using your gear is what
// makes it better.
//
// Enchanting adds up to three bonus lines to an item type (crit chance, crit
// damage, armour pierce, lifesteal, attack speed, boss damage, attack or magic
// bonus %). Each attempt costs upgrade stones and coins, offers three random
// lines and you keep the one you pick. An upgrade ward lets you reroll the offer.

export const STONE = 'upgrade_stone';
export const WARD = 'upgrade_ward';

// The combat stats mastery raises (speed is never changed).
const STATS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'magicStr', 'dance', 'crit', 'hp'];

// gain: the total extra share of the item's base stats at that rank; abbr: the
// short tag shown on item icons.
export const MASTERY_RANKS = [
  { name: 'Novice', abbr: '', points: 0, gain: 0 },
  { name: 'Adept', abbr: 'A', points: 25, gain: 0.10 },
  { name: 'Skilled', abbr: 'S', points: 100, gain: 0.25 },
  { name: 'Expert', abbr: 'E', points: 300, gain: 0.45 },
  { name: 'Master', abbr: 'M', points: 800, gain: 0.70 },
  { name: 'Grandmaster', abbr: 'GM', points: 2000, gain: 1.00 },
  { name: 'Legendary', abbr: 'L', points: 5000, gain: 1.40 },
];
export const MAX_RANK = MASTERY_RANKS.length - 1;
/** From this rank up, ranking up earns a banner as well as a chat message. */
export const BANNER_RANK = 4;   // Master

/** Mastery points a kill is worth to each piece you wear. */
export function killMastery(npc) {
  return npc.def?.boss ? 25 : npc.champion ? 5 : 1;
}

/** Rank index (0 Novice .. 6 Legendary) for a number of points. */
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

// ---------------- Enchanting ----------------
export const MAX_ENCHANTS = 3;
const SLOT_STONES = [10, 25, 50];
// Base size of each line; it grows with the item's level requirement.
export const ENCHANT_STEP = { crit: 1, critDmg: 3, pierce: 1, lifesteal: 1, haste: 1, bossDmg: 2, atkPct: 2, magPct: 2 };
export const ENCHANT_LABELS = {
  crit: 'crit chance', critDmg: 'crit damage', pierce: 'armour pierce', lifesteal: 'lifesteal',
  haste: 'attack speed', bossDmg: 'boss damage', atkPct: 'attack bonus', magPct: 'magic bonus',
};

/** The item's level: its highest skill requirement (1 if it has none). */
export function reqLevel(id) {
  return Math.max(1, ...Object.values(getItem(id).equip?.req || {}));
}

/** Is this a caster's item (it rolls Magic bonus % rather than Attack bonus %)? */
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
