// Slayer task system data. Tasks target a monster "family" (a base creature type,
// e.g. all ranks of Goblin) so any matching kill counts. Families/levels are
// derived from the bestiary so a task can never reference a monster that doesn't
// exist. Higher Slayer level unlocks tougher families.
import { NPCS, ALL_MONSTER_IDS } from './npcs.js';

// Pretty plural names for the families we want to assign (keyed by family slug).
const FAMILY_NAMES = {
  chicken: 'Chickens', rat: 'Rats', goblin: 'Goblins', macaque: 'Macaques',
  monitor_lizard: 'Monitor lizards', wild_boar: 'Wild boars', king_cobra: 'King cobras',
  giant_crab: 'Giant crabs', mud_crab: 'Mud crabs', sand_scorpion: 'Sand scorpions',
  jungle_spider: 'Jungle spiders', swamp_slime: 'Swamp slimes', mosquito: 'Mosquitoes',
  fruit_bat: 'Fruit bats', pangolin: 'Pangolins', sea_snake: 'Sea snakes', reef_shark: 'Reef sharks',
  bandit: 'Bandits', outlaw: 'Outlaws', wraith: 'Wraiths', skeleton: 'Skeletons',
  stone_golem: 'Stone golems', imp: 'Imps', forest_drake: 'Forest drakes', will_o_wisp: 'Will-o-wisps',
  carnivorous_plant: 'Carnivorous plants', komodo_dragon: 'Komodo dragons', tarantula: 'Tarantulas',
  stray_dog: 'Stray dogs', civet: 'Civets', hornbill: 'Hornbills', box_jellyfish: 'Box jellyfish',
  praying_mantis: 'Praying mantises', sea_turtle: 'Sea turtles', vampire_bat: 'Vampire bats',
  wild_dog: 'Wild dogs', smooth_otter: 'Smooth otters', pink_dolphin: 'Pink dolphins',
  kingfisher: 'Kingfishers', flying_fox: 'Flying foxes', reticulated_python: 'Reticulated pythons',
  saltwater_crocodile: 'Saltwater crocodiles', pontianak: 'Pontianaks', toyol: 'Toyols',
  horseshoe_crab: 'Horseshoe crabs', sambar_deer: 'Sambar deer',
  jungle_wraith: 'Jungle wraiths', hantu_raya: 'Hantu raya', pocong: 'Pocong',
  cursed_pirate: 'Cursed pirates', penanggal: 'Penanggal',
  // The two November batches (their families live outside MONSTER_IDS, so the
  // pool below reads ALL_MONSTER_IDS to reach them).
  malayan_tapir: 'Malayan tapirs', wild_hornet: 'Wild hornets', kelong_crab: 'Kelong crabs',
  dugong: 'Dugongs', merlion_whelp: 'Merlion whelps', weaver_ant: 'Weaver ants', tiger_cub: 'Tiger cubs',
  orchid_mantis: 'Orchid mantises', langsuir: 'Langsuir', black_panther: 'Black panthers',
  oarfish: 'Oarfish', jenglot: 'Jenglot',
  kancil: 'Kancils', kunang_kunang: 'Kunang-kunang', shore_pit_viper: 'Shore pit vipers',
  mangrove_terrapin: 'Mangrove terrapins', lumpur_slime: 'Lumpur slimes', colugo: 'Colugos',
  forest_scorpion: 'Forest scorpions', estuarine_stingray: 'Estuarine stingrays',
  moon_jellyfish: 'Moon jellyfish', javan_myna: 'Javan mynas', pitcher_plant: 'Pitcher plants',
  slow_loris: 'Slow lorises', polong: 'Polong', mambang_kuning: 'Mambang kuning',
  coconut_crab: 'Coconut crabs', rift_wyvern: 'Rift wyverns',
};

// Build the task table from the bestiary: each family's Slayer requirement is
// based on the lowest-level member; harder families need a higher Slayer level.
function buildTasks() {
  const minLevel = {};
  for (const id of ALL_MONSTER_IDS) {
    const n = NPCS[id];
    if (!n || !n.family || !FAMILY_NAMES[n.family]) continue;
    if (minLevel[n.family] === undefined || n.level < minLevel[n.family]) minLevel[n.family] = n.level;
  }
  const tasks = [];
  for (const family of Object.keys(FAMILY_NAMES)) {
    if (minLevel[family] === undefined) continue;
    const lvl = minLevel[family];
    const req = lvl <= 5 ? 1 : lvl <= 15 ? 5 : lvl <= 25 ? 15 : lvl <= 40 ? 30 : 50;
    tasks.push({ family, name: FAMILY_NAMES[family], req, min: 15 + Math.round(lvl / 4), max: 35 + Math.round(lvl / 2) });
  }
  return tasks;
}

export const SLAYER_TASKS = buildTasks();

/** Tasks the player is high enough Slayer level to be assigned. */
export function eligibleTasks(slayerLevel) {
  return SLAYER_TASKS.filter((t) => t.req <= slayerLevel);
}

// Rewards purchasable with Slayer points.
export const SLAYER_REWARDS = [
  { id: 'slayer_helmet', cost: 75, qty: 1 },
  { id: 'slayer_ring', cost: 30, qty: 1 },
  { id: 'coins', cost: 10, qty: 5000 },
  { id: 'nasi_lemak', cost: 5, qty: 5 },
];

// ---------------- Slayer bonuses ----------------
// Slayer level pays off against the monsters on your current task: you hit
// them harder and they sometimes drop a second helping of loot. Both grow in a
// straight line from level 1 to SLAYER_FULL_LEVEL (the same scale as the life
// skill perks) and stop there. A worn Slayer helmet adds a flat bonus on top.
export const SLAYER_FULL_LEVEL = 200;
export const SLAYER_DMG = [5, 35];     // % more damage on task: at level 1, at full level
export const SLAYER_LOOT = [5, 25];    // % chance of an extra loot roll on task
export const SLAYER_HELM_DMG = 10;     // % more on-task damage while wearing the Slayer helmet

/** The on-task bonuses at a Slayer level: { dmg, loot } in percent (one decimal). */
export function slayerBuffs(level) {
  const t = Math.max(0, Math.min(1, ((level || 1) - 1) / (SLAYER_FULL_LEVEL - 1)));
  const at = ([lo, hi]) => Math.round((lo + (hi - lo) * t) * 10) / 10;
  return { dmg: at(SLAYER_DMG), loot: at(SLAYER_LOOT) };
}

/** "+12.3% damage and 8.1% chance of extra loot" at a Slayer level. */
export function slayerBuffText(level) {
  const b = slayerBuffs(level);
  return `+${b.dmg}% damage and ${b.loot}% chance of extra loot against your task`;
}

/** The next Slayer level that unlocks tougher task monsters, and which, or null. */
export function nextSlayerUnlock(level) {
  const lv = SLAYER_TASKS.map((t) => t.req).filter((r) => r > level);
  if (!lv.length) return null;
  const at = Math.min(...lv);
  return { level: at, names: SLAYER_TASKS.filter((t) => t.req === at).map((t) => t.name) };
}
