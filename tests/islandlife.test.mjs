import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { xpForLevel } from '../src/data/xp.js';
import { Game } from '../src/game/game.js';
import { islandPhotoArt, LANDINGS, LOOM, LOOMS, PHOTO_ASSIGNMENTS, STAGES, TUNES, VOYAGES } from '../src/data/islandlife.js';
import { encoreNotes, exploreCove, finishIslandTune, finishVoyage, islandBook, learnIslandTune, makeIslandPattern, recordIslandPhoto, restoreIslandLife } from '../src/game/islandlife.js';
import { saveGame } from '../src/game/save.js';
import { worldArtMax } from '../src/render/sprites.js';

function fresh() {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const g = new Game(); g.start(); g.chooseClass('rogue');
  return g;
}
function visit(g, { x, y }) {
  g.player.x = g.player.tx = x;
  g.player.y = g.player.ty = y;
  g.updateRegion();
}

test('voyages follow the chart, land at the correct port and open cove finds once', () => {
  const g = fresh();
  assert.equal(finishVoyage(g, 'ubin', [0, 1, 0]), false);
  visit(g, LANDINGS.changi);
  assert.equal(finishVoyage(g, 'ubin', [1, 1, 0]), false);
  assert.equal(finishVoyage(g, 'ubin', [0, 1, 0]), true);
  assert.equal(g.currentZoneName, 'Pulau Ubin');
  assert.equal(finishVoyage(g, 'changi', [1, 0, 1]), true);
  assert.equal(finishVoyage(g, 'cove', [1, 1, 0, 1]), true);
  assert.equal(exploreCove(g, 'line'), true);
  assert.equal(exploreCove(g, 'reef'), true);
  assert.equal(exploreCove(g, 'survey'), true);
  assert.equal(exploreCove(g, 'line'), false);
});

test('photos respect the location and dusk, award one print, and have display art', () => {
  const g = fresh();
  for (const p of PHOTO_ASSIGNMENTS) assert.ok(existsSync(new URL(`../${islandPhotoArt(p)}`, import.meta.url)), p.art);
  visit(g, PHOTO_ASSIGNMENTS[0]);
  g.dayPhase = () => .5;
  assert.equal(recordIslandPhoto(g), null);
  g.dayPhase = () => .75;
  assert.equal(recordIslandPhoto(g)?.id, 'dome');
  assert.equal(recordIslandPhoto(g), null);
});

test('textiles cost ingredients, music checks its stage and performance, and both persist', () => {
  const g = fresh();
  visit(g, LOOM);
  const coins = g.inventory.count('coins');
  assert.equal(makeIslandPattern(g, 'chilli'), false);
  g.inventory.add('chilli', 1);
  assert.equal(makeIslandPattern(g, 'chilli'), true);
  assert.equal(g.inventory.count('chilli'), 0);
  assert.equal(g.inventory.count('coins'), coins - 8);
  assert.equal(learnIslandTune(g, 'kopi'), false);
  visit(g, STAGES[0]);
  assert.equal(learnIslandTune(g, 'kopi'), true);
  assert.equal(finishIslandTune(g, 'kopi', [0, 1, 2, 1], 10), false);
  assert.equal(finishIslandTune(g, 'kopi', [0, 1, 1, 1], 1500), false);
  assert.equal(finishIslandTune(g, 'kopi', [0, 1, 2, 1], 1500), true);
  assert.equal(saveGame(g), true);
  const next = new Game(); next.start();
  assert.equal(islandBook(next).scarf, 'chilli');
  assert.deepEqual(islandBook(next).tunes, ['kopi']);
  assert.equal(next.skills.xp.music, g.skills.xp.music);
  assert.deepEqual(restoreIslandLife({ photos: ['unknown'], display: 'unknown' }), restoreIslandLife());
});

test('landings, looms and stages have art and Interact opens the right skill', () => {
  const g = fresh();
  let opened = null;
  g.ui = new Proxy({ openSkillGuide(skill) { opened = skill; } }, { get: (ui, key) => ui[key] || (() => {}) });
  for (const [id, skill, sites] of [
    ['sailing_landing', 'sailing', Object.values(LANDINGS)],
    ['batik_loom', 'textile_arts', LOOMS],
    ['busker_stage', 'music', STAGES],
  ]) for (const at of sites) {
    visit(g, at);
    const node = g.world.objectAt(at.x, at.y);
    assert.equal(node?.objId, id);
    assert.ok(worldArtMax(node), `${id} has painted world art`);
    assert.ok(!g.world.isBlocked(at.x, at.y), `${at.name} can still be stood on`);
    assert.equal(g._findInteract()?.ref, node, `${at.name} is the Interact target`);
    opened = null;
    g.interact();
    assert.equal(opened, skill);
  }
  const signs = g.world.objects.filter((o) => o.objId === 'sign').map((o) => o.sign || '');
  assert.equal(signs.filter((s) => s.startsWith('Sailing landing')).length, 2);
  assert.equal(signs.filter((s) => s.startsWith('Shell shallows')).length, 2);
});

test('advanced voyages unlock in route order and freight can pay once per route per day', () => {
  const g = fresh();
  g.skills.xp.sailing = xpForLevel(20);
  g.todayKey = () => '2026-11-28';
  const sail = (id, freight = false) => finishVoyage(g, id, VOYAGES.find((r) => r.id === id).course, { freight });
  visit(g, LANDINGS.changi);
  assert.equal(sail('marina'), false, 'chart Pulau Ubin first');
  assert.equal(sail('ubin', true), false, 'chart a route before hauling freight');
  assert.equal(sail('ubin'), true);
  assert.equal(sail('changi'), true);
  assert.equal(sail('marina'), true);
  assert.equal(sail('sentosa'), true);
  assert.equal(g.currentZoneName, 'Sentosa Beach');
  assert.equal(sail('sentosa_return'), true);
  const coins = g.inventory.count('coins');
  assert.equal(sail('sentosa', true), true);
  assert.equal(g.inventory.count('coins'), coins + 250);
  assert.equal(sail('sentosa_return'), true);
  assert.equal(sail('sentosa', true), false);
  assert.equal(saveGame(g), true);
  const next = new Game(); next.start(); next.todayKey = g.todayKey;
  assert.equal(finishVoyage(next, 'sentosa', VOYAGES.find((r) => r.id === 'sentosa').course, { freight: true }), false);
  next.todayKey = () => '2026-11-29';
  assert.equal(finishVoyage(next, 'sentosa', VOYAGES.find((r) => r.id === 'sentosa').course, { freight: true }), true);
});

test('collected photo assignments pay for fresh postcards on subsequent days', () => {
  const g = fresh();
  g.skills.xp.photography = xpForLevel(30);
  const p = PHOTO_ASSIGNMENTS.find((a) => a.id === 'temple');
  visit(g, p);
  g.todayKey = () => '2026-11-28';
  assert.equal(recordIslandPhoto(g).id, 'temple');
  assert.equal(recordIslandPhoto(g), null);
  g.todayKey = () => '2026-11-29';
  const coins = g.inventory.count('coins');
  assert.equal(recordIslandPhoto(g).commission, true);
  assert.equal(g.inventory.count('coins'), coins + 144);
  assert.equal(recordIslandPhoto(g), null);
  assert.deepEqual(islandBook(g).photos, ['temple']);
});

test('the Chinatown workshop buys learned designs and the Sentosa stage teaches encores', () => {
  const g = fresh();
  g.todayKey = () => '2026-11-28';
  g.skills.xp.textile_arts = xpForLevel(22);
  g.skills.xp.music = xpForLevel(22);
  visit(g, LOOMS[1]);
  g.inventory.add('butterfly_pea', 4);
  assert.equal(makeIslandPattern(g, 'butterfly', { order: true }), false);
  assert.equal(makeIslandPattern(g, 'butterfly'), true);
  assert.equal(makeIslandPattern(g, 'butterfly', { order: true }), true);
  assert.equal(g.inventory.count('butterfly_pea'), 1);
  assert.equal(makeIslandPattern(g, 'butterfly', { order: true }), false);
  const tune = TUNES.find((t) => t.id === 'tide');
  visit(g, STAGES[0]);
  assert.equal(learnIslandTune(g, 'tide'), false);
  visit(g, STAGES[2]);
  assert.equal(learnIslandTune(g, 'tide'), true);
  assert.equal(finishIslandTune(g, 'tide', encoreNotes(tune), 2400, { encore: true }), false);
  assert.equal(finishIslandTune(g, 'tide', tune.notes, 2400), true);
  assert.equal(finishIslandTune(g, 'tide', tune.notes, 2400, { encore: true }), false);
  assert.equal(finishIslandTune(g, 'tide', encoreNotes(tune), 2400, { encore: true }), true);
  assert.equal(finishIslandTune(g, 'tide', encoreNotes(tune), 2400, { encore: true }), false);
});

test('all 12 returned ascended weapons use their own icon rather than a donor', async () => {
  const { itemArtSrc, itemIconSVG } = await import('../src/render/icons.js');
  const { ITEMS } = await import('../src/data/items.js');
  for (const name of ['jade_dragon_sniper', 'jade_dragon_ranger', 'fenghuang_pistoler', 'fenghuang_gladiator',
    'celestial_garuda_merchant', 'celestial_garuda_corsair', 'jade_moon_hare_samurai', 'spirit_of_badang_rogue',
    'singa_of_temasek_swordsman', 'todak_king_brawler', 'eternal_wyrm_berserker', 'jenglot_sovereign_halberdier']) {
    const id = 'sig_' + name, path = `assets/icons/item-${id}.webp`;
    assert.ok(ITEMS[id].signature.ascended);
    assert.equal(itemArtSrc(id), path);
    assert.ok(itemIconSVG(id).includes(path));
    assert.ok(existsSync(new URL('../' + path, import.meta.url)));
  }
});
