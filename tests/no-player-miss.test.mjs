// The player never misses (combat.js rollHit): every attack that swings must
// show a landed number on its target, never the "miss" puff a 0 hitsplat draws.
// The owner saw Swordsmen "miss": a boss's style shield soaked each blow to 0,
// which drew the miss puff on every swing until the shield broke.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass, CLASS_IDS } from '../tools/balance/classlab.mjs';
import { NPC } from '../src/game/npc.js';
import { startMechanic } from '../src/game/bossmech.js';
import { splatBump } from '../src/render/renderer.js';

/** Count, for every player attack, whether its target showed a number. */
function watch(g) {
  const st = { attacks: 0, landed: 0, puffs: 0, shieldTagged: 0 };
  const attack = g.doPlayerAttack.bind(g), splat = g.addHitsplat.bind(g);
  let cur = null;
  g.addHitsplat = (e, dmg, opts = {}) => {
    if (e !== g.player && !opts.text) {
      if (!(dmg > 0) || Math.round(dmg) < 1) st.puffs++;   // a miss puff, or a number that reads 0
      if (opts.shield) st.shieldTagged++;
      if (cur && e === cur && dmg >= 1) cur.got = true;
    }
    return splat(e, dmg, opts);
  };
  g.doPlayerAttack = (npc) => {
    if (cur) return attack(npc);
    cur = npc; cur.got = false;
    try { return attack(npc); } finally { st.attacks++; if (cur.got) st.landed++; cur = null; }
  };
  return st;
}

/** A boss that stands still and never strikes back, holding a style shield. */
function shieldedBoss(g, id, x, y) {
  const b = new NPC(id, x, y, 0, { aggressive: false });
  b.maxHp = b.hp = 1e6;
  b.def = { ...b.def, maxHp: 1e6 };
  b.tick = () => {};
  b.target = g.player;
  return b;
}

test('no class ever misses: shielded bosses and plain monsters all show landed numbers', () => {
  const rows = [];
  for (const cls of CLASS_IDS) {
    const g = setupClass(cls, 10);
    const st = watch(g);
    const p = g.player;
    // A melee shield and a ranged one, so every class meets the wrong style
    // (a shield only it can't break quickly) as well as, for some, its own.
    for (const id of ['chilli_crab', 'durian_behemoth']) {
      const b = shieldedBoss(g, id, p.x + 2, p.y);
      g.npcs = [b];
      g.player.clearAction(); g.attackNpc(b);
      for (let i = 0; i < 25; i++) {
        if (!b.mech) startMechanic(g, b);   // keep the shield up for the whole fight
        p.hp = g.maxHp();
        g.update(600);
      }
    }
    // A plain monster that fights back and moves.
    const m = new NPC('goblin', p.x + 2, p.y, 0);
    m.maxHp = m.hp = 1e5; m.target = p;
    g.npcs = [m];
    g.player.clearAction(); g.attackNpc(m);
    for (let i = 0; i < 20; i++) { p.hp = g.maxHp(); g.update(600); }
    rows.push({ cls, ...st });
  }
  for (const r of rows) {
    assert.ok(r.attacks >= 10, `${r.cls} attacked (${r.attacks})`);
    assert.equal(r.landed, r.attacks, `${r.cls}: every attack lands a number (${r.landed}/${r.attacks})`);
    assert.equal(r.puffs, 0, `${r.cls}: no miss puffs or 0s`);
  }
  // The shields really were up: the blows they soaked show as shield-tagged numbers.
  assert.ok(rows.every((r) => r.shieldTagged > 0), 'every class hit a shield');
});

test('a blow soaked by a style shield shows its number in the shield colour', () => {
  const g = setupClass('swordsman', 10);
  const b = shieldedBoss(g, 'durian_behemoth', g.player.x + 1, g.player.y);   // a ranged shield: wrong for a sword
  g.npcs = [b];
  startMechanic(g, b);
  g.effects = [];
  g._applyPlayerHit(b, 12);
  assert.equal(b.hp, 1e6, 'the shield took it');
  const s = g.effects.find((e) => e.type === 'hitsplat' && e.entity === b && !e.text);
  assert.ok(s && s.dmg === 12 && s.shield && s.tint, 'a tinted, tagged 12, not a miss puff');
});

test('a blow folded into a number already up makes it pop again', () => {
  const g = setupClass('swordsman', 10);
  const n = new NPC('goblin', g.player.x + 1, g.player.y, 0);
  n.maxHp = n.hp = 1e5;
  g.effects = [];
  g.addHitsplat(n, 5);
  g.addHitsplat(n, 6);   // within the merge window: one number
  const splats = g.effects.filter((e) => e.type === 'hitsplat' && e.entity === n);
  assert.equal(splats.length, 1);
  assert.equal(splats[0].dmg, 11);
  assert.equal(splats[0].bumps, 1, 'the second blow is counted');
  const e = { _bumpAt: 1000 };
  assert.ok(splatBump(e, 1080) > 1.2 && splatBump(e, 2000) === 1 && splatBump({}, 5) === 1);
});
