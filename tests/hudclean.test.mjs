// A tidier screen: names never print over the hero's, the side panel folds to
// its tab icons on desktop (and starts folded on short laptop screens), and
// the top-centre area name only shows on arrival (the minimap names the area).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game/game.js';
import { Renderer } from '../src/render/renderer.js';
import { LAPTOP_FOLD } from '../src/ui/ui.js';

function recordingCtx() {
  const calls = [];
  const t = { calls, font: '10px sans-serif', globalAlpha: 1 };
  return new Proxy(t, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient' || k === 'createPattern') return () => ({ addColorStop() {} });
      if (k === 'getTransform') return undefined;
      if (k === 'measureText') return (s) => ({ width: String(s).length * (parseFloat(/(\d+(?:\.\d+)?)px/.exec(o.font)?.[1]) || 10) * 0.55 });
      return (...a) => { calls.push([k, ...a]); };
    },
    set(o, k, v) { o[k] = v; return true; },
  });
}

test("a townsperson's name beside you steps aside rather than printing over your name", () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.camera.resize(800, 600);
  const n = g.npcs.find((x) => !x.attackable && x.alive && x.name);
  assert.ok(n, 'a townsperson to stand by');
  let checked = 0;
  for (const [dx, dy] of [[0, -1], [0, -2], [1, -1], [-1, -1], [0, 1]]) {
    n.x = g.player.x + dx; n.y = g.player.y + dy; n.wander = 0; n.path = [];
    g.hover = { npc: n };   // a hovered townsperson always shows their name
    const pc = g.player.renderCenter();
    g.camera.follow(pc.x, pc.y, 1);   // centred on you
    const ctx = recordingCtx();
    const r = new Renderer(g, { width: 800, height: 600 }, ctx);
    r.render(1000);
    const fills = ctx.calls.filter((c) => c[0] === 'fillText');
    const me = fills.find((c) => c[1] === g.player.name);
    assert.ok(me, 'your name is drawn');
    for (const c of fills.filter((c) => c[1] === n.name)) {
      checked++;
      const half = (n.name.length + g.player.name.length) * 10 * 0.55 / 2;
      const overlaps = Math.abs(c[2] - me[2]) < half && Math.abs(c[3] - me[3]) < 11;
      assert.ok(!overlaps, `${n.name} at (${dx}, ${dy}) prints clear of your name`);
    }
  }
  assert.ok(checked > 0, "the townsperson's name was drawn at least once");
});

test('desktop folds the side panel to its tab icons, short laptop screens start folded, and the area name only shows on arrival', () => {
  assert.match(LAPTOP_FOLD, /pointer: fine/);
  assert.match(LAPTOP_FOLD, /max-height: 820px/);
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(pointer: fine\) and \(min-width: 541px\) and \(min-height: 501px\) \{\s*#sidepanel\.collapsed \{[^}]*grid-template-areas: "tabs"/);
  assert.match(css, /#region-label:not\(\.fresh\) \{ opacity: 0;/);
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /laptop && key === 'panel'/);
});

test('Minimal HUD folds the menu to its tab icons instead of hiding it', () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  assert.ok(!/#game-root\.hud-min #sidepanel:not\(:hover\) \{ opacity: 0; \}/.test(css), 'the menu no longer fades out entirely');
  assert.match(css, /@media \(pointer: fine\) \{\s*#game-root\.hud-min #sidepanel:not\(:hover\):not\(\.collapsed\) \{[^}]*grid-template-areas: "tabs"/);
  assert.match(css, /#game-root\.hud-min #sidepanel:not\(:hover\):not\(\.collapsed\) #panel-body \{ display: none; \}/);
});
