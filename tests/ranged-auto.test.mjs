// Auto battle with a bow, gun or spell holds its ground: it shoots whatever is
// already in reach, only walks as far as the first tile in range, and doesn't
// chase a target that wanders off while another can be shot from where it
// stands. Melee still walks up to its foes. (The owner: "auto battle for the
// ranged classes seems to make them walk around too much".)
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { chebyshev } from '../src/core/utils.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }

/** A game of the given class on an open patch of ground, with no other
 *  monsters about (so nothing else can draw it away). */
function arena(cls) {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  let spot = null;
  for (let y = 30; y < 250 && !spot; y += 2) for (let x = 30; x < 370 && !spot; x += 2) {
    let ok = !g.world.zoneAt(x, y)?.wilderness;
    for (let dy = -12; dy <= 12 && ok; dy++) for (let dx = -14; dx <= 14 && ok; dx++) if (!g.world.inBounds(x + dx, y + dy) || g.world.isBlocked(x + dx, y + dy)) ok = false;
    if (ok) spot = { x, y };
  }
  assert.ok(spot, 'an open patch of ground');
  g.npcs = [];
  g._placePlayer(spot.x, spot.y);
  return { g, p: g.player, spot };
}

/** A monster of your level that stays put and can't hurt you, `dx` tiles east
 *  of you (and `dy` south). */
function foe(g, dx, dy = 0, hp = 40) {
  const p = g.player;
  const n = g.spawnNpc('goblin', p.x + dx, p.y + dy, { wander: 0 });
  n.def = { ...n.def, level: g.fightLevel(), maxHit: 0, aggressive: false };
  n.hp = n.maxHp = hp;
  n.respawnTicks = 1e9;
  return n;
}

/** Run `ticks` world ticks, counting the tiles the player walks. */
function walk(g, ticks) {
  const p = g.player;
  let tiles = 0, tx = p.tx, ty = p.ty;
  for (let i = 0; i < ticks; i++) {
    for (let k = 0; k < 6; k++) {
      g.update(100);
      if (p.tx !== tx || p.ty !== ty) { tiles += chebyshev(p.tx, p.ty, tx, ty); tx = p.tx; ty = p.ty; }
    }
  }
  return tiles;
}

test('a Ranger with monsters in reach shoots them all from where it stands', () => {
  const { g } = arena('ranger');
  const range = g.attackRange();
  assert.ok(range >= 10, `a longbow reaches far (${range})`);
  const foes = [foe(g, 5), foe(g, -7, 3), foe(g, 2, -9), foe(g, 9, 6)];
  g.toggleAutoBattle(true);
  const tiles = walk(g, 120);
  assert.ok(foes.every((n) => !n.alive), `all four shot down (${foes.filter((n) => n.alive).length} left)`);
  assert.ok(tiles <= 1, `it stood its ground (walked ${tiles} tiles)`);
});

test('a ranged fighter walks only as far as its weapon range, not up to the target', () => {
  const { g, p } = arena('pistoler');
  const range = g.attackRange();
  const n = foe(g, range + 6, 0, 1e6);
  const x0 = p.x;
  g.toggleAutoBattle(true);
  let shotFrom = null;
  const shoot = g.doPlayerAttack.bind(g);
  g.doPlayerAttack = (t) => { if (shotFrom == null) shotFrom = chebyshev(p.x, p.y, t.x, t.y); return shoot(t); };
  walk(g, 20);
  assert.ok(shotFrom != null, 'it opened fire');
  assert.ok(shotFrom >= range - 1 && shotFrom <= range, `first shot from ${shotFrom} tiles (range ${range})`);
  assert.ok(Math.abs(p.x - x0) <= 7, `walked ${Math.abs(p.x - x0)} tiles to get in range`);
});

test('a ranged target that wanders out of reach is dropped for one in reach, without moving', () => {
  const { g, p } = arena('wizard');
  const range = g.attackRange();
  const far = foe(g, 3, 0, 1e6), near = foe(g, -3, 0, 1e6);
  g.autoBattle = true;
  g.attackNpc(far);
  assert.equal(p.action?.npc, far);
  // It steps off out of reach (another stays in reach behind you).
  far.x = far.tx = p.x + range + 4;
  if (g.tickCount % 2) g.tickCount++;   // the check runs every other tick
  const at = { x: p.x, y: p.y };
  g._autoBattleTick();
  assert.equal(p.action?.npc, near, 'turned on the monster still in reach');
  assert.ok(!p.isMoving && p.x === at.x && p.y === at.y, 'and stayed put');
});

test('ranged auto battle clears what is in reach before walking to a champion; melee still goes for the champion', () => {
  for (const cls of ['archer', 'swordsman']) {
    const { g } = arena(cls);
    const range = g.attackRange();
    const ordinary = foe(g, 1, 1);
    const champ = foe(g, range + 6, 0);
    champ.makeChampion(); champ.hp = champ.maxHp;
    g._autoChampionOk = () => true;
    const pick = g._autoPickTarget();
    if (cls === 'archer') assert.equal(pick, ordinary, `${cls}: the monster in reach first`);
    else assert.equal(pick, champ, `${cls}: champions first, as before`);
    champ.x = champ.tx = g.player.x + Math.min(range, 3);   // once in reach, the champion still comes first
    assert.equal(g._autoPickTarget(), champ, `${cls}: a champion in reach comes first`);
  }
});

test('melee auto battle still walks up to its target', () => {
  const { g, p } = arena('swordsman');
  const n = foe(g, 8, 0, 1e6);
  g.toggleAutoBattle(true);
  let hitFrom = null;
  const swing = g.doPlayerAttack.bind(g);
  g.doPlayerAttack = (t) => { if (hitFrom == null) hitFrom = chebyshev(p.x, p.y, t.x, t.y); return swing(t); };
  const tiles = walk(g, 20);
  assert.ok(hitFrom != null && hitFrom <= g.attackRange(), `struck from ${hitFrom} tiles`);
  assert.ok(tiles >= 8 - g.attackRange(), `walked up to it (${tiles} tiles)`);
});

test('a ranged fighter still steps out of a boss ground marker', () => {
  const { g, p } = arena('archer');
  const boss = g.spawnNpc('goblin', p.x + 3, p.y, { wander: 0 });
  boss.def = { ...boss.def, level: g.fightLevel(), maxHit: 0, boss: true, abilities: [] };
  boss.hp = boss.maxHp = 1e9;
  g.toggleAutoBattle(true);
  g.attackNpc(boss);
  g.hazards.push({ cx: p.x, cy: p.y, r: 1, npc: boss, kind: 'blast', sign: true, fireTick: g.tickCount + 3, start: performance.now(), dur: 1800 });
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < 12; i++) g.update(300);
  const at = g.playerTile();
  assert.ok(Math.abs(at.x - x0) > 1 || Math.abs(at.y - y0) > 1, `stepped out of the marker (now at ${at.x - x0},${at.y - y0})`);
  assert.equal(p.action?.npc, boss, 'still on the boss');
});

// The flee loop: auto battle ran at full life from champions it could take on
// (or weak ones in a crowd), then went straight back for the monsters beside
// them, woke them again and ran again: most of the walking left after the above.

test('auto battle does not run at full life from a champion it can take on, or from a harmless one it chose', () => {
  for (const ok of [true, false]) {
    const { g, p } = arena('swordsman');
    const champ = foe(g, 1, 0, 1e6);
    champ.makeChampion(); champ.hp = champ.maxHp = 1e6;   // a long fight, so the old rule ran from it
    champ.def = { ...champ.def, maxHit: 1 };
    champ.target = p;
    g._autoChampionOk = () => ok;
    g.autoBattle = true;
    g.attackNpc(champ);
    assert.equal(g._autoFlee(), false, `no run (champion ok: ${ok})`);
    assert.equal(p.action?.npc, champ, 'still fighting it');
  }
});

test('auto battle still runs from a monster far above it, and keeps away from it for a while', () => {
  const { g, p, spot } = arena('archer');
  const deadly = foe(g, 2, 0, 1e6);
  deadly.def = { ...deadly.def, level: g.fightLevel() * 3 + 30, maxHit: 60 };
  deadly.target = p;
  const beside = foe(g, 4, 1);   // an ordinary monster of your level right by it
  g.autoBattle = true;
  assert.equal(g._autoFlee(), true, 'it runs');
  // Later, back near it (it has gone home and calmed down): the monster beside
  // it is left alone instead of waking it again...
  deadly.target = null;
  g._fleeing = null;
  g._placePlayer(spot.x - 4, spot.y);
  assert.notEqual(g._autoPickTarget(), beside, 'the monster beside it is passed over');
  // ...until the memory runs out.
  g.tickCount += 201;
  assert.equal(g._autoPickTarget(), beside, 'and fought again once the memory runs out');
});
