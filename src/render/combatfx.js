import { SPELLS } from '../data/magic.js';
import { classAccent } from '../data/classColours.js';
import { RARITY } from '../game/loot.js';
import { spawnElement } from './elementfx.js';
import { fxImage } from './fxart.js';
import { applyRow } from './projection.js';
import { drawScreenPic } from './ambience.js';
import { fxFade, fxGlow, fxRing } from './fxdepth.js';

// Combat "feel" effects: an impact for each kind of weapon (slash arcs, blunt
// rings and dust, arrow punctures, bullet tracers, elemental spell bursts, a
// whip's crack), cartoon stars on crits, a sticker "poof" when a monster dies,
// a sparkle as coins land, a ring of light on milestone levels, and a soft
// pulse at the screen's edges on big hits.
//
// Everything lives in one fixed pool of particle slots made up front, so a big
// fight allocates nothing per frame, and there is a hard cap on how many can
// be alive at once: when the pool is full the oldest effect is reused. The
// game spawns them (headless-safe: nothing here touches the DOM until drawn);
// the renderer ages and draws them each frame.

export const MAX_FX = 240;       // live effect slots on high graphics
export const MAX_FX_LOW = 90;    // ...and on low graphics
export const MAX_EFFECTS = 400;  // cap on the game's own effects list (hitsplats, projectiles...)

const INK = '#22304A';           // the sticker style's navy outline
const GOLD = '#ffd24a';

// ---------------- Which impact a weapon makes ----------------
// Blades cut (slash arcs), blunt weapons and bare fists thump (a ring and
// dust), bows, crossbows, thrown blades and the spear's thrust puncture
// (sparks along the line of the shot), guns fire a tracer, magic bursts in its
// element and whips crack.
const IMPACT_BY_WEAPON = {
  dagger: 'blade', sword: 'blade', scimitar: 'blade', longsword: 'blade', battleaxe: 'blade', '2h_sword': 'blade',
  claws: 'blade', katana: 'blade', halberd: 'blade', parang: 'blade', kerambit: 'blade', fan: 'blade',
  mace: 'blunt', warhammer: 'blunt', toya: 'blunt', knuckles: 'blunt', monk_gloves: 'blunt',
  spear: 'pierce', shortbow: 'pierce', longbow: 'pierce', crossbow: 'pierce', shuriken: 'pierce', chakram: 'pierce',
  pistol: 'bullet', rifle: 'bullet',
  staff: 'magic', wand: 'magic', orb: 'magic', censer: 'magic',
  whip: 'whip',
  cane: 'coin',   // a Merchant throws money
};
export const IMPACT_KINDS = ['blade', 'blunt', 'pierce', 'bullet', 'magic', 'whip', 'coin'];

/** The impact a weapon type makes. `mode` (the combat mode) decides for an
 *  unknown type: magic bursts, ranged punctures, anything else thumps. */
export function impactKind(weaponType, mode = 'melee') {
  const k = weaponType && IMPACT_BY_WEAPON[weaponType];
  if (k) return k;
  return mode === 'magic' ? 'magic' : mode === 'ranged' ? 'pierce' : mode === 'dance' ? 'whip' : 'blunt';
}

/** A spell's element from the colour its sparks are drawn in (each spell has
 *  its own tint), or null. Lets the hit hook tell fire from water for free. */
export function elementForTint(color) {
  for (const s of SPELLS) if (s.tint === color) return s.element;
  return null;
}

/** How long a shot takes to reach its target (ms): the same speeds the game's
 *  projectiles fly at (game.js _projectile), so a ranged impact lands with it. */
export function flightMs(kind, dist) {
  if (kind === 'pierce') return Math.min(650, 140 + dist / 0.55);
  if (kind === 'bullet') return 60 + dist / 5;
  if (kind === 'coin') return Math.min(560, 120 + dist / 0.6);
  if (kind === 'magic') return 240;
  return 0;
}

/** True for drops rare enough to stand in a glowing column of light: Epic and above. */
export function hasLightColumn(rarity) {
  return (RARITY[rarity]?.rank ?? 0) >= RARITY.epic.rank;
}

/** Milestone levels get the big celebration: every tenth level (10, 20 ... 50
 *  ... 100s) and 99. Everything else stays modest. */
export function isMilestoneLevel(level) {
  return level > 1 && (level % 10 === 0 || level === 99);
}

/** Where a fresh drop is in its bounce out of the body, `ms` after it fell:
 *  `k` how far along to its resting spot (0..1), `h` its height off the
 *  ground in px (it starts at the body's middle), and `land` a squash for the
 *  moment it touches down. One arc, one small bounce, then it settles. */
export const DROP_ARC_MS = 360, DROP_BOUNCE_MS = 200;
export function dropArc(ms, out = {}) {
  if (ms < DROP_ARC_MS) {
    const u = ms / DROP_ARC_MS;
    out.k = 1 - (1 - u) * (1 - u);              // quick out, easing into the landing
    out.h = 14 * (1 - u) + 76 * u * (1 - u);    // from the body's middle, up and over
  } else if (ms < DROP_ARC_MS + DROP_BOUNCE_MS) {
    const v = (ms - DROP_ARC_MS) / DROP_BOUNCE_MS;
    out.k = 1; out.h = 24 * v * (1 - v);
  } else { out.k = 1; out.h = 0; }
  const d1 = Math.abs(ms - DROP_ARC_MS), d2 = Math.abs(ms - DROP_ARC_MS - DROP_BOUNCE_MS);
  out.land = Math.max(0, 1 - Math.min(d1, d2 * 1.6) / 70);
  return out;
}

/** Tidy a list of effects or particles in place (no new array each frame):
 *  drop the spent ones, and past `cap` the oldest. */
export function keepLive(arr, cap = Infinity) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) { const e = arr[i]; if (e.life > 0) arr[w++] = e; }
  arr.length = w;
  if (w > cap) arr.splice(0, w - cap);
  return arr;
}

// ---------------- The effect pool ----------------
// Slot kinds (numbers, so drawing is a cheap switch).
const RING = 1, SPARK = 2, DOT = 3, CHIP = 4, SWIRL = 5, STAR = 6, ARC = 7, TRACER = 8, POOF = 9, CLOUD = 10, GLOW = 11, RAY = 12, TWINKLE = 13;
// Added for juice.js: a lightning crackle, sticker confetti and a rising sticker label.
const BOLT = 14, CONFETTI = 15, LABEL = 16;
// A painted effect sticker (fxart.js EFFECT_ART), one picture per slot.
const STICKER = 17;
/** The slot kinds by name (for the tests and anyone inspecting the pool). */
export const FX_KIND = { RING, SPARK, DOT, CHIP, SWIRL, STAR, ARC, TRACER, POOF, CLOUD, GLOW, RAY, TWINKLE, BOLT, CONFETTI, LABEL, STICKER };
// The shapes an element's pieces can name (elementfx.js).
const KIND_BY_NAME = { dot: DOT, chip: CHIP, spark: SPARK, cloud: CLOUD, twinkle: TWINKLE, star: STAR, bolt: BOLT, confetti: CONFETTI };
// Sticker confetti colours: the A-Worthy pastels and white.
const CONFETTI_COLS = ['#F5B82E', '#FF8AA8', '#6FC3FF', '#7FD36A', '#B98CF0', '#FFFFFF'];

function newSlot() {
  return { k: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 0, max: 1, delay: 0, size: 1, a: 0, b: 0, sq: 1,
    rot: 0, spin: 0, ex: 0, ey: 0, col: '#fff', add: false, fresh: false, txt: '' };
}

// Cosmetic randomness from its own little generator, so effects never shift
// the game's Math.random sequence (fights and drops stay exactly as they were).
let seed = 0x2545f491;
function rnd() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}

export class CombatFx {
  constructor(size = MAX_FX) {
    this.slots = [];
    for (let i = 0; i < size; i++) this.slots.push(newSlot());
    this.live = 0;          // slots[0 .. live) are in use
    this.low = false;       // low graphics: fewer pieces and a lower cap
    this.pulseT = 0;        // screen-edge pulse: ms left, its length, strength and colour
    this.pulseMax = 1;
    this.pulseK = 0;
    this.pulseCol = 'big';
    this._vig = {};         // baked edge-glow pictures, one per colour
    this._sp = [];          // the slots the current spawner has handed out
  }

  get cap() { return Math.min(this.slots.length, this.low ? MAX_FX_LOW : MAX_FX); }

  /** A free slot, reset to defaults. When full, the oldest live one is reused. */
  _take(k, x, y, life, col) {
    let s;
    if (this.live < this.cap) s = this.slots[this.live++];
    else {
      // Full: recycle the slot nearest the end of its life (the oldest).
      let best = 0, bl = Infinity;
      for (let i = 0; i < this.live; i++) { const t = this.slots[i].life + this.slots[i].delay; if (t < bl) { bl = t; best = i; } }
      s = this.slots[best];
    }
    s.k = k; s.x = x; s.y = y; s.vx = 0; s.vy = 0; s.g = 0; s.drag = 1; s.life = life; s.max = life; s.delay = 0;
    s.size = 1; s.a = 0; s.b = 0; s.sq = 1; s.rot = 0; s.spin = 0; s.ex = x; s.ey = y; s.col = col; s.add = false; s.fresh = false; s.txt = '';
    this._sp.push(s);
    return s;
  }

  // Every slot one spawner hands out is noted, so the whole group can be
  // delayed together (a shot's flight) or held for the hero's swing.
  _begin() { this._sp.length = 0; }
  _end(delay = 0, melee = false) {
    for (const s of this._sp) {
      if (s.k === TRACER) continue;   // a tracer streaks out at once
      s.delay += delay; s.fresh = melee;
    }
    this._sp.length = 0;
  }

  _n(n) { return this.low ? Math.max(1, n >> 1) : n; }

  // --- spawners ---
  ring(x, y, r0, r1, life, col, width = 2.5, sq = 1) {
    const s = this._take(RING, x, y, life, col); s.a = r0; s.b = r1; s.size = width; s.sq = sq; return s;
  }
  _burst(k, x, y, n, speed, life, col, opts = {}) {
    for (let i = 0; i < n; i++) {
      const ang = (opts.ang ?? 0) + (opts.spread ?? Math.PI * 2) * (n > 1 ? (i / n - 0.5 + (rnd() - 0.5) / n) : 0) + (opts.spread ? 0 : rnd() * 6.283);
      const sp = speed * (0.6 + rnd() * 0.7);
      const s = this._take(k, x, y, life * (0.75 + rnd() * 0.5), col);
      s.vx = Math.cos(ang) * sp; s.vy = Math.sin(ang) * sp + (opts.up || 0);
      s.g = opts.g || 0; s.drag = opts.drag ?? 0.992; s.size = (opts.size || 2) * (0.7 + rnd() * 0.6);
      s.rot = rnd() * 6.283; s.spin = opts.spin ? (rnd() - 0.5) * opts.spin : 0; s.add = !!opts.add;
    }
  }

  /** A soft enchanted glow behind a hit (skipped on low graphics by callers). */
  glow(x, y, size, life, col) { const g = this._take(GLOW, x, y, life, col); g.size = size; return g; }

  /** A burst of `n` pieces of a named shape (elementfx.js): 'dot', 'chip',
   *  'spark', 'cloud', 'twinkle', 'star', 'bolt', 'confetti', 'swirl', 'ray'. */
  burstOf(name, x, y, n, p = {}) {
    n = this._n(n);
    if (name === 'swirl') {
      for (let i = 0; i < n; i++) {
        const s = this._take(SWIRL, x, y, p.life || 420, i && p.col2 ? p.col2 : p.col);
        s.a = 4; s.b = 16 + i * 4; s.rot = i * 2.1; s.spin = 0.014 * (i % 2 ? -1 : 1);
      }
      return;
    }
    if (name === 'ray') {
      for (let i = 0; i < n; i++) {
        const r = this._take(RAY, x, y, p.life || 400, p.col); r.rot = (i / n) * Math.PI * 2 + rnd(); r.spin = 0.002; r.size = p.size || 24;
      }
      return;
    }
    if (name === 'arc') {
      // Sticker crescents sweeping across the hit (an ability's swoosh).
      for (let i = 0; i < n; i++) {
        const s = this._take(ARC, x, y, p.life || 260, p.col);
        s.rot = (p.rot ?? rnd() * 6.283) + i * 1.3; s.spin = (i % 2 ? -1 : 1) * 0.011; s.size = (p.size || 18) + i * 4;
      }
      return;
    }
    if (name === 'bolt') {
      // Little zig-zag bolts flicking out from the hit, each on its own phase.
      for (let i = 0; i < n; i++) {
        const s = this._take(BOLT, x, y, (p.life || 170) * (0.7 + rnd() * 0.6), p.col);
        s.rot = (i / n) * Math.PI * 2 + rnd() * 0.8; s.size = (p.size || 14) * (0.7 + rnd() * 0.5); s.a = rnd() * 1000;
      }
      return;
    }
    this._burst(KIND_BY_NAME[name] || DOT, x, y, n, p.speed ?? 0.08, p.life || 400, p.col, p);
  }

  /** A painted effect (assets/fx/<key>.webp) `h` px tall that pops in, grows
   *  by `o.grow` of its size, spins by `o.spin` and fades over `life` ms. Only
   *  when its picture has loaded: returns false otherwise (and headless), so
   *  the caller draws its canvas pieces instead. */
  sticker(key, x, y, h, life, o = {}) {
    if (!fxImage(key)) return false;
    const s = this._take(STICKER, x, y, life, '#fff');
    s.txt = key; s.size = h; s.a = o.grow || 0; s.b = o.alpha || 1;
    s.rot = o.rot ?? (rnd() - 0.5) * 0.5; s.spin = o.spin || 0; s.vy = o.vy || 0; s.g = o.g || 0;
    return s;
  }

  /** Sticker confetti: little paper squares that flutter up and drift down
   *  (with the painted scatter of confetti once it has loaded, and half the squares). */
  confetti(x, y, n, scale = 1, cols = CONFETTI_COLS) {
    if (this.sticker('fx-confetti', x, y - 8, 34 * Math.min(1.5, scale), 1000, { grow: 0.35, vy: -0.03, g: 0.00006, spin: 0.0004 })) n = Math.ceil(n / 2);
    n = this._n(n);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.4, sp = (0.07 + rnd() * 0.09) * scale;
      const s = this._take(CONFETTI, x, y, 800 + rnd() * 500, cols[i % cols.length]);
      s.vx = Math.cos(ang) * sp; s.vy = Math.sin(ang) * sp; s.g = 0.00022; s.drag = 0.985;
      s.size = (2.2 + rnd() * 1.4) * Math.min(1.5, scale); s.rot = rnd() * 6.283; s.spin = (rnd() - 0.5) * 0.03; s.a = rnd() * 6.283;
    }
  }

  /** A white sticker label that pops in and rises (a level-up, "x2!"). */
  label(x, y, text, col = INK, life = 1300, scale = 1) {
    const s = this._take(LABEL, x, y, life, col); s.txt = text; s.size = scale; s.vy = -0.018; s.drag = 0.995;
    return s;
  }

  /** The hit of one blow. `kind` from impactKind; opts: from {x,y} (the
   *  attacker, for the line of a shot), delay (ms until it lands), element
   *  (magic), crit, jobClass, melee (wait for the hero's weapon to land). */
  impact(kind, x, y, opts = {}) {
    this._begin();
    const crit = !!opts.crit, accent = classAccent(opts.jobClass)?.colour;
    const dx = opts.from ? x - opts.from.x : 1, dy = opts.from ? y - opts.from.y : 0;
    const ang = Math.atan2(dy, dx);
    if (!this.low && (kind === 'blade' || kind === 'blunt' || kind === 'whip')) {
      this.glow(x, y, crit ? 24 : 17, 180, accent ?? (crit ? GOLD : '#ffe3a5'));
    }
    switch (kind) {
      case 'blade': {
        // A bold sticker crescent (white with a coloured edge) cutting across.
        const a = this._take(ARC, x, y, 230, accent ?? (crit ? GOLD : '#ffffff'));
        a.rot = rnd() * 6.283; a.spin = (rnd() < 0.5 ? -1 : 1) * 0.009; a.size = crit ? 19 : 15;
        this._burst(SPARK, x, y, this._n(4), 0.16, 220, crit ? GOLD : '#fff6cf', { add: true, size: 1.6 });
        break;
      }
      case 'blunt': {
        this.ring(x, y, 4, crit ? 26 : 20, 260, '#ffffff', 3.5);
        this.ring(x, y + 12, 3, 22, 340, accent ?? '#e9d7ad', 2.5, 0.42);   // a shock ring on the ground
        this._burst(CLOUD, x, y + 10, this._n(5), 0.035, 520, '#efe4cc', { size: 4, up: -0.02, drag: 0.985 });
        break;
      }
      case 'pierce': {
        // Puncture: a tight spray of sparks out the far side of the hit.
        this._burst(SPARK, x, y, this._n(6), 0.2, 200, crit ? GOLD : '#fff2b0', { ang, spread: 1.1, add: true, size: 1.5 });
        this.ring(x, y, 2, 9, 160, accent ?? '#ffffff', 2);
        break;
      }
      case 'bullet': {
        if (opts.gun === 'pistol') {
          // A pistol round is small (four a beat): a tiny pop and a spark or two, no tracer.
          this.ring(x, y, 1.5, 6, 140, accent ?? '#ffffff', 1.5);
          this._burst(SPARK, x, y, this._n(2), 0.16, 120, crit ? GOLD : '#ffe28a', { ang, spread: 2, add: true, size: 1 });
          break;
        }
        // A rifle round (and any other gun): the tracer streaks muzzle to target at
        // once; a heavy pop, sparks out the far side and a puff of smoke.
        if (opts.from) {
          const t = this._take(TRACER, opts.from.x, opts.from.y - 4, 150, '#ffe28a');
          t.ex = x; t.ey = y;
        }
        this.ring(x, y, 3, 18, 200, accent ?? '#ffffff', 3.5);
        this._burst(SPARK, x, y, this._n(7), 0.26, 180, crit ? GOLD : '#ffe28a', { ang, spread: 1.2, add: true, size: 1.6 });
        this._burst(CLOUD, x, y, this._n(3), 0.02, 420, '#d8d8d8', { size: 3.5 });
        break;
      }
      case 'magic': this._spell(x, y, opts.element, crit); break;
      case 'whip': {
        // The crack: two quick thin rings, one just after the other, and a snap of sparks.
        this.ring(x, y, 2, 18, 200, accent ?? '#ff8ac0', 2);
        this.ring(x, y, 2, 12, 200, '#ffffff', 1.5).delay = 50;
        this._burst(SPARK, x, y, this._n(3), 0.18, 160, '#ffd0e6', { add: true, size: 1.4 });
        break;
      }
      case 'coin': {
        this.ring(x, y, 3, 14, 220, GOLD, 2.5);
        this._burst(TWINKLE, x, y, this._n(4), 0.07, 420, GOLD, { size: 3, up: -0.03 });
        break;
      }
    }
    // An elemental blow that isn't a spell (an enchanted weapon) adds its element's look.
    if (kind !== 'magic' && opts.element) spawnElement(this, opts.element, x, y, crit);
    // Spell elements and gold coins keep their own colours. A small rim
    // next to that impact identifies the class without tinting the effect.
    if (accent && (kind === 'magic' || kind === 'coin')) this.ring(x, y, 5, 15, 200, accent, 1.7);
    // The pieces of this hit land together, after the shot's flight.
    this._end(opts.delay || 0, !!opts.melee);
  }

  /** A spell's burst by element, and an enchanted glow behind it: the table
   *  of looks is in elementfx.js (an unknown element gets a soft arcane burst). */
  _spell(x, y, element, crit) { spawnElement(this, element, x, y, crit); }

  /** Cartoon impact stars bursting off a crit (no blood: this is a cosy game). */
  critStars(x, y, opts = {}) {
    this._begin();
    const big = !!opts.big;
    this._burst(STAR, x, y, this._n(big ? 6 : 4), big ? 0.13 : 0.1, 560, GOLD, { up: -0.04, g: 0.0002, spin: 0.02, size: big ? 8 : 6.5 });
    this.ring(x, y, 4, big ? 24 : 16, 200, '#ffffff', 3);
    this._end(opts.delay || 0, !!opts.melee);
  }

  /** A monster pops: a puff of sticker clouds and stars, and a little "POOF!". */
  deathPoof(x, y, scale = 1, delay = 0) {
    this._begin();
    this._burst(CLOUD, x, y, this._n(6), 0.05 * scale, 520, '#ffffff', { size: 5 * scale, up: -0.015, drag: 0.98 });
    this._burst(STAR, x, y, this._n(5), 0.11 * scale, 620, GOLD, { up: -0.05, g: 0.0002, spin: 0.02, size: 4.5 * scale });
    // ...then sticker confetti and a white ring, so a kill reads as a little celebration.
    this.ring(x, y, 4 * scale, 22 * scale, 300, '#ffffff', 3.5);
    this.confetti(x, y - 4, Math.round(10 * Math.min(1.6, scale)), scale);
    const p = this._take(POOF, x, y - 10 * scale, 760, INK);
    p.size = Math.min(1.8, scale); p.vy = -0.02;
    this._end(delay);
  }

  /** A monster coming back: a flat ring of dust spreading from its feet, a few
   *  specks of earth kicked out sideways and (not on low graphics) two small glints. */
  spawnPuff(x, y, scale = 1) {
    this._begin();
    this.ring(x, y, 3 * scale, 15 * scale, 320, '#fffaf0', 2, 0.4);
    this._burst(DOT, x, y - 1, this._n(6), 0.07 * scale, 300, '#e9dcc0', { up: -0.03, g: 0.0003, size: 1.3 * scale });
    if (!this.low) this._burst(TWINKLE, x, y - 12 * scale, 2, 0.04, 420, '#fff6c8', { up: -0.03, size: 1.5 });
    this._end(0);
  }

  /** Coins landing burst in a twinkling sparkle. */
  coinSparkle(x, y, delay = 0) {
    this._begin();
    this._burst(TWINKLE, x, y, this._n(7), 0.06, 560, GOLD, { up: -0.04, size: 3.2 });
    this.ring(x, y + 2, 2, 12, 260, '#fff2a0', 2, 0.5);
    this._end(delay);
  }

  /** A rare-or-better drop picked up: a little burst of twinkles in its
   *  rarity's colour (more for the rarer), and a ring of light unless `calm`
   *  (Reduce motion). */
  lootSparkle(x, y, col, rank = 1, calm = false) {
    this._begin();
    this._burst(TWINKLE, x, y - 4, this._n(3 + rank * 2), calm ? 0.025 : 0.07, 520, col, { up: -0.05, size: 2.6 + rank * 0.3 });
    this._burst(TWINKLE, x, y - 4, this._n(2), calm ? 0.02 : 0.05, 480, '#fff6c8', { up: -0.04, size: 2.4 });
    if (!calm) this.ring(x, y + 2, 3, 12 + rank * 3, 300, col, 2, 0.5);
    this._end(0);
  }

  /** A milestone level: a ring of light, rays and twinkles (the game adds the
   *  confetti and the sound as for any level). */
  levelBurst(x, y) {
    this._begin();
    this.ring(x, y, 8, 70, 760, '#fff3b0', 6);
    this.ring(x, y, 6, 52, 700, GOLD, 3).delay = 140;
    this.ring(x, y + 14, 6, 46, 820, '#ffe680', 3, 0.42);
    if (!this.low) { const g = this._take(GLOW, x, y, 900, GOLD); g.size = 46; }
    const n = this._n(12);
    for (let i = 0; i < n; i++) {
      const r = this._take(RAY, x, y, 820, i % 2 ? '#fff6c8' : GOLD);
      r.rot = (i / n) * Math.PI * 2; r.spin = 0.0012; r.size = 56 + (i % 3) * 10;
    }
    this._burst(TWINKLE, x, y, this._n(10), 0.09, 900, '#fff6c8', { up: -0.04, size: 3.5 });
    this._end();
  }

  /** Every level-up: a ring of stars round the hero, sticker confetti and a
   *  rising "<Skill> <level>!" label (milestones add levelBurst on top). */
  levelPop(x, y, text, big = false) {
    this._begin();
    this.ring(x, y + 12, 6, big ? 44 : 34, 620, GOLD, 3, 0.42);   // round the hero's feet
    const n = this._n(big ? 10 : 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, s = this._take(STAR, x, y, 700, i % 2 ? '#ffffff' : GOLD);
      s.vx = Math.cos(a) * 0.11; s.vy = Math.sin(a) * 0.07 - 0.03; s.drag = 0.975; s.g = 0.00008; s.size = big ? 6.5 : 5; s.spin = 0.008;
    }
    this.confetti(x, y - 6, big ? 26 : 14);
    if (text) this.label(x, y - 24, text, '#B8860B', 1500, big ? 1.2 : 1).a = 1;   // on the painted ribbon
    this._end();
  }

  /** A soft pulse at the screen's edges: 'big' (gold, a huge hit you dealt)
   *  or 'hurt' (red, you were hit hard). `k` 0..1 sets its strength. */
  pulse(col, k = 1) {
    if (this.pulseT > 0 && this.pulseK * (this.pulseT / this.pulseMax) > k) return;   // a stronger one is already showing
    this.pulseCol = col; this.pulseK = Math.max(0.2, Math.min(1, k)); this.pulseT = this.pulseMax = 420;
  }

  /** Impacts of a melee blow wait for the hero's weapon to land (the game deals
   *  the blow as the swing starts): the renderer passes how long until then. */
  armFresh(delayMs) {
    for (let i = 0; i < this.live; i++) {
      const s = this.slots[i];
      if (!s.fresh) continue;
      s.fresh = false;
      if (delayMs > 0) s.delay += delayMs;
    }
  }

  /** Age everything by `dt` ms and free the spent slots (swap-remove, no allocation). */
  update(dt) {
    if (this.pulseT > 0) this.pulseT = Math.max(0, this.pulseT - dt);
    let i = 0;
    while (i < this.live) {
      const s = this.slots[i];
      let step = dt;
      if (s.delay > 0) {
        s.delay -= dt;
        if (s.delay > 0) { i++; continue; }
        step = -s.delay;
        s.delay = 0;
      }
      s.life -= step;
      if (s.life <= 0) {
        // Swap the last live slot into this place.
        const last = this.slots[--this.live];
        this.slots[this.live] = s; this.slots[i] = last;
        continue;
      }
      if (s.drag !== 1) { const d = s.drag ** (step / 16); s.vx *= d; s.vy *= d; }
      s.vy += s.g * step;
      s.x += s.vx * step; s.y += s.vy * step;
      s.rot += s.spin * step;
      i++;
    }
  }

  clear() { this.live = 0; this.pulseT = 0; }

  // The same pool that draws the impact lights the floor at night. Delayed
  // or held impacts give off no light until the blow is visible.
  lights(visit) {
    let drawn = 0;
    for (let i = 0; i < this.live && drawn < 6; i++) {
      const s = this.slots[i];
      if (s.k !== GLOW || s.fresh || s.delay > 0 || s.life <= 0) continue;
      const age = 1 - s.life / s.max;
      if (visit(s.x, s.y + 12, s.size * (1.1 + age * 0.65), s.col, fxFade(age) * 0.76)) drawn++;
    }
  }

  // ---------------- Drawing ----------------
  draw(ctx, ox, oy, pj = null, detail = !this.low, calm = false) {
    if (!this.live) return;
    for (let i = 0; i < this.live; i++) {
      const s = this.slots[i];
      if (s.delay > 0 || s.fresh) continue;
      if (pj) applyRow(ctx, pj, s.y - oy);   // the depth view: at its row (the caller puts it back)
      const t = 1 - s.life / s.max, fade = 1 - t;
      const x = s.x - ox, y = s.y - oy;
      ctx.globalCompositeOperation = s.add ? 'lighter' : 'source-over';
      switch (s.k) {
        case RING: {
          const r = s.a + (s.b - s.a) * (1 - fade * fade);
          ctx.globalAlpha = 1;
          fxRing(ctx, x, y, r, r * s.sq, s.col, Math.max(0.5, s.size * fade), fxFade(t), detail);
          break;
        }
        case SPARK: {
          ctx.globalAlpha = fade; ctx.strokeStyle = s.col; ctx.lineWidth = s.size; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s.vx * 28, y - s.vy * 28); ctx.stroke();
          if (detail && s.size > 1.35) {
            ctx.globalAlpha = fade * 0.65; ctx.strokeStyle = '#fff7db'; ctx.lineWidth = s.size * 0.45;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s.vx * 11, y - s.vy * 11); ctx.stroke();
          }
          break;
        }
        case DOT: {
          ctx.globalAlpha = fade; ctx.fillStyle = s.col;
          ctx.beginPath(); ctx.arc(x, y, s.size * (0.5 + 0.5 * fade), 0, 6.2832); ctx.fill();
          break;
        }
        case CHIP: {
          ctx.globalAlpha = Math.min(1, fade * 2);
          ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot);
          ctx.fillStyle = s.col; ctx.strokeStyle = INK; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-s.size, -s.size * 0.6); ctx.lineTo(s.size, -s.size); ctx.lineTo(s.size * 0.7, s.size * 0.8); ctx.lineTo(-s.size * 0.8, s.size * 0.6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          if (detail) {
            ctx.globalAlpha *= 0.6; ctx.strokeStyle = '#fff8e9'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(-s.size * 0.7, -s.size * 0.5); ctx.lineTo(s.size * 0.63, -s.size * 0.78); ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case SWIRL: {
          const r = s.a + (s.b - s.a) * t;
          ctx.globalAlpha = fade; ctx.strokeStyle = s.col; ctx.lineWidth = 2.2 * fade + 0.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(x, y, r, s.rot, s.rot + 3.6); ctx.stroke();
          break;
        }
        case STAR: {
          // Pops in big, then shrinks away as it flies.
          const pop = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) * 0.6;
          ctx.globalAlpha = Math.min(1, fade * 2.2);
          ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot);
          // Stamp the cached picture at full opacity. Draw the fading star's
          // outline and fill directly so both keep their original overlap.
          if (!(ctx.globalAlpha >= 0.999 && !s.add && stampStar(ctx, s.size * pop, s.col))) drawStar(ctx, s.size * pop, s.col);
          ctx.restore();
          break;
        }
        case ARC: {
          // A sticker crescent: white body, coloured edge, navy outline, sweeping round.
          ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot);
          const r = s.size * (0.8 + t * 0.35);
          ctx.globalAlpha = fxFade(t);
          ctx.lineCap = 'round';
          ctx.strokeStyle = INK; ctx.lineWidth = 7 * fade + 1.5; ctx.beginPath(); ctx.arc(0, 0, r, -0.9, 0.9); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5 * fade + 0.8; ctx.beginPath(); ctx.arc(0, 0, r, -0.9, 0.9); ctx.stroke();
          ctx.strokeStyle = s.col; ctx.lineWidth = 2 * fade + 0.4; ctx.beginPath(); ctx.arc(0, 0, r + 1.5, -0.6, 0.6); ctx.stroke();
          if (detail) {
            ctx.strokeStyle = '#fff3c9'; ctx.lineWidth = 0.8 + 1.4 * fade;
            ctx.beginPath(); ctx.arc(0, 0, r - 1.4, -0.6, 0.32); ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case TRACER: {
          const ex = s.ex - ox, ey = s.ey - oy;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = s.col; ctx.lineWidth = 2.2 * fade + 0.4; ctx.lineCap = 'round';
          // The streak's tail catches up with its head as it fades.
          ctx.beginPath(); ctx.moveTo(x + (ex - x) * t * 0.85, y + (ey - y) * t * 0.85); ctx.lineTo(ex, ey); ctx.stroke();
          break;
        }
        case CLOUD: {
          const r = s.size * (0.6 + t * 0.9);
          ctx.globalAlpha = fade * 0.95;
          ctx.fillStyle = s.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.stroke();
          break;
        }
        case POOF: {
          // A white sticker label: pops up big, settles, then fades.
          const pop = t < 0.18 ? 0.4 + (t / 0.18) * 0.75 : t < 0.3 ? 1.15 - (t - 0.18) / 0.12 * 0.15 : 1;
          ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
          ctx.save(); ctx.translate(x, y); ctx.scale(pop * s.size, pop * s.size); ctx.rotate(-0.12);
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-17, -7.5, 34, 15, 7.5); else ctx.rect(-17, -7.5, 34, 15);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = INK; ctx.font = 'bold 10px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('POOF!', 0, 0.5);
          ctx.restore();
          break;
        }
        case GLOW: {
          if (detail) {
            const r = s.size * (0.72 + t * 0.5);
            ctx.globalAlpha = 1;
            fxGlow(ctx, x, y, r, r * 0.8, s.col, fxFade(t) * (calm ? 0.45 : 0.74));
          }
          break;
        }
        case RAY: {
          const len = s.size * (0.35 + t * 0.8), w = 0.07 * fade + 0.02;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade * 0.7; ctx.fillStyle = s.col;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(s.rot - w) * len, y + Math.sin(s.rot - w) * len);
          ctx.lineTo(x + Math.cos(s.rot + w) * len, y + Math.sin(s.rot + w) * len);
          ctx.closePath(); ctx.fill();
          break;
        }
        case TWINKLE: {
          // A four-pointed glint that grows then shrinks.
          const r = s.size * Math.sin(Math.min(1, t * 1.2) * Math.PI);
          if (r <= 0.2) break;
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.fillStyle = s.col;
          ctx.beginPath();
          ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r * 0.45, y - r * 0.45); ctx.lineTo(x + r * 2, y); ctx.lineTo(x + r * 0.45, y + r * 0.45);
          ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r * 0.45, y + r * 0.45); ctx.lineTo(x - r * 2, y); ctx.lineTo(x - r * 0.45, y - r * 0.45);
          ctx.closePath(); ctx.fill();
          break;
        }
        case BOLT: {
          // The bends travel through the bolt and settle instead of jumping each frame.
          const len = s.size * (0.6 + t * 0.6), c = Math.cos(s.rot), sn = Math.sin(s.rot);
          // Sticker-drawn: a navy edge, the bolt's colour, a white-hot core.
          ctx.globalAlpha = Math.min(1, fade * 1.6); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let j = 1; j <= 3; j++) {
            const d = len * j / 3;
            const k = j < 3 ? Math.sin(s.a + j * 3.8 + (calm ? 0 : t * 5)) * len * 0.24 : 0;
            ctx.lineTo(x + c * d - sn * k, y + sn * d + c * k);
          }
          ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.stroke();
          ctx.strokeStyle = s.col; ctx.lineWidth = 2.6; ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
          break;
        }
        case CONFETTI: {
          // A paper square tumbling: it flips (squashes) as it spins and sways as it falls.
          ctx.globalAlpha = Math.min(1, fade * 2.5); ctx.fillStyle = s.col;
          ctx.save(); ctx.translate(x + Math.sin(s.a + s.life * 0.006) * 2, y); ctx.rotate(s.rot);
          ctx.scale(1, Math.cos(s.rot * 3 + s.a) * 0.8 + 0.2);
          ctx.fillRect(-s.size, -s.size * 0.6, s.size * 2, s.size * 1.2);
          if (s.col === '#FFFFFF') { ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.strokeRect(-s.size, -s.size * 0.6, s.size * 2, s.size * 1.2); }
          ctx.restore();
          break;
        }
        case LABEL: {
          // A white sticker label: springs in past full size, settles, then fades as it rises.
          const age = s.max - s.life, pop = juicePop(age);
          ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
          ctx.save(); ctx.translate(x, y); ctx.scale(pop * s.size, pop * s.size); ctx.rotate(-0.06);
          ctx.font = '900 11px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const rib = s.a === 1 ? fxImage('fx-levelup-ribbon') : null;
          if (rib) {
            // A level-up's painted ribbon, stretched to the words: its folded
            // ends keep their shape and only the middle of the band stretches.
            const tw = ctx.measureText(s.txt).width, h = 30, k = h / rib.naturalHeight;
            const ew = rib.naturalWidth * 0.3, ed = ew * k, mw = tw + 8;
            const x0 = -(mw / 2) - ed;
            ctx.drawImage(rib, ew, 0, rib.naturalWidth - 2 * ew, rib.naturalHeight, x0 + ed - 0.5, -h / 2, mw + 1, h);
            ctx.drawImage(rib, 0, 0, ew, rib.naturalHeight, x0, -h / 2, ed, h);
            ctx.drawImage(rib, rib.naturalWidth - ew, 0, ew, rib.naturalHeight, x0 + ed + mw, -h / 2, ed, h);
            ctx.fillStyle = s.col; ctx.fillText(s.txt, 0, -1.5);
            ctx.restore();
            break;
          }
          const w = ctx.measureText(s.txt).width + 14;
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-w / 2, -9, w, 18, 9); else ctx.rect(-w / 2, -9, w, 18);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = s.col; ctx.fillText(s.txt, 0, 0.5);
          ctx.restore();
          break;
        }
        case STICKER: {
          // A painted effect: springs in, swells a little and fades out over its last half.
          const img = fxImage(s.txt);
          if (!img) break;
          const pop = juicePop(s.max - s.life, 0.25) * (1 + s.a * t);
          const h = s.size * pop, w = h * img.naturalWidth / img.naturalHeight;
          ctx.globalAlpha = s.b * (t > 0.5 ? (1 - t) / 0.5 : 1);
          ctx.save(); ctx.translate(x, y); if (s.rot) ctx.rotate(s.rot);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
  }

  /** The screen-edge pulse, drawn over the world (a baked picture, stretched). */
  drawPulse(ctx, vw, vh) {
    if (this.pulseT <= 0) return;
    const img = this._vigImg(this.pulseCol);
    if (!img) return;
    const t = 1 - this.pulseT / this.pulseMax;
    // Swells quickly, then ebbs away.
    ctx.globalAlpha = this.pulseK * (t < 0.2 ? t / 0.2 : (1 - t) / 0.8) * 0.8;
    // Copied from one stretched to the screen's own pixels once per colour (ambience.js drawScreenPic).
    const at = this._vigAt || (this._vigAt = {}), k = this.pulseCol === 'hurt' ? 'hurt' : 'gold';
    if (!drawScreenPic(ctx, at[k] || (at[k] = {}), k, vw, vh, (g, W, H) => g.drawImage(img, 0, 0, W, H))) ctx.drawImage(img, 0, 0, vw, vh);
    ctx.globalAlpha = 1;
  }

  _canvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    return c;
  }
  _vigImg(kind) {
    if (this._vig[kind] !== undefined) return this._vig[kind];
    const c = this._canvas(128, 96);
    if (c) {
      const g = c.getContext('2d'), gr = g.createRadialGradient(64, 48, 30, 64, 48, 84);
      const rgb = kind === 'hurt' ? '200,30,40' : '255,200,70';
      gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.7, `rgba(${rgb},0.25)`); gr.addColorStop(1, `rgba(${rgb},0.75)`);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 96);
    }
    return (this._vig[kind] = c);
  }
}

// The soft glowing column an Epic+ drop stands in: baked once per colour (a
// bright core fading out to the sides and up to the top), then stretched.
const _columns = {};
export function columnImage(col) {
  if (_columns[col] !== undefined) return _columns[col];
  let c = null;
  if (typeof document !== 'undefined') {
    c = document.createElement('canvas'); c.width = 32; c.height = 64;
    const g = c.getContext('2d');
    const side = g.createLinearGradient(0, 0, 32, 0);
    side.addColorStop(0, col + '00'); side.addColorStop(0.35, col + '66'); side.addColorStop(0.5, '#ffffffcc');
    side.addColorStop(0.65, col + '66'); side.addColorStop(1, col + '00');
    g.fillStyle = side; g.fillRect(0, 0, 32, 64);
    g.globalCompositeOperation = 'destination-in';
    const up = g.createLinearGradient(0, 0, 0, 64);
    up.addColorStop(0, 'rgba(0,0,0,0)'); up.addColorStop(0.55, 'rgba(0,0,0,0.8)'); up.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = up; g.fillRect(0, 0, 32, 64);
  }
  return (_columns[col] = c);
}

/** A springy pop-in scale for stickers and numbers, `age` ms after they
 *  appear: from small, past full size (about 1.3), back a touch under, then 1. */
export function juicePop(age, over = 0.32) {
  if (age < 0) return 0;
  if (age < 80) { const u = age / 80; return 0.35 + (0.65 + over) * (1 - (1 - u) * (1 - u)); }
  if (age < 170) { const u = (age - 80) / 90; return 1 + over - (over + 0.08) * u; }
  if (age < 260) return 0.92 + 0.08 * ((age - 170) / 90);
  return 1;
}

// A pack fight throws up a couple of hundred crit stars at once, and each was
// a path filled and stroked twice (round joins) every frame. At full strength
// a star is now stamped from a picture of itself: drawn once per colour, size
// (to a quarter unit) and drawing scale (to the next whole pixel a unit), and
// kept. A star's outline is the same width whatever its size, so a picture
// can't be stretched from one size to another; there are a few dozen sizes.
const STAR_PICS_MAX = 240;
const _starPics = new Map();
/** The picture of a star of radius `r` (rounded to a quarter) in `col`, for
 *  drawing at `scale` screen pixels a unit: { cv, half } (half its width in
 *  units), or null without a canvas. */
export function starPic(r, col, scale, make = null) {
  const q = Math.max(0.25, Math.round(r * 4) / 4), res = Math.min(8, Math.max(1, Math.ceil(scale)));
  const key = `${col}|${q}|${res}`;
  let e = _starPics.get(key);
  if (e !== undefined) return e;
  e = null;
  const cv = make ? make() : (typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null);
  const g = cv && cv.getContext && cv.getContext('2d');
  if (g) {
    // The navy line reaches half its width (1.7) past the points; a little more for its soft edge.
    const W = Math.ceil((q + 2.2) * 2 * res);
    cv.width = W; cv.height = W;
    g.setTransform(res, 0, 0, res, W / 2, W / 2);
    drawStar(g, q, col);
    e = { cv, half: W / 2 / res };
  }
  if (_starPics.size >= STAR_PICS_MAX) _starPics.delete(_starPics.keys().next().value);
  _starPics.set(key, e);
  return e;
}
// Stamp a star (see starPic) where drawStar would draw it; false if there's no picture.
function stampStar(ctx, r, col) {
  if (r <= 0.3) return true;
  const m = ctx.getTransform ? ctx.getTransform() : null;
  if (!m) return false;
  const p = starPic(r, col, Math.hypot(m.a, m.b));
  if (!p) return false;
  ctx.drawImage(p.cv, -p.half, -p.half, p.half * 2, p.half * 2);
  return true;
}

/** A chunky five-pointed star with a navy outline. */
function drawStar(ctx, r, col) {
  if (r <= 0.3) return;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r;
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = col; ctx.fill();
}

// ---------------- Hooks the game calls ----------------
// Small functions so game.js only needs a one-line call at each spot.

/** Fewer pieces on low graphics, and while frames run slow (governor.js). */
export const lowOf = (game) => !!(game.lowFx || game.fxTrim);

/** The element of the player's blow, from whatever combat passes: an element
 *  the game names for the hit (game._hitElement, for elemental weapons and the
 *  element rework), the spell being cast, or a spell's spark colour; else null. */
export function attackElement(game, color, kind) {
  if (game._hitElement) return game._hitElement;
  if (kind !== 'magic') return null;
  return game._castElement || elementForTint(color) || null;
}

/** Where and when a blow by the player lands on `npc`: its impact point, the
 *  attacker's position, the shot's flight time, and whether it is a melee
 *  blow (which waits for the hero's swing, see CombatFx.armFresh). */
export function blowAt(game, npc, kind) {
  const c = npc.renderCenter(), p = game.player.renderCenter();
  const dist = Math.hypot(c.x - p.x, c.y - p.y);
  return { x: c.x, y: c.y - 8, from: p, delay: flightMs(kind, dist), melee: kind === 'blade' || kind === 'blunt' || kind === 'whip' || (kind === 'pierce' && game.combatMode() === 'melee') };
}

/** The impact for a blow the player (or their side) landed on `npc`.
 *  `color`: the sparks' colour, which tells a spell's element and a crit. */
export function hitImpact(game, npc, color, jobClass = game.jobClass) {
  const fx = game.cfx;
  if (!fx || !npc?.renderCenter) return;
  fx.low = lowOf(game);
  const kind = impactKind(game.weaponType?.(), game.combatMode?.());
  const b = blowAt(game, npc, kind);
  // A spear's thrust has no flight time; its puncture lands with the swing.
  if (b.melee) b.delay = 0;
  fx.impact(kind, b.x, b.y, { from: b.from, delay: b.delay, melee: b.melee, crit: color === GOLD, element: attackElement(game, color, kind),
    gun: kind === 'bullet' ? game.weaponType?.() : null, jobClass });
}

/** A class-coloured rim on a combat ability's activation. Guard, buff and
 *  heal particles keep their own colours. */
export function abilityAccent(game) {
  const fx = game.cfx, accent = classAccent(game.jobClass);
  if (!fx || !accent) return;
  const p = game.player.renderCenter();
  fx.low = lowOf(game);
  fx._begin();
  const calm = game.reduceMotion;
  fx.ring(p.x, p.y + 10, calm ? 17 : 6, calm ? 17 : 23, 360, accent.colour, 2.4, 0.46);
  fx._end();
}

// A hit this share of the foe's life (or of yours) counts as a big one.
export const BIG_HIT_SHARE = 0.25, HURT_HARD_SHARE = 0.15;

/** Crit stars and the screen-edge pulse for a hitsplat (from addHitsplat). */
export function hitsplatFx(game, entity, dmg, opts = {}) {
  const fx = game.cfx;
  if (!fx || !(dmg > 0) || !entity?.renderCenter) return;
  fx.low = lowOf(game);
  if (entity === game.player) {
    const share = dmg / Math.max(1, game.maxHp());
    if (share >= HURT_HARD_SHARE && !game.reduceMotion) fx.pulse('hurt', share / 0.4);
    return;
  }
  if (opts.text) return;
  const crit = opts.crit || opts.critX > 0;
  const big = !opts.aoe && dmg >= (entity.maxHp || Infinity) * BIG_HIT_SHARE;
  if (crit && !(opts.aoe && fx.low)) {
    const kind = impactKind(game.weaponType?.(), game.combatMode?.());
    const b = blowAt(game, entity, kind);
    fx.critStars(b.x, b.y - 6, { big: big || game._pendingCrit >= 4, delay: b.melee ? 0 : b.delay, melee: b.melee });
  }
  if ((big || (opts.crit && game._pendingCrit >= 4)) && !game.reduceMotion) fx.pulse('big', big ? 0.9 : 0.6);
}

/** A monster's death: the sticker poof as its fall ends (from _deathBurst). */
export function deathFx(game, npc) {
  const fx = game.cfx;
  if (!fx || !npc?.renderCenter) return;
  fx.low = lowOf(game);
  const c = npc.renderCenter(), sc = npc.def?.scale || 1;
  fx.deathPoof(c.x, c.y - 6 * sc, Math.min(2, 0.85 + sc * 0.25 + (npc.def?.boss ? 0.4 : 0)), 260);
}

/** First sight of a fresh drop (from the renderer): coins sparkle as they land. */
export function dropFx(game, gi, x, y, wait = 0) {
  const fx = game.cfx;
  if (!fx || gi.id !== 'coins') return;
  fx.low = lowOf(game);
  fx.coinSparkle(x, y, Math.max(0, wait) + DROP_ARC_MS);
}

/** A drop flying into your pack (the game's 'lootfly' effect, from the
 *  renderer the first frame it is drawn): rare and better ones sparkle where
 *  they lay. Commons pop up quietly as before. */
export function pickupFx(game, e) {
  const fx = game.cfx, rar = RARITY[e?.rarity];
  if (!fx || !rar || rar.rank < RARITY.rare.rank) return false;
  fx.low = lowOf(game);
  fx.lootSparkle(e.x, e.y, rar.color, rar.rank, !!game.reduceMotion);
  return true;
}

/** A monster has just come back (from the renderer, the first frame it is seen
 *  respawning): a puff of dust at its feet. */
export function spawnFx(game, npc) {
  const fx = game.cfx;
  if (!fx || !npc?.renderCenter) return;
  fx.low = lowOf(game);
  const c = npc.renderCenter(), sc = npc.def?.scale || 1;
  fx.spawnPuff(c.x, c.y + 11 * sc, Math.min(2, 0.8 + sc * 0.2));
}
