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

test('Knowledge Strikes: a boss special waits for a question, and a right answer interrupts it', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const shown = [];
  game.ui = new Proxy({ showKnowledgeStrike: (q) => shown.push(q) }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  assert.equal(game.knowledgeStrikes, false, 'off in headless runs so other tests keep normal bosses');
  game.knowledgeStrikes = true;
  const boss = game.npcs.find((n) => n.def.boss && n.alive);
  boss.target = game.player;
  const hp0 = boss.hp, php0 = game.player.hp;
  game.bossSpecial(boss);
  assert.ok(game._ks && shown.length === 1, 'a question pops up instead of the special');
  assert.equal(game.player.hp, php0, 'nothing has hit you yet');
  game.answerKnowledgeStrike(true);
  assert.ok(!game._ks);
  assert.ok(boss.hp < hp0, 'the interrupted boss takes a wound');
  assert.equal(game.player.hp, php0, 'and its special never lands');
  const st = game.learning.topics[shown[0].topic];
  assert.equal(st.correct, 1, 'the answer counts toward mastery');

  // Run out of time: the answer counts as wrong and the special goes off.
  game.bossSpecial(boss);
  assert.ok(game._ks);
  game._ks.until = game.tickCount;
  game._tickKnowledgeStrike();
  assert.ok(!game._ks);
  assert.equal(game.learning.topics[shown[1].topic].wrong >= 1, true);
});

test('mistake bounties: a wrong answer becomes a bounty worth double when you get it right later', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.ui = new Proxy({}, { get: () => () => {} });
  const q = QUESTIONS_BY_TOPIC.math_algebra[0];
  game.studyAnswer(q, false);
  assert.deepEqual(game.learning.mistakes, [q.id]);
  const coins = game.inventory.count('coins');
  const r = game.studyAnswer(q, true);
  assert.ok(r.bounty && r.xp === 120, 'double Wisdom XP');
  assert.ok(game.inventory.count('coins') >= coins + 40, 'bounty coins (plus any Wisdom level-up coins)');
  assert.deepEqual(game.learning.mistakes, []);
  assert.equal(game.studyAnswer(q, true).bounty, false, 'only once');
});

test('daily revision: five questions, bounties first, with a streak across days', () => {
  const L = new Learning();
  const wrong = QUESTIONS_BY_TOPIC.english_grammar[2];
  L.answer(wrong, false);
  const set = L.dailySet();
  assert.equal(set.length, 5);
  assert.equal(set[0].id, wrong.id, 'your mistakes come first');
  assert.equal(new Set(set.map((q) => q.id)).size, 5, 'no repeats');
  assert.equal(L.finishDaily('2026-10-29', '2026-10-28').streak, 1);
  assert.equal(L.finishDaily('2026-10-29', '2026-10-28'), null, 'once a day');
  assert.equal(L.finishDaily('2026-10-30', '2026-10-29').streak, 2, 'the next day keeps the streak');
  assert.equal(L.finishDaily('2026-11-02', '2026-11-01').streak, 1, 'a missed day resets it');
  assert.equal(L.daily.best, 2);
  const L2 = new Learning();
  L2.load(JSON.parse(JSON.stringify(L.serialize())));
  assert.deepEqual(L2.mistakes, L.mistakes);
  assert.equal(L2.daily.date, '2026-11-02');
});
