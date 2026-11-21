// The player never misses (combat.js rollHit): every attack that swings must
// show a landed number on its target, never the "miss" puff a 0 hitsplat draws.
// The owner saw Swordsmen "miss": a boss's style shield soaked each blow to 0,
// which drew the miss puff on every swing until the shield broke. Boss shields
// are gone now; these fights keep every boss's mechanic running to make sure
// nothing else turns a blow into a 0.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass, CLASS_IDS } from '../tools/balance/classlab.mjs';
import { NPC } from '../src/game/npc.js';
import { startMechanic } from '../src/game/bossmech.js';
import { splatBump } from '../src/render/renderer.js';

/** Count, for every player attack, whether its target showed a number. */
function watch(g) {
  const st = { attacks: 0, landed: 0, puffs: 0 };
  const attack = g.doPlayerAttack.bind(g), splat = g.addHitsplat.bind(g);
  let cur = null;
  g.addHitsplat = (e, dmg, opts = {}) => {
    if (e !== g.player && !opts.text) {
      if (!(dmg > 0) || Math.round(dmg) < 1) st.puffs++;   // a miss puff, or a number that reads 0
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

/** A boss that stands still and never strikes back. */
function stillBoss(g, id, x, y) {
  const b = new NPC(id, x, y, 0, { aggressive: false });
  b.maxHp = b.hp = 1e6;
  b.def = { ...b.def, maxHp: 1e6 };
  b.tick = () => {};
  b.target = g.player;
  return b;
}

test('no class ever misses: bosses mid-mechanic and plain monsters all show landed numbers', () => {
  const rows = [];
  for (const cls of CLASS_IDS) {
    const g = setupClass(cls, 10);
    const st = watch(g);
    const p = g.player;
    // The two bosses that used to raise a style shield (now a safe circle) and
    // a caster, each with its mechanic kept up the whole fight: every blow must
    // still take life off the boss.
    for (const id of ['chilli_crab', 'durian_behemoth', 'reservoir_serpent']) {
      const b = stillBoss(g, id, p.x + 2, p.y);
      g.npcs = [b];
      g.player.clearAction(); g.attackNpc(b);
      for (let i = 0; i < 25; i++) {
        if (!b.mech) startMechanic(g, b);   // keep its mechanic going for the whole fight
        p.hp = g.maxHp();
        g.update(600);
      }
      st.bossHurt = (st.bossHurt || 0) + (b.hp < 1e6 ? 1 : 0);
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
  // Nothing soaked the blows: every class wore down every boss.
  assert.ok(rows.every((r) => r.bossHurt === 3), 'every class hurt every boss');
});

test('a blow on a boss mid-mechanic lands in full and shows its own number', () => {
  const g = setupClass('swordsman', 10);
  const b = stillBoss(g, 'durian_behemoth', g.player.x + 1, g.player.y);   // its style shield once soaked a sword's blows
  g.npcs = [b];
  startMechanic(g, b);
  g.effects = [];
  g._applyPlayerHit(b, 12);
  assert.equal(b.hp, 1e6 - 12, 'the boss took it all');
  const s = g.effects.find((e) => e.type === 'hitsplat' && e.entity === b && !e.text);
  assert.ok(s && s.dmg === 12 && !('shield' in s), 'a plain 12, no shield tag');
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
