// Region colours and painted features already found in the world.
// The arrival card uses the full treatment, the minimap only the palette.
export const DISTRICT_VISUALS = {
  'Kampong Glam': ['#805725', '#FFF0D3', 'Golden-domed hall', 'obj-golden_dome_hall.webp'],
  Chinatown: ['#9B362C', '#FCE6DF', 'Temple courtyard', 'obj-chinese_temple.webp'],
  'MacRitchie Reservoir': ['#286750', '#E1F2DE', 'Treetop bridge', 'obj-treetop_bridge.webp'],
  'Sentosa Beach': ['#A04F29', '#FFF0D8', 'Lifeguard tower', 'obj-lifeguard_tower.webp'],
  'Bukit Timah': ['#575F27', '#F0F1D5', 'Forest trail', 'obj-trail_signpost.webp'],
  'Sungei Buloh Wetlands': ['#37694E', '#E2EFDE', 'Wetland bird hide', 'obj-bird_hide.webp'],
  'Jurong Forest': ['#536340', '#EAF0DD', 'Jurong Quarry', 'rock-granite_rock.webp'],
  'Pulau Ubin': ['#6B5933', '#F1E8D3', 'Kampong stilt house', 'obj-stilt_house.webp'],
  'Changi Coast': ['#276975', '#DFF3F2', 'Kelong', 'obj-kelong.webp'],
  'Marina Bay': ['#31578C', '#E1EDFA', 'Observation wheel', 'obj-observation_wheel.webp'],
  'Tekong Badlands': ['#8A4935', '#F3E6D7', 'Rusty tanks', 'obj-rusty_tank.webp'],
  'Gardens by the Bay': ['#6D4988', '#F0E6F7', 'Supertrees', 'obj-supertree_tall.webp'],
  'Coney Island': ['#35675E', '#E3F0E5', 'East shore', 'obj-palm.webp'],
  'Southern Islands': ['#2D6B82', '#E3F2F8', 'Island lighthouse', 'obj-lighthouse.webp'],
  'The Shadow Rift': ['#69407D', '#F0E4F3', 'Rift obelisk', 'obj-rift_obelisk.webp'],
  'Punggol Waterway': ['#365B8F', '#E6EDF9', 'Waterway footbridge', 'obj-punggol_footbridge.webp'],
  'Kranji Farmlands': ['#756420', '#F6EFCE', 'Kranji farmhouse', 'obj-kranji_farmhouse.webp'],
  'Mandai Rainforest': ['#2C6946', '#DBEEDC', 'Canopy course', 'obj-canopy_course_treetop_walk.webp'],
  'Tuas Docklands': ['#4D5C71', '#E4EDF0', 'Gantry crane', 'obj-gantry_crane.webp'],
  'Temasek Ruins': ['#825033', '#F2E7D6', 'Temasek gate', 'obj-temasek_gate.webp'],
  'The Celestial Peaks': ['#565791', '#EBE8FA', 'Celestial pavilion', 'obj-celestial_pavilion.webp'],
  'Pulau Hantu': ['#685173', '#EEE6F1', 'Ghost lanterns', 'obj-ghost_lantern.webp'],
  'The Wilderness': ['#843F38', '#F5E4DC', 'Ruined walls', 'obj-ruin.webp'],
};

export function districtVisual(name) {
  return Object.hasOwn(DISTRICT_VISUALS, name) ? DISTRICT_VISUALS[name] : null;
}
