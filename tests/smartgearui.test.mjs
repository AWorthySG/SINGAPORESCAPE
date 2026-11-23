// The gear run windows (src/ui/smartgearui.js) and the hooks for them:
// the "Keep refining until…" and "Keep enchanting until…" cards, the "Improve
// worn gear" window, the salvage windows' bulk buttons above their lists, the
// Equip best note, and the ui.js / index.html / CSS wiring. Drawn into a
// stand-in DOM that keeps each element's listeners, so a tap can be played:
// the first tap must only ask, and nothing is spent until the confirm.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { EQUIP_SLOTS } from '../src/game/equipment.js';
import { enchantPool } from '../src/game/mastery.js';
import { bestAim, improvePlan } from '../src/game/smartgear.js';
import { mountRefineRun, mountEnchantRun, openImprove, refineForecastText, stopText } from '../src/ui/smartgearui.js';
import { openDismantle, openSacrifice, picksText } from '../src/ui/salvageui.js';
import { watchUpgrades, equipBestNoteHTML } from '../src/ui/whatnextui.js';

function newGame(cls) {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const s of Object.keys(g.skills.xp)) g.skills.xp[s] = xpForLevel(200);
  return g;
}
function lateGame() {
  const g = newGame('swordsman');
  for (const s of EQUIP_SLOTS) g.equipment.clearSlot(s);
  g.inventory.clear();
  for (const [s, id] of [['weapon', 'jade_sword'], ['head', 'jade_full_helm'], ['body', 'jade_platebody'], ['legs', 'jade_platelegs'], ['shield', 'jade_kiteshield'], ['ring', 'jade_ring']]) g.equipment.set(s, id);
  g.equipment.refines.jade_sword = 9;
  g.equipment.enchants.jade_sword = [{ stat: 'crit', value: 5 }, { stat: 'critDmg', value: 15 }, { stat: 'atkPct', value: 10 }];
  g.inventory.add('starmetal_sword', 1);
  g.inventory.add('upgrade_stone', 600); g.inventory.add('upgrade_ward', 12); g.inventory.add('refine_scroll', 300); g.inventory.add('coins', 2e7);
  return g;
}

// ---- A stand-in DOM: elements keep their listeners, and the whole tree reads back as HTML, in order ----
function el(tag = 'div') {
  return {
    tag, className: '', textContent: '', disabled: false, children: [], _html: '', on: {}, attrs: {},
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; this.children = []; },
    appendChild(c) { this.children.push(c); return c; },
    insertAdjacentHTML(_, h) { this.children.push({ html: h }); },
    addEventListener(type, fn) { (this.on[type] ||= []).push(fn); },
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelector: () => el(), querySelectorAll: () => [],
  };
}
const html = (n) => (n.html !== undefined ? n.html : `<${n.tag} class="${n.className}">${n._html}${n.textContent}${n.children.map(html).join('')}</${n.tag}>`);
const all = (n, ok, out = []) => { if (n.html === undefined) { if (ok(n)) out.push(n); n.children.forEach((c) => all(c, ok, out)); } return out; };
const byClass = (root, cls) => all(root, (n) => ` ${n.className} `.includes(` ${cls} `));
const tap = (n, ev = {}) => (n.on.click || []).forEach((f) => f(ev));
function withDom(fn) {
  const had = globalThis.document;
  globalThis.document = { createElement: el };
  try { return fn(); } finally { globalThis.document = had; }
}
/** A UI stand-in: openModal draws into a stand-in body. */
function fakeUI(g) {
  const ui = { game: g, calls: [] };
  ui.openModal = (title, render) => { ui.modal = { title, render }; ui.body = el(); ui.title = title; render(ui.body); };
  ui.openMastery = () => ui.calls.push('openMastery');
  return ui;
}

test('Keep refining until…: the card, a first tap that only asks, and a confirm that keeps to the limits', () => withDom(() => {
  const g = lateGame();
  const ui = { game: g, modal: {} };
  const body = el();
  const rerender = () => { body.innerHTML = '<div class="gear-intro"></div>'; mountRefineRun(ui, body, 'jade_sword', 'main', rerender); };
  rerender();
  const out = html(body);
  for (const s of ['Keep refining until…', 'Stop at', 'Scrolls, at most', 'Wards, at most', 'Refine up to ★12', 'One try at a time']) assert.ok(out.includes(s), s);
  const o = ui._smart.refine['jade_sword#main'];
  assert.equal(o.target, 12);
  const scrolls = g.inventory.count('refine_scroll'), wards = g.inventory.count('upgrade_ward');
  tap(byClass(body, 'smart-go')[0]);
  assert.ok(ui.modal._smartSt.pending, 'the first tap asks');
  assert.equal(g.inventory.count('refine_scroll'), scrolls, 'and spends nothing');
  assert.match(ui.modal._smartSt.pending.html, /at most \d+ refine scrolls and \d+ upgrade wards/);
  const confirm = byClass(body, 'salvage-confirm');
  assert.equal(confirm.length, 1, 'the confirm shows in the window');
  // Cancel spends nothing...
  tap(byClass(body, 'salvage-cancel')[0]);
  assert.equal(ui.modal._smartSt.pending, null);
  assert.equal(g.inventory.count('refine_scroll'), scrolls);
  // ...a limit changed while a confirm shows puts that confirm away (it must say what it will do)...
  tap(byClass(body, 'smart-go')[0]);
  tap(byClass(body, 'smart-pm')[3]);
  assert.equal(ui.modal._smartSt.pending, null, 'the confirm made with the old limits is gone');
  assert.equal(o.maxScrolls, 45, '+5 at 40');
  o.maxScrolls = 40; rerender();
  // ...and Refine runs it, within both limits.
  tap(byClass(body, 'smart-go')[0]);
  tap(byClass(body, 'salvage-go')[0]);
  assert.ok(ui.modal._smartSt.result, 'a result to show');
  assert.ok(scrolls - g.inventory.count('refine_scroll') <= o.maxScrolls, 'scroll limit kept');
  assert.ok(wards - g.inventory.count('upgrade_ward') <= o.maxWards, 'ward limit kept');
  assert.ok(byClass(body, 'salvage-result').length, 'the green box');
  assert.notEqual(ui._smart.refine['jade_sword#main'], o, 'the next run starts from fresh suggestions');
}));

test('refine forecast words and stop words', () => {
  const f = { reach: 0.8, ends: { 9: 0.05, 10: 0.05, 11: 0.1, 12: 0.8 }, scrolls: { avg: 21, max: 40 }, wards: { avg: 2, max: 4 } };
  const t = refineForecastText(f, { level: 9, target: 12, maxScrolls: 40, maxWards: 4 });
  assert.match(t, /Reaches ★12 about 8 times in 10; otherwise it stops at ★11 or ★10\./);
  assert.match(t, /Likely uses about 21 scrolls and 2 wards; never more than 40 and 4\./);
  assert.match(refineForecastText({ ...f, reach: 0.97 }, { level: 9, target: 12, maxScrolls: 40, maxWards: 4 }), /Almost surely reaches ★12/);
  assert.match(stopText('downgrade', { start: true }), /Tick 'Keep going…'/);
  assert.equal(stopText('scrollcap'), 'your scroll limit');
});

test('Keep enchanting until…: every select offers Anything and the seven lines, set to what helps you most', () => withDom(() => {
  const g = lateGame();
  const ui = { game: g, modal: {} };
  const body = el();
  mountEnchantRun(ui, body, 'jade_platebody', 'main', () => {});
  const sels = all(body, (n) => n.tag === 'select');
  assert.equal(sels.length, 3);
  for (const s of sels) {
    assert.match(s.innerHTML, /<option value="">Anything<\/option>/);
    for (const stat of enchantPool('jade_platebody')) assert.ok(s.innerHTML.includes(`<option value="${stat}">`), stat);
    assert.equal((s.innerHTML.match(/<option /g) || []).length, 8);
  }
  const best = bestAim(g, 'jade_platebody');
  assert.deepEqual(sels.map((s) => s.value), [0, 1, 2].map((i) => best[i] || ''));
  const out = html(body);
  assert.ok(out.includes('Enchant until done'));
  assert.ok(out.includes('Tries, at most') && out.includes('Wards, at most'));
  assert.ok(out.includes('It keeps every line you aim for and never makes a line weaker.'));
  // Choosing "Anything" everywhere: nothing to aim for, so it can't start.
  const o = ui._smart.enchant['jade_platebody#main'];
  o.aim = [null, null, null];
  const b2 = el();
  mountEnchantRun(ui, b2, 'jade_platebody', 'main', () => {});
  assert.ok(html(b2).includes('Choose at least one line to aim for.'));
  assert.ok(byClass(b2, 'smart-go')[0].disabled);
}));

test('Improve worn gear: three steps with their costs, a confirm naming the most it spends, and an empty state', () => withDom(() => {
  const g = lateGame();
  Object.assign(g.equipment.refines, { jade_full_helm: 3, jade_platebody: 5 });
  g.inventory.add('mithril_bar', 300);
  const ui = fakeUI(g);
  openImprove(ui);
  assert.equal(ui.title, 'Improve worn gear');
  assert.equal(ui.modal.kind, 'improve');
  const out = html(ui.body);
  for (const s of ['Refine to ★9', 'Fill empty enchant lines', 'Feed materials up to Master', 'scrolls', 'Mithril bar', 'What each piece gets', 'Gear mastery: piece by piece…', 'Dismantle spare gear…']) assert.ok(out.includes(s), s);
  const plan = improvePlan(g);
  assert.ok(out.includes(`${plan.fill.stones.toLocaleString('en-US')} stones · ${plan.fill.coins.toLocaleString('en-US')} coins`), 'the fill step\'s cost');
  const stones = g.inventory.count('upgrade_stone');
  const go = byClass(ui.body, 'smart-go')[0];
  assert.match(go.innerHTML, /Improve \d+ pieces/);
  tap(go);
  assert.equal(g.inventory.count('upgrade_stone'), stones, 'the first tap spends nothing');
  const pending = ui.modal._smartSt.pending;
  assert.match(pending.html, /at most [\d,]+ refine scrolls/);
  assert.ok(pending.html.includes(`${plan.fill.stones.toLocaleString('en-US')} upgrade stones and ${plan.fill.coins.toLocaleString('en-US')} coins`));
  assert.match(pending.html, /No wards are used/);
  // Nothing left to do: the empty state.
  const h = lateGame();
  for (const p of ['jade_full_helm', 'jade_platebody', 'jade_platelegs', 'jade_kiteshield', 'jade_ring']) {
    h.equipment.refines[p] = 9;
    h.equipment.enchants[p] = [{ stat: 'crit', value: 4 }, { stat: 'crit', value: 4 }, { stat: 'crit', value: 4 }];
  }
  const ui2 = fakeUI(h);
  openImprove(ui2);
  assert.ok(html(ui2.body).includes('Every safe upgrade is done'));
  assert.ok(!byClass(ui2.body, 'smart-go').length, 'no Improve button');
}));

test('Dismantle all and Sacrifice all sit above their lists, and their confirms name the kinds', () => withDom(() => {
  const g = lateGame();
  for (const [id, n] of [['rune_sword', 3], ['dragon_sword', 2], ['rune_platebody', 1], ['mithril_sword', 4]]) g.inventory.add(id, n);
  const ui = fakeUI(g);
  openDismantle(ui);
  let out = html(ui.body);
  const first = out.indexOf('gear-row');
  assert.ok(first > 0);
  assert.ok(out.indexOf('Dismantle all…') < first && out.indexOf('salvage-bulk') < first, 'heading and button before the list');
  assert.ok(out.indexOf('One kind at a time') < first);
  tap(byClass(ui.body, 'salvage-bulk')[0]);
  out = html(ui.body);
  assert.match(out, /salvage-confirm/);
  assert.match(out, /Mithril sword ×4, Rune sword ×3, Dragon sword ×2 and 1 more kind/);
  openSacrifice(ui, 'jade_sword');
  out = html(ui.body);
  const row = out.indexOf('gear-row');
  assert.ok(row > 0 && out.indexOf('Sacrifice all…') < row && out.indexOf('salvage-bulk') < row);
  tap(byClass(ui.body, 'salvage-bulk')[0]);
  assert.match(html(ui.body), /×\d/, 'the sacrifice confirm names its kinds too');
  assert.equal(picksText([{ id: 'rune_sword', n: 1 }, { id: 'iron_sword', n: 5 }]), 'Iron sword ×5 and Rune sword ×1');
}));

test('the hint when the ticks leave nothing to take', () => withDom(() => {
  const g = lateGame();
  g.inventory.add('jade_sq_shield', 1);   // as high as what you wear: not "below my worn tier"
  const ui = fakeUI(g);
  ui._salvageFilters = { offClass: false, belowTier: true, below: 'epic' };
  openDismantle(ui);
  assert.match(html(ui.body), /Nothing matches the ticked boxes: untick 'Below my worn tier'/);
}));

test('ui.js hooks', () => {
  const src = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(src, /eq-improve/);
  assert.match(src, /const n = upgradeSlots\(this\.game\)\.size;/);
  assert.match(src, /label: 'Refine…', target: item\.name, fn: \(\) => this\.openRefine\(id, copy\)/, 'worn slot: Refine…');
  assert.match(src, /label: 'Enchant…', target: item\.name, fn: \(\) => this\.openEnchant\(id, null, copy\)/, 'worn slot: Enchant…');
  assert.match(src, /label: 'Refine…', target: item\.name, fn: \(\) => this\.openRefine\(s\.id\)/, 'bag: Refine…');
  assert.match(src, /label: 'Enchant…', target: item\.name, fn: \(\) => this\.openEnchant\(s\.id\)/, 'bag: Enchant…');
  assert.match(src, /cell\.addEventListener\('contextmenu', \(e\) => \{ e\.preventDefault\(\); this\.showContextMenu\(e\.clientX, e\.clientY, acts\(\)\); \}\);/);
  assert.match(src, /Tap to remove · hold or right-click to refine or enchant/);
  assert.match(src, /mountRefineRun\(this, body, id, copy, \(\) => redraw\(body, render\)\)/);
  assert.match(src, /mountEnchantRun\(this, body, id, copy, \(\) => redraw\(body, render\)\)/);
  assert.match(src, /Improve all worn gear…/);
  assert.match(src, /openImproveGear\(\) \{ openImprove\(this\); \}/);
  assert.match(src, /Reroll the offer \(uses a ward, \$\{wards\} left; wards also save ★10\+ refines\)/);
  assert.match(src, /class="ench-preview">On offer now: /);
  assert.match(src, /Upgrade once your ★ and lines carry over/);
});

test('gearease.css: linked after qol.css, well formed, and a thumb-sized stepper on a phone', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.indexOf('href="styles/gearease.css"') > page.indexOf('href="styles/qol.css"'), 'after qol.css');
  const css = readFileSync(new URL('../styles/gearease.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const ch of css) { if (ch === '{') depth++; else if (ch === '}') { depth--; assert.ok(depth >= 0, 'an extra }'); } }
  assert.equal(depth, 0, 'every { is closed');
  const phone = css.slice(css.indexOf('@media (max-width: 540px)'));
  assert.match(phone, /\.smart-pm \{ width: 40px; height: 40px; \}/);
  assert.match(css, /\.eq-bestbar \{ display: flex;/);
  const main = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  assert.ok(!/smart-|eq-improve/.test(main), 'nothing new in main.css');
});

test('Equip best says what went on, and puts away stale "Wear it" notes', async () => {
  const g = lateGame();
  g.inventory.remove('starmetal_sword', 1);
  const pushed = [], dismissed = [];
  const ui = { game: g, lane: { push: (n) => pushed.push(n), dismissTag: (t) => dismissed.push(t) } };
  watchUpgrades(ui, { settleMs: 0, debounceMs: 0 });
  await new Promise((r) => setTimeout(r, 5));
  g.inventory.add('starmetal_sword', 1);
  g.bus.emit('inventory');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0].tag, 'wear');
  assert.match(pushed[0].html, /Starmetal sword beats what you wear once your ★ and lines carry over/);
  ui.noticeAct('wearbest');
  assert.ok(dismissed.includes('wear'), 'stale notes put away');
  const note = pushed.find((n) => n.key === 'equipbest');
  assert.ok(note, 'a note on screen');
  assert.equal(note.tag, 'equipbest');
  assert.match(note.html, /Best in slot:<\/b> Starmetal sword ★9/);
  assert.match(note.html, /your ★ and lines carried over/);
  assert.equal(equipBestNoteHTML([]), '&#10003; You already wear your best gear.');
  const four = ['weapon', 'head', 'body', 'legs'].map((slot, i) => ({ slot, from: null, to: ['jade_sword', 'jade_full_helm', 'jade_platebody', 'jade_platelegs'][i], q: null, carried: false }));
  assert.match(equipBestNoteHTML(four), /Jade sword, Jade full helm and 2 more$/);
});
