// The encyclopedia (src/game/encyclopedia.js, discovery.js, regioninfo.js and
// the Codex window's Items, Places and Search sections in src/ui/): every item
// has a page, discoveries are noted, saved and backfilled for older saves,
// finished categories pay once, names in text link to their entries, and the
// Compendium covers the newer systems.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame } from '../src/game/save.js';
import { ITEMS, getItem } from '../src/data/items.js';
import { LORE } from '../src/data/lore.js';
import { ARTICLE_BY_ID, ARTICLES, articleBlocks } from '../src/data/compendium.js';
import { BOSS_MECHANICS, MECH_KINDS } from '../src/data/bossMechanics.js';
import { allItemIds, searchItems, itemKind, nearestSource, goToSource, findLinks, nameKey, searchAll } from '../src/game/encyclopedia.js';
import {
  discoveryCategories, discoveryTotals, claimDiscovery, obtainableItems, REWARD_LAMPS, REWARD_COINS_MIN,
} from '../src/game/discovery.js';
import { regionList, regionInfo } from '../src/game/regioninfo.js';
import { regionPageHTML, regionListHTML } from '../src/ui/regionui.js';
import { addRep } from '../src/game/reputation.js';
import { TRAIN_SKILLS, trainingFor, xpPerHour, ACTIONS_PER_HOUR, preyFor, myWeaponType, gearUpgrades } from '../src/game/foryou.js';
import { xpRate } from '../src/game/xprate.js';
import { gatherSources } from '../src/game/skillguide.js';
import { forYouHTML } from '../src/ui/foryouui.js';
import { makeXp } from '../src/game/skilling.js';
import { getNpc, ALL_MONSTER_IDS, ALL_BOSS_IDS } from '../src/data/npcs.js';
import { REGION_FLAVOUR, CREATURE_FLAVOUR, creatureFlavour } from '../src/data/flavour.js';
import { DISTRICT_VISUALS, districtArtwork } from '../src/data/districtVisuals.js';
import { weaponsFor, raceOf } from '../src/data/races.js';
import { XP_RATE, SAVE_KEY } from '../src/config.js';
import { xpForLevel } from '../src/data/xp.js';
import { encyState, encyclopediaPageHTML, itemEntryHTML, itemsListHTML, openEntry, renderEncyclopedia } from '../src/ui/encyclopediaui.js';
import { linkHTML } from '../src/ui/links.js';
import { codexSwitchHTML, markupHTML } from '../src/ui/compendiumui.js';
import { codexEntryHTML } from '../src/ui/codexui.js';
import { noteRecent, recentPages, RECENT_MAX, searchResultsHTML } from '../src/ui/searchui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
function reload(g, edit = null) {
  saveGame(g);
  if (edit) {
    const save = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY));
    edit(save);
    globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }
  const g2 = new Game();
  g2.start();
  g2.ui = new Proxy({}, { get: () => () => {} });
  return g2;
}
/** A stand-in UI: openModal draws into a fake body that keeps the HTML. */
function fakeUi(game) {
  const body = { innerHTML: '', scrollTop: 0, querySelector: () => null, insertAdjacentHTML() {} };
  return { game, body, modal: null, el: {}, closed: 0, openModal(title, render) { this.modal = { title, render }; render(body); }, closeModal() { this.closed++; }, openWorldMap() {} };
}

// ---------------- Discovery ----------------
test('items are found as they reach the pack or bank, and a new character starts with its kit found', () => {
  const g = newGame();
  g.doTick();
  for (const s of g.inventory.slots) if (s && s.id !== 'coins') assert.ok(g.discovery.items.has(s.id), `${s.id} from the starting kit is found`);
  assert.ok(!g.discovery.items.has('runite_ore'));
  g.inventory.add('runite_ore', 1);
  assert.ok(g.discovery.items.has('runite_ore'), 'picked up');
  g.bank.deposit('dragon_bones', 1);
  assert.ok(g.discovery.items.has('dragon_bones'), 'banked');
  assert.ok(!g.discovery.items.has('coins'), 'coins are not an entry');
});

test('discoveries are saved, and an older save backfills from its bag, bank, worn gear and Collection log', () => {
  const g = newGame();
  g.inventory.add('iron_ore', 3);
  g.discovery.places.add('ubin_quarry');
  g.discovery.claimed.add('regions');
  const g2 = reload(g);
  assert.ok(g2.discovery.items.has('iron_ore'));
  assert.ok(g2.discovery.places.has('ubin_quarry'));
  assert.ok(g2.discovery.claimed.has('regions'));
  // An older save: no discovery field at all.
  g2.inventory.remove('iron_ore', 3);
  g2.bank.deposit('gold_ore', 2);
  g2.collection.log['finds'] = { birds_nest: 1 };
  const g3 = reload(g2, (s) => { delete s.discovery; });
  assert.ok(g3.discovery.items.has('gold_ore'), 'from the bank');
  assert.ok(g3.discovery.items.has('birds_nest'), 'from the Collection log');
  assert.ok(g3.discovery.items.has(g3.equipment.slots.weapon), 'from worn gear');
  assert.ok(!g3.discovery.items.has('iron_ore'), 'gone before the encyclopedia existed: still to find');
  assert.equal(g3.discovery.claimed.size, 0);
});

test('discovery categories add up, and a finished one pays its reward once', () => {
  const g = newGame();
  g.doTick();
  const cats = discoveryCategories(g);
  for (const id of ['creatures', 'bosses', 'regions', 'lore', 'items:ore', 'items:gear']) assert.ok(cats.some((c) => c.id === id), `${id} is a category`);
  const lore = cats.find((c) => c.id === 'lore');
  assert.equal(lore.total, LORE.length);
  assert.equal(lore.seen, 0);
  const items = cats.filter((c) => c.group === 'Items').reduce((s, c) => s + c.total, 0);
  assert.equal(items, obtainableItems().length, 'every obtainable item is on exactly one shelf');
  const tot = discoveryTotals(g);
  assert.ok(tot.total > 1000 && tot.seen > 0);
  // Not finished: nothing to claim.
  assert.equal(claimDiscovery(g, 'lore'), false);
  // Finish the lore pages.
  for (const p of LORE) g.story.pages.add(p.id);
  const coins = g.inventory.count('coins'), lamps = g.inventory.count('forager_lamp');
  assert.equal(claimDiscovery(g, 'lore'), true);
  assert.equal(g.inventory.count('coins') - coins, Math.max(REWARD_COINS_MIN, discoveryCategories(g).find((c) => c.id === 'lore').reward.coins));
  assert.equal(g.inventory.count('forager_lamp') - lamps, REWARD_LAMPS);
  assert.equal(claimDiscovery(g, 'lore'), false, 'only once');
  assert.ok(discoveryCategories(g).find((c) => c.id === 'lore').claimed);
});

test('walking into a resource zone finds it', () => {
  const g = newGame();
  const z = g.world.resourceZones[0];
  assert.ok(z, 'the world has resource zones');
  g.player.x = z.cx; g.player.y = z.cy;
  g.doTick(); g.doTick();
  assert.ok(g.discovery.places.has(z.id));
  assert.equal(discoveryCategories(g).find((c) => c.id === 'zones').seen, 1);
});

// ---------------- Items ----------------
test('every item has an encyclopedia page that renders without a DOM', () => {
  const g = newGame();
  assert.equal(allItemIds().length, Object.keys(ITEMS).length - 1, 'every item but coins');
  for (const id of allItemIds()) {
    const html = itemEntryHTML(g, id);
    assert.ok(html.includes(getItem(id).name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')), `${id} shows its name`);
    assert.ok(!/undefined|NaN/.test(html), `${id} has no broken text`);
    assert.ok(itemKind(id), `${id} says what it is`);
  }
});

test('the item list searches by name, shelf and found, and hides unfound names until searched for', () => {
  const g = newGame();
  const ore = searchItems(g, { cat: 'ore' });
  assert.ok(ore.includes('iron_ore') && !ore.includes('iron_bar'));
  assert.deepEqual(searchItems(g, { search: 'iron ore' }), ['iron_ore']);
  g.inventory.add('iron_ore', 1);
  assert.ok(searchItems(g, { disc: 'seen' }).includes('iron_ore'));
  assert.ok(!searchItems(g, { disc: 'unseen' }).includes('iron_ore'));
  const st = { search: '', cat: 'ore', disc: 'all', shown: 40 };
  const list = itemsListHTML(g, st);
  assert.match(list, /Iron ore/, 'a found item is named');
  assert.match(list, /\?\?\?/, 'an unfound one is not');
  assert.match(itemsListHTML(g, { ...st, search: 'runite' }), /Runite ore/, 'unless you search for it');
});

test('an item page says who drops it, where it grows, what makes it, what it makes, and its price', () => {
  const g = newGame();
  const ore = itemEntryHTML(g, 'iron_ore');
  assert.match(ore, /Gathered/);
  assert.match(ore, /Iron rock/i);
  assert.match(ore, /Used in/);
  assert.match(ore, /Worth \d/);
  const bar = itemEntryHTML(g, 'bronze_bar');
  assert.match(bar, /Made/);
  const shop = itemEntryHTML(g, 'tinderbox');
  assert.match(shop, /sold at/);
});

test('Go heads for the nearest source you can use: a node, a shop or a monster', () => {
  const g = newGame();
  const rock = g.world.objects.find((o) => o.objId === 'copper_rock');
  g.player.x = rock.x + 1; g.player.y = rock.y;
  const rat = g.npcs.find((n) => n.npcId === 'feral_rat');
  const keep = g.npcs;
  g.npcs = keep.filter((n) => !n.def.attackable);   // no monster camped on the spot
  const s = nearestSource(g, 'copper_ore');
  assert.equal(s.kind, 'node', 'standing beside a copper rock');
  assert.ok(s.dist <= 1);
  g.npcs = keep;
  assert.ok(rat);
  assert.ok(s.objIds.includes('copper_rock'));
  g.player.x = g.world.spawnPoint.x; g.player.y = g.world.spawnPoint.y;
  assert.ok(goToSource(g, 'copper_ore'), 'walks there');
  assert.ok(g.player.action || g.player.isMoving);
  // Something only a shop sells: the shop.
  const t = nearestSource(g, 'tinderbox');
  assert.equal(t.kind, 'shop');
  // Nothing anywhere: a polite no.
  assert.equal(nearestSource(g, 'coins_that_do_not_exist'), null);
});

// ---------------- Places ----------------
test('every region has a page with its level band and what lives there', () => {
  const g = newGame();
  const list = regionList(g);
  assert.equal(list.length, g.world.zones.filter((z) => !z.instance).length);
  assert.ok(list.find((r) => r.name === 'Kampong Glam').visited, 'you start in Kampong Glam');
  const ubin = regionInfo(g, 'Pulau Ubin');
  assert.ok(ubin.monsters.length > 0 && ubin.band);
  assert.equal(regionInfo(g, 'Nowhere'), null);
  // Its MRT stop, quest giver, resource zone and your standing there.
  assert.ok(ubin.stations.some((s) => s.id === 'pulau_ubin'));
  assert.ok(ubin.givers.some((q) => q.id === 'rq_uncle_seng'));
  assert.ok(ubin.zones.some((z) => z.id === 'ubin_quarry'));
  assert.equal(ubin.rep.rank.id, 'stranger');
  assert.deepEqual(ubin.go, { x: ubin.stations[0].x, y: ubin.stations[0].y }, 'Go heads for its MRT stop');
  // Every region's Go lands inside it, and every page renders headlessly.
  for (const r of list) {
    const info = regionInfo(g, r.name);
    assert.equal(g.world.zoneAt(info.go.x, info.go.y)?.name, r.name, `${r.name}: Go stays in the region`);
    const html = regionPageHTML(g, r.name);
    assert.ok(html.includes(r.name) && !/undefined|NaN/.test(html), `${r.name} renders`);
  }
  assert.match(regionPageHTML(g, 'Pulau Ubin'), /Ubin Granite Quarry/);
  assert.match(regionPageHTML(g, 'Pulau Ubin'), /data-goxy=/);
  // Reputation shows as it grows.
  addRep(g, 'Pulau Ubin', 350, '', true);
  assert.equal(regionInfo(g, 'Pulau Ubin').rep.rank.id, 'friend');
  const places = regionListHTML(g);
  assert.match(places, /data-region="Kampong Glam"[^>]*>.*assets\/places\/kampong-glam\.webp/);
  const unvisited = /<button[^>]*data-region="Pulau Ubin"[^>]*>(.*?)<\/button>/.exec(places)[1];
  assert.match(unvisited, /Not visited/);
  assert.doesNotMatch(unvisited, /<img|<b>Pulau Ubin/);
  g.zonesVisited.add('Pulau Ubin');
  assert.match(regionListHTML(g), /data-region="Pulau Ubin"[^>]*>.*assets\/world\/obj-stilt_house\.webp/);
  assert.match(regionPageHTML(g, 'Kampong Glam'), /ency-place-hero.*kampong-glam\.webp.*Golden-domed hall/);
});

test('the field guide artwork resolves to shipped game assets', () => {
  for (const name of Object.keys(DISTRICT_VISUALS)) {
    const { src, scenery } = districtArtwork(name);
    assert.ok(existsSync(new URL(`../${scenery || src}`, import.meta.url)), `${name} has artwork`);
  }
  assert.equal(districtArtwork('Unknown place'), null);
});

// ---------------- The window ----------------
test('the Codex window has Items, Places and Search sections that render headlessly', () => {
  const g = newGame();
  const ui = fakeUi(g);
  const sw = codexSwitchHTML('items');
  for (const v of ['monsters', 'items', 'places', 'compendium', 'search']) assert.match(sw, new RegExp(`data-view="${v}"`));
  for (const v of ['items', 'places', 'search']) {
    const html = encyclopediaPageHTML(ui, v);
    assert.match(html, /cx-switch/);
    assert.ok(!/undefined|NaN/.test(html), `${v} has no broken text`);
  }
  assert.match(encyclopediaPageHTML(ui, 'search'), /Your discoveries/);
  assert.doesNotThrow(() => renderEncyclopedia(ui, null, 'items'));
});

test('openEntry opens the right section at the right entry, and notes it as recent', () => {
  const g = newGame();
  const ui = fakeUi(g);
  openEntry(ui, 'item', 'iron_ore');
  assert.equal(ui._codex.view, 'items');
  assert.equal(encyState(ui).items.id, 'iron_ore');
  assert.match(ui.body.innerHTML, /Iron ore/);
  openEntry(ui, 'region', 'Pulau Ubin');
  assert.equal(ui._codex.view, 'places');
  assert.match(ui.body.innerHTML, /Pulau Ubin/);
  const draw = ui.openModal;
  ui.openModal = function (title) { this.modal = { title }; };   // a monster's entry builds DOM controls
  openEntry(ui, 'monster', 'macaque');
  ui.openModal = draw;
  assert.equal(ui._codex.view, 'monsters');
  assert.equal(ui._codex.id, 'macaque');
  openEntry(ui, 'article', 'mrt');
  assert.equal(ui._codex.view, 'compendium');
  assert.deepEqual(recentPages(ui).slice(0, 4).map((r) => r.kind), ['article', 'monster', 'region', 'item']);
  for (let i = 0; i < 20; i++) noteRecent(ui, 'item', `x${i}`);
  assert.equal(recentPages(ui).length, RECENT_MAX, 'the list stays short');
  assert.ok(JSON.parse(globalThis.localStorage.getItem('aw-ency-recent')).length === RECENT_MAX, 'kept in this browser');
});

// ---------------- Links ----------------
test('names in text become links: monsters, items, skills and regions, longest name first', () => {
  const runs = findLinks('An Elder macaque dropped iron ore near Pulau Ubin. Woodcutting is calm.', ['Pulau Ubin']);
  const links = runs.filter((r) => r.link).map((r) => `${r.link.kind}:${r.link.id}`);
  assert.deepEqual(links, ['monster:elder_macaque', 'item:iron_ore', 'region:Pulau Ubin', 'skill:woodcutting']);
  assert.equal(runs.map((r) => r.text).join(''), 'An Elder macaque dropped iron ore near Pulau Ubin. Woodcutting is calm.', 'no text is lost');
  // Everyday words are left alone.
  assert.ok(!findLinks('You get some logs and coins.').some((r) => r.link));
  assert.equal(nameKey("St John's Island"), "st john's island");
  const g = newGame();
  const html = linkHTML(g, 'A <b> macaque & iron ore');
  assert.match(html, /&lt;b&gt;/, 'escaped');
  assert.match(html, /data-ency="item:iron_ore"/);
  // The Compendium's plain words link too, and its own markup still works.
  assert.match(markupHTML('Mine **iron ore** with [[mrt]] near Pulau Ubin'), /data-ency="region:Pulau Ubin"/);
  // Codex drops and habitats link to their pages.
  g.kills.macaque = 1;
  const entry = codexEntryHTML(g, 'macaque');
  assert.match(entry, /data-ency="item:/);
  assert.match(entry, /data-ency="region:/);
});

// ---------------- Compendium ----------------
test('the Compendium covers the newer systems, and each boss mechanic has its own page', () => {
  for (const id of ['main-story', 'story-events', 'lore-pages', 'reputation', 'choices', 'npc-memory', 'npc-routines',
    'gathering-streaks', 'lucky-finds', 'skilling-contracts', 'resource-zones', 'teleports', 'bestiary-expansion', 'encyclopedia', 'discoveries']) {
    assert.ok(ARTICLE_BY_ID[id], `there is an article on ${id}`);
  }
  for (const kind of Object.keys(MECH_KINDS)) {
    const a = ARTICLE_BY_ID[`mech-${kind}`];
    assert.ok(a, `${kind} has a page`);
    const text = articleBlocks(a).filter((b) => typeof b === 'string').join(' ');
    for (const [, m] of Object.entries(BOSS_MECHANICS).filter(([, m]) => m.type === kind).slice(0, 3)) assert.ok(text.length > 0 && m);
  }
  assert.ok(ARTICLES.length >= 80);
});

// ---------------- For you ----------------
test('For you suggests a training spot for each life skill at your level, with its XP an hour', () => {
  const g = newGame();
  for (const skill of TRAIN_SKILLS) {
    const [s] = trainingFor(g, skill, 1);
    assert.ok(s, `${skill} has somewhere to train at level 1`);
    assert.ok(s.level <= g.skills.level(skill), `${skill}: nothing above your level`);
    // A node's hour is the skill guide's (xprate.js); a recipe's the rough "up to".
    const src = gatherSources().find((x) => x.skill === skill && x.level === s.level && x.name === s.name.replace(/ \(.*\)$/, ''));
    if (s.rough) assert.equal(s.xph, xpPerHour(g, skill, makeXp(g, skill, s.xp)), `${skill}: a rough figure (a make at its making multiple)`);
    else assert.equal(s.xph, Math.round(xpRate(g, src).perHour), `${skill}: the guide's figure`);
    assert.ok(s.xph > 0);
  }
  assert.equal(trainingFor(g, 'woodcutting', 1)[0].rough, false, 'a tree: the guide\'s figure');
  assert.equal(trainingFor(g, 'smithing', 1)[0].rough, true, 'a recipe: rough');
  // The rough figure follows the game's pace: XP_RATE, the life skill boost and one action a tick (sped up).
  assert.equal(xpPerHour(g, 'mining', 10), Math.round(10 * XP_RATE * g.skills.lifeXpMult('mining') * ACTIONS_PER_HOUR));
  // A higher level unlocks better spots.
  const low = trainingFor(g, 'mining', 1)[0];
  g.skills.xp.mining = xpForLevel(60);
  const high = trainingFor(g, 'mining', 1)[0];
  assert.ok(high.xph > low.xph && high.level >= low.level);
  // Its line says which kind of figure it is.
  const html = forYouHTML(g);
  assert.match(html, /≈ [\d.,]+[KMB]? xp\/h/);
  assert.match(html, /up to ~[\d.,]+[KMB]? xp\/h/);
});

test('For you finds prey your weapon is strong against near your level, and gear upgrades you can get', () => {
  const g = newGame();
  const type = myWeaponType(g);
  assert.ok(type, 'a melee starter holds a weapon');
  const prey = preyFor(g);
  assert.ok(prey.length > 0);
  const fight = g.fightLevel();
  for (const m of prey) {
    assert.ok(weaponsFor(raceOf(getNpc(m.id), m.id)).strong.includes(type), `${m.id} is weak to a ${type}`);
    assert.ok(Math.abs(m.level - fight) <= 12 && !getNpc(m.id).boss);
  }
  const ups = gearUpgrades(g);
  assert.ok(ups.length > 0, 'a starter can buy something better');
  for (const u of ups) {
    assert.ok(g._canEquipNow(u.id), `${u.id} can be worn now`);
    assert.ok(u.gain > 0 && (u.source || u.make), `${u.id} beats what is worn and can be got`);
  }
  assert.equal(new Set(ups.map((u) => u.slot)).size, ups.length, 'one per slot');
  const html = forYouHTML(g);
  assert.match(html, /Train your skills/);
  assert.match(html, /xp\/h/);
  assert.match(html, /Gear you could wear now/);
  assert.ok(!/undefined|NaN/.test(html));
});

// ---------------- Did you know? ----------------
test('every "Did you know?" belongs to a real region or creature, and shows on its page', () => {
  const g = newGame();
  const regions = new Set(g.world.zones.map((z) => z.name));
  for (const [name, text] of Object.entries(REGION_FLAVOUR)) {
    assert.ok(regions.has(name), `${name} is a region`);
    assert.ok(text.length > 30 && text.length < 260 && /[.!]$/.test(text), `${name}: one or two short sentences`);
    assert.ok(!/\bcolor|\bfavorite|\bcenter\b/.test(text), `${name}: British spelling`);
  }
  for (const real of ['Kampong Glam', 'Chinatown', 'Bukit Timah', 'Pulau Ubin', 'Sungei Buloh Wetlands', 'Marina Bay', 'Gardens by the Bay', 'Mandai Rainforest']) {
    assert.ok(REGION_FLAVOUR[real], `${real} has a note`);
  }
  const families = new Set();
  for (const id of [...ALL_MONSTER_IDS, ...ALL_BOSS_IDS]) { families.add(id); if (getNpc(id).family) families.add(getNpc(id).family); }
  for (const [key, text] of Object.entries(CREATURE_FLAVOUR)) {
    assert.ok(families.has(key), `${key} is a monster family`);
    assert.ok(text.length > 20 && text.length < 260, `${key}: short`);
    assert.ok(!/\bcolor|\bfavorite|\bcenter\b/.test(text), `${key}: British spelling`);
  }
  for (const real of ['smooth_otter', 'pangolin', 'colugo', 'hornbill', 'kancil', 'monitor_lizard']) assert.ok(CREATURE_FLAVOUR[real], `${real} has a note`);
  assert.match(regionPageHTML(g, 'Pulau Ubin'), /Did you know\?/);
  const otter = ALL_MONSTER_IDS.find((id) => getNpc(id).family === 'smooth_otter');
  assert.match(codexEntryHTML(g, otter), /Did you know\?[\s\S]*romps/);
  assert.equal(creatureFlavour(getNpc('goblin'), 'goblin'), '', 'no fantasy facts');
});

// ---------------- Search ----------------
test('one search finds monsters, items, places and Compendium articles, closest names first', () => {
  const g = newGame();
  const r = searchAll(g, 'otter');
  assert.ok(r.monsters.some((m) => m.id === 'smooth_otter'));
  assert.equal(searchAll(g, 'iron ore').items[0].id, 'iron_ore', 'an exact name comes first');
  assert.ok(searchAll(g, 'ubin').regions.some((x) => x.id === 'Pulau Ubin'));
  assert.ok(searchAll(g, 'reputation').articles.some((a) => a.id === 'reputation'));
  assert.deepEqual(searchAll(g, ''), { monsters: [], items: [], regions: [], articles: [] });
  const ui = fakeUi(g);
  const html = searchResultsHTML(ui, 'iron');
  assert.match(html, /data-item="iron_ore"/);
  assert.match(html, /data-seeall="items"/, 'a long list offers See all');
  assert.match(searchResultsHTML(ui, 'no such thing anywhere'), /Nothing matches/);
  encyState(ui).search.query = 'pangolin';
  const page = encyclopediaPageHTML(ui, 'search');
  assert.match(page, /ency-all-search/);
  assert.match(page, /data-monster="pangolin"/);
  assert.match(page, /Your discoveries/);
});
