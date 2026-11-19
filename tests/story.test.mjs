// The main story spine (src/data/story.js, src/game/story.js), its lore pages
// (src/data/lore.js, src/game/lore.js), story events and chapter scenes
// (src/game/cutscene.js): chapters open and close from quest progress and pay
// their rewards, lore pages drop, hide and complete sets, everything saves,
// story events clean up after themselves, and the scene machine never traps.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { CHAPTERS, RAIDERS } from '../src/data/story.js';
import { LORE, LORE_SETS, STORY_SET, STORY_SET_REWARD } from '../src/data/lore.js';
import { REGION_LINES } from '../src/data/regionQuests.js';
import { QUESTS } from '../src/data/quests.js';
import { ITEMS } from '../src/data/items.js';
import { NPCS } from '../src/data/npcs.js';
import { Cutscene, SCENE_IN_MS, SCENE_OUT_MS, LINE_GUARD_MS, lineMs } from '../src/game/cutscene.js';
import { spotTile, guardianKind } from '../src/game/lore.js';
import { storyPanelHTML, speakerArt } from '../src/ui/storyui.js';

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

/** A second game reading the first one's save (same fake storage). */
function reload(g) {
  saveGame(g);
  const g2 = new Game();
  g2.start();
  g2.ui = new Proxy({}, { get: () => () => {} });
  return g2;
}

const finish = (g, ids) => { for (const id of ids) g.quests[id].state = 'done'; };
const ticks = (g, n) => { for (let i = 0; i < n; i++) g.doTick(); };
const killFor = (g, npc) => { npc.hp = 0; g.killNpc(npc); };
const storyNpcs = (g) => g.npcs.filter((n) => n.storyEvent);

// ---------------- Data ----------------
test('the story runs from Kampong Glam to the Celestial Peaks, every region line in one chapter, in order', () => {
  assert.equal(CHAPTERS.length, 12);
  const lines = CHAPTERS.flatMap((c) => c.quests.filter((q) => q.startsWith('rq_')));
  assert.deepEqual(lines, REGION_LINES.map((l) => l.id), 'every region line exactly once, in journey order');
  assert.deepEqual(CHAPTERS[0].regions, ['Kampong Glam', 'Chinatown']);
  assert.deepEqual(CHAPTERS.at(-1).regions, ['The Celestial Peaks']);
  for (const c of CHAPTERS) {
    for (const q of c.quests) assert.ok(QUESTS.some((d) => d.id === q), `${c.id}: ${q} is a quest`);
    for (const part of ['intro', 'outro']) {
      assert.ok(c[part].length >= 1 && c[part].length <= 4, `${c.id} ${part} has 1-4 lines`);
      for (const l of c[part]) assert.ok(NPCS[l.who] && !NPCS[l.who].attackable, `${c.id}: ${l.who} is a townsperson or quest giver`);
    }
    assert.ok(c.intro.length >= 2 && c.outro.length >= 1);
    const r = c.reward;
    assert.ok(r.coins > 0 && ITEMS[r.item[0]] && r.item[1] > 0 && r.title && r.badge, `${c.id} has a full reward`);
  }
  assert.equal(new Set(CHAPTERS.map((c) => c.reward.title)).size, CHAPTERS.length, 'every title is different');
});

test('40-60 lore pages of 2-5 sentences, every region a set of drop + hidden spot, every chapter a page', () => {
  assert.ok(LORE.length >= 40 && LORE.length <= 60, `${LORE.length} pages`);
  assert.equal(new Set(LORE.map((p) => p.id)).size, LORE.length, 'unique ids');
  for (const p of LORE) {
    const n = (p.text.match(/[.!?](?=\s|$|[)”"’])/g) || []).length;
    assert.ok(n >= 1 && n <= 6, `${p.id} is short (${n} sentences)`);
    assert.ok(p.text.length >= 60 && p.text.length <= 420, `${p.id} is 2-5 sentences long`);
  }
  for (const l of REGION_LINES) {
    const set = LORE_SETS.find((s) => s.region === l.region);
    assert.deepEqual(set.pages.map((p) => p.from).sort(), ['drop', 'spot'], `${l.region} has a drop and a spot page`);
    assert.ok(guardianKind(l.region) && NPCS[guardianKind(l.region)].attackable, `${l.region} has a guardian kind`);
  }
  for (const c of CHAPTERS) assert.ok(LORE.some((p) => p.chapter === c.id), `${c.id} gives a page`);
});

// ---------------- Chapters ----------------
test('a new game opens chapter 1; finishing its quests pays the reward, gives its page and opens chapter 2', () => {
  const g = newGame();
  const s = g.story;
  assert.equal(s.ch, 0);
  ticks(g, 2);
  assert.ok(s.seen.has('ch1:intro'), 'the intro is told (in the chat, headlessly)');
  assert.equal(s.nextStep().quest, 'rq_kampong_glam', 'next: the first region line');
  const coins = g.inventory.count('coins'), pots = g.inventory.count('healing_potion');
  finish(g, ['rq_kampong_glam', 'rq_chinatown']);
  ticks(g, 2);
  assert.equal(s.ch, 0, 'not done until every quest is');
  finish(g, ['pillars']);
  ticks(g, 1);
  assert.equal(s.ch, 1);
  assert.ok(s.done.has('ch1'));
  assert.equal(g.inventory.count('coins') - coins, CHAPTERS[0].reward.coins);
  assert.equal(g.inventory.count('healing_potion') - pots, 3);
  assert.ok(s.pages.has('story_ch1'), 'the chapter page');
  assert.deepEqual(s.titles(), ['Kampong Friend']);
  ticks(g, 1);
  assert.ok(s.seen.has('ch1:outro') && s.seen.has('ch2:intro'), 'outro, then the next intro');
  ticks(g, 3);
  assert.equal(g.inventory.count('coins') - coins, CHAPTERS[0].reward.coins, 'paid once');
});

test('a region line played through for real closes its part of the chapter', () => {
  const g = newGame();
  g.skills.addXp('attack', 1e8);
  finish(g, ['rq_chinatown', 'pillars']);
  const l = REGION_LINES[0], q = g.quests[l.id];
  g.handleDialogueAction(`rq:start:${l.id}`);
  for (let guard = 0; q.state !== 'done' && guard < 200; guard++) {
    const st = l.steps[q.step];
    if (st.kind === 'kill') { q.n = st.qty - 1; killFor(g, g.npcs.find((n) => n.npcId === st.npc && n.alive)); }
    else if (st.kind === 'give') { g.inventory.add(st.item, st.qty); g.handleDialogueAction(`rq:talk:${l.id}`); }
    else if (st.kind === 'foe') { g.questGuide(l.id); killFor(g, g._rqFoes[l.id]); }
    else g.handleDialogueAction(`rq:talk:${l.id}`);
  }
  assert.equal(q.state, 'done');
  ticks(g, 1);
  assert.ok(g.story.done.has('ch1'));
});

test('quests finished before the story existed: an older save catches up quietly, rewards and all', () => {
  const g = newGame();
  finish(g, ['rq_kampong_glam', 'rq_chinatown', 'pillars', 'rq_macritchie', 'rq_pulau_ubin', 'rq_bukit_timah', 'rq_sungei_buloh']);
  const coins = g.inventory.count('coins');
  // An older save: no story field at all.
  saveGame(g);
  const save = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY));
  delete save.story;
  globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  const g2 = new Game();
  g2.start();
  g2.ui = new Proxy({}, { get: () => () => {} });
  assert.equal(g2.story.ch, 2, 'chapters 1 and 2 done, chapter 3 open');
  assert.equal(g2.inventory.count('coins') - coins, CHAPTERS[0].reward.coins + CHAPTERS[1].reward.coins);
  assert.ok(g2.story.pages.has('story_ch1') && g2.story.pages.has('story_ch2'));
  assert.ok(!g2.story.seen.has('ch1:outro'), 'no scenes for chapters caught up');
});

// ---------------- Lore ----------------
test('a lore page drops (rarely) from monsters of its region, once', () => {
  const g = newGame();
  const rat = () => g.npcs.find((n) => n.alive && n.def.attackable && !n.def.boss && g.world.zoneAt(n.x, n.y)?.name === 'Kampong Glam');
  g.story.roll = () => 0.5;
  killFor(g, rat());
  assert.ok(!g.story.pages.has('kampong_glam_drop'), 'not on an ordinary roll');
  g.story.roll = () => 0;
  killFor(g, rat());
  assert.ok(g.story.pages.has('kampong_glam_drop'), 'on a lucky one');
  const n = g.story.pages.size;
  killFor(g, rat());
  assert.equal(g.story.pages.size, n, 'never twice');
});

test('every region hides a glinting note; reading it takes the page and the note is gone', () => {
  const g = newGame();
  assert.equal(g.story._spots.length, REGION_LINES.length);
  for (const o of g.story._spots) {
    const page = LORE.find((p) => p.id === o.loreId);
    assert.equal(g.world.zoneAt(o.x, o.y)?.name, page.region, `${o.loreId} sits in its region`);
    assert.ok(!o.def.blocking && o.def.verb === 'Read' && o.def.type === 'storyobj');
  }
  const o = g.story._spots[0];
  // Walk up and Interact, the way a player would.
  const p = g.player;
  const t = g._nearestFree(o.x + 1, o.y);
  p.x = p.tx = t.x; p.y = p.ty = t.y; p.path = []; p.moving = false;
  g.defaultObjectAction(o);
  ticks(g, 2);
  assert.ok(g.story.pages.has(o.loreId));
  assert.ok(!g.world.objects.includes(o));
  assert.equal(g.story._spots.length, REGION_LINES.length - 1);
  // A reload doesn't put a read note back.
  const g2 = reload(g);
  assert.equal(g2.story._spots.length, REGION_LINES.length - 1);
  assert.ok(!g2.story._spots.some((x) => x.loreId === o.loreId));
});

test('a finished region set wakes its guardian by the hidden spot; beating it pays once', () => {
  const g = newGame();
  const region = 'Kampong Glam';
  g.story.useObject(g.story._spots.find((o) => o.loreId === 'kampong_glam_spot'));
  assert.equal(g.story.guard[region], undefined);
  g.story.roll = () => 0;
  killFor(g, g.npcs.find((n) => n.alive && n.def.attackable && !n.def.boss && g.world.zoneAt(n.x, n.y)?.name === region));
  assert.equal(g.story.guard[region], 'ready');
  const gd = g.npcs.find((n) => n.loreGuard === region);
  assert.ok(gd && gd.champion && gd.alive, 'a champion guardian');
  assert.equal(gd.npcId, guardianKind(region));
  const t = spotTile(g, region);
  assert.ok(Math.max(Math.abs(gd.x - t.x), Math.abs(gd.y - t.y)) <= 6, 'beside the hidden spot');
  // It survives a reload while it waits.
  const g2 = reload(g);
  assert.equal(g2.story.guard[region], 'ready');
  assert.ok(g2.npcs.some((n) => n.loreGuard === region && n.alive));
  const coins = g.inventory.count('coins');
  killFor(g, gd);
  assert.equal(g.story.guard[region], 'done');
  assert.ok(g.inventory.count('coins') > coins);
  ticks(g, 1);
  assert.ok(!g.npcs.includes(gd), 'gone for good');
  const g3 = reload(g);
  assert.ok(!g3.npcs.some((n) => n.loreGuard), 'and not back after a reload');
});

test('every chapter page together pays the story set bonus and its title', () => {
  const g = newGame();
  finish(g, CHAPTERS.flatMap((c) => c.quests));
  ticks(g, 1);
  assert.equal(g.story.ch, CHAPTERS.length);
  assert.ok(LORE.filter((p) => p.region === STORY_SET).every((p) => g.story.pages.has(p.id)));
  assert.ok(g.story.storyPaid);
  assert.ok(g.story.titles().includes(STORY_SET_REWARD.title));
  assert.equal(g.story.nextStep(), null, 'nothing left to do');
});

test('story state survives a save and load', () => {
  const g = newGame();
  finish(g, ['rq_kampong_glam', 'rq_chinatown', 'pillars']);
  ticks(g, 2);
  g.story.useObject(g.story._spots[3]);
  const before = g.story.serialize();
  const g2 = reload(g);
  assert.deepEqual(g2.story.serialize(), before);
  assert.equal(g2.story.ch, 1);
  // Junk in a save is ignored.
  g2.story.load({ done: ['nope', 'ch1', 5], pages: ['x'], guard: { a: 'maybe' }, storyPaid: 'yes' });
  assert.deepEqual([...g2.story.done], ['ch1']);
  assert.equal(g2.story.pages.size, 0);
  assert.deepEqual(g2.story.guard, {});
  assert.equal(g2.story.storyPaid, false);
});

// ---------------- Story events ----------------
test('a line starting turns its giver’s stall over; tidying it pays and packs it away', () => {
  const g = newGame();
  g.story.eventsOn = true;
  g.handleDialogueAction('rq:start:rq_kampong_glam');
  ticks(g, 1);
  const ev = g.story.event;
  assert.equal(ev?.kind, 'ransack');
  const stall = ev.objs[0];
  assert.ok(g.world.objects.includes(stall) && stall.def.verb === 'Tidy up');
  const coins = g.inventory.count('coins');
  assert.ok(g.story.useObject(stall));
  assert.ok(g.inventory.count('coins') > coins);
  assert.equal(g.story.event, null);
  assert.ok(!g.world.objects.includes(stall));
});

test('reaching a line’s foe sends its gang raiding; beating them pays; dying or reloading clears them', () => {
  const g = newGame();
  g.skills.addXp('attack', 1e8);
  g.story.eventsOn = true;
  const l = REGION_LINES[0], q = g.quests[l.id];
  Object.assign(q, { state: 'active', step: l.steps.findIndex((s) => s.kind === 'foe'), n: 0 });
  ticks(g, 1);
  assert.equal(g.story.event?.kind, 'raid');
  const raiders = storyNpcs(g);
  assert.equal(raiders.length, RAIDERS);
  assert.ok(raiders.every((n) => n.temporary && n.npcId === l.steps.find((s) => s.kind === 'foe').npc));
  const coins = g.inventory.count('coins');
  for (const n of raiders) killFor(g, n);
  ticks(g, 1);
  assert.equal(g.story.event, null);
  assert.ok(g.inventory.count('coins') > coins);
  assert.equal(storyNpcs(g).length, 0);
  // Again, then fall in the middle of it.
  q.step--; ticks(g, 1); q.step++; ticks(g, 1);
  assert.equal(g.story.event?.kind, 'raid');
  g.playerDeath();
  assert.equal(g.story.event, null);
  assert.equal(storyNpcs(g).length, 0, 'no raiders left behind after a death');
  // ...and a reload never brings them back either.
  for (let i = 0; i < 30 && !g.player.alive; i++) g.doTick();
  q.step--; ticks(g, 1); q.step++; ticks(g, 1);
  assert.equal(g.story.event?.kind, 'raid');
  const g2 = reload(g);
  assert.equal(storyNpcs(g2).length, 0);
  assert.equal(g2.story.event, null);
  g.story.sync();
  assert.equal(storyNpcs(g).length, 0, 'sync packs a running event away');
});

test('a raid that nobody fights slinks away when its time is up', () => {
  const g = newGame();
  g.story.eventsOn = true;
  assert.ok(g.story.startEvent('raid', { line: 'rq_chinatown' }));
  const n = storyNpcs(g).length;
  assert.ok(n > 0);
  g.player.x = g.player.tx = 300; g.player.y = g.player.ty = 200;   // far away, so they can't reach you
  ticks(g, 300);
  assert.equal(g.story.event, null);
  assert.equal(storyNpcs(g).length, 0);
});

test('a chapter far from its speaker: a messenger runs up with the letter, then leaves', () => {
  const g = newGame();
  Object.assign(g.story, { eventsOn: true, scenesOn: true });
  g.story.seen.clear();
  // Somewhere well away from the Kampong Guide.
  const far = g._nearestFree(200, 60);
  g.player.x = g.player.tx = far.x; g.player.y = g.player.ty = far.y;
  ticks(g, 1);
  const ev = g.story.event;
  assert.equal(ev?.kind, 'messenger');
  const m = ev.npc;
  assert.equal(m.def.dialogue, 'story');
  assert.ok(!m.attackable);
  assert.equal(m.artId, 'story_messenger', 'drawn in his own picture, not a plain villager');
  // Talking to the messenger hands the letter over.
  assert.ok(g.story.talkTo(m));
  ticks(g, 1);
  assert.ok(g.story.scene || g.story.queue.length, 'the letter is a scene');
  const sc = g.story.scene || g.story.queue[0];
  assert.ok(sc.letter);
  ticks(g, 4);
  assert.equal(g.story.event, null);
  assert.ok(!g.npcs.includes(m), 'the messenger is gone');
});

// ---------------- Scenes ----------------
test('the scene machine: bars in, lines, a tap guard, skip, auto-advance, bars out', () => {
  const lines = [{ who: 'guide', name: 'Kampong Guide', text: 'Hello there.' }, { who: 'guide', name: 'Kampong Guide', text: 'Off you go.' }];
  const s = new Cutscene(lines);
  assert.equal(s.phase, 'in');
  assert.equal(s.line, null);
  s.update(SCENE_IN_MS / 2);
  assert.ok(s.bars > 0 && s.bars < 1 && s.pan === s.bars);
  s.update(SCENE_IN_MS);
  assert.equal(s.line.text, 'Hello there.');
  assert.equal(s.next(), false, 'a tap right away is ignored');
  s.update(LINE_GUARD_MS);
  assert.ok(s.next());
  assert.equal(s.line.text, 'Off you go.');
  s.update(lineMs('Off you go.'));
  assert.equal(s.phase, 'out', 'a line moves on by itself');
  s.update(SCENE_OUT_MS);
  assert.ok(s.done);
  assert.equal(s.bars, 0);

  const k = new Cutscene(lines);
  k.next();
  assert.equal(k.phase, 'line', 'a tap while the bars come in jumps to the first line');
  assert.ok(k.skip());
  assert.equal(k.phase, 'out');
  assert.equal(k.skip(), false);

  const r = new Cutscene(lines, { reduce: true });
  assert.equal(r.phase, 'line', 'reduce motion: straight to the words');
  assert.equal(r.pan, 0, '...with the camera still');
  assert.equal(r.bars, 1);
  r.skip();
  assert.ok(r.done, '...and gone at once');
  assert.ok(new Cutscene([]).done, 'an empty scene is already over');
});

test('scenes: play when calm, lean the camera, end if attacked, and step aside for auto quest', () => {
  const g = newGame();
  g.story.scenesOn = true;
  g.story.seen.clear();
  g.story.queueScene(CHAPTERS[0], 'intro');
  ticks(g, 1);
  const s = g.story.scene;
  assert.ok(s, 'a scene plays');
  // The camera leans toward the Kampong Guide as the bars come in.
  const guide = g.story.speakerNpc('guide');
  const base = { x: g.player.renderCenter().x, y: g.player.renderCenter().y };
  const c = g.story.camera({ ...base }, SCENE_IN_MS);
  if (guide) assert.notDeepEqual(c, base);
  g.reduceMotion = true;
  g.story.scene = null; g.story.queue = [];
  g.story.queueScene(CHAPTERS[0], 'intro');
  ticks(g, 1);
  assert.deepEqual(g.story.camera({ ...base }, 16), base, 'reduce motion: no camera move');
  // Something attacks: the scene ends.
  const rat = g.npcs.find((n) => n.alive && n.def.attackable);
  rat.target = g.player;
  ticks(g, 1);
  assert.ok(g.story.scene.phase === 'out' || g.story.scene.done);
  rat.target = null;
  g.story.camera(base, 1000);
  assert.equal(g.story.scene, null);
  // Auto quest on: lines go to the chat instead, and nothing waits.
  g.toggleAutoQuest(true);
  g.story.queueScene(CHAPTERS[1], 'intro');
  ticks(g, 1);
  assert.equal(g.story.scene, null);
  assert.equal(g.story.queue.length, 0);
  assert.ok(g.story.seen.has('ch2:intro'));
  g.toggleAutoQuest(false);
  // A dead hero never sits in a scene.
  g.story.queueScene(CHAPTERS[0], 'outro');
  ticks(g, 1);
  g.playerDeath();
  g.story.camera(base, 1000);
  assert.equal(g.story.scene, null);
});

test('the Story view renders headlessly: chapters, next step with Go, lore sets', () => {
  const g = newGame();
  finish(g, ['rq_kampong_glam', 'rq_chinatown', 'pillars']);
  ticks(g, 2);
  g.story.useObject(g.story._spots[0]);
  const html = storyPanelHTML(g);
  assert.match(html, /Lights over the Strait/);
  assert.match(html, /Restless Wilds/);
  assert.match(html, /data-quest="rq_macritchie"/, 'Go on the next quest');
  assert.match(html, /data-replay="ch1:outro"/, 'a seen scene can be replayed');
  assert.match(html, /Kampong Friend/);
  assert.match(html, /Lore pages/);
  assert.match(html, /A Note under the Signpost/, 'a found page reads');
  assert.ok(speakerArt('guide')?.src.endsWith('guide.webp'));
  assert.deepEqual(speakerArt('rq_zainab'), { src: 'assets/creatures/townsfolk/rq_zainab.webp', filter: '' }, 'a quest giver wears her own picture, untinted');
});
