// The green arrow / "Upgrade" note and Equip best ("Wear it") agree: whatever
// the game calls an upgrade, Wear it puts on, and once it has, nothing in the
// pack is still called one (the owner saw it say an item beat theirs when it didn't).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { xpForLevel } from '../src/data/xp.js';
import { packUpgrades } from '../src/game/whatnext.js';
import { compareGear } from '../src/game/gear.js';

function newGame(cls) {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const s of Object.keys(g.skills.xp)) g.skills.xp[s] = xpForLevel(60);
  return g;
}
// Rings, amulets, capes and the class's own armour pieces at mixed tiers, styles and stats.
const pool = (g) => Object.keys(ITEMS).filter((id) => {
  const eq = ITEMS[id].equip;
  return eq && !ITEMS[id].tool && ['ring', 'amulet', 'cape', 'hands', 'feet'].includes(eq.slot) && g._canEquipNow(id);
});

for (const cls of ['swordsman', 'sniper', 'wizard']) {
  test(`${cls}: every piece called an upgrade is one Wear it puts on`, () => {
    const g = newGame(cls);
    const ids = pool(g);
    assert.ok(ids.length > 10, `${ids.length} pieces to try`);
    for (let k = 0; k < ids.length; k += Math.ceil(ids.length / 24)) g.inventory.add(ids[k], 1);
    for (let round = 0; round < 30; round++) {
      const ups = packUpgrades(g);
      if (!ups.length) break;
      const n = g.equipBest();
      assert.ok(n > 0, `${cls}: ${ups.map((s) => s.id).join(', ')} called upgrades, but Wear it put nothing on`);
    }
    g.equipBest();
    assert.deepEqual(packUpgrades(g).map((s) => s.id), [], 'nothing left called an upgrade');
    for (const s of g.inventory.slots) if (s && ITEMS[s.id].equip) {
      assert.notEqual(compareGear(s.id, g.equipment, null, s.q || null, g.combatMode()).verdict, 'upgrade', `${s.id} still shows the green arrow`);
    }
  });
}
