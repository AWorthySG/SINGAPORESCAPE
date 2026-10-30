// Learning: the question bank, Wisdom XP, topic mastery, Codex titles, the
// subject perks they grant in the game, and saving it all.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave } from '../src/game/save.js';
import { SUBJECTS, TOPICS, QUESTIONS, QUESTIONS_BY_TOPIC, SUBJECT_BY_ID } from '../src/data/questions.js';
import { Learning, MASTERY_CORRECT } from '../src/game/learning.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('the question bank is well formed', () => {
  const ids = new Set();
  for (const t of TOPICS) {
    assert.ok(SUBJECT_BY_ID[t.subject], `${t.id} has a real subject`);
    assert.ok(t.title && t.icon && t.desc, `${t.id} has a title, icon and description`);
    assert.ok(QUESTIONS_BY_TOPIC[t.id].length >= MASTERY_CORRECT, `${t.id} has enough questions to master`);
  }
  for (const q of QUESTIONS) {
    assert.ok(!ids.has(q.id)); ids.add(q.id);
    assert.equal(q.answers.length, 4, `${q.id} has four answers`);
    assert.equal(new Set(q.answers).size, 4, `${q.id} answers are all different`);
    assert.ok(q.why, `${q.id} explains the answer`);
  }
  for (const s of SUBJECTS) assert.ok(TOPICS.some((t) => t.subject === s.id));
});

test('a topic is mastered by enough recent correct answers, not by luck early on', () => {
  const L = new Learning();
  const qs = QUESTIONS_BY_TOPIC.econ_elasticity;
  for (let i = 0; i < MASTERY_CORRECT - 1; i++) assert.equal(L.answer(qs[i], true).mastered, false);
  for (let i = 0; i < 3; i++) L.answer(qs[0], false);   // a bad patch
  assert.equal(L.answer(qs[1], true).mastered, false, 'recent answers are mostly wrong');
  let got = false;
  for (let i = 0; i < 4 && !got; i++) got = L.answer(qs[i], true).mastered;
  assert.ok(got && L.isMastered('econ_elasticity'));
  assert.ok(L.xp > 0 && L.level >= 1);
  // Repeating a question you know well earns less.
  const first = new Learning();
  const a = first.answer(qs[0], true).xp; first.answer(qs[0], true);
  assert.ok(first.answer(qs[0], true).xp < a);
});

test('mastery unlocks a title and subject perks that change prices and crits', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.ui = new Proxy({}, { get: () => () => {} });
  const base = game.priceFactor();
  const crit0 = game.learning.perks().crit;
  for (const id of ['econ_demand_supply', 'econ_elasticity', 'math_algebra']) {
    const qs = QUESTIONS_BY_TOPIC[id];
    for (let i = 0; i < MASTERY_CORRECT; i++) game.studyAnswer(qs[i], true);
    assert.ok(game.learning.isMastered(id));
  }
  assert.equal(game.learning.titleText(), 'Market Maker', 'wears the first title earned');
  assert.ok(game.priceFactor().buy < base.buy && game.priceFactor().sell > base.sell, 'Trader perk');
  assert.ok(game.learning.perks().crit > crit0, 'Precision perk');

  game.learning.title = 'math_algebra';
  saveGame(game);
  const g2 = new Game();
  loadGame(g2);
  assert.ok(g2.learning.isMastered('econ_elasticity'));
  assert.equal(g2.learning.titleText(), 'Equation Breaker');
  assert.equal(g2.learning.xp, game.learning.xp);
});
