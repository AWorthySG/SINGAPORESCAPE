// The Compendium (src/data/compendium.js, src/ui/compendiumui.js): the game
// guide in the Codex window. Every article is complete, every link leads
// somewhere, search finds articles by title and by body, the tables are built
// from the game's own data, and the window switches to it without a DOM.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CHAPTERS, ARTICLES, ARTICLE_BY_ID, articleBlocks, relatedOf, linksIn, searchArticles, plainText,
  masteryRankRows, qualityRows, qualityChance, gearTierRows, monsterRankRows, regionRows, prayerRows, mechanicRows,
  classRows, goldenHourRows, shrineRows, gateModRows, mrtRows, storyQuestRows, regionQuestRows, unlockRows,
} from '../src/data/compendium.js';
import {
  compendiumArticleHTML, compendiumHomeHTML, compendiumResultsHTML, compendiumPageHTML, markupHTML, renderCompendium, defaultCompendiumState,
} from '../src/ui/compendiumui.js';
import { openCompendium } from '../src/ui/codexui.js';
import { MASTERY_RANKS } from '../src/game/mastery.js';
import { QUALITY_ORDER, QUALITY, QUALITY_RULES, rollQualityStep, qualityKey } from '../src/game/loot.js';
import { PRAYERS } from '../src/data/prayers.js';
import { BOSS_MECHANICS } from '../src/data/bossMechanics.js';
import { CLASSES } from '../src/data/classes.js';
import { SKILL_HOURS } from '../src/data/skillhours.js';
import { SKILL_UNLOCKS } from '../src/data/unlocks.js';
import { SHRINE_TRACKS } from '../src/game/shrine.js';
import { GATE_MODS } from '../src/game/waves.js';
import { STATIONS } from '../src/data/transport.js';
import { REGION_LINES } from '../src/data/regionQuests.js';
import { ALL_MONSTER_IDS, getNpc } from '../src/data/npcs.js';
import { mulberry32 } from '../src/game/pets.js';

const strings = (b) => (typeof b === 'string' ? [b] : b.list || (b.tip ? [b.tip] : b.keys ? b.keys.flat() : []));

test('every article has a title, a one-line summary and a body', () => {
  assert.ok(CHAPTERS.length >= 10, 'ten chapters or more');
  const ids = new Set();
  for (const ch of CHAPTERS) {
    assert.ok(ch.title && ch.icon && ch.articles.length, `chapter ${ch.id} is complete`);
    for (const a of ch.articles) {
      assert.ok(!ids.has(a.id), `${a.id} is unique`);
      ids.add(a.id);
      assert.ok(a.title?.trim(), `${a.id} has a title`);
      assert.ok(a.summary?.trim() && !a.summary.includes('\n'), `${a.id} has a one-line summary`);
      const blocks = articleBlocks(a);
      assert.ok(blocks.length, `${a.id} has a body`);
      for (const b of blocks) {
        assert.ok(typeof b === 'string' ? b.trim() : (b.list?.length || b.tip || b.keys?.length || b.table?.rows?.length), `${a.id} has no empty block`);
        if (b.table) for (const r of b.table.rows) assert.equal(r.length, b.table.head.length, `${a.id}: a table row fits its head`);
      }
    }
  }
  assert.equal(ids.size, ARTICLES.length);
});

test('the topics the guide promises are all there', () => {
  for (const id of ['controls-keyboard', 'controls-phone', 'classes', 'weapon-grips', 'weakness', 'crits', 'abilities', 'prayers',
    'monster-ranks', 'champions', 'bosses', 'boss-mechanics', 'world-bosses', 'drops', 'rare-table', 'clues', 'collection-log', 'pets',
    'gear-tiers', 'mastery', 'quality', 'enchanting', 'refining', 'upgrade-materials', 'carry-over', 'equip-best', 'salvage', 'offering-shrine',
    'golden-hours', 'skill-unlocks', 'skill-chains', 'auto-battle', 'auto-gather', 'auto-quest', 'focus-rested',
    'story-quests', 'region-quests', 'bounties', 'world-events', 'slayer', 'pest-control', 'regions', 'mrt', 'home', 'endless-gate',
    'death', 'saving']) {
    assert.ok(ARTICLE_BY_ID[id], `there is an article on ${id}`);
  }
  // Every life skill with an unlock ladder has its own article.
  for (const s of Object.keys(SKILL_UNLOCKS)) assert.ok(ARTICLE_BY_ID[`skill-${s}`], `${s} has an article`);
});

test('every link, inline or related, leads to a real article', () => {
  for (const a of ARTICLES) {
    for (const b of articleBlocks(a)) for (const t of strings(b)) for (const id of linksIn(t)) assert.ok(ARTICLE_BY_ID[id], `${a.id} links to ${id}`);
    for (const id of a.see || []) assert.ok(ARTICLE_BY_ID[id], `${a.id} sees ${id}`);
    for (const id of relatedOf(a)) assert.notEqual(id, a.id, `${a.id} does not link to itself`);
  }
  // Inline links are offered again as Related chips (big enough to tap).
  assert.ok(relatedOf(ARTICLE_BY_ID.welcome).includes('classes'));
  assert.ok(relatedOf(ARTICLE_BY_ID.welcome).includes('panels'));
});

test('search finds articles by title and by body text', () => {
  const ids = (q) => searchArticles(q).map((h) => h.article.id);
  assert.deepEqual(ids(''), []);
  assert.ok(ids('gravestone').includes('death'), 'a word in the title');
  assert.ok(ids('Gravestone').includes('death'), 'case does not matter');
  // "kerambits" is only in the body of the grips article, and in the class table.
  assert.ok(ids('kerambits').includes('weapon-grips'), 'a word in the body');
  assert.ok(!ARTICLE_BY_ID['weapon-grips'].title.toLowerCase().includes('kerambit'));
  // A word inside a generated table counts too (a station name).
  assert.ok(ids('Punggol Point').includes('mrt'));
  // Title matches come before body matches.
  const hits = searchArticles('mastery');
  const firstBody = hits.findIndex((h) => !h.inTitle);
  assert.ok(hits[0].inTitle && (firstBody < 0 || hits.slice(firstBody).every((h) => !h.inTitle)));
  // Every word must match; a nonsense word finds nothing.
  assert.deepEqual(ids('qwertyzzz'), []);
  assert.ok(ids('auto dodge').includes('auto-battle'));
  // A body match carries a snippet of the text around it, links and bold resolved.
  const h = searchArticles('kerambits').find((x) => x.article.id === 'weapon-grips');
  assert.match(h.snippet, /kerambits/i);
  assert.ok(!h.snippet.includes('**') && !h.snippet.includes('[['));
  assert.equal(plainText('Ride the [[mrt|train]] or see [[mrt]] **now**'), 'Ride the train or see The MRT now');
});

test('the tables are built from the game\'s own data', () => {
  assert.deepEqual(masteryRankRows().map((r) => r[0]), MASTERY_RANKS.map((r) => (r.worldBoss ? `${r.name} (world bosses)` : r.name)));
  assert.deepEqual(masteryRankRows().map((r) => r[1]), MASTERY_RANKS.map((r) => r.xp.toLocaleString('en-GB')));
  assert.deepEqual(qualityRows().map((r) => r[0]), QUALITY_ORDER.map((k) => QUALITY[k].label));
  assert.deepEqual(qualityRows().map((r) => r[1]), QUALITY_ORDER.map((k) => `+${Math.round(QUALITY[k].gain * 100)}%`));
  assert.equal(prayerRows().length, PRAYERS.length);
  assert.deepEqual(prayerRows().map((r) => r[0]), PRAYERS.map((p) => p.name));
  assert.equal(classRows().length, CLASSES.length);
  assert.equal(goldenHourRows().length, Object.keys(SKILL_HOURS).length);
  assert.equal(shrineRows().length, Object.keys(SHRINE_TRACKS).length);
  assert.equal(gateModRows().length, Object.keys(GATE_MODS).length);
  assert.equal(mrtRows().length, STATIONS.length);
  assert.equal(regionQuestRows().length, REGION_LINES.length);
  assert.ok(storyQuestRows().every(([name]) => !REGION_LINES.some((l) => l.name === name)), 'story quests leave out the region lines');
  assert.equal(mechanicRows().reduce((s, r) => s + Number(r[2]), 0), Object.keys(BOSS_MECHANICS).length);
  assert.deepEqual(unlockRows('mining').map((r) => r[1]), SKILL_UNLOCKS.mining.map((u) => u.name));
  // Gear tiers run Bronze to Eternal, in level order.
  const tiers = gearTierRows();
  assert.equal(tiers[0][0], 'Bronze');
  assert.equal(tiers[tiers.length - 1][0], 'Eternal');
  // Monster ranks: the six common ranks and the three endgame ones.
  assert.deepEqual(monsterRankRows().map((r) => r[0]), ['Young', 'Wild', 'Feral', 'Elder', 'Dire', 'Ancient', 'Mythic', 'Primordial', 'Eternal']);
  // Regions: every region a monster lives in, with its real level range.
  const zones = new Set(ALL_MONSTER_IDS.map(getNpc).filter((d) => d.attackable && d.zone).map((d) => d.zone));
  const rows = regionRows();
  assert.deepEqual(new Set(rows.map((r) => r[0])), zones);
  const bt = ALL_MONSTER_IDS.map(getNpc).filter((d) => d.attackable && d.zone === 'Bukit Timah').map((d) => d.level);
  assert.equal(rows.find((r) => r[0] === 'Bukit Timah')[1], `${Math.min(...bt).toLocaleString('en-GB')}–${Math.max(...bt).toLocaleString('en-GB')}`);
  // A retuned rank shows up in the article straight away.
  const old = MASTERY_RANKS[1].name;
  MASTERY_RANKS[1].name = 'Testrank';
  try { assert.match(compendiumArticleHTML('mastery'), /Testrank/); } finally { MASTERY_RANKS[1].name = old; }
});

test('the quality odds match the drop roll', () => {
  for (const src of Object.keys(QUALITY_RULES)) {
    const total = QUALITY_ORDER.reduce((s, k) => s + qualityChance(src, k), 0);
    assert.ok(Math.abs(total - QUALITY_RULES[src].start) < 1e-9, `${src}: the tiers add up to the chance of any quality`);
    const rand = mulberry32(1234), n = 200000, seen = {};
    for (let i = 0; i < n; i++) { const k = qualityKey(rollQualityStep(src, rand)); if (k) seen[k] = (seen[k] || 0) + 1; }
    for (const k of QUALITY_ORDER) assert.ok(Math.abs((seen[k] || 0) / n - qualityChance(src, k)) < 0.006, `${src} ${k}`);
  }
});

test('the keyboard article lists every hotkey the game listens for', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const letters = [...new Set([...main.matchAll(/e\.key === '([a-z])'/g)].map((m) => m[1].toUpperCase()))];
  assert.ok(letters.length >= 10);
  const keys = articleBlocks(ARTICLE_BY_ID['controls-keyboard']).find((b) => b.keys).keys.map(([k]) => k);
  for (const l of letters) assert.ok(keys.some((k) => k.split(/ or | /).includes(l)), `${l} is listed`);
  for (const k of ['Tab', 'Esc', 'Z X C V B', '1 2 3 4 5']) assert.ok(keys.includes(k) || keys.some((x) => x.includes(k)), `${k} is listed`);
});

test('every article renders to HTML without a DOM', () => {
  for (const a of ARTICLES) {
    const html = compendiumArticleHTML(a.id);
    assert.ok(html.includes(a.title.replace(/&/g, '&amp;').replace(/'/g, "'")), `${a.id} shows its title`);
    assert.ok(!html.includes('[[') && !html.includes('**'), `${a.id}: all markup is turned into HTML`);
    assert.ok(!/undefined|NaN|Infinity/.test(html.replace(/data-[a-z]+="[^"]*"/g, '')), `${a.id} has no broken numbers`);
  }
  assert.match(markupHTML('See [[mrt|the train]] **now**'), /<button type="button" class="cp-link" data-article="mrt">the train<\/button> <b>now<\/b>/);
  assert.match(markupHTML('<script>'), /&lt;script&gt;/);
  const home = compendiumHomeHTML();
  for (const ch of CHAPTERS) assert.ok(home.includes(ch.title.replace(/&/g, '&amp;')), `home lists ${ch.title}`);
  assert.match(compendiumResultsHTML('zzzznothing'), /No articles match/);
  assert.match(compendiumPageHTML({ ...defaultCompendiumState(), id: 'mrt' }), /All chapters/);
});

test('the Codex window switches to the Compendium headlessly', () => {
  // A stand-in modal: openModal draws into a fake body that keeps the HTML and one click listener.
  const wrap = { on: {}, addEventListener(t, f) { this.on[t] = f; }, querySelector: () => null };
  const body = { innerHTML: '', scrollTop: 0, querySelector: (sel) => (sel === '.cp-wrap' ? wrap : null) };
  const ui = { game: {}, modal: null, el: {}, openModal(title, render) { this.modal = { title, render }; render(body); } };
  openCompendium(ui, 'mastery');
  assert.equal(ui._codex.view, 'compendium');
  assert.equal(ui.modal.title, 'Compendium');
  assert.equal(ui.modal.kind, 'codex');
  assert.match(body.innerHTML, /cx-switch/);
  assert.match(body.innerHTML, /Gear mastery/);
  // Tapping a related article goes there, and Back goes home.
  wrap.on.click({ target: { closest: () => ({ dataset: { article: 'mrt' } }) } });
  assert.equal(ui._compendium.id, 'mrt');
  assert.match(body.innerHTML, /The MRT/);
  wrap.on.click({ target: { closest: () => ({ dataset: { home: '1' } }) } });
  assert.equal(ui._compendium.id, null);
  assert.match(body.innerHTML, /Search the Compendium/);
  // The switch hands back to the Monsters view.
  let switched = null;
  renderCompendium(body, ui._compendium, (v) => { switched = v; });
  wrap.on.click({ target: { closest: () => ({ dataset: { view: 'monsters' } }) } });
  assert.equal(switched, 'monsters');
  // No body at all is fine too.
  assert.doesNotThrow(() => renderCompendium(null, defaultCompendiumState()));
});
