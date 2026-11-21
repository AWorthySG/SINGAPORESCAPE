// Groves: patches thick with one kind of tree (src/data/groves.js), placed
// after the rest of the world. Checks they're there, one kind each and dense,
// that every tree can be reached and nothing was cut off, that nothing placed
// before them moved, and that the Woodcutting guide and the walk-in message
// name them.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld, TERRAIN } from '../src/data/world.js';
import { GROVE_PLAN } from '../src/data/groves.js';
import { OBJECTS } from '../src/data/objects.js';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { findPath } from '../src/engine/pathfinding.js';
import { groveList } from '../src/game/skillguide.js';
import { groveAt, groveSummary } from '../src/game/resourcezones.js';

const data = buildWorld();
const bare = buildWorld({ groves: false });
const zoneAt = (x, y) => data.zones.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)?.name;
const inBox = (g, o, m = 0) => o.x >= g.x0 - m && o.x <= g.x1 + m && o.y >= g.y0 - m && o.y <= g.y1 + m;

function boot() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass('swordsman');
  g.npcs = g.npcs.filter((n) => !n.attackable);   // nothing wanders up and starts a fight
  return g;
}

// Every tile you can walk to from Kampong Glam's plaza (4-way, as the groves were checked).
function reachable(w) {
  const W = w.width, H = w.height, blocked = new Uint8Array(W * H), seen = new Uint8Array(W * H);
  for (const o of w.objects) {
    const def = OBJECTS[o.objId];
    if (!def?.blocking) continue;
    const [fw, fd] = def.footprint || [1, 1];
    for (let dy = 0; dy < fd; dy++) for (let dx = 0; dx < fw; dx++) if (o.x + dx < W && o.y - dy >= 0) blocked[(o.y - dy) * W + o.x + dx] = 1;
  }
  const q = [55 * W + 58];
  seen[q[0]] = 1;
  while (q.length) {
    const k = q.pop(), x = k % W, y = (k - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const nk = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[nk] || blocked[nk] || w.terrain[nk] === TERRAIN.WATER) continue;
      seen[nk] = 1; q.push(nk);
    }
  }
  return seen;
}

test('groves: every planned grove is placed, one or two a region, with mid, high and endgame trees among them', () => {
  assert.ok(GROVE_PLAN.length >= 12 && GROVE_PLAN.length <= 20, `${GROVE_PLAN.length} planned`);
  assert.deepEqual(data.groves.map((g) => g.id).sort(), GROVE_PLAN.map((p) => p.id).sort(), 'all of them placed');
  const per = {};
  for (const g of data.groves) per[g.region] = (per[g.region] || 0) + 1;
  assert.ok(Object.keys(per).length >= 12, `${Object.keys(per).length} regions have one`);
  assert.ok(Object.values(per).every((n) => n <= 2), 'no more than two a region');
  const kinds = new Set(data.groves.map((g) => g.objId));
  for (const id of ['oak', 'willow', 'teak', 'yew_tree', 'magic_tree', 'tembusu', 'seraya_tree', 'meranti_tree', 'chengal_tree', 'starfall_banyan', 'moonlit_kapok', 'keramat_tree']) {
    assert.ok(kinds.has(id), `a grove of ${id}`);
  }
  assert.equal(new Set(data.groves.map((g) => g.name)).size, data.groves.length, 'each has its own name');
  const total = data.groves.reduce((s, g) => s + g.count, 0);
  assert.ok(total >= 200 && total <= 450, `${total} trees in all: a modest number to draw`);
});

test('each grove is one kind of tree, packed thick, inside its region on open grass', () => {
  for (const g of data.groves) {
    const plan = GROVE_PLAN.find((p) => p.id === g.id);
    assert.equal(g.objId, plan.tree);
    // Nothing you use stands in or just round the patch but its own trees.
    const near = data.objects.filter((o) => OBJECTS[o.objId]?.verb && inBox(g, o, 1));
    assert.ok(near.every((o) => o.objId === g.objId), `${g.name}: only ${g.objId} (found ${[...new Set(near.map((o) => o.objId))]})`);
    const trees = near.filter((o) => o.objId === g.objId);
    assert.equal(trees.length, g.count);
    assert.ok(g.count >= 16 && g.count <= 36, `${g.name}: ${g.count} trees`);
    // At least one tree every four tiles of its patch: far thicker than the woods round it.
    const area = (g.x1 - g.x0 + 1) * (g.y1 - g.y0 + 1);
    assert.ok(g.count * 4 >= area, `${g.name} is dense (${g.count} in ${area} tiles)`);
    const around = data.objects.filter((o) => o.objId === g.objId && !inBox(g, o, 1) && Math.abs(o.x - g.cx) <= 15 && Math.abs(o.y - g.cy) <= 15).length;
    // ...and many times thicker with its kind than the 31 x 31 tiles round it.
    const ring = 31 * 31 - (g.x1 - g.x0 + 3) * (g.y1 - g.y0 + 3);
    assert.ok(g.count / area >= 10 * (around / ring), `${g.name}: ${g.count} trees, ${around} more of its kind scattered round it`);
    for (const t of trees) {
      assert.equal(zoneAt(t.x, t.y), g.region, `${g.name}'s tree at ${t.x},${t.y} is in ${g.region}`);
      assert.ok([TERRAIN.GRASS, TERRAIN.DARKGRASS].includes(data.terrain[t.y * data.width + t.x]), 'on grass');
    }
    // Off the roads: no path or boardwalk in the patch or its ring.
    for (let y = g.y0 - 1; y <= g.y1 + 1; y++) for (let x = g.x0 - 1; x <= g.x1 + 1; x++) {
      assert.ok(![TERRAIN.PATH, TERRAIN.WOOD].includes(data.terrain[y * data.width + x]), `${g.name} keeps off the road at ${x},${y}`);
    }
    assert.ok(!data.npcSpawns.some((s) => trees.some((t) => t.x === s.x && t.y === s.y)), `${g.name}: no tree on a spawn`);
    assert.ok(!data.resourceZones.some((z) => g.x1 >= z.x0 - 2 && g.x0 <= z.x1 + 2 && g.y1 >= z.y0 - 2 && g.y0 <= z.y1 + 2), `${g.name} is clear of the resource zones`);
  }
});

test('the groves cut nothing off: every tile you could walk to still can be, and every tree has open ground beside it', () => {
  const before = reachable(bare), after = reachable(data);
  const treeAt = new Set(data.groves.flatMap((g) => data.objects.filter((o) => o.objId === g.objId && inBox(g, o)).map((o) => o.y * data.width + o.x)));
  let lost = 0;
  for (let k = 0; k < before.length; k++) if (before[k] && !after[k] && !treeAt.has(k)) lost++;
  assert.equal(lost, 0, 'no tile cut off');
  for (const k of treeAt) {
    assert.ok(before[k], 'each tree stands where you could walk before');
    assert.ok([1, -1, data.width, -data.width].some((d) => after[k + d]), `the tree at ${k % data.width},${Math.floor(k / data.width)} can be reached`);
  }
});

test('nothing placed before the groves moved: the world without them is the same, bar the trees', () => {
  assert.deepEqual(data.terrain, bare.terrain);
  assert.deepEqual(data.npcSpawns, bare.npcSpawns);
  assert.deepEqual(data.landmarks, bare.landmarks);
  assert.deepEqual(data.resourceZones, bare.resourceZones);
  assert.deepEqual(data.objects.slice(0, bare.objects.length), bare.objects, 'every earlier object where it was, in the same order');
  const added = data.objects.slice(bare.objects.length);
  assert.equal(added.length, data.groves.reduce((s, g) => s + g.count, 0), 'only the groves\' trees were added');
  assert.deepEqual(bare.groves, []);
});

test('the Woodcutting guide lists the groves; walking into one says what grows there; a grove tree can be walked to from town', () => {
  const g = boot();
  const list = groveList(g);
  assert.equal(list.length, data.groves.length);
  for (let i = 1; i < list.length; i++) assert.ok(list[i].level >= list[i - 1].level, 'lowest tree first');
  const yew = list.find((r) => r.objId === 'yew_tree');
  assert.match(yew.text, /^Tekong Yew Grove: \d+ yew trees \(level 60\), Tekong Badlands$/);
  for (const r of list) assert.ok(r.text.includes(r.name) && r.text.includes(r.region) && r.text.includes(r.tree.toLowerCase()), r.text);

  const gr = g.world.groves.find((x) => x.objId === 'oak');
  assert.equal(groveAt(g.world, gr.cx, gr.cy), gr);
  assert.match(groveSummary(gr), /^Ubin Oak Grove: \d+ oak trees, Woodcutting 15$/);
  const said = [];
  g.bus.on('chat', (m) => said.push(m.text));
  g.player.x = g.player.tx = gr.x0 - 1; g.player.y = g.player.ty = gr.y0 - 1;
  for (let i = 0; i < 2; i++) g.update(600);
  assert.ok(said.some((t) => t.startsWith('You enter Ubin Oak Grove:')), said.join(' | '));

  // A sample tree of each grove, by the game's own pathfinding.
  const cfg = g.pathCfg();
  for (const x of g.world.groves) {
    assert.ok(findPath(cfg, { x: 58, y: 55 }, { x: x.x0, y: x.y0 }, { reachAdjacent: true, maxNodes: 300000 }).length > 0, `${x.name} can be walked to`);
  }
});

test('auto gather in a grove moves from tree to tree of the grove', () => {
  const g = boot();
  const gr = g.world.groves.find((x) => x.objId === 'oak');
  g.skills.xp.woodcutting = 1e5;   // well past the oak's level 15
  if (!g.inventory.has('bronze_axe')) g.inventory.add('bronze_axe', 1);
  const start = g.world.objectAt(gr.x0, gr.y0);
  g.player.x = g.player.tx = gr.x0 - 1; g.player.y = g.player.ty = gr.y0;
  g.toggleAutoGather(true);
  g.defaultObjectAction(start);
  const felled = new Set();
  for (let i = 0; i < 1500 && felled.size < 4; i++) {
    g.update(600);
    for (const o of g.world.objects) if (o.objId === 'oak' && o.depleted) felled.add(o);
    for (const sl of g.inventory.slots) if (sl && sl.id === 'oak_logs') g.inventory.remove('oak_logs', sl.qty);
  }
  assert.ok(felled.size >= 4, `felled ${felled.size} oaks`);
  for (const o of felled) assert.ok(inBox(gr, o), `the oak at ${o.x},${o.y} is one of the grove's`);
});
