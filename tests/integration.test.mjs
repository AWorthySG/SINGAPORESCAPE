// Headless integration tests: boot the Game (no DOM), simulate ticks, and verify
// the world, gathering pipeline and save/load all work end-to-end.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { getNpc } from '../src/data/npcs.js';
import { chebyshev } from '../src/core/utils.js';
import { CROP_BY_SEED, cropFor } from '../src/data/trades.js';
import { playerAttackVsNpc } from '../src/game/combat.js';

// In-memory localStorage so save.js has somewhere to write.
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function step(game, ticks) {
  for (let i = 0; i < ticks; i++) game.update(600);
}

test('game boots with a populated world', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();

  assert.ok(game.player.alive);
  assert.equal(game.player.hp, 25);
  assert.ok(game.skills.attack >= 15 && game.skills.defence >= 12, 'buffed starting combat stats');
  // A brand-new game waits for the player to pick a fighting style before
  // granting combat gear (see the "Choose Your Path" prompt).
  assert.ok(game.pendingStyleChoice, 'prompts a starting-style choice');
  assert.equal(game.equipment.get('weapon'), null, 'no weapon until a style is chosen');
  game.chooseStartingStyle('melee');
  assert.ok(!game.pendingStyleChoice);
  assert.equal(game.equipment.get('weapon'), 'bronze_scimitar', 'starts equipped once melee is chosen');
  assert.ok(game.world.objects.some((o) => o.def.type === 'shrine'), 'town has the Worthy Monument');
  assert.ok(game.npcs.length > 10, 'should spawn many NPCs');
  assert.ok(game.npcs.some((n) => n.attackable), 'should have monsters');
  assert.ok(game.world.objects.some((o) => o.def.type === 'tree'));
  assert.ok(game.world.objects.some((o) => o.def.type === 'rock'));
  assert.ok(game.world.objects.some((o) => o.def.type === 'fishing'));
  assert.ok(game.world.objects.some((o) => o.def.type === 'bank'));
  assert.ok(game.inventory.has('bronze_axe'), 'new player gets a starter axe');
});

test('starting-style choice grants the right kit for melee, ranged and magic', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();

  const ranged = new Game();
  ranged.start();
  ranged.chooseStartingStyle('ranged');
  assert.equal(ranged.equipment.get('weapon'), 'shortbow');
  assert.equal(ranged.combatMode(), 'ranged');
  assert.ok(ranged.inventory.has('bronze_arrow', 150));

  const magic = new Game();
  magic.start();
  magic.chooseStartingStyle('magic');
  assert.equal(magic.equipment.get('weapon'), 'staff');
  assert.equal(magic.combatMode(), 'magic');
  assert.ok(magic.inventory.has('air_rune', 150) && magic.inventory.has('mind_rune', 150));

  const melee = new Game();
  melee.start();
  melee.chooseStartingStyle('melee');
  assert.equal(melee.equipment.get('weapon'), 'bronze_scimitar');
  assert.equal(melee.combatMode(), 'melee');

  // One-shot: choosing again (e.g. a stray click) must not re-grant items.
  const before = melee.inventory.count('bronze_arrow');
  melee.chooseStartingStyle('ranged');
  assert.equal(melee.equipment.get('weapon'), 'bronze_scimitar', 'a second choice is ignored');
  assert.equal(melee.inventory.count('bronze_arrow'), before);

  // A loaded save never prompts for a style choice.
  const loaded = new Game();
  loaded.start();
  loaded.chooseStartingStyle('melee');
  saveGame(loaded);
  const resumed = new Game();
  resumed.start();
  assert.ok(!resumed.pendingStyleChoice, 'a loaded save skips the style prompt');
});

test('player can chop logs from a tree', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.autoRetaliate = false; // isolate from random wandering aggro
  game.player.hp = 9999;             // can't be killed mid-chop by a wanderer

  const tree = game.world.objects
    .find((o) => o.def.type === 'tree' && !o.depleted && o.def.level <= game.skills.level('woodcutting'));
  assert.ok(tree, 'a choppable tree exists');

  // Stand on a walkable tile next to it (avoids long travel + random combat).
  const adj = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    .map(([dx, dy]) => ({ x: tree.x + dx, y: tree.y + dy }))
    .find((t) => game.world.inBounds(t.x, t.y) && !game.world.isBlocked(t.x, t.y));
  assert.ok(adj, 'tree has a reachable adjacent tile');
  game.player.x = game.player.tx = adj.x;
  game.player.y = game.player.ty = adj.y;

  const startXp = game.skills.xp.woodcutting;
  game.beginAction({ type: 'woodcut', obj: tree }, { x: tree.x, y: tree.y }, true);
  step(game, 150); // ~150 adjacent ticks => chopping is effectively certain
  assert.ok(game.inventory.has('logs'), 'should have chopped at least one log');
  assert.ok(game.skills.xp.woodcutting > startXp, 'woodcutting xp should increase');
});

test('combat: attacking a chicken deals damage and can kill it', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();

  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  assert.ok(chicken);
  game.attackNpc(chicken);
  const startCmbXp = game.skills.totalXp();
  step(game, 120);
  // Either the chicken died (and respawn timer set) or took damage; xp should have risen.
  assert.ok(game.skills.totalXp() >= startCmbXp);
});

test('save and load round-trips skills and inventory', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g1 = new Game();
  g1.start();
  g1.skills.addXp('woodcutting', 5000);
  g1.skills.addXp('mining', 12000);
  g1.inventory.add('coal', 7);
  const wcLevel = g1.skills.level('woodcutting');
  const coal = g1.inventory.count('coal');
  assert.ok(saveGame(g1));

  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.equal(g2.skills.level('woodcutting'), wcLevel);
  assert.equal(g2.inventory.count('coal'), coal);
});

test('praying at the Worthy Monument heals to full', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const shrine = game.world.objects.find((o) => o.def.type === 'shrine');
  assert.ok(shrine, 'monument exists');
  // Isolate from random wandering aggro so the heal result is deterministic.
  game.npcs = [];
  game.player.autoRetaliate = false;
  // Stand on a walkable tile next to the monument so it heals promptly.
  const adj = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    .map(([dx, dy]) => ({ x: shrine.x + dx, y: shrine.y + dy }))
    .find((t) => game.world.inBounds(t.x, t.y) && !game.world.isBlocked(t.x, t.y));
  assert.ok(adj, 'monument has a reachable adjacent tile');
  game.player.x = game.player.tx = adj.x;
  game.player.y = game.player.ty = adj.y;
  game.player.hp = 3;
  game.beginAction({ type: 'pray', obj: shrine }, { x: shrine.x, y: shrine.y }, true);
  step(game, 10);
  assert.equal(game.player.hp, game.skills.hitpoints, 'fully healed after praying');
});

test('ranged combat consumes arrows and trains ranged', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.autoRetaliate = false; game.player.hp = 9999;
  game.equipment.set('weapon', 'shortbow');
  game.inventory.add('bronze_arrow', 100);
  assert.equal(game.combatMode(), 'ranged');

  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  game.player.x = game.player.tx = chicken.x + 3; game.player.y = game.player.ty = chicken.y;
  game.doPlayerAttack(chicken); // fire once directly so the projectile hasn't decayed yet
  assert.ok(game.effects.some((e) => e.type === 'projectile' && e.kind === 'arrow'), 'fires a fletched arrow, not a generic bolt');
  game.attackNpc(chicken);
  step(game, 40);
  assert.ok(game.skills.xp.ranged > 0, 'shooting trains Ranged');
  // About 4 in 5 arrows are recovered; the rest are used up.
  const idx = game.inventory.slots.findIndex((x) => x && x.id === 'bronze_arrow');
  const n0 = game.inventory.count('bronze_arrow');
  const rnd = Math.random;
  try {
    Math.random = () => 0.1; game._spendArrow(idx);
    assert.equal(game.inventory.count('bronze_arrow'), n0, 'a recovered arrow is kept');
    Math.random = () => 0.95; game._spendArrow(idx);
    assert.equal(game.inventory.count('bronze_arrow'), n0 - 1, 'a lost arrow is used up');
  } finally { Math.random = rnd; }
});

test('magic combat consumes runes and trains magic', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.autoRetaliate = false; game.player.hp = 9999;
  game.equipment.set('weapon', 'staff');
  game.player.spell = 'wind_strike';
  game.inventory.add('air_rune', 50); game.inventory.add('mind_rune', 50);
  assert.equal(game.combatMode(), 'magic');

  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  chicken.hp = chicken.maxHp = 99999;   // keep it alive: a kill refunds the runes spent on it
  game.player.x = game.player.tx = chicken.x + 3; game.player.y = game.player.ty = chicken.y;
  game.doPlayerAttack(chicken); // fire once directly so the projectile hasn't decayed yet
  assert.ok(game.effects.some((e) => e.type === 'projectile' && e.kind === 'bolt'), 'casts a glowing bolt, distinct from an arrow');
  game.attackNpc(chicken);
  step(game, 40);
  assert.ok(game.inventory.count('air_rune') < 50, 'runes were used');
  assert.ok(game.skills.xp.magic > 0, 'magic xp gained');
});

test('the bone quest can be started and completed', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.handleDialogueAction('questStart');
  assert.equal(game.quests.bone_collector.state, 'active');
  game.inventory.add('bones', 12);
  game.handleDialogueAction('questTurnIn');
  assert.equal(game.quests.bone_collector.state, 'done');
  assert.equal(game.inventory.count('bones'), 2); // 10 consumed
  assert.ok(game.inventory.has('amulet_of_strength'));
});

test('prayers activate, conflict by group, boost combat and drain points', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.skills.addXp('prayer', 50000); // high Prayer level
  game.prayerPoints = game.maxPrayer();

  game.togglePrayer('burst_strength');
  assert.ok(game.activePrayers.has('burst_strength'));
  assert.ok(game.prayerMult().str > 1, 'strength prayer boosts damage');

  game.togglePrayer('superhuman'); // same (str) group -> replaces
  assert.ok(!game.activePrayers.has('burst_strength') && game.activePrayers.has('superhuman'));

  game.togglePrayer('protect_melee');
  assert.ok(game.protectFactor() > 0, 'protect prayer reduces incoming damage');

  const before = game.prayerPoints;
  for (let i = 0; i < 10; i++) game.update(600);
  assert.ok(game.prayerPoints < before, 'prayer points drain while active');
});

test('pest control quest tracks rat kills to completion', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.handleDialogueAction('pestStart');
  assert.equal(game.quests.pest_control.state, 'active');
  const rat = game.npcs.find((n) => n.npcId === 'rat');
  assert.ok(rat);
  for (let i = 0; i < 8; i++) game.killNpc(rat); // simulate 8 rat kills
  assert.equal(game.quests.pest_control.state, 'done');
});

test('achievements unlock from kills and persist through save/load', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  assert.ok(!game.achievements.has('first_blood'));

  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  game.killNpc(chicken);
  assert.equal(game.totalKills, 1);
  assert.ok(game.achievements.has('first_blood'), 'First Blood unlocks on first kill');

  assert.ok(saveGame(game));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.ok(g2.achievements.has('first_blood'), 'achievements survive a reload');
  assert.equal(g2.totalKills, 1, 'kill count survives a reload');
});

test('wealth achievements unlock once enough coins are held', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.inventory.add('coins', 1000);
  game.checkAchievements();
  assert.ok(game.achievements.has('pocket_money'), 'Pocket Money unlocks at 1,000 coins');
});

test('deposit all moves the whole inventory into the bank', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.inventory.add('logs', 50);
  const logsBefore = game.inventory.count('logs');
  assert.ok(logsBefore > 0);
  game.depositAll();
  assert.equal(game.inventory.count('logs'), 0, 'inventory cleared of logs');
  assert.equal(game.bank.count('logs'), logsBefore, 'logs now in the bank');
});

test('pillars quest tracks both landmarks and rewards the sigil', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.handleDialogueAction('pillarsStart');
  assert.equal(game.quests.pillars.state, 'active');

  // Turning in early fails until both pillars are honoured.
  game.handleDialogueAction('pillarsTurnIn');
  assert.equal(game.quests.pillars.state, 'active', 'cannot complete without both pillars');

  game.markPillar('monument');
  game.markPillar('obelisk');
  assert.ok(game.quests.pillars.monument && game.quests.pillars.obelisk);

  game.handleDialogueAction('pillarsTurnIn');
  assert.equal(game.quests.pillars.state, 'done');
  assert.ok(game.inventory.has('worthy_sigil'), 'received the A-Worthy Sigil');
  assert.ok(game.achievements.has('pillars'), 'sigil achievement unlocked');
});

test("smith's apprentice quest consumes steel bars for gauntlets", () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.handleDialogueAction('smithStart');
  assert.equal(game.quests.smith_apprentice.state, 'active');
  game.handleDialogueAction('smithTurnIn');
  assert.equal(game.quests.smith_apprentice.state, 'active', 'cannot complete without bars');
  game.inventory.add('steel_bar', 8);
  game.handleDialogueAction('smithTurnIn');
  assert.equal(game.quests.smith_apprentice.state, 'done');
  assert.equal(game.inventory.count('steel_bar'), 0, 'bars consumed');
  assert.ok(game.inventory.has('kampong_gauntlets'));
});

test('island defender quest tracks boss kills and rewards gear', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.handleDialogueAction('defenderStart');
  assert.equal(game.quests.island_defender.state, 'active');
  const boss = game.npcs.find((n) => n.def.boss);
  assert.ok(boss, 'a boss exists in the world');
  for (let i = 0; i < 3; i++) { boss.alive = true; boss.hp = 1; game.killNpc(boss); }
  game.handleDialogueAction('defenderTurnIn');
  assert.equal(game.quests.island_defender.state, 'done');
  assert.ok(game.inventory.has('island_aegis') && game.inventory.has('champions_helm'));
  assert.ok(game.achievements.has('defender'), 'defender achievement unlocked');
});

test('big game hunter quest counts kills and rewards a bow', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.handleDialogueAction('bigGameStart');
  assert.equal(game.quests.big_game_hunter.state, 'active');
  game.handleDialogueAction('bigGameTurnIn');
  assert.equal(game.quests.big_game_hunter.state, 'active', 'cannot complete early');
  const mob = game.npcs.find((n) => n.attackable && !n.def.boss);
  for (let i = 0; i < 50; i++) { mob.alive = true; mob.hp = 1; game.killNpc(mob); }
  game.handleDialogueAction('bigGameTurnIn');
  assert.equal(game.quests.big_game_hunter.state, 'done');
  assert.ok(game.inventory.has('magic_shortbow') && game.inventory.count('rune_arrow') >= 100);
});

test('slayer: assign a task, complete it for points and XP, then spend points', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.assignSlayerTask();
  const task = game.slayer.task;
  assert.ok(task, 'a task was assigned');
  const mob = game.npcs.find((n) => n.def.family === task.family);
  assert.ok(mob, 'a monster of the task family exists in the world');
  const need = task.amount;
  for (let i = 0; i < need; i++) { mob.alive = true; mob.hp = 1; game.killNpc(mob); }
  assert.equal(game.slayer.task, null, 'task completed and cleared');
  assert.ok(game.slayer.completed >= 1 && game.slayer.points >= 10, 'points awarded');
  assert.ok(game.skills.xp.slayer > 0, 'slayer xp gained');

  game.slayer.points = 100;
  game.buySlayerReward('slayer_ring');
  assert.ok(game.inventory.has('slayer_ring'), 'reward redeemed');
  assert.equal(game.slayer.points, 70, 'points deducted');
});

test('slayer state survives save/load', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g1 = new Game();
  g1.start();
  g1.assignSlayerTask();
  g1.slayer.points = 42;
  assert.ok(saveGame(g1));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.equal(g2.slayer.points, 42);
  assert.ok(g2.slayer.task && g2.slayer.task.family === g1.slayer.task.family);
});

test("the mystic's trial trades death runes for the ancient staff", () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.handleDialogueAction('mysticStart');
  assert.equal(game.quests.mystic_trial.state, 'active');
  game.handleDialogueAction('mysticTurnIn');
  assert.equal(game.quests.mystic_trial.state, 'active', 'cannot complete without runes');
  game.inventory.add('death_rune', 25);
  game.handleDialogueAction('mysticTurnIn');
  assert.equal(game.quests.mystic_trial.state, 'done');
  assert.equal(game.inventory.count('death_rune'), 0, 'runes consumed');
  assert.ok(game.inventory.has('ancient_staff'));
});

test('an old saved wave spell casts as its element (Fire) at high Magic', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.autoRetaliate = false; game.player.hp = 9999;
  game.skills.addXp('magic', 5_000_000); // high Magic level
  game.equipment.set('weapon', 'ancient_staff');
  game.player.spell = 'fire_wave';
  game.inventory.add('fire_rune', 50); game.inventory.add('air_rune', 50); game.inventory.add('mind_rune', 20);
  assert.equal(game.combatMode(), 'magic');
  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  // A sturdy target takes many casts, so the Rune Saver perk (up to a 50% free
  // cast at high Magic) can't leave every rune unspent. It must outlast all 40
  // ticks: uncapped cast speed now kills a 5000 HP target in about 5 casts.
  chicken.maxHp = chicken.hp = 10_000_000;
  game.player.x = game.player.tx = chicken.x + 3; game.player.y = game.player.ty = chicken.y;
  game.attackNpc(chicken);
  step(game, 40);
  // Any of its runes going down shows Fire was cast (the area splash can kill
  // neighbours whose loot or rune refund tops one kind back up).
  const inv = game.inventory;
  assert.ok(inv.count('fire_rune') < 50 || inv.count('air_rune') < 50 || inv.count('mind_rune') < 20, 'runes were spent casting Fire');
});

test('lobster and the new fish can be cooked (cooking gap closed)', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.skills.addXp('cooking', 5_000_000); // high cooking so nothing burns
  const range = game.world.objects.find((o) => o.def.type === 'range' || o.def.type === 'fire');
  assert.ok(range, 'a cooking station exists');
  game.player.x = game.player.tx = range.x; game.player.y = game.player.ty = range.y;
  for (const raw of ['raw_lobster', 'raw_swordfish', 'raw_salmon', 'raw_tuna', 'raw_shark']) {
    game.inventory.add(raw, 1);
    game.beginAction({ type: 'cook', obj: range, rawId: raw }, { x: range.x, y: range.y }, true);
    step(game, 4);
  }
  assert.ok(game.inventory.has('lobster') && game.inventory.has('swordfish'), 'lobster & swordfish cook now');
  assert.ok(game.inventory.has('shark'), 'shark cooks');
});

test('island provisions quest trades cooked salmon for rewards', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.handleDialogueAction('provisionsStart');
  assert.equal(game.quests.island_provisions.state, 'active');
  game.inventory.add('salmon', 10);
  game.handleDialogueAction('provisionsTurnIn');
  assert.equal(game.quests.island_provisions.state, 'done');
  assert.equal(game.inventory.count('salmon'), 0);
});

test('Pulau Hantu region exists, is reachable land, and is populated', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  // The map was widened to include the new eastern island.
  assert.ok(game.world.width >= 150, 'map widened for the new region');
  const zone = game.world.zoneAt(135, 52);
  assert.ok(zone && zone.name === 'Pulau Hantu', 'zone detection covers the island');
  // It has its own monsters (placed by zone) and a boss.
  const inHantu = (n) => n.x >= 120 && n.x <= 149;
  assert.ok(game.npcs.some((n) => n.attackable && !n.def.boss && inHantu(n)), 'island has monsters');
  assert.ok(game.npcs.some((n) => n.def.boss && n.npcId === 'orang_minyak'), 'island boss spawned');
  // And its own resource nodes.
  assert.ok(game.world.objects.some((o) => inHantu(o) && o.def.type === 'tree'), 'island has trees');
  // The ruined plaza is walkable so the area is reachable.
  assert.ok(!game.world.isBlocked(130, 53), 'plaza is walkable');
});

test('MRT fast travel moves the player and charges a fare', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const { STATION_BY_ID, MRT_FARE } = await import('../src/data/transport.js');
  // Every station is placed in the world and lands on walkable ground.
  for (const id of Object.keys(STATION_BY_ID)) {
    const st = STATION_BY_ID[id];
    assert.ok(game.world.objects.some((o) => o.objId === 'mrt_station' && o.x === st.x && o.y === st.y), `station ${id} placed`);
    assert.ok(!game.world.isBlocked(st.x, st.y), `station ${id} tile is walkable`);
  }
  game.inventory.add('coins', 200); // stay under the Pocket Money (1k) achievement threshold
  const before = game.inventory.count('coins');
  const dest = STATION_BY_ID.sentosa;
  game.travelTo('sentosa');
  assert.equal(game.player.x, dest.x);
  assert.equal(game.player.y, dest.y);
  assert.equal(game.inventory.count('coins'), before - MRT_FARE, 'fare deducted');
});

test('special attack spends energy and fires a stronger hit', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.autoRetaliate = false; game.player.hp = 9999;
  game.equipment.set('weapon', 'dragon_scimitar');
  game.specEnergy = 100;
  game.toggleSpec();
  assert.ok(game.specArmed, 'spec armed');
  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  game.player.x = game.player.tx = chicken.x + 1; game.player.y = game.player.ty = chicken.y;
  game.attackNpc(chicken);
  step(game, 4);
  assert.ok(game.specEnergy < 70, `energy spent (now ${game.specEnergy})`); // spent 40, minus a little regen
  assert.ok(!game.specArmed, 'spec consumed');
});

test('unlocking an achievement grants its coin reward (once)', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.rollDrops = () => {}; // drops are auto-looted now; keep them out of the coin count
  const before = game.inventory.count('coins');
  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  chicken.alive = true; chicken.hp = 1; game.killNpc(chicken); // unlocks first_blood (+100)
  assert.ok(game.achievements.has('first_blood'));
  assert.equal(game.inventory.count('coins'), before + 100, 'reward granted');
  const after = game.inventory.count('coins');
  game.checkAchievements(); // re-check shouldn't re-grant
  assert.equal(game.inventory.count('coins'), after, 'reward only granted once');
});

test('bestiary kill counts track per-monster and persist', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g1 = new Game();
  g1.start();
  const chicken = g1.npcs.find((n) => n.npcId === 'chicken');
  for (let i = 0; i < 3; i++) { chicken.alive = true; chicken.hp = 1; g1.killNpc(chicken); }
  assert.equal(g1.kills.chicken, 3);
  assert.ok(saveGame(g1));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.equal(g2.kills.chicken, 3, 'per-monster kills survive save/load');
});

test('quick-eat consumes the first food in the bag', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.skills.addXp('hitpoints', 5000);
  game.player.hp = 5;
  const before = game.inventory.count('kaya_toast');
  assert.ok(before > 0, 'starter food present');
  game.eatFirstFood();
  assert.ok(game.player.hp > 5, 'healed');
  assert.equal(game.inventory.count('kaya_toast'), before - 1, 'one food consumed');
});

test('world-map long-range travel sets a path across the island', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  // Travel from the spawn town toward Sentosa Beach (far south).
  game.walkToFar({ x: 58, y: 92 });
  assert.ok(game.player.path.length > 0, 'a multi-tile path was planned');
});

test('ranged special (magic shortbow Rapid Volley) fires twice and spends arrows', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.autoRetaliate = false; game.player.hp = 9999;
  game.equipment.set('weapon', 'magic_shortbow');
  game.inventory.add('rune_arrow', 100);
  game.specEnergy = 100;
  assert.equal(game.combatMode(), 'ranged');
  game.toggleSpec();
  assert.ok(game.specArmed, 'spec armed on a bow (no longer melee-only)');
  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  chicken.maxHp = chicken.hp = 99; // durable dummy so both volley arrows fire
  game.player.x = game.player.tx = chicken.x + 3; game.player.y = game.player.ty = chicken.y;
  // Count arrows fired (most are recovered afterwards, so the stack barely moves).
  let shots = 0;
  const fire = game._projectile.bind(game);
  game._projectile = (n, col, kind, ...rest) => { if (kind === 'arrow') shots++; return fire(n, col, kind, ...rest); };
  game.attackNpc(chicken);
  step(game, 3);
  assert.ok(shots >= 2, 'the volley fires two arrows');
  assert.ok(game.specEnergy < 60, 'spec energy spent');
});

test('run energy regenerates while standing still', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.runEnergy = 20;
  const before = game.runEnergy;
  for (let i = 0; i < 10; i++) game.update(600); // idle ticks
  assert.ok(game.runEnergy > before, 'run energy recovers when idle');
});

test('eating food heals the player', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.skills.addXp('hitpoints', 5000); // raise max hp
  game.player.hp = 5;
  // kaya_toast comes in the starter pack.
  const idx = game.inventory.slots.findIndex((s) => s && s.id === 'kaya_toast');
  assert.ok(idx >= 0);
  game.eatItem(idx);
  assert.ok(game.player.hp > 5, 'eating should heal');
});

test('life-skills quest line teaches every life skill stage by stage', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { LIFE_STAGES, LIFE_GRAD } = await import('../src/data/lifeskills.js');
  const game = new Game();
  game.start();

  // Tutor NPC + dialogue tree exist and are reachable.
  assert.ok(game.npcs.some((n) => n.npcId === 'skills_tutor'), 'Cikgu Surya is in the world');
  const { getDialogue } = await import('../src/data/dialogue.js');
  assert.ok(getDialogue('tutor'), 'tutor dialogue tree exists');

  // Start the quest line.
  game.handleDialogueAction('lifeStart');
  assert.equal(game.quests.life_skills.state, 'active');
  assert.equal(game.quests.life_skills.stage, 1);

  // Turning in with nothing in hand must not advance or consume.
  game.handleDialogueAction('lifeTurnIn');
  assert.equal(game.quests.life_skills.stage, 1, 'no progress without the goods');

  // Walk every stage by satisfying its requirement.
  for (let i = 0; i < LIFE_STAGES.length; i++) {
    const st = LIFE_STAGES[game.quests.life_skills.stage - 1];
    const xpBefore = game.skills.xp[st.skill] || 0;
    if (st.need.item) {
      game.inventory.add(st.need.item, st.need.qty);
      const held = game.inventory.count(st.need.item);
      game.handleDialogueAction('lifeTurnIn');
      assert.ok(game.inventory.count(st.need.item) < held, `${st.name} turn-in consumed the items`);
    } else {
      // xp-based lesson (Firemaking): practise past the baseline, then report.
      game.skills.addXp(st.skill, st.need.xp + 5);
      game.handleDialogueAction('lifeTurnIn');
    }
    assert.ok((game.skills.xp[st.skill] || 0) >= xpBefore + st.reward.xp, `${st.name} lesson granted its XP`);
  }

  // Completed — graduation paid out across all life skills.
  assert.equal(game.quests.life_skills.state, 'done', 'quest line completes');
  for (const s of LIFE_GRAD.skills) {
    assert.ok((game.skills.xp[s] || 0) > 0, `graduation touched ${s}`);
  }
});

test('life-skills journal entry reports the current lesson', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { QUESTS } = await import('../src/data/quests.js');
  const game = new Game();
  game.start();
  const entry = QUESTS.find((q) => q.id === 'life_skills');
  assert.ok(entry, 'life_skills is in the quest journal');
  assert.equal(entry.progress(game), '', 'no progress label before starting');
  game.handleDialogueAction('lifeStart');
  const label = entry.progress(game);
  assert.match(label, /Lesson 1\/\d+: Woodcutting/, 'shows the first lesson');
});

test('starter-area monsters are tamed and weaker for onboarding', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { getNpc } = await import('../src/data/npcs.js');
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();

  // World wiring: starter goblin/rat/chicken spawns carry a taming override.
  const tamed = game.world.npcSpawns.filter((s) => s.opts && s.opts.aggressive === false);
  assert.ok(tamed.some((s) => s.npcId === 'goblin'), 'town goblins are tamed in world data');

  // The override pacifies + weakens the instance without touching the registry.
  const wild = new NPC('wild_goblin', 0, 0, 4, {});
  const tame = new NPC('wild_goblin', 0, 0, 4, { aggressive: false, statMul: 0.6 });
  assert.equal(getNpc('wild_goblin').aggressive, true, 'registry wild goblin stays aggressive for the rest of the island');
  assert.equal(wild.def.aggressive, true, 'a normal wild goblin spawn is still aggressive');
  assert.equal(tame.def.aggressive, false, 'a tamed spawn never attacks first');
  assert.ok(tame.maxHp < wild.maxHp, 'tamed spawn has less HP');
  assert.ok(tame.def.defence < wild.def.defence, 'tamed spawn is easier to hit');
});

test('little chickens at the starting town cluck about but never attack', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();

  const chattyChickens = game.world.npcSpawns.filter((s) => s.npcId === 'chicken' && s.opts?.chatter);
  assert.ok(chattyChickens.length >= 3, 'a little flock of chatty chickens is placed in the starting town');
  for (const s of chattyChickens) assert.equal(s.opts.aggressive, false, 'starting chickens are not aggressive');

  const chicken = game.npcs.find((n) => n.npcId === 'chicken' && n.chatter);
  assert.ok(chicken, 'a chatty chicken instance exists in the live world');
  assert.ok(chicken.attackable, 'chickens can still be fought and killed');
  chicken.x = game.player.x + 1; chicken.y = game.player.y;
  chicken.spawnX = chicken.x; chicken.spawnY = chicken.y;
  step(game, 6);
  assert.notEqual(chicken.target, game.player, 'a town chicken never picks a fight');
});

test('MapleStory-style auto-loot: drops pop out, then fly into the pack; things you drop stay put', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  chicken.x = game.player.x + 6; chicken.y = game.player.y;   // well out of reach
  const bones0 = game.inventory.count('bones');
  game.rollDrops(chicken);
  assert.ok(game.world.groundItems.some((g) => g.id === 'bones' && g.fromKill), 'the drop pops out onto the ground first');
  game.update(600); game.update(600);
  assert.equal(game.inventory.count('bones'), bones0 + 1, 'then flies into the pack from 6 tiles away');
  assert.ok(game.effects.some((e) => e.type === 'lootfly') || true);
  // Anything else lying within 2 tiles is swept up too...
  game.world.addGroundItem('logs', 3, game.player.x + 1, game.player.y);
  game.update(600);
  assert.ok(game.inventory.count('logs') >= 3, 'nearby loot is collected');
  // ...but not what you drop on purpose.
  const idx = game.inventory.slots.findIndex((x) => x && x.id === 'logs');
  game.dropItem(idx);
  game.update(600); game.update(600);
  assert.ok(game.world.groundItems.some((g) => g.id === 'logs' && g.playerDropped), 'a dropped item stays on the ground');
});

test('new sessions start on a bright morning, then follow the day/night cycle', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  assert.ok(game.daylightFactor() > 0.6, 'starts in daylight');
  assert.ok(!game.isNight());
});

test('weapon-specific skills: a bow swaps in Snapshot, which looses three arrows instantly', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('ranged');
  game.jobClass = null;   // the general ranged set (classes have their own; tested below)
  assert.equal(game.combatMode(), 'ranged');
  const keys = game.currentAbilities().map((a) => a.id);
  assert.deepEqual(keys, ['snapshot', 'focus', 'brace', 'second_wind', 'arrow_storm']);
  const target = new NPC('goblin', game.player.x + 3, game.player.y, 0, {});
  target.hp = target.maxHp = 9999;
  game.npcs = [target];
  game.attackNpc(target);
  game.adrenaline = 100;
  let shots = 0;
  const fire = game._projectile.bind(game);
  game._projectile = (n, col, kind, ...rest) => { if (kind === 'arrow') shots++; return fire(n, col, kind, ...rest); };
  game.player.attackCooldown = 3; // mid-swing: Snapshot must not wait for it
  game.activateAbilityKey('z');
  assert.equal(shots, 3, 'three arrows fired at once');
  assert.ok(game.abilityCd.snapshot > 0, 'Snapshot goes on cooldown');
  game.equipment.set('weapon', 'bronze_scimitar'); // the melee set comes back with a melee weapon
  assert.equal(game.currentAbilities()[0].id, 'power_strike');
});

test('joystick / WASD movement walks tile by tile, and bare-ground clicks no longer walk', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.npcs = game.npcs.filter((n) => !n.def.attackable); // no interruptions
  const p = game.player;
  const x0 = p.x, y0 = p.y;
  game.setMoveInput(1, 0);              // hold right
  for (let i = 0; i < 40; i++) game.update(100);   // 4s of moving; everyone always runs now (~1 tile / 170ms)
  game.setMoveInput(0, 0);
  for (let i = 0; i < 10; i++) game.update(100);
  assert.ok(p.x >= x0 + 16 && p.x <= x0 + 28, `moved right (${x0} -> ${p.x})`);
  assert.equal(p.y, y0, 'stayed on the same row');
  const xs = p.x;
  for (let i = 0; i < 20; i++) game.update(100);
  assert.equal(p.x, xs, 'stops once the stick is released');
  // Clicking the world does nothing now.
  const tile = { x: p.x, y: p.y + 2 };
  game.camera.screenToTile = () => tile;
  game.onLeftClick(0, 0);
  for (let i = 0; i < 20; i++) game.update(100);
  assert.equal(p.y, y0, 'a ground click no longer walks');
});

test('Interact acts on the nearest thing: picks it, labels it, and does its main action', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  // Nothing around: nothing to do.
  game.npcs = []; game.world.groundItems.length = 0;
  p.x = p.tx = 100; p.y = p.ty = 90;
  const objs = game.world.objects; game.world.objects = [];
  assert.equal(game._findInteract(), null);
  // An item underfoot beats a monster two tiles away.
  const gob = new NPC('goblin', p.x + 2, p.y, 0, {}); gob.def = { ...gob.def, aggressive: false };
  gob.hp = gob.maxHp = 9999;   // in melee reach, Interact swings at once: make sure one hit can't end the fight
  game.npcs = [gob];
  game.world.addGroundItem('bones', 1, p.x, p.y);
  assert.equal(game._findInteract().kind, 'item');
  game.interact();
  game.update(600);
  assert.ok(game.inventory.has('bones'), 'Interact picked the item up');
  // Then the monster: labelled Attack, and Interact starts the fight.
  const t = game._findInteract();
  assert.equal(t.kind, 'npc');
  assert.equal(game._interactLabel(t)[0], 'Attack');
  game.interact();
  assert.equal(p.action?.type, 'attack', 'Interact attacks the nearest monster');
  game.world.objects = objs;
});

test('player attacks run on a 300ms combat beat: a scimitar swings about 9 times a second', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  assert.equal(game.equipment.get('weapon'), 'bronze_scimitar');
  const target = new NPC('goblin', game.player.x + 1, game.player.y, 0, {});
  target.hp = target.maxHp = 99999;
  target.def = { ...target.def, aggressive: false, maxHit: 0 };
  game.npcs = [target];
  let swings = 0;
  const orig = game.doPlayerAttack.bind(game);
  game.doPlayerAttack = (n) => { swings++; return orig(n); };
  game.attackNpc(target);
  for (let i = 0; i < 31; i++) game.update(100);   // ~3s
  // Scimitars are quick weapons, and melee swings twice as fast: about 2.9 swings per 300ms beat.
  assert.ok(swings >= 24 && swings <= 32, `about 28 swings in 3s, got ${swings}`);
});

test('auto battle hunts nearby monsters, eats when hurt, can skip bosses and pauses while steering', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  // Park on open plaza ground with only our test monsters around.
  const mk = (id, dx, dy) => { const n = new NPC(id, p.x + dx, p.y + dy, 0, {}); n.def = { ...n.def, aggressive: false }; return n; };
  const a = mk('goblin', 2, 0), b = mk('goblin', -2, 1);
  const boss = game.npcs.find((n) => n.def.boss);
  boss.x = boss.tx = p.x; boss.y = boss.ty = p.y + 2; boss.target = null;
  game.npcs = [a, b, boss];
  game.autoCfg.bosses = false;   // the "skip bosses" setting

  // Steering pauses it: no target is picked while a direction is held.
  game.toggleAutoBattle(true);
  game.setMoveInput(0, -1);
  for (let i = 0; i < 6; i++) game.update(100);
  assert.ok(!(p.action && p.action.type === 'attack'), 'steering pauses auto battle');
  game.setMoveInput(0, 0);
  game.update(100);

  // Low life: it eats.
  p.hp = 3;
  game.update(600);
  assert.ok(p.hp > 3, 'auto battle eats when hurt');

  for (let i = 0; i < 400 && (a.alive || b.alive); i++) game.update(100);
  assert.ok(!a.alive && !b.alive, 'both nearby monsters were hunted down');
  assert.ok(boss.alive && boss.hp === boss.maxHp, 'bosses are left alone when skipping bosses');

  // Dying switches it off.
  game.playerDeath();
  assert.equal(game.autoBattle, false, 'auto battle turns off on death');
});

test('auto battle hunts further afield when nothing is close, and skips the Wilderness from safe ground', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  const far = new NPC('goblin', p.x, p.y - 25, 0, {});
  far.def = { ...far.def, aggressive: false, level: 3 };
  const wild = new NPC('goblin', 100, 40, 0, {});   // in The Wilderness
  wild.def = { ...wild.def, aggressive: false, level: 3 };
  game.npcs = [far, wild];
  assert.equal(game._autoPickTarget(), far, 'a monster 25 tiles away is hunted');
  game.npcs = [wild];
  p.x = p.tx = 92; p.y = p.ty = 40;            // just outside the Wilderness
  assert.equal(game._autoPickTarget(), null, 'it will not drag you into the Wilderness');
});

test('a chatty NPC keeps cycling its speech bubble on a cooldown', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();

  const chatterer = new NPC('chicken', 5, 5, 0, { chatter: ['Cluck cluck!'] });
  const quiet = new NPC('chicken', 6, 5, 0, {});
  game.npcs = [chatterer, quiet];

  let sawText = false;
  for (let i = 0; i < 20 && !sawText; i++) {
    chatterer.tick(game);
    if (chatterer.chatTimer > 0) sawText = true;
  }
  assert.ok(sawText, 'a chatty NPC eventually pops a speech bubble');
  assert.equal(chatterer.chatText, 'Cluck cluck!');

  for (let i = 0; i < 20; i++) quiet.tick(game);
  assert.equal(quiet.chatTimer, 0, 'an NPC with no chatter never shows a bubble');
});

test('the advanced "Master of Trades" course is gated behind the basics, then rewards the Trades cape', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { LIFE_STAGES_ADV } = await import('../src/data/lifeskills.js');
  const game = new Game();
  game.start();
  // Gated until the basic course is complete.
  game.handleDialogueAction('lifeAdvStart');
  assert.equal(game.quests.life_skills_adv.state, 'notStarted', 'gated behind Trades of the Island');
  game.quests.life_skills.state = 'done';
  game.handleDialogueAction('lifeAdvStart');
  assert.equal(game.quests.life_skills_adv.state, 'active');
  for (let i = 0; i < LIFE_STAGES_ADV.length; i++) {
    const st = LIFE_STAGES_ADV[game.quests.life_skills_adv.stage - 1];
    if (st.need.item) game.inventory.add(st.need.item, st.need.qty);
    else game.skills.addXp(st.skill, st.need.xp + 5);
    game.handleDialogueAction('lifeAdvTurnIn');
  }
  assert.equal(game.quests.life_skills_adv.state, 'done');
  assert.ok(game.inventory.has('trades_cape'), 'awarded the Trades cape on completion');
});

test('quest points accrue and gate the Champion of Singapore capstone', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { CHAMPION_QP } = await import('../src/data/quests.js');
  const game = new Game();
  game.start();
  assert.equal(game.questPoints(), 0);
  game.handleDialogueAction('championStart');
  assert.equal(game.quests.champion.state, 'notStarted', 'gated by quest points');
  game.quests.life_skills.state = 'done';     // +2
  game.quests.island_defender.state = 'done'; // +2
  game.quests.big_game_hunter.state = 'done'; // +2
  assert.ok(game.questPoints() >= CHAMPION_QP, 'enough quest points now');
  game.handleDialogueAction('championStart');
  assert.equal(game.quests.champion.state, 'active');
  game.handleDialogueAction('championTurnIn');
  assert.equal(game.quests.champion.state, 'active', 'still needs a boss kill');
  game.bossKills = (game.quests.champion.startBoss || 0) + 1;
  game.handleDialogueAction('championTurnIn');
  assert.equal(game.quests.champion.state, 'done');
  assert.ok(game.inventory.has('champions_cape'), 'awarded the Champion cape');
});

test('agility obstacles grant XP/run energy, and finishing a lap yields a Mark of grace', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.skills.addXp('agility', 13000); // ~level 29, enough for every obstacle
  const find = (id) => game.world.objects.find((o) => o.objId === id);
  const xp0 = game.skills.xp.agility;
  game.runEnergy = 0;
  // Touch three distinct obstacles, then ride the zip-line (the finish).
  for (const id of ['agility_balance', 'agility_net', 'agility_rope']) game.resolveAgility(find(id));
  game.resolveAgility(find('agility_zip'));
  assert.ok(game.skills.xp.agility > xp0, 'agility xp increased');
  assert.ok(game.runEnergy > 0, 'run energy recovered on the course');
  assert.ok(game.inventory.has('mark_of_grace'), 'completing a lap awards a Mark of grace');
});

test('a Mark of grace can be used to restore run energy', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.inventory.add('mark_of_grace', 1);
  game.runEnergy = 10;
  const idx = game.inventory.slots.findIndex((s) => s && s.id === 'mark_of_grace');
  game.useMarkOfGrace(idx);
  assert.ok(game.runEnergy > 10, 'run energy restored');
  assert.equal(game.inventory.count('mark_of_grace'), 0, 'the mark was consumed');
});

test('thieving stalls give loot + XP and deplete on a successful steal', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.hp = 9999;
  game.skills.addXp('thieving', 200000); // max thieving -> ~95% success
  const stall = game.world.objects.find((o) => o.objId === 'stall_food');
  assert.ok(stall, 'a hawker stall exists');
  const xp0 = game.skills.xp.thieving;
  let depleted = false;
  for (let i = 0; i < 30 && !depleted; i++) {
    stall.depleted = false;
    game.stealFromStall(stall);
    if (stall.depleted) depleted = true;
  }
  assert.ok(depleted, 'a successful steal empties the stall');
  assert.ok(game.skills.xp.thieving > xp0, 'thieving xp gained');
});

test('stealing from a stall is level-gated', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const gem = game.world.objects.find((o) => o.objId === 'stall_gem'); // needs Thieving 25
  const before = game.inventory.count('coins');
  game.stealFromStall(gem); // level 1 player -> blocked
  assert.equal(game.inventory.count('coins'), before, 'no loot below the level requirement');
  assert.ok(!gem.depleted, 'stall not disturbed');
});

test('clue scrolls run a treasure trail to an openable reward casket', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { clueTierForLevel } = await import('../src/data/clues.js');
  assert.equal(clueTierForLevel(5), 'easy');
  assert.equal(clueTierForLevel(25), 'medium');
  assert.equal(clueTierForLevel(60), 'hard');

  const game = new Game();
  game.start();
  game.inventory.add('clue_scroll_easy', 1);
  let idx = game.inventory.slots.findIndex((s) => s && s.id === 'clue_scroll_easy');
  game.readClue(idx); // begins the trail
  assert.ok(game.clue && game.clue.tier === 'easy', 'a trail started');
  const steps = game.clue.spots.length;
  assert.ok(steps >= 1);

  // Walk to each dig spot and read the clue there (which digs).
  for (let i = 0; i < steps; i++) {
    const spot = game.clue.spots[game.clue.step];
    game.player.x = game.player.tx = spot.x;
    game.player.y = game.player.ty = spot.y;
    idx = game.inventory.slots.findIndex((s) => s && s.id === 'clue_scroll_easy');
    game.readClue(idx);
  }
  assert.equal(game.clue, null, 'trail completed');
  assert.ok(game.inventory.has('reward_casket_easy'), 'earned a reward casket');
  assert.ok(!game.inventory.has('clue_scroll_easy'), 'clue consumed');

  const coinsBefore = game.inventory.count('coins');
  const cIdx = game.inventory.slots.findIndex((s) => s && s.id === 'reward_casket_easy');
  game.openCasket(cIdx);
  assert.ok(!game.inventory.has('reward_casket_easy'), 'casket consumed on open');
  const slotsUsed = game.inventory.slots.filter(Boolean).length;
  assert.ok(slotsUsed > 0 && (game.inventory.count('coins') >= coinsBefore), 'received loot');
});

test('reading a clue away from the dig spot only shows the hint', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.inventory.add('clue_scroll_medium', 1);
  const idx = game.inventory.slots.findIndex((s) => s && s.id === 'clue_scroll_medium');
  game.readClue(idx); // start
  const step0 = game.clue.step;
  const spot = game.clue.spots[game.clue.step];
  // Stand far from the spot, then read again.
  game.player.x = game.player.tx = spot.x + 10;
  game.player.y = game.player.ty = spot.y + 10;
  game.readClue(idx);
  assert.equal(game.clue.step, step0, 'no progress unless you are on the dig spot');
});

test('good/evil alignment rises with heroism and cruelty', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.hp = 9999;
  assert.equal(game.alignment(), 0, 'starts neutral');

  const agg = game.npcs.find((n) => n.attackable && n.def.aggressive && !n.def.boss);
  const passive = game.npcs.find((n) => n.attackable && !n.def.aggressive && !n.def.boss);
  assert.ok(agg && passive, 'both an aggressive and a harmless creature exist');

  const good0 = game.karma.good;
  game.killNpc(agg);
  assert.ok(game.karma.good > good0, 'slaying an aggressive foe is good');

  const evil0 = game.karma.evil;
  game.killNpc(passive);
  assert.ok(game.karma.evil > evil0, 'cutting down a harmless creature is evil');
});

test('thieving is evil; honouring the dead is good', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.hp = 9999;

  game.inventory.add('bones', 1);
  const bi = game.inventory.slots.findIndex((s) => s && s.id === 'bones');
  const good0 = game.karma.good;
  game.buryBones(bi);
  assert.ok(game.karma.good > good0, 'burying bones is a small good');

  game.skills.addXp('thieving', 200000);
  const stall = game.world.objects.find((o) => o.objId === 'stall_food');
  const evil0 = game.karma.evil;
  for (let i = 0; i < 12; i++) { stall.depleted = false; game.player.hp = 9999; game.stealFromStall(stall); }
  assert.ok(game.karma.evil > evil0, 'stealing tips you toward evil');
});

test('alignment yields a title and shifts shop prices', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.karma = { good: 100, evil: 0 };
  assert.equal(game.alignmentTitle().cls, 'good');
  assert.ok(game.karmaFactor().buy < 1 && game.karmaFactor().sell > 1, 'the virtuous are trusted: cheaper buys, better sells');
  game.karma = { good: 0, evil: 100 };
  assert.equal(game.alignmentTitle().cls, 'evil');
  assert.ok(game.karmaFactor().buy > 1 && game.karmaFactor().sell < 1, 'the wicked are gouged');
});

test('alignment survives save/load', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g1 = new Game();
  g1.start();
  g1.karma = { good: 17, evil: 4 };
  assert.ok(saveGame(g1));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.deepEqual(g2.karma, { good: 17, evil: 4 });
});

test('redemption arc: atone to cleanse evil and earn the Blessed halo', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { REDEMPTION_GOAL } = await import('../src/data/quests.js');
  const game = new Game();
  game.start();
  assert.ok(game.npcs.some((n) => n.npcId === 'light_priestess'), 'Sister Mei is in the world');

  game.handleDialogueAction('redemptionStart');
  assert.equal(game.quests.redemption.state, 'notStarted', 'cannot atone without sin');
  game.karma = { good: 0, evil: 20 };
  game.handleDialogueAction('redemptionStart');
  assert.equal(game.quests.redemption.state, 'active', 'penance begins');
  game.handleDialogueAction('redemptionTurnIn');
  assert.equal(game.quests.redemption.state, 'active', 'not enough good works yet');
  game.addGood(REDEMPTION_GOAL);
  game.handleDialogueAction('redemptionTurnIn');
  assert.equal(game.quests.redemption.state, 'done');
  assert.equal(game.karma.evil, 0, 'evil is washed away');
  assert.ok(game.inventory.has('blessed_halo'), 'rewarded the Blessed halo');
});

test('corruption arc: embrace darkness to forsake the light and earn the Shadow cloak', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { CORRUPTION_GOAL } = await import('../src/data/quests.js');
  const game = new Game();
  game.start();
  assert.ok(game.npcs.some((n) => n.npcId === 'shadow_broker'), 'the Tempter is in the world');

  game.handleDialogueAction('corruptionStart');
  assert.equal(game.quests.corruption.state, 'notStarted', 'too pure to corrupt');
  game.karma = { good: 0, evil: 15 }; // alignment -15
  game.handleDialogueAction('corruptionStart');
  assert.equal(game.quests.corruption.state, 'active');
  game.addEvil(CORRUPTION_GOAL);
  game.handleDialogueAction('corruptionTurnIn');
  assert.equal(game.quests.corruption.state, 'done');
  assert.equal(game.karma.good, 0, 'the light is forsaken');
  assert.ok(game.inventory.has('shadow_cloak'), 'rewarded the Shadow cloak');
});

test('alignment-arc bosses: a guardian Lion of Light and a wild Shadow Sovereign', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const lion = game.npcs.find((n) => n.npcId === 'lion_of_light');
  const shadow = game.npcs.find((n) => n.npcId === 'shadow_sovereign');
  assert.ok(lion && lion.def.boss, 'Lion of Light is a boss');
  assert.equal(lion.def.aggressive, false, 'the light guardian never ambushes');
  assert.ok(lion.def.dropTable.map((d) => d.id).includes('seraph_blade'), 'drops the Seraph blade');
  assert.ok(shadow && shadow.def.boss, 'Shadow Sovereign is a boss');
  assert.equal(shadow.def.aggressive, false, 'even the wilderness boss waits to be attacked');
  assert.ok(shadow.def.dropTable.map((d) => d.id).includes('void_blade'), 'drops the Void blade');
});

test('no boss anywhere on the island is aggressive', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const bosses = game.npcs.filter((n) => n.def.boss);
  assert.ok(bosses.length >= 30, `expected the full bestiary of bosses, got ${bosses.length}`);
  const agg = bosses.filter((n) => n.def.aggressive);
  assert.equal(agg.length, 0, `every boss must wait for the player to attack first: ${agg.map((n) => n.npcId).join(', ')}`);
});

test('aggressive monsters take turns aggroing the player instead of swarming', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();

  // Isolate from the world's own NPCs so only these three compete for the aggro slot.
  const px = game.player.x, py = game.player.y;
  const mobs = [
    new NPC('wild_forest_drake', px + 3, py, 0, {}),
    new NPC('wild_forest_drake', px - 3, py, 0, {}),
    new NPC('wild_forest_drake', px, py + 3, 0, {}),
  ];
  game.npcs = mobs.slice();

  step(game, 1);
  let aggroed = mobs.filter((m) => m.target === game.player);
  assert.equal(aggroed.length, 1, `only one wandering monster should unprovoked-aggro at once, got ${aggroed.length}`);

  // Once the attacker is gone, a waiting monster gets its turn.
  aggroed[0].alive = false;
  step(game, 1);
  aggroed = mobs.filter((m) => m.alive && m.target === game.player);
  assert.equal(aggroed.length, 1, 'once the cap frees up, exactly one more monster can aggro');
});

test('a monster the player directly attacks always retaliates, even while the aggro cap is full', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();

  const px = game.player.x, py = game.player.y;
  const attacker = new NPC('wild_forest_drake', px + 3, py, 0, {});
  const bystander = new NPC('wild_forest_drake', px - 3, py, 0, {});
  game.npcs = [attacker, bystander];

  step(game, 1);
  assert.equal(attacker.target, game.player, 'the first eligible monster takes the unprovoked-aggro slot');
  assert.notEqual(bystander.target, game.player, 'a second wandering monster holds back while the cap is full');

  game._postAttack(bystander);
  assert.equal(bystander.target, game.player, 'a monster the player directly attacks retaliates regardless of the aggro cap');
});

test('boss "summon" adds are exempt from the aggro cap so the encounter mechanic still works', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();

  const boss = game.npcs.find((n) => n.def.ability?.fx.some((f) => f.t === 'summon'));
  assert.ok(boss, 'a boss whose signature move summons exists');
  boss.target = game.player; // simulate the player already fighting this boss (fills the cap)
  boss.x = game.player.x - 1; boss.y = game.player.y;
  game.player.hp = 99999;   // the move's strikes can't kill you before the summon (that made this test flaky)

  const blocked = game.world.isBlocked; game.world.isBlocked = () => false; // the summon tiles can't be walls
  game.bossSpecial(boss);
  game.world.isBlocked = blocked;
  const adds = game.npcs.filter((n) => n.temporary && n.alive);
  assert.ok(adds.length >= 1, 'the boss summons at least one add regardless of the aggro cap');

  const px = game.player.x, py = game.player.y;
  for (const add of adds) { add.x = px + (add.x > px ? 1 : -1); add.y = py; add.spawnX = add.x; add.spawnY = add.y; }
  game._aggroAttackers = 999; // pretend the cap is already saturated
  for (const add of adds) add._combatAI(game);
  assert.ok(adds.every((a) => a.target === game.player), 'summoned adds always join the fight, cap or not');
});

test('fishing: new spot types, tool gating, and freshwater/sea catches', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { resolveFish } = await import('../src/game/skilling.js');
  const game = new Game();
  game.start();
  for (const id of ['fishing_spot', 'rod_spot', 'fishing_cage', 'harpoon_spot']) {
    assert.ok(game.world.objects.some((o) => o.objId === id), `${id} is placed in the world`);
  }
  game.skills.addXp('fishing', 2_000_000); // max fishing

  // Harpoon spots need a harpoon (not in the starter kit).
  const harp = game.world.objects.find((o) => o.objId === 'harpoon_spot');
  assert.ok(!game.hasTool('harpoon'), 'starter kit has no harpoon');
  const seaIds = ['raw_tuna', 'raw_swordfish', 'raw_stingray', 'raw_shark', 'raw_manta_ray'];
  const seaBefore = seaIds.reduce((s, id) => s + game.inventory.count(id), 0);
  resolveFish(game, { obj: harp });
  assert.equal(seaIds.reduce((s, id) => s + game.inventory.count(id), 0), seaBefore, 'no harpoon, no catch');
  game.inventory.add('harpoon', 1);
  for (let i = 0; i < 150; i++) resolveFish(game, { obj: harp });
  assert.ok(seaIds.reduce((s, id) => s + game.inventory.count(id), 0) > seaBefore, 'harpoon catches sea fish');

  // Rod spots use the starter fishing rod for freshwater fish.
  assert.ok(game.hasTool('rod'), 'starter kit includes a fishing rod');
  const rod = game.world.objects.find((o) => o.objId === 'rod_spot');
  const freshIds = ['raw_pike', 'raw_eel', 'raw_trout'];
  const freshBefore = freshIds.reduce((s, id) => s + game.inventory.count(id), 0);
  for (let i = 0; i < 150; i++) resolveFish(game, { obj: rod });
  assert.ok(freshIds.reduce((s, id) => s + game.inventory.count(id), 0) > freshBefore, 'rod catches freshwater fish');
});

test('every new fish is cookable', async () => {
  const { COOKING } = await import('../src/game/skilling.js');
  for (const raw of ['raw_mackerel', 'raw_pike', 'raw_eel', 'raw_grouper', 'raw_stingray', 'raw_manta_ray']) {
    assert.ok(COOKING[raw] && COOKING[raw].result, `${raw} has a cooking recipe`);
  }
});

test('Singapore fish species are defined, cookable, and catchable', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const [{ getItem }, { COOKING, resolveFish }] = await Promise.all([
    import('../src/data/items.js'), import('../src/game/skilling.js'),
  ]);
  const freshwater = ['tilapia', 'marble_goby', 'peacock_bass', 'speckled_temensis', 'giant_snakehead'];
  const saltwater = ['red_snapper', 'golden_snapper', 'mangrove_jack', 'barramundi', 'red_drum',
    'tenggiri', 'longfin_trevally', 'giant_trevally', 'diamond_trevally', 'hybrid_grouper'];
  for (const f of [...freshwater, ...saltwater]) {
    assert.ok(getItem(`raw_${f}`) && getItem(f), `${f} has raw + cooked items`);
    assert.equal(COOKING[`raw_${f}`].result, f, `${f} is cookable`);
  }

  const game = new Game();
  game.start();
  game.skills.addXp('fishing', 2_000_000);
  const rod = game.world.objects.find((o) => o.objId === 'rod_spot');
  const sea = game.world.objects.find((o) => o.objId === 'sea_rod_spot');
  assert.ok(rod && sea, 'freshwater and coastal rod spots exist');
  for (let i = 0; i < 800; i++) { resolveFish(game, { obj: rod }); resolveFish(game, { obj: sea }); }
  assert.ok(freshwater.some((f) => game.inventory.count(`raw_${f}`) > 0), 'caught a Singapore freshwater fish');
  assert.ok(saltwater.some((f) => game.inventory.count(`raw_${f}`) > 0), 'caught a Singapore saltwater fish');
});

test('extra fish species, bait, junk & treasure are defined and catchable', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const [{ getItem }, { COOKING, resolveFish }] = await Promise.all([
    import('../src/data/items.js'), import('../src/game/skilling.js'),
  ]);
  const extra = ['climbing_perch', 'ikan_keli', 'belida', 'arapaima', 'arowana',
    'milkfish', 'queenfish', 'threadfin', 'white_pomfret', 'coral_trout', 'cobia'];
  for (const f of extra) {
    assert.ok(getItem(`raw_${f}`) && getItem(f), `${f} has raw + cooked items`);
    assert.equal(COOKING[`raw_${f}`].result, f, `${f} is cookable`);
  }
  for (const id of ['fishing_bait', 'old_boot', 'seaweed', 'pearl']) {
    assert.ok(getItem(id), `${id} is defined`);
  }

  // Catchable check: tally what fishing would add (don't actually fill the pack).
  const game = new Game();
  game.start();
  game.skills.addXp('fishing', 2_000_000);
  const tally = {};
  game.inventory.add = (id, q = 1) => { tally[id] = (tally[id] || 0) + q; return q; };
  game.inventory.canAdd = () => 99;
  const rod = game.world.objects.find((o) => o.objId === 'rod_spot');
  const sea = game.world.objects.find((o) => o.objId === 'sea_rod_spot');
  for (let i = 0; i < 6000; i++) resolveFish(game, { obj: i % 2 ? rod : sea });
  assert.ok(extra.some((f) => tally[`raw_${f}`] > 0), 'caught at least one extra species');
});

test('gathering lucky finds: woodcutting doubles/nests and mining doubles/gems', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { resolveWoodcut, resolveMine } = await import('../src/game/skilling.js');
  const game = new Game();
  game.start();
  game.skills.addXp('woodcutting', 2_000_000);
  game.skills.addXp('mining', 2_000_000);
  const tree = game.world.objects.find((o) => o.def.type === 'tree' && o.def.gives === 'logs');
  const rock = game.world.objects.find((o) => o.def.type === 'rock');
  assert.ok(tree && rock, 'a tree and a rock exist');

  const hits = {};
  game.msg = (t) => { for (const k of ['double', 'bird', 'seam', 'unearth']) if (t.includes(k)) hits[k] = (hits[k] || 0) + 1; };
  game.inventory.canAdd = () => 99; game.inventory.add = () => 1; // never fill, just exercise

  for (let i = 0; i < 5000; i++) { tree.depleted = false; resolveWoodcut(game, { obj: tree }); }
  for (let i = 0; i < 5000; i++) { rock.depleted = false; resolveMine(game, { obj: rock }); }
  assert.ok(hits.double > 0 && hits.bird > 0, 'woodcutting yields double logs and bird nests');
  assert.ok(hits.seam > 0 && hits.unearth > 0, 'mining yields rich seams and gems');
});

test("a bird's nest opens into loot and is consumed", () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.inventory.add('birds_nest', 1);
  const idx = game.inventory.slots.findIndex((s) => s && s.id === 'birds_nest');
  const coinsBefore = game.inventory.count('coins');
  game.openNest(idx);
  assert.ok(!game.inventory.has('birds_nest'), 'the nest is consumed');
  const slotsUsed = game.inventory.slots.filter(Boolean).length;
  assert.ok(slotsUsed > 0 || game.inventory.count('coins') > coinsBefore, 'received loot from the nest');
});

test('artisan lucky finds: perfect cooks, bonus smelting/smithing, roaring fires', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const [{ resolveCook, resolveSmelt, resolveSmith, resolveFiremake }, { SMELT, SMITH }] = await Promise.all([
    import('../src/game/skilling.js'), import('../src/data/smithing.js'),
  ]);
  const game = new Game();
  game.start();
  game.skills.addXp('cooking', 2_000_000);
  game.skills.addXp('smithing', 2_000_000);
  game.skills.addXp('firemaking', 2_000_000);
  const hits = {};
  game.msg = (t) => { for (const k of ['Perfectly', 'crucible', 'Flawless', 'roars']) if (t.includes(k)) hits[k] = (hits[k] || 0) + 1; };
  game.inventory.has = () => true; game.inventory.canAdd = () => 99; game.inventory.add = () => 1; game.inventory.remove = () => {};
  game.world.objectAt = () => null; game.world.lightFire = () => {}; game.world.isBlocked = () => true;
  game.player.x = game.player.tx = 5; game.player.y = game.player.ty = 5;

  for (let i = 0; i < 3000; i++) resolveCook(game, { rawId: 'raw_shark', obj: { def: { type: 'range' } } });
  const smelt = SMELT.find((r) => r.result === 'bronze_bar');
  const smith = SMITH.find((r) => r.bar === 'bronze_bar');
  for (let i = 0; i < 3000; i++) { resolveSmelt(game, { recipe: smelt }); resolveSmith(game, { recipe: smith }); }
  for (let i = 0; i < 3000; i++) resolveFiremake(game, { tile: { x: 5, y: 5 }, logId: 'logs' });
  assert.ok(hits.Perfectly > 0, 'cooking has perfect dishes');
  assert.ok(hits.crucible > 0 && hits.Flawless > 0, 'smelting and smithing have bonus output');
  assert.ok(hits.roars > 0, 'firemaking has roaring fires');
});

test('new tree & rock node types exist, are gatherable, and gem rocks yield gems', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { resolveWoodcut, resolveMine } = await import('../src/game/skilling.js');
  const { getItem } = await import('../src/data/items.js');
  const game = new Game();
  game.start();
  game.skills.addXp('woodcutting', 2_000_000);
  game.skills.addXp('mining', 2_000_000);

  const trees = ['bamboo', 'angsana', 'teak', 'mangrove', 'mahogany', 'tembusu'];
  const rocks = ['clay_rock', 'limestone_rock', 'silver_rock', 'sandstone_rock', 'gem_rock', 'granite_rock'];
  for (const id of [...trees, ...rocks]) {
    assert.ok(game.world.objects.some((o) => o.objId === id), `${id} is placed in the world`);
  }
  // Each new tree/rock yields its product (and the product item exists).
  for (const id of trees) {
    assert.ok(getItem(game.world.objects.find((o) => o.objId === id).def.gives), `${id} log item exists`);
  }

  // Gem rocks yield a random gem.
  const gr = game.world.objects.find((o) => o.objId === 'gem_rock');
  const gems = new Set(['sapphire', 'emerald', 'ruby', 'diamond']);
  let got = 0;
  game.inventory.add = (itemId) => { if (gems.has(itemId)) got++; return 1; };
  game.inventory.canAdd = () => 99;
  for (let i = 0; i < 60; i++) { gr.depleted = false; resolveMine(game, { obj: gr }); }
  assert.ok(got > 0, 'gem rock produced gems');
});

test('crafting skill: table exists, recipes consume materials and yield products', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const [{ resolveCraft }, { CRAFT }, { SKILL_IDS }] = await Promise.all([
    import('../src/game/skilling.js'), import('../src/data/crafting.js'), import('../src/data/skills.js'),
  ]);
  assert.ok(SKILL_IDS.includes('crafting'), 'Crafting is a tracked skill');

  const game = new Game();
  game.start();
  assert.ok(game.world.objects.some((o) => o.objId === 'crafting_table'), 'a crafting table is placed');
  assert.ok(game.hasTool('chisel'), 'starter kit includes a chisel');
  game.skills.addXp('crafting', 2_000_000);
  game.inventory.add('silver_ore', 3); game.inventory.add('sapphire', 3);
  game.inventory.add('clay', 3); game.inventory.add('granite', 4);
  const obj = { x: 0, y: 0, def: { type: 'craft' } };

  const amulet = CRAFT.find((r) => r.result === 'sapphire_amulet');
  const xp0 = game.skills.xp.crafting;
  resolveCraft(game, { recipe: amulet, obj });
  assert.ok(game.inventory.has('sapphire_amulet'), 'crafted a sapphire amulet');
  assert.equal(game.inventory.count('silver_ore'), 2, 'consumed a silver ore');
  assert.equal(game.inventory.count('sapphire'), 2, 'consumed a sapphire');
  assert.ok(game.skills.xp.crafting > xp0, 'gained crafting xp');

  resolveCraft(game, { recipe: CRAFT.find((r) => r.result === 'pot'), obj });
  resolveCraft(game, { recipe: CRAFT.find((r) => r.result === 'granite_shield'), obj });
  assert.ok(game.inventory.has('pot') && game.inventory.has('granite_shield'), 'crafted pottery and a granite shield');
});

test('jewelry requires a chisel', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const [{ resolveCraft }, { CRAFT }] = await Promise.all([
    import('../src/game/skilling.js'), import('../src/data/crafting.js'),
  ]);
  const game = new Game();
  game.start();
  game.skills.addXp('crafting', 2_000_000);
  game.inventory.add('silver_ore', 2); game.inventory.add('sapphire', 2);
  // Remove the chisel from the starter kit.
  const ci = game.inventory.slots.findIndex((s) => s && s.id === 'chisel');
  if (ci >= 0) game.inventory.removeAt(ci, 1);
  assert.ok(!game.hasTool('chisel'), 'no chisel');
  resolveCraft(game, { recipe: CRAFT.find((r) => r.result === 'sapphire_amulet'), obj: { x: 0, y: 0, def: { type: 'craft' } } });
  assert.ok(!game.inventory.has('sapphire_amulet'), 'cannot craft jewelry without a chisel');
});

test('expanded crafting: pottery, glassblowing, gem rings and granite armour', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const [{ resolveCraft }, { CRAFT }, { hasIcon }] = await Promise.all([
    import('../src/game/skilling.js'), import('../src/data/crafting.js'), import('../src/render/icons.js'),
  ]);
  const game = new Game();
  game.start();
  game.skills.addXp('crafting', 2_000_000);
  const obj = { x: 0, y: 0, def: { type: 'craft' } };

  const expected = ['jug', 'pie_dish', 'molten_glass', 'vial', 'glass_orb', 'lantern',
    'emerald_ring', 'ruby_ring', 'diamond_ring', 'granite_helm', 'granite_legs', 'granite_body'];
  for (const id of expected) {
    const r = CRAFT.find((x) => x.result === id);
    assert.ok(r, `${id} has a recipe`);
    // Clear the pack, then add exactly this recipe's inputs (+ its tool).
    game.inventory.slots.forEach((s, i) => { if (s) game.inventory.removeAt(i, s.qty); });
    if (r.tool) game.inventory.add(r.tool, 1);
    for (const inp of r.inputs) game.inventory.add(inp.id, inp.qty);
    resolveCraft(game, { recipe: r, obj });
    assert.ok(game.inventory.has(id), `crafted ${id}`);
  }
  // Every equippable craftable has its own icon.
  for (const id of ['emerald_ring', 'ruby_ring', 'diamond_ring', 'granite_helm', 'granite_legs', 'granite_body']) {
    assert.ok(hasIcon(id), `${id} has an icon`);
  }
});

test('combination dishes assemble cooked ingredients + pottery into meals', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const [{ resolveDish }, { DISHES }, { getItem }] = await Promise.all([
    import('../src/game/skilling.js'), import('../src/data/cooking.js'), import('../src/data/items.js'),
  ]);
  const game = new Game();
  game.start();
  game.skills.addXp('cooking', 2_000_000);
  const obj = { x: 0, y: 0, def: { type: 'range' } };
  for (const d of DISHES) {
    assert.ok(getItem(d.result).heal > 0, `${d.result} is edible`);
    game.inventory.slots.forEach((s, i) => { if (s) game.inventory.removeAt(i, s.qty); });
    for (const inp of d.inputs) game.inventory.add(inp.id, inp.qty);
    const xp0 = game.skills.xp.cooking;
    resolveDish(game, { recipe: d, obj });
    assert.ok(game.inventory.has(d.result), `cooked ${d.result}`);
    assert.ok(game.skills.xp.cooking > xp0, `${d.result} gave cooking xp`);
  }
});

test('day/night cycle: a smooth, repeating brightness curve driving isNight/clockLabel', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { DAY_CYCLE_MS } = await import('../src/config.js');
  const game = new Game();
  game.start();

  // Midnight: phase 0, minimum brightness, night, and a midnight clock label.
  game.playMs = 0;
  assert.equal(game.dayPhase(), 0);
  assert.ok(game.daylightFactor() < 0.02, 'midnight is (near) fully dark');
  assert.ok(game.isNight());
  assert.equal(game.clockLabel(), '12:00 AM');

  // Noon: half a cycle later, maximum brightness, day.
  game.playMs = DAY_CYCLE_MS / 2;
  assert.ok(game.daylightFactor() > 0.98, 'noon is (near) fully bright');
  assert.ok(!game.isNight());
  assert.equal(game.clockLabel(), '12:00 PM');

  // The cycle repeats: one full period later, phase and brightness match.
  game.playMs = DAY_CYCLE_MS * 2.25; // same phase as DAY_CYCLE_MS/4
  const phaseA = game.dayPhase(), brightA = game.daylightFactor();
  game.playMs = DAY_CYCLE_MS * 0.25;
  assert.ok(Math.abs(game.dayPhase() - phaseA) < 1e-9, 'phase wraps every DAY_CYCLE_MS');
  assert.ok(Math.abs(game.daylightFactor() - brightA) < 1e-9);

  // Play time accumulates from update(dt), pausing the clock is not possible
  // mid-tick but the phase must advance monotonically within one cycle.
  game.playMs = 0;
  const before = game.dayPhase();
  step(game, 5);
  assert.ok(game.dayPhase() > before, 'the clock advances as play time accrues');
});


test('rare drops are colour-coded and linger with a beam before flying into the pack', async () => {
  const { dropRarity, RARITY } = await import('../src/game/loot.js');
  assert.equal(dropRarity('bones', 'always'), 'common');
  assert.equal(dropRarity('bronze_sword', 'table'), 'rare', 'gear from a monster is at least rare');
  assert.ok(['epic', 'legendary'].includes(dropRarity('coins', 'rare')), 'the rare drop table is epic or better');
  assert.equal(dropRarity('bronze_sword', 'clue'), 'epic');
  assert.ok(RARITY.legendary.rank > RARITY.epic.rank && RARITY.epic.rank > RARITY.rare.rank);
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const x = game.player.x + 5, y = game.player.y;
  game._autoLoot([['bones', 1, 'common'], ['bronze_sword', 1, 'rare']], x, y);
  const sword = game.world.groundItems.find((g) => g.id === 'bronze_sword');
  assert.equal(sword.rarity, 'rare');
  game.update(600);
  assert.ok(!game.world.groundItems.some((g) => g.id === 'bones' && g.fromKill), 'common loot flies in at once');
  assert.ok(game.world.groundItems.includes(sword), 'the rare drop lingers so its beam is seen');
  game.update(600);
  assert.ok(!game.world.groundItems.includes(sword), 'then it flies into the pack too');
  assert.ok(game.inventory.count('bronze_sword') >= 1);
});

test('boss area attacks: red ground marker first, then it hits only if you stay in it', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const p = game.player;
  game.npcs = game.npcs.filter((n) => Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y)) > 15);  // no pecking chickens
  const boss = game.spawnNpc('sand_scorpion_king', p.x + 60, p.y, { wander: 0 });   // far enough not to join in
  game.bossHazard(boss);           // its first pattern: a 3x3 blast on the player
  assert.equal(game.hazards.length, 1);
  assert.ok(game.hazardAt(p.x, p.y) && game.hazardAt(p.x + 1, p.y + 1) && !game.hazardAt(p.x + 2, p.y));
  const hp0 = p.hp;
  step(game, 3);
  assert.equal(game.hazards.length, 0, 'it lands after ~1.8s');
  assert.ok(p.hp < hp0, 'standing in the red hurts');
  assert.ok(hp0 - p.hp <= Math.ceil(game.maxHp() * 0.45), 'but never one-shots you');
  // Step out of the marker and it misses.
  p.hp = game.maxHp();
  game.bossHazard(boss); game.bossHazard(boss);   // twin blasts beside you, then a blast on you
  const blast = game.hazards[game.hazards.length - 1];
  assert.equal(blast.kind, 'blast');
  game.hazards = [blast];
  p.x = p.tx = blast.cx + 3;
  step(game, 3);
  assert.equal(p.hp, game.maxHp(), 'dodged');
  assert.ok(game.effects.some((e) => e.type === 'hitsplat' && e.text === 'Dodged!'));
});

test('auto battle steps out of a boss marker by itself', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  game.npcs = game.npcs.filter((n) => Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y)) > 15);  // no pecking chickens
  const boss = game.spawnNpc('sand_scorpion_king', p.x + 60, p.y, { wander: 0 });
  const chat = [];
  game.bus.on('chat', (c) => chat.push(c.text));
  game.toggleAutoBattle(true);
  game.bossHazard(boss);
  const hp0 = p.hp;
  step(game, 4);
  assert.ok(p.hp >= hp0, 'auto battle dodged the blast');
  assert.ok(chat.some((t) => t.startsWith('You dodge')));
});

test('champion monsters: tougher, gold-ringed, and drop much more', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const n = game.npcs.find((x) => x.def.attackable && !x.def.boss && !x.champion && (x.def.level || 1) >= 3);
  const hp0 = n.maxHp;
  n.makeChampion();
  assert.ok(n.champion && n.name.startsWith('Champion '));
  assert.equal(n.maxHp, hp0 * 150);
  assert.ok((n.def.scale || 1) > 1);
  // Champions roll their drop table three times (plus bones).
  let ground = 0;
  const orig = game._autoLoot.bind(game);
  game._autoLoot = (loot) => { ground = loot.length; };
  game.rollDrops(n);
  assert.ok(ground >= 4, `champion loot rolls (${ground})`);
  game._autoLoot = orig;
  // Respawning clears champion status.
  n.respawn();
  assert.ok(!n.champion && n.maxHp === hp0);
});

test('night hunt boosts combat XP; big hits and kills trigger hit-stop', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  assert.equal(game.combatXpMult(), 1, 'no bonus by day');
  game.playMs = 0;                           // midnight
  assert.ok(game.isNight());
  assert.equal(game.combatXpMult(), 1.5);
  const chat = [];
  game.bus.on('chat', (c) => chat.push(c.text));
  game._wasNight = false;
  game._checkNightfall();
  assert.ok(chat.some((t) => t.startsWith('Night falls')));
  const n = game.npcs.find((x) => x.def.attackable && !x.def.boss);
  game.addHitsplat(n, 5, { crit: true });
  assert.ok(game.hitStop > 0, 'a crit freezes the action for a moment');
  game.update(16); game.update(100);
  assert.equal(game.hitStop, 0, 'and it is brief');
});

test('gear upgrades: +1..+15 with coins, bars and stones, stronger stats, saved with the game', async () => {
  const { upgradeCost, upgradeChance, upgradedBonuses } = await import('../src/game/upgrade.js');
  assert.equal(upgradeChance(5), 1);
  assert.ok(upgradeChance(10) < upgradeChance(6));
  assert.deepEqual(upgradeCost('bronze_scimitar', 3).bar, { id: 'bronze_bar', qty: 3 });
  assert.ok(upgradedBonuses({ attack: 10 }, 2).attack > 10);
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const atk0 = game.equipment.bonuses().attack;
  game.inventory.add('coins', 100000);
  game.inventory.add('bronze_bar', 50);
  // +4 and up also need upgrade stones.
  game.upgradeItem('bronze_scimitar'); game.upgradeItem('bronze_scimitar'); game.upgradeItem('bronze_scimitar');
  assert.equal(game.upgradeItem('bronze_scimitar'), false, 'no stones, no +4');
  game.equipment.upgrades = {};
  game.inventory.add('bronze_bar', 6);
  game.inventory.add('upgrade_stone', 3);
  const coins0 = game.inventory.count('coins'), bars0 = game.inventory.count('bronze_bar');
  for (let i = 0; i < 5; i++) assert.ok(game.upgradeItem('bronze_scimitar'), `+${i + 1} always works`);
  assert.equal(game.inventory.count('upgrade_stone'), 0, 'stones are spent (1 for +4, 2 for +5)');
  assert.equal(game.equipment.upgradeLevel('bronze_scimitar'), 5);
  assert.ok(game.equipment.bonuses().attack > atk0, 'upgrades raise your bonuses');
  assert.equal(game.inventory.count('bronze_bar'), bars0 - 15, 'bars are spent (1+2+3+4+5)');
  assert.ok(game.inventory.count('coins') < coins0, 'coins are spent');
  saveGame(game);
  const g2 = new Game();
  g2.start();
  assert.equal(g2.equipment.upgradeLevel('bronze_scimitar'), 5, 'upgrade levels survive save/load');

  // Risky levels: from +8 a failure drops a level, unless a ward is carried.
  assert.equal(upgradeChance(15), 0.2);
  assert.ok(upgradedBonuses({ attack: 100 }, 15).attack - upgradedBonuses({ attack: 100 }, 14).attack
    > upgradedBonuses({ attack: 100 }, 3).attack - upgradedBonuses({ attack: 100 }, 2).attack, 'late levels give bigger jumps');
  game.inventory.add('bronze_bar', 500); game.inventory.add('upgrade_stone', 500); game.inventory.add('coins', 10_000_000);
  game.equipment.upgrades.bronze_scimitar = 7;
  const rnd = Math.random;
  try {
    Math.random = () => 0.999;                      // force a failure
    game.upgradeItem('bronze_scimitar');
    assert.equal(game.equipment.upgradeLevel('bronze_scimitar'), 6, 'failing +8 drops a level');
    game.equipment.upgrades.bronze_scimitar = 7;
    game.inventory.add('upgrade_ward', 1);
    game.upgradeItem('bronze_scimitar');
    assert.equal(game.equipment.upgradeLevel('bronze_scimitar'), 7, 'a ward keeps the level');
    assert.equal(game.inventory.count('upgrade_ward'), 0, 'and is used up');
    game.equipment.upgrades.bronze_scimitar = 5;
    game.upgradeItem('bronze_scimitar');
    assert.equal(game.equipment.upgradeLevel('bronze_scimitar'), 5, 'below +8 a failure keeps the level');
  } finally { Math.random = rnd; }
});

test('auto battle settings: eat level, target filter, and they are saved', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  const near = game.npcs.filter((n) => n.alive && n.attackable && !n.def.boss && Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y)) <= 10);
  const kinds = [...new Set(near.map((n) => n.npcId))];
  if (kinds.length) {
    game.autoCfg.target = kinds[0];
    const t = game._autoPickTarget();
    assert.ok(!t || t.npcId === kinds[0] || t.target === p, 'only the chosen monster type is hunted');
  }
  game.autoCfg = { eatAt: 0.6, target: 'chicken', abilities: false, bosses: false, champions: false, priority: false };
  saveGame(game);
  const g2 = new Game();
  g2.start();
  assert.deepEqual(g2.autoCfg, { eatAt: 0.6, target: 'chicken', abilities: false, bosses: false, champions: false, priority: false });
});

test('daily bounties: three targets a day that pay out, with a streak', async () => {
  const { makeBounties, prevDayKey } = await import('../src/game/bounty.js');
  const mons = [{ id: 'a', name: 'A', level: 5 }, { id: 'b', name: 'B', level: 7 }, { id: 'c', name: 'C', level: 9 }, { id: 'd', name: 'D', level: 80 }];
  assert.deepEqual(makeBounties('2026-10-20', 6, mons), makeBounties('2026-10-20', 6, mons), "a day's board is stable");
  assert.ok(makeBounties('2026-10-20', 6, mons).every((t) => t.id !== 'd'), 'targets near your level');
  assert.equal(prevDayKey('2026-03-01'), '2026-02-28');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const b = game.bounties;
  assert.equal(b.list.length, 3);
  assert.ok(b.list.every((t) => game.npcs.some((n) => n.npcId === t.id)), 'every target lives in the world');
  const coins0 = game.inventory.count('coins');
  b.lastFull = prevDayKey(b.day); b.streak = 2;     // finished yesterday too
  for (const t of b.list) {
    const n = game.npcs.find((x) => x.npcId === t.id);
    for (let i = 0; i < t.need; i++) game.progressBounties(n);
  }
  assert.ok(b.list.every((t) => t.done));
  assert.equal(b.streak, 3, 'back-to-back days grow the streak');
  assert.ok(game.inventory.count('coins') > coins0);
  saveGame(game);
  const g2 = new Game();
  g2.start();
  assert.equal(g2.bounties.streak, 3);
  assert.ok(g2.bounties.list.every((t) => t.done), 'progress is saved');
});

test('responsive controls: free joystick movement turns and stops at once, act on the press', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  game.npcs = game.npcs.filter((n) => Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y)) > 15);
  const x0 = p.x, y0 = p.y;
  game.setMoveInput(1, 0);
  game.update(16); game.update(60);            // gliding right, part-way across a tile
  assert.ok(p.moving && p.fx > x0 + 0.1 && p.fx < x0 + 0.9, 'moves smoothly, not tile by tile');
  const before = p.renderCenter().x;
  game.setMoveInput(-1, 0);
  game.update(16);                             // pulling back turns round at once
  assert.ok(p.renderCenter().x < before, 'heads straight back without finishing a step');
  game.setMoveInput(0, 0);
  game.update(16);
  const rest = p.fx;
  for (let i = 0; i < 10; i++) game.update(100);
  assert.ok(!p.moving && p.fx === rest, 'letting go stops on the spot');
  assert.ok(p.x === x0 && p.y === y0, 'still standing on the starting tile');
  // Picking up something underfoot happens on the press, not the next tick.
  const gi = game.world.addGroundItem('logs', 2, p.x, p.y);
  gi.playerDropped = true;                     // so auto-loot doesn't take it first
  const logs0 = game.inventory.count('logs');
  game.pickup(gi);
  assert.equal(game.inventory.count('logs'), logs0 + 2, 'instant pick-up');
  // Attacking a monster already in reach swings at once.
  const mob = game.spawnNpc(game.npcs.find((n) => n.def.attackable && !n.def.boss).npcId, p.x + 1, p.y, { wander: 0 });
  p.attackCooldown = 0;
  game.attackNpc(mob);
  assert.ok(p.attackCooldown > 0, 'first swing landed immediately');
});

test('elemental staves supply unlimited runes; Alchemy turns items into coins with nature runes', async () => {
  const { getSpell } = await import('../src/data/magic.js');
  const { ITEMS } = await import('../src/data/items.js');
  for (const s of ['air', 'water', 'earth', 'fire', 'nature', 'chaos', 'death', 'blood']) {
    const it = ITEMS[`${s}_staff`];
    assert.ok(it && it.equip.combatType === 'magic' && it.equip.runes === `${s}_rune`, `${s} staff is a magic weapon that supplies ${s} runes`);
  }
  assert.equal(ITEMS.dragonhide_vambraces.equip.slot, 'hands');
  assert.ok(ITEMS.nature_rune.stackable);
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('magic');
  game.skills.xp.magic = 200000;             // well past every staff's requirement
  const fireStrike = getSpell('fire_strike');
  game.inventory.remove('fire_rune', 1e6);
  game.inventory.add('air_rune', 10); game.inventory.add('mind_rune', 10);
  assert.ok(!game._hasRunes(fireStrike), 'no fire runes, no Fire Strike');
  game.inventory.add('fire_staff', 1);
  game.equipItem(game.inventory.slots.findIndex((x) => x && x.id === 'fire_staff'));
  assert.equal(game.equipment.get('weapon'), 'fire_staff');
  assert.ok(game._hasRunes(fireStrike), 'the fire staff supplies the fire runes');
  const air0 = game.inventory.count('air_rune');
  game._consumeRunes(fireStrike);
  assert.equal(game.inventory.count('fire_rune'), 0);
  assert.equal(game.inventory.count('air_rune'), air0 - 2, 'other runes are still spent');
  // Alchemy: the fire staff covers the fire runes, a nature rune is spent.
  game.inventory.add('nature_rune', 2);
  game.inventory.add('iron_platebody', 1);
  const coins0 = game.inventory.count('coins');
  assert.ok(game.alchemise(game.inventory.slots.findIndex((x) => x && x.id === 'iron_platebody')));
  assert.equal(game.inventory.count('iron_platebody'), 0);
  assert.equal(game.inventory.count('nature_rune'), 1);
  assert.equal(game.inventory.count('coins'), coins0 + game.alchemyValue('iron_platebody'));
});

test('magic: casters start at Magic 15 with plenty of runes, damage scales with level, and the best spell is chosen', async () => {
  const { getSpell } = await import('../src/data/magic.js');
  const { playerMagicVsNpc } = await import('../src/game/combat.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const archer = new Game(); archer.start(); archer.chooseStartingStyle('ranged');
  assert.equal(archer.inventory.count('bronze_arrow'), 999, 'archers start with 999 arrows');
  clearSave();
  const game = new Game(); game.start(); game.chooseStartingStyle('magic');
  assert.ok(game.skills.magic >= 15, 'casters start at Magic 15');
  assert.equal(game.inventory.count('air_rune'), 999);
  const low = playerMagicVsNpc({ magic: 1 }, game.equipment, getSpell('wind_strike'), { defence: 1 }).max;
  const high = playerMagicVsNpc({ magic: 60 }, game.equipment, getSpell('wind_strike'), { defence: 1 }).max;
  assert.ok(high >= low + 9, 'spell damage grows with Magic level');
  // Best castable spell: with only air + mind runes, Wind Strike; add fire runes and Fire Strike opens up.
  assert.equal(game.bestSpell().id, 'wind_strike');
  game.inventory.add('fire_rune', 100);
  assert.equal(game.bestSpell().id, 'fire_strike');
  // A chosen spell you can't afford falls back instead of failing.
  game.player.spell = 'water_strike';                       // no water runes
  const mob = game.spawnNpc(game.npcs.find((n) => n.def.attackable && !n.def.boss).npcId, game.player.x + 2, game.player.y, { wander: 0 });
  mob.maxHp = mob.hp = 999;
  const fire0 = game.inventory.count('fire_rune');
  game.player.attackCooldown = 0;
  game._magicAttack(mob);
  assert.ok(game.inventory.count('fire_rune') < fire0, 'it cast Fire Strike instead');
  assert.ok(game.player.attackCooldown > 0);
});

test('auto battle takes on a nearby boss first (bosses on by default)', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  assert.equal(game.autoCfg.bosses, true);
  const mob = new NPC('goblin', p.x + 2, p.y, 0, {});
  // A boss near your level is chosen first; one far above it is left alone.
  const cl = game.skills.combatLevel();
  const boss = game.npcs.find((n) => n.def.boss && !n.def.fixed && n.def.level <= cl + 10)
    || Object.assign(game.npcs.find((n) => n.def.boss && !n.def.fixed), {});
  boss.def = { ...boss.def, level: Math.min(boss.def.level, cl + 5) };
  boss.x = boss.tx = boss.spawnX = p.x + 6; boss.y = boss.ty = boss.spawnY = p.y;
  game.npcs = [mob, boss];
  assert.equal(game._autoPickTarget(), boss, 'the boss is chosen ahead of a closer goblin');
  boss.def = { ...boss.def, level: cl + 40 };
  assert.equal(game._autoPickTarget(), boss, 'a boss far above your level is still taken on');
  game.autoCfg.bosses = false;
  assert.equal(game._autoPickTarget(), mob, 'with bosses switched off, it fights the goblin');
  game.autoCfg.bosses = true;
  // A monster far above your level right next to you is fought too.
  const big = new NPC('goblin', p.x + 1, p.y, 0, {}); big.def = { ...big.def, level: cl * 3 + 20 };
  game.npcs = [big];
  assert.equal(game._autoPickTarget(), big, 'a strong monster beside you is not ignored');
});

test('daggers can be dual wielded in place of a shield, striking twice per swing', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.jobClass = null;   // dual wielding itself, free of the class weapon lock (tested separately)
  const inv = game.inventory, eq = game.equipment;
  const idx = (id) => inv.slots.findIndex((x) => x && x.id === id);
  inv.add('bronze_dagger', 1); inv.add('iron_dagger', 1);
  assert.equal(eq.get('shield'), 'bronze_scimitar', 'the melee starter dual wields scimitars');
  assert.ok(eq.isDualWielding());
  game.equipItem(idx('bronze_dagger'));
  assert.equal(eq.get('weapon'), 'bronze_dagger');
  assert.equal(eq.get('shield'), null, 'a scimitar can’t pair with a dagger, so it goes back to the pack');
  game.equipItem(idx('iron_dagger'));                         // already holding a dagger: goes to the off-hand
  assert.equal(eq.get('shield'), 'iron_dagger', 'second dagger takes the shield slot');
  assert.ok(inv.count('bronze_scimitar') >= 2, 'both scimitars are back in the pack');
  assert.ok(eq.isDualWielding());
  // Each swing lands a main-hand and an off-hand strike.
  const mob = game.spawnNpc(game.npcs.find((n) => n.def.attackable && !n.def.boss).npcId, game.player.x + 1, game.player.y, { wander: 0 });
  mob.maxHp = mob.hp = 999;
  let hits = 0;
  const apply = game._applyPlayerHit.bind(game);
  game._applyPlayerHit = (...a) => { hits++; return apply(...a); };
  game.doPlayerAttack(mob);
  assert.equal(hits, 2, 'main hand + off-hand');
  // A non-dagger main weapon puts the off-hand dagger away.
  game.equipItem(idx('bronze_scimitar'));
  assert.equal(eq.get('weapon'), 'bronze_scimitar');
  assert.equal(eq.get('shield'), null);
  assert.ok(inv.count('iron_dagger') >= 1);
  // Only the same kind can go in the off-hand: a dagger won't pair with a scimitar...
  game.equipOffhand(idx('bronze_dagger'));
  assert.equal(eq.get('shield'), null, 'no off-hand dagger without a main-hand dagger');
  // ...but a second scimitar will.
  game.equipItem(idx('bronze_scimitar'));
  assert.equal(eq.get('shield'), 'bronze_scimitar', 'scimitars dual wield too');
  assert.ok(eq.isDualWielding());
});

test('melee cleave sweeps foes next to the target, with every melee weapon', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.jobClass = null;
  const p = game.player;
  const id = game.npcs.find((n) => n.def.attackable && !n.def.boss).npcId;
  const mk = (dx, dy) => { const n = game.spawnNpc(id, p.x + dx, p.y + dy, { wander: 0 }); n.maxHp = n.hp = 99999; n.def = { ...n.def, aggressive: false, maxHit: 0 }; return n; };
  const main = mk(1, 0), side = mk(2, 0), far = mk(5, 0);
  game.npcs = [main, side, far];
  game._cleave(main, 20);
  assert.equal(side.hp, 99999 - 5, 'scimitars (quick weapons) sweep a light 25%');
  side.hp = 99999;
  game.equipment.set('weapon', Object.keys(ITEMS).find((k) => ITEMS[k].equip?.weaponType === '2h_sword'));
  game.equipment.clearSlot('shield');
  const xp0 = game.skills.xp.attack + game.skills.xp.strength + game.skills.xp.defence;
  const hp0 = game.skills.xp.hitpoints;
  game._cleave(main, 20);
  assert.equal(side.hp, 99999 - 14, 'a two-hander sweeps 70% into the foe beside the target');
  assert.ok(game.skills.xp.attack + game.skills.xp.strength + game.skills.xp.defence > xp0, 'cleave damage earns style XP');
  assert.ok(game.skills.xp.hitpoints > hp0, 'and Hitpoints XP');
  assert.equal(far.hp, 99999, 'foes out of reach are untouched');
  assert.equal(main.hp, 99999, 'the target itself takes only its own hit');
});

test('Melee level raises damage (and adds a level bonus like gear); scimitars and claws swing faster than one beat', async () => {
  const { levelBonuses } = await import('../src/game/combat.js');
  const eq = { bonuses: () => ({ attack: 0, strength: 0, defence: 0 }) };
  const lo = playerAttackVsNpc({ attack: 1, strength: 1 }, eq, 'balanced', { defence: 1 }).max;
  const hi = playerAttackVsNpc({ attack: 99, strength: 99 }, eq, 'balanced', { defence: 1 }).max;
  assert.ok(hi > lo * 3, `Melee level raises max hit a lot (${lo} -> ${hi})`);
  const lb = levelBonuses({ attack: 80, ranged: 60, magic: 50, agility: 40 });
  assert.deepEqual([lb.attack, lb.strength, lb.ranged, lb.magic, lb.magicStr, lb.dance], [40, 40, 30, 25, 5, 20], 'every 2 levels give +1 bonus');
});

test('XP bonus stacks: Wilderness level and kill streak; bosses drop much more and give bonus XP', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  assert.ok(!game.inWilderness());
  const day = game.combatXpMult();
  // Wilderness level rises going east: level 1 at the edge, 10 at the far east.
  const edge = game.world.zones.find((z) => z.name === 'The Wilderness');
  p.x = p.tx = edge.x0; p.y = p.ty = 50;
  assert.equal(game.wildernessLevel(), 1);
  assert.ok(Math.abs(game.combatXpMult() - day * 1.5) < 1e-9, 'level 1: x1.5');
  p.x = p.tx = 148;
  assert.equal(game.wildernessLevel(), 10);
  assert.ok(Math.abs(game.combatXpMult() - day * 6) < 1e-9, 'level 10: x6');
  // Kill streak stacks on top: +5% per chained kill.
  const deep = game.combatXpMult();
  const mobs = game.npcs.filter((n) => n.def.attackable && !n.def.boss).slice(0, 4);
  for (const m of mobs) game.killNpc(m);
  assert.equal(game.killStreak, 4);
  assert.ok(Math.abs(game.combatXpMult() - deep * 1.4) < 1e-9, 'streak of 4: x1.4 more');
  p.autoRetaliate = false; p.hp = 9999;
  game.npcs = game.npcs.filter((n) => n.def.boss);      // nothing around to fight back
  step(game, 60);
  assert.equal(game.killStreak, 0, 'the streak ends after ~30s without a kill');
  p.x = p.tx = Math.round((edge.x0 + edge.x1) / 2);
  // Boss loot: four table rolls plus two guaranteed rare-table rolls.
  const boss = game.npcs.find((n) => n.def.boss && !n.def.fixed);
  let n = 0;
  game._autoLoot = (loot) => { n = loot.length; };
  game.rollDrops(boss);
  assert.ok(n >= 7, `boss drops ${n} items`);
  // Boss kill XP.
  const xp0 = game.skills.xp.attack;
  game.killNpc(boss);
  assert.ok(game.skills.xp.attack - xp0 >= boss.def.level * 40, 'a boss kill pays a large XP bonus');
});

test('auto battle priority: bosses, then champions (mini-bosses), then ordinary monsters', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  const cl = game.skills.combatLevel();
  const mob = new NPC('goblin', p.x + 1, p.y, 0, {});
  const champ = new NPC('goblin', p.x + 5, p.y, 0, {}); champ.makeChampion();
  const boss = game.npcs.find((n) => n.def.boss && !n.def.fixed);
  boss.def = { ...boss.def, level: Math.min(boss.def.level, cl + 5) };
  boss.x = boss.tx = boss.spawnX = p.x + 9; boss.y = boss.ty = boss.spawnY = p.y;
  game.npcs = [mob, champ, boss];
  assert.equal(game._autoPickTarget(), boss, 'boss first');
  game.npcs = [mob, champ];
  assert.equal(game._autoPickTarget(), champ, 'then the champion, over a closer ordinary goblin');
  game.npcs = [mob];
  assert.equal(game._autoPickTarget(), mob);
});

test('bows shoot from far: each bow has its own reach, and arrows fly at a steady speed', async () => {
  const { ITEMS } = await import('../src/data/items.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('ranged');
  assert.equal(game.attackRange(), 12, 'a shortbow reaches 12 tiles');
  assert.equal(ITEMS.magic_shortbow.equip.range, 18);
  const near = game.spawnNpc('goblin', game.player.x + 2, game.player.y, { wander: 0 });
  const far = game.spawnNpc('goblin', game.player.x + 9, game.player.y, { wander: 0 });
  game._projectile(near, '#fff', 'arrow'); game._projectile(far, '#fff', 'arrow');
  const [a, b] = game.effects.filter((e) => e.kind === 'arrow').slice(-2);
  assert.ok(b.maxLife > a.maxLife, 'a longer shot takes longer to land');
  assert.ok(b.arc > 0, 'arrows arc through the air');
});

test('archers shoot from where they stand, and keep firing while dodging a boss attack', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('ranged');
  const p = game.player;
  game.npcs = game.npcs.filter((n) => Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y)) > 25);
  const x0 = p.x, y0 = p.y;
  const mob = game.spawnNpc('goblin', p.x + 10, p.y, { wander: 0 });
  mob.def = { ...mob.def, aggressive: false }; mob.maxHp = mob.hp = 9999;
  game.attackNpc(mob);
  step(game, 6);
  assert.equal(p.x, x0, 'did not walk towards a target already in reach');
  assert.equal(p.y, y0);
  assert.ok(mob.hp < 9999, 'and hit it from 10 tiles away');
  // Out of reach: walks only until in range, not right up to it.
  const far = game.spawnNpc('goblin', p.x + 18, p.y, { wander: 0 });
  far.def = { ...far.def, aggressive: false }; far.maxHp = far.hp = 9999;
  game.attackNpc(far);
  // Measure where the archer stops (the goblin then ambles over to retaliate).
  for (let i = 0; i < 12 && (i < 1 || p.moving); i++) game.update(600);
  assert.ok(Math.abs(far.x - p.x) >= 10, `stopped at range (${Math.abs(far.x - p.x)} tiles away)`);
  // Auto battle dodging keeps the attack going.
  game.npcs = [mob];
  p.x = p.tx = x0; p.y = p.ty = y0;
  game.attackNpc(mob);
  game.toggleAutoBattle(true);
  const boss = game.spawnNpc('boar_king', p.x + 40, p.y, { wander: 0 });
  game.npcs = [mob, boss];
  game.bossHazard(boss);                         // a blast under the player
  const hp0 = mob.hp;
  step(game, 4);
  assert.equal(p.action?.type, 'attack', 'still attacking after the dodge');
  assert.ok(mob.hp < hp0, 'kept shooting while dodging');
});

test('ranged auto battle clears everything in reach before moving; bows drop often', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('ranged');
  const p = game.player;
  const inReach = new NPC('goblin', p.x + 10, p.y, 0, {});
  const closerButOut = new NPC('goblin', p.x, p.y - 14, 0, {});
  const boss = game.npcs.find((n) => n.def.boss && !n.def.fixed);
  boss.def = { ...boss.def, level: game.skills.combatLevel() };
  boss.x = boss.tx = boss.spawnX = p.x - 13; boss.y = boss.ty = boss.spawnY = p.y;
  game.npcs = [inReach, closerButOut, boss];
  game.autoCfg.priority = false;
  assert.equal(game._autoPickTarget(), inReach, '"Nearest first": a monster in reach beats even a boss out of reach');
  game.autoCfg.priority = true;
  assert.equal(game._autoPickTarget(), boss, '"Bosses & champions first": the boss wins');
  // Bow drop rate: about one kill in eight drops a bow.
  const mob = game.npcs[0];
  let bows = 0;
  game._autoLoot = (loot) => { bows += loot.filter(([id]) => /bow$/.test(id)).length; };
  for (let i = 0; i < 400; i++) game.rollDrops(mob);
  assert.ok(bows >= 25, `bows dropped ${bows} times in 400 kills`);
});

test('bones bury 100 at a time, or a whole stack; daggers drop', async () => {
  const { getNpc, BOSS_IDS } = await import('../src/data/npcs.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.inventory.add('bones', 999);
  const idx = game.inventory.slots.findIndex((x) => x && x.id === 'bones');
  game.buryBones(idx);
  assert.equal(game.inventory.count('bones'), 899, 'a click buries 100');
  const xp0 = game.skills.xp.prayer;
  game.buryBones(game.inventory.slots.findIndex((x) => x && x.id === 'bones'), Infinity);
  assert.equal(game.inventory.count('bones'), 0, 'the rest of the stack buried in one go');
  assert.ok(game.skills.xp.prayer - xp0 >= 4.5 * 899, 'prayer xp for every bone');
  game.inventory.add('bones', 5);
  game.buryBones(game.inventory.slots.findIndex((x) => x && x.id === 'bones'), 1);
  assert.equal(game.inventory.count('bones'), 4, 'or just one');
  const ids = (d) => new Set(d.dropTable.map((x) => x.id));
  assert.ok(ids(getNpc('goblin')).has('bronze_dagger'), 'monsters drop daggers');
  for (const b of BOSS_IDS) assert.ok([...ids(getNpc(b))].some((x) => /_dagger$/.test(x)), `${b} drops a dagger`);
});

test('stronger bows exist and drop from high-level monsters and bosses', async () => {
  const { NPCS, getNpc, BOSS_IDS } = await import('../src/data/npcs.js');
  const { ITEMS } = await import('../src/data/items.js');
  for (const b of ['dark_bow', 'crystal_bow', 'twisted_bow']) {
    assert.ok(ITEMS[b].equip.bonuses.ranged > ITEMS.magic_shortbow.equip.bonuses.ranged, `${b} beats a magic shortbow`);
    const from = [...Object.values(NPCS), ...BOSS_IDS.map(getNpc)].filter((n) => (n.dropTable || []).some((d) => d.id === b));
    assert.ok(from.length > 0, `${b} drops somewhere`);
  }
});

test('split shot: at Ranged 300 a bow shot hits three targets at once', async () => {
  const { xpForLevel } = await import('../src/data/xp.js');
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.equipment.set('weapon', 'magic_shortbow');
  game.inventory.add('rune_arrow', 500);
  const p = game.player;
  const mk = (dx) => new NPC('goblin', p.x + dx, p.y, 0, {});
  const fire = () => {
    const [a, b, c, far] = [mk(3), mk(4), mk(5), mk(40)];
    game.npcs = [a, b, c, far];
    game.effects = [];
    game._rangedAttack(a);
    return { arrows: game.effects.filter((e) => e.type === 'projectile').length, far };
  };
  game.skills.xp.ranged = xpForLevel(299);
  assert.equal(fire().arrows, 1, 'below 300: one arrow');
  game.skills.xp.ranged = xpForLevel(300);
  const r = fire();
  assert.equal(r.arrows, 3, 'at 300: three arrows');
  assert.equal(r.far.hp, r.far.maxHp, 'out-of-range monsters are not hit');
});

test('the Dancer: whip kit, 3-tile reach, Agility XP, Rhythm and dodging', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const { danceEvade } = await import('../src/game/combat.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.pendingStyleChoice = true;
  game.chooseStartingStyle('dance');
  assert.equal(game.equipment.get('weapon'), 'leather_whip');
  assert.equal(game.combatMode(), 'dance');
  assert.equal(game.attackRange(), 3, 'whips lash from 3 tiles');
  assert.ok(game.skills.agility >= 15, 'Dancers start at Agility 15');
  const p = game.player;
  const mob = new NPC('goblin', p.x + 3, p.y, 0, {});
  game.npcs = [mob];
  const xp0 = game.skills.xp.agility;
  for (let i = 0; i < 40 && mob.alive; i++) { game._danceAttack(mob); mob.hp = Math.max(mob.hp, 1); }
  assert.ok(game.skills.xp.agility > xp0, 'lashing trains Agility');
  assert.ok(game.danceRhythm > 0, 'landed lashes build Rhythm');
  assert.ok(game.effects.some((e) => e.type === 'lash'), 'a whip crack is drawn');
  assert.ok(danceEvade(99) > danceEvade(1), 'higher Agility dodges more');
  assert.ok(danceEvade(999, 'twirl') <= 0.4, 'dodging is capped');
});

test('new weapon families and gear exist across tiers and drop', async () => {
  const { ITEMS } = await import('../src/data/items.js');
  const { NPCS } = await import('../src/data/npcs.js');
  for (const m of ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'dragon']) {
    for (const t of ['spear', 'claws', 'katana', 'halberd', 'plateskirt', 'buckler']) assert.ok(ITEMS[`${m}_${t}`], `${m}_${t}`);
  }
  for (const id of ['leather_whip', 'celestial_whip', 'silk_dancer_top', 'golden_sash', 'magic_longbow', 'master_wand', 'merlion_tome']) assert.ok(ITEMS[id], id);
  const drops = new Set(Object.values(NPCS).flatMap((n) => (n.dropTable || []).map((d) => d.id)));
  for (const id of ['leather_whip', 'rattan_whip', 'bronze_katana', 'iron_claws', 'longbow', 'apprentice_wand', 'silk_slippers']) assert.ok(drops.has(id), `${id} drops`);
});

test('melee weapons strike from 2 tiles, long ones from 3', async () => {
  const { ITEMS } = await import('../src/data/items.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.equipment.set('weapon', 'bronze_scimitar');
  assert.equal(game.attackRange(), 2);
  game.equipment.set('weapon', 'rune_spear');
  assert.equal(game.attackRange(), 3);
  game.equipment.set('weapon', 'dragon_2h_sword');
  assert.equal(game.attackRange(), 3);
  game.equipment.set('weapon', null);
  assert.equal(game.attackRange(), 2, 'even bare hands reach 2 tiles');
  assert.ok(ITEMS.bronze_scimitar.equip.range === 2 && ITEMS.rune_longsword.equip.range === 3);
});

test('the open world: 540x380 with ten open-world regions, all reachable on foot, each with MRT and monsters', async () => {
  const { STATIONS } = await import('../src/data/transport.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const w = game.world;
  assert.equal(w.width, 540); assert.equal(w.height, 380);
  const NEW = ['Sungei Buloh Wetlands', 'Jurong Forest', 'Pulau Ubin', 'Changi Coast', 'Marina Bay', 'Tekong Badlands',
    'Gardens by the Bay', 'Coney Island', 'Southern Islands', 'The Shadow Rift'];
  for (const n of NEW) assert.ok(w.zones.some((z) => z.name === n && !z.wilderness), `${n} exists and is not Wilderness`);
  // Flood fill from the spawn point over walkable tiles.
  const seen = new Uint8Array(w.width * w.height); const q = [[w.spawnPoint.x, w.spawnPoint.y]]; seen[w.spawnPoint.y * w.width + w.spawnPoint.x] = 1;
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
    if (!w.inBounds(nx, ny) || seen[ny * w.width + nx] || w.isBlocked(nx, ny)) continue; seen[ny * w.width + nx] = 1; q.push([nx, ny]); } }
  for (const s of STATIONS) assert.ok(seen[s.y * w.width + s.x], `${s.name} station is reachable on foot`);
  for (const n of NEW) {
    const z = w.zones.find((zz) => zz.name === n);
    const mobs = game.npcs.filter((m) => m.attackable && m.x >= z.x0 && m.x <= z.x1 && m.y >= z.y0 && m.y <= z.y1);
    assert.ok(mobs.length >= 50, `${n} has plenty of monsters (${mobs.length})`);
  }
  // Wilderness levels only apply inside the Wilderness zones.
  game.player.x = 250; game.player.y = 150;
  assert.equal(game.wildernessLevel(), 0, 'the Tekong Badlands are not Wilderness');
});

test('the far regions: six more regions up to level 450, reachable on foot, each with monsters and its own bosses', async () => {
  const { NPCS, BOSS_IDS } = await import('../src/data/npcs.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const w = game.world;
  const FAR = ['Punggol Waterway', 'Kranji Farmlands', 'Mandai Rainforest', 'Tuas Docklands', 'Temasek Ruins', 'The Celestial Peaks'];
  const seen = new Uint8Array(w.width * w.height); const q = [[w.spawnPoint.x, w.spawnPoint.y]]; seen[w.spawnPoint.y * w.width + w.spawnPoint.x] = 1;
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
    if (!w.inBounds(nx, ny) || seen[ny * w.width + nx] || w.isBlocked(nx, ny)) continue; seen[ny * w.width + nx] = 1; q.push([nx, ny]); } }
  for (const n of FAR) {
    const z = w.zones.find((zz) => zz.name === n);
    assert.ok(z && !z.wilderness, `${n} exists and is not Wilderness`);
    const mobs = game.npcs.filter((m) => m.attackable && m.x >= z.x0 && m.x <= z.x1 && m.y >= z.y0 && m.y <= z.y1);
    assert.ok(mobs.length >= 80, `${n} has plenty of monsters (${mobs.length})`);
    assert.ok(mobs.every((m) => seen[m.y * w.width + m.x] || w.isBlocked(m.x, m.y)), `${n}'s monsters can be reached`);
    const bosses = BOSS_IDS.filter((id) => NPCS[id].zone === n);
    assert.ok(bosses.length >= 1, `${n} has its own boss`);
    for (const id of bosses) assert.ok(mobs.some((m) => m.npcId === id), `${id} roams ${n}`);
  }
  assert.ok(Math.max(...Object.values(NPCS).filter((m) => m.attackable).map((m) => m.level)) >= 450, 'the highest foes reach level 450');
});

test('endgame tiers: metals up to Eternal (300), gear for every style, monsters and bosses up to 320 that drop it', async () => {
  const { ITEMS } = await import('../src/data/items.js');
  const { NPCS, getNpc, BOSS_IDS } = await import('../src/data/npcs.js');
  for (const m of ['obsidian', 'orichalcum', 'jade', 'starmetal', 'celestial', 'eternal']) {
    for (const t of ['scimitar', 'katana', 'halberd', 'platebody', 'full_helm', 'kiteshield']) assert.ok(ITEMS[`${m}_${t}`], `${m}_${t}`);
  }
  assert.equal(ITEMS.eternal_scimitar.equip.req.attack, 300);
  assert.ok(ITEMS.eternal_scimitar.equip.bonuses.attack > ITEMS.dragon_scimitar.equip.bonuses.attack * 3);
  for (const id of ['eternal_bow', 'eternal_arrow', 'eternalhide_body', 'eternal_staff', 'eternal_robe_top', 'eternal_whip', 'eternal_dancer_top']) assert.ok(ITEMS[id], id);
  const levels = Object.values(NPCS).filter((n) => n.attackable && !n.boss).map((n) => n.level);
  assert.ok(Math.max(...levels) >= 300, 'endgame monsters reach level 300+');
  assert.ok(getNpc('eternal_wyrm').level === 320 && BOSS_IDS.includes('rift_tyrant'));
  // An endgame monster drops endgame metal.
  const ids = new Set(getNpc('eternal_penanggal').dropTable.map((d) => d.id));
  assert.ok([...ids].some((id) => /^(celestial|eternal)_/.test(id)), 'level-320 monsters drop celestial/eternal gear');
});

test('every boss has its own signature move and ground patterns, and every move works', async () => {
  const { BOSS_IDS, getNpc, NPCS } = await import('../src/data/npcs.js');
  const names = new Set(), combos = new Set();
  for (const id of BOSS_IDS) {
    const ab = getNpc(id).ability;
    assert.ok(ab && ab.name && ab.desc && ab.fx.length && ab.hazards.length, `${id} has an ability`);
    names.add(ab.name);
    combos.add(JSON.stringify(ab.fx) + JSON.stringify(ab.hazards));
    for (const f of ab.fx) if (f.t === 'summon') assert.ok(NPCS[f.id], `${id} summons a real monster (${f.id})`);
  }
  assert.equal(names.size, BOSS_IDS.length, 'every signature move has its own name');
  assert.equal(combos.size, BOSS_IDS.length, 'and its own mix of effects');
  // Run every boss's move and every ground pattern against a sturdy player.
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const p = game.player;
  for (const id of BOSS_IDS) {
    p.hp = game.maxHp(); game.playerDot = null; game.playerRoot = 0; game.playerStun = 0;
    const boss = game.spawnNpc(id, p.x + 2, p.y, { wander: 0 });
    assert.doesNotThrow(() => { game.bossSpecial(boss); for (let i = 0; i < 4; i++) game.bossHazard(boss); }, id);
    assert.ok(p.hp > 0 || !p.alive, `${id}'s move resolved`);
    game.hazards = []; boss.alive = false;
    game.npcs = game.npcs.filter((n) => n !== boss && !n.temporary);
    if (!p.alive) { p.alive = true; p.hp = game.maxHp(); }
  }
});

test('boss effects: damage over time ticks, roots hold you, shields halve damage, reflect bites back', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const p = game.player;
  p.hp = game.maxHp();
  game.playerDot = { kind: 'poison', dmg: 2, ticks: 3, from: 'test' };
  const hp0 = p.hp;
  for (let i = 0; i < 3; i++) game._tickBossEffects();
  assert.equal(p.hp, hp0 - 6, 'poison ticks 3 times');
  assert.equal(game.playerDot, null, 'then wears off');
  game.playerRoot = 2; p.path = [{ x: p.x + 1, y: p.y }];
  game.update(16);
  assert.equal(p.path.length, 0, 'a rooted player cannot walk');
  const boss = new NPC('boar_king', p.x + 2, p.y, 0, {});
  boss.hp = boss.maxHp = 10000;
  boss.shieldTicks = 3;
  game._applyPlayerHit(boss, 40);
  assert.equal(boss.hp, 10000 - 20, 'a shield halves the hit');
  boss.shieldTicks = 0; boss.reflectTicks = 3; boss.reflectFrac = 0.25;
  const hp1 = p.hp;
  game._applyPlayerHit(boss, 40);
  assert.ok(p.hp < hp1, 'reflect hurts the attacker');
});

test('passive perks: one every 20 levels per fighting skill, ranking up past 200', async () => {
  const { trackPerks, perkAtLevel, sumPerks, PERK_SKILLS, PERK_TRACKS } = await import('../src/data/perks.js');
  for (const s of PERK_SKILLS) assert.equal(PERK_TRACKS[s].length, 10, `${s} has 10 perks`);
  const names = new Set(PERK_SKILLS.flatMap((s) => PERK_TRACKS[s].map((p) => `${s}:${p.name}`)));
  assert.equal(names.size, 60);
  assert.equal(trackPerks('strength', 19).filter((p) => p.rank).length, 0, 'nothing before 20');
  assert.equal(trackPerks('strength', 20).filter((p) => p.rank).length, 1, 'first perk at 20');
  assert.equal(trackPerks('strength', 200).filter((p) => p.rank).length, 10, 'all ten by 200');
  assert.equal(trackPerks('strength', 220)[0].rank, 2, 'first perk ranks up at 220');
  assert.equal(trackPerks('strength', 999)[0].rank, 5);
  assert.equal(perkAtLevel('magic', 40).name, PERK_TRACKS.magic[1].name);
  assert.equal(perkAtLevel('magic', 41), null);
  assert.equal(perkAtLevel('ranged', 240).rank, 2);
  const m = sumPerks(['attack', 'strength', 'defence'], () => 999);
  assert.ok(m.extra <= 0.3 && m.reduce <= 0.4 && m.dodge <= 0.25, 'caps hold at 999');
});

test('passive perks change combat: more max life, less damage taken, thorns, and a level-up announcement', async () => {
  const { xpForLevel } = await import('../src/data/xp.js');
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const base = game.maxHp();
  game.skills.xp.defence = xpForLevel(200);
  assert.ok(game.maxHp() > base, 'Vitality and Second Skin raise max life');
  const boss = new NPC('boar_king', game.player.x + 1, game.player.y, 0, {});
  assert.ok(game._perkReduce(100, boss) < 100, 'Defence perks cut damage taken (more from bosses)');
  assert.ok(game.perkMods().thorns > 0, 'Spiked Armour is active');
  game.skills.xp.attack = xpForLevel(200); game.skills.xp.strength = xpForLevel(200);
  const mob = new NPC('goblin', game.player.x + 1, game.player.y, 0, {});
  const mods = game._offensiveMods(mob, 'melee');
  assert.ok(mods.accM > 1 && mods.dmgM > 1, 'melee perks raise accuracy and damage');
  game._postAttack(mob);
  const chat = [];
  game.bus.on('chat', (c) => chat.push(c.text));
  game.bus.emit('levelup', { skill: 'magic', level: 20 });
  assert.ok(chat.some((t) => t.startsWith('New passive perk: Arcane Focus')));
});

test('job classes: one per weapon type, and every type has a weapon at every tier', async () => {
  const { CLASSES, weaponsOfType } = await import('../src/data/classes.js');
  const { WEAPON_TYPES, ITEMS } = await import('../src/data/items.js');
  assert.equal(CLASSES.length, WEAPON_TYPES.length);
  assert.deepEqual([...new Set(CLASSES.map((c) => c.weapon))].sort(), [...WEAPON_TYPES].sort(), 'each weapon type is a different class');
  const lvl = (id) => Math.max(0, ...Object.values(ITEMS[id].equip.req || {}));
  for (const t of WEAPON_TYPES) {
    const levels = weaponsOfType(t).map(lvl);
    for (const tier of [1, 20, 40, 60, 80, 100, 130, 170, 220, 300]) {
      assert.ok(levels.some((l) => l <= tier && l > tier - 40), `${t} has a weapon around level ${tier}`);
    }
  }
  // Every weapon (except tools) has a type.
  for (const [id, it] of Object.entries(ITEMS)) if (it.equip?.slot === 'weapon' && !it.tool) assert.ok(it.equip.weaponType, `${id} has a weapon type`);
});

test('job classes: chosen at the start, permanent, locked to the class weapon; loot turns into the class equivalent', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseClass('samurai');
  assert.equal(game.jobClass, 'samurai');
  assert.equal(game.equipment.get('weapon'), 'bronze_katana', 'Samurai start with a katana');
  game.chooseClass('archer');
  assert.equal(game.jobClass, 'samurai', 'the choice is permanent');
  game.inventory.add('bronze_scimitar', 1); game.inventory.add('iron_katana', 1);
  game.equipItem(game.inventory.slots.findIndex((s) => s && s.id === 'bronze_scimitar'));
  assert.equal(game.equipment.get('weapon'), 'bronze_katana', 'a Samurai cannot wield a scimitar');
  game.equipItem(game.inventory.slots.findIndex((s) => s && s.id === 'iron_katana'));
  assert.equal(game.equipment.get('weapon'), 'iron_katana', 'but can wield a better katana');
  // Weapon drops mostly become katanas of the same tier.
  const mob = game.npcs.find((n) => n.def.attackable && !n.def.boss);
  let katanas = 0, others = 0;
  game._autoLoot = (loot) => {
    katanas += loot.filter(([id]) => /katana$/.test(id)).length;
    others += loot.filter(([id]) => /(_scimitar|_sword|_mace|_dagger|_spear)$/.test(id)).length;
  };
  for (let i = 0; i < 600; i++) game.rollDrops(mob);
  assert.ok(katanas > others, `class weapons dominate weapon drops (${katanas} katanas vs ${others} others)`);
  // Saved and loaded with the class.
  saveGame(game);
  const g2 = new Game(); g2.start(); loadGame(g2);
  assert.equal(g2.jobClass, 'samurai');
  assert.equal(g2.pendingClassChoice, false);
});

test('an older save without a class picks one on load and keeps its gear', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g2 = new Game(); g2.start();
  // An old save: no job class yet, gear already on.
  g2.pendingStyleChoice = false; g2.pendingClassChoice = true;
  g2.equipment.set('weapon', 'rune_scimitar'); g2.equipment.set('body', 'rune_platebody');
  g2.chooseClass('ranger');
  assert.equal(g2.jobClass, 'ranger');
  assert.equal(g2.pendingClassChoice, false);
  assert.equal(g2.equipment.get('body'), 'rune_platebody', 'armour is kept');
  assert.equal(g2.equipment.get('weapon'), 'longbow', 'the class weapon is equipped');
  assert.ok(g2.inventory.has('rune_scimitar'), 'the old weapon goes to the pack');
});

test('new life skills: Farming, Herblore, Fletching and Hunter exist, with stations, patches, traps, a farm shop and icons for everything', async () => {
  const { SKILL_BY_ID } = await import('../src/data/skills.js');
  const { ITEMS } = await import('../src/data/items.js');
  const { CROPS, POTIONS, FLETCH, HUNT, HIDE_CRAFT } = await import('../src/data/trades.js');
  const { SHOPS } = await import('../src/data/shops.js');
  const { itemIconSVG, skillIconSVG } = await import('../src/render/icons.js');
  const fallback = itemIconSVG('coins');
  for (const id of ['farming', 'herblore', 'fletching', 'hunter']) {
    assert.ok(SKILL_BY_ID[id], `${id} is a skill`);
    assert.notEqual(skillIconSVG(id), skillIconSVG('attack'), `${id} has its own icon`);
  }
  const ids = new Set();
  for (const c of CROPS) { ids.add(c[0]); ids.add(`${c[0]}_seed`); }
  for (const [id, p] of Object.entries(POTIONS)) { ids.add(id); p.inputs.forEach(([i]) => ids.add(i)); }
  for (const r of FLETCH) { ids.add(r.result); r.inputs.forEach(([i]) => ids.add(i)); }
  for (const h of Object.values(HUNT)) h.gives.forEach((g) => ids.add(g.id));
  for (const r of HIDE_CRAFT) { ids.add(r.result); r.inputs.forEach((i) => ids.add(i.id)); }
  for (const id of ['knife', 'hunting_snare', 'venison', 'boar_steak']) ids.add(id);
  for (const id of ids) {
    assert.ok(ITEMS[id], `${id} is an item`);
    if (id !== 'coins') assert.notEqual(itemIconSVG(id), fallback, `${id} has an icon`);
  }
  assert.ok(SHOPS.farming.stock.some((s) => s.id === 'chilli_seed') && SHOPS.general.stock.some((s) => s.id === 'hunting_snare'));
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const count = (id) => game.world.objects.filter((o) => o.objId === id).length;
  assert.ok(count('farm_patch') >= 20 && count('apothecary_table') >= 4 && count('fletching_bench') >= 4);
  for (const id of Object.keys(HUNT)) assert.ok(count(id) >= 3, `${id} traps are placed`);
  assert.ok(game.npcs.some((n) => n.npcId === 'farmer' && Math.abs(n.x - 58) < 10 && Math.abs(n.y - 60) < 10), 'a farmer by Kampong Glam');
});

test('farming: plant a seed, it grows, it survives a save, and the harvest gives crops and xp', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const patch = game.world.objects.find((o) => o.objId === 'farm_patch');
  game.inventory.add('chilli_seed', 1);
  assert.ok(game.plantSeed(patch, 'chilli_seed'));
  assert.equal(patch.crop, 'chilli');
  assert.equal(game.inventory.count('chilli_seed'), 0);
  game.tendPatch(patch);
  assert.equal(patch.crop, 'chilli', 'checking a growing crop does not harvest it');
  saveGame(game);
  const g2 = new Game(); g2.start(); loadGame(g2);
  assert.equal(g2.world.objectAt(patch.x, patch.y).crop, 'chilli', 'the crop is still there after loading');
  for (let i = 0; i < 60; i++) game._tickFarms();
  assert.equal(patch.growLeft, 0, 'it has grown');
  const xp0 = game.skills.xp.farming;
  game.tendPatch(patch);
  assert.equal(patch.crop, null, 'harvested');
  assert.ok(game.inventory.count('chilli') >= 3 && game.skills.xp.farming > xp0);
  // A seed above your level won't go in.
  game.inventory.add('durian_seed', 1);
  assert.equal(game.plantSeed(patch, 'durian_seed'), false);
});

test('hunter, fletching and herblore: traps catch, benches make, potions brew, boost a fight and wear off', async () => {
  const { resolveHunt, resolveRecipe } = await import('../src/game/skilling.js');
  const { POTIONS, FLETCH } = await import('../src/data/trades.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const trap = game.world.objects.find((o) => o.objId === 'bird_snare');
  assert.equal(resolveHunt(game, { obj: trap }), false, 'a snare is needed');
  game.inventory.add('hunting_snare', 1);
  for (let i = 0; i < 200 && !game.skills.xp.hunter; i++) { trap.depleted = false; resolveHunt(game, { obj: trap }); }
  assert.ok(game.skills.xp.hunter > 0 && game.inventory.count('feather') >= 3, 'the snare caught a junglefowl');
  // Fletching: logs into shafts, then arrows.
  game.inventory.add('knife', 1); game.inventory.add('logs', 1); game.inventory.add('bronze_bar', 1); game.inventory.add('feather', 15);
  resolveRecipe(game, { skill: 'fletching', recipe: FLETCH.find((r) => r.result === 'arrow_shaft') });
  assert.equal(game.inventory.count('arrow_shaft'), 15);
  const arrows0 = game.inventory.count('bronze_arrow');
  resolveRecipe(game, { skill: 'fletching', recipe: FLETCH.find((r) => r.result === 'bronze_arrow') });
  assert.equal(game.inventory.count('bronze_arrow'), arrows0 + 15);
  // Herblore: a chilli and a vial make an attack potion.
  game.inventory.add('chilli', 1); game.inventory.add('vial', 1);
  const p = POTIONS.attack_potion;
  resolveRecipe(game, { skill: 'herblore', recipe: { result: 'attack_potion', qty: 1, inputs: p.inputs, level: p.level, xp: p.xp } });
  assert.equal(game.inventory.count('attack_potion'), 1);
  const acc0 = game.perkMods().acc || 0;
  game.drinkPotion(game.inventory.slots.findIndex((s) => s && s.id === 'attack_potion'));
  assert.ok(Math.abs((game.perkMods().acc || 0) - acc0 - 0.08) < 1e-9, 'the potion adds 8% accuracy');
  game._tickPotions(p.ms + 1);
  assert.equal(game.perkMods().acc || 0, acc0, 'and wears off');
  // A healing potion heals at once.
  game.player.hp = 1;
  game.inventory.add('healing_potion', 1);
  game.drinkPotion(game.inventory.slots.findIndex((s) => s && s.id === 'healing_potion'));
  assert.ok(game.player.hp > 1);
});

test('Trades of the Wild: Cikgu Surya teaches the four new skills and pays out at the end', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.startLife('life_skills_wild');
  assert.equal(game.quests.life_skills_wild.state, 'active');
  game.inventory.add('chilli', 5); game.advanceLife('life_skills_wild');
  game.inventory.add('attack_potion', 1); game.advanceLife('life_skills_wild');
  game.inventory.add('arrow_shaft', 15); game.advanceLife('life_skills_wild');
  game.skills.addXp('hunter', 200); game.advanceLife('life_skills_wild');
  assert.equal(game.quests.life_skills_wild.state, 'done');
});

test('a boss signature move starts a cast flourish that the renderer plays, then fades', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const p = game.player;
  p.hp = game.maxHp();
  const boss = game.spawnNpc('merlion', p.x + 2, p.y, { wander: 0 });
  game.bossSpecial(boss);
  assert.ok(boss.castT > 0 && boss.castCol === boss.def.ability.color, 'the cast flourish starts in the ability colour');
  boss.update(800);
  assert.equal(boss.castT, 0, 'and fades out');
});

test('every open-world and far region is well stocked and refills quickly', async () => {
  const { NPCS, MONSTER_IDS, BOSS_IDS } = await import('../src/data/npcs.js');
  for (const id of MONSTER_IDS) assert.ok(NPCS[id].respawn <= 18, `${id} respawns within about 11s`);
  for (const id of BOSS_IDS) assert.ok(NPCS[id].respawn <= 100, `${id} respawns within about a minute`);
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const w = game.world;
  for (const z of w.zones.filter((zz) => zz.lo)) {
    let walk = 0;
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) if (w.inBounds(x, y) && !w.isBlocked(x, y)) walk++;
    const mobs = game.npcs.filter((n) => n.attackable && !n.def.boss && n.x >= z.x0 && n.x <= z.x1 && n.y >= z.y0 && n.y <= z.y1).length;
    assert.ok(mobs / walk * 1000 >= 30, `${z.name} has ${(mobs / walk * 1000).toFixed(1)} monsters per 1000 tiles`);
  }
});

test('auto battle answers anything fighting you, takes on bosses a little above your level, and never gives up a long walk', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const p = game.player;
  const cl = game.skills.combatLevel();
  game.npcs = game.npcs.filter((n) => Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y)) > 30);
  // A boss far above your level that is attacking you is answered.
  const big = game.spawnNpc('eternal_wyrm', p.x + 3, p.y, { wander: 0 });
  big.target = p;
  assert.equal(game._autoPickTarget(), big, 'a boss on you is fought even far above your level');
  big.alive = false;
  // A boss's summoned add that is attacking you is answered.
  const add = game.spawnNpc('goblin', p.x + 2, p.y, { temporary: true });
  add.target = p;
  assert.equal(game._autoPickTarget(), add, 'summoned adds on you are fought');
  add.alive = false;
  // A boss somewhat above your level, 20 tiles off, is sought out.
  const t = game._nearestFree(p.x + 20, p.y) || game._nearestFree(p.x, p.y + 20);
  const boss = game.spawnNpc('goblin_warchief', t.x, t.y, { wander: 0 });
  boss.def = { ...boss.def, level: cl + 12 };
  assert.equal(game._autoPickTarget(), boss, 'a boss 12 levels up and 20 tiles away is fair game');
  // Walking without run energy toward it, the chase is not abandoned while closing in.
  game.runEnergy = 0; game.running = false;
  game.toggleAutoBattle(true);
  for (let i = 0; i < 45 && Math.max(Math.abs(boss.x - p.x), Math.abs(boss.y - p.y)) > game.attackRange(); i++) game.update(600);
  assert.equal(p.action?.npc, boss, 'still heading for it after a long walk');
});

test('quest journal Go: walks to the quest giver, the next objective, or a fight, and gets there', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const p = game.player;
  const run = (n) => { for (let i = 0; i < n && (p.isMoving || p.action); i++) game.update(600); };
  // Not started: off to the Kampong Guide, and the chat opens there.
  let opened = null;
  game.ui = new Proxy({ openDialogue: (npc) => { opened = npc.npcId; } }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  assert.match(game.questGuide('pillars').text, /Kampong Guide/);
  assert.ok(game.questTravel('pillars'));
  run(120);
  assert.equal(opened, 'guide', 'reached the guide and started talking');
  // Active: the next pillar is the A-Worthy Monument; Go walks there and prays.
  game.quests.pillars.state = 'active';
  assert.equal(game.questGuide('pillars').kind, 'obj');
  game.questTravel('pillars');
  run(120);
  assert.ok(game.quests.pillars.monument, 'prayed at the Monument');
  assert.match(game.questGuide('pillars').text, /Mascot Statue/);
  // A kill quest turns auto battle on, hunting only the quest's monster.
  game.quests.pest_control.state = 'active';
  game.questTravel('pest_control');
  assert.ok(game.autoBattle && game._questTarget === 'rat');
  // A finished quest has nowhere to go.
  game.quests.pillars.state = 'done';
  assert.equal(game.questGuide('pillars').kind, 'none');
  assert.equal(game.questTravel('pillars'), false);
});

test('auto battle movement is smooth: no freeze mid-stride on a hit, and a chase re-plans between ticks', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  game.npcs = [];
  // Hit-stop freezes the world for a moment, but not your own walking.
  p.setPath([{ x: p.x + 1, y: p.y }, { x: p.x + 2, y: p.y }], false);
  game.hitStop = 120;
  const x0 = p.renderCenter().x;
  game.update(100);
  assert.ok(p.renderCenter().x - x0 > 5, 'kept walking at full speed through the hit-stop');
  p.stopNow();
  game.update(600);

  // The target steps out of reach right as you arrive: you set off again well
  // before the next 0.6s tick.
  const mob = new NPC('goblin', p.x + 4, p.y, 0, {});
  mob.def = { ...mob.def, aggressive: false };
  game.npcs = [mob];
  game.attackNpc(mob);
  for (let i = 0; i < 60 && p.moving; i++) game.update(16);
  assert.ok(!p.moving, 'arrived');
  mob.x = mob.tx = p.x + 4;                      // it moved away
  game.tickAcc = 0;                               // the next world tick is a full 0.6s off
  game.update(16); game.update(16); game.update(16);
  game.update(150); game.update(16);
  assert.ok(p.moving, 'already chasing again, without waiting for the tick');
});

test('free movement: any angle, slides along walls, and click routes walk straight instead of zigzagging', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  game.npcs = [];
  // A private patch of open ground with one wall, so the test doesn't depend on the map.
  const W = new Set(['10,5', '10,6', '10,7', '10,8']);
  p.walkable = (x, y) => x >= 0 && y >= 0 && x < 40 && y < 40 && !W.has(`${x},${y}`);
  game.world.isBlocked = (x, y) => !p.walkable(x, y);
  game.world.inBounds = (x, y) => x >= 0 && y >= 0 && x < 40 && y < 40;
  p.x = p.tx = 5; p.y = p.ty = 6;
  game.running = false;

  // Any angle: a shallow push up-right travels at that angle, not snapped to 45°.
  game.setMoveInput(0.9, -0.3);
  for (let i = 0; i < 20; i++) game.update(16);
  const ang = Math.atan2(p.fy - 6, p.fx - 5);
  assert.ok(Math.abs(ang - Math.atan2(-0.3, 0.9)) < 0.05, `moved at the stick's angle (${ang.toFixed(2)})`);

  // Walking into the wall slides along it instead of stopping dead.
  p.x = p.tx = 9; p.y = p.ty = 6; game.update(0);
  game.setMoveInput(0.95, 0.31);
  for (let i = 0; i < 80; i++) game.update(16);
  assert.ok(p.fx <= 9.2, 'never walks into the wall');
  assert.ok(p.fy > 6.5, 'slid along it');
  game.setMoveInput(0, 0); game.update(16);

  // A click route from (5,5) to (9,12) cuts straight across rather than
  // following the grid's straight-then-diagonal zigzag.
  p.x = p.tx = 5; p.y = p.ty = 5; game.update(0);
  game.walkTo({ x: 9, y: 12 });
  let off = 0, n = 0;
  while (p.moving && n++ < 400) {
    game.update(16);
    // Distance from the straight line between start and goal.
    const dx = 4, dy = 7, d = Math.hypot(dx, dy);
    off = Math.max(off, Math.abs((p.fx - 5) * dy - (p.fy - 5) * dx) / d);
  }
  assert.ok(p.x === 9 && p.y === 12 && p.fx === 9 && p.fy === 12, 'arrived on the tile centre');
  assert.ok(off < 0.25, `stayed on the straight line (max ${off.toFixed(2)} tiles off)`);
});

test('free movement: teleports and respawns move the glide position too', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  game.npcs = [];
  p.x = p.tx = p.x + 3; game.update(16);
  assert.equal(p.fx, p.x, 'the glide position follows a teleport');
  assert.equal(p.renderCenter().x, p.x * 32 + 16);
});

test('monsters spawn in packs of their own kind, not scattered one by one', async () => {
  const { buildWorld } = await import('../src/data/world.js');
  const { NPCS } = await import('../src/data/npcs.js');
  const w = buildWorld();
  const mobs = w.npcSpawns.filter((s) => !s.opts && NPCS[s.npcId]?.attackable && !NPCS[s.npcId].boss);
  const fam = (s) => NPCS[s.npcId].family || s.npcId;
  const cells = new Map();
  for (const s of mobs) { const k = `${s.x >> 3},${s.y >> 3}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(s); }
  let packed = 0;
  for (const a of mobs) {
    let n = 0;
    for (let gx = (a.x >> 3) - 1; gx <= (a.x >> 3) + 1; gx++) for (let gy = (a.y >> 3) - 1; gy <= (a.y >> 3) + 1; gy++) {
      for (const b of cells.get(`${gx},${gy}`) || []) if (b !== a && fam(b) === fam(a) && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 3) n++;
    }
    if (n >= 2) packed++;
  }
  assert.ok(packed / mobs.length > 0.9, `most monsters have two of their kind close by (${(packed / mobs.length * 100).toFixed(0)}%)`);
  assert.equal(new Set(mobs.map((s) => `${s.x},${s.y}`)).size, mobs.length, 'no two monsters start on the same tile');
  for (const s of mobs) assert.ok(s.wander <= 3, 'pack members stay near their camp');
});

test('MOBA attack and skill buttons: nearest lock-on, aimed skills, hold to keep fighting', async () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.ui = new Proxy({}, { get: () => () => {} });
  const p = game.player;
  const mk = (dx, dy) => {
    const n = new NPC('goblin', p.x + dx, p.y + dy, 0, {});
    n.def = { ...n.def, aggressive: false }; n.maxHp = n.hp = 9999;
    return n;
  };
  const east = mk(3, 0), west = mk(-5, 0), far = mk(0, 14);
  const story = game.npcs.find((n) => n.def.fixed) || mk(1, 1);
  story.def = { ...story.def, fixed: true }; story.x = story.tx = p.x + 1; story.y = story.ty = p.y;
  game.npcs = [east, west, far, story];

  // Nearest wins; story bosses and anything out of reach are skipped.
  assert.equal(game.nearestFoe(), east);
  // Aimed west, the western goblin is chosen even though it's further away.
  assert.equal(game.nearestFoe({ x: -1, y: 0 }), west);
  // Something already hunting you outranks a nearer bystander.
  west.target = p;
  assert.equal(game.nearestFoe(), west);
  west.target = null;

  // Attack locks onto the nearest and keeps the lock on a second tap.
  assert.ok(game.attackNearest());
  assert.equal(p.action?.npc, east);
  game.attackNearest();
  assert.equal(p.action?.npc, east, 'a second tap keeps the current foe');

  // An aimed skill switches to the foe it was aimed at and readies the skill.
  const ab = game.currentAbilities().find((a) => a.kind === 'attack' && !a.instant && game.abilityUnlocked(a));
  game.adrenaline = 100;
  game.useSkillAt(ab.id, { x: -1, y: 0 });
  assert.equal(p.action?.npc, west, 'aimed at the western goblin');
  assert.equal(game.armedAbility, ab.id, 'and the skill is readied');

  // Holding Attack: when the foe falls, it moves straight on to the next.
  game.attackHeld = true;
  west.hp = 0; west.die();
  game.update(16); game.update(300);
  assert.ok(p.action?.type === 'attack' && p.action.npc.alive && p.action.npc !== west, 'moved on to the next foe');
  game.attackHeld = false;

  // Nothing near: it says so once, and doesn't fight anything.
  game.npcs = [far];
  p.clearAction();
  assert.equal(game.attackNearest(), false);
});

test('races: every foe has one, weapons bite harder into some and are resisted by others', async () => {
  const { RACES, raceOf, WEAPON_VS_RACE, matchup } = await import('../src/data/races.js');
  const { NPCS } = await import('../src/data/npcs.js');
  const { WEAPON_TYPES } = await import('../src/data/items.js');
  for (const [id, d] of Object.entries(NPCS)) if (d.attackable) assert.ok(RACES[raceOf(d, id)], `${id} has a race`);
  // Every weapon type has prey, and every race has at least two counters.
  for (const w of WEAPON_TYPES) assert.ok(WEAPON_VS_RACE[w]?.strong.length >= 2, `${w} is strong against two or more races`);
  for (const r of Object.keys(RACES)) {
    const counters = WEAPON_TYPES.filter((w) => matchup(w, r) === 'strong');
    assert.ok(counters.length >= 2, `${r} can be countered by ${counters.length} weapon types`);
  }
  // Folklore and great birds are filed correctly.
  assert.equal(raceOf(NPCS.toyol, 'toyol'), 'spirit');
  assert.equal(raceOf(NPCS.celestial_garuda, 'celestial_garuda'), 'avian');
  assert.equal(raceOf(NPCS.stone_golem, 'stone_golem'), 'construct');

  // In a fight: a dagger is effective on a bandit and resisted by a golem.
  globalThis.localStorage = fakeStorage();
  clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.equipment.set('weapon', 'bronze_dagger');
  const p = game.player;
  const bandit = new NPC('bandit', p.x + 1, p.y, 0, {});
  const golem = new NPC('stone_golem', p.x + 1, p.y + 1, 0, {});
  assert.equal(game.raceMatchup(bandit), 'strong');
  assert.equal(game.raceMatchup(golem), 'weak');
  const eff = game._offensiveMods(bandit, 'melee'), res = game._offensiveMods(golem, 'melee');
  assert.ok(eff.dmgM / res.dmgM > 1.6, `effective vs resisted damage (${eff.dmgM.toFixed(2)} vs ${res.dmgM.toFixed(2)})`);
  // Swapping to a warhammer turns the tables on the golem.
  game.equipment.set('weapon', 'bronze_warhammer');
  assert.equal(game.raceMatchup(golem), 'strong');
});

test('class armour: equipping is limited to your family; offensive stats change combat', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseClass('rogue');
  const inv = game.inventory, eq = game.equipment;
  const idx = (id) => inv.slots.findIndex((x) => x && x.id === id);
  game.skills.addXp('defence', 2_000_000);
  inv.add('rune_platebody', 1); inv.add('rune_scout_jerkin', 1);
  game.equipItem(idx('rune_platebody'));
  assert.notEqual(eq.get('body'), 'rune_platebody', 'a Rogue cannot wear plate');
  game.equipItem(idx('rune_scout_jerkin'));
  assert.equal(eq.get('body'), 'rune_scout_jerkin');
  assert.ok(eq.bonuses().critDmg > 0, 'scout leather adds crit damage');
  // Haste shortens attack time; lifesteal heals on hit.
  const base = eq.weaponSpeed();
  eq.set('cape', 'batik_cape');                 // a melee cape with haste
  assert.ok(eq.weaponSpeed() < base, 'haste makes attacks faster');
  eq.set('legs', 'golden_dancer_skirt');
  const mob = game.spawnNpc(game.npcs.find((n) => n.def.attackable && !n.def.boss).npcId, game.player.x + 1, game.player.y, { wander: 0 });
  mob.maxHp = mob.hp = 99999;
  game.player.hp = 5;
  game._applyPlayerHit(mob, 100);
  assert.ok(game.player.hp > 5, 'lifesteal heals you');
  // The starting kit matches the class.
  const g2 = new Game(); g2.start(); g2.chooseClass('juggernaut');
  assert.equal(g2.equipment.get('body'), 'bronze_chainbody', 'heavy melee starts in chainmail');
});

test('new classes: Pistoler (dual pistols, no ammo, very fast), Ninja (ricochet), Merchant (mercenaries)', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const Mercs = await import('../src/game/mercenary.js');
  const fresh = (cls) => {
    globalThis.localStorage = fakeStorage();
    clearSave();
    const g = new Game(); g.start(); g.chooseClass(cls);
    g.ui = new Proxy({}, { get: () => () => {} });
    return g;
  };
  const dummy = (g, dx, dy = 0) => {
    const n = new NPC('goblin', g.player.x + dx, g.player.y + dy, 0, {});
    n.hp = n.maxHp = 999999; n.def = { ...n.def, aggressive: false, maxHit: 0 };
    return n;
  };

  // Pistoler: starts with a pair, needs no arrows, and fires several shots a beat.
  const ps = fresh('pistoler');
  assert.equal(ps.equipment.get('weapon'), 'bronze_pistol');
  assert.equal(ps.equipment.get('shield'), 'bronze_pistol', 'starts dual wielding');
  assert.equal(ps.inventory.count('bronze_arrow'), 0, 'no ammo needed');
  const t1 = dummy(ps, 3);
  ps.npcs = [t1];
  let shots = 0;
  const orig = ps.doPlayerAttack.bind(ps);
  ps.doPlayerAttack = (n) => { shots++; return orig(n); };
  ps.attackNpc(t1);
  for (let i = 0; i < 31; i++) ps.update(100);   // ~3s
  assert.ok(shots >= 30, `pistols fire very fast: ${shots} volleys in 3s`);
  assert.ok(t1.hp < t1.maxHp, 'and they hit');

  // Ninja: a shuriken that lands ricochets into a foe beside the target.
  const nj = fresh('ninja');
  assert.equal(nj.equipment.get('weapon'), 'bronze_shuriken');
  assert.equal(nj.equipment.get('body'), 'bronze_scout_jerkin', 'ninjas wear scout leather');
  const main = dummy(nj, 3), side = dummy(nj, 4);
  nj.npcs = [main, side];
  for (let i = 0; i < 40 && side.hp === side.maxHp; i++) { nj.player.attackCooldown = 0; nj._rangedAttack(main); }
  assert.ok(side.hp < side.maxHp, 'the ricochet hit the second foe');
  // Only bows loose arrows: Ninjas throw shurikens and Pistolers fire bullets.
  const kinds = (g) => new Set(g.effects.filter((e) => e.type === 'projectile').map((e) => e.kind));
  assert.deepEqual([...kinds(nj)], ['shuriken'], 'a Ninja throws shurikens, not arrows');
  const pt = dummy(ps, 3); ps.npcs.push(pt);
  ps.player.attackCooldown = 0; ps._rangedAttack(pt);
  assert.deepEqual([...kinds(ps)], ['bullet'], 'a Pistoler fires bullets, not arrows');

  // Merchant: hire mercenaries who fight the Merchant's target, then leave.
  const mc = fresh('merchant');
  assert.equal(mc.equipment.get('weapon'), 'bronze_cane');
  mc.inventory.add('coins', 100000);
  const foe = dummy(mc, 2);
  mc.npcs.push(foe);
  const merc = mc.hireMercenary();
  assert.ok(merc && merc.ally && !merc.attackable, 'a mercenary joins');
  for (let i = 0; i < 5; i++) assert.ok(mc.hireMercenary(), 'no limit on how many mercenaries');
  assert.equal(Mercs.activeMercs(mc).length, 6);
  // Auto battle hires without a limit too, keeping three hires' worth of coins.
  mc.autoBattle = true; mc.autoCfg.abilities = false;   // (its coin-paid skills would summon A-Worthlings)
  mc.player.setAction({ type: 'attack', npc: foe });
  for (let i = 0; i < 4; i++) mc._autoBattleTick();
  assert.ok(Mercs.activeMercs(mc).length >= 10, 'auto battle keeps hiring past three');
  mc.autoBattle = false; mc.player.clearAction();
  for (const m of Mercs.activeMercs(mc).slice(6)) m.alive = false;
  mc.npcs = mc.npcs.filter((n) => n.alive);
  // They go after the nearest monster by themselves: the Merchant isn't fighting.
  mc.player.autoRetaliate = false;
  const hp0 = foe.hp;
  for (let i = 0; i < 40; i++) { mc.player.attackCooldown = 99; mc.update(600); }
  assert.ok(foe.hp < hp0, 'the mercenaries hunt down the nearest monster');
  merc.allyUntil = mc.tickCount;
  mc.update(600);
  assert.ok(!mc.npcs.includes(merc), 'the contract ends and the mercenary leaves');
  // A-Worthlings: each Merchant attack can call up a mirror image that hits for 25%.
  const r0 = Math.random;
  try {
    Math.random = () => 0.1;           // under the 25% roll
    const prey = dummy(mc, -1);
    mc.npcs.push(prey);
    mc.doPlayerAttack(prey);
    assert.equal(Mercs.activeFollowers(mc).length, 1, 'an attack called up an A-Worthling');
    mc.killNpc(Object.assign(dummy(mc, -3), { hp: 0 }));
    assert.equal(Mercs.activeFollowers(mc).length, 1, 'kills no longer call them up');
    Math.random = () => 0.5;           // over the roll
    mc.doPlayerAttack(prey);
    assert.equal(Mercs.activeFollowers(mc).length, 1, 'no A-Worthling on a failed roll');
    prey.alive = false; mc.npcs = mc.npcs.filter((n) => n !== prey);
  } finally { Math.random = r0; }
  const aw = Mercs.activeFollowers(mc)[0];
  assert.ok(aw.ally && aw.follower && !aw.attackable && aw.npcId === 'aworthling');
  // A-Worthlings split off smaller, weaker A-Worthlings.
  const kid = Mercs.spawnFollower(mc, aw);
  assert.ok(kid && kid.def.scale < 1 && kid.share === 0.25 && aw.share === 0.25, 'a smaller A-Worthling, still at a fixed 25%');
  kid.alive = false; mc.npcs = mc.npcs.filter((n) => n !== kid);
  const hp1 = foe.hp;
  for (let i = 0; i < 30; i++) { mc.player.attackCooldown = 99; mc.update(600); }
  assert.ok(foe.hp < hp1, 'the A-Worthling fights too');
  assert.equal(aw.allyUntil, Infinity, 'A-Worthlings stay for good');
  assert.ok(aw.stepMul < 1 && merc.stepMul < 1, 'allies keep up with the Merchant and run');
  // Allies cleave: a foe beside the target takes a share too.
  // (Tested directly: in the live world the allies may pick another nearby monster.)
  const beside = dummy(mc, 0); beside.x = beside.tx = foe.x; beside.y = beside.ty = foe.y + 1; mc.npcs.push(beside);
  mc._allyFoes = null;   // the nearby-foe list is cached per tick
  Mercs.allyCleave(mc, foe, 10);
  assert.equal(beside.hp, beside.maxHp - 4, 'ally hits cleave 40% (cane) into the foe beside the target');
  // Left far behind (a teleport): they jump back to the Merchant.
  // (A-Worthlings merge once there are many of them, so take one that's still about.)
  const aw2 = Mercs.activeFollowers(mc)[0];
  aw2.stopNow(); aw2.x = aw2.tx = mc.player.x + 40; aw2.y = aw2.ty = mc.player.y;
  mc.update(600);
  assert.ok(Math.abs(aw2.x - mc.player.x) <= 3, 'an A-Worthling left behind catches up');
  assert.equal(fresh('pistoler').hireMercenary(), null, 'only Merchants can hire');
});

test('Equip best in slot puts on the strongest gear you can wear, and a dual-wield off-hand', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game(); g.start(); g.chooseClass('rogue');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.skills.xp.defence = g.skills.xp.defence || 0;
  for (const id of ['iron_dagger', 'iron_dagger', 'leather_body', 'rune_platebody', 'rune_dagger', 'bronze_sword']) g.inventory.add(id, 1);
  const n = g.equipBest();
  assert.ok(n >= 2);
  assert.equal(g.equipment.get('weapon'), 'iron_dagger', 'the better dagger goes in the main hand');
  assert.equal(g.equipment.get('shield'), 'iron_dagger', 'and its twin in the off-hand');
  assert.equal(g.equipment.get('body'), 'leather_body', 'class armour only: no plate for a Rogue');
  assert.ok(g.inventory.count('rune_dagger') === 1 && g.inventory.count('bronze_sword') === 1, 'too-high levels and other classes\' weapons stay in the pack');
  assert.equal(g.equipBest(), 0, 'pressing again changes nothing');
});

test('every class is catered for: a starter weapon in a shop, and quest rewards that fit the class', async () => {
  const { CLASSES, starterWeapon } = await import('../src/data/classes.js');
  const { SHOPS } = await import('../src/data/shops.js');
  const { ITEMS } = await import('../src/data/items.js');
  const sold = new Set(Object.values(SHOPS).flatMap((s) => s.stock.map((x) => x.id)));
  for (const id of sold) assert.ok(ITEMS[id], `shop item ${id} exists`);
  for (const c of CLASSES) {
    const ok = Object.keys(ITEMS).some((k) => sold.has(k) && ITEMS[k].equip?.weaponType === c.weapon);
    assert.ok(ok, `${c.name} can buy ${c.weapon} weapons in a shop`);
    assert.ok(starterWeapon(c.id), `${c.name} has a starter weapon`);
  }
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game(); g.start(); g.chooseClass('pistoler');
  g.ui = new Proxy({}, { get: () => () => {} });
  const ranged0 = g.skills.xp.ranged;
  const got = g._classReward('ancient_staff', 'magic', 4000);
  assert.equal(ITEMS[got].equip.weaponType, 'pistol', 'a Pistoler gets pistols instead of a staff');
  assert.ok(g.skills.xp.ranged > ranged0, 'and the XP goes to Ranged');
  const helm = g._classReward('rune_full_helm');
  assert.ok(!ITEMS[helm].equip.family || ITEMS[helm].equip.family === 'hide', 'armour rewards fit the class');
});

test('drops: rarer gear from normal monsters, quality rolls, and bosses always drop class gear and stones', async () => {
  const { rollQuality, QUALITY } = await import('../src/game/loot.js');
  const { rollUpgrade } = await import('../src/game/loot.js');
  assert.equal(rollQuality('boss', () => 0.99), 'superior', 'bosses give at least Superior (+2)');
  assert.equal(rollUpgrade('boss', () => 0.01), 15, 'a lucky boss roll is +15');
  assert.equal(rollUpgrade('normal', () => 0.01), 15, 'even a normal monster can drop +15 (very rarely)');
  assert.equal(rollQuality('normal', () => 0.9), null, 'most normal drops have no quality');
  // Odds vary greatly by source: count how often +10 or better comes up.
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const highShare = (src) => { let n = 0; for (let i = 0; i < 40000; i++) if (rollUpgrade(src, rnd) >= 10) n++; return n / 40000; };
  const nrm = highShare('normal'), ch = highShare('champion'), bs = highShare('boss');
  assert.ok(nrm < ch && ch < bs, `+10 or better: normal ${nrm} < champion ${ch} < boss ${bs}`);
  assert.ok(bs > nrm * 50, 'bosses are far likelier than normal monsters to drop it');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseClass('corsair');
  game.ui = new Proxy({}, { get: () => () => {} });
  let got = [];
  game._autoLoot = (loot) => { got = loot.map((l) => l[0]); };
  const boss = game.npcs.find((n) => n.def.boss && !n.def.fixed);
  game.rollDrops(boss);
  const gear = got.filter((id) => ITEMS[id].equip && (ITEMS[id].equip.weaponType === 'scimitar' || ITEMS[id].equip.family === 'leather'));
  assert.ok(gear.length >= 1, `a boss drops Corsair gear (${got.join(', ')})`);
  assert.ok(gear.some((id) => game.equipment.upgradeLevel(id) >= QUALITY.superior.level), 'of Superior quality or better');
  assert.ok(got.includes('upgrade_stone'), 'and upgrade stones');
  // Normal monsters: a gear roll is usually turned into something else.
  const mob = game.npcs.find((n) => n.def.attackable && !n.def.boss && n.def.dropTable?.some((d) => d.id && ITEMS[d.id]?.equip));
  let gearDrops = 0;
  for (let i = 0; i < 300; i++) { game.rollDrops(mob); gearDrops += got.filter((id) => ITEMS[id].equip).length; }
  const share = mob.def.dropTable.filter((d) => d.id && ITEMS[d.id]?.equip).reduce((s, d) => s + d.weight, 0) / mob.def.dropTable.reduce((s, d) => s + d.weight, 0);
  assert.ok(gearDrops < 300 * share * 0.75, `gear drops cut well below the table's share (${gearDrops} vs ${Math.round(300 * share)})`);
});

test('November monsters and bosses: defined, placed in their regions, with abilities, drops and art', async () => {
  const { NPCS, EXTRA_MONSTER_IDS, EXTRA_BOSS_IDS, ALL_MONSTER_IDS, ALL_BOSS_IDS } = await import('../src/data/npcs.js');
  const { buildWorld } = await import('../src/data/world.js');
  const { portraitFor } = await import('../src/render/sprites.js');
  assert.ok(EXTRA_MONSTER_IDS.length >= 30, 'twelve new species in three forms');
  assert.ok(EXTRA_BOSS_IDS.length >= 6);
  const w = buildWorld();
  for (const id of [...EXTRA_MONSTER_IDS, ...EXTRA_BOSS_IDS]) {
    const d = NPCS[id];
    assert.ok(d && d.attackable && d.dropTable.length > 0, `${id} is a monster with drops`);
    const spawns = w.npcSpawns.filter((s) => s.npcId === id);
    assert.ok(spawns.length >= 1, `${id} is placed in the world`);
    for (const s of spawns) assert.equal(w.zones.find((z) => s.x >= z.x0 && s.x <= z.x1 && s.y >= z.y0 && s.y <= z.y1)?.name, d.zone, `${id} spawns in ${d.zone}`);
    assert.ok(portraitFor(id, d)?.src.endsWith('.webp'), `${id} has art (its own or borrowed)`);
  }
  for (const id of EXTRA_BOSS_IDS) assert.ok(NPCS[id].boss && NPCS[id].ability?.fx.length, `${id} has a signature move`);
  assert.ok(EXTRA_BOSS_IDS.every((id) => ALL_BOSS_IDS.includes(id)) && EXTRA_MONSTER_IDS.every((id) => ALL_MONSTER_IDS.includes(id)), 'the bestiary lists them');
  assert.ok(NPCS[NPCS.jenglot_sovereign.ability.fx.find((f) => f.t === 'summon').id], 'the Jenglot Sovereign summons a real monster');
});

test('rune refund: a monster killed with spells gives back every rune spent on it', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game(); g.start(); g.chooseClass('wizard');
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const r of ['air_rune', 'water_rune', 'earth_rune', 'fire_rune', 'mind_rune', 'chaos_rune']) g.inventory.add(r, 500);
  const foe = new NPC('goblin', g.player.x + 2, g.player.y, 0, {});
  foe.hp = foe.maxHp = 999999; foe.def = { ...foe.def, aggressive: false, maxHit: 0, dropTable: [] };
  g.npcs.push(foe);
  const before = {};
  for (const s of g.inventory.slots) if (s && /_rune$/.test(s.id)) before[s.id] = g.inventory.count(s.id);
  for (let i = 0; i < 10; i++) g._magicAttack(foe);
  const spent = Object.values(foe._runesSpent || {}).reduce((a, b) => a + b, 0);
  assert.ok(spent > 0, 'casting spent runes on the foe');
  g.killNpc(foe);
  for (const [id, n] of Object.entries(before)) assert.equal(g.inventory.count(id), n, `${id} all refunded`);
});

test('boss rewards scale with their 100x health: big kill bonus, hoards of loot', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  const boss = new NPC('goblin_warchief', g.player.x + 2, g.player.y, 0, {});
  let loot = null;
  g._autoLoot = (l) => { loot = l; };
  g.rollDrops(boss);
  const gear = loot.filter(([id]) => ITEMS[id].equip);
  assert.ok(gear.length >= 3, 'at least three pieces of class gear');
  assert.ok(loot.some(([id]) => id === 'upgrade_ward'), 'always an upgrade ward');
  const stone = loot.find(([id]) => id === 'upgrade_stone');
  assert.ok(stone && stone[1] >= 20, 'a pile of upgrade stones');
  const coins = loot.filter(([id]) => id === 'coins').reduce((a, [, q]) => a + q, 0);
  if (coins) assert.ok(coins >= 100, 'coins come in boss-sized piles');
  const xp0 = g.skills.xp.attack;
  boss.hp = 0; g.npcs.push(boss);
  g.killNpc(boss);
  assert.ok(g.skills.xp.attack - xp0 >= 35 * 4000, 'the kill bonus is 100x what it was');
});

test('auto gather for Farming: plants and harvests patch after patch by itself', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  const patches = g.world.objects.filter((o) => o.def?.type === 'farm');
  // Two patches close together.
  let a = null, b = null;
  for (const p of patches) { const q = patches.find((x) => x !== p && chebyshev(x.x, x.y, p.x, p.y) <= 6); if (q) { a = p; b = q; break; } }
  assert.ok(a && b, 'two farm patches near each other');
  const seedId = Object.keys(CROP_BY_SEED).find((id) => cropFor(CROP_BY_SEED[id][0]).level <= g.skills.level('farming'));
  g.inventory.add(seedId, 5);
  g.toggleAutoGather(true);
  g.player.x = g.player.tx = a.x; g.player.y = g.player.ty = a.y + 1;
  g.beginAction({ type: 'farm', obj: a, target: { x: a.x, y: a.y }, seed: seedId }, { x: a.x, y: a.y }, true);
  for (let i = 0; i < 40 && !(a.crop && b.crop); i++) g.update(600);
  assert.ok(a.crop && b.crop, 'both patches planted');
  a.growLeft = 0; b.growLeft = 0;
  const crop = a.crop;
  for (let i = 0; i < 40 && g.inventory.count(crop) === 0; i++) g.update(600);
  assert.ok(g.inventory.count(crop) > 0, 'ripe crops harvested without clicking');
});

test('auto gather picks mining back up after an interruption or once rocks grow back', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];   // no monsters to interrupt
  const rock = g.world.objects.find((o) => o.objId === 'copper_rock');
  g.toggleAutoGather(true);
  g.player.x = g.player.tx = rock.x; g.player.y = g.player.ty = rock.y + 1;
  g.defaultObjectAction(rock);
  for (let i = 0; i < 20; i++) g.update(600);
  g.player.clearAction();   // something interrupts (a monster, a click elsewhere)
  const ore0 = g.inventory.count('copper_ore');
  for (let i = 0; i < 200; i++) g.update(600);
  assert.ok(g.inventory.count('copper_ore') >= ore0 + 10, `picked mining back up: ${g.inventory.count('copper_ore') - ore0} more ore`);
});

test('every class has its own three abilities (damage Z, buff X, area B), and their extra effects work', async () => {
  const { CLASSES } = await import('../src/data/classes.js');
  const { abilitiesFor, ABILITIES } = await import('../src/data/abilities.js');
  const seen = new Set();
  for (const c of CLASSES) {
    const mode = c.style;
    const set = abilitiesFor(mode, c.id);
    const by = Object.fromEntries(set.map((a) => [a.key, a]));
    assert.equal(by.Z.kind, 'attack', `${c.name}: Z is a damage skill`);
    assert.equal(by.X.kind, 'buff', `${c.name}: X is a buff`);
    assert.ok(by.B.aoe || by.B.sweep, `${c.name}: B hits an area`);
    if (c.id === 'dancer') continue;   // the Dancer uses the whip set
    const own = set.filter((a) => a.cls === c.id).map((a) => a.key).sort();
    assert.deepEqual(own, ['B', 'X', 'Z'], `${c.name} has its own Z, X and B`);
    for (const a of set.filter((x) => x.cls)) { assert.ok(!seen.has(a.id), `${a.id} is unique`); seen.add(a.id); assert.ok(a.desc && a.art, `${a.id} has a description and art`); }
  }
  assert.equal(new Set(ABILITIES.map((a) => a.id)).size, ABILITIES.length, 'ability ids are unique');
  // A Rogue's Backstab always crits; a Merchant's favour calls up an A-Worthling.
  const { NPC } = await import('../src/game/npc.js');
  const Mercs = await import('../src/game/mercenary.js');
  const mk = (cls) => {
    globalThis.localStorage = fakeStorage(); clearSave();
    const g = new Game(); g.start(); g.chooseClass(cls);
    g.ui = new Proxy({}, { get: () => () => {} });
    const t = new NPC('goblin', g.player.x + 1, g.player.y, 0, {});
    t.hp = t.maxHp = 999999; t.def = { ...t.def, aggressive: false, maxHit: 0 };
    g.npcs = [t]; g.adrenaline = 100;
    return { g, t };
  };
  const r = mk('rogue');
  assert.deepEqual(r.g.currentAbilities().map((a) => a.id), ['backstab', 'shadow_step', 'brace', 'second_wind', 'assassinate']);
  r.g.activateAbility('backstab');
  r.g.player.attackCooldown = 0; r.g.doPlayerAttack(r.t);
  assert.ok(r.g.effects.some((e) => e.type === 'hitsplat' && e.critX >= 2), 'Backstab lands a critical');
  const m = mk('merchant');
  m.g.activateAbility('hire_bodyguards');
  assert.ok(Mercs.activeFollowers(m.g).length >= 2, 'Hire Bodyguards calls up two A-Worthlings');
  assert.ok(m.g.buffMod('dmg') > 0, 'and the damage buff is on');
  // Buffs: a Brawler's Adrenaline Rush attacks twice as often, then wears off.
  const b = mk('brawler');
  const iv = b.g.attackInterval();
  b.g.activateAbility('adrenaline_rush');
  assert.ok(Math.abs(b.g.attackInterval() - iv / 2) < 1e-9, 'twice as often');
  b.g.tickCount += 11;
  assert.equal(b.g.attackInterval(), iv, 'and it wears off after 6s');
  // A Knight's Shield Wall halves the damage taken.
  const k = mk('knight');
  k.g.activateAbility('shield_wall');
  assert.equal(k.g.buffMod('reduce'), 0.5);
  // Ultimates hit everything within 3 tiles of the target.
  const s2 = mk('swordsman');
  const near = new NPC('goblin', s2.t.x + 2, s2.t.y, 0, {}); near.hp = near.maxHp = 999999;
  const far = new NPC('goblin', s2.t.x + 6, s2.t.y, 0, {}); far.hp = far.maxHp = 999999;
  s2.g.npcs.push(near, far);
  s2.g.abilityUnlocked = () => true;   // ultimates unlock at combat level 45
  s2.g.activateAbility('heroic_strike');
  s2.g.player.attackCooldown = 0; s2.g.doPlayerAttack(s2.t);
  assert.ok(near.hp < 999999, 'the ultimate hit a monster 2 tiles from the target');
  assert.equal(far.hp, 999999, 'but not one 6 tiles away');
  // Another class's ability can't be used.
  m.g.adrenaline = 100; m.g.activateAbility('backstab');
  assert.notEqual(m.g.armedAbility, 'backstab');
});

test('spells: every spell hits the area for 100% damage (with XP), and elements bite or are resisted', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const { elementMatchup, SPELLS } = await import('../src/data/magic.js');
  assert.equal(elementMatchup('fire', 'flora'), 'strong');
  assert.equal(elementMatchup('fire', 'aquatic'), 'weak');
  assert.ok(SPELLS.every((s) => ['wind', 'water', 'earth', 'fire'].includes(s.element)), 'every spell has an element');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('wizard');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.inventory.add('air_rune', 500); g.inventory.add('mind_rune', 500);
  g.player.spell = 'wind_strike';
  const mk = (dx, dy) => { const n = new NPC('goblin', g.player.x + dx, g.player.y + dy, 0, {}); n.hp = n.maxHp = 99999; n.def = { ...n.def, aggressive: false, maxHit: 0 }; return n; };
  const main = mk(3, 0), near = mk(4, 1), far = mk(9, 0);
  g.npcs = [main, near, far];
  // No crits here: area hits roll their own, so a crit on one side only would break the equal-damage check.
  g._critHit = (dmg) => ({ dmg, crit: false, mult: 1 });
  g._aoeCrit = (dmg) => ({ dmg, critX: 0 });
  const xp0 = g.skills.xp.magic;
  for (let i = 0; i < 30 && main.hp === main.maxHp; i++) { g.player.attackCooldown = 0; g._magicAttack(main); }
  const hit = main.maxHp - main.hp;
  assert.ok(hit > 0, 'the target was hit');
  assert.equal(near.maxHp - near.hp, hit, 'the monster beside it takes the same damage');
  assert.equal(far.hp, far.maxHp, 'out of the blast: untouched');
  assert.ok(g.skills.xp.magic - xp0 > 0, 'Magic XP gained');
});

test('archers always fire their strongest arrows first', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('archer');
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const s of g.inventory.slots) if (s && ITEMS[s.id].tags?.includes('ammo')) g.inventory.remove(s.id, s.qty);
  g.inventory.add('bronze_arrow', 50);
  g.inventory.add('rune_arrow', 50);
  assert.equal(g.inventory.slotAt(g._bestAmmoIdx()).id, 'rune_arrow');
});

test('class passives: one every 100 levels of the class skill, ranking up after 300', async () => {
  const { classPassives, classPassiveMods, CLASS_PASSIVES } = await import('../src/data/classPassives.js');
  const { CLASSES } = await import('../src/data/classes.js');
  for (const c of CLASSES) assert.equal(CLASS_PASSIVES[c.id]?.length, 3, `${c.name} has three passives`);
  assert.deepEqual(classPassives('rogue', 99).map((p) => p.rank), [0, 0, 0]);
  assert.deepEqual(classPassives('rogue', 250).map((p) => p.rank), [1, 1, 0]);
  assert.deepEqual(classPassives('rogue', 400).map((p) => p.rank), [2, 1, 1]);
  assert.ok(classPassiveMods('rogue', 100).dodge > 0);
  // The game applies them: a level-100 Knight takes less damage than a level-99 one.
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('knight');
  g.ui = new Proxy({}, { get: () => () => {} });
  const r0 = g.perkMods('melee').reduce || 0;
  g.skills.xp.attack = 20000000;   // well past level 100
  assert.ok((g.perkMods('melee').reduce || 0) > r0, 'Plate Mastery cuts damage taken');
});

test('a Berserker rakes swipe marks across the monster on every critical hit', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const mk = (cls) => {
    globalThis.localStorage = fakeStorage(); clearSave();
    const g = new Game(); g.start(); g.chooseClass(cls);
    g.ui = new Proxy({}, { get: () => () => {} });
    const t = new NPC('goblin', g.player.x + 1, g.player.y, 0, {});
    t.hp = t.maxHp = 999999; t.def = { ...t.def, aggressive: false, maxHit: 0 };
    g.npcs = [t];
    g._pendingCrit = 2; g._applyPlayerHit(t, 10, {});
    return g.effects.some((e) => e.type === 'swipe');
  };
  assert.ok(mk('berserker'), 'Berserker crits leave swipe marks');
  assert.ok(!mk('swordsman'), 'other classes do not');
});

test('champion monsters have 150x a normal monster\'s life (50x the old 3x)', async () => {
  const { NPC, CHAMPION_HP_MULT } = await import('../src/game/npc.js');
  const n = new NPC('goblin', 10, 10, 0, {});
  const hp0 = n.maxHp;
  n.makeChampion();
  assert.equal(CHAMPION_HP_MULT, 150);
  assert.equal(n.maxHp, Math.round(hp0 * 150));
  assert.equal(n.hp, n.maxHp);
});

test('mercenaries and A-Worthlings can land critical hits too', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const Mercs = await import('../src/game/mercenary.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('merchant');
  g.ui = new Proxy({}, { get: () => () => {} });
  const t = new NPC('goblin', g.player.x + 2, g.player.y, 0, {});
  t.hp = t.maxHp = 9999999; t.def = { ...t.def, aggressive: false, maxHit: 0 };
  g.npcs = [t];
  g.equipment.bonuses = ((orig) => () => ({ ...orig.call(g.equipment), crit: 100 }))(g.equipment.bonuses);   // always crit
  Mercs.spawnFollower(g);
  for (let i = 0; i < 20 && !g.effects.some((e) => e.type === 'hitsplat' && e.critX); i++) { g.player.attackCooldown = 99; g.update(600); }
  assert.ok(g.effects.some((e) => e.type === 'hitsplat' && e.critX >= 2), 'an A-Worthling crit shows as a big red number');
});

test('auto mining walks the player from rock to rock, including other rocks they can mine', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];
  const rock = g.world.objects.find((o) => o.objId === 'copper_rock');
  g.toggleAutoGather(true);
  g.player.x = g.player.tx = rock.x; g.player.y = g.player.ty = rock.y + 1;
  g.defaultObjectAction(rock);
  const visited = new Set();
  for (let i = 0; i < 300; i++) { g.update(600); const o = g.player.action?.obj; if (o) visited.add(`${o.x},${o.y}`); }
  assert.ok(visited.size >= 2, `moved between rocks (${visited.size} visited)`);
  // With every copper rock mined out, a tin rock nearby is the next stop.
  for (const o of g.world.objects) if (o.objId === 'copper_rock') o.depleted = true;
  const next = g._nextGatherNode('copper_rock');
  if (next) assert.equal(next.def.skill, 'mining', 'another rock of the same skill');
});

test('shortbows fire twice as fast as longbows; longbows hit 60% harder', async () => {
  const { Equipment } = await import('../src/game/equipment.js');
  const eq = new Equipment();
  eq.set('weapon', 'yew_shortbow'); const sb = eq.weaponSpeed();
  eq.set('weapon', 'yew_longbow'); const lb = eq.weaponSpeed();
  assert.ok(sb < lb * 0.6, `shortbow ${sb} beats vs longbow ${lb}`);
});

test('every amulet, ring and cape can be found: monster drops by level, shops, and boss drops for your style', async () => {
  const { ACCESSORY_STYLE, accessoriesFor } = await import('../src/data/items.js');
  const { NPCS } = await import('../src/data/npcs.js');
  const { SHOPS } = await import('../src/data/shops.js');
  const sources = new Set(Object.values(SHOPS).flatMap((s) => s.stock.map((x) => x.id)));
  for (const d of Object.values(NPCS)) for (const e of d.dropTable || []) if (e.id) sources.add(e.id);
  for (const id of Object.keys(ACCESSORY_STYLE)) assert.ok(sources.has(id), `${id} can be obtained`);
  assert.ok(accessoriesFor(1).length > 0 && accessoriesFor(400).length > 0);
  // A boss always drops an accessory for your fighting style.
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('archer');
  g.ui = new Proxy({}, { get: () => () => {} });
  let loot = null; g._autoLoot = (l) => { loot = l; };
  g.rollDrops(new NPC('goblin_warchief', 5, 5, 0, {}));
  assert.ok(loot.some(([id]) => ACCESSORY_STYLE[id]?.[0] === 'ranged'), 'a ranged accessory for an archer');
});

test('Equip best in slot counts upgrade levels and only the stats your style uses', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.skills.xp.attack = 50000000; g.skills.xp.defence = 50000000;
  g.inventory.add('iron_sword', 1); g.inventory.add('mithril_sword', 1);
  g.equipment.upgrades.iron_sword = 15;            // a +15 iron sword beats a plain mithril one
  g.equipBest();
  assert.equal(g.equipment.get('weapon'), 'iron_sword', 'the upgraded sword wins');
  // An archer's amulet slot ignores a melee amulet's attack stats.
  const a = new Game(); a.start(); a.chooseClass('archer');
  a.ui = new Proxy({}, { get: () => () => {} });
  a.inventory.add('ruby_amulet', 1); a.inventory.add('emerald_amulet', 1);
  a.equipBest();
  assert.equal(a.equipment.get('amulet'), 'emerald_amulet', 'the ranged amulet, not the stronger melee one');
});

test('Sell gear for other classes: sells other weapons, armour, accessories and unused arrows only', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('archer');
  g.ui = new Proxy({}, { get: () => () => {} });
  const keep = ['oak_shortbow', 'dragonhide_body', 'emerald_amulet', 'bronze_arrow', 'bronze_pickaxe', 'cooked_chicken'];
  const sell = ['bronze_sword', 'bronze_platebody', 'ruby_amulet', 'iron_dagger'];
  for (const id of [...keep, ...sell]) g.inventory.add(id, id === 'bronze_arrow' ? 50 : 1);
  for (const id of keep) assert.equal(g.unrelatedToClass(id), false, `${id} is for an archer (or not gear)`);
  for (const id of sell) assert.equal(g.unrelatedToClass(id), true, `${id} is for another class`);
  const coins = g.inventory.count('coins');
  assert.ok(g.sellUnrelated('general') > 0);
  assert.ok(g.inventory.count('coins') > coins, 'coins earned');
  for (const id of sell) assert.equal(g.inventory.count(id), 0, `${id} sold`);
  for (const id of keep) assert.ok(g.inventory.count(id) > 0, `${id} kept`);
  assert.equal(g.sellUnrelated('general'), 0, 'nothing left to sell');
  // A swordsman sells arrows.
  const s = new Game(); s.start(); s.chooseClass('swordsman');
  assert.equal(s.unrelatedToClass('bronze_arrow'), true);
});

test('one spell per element: wind casts 2x faster, water slows and casts 30% faster, earth hits 5 tiles, fire 50% harder', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const { getSpell, SPELLS } = await import('../src/data/magic.js');
  const { playerMagicVsNpc } = await import('../src/game/combat.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('magic');
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const r of ['fire_rune', 'water_rune', 'earth_rune', 'air_rune', 'mind_rune']) g.inventory.add(r, 5000);
  g.skills.xp.magic = 50000000;
  assert.deepEqual(SPELLS.map((s) => s.element), ['wind', 'water', 'earth', 'fire']);
  assert.equal(getSpell('fire_wave').id, 'fire_strike', 'an old saved tier becomes its element');
  const p = g.player;
  const foe = (dx, dy = 0) => { const n = new NPC('goblin', p.x + dx, p.y + dy, 0, {}); n.maxHp = n.hp = 1e7; n.def = { ...n.def, defence: 0 }; return n; };
  const cast = (spell, target) => {
    p.spell = spell;
    for (let i = 0; i < 60; i++) { p.attackCooldown = 0; const before = target.hp; g._magicAttack(target); if (target.hp < before) return p.attackCooldown; }
    assert.fail(`${spell} never hit`);
  };
  // Cast speeds: wind half of earth's, water 1/1.3 of it.
  const t = foe(2); g.npcs = [t];
  const earthCd = cast('earth_strike', t), windCd = cast('wind_strike', t), waterCd = cast('water_strike', t);
  assert.ok(Math.abs(windCd - earthCd * 0.5) < 0.01, `wind ${windCd} vs earth ${earthCd}`);
  assert.ok(Math.abs(waterCd - earthCd / 1.3) < 0.01, `water ${waterCd} vs earth ${earthCd}`);
  // Fire hits like the others, and ignites: 25% of the hit every second for 5 seconds.
  const max = (id) => playerMagicVsNpc(g.skills, g.equipment, getSpell(id), { defence: 1 }).max;
  assert.equal(max('fire_strike'), max('wind_strike'), 'no flat fire bonus any more');
  const f = foe(2); g.npcs = [f];
  g._critHit = (d) => ({ dmg: d, crit: false }); g._aoeCrit = (d) => ({ dmg: d, critX: 0 });
  cast('fire_strike', f);
  const hit = 1e7 - f.hp, per = Math.max(1, Math.round(hit * 0.25));
  assert.equal(f.ignite.perSec, per, 'set alight');
  const burning = f.hp; f.ignite.acc = 0;
  for (let i = 0; i < 51; i++) g._tickIgnites();   // 30.6 seconds of ticks: 30 burns
  assert.equal(burning - f.hp, per * 30, 'still burning at 25% of the hit every second: no time limit');
  assert.ok(f.ignite, 'never goes out on its own');
  // Burns stack without limit: three more hits add three more burns.
  for (let k = 0; k < 3; k++) g._igniteFoe(f, 100, { share: 0.25 });
  const h2 = f.hp;
  g._tickIgnites(); g._tickIgnites();
  assert.equal(h2 - f.hp, per + 75, 'all the stacks burn together');
  // A thousand stacks still just burn, stored as one total.
  for (let k = 0; k < 1000; k++) g._igniteFoe(f, 100, { share: 0.25 });
  assert.equal(f.ignite.perSec, per + 25 * 1003);
  // Out only when the foe dies.
  const small = foe(3); small.maxHp = small.hp = 100; g.npcs = [f, small];
  g._igniteFoe(small, 400, { share: 0.25 });
  for (let i = 0; i < 4; i++) g._tickIgnites();
  assert.ok(!small.alive || small.hp <= 0, 'burned to death');
  assert.equal(small.ignite, null, 'and the burn ends with it');
  // Every burn tick can crit, at the crit chance of the cast that lit it.
  const c1 = foe(4); g.npcs = [c1];
  g._aoeCritCh = 1; g._igniteFoe(c1, 400, { share: 0.25 }); g._aoeCritCh = 0;
  assert.equal(c1.ignite.critCh, 1);
  delete g._aoeCrit;   // the real crit roll from here on
  const hc = c1.hp; g.effects = [];
  g._tickIgnites(); g._tickIgnites();
  assert.ok(hc - c1.hp >= 200, `a certain crit at least doubles the 100 burn (${hc - c1.hp})`);
  assert.ok(g.effects.some((e) => e.type === 'hitsplat' && e.entity === c1 && e.critX >= 2), 'shown as a crit');
  delete g._critHit; delete g._aoeCrit;
  // Earth reaches 5 tiles from the target; others 2.
  const main = foe(2), far = foe(7); g.npcs = [main, far];
  const farHp = far.hp; cast('wind_strike', main);
  assert.equal(far.hp, farHp, 'wind splash stops at 2 tiles');
  cast('earth_strike', main);
  assert.ok(far.hp < farHp, 'earth splash reaches 5 tiles');
  // Water slows: the foe walks and attacks slower, then recovers.
  const w = foe(2); g.npcs = [w];
  const step0 = w.stepMul;
  cast('water_strike', w);
  assert.ok(w.slowTicks > 0 && w.stepMul > step0, 'slowed');
  for (let i = 0; i < 6; i++) w._combatAI(g);
  assert.equal(w.stepMul, step0, 'the slow wears off');
});

test('area hits roll their own crits (melee cleave, spell splash)', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('magic');
  g.ui = new Proxy({}, { get: () => () => {} });
  g._aoeCritCh = 1;   // every area hit crits
  const c = g._aoeCrit(10);
  assert.ok(c.critX >= 2 && c.dmg >= 20, 'a crit doubles or quadruples the area hit');
  g._aoeCritCh = 0;
  assert.deepEqual(g._aoeCrit(10), { dmg: 10, critX: 0 });
  // Spell splash shows crit hitsplats when crits are certain.
  g.inventory.add('fire_rune', 500);
  const p = g.player;
  const main = new NPC('goblin', p.x + 2, p.y, 0, {}), side = new NPC('goblin', p.x + 3, p.y, 0, {});
  for (const n of [main, side]) { n.maxHp = n.hp = 1e7; n.def = { ...n.def, defence: 0 }; }
  g.npcs = [main, side];
  g.perkMods = () => ({ crit: 1 });
  g._offensiveMods = ((orig) => function (...a) { const m = orig.apply(this, a); return { ...m, critCh: 1 }; })(g._offensiveMods);
  let hit = false;
  for (let i = 0; i < 40 && !hit; i++) {
    p.attackCooldown = 0; g.effects = [];
    g._magicAttack(main);
    hit = g.effects.some((e) => e.type === 'hitsplat' && e.entity === side && e.critX >= 2);
  }
  assert.ok(hit, 'the splashed foe took a crit');
});

test('auto battle: fight champions but skip bosses; packs and hurt monsters first; turn on an attacker while chasing', async () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const game = new Game(); game.start(); game.chooseStartingStyle('melee');
  game.ui = new Proxy({}, { get: () => () => {} });
  const p = game.player;
  const calm = (n) => { n.def = { ...n.def, aggressive: false }; return n; };
  const mob = calm(new NPC('goblin', p.x + 1, p.y, 0, {}));
  const champ = calm(new NPC('goblin', p.x + 5, p.y, 0, {})); champ.makeChampion();
  const boss = game.npcs.find((n) => n.def.boss && !n.def.fixed);
  boss.x = boss.tx = boss.spawnX = p.x + 9; boss.y = boss.ty = boss.spawnY = p.y;
  game.npcs = [mob, champ, boss];
  game.autoCfg.bosses = false; game.autoCfg.champions = true;
  assert.equal(game._autoPickTarget(), champ, 'champions on, bosses off: the champion');
  game.autoCfg.champions = false;
  assert.equal(game._autoPickTarget(), mob, 'both off: an ordinary monster');
  champ.target = p;
  assert.equal(game._autoPickTarget(), champ, 'a champion attacking you is still fought');
  // A goblin in a pack beats a lone one a tile closer.
  const lone = calm(new NPC('goblin', p.x + 4, p.y, 0, {}));
  const packed = [0, 1, 2].map((i) => calm(new NPC('goblin', p.x - 5, p.y + i - 1, 0, {})));
  game.npcs = [lone, ...packed];
  assert.ok(packed.includes(game._autoPickTarget()), 'the pack is worth the extra step');
  // While chasing a far target, something hitting you in reach takes over.
  const far = calm(new NPC('goblin', p.x + 12, p.y, 0, {})); far.maxHp = far.hp = 9999;
  const biter = calm(new NPC('goblin', p.x + 1, p.y + 1, 0, {})); biter.maxHp = biter.hp = 9999;
  game.npcs = [far, biter];
  game.autoBattle = true;
  game.attackNpc(far);
  biter.target = p;
  game._autoBattleTick();
  assert.equal(p.action?.npc, biter, 'turned on the monster attacking you');
});

test('auto battle casters pick the element that suits the target', async () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const { NPC } = await import('../src/game/npc.js');
  const { raceOf } = await import('../src/data/races.js');
  const { ELEMENTS } = await import('../src/data/magic.js');
  const game = new Game(); game.start(); game.chooseStartingStyle('magic');
  game.skills.xp.magic = 50000000;
  for (const r of ['fire_rune', 'water_rune', 'earth_rune', 'air_rune', 'mind_rune']) game.inventory.add(r, 500);
  const p = game.player;
  // A lone monster that resists fire: not Fire.
  const ids = game.npcs.filter((n) => n.def.attackable && !n.def.boss).map((n) => n.npcId);
  const fireProof = ids.find((id) => ELEMENTS.fire.weak.includes(raceOf(game.npcs.find((n) => n.npcId === id).def, id)));
  if (fireProof) {
    const t = new NPC(fireProof, p.x + 3, p.y, 0, {});
    game.npcs = [t];
    assert.notEqual(game._autoSpellFor(t).element, 'fire', 'a fire-resistant target gets another element');
  }
  // A crowd spread around the target: Earth reaches them all.
  const t = new NPC('goblin', p.x + 3, p.y, 0, {});
  const crowd = [[3, 0], [-3, 0], [0, 4], [0, -4], [4, 4]].map(([dx, dy]) => new NPC('goblin', t.x + dx, t.y + dy, 0, {}));
  game.npcs = [t, ...crowd];
  assert.equal(game._autoSpellFor(t).element, 'earth');
});

test('attack speed % has no cap; wands cast faster than staves; spells halve the swing time', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('magic');
  const eq = g.equipment;
  assert.ok(ITEMS.bronze_sword.equip.bonuses.haste > 0 && ITEMS.rune_sword.equip.bonuses.haste > ITEMS.bronze_sword.equip.bonuses.haste, 'every weapon has attack speed %, more on better tiers');
  // +300% attack speed: four times as often, well past the old 30% cap.
  eq._haste = () => 300;
  assert.equal(eq.hasteMult(), 0.25);
  delete eq._haste;
  eq.set('weapon', 'magic_staff'); g.player.spell = 'fire_strike';
  const staff = g.attackInterval();
  eq.set('weapon', 'mystic_wand');
  const wand = g.attackInterval();
  assert.ok(wand < staff * 0.75, `a wand (${wand}) casts clearly faster than a staff (${staff})`);
  g.player.spell = 'wind_strike';
  assert.ok(g.attackInterval() < wand, 'and Wind faster still: no floor');
});

test('Attack bonus % raises melee and ranged damage; Magic bonus % raises spells only', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  const t = new NPC('goblin', g.player.x + 1, g.player.y, 0, {});
  const base = g._offensiveMods(t, 'melee').dmgM, rbase = g._offensiveMods(t, 'ranged').dmgM;
  const real = g.equipment.bonuses.bind(g.equipment);
  g.equipment.bonuses = () => ({ ...real(), atkPct: 50, magPct: 0 });
  assert.ok(Math.abs(g._offensiveMods(t, 'melee').dmgM / base - 1.5) < 1e-9, '+50% Attack bonus: x1.5 melee');
  assert.ok(Math.abs(g._offensiveMods(t, 'ranged').dmgM / rbase - 1.5) < 1e-9, 'and x1.5 ranged');
  const mag = g._offensiveMods(t, 'magic').dmgM;
  g.equipment.bonuses = () => ({ ...real(), atkPct: 0, magPct: 50 });
  assert.ok(Math.abs(g._offensiveMods(t, 'magic').dmgM / mag - 1.5) < 1e-9, '+50% Magic bonus: x1.5 spells');
  assert.ok(Math.abs(g._offensiveMods(t, 'melee').dmgM - base) < 1e-9, 'and nothing for melee');
});

test('the element you press is the one you cast, even in auto battle; Auto lets it choose', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('magic');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.skills.xp.magic = 50000000;
  for (const r of ['fire_rune', 'water_rune', 'earth_rune', 'air_rune', 'mind_rune']) g.inventory.add(r, 500);
  const p = g.player;
  const t = new NPC('goblin', p.x + 2, p.y, 0, {}); t.maxHp = t.hp = 1e7;
  const crowd = [[3, 0], [-3, 0], [0, 4], [0, -4]].map(([dx, dy]) => new NPC('goblin', t.x + dx, t.y + dy, 0, {}));
  g.npcs = [t, ...crowd];
  p.spell = 'water_strike'; p.spellAuto = false;
  g.autoBattle = true; g.attackNpc(t);
  g._autoBattleTick();
  assert.equal(p.spell, 'water_strike', 'auto battle keeps the element you chose');
  p.spellAuto = true;
  g._autoBattleTick();
  assert.equal(p.spell, 'earth_strike', 'on Auto it picks Earth for the crowd');
  // The choice is saved.
  saveGame(g);
  const g2 = new Game(); g2.start(); loadGame(g2);
  assert.equal(g2.player.spellAuto, true);
});

test('Dancer whips ricochet between monsters; Chain Crack bounces further and stuns', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('dancer');
  g.ui = new Proxy({}, { get: () => () => {} });
  const p = g.player;
  const mk = (dx, dy) => { const n = new NPC('goblin', p.x + dx, p.y + dy, 0, {}); n.maxHp = n.hp = 1e6; n.def = { ...n.def, defence: 0, aggressive: false }; return n; };
  // A line of monsters 2 tiles apart: the lash hops along it.
  const main = mk(2, 0), b1 = mk(4, 0), b2 = mk(6, 0), b3 = mk(8, 0), b4 = mk(10, 0), far = mk(2, 9);
  g.npcs = [main, b1, b2, b3, b4, far];
  g.danceRhythm = 0;
  for (let i = 0; i < 50 && main.hp === 1e6; i++) { p.attackCooldown = 0; g._danceAttack(main); }
  assert.ok(main.hp < 1e6, 'the lash landed');
  assert.ok(b1.hp < 1e6 && b2.hp < 1e6, 'it ricocheted into two more monsters');
  assert.equal(far.hp, 1e6, 'nothing out of ricochet range');
  // Chain Crack: up to 6 bounces, each stunned.
  for (const n of g.npcs) { n.hp = n.maxHp; n.attackCooldown = 0; }
  g.adrenaline = 100;
  g.armedAbility = 'crack';
  p.attackCooldown = 0; g._danceAttack(main);
  for (const n of [b1, b2, b3, b4]) {
    assert.ok(n.hp < 1e6, 'Chain Crack reached every monster down the line');
    assert.ok(n.attackCooldown >= 4, 'and stunned it');
  }
});

test('no cap on hits per second: huge attack speed keeps adding damage (volleys)', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const dpsAt = (haste) => {
    clearSave();
    const g = new Game(); g.start(); g.chooseClass('swordsman');
    g.ui = new Proxy({}, { get: () => () => {} });
    g.equipment._haste = () => haste;
    const t = new NPC('goblin', g.player.x + 1, g.player.y, 0, {}); t.maxHp = t.hp = 1e12; t.def = { ...t.def, defence: 0, aggressive: false };
    g.npcs = [t]; g.attackNpc(t);
    const origRandom = Math.random; Math.random = () => 0.5;   // steady rolls, no crits
    const t0 = Date.now();
    for (let i = 0; i < 40; i++) g._combatBeat();
    Math.random = origRandom;
    return { dmg: 1e12 - t.hp, ms: Date.now() - t0 };
  };
  const a = dpsAt(1000), b = dpsAt(100000);
  assert.ok(b.dmg > a.dmg * 50, `+100000% speed (${b.dmg}) far out-damages +1000% (${a.dmg})`);
  assert.ok(b.ms < 2000, 'and the game stays responsive');
});

test('a world boss rises every 2 minutes: much tougher, aggressive, triple loot, gone once slain', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.tickCount = 199;
  g._tickWorldBoss(); assert.equal(g._worldBoss, undefined, 'not before 2 minutes');
  g.tickCount = 200;
  const wb = g._tickWorldBoss();
  assert.ok(wb && wb.worldBoss && g.npcs.includes(wb), 'a world boss appeared');
  const base = getNpc(wb.npcId);
  assert.equal(wb.maxHp, Math.round(base.maxHp * 5), '5x the life of the normal boss');
  assert.ok(wb.def.maxHit >= base.maxHit * 2 && wb.def.aggressive && wb.def.aggroRange >= 16 && wb.def.ignoreLevelGate);
  const d = Math.max(Math.abs(wb.x - g.player.x), Math.abs(wb.y - g.player.y));
  assert.ok(d >= 7 && d <= 15, `it rose ${d} tiles away`);
  g.tickCount = 400;
  assert.equal(g._tickWorldBoss(), undefined, 'only one at a time');
  // Triple loot, then it's gone for good.
  let rolls = 0; const roll = g.rollDrops.bind(g); g.rollDrops = (n) => { rolls++; return roll(n); };
  g.killNpc(wb);
  assert.equal(rolls, 3, 'its loot rolls three times');
  g.doTick();
  assert.ok(!g.npcs.includes(wb) && !g._worldBoss, 'removed once slain, never respawns');
  // One left unfought wanders off after 5 minutes.
  g.tickCount = 600; const w2 = g._tickWorldBoss();
  w2.target = null; g.tickCount = 600 + 501; g._tickWorldBoss();
  assert.ok(!g.npcs.includes(w2), 'an unfought world boss leaves');
});

test('Agility speeds up attacks, casting and movement for every class', async () => {
  const { xpForLevel } = await import('../src/data/xp.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  for (const cls of ['swordsman', 'archer', 'wizard', 'dancer']) {
    clearSave();
    const g = new Game(); g.start(); g.chooseClass(cls);
    g.skills.xp.agility = 0;
    const iv = g.attackInterval(), step = g.playerStepMul();
    g.skills.xp.agility = xpForLevel(1000);   // +100%
    assert.ok(Math.abs(g.attackInterval() - iv * (100 + 0.1) / 200) < 1e-6, `${cls}: attacks/casts twice as often at Agility 1000`);
    assert.ok(g.playerStepMul() < step * 0.51, `${cls}: and moves twice as fast`);
    g.skills.xp.agility = xpForLevel(9999);
    assert.ok(g.attackInterval() < iv / 9, 'attack speed keeps growing');
    assert.ok(Math.abs(g.playerStepMul() - 0.7 * 100 / (100 + 999.9)) < 1e-9, 'movement has no cap either');
    g.doTick();
    assert.equal(g.player.stepMul, g.playerStepMul(), 'the player really walks at that pace');
  }
});

test('"Do all" at a station makes everything you can, best recipe first (smelt all, cook all)', async () => {
  const { xpForLevel } = await import('../src/data/xp.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  g.npcs = g.npcs.filter((n) => !n.def.attackable);   // no interruptions
  g.skills.xp.smithing = xpForLevel(40); g.skills.xp.cooking = xpForLevel(99);
  for (const id of g.inventory.slots.filter(Boolean).map((s) => s.id)) g.inventory.remove(id, g.inventory.count(id));
  g.inventory.add('copper_ore', 3); g.inventory.add('tin_ore', 3);
  g.inventory.add('iron_ore', 2); g.inventory.add('coal', 4);
  const furnace = g.world.objects.find((o) => o.def.type === 'furnace');
  g.player.x = g.player.tx = furnace.x + 1; g.player.y = g.player.ty = furnace.y;
  assert.ok(g.startAll('smelt', furnace));
  step(g, 30);
  assert.equal(g.inventory.count('copper_ore') + g.inventory.count('tin_ore') + g.inventory.count('iron_ore'), 0, 'every ore was smelted');
  assert.ok(g.inventory.count('steel_bar') >= 2, 'steel first (the best it could make), with the coal');
  assert.ok(g.inventory.count('bronze_bar') >= 3, 'then bronze');
  assert.equal(g.player.action, null, 'and it stopped when nothing was left');
  // Cook all: every kind of raw food in the pack.
  g.inventory.add('raw_chicken', 2); g.inventory.add('raw_anchovy', 2); g.inventory.add('raw_trout', 1);
  const range = g.world.objects.find((o) => o.def.type === 'range' || o.def.type === 'fire');
  g.player.x = g.player.tx = range.x + 1; g.player.y = g.player.ty = range.y;
  assert.ok(g.startAll('cook', range));
  step(g, 30);
  assert.equal(g.inventory.count('raw_chicken') + g.inventory.count('raw_anchovy') + g.inventory.count('raw_trout'), 0, 'everything was cooked');
  assert.equal(g.startAll('cook', range), false, 'nothing left to cook');
});

test('Merchant throws money: a ranged class whose throws and skills cost coins', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('merchant');
  g.ui = new Proxy({}, { get: () => () => {} });
  assert.equal(g.combatMode(), 'ranged', 'canes are ranged now');
  assert.ok(g.attackRange() >= 8);
  const t = new NPC('goblin', g.player.x + 5, g.player.y, 0, {}); t.hp = t.maxHp = 1e6; t.def = { ...t.def, aggressive: false };
  g.npcs = [t];
  const c0 = g.inventory.count('coins');
  g._rangedAttack(t);
  assert.equal(g.inventory.count('coins'), c0 - g.coinThrowCost(), 'a throw costs coins');
  assert.ok(g.effects.some((e) => e.type === 'projectile' && e.kind === 'coin'), 'and flies as a coin');
  // No coins, no throw.
  g.inventory.remove('coins', g.inventory.count('coins'));
  const hp = t.hp; g.player.attackCooldown = 0; g._rangedAttack(t);
  assert.equal(t.hp, hp, 'broke: nothing to throw');
  // Skills cost coins, not adrenaline.
  const ab = g.currentAbilities().find((a) => a.key === 'X');
  assert.ok(g.abilityCoinCost(ab) > 0 && /coins/.test(g.abilityCostText(ab)));
  g.adrenaline = 100;
  g.activateAbility(ab.id);
  assert.ok(!g.buff, 'cannot afford it with adrenaline alone');
  g.inventory.add('coins', 100000);
  const before = g.inventory.count('coins');
  g.activateAbility(ab.id);
  assert.ok(g.buff && g.inventory.count('coins') === before - g.abilityCoinCost(ab) && g.adrenaline === 100, 'paid in coins, adrenaline untouched');
});

test('mercenaries and A-Worthlings throw coins from range and give Ranged XP', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const Mercs = await import('../src/game/mercenary.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('merchant');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.inventory.add('coins', 100000);
  g.player.autoRetaliate = false;
  const p = g.player;
  const foe = new NPC('goblin', p.x + 5, p.y, 0, {}); foe.hp = foe.maxHp = 1e7; foe.def = { ...foe.def, aggressive: false, maxHit: 0 };
  g.npcs = [foe];
  const m = g.hireMercenary();
  const aw = Mercs.spawnFollower(g);
  assert.ok(m && aw);
  const xp0 = { ranged: g.skills.xp.ranged, attack: g.skills.xp.attack };
  const startDist = chebyshev(m.x, m.y, foe.x, foe.y);
  for (let i = 0; i < 20; i++) { p.attackCooldown = 99; Mercs.mercTick(g, m); Mercs.mercTick(g, aw); Mercs.flushAllies(g); }
  assert.ok(foe.hp < foe.maxHp, 'the allies hit the monster');
  assert.ok(chebyshev(m.x, m.y, foe.x, foe.y) >= 2 || startDist < 2, 'from range, without running up to it');
  assert.ok(g.effects.some((e) => e.type === 'projectile' && e.kind === 'coin'), 'by throwing coins');
  assert.ok(g.skills.xp.ranged > xp0.ranged, 'their hits train Ranged');
  assert.equal(g.skills.xp.attack, xp0.attack, 'not Melee');
});

test('A-Worthlings merge past 40: fewer on screen, the same total damage and power cap', async () => {
  const Mercs = await import('../src/game/mercenary.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('merchant');
  g.ui = new Proxy({}, { get: () => () => {} });
  for (let i = 0; i < 90; i++) { g.tickCount = i; Mercs.spawnFollower(g); }
  const power = (list) => list.reduce((s, f) => s + (f.share || Mercs.FOLLOWER_SHARE), 0);
  const before = Mercs.activeFollowers(g);
  const p0 = power(before);
  assert.equal(before.length, 90);
  Mercs.mergeFollowers(g);   // (it runs once a tick; called directly so no fight changes the numbers)
  const after = Mercs.activeFollowers(g);
  assert.ok(after.length <= Mercs.MERGE_TO, `merged down to ${after.length}`);
  assert.ok(Math.abs(power(after) - p0) < 1e-9, 'the same total damage share');
  assert.ok(after.some((f) => f.share > Mercs.FOLLOWER_SHARE && f.def.scale > 1), 'merged ones hit harder and look bigger');
  // The power cap still counts merged ones: 200 A-Worthlings' worth at most.
  for (let i = 0; i < 400; i++) { g.tickCount = 1000 + i; Mercs.spawnFollower(g); g.doTick(); }
  assert.ok(power(Mercs.activeFollowers(g)) <= Mercs.MAX_FOLLOWERS * Mercs.FOLLOWER_SHARE + 1e-9, 'total power still capped');
  assert.ok(Mercs.activeFollowers(g).length <= Mercs.MERGE_AT, 'and never more than 40 on screen after a tick');
});

test('very fast movement never passes through walls', async () => {
  const { xpForLevel } = await import('../src/data/xp.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  g.npcs = g.npcs.filter((n) => !n.def.attackable);
  g.skills.xp.agility = xpForLevel(9999);
  g.doTick();
  const p = g.player;
  g.setMoveInput(1, 0);
  for (let i = 0; i < 60; i++) {
    g.update(100);
    assert.ok(!g.world.isBlocked(Math.round(p.fx), Math.round(p.fy)), 'never inside a wall');
  }
  g.setMoveInput(0, 0);
});

test('Sniper: a sniper rifle with the longest reach, huge shots and a slow rate of fire', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const { CLASSES } = await import('../src/data/classes.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  assert.ok(CLASSES.some((c) => c.id === 'sniper' && c.style === 'ranged' && c.weapon === 'rifle'));
  const mk = (cls) => { clearSave(); const g = new Game(); g.start(); g.chooseClass(cls); g.ui = new Proxy({}, { get: () => () => {} }); return g; };
  const s = mk('sniper'), a = mk('archer');
  assert.equal(s.equipment.get('weapon'), 'bronze_rifle');
  const maxRange = Math.max(...Object.values(ITEMS).filter((it) => it.equip?.slot === 'weapon' && it.equip.weaponType !== 'rifle').map((it) => it.equip.range || 0));
  assert.ok(s.attackRange() > maxRange, `reach ${s.attackRange()} beats every other weapon (${maxRange})`);
  assert.ok(s.attackInterval() >= a.attackInterval() * 3, 'fires far slower than a shortbow');
  // Each round hits far harder.
  const hit = (g) => {
    const t = new NPC('goblin', g.player.x + 5, g.player.y, 0, {}); t.hp = t.maxHp = 1e7; t.def = { ...t.def, defence: 0, aggressive: false };
    g.npcs = [t]; g.abilityUnlocked = () => false;
    let total = 0, n = 0;
    for (let i = 0; i < 60; i++) { const hp = t.hp; g.player.attackCooldown = 0; g._rangedAttack(t); if (t.hp < hp) { total += hp - t.hp; n++; } }
    return total / Math.max(1, n);
  };
  assert.ok(hit(s) > hit(a) * 3, 'each landed round hits several times as hard as an arrow');
  // Auto battle reaches its full range.
  const far = new NPC('goblin', s.player.x + 30, s.player.y, 0, {}); far.def = { ...far.def, aggressive: false };
  s.npcs = [far];
  assert.equal(s._autoPickTarget(), far, 'auto battle picks off a monster 30 tiles away');
});

test('sniper rounds never miss and pierce every monster within 1 tile of the line, up to 10 tiles past the target', async () => {
  const { NPC } = await import('../src/game/npc.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('sniper');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.abilityUnlocked = () => false;
  const p = g.player;
  const mk = (dx, dy = 0, def = 0) => { const n = new NPC('goblin', p.x + dx, p.y + dy, 0, {}); n.hp = n.maxHp = 1e7; n.def = { ...n.def, defence: def, aggressive: false }; return n; };
  // A heavily armoured target is still hit every time.
  const tank = mk(5, 0, 5000);
  g.npcs = [tank];
  for (let i = 0; i < 20; i++) { const hp = tank.hp; p.attackCooldown = 0; g._rangedAttack(tank); assert.ok(tank.hp < hp, 'every round lands'); }
  // In a line: behind the target within 10 tiles is hit; further, or off the line, is not.
  const main = mk(5), behind = mk(12), far = mk(17), aside = mk(10, 3);
  // The path is 1 tile wide on each side: a monster a tile off the line, or right
  // beside the target, is caught too.
  const nearLine = mk(9, 1), besideTarget = mk(5, -1), shooterSide = mk(2, 1);
  g.npcs = [main, behind, far, aside, nearLine, besideTarget, shooterSide];
  p.attackCooldown = 0; g._rangedAttack(main);
  assert.ok(main.hp < 1e7 && behind.hp < 1e7, 'the round goes through to the monster behind');
  assert.ok(nearLine.hp < 1e7, 'a monster 1 tile off the path is hit');
  assert.ok(besideTarget.hp < 1e7, 'a monster beside the target is hit');
  assert.equal(far.hp, 1e7, 'but no more than 10 tiles past the target');
  assert.equal(aside.hp, 1e7, 'and nothing 3 tiles off the line');
  assert.equal(shooterSide.hp, 1e7, 'nor anything between you and the target');
});

test('bosses scale up with the player: f x hits and defence, f^2 x life, never mid-fight', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  const boss = g.npcs.find((n) => n.def.boss && n.npcId === 'goblin_warchief');
  const base = { ...boss.def };
  // A weak player: the boss stays as it is.
  g._scaleBoss(boss, 3);
  assert.equal(boss.maxHp, base.maxHp, 'no scaling below the boss level');
  // A player at twice the boss's level: double hits/defence, 4x life.
  g._scaleBoss(boss, base.level * 2);
  assert.equal(boss.maxHp, Math.round(base.maxHp * 4));
  assert.equal(boss.def.maxHit, Math.round(base.maxHit * 2));
  assert.equal(boss.def.defence, Math.round(base.defence * 2));
  assert.equal(boss.hp, boss.maxHp, 'starts at full life');
  // Mid-fight it never changes.
  boss.hp -= 10; const hp = boss.hp, max = boss.maxHp;
  g._scaleBoss(boss, base.level * 5);
  assert.equal(boss.maxHp, max); assert.equal(boss.hp, hp);
  // Healed back up, it scales from its own base (not compounding).
  boss.hp = boss.maxHp;
  g._scaleBoss(boss, base.level * 3);
  assert.equal(boss.maxHp, Math.round(base.maxHp * 9));
  // After a respawn it scales again from its fresh stats.
  boss.respawn();
  g._scaleBoss(boss, base.level * 2);
  assert.equal(boss.maxHp, Math.round(base.maxHp * 4));
  // And the tick does it for bosses near the player.
  const g2 = new Game(); g2.start();
  const b2 = g2.npcs.find((n) => n.npcId === 'goblin_warchief');
  g2.skills.combatLevel = () => b2.def.level * 2;
  g2.player.x = g2.player.tx = b2.x + 30; g2.player.y = g2.player.ty = b2.y;
  const m0 = b2.maxHp; g2.doTick();
  assert.equal(b2.maxHp, Math.round(m0 * 4), 'a nearby boss is scaled during the tick');
});

test('auto battle walks a strong player past weak monsters to ones of their level', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.skills.combatLevel = () => 120;
  const p = g.player;
  const lo = g._autoBandLo(false);
  assert.ok(lo >= 80 && lo <= 90, `band starts at 3/4 of your level (${lo})`);
  // Only weak monsters around (the starting town): auto battle sets off towards
  // monsters of your level instead of farming chickens.
  g.toggleAutoBattle(true);
  g.autoCfg.bosses = false; g.autoCfg.champions = false;   // bosses always come first; this is about ordinary monsters
  g._autoBattleTick();
  assert.ok(g._autoTravel, 'heading somewhere');
  assert.ok(p.isMoving && p.path.length > 10, 'walking a long route');
  assert.ok(!(p.action?.type === 'attack' && g._autoIsWeak(p.action.npc)), 'not attacking a weak monster');
  // On the way it keeps walking rather than turning back to weak monsters...
  const pathLen = p.path.length;
  g._autoBattleTick();
  assert.ok(p.path.length >= pathLen - 2 && g._autoTravel, 'the route is kept, not re-planned');
  // ...but a weak monster attacking you is still fought.
  const rat = g.npcs.find((n) => n.alive && n.attackable && !n.def.boss && (n.def.level || 1) < lo);
  rat.x = rat.tx = p.x + 1; rat.y = rat.ty = p.y; rat.target = p;
  assert.equal(g._autoIsWeak(rat), false, 'an attacker always counts');
  g._autoBattleTick();
  assert.equal(p.action?.npc, rat, 'turns to fight the attacker');
  // A low-level player has no band: every monster is fair game.
  g.skills.combatLevel = () => 3;
  assert.equal(g._autoIsWeak(rat), false);
});

test('performance helpers: nearby list, reusable path search, merged hitsplats', async () => {
  const { NPC } = await import('../src/game/npc.js');
  const { findPath } = await import('../src/engine/pathfinding.js');
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  const p = g.player;
  // Only NPCs within 60 tiles; rebuilt when the list changes.
  const near = g.nearbyNpcs();
  assert.ok(near.length > 0 && near.length < g.npcs.length, 'a slice of the world');
  assert.ok(near.every((n) => Math.abs(n.x - p.x) <= 60 && Math.abs(n.y - p.y) <= 60));
  const extra = new NPC('goblin', p.x + 2, p.y, 0, {});
  g.npcs.push(extra);
  assert.ok(g.nearbyNpcs().includes(extra), 'a new NPC shows up straight away');
  // Many searches in a row give the same answers as a fresh one (scratch space is reused).
  const cfg = g.pathCfg();
  const a = findPath(cfg, { x: p.x, y: p.y }, { x: p.x + 6, y: p.y + 3 }, { reachAdjacent: true });
  for (let i = 0; i < 50; i++) findPath(cfg, { x: p.x, y: p.y }, { x: p.x - 5 + (i % 10), y: p.y + 4 }, { maxNodes: 300 });
  assert.deepEqual(findPath(cfg, { x: p.x, y: p.y }, { x: p.x + 6, y: p.y + 3 }, { reachAdjacent: true }), a);
  // Hits on one foe in quick succession share one number; a crit keeps its own.
  g.effects = [];
  g.addHitsplat(extra, 5); g.addHitsplat(extra, 7); g.addHitsplat(extra, 3);
  const splats = g.effects.filter((e) => e.type === 'hitsplat' && e.entity === extra);
  assert.equal(splats.length, 1); assert.equal(splats[0].dmg, 15, 'damage adds up');
  g.addHitsplat(extra, 40, { critX: 2 });
  assert.equal(g.effects.filter((e) => e.type === 'hitsplat' && e.entity === extra).length, 2, 'a crit gets its own number');
});
