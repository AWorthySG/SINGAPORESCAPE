// Active combat abilities. Fuelled by Adrenaline (built by landing and taking
// hits), each ability has an adrenaline cost and a cooldown in game ticks.
//
// kind:
//   'attack' — armed like a special; the modifiers apply to your next hit
//              (dmgMul scales damage, hits>1 strikes repeatedly, guaranteed skips
//               the accuracy roll).
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
// the next swing.
export const ABILITIES = [
  // ---- Melee (swords, scimitars, maces, axes…) ----
  { id: 'power_strike', name: 'Power Strike', key: 'Z', icon: '💥', cost: 25, cd: 4, kind: 'attack', mode: 'melee',
    unlock: 1, dmgMul: 1.9, guaranteed: true, desc: 'A guaranteed, devastating blow (~1.9x damage).' },
  { id: 'battle_cry', name: 'Battle Cry', key: 'X', icon: '📣', cost: 30, cd: 14, kind: 'buff', mode: 'melee', art: 'brace',
    unlock: 1, ticks: 10, buff: { dmg: 0.3 }, desc: 'A rousing cry: +30% damage for 6s.' },
  // ---- Ranged (bows) ----
  { id: 'snapshot', name: 'Snapshot', key: 'Z', icon: '🏹', cost: 30, cd: 5, kind: 'attack', mode: 'ranged',
    unlock: 1, hits: 3, dmgMul: 0.8, instant: true, desc: 'Loose three arrows instantly at your target.' },
  { id: 'focus', name: 'Focus', key: 'X', icon: '🧘', cost: 30, cd: 14, kind: 'buff', mode: 'ranged', art: 'brace',
    unlock: 1, ticks: 10, buff: { haste: 50 }, desc: 'Steady breathing: +50% attack speed for 6s.' },
  // ---- Magic (staves) ----
  { id: 'arcane_surge', name: 'Arcane Surge', key: 'Z', icon: '✨', cost: 25, cd: 4, kind: 'attack', mode: 'magic',
    unlock: 1, dmgMul: 1.9, guaranteed: true, desc: 'Your next spell surges: guaranteed, ~1.9x damage.' },
  { id: 'mana_flow', name: 'Mana Flow', key: 'X', icon: '💠', cost: 30, cd: 14, kind: 'buff', mode: 'magic', art: 'mana_burst',
    unlock: 1, ticks: 10, buff: { dmg: 0.3 }, desc: 'Mana surges through you: +30% spell damage for 6s.' },
  // ---- Dance (whips) ----
  { id: 'crack', name: 'Chain Crack', key: 'Z', icon: '💫', cost: 35, cd: 6, kind: 'attack', mode: 'dance',
    unlock: 1, dmgMul: 1.8, guaranteed: true, stun: 2, chain: 6, desc: 'A guaranteed crack (~1.8x) that ricochets through up to 6 more monsters, stunning every one.' },
  { id: 'tempo', name: 'Tempo', key: 'X', icon: '🎶', cost: 30, cd: 14, kind: 'buff', mode: 'dance', art: 'whirl',
    unlock: 1, ticks: 10, buff: { haste: 60, dmg: 0.2 }, rhythm: 5, desc: 'Find the beat: full Rhythm, +60% attack speed and +20% damage for 6s.' },
  // ---- Shared ----
  { id: 'brace', name: 'Brace', key: 'C', icon: '🛡️', cost: 20, cd: 5, kind: 'guard',
    unlock: 1, guardTicks: 4, reduce: 0.5, desc: 'Halve incoming damage for 4 ticks — counter heavy blows.' },
  { id: 'second_wind', name: 'Second Wind', key: 'V', icon: '💚', cost: 60, cd: 12, kind: 'heal',
    unlock: 1, healFrac: 0.25, desc: 'Recover a quarter of your life in an instant.' },
  // ---- Ultimates ----
  { id: 'onslaught', name: 'Onslaught', key: 'B', icon: '⚡', cost: 100, cd: 16, kind: 'attack', mode: 'melee',
    unlock: 45, hits: 4, dmgMul: 0.85, guaranteed: true,
    desc: 'Ultimate: four guaranteed strikes that spend all your adrenaline.' },
  { id: 'arrow_storm', name: 'Arrow Storm', key: 'B', icon: '🌧️', cost: 100, cd: 16, kind: 'attack', mode: 'ranged',
    unlock: 45, hits: 5, dmgMul: 0.8, guaranteed: true, instant: true,
    desc: 'Ultimate: rain five guaranteed arrows down on your target at once.' },
  { id: 'meteor', name: 'Meteor', key: 'B', icon: '☄️', cost: 100, cd: 16, kind: 'attack', mode: 'magic',
    unlock: 45, dmgMul: 3.2, guaranteed: true, instant: true,
    desc: 'Ultimate: call down a guaranteed meteor (~3.2x damage).' },
  { id: 'grand_finale', name: 'Grand Finale', key: 'B', icon: '🎭', cost: 100, cd: 16, kind: 'attack', mode: 'dance',
    unlock: 45, hits: 5, dmgMul: 0.9, guaranteed: true, sweep: true, rhythm: 5,
    desc: 'Ultimate: a five-beat dance that lashes everything in reach and leaves you at full Rhythm.' },
];

// ---- Class abilities ----
// Each job class has its own three skills: a damage skill (Z), a buff (X) and an
// area attack (the B ultimate), built from its weapon's character; Brace (C)
// and Second Wind (V) stay shared.
// Extra effects on top of the ones above:
//   crit     the hit is always a critical (x2, or x4 on a mega crit)
//   pierce   share of the foe's defence ignored (more accurate)
//   lifesteal share of the damage dealt healed back
//   cleave   multiplies the weapon's cleave share for this hit (melee)
//   stun     ticks the foe reels and can't strike back
//   guard    ticks of halved incoming damage after the hit (like Brace)
//   summon   A-Worthlings called up (Merchant)
// `art` names the existing ability artwork the icon reuses.
const Z = { key: 'Z', cost: 25, cd: 4, kind: 'attack', unlock: 1 };
// X is each class's buff: a short boost (BUFF_TICKS, 6s) that applies at once.
const BF = { key: 'X', cost: 30, cd: 14, kind: 'buff', unlock: 1, ticks: 10 };
const B = { key: 'B', cost: 100, cd: 16, kind: 'attack', unlock: 45 };
const CLASS_ABILITIES = [
  // Rogue: daggers
  { ...Z, id: 'backstab', cls: 'rogue', mode: 'melee', name: 'Backstab', icon: '🗡️', art: 'power_strike', crit: true, guaranteed: true, desc: 'Slip behind them: a guaranteed critical hit (x2 or x4).' },
  { ...BF, id: 'shadow_step', cls: 'rogue', mode: 'melee', name: 'Shadow Step', icon: '🌑', art: 'brace', buff: { crit: 0.25, haste: 50 }, desc: 'Melt into the shadows: +25% crit chance and +50% attack speed for 6s.' },
  { ...B, id: 'assassinate', cls: 'rogue', mode: 'melee', name: 'Assassinate', icon: '☠️', art: 'onslaught', hits: 3, dmgMul: 0.9, guaranteed: true, crit: true, desc: 'Ultimate: three guaranteed critical stabs.' },
  // Swordsman: swords
  { ...Z, id: 'riposte', cls: 'swordsman', mode: 'melee', name: 'Riposte', icon: '⚔️', art: 'power_strike', dmgMul: 1.8, guaranteed: true, guard: 3, desc: 'A guaranteed counter (~1.8x) that leaves you braced for 3 ticks.' },
  { ...BF, id: 'battle_focus', cls: 'swordsman', mode: 'melee', name: 'Battle Focus', icon: '🎯', art: 'brace', buff: { dmg: 0.3, reduce: 0.2 }, desc: 'Steady your blade: +30% damage and 20% less damage taken for 6s.' },
  { ...B, id: 'heroic_strike', cls: 'swordsman', mode: 'melee', name: 'Heroic Strike', icon: '🦸', art: 'onslaught', dmgMul: 3, guaranteed: true, cleave: 2, desc: 'Ultimate: a guaranteed hero\'s blow (~3x) that cleaves twice as wide.' },
  // Corsair: dual scimitars
  { ...Z, id: 'cutlass_flurry', cls: 'corsair', mode: 'melee', name: 'Cutlass Flurry', icon: '🏴‍☠️', art: 'flurry', hits: 4, dmgMul: 0.5, desc: 'Four lightning slashes from both blades.' },
  { ...BF, id: 'sea_legs', cls: 'corsair', mode: 'melee', name: 'Sea Legs', icon: '🌊', art: 'brace', buff: { haste: 80, dodge: 0.1 }, desc: 'Roll with the waves: +80% attack speed and +10% dodge for 6s.' },
  { ...B, id: 'broadside', cls: 'corsair', mode: 'melee', name: 'Broadside', icon: '💣', art: 'onslaught', hits: 6, dmgMul: 0.6, guaranteed: true, desc: 'Ultimate: six guaranteed slashes, a full broadside.' },
  // Paladin: maces
  { ...Z, id: 'smite', cls: 'paladin', mode: 'melee', name: 'Smite', icon: '✝️', art: 'power_strike', dmgMul: 1.8, guaranteed: true, lifesteal: 0.25, desc: 'A guaranteed holy blow (~1.8x) that heals a quarter of the damage.' },
  { ...BF, id: 'holy_aura', cls: 'paladin', mode: 'melee', name: 'Holy Aura', icon: '😇', art: 'brace', buff: { lifesteal: 0.15, reduce: 0.3 }, desc: 'A holy glow: heal 15% of the damage you deal and take 30% less for 6s.' },
  { ...B, id: 'divine_hammer', cls: 'paladin', mode: 'melee', name: 'Divine Hammer', icon: '🔨', art: 'onslaught', dmgMul: 3, guaranteed: true, lifesteal: 0.5, desc: 'Ultimate: a guaranteed heavenly strike (~3x) that heals half of it.' },
  // Knight: longswords
  { ...Z, id: 'lance_thrust', cls: 'knight', mode: 'melee', name: 'Lance Thrust', icon: '🛡️', art: 'piercing_shot', dmgMul: 1.9, guaranteed: true, pierce: 0.3, desc: 'A guaranteed thrust (~1.9x) through the gaps in their armour.' },
  { ...BF, id: 'shield_wall', cls: 'knight', mode: 'melee', name: 'Shield Wall', icon: '🛡️', art: 'brace', buff: { reduce: 0.5, dmg: 0.1 }, desc: 'Raise your guard: take 50% less damage and deal 10% more for 6s.' },
  { ...B, id: 'dragonbane', cls: 'knight', mode: 'melee', name: 'Dragonbane', icon: '🐉', art: 'onslaught', dmgMul: 3.4, guaranteed: true, pierce: 0.4, desc: 'Ultimate: a guaranteed knightly blow (~3.4x) that ignores much of their armour.' },
  // Berserker: battleaxes
  { ...Z, id: 'axe_cleave', cls: 'berserker', mode: 'melee', name: 'Great Cleave', icon: '🪓', art: 'power_strike', dmgMul: 1.5, cleave: 2, desc: 'A huge chop (~1.5x) that cleaves twice as hard into the pack.' },
  { ...BF, id: 'berserk_rage', cls: 'berserker', mode: 'melee', name: 'Berserk Rage', icon: '😡', art: 'brace', buff: { dmg: 0.5, haste: 40 }, desc: 'Lose yourself in rage: +50% damage and +40% attack speed for 6s.' },
  { ...B, id: 'rampage', cls: 'berserker', mode: 'melee', name: 'Rampage', icon: '😡', art: 'onslaught', hits: 4, dmgMul: 0.9, guaranteed: true, cleave: 2, desc: 'Ultimate: four guaranteed chops, each cleaving twice as hard.' },
  // Juggernaut: warhammers
  { ...Z, id: 'earthshaker', cls: 'juggernaut', mode: 'melee', name: 'Earthshaker', icon: '🌋', art: 'power_strike', dmgMul: 1.6, stun: 2, cleave: 1.5, desc: 'Slam the ground (~1.6x): stuns the foe and cleaves wider.' },
  { ...BF, id: 'iron_skin', cls: 'juggernaut', mode: 'melee', name: 'Iron Skin', icon: '🪨', art: 'brace', buff: { reduce: 0.4, dmg: 0.2 }, desc: 'Skin like iron: take 40% less damage and deal 20% more for 6s.' },
  { ...B, id: 'cataclysm', cls: 'juggernaut', mode: 'melee', name: 'Cataclysm', icon: '💥', art: 'onslaught', dmgMul: 3.6, guaranteed: true, stun: 3, cleave: 2, desc: 'Ultimate: a guaranteed quake (~3.6x) that stuns and cleaves twice as hard.' },
  // Gladiator: two-handed swords
  { ...Z, id: 'arena_sweep', cls: 'gladiator', mode: 'melee', name: 'Arena Sweep', icon: '🏟️', art: 'flurry', dmgMul: 1.4, cleave: 2, desc: 'A wide sweep (~1.4x) that cleaves twice as hard.' },
  { ...BF, id: 'crowd_roar', cls: 'gladiator', mode: 'melee', name: 'Crowd\'s Roar', icon: '🏟️', art: 'brace', buff: { dmg: 0.35, crit: 0.15 }, desc: 'The crowd roars: +35% damage and +15% crit chance for 6s.' },
  { ...B, id: 'champions_wrath', cls: 'gladiator', mode: 'melee', name: 'Champion\'s Wrath', icon: '🏆', art: 'onslaught', hits: 3, dmgMul: 1.2, guaranteed: true, cleave: 2, desc: 'Ultimate: three guaranteed great-sword blows, cleaving twice as hard.' },
  // Lancer: spears
  { ...Z, id: 'impale', cls: 'lancer', mode: 'melee', name: 'Impale', icon: '🔱', art: 'piercing_shot', dmgMul: 1.9, guaranteed: true, pierce: 0.4, desc: 'A guaranteed thrust (~1.9x) that pierces their armour.' },
  { ...BF, id: 'phalanx_stance', cls: 'lancer', mode: 'melee', name: 'Phalanx Stance', icon: '🔱', art: 'brace', buff: { dmg: 0.25, reduce: 0.25 }, desc: 'Plant your spear: +25% damage and 25% less damage taken for 6s.' },
  { ...B, id: 'phalanx', cls: 'lancer', mode: 'melee', name: 'Phalanx', icon: '🛡️', art: 'onslaught', hits: 4, dmgMul: 0.9, guaranteed: true, pierce: 0.3, desc: 'Ultimate: four guaranteed spear thrusts that pierce armour.' },
  // Brawler: claws
  { ...Z, id: 'rend', cls: 'brawler', mode: 'melee', name: 'Rend', icon: '🐾', art: 'flurry', hits: 3, dmgMul: 0.6, crit: true, desc: 'Three raking slashes, every one a critical hit.' },
  { ...BF, id: 'adrenaline_rush', cls: 'brawler', mode: 'melee', name: 'Adrenaline Rush', icon: '💢', art: 'brace', buff: { haste: 100 }, desc: 'Fists of fury: attack twice as often for 6s.' },
  { ...B, id: 'feral_frenzy', cls: 'brawler', mode: 'melee', name: 'Feral Frenzy', icon: '😼', art: 'onslaught', hits: 8, dmgMul: 0.45, guaranteed: true, desc: 'Ultimate: eight guaranteed claw strikes in a blur.' },
  // Samurai: katanas
  { ...Z, id: 'iaijutsu', cls: 'samurai', mode: 'melee', name: 'Iaijutsu', icon: '🎌', art: 'power_strike', instant: true, guaranteed: true, crit: true, desc: 'Draw and cut in one motion: an instant guaranteed critical.' },
  { ...BF, id: 'bushido', cls: 'samurai', mode: 'melee', name: 'Bushido', icon: '🎌', art: 'brace', buff: { crit: 0.3, dmg: 0.2 }, desc: 'The warrior\'s way: +30% crit chance and +20% damage for 6s.' },
  { ...B, id: 'thousand_cuts', cls: 'samurai', mode: 'melee', name: 'Thousand Cuts', icon: '🌸', art: 'onslaught', hits: 6, dmgMul: 0.6, guaranteed: true, desc: 'Ultimate: six guaranteed katana cuts.' },
  // Halberdier: halberds
  { ...Z, id: 'reaping_arc', cls: 'halberdier', mode: 'melee', name: 'Reaping Arc', icon: '🌙', art: 'flurry', dmgMul: 1.4, cleave: 2, desc: 'A long reaping swing (~1.4x) that cleaves twice as hard.' },
  { ...BF, id: 'hold_the_line', cls: 'halberdier', mode: 'melee', name: 'Hold the Line', icon: '🚩', art: 'brace', buff: { reduce: 0.35, dmg: 0.2 }, desc: 'Stand firm: take 35% less damage and deal 20% more for 6s.' },
  { ...B, id: 'iron_tempest', cls: 'halberdier', mode: 'melee', name: 'Iron Tempest', icon: '🌪️', art: 'onslaught', hits: 3, dmgMul: 1.1, guaranteed: true, cleave: 2, desc: 'Ultimate: three guaranteed sweeps, cleaving twice as hard.' },
  // Merchant: canes and A-Worthlings
  { ...Z, id: 'golden_cane', cls: 'merchant', mode: 'melee', name: 'Golden Cane', icon: '🪙', art: 'power_strike', dmgMul: 1.7, guaranteed: true, lifesteal: 0.2, desc: 'A guaranteed rap of the cane (~1.7x) that heals a fifth of it.' },
  { ...BF, id: 'hire_bodyguards', cls: 'merchant', mode: 'melee', name: 'Hire Bodyguards', icon: '🤝', art: 'brace', summon: 2, buff: { dmg: 0.2 }, desc: 'Call in two A-Worthlings and +20% damage for 6s.' },
  { ...B, id: 'hostile_takeover', cls: 'merchant', mode: 'melee', name: 'Hostile Takeover', icon: '📈', art: 'onslaught', dmgMul: 3, guaranteed: true, summon: 3, desc: 'Ultimate: a guaranteed blow (~3x) and three A-Worthlings join the fight.' },
  // Archer: shortbows
  { ...Z, id: 'quick_volley', cls: 'archer', mode: 'ranged', name: 'Quick Volley', icon: '🏹', art: 'snapshot', hits: 3, dmgMul: 0.8, instant: true, desc: 'Loose three arrows at once.' },
  { ...BF, id: 'eagle_eye', cls: 'archer', mode: 'ranged', name: 'Eagle Eye', icon: '🦅', art: 'brace', buff: { haste: 60, crit: 0.1 }, desc: 'Sharp eyes: +60% attack speed and +10% crit chance for 6s.' },
  { ...B, id: 'arrow_rain', cls: 'archer', mode: 'ranged', name: 'Arrow Rain', icon: '🌧️', art: 'arrow_storm', hits: 6, dmgMul: 0.75, guaranteed: true, instant: true, desc: 'Ultimate: six guaranteed arrows rain down at once.' },
  // Ranger: longbows
  { ...Z, id: 'aimed_shot', cls: 'ranger', mode: 'ranged', name: 'Aimed Shot', icon: '🎯', art: 'piercing_shot', guaranteed: true, crit: true, desc: 'Take your time: a guaranteed critical arrow.' },
  { ...BF, id: 'steady_aim', cls: 'ranger', mode: 'ranged', name: 'Steady Aim', icon: '🎯', art: 'brace', buff: { dmg: 0.45 }, desc: 'Breathe and aim: +45% damage for 6s.' },
  { ...B, id: 'deadeye', cls: 'ranger', mode: 'ranged', name: 'Deadeye', icon: '👁️', art: 'arrow_storm', dmgMul: 4, guaranteed: true, instant: true, desc: 'Ultimate: one perfect long-range shot (~4x), instantly.' },
  // Pistoler: dual pistols
  { ...Z, id: 'quickdraw', cls: 'pistoler', mode: 'ranged', name: 'Quickdraw', icon: '🔫', art: 'snapshot', hits: 3, dmgMul: 0.7, instant: true, desc: 'Fan the hammer: three instant shots.' },
  { ...BF, id: 'fan_the_hammer', cls: 'pistoler', mode: 'ranged', name: 'Fan the Hammer', icon: '🔫', art: 'brace', buff: { haste: 100 }, desc: 'Fan the hammer: shoot twice as often for 6s.' },
  { ...B, id: 'bullet_hell', cls: 'pistoler', mode: 'ranged', name: 'Bullet Hell', icon: '💥', art: 'arrow_storm', hits: 8, dmgMul: 0.5, guaranteed: true, instant: true, desc: 'Ultimate: empty both pistols, eight guaranteed shots at once.' },
  // Ninja: shurikens
  { ...Z, id: 'shadow_stars', cls: 'ninja', mode: 'ranged', name: 'Shadow Stars', icon: '✴️', art: 'snapshot', hits: 3, dmgMul: 0.7, instant: true, desc: 'Three shurikens flung at once, out of the shadows.' },
  { ...BF, id: 'shadow_clone', cls: 'ninja', mode: 'ranged', name: 'Shadow Clone', icon: '💨', art: 'brace', buff: { dodge: 0.3, haste: 40 }, desc: 'Shadow clones: +30% dodge and +40% attack speed for 6s.' },
  { ...B, id: 'thousand_blades', cls: 'ninja', mode: 'ranged', name: 'Thousand Blades', icon: '🌀', art: 'arrow_storm', hits: 7, dmgMul: 0.55, guaranteed: true, instant: true, desc: 'Ultimate: seven guaranteed shurikens in a storm of steel.' },
  // Wizard: staves (the original magic set)
  { ...Z, id: 'elemental_bolt', cls: 'wizard', mode: 'magic', name: 'Elemental Bolt', icon: '✨', art: 'arcane_surge', dmgMul: 1.9, guaranteed: true, desc: 'Your next spell surges: guaranteed, ~1.9x damage.' },
  { ...BF, id: 'arcane_power', cls: 'wizard', mode: 'magic', name: 'Arcane Power', icon: '🔮', art: 'brace', buff: { dmg: 0.4 }, desc: 'Arcane power floods in: +40% spell damage for 6s.' },
  { ...B, id: 'wizard_meteor', cls: 'wizard', mode: 'magic', name: 'Meteor', icon: '☄️', art: 'meteor', dmgMul: 3.2, guaranteed: true, instant: true, desc: 'Ultimate: call down a guaranteed meteor (~3.2x damage).' },
  // Sorcerer: wands
  { ...Z, id: 'hex', cls: 'sorcerer', mode: 'magic', name: 'Hex', icon: '🧿', art: 'arcane_surge', dmgMul: 1.5, stun: 2, desc: 'A curse (~1.5x) that leaves the foe reeling.' },
  { ...BF, id: 'dark_pact', cls: 'sorcerer', mode: 'magic', name: 'Dark Pact', icon: '👻', art: 'brace', buff: { haste: 60, lifesteal: 0.1 }, desc: 'A dark pact: +60% cast speed and heal 10% of the damage you deal for 6s.' },
  { ...B, id: 'chaos_storm', cls: 'sorcerer', mode: 'magic', name: 'Chaos Storm', icon: '🌩️', art: 'meteor', dmgMul: 3, guaranteed: true, instant: true, crit: true, desc: 'Ultimate: an instant guaranteed critical storm (~3x, then x2 or x4).' },
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
