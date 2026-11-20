import { TOOL_TIERS, TOOL_BAR_XP, toolId } from './tooltiers.js';

// Smithing recipes.
// SMELT: ore -> bar at a furnace. SMITH: bar -> item at an anvil (requires a hammer).

export const SMELT = [
  { result: 'bronze_bar', inputs: [{ id: 'copper_ore', qty: 1 }, { id: 'tin_ore', qty: 1 }], level: 1, xp: 6.2 },
  { result: 'iron_bar', inputs: [{ id: 'iron_ore', qty: 1 }], level: 15, xp: 12.5, successChance: 0.5 },
  { result: 'steel_bar', inputs: [{ id: 'iron_ore', qty: 1 }, { id: 'coal', qty: 2 }], level: 30, xp: 17.5 },
  { result: 'mithril_bar', inputs: [{ id: 'mithril_ore', qty: 1 }, { id: 'coal', qty: 4 }], level: 50, xp: 30 },
  { result: 'adamant_bar', inputs: [{ id: 'adamantite_ore', qty: 1 }, { id: 'coal', qty: 6 }], level: 70, xp: 37.5 },
  { result: 'rune_bar', inputs: [{ id: 'runite_ore', qty: 1 }, { id: 'coal', qty: 8 }], level: 85, xp: 50 },
  // Endgame bars, one per endgame ore (Mining 100-300). Each bar's xp is about
  // 35% more than the tier before (rune 50 -> 68 -> 92 ...).
  { result: 'obsidian_bar', inputs: [{ id: 'obsidian_shard', qty: 1 }, { id: 'coal', qty: 4 }], level: 100, xp: 68 },
  { result: 'orichalcum_bar', inputs: [{ id: 'orichalcum_ore', qty: 1 }, { id: 'coal', qty: 6 }], level: 130, xp: 92 },
  { result: 'jade_bar', inputs: [{ id: 'raw_jade', qty: 1 }, { id: 'coal', qty: 6 }], level: 160, xp: 124 },
  { result: 'starmetal_bar', inputs: [{ id: 'starmetal_ore', qty: 1 }, { id: 'coal', qty: 8 }], level: 200, xp: 167 },
  { result: 'celestial_bar', inputs: [{ id: 'celestial_crystal', qty: 1 }, { id: 'coal', qty: 8 }], level: 250, xp: 226 },
  { result: 'eternal_bar', inputs: [{ id: 'eternal_ore', qty: 1 }, { id: 'coal', qty: 10 }], level: 300, xp: 305 },
];

export const SMITH = [
  { result: 'bronze_dagger', bar: 'bronze_bar', barCount: 1, level: 1, xp: 12.5 },
  { result: 'bronze_sword', bar: 'bronze_bar', barCount: 1, level: 4, xp: 12.5 },
  { result: 'bronze_scimitar', bar: 'bronze_bar', barCount: 2, level: 5, xp: 25 },
  { result: 'bronze_helm', bar: 'bronze_bar', barCount: 2, level: 7, xp: 25 },
  { result: 'wooden_shield', bar: 'bronze_bar', barCount: 2, level: 8, xp: 25 },
  { result: 'bronze_kiteshield', bar: 'bronze_bar', barCount: 3, level: 12, xp: 37.5 },
  { result: 'bronze_platelegs', bar: 'bronze_bar', barCount: 3, level: 16, xp: 37.5 },
  { result: 'bronze_platebody', bar: 'bronze_bar', barCount: 5, level: 18, xp: 62.5 },
  { result: 'iron_scimitar', bar: 'iron_bar', barCount: 2, level: 20, xp: 50 },
  { result: 'iron_full_helm', bar: 'iron_bar', barCount: 2, level: 26, xp: 50 },
  { result: 'iron_platebody', bar: 'iron_bar', barCount: 5, level: 33, xp: 125 },
  { result: 'steel_scimitar', bar: 'steel_bar', barCount: 2, level: 30, xp: 75 },
  { result: 'steel_full_helm', bar: 'steel_bar', barCount: 2, level: 37, xp: 75 },
  { result: 'steel_kiteshield', bar: 'steel_bar', barCount: 3, level: 43, xp: 112.5 },
  { result: 'steel_platebody', bar: 'steel_bar', barCount: 5, level: 48, xp: 187.5 },
  { result: 'mithril_scimitar', bar: 'mithril_bar', barCount: 2, level: 55, xp: 100 },
  { result: 'mithril_full_helm', bar: 'mithril_bar', barCount: 2, level: 60, xp: 100 },
  { result: 'mithril_platebody', bar: 'mithril_bar', barCount: 5, level: 68, xp: 250 },
  { result: 'adamant_scimitar', bar: 'adamant_bar', barCount: 2, level: 75, xp: 125 },
  { result: 'rune_scimitar', bar: 'rune_bar', barCount: 2, level: 90, xp: 150 },
  { result: 'rune_full_helm', bar: 'rune_bar', barCount: 3, level: 92, xp: 225 },
  { result: 'rune_kiteshield', bar: 'rune_bar', barCount: 3, level: 94, xp: 225 },
  { result: 'rune_platebody', bar: 'rune_bar', barCount: 5, level: 99, xp: 375 },
];

// ---- Generated recipes for the full tiered gear set (skips existing results) ----
const _SMETALS = [
  { k: 'bronze', base: 1, xp: 12.5 }, { k: 'iron', base: 15, xp: 25 }, { k: 'steel', base: 30, xp: 37.5 },
  { k: 'mithril', base: 50, xp: 50 }, { k: 'adamant', base: 70, xp: 62.5 }, { k: 'rune', base: 85, xp: 75 },
];
const _PIECES = [
  ['dagger', 1, 0], ['med_helm', 1, 1], ['gauntlets', 1, 1], ['boots', 1, 2], ['sword', 1, 2], ['mace', 1, 3],
  ['scimitar', 2, 4], ['sq_shield', 2, 5], ['longsword', 2, 6], ['full_helm', 2, 7], ['warhammer', 3, 8],
  ['kiteshield', 3, 9], ['battleaxe', 3, 10], ['chainbody', 3, 11], ['platelegs', 3, 12], ['2h_sword', 3, 13], ['platebody', 5, 14],
  ['kerambit', 1, 1], ['chakram', 1, 3], ['parang', 2, 4], ['toya', 2, 6],   // secondary weapon types
];
const _existing = new Set(SMITH.map((r) => r.result));
for (const M of _SMETALS) {
  for (const [t, barCount, off] of _PIECES) {
    const result = `${M.k}_${t}`;
    if (_existing.has(result)) continue;
    SMITH.push({ result, bar: `${M.k}_bar`, barCount, level: Math.min(99, M.base + off), xp: +(barCount * M.xp).toFixed(1) });
    _existing.add(result);
  }
}

// ---- Endgame metals (Smithing 100-300): the gear that otherwise only drops ----
// Every metal melee weapon and plate armour piece of the obsidian to eternal
// tiers. Levels are the tier's level plus the same small per-piece offsets as
// above (no cap at 99 here). `xp` is per bar, each tier about 35% more than the
// last, starting from rune's 75: one piece is forged a tick whatever its size,
// so the best piece (a 5-bar platebody) out-earns the tier before's by 35% too.
// Smithed gear is always plain: the quality ladder (loot.js) is only rolled
// for monster drops, which stay the way to a head start on mastery.
const _ENDGAME = [
  { k: 'obsidian', base: 100, xp: 102 }, { k: 'orichalcum', base: 130, xp: 138 }, { k: 'jade', base: 160, xp: 187 },
  { k: 'starmetal', base: 200, xp: 253 }, { k: 'celestial', base: 250, xp: 342 }, { k: 'eternal', base: 300, xp: 462 },
];
// The weapon and armour families the older tiers lack a recipe for, fitted into the same ladder.
const _ENDGAME_PIECES = [..._PIECES, ['claws', 2, 5], ['buckler', 2, 5], ['spear', 2, 6], ['katana', 2, 8],
  ['plateskirt', 3, 12], ['halberd', 3, 13]];
for (const M of _ENDGAME) {
  for (const [t, barCount, off] of _ENDGAME_PIECES) {
    const result = `${M.k}_${t}`;
    if (_existing.has(result)) continue;
    SMITH.push({ result, bar: `${M.k}_bar`, barCount, level: M.base + off, xp: barCount * M.xp });
    _existing.add(result);
  }
}

// ---- Upgrade stones (for enchanting, see mastery.js) ----
// Hammered from bars at an anvil; finer metal gives more stones per bar.
// `qty` stones come out per make, and `upgrade` keeps these out of "Smith all"
// so a player's bars are only turned into stones when they choose to.
// Yield against combat: a good fight drops ~25 stones in ten minutes around
// level 100 (3-12% a kill at ~30 kills a minute, plus champions and bosses).
// Ten minutes of mining and smelting gives roughly 25 iron bars, ~10 mithril,
// ~6 adamant or ~3 rune, which is 25-30 stones at every tier here: the same
// pace as fighting, paid for in ore instead of kills.
SMITH.push(
  { result: 'upgrade_stone', qty: 1, bar: 'bronze_bar', barCount: 2, level: 5, xp: 12.5, upgrade: true },
  { result: 'upgrade_stone', qty: 1, bar: 'iron_bar', barCount: 1, level: 18, xp: 25, upgrade: true },
  { result: 'upgrade_stone', qty: 2, bar: 'steel_bar', barCount: 1, level: 33, xp: 37.5, upgrade: true },
  { result: 'upgrade_stone', qty: 3, bar: 'mithril_bar', barCount: 1, level: 52, xp: 50, upgrade: true },
  { result: 'upgrade_stone', qty: 5, bar: 'adamant_bar', barCount: 1, level: 72, xp: 62.5, upgrade: true },
  { result: 'upgrade_stone', qty: 9, bar: 'rune_bar', barCount: 1, level: 88, xp: 75, upgrade: true },
  // Skill chains: hooks for Crafting's fishing lures, and refine scrolls hammered from adamant (refine.js).
  { result: 'barbed_hooks', qty: 10, bar: 'iron_bar', barCount: 1, level: 25, xp: 30 },
  { result: 'refine_scroll', qty: 1, bar: 'adamant_bar', barCount: 2, level: 75, xp: 110, upgrade: true },
);

// ---- Gun rounds (see rounds.js): twenty from a bar, at every bar tier ----
// A little above the tier's first piece, for one bar's worth of XP.
export const ROUNDS_PER_BAR = 20;
for (const M of [..._SMETALS, ..._ENDGAME]) {
  SMITH.push({ result: `${M.k}_rounds`, qty: ROUNDS_PER_BAR, bar: `${M.k}_bar`, barCount: 1, level: M.base + 2, xp: M.xp });
}

// ---- Tiered gathering tools (tooltiers.js): axes, pickaxes and harpoons ----
// Two bars each, at the bar's smelting level plus a little, for the tier's XP
// a bar. `upgrade` keeps them out of "Smith all" too: a tool is made when
// chosen, never by the batch. (The tier-1 harpoon is bought, so it starts at iron.)
for (const [tag, off] of [['axe', 1], ['pickaxe', 2], ['harpoon', 3]]) {
  TOOL_TIERS.forEach((T, i) => {
    if (i === 0 && tag === 'harpoon') return;
    SMITH.push({ result: toolId(tag, i), bar: `${T.metal}_bar`, barCount: 2, level: i ? T.level + off : 1, xp: 2 * TOOL_BAR_XP[i], upgrade: true });
  });
}
