// Good and evil through the quest lines (src/data/questChoices.js,
// src/game/questchoices.js, src/ui/pathui.js): every story chapter and most
// region lines end on a Good / Evil choice that pays karma like the moral
// encounters, never blocks the story, saves and reloads; the journal shows
// your path (tier, meter, fight bonus, next tier), the Crossroads and the arcs;
// karma changes are announced.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { CHAPTERS } from '../src/data/story.js';
import { REGION_LINES } from '../src/data/regionQuests.js';
import { CHAPTER_CHOICES, LINE_CHOICES, TIER_LINES, questChoice } from '../src/data/questChoices.js';
import { MORAL_EVENTS, moralCoins } from '../src/data/moralEvents.js';
import { SKILL_BY_ID } from '../src/data/skills.js';
import { ITEMS } from '../src/data/items.js';
import { NPCS } from '../src/data/npcs.js';
import * as QC from '../src/game/questchoices.js';
import { regionDialogue } from '../src/game/regionquests.js';
import { pathCardHTML, crossroadsHTML, choiceBadgeHTML, choiceLineHTML } from '../src/ui/pathui.js';
import { storyPanelHTML } from '../src/ui/storyui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const noUI = () => new Proxy({}, { get: () => () => {} });
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = noUI();
  return g;
}
function reload(g) {
  saveGame(g);
  const g2 = new Game();
  g2.start();
  g2.ui = noUI();
  return g2;
}
const finish = (g, ids) => { for (const id of ids) g.quests[id].state = 'done'; };
const ticks = (g, n) => { for (let i = 0; i < n; i++) g.doTick(); };
const gearOf = (c) => (c.skill && c.xp) || c.shrine || c.bless;

// ---------------- Data ----------------
test('every chapter and most region lines hold a well-formed Good / Evil choice', () => {
  assert.deepEqual(Object.keys(CHAPTER_CHOICES), CHAPTERS.map((c) => c.id), 'one per chapter, all 12');
  const lines = Object.keys(LINE_CHOICES);
  assert.ok(lines.length >= REGION_LINES.length * 0.6, `most region lines (${lines.length}/${REGION_LINES.length})`);
  for (const id of lines) assert.ok(REGION_LINES.some((l) => l.id === id), `${id} is a region line`);
  assert.equal(QC.CHOICE_KEYS.length, 12 + lines.length);
  for (const key of QC.CHOICE_KEYS) {
    const c = questChoice(key);
    assert.ok(NPCS[c.who] && !NPCS[c.who].attackable, `${key}: ${c.who} is a townsperson`);
    assert.ok(c.title && c.text.length > 40, `${key} sets a scene`);
    for (const side of ['good', 'evil']) {
      const o = c[side];
      assert.ok(o.karma >= 6 && o.karma <= 15, `${key} ${side}: karma like the encounters (${o.karma})`);
      assert.ok(o.label && !/\((Good|Evil)\)|☀|🌙/.test(o.label), `${key} ${side}: plain label (the marks are added)`);
      assert.ok(o.outcome && o.react && o.done.startsWith('You '), `${key} ${side}: outcome, reply and journal line`);
      if (o.skill) assert.ok(SKILL_BY_ID[o.skill], `${key}: ${o.skill} is a skill`);
      for (const [item, q] of o.items || []) assert.ok(ITEMS[item] && q > 0, `${key}: ${item} is an item`);
      if (LINE_CHOICES[key]) assert.ok(o.after, `${key} ${side}: the giver remembers`);
    }
    // Lopsided like moralEvents: good pays XP / shrine / Blessed, evil pays coins.
    assert.ok(gearOf(c.good) && !c.good.coins, `${key}: good pays in XP, shrine points or Blessed`);
    assert.ok(c.evil.coins > 0, `${key}: evil pays coins`);
    assert.ok(!/\b(kill|murder|torture|blood)\b/i.test(`${c.text} ${c.evil.label} ${c.evil.outcome}`), `${key}: mischievous, not cruel`);
  }
  for (const [who, lines2] of Object.entries(TIER_LINES)) assert.ok(NPCS[who] && lines2.paragon && lines2.villain, `${who}: Paragon and Villain lines`);
});

test('labels carry the sun or moon and the words (Good) / (Evil)', () => {
  const g = newGame();
  const t = QC.choiceTree(g, 'ch1');
  const [good, evil, later] = t.start.options;
  assert.match(good.label, /^☀️ .+ \(Good\)$/);
  assert.match(evil.label, /^🌙 .+ \(Evil\)$/);
  assert.equal(good.action, 'qc:ch1:good');
  assert.equal(evil.action, 'qc:ch1:evil');
  assert.ok(!later.action && later.next === 'end', 'and a way to decide later');
});

// ---------------- Paying ----------------
test('every chapter choice pays karma both ways, lopsided like the encounters', () => {
  for (const side of ['good', 'evil']) {
    const g = newGame();
    for (const c of CHAPTERS) {
      const ch = CHAPTER_CHOICES[c.id][side];
      g.story.open.add(c.id);
      const k0 = { ...g.karma }, coins = g.inventory.count('coins'), shrine = g.shrine.points;
      const xp0 = ch.skill ? g.skills.xp[ch.skill] : 0;
      g.blessedMs = 0;
      g.handleDialogueAction(`qc:${c.id}:${side}`);   // the dialogue box's action
      assert.equal(g.story.picks[c.id], side, `${c.id} recorded`);
      assert.equal(g.karma[side] - k0[side], ch.karma, `${c.id}: +${ch.karma} ${side}`);
      assert.equal(g.karma[side === 'good' ? 'evil' : 'good'], k0[side === 'good' ? 'evil' : 'good'], 'the other side untouched');
      // (At least: a karma achievement can pay its own coins on top.)
      if (side === 'evil') assert.ok(g.inventory.count('coins') - coins >= moralCoins(ch.coins, g.fightLevel()), `${c.id}: coins scaled with fight level`);
      else {
        assert.equal(g.inventory.count('coins'), coins, 'good pays no coins');
        if (ch.skill) assert.ok(g.skills.xp[ch.skill] > xp0, `${c.id}: ${ch.skill} XP`);
        if (ch.shrine) assert.equal(g.shrine.points - shrine, ch.shrine);
        if (ch.bless) assert.ok(g.blessedMs > 0, 'Blessed');
      }
      assert.equal(QC.chooseQuest(g, c.id, side === 'good' ? 'evil' : 'good'), false, 'once only');
    }
  }
});

test('a choice that was never offered (an old save’s finished chapter) cannot be made', () => {
  const g = newGame();
  const k = { ...g.karma };
  assert.equal(QC.chooseQuest(g, 'ch3', 'evil'), false);
  assert.equal(QC.chooseQuest(g, 'nope', 'good'), false);
  g.story.open.add('ch3');
  assert.equal(QC.chooseQuest(g, 'ch3', 'sideways'), false);
  assert.deepEqual(g.karma, k);
});

// ---------------- Never blocking ----------------
test('a chapter closes and the next opens whether you choose, choose later, or never choose', () => {
  const g = newGame();
  const s = g.story;
  finish(g, ['rq_kampong_glam', 'rq_chinatown', 'pillars']);
  ticks(g, 2);
  assert.equal(s.ch, 1, 'chapter 2 is open with the choice still waiting');
  assert.ok(QC.choicePending(g, 'ch1'));
  assert.deepEqual(QC.pendingChoices(g), ['ch1']);
  finish(g, ['rq_macritchie', 'rq_pulau_ubin', 'rq_bukit_timah']);
  ticks(g, 2);
  assert.equal(s.ch, 2, 'chapter 3 opens too, the first choice still unmade');
  // Auto quest and auto battle never choose for you.
  g.toggleAutoQuest(true);
  ticks(g, 20);
  g.toggleAutoQuest(false);
  assert.ok(QC.choicePending(g, 'ch1') && QC.choicePending(g, 'ch2'));
  // Chosen late, from the journal: the reply comes in the box, since the ending has played.
  const t = QC.choiceTree(g, 'ch1');
  assert.equal(t.qcevil.options[0].next, 'qcevilr');
  assert.ok(QC.chooseQuest(g, 'ch1', 'evil'));
  assert.equal(s.ch, 2);
  assert.match(t.qcevilr.text, /paper charms/);
});

test('a chapter’s choice is put to you before its ending, and the ending answers it', () => {
  const g = newGame();
  const s = g.story;
  ticks(g, 2);
  s.scenesOn = true;
  const asked = [];
  g.ui = new Proxy({ openQuestChoice: (k) => { asked.push(k); QC.chooseQuest(g, k, 'good'); } }, { get: (o, k) => o[k] || (() => {}) });
  finish(g, ['rq_kampong_glam', 'rq_chinatown', 'pillars']);
  ticks(g, 1);   // the chapter closes
  ticks(g, 1);   // the choice
  assert.deepEqual(asked, ['ch1']);
  assert.equal(s.picks.ch1, 'good');
  ticks(g, 1);   // the ending
  assert.equal(s.scene?.id, 'ch1:outro');
  assert.equal(s.scene.lines[0].text, CHAPTER_CHOICES.ch1.good.react, 'the ending opens with the reply to your choice');
  assert.equal(s.scene.lines[0].who, 'rq_madam_tan');
  // ...and its replay does too.
  s.scene = null;
  assert.equal(s.replay('ch1', 'outro').lines[0].text, CHAPTER_CHOICES.ch1.good.react);
  // While the ending is still to come, the box leaves the reply to it.
  s.seen.delete('ch2:outro');
  assert.equal(QC.choiceTree(g, 'ch2').qcgood.options[0].next, 'end');
});

test('a region line’s choice comes straight after the hand-in, and its giver remembers', () => {
  const g = newGame();
  g.skills.addXp('attack', 1e8);
  const l = REGION_LINES[0], q = g.quests[l.id];
  const giver = g.npcs.find((n) => n.npcId === l.giver);
  g.handleDialogueAction(`rq:start:${l.id}`);
  q.step = l.steps.length - 1;   // back from catching Ayam Jago
  const tree = regionDialogue(g, giver);
  assert.equal(tree.start.options[0].action, `rq:talk:${l.id}`);
  g.handleDialogueAction(tree.start.options[0].action);
  assert.equal(q.state, 'done', 'the line is complete before you choose');
  assert.ok(QC.choicePending(g, l.id));
  const ask = tree.start;   // "Okay." leads back to the start: the choice
  assert.equal(ask.text, LINE_CHOICES[l.id].text);
  assert.match(ask.options[0].label, /☀️.*\(Good\)/);
  g.handleDialogueAction(ask.options[1].action);
  assert.equal(g.story.picks[l.id], 'evil');
  assert.equal(tree.qcevil.text, LINE_CHOICES[l.id].evil.outcome);
  assert.equal(tree.qcevilr.text, LINE_CHOICES[l.id].evil.react, 'the next line changes with the choice');
  assert.equal(tree.start.text, LINE_CHOICES[l.id].evil.after, 'and the giver remembers it');
  // Lines without a choice hand in as before.
  assert.equal(LINE_CHOICES.rq_punggol, undefined);
  g.quests.rq_punggol.state = 'done';
  assert.equal(QC.offerChoice(g, 'rq_punggol'), false);
});

test('auto quest hands a line in without choosing; the choice waits with the giver', () => {
  const g = newGame();
  const l = REGION_LINES[1], q = g.quests[l.id];
  g.skills.addXp('attack', 1e8);
  g.handleDialogueAction(`rq:start:${l.id}`);
  q.step = l.steps.length - 1;
  g.handleDialogueAction(`rq:auto:${l.id}`);
  assert.equal(q.state, 'done');
  assert.ok(QC.choicePending(g, l.id));
  assert.equal(g.story.picks[l.id], undefined);
  const giver = g.npcs.find((n) => n.npcId === l.giver);
  assert.equal(regionDialogue(g, giver).start.text, LINE_CHOICES[l.id].text);
});

// ---------------- Saving ----------------
test('choices made and waiting survive a save and load; junk is dropped', () => {
  const g = newGame();
  g.story.open.add('ch1'); g.story.open.add('rq_jurong'); g.story.open.add('ch2');
  QC.chooseQuest(g, 'ch1', 'good');
  QC.chooseQuest(g, 'rq_jurong', 'evil');
  const g2 = reload(g);
  assert.deepEqual(g2.story.picks, { ch1: 'good', rq_jurong: 'evil' });
  assert.deepEqual([...g2.story.open], ['ch2']);
  assert.equal(g2.karma.good, g.karma.good);
  assert.equal(g2.karma.evil, g.karma.evil);
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  raw.story.picks = { ch1: 'good', fake: 'evil', ch4: 'sideways' };
  raw.story.open = ['ch1', 'ch5', 42, 'nope'];
  localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  const g3 = new Game();
  g3.start();
  assert.deepEqual(g3.story.picks, { ch1: 'good' });
  assert.deepEqual([...g3.story.open], ['ch5']);
});

test('an old save (no choices saved) loads; its finished chapters simply have none', () => {
  const g = newGame();
  finish(g, ['rq_kampong_glam', 'rq_chinatown', 'pillars', 'rq_macritchie', 'rq_pulau_ubin', 'rq_bukit_timah']);
  g.karma.good = 30;
  saveGame(g);
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete raw.story.picks; delete raw.story.open;
  for (const ch of ['ch1', 'ch2']) raw.story.done = raw.story.done.filter((x) => x !== ch);   // even before the story caught up
  localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  const g2 = new Game();
  g2.start();
  g2.ui = noUI();
  assert.ok(g2.story.done.has('ch1') && g2.story.done.has('ch2'), 'caught up');
  assert.deepEqual(g2.story.picks, {});
  assert.deepEqual(QC.pendingChoices(g2), [], 'no choice offered for chapters finished before');
  assert.equal(g2.alignment(), 30);
  assert.match(pathCardHTML(g2), /data-tier="virtuous"/);
  assert.match(pathCardHTML(g2), /Quest choices 0\/23\b/, 'seven completed quests and chapters had no choice');
  for (const key of ['ch1', 'rq_kampong_glam']) {
    assert.equal(choiceBadgeHTML(g2, key), '');
    assert.match(choiceLineHTML(g2, key), /Completed before choices were added/);
  }
  assert.match(choiceBadgeHTML(g2, 'rq_jurong'), /☀️🌙/);
  g2.skills.addXp('attack', 1e8);
  g2.handleDialogueAction('rq:start:rq_jurong');
  g2.quests.rq_jurong.step = REGION_LINES.find((l) => l.id === 'rq_jurong').steps.length - 1;
  g2.handleDialogueAction('rq:talk:rq_jurong');
  assert.match(choiceLineHTML(g2, 'rq_jurong'), /data-qc="rq_jurong"/);
  assert.match(pathCardHTML(g2), /Quest choices 0\/23\b/, 'the pending choice still counts');
  assert.equal(QC.chooseQuest(g2, 'rq_jurong', 'good'), true);
  assert.match(pathCardHTML(g2), /Quest choices 1\/23\b/);
});

// ---------------- The journal ----------------
test('the path card shows the right tier, meter, fight bonus and next tier', () => {
  const g = newGame();
  const at = (good, evil) => { g.karma.good = good; g.karma.evil = evil; return pathCardHTML(g); };
  const cases = [[0, 0, 'neutral', 'Neutral'], [10, 0, 'kind', 'Kind-hearted'], [40, 10, 'virtuous', 'Virtuous'], [70, 0, 'paragon', 'Paragon'],
    [0, 9, 'mischievous', 'Mischievous'], [5, 35, 'wicked', 'Wicked'], [0, 90, 'villain', 'Villain']];
  let lastPin = Infinity;
  for (const [good, evil, tier, title] of [...cases].sort((x, y) => (y[0] - y[1]) - (x[0] - x[1]))) {
    const html = at(good, evil);
    assert.match(html, new RegExp(`data-tier="${tier}"`), `${good}/${evil}`);
    assert.match(html, new RegExp(`class="path-title">${title}<`));
    const pin = +html.match(/left:([\d.]+)%/)[1];
    assert.ok(pin < lastPin && pin >= 0 && pin <= 100, `the pin runs Paragon to Villain (${pin})`);
    lastPin = pin;
  }
  // Fight bonus at the tier, read from the game's own numbers.
  let html = at(40, 10);
  const kc = g.karmaCombat();
  assert.equal(kc.side, 'holy');
  assert.ok(html.includes(`+${Math.round(kc.holyDmg * 100)}% damage to Undead`));
  assert.match(html, /30 more Good to become <b>Paragon<\/b>/);
  html = at(0, 30);
  assert.ok(html.includes(`+${g.karmaCombat().critDmg}% crit damage`));
  assert.match(html, /30 more Evil to become <b>Villain<\/b>/);
  html = at(0, 0);
  assert.match(html, /No fight bonus yet/);
  assert.match(html, /8 more Good to become <b>Kind-hearted/);
  assert.match(html, /8 more Evil to become <b>Mischievous/);
  assert.match(at(80, 0), /Paragon is the highest Good tier/);
  // A waiting choice shows with a Choose button.
  g.story.open.add('ch4');
  assert.match(pathCardHTML(g), /data-qc="ch4"/);
});

test('the arcs: when they open, how to start them, progress', () => {
  const g = newGame();
  let [red, cor] = QC.arcs(g);
  assert.ok(!red.open && !red.go && /10 Evil/.test(red.text));
  assert.ok(!cor.open && /-10 or lower/.test(cor.text));
  g.karma.evil = QC.REDEMPTION_OPENS_EVIL - 1;
  g.startRedemption();
  assert.equal(g.quests.redemption.state, 'notStarted', 'the card and the game agree on the door');
  g.karma.evil = QC.REDEMPTION_OPENS_EVIL;
  [red, cor] = QC.arcs(g);
  assert.ok(red.open && red.go && /Sister Mei/.test(red.text));
  assert.ok(cor.open && /Tempter/.test(cor.text), 'alignment -10 opens the Corruption too');
  g.startRedemption();
  g.addGood(12);
  [red] = QC.arcs(g);
  assert.match(red.text, /Penance: 12\/30/);
  assert.match(pathCardHTML(g), /data-arc="redemption"/);
});

test('the Crossroads lists every moral encounter: chosen ones show the choice, the rest a Go', () => {
  const g = newGame();
  let html = crossroadsHTML(g);
  assert.equal((html.match(/data-cross="/g) || []).length, MORAL_EVENTS.length);
  for (const ev of MORAL_EVENTS) assert.ok(html.includes(`data-moral="${ev.id}"`) && html.includes(ev.zone), ev.id);
  g.moralChoose('lost_child', 'good');
  g.moralChoose('smuggler', 'evil');
  html = crossroadsHTML(g, true);
  assert.ok(!html.includes('data-moral="lost_child"') && !html.includes('data-moral="smuggler"'));
  assert.match(html, /Help him find his mum/);
  assert.match(html, /Carry the crates/);
  assert.match(html, /2\/12/);
  assert.match(html, /<details[^>]* open>/);
  // Go walks there.
  assert.ok(QC.goToMoral(g, 'stray_dog'));
  assert.ok(g.player.isMoving || g.player.action, 'on the way');
  assert.equal(QC.goToMoral(g, 'lost_child'), false, 'not for one already met');
});

test('quest and chapter marks: sun and moon until chosen, then the side and what you did', () => {
  const g = newGame();
  assert.match(choiceBadgeHTML(g, 'rq_jurong'), /☀️🌙/);
  assert.equal(choiceBadgeHTML(g, 'rq_punggol'), '');
  assert.equal(choiceLineHTML(g, 'rq_jurong'), '');
  g.story.open.add('rq_jurong');
  assert.match(choiceLineHTML(g, 'rq_jurong'), /data-qc="rq_jurong"/);
  QC.chooseQuest(g, 'rq_jurong', 'good');
  assert.match(choiceBadgeHTML(g, 'rq_jurong'), /class="qc-badge good"/);
  assert.match(choiceLineHTML(g, 'rq_jurong'), /☀️ You set the caged birds free/);
  g.story.open.add('ch1');
  QC.chooseQuest(g, 'ch1', 'evil');
  const story = storyPanelHTML(g);
  assert.match(story, /🌙 You sold fake charms/);
  assert.ok((story.match(/qc-badge/g) || []).length >= 12, 'every chapter carries its mark');
});

// ---------------- Feedback and the world ----------------
test('karma changes float over you, a big one gets a card, and a new tier is announced', () => {
  const g = newGame();
  const banners = [], tiers = [];
  g.ui = new Proxy({ showBanner: (h) => banners.push(h) }, { get: (o, k) => o[k] || (() => {}) });
  g.bus.on('karmatier', (t) => tiers.push(t));
  const splats = () => g.effects.filter((e) => e.type === 'hitsplat' && e.entity === g.player && e.text).map((e) => e.text);
  g.addGood(1);
  assert.deepEqual(splats(), ['☀️ +1 Good']);
  assert.equal(banners.length, 0, 'a small change only floats');
  g.addGood(10);
  assert.ok(splats().includes('☀️ +10 Good'));
  assert.ok(banners.some((b) => /☀️ \+10 Good/.test(b)));
  assert.ok(banners.some((b) => /You are now Kind-hearted/.test(b)), 'a new tier');
  assert.deepEqual(tiers, ['kind']);
  g.addEvil(30);
  assert.ok(splats().includes('🌙 +30 Evil'));
  assert.deepEqual(tiers, ['kind', 'mischievous']);
  // A load is where you stand, not news.
  const g2 = reload(g);
  const t2 = [];
  g2.bus.on('karmatier', (t) => t2.push(t));
  g2.addGood(1);
  assert.deepEqual(t2, [], 'one more Good from -19 stays Mischievous');
});

test('Paragons and Villains hear about it from key story people', () => {
  const g = newGame();
  g.karma.good = 80;
  let lines = g.story.sceneLines(CHAPTERS[0], 'intro');
  assert.equal(lines[1].text, TIER_LINES.guide.paragon, 'the guide notices, after her first line');
  assert.equal(lines.length, CHAPTERS[0].intro.length + 1);
  g.karma.good = 0; g.karma.evil = 80;
  lines = g.story.sceneLines(CHAPTERS[11], 'outro');
  assert.ok(lines.some((l) => l.text === TIER_LINES.rq_lin.villain));
  const tan = g.npcs.find((n) => n.npcId === 'rq_madam_tan');
  assert.ok(regionDialogue(g, tan).start.text.startsWith(TIER_LINES.rq_madam_tan.villain));
  g.karma.evil = 10;
  assert.equal(g.story.sceneLines(CHAPTERS[0], 'intro').length, CHAPTERS[0].intro.length, 'nothing extra in between');
});
