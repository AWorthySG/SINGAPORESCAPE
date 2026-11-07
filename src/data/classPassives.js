// Class passives: every 100 levels of a class's fighting skill (Melee for the
// melee classes, Ranged, Magic, or Agility for the Dancer) unlocks one of the
// class's own passive abilities. Each class has three, at levels 100, 200 and
// 300; after that they rank up in turn (Rank II at 400, 500 and 600, and so on
// up to level 9999). `mods` use the same keys as the perk tracks (perks.js) and
// stack once per rank.
export const CLASS_SKILL = { melee: 'attack', ranged: 'ranged', magic: 'magic', dance: 'agility' };

export const CLASS_PASSIVES = {
  rogue: [
    { name: 'Shadow Step', desc: '+4% dodge, +2% crit chance', mods: { dodge: 0.04, crit: 0.02 } },
    { name: 'Venom Edge', desc: '+2% lifesteal, +5% damage', mods: { lifesteal: 0.02, dmg: 0.05 } },
    { name: 'Killer Instinct', desc: '+5% crit chance, +5% damage to bosses', mods: { crit: 0.05, boss: 0.05 } },
  ],
  swordsman: [
    { name: 'Blade Discipline', desc: '+5% accuracy, +3% damage', mods: { acc: 0.05, dmg: 0.03 } },
    { name: 'Parry', desc: '+4% dodge, 3% less damage taken', mods: { dodge: 0.04, reduce: 0.03 } },
    { name: 'Hero\'s Resolve', desc: '+6% max life, +1 life a tick', mods: { maxhp: 0.06, regen: 1 } },
  ],
  corsair: [
    { name: 'Sea Legs', desc: '+5% dodge', mods: { dodge: 0.05 } },
    { name: 'Plunderer', desc: '+2% lifesteal, 3% chance of an extra slash', mods: { lifesteal: 0.02, extra: 0.03 } },
    { name: 'Double Down', desc: '5% chance of an extra slash, +2% crit chance', mods: { extra: 0.05, crit: 0.02 } },
  ],
  paladin: [
    { name: 'Holy Ward', desc: '5% less damage taken', mods: { reduce: 0.05 } },
    { name: 'Lay on Hands', desc: '+1 life a tick, +2% lifesteal', mods: { regen: 1, lifesteal: 0.02 } },
    { name: 'Crusader', desc: '+6% damage to bosses, +3% damage', mods: { boss: 0.06, dmg: 0.03 } },
  ],
  knight: [
    { name: 'Plate Mastery', desc: '5% less damage taken, +4% max life', mods: { reduce: 0.05, maxhp: 0.04 } },
    { name: 'Lance Reach', desc: 'Ignore 5% of enemy defence, +3% accuracy', mods: { pierce: 0.05, acc: 0.03 } },
    { name: 'Dragonslayer', desc: '+8% damage to bosses and champions', mods: { boss: 0.08 } },
  ],
  berserker: [
    { name: 'Blood Rage', desc: '+6% damage', mods: { dmg: 0.06 } },
    { name: 'Unstoppable', desc: '5% of melee damage taken hurts the attacker, +5% max life', mods: { thorns: 0.05, maxhp: 0.05 } },
    { name: 'Carnage', desc: '6% chance a hit strikes another foe, +2% lifesteal', mods: { splash: 0.06, lifesteal: 0.02 } },
  ],
  juggernaut: [
    { name: 'Iron Skin', desc: '6% less damage taken', mods: { reduce: 0.06 } },
    { name: 'Shockwave', desc: '3% chance to stun, 4% chance to strike another foe', mods: { stun: 0.03, splash: 0.04 } },
    { name: 'Titan', desc: '+8% max life, +4% damage', mods: { maxhp: 0.08, dmg: 0.04 } },
  ],
  gladiator: [
    { name: 'Crowd Pleaser', desc: '+8% adrenaline from hits, +3% damage', mods: { adren: 0.08, dmg: 0.03 } },
    { name: 'Arena Veteran', desc: '+3% dodge, 3% less damage taken', mods: { dodge: 0.03, reduce: 0.03 } },
    { name: 'Champion', desc: '6% chance to strike another foe, +4% damage to bosses', mods: { splash: 0.06, boss: 0.04 } },
  ],
  lancer: [
    { name: 'Long Reach', desc: '+6% accuracy', mods: { acc: 0.06 } },
    { name: 'Skewer', desc: 'Ignore 6% of enemy defence', mods: { pierce: 0.06 } },
    { name: 'Impaler', desc: '4% chance of an extra thrust, +4% damage', mods: { extra: 0.04, dmg: 0.04 } },
  ],
  brawler: [
    { name: 'Quick Paws', desc: '5% chance of an extra swipe', mods: { extra: 0.05 } },
    { name: 'Feral', desc: '+4% crit chance, +1% lifesteal', mods: { crit: 0.04, lifesteal: 0.01 } },
    { name: 'Alpha', desc: '+5% damage, +3% dodge', mods: { dmg: 0.05, dodge: 0.03 } },
  ],
  samurai: [
    { name: 'Bushido', desc: '+4% accuracy, +3% crit chance', mods: { acc: 0.04, crit: 0.03 } },
    { name: 'Focus', desc: '+8% adrenaline from hits, +2% crit chance', mods: { adren: 0.08, crit: 0.02 } },
    { name: 'Ronin\'s Edge', desc: '+5% crit chance, ignore 3% of enemy defence', mods: { crit: 0.05, pierce: 0.03 } },
  ],
  halberdier: [
    { name: 'Polearm Mastery', desc: '5% chance a hit strikes another foe', mods: { splash: 0.05 } },
    { name: 'Bulwark', desc: '5% less damage taken', mods: { reduce: 0.05 } },
    { name: 'Reaper', desc: '+5% damage, 4% chance to strike another foe', mods: { dmg: 0.05, splash: 0.04 } },
  ],
  merchant: [
    { name: 'Comfortable Living', desc: '+1 life a tick, +2% lifesteal', mods: { regen: 1, lifesteal: 0.02 } },
    { name: 'Investor', desc: '+8% adrenaline from hits, +3% damage', mods: { adren: 0.08, dmg: 0.03 } },
    { name: 'Tycoon', desc: '+5% damage to bosses, +6% max life', mods: { boss: 0.05, maxhp: 0.06 } },
  ],
  archer: [
    { name: 'Eagle Eye', desc: '+6% accuracy', mods: { acc: 0.06 } },
    { name: 'Quiver Master', desc: '5% chance of an extra arrow, 5% chance a shot uses no arrow', mods: { extra: 0.05, arrowSave: 0.05 } },
    { name: 'Rain of Arrows', desc: '6% chance a shot strikes another foe', mods: { splash: 0.06 } },
  ],
  ranger: [
    { name: 'Steady Aim', desc: '+4% crit chance', mods: { crit: 0.04 } },
    { name: 'Hunter\'s Mark', desc: '+6% damage to bosses, ignore 3% of enemy defence', mods: { boss: 0.06, pierce: 0.03 } },
    { name: 'Far Shot', desc: '+6% damage, +1 tile of reach', mods: { dmg: 0.06, range: 1 } },
  ],
  sniper: [
    { name: 'Steady Hands', desc: '+6% accuracy', mods: { acc: 0.06 } },
    { name: 'Long Barrel', desc: '+2 tiles of reach, +3% damage', mods: { range: 2, dmg: 0.03 } },
    { name: 'One Shot', desc: '+6% damage to bosses, +3% crit chance', mods: { boss: 0.06, crit: 0.03 } },
  ],
  pistoler: [
    { name: 'Trigger Happy', desc: '6% chance of an extra shot', mods: { extra: 0.06 } },
    { name: 'Gunslinger', desc: '+3% crit chance, +3% dodge', mods: { crit: 0.03, dodge: 0.03 } },
    { name: 'Ricochet', desc: '6% chance a shot strikes another foe', mods: { splash: 0.06 } },
  ],
  ninja: [
    { name: 'Shadow', desc: '+6% dodge', mods: { dodge: 0.06 } },
    { name: 'Poisoned Stars', desc: '+2% lifesteal, +4% damage', mods: { lifesteal: 0.02, dmg: 0.04 } },
    { name: 'Blade Storm', desc: '5% chance of an extra star, +3% crit chance', mods: { extra: 0.05, crit: 0.03 } },
  ],
  wizard: [
    { name: 'Arcane Mind', desc: '+5% accuracy, 5% chance a cast uses no runes', mods: { acc: 0.05, runeSave: 0.05 } },
    { name: 'Elementalist', desc: '+6% spell damage', mods: { dmg: 0.06 } },
    { name: 'Archmage', desc: '+5% damage to bosses, +4% crit chance', mods: { boss: 0.05, crit: 0.04 } },
  ],
  sorcerer: [
    { name: 'Dark Pact', desc: '+3% lifesteal', mods: { lifesteal: 0.03 } },
    { name: 'Hexcraft', desc: '4% chance to stun, +3% damage', mods: { stun: 0.04, dmg: 0.03 } },
    { name: 'Void Lord', desc: '+4% crit chance, +5% damage to bosses', mods: { crit: 0.04, boss: 0.05 } },
  ],
  dancer: [
    { name: 'Grace', desc: '+5% dodge', mods: { dodge: 0.05 } },
    { name: 'Tempo', desc: '+8% adrenaline from hits, 3% chance of an extra lash', mods: { adren: 0.08, extra: 0.03 } },
    { name: 'Showstopper', desc: '+5% damage, 3% chance to stun', mods: { dmg: 0.05, stun: 0.03 } },
  ],
};

/** The class's passives with their rank at this skill level (0 = still locked)
 *  and the level each one unlocks at. */
export function classPassives(classId, level) {
  const list = CLASS_PASSIVES[classId] || [];
  const unlocked = Math.floor((level || 0) / 100);
  return list.map((p, i) => ({ ...p, unlockAt: (i + 1) * 100, rank: unlocked > i ? Math.floor((unlocked - 1 - i) / list.length) + 1 : 0 }));
}

/** All the class passives' mods summed at this level. */
export function classPassiveMods(classId, level) {
  const out = {};
  for (const p of classPassives(classId, level)) {
    if (!p.rank) continue;
    for (const [k, v] of Object.entries(p.mods)) out[k] = (out[k] || 0) + v * p.rank;
  }
  return out;
}
