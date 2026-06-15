// "Trades of the Island" — a guided life-skills quest line run by Cikgu Surya.
//
// Each stage teaches one gathering/artisan ("life") skill: the tutor explains
// what it is and how to do it, the player practises it, and turning in the proof
// grants XP in that skill plus a small purse before the next lesson begins.
//
// A stage's requirement is either:
//   need: { item, qty }  — bring N of an item (the product of the skill), or
//   need: { xp }         — raise the stage's skill by N xp (for skills with no
//                          turn-in item, e.g. Firemaking). The baseline is taken
//                          when the stage begins.
export const LIFE_STAGES = [
  {
    skill: 'woodcutting', name: 'Woodcutting',
    teach: 'First, Woodcutting, lah! Trees grow north of town. Left-click one to chop it for logs — bring me 5 logs.',
    need: { item: 'logs', qty: 5 },
    reward: { xp: 320, coins: 150 },
  },
  {
    skill: 'firemaking', name: 'Firemaking',
    teach: 'Now make fire! Left-click the logs in your pack to light them with your tinderbox. Light a couple until the skill catches.',
    need: { xp: 80 },
    reward: { xp: 260, coins: 150 },
  },
  {
    skill: 'mining', name: 'Mining',
    teach: 'To the rocks! Swing your pickaxe at the ore rocks north of town and bring me 5 copper ore.',
    need: { item: 'copper_ore', qty: 5 },
    reward: { xp: 320, coins: 150 },
  },
  {
    skill: 'smithing', name: 'Smithing',
    teach: 'Smithing turns ore into metal. Mine BOTH copper and tin, smelt them together at the furnace into bronze, then bring me 2 bronze bars.',
    need: { item: 'bronze_bar', qty: 2 },
    reward: { xp: 380, coins: 220 },
  },
  {
    skill: 'fishing', name: 'Fishing',
    teach: 'Time to fish. Take your net to a fishing spot by the water (west of town) and bring me 5 raw anchovies.',
    need: { item: 'raw_anchovy', qty: 5 },
    reward: { xp: 320, coins: 150 },
  },
  {
    skill: 'cooking', name: 'Cooking',
    teach: 'Last lesson: Cooking! Light a fire or use a range, cook your raw anchovies on it, and bring me 5 grilled anchovies.',
    need: { item: 'anchovy', qty: 5 },
    reward: { xp: 400, coins: 250 },
  },
];

// Graduation bonus paid out when the whole line is finished.
export const LIFE_GRAD = {
  skills: ['woodcutting', 'firemaking', 'mining', 'smithing', 'fishing', 'cooking'],
  xp: 250,
  coins: 600,
};

// "Master of Trades" — Cikgu Surya's advanced course, unlocked after the first.
// The same six skills, but higher-tier products that demand real skill levels.
export const LIFE_STAGES_ADV = [
  {
    skill: 'woodcutting', name: 'Woodcutting',
    teach: 'Advanced Woodcutting: oak trees (level 15) give finer logs. Bring me 5 oak logs.',
    need: { item: 'oak_logs', qty: 5 },
    reward: { xp: 900, coins: 400 },
  },
  {
    skill: 'firemaking', name: 'Firemaking',
    teach: 'Burn those oak logs! Light them until your Firemaking really roars.',
    need: { xp: 200 },
    reward: { xp: 800, coins: 400 },
  },
  {
    skill: 'mining', name: 'Mining',
    teach: 'Iron rocks (level 15) yield tougher ore. Bring me 5 iron ore.',
    need: { item: 'iron_ore', qty: 5 },
    reward: { xp: 900, coins: 400 },
  },
  {
    skill: 'smithing', name: 'Smithing',
    teach: 'Steel is iron tempered with coal. Smelt 3 steel bars at the furnace and bring them to me.',
    need: { item: 'steel_bar', qty: 3 },
    reward: { xp: 1100, coins: 600 },
  },
  {
    skill: 'fishing', name: 'Fishing',
    teach: 'Trout (Fishing 20) take patience. Net me 5 raw trout.',
    need: { item: 'raw_trout', qty: 5 },
    reward: { xp: 900, coins: 400 },
  },
  {
    skill: 'cooking', name: 'Cooking',
    teach: 'Final mastery: cook your trout to perfection and bring me 5 cooked trout.',
    need: { item: 'trout', qty: 5 },
    reward: { xp: 1100, coins: 700 },
  },
];

export const LIFE_GRAD_ADV = {
  skills: ['woodcutting', 'firemaking', 'mining', 'smithing', 'fishing', 'cooking'],
  xp: 600,
  coins: 2000,
  item: 'trades_cape',
};
