// Crafting recipes. Worked at a crafting table: inputs -> result. Jewelry needs a
// chisel. Gives the materials gathered from the new mining/woodcutting nodes a use.
export const CRAFT = [
  { result: 'pot', inputs: [{ id: 'clay', qty: 1 }], level: 1, xp: 6 },
  { result: 'bowl', inputs: [{ id: 'clay', qty: 1 }], level: 5, xp: 9 },
  { result: 'gold_ring', inputs: [{ id: 'gold_ore', qty: 1 }], level: 5, xp: 18 },
  { result: 'gold_amulet', inputs: [{ id: 'gold_ore', qty: 1 }], level: 8, xp: 30 },
  { result: 'sapphire_ring', inputs: [{ id: 'silver_ore', qty: 1 }, { id: 'sapphire', qty: 1 }], level: 12, xp: 50, tool: 'chisel' },
  { result: 'sapphire_amulet', inputs: [{ id: 'silver_ore', qty: 1 }, { id: 'sapphire', qty: 1 }], level: 16, xp: 65, tool: 'chisel' },
  { result: 'emerald_amulet', inputs: [{ id: 'silver_ore', qty: 1 }, { id: 'emerald', qty: 1 }], level: 27, xp: 90, tool: 'chisel' },
  { result: 'ruby_amulet', inputs: [{ id: 'silver_ore', qty: 1 }, { id: 'ruby', qty: 1 }], level: 42, xp: 125, tool: 'chisel' },
  { result: 'granite_shield', inputs: [{ id: 'granite', qty: 2 }], level: 50, xp: 130 },
  { result: 'diamond_amulet', inputs: [{ id: 'silver_ore', qty: 1 }, { id: 'diamond', qty: 1 }], level: 55, xp: 165, tool: 'chisel' },

  // ---- Pottery ----
  { result: 'jug', inputs: [{ id: 'clay', qty: 1 }], level: 8, xp: 12 },
  { result: 'pie_dish', inputs: [{ id: 'clay', qty: 1 }], level: 10, xp: 14 },

  // ---- Glassblowing (sandstone -> glass) ----
  { result: 'molten_glass', inputs: [{ id: 'sandstone', qty: 1 }], level: 20, xp: 35 },
  { result: 'vial', inputs: [{ id: 'molten_glass', qty: 1 }], level: 22, xp: 18 },
  { result: 'glass_orb', inputs: [{ id: 'molten_glass', qty: 1 }], level: 28, xp: 30 },
  { result: 'lantern', inputs: [{ id: 'molten_glass', qty: 1 }, { id: 'bronze_bar', qty: 1 }], level: 33, xp: 45 },

  // ---- Gem rings (need a chisel) ----
  { result: 'emerald_ring', inputs: [{ id: 'silver_ore', qty: 1 }, { id: 'emerald', qty: 1 }], level: 30, xp: 95, tool: 'chisel' },
  { result: 'ruby_ring', inputs: [{ id: 'silver_ore', qty: 1 }, { id: 'ruby', qty: 1 }], level: 44, xp: 130, tool: 'chisel' },
  { result: 'diamond_ring', inputs: [{ id: 'silver_ore', qty: 1 }, { id: 'diamond', qty: 1 }], level: 58, xp: 170, tool: 'chisel' },

  // ---- Granite armour ----
  { result: 'granite_helm', inputs: [{ id: 'granite', qty: 1 }], level: 45, xp: 90 },
  { result: 'granite_legs', inputs: [{ id: 'granite', qty: 3 }], level: 55, xp: 170 },
  { result: 'granite_body', inputs: [{ id: 'granite', qty: 4 }], level: 60, xp: 230 },
];
