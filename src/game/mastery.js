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
// Mastery is earned as XP: every kill gives each gear type you are wearing
// mastery XP (more for a tougher monster, see killMastery), and so do feeding
// materials (materials.js) and sacrificing spare gear of the same type
// (salvage.js). XP climbs through nine ranks, and each rank adds a share of the
// item's base stats. There is no risk and nothing to pay: using your gear is
// what makes it better. The last two ranks, Exalted and Transcendent, are only
// reached by defeating world bosses (see isWorldBoss).
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
// short tag shown on item icons; xp: the mastery XP it takes.
// The XP curve: rank r takes 2,500 x r x 2^(r-1) XP (2,500, 10,000, 30,000,
// 80,000, 200,000, 480,000), ten times the old points (250 .. 50,000) up to
// Grandmaster, so the ranks feel as far apart as they did. A kill is worth
// about 10 XP early on and more the higher the monster's level (killMastery),
// so auto battle (about 75 kills a minute at a good spot) still brings Adept in
// a few minutes, and Ascended after about 5 hours on level 100 monsters or
// under 3 on level 300 ones.
// (The top rank was called Legendary, the same word as a quality tier; renamed
// so the two systems never share a name. Exalted and Transcendent were chosen
// for the same reason: Mythic is a quality and Paragon an alignment.)
//
// Beyond Ascended: two world-boss ranks (worldBoss: true). Past Ascended only
// XP from world bosses counts (see Game._gainMastery): ordinary kills, gate
// bosses, materials and sacrifices add nothing more. Their thresholds are 1.5x
// and 2.5x Ascended's XP: about 24 and then 48 more world bosses at level 300
// (one gives 10,000 XP there), fewer for a higher-level player. Each adds +40%
// and then +45% of base stats, the next steps on the ladder (+10, +15, +20,
// +25, +30, +40%); a fully upgraded level 3,000 build with them still needs
// several seconds for a boss of its level (tests/late-damage.test.mjs).
const curveXp = (r) => 2500 * r * 2 ** (r - 1);
export const MASTERY_RANKS = [
  { name: 'Novice', abbr: '', xp: 0, gain: 0 },
  { name: 'Adept', abbr: 'A', xp: curveXp(1), gain: 0.10 },
  { name: 'Skilled', abbr: 'S', xp: curveXp(2), gain: 0.25 },
  { name: 'Expert', abbr: 'E', xp: curveXp(3), gain: 0.45 },
  { name: 'Master', abbr: 'M', xp: curveXp(4), gain: 0.70 },
  { name: 'Grandmaster', abbr: 'GM', xp: curveXp(5), gain: 1.00 },
  { name: 'Ascended', abbr: 'AS', xp: curveXp(6), gain: 1.40 },
  { name: 'Exalted', abbr: 'EX', xp: curveXp(6) * 1.5, gain: 1.80, worldBoss: true },
  { name: 'Transcendent', abbr: 'TR', xp: curveXp(6) * 2.5, gain: 2.25, worldBoss: true },
];
export const MAX_RANK = MASTERY_RANKS.length - 1;
/** The highest rank ordinary kills can reach (Ascended); past it, only world bosses. */
export const BATTLE_CAP_RANK = 6;
export const BATTLE_CAP = MASTERY_RANKS[BATTLE_CAP_RANK].xp;
export const TOP_XP = MASTERY_RANKS[MAX_RANK].xp;
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

// Kill XP: KILL_XP x (1 + (level - 1) / 100), 10 more every 100 levels, so a
// stronger monster counts for more in step with its level (10 at level 1, 20 at 100, 40 at 300, 110 at 1,000).
// It was the square root of 1 + level / 200 (12 at 100, 24 at 1,000), so a
// level 1,000 monster trained gear barely twice what a chicken did; the owner
// asked for stronger monsters to count for more. Times 5 for a champion, 25
// for an Endless Gate boss and 250 for a world boss. A world boss fight takes 3-4 minutes, about
// what 250 ordinary kills do on auto battle, so neither road is the better one.
export const KILL_XP = 10;
export const KILL_MULT = { champion: 5, boss: 25, worldBoss: 250 };

/** Is this a world boss: a boss fought in the open world? Not an Endless Gate
 *  boss (npc.wave, from waves.js), nor anything summoned for a moment (an add,
 *  a world or story event's foe: npc.temporary), nor an ally. World bosses are
 *  the bosses placed on the map, which respawn where they stand, and the
 *  roaming World Boss (Game.spawnWorldBoss). There is no duel or practice mode. */
export function isWorldBoss(npc) {
  return !!npc?.def?.boss && !npc.wave && !npc.def.wave && !npc.temporary && !npc.ally;
}

/** Mastery XP a kill is worth to each gear type you wear. */
export function killMastery(npc) {
  // A boss grown to your level (Game._scaleBoss) counts at that level.
  const lvl = Math.max(1, npc?.def?.scaledTo || 0, npc?.def?.level || npc?.level || 1);
  const mult = isWorldBoss(npc) ? KILL_MULT.worldBoss : npc?.def?.boss ? KILL_MULT.boss : npc?.champion ? KILL_MULT.champion : 1;
  return Math.max(1, Math.round(KILL_XP * (1 + (lvl - 1) / 100) * mult));
}

/** Rank index (0 Novice .. 8 Transcendent) for an amount of mastery XP. */
export function rankFor(xp = 0) {
  let r = 0;
  for (let i = 1; i < MASTERY_RANKS.length; i++) if (xp >= MASTERY_RANKS[i].xp) r = i;
  return r;
}

/** Progress towards the next rank: { rank, next (null at the top), need, frac,
 *  into (XP into this rank), span (this rank's XP to the next), worldBoss (the
 *  next rank is earned only from world bosses) }. */
export function rankProgress(xp = 0) {
  const rank = rankFor(xp);
  if (rank >= MAX_RANK) return { rank, next: null, need: 0, frac: 1, into: 0, span: 0, worldBoss: false };
  const from = MASTERY_RANKS[rank].xp, to = MASTERY_RANKS[rank + 1].xp;
  return { rank, next: rank + 1, need: to - xp, frac: (xp - from) / (to - from), into: xp - from, span: to - from, worldBoss: !!MASTERY_RANKS[rank + 1].worldBoss };
}

// ---------------- Points to XP (saves from before mastery XP) ----------------
// Mastery used to be points on a shorter ladder; these were its thresholds.
export const OLD_RANK_POINTS = [0, 250, 1000, 3000, 8000, 20000, 50000];

/** An old save's mastery points as XP: the same rank, and the same share of
 *  the way to the next one. Points past the old top rank (Ascended) were
 *  never more than "fully mastered", so they come to Ascended's XP exactly:
 *  the ranks above it are for world bosses. */
export function pointsToXp(points = 0) {
  const P = OLD_RANK_POINTS, pts = Math.max(0, points || 0);
  let r = 0;
  for (let i = 1; i < P.length; i++) if (pts >= P[i]) r = i;
  if (r >= P.length - 1) return MASTERY_RANKS[P.length - 1].xp;
  const from = MASTERY_RANKS[r].xp, to = MASTERY_RANKS[r + 1].xp;
  return Math.floor(from + (to - from) * (pts - P[r]) / (P[r + 1] - P[r]));
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
// Lines grow with the item's level, but past level ENCHANT_TAPER.from only by
// `rate` of a level per level: growing in full, a level 300 item's lines were
// 8.5 times a starter's, and with three on every piece (crit damage, physical
// damage, crit chance all stacking) enchanting alone tripled late-game damage.
export const ENCHANT_TAPER = { from: 100, rate: 0.25 };
export function enchantValue(id, stat) {
  const req = reqLevel(id), { from, rate } = ENCHANT_TAPER;
  const lvl = req <= from ? req : from + (req - from) * rate;
  return Math.max(1, Math.round(ENCHANT_STEP[stat] * (1 + lvl / 40)));
}
/** A line saved before the taper, brought down in proportion: the size it
 *  would roll now over the size it rolled then (1 for items up to level 100). */
export function taperedLine(id, line) {
  const was = Math.round(ENCHANT_STEP[line.stat] * (1 + reqLevel(id) / 40));
  const now = enchantValue(id, line.stat);
  return now >= was ? line : { stat: line.stat, value: Math.max(1, Math.round(line.value * now / was)) };
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

/** How an offered line compares with the lines the item already has, for the
 *  tag on each offer in the Enchant window: { kind, text }. The rules: lines
 *  stack (two crit chance lines add up, see enchantedBonuses), a line of one
 *  stat is the same size wherever it lands on an item (only lines from an old
 *  save can differ), and a full item's pick takes the place of the line chosen
 *  (`replace`). So:
 *   - a free slot and no line of that stat: 'new', it adds a line;
 *   - a free slot and a line of that stat: 'stack', with the total;
 *   - replacing a line of the same stat: 'better', 'weaker' or 'same';
 *   - replacing a line of another stat: 'stack' if another line has the
 *     offer's stat, else 'swap' (a new stat in place of the old one). */
export function compareEnchantOffer(offer, lines = [], replace = null) {
  const same = (l) => l.stat === offer.stat;
  const name = ENCHANT_LABELS[offer.stat] || offer.stat;
  const full = lines.length >= MAX_ENCHANTS;
  // Full with no line chosen yet: measure against a line of the same stat, if any.
  if (full && !(Number.isInteger(replace) && lines[replace])) {
    const i = lines.findIndex(same);
    replace = i >= 0 ? i : null;
    if (replace == null) return { kind: 'swap', text: 'A new stat, in place of one of your lines' };
  }
  if (full) {
    const old = lines[replace];
    if (same(old)) {
      if (offer.value > old.value) return { kind: 'better', text: `▲ Better than your current ${enchantLabel(old)}` };
      if (offer.value < old.value) return { kind: 'weaker', text: `▼ Weaker than your current ${enchantLabel(old)}` };
      return { kind: 'same', text: `= Same as the ${enchantLabel(old)} it replaces` };
    }
    const kept = lines.filter((l, i) => i !== replace && same(l));
    if (kept.length) return { kind: 'stack', text: `Stacks with your ${name}: +${kept.reduce((t, l) => t + l.value, offer.value)}% in all` };
    return { kind: 'swap', text: `New stat, in place of ${enchantLabel(old)}` };
  }
  const have = lines.filter(same);
  if (!have.length) return { kind: 'new', text: 'New: adds a line' };
  return { kind: 'stack', text: `Stacks with your ${name}: +${have.reduce((t, l) => t + l.value, offer.value)}% in all` };
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

/** Convert an item's old upgrade and refine levels: the mastery XP of the
 *  highest rank whose gain is no more than the old total (at least Adept if it
 *  had been upgraded at all), and one free enchant line per 5 refine stars. */
export function migrateOld(id, upgrade = 0, refine = 0, rand = Math.random) {
  const total = oldUpgradeGain(upgrade) + oldRefineGain(refine);
  let rank = 0;
  for (let i = 0; i <= BATTLE_CAP_RANK; i++) if (MASTERY_RANKS[i].gain <= total + 1e-9) rank = i;
  if (upgrade + refine > 0) rank = Math.max(1, rank);
  const lines = [];
  for (let i = 0; i < Math.min(MAX_ENCHANTS, Math.floor(refine / 5)); i++) lines.push(rollEnchantOffers(id, rand, 1)[0]);
  return { xp: MASTERY_RANKS[rank].xp, lines };
}
