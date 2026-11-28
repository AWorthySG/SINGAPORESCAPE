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
const { worldArtBox, worldArtMax } = await import('../src/render/sprites.js');
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
  const artPath = (o) => `assets/world/obj-${o.def.art || o.objId}.webp`;
  for (const src of srcs) assert.ok(lms.some((o) => artPath(o) === src && dist(o) < 40), `${src} has a landmark within view`);
  for (const o of lms) if (dist(o) <= 12) assert.ok(srcs.includes(artPath(o)), `${o.objId} is asked for ahead of time`);
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

test('a landmark’s cast is anchored at its frontage and fades in diffuse light', () => {
  const o = { objId: 'chinese_temple', x: 10, y: 20, def: { type: 'scenery', footprint: [3, 3] } };
  worldArtBox(o);
  const image = asked.find((i) => i.src === 'assets/world/obj-chinese_temple.webp');
  Object.assign(image, { complete: true, naturalWidth: 100, naturalHeight: 100 });
  const dv = new DepthView();
  dv.ok = true;
  dv._silhouette = () => ({ cv: { width: 116, height: 116 }, pad: 8 });
  const drawn = [];
  const g = {
    globalAlpha: 0.8,
    save() { this.savedAlpha = this.globalAlpha; },
    restore() { this.globalAlpha = this.savedAlpha; },
    setTransform(...matrix) { this.matrix = matrix; },
    drawImage() { drawn.push({ alpha: this.globalAlpha, matrix: this.matrix }); },
  };
  const scale = 1.6, ox = 9 * TILE, oy = 18 * TILE;
  dv.castShadows(g, [], [o], ox, oy, 240, 240, 0.33, 0, scale, 1);
  dv.castShadows(g, [], [o], ox, oy, 240, 240, 0.67, 0, scale, 0.45);
  assert.equal(drawn.length, 2);
  assert.deepEqual(drawn[0].matrix.slice(4), [2.5 * TILE * scale, (3 * TILE - 3) * scale]);
  assert.ok(drawn[0].matrix[2] > 0 && drawn[1].matrix[2] < 0, 'the cast turns with the sun');
  assert.ok(drawn[1].alpha < drawn[0].alpha / 2, 'cloud softens the cast');
  assert.equal(g.globalAlpha, 0.8, 'other layers keep the original canvas state');
});
