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
// rather than replace it. They count on top of the gear caps (OFFENCE_CAPS),
// as set bonuses do, so a capped-out fighter still gains from training them:
// pierce can reach 55%, lifesteal 20%, boss damage 75%. Crit chance is the
// exception: it joins gear crit inside critChance's overall 50% cap.

export const LIFE_PERK_FULL_LEVEL = 200;

// skill -> { stat, max (the value at LIFE_PERK_FULL_LEVEL), label, unit }.
// stat 'power' is a flat bonus to every style: Melee power, Ranged and Dance
// bonus +max, and a point of magic damage per 10 (see lifePerkTotals).
export const LIFE_PERKS = {
  mining: { stat: 'critDmg', max: 40, label: 'crit damage', unit: '%' },
  smithing: { stat: 'pierce', max: 15, label: 'armour pierce', unit: '%' },
  crafting: { stat: 'crit', max: 10, label: 'crit chance', unit: '%' },
  fishing: { stat: 'power', max: 60, label: 'power (every style)', unit: '' },
  cooking: { stat: 'mobDmg', max: 15, label: 'damage vs normal monsters', unit: '%' },
  firemaking: { stat: 'magPct', max: 15, label: 'Magic bonus', unit: '%' },
  woodcutting: { stat: 'atkPct', max: 15, label: 'Attack bonus (melee and ranged)', unit: '%' },
  fletching: { stat: 'haste', max: 10, label: 'attack speed', unit: '%' },
  herblore: { stat: 'lifesteal', max: 5, label: 'lifesteal', unit: '%' },
  hunter: { stat: 'bossDmg', max: 15, label: 'boss and champion damage', unit: '%' },
  farming: { stat: 'aoe', max: 20, label: 'area damage', unit: '%' },
  thieving: { stat: 'extra', max: 10, label: 'chance of an extra strike', unit: '%' },
};
export const LIFE_PERK_SKILLS = Object.keys(LIFE_PERKS);
// Life skill level-ups mention the perk on every multiple of this.
export const LIFE_PERK_NOTE_EVERY = 10;

/** A life skill's perk value at `level`: 0 at level 1, the full value at
 *  LIFE_PERK_FULL_LEVEL. Flat power is whole points; percentages keep a decimal. */
export function lifePerkValue(skill, level) {
  const p = LIFE_PERKS[skill];
  if (!p) return 0;
  const t = Math.max(0, Math.min(1, ((level || 1) - 1) / (LIFE_PERK_FULL_LEVEL - 1)));
  const v = p.max * t;
  return p.unit ? Math.round(v * 10) / 10 : Math.floor(v);
}

/** Every life perk at once, as gear-style bonuses: { critDmg, pierce, crit,
 *  strength, ranged, dance, magicStr, mobDmg, magPct, atkPct, haste, lifesteal,
 *  bossDmg, aoe, extra }. `levelOf(skill)` gives a skill's level. */
export function lifePerkTotals(levelOf) {
  const t = {};
  for (const s of LIFE_PERK_SKILLS) {
    const v = lifePerkValue(s, levelOf(s));
    if (LIFE_PERKS[s].stat === 'power') {
      t.strength = (t.strength || 0) + v; t.ranged = (t.ranged || 0) + v; t.dance = (t.dance || 0) + v;
      t.magicStr = (t.magicStr || 0) + Math.floor(v / 10);
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
 *  the perk there, or null once the perk is full. */
export function lifePerkNext(skill, level) {
  if (!LIFE_PERKS[skill] || level >= LIFE_PERK_FULL_LEVEL) return null;
  const at = Math.min(LIFE_PERK_FULL_LEVEL, (Math.floor(level / LIFE_PERK_NOTE_EVERY) + 1) * LIFE_PERK_NOTE_EVERY);
  return { level: at, text: lifePerkText(skill, at) };
}
