import { getItem } from '../data/items.js';

// Gear upgrades (+1 to +15). Levels are kept per item type, so every copy of
// an upgraded item shares its level. Each level adds a share of every combat
// stat the item has (at least +1): 8% a level up to +5, 10% from +6 to +10 and
// 15% from +11 to +15, so the late levels are the big jumps. Upgrades past +5
// can fail. Up to +7 a failure only costs the materials; from +8 it also knocks
// the item down a level, unless you carry an upgrade ward (used up instead).
// Upgrade stones, dropped by monsters, are needed from +4 and cut the coin cost.

export const MAX_UPGRADE = 15;
export const RISKY_FROM = 8;               // failing an attempt at this level or higher drops a level
export const STONE = 'upgrade_stone';
export const WARD = 'upgrade_ward';
const STATS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'magicStr', 'dance', 'crit', 'hp'];
const METALS = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'dragon'];

/** Total stat gain at an upgrade level, as a fraction of the base stat. */
export function upgradeGain(level) {
  let g = 0;
  for (let l = 1; l <= level; l++) g += l <= 5 ? 0.08 : l <= 10 ? 0.1 : 0.15;
  return g;
}

/** An item's bonuses at a given upgrade level (speed is never changed). */
export function upgradedBonuses(base = {}, level = 0) {
  if (!level) return base;
  const out = { ...base };
  const g = upgradeGain(level);
  for (const k of STATS) if (base[k]) out[k] = base[k] + Math.max(level, Math.round(base[k] * g));
  return out;
}

/** Chance (0-1) that the attempt to reach `next` succeeds. */
export function upgradeChance(next) {
  return next <= 5 ? 1 : [0.85, 0.75, 0.65, 0.55, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2][next - 6];
}

/** What it costs to go to level `next`: coins, metal bars for metal gear, and
 *  upgrade stones from +4. Stones replace part of the coin cost. */
export function upgradeCost(id, next) {
  const it = getItem(id);
  const metal = METALS.find((m) => id.startsWith(m + '_'));
  const stones = Math.max(0, next - 3);
  const coins = Math.round((30 * next + (it.value || 20) * 0.04 * next * next) * (metal ? 1 : 1.5) * (stones ? 0.6 : 1));
  const cost = { coins, stones };
  if (metal) cost.bar = { id: metal === 'dragon' ? 'rune_bar' : `${metal}_bar`, qty: metal === 'dragon' ? next * 2 : next };
  return cost;
}

/** "Bronze sword +3" */
export function upgradedName(id, level) {
  return getItem(id).name + (level ? ` +${level}` : '');
}
