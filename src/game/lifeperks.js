// Life skill perks: every level in a life skill makes your fighter a little
// stronger, so time spent mining or fishing still counts in a fight. Each life
// skill feeds one offensive stat, merged with your gear's bonuses (see
// Game.lifePerks and Equipment.extra), so the Equipment panel shows the totals.
//
// Tuning: a perk grows in a straight line from nothing at level 1 to its full
// value at LIFE_PERK_FULL_LEVEL (200, the highest life-skill content: the
// Qilin trail, the Immortal elixir) and stops there, so level 99 gives about
// half. The full values sit below what a top weapon gives (a level 170-300
// weapon has +13-25% attack speed and 150-600 power) so life skills add to gear
// rather than replace it. Offensive stats have no caps, so they simply add to
// gear; crit chance joins gear crit inside critChance, which stops at 100%.

export const LIFE_PERK_FULL_LEVEL = 200;
// Life skills go far past 200, so a perk keeps growing after it, at half the
// pace: another LIFE_PERK_OVER of its value by LIFE_PERK_MAX_LEVEL, where it
// stops (the owner asked to relook at the perks: levels past 200 added nothing).
export const LIFE_PERK_MAX_LEVEL = 1000;
export const LIFE_PERK_OVER = 0.5;

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
};
export const LIFE_PERK_SKILLS = Object.keys(LIFE_PERKS);
// Life skill level-ups mention the perk on every multiple of this.
export const LIFE_PERK_NOTE_EVERY = 10;

/** A life skill's perk value at `level`: 0 at level 1, the full value at
 *  LIFE_PERK_FULL_LEVEL, then half as fast to (1 + LIFE_PERK_OVER) x at
 *  LIFE_PERK_MAX_LEVEL. Percentages keep a decimal (a unit-less perk would be whole points). */
export function lifePerkValue(skill, level) {
  const p = LIFE_PERKS[skill];
  if (!p) return 0;
  const L = level || 1;
  const t = Math.max(0, Math.min(1, (L - 1) / (LIFE_PERK_FULL_LEVEL - 1)));
  const over = Math.max(0, Math.min(1, (L - LIFE_PERK_FULL_LEVEL) / (LIFE_PERK_MAX_LEVEL - LIFE_PERK_FULL_LEVEL)));
  const v = p.max * (t + LIFE_PERK_OVER * over);
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

/** The next milestone (a multiple of LIFE_PERK_NOTE_EVERY) above `level`, and
 *  the perk there, or null once the perk stops growing. */
export function lifePerkNext(skill, level) {
  if (!LIFE_PERKS[skill] || level >= LIFE_PERK_MAX_LEVEL) return null;
  const at = Math.min(LIFE_PERK_MAX_LEVEL, (Math.floor(level / LIFE_PERK_NOTE_EVERY) + 1) * LIFE_PERK_NOTE_EVERY);
  return { level: at, text: lifePerkText(skill, at) };
}
