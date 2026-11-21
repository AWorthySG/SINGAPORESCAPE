// What one point of an offensive stat is worth to YOU, right now, in plain
// damage terms. The owner asked whether 1% Physical damage equals 1% Crit
// damage: it doesn't, because the stats work in different places in the
// damage formula, so each one's worth depends on what you already have:
//   - Physical (atkPct) / Magic (magPct) bonus multiplies every hit by (1 + x/100).
//   - Crit damage only counts on crits: a crit multiplies by 2 (or 4, one crit
//     in four), plus crit damage / 100, so on average a hit is worth
//     1 + c × (2.5 − 1 + critDmg/100), where c is your crit chance.
//   - Crit chance raises c in that same term.
//   - Attack speed shortens the time between attacks: damage per second
//     scales by (100 + haste) / 100.
//   - Armour pierce cancels a monster's armour first, then adds damage
//     (combat.js armourMult), so it is worth most until it matches the armour.
//   - Boss damage adds to the boss damage term (bosses and champions only).
// Everything is worked out from the real constants and functions (combat.js,
// statsheet.js), so it stays in lock-step with the combat code. It only reads
// the game; the UI asks for it on demand (a tooltip, the Stats tab), never per frame.
import { CRIT_MULT, MEGA_CRIT_MULT, MEGA_CRIT_CHANCE, ARMOUR_TIERS, armourMult, armourOf } from './combat.js';
import { ALL_BOSS_IDS, getNpc } from '../data/npcs.js';
import { critNow } from './statsheet.js';

/** A crit's average multiplier before crit damage: ×2, or ×4 one time in four (2.5). */
export const AVG_CRIT_MULT = (1 - MEGA_CRIT_CHANCE) * CRIT_MULT + MEGA_CRIT_CHANCE * MEGA_CRIT_MULT;

// The stats the worth box and tooltips speak about. `dmgPct` stands for
// whichever of atkPct / magPct your fighting style uses.
export const WORTH_KEYS = ['dmgPct', 'critDmg', 'crit', 'haste', 'pierce', 'bossDmg'];

/** Expected damage per second, relative (every factor these stats don't touch
 *  left out, as they cancel in a ratio). `s`: { dmgPct, crit (gear-style %
 *  points of crit chance on top of `critBase`, a fraction), critDmg, haste,
 *  pierce, armour (fraction), bossBase (1 + perk/potion/boss perks), bossDmg }. */
export function expectedDps(s) {
  const c = Math.max(0, Math.min(1, (s.critBase || 0) + (s.crit || 0) / 100));
  return (1 + (s.dmgPct || 0) / 100)
    * (1 + c * (AVG_CRIT_MULT - 1 + (s.critDmg || 0) / 100))
    * armourMult(s.armour || 0, s.pierce || 0)
    * (100 + (s.haste || 0)) / 100
    * ((s.bossBase ?? 1) + (s.bossDmg || 0) / 100);
}

/** The fractional damage gain from adding `n` of `key` to the state `s`
 *  (0.018 = +1.8% damage). Negative `n` takes it away. */
export function gainOf(s, key, n = 1) {
  const base = expectedDps(s);
  if (!(base > 0)) return 0;
  return expectedDps({ ...s, [key]: (s[key] || 0) + n }) / base - 1;
}

// A typical boss for your level: the median armour of the five bosses nearest
// your fighting level, as if each stood at your level (so a low-level player
// isn't judged against bosses far above them). Cached: the boss list never changes.
const refCache = new Map();
export function refBossArmour(fightLevel) {
  const fl = Math.max(1, Math.round(fightLevel || 1));
  if (refCache.has(fl)) return refCache.get(fl);
  const near = ALL_BOSS_IDS.map(getNpc).filter((d) => d?.boss)
    .sort((a, b) => Math.abs((a.level || 1) - fl) - Math.abs((b.level || 1) - fl)).slice(0, 5)
    .map((d) => armourOf({ ...d, level: fl }, { fightLevel: fl })).sort((a, b) => a - b);
  const a = near.length ? near[Math.floor(near.length / 2)] : ARMOUR_TIERS.medium + 0.1;
  refCache.set(fl, a);
  return a;
}

/** Your current totals as a state for expectedDps, cached until your gear,
 *  style or the tick changes (buffs and potions run out by the tick). */
export function worthState(game) {
  const eq = game.equipment;
  const mode = game.combatMode();
  const key = `${mode}|${Object.values(eq.slots || {}).join(',')}|${game.tickCount}`;
  if (game._worthCache?.key === key) return game._worthCache.s;
  const b = eq.bonuses('main');
  const crit = critNow(game, mode);
  const perk = game.perkMods(mode);
  const s = {
    mode,
    dmgKey: mode === 'magic' ? 'magPct' : 'atkPct',
    dmgPct: mode === 'magic' ? b.magPct : b.atkPct,
    // Crit chance from everything but gear crit %, so gear crit can be added and taken away.
    critBase: crit.total - (b.crit || 0) / 100,
    crit: b.crit || 0,
    critDmg: b.critDmg || 0,
    haste: 100 / eq.hasteMult() - 100,   // gear, Fletching and shrine haste (the part gear points add to)
    pierce: (b.pierce || 0) + game.buffMod('pierce'),
    armour: refBossArmour(game.fightLevel()),
    bossBase: 1 + (perk.dmg || 0) + game.learning.perks().dmg + (perk.boss || 0),
    bossDmg: b.bossDmg || 0,
  };
  game._worthCache = { key, s };
  return s;
}

/** Which state key an item bonus key feeds for your style (null: it doesn't). */
export function stateKeyFor(s, bonusKey) {
  if (bonusKey === 'atkPct' || bonusKey === 'magPct') return bonusKey === s.dmgKey ? 'dmgPct' : null;
  return WORTH_KEYS.includes(bonusKey) ? bonusKey : null;
}

/** % more damage per second that +1 of `bonusKey` gives you right now
 *  (atkPct, magPct, critDmg, crit, haste, pierce, bossDmg). Pierce is against
 *  `armour` (default: a typical boss your level); boss damage only counts on
 *  bosses and champions. 0 for a stat your style doesn't use. */
export function statWorth(game, bonusKey, { armour = null } = {}) {
  const s = worthState(game);
  const k = stateKeyFor(s, bonusKey);
  if (!k) return 0;
  return gainOf(armour == null ? s : { ...s, armour }, k, 1) * 100;
}

/** Pierce's worth (+1 point, in %) against each monster armour tier. */
export function pierceByTier(game) {
  const s = worthState(game);
  return Object.entries(ARMOUR_TIERS).map(([tier, a]) => ({ tier, armour: a, worth: gainOf({ ...s, armour: a }, 'pierce', 1) * 100 }));
}

/** The % damage a whole item's bonuses (`b`) add for you: on top of your
 *  current totals, or, when it is `worn`, what it adds now (taken away and
 *  compared). Returns [{ key, value, worth }] for its offensive stats, worth
 *  null where your style doesn't use the stat. */
export function itemWorth(game, b, { worn = false } = {}) {
  const s = worthState(game), out = [];
  for (const key of ['atkPct', 'magPct', 'critDmg', 'crit', 'haste', 'pierce', 'bossDmg']) {
    const v = b?.[key] || 0;
    if (!v) continue;
    const k = stateKeyFor(s, key);
    if (!k) { out.push({ key, value: v, worth: null }); continue; }
    const worth = worn ? 1 - expectedDps({ ...s, [k]: s[k] - v }) / expectedDps(s) : gainOf(s, k, v);
    out.push({ key, value: v, worth: worth * 100 });
  }
  return out;
}

/** Overall: the % more (or less) damage from swapping the worn piece's
 *  offensive stats (`theirs`) for this one's (`mine`), from the expected-damage
 *  formula with and without the swap. null when the two differ in none of them. */
export function swapWorth(game, mine, theirs) {
  const s = worthState(game), t = { ...s };
  let any = false;
  for (const key of ['atkPct', 'magPct', 'critDmg', 'crit', 'haste', 'pierce', 'bossDmg']) {
    const k = stateKeyFor(s, key), d = (mine?.[key] || 0) - (theirs?.[key] || 0);
    if (!k || !d) continue;
    t[k] += d; any = true;
  }
  return any ? (expectedDps(t) / expectedDps(s) - 1) * 100 : null;
}

/** "+1.8%", rounded sensibly for its size. */
export function fmtWorth(v) {
  const a = Math.abs(v), sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const dp = a >= 9.95 ? 0 : a >= 0.995 ? 1 : a >= 0.0995 ? 2 : 3;
  const t = a.toFixed(dp);
  return `${sign}${t}%`;
}

const pctOf = (f) => `${Math.round(f * 100)}%`;

/** The Stats tab's "What 1 point is worth" box: { rows: [{ key, label, worth }],
 *  best, why, crit, armour, tiers }. */
export function worthTable(game) {
  const s = worthState(game);
  const c = Math.max(0, Math.min(1, s.critBase + s.crit / 100));
  const rows = [
    { key: s.dmgKey, label: s.mode === 'magic' ? 'Magic bonus' : 'Physical damage', worth: statWorth(game, s.dmgKey) },
    { key: 'critDmg', label: 'Crit damage', worth: statWorth(game, 'critDmg') },
    { key: 'crit', label: 'Crit chance', worth: statWorth(game, 'crit') },
    { key: 'haste', label: 'Attack speed', worth: statWorth(game, 'haste') },
    { key: 'pierce', label: 'Armour pierce', worth: statWorth(game, 'pierce') },
  ];
  const best = rows.reduce((a, r) => (r.worth > a.worth ? r : a), rows[0]).key;
  const dmg = rows[0].worth, cd = rows[1].worth;
  const ratio = cd > 0 ? dmg / cd : 0;
  let why = c >= 1 ? 'Every hit already crits, so more crit chance does nothing; crit damage now counts on every hit.'
    : `Crit damage only counts on crits (you crit ${pctOf(c)} of the time)${ratio >= 1.05 ? `, so 1 point of it is worth about ${ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1)}× less than 1 point of ${rows[0].label}` : ''}.`;
  if (best === 'pierce') why += ` A boss your level wears ${pctOf(s.armour)} armour and your pierce is ${Math.round(s.pierce)}%: pierce is worth most until it cancels the armour.`;
  else if (best === 'crit') why += ' Each crit hits ×2.5 on average (more with crit damage), so more crits beat a flat bonus.';
  else if (best === 'haste') why += ' Attack speed adds whole extra attacks.';
  return { rows, best, why, crit: c, armour: s.armour, pierce: s.pierce, tiers: pierceByTier(game) };
}

const WORTH_NAMES = { atkPct: 'dmg', magPct: 'dmg', critDmg: 'dmg', crit: 'dmg', haste: 'dmg', pierce: 'dmg vs a boss your level', bossDmg: 'dmg vs bosses' };

/** The tooltip notes for one piece of gear: { key: '≈ +1.8% dmg' } for each of
 *  its offensive stats ('not for your style' where it doesn't count for you).
 *  `copy` / `q`: the copy and quality the tooltip is about. */
export function gearWorthNotes(game, id, copy = 'main', q = null) {
  const eq = game.equipment;
  const b = eq.itemBonuses(id, copy, q);
  const worn = Object.entries(eq.slots || {}).some(([s, wid]) => wid === id && eq.copyIn(s) === copy && (eq.qualityIn(s) || null) === (q || null));
  const fits = eq.styleFits(id);
  const notes = {};
  for (const w of itemWorth(game, b, { worn })) {
    notes[w.key] = !fits || w.worth == null ? 'not for your style' : `≈ ${fmtWorth(w.worth)} ${WORTH_NAMES[w.key]}`;
  }
  return notes;
}

/** The tooltip's "Overall" line: % more (or less) damage from wearing `id` in
 *  place of what is worn in `slot`, from their offensive stats (null: no change). */
export function gearSwapWorth(game, id, slot, q = null) {
  const eq = game.equipment, worn = eq.get(slot);
  const off = (wid, copy, wq) => (wid && eq.styleFits(wid) ? eq.itemBonuses(wid, copy, wq) : {});
  return swapWorth(game, off(id, eq.copyFor(id, slot), q), off(worn, eq.copyIn(slot), eq.qualityIn(slot)));
}
