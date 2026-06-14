// Vector sprite library — cohesive hand-drawn art for creatures and world objects,
// replacing the old emoji rendering. Everything is drawn relative to a centre
// point (cx, cy) with the entity's "feet" near cy + 13.

const OUTLINE = 'rgba(26,18,12,0.55)';

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
  ctx.save();
  ctx.translate(cx, cy + bob);
  if (opts.facing && opts.facing.dx < 0) ctx.scale(-1, 1);
  draw(ctx);
  ctx.restore();
}

// ---------------- Ground shadow ----------------
export function drawShadow(ctx, cx, cy, rx = 11, ry = 5) {
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fill();
}

// ================= CREATURES =================
export function drawCreature(ctx, npcId, cx, cy, opts = {}) {
  switch (npcId) {
    case 'chicken': return staged(ctx, cx, cy, opts, (c) => chicken(c));
    case 'rat': return staged(ctx, cx, cy, opts, (c) => rat(c));
    case 'goblin': return staged(ctx, cx, cy, opts, (c) => goblin(c));
    case 'macaque': return staged(ctx, cx, cy, opts, (c) => macaque(c));
    case 'monitor_lizard': return staged(ctx, cx, cy, opts, (c) => lizard(c));
    case 'guard': return staged(ctx, cx, cy, opts, (c) => guard(c));
    case 'banker': return staged(ctx, cx, cy, opts, (c) => human(c, { top: '#2f4b8a', skin: '#e8b98a', hair: '#3a2a18', hat: null, apron: '#d8c089' }));
    case 'shopkeeper': return staged(ctx, cx, cy, opts, (c) => human(c, { top: '#7a3b1d', skin: '#e0aa78', hair: '#272015', apron: '#cdbfa0' }));
    case 'hawker': return staged(ctx, cx, cy, opts, (c) => human(c, { top: '#b23b2e', skin: '#e8b98a', hair: '#2a2018', hat: '#f0ead8', apron: '#f0ead8' }));
    case 'guide': return staged(ctx, cx, cy, opts, (c) => human(c, { top: '#3d6b3a', skin: '#e6b886', hair: '#cfc4b0', hat: '#6b4a2a' }));
    case 'villager': return staged(ctx, cx, cy, opts, (c) => human(c, { top: '#6a5aa0', skin: '#e8b98a', hair: '#4a3320' }));
    default: return staged(ctx, cx, cy, opts, (c) => human(c, { top: '#6a5aa0', skin: '#e8b98a', hair: '#4a3320' }));
  }
}

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
export function drawGroundItem(ctx, icon, cx, cy) {
  // soft pickup disc + emoji icon (matches inventory's item language)
  glow(ctx, cx, cy, 11, 'rgba(255,240,180,0.18)');
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ellipse(ctx, cx, cy + 6, 8, 3); ctx.fill();
  ctx.font = '17px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icon, cx, cy); ctx.textBaseline = 'alphabetic';
}
