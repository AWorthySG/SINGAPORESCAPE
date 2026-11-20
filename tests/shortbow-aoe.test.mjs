// The shortbow's fanning spread (the owner: give the shortbow Archer some area
// damage). A shot's first arrow always hits the target; the 2nd and 3rd fan out
// to the nearest other foes within SHORTBOW_FAN_TILES of it, each at the arrow's
// own share. With no one else near, all three go into the target as before, so a
// lone target's (and a boss's) damage is unchanged, and so is each shot's total.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass } from '../tools/balance/classlab.mjs';
import { NPC } from '../src/game/npc.js';
import { SHORTBOW_ARROWS, SHORTBOW_FAN_TILES } from '../src/game/game.js';
import { classPerks } from '../src/game/classperks.js';
import { CLASSES } from '../src/data/classes.js';

/** A monster that stands still and never hits back, with plenty of life. */
function dummy(g, dx, dy, { id = 'goblin', hp = 1e5, boss = false } = {}) {
  const n = new NPC(id, g.player.x + dx, g.player.y + dy, 0, { aggressive: false });
  n.def = { ...n.def, maxHp: hp, ...(boss ? { boss: true } : {}) };
  n.maxHp = n.hp = hp;
  n.tick = () => {};
  return n;
}

/** Count each monster's hitsplats (and any miss puffs) while the Archer shoots. */
function watch(g) {
  const seen = { puffs: 0, splats: new Map() };
  const splat = g.addHitsplat.bind(g);
  g.addHitsplat = (e, dmg, opts = {}) => {
    if (e !== g.player && !opts.text) {
      if (!(dmg >= 1)) seen.puffs++;
      seen.splats.set(e, (seen.splats.get(e) || 0) + 1);
    }
    return splat(e, dmg, opts);
  };
  return seen;
}

/** The Archer shoots `target` (with `others` about) for `ticks` ticks, under fixed dice. */
function shoot(g, target, others, ticks = 10) {
  g.npcs = [target, ...others];
  g.player.clearAction(); g.attackNpc(target);
  for (let i = 0; i < ticks; i++) { g.player.hp = g.maxHp(); g.update(600); }
}

/** Run `fn` with the same dice every time. */
function sameDice(fn) {
  const save = Math.random; let s = 11;
  Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  try { return fn(); } finally { Math.random = save; }
}

test('a spread fans into two foes beside the target, one arrow each', () => {
  assert.equal(SHORTBOW_ARROWS, 3);
  assert.equal(SHORTBOW_FAN_TILES, 2);
  const g = setupClass('archer', 20);
  const seen = watch(g);
  const tgt = dummy(g, 3, 0), a = dummy(g, 4, 0), b = dummy(g, 4, 1), far = dummy(g, 6, 0);
  shoot(g, tgt, [a, b, far]);
  const n = seen.splats.get(tgt) || 0;
  assert.ok(n > 0, 'the target was shot');
  // One arrow of each spread for each of the three (abilities may add volleys).
  assert.equal(seen.splats.get(a), n, 'the nearest neighbour took an arrow of every spread');
  assert.equal(seen.splats.get(b), n, 'so did the next one');
  assert.equal(far.hp, far.maxHp, 'a foe 3 tiles from the target is out of the fan');
  // Each side arrow lands about as hard as the one on the target.
  for (const o of [a, b]) {
    const share = (o.maxHp - o.hp) / (tgt.maxHp - tgt.hp);
    assert.ok(share > 0.6 && share < 1.6, `a neighbour took ${share.toFixed(2)} of the target's damage`);
  }
  assert.equal(seen.puffs, 0, 'no miss puffs or 0s');
});

test('with no one near, all three arrows hit the target, exactly as before', () => {
  const run = (crowd) => sameDice(() => {
    const g = setupClass('archer', 30);
    const seen = watch(g);
    const tgt = dummy(g, 3, 0);
    const others = [dummy(g, 3, 6), dummy(g, 4, 6)];   // made either way: making one rolls dice
    g.spawnHitSparks = () => {};
    shoot(g, tgt, crowd ? others : []);
    return { dmg: tgt.maxHp - tgt.hp, splats: seen.splats.get(tgt), others: others.map((o) => o.maxHp - o.hp) };
  });
  const alone = run(false), farCrowd = run(true);
  assert.ok(alone.dmg > 0);
  assert.equal(farCrowd.dmg, alone.dmg, 'foes out of the fan change nothing');
  assert.equal(farCrowd.splats, alone.splats);
  assert.ok(farCrowd.others.every((d) => d === 0));
});

test('a shot deals the same total whether it fans out or not', () => {
  const run = (fanned) => sameDice(() => {
    const g = setupClass('archer', 30);
    const tgt = dummy(g, 3, 0);
    const others = fanned ? [dummy(g, 4, 0), dummy(g, 4, 1)] : [dummy(g, 3, 6), dummy(g, 4, 6)];
    g.spawnHitSparks = () => {};
    shoot(g, tgt, others, 6);
    return [tgt, ...others].reduce((s, o) => s + o.maxHp - o.hp, 0);
  });
  assert.equal(run(true), run(false), 'the same arrows, only spread around');
});

test('an idle boss beside the target is never hit; a boss fighting you is', () => {
  const g = setupClass('archer', 50);
  const tgt = dummy(g, 3, 0), boss = dummy(g, 4, 0, { id: 'chilli_crab', hp: 1e7, boss: true });
  shoot(g, tgt, [boss], 8);
  assert.ok(tgt.hp < tgt.maxHp);
  assert.equal(boss.hp, boss.maxHp, 'an idle boss beside the target is spared');
  // A lone boss you are fighting takes all three arrows, as before.
  const g2 = setupClass('archer', 50);
  const seen = watch(g2);
  const b2 = dummy(g2, 3, 0, { id: 'chilli_crab', hp: 1e7, boss: true });
  b2.target = g2.player;
  shoot(g2, b2, [], 8);
  assert.ok(b2.hp < b2.maxHp);
  assert.equal(seen.puffs, 0, 'no miss puffs on the boss');
});

test('a spread still costs one arrow', () => {
  const g = setupClass('archer', 20);
  const tgt = dummy(g, 3, 0), a = dummy(g, 4, 0), b = dummy(g, 4, 1);
  let spent = 0; const shots = [];
  const spend = g._spendArrow.bind(g);
  g._spendArrow = (i) => { spent++; return spend(i); };
  const proj = g._projectile.bind(g);
  g._projectile = (n, ...rest) => { shots.push(n); return proj(n, ...rest); };
  g.useAbility = () => false;
  shoot(g, tgt, [a, b], 6);
  // Each projectile flies to its own arrow's foe.
  assert.ok(shots.includes(a) && shots.includes(b) && shots.includes(tgt), 'arrows fly to each foe');
  assert.ok(spent > 0 && spent === Math.ceil(shots.length / SHORTBOW_ARROWS), `${spent} arrows for ${shots.length} shots`);
});

test('the Archer perk text and class description tell of the fanning spread', () => {
  assert.match(classPerks('archer')[0].text, /fan/i);
  assert.match(CLASSES.find((c) => c.id === 'archer').desc, /fan/i);
});
