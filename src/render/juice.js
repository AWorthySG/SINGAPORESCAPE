import { blowAt, impactKind, lowOf, juicePop, columnImage } from './combatfx.js';

// "Juice": the small touches that make a hit, a kill or a level feel good.
//  - a screen shake on big hits and crits, scaled by the hit and capped, with
//    an on/off setting (Settings > Accessibility) and the system's reduced-motion
//    preference respected;
//  - a hit-stop on the struck sprite alone (it all but freezes for a beat; the
//    rest of the world, and every game tick, carries on), with a squash and
//    stretch and a wobble as it's knocked back;
//  - bouncier damage numbers that pop in, hop sideways in an arc and fade, a
//    star-burst behind crits and a soft "miss" puff;
//  - an ability's swoosh and an ultimate's flourish over the target;
//  - rarity glows and beams on loot, coin glints, and the level-up and kill
//    celebrations (the pieces themselves live in the pooled CombatFx).
// The game calls the hooks at the bottom with one line each; the renderer
// calls the drawing helpers. Nothing here allocates per frame.

// ---------------- Motion preferences ----------------
let _mq;   // the media query, looked up once
/** True when the browser asks for less motion (prefers-reduced-motion). */
export function prefersReducedMotion() {
  try {
    if (_mq === undefined) _mq = globalThis.matchMedia ? globalThis.matchMedia('(prefers-reduced-motion: reduce)') : null;
    return !!_mq?.matches;
  } catch { return false; }
}
/** Hit-stops, squashes and wobbles: off under Reduce motion (the setting or the browser's). */
export const motionOK = (game) => !game.reduceMotion && !prefersReducedMotion();
/** Screen shake has its own switch as well (Settings > Accessibility > Screen shake). */
export const shakeAllowed = (game) => game.screenShake !== false && motionOK(game);

// ---------------- Screen shake ----------------
export const SHAKE_CAP = 4.5;    // px: the strongest shake any one hit can give
export const SHAKE_MIN = 0.8;    // below this a hit doesn't shake at all

/** How hard a hit shakes the screen: `{ mag, ms }`, or null for a hit too
 *  small to bother. It grows with the hit's share of the target's life, a crit
 *  adds a thump (a x4 "mega" crit more), and it never passes SHAKE_CAP.
 *  Splash and area hits never shake (a cleave would rattle on and on). */
export function shakeFor(dmg, maxHp, o = {}) {
  if (!(dmg > 0) || o.aoe) return null;
  const share = Math.min(1, dmg / Math.max(1, maxHp || 1));
  let mag = share * 5 + (o.crit ? 1.3 : o.fancy ? 0.5 : 0) + (o.mega ? 1 : 0);
  if (mag < SHAKE_MIN) return null;
  mag = Math.min(SHAKE_CAP, mag);
  return { mag, ms: Math.round(110 + mag * 28) };
}

// ---------------- Hit-stop on the struck sprite ----------------
export const HIT_STOP_SLOW = 0.12;   // the struck sprite's animation runs at this speed during its stop
export const HIT_STOP_CAP = 110;     // ms: the longest stop a hit can give (a kill's is set apart)

/** How long a hit freezes its target (ms): a beat for a crit, a touch longer
 *  for a big share of its life, capped. 0 for an ordinary small hit. */
export function hitStopFor(share, crit) {
  if (!crit && share < 0.2) return 0;
  return Math.min(HIT_STOP_CAP, Math.round((crit ? 45 : 25) + share * 90));
}
/** Freeze one sprite for `ms`, starting `lead` ms from `now` (when the blow lands). */
export function stopSprite(n, ms, now, lead = 0) {
  if (!(ms > 0)) return;
  const from = now + lead;
  if (n.stopUntil > from && n.stopFrom <= from) { n.stopUntil = Math.max(n.stopUntil, from + ms); return; }
  n.stopFrom = from; n.stopUntil = from + ms;
}
/** The animation step for one sprite this frame: slowed while it is in its hit-stop. */
export function spriteDt(n, dt, now) {
  return n.stopUntil > now && now >= n.stopFrom ? dt * HIT_STOP_SLOW : dt;
}

// ---------------- Squash, stretch and wobble ----------------
// Driven by the struck sprite's hit flash (`hurt`, 200ms counting down, held
// back to the strike like the flash), so the squash always lands with the blow.
const HURT_MS = 200;
/** The squash a struck sprite shows `hurt` ms before its flash ends: scale x/y
 *  and a lean (radians), from its strength `k` (0..1) and knock direction `dir`. */
export function squashFor(hurt, k, dir, out = {}) {
  out.sx = 1; out.sy = 1; out.rot = 0;
  if (!(hurt > 0) || !(k > 0)) return out;
  const age = HURT_MS - Math.min(HURT_MS, hurt);
  // A damped spring: squashed wide and short on impact, stretching tall on the
  // rebound, settling by the time the flash fades.
  const s = k * Math.exp(-age / 75) * Math.cos(age * 0.042);
  out.sx = 1 + s * 0.2; out.sy = 1 - s * 0.2;
  out.rot = (dir || 1) * k * 0.14 * Math.exp(-age / 90) * Math.sin(age * 0.05 + 0.6);
  return out;
}
const _sq = {};
/** Apply a struck monster's squash about its feet. Returns true when it
 *  pushed a canvas state (the caller restores after drawing the sprite). */
export function applySquash(ctx, n, hurt, x, feetY) {
  if (!(hurt > 0) || !(n.squashK > 0)) return false;
  const q = squashFor(hurt, n.squashK, n.squashDir, _sq);
  ctx.save();
  ctx.translate(x, feetY); ctx.rotate(q.rot); ctx.scale(q.sx, q.sy); ctx.translate(-x, -feetY);
  return true;
}

// ---------------- Damage numbers ----------------
/** Where a damage number is `age` ms after it appeared: an offset (`dx`,
 *  `dy`, px), a pop-in `scale`, an `alpha` and a slight tilt (`rot`). It
 *  springs in, hops sideways in an arc (away from its neighbours) and rises
 *  as it fades. Crits pop bigger and tilt. */
export function splatMotion(e, age, out = {}) {
  const crit = e.critX > 0, miss = !(e.dmg > 0) && !e.text;
  const dir = e.fan > 0 ? 1 : e.fan < 0 ? -1 : (e.row ? -1 : 1);
  out.dx = dir * (crit ? 6 : 9) * (1 - Math.exp(-age / 260));
  const hop = age < 280 ? Math.sin((age / 280) * Math.PI) * (crit ? 9 : 6) : 0;
  out.dy = -hop - age * (miss ? 0.018 : 0.028);
  out.scale = juicePop(age, crit ? (e.critX >= 4 ? 0.6 : 0.45) : miss ? 0.15 : 0.28);
  out.alpha = Math.max(0, Math.min(1, e.life / 300));
  out.rot = crit ? -0.14 * dir * Math.exp(-age / 220) : 0;
  return out;
}

const INK = '#22304A';
/** The spiky sticker star-burst behind a crit's number (white border, navy ink). */
export function drawCritBurst(ctx, r, rot, mega) {
  const n = 12;
  ctx.save(); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.7 : r;
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(rr, 0);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.fillStyle = mega ? '#ffb13d' : '#ffd24a'; ctx.fill();
  ctx.restore();
}
/** A soft white cloud with "miss" on it, for a blow that didn't land. */
export function drawMissPuff(ctx, age) {
  const g = 1 + Math.min(0.25, age / 2400);
  ctx.save(); ctx.scale(g, g);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(34,48,74,0.55)'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(-7, 1.5, 5.5, 0, 6.2832); ctx.moveTo(7.5 + 5.5, 1.5); ctx.arc(7.5, 1.5, 5.5, 0, 6.2832);
  ctx.moveTo(7, -1.5); ctx.arc(0, -1.5, 7, 0, 6.2832);
  ctx.stroke(); ctx.fill();
  ctx.fillStyle = '#5a6f92'; ctx.font = '800 8.5px Nunito,"Trebuchet MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('miss', 0, 0.5);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ---------------- Loot ----------------
/** How each rarity of drop glows on the ground: its colour, the soft glow's
 *  size, how tall a beam of light it stands in (0: none) and whether it
 *  sparkles. Common drops have none. Unknown rarities count as common. */
export const RARITY_GLOW = {
  common: null,
  uncommon: { col: '#5FD07A', glow: 9, beam: 0, sparkle: false },
  rare: { col: '#5FAEE3', glow: 10, beam: 20, sparkle: false },
  epic: { col: '#A66CFF', glow: 11, beam: 44, sparkle: false },
  legendary: { col: '#F5B82E', glow: 13, beam: 62, sparkle: true },
};
export const lootGlow = (rarity) => RARITY_GLOW[rarity] || null;

/** A drop's glow, beam and base ring, `ms` after it fell (the beam rises once
 *  it has landed). Low graphics keeps the glow and ring and skips the beam's halo. */
export function drawLootGlow(ctx, rarity, cx, cy, ms, timeMs, low) {
  const L = lootGlow(rarity);
  if (!L) return;
  ctx.save();
  if (L.beam) {
    const grow = Math.min(1, Math.max(0, ms - 300) / 260);
    const bh = L.beam * grow, bw = 4 + L.beam / 12;
    const img = bh > 1 ? columnImage(L.col) : null;
    if (img) {
      if (!low) { ctx.globalAlpha = 0.5 + Math.sin(timeMs * 0.006) * 0.12; ctx.drawImage(img, cx - bw * 2.4, cy - bh * 1.15, bw * 4.8, bh * 1.15 + 4); }
      ctx.globalAlpha = 0.85 + Math.sin(timeMs * 0.012) * 0.12;
      ctx.drawImage(img, cx - bw / 2, cy - bh, bw, bh + 2);
    }
  }
  // A ring pulsing out from its base.
  const ring = (timeMs % 900) / 900;
  ctx.globalAlpha = 1 - ring;
  ctx.strokeStyle = L.col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy + 3, 6 + ring * 9, 3 + ring * 4.5, 0, 0, 6.2832); ctx.stroke();
  // The soft glow underneath.
  ctx.globalAlpha = 0.32 + Math.sin(timeMs * 0.005 + cx * 0.1) * 0.06;
  ctx.fillStyle = L.col;
  ctx.beginPath(); ctx.arc(cx, cy, L.glow, 0, 6.2832); ctx.fill();
  if (L.sparkle) {
    // Legendary: two glints circling the drop.
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.fillStyle = '#fff6c8';
    for (let i = 0; i < 2; i++) {
      const a = timeMs * 0.003 + i * Math.PI, r = 2.4 * (0.6 + 0.4 * Math.sin(timeMs * 0.01 + i * 2));
      glint(ctx, cx + Math.cos(a) * 12, cy - 6 + Math.sin(a) * 5, r);
    }
  }
  ctx.restore();
}

/** Gold coins on the ground catch the light now and then: a quick glint. */
export function drawCoinGlint(ctx, cx, cy, timeMs, seed = 0) {
  const ph = (timeMs + seed * 397) % 1500;
  if (ph > 320) return;
  const r = 2.8 * Math.sin((ph / 320) * Math.PI);
  if (r < 0.3) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff6c8';
  glint(ctx, cx + 4 - (seed % 3) * 3, cy - 4, r);
  ctx.restore();
}
function glint(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r * 0.45, y - r * 0.45); ctx.lineTo(x + r * 2, y); ctx.lineTo(x + r * 0.45, y + r * 0.45);
  ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r * 0.45, y + r * 0.45); ctx.lineTo(x - r * 2, y); ctx.lineTo(x - r * 0.45, y - r * 0.45);
  ctx.closePath(); ctx.fill();
}

// ---------------- Hooks the game calls ----------------

/** How long until the player's blow lands on `npc` (ms): a shot's flight, or
 *  about half the swing for a melee blow (the game deals it as the swing starts). */
function leadFor(game, npc) {
  const kind = impactKind(game.weaponType?.(), game.combatMode?.());
  const b = blowAt(game, npc, kind);
  return { b, lead: b.melee ? (game.player.swingDur || 240) * 0.5 : b.delay };
}

/** Note the ability (if any) the player's next blows unleash (from _offensiveMods). */
export function noteAbility(game, ab) {
  game._abHit = ab ? { tier: ab.tier, name: ab.name, used: false } : null;
}

/** A hitsplat landed (from addHitsplat): shake, the struck sprite's hit-stop
 *  and squash, and an ability's swoosh or an ultimate's flourish. */
export function juiceHit(game, entity, dmg, opts = {}) {
  if (!entity || !(dmg > 0) || opts.text) return;
  const maxHp = entity === game.player ? game.maxHp?.() : entity.maxHp;
  const share = Math.min(1, dmg / Math.max(1, maxHp || 1));
  const crit = opts.critX > 0;
  const sh = shakeFor(dmg, maxHp, { crit, mega: opts.critX >= 4, fancy: opts.crit, aoe: opts.aoe });
  if (sh && (entity !== game.player || share >= 0.15)) game.addShake(sh.mag, sh.ms);
  if (entity === game.player || !entity.renderCenter) return;
  const fresh = game._abHit && !game._abHit.used && !opts.aoe ? game._abHit : null;
  if (!motionOK(game)) { if (fresh) fresh.used = true; return; }
  // The struck sprite's squash and wobble (strength by the size of the hit).
  entity.squashK = Math.min(1, (opts.aoe ? 0.25 : 0.4) + share * 1.6 + (crit ? 0.3 : 0));
  entity.squashDir = entity.knockDX < 0 ? -1 : 1;
  const { b, lead } = leadFor(game, entity);
  stopSprite(entity, opts.aoe ? 0 : hitStopFor(share, crit || opts.crit), game.playMs || 0, lead);
  if (fresh) {
    fresh.used = true;
    abilityFlourish(game, b, fresh);
  }
}

/** An ability's swoosh (sticker crescents and a ring in gold), or an
 *  ultimate's flourish (rings, rays, stars and its name). */
function abilityFlourish(game, b, ab) {
  const fx = game.cfx;
  if (!fx) return;
  fx.low = lowOf(game);
  fx._begin();
  if (ab.tier === 'ultimate') {
    const col = '#ff7ad9';
    if (!fx.low) fx.glow(b.x, b.y, 40, 520, col);
    fx.ring(b.x, b.y, 6, 46, 520, '#ffffff', 5);
    fx.ring(b.x, b.y, 6, 34, 460, col, 3).delay = 90;
    fx.burstOf('ray', b.x, b.y, 10, { life: 560, col: '#ffe3f6', size: 50 });
    fx.burstOf('star', b.x, b.y, 7, { speed: 0.14, life: 640, col: '#ffd24a', up: -0.05, g: 0.0002, spin: 0.02, size: 7 });
    fx.burstOf('arc', b.x, b.y, 2, { life: 320, col, size: 22 });
    if (ab.name) fx.label(b.x, b.y - 38, `${ab.name}!`, '#C2185B', 1200, 1.1);
  } else {
    fx.burstOf('arc', b.x, b.y, 2, { life: 260, col: '#ffd24a', size: 19 });
    fx.ring(b.x, b.y, 4, 26, 260, '#fff3b0', 3);
    fx.burstOf('spark', b.x, b.y, 6, { speed: 0.2, life: 220, col: '#ffe89a', add: true, size: 1.6 });
  }
  fx._end(b.melee ? 0 : b.delay, b.melee);
  if (ab.tier === 'ultimate') game.addShake(3.5, 260);
}

/** A monster fell (in place of the old whole-world hit-stop): it alone
 *  freezes for a beat (longer for champions and bosses) before it keels over. */
export function juiceKill(game, npc) {
  if (!motionOK(game)) return;
  stopSprite(npc, npc.def?.boss ? 180 : npc.champion ? 120 : 75, game.playMs || 0);
}

/** A level-up: stars round the hero, confetti and a "<Skill> <level>!" sticker. */
export function juiceLevel(game, p, big) {
  const fx = game.cfx;
  if (!fx || !game.player?.renderCenter) return;
  fx.low = lowOf(game);
  const c = game.player.renderCenter();
  const name = p?.skill ? String(p.skill).replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase()) : 'Level';
  fx.levelPop(c.x, c.y - 10, p?.level ? `${name} ${p.level}!` : 'Level up!', big);
}
