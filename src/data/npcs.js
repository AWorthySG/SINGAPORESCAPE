// NPC registry: monsters (attackable) and townsfolk (dialogue / shop / bank).
//
// Combat NPCs use: level (display), maxHp, attack, strength, defence, maxHit,
//   attackSpeed (ticks), aggressive, aggroRange, respawn (ticks), wander.
// Loot: alwaysDrop[] always rolls; dropTable[] rolls once (include {nothing} weight).

export const NPCS = {
  // ---------------- Monsters ----------------
  chicken: {
    name: 'Chicken', emoji: '🐔', level: 1, attackable: true,
    maxHp: 3, attack: 1, strength: 1, defence: 1, maxHit: 1, attackSpeed: 4,
    aggressive: false, respawn: 12, wander: 3, examine: 'Yep. Definitely a chicken.',
    alwaysDrop: [{ id: 'bones' }, { id: 'raw_chicken' }],
    dropTable: [{ id: 'feather', min: 5, max: 15, weight: 100 }],
  },
  rat: {
    name: 'Giant rat', emoji: '🐀', level: 3, attackable: true,
    maxHp: 8, attack: 2, strength: 2, defence: 1, maxHit: 1, attackSpeed: 4,
    aggressive: false, respawn: 14, wander: 4, examine: 'Now that\'s a big rat.',
    alwaysDrop: [{ id: 'bones' }],
    dropTable: [{ nothing: true, weight: 60 }, { id: 'coins', min: 1, max: 8, weight: 40 }],
  },
  goblin: {
    name: 'Goblin', emoji: '👺', level: 5, attackable: true,
    maxHp: 12, attack: 3, strength: 4, defence: 2, maxHit: 2, attackSpeed: 4,
    aggressive: true, aggroRange: 4, respawn: 16, wander: 5, examine: 'An ugly green creature.',
    alwaysDrop: [{ id: 'bones' }],
    dropTable: [
      { nothing: true, weight: 30 },
      { id: 'coins', min: 1, max: 25, weight: 45 },
      { id: 'bronze_dagger', weight: 12 },
      { id: 'bronze_sword', weight: 8 },
      { id: 'bronze_helm', weight: 5 },
    ],
  },
  macaque: {
    name: 'Macaque', emoji: '🐒', level: 8, attackable: true,
    maxHp: 16, attack: 6, strength: 6, defence: 4, maxHit: 3, attackSpeed: 4,
    aggressive: true, aggroRange: 3, respawn: 18, wander: 6, examine: 'A cheeky monkey. Watch your bag!',
    alwaysDrop: [{ id: 'bones' }],
    dropTable: [
      { nothing: true, weight: 25 },
      { id: 'coins', min: 5, max: 45, weight: 50 },
      { id: 'kaya_toast', weight: 15 },
      { id: 'leather_body', weight: 10 },
    ],
  },
  monitor_lizard: {
    name: 'Monitor lizard', emoji: '🦎', level: 14, attackable: true,
    maxHp: 28, attack: 12, strength: 11, defence: 9, maxHit: 4, attackSpeed: 5,
    aggressive: true, aggroRange: 4, respawn: 22, wander: 5, examine: 'A large, scaly reptile.',
    alwaysDrop: [{ id: 'bones' }],
    dropTable: [
      { nothing: true, weight: 20 },
      { id: 'coins', min: 15, max: 90, weight: 45 },
      { id: 'iron_ore', min: 1, max: 3, weight: 15 },
      { id: 'bronze_platebody', weight: 12 },
      { id: 'iron_scimitar', weight: 8 },
    ],
  },
  guard: {
    name: 'Town guard', emoji: '💂', level: 21, attackable: true,
    maxHp: 40, attack: 19, strength: 18, defence: 16, maxHit: 5, attackSpeed: 5,
    aggressive: false, respawn: 25, wander: 4, examine: 'A heavily armoured guard.',
    alwaysDrop: [{ id: 'bones' }],
    dropTable: [
      { nothing: true, weight: 18 },
      { id: 'coins', min: 30, max: 160, weight: 45 },
      { id: 'iron_full_helm', weight: 14 },
      { id: 'iron_platebody', weight: 10 },
      { id: 'steel_scimitar', weight: 5 },
      { id: 'amulet_of_power', weight: 1 },
    ],
  },

  // ---------------- Townsfolk ----------------
  guide: {
    name: 'Kampong Guide', emoji: '🧓', level: 0, attackable: false, role: 'dialogue',
    wander: 0, examine: 'He looks like he knows his way around.',
    dialogue: 'guide',
  },
  shopkeeper: {
    name: 'Shopkeeper', emoji: '🧑‍🍳', level: 0, attackable: false, role: 'shop',
    wander: 0, examine: 'He owns the general store.', shop: 'general',
  },
  banker: {
    name: 'Banker', emoji: '🧑‍💼', level: 0, attackable: false, role: 'bank',
    wander: 0, examine: 'He can look after my valuables.',
  },
  hawker: {
    name: 'Hawker Auntie', emoji: '👩‍🍳', level: 0, attackable: false, role: 'shop',
    wander: 0, examine: 'She sells delicious local food.', shop: 'hawker',
  },
  villager: {
    name: 'Villager', emoji: '🧑', level: 0, attackable: false, role: 'dialogue',
    wander: 5, examine: 'A local resident.', dialogue: 'villager',
  },
};

export function getNpc(id) {
  const npc = NPCS[id];
  if (!npc) throw new Error(`Unknown npc id: ${id}`);
  return npc;
}
