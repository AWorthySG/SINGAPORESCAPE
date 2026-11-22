// Ascended signature weapons (bossWeapons.js): every class has a signature weapon
// stronger than its plain eternal one, the strongest bosses drop the extra ones,
// and the bosses' first weapons are unchanged.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS } from '../src/data/items.js';
import { CLASSES } from '../src/data/classes.js';
import { ASCENDED, ASCENDED_LEVEL, SIG_BOSSES, SIGNATURE_CLASS, sigDropsFor, sigIdFor } from '../src/data/bossWeapons.js';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { codexEntry } from '../src/game/codex.js';

const FIGHT = ['attack', 'strength', 'ranged', 'magic', 'magicStr', 'dance'];
const power = (it) => FIGHT.reduce((t, k) => t + (it.equip.bonuses[k] || 0), 0);
const eternalOf = (type) => Object.values(ITEMS).filter((it) => it.equip?.weaponType === type && !it.signature && !it.tool && /^eternal_/.test(it.id));

test('every class has a signature weapon stronger than its eternal weapon', () => {
  for (const c of CLASSES) {
    const mine = Object.values(ITEMS).filter((it) => it.signature?.classId === c.id);
    const eternal = eternalOf(c.weapon);
    assert.ok(eternal.length, `${c.name} has an eternal ${c.weapon}`);
    const best = Math.max(...mine.map(power)), top = Math.max(...eternal.map(power));
    assert.ok(best > top * 1.2, `${c.name}: best signature ${best} vs eternal ${top}`);
  }
});

test('ascended weapons: only for classes without one, from bosses of the eternal tier, each boss its own first', () => {
  const served = new Set(SIG_BOSSES.filter((b) => b[1] >= ASCENDED_LEVEL).map(([id]) => SIGNATURE_CLASS[id]));
  assert.equal(served.size + ASCENDED.length, CLASSES.length, 'every class exactly covered');
  for (const a of ASCENDED) {
    assert.ok(!served.has(a.classId));
    assert.ok(SIG_BOSSES.find((b) => b[0] === a.boss)[1] >= ASCENDED_LEVEL);
    const it = ITEMS[a.id];
    assert.equal(it.signature.ascended, true);
    assert.equal(it.signature.classId, a.classId);
    assert.match(it.name, /Ascended/);
    assert.deepEqual(sigDropsFor(a.boss)[0], { id: sigIdFor(a.boss), classId: SIGNATURE_CLASS[a.boss] }, 'the boss\'s own weapon first');
    assert.ok(sigDropsFor(a.boss).some((s) => s.id === a.id));
  }
  // The bosses' first weapons are untouched (names and picks known before).
  assert.equal(ITEMS.sig_jade_dragon.signature.classId, 'wizard');
  assert.ok(!ITEMS.sig_jade_dragon.signature.ascended);
  assert.equal(sigDropsFor('goblin_warchief').length, 1);
});

test('the Sniper\'s ascended rifle drops from its boss, and the Codex lists it', () => {
  const a = ASCENDED.find((x) => x.classId === 'sniper');
  assert.ok(a);
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseClass('sniper');
  g.ui = new Proxy({}, { get: () => () => {} });
  let got = [];
  g._autoLoot = (loot) => { got = loot; };
  const boss = g.npcs.find((n) => n.npcId === a.boss);
  assert.ok(boss, `${a.boss} is in the world`);
  const rnd = Math.random;
  try { Math.random = () => 0.001; g.rollDrops(boss); } finally { Math.random = rnd; }
  assert.ok(got.some((l) => l[0] === a.id), `drops ${a.id} (${got.map((l) => l[0]).join(', ')})`);
  assert.ok(got.some((l) => l[0] === sigIdFor(a.boss)), 'and its own weapon still');
  g.kills = { ...(g.kills || {}), [a.boss]: 1 };
  const e = codexEntry(g, a.boss);
  assert.ok(e.ascended?.some((x) => x.item === a.id && x.className === 'Sniper'), 'the Codex shows the ascended weapon');
});
