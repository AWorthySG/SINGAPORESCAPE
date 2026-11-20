// Piercing longbow arrows (the owner: "Find some way to give longbows some form
// of AoE in the early game"). Each arrow carries on through its target into the
// monsters lined up behind it (within 1 tile of the line, up to 3 tiles past),
// each taking LONGBOW_PIERCE_SHARE of the shot: 1 extra foe from the start, 2
// from Ranged 40, 3 from Ranged 70. Only other monsters are hit, so a lone
// target's (and a boss's) damage is unchanged.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass } from '../tools/balance/classlab.mjs';
import { NPC } from '../src/game/npc.js';
import { LONGBOW_PIERCE_SHARE, LONGBOW_PIERCE_LEVELS, longbowPierceFoes } from '../src/game/game.js';
import { classPerks } from '../src/game/classperks.js';

/** A monster that stands still and never hits back, with plenty of life. */
function dummy(g, dx, dy, { id = 'goblin', hp = 1e5, boss = false } = {}) {
  const n = new NPC(id, g.player.x + dx, g.player.y + dy, 0, { aggressive: false });
  n.def = { ...n.def, maxHp: hp, ...(boss ? { boss: true } : {}) };
  n.maxHp = n.hp = hp;
  n.tick = () => {};
  return n;
}

/** A Ranger at `lvl` shooting `target` (alone in g.npcs with `others`) for `ticks`. */
function shoot(g, target, others, ticks = 12) {
  g.npcs = [target, ...others];
  g.player.clearAction(); g.attackNpc(target);
  for (let i = 0; i < ticks; i++) { g.player.hp = g.maxHp(); g.update(600); }
}

test('the extra-foe count grows with Ranged: 1 from the start, 2 at 40, 3 at 70', () => {
  assert.deepEqual(LONGBOW_PIERCE_LEVELS, [1, 40, 70]);
  assert.equal(longbowPierceFoes(1), 1);
  assert.equal(longbowPierceFoes(39), 1);
  assert.equal(longbowPierceFoes(40), 2);
  assert.equal(longbowPierceFoes(70), 3);
  assert.equal(longbowPierceFoes(99), 3);
});

test('a longbow arrow pierces the monster behind its target, not one off to the side', () => {
  const g = setupClass('ranger', 5);
  const tgt = dummy(g, 4, 0), behind = dummy(g, 6, 0), side = dummy(g, 4, 2), far = dummy(g, 9, 0);
  shoot(g, tgt, [behind, side, far]);
  assert.ok(tgt.hp < tgt.maxHp, 'the target was shot');
  assert.ok(behind.hp < behind.maxHp, 'the monster lined up behind took the pierce');
  assert.equal(side.hp, side.maxHp, 'a monster beside the line is untouched');
  assert.equal(far.hp, far.maxHp, 'more than 3 tiles past the target is out of reach');
  // About the share of the shot, each pierce at least 1.
  const share = (behind.maxHp - behind.hp) / (tgt.maxHp - tgt.hp);
  assert.ok(share > LONGBOW_PIERCE_SHARE * 0.4 && share < LONGBOW_PIERCE_SHARE * 2, `pierced ${share.toFixed(2)} of the target's damage`);
});

test('a new Ranger pierces one foe; a Ranged 70 Ranger pierces three', () => {
  for (const [lvl, want] of [[1, 1], [40, 2], [70, 3]]) {
    const g = setupClass('ranger', lvl);
    const tgt = dummy(g, 3, 0);
    const row = [dummy(g, 4, 0), dummy(g, 5, 1), dummy(g, 5, 0), dummy(g, 6, 0)];
    shoot(g, tgt, row, 3);
    const hit = row.filter((n) => n.hp < n.maxHp).length;
    assert.equal(hit, want, `Ranged ${lvl}: ${hit} pierced`);
    // Nearest first: the one right behind the target is always among them.
    assert.ok(row[0].hp < row[0].maxHp, `Ranged ${lvl}: the nearest one is hit`);
  }
});

test('pierced hits land at least 1, show no miss puff, and earn Ranged XP', () => {
  const g = setupClass('ranger', 1);
  let puffs = 0, pierced = 0;
  const splat = g.addHitsplat.bind(g);
  g.addHitsplat = (e, dmg, opts = {}) => {
    if (e !== g.player && !opts.text) { if (!(dmg >= 1)) puffs++; if (opts.aoe) pierced++; }
    return splat(e, dmg, opts);
  };
  // A monster with huge real-life scale: its share is a tiny number, still at least 1.
  const tgt = dummy(g, 3, 0), big = dummy(g, 4, 0);
  big.def = { ...big.def, hpScale: 1000 };
  const xp0 = g.skills.xp?.ranged ?? null;
  const add = g.skills.addXp.bind(g.skills); let gained = 0;
  g.skills.addXp = (s, x) => { if (s === 'ranged') gained += x; return add(s, x); };
  g.xpRate = undefined;
  shoot(g, tgt, [big], 10);
  assert.ok(pierced > 0, 'the arrows pierced');
  assert.equal(puffs, 0, 'no miss puffs or 0s');
  assert.ok(big.maxHp - big.hp >= pierced, 'each pierce took at least 1 life');
  assert.ok(gained > 0 || xp0 === null, 'Ranged XP earned');
});

test('a boss takes the same damage with or without monsters behind it; an idle boss behind is spared', () => {
  // Two monsters stand in line behind the boss, or (same crowd, same dice) off to
  // the side of the shot, where no arrow reaches them.
  const run = (lined) => {
    const save = Math.random; let s = 7;
    Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };   // the same dice both runs
    try {
      const g = setupClass('ranger', 50);
      const boss = dummy(g, 3, 0, { id: 'chilli_crab', hp: 1e7, boss: true });
      boss.target = g.player;
      const row = lined ? [dummy(g, 4, 0), dummy(g, 5, 0)] : [dummy(g, 3, 5), dummy(g, 4, 5)];
      // The pierce's own crit rolls and sparks would shift the shared dice: take them out.
      g._aoeCrit = (dmg) => ({ dmg, critX: 0 });
      g.spawnHitSparks = () => {};
      shoot(g, boss, row, 15);
      return { boss: boss.maxHp - boss.hp, row: row.map((n) => n.maxHp - n.hp) };
    } finally { Math.random = save; }
  };
  const alone = run(false), lined = run(true);
  assert.ok(alone.boss > 0);
  assert.equal(lined.boss, alone.boss, 'single-target boss damage unchanged');
  assert.ok(lined.row.every((d) => d > 0), 'the monsters behind took the pierce');
  assert.ok(alone.row.every((d) => d === 0), 'the ones off to the side did not');
  // A boss standing behind a monster, not fighting you, is never dragged in.
  const g = setupClass('ranger', 50);
  const tgt = dummy(g, 3, 0), boss = dummy(g, 4, 0, { id: 'chilli_crab', hp: 1e7, boss: true });
  shoot(g, tgt, [boss], 8);
  assert.equal(boss.hp, boss.maxHp, 'an idle boss behind the target is spared');
});

test('the Ranger perk text tells of the pierce', () => {
  const sig = classPerks('ranger')[0].text;
  assert.match(sig, /pierces/);
  assert.match(sig, new RegExp(`${Math.round(LONGBOW_PIERCE_SHARE * 100)}%`));
});
