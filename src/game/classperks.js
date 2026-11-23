// What makes each job class different, in plain words for the class picker and
// the Combat tab: the class's signature trait, then its weapon's numbers (swing
// speed, reach, cleave, dual wielding, crit) and its strong and weak matchups.
// Built from the same data the combat code uses, so it stays true.
import { CLASS_BY_ID, starterWeapon, WEAPON_TYPE_NAMES, CLEAVE_SHARE, ARMOUR_FAMILY, ARMOUR_FAMILIES, SECONDARY_WEAPON } from '../data/classes.js';
import { getItem } from '../data/items.js';
import { WEAPON_VS_RACE, RACES, weaponTypeName } from '../data/races.js';
import { swingBeats } from './gear.js';
import { canDualWield } from './equipment.js';
import { CHI, MONK_DODGE } from './monk.js';
import { PRIEST } from './priest.js';
import { ZEALOT, HOLY_FIRE } from './zealot.js';
import { LIFE_COST_FLOOR } from '../data/abilities.js';
const pct = (f) => Math.round(f * 100);

// One signature line per class: the thing to remember it by.
const SIGNATURE = {
  rogue: 'Dual wields daggers: a second dagger in the off-hand strikes again after every swing, with its own stats (60% of its hit).',
  swordsman: 'The all-rounder: steady damage, sturdy defence, and a solid cleave.',
  corsair: 'Dual wields scimitars and swings faster than any other blade, with a light cleave.',
  paladin: 'Holy maces that crush the undead, demons and armoured sea creatures.',
  knight: 'Longswords strike from 3 tiles away, and slay dragons and reptiles.',
  berserker: 'Heavy battleaxes with a wide cleave that mows down packs.',
  juggernaut: 'Warhammers hit harder than anything and cleave through crowds; they crack golems.',
  gladiator: 'Two-handed swords: the widest cleave (70%), hitting every foe within 3 tiles, and 3-tile reach.',
  lancer: 'Long spears that strike from 4 tiles away.',
  brawler: 'Claws: the quickest swings in the game and extra critical hits, with a light cleave. Your blows open wounds: the foe takes 5% more damage per stack (one stack a second), up to 30 stacks (+150%).',
  samurai: 'Keen katanas: quick, balanced and extra critical hits.',
  halberdier: 'Halberds: slow, huge blows from 3 tiles with a wide cleave.',
  archer: 'Shortbows loose an arrow every 0.15s, twice as fast as a longbow, and each spread also flings an extra arrow (30% of a full one) into up to two foes within 2 tiles of your target.',
  ranger: 'Longbows: each arrow hits 60% harder, from a little further than a shortbow, and pierces on into a monster lined up behind your target (30% of the hit; 2 monsters from Ranged 40, 3 from Ranged 70).',
  wizard: 'Staves cast powerful spells; elemental staves supply unlimited runes of their element.',
  sorcerer: 'Wands cast quickly: lighter spells, but more of them.',
  priest: `Holy orbs: every spell that lands heals you ${pct(PRIEST.heal)}% of its hit, and your spells hit undead, spirits and demons ${pct(PRIEST.smite)}% harder. `
    + 'Your skills heal and shield you, and Uplift makes every blessing count 50% more for 9s and fills a quarter of your Faith at once.',
  zealot: `A censer swung on a chain: every spell leaves the foe burning with holy fire (${pct(HOLY_FIRE.share * HOLY_FIRE.secs)}% of the hit over ${HOLY_FIRE.secs}s), and the fires stack. `
    + `Fervour: up to +${pct(ZEALOT.fervour)}% damage the more hurt you are (+${pct(ZEALOT.fervour / 2)}% at half life). `
    + `Burning Oath and Pillar of Flame are paid for in life as well as adrenaline, never at ${pct(LIFE_COST_FLOOR)}% of your life or less.`,
  dancer: 'Whips lash from 3 tiles and ricochet into 2 more monsters (3 at full Rhythm), build Rhythm for bigger hits, and help you dodge blows.',
  sniper: 'Sniper rifles: the furthest reach in the game (32+ tiles) and each round hits about 5.5x as hard and pierces every monster within 1 tile of its path, up to 10 tiles past the target, but fires only every 1.5s. No ammo to buy.',
  pistoler: 'Dual pistols: by far the fastest attacks in the game, each hand firing, and no ammo to buy.',
  ninja: 'A shuriken in each hand: each attack throws both, they ricochet off your target into a second foe nearby (60% damage), and need no ammo. No shields.',
  monk: 'Monk knuckles punch and monk gloves palm-strike: knuckles in your main hand, gloves in the off-hand, and every swing lands both (the palm at 60% of the gloves\' hit). '
    + `Each blow builds Chi (one every ${CHI.everyMs / 1000}s, up to ${CHI.max}): +${pct(CHI.per)}% damage per Chi, and at ${CHI.max} it overflows, healing ${pct(CHI.heal)}% of your life. `
    + `Light on your feet: ${pct(MONK_DODGE)}% of blows miss you (${pct(MONK_DODGE / 2)}% of heavy ones). No shields.`,
  merchant: 'The strongest class in the game, paid for in coins: money talks, so your coin throws and every ally hit about twice as hard as any other class, and your coins scatter into up to 4 foes beside the target (90% each). Throws money: every coin flick from your cane costs coins (1 + 1 per 10 Ranged levels), and your skills cost coins instead of adrenaline. Hire up to 3 mercenaries at a time (Combat tab): each runs at the closest monster for 90 seconds, swings as fast as you, hits for half your damage, and earns you full XP. Every attack has a 25% chance to call up an A-Worthling, a mirror image of you that fights the same way for 25% of your damage and stays for good. Each A-Worthling swing has a 25% chance to split off a smaller one, up to 6 in all. Run out of coins and you can\'t fight, so keep your purse full.',
};

// The dual-wield line for a class whose off-hand holds its second weapon, not a twin.
const DUAL_LINE = { monk: 'wear monk gloves on the other hand: a palm strike follows every punch (60% of the gloves\' hit)' };
// "Every pair of claws": the weapon types that come in pairs.
const PAIRED = new Set(['claws', 'knuckles']);

// The passive perk tracks each style levels up (a perk every 20 levels).
const TRACKS = { melee: 'Melee and Defence', ranged: 'Ranged and Defence', magic: 'Magic and Defence', dance: 'Agility and Defence' };

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
  // Swing speed in seconds (a combat beat is 0.3s; spells take half a swing, so wands cast quickest).
  let beats = swingBeats(w);
  if (cls.style === 'magic') beats *= 0.5;
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
  if (canDualWield(w)) out.push({ icon: '⚔️', label: 'Dual wield', text: DUAL_LINE[classId] || `hold a second ${weaponTypeName(type)} in the off-hand for an extra strike` });
  const sec = SECONDARY_WEAPON[classId]; if (sec) out.push({ icon: '🔁', label: 'Second weapon', text: `can also wield ${WEAPON_TYPE_NAMES[sec]}` });
  if (eq.bonuses?.crit) out.push({ icon: '💥', label: 'Critical', text: `+${eq.bonuses.crit}% crit chance on every ${PAIRED.has(type) ? 'pair of ' : ''}${weaponTypeName(type)}` });
  const vs = WEAPON_VS_RACE[type];
  if (vs?.strong.length) out.push({ icon: '🎯', label: 'Strong against', text: raceList(vs.strong) });
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
