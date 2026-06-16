// Combination dishes: assemble cooked ingredients (and crafted pottery) into
// hearty meals at a fire or range. Unlike single-item cooking these never burn —
// they're prepared, not just grilled. inputs -> result, gated by Cooking level.
export const DISHES = [
  // Local hawker dishes, unlocked by gathering aromatic herbs.
  { result: 'chicken_rice', inputs: [{ id: 'bowl', qty: 1 }, { id: 'cooked_chicken', qty: 1 }, { id: 'galangal', qty: 1 }, { id: 'pandan_leaves', qty: 1 }], level: 18, xp: 120 },
  { result: 'satay', inputs: [{ id: 'cooked_chicken', qty: 1 }, { id: 'lemongrass', qty: 1 }, { id: 'turmeric', qty: 1 }], level: 22, xp: 130 },
  { result: 'nasi_lemak', inputs: [{ id: 'bowl', qty: 1 }, { id: 'pandan_leaves', qty: 1 }, { id: 'anchovy', qty: 1 }, { id: 'chilli', qty: 1 }], level: 30, xp: 165 },
  { result: 'meat_pie', inputs: [{ id: 'pie_dish', qty: 1 }, { id: 'cooked_chicken', qty: 1 }], level: 20, xp: 110 },
  { result: 'laksa', inputs: [{ id: 'bowl', qty: 1 }, { id: 'mackerel', qty: 1 }], level: 25, xp: 130 },
  { result: 'fish_pie', inputs: [{ id: 'pie_dish', qty: 1 }, { id: 'salmon', qty: 1 }], level: 30, xp: 145 },
  { result: 'seafood_stew', inputs: [{ id: 'bowl', qty: 1 }, { id: 'lobster', qty: 1 }, { id: 'tuna', qty: 1 }], level: 40, xp: 185 },
  { result: 'seafood_platter', inputs: [{ id: 'bowl', qty: 1 }, { id: 'shark', qty: 1 }, { id: 'lobster', qty: 1 }], level: 60, xp: 270 },
];
