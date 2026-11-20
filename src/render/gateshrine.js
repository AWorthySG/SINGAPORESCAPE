// The A-Worthy Shrine's overhead in the Endless Gate (see game/waves.js): a
// red flash over it when it is struck, and its life bar with "Shrine 82%",
// drawn under the hitsplats. Only while a run is on; the shrine itself is an
// ordinary world object wearing the A-Worthy Monument's picture.

import { TILE } from '../config.js';

const FLASH_MS = 200;   // as long as a struck monster's flash (addHitsplat sets `hurt`)
let _last = 0;

/** Draw the shrine's flash and bar. `ox`, `oy`: the camera's top-left in world pixels. */
export function drawGateShrine(ctx, game, ox, oy, vw, vh) {
  const w = game.waves, s = w?.active && w.shrine;
  if (!s) return;
  const cx = s.x * TILE + TILE / 2 - ox, cy = s.y * TILE + TILE / 2 - oy;
  if (cx < -80 || cx > vw + 80 || cy < -80 || cy > vh + 80) return;
  // The flash counts down here: the shrine isn't a character, so nothing else ticks it.
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const dt = Math.min(100, Math.max(0, now - (_last || now)));
  _last = now;
  if (s.hurt > 0) {
    const k = Math.min(1, s.hurt / FLASH_MS);
    s.hurt = Math.max(0, s.hurt - dt);
    ctx.save();
    ctx.globalAlpha = 0.5 * k;
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 18, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // The bar: wide, over the shrine's top, in the sticker style (white card, navy ink).
  const pct = w.shrinePct(), frac = s.hp / s.maxHp;
  const bw = 64, bh = 7, x = cx - bw / 2, y = cy - 56;
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#22304A'; ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - 4, y - 14, bw + 8, bh + 18, 6); else ctx.rect(x - 4, y - 14, bw + 8, bh + 18);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a1212'; ctx.fillRect(x, y, bw, bh);
  // Gold while it holds, turning red as it fails; it pulses red when low.
  const low = frac <= 0.25;
  ctx.fillStyle = low ? (Math.floor(now / 250) % 2 ? '#ff3b3b' : '#c81e1e') : `hsl(${Math.round(20 + 25 * frac)},90%,${48 + 6 * frac}%)`;
  ctx.fillRect(x, y, bw * Math.max(0, Math.min(1, frac)), bh);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, bw * Math.max(0, Math.min(1, frac)), 2);
  ctx.font = '900 9px Nunito,"Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = low ? '#c81e1e' : '#22304A';
  ctx.fillText(`Shrine ${pct}%`, cx, y - 3);
  ctx.restore();
}
