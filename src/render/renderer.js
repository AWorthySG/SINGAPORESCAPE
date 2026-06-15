import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { getItem } from '../data/items.js';
import { drawShadow, drawCreature, drawPlayer, drawObjectSprite, drawGroundItem } from './sprites.js';

// Base terrain colours (RGB). Water is drawn procedurally.
const TERRAIN_RGB = {
  [TERRAIN.GRASS]: [88, 140, 58],
  [TERRAIN.DARKGRASS]: [74, 124, 50],
  [TERRAIN.PATH]: [168, 142, 94],
  [TERRAIN.SAND]: [208, 186, 130],
  [TERRAIN.STONE]: [148, 140, 128],
  [TERRAIN.WOOD]: [128, 94, 56],
};

// Per-region atmospheric colour grade [r,g,b,alpha] — smoothly blended as you travel.
const ZONE_TINT = {
  'Kampong Glam': [255, 224, 150, 0.05],
  Chinatown: [255, 206, 140, 0.06],
  'Bukit Timah': [120, 200, 120, 0.06],
  'MacRitchie Reservoir': [110, 175, 230, 0.09],
  'Sentosa Beach': [255, 232, 175, 0.05],
  'The Wilderness': [130, 40, 40, 0.17],
  'Pulau Hantu': [86, 58, 120, 0.20],
  Singapore: [255, 222, 160, 0.05],
};

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
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
    const ox = cam.originX, oy = cam.originY;
    const vw = cam.viewW, vh = cam.viewH;

    ctx.clearRect(0, 0, vw, vh);
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
    for (const o of game.world.objects) {
      if (o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 1) continue;
      const cx = o.x * TILE + TILE / 2 - ox, cy = o.y * TILE + TILE / 2 - oy;
      drawables.push({ sortY: o.y + 0.4, z: 1, draw: () => drawObjectSprite(ctx, o, cx, cy, timeMs) });
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
      if (!n.alive) continue;
      const c = n.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      const sc = n.def.scale || 1;
      const off = n.renderOffset ? n.renderOffset() : { x: 0, y: 0 };
      drawables.push({ sortY: c.y / TILE, z: 2, draw: () => {
        drawShadow(ctx, cx, cy + 12 * sc, 10 * sc, 4.5 * sc);
        drawCreature(ctx, n.npcId, cx + off.x, cy - 2 + off.y, {
          time: timeMs, facing: n.facing, moving: n.isMoving,
          scale: sc, sprite: n.def.sprite, color: n.def.color, boss: n.def.boss,
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
        drawPlayer(ctx, cx + off.x, cy - 2 + off.y, {
          time: timeMs, facing: game.player.facing, moving: game.player.isMoving,
          hasBody: !!game.equipment.get('body'), hasWeapon: !!game.equipment.get('weapon'),
          hasCape: !!game.equipment.get('cape'), hasHelm: !!game.equipment.get('head'),
        });
        if (game.player.hurt > 0) this._hurtFlash(cx + off.x, cy - 2 + off.y, 1, game.player.hurt);
      } });
    }
    drawables.sort((a, b) => (a.sortY - b.sortY) || (a.z - b.z));
    for (const d of drawables) d.draw();

    this._drawVignette(vw, vh);
    this._drawAtmosphere(vw, vh);
    this._drawParticles(ox, oy);
    this._drawProjectiles(ox, oy);
    this._drawOverheads(ox, oy);
    this._drawHurtFlash(vw, vh);
  }

  // Smoothly-blended colour grade per region for atmosphere (warm towns, cool
  // reservoir, ominous wilderness). Tints the world but not the HUD on top.
  _drawAtmosphere(vw, vh) {
    const t = ZONE_TINT[this.game.currentZoneName] || ZONE_TINT.Singapore;
    if (!this._grade) this._grade = t.slice();
    const g = this._grade;
    for (let i = 0; i < 4; i++) g[i] += (t[i] - g[i]) * 0.05;
    if (g[3] <= 0.001) return;
    this.ctx.fillStyle = `rgba(${g[0] | 0},${g[1] | 0},${g[2] | 0},${g[3].toFixed(3)})`;
    this.ctx.fillRect(0, 0, vw, vh);
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
    const h = game.player.hurt;
    if (!h || !game.player.alive) return;
    const a = Math.min(0.45, (h / 200) * 0.45);
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32, vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    g.addColorStop(0, 'rgba(180,0,0,0)');
    g.addColorStop(1, `rgba(170,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  _drawProjectiles(ox, oy) {
    const { ctx, game } = this;
    for (const e of game.effects) {
      if (e.type !== 'projectile') continue;
      const t = 1 - e.life / e.maxLife;
      const x = e.x + (e.ex - e.x) * t - ox;
      const y = e.y + (e.ey - e.y) * t - oy;
      ctx.globalCompositeOperation = 'lighter';
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
        if (t === TERRAIN.WATER) { cx.fillStyle = 'rgb(36,104,156)'; cx.fillRect(sx, sy, TILE + 1, TILE + 1); continue; }
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
      ctx.fillStyle = lf > 0.62 ? 'rgba(150,200,90,0.10)' : lf < 0.38 ? 'rgba(20,55,20,0.12)' : 'rgba(0,0,0,0)';
      if (lf > 0.62 || lf < 0.38) ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 7 + i, y * 13 - i), hy = hash(x * 3 - i, y * 11 + i);
        const px = sx + hx * (TILE - 6) + 3, py = sy + hy * (TILE - 6) + 3;
        ctx.fillStyle = 'rgba(40,80,30,0.35)';
        ctx.fillRect(px, py - 3, 1.4, 3);
        ctx.fillRect(px + 1.6, py - 4, 1.4, 4);
        ctx.fillStyle = 'rgba(170,215,120,0.5)'; // sunlit blade tip
        ctx.fillRect(px + 1.6, py - 4, 1.4, 1.3);
      }
      if (h > 0.92) { ctx.fillStyle = '#d23b6e'; ctx.beginPath(); ctx.arc(sx + 8 + h * 12, sy + 10, 1.4, 0, 6.3); ctx.fill(); }
    } else if (t === TERRAIN.PATH || t === TERRAIN.SAND) {
      ctx.fillStyle = t === TERRAIN.PATH ? 'rgba(120,98,58,0.5)' : 'rgba(160,140,90,0.5)';
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
      ctx.strokeStyle = 'rgba(60,56,48,0.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(sx + 2, sy + 2, TILE - 4, 2);
    } else if (t === TERRAIN.WOOD) {
      ctx.strokeStyle = 'rgba(60,40,20,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy + TILE / 2); ctx.lineTo(sx + TILE, sy + TILE / 2); ctx.stroke();
    }
  }

  // Crisp the edge of paths/stone against grass.
  _tileEdges(ctx, w, t, x, y, sx, sy) {
    if (t !== TERRAIN.PATH && t !== TERRAIN.STONE) return;
    ctx.fillStyle = 'rgba(40,35,22,0.18)';
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
    const d = shore ? 22 : 0;
    ctx.fillStyle = `rgb(${(30 + d * 0.4 + wave * 0.4) | 0},${(96 + d + wave) | 0},${(150 + d * 0.6 + wave) | 0})`;
    ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
    // caustic shimmer (two drifting bands)
    const hl = (Math.sin((x * 1.3 + y * 0.7) + timeMs * 0.002) + 1) / 2;
    if (hl > 0.55) {
      ctx.fillStyle = 'rgba(190,240,255,0.14)';
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
    ctx.fillStyle = 'rgba(225,243,255,0.55)';
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
      warm.addColorStop(0, 'rgba(255,214,140,0.11)');
      warm.addColorStop(0.45, 'rgba(255,198,118,0.035)');
      warm.addColorStop(1, 'rgba(30,52,72,0.06)');
      const edge = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.36, vw / 2, vh / 2, Math.max(vw, vh) * 0.74);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(16,24,16,0.30)');
      this._vig = { vw, vh, warm, edge };
    }
    ctx.fillStyle = this._vig.warm; ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = this._vig.edge; ctx.fillRect(0, 0, vw, vh);
  }

  // ---------------- Overhead UI (bars, hitsplats, name) ----------------
  _drawNodeLabels(ox, oy) {
    const { ctx, game } = this;
    const vw = game.camera.viewW, vh = game.camera.viewH;
    ctx.font = '10px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
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
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(cx - wpx / 2, yy - 10, wpx, 13, 4); ctx.fill(); }
      else ctx.fillRect(cx - wpx / 2, yy - 10, wpx, 13);
      ctx.fillStyle = t === 'tree' ? '#9be08a' : t === 'fishing' ? '#8fd6ff' : (o.def.ore || '#dfe4ea');
      ctx.fillText(label, cx, yy);
    }
    // Directional signposts (which way to each area).
    ctx.font = 'bold 11px "Trebuchet MS",sans-serif';
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
      if (!boss && n.combatLatch <= 0) continue;
      const c = n.renderCenter();
      const sc = n.def.scale || 1;
      const yo = -(20 * sc) - 6;
      this._healthBar(c.x - ox, c.y - oy + yo, n.hp / n.maxHp, boss);
      if (boss) {
        const px = c.x - ox, py = c.y - oy + yo - 6;
        ctx.font = 'bold 11px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3; ctx.strokeText(n.name, px, py);
        ctx.fillStyle = '#ff7a5a'; ctx.fillText(n.name, px, py);
      }
    }
    if (game.player.alive) {
      const c = game.player.renderCenter();
      const px = c.x - ox, py = c.y - oy;
      if (game.player.target) this._healthBar(px, py - 30, game.player.hp / game.skills.hitpoints);
      ctx.font = 'bold 11px "Trebuchet MS",sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3;
      ctx.strokeText(game.player.name, px, py - 32);
      ctx.fillStyle = '#ffe66a';
      ctx.fillText(game.player.name, px, py - 32);
    }
    for (const e of game.effects) {
      if (e.type !== 'hitsplat') continue;
      const c = e.entity.renderCenter ? e.entity.renderCenter() : { x: e.entity.x * TILE, y: e.entity.y * TILE };
      const age = 1100 - e.life;
      const px = c.x - ox, py = c.y - oy - 6 - age * 0.012;
      const hit = e.dmg > 0;
      // Pop in: overshoot to ~1.15 then settle to 1.
      const pop = age < 90 ? 0.5 + 0.72 * (age / 90) : Math.max(1, 1.22 - (age - 90) / 260);
      const a = Math.min(1, e.life / 350);
      const r = e.crit ? 12 : 10;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(px, py); ctx.scale(pop, pop);
      // Splat body: gold for a max hit, red for a hit, blue for a block/miss.
      ctx.fillStyle = e.crit ? '#f2c029' : hit ? '#c81e1e' : '#39557d';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(0, -3, r - 1, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${e.crit ? 13 : 12}px "Trebuchet MS",sans-serif`;
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
