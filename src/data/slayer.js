// Slayer task system data. Tasks target a monster "family" (a base creature type,
// e.g. all ranks of Goblin) so any matching kill counts. Families/levels are
// derived from the bestiary so a task can never reference a monster that doesn't
// exist. Higher Slayer level unlocks tougher families.
import { NPCS, MONSTER_IDS } from './npcs.js';

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
};

// Build the task table from the bestiary: each family's Slayer requirement is
// based on the lowest-level member; harder families need a higher Slayer level.
function buildTasks() {
  const minLevel = {};
  for (const id of MONSTER_IDS) {
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
