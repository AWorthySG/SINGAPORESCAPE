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
