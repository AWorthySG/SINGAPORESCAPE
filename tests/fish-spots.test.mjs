// One fish to a spot (Nov 2026): every kind of fishing spot catches one
// species, every species comes from one kind of spot, and the kinds are spread
// over the world's regions (fishspots.js), so where you fish picks the fish.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { COOKING } from '../src/game/skilling.js';
import { TOOL_TIERS } from '../src/data/tooltiers.js';
import { xpForLevel } from '../src/data/xp.js';
import { FISH_SPOT_PLAN, MIXED_FISH_SPOTS } from '../src/data/fishspots.js';
import { fishSpotList, guideEntries } from '../src/game/skillguide.js';
import { worldArt, drawObjectSprite, fishLeap, fishCalm, CATCH_BADGE, CATCH_FISH, FISH_LEAP, FISH_LEAP_EVERY, FISH_FACING } from '../src/render/sprites.js';
import { itemArtSrc } from '../src/render/icons.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let _game = null;
function game() {
  if (_game) return _game;
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return (_game = g);
}

const SPOTS = Object.keys(OBJECTS).filter((id) => OBJECTS[id].type === 'fishing');
// Every fish the game has ever had a fishing spot for: the 40 the five old mixed
// spots caught between them (trout came from two) and the six endgame fish.
const FISH = ['raw_anchovy', 'raw_sardine', 'raw_mackerel', 'raw_trout', 'raw_salmon', 'raw_tilapia', 'raw_climbing_perch', 'raw_ikan_keli',
  'raw_marble_goby', 'raw_pike', 'raw_peacock_bass', 'raw_belida', 'raw_eel', 'raw_speckled_temensis', 'raw_giant_snakehead', 'raw_arapaima',
  'raw_arowana', 'raw_red_snapper', 'raw_milkfish', 'raw_barramundi', 'raw_mangrove_jack', 'raw_queenfish', 'raw_red_drum', 'raw_golden_snapper',
  'raw_threadfin', 'raw_white_pomfret', 'raw_tenggiri', 'raw_longfin_trevally', 'raw_coral_trout', 'raw_diamond_trevally', 'raw_cobia',
  'raw_hybrid_grouper', 'raw_giant_trevally', 'raw_lobster', 'raw_grouper', 'raw_tuna', 'raw_swordfish', 'raw_stingray', 'raw_shark',
  'raw_manta_ray', 'raw_dorado', 'raw_bluefin_tuna', 'raw_sailfish', 'raw_moonfish', 'raw_rift_eel', 'raw_dragon_arowana'];
const TOOLS = new Set(['net', 'rod', 'harpoon', 'lobster_pot']);

test('every spot kind catches one species, and every fish comes from exactly one kind of spot', () => {
  const from = new Map();
  for (const id of SPOTS) {
    const d = OBJECTS[id];
    assert.equal(d.catches.length, 1, `${id} catches one species`);
    const c = d.catches[0];
    assert.ok(ITEMS[c.id]?.tags.includes('raw') && COOKING[c.id], `${id}: ${c.id} is a raw fish that cooks`);
    assert.ok(TOOLS.has(d.tool), `${id} needs a real fishing tool (${d.tool})`);
    assert.ok(d.name && d.label && d.verb && d.examine, `${id} has a name, label, verb and examine text`);
    if (c.level > 1) assert.match(d.examine, new RegExp(`\\(Fishing ${c.level}\\)`), `${id}'s examine gives its level`);
    // A spot without a picture of its own borrows one of the old spots' pictures.
    assert.ok(worldArt().has(d.art || `obj-${id}`), `${id} has a picture`);
    assert.ok(!from.has(c.id), `${c.id} comes from ${from.get(c.id)} and ${id}`);
    from.set(c.id, id);
  }
  assert.deepEqual([...from.keys()].sort(), [...FISH].sort(), 'every fish has its one spot, and nothing else is caught');
  // The old ids keep their headline catch: saves, quests and contracts name them.
  for (const [id, fish] of [['fishing_spot', 'raw_anchovy'], ['rod_spot', 'raw_trout'], ['sea_rod_spot', 'raw_red_snapper'],
    ['fishing_cage', 'raw_lobster'], ['harpoon_spot', 'raw_tuna']]) assert.equal(from.get(fish), id, `${fish} from ${id}`);
});

test('every spot kind is placed at least five times, on shore water you can walk up to', () => {
  const g = game(), W = g.world;
  // Every tile you can walk to from Kampong Glam (four ways: a stricter walk than the game's).
  const seen = new Uint8Array(W.width * W.height), start = W.spawnPoint || { x: 58, y: 55 };
  const queue = [[start.x, start.y]];
  seen[start.y * W.width + start.x] = 1;
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!W.inBounds(nx, ny) || seen[ny * W.width + nx] || W.isBlocked(nx, ny)) continue;
      seen[ny * W.width + nx] = 1; queue.push([nx, ny]);
    }
  }
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const id of SPOTS) {
    const placed = W.objects.filter((o) => o.objId === id);
    assert.ok(placed.length >= 5, `${id}: ${placed.length} placed`);
    for (const o of placed) {
      assert.equal(W.terrainAt(o.x, o.y), 2, `${id} at ${o.x},${o.y} is on water`);
      assert.ok(N8.some(([dx, dy]) => W.inBounds(o.x + dx, o.y + dy) && seen[(o.y + dy) * W.width + o.x + dx]), `${id} at ${o.x},${o.y} can be reached`);
    }
  }
  // The old mixed spots outside the plan's regions are only the town pond's two.
  const planned = new Set(FISH_SPOT_PLAN.flatMap((p) => p.regions));
  const left = W.objects.filter((o) => MIXED_FISH_SPOTS.includes(o.objId) && !planned.has(W.zoneAt(o.x, o.y)?.name));
  assert.deepEqual(left.map((o) => o.objId).sort(), ['fishing_spot', 'rod_spot'], 'only the town pond is left as it was');
  // The plan names real regions and real spots, each spot once.
  const names = new Set(W.zones.map((z) => z.name)), kinds = FISH_SPOT_PLAN.flatMap((p) => p.spots);
  for (const r of planned) assert.ok(names.has(r), `${r} is a region`);
  for (const id of kinds) assert.equal(OBJECTS[id]?.type, 'fishing', `${id} is a fishing spot`);
  assert.equal(new Set(kinds).size, kinds.length, 'each spot kind in one place in the plan');
});

test('the species are spread out: each keeps to a region or two, and no region has them all', () => {
  const g = game(), W = g.world;
  const regionsOf = new Map(), kindsIn = new Map();
  for (const o of W.objects) {
    if (OBJECTS[o.objId]?.type !== 'fishing') continue;
    // (Regions the plan takes together, like MacRitchie and Bukit Timah, count as one place.)
    const zn = W.zoneAt(o.x, o.y)?.name, z = FISH_SPOT_PLAN.find((p) => p.regions.includes(zn))?.regions.join(' and ') || zn || 'town pond';
    if (!regionsOf.has(o.objId)) regionsOf.set(o.objId, new Set());
    regionsOf.get(o.objId).add(z);
    if (!kindsIn.has(z)) kindsIn.set(z, new Set());
    kindsIn.get(z).add(o.objId);
  }
  for (const [id, zs] of regionsOf) assert.ok(zs.size <= 2, `${id} is in ${[...zs].join(', ')}`);
  assert.ok(kindsIn.size >= 15, `fishing in ${kindsIn.size} regions`);
  for (const [z, ids] of kindsIn) assert.ok(ids.size <= 7, `${z} has ${ids.size} kinds of spot`);
  // Within a region, each kind keeps to its own stretch of shore rather than
  // being dotted among the others: the middles of neighbouring kinds' stretches
  // stand apart.
  for (const plan of FISH_SPOT_PLAN) {
    if (plan.spots.length < 2) continue;
    const pts = (id) => W.objects.filter((o) => o.objId === id && plan.regions.includes(W.zoneAt(o.x, o.y)?.name));
    const mid = (ps) => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length });
    const centres = plan.spots.map((id) => mid(pts(id)));
    for (let i = 1; i < centres.length; i++) {
      assert.ok(Math.hypot(centres[i].x - centres[i - 1].x, centres[i].y - centres[i - 1].y) > 3, `${plan.spots[i]} has its own stretch, apart from ${plan.spots[i - 1]}`);
    }
  }
});

// XP an hour at a spot, as a share: its fish's XP a cast, times the casts the
// best rod or harpoon for the level adds (the net and lobster pot have no tiers).
function spotRate(id, lvl) {
  const d = OBJECTS[id], speed = ['rod', 'harpoon'].includes(d.tool) ? TOOL_TIERS.filter((t) => t.level <= lvl).pop().speed : 0;
  return d.catches[0].xp * (1 + speed / 100);
}

test('the Fishing ladder: each spot out-earns every spot below it, at its own unlock level', () => {
  // Every cast catches and every spot casts at the same pace, so XP an hour
  // follows XP a cast times the tool's speed (big and trophy catches come at the
  // same rate everywhere at a level). NODE_XP_TUNE (objects.js) sets each spot.
  const lvl = (id) => OBJECTS[id].catches[0].level;
  for (const id of SPOTS) {
    const L = lvl(id);
    for (const below of SPOTS.filter((b) => lvl(b) < L)) {
      assert.ok(spotRate(id, L) > spotRate(below, L), `${id} (${Math.round(spotRate(id, L))}) beats ${below} (${Math.round(spotRate(below, L))}) at ${L}`);
    }
  }
});

test('the Fishing guide lists every spot kind with its fish, level, tool and regions, with Go and Map', () => {
  const g = game();
  const list = fishSpotList(g);
  assert.deepEqual(list.map((f) => f.objId).sort(), [...SPOTS].sort(), 'every spot kind is listed');
  for (const f of list) {
    const d = OBJECTS[f.objId];
    assert.equal(f.level, d.catches[0].level);
    assert.ok(f.regions.length >= 1 && f.count >= 5, `${f.objId} is somewhere`);
    assert.ok(f.text.includes(f.name) && f.text.includes(`level ${f.level}`) && f.text.includes(f.regions[0]), f.text);
  }
  for (let i = 1; i < list.length; i++) assert.ok(list[i].level >= list[i - 1].level, 'lowest first');
  assert.ok(list.find((f) => f.objId === 'salmon_spot').text.includes('Marina Bay'), 'salmon in Marina Bay');
  // The skill guide's own rows name the one spot each fish comes from.
  const rows = guideEntries('fishing');
  for (const fish of FISH) assert.equal(rows.filter((e) => e.source?.gives[0].id === fish).length, 1, `${fish}: one row`);
  // The window gives each kind Go and Map buttons, as it does the groves.
  const ui = readFileSync(new URL('../src/ui/skillguideui.js', import.meta.url), 'utf8');
  assert.match(ui, /fishSpotList\(game\)[\s\S]{0,400}data-go="\$\{esc\(f\.objId\)\}"[\s\S]{0,200}data-map="\$\{esc\(f\.objId\)\}"/);
});

test('quests that ask for fish send you to the one spot that has them', () => {
  const g = game();
  g.quests.island_provisions.state = 'active';
  g.skills.xp.fishing = xpForLevel(40);
  for (const id of ['raw_salmon', 'salmon']) g.inventory.remove(id, g.inventory.count(id));
  assert.equal(g.questGuide('island_provisions').objId, 'salmon_spot', 'salmon are netted at a salmon run');
});

test('every spot kind\'s fish has a sticker of its own, so spots sharing a picture tell apart', () => {
  for (const id of SPOTS) {
    for (const { id: fish } of OBJECTS[id].catches) {
      // Its own painted icon: never another fish's, recoloured (a borrowed sticker).
      assert.equal(itemArtSrc(fish), `assets/icons/item-${fish}.webp`, `${id}: ${fish} has its own sticker`);
      assert.ok(existsSync(new URL(`../assets/icons/item-${fish}.webp`, import.meta.url)), `${fish}'s sticker is on disk`);
    }
  }
  // The way each sticker faces (so it leaps head first) names only fish caught at spots.
  const caught = new Set(SPOTS.map((id) => OBJECTS[id].catches[0].id));
  for (const [fish, face] of Object.entries(FISH_FACING)) {
    assert.ok(caught.has(fish), `${fish} is caught at a spot`);
    assert.ok(['left', 'up'].includes(face), `${fish}: ${face}`);
  }
  for (const fish of ['arowana', 'barramundi', 'belida', 'cobia', 'giant_trevally', 'ikan_keli', 'milkfish', 'queenfish', 'threadfin']) {
    assert.equal(FISH_FACING[`raw_${fish}`], 'left', `${fish} has a left-facing head in its painted art`);
  }
});

test('a spot\'s fish lies half-sunk, then every 5-7 s leaps a short arc, the other way each time, on its own beat', () => {
  assert.ok(CATCH_FISH >= 20 && CATCH_FISH <= 24, 'about 22 px across');
  assert.ok(FISH_LEAP > 0 && FISH_LEAP <= 14, 'a short leap: it stays off the tile above, which draws first');
  assert.deepEqual(FISH_LEAP_EVERY, [5000, 7000]);
  // A stretch of shore: eight spots side by side, watched for a minute.
  const f = {}, xs = [120, 121, 122, 123, 124, 125, 126, 127], y = 64, firsts = [];
  for (const x of xs) {
    const leaps = [];
    let was = 1, top = -Infinity, resting = 0, n = 0;   // (a leap already under way at 0 is not counted)
    for (let t = 0; t < 60000; t += 10, n++) {
      fishLeap(x, y, t, false, f);
      if (f.dir && !was) leaps.push([t, f.dir]);
      was = f.dir;
      top = Math.max(top, f.lift);
      if (!f.dir && Math.abs(f.lift) <= 1) resting++;   // at the water line, half of it showing
    }
    firsts.push(leaps[0][0]);
    assert.ok(leaps.length >= 8 && leaps.length <= 12, `${x}: ${leaps.length} leaps a minute`);
    for (let k = 1; k < leaps.length; k++) {
      const gap = leaps[k][0] - leaps[k - 1][0];
      assert.ok(gap >= FISH_LEAP_EVERY[0] - 10 && gap <= FISH_LEAP_EVERY[1] + 10, `${x}: ${gap} ms between leaps`);
      assert.equal(leaps[k][1], -leaps[k - 1][1], `${x}: each leap heads the other way`);
    }
    assert.ok(top > FISH_LEAP * 0.95 && top <= FISH_LEAP, `${x}: it leaps ${top.toFixed(1)} px`);
    assert.ok(resting / n > 0.5, `${x}: it mostly lies in the water (${Math.round(resting / n * 100)}%)`);
  }
  // Each keeps its own beat: they start apart, and two neighbours are in the air
  // together about as often as chance has it, nowhere near in step.
  assert.ok(Math.max(...firsts) - Math.min(...firsts) > 2000, `first leaps at ${firsts.join(', ')} ms`);
  let both = 0, all = 0, samples = 0;
  for (let t = 0; t < 60000; t += 10) {
    const up = xs.map((x) => fishLeap(x, y, t, false, f).dir !== 0);
    for (let i = 1; i < up.length; i++) both += up[i] && up[i - 1] ? 1 : 0;
    all = Math.max(all, up.filter(Boolean).length);
    samples += up.length - 1;
  }
  assert.ok(both / samples < 0.05, `neighbours in the air together ${(both / samples * 100).toFixed(1)}% of the time`);
  assert.ok(all < xs.length, 'never the whole stretch at once');
  // While a school swirls at the spot, its fish rests.
  for (let t = 0; t < 30000; t += 10) {
    fishLeap(120, y, t, true, f);
    assert.ok(!f.dir && f.ring < 0 && Math.abs(f.lift) <= 1, `still at ${t} ms`);
  }
});

test('a school coming or going lets a leap under way finish and the next begin from rest: the fish never pops', () => {
  const x = 120, y = 64, f = {}, frame = 16;
  // Its first leap in the air, and when it began (ducking under) and ended (back up).
  let air = -1, start = -1, up = -1;
  for (let t = 0, was = 1; t < 20000; t += 1) {
    fishLeap(x, y, t, false, f);
    if (f.dir && !was && air < 0) air = t;
    was = f.dir;
  }
  for (let t = air; ; t--) { fishLeap(x, y, t, false, f); if (Math.abs(f.lift) <= 1 && !f.dir) { start = t + 1; break; } }
  for (let t = air; ; t++) { fishLeap(x, y, t, false, f); if (!f.dir && Math.abs(f.lift) <= 1 && t > air + 400) { up = t; break; } }
  const steps = (calmFor) => {   // the fish frame by frame, a school there while calmFor(t)
    const spot = { x, y }, out = [];
    for (let t = start - 2000; t < up + 8000; t += frame) {
      fishLeap(x, y, t, fishCalm(spot, calmFor(t), t), f);
      out.push({ t, ...f });
    }
    return out;
  };
  const seen = (s) => Math.max(s.lift, -CATCH_FISH / 2);   // (any lower is out of sight)
  const smooth = (run, what) => {
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1], b = run[i];
      assert.ok(Math.abs(seen(b) - seen(a)) < 4, `${what}: no jump at ${b.t} ms (${a.lift.toFixed(1)} to ${b.lift.toFixed(1)})`);
      if (seen(a) > -CATCH_FISH / 2 && seen(b) > -CATCH_FISH / 2) assert.ok(Math.abs(b.dx - a.dx) < 2, `${what}: no jump along at ${b.t} ms`);
    }
  };
  // Arriving with the fish in the air: it lands and comes back up, then rests.
  const mid = air + 200, arrive = steps((t) => t >= mid);
  smooth(arrive, 'arriving mid-leap');
  assert.ok(arrive.some((s) => s.t > mid && s.dir), 'the leap under way finishes');
  assert.ok(arrive.filter((s) => s.t > up + 100).every((s) => !s.dir && Math.abs(s.lift) <= 1), 'then it rests while the school stays');
  // Leaving at a moment its own beat has it in the air: it stays resting, and
  // only the next leap, begun from rest, is seen.
  const leave = steps((t) => t < mid);
  smooth(leave, 'leaving mid-leap');
  for (const s of leave.filter((s) => s.t >= start && s.t < up)) {
    assert.ok(!s.dir && Math.abs(s.lift) <= 1, `still resting at ${s.t} ms, after the school has gone`);
  }
  assert.ok(leave.some((s) => s.t > up && s.dir), 'its next leap comes in time');
  // A school there for a moment, mid-leap, changes nothing; and a plain true
  // keeps it resting whatever its beat.
  smooth(steps((t) => t >= air && t < air + 100), 'a passing school');
  fishLeap(x, y, mid, true, f);
  assert.ok(!f.dir && Math.abs(f.lift) <= 1);
  // Without a school, a spot has no calm and leaps as ever.
  assert.equal(fishCalm({}, null, 0), null);
});

test('the fish is drawn as one sticker over its spot; low graphics keeps the little badge', () => {
  const src = readFileSync(new URL('../src/render/sprites.js', import.meta.url), 'utf8');
  assert.match(src, /const id = !obj\.worldEvent && obj\.def\.catches\?\.\[0\]\?\.id;/, 'its one fish; not on a world event shoal');
  // The renderer passes the low-motion option and whether a school is at the spot.
  const rsrc = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  assert.match(rsrc, /const still = o\.def\.type === 'fishing' && \(calm \|\| fishCalm\(o, game\.fishSchools\?\.at\(o\), timeMs\)\);/);
  assert.equal(rsrc.match(/drawObjectSprite\(ctx, o, cx, cy, timeMs, !!game\.lowFx \|\| calm, still(?:, upper \? fade : 1)?\)/g)?.length, 2);
  // Draw it with every picture loaded, through a context that records its calls.
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 160; this.naturalHeight = 160; } };
  try {
    const calls = [];
    const ctx = new Proxy({ globalAlpha: 1 }, { get: (o, k) => (k in o ? o[k] : (...a) => calls.push([k, ...a])), set: (o, k, v) => ((o[k] = v), true) });
    const spot = { objId: 'golden_snapper_spot', def: OBJECTS.golden_snapper_spot, x: 120, y: 64 };
    const sticker = 'assets/icons/item-raw_golden_snapper.webp';
    const frame = (time, low, still) => {
      calls.length = 0;
      drawObjectSprite(ctx, spot, 100, 100, time, low, still);
      const base = calls.findIndex(([method, pic]) => method === 'drawImage' && pic.src === 'assets/world/obj-golden_snapper_spot.webp');
      assert.ok(base >= 0, 'the spot art is drawn');
      const fish = calls.filter((c) => c[0] === 'drawImage' && c[1].src === sticker);
      for (const pic of fish) assert.ok(calls.indexOf(pic) > base, 'the fish is drawn over the spot');
      return { fish, ellipses: calls.filter((c) => c[0] === 'ellipse').length, arcs: calls.filter((c) => c[0] === 'arc').length };
    };
    // Low graphics: the 15 px badge on its white disc.
    const low = frame(1000, true, false);
    assert.equal(low.fish.length, 1);
    assert.equal(low.fish[0][4], CATCH_BADGE, 'the badge');
    assert.equal(low.arcs, 1, 'on its disc');
    // Otherwise, a frame at a time for eight seconds: never more than one picture
    // of the fish and two rings; cut at the water line resting, whole in the air.
    let whole = 0, cut = 0;
    for (let t = 0; t < 8000; t += 16) {
      const fr = frame(t, false, false);
      assert.ok(fr.fish.length <= 1 && fr.ellipses <= 2 && fr.arcs === 0, `at ${t} ms: ${fr.fish.length} fish, ${fr.ellipses} rings`);
      const d = fr.fish[0];
      if (!d) continue;
      if (d.length === 6) { whole++; assert.equal(d[4], CATCH_FISH); }   // drawImage(img, x, y, w, h)
      else { cut++; assert.equal(d[8], CATCH_FISH); assert.ok(d[5] < 160 && d[9] < CATCH_FISH, 'only its top shows'); }
    }
    assert.ok(whole > 10 && cut > whole, `in the air for ${whole} frames, resting for ${cut}`);
    // While a school swirls there, it only rests; a world event's shoal shows no fish.
    for (let t = 0; t < 8000; t += 16) assert.ok(frame(t, false, true).fish.every((d) => d.length === 10), `resting at ${t} ms`);
    calls.length = 0;
    drawObjectSprite(ctx, { ...spot, worldEvent: true }, 100, 100, 0);
    assert.ok(!calls.some((c) => c[0] === 'drawImage' && c[1].src === sticker), 'no fish on an event shoal');
  } finally { delete globalThis.Image; }
});

test('every fishing spot has a picture of its own (FS4, FS5), and the crabs move their CR-1 repaints', async () => {
  // The Asian arowana pool was the last to borrow one (the freshwater rod's) until
  // it was redrawn as a wild jungle pool; any spot listed here may still borrow.
  const WAITING = {};
  const pics = new Map();
  for (const id of SPOTS) {
    const d = OBJECTS[id], key = d.art || `obj-${id}`;
    assert.equal(d.art, WAITING[id], `${id} ${WAITING[id] ? 'borrows ' + WAITING[id] : 'has no borrowed picture'}`);
    assert.ok(!d.tint && worldArt().has(key), `${id}: ${key} is registered`);
    const file = new URL(`../assets/world/${key}.webp`, import.meta.url);
    assert.ok(existsSync(file), `${key} is on disk`);
    if (!WAITING[id]) {
      const bytes = readFileSync(file).toString('base64');
      assert.ok(!pics.has(bytes), `${id} and ${pics.get(bytes)} share a painting`);
      pics.set(bytes, id);
    }
    if (key !== `obj-${id}`) assert.ok(!worldArt().has(`obj-${id}`), `${id} has no unused picture of its own`);
  }
  assert.ok(pics.size >= 45, `${pics.size} spots with pictures of their own`);
  assert.equal(OBJECTS.asian_arowana_spot.art, undefined, 'the Asian arowana pool has its own picture');
  assert.notEqual(readFileSync(new URL('../assets/world/obj-asian_arowana_spot.webp', import.meta.url)).toString('base64'),
    readFileSync(new URL('../assets/world/obj-arowana_pool.webp', import.meta.url)).toString('base64'), 'not the endgame Arowana pool\'s');
  // The mud crab's old parts were cut from the old green crab and retired; CRR-1 and
  // CRR-2 cut the repaints themselves into parts, so both crabs walk and snap again.
  const { CREATURE_RIGS } = await import('../src/render/creatureRigs.js');
  for (const c of ['mud_crab', 'kelong_crab']) {
    assert.ok(existsSync(new URL(`../assets/creatures/species/${c}.webp`, import.meta.url)), c);
    assert.ok(CREATURE_RIGS[c]?.parts.claw.swap && CREATURE_RIGS[c].parts.legs_near.swing, `${c} scuttles and snaps on its own parts`);
    for (const n of CREATURE_RIGS[c].files) assert.ok(existsSync(new URL(`../assets/creatures/species/rig/${c}_${n}.webp`, import.meta.url)), `${c}_${n}`);
  }
});
