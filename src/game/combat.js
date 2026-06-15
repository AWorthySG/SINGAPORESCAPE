// Combat math, modelled on Old School RuneScape's accuracy / max-hit formulas
// (simplified: melee only, no prayer/potions). Pure functions.
import { randInt } from '../core/utils.js';

export const STYLES = {
  accurate:  { name: 'Accurate',  skill: 'attack',   atk: 3, str: 0, def: 0 },
  aggressive:{ name: 'Aggressive', skill: 'strength', atk: 0, str: 3, def: 0 },
  defensive: { name: 'Defensive',  skill: 'defence',  atk: 0, str: 0, def: 3 },
};

export const STYLE_ORDER = ['accurate', 'aggressive', 'defensive'];

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

/** The combat style ('melee'|'ranged'|'magic') a monster is weakest to. */
export function weaknessOf(def) {
  if (!def) return 'melee';
  const w = WEAKNESS_BY_SPRITE[def.sprite];
  if (w) return w;
  return ['melee', 'ranged', 'magic'][(def.level || 1) % 3]; // stable fallback
}

// ----- Player vs NPC helpers -----

export function playerAttackVsNpc(skills, equip, styleId, npc) {
  const style = STYLES[styleId] || STYLES.accurate;
  const bonuses = equip.bonuses();
  const aRoll = attackRoll(skills.attack, style.atk, bonuses.attack);
  const dRoll = defenceRoll(npc.defence, 0, 0);
  const mh = maxHit(skills.strength, style.str, bonuses.strength);
  return { atkRoll: aRoll, defRoll: dRoll, max: mh };
}

export function npcAttackVsPlayer(npc, skills, equip, styleId) {
  const style = STYLES[styleId] || STYLES.accurate;
  const bonuses = equip.bonuses();
  const aRoll = attackRoll(npc.attack, 0, 0);
  const dRoll = defenceRoll(skills.defence, style.def, bonuses.defence);
  return { atkRoll: aRoll, defRoll: dRoll, max: npc.maxHit };
}

/** XP awards for `damage` dealt under `styleId`: style skill + hitpoints. */
export function combatXp(styleId, damage) {
  const style = STYLES[styleId] || STYLES.accurate;
  return [
    { skill: style.skill, xp: damage * 4 },
    { skill: 'hitpoints', xp: damage * 1.33 },
  ];
}

// ----- Ranged -----
export const RANGED_STYLES = {
  accurate: { name: 'Accurate', atk: 3, speedMod: 0 },
  rapid: { name: 'Rapid', atk: 0, speedMod: -1 },
  longrange: { name: 'Longrange', atk: 0, speedMod: 0, longrange: true },
};
export const RANGED_STYLE_ORDER = ['accurate', 'rapid', 'longrange'];

export function playerRangedVsNpc(skills, equip, styleId, npc, arrowStr) {
  const st = RANGED_STYLES[styleId] || RANGED_STYLES.accurate;
  const b = equip.bonuses();
  return {
    atkRoll: attackRoll(skills.ranged, st.atk, b.ranged),
    defRoll: defenceRoll(npc.defence, 0, 0),
    max: maxHit(skills.ranged, 0, arrowStr),
  };
}

export function combatXpRanged(styleId, damage) {
  if (styleId === 'longrange') {
    return [{ skill: 'ranged', xp: damage * 2 }, { skill: 'defence', xp: damage * 2 }, { skill: 'hitpoints', xp: damage * 1.33 }];
  }
  return [{ skill: 'ranged', xp: damage * 4 }, { skill: 'hitpoints', xp: damage * 1.33 }];
}

// ----- Magic -----
export function playerMagicVsNpc(skills, equip, spell, npc) {
  const b = equip.bonuses();
  return {
    atkRoll: (skills.magic + 8) * (b.magic + 64),
    defRoll: (npc.defence + 8) * 64,
    max: spell.maxHit + (b.magicStr || 0),
  };
}
