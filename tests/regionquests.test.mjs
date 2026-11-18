// Region story quests (src/data/regionQuests.js, src/game/regionquests.js):
// every region has a line, every step can be guided and travelled to, every
// line can be played start to finish headlessly, and its unlock works.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame, loadGame } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { NPCS } from '../src/data/npcs.js';
import { SHOPS } from '../src/data/shops.js';
import { QUESTS } from '../src/data/quests.js';
import { OBJECTS } from '../src/data/objects.js';
import { REGION_LINES, REGION_GIVERS, REGION_SHOPS } from '../src/data/regionQuests.js';
import { regionDialogue, regionPerks, canRegionTeleport, FOE_HP_MULT } from '../src/game/regionquests.js';
import { townArt } from '../src/render/sprites.js';
import { STATIONS } from '../src/data/transport.js';

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
  return g;
}

// Raise the fight level far enough for every line (Attack is a fighting skill).
function strong(g) { g.skills.addXp('attack', 1e12); }

// The game's own kill handler, as if the player landed the killing blow.
function killFor(g, npc) {
  npc.hp = 0;
  g.killNpc(npc);
}

test('every region has one quest line, ordered by fight level, with a real giver', () => {
  const g = newGame();
  const regions = g.world.zones.map((z) => z.name).filter((n) => n !== 'The Endless Gate');
  assert.equal(regions.length, 23);
  assert.deepEqual([...REGION_LINES.map((l) => l.region)].sort(), [...regions].sort(), 'one line per region');
  for (let i = 1; i < REGION_LINES.length; i++) assert.ok(REGION_LINES[i].level >= REGION_LINES[i - 1].level, `${REGION_LINES[i].id} comes after an easier line`);
  assert.equal(REGION_LINES[0].region, 'Kampong Glam', 'the journey starts in Kampong Glam');
  for (const l of REGION_LINES) {
    assert.ok(QUESTS.some((q) => q.id === l.id), `${l.id} is in the journal`);
    assert.ok(l.steps.length >= 3 && l.steps.length <= 5, `${l.id} has 3-5 steps`);
    assert.equal(l.steps.at(-1).kind, 'talk', `${l.id} ends back with someone`);
    assert.ok(l.steps.some((s) => s.kind === 'foe'), `${l.id} has a mini-boss`);
    const giver = g.npcs.find((n) => n.npcId === l.giver);
    assert.ok(giver, `${l.giver} stands in the world`);
    assert.equal(g.world.zoneAt(giver.x, giver.y)?.name, l.region, `${l.giver} stands in ${l.region}`);
    assert.ok(!NPCS[l.giver].attackable && NPCS[l.giver].dialogue === 'region');
  }
});

test('quest givers borrow existing townsfolk art (no new files)', () => {
  const art = townArt();
  for (const [id, g] of Object.entries(REGION_GIVERS)) {
    assert.ok(art.has(g.art), `${id} borrows real art (${g.art})`);
    assert.ok(!art.has(id), `${id} is not in the art registry`);
  }
});

test('every quest giver can be walked to from the MRT network', () => {
  const g = newGame();
  const w = g.world, W = w.width;
  const seen = new Uint8Array(W * w.height);
  const q = [];
  const push = (x, y) => { if (w.inBounds(x, y) && !w.isBlocked(x, y) && !seen[y * W + x]) { seen[y * W + x] = 1; q.push(x, y); } };
  for (const st of STATIONS) { const t = g._nearestFree(st.x, st.y); push(t.x, t.y); }
  for (let i = 0; i < q.length; i += 2) { const x = q[i], y = q[i + 1]; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  for (const id of Object.keys(REGION_GIVERS)) {
    const n = g.npcs.find((x) => x.npcId === id);
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(n.y + dy) * W + n.x + dx]);
    assert.ok(near, `${id} at ${n.x},${n.y} can be reached`);
  }
});

test('every step names real monsters, items, objects and shops found where it says', () => {
  const g = newGame();
  const inRegion = (npcId, region) => g.npcs.some((n) => n.npcId === npcId && g.world.zoneAt(n.spawnX, n.spawnY)?.name === region);
  for (const l of REGION_LINES) {
    for (const st of l.steps) {
      if (st.to) assert.ok(REGION_GIVERS[st.to], `${l.id}: ${st.to} is a quest giver`);
      if (st.kind === 'kill') {
        assert.ok(NPCS[st.npc]?.attackable, `${l.id}: ${st.npc} is a monster`);
        assert.ok(g.npcs.some((n) => n.npcId === st.npc), `${l.id}: ${st.npc} lives somewhere`);
        assert.ok(st.qty > 0);
      }
      if (st.kind === 'foe') {
        assert.ok(inRegion(st.npc, st.where || l.region), `${l.id}: ${st.npc} lives in ${st.where || l.region}`);
        assert.ok(st.name);
        // Not far above the line's level, so the foe is a fair fight for it.
        assert.ok(NPCS[st.npc].level <= l.level * 2 + 20, `${l.id}: the foe suits the line's level`);
      }
      if (st.kind === 'give') {
        assert.ok(ITEMS[st.item], `${l.id}: ${st.item} is an item`);
        for (const v of st.via) {
          if (v.need) assert.ok(ITEMS[v.need], `${l.id}: ${v.need} is an item`);
          if (v.obj) assert.ok(OBJECTS[v.obj] && g.world.objects.some((o) => o.objId === v.obj), `${l.id}: ${v.obj} is in the world`);
          if (v.shop) {
            assert.ok(g.npcs.some((n) => n.npcId === v.shop), `${l.id}: ${v.shop} stands somewhere`);
            assert.ok(SHOPS[NPCS[v.shop].shop].stock.some((s) => s.id === st.item), `${l.id}: ${v.shop} sells ${st.item}`);
          }
          if (v.obj && !v.need && OBJECTS[v.obj].gives) assert.equal(OBJECTS[v.obj].gives, st.item, `${l.id}: ${v.obj} gives ${st.item}`);
        }
      }
    }
    const u = l.unlock;
    assert.ok(u.text, `${l.id} says what it unlocks`);
    if (u.type === 'shop') { assert.ok(SHOPS[u.shop]); for (const s of REGION_SHOPS[u.shop].stock) assert.ok(ITEMS[s.id], `${u.shop} sells a real item (${s.id})`); }
    if (u.type === 'ferry') assert.ok(REGION_GIVERS[u.to] && u.to !== l.giver);
    if (u.type === 'spot') for (const o of u.objs) assert.ok(OBJECTS[o], `${o} is an object`);
    if (u.type === 'perk') assert.ok(Object.keys(u.bonus).length);
  }
});

// Drive one line through every step the way a player would: start it with
// the giver, then for each step check the guide points somewhere real (Go
// finds it), do the step, and hand it in through the dialogue's own action.
function playLine(g, l) {
  const q = g.quests[l.id];
  const guide0 = g.questGuide(l.id);
  assert.equal(guide0.kind, 'npc', `${l.id} starts with its giver`);
  assert.equal(guide0.npcId, l.giver);
  g.handleDialogueAction(`rq:start:${l.id}`);
  assert.equal(q.state, 'active', `${l.id} started`);
  for (let guard = 0; q.state === 'active' && guard < 20; guard++) {
    const st = l.steps[q.step];
    const gd = g.questGuide(l.id);
    assert.notEqual(gd.kind, 'none', `${l.id} step ${q.step} has a guide`);
    assert.ok(gd.text, `${l.id} step ${q.step} says what to do`);
    if (gd.kind === 'npc') assert.ok(g.npcs.some((n) => n.npcId === gd.npcId), `${l.id}: ${gd.npcId} stands somewhere`);
    if (gd.kind === 'obj') assert.ok(g.world.objects.some((o) => o.objId === gd.objId), `${l.id}: ${gd.objId} exists`);
    if (gd.kind === 'hunt') assert.ok(gd.npc ? gd.npc.alive : g.npcs.some((n) => n.alive && n.npcId === gd.target), `${l.id}: something to fight`);
    const before = q.step;
    if (st.kind === 'kill') {
      for (let i = 0; i < st.qty; i++) {
        // (A small pack may all be down already: stand one back up.)
        const n = g.npcs.find((x) => x.alive && x.npcId === st.npc && !x.rqFoe) || g.npcs.find((x) => x.npcId === st.npc && !x.rqFoe);
        n.alive = true;
        killFor(g, n);
      }
    } else if (st.kind === 'foe') {
      const foe = gd.npc;
      assert.equal(foe.def.name, st.name);
      assert.equal(foe.npcId, st.npc, 'the foe is drawn as its kind');
      assert.ok(!foe.champion);
      assert.equal(foe.maxHp, Math.round(NPCS[st.npc].maxHp * FOE_HP_MULT), 'tougher than its kind');
      assert.equal(g.world.zoneAt(foe.x, foe.y)?.name, st.where || l.region, `${st.name} turns up where it should`);
      killFor(g, foe);
      g.update(600);
      assert.ok(!g.npcs.includes(foe), 'a beaten foe is gone for good');
    } else if (st.kind === 'give') {
      const had = g.inventory.count(st.item);
      g.inventory.add(st.item, st.qty);
      assert.equal(g.questGuide(l.id).npcId, st.to || l.giver, 'with the items, Go leads to the hand-in');
      g.handleDialogueAction(`rq:talk:${l.id}`);
      assert.equal(g.inventory.count(st.item), had, 'the items are handed over');
    } else {
      // The dialogue box offers the step's reply, which runs the action.
      const tree = regionDialogue(g, g.npcs.find((n) => n.npcId === (st.to || l.giver)));
      const opt = tree.start.options.find((o) => o.action === `rq:talk:${l.id}`);
      assert.ok(opt, `${l.id}: the dialogue offers "${st.reply}"`);
      g.handleDialogueAction(opt.action);
    }
    assert.ok(q.state === 'done' || q.step === before + 1, `${l.id} moved on from step ${before}`);
  }
  assert.equal(q.state, 'done', `${l.id} finishes`);
}

test('every quest line can be played from start to finish, and pays its unlock', () => {
  const g = newGame();
  strong(g);
  g.player.maxHp = g.player.hp = 1e9;
  for (const l of REGION_LINES) {
    const coins = g.inventory.count('coins');
    const objs = g.world.objects.length;
    playLine(g, l);
    assert.ok(g.inventory.count('coins') > coins, `${l.id} pays coins`);
    assert.equal(g.questGuide(l.id).kind, 'none');
    if (l.unlock.type === 'spot') assert.equal(g.world.objects.length, objs + l.unlock.objs.length, `${l.id} adds its gathering spots`);
  }
  // Perks: every finished perk counts, once, with your gear.
  const want = {};
  for (const l of REGION_LINES) if (l.unlock.type === 'perk') for (const [k, v] of Object.entries(l.unlock.bonus)) want[k] = (want[k] || 0) + v;
  assert.deepEqual(regionPerks(g), want);
  for (const [k, v] of Object.entries(want)) assert.ok(g.outsideBonuses()[k] >= v, `${k} perk counts with your gear`);
  assert.ok(g.questPoints() >= REGION_LINES.length, 'each line is worth a quest point');
});

test('a line can only be started at its fight level, and kills count towards it', () => {
  const g = newGame();
  const far = REGION_LINES.at(-1);
  assert.equal(g.questGuide(far.id).kind, 'none', 'too strong a line waits');
  assert.match(g.questGuide(far.id).text, /fight level/);
  g.handleDialogueAction(`rq:start:${far.id}`);
  assert.equal(g.quests[far.id].state, 'notStarted');
  const kg = REGION_LINES[0];
  g.handleDialogueAction(`rq:start:${kg.id}`);
  const rat = g.npcs.find((n) => n.alive && n.npcId === 'rat');
  killFor(g, rat);
  assert.equal(g.quests[kg.id].n, 1);
  assert.match(g.questGuide(kg.id).text, /1\/4/);
  // Go hunts the line's monster.
  const gd = g.questGuide(kg.id);
  assert.equal(gd.kind, 'hunt');
  assert.equal(gd.target, 'rat');
});

test('Go leads to the named foe itself, and gathering and shopping steps point the right way', () => {
  const g = newGame();
  const sentosa = REGION_LINES.find((l) => l.id === 'rq_sentosa');
  strong(g);
  g.handleDialogueAction(`rq:start:${sentosa.id}`);
  const q = g.quests[sentosa.id];
  q.step = 1;   // grill anchovies: catch them first, then the range
  assert.equal(g.questGuide(sentosa.id).objId, 'fishing_spot');
  g.inventory.add('raw_anchovy', 4);
  assert.equal(g.questGuide(sentosa.id).objId, 'range');
  q.step = 2;
  const foe = g.questGuide(sentosa.id).npc;
  g.inventory.add('coins', 1000);
  assert.ok(g.questTravel(sentosa.id), 'Go sets off');
  assert.ok(g.player.action?.npc === foe || g.player.isMoving, 'heading for the foe');
  // A shopping step names the item for auto quest to buy.
  const mac = REGION_LINES.find((l) => l.id === 'rq_macritchie');
  g.handleDialogueAction(`rq:start:${mac.id}`);
  g.quests[mac.id].step = 1;
  const gd = g.questGuide(mac.id);
  assert.equal(gd.npcId, 'hawker');
  assert.deepEqual(gd.buy, { item: 'roti_prata', qty: 3 });
});

test('unlocks: home teleport, ferries and shops', () => {
  const g = newGame();
  strong(g);
  const kg = REGION_LINES[0];
  assert.ok(!canRegionTeleport(g, kg.id));
  g.quests[kg.id].state = 'done';
  assert.ok(canRegionTeleport(g, kg.id));
  g.player.x = g.player.tx = 200; g.player.y = g.player.ty = 150;   // Marina Bay
  assert.ok(g.handleDialogueAction(`rq:tp:${kg.id}`) !== false);
  assert.equal(g.world.zoneAt(g.player.x, g.player.y)?.name, 'Kampong Glam', 'teleported home');
  // Ferry: Changi's bumboat lands you beside Encik Hafiz on Pulau Tekong.
  const changi = REGION_LINES.find((l) => l.unlock.type === 'ferry' && l.id === 'rq_changi');
  g.quests[changi.id].state = 'done';
  const tree = regionDialogue(g, g.npcs.find((n) => n.npcId === changi.giver));
  const opt = tree.start.options.find((o) => o.action === `rq:ferry:${changi.id}`);
  assert.ok(opt, 'the giver offers the ferry');
  g.handleDialogueAction(opt.action);
  assert.equal(g.world.zoneAt(g.player.x, g.player.y)?.name, 'Tekong Badlands');
  // Shops: offered only once the line is done.
  const ct = REGION_LINES.find((l) => l.unlock.type === 'shop');
  const giver = g.npcs.find((n) => n.npcId === ct.giver);
  assert.ok(!regionDialogue(g, giver).start.options.some((o) => o.action?.startsWith('rq:shop')));
  g.quests[ct.id].state = 'done';
  assert.ok(regionDialogue(g, giver).start.options.some((o) => o.action === `rq:shop:${ct.id}`));
});

test('dialogue walks a new player through the offer', () => {
  const g = newGame();
  const kg = REGION_LINES[0];
  const tree = regionDialogue(g, g.npcs.find((n) => n.npcId === kg.giver));
  assert.equal(tree.start.text, kg.intro);
  const offer = tree[tree.start.options[0].next];
  assert.equal(offer.text, kg.offer);
  const accept = offer.options.find((o) => o.action);
  g.handleDialogueAction(accept.action);
  assert.equal(g.quests[kg.id].state, 'active');
  assert.match(tree.start.text, /Next:/, 'the giver reminds you of the next step');
});

test('region quest progress and unlocks survive a save and load', () => {
  const g = newGame();
  strong(g);
  const ubin = REGION_LINES.find((l) => l.id === 'rq_pulau_ubin');
  const jur = REGION_LINES.find((l) => l.id === 'rq_jurong');
  playLine(g, ubin);
  g.handleDialogueAction(`rq:start:${jur.id}`);
  g.quests[jur.id].n = 3;
  saveGame(g);
  const h = new Game();
  loadGame(h);
  h.start();
  assert.equal(h.quests[ubin.id].state, 'done');
  assert.deepEqual({ ...h.quests[jur.id] }, { state: 'active', step: 0, n: 3 });
  const giver = h.npcs.find((n) => n.npcId === ubin.giver);
  const near = h.world.objects.filter((o) => ubin.unlock.objs.includes(o.objId) && Math.abs(o.x - giver.x) <= 12 && Math.abs(o.y - giver.y) <= 12);
  assert.ok(near.length >= ubin.unlock.objs.length, 'the quarry seam is back after loading');
});

test('auto quest can start and hand in a region line', () => {
  const g = newGame();
  const kg = REGION_LINES[0];
  g._autoQuestTalk(kg.id, g.npcs.find((n) => n.npcId === kg.giver));
  assert.equal(g.quests[kg.id].state, 'active');
  g.quests[kg.id].step = 1;
  g.inventory.add('logs', 5);
  g._autoQuestTalk(kg.id, g.npcs.find((n) => n.npcId === kg.giver));
  assert.equal(g.quests[kg.id].step, 2);
});
