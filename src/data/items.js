// Item registry. Every item the game knows about lives here.
//
// Fields:
//   name       display name
//   icon       emoji used as the item sprite
//   examine    flavour text (right-click -> Examine)
//   value      base shop value in coins
//   stackable  true for currency / arrows-style items
//   heal       hitpoints restored when eaten (makes it edible)
//   tool       gathering/crafting tool tag ('axe','pickaxe','net','tinderbox','hammer')
//   equip      { slot, req?, bonuses?: {attack,strength,defence,speed} }
//   tags       misc tags (e.g. 'log' for firemaking, 'raw' for cooking)

const RAW = {
  // ---- Currency ----
  coins: { name: 'Coins', icon: '🪙', value: 1, stackable: true, maxStack: Infinity, examine: 'Lovely money!' },

  // ---- Tools ----
  bronze_axe: { name: 'Bronze axe', icon: '🪓', value: 16, tool: 'axe',
    examine: 'A woodcutter\'s axe.', equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 2, strength: 3, speed: 5 } } },
  bronze_pickaxe: { name: 'Bronze pickaxe', icon: '⛏️', value: 16, tool: 'pickaxe',
    examine: 'Used for mining.', equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 2, strength: 2, speed: 5 } } },
  small_net: { name: 'Small fishing net', icon: '🕸️', value: 5, tool: 'net', examine: 'Useful for catching small fish.' },
  tinderbox: { name: 'Tinderbox', icon: '🧰', value: 1, tool: 'tinderbox', examine: 'Useful for lighting fires.' },
  hammer: { name: 'Hammer', icon: '🔨', value: 1, tool: 'hammer', examine: 'Good for smithing.' },

  // ---- Woodcutting ----
  logs: { name: 'Logs', icon: '🪵', value: 4, tags: ['log'], firemaking: 1, fmXp: 40, examine: 'A bundle of logs.' },
  oak_logs: { name: 'Oak logs', icon: '🪵', value: 12, tags: ['log'], firemaking: 15, fmXp: 60, examine: 'Logs cut from an oak tree.' },
  willow_logs: { name: 'Willow logs', icon: '🪵', value: 20, tags: ['log'], firemaking: 30, fmXp: 90, examine: 'Logs cut from a willow tree.' },

  // ---- Mining / Smithing ore & bars ----
  copper_ore: { name: 'Copper ore', icon: '🟤', value: 3, examine: 'This needs refining.' },
  tin_ore: { name: 'Tin ore', icon: '⚪', value: 3, examine: 'This needs refining.' },
  iron_ore: { name: 'Iron ore', icon: '🔘', value: 17, examine: 'This needs refining.' },
  coal: { name: 'Coal', icon: '⬛', value: 45, examine: 'A lump of coal.' },
  bronze_bar: { name: 'Bronze bar', icon: '🟫', value: 30, examine: 'A bar of bronze.' },
  iron_bar: { name: 'Iron bar', icon: '⬜', value: 80, examine: 'A bar of iron.' },

  // ---- Fishing / Cooking ----
  raw_anchovy: { name: 'Raw anchovy', icon: '🐟', value: 6, tags: ['raw'], examine: 'I should cook this first.' },
  raw_sardine: { name: 'Raw sardine', icon: '🐟', value: 8, tags: ['raw'], examine: 'I should cook this first.' },
  raw_trout: { name: 'Raw trout', icon: '🐠', value: 20, tags: ['raw'], examine: 'I should cook this first.' },
  anchovy: { name: 'Grilled anchovy', icon: '🍤', value: 12, heal: 1, examine: 'Crispy ikan bilis.' },
  sardine: { name: 'Grilled sardine', icon: '🍢', value: 16, heal: 4, examine: 'A grilled sardine.' },
  trout: { name: 'Grilled trout', icon: '🍣', value: 30, heal: 7, examine: 'A nicely grilled trout.' },
  burnt_fish: { name: 'Burnt fish', icon: '🪨', value: 1, examine: 'Oops. Charcoal for dinner.' },

  // ---- Shop food (Singapore hawker fare) ----
  kaya_toast: { name: 'Kaya toast', icon: '🍞', value: 8, heal: 3, examine: 'Toast with kaya and butter.' },
  chicken_rice: { name: 'Chicken rice', icon: '🍚', value: 30, heal: 9, examine: 'Hainanese chicken rice. Shiok!' },
  roti_prata: { name: 'Roti prata', icon: '🫓', value: 18, heal: 6, examine: 'Crispy roti prata with curry.' },

  // ---- Weapons ----
  bronze_dagger: { name: 'Bronze dagger', icon: '🗡️', value: 10, examine: 'A vicious-looking dagger.',
    equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 4, strength: 3, speed: 4 } } },
  bronze_sword: { name: 'Bronze sword', icon: '🗡️', value: 26, examine: 'A bronze sword.',
    equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 5, strength: 5, speed: 5 } } },
  bronze_scimitar: { name: 'Bronze scimitar', icon: '🗡️', value: 32, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 7, strength: 6, speed: 4 } } },
  iron_scimitar: { name: 'Iron scimitar', icon: '⚔️', value: 112, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 10, strength: 9, speed: 4 } } },
  steel_scimitar: { name: 'Steel scimitar', icon: '⚔️', value: 400, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 5 }, bonuses: { attack: 15, strength: 14, speed: 4 } } },

  // ---- Armour ----
  wooden_shield: { name: 'Wooden shield', icon: '🛡️', value: 20, examine: 'A solid wooden shield.',
    equip: { slot: 'shield', req: { defence: 1 }, bonuses: { defence: 4 } } },
  bronze_kiteshield: { name: 'Bronze kiteshield', icon: '🛡️', value: 84, examine: 'A medium, kite-shaped shield.',
    equip: { slot: 'shield', req: { defence: 1 }, bonuses: { defence: 8 } } },
  bronze_helm: { name: 'Bronze full helm', icon: '⛑️', value: 44, examine: 'A full helmet.',
    equip: { slot: 'head', req: { defence: 1 }, bonuses: { defence: 5 } } },
  bronze_platebody: { name: 'Bronze platebody', icon: '🦺', value: 100, examine: 'Provides excellent protection.',
    equip: { slot: 'body', req: { defence: 1 }, bonuses: { defence: 11 } } },
  bronze_platelegs: { name: 'Bronze platelegs', icon: '👖', value: 64, examine: 'These look pretty heavy.',
    equip: { slot: 'legs', req: { defence: 1 }, bonuses: { defence: 9 } } },
  iron_platebody: { name: 'Iron platebody', icon: '🦺', value: 280, examine: 'Provides excellent protection.',
    equip: { slot: 'body', req: { defence: 1 }, bonuses: { defence: 18 } } },
  iron_full_helm: { name: 'Iron full helm', icon: '⛑️', value: 84, examine: 'A full helmet.',
    equip: { slot: 'head', req: { defence: 1 }, bonuses: { defence: 8 } } },
  leather_body: { name: 'Leather body', icon: '🧥', value: 14, examine: 'It\'s a leather body.',
    equip: { slot: 'body', req: { defence: 1 }, bonuses: { defence: 3 } } },

  // ---- Misc / quest-ish ----
  bones: { name: 'Bones', icon: '🦴', value: 1, examine: 'Ew, it\'s a pile of bones.' },
  feather: { name: 'Feather', icon: '🪶', value: 2, stackable: true, examine: 'A small feather.' },
  raw_chicken: { name: 'Raw chicken', icon: '🍗', value: 4, tags: ['raw'], examine: 'I need to cook this first.' },
  cooked_chicken: { name: 'Cooked chicken', icon: '🍗', value: 8, heal: 3, examine: 'Mmm chicken.' },
  egg: { name: 'Egg', icon: '🥚', value: 4, examine: 'A nice fresh egg.' },
  amulet_of_power: { name: 'Amulet of power', icon: '📿', value: 1000, examine: 'A powerful amulet.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 6, strength: 6, defence: 6 } } },
};

// Freeze each definition and attach its id for convenience.
export const ITEMS = Object.fromEntries(
  Object.entries(RAW).map(([id, def]) => [id, Object.freeze({ id, ...def })])
);

export function getItem(id) {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown item id: ${id}`);
  return item;
}

export function isStackable(id) {
  return !!ITEMS[id]?.stackable;
}
