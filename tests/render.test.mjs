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
  // A running Faith Burst should flow through to the player's golden halo too.
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
  // Every blessing has its own icon (none borrow another's with `art` any more).
  for (const p of PRAYERS) assert.ok(!p.art && !p.tint && onDisk.has(`prayer-${p.id}.webp`), `prayer-${p.id}.webp`);
  // A spell still waiting on its painted icon (the Priest's and the Zealot's own)
  // has a vector in SPELL_SVG until the file arrives; never both, never neither.
  const { SPELL_SVG } = await import('../src/render/icons.js');
  for (const s of SPELLS) assert.ok(onDisk.has(`spell-${s.id}.webp`) !== !!SPELL_SVG[s.id], `spell-${s.id}.webp or a vector, not both`);
  for (const id of Object.keys(SPELL_SVG)) assert.ok(SPELLS.some((s) => s.id === id), `${id} is a spell`);
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
  const { RESIDENTS } = await import('../src/data/consequences.js');   // the living world's residents are drawn by their own id
  for (const id of declared) {
    if (id === 'event_merchant' || id === 'story_messenger') continue;   // the lost merchant and the story's messenger, drawn by artId (worldevents.js, story.js)
    assert.ok(RESIDENTS[id] || (getNpc(id) && !getNpc(id).attackable), `${id} is a real townsfolk NPC`);
  }
});

test('the plaza paving mixes in its variants by 4 x 4 block, the same every bake', async () => {
  const { TERRAIN } = await import('../src/data/world.js');
  const { groundTextures } = await import('../src/render/renderer.js');
  assert.ok(['stone', 'stone-2', 'stone-3'].every((n) => groundTextures().has(n)));
  // Stand-in textures, so _groundTile runs headless; record which one each tile draws.
  const plain = { id: 'stone' }, v2 = { id: 'stone-2' }, v3 = { id: 'stone-3' };
  const fake = { groundTex: { ready: true, [TERRAIN.STONE]: plain, variants: { [TERRAIN.STONE]: [[v2, 0.2], [v3, 0.2]] } } };
  const pick = (x, y) => { let id; Renderer.prototype._groundTile.call(fake, { drawImage: (img) => { id = img.id; } }, TERRAIN.STONE, x, y, 0, 0); return id; };
  const n = { stone: 0, 'stone-2': 0, 'stone-3': 0 };
  for (let by = 0; by < 30; by++) for (let bx = 0; bx < 30; bx++) {
    const id = pick(bx * 4, by * 4);
    n[id]++;
    assert.equal(pick(bx * 4 + 3, by * 4 + 2), id, 'one texture across the block');
    assert.equal(pick(bx * 4, by * 4), id, 'the same every time');
  }
  assert.ok(n.stone > 900 * 0.5 && n['stone-2'] > 900 * 0.1 && n['stone-3'] > 900 * 0.1, JSON.stringify(n));
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
    if (/^obj-sign-/.test(key)) continue;   // a resource zone's signpost (checked in its own test)
    if (key === 'obj-lore_scroll' || key === 'obj-ransacked_stall') continue;   // story objects (story.js, lore.js)
    if (key === 'obj-gravestone') continue;   // where you last fell (grave.js)
    if (['obj-event_shoal', 'rock-meteorite', 'tree-ancient'].includes(key)) continue;   // world event nodes (worldevents.js)
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

test('the snake, swimmer and plant plans breathe at rest, wind up and strike', async () => {
  const { buildRig, bodyPlans } = await import('../src/render/creatureRigs.js');
  const PARTS = {
    slither: ['tail', 'body', 'head'],
    swim: ['arm_far', 'tail', 'body', 'head', 'arm_near'],
    plant: ['arm_far', 'body', 'head', 'arm_near'],
  };
  assert.deepEqual(bodyPlans().sort(), Object.keys(PARTS).sort());
  for (const [plan, order] of Object.entries(PARTS)) {
    const piv = Object.fromEntries([...order, 'head_attack'].map((n) => [n, [0.5, 0.5]]));
    const rig = buildRig(`test_${plan}`, { plan, kind: 'species', fit: 1, order, piv });
    const idle = { moving: false, attackK: -1 };
    // Every moving part has a motion, and it moves over time at rest.
    for (const n of order.filter((n) => n !== 'body')) {
      const sw = rig.parts[n].swing;
      assert.ok(sw, `${plan} ${n} moves`);
      assert.notEqual(sw(1000, idle).toFixed(4), sw(2400, idle).toFixed(4), `${plan} ${n} stirs at rest`);
      for (const k of [-1, 0, 0.2, 0.35, 0.5, 0.8, 1]) assert.ok(Math.abs(sw(1234, { moving: true, attackK: k })) < 0.8, `${plan} ${n} swings sensibly`);
    }
    // The head draws back on the wind-up, then strikes the other way with its attack face on.
    const head = rig.parts.head;
    const wind = head.swing(1000, { attackK: 0.34 }), hit = head.swing(1000, { attackK: 0.6 });
    assert.ok(Math.sign(wind) !== Math.sign(hit) && Math.abs(wind) > 0.05 && Math.abs(hit) > 0.1, `${plan} head winds up and strikes`);
    assert.equal(head.alt, 'head_attack');
    assert.ok(head.swap({ attackK: 0.6 }) && !head.swap({ attackK: -1 }), `${plan} bares its teeth only to strike`);
    // The whole body sways or bobs at rest and gathers itself on the wind-up.
    const b0 = rig.body(1000, idle), b1 = rig.body(1400, idle), bw = rig.body(1000, { attackK: 0.34 });
    for (const b of [b0, b1, bw]) for (const v of Object.values(b)) assert.ok(Number.isFinite(v), `${plan} body motion is finite`);
    assert.ok(Math.abs(b0.lean - b1.lean) + Math.abs(b0.dy - b1.dy) > 0.01, `${plan} body moves at rest`);
    assert.ok(bw.lean < b0.lean - 0.03, `${plan} leans back on the wind-up`);
    assert.ok(Math.abs(bw.lean) < 0.3 && bw.sx > 0.8 && bw.sy > 0.8, `${plan} stays in proportion`);
  }
});

// Canvas size from a .webp header (VP8X, lossy VP8 or lossless VP8L), so tests can check layers share one canvas.
function webpSize(buf) {
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  const b = buf.readUInt32LE(21);
  return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)];
}

test('Part E species rigs: real monsters with their still art, layers on one canvas, joints on the picture', async () => {
  const { CREATURE_RIGS } = await import('../src/render/creatureRigs.js');
  const { speciesArt } = await import('../src/render/sprites.js');
  const { NPCS } = await import('../src/data/npcs.js');
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const families = new Set(Object.values(NPCS).map((d) => d.family));
  const E = ['reticulated_python', 'reef_shark', 'tarantula', 'sea_snake', 'jungle_spider', 'rust_golem', 'pocong', 'skeleton', 'outlaw', 'wild_dog',
    'jungle_wraith', 'smuggler', 'pink_dolphin', 'hornbill', 'pontianak', 'dock_rat', 'horseshoe_crab', 'drowned_sailor', 'flying_fox', 'king_cobra'];
  for (const id of E.filter((f) => CREATURE_RIGS[f])) {
    const rig = CREATURE_RIGS[id];
    assert.equal(rig.kind, 'species');
    assert.ok(families.has(id) && speciesArt().has(id), `${id} is a monster family with its still picture`);
    assert.ok(rig.order.includes('body'), `${id} has a body layer`);
    const sizes = rig.files.map((n) => webpSize(readFileSync(fileURLToPath(new URL(`../assets/creatures/species/rig/${id}_${n}.webp`, import.meta.url)))));
    for (const sz of sizes) assert.deepEqual(sz, sizes[0], `${id} layers share one canvas`);
    for (const n of rig.order) {
      const [x, y] = rig.parts[n].piv;
      assert.ok(x > 0.02 && x < 0.98 && y > 0.02 && y <= 1, `${id} ${n} joint is on the picture`);
    }
  }
  assert.ok(E.filter((f) => CREATURE_RIGS[f]).length >= 16, 'most of the E1 and E2 batches are rigged');
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

test('every ability has its own icon, in lock-step with assets/icons/ability-*.webp', async () => {
  const { ABILITIES } = await import('../src/data/abilities.js');
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const onDisk = new Set(readdirSync(fileURLToPath(new URL('../assets/icons/', import.meta.url))));
  // Every ability (class skills included) has its own painted icon, not a borrowed one.
  for (const a of ABILITIES) assert.ok(!a.art && onDisk.has(`ability-${a.id}.webp`), `${a.id} has its own icon`);
  // ...and every ability icon on disk belongs to a real ability.
  const ids = new Set(ABILITIES.map((a) => a.id));
  const stray = [...onDisk].filter((f) => /^ability-.*\.webp$/.test(f) && !ids.has(f.slice(8, -5)));
  assert.deepEqual(stray, [], 'ability icons for no ability');
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

test('Part F: the tiered gathering tools stay in lock-step with their item-*.webp stickers', async () => {
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { itemArtSrc } = await import('../src/render/icons.js');
  const { TOOL_KINDS, toolIds } = await import('../src/data/tooltiers.js');
  const ids = TOOL_KINDS.flatMap((K) => toolIds(K.tag).slice(1));
  assert.equal(ids.length, 55);
  // Any <word>_<kind> sticker other than the tier-1 tools' (bronze_axe, fishing_rod...) must be a tiered tool.
  const kinds = TOOL_KINDS.map((K) => K.tag).join('|'), bases = new Set(TOOL_KINDS.map((K) => K.base));
  const onDisk = readdirSync(fileURLToPath(new URL('../assets/icons/', import.meta.url)))
    .map((f) => new RegExp(`^item-([a-z]+_(?:${kinds}))\\.webp$`).exec(f)?.[1]).filter((id) => id && !bases.has(id));
  assert.deepEqual(onDisk.sort(), [...ids].sort(), 'every tiered tool has a sticker file, and no stray ones');
  for (const id of ids) assert.equal(itemArtSrc(id), `assets/icons/item-${id}.webp`, `${id} uses its own sticker`);
});

test('art batch 1: weapon and armour types, signature weapons, bones and trinkets use their own stickers', async () => {
  const { itemIconSVG } = await import('../src/render/icons.js');
  const { ITEMS } = await import('../src/data/items.js');
  const { worldArt } = await import('../src/render/sprites.js');
  // The bestiary expansion's bosses' weapons have their own stickers now (art packs 08 and 09), untinted.
  const { BESTIARY_BOSSES } = await import('../src/data/bestiary.js');
  const NEW_SIG = new Set(BESTIARY_BOSSES.map((b) => `sig_${b.id}`));
  for (const id of NEW_SIG) {
    const html = itemIconSVG(id, 24);
    assert.match(html, new RegExp(`assets/icons/item-${id}\\.webp`), `${id} uses its own sticker`);
    assert.ok(!/filter:hue-rotate/.test(html), `${id} is not recoloured`);
  }
  const tiers = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'dragon', 'obsidian', 'orichalcum', 'jade', 'starmetal', 'celestial', 'eternal'];
  const ids = [
    ...tiers.flatMap((t) => ['parang', 'kerambit', 'toya', 'crossbow', 'chakram', 'orb', 'fan', 'rifle', 'quiver',
      'scout_gloves', 'scout_boots', 'hide_vambraces', 'hide_boots', 'mage_gloves', 'mage_boots'].map((w) => `${t}_${w}`)),
    ...Object.keys(ITEMS).filter((id) => ITEMS[id].signature && !ITEMS[id].signature.ascended && !NEW_SIG.has(id)),
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

test('art pack 10: residents, zone signs, story objects and UI badges use their own art', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { townArt, worldArt } = await import('../src/render/sprites.js');
  const { RESIDENTS } = await import('../src/data/consequences.js');
  const { UI_ICONS, uiIconHTML } = await import('../src/render/icons.js');
  // Every living-world resident has their own townsfolk picture.
  for (const id of Object.keys(RESIDENTS)) assert.ok(townArt().has(id), `${id} has its own townsfolk art`);
  // Each resource zone's signpost wears its skill's sign; ordinary signs stay plain.
  const { buildWorld } = await import('../src/data/world.js');
  const data = buildWorld();
  const signs = data.objects.filter((o) => o.objId === 'sign');
  for (const z of data.resourceZones) {
    const s = signs.find((o) => o.x === z.cx && o.y === z.cy);
    assert.ok(s, `${z.id} has a signpost`);
    assert.equal(s.art, `obj-sign-${z.skill}`, `${z.id} signpost`);
    assert.ok(worldArt().has(s.art), `${s.art} is registered`);
  }
  assert.ok(signs.some((o) => !o.art), 'ordinary signs keep the plain signpost');
  for (const k of ['obj-lore_scroll', 'obj-ransacked_stall']) assert.ok(worldArt().has(k), k);
  const src = (f) => readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8');
  assert.match(src('src/game/lore.js'), /art: 'obj-lore_scroll'/);
  assert.match(src('src/game/story.js'), /art: 'obj-ransacked_stall'/);
  // The UI badges stay in lock-step with assets/icons/icon-*.webp, and each is used.
  const onDisk = readdirSync(fileURLToPath(new URL('../assets/icons/', import.meta.url))).filter((f) => f.startsWith('icon-')).map((f) => f.slice(5, -5));
  assert.deepEqual([...onDisk].sort(), [...UI_ICONS].sort());
  assert.match(uiIconHTML('teleport-town', 26), /assets\/icons\/icon-teleport-town\.webp/);
  assert.match(uiIconHTML('teleport-town', 26), /onerror="this\.remove\(\)"/, 'a missing picture leaves the old look');
  const ui = ['src/ui/lifeskillui.js', 'src/ui/playhud.js', 'src/ui/blessingsui.js', 'src/ui/reputationui.js'].map(src).join('\n') + src('styles/blessings.css');
  for (const n of UI_ICONS) assert.ok(ui.includes(`'${n}'`) || ui.includes(`icon-${n}.webp`), `icon-${n} is used`);
});

test('gameplay art pack: items, world objects, quest givers, pets and gameplay icons use their own art', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { itemIconSVG, PLAY_ICONS, playIconHTML, EVENT_ICON, mechIcon } = await import('../src/render/icons.js');
  const { worldArt, townArt } = await import('../src/render/sprites.js');
  const { PET_ART, PET_ART_PENDING, petArtSrc } = await import('../src/render/petsprite.js');
  const { SKILL_PETS } = await import('../src/game/pets.js');
  const { REGION_GIVERS } = await import('../src/data/regionQuests.js');
  const { EVENT_KINDS } = await import('../src/data/worldevents.js');
  const { MECH_KINDS } = await import('../src/data/bossMechanics.js');
  const { ITEMS } = await import('../src/data/items.js');
  const dir = (d) => fileURLToPath(new URL(`../assets/${d}/`, import.meta.url));
  // Items: the endgame goods that used to borrow a tinted sticker now have their own.
  for (const id of ['raw_dorado', 'arowana_feast', 'boar_rendang', 'fish_head_curry', 'torch_ginger_seed', 'eternal_lotus', 'anglers_brew',
    'phoenix_elixir', 'barbed_hooks', 'bamboo_decoy', 'phoenix_ember', 'casino_chip', 'eternal_amulet', 'pest_token', 'mosquito_net_cape']) {
    assert.ok(ITEMS[id], `${id} is an item`);
    const html = itemIconSVG(id, 24);
    assert.ok(html.includes(`assets/icons/item-${id}.webp`) && !html.includes('filter:'), `${id} has its own untinted sticker`);
  }
  // World objects: every object with a picture of its own shows it untinted, never a borrowed one.
  for (const [id, d] of Object.entries(OBJECTS)) {
    if (!worldArt().has(`obj-${id}`)) continue;
    assert.ok(!d.art && !d.tint, `${id} wears its own picture, not a tinted borrow`);
  }
  for (const id of Object.keys(OBJECTS).filter((k) => OBJECTS[k].type === 'agility' && OBJECTS[k].level >= 100)) assert.ok(worldArt().has(`obj-${id}`), `${id} has its own picture`);
  // A world event's node draws its event picture (the shoal untinted, though its def carries a tint).
  const ctx = makeCtx(), drawn = [];
  ctx.drawImage = (img) => drawn.push(img);
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 80; } };
  try {
    for (const [objId, key] of [['dorado_spot', 'obj-event_shoal'], ['fallen_star', 'rock-meteorite'], ['oak', 'tree-ancient']]) {
      drawn.length = 0;
      drawObjectSprite(ctx, { objId, def: { ...OBJECTS[objId], tint: 'saturate(2)', worldEvent: true }, worldEvent: true, x: 1, y: 1 }, 50, 50, 0);
      assert.ok(drawn.some((im) => im.src === `assets/world/${key}.webp`), `${objId} as a world event draws ${key}`);
    }
  } finally { delete globalThis.Image; }
  // Quest givers and the lost merchant have townsfolk pictures of their own.
  for (const id of [...Object.keys(REGION_GIVERS), 'event_merchant']) assert.ok(townArt().has(id), `${id} has its own picture`);
  assert.match(readFileSync(fileURLToPath(new URL('../src/game/worldevents.js', import.meta.url)), 'utf8'), /artId = 'event_merchant'/);
  // Pets: every life-skill pet has its own picture, in lock-step with assets/creatures/pets/.
  const pets = new Set(readdirSync(dir('creatures/pets')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
  assert.deepEqual([...pets].sort(), [...PET_ART].sort());
  for (const p of Object.values(SKILL_PETS)) assert.equal(petArtSrc(p.id), PET_ART_PENDING.has(p.id) ? null : `assets/creatures/pets/${p.id}.webp`);
  for (const id of PET_ART_PENDING) assert.ok(!pets.has(id), `${id}'s picture has arrived: take it off PET_ART_PENDING`);
  // (A new life skill's pet waits in PET_ART_PENDING, wearing its creature's art, until its picture arrives.)
  // Gameplay icons stay in lock-step with assets/icons/{mech,event,quality,ui}-*.webp, and each is used.
  const icons = readdirSync(dir('icons')).filter((f) => /^(mech|event|quality|ui)-/.test(f)).map((f) => f.slice(0, -5))
    .filter((n) => n !== 'ui-lockon' && n !== 'ui-cancel');   // older HUD art, loaded directly
  assert.deepEqual(icons.sort(), [...PLAY_ICONS].sort());
  assert.match(playIconHTML('ui-focus', 16), /assets\/icons\/ui-focus\.webp"[^>]*onerror="this\.remove\(\)"/);
  for (const k of Object.keys(EVENT_KINDS)) assert.ok(PLAY_ICONS.includes(EVENT_ICON[k]), `${k} has an event icon`);
  for (const t of Object.keys(MECH_KINDS)) assert.ok(PLAY_ICONS.includes(mechIcon(t)), `${t} has a mechanic icon`);
  const src = ['src/ui/playhud.js', 'src/ui/homeui.js', 'src/ui/collectionui.js', 'src/ui/worldeventsui.js', 'src/ui/ranksui.js', 'src/ui/ui.js',
    'src/ui/skillguideui.js', 'src/game/skillunlocks.js', 'src/render/icons.js',
    // The small controls (UI-5): drawn by these, or written into the page itself.
    'src/ui/quickbar.js', 'src/ui/photomode.js', 'src/ui/noticelane.js', 'src/ui/accountui.js', 'src/ui/hudease.js', 'src/render/minimapart.js', 'index.html',
  ].map((f) => readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8')).join('\n');
  for (const n of PLAY_ICONS) {
    if (/^(event|mech|quality)-/.test(n) && n !== 'event-weekly_crate') continue;   // reached by EVENT_ICON, mechIcon and `quality-${q}`
    assert.ok(src.includes(`'${n}'`) || src.includes(`assets/icons/${n}.webp`), `${n} is used`);
  }
});

test('final creature art: the last borrowing species and townsfolk wear their own pictures, untinted', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { speciesArt, townArt, portraitFor } = await import('../src/render/sprites.js');
  const fams = ['plantain_squirrel', 'red_junglefowl', 'strangler_fig', 'paradise_tree_snake', 'toman_snakehead',
    'hantu_air', 'fiddler_crab', 'sentosa_peafowl', 'sandcastle_golem', 'bajang'];
  for (const f of fams) {
    assert.ok(speciesArt().has(f), `${f} has its own species art`);
    const ids = Object.keys(NPCS).filter((id) => NPCS[id].family === f && !NPCS[id].boss);
    assert.ok(ids.length >= 3, `${f} has its three forms`);
    for (const id of ids) {
      const p = portraitFor(id, NPCS[id]);
      assert.equal(p.src, `assets/creatures/species/${f}.webp`, `${id} draws its own art`);
      assert.ok(!p.tint, `${id} is not recoloured`);
    }
  }
  for (const id of ['pest_officer', 'marina_high_roller', 'jade_merchant', 'story_messenger']) assert.ok(townArt().has(id), `${id} has its own picture`);
  // ...and no longer borrows a recoloured one.
  const src = readFileSync(fileURLToPath(new URL('../src/render/sprites.js', import.meta.url)), 'utf8');
  assert.match(src, /const TOWN_ALIAS = \{\};/);
  assert.match(src, /const TOWN_TINT = \{\};/);
});

test('Part E batch 3 species rigs ship every layer on one canvas, with joints inside their parts', async () => {
  const { CREATURE_RIGS } = await import('../src/render/creatureRigs.js');
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  // RS21-RS30 (the sun bear's sheet didn't line up, so it keeps its still picture; the mud
  // crab's RS30 parts were the old drawing, retired when CR-1 repainted it), then CRR-1 and
  // CRR-2: the repainted mud crab and kelong crab cut into parts.
  const PLAN = { sea_turtle: 'quad', vampire_bat: 'flier', kingfisher: 'flier', carnivorous_plant: 'plant', banded_leaf_monkey: 'quad', bunian: 'float', clouded_leopard: 'quad', sambar_deer: 'quad',
    mud_crab: 'crawl', kelong_crab: 'crawl' };
  // Each layer's opaque box on the shared canvas (fractions), measured when the layers were cut.
  const BOX = {
    sea_turtle: { front_far: [0.688, 0.422, 0.959, 0.902], back_near: [0.069, 0.484, 0.319, 0.709], front_near: [0.266, 0.447, 0.603, 0.939], body: [0.075, 0.135, 0.753, 0.73], head: [0.531, 0.033, 0.975, 0.594], head_open: [0.531, 0.033, 0.972, 0.594] },
    vampire_bat: { wing_far: [0.022, 0.046, 0.441, 0.684], feet: [0.312, 0.615, 0.509, 0.816], body: [0.381, 0.207, 0.678, 0.839], wing_near: [0.575, 0.046, 0.972, 0.718] },
    kingfisher: { feet: [0.331, 0.805, 0.691, 0.971], body: [0.181, 0.026, 0.975, 0.864], wing_near: [0.112, 0.347, 0.631, 0.838] },
    carnivorous_plant: { arm_far: [0.241, 0.06, 0.544, 0.372], body: [0.103, 0.262, 0.744, 0.963], head: [0.388, 0.027, 0.812, 0.419], arm_near: [0.025, 0.456, 0.434, 0.822], head_attack: [0.438, 0.027, 0.744, 0.419] },
    banded_leaf_monkey: { tail: [0.05, 0.299, 0.319, 0.93], front_far: [0.5, 0.592, 0.678, 0.962], back_near: [0.2, 0.551, 0.516, 0.971], front_near: [0.45, 0.599, 0.647, 0.955], body: [0.194, 0.5, 0.762, 0.939], head: [0.294, 0.029, 0.972, 0.605], head_open: [0.294, 0.032, 0.972, 0.605] },
    bunian: { arm_far: [0.622, 0.457, 0.838, 0.642], lower: [0.034, 0.438, 0.912, 0.974], body: [0.028, 0.026, 0.972, 0.895], face: [0.7, 0.272, 0.856, 0.454], arm_near: [0.478, 0.505, 0.716, 0.748], face_attack: [0.716, 0.294, 0.859, 0.45] },
    clouded_leopard: { tail: [0.028, 0.135, 0.347, 0.661], back_far: [0.078, 0.72, 0.294, 0.927], front_far: [0.547, 0.637, 0.756, 0.969], back_near: [0.078, 0.505, 0.369, 0.927], front_near: [0.422, 0.567, 0.65, 0.924], body: [0.088, 0.405, 0.803, 0.893], head: [0.381, 0.028, 0.972, 0.599], head_open: [0.384, 0.031, 0.969, 0.606] },
    sambar_deer: { tail: [0.032, 0.481, 0.208, 0.688], back_far: [0.272, 0.85, 0.391, 0.962], front_far: [0.573, 0.8, 0.71, 0.975], back_near: [0.093, 0.522, 0.419, 0.95], front_near: [0.444, 0.684, 0.62, 0.969], body: [0.122, 0.494, 0.81, 0.897], head: [0.24, 0.028, 0.964, 0.634], head_open: [0.247, 0.031, 0.957, 0.634] },
    mud_crab: { legs_far: [0.028, 0.652, 0.312, 0.936], legs_near: [0.597, 0.656, 0.919, 0.929], body: [0.081, 0.326, 0.791, 0.805], claw_far: [0.178, 0.663, 0.497, 0.968], claw: [0.666, 0.057, 0.972, 0.741], claw_open: [0.666, 0.032, 0.972, 0.741] },
    kelong_crab: { legs_far: [0.028, 0.557, 0.334, 0.926], claw_far: [0.712, 0.533, 0.972, 0.939], legs_near: [0.538, 0.578, 0.828, 0.824], body: [0.05, 0.037, 0.947, 0.684], claw: [0.281, 0.619, 0.634, 0.963], claw_open: [0.281, 0.598, 0.65, 0.963] },
  };
  for (const [id, plan] of Object.entries(PLAN)) {
    const rig = CREATURE_RIGS[id];
    assert.ok(rig && rig.kind === 'species', `${id} is rigged`);
    assert.deepEqual(Object.keys(BOX[id]).sort(), [...rig.files].sort(), `${id} layers match the measured boxes`);
    const sizes = new Set(rig.files.map((n) => webpSize(readFileSync(fileURLToPath(new URL(`../assets/creatures/species/rig/${id}_${n}.webp`, import.meta.url)))).join('x')));
    assert.equal(sizes.size, 1, `${id} layers share one canvas`);
    const [w, h] = [...sizes][0].split('x').map(Number);
    assert.ok(Math.max(w, h) === 320 && Math.min(w, h) > 100, `${id} canvas is sized like the other species rigs`);
    for (const n of rig.order) {
      const [x0, y0, x1, y1] = BOX[id][n], [px, py] = rig.parts[n].piv;
      assert.ok(px >= x0 && px <= x1 && py >= y0 && py <= y1, `${id} ${n} joint sits inside the part`);
      const alt = rig.parts[n].alt;
      if (alt) { const [a0, b0, a1, b1] = BOX[id][alt]; assert.ok(px >= a0 && px <= a1 && py >= b0 && py <= b1, `${id} ${alt} turns about the same joint`); }
    }
    // The plan gives every moving part a motion (the body and the face swap stay still).
    for (const n of rig.order.filter((n) => !['body', 'face'].includes(n))) assert.ok(rig.parts[n].swing, `${id} ${n} moves (${plan})`);
    assert.equal(!!rig.body, plan === 'plant', `${id} sways as a whole only on the plant plan`);
  }
});

test('new-skills art pack: Diving, Construction, Hawkering and Archaeology wear their own pictures', async () => {
  const { itemIconSVG, skillIconSVG } = await import('../src/render/icons.js');
  const { ITEMS } = await import('../src/data/items.js');
  const { worldArt, townArt } = await import('../src/render/sprites.js');
  const { petArtSrc } = await import('../src/render/petsprite.js');
  for (const s of ['diving', 'construction', 'hawkering', 'archaeology']) {
    assert.match(skillIconSVG(s, 20), new RegExp(`assets/icons/skill-${s}\\.webp`), `${s} has its painted icon`);
    assert.equal(petArtSrc(`pet_${s}`), `assets/creatures/pets/pet_${s}.webp`, `pet_${s} has its own picture`);
  }
  // Every encrusted relic has a sticker of its own (not its restored one under a crust tint), as do the restored ones.
  const relics = Object.keys(ITEMS).filter((id) => id.startsWith('encrusted_'));
  assert.equal(relics.length, 36);
  for (const id of [...relics, ...relics.map((r) => r.slice('encrusted_'.length)), 'seashell', 'plank', 'brick', 'bronze_nails', 'teh_tarik', 'trowel', 'eternal_trowel']) {
    const html = itemIconSVG(id, 24);
    assert.ok(html.includes(`assets/icons/item-${id}.webp`) && !html.includes('filter:'), `${id} has its own untinted sticker`);
  }
  // Reefs, dig sites and the bench are painted; the stations no longer borrow (and tint) another object's picture.
  for (const [id, d] of Object.entries(OBJECTS).filter(([, d]) => ['dive', 'dig', 'restore'].includes(d.type))) assert.ok(worldArt().has(`obj-${id}`), `${id} (${d.type}) has its picture`);
  for (const id of ['sawmill', 'kiln', 'workbench', 'home_workbench', 'home_parlour', 'home_bed', 'home_altar', 'home_bank', 'home_portal', 'hawker_counter']) {
    assert.ok(worldArt().has(`obj-${id}`) && !OBJECTS[id].art && !OBJECTS[id].tint, `${id} wears its own picture`);
  }
  assert.ok(townArt().has('museum_curator'), 'Curator Siti has her picture');
});
