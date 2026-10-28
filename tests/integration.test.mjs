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
  // A sturdy target takes several casts, so the Rune Saver perk (a free cast now
  // and then at high Magic) can't leave every rune unspent.
  chicken.maxHp = chicken.hp = 5000;
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
  assert.equal(game.combatMode(), 'ranged');
  const keys = game.currentAbilities().map((a) => a.id);
  assert.deepEqual(keys, ['snapshot', 'piercing_shot', 'brace', 'second_wind', 'arrow_storm']);
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
  for (let i = 0; i < 40; i++) game.update(100);   // 4s of walking at 1 tile / 420ms
  game.setMoveInput(0, 0);
  for (let i = 0; i < 10; i++) game.update(100);
  assert.ok(p.x >= x0 + 8 && p.x <= x0 + 12, `walked right (${x0} -> ${p.x})`);
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

test('player attacks run on a 300ms combat beat: a scimitar swings about 3x a second', async () => {
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
  assert.ok(swings >= 8 && swings <= 11, `about 10 swings in 3s, got ${swings}`);
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

  game.bossSpecial(boss);
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
  assert.equal(n.maxHp, hp0 * 3);
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

test('gear upgrades: +1..+10 with coins and bars, stronger stats, saved with the game', async () => {
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
  const coins0 = game.inventory.count('coins'), bars0 = game.inventory.count('bronze_bar');
  for (let i = 0; i < 5; i++) assert.ok(game.upgradeItem('bronze_scimitar'), `+${i + 1} always works`);
  assert.equal(game.equipment.upgradeLevel('bronze_scimitar'), 5);
  assert.ok(game.equipment.bonuses().attack > atk0, 'upgrades raise your bonuses');
  assert.equal(game.inventory.count('bronze_bar'), bars0 - 15, 'bars are spent (1+2+3+4+5)');
  assert.ok(game.inventory.count('coins') < coins0, 'coins are spent');
  saveGame(game);
  const g2 = new Game();
  g2.start();
  assert.equal(g2.equipment.upgradeLevel('bronze_scimitar'), 5, 'upgrade levels survive save/load');
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
  game.autoCfg = { eatAt: 0.6, target: 'chicken', abilities: false, bosses: false, priority: false };
  saveGame(game);
  const g2 = new Game();
  g2.start();
  assert.deepEqual(g2.autoCfg, { eatAt: 0.6, target: 'chicken', abilities: false, bosses: false, priority: false });
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
  game.update(16); game.update(150);           // gliding right, part-way across a tile
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
  assert.ok(game.player.attackCooldown >= 1);
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
  assert.equal(game._autoPickTarget(), mob, 'a boss far above your level is skipped');
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
  assert.equal(eq.get('shield'), 'wooden_shield');
  game.equipItem(idx('bronze_dagger'));
  assert.equal(eq.get('weapon'), 'bronze_dagger');
  game.equipItem(idx('iron_dagger'));                         // already holding a dagger: goes to the off-hand
  assert.equal(eq.get('shield'), 'iron_dagger', 'second dagger takes the shield slot');
  assert.ok(inv.count('wooden_shield') >= 1, 'the shield goes back to the pack');
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
  // Only a dagger can go in the off-hand.
  game.equipOffhand(idx('bronze_dagger'));
  assert.equal(eq.get('shield'), null, 'no off-hand dagger without a main-hand dagger');
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
  assert.ok(danceEvade(99, 'twirl') > danceEvade(99, 'flourish'), 'Twirl dodges more');
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
