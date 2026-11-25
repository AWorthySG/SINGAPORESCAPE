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
  monk: { hit: 2 }, priest: { hit: 2, hurt: 3 }, zealot: { hurt: 4, lowHp: 5 },
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
// Offensive riders (the skills rework): every skill now carries some damage.
//   strike  on a buff, guard or heal: a blow with these attack modifiers. A
//           threshold skill (X) lands it at once on the foe you're fighting; a
//           free skill (C) rides on your next hit instead (never a free extra attack).
//   bleed   the first blow that lands opens a wound that bleeds this share of
//           that blow every second for 4s (WOUNDS.bleed in game.js).
//   sunder  breaks the foe's armour: it takes `sunder` more damage from you for
//           SUNDER_TICKS ticks.
//   thorns  (in a buff) and counter (on a guard): that share of each blow struck
//           at you, before your guard softens it, is dealt straight back.
export const SUNDER_TICKS = 10;
// More fields for the classes that came later (Game.activateAbility and friends):
//   chi       a Monk's Chi gained when the skill is used (monk.js; 10 makes it overflow)
//   faith     that share of the Faith bar at once (a full bar fires the Faith Burst by itself)
//   bless     (in a buff) every blessing's bonus counts that share more: Strength, Magic,
//             crit, Protect... (Game.prayerMult, prayerCrit, protectFactor)
//   unholy    that much more damage against undead, spirits and demons
//   holyfire  a rider like bleed: the blow sets a holy fire burning that share of it
//             every second for 5s (WOUNDS.holyfire in game.js; it pays Magic XP)
//   healFrac  on a guard or a buff too: restores that share of your life when used
//   lifeCost  paid on top of the adrenaline: that share of your life as it is now (you
//             always keep 1), and never at or under LIFE_COST_FLOOR of your life (auto
//             battle included, since it only uses what you can pay for)
// The owner asked for the floor to be just 1% (it was 20%): a Zealot can spend
// itself almost to nothing, so Blood and the life-paid skills stay strong deep
// into a fight. Auto battle still never pays at or under it.
export const LIFE_COST_FLOOR = 0.01;
// The Ranger's skills are all damage buffs (see the Ranger's entries below):
// Focused Draw's and Steady Aim's +damage, Camouflage's armour pierce (in %)
// and Deadeye's +damage on top of sure crits. Tuned so a Ranger's damage over
// a fight stays about where its old strikes left it: +6-11% on classlab's
// dummies (where crits aren't yet capped), -5% in real boss fights with a
// typical build (tests/ranger-buffs.test.mjs, tools/balance/bossfight.mjs).
export const RANGER_BUFF = { draw: 0.05, aim: 0.3, pierce: 10, deadeye: 0.3 };
// Tiers: Z basic attack, X threshold skill, C basic utility, B ultimate.
// Cooldowns were cut by a quarter to a third in the skills rework (Z 3 -> 2,
// X 20 -> 15, C 25 -> 19, B 30 -> 24 ticks); the ultimate stays gated by a full bar.
const Z = { key: 'Z', cost: 0, build: 12, cd: 2, kind: 'attack', unlock: 1, tier: 'basic' };
const BF = { key: 'X', cost: THRESHOLD_COST, cd: 15, kind: 'buff', unlock: 1, ticks: 15, tier: 'threshold' };
const C = { key: 'C', cost: 0, cd: 19, unlock: 1, tier: 'basic' };
const B = { key: 'B', cost: ULTIMATE_COST, cd: 24, kind: 'attack', unlock: 45, tier: 'ultimate' };
export const ABILITIES = [
  // ---- Melee (swords, scimitars, maces, axes…) ----
  { ...Z, id: 'power_strike', name: 'Power Strike', icon: '💥', mode: 'melee', dmgMul: 1.5, guaranteed: true, desc: 'A heavy blow (~1.5x damage).' },
  { ...BF, id: 'battle_cry', name: 'Battle Cry', icon: '📣', mode: 'melee', buff: { dmg: 0.35 }, strike: { dmgMul: 1.5, guaranteed: true }, desc: 'A rousing cry and a heavy blow (~1.5x) at once: +35% damage for 9s.' },
  // ---- Ranged (bows) ----
  { ...Z, id: 'snapshot', name: 'Snapshot', icon: '🏹', mode: 'ranged', hits: 2, dmgMul: 0.75, desc: 'Your next shot looses two arrows at once (~0.75x each).' },
  { ...BF, id: 'focus', name: 'Focus', icon: '🧘', mode: 'ranged', buff: { haste: 60 }, strike: { dmgMul: 1.5, guaranteed: true }, desc: 'Steady breathing and a heavy shot (~1.5x) at once: +60% attack speed for 9s.' },
  // ---- Magic (staves) ----
  { ...Z, id: 'arcane_surge', name: 'Arcane Surge', icon: '✨', mode: 'magic', dmgMul: 1.5, guaranteed: true, desc: 'Your next spell surges: heavy, ~1.5x damage.' },
  { ...BF, id: 'mana_flow', name: 'Mana Flow', icon: '💠', mode: 'magic', buff: { dmg: 0.35 }, strike: { dmgMul: 1.5, guaranteed: true }, desc: 'Mana surges through you and out in a heavy blast (~1.5x) at once: +35% spell damage for 9s.' },
  // ---- Dance (whips) ----
  { ...Z, id: 'crack', name: 'Chain Crack', icon: '💫', mode: 'dance', cd: 3, dmgMul: 1.3, guaranteed: true, stun: 1, chain: 3, desc: 'A crack (~1.3x) that ricochets through up to 3 more monsters, stunning every one.' },
  { ...BF, id: 'tempo', name: 'Tempo', icon: '🎶', mode: 'dance', buff: { haste: 60, dmg: 0.2 }, rhythm: 5, strike: { dmgMul: 1.4, guaranteed: true }, desc: 'Find the beat with a heavy lash (~1.4x) at once: full Rhythm, +60% attack speed and +20% damage for 9s.' },
  // ---- Shared ----
  { ...C, id: 'brace', name: 'Brace', icon: '🛡️', cd: 6, kind: 'guard', guardTicks: 4, reduce: 0.5, counter: 0.3, desc: 'Halve incoming damage for 4 ticks and strike back 30% of every blow — counter heavy blows.' },
  { id: 'second_wind', name: 'Second Wind', key: 'V', icon: '💚', cost: 0, cd: 60, kind: 'heal', tier: 'basic',
    unlock: 1, healFrac: 0.25, desc: 'Recover a quarter of your life in an instant (36s cooldown).' },
  // ---- Ultimates ----
  { ...B, id: 'onslaught', name: 'Onslaught', icon: '⚡', mode: 'melee', hits: 4, dmgMul: 0.9, guaranteed: true, bleed: 0.1,
    desc: 'Ultimate: four heavy strikes (~0.9x each) that leave the foe bleeding and spend all your adrenaline.' },
  { ...B, id: 'arrow_storm', name: 'Arrow Storm', icon: '🌧️', mode: 'ranged', hits: 5, dmgMul: 0.85, guaranteed: true, instant: true,
    desc: 'Ultimate: rain five heavy arrows (~0.85x each) down on your target at once.' },
  { ...B, id: 'meteor', name: 'Meteor', icon: '☄️', mode: 'magic', dmgMul: 3.4, guaranteed: true, instant: true, stun: 2,
    desc: 'Ultimate: call down a heavy meteor (~3.4x damage) that leaves the foe reeling.' },
  { ...B, id: 'grand_finale', name: 'Grand Finale', icon: '🎭', mode: 'dance', hits: 5, dmgMul: 0.95, guaranteed: true, sweep: true, rhythm: 5,
    desc: 'Ultimate: a five-beat dance (~0.95x each) that lashes everything in reach and leaves you at full Rhythm.' },
];

// ---- Class abilities ----
// Each job class has its own four skills, built from its weapon's character:
// a basic attack that builds adrenaline (Z), a threshold buff that spends 50
// (X), a basic utility or defence move (C) and its ultimate (B, an area
// attack). Second Wind (V) stays shared.
// Extra effects on top of the ones above:
//   crit     the hit is always a critical (x2, or x4 on a mega crit)
//   lifesteal share of the damage dealt healed back
//   cleave   multiplies the weapon's cleave share for this hit (melee)
//   stun     ticks the foe reels and can't strike back
//   guard    ticks of halved incoming damage after the hit (like Brace)
//   summon   A-Worthlings called up (Merchant)
// and the offensive riders (strike, bleed, sunder, thorns, counter) above.
// Every ability has its own icon, assets/icons/ability-<id>.webp (an `art` field
// would borrow another ability's icon instead).
const CLASS_ABILITIES = [
  // Rogue: daggers. Builds adrenaline on crits; finishes off the wounded.
  { ...Z, id: 'backstab', cls: 'rogue', mode: 'melee', name: 'Backstab', icon: '🗡️', dmgMul: 1.3, execute: 1, desc: 'Stab at a weak spot (~1.3x), double damage on a foe under 35% life.' },
  { ...BF, id: 'shadow_step', cls: 'rogue', mode: 'melee', name: 'Shadow Step', icon: '🌑', buff: { crit: 0.3, haste: 50 }, strike: { dmgMul: 0.8, crit: true, execute: 1 }, desc: 'Step out of the shadows with a critical stab (~0.8x, doubled under 35% life), then +30% crit chance and +50% attack speed for 9s.' },
  { ...C, id: 'vanish', cls: 'rogue', mode: 'melee', name: 'Vanish', icon: '💨', kind: 'buff', ticks: 5, buff: { dodge: 0.6 }, strike: { dmgMul: 1.2, crit: true }, desc: 'Vanish from sight: dodge 60% of attacks for 3s, and your next stab is a critical (~1.2x).' },
  { ...B, id: 'assassinate', cls: 'rogue', mode: 'melee', name: 'Assassinate', icon: '☠️', hits: 3, dmgMul: 1.05, guaranteed: true, crit: true, execute: 1, bleed: 0.06, desc: 'Ultimate: three critical stabs (~1.05x each), doubled on a foe under 35% life, that leave it bleeding.' },
  // Swordsman: swords. The all-rounder: builds when struck, counters, parries.
  { ...Z, id: 'riposte', cls: 'swordsman', mode: 'melee', name: 'Riposte', icon: '⚔️', dmgMul: 1.4, guaranteed: true, guard: 2, desc: 'A counter-cut (~1.4x) that leaves you braced for 2 ticks.' },
  { ...BF, id: 'battle_focus', cls: 'swordsman', mode: 'melee', name: 'Battle Focus', icon: '🎯', buff: { dmg: 0.35, reduce: 0.2 }, strike: { dmgMul: 1.5, guaranteed: true }, desc: 'Steady your blade and cut (~1.5x) at once: +35% damage and 20% less damage taken for 9s.' },
  { ...C, id: 'parry', cls: 'swordsman', mode: 'melee', name: 'Parry', icon: '🤺', cd: 9, kind: 'guard', guardTicks: 4, build: 10, counter: 0.4, desc: 'Turn blows aside: halve damage for 4 ticks, cut back 40% of every blow and gain 10 adrenaline.' },
  { ...B, id: 'heroic_strike', cls: 'swordsman', mode: 'melee', name: 'Heroic Strike', icon: '🦸', dmgMul: 3.2, guaranteed: true, cleave: 2, desc: 'Ultimate: a heavy hero\'s blow (~3.2x) that cleaves twice as wide.' },
  // Corsair: dual scimitars. Many quick hits, each building a little.
  { ...Z, id: 'cutlass_flurry', cls: 'corsair', mode: 'melee', name: 'Cutlass Flurry', icon: '🏴‍☠️', build: 8, hits: 3, dmgMul: 0.6, desc: 'Three lightning slashes from both blades (~0.6x each).' },
  { ...BF, id: 'sea_legs', cls: 'corsair', mode: 'melee', name: 'Sea Legs', icon: '🌊', buff: { haste: 80, dodge: 0.15 }, strike: { hits: 2, dmgMul: 0.8, guaranteed: true }, desc: 'Roll in on the waves with a boarding slash (two ~0.8x cuts) at once: +80% attack speed and +15% dodge for 9s.' },
  { ...C, id: 'grog', cls: 'corsair', mode: 'melee', name: 'Swig of Grog', icon: '🍺', cd: 22, kind: 'heal', healFrac: 0.15, strike: { dmgMul: 1.4, guaranteed: true }, desc: 'A swig of grog: restore 15% of your life, and Dutch courage makes your next slash heavy (~1.4x).' },
  { ...B, id: 'broadside', cls: 'corsair', mode: 'melee', name: 'Broadside', icon: '💣', hits: 6, dmgMul: 0.65, guaranteed: true, stun: 1, desc: 'Ultimate: six heavy slashes (~0.65x each), a full broadside that leaves the foe reeling.' },
  // Paladin: maces. Holy sustain: builds when struck, heals as it smites.
  { ...Z, id: 'smite', cls: 'paladin', mode: 'melee', name: 'Smite', icon: '✝️', dmgMul: 1.4, guaranteed: true, lifesteal: 0.2, desc: 'A holy blow (~1.4x) that heals a fifth of the damage.' },
  { ...BF, id: 'holy_aura', cls: 'paladin', mode: 'melee', name: 'Holy Aura', icon: '😇', buff: { lifesteal: 0.15, reduce: 0.25, thorns: 0.3, dmg: 0.1 }, strike: { dmgMul: 1.5, guaranteed: true, lifesteal: 0.2 }, desc: 'A radiant smite (~1.5x) and a holy glow: +10% damage, heal 15% of the damage you deal, take 25% less and burn back 30% of every blow for 9s.' },
  { ...C, id: 'lay_on_hands', cls: 'paladin', mode: 'melee', name: 'Lay on Hands', icon: '🙌', cd: 30, kind: 'heal', healFrac: 0.3, strike: { dmgMul: 1.4, guaranteed: true }, desc: 'Heal yourself for 30% of your life; your next blow is blessed (~1.4x).' },
  { ...B, id: 'divine_hammer', cls: 'paladin', mode: 'melee', name: 'Divine Hammer', icon: '🔨', dmgMul: 3.2, guaranteed: true, lifesteal: 0.5, stun: 2, desc: 'Ultimate: a heavy heavenly strike (~3.2x) that stuns and heals half of it.' },
  // Knight: longswords. The wall: builds most when struck.
  { ...Z, id: 'lance_thrust', cls: 'knight', mode: 'melee', name: 'Lance Thrust', icon: '🛡️', dmgMul: 1.4, guaranteed: true, desc: 'A heavy thrust (~1.4x) through a gap in their guard.' },
  { ...BF, id: 'shield_wall', cls: 'knight', mode: 'melee', name: 'Shield Wall', icon: '🛡️', buff: { reduce: 0.4, dmg: 0.2, thorns: 0.4 }, strike: { dmgMul: 1.3, guaranteed: true, stun: 2 }, desc: 'Shield-bash (~1.3x, stuns) and raise your guard: take 40% less damage, deal 20% more and strike back 40% of every blow for 9s.' },
  { ...C, id: 'hold_fast', cls: 'knight', mode: 'melee', name: 'Hold Fast', icon: '🏰', cd: 11, kind: 'guard', guardTicks: 6, build: 5, counter: 0.3, desc: 'Plant your feet: halve damage for 6 ticks and strike back 30% of every blow.' },
  { ...B, id: 'dragonbane', cls: 'knight', mode: 'melee', name: 'Dragonbane', icon: '🐉', dmgMul: 3.5, guaranteed: true, sunder: 0.15, desc: 'Ultimate: a heavy knightly blow (~3.5x) fit to fell a dragon, cracking its armour (+15% damage taken for 6s).' },
  // Berserker: battleaxes. Rage: builds faster when hurt and on every kill.
  { ...Z, id: 'axe_cleave', cls: 'berserker', mode: 'melee', name: 'Great Cleave', icon: '🪓', dmgMul: 1.3, cleave: 2, bleed: 0.05, desc: 'A huge chop (~1.3x) that cleaves twice as hard into the pack and leaves the foe bleeding.' },
  { ...BF, id: 'berserk_rage', cls: 'berserker', mode: 'melee', name: 'Berserk Rage', icon: '😡', buff: { dmg: 0.45, haste: 40 }, strike: { hits: 2, dmgMul: 0.7, cleave: 2 }, desc: 'Lose yourself in rage with a frenzied double chop (~0.7x each, cleaving) at once: +45% damage and +40% attack speed for 9s.' },
  { ...C, id: 'blood_frenzy', cls: 'berserker', mode: 'melee', name: 'Blood Frenzy', icon: '🩸', kind: 'buff', ticks: 8, buff: { lifesteal: 0.25, dmg: 0.2 }, desc: 'Drink deep: heal 25% of the damage you deal and +20% damage for 5s.' },
  { ...B, id: 'rampage', cls: 'berserker', mode: 'melee', name: 'Rampage', icon: '😡', hits: 4, dmgMul: 0.95, guaranteed: true, cleave: 2, bleed: 0.06, desc: 'Ultimate: four heavy chops (~0.95x each), each cleaving twice as hard, that leave the foe bleeding.' },
  // Juggernaut: warhammers. Stuns and soaks: builds when struck.
  { ...Z, id: 'earthshaker', cls: 'juggernaut', mode: 'melee', name: 'Earthshaker', icon: '🌋', cd: 3, dmgMul: 1.3, stun: 1, cleave: 1.5, desc: 'Slam the ground (~1.3x): stuns the foe and cleaves wider.' },
  { ...BF, id: 'iron_skin', cls: 'juggernaut', mode: 'melee', name: 'Iron Skin', icon: '🪨', buff: { reduce: 0.35, dmg: 0.25, thorns: 0.35 }, strike: { dmgMul: 1.5, guaranteed: true, stun: 2, cleave: 1.5 }, desc: 'An iron-fisted slam (~1.5x, stuns, cleaves) and skin like iron: take 35% less damage, deal 25% more and strike back 35% of every blow for 9s.' },
  { ...C, id: 'unbreakable', cls: 'juggernaut', mode: 'melee', name: 'Unbreakable', icon: '🗿', cd: 11, kind: 'guard', guardTicks: 6, build: 5, counter: 0.3, desc: 'Nothing moves you: halve damage for 6 ticks and strike back 30% of every blow.' },
  { ...B, id: 'cataclysm', cls: 'juggernaut', mode: 'melee', name: 'Cataclysm', icon: '💥', dmgMul: 3.7, guaranteed: true, stun: 3, cleave: 2, desc: 'Ultimate: a heavy quake (~3.7x) that stuns and cleaves twice as hard.' },
  // Gladiator: two-handed swords. Plays to the crowd: every kill builds big.
  { ...Z, id: 'arena_sweep', cls: 'gladiator', mode: 'melee', name: 'Arena Sweep', icon: '🏟️', dmgMul: 1.25, cleave: 2, desc: 'A wide sweep (~1.25x) that cleaves twice as hard.' },
  { ...BF, id: 'crowd_roar', cls: 'gladiator', mode: 'melee', name: 'Crowd\'s Roar', icon: '🏟️', buff: { dmg: 0.35, crit: 0.15 }, strike: { dmgMul: 1.3, guaranteed: true, cleave: 2 }, desc: 'A showman\'s sweep (~1.3x, cleaving) and the crowd roars: +35% damage and +15% crit chance for 9s.' },
  { ...C, id: 'victory_rush', cls: 'gladiator', mode: 'melee', name: 'Victory Rush', icon: '🏅', cd: 22, kind: 'heal', healFrac: 0.2, build: 10, strike: { dmgMul: 1.4, guaranteed: true }, desc: 'Feed on the cheers: restore 20% of your life, gain 10 adrenaline and make your next blow heavy (~1.4x).' },
  { ...B, id: 'champions_wrath', cls: 'gladiator', mode: 'melee', name: 'Champion\'s Wrath', icon: '🏆', hits: 3, dmgMul: 1.25, guaranteed: true, cleave: 2, sunder: 0.05, desc: 'Ultimate: three heavy great-sword blows (~1.25x each), cleaving twice as hard and cracking armour (+5% damage taken for 6s).' },
  // Lancer: spears. Reach and a set spear against charges.
  { ...Z, id: 'impale', cls: 'lancer', mode: 'melee', name: 'Impale', icon: '🔱', dmgMul: 1.4, guaranteed: true, bleed: 0.03, desc: 'A heavy thrust (~1.4x) that skewers them and leaves them bleeding.' },
  { ...BF, id: 'phalanx_stance', cls: 'lancer', mode: 'melee', name: 'Phalanx Stance', icon: '🔱', buff: { dmg: 0.3, reduce: 0.25, thorns: 0.3 }, strike: { dmgMul: 1.4, guaranteed: true, stun: 1 }, desc: 'Drive your spear home (~1.4x, stuns) and plant it: +30% damage, 25% less damage taken and 30% of every blow struck back for 9s.' },
  { ...C, id: 'set_spear', cls: 'lancer', mode: 'melee', name: 'Set Spear', icon: '📍', cd: 8, kind: 'attack', dmgMul: 1, stun: 2, build: 8, desc: 'Brace your spear against the charge (~1x): the foe is stunned for 2 ticks.' },
  { ...B, id: 'phalanx', cls: 'lancer', mode: 'melee', name: 'Phalanx', icon: '🛡️', hits: 4, dmgMul: 0.95, guaranteed: true, sunder: 0.1, desc: 'Ultimate: four heavy spear thrusts (~0.95x each) in a wall of steel that cracks armour (+10% damage taken for 6s).' },
  // Brawler: claws. Crit-hungry and fast.
  { ...Z, id: 'rend', cls: 'brawler', mode: 'melee', name: 'Rend', icon: '🐾', build: 8, hits: 2, dmgMul: 0.6, crit: true, desc: 'Two raking slashes, each a critical hit.' },
  { ...BF, id: 'adrenaline_rush', cls: 'brawler', mode: 'melee', name: 'Adrenaline Rush', icon: '💢', cd: 16, buff: { haste: 100 }, strike: { hits: 2, dmgMul: 0.5 }, desc: 'Fists of fury: a quick one-two (~0.5x each) at once, then attack twice as often for 9s.' },
  { ...C, id: 'feral_instinct', cls: 'brawler', mode: 'melee', name: 'Feral Instinct', icon: '🐈', kind: 'buff', ticks: 8, buff: { dodge: 0.3, lifesteal: 0.1 }, strike: { dmgMul: 0.6, crit: true }, desc: 'Cat-quick: +30% dodge and heal 10% of the damage you deal for 5s, and your next swipe is a critical (~0.6x).' },
  { ...B, id: 'feral_frenzy', cls: 'brawler', mode: 'melee', name: 'Feral Frenzy', icon: '😼', hits: 8, dmgMul: 0.45, guaranteed: true, desc: 'Ultimate: eight heavy claw strikes (~0.45x each) in a blur.' },
  // Samurai: katanas. Precision: crits build, the draw-cut finishes.
  { ...Z, id: 'iaijutsu', cls: 'samurai', mode: 'melee', name: 'Iaijutsu', icon: '🎌', dmgMul: 0.75, crit: true, desc: 'Draw and cut in one motion: a critical (~0.75x, then x2 or x4).' },
  { ...BF, id: 'bushido', cls: 'samurai', mode: 'melee', name: 'Bushido', icon: '🎌', buff: { crit: 0.3, dmg: 0.2 }, strike: { dmgMul: 0.8, crit: true }, desc: 'The warrior\'s way: a critical drawing cut (~0.8x) at once, then +30% crit chance and +20% damage for 9s.' },
  { ...C, id: 'meditate', cls: 'samurai', mode: 'melee', name: 'Meditate', icon: '🧘', cd: 22, kind: 'heal', healFrac: 0.2, build: 15, strike: { dmgMul: 0.75, crit: true }, desc: 'A breath of stillness: restore 20% of your life, gain 15 adrenaline and make your next cut a critical (~0.75x).' },
  { ...B, id: 'thousand_cuts', cls: 'samurai', mode: 'melee', name: 'Thousand Cuts', icon: '🌸', hits: 6, dmgMul: 0.62, guaranteed: true, execute: 0.5, bleed: 0.06, desc: 'Ultimate: six heavy katana cuts (~0.62x each), +50% on a foe under 35% life, that leave it bleeding.' },
  // Halberdier: halberds. Holds the line against a crowd.
  { ...Z, id: 'reaping_arc', cls: 'halberdier', mode: 'melee', name: 'Reaping Arc', icon: '🌙', dmgMul: 1.3, cleave: 2, desc: 'A long reaping swing (~1.3x) that cleaves twice as hard.' },
  { ...BF, id: 'hold_the_line', cls: 'halberdier', mode: 'melee', name: 'Hold the Line', icon: '🚩', buff: { reduce: 0.3, dmg: 0.25, thorns: 0.3 }, strike: { dmgMul: 1.4, guaranteed: true, cleave: 2, stun: 1 }, desc: 'Sweep the front rank back (~1.4x, cleaving, stuns) and stand firm: take 30% less damage, deal 25% more and strike back 30% of every blow for 9s.' },
  { ...C, id: 'stand_firm', cls: 'halberdier', mode: 'melee', name: 'Stand Firm', icon: '⚓', cd: 11, kind: 'guard', guardTicks: 5, build: 5, counter: 0.3, desc: 'Brace the halberd: halve damage for 5 ticks and strike back 30% of every blow.' },
  { ...B, id: 'iron_tempest', cls: 'halberdier', mode: 'melee', name: 'Iron Tempest', icon: '🌪️', hits: 3, dmgMul: 1.15, guaranteed: true, cleave: 2, stun: 1, desc: 'Ultimate: three heavy sweeps (~1.15x each), cleaving twice as hard, that leave the foe reeling.' },
  // Monk: monk knuckles and gloves. Every blow builds Chi (monk.js); these stir it too.
  { ...Z, id: 'twin_fists', cls: 'monk', mode: 'melee', name: 'Twin Fists', icon: '👊', build: 10, hits: 2, dmgMul: 0.7, chi: 1, desc: 'A quick one-two (~0.7x each) that stirs your Chi.' },
  { ...BF, id: 'inner_focus', cls: 'monk', mode: 'melee', name: 'Inner Focus', icon: '🧘', chi: 10, buff: { haste: 50, dmg: 0.2 }, strike: { dmgMul: 1.5, guaranteed: true }, desc: 'Drive a palm home (~1.5x) and let your Chi overflow (a small heal) at once, then +50% attack speed and +20% damage for 9s.' },
  { ...C, id: 'deflecting_palms', cls: 'monk', mode: 'melee', name: 'Deflecting Palms', icon: '🖐️', cd: 9, kind: 'guard', guardTicks: 4, build: 8, counter: 0.4, chi: 2, desc: 'Turn blows aside with open palms: halve damage for 4 ticks, strike back 40% of every blow and gain 2 Chi.' },
  { ...B, id: 'hundred_fists', cls: 'monk', mode: 'melee', name: 'Hundred Fists', icon: '🤜', hits: 7, dmgMul: 0.52, guaranteed: true, stun: 2, chi: 10, desc: 'Ultimate: a blur of fists, seven heavy blows (~0.52x each) that leave the foe reeling, and your Chi overflows.' },
  // Merchant: canes and A-Worthlings. Pays for skills in coins, not adrenaline.
  { ...Z, id: 'golden_cane', cls: 'merchant', mode: 'ranged', name: 'Gold Rush', icon: '🪙', hits: 2, dmgMul: 0.75, lifesteal: 0.1, desc: 'Fling two fistfuls of gold at once (~0.75x each), healing a tenth of the damage.' },
  { ...BF, id: 'hire_bodyguards', cls: 'merchant', mode: 'ranged', name: 'Hire Bodyguards', icon: '🤝', summon: 2, buff: { dmg: 0.2 }, strike: { hits: 2, dmgMul: 0.8 }, desc: 'A signing bonus of coins in their face (two ~0.8x throws) at once, two A-Worthlings called in and +20% damage for 9s.' },
  { ...C, id: 'pay_off', cls: 'merchant', mode: 'ranged', name: 'Pay Them Off', icon: '💰', kind: 'buff', ticks: 8, buff: { reduce: 0.3, dodge: 0.1 }, strike: { dmgMul: 1, stun: 2 }, desc: 'Grease a few palms: take 30% less damage and +10% dodge for 5s, and your next throw (~1x) leaves the foe counting coins (stunned).' },
  { ...B, id: 'hostile_takeover', cls: 'merchant', mode: 'ranged', name: 'Hostile Takeover', icon: '📈', dmgMul: 3.3, guaranteed: true, instant: true, summon: 3, desc: 'Ultimate: a heavy shower of coins (~3.3x) and three A-Worthlings join the fight.' },
  // Archer: shortbows. Builds a little with every arrow.
  { ...Z, id: 'quick_volley', cls: 'archer', mode: 'ranged', name: 'Quick Volley', icon: '🏹', build: 10, hits: 2, dmgMul: 0.75, desc: 'Loose two arrows at once (~0.75x each).' },
  { ...BF, id: 'eagle_eye', cls: 'archer', mode: 'ranged', name: 'Eagle Eye', icon: '🦅', buff: { haste: 60, crit: 0.1 }, strike: { hits: 2, dmgMul: 0.8, guaranteed: true }, desc: 'Sharp eyes: a heavy pair of arrows (~0.8x each) at once, then +60% attack speed and +10% crit chance for 9s.' },
  { ...C, id: 'disengage', cls: 'archer', mode: 'ranged', name: 'Disengage', icon: '🍃', kind: 'buff', ticks: 6, buff: { dodge: 0.4, haste: 30 }, strike: { dmgMul: 1.3, guaranteed: true }, desc: 'Light on your feet: +40% dodge and +30% attack speed for 4s, and your next arrow lands heavy (~1.3x).' },
  { ...B, id: 'arrow_rain', cls: 'archer', mode: 'ranged', name: 'Arrow Rain', icon: '🌧️', hits: 6, dmgMul: 0.8, guaranteed: true, instant: true, desc: 'Ultimate: six heavy arrows (~0.8x each) rain down at once.' },
  // Ranger: longbows. Patient shots; crits build. Every Ranger skill is a timed
  // damage buff, not a strike (the owner's call): each runs alongside the others
  // (`stack`, see Game.activateAbility), so the Ranger keeps them all up and
  // lets the longbow do the hitting. Sized to deal about what the old strikes did.
  { ...Z, id: 'aimed_shot', cls: 'ranger', mode: 'ranged', name: 'Focused Draw', icon: '🎯', kind: 'buff', stack: true, ticks: 4, buff: { dmg: RANGER_BUFF.draw }, desc: `Draw slow and steady: +${Math.round(RANGER_BUFF.draw * 100)}% damage for 2.4s. Free, and builds adrenaline.` },
  { ...BF, id: 'steady_aim', cls: 'ranger', mode: 'ranged', name: 'Steady Aim', icon: '🎯', stack: true, buff: { dmg: RANGER_BUFF.aim }, desc: `Breathe and settle: +${Math.round(RANGER_BUFF.aim * 100)}% damage for 9s.` },
  { ...C, id: 'camouflage', cls: 'ranger', mode: 'ranged', name: 'Camouflage', icon: '🌿', kind: 'buff', stack: true, ticks: 10, buff: { dodge: 0.5, pierce: RANGER_BUFF.pierce }, desc: `Fade into the brush: dodge half of all attacks, and shots from cover find the gaps (+${RANGER_BUFF.pierce}% armour pierce), for 6s.` },
  { ...B, id: 'deadeye', cls: 'ranger', mode: 'ranged', name: 'Deadeye', icon: '👁️', kind: 'buff', stack: true, ticks: 8, buff: { dmg: RANGER_BUFF.deadeye, crit: 1 }, desc: `Ultimate: total focus. Every shot is a critical and deals +${Math.round(RANGER_BUFF.deadeye * 100)}% damage for 4.8s.` },
  // Pistoler: dual pistols. Bullets fly; every one builds.
  { ...Z, id: 'quickdraw', cls: 'pistoler', mode: 'ranged', name: 'Quickdraw', icon: '🔫', build: 10, hits: 2, dmgMul: 0.65, desc: 'Fan the hammer: your next shot is two (~0.65x each).' },
  { ...BF, id: 'fan_the_hammer', cls: 'pistoler', mode: 'ranged', name: 'Fan the Hammer', icon: '🔫', buff: { haste: 100 }, strike: { hits: 3, dmgMul: 0.5 }, desc: 'Fan the hammer: three quick shots (~0.5x each) at once, then shoot twice as often for 9s.' },
  { ...C, id: 'dive_roll', cls: 'pistoler', mode: 'ranged', name: 'Dive Roll', icon: '🤸', cd: 15, kind: 'buff', ticks: 4, buff: { dodge: 0.6 }, strike: { hits: 2, dmgMul: 0.65 }, desc: 'Hit the dirt: dodge 60% of attacks for 2s, and come up firing (your next shot is two, ~0.65x each).' },
  { ...B, id: 'bullet_hell', cls: 'pistoler', mode: 'ranged', name: 'Bullet Hell', icon: '💥', hits: 8, dmgMul: 0.52, guaranteed: true, instant: true, desc: 'Ultimate: empty both pistols, eight heavy shots (~0.52x each) at once.' },
  // Sniper: rifles. Slow, huge rounds: each one builds a lot.
  { ...Z, id: 'deadshot', cls: 'sniper', mode: 'ranged', name: 'Deadshot', icon: '🎯', build: 15, dmgMul: 1.3, guaranteed: true, desc: 'A heavy round (~1.3x) that lands with crushing force.' },
  { ...BF, id: 'hold_breath', cls: 'sniper', mode: 'ranged', name: 'Hold Your Breath', icon: '🫁', buff: { crit: 0.3, dmg: 0.3 }, strike: { dmgMul: 0.8, crit: true }, desc: 'Steady the scope: a critical round (~0.8x) at once, then +30% crit chance and +30% damage for 9s.' },
  { ...C, id: 'ghillie', cls: 'sniper', mode: 'ranged', name: 'Ghillie Suit', icon: '🌾', kind: 'buff', ticks: 8, buff: { dodge: 0.4, reduce: 0.2 }, strike: { dmgMul: 1.3, guaranteed: true }, desc: 'Go to ground: +40% dodge and 20% less damage taken for 5s, and your next round from hiding lands heavy (~1.3x).' },
  { ...B, id: 'collateral', cls: 'sniper', mode: 'ranged', name: 'Collateral', icon: '💥', dmgMul: 3.6, guaranteed: true, instant: true, desc: 'Ultimate: one round (~3.6x) that punches through everything in its path.' },
  // Ninja: shurikens. Out of the shadows: crits build.
  { ...Z, id: 'shadow_stars', cls: 'ninja', mode: 'ranged', name: 'Shadow Stars', icon: '✴️', build: 10, hits: 2, dmgMul: 0.7, bleed: 0.08, desc: 'Two shurikens flung at once (~0.7x each), out of the shadows; they leave the foe bleeding.' },
  { ...BF, id: 'shadow_clone', cls: 'ninja', mode: 'ranged', name: 'Shadow Clone', icon: '💨', buff: { dodge: 0.3, haste: 40 }, strike: { hits: 3, dmgMul: 0.6 }, desc: 'Shadow clones: they fling three shurikens (~0.6x each) at once, then +30% dodge and +40% attack speed for 9s.' },
  { ...C, id: 'smoke_bomb', cls: 'ninja', mode: 'ranged', name: 'Smoke Bomb', icon: '💣', kind: 'buff', ticks: 5, buff: { dodge: 0.6 }, strike: { dmgMul: 0.7, crit: true }, desc: 'A cloud of smoke: dodge 60% of attacks for 3s, and your next star from the smoke is a critical (~0.7x).' },
  { ...B, id: 'thousand_blades', cls: 'ninja', mode: 'ranged', name: 'Thousand Blades', icon: '🌀', hits: 7, dmgMul: 0.58, guaranteed: true, instant: true, desc: 'Ultimate: seven heavy shurikens (~0.58x each) in a storm of steel.' },
  // Wizard: staves. Every spell builds a little more.
  { ...Z, id: 'elemental_bolt', cls: 'wizard', mode: 'magic', name: 'Elemental Bolt', icon: '✨', dmgMul: 1.5, guaranteed: true, desc: 'Your next spell surges: heavy, ~1.5x damage.' },
  { ...BF, id: 'arcane_power', cls: 'wizard', mode: 'magic', name: 'Arcane Power', icon: '🔮', buff: { dmg: 0.4 }, strike: { dmgMul: 1.6, guaranteed: true }, desc: 'Arcane power floods in and out as a heavy missile (~1.6x) at once: +40% spell damage for 9s.' },
  { ...C, id: 'mana_shield', cls: 'wizard', mode: 'magic', name: 'Mana Shield', icon: '🔵', kind: 'buff', ticks: 10, buff: { reduce: 0.4, thorns: 0.3 }, desc: 'A crackling shield: take 40% less damage and shock back 30% of every blow for 6s.' },
  { ...B, id: 'wizard_meteor', cls: 'wizard', mode: 'magic', name: 'Meteor', icon: '☄️', dmgMul: 3.4, guaranteed: true, instant: true, stun: 2, desc: 'Ultimate: call down a heavy meteor (~3.4x damage) that leaves the foe reeling.' },
  // Sorcerer: wands. Curses and life-drain; kills feed the dark.
  { ...Z, id: 'hex', cls: 'sorcerer', mode: 'magic', name: 'Hex', icon: '🧿', cd: 3, dmgMul: 1.25, stun: 1, desc: 'A curse (~1.25x) that leaves the foe reeling.' },
  { ...BF, id: 'dark_pact', cls: 'sorcerer', mode: 'magic', name: 'Dark Pact', icon: '👻', buff: { haste: 60, lifesteal: 0.1 }, strike: { dmgMul: 1.5, guaranteed: true, lifesteal: 0.3 }, desc: 'A dark pact sealed with a soul bolt (~1.5x, heals 30% of it) at once: +60% cast speed and heal 10% of the damage you deal for 9s.' },
  { ...C, id: 'soul_siphon', cls: 'sorcerer', mode: 'magic', name: 'Soul Siphon', icon: '🌀', cd: 11, kind: 'attack', instant: true, dmgMul: 1.1, lifesteal: 0.5, build: 8, desc: 'Drain the foe\'s soul (~1.1x), healing half of the damage.' },
  { ...B, id: 'chaos_storm', cls: 'sorcerer', mode: 'magic', name: 'Chaos Storm', icon: '🌩️', dmgMul: 3.1, guaranteed: true, instant: true, crit: true, desc: 'Ultimate: an instant critical storm (~3.1x, then x2 or x4).' },
  // Priest: holy orbs. Every spell heals a little (priest.js); these heal more, shield and lift its blessings.
  { ...Z, id: 'holy_light', cls: 'priest', mode: 'magic', name: 'Holy Light', icon: '🌟', dmgMul: 1.4, guaranteed: true, lifesteal: 0.25, desc: 'A bolt of holy light (~1.4x) that heals you a quarter of its damage.' },
  { ...BF, id: 'uplift', cls: 'priest', mode: 'magic', name: 'Uplift', icon: '✨', faith: 0.25, buff: { bless: 0.5, dmg: 0.3 }, strike: { dmgMul: 1.5, guaranteed: true, lifesteal: 0.3 }, desc: 'A radiant blast (~1.5x, heals 30% of it) and a quarter of your Faith at once, then every blessing counts 50% more and spells deal +30% damage for 9s.' },
  { ...C, id: 'sanctuary', cls: 'priest', mode: 'magic', name: 'Sanctuary', icon: '🔆', cd: 11, kind: 'guard', guardTicks: 5, build: 5, counter: 0.2, healFrac: 0.12, desc: 'A dome of light: halve damage for 5 ticks, restore 12% of your life and burn back 20% of every blow.' },
  { ...B, id: 'judgement', cls: 'priest', mode: 'magic', name: 'Judgement', icon: '☀️', dmgMul: 3.2, guaranteed: true, instant: true, lifesteal: 0.4, unholy: 0.5, desc: 'Ultimate: a pillar of light (~3.2x, +50% on undead, spirits and demons) that heals you 40% of it.' },
  // Zealot: a burning censer. Holy fire on every spell (zealot.js); these burn hotter, and two are paid for in life.
  { ...Z, id: 'searing_swing', cls: 'zealot', mode: 'magic', name: 'Searing Swing', icon: '⛓️', dmgMul: 1.3, guaranteed: true, holyfire: 0.05, desc: 'Swing the censer hard (~1.3x): the blow sets a fierce holy fire burning (5% of it a second for 5s).' },
  { ...BF, id: 'burning_oath', cls: 'zealot', mode: 'magic', name: 'Burning Oath', icon: '❤️‍🔥', lifeCost: 0.15, buff: { dmg: 0.45, haste: 30 }, strike: { dmgMul: 1.6, guaranteed: true }, desc: 'Trade 15% of your life for a blazing swing (~1.6x) at once, then +45% spell damage and +30% cast speed for 9s.' },
  { ...C, id: 'rekindle', cls: 'zealot', mode: 'magic', name: 'Rekindle', icon: '🕯️', cd: 22, kind: 'heal', healFrac: 0.2, build: 10, strike: { dmgMul: 1.3, guaranteed: true, holyfire: 0.05 }, desc: 'Breathe in the censer\'s smoke: restore 20% of your life, gain 10 adrenaline, and your next swing sears (~1.3x, a fresh holy fire).' },
  { ...B, id: 'pillar_of_flame', cls: 'zealot', mode: 'magic', name: 'Pillar of Flame', icon: '🔥', lifeCost: 0.2, dmgMul: 3.8, guaranteed: true, instant: true, holyfire: 0.06, desc: 'Ultimate: trade a fifth of your life for a pillar of holy fire (~3.8x) that leaves the foe burning.' },
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
