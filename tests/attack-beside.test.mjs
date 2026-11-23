// A monster right beside you can always be attacked on a touch screen. There
// the Interact button hides when it would say "Attack", for the big Attack
// button; but that one leaves story bosses alone and keeps to your current foe,
// so the Lion of Light (and a monster beside you mid-fight) had no button at all.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { UI } from '../src/ui/ui.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function setup() {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
// Stand still on a tile, facing (dx, dy).
function standAt(g, x, y, dx, dy) {
  const p = g.player;
  p.x = p.tx = p.fx = x; p.y = p.ty = p.fy = y; p.moving = false; p.path = []; p.facing = { dx, dy };
  g._near = null; g._around = null;
}
// The Interact button as setInteractLabel leaves it: is it hidden for the Attack button?
function hidden(label) {
  const cls = new Set();
  const btn = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) }, querySelector: (s) => (s === '.ib-verb' ? { innerHTML: '' } : null), prepend() {}, title: '' };
  UI.prototype.setInteractLabel.call({ el: { interact: btn } }, label);
  return cls.has('is-attack');
}

test('beside the Lion of Light, the Interact button stays up to attack it (the Attack button leaves it alone)', () => {
  const g = setup();
  const lion = g.npcs.find((n) => n.npcId === 'lion_of_light');
  assert.ok(lion?.attackable, 'the Lion of Light is in the world and attackable');
  // A monster a few tiles off, for the Attack button to go for instead.
  const other = g.npcs.find((n) => n.alive && n.attackable && !n.def.boss && !n.def.fixed);
  other.x = other.tx = lion.x + 4; other.y = other.ty = lion.y; other.target = null;
  standAt(g, lion.x + 1, lion.y, -1, 0);
  assert.notEqual(g.nearestFoe(), lion, 'the Attack button still leaves story bosses be');
  const t = g._findInteract();
  assert.equal(t?.ref, lion, 'Interact is on the lion');
  const label = g._interactLabel(t);
  assert.equal(label[0], 'Attack');
  assert.ok(!hidden(label), 'so the Interact button does not step aside');
  g.interact();
  assert.equal(g.player.action?.type, 'attack');
  assert.equal(g.player.action.npc, lion, 'and it attacks the lion');
});

test('a monster beside you while you fight another keeps its own Attack; the one you fight hides it', () => {
  const g = setup();
  const p = g.player;
  const [far, near] = g.npcs.filter((n) => n.alive && n.attackable && !n.def.boss && !n.def.fixed).slice(0, 2);
  for (const n of [far, near]) { n.hp = n.maxHp = 1e6; n.target = null; }
  standAt(g, p.x, p.y, 1, 0);
  far.x = far.tx = p.x + 6; far.y = far.ty = p.y;
  near.x = near.tx = p.x + 1; near.y = near.ty = p.y;
  p.setAction({ type: 'attack', npc: far });
  const label = g._interactLabel(g._findInteract());
  assert.equal(g._findInteract().ref, near);
  assert.ok(!hidden(label), 'the Attack button would keep to the far one, so Interact stays');
  // Once you fight the one beside you, the big button covers it: one Attack button again.
  p.setAction({ type: 'attack', npc: near });
  assert.ok(hidden(g._interactLabel(g._findInteract())));
});
