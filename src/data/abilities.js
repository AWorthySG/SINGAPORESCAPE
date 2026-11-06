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
  { id: 'flurry', name: 'Flurry', key: 'X', icon: '🌀', cost: 35, cd: 6, kind: 'attack', mode: 'melee',
    unlock: 1, hits: 3, dmgMul: 0.65, desc: 'Strike three rapid times in a single turn.' },
  // ---- Ranged (bows) ----
  { id: 'snapshot', name: 'Snapshot', key: 'Z', icon: '🏹', cost: 30, cd: 5, kind: 'attack', mode: 'ranged',
    unlock: 1, hits: 3, dmgMul: 0.8, instant: true, desc: 'Loose three arrows instantly at your target.' },
  { id: 'piercing_shot', name: 'Piercing Shot', key: 'X', icon: '🎯', cost: 35, cd: 6, kind: 'attack', mode: 'ranged',
    unlock: 1, dmgMul: 1.8, guaranteed: true, desc: 'A guaranteed, armour-piercing arrow (~1.8x damage).' },
  // ---- Magic (staves) ----
  { id: 'arcane_surge', name: 'Arcane Surge', key: 'Z', icon: '✨', cost: 25, cd: 4, kind: 'attack', mode: 'magic',
    unlock: 1, dmgMul: 1.9, guaranteed: true, desc: 'Your next spell surges: guaranteed, ~1.9x damage.' },
  { id: 'mana_burst', name: 'Mana Burst', key: 'X', icon: '🔮', cost: 35, cd: 6, kind: 'attack', mode: 'magic',
    unlock: 1, dmgMul: 2.4, instant: true, desc: 'Instantly unleash a burst of raw magic (~2.4x damage).' },
  // ---- Dance (whips) ----
  { id: 'whirl', name: 'Whirl', key: 'Z', icon: '🌪️', cost: 30, cd: 5, kind: 'attack', mode: 'dance',
    unlock: 1, dmgMul: 1.2, sweep: true, desc: 'Spin and lash every monster within reach of your whip.' },
  { id: 'crack', name: 'Crack', key: 'X', icon: '💫', cost: 35, cd: 6, kind: 'attack', mode: 'dance',
    unlock: 1, dmgMul: 1.7, guaranteed: true, stun: 2, desc: 'A guaranteed crack (~1.7x damage) that stuns the target.' },
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
    unlock: 45, hits: 5, dmgMul: 0.8, guaranteed: true, sweep: true,
    desc: 'Ultimate: a five-beat dance that lashes everything in reach.' },
];

// ---- Class abilities ----
// Each job class has its own three attacks (Z, X and the B ultimate), built
// from its weapon's character; Brace (C) and Second Wind (V) stay shared.
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
const X = { key: 'X', cost: 35, cd: 6, kind: 'attack', unlock: 1 };
const B = { key: 'B', cost: 100, cd: 16, kind: 'attack', unlock: 45 };
const CLASS_ABILITIES = [
  // Rogue: daggers
  { ...Z, id: 'backstab', cls: 'rogue', mode: 'melee', name: 'Backstab', icon: '🗡️', art: 'power_strike', crit: true, guaranteed: true, desc: 'Slip behind them: a guaranteed critical hit (x2 or x4).' },
  { ...X, id: 'twin_fangs', cls: 'rogue', mode: 'melee', name: 'Twin Fangs', icon: '🐍', art: 'flurry', hits: 4, dmgMul: 0.55, lifesteal: 0.2, desc: 'Four quick stabs that drink back a fifth of the damage.' },
  { ...B, id: 'assassinate', cls: 'rogue', mode: 'melee', name: 'Assassinate', icon: '☠️', art: 'onslaught', hits: 3, dmgMul: 0.9, guaranteed: true, crit: true, desc: 'Ultimate: three guaranteed critical stabs.' },
  // Swordsman: swords
  { ...Z, id: 'riposte', cls: 'swordsman', mode: 'melee', name: 'Riposte', icon: '⚔️', art: 'power_strike', dmgMul: 1.8, guaranteed: true, guard: 3, desc: 'A guaranteed counter (~1.8x) that leaves you braced for 3 ticks.' },
  { ...X, id: 'blade_dance', cls: 'swordsman', mode: 'melee', name: 'Blade Dance', icon: '🌀', art: 'flurry', hits: 3, dmgMul: 0.7, cleave: 1.6, desc: 'Three sweeping cuts with a wider cleave.' },
  { ...B, id: 'heroic_strike', cls: 'swordsman', mode: 'melee', name: 'Heroic Strike', icon: '🦸', art: 'onslaught', dmgMul: 3, guaranteed: true, cleave: 2, desc: 'Ultimate: a guaranteed hero\'s blow (~3x) that cleaves twice as wide.' },
  // Corsair: dual scimitars
  { ...Z, id: 'cutlass_flurry', cls: 'corsair', mode: 'melee', name: 'Cutlass Flurry', icon: '🏴‍☠️', art: 'flurry', hits: 4, dmgMul: 0.5, desc: 'Four lightning slashes from both blades.' },
  { ...X, id: 'plunder', cls: 'corsair', mode: 'melee', name: 'Plunder', icon: '💰', art: 'power_strike', dmgMul: 1.6, guaranteed: true, lifesteal: 0.3, desc: 'A guaranteed raid (~1.6x) that steals back 30% as life.' },
  { ...B, id: 'broadside', cls: 'corsair', mode: 'melee', name: 'Broadside', icon: '💣', art: 'onslaught', hits: 6, dmgMul: 0.6, guaranteed: true, desc: 'Ultimate: six guaranteed slashes, a full broadside.' },
  // Paladin: maces
  { ...Z, id: 'smite', cls: 'paladin', mode: 'melee', name: 'Smite', icon: '✝️', art: 'power_strike', dmgMul: 1.8, guaranteed: true, lifesteal: 0.25, desc: 'A guaranteed holy blow (~1.8x) that heals a quarter of the damage.' },
  { ...X, id: 'judgement', cls: 'paladin', mode: 'melee', name: 'Judgement', icon: '⚖️', art: 'brace', dmgMul: 1.5, stun: 2, desc: 'A crushing verdict (~1.5x) that stuns the foe.' },
  { ...B, id: 'divine_hammer', cls: 'paladin', mode: 'melee', name: 'Divine Hammer', icon: '🔨', art: 'onslaught', dmgMul: 3, guaranteed: true, lifesteal: 0.5, desc: 'Ultimate: a guaranteed heavenly strike (~3x) that heals half of it.' },
  // Knight: longswords
  { ...Z, id: 'lance_thrust', cls: 'knight', mode: 'melee', name: 'Lance Thrust', icon: '🛡️', art: 'piercing_shot', dmgMul: 1.9, guaranteed: true, pierce: 0.3, desc: 'A guaranteed thrust (~1.9x) through the gaps in their armour.' },
  { ...X, id: 'shield_bash', cls: 'knight', mode: 'melee', name: 'Shield Bash', icon: '🛡️', art: 'brace', dmgMul: 1.2, stun: 3, guard: 3, desc: 'Bash and brace: stuns the foe and halves damage for 3 ticks.' },
  { ...B, id: 'dragonbane', cls: 'knight', mode: 'melee', name: 'Dragonbane', icon: '🐉', art: 'onslaught', dmgMul: 3.4, guaranteed: true, pierce: 0.4, desc: 'Ultimate: a guaranteed knightly blow (~3.4x) that ignores much of their armour.' },
  // Berserker: battleaxes
  { ...Z, id: 'axe_cleave', cls: 'berserker', mode: 'melee', name: 'Great Cleave', icon: '🪓', art: 'power_strike', dmgMul: 1.5, cleave: 2, desc: 'A huge chop (~1.5x) that cleaves twice as hard into the pack.' },
  { ...X, id: 'bloodlust', cls: 'berserker', mode: 'melee', name: 'Bloodlust', icon: '🩸', art: 'flurry', hits: 3, dmgMul: 0.8, lifesteal: 0.2, desc: 'Three frenzied chops that drink back a fifth of the damage.' },
  { ...B, id: 'rampage', cls: 'berserker', mode: 'melee', name: 'Rampage', icon: '😡', art: 'onslaught', hits: 4, dmgMul: 0.9, guaranteed: true, cleave: 2, desc: 'Ultimate: four guaranteed chops, each cleaving twice as hard.' },
  // Juggernaut: warhammers
  { ...Z, id: 'earthshaker', cls: 'juggernaut', mode: 'melee', name: 'Earthshaker', icon: '🌋', art: 'power_strike', dmgMul: 1.6, stun: 2, cleave: 1.5, desc: 'Slam the ground (~1.6x): stuns the foe and cleaves wider.' },
  { ...X, id: 'crushing_blow', cls: 'juggernaut', mode: 'melee', name: 'Crushing Blow', icon: '🔨', art: 'piercing_shot', dmgMul: 2.2, guaranteed: true, pierce: 0.5, desc: 'A guaranteed armour-crushing blow (~2.2x).' },
  { ...B, id: 'cataclysm', cls: 'juggernaut', mode: 'melee', name: 'Cataclysm', icon: '💥', art: 'onslaught', dmgMul: 3.6, guaranteed: true, stun: 3, cleave: 2, desc: 'Ultimate: a guaranteed quake (~3.6x) that stuns and cleaves twice as hard.' },
  // Gladiator: two-handed swords
  { ...Z, id: 'arena_sweep', cls: 'gladiator', mode: 'melee', name: 'Arena Sweep', icon: '🏟️', art: 'flurry', dmgMul: 1.4, cleave: 2, desc: 'A wide sweep (~1.4x) that cleaves twice as hard.' },
  { ...X, id: 'execution', cls: 'gladiator', mode: 'melee', name: 'Execution', icon: '⚔️', art: 'power_strike', dmgMul: 1.2, guaranteed: true, crit: true, desc: 'A guaranteed critical finisher (~1.2x, then x2 or x4).' },
  { ...B, id: 'champions_wrath', cls: 'gladiator', mode: 'melee', name: 'Champion\'s Wrath', icon: '🏆', art: 'onslaught', hits: 3, dmgMul: 1.2, guaranteed: true, cleave: 2, desc: 'Ultimate: three guaranteed great-sword blows, cleaving twice as hard.' },
  // Lancer: spears
  { ...Z, id: 'impale', cls: 'lancer', mode: 'melee', name: 'Impale', icon: '🔱', art: 'piercing_shot', dmgMul: 1.9, guaranteed: true, pierce: 0.4, desc: 'A guaranteed thrust (~1.9x) that pierces their armour.' },
  { ...X, id: 'vault_strike', cls: 'lancer', mode: 'melee', name: 'Vault Strike', icon: '🤸', art: 'snapshot', dmgMul: 1.6, instant: true, stun: 2, desc: 'Vault in at once (~1.6x) and knock the foe off balance.' },
  { ...B, id: 'phalanx', cls: 'lancer', mode: 'melee', name: 'Phalanx', icon: '🛡️', art: 'onslaught', hits: 4, dmgMul: 0.9, guaranteed: true, pierce: 0.3, desc: 'Ultimate: four guaranteed spear thrusts that pierce armour.' },
  // Brawler: claws
  { ...Z, id: 'rend', cls: 'brawler', mode: 'melee', name: 'Rend', icon: '🐾', art: 'flurry', hits: 3, dmgMul: 0.6, crit: true, desc: 'Three raking slashes, every one a critical hit.' },
  { ...X, id: 'pounce', cls: 'brawler', mode: 'melee', name: 'Pounce', icon: '🐯', art: 'snapshot', dmgMul: 1.6, instant: true, stun: 1, desc: 'Leap on them at once (~1.6x) and pin them for a moment.' },
  { ...B, id: 'feral_frenzy', cls: 'brawler', mode: 'melee', name: 'Feral Frenzy', icon: '😼', art: 'onslaught', hits: 8, dmgMul: 0.45, guaranteed: true, desc: 'Ultimate: eight guaranteed claw strikes in a blur.' },
  // Samurai: katanas
  { ...Z, id: 'iaijutsu', cls: 'samurai', mode: 'melee', name: 'Iaijutsu', icon: '🎌', art: 'power_strike', instant: true, guaranteed: true, crit: true, desc: 'Draw and cut in one motion: an instant guaranteed critical.' },
  { ...X, id: 'wind_slash', cls: 'samurai', mode: 'melee', name: 'Wind Slash', icon: '🍃', art: 'flurry', hits: 2, dmgMul: 0.9, cleave: 2, desc: 'Two slashes of wind that cleave twice as hard.' },
  { ...B, id: 'thousand_cuts', cls: 'samurai', mode: 'melee', name: 'Thousand Cuts', icon: '🌸', art: 'onslaught', hits: 6, dmgMul: 0.6, guaranteed: true, desc: 'Ultimate: six guaranteed katana cuts.' },
  // Halberdier: halberds
  { ...Z, id: 'reaping_arc', cls: 'halberdier', mode: 'melee', name: 'Reaping Arc', icon: '🌙', art: 'flurry', dmgMul: 1.4, cleave: 2, desc: 'A long reaping swing (~1.4x) that cleaves twice as hard.' },
  { ...X, id: 'hook_and_pull', cls: 'halberdier', mode: 'melee', name: 'Hook and Pull', icon: '🪝', art: 'brace', dmgMul: 1.3, stun: 3, desc: 'Hook the foe off their feet (~1.3x) and stun them.' },
  { ...B, id: 'iron_tempest', cls: 'halberdier', mode: 'melee', name: 'Iron Tempest', icon: '🌪️', art: 'onslaught', hits: 3, dmgMul: 1.1, guaranteed: true, cleave: 2, desc: 'Ultimate: three guaranteed sweeps, cleaving twice as hard.' },
  // Merchant: canes and A-Worthlings
  { ...Z, id: 'golden_cane', cls: 'merchant', mode: 'melee', name: 'Golden Cane', icon: '🪙', art: 'power_strike', dmgMul: 1.7, guaranteed: true, lifesteal: 0.2, desc: 'A guaranteed rap of the cane (~1.7x) that heals a fifth of it.' },
  { ...X, id: 'call_a_favour', cls: 'merchant', mode: 'melee', name: 'Call in a Favour', icon: '🤝', art: 'second_wind', dmgMul: 1.2, summon: 1, desc: 'Strike (~1.2x) and call up an A-Worthling to fight beside you.' },
  { ...B, id: 'hostile_takeover', cls: 'merchant', mode: 'melee', name: 'Hostile Takeover', icon: '📈', art: 'onslaught', dmgMul: 3, guaranteed: true, summon: 3, desc: 'Ultimate: a guaranteed blow (~3x) and three A-Worthlings join the fight.' },
  // Archer: shortbows
  { ...Z, id: 'quick_volley', cls: 'archer', mode: 'ranged', name: 'Quick Volley', icon: '🏹', art: 'snapshot', hits: 3, dmgMul: 0.8, instant: true, desc: 'Loose three arrows at once.' },
  { ...X, id: 'pinning_shot', cls: 'archer', mode: 'ranged', name: 'Pinning Shot', icon: '📌', art: 'piercing_shot', dmgMul: 1.5, guaranteed: true, stun: 2, desc: 'A guaranteed arrow (~1.5x) that pins the foe in place.' },
  { ...B, id: 'arrow_rain', cls: 'archer', mode: 'ranged', name: 'Arrow Rain', icon: '🌧️', art: 'arrow_storm', hits: 6, dmgMul: 0.75, guaranteed: true, instant: true, desc: 'Ultimate: six guaranteed arrows rain down at once.' },
  // Ranger: longbows
  { ...Z, id: 'aimed_shot', cls: 'ranger', mode: 'ranged', name: 'Aimed Shot', icon: '🎯', art: 'piercing_shot', guaranteed: true, crit: true, desc: 'Take your time: a guaranteed critical arrow.' },
  { ...X, id: 'armour_piercer', cls: 'ranger', mode: 'ranged', name: 'Armour Piercer', icon: '🏹', art: 'piercing_shot', dmgMul: 1.8, guaranteed: true, pierce: 0.5, desc: 'A guaranteed heavy arrow (~1.8x) that ignores half their armour.' },
  { ...B, id: 'deadeye', cls: 'ranger', mode: 'ranged', name: 'Deadeye', icon: '👁️', art: 'arrow_storm', dmgMul: 4, guaranteed: true, instant: true, desc: 'Ultimate: one perfect long-range shot (~4x), instantly.' },
  // Pistoler: dual pistols
  { ...Z, id: 'quickdraw', cls: 'pistoler', mode: 'ranged', name: 'Quickdraw', icon: '🔫', art: 'snapshot', hits: 3, dmgMul: 0.7, instant: true, desc: 'Fan the hammer: three instant shots.' },
  { ...X, id: 'headshot', cls: 'pistoler', mode: 'ranged', name: 'Headshot', icon: '🎯', art: 'piercing_shot', dmgMul: 1.2, guaranteed: true, crit: true, desc: 'A guaranteed critical shot (~1.2x, then x2 or x4).' },
  { ...B, id: 'bullet_hell', cls: 'pistoler', mode: 'ranged', name: 'Bullet Hell', icon: '💥', art: 'arrow_storm', hits: 8, dmgMul: 0.5, guaranteed: true, instant: true, desc: 'Ultimate: empty both pistols, eight guaranteed shots at once.' },
  // Ninja: shurikens
  { ...Z, id: 'shadow_stars', cls: 'ninja', mode: 'ranged', name: 'Shadow Stars', icon: '✴️', art: 'snapshot', hits: 3, dmgMul: 0.7, instant: true, desc: 'Three shurikens flung at once, out of the shadows.' },
  { ...X, id: 'smoke_bomb', cls: 'ninja', mode: 'ranged', name: 'Smoke Bomb', icon: '💨', art: 'brace', dmgMul: 1, stun: 3, guard: 3, desc: 'Blind the foe (stunned 3 ticks) and vanish into smoke (braced).' },
  { ...B, id: 'thousand_blades', cls: 'ninja', mode: 'ranged', name: 'Thousand Blades', icon: '🌀', art: 'arrow_storm', hits: 7, dmgMul: 0.55, guaranteed: true, instant: true, desc: 'Ultimate: seven guaranteed shurikens in a storm of steel.' },
  // Wizard: staves (the original magic set)
  { ...Z, id: 'elemental_bolt', cls: 'wizard', mode: 'magic', name: 'Elemental Bolt', icon: '✨', art: 'arcane_surge', dmgMul: 1.9, guaranteed: true, desc: 'Your next spell surges: guaranteed, ~1.9x damage.' },
  { ...X, id: 'frost_nova', cls: 'wizard', mode: 'magic', name: 'Frost Nova', icon: '❄️', art: 'mana_burst', dmgMul: 1.6, instant: true, stun: 3, desc: 'An instant freezing blast (~1.6x) that roots the foe.' },
  { ...B, id: 'wizard_meteor', cls: 'wizard', mode: 'magic', name: 'Meteor', icon: '☄️', art: 'meteor', dmgMul: 3.2, guaranteed: true, instant: true, desc: 'Ultimate: call down a guaranteed meteor (~3.2x damage).' },
  // Sorcerer: wands
  { ...Z, id: 'hex', cls: 'sorcerer', mode: 'magic', name: 'Hex', icon: '🧿', art: 'arcane_surge', dmgMul: 1.5, stun: 2, desc: 'A curse (~1.5x) that leaves the foe reeling.' },
  { ...X, id: 'soul_siphon', cls: 'sorcerer', mode: 'magic', name: 'Soul Siphon', icon: '👻', art: 'mana_burst', dmgMul: 1.8, instant: true, lifesteal: 0.4, desc: 'Instantly drain their soul (~1.8x), healing 40% of it.' },
  { ...B, id: 'chaos_storm', cls: 'sorcerer', mode: 'magic', name: 'Chaos Storm', icon: '🌩️', art: 'meteor', dmgMul: 3, guaranteed: true, instant: true, crit: true, desc: 'Ultimate: an instant guaranteed critical storm (~3x, then x2 or x4).' },
];
ABILITIES.push(...CLASS_ABILITIES);

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

const SLOT_ORDER = ['Z', 'X', 'C', 'V', 'B'];
/** The five abilities on the bar, in hotkey order: your class's own where it
 *  has one for that key, else the style's general one (players without a
 *  class, and the Dancer, use the general set). */
export function abilitiesFor(mode, cls = null) {
  return SLOT_ORDER.map((k) => (cls && ABILITIES.find((a) => a.key === k && a.cls === cls && a.mode === mode))
    || ABILITIES.find((a) => a.key === k && !a.cls && (!a.mode || a.mode === mode))).filter(Boolean);
}
