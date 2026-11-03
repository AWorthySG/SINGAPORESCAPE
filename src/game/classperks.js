// What makes each job class different, in plain words for the class picker and
// the Combat tab: the class's signature trait, then its weapon's numbers (swing
// speed, reach, cleave, dual wielding, crit) and its strong and weak matchups.
// Built from the same data the combat code uses, so it stays true.
import { CLASS_BY_ID, starterWeapon, WEAPON_TYPE_NAMES, CLEAVE_SHARE, ARMOUR_FAMILY, ARMOUR_FAMILIES } from '../data/classes.js';
import { getItem } from '../data/items.js';
import { WEAPON_VS_RACE, RACES, weaponTypeName } from '../data/races.js';
import { swingBeats } from './gear.js';
import { canDualWield } from './equipment.js';

// One signature line per class: the thing to remember it by.
const SIGNATURE = {
  rogue: 'Dual wields daggers: a second dagger in the off-hand strikes again (60% power) after every swing.',
  swordsman: 'The all-rounder: balanced accuracy and power, and a solid cleave.',
  corsair: 'Dual wields scimitars and swings faster than any other blade, with a light cleave.',
  paladin: 'Holy maces that crush the undead, demons and armoured sea creatures.',
  knight: 'Longswords strike from 3 tiles away, and slay dragons and reptiles.',
  berserker: 'Heavy battleaxes with a wide cleave that mows down packs.',
  juggernaut: 'Warhammers hit harder than anything and cleave through crowds; they crack golems.',
  gladiator: 'Two-handed swords: the widest cleave (70%) and 3-tile reach.',
  lancer: 'Accurate spears that strike from 3 tiles away.',
  brawler: 'Claws: the quickest swings in the game and extra critical hits, with a light cleave.',
  samurai: 'Keen katanas: quick, balanced and extra critical hits.',
  halberdier: 'Halberds: slow, huge blows from 3 tiles with a wide cleave.',
  archer: 'Shortbows loose arrow after arrow from 12 tiles away.',
  ranger: 'Longbows: harder-hitting shots from very far away.',
  wizard: 'Staves cast powerful spells; elemental staves supply unlimited runes of their element.',
  sorcerer: 'Wands cast quickly: lighter spells, but more of them.',
  dancer: 'Whips lash from 3 tiles, build Rhythm for bigger hits, and help you dodge blows.',
  pistoler: 'Dual pistols: by far the fastest attacks in the game, each hand firing, and no ammo to buy.',
  ninja: 'Shurikens ricochet off your target into a second foe nearby (60% damage), and need no ammo.',
  merchant: 'Hire as many mercenaries as you can pay for (Combat tab): each hunts the nearest monster for 90 seconds, hits for half your melee damage and earns you full XP. Every kill has a 20% chance to call up an A-Worthling, a mirror image of you that hits for 25% of your damage for a minute.',
};

// The passive perk tracks each style levels up (a perk every 20 levels).
const TRACKS = { melee: 'Attack, Strength and Defence', ranged: 'Ranged and Defence', magic: 'Magic and Defence', dance: 'Agility and Defence' };

const secs = (s) => (s < 0.3 ? s.toFixed(2) : s.toFixed(1));
const raceList = (ids) => ids.map((r) => RACES[r]?.name.toLowerCase()).filter(Boolean).join(', ');

/** The class's traits: [{ icon, label, text }], signature first. */
export function classPerks(classId) {
  const cls = CLASS_BY_ID[classId];
  if (!cls) return [];
  const type = cls.weapon;
  const w = starterWeapon(classId);
  const eq = getItem(w).equip || {};
  const out = [{ icon: '⭐', label: 'Signature', text: SIGNATURE[classId] || cls.desc }];
  // Swing speed in seconds (a combat beat is 0.3s; spells come a beat quicker).
  let beats = swingBeats(w);
  if (cls.style === 'magic') beats = Math.max(1, beats - 1);
  const quick = beats < 0.5;   // scimitars and claws
  out.push({ icon: '⚡', label: 'Speed', text: `${quick ? 'Quick weapon: ' : ''}attacks every ${secs(beats * 0.3)}s` });
  const reach = cls.style === 'magic' ? 8 : eq.range || 2;
  out.push({ icon: '📏', label: 'Reach', text: `${reach} tiles` });
  if (cls.style === 'melee') {
    const share = CLEAVE_SHARE[type];
    out.push(share
      ? { icon: '🌀', label: 'Cleave', text: `${Math.round(share * 100)}% of each hit sweeps into up to 3 foes beside your target` }
      : { icon: '🌀', label: 'No cleave', text: 'quick weapons trade cleave for speed' });
  }
  if (canDualWield(w)) out.push({ icon: '⚔️', label: 'Dual wield', text: `hold a second ${weaponTypeName(type)} in the off-hand for an extra strike` });
  if (eq.bonuses?.crit) out.push({ icon: '💥', label: 'Critical', text: `+${eq.bonuses.crit}% crit chance on every ${weaponTypeName(type)}` });
  const vs = WEAPON_VS_RACE[type];
  if (vs?.strong.length) out.push({ icon: '🎯', label: 'Strong against', text: raceList(vs.strong) });
  if (vs?.weak.length) out.push({ icon: '🛡️', label: 'Weak against', text: raceList(vs.weak) });
  const fam = ARMOUR_FAMILIES[ARMOUR_FAMILY[classId]];
  if (fam) out.push({ icon: '🧥', label: 'Armour', text: `${fam.name}. ${fam.desc}` });
  out.push({ icon: '📈', label: 'Passive perks', text: `a new perk every 20 levels in ${TRACKS[cls.style]}` });
  return out;
}

/** A short line for tight spaces (the class picker card). */
export function classPerkSummary(classId) {
  return classPerks(classId).slice(1).filter((p) => ['Speed', 'Reach', 'Cleave', 'No cleave', 'Dual wield', 'Critical'].includes(p.label))
    .map((p) => (p.label === 'Speed' ? p.text.replace('Quick weapon: ', 'quick, ').replace('attacks every ', 'every ') : p.label === 'Reach' ? `${p.text} reach` : p.label === 'Cleave' ? `cleave ${p.text.split('%')[0]}%` : p.label.toLowerCase()))
    .join(' · ');
}

export { WEAPON_TYPE_NAMES };
