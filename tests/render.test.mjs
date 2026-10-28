// Headless render smoke test: drives the Renderer and every sprite branch against
// a stub 2D context to catch runtime errors (missing methods, bad colours) without a browser.
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
  // An active prayer should flow through to the player's golden halo too.
  game.activePrayers.add('thick_skin');

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
  for (const p of PRAYERS) assert.ok(onDisk.has(`prayer-${p.id}.webp`), `prayer-${p.id}.webp`);
  for (const s of SPELLS) assert.ok(onDisk.has(`spell-${s.id}.webp`), `spell-${s.id}.webp`);
});

test('boss art stays in lock-step with assets/creatures/bosses/ and names real bosses', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { bossArt } = await import('../src/render/sprites.js');
  const { BOSS_IDS } = await import('../src/data/npcs.js');
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
  const dir = fileURLToPath(new URL('../assets/world/', import.meta.url));
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  const declared = new Set([...worldArt(), ...[...groundTextures()].map((g) => `ground-${g}`)]);
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
