// Frame- and tick-cost guards from the lag sweep (towns, forests, boss fights):
// the per-frame NPC update and nearbyNpcs start from a short list of who could
// be near, world objects are found through a spatial index, harvest judders
// run down without visiting every object, the water layer copies only the
// shoreline's foam blocks, the quest tracker only rewrites itself when it
// reads differently, and the notice lane measures the page once a frame. Each
// is checked against the plain whole-world answer. All headless.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { TerrainFx, foamRects, growBox, FOAM_CELL } from '../src/render/terrainfx.js';
import { NoticeLane } from '../src/ui/noticelane.js';
import { UI } from '../src/ui/ui.js';
import { TILE } from '../src/config.js';
import { TERRAIN } from '../src/data/world.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function freshGame() {
  globalThis.localStorage = fakeStorage();
  const g = new Game();
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
const near = (g, r) => g.npcs.filter((n) => Math.abs(n.x - Math.round(g.player.x)) <= r && Math.abs(n.y - Math.round(g.player.y)) <= r);

test('nearbyNpcs matches a scan of the whole world as the player walks, teleports and NPCs come and go', () => {
  const g = freshGame();
  g.start(); g.chooseStartingStyle('melee');
  const walk = [[58, 55], [60, 55], [62, 56], [63, 57], [80, 60], [20, 60], [21, 61], [150, 150], [58, 55]];
  for (const [x, y] of walk) {
    g._movePlayerNear(x, y, 3);
    for (let i = 0; i < 3; i++) {
      g.update(250);
      assert.deepEqual(g.nearbyNpcs(), near(g, 60), `nearby at ${g.player.x},${g.player.y}`);
    }
  }
  // A new NPC beside you counts at once; one far away doesn't.
  const a = new NPC('goblin', g.player.x + 2, g.player.y, 0, {}); g.npcs.push(a);
  const b = new NPC('goblin', g.player.x + 200, g.player.y, 0, {}); g.npcs.push(b);
  assert.ok(g.nearbyNpcs().includes(a) && !g.nearbyNpcs().includes(b));
  assert.deepEqual(g.nearbyNpcs(), near(g, 60));
  // Replacing the list (as a test or a cleanup filter does) is picked up too.
  g.npcs = g.npcs.filter((n) => n !== a);
  assert.deepEqual(g.nearbyNpcs(), near(g, 60));
});

test('the frame update animates exactly the NPCs within 48 tiles, and every ally wherever it is', () => {
  const g = freshGame();
  g.start(); g.chooseStartingStyle('melee');
  g._movePlayerNear(58, 55, 3);
  const ally = new NPC('goblin', g.player.x + 150, g.player.y, 0, {}); ally.ally = true; g.npcs.push(ally);
  for (const [x, y] of [[58, 55], [64, 58], [70, 55], [20, 60]]) {
    g._movePlayerNear(x, y, 3);
    g.update(16);   // settle the lists for this spot
    const seen = new Set();
    for (const n of g.npcs) { const u = n.update; n.update = function (dt) { seen.add(this); return u.call(this, dt); }; }
    g.update(16);
    for (const n of g.npcs) delete n.update;
    const px = g.player.x, py = g.player.y;
    const want = g.npcs.filter((n) => n.ally || (Math.abs(n.x - px) <= 48 && Math.abs(n.y - py) <= 48));
    assert.equal(seen.size, want.length, `same count at ${px},${py}`);
    for (const n of want) assert.ok(seen.has(n), `${n.npcId} at ${n.x},${n.y} updated`);
    assert.ok(seen.has(ally), 'the far-off ally still moves');
  }
});

test('the world finds objects in a box through its index, in list order, as objects come and go', () => {
  const g = freshGame();
  const w = g.world;
  const brute = (x0, y0, x1, y1) => w.objects.filter((o) => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1);
  const boxes = [[40, 40, 80, 70], [0, 0, 15, 15], [55, 50, 57, 52], [100, 90, 140, 130], [-5, -5, 3, 3], [w.width - 10, w.height - 10, w.width + 5, w.height + 5]];
  for (const b of boxes) assert.deepEqual(w.objectsIn(...b), brute(...b));
  // A fire lit and one burnt out keep the index in step.
  let spot = null;
  for (let y = 50; y < 70 && !spot; y++) for (let x = 45; x < 70 && !spot; x++) if (!w.isBlocked(x, y) && !w.objectAt(x, y)) spot = [x, y];
  const fire = w.lightFire(spot[0], spot[1]);
  assert.ok(w.objectsIn(spot[0], spot[1], spot[0], spot[1]).includes(fire));
  for (const b of boxes) assert.deepEqual(w.objectsIn(...b), brute(...b));
  w.removeObject(fire);
  assert.ok(!w.objectsIn(spot[0], spot[1], spot[0], spot[1]).includes(fire));
  for (const b of boxes) assert.deepEqual(w.objectsIn(...b), brute(...b));
  // A whole new list (tests swap it out) is indexed afresh.
  const keep = w.objects;
  w.objects = keep.slice(0, 50);
  for (const b of boxes) assert.deepEqual(w.objectsIn(...b), brute(...b));
  w.objects = [];
  assert.deepEqual(w.objectsIn(0, 0, w.width, w.height), []);
  w.objects = keep;
  for (const b of boxes) assert.deepEqual(w.objectsIn(...b), brute(...b));
});

test('Interact still picks the object beside you (found through the index)', () => {
  const g = freshGame();
  g.start(); g.chooseStartingStyle('melee');
  const w = g.world;
  const o = w.objects.find((x) => x.def.verb && x.def.type === 'rock' && !x.depleted);
  g.npcs = []; w.groundItems.length = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    if (w.isBlocked(o.x + dx, o.y + dy)) continue;
    g._placePlayer(o.x + dx, o.y + dy);
    break;
  }
  const t = g._findInteract();
  assert.equal(t?.kind, 'obj');
  assert.ok(Math.max(Math.abs(t.ref.x - g.player.x), Math.abs(t.ref.y - g.player.y)) <= 2);
});

test('a harvest judder runs down to nothing and is then forgotten', () => {
  const g = freshGame();
  const w = g.world;
  const tree = w.objects.find((o) => o.def.type === 'tree');
  w.shake(tree, 280);
  assert.equal(tree.shakeT, 280);
  w.tickShakes(100);
  assert.equal(tree.shakeT, 180);
  w.tickShakes(500);
  assert.equal(tree.shakeT, 0);
  assert.equal(w._shaking.size, 0, 'no longer visited');
  // The game's frame update runs it down too.
  w.shake(tree, 140);
  g.update(50);
  assert.equal(tree.shakeT, 90);
});

test('foam is kept as the blocks of a chunk that hold it, neighbours in a row merged', () => {
  const C = FOAM_CELL * TILE;
  const cells = new Set([0 * 1024 + 0, 0 * 1024 + 1, 0 * 1024 + 3, 2 * 1024 + 7]);
  assert.deepEqual(foamRects(cells, 32, 32), [[0, 0, 2 * C, C], [3 * C, 0, C, C], [7 * C, 2 * C, C, C]]);
  // A chunk at the map's edge, narrower than whole blocks.
  assert.deepEqual(foamRects(new Set([0 * 1024 + 1]), 6, 3), [[C, 0, 6 * TILE - C, 3 * TILE]]);
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  growBox(box, 10, 20, 5, 5); growBox(box, 0, 30, 2, 2);
  assert.deepEqual(box, { x0: 0, y0: 20, x1: 15, y1: 32 });
});

test('the water layer copies only the foam blocks, and says where it drew', () => {
  const fx = new TerrainFx();
  const A = { id: 'foamA' }, B = { id: 'foamB' };
  const C = FOAM_CELL * TILE;
  const chunk = { fx: { foam: { a: A, b: B, rects: [[C, C, C, C]] }, water: [], refl: [], x: 0, y: 0, w: 1024, h: 1024 } };
  const calls = [];
  const ctx = { globalAlpha: 1, drawImage: (...a) => calls.push(a) };
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  assert.equal(fx.drawFoam(ctx, [chunk], 0, 0, 800, 600, 1000, false, box), true);
  assert.equal(calls.length, 2);
  // Half-resolution source, full-size destination, just the one block.
  assert.deepEqual(calls[0].slice(1), [C / 2, C / 2, C / 2, C / 2, C, C, C, C]);
  assert.deepEqual(box, { x0: C, y0: C, x1: 2 * C, y1: 2 * C });
  // A block off screen: nothing drawn.
  calls.length = 0;
  assert.equal(fx.drawFoam(ctx, [chunk], 2000, 2000, 800, 600, 1000, false), false);
  assert.equal(calls.length, 0);
});

test('a real bake records its foam blocks, all inside the chunk and along its shore', () => {
  const g = freshGame();
  const w = g.world;
  // A canvas stand-in (as in terrainfx.test.mjs): every call is a no-op.
  const stub = (wd, ht) => {
    const ctx = new Proxy({}, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'createImageData') return (W, H) => ({ data: new Uint8ClampedArray(W * H * 4) });
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
        return () => {};
      },
      set(t, k, v) { t[k] = v; return true; },
    });
    return { width: wd, height: ht, getContext: () => ctx };
  };
  const fx = new TerrainFx(stub);
  const out = fx.bake(stub(1024, 1024).getContext('2d'), w, 0, 32, 32, 64, () => '#fff', {});   // MacRitchie's chunk
  assert.ok(out && out.foam && out.foam.rects.length > 0, 'the reservoir chunk has foam blocks');
  const C = FOAM_CELL * TILE;
  let area = 0;
  for (const [x, y, wd, ht] of out.foam.rects) {
    assert.ok(x >= 0 && y >= 0 && x + wd <= out.w && y + ht <= out.h && wd > 0 && ht > 0);
    area += wd * ht;
    // Every block is on the waterline: some tile in it is land beside water.
    let shore = false;
    for (let ty = y / TILE; ty < (y + ht) / TILE && !shore; ty++) for (let tx = x / TILE; tx < (x + wd) / TILE && !shore; tx++) {
      const X = tx, Y = ty + 32;
      if (w.terrainAt(X, Y) !== TERRAIN.WATER && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => w.terrainAt(X + dx, Y + dy) === TERRAIN.WATER)) shore = true;
    }
    assert.ok(shore, `block ${x},${y} is on the shore`);
  }
  assert.ok(area < out.w * out.h, 'less than the whole chunk');
  assert.equal(area % (C / FOAM_CELL), 0);
});

test('the quest tracker pointer finds the same nearest target as before', () => {
  const g = freshGame();
  g.start(); g.chooseStartingStyle('melee');
  const fake = { game: g };
  const pick = (pred) => UI.prototype._trkPointer.call(fake, pred);
  const hyp = (pred) => {
    let best = null, bd = Infinity;
    for (const n of g.npcs) { if (!n.alive || !pred(n)) continue; const d = Math.hypot(n.x - g.player.x, n.y - g.player.y); if (d < bd) { bd = d; best = n; } }
    return { best, bd };
  };
  for (const fam of [...new Set(g.npcs.filter((n) => n.attackable).map((n) => n.def.family))].slice(0, 12)) {
    const pred = (n) => n.def.family === fam;
    const { best, bd } = hyp(pred);
    const html = pick(pred);
    if (!best) { assert.equal(html, ''); continue; }
    if (bd <= 6) assert.match(html, /here/);
    else assert.match(html, new RegExp(`>${Math.round(bd)}m<`));
  }
  assert.equal(pick(() => false), '');
});

test('the notice lane measures the page at most once a frame, however many ticks ask', () => {
  const frames = [];
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (f) => frames.push(f);
  try {
    const lane = new NoticeLane({});
    let placed = 0;
    lane.place = () => { placed++; };
    lane.placeSoon(); lane.placeSoon(); lane.placeSoon();
    assert.equal(frames.length, 1, 'one frame asked for');
    assert.equal(placed, 0, 'not measured mid-tick');
    frames.shift()();
    assert.equal(placed, 1);
    lane.placeSoon();
    assert.equal(frames.length, 1, 'the next tick asks again');
  } finally {
    if (raf) globalThis.requestAnimationFrame = raf; else delete globalThis.requestAnimationFrame;
  }
  // Headless with no frames at all: it just places.
  const lane = new NoticeLane({});
  let placed = 0;
  lane.place = () => { placed++; };
  lane.placeSoon();
  assert.equal(placed, 1);
});
