// Procedural-but-deterministic overworld for SingaporeScape.
// One connected map split into named Singapore-themed zones (returned as `zones`
// for region detection) plus a dangerous Wilderness. A fixed seed keeps it stable.

import { NPCS, MONSTER_IDS, BOSS_IDS } from './npcs.js';

export const TERRAIN = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  SAND: 3,
  STONE: 4,
  WOOD: 5,
  DARKGRASS: 6,
};

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
  const W = 150, H = 104;
  const T = TERRAIN;
  const terrain = new Uint8Array(W * H);
  const idx = (x, y) => y * W + x;
  const inB = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const set = (x, y, v) => { if (inB(x, y)) terrain[idx(x, y)] = v; };
  const get = (x, y) => (inB(x, y) ? terrain[idx(x, y)] : T.WATER);
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const rng = mulberry32(20260614);

  // --- Base terrain; the Wilderness (east) is dark, blasted grass ---
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let base = T.GRASS;
    if (x >= 95) base = rng() < 0.7 ? T.DARKGRASS : T.GRASS;
    else if (rng() < 0.06) base = T.DARKGRASS;
    set(x, y, base);
  }

  // --- MacRitchie Reservoir (west) ---
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = ((x - 19) / 16) ** 2 + ((y - 54) / 24) ** 2;
    if (d + (rng() - 0.5) * 0.22 < 1) set(x, y, T.WATER);
  }
  // --- Southern sea (Sentosa) ---
  rect(26, 98, 104, 103, T.WATER);
  rect(30, 95, 100, 97, T.SAND);
  // --- Pulau Hantu (haunted island, deep east) inland lagoon ---
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = ((x - 138) / 9) ** 2 + ((y - 30) / 11) ** 2;
    if (d + (rng() - 0.5) * 0.2 < 1) set(x, y, T.WATER);
  }

  // --- Sandy beach ring around all water ---
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) !== T.WATER) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = get(x + dx, y + dy);
      if (t !== T.WATER && t !== T.SAND) set(x + dx, y + dy, T.SAND);
    }
  }

  // --- Floors ---
  rect(46, 46, 70, 64, T.STONE);   // Kampong Glam plaza
  rect(75, 47, 92, 64, T.STONE);   // Chinatown market
  rect(66, 8, 86, 24, T.SAND);     // Bukit Timah mine hill
  rect(124, 46, 136, 60, T.STONE); // Pulau Hantu ruined plaza

  // --- Paths ---
  rect(57, 20, 58, 46, T.PATH);
  rect(38, 54, 46, 55, T.PATH);
  rect(70, 54, 75, 55, T.PATH);
  rect(57, 64, 58, 95, T.PATH);
  rect(57, 20, 76, 21, T.PATH);
  rect(92, 40, 96, 41, T.PATH);
  rect(110, 52, 124, 53, T.PATH);  // causeway into Pulau Hantu

  const objects = [];
  const npcSpawns = [];
  const occupied = new Set();
  const key = (x, y) => `${x},${y}`;
  const isFree = (x, y) => inB(x, y) && !occupied.has(key(x, y));
  const placeObj = (objId, x, y, extra) => {
    if (!isFree(x, y)) return false;
    objects.push(extra ? { objId, x, y, ...extra } : { objId, x, y });
    occupied.add(key(x, y));
    return true;
  };
  const placeNpc = (npcId, x, y, wander = 0, opts = null) => { npcSpawns.push(opts ? { npcId, x, y, wander, opts } : { npcId, x, y, wander }); };
  const scatter = (objId, x0, y0, x1, y1, count, allowed) => {
    let placed = 0, attempts = 0;
    while (placed < count && attempts < count * 50) {
      attempts++;
      const x = x0 + Math.floor(rng() * (x1 - x0 + 1));
      const y = y0 + Math.floor(rng() * (y1 - y0 + 1));
      if (!allowed.includes(get(x, y))) continue;
      if (placeObj(objId, x, y)) placed++;
    }
  };
  const placeFishing = (objId, x0, y0, x1, y1, count) => {
    let n = 0, att = 0;
    while (n < count && att < count * 80) {
      att++;
      const x = x0 + Math.floor(rng() * (x1 - x0 + 1)), y = y0 + Math.floor(rng() * (y1 - y0 + 1));
      if (get(x, y) !== T.WATER) continue;
      const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inB(x + dx, y + dy) && get(x + dx, y + dy) !== T.WATER);
      if (shore && placeObj(objId, x, y)) n++;
    }
  };
  const GRASSY = [T.GRASS, T.DARKGRASS];

  // Region rectangles (checked in order; first match wins).
  const zones = [
    { name: 'Pulau Hantu', x0: 120, y0: 0, x1: 149, y1: 103, wilderness: true },
    { name: 'The Wilderness', x0: 95, y0: 0, x1: 119, y1: 103, wilderness: true },
    { name: 'Kampong Glam', x0: 44, y0: 44, x1: 72, y1: 66 },
    { name: 'Chinatown', x0: 73, y0: 44, x1: 94, y1: 70 },
    { name: 'MacRitchie Reservoir', x0: 0, y0: 44, x1: 43, y1: 82 },
    { name: 'Sentosa Beach', x0: 0, y0: 83, x1: 94, y1: 103 },
    { name: 'Bukit Timah', x0: 0, y0: 0, x1: 94, y1: 43 },
  ];

  // ================= Kampong Glam (town) =================
  placeObj('bank_booth', 50, 48); placeObj('bank_booth', 51, 48); placeObj('bank_booth', 52, 48);
  placeNpc('banker', 51, 47);
  placeObj('shrine', 58, 50);
  placeObj('sign', 56, 46, { sign: 'Kampong Glam' });
  placeObj('furnace', 48, 58); placeObj('anvil', 50, 59); placeObj('range', 62, 58);
  placeObj('crafting_table', 52, 59); // pottery & jewelry
  placeNpc('hawker', 63, 59);
  placeNpc('shopkeeper', 64, 50);
  placeNpc('fletcher', 66, 51);
  placeNpc('slayer_master', 54, 58);
  placeNpc('guide', 56, 53);
  placeNpc('skills_tutor', 58, 53);
  placeNpc('light_priestess', 60, 49); // by the Monument — the path of redemption
  placeNpc('shadow_broker', 48, 47);   // lurking near the bank — the path of corruption
  placeNpc('villager', 60, 54, 3);
  placeObj('lamp', 46, 46); placeObj('lamp', 70, 46); placeObj('lamp', 46, 64); placeObj('lamp', 70, 64);
  placeObj('flower', 54, 47); placeObj('flower', 62, 47); placeObj('bush', 48, 51); placeObj('bush', 68, 60);
  placeObj('agility_course', 66, 62); // beginner Agility spot in town
  // A small obstacle loop in the south of town (train a full lap for a bonus).
  placeObj('agility_balance', 46, 61);
  placeObj('agility_net', 48, 61);
  placeObj('agility_rope', 50, 61);
  placeObj('agility_ledge', 50, 63);
  placeObj('agility_zip', 47, 63);
  // A hawker stall to practise Thieving in the kampung.
  placeObj('stall_food', 64, 62);

  // ================= MRT fast-travel network =================
  placeObj('mrt_station', 68, 52); // Kampong Glam
  placeObj('mrt_station', 76, 52); // Chinatown
  placeObj('mrt_station', 64, 18); // Bukit Timah
  placeObj('mrt_station', 42, 52); // MacRitchie
  placeObj('mrt_station', 58, 92); // Sentosa Beach

  // ================= Bukit Timah (forest + mine) =================
  scatter('tree', 30, 4, 92, 40, 30, GRASSY);
  scatter('oak', 40, 4, 88, 34, 14, GRASSY);
  scatter('rain_tree', 50, 4, 88, 24, 6, GRASSY);
  scatter('yew_tree', 40, 6, 86, 26, 5, GRASSY);
  scatter('magic_tree', 50, 6, 82, 22, 3, GRASSY);
  scatter('willow', 32, 30, 42, 46, 6, GRASSY);
  // More tree species across Bukit Timah / MacRitchie
  scatter('bamboo', 32, 28, 48, 50, 10, GRASSY);
  scatter('angsana', 40, 6, 88, 34, 9, GRASSY);
  scatter('teak', 44, 6, 86, 30, 7, GRASSY);
  scatter('mangrove', 30, 54, 44, 80, 7, GRASSY);
  scatter('mahogany', 48, 6, 84, 26, 5, GRASSY);
  scatter('tembusu', 50, 6, 82, 22, 4, GRASSY);
  scatter('copper_rock', 67, 9, 85, 23, 6, [T.SAND]);
  scatter('tin_rock', 67, 9, 85, 23, 6, [T.SAND]);
  scatter('iron_rock', 68, 10, 84, 22, 5, [T.SAND]);
  scatter('coal_rock', 70, 11, 84, 21, 4, [T.SAND]);
  scatter('gold_rock', 70, 11, 84, 21, 4, [T.SAND]);
  scatter('mithril_rock', 74, 12, 84, 20, 3, [T.SAND]);
  scatter('adamantite_rock', 78, 13, 84, 19, 2, [T.SAND]);
  // More mining materials
  scatter('clay_rock', 66, 9, 85, 24, 6, [T.SAND]);
  scatter('limestone_rock', 66, 9, 85, 24, 5, [T.SAND]);
  scatter('silver_rock', 67, 10, 85, 23, 5, [T.SAND]);
  scatter('sandstone_rock', 68, 10, 84, 22, 4, [T.SAND]);
  scatter('gem_rock', 72, 11, 84, 20, 3, [T.SAND]);
  scatter('granite_rock', 70, 11, 84, 21, 4, [T.SAND]);
  placeObj('sign', 57, 44, { sign: 'Bukit Timah \u2191' });
  // Chicken pen + a few easy early monsters near the path
  for (let x = 34; x <= 40; x++) { placeObj('fence', x, 28); placeObj('fence', x, 34); }
  for (let y = 28; y <= 34; y++) { placeObj('fence', 34, y); placeObj('fence', 40, y); }
  occupied.delete(key(37, 34));
  // Gentle starter monsters near town: never aggressive and weaker than normal,
  // so brand-new adventurers can learn to fight without being ambushed.
  const TAME = { aggressive: false, statMul: 0.6 };
  for (let i = 0; i < 5; i++) placeNpc('chicken', 35 + (i % 5), 29 + (i % 4), 2, TAME);
  for (let i = 0; i < 3; i++) placeNpc('rat', 44 + i * 2, 38, 3, TAME);
  for (let i = 0; i < 3; i++) placeNpc('goblin', 50 + i * 2, 36, 4, TAME);

  // ================= MacRitchie Reservoir =================
  placeFishing('fishing_spot', 30, 30, 40, 78, 9);   // net (small fish)
  placeFishing('rod_spot', 30, 30, 40, 78, 7);        // rod (freshwater: trout/pike/eel)
  placeFishing('harpoon_spot', 30, 56, 40, 78, 5);    // harpoon (deep reservoir)
  placeObj('sign', 40, 56, { sign: 'MacRitchie \u2190' });

  // ================= Chinatown =================
  placeObj('bank_booth', 88, 48); placeObj('bank_booth', 89, 48);
  placeNpc('shopkeeper', 78, 50);
  placeNpc('hawker', 84, 60);
  placeNpc('mage', 88, 52);
  placeNpc('fletcher', 80, 52);
  placeObj('range', 82, 58);
  placeObj('hyco_obelisk', 83, 52); // Hyco Education landmark
  placeNpc('villager', 80, 56, 4); placeNpc('villager', 86, 54, 4);
  placeObj('lamp', 75, 47); placeObj('lamp', 92, 47); placeObj('lamp', 75, 64); placeObj('lamp', 92, 64);
  placeObj('sign', 83, 47, { sign: 'Chinatown' }); placeObj('flower', 80, 63); placeObj('flower', 88, 63);
  // Chinatown bazaar: a row of Thieving stalls of rising value.
  placeObj('stall_food', 85, 62);
  placeObj('stall_market', 86, 50);
  placeObj('stall_gem', 90, 50);

  // ================= Sentosa Beach =================
  scatter('palm', 34, 84, 98, 96, 12, [T.SAND, T.GRASS, T.DARKGRASS]);
  placeFishing('fishing_cage', 30, 97, 100, 102, 8);   // cage (lobster/grouper)
  placeFishing('harpoon_spot', 34, 97, 100, 102, 6);   // sea harpoon (swordfish/stingray/manta)
  placeFishing('fishing_spot', 30, 96, 100, 102, 4);   // beach net spots
  placeFishing('sea_rod_spot', 30, 96, 100, 102, 8);   // coastal rod (snapper/trevally/barramundi…)
  placeObj('sign', 57, 90, { sign: 'Sentosa Beach \u2193' });

  // ================= The Wilderness =================
  scatter('ruin', 96, 6, 117, 96, 16, GRASSY);
  scatter('wall', 96, 6, 117, 96, 10, GRASSY);
  placeObj('sign', 94, 40, { sign: '\u26A0 Wilderness \u2192' });
  scatter('mithril_rock', 98, 8, 110, 90, 4, GRASSY);
  scatter('adamantite_rock', 106, 8, 116, 90, 3, GRASSY);
  scatter('runite_rock', 110, 8, 117, 90, 2, GRASSY);

  // ================= Pulau Hantu (haunted island) =================
  scatter('ruin', 121, 4, 148, 99, 22, GRASSY);
  scatter('wall', 124, 44, 136, 60, 8, [T.STONE]);
  placeObj('sign', 122, 53, { sign: 'Pulau Hantu' });
  placeObj('lamp', 125, 47); placeObj('lamp', 135, 47); placeObj('lamp', 125, 59); placeObj('lamp', 135, 59);
  scatter('magic_tree', 121, 60, 148, 99, 5, GRASSY);
  scatter('yew_tree', 121, 60, 148, 99, 6, GRASSY);
  scatter('runite_rock', 138, 60, 148, 95, 3, GRASSY);
  scatter('adamantite_rock', 121, 62, 135, 95, 4, GRASSY);
  placeFishing('harpoon_spot', 128, 22, 148, 40, 6);
  placeFishing('fishing_cage', 128, 22, 148, 40, 4);
  placeFishing('sea_rod_spot', 128, 22, 148, 40, 6);

  // ================= Populate the bestiary by zone =================
  const zoneByName = (name) => zones.find((z) => z.name === name);
  const LANDABLE = [T.GRASS, T.DARKGRASS, T.SAND];
  const inTown = (x, y) => x >= 44 && x <= 72 && y >= 44 && y <= 66;
  const placeMobIn = (id, wander) => {
    const def = NPCS[id];
    const z = zoneByName(def.zone) || zoneByName('Bukit Timah');
    for (let att = 0; att < 90; att++) {
      const x = z.x0 + Math.floor(rng() * (z.x1 - z.x0 + 1));
      const y = z.y0 + Math.floor(rng() * (z.y1 - z.y0 + 1));
      if (inTown(x, y) || !LANDABLE.includes(get(x, y))) continue;
      // Bosses that randomly land near the starting town shouldn't ambush newcomers.
      const opts = (def.boss && Math.max(Math.abs(x - 58), Math.abs(y - 55)) <= 22) ? { aggressive: false } : null;
      placeNpc(id, x, y, wander, opts);
      return;
    }
    placeNpc(id, Math.round((z.x0 + z.x1) / 2), Math.round((z.y0 + z.y1) / 2), wander);
  };
  for (const id of MONSTER_IDS) placeMobIn(id, 4);
  for (const id of BOSS_IDS) { if (NPCS[id].fixed) continue; placeMobIn(id, 3); }
  // Alignment-arc bosses at fixed, thematic spots.
  placeNpc('lion_of_light', 52, 56, 0, { aggressive: false }); // radiant guardian by the town temple (never aggressive)
  placeNpc('shadow_sovereign', 108, 50, 2);                    // dark sovereign deep in the Wilderness

  // --- Border fence ---
  for (let x = 0; x < W; x++) { placeObj('fence', x, 0); placeObj('fence', x, H - 1); }
  for (let y = 0; y < H; y++) { placeObj('fence', 0, y); placeObj('fence', W - 1, y); }

  return {
    width: W,
    height: H,
    terrain,
    objects,
    npcSpawns,
    zones,
    spawnPoint: { x: 58, y: 55 },
    respawnPoint: { x: 58, y: 55 },
    townName: 'Kampong Glam',
  };
}
