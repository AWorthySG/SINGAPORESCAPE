// Skill guides: for each skill, what it's for, where it's done, and every
// thing you can gather or make with the level it needs; and the Resources
// index, which says for any item where it comes from and what it goes into.
// All of it is built from the game data (objects, recipes, drop tables,
// shops), so a new tree, recipe, crop or monster drop shows up here on its
// own. Kept free of the DOM: src/ui/skillguideui.js draws it, and the tests
// check it headlessly (tests/skillguide.test.mjs).
import { OBJECTS } from '../data/objects.js';
import { NPCS, RARE_DROP_TABLE, getNpc } from '../data/npcs.js';
import { ITEMS, getItem } from '../data/items.js';
import { SMELT, SMITH } from '../data/smithing.js';
import { DISHES } from '../data/cooking.js';
import { CRAFT } from '../data/crafting.js';
import { CROPS, POTIONS, FLETCH, HUNT, HIDE_CRAFT, cropFor } from '../data/trades.js';
import { CONSTRUCT } from '../data/construction.js';
import { HOME_UPGRADES } from './home.js';
import { ISLAND_LIFE, LANDINGS, PATTERNS, PHOTO_ASSIGNMENTS, TUNES, VOYAGES } from '../data/islandlife.js';
import { MUSIC_PROJECTS, musicTuneChart } from '../data/islandmusic.js';
import { PHOTO_WALKS } from '../data/photowalks.js';
import { PIANO_SCORES } from '../data/piano.js';
import { SAILING_PRACTICE } from '../data/sailing.js';
import { TEXTILE_PROJECTS } from '../data/textiles.js';
import { SIGNATURE, ORDER_BY_ID, STALL_RENT } from '../data/hawkering.js';
import { SHOPS } from '../data/shops.js';
import { CLUE_TIERS } from '../data/clues.js';
import { SPELLS, spellsFor } from '../data/magic.js';
import { PRAYERS } from '../data/prayers.js';
import { PERK_TRACKS, PERK_EVERY } from '../data/perks.js';
import { SLAYER_TASKS, SLAYER_REWARDS } from '../data/slayer.js';
import { LIFE_STAGES, LIFE_STAGES_ADV, LIFE_STAGES_WILD } from '../data/lifeskills.js';
import { BONE_IDS, boneXp, ALTAR_XP_MULT } from '../data/bones.js';
import { COOKING, GEM_TABLE, HERB_FORAGE, FISH_TOOL_NAME, TREE_LOGS_MIN, TREE_LOGS_MAX } from './skilling.js';
import { CODEX_IDS, dropChances, codexHabitats } from './codex.js';
import { DIVE_SPOT_BY_ID, PEARL_GRADES } from '../data/diving.js';
import { DIG_SITE_BY_ID, RELIC_CHANCE, restoreRecipes } from '../data/archaeology.js';
import { CULL_GOODS, TOKEN_SHOP } from './culling.js';
import { materialKind, materialPoints, materialFeedXp } from './materials.js';
import { goodsKind, goodsPoints } from './offerings.js';
import { isSalvageable } from './salvage.js';

const name = (id) => (ITEMS[id] ? getItem(id).name : id);
const objsOf = (pred) => Object.entries(OBJECTS).filter(([, d]) => pred(d)).map(([id]) => id);
const TICK_S = 0.6;

// One line on why each skill matters, and the objects to walk to.
export const SKILL_GUIDES = {
  ...Object.fromEntries(ISLAND_LIFE.map((s) => [s.id, { use: s.desc }])),
  woodcutting: { use: 'Logs feed Firemaking and Fletching (bows, arrows, staves). From level 100, groves of rare trees in the far regions give the endgame logs. Each tree holds 10 to 20 logs, and about one swing in 20 brings the whole tree down at once: ten times the logs left in it, with XP for every log.' },
  mining: { use: 'Ore is smelted into bars for Smithing, and gems and gold go to Crafting. From level 100, rare veins in the far regions give the endgame ores. Each rock holds 10 to 20 ores, and about one swing in 20 breaks the whole seam free at once: ten times the ore left in it, with XP for every ore.' },
  fishing: { use: 'Raw fish are cooked into food that heals you in a fight. Each kind of spot holds one fish, so where you fish picks the fish: the list below says where each is. From level 100, rare spots in the far regions give the endgame fish. Now and then a school of fish (a dark swirl on the water) visits a spot near you for half a minute: fish there and you may net the whole school, 250 to 751 fish at once. And at any spot, about one catch in 20 turns out to be a smaller school of the fish you hooked: 10 to 140 at once.' },
  hunter: { use: 'Pelts, skins and hides become armour; meat is cooked into food. From level 100, hunting grounds in the far regions give the catches for the endgame brews. About one catch in 20 springs the trap on a whole flock, nest or herd at once: 10 to 140 catches, with XP for every one.' },
  diving: { use: 'Follow the Shell shallows signs from Sentosa MRT and stand on a mask tile by the water. Dive the reefs for shells, sea glass and coral (shops buy them), and pearls from the oyster beds for pearl jewellery. A dive lasts your breath, then you come up for air: your level and dive gear (a snorkel, a mask, fins and on up) let you stay down longer. From level 100, reefs in the far regions. About one dive in 20 finds a whole reef bed at once: 10 to 140 catches, with XP for each, and now and then a sunken chest.' },
  archaeology: { use: 'Start at the museum teaching trench in Chinatown. Dig the island\'s heritage sites for pottery shards, old coins and other finds, and now and then an encrusted relic. Clean relics at the restoration bench in Chinatown (you need a soft brush), then give the restored pieces to Curator Siti beside it: each site\'s three pieces make a museum set, with coins, XP, a title, and relics a little likelier from then on. You can dig with your hands; a trowel makes you faster. Everyday and ancient things only. About one dig in 20 hits a rich layer: 10 to 140 finds at once.', where: ['restoration_bench'] },
  farming: { use: 'Crops are herbs for Herblore and ingredients for hawker dishes. The farm shop sells every seed, the endgame ones too; Gardens by the Bay has more patches. About one harvest in 20 is a record harvest: the patch gives 10 to 140 times its yield again, with XP for every crop.', where: ['farm_patch'] },
  cooking: { use: 'Food heals you in a fight; better food heals more. From level 100 the endgame fish cook into dishes that heal a share of your life, and some boost you too.', where: ['range', 'fire'] },
  smithing: { use: 'Smelt ore into bars at a furnace, then forge weapons, armour and upgrade stones at an anvil. From level 100 you can forge the obsidian to eternal gear.', where: ['furnace', 'anvil'] },
  crafting: { use: 'Jewellery, pottery, leather armour, and refine scrolls and upgrade wards. From level 100 the endgame ores and bars make jewellery for every fighting style, and the Dancer\'s war fans and whips.', where: ['crafting_table'] },
  fletching: { use: 'Bows, arrows, staves and wands from logs (you need a knife). From level 100 the endgame logs make the obsidian to eternal bows, staves, wands, rifles and crossbows.', where: ['fletching_bench'] },
  herblore: { use: 'Potions that boost you in a fight for several minutes. From level 100, endgame crops, Hunter catches and ashes brew far stronger ones.', where: ['apothecary_table'] },
  construction: { use: 'Saw logs into planks at a sawmill, fire clay into bricks at a kiln, and build furniture from planks, nails (hammered from bars with Smithing) and bricks at a workbench. All three stand at the lumber yards in Kampong Glam and by Kranji Village, where there’s also a public anvil. Then build up your kampong home room by room in its Build window: each build pays a lump of Construction XP and gives your home a perk. From level 100 the endgame logs and bars make the finest furniture.', where: ['sawmill', 'kiln', 'workbench'] },
  hawkering: { use: `Rent your own stall at the Marina Bay hawker centre (${STALL_RENT.toLocaleString('en-GB')} coins) and serve the townsfolk who queue: each wants a dish you have (from your pack, or your bank), pays about a shop's price plus a tip, and gives Hawkering XP. Serve before their patience runs out; a long streak brings bigger tips and the stall's reputation grows. Turn on auto-serve (the auto gather switch) to keep serving from what you carry. Levels bring more counters, faster service, VIP regulars and signature dishes cooked at the stall's wok; from level 100 customers ask for the endgame dishes. Your stall's Menu tab lists every order.`, where: ['hawker_counter'] },
  firemaking: { use: 'Light a fire anywhere to cook on (use logs from your bag; you need a tinderbox). The endgame logs leave ashes, which Herblore and the Offering Shrine take.' },
  thieving: { use: 'Pick pockets for coins, or steal from stalls for food, gems, spices, dyes, seeds, fish and jewellery. From level 100, pick rich marks’ pockets and crack locked chests in the far regions.' },
  agility: { use: 'Obstacle courses for XP and Marks of grace; powers the Dancer. From level 100, six long courses in the far regions.' },
  // Fighting skills: a short reference (perks, gear and where to train).
  attack: { use: 'Melee power: how hard your melee hits are. Every 20 levels unlocks a passive perk, and higher levels let you wield better weapons.', combat: true },
  defence: { use: 'Shrugs off hits and unlocks armour. Every 20 levels unlocks a passive perk that helps in every fighting style.', combat: true },
  ranged: { use: 'Bow, gun and crossbow damage. Every 20 levels unlocks a passive perk, and higher levels unlock better bows and hide armour.', combat: true },
  magic: { use: 'Spell power. Every 20 levels unlocks a passive perk, and higher levels unlock better staves and robes.', combat: true },
  hitpoints: { use: 'Your life. It rises as you deal damage in any style. Eat food to heal: the better the food, the more it heals.', combat: true },
  prayer: { use: `Unlocks Blessings (always-on, in slots that grow with your level) and powers the Faith Burst. Bury bones anywhere, or offer them at an A-Worthy Monument for ${ALTAR_XP_MULT}x XP.`, combat: true, where: ['shrine'] },
  slayer: { use: 'Tasks from Slayer Master Rajan. On task you hit harder and sometimes get a second helping of loot; points buy rewards.', combat: true },
};
export const ACTIVITY_SKILLS = ISLAND_LIFE.map((s) => s.id);
export const GUIDE_SKILLS = Object.keys(SKILL_GUIDES);
export const GATHER_SKILLS = ['woodcutting', 'mining', 'fishing', 'hunter', 'diving', 'archaeology', 'farming', 'thieving', 'agility'];
export const MAKE_SKILLS = ['smithing', 'cooking', 'crafting', 'fletching', 'herblore', 'firemaking', 'construction', 'hawkering'];
export const COMBAT_SKILLS = ['attack', 'defence', 'ranged', 'magic', 'hitpoints', 'prayer', 'slayer'];

// Tool tags, as the gathering and making code checks them (game.hasTool).
export const TOOL_NAMES = { axe: 'an axe', pickaxe: 'a pickaxe', hammer: 'a hammer', knife: 'a knife', chisel: 'a chisel', tinderbox: 'a tinderbox', snare: 'a hunting snare', divegear: 'dive gear', trowel: 'a trowel', brush: 'a soft brush', ...Object.fromEntries(Object.entries(FISH_TOOL_NAME).map(([k, v]) => [k, `a ${v}`])) };
// What a bird's nest holds (Game.openNest rolls the same table).
const NEST_TABLE = [{ id: 'coins', weight: 50 }, { id: 'sapphire', weight: 18 }, { id: 'emerald', weight: 12 }, { id: 'ruby', weight: 7 }, { id: 'diamond', weight: 3 }];

const share = (list, e) => (e.weight || 0) / (list.reduce((s, x) => s + (x.weight || 0), 0) || 1);
const respawnText = (ticks) => (ticks ? `respawns in ${Math.round(ticks * TICK_S)}s` : 'never runs dry');

// ---------------- Gathering ----------------

let _gather = null;
/** Every gathering source, one per node kind: { key, skill, name, level, xp,
 *  gives: [{ id, min, max, chance }], tool, respawn (ticks), lasts (gathers
 *  before it runs dry, on average), objIds, note }. */
export function gatherSources() {
  if (_gather) return _gather;
  const out = [];
  const add = (s) => out.push({ min: 1, ...s, level: s.level || 1 });
  for (const [id, d] of Object.entries(OBJECTS)) {
    if (d.type === 'tree') {
      add({ key: id, skill: 'woodcutting', name: d.name, level: d.level, xp: d.xp, tool: 'axe', respawn: d.respawn, lasts: d.depleteChance ? (TREE_LOGS_MIN + TREE_LOGS_MAX) / 2 : 0, objIds: [id],
        gives: [{ id: d.gives, chance: 1 }, { id: 'birds_nest', chance: 0.008, rare: true }, ...HERB_FORAGE.map((h) => ({ id: h, chance: 0.03 / HERB_FORAGE.length, rare: true }))],
        note: d.night ? '+25% XP at night' : '' });
    } else if (d.type === 'rock') {
      const gives = d.gemRock ? GEM_TABLE.map((g) => ({ id: g.id, chance: share(GEM_TABLE, g) }))
        : [{ id: d.gives, chance: 1 }, ...GEM_TABLE.map((g) => ({ id: g.id, chance: 0.012 * share(GEM_TABLE, g), rare: true }))];
      add({ key: id, skill: 'mining', name: d.name, level: d.level, xp: d.xp, tool: 'pickaxe', respawn: d.respawn, lasts: d.depleteChance ? Math.round(1 / d.depleteChance) : 0, objIds: [id], gives,
        note: d.gemRock ? 'Each swing chips out one gem' : 'A rare gem now and then (more often at higher level)' });
    } else if (d.type === 'fishing') {
      const all = d.catches || [];
      for (const c of all) {
        add({ key: `${id}:${c.id}`, skill: 'fishing', name: name(c.id), spot: d.name, level: c.level, xp: c.xp, tool: d.tool, respawn: 0, objIds: [id],
          gives: [{ id: c.id, chance: all.length > 1 ? share(all, c) : 1 }], note: `${d.name}${d.night ? ' (+25% XP at night)' : ''}${all.length > 1 ? ': the share is of all its catches once you can land them all' : ''}` });
      }
    } else if (d.type === 'dive') {
      // A reef holds one catch, as a fishing spot does; oyster beds give pearls too (diving.js).
      const c = d.catches[0], p = DIVE_SPOT_BY_ID[id]?.pearl;
      const pearls = p ? PEARL_GRADES.map((pid, i) => ({ id: pid, chance: p.chance * (p.w[i] || 0) / p.w.reduce((a, b) => a + b, 0), rare: true })).filter((g) => g.chance > 0) : [];
      add({ key: id, skill: 'diving', name: name(c.id), spot: d.name, level: c.level, xp: c.xp, respawn: 0, objIds: [id],   // (no tool needed: you can free-dive)
        gives: [{ id: c.id, chance: 1 }, ...pearls], note: `${d.name}${d.night ? ' (+25% XP at night)' : ''}` });
    } else if (d.type === 'dig') {
      // A site turns up one material, as a fishing spot one fish, and its relics now and then (archaeology.js).
      const c = d.catches[0], site = DIG_SITE_BY_ID[d.site || id], w = site ? site.relics.reduce((a, r) => a + r.weight, 0) : 1;
      add({ key: id, skill: 'archaeology', name: name(c.id), spot: d.name, level: c.level, xp: c.xp, respawn: 0, objIds: [id],   // (no tool needed: dig with your hands)
        gives: [{ id: c.id, chance: 1 }, ...(site?.relics || []).map((r) => ({ id: r.encrusted, chance: RELIC_CHANCE * r.weight / w, rare: true }))],
        note: `${d.name}: ${site?.setName || ''} set` });
    } else if (d.type === 'stall') {
      add({ key: id, skill: 'thieving', name: d.name, level: d.level, xp: d.xp, respawn: d.respawn, objIds: [id],
        gives: d.loot.map((l) => ({ id: l.id, min: l.min || 1, max: l.max || 1, chance: share(d.loot, l) })), note: d.sure ? `${Math.round(d.sure * 100)}% success at level ${d.level}` : '' });
    } else if (d.type === 'agility' && d.skill === 'agility') {
      add({ key: id, skill: 'agility', name: d.name, level: d.level, xp: d.xp, objIds: [id],
        gives: d.markChance ? [{ id: 'mark_of_grace', chance: d.markChance }] : [], note: d.verb ? `${d.verb}${d.finish ? ' (ends a lap: lap bonus)' : ''}` : '' });
    }
  }
  for (const [id, h] of Object.entries(HUNT)) {
    // (XP as paid: the trap's object, with the gathering XP tuning in objects.js.)
    add({ key: id, skill: 'hunter', name: h.name, level: h.level, xp: OBJECTS[id]?.xp ?? h.xp, tool: 'snare', respawn: h.respawn, lasts: Math.round(1 / h.depleteChance), objIds: [id],
      gives: (h.gives || []).map((g) => ({ id: g.id, min: g.min || 1, max: g.max || 1, chance: g.chance ?? 1 })), note: h.night ? '+25% XP at night' : '' });
  }
  // The endgame marks: townsfolk with pockets worth picking (and anyone else's, for coins).
  add({ key: 'pickpocket', skill: 'thieving', name: 'Pickpocket townsfolk', level: 1, xp: 11, gives: [{ id: 'coins', min: 4, max: 13, chance: 1 }], note: 'Press P beside anyone in town; XP and coins grow with level' });
  for (const [id, n] of Object.entries(NPCS)) {
    if (!n.thieving) continue;
    add({ key: `npc:${id}`, skill: 'thieving', name: n.name, npcId: id, level: n.thieving.level, xp: n.thieving.xp,
      gives: n.thieving.loot.map((l) => ({ id: l.id, min: l.min || 1, max: l.max || 1, chance: share(n.thieving.loot, l) })), note: 'Pickpocket' });
  }
  _gather = out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return _gather;
}

// ---------------- Recipes ----------------

const STATION = { restore: ['restoration_bench'], smelt: ['furnace'], smith: ['anvil'], cook: ['range', 'fire'], craft: ['crafting_table'], fletch: ['fletching_bench'], brew: ['apothecary_table'], farm: ['farm_patch'], burn: [], bury: [],
  saw: ['sawmill', 'home_workbench'], kiln: ['kiln'], build: ['workbench', 'home_workbench'],
  wok: ['hawker_counter'] };
let _recipes = null;
/** Every recipe in the game, in one shape: { key, skill, kind, label, output:
 *  { id, qty } | null, outputs (several, for crops), inputs: [{ id, qty }],
 *  level, xp, stations: [objId], tool, note }. `kind` says which list it
 *  came from (smelt, smith, cook, dish, craft, fletch, brew, farm, burn, bury). */
export function allRecipes() {
  if (_recipes) return _recipes;
  const out = [];
  const add = (r) => out.push({ key: `${r.kind}:${out.length}`, stations: STATION[r.station || r.kind] || [], tool: null, note: '', ...r, level: r.level || 1 });
  for (const s of SMELT) add({ skill: 'smithing', kind: 'smelt', output: { id: s.result, qty: 1 }, inputs: s.inputs.map((i) => ({ id: i.id, qty: i.qty })), level: s.level, xp: s.xp, note: s.successChance ? `${Math.round(s.successChance * 100)}% of smelts work` : '' });
  for (const s of SMITH) add({ skill: 'smithing', kind: 'smith', output: { id: s.result, qty: s.qty || 1 }, inputs: [{ id: s.bar, qty: s.barCount }], level: s.level, xp: s.xp, tool: 'hammer' });
  for (const [raw, c] of Object.entries(COOKING)) {
    const heal = ITEMS[c.result]?.healPct ? `heals ${Math.round(ITEMS[c.result].healPct * 100)}% of your life` : ITEMS[c.result]?.heal ? `heals ${ITEMS[c.result].heal}` : '';
    add({ skill: 'cooking', kind: 'cook', output: { id: c.result, qty: 1 }, inputs: [{ id: raw, qty: 1 }], level: c.level, xp: c.xp, note: [heal, c.burnStop ? `stops burning at ${c.burnStop}` : ''].filter(Boolean).join(', ') });
  }
  for (const d of DISHES) add({ skill: 'cooking', kind: 'dish', station: 'cook', output: { id: d.result, qty: 1 }, inputs: d.inputs.map((i) => ({ id: i.id, qty: i.qty })), level: d.level, xp: d.xp, note: 'never burns' });
  // CRAFT already holds the hide recipes; add any that ever drift out of it.
  for (const r of [...CRAFT, ...HIDE_CRAFT.filter((h) => !CRAFT.includes(h))]) add({ skill: 'crafting', kind: 'craft', output: { id: r.result, qty: r.qty || 1 }, inputs: r.inputs.map((i) => ({ id: i.id, qty: i.qty })), level: r.level, xp: r.xp, tool: r.tool || null });
  for (const r of FLETCH) add({ skill: 'fletching', kind: 'fletch', output: { id: r.result, qty: r.qty || 1 }, inputs: r.inputs.map(([id, qty]) => ({ id, qty })), level: r.level, xp: r.xp, tool: r.tool || null });
  for (const r of CONSTRUCT) add({ skill: 'construction', kind: r.at[0], output: { id: r.result, qty: r.qty || 1 }, inputs: r.inputs.map(([id, qty]) => ({ id, qty })), level: r.level, xp: r.xp, tool: r.tool || null });
  for (const r of SIGNATURE) add({ skill: 'hawkering', kind: 'wok', output: { id: r.result, qty: r.qty || 1 }, inputs: r.inputs.map(([id, qty]) => ({ id, qty })), level: r.level, xp: r.xp, note: 'a signature dish, cooked at your stall' });
  for (const r of restoreRecipes()) add({ skill: 'archaeology', kind: 'restore', output: { id: r.result, qty: 1 }, inputs: r.inputs.map(([id, qty]) => ({ id, qty })), level: r.level, xp: r.xp, tool: 'brush' });
  for (const [id, p] of Object.entries(POTIONS)) add({ skill: 'herblore', kind: 'brew', output: { id, qty: 1 }, inputs: p.inputs.map(([i, qty]) => ({ id: i, qty })), level: p.level, xp: p.xp, label: p.name });
  for (const c of CROPS.map((x) => cropFor(x[0]))) add({ skill: 'farming', kind: 'farm', output: { id: c.id, qty: c.yield[0], max: c.yield[1] }, inputs: [{ id: c.seed, qty: 1 }], level: c.level, xp: c.plantXp, harvestXp: c.harvestXp, label: c.name,
    note: `grows in ${Math.round(c.grow * TICK_S / 60 * 10) / 10} min, ${c.yield[0]}-${c.yield[1]} a harvest` });   // the harvest XP shows as a badge (skillguideui.js)
  for (const [id, it] of Object.entries(ITEMS)) if (it.tags?.includes('log')) add({ skill: 'firemaking', kind: 'burn', output: it.ash ? { id: it.ash, qty: 1 } : null, inputs: [{ id, qty: 1 }], level: it.firemaking, xp: it.fmXp || 0, tool: 'tinderbox', label: it.name, note: 'light it anywhere' });
  for (const id of BONE_IDS) add({ skill: 'prayer', kind: 'bury', output: null, inputs: [{ id, qty: 1 }], level: 1, xp: boneXp(id), label: name(id), note: `${ALTAR_XP_MULT}x the XP offered at a monument` });   // (a multiple: the row's badge shows the real XP)
  _recipes = out;
  return _recipes;
}
/** A recipe's display name: what it makes. */
export const recipeLabel = (r) => r.label || `${r.output?.qty > 1 ? `${r.output.qty} ` : ''}${name(r.output?.id)}`;
/** Recipes for one skill, by level. */
export const recipesFor = (skill) => allRecipes().filter((r) => r.skill === skill).sort((a, b) => a.level - b.level || recipeLabel(a).localeCompare(recipeLabel(b)));
const KIND_TITLE = { restore: 'Restoring', smelt: 'Smelting', smith: 'Smithing', cook: 'Cooking', dish: 'Hawker dishes', craft: 'Crafting', fletch: 'Fletching', brew: 'Herblore', farm: 'Farming', burn: 'Firemaking', bury: 'Prayer',
  saw: 'Sawmill', kiln: 'Kiln', build: 'Workbench',
  wok: 'Stall wok' };
export const recipeKindTitle = (k) => KIND_TITLE[k] || k;

/** Can the player make it? { levelOk, inputs: [{ id, qty, bag, bank }], ok (level and every input in the bag),
 *  okWithBank (with what's in the bank too), times (how many from the bag) }. */
export function canMake(game, r) {
  const level = game?.skills?.level?.(r.skill) || 1;
  const inputs = r.inputs.map((i) => ({ ...i, bag: game?.inventory?.count?.(i.id) || 0, bank: game?.bank?.count?.(i.id) || 0 }));
  const levelOk = level >= r.level;
  const tool = !r.tool || !!game?.hasTool?.(r.tool);
  const times = Math.min(...inputs.map((i) => Math.floor(i.bag / i.qty)));
  return { levelOk, tool, inputs, times: Number.isFinite(times) ? times : 0,
    ok: levelOk && inputs.every((i) => i.bag >= i.qty), okWithBank: levelOk && inputs.every((i) => i.bag + i.bank >= i.qty) };
}

// ---------------- The old flat list (kept: the tests and older callers use it) ----------------

const givesText = (g) => g.filter((x) => !x.rare && x.id !== 'coins').map((x) => name(x.id)).slice(0, 4).join(', ');
/** Every entry for a skill: { level, label, detail, objIds?, xp, source?, recipe? } sorted by level. */
const ISLAND_ENTRIES = {
  sailing: [
    ...VOYAGES.map((r) => ({ ...r, name: LANDINGS[r.from].name + ' → ' + LANDINGS[r.to].name, detail: 'Read the conditions at each marker.' })),
    ...SAILING_PRACTICE.map((p) => ({ ...p, detail: LANDINGS[p.from].name + ' · ' + p.detail })),
  ],
  photography: [...PHOTO_ASSIGNMENTS, ...PHOTO_WALKS.map((walk) => ({ ...walk, detail: `Visit ${walk.stops.length} subjects for repeatable practice XP.` }))],
  textile_arts: [
    ...PATTERNS.map((p) => ({ ...p, detail: `Print a cotton scarf with ${name(p.dye)} and 8 coins.${p.reward ? ` Fill its Chinatown order for a ${name(p.reward).toLowerCase()}.` : ''}` })),
    ...TEXTILE_PROJECTS.map((p) => ({ ...p, detail: p.free ? 'Try wax resist at the Kampong Glam loom.' : 'Make a piece for your Kranji home at the Chinatown workshop.' })),
  ],
  music: [
    ...TUNES.map((t) => ({ ...t, detail: `Play at your own pace at a hawker stage for XP and ${t.tip} coins.` })),
    ...PIANO_SCORES.map((s) => ({ ...s, detail: 'Play the piano score at a Music stage to earn XP.' })),
    ...['variation', 'duet'].map((style) => ({ ...musicTuneChart('kopi', style), detail: 'Play a different version of a tune you have learned.' })),
    ...MUSIC_PROJECTS.map((set) => ({ ...set, detail: 'Perform a set of tunes you have played before.' })),
  ],
};
export function guideEntries(skill) {
  const activities = ISLAND_ENTRIES[skill];
  if (activities) return activities.map(({ name: label, detail, level, xp }) => ({ level, label, detail, xp })).sort((a, b) => a.level - b.level);
  const out = [];
  if (GATHER_SKILLS.includes(skill) && skill !== 'farming') {
    for (const s of gatherSources()) {
      if (s.skill !== skill) continue;
      let detail;
      if (skill === 'fishing' || skill === 'diving' || skill === 'archaeology') detail = s.note;
      else if (skill === 'agility') detail = s.note;
      else if (skill === 'thieving') detail = s.npcId ? `Pickpocket: ${s.gives.map((g) => name(g.id)).join(', ')}` : `Loot: ${[givesText(s.gives), 'coins'].filter(Boolean).join(', ')}`;
      else detail = `${skill === 'hunter' ? 'Catches' : 'Gives'} ${givesText(s.gives)}${s.note.includes('night') ? ' (+25% XP at night)' : ''}`;
      out.push({ level: s.level, label: s.name, detail, objIds: s.objIds, xp: s.xp, source: s });
    }
  } else if (skill === 'farming') {
    for (const r of recipesFor('farming')) out.push({ level: r.level, label: r.label, detail: `Plant ${name(r.inputs[0].id)} in a farm patch`, objIds: ['farm_patch'], xp: r.xp, recipe: r });
  } else {
    // Fighting skills: the perks on their track, and their spells, prayers, tasks or food.
    if (SKILL_GUIDES[skill]?.combat) {
      for (const p of perkLadder(skill)) out.push({ level: p.level, label: p.name, detail: `Perk: ${p.desc}` });
      for (const r of combatExtras(skill)?.rows || []) out.push({ level: r.level || 1, label: r.name, detail: r.text });
    }
    for (const r of recipesFor(skill)) {
      const ins = r.inputs.map((i) => `${i.qty} ${name(i.id)}`).join(' + ');
      let detail;
      if (r.kind === 'cook') detail = `From ${name(r.inputs[0].id)}${r.note.includes('%') ? `, ${r.note.split(',')[0]}` : ''}`;
      else if (r.kind === 'dish') detail = `Dish: ${r.inputs.map((i) => name(i.id)).join(', ')}`;
      else if (r.kind === 'smelt') detail = `Smelt ${ins}`;
      else if (r.kind === 'smith') detail = `Forge from ${ins}`;
      else if (r.kind === 'saw') detail = `Saw ${ins}`;
      else if (r.kind === 'kiln') detail = `Fire ${ins}`;
      else if (r.kind === 'build') detail = `Build from ${ins}`;
      else if (r.kind === 'wok') detail = `Cook at your stall: ${ins}`;
      else if (r.kind === 'burn') detail = `Burn for ${r.xp} xp${r.output ? `, leaves ${name(r.output.id)}` : ''}`;
      else if (r.kind === 'bury') detail = `Bury for ${r.xp} xp; ${r.note}`;
      else detail = `From ${ins}`;
      out.push({ level: r.level, label: recipeLabel(r), detail, objIds: r.stations.length ? r.stations : undefined, xp: r.xp, recipe: r });
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

// ---------------- Where things are ----------------

/** The regions each kind of world object stands in, read from where the world
 *  actually placed them (as the codex does for creatures). Worked out once per
 *  game: nodes and stations never move. Map objId -> [region names]. */
export function objectRegions(game) {
  if (game?._objRegions) return game._objRegions;
  const m = new Map();
  for (const o of game?.world?.objects || []) {
    const z = game.world.zoneAt?.(o.x, o.y)?.name;
    if (!z) continue;
    if (!m.has(o.objId)) m.set(o.objId, new Set());
    m.get(o.objId).add(z);
  }
  const order = (game?.world?.zones || []).map((z) => z.name);
  const out = new Map([...m].map(([id, zs]) => [id, [...zs].sort((a, b) => order.indexOf(a) - order.indexOf(b))]));
  if (game) game._objRegions = out;
  return out;
}
/** The world's groves (groves.js), lowest tree first, for the Woodcutting
 *  guide (or with kind 'quarry', its quarries for the Mining guide): [{ id, name, objId, tree, level, region, count, x, y, text }]. */
export function groveList(game, kind = 'grove') {
  return (game?.world?.groves || []).filter((g) => (g.kind || 'grove') === kind).map((g) => {
    const d = OBJECTS[g.objId] || {};
    const tree = d.name || g.objId;
    return { id: g.id, name: g.name, objId: g.objId, tree, level: d.level || 1, region: g.region, count: g.count, x: g.cx, y: g.cy,
      text: `${g.name}: ${g.count} ${tree.toLowerCase()}s (level ${d.level || 1}), ${g.region}` };
  }).sort((a, b) => a.level - b.level);
}
/** The world's fishing spots, one kind to each fish (fishspots.js), lowest
 *  first, for the Fishing guide: [{ objId, name, fish, level, tool, regions,
 *  count, text }]. Only kinds the world has placed (not a world event's shoal). */
export function fishSpotList(game) {
  const count = new Map();
  for (const o of game?.world?.objects || []) {
    if (o.worldEvent || OBJECTS[o.objId]?.type !== 'fishing') continue;
    count.set(o.objId, (count.get(o.objId) || 0) + 1);
  }
  return [...count].map(([objId, n]) => {
    const d = OBJECTS[objId], c = d.catches[0], regions = regionsOf(game, [objId]);
    const fish = name(c.id).replace(/^Raw /, ''), tool = FISH_TOOL_NAME[d.tool] || d.tool;
    return { objId, name: d.name, fish, level: c.level, tool, regions, count: n,
      text: `${d.name}: ${fish.toLowerCase()} (level ${c.level}, ${tool}), ${regions.join(', ')}` };
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}
/** The world's reefs, one kind to each catch (diving.js), lowest first, for the
 *  Diving guide: [{ objId, name, catch, level, regions, count, text }]. */
export function diveSpotList(game) {
  const count = new Map();
  for (const o of game?.world?.objects || []) {
    if (o.worldEvent || OBJECTS[o.objId]?.type !== 'dive') continue;
    count.set(o.objId, (count.get(o.objId) || 0) + 1);
  }
  return [...count].map(([objId, n]) => {
    const d = OBJECTS[objId], c = d.catches[0], regions = regionsOf(game, [objId]), what = name(c.id);
    return { objId, name: d.name, catch: what, level: c.level, regions, count: n,
      text: `${d.name}: ${what.toLowerCase()} (level ${c.level}), ${regions.join(', ')}` };
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}
/** The world's dig sites, one kind to each material (archaeology.js), lowest
 *  first, for the Archaeology guide: [{ objId, name, find, set, level, regions, count, text }]. */
export function digSiteList(game) {
  const count = new Map();
  for (const o of game?.world?.objects || []) {
    if (o.worldEvent || OBJECTS[o.objId]?.type !== 'dig') continue;
    count.set(o.objId, (count.get(o.objId) || 0) + 1);
  }
  return [...count].map(([objId, n]) => {
    const d = OBJECTS[objId], c = d.catches[0], regions = regionsOf(game, [objId]), find = name(c.id), set = DIG_SITE_BY_ID[d.site || objId]?.setName || '';
    return { objId, name: d.name, find, set, level: c.level, regions, count: n,
      text: `${d.name}: ${find.toLowerCase()} (level ${c.level}), ${regions.join(', ')}` };
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}
/** Regions for several object kinds together, without repeats. */
export function regionsOf(game, objIds = []) {
  const map = objectRegions(game), seen = new Set();
  for (const id of objIds) for (const z of map.get(id) || []) seen.add(z);
  return [...seen];
}
/** The nearest placed object of these kinds, or null: { x, y, dist, objId }. */
export function nearestObject(game, objIds = []) {
  const p = game?.player;
  if (!p) return null;
  const ids = new Set(objIds);
  let best = null, bd = Infinity;
  for (const o of game.world?.objects || []) {
    if (!ids.has(o.objId)) continue;
    const d = Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y));
    if (d < bd) { bd = d; best = { x: o.x, y: o.y, dist: d, objId: o.objId }; }
  }
  return best;
}

// ---------------- Items: where from, what for ----------------

let _drops = null;
/** Monster drops by item: Map id -> [{ npcId, name, level, chance, boss, min, max }], likeliest first. */
function dropIndex() {
  if (_drops) return _drops;
  _drops = new Map();
  for (const npcId of CODEX_IDS) {
    const def = getNpc(npcId);
    for (const d of dropChances(def)) {
      if (!_drops.has(d.id)) _drops.set(d.id, []);
      _drops.get(d.id).push({ npcId, name: def.name, level: def.level, chance: d.chance, boss: !!def.boss, min: d.min, max: d.max });
    }
  }
  for (const list of _drops.values()) list.sort((a, b) => b.chance - a.chance || a.level - b.level);
  return _drops;
}

/** Every way to get an item: [{ kind, ... }]. Kinds: node (a gathering source),
 *  recipe, drop (a monster), raredrop, shop, nest, casket, cull, token, textileOrder. */
export function itemSources(id) {
  const out = [];
  for (const s of gatherSources()) {
    const g = s.gives.find((x) => x.id === id);
    if (g) out.push({ kind: 'node', source: s, chance: g.chance, min: g.min || 1, max: g.max || 1, rare: !!g.rare });
  }
  for (const r of allRecipes()) if (r.output?.id === id) out.push({ kind: 'recipe', recipe: r });
  for (const p of PATTERNS) if (p.reward === id) out.push({ kind: 'textileOrder', name: p.name, level: p.level });
  for (const d of dropIndex().get(id) || []) out.push({ kind: 'drop', ...d });
  const rare = RARE_DROP_TABLE.find((e) => e.id === id);
  if (rare) out.push({ kind: 'raredrop', chance: share(RARE_DROP_TABLE, rare) });
  for (const [shopId, sh] of Object.entries(SHOPS)) {
    if ((sh.stock || []).some((e) => e.id === id)) out.push({ kind: 'shop', shopId, name: sh.name, price: Math.max(1, Math.round((getItem(id).value || 0) * (sh.buyMul ?? 1))) });
  }
  const nest = NEST_TABLE.find((e) => e.id === id);
  if (nest && id !== 'coins') out.push({ kind: 'nest', chance: share(NEST_TABLE, nest) });
  for (const [tier, t] of Object.entries(CLUE_TIERS)) {
    const e = (t.reward || []).find((x) => x.id === id);
    if (e) out.push({ kind: 'casket', tier, chance: share(t.reward, e) });
  }
  const cull = [...Object.entries(CULL_GOODS.family), ...Object.entries(CULL_GOODS.race)].filter(([, list]) => list.some((e) => e.id === id)).map(([k]) => k);
  if (cull.length) out.push({ kind: 'cull', from: cull });
  const tok = TOKEN_SHOP.find((e) => e.id === id);
  if (tok) out.push({ kind: 'token', cost: tok.cost, qty: tok.qty });
  const sl = SLAYER_REWARDS.find((e) => e.id === id);
  if (sl) out.push({ kind: 'slayer', cost: sl.cost, qty: sl.qty });
  return out;
}

let _usedIn = null;
/** Recipes that take an item as an input: Map id -> [recipe]. */
function useIndex() {
  if (_usedIn) return _usedIn;
  _usedIn = new Map();
  for (const r of allRecipes()) for (const i of r.inputs) {
    if (!_usedIn.has(i.id)) _usedIn.set(i.id, []);
    if (!_usedIn.get(i.id).includes(r)) _usedIn.get(i.id).push(r);
  }
  return _usedIn;
}
/** The recipes an item goes into, by skill then level. */
export const recipesUsing = (id) => (useIndex().get(id) || []).slice().sort((a, b) => a.skill.localeCompare(b.skill) || a.level - b.level);

// Quest hand-ins that aren't a life-skill lesson (offerings.js keeps the same list).
const QUEST_ITEMS = { steel_bar: 'The Smith\'s Apprentice', death_rune: 'The Mystic Trial', salmon: 'Island Provisions' };

/** What an item is good for besides recipes: [{ kind, text }]. Kinds: eat,
 *  drink, wear, tool, spell, prayer, enchant, mastery, quest, open, shrine. */
export function itemOtherUses(id) {
  const it = ITEMS[id];
  if (!it) return [];
  const out = [];
  const add = (kind, text) => out.push({ kind, text });
  if (it.healPct) add('eat', `Eat: heals ${Math.round(it.healPct * 100)}% of your life`);
  else if (it.heal) add('eat', `Eat: heals ${it.heal} life`);
  if (POTIONS[id]) add('drink', 'Drink: a boost in a fight for a few minutes');
  if (it.equip) {
    const req = Object.entries(it.equip.req || {}).map(([s, l]) => `${s === 'attack' ? 'Melee' : s[0].toUpperCase() + s.slice(1)} ${l}`).join(', ');
    add('wear', `Wear (${it.equip.slot}${req ? `, needs ${req}` : ''})`);
  }
  if (it.tool) {
    const skills = { axe: 'Woodcutting', pickaxe: 'Mining', hammer: 'Smithing at an anvil, and Construction', knife: 'Fletching', chisel: 'Crafting gems', tinderbox: 'Firemaking', snare: 'Hunter', divegear: 'Diving (more breath)' }[it.tool] || 'Fishing';
    add('tool', `Tool for ${skills}`);
  }
  const spells = SPELLS.filter((s) => s.runes?.[id]);
  if (spells.length) add('spell', `Cast ${spells.map((s) => `${s.name} (Magic ${s.level}, ${s.runes[id]} each)`).join(', ')}`);
  if (id === 'upgrade_stone') add('enchant', 'Pays for enchanting gear (weave bonus powers into it)');
  if (id === 'upgrade_ward') add('enchant', 'Rerolls the three enchantments on offer');
  if (id === 'refine_scroll') add('enchant', 'Pays for one refine attempt (gear from ★1 to ★15)');
  if (id === 'mark_of_grace') add('token', 'Trade for Agility XP');
  if (id === 'birds_nest' || /^reward_casket_/.test(id)) add('open', 'Open it from your pack for loot');
  const mk = materialKind(id);
  // Gear mastery: which gear each kind of material feeds (materials.js feedKind).
  const FEEDS = { bar: 'metal weapons, plate and shields', gem: 'rings, amulets and orbs', log: 'bows, crossbows, staves, wands and fans', hide: 'leather and hide armour, and whips', herb: 'capes, robes and dancewear' };
  if (FEEDS[mk]) add('mastery', `Feeds the mastery of ${FEEDS[mk]} (${materialFeedXp(id).toLocaleString('en-GB')} mastery XP each)`);
  for (const [stages, qname] of [[LIFE_STAGES, 'Trades of the Island'], [LIFE_STAGES_ADV, 'Master of Trades'], [LIFE_STAGES_WILD, 'Trades of the Wild']]) {
    const st = stages.find((s) => s.need?.item === id);
    if (st) add('quest', `Quest: ${qname} asks for ${st.need.qty}`);
  }
  if (QUEST_ITEMS[id]) add('quest', `Quest: ${QUEST_ITEMS[id]}`);
  // Construction's home builds (home.js): the first few that take it.
  const builds = Object.values(HOME_UPGRADES).flatMap((u) => u.tiers.filter((t) => t.cost?.items?.[id] && t.level).map((t) => `${t.name} (Construction ${t.level})`));
  if (builds.length) add('build', `Home build: ${builds.slice(0, 3).join(', ')}${builds.length > 3 ? ` and ${builds.length - 3} more` : ''}`);
  if (ORDER_BY_ID[id]) add('serve', `Serve at your hawker stall (Hawkering ${ORDER_BY_ID[id].level})`);
  // No number: boneXp is before the XP rate, and the bury row on the same page shows the real one.
  if (BONE_IDS.includes(id)) add('prayer', `Bury for Prayer XP, or offer at a monument for ${ALTAR_XP_MULT}x as much`);
  // The Offering Shrine: materials and goods for blessing points, gear by salvage.
  if (mk) add('shrine', `Offering Shrine: ${materialPoints(id)} points each`);
  else if (goodsKind(id)) add('shrine', `Offering Shrine: ${Math.round(goodsPoints(id) * 100) / 100} points each`);
  else if (isSalvageable(id)) add('shrine', 'Dismantle for upgrade stones, sacrifice to gear of its kind, or offer at the Offering Shrine');
  return out;
}

/** The whole entry for one item: { id, name, cat, sources, recipes (it goes
 *  into), then (what those products go on to make, one step further), other,
 *  noUse (true when nothing but selling or the shrine wants it). */
export function itemEntry(id) {
  const recipes = recipesUsing(id);
  const then = [];
  for (const r of recipes) {
    if (!r.output) continue;
    const next = recipesUsing(r.output.id).filter((x) => x.output).map((x) => x.output.id);
    then.push({ via: r.output.id, makes: [...new Set(next)] });
  }
  const other = itemOtherUses(id);
  return { id, name: name(id), cat: resourceCat(id), sources: itemSources(id), recipes, then, other,
    noUse: !recipes.length && !other.some((o) => o.kind !== 'shrine') };
}

// ---------------- The Resources index ----------------

export const RESOURCE_CATS = [
  { id: 'ore', name: 'Ores and stone' }, { id: 'bar', name: 'Bars' }, { id: 'gem', name: 'Gems' },
  { id: 'log', name: 'Logs' }, { id: 'raw', name: 'Raw fish and meat' }, { id: 'food', name: 'Food' },
  { id: 'herb', name: 'Herbs and crops' }, { id: 'seed', name: 'Seeds' }, { id: 'hide', name: 'Hides and trophies' },
  { id: 'potion', name: 'Potions' }, { id: 'gear', name: 'Gear' }, { id: 'ammo', name: 'Runes and ammo' },
  { id: 'bone', name: 'Bones and ashes' }, { id: 'building', name: 'Building' }, { id: 'other', name: 'Other' },
];
/** Which shelf of the index an item sits on. */
export function resourceCat(id) {
  const it = ITEMS[id];
  if (!it) return 'other';
  const mk = materialKind(id);
  if (mk === 'feather') return 'hide';
  if (mk === 'ash') return 'bone';
  if (mk) return mk;
  if (it.equip) return 'gear';
  if (it.heal || it.healPct) return 'food';
  if (POTIONS[id]) return 'potion';
  if (/_seed$/.test(id)) return 'seed';
  if (BONE_IDS.includes(id)) return 'bone';
  const tags = it.tags || [];
  if (tags.includes('rune') || tags.includes('ammo') || /_rune$|_arrow$|arrow_shaft/.test(id)) return 'ammo';
  if (tags.includes('plank') || tags.includes('nails') || tags.includes('brick') || tags.includes('furniture')) return 'building';   // Construction
  return 'other';
}

let _index = null;
/** Every obtainable and craftable resource: anything a node gives, any recipe
 *  input or output, and every material, seed and bone. [{ id, name, cat }] by name. */
export function resourceIndex() {
  if (_index) return _index;
  const ids = new Set();
  for (const s of gatherSources()) for (const g of s.gives) ids.add(g.id);
  for (const r of allRecipes()) { for (const i of r.inputs) ids.add(i.id); if (r.output) ids.add(r.output.id); }
  for (const id of Object.keys(ITEMS)) if (materialKind(id) || /_seed$/.test(id) || BONE_IDS.includes(id)) ids.add(id);
  ids.delete('coins');
  _index = [...ids].filter((id) => ITEMS[id]).map((id) => ({ id, name: name(id), cat: resourceCat(id) })).sort((a, b) => a.name.localeCompare(b.name));
  return _index;
}
/** The index filtered by a search term and a shelf ('all' for every one). */
export function searchResources(term = '', cat = 'all') {
  const t = term.trim().toLowerCase();
  return resourceIndex().filter((e) => (cat === 'all' || e.cat === cat) && (!t || e.name.toLowerCase().includes(t)));
}

// ---------------- Fighting skills ----------------

/** The perk track for a fighting skill: [{ level, name, desc }] (one every 20 levels to 200). */
export function perkLadder(skill) {
  const track = PERK_TRACKS[skill === 'hitpoints' ? '' : skill];
  return track ? track.map((p, i) => ({ level: (i + 1) * PERK_EVERY, name: p.name, desc: p.desc })) : [];
}
/** Gear unlocked by a skill's level: [{ level, ids }] by level. */
export function gearTiers(skill) {
  const by = new Map();
  for (const [id, it] of Object.entries(ITEMS)) {
    const l = it.equip?.req?.[skill];
    if (!l) continue;
    if (!by.has(l)) by.set(l, []);
    by.get(l).push(id);
  }
  return [...by].sort((a, b) => a[0] - b[0]).map(([level, ids]) => ({ level, ids: ids.sort((a, b) => name(a).localeCompare(name(b))) }));
}
/** Where to fight: each region with its monsters' level range (bosses left
 *  out), from where the world placed them. [{ region, lo, hi, ids }] by lo. */
export function trainingSpots(game) {
  const hab = codexHabitats(game);
  const by = new Map();
  for (const [id, zs] of hab) {
    const d = getNpc(id);
    if (d.boss || !d.attackable) continue;
    for (const z of zs) {
      if (!by.has(z)) by.set(z, { region: z, lo: Infinity, hi: 0, ids: [] });
      const e = by.get(z);
      e.lo = Math.min(e.lo, d.level); e.hi = Math.max(e.hi, d.level); e.ids.push(id);
    }
  }
  // Most regions hold a few strays far from their usual band, so the middle
  // half of their monsters' levels (p25-p75) says more than the extremes.
  for (const e of by.values()) {
    e.ids.sort((a, b) => getNpc(a).level - getNpc(b).level);
    const lv = e.ids.map((id) => getNpc(id).level);
    e.p25 = lv[Math.floor((lv.length - 1) * 0.25)]; e.p75 = lv[Math.ceil((lv.length - 1) * 0.75)];
  }
  return [...by.values()].sort((a, b) => a.p25 - b.p25 || a.p75 - b.p75);
}
/** The regions with the most monsters a fighter of this combat level can take
 *  on well (from a little under to a little over it), best first. */
export function bestSpotsFor(game, level, n = 5) {
  const near = (id) => { const l = getNpc(id).level; return l >= level - 8 && l <= level + 8; };
  return trainingSpots(game).map((s) => ({ ...s, near: s.ids.filter(near) }))
    .filter((s) => s.near.length).sort((a, b) => b.near.length - a.near.length).slice(0, n);
}
/** The extra lists a fighting skill's guide shows: spells, prayers, Slayer tasks and rewards, food. */
export function combatExtras(skill, cls = undefined) {
  // With a class: the spells it casts (a Priest or a Zealot only its own); without, every spell, the classes' own named.
  if (skill === 'magic') return { title: 'Spells', rows: (cls !== undefined ? spellsFor(cls) : SPELLS).map((s) => ({ level: s.level, name: cls === undefined && s.cls ? `${s.name} (${s.cls === 'priest' ? 'Priest' : 'Zealot'})` : s.name, text: `Runes: ${Object.entries(s.runes).map(([r, q]) => `${q} ${name(r)}`).join(', ')}`, items: Object.keys(s.runes) })) };
  if (skill === 'prayer') return { title: 'Blessings', rows: PRAYERS.map((p) => ({ level: p.level, name: p.name, text: [p.def && `+${Math.round(p.def * 100)}% Defence`, p.str && `+${Math.round(p.str * 100)}% Strength`, p.ranged && `+${Math.round(p.ranged * 100)}% Ranged`, p.magic && `+${Math.round(p.magic * 100)}% Magic`, p.crit && `+${Math.round(p.crit * 100)}% crit chance`, p.protect && `Blocks ${Math.round(p.protect * 100)}% of damage taken`, p.slots > 1 && `takes ${p.slots} slots`].filter(Boolean).join(', ') || 'A blessing' })) };
  if (skill === 'slayer') return { title: 'Tasks', rows: SLAYER_TASKS.slice().sort((a, b) => a.req - b.req || a.name.localeCompare(b.name)).map((t) => ({ level: t.req, name: t.name, text: `${t.min}-${t.max} kills` })),
    rewards: SLAYER_REWARDS.map((r) => ({ id: r.id, qty: r.qty, cost: r.cost })) };
  if (skill === 'hitpoints') {
    const foods = Object.entries(ITEMS).filter(([, it]) => (it.heal || it.healPct) && !it.equip).map(([id, it]) => ({ id, heal: it.heal || 0, pct: it.healPct || 0 }))
      .sort((a, b) => a.pct - b.pct || a.heal - b.heal);
    return { title: 'Food', rows: foods.map((f) => ({ level: 0, name: name(f.id), text: f.pct ? `heals ${Math.round(f.pct * 100)}% of your life` : `heals ${f.heal}`, items: [f.id] })) };
  }
  return null;
}
