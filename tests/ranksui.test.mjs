// Mastery ranks and quality tiers are spelt out (ranksui.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ranksCardHTML, masteryLine, masteryProgressText, qualityLine, masteryFacts } from '../src/ui/ranksui.js';
import { MASTERY_RANKS } from '../src/game/mastery.js';
import { QUALITY } from '../src/game/loot.js';

test('mastery and quality never share a name', () => {
  const m = new Set(MASTERY_RANKS.map((r) => r.name));
  for (const q of Object.values(QUALITY)) assert.ok(!m.has(q.label), `${q.label} is only a quality`);
});

test('the ladders list every rank and tier with its bonus', () => {
  const html = ranksCardHTML({ rank: 3 });
  for (const r of MASTERY_RANKS) assert.match(html, new RegExp(`<b>${r.name}</b>`));
  // Each tier wears its painted badge (assets/icons/quality-<tier>.webp) before its name.
  for (const [k, q] of Object.entries(QUALITY)) assert.match(html, new RegExp(`<b><img[^>]*quality-${k}\\.webp[^>]*> ${q.label}</b><span>\\+${Math.round(q.gain * 100)}%`));
  assert.equal((html.match(/rk-step got/g) || []).length, 4, 'ranks up to the one you have are marked');
  // The two world-boss ranks say so.
  assert.equal((html.match(/rk-boss/g) || []).length, 2);
  assert.match(html, /<b>Exalted<\/b><span>\+180%<\/span><small>720,000 XP · world bosses<\/small>/);
  assert.match(html, /Unlocked by defeating world bosses/i);
});

test('tooltip lines say the rank, its place, the bonus and what is next', () => {
  assert.deepEqual(masteryFacts(3), { name: 'Expert', of: 8, bonus: 45, xp: 30000 });
  assert.match(masteryLine('Sword', 42000), /Sword mastery: <b[^>]*>Expert<\/b> \(rank 3 of 8, \+45%\) · 12,000 \/ 50,000 XP to Master/);
  // Past Ascended the next rank says how it is earned.
  assert.match(masteryLine('Sword', 600000), /Ascended<\/b> \(rank 6 of 8, \+140%\) · 120,000 \/ 240,000 XP to Exalted \(unlocked by defeating world bosses\)/);
  assert.match(masteryLine('Sword', 2e6), /Transcendent.*fully mastered/);
  assert.equal(masteryProgressText(1000), '1,000 / 2,500 XP to Adept');
  assert.equal(masteryProgressText(MASTERY_RANKS[7].xp), '0 / 480,000 XP to Transcendent (unlocked by defeating world bosses)');
  assert.match(qualityLine('epic'), /Epic<\/span> quality \(3rd of 5\): \+25% to this copy's stats/);
  assert.equal(qualityLine(null), '');
});
