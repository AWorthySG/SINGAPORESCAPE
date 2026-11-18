// Firemaking: started from the Skills menu (best logs first) or a log in the bag,
// and it always catches, even when tapped mid-step or beside another fire.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { fireStartHTML } from '../src/ui/skillguideui.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function game() {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];
  return g;
}
const fires = (g) => g.world.objects.filter((o) => o.def?.type === 'fire').length;

test('"Light a fire" burns every log, best kind first, moving on when one runs out', () => {
  const g = game();
  g.skills.xp.firemaking = 1e6;   // high enough for oak and willow
  g.inventory.add('logs', 3); g.inventory.add('oak_logs', 2);
  assert.deepEqual(g.burnableLogs().slice(0, 2), ['oak_logs', 'logs'].filter((id) => g.burnableLogs().includes(id)).sort((a, b) => g.burnableLogs().indexOf(a) - g.burnableLogs().indexOf(b)));
  assert.equal(g.burnableLogs()[0], 'oak_logs', 'oak first');
  const f0 = fires(g);
  assert.ok(g.startFiremaking());
  for (let i = 0; i < 60 && (g.inventory.count('logs') || g.inventory.count('oak_logs')); i++) g.update(600);
  assert.equal(g.inventory.count('oak_logs'), 0); assert.equal(g.inventory.count('logs'), 0, 'went on to the plain logs');
  assert.ok(fires(g) - f0 >= 5, 'five fires lit');
});

test('a fire lights even when tapped mid-step, or while standing on another fire', () => {
  const g = game();
  g.inventory.add('logs', 2);
  // Mid-step: the walk carries the player one tile on before it stops.
  const p = g.player;
  p.setPath([{ x: p.x + 1, y: p.y }], true);
  g.update(100);
  const f0 = fires(g);
  g.lightLogs(g.inventory.slots.findIndex((s) => s?.id === 'logs'));
  for (let i = 0; i < 20 && g.inventory.count('logs') === 2; i++) g.update(600);
  assert.equal(g.inventory.count('logs'), 1, 'the first log caught');
  assert.equal(fires(g), f0 + 1);
  // Standing on that fire's tile now? Lighting again picks a free tile beside it.
  const fire = g.world.objects.filter((o) => o.def?.type === 'fire').pop();
  p.x = p.tx = fire.x; p.y = p.ty = fire.y; p.setPath?.([], false);
  assert.ok(g.startFiremaking());
  for (let i = 0; i < 20 && g.inventory.count('logs'); i++) g.update(600);
  assert.equal(g.inventory.count('logs'), 0, 'the second log caught beside the first fire');
});

test('the Skills menu button says what it will burn, or what is missing', () => {
  const g = game();
  assert.match(fireStartHTML(g), /No logs you can burn/);
  assert.match(fireStartHTML(g), /disabled/);
  g.inventory.add('logs', 4);
  assert.match(fireStartHTML(g), /Logs.*\(4 in your bag\)/);
  assert.doesNotMatch(fireStartHTML(g), /disabled/);
  g.inventory.remove('tinderbox', 1);
  assert.match(fireStartHTML(g), /need a tinderbox/);
  assert.equal(g.startFiremaking(), false);
});
