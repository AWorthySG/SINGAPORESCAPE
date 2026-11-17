// The Stats tab: every stat's final value, with everything combined (levels,
// gear with its mastery, refines and enchants, life skill perks, shrine
// blessings, alignment, class passives, prayers, potions, meals, class buffs,
// Agility, Slayer...). It only READS the game: wherever the game already has a
// function for a number (maxHp, attackInterval, perkMods, equipment.bonuses,
// karmaCombat, slayerBonus...) it asks that, so the sheet shows what combat
// really uses. The few numbers combat only works out inline, inside an attack
// (the damage multiplier, crit chance, final max hit), are worked out here the
// same way, step for step; tests/statsheet.test.mjs checks them against real
// attacks so the two can't drift apart unnoticed.
import { TICK_MS, COMBAT_BEAT_MS } from '../config.js';
import {
  playerAttackVsNpc, playerRangedVsNpc, playerMagicVsNpc, playerDanceVsNpc, levelBonuses,
  critChance, danceEvade, weaknessOf, armourOf, armourMult, WEAKNESS_BONUS, RANGED_TYPE_DMG,
  CRIT_MULT, MEGA_CRIT_MULT, MEGA_CRIT_CHANCE, RHYTHM_MAX, RHYTHM_DMG,
} from './combat.js';
import { attrForMode, ATTR_NAMES, DMG_PER_POINT, LIFE_PER_STR, CRIT_PER_INT, SPEED_PER_DEX } from './attributes.js';
import { getItem } from '../data/items.js';
import { getSpell, ELEMENTS, elementMatchup } from '../data/magic.js';
import { raceOf, matchup, RACE_BONUS, RACE_PENALTY } from '../data/races.js';
import { POTIONS } from '../data/trades.js';
import { PRAYER_BY_ID } from '../data/prayers.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { classPassiveMods, CLASS_SKILL } from '../data/classPassives.js';

// The same set as game.js (not exported there): the Holy path smites these races.
const UNHOLY_RACES = new Set(['undead', 'spirit', 'demon']);
// Shortbows loose a spread of 3 arrows, each at half an arrow's damage (game.js).
const SHORTBOW_ARROWS = 3, SHORTBOW_ARROW_DMG = 0.5;
// A dual wielder's off-hand blow is this share of the main hand's (before damage bonuses).
const OFF_HAND_SHARE = 0.6;
const MODE_NAMES = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic', dance: 'Whip (Dance)' };

// ---- Small formatters (plain text; the panel escapes nothing it doesn't need to) ----
const r1 = (v) => Math.round(v * 10) / 10;
const num = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-GB') : String(r1(v)));
const pct = (v, sign = true) => `${sign && v > 0 ? '+' : ''}${r1(v)}%`;   // v already in percent
const fracPct = (f, sign = true) => pct(f * 100, sign);                  // f a fraction
const times = (m) => `×${Math.round(m * 1000) / 1000}`;
export const fmtTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

/** The spell an attack right now would cast: the chosen one, or the best one
 *  you can afford when it can't be cast (as _magicAttack falls back). */
export function currentSpell(game) {
  const chosen = getSpell(game.player.spell);
  if (game.skills.magic >= chosen.level && game._hasRunes(chosen)) return chosen;
  return game.bestSpell() || chosen;
}

/** Bonuses split by where they come from: the gear you wear (with set bonuses),
 *  and the outside bonuses Equipment.extra adds (life perks, shrine, Dark path). */
function sources(game) {
  const b = game.equipment.bonuses(), lp = game.lifePerks(), sh = game.shrine.bonuses(), kc = game.karmaCombat();
  const part = (k) => {
    const life = lp[k] || 0, shrine = sh[k] || 0;
    const dark = kc.side === 'dark' && (k === 'critDmg' || k === 'lifesteal') ? kc[k] || 0 : 0;
    const total = b[k] || 0;
    return { total, gear: total - life - shrine - dark, life, shrine, dark };
  };
  return { b, part, kc };
}

/** "gear 12 + life skills 6 ..." lines for a gear-style bonus (no zero parts). */
function bonusParts(p, unit = '%') {
  const f = unit === '%' ? (v) => pct(v) : (v) => `${v > 0 ? '+' : ''}${num(v)}`;
  return [['Gear', p.gear], ['Life skill perks', p.life], ['Shrine blessings', p.shrine], ['Dark path', p.dark]]
    .filter(([, v]) => v).map(([l, v]) => [l, f(v)]);
}

/** Passive perks for a style split three ways: skill perks, class passives,
 *  and potions + meal (perkMods returns the sum of all three). */
function perkSplit(game, mode) {
  const all = game.perkMods(mode);
  const boosted = !!game.meal || Object.keys(game.potions || {}).length > 0;
  const pot = boosted ? game.potionMods(mode === 'defence' ? game.combatMode() : mode) : {};
  const cls = game.jobClass && CLASS_BY_ID[game.jobClass];
  const cm = cls && mode !== 'defence' ? classPassiveMods(cls.id, game.skills.level(CLASS_SKILL[cls.style] || 'attack')) : {};
  const get = (k) => {
    const total = all[k] || 0, potion = pot[k] || 0, base = total - potion;
    const klass = Math.min(base, cm[k] || 0);
    return { total, potion, klass, skill: base - klass };
  };
  return { all, get };
}
const perkLines = (s, f = fracPct) => [['Combat skill perks', s.skill], ['Class passives', s.klass], ['Potions & meal', s.potion]]
  .filter(([, v]) => v).map(([l, v]) => [l, f(v)]);

/** The damage multiplier an attack's hit gets, worked out as _offensiveMods
 *  does (without a special attack or ability, which are one-off). With `npc`,
 *  its weakness, race match-up, armour, alignment and Slayer task count too;
 *  without, it is the multiplier against a normal monster (or a boss, with
 *  `boss`) before its armour. Returns { m, parts }. */
export function damageMult(game, mode = game.combatMode(), { npc = null, boss = false, spell = null } = {}) {
  const parts = [];
  let m = 1;
  const mul = (f, label) => { m *= f; if (label && f !== 1) parts.push([label, times(f)]); };
  const def = npc?.def;
  const weak = !!def && weaknessOf(def) === (mode === 'dance' ? 'melee' : mode);
  mul(weak ? WEAKNESS_BONUS.dmg : 1, 'Weakness');
  if (def) {
    const race = raceOf(def, npc.npcId);
    const mu = mode === 'magic' ? elementMatchup((spell || currentSpell(game)).element, race) : matchup(game.weaponType(), race);
    if (mu === 'strong') mul(RACE_BONUS.dmg, 'Effective vs race');
    else if (mu === 'weak') mul(RACE_PENALTY.dmg, 'Resisted by race');
    const kc = game.karmaCombat();
    if (kc.side === 'holy' && UNHOLY_RACES.has(race)) mul(1 + kc.holyDmg, 'Holy path vs unholy');
  }
  const gb = game.equipment.bonuses();
  if (def) mul(armourMult(armourOf(def, { champion: npc.champion, fightLevel: game.fightLevel() }), gb.pierce, weak), 'Monster armour / pierce');
  const attr = attrForMode(mode);
  mul(1 + (game.attrs?.[attr] || 0) * DMG_PER_POINT, ATTR_NAMES[attr]);
  const perk = game.perkMods(mode), learn = game.learning.perks().dmg;
  const isBoss = def ? !!(def.boss || npc.champion) : boss;
  mul(1 + (perk.dmg || 0) + learn + (isBoss ? (perk.boss || 0) + gb.bossDmg / 100 : (gb.mobDmg || 0) / 100),
    isBoss ? 'Perks, potions & boss damage' : 'Perks, potions & monster damage');
  mul(1 + (mode === 'magic' ? gb.magPct : gb.atkPct) / 100, mode === 'magic' ? 'Magic damage bonus' : 'Physical damage bonus');
  mul(1 + game.buffMod('dmg'), 'Class buff');
  if (npc && game.onSlayerTask(npc)) mul(1 + game.slayerBonus().dmg / 100, 'Slayer task');
  return { m, parts };
}

/** The max hit of the attack you'd make right now: { max, off, arrows, mode,
 *  spell, base, parts }. `max` is one blow (one arrow of a shortbow's spread),
 *  `off` the off-hand's blow when dual wielding (else 0). Follows the attack
 *  code in game.js (doPlayerAttack, _rangedAttack, _magicAttack, _danceAttack). */
export function maxHitNow(game, { npc = null, boss = false, rhythm = 0 } = {}) {
  const mode = game.combatMode(), sk = game.skills, eq = game.equipment, pm = game.prayerMult();
  const def = npc?.def || {};
  const spell = mode === 'magic' ? currentSpell(game) : null;
  const { m, parts } = damageMult(game, mode, { npc, boss, spell });
  const out = { mode, spell, arrows: 1, off: 0, parts };
  if (mode === 'magic') {
    const base = playerMagicVsNpc(sk, eq, spell, def).max;
    return { ...out, base, max: Math.max(1, Math.round(base * m)) };
  }
  if (mode === 'dance') {
    const base = playerDanceVsNpc(sk, eq, game.player.danceStyle, def, rhythm).max;
    if (pm.str !== 1) parts.unshift(['Prayer', times(pm.str)]);
    return { ...out, base, max: Math.max(1, Math.round(base * pm.str * m)) };
  }
  let baseMax, arrowDmg = 1;
  if (mode === 'ranged') {
    const wpn = getItem(eq.get('weapon')).equip;
    const idx = wpn.noAmmo ? -1 : game._bestAmmoIdx();
    const arrowStr = wpn.noAmmo ? Math.floor((wpn.bonuses.ranged || 0) / 3) : idx === -1 ? 0 : getItem(game.inventory.slotAt(idx).id).arrowStr || 0;
    const typeMult = wpn.weaponType === 'longbow' || wpn.weaponType === 'rifle' ? RANGED_TYPE_DMG[wpn.weaponType] : 1;
    baseMax = Math.round(playerRangedVsNpc(sk, eq, game.player.rangedStyle, def, arrowStr).max * pm.ranged * typeMult);
    if (pm.ranged !== 1) parts.unshift(['Prayer', times(pm.ranged)]);
    if (wpn.weaponType === 'shortbow') { out.arrows = SHORTBOW_ARROWS; arrowDmg = SHORTBOW_ARROW_DMG; }
  } else {
    baseMax = Math.round(playerAttackVsNpc(sk, eq, game.player.style, def).max * pm.str);
    if (pm.str !== 1) parts.unshift(['Prayer', times(pm.str)]);
  }
  out.base = baseMax;
  out.max = Math.max(1, Math.round(baseMax * m * arrowDmg));
  // The off-hand's blow is a share of the main hand's before damage bonuses.
  if (eq.isDualWielding()) out.off = Math.max(1, Math.round(baseMax * OFF_HAND_SHARE));
  return out;
}

/** Crit chance (a fraction, may pass 1 before the display caps it) as the
 *  attack code adds it up, with its parts. */
export function critNow(game, mode = game.combatMode()) {
  const sk = game.skills, b = game.equipment.bonuses(), perk = game.perkMods(mode);
  const lvl = mode === 'ranged' ? sk.ranged : mode === 'magic' ? sk.magic : mode === 'dance' ? sk.agility : sk.attack;
  const base = critChance(lvl, b.crit);
  const learn = game.learning.perks().crit, buff = game.buffMod('crit'), pray = game.prayerCrit();
  const int = mode === 'magic' ? (game.attrs.int || 0) * CRIT_PER_INT : 0;
  const total = base + (perk.crit || 0) + learn + buff + pray + int;
  return { total, base, levelPart: Math.min(base, lvl * 0.0015), perk: perk.crit || 0, learn, buff, pray, int };
}

/** Attack speed: the time between attacks and every factor in it. */
export function speedNow(game) {
  const eq = game.equipment;
  const spell = game.combatMode() === 'magic' ? currentSpell(game) : null;
  const beats = game.attackInterval(spell);
  const secs = beats * COMBAT_BEAT_MS / 1000;
  const gearHaste = 100 / eq.hasteMult() - 100;   // gear + outside haste (Fletching, Swiftness)
  const factors = [
    ['Gear, Fletching & shrine', gearHaste],
    ['Class buff', game.buffMod('haste')],
    ['Agility', game.agilityAttackSpeed()],
    ['Dexterity', (game.attrs?.dex || 0) * SPEED_PER_DEX],
    ['Haste brew', (game.perkMods().haste || 0) * 100],
  ];
  const combined = (factors.reduce((t, [, v]) => t * (1 + v / 100), 1) - 1) * 100;
  return { beats, secs, perSec: secs > 0 ? 1 / secs : 0, combined, factors };
}

const row = (id, label, text, parts = [], note = '') => ({ id, label, text, parts, note });

/** The whole sheet: { mode, modeName, sections: [{ id, title, rows }], effects }.
 *  Every row is { id, label, text, parts: [[source, value]], note }. */
export function statSheet(game) {
  const mode = game.combatMode();
  const { b, part, kc } = sources(game);
  const perks = perkSplit(game, mode), defPerks = perkSplit(game, 'defence');
  const sk = game.skills;
  const offence = [], defence = [], utility = [];

  // ---- Offence ----
  const mh = maxHitNow(game), mhBoss = maxHitNow(game, { boss: true });
  const unit = mode === 'magic' ? ` (${mh.spell.name})` : mh.arrows > 1 ? ' per arrow' : '';
  offence.push(row('maxhit', `Max hit${unit}`, num(mh.max),
    [['Base hit (levels, gear, weapon)', num(mh.base)], ...mh.parts],
    `Against a normal monster, before its armour.${mh.arrows > 1 ? ` Each shot looses ${mh.arrows} arrows.` : ''} Weakness, race and Slayer tasks add more.`));
  if (mh.off) offence.push(row('offhand', 'Off-hand max hit', num(mh.off), [['Main hand base hit', num(mh.base)], ['Off-hand share', `${OFF_HAND_SHARE * 100}%`]],
    'Dual wielding: the off-hand strikes again after every swing.'));
  if (mhBoss.max !== mh.max) offence.push(row('maxhitboss', 'Max hit vs bosses & champions', num(mhBoss.max), mhBoss.parts));
  if (mode === 'dance') {
    const full = maxHitNow(game, { rhythm: RHYTHM_MAX });
    offence.push(row('rhythm', 'Max hit at full Rhythm', num(full.max), [['Rhythm stacks', `${game.danceRhythm || 0} / ${RHYTHM_MAX}`], ['Per stack', pct(RHYTHM_DMG * 100)]]));
  }
  const sp = speedNow(game);
  offence.push(row('interval', 'Time between attacks', `${sp.secs < 0.1 ? sp.secs.toFixed(3) : sp.secs.toFixed(2)}s`,
    [['Attacks per second', r1(sp.perSec).toString()]], mode === 'magic' ? 'Spells come off at half a swing, times the element\'s cast speed.' : ''));
  offence.push(row('aps', 'Attacks per second', r1(sp.perSec).toString()));
  if (Math.abs(sp.combined) > 0.05) offence.push(row('haste', 'Attack speed bonus %', pct(sp.combined), sp.factors.filter(([, v]) => v).map(([l, v]) => [l, pct(v)]), 'The factors multiply together.'));

  // Accuracy / power: the style's gear bonus plus what your levels add (combat.js levelBonuses).
  const lb = levelBonuses(sk);
  const styleStat = mode === 'ranged' ? [['ranged', 'Ranged bonus']] : mode === 'magic' ? [['magic', 'Magic attack bonus'], ['magicStr', 'Magic damage bonus']]
    : mode === 'dance' ? [['dance', 'Dance bonus']] : [['attack', 'Melee attack bonus'], ['strength', 'Melee power bonus']];
  for (const [k, label] of styleStat) {
    const p = part(k), lv = lb[k] || 0;
    offence.push(row(k, label, `+${num(p.total + lv)}`, [...bonusParts(p, ''), ...(lv ? [['From your levels', `+${lv}`]] : [])]));
  }

  const crit = critNow(game, mode), cp = part('crit');
  offence.push(row('crit', 'Crit chance %', pct(Math.min(1, crit.total) * 100, false), [
    ['Fighting level', fracPct(crit.levelPart)], ...bonusParts(cp).map(([l, v]) => [l, v]),
    ...perkLines(perks.get('crit')), ['Maths mastery', fracPct(crit.learn)], ['Prayer', fracPct(crit.pray)],
    ['Class buff', fracPct(crit.buff)], ['Intelligence', fracPct(crit.int)],
  ].filter(([, v]) => v !== '0%'), crit.total > 1 ? 'Capped at 100%: every hit is a crit.' : ''));
  const cd = part('critDmg');
  offence.push(row('critdmg', 'Crit damage bonus %', pct(cd.total),
    [['A crit', `×${CRIT_MULT} (one in ${Math.round(1 / MEGA_CRIT_CHANCE)} ×${MEGA_CRIT_MULT})`], ...bonusParts(cd)], 'Added to the crit multiplier.'));
  const gp = (k, id, label, note = '') => { const p = part(k); if (p.total) offence.push(row(id, label, pct(p.total), bonusParts(p), note)); };
  gp('pierce', 'pierce', 'Armour pierce %', 'Cancels monster armour first; any left over adds damage.');
  if (mode === 'magic') gp('magPct', 'magpct', 'Magic damage bonus %');
  else gp('atkPct', 'atkpct', 'Physical damage bonus %');
  // Damage % from passive perks, potions, meals, English mastery, your stat points and a class buff.
  {
    const d = perks.get('dmg'), learn = game.learning.perks().dmg, attr = attrForMode(mode), ap = (game.attrs?.[attr] || 0) * DMG_PER_POINT, buff = game.buffMod('dmg');
    const tot = ((1 + d.total + learn) * (1 + ap) * (1 + buff) - 1);
    if (Math.abs(tot) > 0.0005) offence.push(row('dmg', 'Damage bonus % (perks, potions, buffs)', fracPct(tot),
      [...perkLines(d), ['English mastery', fracPct(learn)], [ATTR_NAMES[attr], fracPct(ap)], ['Class buff', fracPct(buff)]].filter(([, v]) => v !== '0%')));
  }
  {
    const p = part('bossDmg'), pb = perks.get('boss');
    const tot = p.total + pb.total * 100;
    if (tot) offence.push(row('boss', 'Boss & champion damage %', pct(tot), [...bonusParts(p), ...perkLines(pb)]));
  }
  gp('mobDmg', 'mob', 'Damage vs normal monsters %');
  gp('aoe', 'aoe', 'Area damage %', 'Cleaves, splashes and ricochets land this much harder.');
  {
    const p = part('extra'), pe = perks.get('extra');
    const tot = p.total + pe.total * 100;
    if (tot) offence.push(row('extra', mode === 'magic' ? 'Spell echo chance %' : 'Extra strike chance %', pct(tot, false), [...bonusParts(p), ...perkLines(pe)]));
  }
  {
    const p = part('lifesteal'), pl = perks.get('lifesteal'), buff = game.buffMod('lifesteal') * 100;
    const tot = p.total + pl.total * 100 + buff;
    if (tot) offence.push(row('lifesteal', 'Lifesteal %', pct(tot, false), [...bonusParts(p), ...perkLines(pl), ...(buff ? [['Class buff', pct(buff)]] : [])],
      'Heals this share of the damage you deal.'));
  }
  const splash = perks.get('splash');
  if (splash.total) offence.push(row('splash', 'Chance to hit a second monster %', fracPct(splash.total, false), perkLines(splash)));
  const stun = perks.get('stun');
  if (stun.total) offence.push(row('stun', 'Stun chance %', fracPct(stun.total, false), perkLines(stun)));
  offence.push(row('range', 'Attack range', `${game.attackRange()} tiles`,
    mode === 'ranged' && perks.get('range').total ? [['Long Shot perks', `+${Math.floor(perks.get('range').total)}`]] : []));
  if (game.slayer?.task) {
    const s = game.slayerBonus();
    offence.push(row('slayer', 'Slayer task damage %', pct(s.dmg), [['Slayer level', pct(s.dmg - s.helm)], ...(s.helm ? [['Slayer helmet', pct(s.helm)]] : [])],
      `Against ${game.slayer.task.name} (${game.slayer.task.remaining} left).`));
  }

  // ---- Defence ----
  {
    const hp = part('hp'), perkHp = defPerks.get('maxhp'), str = (game.attrs?.str || 0) * LIFE_PER_STR;
    defence.push(row('maxhp', 'Max life', num(game.maxHp()), [
      ['Hitpoints level', num(sk.hitpoints)], ...bonusParts(hp, ''), ...perkLines(perkHp), ['Strength', fracPct(str)],
    ].filter(([, v]) => v !== '0%' && v !== '0')));
  }
  {
    const p = part('defence'), pm = game.prayerMult().def;
    defence.push(row('defence', 'Defence bonus', `+${num(p.total)}`, [...bonusParts(p, ''), ['Defence level', num(sk.defence)], ...(pm !== 1 ? [['Prayer', times(pm)]] : [])],
      'Makes monsters miss more often.'));
  }
  {
    const prot = game.protectFactor(), buff = Math.min(0.9, game.buffMod('reduce')), pr = defPerks.get('reduce');
    const perkCut = Math.min(0.6, pr.total);
    const tot = 1 - (1 - prot) * (1 - buff) * (1 - perkCut);
    const parts = [...(prot ? [['Protect prayer', fracPct(prot)]] : []), ...(buff ? [['Class buff', fracPct(buff)]] : []), ...perkLines(pr)];
    if (game.braceTicks > 0) parts.push(['Bracing now', '×0.5']);
    defence.push(row('reduce', 'Damage reduction %', fracPct(tot, false), parts, 'The sources multiply; perks and potions stop at 60%.'));
    const br = defPerks.get('bossReduce');
    if (br.total) defence.push(row('bossreduce', 'Damage reduction vs bosses %', fracPct(1 - (1 - prot) * (1 - buff) * (1 - Math.min(0.6, pr.total + br.total)), false), perkLines(br)));
  }
  {
    const dance = mode === 'dance' ? danceEvade(sk.agility, game.player.danceStyle) : 0;
    const pd = defPerks.get('dodge'), buff = game.buffMod('dodge');
    const tot = 1 - (1 - dance) * (1 - (pd.total + buff));
    if (tot > 0) defence.push(row('dodge', 'Dodge chance %', fracPct(tot, false),
      [...(dance ? [["Dancer's evasion (Agility)", fracPct(dance)]] : []), ...perkLines(pd), ...(buff ? [['Class buff', fracPct(buff)]] : [])],
      'Halved against heavy, telegraphed blows.'));
  }
  {
    const rg = defPerks.get('regen');
    if (rg.total) defence.push(row('regen', 'Life regen', `${num(rg.total * 1000 / TICK_MS)} / s`, perkLines(rg, (v) => `${num(v * 1000 / TICK_MS)}/s`)));
  }
  const thorns = defPerks.get('thorns');
  if (thorns.total) defence.push(row('thorns', 'Thorns %', fracPct(thorns.total, false), perkLines(thorns), 'Attackers take this share of the damage they deal.'));
  const dot = defPerks.get('dotReduce');
  if (dot.total) defence.push(row('dot', 'Poison, burn & bleed reduction %', fracPct(dot.total, false), perkLines(dot)));

  // ---- Utility ----
  const agi = game.agilitySpeed();
  utility.push(row('move', 'Movement speed bonus %', pct(agi), [['Agility level', num(sk.agility)]], 'Roads and bridges are a third quicker on top.'));
  utility.push(row('run', 'Run speed', `${r1(1000 / (TICK_MS * game.playerStepMul() * game.player.runMul))} tiles/s`));
  {
    const p = part('prayer');
    utility.push(row('prayer', 'Prayer points', `${Math.ceil(game.prayerPoints)} / ${game.maxPrayer()}`,
      p.total ? [['Prayer bonus', `+${num(p.total)}`], ['Drain slowed by', pct(100 - 100 / (1 + p.total / 30), false)]] : []));
  }
  {
    const x = game.xpBreakdown();
    const parts = [['Night hunt', x.night], [`Wilderness (level ${x.wildLevel})`, x.wild], [`Kill streak (${x.streakKills})`, x.streak], ['Blessed', x.blessed]]
      .filter(([, v]) => v !== 1).map(([l, v]) => [l, times(v)]);
    utility.push(row('xp', 'Combat XP bonus', times(x.total), parts));
  }
  if (sk.level('slayer') > 1 || game.slayer?.task) utility.push(row('slayerloot', 'Slayer task loot bonus %', pct(game.slayerBonus().loot)));
  if (kc.side !== 'neutral') utility.push(row('karma', 'Alignment', `${kc.side === 'holy' ? 'Holy' : 'Dark'} path, tier ${kc.tier}`,
    kc.side === 'holy' ? [['Damage vs undead, spirits & demons', fracPct(kc.holyDmg)]] : [['Crit damage', pct(kc.critDmg)], ['Lifesteal', pct(kc.lifesteal)]]));

  return {
    mode, modeName: MODE_NAMES[mode] || mode,
    sections: [
      { id: 'offence', title: 'Offence', rows: offence },
      { id: 'defence', title: 'Defence', rows: defence },
      { id: 'utility', title: 'Utility', rows: utility },
    ],
    effects: activeEffects(game),
  };
}

// Plain words for the effect keys potions, meals and class buffs use.
const FX = {
  crit: (v) => `${fracPct(v)} crit chance`, dmg: (v) => `${fracPct(v)} damage`, reduce: (v) => `${fracPct(v, false)} less damage taken`,
  haste: (v) => `${fracPct(v)} attack speed`, boss: (v) => `${fracPct(v)} boss damage`, lifesteal: (v) => `${fracPct(v, false)} lifesteal`,
  maxhp: (v) => `${fracPct(v)} max life`, regen: (v) => `${num(v * 1000 / TICK_MS)} life/s`, dodge: (v) => `${fracPct(v, false)} dodge`,
};
const fxText = (fx, skip = []) => Object.entries(fx || {}).filter(([k]) => !skip.includes(k) && k !== 'heal')
  .map(([k, v]) => (FX[k] ? FX[k](v) : `${k} ${v}`)).join(', ');

/** What's running right now, with time left: [{ name, detail, left (ms) | null, off }]. */
export function activeEffects(game) {
  const out = [], mode = game.combatMode();
  const covered = new Set(Object.keys(game.potions || {}).flatMap((id) => POTIONS[id]?.covers || []));
  for (const [id, ms] of Object.entries(game.potions || {})) {
    const pot = POTIONS[id];
    if (!pot) continue;
    const off = pot.style && pot.style !== mode ? `${MODE_NAMES[pot.style]} only` : covered.has(pot.group) ? 'covered by a stronger brew' : '';
    out.push({ name: pot.name, detail: fxText(pot.fx), left: ms, off });
  }
  if (game.meal) out.push({ name: getItem(game.meal.id).name, detail: fxText(game.meal.fx), left: game.meal.ms, off: '' });
  if (game.buff && game.buff.until > game.tickCount) {
    // A class buff's haste is already in percent (see attackInterval); its other keys are fractions.
    const { id: _i, name, until, haste, ...rest } = game.buff;
    const detail = [haste ? `${pct(haste)} attack speed` : '', fxText(rest)].filter(Boolean).join(', ');
    out.push({ name, detail, left: (until - game.tickCount) * TICK_MS, off: '' });
  }
  for (const id of game.activePrayers || []) {
    const p = PRAYER_BY_ID[id];
    const bits = [['str', 'melee damage'], ['def', 'defence'], ['ranged', 'ranged damage'], ['magic', 'magic damage'], ['crit', 'crit chance'], ['protect', 'melee damage blocked']]
      .filter(([k]) => p[k]).map(([k, l]) => `${fracPct(p[k], k !== 'protect')} ${l}`);
    out.push({ name: p.name, detail: `${bits.join(', ')} (prayer)`, left: null, off: '' });
  }
  if (game.braceTicks > 0) out.push({ name: 'Brace', detail: 'incoming damage halved', left: game.braceTicks * TICK_MS, off: '' });
  if (game.blessedMs > 0) out.push({ name: 'Blessed', detail: `combat XP ${times(game.xpBreakdown().blessed)}`, left: game.blessedMs, off: '' });
  if (game.slayer?.task) out.push({ name: 'Slayer task', detail: `${game.slayer.task.remaining} ${game.slayer.task.name} left, ${pct(game.slayerBonus().dmg)} damage to them`, left: null, off: '' });
  return out;
}
