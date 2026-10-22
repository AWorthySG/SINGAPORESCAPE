// Procedural-but-deterministic overworld for SingaporeScape.
// One connected map split into named Singapore-themed zones (returned as `zones`
// for region detection) plus a dangerous Wilderness. A fixed seed keeps it stable.

import { NPCS, MONSTER_IDS, BOSS_IDS } from './npcs.js';

// How many of each monster kind populate the world.
export const MONSTER_COPIES = 5;
// Copies of each fitting monster kind placed in each open-world region.
export const REGION_COPIES = 3;

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
  // The original island (x 0-149, y 0-103) keeps its coordinates; the open world
  // extends south across a strait and east across a channel to six new regions.
  const W = 400, H = 280;
  const T = TERRAIN;
  const terrain = new Uint8Array(W * H);
  const idx = (x, y) => y * W + x;
  const inB = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const set = (x, y, v) => { if (inB(x, y)) terrain[idx(x, y)] = v; };
  const get = (x, y) => (inB(x, y) ? terrain[idx(x, y)] : T.WATER);
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const rng = mulberry32(20260614);
  // The open world uses its own random stream, so the original island (x < 150,
  // y < 104) is generated exactly as before: same trees, rocks and spawns.
  const rng2 = mulberry32(20261022);
  let R = rng;   // the stream used by scatter / fishing / spawn helpers
  const OLD_W = 150, OLD_H = 104;

  // --- Base terrain; the Wilderness (east) is dark, blasted grass ---
  for (let y = 0; y < OLD_H; y++) for (let x = 0; x < OLD_W; x++) {
    let base = T.GRASS;
    if (x >= 95) base = rng() < 0.7 ? T.DARKGRASS : T.GRASS;   // the Wilderness
    else if (rng() < 0.06) base = T.DARKGRASS;
    set(x, y, base);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < OLD_W && y < OLD_H) continue;
    let base = T.GRASS;
    if (x >= 200 && y >= 204) base = rng2() < 0.88 ? T.DARKGRASS : T.GRASS;            // the Shadow Rift
    else if (x >= 225 && y >= 100) base = rng2() < 0.75 ? T.DARKGRASS : T.GRASS;       // Tekong Badlands
    else if (x >= 75 && x < 159 && y >= 113) base = rng2() < 0.3 ? T.DARKGRASS : T.GRASS; // Jurong Forest
    else if (rng2() < 0.06) base = T.DARKGRASS;
    set(x, y, base);
  }

  // --- MacRitchie Reservoir (west) ---
  for (let y = 0; y < OLD_H; y++) for (let x = 0; x < OLD_W; x++) {
    const d = ((x - 19) / 16) ** 2 + ((y - 54) / 24) ** 2;
    if (d + (rng() - 0.5) * 0.22 < 1) set(x, y, T.WATER);
  }
  // --- Southern sea (Sentosa) ---
  rect(26, 98, 104, 103, T.WATER);
  rect(30, 95, 100, 97, T.SAND);
  // --- Pulau Hantu (haunted island, deep east) inland lagoon ---
  for (let y = 0; y < OLD_H; y++) for (let x = 0; x < OLD_W; x++) {
    const d = ((x - 138) / 9) ** 2 + ((y - 30) / 11) ** 2;
    if (d + (rng() - 0.5) * 0.2 < 1) set(x, y, T.WATER);
  }

  // --- The open world beyond the island ---
  rect(0, 101, 158, 112, T.WATER);   // the southern strait (crossed by the Sentosa bridge)
  rect(150, 0, 158, 112, T.WATER);   // the eastern channel past Pulau Hantu
  rect(291, 0, 299, 203, T.WATER);   // the channel off Changi and Tekong
  rect(0, 196, 399, 203, T.WATER);   // the south channel
  rect(392, 0, 399, 279, T.WATER);   // the far east sea
  rect(0, 272, 399, 279, T.WATER);   // the far south sea
  // The Southern Islands: open sea dotted with islands.
  rect(0, 204, 199, 271, T.WATER);
  const island = (cx, cy, rx, ry) => { for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (rng2() - 0.5) * 0.25 < 1) set(x, y, rng2() < 0.12 ? T.DARKGRASS : T.GRASS); } };
  island(40, 236, 17, 11);    // Kusu Island
  island(96, 240, 23, 15);    // St John's Island
  island(150, 232, 19, 13);   // Lazarus Island
  island(168, 258, 12, 8);    // the Sisters' Islands
  island(58, 260, 17, 8);     // Pulau Semakau
  // Sungei Buloh: winding tidal rivers and mangrove ponds.
  for (let y = 113; y < 196; y++) {
    const r1 = Math.round(18 + Math.sin(y / 9) * 7), r2 = Math.round(52 + Math.sin(y / 13 + 2) * 9);
    for (let dx = -1; dx <= 1; dx++) { set(r1 + dx, y, T.WATER); set(r2 + dx, y, T.WATER); }
  }
  const pond = (cx, cy, rx, ry) => { for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (rng2() - 0.5) * 0.2 < 1) set(x, y, T.WATER); } };
  pond(34, 140, 6, 4); pond(36, 178, 7, 5); pond(64, 125, 4, 3);
  pond(194, 178, 15, 9);   // Marina Bay
  pond(178, 72, 6, 5);     // Pulau Ubin's quarry lake
  pond(248, 140, 5, 4); pond(272, 176, 6, 4);   // Tekong's black pools
  pond(328, 36, 11, 7); pond(368, 72, 9, 6);    // Gardens by the Bay lakes
  pond(344, 160, 6, 5);                         // a Coney Island pond
  pond(230, 250, 8, 5); pond(330, 230, 10, 6); pond(370, 258, 7, 4);   // the Rift's dark pools

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
  // Roads across the open world. Where a road meets water it becomes a wooden bridge.
  const road = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, get(x, y) === T.WATER ? T.WOOD : T.PATH); };
  road(57, 95, 58, 150);     // the Sentosa bridge south over the strait
  road(8, 150, 236, 151);    // the great south road: Sungei Buloh - Jurong - Marina Bay
  road(190, 8, 191, 150);    // north through Marina Bay into Pulau Ubin
  road(159, 50, 286, 51);    // Pulau Ubin - Changi
  road(262, 51, 263, 150);   // Changi down into the Tekong Badlands
  road(236, 150, 262, 151);
  road(286, 50, 341, 51);     // Changi over the channel into Gardens by the Bay
  road(340, 51, 341, 151);    // south through the Gardens to Coney Island
  road(262, 150, 341, 151);   // Tekong over the channel to Coney Island
  road(262, 151, 263, 262);   // Tekong over the south channel into the Shadow Rift
  road(190, 150, 191, 241);   // Marina Bay over the south channel to the islands
  road(24, 240, 380, 241);    // the island bridges, on east through the Rift
  road(58, 241, 59, 260);     // a bridge down to Pulau Semakau
  road(168, 241, 169, 258);   // and to the Sisters' Islands
  rect(250, 208, 274, 222, T.STONE);   // the Rift Outpost
  rect(382, 100, 391, 195, T.SAND);    // Coney Island's east beach
  rect(300, 2, 391, 4, T.SAND);
  // Floors for the new towns and the big quarries.
  rect(178, 128, 206, 147, T.STONE);   // Marina Bay plaza
  rect(182, 40, 198, 49, T.STONE);     // Pulau Ubin kampong square
  rect(200, 8, 222, 28, T.SAND);       // Ubin granite quarry
  rect(108, 160, 142, 188, T.SAND);    // Jurong quarry
  rect(268, 4, 289, 98, T.SAND);       // Changi beach

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
      const x = x0 + Math.floor(R() * (x1 - x0 + 1));
      const y = y0 + Math.floor(R() * (y1 - y0 + 1));
      if (!allowed.includes(get(x, y))) continue;
      if (placeObj(objId, x, y)) placed++;
    }
  };
  const placeFishing = (objId, x0, y0, x1, y1, count) => {
    let n = 0, att = 0;
    while (n < count && att < count * 80) {
      att++;
      const x = x0 + Math.floor(R() * (x1 - x0 + 1)), y = y0 + Math.floor(R() * (y1 - y0 + 1));
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
    // The open world
    { name: 'Sungei Buloh Wetlands', x0: 0, y0: 113, x1: 74, y1: 199, lo: 10, hi: 60 },
    { name: 'Jurong Forest', x0: 75, y0: 113, x1: 158, y1: 199, lo: 20, hi: 75 },
    { name: 'Pulau Ubin', x0: 159, y0: 0, x1: 229, y1: 99, lo: 5, hi: 45 },
    { name: 'Changi Coast', x0: 230, y0: 0, x1: 299, y1: 99, lo: 10, hi: 70 },
    { name: 'Marina Bay', x0: 159, y0: 100, x1: 229, y1: 199, lo: 15, hi: 60 },
    { name: 'Tekong Badlands', x0: 230, y0: 100, x1: 299, y1: 199, lo: 70, hi: 160 },
    { name: 'Gardens by the Bay', x0: 300, y0: 0, x1: 399, y1: 99, lo: 60, hi: 120 },
    { name: 'Coney Island', x0: 300, y0: 100, x1: 399, y1: 203, lo: 90, hi: 150 },
    { name: 'Southern Islands', x0: 0, y0: 204, x1: 199, y1: 279, lo: 120, hi: 215 },
    { name: 'The Shadow Rift', x0: 200, y0: 204, x1: 399, y1: 279, lo: 200, hi: 320 },
  ];

  // ================= Kampong Glam (town) =================
  placeObj('bank_booth', 50, 48); placeObj('bank_booth', 51, 48); placeObj('bank_booth', 52, 48);
  placeNpc('banker', 51, 47);
  placeObj('shrine', 58, 50);
  placeObj('mascot_statue', 54, 50); // A-Worthy mascot statue, facing the Monument across the plaza
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
  // A few little chickens right at spawn: harmless and killable. They waddle
  // about clucking, but never attack.
  const CHATTY_CHICKEN = { statMul: 0.5, aggressive: false, chatter: ['Cluck cluck!', 'Bawk bawk!', 'Cluck!'] };
  placeNpc('chicken', 59, 57, 3, CHATTY_CHICKEN);
  placeNpc('chicken', 61, 58, 3, CHATTY_CHICKEN);
  placeNpc('chicken', 58, 60, 3, CHATTY_CHICKEN);
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
  // A garden border round the plaza: flower beds with a bush every third tile,
  // leaving the four path entrances open, and palms framing the corners.
  for (const [px, py] of [[48, 48], [68, 48], [68, 63], [52, 63]]) placeObj('palm', px, py);
  {
    const entrance = (x, y) => (y === 46 || y === 64 ? x === 57 || x === 58 : y === 54 || y === 55);
    const border = [];
    for (let x = 47; x <= 69; x++) border.push([x, 46], [x, 64]);
    for (let y = 47; y <= 63; y++) border.push([46, y], [70, y]);
    border.forEach(([bx, by], i) => { if (!entrance(bx, by)) placeObj(i % 3 === 0 ? 'bush' : 'flower', bx, by); });
  }

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

  // ================= The open world (its own random stream) =================
  R = rng2;
  // ================= Sungei Buloh Wetlands =================
  placeObj('sign', 59, 116, { sign: 'Sungei Buloh \u2190  Jurong \u2192' });
  scatter('mangrove', 2, 114, 72, 194, 40, GRASSY);
  scatter('willow', 2, 114, 72, 194, 14, GRASSY);
  scatter('bamboo', 2, 114, 72, 194, 12, GRASSY);
  scatter('palm', 2, 114, 72, 194, 6, [T.SAND]);
  placeFishing('fishing_spot', 2, 114, 72, 194, 10);
  placeFishing('rod_spot', 2, 114, 72, 194, 10);
  placeFishing('harpoon_spot', 2, 114, 72, 194, 6);
  placeObj('mrt_station', 40, 148);

  // ================= Jurong Forest =================
  scatter('tree', 76, 114, 157, 194, 30, GRASSY);
  scatter('oak', 76, 114, 157, 194, 16, GRASSY);
  scatter('teak', 76, 114, 157, 194, 12, GRASSY);
  scatter('mahogany', 76, 114, 157, 194, 10, GRASSY);
  scatter('rain_tree', 76, 114, 157, 194, 8, GRASSY);
  scatter('angsana', 76, 114, 157, 194, 8, GRASSY);
  scatter('tembusu', 76, 114, 157, 194, 6, GRASSY);
  scatter('yew_tree', 76, 114, 157, 194, 8, GRASSY);
  scatter('magic_tree', 76, 114, 157, 194, 5, GRASSY);
  for (const [r, n] of [['copper_rock', 6], ['tin_rock', 6], ['iron_rock', 6], ['coal_rock', 6], ['silver_rock', 5], ['gold_rock', 5], ['granite_rock', 5],
    ['mithril_rock', 5], ['adamantite_rock', 4], ['runite_rock', 2], ['gem_rock', 4]]) scatter(r, 108, 160, 142, 188, n, [T.SAND]);
  placeObj('sign', 106, 152, { sign: 'Jurong Quarry \u2193' });
  placeObj('mrt_station', 110, 148);

  // ================= Pulau Ubin (rustic island kampong) =================
  placeObj('sign', 188, 52, { sign: 'Pulau Ubin' });
  placeObj('bank_booth', 184, 41); placeObj('bank_booth', 185, 41); placeNpc('banker', 184, 40);
  placeNpc('shopkeeper', 194, 42); placeNpc('hawker', 196, 46);
  placeObj('range', 186, 47); placeObj('furnace', 193, 47); placeObj('anvil', 195, 48);
  placeObj('stall_food', 197, 43);
  for (const [lx, ly] of [[182, 40], [198, 40], [182, 49], [198, 49]]) placeObj('lamp', lx, ly);
  placeNpc('villager', 189, 45, 4); placeNpc('villager', 192, 44, 4);
  scatter('rain_tree', 160, 2, 228, 98, 14, GRASSY);
  scatter('angsana', 160, 2, 228, 98, 10, GRASSY);
  scatter('tree', 160, 2, 228, 98, 18, GRASSY);
  scatter('palm', 160, 2, 228, 98, 8, GRASSY);
  for (const [r, n] of [['granite_rock', 8], ['sandstone_rock', 6], ['iron_rock', 5], ['coal_rock', 5], ['gold_rock', 3], ['clay_rock', 4]]) scatter(r, 200, 8, 222, 28, n, [T.SAND]);
  placeFishing('rod_spot', 170, 64, 186, 80, 5);
  placeObj('mrt_station', 192, 52);

  // ================= Changi Coast =================
  placeObj('sign', 266, 52, { sign: 'Changi Coast \u2192' });
  scatter('palm', 262, 4, 289, 98, 24, [T.SAND, T.GRASS]);
  scatter('tree', 232, 2, 266, 98, 12, GRASSY);
  placeFishing('fishing_cage', 288, 2, 299, 98, 8);
  placeFishing('harpoon_spot', 288, 2, 299, 98, 8);
  placeFishing('sea_rod_spot', 288, 2, 299, 98, 10);
  for (const [lx, ly] of [[260, 48], [270, 48], [280, 48]]) placeObj('lamp', lx, ly);
  placeObj('mrt_station', 258, 52);

  // ================= Marina Bay (the second city) =================
  placeObj('sign', 192, 127, { sign: 'Marina Bay' });
  placeObj('bank_booth', 182, 130); placeObj('bank_booth', 183, 130); placeObj('bank_booth', 184, 130); placeNpc('banker', 183, 129);
  placeNpc('shopkeeper', 198, 131); placeNpc('mage', 202, 133); placeNpc('fletcher', 200, 137);
  placeNpc('hawker', 186, 143); placeObj('range', 188, 144);
  placeObj('furnace', 180, 138); placeObj('anvil', 181, 140); placeObj('crafting_table', 183, 140);
  placeObj('shrine', 192, 135);
  placeObj('stall_market', 196, 143); placeObj('stall_gem', 200, 143); placeObj('stall_food', 204, 143);
  for (let lx = 178; lx <= 206; lx += 7) { placeObj('lamp', lx, 128); placeObj('lamp', lx, 147); }
  for (const [px2, py2] of [[179, 129], [205, 129], [179, 146], [205, 146]]) placeObj('palm', px2, py2);
  placeNpc('villager', 190, 139, 5); placeNpc('villager', 196, 136, 5); placeNpc('villager', 186, 134, 5);
  placeFishing('sea_rod_spot', 180, 168, 208, 188, 8);
  placeFishing('fishing_spot', 180, 168, 208, 188, 4);
  placeObj('mrt_station', 192, 149);

  // ================= Tekong Badlands (endgame, not Wilderness) =================
  placeObj('sign', 262, 104, { sign: '\u26A0 Tekong Badlands: lvl 70+' });
  scatter('ruin', 232, 102, 289, 194, 24, GRASSY);
  scatter('wall', 232, 102, 289, 194, 14, GRASSY);
  scatter('magic_tree', 232, 102, 289, 194, 6, GRASSY);
  scatter('yew_tree', 232, 102, 289, 194, 6, GRASSY);
  scatter('runite_rock', 232, 102, 289, 194, 5, GRASSY);
  scatter('adamantite_rock', 232, 102, 289, 194, 5, GRASSY);

  // ================= Gardens by the Bay (Supertree groves) =================
  placeObj('sign', 343, 53, { sign: 'Gardens by the Bay' });
  scatter('rain_tree', 302, 6, 390, 98, 26, GRASSY);
  scatter('magic_tree', 302, 6, 390, 98, 10, GRASSY);
  scatter('tembusu', 302, 6, 390, 98, 12, GRASSY);
  scatter('angsana', 302, 6, 390, 98, 12, GRASSY);
  scatter('flower', 302, 6, 390, 98, 120, GRASSY);
  placeFishing('rod_spot', 314, 26, 380, 80, 8);
  for (const [lx, ly] of [[336, 48], [346, 48], [336, 56], [346, 56]]) placeObj('lamp', lx, ly);
  placeObj('mrt_station', 344, 50);

  // ================= Coney Island =================
  placeObj('sign', 343, 104, { sign: 'Coney Island' });
  scatter('tree', 302, 104, 380, 194, 26, GRASSY);
  scatter('mahogany', 302, 104, 380, 194, 12, GRASSY);
  scatter('yew_tree', 302, 104, 380, 194, 10, GRASSY);
  scatter('palm', 378, 100, 391, 195, 16, [T.SAND]);
  scatter('bamboo', 302, 104, 380, 194, 12, GRASSY);
  placeFishing('fishing_cage', 390, 100, 399, 195, 6);
  placeFishing('harpoon_spot', 390, 100, 399, 195, 6);
  placeObj('mrt_station', 344, 148);

  // ================= Southern Islands =================
  placeObj('sign', 193, 206, { sign: 'Southern Islands \u2193' });
  scatter('palm', 2, 206, 197, 270, 34, [T.SAND, T.GRASS]);
  scatter('rain_tree', 2, 206, 197, 270, 12, GRASSY);
  scatter('magic_tree', 2, 206, 197, 270, 6, GRASSY);
  scatter('ruin', 2, 206, 197, 270, 10, GRASSY);
  scatter('runite_rock', 2, 206, 197, 270, 6, GRASSY);
  scatter('gem_rock', 2, 206, 197, 270, 5, GRASSY);
  placeFishing('sea_rod_spot', 2, 206, 197, 270, 14);
  placeFishing('harpoon_spot', 2, 206, 197, 270, 10);
  placeFishing('fishing_cage', 2, 206, 197, 270, 8);
  placeObj('shrine', 40, 232);   // Kusu's turtle temple
  placeObj('mrt_station', 98, 238);

  // ================= The Shadow Rift (endgame) and its outpost =================
  placeObj('sign', 262, 205, { sign: '\u26A0 The Shadow Rift: lvl 200+' });
  placeObj('bank_booth', 252, 209); placeObj('bank_booth', 253, 209); placeNpc('banker', 252, 208);
  placeNpc('shopkeeper', 270, 210); placeNpc('mage', 272, 214); placeNpc('fletcher', 270, 218); placeNpc('hawker', 254, 220);
  placeObj('range', 256, 220); placeObj('furnace', 252, 214); placeObj('anvil', 253, 216);
  for (const [lx, ly] of [[250, 208], [274, 208], [250, 222], [274, 222]]) placeObj('lamp', lx, ly);
  placeNpc('villager', 260, 214, 4);
  placeObj('mrt_station', 264, 222);
  scatter('ruin', 202, 206, 390, 270, 40, GRASSY);
  scatter('wall', 202, 206, 390, 270, 26, GRASSY);
  scatter('runite_rock', 202, 206, 390, 270, 10, GRASSY);
  scatter('gem_rock', 202, 206, 390, 270, 6, GRASSY);
  scatter('magic_tree', 202, 206, 390, 270, 10, GRASSY);

  // Scenery so the open country feels alive: bushes, wildflowers and boulders.
  for (const [x0, y0, x1, y1] of [[2, 114, 157, 194], [160, 2, 288, 98], [160, 100, 229, 194], [232, 102, 289, 194], [302, 6, 390, 194], [202, 206, 390, 270]]) {
    scatter('bush', x0, y0, x1, y1, 70, GRASSY);
    scatter('flower', x0, y0, x1, y1, 45, GRASSY);
  }

  R = rng;
  // ================= Populate the bestiary by zone =================
  const zoneByName = (name) => zones.find((z) => z.name === name);
  const LANDABLE = [T.GRASS, T.DARKGRASS, T.SAND];
  const inTown = (x, y) => x >= 44 && x <= 72 && y >= 44 && y <= 66;
  const placeMobIn = (id, wander) => {
    const def = NPCS[id];
    const z = zoneByName(def.zone) || zoneByName('Bukit Timah');
    for (let att = 0; att < 90; att++) {
      const x = z.x0 + Math.floor(R() * (z.x1 - z.x0 + 1));
      const y = z.y0 + Math.floor(R() * (z.y1 - z.y0 + 1));
      if (inTown(x, y) || !LANDABLE.includes(get(x, y)) || occupied.has(key(x, y))) continue;
      placeNpc(id, x, y, wander);
      return;
    }
    placeNpc(id, Math.round((z.x0 + z.x1) / 2), Math.round((z.y0 + z.y1) / 2), wander);
  };
  // Plenty of monsters: three of every kind, spread around its zone.
  // Monsters native to the open-world regions are placed later, on the open world's stream.
  const isNewZone = (id) => !!zoneByName(NPCS[id].zone)?.lo;
  for (let copy = 0; copy < MONSTER_COPIES; copy++) for (const id of MONSTER_IDS) { if (!isNewZone(id)) placeMobIn(id, 4); }
  for (const id of BOSS_IDS) { if (NPCS[id].fixed || isNewZone(id)) continue; placeMobIn(id, 3); }
  // The open-world regions draw on the whole bestiary: creatures that suit the
  // land (by body type), within the region's level band.
  const towns = [[178, 128, 206, 147], [182, 40, 198, 49], [250, 208, 274, 222]];
  const inNewTown = (x, y) => towns.some(([a, b, c, d]) => x >= a - 2 && x <= c + 2 && y >= b - 2 && y <= d + 2);
  const placeInZone = (id, z, wander) => {
    for (let att = 0; att < 90; att++) {
      const x = z.x0 + Math.floor(R() * (z.x1 - z.x0 + 1)), y = z.y0 + Math.floor(R() * (z.y1 - z.y0 + 1));
      if (inNewTown(x, y) || !LANDABLE.includes(get(x, y)) || occupied.has(key(x, y))) continue;
      placeNpc(id, x, y, wander);
      return;
    }
  };
  R = rng2;
  const REGION_FAUNA = {
    'Sungei Buloh Wetlands': ['reptile', 'fowl', 'crab', 'serpent', 'insect', 'turtle', 'slime', 'wisp', 'jellyfish'],
    'Jurong Forest': ['beast', 'primate', 'spider', 'hound', 'plant', 'mantis', 'bat', 'greenman', 'humanoid'],
    'Pulau Ubin': ['beast', 'primate', 'serpent', 'fowl', 'rodent', 'hound', 'bat', 'insect'],
    'Changi Coast': ['crab', 'seacreature', 'turtle', 'jellyfish', 'fowl', 'scorpion'],
    'Marina Bay': ['humanoid', 'ghost', 'rodent', 'fowl', 'hound'],
    'Tekong Badlands': ['undead', 'ghost', 'demon', 'drake', 'golem', 'reptile', 'serpent', 'spider', 'hound', 'seacreature'],
    'Gardens by the Bay': ['plant', 'fowl', 'insect', 'mantis', 'wisp', 'beast', 'primate', 'bat'],
    'Coney Island': ['beast', 'hound', 'serpent', 'reptile', 'fowl', 'crab', 'spider'],
    'Southern Islands': ['crab', 'seacreature', 'turtle', 'jellyfish', 'serpent', 'undead', 'ghost', 'reptile'],
    'The Shadow Rift': ['undead', 'ghost', 'demon', 'drake', 'golem', 'reptile', 'serpent', 'spider', 'seacreature', 'beast'],
  };
  // Endgame monsters and the open-world bosses, in their home regions.
  for (let copy = 0; copy < MONSTER_COPIES; copy++) for (const id of MONSTER_IDS) { if (isNewZone(id)) placeInZone(id, zoneByName(NPCS[id].zone), 4); }
  for (const id of BOSS_IDS) { if (!NPCS[id].fixed && isNewZone(id)) placeInZone(id, zoneByName(NPCS[id].zone), 3); }
  for (const [name, sprites] of Object.entries(REGION_FAUNA)) {
    const z = zoneByName(name);
    const inBand = (id) => NPCS[id].level >= z.lo && NPCS[id].level <= z.hi;
    let kinds = MONSTER_IDS.filter((id) => sprites.includes(NPCS[id].sprite) && inBand(id));
    // Few themed creatures at this level? Let any creature in the band roam here.
    if (kinds.length < 20) kinds = MONSTER_IDS.filter(inBand);
    for (let copy = 0; copy < REGION_COPIES; copy++) for (const id of kinds) placeInZone(id, z, 4);
  }
  // A few bosses roam the open world too.
  for (const [id, name] of [['mangrove_hydra', 'Sungei Buloh Wetlands'], ['tualang_treant', 'Jurong Forest'], ['boar_king', 'Pulau Ubin'],
    ['coral_leviathan', 'Changi Coast'], ['bedok_bandit_lord', 'Marina Bay'], ['dragon_kiln_wyrm', 'Tekong Badlands'], ['rune_golem', 'Tekong Badlands'],
    ['bukit_brown_revenant', 'Tekong Badlands']]) {
    if (NPCS[id]) placeInZone(id, zoneByName(name), 3);
  }
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
