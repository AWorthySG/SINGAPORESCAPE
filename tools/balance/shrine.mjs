// Offering Shrine balance: an hour of auto battle drops offered at the shrine,
// gear (src/game/salvage.js, shrineGearPoints) and other loot (goods,
// src/game/offerings.js), next to an hour of gathering offered as materials
// (materialPoints in src/game/materials.js).
//
//   node tools/balance/shrine.mjs                       # levels 50, 150, 250
//   node tools/balance/shrine.mjs --levels 100 --seed 7
//
// Gear: 1,800 kills of the monsters near the level (as tools/balance/salvage.mjs),
// everything "Offer all spare gear" would take with no filters ticked; goods:
// every non-gear, non-material drop "Offer all" takes (no tools or enchanting
// supplies; coins can't be offered).
// Gathering: the best tree (or rock) the level can work, with a full pack
// banked every 27 items at a cost of a minute's walk; the skill trains as it
// goes. Gathering takes a minute or two of real time per row.
import { freshGame, seedRandom, parseArgs, printTable } from './common.mjs';
import { setupClass } from './classlab.mjs';
import { NPC } from '../../src/game/npc.js';
import { getNpc, ALL_MONSTER_IDS } from '../../src/data/npcs.js';
import { ITEMS, getItem } from '../../src/data/items.js';
import { xpForLevel } from '../../src/data/xp.js';
import { materialPoints } from '../../src/game/materials.js';
import { previewOfferAll } from '../../src/game/salvage.js';
import { goodsKind, goodsPoints, GOODS_KINDS } from '../../src/game/offerings.js';

/** Shrine points from offering an hour of drops at level L: { combat, pieces, points (gear), goods }. */
export function gearHour(L, { kills = 1800, cls = 'swordsman', seed = 20261112 } = {}) {
  const g = setupClass(cls, L, seed);
  seedRandom(seed + L);
  const mons = ALL_MONSTER_IDS.filter((id) => {
    const d = getNpc(id);
    return d.attackable && !d.boss && !d.fixed && Math.abs(d.level - L) <= Math.max(10, L * 0.15);
  });
  let goods = 0;
  g._autoLoot = (loot) => {
    for (const [id, qty] of loot) {
      if (getItem(id).equip && !getItem(id).tool) g.inventory.add(id, qty);
      else if (GOODS_KINDS[goodsKind(id)]?.bulk) goods += goodsPoints(id) * qty;
    }
  };
  for (let k = 0; k < kills; k++) g.rollDrops(new NPC(mons[k % mons.length], 10, 10, 0));
  return { combat: g.skills.combatLevel(), ...previewOfferAll(g, {}), goods: Math.round(goods) };
}

/** Shrine points from an hour of woodcutting or mining at level L: { obj, items, points }. */
export function gatherHour(skill, L, { seed = 20261112, bankEvery = 27, bankTicks = 100 } = {}) {
  const g = freshGame('swordsman', seed);
  g.skills.xp[skill] = xpForLevel(L);
  const tool = skill === 'mining' ? 'pickaxe' : 'axe';
  for (const [id, it] of Object.entries(ITEMS)) if (it.tool === tool) g.inventory.add(id, 1);
  const type = skill === 'mining' ? 'rock' : 'tree';
  const cands = g.world.objects.filter((o) => o.def.type === type && o.def.level <= L && materialPoints(o.def.gives));
  const top = Math.max(...cands.map((o) => materialPoints(o.def.gives)));
  const objs = cands.filter((o) => materialPoints(o.def.gives) === top);
  let points = 0, items = 0, sinceBank = 0;
  for (let t = 0; t < 6000; t++) {
    if (!g.player.action) {
      const o = objs.find((x) => !x.depleted) || objs[0];
      g.player.x = g.player.tx = o.x + 1; g.player.y = g.player.ty = o.y;
      g.beginAction({ type: skill === 'mining' ? 'mine' : 'woodcut', obj: o }, { x: o.x, y: o.y }, true);
    }
    g.update(600);
    for (const s of g.inventory.slots) {
      if (!s || !materialPoints(s.id)) continue;
      points += materialPoints(s.id) * s.qty; items += s.qty; sinceBank += s.qty;
      g.inventory.remove(s.id, s.qty);
    }
    // A full pack: the walk to the bank and back.
    if (sinceBank >= bankEvery) { sinceBank -= bankEvery; t += bankTicks; }
  }
  return { obj: objs[0].objId, items, points };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const levels = String(args.levels || '50,150,250').split(',').map(Number);
  const seed = Number(args.seed) || 20261112;
  const rows = levels.map((L) => {
    const gear = gearHour(L, { seed }), wc = gatherHour('woodcutting', L, { seed }), mn = gatherHour('mining', L, { seed });
    return { level: L, combat: gear.combat, pieces: gear.pieces, gear: gear.points, goods: gear.goods, wcObj: wc.obj, wc: wc.points, mnObj: mn.obj, mn: mn.points };
  });
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
  console.log(`An hour of each, offered at the shrine (seed ${seed}).`);
  printTable(rows, [
    { key: 'level', label: 'level', w: 5 },
    { key: 'combat', label: 'cmb', w: 4 },
    { key: 'pieces', label: 'pieces', w: 6 },
    { key: 'gear', label: 'gear pts', w: 9 },
    { key: 'goods', label: 'loot pts', w: 9 },
    { key: 'wcObj', label: 'tree', w: 15 },
    { key: 'wc', label: 'wc pts', w: 9 },
    { key: 'gear', label: 'gear/wc', w: 7, fmt: (v, r) => pct(v, r.wc) },
    { key: 'goods', label: 'loot/wc', w: 7, fmt: (v, r) => pct(v, r.wc) },
    { key: 'mnObj', label: 'rock', w: 17 },
    { key: 'mn', label: 'mine pts', w: 9 },
    { key: 'gear', label: 'gear/mn', w: 7, fmt: (v, r) => pct(v, r.mn) },
  ]);
}
