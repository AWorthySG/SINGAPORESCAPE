import { getItem } from '../data/items.js';

// Gear upgrades (+1 to +10). Levels are kept per item type, so every copy of
// an upgraded item shares its level. Each level adds ~8% to every combat stat
// the item has (at least +1). Upgrades past +5 can fail; a failure only costs
// the materials, never the item.

export const MAX_UPGRADE = 10;
const STATS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'magicStr', 'dance', 'crit', 'hp'];
const METALS = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'dragon'];

/** An item's bonuses at a given upgrade level (speed is never changed). */
export function upgradedBonuses(base = {}, level = 0) {
  if (!level) return base;
  const out = { ...base };
  for (const k of STATS) if (base[k]) out[k] = base[k] + Math.max(1, Math.round(base[k] * 0.08)) * level;
  return out;
}

/** Chance (0-1) that the attempt to reach `next` succeeds. */
export function upgradeChance(next) {
  return next <= 5 ? 1 : [0.85, 0.7, 0.6, 0.5, 0.4][next - 6];
}

/** What it costs to go to level `next`: coins, plus metal bars for metal gear. */
export function upgradeCost(id, next) {
  const it = getItem(id);
  const metal = METALS.find((m) => id.startsWith(m + '_'));
  const coins = Math.round((30 * next + (it.value || 20) * 0.04 * next * next) * (metal ? 1 : 1.5));
  const cost = { coins };
  if (metal) cost.bar = { id: metal === 'dragon' ? 'rune_bar' : `${metal}_bar`, qty: metal === 'dragon' ? next * 2 : next };
  return cost;
}

/** "Bronze sword +3" */
export function upgradedName(id, level) {
  return getItem(id).name + (level ? ` +${level}` : '');
}
