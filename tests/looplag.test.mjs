// The game loop in a late game (thousands of NPCs, auto battle killing several
// monsters a second, a bag of hundreds of items): monsters at rest skip their
// frames, skill levels and gear totals are kept until what they come from
// changes, one pass over the world per tick does the aggro count and picks who
// ticks, the list of who is around is kept across ticks, and a loot sweep tells
// the bag once. Each keeps the answer the plain way gives. All headless.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { Character } from '../src/game/character.js';
import { NPC } from '../src/game/npc.js';
import { Skills } from '../src/game/skillset.js';
import { EventBus } from '../src/core/events.js';
import { levelForXp, maxLevelFor, xpForLevel } from '../src/data/xp.js';
import { ITEMS } from '../src/data/items.js';
import { equivalentArmour } from '../src/data/classes.js';
import { masteryType } from '../src/game/mastery.js';
import * as Mercs from '../src/game/mercenary.js';

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

test('a monster at rest skips its frames, eases exactly as before, and wakes the moment anything moves it', () => {
  const c = new Character(5, 5);
  // Before its first frame the drawn offset is the raw one (a swing already under way shows at once).
  c.swing = 120; c.swingDur = 240; c.lungeDX = 1;
  assert.ok(c.renderOffset().x !== 0, 'raw offset before the first frame');
  // The easing, frame by frame, against the formula it always used: the raw
  // offset after this frame's timers, eased in (and taken whole on the first frame).
  let ox, oy;
  const k = (dt) => 1 - Math.exp(-dt / 35);
  for (let f = 0; f < 400; f++) {
    const dt = f % 7 === 3 ? 33 : 16;
    c.update(dt);
    const r = c._rawOffset();
    ox = (ox ?? r.x) + (r.x - (ox ?? r.x)) * k(dt);
    oy = (oy ?? r.y) + (r.y - (oy ?? r.y)) * k(dt);
    const got = c.renderOffset();
    for (const [mine, was, axis] of [[got.x, ox, 'x'], [got.y, oy, 'y']]) {
      if (Math.abs(was) >= 1e-6) assert.equal(mine, was, `frame ${f}: the same ${axis} offset as before`);
      else assert.ok(Math.abs(mine - was) < 1e-6, `frame ${f}: ${axis} settled within a millionth of a pixel`);
    }
    if (f === 150) { c.knock = 160; c.knockDX = -1; c.knockDY = 0.5; }   // knocked back mid-way
  }
  assert.equal(c._offX, 0, 'settled exactly');
  assert.equal(c.animMove, 0);
  // At rest a frame changes nothing (and does no work).
  let ticked = 0;
  const tt = c._tickTimers;
  c._tickTimers = function (dt) { ticked++; return tt.call(this, dt); };
  for (let f = 0; f < 10; f++) c.update(16);
  assert.equal(ticked, 0, 'skipped while at rest');
  // A hit, a swing or a walk wakes it straight away.
  c.hurt = 200;
  c.update(16);
  assert.equal(ticked, 1);
  assert.ok(c.hurt < 200);
  for (let f = 0; f < 60; f++) c.update(16);
  const at = ticked;
  c.setPath([{ x: 6, y: 5 }]);
  for (let f = 0; f < 40; f++) c.update(16);
  assert.ok(ticked > at, 'walking runs its frames');
  assert.equal(c.x, 6, 'and it walked');
  c._tickTimers = tt;
});

test('every monster has one object shape (the frame loop reads hundreds of them)', () => {
  const a = new NPC('goblin', 1, 1, 0, {}), b = new NPC('chicken', 2, 2, 0, null);
  a.update(16); a.takeDamage(1); a.die(); a.update(16);
  assert.deepEqual(Object.keys(a), Object.keys(b), 'a fight adds no new fields');
});

test('skill levels are kept until the XP changes, however it changes', () => {
  const s = new Skills(new EventBus());
  for (const xp of [0, 83, 1e3, 13034431, 2e7, 5e8, 3.7e9]) {
    for (const id of ['mining', 'attack', 'strength', 'ranged', 'magic', 'defence']) {
      s.xp[id === 'strength' ? 'attack' : id] = xp;
      assert.equal(s.level(id), levelForXp(xp, maxLevelFor(id === 'strength' ? 'attack' : id)), `${id} at ${xp} XP`);
    }
    s.xp.agility = xp / 3;
    assert.equal(s.danceLevel(), levelForXp(s.xp.agility + s.xp.ranged, maxLevelFor('ranged')));
  }
  s.xp.mining = xpForLevel(50);
  assert.equal(s.level('mining'), 50);
  s.addXp('mining', 1e9);
  assert.equal(s.level('mining'), levelForXp(s.xp.mining, maxLevelFor('mining')));
});

test('gear totals are kept, but every change to the gear (however it is made) is seen at once', () => {
  const g = freshGame('rogue');   // dual wielding: both hands' copies count
  const eq = g.equipment;
  // The plain answer: the same sums with nothing kept from before.
  const plain = (hand) => { eq._worn = null; eq._bonusMemo = null; eq._hasteMemo = null; return { b: eq.bonuses(hand), h: eq.hasteMult(), s: eq.weaponSpeed() }; };
  const same = (why) => {
    // Every hand's totals as kept from before the change, then the plain ones.
    const kept = [null, 'main', 'off'].map((hand) => ({ b: eq.bonuses(hand), h: eq.hasteMult(), s: eq.weaponSpeed() }));
    assert.deepEqual(kept, [null, 'main', 'off'].map(plain), why);
  };
  const w = eq.get('weapon');
  same('as started');
  eq.setMastery(w, 200000); same('mastery set');
  eq.mastery[masteryType(w)] = 480000; same('mastery written straight in');
  eq.refines[w] = 7; same('refined');
  eq.offRefines[w] = 3; same('the off-hand copy refined');
  eq.enchants[w] = [{ stat: 'crit', value: 4 }, { stat: 'haste', value: 50 }]; same('enchanted');
  eq.enchants[w].push({ stat: 'atkPct', value: 9 }); same('a line added in place');
  eq.enchants[w][0].value = 11; same('a line changed in place');
  eq.slotQuality.weapon = 'epic'; same('a quality copy');
  const body = Object.keys(ITEMS).find((id) => ITEMS[id].equip?.slot === 'body' && ITEMS[id].equip.bonuses?.defence > 20 && g.equipment.styleFits(id));
  eq.set('body', body); same('a new body');
  eq.slots.ring = Object.keys(ITEMS).find((id) => ITEMS[id].equip?.slot === 'ring'); same('a ring put straight into the slot');
  eq.clearSlot('shield'); same('the off-hand emptied');
  const extra = eq.extra;
  eq.extra = () => ({ haste: 25, crit: 3 }); same('outside bonuses changed');
  eq.extra = extra; same('and back');
  // Changing what bonuses() hands back never changes the next answer.
  const b = eq.bonuses(); const atk = b.attack; b.attack += 999;
  assert.equal(eq.bonuses().attack, atk);
});

test('perk sums follow every level and class change', () => {
  const g = freshGame();
  const plain = (mode) => { g._perkLast = null; g._perkCache = null; return g.perkMods(mode); };
  for (const xp of [xpForLevel(40), xpForLevel(400), xpForLevel(4000)]) {
    g.skills.xp.attack = g.skills.xp.strength = xp;
    g.skills.xp.defence = xp / 2;
    for (const mode of ['melee', 'defence', 'ranged']) {
      const kept = g.perkMods(mode);
      assert.deepEqual(kept, plain(mode), `${mode} at ${xp}`);
      assert.deepEqual(g.perkMods(mode), kept);
    }
  }
});

test('one pass a tick counts the aggro and picks who ticks, and adds made mid-tick tick at once', () => {
  const g = freshGame();
  const p = g.player;
  // Someone far away still set on you counts toward the aggro cap, as before.
  const chaser = new NPC('goblin', p.x + 200, p.y, 0, {}); chaser.target = p;
  g.npcs.push(chaser);
  const ally = new NPC('goblin', p.x + 150, p.y, 0, {}); ally.ally = true; g.npcs.push(ally);
  const summoner = new NPC('goblin', p.x + 3, p.y, 0, {});
  let spawned = null;
  summoner.tick = function (game) { if (!spawned) { spawned = new NPC('goblin', p.x + 4, p.y, 0, {}); game.npcs.push(spawned); } return NPC.prototype.tick.call(this, game); };
  g.npcs.push(summoner);
  const seen = new Set();
  const tick = NPC.prototype.tick;
  NPC.prototype.tick = function (game) { seen.add(this); return tick.call(this, game); };
  try {
    g.doTick();
    const px = p.x, py = p.y;
    const want = g.npcs.filter((n) => n.ally || (Math.abs(n.x - px) <= 46 && Math.abs(n.y - py) <= 46));
    for (const n of want) assert.ok(seen.has(n) || n === spawned, `${n.npcId} at ${n.x},${n.y} ticked`);
    assert.ok(!seen.has(chaser), 'nobody far away ticks');
    assert.ok(seen.has(ally), 'allies always tick');
    assert.ok(spawned && seen.has(spawned), 'an add made during the ticks ticks the same tick');
    assert.ok(g._aggroAttackers >= 1, 'the far-off attacker is counted');
  } finally { NPC.prototype.tick = tick; }
});

test('the list of who is around is kept across ticks, and made again when it must be', () => {
  const g = freshGame();
  g._movePlayerNear(58, 55, 3);
  for (let i = 0; i < 12; i++) g.update(600);   // let the town settle (residents arrive, and so on)
  // A temporary NPC made once (a boss's add, an event's visitor) no longer
  // copies the whole list every tick after it.
  const t = g.spawnNpc('goblin', g.player.x + 30, g.player.y, { temporary: true });
  assert.ok(g.hasTemps);
  g.doTick();
  const arr = g.npcs, len = arr.length, list = g._npcsAround();
  g.doTick(); g.doTick();
  if (g.npcs === arr && g.npcs.length === len) assert.equal(g._npcsAround(), list, 'kept while nothing changes');
  assert.equal(g.npcs, arr, 'the NPC list is not copied while no temporary has gone');
  t.die();
  g.doTick();
  assert.ok(!g.npcs.includes(t), 'a temporary that has gone is cleared away the same tick');
  const b = new NPC('goblin', g.player.x + 3, g.player.y, 0, {}); g.npcs.push(b);
  assert.ok(g._npcsAround().includes(b), 'a new NPC is seen at once');
  const l2 = g._npcsAround();
  for (let i = 0; i < 12; i++) g.doTick();
  assert.notEqual(g._npcsAround(), l2, 'and the list is made afresh every few seconds anyway');
  g._movePlayerNear(80, 60, 3);
  const near = g.npcs.filter((n) => Math.abs(n.x - g.player.x) <= 60 && Math.abs(n.y - g.player.y) <= 60);
  assert.deepEqual(g.nearbyNpcs(), near, 'after a move, the same NPCs as a whole-world scan');
});

test('embers come from the same fires and furnaces, in the same order, as fires come and go', () => {
  const g = freshGame();
  const w = g.world;
  const plain = () => w.objects.filter((o) => o.def.type === 'fire' || o.def.type === 'furnace');
  assert.deepEqual(w.emberSources(), plain());
  let spot = null;
  for (let y = 50; y < 70 && !spot; y++) for (let x = 45; x < 70 && !spot; x++) if (!w.isBlocked(x, y) && !w.objectAt(x, y)) spot = [x, y];
  const fire = w.lightFire(spot[0], spot[1]);
  assert.ok(w.emberSources().includes(fire));
  assert.deepEqual(w.emberSources(), plain());
  w.removeObject(fire);
  assert.deepEqual(w.emberSources(), plain());
});

test('a tile keeps its zone, the same as looking it up', () => {
  const g = freshGame();
  const w = g.world;
  const plain = (x, y) => w.zones.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) || null;
  for (let i = 0; i < 4000; i++) {
    const x = (i * 37) % w.width, y = (i * 53) % w.height;
    assert.equal(w.zoneAt(x, y), plain(x, y));
    assert.equal(w.zoneAt(x, y), plain(x, y), 'and again from the record');
  }
  assert.equal(w.zoneAt(-1, 5), plain(-1, 5));
  assert.equal(w.zoneAt(2.5, 5), plain(2.5, 5));
  const keep = w.zones;
  w.zones = [{ name: 'Test', x0: 0, y0: 0, x1: w.width, y1: w.height }];
  assert.equal(w.zoneAt(10, 10).name, 'Test', 'a new list of zones is seen');
  w.zones = keep;
  assert.equal(w.zoneAt(10, 10), plain(10, 10));
});

test('a loot sweep tells the bag once, and the drops all arrive', () => {
  const g = freshGame();
  const p = g.player;
  const ids = ['bronze_arrow', 'raw_shrimps', 'iron_ore', 'bones'].filter((id) => ITEMS[id]);
  assert.ok(ids.length >= 3);
  for (const id of [...ids, 'coins']) {
    const gi = g.world.addGroundItem(id, 3, p.x, p.y);
    gi.fromKill = true; gi.lootAt = 0;
  }
  const before = ids.map((id) => g.inventory.count(id));
  let told = 0;
  g.bus.on('inventory', () => told++);
  g._autoPickup();
  assert.equal(told, 1, 'one bag event for the whole sweep');
  ids.forEach((id, i) => assert.equal(g.inventory.count(id), before[i] + 3, id));
});

test('no A-Worthlings: the merge never walks the world; with them it works as before', () => {
  const g = freshGame();
  let walks = 0;
  const list = g.npcs;
  g.npcs = new Proxy(list, { get(t, k) { if (k === 'filter') walks++; return Reflect.get(t, k); } });
  assert.equal(Mercs.mergeFollowers(g), 0);
  assert.equal(walks, 0, 'nothing to merge, nothing walked');
  g.npcs = list;
  const m = freshGame('merchant');
  for (let i = 0; i < 6; i++) Mercs.spawnFollower(m);
  assert.ok(Mercs.activeFollowers(m).length >= 2);
  assert.ok(Mercs.mergeFollowers(m, 1, 1) > 0, 'followers still merge');
  assert.equal(Mercs.activeFollowers(m).length, 1);
});

test('the stand-in armour for loot is the same answer every time', () => {
  const pieces = Object.keys(ITEMS).filter((id) => ITEMS[id].equip?.family && ITEMS[id].equip.slot !== 'weapon').slice(0, 60);
  const req = (x) => Math.max(0, ...Object.values(ITEMS[x].equip.req || {}));
  for (const id of pieces) for (const fam of ['plate', 'leather', 'hide', 'robe']) {
    const eq = ITEMS[id].equip, lvl = req(id), metal = id.split('_')[0];
    let best = null;
    for (const [x, it] of Object.entries(ITEMS)) {
      if (it.bossReward || it.equip?.family !== fam || it.equip.slot !== eq.slot || req(x) > lvl) continue;
      if (!best || req(x) > req(best) || (req(x) === req(best) && x.startsWith(metal + '_'))) best = x;
    }
    assert.equal(equivalentArmour(id, fam), best || id, `${id} as ${fam}`);
    assert.equal(equivalentArmour(id, fam), best || id, 'and again, from the record');
  }
});

test('path search: the same paths as the object-heap search it replaced, ties and all', async () => {
  const { findPath } = await import('../src/engine/pathfinding.js');
  // The search as it was (an object per open tile), to compare against.
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function before(cfg, start, goal, { reachAdjacent = false, maxNodes = 20000 } = {}) {
    const { width, height, isBlocked } = cfg;
    const inB = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
    const cheb = (x, y) => Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y));
    const isGoal = reachAdjacent ? (x, y) => cheb(x, y) <= 1 : (x, y) => x === goal.x && y === goal.y;
    if (isGoal(start.x, start.y)) return [];
    if (!reachAdjacent && (!inB(goal.x, goal.y) || isBlocked(goal.x, goal.y))) return [];
    const a = [], g = new Map(), came = new Map(), closed = new Set();
    const push = (n) => { a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } };
    const pop = () => { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let s = i; if (l < a.length && a[l].f < a[s].f) s = l; if (r < a.length && a[r].f < a[s].f) s = r; if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } } return top; };
    const key = (x, y) => y * width + x;
    g.set(key(start.x, start.y), 0);
    push({ x: start.x, y: start.y, f: cheb(start.x, start.y) });
    let processed = 0;
    while (a.length) {
      if (++processed > maxNodes) break;
      const cur = pop(), ci = key(cur.x, cur.y);
      if (closed.has(ci)) continue;
      closed.add(ci);
      if (isGoal(cur.x, cur.y)) {
        const path = []; let k = ci;
        while (k !== key(start.x, start.y)) { path.push({ x: k % width, y: Math.floor(k / width) }); k = came.get(k); }
        return path.reverse();
      }
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!inB(nx, ny) || isBlocked(nx, ny)) continue;
        if (dx && dy && (isBlocked(cur.x + dx, cur.y) || isBlocked(cur.x, cur.y + dy))) continue;
        const ni = key(nx, ny);
        if (closed.has(ni)) continue;
        const t = g.get(ci) + 1;
        if (t < (g.has(ni) ? g.get(ni) : Infinity)) { g.set(ni, t); came.set(ni, ci); push({ x: nx, y: ny, f: t + cheb(nx, ny) }); }
      }
    }
    return [];
  }
  const g = freshGame();
  const cfg = g.pathCfg();
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  let found = 0;
  for (let i = 0; i < 400; i++) {
    const sx = Math.floor(rnd() * cfg.width), sy = Math.floor(rnd() * cfg.height), r = [3, 12, 40][i % 3];
    const tx = Math.max(0, Math.min(cfg.width - 1, sx + Math.round((rnd() - 0.5) * 2 * r))), ty = Math.max(0, Math.min(cfg.height - 1, sy + Math.round((rnd() - 0.5) * 2 * r)));
    const opts = { reachAdjacent: i % 2 === 0, maxNodes: [300, 3000][i % 2] };
    const want = before(cfg, { x: sx, y: sy }, { x: tx, y: ty }, opts);
    if (want.length) found++;
    assert.deepEqual(findPath(cfg, { x: sx, y: sy }, { x: tx, y: ty }, opts), want, `${sx},${sy} -> ${tx},${ty}`);
  }
  assert.ok(found > 100, `${found} searches found a way`);
});
