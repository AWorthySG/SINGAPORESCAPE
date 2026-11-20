// Sacrifice and dismantle balance (src/game/salvage.js): an hour of auto battle
// drops at a level, then what sacrificing or dismantling all of that gear gives,
// next to what the same kills gave directly.
//
//   node tools/balance/salvage.mjs                        # levels 50, 150, 250
//   node tools/balance/salvage.mjs --levels 100 --kills 3600 --seed 7
//
// Mastery is XP (mastery.js): "kill mst" is the XP the kills gave each worn
// piece, "sac mst" what sacrificing the hour's spare gear of the weapon's type
// gave it (it stops at Master: "to M" is the pieces that took, "min" the
// minutes of drops they came to, "same" all the spare pieces of the type).
//
// "An hour" is 1,800 kills (30 a minute; the comparisons are per kill, so the
// pace doesn't change them) of the monsters within 15% of the level, each spawn
// a champion as often as in the game (8%), loot rolled by the game's own
// rollDrops (quality, class conversion and all) and put in the pack. Bosses are
// left out: auto battle doesn't seek them.
import { seedRandom, parseArgs, printTable } from './common.mjs';
import { setupClass } from './classlab.mjs';
import { NPC } from '../../src/game/npc.js';
import { getNpc, ALL_MONSTER_IDS } from '../../src/data/npcs.js';
import { getItem } from '../../src/data/items.js';
import { killMastery } from '../../src/game/mastery.js';
import { FEED_CAP } from '../../src/game/materials.js';
import { previewSacrificeAll, dismantleAll, bulkPicks } from '../../src/game/salvage.js';

/** One hour of drops at level L; returns the totals. */
export function salvageHour(L, { kills = 1800, cls = 'swordsman', seed = 20261112 } = {}) {
  const g = setupClass(cls, L, seed);
  seedRandom(seed + L);
  const mons = ALL_MONSTER_IDS.filter((id) => {
    const d = getNpc(id);
    return d.attackable && !d.boss && !d.fixed && Math.abs(d.level - L) <= Math.max(10, L * 0.15);
  });
  const got = { stones: 0, scrolls: 0, wards: 0, gear: 0 };
  g._autoLoot = (loot) => {
    for (const [id, qty, , q] of loot) {
      if (id === 'upgrade_stone') got.stones += qty;
      else if (id === 'refine_scroll') got.scrolls += qty;
      else if (id === 'upgrade_ward') got.wards += qty;
      if (getItem(id).equip) { got.gear += qty; g.inventory.add(id, qty, q); }
    }
  };
  let mastery = 0, champs = 0;
  for (let k = 0; k < kills; k++) {
    const n = new NPC(mons[k % mons.length], 10, 10, 0);
    if (n.champion) champs++;
    mastery += killMastery(n);
    g.rollDrops(n);
  }
  // Sacrifice all the spare weapons of its type into the weapon (from no mastery: only the
  // same gear type can be sacrificed), then dismantle it all instead.
  const target = g.equipment.get('weapon');
  g.equipment.setMastery(target, 0);
  const sac = previewSacrificeAll(g, target);
  // Sacrifice stops at Master: how much of the hour's spare gear of the type
  // that took, as minutes of drops (the run's same-type pieces at an even pace, 30 kills a minute).
  const sameType = bulkPicks(g, {}, target).reduce((t, p) => t + p.qualities.length, 0);
  const toMaster = sac.points >= FEED_CAP ? Math.round((kills / 30) * sac.pieces / Math.max(1, sameType)) : null;
  const dis = dismantleAll(g, {}, { rand: Math.random });
  return { level: L, mons: mons.length, kills, champs, gear: got.gear, killMastery: mastery, sacPieces: sac.pieces, sacPoints: sac.points, sameType, toMaster,
    dropStones: got.stones, disStones: dis.stones, dropScrolls: got.scrolls, disScrolls: dis.scrolls, dropWards: got.wards, disWards: dis.wards, disPieces: dis.pieces };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const levels = String(args.levels || '50,150,250').split(',').map(Number);
  const kills = Number(args.kills) || 1800, seed = Number(args.seed) || 20261112;
  const rows = levels.map((L) => salvageHour(L, { kills, seed }));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
  console.log(`An hour (${kills} kills) of auto battle drops; sacrifice = all spare gear of its type into the weapon, dismantle = all of it instead (seed ${seed}).`);
  printTable(rows, [
    { key: 'level', label: 'level', w: 5 },
    { key: 'champs', label: 'champs', w: 6 },
    { key: 'gear', label: 'gear', w: 5 },
    { key: 'killMastery', label: 'kill mst', w: 8 },
    { key: 'sacPoints', label: 'sac mst', w: 7 },
    { key: 'sacPoints', label: 'sac/kill', w: 8, fmt: (v, r) => pct(v, r.killMastery) },
    { key: 'sameType', label: 'same', w: 5 },
    { key: 'sacPieces', label: 'to M', w: 5 },
    { key: 'toMaster', label: 'min', w: 4, fmt: (v) => (v == null ? '-' : String(v)) },
    { key: 'dropStones', label: 'stones', w: 6 },
    { key: 'disStones', label: '+dism', w: 6 },
    { key: 'disStones', label: 'share', w: 6, fmt: (v, r) => pct(v, r.dropStones) },
    { key: 'dropScrolls', label: 'scrolls', w: 7 },
    { key: 'disScrolls', label: '+dism', w: 6 },
    { key: 'disScrolls', label: 'share', w: 6, fmt: (v, r) => pct(v, r.dropScrolls) },
    { key: 'dropWards', label: 'wards', w: 5 },
    { key: 'disWards', label: '+dism', w: 5 },
  ]);
}
