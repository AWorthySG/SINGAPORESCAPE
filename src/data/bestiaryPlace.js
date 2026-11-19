// Where the bestiary expansion's monsters and bosses live (see bestiary.js).
// world.js calls this last, after every other monster, object and clearing pass,
// with a random stream of its own, so nothing placed before moves.
//
// Each species gets CAMPS_PER_SPECIES camps in its home region, one of each of
// its three forms round each camp (packs, like everything else). Each boss gets
// one spot. Every spawn keeps to the same rules the earlier passes enforce:
//   - not in a town, on open land, never on top of an object or another spawn;
//   - well clear of every MRT station (MRT_CLEAR + 2 tiles);
//   - outside the starter ring round the respawn point, where new players fight;
//   - in the Wilderness, far enough east that nothing reaches across its border;
//   - one tile in from the map edge, where the border fence goes up;
//   - well away from the skilling grounds players stand at for hours (the endgame
//     groves, veins, fishing spots, traps, chests, agility courses, farm patches),
//     so a new pack never interrupts a gathering run.
import { NPCS, BESTIARY_MONSTER_IDS, BESTIARY_BOSS_IDS } from './npcs.js';
import { STATIONS } from './transport.js';

export const CAMPS_PER_SPECIES = 4;
// The starter ring (world.js's "Tame the starter ring" uses 30): nothing new spawns this close.
export const STARTER = { x: 58, y: 55, ring: 34 };
const CAMP_GAP = 6;     // camps of one species keep at least this far apart
const BOSS_GAP = 14;    // a new boss keeps this far from any other boss
const SKILL_GAP = 13;   // and every spawn this far from a skilling ground (aggro 4 + wander 3 + room)
export const SKILLING_GROUND = /^(obsidian_vein|orichalcum_rock|jade_seam|fallen_star|skyglass_crystal|eternal_lode|seraya_tree|meranti_tree|chengal_tree|starfall_banyan|moonlit_kapok|keramat_tree|pangolin_burrow|colugo_trap|tiger_trail|garuda_nest|naga_track|phoenix_roost|temple_vault|observatory_chest|smugglers_hold|rift_treasury|farm_patch|apothecary_table|fletching_bench|bird_snare|squirrel_trap|lizard_snare|mousedeer_trail|boar_pit|python_trap|crocodile_trap|hornbill_nest|qilin_trail|.*_spot|arowana_pool|(supertree_skyway|container_yard_run|canopy_course|cloud_steps|wraith_run|rift_leap)_.*)$/;

/**
 * Place the new monsters and bosses. `ctx` is world.js's own helpers:
 * { zones, get, landable, occupied, key, npcSpawns, objects, placeNpc, inTown, inNewTown, W, H, rand, mrtClear }.
 */
export function placeBestiary(ctx) {
  const { zones, get, landable, occupied, key, npcSpawns, objects, placeNpc, inTown, inNewTown, W, H, rand, mrtClear } = ctx;
  // Tiles within SKILL_GAP of a skilling ground, marked once.
  const nearSkill = new Set();
  for (const o of objects) {
    if (!SKILLING_GROUND.test(o.objId)) continue;
    for (let dy = -SKILL_GAP; dy <= SKILL_GAP; dy++) for (let dx = -SKILL_GAP; dx <= SKILL_GAP; dx++) nearSkill.add(key(o.x + dx, o.y + dy));
  }
  const zoneByName = (name) => zones.find((z) => z.name === name);
  const WZ = zoneByName('The Wilderness');
  const taken = new Set(npcSpawns.map((s) => key(s.x, s.y)));
  const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  const nearStation = (x, y) => STATIONS.some((st) => cheb(st.x, st.y, x, y) < mrtClear + 2);
  const inZ = (z, x, y) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
  // Aggressive spawns in the Wilderness stay wander (3) + aggro range (4) + 1 tiles in from its west edge.
  const ok = (z, x, y, def) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2 && inZ(z, x, y)
    && landable.includes(get(x, y)) && !occupied.has(key(x, y)) && !taken.has(key(x, y))
    && !inTown(x, y) && !inNewTown(x, y) && !nearStation(x, y) && !nearSkill.has(key(x, y))
    && cheb(x, y, STARTER.x, STARTER.y) > STARTER.ring
    && !(z === WZ && def.aggressive && x < WZ.x0 + 8);
  const spotIn = (z, def, far = () => true) => {
    for (let att = 0; att < 400; att++) {
      const x = z.x0 + Math.floor(rand() * (z.x1 - z.x0 + 1)), y = z.y0 + Math.floor(rand() * (z.y1 - z.y0 + 1));
      if (ok(z, x, y, def) && far(x, y)) return [x, y];
    }
    return null;
  };
  const near = (z, cx, cy, def) => {
    for (let r = 0; r <= 3; r++) {
      const ring = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (cheb(dx, dy, 0, 0) === r && ok(z, cx + dx, cy + dy, def)) ring.push([cx + dx, cy + dy]);
      }
      if (ring.length) return ring[Math.floor(rand() * ring.length)];
    }
    return null;
  };
  const put = (id, at) => { placeNpc(id, at[0], at[1], 3); taken.add(key(at[0], at[1])); };

  // Monsters: the three forms of a species share a family, in bestiary order.
  const families = new Map();
  for (const id of BESTIARY_MONSTER_IDS) {
    const f = NPCS[id].family;
    if (!families.has(f)) families.set(f, []);
    families.get(f).push(id);
  }
  for (const ids of families.values()) {
    const z = zoneByName(NPCS[ids[0]].zone);
    if (!z) continue;
    const camps = [];
    // The strongest form decides where a camp may go (it is always aggressive).
    const lead = NPCS[ids[ids.length - 1]];
    for (let c = 0; c < CAMPS_PER_SPECIES; c++) {
      const camp = spotIn(z, lead, (x, y) => camps.every(([px, py]) => cheb(px, py, x, y) >= CAMP_GAP));
      if (!camp) continue;
      camps.push(camp);
      for (const id of ids) { const at = near(z, camp[0], camp[1], NPCS[id]); if (at) put(id, at); }
    }
  }
  // Bosses: one each, away from the other bosses.
  const bossAt = npcSpawns.filter((s) => NPCS[s.npcId]?.boss).map((s) => [s.x, s.y]);
  for (const id of BESTIARY_BOSS_IDS) {
    const z = zoneByName(NPCS[id].zone);
    if (!z) continue;
    const far = (x, y) => bossAt.every(([bx, by]) => cheb(bx, by, x, y) >= BOSS_GAP);
    const at = spotIn(z, NPCS[id], far) || spotIn(z, NPCS[id]);
    if (at) { put(id, at); bossAt.push(at); }
  }
}
