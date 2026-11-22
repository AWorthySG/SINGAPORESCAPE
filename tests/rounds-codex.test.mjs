// The Codex explains gun rounds: each kind's own description (its shot power,
// how fast it's used, where it comes from) and the "Gun rounds" article.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../src/data/items.js';
import { ARTICLE_BY_ID, articleBlocks } from '../src/data/compendium.js';

const ROUNDS = Object.entries(ITEMS).filter(([, it]) => typeof it.roundStr === 'number');

test('every kind of rounds says what it adds, how fast it goes and where it comes from', () => {
  assert.ok(ROUNDS.length >= 15);
  for (const [id, it] of ROUNDS) {
    assert.ok(it.examine.includes(`+${it.roundStr} shot power`), `${id}: its shot power`);
    assert.ok(/pistol/i.test(it.examine) && /rifle/i.test(it.examine), `${id}: who fires it`);
    assert.ok(/Archery Emporium|smithed/.test(it.examine), `${id}: where to get it`);
    assert.ok(it.examine.length > 120, `${id}: more than a line`);
    assert.ok(!/\ba [aeiou]/i.test(it.examine), `${id}: "an adamant bar", not "a adamant bar"`);
  }
  assert.match(ITEMS.adamant_rounds.examine, /about every 20 shots, a rifle about every 5/);
  assert.match(ITEMS.frost_rounds.examine, /chills the foe/);
});

test('the Gun rounds article lists every kind with its shot power, smithing level and source', () => {
  const art = ARTICLE_BY_ID['gun-rounds'];
  assert.ok(art, 'the article exists');
  const blocks = articleBlocks(art);
  const tables = blocks.filter((b) => b && b.table);
  assert.equal(tables.length, 2, 'the metal rounds and the special rounds');
  const metal = tables[0].table.rows;
  assert.equal(metal.length, ROUNDS.filter(([, it]) => !it.special).length);
  for (let i = 1; i < metal.length; i++) assert.ok(+metal[i][1].slice(1) > +metal[i - 1][1].slice(1), 'weakest first');
  assert.ok(metal.every((r) => /^level \d+$/.test(r[2])), 'each is smithed at a level');
  assert.equal(tables[1].table.rows.length, 3);
  assert.ok(blocks.some((b) => typeof b === 'string' && /plain shot/.test(b)), 'what happens without rounds');
});
