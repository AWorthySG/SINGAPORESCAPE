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
// Archetypes shipped as painted PNG art (assets/creatures/<sprite>.png). When the
// image has loaded these replace the vector archetype for every monster of that
// sprite; until then (and in headless tests) the vector drawing is used.
const CREATURE_PNGS = new Set(['crab', 'fowl', 'serpent', 'spider']);
const _creatureImg = {};
function creatureImage(sprite) {
  if (_creatureImg[sprite] !== undefined) return _creatureImg[sprite];
  if (typeof Image === 'undefined' || !CREATURE_PNGS.has(sprite)) { _creatureImg[sprite] = null; return null; }
  const img = new Image();
  img.src = `assets/creatures/${sprite}.png`;
  _creatureImg[sprite] = img;
  return img;
}
// Exposed so tests can assert the set stays in lock-step with assets/creatures/.
export const creaturePngs = () => new Set(CREATURE_PNGS);
// Draw a painted creature sprite centred horizontally with its feet on the tile.
function drawCreaturePng(c, img) {
  const H = 34;                       // display height in local (pre-scale) units
  const s = H / img.naturalHeight;
  const w = img.naturalWidth * s;
  c.drawImage(img, -w / 2, 13.5 - H, w, H);
}

// Monsters render via colour-tinted archetypes (def.sprite + def.color). Townsfolk
// keep bespoke human palettes. Bosses get an aura + crown and are scaled by the caller.
export function drawCreature(ctx, npcId, cx, cy, opts = {}) {
  const arch = opts.sprite && ARCH[opts.sprite];
  if (arch) {
    const pimg = creatureImage(opts.sprite);
    return staged(ctx, cx, cy, opts, (c) => {
      if (opts.boss) bossAura(c, opts.time || 0);
      if (pimg && pimg.complete && pimg.naturalWidth) {
        drawCreaturePng(c, pimg);    // painted art carries its own shading
      } else {
        arch(c, opts.color || '#8a8a8a');
        // Soft upper sheen for volume (fades out, so it only lifts the body).
        const sg = c.createRadialGradient(-3, -5, 0, -3, -5, 10);
        sg.addColorStop(0, 'rgba(255,255,255,0.13)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = sg; circle(c, -3, -5, 10); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      if (opts.boss) crown(c);
    });
  }
  const TOWN = {
    banker: { top: '#2f4b8a', skin: '#e8b98a', hair: '#3a2a18', apron: '#d8c089' },
    shopkeeper: { top: '#7a3b1d', skin: '#e0aa78', hair: '#272015', apron: '#cdbfa0' },
    hawker: { top: '#b23b2e', skin: '#e8b98a', hair: '#2a2018', hat: '#f0ead8', apron: '#f0ead8' },
    guide: { top: '#3d6b3a', skin: '#e6b886', hair: '#cfc4b0', hat: '#6b4a2a' },
    mage: { top: '#3a2f7a', skin: '#e6c0a0', hair: '#cfcfdf', hat: '#2a2060' },
    fletcher: { top: '#3f5a2a', skin: '#e0aa78', hair: '#3a2a18', hat: '#5a4020' },
    slayer_master: { top: '#3a2a2a', skin: '#caa078', hair: '#161616', apron: '#5a2a2a' },
    skills_tutor: { top: '#b5862f', skin: '#caa078', hair: '#e6e0d0', hat: '#7a5a2a', apron: '#d8c089' },
    light_priestess: { top: '#eef0e8', skin: '#e6c0a0', hair: '#d8c89a', hat: '#ffe9a8', apron: '#f4ead2' },
    shadow_broker: { top: '#2a2336', skin: '#8a7a90', hair: '#15121c', hat: '#1a1622' },
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

// A lively eye: white sclera, dark pupil, tiny catchlight.
function eyeW(ctx, x, y, r = 1.6, pupil = '#15110b') {
  ctx.fillStyle = '#f8f6ee'; circle(ctx, x, y, r); ctx.fill();
  ctx.fillStyle = pupil; circle(ctx, x + 0.25, y + 0.1, r * 0.56); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; circle(ctx, x - r * 0.32, y - r * 0.34, r * 0.26); ctx.fill();
}
// A short fang/claw triangle.
function fang(ctx, x, y, w, h, color = '#f4efe0') {
  ctx.fillStyle = color; path(ctx, () => { ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); }); ctx.fill();
}

// ---- shared detail helpers (used by the archetype detail pass) ----
// A soft top rim-light arc traced over a body ellipse, for volume.
function rimLight(ctx, x, y, rx, ry, col, k = 0.42) {
  ctx.save();
  ctx.strokeStyle = shade(col, k); ctx.lineWidth = 1.1; ctx.globalAlpha = 0.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx - 0.7), Math.max(0.5, ry - 0.7), 0, Math.PI * 1.1, Math.PI * 1.95); ctx.stroke();
  ctx.restore();
}
// Scattered darker dapples/markings: pts = [[x,y,r],...].
function speckle(ctx, col, pts, k = -0.17) {
  ctx.fillStyle = shade(col, k);
  for (const [x, y, r] of pts) { circle(ctx, x, y, r); ctx.fill(); }
}
// Short fur/scale ticks: segs = [[x1,y1,x2,y2],...].
function ticks(ctx, col, segs, k = -0.22, w = 0.7) {
  ctx.strokeStyle = shade(col, k); ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); } ctx.stroke();
  ctx.lineCap = 'butt';
}

function bossAura(ctx, time = 0) {
  const pulse = 1 + Math.sin(time * 0.004) * 0.12;
  // outer menacing glow
  const g = ctx.createRadialGradient(0, -2, 2, 0, -2, 28 * pulse);
  g.addColorStop(0, 'rgba(255,90,70,0.30)');
  g.addColorStop(0.6, 'rgba(180,40,30,0.16)');
  g.addColorStop(1, 'rgba(255,90,70,0)');
  ctx.fillStyle = g; circle(ctx, 0, -2, 28 * pulse); ctx.fill();
  // dark contact ring on the ground for weight
  ctx.fillStyle = 'rgba(60,0,0,0.22)';
  ellipse(ctx, 0, 13, 15, 5); ctx.fill();
}
function crown(ctx) {
  ctx.fillStyle = '#ffd24a';
  path(ctx, () => { ctx.moveTo(-7, -20); ctx.lineTo(-5, -27); ctx.lineTo(-2, -22); ctx.lineTo(0, -28); ctx.lineTo(2, -22); ctx.lineTo(5, -27); ctx.lineTo(7, -20); });
  ctx.fill(); line(ctx, OUTLINE, 1);
  ctx.fillStyle = '#fff3b0'; rr(ctx, -7, -21, 14, 1.6, 0.8); ctx.fill(); // gold band shine
  // jewels
  ctx.fillStyle = '#d8566f'; circle(ctx, 0, -25, 1); ctx.fill();
  ctx.fillStyle = '#5ad1ff'; circle(ctx, -5, -25.4, 0.8); ctx.fill(); circle(ctx, 5, -25.4, 0.8); ctx.fill();
}

// ---- IMPROVED ARCHETYPES (ctx, col) ----

function beast(ctx, col) {
  // Improved: Better quadruped stance, more versatile for boar/tiger/otter/deer, stronger volume
  // back legs
  ctx.fillStyle = shade(col, -0.35); rr(ctx, -9, 7, 4, 6.5, 1.2); ctx.fill();
  ctx.fillStyle = shade(col, -0.22); rr(ctx, 3, 7, 4, 6.5, 1.2); ctx.fill();
  // front legs (lighter)
  ctx.fillStyle = shade(col, -0.28); rr(ctx, -5.5, 7.5, 3.8, 6, 1); ctx.fill();
  ctx.fillStyle = shade(col, -0.12); rr(ctx, 5, 7.5, 3.8, 6, 1); ctx.fill();
  // tail
  ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 2.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, 2); ctx.quadraticCurveTo(-18, -1, -15, -8); ctx.stroke(); ctx.lineCap = 'butt';
  // body - more substantial
  ellipse(ctx, -0.5, 1.5, 11.5, 7.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.2); ellipse(ctx, -0.5, 5, 9.5, 3.8); ctx.fill(); // belly
  ctx.fillStyle = shade(col, 0.18); ellipse(ctx, -1.5, -2.5, 8, 2.8); ctx.fill(); // back highlight
  rimLight(ctx, -0.5, 1.5, 11.5, 7.5, col);
  speckle(ctx, col, [[-6, 0, 1.1], [-1.5, 1.5, 0.9], [3, -0.5, 0.85], [-3.5, 4, 0.8]]);
  ticks(ctx, col, [[-7, 4.5, -5.5, 7], [-2.5, 5, -1, 7.5], [2.5, 4.5, 4, 7]], -0.18);
  // shaggy spine / mane tufts (better flow)
  ctx.fillStyle = shade(col, -0.38);
  path(ctx, () => { ctx.moveTo(-10, -4); ctx.lineTo(-8, -11); ctx.lineTo(-5, -4); ctx.lineTo(-2, -10); ctx.lineTo(1, -4); ctx.lineTo(4, -9); ctx.lineTo(7, -4); }); ctx.fill();
  // head
  circle(ctx, 9.5, -0.5, 5.8); fill(ctx, col); line(ctx);
  // ear
  ctx.fillStyle = shade(col, -0.32); path(ctx, () => { ctx.moveTo(6, -5); ctx.lineTo(5, -11); ctx.lineTo(10, -6); }); ctx.fill();
  // snout
  ctx.fillStyle = shade(col, 0.2); ellipse(ctx, 14.5, 0.5, 3.4, 2.8); ctx.fill();
  ctx.fillStyle = '#1a140d'; circle(ctx, 16, 0.3, 0.65); ctx.fill(); // nostril
  // tusk
  fang(ctx, 13.8, 2.8, 1.2, 2.6);
  eyeW(ctx, 10.5, -2.2, 1.15);
}

function rodent(ctx, col) {
  // Improved: cuter but still rat-like, better tail curl, clearer buck tooth, whiskers
  ctx.strokeStyle = shade(col, 0.25); ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, 5); ctx.quadraticCurveTo(-20, 2, -15, -8); ctx.stroke(); ctx.lineCap = 'butt';
  // feet
  ctx.fillStyle = shade(col, 0.3); circle(ctx, -4, 9.5, 1.7); ctx.fill(); circle(ctx, 4.5, 9.5, 1.7); ctx.fill();
  // body - rounder
  ellipse(ctx, 0, 2.5, 9.5, 6.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.32); ellipse(ctx, 1.5, 5, 5.5, 3); ctx.fill(); // pale belly
  ctx.fillStyle = shade(col, 0.15); ellipse(ctx, 0.5, 0.5, 6.5, 3); ctx.fill();
  rimLight(ctx, 0, 2.5, 9.5, 6.5, col);
  ticks(ctx, col, [[-6, 0, -4.5, 2.5], [-3, -1, -1.5, 1.5], [-7, 4, -5.5, 6]], -0.16);
  // head
  circle(ctx, 8.5, -0.5, 5); fill(ctx, col); line(ctx);
  // big ear
  circle(ctx, 7, -5.5, 3.2); fill(ctx, shade(col, 0.28)); line(ctx, OUTLINE, 1.2);
  ctx.fillStyle = shade(col, 0.42); circle(ctx, 7, -5.5, 1.6); ctx.fill();
  // snout + buck teeth
  path(ctx, () => { ctx.moveTo(12.5, -1); ctx.lineTo(16, 1); ctx.lineTo(12.5, 3); }); fill(ctx, shade(col, 0.25));
  ctx.fillStyle = '#1a140d'; circle(ctx, 15.8, 0.8, 0.65); ctx.fill();
  // prominent buck tooth
  ctx.fillStyle = '#f4f0e8'; rr(ctx, 13.2, 2.2, 1.6, 2.2, 0.3); ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(12.8, 0.8); ctx.lineTo(18.5, 0); ctx.moveTo(12.8, 1.6); ctx.lineTo(18.5, 2.2); ctx.stroke();
  eyeW(ctx, 10.2, -1.5, 1.05, '#8a1010');
}

function primate(ctx, col) {
  // Improved: better ape proportions, longer arms, clearer face patch, expressive
  ctx.strokeStyle = shade(col, -0.12); ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 5); ctx.quadraticCurveTo(-20, 3, -16, -10); ctx.stroke(); ctx.lineCap = 'butt';
  // legs
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -7, 5.5, 4.2, 8, 2); ctx.fill(); rr(ctx, 2, 5.5, 4.2, 8, 2); ctx.fill();
  // long reaching arms
  ctx.strokeStyle = shade(col, -0.08); ctx.lineWidth = 4.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-7, -1); ctx.quadraticCurveTo(-13, 5, -9, 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -1); ctx.quadraticCurveTo(12, 5, 8, 10); ctx.stroke(); ctx.lineCap = 'butt';
  // body
  ellipse(ctx, 0, 0.5, 8, 9); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.2); ellipse(ctx, 0, 1.5, 4.2, 6); ctx.fill(); // bare chest
  rimLight(ctx, 0, 0.5, 8, 9, col);
  // pectoral / ab definition
  ctx.strokeStyle = shade(col, -0.18); ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(0, 6); ctx.moveTo(-3, -1); ctx.quadraticCurveTo(0, 0.5, 3, -1); ctx.stroke();
  ticks(ctx, col, [[-7, -2, -5.5, 0.5], [5.5, -2, 7, 0.5], [-6.5, 4, -5, 6]], -0.16);
  // head + face patch
  circle(ctx, 0.5, -10.5, 6.2); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.28); circle(ctx, -5.5, -10.5, 2.1); ctx.fill(); circle(ctx, 6.5, -10.5, 2.1); ctx.fill();
  // face patch (lighter)
  ellipse(ctx, 0.5, -9.5, 4.8, 5.2); fill(ctx, shade(col, 0.38));
  // brow ridge
  ctx.fillStyle = shade(col, -0.32); rr(ctx, -3, -14, 7, 1.8, 0.9); ctx.fill();
  eyeW(ctx, -1.5, -10.8, 1.05); eyeW(ctx, 2.8, -10.8, 1.05);
}

function reptile(ctx, col) {
  // Improved: more lizard/croc feel, better tail, clearer dorsal ridge, tongue
  ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 4.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, 3); ctx.quadraticCurveTo(-26, 6, -22, -5); ctx.stroke(); ctx.lineCap = 'butt';
  // sprawled legs
  ctx.fillStyle = shade(col, -0.28); rr(ctx, -7, 6, 5.2, 5.5, 2); ctx.fill(); rr(ctx, 2.5, 6, 5.2, 5.5, 2); ctx.fill();
  // body
  ellipse(ctx, 0, 1.5, 12.5, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.24); ellipse(ctx, 0, 4.5, 10.5, 2.8); ctx.fill(); // belly shadow
  ctx.fillStyle = shade(col, 0.16); ellipse(ctx, -1.5, -1.5, 8, 2.6); ctx.fill(); // back sheen
  rimLight(ctx, 0, 1.5, 12.5, 7, col);
  speckle(ctx, col, [[-7, 0.5, 0.9], [-3, 1.5, 0.9], [1, 0.5, 0.85], [5, 1.5, 0.8], [-5, 3.5, 0.7], [3, 3.5, 0.7]], -0.22);
  // dorsal ridge (more pronounced)
  ctx.fillStyle = shade(col, -0.38);
  for (const x of [-8, -4, 0, 4]) {
    path(ctx, () => { ctx.moveTo(x, -4.5); ctx.lineTo(x + 1.3, -8); ctx.lineTo(x + 2.6, -4.5); }); ctx.fill();
  }
  // head
  ellipse(ctx, 12, -0.5, 7, 4.8); fill(ctx, col); line(ctx);
  // jaw line + tongue
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(14.5, 1.8); ctx.lineTo(19.5, 1.4); ctx.stroke();
  ctx.strokeStyle = '#d8324a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(19.5, 1.5); ctx.lineTo(23, 1.1); ctx.stroke();
  eyeW(ctx, 13.5, -2.5, 1.1, '#15110b');
}

function serpent(ctx, col) {
  // Improved: more dynamic coil, better hood for cobra, clearer scale suggestion, forked tongue
  ctx.strokeStyle = col; ctx.lineWidth = 6.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, 10); ctx.quadraticCurveTo(8, 7, -5, -1); ctx.quadraticCurveTo(-15, -7, 3, -9); ctx.stroke();
  ctx.lineWidth = 3.2; ctx.strokeStyle = shade(col, 0.26); ctx.beginPath(); ctx.moveTo(-12, 10); ctx.quadraticCurveTo(8, 7, -5, -1); ctx.stroke();
  // scale suggestion ticks
  ctx.lineWidth = 1.1; ctx.strokeStyle = shade(col, -0.32);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const t = i / 5; ctx.moveTo(-10 + t*13, 8.5 - t*8.5); ctx.lineTo(-8 + t*13, 10.5 - t*8.5); }
  ctx.stroke(); ctx.lineCap = 'butt';
  // hooded head (more cobra-like)
  path(ctx, () => { ctx.moveTo(4, -10); ctx.quadraticCurveTo(-1, -8, 1, -3); ctx.quadraticCurveTo(5, -2, 9, -3); ctx.quadraticCurveTo(11, -8, 4, -10); }); fill(ctx, col); line(ctx, OUTLINE, 1.2);
  circle(ctx, 5, -8.5, 3.6); fill(ctx, col); line(ctx, OUTLINE, 1.2);
  // eye + slit pupil
  ctx.fillStyle = '#ffe24a'; ellipse(ctx, 6.2, -9.2, 1.35, 0.95); ctx.fill();
  ctx.fillStyle = '#1a140d'; rr(ctx, 5.9, -10, 0.7, 1.7, 0.25); ctx.fill();
  // forked tongue
  ctx.strokeStyle = '#d8324a'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8.5, -8.2); ctx.lineTo(12.5, -8.8); ctx.moveTo(12.5, -8.8); ctx.lineTo(13.8, -9.8); ctx.moveTo(12.5, -8.8); ctx.lineTo(13.8, -7.8); ctx.stroke(); ctx.lineCap = 'butt';
}

function crab(ctx, col) {
  // Improved: better domed shell, more convincing jointed legs, bigger characterful pincers
  // walking legs (more jointed look)
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 1.9; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2]) {
    ctx.beginPath(); ctx.moveTo(s * 5.5, 3.5); ctx.lineTo(s * (9.5 + i * 2.2), 5.5 + i); ctx.lineTo(s * (12 + i * 2.2), 10.5); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // domed shell
  ellipse(ctx, 0, 1.5, 11.5, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.22); ellipse(ctx, -1.5, -1.2, 7.5, 3.2); ctx.fill();
  ctx.fillStyle = shade(col, -0.2); ellipse(ctx, 0, 4.5, 9.5, 2.8); ctx.fill();
  // shell rim lines
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-5.5, 0.5); ctx.lineTo(-4, 3.5); ctx.moveTo(0, 0.5); ctx.lineTo(0, 3.5); ctx.moveTo(5.5, 0.5); ctx.lineTo(4, 3.5); ctx.stroke();
  // big pincer claws (more menacing)
  for (const s of [-1, 1]) {
    ctx.fillStyle = col; ellipse(ctx, s * 11.5, -1.5, 4.2, 3.6); ctx.fill(); line(ctx, OUTLINE, 1.2);
    ctx.fillStyle = shade(col, -0.22); path(ctx, () => { ctx.moveTo(s * 13.5, -3.5); ctx.lineTo(s * 17, -1.5); ctx.lineTo(s * 12.5, -1.5); }); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(s * 9.5, -1.5); ctx.lineTo(s * 14.5, -1.5); ctx.stroke();
  }
  // eyestalks
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-2.8, -6); ctx.lineTo(-2.8, -10.5); ctx.moveTo(2.8, -6); ctx.lineTo(2.8, -10.5); ctx.stroke();
  eyeW(ctx, -2.8, -10.5, 1.35); eyeW(ctx, 2.8, -10.5, 1.35);
}

function fowl(ctx, col) {
  // Improved: better chicken/hornbill/kingfisher versatility, nicer tail, clearer comb/wattle
  ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = 2.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3.5, 7.5); ctx.lineTo(-3.5, 13); ctx.moveTo(-5, 13); ctx.lineTo(-2, 13);
  ctx.moveTo(3, 7.5); ctx.lineTo(3, 13); ctx.moveTo(1.5, 13); ctx.lineTo(4.5, 13); ctx.stroke(); ctx.lineCap = 'butt';
  // body
  ellipse(ctx, 0, 1.5, 8.5, 7.5); fill(ctx, col); line(ctx);
  // layered tail feathers (more dynamic)
  path(ctx, () => { ctx.moveTo(-7.5, -1.5); ctx.lineTo(-15, -9); ctx.lineTo(-7.5, 4); }); fill(ctx, shade(col, -0.2)); line(ctx);
  path(ctx, () => { ctx.moveTo(-7, 0.5); ctx.lineTo(-13, -4); ctx.lineTo(-7, 4); }); fill(ctx, shade(col, 0.1));
  // folded wing
  ctx.fillStyle = shade(col, -0.14); ellipse(ctx, -1.5, 1.5, 5, 5); ctx.fill();
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-4.5, 0.5); ctx.lineTo(1.5, 3.5); ctx.stroke();
  // head + comb + wattle + beak
  circle(ctx, 6.5, -7, 4.8); fill(ctx, shade(col, 0.1)); line(ctx);
  ctx.fillStyle = '#d23b2e'; circle(ctx, 5.5, -11.5, 1.5); ctx.fill(); circle(ctx, 7.8, -11.5, 1.5); ctx.fill();
  ctx.fillStyle = '#c2302a'; ellipse(ctx, 6.5, -4, 1.3, 1.9); ctx.fill();
  path(ctx, () => { ctx.moveTo(10, -7); ctx.lineTo(15, -6.2); ctx.lineTo(10, -4.5); }); fill(ctx, '#f0a93b');
  eyeW(ctx, 7.8, -8, 1.05);
}

function greenman(ctx, col) {
  // Improved: more goblin/leafy character, better ear shape, clearer snaggle teeth
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -5.5, 6, 4.2, 8, 2); ctx.fill(); rr(ctx, 0.8, 6, 4.2, 8, 2); ctx.fill();
  rr(ctx, -7.5, -4.5, 15, 13, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.18); ellipse(ctx, -1.5, 0.5, 4.2, 5.5); ctx.fill(); // pot belly highlight
  ctx.fillStyle = shade(col, 0.16); rr(ctx, -6.5, -4, 13, 1.8, 1); ctx.fill(); // shoulder rim
  speckle(ctx, col, [[3.5, -1, 1], [4.5, 2.5, 0.8], [-5, 3, 0.8], [2, 5, 0.7]], -0.24); // warts
  // loincloth
  ctx.fillStyle = '#7a5a2a'; rr(ctx, -7.5, 6, 15, 5, 2); ctx.fill();
  ctx.fillStyle = '#5a4220'; rr(ctx, -7.5, 6, 15, 1.5, 1); ctx.fill();
  // arms
  ctx.fillStyle = col; rr(ctx, -10.5, -3.5, 4, 9.5, 2); ctx.fill(); rr(ctx, 6, -3.5, 4, 9.5, 2); ctx.fill();
  // head
  circle(ctx, 0, -10.5, 6.8); fill(ctx, shade(col, 0.08)); line(ctx);
  // pointy ears
  path(ctx, () => { ctx.moveTo(-6, -11); ctx.lineTo(-12.5, -14.5); ctx.lineTo(-6, -7); }); fill(ctx, shade(col, 0.08)); line(ctx, OUTLINE, 1.2);
  path(ctx, () => { ctx.moveTo(6, -11); ctx.lineTo(12.5, -14.5); ctx.lineTo(6, -7); }); fill(ctx, shade(col, 0.08)); line(ctx, OUTLINE, 1.2);
  // brow, nose, teeth
  ctx.fillStyle = shade(col, -0.32); rr(ctx, -5.5, -13.5, 11, 1.7, 0.8); ctx.fill();
  ctx.fillStyle = shade(col, -0.16); ellipse(ctx, 0.3, -8.8, 1.7, 2.5); ctx.fill();
  ctx.fillStyle = '#f4efe0';
  path(ctx, () => { ctx.moveTo(-2.8, -6.2); ctx.lineTo(-1.6, -4.2); ctx.lineTo(-0.4, -6.2); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(1.2, -6.2); ctx.lineTo(2.4, -4.2); ctx.lineTo(3.6, -6.2); }); ctx.fill();
  eyeW(ctx, -2.8, -11, 1.2, '#7a1010'); eyeW(ctx, 3.2, -11, 1.2, '#7a1010');
}

function spider(ctx, col) {
  // Improved: cleaner 8 legs with better articulation, stronger hourglass/abdomen mark, cluster eyes
  ctx.strokeStyle = shade(col, -0.15); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2, 3]) {
    const ky = -3.5 + i * 3.5;
    ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.lineTo(s * (6.5 + i * 2.5), ky); ctx.lineTo(s * (11 + i * 2.7), ky + 4.5); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // abdomen
  ellipse(ctx, 0, 3.5, 7.5, 6.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.32); path(ctx, () => { ctx.moveTo(0, -1.5); ctx.lineTo(2.4, 4.5); ctx.lineTo(0, 8.5); ctx.lineTo(-2.4, 4.5); }); ctx.fill();
  // cephalothorax
  circle(ctx, 0, -4.5, 4.3); fill(ctx, shade(col, -0.18)); line(ctx);
  // fangs
  fang(ctx, -1.5, -1, 0.95, 2.1, shade(col, -0.42)); fang(ctx, 1.5, -1, 0.95, 2.1, shade(col, -0.42));
  // eye cluster (classic spider)
  ctx.fillStyle = '#ff2a2a';
  for (const [ex, ey] of [[-2.1, -5.2], [2.1, -5.2], [-0.9, -6.6], [0.9, -6.6], [-2.8, -6.3], [2.8, -6.3]]) {
    circle(ctx, ex, ey, 0.85); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(ctx, -2.4, -5.5, 0.28); ctx.fill(); circle(ctx, 1.8, -5.5, 0.28); ctx.fill();
}

function slime(ctx, col) {
  // Improved: more organic wobble shape, better drips, cuter/more readable face
  ctx.globalAlpha = 0.9;
  path(ctx, () => { ctx.moveTo(-10.5, 9.5); ctx.quadraticCurveTo(-13, -7, 0, -7.5); ctx.quadraticCurveTo(13, -7, 10.5, 9.5); }); fill(ctx, col); line(ctx);
  ctx.globalAlpha = 1;
  // drips
  ctx.fillStyle = col; circle(ctx, -5.5, 9.5, 2.2); ctx.fill(); circle(ctx, 5, 9.5, 1.8); ctx.fill();
  // glossy highlight
  ctx.fillStyle = shade(col, 0.38); ellipse(ctx, -3.5, -2.5, 3.2, 4.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ellipse(ctx, -4.5, -4, 1.4, 2); ctx.fill(); // bright specular
  // inner bubbles
  ctx.fillStyle = shade(col, 0.18); circle(ctx, 4, 3.5, 1.5); ctx.fill(); circle(ctx, -5.5, 4.5, 1.1); ctx.fill(); circle(ctx, 6, -0.5, 0.9); ctx.fill();
  // face - more expressive
  eyeW(ctx, -3.2, 0.5, 1.45); eyeW(ctx, 3.3, 0.5, 1.45);
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0.2, 3.8, 2.1, 0.25, Math.PI - 0.25); ctx.stroke();
}

function ghost(ctx, col) {
  // Improved: better flowing sheet silhouette, more haunting eyes/mouth, subtle aura already in engine but enhanced here lightly
  const g = ctx.createRadialGradient(0, -4.5, 2.5, 0, -4.5, 15); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; circle(ctx, 0, -4.5, 15); ctx.fill();
  ctx.globalAlpha = 0.78;
  path(ctx, () => { ctx.moveTo(-8.5, 9.5); ctx.lineTo(-8.5, -6.5); ctx.quadraticCurveTo(-8.5, -14.5, 0, -14.5); ctx.quadraticCurveTo(8.5, -14.5, 8.5, -6.5); ctx.lineTo(8.5, 9.5); ctx.lineTo(5, 6.5); ctx.lineTo(2, 9.5); ctx.lineTo(-1, 6.5); ctx.lineTo(-4, 9.5); ctx.lineTo(-8.5, 6.5); }); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.28); ellipse(ctx, -3.2, -6.5, 2.3, 3.8); ctx.fill();
  ctx.globalAlpha = 1;
  // hollow eyes
  ctx.fillStyle = '#16141f'; ellipse(ctx, -3.2, -7.5, 1.55, 2.15); ctx.fill(); ellipse(ctx, 3.2, -7.5, 1.55, 2.15); ctx.fill();
  ctx.fillStyle = 'rgba(170,205,255,0.92)'; circle(ctx, -3.2, -7.9, 0.55); ctx.fill(); circle(ctx, 3.2, -7.9, 0.55); ctx.fill();
  // wailing mouth
  ctx.fillStyle = '#16141f'; ellipse(ctx, 0, -2.2, 1.6, 2.3); ctx.fill();
  // drifting ectoplasm motes
  ctx.fillStyle = 'rgba(205,225,255,0.7)';
  circle(ctx, -10, -9.5, 0.85); ctx.fill(); circle(ctx, 9.5, -11.5, 0.65); ctx.fill(); circle(ctx, 8, 2, 0.55); ctx.fill();
}

function demon(ctx, col) {
  // Improved: more menacing bat wings, better horn curve, scarier fanged grin, stronger torso
  ctx.fillStyle = shade(col, -0.42);
  path(ctx, () => { ctx.moveTo(-6.5, -3.5); ctx.lineTo(-16.5, -10); ctx.lineTo(-13, -3.5); ctx.lineTo(-16.5, 1); ctx.lineTo(-7.5, 3); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(6.5, -3.5); ctx.lineTo(16.5, -10); ctx.lineTo(13, -3.5); ctx.lineTo(16.5, 1); ctx.lineTo(7.5, 3); }); ctx.fill();
  // hooved legs
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -5.5, 6, 4.2, 8, 2); ctx.fill(); rr(ctx, 0.8, 6, 4.2, 8, 2); ctx.fill();
  ctx.fillStyle = '#1a120e'; rr(ctx, -5.5, 12.2, 4.2, 2.5, 1); ctx.fill(); rr(ctx, 0.8, 12.2, 4.2, 2.5, 1); ctx.fill();
  // torso
  rr(ctx, -7.5, -4.5, 15, 12.5, 4); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.2); ellipse(ctx, 0, 3.5, 5.2, 4.2); ctx.fill();
  ctx.fillStyle = shade(col, 0.16); rr(ctx, -6.5, -4, 13, 2, 1); ctx.fill(); // shoulder rim light
  ctx.fillStyle = shade(col, 0.12); ellipse(ctx, -2.8, -1.5, 2.8, 3.8); ctx.fill();
  // chest / ab muscle lines
  ctx.strokeStyle = shade(col, -0.34); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(0, 6); ctx.moveTo(-4, -1.5); ctx.quadraticCurveTo(0, 0.5, 4, -1.5); ctx.moveTo(-3.5, 2); ctx.lineTo(3.5, 2); ctx.stroke();
  ctx.fillStyle = col; rr(ctx, -11.5, -3.5, 4.2, 9.5, 2); ctx.fill(); rr(ctx, 7, -3.5, 4.2, 9.5, 2); ctx.fill();
  // head + curved horns
  circle(ctx, 0, -10.5, 6.2); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.32);
  path(ctx, () => { ctx.moveTo(-6, -13.5); ctx.lineTo(-9.5, -21); ctx.lineTo(-3, -14.5); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(6, -13.5); ctx.lineTo(9.5, -21); ctx.lineTo(3, -14.5); }); ctx.fill();
  // fanged grin
  ctx.fillStyle = '#f4efe0';
  for (const x of [-3.2, -1.4, 0.4, 2.2]) {
    path(ctx, () => { ctx.moveTo(x - 0.65, -6.8); ctx.lineTo(x + 0.65, -6.8); ctx.lineTo(x, -5); }); ctx.fill();
  }
  // glowing eyes
  ctx.fillStyle = '#ffd24a'; circle(ctx, -2.4, -10.5, 1.35); ctx.fill(); circle(ctx, 2.4, -10.5, 1.35); ctx.fill();
  ctx.fillStyle = '#fff7d0'; circle(ctx, -2.4, -10.5, 0.45); ctx.fill(); circle(ctx, 2.4, -10.5, 0.45); ctx.fill();
}

function golem(ctx, col) {
  // Improved: chunkier stone feel, better facet shading, stronger glowing runes, clearer cracks
  ctx.fillStyle = shade(col, -0.28); rr(ctx, -6.5, 6, 4.8, 8, 1.2); ctx.fill(); rr(ctx, 1.2, 6, 4.8, 8, 1.2); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -13.5, -4.5, 5.2, 11.5, 2); ctx.fill(); rr(ctx, 8, -4.5, 5.2, 11.5, 2); ctx.fill();
  ctx.fillStyle = shade(col, -0.32); rr(ctx, -14, 5, 5.8, 3.2, 1); ctx.fill(); rr(ctx, 8, 5, 5.8, 3.2, 1); ctx.fill();
  // boulder torso with facets
  rr(ctx, -9.5, -6.5, 19, 14.5, 3); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.14); path(ctx, () => { ctx.moveTo(-9.5, -6.5); ctx.lineTo(2, -6.5); ctx.lineTo(-4.5, 0.5); ctx.lineTo(-9.5, 0.5); }); ctx.fill();
  ctx.fillStyle = shade(col, 0.26); rr(ctx, -8.5, -6, 16, 1.6, 0.8); ctx.fill(); // top rim light
  // patches of moss
  ctx.fillStyle = 'rgba(74,128,58,0.55)'; circle(ctx, -7, 5, 1.6); ctx.fill(); circle(ctx, 6.5, 4, 1.3); ctx.fill(); circle(ctx, -5.5, 6, 1); ctx.fill();
  ctx.fillStyle = shade(col, -0.22); path(ctx, () => { ctx.moveTo(9, 7.5); ctx.lineTo(2, 7.5); ctx.lineTo(7, 0.5); ctx.lineTo(9, 0.5); }); ctx.fill();
  // cracks
  ctx.strokeStyle = shade(col, -0.42); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-9, -0.5); ctx.lineTo(-2.5, 0.5); ctx.lineTo(2.5, -3.5); ctx.moveTo(3, 7.5); ctx.lineTo(5, 1.5); ctx.stroke();
  // head with runes
  rr(ctx, -5.5, -15.5, 11, 9.5, 2); fill(ctx, shade(col, 0.06)); line(ctx);
  ctx.fillStyle = '#ffce4a'; rr(ctx, -3.6, -12.5, 2.7, 2.7, 1); ctx.fill(); rr(ctx, 0.7, -12.5, 2.7, 2.7, 1); ctx.fill();
  ctx.fillStyle = '#fff3c0'; rr(ctx, -3.6, -12.5, 2.7, 1.1, 0.5); ctx.fill(); rr(ctx, 0.7, -12.5, 2.7, 1.1, 0.5); ctx.fill();
}

function undead(ctx, col) {
  // Improved: more skeletal, better ribcage detail, skull with full teeth row, glowing sockets
  ctx.strokeStyle = col; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3.5, 7.5); ctx.lineTo(-3.5, 13); ctx.moveTo(3.5, 7.5); ctx.lineTo(3.5, 13);
  ctx.moveTo(-5.5, -1.5); ctx.lineTo(-9.5, 4.5); ctx.moveTo(5.5, -1.5); ctx.lineTo(9.5, 4.5); ctx.stroke(); ctx.lineCap = 'butt';
  // ribcage
  rr(ctx, -5.5, -3.5, 11, 11.5, 2); fill(ctx, shade(col, -0.08)); line(ctx);
  ctx.strokeStyle = shade(col, -0.48); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(0, 7.5); ctx.stroke();
  for (const yy of [-1.5, 1.5, 4.5]) { ctx.beginPath(); ctx.moveTo(-4.5, yy); ctx.quadraticCurveTo(0, yy + 1.7, 4.5, yy); ctx.stroke(); }
  // skull
  circle(ctx, 0, -10.5, 5.8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.2); ellipse(ctx, -2, -12.5, 2.6, 1.6); ctx.fill(); // cranium sheen
  ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(1.5, -14.5); ctx.lineTo(2.6, -12.5); ctx.lineTo(1.8, -11.5); ctx.stroke(); // hairline crack
  ctx.fillStyle = '#15110b'; ellipse(ctx, -2.5, -11, 1.65, 2); ctx.fill(); ellipse(ctx, 2.5, -11, 1.65, 2); ctx.fill();
  ctx.fillStyle = '#7a1414'; circle(ctx, -2.5, -11, 0.75); ctx.fill(); circle(ctx, 2.5, -11, 0.75); ctx.fill();
  // nose cavity
  ctx.fillStyle = '#15110b'; path(ctx, () => { ctx.moveTo(0, -9); ctx.lineTo(-1.1, -7.2); ctx.lineTo(1.1, -7.2); }); ctx.fill();
  // jaw + teeth
  ctx.fillStyle = shade(col, -0.12); rr(ctx, -3.2, -6.5, 6.4, 2.6, 0.6); ctx.fill();
  ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 0.75;
  ctx.beginPath(); ctx.moveTo(-1.6, -6.3); ctx.lineTo(-1.6, -4); ctx.moveTo(0, -6.3); ctx.lineTo(0, -4); ctx.moveTo(1.6, -6.3); ctx.lineTo(1.6, -4); ctx.stroke();
}

function insect(ctx, col) {
  // Improved: more mosquito-like (long proboscis), better wing blur, spindly legs
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#d4f0ff'; ellipse(ctx, -6.5, -3.5, 7.5, 3.2); ctx.fill(); ellipse(ctx, 6.5, -3.5, 7.5, 3.2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(180,220,235,0.65)'; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.moveTo(-11, -3.5); ctx.lineTo(-2.5, -2.5); ctx.moveTo(11, -3.5); ctx.lineTo(2.5, -2.5); ctx.stroke();
  // legs (very spindly)
  ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 0.95; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(s * 2.2, 2.5 + i*0.8); ctx.lineTo(s * 6.5, 8 + i * 1.6); ctx.stroke(); }
  ctx.lineCap = 'butt';
  // segmented body
  ellipse(ctx, 0, 3.5, 4.8, 6.5); fill(ctx, col); line(ctx);
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-4, 2.5); ctx.lineTo(4, 2.5); ctx.moveTo(-4, 5.5); ctx.lineTo(4, 5.5); ctx.stroke();
  circle(ctx, 0, -5.5, 3.2); fill(ctx, shade(col, -0.2)); line(ctx);
  // proboscis
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2.2, -8.5); ctx.lineTo(-4.5, -13); ctx.moveTo(2.2, -8.5); ctx.lineTo(4.5, -13); ctx.stroke();
  ctx.fillStyle = '#9b1e1e'; circle(ctx, -1.6, -5.8, 1.1); ctx.fill(); circle(ctx, 1.6, -5.8, 1.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(ctx, -1.9, -6.2, 0.35); ctx.fill(); circle(ctx, 1.3, -6.2, 0.35); ctx.fill();
}

function scorpion(ctx, col) {
  // Improved: more threatening tail curl + stinger, better pincer grasp, segmented body clearer
  ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const i of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(i * 3, 6.5); ctx.lineTo(i * 3 - 4, 10.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 3, 6.5); ctx.lineTo(i * 3 + 4, 10.5); ctx.stroke(); }
  // tail + stinger (more curved and dangerous)
  ctx.strokeStyle = col; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(7.5, 5.5); ctx.quadraticCurveTo(19, 3, 14.5, -8.5); ctx.stroke();
  ctx.lineWidth = 2.1; ctx.strokeStyle = shade(col, -0.26); ctx.beginPath(); ctx.moveTo(8.5, 4.5); ctx.quadraticCurveTo(18, 2, 14.5, -8); ctx.stroke(); ctx.lineCap = 'butt';
  fang(ctx, 14.5, -10.5, 1.35, 3.2, shade(col, -0.38));
  // body
  ellipse(ctx, 0, 3.5, 8.5, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.22); ellipse(ctx, -1, 1.5, 5, 1.9); ctx.fill(); // carapace sheen
  rimLight(ctx, 0, 3.5, 8.5, 5, col);
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(-3.2, -0.5); ctx.lineTo(-3.2, 7); ctx.moveTo(2.2, -0.5); ctx.lineTo(2.2, 7); ctx.stroke();
  // pincers
  for (const [px, py] of [[-10.5, 0.5], [-12.5, 4]]) {
    ctx.fillStyle = col; ellipse(ctx, px, py, 3.2, 2.3); ctx.fill(); line(ctx, OUTLINE, 1.1);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(px - 2.2, py); ctx.lineTo(px + 2.2, py); ctx.stroke();
  }
  eyeW(ctx, 2.8, 2, 0.85, '#15110b');
}

function bat(ctx, col) {
  // Improved: more detailed scalloped wings with finger bones, fuzzier body, cuter but creepy face
  ctx.fillStyle = col;
  path(ctx, () => { ctx.moveTo(-3.5, -0.5); ctx.lineTo(-15.5, -8); ctx.lineTo(-12, -1.5); ctx.lineTo(-15.5, 0.5); ctx.lineTo(-11, 2.5); ctx.lineTo(-14.5, 4.5); ctx.lineTo(-4.5, 3.5); }); ctx.fill(); line(ctx, OUTLINE, 1.1);
  path(ctx, () => { ctx.moveTo(3.5, -0.5); ctx.lineTo(15.5, -8); ctx.lineTo(12, -1.5); ctx.lineTo(15.5, 0.5); ctx.lineTo(11, 2.5); ctx.lineTo(14.5, 4.5); ctx.lineTo(4.5, 3.5); }); ctx.fill(); line(ctx, OUTLINE, 1.1);
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(-4.5, 0.5); ctx.lineTo(-13.5, -6); ctx.moveTo(4.5, 0.5); ctx.lineTo(13.5, -6); ctx.stroke();
  // body
  circle(ctx, 0, -0.5, 4.8); fill(ctx, shade(col, 0.1)); line(ctx);
  ctx.fillStyle = shade(col, 0.32); ellipse(ctx, 0, 1, 2.6, 2.1); ctx.fill(); // furry belly
  ticks(ctx, col, [[-2.5, -1.5, -1.8, 0], [0, -2, 0, -0.3], [2.5, -1.5, 1.8, 0]], 0.22, 0.6); // chest fluff
  // ears
  ctx.fillStyle = shade(col, -0.22); path(ctx, () => { ctx.moveTo(-3.2, -4.5); ctx.lineTo(-4.2, -9); ctx.lineTo(-1, -5.5); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(3.2, -4.5); ctx.lineTo(4.2, -9); ctx.lineTo(1, -5.5); }); ctx.fill();
  // eyes + tiny fangs
  ctx.fillStyle = '#ffe24a'; circle(ctx, -1.8, -1, 0.95); ctx.fill(); circle(ctx, 1.8, -1, 0.95); ctx.fill();
  ctx.fillStyle = '#1a140d'; circle(ctx, -1.8, -1, 0.38); ctx.fill(); circle(ctx, 1.8, -1, 0.38); ctx.fill();
  fang(ctx, -1.1, 2, 0.65, 1.3); fang(ctx, 1.1, 2, 0.65, 1.3);
}

function seacreature(ctx, col) {
  // Improved: more versatile for shark/dolphin/Merlion/kraken — sleeker body, better fin placement, stronger tail
  path(ctx, () => { ctx.moveTo(-12.5, 1.5); ctx.quadraticCurveTo(0, -9.5, 14, 0.5); ctx.quadraticCurveTo(0, 10.5, -12.5, 1.5); }); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.28); path(ctx, () => { ctx.moveTo(-10.5, 2.5); ctx.quadraticCurveTo(1.5, 8.5, 12, 1); ctx.quadraticCurveTo(0, 6.5, -10.5, 2.5); }); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; path(ctx, () => { ctx.moveTo(-7, -3); ctx.quadraticCurveTo(2, -6, 9, -1.5); ctx.quadraticCurveTo(2, -3.5, -7, -3); }); ctx.fill(); // top sheen
  ticks(ctx, col, [[5, -2.5, 4.5, 2.5], [7, -2, 6.5, 2.5], [9, -1, 8.5, 2]], -0.3, 0.7); // gill-ish lateral lines
  // tail fluke
  path(ctx, () => { ctx.moveTo(-12.5, 1.5); ctx.lineTo(-18.5, -4.5); ctx.lineTo(-15, 1.5); ctx.lineTo(-18.5, 7.5); }); fill(ctx, shade(col, -0.18)); line(ctx, OUTLINE, 1.1);
  // dorsal fin
  ctx.fillStyle = shade(col, -0.2); path(ctx, () => { ctx.moveTo(0.5, -6.5); ctx.lineTo(5, -14.5); ctx.lineTo(8, -5.5); }); ctx.fill();
  // pectoral
  path(ctx, () => { ctx.moveTo(-1.5, 3.5); ctx.lineTo(-4.5, 9.5); ctx.lineTo(2.5, 5); }); ctx.fill();
  // gills + jaw
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 0.85; ctx.beginPath(); ctx.moveTo(5.5, -3.5); ctx.lineTo(4.5, 2.5); ctx.moveTo(7.5, -3.5); ctx.lineTo(6.5, 2.5); ctx.stroke();
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10.5, 1.5); ctx.lineTo(15, 1); ctx.stroke();
  eyeW(ctx, 8.5, -1.5, 1.15);
}

function plant(ctx, col) {
  // Improved: more menacing flytrap, better stem, more detailed teeth + lure, clearer leaf veins
  ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -2.5); ctx.stroke(); ctx.lineCap = 'butt';
  // leaves
  for (const s of [-1, 1]) {
    ctx.fillStyle = shade(col, -0.08);
    path(ctx, () => { ctx.moveTo(0, 4.5); ctx.quadraticCurveTo(s * 12.5, 3.5, s * 9.5, -3.5); ctx.quadraticCurveTo(s * 4, 0.5, 0, 4.5); }); ctx.fill(); line(ctx, OUTLINE, 0.85);
    ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, 3.5); ctx.lineTo(s * 8.5, -2.5); ctx.stroke();
  }
  // flytrap maw (more open and toothy)
  ctx.fillStyle = col; path(ctx, () => { ctx.moveTo(-7.5, -5.5); ctx.quadraticCurveTo(0, -17.5, 7.5, -5.5); ctx.quadraticCurveTo(0, -9.5, -7.5, -5.5); }); ctx.fill(); line(ctx, OUTLINE, 1.1);
  ctx.fillStyle = '#6a0f1c'; ellipse(ctx, 0, -7, 4.2, 2.8); ctx.fill();
  // upper teeth
  ctx.fillStyle = '#f4f0e8';
  for (const x of [-4.5, -2.2, 0, 2.2, 4.5]) { path(ctx, () => { ctx.moveTo(x, -9); ctx.lineTo(x + 0.85, -6.8); ctx.lineTo(x - 0.85, -6.8); }); ctx.fill(); }
  // lower teeth
  for (const x of [-3.5, -1.2, 1.2, 3.5]) { path(ctx, () => { ctx.moveTo(x, -5); ctx.lineTo(x + 0.85, -7); ctx.lineTo(x - 0.85, -7); }); ctx.fill(); }
  // lure bulb
  ctx.fillStyle = shade(col, 0.28); circle(ctx, -3.5, -9.5, 1.15); ctx.fill();
}

function drake(ctx, col) {
  // Improved: more dragon-like, better wing membrane with ribs, stronger dorsal spines, better snout/horn
  ctx.fillStyle = shade(col, -0.24);
  path(ctx, () => { ctx.moveTo(-2.5, -2.5); ctx.lineTo(-17.5, -11.5); ctx.lineTo(-13, -3.5); ctx.lineTo(-17.5, 0); ctx.lineTo(-12, 0.5); ctx.lineTo(-15.5, 3.5); ctx.lineTo(-4.5, 1.5); }); ctx.fill(); line(ctx, OUTLINE, 1.1);
  ctx.strokeStyle = shade(col, -0.42); ctx.lineWidth = 0.85; ctx.beginPath(); ctx.moveTo(-3.5, -1.5); ctx.lineTo(-15.5, -10); ctx.moveTo(-3.5, -1.5); ctx.lineTo(-14.5, -1.5); ctx.stroke();
  // spiked tail
  ctx.strokeStyle = col; ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6.5, 5.5); ctx.quadraticCurveTo(-18, 8.5, -13.5, -0.5); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = col; path(ctx, () => { ctx.moveTo(-13.5, 0.5); ctx.lineTo(-16.5, -3.5); ctx.lineTo(-11, -1.5); }); ctx.fill();
  // legs + body
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -6.5, 5, 4.2, 8, 2); ctx.fill(); rr(ctx, 1.8, 5, 4.2, 8, 2); ctx.fill();
  ellipse(ctx, 0, 0.5, 8.5, 7.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.26); ellipse(ctx, 0.5, 4, 4.4, 3.4); ctx.fill(); // pale belly
  ctx.fillStyle = shade(col, -0.2); ellipse(ctx, 0, 5.5, 4.8, 2); ctx.fill();
  ticks(ctx, col, [[-3, 2.5, 3, 2.5], [-3.2, 4, 3.2, 4], [-2.8, 5.5, 2.8, 5.5]], -0.12, 0.7); // belly scutes
  rimLight(ctx, 0, 0.5, 8.5, 7.5, col);
  speckle(ctx, col, [[-5, -1.5, 0.85], [-6, 2, 0.75], [5, -1, 0.8]], -0.24);
  // dorsal spines
  ctx.fillStyle = shade(col, -0.32); for (const x of [-4.5, -1, 2.5]) { path(ctx, () => { ctx.moveTo(x, -6.5); ctx.lineTo(x + 1.3, -10.5); ctx.lineTo(x + 2.6, -6.5); }); ctx.fill(); }
  // head + horn + snout
  circle(ctx, 8.5, -3.5, 4.8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.32); path(ctx, () => { ctx.moveTo(6.5, -7.5); ctx.lineTo(5.5, -13.5); ctx.lineTo(9.5, -8.5); }); ctx.fill();
  ctx.fillStyle = shade(col, 0.16); ellipse(ctx, 12.5, -2.5, 3.2, 2.2); ctx.fill();
  ctx.fillStyle = '#1a140d'; circle(ctx, 14, -2.8, 0.55); ctx.fill();
  fang(ctx, 12, -0.5, 0.95, 1.9, '#f4efe0');
  eyeW(ctx, 9.8, -4.5, 1.1, '#7a1010');
}

function wisp(ctx, col) {
  // Improved: a proper will-o-wisp — soft aura, a flickering flame tail, a glowing
  // body with a white-hot core, and a few orbiting motes for life.
  const g = ctx.createRadialGradient(0, -1, 1, 0, -1, 13.5);
  g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; circle(ctx, 0, -1, 13.5); ctx.fill();
  // trailing flame tail
  ctx.fillStyle = col;
  path(ctx, () => { ctx.moveTo(-3.2, 0); ctx.quadraticCurveTo(0, 11, 3.2, 0); ctx.quadraticCurveTo(0, 4.5, -3.2, 0); }); ctx.fill();
  // glowing body
  const g2 = ctx.createRadialGradient(-1.5, -3, 0.5, 0, -1.5, 6.8);
  g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.45, shade(col, 0.5)); g2.addColorStop(1, col);
  ctx.fillStyle = g2; circle(ctx, 0, -1.5, 6.8); ctx.fill();
  // white-hot core
  ctx.fillStyle = '#ffffff'; circle(ctx, -0.8, -2.2, 2.3); ctx.fill();
  // orbiting motes
  ctx.fillStyle = shade(col, 0.55);
  circle(ctx, 8.5, -5.5, 1.3); ctx.fill(); circle(ctx, -8, 1.5, 1); ctx.fill(); circle(ctx, 5.5, 6, 0.85); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(ctx, 8.2, -5.8, 0.5); ctx.fill();
}

function humanoid(ctx, col) {
  // Improved: better cloak flow and hood shape, more threatening dagger pose, clearer face glow
  ctx.fillStyle = shade(col, -0.42); rr(ctx, -5.5, 6, 4.2, 8, 2); ctx.fill(); rr(ctx, 0.8, 6, 4.2, 8, 2); ctx.fill();
  ctx.fillStyle = '#1a120c'; rr(ctx, -5.8, 11.8, 5.2, 2.5, 1); ctx.fill(); rr(ctx, 0.4, 11.8, 5.2, 2.5, 1); ctx.fill();
  // hooded cloak
  rr(ctx, -7.5, -5.5, 15, 13.5, 4); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.12); rr(ctx, -7.5, -5.5, 3.6, 13.5, 4); ctx.fill();
  ctx.fillStyle = shade(col, -0.28); rr(ctx, 4.2, -5.5, 2.8, 13.5, 3); ctx.fill();
  // cloak folds + belt clasp
  ctx.strokeStyle = shade(col, -0.36); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-2.5, -2.5); ctx.lineTo(-3.5, 7.5); ctx.moveTo(1.5, -2.5); ctx.lineTo(2.5, 7.5); ctx.stroke();
  ctx.fillStyle = '#caa15a'; rr(ctx, -2.2, 3.5, 4.4, 1.7, 0.7); ctx.fill(); ctx.fillStyle = '#fff3c0'; rr(ctx, -2, 3.7, 4, 0.6, 0.3); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -10.5, -3.5, 4.2, 9.5, 2); ctx.fill(); rr(ctx, 6, -3.5, 4.2, 9.5, 2); ctx.fill();
  ctx.fillStyle = '#d8a578'; circle(ctx, -8.5, 5.5, 2); ctx.fill(); circle(ctx, 8, 5.5, 2); ctx.fill();
  // hood
  circle(ctx, 0, -11.5, 6.3); fill(ctx, shade(col, -0.48)); line(ctx);
  ctx.fillStyle = col; path(ctx, () => { ctx.arc(0, -12.5, 6.6, Math.PI, Math.PI * 2); ctx.lineTo(6.6, -9.5); ctx.quadraticCurveTo(0, -13.5, -6.6, -9.5); }); ctx.fill();
  ctx.fillStyle = shade(col, -0.22); path(ctx, () => { ctx.moveTo(0, -18.5); ctx.lineTo(5, -10.5); ctx.lineTo(-5, -10.5); }); ctx.fill();
  // eyes in shadow
  ctx.fillStyle = '#ffe24a'; circle(ctx, -2.3, -11, 0.85); ctx.fill(); circle(ctx, 2.3, -11, 0.85); ctx.fill();
  // dagger (more dynamic angle)
  ctx.strokeStyle = '#e9edf2'; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(9.5, 8.5); ctx.lineTo(13.5, -6); ctx.stroke();
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.9; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(11.5, 5.5); ctx.stroke();
}

function hound(ctx, col) {
  // Improved: more dog-like (less generic beast), better ear flop, snout, bushy tail
  ctx.strokeStyle = shade(col, -0.12); ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9.5, 2.5); ctx.quadraticCurveTo(-17, -2.5, -12.5, -9); ctx.stroke(); ctx.lineCap = 'butt';
  // legs
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -7.5, 6, 3.7, 7.2, 1); ctx.fill(); rr(ctx, 2.8, 6, 3.7, 7.2, 1); ctx.fill();
  ctx.fillStyle = shade(col, -0.08); rr(ctx, -4.5, 6.8, 3.5, 6.2, 1); ctx.fill(); rr(ctx, 5.2, 6.8, 3.5, 6.2, 1); ctx.fill();
  // body
  ellipse(ctx, -1, 1.5, 10.5, 6.2); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.22); ellipse(ctx, -1, 4.5, 8.5, 2.8); ctx.fill(); // underbelly shadow
  ctx.fillStyle = shade(col, 0.12); ellipse(ctx, -2, -1.5, 6.5, 2.2); ctx.fill();
  rimLight(ctx, -1, 1.5, 10.5, 6.2, col);
  ticks(ctx, col, [[-8, -2, -6.5, 1], [-5, 5, -3.5, 7.5], [1.5, 5, 3, 7.5], [4.5, -1.5, 5.5, 1]], -0.2);
  speckle(ctx, col, [[-6, 2, 0.9], [-1, 3, 0.8]]);
  // leather collar
  ctx.strokeStyle = '#6a3f1e'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4.5, -4); ctx.quadraticCurveTo(6, 1, 4, 3.5); ctx.stroke();
  ctx.fillStyle = '#e6b34a'; circle(ctx, 4.8, 1.5, 0.9); ctx.fill();
  // head
  circle(ctx, 8.5, -2.5, 5.2); fill(ctx, col); line(ctx);
  // ear
  path(ctx, () => { ctx.moveTo(5.5, -6.5); ctx.lineTo(4.5, -12.5); ctx.lineTo(9, -7.5); }); fill(ctx, shade(col, -0.28));
  // snout
  path(ctx, () => { ctx.moveTo(12.5, -1.5); ctx.lineTo(16.5, 0.8); ctx.lineTo(12.5, 3); }); fill(ctx, shade(col, 0.18));
  ctx.fillStyle = '#1a140d'; circle(ctx, 16, 0.6, 0.6); ctx.fill();
  fang(ctx, 13.2, 2.8, 0.95, 1.7);
  eyeW(ctx, 9.8, -3.5, 1.05, '#3a1010');
}

function jellyfish(ctx, col) {
  // Improved: prettier bell curve, more elegant trailing tentacles, better internal highlight
  // soft bioluminescent glow
  const gg = ctx.createRadialGradient(0, -4, 1, 0, -4, 13);
  gg.addColorStop(0, 'rgba(255,255,255,0.18)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg; circle(ctx, 0, -4, 13); ctx.fill();
  ctx.globalAlpha = 0.82;
  path(ctx, () => { ctx.moveTo(-9.5, 1.5); ctx.quadraticCurveTo(-9.5, -10.5, 0, -10.5); ctx.quadraticCurveTo(9.5, -10.5, 9.5, 1.5); ctx.quadraticCurveTo(4, 4.5, 0, 1.5); ctx.quadraticCurveTo(-4, 4.5, -9.5, 1.5); }); fill(ctx, col); line(ctx);
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(col, 0.28); ellipse(ctx, -3, -5.5, 2.4, 3.3); ctx.fill();
  // tentacles
  ctx.strokeStyle = col; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  for (const x of [-6.5, -2, 2, 6.5]) { ctx.beginPath(); ctx.moveTo(x, 1.5); ctx.quadraticCurveTo(x + 2.2, 7.5, x - 1.2, 13); ctx.stroke(); }
  ctx.lineCap = 'butt';
}

function mantis(ctx, col) {
  // Improved: more recognizable praying mantis — better raptorial arms, triangular head, big eyes
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -4.5, 6, 3.2, 7.2, 1); ctx.fill(); rr(ctx, 0.8, 6, 3.2, 7.2, 1); ctx.fill();
  // folded wing case
  ctx.fillStyle = shade(col, -0.16); ellipse(ctx, -3, 1.5, 4, 6.5); ctx.fill();
  ellipse(ctx, -2, 0.5, 5.8, 7.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.22); ellipse(ctx, -3.5, -2, 2.4, 3.2); ctx.fill(); // sheen
  rimLight(ctx, -2, 0.5, 5.8, 7.5, col);
  ticks(ctx, col, [[-6.5, 1.5, 1.5, 1.5], [-6.5, 3.5, 1.5, 3.5], [-6, 5.5, 1, 5.5]], -0.2, 0.55); // wing veins
  // raptorial forelegs (more mantis-like)
  ctx.strokeStyle = shade(col, -0.12); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(2.5, -2); ctx.lineTo(9.5, -6.5); ctx.lineTo(7.5, -10.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2.5, 0.5); ctx.lineTo(10.5, -2.5); ctx.lineTo(9, -6.5); ctx.stroke(); ctx.lineCap = 'butt';
  // head (more triangular/insect)
  circle(ctx, 1.8, -9.5, 3.4); fill(ctx, col); line(ctx);
  ctx.fillStyle = '#1a140d'; circle(ctx, 0.4, -10.2, 0.95); ctx.fill(); circle(ctx, 3.2, -10.2, 0.95); ctx.fill();
}

function turtle(ctx, col) {
  // Improved: better domed shell with clearer scute pattern, nicer flippers, head proportion
  ctx.fillStyle = shade(col, -0.26); rr(ctx, -10.5, 6, 4.2, 4.2, 2); ctx.fill(); rr(ctx, 5.8, 6, 4.2, 4.2, 2); ctx.fill();
  path(ctx, () => { ctx.moveTo(-11.5, 0.8); ctx.lineTo(-15.5, 1.8); ctx.lineTo(-11.5, 3.8); }); ctx.fill();
  // head
  circle(ctx, 10.5, 0.5, 3.8); fill(ctx, shade(col, 0.2)); line(ctx);
  eyeW(ctx, 11.8, -0.2, 0.95, '#15110b');
  // shell
  ellipse(ctx, 0, 0.8, 11.5, 8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.15); ellipse(ctx, 0, -1.8, 4.8, 3.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ellipse(ctx, -3.5, -3.5, 2.6, 1.6); ctx.fill(); // gloss
  rimLight(ctx, 0, 0.8, 11.5, 8, col, 0.34);
  // scute lines (hex-like)
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -3.2); ctx.lineTo(5, -3.2);
  ctx.moveTo(-7, 1.8); ctx.lineTo(7, 1.8);
  ctx.moveTo(-5, 5.5); ctx.lineTo(5, 5.5);
  ctx.moveTo(-5, -3.2); ctx.lineTo(-7, 1.8); ctx.lineTo(-5, 5.5);
  ctx.moveTo(0, -3.2); ctx.lineTo(0, 5.5);
  ctx.moveTo(5, -3.2); ctx.lineTo(7, 1.8); ctx.lineTo(5, 5.5);
  ctx.stroke();
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
  // legs + shoes
  ctx.fillStyle = '#3a3326'; rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  ctx.fillStyle = '#231a10'; rr(ctx, -5.4, 12, 5, 2.6, 1.2); ctx.fill(); rr(ctx, 0.6, 12, 5, 2.6, 1.2); ctx.fill();
  // torso with edge shading
  rr(ctx, -7, -5, 14, 13, 4); fill(ctx, p.top); line(ctx);
  ctx.fillStyle = shade(p.top, 0.18); rr(ctx, -7, -5, 3.5, 13, 4); ctx.fill();  // lit edge
  ctx.fillStyle = shade(p.top, -0.22); rr(ctx, 4.5, -5, 2.5, 13, 3); ctx.fill(); // shaded edge
  // apron
  if (p.apron) { ctx.fillStyle = p.apron; rr(ctx, -5, -2, 10, 10, 2); ctx.fill(); ctx.fillStyle = shade(p.apron, -0.12); rr(ctx, -5, 6, 10, 2, 1); ctx.fill(); }
  // arms
  ctx.fillStyle = p.top; rr(ctx, -10, -3, 4, 9, 2); ctx.fill(); rr(ctx, 6, -3, 4, 9, 2); ctx.fill();
  ctx.fillStyle = p.skin; circle(ctx, -8, 6, 2); ctx.fill(); circle(ctx, 8, 6, 2); ctx.fill();
  // head
  circle(ctx, 0, -11, 6.5); fill(ctx, p.skin); line(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; circle(ctx, -2.3, -12.4, 1.9); ctx.fill(); // cheek light
  // hair
  if (p.hair) { ctx.fillStyle = p.hair; path(ctx, () => { ctx.arc(0, -12, 6.6, Math.PI, Math.PI * 2); }); ctx.fill(); }
  // hat
  if (p.hat) { ctx.fillStyle = p.hat; rr(ctx, -7, -16, 14, 4, 2); ctx.fill(); rr(ctx, -4, -21, 8, 6, 2); ctx.fill(); ctx.fillStyle = shade(p.hat, 0.2); rr(ctx, -7, -16, 14, 1.4, 1); ctx.fill(); }
  // eyes with catchlight
  circle(ctx, -2.2, -11, 0.9); fill(ctx, '#1a140d'); circle(ctx, 2.2, -11, 0.9); fill(ctx, '#1a140d');
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(ctx, -2, -11.3, 0.3); ctx.fill(); circle(ctx, 2.4, -11.3, 0.3); ctx.fill();
}

// ================= PLAYER =================
export function drawPlayer(ctx, cx, cy, opts = {}) {
  staged(ctx, cx, cy, opts, (c) => {
    const body = opts.hasBody ? '#b9c2cc' : '#5b8c4a';
    const bodyHi = opts.hasBody ? '#dbe2ea' : '#74a85e';
    const bodyDk = opts.hasBody ? '#8a96a2' : '#46702f';
    // cape (behind everything), sways with motion
    if (opts.hasCape) {
      const sw = Math.sin((opts.time || 0) * 0.012) * 1.4;
      c.fillStyle = '#8a2f44';
      path(c, () => { c.moveTo(-6, -4); c.lineTo(6, -4); c.lineTo(8 + sw, 13); c.lineTo(-8 + sw, 13); });
      c.fill();
      c.fillStyle = '#a83a52'; rr(c, -6, -5, 12, 3, 1); c.fill();
    }
    // legs + boots
    c.fillStyle = '#2f3a52'; rr(c, -5, 6, 4, 8, 2); c.fill(); rr(c, 1, 6, 4, 8, 2); c.fill();
    c.fillStyle = '#23150c'; rr(c, -5.5, 12, 5, 3, 1.5); c.fill(); rr(c, 0.5, 12, 5, 3, 1.5); c.fill();
    // torso (armour tint if body equipped) with edge shading
    rr(c, -7, -5, 14, 13, 4); fill(c, body); line(c);
    c.fillStyle = bodyHi; rr(c, -7, -5, 4, 13, 4); c.fill();          // left highlight
    c.fillStyle = bodyDk; rr(c, 4, -5, 3, 13, 3); c.fill();           // right shadow
    c.fillStyle = '#3a2a14'; rr(c, -7, 2, 14, 2.4, 1); c.fill();      // belt
    c.fillStyle = '#e6b34a'; rr(c, -1.4, 2, 2.8, 2.4, 0.6); c.fill();    // buckle
    // arms
    c.fillStyle = body; rr(c, -10, -3, 4, 9, 2); c.fill(); rr(c, 6, -3, 4, 9, 2); c.fill();
    c.fillStyle = '#e8b98a'; circle(c, -8, 6, 2); c.fill(); circle(c, 8, 6, 2); c.fill();
    // head + hair (+ helmet if worn)
    circle(c, 0, -11, 6.8); fill(c, '#e8b98a'); line(c);
    c.fillStyle = 'rgba(255,255,255,0.25)'; circle(c, -2.4, -12.5, 2); c.fill(); // cheek light
    if (opts.hasHelm) {
      c.fillStyle = '#9aa6b2'; path(c, () => { c.arc(0, -11, 7.2, Math.PI, 0); }); c.fill();
      c.fillStyle = '#cfd6dd'; rr(c, -7, -12, 14, 2.2, 1); c.fill();
    } else {
      c.fillStyle = '#46301c'; path(c, () => { c.arc(0, -12, 6.9, Math.PI, Math.PI * 2); }); c.fill();
    }
    circle(c, -2.3, -11, 0.9); fill(c, '#1a140d'); circle(c, 2.3, -11, 0.9); fill(c, '#1a140d');
    // weapon
    if (opts.hasWeapon) {
      c.strokeStyle = '#e9edf2'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(10, 11); c.lineTo(14, -9); c.stroke();
      c.strokeStyle = '#cfe0ff'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(10.6, 9); c.lineTo(13.6, -7); c.stroke(); // blade glint
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
    case 'craft': return craftTable(ctx, cx, cy);
    case 'bank': return bank(ctx, cx, cy);
    case 'shrine': return shrine(ctx, cx, cy, time);
    case 'rest': return hyco(ctx, cx, cy);
    case 'agility': return agilityCourse(ctx, cx, cy);
    case 'stall': return stall(ctx, obj.objId, obj.depleted, cx, cy);
    case 'transport': return mrtStation(ctx, cx, cy);
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
  // leaf-cluster dabs for texture
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  circle(ctx, cxx + r * 0.3, cyy - r * 0.1, r * 0.26); ctx.fill();
  circle(ctx, cxx - r * 0.1, cyy + r * 0.25, r * 0.22); ctx.fill();
  ctx.fillStyle = 'rgba(20,45,18,0.18)';
  circle(ctx, cxx + r * 0.4, cyy + r * 0.35, r * 0.22); ctx.fill();
  // warm sunlit highlight (upper-left)
  ctx.fillStyle = 'rgba(255,240,180,0.22)';
  circle(ctx, cxx - r * 0.38, cyy - r * 0.5, r * 0.38); ctx.fill();
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
  // shaded lower-right facet for 3D form
  ctx.fillStyle = 'rgba(20,20,26,0.22)';
  path(ctx, () => { ctx.moveTo(cx + 2, cy - 4); ctx.lineTo(cx + 12, cy + 2); ctx.lineTo(cx + 8, cy + 10); ctx.lineTo(cx - 1, cy + 9); }); ctx.fill();
  // top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
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

function craftTable(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 14, 4.5);
  // workbench top + legs
  ctx.fillStyle = '#7a5230'; rr(ctx, cx - 12, cy - 2, 24, 6, 2); ctx.fill(); line(ctx, OUTLINE, 1.4);
  ctx.fillStyle = '#5a3a1c'; rr(ctx, cx - 10, cy + 4, 3, 9, 1); ctx.fill(); rr(ctx, cx + 7, cy + 4, 3, 9, 1); ctx.fill();
  line(ctx, OUTLINE, 1.2);
  // tools/wares on the bench
  ctx.fillStyle = '#c9603a'; rr(ctx, cx - 9, cy - 7, 5, 5, 1); ctx.fill(); line(ctx, OUTLINE, 1); // little pot
  ctx.fillStyle = '#e6b34a'; circle(ctx, cx + 2, cy - 4, 2.4); ctx.fill(); line(ctx, OUTLINE, 1);  // gold
  ctx.fillStyle = '#7aa6ff'; circle(ctx, cx + 7, cy - 4, 1.8); ctx.fill(); line(ctx, OUTLINE, 0.9); // gem
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

// Thieving market stall: striped awning on posts over a goods counter.
// Awning colour signals the stall type; goods disappear briefly when depleted.
function stall(ctx, objId, depleted, cx, cy) {
  drawShadow(ctx, cx, cy + 12, 15, 5);
  // posts
  ctx.fillStyle = '#6b4524';
  rr(ctx, cx - 13, cy - 14, 3, 26, 1); ctx.fill();
  rr(ctx, cx + 10, cy - 14, 3, 26, 1); ctx.fill();
  line(ctx, 'rgba(30,18,8,0.5)', 1);
  // counter
  ctx.fillStyle = '#7a5230'; rr(ctx, cx - 14, cy + 2, 28, 12, 2); ctx.fill(); line(ctx, 'rgba(30,18,8,0.5)', 2);
  ctx.fillStyle = '#8a6038'; rr(ctx, cx - 14, cy, 28, 4, 2); ctx.fill();
  // striped awning, coloured per stall type
  const cols = { stall_food: '#d8566f', stall_market: '#2f7bbf', stall_gem: '#7a4a9a' };
  const a = cols[objId] || '#d8566f';
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? a : '#f0e7d4'; rr(ctx, cx - 15 + i * 5, cy - 16, 5, 7, 0); ctx.fill(); }
  line(ctx, 'rgba(30,18,8,0.5)', 1);
  // scalloped hem
  ctx.fillStyle = a;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(cx - 12.5 + i * 5, cy - 9, 2.5, 0, Math.PI); ctx.fill(); }
  // goods on the counter (hidden while restocking)
  if (!depleted) {
    ctx.fillStyle = objId === 'stall_gem' ? '#9adcff' : '#ffd773';
    circle(ctx, cx - 6, cy + 3, 2); ctx.fill();
    circle(ctx, cx, cy + 3, 2); ctx.fill();
    circle(ctx, cx + 6, cy + 3, 2); ctx.fill();
  }
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

// MRT station: a sleek train cab beside a red station pylon.
function mrtStation(ctx, cx, cy) {
  drawShadow(ctx, cx, cy + 13, 15, 5);
  // platform
  ctx.fillStyle = '#9a948a'; rr(ctx, cx - 15, cy + 8, 30, 5, 2); ctx.fill(); line(ctx, 'rgba(40,36,30,0.5)', 1.2);
  // train body
  ctx.fillStyle = '#e8eef2'; rr(ctx, cx - 13, cy - 8, 20, 17, 4); ctx.fill(); line(ctx, OUTLINE, 1.3);
  ctx.fillStyle = '#c0392b'; rr(ctx, cx - 13, cy - 8, 20, 4, 4); ctx.fill();            // red stripe (roof)
  ctx.fillStyle = '#2f6f9e'; rr(ctx, cx - 10, cy - 3, 14, 6, 1.5); ctx.fill();          // windscreen
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(ctx, cx - 9, cy - 2.5, 5, 5, 1); ctx.fill();
  ctx.fillStyle = '#3a3530'; circle(ctx, cx - 8, cy + 9, 2); ctx.fill(); circle(ctx, cx + 2, cy + 9, 2); ctx.fill();
  // station pylon with "M"
  ctx.fillStyle = '#3a3530'; rr(ctx, cx + 10, cy - 14, 2.4, 24, 1); ctx.fill();
  ctx.fillStyle = '#c0392b'; rr(ctx, cx + 6, cy - 16, 11, 8, 2); ctx.fill(); line(ctx, OUTLINE, 1.1);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('M', cx + 11.5, cy - 11.5);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
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

