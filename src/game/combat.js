// Combat math, modelled on Old School RuneScape's accuracy / max-hit formulas
// (simplified: melee only, no prayer/potions). Pure functions.
import { randInt } from '../core/utils.js';
import { spellBaseHit, ELEMENTS } from '../data/magic.js';

// There are no combat stances to pick any more: every fighter uses one balanced
// stance (a little accuracy, power and defence), and every hit trains your
// fighting skill plus a share of Defence and Hitpoints, whatever the style.
// The style ids saved in older games are simply ignored.
export const STYLES = {
  balanced: { name: 'Balanced', skill: 'attack', atk: 2, str: 2, def: 2 },
};
const BAL = STYLES.balanced;
// Combat XP is a hybrid: a quarter of it trickles in with every point of
// damage you deal (DAMAGE_XP_SHARE), and the rest comes as a reward when a
// monster dies (killXp), worth its full life. So overkill and one-shots no
// longer waste XP, and splash damage can't farm more than the kills it makes.
export const DAMAGE_XP_SHARE = 0.25;
export const KILL_XP_SHARE = 1 - DAMAGE_XP_SHARE;
// XP per point of damage (or of a monster's life, for the kill reward), before
// the shares: the fighting skill (Magic earns three quarters, as spells also give
// XP per cast; at half it levelled about twice as slowly as Melee), plus Defence
// and Hitpoints.
const RATES = { skill: 4, magic: 3, defence: 1.33, hitpoints: 1.33 };
// The Dancer ('dance') fights with a whip that reaches like a short bow: its
// fighting-skill XP is split evenly between Agility and Ranged.
const spread = (skill, amount) => [
  ...(skill === 'dance'
    ? [{ skill: 'agility', xp: amount * RATES.skill / 2 }, { skill: 'ranged', xp: amount * RATES.skill / 2 }]
    : [{ skill, xp: amount * (skill === 'magic' ? RATES.magic : RATES.skill) }]),
  { skill: 'defence', xp: amount * RATES.defence },
  { skill: 'hitpoints', xp: amount * RATES.hitpoints },
];
/** XP for `damage` dealt in a fighting skill: the per-hit trickle. */
const fightXp = (skill, damage) => spread(skill, damage * DAMAGE_XP_SHARE);
/** Magic XP for spell damage (on top of the spell's own XP per cast). */
export function magicXp(damage) { return fightXp('magic', damage); }
/** The kill reward for a monster with `maxHp` life, in a fighting skill. */
export function killXp(skill, maxHp) { return spread(skill, Math.max(1, maxHp || 1) * KILL_XP_SHARE); }

export const STYLE_ORDER = ['balanced'];

/** Attack roll = (level + styleBonus + 8) * (equipmentAttackBonus + 64). */
export function attackRoll(level, styleBonus, equipBonus) {
  return (level + styleBonus + 8) * (equipBonus + 64);
}

/** Defence roll = (level + styleBonus + 8) * (equipmentDefenceBonus + 64). */
export function defenceRoll(level, styleBonus, equipBonus) {
  return (level + styleBonus + 8) * (equipBonus + 64);
}

/** Probability the attacker lands a non-zero hit. */
export function hitChance(atkRoll, defRoll) {
  if (atkRoll > defRoll) return 1 - (defRoll + 2) / (2 * (atkRoll + 1));
  return atkRoll / (2 * (defRoll + 1));
}

/** Melee/ranged max hit. Divisor tuned below OSRS (640) so the adventurer hits
 *  harder and combat feels punchy rather than grindy. */
export function maxHit(strLevel, styleBonus, strEquipBonus) {
  const eff = strLevel + styleBonus + 8;
  return Math.floor(1 + (eff * (strEquipBonus + 64)) / 360);
}

/** Roll one attack. Returns damage dealt (0 on a miss). Landed hits have a small
 *  damage floor (max/4) so connecting feels meaningful instead of frequent 0s. */
export function rollAttack(atkRoll, defRoll, max) {
  if (Math.random() < hitChance(atkRoll, defRoll)) {
    return randInt(Math.floor(max / 4), max);
  }
  return 0;
}

/** The player's attacks always land: a blow rolls between a quarter of the max
 *  hit and the max (never 0), so there is no miss for the player. Monsters still
 *  roll against your Defence with rollAttack. */
export function rollHit(max) {
  return randInt(Math.max(1, Math.floor(max / 4)), Math.max(1, max));
}

/** A guaranteed hit (e.g. the Power Strike ability): rolls high, at least half the max. */
export function rollGuaranteed(max) {
  return randInt(Math.max(1, Math.ceil(max / 2)), Math.max(1, max));
}

/** Damage multiplier applied on a critical hit. */
// A critical hit doubles the blow, and one crit in four (a mega crit) quadruples it.
export const CRIT_MULT = 2;
export const MEGA_CRIT_MULT = 4;
export const MEGA_CRIT_CHANCE = 0.25;

/** Critical-hit chance: scales with the attacking skill level, plus gear crit %.
 *  Level 99 alone gives ~15%; gear adds flat percent on top. It can reach 100%
 *  (every hit a crit). */
export function critChance(level, equipCrit = 0) {
  return Math.min(1, level * 0.0015 + (equipCrit || 0) / 100);
}

// ----- Combat weakness (rock-paper-scissors style triangle) -----
// Every monster is weakest to one combat style. Attacking with the matching
// style hits harder, so players are rewarded for switching
// between melee, ranged and magic instead of mashing one button.
const WEAKNESS_BY_SPRITE = {
  // Armoured / undead / magical -> Magic
  undead: 'magic', ghost: 'magic', golem: 'magic', drake: 'magic', reptile: 'magic',
  turtle: 'magic', crab: 'magic', slime: 'magic',
  // Flying / small / agile -> Ranged
  fowl: 'ranged', bat: 'ranged', insect: 'ranged', wisp: 'ranged', jellyfish: 'ranged',
  mantis: 'ranged', scorpion: 'ranged', seacreature: 'ranged',
  // Beasts / humanoids -> Melee
  beast: 'melee', humanoid: 'melee', greenman: 'melee', primate: 'melee', serpent: 'melee',
  spider: 'melee', hound: 'melee', rodent: 'melee', demon: 'melee', plant: 'melee',
};

export const WEAKNESS_BONUS = { dmg: 1.10 };

// Monster armour: a share of every hit it shrugs off, by kind of creature, from
// none (slimes, wisps, jellyfish) to armoured (golems, crabs, turtles). It rises
// a little for a monster above your fighting level and falls for one below,
// champions and bosses wear more, and hitting a monster's weakness gets past
// half of it. Gear's Armour pierce cancels armour first; whatever pierce is
// left over adds damage, as it did before armour existed.
export const ARMOUR_TIERS = { none: 0, light: 0.1, medium: 0.2, heavy: 0.3, armoured: 0.4 };
const ARMOUR_BY_SPRITE = {
  slime: 'none', wisp: 'none', jellyfish: 'none',
  fowl: 'light', bat: 'light', insect: 'light', rodent: 'light', plant: 'light', primate: 'light', hound: 'light', mantis: 'light', ghost: 'light',
  beast: 'medium', humanoid: 'medium', greenman: 'medium', spider: 'medium', serpent: 'medium', seacreature: 'medium', undead: 'medium', demon: 'medium',
  reptile: 'heavy', scorpion: 'heavy', drake: 'heavy',
  golem: 'armoured', crab: 'armoured', turtle: 'armoured',
};
export const ARMOUR_CAP = 0.6;
/** The armour tier name of a monster kind ('none' .. 'armoured'). */
export const armourTierOf = (def) => ARMOUR_BY_SPRITE[def?.sprite] || 'medium';
/** The share of a hit (0-ARMOUR_CAP) this monster's armour stops. */
export function armourOf(def, { champion = false, fightLevel = 0 } = {}) {
  let a = ARMOUR_TIERS[armourTierOf(def)];
  if (def?.boss) a += 0.1;
  if (champion || def?.champion) a += 0.1;
  if (fightLevel > 0) a += Math.max(-0.1, Math.min(0.15, ((def?.level || 1) / fightLevel - 1) * 0.15));
  return Math.max(0, Math.min(ARMOUR_CAP, a));
}
/** The damage multiplier after armour, weakness and Armour pierce (pierce in %). */
export function armourMult(armour, piercePct = 0, weak = false) {
  const a = weak ? armour / 2 : armour, p = (piercePct || 0) / 100;
  return (1 - Math.max(0, a - p)) * (1 + Math.max(0, p - a));
}

// Dual wielding: each hand strikes with its own weapon (see Equipment.bonuses
// with a hand), and the off-hand's blow lands at this share of what that weapon
// would hit for in the main hand, so a matched pair stays as strong as before.
export const OFFHAND_SHARE = 0.6;

// Every Melee, Ranged and Magic level adds this much to that style's max hit,
// as a flat bonus on top of everything else (shown in the Equipment panel).
export const LEVEL_FLAT_DMG = 0.5;
export const levelFlatDmg = (level) => Math.floor((level || 0) * LEVEL_FLAT_DMG);
// The flat level damage is sized for a FLAT_DMG_BEATS swing and scaled by the
// weapon's own swing time (before attack speed), so it adds the same damage per
// second whatever the weapon. Added whole to every hit, a pistol firing several
// shots a beat got it many times a second (63% of its hit at level 200) while a
// halberd got it once every two beats (13%).
export const FLAT_DMG_BEATS = 1;
// Longbow arrows and sniper rounds hit this many times as hard as the max hit
// below (applied in game.js). The flat level damage is divided back out of it,
// or a rifle got its flat damage 5.5 times over.
export const RANGED_TYPE_DMG = { longbow: 1.6, rifle: 5.5 };
/** The flat level damage's scale for the weapon in hand (`castMult`: a spell's
 *  share of the swing time; an element's own cast speed is left out, so Wind
 *  really does deal twice the damage per second). 1 for a test stub with no weapon speed. */
export function flatDmgScale(equip, castMult = 1) {
  const ws = equip?.weaponSpeed?.(), h = equip?.hasteMult?.();
  if (!(ws > 0) || !(h > 0)) return 1;
  // Dual wielders land an off-hand blow (OFFHAND_SHARE of its own hit) with each
  // swing, so both hands share the flat damage instead of each getting it whole.
  return (ws / h) * castMult / FLAT_DMG_BEATS / (equip.isDualWielding?.() ? 1 + OFFHAND_SHARE : 1)
    / (RANGED_TYPE_DMG[equip.weaponType?.()] || 1);
}
const scaledFlat = (level, equip, castMult) => Math.round(levelFlatDmg(level) * flatDmgScale(equip, castMult));

// Weapon balance. Weapons attack at very different speeds (pistols and wands
// ~16 times a second, greatswords twice, a rifle under once), and heavier hits
// never made up for slower swings: best-in-slot damage per second varied about
// 7x between classes. Each weapon type's hits are scaled so every class lands
// near the same single-target damage per second, slow weapons in bigger blows.
// Weapons that also hit a crowd (heavy cleavers, whips, spells, rifles) sit
// about 10% lower to pay for it. Measured with best-in-slot gear at levels 200
// and 1000 (see the class balance PR); applies to both hands and every skill.
// Retuned (class balance, Phase 3) once the flat level damage was scaled by swing
// time (see flatDmgScale): every class's single-target damage now sits at 85-115%
// of the median class at levels 50, 100, 200 and 300 (tools/balance/classes.mjs).
// The Merchant's cane is low because its allies deal about two thirds of its damage.
// Retuned again when Knights took up shields and bucklers gained a damage bonus and
// attack speed: the one-handed melee classes rose, so the longsword came down a little
// and the two-handed sword and rifle (no off-hand) went up to stay in the 85-115% band.
// Halberds, rifles, crossbows and claws later became two-handed too, losing their
// buckler or quiver, so the halberd, rifle and claws went up to stay in the band
// and the crossbow went up to stay at about 80-100% of the bows and rifle.
export const WEAPON_DMG_MULT = {
  dagger: 0.65, sword: 2.2, scimitar: 0.37, mace: 2.62, longsword: 2.13, battleaxe: 1.72, warhammer: 2.88,
  '2h_sword': 2.7, spear: 2.05, claws: 0.5, katana: 1.48, halberd: 3.2, cane: 0.71, shortbow: 0.54,
  longbow: 1.25, pistol: 0.38, rifle: 1.22, shuriken: 1.3, staff: 0.32, wand: 0.31, whip: 2.0,
  // Secondary types (first estimates, pending the combat rescale), tuned against measured
  // damage (a headless run of each class's best weapon at tiers 10-250, not a formula)
  // so that each sits a little under its classes' main types and the main type stays
  // the class's best weapon. The quick types swing about 1.4 times a beat and staves
  // already cast more than once a beat, so scaling by swing speed alone misled.
  // Kerambits are dual wielded (two strikes a swing), hence the low scale. Orbs cast
  // at a staff's pace (see items.js), so they scale just under a staff per cast; a
  // Sorcerer's quicker wands stay ahead of an orb below the dragon tier. The crossbow
  // needs no ammo and pierces, so it stays just under the bows. (Retuned with the
  // main types: each now lands at about 80-105% of its class's main weapon, the
  // chakram 60-105% as it serves three quite different classes.)
  parang: 1.75, kerambit: 0.27, toya: 2.35, crossbow: 3.25, chakram: 1.3, orb: 0.3, fan: 1.45,
};
/** The target's number scale (see hpScaleFor in npcs.js): hits on a big monster are divided by it. */
const numScale = (npc) => npc?.hpScale || 1;
/** The damage scale for the weapon in hand (1 when unarmed or for a test stub). */
export const weaponDmgMult = (equip) => WEAPON_DMG_MULT[equip?.weaponType?.()] || 1;
export const MELEE_BONUS = { dmg: 1.3 };
/** Share of the Attack level that also counts toward melee max hit. */
export const ATTACK_TO_STRENGTH = 0.2;

/** The combat style ('melee'|'ranged'|'magic') a monster is weakest to. */
export function weaknessOf(def) {
  if (!def) return 'melee';
  const w = WEAKNESS_BY_SPRITE[def.sprite];
  if (w) return w;
  return ['melee', 'ranged', 'magic'][(def.tierLevel || def.level || 1) % 3]; // stable fallback
}

// ----- Player vs NPC helpers -----

// Your fighting levels add bonuses on top of your gear, like an extra piece of
// equipment that grows with you: every 2 Melee levels give +1 Attack and +1
// Strength bonus, every 2 Ranged levels +1 Ranged, every 2 Magic levels +1 Magic
// (and every 10 a point of magic damage), every 2 Agility levels +1 Dance.
// The bonus stops growing at level LEVEL_BONUS_CAP: the level already scales the
// max hit once, and a bonus that kept growing with it too made damage climb with
// the square of the level (a level 5000 fighter one-shot monsters of its level).
// Past the cap, damage grows in a straight line with level, like monster HP does.
export const LEVEL_BONUS_CAP = 200;
export function levelBonuses(skills = {}) {
  const lv = (n) => Math.min(LEVEL_BONUS_CAP, n || 0);
  const half = (n) => Math.floor(lv(n) / 2);
  return {
    attack: half(skills.attack), strength: half(skills.attack),
    ranged: half(skills.ranged),
    magic: half(skills.magic), magicStr: Math.floor(lv(skills.magic) / 10),
    dance: half(skills.dance ?? skills.agility),
  };
}
function withLevelBonus(b, skills) {
  const lv = levelBonuses(skills);
  const out = { ...b };
  for (const k of Object.keys(lv)) out[k] = (out[k] || 0) + lv[k];
  return out;
}

/** `hand` ('main' / 'off'): one dual-wield hand's blow, from that hand's own weapon. */
export function playerAttackVsNpc(skills, equip, styleId, npc, hand = null) {
  const style = BAL;
  const gear = equip.bonuses(hand);
  const bonuses = withLevelBonus(gear, skills);
  // Player hits always land, so gear's melee Attack bonus (once accuracy) now
  // adds a quarter of itself to melee power.
  bonuses.strength += Math.floor((gear.attack || 0) / 4);
  // Melee trades reach for power: it has to close the distance, so it hits
  // harder than the formula's base (x1.3+1 max). (Player hits always land, so
  // there is no attack roll: only the max hit matters.)
  // Melee is one skill now (Strength mirrors it); the extra fifth keeps damage where
  // it was for a player who had trained Attack and Strength evenly.
  const mh = Math.round(maxHit(skills.strength + Math.floor(skills.attack * ATTACK_TO_STRENGTH), style.str, bonuses.strength) * MELEE_BONUS.dmg * weaponDmgMult(equip)) + 1
    + scaledFlat(skills.attack || 0, equip);   // the flat damage every Melee level adds
  return { max: Math.max(1, Math.round(mh / numScale(npc))) };
}

export function npcAttackVsPlayer(npc, skills, equip, styleId) {
  const style = BAL;
  const bonuses = equip.bonuses();
  const aRoll = attackRoll(npc.attack, 0, 0);
  const dRoll = defenceRoll(skills.defence, style.def, bonuses.defence);
  return { atkRoll: aRoll, defRoll: dRoll, max: npc.maxHit };
}

/** XP awards for `damage` dealt in melee: Melee, plus Defence and Hitpoints.
 *  (`styleId` is kept for older callers and ignored.) */
export function combatXp(styleId, damage) { return fightXp('attack', damage); }

// ----- Ranged -----
export const RANGED_STYLES = {
  balanced: { name: 'Balanced', atk: 2, speedMod: 0 },
};
export const RANGED_STYLE_ORDER = ['balanced'];
export const RANGED_BONUS = { dmg: 1.5 };

export function playerRangedVsNpc(skills, equip, styleId, npc, arrowStr, hand = null) {
  const b = withLevelBonus(equip.bonuses(hand), skills);
  // Arrows set the base; half the bow/armour Ranged bonus adds to damage too,
  // so a better bow hits harder.
  const str = arrowStr + Math.floor((b.ranged || 0) / 2);
  return {
    max: Math.max(1, Math.round((Math.round(maxHit(skills.ranged, 0, str) * RANGED_BONUS.dmg * weaponDmgMult(equip)) + 1
      + scaledFlat(skills.ranged, equip)) / numScale(npc))),   // plus the flat damage every Ranged level adds
  };
}

export function combatXpRanged(styleId, damage) { return fightXp('ranged', damage); }

// ----- Dance (whips) -----
// The Dancer fights with Agility: it drives damage, boosted by
// the `dance` gear bonus. Each landed lash builds Rhythm, which adds damage.
export const DANCE_STYLES = {
  balanced: { name: 'Balanced', atk: 2, str: 2, skill: 'agility', evade: 0.04 },
};
export const DANCE_STYLE_ORDER = ['balanced'];
export const DANCE_BONUS = { dmg: 1.3 };
export const RHYTHM_MAX = 5;          // Rhythm stacks
export const RHYTHM_DMG = 0.08;       // +8% damage per stack

export function playerDanceVsNpc(skills, equip, styleId, npc, rhythm = 0) {
  const st = DANCE_STYLES.balanced;
  const b = withLevelBonus(equip.bonuses(), skills);
  // The whip's power comes from Agility and Ranged together (see Skills.danceLevel).
  const lvl = skills.dance ?? skills.agility;
  return {
    max: Math.max(1, Math.round((Math.round(maxHit(lvl, st.str, b.dance) * DANCE_BONUS.dmg * weaponDmgMult(equip) * (1 + Math.min(RHYTHM_MAX, rhythm) * RHYTHM_DMG)) + 1) / numScale(npc))),
  };
}

/** Chance (0-1) a Dancer slips an incoming blow entirely. */
// The Dancer's dodge chance: rises quickly to 40% by Agility 160 (as before),
// then keeps creeping up towards 50% instead of stopping there.
export const DANCE_EVADE_MAX = 0.5;
export function danceEvade(agility, styleId) {
  const early = 0.08 + Math.min(agility, 160) / 500 + DANCE_STYLES.balanced.evade;
  const late = agility > 160 ? (DANCE_EVADE_MAX - 0.4) * (agility - 160) / (agility - 160 + 1000) : 0;
  return Math.min(DANCE_EVADE_MAX, Math.min(0.4, early) + late);
}

export function combatXpDance(styleId, damage) { return fightXp('dance', damage); }

// ----- Magic -----
export const MAGIC_LEVEL_DIV = 80;
// Spells reach their hit cap by about Magic 75, after which a mage's hit grew
// only with Magic level x gear, while Melee and Ranged hits grow with level x
// (gear + level bonus) up to LEVEL_BONUS_CAP: casters fell from ~120% of the
// median class at level 100 to ~80% at 200. So from Magic 100 up to the bonus
// cap, every 2 levels add a point to the spell's base as well.
export const magicLevelBase = (magic) => Math.floor(Math.max(0, Math.min(LEVEL_BONUS_CAP, magic || 0) - 100) / 2);
export function playerMagicVsNpc(skills, equip, spell, npc) {
  const gear = equip.bonuses();
  const b = withLevelBonus(gear, skills);
  // Gear's Magic bonus (once accuracy) adds a point of magic damage per 16.
  b.magicStr = (b.magicStr || 0) + Math.floor((gear.magic || 0) / 16);
  return {
    // Magic level multiplies the spell's power (with gear's magic damage), the way
    // Melee and Ranged levels multiply weapon power: +1.25% per level, so a
    // level 50 mage hits ~1.6x the spell's base and a level 99 mage ~2.2x.
    // The spell's base grows with Magic too (see spellBaseHit). (A dmgMult on an element would scale it.)
    max: Math.max(1, Math.round(((spellBaseHit(spell, skills.magic) + magicLevelBase(skills.magic) + (b.magicStr || 0)) * (1 + skills.magic / MAGIC_LEVEL_DIV)
      * (ELEMENTS[spell.element]?.dmgMult || 1) * weaponDmgMult(equip) + scaledFlat(skills.magic, equip, 0.5)) / numScale(npc))),   // plus the flat damage every Magic level adds
  };
}
