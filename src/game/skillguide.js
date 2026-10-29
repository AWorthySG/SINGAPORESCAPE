// Life-skill guides: for each skill, what it's for, where it's done, and every
// thing you can gather or make with the level it needs. Built from the game
// data, so a new tree, recipe or crop shows up here on its own.
import { OBJECTS } from '../data/objects.js';
import { ITEMS, getItem } from '../data/items.js';
import { SMELT, SMITH } from '../data/smithing.js';
import { DISHES } from '../data/cooking.js';
import { CRAFT } from '../data/crafting.js';
import { CROPS, POTIONS, FLETCH, HUNT, HIDE_CRAFT } from '../data/trades.js';
import { COOKING } from './skilling.js';

const name = (id) => (ITEMS[id] ? getItem(id).name : id);
const objsOf = (pred) => Object.entries(OBJECTS).filter(([, d]) => pred(d)).map(([id]) => id);

// One line on why each life skill matters, and the objects to walk to.
export const SKILL_GUIDES = {
  woodcutting: { use: 'Logs feed Firemaking and Fletching (bows, arrows, staves).' },
  mining: { use: 'Ore is smelted into bars for Smithing, and gems and gold go to Crafting.' },
  fishing: { use: 'Raw fish are cooked into food that heals you in a fight.' },
  hunter: { use: 'Pelts, skins and hides become armour; meat is cooked into food.' },
  farming: { use: 'Crops are herbs for Herblore and ingredients for hawker dishes.', where: ['farm_patch'] },
  cooking: { use: 'Food heals you in a fight; better food heals more.', where: ['range', 'fire'] },
  smithing: { use: 'Smelt ore into bars at a furnace, then forge weapons and armour at an anvil.', where: ['furnace', 'anvil'] },
  crafting: { use: 'Jewellery, pottery and leather armour.', where: ['crafting_table'] },
  fletching: { use: 'Bows, arrows, staves and wands from logs (you need a knife).', where: ['fletching_bench'] },
  herblore: { use: 'Potions that boost you in a fight for several minutes.', where: ['apothecary_table'] },
  firemaking: { use: 'Light a fire anywhere to cook on (use logs from your bag; you need a tinderbox).' },
  thieving: { use: 'Coins, food and gems, stolen from market stalls (and pockets).' },
  agility: { use: 'Restores run energy faster and earns Marks of grace.' },
};
export const GUIDE_SKILLS = Object.keys(SKILL_GUIDES);

/** Every entry for a skill: { level, label, detail, objIds? } sorted by level. */
export function guideEntries(skill) {
  const out = [];
  const add = (level, label, detail, objIds) => out.push({ level: level || 1, label, detail, objIds });
  if (skill === 'woodcutting' || skill === 'mining' || skill === 'thieving') {
    for (const [id, d] of Object.entries(OBJECTS)) {
      if (d.skill !== skill || d.type === 'hunt') continue;
      add(d.level, d.name, d.gives ? `Gives ${name(d.gives)}` : d.loot ? `Loot: ${d.loot.filter((l) => l.id !== 'coins').map((l) => name(l.id)).slice(0, 3).join(', ')}, coins` : '', [id]);
    }
  } else if (skill === 'fishing') {
    for (const [id, d] of Object.entries(OBJECTS)) {
      if (d.type !== 'fishing') continue;
      for (const c of d.catches || []) add(c.level, name(c.id), `${d.name}`, [id]);
    }
  } else if (skill === 'hunter') {
    for (const [id, h] of Object.entries(HUNT)) add(h.level, h.name, `Catches ${(h.gives || []).map((g) => name(g.id)).join(', ')}`, [id]);
  } else if (skill === 'farming') {
    for (const c of CROPS) add(c[2], c[1], `Plant ${name(`${c[0]}_seed`)} in a farm patch`, ['farm_patch']);
  } else if (skill === 'cooking') {
    for (const [raw, c] of Object.entries(COOKING)) add(c.level, name(c.result), `From ${name(raw)}`, ['range', 'fire']);
    for (const d of DISHES) add(d.level, name(d.result), `Dish: ${d.inputs.map((i) => name(i.id)).join(', ')}`, ['range']);
  } else if (skill === 'smithing') {
    for (const s of SMELT) add(s.level, name(s.result), `Smelt ${s.inputs.map((i) => `${i.qty} ${name(i.id)}`).join(' + ')}`, ['furnace']);
    for (const s of SMITH) add(s.level, name(s.result), `Forge from ${s.barCount} ${name(s.bar)}`, ['anvil']);
  } else if (skill === 'crafting') {
    for (const r of [...CRAFT, ...HIDE_CRAFT]) add(r.level, name(r.result), `From ${r.inputs.map((i) => `${i.qty} ${name(i.id)}`).join(' + ')}`, ['crafting_table']);
  } else if (skill === 'fletching') {
    for (const r of FLETCH) add(r.level, `${r.qty > 1 ? `${r.qty} ` : ''}${name(r.result)}`, `From ${r.inputs.map(([id, q]) => `${q} ${name(id)}`).join(' + ')}`, ['fletching_bench']);
  } else if (skill === 'herblore') {
    for (const [id, p] of Object.entries(POTIONS)) add(p.level, p.name, `From ${p.inputs.map(([i, q]) => `${q} ${name(i)}`).join(' + ')}`, ['apothecary_table']);
  } else if (skill === 'firemaking') {
    for (const [id, it] of Object.entries(ITEMS)) if (it.tags?.includes('log')) add(it.firemaking, it.name, `Burn for ${it.fmXp || 0} xp`);
  } else if (skill === 'agility') {
    for (const id of objsOf((d) => d.type === 'agility')) add(OBJECTS[id].level, OBJECTS[id].name, OBJECTS[id].verb, [id]);
  }
  return out.sort((a, b) => a.level - b.level);
}
