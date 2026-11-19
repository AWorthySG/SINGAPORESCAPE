// The bestiary expansion (src/data/bestiary.js): 67 new species in three forms
// and 20 new bosses, each fully wired in (race, drops, Codex, Slayer, world
// placement, borrowed art) without moving anything that was already there.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { BESTIARY_SPECIES, BESTIARY_BOSSES, ISLAND_BANDS } from '../src/data/bestiary.js';
import { NPCS, ALL_MONSTER_IDS, ALL_BOSS_IDS, BESTIARY_MONSTER_IDS, BESTIARY_BOSS_IDS, getNpc } from '../src/data/npcs.js';
import { buildWorld, MRT_CLEAR } from '../src/data/world.js';
import { STARTER } from '../src/data/bestiaryPlace.js';
import { STATIONS } from '../src/data/transport.js';
import { RACES, raceOf } from '../src/data/races.js';
import { getItem } from '../src/data/items.js';
import { BOSS_ABILITIES } from '../src/data/bossAbilities.js';
import { BOSS_MECHANICS, mechanicHowTo } from '../src/data/bossMechanics.js';
import { SIGNATURE_CLASS, sigIdFor } from '../src/data/bossWeapons.js';
import { SLAYER_TASKS } from '../src/data/slayer.js';
import { codexEntry, HAZARD_TEXT } from '../src/game/codex.js';
import { PAGES } from '../src/game/collection.js';
import { BOSS_PETS } from '../src/game/pets.js';
import { portraitFor, speciesArt, bossArt } from '../src/render/sprites.js';

const world = buildWorld();
const NEW = new Set([...BESTIARY_MONSTER_IDS, ...BESTIARY_BOSS_IDS]);
const zoneByName = (n) => world.zones.find((z) => z.name === n);
const bandOf = (zone) => { const z = zoneByName(zone); return z?.lo ? [z.lo, z.hi] : ISLAND_BANDS[zone]; };
const inZone = (z, s) => s.x >= z.x0 && s.x <= z.x1 && s.y >= z.y0 && s.y <= z.y1;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const artFile = (src) => fileURLToPath(new URL(`../${src}`, import.meta.url));
// The Codex shows a creature's details once you have beaten one.
const placedCount = () => world.npcSpawns.filter((s) => NEW.has(s.npcId)).length;
const seenGame = (id) => ({ kills: { [id]: 1 }, npcs: [], world: null });

test('about 200 new monsters (67 species in three forms) and 20 new bosses, all in the bestiary lists', () => {
  assert.equal(BESTIARY_SPECIES.length, 67);
  assert.equal(BESTIARY_MONSTER_IDS.length, 201);
  assert.equal(BESTIARY_BOSS_IDS.length, 20);
  for (const id of BESTIARY_MONSTER_IDS) assert.ok(ALL_MONSTER_IDS.includes(id) && !NPCS[id].boss, id);
  for (const id of BESTIARY_BOSS_IDS) assert.ok(ALL_BOSS_IDS.includes(id) && NPCS[id].boss, id);
  // Earlier monsters and bosses are all still there, with their own numbers.
  assert.equal(ALL_MONSTER_IDS.length - BESTIARY_MONSTER_IDS.length, 536);
  assert.equal(ALL_BOSS_IDS.length - BESTIARY_BOSS_IDS.length, 57);
  assert.equal(new Set(ALL_MONSTER_IDS).size, ALL_MONSTER_IDS.length, 'no monster id is used twice');
  for (const [id, level] of [['chicken', 1], ['elder_kancil', 16], ['goblin_warchief', 81], ['nian_beast', 194], ['buaya_putih', 227], ['jade_dragon', 9999]]) {
    assert.equal(getNpc(id).level, level, `${id} keeps its level`);
  }
  // New species are new: no family is shared with an older monster.
  const oldFamilies = new Set(ALL_MONSTER_IDS.filter((id) => !NEW.has(id)).map((id) => NPCS[id].family));
  for (const id of BESTIARY_MONSTER_IDS) assert.ok(!oldFamilies.has(NPCS[id].family), `${id} is a new species`);
});

test('every new monster has a race, drops, a real region, a level in its band and Codex text', () => {
  for (const id of BESTIARY_MONSTER_IDS) {
    const d = NPCS[id];
    assert.ok(d.family && RACES[raceOf(d, id)], `${id} has a family and race`);
    assert.ok(d.alwaysDrop.length && d.dropTable.length > 10, `${id} has drops`);
    for (const e of [...d.alwaysDrop, ...d.dropTable]) if (!e.nothing) assert.ok(getItem(e.id), `${id} drops a real item (${e.id})`);
    assert.ok(zoneByName(d.zone), `${id}'s region ${d.zone} exists`);
    const [lo, hi] = bandOf(d.zone);
    assert.ok(d.tierLevel >= lo && d.tierLevel <= hi, `${id} (${d.tierLevel}) fits ${d.zone}'s band ${lo}-${hi}`);
    const e = codexEntry(seenGame(id), id);
    assert.ok(e.examine.length > 50 && e.examine.includes(`(level ${d.level})`), `${id} has Codex text`);
    assert.ok(e.drops.length > 5, `${id} lists its drops in the Codex`);
  }
  // Every species turns up as a Slayer task.
  for (const b of BESTIARY_SPECIES) assert.ok(SLAYER_TASKS.some((t) => t.name === b.plural), `${b.name} is a Slayer task`);
});

test('every new monster and boss has a look: its own painted art, or a real picture recoloured', () => {
  const own = speciesArt(), ownBoss = bossArt();
  for (const id of NEW) {
    const p = portraitFor(id, NPCS[id]);
    assert.ok(p && existsSync(artFile(p.src)), `${id} has a picture that exists (${p?.src})`);
    const file = NPCS[id].boss ? (ownBoss.has(id) ? id : null) : (own.has(NPCS[id].family) ? NPCS[id].family : null);
    if (file) {
      // Its own art has arrived: drawn as itself, with no borrowed tint.
      assert.ok(p.src.endsWith(`/${file}.webp`), `${id} uses its own art (${p.src})`);
      assert.ok(!p.tint, `${id} is not recoloured`);
    } else assert.ok(typeof p.tint === 'string' && p.tint.length > 5, `${id} is recoloured`);
  }
  for (const b of BESTIARY_SPECIES) assert.ok(b.look.length > 60 && b.borrow, `${b.name} has an art brief`);
  for (const b of BESTIARY_BOSSES) assert.ok(b.look.length > 60 && b.borrow, `${b.id} has an art brief`);
});

test('every new boss has a signature move without stuns, a mechanic, a weapon, a collection page and a pet', () => {
  const kinds = {};
  for (const id of BESTIARY_BOSS_IDS) {
    const d = NPCS[id], a = BOSS_ABILITIES[id];
    assert.ok(a && d.ability === a, `${id} has its signature move`);
    assert.ok(a.fx.length && a.fx.every((f) => !['stun', 'root', 'knock'].includes(f.t)), `${id} never stuns, roots or knocks you back`);
    for (const f of a.fx) if (f.t === 'summon') assert.ok(NPCS[f.id]?.attackable, `${id} summons a real monster`);
    assert.ok(a.hazards.length && a.hazards.every((h) => HAZARD_TEXT[h]), `${id}'s ground attacks are known`);
    const m = BOSS_MECHANICS[id];
    assert.ok(m && mechanicHowTo(m).length > 40, `${id} has a mechanic`);
    if (m.type === 'adds') assert.ok(NPCS[m.id]?.attackable && !NPCS[m.id].boss, `${id}'s healers are monsters`);
    kinds[m.type] = (kinds[m.type] || 0) + 1;
    assert.ok(getItem(sigIdFor(id)) && SIGNATURE_CLASS[id], `${id} has a signature weapon`);
    assert.ok(PAGES.some((pg) => pg.npcId === id && pg.entries.length >= 3), `${id} has a collection page`);
    assert.ok(BOSS_PETS[id], `${id} has a pet`);
    const e = codexEntry(seenGame(id), id);
    assert.ok(e.mechanic && e.ability && e.signature && e.examine.length > 50, `${id} has a full Codex entry`);
    const [lo, hi] = bandOf(d.zone);
    assert.ok(d.tierLevel >= lo && d.tierLevel <= hi, `${id} (${d.tierLevel}) fits ${d.zone}'s band`);
    assert.ok(!d.aggressive, `${id} waits to be challenged, like every boss`);
  }
  assert.deepEqual(kinds, { shield: 5, circle: 5, adds: 5, cast: 5 }, 'the four mechanics are shared out evenly');
  // Mid and endgame both get new bosses.
  assert.ok(BESTIARY_BOSS_IDS.filter((id) => NPCS[id].tierLevel >= 150).length >= 6);
});

test('the world places every new monster in its own region, safely, and every new boss once', () => {
  const placed = world.npcSpawns.filter((s) => NEW.has(s.npcId));
  for (const id of BESTIARY_MONSTER_IDS) {
    const here = placed.filter((s) => s.npcId === id);
    assert.ok(here.length >= 3, `${id} is placed (${here.length})`);
    for (const s of here) assert.ok(inZone(zoneByName(NPCS[id].zone), s), `${id} stays in ${NPCS[id].zone}`);
  }
  for (const id of BESTIARY_BOSS_IDS) {
    const here = placed.filter((s) => s.npcId === id);
    assert.equal(here.length, 1, `${id} has one spawn`);
    assert.ok(inZone(zoneByName(NPCS[id].zone), here[0]), `${id} is in ${NPCS[id].zone}`);
  }
  const WZ = zoneByName('The Wilderness');
  const towns = world.zones.filter((z) => z.name === 'Kampong Glam' || z.name === 'Chinatown');
  for (const s of placed) {
    assert.ok(cheb(s, STARTER) > STARTER.ring, `${s.npcId} keeps out of the starter ring`);
    assert.ok(STATIONS.every((st) => cheb(s, st) >= MRT_CLEAR), `${s.npcId} keeps clear of the MRT`);
    assert.ok(!towns.some((z) => inZone(z, s)) && !world.towns.some(([a, b, c, d]) => s.x >= a && s.x <= c && s.y >= b && s.y <= d), `${s.npcId} is not in a town`);
    if (inZone(WZ, s) && NPCS[s.npcId].aggressive) assert.ok(s.x >= WZ.x0 + 8, `${s.npcId} can't reach across the Wilderness border`);
  }
  // No two spawns share a tile.
  assert.equal(new Set(world.npcSpawns.map((s) => `${s.x},${s.y}`)).size, world.npcSpawns.length);
});

test('nothing already in the world moved', () => {
  const old = world.npcSpawns.filter((s) => !NEW.has(s.npcId));
  // The new ones are placed after everything else (this count moves only when other content is added).
  assert.equal(old.length, 9516);
  // The new ones sit in one block near the end (only the fixed thieving marks follow).
  const first = world.npcSpawns.findIndex((s) => NEW.has(s.npcId));
  assert.ok(world.npcSpawns.slice(first, first + placedCount()).every((s) => NEW.has(s.npcId)));
  assert.deepEqual(old.slice(-2).map((s) => [s.npcId, s.x, s.y]), [['jade_merchant', 79, 56], ['jade_merchant', 88, 55]]);
  const at = (id) => world.npcSpawns.filter((s) => s.npcId === id).map((s) => [s.x, s.y]);
  assert.deepEqual(at('boar_king'), [[56, 17], [186, 94]]);
  assert.deepEqual(at('eternal_wyrm'), [[380, 226]]);
  assert.deepEqual(at('kelong_king_crab'), [[256, 81]]);
  assert.deepEqual(at('hantu_tinggi'), [[157, 124]]);
  assert.deepEqual(at('jade_dragon'), [[369, 333]]);
  assert.deepEqual(at('ubin_stone_frog'), [[202, 65]]);
  assert.deepEqual(old.slice(0, 3).map((s) => [s.npcId, s.x, s.y]), [['banker', 51, 47], ['hawker', 63, 59], ['shopkeeper', 64, 50]]);
});

test('the number of monsters near each region centre stays reasonable', () => {
  // Only NPCs within 48 tiles of the player update, so that is the window that matters.
  for (const z of world.zones) {
    const c = { x: (z.x0 + z.x1) >> 1, y: (z.y0 + z.y1) >> 1 };
    const near = world.npcSpawns.filter((s) => NPCS[s.npcId]?.attackable && cheb(s, c) <= 48);
    const before = near.filter((s) => !NEW.has(s.npcId)).length;
    assert.ok(near.length <= Math.max(10, before * 1.2), `${z.name}: ${before} -> ${near.length}`);
    assert.ok(near.length < 1000, `${z.name}: ${near.length} live monsters at most`);
  }
});
