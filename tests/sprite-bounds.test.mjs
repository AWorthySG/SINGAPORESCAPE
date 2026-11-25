// A promise sprites.js makes to save drawing work, checked against a 2D context
// that records where everything lands (Node has no DOM, so pictures and
// canvases are stand-ins that are always loaded): a rigged monster's hit flash
// is coloured from a box on its scratch canvas, and that box holds every posed
// layer, so no part of the flash is lost. And one the renderer makes: a dying
// pack monster keeps to its sticker in low graphics or slow frames, as the live
// ones do.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A context that keeps its transform and notes the screen box of each draw.
const contexts = [];
function recordingCtx(canvas) {
  const c = { canvas, m: [1, 0, 0, 1, 0, 0], stack: [], ops: [], globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none' };
  const mul = (a, b, cc, d, e, f) => { const [A, B, C, D, E, F] = c.m; c.m = [A * a + C * b, B * a + D * b, A * cc + C * d, B * cc + D * d, A * e + C * f + E, B * e + D * f + F]; };
  const box = (x, y, w, h) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
      const X = c.m[0] * px + c.m[2] * py + c.m[4], Y = c.m[1] * px + c.m[3] * py + c.m[5];
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
    return [x0, y0, x1, y1];
  };
  Object.assign(c, {
    save() { c.stack.push([[...c.m], c.globalAlpha, c.globalCompositeOperation, c.filter]); },
    restore() { const s = c.stack.pop(); if (s) [c.m, c.globalAlpha, c.globalCompositeOperation, c.filter] = s; },
    setTransform(a, b, cc, d, e, f) { c.m = [a, b, cc, d, e, f]; },
    transform: mul,
    translate(x, y) { mul(1, 0, 0, 1, x, y); },
    scale(x, y) { mul(x, 0, 0, y, 0, 0); },
    rotate(r) { const co = Math.cos(r), si = Math.sin(r); mul(co, si, -si, co, 0, 0); },
    drawImage(img, ...a) {
      const d = a.length === 2 ? [a[0], a[1], img.width, img.height] : a.length === 4 ? a : a.slice(4);
      c.ops.push({ op: 'drawImage', img, args: a, box: box(...d) });
    },
    ellipse(x, y, rx, ry) { c.ops.push({ op: 'ellipse', box: box(x - rx, y - ry, rx * 2, ry * 2) }); },
    arc(x, y, r) { c.ops.push({ op: 'arc', box: box(x - r, y - r, r * 2, r * 2) }); },
    fillRect(x, y, w, h) { c.ops.push({ op: 'fillRect', comp: c.globalCompositeOperation, args: [x, y, w, h], box: box(x, y, w, h) }); },
    measureText: () => ({ width: 10 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
  });
  for (const k of ['beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'rect', 'roundRect', 'fill', 'stroke',
    'clip', 'clearRect', 'strokeRect', 'fillText', 'strokeText', 'setLineDash']) c[k] = () => {};
  contexts.push(c);
  return c;
}
function fakeCanvas() {
  const cv = { width: 300, height: 150, _ctx: null };
  cv.getContext = () => cv._ctx || (cv._ctx = recordingCtx(cv));
  return cv;
}
// Every picture "loads" at once, at a size the test picks.
let picSize = [320, 311];
globalThis.Image = class { constructor() { [this.naturalWidth, this.naturalHeight] = picSize; this.width = this.naturalWidth; this.height = this.naturalHeight; this.complete = true; } };
globalThis.document = { createElement: () => fakeCanvas() };

const S = await import('../src/render/sprites.js');
const { NPCS } = await import('../src/data/npcs.js');

const within = (b, o, slack = 1e-6) => b[0] >= o[0] - slack && b[1] >= o[1] - slack && b[2] <= o[2] + slack && b[3] <= o[3] + slack;

test('a rigged monster\'s hit flash is coloured from a box that holds every posed layer', () => {
  let checked = 0;
  for (const id of S.rigIds()) {
    const kind = S.rigKind(id);
    if (kind !== 'boss' && kind !== 'species') continue;
    const def = kind === 'boss' ? NPCS[id] : Object.values(NPCS).find((d) => d.family === id && !d.boss && d.sprite);
    if (!def || !def.sprite) continue;
    for (const extra of [{ hurt: 150 }, { hurt: 150, attackK: 0.45, moving: true, move: 1 }, { windup: true, castK: 0.5 }, { hurt: 90, attackK: 0.8 }]) {
      for (const t of [0, 1234.5, 5678, 99999]) {
        for (const c of contexts) c.ops.length = 0;
        const screen = recordingCtx(fakeCanvas());
        S.drawCreature(screen, id, 100, 120, { time: t, facing: { dx: 1, dy: 0 }, scale: def.scale || 1, sprite: def.sprite, color: def.color,
          boss: def.boss, family: kind === 'boss' ? def.family : id, ...extra });
        // The tinted copy takes (sx, sy, sw, sh) of the scratch canvas: find that copy, then the scratch canvas's posed layers.
        const copy = contexts.flatMap((c) => c.ops.filter((o) => o.op === 'drawImage' && o.args.length === 8 && o.img.getContext).map((o) => ({ c, o })))[0];
        assert.ok(copy, `${id}: the flash takes a tinted copy`);
        const [sx, sy, sw, sh] = copy.o.args;
        const scratch = copy.o.img._ctx;
        const layers = scratch.ops.filter((o) => o.op === 'drawImage');
        assert.ok(layers.length >= 2, `${id}: its layers were composed`);
        // (Only the part of a layer on the scratch canvas counts: the rest is cut off anyway. A whole
        // layer's navy copy, as these stand-in pictures give, can reach past the canvas's edge.)
        const cw = copy.o.img.width, ch = copy.o.img.height;
        const onCanvas = (b) => [Math.max(0, b[0]), Math.max(0, b[1]), Math.min(cw, b[2]), Math.min(ch, b[3])];
        for (const l of layers) assert.ok(within(onCanvas(l.box), [sx, sy, sx + sw, sy + sh]), `${id} at ${t}: a layer at ${l.box.map((v) => v.toFixed(1))} lies outside the flash box ${[sx, sy, sx + sw, sy + sh]}`);
        // ...and the colour goes on over that same box, and only there.
        const fill = copy.c.ops.find((o) => o.op === 'fillRect');
        assert.deepEqual(fill.args, [sx, sy, sw, sh]);
        assert.equal(fill.comp, 'source-atop');
        checked++;
      }
    }
  }
  assert.ok(checked > 100, `checked ${checked} flashes`);
});

test('a dying pack monster falls as its sticker when frames are trimmed or graphics are low', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  picSize = [256, 256];
  const { Game } = await import('../src/game/game.js');
  const { Renderer } = await import('../src/render/renderer.js');
  const g = new Game();
  g.start();
  g.camera.resize(800, 600);
  g.camera.follow(g.player.x * 32, g.player.y * 32);
  // A rat (it has a parts rig) beside the hero, part-way through its fall.
  const rat = g.npcs.find((n) => n.def.family === 'rat' && !n.def.boss);
  rat.x = rat.tx = g.player.x + 1; rat.y = rat.ty = g.player.y; rat.alive = false; rat.deathT = 200; rat.hurt = 0;
  g._near = null; g._around = null;
  const screen = recordingCtx(fakeCanvas());
  const r = new Renderer(g, screen.canvas, screen);
  const rigDraws = (trim, low) => {
    g.fxTrim = trim; g.lowFx = low;
    for (const c of contexts) c.ops.length = 0;
    r.render(1000);
    return contexts.flatMap((c) => c.ops).filter((o) => o.op === 'drawImage' && /species\/rig\/rat_/.test(o.img.src || '')).length;
  };
  assert.ok(rigDraws(false, false) > 0, 'full graphics: it falls with its moving parts');
  assert.equal(rigDraws(true, false), 0, 'frames trimmed: it falls as its sticker, like the live ones');
  assert.equal(rigDraws(false, true), 0, 'low graphics: likewise');
});
