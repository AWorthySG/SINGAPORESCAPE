// Life skill perks: every level in a life skill makes your fighter a little
// stronger, so time spent mining or fishing still counts in a fight. Each life
// skill feeds one offensive stat, merged with your gear's bonuses (see
// Game.lifePerks and Equipment.extra), so the Equipment panel shows the totals.
//
// Tuning: a perk grows in a straight line from nothing at level 1 to its
// level-200 value at LIFE_PERK_FULL_LEVEL (200, the highest life-skill content:
// the Qilin trail, the Immortal elixir), so level 99 gives about half. The
// level-200 values sit below what a top weapon gives (a level 170-300 weapon
// has +13-25% attack speed and 150-600 power) so life skills add to gear
// rather than replace it. Offensive stats have no caps, so they simply add to
// gear; crit chance joins gear crit inside critChance, which stops at 100%.

import { LIFE_MAX_LEVEL, towardTop } from '../data/xp.js';

export const LIFE_PERK_FULL_LEVEL = 200;
// Life skills go far past 200, so a perk keeps growing after it, at half the
// pace: another LIFE_PERK_OVER of its value by LIFE_PERK_MAX_LEVEL, the end of
// the half-pace stretch (the owner asked to relook at the perks: levels past
// 200 added nothing)...
export const LIFE_PERK_MAX_LEVEL = 1000;
export const LIFE_PERK_OVER = 0.5;
// ...then slowly on, in a straight line, another LIFE_PERK_TOP_OVER of it by
// level 9999, twice its level-200 value (the owner asked for life-skill bonuses
// all the way to 9999), and on at the same pace to LIFE_PERK_TOP_LEVEL (30,000,
// the life skills' top level), where it is at its full strength, about 3.1
// times its level-200 value.
export const LIFE_PERK_TOP_LEVEL = LIFE_MAX_LEVEL;
export const LIFE_PERK_TOP_OVER = 0.5;

// skill -> { stat, max (the value at LIFE_PERK_FULL_LEVEL), label, unit }.
// stat 'dmgPct' is damage for every style: Physical and Magic damage bonus
// +max% (see lifePerkTotals).
// Retuned (Nov 2026, the owner's ask) so each is worth about the same: at
// level 200 most add some 12-16% to a top fighter's damage against a boss
// (statworth.js). Smithing's armour pierce is worth more against armoured bosses
// and was left as it was. Fishing was +60 flat power, which faded to almost
// nothing next to endgame weapons (600+): it is a percentage now.
export const LIFE_PERKS = {
  mining: { stat: 'critDmg', max: 60, label: 'crit damage', unit: '%' },
  smithing: { stat: 'pierce', max: 15, label: 'armour pierce', unit: '%' },
  crafting: { stat: 'crit', max: 15, label: 'crit chance', unit: '%' },
  fishing: { stat: 'dmgPct', max: 10, label: 'damage (every style)', unit: '%' },
  cooking: { stat: 'mobDmg', max: 20, label: 'damage vs normal monsters', unit: '%' },
  firemaking: { stat: 'magPct', max: 15, label: 'Magic bonus', unit: '%' },
  woodcutting: { stat: 'atkPct', max: 15, label: 'Physical damage bonus (melee and ranged)', unit: '%' },
  fletching: { stat: 'haste', max: 15, label: 'attack speed', unit: '%' },
  herblore: { stat: 'lifesteal', max: 8, label: 'lifesteal', unit: '%' },
  hunter: { stat: 'bossDmg', max: 20, label: 'boss and champion damage', unit: '%' },
  farming: { stat: 'aoe', max: 30, label: 'area damage', unit: '%' },
  thieving: { stat: 'extra', max: 12, label: 'chance of an extra strike', unit: '%' },
  // Diving shares Fishing's stat (the sea's own perk): the two add up.
  diving: { stat: 'dmgPct', max: 10, label: 'damage (every style)', unit: '%' },
  // Shares Cooking's stat (it adds to it): a sturdy home and a steady hand.
  construction: { stat: 'mobDmg', max: 15, label: 'damage vs normal monsters', unit: '%' },
};
export const LIFE_PERK_SKILLS = Object.keys(LIFE_PERKS);
// Life skill level-ups mention the perk on every multiple of this (of 50 past
// level 200, and of LIFE_PERK_TOP_NOTE_EVERY past 1000, where it grows slowly).
export const LIFE_PERK_NOTE_EVERY = 10;
export const LIFE_PERK_TOP_NOTE_EVERY = 500;

/** A life skill's perk value at `level`: 0 at level 1, its `max` at
 *  LIFE_PERK_FULL_LEVEL, then half as fast to (1 + LIFE_PERK_OVER) x at
 *  LIFE_PERK_MAX_LEVEL, then slowly to (1 + LIFE_PERK_OVER + LIFE_PERK_TOP_OVER) x
 *  at level 9999 and on at that pace to LIFE_PERK_TOP_LEVEL (towardTop). Percentages
 *  keep a decimal (a unit-less perk would be whole points). */
export function lifePerkValue(skill, level) {
  const p = LIFE_PERKS[skill];
  if (!p) return 0;
  const L = level || 1;
  const t = Math.max(0, Math.min(1, (L - 1) / (LIFE_PERK_FULL_LEVEL - 1)));
  const over = Math.max(0, Math.min(1, (L - LIFE_PERK_FULL_LEVEL) / (LIFE_PERK_MAX_LEVEL - LIFE_PERK_FULL_LEVEL)));
  const v = p.max * (t + LIFE_PERK_OVER * over + LIFE_PERK_TOP_OVER * towardTop(L, LIFE_PERK_MAX_LEVEL));
  return p.unit ? Math.round(v * 10) / 10 : Math.floor(v);
}

/** Every life perk at once, as gear-style bonuses: { critDmg, pierce, crit,
 *  strength, ranged, dance, magicStr, mobDmg, magPct, atkPct, haste, lifesteal,
 *  bossDmg, aoe, extra }. `levelOf(skill)` gives a skill's level. */
export function lifePerkTotals(levelOf) {
  const t = {};
  for (const s of LIFE_PERK_SKILLS) {
    const v = lifePerkValue(s, levelOf(s));
    if (LIFE_PERKS[s].stat === 'dmgPct') {
      t.atkPct = (t.atkPct || 0) + v; t.magPct = (t.magPct || 0) + v;
    } else t[LIFE_PERKS[s].stat] = (t[LIFE_PERKS[s].stat] || 0) + v;
  }
  return t;
}

/** "+12.3% crit damage" for a skill at a level. */
export function lifePerkText(skill, level) {
  const p = LIFE_PERKS[skill];
  return p ? `+${lifePerkValue(skill, level)}${p.unit} ${p.label}` : '';
}

/** The next milestone above `level` (a multiple of LIFE_PERK_NOTE_EVERY, of
 *  LIFE_PERK_TOP_NOTE_EVERY from level 1000, or LIFE_PERK_TOP_LEVEL itself), and
 *  the perk there, or null at full strength. */
export function lifePerkNext(skill, level) {
  if (!LIFE_PERKS[skill] || level >= LIFE_PERK_TOP_LEVEL) return null;
  const step = level < LIFE_PERK_MAX_LEVEL ? LIFE_PERK_NOTE_EVERY : LIFE_PERK_TOP_NOTE_EVERY;
  const at = Math.min(LIFE_PERK_TOP_LEVEL, (Math.floor(level / step) + 1) * step);
  return { level: at, text: lifePerkText(skill, at) };
}

/** Whether reaching `level` in a life skill is worth a chat note about its
 *  perk: every LIFE_PERK_NOTE_EVERY levels to 200, every 50 to 1000, every
 *  LIFE_PERK_TOP_NOTE_EVERY after (where it grows slowly) and at LIFE_PERK_TOP_LEVEL itself. */
export const lifePerkNoteAt = (level) => level <= LIFE_PERK_TOP_LEVEL && (level === LIFE_PERK_TOP_LEVEL
  || level % (level > LIFE_PERK_MAX_LEVEL ? LIFE_PERK_TOP_NOTE_EVERY : level > LIFE_PERK_FULL_LEVEL ? 50 : LIFE_PERK_NOTE_EVERY) === 0);
