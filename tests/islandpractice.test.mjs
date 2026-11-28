import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earnIslandPractice, islandBook, islandMarketDay, islandPractised, restoreIslandLife } from '../src/game/islandlife.js';
import { Skills } from '../src/game/skillset.js';
import { islandMarketHTML, islandMarketKeepsake, islandProgressHTML } from '../src/ui/islandprogressui.js';
import { openHome } from '../src/ui/homeui.js';

function fresh(saved) {
  return {
    islandLife: saved ? restoreIslandLife(saved) : undefined,
    skills: new Skills({ emit() {} }),
    msg() {},
  };
}

test('a first clear pays its bonus once, and guided practice remains trainable on repeat and reload', () => {
  const game = fresh();
  const base = game.skills.xpAtLevel('music', 40);
  assert.deepEqual(earnIslandPractice(game, 'music', 'tune:kopi', 40), { xp: base * 1.5, first: true });
  assert.equal(islandPractised(game, 'music', 'tune:kopi'), true);
  assert.equal(islandPractised(game, 'photography', 'tune:kopi'), false);
  assert.deepEqual(earnIslandPractice(game, 'music', 'tune:kopi', 40, { quality: 2 }), { xp: base * 1.25, first: false });
  const reload = fresh(JSON.parse(JSON.stringify(islandBook(game))));
  assert.deepEqual(earnIslandPractice(reload, 'music', 'tune:kopi', 40), { xp: base, first: false });
  assert.notEqual(game.skills.xp.music, 0);
  assert.equal(game.saveSoon, true);
});

test('practice save keys are bounded and validated, and unsupported rewards are rejected', () => {
  const game = fresh({ practice: { music: ['kopi', 'kopi', '<script>', ...Array.from({ length: 150 }, (_, i) => `tune:${i}`)], defence: ['drill'] } });
  assert.equal(islandBook(game).practice.music.length, 128);
  assert.equal(islandPractised(game, 'music', '<script>'), false);
  assert.equal(islandPractised(game, 'defence', 'drill'), false);
  assert.deepEqual(earnIslandPractice(game, 'defence', 'drill', 100), { xp: 0, first: false });
  assert.deepEqual(earnIslandPractice(game, 'music', 'kopi', Infinity), { xp: 0, first: false });
});

test('market day uses three existing activity completions and keeps the fourth free to choose', () => {
  const game = fresh({ patterns: ['chilli'], performed: ['kopi'], photos: ['market'] });
  assert.deepEqual(islandMarketDay(game).stops.map(({ done }) => done), [true, true, true, false]);
  assert.match(islandMarketHTML(game, 'music'), /Keepsake earned/);
  assert.match(islandMarketKeepsake(game), /Market day keepsake/);
  assert.equal(islandMarketKeepsake(fresh({ patterns: ['chilli'], voyages: ['changi'] })), '');
  assert.match(islandProgressHTML(fresh(), 'music'), /83 XP to level 2/);
});

test('finished tunes and sets appear as playable pieces at home', () => {
  const game = fresh({ tunes: ['kopi', 'market'], performed: ['kopi'], practice: { music: ['project:hawker-set'] } });
  game.home = { owned: true, whyNot: () => null };
  const body = {};
  const ui = { game, modal: {}, openModal: (_, render) => render(body) };
  openHome(ui, 'music');
  assert.match(body.innerHTML, /data-song="tune:kopi:standard"/);
  assert.match(body.innerHTML, /data-song="project:hawker-set"/);
  assert.doesNotMatch(body.innerHTML, /Market Steps|Sentosa shore set/);
});
