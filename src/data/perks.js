// Passive perks: every 20 levels in a fighting skill unlocks the next perk on
// that skill's track (10 per track). Past level 200 the track goes round
// again, ranking each perk up (Rank II at 220, III at 420, ...), all the way
// to level 999.
//
// A perk's `mods` are added once per rank. The keys are read by the combat code:
//   acc, dmg, crit         accuracy, damage (fractions) and crit chance (fraction)
//   extra                  chance of an extra hit / arrow / swing
//   pierce                 ignore this share of the target's defence
//   boss                   extra damage against bosses and champions
//   lifesteal              heal this share of the damage you deal
//   stun                   chance a hit stops the target attacking for a moment
//   splash                 chance a hit also strikes another nearby monster
//   adren                  extra adrenaline from landing hits
//   arrowSave / runeSave   chance a shot or cast uses no ammunition
//   range                  extra tiles of bow reach
//   reduce, bossReduce     less damage taken (all / from bosses)
//   dodge                  chance to slip an attack entirely
//   maxhp                  extra max life (fraction)
//   regen                  life regained per tick
//   thorns                 share of melee damage taken that hurts the attacker
//   dotReduce              less damage from poison, burns and bleeds

export const PERK_SKILLS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'agility'];
export const PERK_EVERY = 20;

// Which tracks feed which fighting style. Defence perks help in every style.
export const STYLE_TRACKS = { melee: ['attack', 'strength'], ranged: ['ranged'], magic: ['magic'], dance: ['agility'] };

export const PERK_TRACKS = {
  attack: [
    { name: 'Keen Eye', desc: '+3% melee accuracy', mods: { acc: 0.03 } },
    { name: 'Precision', desc: '+1% melee critical chance', mods: { crit: 0.01 } },
    { name: 'Double Strike', desc: '3% chance to swing twice', mods: { extra: 0.03 } },
    { name: 'Armour Breaker', desc: 'Ignore 4% of enemy defence', mods: { pierce: 0.04 } },
    { name: 'Giant Slayer', desc: '+4% damage to bosses and champions', mods: { boss: 0.04 } },
    { name: 'Battle Rhythm', desc: '+5% adrenaline from hits', mods: { adren: 0.05 } },
    { name: 'Vampiric Edge', desc: 'Heal 1% of melee damage dealt', mods: { lifesteal: 0.01 } },
    { name: 'Weapon Master', desc: '+2% accuracy and +0.5% critical chance', mods: { acc: 0.02, crit: 0.005 } },
    { name: 'Concussive Blow', desc: '2% chance to stun on hit', mods: { stun: 0.02 } },
    { name: 'Deadly Focus', desc: '+1.5% melee critical chance', mods: { crit: 0.015 } },
  ],
  strength: [
    { name: 'Brute Force', desc: '+4% melee damage', mods: { dmg: 0.04 } },
    { name: 'Heavy Hitter', desc: '+5% damage to bosses and champions', mods: { boss: 0.05 } },
    { name: 'Bloodlust', desc: 'Heal 1.5% of melee damage dealt', mods: { lifesteal: 0.015 } },
    { name: 'Cleave', desc: '4% chance to hit a second nearby monster', mods: { splash: 0.04 } },
    { name: 'Overpower', desc: 'Ignore 3% of enemy defence', mods: { pierce: 0.03 } },
    { name: 'Rampage', desc: '2% chance to swing twice', mods: { extra: 0.02 } },
    { name: 'Bone Crusher', desc: '2.5% chance to stun on hit', mods: { stun: 0.025 } },
    { name: 'Mighty', desc: '+3% melee damage', mods: { dmg: 0.03 } },
    { name: 'Executioner', desc: '+1% melee critical chance', mods: { crit: 0.01 } },
    { name: 'Titan Grip', desc: '+2% melee damage and accuracy', mods: { dmg: 0.02, acc: 0.02 } },
  ],
  defence: [
    { name: 'Thick Hide', desc: 'Take 2% less damage', mods: { reduce: 0.02 } },
    { name: 'Vitality', desc: '+4% max life', mods: { maxhp: 0.04 } },
    { name: 'Regeneration', desc: 'Regain life over time', mods: { regen: 0.25 } },
    { name: 'Spiked Armour', desc: 'Melee attackers take 5% of the damage they deal', mods: { thorns: 0.05 } },
    { name: 'Evasion', desc: '1.5% chance to dodge an attack', mods: { dodge: 0.015 } },
    { name: 'Boss Ward', desc: 'Take 3% less damage from bosses', mods: { bossReduce: 0.03 } },
    { name: 'Bulwark', desc: 'Take 1.5% less damage', mods: { reduce: 0.015 } },
    { name: 'Second Skin', desc: '+3% max life', mods: { maxhp: 0.03 } },
    { name: 'Iron Will', desc: 'Take 6% less damage from poison, burns and bleeds', mods: { dotReduce: 0.06 } },
    { name: 'Fortitude', desc: 'Regain life over time', mods: { regen: 0.2 } },
  ],
  ranged: [
    { name: 'Eagle Eye', desc: '+3% ranged accuracy', mods: { acc: 0.03 } },
    { name: 'Steady Aim', desc: '+1% ranged critical chance', mods: { crit: 0.01 } },
    { name: 'Quiver Master', desc: '4% chance a shot uses no arrow', mods: { arrowSave: 0.04 } },
    { name: 'Long Shot', desc: '+1 tile of bow reach', mods: { range: 1 } },
    { name: 'Multishot', desc: '3% chance an arrow also hits another monster', mods: { splash: 0.03 } },
    { name: 'Piercing Arrows', desc: 'Ignore 4% of enemy defence', mods: { pierce: 0.04 } },
    { name: "Hunter's Mark", desc: '+4% damage to bosses and champions', mods: { boss: 0.04 } },
    { name: 'Rapid Fire', desc: '2% chance to loose a second arrow', mods: { extra: 0.02 } },
    { name: 'Deadeye', desc: '+4% ranged damage', mods: { dmg: 0.04 } },
    { name: 'Barbed Arrows', desc: '2% chance to stun on hit', mods: { stun: 0.02 } },
  ],
  magic: [
    { name: 'Arcane Focus', desc: '+3% magic accuracy', mods: { acc: 0.03 } },
    { name: 'Spell Power', desc: '+4% spell damage', mods: { dmg: 0.04 } },
    { name: 'Rune Saver', desc: '5% chance a cast uses no runes', mods: { runeSave: 0.05 } },
    { name: 'Chain Spell', desc: '3% chance a spell leaps to another monster', mods: { splash: 0.03 } },
    { name: 'Mana Ward', desc: 'Take 1.5% less damage', mods: { reduce: 0.015 } },
    { name: 'Critical Cast', desc: '+1% spell critical chance', mods: { crit: 0.01 } },
    { name: 'Spell Echo', desc: '2% chance a spell casts twice', mods: { extra: 0.02 } },
    { name: 'Siphon', desc: 'Heal 1% of spell damage dealt', mods: { lifesteal: 0.01 } },
    { name: 'Archmage', desc: '+4% damage to bosses and champions', mods: { boss: 0.04 } },
    { name: 'Overcharge', desc: '2% chance to stun on hit', mods: { stun: 0.02 } },
  ],
  agility: [
    { name: 'Graceful', desc: '+1% chance to dodge', mods: { dodge: 0.01 } },
    { name: 'Tempo', desc: '+3% whip damage', mods: { dmg: 0.03 } },
    { name: 'Whiplash', desc: '+4% whip damage', mods: { dmg: 0.04 } },
    { name: 'Flourish Master', desc: '+3% whip accuracy', mods: { acc: 0.03 } },
    { name: 'Spin', desc: '4% chance a lash also hits another monster', mods: { splash: 0.04 } },
    { name: 'Lightfoot', desc: '+5% adrenaline from hits', mods: { adren: 0.05 } },
    { name: 'Silk Step', desc: '+1% whip critical chance', mods: { crit: 0.01 } },
    { name: 'Encore', desc: '3% chance to lash twice', mods: { extra: 0.03 } },
    { name: "Dancer's Mark", desc: '+4% damage to bosses and champions', mods: { boss: 0.04 } },
    { name: 'Mesmerise', desc: '2% chance to stun on hit', mods: { stun: 0.02 } },
  ],
};

// Caps so stacked ranks stay sane at level 999.
export const PERK_CAPS = {
  acc: 0.6, dmg: 1.0, crit: 0.25, extra: 0.3, pierce: 0.5, boss: 1.0, lifesteal: 0.15, stun: 0.2, splash: 0.4, adren: 1.0,
  arrowSave: 0.5, runeSave: 0.5, range: 6, reduce: 0.4, bossReduce: 0.3, dodge: 0.25, maxhp: 0.6, regen: 3, thorns: 0.5, dotReduce: 0.6,
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
export const rankName = (r) => ROMAN[r] || String(r);

/** Perks unlocked on one track at a skill level: [{ ...perk, rank, index }] (rank 0 = locked). */
export function trackPerks(skill, level) {
  const milestones = Math.floor(level / PERK_EVERY);
  return PERK_TRACKS[skill].map((p, i) => ({ ...p, index: i, rank: milestones > i ? Math.floor((milestones - 1 - i) / 10) + 1 : 0 }));
}

/** The perk unlocked (or ranked up) at exactly this level, or null. */
export function perkAtLevel(skill, level) {
  if (!PERK_TRACKS[skill] || level % PERK_EVERY !== 0 || level <= 0) return null;
  const m = level / PERK_EVERY;            // 1-based milestone
  const i = (m - 1) % 10;
  return { ...PERK_TRACKS[skill][i], index: i, rank: Math.floor((m - 1) / 10) + 1 };
}

/** Summed, capped modifiers from a list of tracks at the given skill levels. */
export function sumPerks(tracks, levelOf) {
  const out = {};
  for (const sk of tracks) {
    for (const p of trackPerks(sk, levelOf(sk))) {
      if (!p.rank) continue;
      for (const [k, v] of Object.entries(p.mods)) out[k] = (out[k] || 0) + v * p.rank;
    }
  }
  for (const k of Object.keys(out)) if (PERK_CAPS[k] != null) out[k] = Math.min(PERK_CAPS[k], out[k]);
  return out;
}
