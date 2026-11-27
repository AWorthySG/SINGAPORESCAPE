// The title screen, the loading bar and the animated heroes of the class picker.
//
// - Title: a painted evening in Kampong Glam, with animated heroes and petals.
//   The layered skyline and live island tour cover a failed key-art load.
// - Loading: the Enter button waits behind a progress bar driven by real image
//   loads (every picture the game asks for while it renders the title's shots
//   and the heroes is counted), with rotating gameplay tips, so nothing pops in
//   once the player is let through.
// - Class picker: each card's hero idles on a little stage; pointing at a card
//   (or its Preview button) plays that class's attack in the spotlight beside
//   its perks.
//
// The DOM side only runs in a browser (main.js and ui.js call it). Everything
// else here (the camera path, the load counter, the tips, the art slots, the
// hero drawing) is plain code the tests drive headlessly.
import { drawPlayer, drawShadow, heroArtSrc } from '../render/sprites.js';
import { HERO_RIG_CLASSES, HERO_RIG_PARTS, heroRigSrc } from '../render/heroRig.js';
import { RANGED_HERO_CLASSES, RANGED_HERO_PARTS, rangedHeroSrc } from '../render/rangedHeroRig.js';
import { ANIM_ART, IDLE_FACES, animArtSrc, swingArtReady, warmHeroAnim } from '../render/heroAnimArt.js';
import { sampleHeroClip, blendHeroFrame, weaponClipId, HERO_CLIPS } from '../render/heroanim.js';
import { fxImage } from '../render/fxart.js';
import { depthTarget } from '../render/depthview.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { starterOffhand } from '../game/equipment.js';
import { TILE } from '../config.js';
import { cosySkylineSvg, dressTitle } from './cosytitle.js';

// ---------------- Painted art slots ----------------
// Pictures that would lift the title and loading screens above the stand-ins
// drawn here. Drop a file into assets/title/<slot>.webp and add the slot to
// TITLE_ART: the screen uses it at once (tests/render.test.mjs keeps TITLE_ART
// in lock-step with the folder). Until then each slot has a placeholder.
export const TITLE_ART_SLOTS = {
  'kampong-evening': { size: 'landscape, opaque', use: 'the title scene with clear space on the left for the wordmark', placeholder: 'the painted skyline and live island tour' },
  skyline: { size: '2400x700 (any height), transparent, seamless left-right', use: 'the near band behind the title heroes: rain trees, palms and Supertree-style towers', placeholder: 'the cosy neighbourhood SVG (cosytitle.js)' },
  backdrop: { size: '1920x1080, opaque', use: 'a painted key-art scene shown while the game loads (before the live world fades in)', placeholder: 'the cream paper background' },
  'backdrop-portrait': { size: '1080x1920, opaque', use: 'the same key art cropped for phones held upright', placeholder: 'the cream paper background' },
  'loading-hero': { size: '512x512, transparent', use: 'a mascot illustration beside the loading bar (e.g. the A-Worthy mascot carrying a map)', placeholder: 'assets/mascot-login.webp' },
  ground: { size: '2400x160, transparent, seamless left-right', use: 'the grassy verge the title heroes stand on', placeholder: 'a CSS cream-to-green gradient' },
  sky: { size: '1920x1080, opaque', use: 'a sunset sky behind the city layers (it hides the live world behind it)', placeholder: 'a CSS sunset glow over the live world (titleSkyLayer)' },
  clouds: { size: '2400x800 sheet of six 800x400 clouds (3 x 2), transparent', use: 'a few sticker clouds, drifting slowly across the top of the screen', placeholder: 'inline SVG clouds (titleCloudsLayer)' },
  'skyline-far': { size: '3200x520, transparent, seamless left-right', use: 'the far city at sunset: Marina Bay Sands, the Supertrees, the Flyer, the CBD towers (hazy, slowest parallax)', placeholder: 'an inline SVG (titleFarLayer)' },
  'skyline-mid': { size: '3200x400, transparent, seamless left-right', use: 'a row of HDB blocks with lit windows and rain trees (middle parallax)', placeholder: 'an inline SVG (titleMidLayer)' },
  foreground: { size: '2400x400, transparent, seamless left-right, low in the middle', use: 'dark bushes and a palm along the foot of the screen, the nearest layer', placeholder: 'nothing (the layer is left empty)' },
  'logo-banner': { size: '1600x600, transparent, no text', use: 'the ribbon the game title sits on, its sunburst behind the mascot', placeholder: 'the plain title text' },
  'mascot-sit': { size: '512x512, transparent', use: 'the mascot sitting in the ribbon\'s sun disc, waving, a map in hand (MD-1)', placeholder: 'assets/mascot-login.webp' },
  medallion: { size: '256x256, round, transparent outside', use: 'the mascot\'s portrait filling the ribbon\'s sun disc on small screens (MD-1)', placeholder: 'the sitting mascot' },
};
/** The slots that have a painted file in assets/title/. */
export const TITLE_ART = new Set(['kampong-evening', 'backdrop', 'backdrop-portrait', 'sky', 'clouds', 'skyline-far', 'skyline-mid', 'skyline', 'foreground', 'logo-banner', 'mascot-sit', 'medallion']);
export const titleArtSrc = (slot) => (TITLE_ART.has(slot) ? `assets/title/${slot}.webp` : null);
/** The painted slots the title shows at once: asked for while the loading bar
 *  runs (and counted by it), so the city fades in whole. */
export const TITLE_START_ART = ['sky', 'clouds', 'skyline-far', 'skyline-mid', 'skyline', 'foreground', 'logo-banner'];

// ---------------- The camera's shots ----------------
// Tile coordinates: each shot pans from `from` to `to` while easing its zoom
// (a little wider than in play, to show more of the island), then the next
// one fades in. Picked for life on screen at the start
// of the game: the town square, the market, the shore and the bay.
export const TITLE_SHOTS = [
  { name: 'Kampong Glam', from: [52.5, 54], to: [63, 57], zoom: [0.84, 0.92] },
  { name: 'Chinatown', from: [79, 55], to: [88, 52], zoom: [0.9, 0.84] },
  { name: 'Sentosa Beach', from: [36, 99], to: [50, 100.5], zoom: [0.84, 0.9] },
  { name: 'Marina Bay', from: [186, 168], to: [196, 163], zoom: [0.92, 0.85] },
];
export const SHOT_MS = 11000;   // each shot's length
export const CUT_MS = 900;      // the fade out of one shot (and into the next)

const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

/**
 * Where the title camera is `ms` into the loop: the shot (index and name), its
 * centre in world pixels, its zoom, and how far the cream dip has faded in
 * (0 clear .. 1 hidden; it covers each cut). `still` (reduced motion) holds the
 * first shot's middle with no cuts.
 */
export function titleCameraAt(ms, shots = TITLE_SHOTS, still = false) {
  if (still || !shots.length) {
    const s = shots[0];
    const x = (s.from[0] + s.to[0]) / 2, y = (s.from[1] + s.to[1]) / 2;
    return { shot: 0, name: s.name, x: x * TILE, y: y * TILE, zoom: s.zoom ? s.zoom[0] : 1, fade: 0 };
  }
  const t = ((ms % (SHOT_MS * shots.length)) + SHOT_MS * shots.length) % (SHOT_MS * shots.length);
  const i = Math.floor(t / SHOT_MS);
  const s = shots[i];
  const local = t - i * SHOT_MS;
  // A steady drift (eased only at the very ends, which the dip hides).
  const u = local / SHOT_MS;
  const k = u * 0.9 + smooth(u) * 0.1;
  const x = s.from[0] + (s.to[0] - s.from[0]) * k;
  const y = s.from[1] + (s.to[1] - s.from[1]) * k;
  const zoom = s.zoom ? s.zoom[0] + (s.zoom[1] - s.zoom[0]) * smooth(u) : 1;
  // Clear in the middle, dipping to cream over the cut at each end.
  const fade = Math.max(smooth(1 - local / (CUT_MS * 0.6)), smooth((local - (SHOT_MS - CUT_MS)) / CUT_MS));
  return { shot: i, name: s.name, x: x * TILE, y: y * TILE, zoom, fade };
}

// ---------------- Loading ----------------
// Gameplay tips shown under the loading bar, a new one every few seconds.
export const LOADING_TIPS = [
  'Press <b>T</b> (or tap <b>Auto</b>) and your hero hunts, eats and uses skills by itself.',
  'A gold-ringed <b>&#9733; Champion</b> is tougher than its kind, and drops better loot.',
  'Bosses mark the ground in <b>red</b> before a big hit: step out before it fills.',
  'A green <b>&#9650;</b> on an item means it beats what you are wearing.',
  'Open a quest in the journal and press <b>Go</b> to walk straight to the next step.',
  'Every kill trains your gear\'s <b>mastery</b>; upgrade stones enchant it.',
  'Fish, cook, chop and mine between fights: life skills unlock perks every 10 levels.',
  'Ride the <b>MRT</b> between towns: the stations are marked on the world map (<b>M</b>).',
  'Bank your coins and spare loot at any bank booth, so a fall costs you less.',
  'Daily bounties in the Quest Journal pay coins for three kills.',
];
export const TIP_MS = 3600;
/** The tip to show `ms` into loading (cycles through the list from `start`). */
export const tipAt = (ms, start = 0) => LOADING_TIPS[(start + Math.floor(Math.max(0, ms) / TIP_MS)) % LOADING_TIPS.length];

/**
 * Counts pictures as they load. `add` takes anything with `complete` (an
 * Image): a picture counts as settled once `complete` is true, which also
 * covers a failed load and one never given a source, so a broken file can
 * never hang the bar. `extra` jobs (fonts, the preload passes) count too.
 */
export class LoadTracker {
  constructor() { this.items = []; this.jobs = new Map(); this._settled = 0; }
  add(img) { if (img) this.items.push(img); return img; }
  /** A named job that isn't a picture: pending until done(name). */
  job(name) { if (!this.jobs.has(name)) this.jobs.set(name, false); }
  done(name) { this.jobs.set(name, true); }
  /** { loaded, total, ratio, idle }: idle once nothing is pending. */
  status() {
    let loaded = 0;
    for (const img of this.items) if (img.complete) loaded++;
    for (const v of this.jobs.values()) if (v) loaded++;
    const total = this.items.length + this.jobs.size;
    return { loaded, total, ratio: total ? loaded / total : 0, idle: loaded >= total };
  }
}

/** While loading, every `new Image()` the game makes is handed to `tracker`.
 *  Returns a function that puts the browser's own Image back. */
export function trackImages(tracker, scope = globalThis) {
  const Native = scope.Image;
  if (typeof Native !== 'function') return () => {};
  function TrackedImage(w, h) { return tracker.add(w === undefined ? new Native() : new Native(w, h)); }
  TrackedImage.prototype = Native.prototype;   // instanceof Image still holds
  scope.Image = TrackedImage;
  return () => { if (scope.Image === TrackedImage) scope.Image = Native; };
}

// ---------------- Heroes on a stage ----------------
/** The pictures a class's hero needs to stand and idle: its painted picture,
 *  its rig's limbs and its neutral and blinking faces. Drawing alone finds
 *  them one layer at a time (the rig is only tried once the picture is in, the
 *  faces once the rig is), three round trips on a slow phone; asked for
 *  together they load side by side. Swings, the back view and the empty hand
 *  load when first needed. */
export function heroIdleArt(classId) {
  const out = [];
  const pic = heroArtSrc(classId);
  if (pic) out.push(pic);
  if (HERO_RIG_CLASSES.includes(classId)) for (const p of HERO_RIG_PARTS) out.push(heroRigSrc(p, classId));
  if (RANGED_HERO_CLASSES.includes(classId)) for (const p of RANGED_HERO_PARTS) out.push(rangedHeroSrc(classId, p));
  for (const f of ANIM_ART[classId]?.faces || []) if (IDLE_FACES.includes(f)) out.push(animArtSrc(`${classId}_${f}`));
  return out;
}
const _heroArt = new Map();   // classId -> its idle pictures, once asked for
/** Start loading a class's idle pictures (counted by the loading bar while it runs). */
export function warmHero(classId) {
  if (_heroArt.has(classId) || !CLASS_BY_ID[classId]) return;
  const imgs = [];
  if (typeof Image === 'function') for (const src of heroIdleArt(classId)) { const img = new Image(); img.src = src; imgs.push(img); }
  _heroArt.set(classId, imgs);
}
/** Are a class's idle pictures in (loaded or failed)? True with no browser. */
export function heroReady(classId) {
  warmHero(classId);
  const imgs = _heroArt.get(classId);
  return !imgs || imgs.every((img) => img.complete);
}
// The classes that start with a weapon in each hand show both in the previews.
const DUAL_START = new Set(['pistoler', 'monk']);
const IDLE_MS = HERO_CLIPS.idle.dur || 3200;
/** How long a preview swing lasts: slower than in a fight, so it reads. */
export function previewAttackMs(clipId) { return HERO_CLIPS[clipId]?.shot ? 520 : 640; }
export function attackClipFor(classId, n = 0) {
  const cls = CLASS_BY_ID[classId];
  return weaponClipId(cls ? cls.weapon : null, DUAL_START.has(classId), n);
}

/**
 * Draw a class's hero standing with its feet at (x, y): idling, or swinging
 * when `actor.attackAt` (ms) is recent. `actor` carries the blend state
 * between frames ({ classId, fx, phase, attackAt, swings, blend }).
 * Nothing is drawn until the hero's idle pictures are in, so it appears whole
 * rather than as a stand-in that changes under the player's eyes; false then.
 */
export function drawClassHero(ctx, actor, x, y, now) {
  const cls = CLASS_BY_ID[actor.classId];
  if (!cls || !heroReady(actor.classId)) return false;
  // A swing asked for before its painted arms were in starts once they are
  // (or after a moment regardless, should one never arrive).
  if (actor.swingWant != null && (swingArtReady(actor.classId) || now - actor.swingWant > SWING_WAIT_MS)) {
    actor.attackAt = now; actor.swingWant = null;
  }
  const dual = DUAL_START.has(actor.classId);
  const held = { jobClass: actor.classId, weapon: cls.weapon, offhand: dual ? starterOffhand(actor.classId) : null };
  let frame = null;
  if (actor.attackAt != null) {
    const clip = actor.clip || attackClipFor(actor.classId, actor.swings || 0);
    const u = (now - actor.attackAt) / previewAttackMs(clip);
    if (u >= 0 && u < 1) frame = sampleHeroClip(clip, u, { kind: 'combat', ...held });
    else if (u >= 1) actor.attackAt = null;
  }
  if (!frame) frame = sampleHeroClip('idle', (((now + (actor.phase || 0)) % IDLE_MS) + IDLE_MS) % IDLE_MS / IDLE_MS, { kind: 'pose', ...held });
  actor.blend ??= { id: null, u: 0, t0: 0, from: null, out: null };
  blendHeroFrame(actor.blend, frame, now);
  drawShadow(ctx, x, y, 10, 4.5);
  // The renderer draws the hero 15px above its shadow (HERO_ART_FEET).
  drawPlayer(ctx, x, y - 15, {
    anim: frame, time: now, jobClass: actor.classId, hasWeapon: true, weaponType: cls.style,
    dualWield: dual, fx: actor.fx || 1,
  });
  return true;
}
const SWING_WAIT_MS = 1500;
/** Start a swing on `actor` (each one alternates clips for dual wielders). Its
 *  painted arms are asked for now; until they're in, the swing waits. */
export function swingActor(actor, now) {
  actor.swings = (actor.swings || 0) + 1;
  actor.clip = attackClipFor(actor.classId, actor.swings);
  if (swingArtReady(actor.classId)) { actor.attackAt = now; actor.swingWant = null; } else actor.swingWant = now;
}

/**
 * A canvas with heroes on it, redrawn by one shared loop while it is in the
 * page. `layout(w, h)` (CSS pixels) returns [{ actor, x, y, scale }] each
 * frame; `fps` caps the redraws (small cards don't need 60).
 */
export class HeroStage {
  constructor(canvas, layout, { fps = 30, still = false } = {}) {
    this.canvas = canvas; this.layout = layout; this.fps = fps; this.still = still;
    this.visible = true; this._last = -1e9; this._drawn = 0;
    this.ctx = canvas.getContext ? canvas.getContext('2d') : null;
    STAGES.add(this);
    if (typeof IntersectionObserver === 'function') {
      this._io = new IntersectionObserver((es) => { for (const e of es) this.visible = e.isIntersecting; });
      this._io.observe(canvas);
    }
    runStages();
  }
  stop() { STAGES.delete(this); this._io?.disconnect(); }
  draw(now) {
    const c = this.canvas, ctx = this.ctx;
    if (!ctx) return;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    let all = true;
    for (const a of this.layout(w, h, now)) {
      ctx.setTransform(dpr * a.scale, 0, 0, dpr * a.scale, dpr * a.x, dpr * a.y);
      if (!drawClassHero(ctx, a.actor, 0, 0, now)) all = false;
    }
    // Still stages stop redrawing after a while: only once every hero is on it.
    if (all) this._drawn++;
  }
}
const STAGES = new Set();
let _running = false;
function runStages() {
  if (_running || typeof requestAnimationFrame !== 'function') return;
  _running = true;
  const tick = (now) => {
    for (const s of STAGES) {
      if (!s.canvas.isConnected) { s.stop(); continue; }
      // Still stages (reduced motion) only redraw while their pictures arrive.
      const gap = s.still ? (s._drawn < 40 ? 250 : Infinity) : 1000 / s.fps;
      if (!s.visible || now - s._last < gap - 2) continue;
      s._last = now;
      s.draw(s.still ? 0 : now);
    }
    if (STAGES.size) requestAnimationFrame(tick); else _running = false;
  };
  requestAnimationFrame(tick);
}

/** Prefers reduced motion (the OS setting)? */
export function prefersReducedMotion() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// ---------------- The skyline (placeholder) ----------------
/** A sticker-style silhouette of the city (HDB blocks, Supertrees, Marina Bay
 *  Sands, the Esplanade's domes, the Flyer, the CBD), for the skyline slot
 *  until painted art arrives. 1200x140 units, ground along the bottom. */
export function titleSkylineSvg() {
  const ink = '#22304A';
  const blk = (x, w, h, fill) => `<rect x="${x}" y="${140 - h}" width="${w}" height="${h}" rx="3" fill="${fill}"/>`
    + Array.from({ length: Math.max(0, Math.floor((h - 14) / 12)) }, (_, r) => `<path d="M${x + 6} ${140 - h + 10 + r * 12}h${w - 12}" stroke="${ink}" stroke-opacity=".18" stroke-width="2" stroke-dasharray="5 4"/>`).join('');
  const tree = (x, h) => `<path d="M${x - 3} 140 L${x - 2} ${140 - h + 14} L${x - 16} ${140 - h} Q${x} ${140 - h - 8} ${x + 16} ${140 - h} L${x + 2} ${140 - h + 14} L${x + 3} 140Z" fill="#B9DDBF"/>`;
  const parts = [
    blk(14, 54, 66, '#E8DCC6'), blk(74, 46, 88, '#F3D9C9'), blk(126, 40, 58, '#DCE6F2'),
    tree(196, 92), tree(236, 74), tree(272, 100),
    blk(316, 34, 84, '#DCE6F2'), blk(354, 28, 112, '#E8E2F2'), blk(386, 38, 96, '#F2E6CF'), blk(428, 30, 72, '#DCE6F2'),
    // Marina Bay Sands: three leaning towers under the boat-shaped SkyPark.
    `<path d="M520 140 L524 40 L552 40 L548 140Z M568 140 L572 40 L600 40 L596 140Z M616 140 L620 40 L648 40 L644 140Z" fill="#E6ECF5"/>`,
    `<path d="M500 34 Q510 28 520 30 L664 30 Q676 30 684 26 L680 38 L504 40Z" fill="#F5B82E" fill-opacity=".85"/>`,
    // The Esplanade's two spiky domes.
    `<path d="M690 140 Q690 92 736 92 Q782 92 782 140Z" fill="#F3E0B0"/><path d="M786 140 Q786 104 820 104 Q854 104 854 140Z" fill="#F3E0B0"/>`,
    `<path d="M700 124 L772 124 M698 110 L774 110 M796 126 L846 126" stroke="${ink}" stroke-opacity=".2" stroke-width="2" stroke-dasharray="3 5"/>`,
    // The Flyer.
    `<circle cx="922" cy="78" r="44" fill="none" stroke="#C9D8EE" stroke-width="7"/>`,
    `<path d="M922 78 L898 140 M922 78 L946 140" stroke="#C9D8EE" stroke-width="6"/>`,
    blk(980, 36, 104, '#E8E2F2'), blk(1020, 30, 80, '#DCE6F2'), blk(1054, 44, 122, '#F2E6CF'), blk(1102, 34, 70, '#E8DCC6'), blk(1140, 50, 90, '#F3D9C9'),
  ];
  return `<svg viewBox="0 0 1200 140" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `<g stroke="${ink}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${parts.join('')}</g></svg>`;
}

// ---------------- The sunset city: parallax layers (placeholders) ----------------
// Back to front: the sunset sky, drifting clouds, the far city (Marina Bay, the
// Supertrees, the Flyer, the CBD), a row of HDB blocks, then the old
// neighbourhood (cosytitle.js) the heroes stand in front of. Each layer is one
// function returning its markup, and each has a painted art slot: once
// assets/title/<slot>.webp exists (and the slot is in TITLE_ART) the layer is
// that picture instead (titleLayerHTML). `depth` is how far a layer sways with
// the parallax (1 = the nearest).
const INK = '#22304A';
// A small seeded random, so the windows lit in a block are the same every time.
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** The sunset: a warm glow rising from the horizon and a low sun (CSS does the
 *  gradient; this is the sun and its halo). */
export function titleSkyLayer() {
  return '<i class="tsun"></i>';
}

/** A puffy sticker cloud: overlapping circles, one ink outline round them all
 *  (the outlines are drawn first, the cream over them). */
export function cloudSvg(w = 220, seed = 1) {
  const r = seeded(seed * 97 + 13);
  const h = w * 0.42, base = h - 6;
  const puffs = [];
  let x = w * 0.16;
  while (x < w * 0.86) {
    const rad = w * (0.1 + r() * 0.08);
    puffs.push([x, base - rad * (0.55 + r() * 0.5), rad]);
    x += rad * (1 + r() * 0.3);
  }
  const shape = (extra) => puffs.map(([cx, cy, rad]) => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}"${extra}/>`).join('')
    + `<rect x="${(w * 0.08).toFixed(1)}" y="${(base - w * 0.09).toFixed(1)}" width="${(w * 0.84).toFixed(1)}" height="${(w * 0.09).toFixed(1)}" rx="${(w * 0.045).toFixed(1)}"${extra}/>`;
  return `<svg viewBox="-6 -6 ${w + 12} ${(h + 12).toFixed(0)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `<g fill="${INK}" fill-opacity=".0" stroke="${INK}" stroke-opacity=".5" stroke-width="5">${shape('')}</g>`
    + `<g fill="#FFF9F0">${shape('')}</g>`
    + `<g fill="#FFD9C2" fill-opacity=".55">${puffs.map(([cx, cy, rad]) => `<ellipse cx="${cx.toFixed(1)}" cy="${(cy + rad * 0.45).toFixed(1)}" rx="${(rad * 0.8).toFixed(1)}" ry="${(rad * 0.4).toFixed(1)}"/>`).join('')}</g></svg>`;
}

/** Clouds drifting across the top of the screen, each at its own height,
 *  size and pace (CSS moves them). */
export function titleCloudsLayer(n = 5) {
  const r = seeded(7);
  let s = '';
  for (let i = 0; i < n; i++) {
    const w = Math.round(150 + r() * 150);
    s += `<i class="tcl" style="top:${(3 + r() * 30).toFixed(1)}%;width:${w}px;animation-duration:${(80 + r() * 70).toFixed(0)}s;animation-delay:${(-r() * 150).toFixed(0)}s;opacity:${(0.75 + r() * 0.25).toFixed(2)}">${cloudSvg(w, i + 1)}</i>`;
  }
  return s;
}

/** Painted clouds: cells of the clouds sheet (3 x 2), drifting like the SVG ones. */
export function titleCloudsArt(src, n = 5) {
  const r = seeded(7);
  let s = '';
  for (let i = 0; i < n; i++) {
    const w = Math.round(170 + r() * 170), c = i % 6;
    s += `<i class="tcl tca" style="top:${(3 + r() * 30).toFixed(1)}%;width:${w}px;animation-duration:${(80 + r() * 70).toFixed(0)}s;animation-delay:${(-r() * 150).toFixed(0)}s;`
      + `background-image:url(${src});background-position:${(c % 3) * 50}% ${Math.floor(c / 3) * 100}%"></i>`;
  }
  return s;
}

/** A tower with a few lit windows. */
function tower(x, w, h, fill, G, seed, { spire = 0, crown = null } = {}) {
  const r = seeded(seed);
  let s = `<rect x="${x}" y="${G - h}" width="${w}" height="${h}" rx="3" fill="${fill}"/>`;
  if (crown) s += `<rect x="${x - 3}" y="${G - h - 6}" width="${w + 6}" height="8" rx="3" fill="${crown}"/>`;
  if (spire) s += `<path d="M${x + w / 2} ${G - h - (crown ? 6 : 0)}v${-spire}" stroke-width="2.5"/>`;
  let lit = '';
  for (let yy = G - h + 12; yy < G - 10; yy += 14) for (let xx = x + 6; xx < x + w - 8; xx += 11) if (r() < 0.22) lit += `<rect x="${xx}" y="${yy}" width="5" height="7" rx="1"/>`;
  return s + `<g fill="#FFE6A6" stroke="none">${lit}</g>`;
}

/** A Supertree from Gardens by the Bay: a tall tapering trunk opening into a
 *  wide trumpet of a canopy, strung with lights. */
function supertree(x, h, G, fill = '#B88AB0') {
  const top = G - h;
  let s = `<path d="M${x - 9} ${G}L${x - 4} ${top + 34}L${x + 4} ${top + 34}L${x + 9} ${G}Z" fill="${fill}"/>`;
  s += `<path d="M${x - 5} ${top + 36}Q${x - 14} ${top + 12} ${x - 38} ${top}L${x + 38} ${top}Q${x + 14} ${top + 12} ${x + 5} ${top + 36}Z" fill="${fill}"/>`;
  s += `<path d="M${x - 30} ${top + 3}Q${x - 10} ${top + 14} ${x - 3} ${top + 34}M${x + 30} ${top + 3}Q${x + 10} ${top + 14} ${x + 3} ${top + 34}M${x} ${top + 2}V${top + 34}" stroke-opacity=".3" stroke-width="2" fill="none"/>`;
  s += `<g class="tlight" fill="#FFE08A" stroke="none">`;
  for (let i = -3; i <= 3; i++) s += `<circle cx="${x + i * 10}" cy="${top + 2 + Math.abs(i) * -0.4}" r="2.4"/>`;
  return s + `</g>`;
}

/**
 * The far city at sunset, 1600 x 260 units with the ground along the bottom:
 * CBD towers, the Supertrees, Marina Bay Sands under its SkyPark, the
 * Flyer and the Esplanade's domes, hazy and warm.
 */
export function titleFarLayer() {
  const G = 260;
  const parts = [
    tower(30, 52, 150, '#EED3DA', G, 3, { crown: '#E7BFC9' }), tower(90, 40, 196, '#E7D6EC', G, 4, { spire: 22 }), tower(136, 58, 128, '#F2DCCF', G, 5),
    tower(200, 44, 172, '#E9D3E4', G, 6, { crown: '#DDBFD6' }), tower(250, 36, 112, '#F4DED1', G, 7),
    supertree(330, 150, G), supertree(392, 196, G, '#C394BA'), supertree(452, 132, G), supertree(506, 176, G, '#C394BA'), supertree(560, 118, G),
    // The Esplanade's two spiky domes and the ArtScience Museum's lotus (the
    // middle, which the title card covers on wide screens).
    `<path d="M600 ${G}Q600 204 650 204Q700 204 700 ${G}Z" fill="#F3E0B0"/><path d="M708 ${G}Q708 218 744 218Q780 218 780 ${G}Z" fill="#F3E0B0"/>`,
    `<path d="M612 236h76M610 222h80M720 240h48" stroke-opacity=".22" stroke-width="2" stroke-dasharray="3 5"/>`,
    `<path d="M806 ${G}Q810 214 826 196L834 220L844 190L854 220L864 196Q880 214 884 ${G}Z" fill="#F4E6D6"/>`,
    // Marina Bay Sands: three leaning towers under the boat-shaped SkyPark.
    `<path d="M940 ${G}L946 64L980 64L972 ${G}Z M1000 ${G}L1006 64L1040 64L1032 ${G}Z M1060 ${G}L1066 64L1100 64L1092 ${G}Z" fill="#EADFEF"/>`,
    `<path d="M912 58Q926 50 940 52L1112 52Q1128 52 1140 46L1134 64L920 66Z" fill="#F5C26B"/>`,
    `<g fill="#FFE6A6" stroke="none">${[950, 1010, 1070].map((tx) => Array.from({ length: 9 }, (_, i) => `<rect x="${tx + 6}" y="${84 + i * 19}" width="18" height="4" rx="1.5" opacity="${(i % 3 === 1 ? 0.9 : 0.45)}"/>`).join('')).join('')}</g>`,
    // The Flyer.
    `<g class="tflyer" style="transform-origin:1250px 150px"><circle cx="1250" cy="150" r="74" fill="none" stroke="#D9CBEA" stroke-width="8"/>`
      + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M1250 150L${(1250 + Math.cos(a) * 72).toFixed(1)} ${(150 + Math.sin(a) * 72).toFixed(1)}" stroke-opacity=".25" stroke-width="1.5"/><circle cx="${(1250 + Math.cos(a) * 76).toFixed(1)}" cy="${(150 + Math.sin(a) * 76).toFixed(1)}" r="4.5" fill="#FFF3D6" stroke-width="1.5"/>`; }).join('')
      + `</g>`,
    `<path d="M1250 150L1220 ${G}M1250 150L1280 ${G}" stroke="#D9CBEA" stroke-width="7"/>`,
    tower(1160, 34, 120, '#F4DED1', G, 10),
    tower(1336, 48, 182, '#E7D6EC', G, 11, { spire: 18 }), tower(1390, 60, 214, '#EED3DA', G, 12, { crown: '#E3BCCB' }), tower(1456, 42, 150, '#F2DCCF', G, 13),
    tower(1504, 54, 236, '#E9D3E4', G, 14, { spire: 26 }), tower(1564, 34, 168, '#F4DED1', G, 15),
  ];
  return `<svg viewBox="0 0 1600 ${G}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="title-far-svg">`
    + `<g stroke="${INK}" stroke-opacity=".4" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${parts.join('')}</g>`
    + `<rect x="0" y="${G - 70}" width="1600" height="70" fill="url(#tfHaze)"/>`
    + `<defs><linearGradient id="tfHaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC9A8" stop-opacity="0"/><stop offset="1" stop-color="#FFB894" stop-opacity=".7"/></linearGradient></defs></svg>`;
}

/** An HDB block: a pastel slab with a coloured roof band, a water tank,
 *  rows of windows (some lit for the evening) and a block number. */
function hdbBlock(x, w, h, fill, band, G, seed, num = '') {
  const r = seeded(seed);
  const top = G - h;
  let s = `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="4" fill="${fill}"/>`;
  s += `<rect x="${x + w * 0.3}" y="${top - 14}" width="${w * 0.4}" height="14" rx="2" fill="${band}"/>`;
  s += `<rect x="${x - 4}" y="${top - 2}" width="${w + 8}" height="10" rx="3" fill="${band}"/>`;
  let win = '', lit = '';
  for (let yy = top + 18; yy < G - 26; yy += 15) for (let xx = x + 8; xx + 12 <= x + w - 6; xx += 17) {
    (r() < 0.3 ? (lit += `<rect x="${xx}" y="${yy}" width="12" height="8" rx="1.5"/>`) : (win += `<rect x="${xx}" y="${yy}" width="12" height="8" rx="1.5"/>`));
  }
  s += `<g stroke="none" fill="${INK}" fill-opacity=".14">${win}</g><g stroke="none" fill="#FFD884">${lit}</g>`;
  // The void deck: an open ground floor on pillars.
  s += `<rect x="${x + 3}" y="${G - 20}" width="${w - 6}" height="20" fill="${INK}" fill-opacity=".18" stroke="none"/>`;
  if (num) s += `<rect x="${x + 8}" y="${top + 14}" width="34" height="14" rx="3" fill="#FFF8EA" stroke-width="1.5"/>`
    + `<text x="${x + 25}" y="${top + 24.5}" text-anchor="middle" font-family="Nunito,'Trebuchet MS',sans-serif" font-weight="900" font-size="9" fill="${INK}" stroke="none">${num}</text>`;
  return s;
}

/** A rain tree's round canopy on a short trunk. */
function canopy(x, h, G, fill = '#9ACB86') {
  const top = G - h;
  return `<path d="M${x - 3} ${G}V${top + 26}h6V${G}Z" fill="#8E6A45"/>`
    + `<path d="M${x - 38} ${top + 30}Q${x - 44} ${top + 6} ${x - 18} ${top + 4}Q${x - 6} ${top - 10} ${x + 12} ${top}Q${x + 40} ${top} ${x + 38} ${top + 28}Q${x} ${top + 40} ${x - 38} ${top + 30}Z" fill="${fill}"/>`;
}

/** The middle distance, 1600 x 200: a row of HDB estates and rain trees. */
export function titleMidLayer() {
  const G = 200;
  const blocks = [
    [20, 118, 150, '#CDE7DF', '#7FB8A8', 'BLK 21'], [176, 96, 118, '#F7D9C4', '#E2A27E'], [300, 132, 176, '#DCD5F2', '#A79AD6', 'BLK 8'],
    [486, 104, 132, '#FBE8B0', '#E3BA55'], [620, 126, 164, '#CFE2F5', '#86ACD8', 'BLK 135'], [810, 110, 140, '#F6CDD3', '#E2909E'],
    [956, 136, 182, '#CDE7DF', '#7FB8A8', 'BLK 72'], [1126, 98, 124, '#FBE8B0', '#E3BA55'], [1258, 124, 158, '#DCD5F2', '#A79AD6', 'BLK 40'],
    [1418, 112, 136, '#F7D9C4', '#E2A27E'], [1540, 90, 110, '#CFE2F5', '#86ACD8'],
  ];
  const parts = blocks.map(([x, w, h, f, b, n], i) => hdbBlock(x, w, h, f, b, G, 31 + i * 7, n));
  for (const [x, h, f] of [[155, 70, '#9ACB86'], [455, 84, '#86C07A'], [596, 62, '#A6D392'], [920, 76, '#9ACB86'], [1240, 66, '#86C07A'], [1394, 80, '#A6D392']]) parts.push(canopy(x, h, G, f));
  return `<svg viewBox="0 0 1600 ${G}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="title-mid-svg">`
    + `<g stroke="${INK}" stroke-opacity=".7" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${parts.join('')}</g>`
    + `<rect x="0" y="${G - 4}" width="1600" height="4" fill="#C9A77E"/></svg>`;
}

/** The title's layers, back to front: id (its element's class is
 *  title-<id>), the painted art slot that replaces it, its parallax depth and
 *  the function that draws its placeholder. The nearest layer, the old
 *  neighbourhood, lives in index.html's .title-skyline (art slot "skyline"). */
export const TITLE_LAYERS = [
  { id: 'sunset', slot: 'sky', depth: 0, draw: titleSkyLayer },
  { id: 'clouds', slot: 'clouds', depth: 0.1, draw: titleCloudsLayer },
  { id: 'far', slot: 'skyline-far', depth: 0.25, draw: titleFarLayer },
  { id: 'mid', slot: 'skyline-mid', depth: 0.55, draw: titleMidLayer },
  // In front of the near band (and behind the heroes): only drawn when painted.
  { id: 'front', slot: 'foreground', depth: 1.15, draw: () => '', front: true },
];
/** A painted strip (seamless left to right) repeated along a layer's foot,
 *  scaled to the layer's height; the sky covers its layer. */
export const titleStripHTML = (src) => `<i class="title-art title-strip" style="background-image:url(${src})"></i>`;
/** A layer's markup: its painted picture once it exists, else its placeholder. */
export function titleLayerHTML(layer) {
  const src = titleArtSrc(layer.slot);
  if (!src) return layer.draw();
  if (layer.slot === 'clouds') return titleCloudsArt(src);
  if (layer.slot === 'sky') return `<i class="title-art title-sky-art" style="background-image:url(${src})"></i>`;
  return titleStripHTML(src);
}
/** How far (px) each layer sways at parallax `p` (-1..1): the near layer most. */
export const PARALLAX_PX = 34;
export const parallaxShift = (depth, p) => Math.round(-p * depth * PARALLAX_PX * 10) / 10 + 0;   // + 0: no "-0px"

// ---------------- The title screen (browser only) ----------------
// The heroes posing on the title: a mix of melee, ranged, magic and the Dancer.
export const TITLE_HEROES = ['swordsman', 'wizard', 'ranger', 'samurai', 'dancer', 'pistoler'];
/** Where the title heroes stand on a stage `w` x `h` CSS px beside a card
 *  `cardW` px wide: [[x, facing], ...], one per hero shown (no more than the
 *  cast). Wide screens: three a side of the card. Narrow ones (or no card
 *  measured): a row under it. */
export function titleSpots(w, h, cardW = w) {
  const free = (w - cardW) / 2;
  const scale = h < 120 ? 1.55 : 1.9;
  let spots;
  if (free >= 240) {
    const per = Math.min(3, Math.floor((free - 20) / (64 * scale)));
    const gap = (free - 20) / per;
    spots = [];
    for (let i = 0; i < per; i++) spots.push([10 + gap * (i + 0.5), 1], [w - 10 - gap * (i + 0.5), -1]);
  } else {
    const n = Math.max(2, Math.min(4, Math.floor(w / 120)));
    spots = Array.from({ length: n }, (_, i) => [w * (i + 0.5) / n, i < n / 2 ? 1 : -1]);
  }
  return spots.slice(0, TITLE_HEROES.length);
}
/** The title heroes a screen shows (a phone has room for three of the six):
 *  only theirs are asked for while the loading bar runs. A screen that later
 *  grows (turned sideways) draws the rest once they arrive (drawClassHero). */
export function titleCast(w, h, cardW = w) {
  return TITLE_HEROES.slice(0, titleSpots(w, h, cardW).length);
}
const PETALS = ['petal_pink', 'frangipani', 'leaf_green', 'leaf_lime', 'petal_pink', 'dust_m'];
const LOAD_MIN_MS = 700;      // the bar never just flashes past
const LOAD_MAX_MS = 12000;    // ...and never holds the player up for long
// How long after the Enter button shows the live world can still be glimpsed:
// the cream paper fades out (1.1s after 0.1s) as the painted sky fades in
// (1.1s after 0.15s, title.css). After that the sky covers it, with room to spare.
export const SKY_IN_MS = 1800;
/** Is the live world behind the title out of sight? It is once the painted
 *  sky (an opaque picture over the whole screen) has loaded and faded in, until
 *  the title hands the camera back to the player. Then the world need not be
 *  drawn: the camera's tour behind the sky is never seen. */
export function worldOutOfSight({ ready, skyIn, sinceReady, handedBack }) {
  return !!(ready && skyIn && !handedBack && sinceReady >= SKY_IN_MS);
}

export class TitleScreen {
  /** `splash` is the #splash element; `opts.lowFx` trims the extras. */
  constructor(splash, opts = {}) {
    this.splash = splash;
    this.still = opts.still ?? prefersReducedMotion();
    this.lowFx = !!opts.lowFx;
    this.active = !!splash;
    this.ready = false;
    this.leaving = false;
    this.t = 0;              // title clock (ms), advanced by the game loop
    this.loadMs = 0;
    this.shown = 0;          // the bar's drawn fill (0..1), never going back
    this.tracker = new LoadTracker();
    this._untrack = () => {};
    this._preload = 0;       // frames spent on the opening shot, so its pictures are asked for
    this._rest = null;       // then frames glancing at the other shots (see frame)
    this._later = [];        // jobs for once loading is done (later)
    this._sinceReady = 0;    // ms since the Enter button showed (see worldHidden)
    this._handedBack = false;   // the camera is back with the player (exit)
    this._tipStart = Math.floor(Math.random() * LOADING_TIPS.length);
    this._shot = -1;
    if (!splash) return;
    this.el = {
      fill: splash.querySelector('.sl-fill'), bar: splash.querySelector('#splash-loader'),
      tip: splash.querySelector('.sl-tip'), status: splash.querySelector('.sl-status'),
      fade: splash.querySelector('.title-fade'), place: splash.querySelector('.title-place'),
      heroes: splash.querySelector('.title-heroes'), sky: splash.querySelector('.title-skyline'),
      petals: splash.querySelector('.title-particles'), keyArt: splash.querySelector('.title-keyart'),
    };
    document.body.classList.add('title-on');
    if (this.still) splash.classList.add('title-still');
    this._showTip();
  }

  /** Count every picture the game creates from now until loading ends. */
  trackImages() {
    this._untrack = trackImages(this.tracker);
    this.tracker.job('fonts');
    try { document.fonts?.ready.then(() => this.tracker.done('fonts'), () => this.tracker.done('fonts')); } catch { this.tracker.done('fonts'); }
  }

  /** Run `fn` once loading is done (at once if it already is, or there's no
   *  title): pictures that aren't on screen at the start, fetched without
   *  holding up the bar or sharing the connection with what is. */
  later(fn) {
    if (!this.active || this.ready) { try { fn(); } catch (e) { console.error(e); } return; }
    this._later.push(fn);
  }

  /** Ask for the title's own pictures now, before the game is built: the
   *  painted city, the title heroes this screen has room for and the petals.
   *  They need nothing from the game, and the connection would otherwise sit
   *  idle while the world is generated. (attach does this too, if no one has.) */
  warm() {
    if (!this.splash || this._titleArt) return;
    for (const id of this._cast()) warmHero(id);
    // The drifting petals (fxImage's own Image is counted like any other).
    if (!this.still && !this.lowFx) for (const k of PETALS) fxImage(`particle-${k}`);
    const keyArt = this.el.keyArt;
    if (keyArt) {
      this._titleArt = [this.tracker.add(keyArt)];
      this._sky = keyArt;
      if (keyArt.complete && !keyArt.naturalWidth) this._useSkyline();
      else keyArt.addEventListener('error', () => { if (this.active) this._useSkyline(); }, { once: true });
    } else this._useSkyline();
  }

  /** Set up the layered skyline if the key art is unavailable. */
  _useSkyline() {
    this.splash.classList.remove('title-keyart-on');
    this._titleArt = TITLE_START_ART.filter((s) => titleArtSrc(s) && !(s === 'clouds' && this.lowFx)).map((s) => {
      if (typeof Image !== 'function') return null;
      const img = new Image(); img.src = titleArtSrc(s);
      if (s === 'sky') this._sky = img;
      return img;
    });
    // The near band: the painted trees and Supertrees (art slot "skyline"), else
    // the cosy neighbourhood at golden hour (cosytitle.js). The city behind it is
    // drawn in layers that sway apart (the parallax).
    if (this.el.sky) {
      this.el.sky.innerHTML = titleArtSrc('skyline') ? titleStripHTML(titleArtSrc('skyline')) : cosySkylineSvg({ city: false });
      this.el.sky.classList.toggle('painted', !!titleArtSrc('skyline'));
    }
    dressTitle(this.splash, { lowFx: this.lowFx, still: this.still });
    // A painted sky hides the live world, so the place caption goes; the
    // title sits on its ribbon.
    this.splash.classList.toggle('title-painted', !!titleArtSrc('sky'));
    if (titleArtSrc('logo-banner')) { this.splash.classList.add('title-banner'); this.splash.style.setProperty('--title-banner', `url("${new URL(titleArtSrc('logo-banner'), document.baseURI).href}")`); }   // absolute: a url() in a custom property resolves against the stylesheet that uses it
    this._buildLayers();
    // The other painted slots, where they have arrived (title.css picks them up).
    if (titleArtSrc('ground')) this.splash.style.setProperty('--title-ground', `url("${titleArtSrc('ground')}")`);
    // The mascot's portrait for the sun disc on small screens (title.css); absolute, like the ribbon's.
    if (titleArtSrc('medallion')) this.splash.style.setProperty('--title-medallion', `url("${new URL(titleArtSrc('medallion'), document.baseURI).href}")`);
    const mascot = this.splash.querySelector('.splash-mascot');
    if (mascot && titleArtSrc('loading-hero')) mascot.src = titleArtSrc('loading-hero');
  }

  /** The game is built: hook its camera, and warm up the heroes we'll need. */
  attach(game) {
    this.game = game;
    if (!this.splash) return;
    const cast = this._cast();
    this.warm();
    if (game.jobClass) warmHero(game.jobClass);
    this.later(() => {
      if (game.pendingStyleChoice || game.pendingClassChoice) {
        for (const id of Object.keys(CLASS_BY_ID)) warmHero(id);
      }
      for (const id of cast) swingArtReady(id);
      if (game.jobClass) warmHeroAnim(game.jobClass);
    });
  }

  /** Is there an opaque painting over the world? */
  _skyIn() {
    const img = this._sky;
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  /** True while the live world can't be seen behind the title (worldOutOfSight):
   *  the game loop skips drawing it then. */
  get worldHidden() {
    return this.active && worldOutOfSight({ ready: this.ready, skyIn: this._skyIn(), sinceReady: this._sinceReady, handedBack: this._handedBack });
  }

  /** The title heroes this screen shows (all of them when it can't be measured). */
  _cast() {
    const c = this.el?.heroes, card = this.splash?.querySelector('.splash-inner');
    if (!c?.clientWidth && this.splash?.classList?.contains('title-keyart-on')) return [];
    const w = c?.clientWidth || globalThis.innerWidth || 0;
    if (!w) return TITLE_HEROES;
    return titleCast(w, c?.clientHeight || 150, card?.getBoundingClientRect?.().width || w);
  }

  /** Called by the game loop after game.update: steer the camera and run the bar. */
  frame(dt) {
    if (!this.active || !this.game) return;
    const cam = this.game.camera;
    if (!this.ready) {
      this.loadMs += dt;
      // Show the opening shot for a frame or two first (behind the cream), so its
      // pictures are asked for: the bar waits for those. The later shots come
      // eleven seconds apart, so theirs needn't hold the player up.
      if (this._preload < 2) {
        const s = TITLE_SHOTS[0];
        cam.cx = s.from[0] * TILE; cam.cy = s.from[1] * TILE;
        // Framed as it will first be seen: at the shot's zoom, with the depth
        // view's tilt already in place. (Eased in, the tilt took a dozen slow
        // loading frames, each showing a little more ground, whose pictures
        // were then asked for, and waited for, a frame at a time.)
        const v = titleCameraAt(0, TITLE_SHOTS, this.still);
        cam.setZoomMul?.(v.zoom);
        cam.tilt = depthTarget(this.game, cam);
        this._preload++;
        return;
      }
      // Loaded: glance at each later shot for a frame, still behind the
      // cream and no longer counted, so their pictures start coming in. (One
      // frame asks for them all; a second only held the button back on a slow
      // phone, where each of these frames bakes a fresh patch of ground.)
      // Not under the painted sky: it hides those shots, so they never need
      // their pictures, and the button shows the moment the bar is full.
      if (this._rest != null) {
        const s = this._skyIn() ? null : TITLE_SHOTS[1 + this._rest];
        if (s) { cam.cx = s.from[0] * TILE; cam.cy = s.from[1] * TILE; this._rest++; return; }
        this._becomeReady();
      } else {
        this._updateBar(dt);
        if (this._rest != null && this._skyIn()) this._becomeReady();
      }
    }
    if (this.ready) this._sinceReady += dt;
    if (this.leaving) return;   // the camera returns to the player
    const keyArt = this.splash.classList.contains('title-keyart-on');
    if (keyArt && this.worldHidden) return;
    this.t += this.ready && !this.still ? dt : 0;
    if (this.ready) this._parallax(dt);
    const v = titleCameraAt(this.t, TITLE_SHOTS, this.still);
    cam.cx = v.x; cam.cy = v.y;
    cam.setZoomMul?.(v.zoom);
    if (!keyArt && this.el.fade) this.el.fade.style.opacity = this.ready ? v.fade.toFixed(3) : '0';
    if (!keyArt && v.shot !== this._shot && this.el.place) {
      this._shot = v.shot;
      this.el.place.textContent = v.name;
      // Restart the caption's fade-in for the new place.
      this.el.place.classList.remove('show'); void this.el.place.offsetWidth; this.el.place.classList.add('show');
    }
  }

  /** The sunset city's layers (TITLE_LAYERS), put in behind the near
   *  neighbourhood; a pointer moving over the title steers the parallax. */
  _buildLayers() {
    if (this._layers || typeof document === 'undefined') return;
    this._layers = [];
    const before = this.el.sky || this.splash.querySelector('.splash-inner');
    // The front layer goes after the near band (in front of it, behind the heroes).
    const front = this.el.heroes || this.splash.querySelector('.splash-inner');
    for (const layer of TITLE_LAYERS) {
      if (layer.id === 'clouds' && this.lowFx) continue;
      const html = titleLayerHTML(layer);
      if (layer.front && !html) continue;
      const div = document.createElement('div');
      div.className = `title-layer title-${layer.id}`;
      div.setAttribute('aria-hidden', 'true');
      div.innerHTML = html;
      this.splash.insertBefore(div, layer.front ? front : before);
      this._layers.push({ el: div, depth: layer.depth });
    }
    if (this.el.sky) this._layers.push({ el: this.el.sky, depth: 1 });
    this._pointer = 0; this._pan = 0;
    if (!this.still && typeof addEventListener === 'function') {
      this._onPointer = (e) => { this._pointer = Math.max(-1, Math.min(1, (e.clientX / (innerWidth || 1)) * 2 - 1)); };
      addEventListener('pointermove', this._onPointer, { passive: true });
    }
  }

  /** Sway the layers: a slow drift, plus the pointer on a mouse screen. Only
   *  transforms change, so it costs the page next to nothing. */
  _parallax(dt) {
    if (!this._layers?.length || this.still) return;
    const target = Math.sin(this.t / 9000) * 0.6 + this._pointer * 0.5;
    this._pan += (target - this._pan) * Math.min(1, dt / 700);
    for (const l of this._layers) if (l.depth) l.el.style.transform = `translate3d(${parallaxShift(l.depth, this._pan)}px,0,0)`;
  }

  _updateBar(dt) {
    const st = this.tracker.status();
    const target = 0.1 + 0.9 * st.ratio;
    // Eases toward the real figure (at most the whole bar in ~0.6s), never back.
    // A slow phone's long loading frames count in full (only a stall such as a
    // hidden tab is capped): capped at a tenth of a second, three frames a
    // second held a finished bar back by a couple of seconds.
    this.shown = Math.max(this.shown, Math.min(target, this.shown + Math.min(dt, 500) / 600));
    if (this.el.fill) this.el.fill.style.transform = `scaleX(${this.shown.toFixed(3)})`;
    this.el.bar?.setAttribute('aria-valuenow', String(Math.round(this.shown * 100)));
    if (this.el.status) this.el.status.textContent = st.total ? `Painting the island… ${st.loaded} / ${st.total}` : 'Painting the island…';
    if (Math.floor(this.loadMs / TIP_MS) !== this._tipN) this._showTip();
    const done = (st.idle && this.loadMs >= LOAD_MIN_MS && this.shown >= 0.99) || this.loadMs >= LOAD_MAX_MS;
    if (done) { this._untrack(); this._rest = 0; }
  }

  _showTip() {
    this._tipN = Math.floor(this.loadMs / TIP_MS);
    if (this.el.tip) this.el.tip.innerHTML = `<b>Tip:</b> ${tipAt(this.loadMs, this._tipStart)}`;
  }

  _becomeReady() {
    this.ready = true;
    this._untrack();
    if (this.el.fill) this.el.fill.style.transform = 'scaleX(1)';
    this.el.bar?.setAttribute('aria-valuenow', '100');
    this.splash.classList.add('ready');
    this.splash.classList.remove('loading');
    this._startHeroes();
    if (!this.still && !this.lowFx) this._startPetals();
    // Now that the player can come in, fetch what the start didn't need.
    for (const fn of this._later.splice(0)) { try { fn(); } catch (e) { console.error(e); } }
  }

  _startHeroes() {
    const canvas = this.el.heroes;
    if (!canvas) return;
    const cast = TITLE_HEROES.map((classId, i) => ({ classId, phase: i * 677, fx: 1 }));
    let nextSwing = 1800, turn = 0;
    this.stage = new HeroStage(canvas, (w, h, now) => {
      const card = this.splash.querySelector('.splash-inner')?.getBoundingClientRect();
      const scale = h < 120 ? 1.55 : 1.9;
      const feet = h - 16;
      const out = titleSpots(w, h, card ? card.width : w).map(([x, fx], i) => { cast[i].fx = fx; return { actor: cast[i], x, y: feet, scale }; });
      // Now and then one of them shows off a swing.
      if (!this.still && now > nextSwing && out.length) {
        swingActor(out[turn++ % out.length].actor, now);
        nextSwing = now + 1700 + (turn % 3) * 500;
      }
      return out;
    }, { fps: this.lowFx ? 24 : 40, still: this.still });
  }

  _startPetals() {
    const box = this.el.petals;
    if (!box) return;
    const n = (globalThis.innerWidth || 800) < 600 ? 8 : 14;
    for (let i = 0; i < n; i++) {
      const img = document.createElement('img');
      img.src = `assets/fx/particle-${PETALS[i % PETALS.length]}.webp`;
      img.alt = '';
      img.className = 'tp';
      const r = (a, b) => a + Math.random() * (b - a);
      img.style.cssText = `left:${r(-5, 100).toFixed(1)}%;--s:${r(14, 26).toFixed(0)}px;--dx:${r(-18, 14).toFixed(0)}vw;`
        + `--rot:${r(-540, 540).toFixed(0)}deg;animation-duration:${r(11, 19).toFixed(1)}s;animation-delay:${r(-18, 0).toFixed(1)}s`;
      box.appendChild(img);
    }
  }

  /** Leave the title: dip to cream, hand the camera back to the player and the
   *  HUD back to the screen, call `onIn` (e.g. open the class picker), then
   *  fade the splash away. */
  exit(onIn) {
    if (!this.active || this.leaving) return;
    this.leaving = true;
    const s = this.splash;
    s.style.pointerEvents = 'none';
    const swap = () => {
      this._handedBack = true;   // the world is drawn again from here (worldHidden)
      if (this.game) { this.game.camera.snapped = false; this.game.camera.setZoomMul?.(1); }
      document.body.classList.remove('title-on');
      try { onIn?.(); } catch (e) { console.error(e); }
      s.classList.add('leaving');
      const end = () => {
        s.classList.add('hidden'); this.stage?.stop(); this.active = false; if (this.el.petals) this.el.petals.innerHTML = '';
        if (this._onPointer) removeEventListener('pointermove', this._onPointer);
      };
      if (this.still) end(); else setTimeout(end, 560);
    };
    if (this.still) { swap(); return; }
    if (this.el.fade) { this.el.fade.style.transition = 'opacity .26s ease'; this.el.fade.style.opacity = '1'; }
    setTimeout(swap, 280);
  }
}
