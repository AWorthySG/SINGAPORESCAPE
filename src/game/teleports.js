// Teleports anyone can use from the start: back to Kampong Glam (the "Town"
// button, K) and to your gravestone after a death (the "Grave" button, R).
//
// Both are short casts rather than instant hops: you stand still for
// CAST_TICKS while a ring of sparkles gathers, and walking off, taking a hit
// or dying breaks the cast. Neither can be started mid-fight (a monster after
// you, or a hit in the last COMBAT_LOCK_TICKS), so they are a way home, not an
// escape button. The town teleport then recharges for TOWN_COOLDOWN_TICKS. The
// grave teleport has no recharge of its own (there is only ever one
// gravestone), and lands you beside the stone, which hands your things back
// straight away (playbalance.js).
//
// Kept out of game.js: the game creates this and the bus 'tick' drives it, so
// it runs the same headless as on screen. Nothing here is saved: a cast in
// progress is simply dropped on reload, and the recharge starts afresh.

import { teleportPlayer } from './skillunlocks.js';

export const CAST_TICKS = 5;                 // 3 seconds standing still
export const TOWN_COOLDOWN_TICKS = 250;      // the town teleport recharges in 2.5 minutes
export const COMBAT_LOCK_TICKS = 8;          // no cast within ~5s of being hit
export const TOWN_KEY = 'K', GRAVE_KEY = 'R';

export class Teleports {
  constructor(game) {
    this.game = game;
    this.cast = null;        // { kind: 'town' | 'grave', left, x, y, hp }
    this.townReady = 0;      // game tick the town teleport can be used again
    this._lastHp = null;
    this._hitTick = -1e9;    // the last tick you lost hitpoints
    game.bus.on('tick', () => this.tick());
  }

  /** Ticks before the town teleport is ready again (0 = ready). */
  townWait() { return Math.max(0, this.townReady - (this.game.tickCount || 0)); }
  /** Is there a gravestone to teleport to? */
  hasGrave() { return !!this.game.play?.grave; }
  /** Seconds, for the buttons and messages. */
  static secs(ticks) { return Math.ceil(ticks * 0.6); }

  /** Why a cast can't start right now, or '' if it can. */
  blocked(kind) {
    const g = this.game, p = g.player;
    if (!p.alive) return "You can't teleport while you're dead.";
    if (g.waves?.active) return "You can't teleport out of the Endless Gate: finish or leave the run first.";
    if (kind === 'grave' && !this.hasGrave()) return 'You have no gravestone to go back to.';
    if (kind === 'town') {
      const w = this.townWait();
      if (w > 0) return `Your town teleport needs ${Teleports.secs(w)}s more to recharge.`;
    }
    if ((g.tickCount || 0) - this._hitTick <= COMBAT_LOCK_TICKS || g._inCombat?.()) return "You can't teleport in the middle of a fight. Get clear first.";
    return '';
  }

  /** Start (or, pressed again, cancel) a teleport. Returns true if a cast started. */
  start(kind) {
    const g = this.game, p = g.player;
    if (this.cast) {
      const same = this.cast.kind === kind;
      this.interrupt('You stop the teleport.');
      if (same) return false;
    }
    const why = this.blocked(kind);
    if (why) { g.msg(why, 'system'); return false; }
    // Automatic play would walk you straight out of the cast.
    if (g.autoBattle) g.toggleAutoBattle(false);
    if (g.autoQuest) g.toggleAutoQuest(false, 'you are teleporting.');
    g._autoLife = null;
    p.stopNow?.(); p.clearAction?.();
    this.cast = { kind, left: CAST_TICKS, x: p.x, y: p.y, hp: p.hp };
    g.msg(kind === 'town'
      ? `You begin to teleport to ${g.world.townName || 'Kampong Glam'}. Stand still for ${Teleports.secs(CAST_TICKS)}s.`
      : `You begin to teleport to your gravestone. Stand still for ${Teleports.secs(CAST_TICKS)}s.`, 'system');
    g.spawnSparkle?.(p, kind === 'town' ? '#8fd6ff' : '#c9b6ff', 8);
    g.bus.emit('teleport');
    return true;
  }

  interrupt(text) {
    if (!this.cast) return;
    this.cast = null;
    if (text) this.game.msg(text, 'system');
    this.game.bus.emit('teleport');
  }

  tick() {
    const g = this.game, p = g.player;
    if (!p) return;
    // Note hits as they happen, so a cast can't start just after one.
    if (this._lastHp !== null && p.hp < this._lastHp) this._hitTick = g.tickCount || 0;
    this._lastHp = p.hp;
    const c = this.cast;
    if (!c) return;
    if (!p.alive || g.waves?.active) { this.interrupt(); return; }
    if (p.x !== c.x || p.y !== c.y || p.isMoving) { this.interrupt('You moved, and the teleport fizzles out.'); return; }
    if (p.hp < c.hp) { this.interrupt("You're hit, and the teleport fizzles out."); return; }
    if (c.kind === 'grave' && !this.hasGrave()) { this.interrupt('Your gravestone is gone, and the teleport fizzles out.'); return; }
    if (--c.left > 0) {
      g.spawnSparkle?.(p, c.kind === 'town' ? '#8fd6ff' : '#c9b6ff', 4);
      g.bus.emit('teleport');
      return;
    }
    this.cast = null;
    this.finish(c.kind);
    g.bus.emit('teleport');
  }

  finish(kind) {
    const g = this.game;
    if (kind === 'town') {
      const rp = g.world.respawnPoint || g.world.spawnPoint;
      if (teleportPlayer(g, rp.x, rp.y, `You teleport back to ${g.world.townName || 'Kampong Glam'}.`)) {
        this.townReady = (g.tickCount || 0) + TOWN_COOLDOWN_TICKS;
        return true;
      }
      return false;
    }
    const gr = g.play?.grave;
    if (!gr) return false;
    // Land beside the stone: standing next to it hands everything back (playbalance.js).
    return teleportPlayer(g, gr.x, gr.y, 'You teleport to your gravestone.');
  }

  /** The buttons' state: { label, status, busy, ready } for 'town' or 'grave'. */
  status(kind) {
    const c = this.cast;
    if (c?.kind === kind) return { status: `Teleporting… ${Teleports.secs(c.left)}s`, busy: true, ready: false };
    if (kind === 'town') {
      const w = this.townWait();
      return w > 0 ? { status: `Recharging ${Teleports.secs(w)}s`, busy: false, ready: false } : { status: 'Ready', busy: false, ready: true };
    }
    const gr = this.game.play?.grave;
    return gr ? { status: `${Math.max(Math.abs(gr.x - this.game.player.x), Math.abs(gr.y - this.game.player.y))} tiles away`, busy: false, ready: true }
      : { status: 'No gravestone', busy: false, ready: false };
  }
}
