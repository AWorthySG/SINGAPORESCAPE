// Bones: Prayer's training material. Ordinary bones get better with the band a monster
// lives in (its tierLevel), champions add Champion bones, and bosses drop Titan bones
// plus, for the hardest, a named rare kind.
import { ITEMS } from './items.js';

export const ALTAR_XP_MULT = 2.5;   // offering at an A-Worthy Monument instead of burying
export const ALTAR_RANGE = 3;       // tiles from a monument you can offer at

// The ordinary bone each band drops: a monster's tier picks the first rung it fits under.
export const BONE_LADDER = [
  { id: 'bones', maxTier: 24 },
  { id: 'big_bones', maxTier: 59 },
  { id: 'heavy_bones', maxTier: 119 },
  { id: 'ancient_bones', maxTier: 249 },
  { id: 'spirit_bones', maxTier: Infinity },
];
export const boneForTier = (tier) => BONE_LADDER.find((b) => (tier || 1) <= b.maxTier).id;
export const isBone = (id) => !!ITEMS[id]?.prayerXp;
export const boneXp = (id) => ITEMS[id]?.prayerXp || 0;

export const CHAMPION_BONE_KILLS = 10;   // a champion is worth ~ten ordinary kills of its band
export const championBoneQty = (tier) => Math.max(1, Math.round(CHAMPION_BONE_KILLS * boneXp(boneForTier(tier)) / boneXp('champion_bones')));
// Titan bones per boss kill: at least two, more for the bigger bosses.
export function bossBoneQty(tier) { const min = Math.max(2, Math.round((tier || 1) / 30)); return { min, max: min + 2 }; }

// The hardest bosses sometimes also drop a named rare kind of bone.
export const RARE_BOSS_BONES = {
  timah_drake: 'dragon_bones', the_garuda: 'dragon_bones', dragon_kiln_wyrm: 'dragon_bones', eternal_wyrm: 'dragon_bones', celestial_garuda: 'dragon_bones', jade_dragon: 'dragon_bones',
  demon_lord: 'fiend_bones', pulau_hantu_djinn: 'fiend_bones', shadow_sovereign: 'fiend_bones', rift_tyrant: 'fiend_bones',
  drowned_admiral: 'legend_bones', jenglot_sovereign: 'legend_bones', singa_of_temasek: 'legend_bones', spirit_of_badang: 'legend_bones',
};
export const RARE_BONE_CHANCE = 0.35;
export const RARE_BONE_QTY = { dragon_bones: [1, 3], fiend_bones: [1, 3], legend_bones: [1, 2] };
