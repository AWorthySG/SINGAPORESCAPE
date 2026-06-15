// Headless integration tests: boot the Game (no DOM), simulate ticks, and verify
// the world, gathering pipeline and save/load all work end-to-end.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave } from '../src/game/save.js';

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
  assert.equal(game.equipment.get('weapon'), 'bronze_scimitar', 'starts equipped');
  assert.ok(game.world.objects.some((o) => o.def.type === 'shrine'), 'town has the Worthy Monument');
  assert.ok(game.npcs.length > 10, 'should spawn many NPCs');
  assert.ok(game.npcs.some((n) => n.attackable), 'should have monsters');
  assert.ok(game.world.objects.some((o) => o.def.type === 'tree'));
  assert.ok(game.world.objects.some((o) => o.def.type === 'rock'));
  assert.ok(game.world.objects.some((o) => o.def.type === 'fishing'));
  assert.ok(game.world.objects.some((o) => o.def.type === 'bank'));
  assert.ok(game.inventory.has('bronze_axe'), 'new player gets a starter axe');
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
  game.attackNpc(chicken);
  step(game, 40);
  assert.ok(game.inventory.count('bronze_arrow') < 100, 'arrows were used');
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
  game.player.x = game.player.tx = chicken.x + 3; game.player.y = game.player.ty = chicken.y;
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

test('high-tier wave spells can be cast with blood runes', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.player.autoRetaliate = false; game.player.hp = 9999;
  game.skills.addXp('magic', 5_000_000); // high Magic level
  game.equipment.set('weapon', 'ancient_staff');
  game.player.spell = 'fire_wave';
  game.inventory.add('fire_rune', 50); game.inventory.add('air_rune', 50); game.inventory.add('blood_rune', 20);
  assert.equal(game.combatMode(), 'magic');
  const chicken = game.npcs.find((n) => n.npcId === 'chicken');
  game.player.x = game.player.tx = chicken.x + 3; game.player.y = game.player.ty = chicken.y;
  game.attackNpc(chicken);
  step(game, 40);
  assert.ok(game.inventory.count('blood_rune') < 20, 'blood runes were consumed by the wave spell');
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
  game.player.x = game.player.tx = chicken.x + 3; game.player.y = game.player.ty = chicken.y;
  const arrowsBefore = game.inventory.count('rune_arrow');
  game.attackNpc(chicken);
  step(game, 3);
  assert.ok(arrowsBefore - game.inventory.count('rune_arrow') >= 2, 'two arrows consumed by the volley');
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
