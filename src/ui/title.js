// The title screen, the loading bar and the animated heroes of the class picker.
//
// - Title: the splash (index.html) sits over the game's own live world. While it
//   shows, the camera drifts through a few "shots" of the island (Kampong Glam,
//   Chinatown, the Sentosa shore, Marina Bay), cutting between them through a
//   soft cream dip, with a painted skyline, a row of class heroes idling (and now
//   and then swinging) in front, and petals drifting down. The world behind is
//   the real map with the real day cycle, so it costs no more than the game.
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
import { drawPlayer, drawShadow } from '../render/sprites.js';
import { sampleHeroClip, blendHeroFrame, weaponClipId, HERO_CLIPS } from '../render/heroanim.js';
import { fxImage } from '../render/fxart.js';
import { CLASS_BY_ID, starterWeapon } from '../data/classes.js';
import { TILE } from '../config.js';

// ---------------- Painted art slots ----------------
// Pictures that would lift the title and loading screens above the stand-ins
// drawn here. Drop a file into assets/title/<slot>.webp and add the slot to
// TITLE_ART: the screen uses it at once (tests/render.test.mjs keeps TITLE_ART
// in lock-step with the folder). Until then each slot has a placeholder.
export const TITLE_ART_SLOTS = {
  skyline: { size: '2400x280, transparent, seamless left-right', use: 'the Singapore skyline band behind the title heroes', placeholder: 'an inline SVG silhouette (titleSkylineSvg)' },
  backdrop: { size: '1920x1080 (and a 1080x1920 crop for phones), opaque', use: 'a painted key-art scene shown under the live world while it loads, and for reduced motion', placeholder: 'the cream paper background' },
  'loading-hero': { size: '512x512, transparent', use: 'a mascot illustration beside the loading bar (e.g. the A-Worthy mascot carrying a map)', placeholder: 'assets/mascot-login.webp' },
  ground: { size: '2400x160, transparent, seamless left-right', use: 'the grassy verge the title heroes stand on', placeholder: 'a CSS cream-to-green gradient' },
};
/** The slots that have a painted file in assets/title/ (none yet). */
export const TITLE_ART = new Set([]);
export const titleArtSrc = (slot) => (TITLE_ART.has(slot) ? `assets/title/${slot}.webp` : null);

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
// The classes that start with a weapon in each hand show both in the previews.
const DUAL_START = new Set(['pistoler']);
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
 */
export function drawClassHero(ctx, actor, x, y, now) {
  const cls = CLASS_BY_ID[actor.classId];
  if (!cls) return;
  const dual = DUAL_START.has(actor.classId);
  const held = { jobClass: actor.classId, weapon: cls.weapon, offhand: dual ? starterWeapon(actor.classId) : null };
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
}
/** Start a swing on `actor` (each one alternates clips for dual wielders). */
export function swingActor(actor, now) {
  actor.swings = (actor.swings || 0) + 1;
  actor.clip = attackClipFor(actor.classId, actor.swings);
  actor.attackAt = now;
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
    for (const a of this.layout(w, h, now)) {
      ctx.setTransform(dpr * a.scale, 0, 0, dpr * a.scale, dpr * a.x, dpr * a.y);
      drawClassHero(ctx, a.actor, 0, 0, now);
    }
    this._drawn++;
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

// ---------------- The title screen (browser only) ----------------
// The heroes posing on the title: a mix of melee, ranged, magic and the Dancer.
const TITLE_HEROES = ['swordsman', 'wizard', 'ranger', 'samurai', 'dancer', 'pistoler'];
const PETALS = ['petal_pink', 'frangipani', 'leaf_green', 'leaf_lime', 'petal_pink', 'dust_m'];
const LOAD_MIN_MS = 700;      // the bar never just flashes past
const LOAD_MAX_MS = 12000;    // ...and never holds the player up for long

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
    this._preload = 0;       // preload passes done (one shot per frame)
    this._tipStart = Math.floor(Math.random() * LOADING_TIPS.length);
    this._shot = -1;
    if (!splash) return;
    this.el = {
      fill: splash.querySelector('.sl-fill'), bar: splash.querySelector('#splash-loader'),
      tip: splash.querySelector('.sl-tip'), status: splash.querySelector('.sl-status'),
      fade: splash.querySelector('.title-fade'), place: splash.querySelector('.title-place'),
      heroes: splash.querySelector('.title-heroes'), sky: splash.querySelector('.title-skyline'),
      petals: splash.querySelector('.title-particles'), enter: splash.querySelector('#splash-enter'),
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

  /** The game is built: hook its camera, and warm up the heroes we'll need. */
  attach(game) {
    this.game = game;
    if (!this.splash) return;
    const picking = game.pendingStyleChoice || game.pendingClassChoice;
    // Draw each hero once off-screen, so its pictures are asked for (and counted)
    // now: the title's heroes, and every class when a class is still to be picked.
    const ids = picking ? Object.keys(CLASS_BY_ID) : TITLE_HEROES;
    const scratch = document.createElement('canvas').getContext('2d');
    for (const id of ids) {
      const a = { classId: id };
      drawClassHero(scratch, a, 0, 0, 0);
      // ...and the title heroes' swings too (their painted arms).
      if (TITLE_HEROES.includes(id)) for (const u of [0.25, 0.5, 0.75]) { a.attackAt = -u * previewAttackMs(attackClipFor(id)); drawClassHero(scratch, a, 0, 0, 0); }
    }
    // The drifting petals (fxImage's own Image is counted like any other).
    if (!this.still && !this.lowFx) for (const k of PETALS) fxImage(`particle-${k}`);
    if (this.el.sky) this.el.sky.innerHTML = titleArtSrc('skyline') ? `<img src="${titleArtSrc('skyline')}" alt="">` : titleSkylineSvg();
  }

  /** Called by the game loop after game.update: steer the camera and run the bar. */
  frame(dt) {
    if (!this.active || !this.game) return;
    const cam = this.game.camera;
    if (!this.ready) {
      this.loadMs += dt;
      // Visit every shot for a frame or two first, so their pictures are asked for.
      const n = TITLE_SHOTS.length;
      if (this._preload < n * 2) {
        const s = TITLE_SHOTS[this._preload % n];
        cam.cx = s.from[0] * TILE; cam.cy = s.from[1] * TILE;
        this._preload++;
        return;
      }
      this._updateBar();
    }
    if (this.leaving) return;   // the camera returns to the player
    this.t += this.ready && !this.still ? dt : 0;
    const v = titleCameraAt(this.t, TITLE_SHOTS, this.still);
    cam.cx = v.x; cam.cy = v.y;
    cam.setZoomMul?.(v.zoom);
    if (this.el.fade) this.el.fade.style.opacity = this.ready ? v.fade.toFixed(3) : '0';
    if (v.shot !== this._shot && this.el.place) {
      this._shot = v.shot;
      this.el.place.textContent = v.name;
      // Restart the caption's fade-in for the new place.
      this.el.place.classList.remove('show'); void this.el.place.offsetWidth; this.el.place.classList.add('show');
    }
  }

  _updateBar() {
    const st = this.tracker.status();
    const target = 0.1 + 0.9 * st.ratio;
    this.shown = Math.max(this.shown, Math.min(target, this.shown + 0.04));
    if (this.el.fill) this.el.fill.style.transform = `scaleX(${this.shown.toFixed(3)})`;
    this.el.bar?.setAttribute('aria-valuenow', String(Math.round(this.shown * 100)));
    if (this.el.status) this.el.status.textContent = st.total ? `Painting the island… ${st.loaded} / ${st.total}` : 'Painting the island…';
    if (Math.floor(this.loadMs / TIP_MS) !== this._tipN) this._showTip();
    const done = (st.idle && this.loadMs >= LOAD_MIN_MS && this.shown >= 0.99) || this.loadMs >= LOAD_MAX_MS;
    if (done) this._becomeReady();
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
    // Now that the player can come in, fetch the rest of the swings quietly.
    const g = this.game;
    if (g && (g.pendingStyleChoice || g.pendingClassChoice) && typeof setTimeout === 'function') {
      setTimeout(() => {
        const scratch = document.createElement('canvas').getContext('2d');
        for (const id of Object.keys(CLASS_BY_ID)) for (const u of [0.3, 0.6]) drawClassHero(scratch, { classId: id, attackAt: -u * previewAttackMs(attackClipFor(id)) }, 0, 0, 0);
      }, 400);
    }
  }

  _startHeroes() {
    const canvas = this.el.heroes;
    if (!canvas) return;
    const cast = TITLE_HEROES.map((classId, i) => ({ classId, phase: i * 677, fx: 1 }));
    let nextSwing = 1800, turn = 0;
    this.stage = new HeroStage(canvas, (w, h, now) => {
      // Wide screens: three a side of the card. Narrow ones: a row under it.
      const card = this.splash.querySelector('.splash-inner')?.getBoundingClientRect();
      const free = card ? (w - card.width) / 2 : 0;
      const scale = h < 120 ? 1.55 : 1.9;
      const feet = h - 16;
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
      const out = spots.slice(0, cast.length).map(([x, fx], i) => { cast[i].fx = fx; return { actor: cast[i], x, y: feet, scale }; });
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
      if (this.game) { this.game.camera.snapped = false; this.game.camera.setZoomMul?.(1); }
      document.body.classList.remove('title-on');
      try { onIn?.(); } catch (e) { console.error(e); }
      s.classList.add('leaving');
      const end = () => { s.classList.add('hidden'); this.stage?.stop(); this.active = false; if (this.el.petals) this.el.petals.innerHTML = ''; };
      if (this.still) end(); else setTimeout(end, 560);
    };
    if (this.still) { swap(); return; }
    if (this.el.fade) { this.el.fade.style.transition = 'opacity .26s ease'; this.el.fade.style.opacity = '1'; }
    setTimeout(swap, 280);
  }
}
