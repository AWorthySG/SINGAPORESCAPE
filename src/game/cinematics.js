import { TILE } from '../config.js';
import { smoothDamp } from '../engine/camera.js';

// Camera direction and one-off moments that make the world feel alive: the
// camera leads a little in the direction you walk and pushes in during fights,
// a boss's first engagement plays a short entrance (camera eases toward it,
// name banner, a roar), a boss's death slows time for a beat, and entering a
// region shows its name as a title card. Nothing here pauses the game or holds
// up input, and none of it is saved: it is all per session and cosmetic.

export const BOSS_INTRO_MS = 1200;     // the whole entrance, then control as normal
export const BOSS_ROAR_AT = 380;       // ms into the entrance the boss roars (shake + sound)
export const TITLE_CARD_MS = 2800;     // a region's name fades in, holds, fades out
export const TITLE_REPEAT_MS = 90000;  // the same region's card again only after this
export const TITLE_GAP_MS = 8000;      // and never two cards this close (border hopping)
export const LEAD_MAX = 26;            // how far ahead (world px) the camera leads
export const LEAD_MS = 330;            // lead = walking velocity x this
export const FIGHT_ZOOM = 1.06;        // gentle push-in while fighting
export const INTRO_ZOOM = 1.1;         // and a touch more for a boss entrance
export const FIGHT_ZOOM_HOLD = 1500;   // ms after the last fight before easing back out
export const DEATH_SLOWMO_MS = 700;    // a boss death: time runs slow, easing back to normal
export const DEATH_FLASH_MS = 240;     // ...under a quick white flash

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** How far the camera moves toward the boss (0..1) and the intro's banner
 *  visibility (0..1), at `t` ms into a boss entrance. Eases in, holds, eases out. */
export function introCurve(t) {
  if (t < 0 || t >= BOSS_INTRO_MS) return { pan: 0, banner: 0 };
  const pan = t < 300 ? ease(t / 300) : t < BOSS_INTRO_MS - 320 ? 1 : ease((BOSS_INTRO_MS - t) / 320);
  const banner = t < 250 ? ease(t / 250) : t < BOSS_INTRO_MS - 260 ? 1 : ease((BOSS_INTRO_MS - t) / 260);
  return { pan, banner };
}

/** A title card's opacity at `t` ms after it began: fades in, holds, fades out. */
export function titleAlpha(t) {
  if (t < 0 || t >= TITLE_CARD_MS) return 0;
  if (t < 500) return ease(t / 500);
  if (t > TITLE_CARD_MS - 700) return ease((TITLE_CARD_MS - t) / 700);
  return 1;
}

export class Cinematics {
  constructor() {
    this.now = 0;                 // ms of play this session (the clock for everything here)
    this.seenBosses = new Set();  // npcIds whose entrance already played this session
    this.intro = null;            // { npc, t, name, level, roared }
    this.title = null;            // { name, sub, t }
    this._titleAt = -Infinity;
    this._titleLast = new Map();  // region -> when its card last showed
    this.flash = 0;               // ms of boss-death flash left
    this.slowMo = 0;              // ms of boss-death slow motion left
    this.inFight = false;         // worked out once a tick
    this._fightUntil = 0;
    this.zoomK = 1;
    this._zoomSt = { v: 0 };
    this.lead = { x: 0, y: 0 };
    this._leadSt = { x: { v: 0 }, y: { v: 0 } };
    this._last = null;            // the player's previous render centre (for velocity)
    this.focus = { x: 0, y: 0 };  // the point the camera follows this frame (reused)
  }

  /** Start a boss's entrance if this is the first time it has engaged you this
   *  session. World Bosses already arrive with their own banner, so they skip it. */
  bossEngaged(npc) {
    if (!npc || !npc.def || !npc.def.boss || npc.worldBoss || npc.def.worldBoss) return false;
    if (this.seenBosses.has(npc.npcId) || this.intro) return false;
    this.seenBosses.add(npc.npcId);
    this.intro = { npc, t: 0, name: npc.name, level: npc.def.level || 1, roared: false };
    return true;
  }

  /** Show a region's title card, unless one showed moments ago (walking along
   *  a border) or this region's did recently. The Wilderness keeps its own banner. */
  enterRegion(name, opts = {}) {
    if (!name || name === 'Singapore' || opts.wild) return false;
    if (this.now - this._titleAt < TITLE_GAP_MS) return false;
    const last = this._titleLast.get(name);
    if (last !== undefined && this.now - last < TITLE_REPEAT_MS) return false;
    this._titleAt = this.now;
    this._titleLast.set(name, this.now);
    this.title = { name, sub: opts.sub || '', t: 0 };
    return true;
  }

  /** A boss falls: a short slow-motion and a white flash on top of the hit-stop. */
  bossDown(game) {
    game.hitStop = Math.max(game.hitStop, 240);
    this.slowMo = DEATH_SLOWMO_MS;
    this.flash = DEATH_FLASH_MS;
  }

  /** Multiplier for animation time this frame: slow while a boss's death plays out. */
  timeScale() {
    if (this.slowMo <= 0) return 1;
    return 0.35 + 0.65 * ease(1 - this.slowMo / DEATH_SLOWMO_MS);
  }

  /** Once a tick: are we fighting, and has a boss just engaged us? Uses the same
   *  test as the boss bar (within 16 tiles, fighting us or being fought). */
  tick(game) {
    const p = game.player;
    let fighting = !!(p.alive && p.target && p.target.alive);
    for (const n of game.nearbyNpcs()) {
      if (!n.alive) continue;
      const on = n.target === p || p.target === n || n.combatLatch > 0;
      if (n.target === p) fighting = true;
      if (on && n.def.boss && p.alive && Math.abs(n.x - p.x) <= 16 && Math.abs(n.y - p.y) <= 16) this.bossEngaged(n);
    }
    this.inFight = fighting;
    if (fighting) this._fightUntil = this.now + FIGHT_ZOOM_HOLD;
  }

  /** Per frame: advance the timers and return the point the camera should
   *  follow (the player, plus the walking lead, pulled toward a boss during its
   *  entrance), setting the camera's push-in on the way. */
  update(game, dt) {
    this.now += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.slowMo > 0) this.slowMo = Math.max(0, this.slowMo - dt);
    if (this.title && (this.title.t += dt) >= TITLE_CARD_MS) this.title = null;
    const c = game.player.renderCenter();
    // Lead: where you're heading, from how fast your sprite moved this frame. A
    // jump (teleport, respawn) is not walking, so it resets instead.
    let vx = 0, vy = 0;
    if (this._last && dt > 0) {
      const dx = c.x - this._last.x, dy = c.y - this._last.y;
      if (Math.abs(dx) < TILE * 2 && Math.abs(dy) < TILE * 2) { vx = dx / dt; vy = dy / dt; }
      else { this.lead.x = this.lead.y = 0; this._leadSt.x.v = this._leadSt.y.v = 0; }
    }
    this._last = this._last || { x: 0, y: 0 };
    this._last.x = c.x; this._last.y = c.y;
    // Reduce motion: the camera stays on you (no lead ahead, no push-in).
    const calm = !!game.reduceMotion;
    let tx = calm ? 0 : vx * LEAD_MS, ty = calm ? 0 : vy * LEAD_MS;
    const len = Math.hypot(tx, ty);
    if (len > LEAD_MAX) { tx = tx / len * LEAD_MAX; ty = ty / len * LEAD_MAX; }
    this.lead.x = smoothDamp(this.lead.x, tx, this._leadSt.x, 420, dt);
    this.lead.y = smoothDamp(this.lead.y, ty, this._leadSt.y, 420, dt);
    let fx = c.x + this.lead.x, fy = c.y + this.lead.y;
    let zoom = !calm && (this.inFight || this.now < this._fightUntil) ? FIGHT_ZOOM : 1;
    const it = this.intro;
    if (it) {
      it.t += dt;
      if (!it.roared && it.t >= BOSS_ROAR_AT) {
        it.roared = true;
        game.addShake(4, 380);
        game.bus.emit('sfx', 'roar');
      }
      if (it.t >= BOSS_INTRO_MS || !it.npc.alive) this.intro = null;
      else {
        const { pan } = introCurve(it.t);
        const b = it.npc.renderCenter();
        // Halfway to the boss keeps you in shot while it takes the stage.
        fx += (b.x - fx) * 0.5 * pan; fy += (b.y - fy) * 0.5 * pan;
        if (!calm) zoom = Math.max(zoom, 1 + (INTRO_ZOOM - 1) * pan);
      }
    }
    this.zoomK = smoothDamp(this.zoomK, zoom, this._zoomSt, zoom > this.zoomK ? 450 : 900, dt);
    if (Math.abs(this.zoomK - zoom) < 0.0005 && Math.abs(this._zoomSt.v) < 1e-6) this.zoomK = zoom;
    game.camera.setZoomMul(this.zoomK);
    this.focus.x = fx; this.focus.y = fy;
    return this.focus;
  }
}

