import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { getItem } from '../data/items.js';

const TERRAIN_COLORS = {
  [TERRAIN.GRASS]: '#4a7a32',
  [TERRAIN.DARKGRASS]: '#3f6c2b',
  [TERRAIN.PATH]: '#9c8456',
  [TERRAIN.WATER]: '#2f6f9e',
  [TERRAIN.SAND]: '#c8b27a',
  [TERRAIN.STONE]: '#8a8378',
  [TERRAIN.WOOD]: '#7a5a36',
};

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
    ctx.fillStyle = '#1a2a18';
    ctx.fillRect(0, 0, vw, vh);

    // Visible tile bounds (with margin).
    const x0 = Math.max(0, Math.floor(ox / TILE) - 1);
    const y0 = Math.max(0, Math.floor(oy / TILE) - 1);
    const x1 = Math.min(game.world.width - 1, Math.ceil((ox + vw) / TILE) + 1);
    const y1 = Math.min(game.world.height - 1, Math.ceil((oy + vh) / TILE) + 1);

    this._drawTerrain(x0, y0, x1, y1, ox, oy, timeMs);
    this._drawGroundDecals(ox, oy);

    // Depth-sorted drawables: objects, ground items, NPCs, player.
    const drawables = [];
    for (const o of game.world.objects) {
      if (o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 1) continue;
      drawables.push({ sortY: o.y, z: 1, draw: () => this._drawObject(o, ox, oy, timeMs) });
    }
    for (const g of game.world.groundItems) {
      if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue;
      drawables.push({ sortY: g.y - 0.3, z: 0, draw: () => this._drawGroundItem(g, ox, oy) });
    }
    for (const n of game.npcs) {
      if (!n.alive) continue;
      const c = n.renderCenter();
      drawables.push({ sortY: c.y / TILE, z: 2, draw: () => this._drawNpc(n, ox, oy) });
    }
    {
      const c = game.player.renderCenter();
      if (game.player.alive) drawables.push({ sortY: c.y / TILE, z: 2, draw: () => this._drawPlayer(ox, oy) });
    }
    drawables.sort((a, b) => (a.sortY - b.sortY) || (a.z - b.z));
    for (const d of drawables) d.draw();

    this._drawOverheads(ox, oy);
  }

  // ---------------- Terrain ----------------
  _drawTerrain(x0, y0, x1, y1, ox, oy, timeMs) {
    const { ctx, game } = this;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = game.world.terrainAt(x, y);
        const sx = Math.round(x * TILE - ox), sy = Math.round(y * TILE - oy);
        if (t === TERRAIN.WATER) {
          const shimmer = Math.sin((x + y) * 0.8 + timeMs * 0.0016) * 10;
          ctx.fillStyle = `rgb(${40}, ${105 + shimmer}, ${158 + shimmer})`;
        } else {
          ctx.fillStyle = TERRAIN_COLORS[t] || '#4a7a32';
        }
        ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
      }
    }
    // Faint grid for that tiled feel.
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = y0; y <= y1 + 1; y++) {
      const sy = Math.round(y * TILE - oy) + 0.5;
      ctx.moveTo(Math.round(x0 * TILE - ox), sy);
      ctx.lineTo(Math.round((x1 + 1) * TILE - ox), sy);
    }
    for (let x = x0; x <= x1 + 1; x++) {
      const sx = Math.round(x * TILE - ox) + 0.5;
      ctx.moveTo(sx, Math.round(y0 * TILE - oy));
      ctx.lineTo(sx, Math.round((y1 + 1) * TILE - oy));
    }
    ctx.stroke();
  }

  _drawGroundDecals(ox, oy) {
    const { ctx, game } = this;
    // Hover tile highlight.
    if (game.input && game.input.inside) {
      const tile = game.camera.screenToTile(game.input.mx, game.input.my);
      if (game.world.inBounds(tile.x, tile.y)) {
        const sx = tile.x * TILE - ox, sy = tile.y * TILE - oy;
        ctx.strokeStyle = 'rgba(255, 235, 130, 0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
      }
    }
    // Movement destination marker.
    const p = game.player;
    if (p.moving || p.path.length) {
      const dest = p.path.length ? p.path[p.path.length - 1] : { x: p.tx, y: p.ty };
      const cx = dest.x * TILE + TILE / 2 - ox, cy = dest.y * TILE + TILE / 2 - oy;
      ctx.strokeStyle = '#ffe66a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
      ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5);
      ctx.stroke();
    }
  }

  // ---------------- Objects ----------------
  _drawObject(o, ox, oy, timeMs) {
    const cx = o.x * TILE + TILE / 2 - ox;
    const cy = o.y * TILE + TILE / 2 - oy;
    const t = o.def.type;
    if (t === 'tree') return this._drawTree(o, cx, cy);
    if (t === 'rock') return this._drawRock(o, cx, cy);
    if (t === 'fishing') return this._drawFishing(cx, cy, timeMs);
    if (t === 'fire') return this._drawFire(cx, cy, timeMs);
    // Generic emoji-based objects (range, furnace, anvil, bank, scenery).
    this._emoji(o.def.emoji, cx, cy, TILE * 0.95);
  }

  _drawTree(o, cx, cy) {
    const { ctx } = this;
    this._shadow(cx, cy + 8, 14, 6);
    if (o.depleted) {
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(cx - 5, cy + 2, 10, 10);
      ctx.fillStyle = '#503418';
      ctx.fillRect(cx - 5, cy + 2, 10, 3);
      return;
    }
    // trunk
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(cx - 4, cy, 8, 14);
    // canopy
    const r = o.objId === 'willow' ? 16 : o.objId === 'oak' ? 18 : 15;
    const green = o.objId === 'willow' ? '#5a8a3a' : '#2f6f2f';
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.arc(cx, cy - 6, r, 0, Math.PI * 2);
    ctx.arc(cx - r * 0.6, cy - 2, r * 0.7, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.6, cy - 2, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 10, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawRock(o, cx, cy) {
    const { ctx } = this;
    this._shadow(cx, cy + 8, 13, 5);
    ctx.fillStyle = o.depleted ? '#5c5c5c' : '#7d7d7d';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 8);
    ctx.lineTo(cx - 8, cy - 8);
    ctx.lineTo(cx + 4, cy - 11);
    ctx.lineTo(cx + 12, cy + 2);
    ctx.lineTo(cx + 8, cy + 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 4, cy - 11); ctx.lineTo(cx - 2, cy - 2);
    ctx.closePath(); ctx.fill();
    if (!o.depleted && o.def.ore) {
      ctx.fillStyle = o.def.ore;
      for (const [dx, dy] of [[-4, 0], [3, 3], [0, -4], [6, -2]]) {
        ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  _drawFishing(cx, cy, timeMs) {
    const { ctx } = this;
    const phase = timeMs * 0.004;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const r = 4 + ((phase + i * 0.9) % 2.4) * 6;
      ctx.globalAlpha = 0.5 - ((phase + i * 0.9) % 2.4) / 5;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this._emoji('🐟', cx + 4, cy - 2, 14);
  }

  _drawFire(cx, cy, timeMs) {
    const { ctx } = this;
    const flick = 1 + Math.sin(timeMs * 0.02) * 0.12;
    ctx.fillStyle = '#3a2a16';
    ctx.fillRect(cx - 8, cy + 8, 16, 4);
    this._emoji('🔥', cx, cy, TILE * 0.85 * flick);
  }

  _drawGroundItem(g, ox, oy) {
    const cx = g.x * TILE + TILE / 2 - ox;
    const cy = g.y * TILE + TILE * 0.7 - oy;
    this._emoji(getItem(g.id).icon, cx, cy, 18);
  }

  // ---------------- Characters ----------------
  _drawNpc(n, ox, oy) {
    const c = n.renderCenter();
    const cx = c.x - ox, cy = c.y - oy;
    this._shadow(cx, cy + 11, 11, 5);
    this._emoji(n.def.emoji, cx, cy - 2, TILE * 0.85);
  }

  _drawPlayer(ox, oy) {
    const { ctx, game } = this;
    const c = game.player.renderCenter();
    const cx = c.x - ox, cy = c.y - oy;
    this._shadow(cx, cy + 12, 11, 5);
    // Body
    const hasBody = !!game.equipment.get('body');
    ctx.fillStyle = hasBody ? '#9aa3ad' : '#7a4a8a';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx - 7, cy - 2, 14, 16, 4) : ctx.rect(cx - 7, cy - 2, 14, 16);
    ctx.fill();
    // Head
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(cx, cy - 9, 7, 0, Math.PI * 2); ctx.fill();
    // Hair
    ctx.fillStyle = '#3a2a18';
    ctx.beginPath(); ctx.arc(cx, cy - 11, 7, Math.PI, Math.PI * 2); ctx.fill();
    // Weapon
    const w = game.equipment.get('weapon');
    if (w) {
      ctx.strokeStyle = '#dcdcdc';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + 9, cy + 12); ctx.lineTo(cx + 13, cy - 8); ctx.stroke();
    }
  }

  // ---------------- Overhead UI (bars, hitsplats, name) ----------------
  _drawOverheads(ox, oy) {
    const { ctx, game } = this;
    // NPC health bars while in combat.
    for (const n of game.npcs) {
      if (!n.alive || n.combatLatch <= 0) continue;
      const c = n.renderCenter();
      this._healthBar(c.x - ox, c.y - oy - 24, n.hp / n.maxHp);
    }
    // Player name + (combat) bar.
    if (game.player.alive) {
      const c = game.player.renderCenter();
      const px = c.x - ox, py = c.y - oy;
      if (game.player.target) this._healthBar(px, py - 26, game.player.hp / game.skills.hitpoints);
      ctx.font = '11px Trebuchet MS';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe66a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(game.player.name, px, py - 28);
      ctx.fillText(game.player.name, px, py - 28);
    }
    // Hitsplats.
    for (const e of game.effects) {
      if (e.type !== 'hitsplat') continue;
      const c = e.entity.renderCenter ? e.entity.renderCenter() : { x: e.entity.x * TILE, y: e.entity.y * TILE };
      const px = c.x - ox, py = c.y - oy - 4 - (1100 - e.life) * 0.012;
      const hit = e.dmg > 0;
      ctx.fillStyle = hit ? '#c81e1e' : '#3a6fd0';
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Trebuchet MS';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(e.dmg), px, py + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }

  _healthBar(cx, cy, frac) {
    const { ctx } = this;
    const w = 28, h = 4;
    frac = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = '#c81e1e';
    ctx.fillRect(cx - w / 2, cy, w, h);
    ctx.fillStyle = '#00b000';
    ctx.fillRect(cx - w / 2, cy, w * frac, h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - w / 2, cy, w, h);
  }

  // ---------------- Primitives ----------------
  _emoji(ch, cx, cy, size) {
    const { ctx } = this;
    ctx.font = `${Math.round(size)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  _shadow(cx, cy, rx, ry) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
