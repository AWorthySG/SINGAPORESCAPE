// Vector sprite library — cohesive hand-drawn art for creatures and world objects,
// replacing the old emoji rendering. Everything is drawn relative to a centre
// point (cx, cy) with the entity's "feet" near cy + 13.
import { itemIconImage } from './icons.js';

const OUTLINE = 'rgba(26,18,12,0.55)';

// Lazy-loaded brand logos so the real artwork can be embedded into the world
// (on the A-Worthy Monument and the Hyco Education obelisk). Guarded for headless.
const _logoCache = {};
function logoImage(name) {
  if (_logoCache[name] !== undefined) return _logoCache[name];
  if (typeof Image === 'undefined') { _logoCache[name] = null; return null; }
  const img = new Image();
  img.src = `assets/${name}.svg`;
  _logoCache[name] = img;
  return img;
}
function drawLogo(ctx, name, x, y, w, h) {
  const img = logoImage(name);
  if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, y, w, h);
  return !!(img && img.complete && img.naturalWidth);
}

function path(ctx, fn) { ctx.beginPath(); fn(); }
function fill(ctx, color) { ctx.fillStyle = color; ctx.fill(); }
function line(ctx, color = OUTLINE, w = 2) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Run `draw` centred at (cx,cy), mirrored if facing left, with a vertical bob.
function staged(ctx, cx, cy, opts, draw) {
  const bob = opts.moving ? Math.sin((opts.time || 0) * 0.018 + cx) * 1.6 : Math.sin((opts.time || 0) * 0.004 + cx) * 0.6;
  const s = opts.scale || 1;
  const fx = (opts.facing && opts.facing.dx < 0) ? -1 : 1;
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(fx * s, s);
  draw(ctx);
  ctx.restore();
}

// ---------------- Ground shadow ----------------
export function drawShadow(ctx, cx, cy, rx = 11, ry = 5) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.26)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fill();
}

// ================= CREATURES =================
// Monsters render via colour-tinted archetypes (def.sprite + def.color). Townsfolk
// keep bespoke human palettes. Bosses get an aura + crown and are scaled by the caller.
export function drawCreature(ctx, npcId, cx, cy, opts = {}) {
  const arch = opts.sprite && ARCH[opts.sprite];
  if (arch) {
    return staged(ctx, cx, cy, opts, (c) => {
      if (opts.boss) bossAura(c);
      arch(c, opts.color || '#8a8a8a');
      if (opts.boss) crown(c);
    });
  }
  const TOWN = {
    banker: { top: '#2f4b8a', skin: '#e8b98a', hair: '#3a2a18', apron: '#d8c089' },
    shopkeeper: { top: '#7a3b1d', skin: '#e0aa78', hair: '#272015', apron: '#cdbfa0' },
    hawker: { top: '#b23b2e', skin: '#e8b98a', hair: '#2a2018', hat: '#f0ead8', apron: '#f0ead8' },
    guide: { top: '#3d6b3a', skin: '#e6b886', hair: '#cfc4b0', hat: '#6b4a2a' },
    villager: { top: '#6a5aa0', skin: '#e8b98a', hair: '#4a3320' },
  };
  const p = TOWN[npcId] || TOWN.villager;
  return staged(ctx, cx, cy, opts, (c) => human(c, p));
}

// Tint helper: k in [-1,1] darkens/lightens a #rrggbb colour.
function shade(hex, k) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { const f = 1 + k; r *= f; g *= f; b *= f; }
  else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function bossAura(ctx) {
  const g = ctx.createRadialGradient(0, -2, 2, 0, -2, 24);
  g.addColorStop(0, 'rgba(255,90,70,0.34)'); g.addColorStop(1, 'rgba(255,90,70,0)');
  ctx.fillStyle = g; circle(ctx, 0, -2, 24); ctx.fill();
}
function crown(ctx) {
  ctx.fillStyle = '#ffd24a';
  path(ctx, () => { ctx.moveTo(-7, -20); ctx.lineTo(-5, -27); ctx.lineTo(-2, -22); ctx.lineTo(0, -28); ctx.lineTo(2, -22); ctx.lineTo(5, -27); ctx.lineTo(7, -20); });
  ctx.fill(); line(ctx, OUTLINE, 1);
}

// ---- archetypes (ctx, col) ----
function beast(ctx, col) {
  ctx.fillStyle = shade(col, -0.3); rr(ctx, -8, 7, 3.5, 6, 1); ctx.fill(); rr(ctx, 4, 7, 3.5, 6, 1); ctx.fill();
  ellipse(ctx, -1, 2, 12, 8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.35);
  path(ctx, () => { ctx.moveTo(-9, -5); ctx.lineTo(-7, -10); ctx.lineTo(-4, -5); ctx.lineTo(-1, -10); ctx.lineTo(2, -5); }); ctx.fill();
  circle(ctx, 10, 0, 6); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.2); ellipse(ctx, 15, 1, 3, 2.4); ctx.fill();
  ctx.fillStyle = '#f4efe0'; path(ctx, () => { ctx.moveTo(14, 3); ctx.lineTo(17, 0); ctx.lineTo(15, 4); }); ctx.fill();
  circle(ctx, 11, -2, 1); fill(ctx, '#1a140d');
}
function rodent(ctx, col) {
  ctx.strokeStyle = shade(col, 0.3); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(-18, 2, -14, -6); ctx.stroke();
  ellipse(ctx, 0, 3, 10, 7); fill(ctx, col); line(ctx);
  circle(ctx, 9, 0, 5); fill(ctx, col); line(ctx);
  circle(ctx, 8, -5, 3); fill(ctx, shade(col, 0.3)); line(ctx, OUTLINE, 1.2);
  path(ctx, () => { ctx.moveTo(13, -1); ctx.lineTo(16, 1); ctx.lineTo(13, 3); }); fill(ctx, shade(col, 0.3));
  circle(ctx, 11, -1, 1); fill(ctx, '#1a140d');
}
function primate(ctx, col) {
  ctx.strokeStyle = shade(col, -0.1); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7, 6); ctx.quadraticCurveTo(-18, 4, -15, -8); ctx.stroke();
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -6, 5, 4, 8, 2); ctx.fill(); rr(ctx, 2, 5, 4, 8, 2); ctx.fill();
  ellipse(ctx, 0, 1, 9, 9); fill(ctx, col); line(ctx);
  circle(ctx, 1, -10, 6.5); fill(ctx, col); line(ctx);
  ellipse(ctx, 1, -9, 4.2, 5); fill(ctx, shade(col, 0.4));
  circle(ctx, -1, -10, 1); fill(ctx, '#1a140d'); circle(ctx, 3, -10, 1); fill(ctx, '#1a140d');
}
function reptile(ctx, col) {
  ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, 4); ctx.quadraticCurveTo(-24, 6, -20, -4); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -6, 6, 5, 5, 2); ctx.fill(); rr(ctx, 3, 6, 5, 5, 2); ctx.fill();
  ellipse(ctx, 0, 2, 13, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = 'rgba(20,30,10,0.4)'; circle(ctx, -4, 0, 1.6); ctx.fill(); circle(ctx, 2, 3, 1.6); ctx.fill();
  ellipse(ctx, 12, 0, 7, 5); fill(ctx, col); line(ctx); circle(ctx, 14, -2, 1.1); fill(ctx, '#1a140d');
}
function serpent(ctx, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, 10); ctx.quadraticCurveTo(8, 8, -4, 0); ctx.quadraticCurveTo(-14, -6, 4, -8); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = shade(col, 0.25); ctx.beginPath(); ctx.moveTo(-10, 10); ctx.quadraticCurveTo(8, 8, -4, 0); ctx.stroke(); ctx.lineCap = 'butt';
  circle(ctx, 5, -9, 4); fill(ctx, col); line(ctx, OUTLINE, 1.2);
  circle(ctx, 6, -10, 0.9); fill(ctx, '#ffe24a');
  ctx.strokeStyle = '#c83b3b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(9, -9); ctx.lineTo(12, -9); ctx.stroke();
}
function crab(ctx, col) {
  ctx.fillStyle = shade(col, -0.3); for (const x of [-9, -4, 4, 9]) { rr(ctx, x, 6, 2.4, 5, 1); ctx.fill(); }
  ellipse(ctx, 0, 2, 12, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = col; circle(ctx, -12, -2, 3.6); ctx.fill(); line(ctx, OUTLINE, 1.2); circle(ctx, 12, -2, 3.6); ctx.fill(); line(ctx, OUTLINE, 1.2);
  ctx.fillStyle = shade(col, 0.25); ellipse(ctx, 0, 0, 7, 3); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(-3, -9); ctx.moveTo(3, -6); ctx.lineTo(3, -9); ctx.stroke();
  circle(ctx, -3, -9, 1.4); fill(ctx, '#1a140d'); circle(ctx, 3, -9, 1.4); fill(ctx, '#1a140d');
}
function fowl(ctx, col) {
  ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, 13); ctx.moveTo(3, 8); ctx.lineTo(3, 13); ctx.stroke();
  ellipse(ctx, 0, 2, 9, 8); fill(ctx, col); line(ctx);
  path(ctx, () => { ctx.moveTo(-7, -2); ctx.lineTo(-14, -8); ctx.lineTo(-7, 4); }); fill(ctx, shade(col, -0.15)); line(ctx);
  circle(ctx, 7, -7, 5); fill(ctx, shade(col, 0.1)); line(ctx);
  circle(ctx, 7, -12, 2.2); fill(ctx, '#d23b2e');
  path(ctx, () => { ctx.moveTo(11, -7); ctx.lineTo(15, -6); ctx.lineTo(11, -4); }); fill(ctx, '#f0a93b');
  circle(ctx, 8.5, -8, 1); fill(ctx, '#1a140d');
}
function greenman(ctx, col) {
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  rr(ctx, -7, -4, 14, 13, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = '#7a5a2a'; rr(ctx, -7, 6, 14, 5, 2); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -10, -3, 4, 9, 2); ctx.fill(); rr(ctx, 6, -3, 4, 9, 2); ctx.fill();
  circle(ctx, 0, -10, 7); fill(ctx, shade(col, 0.1)); line(ctx);
  path(ctx, () => { ctx.moveTo(-6, -11); ctx.lineTo(-12, -14); ctx.lineTo(-6, -7); }); fill(ctx, shade(col, 0.1)); line(ctx, OUTLINE, 1.2);
  path(ctx, () => { ctx.moveTo(6, -11); ctx.lineTo(12, -14); ctx.lineTo(6, -7); }); fill(ctx, shade(col, 0.1)); line(ctx, OUTLINE, 1.2);
  circle(ctx, -2.5, -10, 1.3); fill(ctx, '#ffe24a'); circle(ctx, 3, -10, 1.3); fill(ctx, '#ffe24a');
}
function spider(ctx, col) {
  ctx.strokeStyle = shade(col, -0.1); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(s * (8 + i * 3), -2 + i * 4); ctx.lineTo(s * (11 + i * 3), 6 + i * 2); ctx.stroke(); }
  ctx.lineCap = 'butt';
  ellipse(ctx, 0, 3, 8, 7); fill(ctx, col); line(ctx);
  circle(ctx, 0, -4, 4.5); fill(ctx, shade(col, -0.15)); line(ctx);
  circle(ctx, -2, -5, 1); fill(ctx, '#e23'); circle(ctx, 2, -5, 1); fill(ctx, '#e23');
}
function slime(ctx, col) {
  path(ctx, () => { ctx.moveTo(-10, 10); ctx.quadraticCurveTo(-12, -6, 0, -7); ctx.quadraticCurveTo(12, -6, 10, 10); }); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.3); ellipse(ctx, -3, -2, 3, 4); ctx.fill();
  circle(ctx, -3, 2, 1.3); fill(ctx, '#1a140d'); circle(ctx, 3, 2, 1.3); fill(ctx, '#1a140d');
}
function ghost(ctx, col) {
  ctx.globalAlpha = 0.85;
  path(ctx, () => { ctx.moveTo(-8, 10); ctx.lineTo(-8, -6); ctx.quadraticCurveTo(-8, -14, 0, -14); ctx.quadraticCurveTo(8, -14, 8, -6); ctx.lineTo(8, 10); ctx.lineTo(5, 7); ctx.lineTo(2, 10); ctx.lineTo(-1, 7); ctx.lineTo(-4, 10); ctx.lineTo(-8, 7); }); fill(ctx, col); line(ctx);
  ctx.globalAlpha = 1;
  circle(ctx, -3, -7, 1.4); fill(ctx, '#22202a'); circle(ctx, 3, -7, 1.4); fill(ctx, '#22202a');
}
function demon(ctx, col) {
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  rr(ctx, -7, -4, 14, 12, 4); fill(ctx, col); line(ctx);
  ctx.fillStyle = col; rr(ctx, -11, -3, 4, 9, 2); ctx.fill(); rr(ctx, 7, -3, 4, 9, 2); ctx.fill();
  circle(ctx, 0, -10, 6.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.3); path(ctx, () => { ctx.moveTo(-6, -13); ctx.lineTo(-9, -19); ctx.lineTo(-3, -14); }); ctx.fill(); path(ctx, () => { ctx.moveTo(6, -13); ctx.lineTo(9, -19); ctx.lineTo(3, -14); }); ctx.fill();
  circle(ctx, -2.3, -10, 1.1); fill(ctx, '#ffd24a'); circle(ctx, 2.3, -10, 1.1); fill(ctx, '#ffd24a');
}
function golem(ctx, col) {
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -6, 6, 4, 8, 1); ctx.fill(); rr(ctx, 2, 6, 4, 8, 1); ctx.fill();
  rr(ctx, -9, -6, 18, 14, 3); fill(ctx, col); line(ctx);
  ctx.fillStyle = col; rr(ctx, -12, -4, 4, 11, 2); ctx.fill(); rr(ctx, 8, -4, 4, 11, 2); ctx.fill();
  rr(ctx, -5, -15, 10, 9, 2); fill(ctx, shade(col, 0.1)); line(ctx);
  ctx.fillStyle = '#ffce4a'; rr(ctx, -3, -12, 2.4, 2.4, 1); ctx.fill(); rr(ctx, 1, -12, 2.4, 2.4, 1); ctx.fill();
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
}
function undead(ctx, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, 13); ctx.moveTo(3, 8); ctx.lineTo(3, 13); ctx.stroke();
  rr(ctx, -5, -3, 10, 11, 2); fill(ctx, shade(col, -0.05)); line(ctx);
  ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 1; for (const yy of [-1, 2, 5]) { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.lineTo(4, yy); ctx.stroke(); }
  circle(ctx, 0, -10, 6); fill(ctx, col); line(ctx);
  circle(ctx, -2.3, -10, 1.4); fill(ctx, '#1a140d'); circle(ctx, 2.3, -10, 1.4); fill(ctx, '#1a140d');
}
function insect(ctx, col) {
  ctx.globalAlpha = 0.6; ctx.fillStyle = '#dff'; ellipse(ctx, -6, -2, 6, 3); ctx.fill(); ellipse(ctx, 6, -2, 6, 3); ctx.fill(); ctx.globalAlpha = 1;
  ellipse(ctx, 0, 3, 5, 7); fill(ctx, col); line(ctx);
  circle(ctx, 0, -5, 3.4); fill(ctx, shade(col, -0.2)); line(ctx);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(-4, -11); ctx.moveTo(2, -8); ctx.lineTo(4, -11); ctx.stroke();
  circle(ctx, -1.4, -5, 0.8); fill(ctx, '#1a140d'); circle(ctx, 1.4, -5, 0.8); fill(ctx, '#1a140d');
}
function scorpion(ctx, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, 6); ctx.quadraticCurveTo(16, 4, 14, -6); ctx.stroke(); ctx.lineCap = 'butt';
  circle(ctx, 14, -7, 2.6); fill(ctx, shade(col, -0.2));
  ellipse(ctx, 0, 4, 9, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = col; circle(ctx, -10, 1, 3); ctx.fill(); line(ctx, OUTLINE, 1.1); circle(ctx, -12, 4, 2.4); ctx.fill();
  ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 1.4; for (const i of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(i * 3, 7); ctx.lineTo(i * 3 - 3, 11); ctx.stroke(); }
  circle(ctx, 3, 2, 0.9); fill(ctx, '#1a140d');
}
function bat(ctx, col) {
  ctx.fillStyle = col;
  path(ctx, () => { ctx.moveTo(0, 0); ctx.lineTo(-14, -6); ctx.lineTo(-10, 0); ctx.lineTo(-14, 4); ctx.lineTo(-4, 4); }); ctx.fill(); line(ctx, OUTLINE, 1);
  path(ctx, () => { ctx.moveTo(0, 0); ctx.lineTo(14, -6); ctx.lineTo(10, 0); ctx.lineTo(14, 4); ctx.lineTo(4, 4); }); ctx.fill(); line(ctx, OUTLINE, 1);
  circle(ctx, 0, 0, 5); fill(ctx, shade(col, 0.1)); line(ctx);
  circle(ctx, -1.6, -1, 0.9); fill(ctx, '#e23'); circle(ctx, 1.6, -1, 0.9); fill(ctx, '#e23');
}
function seacreature(ctx, col) {
  path(ctx, () => { ctx.moveTo(-12, 2); ctx.quadraticCurveTo(0, -9, 14, 1); ctx.quadraticCurveTo(0, 11, -12, 2); }); fill(ctx, col); line(ctx);
  path(ctx, () => { ctx.moveTo(-12, 2); ctx.lineTo(-18, -4); ctx.lineTo(-16, 2); ctx.lineTo(-18, 8); }); fill(ctx, shade(col, -0.15)); line(ctx, OUTLINE, 1);
  ctx.fillStyle = shade(col, -0.15); path(ctx, () => { ctx.moveTo(2, -6); ctx.lineTo(5, -13); ctx.lineTo(8, -5); }); ctx.fill();
  circle(ctx, 9, 0, 1.1); fill(ctx, '#1a140d');
}
function plant(ctx, col) {
  ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -2); ctx.stroke();
  ctx.strokeStyle = shade(col, -0.1); ctx.lineWidth = 2;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(s * 10, 2, s * 8, -4); ctx.stroke(); }
  path(ctx, () => { ctx.moveTo(-7, -4); ctx.quadraticCurveTo(0, -16, 7, -4); ctx.quadraticCurveTo(0, -2, -7, -4); }); fill(ctx, col); line(ctx);
  ctx.fillStyle = '#7a1020'; ellipse(ctx, 0, -6, 3.2, 2.2); ctx.fill();
  ctx.fillStyle = '#fff'; for (const x of [-3, -1, 1, 3]) { path(ctx, () => { ctx.moveTo(x, -8); ctx.lineTo(x + 0.8, -6); ctx.lineTo(x - 0.8, -6); }); ctx.fill(); }
}
function drake(ctx, col) {
  ctx.fillStyle = shade(col, -0.2);
  path(ctx, () => { ctx.moveTo(-2, -2); ctx.lineTo(-16, -10); ctx.lineTo(-12, 0); ctx.lineTo(-16, 2); }); ctx.fill(); line(ctx, OUTLINE, 1);
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.quadraticCurveTo(-16, 8, -13, 0); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -6, 5, 4, 8, 2); ctx.fill(); rr(ctx, 2, 5, 4, 8, 2); ctx.fill();
  ellipse(ctx, 0, 1, 9, 8); fill(ctx, col); line(ctx);
  circle(ctx, 9, -3, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.2); path(ctx, () => { ctx.moveTo(9, -7); ctx.lineTo(7, -12); ctx.lineTo(11, -9); }); ctx.fill();
  circle(ctx, 11, -4, 1); fill(ctx, '#ffd24a');
}
function wisp(ctx, col) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; circle(ctx, 0, 0, 12); ctx.fill();
  ctx.fillStyle = '#fff'; circle(ctx, 0, 0, 3); ctx.fill();
}
function humanoid(ctx, col) {
  ctx.fillStyle = shade(col, -0.4); rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  rr(ctx, -7, -5, 14, 13, 4); fill(ctx, col); line(ctx);
  ctx.fillStyle = col; rr(ctx, -10, -3, 4, 9, 2); ctx.fill(); rr(ctx, 6, -3, 4, 9, 2); ctx.fill();
  ctx.fillStyle = '#d8a578'; circle(ctx, -8, 6, 2); ctx.fill(); circle(ctx, 8, 6, 2); ctx.fill();
  circle(ctx, 0, -11, 6.5); fill(ctx, '#d8a578'); line(ctx);
  ctx.fillStyle = shade(col, -0.2); path(ctx, () => { ctx.arc(0, -12, 6.6, Math.PI, Math.PI * 2); }); ctx.fill();
  ctx.fillStyle = shade(col, -0.3); rr(ctx, -6, -12, 12, 3, 1); ctx.fill();
  circle(ctx, -2.2, -10.5, 0.8); fill(ctx, '#fff'); circle(ctx, 2.2, -10.5, 0.8); fill(ctx, '#fff');
  ctx.strokeStyle = '#cfd6dd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(13, -6); ctx.stroke();
}

function hound(ctx, col) {
  ctx.strokeStyle = shade(col, -0.1); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, 3); ctx.quadraticCurveTo(-15, -2, -12, -7); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -7, 6, 3.5, 7, 1); ctx.fill(); rr(ctx, 3, 6, 3.5, 7, 1); ctx.fill();
  ellipse(ctx, -1, 2, 11, 6.5); fill(ctx, col); line(ctx);
  circle(ctx, 9, -2, 5.5); fill(ctx, col); line(ctx);
  path(ctx, () => { ctx.moveTo(6, -7); ctx.lineTo(5, -12); ctx.lineTo(9, -7); }); fill(ctx, shade(col, -0.2));
  path(ctx, () => { ctx.moveTo(13, -1); ctx.lineTo(16, 1); ctx.lineTo(13, 3); }); fill(ctx, shade(col, 0.2));
  circle(ctx, 10, -3, 1); fill(ctx, '#1a140d');
}
function jellyfish(ctx, col) {
  ctx.globalAlpha = 0.85;
  path(ctx, () => { ctx.moveTo(-9, 2); ctx.quadraticCurveTo(-9, -10, 0, -10); ctx.quadraticCurveTo(9, -10, 9, 2); ctx.quadraticCurveTo(4, 5, 0, 2); ctx.quadraticCurveTo(-4, 5, -9, 2); }); fill(ctx, col); line(ctx);
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(col, 0.3); ellipse(ctx, -3, -5, 2.5, 3.5); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const x of [-6, -2, 2, 6]) { ctx.beginPath(); ctx.moveTo(x, 2); ctx.quadraticCurveTo(x + 2, 8, x - 1, 13); ctx.stroke(); }
  ctx.lineCap = 'butt';
}
function mantis(ctx, col) {
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -4, 6, 3, 7, 1); ctx.fill(); rr(ctx, 1, 6, 3, 7, 1); ctx.fill();
  ellipse(ctx, -2, 1, 6, 8); fill(ctx, col); line(ctx);
  ctx.strokeStyle = shade(col, -0.1); ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(9, -6); ctx.lineTo(7, -10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, 1); ctx.lineTo(10, -2); ctx.lineTo(9, -6); ctx.stroke(); ctx.lineCap = 'butt';
  circle(ctx, 2, -9, 3.6); fill(ctx, col); line(ctx);
  circle(ctx, 0.6, -10, 1); fill(ctx, '#1a140d'); circle(ctx, 3.4, -10, 1); fill(ctx, '#1a140d');
}
function turtle(ctx, col) {
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -9, 6, 3, 4, 1); ctx.fill(); rr(ctx, 6, 6, 3, 4, 1); ctx.fill();
  circle(ctx, 11, 1, 4); fill(ctx, shade(col, 0.25)); line(ctx);
  circle(ctx, 12, 0, 0.9); fill(ctx, '#1a140d');
  ellipse(ctx, 0, 2, 12, 8); fill(ctx, col); line(ctx);
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(8, 2); ctx.moveTo(0, -5); ctx.lineTo(0, 9); ctx.stroke();
  ctx.fillStyle = shade(col, 0.2); ellipse(ctx, -3, -1, 3, 2.5); ctx.fill();
}

const ARCH = {
  beast, rodent, primate, reptile, serpent, crab, fowl, greenman, spider, slime,
  ghost, demon, golem, undead, insect, scorpion, bat, seacreature, plant, drake, wisp, humanoid,
  hound, jellyfish, mantis, turtle,
};

function chicken(ctx) {
  // legs
  ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, 13); ctx.moveTo(3, 8); ctx.lineTo(3, 13); ctx.stroke();
  // body
  ellipse(ctx, 0, 2, 9, 8); fill(ctx, '#f3f0e6'); line(ctx);
  // tail
  path(ctx, () => { ctx.moveTo(-7, -2); ctx.lineTo(-14, -8); ctx.lineTo(-7, 4); }); fill(ctx, '#e6e0cf'); line(ctx);
  // head
  circle(ctx, 7, -7, 5); fill(ctx, '#f7f4ea'); line(ctx);
  // comb + beak
  circle(ctx, 7, -12, 2.2); fill(ctx, '#d23b2e');
  path(ctx, () => { ctx.moveTo(11, -7); ctx.lineTo(15, -6); ctx.lineTo(11, -4); }); fill(ctx, '#f0a93b');
  // eye
  circle(ctx, 8.5, -8, 1); fill(ctx, '#1a140d');
}

function rat(ctx) {
  // tail
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(-18, 2, -14, -6); ctx.strokeStyle = '#caa6a0'; ctx.lineWidth = 2.5; ctx.stroke();
  // body
  ellipse(ctx, 0, 3, 10, 7); fill(ctx, '#8f8f93'); line(ctx);
  // head
  circle(ctx, 9, 0, 5); fill(ctx, '#9a9a9e'); line(ctx);
  // ear
  circle(ctx, 8, -5, 3); fill(ctx, '#c79a98'); line(ctx, OUTLINE, 1.5);
  // snout + eye
  path(ctx, () => { ctx.moveTo(13, -1); ctx.lineTo(16, 1); ctx.lineTo(13, 3); }); fill(ctx, '#c79a98');
  circle(ctx, 11, -1, 1); fill(ctx, '#1a140d');
}

function goblin(ctx) {
  // legs
  ctx.fillStyle = '#3f7a35'; rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  // body
  rr(ctx, -7, -4, 14, 13, 5); fill(ctx, '#4f9a3f'); line(ctx);
  // loincloth
  ctx.fillStyle = '#7a5a2a'; rr(ctx, -7, 6, 14, 5, 2); ctx.fill();
  // arms
  ctx.fillStyle = '#4f9a3f'; rr(ctx, -10, -3, 4, 9, 2); ctx.fill(); rr(ctx, 6, -3, 4, 9, 2); ctx.fill();
  // head
  circle(ctx, 0, -10, 7); fill(ctx, '#58a847'); line(ctx);
  // ears
  path(ctx, () => { ctx.moveTo(-6, -11); ctx.lineTo(-12, -14); ctx.lineTo(-6, -7); }); fill(ctx, '#58a847'); line(ctx, OUTLINE, 1.5);
  path(ctx, () => { ctx.moveTo(6, -11); ctx.lineTo(12, -14); ctx.lineTo(6, -7); }); fill(ctx, '#58a847'); line(ctx, OUTLINE, 1.5);
  // eyes
  circle(ctx, -2.5, -10, 1.4); fill(ctx, '#ffe24a'); circle(ctx, 3, -10, 1.4); fill(ctx, '#ffe24a');
  circle(ctx, -2.5, -10, 0.6); fill(ctx, '#1a140d'); circle(ctx, 3, -10, 0.6); fill(ctx, '#1a140d');
}

function macaque(ctx) {
  // tail
  ctx.beginPath(); ctx.moveTo(-7, 6); ctx.quadraticCurveTo(-18, 4, -15, -8); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3; ctx.stroke();
  // legs/arms
  ctx.fillStyle = '#6e4f33'; rr(ctx, -6, 5, 4, 8, 2); ctx.fill(); rr(ctx, 2, 5, 4, 8, 2); ctx.fill();
  // body
  ellipse(ctx, 0, 1, 9, 9); fill(ctx, '#7a5a3a'); line(ctx);
  // head
  circle(ctx, 1, -10, 6.5); fill(ctx, '#7a5a3a'); line(ctx);
  // face
  ellipse(ctx, 1, -9, 4.2, 5); fill(ctx, '#d9b48f');
  circle(ctx, -1, -10, 1); fill(ctx, '#1a140d'); circle(ctx, 3, -10, 1); fill(ctx, '#1a140d');
}

function lizard(ctx) {
  // tail
  ctx.beginPath(); ctx.moveTo(-9, 4); ctx.quadraticCurveTo(-24, 6, -20, -4);
  ctx.strokeStyle = '#5f7a3a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
  // legs
  ctx.fillStyle = '#52692f'; rr(ctx, -6, 6, 5, 5, 2); ctx.fill(); rr(ctx, 3, 6, 5, 5, 2); ctx.fill();
  // body
  ellipse(ctx, 0, 2, 13, 7); fill(ctx, '#6b8a42'); line(ctx);
  // spots
  ctx.fillStyle = 'rgba(40,55,20,0.55)';
  circle(ctx, -4, 0, 1.6); ctx.fill(); circle(ctx, 2, 3, 1.6); ctx.fill(); circle(ctx, 6, -1, 1.4); ctx.fill();
  // head
  ellipse(ctx, 12, 0, 7, 5); fill(ctx, '#6b8a42'); line(ctx);
  circle(ctx, 14, -2, 1.1); fill(ctx, '#1a140d');
  // forked tongue
  ctx.strokeStyle = '#c83b3b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(18, 1); ctx.lineTo(22, 1); ctx.stroke();
}

function guard(ctx) {
  // legs
  ctx.fillStyle = '#3a3f4a'; rr(ctx, -5, 6, 4, 9, 2); ctx.fill(); rr(ctx, 1, 6, 4, 9, 2); ctx.fill();
  // spear
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(10, 14); ctx.stroke();
  ctx.fillStyle = '#cfd6dd'; path(ctx, () => { ctx.moveTo(10, -22); ctx.lineTo(7, -16); ctx.lineTo(13, -16); }); ctx.fill();
  // body armour
  rr(ctx, -7, -5, 14, 13, 4); fill(ctx, '#8a929c'); line(ctx);
  ctx.fillStyle = '#6f7780'; rr(ctx, -7, 0, 14, 3, 1); ctx.fill();
  // head + helm
  circle(ctx, 0, -11, 6.5); fill(ctx, '#e3b187'); line(ctx);
  ctx.fillStyle = '#9aa3ad'; path(ctx, () => { ctx.moveTo(-7, -11); ctx.quadraticCurveTo(0, -22, 7, -11); ctx.lineTo(7, -13); ctx.quadraticCurveTo(0, -20, -7, -13); }); ctx.fill(); line(ctx, OUTLINE, 1.5);
  circle(ctx, -2, -11, 0.9); fill(ctx, '#1a140d'); circle(ctx, 2, -11, 0.9); fill(ctx, '#1a140d');
}

function human(ctx, p) {
  // legs
  ctx.fillStyle = '#3a3326'; rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  // torso
  rr(ctx, -7, -5, 14, 13, 4); fill(ctx, p.top); line(ctx);
  // apron
  if (p.apron) { ctx.fillStyle = p.apron; rr(ctx, -5, -2, 10, 10, 2); ctx.fill(); }
  // arms
  ctx.fillStyle = p.top; rr(ctx, -10, -3, 4, 9, 2); ctx.fill(); rr(ctx, 6, -3, 4, 9, 2); ctx.fill();
  ctx.fillStyle = p.skin; circle(ctx, -8, 6, 2); ctx.fill(); circle(ctx, 8, 6, 2); ctx.fill();
  // head
  circle(ctx, 0, -11, 6.5); fill(ctx, p.skin); line(ctx);
  // hair
  if (p.hair) { ctx.fillStyle = p.hair; path(ctx, () => { ctx.arc(0, -12, 6.6, Math.PI, Math.PI * 2); }); ctx.fill(); }
  // hat
  if (p.hat) { ctx.fillStyle = p.hat; rr(ctx, -7, -16, 14, 4, 2); ctx.fill(); rr(ctx, -4, -21, 8, 6, 2); ctx.fill(); }
  // eyes
  circle(ctx, -2.2, -11, 0.9); fill(ctx, '#1a140d'); circle(ctx, 2.2, -11, 0.9); fill(ctx, '#1a140d');
}

// ================= PLAYER =================
export function drawPlayer(ctx, cx, cy, opts = {}) {
  staged(ctx, cx, cy, opts, (c) => {
    // legs
    c.fillStyle = '#2f3a52'; rr(c, -5, 6, 4, 8, 2); c.fill(); rr(c, 1, 6, 4, 8, 2); c.fill();
    // torso (armour tint if body equipped)
    rr(c, -7, -5, 14, 13, 4); fill(c, opts.hasBody ? '#b9c2cc' : '#5b8c4a'); line(c);
    c.fillStyle = opts.hasBody ? '#9aa6b2' : '#4d7a3e'; rr(c, -7, 1, 14, 3, 1); c.fill();
    // arms
    c.fillStyle = opts.hasBody ? '#b9c2cc' : '#5b8c4a'; rr(c, -10, -3, 4, 9, 2); c.fill(); rr(c, 6, -3, 4, 9, 2); c.fill();
    c.fillStyle = '#e8b98a'; circle(c, -8, 6, 2); c.fill(); circle(c, 8, 6, 2); c.fill();
    // head + hair
    circle(c, 0, -11, 6.8); fill(c, '#e8b98a'); line(c);
    c.fillStyle = '#46301c'; path(c, () => { c.arc(0, -12, 6.9, Math.PI, Math.PI * 2); }); c.fill();
    circle(c, -2.3, -11, 0.9); fill(c, '#1a140d'); circle(c, 2.3, -11, 0.9); fill(c, '#1a140d');
    // weapon
    if (opts.hasWeapon) {
      c.strokeStyle = '#e9edf2'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(10, 11); c.lineTo(14, -9); c.stroke();
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(8, 9); c.lineTo(12, 6); c.stroke();
    }
  });
}

// ================= OBJECTS =================
export function drawObjectSprite(ctx, obj, cx, cy, time = 0) {
  const t = obj.def.type;
  switch (t) {
    case 'tree': return tree(ctx, obj.objId, obj.depleted, cx, cy, time);
    case 'rock': return rock(ctx, obj.def.ore, obj.depleted, cx, cy);
    case 'fishing': return fishing(ctx, cx, cy, time);
    case 'fire': return fire(ctx, cx, cy, time);
    case 'range': return range(ctx, cx, cy, time);
    case 'furnace': return furnace(ctx, cx, cy, time);
    case 'anvil': return anvil(ctx, cx, cy);
    case 'bank': return bank(ctx, cx, cy);
    case 'shrine': return shrine(ctx, cx, cy, time);
    case 'rest': return hyco(ctx, cx, cy);
    case 'agility': return agilityCourse(ctx, cx, cy);
    case 'scenery': return scenery(ctx, obj.objId, cx, cy, time);
    default: return;
  }
}

function tree(ctx, variant, depleted, cx, cy, time) {
  if (depleted) {
    ctx.fillStyle = '#6b4a2a'; rr(ctx, cx - 5, cy + 2, 10, 9, 2); ctx.fill();
    ctx.fillStyle = '#7d5a36'; ellipse(ctx, cx, cy + 2, 6, 2.5); ctx.fill();
    line(ctx, OUTLINE, 1.5);
    return;
  }
  const sway = Math.sin(time * 0.0012 + cx) * 1.4;
  // trunk
  ctx.fillStyle = '#6b4a2a'; rr(ctx, cx - 3.5, cy - 2, 7, 16, 2); ctx.fill(); line(ctx, OUTLINE, 1.5);
  const big = variant === 'oak', willow = variant === 'willow';
  const r = willow ? 17 : big ? 19 : 15;
  const base = willow ? '#5f9a45' : big ? '#2f7333' : '#33863a';
  const dark = willow ? '#4d7e38' : big ? '#255c29' : '#2a6e30';
  const cxx = cx + sway, cyy = cy - 9;
  ctx.fillStyle = dark;
  circle(ctx, cxx - r * 0.55, cyy + 3, r * 0.72); ctx.fill();
  circle(ctx, cxx + r * 0.55, cyy + 3, r * 0.72); ctx.fill();
  circle(ctx, cxx, cyy - 3, r * 0.8); ctx.fill();
  ctx.fillStyle = base;
  circle(ctx, cxx, cyy - 1, r * 0.85); ctx.fill();
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  circle(ctx, cxx - r * 0.35, cyy - r * 0.45, r * 0.4); ctx.fill();
  // outline blob
  ctx.strokeStyle = 'rgba(20,40,18,0.35)'; ctx.lineWidth = 2;
  circle(ctx, cxx, cyy - 1, r * 0.85); ctx.stroke();
}

function rock(ctx, ore, depleted, cx, cy) {
  drawShadow(ctx, cx, cy + 9, 13, 5);
  ctx.fillStyle = depleted ? '#5c5c5c' : '#828790';
  path(ctx, () => {
    ctx.moveTo(cx - 12, cy + 9); ctx.lineTo(cx - 9, cy - 7); ctx.lineTo(cx - 1, cy - 11);
    ctx.lineTo(cx + 8, cy - 8); ctx.lineTo(cx + 12, cy + 2); ctx.lineTo(cx + 8, cy + 10);
  });
  ctx.fill(); line(ctx, 'rgba(30,30,34,0.5)', 2);
  // top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  path(ctx, () => { ctx.moveTo(cx - 9, cy - 7); ctx.lineTo(cx - 1, cy - 11); ctx.lineTo(cx + 2, cy - 4); ctx.lineTo(cx - 6, cy - 2); }); ctx.fill();
  if (!depleted && ore) {
    ctx.fillStyle = ore;
    for (const [dx, dy] of [[-5, 1], [3, 4], [-1, -4], [6, -1]]) { circle(ctx, cx + dx, cy + dy, 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    circle(ctx, cx - 5.6, cy + 0.4, 0.7); ctx.fill(); circle(ctx, cx + 2.4, cy + 3.4, 0.7); ctx.fill();
  }
}

function fishing(ctx, cx, cy, time) {
  const phase = time * 0.004;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const k = (phase + i * 0.9) % 2.4;
    ctx.globalAlpha = Math.max(0, 0.55 - k / 4);
    circle(ctx, cx, cy, 4 + k * 6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // little fish hint
  ctx.fillStyle = 'rgba(180,220,255,0.9)';
  ellipse(ctx, cx + 4, cy - 1, 3, 1.6); ctx.fill();
  path(ctx, () => { ctx.moveTo(cx + 1, cy - 1); ctx.lineTo(cx - 2, cy - 3); ctx.lineTo(cx - 2, cy + 1); }); ctx.fill();
}

function glow(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; circle(ctx, cx, cy, r); ctx.fill();
}

function fire(ctx, cx, cy, time) {
  glow(ctx, cx, cy - 2, 26, 'rgba(255,150,40,0.30)');
  // logs
  ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 7, cy + 8); ctx.lineTo(cx + 7, cy + 6);
  ctx.moveTo(cx - 7, cy + 6); ctx.lineTo(cx + 7, cy + 8); ctx.stroke(); ctx.lineCap = 'butt';
  const f = 1 + Math.sin(time * 0.02) * 0.12;
  const f2 = 1 + Math.sin(time * 0.027 + 1) * 0.14;
  ctx.fillStyle = '#e8521f';
  path(ctx, () => { ctx.moveTo(cx - 7 * f, cy + 6); ctx.quadraticCurveTo(cx - 9, cy - 6 * f, cx, cy - 16 * f); ctx.quadraticCurveTo(cx + 9, cy - 6 * f, cx + 7 * f, cy + 6); }); ctx.fill();
  ctx.fillStyle = '#f7a519';
  path(ctx, () => { ctx.moveTo(cx - 4 * f2, cy + 5); ctx.quadraticCurveTo(cx - 5, cy - 4, cx, cy - 11 * f2); ctx.quadraticCurveTo(cx + 5, cy - 4, cx + 4 * f2, cy + 5); }); ctx.fill();
  ctx.fillStyle = '#ffe07a';
  path(ctx, () => { ctx.moveTo(cx - 2, cy + 3); ctx.quadraticCurveTo(cx - 2, cy - 3, cx, cy - 7 * f2); ctx.quadraticCurveTo(cx + 2, cy - 3, cx + 2, cy + 3); }); ctx.fill();
}

function range(ctx, cx, cy, time) {
  drawShadow(ctx, cx, cy + 11, 14, 5);
  // stone body
  ctx.fillStyle = '#7c7468'; rr(ctx, cx - 13, cy - 6, 26, 18, 3); ctx.fill(); line(ctx, 'rgba(30,26,20,0.5)', 2);
  ctx.fillStyle = '#8c8478'; rr(ctx, cx - 13, cy - 6, 26, 4, 3); ctx.fill();
  // fire mouth
  ctx.fillStyle = '#1c1410'; rr(ctx, cx - 9, cy + 1, 18, 9, 2); ctx.fill();
  const f = 1 + Math.sin(time * 0.02) * 0.15;
  ctx.fillStyle = '#e8521f'; path(ctx, () => { ctx.moveTo(cx - 6, cy + 9); ctx.quadraticCurveTo(cx - 4, cy + 2 * f, cx, cy + 1); ctx.quadraticCurveTo(cx + 4, cy + 2 * f, cx + 6, cy + 9); }); ctx.fill();
  ctx.fillStyle = '#ffce4a'; path(ctx, () => { ctx.moveTo(cx - 3, cy + 9); ctx.quadraticCurveTo(cx, cy + 3 * f, cx + 3, cy + 9); }); ctx.fill();
  // pot
  ctx.fillStyle = '#3a3a40'; rr(ctx, cx - 7, cy - 12, 14, 8, 3); ctx.fill(); line(ctx, 'rgba(0,0,0,0.4)', 1.5);
}

function furnace(ctx, cx, cy, time) {
  drawShadow(ctx, cx, cy + 13, 15, 5);
  ctx.fillStyle = '#7a4a36'; path(ctx, () => { ctx.moveTo(cx - 13, cy + 12); ctx.lineTo(cx - 10, cy - 12); ctx.lineTo(cx + 10, cy - 12); ctx.lineTo(cx + 13, cy + 12); }); ctx.fill(); line(ctx, 'rgba(30,16,10,0.5)', 2);
  // brick lines
  ctx.strokeStyle = 'rgba(40,20,12,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 11, cy - 2); ctx.lineTo(cx + 11, cy - 2); ctx.moveTo(cx - 12, cy + 5); ctx.lineTo(cx + 12, cy + 5); ctx.stroke();
  // glowing opening
  glow(ctx, cx, cy + 3, 16, 'rgba(255,140,40,0.4)');
  ctx.fillStyle = '#1c1208'; rr(ctx, cx - 7, cy + 1, 14, 10, 3); ctx.fill();
  const f = 1 + Math.sin(time * 0.03) * 0.2;
  ctx.fillStyle = '#ff9a2e'; rr(ctx, cx - 5, cy + 4, 10, 6 * f, 2); ctx.fill();
  ctx.fillStyle = '#ffe07a'; rr(ctx, cx - 2.5, cy + 5, 5, 4 * f, 1); ctx.fill();
  // chimney
  ctx.fillStyle = '#6b4030'; rr(ctx, cx + 4, cy - 18, 6, 7, 1); ctx.fill();
}

function anvil(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 11, 13, 4);
  // stump
  ctx.fillStyle = '#6b4a2a'; rr(ctx, cx - 7, cy + 4, 14, 9, 2); ctx.fill(); line(ctx, OUTLINE, 1.5);
  // anvil body
  ctx.fillStyle = '#3a3d44';
  path(ctx, () => {
    ctx.moveTo(cx - 11, cy - 4); ctx.lineTo(cx + 8, cy - 4); ctx.lineTo(cx + 12, cy - 1);
    ctx.lineTo(cx + 5, cy - 1); ctx.lineTo(cx + 5, cy + 1); ctx.lineTo(cx + 3, cy + 4);
    ctx.lineTo(cx - 3, cy + 4); ctx.lineTo(cx - 3, cy - 1); ctx.lineTo(cx - 11, cy - 1);
  });
  ctx.fill(); line(ctx, 'rgba(0,0,0,0.5)', 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, cx - 10, cy - 4, 17, 1.6, 1); ctx.fill();
}

function bank(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 15, 5);
  // counter
  ctx.fillStyle = '#7a5230'; rr(ctx, cx - 13, cy - 2, 26, 14, 2); ctx.fill(); line(ctx, 'rgba(30,18,8,0.5)', 2);
  ctx.fillStyle = '#8a6038'; rr(ctx, cx - 13, cy - 4, 26, 4, 2); ctx.fill();
  // booth top sign
  ctx.fillStyle = '#caa15a'; rr(ctx, cx - 11, cy - 16, 22, 9, 2); ctx.fill(); line(ctx, 'rgba(30,18,8,0.5)', 1.5);
  ctx.fillStyle = '#5a3a1c'; ctx.font = 'bold 8px Verdana'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('BANK', cx, cy - 11); ctx.textBaseline = 'alphabetic';
  // posts
  ctx.fillStyle = '#6b4524'; rr(ctx, cx - 12, cy - 16, 3, 16, 1); ctx.fill(); rr(ctx, cx + 9, cy - 16, 3, 16, 1); ctx.fill();
}

// The "A Worthy" logo as a town monument: a blue archway with a plus, on a stone plinth.
function shrine(ctx, cx, cy, time) {
  // The A-Worthy Monument is a landmark — render it large.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.85, 1.85);
  shrineBody(ctx, 0, 0, time);
  // Embed the genuine A Worthy logo as a floating, glowing emblem above the arch.
  const bob = Math.sin(time * 0.0022) * 1.2;
  glow(ctx, 0, -30 + bob, 13, 'rgba(70,130,200,0.28)');
  drawLogo(ctx, 'logo', -7, -41 + bob, 14, 21);
  ctx.restore();
}
function shrineBody(ctx, cx, cy, time) {
  drawShadow(ctx, cx, cy + 13, 16, 5);
  const blue = '#2b5c91', dark = '#21466e';
  // soft worthy-blue aura
  glow(ctx, cx, cy - 6, 26, 'rgba(70,130,200,0.20)');
  // stone plinth
  ctx.fillStyle = '#8a8378'; rr(ctx, cx - 13, cy + 6, 26, 9, 2); ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.5);
  ctx.fillStyle = '#9a948a'; rr(ctx, cx - 10, cy + 3, 20, 4, 2); ctx.fill();
  // archway (logo mark)
  const arch = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 4); ctx.lineTo(cx - 9, cy - 8);
    ctx.quadraticCurveTo(cx - 9, cy - 21, cx, cy - 21);
    ctx.quadraticCurveTo(cx + 9, cy - 21, cx + 9, cy - 8);
    ctx.lineTo(cx + 9, cy + 4);
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = dark; ctx.lineWidth = 9; arch(); ctx.stroke();
  ctx.strokeStyle = blue; ctx.lineWidth = 6; arch(); ctx.stroke();
  ctx.lineCap = 'butt';
  // plus inside the arch
  ctx.fillStyle = blue;
  rr(ctx, cx - 5, cy - 13, 10, 3, 1); ctx.fill();
  rr(ctx, cx - 1.5, cy - 17, 3, 11, 1); ctx.fill();
  // glint
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  circle(ctx, cx - 6, cy - 14, 1); ctx.fill();
}

// Hyco Education obelisk — a navy standee with the silver ring + orange dot mark.
function hyco(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 14, 14, 5);
  glow(ctx, cx, cy - 6, 24, 'rgba(245,166,35,0.16)');
  ctx.fillStyle = '#3a3530'; rr(ctx, cx - 2.5, cy + 4, 5, 11, 1); ctx.fill();
  ctx.fillStyle = '#15273c'; rr(ctx, cx - 15, cy - 22, 30, 28, 4); ctx.fill(); line(ctx, OUTLINE, 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, cx - 15, cy - 22, 30, 6, 4); ctx.fill();
  // "hy" suggestion
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 4); ctx.lineTo(cx - 10, cy - 14);
  ctx.moveTo(cx - 10, cy - 9); ctx.quadraticCurveTo(cx - 7, cy - 11, cx - 6, cy - 4);
  ctx.stroke();
  // ring "o" + orange dot
  ctx.strokeStyle = '#dfe6ec'; ctx.lineWidth = 3.2; circle(ctx, cx + 4, cy - 8, 6); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#f5a623'; circle(ctx, cx + 9, cy - 13, 2.1); ctx.fill();
  // EDUCATION bar
  ctx.fillStyle = 'rgba(238,243,247,0.8)'; rr(ctx, cx - 11, cy + 1, 22, 2, 1); ctx.fill();
  // Embed the genuine Hyco Education logo onto the standee face (its own navy bg blends in).
  drawLogo(ctx, 'hyco', cx - 14, cy - 21, 28, 15);
}

// Agility course: two posts with a row of climbing ropes.
function agilityCourse(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 14, 5);
  ctx.fillStyle = '#7a5530'; rr(ctx, cx - 13, cy - 14, 3, 26, 1); ctx.fill(); rr(ctx, cx + 10, cy - 14, 3, 26, 1); ctx.fill();
  ctx.strokeStyle = '#9a734a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 12); ctx.lineTo(cx + 12, cy - 12); ctx.stroke();
  ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const x = cx - 9 + i * 4.6; ctx.beginPath(); ctx.moveTo(x, cy - 12); ctx.lineTo(x, cy - 3); ctx.stroke(); }
  ctx.lineCap = 'butt';
}

function scenery(ctx, objId, cx, cy, time) {
  switch (objId) {
    case 'wall': {
      ctx.fillStyle = '#9a948a'; rr(ctx, cx - 15, cy - 12, 30, 26, 2); ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.5);
      ctx.strokeStyle = 'rgba(40,36,30,0.4)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx - 15, cy - 3); ctx.lineTo(cx + 15, cy - 3); ctx.moveTo(cx - 15, cy + 6); ctx.lineTo(cx + 15, cy + 6);
      ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 3); ctx.moveTo(cx - 8, cy - 3); ctx.lineTo(cx - 8, cy + 6); ctx.moveTo(cx + 8, cy + 6); ctx.lineTo(cx + 8, cy + 14); ctx.stroke();
      return;
    }
    case 'fence': {
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 10, cy + 10); ctx.lineTo(cx - 10, cy - 4); ctx.moveTo(cx + 10, cy + 10); ctx.lineTo(cx + 10, cy - 4); ctx.stroke();
      ctx.lineWidth = 2.4; ctx.strokeStyle = '#7d5836';
      ctx.beginPath(); ctx.moveTo(cx - 13, cy - 1); ctx.lineTo(cx + 13, cy - 1); ctx.moveTo(cx - 13, cy + 6); ctx.lineTo(cx + 13, cy + 6); ctx.stroke(); ctx.lineCap = 'butt';
      return;
    }
    case 'bush': {
      ctx.fillStyle = '#2f6e30'; circle(ctx, cx - 5, cy + 2, 7); ctx.fill(); circle(ctx, cx + 5, cy + 2, 7); ctx.fill(); circle(ctx, cx, cy - 3, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; circle(ctx, cx - 2, cy - 4, 3); ctx.fill();
      ctx.fillStyle = '#d23b6e'; circle(ctx, cx - 4, cy, 1.4); ctx.fill(); circle(ctx, cx + 5, cy - 2, 1.4); ctx.fill();
      return;
    }
    case 'flower': {
      ctx.strokeStyle = '#3d7a3a'; ctx.lineWidth = 1.5;
      for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(cx + dx, cy + 8); ctx.lineTo(cx + dx, cy - 2); ctx.stroke(); }
      const cols = ['#e85a8a', '#f0c64a', '#9a6ad8'];
      [-5, 0, 5].forEach((dx, i) => { ctx.fillStyle = cols[i]; circle(ctx, cx + dx, cy - 3, 3); ctx.fill(); ctx.fillStyle = '#fff7d0'; circle(ctx, cx + dx, cy - 3, 1); ctx.fill(); });
      return;
    }
    case 'palm': {
      ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy + 12); ctx.quadraticCurveTo(cx + 3, cy - 2, cx - 1, cy - 14); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#2f8a4a';
      for (let a = 0; a < 6; a++) {
        const ang = -Math.PI / 2 + (a - 2.5) * 0.5;
        ctx.save(); ctx.translate(cx - 1, cy - 14); ctx.rotate(ang);
        ctx.beginPath(); ctx.ellipse(13, 0, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = '#8a6a2a'; circle(ctx, cx - 1, cy - 14, 3); ctx.fill();
      return;
    }
    case 'lamp': {
      glow(ctx, cx, cy - 12, 22, 'rgba(255,210,120,0.22)');
      ctx.fillStyle = '#3a3530'; rr(ctx, cx - 1.5, cy - 12, 3, 24, 1); ctx.fill();
      ctx.fillStyle = '#2a2620'; rr(ctx, cx - 4, cy + 10, 8, 3, 1); ctx.fill();
      ctx.fillStyle = '#ffd86a'; rr(ctx, cx - 4, cy - 18, 8, 8, 2); ctx.fill(); line(ctx, '#3a3530', 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(ctx, cx - 1, cy - 15, 1.4); ctx.fill();
      return;
    }
    case 'sign': {
      ctx.fillStyle = '#6b4a2a'; rr(ctx, cx - 1.5, cy - 2, 3, 14, 1); ctx.fill();
      ctx.fillStyle = '#caa15a'; rr(ctx, cx - 11, cy - 12, 22, 11, 2); ctx.fill(); line(ctx, 'rgba(30,18,8,0.5)', 1.5);
      ctx.strokeStyle = 'rgba(90,58,28,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 7, cy - 8); ctx.lineTo(cx + 7, cy - 8); ctx.moveTo(cx - 7, cy - 5); ctx.lineTo(cx + 5, cy - 5); ctx.stroke();
      return;
    }
    default: {
      ctx.fillStyle = '#2f6e30'; circle(ctx, cx, cy, 7); ctx.fill();
    }
  }
}

// ================= GROUND ITEMS =================
export function drawGroundItem(ctx, id, cx, cy) {
  // soft pickup disc + hand-drawn vector icon (matches the inventory art)
  glow(ctx, cx, cy, 12, 'rgba(255,225,140,0.22)');
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ellipse(ctx, cx, cy + 7, 9, 3.2); ctx.fill();
  const img = itemIconImage(id);
  if (img && img.complete && img.naturalWidth) {
    const s = 22;
    ctx.drawImage(img, cx - s / 2, cy - s / 2 - 1, s, s);
  } else {
    ctx.fillStyle = 'rgba(255,235,170,0.6)'; circle(ctx, cx, cy, 5); ctx.fill();
  }
}
