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

    this._drawTerrain(x0, y0, x1, y1, ox, oy, timeMs);
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
      drawables.push({ sortY: g.y - 0.3, z: 0, draw: () => drawGroundItem(ctx, g.id, cx, cy) });
    }
    for (const n of game.npcs) {
      if (!n.alive) continue;
      const c = n.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      drawables.push({ sortY: c.y / TILE, z: 2, draw: () => {
        drawShadow(ctx, cx, cy + 12, 10, 4.5);
        drawCreature(ctx, n.npcId, cx, cy - 2, { time: timeMs, facing: n.facing, moving: n.isMoving });
      } });
    }
    if (game.player.alive) {
      const c = game.player.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      drawables.push({ sortY: c.y / TILE, z: 2, draw: () => {
        drawShadow(ctx, cx, cy + 13, 10, 4.5);
        drawPlayer(ctx, cx, cy - 2, {
          time: timeMs, facing: game.player.facing, moving: game.player.isMoving,
          hasBody: !!game.equipment.get('body'), hasWeapon: !!game.equipment.get('weapon'),
        });
      } });
    }
    drawables.sort((a, b) => (a.sortY - b.sortY) || (a.z - b.z));
    for (const d of drawables) d.draw();

    this._drawVignette(vw, vh);
    this._drawParticles(ox, oy);
    this._drawOverheads(ox, oy);
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
      ctx.fillStyle = 'rgba(40,80,30,0.35)';
      for (let i = 0; i < 3; i++) {
        const hx = hash(x * 7 + i, y * 13 - i), hy = hash(x * 3 - i, y * 11 + i);
        const px = sx + hx * (TILE - 6) + 3, py = sy + hy * (TILE - 6) + 3;
        ctx.fillRect(px, py - 3, 1.4, 3);
        ctx.fillRect(px + 1.6, py - 4, 1.4, 4);
      }
      if (h > 0.92) { ctx.fillStyle = '#d23b6e'; ctx.beginPath(); ctx.arc(sx + 8 + h * 12, sy + 10, 1.4, 0, 6.3); ctx.fill(); }
    } else if (t === TERRAIN.PATH || t === TERRAIN.SAND) {
      ctx.fillStyle = t === TERRAIN.PATH ? 'rgba(120,98,58,0.5)' : 'rgba(160,140,90,0.5)';
      for (let i = 0; i < 4; i++) {
        const px = sx + hash(x * 5 + i, y) * TILE, py = sy + hash(x, y * 5 + i) * TILE;
        ctx.fillRect(px, py, 2, 2);
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
    const wave = Math.sin((x + y) * 0.7 + timeMs * 0.0016) * 8 + Math.sin((x - y) * 0.5 + timeMs * 0.0011) * 6;
    ctx.fillStyle = `rgb(${36 + wave * 0.4|0},${104 + wave|0},${156 + wave|0})`;
    ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
    // moving highlights
    const hl = (Math.sin((x * 1.3 + y * 0.7) + timeMs * 0.002) + 1) / 2;
    if (hl > 0.6) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      const yy = sy + ((timeMs * 0.02 + x * 9) % TILE);
      ctx.fillRect(sx + 4, yy, TILE - 8, 1.5);
    }
    // foam on shore edges
    const land = (tt) => tt !== TERRAIN.WATER;
    ctx.fillStyle = 'rgba(220,240,255,0.5)';
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
    // warm ambient sunlight washing in from the upper-left (golden-hour feel)
    const warm = ctx.createLinearGradient(0, 0, vw * 0.55, vh);
    warm.addColorStop(0, 'rgba(255,214,140,0.11)');
    warm.addColorStop(0.45, 'rgba(255,198,118,0.035)');
    warm.addColorStop(1, 'rgba(30,52,72,0.06)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, vw, vh);
    // soft edge vignette
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.36, vw / 2, vh / 2, Math.max(vw, vh) * 0.74);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(16,24,16,0.30)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  // ---------------- Overhead UI (bars, hitsplats, name) ----------------
  _drawOverheads(ox, oy) {
    const { ctx, game } = this;
    for (const n of game.npcs) {
      if (!n.alive || n.combatLatch <= 0) continue;
      const c = n.renderCenter();
      this._healthBar(c.x - ox, c.y - oy - 26, n.hp / n.maxHp);
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
      const px = c.x - ox, py = c.y - oy - 6 - (1100 - e.life) * 0.012;
      const hit = e.dmg > 0;
      const a = Math.min(1, e.life / 350);
      ctx.globalAlpha = a;
      ctx.fillStyle = hit ? '#c81e1e' : '#39557d';
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(px, py - 3, 9, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Trebuchet MS",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(e.dmg), px, py + 1);
      ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    }
  }

  _healthBar(cx, cy, frac) {
    const { ctx } = this;
    const w = 30, h = 5;
    frac = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - w / 2 - 1, cy - 1, w + 2, h + 2);
    ctx.fillStyle = '#b81818'; ctx.fillRect(cx - w / 2, cy, w, h);
    ctx.fillStyle = '#2fd24a'; ctx.fillRect(cx - w / 2, cy, w * frac, h);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(cx - w / 2, cy, w * frac, 1.5);
  }
}

function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
