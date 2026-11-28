import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawHeroRig } from '../src/render/heroRig.js';
import { drawHeroBack } from '../src/render/heroAnimArt.js';
import { sampleHeroClip } from '../src/render/heroanim.js';

function recordArt(run) {
  const previous = globalThis.Image;
  globalThis.Image = class { complete = true; naturalWidth = 128; naturalHeight = 128; };
  const drawn = [], stack = [];
  let m = [1, 0, 0, 1, 0, 0];
  const ctx = {
    globalAlpha: 1,
    save() { stack.push([m.slice(), this.globalAlpha]); },
    restore() { [m, this.globalAlpha] = stack.pop(); },
    translate(x, y) { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
    rotate(turn) {
      const [a, b, c, d, e, f] = m, co = Math.cos(turn), si = Math.sin(turn);
      m = [a * co + c * si, b * co + d * si, c * co - a * si, d * co - b * si, e, f];
    },
    scale(x, y) { m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; },
    drawImage(img, x, y) {
      if (this.globalAlpha <= 0.01) return;
      const [a, b, c, d, e, f] = m;
      const part = img.src.split('/').pop().replace('.webp', '');
      drawn.push({ part, at: (u, v) => [a * (x + u) + c * (y + v) + e, b * (x + u) + d * (y + v) + f] });
    },
  };
  const render = (draw, opts) => {
    drawn.length = 0;
    assert.ok(draw(ctx, { jobClass: 'brawler', time: 1500, hasWeapon: true, ...opts }));
    assert.equal(stack.length, 0);
    return drawn.slice();
  };
  try { run(render); }
  finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
}

const clip = (id, u) => sampleHeroClip(id, u, { jobClass: 'brawler', low: true });
const near = ([x, y], [sx, sy]) => Math.hypot(x - sx, y - sy) < 0.001;

test('Brawler guard, attack and work arms stay in the painted front sockets', () => recordArt((render) => {
  const pivots = {
    'brawler-back': [14.6, 20.2], 'brawler-sword': [15.5, 20.5], 'brawler-strike': [1.9, 6],
    brawler_wind: [2, 15.9], brawler_mid: [2.1, 14.5], brawler_follow: [2.1, 15.5], brawler_hand: [1.4, 3.3],
  };
  for (const opts of [{}, { gait: { move: 1, phase: 0.5 } }, { swingK: 0.33 }, { anim: clip('flurry', 0.22) },
    { anim: clip('flurry', 0.42) }, { anim: clip('flurry', 0.69) }, { anim: clip('woodcut', 0.6) },
    { anim: clip('mine', 0.73) }, { hasWeapon: false, anim: clip('punch', 0.69) }]) {
    const layers = render(drawHeroRig, opts);
    const torso = layers.find(({ part }) => part === 'brawler_body');
    assert.ok(torso);
    // Neutral face: body origin (-25.2, -42.4), before its shared gait offset.
    const sockets = [torso.at(16.8, 31.3), torso.at(43.7, 33.4)];
    const arms = layers.filter(({ part }) => pivots[part]);
    const pins = arms.map(({ part, at }) => at(...pivots[part]));
    for (const pin of pins) assert.ok(sockets.some((socket) => near(pin, socket)), `arm detached at ${pin}`);
    for (const socket of sockets) assert.ok(pins.some((pin) => near(pin, socket)), `empty socket at ${socket}`);
    if (opts.hasWeapon === false) assert.deepEqual(arms.map(({ part }) => part), ['brawler_hand', 'brawler_hand']);
  }
}));

test('Brawler rear claws share their sleeve joint and drop away when unarmed', () => recordArt((render) => {
  for (const opts of [{}, { gait: { move: 1, phase: 0.6 } }, { anim: clip('flurry', 0.42) }, { hasWeapon: false }]) {
    const layers = render(drawHeroBack, { backView: true, ...opts });
    const torso = layers.find(({ part }) => part === 'brawler_backbody');
    const other = layers.find(({ part }) => part === 'brawler_backother');
    assert.ok(near(torso.at(31.8, 26.8), other.at(6.3, 4.9)));
    const main = layers.find(({ part }) => ['brawler_backarm', 'brawler_backstrike', 'brawler_hand'].includes(part));
    const pivot = { brawler_backarm: [17, 17.3], brawler_backstrike: [5.9, 5.5], brawler_hand: [1.4, 3.3] }[main.part];
    assert.ok(near(torso.at(3.3, 27.3), main.at(...pivot)));
    if (opts.hasWeapon === false) assert.equal(main.part, 'brawler_hand');
  }
}));
