import { damageNumber as splatNum } from '../core/utils.js';   // hitsplats: 54000 -> "54K"
import { TILE, TICK_MS } from '../config.js';
import { drawBossMech, drawSafeZone } from './bossmechfx.js';
import { drawGateShrine } from './gateshrine.js';
import { TURN_MS } from '../game/character.js';
import { TERRAIN } from '../data/world.js';
import { getItem } from '../data/items.js';

// How each kind of arrow looks in flight: its metal head, fletching, the trail
// it leaves and, for the better arrows, a glow (and a larger, barbed head at the top).
// Hit numbers are drawn at this size (they were crowding the fight), and big
// ones are shortened: 12,345 -> 12.3k, 1,234,567 -> 1.23M.
const SPLAT_SCALE = 0.72;
// How far over your head your own name pill sits (its middle, in px).
const OWN_NAME_Y = 56;
const ARROW_LOOK = {
  default: { head: '#d9c45a', fletch: '#ffffff', shaft: '#b8874a', trail: '#ffffff', size: 1 },
  bronze: { head: '#c9874a', fletch: '#ffffff', shaft: '#b8874a', trail: '#ffffff', size: 1 },
  iron: { head: '#9aa3ad', fletch: '#e8ecf0', shaft: '#a8794a', trail: '#ffffff', size: 1 },
  steel: { head: '#d6dde4', fletch: '#cfd8e6', shaft: '#a8794a', trail: '#eef3f8', size: 1 },
  mithril: { head: '#6f8fe0', fletch: '#bcd0ff', shaft: '#8a6a4a', trail: '#cfdcff', size: 1.05 },
  adamant: { head: '#4fae74', fletch: '#b8ebc8', shaft: '#7a5a3a', trail: '#c8f0d4', size: 1.05 },
  rune: { head: '#4ec3e0', fletch: '#9fe6f5', shaft: '#6a4a3a', trail: '#9fe6f5', glow: '#4ec3e0', size: 1.1 },
  dragon: { head: '#e0483a', fletch: '#ffb07a', shaft: '#5a3a2a', trail: '#ff9a6a', glow: '#ff6a3a', size: 1.15, barbed: true },
  jade: { head: '#3fcf8e', fletch: '#c8f5dc', shaft: '#4a6a3a', trail: '#7ae8b0', glow: '#3fcf8e', size: 1.15, barbed: true },
  starmetal: { head: '#ffd24a', fletch: '#fff2b0', shaft: '#4a4a6a', trail: '#ffe88a', glow: '#ffd24a', size: 1.2, barbed: true },
  eternal: { head: '#c27bff', fletch: '#ecd6ff', shaft: '#3a2a5a', trail: '#d6a8ff', glow: '#a855ff', size: 1.25, barbed: true },
};
import { labelMode, objectLabelAlpha, npcNameVisible, targetTag, targetTagY, TAG_H, elementTint } from './worldlabels.js';
import { drawCreature, drawPlayer, drawObjectSprite, drawGroundItem, fishCalm } from './sprites.js';
import { heroAnimFrame, drawFishingGear, strikeClock } from './heroanim.js';
import { petDrawable } from './petsprite.js';
import { RARITY } from '../game/loot.js';
// The effects a melee blow spawns that wait for its strike (see _holdForStrike).
const HELD_FX = new Set(['slash', 'cleave', 'swipe']);
import { itemIconImage } from './icons.js';
import { moodFor, blendMood, composeWashes, dayNightWashes, buildVignette, ObjectReactions } from './ambience.js';
import { worldMood } from '../game/consequences.js';
import { Critters } from './critters.js';
import { LightPass } from './lighting.js';
import { CosyLight } from './cosylight.js';
import { Atmosphere } from './atmosphere.js';
import { AmbientLife } from './ambient.js';
import { AirMotes } from './airmotes.js';
import { RegionPostcards, titleRoom } from './postcard.js';
import { Weather } from './weather.js';
import { fxImage, fxTinted, drawFx, drawStrip, badgeKey, DARK_REGIONS } from './fxart.js';
import { introCurve, titleAlpha, DEATH_FLASH_MS } from '../game/cinematics.js';
import { TerrainFx, growBox, tileHash, recolourGround } from './terrainfx.js';
import { sunShadow, drawSunShadow, footfall } from './shadows.js';
import { dropArc, dropFx, spawnFx } from './combatfx.js';
import { applySquash, splatMotion, drawCritBurst, drawMissPuff, drawLootGlow, drawCoinGlint, motionOK } from './juice.js';
import { spawnPose, deathPose, windupAge, hazardPulse, hazardIn } from './creatureanim.js';
import { drawGrave } from './grave.js';
import { drawFishSchool } from './fishschoolfx.js';
import { playerBarVisible, drawPlayerHp } from './playerhp.js';
import { drawClassShot, drawClassEffect, drawClassAuras } from './classfx.js';   // the Priest's and the Zealot's own elements
import { censerBolt } from './censerSwing.js';   // a Zealot's bolt leaves the swinging censer
import { namePill, drawPill, pillRes, PILL_ROW } from './namepill.js';
import { foeThreat } from '../ui/bossbar.js';

// Gathering actions that show a progress ring over the node, and its colour.
const GATHER_RING = { woodcut: '#4fa04f', mine: '#8a8fa0', fish: '#3a8fd8', hunt: '#d08a3a' };
// The pill over your head while a boss's signature move holds you: [words, colour].
const PLAYER_DOT_STATUS = { poison: ['Poisoned', '#2f8a2a'], burn: ['Burning', '#c0501a'], bleed: ['Bleeding', '#a01a2a'], chill: ['Chilled', '#2a7a9a'] };
const ROOTED_STATUS = ['Rooted', '#6a4a2a'], STUNNED_STATUS = ['Stunned', '#7a5a9a'];

// Base terrain colours (RGB): a bright pastel world in the A-Worthy palette
// (soft mint lawns, warm cream paths, cream paper paving). Water is procedural.
const TERRAIN_RGB = {
  [TERRAIN.GRASS]: [170, 216, 146],
  [TERRAIN.DARKGRASS]: [162, 210, 140],
  [TERRAIN.PATH]: [238, 216, 178],
  [TERRAIN.SAND]: [248, 232, 196],
  [TERRAIN.STONE]: [232, 218, 198],
  [TERRAIN.WOOD]: [222, 186, 142],
};
// Pastel tile accents for the paved plazas (design-system chip pastels with
// their marker-pop partners): sun, bloom, sky, grass.
const TILE_POPS = [
  ['#FDF3DE', '#F5B82E'], ['#FDE8EE', '#EF476F'], ['#E6F1FB', '#5FAEE3'], ['#E5F5E9', '#3DAA5C'],
];

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

// Build a closed path through a small list of [x,y] points (e.g. a fletching
// vane or an arrowhead), ready for the caller to fill or stroke.
function path2(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// Terrain is baked in square chunks of this many tiles (1024px at 32px tiles);
// up to TERRAIN_CHUNK_CAP chunks are kept (~4MB each).
const TERRAIN_CHUNK = 32;
const TERRAIN_CHUNK_CAP = 24;

// Painted ground textures (assets/world/ground-<name>.webp). Each is a seamless
// 128px square that repeats every 4 tiles; until they load (and headless, where
// there's no Image) the ground keeps its drawn colours.
const GROUND_TEX_PX = 128;
const GROUND_TEX = {
  [TERRAIN.GRASS]: 'grass', [TERRAIN.DARKGRASS]: 'darkgrass', [TERRAIN.PATH]: 'path', [TERRAIN.SAND]: 'sand',
  [TERRAIN.STONE]: 'stone', [TERRAIN.WOOD]: 'wood', [TERRAIN.WATER]: 'water',
};
// A big square shows the same 4 x 4 tile block over and over, so the paving
// has variants (an inset Peranakan tile, a worn patch): each 4 x 4 block picks
// one by a stable hash, the plain paving most of the time.
const GROUND_VARIANTS = { [TERRAIN.STONE]: [['stone-2', 0.2], ['stone-3', 0.2]] };
// A region whose ground looks unlike everyone else's: region name -> ground
// type -> { tex } (its own texture, assets/world/ground-<tex>.webp) or
// { tint } (the usual texture recoloured once, terrainfx.js recolourGround).
// Either way it's baked into the terrain chunks, so it costs nothing per frame.
// The Celestial Peaks' stone is the town paving turned cool grey-blue mountain
// rock until painted rock arrives: then add ground-stone-peaks.webp and make
// the entry { tex: 'stone-peaks' }; nothing else needs to change.
export const REGION_GROUND = {
  'The Celestial Peaks': { [TERRAIN.STONE]: { tint: { lo: [76, 84, 96], hi: [208, 213, 220], mid: 0.6, gain: 3 } } },
};
const REGION_TERRAINS = new Set(Object.values(REGION_GROUND).flatMap((r) => Object.keys(r).map(Number)));
export const groundTextures = () => new Set([...Object.values(GROUND_TEX),
  ...Object.values(GROUND_VARIANTS).flatMap((v) => v.map(([n]) => n)),
  ...Object.values(REGION_GROUND).flatMap((r) => Object.values(r).map((e) => e.tex).filter(Boolean))]);

/** A region's own look for ground type t at tile (x, y) (REGION_GROUND), or
 *  null for the usual one. A tinted texture is made the first time a chunk
 *  needs it and kept (on `tex`). */
function regionGround(game, tex, t, x, y) {
  const w = game?.world, z = w?.zoneAt ? w.zoneAt(x, y) : null;
  const e = z && REGION_GROUND[z.name]?.[t];
  if (!e) return null;
  const key = `${z.name}|${t}`;
  tex.region ||= {};
  if (tex.region[key] === undefined) {
    let cv = null;
    try {
      const src = tex[t], W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
      cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      g.drawImage(src, 0, 0);
      const im = g.getImageData(0, 0, W, H);
      recolourGround(im.data, e.tint);
      g.putImageData(im, 0, 0);
    } catch { cv = null; }   // (no canvas to hand: the usual texture)
    tex.region[key] = cv;
  }
  return tex.region[key];
}

const LIT_RGB = [255, 190, 110];   // the warm pool round lamps and fires drawn with them

export class Renderer {
  constructor(game, canvas, ctx) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = ctx;
    // Static terrain is expensive to recompute per frame (grass blades, edges),
    // so bake it to offscreen canvases and only animate water on top. The world
    // is too big for one canvas (phones cap canvas size), so it's baked in
    // chunks of TERRAIN_CHUNK tiles, built as they come into view.
    this.terrainCanvas = this._buildTerrainCache();
    this._vig = null; // cached vignette (rebuilt on resize)
    // Atmosphere and life (see ambience.js / critters.js): the region's colour
    // mood easing toward the current one, objects reacting to you, critters.
    this._mood = moodFor('Singapore').slice();
    this._dn = dayNightWashes(0);
    this._washes = [this._mood, this._dn[0], this._dn[1]];
    this._grade = [0, 0, 0, 0];
    this.react = new ObjectReactions();
    this.critters = new Critters();
    this.lights = new LightPass();   // night lighting and the colour grade (lighting.js)
    this.cosy = new CosyLight();     // golden hour and lantern bloom over it (cosylight.js)
    this.atmos = new Atmosphere();   // region grade across borders, crisp at midday (atmosphere.js)
    this.amb = new AmbientLife();    // breeze, glints, flocks, town birds, cats, steam, leaves (ambient.js)
    this.motes = new AirMotes();     // motes, glow-flies, sea spray and blown sand on the wind (airmotes.js)
    this._moodOf = (z) => worldMood(this.game, z);
    this.postcards = new RegionPostcards();   // the arrival postcards (postcard.js)
    this.weather = new Weather();    // rain, snow, mist, embers (weather.js)
    this._critEnv = { world: null, zone: '', night: 0, px: 0, py: 0, low: false };
    this._lastT = 0;
    this.groundTex = this._loadGroundTextures();
  }

  /** Start loading the painted ground; once every texture is in, re-bake the
   *  terrain so the painted ground replaces the drawn one. */
  _loadGroundTextures() {
    if (typeof Image === 'undefined' || !this.terrainCanvas) return null;
    const tex = { variants: {}, region: {} }, ids = Object.keys(GROUND_TEX);
    const own = Object.entries(REGION_GROUND).flatMap(([z, r]) => Object.entries(r).filter(([, e]) => e.tex).map(([t, e]) => [`${z}|${t}`, e.tex]));
    let left = ids.length + Object.values(GROUND_VARIANTS).reduce((n, v) => n + v.length, 0) + own.length;
    tex.ready = false;
    const load = (name) => {
      const img = new Image();
      img.onload = () => {
        if (--left > 0) return;
        tex.ready = true;
        this.terrainCanvas.chunks.clear(); this.terrainCanvas.order.length = 0;
      };
      img.src = `assets/world/ground-${name}.webp`;
      return img;
    };
    for (const t of ids) tex[t] = load(GROUND_TEX[t]);
    for (const [t, v] of Object.entries(GROUND_VARIANTS)) tex.variants[t] = v.map(([n, w]) => [load(n), w]);
    for (const [k, n] of own) tex.region[k] = load(n);
    return tex;
  }

  /** Paint one tile's worth of a ground texture; false if it isn't ready. */
  _groundTile(g, t, x, y, sx, sy) {
    const tex = this.groundTex;
    if (!tex || !tex.ready || !tex[t]) return false;
    const k = GROUND_TEX_PX / TILE;
    let img = tex[t];
    const vs = tex.variants[t];
    const own = REGION_TERRAINS.has(t) ? regionGround(this.game, tex, t, x, y) : null;
    if (own) img = own;   // a region's own ground (one look, no inset tiles)
    else if (vs) {   // the block's variant: the same every bake (the variants share the plain one's outer ring of stones)
      let r = tileHash(Math.floor(x / k), Math.floor(y / k), 41);
      for (const [v, w] of vs) { if ((r -= w) < 0) { img = v; break; } }
    }
    g.drawImage(img, (x % k) * TILE, (y % k) * TILE, TILE, TILE, sx, sy, TILE + 0.5, TILE + 0.5);
    return true;
  }

  render(timeMs) {
    const { ctx, game } = this;
    const cam = game.camera;
    const fdt = this._lastT ? Math.max(0, Math.min(100, timeMs - this._lastT)) : 16;
    this._lastT = timeMs;
    // The camera's zoom eases a little in fights (cinematics.js): draw at it.
    if (cam.screenW) ctx.setTransform(cam.dpr * cam.zoom, 0, 0, cam.dpr * cam.zoom, 0, 0);
    // Snap the camera origin to whole pixels. The camera still tracks the player
    // at sub-pixel precision, but drawing the baked terrain (and the sprites laid
    // over it) at fractional offsets makes everything shimmer/crawl as you walk.
    // Rounding the shared origin keeps the world rock-steady while the player
    // sprite — drawn at its own sub-pixel centre minus this origin — stays smooth.
    // Screen shake rides on the origin so the whole world (not the HUD) jolts.
    let shx = 0, shy = 0;
    if (game.shakeT > 0) {
      const k = game.shakeT / game.shakeDur;
      const amp = game.shakeMag * k * k;
      shx = Math.sin(timeMs * 0.11) * amp;
      shy = Math.cos(timeMs * 0.137) * amp;
    }
    // Snap to *device* pixels (not CSS pixels) so on 2x/3x screens the world
    // and the sub-pixel sprites move together without a 1px shimmer.
    const dpr = (ctx.getTransform ? ctx.getTransform().a : 1) || 1;
    const ox = Math.round((cam.originX + shx) * dpr) / dpr, oy = Math.round((cam.originY + shy) * dpr) / dpr;
    const vw = cam.viewW, vh = cam.viewH;
    const night = 1 - game.daylightFactor(); // 0 (noon) .. 1 (midnight) — lights, fireflies
    // Shadows lean and stretch with the sun (shadows.js); low graphics keeps the plain ones.
    const sun = sunShadow(game.dayPhase(), this._sun || (this._sun = {}));
    sun.low = !!game.lowFx;
    // The decorative extras (reflections, critters, weather particles, the
    // second foam layer) also step down while frames run slow (governor.js).
    const trim = !!(game.lowFx || game.fxTrim);

    // Opaque canvas: paint, don't clear (one fill: a second, paler one under it was never seen).
    ctx.fillStyle = '#16241a';
    ctx.fillRect(0, 0, vw, vh);

    const x0 = Math.max(0, Math.floor(ox / TILE) - 1);
    const y0 = Math.max(0, Math.floor(oy / TILE) - 1);
    const x1 = Math.min(game.world.width - 1, Math.ceil((ox + vw) / TILE) + 1);
    const y1 = Math.min(game.world.height - 1, Math.ceil((oy + vh) / TILE) + 1);

    if (this.terrainCanvas) {
      // Blit the cached static terrain chunks for the visible slice, then animate water.
      this._drawTerrainChunks(ox, oy, vw, vh);
      // (The animated water layer carries the shoreline foam when it can.)
      const foamDone = this._drawWaterOverlay(x0, y0, x1, y1, ox, oy, timeMs);
      // Shoreline foam, lily pads and reeds, and reflections (terrainfx.js).
      if (this.tfx && this._visChunks) {
        this.tfx.drawWater(ctx, this._visChunks, ox, oy, vw, vh, timeMs, trim, !foamDone);
        this.tfx.drawReflections(ctx, game, this._visChunks, ox, oy, vw, vh, timeMs);
      }
    } else {
      this._drawTerrain(x0, y0, x1, y1, ox, oy, timeMs);
    }
    this._drawGroundDecals(ox, oy);
    this._drawHazards(ox, oy, timeMs);
    // Weather (weather.js): the sky for this region and moment, then puddles and
    // ripples on the ground, under everyone. Looks only; never gameplay.
    this.weather.update(game, fdt);
    this.weather.drawGround(ctx, game, ox, oy, vw, vh, timeMs, fdt, trim);
    // Critters move on and objects near you react (bushes sway, tall things fade).
    this.react.update(game, fdt);
    {
      const env = this._critEnv, pc = game.player.renderCenter();
      env.world = game.world; env.zone = game.currentZoneName; env.night = night; env.px = pc.x; env.py = pc.y; env.low = trim;
      this.critters.update(fdt, env, ox, oy, vw, vh);
      this.critters.drawGround(ctx, ox, oy);
      this.amb.update(game, fdt, timeMs, ox, oy, vw, vh, night, this.weather.state, trim);
      const mo = this._moteOpts || (this._moteOpts = {});
      mo.low = !!game.lowFx; mo.trim = !!game.fxTrim; mo.calm = !!game.reduceMotion;
      this.motes.update(game, fdt, timeMs, ox, oy, vw, vh, night, this.weather.state, this.amb.wind, mo);
    }

    // Depth-sorted drawables.
    const drawables = [];
    const isLightSource = (o) => o.def.type === 'fire' || o.def.type === 'furnace' || o.def.type === 'range' ||
      (o.def.type === 'scenery' && o.objId === 'lamp');
    // The objects in view, kept for the node labels and signposts drawn later
    // this frame (the world holds thousands: its spatial index finds the few in view).
    const visObjs = this._visObjs || (this._visObjs = []);
    const W = game.world;
    if (W.objectsIn) W.objectsIn(x0 - 1, y0 - 1, x1 + 1, y1 + 1, visObjs);
    else { visObjs.length = 0; for (const o of W.objects) if (!(o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 1)) visObjs.push(o); }
    for (const o of visObjs) {
      if (o.def.footprint) continue;   // landmarks: below, by their own list
      // Harvest judder: a struck tree/rock wobbles briefly as the resource pops.
      const jx = o.shakeT > 0 ? Math.sin(o.shakeT * 0.09) * 1.7 * (o.shakeT / 280) : 0;
      const cx = o.x * TILE + TILE / 2 - ox + jx, cy = o.y * TILE + TILE / 2 - oy;
      const lit = night > 0.12 && isLightSource(o);
      const fade = this.react.alpha(o), lean = this.react.skew(o, timeMs) + this.amb.lean(o, timeMs);   // brushed, or in the breeze (ambient.js)
      // A spot's fish stops leaping while a school swirls there (fishCalm keeps when).
      const still = o.def.type === 'fishing' && fishCalm(o, game.fishSchools?.at(o), timeMs);
      drawables.push({ sortY: o.y + (o.def.overhead ? 0.9 : 0.4), z: 1, draw: () => {   // (a hanging lantern goes over your head)
        if (lit) {
          // A warm light pool blooms outward after dark — fires, furnaces,
          // ranges and street lamps become the island's night-time glow.
          const flick = 0.85 + Math.sin(timeMs * 0.01 + o.x * 3.1 + o.y) * 0.15;
          const r = (20 + night * 12) * flick;
          this.atmos.pool(ctx, cx, cy - 4, r, LIT_RGB, 0.32 * night);   // a baked sprite, not a gradient a frame
        }
        if (fade < 1 || lean) {
          // See-through while you're behind it; a brushed bush leans about its base.
          ctx.save();
          ctx.globalAlpha = fade;
          if (lean) { ctx.translate(cx, cy + 13); ctx.transform(1, 0, lean, 1, 0, 0); ctx.translate(-cx, -(cy + 13)); }
          drawObjectSprite(ctx, o, cx, cy, timeMs, !!game.lowFx, still);
          ctx.restore();
        } else drawObjectSprite(ctx, o, cx, cy, timeMs, !!game.lowFx, still);
      } });
    }
    // Landmarks stand on their front-left tile, but their picture spreads across
    // the footprint and well above it, so they are found by the world's short
    // list of them (a few dozen) rather than by the tiles in view.
    for (const o of W.landmarks || []) {
      const [fw] = o.def.footprint;
      const left = o.x * TILE - TILE, right = (o.x + fw + 1) * TILE, base = (o.y + 1) * TILE;
      if (right < ox || left > ox + vw || base < oy || base - fw * TILE * 1.6 - 2 * TILE > oy + vh) continue;
      const cx = o.x * TILE + fw * TILE / 2 - ox, cy = o.y * TILE + TILE / 2 - oy, fade = this.react.alpha(o);
      drawables.push({ sortY: o.y + 0.4, z: 1, draw: () => {
        if (fade < 1) { ctx.save(); ctx.globalAlpha = fade; drawObjectSprite(ctx, o, cx, cy, timeMs); ctx.restore(); }
        else drawObjectSprite(ctx, o, cx, cy, timeMs);
      } });
    }
    for (const sc of game.fishSchools?.list || []) {   // a school of fish at a spot (fishschool.js): one or two at most
      const o = sc.obj;
      if (o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 1) continue;
      drawables.push({ sortY: o.y + 0.41, z: 1, draw: () => drawFishSchool(ctx, o.x * TILE + TILE / 2 - ox, o.y * TILE + TILE / 2 - oy, timeMs, sc, game.tickCount || 0, !!game.lowFx) });
    }
    { const gr = game.play?.grave;   // your gravestone, where you last fell (playbalance.js)
      if (gr && gr.x >= x0 && gr.x <= x1 && gr.y >= y0 && gr.y <= y1) drawables.push({ sortY: gr.y + 0.3, z: 1, draw: () => drawGrave(ctx, gr.x * TILE + TILE / 2 - ox, gr.y * TILE + TILE * 0.8 - oy, timeMs) }); }
    for (const g of game.world.groundItems) {
      if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue;
      drawables.push({ sortY: g.y - 0.3, z: 0, draw: () => {
        // (Worked out at draw time, after the hero's clip has noted this frame's blow.)
        if (g.born && !g._fx) {
          // First sight: a drop from a blow still being swung waits for the strike; coins sparkle as they land.
          g._fx = true;
          const clk = strikeClock(game);
          if (clk && Math.abs(g.born - clk.blowAt) < 80 && clk.hitTimes[0] > g.born) g.born = clk.hitTimes[0];
          dropFx(game, g, g.x * TILE + TILE / 2 + (g.ox || 0), g.y * TILE + TILE * 0.62 + (g.oy || 0), g.born - performance.now());
        }
        // Fresh drops bounce out of the body in an arc and settle (combatfx.js dropArc).
        const ms = g.born ? performance.now() - g.born : 1e9;
        if (ms < 0) return;   // still waiting for the blow that dropped it to land
        const arc = dropArc(ms, this._arc || (this._arc = {}));
        const cx = g.x * TILE + TILE / 2 - ox + (g.ox || 0) * arc.k, cy = g.y * TILE + TILE * 0.62 - oy + (g.oy || 0) * arc.k - arc.h;
        // Uncommon and up glow in their rarity's colour; rare and up stand in a
        // beam of light once they've landed, legendary ones sparkle (juice.js).
        drawLootGlow(ctx, g.rarity, cx, cy, ms, timeMs, !!(game.lowFx || game.fxTrim));
        if (g.id === 'coins') drawCoinGlint(ctx, cx, cy, timeMs, g.x + g.y);   // coins catch the light now and then
        if (arc.land > 0) {   // a little squash as it touches down
          ctx.save(); ctx.translate(cx, cy + 6); ctx.scale(1 + arc.land * 0.22, 1 - arc.land * 0.22); ctx.translate(-cx, -(cy + 6));
          drawGroundItem(ctx, g.id, cx, cy);
          ctx.restore();
        } else drawGroundItem(ctx, g.id, cx, cy);
      } });
    }
    // Only NPCs near the player can be on screen (the world holds thousands).
    const npcs = game.nearbyNpcs ? game.nearbyNpcs() : game.npcs;
    // Most of those are well off screen (a busy region has over a thousand
    // nearby), so they're ruled out by their tiles first, in a plain loop of
    // their own: each turn of the loop below costs memory even when it skips
    // (its drawables keep what they need), and so does working out where a
    // body is drawn. A body is drawn between the tile it stands on and the one
    // it's stepping to, and the margin is wider than either check below, so
    // nothing that could show is left out.
    const near = this._npcsInView || (this._npcsInView = []);
    near.length = 0;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (!n.alive && !(n.deathT > 0)) continue;
      const m = Math.max(40, 48 * (n.def.scale || 1)) + TILE;
      if (Math.max(n.x, n.tx) * TILE + TILE / 2 - ox < -m || Math.min(n.x, n.tx) * TILE + TILE / 2 - ox > vw + m
        || Math.max(n.y, n.ty) * TILE + TILE / 2 - oy < -m || Math.min(n.y, n.ty) * TILE + TILE / 2 - oy > vh + m) continue;
      near.push(n);
    }
    // Reduce motion (the setting or the browser's): struck monsters don't shudder or fidget.
    const calm = !motionOK(game);
    for (const n of near) {
      if (!n.alive && !(n.deathT > 0)) continue;
      const c = n.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      const sc = n.def.scale || 1;
      if (!n.alive) {
        // Death animation: keel over about the feet while fading out.
        if (cx < -40 || cy < -40 || cx > vw + 40 || cy > vh + 40) continue;
        const k = 1 - n.deathT / 420; // 0 -> 1 over the fall
        const dir = (n.faceX ?? ((n.facing && n.facing.dx < 0) ? -1 : 1)) < 0 ? -1 : 1;
        // Topple like a falling body: a jolt as the blow lands, tipping faster
        // and faster, a bump on the ground, then fade (creatureanim.js).
        const d = deathPose(k, this._deathPose || (this._deathPose = {}));
        const rot = d.rot, dsx = d.sx, dsy = d.sy, da = d.a;
        drawables.push({ sortY: c.y / TILE - 0.01, z: 1, draw: () => {
          ctx.save();
          ctx.globalAlpha = da;
          ctx.translate(cx, cy + 11 * sc);
          ctx.rotate(dir * rot * Math.PI * 0.5);
          ctx.scale(dsx, dsy);
          ctx.translate(-cx, -(cy + 11 * sc));
          drawCreature(ctx, n.artId || n.npcId, cx, cy - 2, {
            time: timeMs, facing: n.facing, fx: n.faceX, moving: false, hurt: n.hurt,
            scale: sc, sprite: n.def.sprite, color: n.def.color, boss: n.def.boss, family: n.def.family,
            // It falls as it stood: in low graphics or slow frames a pack monster was
            // its single sticker a moment ago, so it stays one rather than switching
            // to its parts rig (composed afresh, see-through, every frame of the fall).
            low: game.lowFx, trim: game.fxTrim,
          });
          ctx.restore();
          ctx.globalAlpha = 1;
        } });
        continue;
      }
      // Skip anything off-screen (with room for big bosses): the world holds
      // over a thousand monsters, and only a few dozen are ever in view.
      const pad = 48 * sc;
      if (cx < -pad || cy < -pad || cx > vw + pad || cy > vh + pad) continue;
      const off = n.renderOffset ? n.renderOffset() : { x: 0, y: 0 };
      // A fresh respawn pops up out of the ground in a puff of dust, overshooting
      // a little and settling, as it fades in (creatureanim.js).
      const spawn = n.spawnT > 0 ? n.spawnT / 350 : 0;
      // (Once per respawn: a spawn lasts 350ms, so one seen well after the last puff is a new one.)
      if (spawn > 0 && !(timeMs - n._puffT < 400)) { n._puffT = timeMs; spawnFx(game, n); }
      const sp = spawn > 0 ? spawnPose(1 - spawn, n._spawnPose || (n._spawnPose = {})) : null;
      const windAge = windupAge(n, timeMs);
      drawables.push({ sortY: c.y / TILE, z: 2, draw: () => {
        // A footfall or the end of a respawn's pop squashes the shadow a touch.
        const land = spawn > 0 && spawn < 0.3 ? Math.sin(spawn / 0.3 * Math.PI) : 0;
        drawSunShadow(ctx, cx, cy + 12 * sc, 10 * sc * (sp ? sp.sx : 1), 4.5 * sc * (sp ? sp.sx : 1), sun, Math.max(footfall(n.walkPhase, n.isMoving) * 0.6, land));
        if (sp) {
          const fy = cy + 12 * sc + off.y;
          ctx.save(); ctx.globalAlpha = sp.a;
          ctx.translate(cx + off.x, fy); ctx.scale(sp.sx, sp.sy); ctx.translate(-(cx + off.x), -fy);
        }
        if (n === game.player.target) this._lockOn(cx, cy + 12 * sc, sc, timeMs);
        if (n.reflectTicks > 0) {
          // Boss buff: a spiky gold ring while reflecting.
          ctx.save();
          const R = 22 * sc, by = cy - 6 * sc;
          ctx.globalAlpha = 0.9; ctx.strokeStyle = '#F5B82E'; ctx.lineWidth = 2.5; ctx.beginPath();
          for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2 + timeMs * 0.002, rr2 = R + 4 + (i % 2 ? 5 : 0); ctx.lineTo(cx + Math.cos(a) * rr2, by + Math.sin(a) * rr2); }
          ctx.stroke();
          ctx.restore();
        }
        if (n.champion) {
          // Champion: a spinning gold ring on the ground.
          ctx.save();
          ctx.strokeStyle = '#F5B82E'; ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 4]); ctx.lineDashOffset = -timeMs * 0.02;
          ctx.globalAlpha = 0.85 + Math.sin(timeMs * 0.008) * 0.15;
          ctx.beginPath(); ctx.ellipse(cx, cy + 12 * sc, 13 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        const hurt = this._heldHurt(n, timeMs);
        // Struck: squash, stretch and wobble about its feet as the blow lands (juice.js).
        const sq = applySquash(ctx, n, hurt, cx + off.x, cy + 12 * sc + off.y);
        drawCreature(ctx, n.artId || n.npcId, cx + off.x, cy - 2 + off.y, {
          time: timeMs, facing: n.facing, fx: n.faceX, turn: (n.turnT || 0) / TURN_MS, entity: n,
          moving: n.isMoving, walk: n.walkPhase, move: n.animMove,
          scale: sc, sprite: n.def.sprite, color: n.def.color, boss: n.def.boss, family: n.def.family,
          attackK: n.swingProgress ? n.swingProgress() : -1,
          hurt, windup: n.windup > 0, windAge, castK: n.castT > 0 ? 1 - n.castT / 700 : 0, castCol: n.castCol,
          status: elementTint(game, n, timeMs),   // burning, chilled or cracked: a wash of the element's colour
          low: game.lowFx,   // low graphics: monsters and townsfolk skip their moving parts
          trim: game.fxTrim,   // frames running slow: monster packs skip theirs too (governor.js)
          calm,
        });
        if (sq) ctx.restore();
        if (sp) ctx.restore();
        if (n.mech || n.mechHealer) drawBossMech(ctx, n, cx, cy, sc, timeMs, ox, oy);   // boss mechanics (bossmech.js)
      } });
    }
    if (game.player.alive) {
      const c = game.player.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      const off = game.player.renderOffset ? game.player.renderOffset() : { x: 0, y: 0 };
      const al = game.alignmentStyle ? game.alignmentStyle() : null;
      // The hero's clip this frame (life skill, weapon swing, idle), blended.
      const anim = heroAnimFrame(game, timeMs);
      // Fishing gear out on the water (line, bobber, net, pot, harpoon, the
      // fish flipping in) goes over the hero and over the spot, whichever is nearer.
      if (anim?.fish) {
        const sy = Math.max(c.y / TILE, (anim.fish.oy ?? 0) + 0.4) + 0.001;
        drawables.push({ sortY: sy, z: 3, draw: () => drawFishingGear(ctx, anim, cx + off.x, cy + off.y) });
      }
      drawables.push({ sortY: c.y / TILE, z: 2, draw: () => {
        drawSunShadow(ctx, cx, cy + 13, 10, 4.5, sun, footfall(game.player.walkPhase, game.player.isMoving) * (game.player.running ? 0.8 : 0.5));
        if (al?.aura) this._auraBack(cx + off.x, cy + off.y, al, timeMs);
        const sk = game.player.swingProgress();
        if (sk >= 0 && game.combatMode() === 'magic') this._castRing(cx, cy + 12, sk);
        drawPlayer(ctx, cx + off.x, cy - 2 + off.y, {
          anim,
          time: timeMs, facing: game.player.facing, fx: game.player.faceX, entity: game.player, hurt: game.player.hurt,
          moving: game.player.isMoving, swingK: sk,
          hasBody: !!game.equipment.get('body'), hasWeapon: !!game.equipment.get('weapon'), weaponType: game.combatMode(),
          hasCape: !!game.equipment.get('cape'), hasHelm: !!game.equipment.get('head'),
          hasShield: !!game.equipment.get('shield') && !game.equipment.isDualWielding() && !/_quiver$/.test(game.equipment.get('shield')),   // a quiver is no shield
          dualWield: game.equipment.isDualWielding(), prayerActive: !!game.burstActive?.(), jobClass: game.jobClass,
          gait: { phase: game.player.walkPhase, move: game.player.animMove, run: game.player.running && game.player.isMoving,
            turn: game.player.turnT / TURN_MS },
        });
        if (game.player.hurt > 0) this._hurtFlash(cx + off.x, cy - 2 + off.y, 1, game.player.hurt);
        if (al?.halo || al?.eyes) this._auraFront(cx + off.x, cy + off.y, al, timeMs);
      } });
    }
    { const pet = petDrawable(game, ctx, ox, oy, vw, vh, timeMs); if (pet) drawables.push(pet); }   // your pet (petsprite.js)
    this._holdForStrike(timeMs);
    // A melee blow's impact waits for the weapon to land, like its hitsplat.
    { const clk = strikeClock(game); game.cfx.armFresh(clk && timeMs - clk.blowAt < 60 ? clk.hitTimes[0] - timeMs : 0); }
    this.amb.drawGround(ctx, visObjs, ox, oy, timeMs);   // glints, flock shadows, cats, town birds (ambient.js)
    drawables.sort((a, b) => (a.sortY - b.sortY) || (a.z - b.z));
    for (const d of drawables) d.draw();
    this.amb.drawOver(ctx, visObjs, ox, oy, timeMs);     // steam off the hawker stalls

    this._drawClueMarker(ox, oy, vw, vh, timeMs);
    this.amb.drawAir(ctx, ox, oy, timeMs);   // leaves, petals and birds, under the grade
    this.motes.drawLow(ctx, ox, oy);          // blown sand and sea spray, under it too
    // The light pass (lighting.js) paints the grade and the night's darkness
    // with lamps, fires and spells cut out of it, then the weather in the air;
    // low graphics (and headless runs) keep the old flat fill.
    if (game.lowFx || !this.lights.ok || !this.lights.draw(ctx, game, this.atmos.crisp(this._blendMood(fdt), game.dayPhase(), this.weather.state.gloom), night, this.weather.state, ox, oy, vw, vh, timeMs)) this._drawDayNight(vw, vh, night, fdt);
    else if (!game.fxTrim) this.cosy.draw(ctx, game, this.lights, night, ox, oy, vw, vh, timeMs);   // golden hour and lantern glow (cosylight.js)
    this.weather.drawAir(ctx, ox, oy, vw, vh, timeMs, fdt, trim);
    // Frames running slow (governor.js) also skip these two full-screen layers:
    // the golden hour's soft-light grade and the vignette are the costliest
    // things left to paint on a phone that can't keep up.
    if (!game.fxTrim) this._drawVignette(vw, vh, night);
    this.critters.drawAir(ctx, ox, oy, timeMs);
    this.motes.drawGlow(ctx, ox, oy, timeMs);   // sunlit motes and glow-flies, over the night
    this._drawParticles(ox, oy);
    this._drawProjectiles(ox, oy);
    drawClassAuras(ctx, game, ox, oy, timeMs);   // a Grace ward, stored Wrath, Holy Fire's brands
    // Impacts, crit stars, death poofs, coin sparkles, level-up light (combatfx.js).
    game.cfx.update(game.hitStop > 0 ? fdt * 0.12 : fdt);
    game.cfx.draw(ctx, ox, oy);
    this._drawOverheads(ox, oy, visObjs);
    this._drawHurtFlash(vw, vh);
    if (!game.reduceMotion) game.cfx.drawPulse(ctx, vw, vh);
    this._drawCinematics(vw, vh);
  }

  // The whole colour grade in ONE full-screen fill: the region's mood (eased
  // toward the current region's over about a second), a warm dawn/dusk glow
  // that peaks with the sun on the horizon, and a lavender night wash capped so
  // the world stays readable at midnight. Painted one over another they'd be
  // three fills; composeWashes folds them into one that looks the same.
  // Drawn under particles/hitsplats so embers and fireflies still pop at night.
  _drawDayNight(vw, vh, night, dt) {
    this._blendMood(dt);
    dayNightWashes(night, this._dn);
    const g = composeWashes(this._washes, this._grade);
    if (g[3] <= 0.004) return;
    this.ctx.fillStyle = `rgba(${g[0] | 0},${g[1] | 0},${g[2] | 0},${g[3].toFixed(3)})`;
    this.ctx.fillRect(0, 0, vw, vh);
  }

  /** Ease the region's mood toward where you are (low graphics keeps just the
   *  day/night light, so the mood eases away). */
  _blendMood(dt) {
    return blendMood(this._mood, this.game.lowFx ? moodFor('Singapore') : this.atmos.regionMood(this.game, this._moodOf), dt);   // shaded by your choices (consequences.js), blended across borders (atmosphere.js)
  }

  // ---------------- Alignment aura (alignment.js) ----------------
  // A soft gold glow for the good (a halo too from Virtuous), dark purple smoke
  // for the wicked (and a faint red glint of eyes for a Villain), nothing at
  // Neutral. The glows are painted once into small canvases and stamped each
  // frame with a gentle pulse, so the aura costs a couple of drawImage calls.
  _auraSprite(kind, strength) {
    const cache = this._auraCache || (this._auraCache = {});
    const key = kind + strength;
    if (key in cache) return cache[key];
    if (typeof document === 'undefined') return (cache[key] = null);   // headless: no aura
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 80;
    const g = cv.getContext('2d');
    if (!g) return (cache[key] = null);
    const a = 0.18 + strength * 0.12;
    if (kind === 'holy') {
      const grd = g.createRadialGradient(32, 46, 2, 32, 46, 31);
      grd.addColorStop(0, `rgba(255,226,110,${a})`);
      grd.addColorStop(0.55, `rgba(255,200,60,${a * 0.6})`);
      grd.addColorStop(1, 'rgba(255,210,74,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(32, 46, 31, 34, 0, 0, Math.PI * 2); g.fill();
    } else {
      // A few overlapping dark puffs read as smoke.
      for (const [x, y, r] of [[32, 56, 24], [21, 42, 16], [43, 40, 16], [32, 28, 15]]) {
        const grd = g.createRadialGradient(x, y, 1, x, y, r);
        grd.addColorStop(0, `rgba(60,16,96,${a})`);
        grd.addColorStop(0.6, `rgba(96,44,150,${a * 0.5})`);
        grd.addColorStop(1, 'rgba(60,16,96,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
    return (cache[key] = cv);
  }

  /** The glow or smoke behind the hero (cx, cy: the hero's tile centre). */
  _auraBack(cx, cy, al, t) {
    const img = this._auraSprite(al.aura, al.strength);
    if (!img) return;
    const { ctx } = this, low = this.game.lowFx;
    ctx.save();
    if (low) {   // low graphics: one still, fainter stamp
      ctx.globalAlpha = 0.6;
      ctx.drawImage(img, cx - 32, cy - 56);
    } else if (al.aura === 'dark') {
      // Two stamps sway apart and back, so the smoke seems to drift.
      const sway = Math.sin(t * 0.0025) * 3;
      ctx.globalAlpha = 0.85 + Math.sin(t * 0.004) * 0.15;
      ctx.drawImage(img, cx - 32 + sway, cy - 56);
      ctx.globalAlpha *= 0.55;
      ctx.drawImage(img, cx - 32 - sway, cy - 59 + Math.cos(t * 0.003) * 2);
    } else {
      ctx.globalAlpha = 0.8 + Math.sin(t * 0.004) * 0.2;
      ctx.drawImage(img, cx - 32, cy - 56);
    }
    ctx.restore();
  }

  /** In front of the hero: a halo over the head (Virtuous, Paragon) or a
   *  Villain's faint red eyes. */
  _auraFront(cx, cy, al, t) {
    const { ctx } = this, low = this.game.lowFx;
    ctx.save();
    if (al.halo) {
      const hy = cy - 46 + (low ? 0 : Math.sin(t * 0.003) * 1.2);   // just over the hero's head
      ctx.globalAlpha = al.strength >= 3 ? 0.95 : 0.75;
      ctx.strokeStyle = '#8A6205'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(cx, hy, 8, 2.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = al.strength >= 3 ? '#FFF2A8' : '#FFD24A'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, hy, 8, 2.6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (al.eyes && !low) {
      // Roughly where the hero's eyes are: the painted heroes all face front.
      const k = 0.5 + Math.max(0, Math.sin(t * 0.002)) * 0.4, ey = cy - 21;
      ctx.fillStyle = '#FF2A3A';
      ctx.globalAlpha = k * 0.3;
      for (const ex of [-4.2, 4.2]) { ctx.beginPath(); ctx.arc(cx + ex, ey, 3.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = k;
      for (const ex of [-4.2, 4.2]) { ctx.beginPath(); ctx.arc(cx + ex, ey, 1.6, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // Cinematic overlays in screen space: a boss's entrance banner (its name and
  // level sliding in), a new region's title card, and a boss death's flash.
  _drawCinematics(vw, vh) {
    const cine = this.game.cine;
    if (!cine) return;
    const { ctx } = this;
    if (cine.flash > 0 && !this.game.reduceMotion) {
      ctx.fillStyle = `rgba(255,252,240,${(0.5 * cine.flash / DEATH_FLASH_MS).toFixed(3)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    const size = Math.max(16, Math.min(30, vw * 0.042));
    if (cine.intro) {
      const { banner } = introCurve(cine.intro.t);
      if (banner > 0) {
        const y = vh * 0.29, h = size * 1.95;   // below the boss bar and tips at the top, above the fight
        // It slides in from the left, then fades away at the end.
        const entering = cine.intro.t < 400;
        const slide = entering ? (1 - banner) * -vw : 0;
        ctx.save();
        ctx.globalAlpha = entering ? 1 : banner;
        ctx.translate(slide, 0);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        // Like the title cards, kept left of a phone's HUD column (titleRoom),
        // the name set smaller where it would not fit the banner there.
        const room = titleRoom(vw, vh, this.game.camera?.zoom || 1), cx = room.cx;
        const name = cine.intro.name.toUpperCase();
        const bh = h * 1.4, tone = DARK_REGIONS.has(this.game.currentZoneName) ? 'dark' : 'normal';
        ctx.font = `900 ${size.toFixed(1)}px Nunito,"Trebuchet MS",sans-serif`;
        const fit = Math.min(1, (room.w * 0.98 - bh * 2.4) / Math.max(1, ctx.measureText(name).width));
        if (fit < 1) ctx.font = `900 ${(size * Math.max(0.6, fit)).toFixed(1)}px Nunito,"Trebuchet MS",sans-serif`;
        // The painted banner (dark in the grim lands) with its crest on top,
        // sized to the name; a plain navy ribbon with gold rules until it loads.
        if (drawStrip(ctx, 'banner', tone, cx, y, Math.min(room.w * 0.98, ctx.measureText(name).width + bh * 2.4), bh)) {
          const crest = fxImage('banner-crest');
          if (crest) drawFx(ctx, crest, cx, y - bh * 0.5 - size * 0.25, size * 1.5);
        } else {
          ctx.fillStyle = 'rgba(34,48,74,0.86)';
          ctx.fillRect(0, y - h / 2, vw, h);
          ctx.fillStyle = '#F5B82E';
          ctx.fillRect(0, y - h / 2, vw, 2.5); ctx.fillRect(0, y + h / 2 - 2.5, vw, 2.5);
        }
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = size * 0.22; ctx.strokeText(name, cx, y - size * 0.22);
        ctx.fillStyle = '#FFE38A'; ctx.fillText(name, cx, y - size * 0.22);
        ctx.font = `800 ${(size * 0.48).toFixed(1)}px Nunito,"Trebuchet MS",sans-serif`;
        ctx.fillStyle = '#FAF6EE'; ctx.fillText(`Level ${cine.intro.level}`, cx, y + size * 0.62);
        ctx.restore();
      }
    }
    const tc = cine.title;
    if (tc && !cine.intro) {   // a boss entrance takes the stage over a title card
      const a = titleAlpha(tc.t);
      if (a > 0) {
        const y = vh * 0.3 - (1 - a) * 6;   // clear of the region label and tips
        const room = titleRoom(vw, vh, this.game.camera?.zoom || 1), cx = room.cx;   // clear of a phone's HUD column
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        if (this.postcards.draw(ctx, tc, vw, vh, a, room) || this._titlePlaque(tc, room, y, size)) { ctx.restore(); return; }   // a postcard (postcard.js), else the plaque
        // Sticker lettering: a white border round navy ink round the colour.
        ctx.font = `900 ${(size * 1.25).toFixed(1)}px Nunito,"Trebuchet MS",sans-serif`;
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = size * 0.5; ctx.strokeText(tc.name, cx, y);
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = size * 0.22; ctx.strokeText(tc.name, cx, y);
        ctx.fillStyle = '#F5B82E'; ctx.fillText(tc.name, cx, y);
        if (tc.sub) {
          ctx.font = `800 ${(size * 0.5).toFixed(1)}px Nunito,"Trebuchet MS",sans-serif`;
          ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = size * 0.2; ctx.strokeText(tc.sub, cx, y + size * 1.05);
          ctx.fillStyle = '#22304A'; ctx.fillText(tc.sub, cx, y + size * 1.05);
        }
        ctx.restore();
      }
    }
  }

  // A region's title card on its painted plaque (dark in the grim lands), the
  // region's round badge pinned to its left end. False until the art loads.
  _titlePlaque(tc, room, y, size) {
    const { ctx } = this;
    const dark = DARK_REGIONS.has(tc.name);
    const ph = size * (tc.sub ? 2.9 : 2.4);
    const badge = fxImage(badgeKey(tc.name));
    const bw = badge ? ph * 1.2 : 0;   // the badge overhangs the plaque's left end
    // The lettering shrinks to fit a narrow room (titleRoom) rather than run off the plaque.
    const font = (k) => [`900 ${(size * 1.1 * k).toFixed(1)}px Nunito,"Trebuchet MS",sans-serif`, `800 ${(size * 0.5 * k).toFixed(1)}px Nunito,"Trebuchet MS",sans-serif`];
    const textW = ([nf, sf]) => { ctx.font = nf; let t = ctx.measureText(tc.name).width; if (tc.sub) { ctx.font = sf; t = Math.max(t, ctx.measureText(tc.sub).width); } return t; };
    let [nameFont, subFont] = font(1);
    let tw = textW([nameFont, subFont]);
    const fit = Math.min(1, (room.w * 0.96 - ph * 1.5 - bw * 0.55) / Math.max(1, tw));
    if (fit < 1) { [nameFont, subFont] = font(Math.max(0.6, fit)); tw = textW([nameFont, subFont]); }
    const w = Math.min(room.w * 0.96, tw + ph * 1.5 + bw * 0.55);
    const cx = room.cx + bw * 0.22;
    if (!drawStrip(ctx, 'plaque', dark ? 'dark' : 'normal', cx, y, w, ph)) return false;
    if (badge) drawFx(ctx, badge, cx - w / 2 + bw * 0.1, y, bw);
    const tx = cx + bw * 0.2, ny = tc.sub ? y - size * 0.32 : y;
    ctx.font = nameFont;
    ctx.fillStyle = dark ? '#F3E6FF' : '#22304A'; ctx.fillText(tc.name, tx, ny);
    if (tc.sub) {
      ctx.font = subFont;
      ctx.fillStyle = dark ? '#C9A8E8' : '#8A5A1E'; ctx.fillText(tc.sub, tx, y + size * 0.62);
    }
    return true;
  }

  // A glowing rune circle under the caster's feet while a spell goes off.
  _castRing(cx, cy, k) {
    const { ctx } = this;
    const a = Math.sin(k * Math.PI);
    const rr = 8 + k * 10;
    ctx.save();
    ctx.globalAlpha = 0.7 * a;
    ctx.strokeStyle = '#B98AE8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.35 * a; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, rr * 0.65, rr * 0.27, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#E8D6FF';
    for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2 + k * 3; ctx.beginPath(); ctx.arc(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * 0.42, 1.3, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }

  // White impact flash over a struck entity (brightens the sprite briefly).
  _hurtFlash(cx, cy, sc, hurt) {
    const { ctx } = this;
    const a = Math.min(0.55, (hurt / 200) * 0.55);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffd6d6';
    ctx.beginPath(); ctx.ellipse(cx, cy, 8 * sc, 11 * sc, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Red screen edges when the player takes a hit.
  _drawHurtFlash(vw, vh) {
    const { ctx, game } = this;
    // Low-health heartbeat: a soft red edge pulse while below a quarter HP.
    if (game.player.alive && game.player.hp / Math.max(1, game.maxHp()) <= 0.25) {
      const a = 0.10 + (Math.sin(performance.now() * 0.005) + 1) * 0.045;
      const lg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.38, vw / 2, vh / 2, Math.max(vw, vh) * 0.74);
      lg.addColorStop(0, 'rgba(180,0,0,0)');
      lg.addColorStop(1, `rgba(170,10,10,${a.toFixed(3)})`);
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, vw, vh);
    }
    const h = game.player.hurt;
    if (!h || !game.player.alive || game.reduceMotion) return;   // Reduce motion: no flashes
    const a = Math.min(0.45, (h / 200) * 0.45);
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    g.addColorStop(0, 'rgba(180,0,0,0)');
    g.addColorStop(1, `rgba(170,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  // A bobbing golden ✕ over the current treasure-trail dig spot.
  _drawClueMarker(ox, oy, vw, vh, t) {
    const clue = this.game.clue;
    if (!clue) return;
    const spot = clue.spots[clue.step];
    if (!spot) return;
    const x = spot.x * TILE + TILE / 2 - ox;
    const y = spot.y * TILE + TILE / 2 - oy;
    if (x < -40 || y < -40 || x > vw + 40 || y > vh + 40) return;
    const { ctx } = this;
    const pulse = 0.4 + Math.sin(t * 0.005) * 0.18;
    const bob = Math.sin(t * 0.005) * 4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.font = '800 18px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 4; ctx.strokeText('✕', x, y - 18 - bob);
    ctx.fillStyle = '#ffe88a'; ctx.fillText('✕', x, y - 18 - bob);
  }

  /** A melee cleave, drawn the way its weapon moves (see CLEAVE_STYLE in game.js). */
  _drawCleave(e, ox, oy) {
    const { ctx } = this;
    const t = 1 - e.life / e.maxLife, fade = 1 - t;
    const x0 = e.x - ox, y0 = e.y - oy, tx = e.tx - ox, ty = e.ty - oy;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    if (e.style === 'pierce') {
      // A spear thrust: a bright streak that shoots out through the line, its
      // point leading, then a fading trail with a burst on each foe skewered.
      const ex = e.ex - ox, ey = e.ey - oy, dx = ex - x0, dy = ey - y0;
      const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const head = Math.min(1, t * 3.2), tail = Math.max(0, t * 1.6 - 0.25);
      const hx = x0 + dx * head + ux * 10, hy = y0 + dy * head + uy * 10;
      const sx = x0 + dx * tail, sy = y0 + dy * tail;
      ctx.globalAlpha = fade * 0.45; ctx.strokeStyle = e.color; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.globalAlpha = fade; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      if (head < 1 || t < 0.5) {   // the spear point
        const nx = -uy, ny = ux;
        ctx.globalAlpha = fade; ctx.fillStyle = '#fff6d8';
        ctx.beginPath(); ctx.moveTo(hx + ux * 8, hy + uy * 8); ctx.lineTo(hx + nx * 4, hy + ny * 4); ctx.lineTo(hx - nx * 4, hy - ny * 4); ctx.closePath(); ctx.fill();
      }
      for (const f of [{ x: e.tx, y: e.ty }, ...e.foes]) {
        const along = ((f.x - e.x) * ux + (f.y - e.y) * uy) / len;
        if (head < along) continue;   // the point hasn't reached it yet
        ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x - ox, f.y - oy, 5 + t * 10, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (e.style === 'sweep') {
      // A heavy blade: one wide crescent swept around you, through the target
      // and everything beside it, the leading edge brightest.
      const mid = Math.atan2(ty - y0, tx - x0), spread = 1.25;
      const a0 = mid - spread, a1 = mid - spread + 2 * spread * Math.min(1, t * 2.2);
      const r = e.r * 0.9 + 6;
      ctx.globalAlpha = fade * 0.35; ctx.strokeStyle = e.color; ctx.lineWidth = 14 * fade + 4;
      ctx.beginPath(); ctx.arc(x0, y0, r, a0, a1); ctx.stroke();
      ctx.globalAlpha = fade; ctx.strokeStyle = '#fff1c4'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(x0, y0, r, Math.max(a0, a1 - 0.6), a1); ctx.stroke();
      ctx.globalAlpha = fade * 0.6; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x0, y0, r - 7, a0, a1); ctx.stroke();
    } else if (e.style === 'slam') {
      // A blunt weapon: a shockwave ring bursting out from the target, with
      // cracks shooting outwards, catching the foes around it.
      const R = Math.max(28, e.foes.reduce((m, f) => Math.max(m, Math.hypot(f.x - e.tx, f.y - e.ty)), 0) + 12);
      ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = e.color; ctx.lineWidth = 6 * fade + 1;
      ctx.beginPath(); ctx.ellipse(tx, ty + 8, R * (0.25 + t), R * (0.25 + t) * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = fade * 0.25; ctx.fillStyle = '#ffd9a0';
      ctx.beginPath(); ctx.ellipse(tx, ty + 8, R * (0.2 + t * 0.8), R * (0.2 + t * 0.8) * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fade; ctx.strokeStyle = '#fff1c4'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + 0.4, l = R * Math.min(1, t * 2.5) * 0.8;
        ctx.beginPath(); ctx.moveTo(tx, ty + 8); ctx.lineTo(tx + Math.cos(a) * l, ty + 8 + Math.sin(a) * l * 0.55); ctx.stroke();
      }
    } else if (e.style === 'flurry') {
      // Quick blades: a rapid criss-cross of short cuts on the target and on
      // every foe caught, each cut snapping in after the last.
      for (const [k, f] of [{ x: e.tx, y: e.ty }, ...e.foes].entries()) {
        const fx = f.x - ox, fy = f.y - oy;
        for (let i = 0; i < 3; i++) {
          const d = Math.max(0, Math.min(1, (t - i * 0.12 - k * 0.05) / 0.2));
          if (d <= 0) continue;
          const a = (i % 2 ? 0.7 : -0.7) + k, len = 20;
          const cx = Math.cos(a) * len / 2, cy = Math.sin(a) * len / 2;
          ctx.globalAlpha = fade; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(fx - cx, fy - cy); ctx.lineTo(fx - cx + 2 * cx * d, fy - cy + 2 * cy * d); ctx.stroke();
          ctx.globalAlpha = fade * 0.4; ctx.strokeStyle = e.color; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(fx - cx, fy - cy); ctx.lineTo(fx - cx + 2 * cx * d, fy - cy + 2 * cy * d); ctx.stroke();
        }
      }
    } else {
      // Swords: a crescent slash across the target and each foe caught.
      for (const [k, f] of [{ x: e.tx, y: e.ty }, ...e.foes].entries()) {
        ctx.save();
        ctx.translate(f.x - ox, f.y - oy);
        ctx.rotate(-0.6 + k * 0.9 + (t - 0.5) * 2.1);
        ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = e.color; ctx.lineWidth = 3.2 - t * 1.8;
        ctx.beginPath(); ctx.arc(0, 0, 14, -0.8, 0.8); ctx.stroke();
        ctx.globalAlpha = fade * 0.35; ctx.lineWidth = 7 - t * 4;
        ctx.beginPath(); ctx.arc(0, 0, 14, -0.55, 0.55); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------- Hit feedback on the strike ----------------
  // The game deals a melee blow's damage (its hitsplat, slash, sparks and the
  // foe's flash) the moment the swing starts, but the hero's clip winds up
  // first and lands the weapon later (heroanim.js strikeClock). So the
  // feedback born with a blow waits, unaged, for that blow's strike: the
  // first hitsplat for the main hand's, the second for the off hand's.
  // Effects and particles are throwaway, so the wait is noted on them.
  _holdForStrike(now) {
    const game = this.game;
    this._now = now;
    const clock = strikeClock(game);
    if (clock && clock.blowAt !== this._blowSeen) { this._blowSeen = clock.blowAt; this._splatN = 0; this._slashN = 0; }
    // Only what appears with the blow itself (the game deals it as the swing starts).
    const fresh = !!clock && now - clock.blowAt < 60;
    const hits = clock && clock.hitTimes, last = hits ? hits.length - 1 : 0;
    for (const e of game.effects) {
      if (e._showAt === undefined) {
        e._showAt = 0;
        if (fresh && (e.type === 'hitsplat' ? e.entity !== game.player : HELD_FX.has(e.type))) {
          const n = e.type === 'hitsplat' ? this._splatN++ : e.type === 'slash' ? this._slashN++ : 0;
          e._showAt = hits[Math.min(n, last)];
          e._life0 = e.life;
        }
      }
      if (e._showAt > now) e.life = e._life0;   // held: it doesn't age until shown
      // A blow folded into a number already up (game.js addHitsplat) pops it
      // again on its own strike: otherwise the swing showed no number of its
      // own, which read as a miss.
      if (e.bumps !== e._bumpSeen) {
        e._bumpSeen = e.bumps;
        e._bumpAt = fresh && e.type === 'hitsplat' && e.entity !== game.player ? hits[0] : now;
      }
    }
    for (const p of game.particles) {
      if (p._showAt === undefined) {
        p._showAt = fresh ? hits[0] : 0;
        if (fresh) { p._life0 = p.life; p._x0 = p.x; p._y0 = p.y; p._vy0 = p.vy; }
      }
      if (p._showAt > now) { p.life = p._life0; p.x = p._x0; p.y = p._y0; p.vy = p._vy0; }
    }
  }
  /** A foe's hit flash, held back to the strike of the blow that dealt it. */
  _heldHurt(n, now) {
    const clock = n.hurt > 0 && n === this.game.player.action?.npc ? strikeClock(this.game) : null;
    if (!clock) return n.hurt;
    const t = clock.hitTimes[0];
    return now < t ? 0 : Math.min(200, n.hurt + (t - clock.blowAt));
  }

  _drawProjectiles(ox, oy) {
    const { ctx, game } = this;
    for (const e of game.effects) {
      if (e._showAt > this._now) continue;   // waiting for the weapon to land
      if (e.type === 'classfx') { drawClassEffect(ctx, e, ox, oy); continue; }   // brands bursting, cinders, a ward forming
      if (e.type === 'slash' && e.thrust) {
        // A spear's thrust: a bright straight streak driving through the target
        // along the line of the attack, shooting forward as it fades.
        const t = 1 - e.life / e.maxLife;
        ctx.save();
        ctx.translate(e.x - ox, e.y - oy);
        ctx.rotate(e.ang);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = e.color;
        const head = -10 + t * 26, tail = head - 22 * (1 - t * 0.6);
        ctx.globalAlpha = (1 - t) * 0.9; ctx.lineWidth = 3 - t * 1.6;
        ctx.beginPath(); ctx.moveTo(tail, 0); ctx.lineTo(head, 0); ctx.stroke();
        ctx.globalAlpha = (1 - t) * 0.35; ctx.lineWidth = 7 - t * 4;
        ctx.beginPath(); ctx.moveTo(tail + 6, 0); ctx.lineTo(head, 0); ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (e.type === 'slash') {
        // A crescent arc sweeping through the swing, fading as it goes.
        const t = 1 - e.life / e.maxLife;
        ctx.save();
        ctx.translate(e.x - ox, e.y - oy);
        ctx.rotate(e.ang + e.dir * (t - 0.5) * 2.1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.lineWidth = 3.2 - t * 1.8;
        ctx.beginPath(); ctx.arc(0, 0, 13, -0.8, 0.8); ctx.stroke();
        ctx.globalAlpha = (1 - t) * 0.35;
        ctx.lineWidth = 7 - t * 4;
        ctx.beginPath(); ctx.arc(0, 0, 13, -0.55, 0.55); ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (e.type === 'cleave') { this._drawCleave(e, ox, oy); continue; }
      if (e.type === 'swipe') {
        // Brawler crit: three claw-like swipe marks raked across the monster,
        // drawn in quickly one after another, then fading.
        const c = e.entity.renderCenter ? e.entity.renderCenter() : { x: e.entity.x * TILE, y: e.entity.y * TILE };
        const t = 1 - e.life / e.maxLife;
        const size = e.mega ? 0.95 : 0.75;   // the Brawler's crit swipe marks, kept small too
        ctx.save();
        ctx.translate(c.x - ox, c.y - oy - 8);
        ctx.rotate(-0.75 + e.ang);
        ctx.scale(size, size);
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const draw = Math.max(0, Math.min(1, (t - i * 0.08) / 0.18));   // each mark sweeps in after the last
          if (draw <= 0) continue;
          const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
          const y = (i - 1) * 7, len = 30 - Math.abs(i - 1) * 6;
          const x0 = -len / 2, x1 = x0 + len * draw;
          ctx.globalAlpha = fade;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6.5;
          ctx.beginPath(); ctx.moveTo(x0, y - 2); ctx.quadraticCurveTo((x0 + x1) / 2, y + 3, x1, y + 2); ctx.stroke();
          ctx.strokeStyle = e.mega ? '#ff1010' : '#c8161b'; ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.moveTo(x0, y - 2); ctx.quadraticCurveTo((x0 + x1) / 2, y + 3, x1, y + 2); ctx.stroke();
          ctx.strokeStyle = '#5a0505'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x0 + 2, y - 1); ctx.quadraticCurveTo((x0 + x1) / 2, y + 3.5, x1 - 1, y + 2.5); ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }
      if (e.type === 'blast') {
        // A boss area attack landing: an expanding shock ring.
        const t = 1 - e.life / e.maxLife;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.strokeStyle = '#ff7a3a'; ctx.lineWidth = 6 * (1 - t) + 1;
        ctx.beginPath(); ctx.arc(e.x - ox, e.y - oy, e.r * (0.4 + t * 0.8), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = (1 - t) * 0.3;
        ctx.fillStyle = '#ffb27a';
        ctx.beginPath(); ctx.arc(e.x - ox, e.y - oy, e.r * (0.3 + t * 0.6), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      if (e.type === 'lash') {
        // A Dancer's whip crack: a wavy line that snaps out to the target, then fades.
        const t = 1 - e.life / e.maxLife;
        const reach = Math.min(1, t * 3);
        const x0 = e.x - ox, y0 = e.y - oy, dx = (e.ex - e.x) * reach, dy = (e.ey - e.y) * reach;
        const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        ctx.save();
        ctx.globalAlpha = 1 - t * t;
        ctx.lineCap = 'round';
        const wave = (w, col) => {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
          for (let i = 0; i <= 12; i++) {
            const f = i / 12, amp = Math.sin(f * Math.PI) * 6 * (1 - t);
            const px = x0 + dx * f + nx * Math.sin(f * 9 - t * 20) * amp, py = y0 + dy * f + ny * Math.sin(f * 9 - t * 20) * amp;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        };
        wave(4, '#22304A'); wave(2, e.color);
        if (reach >= 1 && t < 0.6) {   // the crack at the tip
          ctx.fillStyle = '#FFE89A';
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 2.5 : 7 * (1 - t); ctx.lineTo(e.ex - ox + Math.cos(a) * r, e.ey - oy + Math.sin(a) * r); }
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        continue;
      }
      if (e.type === 'ring') {
        // A celebratory burst ring (level ups): gold band inside a navy ink line.
        const t = 1 - e.life / e.maxLife, ease = 1 - (1 - t) * (1 - t);
        const r = e.r0 + (e.r1 - e.r0) * ease;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = 5 * (1 - t) + 1.5;
        ctx.beginPath(); ctx.arc(e.x - ox, e.y - oy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = e.color; ctx.lineWidth = 3 * (1 - t) + 0.8;
        ctx.beginPath(); ctx.arc(e.x - ox, e.y - oy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        continue;
      }
      if (e.type === 'lootfly') {
        // Loot arcs up and into your pack, shrinking as it goes.
        const t = 1 - e.life / e.maxLife;
        const ease = t * t * (3 - 2 * t);
        const x = e.x + (e.ex - e.x) * ease - ox;
        const y = e.y + (e.ey - e.y) * ease - oy - Math.sin(t * Math.PI) * 26;
        const img = itemIconImage(e.id);
        const s = 20 * (1 - t * 0.55);
        const rar = RARITY[e.rarity];
        if (rar && rar.rank > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.5 * (1 - t);
          ctx.fillStyle = rar.color;
          ctx.beginPath(); ctx.arc(x, y, s * 0.7, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (img && img.complete && img.naturalWidth) {
          ctx.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
          ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = '#F5B82E'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.3); ctx.fill();
        }
        continue;
      }
      if (e.type !== 'projectile') continue;
      const t = 1 - e.life / e.maxLife;
      const x = e.x + (e.ex - e.x) * t - ox;
      const y = e.y + (e.ey - e.y) * t - oy;
      if (e.kind === 'arrow') {
        const look = ARROW_LOOK[(e.ammo || '').replace(/_arrow$/, '')] || ARROW_LOOK.default;
        // A fletched arrow arcing out of the bow to its target: it rises and
        // falls along a shallow parabola, tilting with its flight, with a
        // white streak behind it.
        const arc = e.arc || 0;
        const at = (tt) => ({ x: e.x + (e.ex - e.x) * tt - ox, y: e.y + (e.ey - e.y) * tt - oy - Math.sin(tt * Math.PI) * arc });
        const pt = at(t), nx = at(Math.min(1, t + 0.04));
        const ang = Math.atan2(nx.y - pt.y, nx.x - pt.x);
        // streak
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 1; i <= 4; i++) {
          const a = at(Math.max(0, t - i * 0.05)), b = at(Math.max(0, t - (i - 1) * 0.05));
          ctx.globalAlpha = Math.max(0, 0.55 - i * 0.12) / 0.55;
          ctx.strokeStyle = look.trail; ctx.lineWidth = (3.2 - i * 0.55) * (look.glow ? 1.5 : 1);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.translate(pt.x, pt.y); ctx.rotate(ang); ctx.scale(1.5 * look.size, 1.5 * look.size);
        if (look.glow || e.crit) {   // the better arrows (and crits) shine as they fly
          ctx.globalAlpha = 0.35; ctx.fillStyle = e.crit ? '#ffd24a' : look.glow;
          ctx.beginPath(); ctx.arc(3, 0, 5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        // shaft (navy ink under a wood core, matching the sticker style)
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(3, 0); ctx.stroke();
        ctx.strokeStyle = look.shaft; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(3, 0); ctx.stroke();
        // fletching, in the arrow's own colour
        ctx.fillStyle = look.fletch; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 0.6;
        path2(ctx, [[-10, 0], [-6.5, -3], [-5, 0]]); ctx.fill(); ctx.stroke();
        path2(ctx, [[-10, 0], [-6.5, 3], [-5, 0]]); ctx.fill(); ctx.stroke();
        // head: the arrow's metal (gold on a crit)
        ctx.fillStyle = e.crit ? '#ffd24a' : look.head;
        path2(ctx, look.barbed ? [[7.5, 0], [1.5, -3.4], [3, 0], [1.5, 3.4]] : [[7, 0], [1.5, -2.6], [1.5, 2.6]]); ctx.fill();
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.restore();
        continue;
      }
      if (e.kind === 'bullet') {
        const ang = Math.atan2(e.ey - e.y, e.ex - e.x);
        ctx.save(); ctx.lineCap = 'round';
        if (e.gun === 'rifle') {
          // The Sniper's round: a long gold tracer with a pale vapour trail
          // behind it, and a copper slug at its head.
          const tt = Math.max(0, t - 0.6);   // a long streak: the round is quick, the trail stays in sight
          const tx = e.x + (e.ex - e.x) * tt - ox, ty = e.y + (e.ey - e.y) * tt - oy;
          ctx.globalAlpha = 0.35; ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 4.5;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = e.crit ? '#ffd24a' : '#ffe28a'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(tx + (x - tx) * 0.35, ty + (y - ty) * 0.35); ctx.lineTo(x, y); ctx.stroke();
          ctx.translate(x, y); ctx.rotate(ang);
          ctx.fillStyle = '#c8763a'; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.quadraticCurveTo(2.5, -1.9, -2.5, -1.6); ctx.lineTo(-2.5, 1.6); ctx.quadraticCurveTo(2.5, 1.9, 4.5, 0); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffe2b0'; ctx.fillRect(-1.5, -0.9, 3.2, 0.7);   // a glint along the slug
        } else {
          // The Pistoler's round: a tiny brass pellet with a faint, short streak
          // (pistols fire four shots a beat, so each one stays small).
          const tt = Math.max(0, t - 0.22);   // fast, so the faint streak trails a little further behind
          const tx = e.x + (e.ex - e.x) * tt - ox, ty = e.y + (e.ey - e.y) * tt - oy;
          ctx.globalAlpha = 0.55; ctx.strokeStyle = e.crit ? '#ffd24a' : '#fff0c0'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalAlpha = 1; ctx.fillStyle = e.crit ? '#ffd24a' : '#e2b04a'; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      if (e.kind === 'coin') {
        // A Merchant's thrown coin: a gold disc flipping end over end.
        const flip = Math.abs(Math.cos(t * 30));
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = '#f5b82e'; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, 4.5 * Math.max(0.25, flip), 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (flip > 0.5) { ctx.fillStyle = '#ffe9a6'; ctx.beginPath(); ctx.arc(-1, -1, 1.4, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        continue;
      }
      if (e.kind === 'shuriken') {
        // A four-pointed throwing star, spinning as it flies.
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 28); ctx.scale(1.3, 1.3);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 1.8 : 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath();
        ctx.fillStyle = e.color; ctx.fill();
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#22304A'; ctx.beginPath(); ctx.arc(0, 0, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      // A Zealot's bolt waits in the censer until it's flung, then flies from it (censerSwing.js).
      const cz = censerBolt(e, t, game, this._now, ox, oy);
      if (cz && cz.t < 0) continue;
      // A Priest's or Zealot's own element: a beam, a falling blade, a ground circle... (classfx.js).
      if (drawClassShot(ctx, cz ? cz.e : e, cz ? cz.t : t, ox, oy, game)) continue;
      // Magic bolt: a glowing orb in its element's colour with a fading trail of
      // embers behind it; a crit's is half as big again (and brighter, game.js).
      const k = e.crit ? 1.5 : 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3;
      for (let i = 1; i <= 3; i++) {
        const tt = Math.max(0, t - i * 0.1);
        const tx = e.x + (e.ex - e.x) * tt - ox, ty = e.y + (e.ey - e.y) * tt - oy;
        ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(tx, ty, (2.6 - i * 0.6) * k, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(x, y, 3.6 * k, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x, y, 6 * k, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  _drawParticles(ox, oy) {
    const { ctx, game } = this;
    if (!game.particles || !game.particles.length) return;
    for (const p of game.particles) {
      if (p._showAt > this._now) continue;   // waiting for the weapon to land
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      if (p.add) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      // Painted leaves, petals, dust puffs and embers (fxart.js), once loaded.
      const art = p.art && (p.art.startsWith('dust') ? fxTinted(`particle-${p.art}`, p.color) : fxImage(`particle-${p.art}`));
      if (art) {
        if (p.add) ctx.globalCompositeOperation = 'source-over';   // the sticker carries its own glow
        ctx.save(); ctx.translate(p.x - ox, p.y - oy);
        if (p.shape === 'leaf') {
          // Tumbling: turn with the spin and squash one axis to fake a flip.
          ctx.rotate(p.rot || 0);
          ctx.scale(1, Math.abs(Math.cos((p.rot || 0) * 1.7)) * 0.8 + 0.2);
          drawFx(ctx, art, 0, 0, p.size * 5);
        } else if (p.art.startsWith('dust')) {
          ctx.globalAlpha = a * 0.7;   // soft, and swelling as it fades
          drawFx(ctx, art, 0, 0, p.size * (4 + (1 - a) * 2));
        } else drawFx(ctx, art, 0, 0, p.size * 3);
        ctx.restore();
        continue;
      }
      if (p.shape === 'confetti' || p.shape === 'leaf') {
        // Flat pieces that tumble: squash one axis with the spin to fake a flip.
        ctx.save(); ctx.translate(p.x - ox, p.y - oy); ctx.rotate(p.rot || 0);
        ctx.scale(1, Math.abs(Math.cos((p.rot || 0) * 1.7)) * 0.8 + 0.2);
        if (p.shape === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.4, p.size * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x - ox, p.y - oy, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.add) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  // Bake all static terrain (everything but the animated water surface) to a
  // full-world offscreen canvas. Returns null in headless/no-DOM environments.
  /** The chunked terrain cache: a map of baked chunks, or null without a DOM. */
  _buildTerrainCache() {
    if (typeof document === 'undefined' || !document.createElement) return null;
    return { chunks: new Map(), order: [] };
  }

  /** Bake one TERRAIN_CHUNK x TERRAIN_CHUNK tile chunk to its own canvas. */
  _bakeChunk(cx0, cy0) {
    const w = this.game.world;
    let cnv, g;
    try {
      cnv = document.createElement('canvas');
      cnv.width = TERRAIN_CHUNK * TILE;
      cnv.height = TERRAIN_CHUNK * TILE;
      g = cnv.getContext('2d');
    } catch { return null; }
    if (!g) return null;
    const tx0 = cx0 * TERRAIN_CHUNK, ty0 = cy0 * TERRAIN_CHUNK;
    const tx1 = Math.min(w.width, tx0 + TERRAIN_CHUNK), ty1 = Math.min(w.height, ty0 + TERRAIN_CHUNK);
    for (let y = ty0; y < ty1; y++) {
      for (let x = tx0; x < tx1; x++) {
        const t = w.terrainAt(x, y);
        const sx = (x - tx0) * TILE, sy = (y - ty0) * TILE;
        // Water's painted texture is baked here too: the animated layer over it
        // (_drawWaterOverlay) then only adds the swell, shimmer and foam.
        if (t === TERRAIN.WATER) { if (!this._groundTile(g, t, x, y, sx, sy)) { g.fillStyle = 'rgb(122,190,232)'; g.fillRect(sx, sy, TILE + 1, TILE + 1); } continue; }
        const h = hash(x, y);
        if (this._groundTile(g, t, x, y, sx, sy)) {
          // Painted ground: keep the odd wildflower and the crisp path edges.
          if ((t === TERRAIN.GRASS || t === TERRAIN.DARKGRASS) && h > 0.93) {
            g.fillStyle = ['#EF476F', '#F5B82E', '#5FAEE3', '#FFFFFF'][Math.floor(h * 97) % 4];
            g.beginPath(); g.arc(sx + 8 + h * 12, sy + 10, 1.6, 0, 6.3); g.fill();
          }
          if (t === TERRAIN.STONE) this._tileEdges(g, w, t, x, y, sx, sy);   // paths blend softly instead
          continue;
        }
        const base = TERRAIN_RGB[t] || TERRAIN_RGB[TERRAIN.GRASS];
        const j = (h - 0.5) * 10;
        g.fillStyle = `rgb(${clamp8(base[0] + j)},${clamp8(base[1] + j)},${clamp8(base[2] + j)})`;
        g.fillRect(sx, sy, TILE + 1, TILE + 1);
        this._tileDetail(g, t, x, y, sx, sy, h);
        if (t === TERRAIN.STONE) this._tileEdges(g, w, t, x, y, sx, sy);
      }
    }
    // Soft edges between grounds, small ground details, contact shadows and
    // the water's extras (terrainfx.js), baked into the chunk once.
    // It runs a few rows at a time over the next frames (see _polishChunk).
    const fx = this.tfx || (this.tfx = new TerrainFx());
    cnv.fx = null;
    cnv.fxJob = fx.bakeSteps(g, w, tx0, ty0, tx1, ty1, (sg, t) => this._groundFill(sg, t), { low: !!this.game.lowFx });
    return cnv;
  }

  /** Carry on a chunk's polish bake for up to `ms` milliseconds; true once it's done. */
  _polishChunk(cv, ms) {
    if (!cv.fxJob) return true;
    const end = performance.now() + ms;
    try {
      let r;
      do r = cv.fxJob.next(); while (!r.done && performance.now() < end);
      if (!r.done) return false;
      cv.fx = r.value;
    } catch (err) { console.warn('terrain polish skipped', err); }
    cv.fxJob = null;
    return true;
  }

  /** The fill for ground type t: its painted texture as a repeating pattern, or its plain colour. */
  _groundFill(g, t) {
    const tex = this.groundTex;
    if (tex && tex.ready && tex[t] && g.createPattern) {
      const pats = this._groundPats || (this._groundPats = {});
      const p = pats[t] || (pats[t] = g.createPattern(tex[t], 'repeat'));
      if (p) return p;
    }
    const c = t === TERRAIN.WATER ? [122, 190, 232] : TERRAIN_RGB[t] || TERRAIN_RGB[TERRAIN.GRASS];
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  _chunk(cx, cy) {
    const cache = this.terrainCanvas;
    // Low graphics bakes a lighter scatter: re-bake when it's switched (or new ground art arrives).
    const sig = this.tfx ? this.tfx.signature(this.game.lowFx) : '';
    if (cache.sig !== sig) { if (cache.sig !== undefined) { cache.chunks.clear(); cache.order.length = 0; } cache.sig = sig; }
    const k = cx + ',' + cy;
    let cv = cache.chunks.get(k);
    if (!cv) {
      cv = this._bakeChunk(cx, cy);
      if (!cv) return null;
      cache.chunks.set(k, cv);
      cache.order.push(k);
      // Keep memory in check: drop the least recently baked chunks.
      while (cache.order.length > TERRAIN_CHUNK_CAP) cache.chunks.delete(cache.order.shift());
    }
    return cv;
  }

  /** Blit the visible terrain chunks, then pre-bake one neighbour so walking
   *  into a new chunk doesn't stall a frame. */
  _drawTerrainChunks(ox, oy, vw, vh) {
    const { ctx, game } = this;
    const span = TERRAIN_CHUNK * TILE;
    const maxCx = Math.ceil(game.world.width / TERRAIN_CHUNK) - 1, maxCy = Math.ceil(game.world.height / TERRAIN_CHUNK) - 1;
    const c0x = Math.max(0, Math.floor(ox / span)), c1x = Math.min(maxCx, Math.floor((ox + vw) / span));
    const c0y = Math.max(0, Math.floor(oy / span)), c1y = Math.min(maxCy, Math.floor((oy + vh) / span));
    const vis = this._visChunks || (this._visChunks = []);
    vis.length = 0;
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const cv = this._chunk(cx, cy);
        if (!cv) continue;
        vis.push(cv);
        // Copy only the part of the chunk that's on screen.
        const wx = cx * span, wy = cy * span;
        const sx = Math.max(0, ox - wx), sy = Math.max(0, oy - wy);
        const sw = Math.min(span, ox + vw - wx) - sx, sh = Math.min(span, oy + vh - wy) - sy;
        if (sw > 0 && sh > 0) ctx.drawImage(cv, sx, sy, sw, sh, wx + sx - ox, wy + sy - oy, sw, sh);
      }
    }
    // Polish within a small time budget per frame: chunks on screen first,
    // then the ring around the view (low graphics gets less time per frame).
    const budget = game.lowFx ? 3 : 5, end = performance.now() + budget;
    let left = true;
    for (const cv of vis) if (cv.fxJob && !(left = this._polishChunk(cv, end - performance.now()))) break;
    // Pre-bake the first missing chunk in a ring around the view (one per frame).
    for (let cy = c0y - 1; cy <= c1y + 1; cy++) {
      for (let cx = c0x - 1; cx <= c1x + 1; cx++) {
        if (cx < 0 || cy < 0 || cx > maxCx || cy > maxCy) continue;
        const cv = this.terrainCanvas.chunks.get(cx + ',' + cy);
        if (!cv) { this._chunk(cx, cy); return; }
        if (left && cv.fxJob && performance.now() < end) left = this._polishChunk(cv, end - performance.now());
      }
    }
  }

  _drawWaterOverlay(x0, y0, x1, y1, ox, oy, timeMs) {
    const { ctx, game } = this;
    const w = game.world;
    // The shimmer is slow, so redraw it into an offscreen layer ~11 times a
    // second (or when the view crosses a tile) and blit that layer every frame.
    // The shoreline foam (terrainfx.js) is painted into the same layer: drawn
    // straight to the screen it cost two more full-screen blits every frame.
    // Returns true when the foam went in.
    if (typeof document !== 'undefined' && document.createElement) {
      const dpr = (ctx.getTransform ? ctx.getTransform().a : 1) || 1;
      const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
      const wc = this._waterCache || (this._waterCache = { cv: document.createElement('canvas'), t: -1e9 });
      const g = wc.cv.getContext && wc.cv.getContext('2d');
      if (g) {
        if (wc.x0 !== x0 || wc.y0 !== y0 || wc.cols !== cols || wc.rows !== rows || wc.dpr !== dpr || timeMs - wc.t >= 90 || timeMs < wc.t) {
          const W = Math.ceil(cols * TILE * dpr), H = Math.ceil(rows * TILE * dpr);
          // Only the box that holds water or foam is cleared, painted and
          // copied to the screen: away from the sea that is a shoreline's
          // strip, not a full-screen layer redrawn ~11 times a second.
          const old = wc.box, box = (wc.box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
          // The view's width in tiles flickers by one as the camera scrolls and
          // the zoom eases in fights: resizing the layer to fit each time remade
          // it (on a phone, a fresh GPU surface) on most frames of a fight. So it
          // is made a couple of tiles roomier and only remade when too small (or
          // far too big); a new size or scale just wipes it. Only its top-left
          // W x H is ever used.
          const cv = wc.cv;
          if (cv.width < W || cv.height < H || cv.width * cv.height > 2 * W * H) {
            const pad = Math.ceil(2 * TILE * dpr);
            cv.width = W + pad; cv.height = H + pad;
          } else if (wc.W !== W || wc.H !== H || wc.dpr !== dpr) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); }
          else if (old && old.x1 > old.x0) {
            // A box that reached the layer's right or bottom edge also clears the
            // spare room past it: the edge tiles' 1px overlap lands there and,
            // left to build up, would show as a line at the screen's edge (the
            // copy's smoothing reads one pixel past its source) at the world's edge.
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(old.x0, old.y0, (old.x1 >= cols * TILE ? cv.width / dpr : old.x1) - old.x0, (old.y1 >= rows * TILE ? cv.height / dpr : old.y1) - old.y0);
          }
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          wc.any = false;
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              if (w.terrainAt(x, y) !== TERRAIN.WATER) continue;
              this._water(g, w, x, y, (x - x0) * TILE, (y - y0) * TILE, timeMs, true);
              growBox(box, (x - x0) * TILE, (y - y0) * TILE, TILE + 1, TILE + 1);
              wc.any = true;
            }
          }
          if (this.tfx && this._visChunks && this.tfx.drawFoam(g, this._visChunks, x0 * TILE, y0 * TILE, cols * TILE, rows * TILE, timeMs, game.lowFx || game.fxTrim, box)) wc.any = true;
          // A pixel of slack all round (the swell overlaps by one, smoothing
          // reaches a little further), kept inside the layer.
          if (wc.any) {
            box.x0 = Math.max(0, Math.floor(box.x0) - 2); box.y0 = Math.max(0, Math.floor(box.y0) - 2);
            box.x1 = Math.min(cols * TILE, Math.ceil(box.x1) + 2); box.y1 = Math.min(rows * TILE, Math.ceil(box.y1) + 2);
          }
          Object.assign(wc, { x0, y0, cols, rows, dpr, t: timeMs, W, H });
        }
        const b = wc.box;
        if (wc.any && b && b.x1 > b.x0 && b.y1 > b.y0) {
          // Same mapping as copying the whole layer (cols*TILE wide on screen), just a part of it
          // (of the W x H corner that was painted: the canvas itself is a little roomier).
          const kx = wc.W / (cols * TILE), ky = wc.H / (rows * TILE);
          ctx.drawImage(wc.cv, b.x0 * kx, b.y0 * ky, (b.x1 - b.x0) * kx, (b.y1 - b.y0) * ky,
            x0 * TILE - ox + b.x0, y0 * TILE - oy + b.y0, b.x1 - b.x0, b.y1 - b.y0);
        }
        return true;
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (w.terrainAt(x, y) !== TERRAIN.WATER) continue;
        this._water(ctx, w, x, y, Math.round(x * TILE - ox), Math.round(y * TILE - oy), timeMs);
      }
    }
  }

  // ---------------- Terrain ----------------
  _drawTerrain(x0, y0, x1, y1, ox, oy, timeMs) {
    const { ctx, game } = this;
    const w = game.world;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = w.terrainAt(x, y);
        const sx = Math.round(x * TILE - ox), sy = Math.round(y * TILE - oy);
        if (t === TERRAIN.WATER) { this._water(ctx, w, x, y, sx, sy, timeMs); continue; }
        const base = TERRAIN_RGB[t] || TERRAIN_RGB[TERRAIN.GRASS];
        const h = hash(x, y);
        const j = (h - 0.5) * 10;
        ctx.fillStyle = `rgb(${clamp8(base[0] + j)},${clamp8(base[1] + j)},${clamp8(base[2] + j)})`;
        ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
        this._tileDetail(ctx, t, x, y, sx, sy, h);
        this._tileEdges(ctx, w, t, x, y, sx, sy);
      }
    }
  }

  _tileDetail(ctx, t, x, y, sx, sy, h) {
    if (t === TERRAIN.GRASS || t === TERRAIN.DARKGRASS) {
      // Low-frequency patchiness so large areas of grass aren't flat.
      const lf = hash(Math.floor(x / 4), Math.floor(y / 4));
      ctx.fillStyle = lf > 0.62 ? 'rgba(255,255,230,0.16)' : lf < 0.38 ? 'rgba(90,150,90,0.10)' : 'rgba(0,0,0,0)';
      if (lf > 0.62 || lf < 0.38) ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 7 + i, y * 13 - i), hy = hash(x * 3 - i, y * 11 + i);
        const px = sx + hx * (TILE - 6) + 3, py = sy + hy * (TILE - 6) + 3;
        ctx.fillStyle = 'rgba(70,140,80,0.32)';
        ctx.fillRect(px, py - 3, 1.4, 3);
        ctx.fillRect(px + 1.6, py - 4, 1.4, 4);
        ctx.fillStyle = 'rgba(240,255,220,0.6)'; // sunlit blade tip
        ctx.fillRect(px + 1.6, py - 4, 1.4, 1.3);
      }
      // tiny pastel wildflowers in the marker-pop colours
      if (h > 0.9) {
        ctx.fillStyle = ['#EF476F', '#F5B82E', '#5FAEE3', '#FFFFFF'][Math.floor(h * 97) % 4];
        ctx.beginPath(); ctx.arc(sx + 8 + h * 12, sy + 10, 1.6, 0, 6.3); ctx.fill();
      }
    } else if (t === TERRAIN.PATH || t === TERRAIN.SAND) {
      ctx.fillStyle = t === TERRAIN.PATH ? 'rgba(190,160,120,0.45)' : 'rgba(210,186,140,0.45)';
      for (let i = 0; i < 4; i++) {
        const px = sx + hash(x * 5 + i, y) * TILE, py = sy + hash(x, y * 5 + i) * TILE;
        ctx.fillRect(px, py, 2, 2);
      }
      if (t === TERRAIN.SAND && h > 0.8) { // occasional pebble + shell fleck
        ctx.fillStyle = 'rgba(120,108,86,0.55)';
        ctx.beginPath(); ctx.arc(sx + 6 + h * 14, sy + 18 - h * 8, 1.6, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(255,250,238,0.5)';
        ctx.beginPath(); ctx.arc(sx + 20 - h * 10, sy + 8 + h * 6, 1, 0, 6.3); ctx.fill();
      }
    } else if (t === TERRAIN.STONE) {
      // Pastel Peranakan floor tiles: cream paving with soft grout, and on a
      // checkerboard a small four-petal motif in one of the marker pastels.
      // Mostly plain cream, a gentle warm checker, and every third tile in each
      // direction a small four-petal motif in one of the marker pastels.
      if ((x + y) % 2 === 0) { ctx.fillStyle = 'rgba(250,230,205,0.45)'; ctx.fillRect(sx, sy, TILE + 1, TILE + 1); }
      if (x % 3 === 0 && y % 3 === 0) {
        const [bg, pop] = TILE_POPS[Math.floor(hash(x, y) * TILE_POPS.length)];
        const c = TILE / 2;
        ctx.fillStyle = bg; ctx.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = pop; ctx.globalAlpha = 0.45;
        for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) { ctx.beginPath(); ctx.ellipse(sx + c + dx, sy + c + dy, dx ? 3.4 : 2, dy ? 3.4 : 2, 0, 0, 6.3); ctx.fill(); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(sx + c, sy + c, 1.8, 0, 6.3); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(34,48,74,0.10)'; ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, TILE, TILE);
    } else if (t === TERRAIN.WOOD) {
      ctx.strokeStyle = 'rgba(60,40,20,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy + TILE / 2); ctx.lineTo(sx + TILE, sy + TILE / 2); ctx.stroke();
    }
  }

  // Crisp the edge of paths/stone against grass.
  _tileEdges(ctx, w, t, x, y, sx, sy) {
    if (t !== TERRAIN.PATH && t !== TERRAIN.STONE) return;
    ctx.fillStyle = 'rgba(34,48,74,0.12)';
    const grassy = (tt) => tt === TERRAIN.GRASS || tt === TERRAIN.DARKGRASS;
    if (grassy(w.terrainAt(x, y - 1))) ctx.fillRect(sx, sy, TILE + 1, 2);
    if (grassy(w.terrainAt(x, y + 1))) ctx.fillRect(sx, sy + TILE - 1, TILE + 1, 2);
    if (grassy(w.terrainAt(x - 1, y))) ctx.fillRect(sx, sy, 2, TILE + 1);
    if (grassy(w.terrainAt(x + 1, y))) ctx.fillRect(sx + TILE - 1, sy, 2, TILE + 1);
  }

  _water(ctx, w, x, y, sx, sy, timeMs, soft = false) {
    // With soft shores (terrainfx.js) the baked waterline and foam meet sand and
    // grass; only quays and bridges (stone, wood) keep a crisp foam line.
    const land = soft ? (tt) => tt === TERRAIN.STONE || tt === TERRAIN.WOOD : (tt) => tt !== TERRAIN.WATER;
    const dry = (tt) => tt !== TERRAIN.WATER;
    const shore = dry(w.terrainAt(x, y - 1)) || dry(w.terrainAt(x, y + 1)) || dry(w.terrainAt(x - 1, y)) || dry(w.terrainAt(x + 1, y));
    const wave = Math.sin((x + y) * 0.7 + timeMs * 0.0016) * 8 + Math.sin((x - y) * 0.5 + timeMs * 0.0011) * 6;
    // Deeper water reads darker/greener; shallows near shore are brighter teal.
    const d = shore && !soft ? 18 : 0;   // soft shores: no brighter rim to give the tile's square away
    // The animated layer (soft) sits over terrain chunks that already hold the
    // painted water, so it skips repainting it under every tile's swell.
    const tex = this.groundTex;
    if (soft && tex && tex.ready && tex[TERRAIN.WATER] ? true : this._groundTile(ctx, TERRAIN.WATER, x, y, sx, sy)) {
      // Painted water: the swell rides on top as a soft light/dark wash.
      const k = (wave + d * 0.6) / 14;
      ctx.fillStyle = k > 0 ? swellFill(0, Math.min(0.22, k * 0.12)) : swellFill(1, Math.min(0.14, -k * 0.08));
      ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
    } else {
      ctx.fillStyle = `rgb(${(122 + d + wave * 0.5) | 0},${(190 + d * 0.6 + wave * 0.6) | 0},${(232 + d * 0.3 + wave * 0.4) | 0})`;
      ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
    }
    // caustic shimmer (two drifting bands)
    const hl = (Math.sin((x * 1.3 + y * 0.7) + timeMs * 0.002) + 1) / 2;
    if (hl > 0.55) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      const yy = sy + ((timeMs * 0.02 + x * 9) % TILE);
      ctx.fillRect(sx + 3, yy, TILE - 6, 1.6);
    }
    const hl2 = (Math.sin((x * 0.6 - y * 1.1) + timeMs * 0.0013) + 1) / 2;
    if (hl2 > 0.7) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      const yy = sy + ((timeMs * 0.013 + y * 7) % TILE);
      ctx.fillRect(sx + 5, yy, TILE - 12, 1.2);
    }
    // foam on shore edges
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    if (land(w.terrainAt(x, y - 1))) ctx.fillRect(sx, sy, TILE + 1, 2);
    if (land(w.terrainAt(x, y + 1))) ctx.fillRect(sx, sy + TILE - 1, TILE + 1, 2);
    if (land(w.terrainAt(x - 1, y))) ctx.fillRect(sx, sy, 2, TILE + 1);
    if (land(w.terrainAt(x + 1, y))) ctx.fillRect(sx + TILE - 1, sy, 2, TILE + 1);
  }

  /** Boss area attacks: red tiles with a fill that grows toward the moment it lands. */
  _drawHazards(ox, oy, timeMs) {
    const { ctx, game } = this;
    if (!game.hazards || !game.hazards.length) return;
    const now = performance.now();
    for (const h of game.hazards) {
      const k = Math.max(0, Math.min(1, (now - h.start) / h.dur));
      const x = (h.cx - h.r) * TILE - ox, y = (h.cy - h.r) * TILE - oy, w = (h.r * 2 + 1) * TILE;
      // A smooth throb that quickens as the blow nears, fading in as it's marked (creatureanim.js).
      const pulse = hazardPulse(now - h.start, h.dur);
      ctx.save();
      ctx.globalAlpha = hazardIn(now - h.start);
      ctx.fillStyle = `rgba(239,71,111,${(0.16 + pulse * 0.1).toFixed(3)})`;
      ctx.fillRect(x, y, w, w);
      // The inner square fills outward from the centre: when it reaches the edge, it hits.
      const iw = w * k;
      ctx.fillStyle = `rgba(192,57,43,${(0.22 + k * 0.25).toFixed(3)})`;
      ctx.fillRect(x + (w - iw) / 2, y + (w - iw) / 2, iw, iw);
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -timeMs * 0.03;
      ctx.strokeStyle = '#C0392B'; ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, w - 3);
      ctx.setLineDash([]);
      if (h.safe) drawSafeZone(ctx, h, ox, oy, timeMs, TILE);   // a safe circle's green hole
      // Warning sign in the middle (once per pattern piece, not on every single tile).
      if (h.sign === false) { ctx.restore(); continue; }
      const cx = x + w / 2, cy = y + w / 2;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 8 + pulse * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#C0392B'; ctx.font = '900 13px Nunito,"Trebuchet MS",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', cx, cy + 1);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }

  /** The locked-on ring on the ground under the foe you're fighting. */
  _lockOn(cx, cy, sc, timeMs) {
    const img = this._lockImg || (typeof Image !== 'undefined' ? (this._lockImg = Object.assign(new Image(), { src: 'assets/icons/ui-lockon.webp' })) : null);
    if (!img || !img.complete || !img.naturalWidth) return;
    const pulse = 1 + Math.sin(timeMs * 0.008) * 0.05;
    const w = 40 * sc * pulse, h = w * img.naturalHeight / img.naturalWidth;
    this.ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }

  _drawGroundDecals(ox, oy) {
    const { ctx, game } = this;
    // Aiming a skill (dragging off its button): an arrow on the ground the way
    // it's pointed, and a ring on the foe it will go for.
    const aim = game.aim;
    if (aim && aim.dir && game.player.alive) {
      const c = game.player.renderCenter();
      const sx = c.x - ox, sy = c.y - oy + 8;
      const len = Math.min(10, Math.max(4, game.attackRange())) * TILE;
      const ex = sx + aim.dir.x * len, ey = sy + aim.dir.y * len * 0.8;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(34,48,74,0.35)'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      const a = Math.atan2(ey - sy, ex - sx);
      ctx.fillStyle = 'rgba(255,214,120,0.95)';
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 12, ey + Math.sin(a) * 12);
      ctx.lineTo(ex + Math.cos(a + 2.4) * 12, ey + Math.sin(a + 2.4) * 12);
      ctx.lineTo(ex + Math.cos(a - 2.4) * 12, ey + Math.sin(a - 2.4) * 12);
      ctx.closePath(); ctx.fill();
      if (aim.foe && aim.foe.alive) {
        const f = aim.foe.renderCenter(), sc = aim.foe.def.scale || 1;
        ctx.strokeStyle = '#C0392B'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(f.x - ox, f.y - oy + 12 * sc, 15 * sc, 6.5 * sc, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    if (game.input && game.input.inside) {
      const tile = game.camera.screenToTile(game.input.mx, game.input.my);
      if (game.world.inBounds(tile.x, tile.y)) {
        const sx = tile.x * TILE - ox, sy = tile.y * TILE - oy;
        ctx.fillStyle = 'rgba(255,240,150,0.12)';
        ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
        ctx.strokeStyle = 'rgba(255,235,130,0.9)'; ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
      }
    }
    // Pulsing ground ring under the hovered target: coral for a foe, teal for
    // friendly NPCs and usable objects — click feedback before you commit.
    const hv = game.hover;
    if (hv) {
      const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.12;
      let cx, cy, rx, col;
      if (hv.npc && hv.npc.alive) {
        const c = hv.npc.renderCenter();
        const sc = hv.npc.def.scale || 1;
        cx = c.x - ox; cy = c.y - oy + 12 * sc; rx = 11 * sc * pulse;
        col = hv.npc.attackable ? 'rgba(255,122,90,0.85)' : 'rgba(127,224,208,0.85)';
      } else if (hv.obj && !hv.obj.depleted) {
        cx = hv.obj.x * TILE + TILE / 2 - ox; cy = hv.obj.y * TILE + TILE * 0.72 - oy;
        rx = 12 * pulse; col = 'rgba(255,215,115,0.8)';
      }
      if (col) {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.25; ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    const p = game.player;
    if (p.path.length) {   // a clicked route (joystick steering has no destination)
      const dest = p.path[p.path.length - 1];
      const cx = dest.x * TILE + TILE / 2 - ox, cy = dest.y * TILE + TILE / 2 - oy;
      const pulse = 4 + Math.sin(performance.now() * 0.012) * 1.5;
      ctx.strokeStyle = '#ffe66a'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - pulse, cy - pulse); ctx.lineTo(cx + pulse, cy + pulse);
      ctx.moveTo(cx + pulse, cy - pulse); ctx.lineTo(cx - pulse, cy + pulse);
      ctx.stroke();
    }
  }

  _drawVignette(vw, vh, night = 0) {
    // Baked once per viewport size (a small canvas stretched to fit), and a
    // little deeper after dark.
    if (!this._vig || this._vig.vw !== vw || this._vig.vh !== vh) this._vig = { vw, vh, img: buildVignette(vw, vh) };
    // After dark the light pass lays it into its light map instead (lighting.js);
    // the flag is used up here, so a low graphics frame never misses it.
    const inMap = this.lights.vignetted;
    this.lights.vignetted = false;
    if (!this._vig.img || inMap) return;
    const { ctx } = this;
    ctx.globalAlpha = 0.5 + 0.45 * night;
    ctx.drawImage(this._vig.img, 0, 0, vw, vh);
    ctx.globalAlpha = 1;
  }

  // ---------------- Overhead UI (bars, hitsplats, name) ----------------
  _drawNodeLabels(ox, oy, objs = this.game.world.objects) {
    const { ctx, game } = this;
    const vw = game.camera.viewW, vh = game.camera.viewH;
    ctx.font = '10px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // Settings > World labels: in Smart mode only the hovered, worked and
    // nearest workable nodes get a pill (see worldlabels.js); Off draws none.
    const mode = labelMode(game);
    for (const o of mode === 'off' ? [] : objs) {
      const t = o.def.type;
      if (t !== 'tree' && t !== 'rock' && t !== 'fishing') continue;
      if (o.depleted || !o.def.label) continue;
      const cx = o.x * TILE + TILE / 2 - ox;
      const cy = o.y * TILE + TILE / 2 - oy;
      if (cx < -30 || cx > vw + 30 || cy < -20 || cy > vh + 20) continue;
      const alpha = objectLabelAlpha(game, o, mode);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      const yy = cy - (t === 'tree' ? 30 : t === 'rock' ? 18 : 16);
      const label = o.def.label;
      const wpx = ctx.measureText(label).width + 8;
      // Little white sticker pills, matching the HUD.
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - wpx / 2, yy - 10, wpx, 13, 6.5); ctx.fill(); }
      else ctx.fillRect(cx - wpx / 2, yy - 10, wpx, 13);
      ctx.strokeStyle = 'rgba(34,48,74,0.35)'; ctx.lineWidth = 1;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - wpx / 2, yy - 10, wpx, 13, 6.5); ctx.stroke(); }
      ctx.fillStyle = t === 'tree' ? '#1F7A3D' : t === 'fishing' ? '#1F6FA8' : '#5E594F';
      ctx.fillText(label, cx, yy);
      ctx.globalAlpha = 1;
    }
    // Directional signposts (which way to each area): the HUD's sticker card
    // (paper, a navy line, a white die-cut rim and a small drop shadow), so a
    // signpost reads as one family with the banners and toasts.
    ctx.font = '800 11px Nunito,"Trebuchet MS",sans-serif';
    for (const o of objs) {
      if (!o.sign) continue;
      const cx = o.x * TILE + TILE / 2 - ox, cy = o.y * TILE + TILE / 2 - oy;
      if (cx < -40 || cx > vw + 40 || cy < -20 || cy > vh + 20) continue;
      const yy = cy - 16;
      const wpx = ctx.measureText(o.sign).width + 14, x0 = cx - wpx / 2, y0 = yy - 12;
      const plate = (dx, dy) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0 + dx, y0 + dy, wpx, 17, 8.5); else ctx.rect(x0 + dx, y0 + dy, wpx, 17); };
      ctx.fillStyle = 'rgba(34,48,74,0.2)'; plate(0, 2.5); ctx.fill();
      plate(0, 0);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#FFFCF5'; ctx.fill();
      ctx.strokeStyle = '#22304A'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = o.sign.includes('Wilderness') ? '#C0392B' : '#22304A'; ctx.fillText(o.sign, cx, yy);
    }
  }

  /** Note a label's spot (centre x, baseline y, half width) for this frame.
   *  The list is kept between frames and reset by count, so placing labels
   *  makes no garbage. */
  _place(x, y, hw) {
    const r = this._placed[this._nPlaced] || (this._placed[this._nPlaced] = { x: 0, y: 0, hw: 0 });
    r.x = x; r.y = y; r.hw = hw;
    this._nPlaced++;
  }

  /** True when a label at (x, y) this wide would print over one placed already
   *  (labels are name pills a PILL_ROW tall, centred on y). */
  _placeHits(x, y, hw) {
    for (let i = 0; i < this._nPlaced; i++) {
      const r = this._placed[i];
      if (Math.abs(r.x - x) < r.hw + hw && Math.abs(r.y - y) < PILL_ROW) return true;
    }
    return false;
  }

  /** Your name over your head (a white sticker pill, namepill.js), with your
   *  alignment and Codex titles above it. */
  _drawOwnName(px, py, status) {
    const { ctx, game } = this;
    drawPill(ctx, namePill(ctx, game.player.name, 'own', this._pillRes), px, py - OWN_NAME_Y);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    // Your alignment title ("the Paragon", "the Villain") sits just above the
    // name in its tier's colour; nothing while you are Neutral.
    const al = game.alignmentStyle ? game.alignmentStyle() : null;
    let ty = py - 69;
    if (al?.label && !status) {
      ctx.font = '900 9px Nunito,"Trebuchet MS",sans-serif';
      ctx.strokeStyle = '#22304A'; ctx.lineWidth = 3;
      ctx.strokeText(al.label, px, py - 67);
      ctx.fillStyle = al.color;
      ctx.fillText(al.label, px, py - 67);
      ty = py - 78;
    }
    // A Codex title (from a mastered topic) sits above the name, in gold.
    const title = game.learning?.titleText() || game.collection?.titleText();   // or a Collection log title
    if (title && !status) {   // a status badge takes that spot while it lasts
      ctx.font = '900 9.5px Nunito,"Trebuchet MS",sans-serif';
      ctx.strokeStyle = '#22304A'; ctx.lineWidth = 3;
      ctx.strokeText(`« ${title} »`, px, ty);
      ctx.fillStyle = '#FFD24A';
      ctx.fillText(`« ${title} »`, px, ty);
    }
  }

  _drawOverheads(ox, oy, objs) {
    const { ctx, game } = this;
    this._drawNodeLabels(ox, oy, objs);
    const vw = game.camera.viewW, vh = game.camera.viewH;
    drawGateShrine(ctx, game, ox, oy, vw, vh);   // the Endless Gate's shrine: its bar and hit flash
    const mode = labelMode(game);
    // Labels drawn so far this frame (names, tags, your status), to keep them apart.
    this._placed ||= [];
    this._nPlaced = 0;
    this._pillRes = pillRes(game.camera);   // the scale name pills are painted at
    // Hit numbers go down first, so the names, bars and tags drawn after them
    // always sit on top and stay readable in a crowded fight.
    this._drawSplats(ox, oy);
    // Your own name: Smart labels leave it off (you know who you are, and it
    // sat in the thick of every fight); All and Off keep it, and so does
    // postcard mode, for the picture.
    const ownName = game.player.alive && (mode !== 'smart' || !!game.photoMode);
    // Status from a boss's signature move: poisoned, burning, rooted...
    const status = !game.player.alive ? null : game.playerDot ? PLAYER_DOT_STATUS[game.playerDot.kind]
      : game.playerRoot > 0 ? ROOTED_STATUS : game.playerStun > 0 ? STUNNED_STATUS : null;
    // Your name and status pill (drawn later, over everyone) hold their spots
    // first, so a name standing by you steps aside instead of printing over them.
    if (game.player.alive) {
      const pc = game.player.renderCenter();
      if (ownName) this._place(pc.x - ox, pc.y - oy - OWN_NAME_Y, namePill(ctx, game.player.name, 'own', this._pillRes).w / 2 + 1);
      if (status) {
        ctx.font = '900 10px Nunito,"Trebuchet MS",sans-serif';
        this._place(pc.x - ox, pc.y - oy - 71, ctx.measureText(status[0]).width / 2 + 5);
      }
    }
    for (const n of (game.nearbyNpcs ? game.nearbyNpcs() : game.npcs)) {
      if (!n.alive) continue;
      // Most of the crowd near you (sixty tiles each way) is off screen: skip
      // it before working anything out. A walker is drawn between its tile and
      // the next, so it is off screen when both are (the same test as below).
      const lx = n.x * TILE + TILE / 2 - ox, ly = n.y * TILE + TILE / 2 - oy;
      const mx = n.moving ? n.tx * TILE + TILE / 2 - ox : lx, my = n.moving ? n.ty * TILE + TILE / 2 - oy : ly;
      if ((lx < -90 && mx < -90) || (lx > vw + 90 && mx > vw + 90) || (ly < -90 && my < -90) || (ly > vh + 60 && my > vh + 60)) continue;
      const boss = n.def.boss;
      const targeted = n === game.player.target;
      const moral = n.def.moral && game.moralPending(n);   // a moral choice still waiting for you
      // Name over the head (Settings > World labels): bosses, champions, your
      // target, whatever is attacking you, quest NPCs and the hovered one.
      const named = npcNameVisible(game, n, mode);
      if (!boss && !n.champion && n.combatLatch <= 0 && n.telegraph <= 0 && !targeted && n.chatTimer <= 0 && !moral && !named) continue;
      const c = n.renderCenter();
      // Labels and bars for monsters off screen were the biggest drawing cost
      // (every champion and boss in range drew its name each frame): skip them.
      if (c.x - ox < -90 || c.x - ox > vw + 90 || c.y - oy < -90 || c.y - oy > vh + 60) continue;
      const sc = n.def.scale || 1;
      const yo = -(20 * sc) - 6;
      if (n.chatTimer > 0 && n.chatText) {
        const px = c.x - ox, py = c.y - oy + yo - 14;
        ctx.font = '800 10px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        const wpx = ctx.measureText(n.chatText).width + 10;
        this._place(px, py - 4.5, wpx / 2);   // names drawn after this step clear of it
        // A-Worthy speech-bubble sticker: white card, navy ink outline.
        ctx.fillStyle = '#FFFFFF';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px - wpx / 2, py - 12, wpx, 15, 7.5); ctx.fill(); }
        else ctx.fillRect(px - wpx / 2, py - 12, wpx, 15);
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = 1.5;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px - wpx / 2, py - 12, wpx, 15, 7.5); ctx.stroke(); }
        ctx.fillStyle = '#1C1B19'; ctx.fillText(n.chatText, px, py - 1);
      }
      if (boss || n.combatLatch > 0 || targeted) this._healthBar(c.x - ox, c.y - oy + yo, n.hp / n.maxHp, boss);
      if (moral && !(n.chatTimer > 0)) {
        // A small gold "!" bobbing over their head until you have chosen.
        const px = c.x - ox, py = c.y - oy + yo - 8 + Math.sin(performance.now() * 0.005) * 1.5;
        ctx.font = '900 14px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = 3.5; ctx.strokeText('!', px, py);
        ctx.fillStyle = '#FFD24A'; ctx.fillText('!', px, py);
      }
      if (n.telegraph > 0) {
        const px = c.x - ox, py = c.y - oy + yo - 12;
        ctx.font = '800 18px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 4; ctx.strokeText('!', px, py);
        ctx.fillStyle = '#ff5a5a'; ctx.fillText('!', px, py);
      }
      if (named && (boss || n.champion)) {
        const px = c.x - ox;
        let py = c.y - oy + yo - 9;   // a pill sitting on the health bar
        // A gold pill for a champion, a red one for a boss.
        const pill = namePill(ctx, n.champion ? `★ ${n.name}` : n.name, n.champion ? 'champion' : 'boss', this._pillRes);
        // Bosses and champions always wear their name, but step up a line
        // (twice at most) rather than print over a name already there.
        const hw = pill.w / 2;
        for (let k = 0; k < 2 && this._placeHits(px, py, hw); k++) py -= PILL_ROW;
        this._place(px, py, hw);
        drawPill(ctx, pill, px, py);
      } else if (named && !(n.chatTimer > 0)) {
        // Everyone else: a smaller pill, cream for townsfolk and, for a foe,
        // green, gold or red words by how dangerous it is to you (foeThreat).
        // A foe wears it under its feet, leaving the space over its head (and
        // over yours, when it stands beside you) to health bars, the tag and
        // damage numbers.
        const feet = n.attackable || n.combatLatch > 0 || targeted;
        const px = c.x - ox;
        let py = feet ? c.y - oy + 16 * sc + 9 : c.y - oy + yo - 2 - (moral ? 14 : 0);
        // (how dangerous a foe is only changes with your levels: worked out once a tick)
        if (n.attackable && n._threatTick !== game.tickCount) { n._threatTick = game.tickCount; n._threat = foeThreat(game, n); }
        const pill = namePill(ctx, n.name, n.attackable ? n._threat : 'town', this._pillRes);
        // Two foes side by side would print their names over each other: step
        // this one down a line (twice at most), or leave it off if still crowded.
        const hw = pill.w / 2;
        let tries = 0;
        while (this._placeHits(px, py, hw) && tries < 2) { py += PILL_ROW; tries++; }
        if (this._placeHits(px, py, hw) && !targeted) continue;   // (your target's name always shows)
        this._place(px, py, hw);
        drawPill(ctx, pill, px, py);
      }
      if (targeted) {
        const px = c.x - ox;
        // A compact tag: race icon, ▲ effective / ▼ resisted, and one status
        // count. The weakness, armour and every wound are spelt out in the
        // battle bar instead (worldlabels.js foeDetails). A navy pill, its
        // words coloured by the matchup, above the health bar and clear of the
        // picture (worldlabels.js targetTagY): under the bar it sat on the
        // monster's face. Drawn after the names, so it steps round them.
        let py = c.y - oy + targetTagY(sc, yo, n.def.sprite);
        const m = game.raceMatchup(n);
        const pill = namePill(ctx, targetTag(game, n), m === 'strong' ? 'tagStrong' : m === 'weak' ? 'tagWeak' : 'tagEven', this._pillRes);
        const hw = pill.w / 2;
        // The "!" of a charging blow or a choice waiting (up to 25px over the
        // bar) stays in view: the tag goes up over it while it shows.
        if (n.telegraph > 0 || moral) py = Math.min(py, c.y - oy + yo - 27 - TAG_H / 2);
        // Clear of a name already there: a line higher (twice at most). Always drawn.
        for (let k = 0; k < 2 && this._placeHits(px, py, hw); k++) py -= PILL_ROW;
        // Near the top of the view it would be cut off: under the feet instead
        // (below a name there), still clear of the picture.
        if (py - TAG_H / 2 < 2) {
          py = c.y - oy + 16 * sc + 9;
          for (let k = 0; k < 2 && this._placeHits(px, py, hw); k++) py += PILL_ROW;
        }
        this._place(px, py, hw);
        drawPill(ctx, pill, px, py);
      }
    }
    if (game.player.alive) {
      const c = game.player.renderCenter();
      const px = c.x - ox, py = c.y - oy;
      // Your own bar, in a fight or while hurt (not only with a target), with
      // a drain trail on each loss (playerhp.js).
      if (playerBarVisible(game)) drawPlayerHp(ctx, px, py - 48, game.player.hp / game.maxHp(), this._hpTrail || (this._hpTrail = {}), this._now || 0, game.colourBlind);
      if (status) {
        ctx.font = '900 10px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
        const tw = ctx.measureText(status[0]).width + 10;
        ctx.fillStyle = status[1]; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px - tw / 2, py - 78, tw, 14, 7) : ctx.rect(px - tw / 2, py - 78, tw, 14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(status[0], px, py - 67.5);
      }
      if (ownName) this._drawOwnName(px, py, status);
    }
    this._drawGatherRing(ox, oy);
  }

  /** Hit numbers (drawn before the names and bars, which sit over them). */
  _drawSplats(ox, oy) {
    const { ctx, game } = this;
    for (const e of game.effects) {
      if (e.type !== 'hitsplat' || e._showAt > this._now) continue;
      const c = e.entity.renderCenter ? e.entity.renderCenter() : { x: e.entity.x * TILE, y: e.entity.y * TILE };
      const age = e.maxLife - e.life;
      // Rise from above the head and fan out sideways so rapid hits don't stack
      // into one blob over the face. Back-to-back numbers also alternate
      // between two rows (e.row), so they never overlap before rising apart.
      // Each number springs in, hops sideways in a little arc and fades as it rises (juice.js).
      const m = splatMotion(e, age, this._splatM || (this._splatM = {}));
      const px = c.x - ox + splatSide(e) * 13 + m.dx, py = c.y - oy - 26 - (e.row || 0) * 11 + m.dy;
      const hit = e.dmg > 0;
      const pop = m.scale * splatBump(e, this._now);
      const r = e.crit ? 10 : 8;
      ctx.save();
      ctx.globalAlpha = m.alpha;
      ctx.translate(px, py); ctx.scale(pop * SPLAT_SCALE, pop * SPLAT_SCALE);
      if (m.rot) ctx.rotate(m.rot);
      if (!hit && !e.text) {
        // A blow that didn't land: a soft "miss" puff rather than a zero.
        drawMissPuff(ctx, age);
        ctx.restore(); ctx.globalAlpha = 1;
        continue;
      }
      if (e.text) {
        // A word instead of a number (e.g. "Dodged!"): a white sticker label.
        ctx.font = '900 11px Nunito,"Trebuchet MS",sans-serif';
        const tw = ctx.measureText(e.text).width + 12;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-tw / 2, -8, tw, 16, 8) : ctx.rect(-tw / 2, -8, tw, 16);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1F7A3D'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.text, 0, 1);
        ctx.textBaseline = 'alphabetic';
        ctx.restore(); ctx.globalAlpha = 1;
        continue;
      }
      if (e.aoe && hit) {
        // Splash and area damage (cleaves, sweeps, ricochets, spell splash):
        // set apart from the main hit. A small white tag outlined in the
        // effect's colour, with the number in that colour, rising lower and
        // to the side, so the big red disc always reads as your main blow.
        const col = e.tint || '#ffb347';
        const label = (e.critX ? '✦' : '') + splatNum(e.dmg);
        ctx.translate(10, 14);
        ctx.font = `800 ${e.critX ? 11 : 9.5}px Nunito,"Trebuchet MS",sans-serif`;
        const tw = ctx.measureText(label).width + 9;
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-tw / 2, -6.5, tw, 13, 4) : ctx.rect(-tw / 2, -6.5, tw, 13);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = e.critX ? '#c81e1e' : '#22304A';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0.5);
        ctx.textBaseline = 'alphabetic';
        ctx.restore(); ctx.globalAlpha = 1;
        continue;
      }
      // Hit the monster's weakness: a small green "weak!" tag over the number,
      // on the first such number on each foe only (on every hit it piled up
      // into a column of "weak!"s; the arrow in the target tag says it too).
      if (e.weak && hit && (e.entity._weakTag ||= e) === e) {
        ctx.font = '900 8px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.strokeText('weak!', 0, -r - 4);
        ctx.fillStyle = '#1F7A3D'; ctx.fillText('weak!', 0, -r - 4);
      }
      if (e.critX) {
        // Critical hit: just a red number, a touch smaller for x2 and a touch bigger for x4 (a mega crit).
        const mega = e.critX >= 4;
        // Kept small (they used to dwarf the fight): a touch bigger than a plain hit, x4 a touch more.
        const size = mega ? 16 : 13.5;
        drawCritBurst(ctx, (mega ? 19 : 16) + splatNum(e.dmg).length * 1.2, age * 0.0016, mega);   // a sticker star-burst behind it
        ctx.font = `900 ${size}px Nunito,"Trebuchet MS",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = mega ? 4.5 : 4; ctx.strokeStyle = '#ffffff';
        ctx.strokeText(splatNum(e.dmg), 0, 0);
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#4a0606';
        ctx.strokeText(splatNum(e.dmg), 0, 0);
        ctx.fillStyle = mega ? '#ff1a1a' : '#e01b1b';
        ctx.fillText(splatNum(e.dmg), 0, 0);
        ctx.textBaseline = 'alphabetic';
        ctx.restore(); ctx.globalAlpha = 1;
        continue;
      }
      // Splat body: gold for a max hit, red for a hit, blue for a block/miss.
      ctx.fillStyle = e.tint && hit ? e.tint : e.crit ? '#f2c029' : hit ? '#c81e1e' : '#39557d';
      ctx.font = `800 ${e.crit ? 11 : 10}px Nunito,"Trebuchet MS",sans-serif`;
      const nw = ctx.measureText(splatNum(e.dmg)).width;
      if (nw > r * 1.6) {   // a long number gets a pill rather than a crowded disc
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-nw / 2 - 4, -r, nw + 8, r * 2, r) : ctx.rect(-nw / 2 - 4, -r, nw + 8, r * 2); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(0, -3, r - 1, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${e.crit ? 11 : 10}px Nunito,"Trebuchet MS",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(splatNum(e.dmg), 0, 1);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  /** While you gather, a ring over the node fills once per attempt (each game
   *  tick), so you can see the work happening between items. */
  _drawGatherRing(ox, oy) {
    const { ctx, game } = this;
    const a = game.player.action;
    if (!a || !a.obj || !GATHER_RING[a.type] || game.player.isMoving || a.obj.depleted) return;
    const o = a.obj;
    if (Math.max(Math.abs(o.x - game.player.x), Math.abs(o.y - game.player.y)) > 1) return;
    const t = Math.max(0, Math.min(1, game.tickAcc / TICK_MS));
    const cx = o.x * TILE + TILE / 2 - ox, cy = o.y * TILE - oy - (o.def.type === 'tree' ? 26 : 4);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = GATHER_RING[a.type]; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(cx, cy, 5.5, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  _healthBar(cx, cy, frac, boss) {
    const { ctx } = this;
    const w = boss ? 60 : 30, h = boss ? 6 : 5;
    frac = Math.max(0, Math.min(1, frac));
    const x = cx - w / 2;
    // frame
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, cy - 1, w + 2, h + 2);
    // empty track + filled portion (green→amber→red by remaining health)
    ctx.fillStyle = '#5a1212'; ctx.fillRect(x, cy, w, h);
    const hue = Math.round(120 * frac); // 120 green -> 0 red
    ctx.fillStyle = `hsl(${hue},75%,46%)`;
    ctx.fillRect(x, cy, w * frac, h);
    // top gloss + a darker base line for a rounded look
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, cy, w * frac, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, cy + h - 1, w, 1);
    // boss bars get segment ticks
    if (boss) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let i = 1; i < 4; i++) ctx.fillRect(x + (w / 4) * i, cy, 1, h);
    }
  }
}

// The swell's wash colours, one string per alpha step (to 0.001, as written
// before), made once rather than for every water tile on every redraw.
const SWELL_RGB = ['255,255,255', '30,90,140'];
const _swell = [new Map(), new Map()];
export function swellFill(dark, a) {
  const k = Math.round(a * 1000), m = _swell[dark];
  let s = m.get(k);
  if (s === undefined) { s = `rgba(${SWELL_RGB[dark]},${(k / 1000).toFixed(3)})`; m.set(k, s); }
  return s;
}

/** Where a hit number sits across (in steps of 13px from the middle). The
 *  middle column over a head belongs to its health bar, target tag and name,
 *  so numbers keep at least SPLAT_SIDE steps to the left or right of it (the
 *  same side their hop drifts to, juice.js), rather than covering them. */
export const SPLAT_SIDE = 1.25;
export function splatSide(e) {
  const fan = e.fan || 0;
  if (Math.abs(fan) >= SPLAT_SIDE) return fan;
  const dir = fan > 0 ? 1 : fan < 0 ? -1 : (e.row ? -1 : 1);
  return dir * SPLAT_SIDE;
}

/** A merged hitsplat's quick re-pop (1 when not bumping): up by a third and back over 160ms. */
const BUMP_MS = 160;
export function splatBump(e, now) {
  const t = e._bumpAt === undefined ? -1 : now - e._bumpAt;
  return t >= 0 && t < BUMP_MS ? 1 + 0.35 * Math.sin((t / BUMP_MS) * Math.PI) : 1;
}

function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
