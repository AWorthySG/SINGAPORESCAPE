import { TILE } from '../config.js';
import { composeWashes } from './ambience.js';
import { timeGrade, moonDark } from './atmosphere.js';

// The light pass: after dark the scene is covered by a darkness layer with
// soft pools of light cut out of it around lamps, fires, furnaces, glowing
// trees and crystals, spells in flight, bosses and the hero, and each pool
// tinted its own colour. The same layer carries the whole colour grade (the
// region's mood, dawn and dusk, the afternoon haze, the weather's grey), so it
// is still ONE full-screen composite a frame. It is drawn at a quarter of the
// screen's size (light is all soft gradients, so stretched up it looks the
// same) from little gradient pictures baked once. Low graphics and headless
// runs keep the renderer's old flat fill.

// What gives off light, by object id: radius (world px), colour, how high above
// the tile centre the light sits, how much it flickers (fires) or pulses
// (magic), and `win` for buildings whose glow is their lit windows.
export const LIGHTS = {
  lamp: { r: 96, rgb: [255, 214, 140], y: -24, flicker: 0.05 },
  fire: { r: 118, rgb: [255, 150, 70], y: -6, flicker: 0.2 },
  furnace: { r: 104, rgb: [255, 128, 60], y: -10, flicker: 0.12 },
  range: { r: 86, rgb: [255, 166, 90], y: -8, flicker: 0.12 },
  // Lit windows and stall lanterns.
  stall_food: { r: 70, rgb: [255, 200, 120], y: -14, win: true },
  stall_market: { r: 62, rgb: [255, 206, 140], y: -14, win: true },
  stall_gem: { r: 62, rgb: [200, 180, 255], y: -14, win: true },
  bank_booth: { r: 66, rgb: [255, 222, 160], y: -16, win: true },
  mrt_station: { r: 96, rgb: [214, 234, 255], y: -18, win: true },
  temple_vault: { r: 58, rgb: [255, 206, 120], y: -14, win: true },
  observatory_chest: { r: 58, rgb: [190, 210, 255], y: -10, win: true },
  // Shop signs and the homes' windows: a small warm lantern glow.
  sign: { r: 50, rgb: [255, 206, 150], y: -18, win: true },
  home_plot: { r: 62, rgb: [255, 214, 150], y: -14, win: true },
  smugglers_hold: { r: 56, rgb: [255, 190, 120], y: -12, flicker: 0.1 },
  rift_treasury: { r: 60, rgb: [200, 140, 255], y: -12, pulse: 0.15 },
  // Glowing things: magic trees, star-touched rocks and crystals, shrines, portals.
  magic_tree: { r: 74, rgb: [150, 196, 255], y: -26, pulse: 0.12 },
  starfall_banyan: { r: 84, rgb: [255, 226, 150], y: -28, pulse: 0.12 },
  moonlit_kapok: { r: 84, rgb: [190, 200, 255], y: -28, pulse: 0.12 },
  keramat_tree: { r: 70, rgb: [180, 255, 200], y: -26, pulse: 0.12 },
  skyglass_crystal: { r: 70, rgb: [150, 230, 255], y: -8, pulse: 0.18 },
  fallen_star: { r: 66, rgb: [255, 230, 140], y: -6, pulse: 0.18 },
  eternal_lode: { r: 62, rgb: [200, 140, 255], y: -6, pulse: 0.18 },
  jade_seam: { r: 46, rgb: [120, 240, 170], y: -6, pulse: 0.15 },
  orichalcum_rock: { r: 46, rgb: [255, 190, 110], y: -6, pulse: 0.15 },
  shrine: { r: 92, rgb: [255, 236, 170], y: -20, pulse: 0.1 },
  offering_shrine: { r: 82, rgb: [255, 220, 150], y: -18, pulse: 0.1 },
  mascot_statue: { r: 60, rgb: [255, 230, 180], y: -18 },
  wave_gate: { r: 104, rgb: [196, 120, 255], y: -16, pulse: 0.2 },
  wave_exit: { r: 92, rgb: [140, 220, 255], y: -16, pulse: 0.2 },
  phoenix_roost: { r: 70, rgb: [255, 140, 70], y: -10, flicker: 0.15 },
};
// Districts whose lamps are neon by night, and the colours they take in turn.
export const NEON_ZONES = new Set(['Marina Bay', 'Chinatown']);
export const NEON = { lamp: [[255, 120, 200], [110, 220, 255]], sign: [[255, 140, 210], [120, 230, 255]] };
const PLAYER_LIGHT = { r: 78, rgb: [255, 210, 160], y: -10 };
const SPELL_LIGHT_R = 46, BLAST_LIGHT_R = 110, BOSS_LIGHT_R = 130;
// Arrows, bullets, coins and shurikens are dull metal; anything else in
// flight is a spell and glows.
const DULL_SHOTS = new Set(['arrow', 'bullet', 'coin', 'shuriken']);
export const MAX_LIGHTS = 64;
export const LAYER_SCALE = 0.25;    // the layer is drawn at a quarter size

/** The light an object gives off, or null (a felled magic tree gives none). */
export function lightFor(o) {
  const L = LIGHTS[o.objId];
  if (!L) return null;
  if (o.depleted && o.def && (o.def.type === 'tree' || o.def.type === 'rock')) return null;
  return L;
}

/** How dark the night layer is (0 by day .. 0.58 at midnight), from the
 *  renderer's darkness level (0 noon .. 1 midnight). Eased in so dusk stays
 *  golden rather than grey. */
export function nightDarkness(night) {
  const k = Math.max(0, Math.min(1, (night - 0.4) / 0.55));
  return k * k * (3 - 2 * k) * 0.58;
}

/**
 * The sky's own tints for the time of day (`phase`: 0 midnight, 0.25 dawn,
 * 0.5 noon, 0.75 dusk): a rosy gold at dawn, a deep amber at dusk, a warm
 * haze through the late afternoon. Writes [dawn, dusk, haze] washes into `out`.
 */
export function skyWashes(phase, out = [[255, 176, 150, 0], [255, 128, 64, 0], [236, 214, 178, 0]]) {
  const bump = (c, w) => { const d = (phase - c) / w; return Math.exp(-d * d); };
  out[0][3] = 0.15 * bump(0.255, 0.045);
  out[1][3] = 0.22 * bump(0.745, 0.05);
  out[2][3] = 0.1 * bump(0.63, 0.06);
  return out;
}

const hexRgb = (h, fallback) => {
  if (typeof h !== 'string' || h[0] !== '#' || (h.length !== 7 && h.length !== 4)) return fallback;
  const s = h.length === 4 ? h.slice(1).split('').map((c) => c + c).join('') : h.slice(1);
  const n = parseInt(s, 16);
  return Number.isNaN(n) ? fallback : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export class LightPass {
  constructor() {
    this.ok = typeof document !== 'undefined' && !!document.createElement;
    this.layer = null; this.g = null;
    this._cut = null; this._glow = new Map();   // baked gradient pictures
    this._index = []; this._indexN = -1; this._indexAt = 0;   // the world's light-giving objects
    this._tint = new Map();                      // ...and any whose colour the district changes
    this._lights = [];                           // this frame's lights, reused
    this._sky = skyWashes(0.5);
    this._dark = moonDark(0, [0, 0, 0, 0]);   // indigo at dusk, moonlit blue at midnight (atmosphere.js)
    this._tg = timeGrade(0.5);
    this._washes = [];
    this._grade = [0, 0, 0, 0];
    this.count = 0;                              // lights drawn last frame (for tests and tuning)
  }

  /** The world's light-giving objects, rescanned when objects come or go
   *  (a fire lit or burnt out) and every couple of seconds anyway. */
  _scan(world, now) {
    const objs = world.objects;
    if (objs.length === this._indexN && now - this._indexAt < 2000) return this._index;
    this._index.length = 0; this._tint.clear();
    for (const o of objs) {
      if (!LIGHTS[o.objId]) continue;
      this._index.push(o);
      // Street lamps in the neon districts glow pink and cyan in turn.
      const neon = NEON[o.objId] && world.zoneAt && NEON_ZONES.has(world.zoneAt(o.x, o.y)?.name);
      if (neon) this._tint.set(o, NEON[o.objId][(o.x + o.y) & 1]);
    }
    this._indexN = objs.length; this._indexAt = now;
    return this._index;
  }

  /** Collect this frame's lights in view (screen px). Pure apart from the scan. */
  gather(game, ox, oy, vw, vh, t) {
    const out = this._lights; out.length = 0;
    const add = (x, y, r, rgb, k) => { if (out.length < MAX_LIGHTS) out.push({ x, y, r, rgb, k }); };
    const inView = (x, y, r) => x > -r && y > -r && x < vw + r && y < vh + r;
    for (const o of this._scan(game.world, t)) {
      const L = lightFor(o);
      if (!L) continue;
      const x = o.x * TILE + TILE / 2 - ox, y = o.y * TILE + TILE / 2 + L.y - oy;
      if (!inView(x, y, L.r)) continue;
      let k = 1;
      if (L.flicker) k -= L.flicker * (0.5 + 0.5 * Math.sin(t * 0.017 + o.x * 2.3) * Math.sin(t * 0.0071 + o.y));
      if (L.pulse) k -= L.pulse * (0.5 + 0.5 * Math.sin(t * 0.0023 + o.x + o.y * 1.7));
      add(x, y, L.r, this._tint.get(o) || L.rgb, k);
    }
    const p = game.player;
    if (p && p.alive) {
      const c = p.renderCenter();
      add(c.x - ox, c.y + PLAYER_LIGHT.y - oy, PLAYER_LIGHT.r, PLAYER_LIGHT.rgb, 0.85);
    }
    // Spells in flight and blasts light up the ground under them.
    for (const e of game.effects || []) {
      if (e._showAt > t) continue;
      if (e.type === 'projectile' && !DULL_SHOTS.has(e.kind)) {
        const f = 1 - e.life / e.maxLife;
        const x = e.x + (e.ex - e.x) * f - ox, y = e.y + (e.ey - e.y) * f - oy;
        if (inView(x, y, SPELL_LIGHT_R)) add(x, y, SPELL_LIGHT_R, hexRgb(e.color, [190, 200, 255]), 1);
      } else if (e.type === 'blast') {
        const x = e.x - ox, y = e.y - oy;
        if (inView(x, y, BLAST_LIGHT_R)) add(x, y, BLAST_LIGHT_R, [255, 160, 90], e.life / e.maxLife);
      }
    }
    // Bosses carry their own glow, in their colour.
    const npcs = game.nearbyNpcs ? game.nearbyNpcs() : [];
    for (const n of npcs) {
      if (!n.alive || !n.def.boss) continue;
      const c = n.renderCenter(), r = BOSS_LIGHT_R * Math.min(1.6, n.def.scale || 1);
      const x = c.x - ox, y = c.y - 10 - oy;
      if (inView(x, y, r)) add(x, y, r, hexRgb(n.def.color, [230, 90, 120]), 0.85 + Math.sin(t * 0.004) * 0.1);
    }
    return out;
  }

  // A white radial gradient (for cutting light out of the darkness) and one
  // per light colour (for tinting the pool), each a small canvas baked once.
  _sprite(rgb) {
    const key = rgb ? rgb.join(',') : 'cut';
    let cv = key === 'cut' ? this._cut : this._glow.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const c = rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '255,255,255';
    grd.addColorStop(0, `rgba(${c},1)`);
    grd.addColorStop(0.35, `rgba(${c},0.75)`);
    grd.addColorStop(0.7, `rgba(${c},0.25)`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    if (key === 'cut') this._cut = cv; else this._glow.set(key, cv);
    return cv;
  }

  /**
   * Paint the grade and the night onto `ctx` (screen space, vw x vh). `mood`
   * is the renderer's eased region mood, `night` its darkness level (0..1),
   * `wx` the weather's state (weather.js). Returns false when it can't (no DOM),
   * so the caller keeps its flat fill.
   */
  draw(ctx, game, mood, night, wx, ox, oy, vw, vh, t) {
    if (!this.ok) return false;
    const phase = game.dayPhase ? game.dayPhase() : 0.5;
    const sky = skyWashes(phase, this._sky);
    moonDark(timeGrade(phase, 0, this._tg).moon, this._dark);
    // Storms darken the day enough for the lamps to come on.
    const dark = Math.max(nightDarkness(night), wx ? wx.gloom * 0.6 : 0);
    this._dark[3] = nightDarkness(night);
    const w = this._washes; w.length = 0;
    w.push(mood, sky[0], sky[1], sky[2]);
    if (wx) w.push(...wx.washes);
    w.push(this._dark);
    if (wx && wx.flash > 0) w.push(wx.flashWash);
    const gr = composeWashes(w, this._grade);
    const fill = `rgba(${gr[0] | 0},${gr[1] | 0},${gr[2] | 0},${gr[3].toFixed(3)})`;
    this.count = 0;
    if (dark < 0.03) {
      // Daylight: nothing to cut out, so the grade is one plain fill.
      if (gr[3] > 0.004) { ctx.fillStyle = fill; ctx.fillRect(0, 0, vw, vh); }
      return true;
    }
    const lw = Math.max(8, Math.ceil(vw * LAYER_SCALE)), lh = Math.max(8, Math.ceil(vh * LAYER_SCALE));
    if (!this.layer) {
      this.layer = document.createElement('canvas');
      this.g = this.layer.getContext('2d');
      if (!this.g) { this.ok = false; return false; }
    }
    if (this.layer.width !== lw || this.layer.height !== lh) { this.layer.width = lw; this.layer.height = lh; }
    const g = this.g, sx = lw / vw, sy = lh / vh;
    g.globalCompositeOperation = 'copy';
    g.globalAlpha = 1;
    g.fillStyle = fill; g.fillRect(0, 0, lw, lh);
    const lights = this.gather(game, ox, oy, vw, vh, t);
    // How strongly lights win against the dark: none by day, nearly fully at night.
    const strength = Math.min(1, dark * 2.4);
    g.globalCompositeOperation = 'destination-out';
    const cut = this._sprite(null);
    for (const L of lights) {
      const r = L.r * L.k;
      g.globalAlpha = Math.min(1, 0.92 * strength * L.k);
      g.drawImage(cut, (L.x - r) * sx, (L.y - r) * sy, 2 * r * sx, 2 * r * sy);
    }
    // Then each pool is tinted its light's colour.
    g.globalCompositeOperation = 'source-over';
    for (const L of lights) {
      const r = L.r * L.k * 0.8;
      g.globalAlpha = 0.42 * strength * L.k;
      g.drawImage(this._sprite(L.rgb), (L.x - r) * sx, (L.y - r) * sy, 2 * r * sx, 2 * r * sy);
    }
    g.globalAlpha = 1;
    this.count = lights.length;
    ctx.drawImage(this.layer, 0, 0, vw, vh);   // the one full-screen composite
    return true;
  }
}
