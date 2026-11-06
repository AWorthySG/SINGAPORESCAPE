// Combat math, modelled on Old School RuneScape's accuracy / max-hit formulas
// (simplified: melee only, no prayer/potions). Pure functions.
import { randInt } from '../core/utils.js';

// There are no combat stances to pick any more: every fighter uses one balanced
// stance (a little accuracy, power and defence), and every hit trains your
// fighting skill plus a share of Defence and Hitpoints, whatever the style.
// The style ids saved in older games are simply ignored.
export const STYLES = {
  balanced: { name: 'Balanced', skill: 'attack', atk: 2, str: 2, def: 2 },
};
const BAL = STYLES.balanced;
/** XP for `damage` in a fighting skill: the skill, plus Defence and Hitpoints. */
const fightXp = (skill, damage) => [
  { skill, xp: damage * 4 },
  { skill: 'defence', xp: damage * 1.33 },
  { skill: 'hitpoints', xp: damage * 1.33 },
];

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

/** A guaranteed hit (e.g. the Power Strike ability) — never misses, hits high. */
export function rollGuaranteed(max) {
  return randInt(Math.max(1, Math.ceil(max / 2)), Math.max(1, max));
}

/** Damage multiplier applied on a critical hit. */
// A critical hit doubles the blow, and one crit in four (a mega crit) quadruples it.
export const CRIT_MULT = 2;
export const MEGA_CRIT_MULT = 4;
export const MEGA_CRIT_CHANCE = 0.25;

/** Critical-hit chance: scales with the attacking skill level, plus gear crit %.
 *  Level 99 alone gives ~15%; gear adds flat percent on top. Capped at 50%. */
export function critChance(level, equipCrit = 0) {
  return Math.min(0.5, level * 0.0015 + (equipCrit || 0) / 100);
}

// ----- Combat weakness (rock-paper-scissors style triangle) -----
// Every monster is weakest to one combat style. Attacking with the matching
// style is more accurate and hits harder, so players are rewarded for switching
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

export const WEAKNESS_BONUS = { acc: 1.15, dmg: 1.10 };
export const MELEE_BONUS = { acc: 1.2, dmg: 1.3 };
/** Share of the Attack level that also counts toward melee max hit. */
export const ATTACK_TO_STRENGTH = 0.2;

/** The combat style ('melee'|'ranged'|'magic') a monster is weakest to. */
export function weaknessOf(def) {
  if (!def) return 'melee';
  const w = WEAKNESS_BY_SPRITE[def.sprite];
  if (w) return w;
  return ['melee', 'ranged', 'magic'][(def.level || 1) % 3]; // stable fallback
}

// ----- Player vs NPC helpers -----

// Your fighting levels add bonuses on top of your gear, like an extra piece of
// equipment that grows with you: every 2 Melee levels give +1 Attack and +1
// Strength bonus, every 2 Ranged levels +1 Ranged, every 2 Magic levels +1 Magic
// (and every 10 a point of magic damage), every 2 Agility levels +1 Dance.
export function levelBonuses(skills = {}) {
  const half = (n) => Math.floor((n || 0) / 2);
  return {
    attack: half(skills.attack), strength: half(skills.attack),
    ranged: half(skills.ranged),
    magic: half(skills.magic), magicStr: Math.floor((skills.magic || 0) / 10),
    dance: half(skills.agility),
  };
}
function withLevelBonus(b, skills) {
  const lv = levelBonuses(skills);
  const out = { ...b };
  for (const k of Object.keys(lv)) out[k] = (out[k] || 0) + lv[k];
  return out;
}

export function playerAttackVsNpc(skills, equip, styleId, npc) {
  const style = BAL;
  const bonuses = withLevelBonus(equip.bonuses(), skills);
  // Melee trades reach for power: it has to close the distance, so it lands
  // more often and hits harder than the formula's base (x1.2 accuracy, x1.3+1 max).
  const aRoll = attackRoll(skills.attack, style.atk, bonuses.attack) * MELEE_BONUS.acc;
  const dRoll = defenceRoll(npc.defence, 0, 0);
  // Melee is one skill now (Strength mirrors it); the extra fifth keeps damage where
  // it was for a player who had trained Attack and Strength evenly.
  const mh = Math.round(maxHit(skills.strength + Math.floor(skills.attack * ATTACK_TO_STRENGTH), style.str, bonuses.strength) * MELEE_BONUS.dmg) + 1;
  return { atkRoll: aRoll, defRoll: dRoll, max: mh };
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
export const RANGED_BONUS = { acc: 1.15, dmg: 1.5 };

export function playerRangedVsNpc(skills, equip, styleId, npc, arrowStr) {
  const st = RANGED_STYLES.balanced;
  const b = withLevelBonus(equip.bonuses(), skills);
  // Arrows set the base; half the bow/armour Ranged bonus adds to damage too,
  // so a better bow hits harder, not just more often.
  const str = arrowStr + Math.floor((b.ranged || 0) / 2);
  return {
    atkRoll: attackRoll(skills.ranged, st.atk, b.ranged) * RANGED_BONUS.acc,
    defRoll: defenceRoll(npc.defence, 0, 0),
    max: Math.round(maxHit(skills.ranged, 0, str) * RANGED_BONUS.dmg) + 1,
  };
}

export function combatXpRanged(styleId, damage) { return fightXp('ranged', damage); }

// ----- Dance (whips) -----
// The Dancer fights with Agility: it drives both accuracy and damage, boosted by
// the `dance` gear bonus. Each landed lash builds Rhythm, which adds damage.
export const DANCE_STYLES = {
  balanced: { name: 'Balanced', atk: 2, str: 2, skill: 'agility', evade: 0.04 },
};
export const DANCE_STYLE_ORDER = ['balanced'];
export const DANCE_BONUS = { acc: 1.15, dmg: 1.3 };
export const RHYTHM_MAX = 5;          // Rhythm stacks
export const RHYTHM_DMG = 0.08;       // +8% damage per stack

export function playerDanceVsNpc(skills, equip, styleId, npc, rhythm = 0) {
  const st = DANCE_STYLES.balanced;
  const b = withLevelBonus(equip.bonuses(), skills);
  return {
    atkRoll: attackRoll(skills.agility, st.atk, b.dance) * DANCE_BONUS.acc,
    defRoll: defenceRoll(npc.defence, 0, 0),
    max: Math.round(maxHit(skills.agility, st.str, b.dance) * DANCE_BONUS.dmg * (1 + Math.min(RHYTHM_MAX, rhythm) * RHYTHM_DMG)) + 1,
  };
}

/** Chance (0-1) a Dancer slips an incoming blow entirely. */
export function danceEvade(agility, styleId) {
  return Math.min(0.4, 0.08 + agility / 500 + DANCE_STYLES.balanced.evade);
}

export function combatXpDance(styleId, damage) { return fightXp('agility', damage); }

// ----- Magic -----
export const MAGIC_LEVEL_DIV = 80;
export function playerMagicVsNpc(skills, equip, spell, npc) {
  const b = withLevelBonus(equip.bonuses(), skills);
  return {
    atkRoll: (skills.magic + 8) * (b.magic + 64),
    defRoll: (npc.defence + 8) * 64,
    // Magic level multiplies the spell's power (with gear's magic damage), the way
    // Melee and Ranged levels multiply weapon power: +1.25% per level, so a
    // level 50 mage hits ~1.6x the spell's base and a level 99 mage ~2.2x.
    max: Math.max(1, Math.round((spell.maxHit + (b.magicStr || 0)) * (1 + skills.magic / MAGIC_LEVEL_DIV))),
  };
}
