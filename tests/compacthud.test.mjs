// The compact HUD (src/ui/compacthud.js and styles/compact.css): the rules
// that decide what folds away are pure and checked here; the stylesheet is
// checked as text (no browser in the tests).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autoLabel, lootExcerpt, regionShown, CompactHud, LOOT_PEEK_MS, REGION_SHOW_MS } from '../src/ui/compacthud.js';

const css = readFileSync(new URL('../styles/compact.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the Auto button names what is switched on, and a waiting grave', () => {
  assert.equal(autoLabel({}), 'Auto');
  assert.equal(autoLabel({ battle: true }), 'Auto Battle');
  assert.equal(autoLabel({ gather: true }), 'Auto Gather');
  assert.equal(autoLabel({ quest: true }), 'Auto Quest');
  assert.equal(autoLabel({ battle: true, quest: true }), 'Battle + Quest');
  assert.equal(autoLabel({ battle: true, gather: true, quest: true }), 'Auto: all');
  assert.equal(autoLabel({ grave: true }), 'Auto · Grave');
});

test('the folded log previews pickups and named drops', () => {
  assert.equal(lootExcerpt('You loot: 2 x Copper ore.', 'game'), 'Loot · 2 x Copper ore');
  assert.equal(lootExcerpt('You pick up a Rusty sword.', 'game'), 'Loot · a Rusty sword');
  assert.equal(lootExcerpt('Signature drop! Crown (for Guardian)', 'level'), 'Signature drop! Crown (for Guardian)');
  assert.equal(lootExcerpt('You deal 14 damage.', 'combat'), '');
  assert.equal(lootExcerpt('Talk to Auntie Mei.', 'system'), '');
  assert.equal(lootExcerpt(null), '');
});

test('the area name shows on arrival, and always while the minimap is folded', () => {
  assert.equal(regionShown({ now: 1000, changedAt: 0 }), true);
  assert.equal(regionShown({ now: REGION_SHOW_MS + 1, changedAt: 0 }), false);
  assert.equal(regionShown({ now: REGION_SHOW_MS * 9, changedAt: 0, minimapFolded: true }), true);
});

test('routine chatter leaves the loot preview and the log state alone', () => {
  const handlers = {};
  const classes = new Set(['collapsed']);
  const root = { classList: { toggle() {} } };
  const chat = { classList: { toggle: (name) => classes.add(name) } };
  const peek = {};
  const elements = { 'game-root': root, chatbox: chat, 'chat-head': { querySelector: () => ({ after() {} }) } };
  const game = { bus: { on: (event, fn) => { handlers[event] = fn; } } };
  const hud = new CompactHud({ game });
  globalThis.document = { getElementById: (id) => elements[id], createElement: () => peek };
  peek.setAttribute = () => {};
  try {
    handlers.chat({ text: 'You loot: 2 x Copper ore.', cls: 'game' });
    assert.equal(peek.textContent, 'Loot · 2 x Copper ore');
    handlers.chat({ text: 'You deal 14 damage.', cls: 'combat' });
    assert.equal(peek.textContent, 'Loot · 2 x Copper ore');
    hud._lootAt -= LOOT_PEEK_MS + 1;
    handlers.tick();
    assert.equal(peek.textContent, '');
    assert.deepEqual([...classes], ['collapsed']);
  } finally {
    delete globalThis.document;
  }
});

test('headless: the compact HUD subscribes and its tick is harmless without a DOM', () => {
  const on = {};
  const game = { bus: { on: (ev, fn) => { (on[ev] ||= []).push(fn); } } };
  const hud = new CompactHud({ game });
  for (const ev of ['tick', 'chat', 'autobattle', 'autogather', 'autoquest']) assert.ok(on[ev]?.length, `listens for ${ev}`);
  assert.doesNotThrow(() => { on.tick[0](); on.chat[0]({ text: 'hi', cls: 'game' }); });
  assert.ok(hud);
});

test('the HUD information styles load after responsive layout and keep the base hit areas', () => {
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.indexOf('styles/compact.css') < links.indexOf('styles/hud-touch.css'));
  assert.ok(links.indexOf('styles/hud-touch.css') < links.indexOf('styles/hud-information.css'));
  const info = readFileSync(new URL('../styles/hud-information.css', import.meta.url), 'utf8');
  const bare = (css + info).replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const ch of bare) { if (ch === '{') depth++; else if (ch === '}') { depth--; assert.ok(depth >= 0); } }
  assert.equal(depth, 0, 'every { is closed');
  assert.match(css, /@media \(pointer: coarse\) \{\s*#quickbar \.qb-pop \{ display: none; \}/, 'the quick actions fold on phones and tablets');
  // Smaller visuals, never smaller than a 44px target on a phone.
  const phone = css.slice(css.indexOf('@media (pointer: coarse) and (max-width: 540px) {'));
  for (const [, v] of phone.matchAll(/--(?:atk|sk): (\d+)px/g)) assert.ok(Number(v) >= 44, `${v}px stays a finger target`);
  assert.match(css, /#interact-btn\.idle \{ display: none; \}/);
  assert.match(css, /#game-root\.calm\.adr-empty #adrenaline \{ display: none; \}/);
  // A mouse gets the Auto button too, and the card opens from it.
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{[^]*#auto-menu-btn \{[^}]*display: flex;/);
  assert.match(css, /#ability-bar\.auto-open \.auto-row \{ display: flex; \}/);
});
