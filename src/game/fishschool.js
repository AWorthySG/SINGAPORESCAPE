// Schools of fish: every few minutes a school of one kind of fish swims up to a
// fishing spot near you, stays for half a minute or so, then swims off. While
// it's there, each catch at that spot has a 1 in 2 chance (the owner doubled it from 1 in 4) to net the whole
// school at once: 250-600 fish (more at higher Fishing levels and with a
// rune-or-better rod or harpoon), with XP for each. That uses the school up.
// And at any spot, school or no school, about one catch in 20 (as often as a
// rock's whole seam, jackpot.js) nets a whole school of the fish you hooked.
//
// Built alongside the other fishing extras rather than over them: the tool
// tiers' "big catch" (two at once), the world event's rare shoal (worldevents.js)
// and gathering streaks and lucky finds (gathering.js) all carry on as before.
//
// Kept out of game.js: resolveFish (skilling.js) calls `onCatch` after each
// catch, the bus 'tick' brings schools and sends them off, and the renderer
// draws the one or two near you (render/fishschoolfx.js). Rolls use their own
// generator, so they never shift Math.random (the seeded tests depend on its
// sequence). Schools are not saved.

import { getItem } from '../data/items.js';
import { chebyshev } from '../core/utils.js';
import { TILE } from '../config.js';
import { mulberry32 } from './pets.js';
import { toolBonus } from './tools.js';
import { schoolJackpot } from './jackpot.js';

// A switch for the test suite (tests/seed.mjs turns it off, so tests that pin
// exact catches aren't moved by a school; fish-school.test.mjs turns it on).
export const FISH_SCHOOL = { on: true };

export const SCHOOL_GAP = [200, 400];   // ticks between schools near you (2-4 minutes)
export const SCHOOL_STAY = [34, 66];    // ticks a school stays at its spot (20-40 seconds)
export const SCHOOL_NEAR = 14;          // a school only visits spots this close to you (on screen)
export const SCHOOL_SEEN = 16;          // ...and is announced in the chat this close
export const SCHOOL_MAX = 2;            // at most this many at once
export const SCHOOL_NET = 0.5;          // chance each catch at the spot nets the whole school (doubled from 1 in 4)
// A school is a real haul: fifty times the handful it used to be (the owner
// wanted netting one to feel huge). The bag has no slot limit, so it all fits.
export const SCHOOL_SCALE = 50;
export const SCHOOL_HAUL = [5 * SCHOOL_SCALE, 9 * SCHOOL_SCALE];   // 250-450 fish, before the bonuses below
export const SCHOOL_LEVEL_STEP = 50;    // +50 fish per 50 Fishing levels (up to +100)...
export const SCHOOL_TOOL_SPEED = 40;    // ...and +50 with a rune-or-better rod or harpoon
export const SCHOOL_HAUL_MAX = 12 * SCHOOL_SCALE;   // 600 at most
export const SCHOOL_AUTO = 10;          // auto gather moves to a school this close at a spot of the same kind
const RETRY = 50;                       // no spot nearby: look again in 30 seconds

const fishName = (id) => getItem(id).name.replace(/^Raw /, '').toLowerCase();

/** The most fish a school can hold for a player at `lvl` with tool tier `tb`. */
export function haulBonus(lvl, tb) {
  return SCHOOL_SCALE * (Math.min(2, Math.floor(Math.max(0, lvl) / SCHOOL_LEVEL_STEP)) + ((tb?.speed || 0) >= SCHOOL_TOOL_SPEED ? 1 : 0));
}

export class FishSchools {
  constructor(game) {
    this.game = game;
    this.list = [];      // { obj, fishId, size, from, until } (not saved)
    this.nextAt = null;  // tick the next school is due
    this.netted = 0;     // schools netted this session
    this.rand = mulberry32((Date.now() ^ 0x2c1b3c6d) >>> 0);
    game.bus.on('tick', () => this.tick());
  }

  _between([a, b]) { return a + Math.floor(this.rand() * (b - a + 1)); }

  /** The school at fishing spot `obj`, if one is there now. */
  at(obj) {
    for (const s of this.list) if (s.obj === obj) return s;
    return null;
  }

  tick() {
    const g = this.game, t = g.tickCount || 0;
    // Schools that have stayed their time swim off.
    if (this.list.length) {
      for (const s of this.list.slice()) if (t >= s.until) this.leave(s, true);
    }
    if (!FISH_SCHOOL.on) return;
    if (this.nextAt === null) { this.nextAt = t + this._between(SCHOOL_GAP); return; }
    if (t < this.nextAt) return;
    this.nextAt = t + (this.list.length < SCHOOL_MAX && this.spawn() ? this._between(SCHOOL_GAP) : RETRY);
  }

  /** Fishing spots near you that a school could visit: ones your level can fish. */
  _spots() {
    const g = this.game, p = g.playerTile(), lvl = g.skills.level('fishing'), out = [];
    const W = g.world, r = SCHOOL_NEAR;
    const near = [];
    if (W.objectsIn) W.objectsIn(p.x - r, p.y - r, p.x + r, p.y + r, near);
    else for (const o of W.objects) if (chebyshev(p.x, p.y, o.x, o.y) <= r) near.push(o);
    for (const o of near) {
      if (o.def?.type !== 'fishing' || !o.def.catches || this.at(o)) continue;
      if (!o.def.catches.some((c) => (c.level || 1) <= lvl)) continue;
      out.push(o);
    }
    return out;
  }

  /** A school arrives at a spot near you (or at `obj`). Returns it, or null. */
  spawn(obj = null) {
    const g = this.game;
    if (!g.player?.alive) return null;
    if (!obj) {
      let spots = this._spots();
      if (!spots.length) return null;
      // Fishing already? Most schools come to your kind of spot, so they're worth the walk.
      const a = g.player.action;
      if (a?.type === 'fish' && a.obj && this.rand() < 0.6) {
        const same = spots.filter((o) => o.objId === a.obj.objId);
        if (same.length) spots = same;
      }
      obj = spots[Math.floor(this.rand() * spots.length)];
    }
    if (this.at(obj)) return this.at(obj);
    const lvl = g.skills.level('fishing');
    const ok = obj.def.catches.filter((c) => (c.level || 1) <= lvl);
    const list = ok.length ? ok : obj.def.catches;
    // One kind of fish to a school, rolled like a catch there (tuna more often than sharks).
    let r = this.rand() * list.reduce((n, c) => n + (c.weight || 1), 0);
    const fish = list.find((c) => (r -= c.weight || 1) < 0) || list[0];
    const t = g.tickCount || 0;
    const s = { obj, fishId: fish.id, from: t, until: t + this._between(SCHOOL_STAY), size: this._between(SCHOOL_HAUL) };
    this.list.push(s);
    const p = g.playerTile();
    if (chebyshev(p.x, p.y, obj.x, obj.y) <= SCHOOL_SEEN) {
      const where = g.world.zoneAt?.(obj.x, obj.y)?.name;
      g.msg(`A school of ${fishName(fish.id)} is passing the ${obj.def.name.toLowerCase()}${where ? ` in ${where}` : ''}!`, 'level');
    }
    this._autoFollow(s);
    g.bus.emit('fishschool');
    return s;
  }

  /** Auto gather fishing a spot of the same kind close by moves to the school. */
  _autoFollow(s) {
    const g = this.game, a = g.player.action;
    if (!g.autoGather || a?.type !== 'fish' || !a.obj || a.obj === s.obj || a.obj.objId !== s.obj.objId) return;
    const p = g.playerTile();
    if (chebyshev(p.x, p.y, s.obj.x, s.obj.y) > SCHOOL_AUTO) return;
    g.msg('Auto gather follows the school.', 'system');
    g.defaultObjectAction(s.obj);
  }

  /** The school swims off (its time is up, or it was netted). */
  leave(s, timedOut = false) {
    const i = this.list.indexOf(s);
    if (i < 0) return;
    this.list.splice(i, 1);
    const g = this.game, p = g.playerTile();
    if (timedOut && chebyshev(p.x, p.y, s.obj.x, s.obj.y) <= SCHOOL_SEEN) g.msg(`The school of ${fishName(s.fishId)} swims off.`);
    g.bus.emit('fishschool');
  }

  /** A fish was just caught at `obj` (resolveFish); `xpMult` is what that
   *  catch's XP was multiplied by (moonfish by moonlight), `caughtId` the fish.
   *  Now and then the whole school comes up in the net: a school passing the
   *  spot, or (at any spot) a school of the fish just hooked. Returns how many
   *  fish it added (0 if none). */
  onCatch(obj, xpMult = 1, caughtId = null) {
    const g = this.game;
    const s = FISH_SCHOOL.on ? this.at(obj) : null;
    if (s && this.rand() < SCHOOL_NET) {
      const n = this._net(obj, s.fishId, s.size, xpMult, toolBonus(g, obj.def.tool || 'net'), false);
      if (n) { this.leave(s); return n; }
    }
    // And at any spot (a school passing or not): now and then a whole school, as
    // often as a whole seam or tree (the owner's ask), of the fish you hooked.
    if (!caughtId) return 0;
    const tb = toolBonus(g, obj.def.tool || 'net');
    if (!schoolJackpot(tb.find)) return 0;
    return this._net(obj, caughtId, this._between(SCHOOL_HAUL), xpMult, tb, true);
  }

  /** Net a whole school of `fishId` at `obj` (`size` fish before the level and
   *  tool bonuses): into the bag, XP for each, and a splash. `wild`: no school
   *  was seen passing, it came up with the fish you hooked. Returns how many. */
  _net(obj, fishId, size, xpMult, tb, wild) {
    const g = this.game;
    const want = Math.min(SCHOOL_HAUL_MAX, size + haulBonus(g.skills.level('fishing'), tb));
    // A full bag takes what fits; with no room at all, a passing school stays for later.
    const n = Math.min(want, g.inventory.canAdd(fishId, want));
    if (n <= 0) return 0;
    g.inventory.add(fishId, n);
    const xpEach = (obj.def.catches.find((c) => c.id === fishId)?.xp || 0) * xpMult;
    g.skills.addXp('fishing', xpEach * n);
    this.netted++;
    const name = getItem(fishId).name.replace(/^Raw /, '');
    const full = n < want ? ' (all your bag could hold)' : '';
    g.msg(wild ? `It was a whole school of ${fishName(fishId)}: you net ${n} at once${full}!`
      : `You net the whole school: ${n} ${fishName(fishId)}${full}!`, 'level');
    g.banner?.(`<span class="big">Whole school!</span>+${n} ${name}`);
    g.addHitsplat?.(g.player, 0, { text: `Whole school! +${n} ${name}` });
    // A splash: spray off the water and a glint over you.
    const cx = (obj.x + 0.5) * TILE, cy = (obj.y + 0.5) * TILE;
    g.spawnPoof?.(cx, cy, '#bfe3ff'); g.spawnPoof?.(cx - 8, cy + 4, '#ffffff'); g.spawnPoof?.(cx + 8, cy - 3, '#8fd0ff');
    g.spawnSparkle?.(g.player, '#8fd0ff', 14);
    g.bus.emit('sfx', 'dropepic');
    return n;
  }
}
