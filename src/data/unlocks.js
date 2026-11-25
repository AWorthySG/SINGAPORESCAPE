// Skill unlocks: at levels 10, 25, 50, 75 and 99 every life skill unlocks
// something you can feel while you train it (the life perks in lifeperks.js
// make you stronger in a fight instead; these make the skill itself better).
// Each rung's `fx` adds to the rungs below it (see skillunlocks.js):
//   double  extra chance of a double yield (logs, ore, fish, catches, stall loot, crops)
//   quick   chance an action happens twice in the same tick
//   save    chance a make keeps its inputs (a log is kept when lighting a fire)
//   keep    chance a tree, rock or trap you just used doesn't run dry
//   grow    crops grow this share faster
//   burn    fires you light burn this share longer
//   tip     tips at your hawker stall are this share bigger (Hawkering)
// A rung with `teleport` opens a teleport to the skill's best training area
// (an MRT station, from the skill guide); a rung with `recipe` names the new
// recipe that opens at that level (the recipe's own level gates it).
export const UNLOCK_LEVELS = [10, 25, 50, 75, 99];
// Past the last rung every effect above grows, in a straight line, to this
// many times its level-99 strength at level 9999 (unlockGrowth in
// skillunlocks.js; the owner asked for life-skill bonuses all the way to
// 9999), and on at the same pace to about x2.51 at 30,000, the life skills'
// top level. The rungs' `desc` strings give their level-99 strength.
export const UNLOCK_TOP_MULT = 1.5;
// The tests switch the level-based effects off (tests/seed.mjs), as they do
// golden hours, so the XP-an-hour balance checks measure the base rates;
// tests/skillshome.test.mjs switches them back on for itself.
export const UNLOCKS = { on: true };
// Skill teleports share one cooldown, in game ticks (600ms each): 5 minutes.
export const SKILL_TELEPORT_TICKS = 500;

export const SKILL_UNLOCKS = {
  woodcutting: [
    { level: 10, name: 'Sturdy swing', desc: '+5% chance of double logs', fx: { double: 0.05 } },
    { level: 25, name: "Feller's rhythm", desc: '5% chance to chop twice in one go', fx: { quick: 0.05 } },
    { level: 50, name: 'Forest teleport', desc: 'Teleport to the Mandai Rainforest groves', teleport: 'mandai' },
    { level: 75, name: 'Evergreen', desc: '15% chance a tree stays standing after it would fall', fx: { keep: 0.15 } },
    { level: 99, name: 'Lumberjack legend', desc: '+10% double logs and 5% more quick chops', fx: { double: 0.10, quick: 0.05 } },
  ],
  mining: [
    { level: 10, name: 'Keen pick', desc: '+5% chance of double ore', fx: { double: 0.05 } },
    { level: 25, name: 'Prospector', desc: '10% chance a rock holds for another swing', fx: { keep: 0.10 } },
    { level: 50, name: 'Quarry teleport', desc: 'Teleport to the Tuas Docklands quarries', teleport: 'tuas' },
    { level: 75, name: 'Deep seams', desc: '+15% chance a rock holds, +5% double ore', fx: { keep: 0.15, double: 0.05 } },
    { level: 99, name: 'Master miner', desc: '+10% double ore and +10% rocks that hold', fx: { double: 0.10, keep: 0.10 } },
  ],
  fishing: [
    { level: 10, name: 'Steady hands', desc: '+5% chance of a double catch', fx: { double: 0.05 } },
    { level: 25, name: 'Quick cast', desc: '5% chance to land two casts in one go', fx: { quick: 0.05 } },
    { level: 50, name: 'Harbour teleport', desc: 'Teleport to the Punggol fishing waters', teleport: 'punggol' },
    { level: 75, name: 'Big haul', desc: '+10% chance of a double catch', fx: { double: 0.10 } },
    { level: 99, name: 'Sea legend', desc: '10% more quick casts', fx: { quick: 0.10 } },
  ],
  hunter: [
    { level: 10, name: 'Tracker', desc: '+5% chance of a second catch', fx: { double: 0.05 } },
    { level: 25, name: 'Patient trapper', desc: '10% chance a trap stays set after it springs', fx: { keep: 0.10 } },
    { level: 50, name: 'Jungle teleport', desc: 'Teleport to the Mandai Rainforest hunting grounds', teleport: 'mandai' },
    { level: 75, name: 'Quick snares', desc: '5% chance to work a trap twice, +5% second catches', fx: { quick: 0.05, double: 0.05 } },
    { level: 99, name: 'Apex hunter', desc: '+15% traps that stay set, +10% second catches', fx: { keep: 0.15, double: 0.10 } },
  ],
  diving: [
    { level: 10, name: 'Deep breath', desc: '+5% chance of a double catch', fx: { double: 0.05 } },
    { level: 25, name: 'Quick fingers', desc: '5% chance to bring up two finds in one dive', fx: { quick: 0.05 } },
    { level: 50, name: 'Jetty teleport', desc: 'Teleport to the Sentosa Beach dive jetty', teleport: 'sentosa' },
    { level: 75, name: 'Reef sense', desc: '+10% chance of a double catch', fx: { double: 0.10 } },
    { level: 99, name: 'Pearl legend', desc: '10% more quick dives', fx: { quick: 0.10 } },
  ],
  archaeology: [
    { level: 10, name: 'Careful digger', desc: '+5% chance of a double find', fx: { double: 0.05 } },
    { level: 25, name: 'Keen eye', desc: '5% chance to dig twice in one go', fx: { quick: 0.05 } },
    { level: 50, name: 'Museum teleport', desc: 'Teleport to Chinatown, by Curator Siti\'s museum', teleport: 'chinatown' },
    { level: 75, name: 'Steady hands', desc: '+10% double finds, and 5% chance a restore keeps its materials', fx: { double: 0.10, save: 0.05 } },
    { level: 99, name: 'Master of the past', desc: '10% more quick digs, +10% materials kept restoring', fx: { quick: 0.10, save: 0.10 } },
  ],
  farming: [
    { level: 10, name: 'Green thumb', desc: '10% chance of an extra crop each harvest', fx: { double: 0.10 } },
    { level: 25, name: 'Rich soil', desc: 'Crops grow 10% faster', fx: { grow: 0.10 } },
    { level: 50, name: 'Farm teleport', desc: 'Teleport to the Kranji farm patches', teleport: 'kranji' },
    { level: 75, name: 'Bumper crop', desc: '+15% chance of an extra crop', fx: { double: 0.15 } },
    { level: 99, name: 'Kampong legend', desc: 'Crops grow 15% faster still, +10% extra crops', fx: { grow: 0.15, double: 0.10 } },
  ],
  cooking: [
    { level: 10, name: 'Practised hands', desc: '5% chance a dish keeps its ingredients', fx: { save: 0.05 } },
    { level: 25, name: 'New recipe: Boar rendang', desc: 'A slow curry: more damage to bosses for a while', recipe: 'boar_rendang' },
    { level: 50, name: 'Kitchen teleport', desc: 'Teleport to the Kranji Village range', teleport: 'kranji' },
    { level: 75, name: 'New recipe: Fish head curry', desc: 'A boss-night feast: boss damage and less damage taken', recipe: 'fish_head_curry' },
    { level: 99, name: 'Master chef', desc: '+10% ingredients kept and 10% chance to cook twice', fx: { save: 0.10, quick: 0.10 } },
  ],
  smithing: [
    { level: 10, name: 'Careful hammer', desc: '5% chance to keep your bars', fx: { save: 0.05 } },
    { level: 25, name: 'New recipe: Barbed hooks', desc: 'Iron hooks for Crafting fishing lures', recipe: 'barbed_hooks' },
    { level: 50, name: 'Forge teleport', desc: 'Teleport to the Pulau Ubin forge', teleport: 'pulau_ubin' },
    { level: 75, name: 'New recipe: Forged refine scrolls', desc: 'Hammer adamant into refine scrolls for refining gear', recipe: 'refine_scroll' },
    { level: 99, name: 'Master smith', desc: '+10% bars kept and 10% chance to forge twice', fx: { save: 0.10, quick: 0.10 } },
  ],
  crafting: [
    { level: 10, name: 'Neat cuts', desc: '5% chance to keep your materials', fx: { save: 0.05 } },
    { level: 25, name: 'New recipe: Feather lure', desc: 'Lures for Fishing: more double catches', recipe: 'feather_lure' },
    { level: 50, name: 'Workshop teleport', desc: 'Teleport to the Kampong Glam workshop', teleport: 'kampong_glam' },
    { level: 75, name: 'Nimble fingers', desc: '10% chance to craft twice in one go', fx: { quick: 0.10 } },
    { level: 99, name: 'Master crafter', desc: '+10% materials kept, 5% more double crafts', fx: { save: 0.10, quick: 0.05 } },
  ],
  fletching: [
    { level: 10, name: 'Clean carving', desc: '5% chance to keep your logs', fx: { save: 0.05 } },
    { level: 25, name: 'New recipe: Bamboo decoy', desc: 'Decoys for Hunter: more second catches', recipe: 'bamboo_decoy' },
    { level: 50, name: 'Bench teleport', desc: 'Teleport to the Kranji work benches', teleport: 'kranji' },
    { level: 75, name: 'Swift knife', desc: '10% chance to fletch twice in one go', fx: { quick: 0.10 } },
    { level: 99, name: 'Master fletcher', desc: '+10% logs kept, 5% more double fletches', fx: { save: 0.10, quick: 0.05 } },
  ],
  construction: [
    { level: 10, name: 'Measure twice', desc: '5% chance to keep your materials', fx: { save: 0.05 } },
    { level: 25, name: 'Quick hands', desc: '5% chance to make twice in one go', fx: { quick: 0.05 } },
    { level: 50, name: 'Lumber yard teleport', desc: 'Teleport to Kranji, by the lumber yard', teleport: 'kranji' },
    { level: 75, name: 'Sure hammer', desc: '+5% materials kept and 5% more double makes', fx: { save: 0.05, quick: 0.05 } },
    { level: 99, name: 'Master builder', desc: '+5% materials kept and 5% more double makes', fx: { save: 0.05, quick: 0.05 } },
  ],
  hawkering: [
    { level: 10, name: 'Friendly smile', desc: 'Tips are 10% bigger', fx: { tip: 0.10 } },
    { level: 25, name: 'Quick hands', desc: '5% chance to serve two customers in one go', fx: { quick: 0.05 } },
    { level: 50, name: 'Hawker centre teleport', desc: 'Teleport to Marina Bay, by the hawker centre', teleport: 'marina_bay' },
    { level: 75, name: 'Wok hei', desc: '5% more double serves, tips 10% bigger', fx: { quick: 0.05, tip: 0.10 } },
    { level: 99, name: 'Hawker legend', desc: '5% more double serves, tips 10% bigger', fx: { quick: 0.05, tip: 0.10 } },
  ],
  herblore: [
    { level: 10, name: 'Steady pour', desc: '5% chance a brew keeps its herbs', fx: { save: 0.05 } },
    { level: 25, name: "New recipe: Angler's brew", desc: 'A brew for Fishing: more double catches', recipe: 'anglers_brew' },
    { level: 50, name: "New recipe: Tracker's brew", desc: 'A brew for Hunter: more second catches', recipe: 'trackers_brew' },
    { level: 75, name: "New recipe: Prospector's brew", desc: 'A brew for Mining: more double ore', recipe: 'prospectors_brew' },
    { level: 99, name: 'Master herbalist', desc: '+10% herbs kept and 10% chance to brew twice', fx: { save: 0.10, quick: 0.10 } },
  ],
  firemaking: [
    { level: 10, name: 'Warm embers', desc: 'Your fires burn 25% longer', fx: { burn: 0.25 } },
    { level: 25, name: 'Thrifty kindling', desc: '5% chance a log lights without burning away', fx: { save: 0.05 } },
    { level: 50, name: 'Woodland teleport', desc: 'Teleport to the Jurong Forest', teleport: 'jurong' },
    { level: 75, name: 'Long burn', desc: 'Your fires burn 50% longer still', fx: { burn: 0.5 } },
    { level: 99, name: 'Keeper of the flame', desc: '+15% logs kept', fx: { save: 0.15 } },
  ],
  thieving: [
    { level: 10, name: 'Light fingers', desc: '+5% chance of double stall loot', fx: { double: 0.05 } },
    { level: 25, name: 'Quick hands', desc: '10% chance a stall is not emptied by your theft', fx: { keep: 0.10 } },
    { level: 50, name: 'Market teleport', desc: 'Teleport to the Chinatown market', teleport: 'chinatown' },
    { level: 75, name: 'Deep pockets', desc: '+10% chance of double stall loot', fx: { double: 0.10 } },
    { level: 99, name: 'Master thief', desc: '+10% stalls left stocked and +10% double loot', fx: { keep: 0.10, double: 0.10 } },
  ],
};
export const UNLOCK_SKILLS = Object.keys(SKILL_UNLOCKS);

// Which skill each continuous player action trains ('recipe' says itself).
export const ACTION_SKILL = {
  woodcut: 'woodcutting', mine: 'mining', fish: 'fishing', hunt: 'hunter', dive: 'diving', excavate: 'archaeology', stall: 'thieving',
  cook: 'cooking', cookdish: 'cooking', smith: 'smithing', smelt: 'smithing', craft: 'crafting', hawk: 'hawkering',
};
// Actions that gather (a double yield applies) and actions that make (inputs can be kept).
export const GATHER_KINDS = new Set(['woodcut', 'mine', 'fish', 'hunt', 'dive', 'excavate', 'stall']);
export const MAKE_KINDS = new Set(['cook', 'cookdish', 'smith', 'craft', 'recipe']);

// Consumables carried in the pack that boost a gathering skill: each use of the
// skill spends one and adds `double` to the double-yield chance. Made by other
// skills, so the life skills feed one another (see the recipes they name).
export const GATHER_CONSUMABLES = {
  fishing: { id: 'feather_lure', double: 0.10 },
  hunter: { id: 'bamboo_decoy', double: 0.10 },
};
// Herblore brews (trades.js POTIONS) whose fx key adds to a skill's double-yield chance.
export const GATHER_BREW_KEYS = { fishing: 'fishYield', hunter: 'huntYield', mining: 'mineYield' };
