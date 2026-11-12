// Active combat abilities. Fuelled by Adrenaline (built by landing and taking
// hits), each ability has an adrenaline cost and a cooldown in game ticks.
//
// kind:
//   'attack' — armed like a special; the modifiers apply to your next hit
//              (dmgMul scales damage, hits>1 strikes repeatedly, guaranteed rolls high,
//               never in the low half of the damage roll).
//   'guard'  — applied immediately; halves incoming damage for guardTicks (the
//              counter to a monster's telegraphed heavy blow).
//   'heal'   — applied immediately; restores healFrac of max life.
//   'buff'   — applied immediately; `buff` boosts you for `ticks` ticks:
//              dmg (+share of damage), haste (+% attack speed), crit (+chance),
//              lifesteal (share healed), reduce (share of damage taken off), dodge.
// `unlock` is the combat level the ability becomes usable (abilities ramp in as
// the player grows; the ultimate is gated behind a high level + full adrenaline).
// `mode` ties an attack ability to the equipped weapon's combat style
// ('melee' | 'ranged' | 'magic' | 'dance'); the action bar shows only the set for the
// weapon in hand, so each hotkey slot (Z / X / B) swaps with your weapon.
// `instant` fires straight away at your current target instead of waiting for
// the next swing (never on a free basic skill, which would be a free extra attack).
// ---- Adrenaline: build and spend ----
// Abilities come in three tiers. Basic skills (Z, plus the class's C) cost
// nothing and BUILD adrenaline (`build`); threshold skills (X) spend 50; the
// ultimate (B) spends 100. Landing any hit gives ADREN_PER_HIT and taking one
// ADREN_PER_HURT, and each class builds extra its own way (CLASS_ADRENALINE).
export const ADREN_PER_HIT = 5;
export const ADREN_PER_HURT = 3;
export const THRESHOLD_COST = 50;
export const ULTIMATE_COST = 100;
// How each class builds adrenaline on top of the basics:
//   hit   extra per hit landed       crit  extra per critical hit
//   hurt  extra per hit taken        kill  extra per monster killed
//   lowHp extra per hit landed while below half life (the Berserker's rage)
export const CLASS_ADRENALINE = {
  rogue: { crit: 6 }, swordsman: { hit: 1, hurt: 4 }, corsair: { hit: 2 }, paladin: { hurt: 5 },
  knight: { hurt: 6 }, berserker: { lowHp: 6, kill: 10 }, juggernaut: { hurt: 6 }, gladiator: { hit: 1, kill: 15 },
  lancer: { hit: 1, hurt: 3 }, brawler: { crit: 5 }, samurai: { crit: 6 }, halberdier: { hit: 1, hurt: 4 },
  merchant: { hit: 2 }, archer: { hit: 2 }, ranger: { hit: 1, crit: 5 }, pistoler: { hit: 2 }, sniper: { hit: 8 },
  ninja: { hit: 1, crit: 4 }, wizard: { hit: 3 }, sorcerer: { hit: 2, kill: 8 }, dancer: { hit: 2 },
};

// Active combat abilities, fuelled by adrenaline (see above). Each has an
// adrenaline cost and a cooldown in game ticks.
//
// kind:
//   'attack' — armed like a special; the modifiers apply to your next hit
//              (dmgMul scales damage, hits>1 strikes repeatedly, guaranteed rolls high,
//               never in the low half of the damage roll).
//   'guard'  — applied immediately; halves incoming damage for guardTicks (the
//              counter to a monster's telegraphed heavy blow).
//   'heal'   — applied immediately; restores healFrac of max life.
//   'buff'   — applied immediately; `buff` boosts you for `ticks` ticks:
//              dmg (+share of damage), haste (+% attack speed), crit (+chance),
//              lifesteal (share healed), reduce (share of damage taken off), dodge.
// `build` is the adrenaline a basic skill gives when it's used.
// `execute` adds that share of damage against a foe under EXECUTE_BELOW life.
// `unlock` is the combat level the ability becomes usable (abilities ramp in as
// the player grows; the ultimate is gated behind a high level + full adrenaline).
// `mode` ties an attack ability to the equipped weapon's combat style
// ('melee' | 'ranged' | 'magic' | 'dance'); the action bar shows only the set for the
// weapon in hand, so each hotkey slot (Z / X / C / B) swaps with your weapon.
// `instant` fires straight away at your current target instead of waiting for
// the next swing (never on a free basic skill, which would be a free extra attack).
export const EXECUTE_BELOW = 0.35;
// Tiers: Z basic attack, X threshold skill, C basic utility, B ultimate.
const Z = { key: 'Z', cost: 0, build: 12, cd: 3, kind: 'attack', unlock: 1, tier: 'basic' };
const BF = { key: 'X', cost: THRESHOLD_COST, cd: 20, kind: 'buff', unlock: 1, ticks: 15, tier: 'threshold' };
const C = { key: 'C', cost: 0, cd: 25, unlock: 1, tier: 'basic' };
const B = { key: 'B', cost: ULTIMATE_COST, cd: 30, kind: 'attack', unlock: 45, tier: 'ultimate' };
export const ABILITIES = [
  // ---- Melee (swords, scimitars, maces, axes…) ----
  { ...Z, id: 'power_strike', name: 'Power Strike', icon: '💥', mode: 'melee', dmgMul: 1.4, guaranteed: true, desc: 'A heavy blow (~1.4x damage).' },
  { ...BF, id: 'battle_cry', name: 'Battle Cry', icon: '📣', mode: 'melee', art: 'brace', buff: { dmg: 0.35 }, desc: 'A rousing cry: +35% damage for 9s.' },
  // ---- Ranged (bows) ----
  { ...Z, id: 'snapshot', name: 'Snapshot', icon: '🏹', mode: 'ranged', hits: 2, dmgMul: 0.7, desc: 'Your next shot looses two arrows at once.' },
  { ...BF, id: 'focus', name: 'Focus', icon: '🧘', mode: 'ranged', art: 'brace', buff: { haste: 60 }, desc: 'Steady breathing: +60% attack speed for 9s.' },
  // ---- Magic (staves) ----
  { ...Z, id: 'arcane_surge', name: 'Arcane Surge', icon: '✨', mode: 'magic', dmgMul: 1.4, guaranteed: true, desc: 'Your next spell surges: heavy, ~1.4x damage.' },
  { ...BF, id: 'mana_flow', name: 'Mana Flow', icon: '💠', mode: 'magic', art: 'mana_burst', buff: { dmg: 0.35 }, desc: 'Mana surges through you: +35% spell damage for 9s.' },
  // ---- Dance (whips) ----
  { ...Z, id: 'crack', name: 'Chain Crack', icon: '💫', mode: 'dance', cd: 4, dmgMul: 1.2, guaranteed: true, stun: 1, chain: 3, desc: 'A crack (~1.2x) that ricochets through up to 3 more monsters, stunning every one.' },
  { ...BF, id: 'tempo', name: 'Tempo', icon: '🎶', mode: 'dance', art: 'whirl', buff: { haste: 60, dmg: 0.2 }, rhythm: 5, desc: 'Find the beat: full Rhythm, +60% attack speed and +20% damage for 9s.' },
  // ---- Shared ----
  { ...C, id: 'brace', name: 'Brace', icon: '🛡️', cd: 8, kind: 'guard', guardTicks: 4, reduce: 0.5, desc: 'Halve incoming damage for 4 ticks — counter heavy blows.' },
  { id: 'second_wind', name: 'Second Wind', key: 'V', icon: '💚', cost: 0, cd: 60, kind: 'heal', tier: 'basic',
    unlock: 1, healFrac: 0.25, desc: 'Recover a quarter of your life in an instant (36s cooldown).' },
  // ---- Ultimates ----
  { ...B, id: 'onslaught', name: 'Onslaught', icon: '⚡', mode: 'melee', hits: 4, dmgMul: 0.85, guaranteed: true,
    desc: 'Ultimate: four heavy strikes that spend all your adrenaline.' },
  { ...B, id: 'arrow_storm', name: 'Arrow Storm', icon: '🌧️', mode: 'ranged', hits: 5, dmgMul: 0.8, guaranteed: true, instant: true,
    desc: 'Ultimate: rain five heavy arrows down on your target at once.' },
  { ...B, id: 'meteor', name: 'Meteor', icon: '☄️', mode: 'magic', dmgMul: 3.2, guaranteed: true, instant: true,
    desc: 'Ultimate: call down a heavy meteor (~3.2x damage).' },
  { ...B, id: 'grand_finale', name: 'Grand Finale', icon: '🎭', mode: 'dance', hits: 5, dmgMul: 0.9, guaranteed: true, sweep: true, rhythm: 5,
    desc: 'Ultimate: a five-beat dance that lashes everything in reach and leaves you at full Rhythm.' },
];

// ---- Class abilities ----
// Each job class has its own four skills, built from its weapon's character:
// a basic attack that builds adrenaline (Z), a threshold buff that spends 50
// (X), a basic utility or defence move (C) and its ultimate (B, an area
// attack). Second Wind (V) stays shared.
// Extra effects on top of the ones above:
//   crit     the hit is always a critical (x2, or x4 on a mega crit)
//   pierce   unused: player attacks always land, so there is no defence to ignore
//   lifesteal share of the damage dealt healed back
//   cleave   multiplies the weapon's cleave share for this hit (melee)
//   stun     ticks the foe reels and can't strike back
//   guard    ticks of halved incoming damage after the hit (like Brace)
//   summon   A-Worthlings called up (Merchant)
// `art` names the existing ability artwork the icon reuses.
const CLASS_ABILITIES = [
  // Rogue: daggers. Builds adrenaline on crits; finishes off the wounded.
  { ...Z, id: 'backstab', cls: 'rogue', mode: 'melee', name: 'Backstab', icon: '🗡️', art: 'power_strike', dmgMul: 1.2, execute: 1, desc: 'Stab at a weak spot (~1.2x), double damage on a foe under 35% life.' },
  { ...BF, id: 'shadow_step', cls: 'rogue', mode: 'melee', name: 'Shadow Step', icon: '🌑', art: 'brace', buff: { crit: 0.3, haste: 50 }, desc: 'Melt into the shadows: +30% crit chance and +50% attack speed for 9s.' },
  { ...C, id: 'vanish', cls: 'rogue', mode: 'melee', name: 'Vanish', icon: '💨', art: 'whirl', kind: 'buff', ticks: 5, buff: { dodge: 0.6 }, desc: 'Vanish from sight: dodge 60% of attacks for 3s.' },
  { ...B, id: 'assassinate', cls: 'rogue', mode: 'melee', name: 'Assassinate', icon: '☠️', art: 'onslaught', hits: 3, dmgMul: 1, guaranteed: true, crit: true, execute: 1, desc: 'Ultimate: three critical stabs, doubled on a foe under 35% life.' },
  // Swordsman: swords. The all-rounder: builds when struck, counters, parries.
  { ...Z, id: 'riposte', cls: 'swordsman', mode: 'melee', name: 'Riposte', icon: '⚔️', art: 'power_strike', dmgMul: 1.3, guaranteed: true, guard: 2, desc: 'A counter-cut (~1.3x) that leaves you braced for 2 ticks.' },
  { ...BF, id: 'battle_focus', cls: 'swordsman', mode: 'melee', name: 'Battle Focus', icon: '🎯', art: 'brace', buff: { dmg: 0.35, reduce: 0.2 }, desc: 'Steady your blade: +35% damage and 20% less damage taken for 9s.' },
  { ...C, id: 'parry', cls: 'swordsman', mode: 'melee', name: 'Parry', icon: '🤺', art: 'brace', cd: 12, kind: 'guard', guardTicks: 4, build: 10, desc: 'Turn blows aside: halve damage for 4 ticks and gain 10 adrenaline.' },
  { ...B, id: 'heroic_strike', cls: 'swordsman', mode: 'melee', name: 'Heroic Strike', icon: '🦸', art: 'onslaught', dmgMul: 3, guaranteed: true, cleave: 2, desc: 'Ultimate: a heavy hero\'s blow (~3x) that cleaves twice as wide.' },
  // Corsair: dual scimitars. Many quick hits, each building a little.
  { ...Z, id: 'cutlass_flurry', cls: 'corsair', mode: 'melee', name: 'Cutlass Flurry', icon: '🏴‍☠️', art: 'flurry', build: 8, hits: 3, dmgMul: 0.5, desc: 'Three lightning slashes from both blades.' },
  { ...BF, id: 'sea_legs', cls: 'corsair', mode: 'melee', name: 'Sea Legs', icon: '🌊', art: 'brace', buff: { haste: 80, dodge: 0.15 }, desc: 'Roll with the waves: +80% attack speed and +15% dodge for 9s.' },
  { ...C, id: 'grog', cls: 'corsair', mode: 'melee', name: 'Swig of Grog', icon: '🍺', art: 'second_wind', cd: 30, kind: 'heal', healFrac: 0.15, desc: 'A swig of grog: restore 15% of your life.' },
  { ...B, id: 'broadside', cls: 'corsair', mode: 'melee', name: 'Broadside', icon: '💣', art: 'onslaught', hits: 6, dmgMul: 0.6, guaranteed: true, desc: 'Ultimate: six heavy slashes, a full broadside.' },
  // Paladin: maces. Holy sustain: builds when struck, heals as it smites.
  { ...Z, id: 'smite', cls: 'paladin', mode: 'melee', name: 'Smite', icon: '✝️', art: 'power_strike', dmgMul: 1.3, guaranteed: true, lifesteal: 0.2, desc: 'A holy blow (~1.3x) that heals a fifth of the damage.' },
  { ...BF, id: 'holy_aura', cls: 'paladin', mode: 'melee', name: 'Holy Aura', icon: '😇', art: 'brace', buff: { lifesteal: 0.15, reduce: 0.3 }, desc: 'A holy glow: heal 15% of the damage you deal and take 30% less for 9s.' },
  { ...C, id: 'lay_on_hands', cls: 'paladin', mode: 'melee', name: 'Lay on Hands', icon: '🙌', art: 'second_wind', cd: 40, kind: 'heal', healFrac: 0.3, desc: 'Heal yourself for 30% of your life.' },
  { ...B, id: 'divine_hammer', cls: 'paladin', mode: 'melee', name: 'Divine Hammer', icon: '🔨', art: 'onslaught', dmgMul: 3, guaranteed: true, lifesteal: 0.5, desc: 'Ultimate: a heavy heavenly strike (~3x) that heals half of it.' },
  // Knight: longswords. The wall: builds most when struck.
  { ...Z, id: 'lance_thrust', cls: 'knight', mode: 'melee', name: 'Lance Thrust', icon: '🛡️', art: 'piercing_shot', dmgMul: 1.4, guaranteed: true, desc: 'A heavy thrust (~1.4x) through a gap in their guard.' },
  { ...BF, id: 'shield_wall', cls: 'knight', mode: 'melee', name: 'Shield Wall', icon: '🛡️', art: 'brace', buff: { reduce: 0.5, dmg: 0.15 }, desc: 'Raise your guard: take 50% less damage and deal 15% more for 9s.' },
  { ...C, id: 'hold_fast', cls: 'knight', mode: 'melee', name: 'Hold Fast', icon: '🏰', art: 'brace', cd: 15, kind: 'guard', guardTicks: 6, build: 5, desc: 'Plant your feet: halve damage for 6 ticks.' },
  { ...B, id: 'dragonbane', cls: 'knight', mode: 'melee', name: 'Dragonbane', icon: '🐉', art: 'onslaught', dmgMul: 3.4, guaranteed: true, pierce: 0.4, desc: 'Ultimate: a heavy knightly blow (~3.4x) fit to fell a dragon.' },
  // Berserker: battleaxes. Rage: builds faster when hurt and on every kill.
  { ...Z, id: 'axe_cleave', cls: 'berserker', mode: 'melee', name: 'Great Cleave', icon: '🪓', art: 'power_strike', dmgMul: 1.2, cleave: 2, desc: 'A huge chop (~1.2x) that cleaves twice as hard into the pack.' },
  { ...BF, id: 'berserk_rage', cls: 'berserker', mode: 'melee', name: 'Berserk Rage', icon: '😡', art: 'brace', buff: { dmg: 0.5, haste: 40 }, desc: 'Lose yourself in rage: +50% damage and +40% attack speed for 9s.' },
  { ...C, id: 'blood_frenzy', cls: 'berserker', mode: 'melee', name: 'Blood Frenzy', icon: '🩸', art: 'whirl', kind: 'buff', ticks: 8, buff: { lifesteal: 0.25, dmg: 0.15 }, desc: 'Drink deep: heal 25% of the damage you deal and +15% damage for 5s.' },
  { ...B, id: 'rampage', cls: 'berserker', mode: 'melee', name: 'Rampage', icon: '😡', art: 'onslaught', hits: 4, dmgMul: 0.9, guaranteed: true, cleave: 2, desc: 'Ultimate: four heavy chops, each cleaving twice as hard.' },
  // Juggernaut: warhammers. Stuns and soaks: builds when struck.
  { ...Z, id: 'earthshaker', cls: 'juggernaut', mode: 'melee', name: 'Earthshaker', icon: '🌋', art: 'power_strike', cd: 4, dmgMul: 1.2, stun: 1, cleave: 1.5, desc: 'Slam the ground (~1.2x): stuns the foe and cleaves wider.' },
  { ...BF, id: 'iron_skin', cls: 'juggernaut', mode: 'melee', name: 'Iron Skin', icon: '🪨', art: 'brace', buff: { reduce: 0.4, dmg: 0.25 }, desc: 'Skin like iron: take 40% less damage and deal 25% more for 9s.' },
  { ...C, id: 'unbreakable', cls: 'juggernaut', mode: 'melee', name: 'Unbreakable', icon: '🗿', art: 'brace', cd: 15, kind: 'guard', guardTicks: 6, build: 5, desc: 'Nothing moves you: halve damage for 6 ticks.' },
  { ...B, id: 'cataclysm', cls: 'juggernaut', mode: 'melee', name: 'Cataclysm', icon: '💥', art: 'onslaught', dmgMul: 3.6, guaranteed: true, stun: 3, cleave: 2, desc: 'Ultimate: a heavy quake (~3.6x) that stuns and cleaves twice as hard.' },
  // Gladiator: two-handed swords. Plays to the crowd: every kill builds big.
  { ...Z, id: 'arena_sweep', cls: 'gladiator', mode: 'melee', name: 'Arena Sweep', icon: '🏟️', art: 'flurry', dmgMul: 1.2, cleave: 2, desc: 'A wide sweep (~1.2x) that cleaves twice as hard.' },
  { ...BF, id: 'crowd_roar', cls: 'gladiator', mode: 'melee', name: 'Crowd\'s Roar', icon: '🏟️', art: 'brace', buff: { dmg: 0.35, crit: 0.15 }, desc: 'The crowd roars: +35% damage and +15% crit chance for 9s.' },
  { ...C, id: 'victory_rush', cls: 'gladiator', mode: 'melee', name: 'Victory Rush', icon: '🏅', art: 'second_wind', cd: 30, kind: 'heal', healFrac: 0.2, build: 10, desc: 'Feed on the cheers: restore 20% of your life and gain 10 adrenaline.' },
  { ...B, id: 'champions_wrath', cls: 'gladiator', mode: 'melee', name: 'Champion\'s Wrath', icon: '🏆', art: 'onslaught', hits: 3, dmgMul: 1.2, guaranteed: true, cleave: 2, desc: 'Ultimate: three heavy great-sword blows, cleaving twice as hard.' },
  // Lancer: spears. Reach and a set spear against charges.
  { ...Z, id: 'impale', cls: 'lancer', mode: 'melee', name: 'Impale', icon: '🔱', art: 'piercing_shot', dmgMul: 1.4, guaranteed: true, desc: 'A heavy thrust (~1.4x) that skewers them.' },
  { ...BF, id: 'phalanx_stance', cls: 'lancer', mode: 'melee', name: 'Phalanx Stance', icon: '🔱', art: 'brace', buff: { dmg: 0.3, reduce: 0.25 }, desc: 'Plant your spear: +30% damage and 25% less damage taken for 9s.' },
  { ...C, id: 'set_spear', cls: 'lancer', mode: 'melee', name: 'Set Spear', icon: '📍', art: 'piercing_shot', cd: 10, kind: 'attack', dmgMul: 1, stun: 2, build: 8, desc: 'Brace your spear against the charge (~1x): the foe is stunned for 2 ticks.' },
  { ...B, id: 'phalanx', cls: 'lancer', mode: 'melee', name: 'Phalanx', icon: '🛡️', art: 'onslaught', hits: 4, dmgMul: 0.9, guaranteed: true, pierce: 0.3, desc: 'Ultimate: four heavy spear thrusts in a wall of steel.' },
  // Brawler: claws. Crit-hungry and fast.
  { ...Z, id: 'rend', cls: 'brawler', mode: 'melee', name: 'Rend', icon: '🐾', art: 'flurry', build: 8, hits: 2, dmgMul: 0.6, crit: true, desc: 'Two raking slashes, each a critical hit.' },
  { ...BF, id: 'adrenaline_rush', cls: 'brawler', mode: 'melee', name: 'Adrenaline Rush', icon: '💢', art: 'brace', buff: { haste: 100 }, desc: 'Fists of fury: attack twice as often for 9s.' },
  { ...C, id: 'feral_instinct', cls: 'brawler', mode: 'melee', name: 'Feral Instinct', icon: '🐈', art: 'whirl', kind: 'buff', ticks: 8, buff: { dodge: 0.3, lifesteal: 0.1 }, desc: 'Cat-quick: +30% dodge and heal 10% of the damage you deal for 5s.' },
  { ...B, id: 'feral_frenzy', cls: 'brawler', mode: 'melee', name: 'Feral Frenzy', icon: '😼', art: 'onslaught', hits: 8, dmgMul: 0.45, guaranteed: true, desc: 'Ultimate: eight heavy claw strikes in a blur.' },
  // Samurai: katanas. Precision: crits build, the draw-cut finishes.
  { ...Z, id: 'iaijutsu', cls: 'samurai', mode: 'melee', name: 'Iaijutsu', icon: '🎌', art: 'power_strike', dmgMul: 0.7, crit: true, desc: 'Draw and cut in one motion: a critical (~0.7x, then x2 or x4).' },
  { ...BF, id: 'bushido', cls: 'samurai', mode: 'melee', name: 'Bushido', icon: '🎌', art: 'brace', buff: { crit: 0.3, dmg: 0.2 }, desc: 'The warrior\'s way: +30% crit chance and +20% damage for 9s.' },
  { ...C, id: 'meditate', cls: 'samurai', mode: 'melee', name: 'Meditate', icon: '🧘', art: 'second_wind', cd: 30, kind: 'heal', healFrac: 0.2, build: 15, desc: 'A breath of stillness: restore 20% of your life and gain 15 adrenaline.' },
  { ...B, id: 'thousand_cuts', cls: 'samurai', mode: 'melee', name: 'Thousand Cuts', icon: '🌸', art: 'onslaught', hits: 6, dmgMul: 0.6, guaranteed: true, execute: 0.5, desc: 'Ultimate: six heavy katana cuts, +50% on a foe under 35% life.' },
  // Halberdier: halberds. Holds the line against a crowd.
  { ...Z, id: 'reaping_arc', cls: 'halberdier', mode: 'melee', name: 'Reaping Arc', icon: '🌙', art: 'flurry', dmgMul: 1.2, cleave: 2, desc: 'A long reaping swing (~1.2x) that cleaves twice as hard.' },
  { ...BF, id: 'hold_the_line', cls: 'halberdier', mode: 'melee', name: 'Hold the Line', icon: '🚩', art: 'brace', buff: { reduce: 0.35, dmg: 0.25 }, desc: 'Stand firm: take 35% less damage and deal 25% more for 9s.' },
  { ...C, id: 'stand_firm', cls: 'halberdier', mode: 'melee', name: 'Stand Firm', icon: '⚓', art: 'brace', cd: 15, kind: 'guard', guardTicks: 5, build: 5, desc: 'Brace the halberd: halve damage for 5 ticks.' },
  { ...B, id: 'iron_tempest', cls: 'halberdier', mode: 'melee', name: 'Iron Tempest', icon: '🌪️', art: 'onslaught', hits: 3, dmgMul: 1.1, guaranteed: true, cleave: 2, desc: 'Ultimate: three heavy sweeps, cleaving twice as hard.' },
  // Merchant: canes and A-Worthlings. Pays for skills in coins, not adrenaline.
  { ...Z, id: 'golden_cane', cls: 'merchant', mode: 'ranged', name: 'Gold Rush', icon: '🪙', art: 'snapshot', hits: 2, dmgMul: 0.7, lifesteal: 0.1, desc: 'Fling two fistfuls of gold at once (~0.7x each), healing a tenth of the damage.' },
  { ...BF, id: 'hire_bodyguards', cls: 'merchant', mode: 'ranged', name: 'Hire Bodyguards', icon: '🤝', art: 'brace', summon: 2, buff: { dmg: 0.2 }, desc: 'Call in two A-Worthlings and +20% damage for 9s.' },
  { ...C, id: 'pay_off', cls: 'merchant', mode: 'ranged', name: 'Pay Them Off', icon: '💰', art: 'brace', kind: 'buff', ticks: 8, buff: { reduce: 0.3, dodge: 0.1 }, desc: 'Grease a few palms: take 30% less damage and +10% dodge for 5s.' },
  { ...B, id: 'hostile_takeover', cls: 'merchant', mode: 'ranged', name: 'Hostile Takeover', icon: '📈', art: 'arrow_storm', dmgMul: 3, guaranteed: true, instant: true, summon: 3, desc: 'Ultimate: a heavy shower of coins (~3x) and three A-Worthlings join the fight.' },
  // Archer: shortbows. Builds a little with every arrow.
  { ...Z, id: 'quick_volley', cls: 'archer', mode: 'ranged', name: 'Quick Volley', icon: '🏹', art: 'snapshot', build: 10, hits: 2, dmgMul: 0.7, desc: 'Loose two arrows at once.' },
  { ...BF, id: 'eagle_eye', cls: 'archer', mode: 'ranged', name: 'Eagle Eye', icon: '🦅', art: 'brace', buff: { haste: 60, crit: 0.1 }, desc: 'Sharp eyes: +60% attack speed and +10% crit chance for 9s.' },
  { ...C, id: 'disengage', cls: 'archer', mode: 'ranged', name: 'Disengage', icon: '🍃', art: 'whirl', kind: 'buff', ticks: 6, buff: { dodge: 0.4, haste: 30 }, desc: 'Light on your feet: +40% dodge and +30% attack speed for 4s.' },
  { ...B, id: 'arrow_rain', cls: 'archer', mode: 'ranged', name: 'Arrow Rain', icon: '🌧️', art: 'arrow_storm', hits: 6, dmgMul: 0.75, guaranteed: true, instant: true, desc: 'Ultimate: six heavy arrows rain down at once.' },
  // Ranger: longbows. Patient shots; crits build.
  { ...Z, id: 'aimed_shot', cls: 'ranger', mode: 'ranged', name: 'Aimed Shot', icon: '🎯', art: 'piercing_shot', dmgMul: 1.4, guaranteed: true, desc: 'Take your time: a heavy arrow (~1.4x).' },
  { ...BF, id: 'steady_aim', cls: 'ranger', mode: 'ranged', name: 'Steady Aim', icon: '🎯', art: 'brace', buff: { dmg: 0.45 }, desc: 'Breathe and aim: +45% damage for 9s.' },
  { ...C, id: 'camouflage', cls: 'ranger', mode: 'ranged', name: 'Camouflage', icon: '🌿', art: 'whirl', kind: 'buff', ticks: 6, buff: { dodge: 0.5 }, desc: 'Fade into the brush: dodge half of all attacks for 4s.' },
  { ...B, id: 'deadeye', cls: 'ranger', mode: 'ranged', name: 'Deadeye', icon: '👁️', art: 'arrow_storm', dmgMul: 4, guaranteed: true, instant: true, desc: 'Ultimate: one perfect long-range shot (~4x), instantly.' },
  // Pistoler: dual pistols. Bullets fly; every one builds.
  { ...Z, id: 'quickdraw', cls: 'pistoler', mode: 'ranged', name: 'Quickdraw', icon: '🔫', art: 'snapshot', build: 10, hits: 2, dmgMul: 0.6, desc: 'Fan the hammer: your next shot is two.' },
  { ...BF, id: 'fan_the_hammer', cls: 'pistoler', mode: 'ranged', name: 'Fan the Hammer', icon: '🔫', art: 'brace', buff: { haste: 100 }, desc: 'Fan the hammer: shoot twice as often for 9s.' },
  { ...C, id: 'dive_roll', cls: 'pistoler', mode: 'ranged', name: 'Dive Roll', icon: '🤸', art: 'whirl', cd: 20, kind: 'buff', ticks: 4, buff: { dodge: 0.6 }, desc: 'Hit the dirt: dodge 60% of attacks for 2s.' },
  { ...B, id: 'bullet_hell', cls: 'pistoler', mode: 'ranged', name: 'Bullet Hell', icon: '💥', art: 'arrow_storm', hits: 8, dmgMul: 0.5, guaranteed: true, instant: true, desc: 'Ultimate: empty both pistols, eight heavy shots at once.' },
  // Sniper: rifles. Slow, huge rounds: each one builds a lot.
  { ...Z, id: 'deadshot', cls: 'sniper', mode: 'ranged', name: 'Deadshot', icon: '🎯', art: 'piercing_shot', build: 15, dmgMul: 1.3, guaranteed: true, desc: 'A heavy round (~1.3x) that lands with crushing force.' },
  { ...BF, id: 'hold_breath', cls: 'sniper', mode: 'ranged', name: 'Hold Your Breath', icon: '🫁', art: 'brace', buff: { crit: 0.3, dmg: 0.3 }, desc: 'Steady the scope: +30% crit chance and +30% damage for 9s.' },
  { ...C, id: 'ghillie', cls: 'sniper', mode: 'ranged', name: 'Ghillie Suit', icon: '🌾', art: 'brace', kind: 'buff', ticks: 8, buff: { dodge: 0.4, reduce: 0.2 }, desc: 'Go to ground: +40% dodge and 20% less damage taken for 5s.' },
  { ...B, id: 'collateral', cls: 'sniper', mode: 'ranged', name: 'Collateral', icon: '💥', art: 'arrow_storm', dmgMul: 3.5, guaranteed: true, instant: true, pierce: 0.5, desc: 'Ultimate: one round (~3.5x) that punches through everything in its path.' },
  // Ninja: shurikens. Out of the shadows: crits build.
  { ...Z, id: 'shadow_stars', cls: 'ninja', mode: 'ranged', name: 'Shadow Stars', icon: '✴️', art: 'snapshot', build: 10, hits: 2, dmgMul: 0.6, desc: 'Two shurikens flung at once, out of the shadows.' },
  { ...BF, id: 'shadow_clone', cls: 'ninja', mode: 'ranged', name: 'Shadow Clone', icon: '💨', art: 'brace', buff: { dodge: 0.3, haste: 40 }, desc: 'Shadow clones: +30% dodge and +40% attack speed for 9s.' },
  { ...C, id: 'smoke_bomb', cls: 'ninja', mode: 'ranged', name: 'Smoke Bomb', icon: '💣', art: 'whirl', kind: 'buff', ticks: 5, buff: { dodge: 0.6 }, desc: 'A cloud of smoke: dodge 60% of attacks for 3s.' },
  { ...B, id: 'thousand_blades', cls: 'ninja', mode: 'ranged', name: 'Thousand Blades', icon: '🌀', art: 'arrow_storm', hits: 7, dmgMul: 0.55, guaranteed: true, instant: true, desc: 'Ultimate: seven heavy shurikens in a storm of steel.' },
  // Wizard: staves. Every spell builds a little more.
  { ...Z, id: 'elemental_bolt', cls: 'wizard', mode: 'magic', name: 'Elemental Bolt', icon: '✨', art: 'arcane_surge', dmgMul: 1.4, guaranteed: true, desc: 'Your next spell surges: heavy, ~1.4x damage.' },
  { ...BF, id: 'arcane_power', cls: 'wizard', mode: 'magic', name: 'Arcane Power', icon: '🔮', art: 'brace', buff: { dmg: 0.4 }, desc: 'Arcane power floods in: +40% spell damage for 9s.' },
  { ...C, id: 'mana_shield', cls: 'wizard', mode: 'magic', name: 'Mana Shield', icon: '🔵', art: 'mana_burst', kind: 'buff', ticks: 10, buff: { reduce: 0.4 }, desc: 'A shimmering shield: take 40% less damage for 6s.' },
  { ...B, id: 'wizard_meteor', cls: 'wizard', mode: 'magic', name: 'Meteor', icon: '☄️', art: 'meteor', dmgMul: 3.2, guaranteed: true, instant: true, desc: 'Ultimate: call down a heavy meteor (~3.2x damage).' },
  // Sorcerer: wands. Curses and life-drain; kills feed the dark.
  { ...Z, id: 'hex', cls: 'sorcerer', mode: 'magic', name: 'Hex', icon: '🧿', art: 'arcane_surge', cd: 4, dmgMul: 1.2, stun: 1, desc: 'A curse (~1.2x) that leaves the foe reeling.' },
  { ...BF, id: 'dark_pact', cls: 'sorcerer', mode: 'magic', name: 'Dark Pact', icon: '👻', art: 'brace', buff: { haste: 60, lifesteal: 0.1 }, desc: 'A dark pact: +60% cast speed and heal 10% of the damage you deal for 9s.' },
  { ...C, id: 'soul_siphon', cls: 'sorcerer', mode: 'magic', name: 'Soul Siphon', icon: '🌀', art: 'mana_burst', cd: 15, kind: 'attack', instant: true, dmgMul: 1, lifesteal: 0.5, build: 8, desc: 'Drain the foe\'s soul (~1x), healing half of the damage.' },
  { ...B, id: 'chaos_storm', cls: 'sorcerer', mode: 'magic', name: 'Chaos Storm', icon: '🌩️', art: 'meteor', dmgMul: 3, guaranteed: true, instant: true, crit: true, desc: 'Ultimate: an instant critical storm (~3x, then x2 or x4).' },
];
ABILITIES.push(...CLASS_ABILITIES);

// Every ultimate (B) is the area skill: it also hits every monster within
// AOE_TILES of the target for the same damage (the Dancer's Grand Finale
// already lashes everything in reach).
export const AOE_TILES = 3;
for (const a of ABILITIES) {
  if (a.key === 'B' && a.kind === 'attack' && !a.sweep) { a.aoe = AOE_TILES; a.desc += ` Hits every monster within ${AOE_TILES} tiles of the target too.`; }
}

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

const SLOT_ORDER = ['Z', 'X', 'C', 'V', 'B'];
/** The five abilities on the bar, in hotkey order: your class's own where it
 *  has one for that key, else the style's general one (players without a
 *  class, and the Dancer, use the general set). */
export function abilitiesFor(mode, cls = null) {
  return SLOT_ORDER.map((k) => (cls && ABILITIES.find((a) => a.key === k && a.cls === cls && a.mode === mode))
    || ABILITIES.find((a) => a.key === k && !a.cls && (!a.mode || a.mode === mode))).filter(Boolean);
}
