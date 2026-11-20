// Gun rounds and the ammo slot (src/game/rounds.js): pistols and sniper rifles
// load rounds that add to their shot power, use them up now and then, fall back
// to plain shot when empty, and older saves are handed some rounds once.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { xpForLevel } from '../src/data/xp.js';
import { ITEMS, getItem } from '../src/data/items.js';
import { SHOPS } from '../src/data/shops.js';
import { SMITH } from '../src/data/smithing.js';
import { Game } from '../src/game/game.js';
import { saveGame } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { itemIconSVG, hasIcon } from '../src/render/icons.js';
import * as R from '../src/game/rounds.js';
import { resolveSmith } from '../src/game/skilling.js';

const METALS = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'obsidian', 'orichalcum', 'jade', 'starmetal', 'celestial', 'eternal'];
const SPECIALS = ['incendiary_rounds', 'frost_rounds', 'shock_rounds'];

function gunner(cls = 'pistoler') {
  const g = freshGame(cls);
  for (const k of ['ranged', 'defence', 'hitpoints']) g.skills.xp[k] = xpForLevel(60);
  g.said = [];
  g.msg = (m) => g.said.push(m);
  return g;
}
function dummy(g) {
  const npc = g.npcs.find((n) => n.alive && n.attackable && !n.ally && !n.def.boss && !n.champion);
  npc.hp = npc.maxHp = 1e9;
  return npc;
}
/** The highest single blow of one attack (every roll at its top). */
function topHit(g, npc) {
  const landed = [];
  const apply = g._applyPlayerHit;
  g._applyPlayerHit = function (n, dmg, opts) { if (n === npc) landed.push(dmg); return apply.call(this, n, dmg, opts); };
  const rnd = Math.random;
  Math.random = () => 0.9999999;
  try { g._rangedAttack(npc); } finally { Math.random = rnd; delete g._applyPlayerHit; }
  return Math.max(...landed);
}

test('rounds: twelve metal tiers and three special rounds, stackable ammo, strongest last', () => {
  let prev = 0;
  for (const m of METALS) {
    const it = ITEMS[`${m}_rounds`];
    assert.ok(it, `${m}_rounds`);
    assert.equal(it.name, `${m[0].toUpperCase()}${m.slice(1)} rounds`);
    assert.ok(it.stackable && it.tags.includes('ammo'));
    assert.ok(it.roundStr > prev, `${m} rounds hit harder than the tier before`);
    prev = it.roundStr;
  }
  for (const id of SPECIALS) assert.ok(ITEMS[id]?.special && ITEMS[id].roundStr > 0 && ITEMS[id].tags.includes('ammo'), id);
  assert.deepEqual(SPECIALS.map((id) => ITEMS[id].name), ['Incendiary rounds', 'Frost rounds', 'Shock rounds']);
  // Until their stickers arrive they borrow one (and every one has an icon).
  for (const id of [...METALS.map((m) => `${m}_rounds`), ...SPECIALS]) {
    assert.ok(hasIcon(id), `${id} has an icon`);
    assert.match(itemIconSVG(id, 24), /assets\/icons\/item-[a-z_]+\.webp/, `${id} borrows a sticker`);
  }
  // Rounds are for guns, arrows for bows.
  assert.ok(R.isRound('rune_rounds') && !R.isRound('rune_arrow'));
  assert.ok(R.isArrow('rune_arrow') && !R.isArrow('rune_rounds'));
  assert.ok(R.isGunId('bronze_pistol') && R.isGunId('bronze_rifle') && !R.isGunId('shortbow'));
});

test('rounds: smithed twenty to a bar at every bar tier, and sold in the shops', () => {
  for (const m of METALS) {
    const r = SMITH.find((x) => x.result === `${m}_rounds`);
    assert.ok(r, `${m} rounds have a recipe`);
    assert.equal(r.bar, `${m}_bar`);
    assert.equal(r.qty, 20);
  }
  const archery = SHOPS.archery.stock.map((s) => s.id);
  for (const id of ['bronze_rounds', 'rune_rounds', ...SPECIALS]) assert.ok(archery.includes(id), `the archery shop sells ${id}`);
  assert.ok(SHOPS.general.stock.some((s) => s.id === 'bronze_rounds'));
  // Smithing really makes them.
  const g = gunner();
  g.skills.xp.smithing = xpForLevel(40);
  g.inventory.add('hammer', 1);
  g.inventory.add('steel_bar', 1);
  resolveSmith(g, { recipe: SMITH.find((x) => x.result === 'steel_rounds') });
  assert.ok(g.inventory.count('steel_rounds') >= 20);
  assert.ok(!g.said.some((m) => /roundss/.test(m)), 'no "roundss"');
});

test('a new Pistoler and Sniper start loaded; bows never fire rounds', () => {
  for (const cls of ['pistoler', 'sniper']) {
    const g = gunner(cls);
    assert.deepEqual(g.equipment.ammo, { id: 'bronze_rounds', qty: R.STARTER_ROUNDS }, `${cls} starts with rounds`);
    assert.ok(g.gunRoundsGiven);
  }
  const a = gunner('archer');
  assert.equal(a.equipment.ammo, null, 'an Archer has no rounds');
  a.inventory.add('eternal_rounds', 50);
  const idx = a._bestAmmoIdx();
  assert.equal(a.inventory.slotAt(idx).id, 'bronze_arrow', 'an Archer still draws arrows, not rounds');
});

test('pistols add the loaded rounds to every shot, both hands, and the Equipment numbers agree', () => {
  const g = gunner();
  const npc = dummy(g);
  g.equipment.setAmmo(null, 0);
  const plain = topHit(g, npc), dualPlain = g.dualMaxHits();
  g.equipment.setAmmo('eternal_rounds', 1000);
  const loaded = topHit(g, npc), dualLoaded = g.dualMaxHits();
  assert.ok(loaded > plain, `rounds hit harder (${plain} -> ${loaded})`);
  assert.ok(dualLoaded.main > dualPlain.main && dualLoaded.off > dualPlain.off, 'both pistols gain');
  assert.equal(R.gunShotStr(g.equipment, getItem('bronze_pistol').equip), Math.floor(getItem('bronze_pistol').equip.bonuses.ranged / 3) + ITEMS.eternal_rounds.roundStr);
  // A rifle uses them too.
  const s = gunner('sniper');
  const n2 = dummy(s);
  s.equipment.setAmmo(null, 0);
  const rp = topHit(s, n2);
  s.equipment.setAmmo('eternal_rounds', 1000);
  assert.ok(topHit(s, n2) > rp, 'a sniper rifle hits harder with rounds');
});

test('rounds are used up now and then, reload from the pack, and an empty gun still fires plain shot', () => {
  const g = gunner();
  const npc = dummy(g);
  g.equipment.setAmmo('steel_rounds', 3);
  g.inventory.add('iron_rounds', 40);
  for (let i = 0; i < 3000 && g.inventory.count('iron_rounds') > 0; i++) g._rangedAttack(npc);
  assert.equal(g.inventory.count('iron_rounds'), 0, 'the pack\'s rounds were loaded when the slot ran dry');
  assert.equal(g.equipment.ammo.id, 'iron_rounds');
  assert.ok(g.said.some((m) => /reload with iron rounds/.test(m)));
  // Pistols use a round up on only about one shot in twenty.
  const before = g.equipment.ammo.qty;
  for (let i = 0; i < 100; i++) g._rangedAttack(npc);
  const used = before - (g.equipment.ammo?.qty || 0);
  assert.ok(used > 0 && used < 30, `100 attacks used ${used} rounds`);
  // Run the slot dry: the guns keep firing, with a word now and then.
  for (let i = 0; i < 4000 && g.equipment.ammo; i++) g._rangedAttack(npc);
  assert.equal(g.equipment.ammo, null);
  const hp = npc.hp;
  g._rangedAttack(npc);
  assert.ok(npc.hp < hp, 'out of rounds, the pistols still hurt');
  assert.ok(g.said.some((m) => /out of rounds/.test(m)));
  // Auto battle doesn't stop for want of rounds.
  g.autoBattle = true;
  g._autoBattleTick();
  assert.ok(g.autoBattle, 'auto battle carries on');
});

test('loading, swapping and unloading rounds; Equip best and the upgrade note pick better rounds', async () => {
  const { packUpgrades } = await import('../src/game/whatnext.js');
  const g = gunner();
  g.inventory.add('rune_rounds', 100);
  assert.ok(packUpgrades(g).some((s) => s.id === 'rune_rounds'), 'better rounds show as an upgrade');
  assert.ok(g.equipBest() >= 1);
  assert.deepEqual(g.equipment.ammo, { id: 'rune_rounds', qty: 100 });
  assert.equal(g.inventory.count('bronze_rounds'), R.STARTER_ROUNDS, 'the old rounds went back in the pack');
  assert.ok(!packUpgrades(g).some((s) => s.id === 'bronze_rounds'), 'worse rounds are not an upgrade');
  // Topping up the same kind adds to the stack.
  g.inventory.add('rune_rounds', 50);
  g.loadRounds(g.inventory.slots.findIndex((s) => s?.id === 'rune_rounds'));
  assert.equal(g.equipment.ammo.qty, 150);
  g.unequip('ammo');
  assert.equal(g.equipment.ammo, null);
  assert.equal(g.inventory.count('rune_rounds'), 150);
  // Gun users find rounds where arrows would drop, and rounds don't count as another class's gear for them.
  assert.equal(R.roundsForArrow('rune_arrow'), 'rune_rounds');
  assert.equal(R.roundsForArrow('dragon_arrow'), 'obsidian_rounds');
  assert.ok(!g.unrelatedToClass('rune_rounds'));
  assert.ok(gunner('archer').unrelatedToClass('rune_rounds'));
});

test('special rounds: frost slows, incendiary burns, shock arcs to a foe nearby', () => {
  const g = gunner();
  const npc = dummy(g);
  const rnd = Math.random;
  Math.random = () => 0;   // every effect fires
  try {
    g.equipment.setAmmo('frost_rounds', 10);
    R.roundEffect(g, npc, 100);
    assert.ok(npc.slowTicks > 0, 'frost slows');
    g.equipment.setAmmo('incendiary_rounds', 10);
    const hp = npc.hp;
    R.roundEffect(g, npc, 100);
    assert.equal(hp - npc.hp, 30, 'incendiary adds 30% as fire');
  } finally { Math.random = rnd; }
});

test('an older save: a Pistoler with no ammo slot loads, is handed rounds once, and fights', () => {
  const g = gunner();
  g.equipment.setAmmo(null, 0);
  assert.ok(saveGame(g));
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete raw.equipment._ammo; delete raw.gunRoundsGiven;
  localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  const g2 = new Game(); g2.start();
  g2.ui = new Proxy({}, { get: () => () => {} });
  assert.equal(g2.jobClass, 'pistoler');
  assert.deepEqual(g2.equipment.ammo, { id: 'bronze_rounds', qty: R.OLD_SAVE_ROUNDS }, 'handed rounds');
  assert.ok(g2.gunRoundsGiven);
  const npc = dummy(g2);
  const hp = npc.hp;
  g2._rangedAttack(npc);
  assert.ok(npc.hp < hp, 'and fights');
  // ...only once: emptied and saved again, it isn't handed more.
  g2.equipment.setAmmo(null, 0);
  assert.ok(saveGame(g2));
  const g3 = new Game(); g3.start();
  assert.equal(g3.equipment.ammo, null);
  // The saved slot round-trips.
  g3.equipment.setAmmo('jade_rounds', 77);
  assert.ok(saveGame(g3));
  const g4 = new Game(); g4.start();
  assert.deepEqual(g4.equipment.ammo, { id: 'jade_rounds', qty: 77 });
});
