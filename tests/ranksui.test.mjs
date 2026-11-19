// Mastery ranks and quality tiers are spelt out (ranksui.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ranksCardHTML, masteryLine, qualityLine, masteryFacts } from '../src/ui/ranksui.js';
import { MASTERY_RANKS } from '../src/game/mastery.js';
import { QUALITY } from '../src/game/loot.js';

test('mastery and quality never share a name', () => {
  const m = new Set(MASTERY_RANKS.map((r) => r.name));
  for (const q of Object.values(QUALITY)) assert.ok(!m.has(q.label), `${q.label} is only a quality`);
});

test('the ladders list every rank and tier with its bonus', () => {
  const html = ranksCardHTML({ rank: 3 });
  for (const r of MASTERY_RANKS) assert.match(html, new RegExp(`<b>${r.name}</b>`));
  for (const q of Object.values(QUALITY)) assert.match(html, new RegExp(`<b>${q.label}</b><span>\\+${Math.round(q.gain * 100)}%`));
  assert.equal((html.match(/rk-step got/g) || []).length, 4, 'ranks up to the one you have are marked');
});

test('tooltip lines say the rank, its place, the bonus and what is next', () => {
  assert.deepEqual(masteryFacts(3), { name: 'Expert', of: 6, bonus: 45, points: 3000 });
  assert.match(masteryLine('Sword', 4200), /Sword mastery: <b[^>]*>Expert<\/b> \(rank 3 of 6, \+45%\) · 1,200 \/ 5,000 to Master/);
  assert.match(masteryLine('Sword', 60000), /Ascended.*fully mastered/);
  assert.match(qualityLine('epic'), /Epic<\/span> quality \(3rd of 5\): \+25% to this copy's stats/);
  assert.equal(qualityLine(null), '');
});
