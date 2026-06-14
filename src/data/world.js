// Procedural-but-deterministic world layout for Kampong Glam and its surrounds.
// Returns terrain + object/NPC placements. A fixed seed keeps the map stable
// across sessions so the world feels consistent.

export const TERRAIN = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  SAND: 3,
  STONE: 4,
  WOOD: 5,
  DARKGRASS: 6,
};

// Deterministic PRNG (mulberry32).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorld() {
  const W = 72, H = 64;
  const terrain = new Uint8Array(W * H);
  const idx = (x, y) => y * W + x;
  const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const set = (x, y, v) => { if (inBounds(x, y)) terrain[idx(x, y)] = v; };
  const get = (x, y) => (inBounds(x, y) ? terrain[idx(x, y)] : TERRAIN.GRASS);
  const rect = (x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v);
  };
  const rng = mulberry32(20260614);

  // --- Base grass, with subtle dark-grass variation for texture ---
  for (let i = 0; i < terrain.length; i++) terrain[i] = TERRAIN.GRASS;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (rng() < 0.06) set(x, y, TERRAIN.DARKGRASS);
    }
  }

  // --- Lake (west), irregular blob ---
  const lakeCx = 9, lakeCy = 26, lakeRx = 8, lakeRy = 15;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = ((x - lakeCx) / lakeRx) ** 2 + ((y - lakeCy) / lakeRy) ** 2;
      const noise = (rng() - 0.5) * 0.25;
      if (d + noise < 1) set(x, y, TERRAIN.WATER);
    }
  }
  // Sandy beach ring around the lake.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (get(x, y) !== TERRAIN.WATER) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (get(x + dx, y + dy) !== TERRAIN.WATER && get(x + dx, y + dy) !== TERRAIN.SAND)
          set(x + dx, y + dy, TERRAIN.SAND);
      }
    }
  }

  // --- Town plaza (centre) ---
  rect(30, 26, 45, 39, TERRAIN.STONE);

  // --- Paths radiating from town ---
  // West to the lake shore
  rect(18, 32, 30, 33, TERRAIN.PATH);
  // North to the forest
  rect(37, 14, 38, 26, TERRAIN.PATH);
  // East to the wilds
  rect(45, 32, 66, 33, TERRAIN.PATH);
  // Northeast spur to the mine
  rect(45, 24, 56, 25, TERRAIN.PATH);
  rect(55, 18, 56, 25, TERRAIN.PATH);

  const objects = [];
  const npcSpawns = [];
  const occupied = new Set();
  const key = (x, y) => `${x},${y}`;
  const isFree = (x, y) => inBounds(x, y) && !occupied.has(key(x, y));
  const placeObj = (objId, x, y) => {
    if (!isFree(x, y)) return false;
    objects.push({ objId, x, y });
    occupied.add(key(x, y));
    return true;
  };
  const placeNpc = (npcId, x, y, wander = 0) => {
    npcSpawns.push({ npcId, x, y, wander });
  };

  // Helper: scatter objects in a region on allowed terrain types.
  const scatter = (objId, x0, y0, x1, y1, count, allowed) => {
    let placed = 0, attempts = 0;
    while (placed < count && attempts < count * 40) {
      attempts++;
      const x = x0 + Math.floor(rng() * (x1 - x0 + 1));
      const y = y0 + Math.floor(rng() * (y1 - y0 + 1));
      if (!allowed.includes(get(x, y))) continue;
      if (placeObj(objId, x, y)) placed++;
    }
  };

  const GRASSY = [TERRAIN.GRASS, TERRAIN.DARKGRASS];

  // ---------------- Town features ----------------
  placeObj('bank_booth', 32, 28); placeObj('bank_booth', 33, 28); placeObj('bank_booth', 34, 28);
  placeNpc('banker', 33, 27);
  placeObj('sign', 37, 25);
  placeObj('furnace', 31, 36);
  placeObj('anvil', 33, 37);
  placeObj('range', 42, 36);
  placeNpc('hawker', 43, 37);
  placeNpc('shopkeeper', 44, 30);
  placeObj('flower', 44, 31); // a little colour by the shop
  placeNpc('guide', 38, 33);
  placeNpc('villager', 40, 34, 4);
  // Decorative lamps & flowers around the plaza edges.
  placeObj('lamp', 30, 26); placeObj('lamp', 45, 26); placeObj('lamp', 30, 39); placeObj('lamp', 45, 39);
  placeObj('flower', 36, 27); placeObj('flower', 41, 38); placeObj('bush', 31, 31); placeObj('bush', 44, 35);

  // ---------------- Forest (north) ----------------
  scatter('tree', 28, 3, 50, 16, 22, GRASSY);
  scatter('oak', 40, 3, 58, 14, 8, GRASSY);
  scatter('palm', 18, 2, 28, 12, 6, GRASSY);
  // Willows along the lake's eastern shore.
  scatter('willow', 14, 14, 20, 38, 5, GRASSY);

  // ---------------- Mine (northeast) ----------------
  rect(56, 16, 68, 28, TERRAIN.SAND); // rocky ground
  scatter('copper_rock', 57, 17, 67, 27, 6, [TERRAIN.SAND]);
  scatter('tin_rock', 57, 17, 67, 27, 6, [TERRAIN.SAND]);
  scatter('iron_rock', 58, 18, 67, 26, 4, [TERRAIN.SAND]);
  scatter('coal_rock', 60, 19, 67, 25, 3, [TERRAIN.SAND]);

  // ---------------- Fishing spots (lake's east shore) ----------------
  // Place on water tiles that have an adjacent walkable shore tile.
  let fishPlaced = 0;
  for (let y = 16; y < 38 && fishPlaced < 4; y++) {
    for (let x = 14; x < 20 && fishPlaced < 4; x++) {
      if (get(x, y) !== TERRAIN.WATER) continue;
      const shoreNear = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const tt = get(x + dx, y + dy);
        return tt === TERRAIN.SAND || tt === TERRAIN.GRASS || tt === TERRAIN.DARKGRASS;
      });
      if (shoreNear && rng() < 0.5 && isFree(x, y)) { placeObj('fishing_spot', x, y); fishPlaced++; }
    }
  }
  if (fishPlaced === 0) placeObj('fishing_spot', 15, 24); // safety

  // ---------------- Monster fields (east / south-east) ----------------
  // Chicken pen with a fence ring.
  for (let x = 46; x <= 52; x++) { placeObj('fence', x, 40); placeObj('fence', x, 46); }
  for (let y = 40; y <= 46; y++) { placeObj('fence', 46, y); placeObj('fence', 52, y); }
  occupied.delete(key(49, 46)); // gap for a gate
  for (let i = 0; i < 5; i++) placeNpc('chicken', 47 + (i % 4), 41 + (i % 4), 2);

  for (let i = 0; i < 5; i++) placeNpc('rat', 50 + Math.floor(rng() * 6), 50 + Math.floor(rng() * 6), 4);
  for (let i = 0; i < 5; i++) placeNpc('goblin', 56 + Math.floor(rng() * 6), 44 + Math.floor(rng() * 6), 5);
  for (let i = 0; i < 4; i++) placeNpc('macaque', 58 + Math.floor(rng() * 8), 52 + Math.floor(rng() * 8), 6);
  for (let i = 0; i < 3; i++) placeNpc('monitor_lizard', 62 + Math.floor(rng() * 6), 46 + Math.floor(rng() * 8), 5);
  // A couple of guards near the eastern town gate.
  placeNpc('guard', 46, 31, 3); placeNpc('guard', 46, 34, 3);

  // Border fence along the far edges for a sense of bounds.
  for (let x = 0; x < W; x++) { placeObj('fence', x, 0); placeObj('fence', x, H - 1); }
  for (let y = 0; y < H; y++) { placeObj('fence', 0, y); placeObj('fence', W - 1, y); }

  return {
    width: W,
    height: H,
    terrain,
    objects,
    npcSpawns,
    spawnPoint: { x: 38, y: 32 },
    respawnPoint: { x: 38, y: 32 },
    townName: 'Kampong Glam',
  };
}
