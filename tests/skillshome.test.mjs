// Skill unlocks (10/25/50/75/99), the skill chains between life skills, the
// kampong home in Kranji, and the Hunter snare for older saves.
import './seed.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave } from '../src/game/save.js';
import { xpForLevel, MAX_LEVEL, LIFE_MAX_LEVEL } from '../src/data/xp.js';
import { SKILL_UNLOCKS, UNLOCK_LEVELS, UNLOCKS } from '../src/data/unlocks.js';
import { LIFE_PERK_SKILLS } from '../src/game/lifeperks.js';
import { unlockFxAt, unlockLadder, runSkillAction, skillTeleport, growTicks, afterFireLit, unlockTipText, unlockGrowth } from '../src/game/skillunlocks.js';
import { unlockLadderHTML } from '../src/ui/skillguideui.js';
import { STATION_BY_ID } from '../src/data/transport.js';
import { resolveCraft, resolveDish, resolveSmith, resolveRecipe } from '../src/game/skilling.js';
import { CRAFT } from '../src/data/crafting.js';
import { DISHES } from '../src/data/cooking.js';
import { SMITH } from '../src/data/smithing.js';
import { FLETCH, POTIONS } from '../src/data/trades.js';
import { ITEMS } from '../src/data/items.js';
import { recipesFor, itemEntry } from '../src/game/skillguide.js';
import { itemIconSVG } from '../src/render/icons.js';
import { HOME_PRICE, HOME_UPGRADES } from '../src/game/home.js';
import { chebyshev } from '../src/core/utils.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
// A UI stub: every method is a no-op, but banners are recorded.
function uiStub(banners) {
  return new Proxy({}, { get: (_, k) => (k === 'showBanner' ? (html) => banners.push(html) : () => {}) });
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle?.('melee');
  return g;
}
const setLevel = (g, s, l) => { g.skills.xp[s] = xpForLevel(l); };
beforeEach(() => { UNLOCKS.on = true; });   // seed.mjs switches them off for the other test files

// ---------------- Unlocks ----------------

test('every life skill has an unlock at 10, 25, 50, 75 and 99, and named recipes open at their rung', () => {
  for (const s of LIFE_PERK_SKILLS) {
    assert.deepEqual(SKILL_UNLOCKS[s].map((u) => u.level), UNLOCK_LEVELS, s);
    for (const u of SKILL_UNLOCKS[s]) assert.ok(u.fx || u.teleport || u.recipe, `${s} ${u.level} does something`);
    for (const u of SKILL_UNLOCKS[s]) if (u.teleport) assert.ok(STATION_BY_ID[u.teleport], `${s} teleport ${u.teleport}`);
    for (const u of SKILL_UNLOCKS[s]) if (u.recipe) {
      assert.ok(ITEMS[u.recipe], u.recipe);
      assert.ok(recipesFor(s).some((r) => r.output?.id === u.recipe && r.level === u.level), `${s} has a level ${u.level} recipe for ${u.recipe}`);
    }
  }
  assert.deepEqual(unlockFxAt('woodcutting', 9), {});
  assert.deepEqual(unlockFxAt('woodcutting', 25), { double: 0.05, quick: 0.05 });
  assert.equal(unlockLadder('mining', 50).filter((u) => u.unlocked).length, 3);
  assert.match(unlockTipText('mining', 30), /3 of 5|2 of 5/);
});

test('reaching an unlock level announces it with a banner', () => {
  const g = newGame();
  const banners = [];
  g.ui = uiStub(banners);
  g.skills.xp.woodcutting = xpForLevel(10) - 0.5;
  g.skills.addXp('woodcutting', 1);
  assert.equal(g.skills.level('woodcutting'), 10);
  assert.ok(banners.some((b) => b.includes('Sturdy swing')), 'the level 10 unlock gets a banner');
});

test('double yields only come with the unlock', () => {
  const g = newGame();
  const gather = (n) => {
    g.inventory.clear();
    for (let i = 0; i < n; i++) runSkillAction(g, { type: 'woodcut' }, () => { g.inventory.add('logs', 1); return true; });
    return g.inventory.count('logs');
  };
  setLevel(g, 'woodcutting', 5);
  assert.equal(gather(25), 25, 'no unlock, no doubles');
  setLevel(g, 'woodcutting', 99);
  const got = gather(25);
  assert.ok(got > 25, `doubles at 99 (${got})`);
});

test('quick actions run the action twice; makes keep inputs; nodes hold', () => {
  const g = newGame();
  setLevel(g, 'cooking', 99); setLevel(g, 'mining', 99);
  // Quick: more resolver calls than actions.
  let calls = 0;
  for (let i = 0; i < 200; i++) runSkillAction(g, { type: 'cook' }, () => { calls++; return true; });
  assert.ok(calls > 200, `cooked twice sometimes (${calls})`);
  // Save: some raw fish come back.
  g.inventory.clear();
  g.inventory.add('raw_anchovy', 25);
  for (let i = 0; i < 25; i++) runSkillAction(g, { type: 'cook' }, () => { g.inventory.remove('raw_anchovy', 1); g.inventory.add('anchovy', 1); return false; });
  assert.ok(g.inventory.count('anchovy') >= 25);
  assert.ok(g.inventory.count('raw_anchovy') >= 1, 'kept fish are still in the bag');
  // Keep: a rock that would run dry sometimes holds.
  let held = 0;
  for (let i = 0; i < 40; i++) {
    const obj = { depleted: false, respawnTimer: 0, def: { type: 'rock' } };
    const going = runSkillAction(g, { type: 'mine', obj }, () => { obj.depleted = true; obj.respawnTimer = 9; return false; });
    if (!obj.depleted) { held++; assert.equal(going, true); }
  }
  assert.ok(held > 0 && held < 40, `some rocks hold (${held})`);
});

test('skill teleports open at 50 and share a cooldown', () => {
  const g = newGame();
  setLevel(g, 'woodcutting', 49);
  assert.equal(skillTeleport(g, 'woodcutting'), false);
  setLevel(g, 'woodcutting', 50); setLevel(g, 'mining', 50);
  assert.equal(skillTeleport(g, 'woodcutting'), true);
  const st = STATION_BY_ID.mandai;
  assert.ok(chebyshev(g.player.x, g.player.y, st.x, st.y) <= 4, 'lands at Mandai');
  assert.equal(skillTeleport(g, 'mining'), false, 'still recharging');
  g.tickCount += 1000;
  assert.equal(skillTeleport(g, 'mining'), true);
});

test('farming and firemaking unlocks apply', () => {
  const g = newGame();
  setLevel(g, 'farming', 5); assert.equal(growTicks(g, 100), 100);
  setLevel(g, 'farming', 99); assert.equal(growTicks(g, 100), 75);
  setLevel(g, 'firemaking', 10);
  const fire = { lifetime: 100 };
  afterFireLit(g, fire, 'logs');
  assert.equal(fire.lifetime, 125);
  // Planting at 99 grows faster.
  const patch = g.world.objects.find((o) => o.def.type === 'farm' && !o.crop);
  g.inventory.add('chilli_seed', 1);
  assert.ok(g.plantSeed(patch, 'chilli_seed'));
  assert.ok(patch.growLeft < 50, `quicker growth (${patch.growLeft})`);
});

test('past level 99 every unlock keeps growing, to x1.5 at level 9999 and on to about x2.51 at 30,000', () => {
  assert.equal(unlockGrowth(1), 1);
  assert.equal(unlockGrowth(99), 1);
  assert.equal(unlockGrowth(5049), 1.25);
  assert.equal(unlockGrowth(MAX_LEVEL), 1.5);
  assert.ok(Math.abs(unlockGrowth(LIFE_MAX_LEVEL) - (1 + 0.5 * 29901 / 9900)) < 1e-12, `the same pace on to 30,000 (${unlockGrowth(LIFE_MAX_LEVEL)})`);
  assert.equal(unlockGrowth(LIFE_MAX_LEVEL + 1), unlockGrowth(LIFE_MAX_LEVEL), 'and no further');
  for (const s of Object.keys(SKILL_UNLOCKS)) {
    const at99 = unlockFxAt(s, 99), at200 = unlockFxAt(s, 200);
    for (const [k, v] of Object.entries(at99)) assert.ok(at200[k] > v, `${s} ${k} still grows past 99`);
  }
  const mine = unlockFxAt('mining', MAX_LEVEL);
  assert.ok(Math.abs(mine.double - 0.30) < 1e-9 && Math.abs(mine.keep - 0.525) < 1e-9, `Mining at 9999: ${JSON.stringify(mine)}`);
  assert.deepEqual(Object.keys(mine).sort(), ['double', 'keep'], 'no new kinds of effect');
  const g = newGame();
  setLevel(g, 'farming', MAX_LEVEL);
  assert.equal(growTicks(g, 100), 63, 'crops grow 37.5% faster at 9999 (still under the 50% limit)');
  assert.match(unlockTipText('mining', MAX_LEVEL), /each bonus now x1\.50 as strong/);
  assert.doesNotMatch(unlockTipText('mining', 99), /as strong|keep growing/);
  // Up to level 198 it has grown by under 0.5%, which would read "x1.00": the
  // texts say the bonuses keep growing instead, and quote it from 199 (x1.01).
  assert.match(unlockTipText('mining', 150), /Every unlock open, and their bonuses keep growing \(x2\.51 at level 30,000\)/);
  assert.match(unlockTipText('mining', MAX_LEVEL), /x1\.50 as strong \(x2\.51 at level 30,000\)/);
  assert.match(unlockTipText('mining', LIFE_MAX_LEVEL), /each bonus now x2\.51 as strong \(as strong as they get\)/);
  assert.match(unlockTipText('mining', 199), /each bonus now x1\.01 as strong/);
  // The skill guide's ladder says so too, past 99 only.
  setLevel(g, 'mining', 99);
  assert.doesNotMatch(unlockLadderHTML(g, 'mining'), /Still growing/);
  setLevel(g, 'mining', 150);
  assert.match(unlockLadderHTML(g, 'mining'), /Still growing.*Every bonus above grows a little with every level/);
  setLevel(g, 'mining', 5049);
  assert.match(unlockLadderHTML(g, 'mining'), /Still growing.*Every bonus above now works x1\.25 as strongly/);
  for (let l = 100; l <= 250; l++) {
    setLevel(g, 'mining', l);
    assert.doesNotMatch(unlockTipText('mining', l) + unlockLadderHTML(g, 'mining'), /x1\.00/, `level ${l}`);
  }
});

// ---------------- Skill chains ----------------

test('skill-chain recipes craft, show in the guides, and have sticker icons', () => {
  const g = newGame();
  for (const s of ['smithing', 'crafting', 'fletching', 'cooking', 'herblore']) setLevel(g, s, 99);
  const obj = { x: g.player.x, y: g.player.y + 1, def: { type: 'craft' } };
  g.inventory.clear();
  g.inventory.add('hammer', 1); g.inventory.add('knife', 1);
  g.inventory.add('iron_bar', 1);
  resolveSmith(g, { recipe: SMITH.find((r) => r.result === 'barbed_hooks'), obj });
  assert.ok(g.inventory.count('barbed_hooks') >= 10);
  g.inventory.add('feather', 30);
  resolveCraft(g, { recipe: CRAFT.find((r) => r.result === 'feather_lure'), obj });
  assert.ok(g.inventory.count('feather_lure') >= 10);
  g.inventory.add('bamboo', 1);
  const fl = FLETCH.find((r) => r.result === 'bamboo_decoy');
  resolveRecipe(g, { recipe: fl, skill: 'fletching', obj });
  assert.ok(g.inventory.count('bamboo_decoy') >= 5);
  for (const id of ['boar_steak', 'chilli', 'lemongrass', 'bowl']) g.inventory.add(id, 1);
  resolveDish(g, { recipe: DISHES.find((d) => d.result === 'boar_rendang'), obj });
  assert.equal(g.inventory.count('boar_rendang'), 1);
  for (const id of ['boar_rendang', 'fish_head_curry', 'barbed_hooks', 'feather_lure', 'bamboo_decoy', 'anglers_brew', 'trackers_brew', 'prospectors_brew']) {
    assert.ok(itemIconSVG(id, 24).includes('assets/icons/item-'), `${id} has a sticker`);
    assert.ok(itemEntry(id), `${id} is in the Resources index`);
  }
  assert.ok(recipesFor('herblore').some((r) => r.output.id === 'trackers_brew'));
});

test('a boss meal boosts boss damage; brews, lures and decoys boost gathering', () => {
  const g = newGame();
  const before = g.perkMods().boss || 0;
  g.inventory.add('fish_head_curry', 1);
  g.eatItem(g.inventory.slots.findIndex((s) => s?.id === 'fish_head_curry'));
  assert.ok(Math.abs((g.perkMods().boss || 0) - before - 0.12) < 1e-9, 'the curry adds boss damage');
  // A brew adds to its skill's double chance while it runs.
  g.inventory.add('anglers_brew', 1);
  g.drinkPotion(g.inventory.slots.findIndex((s) => s?.id === 'anglers_brew'));
  assert.ok(g.potions.anglers_brew > 0);
  assert.equal(POTIONS.anglers_brew.fx.fishYield, 0.15);
  setLevel(g, 'fishing', 1);
  g.inventory.clear();
  g.inventory.add('feather_lure', 50);
  let fish = 0;
  for (let i = 0; i < 40; i++) runSkillAction(g, { type: 'fish' }, () => { g.inventory.add('raw_anchovy', 1); fish++; return true; });
  assert.equal(g.inventory.count('feather_lure'), 10, 'a lure is used on each catch');
  assert.ok(g.inventory.count('raw_anchovy') > fish, 'the lure and brew land double catches at level 1');
  // A decoy on a Hunter catch.
  g.inventory.add('bamboo_decoy', 3);
  runSkillAction(g, { type: 'hunt' }, () => { g.inventory.add('feather', 3); return true; });
  assert.equal(g.inventory.count('bamboo_decoy'), 2);
});

// ---------------- Kampong home ----------------

test('the home plot is bought, upgraded with coins and materials, and its chest stores items', () => {
  const g = newGame();
  const h = g.home;
  assert.ok(h.origin, 'a plot was found in Kranji');
  assert.equal(g.world.zoneAt(h.origin.x, h.origin.y)?.name, 'Kranji Farmlands');
  assert.ok(g.world.objects.some((o) => o.objId === 'home_plot'), 'the board stands from the start');
  g.inventory.clear();
  assert.equal(h.buy(), false, 'no coins, no house');
  g.inventory.add('coins', HOME_PRICE);
  assert.equal(h.buy(), true);
  assert.equal(g.inventory.count('coins'), 0);
  const at = (id) => g.world.objects.filter((o) => o.objId === id && chebyshev(o.x, o.y, h.origin.x + 4, h.origin.y + 4) <= 6);
  for (const id of ['home_chest', 'range', 'fire', 'home_trophy']) assert.equal(at(id).length, 1, id);
  assert.equal(at('farm_patch').length, 2);
  // Storage: 24 kinds, then the teak chest (materials can come from the bank).
  assert.equal(h.capacity, 24);
  const cost = HOME_UPGRADES.storage.tiers[1].cost;
  g.inventory.add('coins', cost.coins);
  g.bank.deposit('teak_logs', 40); g.bank.deposit('iron_bar', 20);
  assert.equal(h.upgrade('storage'), true);
  assert.equal(h.capacity, 48);
  assert.equal(g.bank.count('teak_logs'), 0);
  // Deposit and withdraw.
  g.inventory.add('oak_logs', 5);
  assert.equal(h.deposit('oak_logs'), 5);
  assert.equal(g.inventory.count('oak_logs'), 0);
  assert.equal(h.count('oak_logs'), 5);
  assert.equal(h.withdraw('oak_logs', 2), 2);
  assert.equal(h.count('oak_logs'), 3);
  // More patches, and the better range lends its bonus.
  g.inventory.add('coins', 100000); g.inventory.add('oak_logs', 30); g.inventory.add('clay', 50); g.inventory.add('iron_bar', 10);
  assert.ok(h.upgrade('patches'));
  assert.equal(at('farm_patch').length, 4);
  assert.ok(h.upgrade('range'));
  assert.deepEqual(at('range')[0].homeFx, { save: 0.05 });
});

test('teleport home has a cooldown; the trophy wall lists boss kills', () => {
  const g = newGame();
  const h = g.home;
  assert.equal(h.teleport(), false, 'no home yet');
  g.inventory.add('coins', HOME_PRICE);
  h.buy();
  assert.equal(h.teleport(), true);
  assert.ok(chebyshev(g.player.x, g.player.y, h.origin.x + 4, h.origin.y + 5) <= 2, 'arrives at the plot');
  g.player.x = g.player.tx = 60; g.player.y = g.player.ty = 55;
  assert.equal(h.teleport(), false, 'recharging');
  g.tickCount += h.tpTicks;
  assert.equal(h.teleport(), true);
  g.kills.kranji_buffalo_king = 3;
  assert.deepEqual(h.trophies().bosses.map((b) => [b.id, b.kills]), [['kranji_buffalo_king', 3]]);
});

test('the home, its chest, tiers and crops survive a save', () => {
  const g = newGame();
  const h = g.home;
  g.inventory.add('coins', HOME_PRICE + 8000);
  h.buy();
  g.inventory.add('oak_logs', 30);
  h.upgrade('patches');
  g.inventory.add('pearl', 4);
  h.deposit('pearl');
  const patch = g.world.objects.filter((o) => o.objId === 'farm_patch' && o.home)[3];
  patch.crop = 'chilli'; patch.growLeft = 7;
  h.teleport();
  assert.ok(saveGame(g));

  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.equal(g2.home.owned, true);
  assert.equal(g2.home.tiers.patches, 1);
  assert.equal(g2.home.count('pearl'), 4);
  const p2 = g2.world.objectAt(patch.x, patch.y);
  assert.equal(p2?.crop, 'chilli', 'the crop in a home patch is back');
  assert.ok(g2.home.tpWait() > 0, 'the teleport is still recharging');
  // An older save without a home loads with no house.
  const g3 = new Game();
  g3.home.load(undefined);
  assert.equal(g3.home.owned, false);
});

// ---------------- Hunter onboarding ----------------

test('loading a save with no hunting snare gives one, once', () => {
  const g = newGame();
  const strip = (game) => {
    for (let i = 0; i < game.inventory.slots.length; i++) if (game.inventory.slots[i]?.id === 'hunting_snare') game.inventory.slots[i] = null;
    game.bank.withdraw('hunting_snare', 99);
  };
  strip(g);
  assert.equal(g.hasTool('snare'), false);
  // A save from before the flag: no snare anywhere, and snareGiven unset.
  g.snareGiven = false;
  assert.ok(saveGame(g));
  const g2 = new Game();
  const lines = [];
  g2.bus.on('chat', (m) => lines.push(m.text));
  assert.ok(loadGame(g2));
  assert.ok(g2.hasTool('snare'), 'a snare was slipped into the pack');
  assert.equal(lines.filter((t) => t.includes('You found a hunting snare')).length, 1);
  // Lose it again: the next load doesn't give another.
  strip(g2);
  saveGame(g2);
  const g3 = new Game();
  assert.ok(loadGame(g3));
  assert.equal(g3.hasTool('snare'), false, 'only once per save');
});
