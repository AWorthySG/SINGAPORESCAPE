export const ISLAND_LIFE = [
  { id: 'sailing', name: 'Sailing', icon: '⛵', color: '#276c80', group: 'other', desc: 'Follow sea charts and unlock new landings.' },
  { id: 'photography', name: 'Photography', icon: '📷', color: '#785366', group: 'other', desc: 'Photograph island landmarks and fill your home album.' },
  { id: 'textile_arts', name: 'Textile Arts', icon: '🧵', color: '#94475b', group: 'making', desc: 'Use woven fibres and botanical dyes to make fabric patterns.' },
  { id: 'music', name: 'Music', icon: '🎵', color: '#846129', group: 'other', desc: 'Learn tunes and play them for the hawker crowd.' },
];

export const ISLAND_BY_ID = Object.fromEntries(ISLAND_LIFE.map((s) => [s.id, s]));
export const LOOM = { x: 63, y: 61, name: 'Kampong Glam market' };
export const STAGES = [
  { x: 60, y: 59, name: 'Kampong Glam hawker lane', level: 1 },
  { x: 194, y: 144, name: 'Marina Bay hawker centre', level: 3 },
];
export const LANDINGS = {
  changi: { x: 294, y: 47, name: 'Changi landing' },
  ubin: { x: 193, y: 53, name: 'Pulau Ubin landing' },
  cove: { x: 291, y: 55, name: 'Changi shell cove' },
};
export const VOYAGES = [
  { id: 'ubin', from: 'changi', to: 'ubin', level: 1, course: [0, 1, 0], xp: 18 },
  { id: 'changi', from: 'ubin', to: 'changi', level: 1, course: [1, 0, 1], xp: 18 },
  { id: 'cove', from: 'changi', to: 'cove', level: 3, course: [1, 1, 0, 1], xp: 32 },
  { id: 'cove_return', from: 'cove', to: 'changi', level: 3, course: [0, 1, 0, 0], xp: 32 },
];
export const PHOTO_ASSIGNMENTS = [
  { id: 'dome', name: 'Golden dome at dusk', detail: 'Stand at the hall’s south entrance at dusk (17:00–20:00 on the island clock).', x: 62, y: 82, range: 4, dusk: true, level: 1, xp: 32, art: 'obj-golden_dome_hall' },
  { id: 'market', name: 'Market colours', detail: 'Frame a postcard near the Kampong Glam food stall.', x: 64, y: 62, range: 5, level: 1, xp: 24, art: 'obj-stall_food' },
  { id: 'ubin', name: 'Pulau Ubin landing', detail: 'Take a postcard from the landing at Pulau Ubin.', x: 193, y: 53, range: 5, level: 2, xp: 38, art: 'obj-stilt_house' },
  { id: 'wetlands', name: 'Light over the wetlands', detail: 'Take a postcard near the Sungei Buloh boardwalk entrance.', x: 40, y: 149, range: 6, level: 3, xp: 54, art: 'tree-mangrove' },
];
export const PATTERNS = [
  { id: 'chilli', name: 'Chilli flower', level: 1, xp: 22, dye: 'chilli', colours: ['#a24849', '#f3d49a'] },
  { id: 'pandan', name: 'Pandan leaf', level: 3, xp: 36, dye: 'pandan_leaves', colours: ['#396b58', '#f7dca1'] },
  { id: 'sireh', name: 'Sireh star', level: 5, xp: 52, dye: 'sireh_leaf', colours: ['#365c78', '#add9be'] },
];
export const TUNES = [
  { id: 'kopi', name: 'Kopi Waltz', notes: [0, 1, 2, 1], level: 1, xp: 17, tip: 12 },
  { id: 'market', name: 'Market Steps', notes: [1, 0, 2, 1, 0], level: 3, xp: 29, tip: 21 },
  { id: 'harbour', name: 'Harbour Lights', notes: [2, 1, 2, 0, 1, 2], level: 5, xp: 44, tip: 34 },
];
