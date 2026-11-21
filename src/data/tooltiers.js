// Tiered gathering tools: an axe, pickaxe, fishing rod, harpoon and hunting
// snare for each of the twelve smithing metals. The tier-1 tool of each kind
// is the one the game always had (bronze_axe, fishing_rod, harpoon...).
//
// A better tool needs a level in its skill to use (the same ladder as the
// smelting levels and the rocks: obsidian at 100, eternal at 300) and gives:
//   speed  % more gathers an hour (an extra roll now and then, on top of
//          GATHER_SPEED in game.js). The owner asked for these to climb to
//          +100% at eternal (they topped out at +48%).
//   yield  added to the skill's double-yield chance (double logs, rich seam,
//          big catch, second Hunter catch)
//   find   added share on the rare finds (bird's nests, gems, trophy fish,
//          a trap's bonus catches): 0.5 is half as likely again.
//          Kept small: a trophy fish is triple XP, a gem 40 XP.
// value is a multiple of the tier-1 tool's (about two bars' worth).
// The best one you carry or wield that you can use is picked for you
// (src/game/tools.js). items.js builds the items from this table, smithing.js
// and trades.js their recipes, shops.js sells bronze to adamant.

export const TOOL_TIERS = [
  { metal: 'bronze', level: 1, speed: 0, yield: 0, find: 0, value: 1 },
  { metal: 'iron', level: 15, speed: 8, yield: 0, find: 0, value: 10 },
  { metal: 'steel', level: 30, speed: 16, yield: 0, find: 0, value: 25 },
  { metal: 'mithril', level: 50, speed: 24, yield: 0, find: 0, value: 50 },
  { metal: 'adamant', level: 70, speed: 32, yield: 0.01, find: 0, value: 120 },
  { metal: 'rune', level: 85, speed: 40, yield: 0.02, find: 0, value: 500 },
  { metal: 'obsidian', level: 100, speed: 50, yield: 0.03, find: 0.1, value: 750 },
  { metal: 'orichalcum', level: 130, speed: 60, yield: 0.04, find: 0.2, value: 1100 },
  { metal: 'jade', level: 160, speed: 70, yield: 0.05, find: 0.3, value: 1600 },
  { metal: 'starmetal', level: 200, speed: 80, yield: 0.06, find: 0.4, value: 2400 },
  { metal: 'celestial', level: 250, speed: 90, yield: 0.08, find: 0.5, value: 3400 },
  { metal: 'eternal', level: 300, speed: 100, yield: 0.1, find: 0.6, value: 5000 },
];

// The highest tier shops sell (bronze to adamant); the rest are made or dropped.
export const SHOP_TOOL_TIER = 4;

// Each kind of tool: its tag (game.hasTool), the skill it serves, the tier-1
// item that already exists, and how the others are named.
export const TOOL_KINDS = [
  { tag: 'axe', skill: 'woodcutting', base: 'bronze_axe', id: (m) => `${m}_axe`, name: (M) => `${M} axe`, verb: 'chopping' },
  { tag: 'pickaxe', skill: 'mining', base: 'bronze_pickaxe', id: (m) => `${m}_pickaxe`, name: (M) => `${M} pickaxe`, verb: 'mining' },
  { tag: 'rod', skill: 'fishing', base: 'fishing_rod', id: (m) => `${m}_rod`, name: (M) => `${M} fishing rod`, verb: 'fishing' },
  { tag: 'harpoon', skill: 'fishing', base: 'harpoon', id: (m) => `${m}_harpoon`, name: (M) => `${M} harpoon`, verb: 'fishing' },
  { tag: 'snare', skill: 'hunter', base: 'hunting_snare', id: (m) => `${m}_snare`, name: (M) => `${M} hunting snare`, verb: 'trapping' },
];
export const TOOL_KIND = Object.fromEntries(TOOL_KINDS.map((k) => [k.tag, k]));

/** The item id of tool kind `tag` at tier i (tier 0 is the old tier-1 tool). */
export const toolId = (tag, i) => (i === 0 ? TOOL_KIND[tag].base : TOOL_KIND[tag].id(TOOL_TIERS[i].metal));
/** Every tool item id of a kind, worst first. */
export const toolIds = (tag) => TOOL_TIERS.map((_, i) => toolId(tag, i));

/** "+20% speed, +2% double yield, +25% rare finds" (empty for a plain tool). */
export function toolBonusText(t) {
  const bits = [];
  if (t.speed) bits.push(`+${t.speed}% speed`);
  if (t.yield) bits.push(`+${Math.round(t.yield * 100)}% double yield`);
  if (t.find) bits.push(`+${Math.round(t.find * 100)}% rare finds`);
  return bits.join(', ');
}

// The logs that go with each metal in a rod or snare (bronze's is plain logs).
export const TOOL_LOGS = ['logs', 'oak_logs', 'willow_logs', 'maple_logs', 'yew_logs', 'magic_logs',
  'seraya_logs', 'meranti_logs', 'chengal_logs', 'starwood_logs', 'moonwood_logs', 'eternal_heartwood'];
// Smithing XP per bar at each tier (smithing.js: _SMETALS then _ENDGAME).
export const TOOL_BAR_XP = [12.5, 25, 37.5, 50, 62.5, 75, 102, 138, 187, 253, 342, 462];
