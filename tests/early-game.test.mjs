// The first minutes of a new character: auto battle from the respawn point
// should bring steady kills straight away and no deaths. Each of these used to
// fail: a fresh Archer spent its 999 arrows on a champion and stopped for good,
// and melee characters woke level 59-116 packmates with their cleave and died.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { NPC } from '../src/game/npc.js';
import { getNpc } from '../src/data/npcs.js';
import { chebyshev } from '../src/core/utils.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

/** A brand-new character of a class, standing at the respawn point. */
function freshGame(cls) {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseClass(cls);
  game.ui = new Proxy({}, { get: () => () => {} });
  return game;
}

/** Run auto battle for `ticks` world ticks (0.6s each), counting kills per
 *  minute (100 ticks) and deaths. */
function autoBattle(game, ticks) {
  const kills = [], deaths = [];
  let t = 0;
  const roll = game.rollDrops.bind(game);
  game.rollDrops = (n, ...a) => { kills.push(t); return roll(n, ...a); };
  const die = game.playerDeath.bind(game);
  game.playerDeath = () => { deaths.push(t); return die(); };
  game.toggleAutoBattle(true);
  for (t = 0; t < ticks; t++) game.update(600);
  const perMinute = [];
  for (let m = 0; m < ticks / 100; m++) perMinute.push(kills.filter((k) => k >= m * 100 && k < (m + 1) * 100).length);
  return { kills, deaths, perMinute };
}

test('a fresh Archer on auto battle kills a monster within its first minute', () => {
  const game = freshGame('archer');
  const { kills, deaths } = autoBattle(game, 100);
  assert.ok(kills.length >= 1, `kills in the first minute: ${kills.length}`);
  assert.equal(deaths.length, 0);
  assert.ok(game.autoBattle, 'auto battle is still running (not stopped for want of arrows)');
});

test('a shortbow spread of three arrows costs one arrow at most', () => {
  const game = freshGame('archer');
  const p = game.player;
  const before = game.inventory.count('bronze_arrow');
  const mob = game.spawnNpc('goblin', p.x + 3, p.y, { wander: 0 }); mob.maxHp = mob.hp = 1e9;
  for (let i = 0; i < 200; i++) game._rangedAttack(mob);
  // A fifth of the arrows fired are lost (the rest are picked back up): about
  // 40 for 200 shots, where paying for every arrow of a spread lost about 120.
  const spent = before - game.inventory.count('bronze_arrow');
  assert.ok(spent > 0 && spent <= 70, `200 shots (600 arrows loosed) cost ${spent} arrows`);
});

for (const cls of ['swordsman', 'rogue', 'lancer', 'archer', 'wizard', 'merchant']) {
  test(`a fresh ${cls} survives 5 minutes of auto battle from spawn with steady kills`, () => {
    const game = freshGame(cls);
    const { deaths, perMinute } = autoBattle(game, 500);
    assert.deepEqual(deaths, [], `no deaths (kills per minute ${perMinute.join('/')})`);
    assert.ok(perMinute.every((k) => k >= 1), `a kill every minute: ${perMinute.join('/')}`);
    assert.ok(perMinute.reduce((a, b) => a + b, 0) >= 15, `kills per minute ${perMinute.join('/')}`);
  });
}

test('the starter ring holds no monster above level 40', () => {
  const game = freshGame('swordsman');
  const rp = game.world.respawnPoint;
  const strong = game.npcs.filter((n) => n.def.attackable && !n.def.boss && !n._spawnOpts?.boss
    && chebyshev(n.spawnX, n.spawnY, rp.x, rp.y) <= 30 && getNpc(n.npcId).level > 40);
  assert.deepEqual(strong.map((n) => `${n.npcId}@${n.spawnX},${n.spawnY}`), []);
  // ...but the ring still has its mix of stronger forms to grow into.
  assert.ok(game.npcs.some((n) => n.def.attackable && !n.def.boss && chebyshev(n.spawnX, n.spawnY, rp.x, rp.y) <= 30
    && getNpc(n.npcId).level >= 30), 'level 30-40 forms remain');
});

test("a cleave leaves alone champions, monsters far above you and a crowd that's big enough", () => {
  const game = freshGame('swordsman');
  const p = game.player;
  const calm = (n) => { n.def = { ...n.def, aggressive: false }; n.maxHp = n.hp = 1e6; return n; };
  const target = calm(new NPC('goblin', p.x + 1, p.y, 0, {}));
  const near = calm(new NPC('goblin', p.x + 1, p.y + 1, 0, {}));
  const champ = calm(new NPC('goblin', p.x + 2, p.y, 0, {})); champ.makeChampion(); champ.hp = champ.maxHp;
  const big = calm(new NPC('goblin', p.x + 2, p.y + 1, 0, {}));
  big.def = { ...big.def, level: game.fightLevel() + 40 };
  game.npcs = [target, near, champ, big];
  game._cleave(target, 10);
  assert.equal(near.target, p, 'an ordinary neighbour is caught and joins in');
  assert.ok(near.hp < near.maxHp);
  assert.equal(champ.target, null, 'a champion is not dragged in');
  assert.equal(champ.hp, champ.maxHp);
  assert.equal(big.target, null, 'nor a monster far above your level');
  assert.equal(big.hp, big.maxHp);
  // Once it is fighting you anyway, the cleave hits it like anything else.
  big.target = p;
  game._cleave(target, 10);
  assert.ok(big.hp < big.maxHp, 'a strong monster already on you is fair game');
  // With a crowd already on you, idle monsters are left out of the swing.
  const crowd = Array.from({ length: 12 }, (_, i) => { const n = calm(new NPC('goblin', p.x - 3, p.y - 6 + i, 0, {})); n.target = p; return n; });
  const idle = calm(new NPC('goblin', p.x + 1, p.y - 1, 0, {}));
  game.npcs = [target, idle, ...crowd];
  game.tickCount += 1;   // the crowd is counted once a tick
  game._cleave(target, 10);
  assert.equal(idle.target, null, 'an idle monster is not woken while a crowd is already on you');
});

test('auto battle skips a champion it would take minutes to kill, but takes a quick one', () => {
  const game = freshGame('archer');
  const p = game.player;
  const calm = (n) => { n.def = { ...n.def, aggressive: false }; return n; };
  const mob = calm(new NPC('goblin', p.x + 2, p.y, 0, {}));
  const slog = calm(new NPC('goblin', p.x + 3, p.y, 0, {})); slog.makeChampion();
  slog.maxHp = slog.hp = 1e6;
  game.npcs = [mob, slog];
  assert.equal(game._autoPickTarget(), mob, 'the slog of a champion is left for later');
  slog.target = p;
  assert.equal(game._autoPickTarget(), slog, 'unless it is already fighting you');
  const quick = calm(new NPC('goblin', p.x + 3, p.y + 1, 0, {})); quick.makeChampion();
  quick.maxHp = quick.hp = 50;
  game.npcs = [mob, quick];
  assert.equal(game._autoPickTarget(), quick, 'a champion you can drop quickly still comes first');
});

test('auto battle never picks a monster far above your level unless it is fighting you', () => {
  const game = freshGame('swordsman');
  const p = game.player;
  const strong = new NPC('goblin', p.x + 1, p.y, 0, {});
  strong.def = { ...strong.def, level: game.fightLevel() + 40, aggressive: false };
  game.npcs = [strong];
  assert.equal(game._autoPickTarget(), null, 'left alone, even right beside you');
  strong.target = p;
  assert.equal(game._autoPickTarget(), strong, 'answered once it attacks');
});

test("killing a starter monster tamed for new players isn't an evil deed", () => {
  const game = freshGame('swordsman');
  const rp = game.world.respawnPoint;
  const tamed = game.npcs.find((n) => n._spawnOpts?.tamed && getNpc(n.npcId).aggressive && !n.def.aggressive
    && chebyshev(n.spawnX, n.spawnY, rp.x, rp.y) <= 30);
  assert.ok(tamed, 'there is a tamed monster near spawn');
  const evil = game.karma.evil;
  game.killNpc(tamed);
  assert.equal(game.karma.evil, evil, 'judged by its nature: a fierce beast, not a harmless one');
});

test("a Merchant's allies leave alone monsters far above the Merchant until the fight reaches them", () => {
  const game = freshGame('merchant');
  const p = game.player;
  p.autoRetaliate = false;
  game.inventory.add('coins', 100000);
  const strong = new NPC('goblin', p.x + 2, p.y, 0, {});
  strong.def = { ...strong.def, level: game.fightLevel() + 40, aggressive: false };
  strong.maxHp = strong.hp = 1e6;
  game.npcs = [strong];
  assert.ok(game.hireMercenary(), 'a mercenary joins');
  for (let i = 0; i < 20; i++) { p.attackCooldown = 99; game.update(600); }
  assert.equal(strong.hp, strong.maxHp, 'the mercenary leaves the far stronger monster alone');
  assert.equal(strong.target, null, 'and it never joins in');
  // Once the Merchant takes it on, the allies pitch in.
  p.setAction({ type: 'attack', npc: strong });
  for (let i = 0; i < 20; i++) { p.attackCooldown = 99; game.update(600); }
  assert.ok(strong.hp < strong.maxHp, 'allies join the Merchant\'s own fight');
});

test('auto battle runs from a monster far above it, and leaves it be until it catches up', () => {
  const game = freshGame('swordsman');
  const p = game.player;
  const strong = new NPC('goblin', p.x + 1, p.y, 0, {});
  strong.def = { ...strong.def, level: game.fightLevel() + 40, aggressive: false, maxHit: 20 };
  strong.maxHp = strong.hp = 1e6;
  strong.target = p;
  game.npcs = [strong];
  assert.ok(game._autoFlee(), 'it runs');
  assert.ok(p.isMoving && game._autoRanFrom(strong));
  // Still set on you but standing off (stuck by its home, say): not walked back to.
  strong.x = p.x + 6;
  assert.equal(game._autoPickTarget(), null, 'a monster it ran from is left alone at a distance');
  strong.x = p.x + 1;
  assert.equal(game._autoPickTarget(), strong, 'but answered once it catches up');
});

test("a flight backed against the map's edge bends off to the side", () => {
  const game = freshGame('swordsman');
  const p = game.player, w = game.world;
  // A free tile on the western edge with open ground to the north and south,
  // and a strong monster whose home lies to its north-east: straight away is off the map.
  let spot = null;
  for (let y = 20; y < w.height - 20 && !spot; y++) {
    if ([-12, -6, 0, 6, 12].every((dy) => !w.isBlocked(1, y + dy))) spot = { x: 1, y };
  }
  assert.ok(spot, 'there is open ground on the western edge');
  p.x = p.tx = spot.x; p.y = p.ty = spot.y;
  const strong = new NPC('goblin', spot.x + 1, spot.y, 0, {});
  strong.def = { ...strong.def, level: game.fightLevel() + 40, aggressive: false, maxHit: 20 };
  strong.maxHp = strong.hp = 1e6;
  strong.spawnX = spot.x + 6; strong.spawnY = spot.y - 6;
  strong.target = p;
  game.npcs = [strong];
  assert.ok(game._autoFlee(), 'it still finds somewhere to run');
});
