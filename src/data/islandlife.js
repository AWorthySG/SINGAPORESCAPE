export const ISLAND_LIFE = [
  { id: 'sailing', name: 'Sailing', icon: '⛵', color: '#276c80', group: 'other', desc: 'Follow sea charts and unlock new landings.' },
  { id: 'photography', name: 'Photography', icon: '📷', color: '#785366', group: 'other', desc: 'Photograph island landmarks and fill your home album.' },
  { id: 'textile_arts', name: 'Textile Arts', icon: '🧵', color: '#94475b', group: 'making', desc: 'Use woven fibres and botanical dyes to make fabric patterns.' },
  { id: 'music', name: 'Music', icon: '🎵', color: '#846129', group: 'other', desc: 'Learn tunes and play them for the hawker crowd.' },
];

export const ISLAND_BY_ID = Object.fromEntries(ISLAND_LIFE.map((s) => [s.id, s]));
export const LOOM = { x: 63, y: 61, name: 'Kampong Glam market', level: 1 };
export const LOOMS = [LOOM, { x: 75, y: 53, name: 'Chinatown textile workshop', level: 8 }];
export const STAGES = [
  { id: 'kampong', x: 60, y: 59, name: 'Kampong Glam hawker lane', level: 1 },
  { id: 'marina', x: 194, y: 144, name: 'Marina Bay hawker centre', level: 3 },
  { id: 'sentosa', x: 58, y: 93, name: 'Sentosa beach stage', level: 10 },
];
export const LANDINGS = {
  changi: { x: 294, y: 47, name: 'Changi landing' },
  ubin: { x: 193, y: 53, name: 'Pulau Ubin landing' },
  cove: { x: 291, y: 55, name: 'Changi shell cove' },
  marina: { x: 193, y: 150, name: 'Marina Bay landing' },
  sentosa: { x: 56, y: 94, name: 'Sentosa landing' },
};
export const VOYAGES = [
  { id: 'ubin', from: 'changi', to: 'ubin', level: 1, course: [0, 1, 0], xp: 18, freight: 70 },
  { id: 'changi', from: 'ubin', to: 'changi', level: 1, course: [1, 0, 1], xp: 18, freight: 70 },
  { id: 'cove', from: 'changi', to: 'cove', level: 3, course: [1, 1, 0, 1], xp: 32 },
  { id: 'cove_return', from: 'cove', to: 'changi', level: 3, course: [0, 1, 0, 0], xp: 32 },
  { id: 'marina', from: 'changi', to: 'marina', requires: 'ubin', level: 8, course: [0, 1, 1, 0, 1], xp: 65, freight: 145 },
  { id: 'marina_return', from: 'marina', to: 'changi', level: 8, course: [1, 0, 0, 1, 0], xp: 65, freight: 145 },
  { id: 'sentosa', from: 'marina', to: 'sentosa', requires: 'marina', level: 15, course: [1, 1, 0, 1, 0, 0], xp: 105, freight: 250 },
  { id: 'sentosa_return', from: 'sentosa', to: 'marina', level: 15, course: [0, 1, 0, 0, 1, 1], xp: 105, freight: 250 },
];
export const PHOTO_ASSIGNMENTS = [
  { id: 'dome', name: 'Golden dome at dusk', detail: 'Stand at the hall’s south entrance at dusk (17:00–20:00 on the island clock).', x: 62, y: 82, range: 4, dusk: true, level: 1, xp: 32, art: 'island-dome', subject: 'golden_dome_hall' },
  { id: 'market', name: 'Market colours', detail: 'Frame a postcard near the Kampong Glam food stall.', x: 64, y: 62, range: 5, level: 1, xp: 24, art: 'island-market' },
  { id: 'ubin', name: 'Pulau Ubin landing', detail: 'Take a postcard from the landing at Pulau Ubin.', x: 193, y: 53, range: 5, level: 2, xp: 38, art: 'island-ubin' },
  { id: 'wetlands', name: 'Light over the wetlands', detail: 'Take a postcard near the Sungei Buloh boardwalk entrance.', x: 40, y: 149, range: 6, level: 3, xp: 54, art: 'island-wetlands' },
  { id: 'playground', name: 'The mosaic dragon', detail: 'Take a postcard at the dragon playground south of Kampong Glam.', x: 49, y: 74, range: 4, level: 7, xp: 72, art: 'obj-dragon_playground', worldArt: true, subject: 'dragon_playground' },
  { id: 'temple', name: 'Chinatown temple', detail: 'Take a postcard outside the clan temple in Chinatown.', x: 83, y: 57, range: 4, level: 10, xp: 96, art: 'obj-chinese_temple', worldArt: true, subject: 'chinese_temple' },
  { id: 'wheel', name: 'Marina Bay blue hour', detail: 'Photograph the observation wheel at dusk (17:00–20:00).', x: 199, y: 162, range: 4, dusk: true, level: 14, xp: 125, art: 'obj-observation_wheel', worldArt: true, subject: 'observation_wheel' },
  { id: 'gardens', name: 'Gardens under glass', detail: 'Take a postcard in front of the Flower Dome.', x: 350, y: 32, range: 4, level: 20, xp: 165, art: 'obj-flower_dome', worldArt: true, subject: 'flower_dome' },
];
export const islandPhotoArt = (assignment) => `assets/${assignment.worldArt ? 'world' : 'postcards'}/${assignment.art}.webp`;
export const PATTERNS = [
  { id: 'chilli', name: 'Chilli flower', level: 1, xp: 22, dye: 'chilli', colours: ['#a24849', '#f3d49a'] },
  { id: 'pandan', name: 'Pandan leaf', level: 3, xp: 36, dye: 'pandan_leaves', colours: ['#396b58', '#f7dca1'] },
  { id: 'sireh', name: 'Sireh star', level: 5, xp: 52, dye: 'sireh_leaf', colours: ['#365c78', '#add9be'] },
  { id: 'butterfly', name: 'Butterfly pea indigo', level: 8, xp: 78, dye: 'butterfly_pea', reward: 'batik_bloom_ring', art: 'pandan', hue: 108, colours: ['#484b91', '#b9a4df'] },
  { id: 'ginger', name: 'Torch ginger bloom', level: 15, xp: 118, dye: 'torch_ginger', art: 'chilli', hue: -28, colours: ['#9d496f', '#f7c8a8'] },
  { id: 'mangosteen', name: 'Mangosteen night', level: 22, xp: 158, dye: 'mangosteen', reward: 'batik_night_amulet', art: 'sireh', hue: 58, colours: ['#604961', '#dcc3a5'] },
];
export const TUNES = [
  { id: 'kopi', name: 'Kopi Waltz', notes: [0, 1, 2, 1], level: 1, xp: 17, tip: 12 },
  { id: 'market', name: 'Market Steps', notes: [1, 0, 2, 1, 0], level: 3, xp: 29, tip: 21 },
  { id: 'harbour', name: 'Harbour Lights', notes: [2, 1, 2, 0, 1, 2], level: 5, xp: 44, tip: 34 },
  { id: 'rain', name: 'Rain on the Roof', notes: [0, 2, 1, 0, 0, 2, 1], level: 8, xp: 69, tip: 56, stage: 'marina' },
  { id: 'tide', name: 'Sentosa Tide', notes: [1, 2, 0, 2, 1, 0, 1, 2], level: 12, xp: 92, tip: 74, stage: 'sentosa' },
  { id: 'lanterns', name: 'Lantern Procession', notes: [2, 0, 1, 2, 2, 0, 1, 0, 2], level: 18, xp: 133, tip: 106, stage: 'marina' },
];
