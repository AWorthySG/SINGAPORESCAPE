// How the Priest's Light path and the Zealot's Flame path look (magic.js
// radiance ... martyrdom; their effects are game/classelements.js):
//  - drawClassShot: each element's own bolt in place of the plain glowing orb:
//    Radiance a straight beam, Grace a soft golden orb shedding feather motes,
//    Judgement a plain blade of light dropping onto the foe, Sanctuary a glowing
//    circle spreading on the ground, Holy Fire a white-gold flame, Wrath a
//    red-gold shock that swells with the wrath stored, Ash a grey-orange
//    swirl of cinders, Martyrdom crimson-gold sparks drawn out of you;
//  - drawClassEffect: the brands' flare as they burst, an ash burst on a death,
//    a chime of light as a ward forms (game.effects of type 'classfx');
//  - drawClassAuras: the Grace ward's golden bubble round you, a Zealot's
//    stored Wrath as a red-gold glow and a small meter at your feet, and the
//    Holy Fire brands as flame pips over each branded foe.
// A few paths and arcs a frame, nothing allocated; low graphics drops the
// trails and motes, and Reduce motion keeps everything steady (no flicker).
// No religious symbols anywhere: beams, blades, circles, flames and sparks.
import { ELEMENTS } from '../data/magic.js';

const INK = '#22304A';
const TAU = Math.PI * 2;
const SHOTS = new Set(['radiance', 'grace', 'judgement', 'sanctuary', 'holyfire', 'wrath', 'ash', 'martyrdom']);

/** Draw a spell bolt of one of the eight elements (`e` a projectile effect,
 *  `t` 0..1 through its flight). False for any other bolt (drawn as before). */
export function drawClassShot(ctx, e, t, ox, oy, game) {
  if (!e.el || !SHOTS.has(e.el)) return false;
  const low = !!game?.lowFx, calm = !!game?.reduceMotion;
  const sx = e.x - ox, sy = e.y - oy, tx = e.ex - ox, ty = e.ey - oy;
  const x = sx + (tx - sx) * t, y = sy + (ty - sy) * t;
  const k = e.crit ? 1.4 : 1;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (e.el) {
    case 'radiance': {
      // A straight beam: it reaches the foe in the first third of the flight, then fades.
      const reach = Math.min(1, t / 0.3), a = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
      const hx = sx + (tx - sx) * reach, hy = sy + (ty - sy) * reach;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * a; ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 8 * k;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = e.color; ctx.lineWidth = 3.2 * k;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2 * k;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = '#fff6c8'; ctx.globalAlpha = 0.6 * a;
      ctx.beginPath(); ctx.arc(sx, sy, 4 * k, 0, TAU); ctx.fill();   // the light at your hand
      break;
    }
    case 'grace': {
      // A soft golden orb, feather-like motes drifting off behind it.
      if (!low) {
        ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = INK; ctx.lineWidth = 0.5;
        for (let i = 1; i <= 3; i++) {
          const tt = Math.max(0, t - i * 0.09), mx = sx + (tx - sx) * tt, my = sy + (ty - sy) * tt + i * 2.5;
          const wob = calm ? 0 : Math.sin(t * 12 + i * 2) * 3;
          ctx.globalAlpha = 0.85 - i * 0.2;
          ctx.save(); ctx.translate(mx + wob, my); ctx.rotate(0.6 + i * 0.7 + wob * 0.1);
          ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffd98a';
      ctx.beginPath(); ctx.arc(x, y, 8 * k, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(x, y, 4.2 * k, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - 1.2, y - 1.2, 1.4 * k, 0, TAU); ctx.fill();
      break;
    }
    case 'judgement': {
      // A plain blade of light (no guard) drops point first onto the foe; a ring
      // of light spreads on the ground as it strikes.
      const fall = Math.min(1, t / 0.65), bx = tx, by = ty - 78 * (1 - fall * fall);
      const a = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      if (t > 0.55) {
        const g = (t - 0.55) / 0.45;
        ctx.globalAlpha = (1 - g) * 0.9; ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.ellipse(tx, ty + 9, 6 + 20 * g * k, (6 + 20 * g * k) * 0.38, 0, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 0.3 * a; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#d8e8ff';
      ctx.beginPath(); ctx.ellipse(bx, by - 12 * k, 6 * k, 20 * k, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
      ctx.fillStyle = '#eef4ff'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by + 2);                         // the point, at the foe
      ctx.lineTo(bx - 3.4 * k, by - 10 * k); ctx.lineTo(bx - 2.6 * k, by - 28 * k);
      ctx.lineTo(bx, by - 31 * k); ctx.lineTo(bx + 2.6 * k, by - 28 * k); ctx.lineTo(bx + 3.4 * k, by - 10 * k);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#9db8e8'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(bx, by - 2); ctx.lineTo(bx, by - 28 * k); ctx.stroke();
      break;
    }
    case 'sanctuary': {
      // A glowing circle spreading on the ground round the foe, motes rising off it.
      const r = (8 + 52 * Math.min(1, t / 0.7)) * k, a = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4, gy = ty + 9;
      ctx.globalAlpha = 0.22 * a; ctx.fillStyle = '#fff3c0';
      ctx.beginPath(); ctx.ellipse(tx, gy, r, r * 0.4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = '#f0d070'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(tx, gy, r, r * 0.4, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#fffbe6'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(tx, gy, r * 0.62, r * 0.25, 0, 0, TAU); ctx.stroke();
      if (!low) {
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff6c8';
        for (let i = 0; i < 7; i++) {
          const ang = i * 0.9, rise = (calm ? 0.5 : (t * 1.6 + i * 0.37) % 1);
          ctx.globalAlpha = a * (1 - rise);
          ctx.beginPath(); ctx.arc(tx + Math.cos(ang) * r * 0.8, gy + Math.sin(ang) * r * 0.32 - rise * 26, 1.6, 0, TAU); ctx.fill();
        }
      }
      // ...and a faint thread of light from your hand to it.
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * a; ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      break;
    }
    case 'holyfire': {
      // A white-gold flame flying point first, trailing embers.
      const ang = Math.atan2(ty - sy, tx - sx), fl = calm ? 1 : 0.85 + 0.15 * Math.sin(t * 40);
      if (!low) {
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffc860';
        for (let i = 1; i <= 3; i++) {
          const tt = Math.max(0, t - i * 0.08);
          ctx.globalAlpha = 0.5 - i * 0.12;
          ctx.beginPath(); ctx.arc(sx + (tx - sx) * tt, sy + (ty - sy) * tt - i * 1.5, (2.2 - i * 0.4) * k, 0, TAU); ctx.fill();
        }
      }
      ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k * fl, k);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = e.color; ctx.strokeStyle = '#e8a030'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(0, -5, -9, 0); ctx.quadraticCurveTo(0, 5, 6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(2, 0, 2.6, 1.5, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'wrath': {
      // A red-gold shock, bigger and brighter the more wrath it carries.
      const p = Math.max(0, Math.min(1, (e.power || 0) / (ELEMENTS.wrath.retribution.cap || 0.5))), s = k * (1 + p * 0.9);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + p * 0.3; ctx.fillStyle = '#ff6a3a';
      ctx.beginPath(); ctx.arc(x, y, 8 * s, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffb060'; ctx.lineWidth = 1.6;
      const ph = calm ? 0.5 : (t * 3) % 1;
      ctx.beginPath(); ctx.arc(x, y, (5 + 7 * ph) * s, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(x, y, 3.8 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe0a0'; ctx.beginPath(); ctx.arc(x, y, 1.8 * s, 0, TAU); ctx.fill();
      break;
    }
    case 'ash': {
      // A grey-orange swirl: ash and cinders circling the bolt.
      const n = low ? 3 : 6, spin = calm ? 0 : t * 14;
      for (let i = 0; i < n; i++) {
        const a = spin + i * TAU / n, r = 5.5 * k;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = i % 2 ? '#ff9a40' : '#b8aca6';
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, (i % 2 ? 1.5 : 2.2) * k, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#8a7a72'; ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(x, y, 3 * k, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb070'; ctx.beginPath(); ctx.arc(x, y, 1.3 * k, 0, TAU); ctx.fill();
      break;
    }
    case 'martyrdom': {
      // Crimson-gold sparks drawn out of you and along the bolt's path, and a heavy crimson core.
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#d8304a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.stroke();
      if (!low) {
        ctx.fillStyle = '#ffd27a';
        for (let i = 0; i < 5; i++) {
          const u = (i + (calm ? 0.5 : (t * 4) % 1)) / 5 * t;
          ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.arc(sx + (tx - sx) * u + Math.sin(i * 2.3) * 3, sy + (ty - sy) * u + Math.cos(i * 1.7) * 3, 1.3, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#ffcf70';
      ctx.beginPath(); ctx.arc(x, y, 7.5 * k, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = e.color; ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(x, y, 4.4 * k, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1.6 * k, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
  return true;
}

/** A one-off effect from the Light or Flame path (a game.effects entry of type 'classfx'). */
export function drawClassEffect(ctx, e, ox, oy) {
  const t = 1 - e.life / e.maxLife, x = e.x - ox, y = e.y - oy, a = Math.max(0, 1 - t);
  ctx.save();
  ctx.lineCap = 'round';
  if (e.kind === 'flare') {
    // The brands bursting: a white-gold flare, rays and a ring.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 * a; ctx.fillStyle = '#ffe9a0';
    ctx.beginPath(); ctx.arc(x, y, 10 + 18 * t, 0, TAU); ctx.fill();
    ctx.globalAlpha = a; ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const ang = i * TAU / 10, r0 = 8 + 10 * t, r1 = r0 + 12 * (1 - t * 0.5);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1); ctx.stroke();
    }
    ctx.strokeStyle = '#ffb040'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(x, y, 6 + 30 * t, 0, TAU); ctx.stroke();
  } else if (e.kind === 'ash') {
    // A death bursting into cinders: a grey puff and orange sparks flung out.
    ctx.globalAlpha = 0.55 * a; ctx.fillStyle = '#a89c96';
    for (let i = 0; i < 5; i++) {
      const ang = i * 1.26, r = 6 + 16 * t;
      ctx.beginPath(); ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.6, 6 + 5 * t, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = '#ff9a40';
    for (let i = 0; i < 9; i++) {
      const ang = i * 0.7 + 0.3, r = 4 + 34 * t;
      ctx.beginPath(); ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.7 - 10 * t, 1.6, 0, TAU); ctx.fill();
    }
  } else if (e.kind === 'ward') {
    // A ward forming: a soft golden ring closing in on you, with a glint.
    ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 2, 30 - 10 * t, 34 - 12 * t, 0, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fffbe0';
    ctx.beginPath(); ctx.arc(x + 10, y - 16 + 4 * t, 2.4 * a, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** The lasting looks: the ward round you, stored Wrath, and brands on foes. */
export function drawClassAuras(ctx, game, ox, oy, timeMs = 0) {
  const p = game.player;
  if (!p?.alive) return;
  const calm = !!game.reduceMotion;
  const c = p.renderCenter(), x = c.x - ox, y = c.y - oy;
  // Grace's ward: a soft golden bubble, fuller the more it holds.
  if (p.ward > 0) {
    const cap = Math.max(1, game.maxHp() * ELEMENTS.grace.ward.cap), f = Math.min(1, p.ward / cap);
    const pulse = calm ? 0 : Math.sin(timeMs * 0.004) * 0.06;
    ctx.save();
    ctx.globalAlpha = 0.1 + 0.12 * f; ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.ellipse(x, y - 4, 20, 25, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.45 + 0.35 * f + pulse; ctx.strokeStyle = '#f0c860'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 20, 25, 0, 0, TAU); ctx.stroke();
    // A highlight sliding round the bubble (still with Reduce motion on).
    const ang = calm ? -2.2 : -2.2 + timeMs * 0.0015;
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 20, 25, 0, ang, ang + 0.7); ctx.stroke();
    ctx.restore();
  }
  // A Zealot's stored Wrath: a red-gold glow at the feet, and a small meter.
  if (game.jobClass === 'zealot' && p.wrath > 0) {
    const cap = ELEMENTS.wrath.retribution, f = Math.min(1, cap.per * p.wrath / Math.max(1, game.maxHp()) / cap.cap);
    if (f > 0.02) {
      const pulse = calm ? 0 : Math.sin(timeMs * 0.006) * 0.08;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 + 0.3 * f + pulse; ctx.fillStyle = '#ff5a2a';
      ctx.beginPath(); ctx.ellipse(x, y + 12, 12 + 8 * f, 5 + 3 * f, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9;
      ctx.strokeStyle = 'rgba(34,48,74,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y + 12, 15, 6, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.strokeStyle = f >= 1 ? '#ffd27a' : '#ff7a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y + 12, 15, 6, 0, Math.PI * 0.85 - Math.PI * 0.7 * f, Math.PI * 0.85); ctx.stroke();
      ctx.restore();
    }
  }
  // Holy Fire's brands: one flame pip each over the foe's life bar.
  if (game.jobClass !== 'zealot') return;
  const t = game.tickCount, vw = game.camera?.viewW || 1e4, vh = game.camera?.viewH || 1e4;
  for (const n of game.nearbyNpcs ? game.nearbyNpcs() : []) {
    const b = n.brand;
    if (!b || !(b.until > t) || !n.alive) continue;
    const nc = n.renderCenter(), nx = nc.x - ox, ny = nc.y - oy - (20 * (n.def.scale || 1)) - 14;
    if (nx < -40 || nx > vw + 40 || ny < -40 || ny > vh + 40) continue;
    ctx.save();
    for (let i = 0; i < b.n; i++) {
      const px = nx + (i - (b.n - 1) / 2) * 9, fl = calm ? 0 : Math.sin(timeMs * 0.02 + i) * 0.8;
      ctx.fillStyle = '#ffc94a'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, ny - 8.5 - fl); ctx.quadraticCurveTo(px + 4.6, ny - 1.5, px, ny + 2.4); ctx.quadraticCurveTo(px - 4.6, ny - 1.5, px, ny - 8.5 - fl); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(px, ny - 0.6, 1.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
