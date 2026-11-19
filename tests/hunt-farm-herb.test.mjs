// Endgame Hunter, Farming and Herblore (levels 100-300): six new hunting
// grounds and their catches, six new crops whose seeds the farm shop sells
// (with more patches in Gardens by the Bay and the Shadow Rift), and six
// brews made from a crop, a catch and an ash, whose boosts feed the real
// combat code (and the phoenix elixir saves you once from death).
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { NPCS } from '../src/data/npcs.js';
import { HUNT, CROPS, POTIONS, cropFor } from '../src/data/trades.js';
import { SHOPS } from '../src/data/shops.js';
import { xpForLevel, pastCapXpMult } from '../src/data/xp.js';
import { XP_RATE, LIFE_XP_BOOST } from '../src/config.js';
import { chebyshev } from '../src/core/utils.js';
import { findPath } from '../src/engine/pathfinding.js';
import { guideEntries } from '../src/game/skillguide.js';
import { materialKind } from '../src/game/materials.js';
import { itemIconSVG } from '../src/render/icons.js';
import { worldArt } from '../src/render/sprites.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];   // nothing to interrupt the work
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
const step = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };
const night = (g) => { g.playMs = 0; };   // midnight
const noon = (g) => { g.playMs = 0.5 * 10 * 60 * 1000; };   // high noon
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
function listen(g) {
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (m, c) => { said.push(m); return msg(m, c); };
  return said;
}
const inZone = (g, o, name) => {
  const z = g.world.zones.find((zz) => zz.name === name);
  return o.x >= z.x0 && o.x <= z.x1 && o.y >= z.y0 && o.y <= z.y1;
};
const reachable = (g, objs) => {
  const mrt = g.world.objects.filter((o) => o.objId === 'mrt_station')
    .reduce((a, b) => (chebyshev(b.x, b.y, objs[0].x, objs[0].y) < chebyshev(a.x, a.y, objs[0].x, objs[0].y) ? b : a));
  const from = [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 2]].map(([dx, dy]) => ({ x: mrt.x + dx, y: mrt.y + dy })).find((p) => !g.world.isBlocked(p.x, p.y));
  // (Pulau Hantu's nearest station is across the channel: a long walk round, hence the big search.)
  return objs.every((o) => findPath(g.pathCfg(), from, { x: o.x, y: o.y }, { reachAdjacent: true, maxNodes: 200000 }).length > 0);
};

// Tier: hunting ground, catch, region; crop; brew and the ash it takes.
const TIERS = [
  { lvl: 100, trap: 'pangolin_burrow', catch: 'pangolin_scales', zone: 'Pulau Ubin', crop: 'torch_ginger', brew: 'super_might_potion', ash: 'fine_ash' },
  { lvl: 130, trap: 'colugo_trap', catch: 'colugo_fur', zone: 'Mandai Rainforest', crop: 'black_nutmeg', brew: 'super_haste_potion', ash: 'fine_ash' },
  { lvl: 160, trap: 'tiger_trail', catch: 'tiger_whisker', zone: 'Mandai Rainforest', crop: 'golden_durian', brew: 'tigers_focus', ash: 'ember_ash' },
  { lvl: 200, trap: 'garuda_nest', catch: 'garuda_plume', zone: 'The Celestial Peaks', crop: 'starbloom', brew: 'garuda_draught', ash: 'star_ash' },
  { lvl: 250, trap: 'naga_track', catch: 'naga_scale', zone: 'Pulau Hantu', crop: 'moon_orchid', brew: 'naga_elixir', ash: 'ghost_ash' },
  { lvl: 300, trap: 'phoenix_roost', catch: 'phoenix_ember', zone: 'The Shadow Rift', crop: 'eternal_lotus', brew: 'phoenix_elixir', ash: 'eternal_ash' },
];
const OLD_TRAPS = Object.keys(HUNT).filter((id) => HUNT[id].level < 100 || ['hornbill_nest', 'qilin_trail'].includes(id));

test('endgame hunting grounds: five traps each in their region, reachable, clear of the older traps', () => {
  const g = newGame();
  for (const t of TIERS) {
    const def = OBJECTS[t.trap];
    assert.equal(def.type, 'hunt'); assert.equal(def.level, t.lvl); assert.equal(def.gives[0].id, t.catch);
    assert.ok(ITEMS[t.catch], `${t.catch} exists`);
    const traps = g.world.objects.filter((o) => o.objId === t.trap);
    assert.equal(traps.length, 5, `${t.trap}: ${traps.length} placed`);
    for (const o of traps) assert.ok(inZone(g, o, t.zone), `${t.trap} at ${o.x},${o.y} is in ${t.zone}`);
    assert.ok(traps.every((o) => chebyshev(o.x, o.y, traps[0].x, traps[0].y) <= 8), `${t.trap}s lie together`);
    assert.ok(reachable(g, traps), `${t.trap}s can be walked to`);
    // Auto gather looks 30 tiles round for the next trap: keep the older kinds out of reach.
    const old = g.world.objects.filter((o) => OLD_TRAPS.includes(o.objId));
    for (const o of traps) assert.ok(old.every((p) => chebyshev(o.x, o.y, p.x, p.y) > 30), `${t.trap} at ${o.x},${o.y} is clear of older traps`);
    // Its own picture, untinted.
    assert.ok(worldArt().has(`obj-${t.trap}`) && !def.art && !def.tint, `${t.trap} has its own trap picture`);
  }
});

test('endgame traps: worked at their level for their catch, refused below it', () => {
  const g = newGame();
  if (!g.inventory.has('hunting_snare')) g.inventory.add('hunting_snare', 1);
  const said = listen(g);
  for (const t of TIERS) {
    const trap = g.world.objects.find((o) => o.objId === t.trap);
    standBy(g, trap); noon(g);
    setLevel(g, 'hunter', t.lvl - 1);
    g.defaultObjectAction(trap); step(g, 4);
    assert.equal(g.inventory.count(t.catch), 0, `no ${t.catch} below Hunter ${t.lvl}`);
    assert.ok(said.some((m) => m.includes(`Hunter level of ${t.lvl}`)), 'told the level it needs');
    setLevel(g, 'hunter', t.lvl);
    const xp0 = g.skills.xp.hunter;
    trap.depleted = false;
    g.defaultObjectAction(trap); step(g, 4);
    assert.ok(g.inventory.count(t.catch) >= 1, `caught ${t.catch}`);
    assert.ok(g.skills.xp.hunter > xp0, 'for Hunter XP');
    assert.equal(materialKind(t.catch), 'hide', `${t.catch} is a shrine material`);
    g.player.clearAction();
    g.inventory.remove(t.catch, g.inventory.count(t.catch));
  }
  assert.ok(guideEntries('hunter').some((e) => e.objIds?.includes('tiger_trail') && e.detail.includes('night')), 'the guide mentions the night bonus');
});

test('the tiger trail pays 25% more Hunter XP at night, and works by day too', () => {
  const g = newGame();
  if (!g.inventory.has('hunting_snare')) g.inventory.add('hunting_snare', 1);
  setLevel(g, 'hunter', 160);
  const trap = g.world.objects.find((o) => o.objId === 'tiger_trail');
  const one = (when) => {
    trap.depleted = false; g.player.clearAction();
    standBy(g, trap); when(g);
    const xp0 = g.skills.xp.hunter, n0 = g.inventory.count('tiger_whisker');
    g.defaultObjectAction(trap);
    for (let i = 0; i < 10 && g.inventory.count('tiger_whisker') === n0; i++) { when(g); step(g, 1); }
    assert.equal(g.inventory.count('tiger_whisker'), n0 + 1);
    return g.skills.xp.hunter - xp0;
  };
  const day = one(noon), dark = one(night);
  assert.ok(day > 0);
  assert.ok(Math.abs(dark / day - 1.25) < 0.01, `night ${dark} vs day ${day}`);
});

test('endgame Hunter XP an hour: each tier well ahead of the best before it, at the same level', () => {
  // A trap runs dry at random and a ground can sit empty for a while, so these
  // runs are long and the bar leaves room for the dice (over long runs each
  // step is ~1.35x).
  const TICKS = 3000;
  const rate = (trapId, lvl) => {
    const g = newGame();
    if (!g.inventory.has('hunting_snare')) g.inventory.add('hunting_snare', 1);
    setLevel(g, 'hunter', lvl); noon(g);
    const all = g.world.objects.filter((o) => o.objId === trapId);
    const near = (o) => all.filter((p) => chebyshev(p.x, p.y, o.x, o.y) <= 15).length;
    const start = all.reduce((a, b) => (near(b) > near(a) ? b : a));
    standBy(g, start);
    g.toggleAutoGather(true);
    g.defaultObjectAction(start);
    const base = g.skills.xp.hunter;
    let gain = 0;
    for (let i = 0; i < TICKS; i++) {
      g.update(600); noon(g);
      gain += g.skills.xp.hunter - base; g.skills.xp.hunter = base;
      // An endless bag, so the run never stops for space.
      for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s && s.id !== 'hunting_snare') g.inventory.removeAt(k, s.qty); }
    }
    return gain * 6000 / TICKS;
  };
  // The best before each tier: the tier below, or an older trap with a higher level.
  const before = { 100: ['crocodile_trap'], 130: ['pangolin_burrow', 'hornbill_nest'], 160: ['colugo_trap'], 200: ['tiger_trail', 'qilin_trail'], 250: ['garuda_nest'], 300: ['naga_track'] };
  for (const t of TIERS) {
    const prev = Math.max(...before[t.lvl].map((id) => rate(id, t.lvl))), now = rate(t.trap, t.lvl);
    assert.ok(now >= prev * 1.15, `${t.trap}: ${Math.round(now)} xp/h vs ${Math.round(prev)} before, at level ${t.lvl}`);
  }
});

// What a patch earns a tick from a crop at a Farming level: planting plus the
// average harvest (with the green-fingers extra crop) over its growing time.
const patchRate = (c, lvl) => {
  const f = cropFor(c[0]);
  const y = (f.yield[0] + f.yield[1]) / 2 + Math.min(0.5, (lvl - f.level) / 100);
  return (f.plantXp + f.harvestXp * y) / f.grow;
};

test('endgame crops: in level order, ~35% more XP a patch an hour than any crop before', () => {
  for (let i = 1; i < CROPS.length; i++) assert.ok(CROPS[i][2] >= CROPS[i - 1][2], 'CROPS stays in level order (monster seed drops rely on it)');
  for (const t of TIERS) {
    const c = CROPS.find((x) => x[0] === t.crop);
    assert.equal(c[2], t.lvl);
    const prev = Math.max(...CROPS.filter((x) => x[2] < t.lvl).map((x) => patchRate(x, t.lvl)));
    const now = patchRate(c, t.lvl);
    assert.ok(now >= prev * 1.33, `${t.crop}: ${now.toFixed(2)} xp a patch-tick vs ${prev.toFixed(2)} before`);
    assert.ok(ITEMS[t.crop] && ITEMS[`${t.crop}_seed`], `${t.crop} and its seed exist`);
    assert.equal(materialKind(t.crop), 'herb');
    assert.ok(guideEntries('farming').some((e) => e.level === t.lvl && e.label === c[1]));
  }
});

test('the farm shop sells every endgame seed, dearer each tier, and you can buy them', () => {
  const stock = SHOPS.farming.stock.map((s) => s.id);
  let prev = 0;
  for (const t of TIERS) {
    const seed = `${t.crop}_seed`;
    assert.ok(stock.includes(seed), `${seed} is sold`);
    assert.ok(ITEMS[seed].value > prev, `${seed} costs more than the tier before`);
    prev = ITEMS[seed].value;
  }
  const g = newGame();
  g.inventory.add('coins', 100000);
  g.buyItem('farming', 'eternal_lotus_seed', 3);
  assert.equal(g.inventory.count('eternal_lotus_seed'), 3);
});

test('more farm patches: eight in Gardens by the Bay and four by the Shadow Rift pool, all reachable', () => {
  const g = newGame();
  const patches = g.world.objects.filter((o) => o.objId === 'farm_patch');
  const gardens = patches.filter((o) => inZone(g, o, 'Gardens by the Bay'));
  const rift = patches.filter((o) => inZone(g, o, 'The Shadow Rift'));
  assert.equal(gardens.length, 8);
  assert.equal(rift.length, 4);
  assert.ok(patches.length >= 36, `${patches.length} patches in all`);
  assert.ok(reachable(g, gardens) && reachable(g, rift));
});

test('endgame crops: planted at their level, refused below it, and harvested for XP', () => {
  const g = newGame();
  const said = listen(g);
  const patch = g.world.objects.find((o) => o.objId === 'farm_patch' && inZone(g, o, 'Gardens by the Bay'));
  standBy(g, patch);
  for (const t of TIERS) {
    const seed = `${t.crop}_seed`;
    g.inventory.add(seed, 1);
    setLevel(g, 'farming', t.lvl - 1);
    assert.equal(g.plantSeed(patch, seed), false);
    assert.ok(said.some((m) => m.includes(`Farming level of ${t.lvl}`)));
    setLevel(g, 'farming', t.lvl);
    assert.equal(g.plantSeed(patch, seed), true);
    patch.growLeft = 0;   // skip the wait
    const xp0 = g.skills.xp.farming;
    assert.ok(g.harvestPatch(patch));
    assert.ok(g.inventory.count(t.crop) >= 1, `harvested ${t.crop}`);
    assert.ok(g.skills.xp.farming > xp0);
    g.inventory.remove(t.crop, g.inventory.count(t.crop));
    g.inventory.remove(seed, g.inventory.count(seed));
  }
});

test('endgame brews: a crop, a catch and an ash, brewed at their level for ~35% more XP than the best before', () => {
  const g = newGame();
  const table = g.world.objects.find((o) => o.def.type === 'herblore');
  standBy(g, table);
  const said = listen(g);
  for (const t of TIERS) {
    const p = POTIONS[t.brew];
    assert.deepEqual(p.inputs.map(([id]) => id).sort(), [t.crop, t.catch, t.ash].sort(), `${t.brew} takes ${t.crop}, ${t.catch} and ${t.ash}`);
    assert.equal(p.level, t.lvl);
    assert.ok(p.ms >= 5 * 60000 && p.ms <= 10 * 60000, 'lasts as long as the older brews');
    const prev = Math.max(...Object.values(POTIONS).filter((x) => x.level < t.lvl).map((x) => x.xp));
    assert.ok(p.xp >= prev * 1.34, `${t.brew}: ${p.xp} xp a brew vs ${prev} before`);
    const recipe = { result: t.brew, qty: 1, inputs: p.inputs, level: p.level, xp: p.xp };
    for (const [id, n] of p.inputs) g.inventory.add(id, n);
    setLevel(g, 'herblore', t.lvl - 1);
    g.startRecipe('herblore', recipe, table); step(g, 2);
    assert.equal(g.inventory.count(t.brew), 0, `no ${t.brew} below Herblore ${t.lvl}`);
    assert.ok(said.some((m) => m.includes(`Herblore level of ${t.lvl}`)));
    setLevel(g, 'herblore', t.lvl);
    const xp0 = g.skills.xp.herblore;
    g.startRecipe('herblore', recipe, table); step(g, 3);
    assert.equal(g.inventory.count(t.brew), 1, `brewed ${t.brew}`);
    assert.ok(Math.abs(g.skills.xp.herblore - xp0 - p.xp * XP_RATE * LIFE_XP_BOOST * pastCapXpMult(t.lvl)) < 1, 'for its XP');
    for (const [id] of p.inputs) assert.equal(g.inventory.count(id), 0, `using up the ${id}`);
    g.inventory.remove(t.brew, 1);
    assert.ok(guideEntries('herblore').some((e) => e.label === p.name && e.level === t.lvl));
  }
});

test('endgame brews change the real combat numbers', () => {
  const g = newGame();
  setLevel(g, 'attack', 300); setLevel(g, 'strength', 300); setLevel(g, 'hitpoints', 300);
  const bossId = Object.keys(NPCS).find((id) => NPCS[id].boss && NPCS[id].attackable);
  const mobId = Object.keys(NPCS).find((id) => NPCS[id].attackable && !NPCS[id].boss && !NPCS[id].fixed);
  const boss = g.spawnNpc(bossId, g.player.x + 2, g.player.y, { temporary: true });
  const mob = g.spawnNpc(mobId, g.player.x - 2, g.player.y, { temporary: true });
  const drink = (id) => { g.inventory.add(id, 1); g.drinkPotion(g.inventory.slots.findIndex((s) => s?.id === id)); };
  const clear = () => { g.potions = {}; };
  const snap = () => ({ mob: g._offensiveMods(mob, 'melee'), boss: g._offensiveMods(boss, 'melee'), speed: g.attackInterval(), hp: g.maxHp() });
  const base = snap();

  drink('super_might_potion');
  let s = snap();
  assert.ok(s.mob.dmgM > base.mob.dmgM * 1.05, `+15% damage: ${s.mob.dmgM} vs ${base.mob.dmgM}`);
  clear();
  drink('super_haste_potion');
  assert.ok(Math.abs(g.attackInterval() * 1.15 - base.speed) < 1e-9, '+15% attack speed');
  clear();
  drink('tigers_focus');
  assert.ok(Math.abs(snap().mob.critCh - base.mob.critCh - 0.1) < 1e-9, '+10% crit chance');
  clear();
  drink('garuda_draught');
  s = snap();
  assert.ok(s.boss.dmgM > base.boss.dmgM * 1.1, 'more damage to a boss');
  assert.equal(s.mob.dmgM, base.mob.dmgM, 'but not to an ordinary monster');
  clear();
  drink('naga_elixir');
  assert.equal(g.maxHp(), base.hp + Math.floor((g.skills.hitpoints + (g.equipment.bonuses().hp || 0)) * 0.2), '+20% max life');
  // Lifesteal heals off a real hit.
  g.player.hp = 10;
  g._offensiveMods(mob, 'melee');
  mob.hp = mob.maxHp = 1e6;
  g._applyPlayerHit(mob, 200);
  assert.ok(g.player.hp >= 10 + 10, `healed by lifesteal (${g.player.hp})`);
  // Wearing off takes the extra life away again.
  g.player.hp = g.maxHp();
  g.potions.naga_elixir = 1; g._tickPotions(10);
  assert.equal(g.player.hp, base.hp);
  clear();

  // The phoenix elixir gives all of those at once, and stands in for them.
  drink('phoenix_elixir');
  s = snap();
  assert.ok(s.boss.dmgM > base.boss.dmgM * 1.15, 'more damage to bosses');
  assert.ok(s.mob.dmgM > base.mob.dmgM * 1.05, 'more damage to everything');
  assert.ok(Math.abs(s.mob.critCh - base.mob.critCh - 0.1) < 1e-9, 'more crits');
  assert.ok(Math.abs(s.speed * 1.15 - base.speed) < 1e-9, 'faster attacks');
  assert.ok(s.hp > base.hp, 'more life');
  const pm = g.potionMods();
  drink('super_might_potion');
  assert.deepEqual(g.potionMods(), pm, 'a super might potion on top adds nothing');
});

test('the phoenix elixir saves you once from death while it runs', () => {
  const g = newGame();
  g.inventory.add('phoenix_elixir', 1);
  g.drinkPotion(g.inventory.slots.findIndex((s) => s?.id === 'phoenix_elixir'));
  g.player.hp = 0;
  g.playerDeath();
  assert.ok(g.player.alive, 'still standing');
  assert.equal(g.player.hp, Math.round(g.maxHp() * 0.5));
  assert.equal(g.potions.phoenix_elixir, undefined, 'and the elixir is spent');
  g.player.hp = 0;
  g.playerDeath();
  assert.equal(g.player.alive, false, 'the second death is a death');
});

test('balance guard: no potion runs unless you drink one', () => {
  const g = newGame();
  assert.deepEqual(g.potionMods(), {});
  assert.equal(g.perkMods().haste, undefined);
});

test('endgame catches, crops, seeds and brews have their own untinted stickers', () => {
  for (const t of TIERS) {
    for (const id of [t.catch, t.crop, `${t.crop}_seed`, t.brew]) {
      const html = itemIconSVG(id, 24);
      assert.ok(html.includes(`assets/icons/item-${id}.webp`) && !html.includes('filter:'), `${id} has its own sticker`);
    }
  }
});
