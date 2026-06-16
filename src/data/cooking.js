// Combination dishes: assemble cooked ingredients (and crafted pottery) into
// hearty meals at a fire or range. Unlike single-item cooking these never burn —
// they're prepared, not just grilled. inputs -> result, gated by Cooking level.
export const DISHES = [
  { result: 'meat_pie', inputs: [{ id: 'pie_dish', qty: 1 }, { id: 'cooked_chicken', qty: 1 }], level: 20, xp: 110 },
  { result: 'laksa', inputs: [{ id: 'bowl', qty: 1 }, { id: 'mackerel', qty: 1 }], level: 25, xp: 130 },
  { result: 'fish_pie', inputs: [{ id: 'pie_dish', qty: 1 }, { id: 'salmon', qty: 1 }], level: 30, xp: 145 },
  { result: 'seafood_stew', inputs: [{ id: 'bowl', qty: 1 }, { id: 'lobster', qty: 1 }, { id: 'tuna', qty: 1 }], level: 40, xp: 185 },
  { result: 'seafood_platter', inputs: [{ id: 'bowl', qty: 1 }, { id: 'shark', qty: 1 }, { id: 'lobster', qty: 1 }], level: 60, xp: 270 },
];
