// The notification lane is one line tall: one card shows, the rest take turns
// behind it, and a "+N" button opens them as a list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NoticeLane, LANE_SHOWN, LANE_CYCLE_MS, laneTtl, cardHTML } from '../src/ui/noticelane.js';

test('one card shows at a time; the rest wait their turn', () => {
  const lane = new NoticeLane({});
  assert.equal(LANE_SHOWN, 1);
  for (const h of ['Upgrade: Mythic ring', 'Legendary drop! Dragonhide vambraces', 'Rare drop! Pearl', 'Level 50!']) lane.push({ html: h, ttl: 6000 });
  assert.equal(lane.queue.visible().length, 1);
  assert.equal(lane.queue.queued().length, 3);
});

test('while others wait, a showing note moves on after the cycle; a tip keeps its reading time', () => {
  assert.equal(laneTtl({ kind: 'note', ttl: 6000 }, 2), LANE_CYCLE_MS);
  assert.equal(laneTtl({ kind: 'banner', ttl: 1500 }, 2), 1500, 'never longer than it asked for');
  assert.equal(laneTtl({ kind: 'note', ttl: 6000 }, 0), 6000, 'alone, it keeps its full time');
  assert.equal(laneTtl({ kind: 'tip', ttl: 9000 }, 3), 9000);
});

test('the compact notice styles are one line, with a big enough +N tap area', () => {
  const css = readFileSync(new URL('../styles/compact.css', import.meta.url), 'utf8');
  assert.match(css, /#notice-lane \.nl-card:not\(\.nl-tip\) \.nl-text \{[^}]*line-clamp: 1/);
  assert.match(css, /#notice-lane \.nl-more::before \{[^}]*inset: -12px -8px/);
});

test('a note\'s own button stays outside the one-line words, and +N rides on the line', () => {
  const html = cardHTML({ id: 1, kind: 'note', count: 1, html: '<b>Upgrade:</b> Ring beats what you wear. <button type="button" class="nl-act" data-act="wearbest">Wear it</button>' }, 6);
  const words = html.match(/<div class="nl-text">([\s\S]*?)<\/div>/)[1];
  assert.ok(!words.includes('nl-act'), 'the button is not inside the clipped words');
  assert.match(html, /class="nl-act" data-act="wearbest">Wear it<\/button>/);
  assert.match(html, /class="nl-more"[^>]*>\+6<\/button>/);
});
