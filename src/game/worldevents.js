// Roaming world events and weekly region challenges (data and reward tables in
// src/data/worldevents.js).
//
// World events: every 20-30 minutes of play (EVENT_GAP ticks) one starts in a
// region of the world, lasts a few minutes and is marked on the minimap, in
// the chat, on a banner and in the quest journal (with a Go button). Kinds:
//   invasion  monsters storm a town; defeat enough of them to drive them off
//   shoal     a rare fish shoal by the shore: double XP and bonus fish
//   meteor    a fallen meteor to mine: rich ore and double XP until it crumbles
//   escort    a lost merchant walks to safety; fight off the ambushes on his road
//   rampage   a champion monster rampages through a region
//   grove     an ancient tree springs up: double Woodcutting XP
// Everything an event puts into the world (monsters, the merchant, nodes) is
// listed on it and removed when it ends, when you die, and on load (events are
// not saved, only when the next one is due). While none is running the tick
// costs one comparison; a running one looks only at its own few monsters.
//
// Weekly challenges: each ISO week features one region (seeded by the week, from
// the regions that suit your level) with three tasks there: defeat creatures,
// gather resources and finish a world event. All three open a reward crate.
import { NPC } from './npc.js';
import { getNpc } from '../data/npcs.js';
import { OBJECTS } from '../data/objects.js';
import { getItem } from '../data/items.js';
import { zoneLevel } from '../data/world.js';
import { findPath } from '../engine/pathfinding.js';
import { chebyshev } from '../core/utils.js';
import { TILE } from '../config.js';
import { waveKinds, waveMobDef } from './waves.js';
import { seeded } from './bounty.js';
import {
  EVENT_KINDS, EVENT_IDS, EVENT_GAP, FIRST_GAP, RETRY_TICKS, FEATURED_BIAS, INVASION_ALIVE, ESCORT_AMBUSHES, ESCORT_MERCHANT_HP,
  METEOR_CHARGES, GROVE_CHARGES, GATHER_GOAL, GATHER_MIN, BONUS_CATCH, SKILL_XP_MULT, eventReward, eventXp,
  WEEKLY_TASKS, weeklyCrate, isoWeekKey,
} from '../data/worldevents.js';

const SECS_TO_TICKS = 1 / 0.6;
const between = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));
const BANNER = 'worldevent';
const GATHER_KINDS = new Set(['shoal', 'meteor', 'grove']);

/** A fresh weekly challenge record (no week yet). */
export const defaultWeekly = () => ({ week: null, region: null, kills: 0, gathers: 0, events: 0, claimed: false });

export class WorldEvents {
  constructor(game) {
    this.game = game;
    // Events start on their own in the browser; headless runs (tests) drive
    // them by hand, so a long test never meets a surprise invasion.
    this.auto = typeof document !== 'undefined';
    this.nextAt = null;        // tick the next event is due (set on the first tick)
    this.active = null;        // the event under way, or null
    this.done = 0;             // events finished successfully (saved)
    this.weekly = defaultWeekly();
  }

  // ---------------- Scheduling ----------------
  tick() {
    const g = this.game;
    if (this.active) { this._tickActive(); return; }
    if (this.nextAt === null) { this.nextAt = g.tickCount + between(FIRST_GAP); return; }
    if (g.tickCount < this.nextAt) return;
    // Due: roll the weekly board over now and then too (it's cheap, and a week
    // can turn while the game is open).
    this.ensureWeek();
    if (!this.auto || !this.startRandom()) this.nextAt = g.tickCount + RETRY_TICKS;
  }

  /** Start a random kind of event (one you can take part in). */
  startRandom() {
    const g = this.game;
    if (!g.player.alive || g.waves?.active) return null;
    const kinds = EVENT_IDS.filter((k) => this._canDo(k));
    for (let tries = 0; tries < 4 && kinds.length; tries++) {
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      const ev = this.start(k);
      if (ev) return ev;
    }
    return null;
  }

  /** Gathering events need the tool (and a node your level can work). */
  _canDo(kind) {
    const g = this.game;
    if (kind === 'shoal') return !!this._shoalBase();
    if (kind === 'meteor') return g.hasTool('pickaxe') && !!this._bestRock();
    if (kind === 'grove') return g.hasTool('axe') && !!this._bestTree();
    return true;
  }

  // ---------------- Places ----------------
  /** Regions an event may visit: not the Wilderness, not instances, and not
   *  far above your level. */
  _regions() {
    const cl = this.game.fightLevel();
    return this.game.world.zones.filter((z) => !z.instance && !z.wilderness && zoneLevel(z) <= cl + 10);
  }

  /** A region for the next event; this week's featured region now and then. */
  _pickRegion() {
    const list = this._regions();
    if (!list.length) return null;
    const feat = list.find((z) => z.name === this.weekly.region);
    if (feat && Math.random() < FEATURED_BIAS) return feat;
    return list[Math.floor(Math.random() * list.length)];
  }

  /** The towns ({ name, rect: [x0, y0, x1, y1], zone }) for invasions: the two
   *  starting towns and the outer towns, named after their signposts. */
  _towns() {
    const w = this.game.world;
    if (this._townList) return this._townList;
    const signs = w.objects.filter((o) => o.objId === 'sign' && o.sign);
    const name = (r, fallback) => {
      const s = signs.find((o) => o.x >= r[0] - 4 && o.x <= r[2] + 4 && o.y >= r[1] - 4 && o.y <= r[3] + 4);
      return s ? s.sign.replace(/[←-↓⚠]/g, '').trim() : fallback;
    };
    const rects = [...w.zones.filter((z) => z.name === 'Kampong Glam' || z.name === 'Chinatown').map((z) => [z.x0, z.y0, z.x1, z.y1]), ...(w.towns || [])];
    this._townList = rects.map((r) => {
      const z = w.zoneAt(Math.round((r[0] + r[2]) / 2), Math.round((r[1] + r[3]) / 2));
      return { rect: r, zone: z?.name || '', name: name(r, z?.name || 'the town') };
    });
    return this._townList;
  }

  /** A free walkable tile in zone z (optionally inside rect r), not in a town. */
  _landSpot(z, r = null, tries = 200) {
    const w = this.game.world, towns = this._towns(), p = this.game.player;
    const [x0, y0, x1, y1] = r || [z.x0, z.y0, z.x1, z.y1];
    for (let i = 0; i < tries; i++) {
      const x = x0 + Math.floor(Math.random() * (x1 - x0 + 1)), y = y0 + Math.floor(Math.random() * (y1 - y0 + 1));
      if (!w.inBounds(x, y) || w.isBlocked(x, y) || w.objectAt(x, y) || w.zoneAt(x, y) !== z) continue;
      if (!r && towns.some((t) => x >= t.rect[0] - 2 && x <= t.rect[2] + 2 && y >= t.rect[1] - 2 && y <= t.rect[3] + 2)) continue;
      if (x === p.x && y === p.y) continue;
      return { x, y };
    }
    return null;
  }

  /** A water tile by the shore of zone z (an open land tile next to it). */
  _shoreSpot(z) {
    const w = this.game.world;
    for (let i = 0; i < 800; i++) {
      const x = z.x0 + Math.floor(Math.random() * (z.x1 - z.x0 + 1)), y = z.y0 + Math.floor(Math.random() * (z.y1 - z.y0 + 1));
      if (w.terrainAt(x, y) !== 2 || w.objectAt(x, y) || w.zoneAt(x, y) !== z) continue;   // 2: water
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!w.isBlocked(x + dx, y + dy) && !w.objectAt(x + dx, y + dy)) return { x, y };
      }
    }
    return null;
  }

  // ---------------- Starting ----------------
  /** Start an event of `kind` (opts.region: a zone name to hold it in).
   *  Returns the event, or null if it couldn't be placed. */
  start(kind, opts = {}) {
    const g = this.game;
    if (this.active || !EVENT_KINDS[kind]) return null;
    let z = opts.region ? g.world.zones.find((q) => q.name === opts.region) : this._pickRegion();
    if (!z) return null;
    const def = EVENT_KINDS[kind];
    const ev = { kind, name: def.name, region: z.name, place: z.name, x: 0, y: 0, startTick: g.tickCount,
      endTick: g.tickCount + Math.round(def.secs * SECS_TO_TICKS), need: 1, have: 0, mine: 0, gathers: 0,
      mobs: [], objs: [], npc: null, level: 1 };
    const ok = this['_setup_' + kind](ev, z, opts);
    if (!ok) { this._cleanup(ev); return null; }
    this.active = ev;
    g.msg(`World event: ${ev.name}! ${def.blurb(ev)}`, 'level');
    g.banner(`<span class="big">${def.icon} ${ev.name}</span>${def.blurb(ev)}`, BANNER);
    g.bus.emit('sfx', 'spec');
    g.bus.emit('worldevents');
    return ev;
  }

  _setup_invasion(ev, z, opts) {
    const g = this.game;
    const towns = this._towns();
    // A town in the chosen region if there is one, else any town that suits you.
    const ok = towns.filter((t) => this._regions().some((r) => r.name === t.zone));
    const town = opts.town ? towns.find((t) => t.name === opts.town) : (ok.find((t) => t.zone === z.name) || ok[Math.floor(Math.random() * ok.length)]);
    if (!town) return false;
    const [a, b, c, d] = town.rect;
    Object.assign(ev, { place: town.name, region: town.zone, town: town.rect, x: Math.round((a + c) / 2), y: Math.round((b + d) / 2) });
    ev.level = Math.max(1, Math.round(g.fightLevel() * 0.8));
    ev.kinds = waveKinds(1 + Math.floor(Math.random() * 6), ev.level);
    ev.need = Math.min(16, 10 + Math.floor(g.fightLevel() / 40));
    ev.queue = ev.need;
    while (ev.queue > 0 && ev.mobs.filter((n) => n.alive).length < INVASION_ALIVE) if (!this._spawnInvader(ev)) break;
    return ev.mobs.length > 0;
  }

  /** One invader, just outside the town's edge, wandering into it. */
  _spawnInvader(ev) {
    const g = this.game, w = g.world, [a, b, c, d] = ev.town;
    for (let i = 0; i < 60; i++) {
      const x = a - 4 + Math.floor(Math.random() * (c - a + 9)), y = b - 4 + Math.floor(Math.random() * (d - b + 9));
      const inside = x >= a && x <= c && y >= b && y <= d;
      if (inside || !w.inBounds(x, y) || w.isBlocked(x, y) || chebyshev(x, y, g.player.x, g.player.y) < 4) continue;
      const id = ev.kinds[ev.mobs.length % ev.kinds.length];
      const def = { ...waveMobDef(id, 1, ev.level), wave: false, name: `Invading ${getNpc(id).name.toLowerCase()}`, aggroRange: 10 };
      const n = this._spawnMob(id, def, x, y, ev);
      n.spawnX = ev.x; n.spawnY = ev.y; n.wander = Math.max(6, Math.round(Math.max(c - a, d - b) / 2));
      ev.queue--;
      return n;
    }
    return null;
  }

  /** Add an event monster to the world (temporary: gone when it dies). */
  _spawnMob(id, def, x, y, ev) {
    const g = this.game;
    const n = new NPC(id, x, y, 0, { aggressive: true, ignoreLevelGate: true });
    n.def = def;
    n.maxHp = n.hp = def.maxHp;
    n.wander = 4;
    n.temporary = true;
    n.worldEvent = true;
    n.spawnT = 350;   // fades in
    g.npcs.push(n);
    g.hasTemps = true;
    ev.mobs.push(n);
    g.spawnPoof?.(x * TILE + TILE / 2, y * TILE + TILE / 2, EVENT_KINDS[ev.kind].colour);
    return n;
  }

  _setup_rampage(ev, z) {
    const g = this.game;
    const spot = this._landSpot(z);
    if (!spot) return false;
    ev.level = Math.max(1, Math.round(g.fightLevel() * 1.05));
    const id = waveKinds(1 + Math.floor(Math.random() * 6), ev.level)[0];
    const n = this._spawnMob(id, { ...waveMobDef(id, 1, ev.level), wave: false, aggroRange: 8 }, spot.x, spot.y, ev);
    n.makeChampion();
    n.def = { ...n.def, name: `Rampaging ${n.def.name.replace(/^Champion /, '')}` };
    n.wander = 10;
    Object.assign(ev, { x: spot.x, y: spot.y, foe: getNpc(id).name.toLowerCase(), need: 1 });
    return true;
  }

  _setup_escort(ev, z) {
    const g = this.game;
    // A road of 20-60 steps between two open tiles, so the walk takes a few minutes at most.
    for (let tries = 0; tries < 8; tries++) {
      const from = this._landSpot(z), to = from && this._landSpot(z, [from.x - 32, from.y - 32, from.x + 32, from.y + 32], 60);
      if (!from || !to || chebyshev(from.x, from.y, to.x, to.y) < 18) continue;
      const route = findPath(g.pathCfg(), from, to, { maxNodes: 20000 });
      if (route.length < 20 || route.length > 60) continue;
      const m = new NPC('villager', from.x, from.y, 0);
      m.def = { ...m.def, name: 'Lost merchant', wander: 0, examine: 'A travelling merchant who has lost his way. Keep him safe!',
        chatter: null };
      m.wander = 0;
      m.temporary = true;
      m.worldEvent = true;
      m.escortHp = m.escortMax = ESCORT_MERCHANT_HP;
      g.npcs.push(m);
      ev.npc = m;
      ev.mobs.push(m);
      Object.assign(ev, { x: from.x, y: from.y, route, ri: 0, dest: to, ambushes: 0,
        ambushAt: [0.2, 0.5, 0.8].slice(0, ESCORT_AMBUSHES).map((f) => Math.floor(route.length * f)) });
      ev.level = Math.max(1, Math.round(g.fightLevel() * 0.75));
      ev.kinds = waveKinds(1 + Math.floor(Math.random() * 6), ev.level);
      ev.need = route.length;
      return true;
    }
    return false;
  }

  /** The best fishing spot you can fish at now (tool in hand, a catch at your level). */
  _shoalBase() {
    const g = this.game, lvl = g.skills.level('fishing');
    let best = null, bx = -1;
    for (const [id, d] of Object.entries(OBJECTS)) {
      if (d.type !== 'fishing' || d.night || !d.catches || !g.hasTool(d.tool || 'net')) continue;
      const ok = d.catches.filter((c) => lvl >= c.level);
      const top = ok.reduce((m, c) => Math.max(m, c.xp), -1);
      if (ok.length && top > bx) { best = id; bx = top; }
    }
    return best;
  }

  _setup_shoal(ev, z) {
    const g = this.game, base = this._shoalBase();
    if (!base) return false;
    const spot = this._shoreSpot(z);
    if (!spot) return false;
    const d = OBJECTS[base];
    const def = { ...d, name: 'Rare fish shoal', label: 'Shoal', examine: 'A glittering shoal of rare fish! Double XP while it lasts.',
      catches: d.catches.map((c) => ({ ...c, xp: c.xp * SKILL_XP_MULT })), tint: 'saturate(1.8) brightness(1.15) hue-rotate(-20deg)', worldEvent: true };
    ev.objs.push(g.world.addObject(base, spot.x, spot.y, { def, worldEvent: true }));
    Object.assign(ev, { x: spot.x, y: spot.y, need: GATHER_GOAL, level: g.skills.level('fishing') });
    return true;
  }

  /** The highest rock (not a gem rock) your Mining level can work. */
  _bestRock() {
    const lvl = this.game.skills.level('mining');
    let best = null;
    for (const [id, d] of Object.entries(OBJECTS)) {
      if (d.type !== 'rock' || d.gemRock || d.night || !d.gives || d.level > lvl) continue;
      if (!best || d.level > OBJECTS[best].level) best = id;
    }
    return best;
  }

  _setup_meteor(ev, z) {
    const g = this.game, rock = this._bestRock(), spot = this._landSpot(z);
    if (!rock || !spot) return false;
    const r = OBJECTS[rock];
    // It looks like a fallen star whatever ore it holds (the star's art), and
    // grows back at once until its charges are spent.
    const def = { ...OBJECTS.fallen_star, name: 'Meteorite', label: 'Meteorite', level: r.level, gives: r.gives, xp: r.xp * SKILL_XP_MULT,
      respawn: 1, ore: r.ore || '#6a7ad8', examine: `A smoking meteorite, studded with ${getItem(r.gives).name.toLowerCase()}. Mine it before it cools!`, worldEvent: true };
    ev.objs.push(g.world.addObject('fallen_star', spot.x, spot.y, { def, worldEvent: true }));
    Object.assign(ev, { x: spot.x, y: spot.y, need: GATHER_GOAL, charges: METEOR_CHARGES, level: g.skills.level('mining') });
    g.addShake?.(4, 360);
    return true;
  }

  /** The highest tree your Woodcutting level can chop (by day). */
  _bestTree() {
    const lvl = this.game.skills.level('woodcutting');
    let best = null;
    for (const [id, d] of Object.entries(OBJECTS)) {
      if (d.type !== 'tree' || d.night || !d.gives || d.level > lvl) continue;
      if (!best || d.level > OBJECTS[best].level) best = id;
    }
    return best;
  }

  _setup_grove(ev, z) {
    const g = this.game, tree = this._bestTree(), spot = this._landSpot(z);
    if (!tree || !spot) return false;
    const t = OBJECTS[tree];
    const def = { ...t, name: `Ancient ${t.name.toLowerCase()}`, xp: t.xp * SKILL_XP_MULT, depleteChance: 0, respawn: 1,
      examine: 'An ancient tree, sprung up overnight. Its wood gives double XP.', worldEvent: true };
    ev.objs.push(g.world.addObject(tree, spot.x, spot.y, { def, worldEvent: true }));
    Object.assign(ev, { x: spot.x, y: spot.y, need: GATHER_GOAL, charges: GROVE_CHARGES, level: g.skills.level('woodcutting') });
    return true;
  }

  // ---------------- Running ----------------
  _tickActive() {
    const g = this.game, ev = this.active;
    if (ev.kind === 'invasion') {
      for (const n of ev.mobs) if (!n.alive && !n._counted) { n._counted = true; ev.have++; }
      ev.mobs = ev.mobs.filter((n) => n.alive && g.npcs.includes(n));
      if (ev.have >= ev.need) return this.end(true);
      // Reinforcements: one a tick while the field is short.
      if (ev.queue > 0 && ev.mobs.length < INVASION_ALIVE) this._spawnInvader(ev);
      if (!ev.mobs.length && ev.queue <= 0) return this.end(true);
    } else if (ev.kind === 'rampage') {
      const n = ev.mobs[0];
      if (!n || !n.alive || !g.npcs.includes(n)) { ev.have = 1; return this.end(true); }
      ev.x = n.x; ev.y = n.y;
    } else if (ev.kind === 'escort') {
      if (this._tickEscort(ev) !== undefined) return;
    } else if ((ev.kind === 'meteor' || ev.kind === 'grove') && ev.charges <= 0) {
      return this.end(true);
    }
    // A miner keeps swinging at the meteorite (every swing "mines it out").
    if (ev.remine && g.player.alive && !g.player.action && !g.player.isMoving && ev.objs[0]) {
      const o = ev.objs[0];
      ev.remine = false;
      if (chebyshev(o.x, o.y, g.player.x, g.player.y) <= 1) g.defaultObjectAction(o);
    }
    if (g.tickCount >= ev.endTick) return this._timeUp(ev);
    if (g.tickCount % 5 === 0) g.bus.emit('worldevents');   // the countdown on the tracker
  }

  /** The merchant walks on while you're near and no ambush is about. Returns a
   *  value once the event has ended. */
  _tickEscort(ev) {
    const g = this.game, m = ev.npc, p = g.player;
    if (!m || !g.npcs.includes(m)) return this.end(false);
    const foes = ev.mobs.filter((n) => n !== m && n.alive && g.npcs.includes(n));
    ev.mobs = [m, ...foes];
    // Bandit beasts next to him hurt him.
    for (const f of foes) if (chebyshev(f.x, f.y, m.x, m.y) <= 1) {
      m.escortHp = Math.max(0, m.escortHp - 2);
      g.addHitsplat?.(m, 2);
    }
    if (m.escortHp <= 0) { g.msg('The merchant has been overwhelmed...', 'combat'); return this.end(false); }
    ev.x = m.x; ev.y = m.y;
    const near = p.alive && chebyshev(p.x, p.y, m.x, m.y) <= 8;
    if (foes.length || !near) {
      if (m.isMoving) m.stop();
      if (!m.chatTimer && Math.random() < 0.08) { m.chatText = foes.length ? 'Help! Keep them off me!' : 'Wait for me!'; m.chatTimer = 3; }
      return undefined;
    }
    // An ambush waits at fixed points along the road.
    if (ev.ambushes < ev.ambushAt.length && ev.ri >= ev.ambushAt[ev.ambushes]) {
      ev.ambushes++;
      this._ambush(ev);
      return undefined;
    }
    if (m.isMoving) return undefined;
    if (ev.ri >= ev.route.length) { ev.have = ev.need; return this.end(true); }
    const seg = ev.route.slice(ev.ri, ev.ri + 3);
    ev.ri += seg.length;
    ev.have = ev.ri;
    m.setPath(seg);
    return undefined;
  }

  _ambush(ev) {
    const g = this.game, m = ev.npc, w = g.world;
    const count = 2 + (ev.ambushes >= ESCORT_AMBUSHES ? 1 : 0);
    let made = 0;
    for (let i = 0; i < 40 && made < count; i++) {
      const x = m.x - 5 + Math.floor(Math.random() * 11), y = m.y - 5 + Math.floor(Math.random() * 11);
      if (!w.inBounds(x, y) || w.isBlocked(x, y) || chebyshev(x, y, m.x, m.y) < 3) continue;
      const id = ev.kinds[made % ev.kinds.length];
      const n = this._spawnMob(id, { ...waveMobDef(id, 1, ev.level), wave: false, name: `Bandit ${getNpc(id).name.toLowerCase()}`, aggroRange: 12 }, x, y, ev);
      n.spawnX = m.x; n.spawnY = m.y; n.wander = 6;
      // Straight for the merchant.
      const path = findPath(g.pathCfg(), { x, y }, { x: m.x, y: m.y }, { reachAdjacent: true, maxNodes: 600 });
      if (path.length) n.setPath(path);
      made++;
    }
    g.msg('An ambush! Beasts leap out at the merchant.', 'combat');
    m.chatText = 'Ambush! Help!'; m.chatTimer = 3;
  }

  _timeUp(ev) {
    // A gathering event ends well for anyone who took part; the fights end in failure.
    return this.end(GATHER_KINDS.has(ev.kind) && ev.gathers >= GATHER_MIN, 'time');
  }

  // ---------------- Credit ----------------
  /** Game.killNpc calls this for every kill (yours or an ally's). */
  onKill(npc, byAlly = false) {
    const ev = this.active;
    if (ev && npc.worldEvent && ev.mobs.includes(npc)) {
      if (ev.kind === 'invasion') ev.mine++;
      if (ev.kind === 'rampage') ev.byYou = true;
    }
    if (!npc.def?.attackable) return;
    const z = this.game.world.zoneAt(npc.x, npc.y);
    if (z && z.name === this.weekly.region) this._weekly('kills', 1);
  }

  /** Game._tickContinuous calls this after each gathering step, with your bag
   *  counts before and after it. */
  onGather(obj, before, after) {
    let got = 0, first = null;
    for (const [id, n] of after) { const d = n - (before.get(id) || 0); if (d > 0 && id !== 'coins') { got += d; first ??= id; } }
    if (!got) return;
    const g = this.game, ev = this.active;
    if (ev && obj?.worldEvent && ev.objs.includes(obj)) {
      ev.gathers++;
      ev.have = Math.min(ev.need, ev.gathers);
      if (ev.charges !== undefined) ev.charges--;
      if (Math.random() < BONUS_CATCH) { g.inventory.add(first, 1); g.msg(`Event bonus: +1 ${getItem(first).name}!`, 'level'); }
      if (ev.kind === 'meteor') { obj.depleted = false; obj.respawnTimer = 0; ev.remine = ev.charges > 0; }
      g.bus.emit('worldevents');
    }
    const z = g.world.zoneAt(obj?.x ?? g.player.x, obj?.y ?? g.player.y);
    if (z && z.name === this.weekly.region) this._weekly('gathers', got);
  }

  /** You fell: the event (if any) is called off and packed away. */
  onDeath() {
    const ev = this.active;
    if (!ev) return;
    // What you gathered before you fell still counts; a fight is lost.
    this.end(GATHER_KINDS.has(ev.kind) && ev.gathers >= GATHER_MIN, 'death');
  }

  // ---------------- Ending ----------------
  /** End the running event: pay out on success, then clear everything it placed. */
  end(success, why = '') {
    const g = this.game, ev = this.active;
    if (!ev) return null;
    this.active = null;
    this._cleanup(ev);
    let got = [];
    if (success) {
      const share = this._share(ev);
      if (share > 0) {
        got = this._pay(ev, share);
        this.done++;
        if (ev.region === this.weekly.region) this._weekly('events', 1);
      } else g.msg(`${ev.name} is over: ${ev.place} is safe, though you took no part this time.`, 'system');
    } else {
      g.msg(why === 'death' ? `${ev.name} is called off while you recover.` : why === 'time' ? `${ev.name} is over: time ran out.` : `${ev.name} has failed.`, 'system');
    }
    g.ui?.hideBanner?.(BANNER);
    this.nextAt = g.tickCount + between(EVENT_GAP);
    g.saveSoon = true;
    g.bus.emit('worldevents');
    return got;
  }

  /** How much of the event was yours (0-1). */
  _share(ev) {
    if (ev.kind === 'invasion') return ev.mine > 0 ? Math.min(1, 0.3 + (1.4 * ev.mine) / ev.need) : 0;
    if (GATHER_KINDS.has(ev.kind)) return ev.gathers >= GATHER_MIN ? Math.min(1, ev.gathers / GATHER_GOAL) : 0;
    if (ev.kind === 'rampage') return ev.byYou ? 1 : 0;   // put down by you (or your mercenaries)
    return 1;   // an escort you saw home
  }

  _pay(ev, share) {
    const g = this.game, kind = EVENT_KINDS[ev.kind];
    const fight = kind.skill === 'combat';
    const L = fight ? g.fightLevel() : g.skills.level(kind.skill);
    const got = eventReward(ev.kind, L, share);
    for (const [id, q] of got) g.inventory.add(id, q);
    const mode = g.combatMode();
    const skill = !fight ? kind.skill : mode === 'ranged' ? 'ranged' : mode === 'magic' ? 'magic' : mode === 'dance' ? 'agility' : 'attack';
    const xp = eventXp(L, share);
    g.skills.addXp(skill, xp);
    const list = got.map(([id, q]) => `${q.toLocaleString('en-GB')} ${id === 'coins' ? 'coins' : getItem(id).name}`).join(', ');
    g.msg(`${ev.name} complete! Reward: ${list}, and bonus ${skill} XP.`, 'level');
    g.banner(`<span class="big">${kind.icon} ${ev.name} complete!</span>${list}`, BANNER);
    g.bus.emit('sfx', 'achievement');
    const c = g.player.renderCenter?.();
    if (c) g.spawnConfetti?.(c.x, c.y - 18, 26);
    return got;
  }

  /** Take everything an event put into the world back out. */
  _cleanup(ev) {
    const g = this.game, p = g.player;
    const gone = new Set(ev.mobs);
    if (ev.npc) gone.add(ev.npc);
    if (gone.size) {
      g.npcs = g.npcs.filter((n) => !gone.has(n));
      if (gone.has(p.target)) p.target = null;
      if (p.action?.npc && gone.has(p.action.npc)) p.clearAction();
    }
    for (const o of ev.objs) {
      g.world.removeObject(o);
      if (p.action?.obj === o) p.clearAction();
      if (g._autoLife?.objId === o.objId) g._autoLife = null;
    }
    ev.mobs = []; ev.objs = []; ev.npc = null;
  }

  /** Clear any running event without a word (loading a save). */
  clear() {
    if (this.active) { this._cleanup(this.active); this.active = null; }
    this.game.ui?.hideBanner?.(BANNER);
  }

  /** Quest-journal "Go": travel to the running event. */
  travel() {
    const ev = this.active, g = this.game;
    if (!ev || !g.player.alive) return false;
    const ok = g.travelToTile({ x: ev.x, y: ev.y });
    if (ok) g.msg(`You set off for the ${ev.name.toLowerCase()} in ${ev.place}.`, 'system');
    return ok;
  }

  /** Seconds left on the running event (0 when none). */
  secondsLeft() { return this.active ? Math.max(0, Math.ceil((this.active.endTick - this.game.tickCount) * 0.6)) : 0; }

  /** A one-line progress note for the running event, e.g. "7/12 defeated". */
  progressText() {
    const ev = this.active;
    if (!ev) return '';
    if (ev.kind === 'invasion') return `${ev.have}/${ev.need} defeated`;
    if (ev.kind === 'escort') return `${Math.round((100 * ev.ri) / Math.max(1, ev.route.length))}% of the way, merchant ${ev.npc?.escortHp ?? 0}/${ESCORT_MERCHANT_HP}`;
    if (ev.kind === 'rampage') return 'defeat it';
    return `${Math.min(ev.gathers, GATHER_GOAL)}/${GATHER_GOAL} gathered`;
  }

  // ---------------- Weekly region challenge ----------------
  /** Make sure this week's challenge exists (a new week = a new region). */
  ensureWeek(key = isoWeekKey()) {
    const w = this.weekly;
    if (w.week === key && w.region) return false;
    const list = this._regions().map((z) => z.name).sort();
    if (!list.length) return false;
    const r = seeded(key)();
    this.weekly = { ...defaultWeekly(), week: key, region: list[Math.floor(r * list.length) % list.length] };
    this.game.bus.emit('worldevents');
    return true;
  }

  /** The week's three tasks with progress: [{ id, text, have, need, done }]. */
  weeklyTasks() {
    const w = this.weekly;
    if (!w.region) return [];
    return WEEKLY_TASKS.map((t) => ({ id: t.id, text: t.text(w.region), have: Math.min(t.need, w[t.id] || 0), need: t.need, done: (w[t.id] || 0) >= t.need }));
  }

  _weekly(field, n) {
    const g = this.game, w = this.weekly;
    if (!w.region || w.claimed) return;
    const task = WEEKLY_TASKS.find((t) => t.id === field);
    const was = w[field] || 0;
    w[field] = was + n;
    if (task && was < task.need && w[field] >= task.need) g.msg(`Weekly challenge: ${task.text(w.region)}, done!`, 'level');
    if (WEEKLY_TASKS.every((t) => (w[t.id] || 0) >= t.need)) {
      w.claimed = true;
      const got = weeklyCrate(g.fightLevel());
      for (const [id, q] of got) g.inventory.add(id, q);
      const list = got.map(([id, q]) => `${q.toLocaleString('en-GB')} ${id === 'coins' ? 'coins' : getItem(id).name}`).join(', ');
      g.msg(`Weekly challenge in ${w.region} complete! Your reward crate holds: ${list}.`, 'level');
      g.banner(`<span class="big">Weekly challenge complete!</span>${list}`);
      g.bus.emit('sfx', 'achievement');
    }
    g.saveSoon = true;
    g.bus.emit('worldevents');
  }

  // ---------------- Saving ----------------
  /** Only the schedule, the tally and the week are kept: a running event is not. */
  serialize() {
    const nextIn = this.active ? null : this.nextAt === null ? null : Math.max(0, this.nextAt - this.game.tickCount);
    return { done: this.done, nextIn, weekly: { ...this.weekly } };
  }

  load(data) {
    this.clear();
    const d = data && typeof data === 'object' ? data : {};
    this.done = Math.max(0, Math.floor(Number(d.done) || 0));
    this.nextAt = typeof d.nextIn === 'number' && d.nextIn >= 0 ? this.game.tickCount + Math.min(Math.floor(d.nextIn), EVENT_GAP[1]) : null;
    const w = d.weekly && typeof d.weekly === 'object' ? d.weekly : {};
    const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
    this.weekly = {
      week: typeof w.week === 'string' ? w.week : null, region: typeof w.region === 'string' ? w.region : null,
      kills: num(w.kills), gathers: num(w.gathers), events: num(w.events), claimed: w.claimed === true,
    };
  }
}
