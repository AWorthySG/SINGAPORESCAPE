import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { getItem } from '../data/items.js';
import { weaknessOf } from '../game/combat.js';
import { drawShadow, drawCreature, drawPlayer, drawObjectSprite, drawGroundItem } from './sprites.js';

// Base terrain colours (RGB): a bright pastel world in the A-Worthy palette
// (soft mint lawns, warm cream paths, cream paper paving). Water is procedural.
const TERRAIN_RGB = {
  [TERRAIN.GRASS]: [170, 216, 146],
  [TERRAIN.DARKGRASS]: [162, 210, 140],
  [TERRAIN.PATH]: [238, 216, 178],
  [TERRAIN.SAND]: [248, 232, 196],
  [TERRAIN.STONE]: [246, 238, 226],
  [TERRAIN.WOOD]: [222, 186, 142],
};
// Pastel tile accents for the paved plazas (design-system chip pastels with
// their marker-pop partners): sun, bloom, sky, grass.
const TILE_POPS = [
  ['#FDF3DE', '#F5B82E'], ['#FDE8EE', '#EF476F'], ['#E6F1FB', '#5FAEE3'], ['#E5F5E9', '#3DAA5C'],
];

// Per-region atmospheric colour grade [r,g,b,alpha] — smoothly blended as you travel.
// Bright regions need no grade (saves a full-screen paint per frame); only the
// Wilderness and the haunted island carry a mood tint.
const ZONE_TINT = {
  'Kampong Glam': [255, 236, 214, 0],
  Chinatown: [255, 222, 214, 0],
  'Bukit Timah': [214, 245, 200, 0],
  'MacRitchie Reservoir': [200, 230, 250, 0],
  'Sentosa Beach': [255, 240, 205, 0],
  'The Wilderness': [170, 120, 170, 0.12],
  'Pulau Hantu': [150, 125, 200, 0.14],
  Singapore: [255, 236, 214, 0],
};

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

export class Renderer {
  constructor(game, canvas, ctx) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = ctx;
    // Static terrain is expensive to recompute per frame (grass blades, edges),
    // so bake it once to an offscreen canvas and only animate water on top.
    this.terrainCanvas = this._buildTerrainCache();
    this._vig = null; // cached vignette gradients (rebuilt on resize)
  }

  render(timeMs) {
    const { ctx, game } = this;
    const cam = game.camera;
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

    ctx.fillStyle = '#FAF6EE'; ctx.fillRect(0, 0, vw, vh);   // opaque canvas: paint, don't clear
    ctx.fillStyle = '#16241a';
    ctx.fillRect(0, 0, vw, vh);

    const x0 = Math.max(0, Math.floor(ox / TILE) - 1);
    const y0 = Math.max(0, Math.floor(oy / TILE) - 1);
    const x1 = Math.min(game.world.width - 1, Math.ceil((ox + vw) / TILE) + 1);
    const y1 = Math.min(game.world.height - 1, Math.ceil((oy + vh) / TILE) + 1);

    if (this.terrainCanvas && ox >= 0 && oy >= 0) {
      // Blit the cached static terrain for the visible slice, then animate water.
      const sw = Math.min(vw, this.terrainCanvas.width - ox);
      const sh = Math.min(vh, this.terrainCanvas.height - oy);
      if (sw > 0 && sh > 0) ctx.drawImage(this.terrainCanvas, ox, oy, sw, sh, 0, 0, sw, sh);
      this._drawWaterOverlay(x0, y0, x1, y1, ox, oy, timeMs);
    } else {
      this._drawTerrain(x0, y0, x1, y1, ox, oy, timeMs);
    }
    this._drawGroundDecals(ox, oy);

    // Depth-sorted drawables.
    const drawables = [];
    const isLightSource = (o) => o.def.type === 'fire' || o.def.type === 'furnace' || o.def.type === 'range' ||
      (o.def.type === 'scenery' && o.objId === 'lamp');
    for (const o of game.world.objects) {
      if (o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 1) continue;
      // Harvest judder: a struck tree/rock wobbles briefly as the resource pops.
      const jx = o.shakeT > 0 ? Math.sin(o.shakeT * 0.09) * 1.7 * (o.shakeT / 280) : 0;
      const cx = o.x * TILE + TILE / 2 - ox + jx, cy = o.y * TILE + TILE / 2 - oy;
      const lit = night > 0.12 && isLightSource(o);
      drawables.push({ sortY: o.y + 0.4, z: 1, draw: () => {
        if (lit) {
          // A warm light pool blooms outward after dark — fires, furnaces,
          // ranges and street lamps become the island's night-time glow.
          const flick = 0.85 + Math.sin(timeMs * 0.01 + o.x * 3.1 + o.y) * 0.15;
          const r = (20 + night * 12) * flick;
          const g = ctx.createRadialGradient(cx, cy - 4, 2, cx, cy - 4, r);
          g.addColorStop(0, `rgba(255,190,110,${(0.32 * night).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255,190,110,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy - 4, r, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        drawObjectSprite(ctx, o, cx, cy, timeMs);
      } });
    }
    for (const g of game.world.groundItems) {
      if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue;
      const cx = g.x * TILE + TILE / 2 - ox, cy = g.y * TILE + TILE * 0.62 - oy;
      drawables.push({ sortY: g.y - 0.3, z: 0, draw: () => {
        // Soft glow so loot on the ground is easy to spot.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22 + Math.sin(timeMs * 0.005 + g.x + g.y) * 0.06;
        ctx.fillStyle = '#ffe79a';
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        drawGroundItem(ctx, g.id, cx, cy);
      } });
    }
    for (const n of game.npcs) {
      if (!n.alive && !(n.deathT > 0)) continue;
      const c = n.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      const sc = n.def.scale || 1;
      if (!n.alive) {
        // Death animation: keel over about the feet while fading out.
        if (cx < -40 || cy < -40 || cx > vw + 40 || cy > vh + 40) continue;
        const k = 1 - n.deathT / 420; // 0 -> 1 over the fall
        const dir = (n.facing && n.facing.dx < 0) ? -1 : 1;
        drawables.push({ sortY: c.y / TILE - 0.01, z: 1, draw: () => {
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - k * k);
          ctx.translate(cx, cy + 11 * sc);
          ctx.rotate(dir * k * Math.PI * 0.5);
          ctx.translate(-cx, -(cy + 11 * sc));
          drawCreature(ctx, n.npcId, cx, cy - 2, {
            time: timeMs, facing: n.facing, moving: false,
            scale: sc, sprite: n.def.sprite, color: n.def.color, boss: n.def.boss,
          });
          ctx.restore();
          ctx.globalAlpha = 1;
        } });
        continue;
      }
      const off = n.renderOffset ? n.renderOffset() : { x: 0, y: 0 };
      drawables.push({ sortY: c.y / TILE, z: 2, draw: () => {
        drawShadow(ctx, cx, cy + 12 * sc, 10 * sc, 4.5 * sc);
        drawCreature(ctx, n.npcId, cx + off.x, cy - 2 + off.y, {
          time: timeMs, facing: n.facing, moving: n.isMoving,
          scale: sc, sprite: n.def.sprite, color: n.def.color, boss: n.def.boss,
          attackK: n.swingProgress ? n.swingProgress() : -1,
        });
        if (n.hurt > 0) this._hurtFlash(cx + off.x, cy - 2 + off.y, sc, n.hurt);
      } });
    }
    if (game.player.alive) {
      const c = game.player.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      const off = game.player.renderOffset ? game.player.renderOffset() : { x: 0, y: 0 };
      drawables.push({ sortY: c.y / TILE, z: 2, draw: () => {
        drawShadow(ctx, cx, cy + 13, 10, 4.5);
        const sk = game.player.swingProgress();
        if (sk >= 0 && game.combatMode() === 'magic') this._castRing(cx, cy + 12, sk);
        drawPlayer(ctx, cx + off.x, cy - 2 + off.y, {
          time: timeMs, facing: game.player.facing, moving: game.player.isMoving, swingK: sk,
          hasBody: !!game.equipment.get('body'), hasWeapon: !!game.equipment.get('weapon'), weaponType: game.combatMode(),
          hasCape: !!game.equipment.get('cape'), hasHelm: !!game.equipment.get('head'),
          hasShield: !!game.equipment.get('shield'), prayerActive: game.activePrayers.size > 0,
        });
        if (game.player.hurt > 0) this._hurtFlash(cx + off.x, cy - 2 + off.y, 1, game.player.hurt);
      } });
    }
    drawables.sort((a, b) => (a.sortY - b.sortY) || (a.z - b.z));
    for (const d of drawables) d.draw();

    this._drawClueMarker(ox, oy, vw, vh, timeMs);
    this._drawVignette(vw, vh);
    this._drawAtmosphere(vw, vh);
    this._drawDayNight(vw, vh, night);
    this._drawParticles(ox, oy);
    this._drawProjectiles(ox, oy);
    this._drawOverheads(ox, oy);
    this._drawHurtFlash(vw, vh);
  }

  // Day/night colour wash: a warm dawn/dusk glow that peaks at mid-brightness
  // (sun near the horizon) and fades at both full noon and full night, plus a
  // cool navy night wash capped so the world stays readable at "midnight".
  // Drawn under particles/hitsplats so embers and fireflies still pop at night.
  _drawDayNight(vw, vh, night) {
    const { ctx } = this;
    const day = 1 - night;
    const duskiness = 4 * day * night; // 0 at day=0 or day=1, peaks at day=0.5
    // Pastel lighting: a soft peach-pink dusk and a gentle lavender night that
    // never drops the world into murk.
    if (duskiness > 0.02) {
      ctx.fillStyle = `rgba(255,170,160,${(duskiness * 0.12).toFixed(3)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    if (night > 0.05) {
      const a = Math.min(0.18, night * night * 0.24);
      ctx.fillStyle = `rgba(104,96,170,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  // Smoothly-blended colour grade per region for atmosphere (warm towns, cool
  // reservoir, ominous wilderness). Tints the world but not the HUD on top.
  _drawAtmosphere(vw, vh) {
    const t = ZONE_TINT[this.game.currentZoneName] || ZONE_TINT.Singapore;
    if (!this._grade) this._grade = t.slice();
    const g = this._grade;
    for (let i = 0; i < 4; i++) g[i] += (t[i] - g[i]) * 0.05;
    if (g[3] <= 0.004) return;
    this.ctx.fillStyle = `rgba(${g[0] | 0},${g[1] | 0},${g[2] | 0},${g[3].toFixed(3)})`;
    this.ctx.fillRect(0, 0, vw, vh);
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
    if (!h || !game.player.alive) return;
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

  _drawProjectiles(ox, oy) {
    const { ctx, game } = this;
    for (const e of game.effects) {
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
      if (e.type !== 'projectile') continue;
      const t = 1 - e.life / e.maxLife;
      const x = e.x + (e.ex - e.x) * t - ox;
      const y = e.y + (e.ey - e.y) * t - oy;
      if (e.kind === 'arrow') {
        // A fletched shaft flying true along its line to the target.
        const ang = Math.atan2(e.ey - e.y, e.ex - e.x);
        ctx.save();
        ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(3, 0); ctx.stroke();
        ctx.fillStyle = '#e8e0c8';
        path2(ctx, [[-9, 0], [-6, -2.6], [-5, 0]]); ctx.fill();
        path2(ctx, [[-9, 0], [-6, 2.6], [-5, 0]]); ctx.fill();
        ctx.fillStyle = e.color;
        path2(ctx, [[6, 0], [1, -2.2], [1, 2.2]]); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.restore();
        continue;
      }
      // Magic bolt: a glowing orb with a fading trail of embers behind it.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3;
      for (let i = 1; i <= 3; i++) {
        const tt = Math.max(0, t - i * 0.1);
        const tx = e.x + (e.ex - e.x) * tt - ox, ty = e.y + (e.ey - e.y) * tt - oy;
        ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(tx, ty, 2.6 - i * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  _drawParticles(ox, oy) {
    const { ctx, game } = this;
    if (!game.particles || !game.particles.length) return;
    for (const p of game.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      if (p.add) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - ox, p.y - oy, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (p.add) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  // Bake all static terrain (everything but the animated water surface) to a
  // full-world offscreen canvas. Returns null in headless/no-DOM environments.
  _buildTerrainCache() {
    if (typeof document === 'undefined') return null;
    const w = this.game.world;
    let cnv, cx;
    try {
      cnv = document.createElement('canvas');
      cnv.width = w.width * TILE;
      cnv.height = w.height * TILE;
      cx = cnv.getContext('2d');
    } catch { return null; }
    if (!cx) return null;
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const t = w.terrainAt(x, y);
        const sx = x * TILE, sy = y * TILE;
        if (t === TERRAIN.WATER) { cx.fillStyle = 'rgb(122,190,232)'; cx.fillRect(sx, sy, TILE + 1, TILE + 1); continue; }
        const base = TERRAIN_RGB[t] || TERRAIN_RGB[TERRAIN.GRASS];
        const h = hash(x, y);
        const j = (h - 0.5) * 10;
        cx.fillStyle = `rgb(${clamp8(base[0] + j)},${clamp8(base[1] + j)},${clamp8(base[2] + j)})`;
        cx.fillRect(sx, sy, TILE + 1, TILE + 1);
        this._tileDetail(cx, t, x, y, sx, sy, h);
        this._tileEdges(cx, w, t, x, y, sx, sy);
      }
    }
    return cnv;
  }

  _drawWaterOverlay(x0, y0, x1, y1, ox, oy, timeMs) {
    const { ctx, game } = this;
    const w = game.world;
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

  _water(ctx, w, x, y, sx, sy, timeMs) {
    const land = (tt) => tt !== TERRAIN.WATER;
    const shore = land(w.terrainAt(x, y - 1)) || land(w.terrainAt(x, y + 1)) || land(w.terrainAt(x - 1, y)) || land(w.terrainAt(x + 1, y));
    const wave = Math.sin((x + y) * 0.7 + timeMs * 0.0016) * 8 + Math.sin((x - y) * 0.5 + timeMs * 0.0011) * 6;
    // Deeper water reads darker/greener; shallows near shore are brighter teal.
    const d = shore ? 18 : 0;
    ctx.fillStyle = `rgb(${(122 + d + wave * 0.5) | 0},${(190 + d * 0.6 + wave * 0.6) | 0},${(232 + d * 0.3 + wave * 0.4) | 0})`;
    ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
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

  _drawGroundDecals(ox, oy) {
    const { ctx, game } = this;
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
    if (p.moving || p.path.length) {
      const dest = p.path.length ? p.path[p.path.length - 1] : { x: p.tx, y: p.ty };
      const cx = dest.x * TILE + TILE / 2 - ox, cy = dest.y * TILE + TILE / 2 - oy;
      const pulse = 4 + Math.sin(performance.now() * 0.012) * 1.5;
      ctx.strokeStyle = '#ffe66a'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - pulse, cy - pulse); ctx.lineTo(cx + pulse, cy + pulse);
      ctx.moveTo(cx + pulse, cy - pulse); ctx.lineTo(cx - pulse, cy + pulse);
      ctx.stroke();
    }
  }

  _drawVignette(vw, vh) {
    const { ctx } = this;
    // Gradients are static per viewport size — cache them instead of rebuilding each frame.
    if (!this._vig || this._vig.vw !== vw || this._vig.vh !== vh) {
      const warm = ctx.createLinearGradient(0, 0, vw * 0.55, vh);
      warm.addColorStop(0, 'rgba(255,236,214,0.10)');
      warm.addColorStop(0.45, 'rgba(255,226,236,0.03)');
      warm.addColorStop(1, 'rgba(200,220,255,0.05)');
      const edge = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.36, vw / 2, vh / 2, Math.max(vw, vh) * 0.74);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(60,70,110,0.12)');
      this._vig = { vw, vh, warm, edge };
    }
    // One soft edge vignette only: the old warm wash cost a full-screen paint
    // every frame for an effect the pastel palette no longer needs.
    ctx.fillStyle = this._vig.edge; ctx.fillRect(0, 0, vw, vh);
  }

  // ---------------- Overhead UI (bars, hitsplats, name) ----------------
  _drawNodeLabels(ox, oy) {
    const { ctx, game } = this;
    const vw = game.camera.viewW, vh = game.camera.viewH;
    ctx.font = '10px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const o of game.world.objects) {
      const t = o.def.type;
      if (t !== 'tree' && t !== 'rock' && t !== 'fishing') continue;
      if (o.depleted || !o.def.label) continue;
      const cx = o.x * TILE + TILE / 2 - ox;
      const cy = o.y * TILE + TILE / 2 - oy;
      if (cx < -30 || cx > vw + 30 || cy < -20 || cy > vh + 20) continue;
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
    }
    // Directional signposts (which way to each area).
    ctx.font = '800 11px Nunito,"Trebuchet MS",sans-serif';
    for (const o of game.world.objects) {
      if (!o.sign) continue;
      const cx = o.x * TILE + TILE / 2 - ox, cy = o.y * TILE + TILE / 2 - oy;
      if (cx < -40 || cx > vw + 40 || cy < -20 || cy > vh + 20) continue;
      const yy = cy - 16;
      const wpx = ctx.measureText(o.sign).width + 10;
      ctx.fillStyle = 'rgba(40,26,12,0.78)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - wpx / 2, yy - 11, wpx, 15, 4); ctx.fill(); }
      else ctx.fillRect(cx - wpx / 2, yy - 11, wpx, 15);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(o.sign, cx + 0.6, yy + 0.6);
      ctx.fillStyle = o.sign.includes('Wilderness') ? '#ff9a7a' : '#ffe6a8'; ctx.fillText(o.sign, cx, yy);
    }
  }

  _drawOverheads(ox, oy) {
    const { ctx, game } = this;
    this._drawNodeLabels(ox, oy);
    for (const n of game.npcs) {
      if (!n.alive) continue;
      const boss = n.def.boss;
      const targeted = n === game.player.target;
      if (!boss && n.combatLatch <= 0 && n.telegraph <= 0 && !targeted && n.chatTimer <= 0) continue;
      const c = n.renderCenter();
      const sc = n.def.scale || 1;
      const yo = -(20 * sc) - 6;
      if (n.chatTimer > 0 && n.chatText) {
        const px = c.x - ox, py = c.y - oy + yo - 14;
        ctx.font = '800 10px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        const wpx = ctx.measureText(n.chatText).width + 10;
        // A-Worthy speech-bubble sticker: white card, navy ink outline.
        ctx.fillStyle = '#FFFFFF';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px - wpx / 2, py - 12, wpx, 15, 7.5); ctx.fill(); }
        else ctx.fillRect(px - wpx / 2, py - 12, wpx, 15);
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = 1.5;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px - wpx / 2, py - 12, wpx, 15, 7.5); ctx.stroke(); }
        ctx.fillStyle = '#1C1B19'; ctx.fillText(n.chatText, px, py - 1);
      }
      if (boss || n.combatLatch > 0 || targeted) this._healthBar(c.x - ox, c.y - oy + yo, n.hp / n.maxHp, boss);
      if (targeted) {
        const px = c.x - ox, py = c.y - oy + yo + 12;
        ctx.font = '800 9px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        const tag = `weak: ${weaknessOf(n.def)}`;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3; ctx.strokeText(tag, px, py);
        ctx.fillStyle = '#9affd0'; ctx.fillText(tag, px, py);
      }
      if (n.telegraph > 0) {
        const px = c.x - ox, py = c.y - oy + yo - 12;
        ctx.font = '800 18px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 4; ctx.strokeText('!', px, py);
        ctx.fillStyle = '#ff5a5a'; ctx.fillText('!', px, py);
      }
      if (boss) {
        const px = c.x - ox, py = c.y - oy + yo - 6;
        ctx.font = '800 11px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3; ctx.strokeText(n.name, px, py);
        ctx.fillStyle = '#ff7a5a'; ctx.fillText(n.name, px, py);
      }
    }
    if (game.player.alive) {
      const c = game.player.renderCenter();
      const px = c.x - ox, py = c.y - oy;
      if (game.player.target) this._healthBar(px, py - 30, game.player.hp / game.maxHp());
      ctx.font = '800 11px Nunito,"Trebuchet MS",sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      // Name tag in the sticker style: white letters inside a navy ink line.
      ctx.strokeStyle = '#22304A'; ctx.lineWidth = 3.5;
      ctx.strokeText(game.player.name, px, py - 36);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(game.player.name, px, py - 36);
    }
    for (const e of game.effects) {
      if (e.type !== 'hitsplat') continue;
      const c = e.entity.renderCenter ? e.entity.renderCenter() : { x: e.entity.x * TILE, y: e.entity.y * TILE };
      const age = 1100 - e.life;
      // Rise from above the head and fan out sideways so rapid hits don't stack
      // into one blob over the face.
      const px = c.x - ox + (e.fan || 0) * 9, py = c.y - oy - 26 - age * 0.022;
      const hit = e.dmg > 0;
      // Pop in: overshoot to ~1.15 then settle to 1.
      const pop = age < 90 ? 0.5 + 0.72 * (age / 90) : Math.max(1, 1.22 - (age - 90) / 260);
      const a = Math.min(1, e.life / 350);
      const r = e.crit ? 10 : 8;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(px, py); ctx.scale(pop, pop);
      // Splat body: gold for a max hit, red for a hit, blue for a block/miss.
      ctx.fillStyle = e.crit ? '#f2c029' : hit ? '#c81e1e' : '#39557d';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(0, -3, r - 1, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${e.crit ? 11 : 10}px Nunito,"Trebuchet MS",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(e.dmg), 0, 1);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
      ctx.globalAlpha = 1;
    }
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

function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
