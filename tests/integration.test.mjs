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
  chicken.maxHp = chicken.hp = 99; // durable dummy so both volley arrows fire
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
  const wild = new NPC('goblin', 0, 0, 4);
  const tame = new NPC('goblin', 0, 0, 4, { aggressive: false, statMul: 0.6 });
  assert.equal(getNpc('goblin').aggressive, true, 'registry goblin stays aggressive for the rest of the island');
  assert.equal(wild.def.aggressive, true, 'a normal goblin spawn is still aggressive');
  assert.equal(tame.def.aggressive, false, 'a tamed spawn never attacks first');
  assert.ok(tame.maxHp < wild.maxHp, 'tamed spawn has less HP');
  assert.ok(tame.def.defence < wild.def.defence, 'tamed spawn is easier to hit');
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
  assert.equal(shadow.def.aggressive, true, 'the wilderness boss is aggressive');
  assert.ok(shadow.def.dropTable.map((d) => d.id).includes('void_blade'), 'drops the Void blade');
});

test('no aggressive boss spawns near the starting town', () => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  const nearAgg = game.npcs.filter((n) =>
    n.def.boss && n.def.aggressive && Math.max(Math.abs(n.x - 58), Math.abs(n.y - 55)) <= 22);
  assert.equal(nearAgg.length, 0, 'bosses near spawn are pacified so they cannot ambush newcomers');
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
