// Where each fish is caught. Every fishing spot holds one species (objects.js),
// so the player picks a fish by where they go: anchovies and tilapia by
// MacRitchie, mangrove fish in the Sungei Buloh wetlands, reef fish round the
// Southern Islands, mantas off the Tuas wharves, and so on.
//
// world.js lays the spots out as it always has (five old mixed kinds: net, rod,
// coastal rod, cage and harpoon), then calls assignFishSpots() once everything
// else is placed. That only renames spots, region by region, to the species in
// FISH_SPOT_PLAN: nothing moves and no dice are rolled, so every tile, random
// stream and later placement (landmarks, groves) stays exactly where it was.
// Each region's spots are lined up along the region's long side and cut into
// runs, one run per species, so a species keeps to one stretch of shore.
// (The endgame spots, levels 100-300, have their own fisheries in world.js and
// the town pond south of Kampong Glam keeps its anchovy shoal and trout pool.)

// The old mixed spots, which world.js places and this file shares out.
export const MIXED_FISH_SPOTS = ['fishing_spot', 'rod_spot', 'sea_rod_spot', 'fishing_cage', 'harpoon_spot'];

// Region (or regions taken together) -> the spot kinds its spots become, in
// equal shares. Low fish sit near Kampong Glam; the deep-sea fish further out.
export const FISH_SPOT_PLAN = [
  { regions: ['MacRitchie Reservoir', 'Bukit Timah'], spots: ['fishing_spot', 'tilapia_spot', 'perch_spot'] },
  { regions: ['Sentosa Beach'], spots: ['sardine_spot', 'sea_rod_spot', 'harpoon_spot'] },
  { regions: ['Pulau Ubin'], spots: ['rod_spot'] },
  { regions: ['Kranji Farmlands'], spots: ['keli_spot', 'pike_spot'] },
  { regions: ['Sungei Buloh Wetlands'], spots: ['goby_spot', 'milkfish_spot', 'barramundi_spot', 'mangrove_jack_spot'] },
  { regions: ['Marina Bay'], spots: ['salmon_spot', 'queenfish_spot'] },
  { regions: ['Changi Coast'], spots: ['mackerel_spot', 'red_drum_spot', 'fishing_cage', 'golden_snapper_spot', 'threadfin_spot', 'pomfret_spot'] },
  { regions: ['Punggol Waterway'], spots: ['peacock_bass_spot', 'belida_spot', 'eel_spot', 'temensis_spot'] },
  { regions: ['The Wilderness', 'Pulau Hantu'], spots: ['tenggiri_spot', 'swordfish_spot', 'grouper_spot'] },
  { regions: ['Gardens by the Bay'], spots: ['snakehead_spot'] },
  { regions: ['Southern Islands'], spots: ['longfin_spot', 'coral_trout_spot', 'cobia_spot', 'shark_spot'] },
  { regions: ['Coney Island'], spots: ['stingray_spot', 'giant_trevally_spot'] },
  { regions: ['Tuas Docklands'], spots: ['diamond_trevally_spot', 'hybrid_grouper_spot', 'manta_spot'] },
  { regions: ['Mandai Rainforest'], spots: ['arapaima_spot'] },
  { regions: ['The Celestial Peaks'], spots: ['asian_arowana_spot'] },
];

/**
 * Rename the old mixed fishing spots in `objects` ({ objId, x, y }) to the
 * one-species spots FISH_SPOT_PLAN gives their region. `zones` is world.js's
 * region list (first match wins, as World.zoneAt).
 */
export function assignFishSpots({ objects, zones }) {
  const mixed = new Set(MIXED_FISH_SPOTS);
  const zoneAt = (x, y) => zones.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)?.name;
  for (const plan of FISH_SPOT_PLAN) {
    const mine = objects.filter((o) => mixed.has(o.objId) && plan.regions.includes(zoneAt(o.x, o.y)));
    if (!mine.length) continue;
    // Line them up along the longer side of the stretch they cover.
    const xs = mine.map((o) => o.x), ys = mine.map((o) => o.y);
    const wide = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    mine.sort((a, b) => (wide ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x));
    // Equal runs, the first kinds taking one more while any are left over.
    const k = plan.spots.length, each = Math.floor(mine.length / k), extra = mine.length % k;
    let i = 0;
    plan.spots.forEach((objId, n) => {
      for (let c = 0; c < each + (n < extra ? 1 : 0); c++) mine[i++].objId = objId;
    });
  }
}
