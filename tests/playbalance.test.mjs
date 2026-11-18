// Play balance (src/game/playbalance.js): the Focus bar for automatic play,
// Rested XP from time away, the gravestone on death, and the bigger,
// visible combat weakness bonus.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import * as Play from '../src/game/playbalance.js';
import { clearSave, saveGame, loadGame } from '../src/game/save.js';
import { SAVE_KEY, TICK_MS, DAY_CYCLE_MS } from '../src/config.js';
import { ITEMS, getItem } from '../src/data/items.js';
import { GOLDEN, goldenMult } from '../src/data/skillhours.js';
import { weaknessOf, WEAKNESS_BONUS } from '../src/game/combat.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function boot() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass('swordsman');
  return g;
}
const tick = (g, n = 1) => { for (let i = 0; i < n; i++) { g.tickCount++; Play.tickPlay(g); } };
const HOUR = 3600 * 1000;

test('a new game starts with a full Focus bar and no rested pool', () => {
  const g = boot();
  assert.equal(g.play.focus, Play.FOCUS_MAX_MS);
  assert.equal(g.play.rested, 0);
  assert.equal(g.play.grave, null);
  assert.equal(Play.xpMult(g), 1, 'nothing changes XP for a fresh character');
});

test('automatic play spends Focus, hands-on play refills it, and it trickles back on its own', () => {
  const g = boot();
  g.play.focus = HOUR;
  g.autoBattle = true;
  g.play.handsOnTick = -1e9;
  tick(g, 100);
  const spent = HOUR - g.play.focus;
  assert.equal(spent, 100 * TICK_MS * (Play.FOCUS_SPEND - Play.FOCUS_ONLINE_REGEN), 'auto battle drains it (less the trickle)');
  // Clicking now and then while it runs: the hands-on refill outpaces the drain.
  const f0 = g.play.focus;
  for (let i = 0; i < 10; i++) { Play.handsOn(g); tick(g, 5); }
  assert.ok(g.play.focus > f0, 'hands-on play refills Focus even with auto battle on');
  // Auto off and nobody touching anything: the slow online trickle.
  g.autoBattle = false; g.play.handsOnTick = -1e9;
  const f1 = g.play.focus;
  tick(g, 10);
  assert.equal(g.play.focus - f1, 10 * TICK_MS * Play.FOCUS_ONLINE_REGEN);
  // Steering with the joystick / WASD counts as hands-on.
  g.moveInput.x = 1; tick(g, 1); g.moveInput.x = 0;
  assert.equal(g.play.handsOnTick, g.tickCount);
  // It never goes past full.
  g.play.focus = Play.FOCUS_MAX_MS; Play.handsOn(g); tick(g, 5);
  assert.equal(g.play.focus, Play.FOCUS_MAX_MS);
});

test('auto gather spends Focus only while it is at work', () => {
  const g = boot();
  g.play.focus = HOUR; g.play.handsOnTick = -1e9;
  g.autoGather = true; g._autoLife = null; g.player.clearAction();
  assert.equal(Play.autoRunning(g), false, 'switched on but idle: no Focus used');
  g._autoLife = { kind: 'gather', objId: 'tree' };
  assert.equal(Play.autoRunning(g), true);
  tick(g, 10);
  assert.ok(g.play.focus < HOUR);
});

test('out of Focus, automatic play keeps going at reduced XP and loot', () => {
  const g = boot();
  g.autoBattle = true;
  g.play.focus = 0;
  assert.equal(Play.isTired(g), true);
  assert.equal(Play.autoRunning(g), true, 'it never stops you');
  // XP: the same gain is worth TIRED_MULT as much.
  const gain = (tired) => {
    g.play.focus = tired ? 0 : Play.FOCUS_MAX_MS;
    const before = g.skills.xp.woodcutting;
    g.skills.addXp('woodcutting', 100);
    return g.skills.xp.woodcutting - before;
  };
  const full = gain(false), low = gain(true);
  assert.ok(Math.abs(low / full - Play.TIRED_MULT) < 1e-9, `tired XP ${low} vs ${full}`);
  // Hands-on play (auto off) is never tired, even at zero Focus.
  g.autoBattle = false; g.play.focus = 0;
  assert.equal(Play.isTired(g), false);
  assert.equal(Play.xpMult(g), 1);
  // Loot: stackables shrink, rare drops are untouched, common single items may not drop.
  g.autoBattle = true;
  const single = Object.keys(ITEMS).find((id) => !ITEMS[id].stackable && ITEMS[id].value > 0);
  const loot = [['coins', 100, 'common'], ['coins', 1, 'common'], [single, 1, 'rare'], [single, 1, 'common']];
  Play.trimLoot(g, loot, () => 0.99);
  assert.deepEqual(loot.map((l) => l[1]), [70, 1, 1], 'coins x0.7 (at least 1), the rare item kept, the common one gone');
  const kept = [[single, 1, 'common']];
  Play.trimLoot(g, kept, () => 0.1);
  assert.equal(kept.length, 1, 'most common items still drop');
  // With Focus, loot is untouched.
  g.play.focus = 1000;
  const full2 = [['coins', 100, 'common']];
  Play.trimLoot(g, full2);
  assert.equal(full2[0][1], 100);
});

test('running out of Focus says so once', () => {
  const g = boot();
  const said = [];
  g.bus.on('chat', (m) => said.push(m.text));
  g.autoBattle = true; g.play.handsOnTick = -1e9;
  g.play.focus = TICK_MS;
  tick(g, 5);
  assert.equal(said.filter((t) => t.includes('Focus has run out')).length, 1);
  assert.equal(g.play.tired, true);
});

test('time away builds Rested XP (capped) and refills Focus', () => {
  const g = boot();
  const now = 1_800_000_000_000;
  // A quick reload doesn't count.
  Play.loadPlay(g, { focus: 1000, rested: 0 }, now - 5 * 60 * 1000, now);
  assert.equal(g.play.rested, 0);
  assert.equal(g.play.focus, 1000);
  assert.equal(g.play.welcome, undefined);
  // Four hours away: an hour of rested play, and two hours of Focus back.
  Play.loadPlay(g, { focus: 1000, rested: 0 }, now - 4 * HOUR, now);
  assert.equal(g.play.rested, 4 * HOUR * Play.RESTED_RATE);
  assert.equal(g.play.focus, 1000 + 4 * HOUR * Play.FOCUS_OFFLINE_REGEN);
  assert.match(g.play.welcome, /away 4h 00m.*Rested: \+50% XP for your next 1h 00m/);
  // A day away: capped at RESTED_CAP_MS (8 hours' worth) and a full Focus bar.
  Play.loadPlay(g, { focus: 0, rested: 0 }, now - 24 * HOUR, now);
  assert.equal(g.play.rested, Play.RESTED_CAP_MS);
  assert.equal(Play.RESTED_CAP_MS, 8 * HOUR * Play.RESTED_RATE);
  assert.equal(g.play.focus, Play.FOCUS_MAX_MS);
  // Older saves (no play field) load full and unrested.
  Play.loadPlay(g, undefined, undefined, now);
  assert.equal(g.play.focus, Play.FOCUS_MAX_MS);
  assert.equal(g.play.rested, 0);
});

test('Rested XP is +50%, stacks with golden hours and tired play, and is used up by play that earns XP', () => {
  const g = boot();
  g.play.rested = 3 * TICK_MS;
  const before = g.skills.xp.woodcutting;
  g.play.rested = 0; g.skills.addXp('woodcutting', 100);
  const plain = g.skills.xp.woodcutting - before;
  g.play.rested = 3 * TICK_MS;
  const b2 = g.skills.xp.woodcutting;
  g.skills.addXp('woodcutting', 100);
  assert.ok(Math.abs((g.skills.xp.woodcutting - b2) / plain - Play.RESTED_MULT) < 1e-9, 'rested XP is worth 1.5x');
  // Golden hours multiply with it: woodcutting's window is 8 AM to 2 PM.
  GOLDEN.on = true;
  g.playMs = DAY_CYCLE_MS * 10 / 24;   // 10 AM on the game clock
  assert.ok(Math.abs(g.skills.timeMult('woodcutting') - goldenMult('woodcutting', g.gameHour()) * Play.RESTED_MULT) < 1e-9);
  assert.equal(g.skills.timeMult('woodcutting'), 2.25);
  GOLDEN.on = false;
  // Tired and rested: 1.5 x 0.7.
  g.autoBattle = true; g.play.focus = 0;
  assert.ok(Math.abs(Play.xpMult(g) - Play.RESTED_MULT * Play.TIRED_MULT) < 1e-9);
  g.autoBattle = false; g.play.focus = Play.FOCUS_MAX_MS;
  // Each tick that earned XP uses up a tick of the pool; idle ticks don't.
  g.play.rested = 3 * TICK_MS; g.play.xpTick = false;
  tick(g, 5);
  assert.equal(g.play.rested, 3 * TICK_MS, 'standing about keeps it');
  for (let i = 0; i < 3; i++) { g.skills.addXp('woodcutting', 1); tick(g, 1); }
  assert.equal(g.play.rested, 0);
  assert.equal(Play.xpMult(g), 1);
});

test('Focus, rested time and the gravestone survive a save, and time since the save counts as time away', () => {
  const g = boot();
  g.play.focus = 1234567;
  g.play.rested = 0;
  g.play.grave = { x: g.player.x + 3, y: g.player.y, left: 900, coins: 40, items: [] };
  assert.equal(saveGame(g), true);
  // Pretend the save was written three hours ago.
  const data = JSON.parse(localStorage.getItem(SAVE_KEY));
  data.savedAt = Date.now() - 3 * HOUR;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const said = [];
  const g2 = new Game();
  g2.bus.on('chat', (m) => said.push(m.text));
  g2.start();
  assert.ok(Math.abs(g2.play.rested - 3 * HOUR * Play.RESTED_RATE) < 1000);
  assert.ok(Math.abs(g2.play.focus - Math.min(Play.FOCUS_MAX_MS, 1234567 + 3 * HOUR * Play.FOCUS_OFFLINE_REGEN)) < 2000);
  assert.deepEqual(g2.play.grave, { x: g.player.x + 3, y: g.player.y, left: 900, coins: 40, items: [] });
  assert.ok(said.some((t) => /You were away 3h 00m\. Rested: \+50% XP/.test(t)), 'a welcome-back message');
  // A save with a broken play field still loads, full and unrested.
  data.play = { focus: 'lots', rested: -5, grave: { x: 'a' } };
  data.savedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const g3 = new Game();
  assert.equal(loadGame(g3), true);
  assert.equal(g3.play.focus, Play.FOCUS_MAX_MS);
  assert.equal(g3.play.rested, 0);
  assert.equal(g3.play.grave, null);
});

// ---------------- The gravestone ----------------
const valuable = () => Object.keys(ITEMS).filter((id) => !ITEMS[id].stackable && !ITEMS[id].tool && ITEMS[id].value > 100 && !id.startsWith('clue'))
  .sort((a, b) => ITEMS[b].value - ITEMS[a].value);

function packForDeath(g) {
  const [a, b, c] = valuable();
  g.inventory.add('coins', 1000 - g.inventory.count('coins'));
  g.inventory.add(a, 1); g.inventory.add(b, 1); g.inventory.add(c, 1);
  g.player.x += 20;   // fall well away from the respawn point, so waking up doesn't land on the stone
  return [a, b, c];
}

test('dying leaves a gravestone with a share of the pack, never worn gear', () => {
  const g = boot();
  const [a, b, c] = packForDeath(g);
  const worn = JSON.stringify(g.equipment.serialize());
  const tools = g.inventory.slots.filter((s) => s && getItem(s.id).tool).map((s) => s.id);
  const said = [];
  g.bus.on('chat', (m) => said.push(m.text));
  const at = { x: g.player.x, y: g.player.y };
  g.playerDeath();
  const gr = g.play.grave;
  assert.ok(gr, 'a gravestone stands');
  assert.deepEqual({ x: gr.x, y: gr.y }, at);
  assert.equal(gr.coins, 1000 * Play.GRAVE_COIN_SHARE);
  assert.equal(g.inventory.count('coins'), 1000 - gr.coins);
  assert.deepEqual(gr.items.map((e) => e.id), [a, b], 'the two most valuable stacks');
  assert.equal(g.inventory.count(c), 1, 'the rest stay in the pack');
  assert.equal(gr.left, Play.GRAVE_TICKS);
  assert.equal(Play.GRAVE_TICKS, 1500, '15 minutes of play');
  assert.equal(JSON.stringify(g.equipment.serialize()), worn, 'worn gear is never touched');
  for (const t of tools) assert.ok(g.inventory.count(t) > 0, `tools stay: ${t}`);
  assert.ok(said.some((t) => t.includes('gravestone marks where you fell')), 'the penalty is explained');
});

test('walking back to the gravestone takes everything back', () => {
  const g = boot();
  const [a, b] = packForDeath(g);
  g.playerDeath();
  const gr = g.play.grave;
  g.respawnPlayer();
  tick(g, 3);
  assert.ok(g.play.grave, 'it waits while you are away from it');
  assert.equal(g.play.grave.left, Play.GRAVE_TICKS - 3);
  g.player.x = gr.x + 1; g.player.y = gr.y;
  tick(g, 1);
  assert.equal(g.play.grave, null);
  assert.equal(g.inventory.count('coins'), 1000);
  assert.equal(g.inventory.count(a), 1);
  assert.equal(g.inventory.count(b), 1);
});

test('the gravestone can be fetched for a small fee, and crumbles if left too long', () => {
  const g = boot();
  packForDeath(g);
  g.playerDeath();
  g.respawnPlayer();
  const gr = g.play.grave;
  const worth = gr.coins + gr.items.reduce((s, e) => s + getItem(e.id).value * e.qty, 0);
  const fee = Play.graveFee(g);
  assert.equal(fee, Math.max(Play.GRAVE_FEE_MIN, Math.round(worth * Play.GRAVE_FEE_SHARE)));
  // Too poor: nothing happens.
  const packCoins = g.inventory.count('coins');
  g.inventory.remove('coins', packCoins);
  const bankCoins = g.bank.count('coins'); g.bank.withdraw('coins', bankCoins);
  gr.coins = 0;
  const fee0 = Play.graveFee(g);
  assert.equal(Play.buyBackGrave(g), false);
  assert.ok(g.play.grave);
  // With coins in the bank: paid, and the goods come to you.
  g.bank.deposit('coins', fee0 + 5);
  assert.equal(Play.buyBackGrave(g), true);
  assert.equal(g.play.grave, null);
  assert.equal(g.bank.count('coins'), 5);
  for (const e of gr.items) assert.ok(g.inventory.count(e.id) >= e.qty);
  // Dying again and never going back: it crumbles and the goods are lost.
  g.inventory.add('coins', 500);
  g.playerDeath(); g.respawnPlayer();
  const lost = g.play.grave.coins;
  assert.ok(lost > 0);
  g.player.x = g.play.grave.x + 10;
  tick(g, Play.GRAVE_TICKS);
  assert.equal(g.play.grave, null);
});

test('dying twice before getting back moves the old gravestone\'s goods to the new one', () => {
  const g = boot();
  packForDeath(g);
  g.playerDeath(); g.respawnPlayer();
  const first = { ...g.play.grave, items: g.play.grave.items.map((e) => ({ ...e })) };
  g.inventory.add('coins', 100);
  g.playerDeath();
  const gr = g.play.grave;
  assert.ok(gr.coins > first.coins, 'coins add up');
  for (const e of first.items) assert.ok(gr.items.find((x) => x.id === e.id), `${e.id} carried over`);
  assert.equal(gr.left, Play.GRAVE_TICKS, 'the timer starts again');
});

test('no gravestone in the Endless Gate, or with nothing to take', () => {
  const g = boot();
  packForDeath(g);
  g.waves.active = true;
  assert.equal(Play.onDeath(g), null);
  g.waves.active = false;
  assert.equal(g.play.grave, null);
  g.inventory.clear();
  assert.equal(Play.onDeath(g), null);
});

// ---------------- Combat weakness ----------------
test('hitting a weakness is worth +25% and tags the hit number', () => {
  assert.equal(WEAKNESS_BONUS.dmg, 1.25);
  const g = boot();
  const foes = g.npcs.filter((n) => n.attackable);
  const weakMelee = foes.find((n) => weaknessOf(n.def) === 'melee');
  const notMelee = foes.find((n) => weaknessOf(n.def) !== 'melee');
  g._hitMode = 'melee';
  g._applyPlayerHit(weakMelee, 5);
  const splat = (n) => g.effects.filter((e) => e.type === 'hitsplat' && e.entity === n && e.dmg > 0).at(-1);
  assert.equal(splat(weakMelee).weak, true, 'a "weak!" tag on the number');
  g._applyPlayerHit(notMelee, 5);
  assert.equal(splat(notMelee).weak, false);
  // A blocked hit gets no tag.
  const before = g.effects.length;
  g._applyPlayerHit(weakMelee, 0);
  assert.ok(g.effects.slice(before).every((e) => !e.weak));
});

test('_offensiveMods applies the weakness bonus to damage', () => {
  const g = boot();
  const foes = g.npcs.filter((n) => n.attackable);
  const weak = foes.find((n) => weaknessOf(n.def) === 'melee' && !n.def.boss);
  const other = foes.find((n) => weaknessOf(n.def) !== 'melee' && !n.def.boss);
  const m1 = g._offensiveMods(weak, 'melee');
  assert.equal(m1.weak, true);
  assert.equal(g._hitMode, 'melee');
  const m2 = g._offensiveMods(other, 'melee');
  assert.equal(m2.weak, false);
});
