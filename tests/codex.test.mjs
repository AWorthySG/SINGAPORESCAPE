// The Monster Codex (src/game/codex.js, src/ui/codexui.js): it lists every
// monster and boss, hides an entry's details until the first kill, shows the
// same scaled numbers the game puts on screen, and its pages render headlessly.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ALL_MONSTER_IDS, ALL_BOSS_IDS, getNpc, hpScaleFor } from '../src/data/npcs.js';
import { BOSS_ABILITIES } from '../src/data/bossAbilities.js';
import { SIGNATURE_CLASS } from '../src/data/bossWeapons.js';
import { getItem } from '../src/data/items.js';
import {
  CODEX_IDS, codexList, codexEntry, codexProgress, codexRegions, isDiscovered, discoveredCount, dropChances, nearestSpawn, chanceText,
} from '../src/game/codex.js';
import { codexListHTML, codexEntryHTML, codexProgressHTML, defaultCodexState, monsterAtScreen, PAGE_SIZE } from '../src/ui/codexui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let shared = null;
function freshGame() {
  if (!shared) {
    globalThis.localStorage = fakeStorage();
    clearSave();
    shared = new Game();
    shared.start();
  }
  shared.kills = {};
  return shared;
}

test('the codex lists every monster and boss, each once', () => {
  const game = freshGame();
  const all = new Set([...ALL_MONSTER_IDS, ...ALL_BOSS_IDS]);
  assert.equal(CODEX_IDS.length, all.size);
  for (const id of all) assert.ok(CODEX_IDS.includes(id), `${id} is in the codex`);
  // With no filters (Seen and unseen) the list holds them all, sorted by level.
  const ids = codexList(game, { ...defaultCodexState(), disc: 'all' });
  assert.equal(ids.length, all.size);
  for (let i = 1; i < ids.length; i++) assert.ok(getNpc(ids[i - 1]).level <= getNpc(ids[i]).level, 'sorted by level');
  // Every creature has somewhere it lives, and every region it names is listed.
  const regions = new Set(codexRegions(game));
  for (const id of ids) {
    const e = codexEntry(game, id);
    assert.ok(e.zones.length > 0, `${id} lives somewhere`);
    for (const z of e.zones) assert.ok(regions.has(z), `${z} is a codex region`);
  }
});

test('filters and sorts narrow the list', () => {
  const game = freshGame();
  game.kills = { chicken: 3, goblin: 7 };
  const bosses = codexList(game, { type: 'boss' });
  assert.equal(bosses.length, ALL_BOSS_IDS.length);
  assert.ok(bosses.every((id) => getNpc(id).boss));
  assert.ok(codexList(game, { type: 'champion' }).every((id) => !getNpc(id).boss && getNpc(id).level >= 3));
  assert.deepEqual(new Set(codexList(game, { disc: 'seen' })), new Set(['chicken', 'goblin']));
  assert.equal(codexList(game, { disc: 'unseen' }).length, CODEX_IDS.length - 2);
  assert.deepEqual(codexList(game, { disc: 'seen', sort: 'kills' }), ['goblin', 'chicken']);
  const mid = codexList(game, { minLevel: 50, maxLevel: 120 });
  assert.ok(mid.length > 0 && mid.every((id) => getNpc(id).level >= 50 && getNpc(id).level <= 120));
  assert.ok(codexList(game, { race: 'undead' }).length > 0);
  const region = codexRegions(game)[0];
  assert.ok(codexList(game, { region }).every((id) => codexEntry(game, id).zones.includes(region)));
  assert.ok(codexList(game, { search: 'chick' }).includes('chicken'));
  const names = codexList(game, { sort: 'name' }).map((id) => getNpc(id).name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test('undiscovered entries hide drops and stats; a kill discovers them', () => {
  const game = freshGame();
  const before = codexEntry(game, 'goblin');
  assert.equal(before.discovered, false);
  assert.equal(before.drops, undefined, 'no drops before the first kill');
  assert.equal(before.life, undefined, 'no stats before the first kill');
  assert.ok(before.level > 0 && before.zones.length > 0, 'level and region still show');
  const html = codexEntryHTML(game, 'goblin');
  assert.ok(html.includes('???'), 'the name is hidden');
  assert.ok(!html.includes('cx-drops'), 'no drop list');
  assert.ok(html.includes('cx-silhouette') || html.includes('cx-noart'), 'shown as a silhouette');
  assert.ok(!codexListHTML(game, { ...defaultCodexState(), disc: 'all', search: 'goblin' }).includes('>Goblin<'), 'the list hides the name too');

  // Kill one the game's own way.
  const npc = game.npcs.find((n) => n.npcId === 'goblin' && n.alive);
  assert.ok(npc, 'a goblin lives in the world');
  game.killNpc(npc);
  assert.ok(isDiscovered(game, 'goblin'), 'the kill discovers it');
  const after = codexEntry(game, 'goblin');
  assert.equal(after.discovered, true);
  assert.ok(after.drops.length > 0, 'drops show after a kill');
  assert.ok(codexEntryHTML(game, 'goblin').includes('Goblin'));
  assert.equal(discoveredCount(game), 1);
  assert.equal(codexProgress(game).seen, 1);
});

test('stats shown match the definition, in the scaled numbers the game uses', () => {
  const game = freshGame();
  const big = CODEX_IDS.find((id) => !getNpc(id).boss && getNpc(id).level > 500);
  const boss = ALL_BOSS_IDS.find((id) => BOSS_ABILITIES[id] && SIGNATURE_CLASS[id]);
  for (const id of ['chicken', big, boss]) {
    game.kills[id] = 1;
    const d = getNpc(id), e = codexEntry(game, id);
    assert.equal(e.life, d.maxHp, `${id} life is the on-screen life`);
    assert.equal(e.attack, d.attack);
    assert.equal(e.defence, d.defence);
    assert.equal(e.maxHit, d.maxHit);
    assert.equal(e.aggressive, !!d.aggressive);
    assert.equal(e.numberScale, d.hpScale > 1 ? Math.round(d.hpScale * 10) / 10 : 1);
    const html = codexEntryHTML(game, id);
    assert.ok(html.includes(d.maxHp.toLocaleString('en-GB')) || html.includes(String(d.maxHp)), `${id} page shows its life`);
  }
  assert.ok(getNpc(big).hpScale > 1 && Math.abs(getNpc(big).hpScale - hpScaleFor(getNpc(big).level)) < 1e-9);
  assert.ok(codexEntryHTML(game, big).includes('Numbers ×1/'), 'a big monster says its numbers are scaled');
  // A boss shows its signature weapon, move and ground attacks.
  const e = codexEntry(game, boss);
  assert.equal(e.signature.item, `sig_${boss}`);
  assert.equal(e.ability.name, BOSS_ABILITIES[boss].name);
  assert.equal(e.ability.hazards.length, BOSS_ABILITIES[boss].hazards.length);
  const html = codexEntryHTML(game, boss);
  assert.ok(html.includes(getItem(`sig_${boss}`).name) && html.includes(BOSS_ABILITIES[boss].name));
  // Drop chances are sensible: between 0 and 1, always-drops at 1.
  for (const dr of dropChances(getNpc(boss))) assert.ok(dr.chance > 0 && dr.chance <= 1);
  assert.equal(chanceText(1), 'Always');
  assert.equal(chanceText(0.1), '1 in 10');
});

test('the codex pages render headlessly, a page of rows at a time', () => {
  const game = freshGame();
  game.kills = { chicken: 2 };
  const st = { ...defaultCodexState(), disc: 'all' };   // the silhouettes too (it opens on the Seen ones)
  const list = codexListHTML(game, st);
  assert.equal((list.match(/class="cx-row[ "]/g) || []).length, PAGE_SIZE, 'only one page of rows');
  assert.ok(list.includes('cx-more'), 'with a Show more button');
  assert.ok(codexListHTML(game, { ...st, shown: PAGE_SIZE * 2 }).match(/class="cx-row[ "]/g).length === PAGE_SIZE * 2);
  assert.ok(codexProgressHTML(game).includes(`1 / ${CODEX_IDS.length}`));
  for (const id of CODEX_IDS) assert.doesNotThrow(() => codexEntryHTML(game, id), id);
  // The Go button has somewhere to go.
  const spot = nearestSpawn(game, 'chicken');
  assert.ok(spot && Number.isFinite(spot.x) && Number.isFinite(spot.y));
  // Right-clicking finds the monster drawn under the pointer.
  const n = game.npcs.find((m) => m.npcId === 'chicken' && m.alive);
  const cam = { screenToWorld: (sx, sy) => ({ x: sx, y: sy }) };
  const hit = monsterAtScreen({ camera: cam, npcs: [n] }, (n.x + 0.5) * 32, (n.y + 0.5) * 32 - 10, 32);
  assert.equal(hit, n);
  assert.equal(monsterAtScreen({ camera: cam, npcs: [n] }, (n.x + 6) * 32, n.y * 32, 32), null);
});

test('codex milestones are achievements', () => {
  const game = freshGame();
  game.achievements = new Set();
  for (const id of CODEX_IDS.slice(0, 10)) game.kills[id] = 1;
  game.checkAchievements(true);
  assert.ok(game.achievements.has('codex_10'));
  assert.ok(!game.achievements.has('codex_50'));
});
