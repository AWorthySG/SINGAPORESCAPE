// Each selected boss has one extra roll per loot roll. The entries are
// mutually exclusive, so even a lucky roll gives at most one trophy.
export const BOSS_REWARDS = {
  kelong_king_crab: [
    { id: 'kelong_claw_ring', chance: 0.06, name: 'Kelong claw ring', value: 7800,
      equip: { slot: 'ring', req: { defence: 45 }, bonuses: { defence: 7, hp: 5, pierce: 2 } },
      examine: 'A ring with an ivory claw setting. It hardens your guard and helps pierce armour.' },
    { id: 'kelong_carapace', chance: 0.04, name: 'Kelong carapace', value: 19500,
      equip: { slot: 'body', family: 'plate', req: { defence: 45 }, bonuses: { defence: 75, hp: 12, pierce: 2 } },
      examine: 'A platebody of overlapping crab shell. Its thick plates protect the wearer.' },
    { id: 'kelong_claw_warhammer', chance: 0.04, name: 'Kelong claw warhammer', value: 22500,
      equip: { slot: 'weapon', req: { attack: 45 }, range: 2, bonuses: { attack: 66, strength: 95, speed: 6, pierce: 3 } },
      examine: 'The King Crab’s claw, riveted to steel. Its head splits armour when it strikes.' },
  ],
  lion_of_light: [
    { id: 'lion_sun_amulet', chance: 0.05, name: 'Lion’s sun amulet', value: 9000,
      equip: { slot: 'amulet', style: 'magic', req: { magic: 45 }, bonuses: { magic: 15, magicStr: 3, prayer: 5, bossDmg: 3 } },
      examine: 'The gleaming likeness of the Lion of Light. It feeds Faith and helps spells strike bosses harder.' },
    { id: 'lion_sun_robe', chance: 0.04, name: 'Lion’s sun robe', value: 20000,
      equip: { slot: 'body', family: 'robes', req: { magic: 55, defence: 40 }, bonuses: { magic: 25, magicStr: 3, defence: 18, prayer: 5, pierce: 3, magPct: 2 } },
      examine: 'Ivory robes embroidered with rays of sunlight. The lining holds a little of the Lion’s light.' },
    { id: 'lion_sun_wand', chance: 0.04, name: 'Lion’s sun wand', value: 22000,
      equip: { slot: 'weapon', combatType: 'magic', req: { magic: 55 }, bonuses: { magic: 33, magicStr: 4, speed: 4, bossDmg: 5 } },
      examine: 'A small sun burns at the tip of this wand, even in the darkest ruin.' },
  ],
  supertree_guardian: [
    { id: 'supertree_canopy_ring', chance: 0.05, name: 'Supertree canopy ring', value: 22000,
      equip: { slot: 'ring', style: 'ranged', req: { ranged: 95 }, bonuses: { ranged: 15, haste: 3, crit: 2 } },
      examine: 'A band of silver vines that helps a ranged fighter sight and fire quickly.' },
    { id: 'supertree_leafmail', chance: 0.035, name: 'Supertree leafmail', value: 52000,
      equip: { slot: 'body', family: 'hide', req: { ranged: 110, defence: 80 }, bonuses: { ranged: 49, defence: 40, haste: 5, pierce: 5 } },
      examine: 'Flexible hide layered with the Guardian’s leaves. It moves easily with a drawn bow.' },
    { id: 'supertree_canopy_longbow', chance: 0.03, name: 'Supertree canopy longbow', value: 57000,
      equip: { slot: 'weapon', combatType: 'ranged', req: { ranged: 110 }, bonuses: { ranged: 164, speed: 4, haste: 2 } },
      examine: 'A limb of the Supertree that took root in its own bowstring. Built for quick follow-up shots.' },
  ],
  rift_tyrant: [
    { id: 'rift_tyrant_amulet', chance: 0.045, name: 'Rift Tyrant’s amulet', value: 94000,
      equip: { slot: 'amulet', req: { defence: 220 }, bonuses: { defence: 14, hp: 6, critDmg: 8, bossDmg: 6 } },
      examine: 'A shard of the Tyrant’s rift with a fractured heart. It deepens critical hits and wounds bosses.' },
    { id: 'rift_tyrant_platebody', chance: 0.03, name: 'Rift Tyrant’s platebody', value: 170000,
      equip: { slot: 'body', family: 'plate', req: { defence: 220 }, bonuses: { defence: 345, hp: 32, pierce: 9, bossDmg: 6 } },
      examine: 'Black plates bound by violet fissures. The armour holds firm under heavy blows.' },
    { id: 'rift_tyrant_longsword', chance: 0.03, name: 'Rift Tyrant’s longsword', value: 185000,
      equip: { slot: 'weapon', req: { attack: 220 }, range: 3, bonuses: { attack: 260, strength: 230, speed: 5, bossDmg: 9 } },
      examine: 'A straight blade cut from the Rift. Its edge deals more damage to bosses.' },
  ],
};

export function rollBossReward(rewards, rand = Math.random) {
  if (!rewards?.length) return null;
  let roll = rand();
  for (const reward of rewards) {
    roll -= reward.chance;
    if (roll < 0) return reward.id;
  }
  return null;
}
