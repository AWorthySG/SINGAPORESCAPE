// The shortbow's fanning spread (the owner: give the shortbow Archer some area
// damage, the stronger version). The target takes the whole spread of three
// arrows exactly as before; each spread also flings an extra arrow into each of
// up to SHORTBOW_FAN_FOES other foes within SHORTBOW_FAN_TILES of the target, at
// SHORTBOW_FAN_SHARE of a full arrow. A lone target's (and a boss's) damage is
// unchanged; only a crowd around it adds damage.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass } from '../tools/balance/classlab.mjs';
import { NPC } from '../src/game/npc.js';
import { SHORTBOW_ARROWS, SHORTBOW_ARROW_DMG, SHORTBOW_FAN_TILES, SHORTBOW_FAN_FOES, SHORTBOW_FAN_SHARE } from '../src/game/game.js';
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

/** The Archer shoots `target` (with `others` about) for `ticks` ticks. */
function shoot(g, target, others, ticks = 10) {
  g.npcs = [target, ...others];
  g.player.clearAction(); g.attackNpc(target);
  for (let i = 0; i < ticks; i++) { g.player.hp = g.maxHp(); g.update(600); }
}

const lcg = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

/** Run `fn` with the same dice every time. The fanned arrows roll from dice of
 *  their own, so the target's rolls match a run with no one beside it. */
function sameDice(fn) {
  const save = Math.random; Math.random = lcg(11);
  try {
    return fn((g) => {
      const fanDice = lcg(5), orig = g._fanArrows.bind(g);
      g._fanArrows = (...a) => { const r = Math.random; Math.random = fanDice; try { return orig(...a); } finally { Math.random = r; } };
      g.spawnHitSparks = () => {};
    });
  } finally { Math.random = save; }
}

test('each spread flings one extra arrow into each of two foes beside the target', () => {
  assert.equal(SHORTBOW_ARROWS, 3);
  assert.equal(SHORTBOW_FAN_TILES, 2);
  assert.equal(SHORTBOW_FAN_FOES, 2);
  const g = setupClass('archer', 20);
  const seen = watch(g);
  const tgt = dummy(g, 3, 0), a = dummy(g, 4, 0), b = dummy(g, 4, 1), c = dummy(g, 5, 1), far = dummy(g, 6, 0);
  shoot(g, tgt, [a, b, c, far]);
  const n = seen.splats.get(tgt) || 0;
  assert.ok(n > 0 && n % SHORTBOW_ARROWS === 0, 'the target took whole spreads');
  assert.equal(seen.splats.get(a), n / SHORTBOW_ARROWS, 'the nearest neighbour took one extra arrow a spread');
  assert.equal(seen.splats.get(b), n / SHORTBOW_ARROWS, 'so did the next one');
  assert.equal(c.hp, c.maxHp, 'only the two nearest are fanned into');
  assert.equal(far.hp, far.maxHp, 'a foe 3 tiles from the target is out of the fan');
  // An extra arrow is SHORTBOW_FAN_SHARE of a full arrow; the target takes a
  // whole spread (three arrows at SHORTBOW_ARROW_DMG each) per extra arrow.
  const want = SHORTBOW_FAN_SHARE / (SHORTBOW_ARROWS * SHORTBOW_ARROW_DMG);
  for (const o of [a, b]) {
    const share = (o.maxHp - o.hp) / (tgt.maxHp - tgt.hp);
    assert.ok(share > want * 0.5 && share < want * 1.8, `a neighbour took ${share.toFixed(2)} of the target's damage (want ~${want.toFixed(2)})`);
  }
  assert.equal(seen.puffs, 0, 'no miss puffs or 0s');
});

test('the target takes exactly the same damage, crowd or not; the total rises only with neighbours', () => {
  const run = (layout) => sameDice((prep) => {
    const g = setupClass('archer', 30);
    prep(g);
    const tgt = dummy(g, 3, 0);
    const near = [dummy(g, 4, 0), dummy(g, 4, 1)], far = [dummy(g, 3, 6), dummy(g, 4, 6)];   // made either way: making one rolls dice
    shoot(g, tgt, layout === 'near' ? near : layout === 'far' ? far : []);
    const others = [...near, ...far].reduce((s, o) => s + o.maxHp - o.hp, 0);
    return { tgt: tgt.maxHp - tgt.hp, others };
  });
  const alone = run('alone'), farCrowd = run('far'), nearCrowd = run('near');
  assert.ok(alone.tgt > 0);
  assert.equal(farCrowd.tgt, alone.tgt, 'foes out of the fan change nothing');
  assert.equal(farCrowd.others, 0);
  assert.equal(nearCrowd.tgt, alone.tgt, 'the target takes all three arrows as before');
  assert.ok(nearCrowd.others > 0, 'the neighbours add damage on top');
});

test('a boss takes the same with or without foes around it; an idle boss is never fanned into', () => {
  const run = (crowd) => sameDice((prep) => {
    const g = setupClass('archer', 50);
    prep(g);
    const seen = watch(g);
    const boss = dummy(g, 3, 0, { id: 'chilli_crab', hp: 1e7, boss: true });
    boss.target = g.player;
    const row = [dummy(g, 4, 0), dummy(g, 3, 1)];
    shoot(g, boss, crowd ? row : [], 8);
    return { boss: boss.maxHp - boss.hp, row: row.map((o) => o.maxHp - o.hp), puffs: seen.puffs };
  });
  const alone = run(false), crowd = run(true);
  assert.ok(alone.boss > 0);
  assert.equal(crowd.boss, alone.boss, 'single-target boss damage unchanged');
  assert.ok(crowd.row.every((d) => d > 0), 'the monsters beside it took the extra arrows');
  assert.equal(crowd.puffs, 0, 'no miss puffs');
  const g = setupClass('archer', 50);
  const tgt = dummy(g, 3, 0), idle = dummy(g, 4, 0, { id: 'chilli_crab', hp: 1e7, boss: true });
  shoot(g, tgt, [idle], 8);
  assert.ok(tgt.hp < tgt.maxHp);
  assert.equal(idle.hp, idle.maxHp, 'an idle boss beside the target is spared');
});

test('a spread still costs one arrow, and each fanned arrow flies to its own foe', () => {
  const g = setupClass('archer', 20);
  const tgt = dummy(g, 3, 0), a = dummy(g, 4, 0), b = dummy(g, 4, 1);
  let spent = 0; const shots = [];
  const spend = g._spendArrow.bind(g);
  g._spendArrow = (i) => { spent++; return spend(i); };
  const proj = g._projectile.bind(g);
  g._projectile = (n, ...rest) => { shots.push(n); return proj(n, ...rest); };
  shoot(g, tgt, [a, b], 6);
  const atTgt = shots.filter((n) => n === tgt).length;
  assert.ok(atTgt > 0 && shots.includes(a) && shots.includes(b), 'arrows fly to each foe');
  assert.equal(spent, atTgt / SHORTBOW_ARROWS, `${spent} arrows for ${atTgt / SHORTBOW_ARROWS} spreads`);
});

test('the Archer perk text and class description tell of the fanned arrows', () => {
  assert.match(classPerks('archer')[0].text, /extra arrow/i);
  assert.match(CLASSES.find((c) => c.id === 'archer').desc, /extra arrow/i);
});
