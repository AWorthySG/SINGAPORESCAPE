// Less work for a late-game fight's chat and its heavier tick frames, the same
// on screen and in play: the chat draws a task's lines once (and none while it
// is folded, catching up when it opens), names are linked with fewer lookups
// and repeated lines from a record, "What next?" looks for each tool once, an
// auto battle pick estimates each foe's fight once, worn gear keeps its bonuses
// while kills add mastery XP within a rank, and the boss bar works out its
// threat only when it means to. All headless.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { UI, CHAT_LINES } from '../src/ui/ui.js';
import { findLinks, linkNames } from '../src/game/encyclopedia.js';
import { linkHTML, linkTag, setLinkedText } from '../src/ui/links.js';
import { bestSource } from '../src/game/whatnext.js';
import { bossBarModel, foeThreat } from '../src/ui/bossbar.js';
import { MASTERY_RANKS, rankFor } from '../src/game/mastery.js';
import { gatherSources } from '../src/game/skillguide.js';
import { ITEMS } from '../src/data/items.js';
import { SKILLS } from '../src/data/skills.js';
import { getNpc, ALL_MONSTER_IDS, ALL_BOSS_IDS } from '../src/data/npcs.js';
import { xpForLevel } from '../src/data/xp.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function freshGame(cls = 'swordsman') {
  globalThis.localStorage = fakeStorage();
  const g = new Game();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.start(); g.chooseClass(cls);
  return g;
}
const microtasks = () => new Promise((r) => setTimeout(r, 0));

// ---------------- Linked names ----------------
// The matcher as it was: every word tried as the start of every length of name.
function oldFindLinks(text, regionNames = []) {
  const { map, longest } = linkNames(regionNames);
  const s = String(text ?? '');
  const words = [...s.matchAll(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)];
  const out = [];
  let at = 0;
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let n = Math.min(longest, words.length - i); n >= 1 && !hit; n--) {
      const k = words.slice(i, i + n).map((m) => m[0].toLowerCase()).join(' ');
      const e = map.get(k);
      if (e) hit = { n, e };
    }
    if (!hit) { i++; continue; }
    const from = words[i].index, last = words[i + hit.n - 1], to = last.index + last[0].length;
    if (from > at) out.push({ text: s.slice(at, from) });
    out.push({ text: s.slice(from, to), link: hit.e });
    at = to;
    i += hit.n;
  }
  if (at < s.length) out.push({ text: s.slice(at) });
  return out;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const oldLinkHTML = (game, text) => (text ? oldFindLinks(text, (game?.world?.zones || []).filter((z) => !z.instance).map((z) => z.name)).map((r) => (r.link ? linkTag(r.link.kind, r.link.id, r.text) : esc(r.text))).join('') : '');

// Lines like a big fight's, and every name the game links, alone and run together.
function sampleTexts(g) {
  const regions = g.world.zones.filter((z) => !z.instance).map((z) => z.name);
  const names = [...regions, ...SKILLS.map((s) => s.name), ...[...ALL_MONSTER_IDS, ...ALL_BOSS_IDS].map((id) => getNpc(id).name), ...Object.values(ITEMS).map((it) => it.name)];
  const words = names.join(' ').split(/\s+/);
  const out = [
    'You have defeated the Elder Fiddler crab.', 'You have defeated the Champion Feral Smooth otter! Champions drop extra loot.',
    'You loot: Bones, 140 x Coins, Bones, 29 x Air rune, Bones, Bones, 412 x Coins, Bones.',
    'You loot: Iron scout jerkin (Rare), Iron med helm (Rare), Champion bones (Rare), 92 x Fire rune (Rare), 5384 x Coins (Rare).',
    'Fine Steel sword! A Fine copy: +8% to its stats.', 'Legendary Iron sword! A Legendary copy: +40% to its stats.',
    'Golden hours: Woodcutting +50% XP for half a day (dry wood splits clean).', 'Kill streak 10! Combat XP +50%.',
    `You enter ${regions[0]} (monsters level 40+).`, "St John's Island, Pulau Ubin & the <b>Wilderness</b>: “quoted” — dashed-word it's",
    'An Elder macaque dropped iron ore near Pulau Ubin. Woodcutting is calm.', '', '   ', '123 456', 'IRON ORE iron ore Iron Ore',
  ];
  for (const n of names) out.push(n, `${n}.`, `a ${n} and ${n.toUpperCase()}`);
  for (let i = 0; i < 400; i++) {
    const k = 2 + Math.floor(Math.random() * 12);
    out.push(Array.from({ length: k }, () => words[Math.floor(Math.random() * words.length)]).join(Math.random() < 0.5 ? ' ' : ', '));
  }
  return out;
}

test('names are linked exactly as before, with far fewer lookups', () => {
  const g = freshGame();
  const regions = g.world.zones.filter((z) => !z.instance).map((z) => z.name);
  for (const t of sampleTexts(g)) assert.deepEqual(findLinks(t, regions), oldFindLinks(t, regions), t);
});

test('linked chat lines come from a record, the same HTML every time', () => {
  const g = freshGame();
  const texts = sampleTexts(g);
  // Twice over (the second time from the record), and past the record's size.
  for (let round = 0; round < 2; round++) for (const t of texts) assert.equal(linkHTML(g, t), oldLinkHTML(g, t), t);
  // A region the names haven't met yet starts the record afresh: the line is linked now.
  const line = 'The mists lift over Zanzibar Flats today.';
  assert.ok(!/data-ency/.test(linkHTML(g, line)));
  const g2 = { world: { zones: [...g.world.zones, { name: 'Zanzibar Flats', x0: 0, y0: 0, x1: 1, y1: 1 }] } };
  assert.match(linkHTML(g2, line), /data-ency="region:Zanzibar Flats"/);
  assert.equal(linkHTML(g2, line), oldLinkHTML(g2, line));
});

// ---------------- The chat log ----------------
// Just enough DOM for the chat: elements, fragments and a log that counts its work.
function fakeDom() {
  const made = { elements: 0, appends: 0 };
  class El {
    constructor() { this.children = []; this.dataset = {}; this.style = {}; this.className = ''; this._html = null; this._text = ''; this.parentElement = null; }
    get childElementCount() { return this.children.length; }
    get firstChild() { return this.children[0] || null; }
    set innerHTML(v) { this._html = String(v); this._text = null; }
    get innerHTML() { return this._html ?? esc(this._text); }
    set textContent(v) { this._text = String(v); this._html = null; this.children = []; }
    get textContent() { return this._text ?? this._html; }
    appendChild(c) {
      made.appends++;
      const list = c instanceof Frag ? c.children.splice(0) : [c];
      for (const x of list) { x.parentElement = this; this.children.push(x); }
      return c;
    }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  }
  class Frag { constructor() { this.children = []; } appendChild(c) { this.children.push(c); return c; } }
  const doc = { createElement: () => { made.elements++; return new El(); }, createDocumentFragment: () => new Frag() };
  const box = { classes: new Set(), classList: { contains: (c) => box.classes.has(c), toggle: (c, on) => (on ? box.classes.add(c) : box.classes.delete(c)), remove: (c) => box.classes.delete(c) } };
  const log = new El();
  log.parentElement = box;
  log.scrollTop = 0; log.scrollHeight = 999;
  return { doc, made, box, log, El };
}
function chatUi(game, log) {
  const ui = Object.create(UI.prototype);
  Object.assign(ui, { game, el: { chatLog: log }, chatMessages: [], chatFilter: 'all' });
  return ui;
}
// What the log holds, line by line.
const lines = (log) => log.children.map((d) => [d.className, d.dataset.cls, d.innerHTML, d.textContent, d.style.display]);
// The chat as it was: each line drawn into the log as it came. (Its lines are
// made straight from the fake element class, so only the new chat's are counted.)
function oldAddChat(ui, text, cls = 'game') {
  ui.chatMessages.push({ text, cls });
  if (ui.chatMessages.length > 120) ui.chatMessages.shift();
  const div = new ui.el.chatLog.constructor();
  div.className = `msg ${cls}`;
  setLinkedText(div, ui.game, text);
  div.dataset.cls = cls;
  ui.el.chatLog.appendChild(div);
  while (ui.el.chatLog.childElementCount > 120) ui.el.chatLog.removeChild(ui.el.chatLog.firstChild);
  ui._applyVisibility(div);
}
function withDom(fn) {
  const saved = globalThis.document;
  const dom = fakeDom();
  globalThis.document = dom.doc;
  return Promise.resolve().then(() => fn(dom)).finally(() => { if (saved) globalThis.document = saved; else delete globalThis.document; });
}
const CLASSES = ['game', 'combat', 'level', 'system', 'qual-fine', 'combat', 'combat'];

test('a burst of chat lines is drawn once, at the end of the task, just as line by line', async () => {
  const g = freshGame();
  const texts = sampleTexts(g).slice(0, 300);
  await withDom(async (dom) => {
    const ref = new dom.El();
    const old = chatUi(g, ref);
    const ui = chatUi(g, dom.log);
    let n = 0;
    for (const [round, size] of [[0, 7], [1, 1], [2, 45], [3, 130], [4, 20]]) {
      const appends = dom.made.appends;
      for (let i = 0; i < size; i++, n++) {
        const t = texts[n % texts.length], c = CLASSES[n % CLASSES.length];
        oldAddChat(old, t, c);
        ui.addChat(t, c);
      }
      assert.equal(dom.log.children.length, round === 0 ? 0 : Math.min(CHAT_LINES, n - size), 'nothing drawn mid-task');
      await microtasks();
      assert.deepEqual(lines(dom.log), lines(ref), `round ${round}`);
      assert.equal(dom.made.appends - appends - size, 1, 'one append for the whole burst');
      assert.ok(dom.log.children.length <= CHAT_LINES);
    }
    assert.deepEqual(ui.chatMessages, old.chatMessages, 'the same lines kept');
    // A filter shows the new lines the same way.
    old.chatFilter = ui.chatFilter = 'combat';
    for (let i = 0; i < 9; i++, n++) { oldAddChat(old, texts[n % texts.length], CLASSES[n % CLASSES.length]); ui.addChat(texts[n % texts.length], CLASSES[n % CLASSES.length]); }
    await microtasks();
    assert.deepEqual(lines(dom.log), lines(ref));
  });
});

test('a folded chat draws nothing, and shows the very same lines when it opens', async () => {
  const g = freshGame();
  const texts = sampleTexts(g);
  await withDom(async (dom) => {
    const ref = new dom.El();
    const old = chatUi(g, ref);
    const ui = chatUi(g, dom.log);
    ui._collapse = { chat: true };
    const btn = { addEventListener() {} };
    UI.prototype._wireCollapse.call(ui, 'chat', dom.box, btn, 'chat');
    assert.ok(dom.box.classes.has('collapsed'));
    // Some lines while open first, then a long folded fight.
    ui._collapseApply.chat(false);
    for (let i = 0; i < 30; i++) { oldAddChat(old, texts[i], CLASSES[i % CLASSES.length]); ui.addChat(texts[i], CLASSES[i % CLASSES.length]); }
    await microtasks();
    assert.deepEqual(lines(dom.log), lines(ref));
    ui._collapseApply.chat(true);
    const made = dom.made.elements, before = lines(dom.log);
    for (let i = 30; i < 530; i++) { oldAddChat(old, texts[i % texts.length], CLASSES[i % CLASSES.length]); ui.addChat(texts[i % texts.length], CLASSES[i % CLASSES.length]); }
    await microtasks();
    assert.equal(dom.made.elements, made, 'no line is drawn while the chat is folded');
    assert.deepEqual(lines(dom.log), before);
    // Opening it draws its newest lines, as a log that drew every line would show.
    const scrolled = dom.log.scrollTop;
    ui._collapseApply.chat(false);
    assert.deepEqual(lines(dom.log), lines(ref));
    assert.equal(dom.made.elements - made, CHAT_LINES, 'only the lines it can show are drawn');
    assert.equal(dom.log.scrollTop, scrolled, 'and it is left where it was, as before (the next line scrolls it)');
    // A few folded lines catch up the same way, onto the lines already there.
    ui._collapseApply.chat(true);
    for (let i = 0; i < 5; i++) { oldAddChat(old, `Line ${i}`, 'system'); ui.addChat(`Line ${i}`, 'system'); }
    await microtasks();
    ui._collapseApply.chat(false);
    assert.deepEqual(lines(dom.log), lines(ref));
    // And open, new lines follow at once.
    ui.addChat('You have defeated the Elder Fiddler crab.', 'combat'); oldAddChat(old, 'You have defeated the Elder Fiddler crab.', 'combat');
    await microtasks();
    assert.deepEqual(lines(dom.log), lines(ref));
    assert.equal(dom.log.scrollTop, dom.log.scrollHeight, 'kept to the bottom');
  });
});

// ---------------- "What next?" ----------------
// bestSource as it was: whether you have the tool, asked again for every source.
function oldBestSource(game, skill) {
  const lvl = game.skills.level(skill);
  const p = game.playerTile();
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const ok = gatherSources().filter((s) => s.skill === skill && s.objIds?.length && s.level <= lvl && (!s.tool || game.hasTool(s.tool)));
  for (const src of ok.slice().sort((a, b) => b.level - a.level)) {
    const ids = new Set(src.objIds);
    let obj = null;
    for (const o of game.world.objects) if (ids.has(o.objId) && !o.depleted && (!obj || dist(o, p) < dist(obj, p))) obj = o;
    if (obj) return { src, obj };
  }
  return null;
}

test('"What next?" finds the same spot to train, looking for each tool once', () => {
  const g = freshGame();
  const skills = ['woodcutting', 'mining', 'fishing', 'hunter', 'thieving', 'agility'];
  const asked = [];
  const has = g.hasTool.bind(g);
  g.hasTool = (t) => { asked.push(t); return has(t); };
  const check = (why) => {
    for (const s of skills) {
      asked.length = 0;
      const now = bestSource(g, s);
      const nowAsks = asked.length;
      assert.deepEqual(now, oldBestSource(g, s), `${s}: ${why}`);
      assert.ok(nowAsks <= new Set(asked).size, `${s}: each tool looked for once`);
    }
  };
  check('a new character');
  for (const s of skills) g.skills.xp[s] = xpForLevel(800);
  check('high levels, starter tools');
  for (const t of ['bronze_axe', 'bronze_pickaxe', 'small_fishing_net', 'fishing_rod', 'harpoon', 'lobster_pot', 'bird_snare']) if (ITEMS[t]) g.inventory.add(t, 1);
  check('carrying tools');
  g.player.x = g.player.tx = 200; g.player.y = g.player.ty = 140;
  check('somewhere else');
  for (const o of g.world.objects.slice(0, 2000)) o.depleted = true;
  check('with spots worked out');
});

// ---------------- Auto battle's pick ----------------
test('an auto battle pick estimates each foe once and picks the same foe', () => {
  const g = freshGame('swordsman');
  for (const k of ['attack', 'strength', 'defence', 'hitpoints']) g.skills.xp[k] = xpForLevel(400);
  g.player.hp = g.maxHp();
  const p = g.player;
  let estimates = 0, before = 0, after = 0;
  const pm = g.prayerMult.bind(g);
  g.prayerMult = () => { estimates++; return pm(); };   // once at the start of every fight estimate
  for (let scene = 0; scene < 12; scene++) {
    const mobs = [];
    const add = (dx, dy, champ, hunting) => {
      const n = new NPC('goblin', p.x + dx, p.y + dy, 0, {});
      n.def = { ...n.def, aggressive: false, level: Math.max(1, g.fightLevel() - Math.floor(Math.random() * 20)) };
      if (champ) n.makeChampion();
      if (champ && Math.random() < 0.5) n.maxHp = n.hp = 1e6 * Math.random();   // some a slog
      if (hunting) n.target = p;
      mobs.push(n);
    };
    for (let i = 0; i < 2 + scene % 4; i++) add(3 + i, -2 + i, true, false);
    for (let i = 0; i < 3 + scene; i++) add(-4 + (i % 5), 2 + Math.floor(i / 5), Math.random() < 0.2, true);
    for (let i = 0; i < 6; i++) add(-6 + i * 2, -5, false, false);
    g.npcs = mobs;
    g._npcsNear = null;
    // Without the record (the pick on its own) and with it: the same answer.
    estimates = 0;
    const plain = g._autoPick();
    const plainEstimates = estimates;
    estimates = 0;
    const picked = g._autoPickTarget();
    assert.equal(picked, plain, `scene ${scene}`);
    const distinct = mobs.filter((n) => n.champion || n.target === p).length;
    assert.ok(estimates <= distinct, `scene ${scene}: at most one estimate per foe (${estimates} of ${distinct}, ${plainEstimates} before)`);
    before += plainEstimates; after += estimates;
    assert.equal(g._fightMemo, undefined, 'nothing is kept after the pick');
  }
  assert.ok(after < before / 2, `far fewer estimates (${after}, was ${before})`);
  // Outside a pick every estimate is worked out afresh (the foe's life can change).
  const n = g.npcs.find((x) => x.champion);
  const a = g._autoFightTimes(n).myTime;
  n.hp = Math.max(1, Math.floor(n.hp / 2));
  assert.ok(g._autoFightTimes(n).myTime < a);
});

// ---------------- The boss bar ----------------
test("the boss bar's model takes the threat it was given, and is otherwise the same", () => {
  const g = freshGame();
  const foes = [g.npcs.find((n) => n.def.boss && n.attackable), g.npcs.find((n) => n.attackable && !n.def.boss)];
  const champ = g.npcs.find((n) => n.attackable && !n.def.boss && n !== foes[1]);
  champ.makeChampion();
  for (const n of [...foes, champ]) {
    const plain = bossBarModel(g, n);
    assert.equal(plain.threat, foeThreat(g, n));
    for (const t of ['easy', 'even', 'danger']) assert.deepEqual(bossBarModel(g, n, t), { ...plain, threat: t }, n.name);
  }
});

// ---------------- Worn gear's bonuses ----------------
test('worn gear keeps its bonuses while kills add mastery XP within a rank, and sees a new rank at once', () => {
  const g = freshGame('swordsman');
  const eq = g.equipment, w = eq.get('weapon');
  const fresh = () => eq.itemBonuses(w, eq.copyIn('weapon'), eq.qualityIn('weapon'));
  // Totals worked out from nothing kept (the looplag test's plain answer).
  const plain = () => { eq._worn = null; eq._bonusMemo = null; eq._hasteMemo = null; return eq.bonuses(); };
  for (let r = 1; r < MASTERY_RANKS.length; r++) {
    eq.setMastery(w, Math.ceil(MASTERY_RANKS[r].xp));
    assert.equal(eq.masteryRank(w), r);
    const part = eq._wornBonuses('weapon', w);
    assert.deepEqual(part, fresh(), `rank ${r}`);
    // Kills add XP short of the next rank: the very same bonuses, not made again.
    const next = MASTERY_RANKS[r + 1]?.xp ?? MASTERY_RANKS[r].xp * 2;
    for (const xp of [MASTERY_RANKS[r].xp + 1, Math.floor((MASTERY_RANKS[r].xp + next) / 2), next - 1]) {
      eq.setMastery(w, xp);
      assert.equal(rankFor(eq.masteryXp(w)), r);
      assert.equal(eq._wornBonuses('weapon', w), part, `rank ${r}, ${xp} XP: kept`);
    }
    assert.deepEqual(eq.bonuses(), plain(), `rank ${r}: the same totals`);   // (plain() starts the records afresh)
  }
  // Real kills train what you wear: the totals always match the plain sums.
  const foe = g.npcs.find((n) => n.attackable && !n.def.boss);
  for (let i = 0; i < 40; i++) { g._gainMastery(foe); assert.deepEqual(eq.bonuses(), plain(), `kill ${i}`); eq.bonuses(); }
});
