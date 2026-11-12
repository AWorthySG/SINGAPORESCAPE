// Class passives: every 100 levels of a class's fighting skill (Melee for the
// melee classes, Ranged, Magic, or Agility for the Dancer) unlocks one of the
// class's own passive abilities. Each class has three, at levels 100, 200 and
// 300; after that they rank up in turn (Rank II at 400, 500 and 600, and so on
// up to level 9999). `mods` use the same keys as the perk tracks (perks.js) and
// stack once per rank.
export const CLASS_SKILL = { melee: 'attack', ranged: 'ranged', magic: 'magic', dance: 'agility' };

// Every class passive is a damage perk: more damage, crit chance, damage to
// bosses and champions, extra hits or splash onto another foe, flavoured by
// the class (defensive passives became offensive ones). They still stack per
// rank up to the perk caps (PERK_CAPS in perks.js).
export const CLASS_PASSIVES = {
  rogue: [
    { name: 'Shadow Strike', desc: '+4% damage, +2% crit chance', mods: { dmg: 0.04, crit: 0.02 } },
    { name: 'Venom Edge', desc: '+6% damage', mods: { dmg: 0.06 } },
    { name: 'Killer Instinct', desc: '+5% crit chance, +5% damage to bosses', mods: { crit: 0.05, boss: 0.05 } },
  ],
  swordsman: [
    { name: 'Blade Discipline', desc: '+3% crit chance, +3% damage', mods: { crit: 0.03, dmg: 0.03 } },
    { name: 'Counter-Cut', desc: '4% chance of an extra slash, +2% damage', mods: { extra: 0.04, dmg: 0.02 } },
    { name: 'Hero\'s Resolve', desc: '+5% damage, +4% damage to bosses', mods: { dmg: 0.05, boss: 0.04 } },
  ],
  corsair: [
    { name: 'Sea Legs', desc: '+4% damage, +1% crit chance', mods: { dmg: 0.04, crit: 0.01 } },
    { name: 'Plunderer', desc: '+3% damage, 3% chance of an extra slash', mods: { dmg: 0.03, extra: 0.03 } },
    { name: 'Double Down', desc: '5% chance of an extra slash, +2% crit chance', mods: { extra: 0.05, crit: 0.02 } },
  ],
  paladin: [
    { name: 'Holy Fury', desc: '+5% damage', mods: { dmg: 0.05 } },
    { name: 'Righteous Blows', desc: '+3% damage, +2% crit chance', mods: { dmg: 0.03, crit: 0.02 } },
    { name: 'Crusader', desc: '+6% damage to bosses, +3% damage', mods: { boss: 0.06, dmg: 0.03 } },
  ],
  knight: [
    { name: 'Plate Momentum', desc: '+5% damage', mods: { dmg: 0.05 } },
    { name: 'Lance Reach', desc: '+5% damage, +2% crit chance', mods: { dmg: 0.05, crit: 0.02 } },
    { name: 'Dragonslayer', desc: '+8% damage to bosses and champions', mods: { boss: 0.08 } },
  ],
  berserker: [
    { name: 'Blood Rage', desc: '+6% damage', mods: { dmg: 0.06 } },
    { name: 'Unstoppable', desc: '+4% damage, 3% chance of an extra chop', mods: { dmg: 0.04, extra: 0.03 } },
    { name: 'Carnage', desc: '6% chance a hit strikes another foe, +2% damage', mods: { splash: 0.06, dmg: 0.02 } },
  ],
  juggernaut: [
    { name: 'Crushing Weight', desc: '+5% damage', mods: { dmg: 0.05 } },
    { name: 'Shockwave', desc: '6% chance to strike another foe, +2% damage', mods: { splash: 0.06, dmg: 0.02 } },
    { name: 'Titan', desc: '+6% damage, +3% damage to bosses', mods: { dmg: 0.06, boss: 0.03 } },
  ],
  gladiator: [
    { name: 'Crowd Pleaser', desc: '+5% damage, +1% crit chance', mods: { dmg: 0.05, crit: 0.01 } },
    { name: 'Arena Veteran', desc: '+3% crit chance, +2% damage', mods: { crit: 0.03, dmg: 0.02 } },
    { name: 'Champion', desc: '6% chance to strike another foe, +4% damage to bosses', mods: { splash: 0.06, boss: 0.04 } },
  ],
  lancer: [
    { name: 'Long Reach', desc: '+4% crit chance', mods: { crit: 0.04 } },
    { name: 'Skewer', desc: '+6% damage', mods: { dmg: 0.06 } },
    { name: 'Impaler', desc: '4% chance of an extra thrust, +4% damage', mods: { extra: 0.04, dmg: 0.04 } },
  ],
  brawler: [
    { name: 'Quick Paws', desc: '5% chance of an extra swipe', mods: { extra: 0.05 } },
    { name: 'Feral', desc: '+4% crit chance, +2% damage', mods: { crit: 0.04, dmg: 0.02 } },
    { name: 'Alpha', desc: '+6% damage, +2% damage to bosses', mods: { dmg: 0.06, boss: 0.02 } },
  ],
  samurai: [
    { name: 'Bushido', desc: '+3% crit chance, +3% damage', mods: { crit: 0.03, dmg: 0.03 } },
    { name: 'Focus', desc: '+3% crit chance, +3% damage to bosses', mods: { crit: 0.03, boss: 0.03 } },
    { name: 'Ronin\'s Edge', desc: '+5% crit chance, +3% damage', mods: { crit: 0.05, dmg: 0.03 } },
  ],
  halberdier: [
    { name: 'Polearm Mastery', desc: '5% chance a hit strikes another foe', mods: { splash: 0.05 } },
    { name: 'Sweeping Blade', desc: '+5% damage', mods: { dmg: 0.05 } },
    { name: 'Reaper', desc: '+5% damage, 4% chance to strike another foe', mods: { dmg: 0.05, splash: 0.04 } },
  ],
  merchant: [
    { name: 'Heavy Purse', desc: '+5% damage', mods: { dmg: 0.05 } },
    { name: 'Investor', desc: '+4% damage, +1% crit chance', mods: { dmg: 0.04, crit: 0.01 } },
    { name: 'Tycoon', desc: '+5% damage to bosses, +3% damage', mods: { boss: 0.05, dmg: 0.03 } },
  ],
  archer: [
    { name: 'Eagle Eye', desc: '+4% crit chance', mods: { crit: 0.04 } },
    { name: 'Quiver Master', desc: '5% chance of an extra arrow, +2% damage', mods: { extra: 0.05, dmg: 0.02 } },
    { name: 'Rain of Arrows', desc: '6% chance a shot strikes another foe', mods: { splash: 0.06 } },
  ],
  ranger: [
    { name: 'Steady Aim', desc: '+4% crit chance', mods: { crit: 0.04 } },
    { name: 'Hunter\'s Mark', desc: '+6% damage to bosses, +3% damage', mods: { boss: 0.06, dmg: 0.03 } },
    { name: 'Far Shot', desc: '+6% damage', mods: { dmg: 0.06 } },
  ],
  sniper: [
    { name: 'Steady Hands', desc: '+4% crit chance', mods: { crit: 0.04 } },
    { name: 'Long Barrel', desc: '+6% damage', mods: { dmg: 0.06 } },
    { name: 'One Shot', desc: '+6% damage to bosses, +3% crit chance', mods: { boss: 0.06, crit: 0.03 } },
  ],
  pistoler: [
    { name: 'Trigger Happy', desc: '6% chance of an extra shot', mods: { extra: 0.06 } },
    { name: 'Gunslinger', desc: '+3% crit chance, +3% damage', mods: { crit: 0.03, dmg: 0.03 } },
    { name: 'Ricochet', desc: '6% chance a shot strikes another foe', mods: { splash: 0.06 } },
  ],
  ninja: [
    { name: 'Shadow', desc: '+3% crit chance, +2% damage', mods: { crit: 0.03, dmg: 0.02 } },
    { name: 'Poisoned Stars', desc: '+6% damage', mods: { dmg: 0.06 } },
    { name: 'Blade Storm', desc: '5% chance of an extra star, +3% crit chance', mods: { extra: 0.05, crit: 0.03 } },
  ],
  wizard: [
    { name: 'Arcane Mind', desc: '+3% crit chance, +2% spell damage', mods: { crit: 0.03, dmg: 0.02 } },
    { name: 'Elementalist', desc: '+6% spell damage', mods: { dmg: 0.06 } },
    { name: 'Archmage', desc: '+5% damage to bosses, +4% crit chance', mods: { boss: 0.05, crit: 0.04 } },
  ],
  sorcerer: [
    { name: 'Dark Pact', desc: '+5% spell damage', mods: { dmg: 0.05 } },
    { name: 'Hexcraft', desc: '4% chance a spell leaps to another foe, +3% damage', mods: { splash: 0.04, dmg: 0.03 } },
    { name: 'Void Lord', desc: '+4% crit chance, +5% damage to bosses', mods: { crit: 0.04, boss: 0.05 } },
  ],
  dancer: [
    { name: 'Grace', desc: '+3% crit chance, +2% damage', mods: { crit: 0.03, dmg: 0.02 } },
    { name: 'Tempo', desc: '3% chance of an extra lash, +3% damage', mods: { extra: 0.03, dmg: 0.03 } },
    { name: 'Showstopper', desc: '+5% damage, 4% chance a lash strikes another foe', mods: { dmg: 0.05, splash: 0.04 } },
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
