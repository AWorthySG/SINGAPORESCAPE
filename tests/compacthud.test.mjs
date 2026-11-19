// The compact HUD (src/ui/compacthud.js and styles/compact.css): the rules
// that decide what folds away are pure and checked here; the stylesheet is
// checked as text (no browser in the tests).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  autoLabel, chatQuiet, regionShown, trackerSig, trackerDozing, CompactHud,
  CHAT_QUIET_MS, REGION_SHOW_MS, TRACKER_DOZE_MS,
} from '../src/ui/compacthud.js';

const css = readFileSync(new URL('../styles/compact.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the Auto button names what is switched on, and a waiting grave', () => {
  assert.equal(autoLabel({}), 'Auto');
  assert.equal(autoLabel({ battle: true }), 'Battle');
  assert.equal(autoLabel({ battle: true, quest: true }), 'Battle + Quest');
  assert.equal(autoLabel({ battle: true, gather: true, quest: true }), 'Auto: all');
  assert.equal(autoLabel({ grave: true }), 'Auto · Grave');
});

test('the chat goes quiet only after a spell with no news, and never while in use', () => {
  assert.equal(chatQuiet({ now: 1000, lastAt: 0 }), false);
  assert.equal(chatQuiet({ now: CHAT_QUIET_MS, lastAt: 0 }), true);
  assert.equal(chatQuiet({ now: CHAT_QUIET_MS * 2, lastAt: 0, hovered: true }), false, 'hover keeps it open');
  assert.equal(chatQuiet({ now: CHAT_QUIET_MS * 2, lastAt: 0, focused: true }), false, 'typing / tabbing keeps it open');
});

test('the area name shows on arrival, and always while the minimap is folded', () => {
  assert.equal(regionShown({ now: 1000, changedAt: 0 }), true);
  assert.equal(regionShown({ now: REGION_SHOW_MS + 1, changedAt: 0 }), false);
  assert.equal(regionShown({ now: REGION_SHOW_MS * 9, changedAt: 0, minimapFolded: true }), true);
});

test('phone objectives doze when nothing changes, walking does not count as news', () => {
  assert.equal(trackerSig('Wild Hornbill 0/11 42m Bat 0/18 1.2km'), trackerSig('Wild Hornbill 0/11 41m Bat 0/18 1.1km'));
  assert.notEqual(trackerSig('Wild Hornbill 0/11 42m'), trackerSig('Wild Hornbill 1/11 42m'), 'a kill is news');
  assert.equal(trackerDozing({ now: TRACKER_DOZE_MS - 1, changedAt: 0 }), false);
  assert.equal(trackerDozing({ now: TRACKER_DOZE_MS, changedAt: 0 }), true);
  assert.equal(trackerDozing({ now: TRACKER_DOZE_MS + 10, changedAt: 0, wokeAt: TRACKER_DOZE_MS }), false, 'a tap wakes it for a while');
});

test('headless: the compact HUD subscribes and its tick is harmless without a DOM', () => {
  const on = {};
  const game = { bus: { on: (ev, fn) => { (on[ev] ||= []).push(fn); } } };
  const hud = new CompactHud({ game });
  for (const ev of ['tick', 'chat', 'autobattle', 'autogather', 'autoquest']) assert.ok(on[ev]?.length, `listens for ${ev}`);
  assert.doesNotThrow(() => { on.tick[0](); on.chat[0]({ text: 'hi', cls: 'game' }); });
  assert.ok(hud);
});

test('compact.css loads last, keeps hit areas and is well formed', () => {
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(links.at(-1), 'styles/compact.css', 'linked after every other stylesheet');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const ch of bare) { if (ch === '{') depth++; else if (ch === '}') { depth--; assert.ok(depth >= 0); } }
  assert.equal(depth, 0, 'every { is closed');
  assert.ok(!/@media \(pointer: coarse\) \{/.test(css), 'no bare touch block (layout tests read main.css\'s)');
  // Smaller visuals, never smaller than a 44px target on a phone.
  const phone = css.slice(css.indexOf('@media (pointer: coarse) and (max-width: 540px) {'));
  for (const [, v] of phone.matchAll(/--(?:atk|sk): (\d+)px/g)) assert.ok(Number(v) >= 44, `${v}px stays a finger target`);
  assert.match(css, /#interact-btn\.idle \{ display: none; \}/);
  assert.match(css, /#game-root\.calm\.adr-empty #adrenaline \{ display: none; \}/);
  // A mouse gets the Auto button too, and the card opens from it.
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{[^]*#auto-menu-btn \{[^}]*display: flex;/);
  assert.match(css, /#ability-bar\.auto-open \.auto-row \{ display: flex; \}/);
});
