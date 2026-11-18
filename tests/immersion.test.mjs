// Immersion polish: region colour moods, critters, camera lead and push-in,
// boss entrances, region title cards, the minimal HUD setting and the region
// sound beds. The pure parts are tested directly; the game hooks through a
// headless Game.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, clearSave } from '../src/game/save.js';
import { TILE } from '../src/config.js';
import { TERRAIN } from '../src/data/world.js';
import { Camera, smoothDamp } from '../src/engine/camera.js';
import { moodFor, blendMood, composeWashes, dayNightWashes, hidesPoint, ObjectReactions, SEE_THROUGH_ALPHA } from '../src/render/ambience.js';
import { Critters, CRITTER_CAP, CRITTER_CAP_LOW } from '../src/render/critters.js';
import {
  Cinematics, BOSS_INTRO_MS, TITLE_GAP_MS, TITLE_REPEAT_MS, LEAD_MAX, FIGHT_ZOOM, FIGHT_ZOOM_HOLD, DEATH_SLOWMO_MS, introCurve, titleAlpha,
} from '../src/game/cinematics.js';
import { ambienceMix, BEDS } from '../src/audio/ambience.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const freshGame = () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
};

// ---------------- Region mood ----------------
test('each region has its own colour mood: warm towns, cool coasts, red-tinged Wilderness', () => {
  const [r, g, b, a] = moodFor('Kampong Glam');
  assert.ok(a > 0 && r > g && g > b, 'Kampong Glam is a warm gold');
  const coast = moodFor('Sungei Buloh Wetlands');
  assert.ok(coast[2] > coast[0] && coast[1] > coast[0], 'the mangroves are a cool blue-green');
  const mist = moodFor('MacRitchie Reservoir');
  assert.ok(Math.min(mist[0], mist[1], mist[2]) > 200, 'the reservoir is a pale mist');
  const wild = moodFor('The Wilderness');
  assert.ok(wild[0] > wild[1] * 1.5 && wild[0] > wild[2] * 1.5 && wild[3] > a, 'the Wilderness is red-tinged and stronger');
  assert.equal(moodFor('Nowhere')[3], 0, 'an unknown place has no grade');
  for (const m of [moodFor('Kampong Glam'), coast, mist, wild]) assert.ok(m[3] <= 0.2, 'kept faint');
});

test('the mood blends over about a second, the same at any frame rate', () => {
  const from = moodFor('Kampong Glam'), to = moodFor('The Wilderness');
  const fast = from.slice(), slow = from.slice();
  for (let i = 0; i < 60; i++) blendMood(fast, to, 1000 / 60);
  for (let i = 0; i < 10; i++) blendMood(slow, to, 100);
  for (let k = 0; k < 4; k++) assert.ok(Math.abs(fast[k] - slow[k]) < 1e-6, 'frame-rate independent');
  const done = Math.abs(fast[3] - to[3]) / Math.abs(from[3] - to[3]);
  assert.ok(done < 0.06, `~95% of the way after 1s (left ${done})`);
  const early = from.slice(); blendMood(early, to, 100);
  assert.ok(Math.abs(early[0] - from[0]) > 0 && Math.abs(early[0] - to[0]) > 1, 'still on its way after 0.1s');
});

test('the mood, dusk and night washes fold into one fill that looks the same', () => {
  const washes = [moodFor('Kampong Glam'), ...dayNightWashes(0.6)];
  assert.ok(washes.every((w) => w[3] > 0), 'all three washes are on at dusk');
  const one = composeWashes(washes);
  for (const dst of [[0, 0, 0], [255, 255, 255], [170, 216, 146]]) {
    // Painting each wash over the scene in turn...
    const seq = dst.slice();
    for (const w of washes) for (let k = 0; k < 3; k++) seq[k] = seq[k] * (1 - w[3]) + w[k] * w[3];
    // ...and painting the single folded wash once.
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(seq[k] - (dst[k] * (1 - one[3]) + one[k] * one[3])) < 1e-9);
  }
  assert.equal(composeWashes([moodFor('Singapore'), ...dayNightWashes(0)])[3], 0, 'noon in a plain region paints nothing');
});

// ---------------- Critters ----------------
const grassWorld = { inBounds: () => true, terrainAt: () => TERRAIN.GRASS, objectAt: () => null, isBlocked: () => false };

test('critters stay within their cap, reuse a fixed pool and leave once out of view', () => {
  const c = new Critters();
  const env = { world: grassWorld, zone: 'Bukit Timah', night: 0, px: 400, py: 300, low: false };
  const pool = c.pool, size = pool.length;
  let peak = 0;
  for (let i = 0; i < 2000; i++) { c.update(16, env, 0, 0, 800, 600); peak = Math.max(peak, c.count); }
  assert.ok(peak > 0, 'some appear');
  assert.ok(peak <= CRITTER_CAP, `never more than ${CRITTER_CAP} (peak ${peak})`);
  assert.equal(c.pool, pool); assert.equal(c.pool.length, size, 'the same pool objects, nothing new');
  for (const k of pool) if (k.on) assert.ok(k.x > -40 && k.x < 840 && k.y > -40 && k.y < 640, 'spawned within the view');
  // Night: fireflies in the jungle.
  env.night = 0.9;
  for (let i = 0; i < 1500; i++) c.update(16, env, 0, 0, 800, 600);
  assert.ok(pool.some((k) => k.on && k.kind === 1), 'fireflies at night');
  // The view moves far away: they're all dropped (and none spawn in the grim lands).
  env.zone = 'The Wilderness';
  c.update(16, env, 50000, 50000, 800, 600);
  assert.equal(c.count, 0, 'everything off-screen despawns');
  for (let i = 0; i < 500; i++) c.update(16, env, 50000, 50000, 800, 600);
  assert.equal(c.count, 0, 'no critters in the Wilderness');
  // Low graphics: a smaller cap.
  const low = new Critters();
  const lenv = { ...env, zone: 'Bukit Timah', night: 0, low: true };
  let lpeak = 0;
  for (let i = 0; i < 2000; i++) { low.update(16, lenv, 0, 0, 800, 600); lpeak = Math.max(lpeak, low.count); }
  assert.ok(lpeak <= CRITTER_CAP_LOW, `low graphics keeps to ${CRITTER_CAP_LOW}`);
});

test('a sitting bird takes off when you come within three tiles', () => {
  const c = new Critters();
  const env = { world: grassWorld, zone: 'Kampong Glam', night: 0, px: -5000, py: -5000, low: false };
  // Spawn until a bird sits somewhere.
  let bird = null;
  for (let i = 0; i < 5000 && !bird; i++) { c.update(16, env, 0, 0, 800, 600); bird = c.pool.find((k) => k.on && k.kind === 2 && !k.flee); }
  assert.ok(bird, 'a bird lands');
  bird.life = 1e9;
  env.px = bird.x + TILE * 4; env.py = bird.y;
  c.update(16, env, 0, 0, 800, 600);
  assert.equal(bird.flee, false, 'four tiles away: it stays put');
  env.px = bird.x + TILE * 2;
  const y0 = bird.y;
  c.update(16, env, 0, 0, 800, 600);
  assert.equal(bird.flee, true, 'two tiles: it flutters off');
  for (let i = 0; i < 10; i++) c.update(16, env, 0, 0, 800, 600);
  assert.ok(bird.y < y0 && bird.x < env.px, 'up and away from you');
});

// ---------------- Camera ----------------
test('camera push-in keeps screen<->world mapping exact and zooms about the centre', () => {
  const cam = new Camera();
  cam.resize(1280, 720, 1.6, 2);
  cam.cx = 3000; cam.cy = 2000;
  assert.equal(cam.viewW, 1280 / 1.6);
  cam.setZoomMul(1.06);
  assert.ok(Math.abs(cam.zoom - 1.6 * 1.06) < 1e-12);
  assert.ok(Math.abs(cam.viewW - 1280 / (1.6 * 1.06)) < 1e-9 && Math.abs(cam.viewH - 720 / (1.6 * 1.06)) < 1e-9, 'shows a little less');
  for (const [sx, sy] of [[0, 0], [640, 360], [1279, 719], [37.5, 600]]) {
    const w = cam.screenToWorld(sx, sy), s = cam.worldToScreen(w.x, w.y);
    assert.ok(Math.abs(s.x - sx) < 1e-9 && Math.abs(s.y - sy) < 1e-9, 'round trip');
  }
  const mid = cam.screenToWorld(640, 360);
  assert.ok(Math.abs(mid.x - 3000) < 1e-9 && Math.abs(mid.y - 2000) < 1e-9, 'the screen centre is still the camera centre');
  const t = cam.screenToTile(640, 360);
  assert.deepEqual(t, { x: Math.floor(3000 / TILE), y: Math.floor(2000 / TILE) });
  // A resize (rotate the phone) keeps the push-in.
  cam.resize(720, 1280, 1.5);
  assert.ok(Math.abs(cam.zoom - 1.5 * 1.06) < 1e-12 && cam.dpr === 2);
});

test('smoothDamp arrives without overshoot, the same at 30, 60 and 144 fps', () => {
  const run = (fps) => { const st = { v: 0 }; let x = 0, max = 0; for (let t = 0; t < 2000; t += 1000 / fps) { x = smoothDamp(x, 100, st, 300, 1000 / fps); max = Math.max(max, x); } return { x, max }; };
  const a = run(30), b = run(60), c = run(144);
  for (const r of [a, b, c]) { assert.ok(r.x > 99.5, 'arrives'); assert.ok(r.max <= 100 + 1e-9, 'never overshoots'); }
  const mid = (fps) => { const st = { v: 0 }; let x = 0; for (let t = 0; t < 300 - 1e-9; t += 1000 / fps) x = smoothDamp(x, 100, st, 300, 1000 / fps); return x; };
  assert.ok(Math.abs(mid(30) - mid(150)) < 3, `close at any frame rate (${mid(30)} vs ${mid(150)})`);
});

function fakeGame() {
  const pos = { x: 1000, y: 1000 };
  const g = {
    player: { alive: true, renderCenter: () => ({ x: pos.x, y: pos.y }) },
    camera: new Camera(), shakes: 0, sfx: [], hitStop: 0,
    addShake() { this.shakes++; }, bus: { emit: (e, n) => g.sfx.push(n) },
  };
  g.camera.resize(800, 600, 1.5, 1);
  return { g, pos };
}

test('the camera leads a little in the walking direction, capped, and settles when you stop', () => {
  const { g, pos } = fakeGame();
  const cine = new Cinematics();
  for (let i = 0; i < 60; i++) { pos.x += 32 / 300 * 16; cine.update(g, 16); }   // running right for ~1s
  assert.ok(cine.lead.x > LEAD_MAX * 0.8 && cine.lead.x <= LEAD_MAX + 1e-6, `leads right (${cine.lead.x})`);
  assert.ok(Math.abs(cine.lead.y) < 1e-6);
  const f = cine.update(g, 16);
  assert.ok(f.x > pos.x && Math.abs(f.y - pos.y) < 1e-6, 'the camera aims ahead of you');
  for (let i = 0; i < 200; i++) cine.update(g, 16);
  assert.ok(Math.abs(cine.lead.x) < 0.5, 'and drifts back once you stop');
  pos.x += 5000; cine.update(g, 16);   // a teleport is not walking
  assert.ok(Math.abs(cine.lead.x) < 0.5, 'a jump does not fling the camera');
});

test('fights push the camera in gently, then it eases back out after combat', () => {
  const { g } = fakeGame();
  const cine = new Cinematics();
  cine.inFight = true;
  for (let i = 0; i < 120; i++) cine.update(g, 16);
  assert.ok(Math.abs(cine.zoomK - FIGHT_ZOOM) < 0.002, `pushed in (${cine.zoomK})`);
  assert.ok(Math.abs(g.camera.zoom - 1.5 * cine.zoomK) < 1e-12, 'the camera uses it');
  cine.inFight = false; cine._fightUntil = cine.now + FIGHT_ZOOM_HOLD;
  for (let i = 0; i < 60; i++) cine.update(g, 16);
  assert.ok(cine.zoomK > FIGHT_ZOOM - 0.002, 'holds for a moment after the fight');
  for (let i = 0; i < 300; i++) cine.update(g, 16);
  assert.equal(cine.zoomK, 1, 'back to normal');
  assert.equal(g.camera.zoom, 1.5);
});

// ---------------- Boss entrances ----------------
test('a boss entrance plays once per boss per session, never for World Bosses', () => {
  const g = freshGame();
  const p = g.player;
  const boss = g.npcs.find((n) => n.def.boss && !n.def.fixed);
  boss.def = { ...boss.def, maxHit: 0, abilities: [] };
  boss.hp = boss.maxHp = 1e9;
  boss.x = boss.tx = p.x + 3; boss.y = boss.ty = p.y;
  boss.target = p;
  g._near = null;
  const sounds = [];
  g.bus.on('sfx', (n) => sounds.push(n));
  g.update(600);
  assert.ok(g.cine.intro, 'it starts when the boss engages');
  assert.equal(g.cine.intro.npc, boss);
  assert.equal(g.cine.intro.name, boss.name);
  assert.equal(g.cine.intro.level, boss.def.level);
  for (let t = 0; t < BOSS_INTRO_MS; t += 100) g.update(100);
  assert.equal(g.cine.intro, null, 'over in about a second');
  assert.equal(sounds.filter((n) => n === 'roar').length, 1, 'it roared once');
  assert.ok(p.alive, 'the game ran on throughout');
  // Engaging it again this session: no second entrance.
  boss.target = null; g.update(600);
  boss.target = p; g.update(600);
  assert.equal(g.cine.intro, null, 'only the first time');
  assert.equal(g.cine.bossEngaged(boss), false);
  // A World Boss already has its own arrival banner.
  const wb = g.npcs.find((n) => n.def.boss && n.npcId !== boss.npcId);
  wb.worldBoss = true;
  assert.equal(g.cine.bossEngaged(wb), false);
  assert.equal(g.cine.bossEngaged({ def: { boss: false }, npcId: 'rat' }), false, 'ordinary monsters never get one');
});

test('the entrance pans toward the boss and pushes in, then hands the camera back', () => {
  const { g, pos } = fakeGame();
  const cine = new Cinematics();
  const boss = { npcId: 'boar_king', name: 'The Boar King', alive: true, def: { boss: true, level: 19 }, renderCenter: () => ({ x: pos.x + 200, y: pos.y }) };
  assert.ok(cine.bossEngaged(boss));
  let maxX = 0;
  for (let t = 0; t < 700; t += 16) maxX = Math.max(maxX, cine.update(g, 16).x);
  assert.ok(maxX > pos.x + 80, 'the camera eases toward the boss');
  assert.ok(cine.zoomK > 1.03, 'and pushes in');
  assert.equal(g.shakes, 1, 'the roar shakes the screen once');
  assert.ok(g.sfx.includes('roar'));
  for (let t = 0; t < 1500; t += 16) cine.update(g, 16);
  assert.equal(cine.intro, null);
  assert.ok(Math.abs(cine.focus.x - pos.x) < 1, 'back on you');
  assert.equal(introCurve(-1).banner, 0); assert.equal(introCurve(600).banner, 1); assert.equal(introCurve(BOSS_INTRO_MS).pan, 0);
});

test('a boss death slows time for a beat, with a flash, capped', () => {
  const { g } = fakeGame();
  const cine = new Cinematics();
  cine.bossDown(g);
  assert.ok(g.hitStop >= 200 && g.hitStop <= 400, 'a longer hit-stop');
  assert.ok(cine.flash > 0 && cine.timeScale() < 0.5, 'a flash, and slow motion');
  let prev = cine.timeScale();
  for (let t = 0; t < DEATH_SLOWMO_MS; t += 50) { cine.update(g, 50); assert.ok(cine.timeScale() >= prev); prev = cine.timeScale(); }
  assert.equal(cine.timeScale(), 1, 'normal speed again within a second');
  assert.equal(cine.flash, 0);
});

// ---------------- Region title cards ----------------
test('region title cards show once per entry, with a cooldown', () => {
  const cine = new Cinematics();
  const { g } = fakeGame();
  assert.equal(cine.enterRegion('Kampong Glam'), true);
  assert.equal(cine.title.name, 'Kampong Glam');
  for (let t = 0; t < 1000; t += 100) cine.update(g, 100);
  assert.equal(cine.enterRegion('Chinatown'), false, 'not again moments later (walking along a border)');
  for (let t = 0; t < TITLE_GAP_MS; t += 100) cine.update(g, 100);
  assert.equal(cine.title, null, 'the card has faded');
  assert.equal(cine.enterRegion('Chinatown', { sub: 'Monsters level 5+' }), true, 'a new region after the gap');
  assert.equal(cine.title.sub, 'Monsters level 5+');
  for (let t = 0; t < TITLE_GAP_MS + 100; t += 100) cine.update(g, 100);
  assert.equal(cine.enterRegion('Kampong Glam'), false, 'the same region again soon: no card');
  for (let t = 0; t < TITLE_REPEAT_MS; t += 500) cine.update(g, 500);
  assert.equal(cine.enterRegion('Kampong Glam'), true, 'but after a while, yes');
  assert.equal(cine.enterRegion('The Wilderness', { wild: true }), false, 'the Wilderness keeps its own banner');
  assert.equal(titleAlpha(0), 0); assert.equal(titleAlpha(1200), 1); assert.equal(titleAlpha(1e9), 0);
});

test('walking into a new region in the game shows its title card', () => {
  const g = freshGame();
  g.cine._titleAt = -1e9; g.cine._titleLast.clear();
  const z = g.world.zones.find((zz) => zz.name === 'Bukit Timah');
  let spot = null;
  for (let y = z.y0; y <= z.y1 && !spot; y++) for (let x = z.x0; x <= z.x1 && !spot; x++) if (!g.world.isBlocked(x, y)) spot = { x, y };
  g.player.x = g.player.tx = spot.x; g.player.y = g.player.ty = spot.y;
  g.updateRegion();
  assert.equal(g.cine.title?.name, 'Bukit Timah');
});

// ---------------- Minimal HUD ----------------
test('the minimal HUD setting is saved and loaded (older saves: off)', () => {
  const g = freshGame();
  assert.equal(g.minimalHud, false, 'off by default');
  g.minimalHud = true;
  saveGame(g);
  const again = new Game(); again.start();
  assert.equal(again.minimalHud, true, 'kept across a reload');
  again.minimalHud = false; saveGame(again);
  const third = new Game(); third.start();
  assert.equal(third.minimalHud, false);
});

// ---------------- Ambience sound ----------------
test('the ambience beds follow the region and the hour', () => {
  for (const zone of ['Kampong Glam', 'Bukit Timah', 'Sentosa Beach', 'The Wilderness', 'MacRitchie Reservoir', 'Nowhere']) {
    for (const night of [0, 0.5, 1]) {
      const m = ambienceMix(zone, night);
      assert.deepEqual(Object.keys(m).sort(), [...BEDS].sort());
      for (const b of BEDS) assert.ok(m[b] >= 0 && m[b] <= 1, `${zone} ${b} in range`);
    }
  }
  const town = ambienceMix('Kampong Glam', 0);
  assert.ok(town.town > 0.5 && town.insects === 0, 'town by day: murmur and sizzle');
  assert.ok(ambienceMix('Kampong Glam', 1).town < town.town, 'quieter late at night');
  const jungleDay = ambienceMix('Bukit Timah', 0), jungleNight = ambienceMix('Bukit Timah', 1);
  assert.ok(jungleDay.insects > 0.5 && jungleDay.crickets === 0, 'cicadas by day');
  assert.ok(jungleNight.crickets > 0.5 && jungleNight.insects === 0, 'crickets at night');
  assert.ok(ambienceMix('Sentosa Beach', 0).waves > 0.5, 'waves on the coast');
  assert.ok(ambienceMix('The Wilderness', 0).wind > 0.5, 'wind in the Wilderness');
});

// ---------------- Object reactions ----------------
test('tall things you walk behind turn see-through; bushes sway as you brush past', () => {
  const tree = { x: 10, y: 10, objId: 'tree', def: { type: 'tree' }, depleted: false };
  const cx = 10 * TILE + TILE / 2, cy = 10 * TILE + TILE / 2;
  assert.ok(hidesPoint(tree, cx, cy - TILE), 'standing just behind (north of) it');
  assert.ok(!hidesPoint(tree, cx, cy + TILE), 'not when in front of it');
  assert.ok(!hidesPoint(tree, cx + TILE * 2, cy - TILE), 'nor off to the side');
  assert.ok(!hidesPoint({ ...tree, depleted: true }, cx, cy - TILE), 'a stump hides nothing');
  assert.ok(!hidesPoint({ x: 10, y: 10, objId: 'bush', def: { type: 'scenery' } }, cx, cy - TILE), 'nor does a bush');
  const bush = { x: 11, y: 9, objId: 'bush', def: { type: 'scenery' } };
  const objs = new Map([['10,10', tree], ['11,9', bush]]);
  const player = { x: 10, y: 9, alive: true, moving: true, renderCenter: () => ({ x: cx, y: cy - TILE }) };
  const game = { player, world: { objectAt: (x, y) => objs.get(`${x},${y}`) || null } };
  const r = new ObjectReactions();
  for (let i = 0; i < 30; i++) r.update(game, 16);
  assert.ok(Math.abs(r.alpha(tree) - SEE_THROUGH_ALPHA) < 1e-9, 'faded');
  assert.ok(r.skew(bush, 1234) !== 0 || r.brush.has(bush), 'the bush is swaying');
  player.renderCenter = () => ({ x: cx, y: cy + TILE }); player.y = 11; player.moving = false;
  for (let i = 0; i < 60; i++) r.update(game, 16);
  assert.equal(r.alpha(tree), 1, 'solid again once you step out');
  assert.equal(r.skew(bush, 1234), 0, 'and the bush settles');
  assert.equal(r.fade.size + r.brush.size, 0, 'nothing kept once settled');
});

// ---------------- Painted critters, particles, banner and plaques ----------------
test('painted fx art stays in lock-step with assets/fx/ and every badge names a real region', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { fxArt, REGION_BADGES, DARK_REGIONS } = await import('../src/render/fxart.js');
  const { buildWorld } = await import('../src/data/world.js');
  const onDisk = new Set(readdirSync(fileURLToPath(new URL('../assets/fx/', import.meta.url))).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const declared = fxArt();
  assert.deepEqual([...declared].filter((k) => !onDisk.has(k)), [], 'declared fx art has no file');
  assert.deepEqual([...onDisk].filter((k) => !declared.has(k)), [], 'fx art file not declared');
  const zones = buildWorld().zones;
  const regions = new Set(zones.map((z) => z.name));
  for (const r of [...REGION_BADGES, ...DARK_REGIONS]) assert.ok(regions.has(r), `${r} is a real region`);
  for (const z of zones) if (!z.instance) assert.ok(REGION_BADGES.includes(z.name), `${z.name} has a badge`);
});

test('falling leaves pick a painted leaf or petal to suit the tree, without a random roll', async () => {
  const { leafArt, PARTICLE_ART } = await import('../src/render/fxart.js');
  assert.equal(leafArt({ objId: 'angsana', x: 1, y: 2 }, false), 'petal_red');
  assert.equal(leafArt({ objId: 'tembusu', x: 1, y: 2 }, false), 'frangipani');
  assert.equal(leafArt({ objId: 'oak', x: 1, y: 2 }, true), 'leaf_dry');
  const a = leafArt({ objId: 'oak', x: 1, y: 2 }, false), b = leafArt({ objId: 'oak', x: 1, y: 2 }, false, 1);
  assert.notEqual(a, b, 'two leaves from one tree differ');
  for (const k of [a, b]) assert.ok(PARTICLE_ART.includes(k));
});

test('critters by the water are dragonflies and kingfishers; drawing them is safe headless', () => {
  const W = TERRAIN.WATER;
  // Rows of water, grass and sand in turn: every grass and sand tile is by the water.
  const bank = { inBounds: () => true, terrainAt: (x, y) => [W, TERRAIN.GRASS, TERRAIN.SAND][y % 3], objectAt: () => null, isBlocked: (x, y) => y % 3 === 0 };
  const c = new Critters();
  const env = { world: bank, zone: 'Kampong Glam', night: 0, px: -5000, py: -5000, low: false };
  const seen = new Set();
  for (let i = 0; i < 6000; i++) { c.update(16, env, 0, 0, 800, 600); for (const k of c.pool) if (k.on) seen.add(k.sp); }
  assert.ok(seen.has('dragonfly') && seen.has('kingfisher'), `by the water (${[...seen]})`);
  // No Image in the tests: the canvas-stroke versions draw instead.
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  c.drawGround(ctx, 0, 0); c.drawAir(ctx, 0, 0, 1000);
});
