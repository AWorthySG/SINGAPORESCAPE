// Vector sprite library — cohesive hand-drawn art for creatures and world objects,
// replacing the old emoji rendering. Everything is drawn relative to a centre
// point (cx, cy) with the entity's "feet" near cy + 13.
import { itemIconImage } from './icons.js';
import { CROPS } from '../data/trades.js';
import { drawHeroRig } from './heroRig.js';
import { drawRangedHeroRig } from './rangedHeroRig.js';

const CROP_COLORS = Object.fromEntries(CROPS.map((c) => [c[0], c[9]]));
const CROP_GROW = Object.fromEntries(CROPS.map((c) => [c[0], c[3]]));
const cropGrowTicks = (id) => CROP_GROW[id] || 0;

const OUTLINE = 'rgba(34,48,74,0.6)';   // A-Worthy navy ink

// Lazy-loaded brand logos so the real artwork can be embedded into the world
// (on the A-Worthy Monument). Guarded for headless.
const _logoCache = {};
function logoImage(name) {
  if (_logoCache[name] !== undefined) return _logoCache[name];
  if (typeof Image === 'undefined') { _logoCache[name] = null; return null; }
  const img = new Image();
  img.src = `assets/${name}.svg`;
  _logoCache[name] = img;
  return img;
}
function drawLogo(ctx, name, x, y, w, h) {
  const img = logoImage(name);
  if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, w, h);
  return !!(img && img.complete && img.naturalWidth);
}

function path(ctx, fn) { ctx.beginPath(); fn(); }
function fill(ctx, color) { ctx.fillStyle = color; ctx.fill(); }
function line(ctx, color = OUTLINE, w = 2) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Shared per-draw animation state. `stride` is a -1..1 leg-swing phase that
// bipedal draw functions read to animate a walk cycle; 0 when standing still.
const _anim = { stride: 0 };

// Run `draw` centred at (cx,cy), mirrored if facing left, with a vertical bob
// and (when moving) a leg-swing phase exposed to the draw function. Creatures
// without drawn legs pass opts.rock to get a gait-suggesting body rock instead.
function staged(ctx, cx, cy, opts, draw) {
  const t = opts.time || 0;
  let bob = opts.moving ? Math.abs(Math.sin(t * 0.018 + cx)) * 1.8 : Math.sin(t * 0.004 + cx) * 0.6;
  _anim.stride = opts.moving ? Math.sin(t * 0.018 + cx) : 0;
  const s = opts.scale || 1;
  let fx = (opts.facing && opts.facing.dx < 0) ? -1 : 1;
  const g = opts.gait;
  if (g) {
    // Step-synced: the body rises as a foot swings through and dips as it
    // lands, easing in and out as walking starts and stops.
    bob = -Math.abs(Math.sin(g.phase * Math.PI)) * 1.7 * g.move;
    // Turning round: squash through edge-on rather than snapping to the mirror image.
    if (g.turn > 0) fx *= Math.max(0.12, Math.abs(1 - 2 * g.turn)) * (g.turn > 0.5 ? -1 : 1);
  }
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(fx * s, s);
  if (opts.rock && opts.moving) ctx.rotate(Math.sin(t * 0.018 + cx) * 0.055);
  draw(ctx);
  ctx.restore();
}

// ---------------- Ground shadow ----------------
export function drawShadow(ctx, cx, cy, rx = 11, ry = 5) {
  // One soft shadow is drawn once, then stretched to each entity's size.
  const img = cachedBitmap('shadow', SHADOW_BOX, (c) => {
    const sg = c.createRadialGradient(0, 0, 0, 0, 0, 12);
    sg.addColorStop(0, 'rgba(0,0,0,0.26)'); sg.addColorStop(0.65, 'rgba(0,0,0,0.15)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sg; circle(c, 0, 0, 12); c.fill();
  });
  if (img) { ctx.drawImage(img, cx - rx, cy - ry, rx * 2, ry * 2); return; }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.26)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fill();
}

const SHADOW_BOX = { x0: -12, y0: -12, w: 24, h: 24 };

// ================= CREATURES =================
// Archetypes shipped as painted PNG art (assets/creatures/<sprite>.png). When the
// image has loaded these replace the vector archetype for every monster of that
// sprite; until then (and in headless tests) the vector drawing is used.
const CREATURE_PNGS = new Set(['crab', 'fowl', 'serpent', 'spider']);
const _creatureImg = {};
function creatureImage(sprite) {
  if (_creatureImg[sprite] !== undefined) return _creatureImg[sprite];
  if (typeof Image === 'undefined' || !CREATURE_PNGS.has(sprite)) { _creatureImg[sprite] = null; return null; }
  const img = new Image();
  img.src = `assets/creatures/${sprite}.png`;
  _creatureImg[sprite] = img;
  return img;
}
// Exposed so tests can assert the set stays in lock-step with assets/creatures/.
export const creaturePngs = () => new Set(CREATURE_PNGS);

// Painted art for individual monster species (assets/creatures/species/<family>.webp).
// Every rank of a species (Young, Wild, Feral...) and its champions share it, and
// it takes priority over the archetype art above.
const SPECIES_ART = new Set([
  'bandit', 'box_jellyfish', 'chicken', 'civet', 'forest_drake', 'fruit_bat', 'giant_crab', 'goblin',
  'hornbill', 'imp', 'jungle_spider', 'king_cobra', 'macaque', 'monitor_lizard', 'mosquito',
  'mud_crab', 'outlaw', 'pangolin', 'rat', 'reef_shark', 'saltwater_crocodile', 'sambar_deer',
  'sand_scorpion', 'sea_snake', 'sea_turtle', 'skeleton', 'smooth_otter', 'stone_golem',
  'swamp_slime', 'vampire_bat', 'wild_boar', 'wild_dog', 'will_o_wisp', 'wraith',
  'reticulated_python', 'komodo_dragon', 'river_otter',
  'scarecrow', 'storm_drake', 'bronze_warrior', 'grey_heron', 'water_buffalo', 'mudskipper', 'water_monitor',
  'carnivorous_plant', 'tarantula', 'stray_dog', 'praying_mantis', 'pink_dolphin', 'kingfisher', 'flying_fox',
  'pontianak', 'toyol', 'horseshoe_crab', 'jungle_wraith', 'hantu_raya', 'pocong', 'cursed_pirate', 'penanggal',
  'house_crow', 'field_rat', 'banded_leaf_monkey', 'sun_bear', 'clouded_leopard', 'bunian', 'dock_rat', 'rust_golem',
  'smuggler', 'drowned_sailor', 'temasek_guardian', 'ancient_naga', 'ruin_wraith', 'celestial_qilin', 'jinn', 'garuda_fledgling',
]);
const _speciesImg = {};
function speciesImage(family) {
  if (!family || !SPECIES_ART.has(family)) return null;
  if (_speciesImg[family] !== undefined) return _speciesImg[family];
  if (typeof Image === 'undefined') { _speciesImg[family] = null; return null; }
  const img = new Image();
  img.src = `assets/creatures/species/${family}.webp`;
  _speciesImg[family] = img;
  return img;
}
export const speciesArt = () => new Set(SPECIES_ART);

// Painted art for individual bosses (assets/creatures/bosses/<npcId>.webp).
// It already wears its own crown, so the drawn crown insignia is skipped.
const BOSS_ART = new Set([
  'bone_colossus', 'chilli_crab', 'demon_lord', 'durian_behemoth', 'lion_of_light', 'molten_golem',
  'orang_minyak', 'sand_scorpion_king', 'sentosa_kraken', 'shadow_sovereign', 'wilderness_warlord', 'kusu_tortoise', 'rift_tyrant', 'coney_behemoth', 'supertree_guardian', 'eternal_wyrm', 'kranji_buffalo_king',
  'merlion', 'the_garuda', 'ancient_tembusu', 'reservoir_serpent', 'boar_king', 'tualang_treant', 'night_safari_tiger',
  'tuas_crane_colossus', 'harimau_jadian', 'punggol_lantern_spirit', 'bunian_queen', 'drowned_admiral',
  'changi_phantom', 'pulau_hantu_djinn', 'singa_of_temasek', 'spirit_of_badang', 'goblin_warchief', 'spider_queen',
  'macaque_alpha', 'timah_drake', 'bedok_bandit_lord', 'mangrove_hydra', 'hungry_ghost_king',
  'bandit_kingpin', 'coral_leviathan', 'rune_golem', 'sentosa_megalodon', 'bukit_brown_revenant', 'dragon_kiln_wyrm',
  'celestial_garuda', 'jade_dragon',
]);
const _bossImg = {};
function bossImage(id) {
  if (!id || !BOSS_ART.has(id)) return null;
  if (_bossImg[id] !== undefined) return _bossImg[id];
  if (typeof Image === 'undefined') { _bossImg[id] = null; return null; }
  const img = new Image();
  img.src = `assets/creatures/bosses/${id}.webp`;
  _bossImg[id] = img;
  return img;
}
export const bossArt = () => new Set(BOSS_ART);

// Painted art for townsfolk roles (assets/creatures/townsfolk/<npcId>.webp),
// used in place of the drawn mascot + prop when present.
const TOWN_ART = new Set([
  'banker', 'fletcher', 'guide', 'hawker', 'light_priestess', 'mage', 'shopkeeper', 'slayer_master',
  'skills_tutor', 'shadow_broker', 'farmer', 'villager',
]);
const _townImg = {};
function townImage(id) {
  if (!id || !TOWN_ART.has(id)) return null;
  if (_townImg[id] !== undefined) return _townImg[id];
  if (typeof Image === 'undefined') { _townImg[id] = null; return null; }
  const img = new Image();
  img.src = `assets/creatures/townsfolk/${id}.webp`;
  _townImg[id] = img;
  return img;
}
export const townArt = () => new Set(TOWN_ART);
// ---------------- Creature animation ----------------
// The painted monsters and bosses are single pictures, so they are brought to
// life by moving and stretching the whole sticker about its feet (y = 13).
const FLOATERS = new Set(['ghost', 'wisp', 'bat', 'jellyfish', 'insect']);
const FEET = 13;
function creaturePose(c, opts, t, seed) {
  const ph = seed * 0.37;                       // every creature on its own rhythm
  const ak = opts.attackK ?? -1;
  let dx = 0, dy = 0, rot = 0, sx = 1, sy = 1;
  if (FLOATERS.has(opts.sprite)) dy -= 2 + Math.sin(t * 0.0032 + ph) * 2.2;   // ghosts and fliers hover
  if (ak >= 0) {
    // Wind up (lean back and crouch), lunge into the strike, then recover.
    const e = (x) => 1 - (1 - x) * (1 - x);
    if (ak < 0.35) { const k = e(ak / 0.35); dx = -2.5 * k; rot = -0.09 * k; sy = 1 - 0.1 * k; sx = 1 + 0.06 * k; }
    else if (ak < 0.6) { const k = Math.sin(((ak - 0.35) / 0.25) * Math.PI / 2); dx = -2.5 + 8 * k; rot = -0.09 + 0.2 * k; sy = 0.9 + 0.24 * k; sx = 1.06 - 0.14 * k; }
    else { const k = e((ak - 0.6) / 0.4); dx = 5.5 * (1 - k); rot = 0.11 * (1 - k); sy = 1.14 - 0.14 * k; sx = 0.92 + 0.08 * k; }
  } else if (opts.moving) {
    // A springy hop: squash as the feet land, stretch at the top of the stride.
    const st = Math.sin(t * 0.018 + seed);
    sy = 1 + Math.abs(st) * 0.06 - 0.03; sx = 2 - sy;
  } else {
    // Idle breathing.
    const br = Math.sin(t * 0.0028 + ph);
    sy = 1 + br * 0.035; sx = 1 - br * 0.018;
  }
  if (opts.windup) dx += Math.sin(t * 0.09) * 0.9;                 // trembling as a heavy blow charges
  if (opts.hurt > 0) {   // flinch when struck: a shudder and a stagger back
    const hk = Math.min(1, opts.hurt / 200);
    dx += Math.sin(t * 0.11) * hk * 2.6 - hk * 1.5; rot -= hk * 0.08;
  }
  if (opts.castK > 0) { const k = Math.sin(opts.castK * Math.PI); sy *= 1 + k * 0.12; sx *= 1 + k * 0.08; }
  c.translate(dx, dy + FEET); c.rotate(rot); c.scale(sx, sy); c.translate(0, -FEET);
}
// A boss's signature move: a burst of its ability colour from the ground up.
function castBurst(c, k, col) {
  const a = Math.sin(k * Math.PI);
  c.save();
  c.globalCompositeOperation = 'lighter';
  const r = 10 + (1 - k) * 22;
  const g = c.createRadialGradient(0, -6, 0, 0, -6, r);
  g.addColorStop(0, rgba(col, 0.55 * a)); g.addColorStop(0.6, rgba(col, 0.25 * a)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; circle(c, 0, -6, r); c.fill();
  c.strokeStyle = rgba(col, 0.8 * a); c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, FEET, 8 + (1 - k) * 18, (8 + (1 - k) * 18) * 0.35, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
}
// A flat-colour copy of a sticker's silhouette, for hit and charge flashes.
const _tints = new Map();
function monsterTint(sticker, col) {
  const key = sticker;
  let m = _tints.get(key);
  if (!m) { m = {}; _tints.set(key, m); }
  if (m[col]) return m[col];
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = sticker.width; cv.height = sticker.height;
  const g = cv.getContext('2d'); if (!g) return null;
  g.drawImage(sticker, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height);
  m[col] = cv;
  return cv;
}

// ---------------- Rigged bosses ----------------
// A few showpiece bosses are cut into layers (assets/creatures/bosses/rig/<id>_<part>.webp,
// all on one shared 320px canvas) so their parts move on their own. `piv` is each
// part's joint as a fraction of the canvas; `swing(t, o)` gives its angle in radians.
const ease = (x) => 1 - (1 - x) * (1 - x);
const atkPhase = (ak) => (ak < 0 ? null : ak < 0.35 ? { wind: ease(ak / 0.35), hit: 0 } : ak < 0.6 ? { wind: 1 - (ak - 0.35) / 0.25, hit: Math.sin(((ak - 0.35) / 0.25) * Math.PI / 2) } : { wind: 0, hit: 1 - ease((ak - 0.6) / 0.4) });
// Walking legs for four-legged species rigs: diagonal pairs swing together
// (near-front with far-back), still when standing.
const leg = (pair, amp = 0.42) => (t, o) => (o.moving ? Math.sin(t * 0.022 + (pair ? Math.PI : 0)) * amp : Math.sin(t * 0.003 + pair) * 0.03);
const RIGS = {
  // Monster species with moving parts (assets/creatures/species/rig/<family>_<part>.webp).
  rat: {
    kind: 'species', fit: 0.86,
    order: ['tail', 'back_far', 'front_far', 'body', 'back_near', 'front_near', 'head'],
    parts: {
      tail: { piv: [0.1938, 0.6502], swing: (t, o) => Math.sin(t * (o.moving ? 0.012 : 0.005)) * (o.moving ? 0.16 : 0.1) },
      back_far: { piv: [0.3322, 0.4148], swing: leg(1) },
      front_far: { piv: [0.609, 0.6054], swing: leg(0) },
      back_near: { piv: [0.361, 0.426], swing: leg(0) },
      front_near: { piv: [0.6378, 0.6166], swing: leg(1) },
      head: { piv: [0.6436, 0.5538], swing: (t, o) => {
        const a = atkPhase(o.attackK ?? -1);
        return a ? 0.12 * a.wind - 0.16 * a.hit : Math.sin(t * (o.moving ? 0.022 : 0.004)) * (o.moving ? 0.05 : 0.035);   // a sniffing nod; a snap forward to bite
      } },
    },
  },
  eternal_wyrm: {
    order: ['tail', 'base', 'claw', 'head'],
    parts: {
      tail: { piv: [0.2587, 0.7345], swing: (t, o) => Math.sin(t * (o.moving ? 0.009 : 0.0045)) * 0.12 },
      claw: { piv: [0.7627, 0.6865], swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return a ? -0.14 * a.wind + 0.12 * a.hit : Math.sin(t * 0.0035 + 1) * 0.05; } },
      head: { piv: [0.6188, 0.5185], swing: (t, o) => {
        const a = atkPhase(o.attackK ?? -1);
        const roar = o.castK > 0 ? -0.06 * Math.sin(o.castK * Math.PI) : 0;   // rears up to roar on its signature move
        return (a ? -0.06 * a.wind + 0.07 * a.hit : Math.sin(t * 0.0021) * 0.035) + roar;
      } },
    },
  },
};
const _rigImg = {};
function rigLayers(id) {
  const rig = RIGS[id];
  if (!rig || typeof Image === 'undefined') return null;
  const dir = rig.kind === 'species' ? 'species' : 'bosses';
  const imgs = _rigImg[id] || (_rigImg[id] = Object.fromEntries(rig.order.map((n) => {
    const img = new Image(); img.src = `assets/creatures/${dir}/rig/${id}_${n}.webp`; return [n, img];
  })));
  return rig.order.every((n) => imgs[n].complete && imgs[n].naturalWidth) ? imgs : null;
}
export const rigIds = () => Object.keys(RIGS);
export const rigParts = (id) => RIGS[id] && [...RIGS[id].order];
export const rigKind = (id) => RIGS[id] && (RIGS[id].kind || 'boss');
let _rigCv = null, _rigTint = null, _spCv = null, _spTint = null;
const RIG_RES = 6;   // one showpiece boss at a time, so it can afford a sharper canvas than the cached stickers
const SPECIES_RIG_RES = 3;   // a pack of monsters can be on screen at once, so theirs is lighter
// Compose the layers (posed for this frame) into one canvas, then blit it.
function drawRig(c, id, imgs, opts, t, flash, flashCol) {
  const rig = RIGS[id];
  const base = imgs[rig.order[0]];   // every layer shares one canvas size
  const s = Math.min(34 / base.naturalHeight, 64 / base.naturalWidth) * (rig.fit || 1);
  const w = base.naturalWidth * s, h = base.naturalHeight * s, x0 = -w / 2, y0 = 13.5 - h;
  const species = rig.kind === 'species', res = species ? SPECIES_RIG_RES : RIG_RES;
  let cv = species ? _spCv : _rigCv;
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = ST_W * res; cv.height = ST_H * res;
    if (species) _spCv = cv; else _rigCv = cv;
  }
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  g.setTransform(res, 0, 0, res, -ST_X0 * res, -ST_Y0 * res);
  for (const n of rig.order) {
    const part = rig.parts[n];
    g.save();
    if (part) {
      const px = x0 + part.piv[0] * w, py = y0 + part.piv[1] * h;
      g.translate(px, py); g.rotate(part.swing(t, opts)); g.translate(-px, -py);
    }
    g.drawImage(imgs[n], x0, y0, w, h);
    g.restore();
  }
  // A tinted copy of this frame: the hit flash, and for species the white
  // sticker border (the parts come without one, so it's traced round the whole animal).
  const tinted = (col) => {
    let tc = species ? _spTint : _rigTint;
    if (!tc) {
      tc = document.createElement('canvas'); tc.width = cv.width; tc.height = cv.height;
      if (species) _spTint = tc; else _rigTint = tc;
    }
    const tg = tc.getContext('2d');
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, tc.width, tc.height);
    tg.drawImage(cv, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, tc.width, tc.height);
    return tc;
  };
  if (species) {
    const rim = tinted('#ffffff'), d = 1.3;
    for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d * 0.7, d * 0.7], [-d * 0.7, d * 0.7], [d * 0.7, -d * 0.7], [-d * 0.7, -d * 0.7]]) {
      c.drawImage(rim, ST_X0 + dx, ST_Y0 + dy, ST_W, ST_H);
    }
  }
  c.drawImage(cv, ST_X0, ST_Y0, ST_W, ST_H);
  if (flash > 0.01) { c.globalAlpha = flash; c.drawImage(tinted(flashCol), ST_X0, ST_Y0, ST_W, ST_H); c.globalAlpha = 1; }
}

// Draw a painted creature sprite centred horizontally with its feet on the tile.
function drawCreaturePng(c, img) {
  // Fit within 34 units tall and 64 wide (long bodies like crocodiles stay in their sticker box).
  const s = Math.min(34 / img.naturalHeight, 64 / img.naturalWidth);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  c.drawImage(img, -w / 2, 13.5 - h, w, h);
}

// ---------------- Monster stickers ----------------
// Monsters get the A-Worthy sticker treatment: the body is drawn once into an
// offscreen canvas, then traced with a navy ink line inside a white die-cut
// border (stamping its silhouette in a ring), and the finished sticker is
// cached per sprite/colour/stride pose so a frame costs a single drawImage.
const ST_X0 = -40, ST_Y0 = -50, ST_W = 80, ST_H = 76;   // local box monster art fits in
const ST_RES = 2;                                       // offscreen pixels per local unit
const ST_INK = '#22304A';
const MONSTER_BOX = { x0: ST_X0, y0: ST_Y0, w: ST_W, h: ST_H, ink: 1.3, cut: 3.2 };
const ITEM_BOX = { x0: -14, y0: -14, w: 28, h: 28, ink: 0.8, cut: 1.9 };
const _stickers = new Map();
const _stScratch = {};
function stCanvas(box) {
  const cv = document.createElement('canvas');
  cv.width = box.w * ST_RES; cv.height = box.h * ST_RES;
  return cv;
}
function stRing(dst, src, r) {
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    dst.drawImage(src, Math.cos(a) * r * ST_RES, Math.sin(a) * r * ST_RES);
  }
}
// Bake `drawBody` (drawn in local units inside `box`) into a sticker: navy ink
// line inside a white die-cut border. Returns an ImageBitmap/canvas to draw at
// (box.x0, box.y0, box.w, box.h), or null without a DOM.
function bakeSticker(key, box, drawBody) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const hit = _stickers.get(key);
  if (hit) { _stickers.delete(key); _stickers.set(key, hit); return hit.img; }   // LRU touch
  const sk = `${box.w}x${box.h}`;
  if (!_stScratch[sk]) _stScratch[sk] = { art: stCanvas(box), ink: stCanvas(box), white: stCanvas(box) };
  const { art, ink, white } = _stScratch[sk];
  const a = art.getContext('2d');
  if (!a) return null;
  a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, art.width, art.height);
  a.setTransform(ST_RES, 0, 0, ST_RES, -box.x0 * ST_RES, -box.y0 * ST_RES);
  drawBody(a);
  a.setTransform(1, 0, 0, 1, 0, 0);
  for (const [cv, colr] of [[ink, ST_INK], [white, '#FFFFFF']]) {
    const g = cv.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(art, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = colr; g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'source-over';
  }
  const out = stCanvas(box);
  const o = out.getContext('2d');
  stRing(o, white, box.cut);   // white die-cut border
  stRing(o, ink, box.ink);     // navy ink line
  o.drawImage(art, 0, 0);
  // Canvas-to-canvas draws are slow on many GPUs/phones; an ImageBitmap is
  // uploaded once and then blits cheaply every frame. Use the canvas until
  // the bitmap resolves.
  const entry = { img: out };
  if (typeof createImageBitmap === 'function') {
    createImageBitmap(out).then((bm) => { entry.img = bm; }).catch(() => {});
  }
  _stickers.set(key, entry);
  if (_stickers.size > 700) {
    const old = _stickers.keys().next().value;
    const e = _stickers.get(old); if (e && e.img && e.img.close) e.img.close();
    _stickers.delete(old);
  }
  return entry.img;
}
const monsterSticker = (key, drawBody) => bakeSticker(key, MONSTER_BOX, drawBody);

// ---- Automatic animation for painted monsters ----
// Species without a hand-made parts rig still move: their sticker is drawn in
// strips that shift with the body type. Walkers step their feet in turn (the
// bottom band split at the gap between front and back legs), crawlers scuttle,
// fliers flap the top of the picture, snakes slither and fish swish in a
// travelling wave, ghosts ripple, slimes wobble and plants sway. The look is
// untouched: it's the same painted sticker, just in pieces.
const PUPPET_KIND = {
  beast: 'legs', hound: 'legs', primate: 'legs', rodent: 'legs', reptile: 'legs', humanoid: 'legs', greenman: 'legs',
  undead: 'legs', golem: 'legs', demon: 'legs', turtle: 'legs', mantis: 'legs', fowl: 'legs',
  spider: 'scuttle', crab: 'scuttle', scorpion: 'scuttle',
  bat: 'wings', drake: 'wings', insect: 'wings',
  serpent: 'slither', seacreature: 'swim',
  ghost: 'float', wisp: 'float', jellyfish: 'float',
  slime: 'squish', plant: 'sway',
};
// Walkers whose head sits on top (people, goblins, skeletons, golems, demons,
// birds, mantises) rather than out in front; and those with a tail to swish.
const HEAD_TOP = new Set(['humanoid', 'greenman', 'undead', 'golem', 'demon', 'fowl', 'mantis', 'primate']);
const TAILED = new Set(['beast', 'hound', 'rodent', 'reptile']);
export const puppetKinds = () => ({ ...PUPPET_KIND });
const _puppetInfo = new Map();
/** The painted area of a sticker (in its bitmap's pixels) and where its feet
 *  divide front from back. Measured once per look. */
function puppetInfo(key, sticker) {
  if (_puppetInfo.has(key)) return _puppetInfo.get(key);
  let inf = null;
  try {
    const W = ST_W * ST_RES, H = ST_H * ST_RES;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(sticker, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 > x0 && y1 > y0) {
      const cut = Math.round(y1 - (y1 - y0) * 0.24);
      const cols = new Float64Array(W);
      for (let y = cut; y <= y1; y++) for (let x = x0; x <= x1; x++) cols[x] += d[(y * W + x) * 4 + 3];
      let split = (x0 + x1) >> 1, best = Infinity;
      for (let x = Math.round(x0 + (x1 - x0) * 0.3); x < Math.round(x0 + (x1 - x0) * 0.7); x++) if (cols[x] < best) { best = cols[x]; split = x; }
      // The actual legs: runs of filled columns along the very bottom (the feet),
      // with small gaps closed and slivers dropped.
      const foot = Math.round(y1 - (y1 - y0) * 0.1), fc = new Float64Array(W);
      for (let y = foot; y <= y1; y++) for (let x = x0; x <= x1; x++) if (d[(y * W + x) * 4 + 3] > 120) fc[x]++;
      const runs = [];
      for (let x = x0; x <= x1; x++) {
        if (fc[x] < 2) continue;
        const last = runs[runs.length - 1];
        if (last && x - last[1] <= 3) last[1] = x; else runs.push([x, x]);
      }
      const minW = (x1 - x0) * 0.04;
      const legs = runs.filter(([a, b]) => b - a >= minW);
      inf = { x0, y0, x1: x1 + 1, y1: y1 + 1, cut, split, legs: legs.length >= 2 && legs.length <= 6 ? legs : null };
    }
  } catch { inf = null; }
  _puppetInfo.set(key, inf);
  return inf;
}
// Moving pieces (head, tail, claws) are copied once into their own small
// canvases. Drawing a sub-rectangle of the sticker directly, then nudging it,
// let the smoothing pick up neighbouring pixels and left hairline seams.
const _pieces = new WeakMap();
function piece(src, x, y, w, h) {
  let m = _pieces.get(src);
  if (!m) { m = new Map(); _pieces.set(src, m); }
  const k = `${x},${y},${w},${h}`;
  let cv = m.get(k);
  if (cv === undefined) {
    try {
      cv = document.createElement('canvas'); cv.width = w + 4; cv.height = h + 4;
      cv.getContext('2d').drawImage(src, x, y, w, h, 2, 2, w, h);
    } catch { cv = null; }
    m.set(k, cv);
  }
  return cv;
}
function drawPuppet(c, src, kind, inf, opts, t, seed) {
  const R = ST_RES;
  // A moving piece, from its own canvas (see piece()).
  const mover = (sx, sy, sw, sh, dx = 0, dy = 0) => {
    if (sw <= 0 || sh <= 0) return;
    const cv = piece(src, sx, sy, sw, sh);
    if (!cv) return blit(sx, sy, sw, sh, dx, dy);
    c.drawImage(cv, ST_X0 + (sx - 2) / R + dx, ST_Y0 + (sy - 2) / R + dy, (sw + 4) / R, (sh + 4) / R);
  };
  // Copy a pixel rectangle of the sticker to where it normally sits, nudged by (dx, dy) local units.
  const blit = (sx, sy, sw, sh, dx = 0, dy = 0) => {
    if (sw <= 0 || sh <= 0) return;
    c.drawImage(src, sx, sy, sw, sh, ST_X0 + sx / R + dx, ST_Y0 + sy / R + dy, sw / R, sh / R);
  };
  const { x0, y0, x1, y1, cut, split } = inf;
  const m = opts.move ?? (opts.moving ? 1 : 0);
  const p = (opts.walk ?? 0) % 2;           // one footstep per tile walked (opts.gait is the hero's)
  const ph = seed * 0.37;
  if (kind === 'legs') {
    const sw = Math.sin(p * Math.PI);
    const step = (ph2) => { const v = ph2 ? -sw : sw; return { lift: Math.max(0, v) * m, fwd: v * m }; };
    // Feet: each detected leg steps, diagonal pairs together (back-far with front-near);
    // the belly between them stays put. Without clear legs, front and back halves step.
    const legs = inf.legs;
    if (legs) {
      const n = legs.length, pad = 2;
      let at = x0;
      legs.forEach(([a, b], i) => {
        const la = Math.max(at, a - pad), lb = Math.min(x1, b + pad + 1);
        blit(at, cut, la - at, y1 - cut);                       // the stretch before this leg
        const phase = n === 2 ? i : (i < n / 2 ? i % 2 : 1 - (i % 2));
        const s2 = step(phase);
        blit(la, cut, lb - la, y1 - cut, s2.fwd * 1.1, -s2.lift * 2.4);
        at = lb;
      });
      blit(at, cut, x1 - at, y1 - cut);
    } else {
      const back = Math.max(0, sw) * m, front = Math.max(0, -sw) * m;
      blit(x0, cut, split - x0, y1 - cut, (back - front) * 1.2, -back * 2.4);
      blit(split, cut, x1 - split, y1 - cut, (front - back) * 1.2, -front * 2.4);
    }
    // Body, with the head and tail cut out so they can move on their own.
    const top = HEAD_TOP.has(opts.sprite);
    const bw = x1 - x0, bh = cut - y0;
    const head = top
      ? { x: Math.round(x0 + bw * 0.28), y: y0, w: Math.round(bw * 0.44), h: Math.round(bh * 0.42) }
      : { x: Math.round(x0 + bw * 0.66), y: y0, w: x1 - Math.round(x0 + bw * 0.66), h: Math.round(bh * 0.72) };
    const tail = TAILED.has(opts.sprite) ? { x: x0, y: Math.round(y0 + bh * 0.1), w: Math.round(bw * 0.2), h: Math.round(bh * 0.75) } : null;
    // The whole body goes down first and the head and tail are redrawn on top,
    // nudged. Cutting holes for them instead left hairline seams where the
    // edges were smoothed; small nudges over the full body leave none.
    blit(x0, y0, bw, bh + 1);
    if (tail) {
      const sway = Math.sin(t * (m > 0.3 ? 0.012 : 0.004) + ph) * (m > 0.3 ? 1.1 : 0.6);
      mover(tail.x, tail.y, tail.w, tail.h, -Math.abs(sway) * 0.3, sway);
    }
    // Head: nods with each step, glances about when idle, lunges forward to bite.
    const a = atkPhase(opts.attackK ?? -1);
    const idleLook = Math.sin(t * 0.0011 + ph) > 0.55 ? Math.sin(t * 0.004 + ph) * 0.7 : 0;
    let hx = idleLook * (1 - m), hy = -Math.abs(sw) * 1.1 * m + Math.sin(t * 0.0026 + ph) * 0.35 * (1 - m);
    if (a) { hx += (top ? 0.8 : 2.4) * a.hit - 0.9 * a.wind; hy += 0.9 * a.wind - 0.6 * a.hit; }
    mover(head.x, head.y, head.w, head.h, hx, hy);
  } else if (kind === 'scuttle') {
    const c2 = Math.round(y1 - (y1 - y0) * 0.32), n = 4, w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const lift = m * Math.max(0, Math.sin(p * Math.PI * 2 + i * Math.PI / 2)) * 2;
      blit(Math.floor(x0 + i * w), c2, Math.ceil(w) + 1, y1 - c2, 0, -lift);
    }
    // The front third (claws, fangs) rears up and snaps down on an attack.
    const a = atkPhase(opts.attackK ?? -1);
    const fx = Math.round(x0 + (x1 - x0) * 0.66);
    blit(x0, y0, fx - x0 + 5, c2 - y0 + 1);   // a little past the joint, so no gap opens
    mover(fx, y0, x1 - fx, c2 - y0 + 1, a ? 1.6 * a.hit : 0, a ? -2 * a.wind + 1 * a.hit : Math.sin(t * 0.003 + ph) * 0.3);
  } else if (kind === 'wings') {
    // The top of the picture (the wings) stretches up and down about the back.
    const spd = opts.sprite === 'insect' ? 0.05 : opts.sprite === 'bat' ? 0.02 : (m > 0.3 ? 0.012 : 0.006);
    const hb = Math.round((y1 - y0) * 0.45), yb = y0 + hb;
    blit(x0, yb, x1 - x0, y1 - yb);
    const sy = 1 + Math.sin(t * spd + ph) * 0.2;
    c.drawImage(src, x0, y0, x1 - x0, hb, ST_X0 + x0 / R, ST_Y0 + yb / R - (hb / R) * sy, (x1 - x0) / R, (hb / R) * sy);
  } else if (kind === 'slither' || kind === 'swim') {
    // A wave travels head to tail (the tail end, on the left, swings most when swimming).
    // Snakes get finer strips and a gentler wave, so their outline stays smooth.
    const sn = kind === 'slither', n = sn ? 16 : 10, w = (x1 - x0) / n, spd = m > 0.3 ? 0.012 : 0.005;
    const amp = (m > 0.3 ? 1.6 : 0.9) * (sn ? 0.75 : 1);
    for (let i = 0; i < n; i++) {
      const k = kind === 'swim' ? 1 - i / n : 1;
      blit(Math.floor(x0 + i * w), y0, Math.ceil(w) + 1, y1 - y0, 0, Math.sin(t * spd + ph - i * (sn ? 0.47 : 0.75)) * amp * k);
    }
  } else if (kind === 'float' || kind === 'sway') {
    // Horizontal ripples: ghosts trail more at the bottom, plants sway more at the top.
    const n = 10, h = (y1 - y0) / n;
    for (let j = 0; j < n; j++) {
      const dx = kind === 'float'
        ? Math.sin(t * 0.005 + ph - j * 0.6) * 1.5 * Math.pow(j / n, 1.2)
        : Math.sin(t * 0.0025 + ph) * 1.6 * (1 - j / n) + Math.sin(t * 0.006 + ph - j * 0.5) * 0.3;
      blit(x0, Math.floor(y0 + j * h), x1 - x0, Math.ceil(h) + 1, dx, 0);
    }
  } else if (kind === 'squish') {
    const k = Math.sin(t * 0.006 + ph) * 0.06;
    c.save(); c.translate(0, FEET); c.scale(1 + k, 1 - k); c.translate(0, -FEET);
    c.drawImage(src, ST_X0, ST_Y0, ST_W, ST_H);
    c.restore();
  } else c.drawImage(src, ST_X0, ST_Y0, ST_W, ST_H);
}

// Plain bitmap cache: draw vector art once into an offscreen canvas (local
// units inside `box`), then blit it every frame instead of re-tracing every
// path. Used for townsfolk, the hero's body, trees and static scenery.
// Returns null without a DOM (headless tests), so callers draw directly.
const BMP_RES = 2;
const _bitmaps = new Map();
function cachedBitmap(key, box, draw) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const hit = _bitmaps.get(key);
  if (hit) return hit.img;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(box.w * BMP_RES); cv.height = Math.ceil(box.h * BMP_RES);
  const g = cv.getContext('2d');
  if (!g) return null;
  g.setTransform(BMP_RES, 0, 0, BMP_RES, -box.x0 * BMP_RES, -box.y0 * BMP_RES);
  draw(g);
  const entry = { img: cv };
  if (typeof createImageBitmap === 'function') createImageBitmap(cv).then((bm) => { entry.img = bm; }).catch(() => {});
  _bitmaps.set(key, entry);
  if (_bitmaps.size > 500) {
    const old = _bitmaps.keys().next().value;
    const e = _bitmaps.get(old); if (e && e.img && e.img.close) e.img.close();
    _bitmaps.delete(old);
  }
  return entry.img;
}
// Measured extents (plus a margin) of the cached art.
const MASCOT_BOX = { x0: -19, y0: -34, w: 38, h: 54 };
const TOWN_ART_H = 40, TOWN_ART_FEET = 15;
const OBJ_BOX = { x0: -33, y0: -45, w: 66, h: 68 };
// Walk poses are snapped to 5 steps so a handful of bitmaps covers the cycle.
const strideKey = () => (Math.round(_anim.stride * 2) / 2);
function drawCached(ctx, key, box, draw) {
  const img = cachedBitmap(key, box, draw);
  if (img) ctx.drawImage(img, box.x0, box.y0, box.w, box.h);
  else draw(ctx);
}

// Monsters render via colour-tinted archetypes (def.sprite + def.color). Townsfolk
// keep bespoke human palettes. Bosses get an aura + crown and are scaled by the caller.
export function drawCreature(ctx, npcId, cx, cy, opts = {}) {
  const arch = opts.sprite && ARCH[opts.sprite];
  if (arch) {
    const bimg = opts.boss ? bossImage(npcId) : null;
    const simg = bimg || speciesImage(opts.family);
    const pimg = simg || creatureImage(opts.sprite);
    const col = opts.color || '#8a8a8a';
    opts.rock = true; // monsters rock side-to-side as they move (a gait cue)
    return staged(ctx, cx, cy, opts, (c) => {
      if (opts.boss) bossAura(c, opts.time || 0, col);
      const t = opts.time || 0;
      if (opts.castK > 0) castBurst(c, opts.castK, opts.castCol || col);
      creaturePose(c, opts, t, cx);
      const flash = Math.max(Math.min(1, (opts.hurt || 0) / 200) * 0.55, opts.windup ? 0.18 + Math.sin(t * 0.03) * 0.12 : 0);
      const flashCol = opts.windup && !(opts.hurt > 0) ? '#ff5040' : '#ffffff';
      // A showpiece boss with moving parts, or a species whose parts sheet is in.
      const rigId = opts.boss ? (RIGS[npcId] ? npcId : null) : (RIGS[opts.family]?.kind === 'species' ? opts.family : null);
      const rig = rigId ? rigLayers(rigId) : null;
      if (rig) { drawRig(c, rigId, rig, opts, t, flash, flashCol); return; }
      const drawBody = (g) => {
        if (pimg && pimg.complete && pimg.naturalWidth) {
          drawCreaturePng(g, pimg);    // painted art carries its own shading
        } else {
          arch(g, col);
          // Soft upper sheen for volume, kept on the body (source-atop) so it
          // never leaks past the silhouette the sticker border is traced from.
          const sg = g.createRadialGradient(-3, -5, 0, -3, -5, 10);
          sg.addColorStop(0, 'rgba(255,255,255,0.16)');
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          g.globalCompositeOperation = 'source-atop';
          g.fillStyle = sg; circle(g, -3, -5, 10); g.fill();
          g.globalCompositeOperation = 'source-over';
        }
      };
      const ready = !pimg || (pimg.complete && pimg.naturalWidth);
      // Only the turtle's legs follow the stride; every other body is one pose.
      const pose = opts.sprite === 'turtle' ? Math.round(_anim.stride * 2) : 0;
      const look = bimg ? `boss:${npcId}` : simg ? `species:${opts.family}` : `${opts.sprite}|${col}|${pimg ? 'p' : 'v'}`;
      const sticker = ready ? monsterSticker(`${look}|${pose}`, drawBody) : null;
      if (sticker) {
        // Painted monsters animate in pieces (see drawPuppet); the rest draw whole.
        const kind = (bimg || simg) && !opts.still ? PUPPET_KIND[opts.sprite] : null;
        const inf = kind ? puppetInfo(`${look}|${pose}`, sticker) : null;
        const put = (img) => (inf ? drawPuppet(c, img, kind, inf, opts, t, cx) : c.drawImage(img, ST_X0, ST_Y0, ST_W, ST_H));
        put(sticker);
        // A white flash over the body when struck, a red pulse while a heavy blow charges.
        if (flash > 0.01) {
          const tint = monsterTint(sticker, flashCol);
          if (tint) { c.globalAlpha = flash; put(tint); c.globalAlpha = 1; }
        }
      } else drawBody(c);              // headless (no DOM canvas) or art still loading
      if (opts.boss && !bimg) bossCrown(c, opts.time || 0);  // insignia unless the boss art has its own crown
    });
  }
  // Townsfolk are all A-Worthy mascots; shirts come from the design system's
  // marker pops and subject accents so each role reads at a glance.
  const TOWN = {
    banker: { top: '#1F6FA8', apron: '#E6F1FB', acc: 'coins' },
    shopkeeper: { top: '#D2691E', apron: '#FDEEE0', acc: 'sack' },
    hawker: { top: '#E05040', hat: '#FFFFFF', apron: '#FFFFFF', acc: 'ladle' },
    guide: { top: '#3DAA5C', hat: '#8A6205', acc: 'map' },
    mage: { top: '#9B52AD', hat: '#6A3678', acc: 'stars' },
    fletcher: { top: '#6E8B1E', hat: '#52690F', acc: 'bow' },
    slayer_master: { top: '#2B2A27', apron: '#962D22', acc: 'scar' },
    skills_tutor: { top: '#F5B82E', hat: '#8A6205', apron: '#FDF3DE', acc: 'scroll' },
    light_priestess: { top: '#FDF3DE', hat: '#F5B82E', apron: '#FFFFFF', acc: 'halo' },
    shadow_broker: { top: '#2B2A27', hat: '#1C1B19', acc: 'hood' },
    villager: { top: '#12907F' },
    farmer: { top: '#5A8A3A', hat: '#E0C070', apron: '#C8A070', acc: 'sack' },
  };
  const p = TOWN[npcId] || TOWN.villager;
  const timg = townImage(npcId);
  if (timg && timg.complete && timg.naturalWidth) {
    return staged(ctx, cx, cy, opts, (c) => {
      // Same footprint as the drawn mascot: feet on the tile, about mascot height.
      const s = Math.min(TOWN_ART_H / timg.naturalHeight, MASCOT_BOX.w / timg.naturalWidth);
      const w = timg.naturalWidth * s, h = timg.naturalHeight * s;
      c.drawImage(timg, -w / 2, TOWN_ART_FEET - h, w, h);
    });
  }
  return staged(ctx, cx, cy, opts, (c) => {
    const q = strideKey();
    const was = _anim.stride; _anim.stride = q;
    drawCached(c, `town|${TOWN[npcId] ? npcId : 'villager'}|${q}`, MASCOT_BOX, (g) => human(g, p));
    _anim.stride = was;
  });
}

// Tint helper: k in [-1,1] darkens/lightens a #rrggbb colour.
function shade(hex, k) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { const f = 1 + k; r *= f; g *= f; b *= f; }
  else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// Colour (hex or rgb()) to an rgba() string at alpha a.
function rgba(c, a) {
  if (typeof c === 'string' && c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  if (typeof c === 'string' && c.startsWith('rgb(')) return c.replace('rgb(', 'rgba(').replace(')', `,${a})`);
  return c;
}

// Linear blend of two #rrggbb colours; t=0 -> a, t=1 -> b. Falls back to a.
function mix(a, b, t) {
  if (typeof a !== 'string' || a[0] !== '#' || typeof b !== 'string' || b[0] !== '#') return a;
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t;
  const g = ((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t;
  const bl = (pa & 255) + ((pb & 255) - (pa & 255)) * t;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}

// A lively eye: white sclera, dark pupil, tiny catchlight.
function eyeW(ctx, x, y, r = 1.6, pupil = '#15110b') {
  ctx.fillStyle = '#f8f6ee'; circle(ctx, x, y, r); ctx.fill();
  ctx.fillStyle = pupil; circle(ctx, x + 0.25, y + 0.1, r * 0.56); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; circle(ctx, x - r * 0.32, y - r * 0.34, r * 0.26); ctx.fill();
}
// A short fang/claw triangle.
function fang(ctx, x, y, w, h, color = '#f4efe0') {
  ctx.fillStyle = color; path(ctx, () => { ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); }); ctx.fill();
}

// ---- shared detail helpers (used by the archetype detail pass) ----
// A soft top rim-light arc traced over a body ellipse, for volume.
function rimLight(ctx, x, y, rx, ry, col, k = 0.42) {
  ctx.save();
  ctx.strokeStyle = shade(col, k); ctx.lineWidth = 1.1; ctx.globalAlpha = 0.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx - 0.7), Math.max(0.5, ry - 0.7), 0, Math.PI * 1.1, Math.PI * 1.95); ctx.stroke();
  ctx.restore();
}
// Scattered darker dapples/markings: pts = [[x,y,r],...].
function speckle(ctx, col, pts, k = -0.17) {
  ctx.fillStyle = shade(col, k);
  for (const [x, y, r] of pts) { circle(ctx, x, y, r); ctx.fill(); }
}
// Short fur/scale ticks: segs = [[x1,y1,x2,y2],...].
function ticks(ctx, col, segs, k = -0.22, w = 0.7) {
  ctx.strokeStyle = shade(col, k); ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); } ctx.stroke();
  ctx.lineCap = 'butt';
}

function bossAura(ctx, time = 0, col = '#ff5a46') {
  const pulse = 1 + Math.sin(time * 0.004) * 0.12;
  // heavy dark contact shadow for weight
  ctx.fillStyle = 'rgba(28,0,0,0.26)'; ellipse(ctx, 0, 13, 16.5, 5.6); ctx.fill();
  // a slowly-rotating summoning glyph ring on the ground, tinted by the boss
  const drawRing = (c) => {
    c.strokeStyle = rgba(shade(col, 0.4), 0.5); c.lineWidth = 1.3;
    c.beginPath(); c.arc(0, 0, 15.5, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2.2;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 13, Math.sin(a) * 13); c.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); c.stroke(); }
  };
  ctx.save();
  ctx.translate(0, 12.5); ctx.scale(1, 0.34); ctx.rotate((time * 0.0005) % (Math.PI * 2));
  drawCached(ctx, `aura-ring|${col}`, AURA_RING_BOX, drawRing);
  ctx.restore();
  // colour-tinted menacing glow (icy, fiery, necrotic… per the boss palette),
  // drawn once per colour and scaled with the pulse
  const drawGlow = (c) => {
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, rgba(shade(col, 0.45), 0.36));
    g.addColorStop(0.55, rgba(col, 0.20));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; circle(c, 0, 0, 30); c.fill();
  };
  const glow = cachedBitmap(`aura-glow|${col}`, AURA_GLOW_BOX, drawGlow);
  if (glow) ctx.drawImage(glow, -30 * pulse, -2 - 30 * pulse, 60 * pulse, 60 * pulse);
  else { ctx.save(); ctx.translate(0, -2); ctx.scale(pulse, pulse); drawGlow(ctx); ctx.restore(); }
}
const AURA_RING_BOX = { x0: -18, y0: -18, w: 36, h: 36 };
const AURA_GLOW_BOX = { x0: -30, y0: -30, w: 60, h: 60 };
const CROWN_BOX = { x0: -10, y0: -31, w: 20, h: 14 };
// The boss insignia: rising embers, an ornate jewelled crown, and a soft halo.
function bossCrown(ctx, time = 0) {
  ctx.fillStyle = 'rgba(255,190,110,0.85)';
  for (let i = 0; i < 5; i++) {
    const ph = ((time * 0.0016) + i * 0.37) % 1;
    const ex = Math.sin(i * 2.3 + time * 0.0025) * 11;
    circle(ctx, ex, 12 - ph * 32, (1 - ph) * 0.9 + 0.3); ctx.fill();
  }
  drawCached(ctx, 'crown', CROWN_BOX, (ctx) => {
  ctx.fillStyle = '#ffd24a';
  path(ctx, () => { ctx.moveTo(-8, -19); ctx.lineTo(-8, -24.5); ctx.lineTo(-4.5, -21); ctx.lineTo(-2.2, -28.5); ctx.lineTo(0, -22.5); ctx.lineTo(2.2, -28.5); ctx.lineTo(4.5, -21); ctx.lineTo(8, -24.5); ctx.lineTo(8, -19); });
  ctx.fill(); line(ctx, OUTLINE, 1);
  ctx.fillStyle = '#fff3b0'; rr(ctx, -8, -20.4, 16, 1.7, 0.8); ctx.fill();
  ctx.fillStyle = 'rgba(255,224,130,0.22)'; circle(ctx, 0, -22, 5.5); ctx.fill();
  // jewels
  ctx.fillStyle = '#d8566f'; circle(ctx, 0, -23, 1.2); ctx.fill();
  ctx.fillStyle = '#5ad1ff'; circle(ctx, -5, -22.6, 0.9); ctx.fill(); circle(ctx, 5, -22.6, 0.9); ctx.fill();
  ctx.fillStyle = '#fff'; circle(ctx, -0.4, -23.4, 0.4); ctx.fill();
  });
}

// ---- IMPROVED ARCHETYPES (ctx, col) ----

function beast(ctx, col) {
  // Improved: Better quadruped stance, more versatile for boar/tiger/otter/deer, stronger volume
  // back legs
  ctx.fillStyle = shade(col, -0.35); rr(ctx, -9, 7, 4, 6.5, 1.2); ctx.fill();
  ctx.fillStyle = shade(col, -0.22); rr(ctx, 3, 7, 4, 6.5, 1.2); ctx.fill();
  // front legs (lighter)
  ctx.fillStyle = shade(col, -0.28); rr(ctx, -5.5, 7.5, 3.8, 6, 1); ctx.fill();
  ctx.fillStyle = shade(col, -0.12); rr(ctx, 5, 7.5, 3.8, 6, 1); ctx.fill();
  // tail
  ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 2.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, 2); ctx.quadraticCurveTo(-18, -1, -15, -8); ctx.stroke(); ctx.lineCap = 'butt';
  // body - more substantial
  ellipse(ctx, -0.5, 1.5, 11.5, 7.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.2); ellipse(ctx, -0.5, 5, 9.5, 3.8); ctx.fill(); // belly
  ctx.fillStyle = shade(col, 0.18); ellipse(ctx, -1.5, -2.5, 8, 2.8); ctx.fill(); // back highlight
  rimLight(ctx, -0.5, 1.5, 11.5, 7.5, col);
  speckle(ctx, col, [[-6, 0, 1.1], [-1.5, 1.5, 0.9], [3, -0.5, 0.85], [-3.5, 4, 0.8]]);
  ticks(ctx, col, [[-7, 4.5, -5.5, 7], [-2.5, 5, -1, 7.5], [2.5, 4.5, 4, 7]], -0.18);
  // shaggy spine / mane tufts (better flow)
  ctx.fillStyle = shade(col, -0.38);
  path(ctx, () => { ctx.moveTo(-10, -4); ctx.lineTo(-8, -11); ctx.lineTo(-5, -4); ctx.lineTo(-2, -10); ctx.lineTo(1, -4); ctx.lineTo(4, -9); ctx.lineTo(7, -4); }); ctx.fill();
  // head
  circle(ctx, 9.5, -0.5, 5.8); fill(ctx, col); line(ctx);
  // ear
  ctx.fillStyle = shade(col, -0.32); path(ctx, () => { ctx.moveTo(6, -5); ctx.lineTo(5, -11); ctx.lineTo(10, -6); }); ctx.fill();
  // snout
  ctx.fillStyle = shade(col, 0.2); ellipse(ctx, 14.5, 0.5, 3.4, 2.8); ctx.fill();
  ctx.fillStyle = '#1a140d'; circle(ctx, 16, 0.3, 0.65); ctx.fill(); // nostril
  // tusk
  fang(ctx, 13.8, 2.8, 1.2, 2.6);
  eyeW(ctx, 10.5, -2.2, 1.15);
}

function rodent(ctx, col) {
  // Improved: cuter but still rat-like, better tail curl, clearer buck tooth, whiskers
  ctx.strokeStyle = shade(col, 0.25); ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, 5); ctx.quadraticCurveTo(-20, 2, -15, -8); ctx.stroke(); ctx.lineCap = 'butt';
  // feet
  ctx.fillStyle = shade(col, 0.3); circle(ctx, -4, 9.5, 1.7); ctx.fill(); circle(ctx, 4.5, 9.5, 1.7); ctx.fill();
  // body - rounder
  ellipse(ctx, 0, 2.5, 9.5, 6.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.32); ellipse(ctx, 1.5, 5, 5.5, 3); ctx.fill(); // pale belly
  ctx.fillStyle = shade(col, 0.15); ellipse(ctx, 0.5, 0.5, 6.5, 3); ctx.fill();
  rimLight(ctx, 0, 2.5, 9.5, 6.5, col);
  ticks(ctx, col, [[-6, 0, -4.5, 2.5], [-3, -1, -1.5, 1.5], [-7, 4, -5.5, 6]], -0.16);
  // head
  circle(ctx, 8.5, -0.5, 5); fill(ctx, col); line(ctx);
  // big ear
  circle(ctx, 7, -5.5, 3.2); fill(ctx, shade(col, 0.28)); line(ctx, OUTLINE, 1.2);
  ctx.fillStyle = shade(col, 0.42); circle(ctx, 7, -5.5, 1.6); ctx.fill();
  // snout + buck teeth
  path(ctx, () => { ctx.moveTo(12.5, -1); ctx.lineTo(16, 1); ctx.lineTo(12.5, 3); }); fill(ctx, shade(col, 0.25));
  ctx.fillStyle = '#1a140d'; circle(ctx, 15.8, 0.8, 0.65); ctx.fill();
  // prominent buck tooth
  ctx.fillStyle = '#f4f0e8'; rr(ctx, 13.2, 2.2, 1.6, 2.2, 0.3); ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(12.8, 0.8); ctx.lineTo(18.5, 0); ctx.moveTo(12.8, 1.6); ctx.lineTo(18.5, 2.2); ctx.stroke();
  eyeW(ctx, 10.2, -1.5, 1.05, '#8a1010');
}

function primate(ctx, col) {
  // Improved: better ape proportions, longer arms, clearer face patch, expressive
  ctx.strokeStyle = shade(col, -0.12); ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 5); ctx.quadraticCurveTo(-20, 3, -16, -10); ctx.stroke(); ctx.lineCap = 'butt';
  // legs
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -7, 5.5, 4.2, 8, 2); ctx.fill(); rr(ctx, 2, 5.5, 4.2, 8, 2); ctx.fill();
  // long reaching arms
  ctx.strokeStyle = shade(col, -0.08); ctx.lineWidth = 4.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-7, -1); ctx.quadraticCurveTo(-13, 5, -9, 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -1); ctx.quadraticCurveTo(12, 5, 8, 10); ctx.stroke(); ctx.lineCap = 'butt';
  // body
  ellipse(ctx, 0, 0.5, 8, 9); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.2); ellipse(ctx, 0, 1.5, 4.2, 6); ctx.fill(); // bare chest
  rimLight(ctx, 0, 0.5, 8, 9, col);
  // pectoral / ab definition
  ctx.strokeStyle = shade(col, -0.18); ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(0, 6); ctx.moveTo(-3, -1); ctx.quadraticCurveTo(0, 0.5, 3, -1); ctx.stroke();
  ticks(ctx, col, [[-7, -2, -5.5, 0.5], [5.5, -2, 7, 0.5], [-6.5, 4, -5, 6]], -0.16);
  // head + face patch
  circle(ctx, 0.5, -10.5, 6.2); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.28); circle(ctx, -5.5, -10.5, 2.1); ctx.fill(); circle(ctx, 6.5, -10.5, 2.1); ctx.fill();
  // face patch (lighter)
  ellipse(ctx, 0.5, -9.5, 4.8, 5.2); fill(ctx, shade(col, 0.38));
  // brow ridge
  ctx.fillStyle = shade(col, -0.32); rr(ctx, -3, -14, 7, 1.8, 0.9); ctx.fill();
  eyeW(ctx, -1.5, -10.8, 1.05); eyeW(ctx, 2.8, -10.8, 1.05);
}

function reptile(ctx, col) {
  // Improved: more lizard/croc feel, better tail, clearer dorsal ridge, tongue
  ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 4.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, 3); ctx.quadraticCurveTo(-26, 6, -22, -5); ctx.stroke(); ctx.lineCap = 'butt';
  // sprawled legs
  ctx.fillStyle = shade(col, -0.28); rr(ctx, -7, 6, 5.2, 5.5, 2); ctx.fill(); rr(ctx, 2.5, 6, 5.2, 5.5, 2); ctx.fill();
  // body
  ellipse(ctx, 0, 1.5, 12.5, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.24); ellipse(ctx, 0, 4.5, 10.5, 2.8); ctx.fill(); // belly shadow
  ctx.fillStyle = shade(col, 0.16); ellipse(ctx, -1.5, -1.5, 8, 2.6); ctx.fill(); // back sheen
  rimLight(ctx, 0, 1.5, 12.5, 7, col);
  speckle(ctx, col, [[-7, 0.5, 0.9], [-3, 1.5, 0.9], [1, 0.5, 0.85], [5, 1.5, 0.8], [-5, 3.5, 0.7], [3, 3.5, 0.7]], -0.22);
  // dorsal ridge (more pronounced)
  ctx.fillStyle = shade(col, -0.38);
  for (const x of [-8, -4, 0, 4]) {
    path(ctx, () => { ctx.moveTo(x, -4.5); ctx.lineTo(x + 1.3, -8); ctx.lineTo(x + 2.6, -4.5); }); ctx.fill();
  }
  // head
  ellipse(ctx, 12, -0.5, 7, 4.8); fill(ctx, col); line(ctx);
  // jaw line + tongue
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(14.5, 1.8); ctx.lineTo(19.5, 1.4); ctx.stroke();
  ctx.strokeStyle = '#d8324a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(19.5, 1.5); ctx.lineTo(23, 1.1); ctx.stroke();
  eyeW(ctx, 13.5, -2.5, 1.1, '#15110b');
}

function serpent(ctx, col) {
  // Improved: more dynamic coil, better hood for cobra, clearer scale suggestion, forked tongue
  ctx.strokeStyle = col; ctx.lineWidth = 6.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, 10); ctx.quadraticCurveTo(8, 7, -5, -1); ctx.quadraticCurveTo(-15, -7, 3, -9); ctx.stroke();
  ctx.lineWidth = 3.2; ctx.strokeStyle = shade(col, 0.26); ctx.beginPath(); ctx.moveTo(-12, 10); ctx.quadraticCurveTo(8, 7, -5, -1); ctx.stroke();
  // scale suggestion ticks
  ctx.lineWidth = 1.1; ctx.strokeStyle = shade(col, -0.32);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const t = i / 5; ctx.moveTo(-10 + t*13, 8.5 - t*8.5); ctx.lineTo(-8 + t*13, 10.5 - t*8.5); }
  ctx.stroke(); ctx.lineCap = 'butt';
  // hooded head (more cobra-like)
  path(ctx, () => { ctx.moveTo(4, -10); ctx.quadraticCurveTo(-1, -8, 1, -3); ctx.quadraticCurveTo(5, -2, 9, -3); ctx.quadraticCurveTo(11, -8, 4, -10); }); fill(ctx, col); line(ctx, OUTLINE, 1.2);
  circle(ctx, 5, -8.5, 3.6); fill(ctx, col); line(ctx, OUTLINE, 1.2);
  // eye + slit pupil
  ctx.fillStyle = '#ffe24a'; ellipse(ctx, 6.2, -9.2, 1.35, 0.95); ctx.fill();
  ctx.fillStyle = '#1a140d'; rr(ctx, 5.9, -10, 0.7, 1.7, 0.25); ctx.fill();
  // forked tongue
  ctx.strokeStyle = '#d8324a'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8.5, -8.2); ctx.lineTo(12.5, -8.8); ctx.moveTo(12.5, -8.8); ctx.lineTo(13.8, -9.8); ctx.moveTo(12.5, -8.8); ctx.lineTo(13.8, -7.8); ctx.stroke(); ctx.lineCap = 'butt';
}

function crab(ctx, col) {
  // Improved: better domed shell, more convincing jointed legs, bigger characterful pincers
  // walking legs (more jointed look)
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 1.9; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2]) {
    ctx.beginPath(); ctx.moveTo(s * 5.5, 3.5); ctx.lineTo(s * (9.5 + i * 2.2), 5.5 + i); ctx.lineTo(s * (12 + i * 2.2), 10.5); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // domed shell
  ellipse(ctx, 0, 1.5, 11.5, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.22); ellipse(ctx, -1.5, -1.2, 7.5, 3.2); ctx.fill();
  ctx.fillStyle = shade(col, -0.2); ellipse(ctx, 0, 4.5, 9.5, 2.8); ctx.fill();
  // shell rim lines
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-5.5, 0.5); ctx.lineTo(-4, 3.5); ctx.moveTo(0, 0.5); ctx.lineTo(0, 3.5); ctx.moveTo(5.5, 0.5); ctx.lineTo(4, 3.5); ctx.stroke();
  // big pincer claws (more menacing)
  for (const s of [-1, 1]) {
    ctx.fillStyle = col; ellipse(ctx, s * 11.5, -1.5, 4.2, 3.6); ctx.fill(); line(ctx, OUTLINE, 1.2);
    ctx.fillStyle = shade(col, -0.22); path(ctx, () => { ctx.moveTo(s * 13.5, -3.5); ctx.lineTo(s * 17, -1.5); ctx.lineTo(s * 12.5, -1.5); }); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(s * 9.5, -1.5); ctx.lineTo(s * 14.5, -1.5); ctx.stroke();
  }
  // eyestalks
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-2.8, -6); ctx.lineTo(-2.8, -10.5); ctx.moveTo(2.8, -6); ctx.lineTo(2.8, -10.5); ctx.stroke();
  eyeW(ctx, -2.8, -10.5, 1.35); eyeW(ctx, 2.8, -10.5, 1.35);
}

function fowl(ctx, col) {
  // Improved: better chicken/hornbill/kingfisher versatility, nicer tail, clearer comb/wattle
  ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = 2.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3.5, 7.5); ctx.lineTo(-3.5, 13); ctx.moveTo(-5, 13); ctx.lineTo(-2, 13);
  ctx.moveTo(3, 7.5); ctx.lineTo(3, 13); ctx.moveTo(1.5, 13); ctx.lineTo(4.5, 13); ctx.stroke(); ctx.lineCap = 'butt';
  // body
  ellipse(ctx, 0, 1.5, 8.5, 7.5); fill(ctx, col); line(ctx);
  // layered tail feathers (more dynamic)
  path(ctx, () => { ctx.moveTo(-7.5, -1.5); ctx.lineTo(-15, -9); ctx.lineTo(-7.5, 4); }); fill(ctx, shade(col, -0.2)); line(ctx);
  path(ctx, () => { ctx.moveTo(-7, 0.5); ctx.lineTo(-13, -4); ctx.lineTo(-7, 4); }); fill(ctx, shade(col, 0.1));
  // folded wing
  ctx.fillStyle = shade(col, -0.14); ellipse(ctx, -1.5, 1.5, 5, 5); ctx.fill();
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-4.5, 0.5); ctx.lineTo(1.5, 3.5); ctx.stroke();
  // head + comb + wattle + beak
  circle(ctx, 6.5, -7, 4.8); fill(ctx, shade(col, 0.1)); line(ctx);
  ctx.fillStyle = '#d23b2e'; circle(ctx, 5.5, -11.5, 1.5); ctx.fill(); circle(ctx, 7.8, -11.5, 1.5); ctx.fill();
  ctx.fillStyle = '#c2302a'; ellipse(ctx, 6.5, -4, 1.3, 1.9); ctx.fill();
  path(ctx, () => { ctx.moveTo(10, -7); ctx.lineTo(15, -6.2); ctx.lineTo(10, -4.5); }); fill(ctx, '#f0a93b');
  eyeW(ctx, 7.8, -8, 1.05);
}

function greenman(ctx, col) {
  // Improved: more goblin/leafy character, better ear shape, clearer snaggle teeth
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -5.5, 6, 4.2, 8, 2); ctx.fill(); rr(ctx, 0.8, 6, 4.2, 8, 2); ctx.fill();
  rr(ctx, -7.5, -4.5, 15, 13, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.18); ellipse(ctx, -1.5, 0.5, 4.2, 5.5); ctx.fill(); // pot belly highlight
  ctx.fillStyle = shade(col, 0.16); rr(ctx, -6.5, -4, 13, 1.8, 1); ctx.fill(); // shoulder rim
  speckle(ctx, col, [[3.5, -1, 1], [4.5, 2.5, 0.8], [-5, 3, 0.8], [2, 5, 0.7]], -0.24); // warts
  // loincloth
  ctx.fillStyle = '#7a5a2a'; rr(ctx, -7.5, 6, 15, 5, 2); ctx.fill();
  ctx.fillStyle = '#5a4220'; rr(ctx, -7.5, 6, 15, 1.5, 1); ctx.fill();
  // arms
  ctx.fillStyle = col; rr(ctx, -10.5, -3.5, 4, 9.5, 2); ctx.fill(); rr(ctx, 6, -3.5, 4, 9.5, 2); ctx.fill();
  // head
  circle(ctx, 0, -10.5, 6.8); fill(ctx, shade(col, 0.08)); line(ctx);
  // pointy ears
  path(ctx, () => { ctx.moveTo(-6, -11); ctx.lineTo(-12.5, -14.5); ctx.lineTo(-6, -7); }); fill(ctx, shade(col, 0.08)); line(ctx, OUTLINE, 1.2);
  path(ctx, () => { ctx.moveTo(6, -11); ctx.lineTo(12.5, -14.5); ctx.lineTo(6, -7); }); fill(ctx, shade(col, 0.08)); line(ctx, OUTLINE, 1.2);
  // brow, nose, teeth
  ctx.fillStyle = shade(col, -0.32); rr(ctx, -5.5, -13.5, 11, 1.7, 0.8); ctx.fill();
  ctx.fillStyle = shade(col, -0.16); ellipse(ctx, 0.3, -8.8, 1.7, 2.5); ctx.fill();
  ctx.fillStyle = '#f4efe0';
  path(ctx, () => { ctx.moveTo(-2.8, -6.2); ctx.lineTo(-1.6, -4.2); ctx.lineTo(-0.4, -6.2); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(1.2, -6.2); ctx.lineTo(2.4, -4.2); ctx.lineTo(3.6, -6.2); }); ctx.fill();
  eyeW(ctx, -2.8, -11, 1.2, '#7a1010'); eyeW(ctx, 3.2, -11, 1.2, '#7a1010');
}

function spider(ctx, col) {
  // Improved: cleaner 8 legs with better articulation, stronger hourglass/abdomen mark, cluster eyes
  ctx.strokeStyle = shade(col, -0.15); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2, 3]) {
    const ky = -3.5 + i * 3.5;
    ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.lineTo(s * (6.5 + i * 2.5), ky); ctx.lineTo(s * (11 + i * 2.7), ky + 4.5); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // abdomen
  ellipse(ctx, 0, 3.5, 7.5, 6.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.32); path(ctx, () => { ctx.moveTo(0, -1.5); ctx.lineTo(2.4, 4.5); ctx.lineTo(0, 8.5); ctx.lineTo(-2.4, 4.5); }); ctx.fill();
  // cephalothorax
  circle(ctx, 0, -4.5, 4.3); fill(ctx, shade(col, -0.18)); line(ctx);
  // fangs
  fang(ctx, -1.5, -1, 0.95, 2.1, shade(col, -0.42)); fang(ctx, 1.5, -1, 0.95, 2.1, shade(col, -0.42));
  // eye cluster (classic spider)
  ctx.fillStyle = '#ff2a2a';
  for (const [ex, ey] of [[-2.1, -5.2], [2.1, -5.2], [-0.9, -6.6], [0.9, -6.6], [-2.8, -6.3], [2.8, -6.3]]) {
    circle(ctx, ex, ey, 0.85); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(ctx, -2.4, -5.5, 0.28); ctx.fill(); circle(ctx, 1.8, -5.5, 0.28); ctx.fill();
}

function slime(ctx, col) {
  // Improved: more organic wobble shape, better drips, cuter/more readable face
  ctx.globalAlpha = 0.9;
  path(ctx, () => { ctx.moveTo(-10.5, 9.5); ctx.quadraticCurveTo(-13, -7, 0, -7.5); ctx.quadraticCurveTo(13, -7, 10.5, 9.5); }); fill(ctx, col); line(ctx);
  ctx.globalAlpha = 1;
  // drips
  ctx.fillStyle = col; circle(ctx, -5.5, 9.5, 2.2); ctx.fill(); circle(ctx, 5, 9.5, 1.8); ctx.fill();
  // glossy highlight
  ctx.fillStyle = shade(col, 0.38); ellipse(ctx, -3.5, -2.5, 3.2, 4.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ellipse(ctx, -4.5, -4, 1.4, 2); ctx.fill(); // bright specular
  // inner bubbles
  ctx.fillStyle = shade(col, 0.18); circle(ctx, 4, 3.5, 1.5); ctx.fill(); circle(ctx, -5.5, 4.5, 1.1); ctx.fill(); circle(ctx, 6, -0.5, 0.9); ctx.fill();
  // face - more expressive
  eyeW(ctx, -3.2, 0.5, 1.45); eyeW(ctx, 3.3, 0.5, 1.45);
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0.2, 3.8, 2.1, 0.25, Math.PI - 0.25); ctx.stroke();
}

function ghost(ctx, col) {
  // Improved: better flowing sheet silhouette, more haunting eyes/mouth, subtle aura already in engine but enhanced here lightly
  const g = ctx.createRadialGradient(0, -4.5, 2.5, 0, -4.5, 15); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; circle(ctx, 0, -4.5, 15); ctx.fill();
  ctx.globalAlpha = 0.78;
  path(ctx, () => { ctx.moveTo(-8.5, 9.5); ctx.lineTo(-8.5, -6.5); ctx.quadraticCurveTo(-8.5, -14.5, 0, -14.5); ctx.quadraticCurveTo(8.5, -14.5, 8.5, -6.5); ctx.lineTo(8.5, 9.5); ctx.lineTo(5, 6.5); ctx.lineTo(2, 9.5); ctx.lineTo(-1, 6.5); ctx.lineTo(-4, 9.5); ctx.lineTo(-8.5, 6.5); }); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.28); ellipse(ctx, -3.2, -6.5, 2.3, 3.8); ctx.fill();
  ctx.globalAlpha = 1;
  // hollow eyes
  ctx.fillStyle = '#16141f'; ellipse(ctx, -3.2, -7.5, 1.55, 2.15); ctx.fill(); ellipse(ctx, 3.2, -7.5, 1.55, 2.15); ctx.fill();
  ctx.fillStyle = 'rgba(170,205,255,0.92)'; circle(ctx, -3.2, -7.9, 0.55); ctx.fill(); circle(ctx, 3.2, -7.9, 0.55); ctx.fill();
  // wailing mouth
  ctx.fillStyle = '#16141f'; ellipse(ctx, 0, -2.2, 1.6, 2.3); ctx.fill();
  // drifting ectoplasm motes
  ctx.fillStyle = 'rgba(205,225,255,0.7)';
  circle(ctx, -10, -9.5, 0.85); ctx.fill(); circle(ctx, 9.5, -11.5, 0.65); ctx.fill(); circle(ctx, 8, 2, 0.55); ctx.fill();
}

function demon(ctx, col) {
  // Improved: more menacing bat wings, better horn curve, scarier fanged grin, stronger torso
  ctx.fillStyle = shade(col, -0.42);
  path(ctx, () => { ctx.moveTo(-6.5, -3.5); ctx.lineTo(-16.5, -10); ctx.lineTo(-13, -3.5); ctx.lineTo(-16.5, 1); ctx.lineTo(-7.5, 3); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(6.5, -3.5); ctx.lineTo(16.5, -10); ctx.lineTo(13, -3.5); ctx.lineTo(16.5, 1); ctx.lineTo(7.5, 3); }); ctx.fill();
  // hooved legs
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -5.5, 6, 4.2, 8, 2); ctx.fill(); rr(ctx, 0.8, 6, 4.2, 8, 2); ctx.fill();
  ctx.fillStyle = '#1a120e'; rr(ctx, -5.5, 12.2, 4.2, 2.5, 1); ctx.fill(); rr(ctx, 0.8, 12.2, 4.2, 2.5, 1); ctx.fill();
  // torso
  rr(ctx, -7.5, -4.5, 15, 12.5, 4); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.2); ellipse(ctx, 0, 3.5, 5.2, 4.2); ctx.fill();
  ctx.fillStyle = shade(col, 0.16); rr(ctx, -6.5, -4, 13, 2, 1); ctx.fill(); // shoulder rim light
  ctx.fillStyle = shade(col, 0.12); ellipse(ctx, -2.8, -1.5, 2.8, 3.8); ctx.fill();
  // chest / ab muscle lines
  ctx.strokeStyle = shade(col, -0.34); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(0, 6); ctx.moveTo(-4, -1.5); ctx.quadraticCurveTo(0, 0.5, 4, -1.5); ctx.moveTo(-3.5, 2); ctx.lineTo(3.5, 2); ctx.stroke();
  ctx.fillStyle = col; rr(ctx, -11.5, -3.5, 4.2, 9.5, 2); ctx.fill(); rr(ctx, 7, -3.5, 4.2, 9.5, 2); ctx.fill();
  // head + curved horns
  circle(ctx, 0, -10.5, 6.2); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.32);
  path(ctx, () => { ctx.moveTo(-6, -13.5); ctx.lineTo(-9.5, -21); ctx.lineTo(-3, -14.5); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(6, -13.5); ctx.lineTo(9.5, -21); ctx.lineTo(3, -14.5); }); ctx.fill();
  // fanged grin
  ctx.fillStyle = '#f4efe0';
  for (const x of [-3.2, -1.4, 0.4, 2.2]) {
    path(ctx, () => { ctx.moveTo(x - 0.65, -6.8); ctx.lineTo(x + 0.65, -6.8); ctx.lineTo(x, -5); }); ctx.fill();
  }
  // glowing eyes
  ctx.fillStyle = '#ffd24a'; circle(ctx, -2.4, -10.5, 1.35); ctx.fill(); circle(ctx, 2.4, -10.5, 1.35); ctx.fill();
  ctx.fillStyle = '#fff7d0'; circle(ctx, -2.4, -10.5, 0.45); ctx.fill(); circle(ctx, 2.4, -10.5, 0.45); ctx.fill();
}

function golem(ctx, col) {
  // Improved: chunkier stone feel, better facet shading, stronger glowing runes, clearer cracks
  ctx.fillStyle = shade(col, -0.28); rr(ctx, -6.5, 6, 4.8, 8, 1.2); ctx.fill(); rr(ctx, 1.2, 6, 4.8, 8, 1.2); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -13.5, -4.5, 5.2, 11.5, 2); ctx.fill(); rr(ctx, 8, -4.5, 5.2, 11.5, 2); ctx.fill();
  ctx.fillStyle = shade(col, -0.32); rr(ctx, -14, 5, 5.8, 3.2, 1); ctx.fill(); rr(ctx, 8, 5, 5.8, 3.2, 1); ctx.fill();
  // boulder torso with facets
  rr(ctx, -9.5, -6.5, 19, 14.5, 3); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.14); path(ctx, () => { ctx.moveTo(-9.5, -6.5); ctx.lineTo(2, -6.5); ctx.lineTo(-4.5, 0.5); ctx.lineTo(-9.5, 0.5); }); ctx.fill();
  ctx.fillStyle = shade(col, 0.26); rr(ctx, -8.5, -6, 16, 1.6, 0.8); ctx.fill(); // top rim light
  // patches of moss
  ctx.fillStyle = 'rgba(74,128,58,0.55)'; circle(ctx, -7, 5, 1.6); ctx.fill(); circle(ctx, 6.5, 4, 1.3); ctx.fill(); circle(ctx, -5.5, 6, 1); ctx.fill();
  ctx.fillStyle = shade(col, -0.22); path(ctx, () => { ctx.moveTo(9, 7.5); ctx.lineTo(2, 7.5); ctx.lineTo(7, 0.5); ctx.lineTo(9, 0.5); }); ctx.fill();
  // cracks
  ctx.strokeStyle = shade(col, -0.42); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-9, -0.5); ctx.lineTo(-2.5, 0.5); ctx.lineTo(2.5, -3.5); ctx.moveTo(3, 7.5); ctx.lineTo(5, 1.5); ctx.stroke();
  // head with runes
  rr(ctx, -5.5, -15.5, 11, 9.5, 2); fill(ctx, shade(col, 0.06)); line(ctx);
  ctx.fillStyle = '#ffce4a'; rr(ctx, -3.6, -12.5, 2.7, 2.7, 1); ctx.fill(); rr(ctx, 0.7, -12.5, 2.7, 2.7, 1); ctx.fill();
  ctx.fillStyle = '#fff3c0'; rr(ctx, -3.6, -12.5, 2.7, 1.1, 0.5); ctx.fill(); rr(ctx, 0.7, -12.5, 2.7, 1.1, 0.5); ctx.fill();
}

function undead(ctx, col) {
  // Improved: more skeletal, better ribcage detail, skull with full teeth row, glowing sockets
  ctx.strokeStyle = col; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3.5, 7.5); ctx.lineTo(-3.5, 13); ctx.moveTo(3.5, 7.5); ctx.lineTo(3.5, 13);
  ctx.moveTo(-5.5, -1.5); ctx.lineTo(-9.5, 4.5); ctx.moveTo(5.5, -1.5); ctx.lineTo(9.5, 4.5); ctx.stroke(); ctx.lineCap = 'butt';
  // ribcage
  rr(ctx, -5.5, -3.5, 11, 11.5, 2); fill(ctx, shade(col, -0.08)); line(ctx);
  ctx.strokeStyle = shade(col, -0.48); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(0, 7.5); ctx.stroke();
  for (const yy of [-1.5, 1.5, 4.5]) { ctx.beginPath(); ctx.moveTo(-4.5, yy); ctx.quadraticCurveTo(0, yy + 1.7, 4.5, yy); ctx.stroke(); }
  // skull
  circle(ctx, 0, -10.5, 5.8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.2); ellipse(ctx, -2, -12.5, 2.6, 1.6); ctx.fill(); // cranium sheen
  ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(1.5, -14.5); ctx.lineTo(2.6, -12.5); ctx.lineTo(1.8, -11.5); ctx.stroke(); // hairline crack
  ctx.fillStyle = '#15110b'; ellipse(ctx, -2.5, -11, 1.65, 2); ctx.fill(); ellipse(ctx, 2.5, -11, 1.65, 2); ctx.fill();
  ctx.fillStyle = '#7a1414'; circle(ctx, -2.5, -11, 0.75); ctx.fill(); circle(ctx, 2.5, -11, 0.75); ctx.fill();
  // nose cavity
  ctx.fillStyle = '#15110b'; path(ctx, () => { ctx.moveTo(0, -9); ctx.lineTo(-1.1, -7.2); ctx.lineTo(1.1, -7.2); }); ctx.fill();
  // jaw + teeth
  ctx.fillStyle = shade(col, -0.12); rr(ctx, -3.2, -6.5, 6.4, 2.6, 0.6); ctx.fill();
  ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 0.75;
  ctx.beginPath(); ctx.moveTo(-1.6, -6.3); ctx.lineTo(-1.6, -4); ctx.moveTo(0, -6.3); ctx.lineTo(0, -4); ctx.moveTo(1.6, -6.3); ctx.lineTo(1.6, -4); ctx.stroke();
}

function insect(ctx, col) {
  // Improved: more mosquito-like (long proboscis), better wing blur, spindly legs
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#d4f0ff'; ellipse(ctx, -6.5, -3.5, 7.5, 3.2); ctx.fill(); ellipse(ctx, 6.5, -3.5, 7.5, 3.2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(180,220,235,0.65)'; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(-11, -3.5); ctx.lineTo(-2.5, -2.5); ctx.moveTo(11, -3.5); ctx.lineTo(2.5, -2.5); ctx.stroke();
  // legs (very spindly)
  ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 0.95; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(s * 2.2, 2.5 + i*0.8); ctx.lineTo(s * 6.5, 8 + i * 1.6); ctx.stroke(); }
  ctx.lineCap = 'butt';
  // segmented body
  ellipse(ctx, 0, 3.5, 4.8, 6.5); fill(ctx, col); line(ctx);
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-4, 2.5); ctx.lineTo(4, 2.5); ctx.moveTo(-4, 5.5); ctx.lineTo(4, 5.5); ctx.stroke();
  circle(ctx, 0, -5.5, 3.2); fill(ctx, shade(col, -0.2)); line(ctx);
  // proboscis
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2.2, -8.5); ctx.lineTo(-4.5, -13); ctx.moveTo(2.2, -8.5); ctx.lineTo(4.5, -13); ctx.stroke();
  ctx.fillStyle = '#9b1e1e'; circle(ctx, -1.6, -5.8, 1.1); ctx.fill(); circle(ctx, 1.6, -5.8, 1.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(ctx, -1.9, -6.2, 0.35); ctx.fill(); circle(ctx, 1.3, -6.2, 0.35); ctx.fill();
}

function scorpion(ctx, col) {
  // Improved: more threatening tail curl + stinger, better pincer grasp, segmented body clearer
  ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const i of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(i * 3, 6.5); ctx.lineTo(i * 3 - 4, 10.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 3, 6.5); ctx.lineTo(i * 3 + 4, 10.5); ctx.stroke(); }
  // tail + stinger (more curved and dangerous)
  ctx.strokeStyle = col; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(7.5, 5.5); ctx.quadraticCurveTo(19, 3, 14.5, -8.5); ctx.stroke();
  ctx.lineWidth = 2.1; ctx.strokeStyle = shade(col, -0.26); ctx.beginPath(); ctx.moveTo(8.5, 4.5); ctx.quadraticCurveTo(18, 2, 14.5, -8); ctx.stroke(); ctx.lineCap = 'butt';
  fang(ctx, 14.5, -10.5, 1.35, 3.2, shade(col, -0.38));
  // body
  ellipse(ctx, 0, 3.5, 8.5, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.22); ellipse(ctx, -1, 1.5, 5, 1.9); ctx.fill(); // carapace sheen
  rimLight(ctx, 0, 3.5, 8.5, 5, col);
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(-3.2, -0.5); ctx.lineTo(-3.2, 7); ctx.moveTo(2.2, -0.5); ctx.lineTo(2.2, 7); ctx.stroke();
  // pincers
  for (const [px, py] of [[-10.5, 0.5], [-12.5, 4]]) {
    ctx.fillStyle = col; ellipse(ctx, px, py, 3.2, 2.3); ctx.fill(); line(ctx, OUTLINE, 1.1);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(px - 2.2, py); ctx.lineTo(px + 2.2, py); ctx.stroke();
  }
  eyeW(ctx, 2.8, 2, 0.85, '#15110b');
}

function bat(ctx, col) {
  // Improved: more detailed scalloped wings with finger bones, fuzzier body, cuter but creepy face
  ctx.fillStyle = col;
  path(ctx, () => { ctx.moveTo(-3.5, -0.5); ctx.lineTo(-15.5, -8); ctx.lineTo(-12, -1.5); ctx.lineTo(-15.5, 0.5); ctx.lineTo(-11, 2.5); ctx.lineTo(-14.5, 4.5); ctx.lineTo(-4.5, 3.5); }); ctx.fill(); line(ctx, OUTLINE, 1.1);
  path(ctx, () => { ctx.moveTo(3.5, -0.5); ctx.lineTo(15.5, -8); ctx.lineTo(12, -1.5); ctx.lineTo(15.5, 0.5); ctx.lineTo(11, 2.5); ctx.lineTo(14.5, 4.5); ctx.lineTo(4.5, 3.5); }); ctx.fill(); line(ctx, OUTLINE, 1.1);
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(-4.5, 0.5); ctx.lineTo(-13.5, -6); ctx.moveTo(4.5, 0.5); ctx.lineTo(13.5, -6); ctx.stroke();
  // body
  circle(ctx, 0, -0.5, 4.8); fill(ctx, shade(col, 0.1)); line(ctx);
  ctx.fillStyle = shade(col, 0.32); ellipse(ctx, 0, 1, 2.6, 2.1); ctx.fill(); // furry belly
  ticks(ctx, col, [[-2.5, -1.5, -1.8, 0], [0, -2, 0, -0.3], [2.5, -1.5, 1.8, 0]], 0.22, 0.6); // chest fluff
  // ears
  ctx.fillStyle = shade(col, -0.22); path(ctx, () => { ctx.moveTo(-3.2, -4.5); ctx.lineTo(-4.2, -9); ctx.lineTo(-1, -5.5); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(3.2, -4.5); ctx.lineTo(4.2, -9); ctx.lineTo(1, -5.5); }); ctx.fill();
  // eyes + tiny fangs
  ctx.fillStyle = '#ffe24a'; circle(ctx, -1.8, -1, 0.95); ctx.fill(); circle(ctx, 1.8, -1, 0.95); ctx.fill();
  ctx.fillStyle = '#1a140d'; circle(ctx, -1.8, -1, 0.38); ctx.fill(); circle(ctx, 1.8, -1, 0.38); ctx.fill();
  fang(ctx, -1.1, 2, 0.65, 1.3); fang(ctx, 1.1, 2, 0.65, 1.3);
}

function seacreature(ctx, col) {
  // Improved: more versatile for shark/dolphin/Merlion/kraken — sleeker body, better fin placement, stronger tail
  path(ctx, () => { ctx.moveTo(-12.5, 1.5); ctx.quadraticCurveTo(0, -9.5, 14, 0.5); ctx.quadraticCurveTo(0, 10.5, -12.5, 1.5); }); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.28); path(ctx, () => { ctx.moveTo(-10.5, 2.5); ctx.quadraticCurveTo(1.5, 8.5, 12, 1); ctx.quadraticCurveTo(0, 6.5, -10.5, 2.5); }); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; path(ctx, () => { ctx.moveTo(-7, -3); ctx.quadraticCurveTo(2, -6, 9, -1.5); ctx.quadraticCurveTo(2, -3.5, -7, -3); }); ctx.fill(); // top sheen
  ticks(ctx, col, [[5, -2.5, 4.5, 2.5], [7, -2, 6.5, 2.5], [9, -1, 8.5, 2]], -0.3, 0.7); // gill-ish lateral lines
  // tail fluke
  path(ctx, () => { ctx.moveTo(-12.5, 1.5); ctx.lineTo(-18.5, -4.5); ctx.lineTo(-15, 1.5); ctx.lineTo(-18.5, 7.5); }); fill(ctx, shade(col, -0.18)); line(ctx, OUTLINE, 1.1);
  // dorsal fin
  ctx.fillStyle = shade(col, -0.2); path(ctx, () => { ctx.moveTo(0.5, -6.5); ctx.lineTo(5, -14.5); ctx.lineTo(8, -5.5); }); ctx.fill();
  // pectoral
  path(ctx, () => { ctx.moveTo(-1.5, 3.5); ctx.lineTo(-4.5, 9.5); ctx.lineTo(2.5, 5); }); ctx.fill();
  // gills + jaw
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 0.85; ctx.beginPath(); ctx.moveTo(5.5, -3.5); ctx.lineTo(4.5, 2.5); ctx.moveTo(7.5, -3.5); ctx.lineTo(6.5, 2.5); ctx.stroke();
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10.5, 1.5); ctx.lineTo(15, 1); ctx.stroke();
  eyeW(ctx, 8.5, -1.5, 1.15);
}

function plant(ctx, col) {
  // Improved: more menacing flytrap, better stem, more detailed teeth + lure, clearer leaf veins
  ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -2.5); ctx.stroke(); ctx.lineCap = 'butt';
  // leaves
  for (const s of [-1, 1]) {
    ctx.fillStyle = shade(col, -0.08);
    path(ctx, () => { ctx.moveTo(0, 4.5); ctx.quadraticCurveTo(s * 12.5, 3.5, s * 9.5, -3.5); ctx.quadraticCurveTo(s * 4, 0.5, 0, 4.5); }); ctx.fill(); line(ctx, OUTLINE, 0.85);
    ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, 3.5); ctx.lineTo(s * 8.5, -2.5); ctx.stroke();
  }
  // flytrap maw (more open and toothy)
  ctx.fillStyle = col; path(ctx, () => { ctx.moveTo(-7.5, -5.5); ctx.quadraticCurveTo(0, -17.5, 7.5, -5.5); ctx.quadraticCurveTo(0, -9.5, -7.5, -5.5); }); ctx.fill(); line(ctx, OUTLINE, 1.1);
  ctx.fillStyle = '#6a0f1c'; ellipse(ctx, 0, -7, 4.2, 2.8); ctx.fill();
  // upper teeth
  ctx.fillStyle = '#f4f0e8';
  for (const x of [-4.5, -2.2, 0, 2.2, 4.5]) { path(ctx, () => { ctx.moveTo(x, -9); ctx.lineTo(x + 0.85, -6.8); ctx.lineTo(x - 0.85, -6.8); }); ctx.fill(); }
  // lower teeth
  for (const x of [-3.5, -1.2, 1.2, 3.5]) { path(ctx, () => { ctx.moveTo(x, -5); ctx.lineTo(x + 0.85, -7); ctx.lineTo(x - 0.85, -7); }); ctx.fill(); }
  // lure bulb
  ctx.fillStyle = shade(col, 0.28); circle(ctx, -3.5, -9.5, 1.15); ctx.fill();
}

function drake(ctx, col) {
  // Improved: more dragon-like, better wing membrane with ribs, stronger dorsal spines, better snout/horn
  ctx.fillStyle = shade(col, -0.24);
  path(ctx, () => { ctx.moveTo(-2.5, -2.5); ctx.lineTo(-17.5, -11.5); ctx.lineTo(-13, -3.5); ctx.lineTo(-17.5, 0); ctx.lineTo(-12, 0.5); ctx.lineTo(-15.5, 3.5); ctx.lineTo(-4.5, 1.5); }); ctx.fill(); line(ctx, OUTLINE, 1.1);
  ctx.strokeStyle = shade(col, -0.42); ctx.lineWidth = 0.85; ctx.beginPath(); ctx.moveTo(-3.5, -1.5); ctx.lineTo(-15.5, -10); ctx.moveTo(-3.5, -1.5); ctx.lineTo(-14.5, -1.5); ctx.stroke();
  // spiked tail
  ctx.strokeStyle = col; ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6.5, 5.5); ctx.quadraticCurveTo(-18, 8.5, -13.5, -0.5); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = col; path(ctx, () => { ctx.moveTo(-13.5, 0.5); ctx.lineTo(-16.5, -3.5); ctx.lineTo(-11, -1.5); }); ctx.fill();
  // legs + body
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -6.5, 5, 4.2, 8, 2); ctx.fill(); rr(ctx, 1.8, 5, 4.2, 8, 2); ctx.fill();
  ellipse(ctx, 0, 0.5, 8.5, 7.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.26); ellipse(ctx, 0.5, 4, 4.4, 3.4); ctx.fill(); // pale belly
  ctx.fillStyle = shade(col, -0.2); ellipse(ctx, 0, 5.5, 4.8, 2); ctx.fill();
  ticks(ctx, col, [[-3, 2.5, 3, 2.5], [-3.2, 4, 3.2, 4], [-2.8, 5.5, 2.8, 5.5]], -0.12, 0.7); // belly scutes
  rimLight(ctx, 0, 0.5, 8.5, 7.5, col);
  speckle(ctx, col, [[-5, -1.5, 0.85], [-6, 2, 0.75], [5, -1, 0.8]], -0.24);
  // dorsal spines
  ctx.fillStyle = shade(col, -0.32); for (const x of [-4.5, -1, 2.5]) { path(ctx, () => { ctx.moveTo(x, -6.5); ctx.lineTo(x + 1.3, -10.5); ctx.lineTo(x + 2.6, -6.5); }); ctx.fill(); }
  // head + horn + snout
  circle(ctx, 8.5, -3.5, 4.8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.32); path(ctx, () => { ctx.moveTo(6.5, -7.5); ctx.lineTo(5.5, -13.5); ctx.lineTo(9.5, -8.5); }); ctx.fill();
  ctx.fillStyle = shade(col, 0.16); ellipse(ctx, 12.5, -2.5, 3.2, 2.2); ctx.fill();
  ctx.fillStyle = '#1a140d'; circle(ctx, 14, -2.8, 0.55); ctx.fill();
  fang(ctx, 12, -0.5, 0.95, 1.9, '#f4efe0');
  eyeW(ctx, 9.8, -4.5, 1.1, '#7a1010');
}

function wisp(ctx, col) {
  // Improved: a proper will-o-wisp — soft aura, a flickering flame tail, a glowing
  // body with a white-hot core, and a few orbiting motes for life.
  const g = ctx.createRadialGradient(0, -1, 1, 0, -1, 13.5);
  g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; circle(ctx, 0, -1, 13.5); ctx.fill();
  // trailing flame tail
  ctx.fillStyle = col;
  path(ctx, () => { ctx.moveTo(-3.2, 0); ctx.quadraticCurveTo(0, 11, 3.2, 0); ctx.quadraticCurveTo(0, 4.5, -3.2, 0); }); ctx.fill();
  // glowing body
  const g2 = ctx.createRadialGradient(-1.5, -3, 0.5, 0, -1.5, 6.8);
  g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.45, shade(col, 0.5)); g2.addColorStop(1, col);
  ctx.fillStyle = g2; circle(ctx, 0, -1.5, 6.8); ctx.fill();
  // white-hot core
  ctx.fillStyle = '#ffffff'; circle(ctx, -0.8, -2.2, 2.3); ctx.fill();
  // orbiting motes
  ctx.fillStyle = shade(col, 0.55);
  circle(ctx, 8.5, -5.5, 1.3); ctx.fill(); circle(ctx, -8, 1.5, 1); ctx.fill(); circle(ctx, 5.5, 6, 0.85); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(ctx, 8.2, -5.8, 0.5); ctx.fill();
}

function humanoid(ctx, col) {
  // Improved: better cloak flow and hood shape, more threatening dagger pose, clearer face glow
  ctx.fillStyle = shade(col, -0.42); rr(ctx, -5.5, 6, 4.2, 8, 2); ctx.fill(); rr(ctx, 0.8, 6, 4.2, 8, 2); ctx.fill();
  ctx.fillStyle = '#1a120c'; rr(ctx, -5.8, 11.8, 5.2, 2.5, 1); ctx.fill(); rr(ctx, 0.4, 11.8, 5.2, 2.5, 1); ctx.fill();
  // hooded cloak
  rr(ctx, -7.5, -5.5, 15, 13.5, 4); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.12); rr(ctx, -7.5, -5.5, 3.6, 13.5, 4); ctx.fill();
  ctx.fillStyle = shade(col, -0.28); rr(ctx, 4.2, -5.5, 2.8, 13.5, 3); ctx.fill();
  // cloak folds + belt clasp
  ctx.strokeStyle = shade(col, -0.36); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-2.5, -2.5); ctx.lineTo(-3.5, 7.5); ctx.moveTo(1.5, -2.5); ctx.lineTo(2.5, 7.5); ctx.stroke();
  ctx.fillStyle = '#caa15a'; rr(ctx, -2.2, 3.5, 4.4, 1.7, 0.7); ctx.fill(); ctx.fillStyle = '#fff3c0'; rr(ctx, -2, 3.7, 4, 0.6, 0.3); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -10.5, -3.5, 4.2, 9.5, 2); ctx.fill(); rr(ctx, 6, -3.5, 4.2, 9.5, 2); ctx.fill();
  ctx.fillStyle = '#d8a578'; circle(ctx, -8.5, 5.5, 2); ctx.fill(); circle(ctx, 8, 5.5, 2); ctx.fill();
  // hood
  circle(ctx, 0, -11.5, 6.3); fill(ctx, shade(col, -0.48)); line(ctx);
  ctx.fillStyle = col; path(ctx, () => { ctx.arc(0, -12.5, 6.6, Math.PI, Math.PI * 2); ctx.lineTo(6.6, -9.5); ctx.quadraticCurveTo(0, -13.5, -6.6, -9.5); }); ctx.fill();
  ctx.fillStyle = shade(col, -0.22); path(ctx, () => { ctx.moveTo(0, -18.5); ctx.lineTo(5, -10.5); ctx.lineTo(-5, -10.5); }); ctx.fill();
  // eyes in shadow
  ctx.fillStyle = '#ffe24a'; circle(ctx, -2.3, -11, 0.85); ctx.fill(); circle(ctx, 2.3, -11, 0.85); ctx.fill();
  // dagger (more dynamic angle)
  ctx.strokeStyle = '#e9edf2'; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(9.5, 8.5); ctx.lineTo(13.5, -6); ctx.stroke();
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.9; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(11.5, 5.5); ctx.stroke();
}

function hound(ctx, col) {
  // Improved: more dog-like (less generic beast), better ear flop, snout, bushy tail
  ctx.strokeStyle = shade(col, -0.12); ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9.5, 2.5); ctx.quadraticCurveTo(-17, -2.5, -12.5, -9); ctx.stroke(); ctx.lineCap = 'butt';
  // legs
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -7.5, 6, 3.7, 7.2, 1); ctx.fill(); rr(ctx, 2.8, 6, 3.7, 7.2, 1); ctx.fill();
  ctx.fillStyle = shade(col, -0.08); rr(ctx, -4.5, 6.8, 3.5, 6.2, 1); ctx.fill(); rr(ctx, 5.2, 6.8, 3.5, 6.2, 1); ctx.fill();
  // body
  ellipse(ctx, -1, 1.5, 10.5, 6.2); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.22); ellipse(ctx, -1, 4.5, 8.5, 2.8); ctx.fill(); // underbelly shadow
  ctx.fillStyle = shade(col, 0.12); ellipse(ctx, -2, -1.5, 6.5, 2.2); ctx.fill();
  rimLight(ctx, -1, 1.5, 10.5, 6.2, col);
  ticks(ctx, col, [[-8, -2, -6.5, 1], [-5, 5, -3.5, 7.5], [1.5, 5, 3, 7.5], [4.5, -1.5, 5.5, 1]], -0.2);
  speckle(ctx, col, [[-6, 2, 0.9], [-1, 3, 0.8]]);
  // leather collar
  ctx.strokeStyle = '#6a3f1e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4.5, -4); ctx.quadraticCurveTo(6, 1, 4, 3.5); ctx.stroke();
  ctx.fillStyle = '#e6b34a'; circle(ctx, 4.8, 1.5, 0.9); ctx.fill();
  // head
  circle(ctx, 8.5, -2.5, 5.2); fill(ctx, col); line(ctx);
  // ear
  path(ctx, () => { ctx.moveTo(5.5, -6.5); ctx.lineTo(4.5, -12.5); ctx.lineTo(9, -7.5); }); fill(ctx, shade(col, -0.28));
  // snout
  path(ctx, () => { ctx.moveTo(12.5, -1.5); ctx.lineTo(16.5, 0.8); ctx.lineTo(12.5, 3); }); fill(ctx, shade(col, 0.18));
  ctx.fillStyle = '#1a140d'; circle(ctx, 16, 0.6, 0.6); ctx.fill();
  fang(ctx, 13.2, 2.8, 0.95, 1.7);
  eyeW(ctx, 9.8, -3.5, 1.05, '#3a1010');
}

function jellyfish(ctx, col) {
  // Improved: prettier bell curve, more elegant trailing tentacles, better internal highlight
  // soft bioluminescent glow
  const gg = ctx.createRadialGradient(0, -4, 1, 0, -4, 13);
  gg.addColorStop(0, 'rgba(255,255,255,0.18)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg; circle(ctx, 0, -4, 13); ctx.fill();
  ctx.globalAlpha = 0.82;
  path(ctx, () => { ctx.moveTo(-9.5, 1.5); ctx.quadraticCurveTo(-9.5, -10.5, 0, -10.5); ctx.quadraticCurveTo(9.5, -10.5, 9.5, 1.5); ctx.quadraticCurveTo(4, 4.5, 0, 1.5); ctx.quadraticCurveTo(-4, 4.5, -9.5, 1.5); }); fill(ctx, col); line(ctx);
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(col, 0.28); ellipse(ctx, -3, -5.5, 2.4, 3.3); ctx.fill();
  // tentacles
  ctx.strokeStyle = col; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  for (const x of [-6.5, -2, 2, 6.5]) { ctx.beginPath(); ctx.moveTo(x, 1.5); ctx.quadraticCurveTo(x + 2.2, 7.5, x - 1.2, 13); ctx.stroke(); }
  ctx.lineCap = 'butt';
}

function mantis(ctx, col) {
  // Improved: more recognizable praying mantis — better raptorial arms, triangular head, big eyes
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -4.5, 6, 3.2, 7.2, 1); ctx.fill(); rr(ctx, 0.8, 6, 3.2, 7.2, 1); ctx.fill();
  // folded wing case
  ctx.fillStyle = shade(col, -0.16); ellipse(ctx, -3, 1.5, 4, 6.5); ctx.fill();
  ellipse(ctx, -2, 0.5, 5.8, 7.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.22); ellipse(ctx, -3.5, -2, 2.4, 3.2); ctx.fill(); // sheen
  rimLight(ctx, -2, 0.5, 5.8, 7.5, col);
  ticks(ctx, col, [[-6.5, 1.5, 1.5, 1.5], [-6.5, 3.5, 1.5, 3.5], [-6, 5.5, 1, 5.5]], -0.2, 0.55); // wing veins
  // raptorial forelegs (more mantis-like)
  ctx.strokeStyle = shade(col, -0.12); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(2.5, -2); ctx.lineTo(9.5, -6.5); ctx.lineTo(7.5, -10.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2.5, 0.5); ctx.lineTo(10.5, -2.5); ctx.lineTo(9, -6.5); ctx.stroke(); ctx.lineCap = 'butt';
  // head (more triangular/insect)
  circle(ctx, 1.8, -9.5, 3.4); fill(ctx, col); line(ctx);
  ctx.fillStyle = '#1a140d'; circle(ctx, 0.4, -10.2, 0.95); ctx.fill(); circle(ctx, 3.2, -10.2, 0.95); ctx.fill();
}

function turtle(ctx, col) {
  // Improved: better domed shell with clearer scute pattern, nicer flippers, head proportion
  ctx.fillStyle = shade(col, -0.26); rr(ctx, -10.5, 6, 4.2, 4.2, 2); ctx.fill(); rr(ctx, 5.8, 6, 4.2, 4.2, 2); ctx.fill();
  path(ctx, () => { ctx.moveTo(-11.5, 0.8); ctx.lineTo(-15.5, 1.8); ctx.lineTo(-11.5, 3.8); }); ctx.fill();
  // head
  circle(ctx, 10.5, 0.5, 3.8); fill(ctx, shade(col, 0.2)); line(ctx);
  eyeW(ctx, 11.8, -0.2, 0.95, '#15110b');
  // shell
  ellipse(ctx, 0, 0.8, 11.5, 8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.15); ellipse(ctx, 0, -1.8, 4.8, 3.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ellipse(ctx, -3.5, -3.5, 2.6, 1.6); ctx.fill(); // gloss
  rimLight(ctx, 0, 0.8, 11.5, 8, col, 0.34);
  // scute lines (hex-like)
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -3.2); ctx.lineTo(5, -3.2);
  ctx.moveTo(-7, 1.8); ctx.lineTo(7, 1.8);
  ctx.moveTo(-5, 5.5); ctx.lineTo(5, 5.5);
  ctx.moveTo(-5, -3.2); ctx.lineTo(-7, 1.8); ctx.lineTo(-5, 5.5);
  ctx.moveTo(0, -3.2); ctx.lineTo(0, 5.5);
  ctx.moveTo(5, -3.2); ctx.lineTo(7, 1.8); ctx.lineTo(5, 5.5);
  ctx.stroke();
}

const ARCH = {
  beast, rodent, primate, reptile, serpent, crab, fowl, greenman, spider, slime,
  ghost, demon, golem, undead, insect, scorpion, bat, seacreature, plant, drake, wisp, humanoid,
  hound, jellyfish, mantis, turtle,
};

function chicken(ctx) {
  // legs
  ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, 13); ctx.moveTo(3, 8); ctx.lineTo(3, 13); ctx.stroke();
  // body
  ellipse(ctx, 0, 2, 9, 8); fill(ctx, '#f3f0e6'); line(ctx);
  // tail
  path(ctx, () => { ctx.moveTo(-7, -2); ctx.lineTo(-14, -8); ctx.lineTo(-7, 4); }); fill(ctx, '#e6e0cf'); line(ctx);
  // head
  circle(ctx, 7, -7, 5); fill(ctx, '#f7f4ea'); line(ctx);
  // comb + beak
  circle(ctx, 7, -12, 2.2); fill(ctx, '#d23b2e');
  path(ctx, () => { ctx.moveTo(11, -7); ctx.lineTo(15, -6); ctx.lineTo(11, -4); }); fill(ctx, '#f0a93b');
  // eye
  circle(ctx, 8.5, -8, 1); fill(ctx, '#1a140d');
}

function rat(ctx) {
  // tail
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(-18, 2, -14, -6); ctx.strokeStyle = '#caa6a0'; ctx.lineWidth = 2.5; ctx.stroke();
  // body
  ellipse(ctx, 0, 3, 10, 7); fill(ctx, '#8f8f93'); line(ctx);
  // head
  circle(ctx, 9, 0, 5); fill(ctx, '#9a9a9e'); line(ctx);
  // ear
  circle(ctx, 8, -5, 3); fill(ctx, '#c79a98'); line(ctx, OUTLINE, 1.5);
  // snout + eye
  path(ctx, () => { ctx.moveTo(13, -1); ctx.lineTo(16, 1); ctx.lineTo(13, 3); }); fill(ctx, '#c79a98');
  circle(ctx, 11, -1, 1); fill(ctx, '#1a140d');
}

function goblin(ctx) {
  // legs
  ctx.fillStyle = '#3f7a35'; rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  // body
  rr(ctx, -7, -4, 14, 13, 5); fill(ctx, '#4f9a3f'); line(ctx);
  // loincloth
  ctx.fillStyle = '#7a5a2a'; rr(ctx, -7, 6, 14, 5, 2); ctx.fill();
  // arms
  ctx.fillStyle = '#4f9a3f'; rr(ctx, -10, -3, 4, 9, 2); ctx.fill(); rr(ctx, 6, -3, 4, 9, 2); ctx.fill();
  // head
  circle(ctx, 0, -10, 7); fill(ctx, '#58a847'); line(ctx);
  // ears
  path(ctx, () => { ctx.moveTo(-6, -11); ctx.lineTo(-12, -14); ctx.lineTo(-6, -7); }); fill(ctx, '#58a847'); line(ctx, OUTLINE, 1.5);
  path(ctx, () => { ctx.moveTo(6, -11); ctx.lineTo(12, -14); ctx.lineTo(6, -7); }); fill(ctx, '#58a847'); line(ctx, OUTLINE, 1.5);
  // eyes
  circle(ctx, -2.5, -10, 1.4); fill(ctx, '#ffe24a'); circle(ctx, 3, -10, 1.4); fill(ctx, '#ffe24a');
  circle(ctx, -2.5, -10, 0.6); fill(ctx, '#1a140d'); circle(ctx, 3, -10, 0.6); fill(ctx, '#1a140d');
}

function macaque(ctx) {
  // tail
  ctx.beginPath(); ctx.moveTo(-7, 6); ctx.quadraticCurveTo(-18, 4, -15, -8); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3; ctx.stroke();
  // legs/arms
  ctx.fillStyle = '#6e4f33'; rr(ctx, -6, 5, 4, 8, 2); ctx.fill(); rr(ctx, 2, 5, 4, 8, 2); ctx.fill();
  // body
  ellipse(ctx, 0, 1, 9, 9); fill(ctx, '#7a5a3a'); line(ctx);
  // head
  circle(ctx, 1, -10, 6.5); fill(ctx, '#7a5a3a'); line(ctx);
  // face
  ellipse(ctx, 1, -9, 4.2, 5); fill(ctx, '#d9b48f');
  circle(ctx, -1, -10, 1); fill(ctx, '#1a140d'); circle(ctx, 3, -10, 1); fill(ctx, '#1a140d');
}

function lizard(ctx) {
  // tail
  ctx.beginPath(); ctx.moveTo(-9, 4); ctx.quadraticCurveTo(-24, 6, -20, -4);
  ctx.strokeStyle = '#5f7a3a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
  // legs
  ctx.fillStyle = '#52692f'; rr(ctx, -6, 6, 5, 5, 2); ctx.fill(); rr(ctx, 3, 6, 5, 5, 2); ctx.fill();
  // body
  ellipse(ctx, 0, 2, 13, 7); fill(ctx, '#6b8a42'); line(ctx);
  // spots
  ctx.fillStyle = 'rgba(40,55,20,0.55)';
  circle(ctx, -4, 0, 1.6); ctx.fill(); circle(ctx, 2, 3, 1.6); ctx.fill(); circle(ctx, 6, -1, 1.4); ctx.fill();
  // head
  ellipse(ctx, 12, 0, 7, 5); fill(ctx, '#6b8a42'); line(ctx);
  circle(ctx, 14, -2, 1.1); fill(ctx, '#1a140d');
  // forked tongue
  ctx.strokeStyle = '#c83b3b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18, 1); ctx.lineTo(22, 1); ctx.stroke();
}

function guard(ctx) {
  // legs
  ctx.fillStyle = '#3a3f4a'; rr(ctx, -5, 6, 4, 9, 2); ctx.fill(); rr(ctx, 1, 6, 4, 9, 2); ctx.fill();
  // spear
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(10, 14); ctx.stroke();
  ctx.fillStyle = '#cfd6dd'; path(ctx, () => { ctx.moveTo(10, -22); ctx.lineTo(7, -16); ctx.lineTo(13, -16); }); ctx.fill();
  // body armour
  rr(ctx, -7, -5, 14, 13, 4); fill(ctx, '#8a929c'); line(ctx);
  ctx.fillStyle = '#6f7780'; rr(ctx, -7, 0, 14, 3, 1); ctx.fill();
  // head + helm
  circle(ctx, 0, -11, 6.5); fill(ctx, '#e3b187'); line(ctx);
  ctx.fillStyle = '#9aa3ad'; path(ctx, () => { ctx.moveTo(-7, -11); ctx.quadraticCurveTo(0, -22, 7, -11); ctx.lineTo(7, -13); ctx.quadraticCurveTo(0, -20, -7, -13); }); ctx.fill(); line(ctx, OUTLINE, 1.5);
  circle(ctx, -2, -11, 0.9); fill(ctx, '#1a140d'); circle(ctx, 2, -11, 0.9); fill(ctx, '#1a140d');
}

// ================= A-WORTHY MASCOT =================
// Every person in the world is drawn as the A-Worthy mascot sticker: a tall
// cream capsule with a small cross on its forehead, happy-arc eyes, pink
// blush and an open smile, outlined in navy ink inside a white die-cut border.
// Body shape is the brand; a shirt colour, hat or prop tells characters apart.
const M_INK = '#22304A';
const M_CREAM = '#FBF5E6';
const M_EDGE = '#E9C9A0';

function capsulePath(c, w = 7, top = -19, bot = 12) {
  c.beginPath();
  c.moveTo(-w, bot - 4);
  c.lineTo(-w, top + w);
  c.arc(0, top + w, w, Math.PI, 0);
  c.lineTo(w, bot - 4);
  c.quadraticCurveTo(w, bot, w - 4, bot);
  c.lineTo(-w + 4, bot);
  c.quadraticCurveTo(-w, bot, -w, bot - 4);
  c.closePath();
}

function mascot(c, o = {}) {
  const st = _anim.stride * 1.6;
  const asw = _anim.stride * 1.4;
  c.lineJoin = 'round'; c.lineCap = 'round';
  // little feet (one lifts while walking)
  for (const [fx, lift] of [[-3.3, Math.max(0, st)], [3.3, Math.max(0, -st)]]) {
    ellipse(c, fx, 12.6 - lift, 2.6, 1.6); fill(c, '#ffffff'); line(c, M_INK, 1.2);
  }
  // white die-cut border, then the cream body
  capsulePath(c); line(c, '#ffffff', 4.4);
  capsulePath(c); fill(c, M_CREAM);
  c.save();
  capsulePath(c); c.clip();
  // warm tan shading down the left edge, as on the stickers
  c.fillStyle = M_EDGE; ellipse(c, -7.6, -2, 3.4, 19); c.fill();
  if (o.shirt) {
    path(c, () => {
      c.moveTo(-8, -3); c.lineTo(-3.2, -3); c.quadraticCurveTo(0, -0.6, 3.2, -3);
      c.lineTo(8, -3); c.lineTo(8, 13); c.lineTo(-8, 13); c.closePath();
    });
    fill(c, o.shirt);
    c.fillStyle = shade(o.shirt, -0.18); c.fillRect(4, -3, 4, 16);
    c.fillStyle = shade(o.shirt, 0.14); c.fillRect(-8, -3, 2.4, 16);
    if (o.apron) {
      c.fillStyle = o.apron; rr(c, -4.5, 0.5, 9, 12, 1.5); c.fill();
      c.strokeStyle = shade(o.apron, -0.25); c.lineWidth = 0.6; c.stroke();
    }
    path(c, () => { c.moveTo(-8, -3); c.lineTo(-3.2, -3); c.quadraticCurveTo(0, -0.6, 3.2, -3); c.lineTo(8, -3); });
    line(c, M_INK, 0.9);
  }
  c.restore();
  capsulePath(c); line(c, M_INK, 1.5);
  // face: forehead cross, happy-arc eyes, blush, open smile
  if (!o.noCross) {
    c.strokeStyle = M_INK; c.lineWidth = 1.2; c.beginPath();
    c.moveTo(-1.6, -14.8); c.lineTo(1.6, -14.8); c.moveTo(0, -16.4); c.lineTo(0, -13.2); c.stroke();
  }
  c.strokeStyle = o.eyeColor || M_INK; c.lineWidth = 1.1;
  c.beginPath(); c.arc(-2.7, -10.2, 1.3, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  c.beginPath(); c.arc(2.7, -10.2, 1.3, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  c.fillStyle = 'rgba(239,71,111,0.38)'; circle(c, -4.4, -8.6, 1.25); c.fill(); circle(c, 4.4, -8.6, 1.25); c.fill();
  path(c, () => { c.arc(0, -8.6, 1.8, 0, Math.PI); c.closePath(); }); fill(c, M_INK);
  c.fillStyle = '#EF476F'; ellipse(c, 0, -7.4, 0.95, 0.5); c.fill();
  // stick arms with white mitten hands, counter-swinging while walking
  for (const [sx, hx, hy] of [[-6.8, -10, 4 + asw], [6.8, 10, 4 - asw]]) {
    c.beginPath(); c.moveTo(sx, -1.5); c.quadraticCurveTo(hx * 1.02, -0.5, hx, hy); line(c, M_INK, 1.3);
    circle(c, hx, hy, 1.8); fill(c, '#ffffff'); line(c, M_INK, 1);
  }
  // hat sits on the crown of the capsule
  if (o.hat) {
    rr(c, -5, -25, 10, 6, 2.2); fill(c, o.hat); line(c, M_INK, 1);
    rr(c, -8, -19.8, 16, 2.8, 1.4); fill(c, o.hat); line(c, M_INK, 1);
    c.fillStyle = 'rgba(255,255,255,0.3)'; rr(c, -4, -24.2, 2.4, 4.4, 1); c.fill();
  }
  c.lineCap = 'butt'; c.lineJoin = 'miter';
}

function human(ctx, p) {
  mascot(ctx, { shirt: p.top, apron: p.apron, hat: p.hat, noCross: !!p.hat && p.acc === 'hood' });
  if (p.acc) townAcc(ctx, p);
}

// Small role-distinguishing props drawn over the base townsfolk figure.
function townAcc(ctx, p) {
  switch (p.acc) {
    case 'coins': // banker — a stack of gold coins in hand
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#e6b34a'; ellipse(ctx, 10.5, 2.4 - i * 1.1, 2, 0.9); ctx.fill(); ctx.fillStyle = '#ffd773'; ellipse(ctx, 10.5, 2.1 - i * 1.1, 1.2, 0.4); ctx.fill(); }
      break;
    case 'sack': // shopkeeper — a goods sack
      ctx.fillStyle = '#b89a5a'; circle(ctx, 11.5, 6.5, 2.6); ctx.fill(); ctx.fillStyle = shade('#b89a5a', -0.18); rr(ctx, 9.5, 3, 4, 1.6, 0.6); ctx.fill();
      break;
    case 'ladle': // hawker — a soup ladle
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(12.5, -4.5); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#cfd6dd'; circle(ctx, 12.9, -5, 1.8); ctx.fill(); ctx.fillStyle = '#aab4be'; ellipse(ctx, 12.9, -4.4, 1.3, 0.7); ctx.fill();
      break;
    case 'map': // guide — a rolled map
      ctx.fillStyle = '#efe6cf'; rr(ctx, -13.5, 2.5, 5.5, 4.5, 0.9); ctx.fill();
      ctx.strokeStyle = '#b8893f'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-12.5, 4); ctx.lineTo(-9.5, 4); ctx.moveTo(-12.5, 5.3); ctx.lineTo(-9, 5.3); ctx.stroke();
      ctx.fillStyle = '#c0392b'; circle(ctx, -10.5, 5.8, 0.6); ctx.fill();
      break;
    case 'stars': { // mage — arcane sparkles on the robe
      ctx.fillStyle = '#ffe24a';
      for (const [sx, sy, r] of [[-3, 1, 1.3], [2.5, 4, 1], [3, -1.5, 0.9]]) {
        path(ctx, () => { ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r * 0.4, sy); ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r * 0.4, sy); }); ctx.fill();
        path(ctx, () => { ctx.moveTo(sx - r, sy); ctx.lineTo(sx, sy + r * 0.4); ctx.lineTo(sx + r, sy); ctx.lineTo(sx, sy - r * 0.4); }); ctx.fill();
      }
      break;
    }
    case 'bow': // fletcher — a bow slung over the shoulder
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-9.5, -0.5, 7, Math.PI * 1.58, Math.PI * 0.42); ctx.stroke();
      ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-4.6, -5.4); ctx.lineTo(-4.6, 4.4); ctx.stroke();
      break;
    case 'scar': // slayer master — an eye scar
      ctx.strokeStyle = '#9a5a4a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(2.9, -12.6); ctx.lineTo(2.3, -8.8); ctx.stroke();
      break;
    case 'scroll': // skills tutor — a scroll in hand
      ctx.fillStyle = '#efe6cf'; rr(ctx, 10.6, -0.5, 2.4, 6.5, 1); ctx.fill(); ctx.fillStyle = '#d8c089'; rr(ctx, 10.6, -0.5, 2.4, 1, 0.5); ctx.fill(); rr(ctx, 10.6, 5, 2.4, 1, 0.5); ctx.fill();
      break;
    case 'halo': // light priestess — a glowing halo
      ctx.fillStyle = 'rgba(255,236,150,0.45)'; ellipse(ctx, 0, -22.5, 5.5, 1.8); ctx.fill();
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -22.5, 5, 1.5, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'hood': // shadow broker — a dark cowl shadow over the brow
      ctx.fillStyle = 'rgba(8,6,14,0.55)'; path(ctx, () => { ctx.arc(0, -12, 6.6, Math.PI, 0); ctx.lineTo(6.6, -11.8); ctx.quadraticCurveTo(0, -13.6, -6.6, -11.8); }); ctx.fill();
      ctx.fillStyle = '#8a5ad0'; circle(ctx, -2.7, -10.6, 0.6); ctx.fill(); circle(ctx, 2.7, -10.6, 0.6); ctx.fill(); // glowing eyes
      break;
  }
}

// ================= PLAYER =================
// Painted A-Worthy hero art, one per combat style (assets/creatures/hero/<style>.webp):
// a knight for melee (and bare hands), an archer for bows, a wizard for staves.
// Job classes with their own painted hero (assets/creatures/hero/<classId>.webp)
// use it in place of their style's art.
export const HERO_STYLES = ['melee', 'ranged', 'magic'];
export const CLASS_HERO_ART = new Set(['rogue', 'swordsman', 'samurai', 'berserker', 'paladin', 'sorcerer', 'dancer', 'lancer', 'juggernaut', 'brawler', 'corsair', 'ranger', 'halberdier', 'gladiator']);
export const heroArtSrc = (classId) => (CLASS_HERO_ART.has(classId) ? `assets/creatures/hero/${classId}.webp` : null);
const _heroImg = {};
function heroImage(style) {
  if (_heroImg[style] !== undefined) return _heroImg[style];
  if (typeof Image === 'undefined') { _heroImg[style] = null; return null; }
  const img = new Image();
  img.src = `assets/creatures/hero/${style}.webp`;
  _heroImg[style] = img;
  return img;
}
const HERO_ART_H = 56, HERO_ART_W = 60, HERO_ART_FEET = 15;

// ---- Puppet animation for the painted hero ----
// The picture is cut once into a body and two feet (the bottom band, split at
// the gap between the feet). Walking lifts each foot in turn and swings it
// forward, the body leans into the walk and squashes a touch as each foot
// lands; standing still, the hero breathes. Without a DOM it draws whole.
const PUPPET_FEET = 0.2;   // the bottom share of the picture that holds the feet
const _puppets = new WeakMap();
function heroRig(img) {
  if (_puppets.has(img)) return _puppets.get(img);
  let rig = null;
  try {
    const W = img.naturalWidth, H = img.naturalHeight;
    const cnv = document.createElement('canvas'); cnv.width = W; cnv.height = H;
    const g = cnv.getContext('2d'); g.drawImage(img, 0, 0);
    const cut = Math.round(H * (1 - PUPPET_FEET));
    // Split where the feet band is emptiest, in the middle half of the picture.
    const band = g.getImageData(0, cut, W, H - cut).data;
    const cols = new Float64Array(W);
    for (let y = 0; y < H - cut; y++) for (let x = 0; x < W; x++) cols[x] += band[(y * W + x) * 4 + 3];
    let split = W >> 1, best = Infinity;
    for (let x = Math.round(W * 0.25); x < Math.round(W * 0.75); x++) if (cols[x] < best) { best = cols[x]; split = x; }
    const part = (sx, sy, sw, sh) => {
      const c = document.createElement('canvas'); c.width = Math.max(1, sw); c.height = Math.max(1, sh);
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh); return c;
    };
    rig = { W, H, cut, split, body: part(0, 0, W, cut), back: part(0, cut, split, H - cut), front: part(split, cut, W - split, H - cut) };
  } catch { rig = null; }
  _puppets.set(img, rig);
  return rig;
}
function heroPuppet(c, img, w, h, g, t) {
  const rig = typeof document !== 'undefined' ? heroRig(img) : null;
  const top = HERO_ART_FEET - h, k = w / (rig ? rig.W : img.naturalWidth);
  const m = g.move;
  // Phase 0..2 per two tiles: the back foot swings on 0..1, the front on 1..2.
  const p = g.phase % 2, sw = Math.sin(p * Math.PI);
  const backLift = Math.max(0, sw) * m, frontLift = Math.max(0, -sw) * m;
  const land = 1 - Math.abs(sw);                       // 1 as a foot plants
  const breathe = (1 - m) * Math.sin(t * 0.0032) * 0.018;
  c.save();
  // Lean into the walk (more when running) and squash slightly on each footfall.
  c.translate(0, HERO_ART_FEET);
  c.rotate(m * (g.run ? 0.1 : 0.06));
  const sy = 1 + breathe - land * land * 0.035 * m, sx = 1 - breathe * 0.5 + land * land * 0.025 * m;
  c.scale(sx, sy);
  c.translate(0, -HERO_ART_FEET);
  if (!rig) { c.drawImage(img, -w / 2, top, w, h); c.restore(); return; }
  const fy = top + rig.cut * k, fh = (rig.H - rig.cut) * k, bw = rig.split * k, fw = (rig.W - rig.split) * k;
  // Feet first, so a lifted foot tucks up behind the body. A swinging foot
  // rises and travels forward; the planted one slides back under the body.
  const stride = 2.2 * m;
  c.drawImage(rig.back, -w / 2 + (backLift - frontLift) * stride, fy - backLift * 3.2, bw, fh);
  c.drawImage(rig.front, -w / 2 + bw + (frontLift - backLift) * stride, fy - frontLift * 3.2, fw, fh);
  c.drawImage(rig.body, -w / 2, top, w, rig.cut * k);
  c.restore();
}

// Attack choreography for the painted hero. k runs 0..1 through one attack;
// +x is always "toward the foe" (staged() mirrors the hero when facing left).
const easeOut = (x) => 1 - (1 - x) * (1 - x);
const easeIn = (x) => x * x;
const seg = (k, a, b) => Math.max(0, Math.min(1, (k - a) / (b - a)));
function heroAttackPose(style, k) {
  const P = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, flash: 0, behind: null, front: null };
  if (style === 'melee') {
    // Wind up (lean back, crouch) -> lunge and slash -> settle.
    const up = easeOut(seg(k, 0, 0.3)), hit = easeOut(seg(k, 0.3, 0.5)), back = easeIn(seg(k, 0.55, 1));
    const lunge = k < 0.3 ? -up : k < 0.55 ? -1 + 2 * hit : 1 - back;
    P.dx = lunge * (lunge < 0 ? 4 : 9);
    P.dy = -Math.sin(seg(k, 0.25, 0.65) * Math.PI) * 5;            // a little leap into the blow
    P.rot = lunge * (lunge < 0 ? 0.2 : 0.24);
    P.sy = k < 0.3 ? 1 - up * 0.1 : 1 + Math.sin(seg(k, 0.3, 0.7) * Math.PI) * 0.12;
    P.sx = 2 - P.sy;
    P.flash = Math.sin(seg(k, 0.38, 0.6) * Math.PI);
    P.front = (c) => {
      const a = seg(k, 0.32, 0.7);
      if (a <= 0 || a >= 1) return;
      // A crescent slash sweeping top to bottom in front of the hero.
      const sweep = easeOut(a), fade = 1 - a;
      const a0 = -1.5 + sweep * 2.2, a1 = a0 - 1.3;
      c.save(); c.lineCap = 'round';
      c.strokeStyle = `rgba(34,48,74,${(0.85 * fade).toFixed(3)})`; c.lineWidth = 9;
      c.beginPath(); c.arc(14, -16, 28, a1, a0); c.stroke();
      c.strokeStyle = `rgba(255,255,255,${fade.toFixed(3)})`; c.lineWidth = 6;
      c.beginPath(); c.arc(14, -16, 28, a1, a0); c.stroke();
      c.strokeStyle = `rgba(245,184,46,${fade.toFixed(3)})`; c.lineWidth = 2.4;
      c.beginPath(); c.arc(14, -16, 32, a1 + 0.2, a0); c.stroke();
      if (a > 0.25 && a < 0.65) {   // impact star where the blade lands
        const r = 4 + Math.sin(seg(a, 0.25, 0.65) * Math.PI) * 6;
        c.fillStyle = `rgba(255,236,170,${fade.toFixed(3)})`;
        c.beginPath();
        for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, rr2 = i % 2 ? r * 0.4 : r; c.lineTo(40 + Math.cos(ang) * rr2, -8 + Math.sin(ang) * rr2); }
        c.closePath(); c.fill(); c.strokeStyle = `rgba(34,48,74,${fade.toFixed(3)})`; c.lineWidth = 1.2; c.stroke();
      }
      c.restore();
    };
  } else if (style === 'ranged') {
    // Draw back (lean away, steady) -> release with a sharp recoil -> recover.
    const draw = easeOut(seg(k, 0, 0.5)), rel = seg(k, 0.5, 0.62), rec = easeIn(seg(k, 0.62, 1));
    const lean = k < 0.5 ? -draw * 3 : k < 0.62 ? -3 - rel * 4 : -7 * (1 - rec);
    P.dx = lean;
    P.rot = k < 0.5 ? -draw * 0.1 : k < 0.62 ? -0.1 - rel * 0.12 : -0.22 * (1 - rec);
    P.sy = k < 0.5 ? 1 - draw * 0.06 : 1 + Math.sin(seg(k, 0.5, 0.8) * Math.PI) * 0.08;
    P.sx = 2 - P.sy;
    P.flash = Math.sin(seg(k, 0.5, 0.7) * Math.PI);
    P.behind = (c) => {   // a tightening focus ring while drawing
      if (k > 0.5) return;
      c.save(); c.strokeStyle = `rgba(255,255,255,${(0.5 * draw).toFixed(3)})`; c.lineWidth = 1.4;
      c.setLineDash([3, 3]); c.beginPath(); c.arc(0, -14, 26 - draw * 10, 0, Math.PI * 2); c.stroke(); c.restore();
    };
    P.front = (c) => {
      const a = seg(k, 0.5, 0.85);
      if (a <= 0 || a >= 1) return;
      // Speed lines and a burst of air shooting forward from the bow.
      c.save(); c.lineCap = 'round';
      const f = 1 - a;
      for (let i = 0; i < 4; i++) {
        const y = -24 + i * 6, x0 = 32 + a * 22, len = 14 * f + 5;
        c.strokeStyle = `rgba(34,48,74,${(0.8 * f).toFixed(3)})`; c.lineWidth = 4 - i * 0.4;
        c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + len, y); c.stroke();
        c.strokeStyle = `rgba(255,255,255,${f.toFixed(3)})`; c.lineWidth = 2 - i * 0.3;
        c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + len, y); c.stroke();
      }
      c.strokeStyle = `rgba(245,184,46,${f.toFixed(3)})`; c.lineWidth = 2.6;
      c.beginPath(); c.arc(30, -15, 5 + a * 12, -1.1, 1.1); c.stroke();
      c.restore();
    };
  } else {
    // Charge (float up inside a swirl of sparks) -> thrust the spell out -> land.
    const ch = easeOut(seg(k, 0, 0.6)), cast = seg(k, 0.6, 0.75), land = easeIn(seg(k, 0.75, 1));
    P.dy = k < 0.6 ? -ch * 8 : k < 0.75 ? -8 : -8 * (1 - land);
    P.dx = k < 0.6 ? 0 : k < 0.75 ? easeOut(cast) * 5 : 5 * (1 - land);
    P.rot = k < 0.6 ? Math.sin(k * 30) * 0.03 : k < 0.75 ? easeOut(cast) * 0.16 : 0.16 * (1 - land);
    P.sy = k < 0.6 ? 1 + ch * 0.05 : 1 + Math.sin(seg(k, 0.6, 0.85) * Math.PI) * 0.1;
    P.sx = 2 - P.sy;
    P.flash = Math.sin(seg(k, 0.55, 0.8) * Math.PI);
    P.behind = (c, kk, t) => {   // a glowing magic circle and orbiting sparks
      const g = k < 0.75 ? ch : 1 - land;
      if (g <= 0.02) return;
      c.save();
      c.globalCompositeOperation = 'lighter';
      const rg = c.createRadialGradient(0, -14, 2, 0, -14, 30);
      rg.addColorStop(0, `rgba(200,150,255,${(0.45 * g).toFixed(3)})`); rg.addColorStop(1, 'rgba(200,150,255,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(0, -14, 30, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = `rgba(155,82,173,${(0.8 * g).toFixed(3)})`; c.lineWidth = 1.3;
      c.beginPath(); c.ellipse(0, 14, 16 * g, 5 * g, 0, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 6; i++) {
        const ang = t * 0.008 + i * Math.PI / 3, r = 20 + Math.sin(t * 0.01 + i) * 2;
        c.fillStyle = i % 2 ? `rgba(245,184,46,${g.toFixed(3)})` : `rgba(220,190,255,${g.toFixed(3)})`;
        c.beginPath(); c.arc(Math.cos(ang) * r, -14 + Math.sin(ang) * r * 0.55, 1.8, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    };
    P.front = (c) => {
      const a = seg(k, 0.6, 0.9);
      if (a <= 0 || a >= 1) return;
      // A bright burst flung forward as the spell leaves the staff.
      c.save(); c.globalCompositeOperation = 'lighter';
      const r = 6 + easeOut(a) * 14;
      const rg = c.createRadialGradient(24, -22, 0, 24, -22, r);
      rg.addColorStop(0, `rgba(255,255,255,${(1 - a).toFixed(3)})`);
      rg.addColorStop(0.5, `rgba(200,150,255,${(0.8 * (1 - a)).toFixed(3)})`);
      rg.addColorStop(1, 'rgba(200,150,255,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(24, -22, r, 0, Math.PI * 2); c.fill();
      c.restore();
    };
  }
  return P;
}

export function drawPlayer(ctx, cx, cy, opts = {}) {
  const style = opts.hasWeapon && (opts.weaponType === 'ranged' || opts.weaponType === 'magic' || opts.weaponType === 'dance') ? opts.weaponType : 'melee';
  // The Dancer has no painted art yet, so it uses the drawn mascot in a silk outfit.
  const himg = CLASS_HERO_ART.has(opts.jobClass) ? heroImage(opts.jobClass) : HERO_STYLES.includes(style) ? heroImage(style) : null;
  const painted = himg && himg.complete && himg.naturalWidth;
  staged(ctx, cx, cy, opts, (c) => {
    // A soft golden halo while any prayer is active — the only in-world sign
    // of it otherwise living entirely in the HUD's prayer orb/panel.
    if (opts.prayerActive) {
      const t = opts.time || 0;
      const pulse = 1 + Math.sin(t * 0.004) * 0.08;
      const g = c.createRadialGradient(0, -2, 2, 0, -2, 15 * pulse);
      g.addColorStop(0, 'rgba(255,226,150,0.30)');
      g.addColorStop(0.6, 'rgba(255,214,120,0.14)');
      g.addColorStop(1, 'rgba(255,214,120,0)');
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = g; c.beginPath(); c.arc(0, -2, 15 * pulse, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    if (painted) {
      // The painted hero carries its own weapon, so each attack is acted out with
      // the whole body: a wind-up, a strike and a recovery, plus a style effect.
      const k = opts.swingK ?? -1;
      const pose = k >= 0 ? heroAttackPose(style === 'dance' ? 'melee' : style, k) : null;   // the Dancer lunges with her whip
      const t = opts.time || 0;
      if (pose && pose.behind) pose.behind(c, k, t);
      c.save();
      if (pose) {
        c.translate(pose.dx, pose.dy);
        c.translate(0, HERO_ART_FEET); c.rotate(pose.rot); c.scale(pose.sx, pose.sy); c.translate(0, -HERO_ART_FEET);
      }
      const s = Math.min(HERO_ART_H / himg.naturalHeight, HERO_ART_W / himg.naturalWidth);
      const w = himg.naturalWidth * s, h = himg.naturalHeight * s;
      const g = opts.gait;
      const layered = drawHeroRig(c, opts) || drawRangedHeroRig(c, opts);
      if (!layered) {
        if (g && !pose) heroPuppet(c, himg, w, h, g, t);
        else {
          // A side-to-side rock while walking, as the monsters do (a gait cue).
          if (opts.moving) c.rotate(Math.sin(t * 0.018 + cx) * 0.06);
          c.drawImage(himg, -w / 2, HERO_ART_FEET - h, w, h);
        }
      }
      if (!layered && pose && pose.flash > 0) {   // a white flash over the body on the strike frame
        c.globalAlpha = pose.flash * 0.35; c.globalCompositeOperation = 'lighter';
        c.drawImage(himg, -w / 2, HERO_ART_FEET - h, w, h);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      c.restore();
      if (pose && pose.front) pose.front(c, k, t);
      return;
    }
    // The hero is the A-Worthy mascot. Unarmoured, it wears a tunic in the
    // brand's one action colour (rust); a platebody swaps it for steel.
    const dancer = style === 'dance';
    // Drawn at the painted heroes' size: the mascot is scaled up from the feet.
    if (dancer) { c.translate(0, 13); c.scale(1.3, 1.3); c.translate(0, -13); }
    const body = dancer ? '#EF8AB4' : opts.hasBody ? '#b9c2cc' : '#C0392B';
    const q = strideKey();
    const was = _anim.stride; _anim.stride = q;
    // cape (behind everything), sways with motion
    if (opts.hasCape) {
      const sw = Math.sin((opts.time || 0) * 0.012) * 1.4;
      c.fillStyle = '#8a2f44';
      path(c, () => { c.moveTo(-6, -4); c.lineTo(6, -4); c.lineTo(8 + sw, 13); c.lineTo(-8 + sw, 13); });
      c.fill();
      c.fillStyle = '#a83a52'; rr(c, -6, -5, 12, 3, 1); c.fill();
      c.strokeStyle = '#6e2436'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-2, -3); c.lineTo(-3 + sw, 12); c.moveTo(2, -3); c.lineTo(3 + sw, 12); c.stroke();
    }
    // The hero's body (capsule, armour, helm) is cached per look and walk pose;
    // the cape, weapon and halo stay live because they animate continuously.
    drawCached(c, `hero|${dancer ? 'd' : opts.hasBody ? 1 : 0}|${opts.hasHelm ? 1 : 0}|${q}`, MASCOT_BOX, (c) => {
    mascot(c, { shirt: body, noCross: opts.hasHelm && !dancer });
    if (dancer) {
      // A flared silk skirt with a gold waistband, and a feathered headdress.
      path(c, () => { c.moveTo(-6.5, 5); c.lineTo(6.5, 5); c.quadraticCurveTo(10, 10, 10.5, 13); c.quadraticCurveTo(0, 15.5, -10.5, 13); c.quadraticCurveTo(-10, 10, -6.5, 5); });
      fill(c, '#FFD6E6'); line(c, M_INK, 1);
      c.strokeStyle = 'rgba(239,138,180,0.7)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-3, 6); c.lineTo(-5, 13.4); c.moveTo(3, 6); c.lineTo(5, 13.4); c.moveTo(0, 6); c.lineTo(0, 14); c.stroke();
      rr(c, -7, 3.6, 14, 2.2, 1); fill(c, '#F5B82E'); line(c, M_INK, 0.8);
      if (opts.hasHelm) {
        path(c, () => { c.moveTo(-6, -15); c.quadraticCurveTo(0, -18.5, 6, -15); c.lineTo(5.5, -13.6); c.quadraticCurveTo(0, -16.6, -5.5, -13.6); });
        fill(c, '#F5B82E'); line(c, M_INK, 0.8);
        c.fillStyle = '#EF8AB4';
        for (const [fx, ang] of [[-4, -0.85], [-1.6, -0.3], [1.6, 0.3], [4, 0.85]]) { c.save(); c.translate(fx, -16.4); c.rotate(ang); c.beginPath(); c.ellipse(0, -2, 1.3, 2.4, 0, 0, Math.PI * 2); c.fill(); line(c, M_INK, 0.7); c.restore(); }
        c.fillStyle = '#9adcff'; circle(c, 0, -15.6, 1); c.fill();
      }
    } else if (opts.hasBody) {
      // plated armour over the capsule: pauldrons, chest seam + rivets
      c.fillStyle = shade(body, 0.08); circle(c, -6.2, -2.2, 2.6); c.fill(); line(c, M_INK, 1); circle(c, 6.2, -2.2, 2.6); c.fill(); line(c, M_INK, 1);
      c.strokeStyle = shade(body, -0.3); c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -1); c.lineTo(0, 10); c.stroke();
      c.fillStyle = '#eef2f6'; for (const [rx, ry] of [[-3, 0.5], [3, 0.5], [-3, 4], [3, 4]]) { circle(c, rx, ry, 0.55); c.fill(); }
    } else {
      // a small gold sun pip on the tunic, the brand's marker pop
      c.fillStyle = '#F5B82E'; circle(c, -3.4, 2.2, 1.3); c.fill(); line(c, M_INK, 0.7);
    }
    if (opts.hasHelm && !dancer) {
      path(c, () => { c.arc(0, -12, 7.6, Math.PI, 0); c.closePath(); }); fill(c, '#9aa6b2'); line(c, M_INK, 1.2);
      rr(c, -7.8, -13.4, 15.6, 2.2, 1); fill(c, '#cfd6dd'); line(c, M_INK, 0.8);
      c.fillStyle = '#b9c2cc'; rr(c, -1.4, -22, 2.8, 3.4, 1); c.fill();
      c.fillStyle = '#C0392B'; path(c, () => { c.moveTo(-1.4, -21); c.quadraticCurveTo(-5.5, -23.5, -4.5, -28); c.quadraticCurveTo(-1, -24.5, 1.4, -22); }); c.fill(); // plume
      c.fillStyle = 'rgba(255,255,255,0.4)'; rr(c, -5.5, -17.5, 3, 1, 0.5); c.fill();
    }
    });
    _anim.stride = was;
    // weapon, held in the right mitten, animated through each attack
    // (opts.swingK: 0..1 progress of the current swing, or -1 when idle).
    const k = opts.swingK ?? -1;
    if (opts.hasWeapon && opts.weaponType === 'ranged') {
      // Bow: the string draws back with an arrow nocked, then snaps on release.
      const draw = k < 0 ? 0 : k < 0.55 ? Math.sin((k / 0.55) * Math.PI / 2) : 0;
      const twang = k >= 0.55 ? Math.sin((k - 0.55) * 40) * (1 - k) * 2.2 : 0;
      const sx = 11.6 - draw * 6.5 + twang;
      c.lineCap = 'round';
      c.strokeStyle = M_INK; c.lineWidth = 3; c.beginPath(); c.arc(8.5, 1, 10, -Math.PI * 0.42, Math.PI * 0.42); c.stroke();
      c.strokeStyle = '#B07D2A'; c.lineWidth = 1.7; c.beginPath(); c.arc(8.5, 1, 10, -Math.PI * 0.42, Math.PI * 0.42); c.stroke();
      c.strokeStyle = '#F0EEE8'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(11.6, -8.3); c.lineTo(sx, 1); c.lineTo(11.6, 10.3); c.stroke(); // string
      if (draw > 0.05) {   // nocked arrow
        c.strokeStyle = '#8A5A2B'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(sx, 1); c.lineTo(sx + 13, 1); c.stroke();
        c.fillStyle = '#cfd6dd'; path(c, () => { c.moveTo(sx + 15.5, 1); c.lineTo(sx + 12.5, -0.9); c.lineTo(sx + 12.5, 2.9); }); c.fill();
      }
      c.lineCap = 'butt';
      circle(c, sx - 1.5 + (draw > 0.05 ? 0 : 3), 3 + (draw > 0.05 ? -2 : 1), 1.8); fill(c, '#ffffff'); line(c, M_INK, 1);
    } else if (opts.hasWeapon && opts.weaponType === 'magic') {
      // Staff: tips toward the foe while the orb swells and flares.
      const flare = k < 0 ? 0 : Math.sin(k * Math.PI);
      c.save(); c.translate(10.8, 4); c.rotate(flare * 0.45); c.translate(-10.8, -4);
      c.lineCap = 'round';
      c.strokeStyle = M_INK; c.lineWidth = 3; c.beginPath(); c.moveTo(10.4, 12); c.lineTo(12.6, -14); c.stroke();
      c.strokeStyle = '#8A5A2B'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(10.4, 12); c.lineTo(12.6, -14); c.stroke();
      c.lineCap = 'butt';
      if (flare > 0) {
        c.fillStyle = `rgba(200,150,255,${(0.45 * flare).toFixed(3)})`; circle(c, 12.8, -16, 5 + flare * 5); c.fill();
      }
      circle(c, 12.8, -16, 2.8 + flare * 1.6); fill(c, flare > 0.4 ? '#C890F0' : '#9B52AD'); line(c, M_INK, 1.1);
      c.fillStyle = 'rgba(255,255,255,0.7)'; circle(c, 12, -16.9, 0.9 + flare); c.fill();
      c.restore();
      circle(c, 10.8, 4, 1.8); fill(c, '#ffffff'); line(c, M_INK, 1);
    } else if (opts.hasWeapon && dancer) {
      // Whip: coiled at rest; on an attack it winds back, then snaps out in a
      // travelling wave and cracks at the tip.
      const t = opts.time || 0;
      const reach = k < 0 ? 0 : k < 0.25 ? -0.3 * (k / 0.25) : k < 0.55 ? -0.3 + 1.3 * ((k - 0.25) / 0.3) : 1 - (k - 0.55) / 0.45;
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      const pts = [];
      if (reach <= 0.02) {
        // idle: a loose loop hanging from the hand, swaying gently
        const sw = Math.sin(t * 0.004) * 0.8;
        pts.push([10.6, 4], [13.5 + sw, 8], [12 + sw, 12], [9 + sw, 11], [10 + sw, 8.5], [14 + sw, 10]);
      } else {
        const len = 6 + reach * 30, seg = 7;
        for (let i = 0; i <= seg; i++) {
          const f = i / seg;
          pts.push([10.6 + f * len, 4 - f * 3 + Math.sin(f * 7 - (k || 0) * 18) * (2.5 * f) * (1.2 - reach * 0.6)]);
        }
      }
      const stroke = (w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; c.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2); }
        c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); c.stroke(); };
      stroke(2.6, M_INK); stroke(1.3, '#8A5A2B');
      if (reach > 0.85) {   // the crack: a little starburst at the tip
        const [tx, ty] = pts[pts.length - 1];
        c.fillStyle = '#FFE89A';
        c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 1.4 : 4; c.lineTo(tx + Math.cos(a) * r, ty + Math.sin(a) * r); } c.closePath(); c.fill();
        line(c, M_INK, 0.6);
      }
      c.restore();
      rr(c, 8.8, 2.4, 3.6, 4, 1.4); fill(c, '#5A3A1E'); line(c, M_INK, 0.8);   // handle
      circle(c, 10.6, 4, 1.8); fill(c, '#ffffff'); line(c, M_INK, 1);
    } else if (opts.hasWeapon) {
      // Sword: wind up behind, sweep through the strike, follow through, recover.
      const ease = (t) => 1 - (1 - t) * (1 - t);
      const ang = k < 0 ? 0
        : k < 0.3 ? -1.0 * ease(k / 0.3)
        : k < 0.62 ? -1.0 + 2.4 * ease((k - 0.3) / 0.32)
        : 1.4 * (1 - ease((k - 0.62) / 0.38));
      c.save(); c.translate(10, 4); c.rotate(ang); c.translate(-10, -4);
      if (k > 0.3 && k < 0.7) {   // motion smear behind the blade
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.arc(10, 4, 17, -Math.PI / 2 - 0.9, -Math.PI / 2 - 0.15); c.stroke();
      }
      c.strokeStyle = M_INK; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(10.6, 2); c.lineTo(14.6, -16); c.stroke();
      c.strokeStyle = '#e9edf2'; c.lineWidth = 2; c.beginPath(); c.moveTo(10.6, 2); c.lineTo(14.6, -16); c.stroke();
      c.fillStyle = '#ffffff'; circle(c, 14, -14, 0.7); c.fill(); // tip glint
      c.strokeStyle = M_INK; c.lineWidth = 2.6; c.beginPath(); c.moveTo(8.6, 1); c.lineTo(13.2, 2.4); c.stroke();
      c.strokeStyle = '#F5B82E'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(8.6, 1); c.lineTo(13.2, 2.4); c.stroke(); // crossguard
      c.lineCap = 'butt';
      c.restore();
      circle(c, 10, 4, 1.8); fill(c, '#ffffff'); line(c, M_INK, 1); // mitten over the grip
    }
    // off-hand dagger when dual wielding: a short blade in the left mitten that
    // jabs on the follow-up beat of each swing
    if (opts.dualWield) {
      const ease = (t) => 1 - (1 - t) * (1 - t);
      const jab = k < 0.35 ? 0 : k < 0.7 ? ease((k - 0.35) / 0.35) : 1 - ease((k - 0.7) / 0.3);
      c.save(); c.translate(-10, 4); c.rotate(0.5 - jab * 1.3); c.translate(10, -4);
      c.lineCap = 'round';
      c.strokeStyle = M_INK; c.lineWidth = 3.2; c.beginPath(); c.moveTo(-10.4, 2); c.lineTo(-12.8, -9); c.stroke();
      c.strokeStyle = '#e9edf2'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-10.4, 2); c.lineTo(-12.8, -9); c.stroke();
      c.strokeStyle = M_INK; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-12.6, 1.2); c.lineTo(-8.4, 2.4); c.stroke();
      c.strokeStyle = '#F5B82E'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-12.6, 1.2); c.lineTo(-8.4, 2.4); c.stroke();
      c.lineCap = 'butt';
      c.restore();
      circle(c, -10, 4, 1.8); fill(c, '#ffffff'); line(c, M_INK, 1);
    }
    // shield, strapped to the off-hand
    if (opts.hasShield) {
      const sx = -12, sy = 3;
      path(c, () => {
        c.moveTo(sx, sy - 7); c.lineTo(sx + 4, sy - 5); c.lineTo(sx + 4, sy + 3);
        c.quadraticCurveTo(sx + 4, sy + 8, sx, sy + 10);
        c.quadraticCurveTo(sx - 4, sy + 8, sx - 4, sy + 3); c.lineTo(sx - 4, sy - 5);
      });
      fill(c, '#8a96a2'); line(c, OUTLINE, 1.1);
      c.fillStyle = 'rgba(255,255,255,0.32)';
      path(c, () => { c.moveTo(sx - 3, sy - 4); c.lineTo(sx - 1, sy - 4); c.lineTo(sx - 1, sy + 6); c.lineTo(sx - 3, sy + 4); }); c.fill();
      c.fillStyle = '#e6b34a'; circle(c, sx, sy, 1.7); c.fill(); // boss/emblem
      c.fillStyle = '#fff3c0'; circle(c, sx - 0.5, sy - 0.7, 0.6); c.fill();
    }
  });
}

// ================= OBJECTS =================
// Objects that never animate are cached as bitmaps; trees too, with their
// sway applied as a gentle lean about the trunk base.
const CACHED_OBJECTS = new Set(['tree', 'rock', 'anvil', 'craft', 'bank', 'rest', 'agility', 'stall', 'transport', 'scenery']);

// Painted world art (assets/world/<key>.webp): trees and their stumps, ore
// rocks, stations, stalls, agility obstacles, scenery, fishing spots and Hunter
// traps. Each entry is [max width, max height, feet below the tile centre] in
// pixels; the picture is fitted inside and stood on that line. Anything
// without art (fires, farm patches) keeps its drawn sprite.
const TREE_IDS = ['tree', 'oak', 'willow', 'rain_tree', 'yew_tree', 'magic_tree', 'bamboo', 'angsana', 'teak', 'mangrove', 'mahogany', 'tembusu'];
const ROCK_IDS = ['copper', 'tin', 'iron', 'coal', 'mithril', 'adamantite', 'runite', 'gold', 'clay', 'limestone', 'silver', 'sandstone', 'gem', 'granite'].map((o) => `${o}_rock`);
const WORLD_ART = {
  ...Object.fromEntries(TREE_IDS.flatMap((t) => [[`tree-${t}`, [66, 74, 15]], [`stump-${t}`, [34, 28, 14]]])),
  ...Object.fromEntries(ROCK_IDS.map((r) => [`rock-${r}`, [38, 34, 14]])),
  'rock-empty': [36, 32, 14],
  'obj-furnace': [50, 50, 16], 'obj-anvil': [40, 38, 15], 'obj-range': [50, 46, 16], 'obj-crafting_table': [52, 42, 16],
  'obj-apothecary_table': [52, 42, 16], 'obj-fletching_bench': [52, 42, 16], 'obj-bank_booth': [56, 54, 16],
  'obj-shrine': [54, 56, 16], 'obj-mascot_statue': [48, 54, 16], 'obj-mrt_station': [66, 50, 16],
  'obj-stall_food': [56, 50, 16], 'obj-stall_market': [56, 50, 16], 'obj-stall_gem': [56, 50, 16],
  'obj-agility_course': [60, 48, 16], 'obj-agility_balance': [50, 34, 15], 'obj-agility_net': [46, 46, 16],
  'obj-agility_rope': [44, 46, 16], 'obj-agility_ledge': [44, 42, 16], 'obj-agility_zip': [48, 46, 16],
  'obj-wall': [40, 36, 15], 'obj-ruin': [44, 44, 15], 'obj-fence': [40, 34, 15], 'obj-bush': [34, 30, 14],
  'obj-flower': [28, 26, 13], 'obj-palm': [50, 66, 15], 'obj-lamp': [24, 54, 15], 'obj-sign': [28, 38, 15],
  'obj-fishing_spot': [42, 30, 12], 'obj-rod_spot': [42, 34, 12], 'obj-sea_rod_spot': [42, 34, 12],
  'obj-fishing_cage': [42, 32, 12], 'obj-harpoon_spot': [42, 34, 12],
  'obj-bird_snare': [40, 34, 14], 'obj-squirrel_trap': [40, 34, 14], 'obj-lizard_snare': [40, 34, 14],
  'obj-mousedeer_trail': [40, 34, 14], 'obj-boar_pit': [42, 34, 14], 'obj-python_trap': [44, 34, 14],
  'obj-crocodile_trap': [44, 32, 14], 'obj-hornbill_nest': [40, 40, 14], 'obj-qilin_trail': [40, 34, 14],
  // Animated: a campfire's four flicker frames, and a farm patch's five growth stages.
  ...Object.fromEntries([0, 1, 2, 3].map((i) => [`obj-fire-${i}`, [32, 42, 14]])),
  ...Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`obj-farm_patch-${i}`, [42, 36, 15]])),
};
const FIRE_FRAME_MS = 110;
/** A farm patch's growth stage: 0 empty, 1 planted, 2 sprouting, 3 growing, 4 ripe. */
function farmStage(obj) {
  if (!obj.crop) return 0;
  const grow = cropGrowTicks(obj.crop);
  const k = grow ? 1 - (obj.growLeft || 0) / grow : 1;
  return k >= 1 ? 4 : k >= 0.5 ? 3 : k >= 0.15 ? 2 : 1;
}
/** The painted-art key for a world object, or null to keep its drawn sprite. */
function worldArtKey(obj, time = 0) {
  const t = obj.def.type;
  if (t === 'fire') return `obj-fire-${Math.floor(time / FIRE_FRAME_MS + obj.x * 3 + obj.y) % 4}`;   // each fire on its own beat
  if (t === 'farm') return `obj-farm_patch-${farmStage(obj)}`;
  if (t === 'tree') return obj.depleted ? `stump-${obj.objId}` : `tree-${obj.objId}`;
  if (t === 'rock') return obj.depleted ? 'rock-empty' : `rock-${obj.objId}`;
  return `obj-${obj.objId}`;
}
const _worldImg = {};
function worldImage(key) {
  if (!WORLD_ART[key]) return null;
  if (_worldImg[key] !== undefined) return _worldImg[key];
  if (typeof Image === 'undefined') { _worldImg[key] = null; return null; }
  const img = new Image();
  img.src = `assets/world/${key}.webp`;
  _worldImg[key] = img;
  return img;
}
export const worldArt = () => new Set(Object.keys(WORLD_ART));
function drawWorldArt(ctx, obj, img, key, cx, cy, time) {
  const [mw, mh, foot] = WORLD_ART[key];
  const s = Math.min(mw / img.naturalWidth, mh / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  const t = obj.def.type;
  if (t !== 'fishing') {   // a soft contact shadow; fishing spots sit in the water
    ctx.fillStyle = 'rgba(34,48,74,0.16)';
    ellipse(ctx, cx, cy + foot - 1, Math.min(w * 0.42, 22), Math.min(h * 0.12, 5)); ctx.fill();
  }
  ctx.save();
  // Spent stalls, traps and fishing spots fade back; trees and rocks swap pictures instead.
  if (obj.depleted && t !== 'tree' && t !== 'rock') ctx.globalAlpha = 0.5;
  if (t === 'tree' && !obj.depleted) {
    // The canopy leans gently about the base of the trunk.
    const sway = Math.sin(time * 0.0012 + obj.x * 1.7 + obj.y) * 1.4;
    ctx.translate(cx, cy + foot);
    ctx.transform(1, 0, -sway / 38, 1, 0, 0);
    ctx.drawImage(img, -w / 2, -h, w, h);
  } else if (t === 'fishing') {
    // Fishing spots bob on the swell.
    const bob = Math.sin(time * 0.003 + obj.x + obj.y * 0.7) * 1.2;
    ctx.drawImage(img, cx - w / 2, cy + foot - h + bob, w, h);
  } else ctx.drawImage(img, cx - w / 2, cy + foot - h, w, h);
  ctx.restore();
}

export function drawObjectSprite(ctx, obj, cx, cy, time = 0) {
  const t = obj.def.type;
  const key = worldArtKey(obj, time);
  // Load every frame of an animated object together, so it never drops back
  // to its drawn version between frames.
  if (t === 'fire' || t === 'farm') for (const k of Object.keys(WORLD_ART)) if (k.startsWith(t === 'fire' ? 'obj-fire-' : 'obj-farm_patch-')) worldImage(k);
  const art = key && worldImage(key);
  if (art && art.complete && art.naturalWidth) { drawWorldArt(ctx, obj, art, key, cx, cy, time); return; }
  if (CACHED_OBJECTS.has(t)) {
    const key = `obj|${t}|${obj.objId}|${obj.def.ore || ''}|${obj.depleted ? 1 : 0}`;
    const img = cachedBitmap(key, OBJ_BOX, (g) => drawObjectRaw(g, obj, 0, 0, 0));
    if (img) {
      if (t === 'tree' && !obj.depleted) {
        const sway = Math.sin(time * 0.0012 + obj.x * 1.7 + obj.y) * 1.4;
        ctx.save();
        ctx.translate(cx, cy + 12);
        ctx.transform(1, 0, -sway / 38, 1, 0, 0);
        ctx.drawImage(img, OBJ_BOX.x0, OBJ_BOX.y0 - 12, OBJ_BOX.w, OBJ_BOX.h);
        ctx.restore();
      } else ctx.drawImage(img, cx + OBJ_BOX.x0, cy + OBJ_BOX.y0, OBJ_BOX.w, OBJ_BOX.h);
      return;
    }
  }
  return drawObjectRaw(ctx, obj, cx, cy, time);
}

function drawObjectRaw(ctx, obj, cx, cy, time) {
  const t = obj.def.type;
  switch (t) {
    case 'tree': return tree(ctx, obj.objId, obj.depleted, cx, cy, time);
    case 'rock': return rock(ctx, obj.def.ore, obj.depleted, cx, cy);
    case 'fishing': return fishing(ctx, cx, cy, time);
    case 'fire': return fire(ctx, cx, cy, time);
    case 'range': return range(ctx, cx, cy, time);
    case 'furnace': return furnace(ctx, cx, cy, time);
    case 'anvil': return anvil(ctx, cx, cy);
    case 'craft': return craftTable(ctx, cx, cy);
    case 'farm': return farmPatch(ctx, obj, cx, cy, time);
    case 'herblore': return apothecaryTable(ctx, cx, cy, time);
    case 'fletch': return fletchingBench(ctx, cx, cy);
    case 'hunt': return huntTrap(ctx, obj, cx, cy);
    case 'bank': return bank(ctx, cx, cy);
    case 'shrine': return shrine(ctx, cx, cy, time);
    case 'rest': return mascotStatue(ctx, cx, cy);
    case 'agility': return agilityCourse(ctx, cx, cy);
    case 'stall': return stall(ctx, obj.objId, obj.depleted, cx, cy);
    case 'transport': return mrtStation(ctx, cx, cy);
    case 'scenery': return scenery(ctx, obj.objId, cx, cy, time);
    default: return;
  }
}

// Per-species tree profiles so each resource tree reads distinctly.
const TREES = {
  // Pastel canopies: soft greens with a lighter top, warm caramel trunks.
  tree: { shape: 'round', base: '#7cc68a', dark: '#5aa86c', r: 15, trunk: '#b58a5e' },
  oak: { shape: 'round', base: '#6fbf7e', dark: '#4f9f62', r: 19, trunk: '#a87e55', tw: 8 },
  willow: { shape: 'droop', base: '#b4dc8c', dark: '#90c270', r: 16, trunk: '#b08c62' },
  rain_tree: { shape: 'umbrella', base: '#86cf8e', dark: '#62b270', r: 20, trunk: '#b58a5e' },
  yew_tree: { shape: 'conifer', base: '#6aae86', dark: '#4e9270', r: 16, trunk: '#9a744e' },
  magic_tree: { shape: 'round', base: '#9fdcef', dark: '#74c0dc', r: 16, trunk: '#b8a8d0', glow: '#c8f0ff' },
  bamboo: { shape: 'bamboo', base: '#b2d47a', dark: '#90b85e', trunk: '#b8d080' },
  angsana: { shape: 'umbrella', base: '#a2d880', dark: '#80bc64', r: 19, trunk: '#b8905e' },
  teak: { shape: 'round', base: '#92cc7c', dark: '#70b062', r: 18, trunk: '#c0905e' },
  mangrove: { shape: 'mangrove', base: '#8cc0a0', dark: '#6aa284', r: 15, trunk: '#a08460' },
  mahogany: { shape: 'round', base: '#7fc483', dark: '#5ea666', r: 18, trunk: '#b8725a' },
  tembusu: { shape: 'umbrella', base: '#86c894', dark: '#64aa76', r: 21, trunk: '#a8905e' },
};
function leafyBlob(ctx, cxx, cyy, r, base, dark) {
  ctx.fillStyle = dark;
  circle(ctx, cxx - r * 0.55, cyy + 3, r * 0.72); ctx.fill();
  circle(ctx, cxx + r * 0.55, cyy + 3, r * 0.72); ctx.fill();
  circle(ctx, cxx, cyy - 3, r * 0.8); ctx.fill();
  ctx.fillStyle = base; circle(ctx, cxx, cyy - 1, r * 0.85); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  circle(ctx, cxx + r * 0.3, cyy - r * 0.1, r * 0.26); ctx.fill();
  circle(ctx, cxx - r * 0.1, cyy + r * 0.25, r * 0.22); ctx.fill();
  ctx.fillStyle = 'rgba(40,90,60,0.12)'; circle(ctx, cxx + r * 0.4, cyy + r * 0.35, r * 0.22); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,235,0.32)'; circle(ctx, cxx - r * 0.38, cyy - r * 0.5, r * 0.38); ctx.fill();
  ctx.strokeStyle = 'rgba(34,48,74,0.45)'; ctx.lineWidth = 1.8; circle(ctx, cxx, cyy - 1, r * 0.85); ctx.stroke();
}
function tree(ctx, variant, depleted, cx, cy, time) {
  if (depleted) {
    ctx.fillStyle = '#6b4a2a'; rr(ctx, cx - 5, cy + 2, 10, 9, 2); ctx.fill();
    ctx.fillStyle = '#7d5a36'; ellipse(ctx, cx, cy + 2, 6, 2.5); ctx.fill();
    line(ctx, OUTLINE, 1.5);
    return;
  }
  const sway = Math.sin(time * 0.0012 + cx) * 1.4;
  const t = TREES[variant] || TREES.tree;
  const trunk = t.trunk, tw = t.tw || 7, r = t.r || 15;
  const cxx = cx + sway, cyy = cy - 9;
  // magic aura behind the canopy
  if (t.glow) {
    const g = ctx.createRadialGradient(cxx, cyy, 2, cxx, cyy, r * 1.6);
    g.addColorStop(0, rgba(t.glow, 0.4)); g.addColorStop(1, rgba(t.glow, 0));
    ctx.fillStyle = g; circle(ctx, cxx, cyy, r * 1.6); ctx.fill();
  }

  // ---- Bamboo: a clump of segmented stalks, no trunk/canopy ----
  if (t.shape === 'bamboo') {
    for (const [ox, h, w] of [[-5, 26, 2.6], [0, 32, 3], [5, 24, 2.4]]) {
      const sx = cx + ox + sway * (h / 32);
      ctx.fillStyle = ox === 0 ? t.base : shade(t.base, ox < 0 ? -0.12 : 0.1);
      rr(ctx, sx - w / 2, cy + 12 - h, w, h, 1.2); ctx.fill(); line(ctx, OUTLINE, 1);
      ctx.strokeStyle = shade(t.base, -0.3); ctx.lineWidth = 0.8;
      for (let yy = cy + 12 - h + 4; yy < cy + 11; yy += 6) { ctx.beginPath(); ctx.moveTo(sx - w / 2, yy); ctx.lineTo(sx + w / 2, yy); ctx.stroke(); }
      // leaf blades near the top
      ctx.strokeStyle = t.dark; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, cy + 12 - h + 2); ctx.lineTo(sx - 6, cy + 12 - h - 4); ctx.moveTo(sx, cy + 12 - h + 4); ctx.lineTo(sx + 6, cy + 12 - h - 2); ctx.stroke(); ctx.lineCap = 'butt';
    }
    return;
  }

  // trunk
  ctx.fillStyle = trunk; rr(ctx, cx - tw / 2, cy - 2, tw, 16, 2); ctx.fill(); line(ctx, OUTLINE, 1.5);
  ctx.fillStyle = shade(trunk, -0.2); rr(ctx, cx + tw / 2 - 2, cy - 2, 2, 16, 1); ctx.fill();
  ctx.fillStyle = shade(trunk, 0.18); rr(ctx, cx - tw / 2, cy - 2, 1.4, 16, 0.7); ctx.fill();
  // mangrove prop roots splayed from the base
  if (t.shape === 'mangrove') {
    ctx.strokeStyle = shade(trunk, -0.08); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 1.5, cy + 4); ctx.quadraticCurveTo(cx + s * 6, cy + 8, cx + s * 7.5, cy + 14); ctx.stroke(); }
    ctx.lineCap = 'butt';
  }

  if (t.shape === 'umbrella') {
    // broad flattened parasol canopy in two layers
    ctx.fillStyle = t.dark; ellipse(ctx, cxx, cyy + 1, r * 1.25, r * 0.62); ctx.fill();
    ctx.fillStyle = t.base; ellipse(ctx, cxx, cyy - 2, r * 1.15, r * 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,0.22)'; ellipse(ctx, cxx - r * 0.4, cyy - 3.5, r * 0.5, r * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(20,45,18,0.16)'; ellipse(ctx, cxx + r * 0.3, cyy + 2.5, r * 0.6, r * 0.22); ctx.fill();
    ctx.strokeStyle = 'rgba(20,40,18,0.32)'; ctx.lineWidth = 1.8; ellipse(ctx, cxx, cyy + 1, r * 1.25, r * 0.62); ctx.stroke();
  } else if (t.shape === 'conifer') {
    // stacked dark tiers
    for (let i = 0; i < 3; i++) {
      const ty = cyy + 4 - i * 6, tw2 = r * (1 - i * 0.22);
      ctx.fillStyle = i % 2 ? t.base : t.dark;
      path(ctx, () => { ctx.moveTo(cxx - tw2, ty); ctx.lineTo(cxx, ty - 9); ctx.lineTo(cxx + tw2, ty); }); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,240,180,0.18)'; path(ctx, () => { ctx.moveTo(cxx - 2, cyy - 11); ctx.lineTo(cxx, cyy - 14); ctx.lineTo(cxx + 1.5, cyy - 11); }); ctx.fill();
  } else {
    // round canopy (default / oak / teak / mahogany / mangrove)
    leafyBlob(ctx, cxx, cyy, r, t.base, t.dark);
    if (t.shape === 'droop') {
      // willow: drooping fronds beneath the canopy
      ctx.strokeStyle = t.dark; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      for (let i = -3; i <= 3; i++) {
        const fx = cxx + i * (r * 0.42);
        ctx.beginPath(); ctx.moveTo(fx, cyy + 2); ctx.quadraticCurveTo(fx + 1.5, cyy + 9, fx - 1, cyy + 14 + Math.abs(i)); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }
  // magic sparkles
  if (t.glow) {
    ctx.fillStyle = '#fff';
    for (const [sx, sy] of [[cxx - 4, cyy - 6], [cxx + 6, cyy], [cxx + 2, cyy - 10]]) { circle(ctx, sx, sy, 0.9); ctx.fill(); }
  }
}

function rock(ctx, ore, depleted, cx, cy) {
  drawShadow(ctx, cx, cy + 9, 13, 5);
  // base stone tinted faintly toward the ore's colour so each material reads distinctly
  const base = depleted ? '#5c5c5c' : (ore ? mix('#828790', ore, 0.17) : '#828790');
  ctx.fillStyle = base;
  path(ctx, () => {
    ctx.moveTo(cx - 12, cy + 9); ctx.lineTo(cx - 9, cy - 7); ctx.lineTo(cx - 1, cy - 11);
    ctx.lineTo(cx + 8, cy - 8); ctx.lineTo(cx + 12, cy + 2); ctx.lineTo(cx + 8, cy + 10);
  });
  ctx.fill(); line(ctx, 'rgba(30,30,34,0.5)', 2);
  // shaded lower-right facet for 3D form
  ctx.fillStyle = 'rgba(20,20,26,0.24)';
  path(ctx, () => { ctx.moveTo(cx + 2, cy - 4); ctx.lineTo(cx + 12, cy + 2); ctx.lineTo(cx + 8, cy + 10); ctx.lineTo(cx - 1, cy + 9); }); ctx.fill();
  // top highlight facet
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  path(ctx, () => { ctx.moveTo(cx - 9, cy - 7); ctx.lineTo(cx - 1, cy - 11); ctx.lineTo(cx + 2, cy - 4); ctx.lineTo(cx - 6, cy - 2); }); ctx.fill();
  // a cleft crack for stone texture
  ctx.strokeStyle = 'rgba(20,20,26,0.3)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx - 3, cy - 6); ctx.lineTo(cx - 1, cy - 1); ctx.lineTo(cx - 4, cy + 4); ctx.stroke();
  if (!depleted && ore) {
    // embedded ore nuggets, each with a shadow + glint for relief
    for (const [dx, dy, r] of [[-5, 1, 2.1], [3, 4, 1.9], [-1, -4, 1.7], [6, -1, 1.8], [1, 7, 1.2]]) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; circle(ctx, cx + dx + 0.5, cy + dy + 0.6, r); ctx.fill();
      ctx.fillStyle = ore; circle(ctx, cx + dx, cy + dy, r); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(ctx, cx + dx - 0.5, cy + dy - 0.6, r * 0.34); ctx.fill();
    }
  }
}

function fishing(ctx, cx, cy, time) {
  const phase = time * 0.004;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const k = (phase + i * 0.9) % 2.4;
    ctx.globalAlpha = Math.max(0, 0.55 - k / 4);
    circle(ctx, cx, cy, 4 + k * 6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // little fish hint
  ctx.fillStyle = 'rgba(180,220,255,0.9)';
  ellipse(ctx, cx + 4, cy - 1, 3, 1.6); ctx.fill();
  path(ctx, () => { ctx.moveTo(cx + 1, cy - 1); ctx.lineTo(cx - 2, cy - 3); ctx.lineTo(cx - 2, cy + 1); }); ctx.fill();
}

function glow(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; circle(ctx, cx, cy, r); ctx.fill();
}

function fire(ctx, cx, cy, time) {
  glow(ctx, cx, cy - 2, 26, 'rgba(255,150,40,0.30)');
  // logs
  ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 7, cy + 8); ctx.lineTo(cx + 7, cy + 6);
  ctx.moveTo(cx - 7, cy + 6); ctx.lineTo(cx + 7, cy + 8); ctx.stroke(); ctx.lineCap = 'butt';
  const f = 1 + Math.sin(time * 0.02) * 0.12;
  const f2 = 1 + Math.sin(time * 0.027 + 1) * 0.14;
  ctx.fillStyle = '#e8521f';
  path(ctx, () => { ctx.moveTo(cx - 7 * f, cy + 6); ctx.quadraticCurveTo(cx - 9, cy - 6 * f, cx, cy - 16 * f); ctx.quadraticCurveTo(cx + 9, cy - 6 * f, cx + 7 * f, cy + 6); }); ctx.fill();
  ctx.fillStyle = '#f7a519';
  path(ctx, () => { ctx.moveTo(cx - 4 * f2, cy + 5); ctx.quadraticCurveTo(cx - 5, cy - 4, cx, cy - 11 * f2); ctx.quadraticCurveTo(cx + 5, cy - 4, cx + 4 * f2, cy + 5); }); ctx.fill();
  ctx.fillStyle = '#ffe07a';
  path(ctx, () => { ctx.moveTo(cx - 2, cy + 3); ctx.quadraticCurveTo(cx - 2, cy - 3, cx, cy - 7 * f2); ctx.quadraticCurveTo(cx + 2, cy - 3, cx + 2, cy + 3); }); ctx.fill();
}

function range(ctx, cx, cy, time) {
  drawShadow(ctx, cx, cy + 11, 14, 5);
  // stone body
  ctx.fillStyle = '#7c7468'; rr(ctx, cx - 13, cy - 6, 26, 18, 3); ctx.fill(); line(ctx, 'rgba(30,26,20,0.5)', 2);
  ctx.fillStyle = '#8c8478'; rr(ctx, cx - 13, cy - 6, 26, 4, 3); ctx.fill();
  // fire mouth
  ctx.fillStyle = '#1c1410'; rr(ctx, cx - 9, cy + 1, 18, 9, 2); ctx.fill();
  const f = 1 + Math.sin(time * 0.02) * 0.15;
  ctx.fillStyle = '#e8521f'; path(ctx, () => { ctx.moveTo(cx - 6, cy + 9); ctx.quadraticCurveTo(cx - 4, cy + 2 * f, cx, cy + 1); ctx.quadraticCurveTo(cx + 4, cy + 2 * f, cx + 6, cy + 9); }); ctx.fill();
  ctx.fillStyle = '#ffce4a'; path(ctx, () => { ctx.moveTo(cx - 3, cy + 9); ctx.quadraticCurveTo(cx, cy + 3 * f, cx + 3, cy + 9); }); ctx.fill();
  // pot
  ctx.fillStyle = '#3a3a40'; rr(ctx, cx - 7, cy - 12, 14, 8, 3); ctx.fill(); line(ctx, 'rgba(0,0,0,0.4)', 1.5);
}

function furnace(ctx, cx, cy, time) {
  drawShadow(ctx, cx, cy + 13, 15, 5);
  ctx.fillStyle = '#7a4a36'; path(ctx, () => { ctx.moveTo(cx - 13, cy + 12); ctx.lineTo(cx - 10, cy - 12); ctx.lineTo(cx + 10, cy - 12); ctx.lineTo(cx + 13, cy + 12); }); ctx.fill(); line(ctx, 'rgba(30,16,10,0.5)', 2);
  // brick lines
  ctx.strokeStyle = 'rgba(40,20,12,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 11, cy - 2); ctx.lineTo(cx + 11, cy - 2); ctx.moveTo(cx - 12, cy + 5); ctx.lineTo(cx + 12, cy + 5); ctx.stroke();
  // glowing opening
  glow(ctx, cx, cy + 3, 16, 'rgba(255,140,40,0.4)');
  ctx.fillStyle = '#1c1208'; rr(ctx, cx - 7, cy + 1, 14, 10, 3); ctx.fill();
  const f = 1 + Math.sin(time * 0.03) * 0.2;
  ctx.fillStyle = '#ff9a2e'; rr(ctx, cx - 5, cy + 4, 10, 6 * f, 2); ctx.fill();
  ctx.fillStyle = '#ffe07a'; rr(ctx, cx - 2.5, cy + 5, 5, 4 * f, 1); ctx.fill();
  // chimney
  ctx.fillStyle = '#6b4030'; rr(ctx, cx + 4, cy - 18, 6, 7, 1); ctx.fill();
}

function craftTable(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 14, 4.5);
  // workbench top + legs
  ctx.fillStyle = '#7a5230'; rr(ctx, cx - 12, cy - 2, 24, 6, 2); ctx.fill(); line(ctx, OUTLINE, 1.4);
  ctx.fillStyle = '#5a3a1c'; rr(ctx, cx - 10, cy + 4, 3, 9, 1); ctx.fill(); rr(ctx, cx + 7, cy + 4, 3, 9, 1); ctx.fill();
  line(ctx, OUTLINE, 1.2);
  // tools/wares on the bench
  ctx.fillStyle = '#c9603a'; rr(ctx, cx - 9, cy - 7, 5, 5, 1); ctx.fill(); line(ctx, OUTLINE, 1); // little pot
  ctx.fillStyle = '#e6b34a'; circle(ctx, cx + 2, cy - 4, 2.4); ctx.fill(); line(ctx, OUTLINE, 1);  // gold
  ctx.fillStyle = '#7aa6ff'; circle(ctx, cx + 7, cy - 4, 1.8); ctx.fill(); line(ctx, OUTLINE, 0.9); // gem
}

// Farm patch: a bed of tilled soil; a planted crop sprouts, grows and ripens.
function farmPatch(ctx, obj, cx, cy, time) {
  ctx.fillStyle = '#7a5230'; rr(ctx, cx - 14, cy - 4, 28, 18, 4); ctx.fill(); line(ctx, OUTLINE, 1.2);
  ctx.strokeStyle = 'rgba(40,24,10,0.35)'; ctx.lineWidth = 1;
  for (const dy of [0, 5, 10]) { ctx.beginPath(); ctx.moveTo(cx - 11, cy + dy); ctx.lineTo(cx + 11, cy + dy); ctx.stroke(); }
  if (!obj.crop) return;
  const def = CROP_COLORS[obj.crop] || '#5aa04a';
  const grow = cropGrowTicks(obj.crop);
  const k = grow ? 1 - (obj.growLeft || 0) / grow : 1;   // 0 just planted .. 1 ripe
  const sway = Math.sin(time * 0.003 + obj.x) * 0.8;
  for (const [px, py] of [[-8, 1], [0, 1], [8, 1], [-4, 7], [4, 7]]) {
    const h = 3 + k * 8;
    ctx.strokeStyle = '#3f8a3a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx + px, cy + py); ctx.lineTo(cx + px + sway, cy + py - h); ctx.stroke();
    ctx.fillStyle = '#5cb04e'; ellipse(ctx, cx + px + sway - 1.8, cy + py - h * 0.6, 2, 1); ctx.fill(); ellipse(ctx, cx + px + sway + 1.8, cy + py - h * 0.75, 2, 1); ctx.fill();
    if (k >= 1) { ctx.fillStyle = def; circle(ctx, cx + px + sway, cy + py - h - 1, 2.2); ctx.fill(); line(ctx, OUTLINE, 0.8); }
  }
  if (k >= 1) { ctx.fillStyle = 'rgba(255,240,150,0.5)'; circle(ctx, cx + 11, cy - 10 + Math.sin(time * 0.006) * 1.5, 1.6); ctx.fill(); }
}

// Apothecary table: a bench with a mortar, a bubbling flask and herbs.
function apothecaryTable(ctx, cx, cy, time) {
  drawShadow(ctx, cx, cy + 12, 14, 4.5);
  ctx.fillStyle = '#6a4a2a'; rr(ctx, cx - 12, cy - 2, 24, 6, 2); ctx.fill(); line(ctx, OUTLINE, 1.4);
  ctx.fillStyle = '#4a321a'; rr(ctx, cx - 10, cy + 4, 3, 9, 1); ctx.fill(); rr(ctx, cx + 7, cy + 4, 3, 9, 1); ctx.fill(); line(ctx, OUTLINE, 1.2);
  ctx.fillStyle = '#b8b0a0'; rr(ctx, cx - 10, cy - 7, 6, 5, 2); ctx.fill(); line(ctx, OUTLINE, 1);   // mortar
  ctx.fillStyle = '#e8f4ff'; circle(ctx, cx + 3, cy - 5, 3.4); ctx.fill(); line(ctx, OUTLINE, 1);     // flask
  ctx.fillStyle = '#5fd08a'; circle(ctx, cx + 3, cy - 4.4, 2.4); ctx.fill();
  ctx.fillStyle = 'rgba(160,255,190,0.7)'; circle(ctx, cx + 3 + Math.sin(time * 0.005), cy - 10 - ((time * 0.01) % 4), 1); ctx.fill();
  ctx.fillStyle = '#3f8a3a'; ellipse(ctx, cx + 9, cy - 3.5, 2.6, 1.2); ctx.fill();                 // herbs
}

// Fletching bench: a bench with a strung bow and a bundle of arrows.
function fletchingBench(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 14, 4.5);
  ctx.fillStyle = '#9a6a3a'; rr(ctx, cx - 12, cy - 2, 24, 6, 2); ctx.fill(); line(ctx, OUTLINE, 1.4);
  ctx.fillStyle = '#6a4626'; rr(ctx, cx - 10, cy + 4, 3, 9, 1); ctx.fill(); rr(ctx, cx + 7, cy + 4, 3, 9, 1); ctx.fill(); line(ctx, OUTLINE, 1.2);
  ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(cx - 8.8, cy - 6); ctx.lineTo(cx + 2.8, cy - 6); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = '#c8a070'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + 5 + i * 1.6, cy - 1); ctx.lineTo(cx + 7 + i * 1.6, cy - 9); ctx.stroke();
    ctx.fillStyle = '#e04a2a'; ellipse(ctx, cx + 5.2 + i * 1.6, cy - 1.5, 0.9, 1.6); ctx.fill();
  }
}

// Hunter trap: a ring of pegs and rope; it shows a sprung snare once emptied.
function huntTrap(ctx, obj, cx, cy) {
  const col = obj.def.color || '#caa15a';
  ctx.fillStyle = 'rgba(60,40,20,0.25)'; ellipse(ctx, cx, cy + 8, 11, 4); ctx.fill();
  ctx.strokeStyle = '#d8c090'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 8, 3, 0, 0, Math.PI * 2); ctx.stroke();
  for (const a of [0, 1.6, 3.2, 4.7]) {
    const px = cx + Math.cos(a) * 8, py = cy + 6 + Math.sin(a) * 3;
    ctx.fillStyle = '#7a5230'; rr(ctx, px - 1, py - 5, 2, 6, 0.8); ctx.fill();
  }
  if (obj.depleted) { ctx.strokeStyle = '#a08060'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 5, cy + 6); ctx.lineTo(cx + 5, cy + 2); ctx.stroke(); return; }
  // A little lure in the trap's own colour.
  ctx.fillStyle = col; circle(ctx, cx, cy + 4, 2.6); ctx.fill(); line(ctx, OUTLINE, 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(ctx, cx - 0.8, cy + 3.2, 0.8); ctx.fill();
}

function anvil(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 11, 13, 4);
  // stump
  ctx.fillStyle = '#6b4a2a'; rr(ctx, cx - 7, cy + 4, 14, 9, 2); ctx.fill(); line(ctx, OUTLINE, 1.5);
  // anvil body
  ctx.fillStyle = '#3a3d44';
  path(ctx, () => {
    ctx.moveTo(cx - 11, cy - 4); ctx.lineTo(cx + 8, cy - 4); ctx.lineTo(cx + 12, cy - 1);
    ctx.lineTo(cx + 5, cy - 1); ctx.lineTo(cx + 5, cy + 1); ctx.lineTo(cx + 3, cy + 4);
    ctx.lineTo(cx - 3, cy + 4); ctx.lineTo(cx - 3, cy - 1); ctx.lineTo(cx - 11, cy - 1);
  });
  ctx.fill(); line(ctx, 'rgba(0,0,0,0.5)', 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, cx - 10, cy - 4, 17, 1.6, 1); ctx.fill();
}

// Thieving market stall: striped awning on posts over a goods counter.
// Awning colour signals the stall type; goods disappear briefly when depleted.
function stall(ctx, objId, depleted, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 15, 5);
  // posts
  ctx.fillStyle = '#6b4524';
  rr(ctx, cx - 13, cy - 14, 3, 26, 1); ctx.fill();
  rr(ctx, cx + 10, cy - 14, 3, 26, 1); ctx.fill();
  line(ctx, 'rgba(30,18,8,0.5)', 1);
  // counter
  ctx.fillStyle = '#7a5230'; rr(ctx, cx - 14, cy + 2, 28, 12, 2); ctx.fill(); line(ctx, 'rgba(30,18,8,0.5)', 2);
  ctx.fillStyle = '#8a6038'; rr(ctx, cx - 14, cy, 28, 4, 2); ctx.fill();
  // striped awning, coloured per stall type
  const cols = { stall_food: '#d8566f', stall_market: '#2f7bbf', stall_gem: '#7a4a9a' };
  const a = cols[objId] || '#d8566f';
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? a : '#f0e7d4'; rr(ctx, cx - 15 + i * 5, cy - 16, 5, 7, 0); ctx.fill(); }
  line(ctx, 'rgba(30,18,8,0.5)', 1);
  // scalloped hem
  ctx.fillStyle = a;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(cx - 12.5 + i * 5, cy - 9, 2.5, 0, Math.PI); ctx.fill(); }
  // goods on the counter (hidden while restocking)
  if (!depleted) {
    ctx.fillStyle = objId === 'stall_gem' ? '#9adcff' : '#ffd773';
    circle(ctx, cx - 6, cy + 3, 2); ctx.fill();
    circle(ctx, cx, cy + 3, 2); ctx.fill();
    circle(ctx, cx + 6, cy + 3, 2); ctx.fill();
  }
}

function bank(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 15, 5);
  // counter
  ctx.fillStyle = '#7a5230'; rr(ctx, cx - 13, cy - 2, 26, 14, 2); ctx.fill(); line(ctx, 'rgba(30,18,8,0.5)', 2);
  ctx.fillStyle = '#8a6038'; rr(ctx, cx - 13, cy - 4, 26, 4, 2); ctx.fill();
  // booth top sign
  ctx.fillStyle = '#caa15a'; rr(ctx, cx - 11, cy - 16, 22, 9, 2); ctx.fill(); line(ctx, 'rgba(30,18,8,0.5)', 1.5);
  ctx.fillStyle = '#5a3a1c'; ctx.font = 'bold 8px Verdana'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('BANK', cx, cy - 11); ctx.textBaseline = 'alphabetic';
  // posts
  ctx.fillStyle = '#6b4524'; rr(ctx, cx - 12, cy - 16, 3, 16, 1); ctx.fill(); rr(ctx, cx + 9, cy - 16, 3, 16, 1); ctx.fill();
}

// The "A Worthy" logo as a town monument: a blue archway with a plus, on a stone plinth.
function shrine(ctx, cx, cy, time) {
  // The Worthy Monument is a landmark — render it large.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.85, 1.85);
  shrineBody(ctx, 0, 0, time);
  // Embed the genuine Worthy logo as a floating, glowing emblem above the arch.
  const bob = Math.sin(time * 0.0022) * 1.2;
  glow(ctx, 0, -58 + bob, 13, 'rgba(200,206,214,0.30)');
  drawLogo(ctx, 'logo', -7, -69 + bob, 14, 21);
  ctx.restore();
}
function shrineBody(ctx, cx, cy, time) {
  drawShadow(ctx, cx, cy + 13, 17, 5);
  const ink = '#3f4650', inkDk = '#2c3138';
  // soft ambient aura, sized to wrap the whole (now much taller) arch
  glow(ctx, cx, cy - 20, 36, 'rgba(180,190,200,0.22)');
  // stone plinth
  ctx.fillStyle = '#8a8378'; rr(ctx, cx - 13, cy + 6, 26, 9, 2); ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.5);
  ctx.fillStyle = '#9a948a'; rr(ctx, cx - 10, cy + 3, 20, 4, 2); ctx.fill();
  // archway: the Worthy mark itself — two slender rounded legs joined by a
  // tall dome (the logo's own silhouette is roughly 1:7 legs-to-height; this
  // is a more moderate ~1:2.75 so the monument stays a sensible in-world size).
  const legTopY = cy - 24, peakY = cy - 44;
  const arch = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 4); ctx.lineTo(cx - 8, legTopY);
    ctx.quadraticCurveTo(cx - 8, peakY, cx, peakY);
    ctx.quadraticCurveTo(cx + 8, peakY, cx + 8, legTopY);
    ctx.lineTo(cx + 8, cy + 4);
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = inkDk; ctx.lineWidth = 8; arch(); ctx.stroke();
  ctx.strokeStyle = ink; ctx.lineWidth = 5.6; arch(); ctx.stroke();
  ctx.lineCap = 'butt';
  // circle badge + plus at the crown, and a subtle crease beneath it
  const badgeY = peakY + 2;
  ctx.fillStyle = ink; circle(ctx, cx, badgeY, 6.6); ctx.fill();
  ctx.strokeStyle = inkDk; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(cx - 4.7, badgeY + 5); ctx.quadraticCurveTo(cx, badgeY + 8.5, cx + 4.7, badgeY + 5); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f5f6f7';
  rr(ctx, cx - 3.3, badgeY - 1.3, 6.6, 2.5, 1.1); ctx.fill();
  rr(ctx, cx - 1.25, badgeY - 3.3, 2.5, 6.6, 1.1); ctx.fill();
  // glint
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  circle(ctx, cx - 3.6, badgeY - 2.5, 1.05); ctx.fill();
}

// A-Worthy Mascot Statue — the mascot sticker, twice life size, on a stone plinth.
function mascotStatue(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 14, 14, 5);
  glow(ctx, cx, cy - 10, 26, 'rgba(245,184,46,0.16)');
  // plinth
  rr(ctx, cx - 12, cy + 5, 24, 9, 2.5); fill(ctx, '#d8d0bf'); line(ctx, '#22304A', 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, cx - 11, cy + 6, 22, 2, 1); ctx.fill();
  ctx.save();
  ctx.translate(cx, cy - 4);
  ctx.scale(1.15, 1.15);
  const st = _anim.stride; _anim.stride = 0;
  mascot(ctx, { shirt: '#C0392B' });
  _anim.stride = st;
  ctx.restore();
}

// MRT station: a sleek train cab beside a red station pylon.
function mrtStation(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 13, 15, 5);
  // platform
  ctx.fillStyle = '#9a948a'; rr(ctx, cx - 15, cy + 8, 30, 5, 2); ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.2);
  // train body
  ctx.fillStyle = '#e8eef2'; rr(ctx, cx - 13, cy - 8, 20, 17, 4); ctx.fill(); line(ctx, OUTLINE, 1.3);
  ctx.fillStyle = '#c0392b'; rr(ctx, cx - 13, cy - 8, 20, 4, 4); ctx.fill();            // red stripe (roof)
  ctx.fillStyle = '#2f6f9e'; rr(ctx, cx - 10, cy - 3, 14, 6, 1.5); ctx.fill();          // windscreen
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(ctx, cx - 9, cy - 2.5, 5, 5, 1); ctx.fill();
  ctx.fillStyle = '#3a3530'; circle(ctx, cx - 8, cy + 9, 2); ctx.fill(); circle(ctx, cx + 2, cy + 9, 2); ctx.fill();
  // station pylon with "M"
  ctx.fillStyle = '#3a3530'; rr(ctx, cx + 10, cy - 14, 2.4, 24, 1); ctx.fill();
  ctx.fillStyle = '#c0392b'; rr(ctx, cx + 6, cy - 16, 11, 8, 2); ctx.fill(); line(ctx, OUTLINE, 1.1);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('M', cx + 11.5, cy - 11.5);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

// Agility course: two posts with a row of climbing ropes.
function agilityCourse(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 14, 5);
  ctx.fillStyle = '#7a5530'; rr(ctx, cx - 13, cy - 14, 3, 26, 1); ctx.fill(); rr(ctx, cx + 10, cy - 14, 3, 26, 1); ctx.fill();
  ctx.strokeStyle = '#9a734a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 12); ctx.lineTo(cx + 12, cy - 12); ctx.stroke();
  ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const x = cx - 9 + i * 4.6; ctx.beginPath(); ctx.moveTo(x, cy - 12); ctx.lineTo(x, cy - 3); ctx.stroke(); }
  ctx.lineCap = 'butt';
}

function scenery(ctx, objId, cx, cy, time) {
  switch (objId) {
    case 'wall': {
      ctx.fillStyle = '#9a948a'; rr(ctx, cx - 15, cy - 12, 30, 26, 2); ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.5);
      ctx.strokeStyle = 'rgba(40,36,30,0.4)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx - 15, cy - 3); ctx.lineTo(cx + 15, cy - 3); ctx.moveTo(cx - 15, cy + 6); ctx.lineTo(cx + 15, cy + 6);
      ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 3); ctx.moveTo(cx - 8, cy - 3); ctx.lineTo(cx - 8, cy + 6); ctx.moveTo(cx + 8, cy + 6); ctx.lineTo(cx + 8, cy + 14); ctx.stroke();
      return;
    }
    case 'fence': {
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 10, cy + 10); ctx.lineTo(cx - 10, cy - 4); ctx.moveTo(cx + 10, cy + 10); ctx.lineTo(cx + 10, cy - 4); ctx.stroke();
      ctx.lineWidth = 2.4; ctx.strokeStyle = '#7d5836';
      ctx.beginPath(); ctx.moveTo(cx - 13, cy - 1); ctx.lineTo(cx + 13, cy - 1); ctx.moveTo(cx - 13, cy + 6); ctx.lineTo(cx + 13, cy + 6); ctx.stroke(); ctx.lineCap = 'butt';
      return;
    }
    case 'bush': {
      ctx.fillStyle = '#7cc68a'; circle(ctx, cx - 5, cy + 2, 7); ctx.fill(); circle(ctx, cx + 5, cy + 2, 7); ctx.fill(); circle(ctx, cx, cy - 3, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(34,48,74,0.4)'; ctx.lineWidth = 1.4; circle(ctx, cx, cy - 3, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,235,0.35)'; circle(ctx, cx - 2, cy - 4, 3); ctx.fill();
      ctx.fillStyle = '#EF476F'; circle(ctx, cx - 4, cy, 1.6); ctx.fill(); ctx.fillStyle = '#F5B82E'; circle(ctx, cx + 5, cy - 2, 1.6); ctx.fill();
      return;
    }
    case 'flower': {
      ctx.strokeStyle = '#3d7a3a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(cx + dx, cy + 9); ctx.lineTo(cx + dx, cy - 2); ctx.stroke(); }
      ctx.fillStyle = '#3d7a3a'; for (const dx of [-5, 0, 5]) { ellipse(ctx, cx + dx - 2, cy + 4, 2, 1); ctx.fill(); }
      ctx.lineCap = 'butt';
      const cols = ['#EF476F', '#F5B82E', '#5FAEE3'];   // bloom, sun, sky
      [-5, 0, 5].forEach((dx, i) => {
        ctx.fillStyle = cols[i];
        for (let a = 0; a < 5; a++) { const ang = a / 5 * Math.PI * 2; circle(ctx, cx + dx + Math.cos(ang) * 2.2, cy - 3 + Math.sin(ang) * 2.2, 1.5); ctx.fill(); }
        ctx.fillStyle = '#fff7d0'; circle(ctx, cx + dx, cy - 3, 1.4); ctx.fill();
      });
      return;
    }
    case 'palm': {
      ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy + 12); ctx.quadraticCurveTo(cx + 3, cy - 2, cx - 1, cy - 14); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#2f8a4a';
      for (let a = 0; a < 6; a++) {
        const ang = -Math.PI / 2 + (a - 2.5) * 0.5;
        ctx.save(); ctx.translate(cx - 1, cy - 14); ctx.rotate(ang);
        ctx.beginPath(); ctx.ellipse(13, 0, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = '#8a6a2a'; circle(ctx, cx - 1, cy - 14, 3); ctx.fill();
      return;
    }
    case 'lamp': {
      glow(ctx, cx, cy - 12, 22, 'rgba(255,210,120,0.22)');
      ctx.fillStyle = '#3a3530'; rr(ctx, cx - 1.5, cy - 12, 3, 24, 1); ctx.fill();
      ctx.fillStyle = '#2a2620'; rr(ctx, cx - 4, cy + 10, 8, 3, 1); ctx.fill();
      ctx.fillStyle = '#ffd86a'; rr(ctx, cx - 4, cy - 18, 8, 8, 2); ctx.fill(); line(ctx, '#3a3530', 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(ctx, cx - 1, cy - 15, 1.4); ctx.fill();
      return;
    }
    case 'sign': {
      ctx.fillStyle = '#6b4a2a'; rr(ctx, cx - 1.5, cy - 2, 3, 14, 1); ctx.fill();
      ctx.fillStyle = '#caa15a'; rr(ctx, cx - 11, cy - 12, 22, 11, 2); ctx.fill(); line(ctx, 'rgba(30,18,8,0.5)', 1.5);
      ctx.strokeStyle = 'rgba(90,58,28,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 7, cy - 8); ctx.lineTo(cx + 7, cy - 8); ctx.moveTo(cx - 7, cy - 5); ctx.lineTo(cx + 5, cy - 5); ctx.stroke();
      return;
    }
    case 'ruin': {
      drawShadow(ctx, cx, cy + 11, 15, 4.5);
      // fallen rubble blocks
      ctx.fillStyle = '#9a948a';
      rr(ctx, cx - 13, cy + 3, 9, 8, 1.5); ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.2);
      rr(ctx, cx + 4, cy + 5, 10, 6, 1.5); ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.2);
      // broken pillar with a jagged snapped top
      ctx.fillStyle = '#aaa49a';
      path(ctx, () => { ctx.moveTo(cx - 5, cy + 11); ctx.lineTo(cx - 5, cy - 9); ctx.lineTo(cx - 2, cy - 13); ctx.lineTo(cx + 1, cy - 8); ctx.lineTo(cx + 3, cy - 12); ctx.lineTo(cx + 4.5, cy + 11); });
      ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.4);
      // shaded right face + a brighter lit left edge
      ctx.fillStyle = 'rgba(20,20,26,0.2)'; rr(ctx, cx + 1, cy - 8, 3.5, 19, 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, cx - 5, cy - 9, 1.6, 20, 0.8); ctx.fill();
      // cracks + brick courses
      ctx.strokeStyle = 'rgba(40,36,30,0.45)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - 3, cy - 5); ctx.lineTo(cx - 1, cy - 1); ctx.lineTo(cx - 3, cy + 4);
      ctx.moveTo(cx - 5, cy + 1); ctx.lineTo(cx + 4, cy + 1); ctx.moveTo(cx - 11, cy + 7); ctx.lineTo(cx - 6, cy + 7); ctx.stroke();
      // creeping moss
      ctx.fillStyle = 'rgba(74,128,58,0.6)';
      ctx.beginPath(); ctx.arc(cx - 3.5, cy + 9, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 8, cy + 5.5, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 11, cy + 4.5, 1.2, 0, Math.PI * 2); ctx.fill();
      return;
    }
    default: {
      ctx.fillStyle = '#2f6e30'; circle(ctx, cx, cy, 7); ctx.fill();
    }
  }
}

// ================= GROUND ITEMS =================
export function drawGroundItem(ctx, id, cx, cy) {
  // soft pickup disc + hand-drawn vector icon (matches the inventory art)
  glow(ctx, cx, cy, 12, 'rgba(255,225,140,0.22)');
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ellipse(ctx, cx, cy + 7, 9, 3.2); ctx.fill();
  const img = itemIconImage(id);
  if (img && img.complete && img.naturalWidth) {
    const s = 22;
    // Vector icons arrive pre-stickered (SVG filter); painted PNGs get the
    // same navy-line + die-cut border baked once on canvas.
    // (Mascot-sticker artwork already carries its own die-cut border.)
    const isSvg = img.src && (img.src.startsWith('data:image/svg') || img.src.includes('assets/icons/'));
    const st = isSvg ? null : bakeSticker(`item|${id}`, ITEM_BOX, (g) => g.drawImage(img, -11, -11, 22, 22));
    if (st) ctx.drawImage(st, cx + ITEM_BOX.x0, cy + ITEM_BOX.y0 - 1, ITEM_BOX.w, ITEM_BOX.h);
    else ctx.drawImage(img, cx - s / 2, cy - s / 2 - 1, s, s);
  } else {
    ctx.fillStyle = 'rgba(255,235,170,0.6)'; circle(ctx, cx, cy, 5); ctx.fill();
  }
}

