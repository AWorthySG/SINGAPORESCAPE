// A tidier screen: names never print over the hero's, the side panel folds to
// its tab icons on desktop (and starts folded on short laptop screens), and
// the top-centre area name only shows on arrival (the minimap names the area).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game/game.js';
import { Renderer } from '../src/render/renderer.js';
import { COLLAPSE_V } from '../src/ui/ui.js';

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
  g.worldLabels = 'all';   // (Smart labels leave your own name off altogether)
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

test('Smart labels keep the interaction name and spare the hero from ambient chatter', () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  g.worldLabels = 'smart';
  g.camera.resize(800, 600);
  const pc = g.player.renderCenter();
  const makeNpc = (name, dx, dy) => ({
    name, alive: true, attackable: false, def: {},
    x: pc.x / 32, y: pc.y / 32, chatTimer: 20, chatText: `Chatter from ${name}`,
    renderCenter: () => ({ x: pc.x + dx, y: pc.y + dy }),
  });
  const focused = makeNpc('Active quest giver', 40, 25);
  const covered = makeNpc('Behind hero', 0, 35);
  const left = makeNpc('Left neighbour', -220, -40);
  const right = makeNpc('Right neighbour', 220, -40);
  const extra = makeNpc('Extra neighbour', 220, 70);
  g.hover = { npc: focused };
  g.nearbyNpcs = () => [focused, covered, left, right, extra];
  const ctx = recordingCtx();
  new Renderer(g, { width: 800, height: 600 }, ctx)._drawOverheads(pc.x - 400, pc.y - 300, []);
  const text = ctx.calls.filter(([op]) => op === 'fillText');
  const interaction = text.find(([, label]) => label === focused.name);
  assert.ok(interaction?.[3] > 330, 'the current interaction name moves below the hero');
  assert.deepEqual(text.map(([, label]) => label).filter((label) => label.startsWith('Chatter from')), [left.chatText, right.chatText]);
});

test('desktop folds the side panel to its tab icons when you fold it, starts with it open, and the area name only shows on arrival', () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(pointer: fine\) and \(min-width: 541px\) and \(min-height: 501px\) \{\s*#sidepanel\.collapsed \{[^}]*grid-template-areas: "tabs"/);
  assert.match(css, /#region-label:not\(\.fresh\) \{ opacity: 0;/);
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.ok(!/laptop && key === 'panel'/.test(ui), 'computers no longer start with the menu folded');
  assert.equal(COLLAPSE_V, 2);
  assert.match(ui, /if \(c\.v !== COLLAPSE_V\) \{ delete c\.panel; c\.v = COLLAPSE_V; \}/, 'a fold saved before is cleared once');
});

test('Minimal HUD folds the menu to its tab icons instead of hiding it', () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  assert.ok(!/#game-root\.hud-min #sidepanel:not\(:hover\) \{ opacity: 0; \}/.test(css), 'the menu no longer fades out entirely');
  assert.match(css, /@media \(pointer: fine\) \{\s*#game-root\.hud-min #sidepanel:not\(:hover\):not\(\.collapsed\) \{[^}]*grid-template-areas: "tabs"/);
  assert.match(css, /#game-root\.hud-min #sidepanel:not\(:hover\):not\(\.collapsed\) #panel-body \{ display: none; \}/);
});

test('item descriptions stay up: through the bag redrawing under the mouse, and a moment after it leaves', async () => {
  const { TIP_LINGER_MS } = await import('../src/ui/ui.js');
  assert.ok(TIP_LINGER_MS >= 500 && TIP_LINGER_MS <= 1500, 'a short linger');
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /el\.addEventListener\('mouseleave', \(\) => this\._lingerHide\(\)\);/, 'leaving an item lingers rather than closing at once');
  assert.match(ui, /if \(host && o && !o\.isConnected && host\._tipGet\)/, 'a redrawn copy of the item keeps the tip');
});

test("the chat log scrolling as lines arrive no longer closes an item's description", () => {
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /if \(ev\.type === 'scroll'\) \{[\s\S]{0,300}!sc\.contains\?\.\(o\)\) return;/, 'only a scroll that moves the item closes it');
});
