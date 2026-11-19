// Headless render smoke test: drives the Renderer and every sprite branch against
// a stub 2D context to catch runtime errors (missing methods, bad colours) without a browser.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { Renderer } from '../src/render/renderer.js';
import { drawCreature, drawPlayer, drawObjectSprite, drawGroundItem, drawShadow } from '../src/render/sprites.js';
import { NPCS } from '../src/data/npcs.js';
import { OBJECTS } from '../src/data/objects.js';

function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  return {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop, clip: noop, setTransform: noop, setLineDash: noop, transform: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    ellipse: noop, rect: noop, roundRect: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, strokeText: noop, drawImage: noop, measureText: () => ({ width: 10 }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
  };
}

function headlessGame() {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game();
  g.start();
  g.camera.resize(800, 600);
  g.camera.follow(g.player.x * 32, g.player.y * 32);
  return g;
}

test('renderer.render runs without throwing (with combat/effects state)', () => {
  const game = headlessGame();
  const ctx = makeCtx();
  const renderer = new Renderer(game, {}, ctx);

  // Exercise effect + combat overlays and the movement marker.
  const npc = game.npcs.find((n) => n.attackable);
  npc.combatLatch = 10; npc.hp = Math.ceil(npc.maxHp / 2);
  game.player.target = npc;
  game.player.path = [{ x: game.player.x + 2, y: game.player.y }];
  game.addHitsplat(game.player, 4);       // sets player.hurt -> entity + screen flash branches
  game.addHitsplat(npc, 0);               // miss/block splat
  game.addHitsplat(npc, 9, { crit: true }); // gold max-hit splat
  game._swingToward(game.player, npc.x, npc.y); // lunge offset branch
  npc.swing = 120; npc.lungeDX = 1;
  // Particles (sparks/sparkles/poofs) exercise the additive-blend draw path.
  game.spawnHitSparks(npc, '#fff2b0');
  game.spawnSparkle(game.player, '#ffe24a', 8);
  game.spawnPoof(game.player.x * 32, game.player.y * 32, '#caa15a');
  // A worn shield should flow from Equipment through the renderer to drawPlayer.
  game.equipment.set('shield', 'wooden_shield');
  assert.ok(game.equipment.get('shield'), 'shield equipped');
  // A running Prayer Burst should flow through to the player's golden halo too.
  game.activePrayers.add('thick_skin');
  game.burstWard = 3;

  assert.doesNotThrow(() => { renderer.render(0); renderer.render(1234.5); });
});

test('renderer draws game-feel effects: dying NPC, screen shake and slash arcs', () => {
  const game = headlessGame();
  const renderer = new Renderer(game, {}, makeCtx());
  const npc = game.npcs.find((n) => n.attackable);
  npc.die();
  assert.ok(npc.deathT > 0, 'death animation timer armed');
  game.addShake(4, 260);
  assert.ok(game.shakeT > 0, 'screen shake armed');
  game._slash(game.player, '#ffd24a');
  assert.ok(game.effects.some((e) => e.type === 'slash'), 'slash effect queued');
  assert.doesNotThrow(() => { renderer.render(100); renderer.render(400); });
  // shake decays out through the frame update
  for (let i = 0; i < 30; i++) game.update(16);
  assert.equal(game.shakeT, 0, 'shake decays to zero');
  assert.equal(npc.deathT, 0, 'death animation finishes');
});

test('renderer draws the day/night wash and lit light-sources across the cycle', async () => {
  const { DAY_CYCLE_MS } = await import('../src/config.js');
  const game = headlessGame();
  const renderer = new Renderer(game, {}, makeCtx());
  // A lamp/fire/furnace/range should pick up the extra night-time glow bloom
  // without throwing, at both full daylight and deep night.
  assert.ok(game.world.objects.some((o) => o.def.type === 'fire' || o.def.type === 'furnace'), 'a light-source object exists in the world');
  for (const frac of [0, 0.25, 0.5, 0.75, 0.99]) {
    game.playMs = frac * DAY_CYCLE_MS;
    assert.doesNotThrow(() => renderer.render(frac * 1000), `renders cleanly at phase ${frac}`);
  }
});

test('ranged arrows and magic bolts render as distinct projectiles', () => {
  const game = headlessGame();
  const renderer = new Renderer(game, {}, makeCtx());
  const npc = game.npcs.find((n) => n.attackable);
  game.effects.push({ type: 'projectile', kind: 'arrow', x: game.player.x * 32, y: game.player.y * 32 - 8, ex: npc.x * 32, ey: npc.y * 32 - 8, color: '#d9c45a', life: 120, maxLife: 240 });
  game.effects.push({ type: 'swipe', entity: npc, mega: true, ang: 0, life: 300, maxLife: 520 });
  game.addHitsplat(npc, 42, { critX: 2 }); game.addHitsplat(npc, 99, { critX: 4 }); game.addHitsplat(npc, 7, {});
  game.effects.push({ type: 'projectile', kind: 'bullet', x: game.player.x * 32, y: game.player.y * 32 - 8, ex: npc.x * 32, ey: npc.y * 32 - 8, color: '#ffe28a', life: 120, maxLife: 240 });
  game.effects.push({ type: 'projectile', kind: 'shuriken', x: game.player.x * 32, y: game.player.y * 32 - 8, ex: npc.x * 32, ey: npc.y * 32 - 8, color: '#cfd8e6', life: 120, maxLife: 240 });
  game.effects.push({ type: 'projectile', kind: 'bolt', x: game.player.x * 32, y: game.player.y * 32 - 8, ex: npc.x * 32, ey: npc.y * 32 - 8, color: '#7fe0ee', life: 120, maxLife: 240 });
  assert.doesNotThrow(() => { renderer.render(200); renderer.render(600); });
});

test('renderer builds and uses a cached terrain canvas when a DOM exists', () => {
  const prevDoc = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }) };
  try {
    const game = headlessGame();
    const renderer = new Renderer(game, {}, makeCtx());
    assert.ok(renderer.terrainCanvas, 'terrain cache was built');
    assert.doesNotThrow(() => { renderer.render(0); renderer.render(900); });
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
  }
});

test('every creature sprite draws (both facings, moving + idle)', () => {
  const ctx = makeCtx();
  assert.doesNotThrow(() => {
    for (const id of Object.keys(NPCS)) {
      const d = NPCS[id];
      drawShadow(ctx, 100, 100);
      drawCreature(ctx, id, 100, 100, { time: 500, facing: { dx: -1, dy: 0 }, moving: true, sprite: d.sprite, color: d.color, scale: d.scale, boss: d.boss });
      drawCreature(ctx, id, 100, 100, { time: 0, facing: { dx: 1, dy: 0 }, moving: false, sprite: d.sprite, color: d.color, scale: d.scale, boss: d.boss });
    }
    drawCreature(ctx, 'unknown_id', 100, 100, {}); // townsfolk fallback path
  });
});

test('every object sprite draws (incl. depleted variants)', () => {
  const ctx = makeCtx();
  assert.doesNotThrow(() => {
    for (const objId of Object.keys(OBJECTS)) {
      const def = OBJECTS[objId];
      drawObjectSprite(ctx, { objId, def, depleted: false }, 120, 120, 700);
      if (def.type === 'tree' || def.type === 'rock') {
        drawObjectSprite(ctx, { objId, def, depleted: true }, 120, 120, 700);
      }
    }
  });
});

test('player and ground-item sprites draw in all states', () => {
  const ctx = makeCtx();
  assert.doesNotThrow(() => {
    drawPlayer(ctx, 80, 80, { time: 0, facing: { dx: 1, dy: 0 }, moving: false, hasBody: false, hasWeapon: false });
    drawPlayer(ctx, 80, 80, { time: 300, facing: { dx: -1, dy: 0 }, moving: true, hasBody: true, hasWeapon: true });
    // A shield on the off-hand is drawn independently of body/weapon/facing.
    drawPlayer(ctx, 80, 80, { time: 300, facing: { dx: 1, dy: 0 }, moving: false, hasShield: true });
    drawPlayer(ctx, 80, 80, { time: 300, facing: { dx: -1, dy: 0 }, moving: true, hasBody: true, hasWeapon: true, hasShield: true });
    // A golden prayer halo, with and without other gear.
    drawPlayer(ctx, 80, 80, { time: 150, facing: { dx: 1, dy: 0 }, moving: false, prayerActive: true });
    drawPlayer(ctx, 80, 80, { time: 450, facing: { dx: -1, dy: 0 }, moving: true, hasBody: true, hasWeapon: true, hasShield: true, prayerActive: true });
    drawGroundItem(ctx, 'logs', 80, 80);   // id-keyed icon (headless: rasteriser returns null -> fallback)
    drawGroundItem(ctx, 'unknown_item', 80, 80);
  });
});

test('painted creature archetypes stay in lock-step with assets/creatures/', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { creaturePngs } = await import('../src/render/sprites.js');
  const { NPCS } = await import('../src/data/npcs.js');
  const dir = fileURLToPath(new URL('../assets/creatures/', import.meta.url));
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));
  const declared = creaturePngs();
  assert.deepEqual([...declared].filter((s) => !onDisk.has(s)), [], 'declared archetype has no file');
  assert.deepEqual([...onDisk].filter((s) => !declared.has(s)), [], 'archetype file not declared');
  // Every painted archetype must be a real sprite used by at least one monster.
  const used = new Set(Object.values(NPCS).map((d) => d.sprite).filter(Boolean));
  assert.deepEqual([...declared].filter((s) => !used.has(s)), [], 'painted archetype unused by any monster');
});

test('species art stays in lock-step with assets/creatures/species/ and names real species', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { speciesArt } = await import('../src/render/sprites.js');
  const { NPCS } = await import('../src/data/npcs.js');
  const dir = fileURLToPath(new URL('../assets/creatures/species/', import.meta.url));
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const declared = speciesArt();
  assert.deepEqual([...declared].filter((s) => !onDisk.has(s)), [], 'declared species has no file');
  assert.deepEqual([...onDisk].filter((s) => !declared.has(s)), [], 'species file not declared');
  const families = new Set(Object.values(NPCS).map((d) => d.family).filter(Boolean));
  assert.deepEqual([...declared].filter((s) => !families.has(s)), [], 'species art for a family no monster has');
});

test('prayer and spell icons exist for every prayer and spell', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { PRAYERS } = await import('../src/data/prayers.js');
  const { SPELLS } = await import('../src/data/magic.js');
  const onDisk = new Set(readdirSync(fileURLToPath(new URL('../assets/icons/', import.meta.url))));
  // (new prayers may borrow an existing icon via `art`)
  for (const p of PRAYERS) assert.ok(onDisk.has(`prayer-${p.art || p.id}.webp`), `prayer-${p.art || p.id}.webp`);
  for (const s of SPELLS) assert.ok(onDisk.has(`spell-${s.id}.webp`), `spell-${s.id}.webp`);
});

test('boss art stays in lock-step with assets/creatures/bosses/ and names real bosses', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { bossArt } = await import('../src/render/sprites.js');
  const { ALL_BOSS_IDS: BOSS_IDS } = await import('../src/data/npcs.js');   // the original bosses plus the newer ones
  const dir = fileURLToPath(new URL('../assets/creatures/bosses/', import.meta.url));
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const declared = bossArt();
  assert.deepEqual([...declared].filter((s) => !onDisk.has(s)), [], 'declared boss art has no file');
  assert.deepEqual([...onDisk].filter((s) => !declared.has(s)), [], 'boss art file not declared');
  assert.deepEqual([...declared].filter((s) => !BOSS_IDS.includes(s)), [], 'boss art for an unknown boss');
});

test('townsfolk art stays in lock-step with assets/creatures/townsfolk/ and names real NPCs', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { townArt } = await import('../src/render/sprites.js');
  const { getNpc } = await import('../src/data/npcs.js');
  const dir = fileURLToPath(new URL('../assets/creatures/townsfolk/', import.meta.url));
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const declared = townArt();
  assert.deepEqual([...declared].filter((s) => !onDisk.has(s)), [], 'declared townsfolk art has no file');
  assert.deepEqual([...onDisk].filter((s) => !declared.has(s)), [], 'townsfolk art file not declared');
  for (const id of declared) assert.ok(getNpc(id) && !getNpc(id).attackable, `${id} is a real townsfolk NPC`);
});

test('world art stays in lock-step with assets/world/ and names real objects', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { worldArt } = await import('../src/render/sprites.js');
  const { groundTextures } = await import('../src/render/renderer.js');
  const { groundDetailArt } = await import('../src/render/terrainfx.js');
  const dir = fileURLToPath(new URL('../assets/world/', import.meta.url));
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const declared = new Set([...worldArt(), ...[...groundTextures()].map((g) => `ground-${g}`), ...groundDetailArt()]);
  assert.deepEqual([...declared].filter((s) => !onDisk.has(s)), [], 'declared world art has no file');
  assert.deepEqual([...onDisk].filter((s) => !declared.has(s)), [], 'world art file not declared');
  // Every object picture names a real object (trees and rocks by their id).
  for (const key of worldArt()) {
    if (key === 'rock-empty') continue;
    const id = key.replace(/^(obj|tree|stump|rock)-/, '').replace(/-\d+$/, '');   // animation frames end in -0, -1...
    assert.ok(OBJECTS[id], `${key} names a real object`);
  }
});

test('hero art exists for every combat style', async () => {
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { HERO_STYLES } = await import('../src/render/sprites.js');
  for (const s of HERO_STYLES) assert.ok(existsSync(fileURLToPath(new URL(`../assets/creatures/hero/${s}.webp`, import.meta.url))), `hero/${s}.webp`);
  const { CLASS_HERO_ART } = await import('../src/render/sprites.js');
  const { CLASS_BY_ID } = await import('../src/data/classes.js');
  for (const id of CLASS_HERO_ART) {
    assert.ok(CLASS_BY_ID[id], `${id} is a class`);
    assert.ok(existsSync(fileURLToPath(new URL(`../assets/creatures/hero/${id}.webp`, import.meta.url))), `hero/${id}.webp`);
  }
});

test('hero animation parts stay in lock-step with assets/creatures/hero/anim/ and name real classes', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { ANIM_ART, heroAnimFiles } = await import('../src/render/heroAnimArt.js');
  const { CLASS_BY_ID } = await import('../src/data/classes.js');
  const dir = fileURLToPath(new URL('../assets/creatures/hero/anim/', import.meta.url));
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const listed = new Set(heroAnimFiles());
  for (const f of listed) assert.ok(onDisk.has(f), `anim/${f}.webp is registered but missing`);
  for (const f of onDisk) assert.ok(listed.has(f), `anim/${f}.webp is on disk but not registered`);
  for (const id of Object.keys(ANIM_ART)) assert.ok(CLASS_BY_ID[id], `${id} is a class`);
  // Every arm ([w, h, pivot]) and back-view part ([x, y, w, h]) has a real size.
  for (const [id, a] of Object.entries(ANIM_ART)) {
    for (const arm of [a.swing, a.off].filter(Boolean).flatMap(Object.values)) assert.ok(arm.length === 4 && arm.every(Number.isFinite) && arm[0] > 0 && arm[1] > 0, `${id} arm size`);
    for (const r of Object.values(a.back || {})) assert.ok((r.length === 4 || r.length === 8) && r.every(Number.isFinite) && r[2] > 0 && r[3] > 0, `${id} back part size`);
  }
});

test('painted attack arms follow the clip: wind-up, mid-swing, follow-through, then rest', async () => {
  const { swingPhase, faceState, facingAway } = await import('../src/render/heroAnimArt.js');
  const { sampleHeroClip } = await import('../src/render/heroanim.js');
  const seen = [];
  for (let u = 0; u <= 1.0001; u += 0.01) {
    const p = swingPhase(sampleHeroClip('slash', u).ch, 'main');
    if (p !== seen[seen.length - 1]) seen.push(p);
  }
  assert.deepEqual(seen.filter(Boolean), ['wind', 'mid', 'follow'], `slash plays the three arms in order (${seen})`);
  assert.equal(swingPhase(sampleHeroClip('slash', 0).ch, 'main'), null, 'at rest before the swing');
  assert.equal(swingPhase(sampleHeroClip('slash', 1).ch, 'main'), null, 'back at rest after it');
  // A dual wielder's off hand plays its own set in its own turn.
  const off = new Set();
  for (let u = 0; u <= 1; u += 0.01) off.add(swingPhase(sampleHeroClip('scim_dual', u).ch, 'off'));
  for (const p of ['wind', 'mid', 'follow']) assert.ok(off.has(p), `off hand reaches ${p}`);
  // The bow and the staff run through all three too.
  for (const [clip, kind] of [['bow', 'bow'], ['cast', 'staff'], ['rifle', 'gun']]) {
    const ps = new Set();
    for (let u = 0; u <= 1; u += 0.01) ps.add(swingPhase(sampleHeroClip(clip, u).ch, 'main', kind));
    for (const p of ['wind', 'mid', 'follow']) assert.ok(ps.has(p), `${clip} reaches ${p}`);
  }
  assert.equal(faceState({ hurt: 120, time: 0 }), 'hurt');
  assert.equal(faceState({ anim: { id: 'cheer', ch: {} }, time: 500 }), 'victory');
  assert.equal(faceState({ time: 10 }), 'blink');
  assert.equal(faceState({ time: 1000 }), 'body');
  assert.ok(facingAway({ facing: { dx: 0, dy: -1 } }) && !facingAway({ facing: { dx: 1, dy: -1 } }) && !facingAway({ facing: { dx: 0, dy: 1 } }));
});

test('rigged bosses and species ship every layer they animate', async () => {
  const { rigIds, rigParts, rigKind } = await import('../src/render/sprites.js');
  const { NPCS } = await import('../src/data/npcs.js');
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  assert.ok(rigIds().includes('eternal_wyrm'));
  assert.ok(rigIds().includes('rat'), 'the rat pilot is rigged');
  const families = new Set(Object.values(NPCS).map((d) => d.family).filter(Boolean));
  for (const id of rigIds()) {
    const dir = rigKind(id) === 'species' ? 'species' : 'bosses';
    if (dir === 'species') assert.ok(families.has(id), `${id} is a real monster family`);
    else assert.ok(NPCS[id]?.boss, `${id} is a real boss`);
    for (const part of rigParts(id)) {
      assert.ok(existsSync(fileURLToPath(new URL(`../assets/creatures/${dir}/rig/${id}_${part}.webp`, import.meta.url))), `${dir}/rig/${id}_${part}`);
    }
  }
});

test('rig folders hold only the layers the rigs declare', async () => {
  const { rigIds, rigParts, rigKind } = await import('../src/render/sprites.js');
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  for (const dir of ['species', 'bosses']) {
    const declared = new Set(rigIds().filter((id) => (rigKind(id) === 'species') === (dir === 'species')).flatMap((id) => rigParts(id).map((p) => `${id}_${p}`)));
    const onDisk = readdirSync(fileURLToPath(new URL(`../assets/creatures/${dir}/rig/`, import.meta.url))).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5));
    assert.deepEqual(onDisk.filter((f) => !declared.has(f)), [], `${dir}/rig file not used by any rig`);
  }
});

test('townsfolk idle parts stay in lock-step with assets/creatures/townsfolk/idle/', async () => {
  const { townIdleIds, townIdleParts, townArt } = await import('../src/render/sprites.js');
  const { getNpc } = await import('../src/data/npcs.js');
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const onDisk = new Set(readdirSync(fileURLToPath(new URL('../assets/creatures/townsfolk/idle/', import.meta.url))).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const declared = new Set(townIdleIds().flatMap((id) => townIdleParts(id).map((p) => `${id}_${p}`)));
  assert.ok(townIdleIds().length > 0);
  assert.deepEqual([...declared].filter((f) => !onDisk.has(f)), [], 'declared idle part has no file');
  assert.deepEqual([...onDisk].filter((f) => !declared.has(f)), [], 'idle part file not declared');
  for (const id of townIdleIds()) {
    assert.ok(getNpc(id) && !getNpc(id).attackable, `${id} is a real townsfolk NPC`);
    assert.ok(townArt().has(id), `${id} also has its still picture (idle parts are sized against it)`);
    for (const p of ['body', 'body_blink']) assert.ok(townIdleParts(id).includes(p), `${id} has ${p}`);
  }
});

test('creature rigs from the parts sheets have joints on their canvas and a motion for each part', async () => {
  const { CREATURE_RIGS } = await import('../src/render/creatureRigs.js');
  assert.ok(Object.keys(CREATURE_RIGS).length > 0);
  for (const [id, rig] of Object.entries(CREATURE_RIGS)) {
    assert.ok(rig.fit > 0.3 && rig.fit < 2, `${id} is sized like its still art`);
    for (const n of rig.order) {
      const p = rig.parts[n];
      assert.ok(p.piv.every((v) => v >= -0.05 && v <= 1.05), `${id} ${n} joint on the canvas`);
      if (p.alt) assert.ok(rig.files.includes(p.alt), `${id} ${n} alternate ships`);
      const a = p.swing ? p.swing(1234, { moving: true, attackK: 0.5, castK: 0.4 }) : 0;
      assert.ok(Number.isFinite(a) && Math.abs(a) < 1.6, `${id} ${n} swings sensibly`);
    }
  }
});

test('every monster body type has an automatic animation style', async () => {
  const { puppetKinds } = await import('../src/render/sprites.js');
  const { NPCS } = await import('../src/data/npcs.js');
  const kinds = puppetKinds();
  const sprites = new Set(Object.values(NPCS).filter((d) => d.attackable).map((d) => d.sprite));
  for (const sp of sprites) assert.ok(kinds[sp], `${sp} monsters animate`);
});

test('every boss and champion-able monster has a battle-bar portrait', async () => {
  const { portraitFor } = await import('../src/render/sprites.js');
  const { NPCS } = await import('../src/data/npcs.js');
  for (const [id, d] of Object.entries(NPCS)) {
    if (!d.attackable) continue;
    const pr = portraitFor(id, d);
    assert.ok(pr && pr.src.endsWith('.webp'), `${id} has a portrait`);
    if (d.boss) assert.ok(pr.src.includes('/bosses/'), `${id} uses its boss art`);
  }
});

test('every ability has an icon on disk: its own art, or the art it names', async () => {
  const { ABILITIES } = await import('../src/data/abilities.js');
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const onDisk = new Set(readdirSync(fileURLToPath(new URL('../assets/icons/', import.meta.url))));
  for (const a of ABILITIES) {
    assert.ok(onDisk.has(`ability-${a.art || a.id}.webp`), `${a.id} has ability-${a.art || a.id}.webp`);
  }
  // The class C skills have their own painted icons.
  for (const a of ABILITIES.filter((x) => x.cls && x.key === 'C')) assert.ok(!a.art && onDisk.has(`ability-${a.id}.webp`), `${a.id} has its own icon`);
});

test('HUD orbs keep the sticker skin: no dark-skin neon colours in the orb code', async () => {
  const { readFileSync } = await import('node:fs');
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  // The orb renderers, from renderHp through renderPrayer.
  const start = ui.indexOf('  renderHp() {');
  const end = ui.indexOf('  _buildPrayerPanel() {');
  assert.ok(start > 0 && end > start, 'found the orb renderers in ui.js');
  const orbCode = ui.slice(start, end);
  // The old dark orbs set neon text inline (hsl(hue, 90%, 65%) and friends,
  // measured at rgb(76,240,76): about 1.3:1 on the white discs) and sat on a
  // #06201c glass gradient. The numbers take their deep colours from CSS now.
  assert.doesNotMatch(orbCode, /style\.color\s*=/, 'orbs set no inline text colour');
  assert.doesNotMatch(orbCode, /hsla?\(/i, 'no hsl() neon colours in the orb code');
  for (const hex of ['#06201c', '#0e2a27', '#16403b', '#6fff8f', '#ffd24a', '#5ad1ff', '#ff9fb0', 'rgb\\(76, ?240, ?76\\)']) {
    assert.doesNotMatch(orbCode, new RegExp(hex, 'i'), `no ${hex} in the orb code`);
  }
  assert.match(orbCode, /setProperty\('--fill'/, 'orbs report their fill level to CSS');
});

test('the Lancer only pierces: the spear never swings in an arc, it draws back and thrusts straight', async () => {
  const { heroRigPose } = await import('../src/render/heroRig.js');
  const gait = { move: 0, phase: 0 };
  const idle = heroRigPose('lancer', gait, 0, -1).sword;
  let minReach = 0, maxReach = 0;
  for (let k = 0; k <= 1.0001; k += 0.02) {
    const p = heroRigPose('lancer', gait, 0, k);
    assert.ok(Math.abs(p.sword - idle) < 1e-9, `no rotation at ${k.toFixed(2)}`);
    minReach = Math.min(minReach, p.reach); maxReach = Math.max(maxReach, p.reach);
  }
  assert.ok(minReach < -1, 'draws back first');
  assert.ok(maxReach > 10, 'then drives forward');
  assert.ok(heroRigPose('lancer', gait, 0, 0.55).strike > 0.99, 'the spear stays levelled through the jab (no upright ghost)');
  assert.ok(Math.abs(heroRigPose('lancer', gait, 0, 1).reach) < 0.5, 'and comes back to rest');
  // Other polearms still swing.
  const h = (k) => heroRigPose('halberdier', gait, 0, k).sword;
  assert.ok(Math.abs(h(0.6) - h(0)) > 0.1, 'the halberd still swings');
});

// The notification lane (banners and first-time tips) must never block the
// game under it: the lane itself lets taps through; only its cards (tap to
// put one away) and their buttons catch them.
test('notification lane never blocks the buttons under it', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  const lane = css.match(/#notice-lane \{[^}]*\}/)[0];
  assert.match(lane, /pointer-events:\s*none/, 'the lane lets taps through');
  assert.match(css.match(/\.nl-card \{[^}]*\}/)[0], /pointer-events:\s*auto/, 'its cards stay tappable');
});

test('art batch 1: weapon and armour types, signature weapons, bones and trinkets use their own stickers', async () => {
  const { itemIconSVG } = await import('../src/render/icons.js');
  const { ITEMS } = await import('../src/data/items.js');
  const { worldArt } = await import('../src/render/sprites.js');
  // The bestiary expansion's bosses have no stickers yet: their weapons borrow an older one, recoloured.
  const { BESTIARY_BOSSES } = await import('../src/data/bestiary.js');
  const NEW_SIG = new Set(BESTIARY_BOSSES.map((b) => `sig_${b.id}`));
  for (const id of NEW_SIG) assert.match(itemIconSVG(id, 24), /assets\/icons\/item-sig_\w+\.webp[^>]*filter:hue-rotate/, `${id} borrows a tinted sticker`);
  const tiers = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'dragon', 'obsidian', 'orichalcum', 'jade', 'starmetal', 'celestial', 'eternal'];
  const ids = [
    ...tiers.flatMap((t) => ['parang', 'kerambit', 'toya', 'crossbow', 'chakram', 'orb', 'fan', 'rifle', 'quiver',
      'scout_gloves', 'scout_boots', 'hide_vambraces', 'hide_boots', 'mage_gloves', 'mage_boots'].map((w) => `${t}_${w}`)),
    ...Object.keys(ITEMS).filter((id) => ITEMS[id].signature && !NEW_SIG.has(id)),
    'big_bones', 'legend_bones', 'refine_scroll', 'pearl_ring', 'pearl_amulet', 'holy_beads', 'lantern_cape', 'starlit_pendant',
  ];
  for (const id of ids) {
    assert.ok(ITEMS[id], `${id} is an item`);
    const html = itemIconSVG(id, 24);
    assert.ok(html.includes(`assets/icons/item-${id}.webp`) && !html.includes('filter:'), `${id} has its own untinted sticker`);
  }
  // The endgame rocks and the Offering Shrine have their own pictures too.
  for (const id of ['obsidian_vein', 'orichalcum_rock', 'jade_seam', 'fallen_star', 'skyglass_crystal', 'eternal_lode']) assert.ok(worldArt().has(`rock-${id}`), id);
  assert.ok(worldArt().has('obj-offering_shrine') && !OBJECTS.offering_shrine.art && !OBJECTS.offering_shrine.tint, 'offering shrine');
});

test('title art stays in lock-step with assets/title/ and fills a declared slot', async () => {
  const { readdirSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { TITLE_ART, TITLE_ART_SLOTS, titleArtSrc } = await import('../src/ui/title.js');
  const dir = fileURLToPath(new URL('../assets/title/', import.meta.url));
  // The folder only exists once the first painted picture arrives.
  const onDisk = new Set(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)) : []);
  assert.deepEqual([...TITLE_ART].filter((s) => !onDisk.has(s)), [], 'declared title art has no file');
  assert.deepEqual([...onDisk].filter((s) => !TITLE_ART.has(s)), [], 'title art file not declared in TITLE_ART');
  for (const s of TITLE_ART) assert.ok(TITLE_ART_SLOTS[s], `${s} is a known slot`);
  for (const [s, slot] of Object.entries(TITLE_ART_SLOTS)) {
    assert.ok(slot.size && slot.use && slot.placeholder, `${s} says its size, use and stand-in`);
    assert.equal(titleArtSrc(s), TITLE_ART.has(s) ? `assets/title/${s}.webp` : null);
  }
});
