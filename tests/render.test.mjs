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
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
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

  assert.doesNotThrow(() => { renderer.render(0); renderer.render(1234.5); });
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
