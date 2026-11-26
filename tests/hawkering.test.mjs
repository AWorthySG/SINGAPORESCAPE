// Hawkering: your own stall at the Marina Bay hawker centre (hawkerstall.js).
// Renting it, customers queueing with orders and patience, serving by hand and
// with auto-serve (from the pack, then the bank), coins and tips, streaks,
// reputation and VIPs, the signature dishes cooked at the stall's wok, its XP
// an hour beside the making skills, its coins an hour beside Thieving and
// selling the catch, its wiring, and saves.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { xpForLevel } from '../src/data/xp.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { SKILL_BY_ID } from '../src/data/skills.js';
import { SHOPS } from '../src/data/shops.js';
import { ORDERS, SIGNATURE, STALL_RENT, SERVICE, serviceAt, PATIENCE, PRICE_SHARE, VIP_LEVEL } from '../src/data/hawkering.js';
import { HAWKER_XP_MULT, hawkerXpMult, findStallSpot } from '../src/game/hawkerstall.js';
import { SKILL_UNLOCKS, UNLOCKS } from '../src/data/unlocks.js';
import { SKILL_HOURS } from '../src/data/skillhours.js';
import { LIFE_PERKS } from '../src/game/lifeperks.js';
import { SKILL_PETS } from '../src/game/pets.js';
import { LIFE_SHORTCUTS, lifeShortcutHint } from '../src/game/quickbar.js';
import { SKILL_GUIDES, MAKE_SKILLS, recipesFor, itemOtherUses } from '../src/game/skillguide.js';
import { GATHER_FUN } from '../src/game/gathering.js';
import { FISH_SCHOOL } from '../src/game/fishschool.js';
import { NODE_JACKPOT } from '../src/game/jackpot.js';
import { LEVEL_HAUL } from '../src/game/levelhaul.js';
import { skillIconSVG, itemIconSVG } from '../src/render/icons.js';
import { playerAt, gatherHour, GATHER } from '../tools/balance/productionxp.mjs';
import { stallHour, thievingCoins, fishCoins } from '../tools/balance/hawkerxp.mjs';

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
  g.npcs = [];
  return g;
}
const setLevel = (g, s, l) => { g.skills.xp[s] = xpForLevel(l); };
/** A rented stall, you standing at it. */
function atStall(g, lvl = 1) {
  setLevel(g, 'hawkering', lvl);
  const h = g.hawker;
  g.inventory.add('coins', STALL_RENT);
  assert.ok(h.rent());
  g.player.x = g.player.tx = h.obj.x; g.player.y = g.player.ty = h.obj.y + 1;
  return h;
}
const run = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };

test('Hawkering is a skill; the stall stands in front of the Marina Bay hawker centre, the same every boot', () => {
  assert.equal(SKILL_BY_ID.hawkering.group, 'making');
  const g = newGame();
  const o = g.hawker.obj;
  assert.ok(o && o.objId === 'hawker_counter', 'the counter is placed');
  assert.equal(g.world.zoneAt(o.x, o.y)?.name, 'Marina Bay');
  const hc = g.world.objects.find((x) => x.objId === 'hawker_centre');
  assert.ok(Math.abs(o.x - hc.x) <= 8 && o.y > hc.y, 'in front of the hawker centre');
  assert.ok(!g.world.isBlocked(o.x, o.y + 1), 'room to stand at it');
  const g2 = new Game();
  assert.deepEqual([g2.hawker.obj.x, g2.hawker.obj.y], [o.x, o.y]);
  assert.deepEqual(findStallSpot(g2.world) === null, false);
});

test('renting costs coins once; the stall is opened by walking up to it', () => {
  const g = newGame();
  const h = g.hawker;
  g.inventory.clear?.();
  for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s?.id === 'coins') g.inventory.removeAt(k, s.qty); }
  assert.equal(h.rent(), false, 'no coins, no stall');
  assert.equal(h.open(), false, 'not rented');
  g.inventory.add('coins', STALL_RENT);
  assert.ok(h.rent());
  assert.equal(g.inventory.count('coins'), 0);
  assert.equal(h.rent(), false, 'once');
  // Walk up: the counter's own action opens it.
  g.player.x = g.player.tx = h.obj.x; g.player.y = g.player.ty = h.obj.y + 1;
  g.defaultObjectAction(h.obj);
  run(g, 2);
  assert.ok(h.isOpen(), 'open while you stand there');
  g.player.clearAction();
  assert.ok(!h.isOpen());
});

test('customers queue for what you have, lose patience and walk off; served by hand they pay a price and a tip', () => {
  const g = newGame();
  const h = atStall(g, 30);
  for (const o of ORDERS) { g.inventory.remove(o.id, g.inventory.count(o.id)); g.bank.withdraw(o.id, g.bank.count(o.id)); }   // only what we give
  g.inventory.add('char_kway_teow', 2);
  h.open();
  run(g, 4);
  assert.ok(h.queue.length >= 1, 'a customer queues');
  assert.ok(h.queue.length <= serviceAt(30).counters, 'no more than the counters');
  assert.ok(h.queue.every((c) => c.order === 'char_kway_teow'), 'they order what you have');
  assert.ok(h.queue.length <= 2, 'no more orders than dishes');
  // By hand: Serve.
  const earned0 = h.earned, xp0 = g.skills.xp.hawkering;
  const price = h.price('char_kway_teow');
  assert.equal(price, Math.round(ITEMS.char_kway_teow.value * PRICE_SHARE));
  assert.ok(h.serve(0));
  const got = h.earned - earned0;   // (a level-up's own rewards may add coins too)
  assert.ok(got > price && got < price * 2, `the price and a tip (${got} for ${price})`);
  assert.ok(g.skills.xp.hawkering > xp0, 'Hawkering XP');
  assert.equal(g.inventory.count('char_kway_teow'), 1);
  assert.equal(h.serve(0), false, 'the next serve waits for the last to be done');
  // Sold out and left waiting, the rest walk off and the streak ends.
  g.inventory.remove('char_kway_teow', 1);
  h.streak = 7;
  run(g, PATIENCE + 6);
  assert.equal(h.queue.length, 0, 'everyone walked off');
  assert.equal(h.streak, 0);
});

test('auto-serve keeps serving from the pack, then the bank, best dish first, at the stall\'s pace', () => {
  const g = newGame();
  const h = atStall(g, 60);
  g.inventory.add('boar_rendang', 3);
  g.bank.deposit('boar_rendang', 40);
  g.inventory.add('kaya_toast', 20);
  g.toggleAutoGather(true);
  h.open();
  const s0 = h.served;
  run(g, 60);
  const served = h.served - s0;
  const ticks = serviceAt(60).ticks;
  assert.ok(served >= 60 / ticks * 0.8 && served <= 60 / ticks * 1.4, `about one serve every ${ticks} ticks (${served} in 60)`);
  assert.equal(g.inventory.count('boar_rendang'), 0, 'the pack first');
  assert.ok(g.bank.count('boar_rendang') < 40, 'then the bank');
  assert.ok(g.inventory.count('kaya_toast') > 10, 'most order the best dish you have');
  assert.equal(h.today.walked, 0, 'nobody walked off');
  assert.equal(g.autoGatherStatus(), 'Auto-serve');
});

test('levels bring more counters, faster service and VIP regulars; endgame orders from level 100', () => {
  for (let i = 1; i < SERVICE.length; i++) {
    assert.ok(SERVICE[i].level > SERVICE[i - 1].level && SERVICE[i].counters >= SERVICE[i - 1].counters && SERVICE[i].ticks <= SERVICE[i - 1].ticks);
  }
  assert.ok(serviceAt(99).counters > serviceAt(1).counters && serviceAt(99).ticks < serviceAt(1).ticks);
  // Endgame orders are the endgame dishes (Cooking 100-300).
  for (const o of ORDERS.filter((x) => x.level >= 100)) assert.ok(ITEMS[o.id]?.healPct, `${o.id} is an endgame dish`);
  for (const o of ORDERS) assert.ok(ITEMS[o.id], o.id);
  // A VIP: a regular with a special order, more patient, a much bigger tip.
  const g = newGame();
  const h = atStall(g, VIP_LEVEL);
  g.inventory.add('nasi_lemak', 10);
  h.open();
  const r = Math.random;
  try { Math.random = () => 0.01; run(g, 2); } finally { Math.random = r; }
  const vip = h.queue.find((c) => c.vip);
  assert.ok(vip, 'a VIP came by');
  assert.equal(vip.max, PATIENCE * 2);
  assert.ok(h.tip(100, vip) > h.tip(100, { ...vip, vip: false }) * 2, 'a much bigger tip');
});

test('signature dishes are cooked at the stall\'s wok from the Hawker Auntie\'s dry goods', () => {
  for (const r of SIGNATURE) {
    assert.ok(ITEMS[r.result], r.result);
    for (const [id] of r.inputs) assert.ok(ITEMS[id], `${r.result} takes ${id}`);
    assert.ok(ORDERS.some((o) => o.id === r.result), `${r.result} can be ordered`);
  }
  for (const id of ['bread', 'tea_leaves', 'condensed_milk', 'flour', 'rice', 'kway_teow', 'egg']) assert.ok(SHOPS.hawker.stock.some((s) => s.id === id), `the Hawker Auntie sells ${id}`);
  const g = newGame();
  const h = atStall(g, 30);
  g.inventory.add('kway_teow', 3); g.inventory.add('egg', 3); g.inventory.add('chilli', 3); g.inventory.add('anchovy', 3);
  g.startAll('hawkering', h.obj);
  g.update(600);
  assert.equal(g.inventory.count('char_kway_teow'), 3, 'three plates of char kway teow');
  assert.equal(recipesFor('hawkering').length, SIGNATURE.length, 'the guide lists them');
});

test('XP an hour on auto-serve matches the making skills at levels 30, 99, 200 and 500', () => {
  UNLOCKS.on = GATHER_FUN.on = FISH_SCHOOL.on = NODE_JACKPOT.on = LEVEL_HAUL.on = true;   // as the tools measure it (seed.mjs puts them back)
  for (const L of [30, 99, 200, 500]) {
    const g = playerAt(L, 20261112);
    setLevel(g, 'hawkering', L);
    const { best } = gatherHour(g);
    const avg = GATHER.reduce((a, s) => a + best[s].perHour, 0) / GATHER.length;
    const hour = stallHour(g, 600);
    assert.ok(hour.xp / avg > 0.85 && hour.xp / avg < 1.15, `level ${L}: Hawkering ${(hour.xp / avg).toFixed(2)}x the gathering (and making) average`);
  }
  const t = HAWKER_XP_MULT;
  for (const [l, m] of t) assert.ok(Math.abs(hawkerXpMult(l) - m) < 1e-9, `at ${l}`);
  assert.equal(hawkerXpMult(9999), t[t.length - 1][1]);
});

test('coins an hour stay between Thieving and selling the catch, never a coin machine', () => {
  UNLOCKS.on = GATHER_FUN.on = FISH_SCHOOL.on = NODE_JACKPOT.on = LEVEL_HAUL.on = true;
  for (const L of [30, 99, 300]) {
    const g = playerAt(L, 20261112);
    setLevel(g, 'hawkering', L); setLevel(g, 'thieving', L);
    const { perItem } = gatherHour(g);
    const hour = stallHour(g, 600);
    const fish = fishCoins(perItem), thief = thievingCoins(g);
    assert.ok(hour.coins < fish * 0.25, `level ${L}: ${Math.round(hour.coins)} an hour, far below selling an hour's catch (${Math.round(fish)})`);
    assert.ok(hour.coins < Math.max(thief, fish) && hour.coins > thief * 0.3, `level ${L}: in the band (Thieving ${Math.round(thief)})`);
  }
});

test('Hawkering is wired in: guide, unlocks and teleport, golden hours, life perk, pet, shortcut, icons', () => {
  assert.ok(SKILL_GUIDES.hawkering.use && SKILL_GUIDES.hawkering.where.every((id) => OBJECTS[id]));
  assert.ok(MAKE_SKILLS.includes('hawkering'));
  assert.deepEqual(SKILL_UNLOCKS.hawkering.map((u) => u.level), [10, 25, 50, 75, 99]);
  assert.equal(SKILL_UNLOCKS.hawkering.find((u) => u.teleport).teleport, 'marina_bay', 'the teleport goes to the hawker centre');
  assert.ok(SKILL_HOURS.hawkering && LIFE_PERKS.hawkering && SKILL_PETS.hawkering);
  assert.ok(LIFE_SHORTCUTS.includes('hawkering'));
  assert.match(skillIconSVG('hawkering'), /assets\/icons\/skill-hawkering\.webp/);
  for (const id of ['teh_tarik', 'char_kway_teow', 'bread', 'kway_teow']) assert.match(itemIconSVG(id), new RegExp(`assets/icons/item-${id}\\.webp`), `${id} has its own sticker`);
  assert.ok(itemOtherUses('laksa').some((u) => u.kind === 'serve'));
  const g = newGame();
  assert.match(lifeShortcutHint(g, 'hawkering'), /Rent/);
  // The unlocks' bigger tips.
  UNLOCKS.on = true;
  const h = atStall(g, 1);
  const c = { patience: PATIENCE, max: PATIENCE, vip: false };
  const t1 = h.tip(1000, c);
  setLevel(g, 'hawkering', 99);
  assert.ok(h.tip(1000, c) > t1 * 1.2, 'tips grow with the unlocks');
});

test('a save from before Hawkering loads at level 1 with no stall; a new save round-trips the stall', () => {
  const g = newGame();
  assert.ok(saveGame(g));
  const raw = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY));
  delete raw.skills.hawkering; delete raw.hawker;
  globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.equal(g2.skills.level('hawkering'), 1);
  assert.equal(g2.hawker.rented, false);
  const h = atStall(g2, 50);
  g2.inventory.add('seafood_stew', 5);
  g2.toggleAutoGather(true);
  h.open();
  run(g2, 20);
  assert.ok(h.served > 0);
  saveGame(g2);
  const g3 = new Game();
  assert.ok(loadGame(g3));
  assert.equal(g3.hawker.rented, true);
  assert.equal(g3.hawker.served, h.served);
  assert.equal(g3.hawker.earned, h.earned);
  assert.ok(g3.hawker.rep > 0 && Math.abs(g3.hawker.rep - h.rep) < 0.01);
  assert.equal(g3.skills.level('hawkering'), g2.skills.level('hawkering'));
});
