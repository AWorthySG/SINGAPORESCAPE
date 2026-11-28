import { TILE } from '../config.js';
import { composeWashes, buildVignette } from './ambience.js';
import { timeGrade, moonDark, regionLightFor } from './atmosphere.js';
import { projectFlat } from './projection.js';
import { motionOK } from './juice.js';
import { smooth } from './motionkit.js';
import { censerBolt } from './censerSwing.js';
import { fxFade, fxProgress, isSpellShot, spellPose } from './fxdepth.js';

// The light pass: after dark the scene is covered by a darkness layer with
// soft pools of light cut out of it around lamps, fires, furnaces, glowing
// trees and crystals, spells in flight, bosses and the hero, and each pool
// tinted its own colour. The same layer carries the whole colour grade (the
// region's mood, dawn and dusk, the afternoon haze, the weather's grey), so it
// is still ONE full-screen composite a frame. It is drawn at a quarter of the
// screen's size (light is all soft gradients, so stretched up it looks the
// same) from little gradient pictures baked once. Low graphics and headless
// runs keep the renderer's old flat fill.
//
// Once the lamps are on, the layer is a light map laid on with 'multiply'
// rather than a translucent wash: a wash lifts the navy ink toward the night's
// colour and pulls the white sticker rims down to the same grey, so the whole
// town went flat. Multiplying keeps every colour's contrast (rims stay the
// brightest thing about, ink stays ink) and lets the lamps paint warm light
// into the map instead of only thinning the dark.

const SHOP_LIGHT = { r: 56, rgb: [255, 214, 140], y: 12, win: true };

// What gives off light, by object id: radius (world px), colour, how high above
// the tile centre the light sits, how much it flickers (fires) or pulses
// (magic), and `win` for buildings whose glow is their lit windows.
export const LIGHTS = {
  lamp: { r: 96, rgb: [255, 214, 140], y: -24, flicker: 0.05 },
  heritage_lamp: { r: 82, rgb: [255, 214, 140], y: -30 },
  lantern_post: { r: 78, rgb: [255, 166, 90], y: -20 },
  lantern_tree: { r: 80, rgb: [255, 200, 120], y: -23 },
  five_foot_lantern: { r: 54, rgb: [255, 200, 120], y: -27 },
  bollard_light: { r: 44, rgb: [214, 234, 255], y: -4 },
  fire: { r: 118, rgb: [255, 150, 70], y: -6, flicker: 0.2 },
  furnace: { r: 104, rgb: [255, 128, 60], y: -10, flicker: 0.12 },
  range: { r: 86, rgb: [255, 166, 90], y: -8, flicker: 0.12 },
  // Lit windows and stall lanterns.
  stall_food: { r: 70, rgb: [255, 200, 120], y: -14, win: true },
  stall_market: { r: 62, rgb: [255, 206, 140], y: -14, win: true },
  stall_gem: { r: 62, rgb: [200, 180, 255], y: -14, win: true },
  bank_booth: { r: 66, rgb: [255, 222, 160], y: -16, win: true },
  mrt_station: { r: 96, rgb: [214, 234, 255], y: -18, win: true },
  shophouse_row_mint: SHOP_LIGHT, shophouse_row_peach: SHOP_LIGHT,
  shophouse_row_butter: SHOP_LIGHT, shophouse_row_lilac: SHOP_LIGHT,
  hawker_centre: { r: 72, rgb: [255, 200, 120], y: 8, win: true },
  wet_market: { r: 68, rgb: [255, 222, 160], y: 8, win: true },
  chinese_temple: { r: 62, rgb: [255, 206, 140], y: 12, win: true },
  hdb_block: { r: 64, rgb: [255, 222, 160], y: 10, win: true },
  temple_vault: { r: 58, rgb: [255, 206, 120], y: -14, win: true },
  observatory_chest: { r: 58, rgb: [190, 210, 255], y: -10, win: true },
  // Shop signs and the homes' windows: a small warm lantern glow.
  sign: { r: 50, rgb: [255, 206, 150], y: -18, win: true },
  home_plot: { r: 62, rgb: [255, 214, 150], y: -14, win: true },
  smugglers_hold: { r: 56, rgb: [255, 190, 120], y: -12, flicker: 0.1 },
  rift_treasury: { r: 60, rgb: [200, 140, 255], y: -12, pulse: 0.15 },
  ghost_lantern: { r: 96, rgb: [135, 231, 219], y: -24, pulse: 0.09, bloom: true },
  rift_obelisk: { r: 156, rgb: [193, 124, 255], y: -43, pulse: 0.08, bloom: true },
  celestial_pavilion: { r: 130, rgb: [173, 221, 255], y: -29, bloom: true },
  supertree_tall: { r: 124, rgb: [211, 146, 254], y: -51, bloom: true },
  supertree_short: { r: 92, rgb: [142, 234, 219], y: -33, bloom: true },
  observation_wheel: { r: 148, rgb: [153, 204, 255], y: -52, bloom: true },
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
  gate_shrine: { r: 146, rgb: [255, 213, 146], y: -23, pulse: 0.07, bloom: true },
  phoenix_roost: { r: 70, rgb: [255, 140, 70], y: -10, flicker: 0.15 },
};
// The light is picked at the fixture's location, so a street stays lit as you cross a border.
export const DISTRICT_LAMPS = {
  Chinatown: { lamp: [[255, 159, 103], [255, 125, 151]], sign: [[255, 182, 122], [255, 144, 169]] },
  'Marina Bay': { lamp: [[163, 166, 255], [110, 220, 255]], sign: [[178, 169, 255], [120, 230, 255]] },
  'The Endless Gate': { lamp: [[192, 145, 255], [143, 194, 255]] },
};
const DISTRICT_FIXTURES = new Set(['lamp', 'sign']);
const TRANSIT_ROAD = 'Transit Road, Nee Soon Camp';
const TRANSIT_LIGHTS = {
  lamp: { r: 111, rgb: [255, 166, 90], y: -24, flicker: 0.035 },
  hawker_stall_noodle: { r: 76, rgb: [255, 200, 120], y: -18, win: true },
};
const PLAYER_LIGHT = { r: 78, rgb: [255, 210, 160], y: -10 };
const SPELL_LIGHT_R = 46, BLAST_LIGHT_R = 110, BOSS_LIGHT_R = 130;
// Arrows, bullets, coins and shurikens are dull metal; anything else in
// flight is a spell and glows.
export const MAX_LIGHTS = 64;
export const LAYER_SCALE = 0.25;    // the layer is drawn at a quarter size
// How much of each light's colour the light map takes: lifted toward white so
// a pool reads as warm light on the ground rather than a coloured filter.
const LIT_LIFT = 0.3;
// How far a pool reaches into the night compared with its radius, and how
// strongly its middle is lit.
const POOL_REACH = 1.15, POOL_K = 0.95;
const MOON_SPILL = [132, 162, 219];
// How much deeper than the old wash the night's multiply goes (the darkness
// level is shared with the lights' timing, nightDarkness).
export const NIGHT_DEPTH = 1.15;

const DEFAULT_DUSK = regionLightFor('').dusk;
const DAWN = [255, 176, 150], AFTERNOON = [236, 214, 178];

/** How far the grade has turned from a wash (0, daylight) to the multiply
 *  light map (1), for the darkness level the lamps go by. Eased over the first
 *  stretch of dusk; in between both are drawn, so nothing jumps. */
export function nightMode(dark) {
  const k = Math.max(0, Math.min(1, (dark - 0.03) / 0.17));
  return k * k * (3 - 2 * k);
}

/**
 * The light map's colour (0..255 a channel: what the scene is multiplied by)
 * where no lamp reaches: `gr` the day grade's washes folded into one [r, g, b,
 * a], laid on as `u` of a multiply; `dark` the night's colour and depth
 * [r, g, b, a] (a the darkness level). White comes out of a wash as the wash
 * leaves it, so each is turned into the multiply that treats white the same.
 */
export function nightMultiply(gr, u, dark, out = [255, 255, 255]) {
  const a = gr[3] * u, A = Math.min(0.95, dark[3] * NIGHT_DEPTH) * u;
  for (let i = 0; i < 3; i++) out[i] = 255 * (1 - a + a * gr[i] / 255) * (1 - A + A * dark[i] / 255);
  return out;
}

/** The part of the grade and darkness still drawn as a wash during twilight. */
export function twilightWash(gr, dark, u, out = [0, 0, 0, 0]) {
  const nr = (1 - u) * dark[3], dr = gr[3] * (1 - u) * (1 - nr);
  const a = nr + dr;
  for (let i = 0; i < 3; i++) out[i] = a > 0 ? (dark[i] * nr + gr[i] * dr) / a : 0;
  out[3] = a;
  return out;
}

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

/** Regional shade stays visible by day. Outside at midnight it leaves room
 * for moonlight, and enclosed halls keep the same light through the day. */
export function regionalDark(night, moon, light, out = [0, 0, 0, 0]) {
  moonDark(moon * (1 - light.cover), out);
  const cast = light.night[3] * (0.48 + 0.52 * Math.max(moon, light.cover));
  for (let i = 0; i < 3; i++) out[i] += (light.night[i] - out[i]) * cast;
  const outdoor = nightDarkness(night) * (1 - light.cover);
  out[3] = outdoor + light.shade * (1 - outdoor / 0.63);
  return out;
}

/**
 * The sky's own tints for the time of day (`phase`: 0 midnight, 0.25 dawn,
 * 0.5 noon, 0.75 dusk): a rosy gold at dawn, a deep amber at dusk, a warm
 * haze through the late afternoon. Writes [dawn, dusk, haze] washes into `out`.
 */
export function skyWashes(phase, out = [[255, 176, 150, 0], [255, 128, 64, 0], [236, 214, 178, 0]], dusk = DEFAULT_DUSK, gloom = 0, cover = 0) {
  const bump = (c, w) => { const d = (phase - c) / w; return Math.exp(-d * d); };
  const open = 1 - cover;
  out[0][3] = 0.15 * bump(0.255, 0.045) * open;
  for (let i = 0; i < 3; i++) {
    out[0][i] = DAWN[i] + (dusk[i] - DEFAULT_DUSK[i]) * 0.38;
    out[1][i] = dusk[i];
    out[2][i] = AFTERNOON[i] + (dusk[i] - DEFAULT_DUSK[i]) * 0.3;
  }
  const afterglow = 0.91 * bump(0.739, 0.058) + 0.2 * bump(0.796, 0.042);
  out[1][3] = dusk[3] * afterglow * (1 - 0.65 * gloom) * open;
  out[2][3] = 0.1 * bump(0.63, 0.06) * open;
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
    this._glow = new Map();                      // baked gradient pictures
    this._index = []; this._indexSource = null; this._indexN = -1; this._indexAt = 0;
    this._tint = new Map();                      // ...and any whose colour the district changes
    this._fixtures = new Map();                  // regional lights with their own reach and falloff
    this._lights = [];                           // this frame's lights, reused
    this._shot = {};
    this._sky = skyWashes(0.5);
    this._dark = moonDark(0, [0, 0, 0, 0]);   // indigo at dusk, moonlit blue at midnight (atmosphere.js)
    this._tg = timeGrade(0.5);
    this._washes = [];
    this._grade = [0, 0, 0, 0];
    this._twilight = [0, 0, 0, 0];
    this._mul = [255, 255, 255];
    this._lit = new Map();                       // each light colour lifted for the light map
    this.count = 0;                              // lights drawn last frame (for tests and tuning)
    this.vignetted = false;                      // the edge vignette went into the light map this frame
    this._vig = null; this._vigAt = '';
  }

  /** The world's light-giving objects, rescanned when objects come or go
   *  (a fire lit or burnt out) and every couple of seconds anyway. */
  _scan(world, now) {
    const objs = world.objects;
    if (objs === this._indexSource && objs.length === this._indexN && now - this._indexAt < 2000) return this._index;
    this._index.length = 0; this._tint.clear(); this._fixtures.clear();
    for (const o of objs) {
      const coloured = DISTRICT_FIXTURES.has(o.objId), amber = TRANSIT_LIGHTS[o.objId];
      if (!LIGHTS[o.objId] && !amber) continue;
      if (coloured || amber) {
        const zone = world.zoneAt?.(o.x, o.y)?.name;
        const colours = DISTRICT_LAMPS[zone]?.[o.objId];
        if (colours) this._tint.set(o, colours[(o.x + o.y) & 1]);
        if (amber && zone === TRANSIT_ROAD) this._fixtures.set(o, amber);
      }
      if (LIGHTS[o.objId] || this._fixtures.has(o)) this._index.push(o);
    }
    this._indexSource = objs; this._indexN = objs.length; this._indexAt = now;
    return this._index;
  }

  /** Collect this frame's lights in view (screen px).
   *  With the depth view's projection `pj`, ox..vh are its flat rectangle and
   *  each light is moved to where it lands on the tilted screen. */
  gather(game, ox, oy, vw, vh, t, pj = null) {
    const out = this._lights; out.length = 0;
    const add = (x, y, r, rgb, k, sq = 1, groundY = y, bloom = false) => {
      if (out.length < MAX_LIGHTS) out.push({ x, y, r, rgb, k, sq, groundY, bloom });
    };
    const inView = (x, y, r) => x > -r && y > -r && x < vw + r && y < vh + r;
    const movingLight = motionOK(game);
    for (const o of this._scan(game.world, t)) {
      const L = this._fixtures.get(o) || lightFor(o);
      if (!L) continue;
      const width = o.def?.footprint?.[0] || 1;
      const x = (o.x + width / 2) * TILE - ox, row = o.y * TILE + TILE / 2 - oy;
      const y = row + L.y, groundY = row + Math.max(L.y + 4, L.win ? 12 : 6);
      if (!inView(x, y, L.r)) continue;
      let k = 1;
      if (L.flicker) k -= L.flicker * (movingLight ? 0.5 + 0.5 * Math.sin(t * 0.017 + o.x * 2.3) * Math.sin(t * 0.0071 + o.y) : 0.5);
      if (L.pulse) k -= L.pulse * (movingLight ? 0.5 + 0.5 * Math.sin(t * 0.0023 + o.x + o.y * 1.7) : 0.5);
      const tint = this._tint.get(o);
      add(x, y, L.r, tint || L.rgb, k, 0.69, groundY, !!(tint || L.bloom));
    }
    const p = game.player;
    if (p && p.alive) {
      const c = p.renderCenter();
      add(c.x - ox, c.y + PLAYER_LIGHT.y - oy, PLAYER_LIGHT.r, PLAYER_LIGHT.rgb, 0.85);
    }
    // Spells in flight and blasts light up the ground under them.
    for (const e of game.effects || []) {
      if (e._showAt > t) continue;
      if (e.type === 'projectile' && isSpellShot(e)) {
        const phase = fxProgress(e), censer = censerBolt(e, phase, game, t, ox, oy);
        if (censer && censer.t < 0) continue;
        const at = spellPose(censer?.e ?? e, censer?.t ?? phase, this._shot);
        const x = at.x - ox, y = at.row - oy, r = SPELL_LIGHT_R * (e.crit ? 1.18 : 1);
        if (inView(x, y, r)) add(x, y, r, hexRgb(e.color, [190, 200, 255]), 0.62 + 0.3 * fxFade((phase - 0.68) / 0.32), 0.75);
      } else if (e.type === 'blast' && e.primary !== false) {
        const x = e.x - ox, y = e.y - oy;
        const r = Math.min(BLAST_LIGHT_R, 35 + (e.r ?? 48) * 0.82);
        if (inView(x, y, r)) add(x, y, r, hexRgb(e.color, [255, 160, 90]), fxFade(fxProgress(e)), 0.74);
      }
    }
    if (!game.fxTrim && !game.lowFx) game.cfx?.lights?.((wx, wy, r, col, k) => {
      const x = wx - ox, y = wy - oy;
      if (out.length >= MAX_LIGHTS || !inView(x, y, r)) return false;
      add(x, y, r, hexRgb(col, [255, 235, 180]), movingLight ? k : k * 0.65, 0.72);
      return true;
    });
    // Bosses carry their own glow, in their colour.
    const npcs = game.nearbyNpcs ? game.nearbyNpcs() : [];
    for (const n of npcs) {
      if (!n.alive || !n.def.boss) continue;
      const c = n.renderCenter(), r = BOSS_LIGHT_R * Math.min(1.6, n.def.scale || 1);
      const x = c.x - ox, y = c.y - 10 - oy;
      if (inView(x, y, r)) add(x, y, r, hexRgb(n.castT > 0 ? n.castCol : n.def.color, [230, 90, 120]),
        n.castT > 0 ? 0.88 + 0.12 * (n.castT / 700) : 0.85 + (movingLight ? Math.sin(t * 0.004) * 0.1 : 0));
    }
    if (pj) for (const L of out) {
      const p = projectFlat(pj, L.x, L.groundY, this._pp || (this._pp = {}));
      L.x = p.x; L.y = p.y + (L.y - L.groundY) * p.s; L.groundY = p.y; L.r *= p.s;
    }
    return out;
  }

  // A soft radial gradient in a light's colour, a small canvas baked once a colour.
  _sprite(rgb) {
    const key = rgb.join(',');
    let cv = this._glow.get(key);
    if (cv) return cv;
    if (typeof document === 'undefined' || !document.createElement) return null;
    cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    if (!g) return null;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${key},1)`);
    grd.addColorStop(0.35, `rgba(${key},0.75)`);
    grd.addColorStop(0.7, `rgba(${key},0.25)`);
    grd.addColorStop(1, `rgba(${key},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    this._glow.set(key, cv);
    return cv;
  }

  // The quarter-size layer, made once and resized with the screen.
  _layer(vw, vh) {
    const lw = Math.max(8, Math.ceil(vw * LAYER_SCALE)), lh = Math.max(8, Math.ceil(vh * LAYER_SCALE));
    if (!this.layer) {
      this.layer = document.createElement('canvas');
      this.g = this.layer.getContext('2d');
      if (!this.g) { this.ok = false; return null; }
    }
    if (this.layer.width !== lw || this.layer.height !== lh) { this.layer.width = lw; this.layer.height = lh; }
    return this.g;
  }

  // The renderer's soft edge vignette (ambience.js), baked once per screen size.
  _vignette(vw, vh) {
    const at = `${vw}x${vh}`;
    if (at !== this._vigAt) { this._vigAt = at; this._vig = buildVignette(vw, vh); }
    return this._vig;
  }

  // A light's colour lifted toward white for the light map, worked out once a colour.
  _litColour(rgb) {
    const key = rgb.join(',');
    let c = this._lit.get(key);
    if (!c) { c = rgb.map((v) => Math.round(v + (255 - v) * LIT_LIFT)); this._lit.set(key, c); }
    return c;
  }

  /**
   * Paint the grade and the night onto `ctx` (screen space, vw x vh). `mood`
   * is the renderer's eased region mood, `night` its darkness level (0..1),
   * `wx` the weather's state (weather.js). Returns false when it can't (no DOM),
   * so the caller keeps its flat fill. With the depth view's projection `pj`,
   * ox..vh are its flat rectangle; the layer still covers the screen.
   */
  draw(ctx, game, mood, night, wx, ox, oy, vw, vh, t, pj = null, look = regionLightFor(game.currentZoneName)) {
    if (!this.ok) return false;
    const fvw = vw, fvh = vh;
    if (pj) { vw = pj.vw; vh = pj.vh; }
    const phase = game.dayPhase ? game.dayPhase() : 0.5;
    const sky = skyWashes(phase, this._sky, look.dusk, wx?.gloom || 0, look.cover);
    const moon = timeGrade(phase, 0, this._tg).moon;
    regionalDark(night, moon, look, this._dark);
    // Storms darken the day enough for the lamps to come on.
    const darkness = this._dark[3];
    const dark = darkness + (1 - darkness) * (wx?.gloom || 0) * 0.55;
    const w = this._washes; w.length = 0;
    w.push(mood, sky[0], sky[1], sky[2]);
    if (wx) w.push(...wx.washes);
    this.count = 0;
    this.vignetted = false;
    // Cloud shadows on a clear day (weather.js) are painted into this pass's
    // small layer, so they cost no full-screen layer of their own.
    const clouds = wx && wx.clouds > 0.02 && wx.cloudsInto;
    const flash = wx && wx.flash > 0;
    const u = nightMode(dark);
    if (u === 0) {
      // Daylight: the whole grade as one translucent wash, as it always was.
      w.push(this._dark);
      if (flash) w.push(wx.flashWash);
      const gr = composeWashes(w, this._grade);
      const fill = `rgba(${gr[0] | 0},${gr[1] | 0},${gr[2] | 0},${gr[3].toFixed(3)})`;
      if (!clouds) {
        // Nothing to cut out, so the grade is one plain fill.
        if (gr[3] > 0.004) { ctx.fillStyle = fill; ctx.fillRect(0, 0, vw, vh); }
        return true;
      }
      const g = this._layer(vw, vh);
      if (!g) return false;
      g.globalCompositeOperation = 'copy'; g.globalAlpha = 1;
      g.fillStyle = fill; g.fillRect(0, 0, this.layer.width, this.layer.height);
      wx.cloudsInto(g, ox, oy, vw, vh, t, this.layer.width / vw);
      ctx.drawImage(this.layer, 0, 0, vw, vh);
      return true;
    }
    // Lamps on: the day's washes fade into the light map over the start of
    // dusk (u), and while they do the rest of them is still washed on top.
    const gr = composeWashes(w, this._grade);
    const g = this._layer(vw, vh);
    if (!g) return false;
    const lw = this.layer.width, lh = this.layer.height, sx = lw / vw, sy = lh / vh;
    const m = nightMultiply(gr, u, this._dark, this._mul);
    g.globalCompositeOperation = 'copy';
    g.globalAlpha = 1;
    g.fillStyle = `rgb(${m[0] | 0},${m[1] | 0},${m[2] | 0})`; g.fillRect(0, 0, lw, lh);
    g.globalCompositeOperation = 'source-over';
    if (clouds) wx.cloudsInto(g, ox, oy, vw, vh, t, sx);
    // A broad, cool moonlit patch in the distance, inside the same small map.
    const moonAlpha = moon * u * (1 - look.cover) * (wx?.roofed ? 0 : 1 - (wx?.gloom || 0)) * 0.28;
    if (moonAlpha > 0.004) {
      const moonPic = this._sprite(MOON_SPILL);
      if (moonPic) {
        const x = 0.58 + Math.sin(phase * Math.PI * 2) * 0.24;
        g.globalAlpha = moonAlpha;
        g.drawImage(moonPic, lw * (x - 0.81), -lh * 0.56, lw * 1.62, lh * 1.58);
      }
    }
    const lights = this.gather(game, ox, oy, fvw, fvh, t, pj);
    // How strongly lights win against the dark: none by day, nearly fully at night.
    const strength = Math.min(1, dark * 2.4) * smooth((dark - 0.03) / 0.23);
    // Each pool paints its light's (lifted) colour into the map: warm under
    // lamps and fires, cool under crystals, full brightness at its heart.
    for (const L of lights) {
      const r = L.r * L.k * POOL_REACH;
      const ry = r * (L.sq ?? 1);
      const image = this._sprite(this._litColour(L.rgb));
      if (!image) continue;
      g.globalAlpha = Math.min(1, POOL_K * strength * L.k);
      const y = L.groundY ?? L.y;
      g.drawImage(image, (L.x - r) * sx, (y - ry) * sy, 2 * r * sx, 2 * ry * sy);
    }
    // The edge vignette goes into the map too, so the night costs one
    // full-screen layer rather than two (the renderer then skips its own).
    const vig = this._vignette(vw, vh);
    if (vig) {
      g.globalAlpha = 0.5 + 0.45 * Math.max(0, Math.min(1, night));
      g.drawImage(vig, 0, 0, lw, lh);
      this.vignetted = true;
    }
    g.globalAlpha = 1;
    this.count = lights.length;
    if (u < 1) {
      const wash = twilightWash(gr, this._dark, u, this._twilight);
      if (wash[3] > 0.004) {
        ctx.fillStyle = `rgba(${wash[0] | 0},${wash[1] | 0},${wash[2] | 0},${wash[3].toFixed(3)})`;
        ctx.fillRect(0, 0, vw, vh);
      }
    }
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.layer, 0, 0, vw, vh);   // the one full-screen composite
    ctx.globalCompositeOperation = op;
    // A lightning flash brightens, which a multiply can't: washed on over it.
    if (flash && wx.flashWash[3] > 0.004) {
      const f = wx.flashWash;
      ctx.fillStyle = `rgba(${f[0]},${f[1]},${f[2]},${f[3].toFixed(3)})`; ctx.fillRect(0, 0, vw, vh);
    }
    return true;
  }
}
