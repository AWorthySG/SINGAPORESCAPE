// What the first frame asks for (depthview.js, sprites.js worldArtMax): the
// depth view's sun shadows are handed every landmark on the island, and used
// to ask for each one's picture to measure it, so all of them (the kelong,
// the Flyer, the Flower Dome...) loaded while the title's bar ran. Now only
// those whose shadow could come near the screen are asked for, plus a short
// walk's look-ahead so none pops in. Its own file, so the stub Image below is
// in place before any picture is asked for: every picture records its source.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const asked = [];
globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; asked.push(this); } };
const { Game } = await import('../src/game/game.js');
const { DepthView } = await import('../src/render/depthview.js');
const { worldArtMax } = await import('../src/render/sprites.js');
const { TILE } = await import('../src/config.js');

const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const g = new Game();
  g.start();
  g.chooseClass('rogue');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}

test('the sun shadows ask only for the landmarks near the view, not the whole island', () => {
  const g = newGame();
  const lms = g.world.landmarks;
  assert.ok(lms.length > 15, 'the island has its landmarks');
  for (const o of lms) assert.ok(worldArtMax(o), `${o.objId}: its box is known before its picture loads`);
  // A phone's view of Kampong Glam at noon, in world px, as the renderer passes it.
  const vw = 390 / 1.76, vh = 844 / 1.76;
  const ox = g.player.x * TILE - vw / 2, oy = g.player.y * TILE - vh / 2;
  const dv = new DepthView();
  dv.ok = true;   // headless it is off; the shadow pass itself only needs a context
  const n = asked.length;
  dv.castShadows(ctx, [], lms, ox, oy, vw, vh, 0.5, 0, 2);
  const srcs = asked.slice(n).map((i) => i.src);
  assert.ok(srcs.length > 0, 'the landmarks near the start are still asked for (no pop-in)');
  assert.ok(srcs.length < lms.length / 2, `only a few of ${lms.length} landmarks are asked for (${srcs.length})`);
  // Every landmark asked for is within reach of the view; none from across the island.
  const dist = (o) => {
    const fw = o.def.footprint[0];
    const cx = (o.x + fw / 2) * TILE - ox, cy = o.y * TILE - oy;
    return Math.max(0, -cx, cx - vw, -cy, cy - vh) / TILE;
  };
  for (const o of lms) {
    const src = `assets/world/obj-${o.def.art || o.objId}.webp`;
    if (srcs.includes(src)) assert.ok(dist(o) < 40, `${o.objId} asked for at ${dist(o).toFixed(0)} tiles from the view`);
    else assert.ok(dist(o) > 12, `${o.objId}, ${dist(o).toFixed(0)} tiles away, is asked for ahead of time`);
  }
  // The far ones are asked for once the view comes near them.
  const far = lms.filter((o) => !srcs.includes(`assets/world/obj-${o.def.art || o.objId}.webp`));
  assert.ok(far.length > 0);
  const o = far[0], fw = o.def.footprint[0];
  const m = asked.length;
  dv.castShadows(ctx, [], [o], (o.x + fw / 2) * TILE - vw / 2, o.y * TILE - vh / 2, vw, vh, 0.5, 0, 2);
  assert.ok(asked.slice(m).some((i) => i.src.includes(`obj-${o.def.art || o.objId}`)), `${o.objId} loads when the view reaches it`);
});

test('night and a missing picture ask for nothing', () => {
  const g = newGame();
  const dv = new DepthView();
  dv.ok = true;
  const n = asked.length;
  dv.castShadows(ctx, [], g.world.landmarks, 0, 0, 200, 400, 0.05, 0, 2);   // the sun is down: no shadows
  assert.equal(asked.length, n);
  assert.equal(worldArtMax({ def: { type: 'scenery' }, objId: 'no_such_thing_here' }), null);
});
