// Painted art for the world's small touches (assets/fx/): ambient critters,
// drifting particles (dust, leaves, petals, sparks), the boss entrance banner,
// the region title plaque and each region's round badge. Every picture loads
// on first use; until it has loaded (and always when there is no `Image`, as in
// the tests) the callers keep drawing their simple canvas shapes instead.

export const CRITTER_ART = ['butterfly', 'butterfly_half', 'butterfly_shut', 'swallowtail', 'sparrow', 'sparrow_peck', 'sparrow_up',
  'sparrow_down', 'myna', 'myna_peck', 'myna_up', 'myna_down', 'cicak_green', 'cicak_sand', 'firefly', 'dragonfly', 'kingfisher'];
// (The sheet's splash and sparkle are not used yet, so they are not shipped.)
export const PARTICLE_ART = ['dust_s', 'dust_m', 'dust_l', 'leaf_green', 'leaf_lime', 'leaf_dry', 'petal_pink', 'frangipani',
  'petal_red', 'ember'];
// The banner and the plaque come in three pieces (two ends and a middle that
// stretches to fit the name), in a normal and a dark tone.
const PIECES = ['normal', 'dark'].flatMap((t) => ['left', 'middle', 'right'].map((p) => `${t}-${p}`));
// Each region's badge, by the region's name as world.js spells it.
export const REGION_BADGES = ['Kampong Glam', 'Chinatown', 'Marina Bay', 'Bukit Timah', 'Jurong Forest', 'Mandai Rainforest',
  'MacRitchie Reservoir', 'Punggol Waterway', 'Sungei Buloh Wetlands', 'Sentosa Beach', 'Changi Coast', 'Southern Islands',
  'Pulau Ubin', 'Coney Island', 'Gardens by the Bay', 'Kranji Farmlands', 'Tuas Docklands', 'Temasek Ruins',
  'The Celestial Peaks', 'The Wilderness', 'Pulau Hantu', 'Tekong Badlands', 'The Shadow Rift'];
// The grim lands get the dark plaque and banner.
export const DARK_REGIONS = new Set(['The Wilderness', 'Pulau Hantu', 'Tekong Badlands', 'The Shadow Rift']);
export const badgeKey = (region) => `badge-${region.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
// Painted combat effects (assets/fx/fx-<name>.webp): the crit star-burst, the
// miss puff, confetti, the level-up ribbon, six element hits, the loot beam
// (tinted by rarity) and the ultimate burst. Each caller keeps its canvas
// drawing as the fallback while the picture loads (and in the tests).
export const EFFECT_ART = ['crit-burst', 'miss-puff', 'confetti', 'levelup-ribbon', 'hit-ice', 'hit-lightning', 'hit-nature',
  'hit-poison', 'hit-holy', 'hit-shadow', 'loot-beam', 'ultimate-burst'];

/** Every file name (without .webp) in assets/fx/, for the lock-step test. */
export const fxArt = () => new Set([
  ...CRITTER_ART.map((k) => `critter-${k}`), ...PARTICLE_ART.map((k) => `particle-${k}`),
  ...PIECES.flatMap((p) => [`banner-${p}`, `plaque-${p}`]), 'banner-crest', ...REGION_BADGES.map(badgeKey),
  ...EFFECT_ART.map((k) => `fx-${k}`),
]);

/**
 * Which painted leaf a tree lets fall: a dry one in `autumn`, a red petal from
 * an angsana, pink from a rain tree, a frangipani flower from a tembusu, else a
 * green or a yellow-green leaf (picked by the tree's spot and `n`, so it costs
 * no random roll).
 */
export function leafArt(tree, autumn, n = 0) {
  if (autumn) return 'leaf_dry';
  const id = tree && tree.objId;
  if (id === 'angsana') return 'petal_red';
  if (id === 'rain_tree') return 'petal_pink';
  if (id === 'tembusu') return 'frangipani';
  return ((tree ? tree.x + tree.y : 0) + n) % 2 ? 'leaf_lime' : 'leaf_green';
}

const _img = {};
/** The loaded picture for `key`, or null while it loads (or headless). */
export function fxImage(key) {
  let img = _img[key];
  if (img === undefined) {
    if (typeof Image === 'undefined') { _img[key] = null; return null; }
    img = _img[key] = new Image();
    img.src = `assets/fx/${key}.webp`;
  }
  return img && img.complete && img.naturalWidth ? img : null;
}

/** Start loading every picture now, so the first boss banner or title card
 *  doesn't fall back to its plain version while its art downloads. */
export function preloadFx() { for (const k of fxArt()) fxImage(k); }

// Tinted copies of a white picture (the plain butterfly), baked once per colour
// on a small canvas so drawing one costs no more than any other picture.
const _tinted = {};
export function fxTinted(key, colour) {
  const id = `${key}|${colour}`;
  if (_tinted[id] !== undefined) return _tinted[id];
  const img = fxImage(key);
  if (!img || typeof document === 'undefined') return img;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  // Multiply keeps the ink lines dark and turns the white wings the colour.
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = colour; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  _tinted[id] = c;
  return c;
}

/** Draw a picture centred on (x, y), `h` pixels tall (its width to suit). */
export function drawFx(ctx, img, x, y, h, flip = false) {
  const w = h * (img.width || img.naturalWidth) / (img.height || img.naturalHeight);
  if (flip) {
    ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
}

/**
 * A three-piece strip (the boss banner or the region plaque) `h` high and at
 * least `minW` wide, centred on (cx, cy): the two ends at their own shape and
 * the middle stretched between them. False if its pictures aren't loaded yet.
 */
export function drawStrip(ctx, kind, tone, cx, cy, minW, h) {
  const l = fxImage(`${kind}-${tone}-left`), m = fxImage(`${kind}-${tone}-middle`), r = fxImage(`${kind}-${tone}-right`);
  if (!l || !m || !r) return false;
  const k = h / l.naturalHeight;
  const lw = l.naturalWidth * k, rw = r.naturalWidth * k;
  const mw = Math.max(0, minW - lw - rw);
  const x0 = Math.round(cx - (lw + mw + rw) / 2), y0 = Math.round(cy - h / 2);
  // The middle overlaps each end by a pixel so no seam shows.
  ctx.drawImage(m, x0 + lw - 1, y0, mw + 2, h);
  ctx.drawImage(l, x0, y0, lw, h);
  ctx.drawImage(r, x0 + lw + mw, y0, rw, h);
  return true;
}
