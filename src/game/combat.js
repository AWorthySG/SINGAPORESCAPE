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

/** Melee max hit. */
export function maxHit(strLevel, styleBonus, strEquipBonus) {
  const eff = strLevel + styleBonus + 8;
  return Math.floor(0.5 + (eff * (strEquipBonus + 64)) / 640);
}

/** Roll one attack. Returns damage dealt (0 on a miss). */
export function rollAttack(atkRoll, defRoll, max) {
  if (Math.random() < hitChance(atkRoll, defRoll)) {
    return randInt(0, max);
  }
  return 0;
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
