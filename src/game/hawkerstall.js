// Your hawker stall (Hawkering, src/data/hawkering.js): the counter in front
// of the Marina Bay hawker centre, the queue of customers, and serving them.
//
// The counter is placed at run time on a free tile in front of the hawker
// centre landmark (as the kampong home and the lumber yards are), so world.js
// and its seeded layout are left alone. Rent it once; then stand at it and
// open up (the 'hawk' action, game.js). While it's open, each game tick:
//   - a customer may join the queue, if a counter is free and you have
//     something they can order (pack and bank: a runner fetches from the bank);
//   - everyone waiting loses a tick of patience, and at none they walk off;
//   - with auto-serve (the auto gather switch) the front customer you can
//     serve is served as soon as the last serve is done (`ticks` apart).
// By hand, tap Serve in the stall's window (hawkerui.js) instead.
//
// Saved as game.hawker (save.js): rented, reputation, best streak and totals.
// The queue is not saved: customers go home when you close up.
import { getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { RESIDENTS } from '../data/consequences.js';
import { ORDERS, ORDER_BY_ID, SIGNATURE_IDS, serviceAt, PATIENCE, CUSTOMERS, VIP_LEVEL, VIP_CHANCE, VIPS, STALL_RENT,
  PRICE_SHARE, REP_MAX, REP_PRICE, TIP_BASE, TIP_FAST, STREAK_TOP, STREAK_TIP, VIP_TIP, REP_SERVE, REP_LOST } from '../data/hawkering.js';
import { runSkillAction, unlockFx } from './skillunlocks.js';

// Hawkering pays each serve's listed XP times this multiple at your level,
// eased between the listed levels on a log scale (as the making skills' are,
// skilling.js makeXpMult) and held past the last. Fitted with
// `node tools/balance/hawkerxp.mjs --fit` so an hour of auto-serve at your
// level pays the making skills' (and so gathering's) hour.
export const HAWKER_XP_MULT = [[1, 200], [10, 195], [30, 200], [60, 250], [99, 240], [150, 360], [200, 580], [300, 990]];
export function hawkerXpMult(lvl) {
  const t = HAWKER_XP_MULT;
  if (lvl <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    const [l1, m1] = t[i];
    if (lvl > l1) continue;
    const [l0, m0] = t[i - 1];
    return m0 * (m1 / m0) ** (Math.log(lvl / l0) / Math.log(l1 / l0));
  }
  return t[t.length - 1][1];
}

// The counter's spot: a free tile in front of the hawker centre, with a free
// tile below it to stand on.
const ANCHOR_DY = 2;
export function findStallSpot(world) {
  const hc = world.objects.find((o) => o.objId === 'hawker_centre');
  if (!hc) return null;
  const zone = world.zoneAt?.(hc.x, hc.y)?.name;
  const w = hc.def.footprint?.[0] || 1;
  const ok = (x, y) => world.inBounds(x, y) && !world.isBlocked(x, y) && !world.objectAt(x, y) && (!zone || world.zoneAt?.(x, y)?.name === zone);
  const ax = hc.x + Math.floor(w / 2), ay = hc.y + ANCHOR_DY;
  for (let r = 0; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = ax + dx, y = ay + dy;
      if (y > hc.y && ok(x, y) && ok(x, y + 1)) return { x, y };
    }
  }
  return null;
}

export class HawkerStall {
  constructor(game) {
    this.game = game;
    this.rented = false;
    this.rep = 0;           // reputation, 0..REP_MAX
    this.served = 0;        // customers served, ever
    this.earned = 0;        // coins earned, ever (prices and tips)
    this.bestStreak = 0;
    this.streak = 0;
    this.queue = [];        // [{ npcId, name, order, qty, patience, max, vip, line }]
    this.t = 0;             // ticks the stall has been open this time
    this.nextArrival = 0;
    this.serveReady = 0;
    this.lastTick = -1e9;   // the game tick the stall last ran (a gap means it was closed)
    this.today = { served: 0, coins: 0, tips: 0, walked: 0 };   // this session (not saved)
    const at = game.world?.addObject ? findStallSpot(game.world) : null;
    this.obj = at ? game.world.addObject('hawker_counter', at.x, at.y) : null;
  }

  get level() { return this.game.skills.level('hawkering'); }
  service() { return serviceAt(this.level); }
  /** Is the stall open: you at it, serving? */
  isOpen() { const a = this.game.player?.action; return a?.type === 'hawk' && a.obj === this.obj; }
  /** How many of a dish you can serve from: your pack and your bank. */
  have(id) { return this.game.inventory.count(id) + this.game.bank.count(id); }
  /** The orders you could take now: your level allows them and you have the dish. */
  menu() {
    const lvl = this.level;
    return ORDERS.filter((o) => o.level <= lvl && this.have(o.id) > 0);
  }
  /** Coins a customer pays for `qty` of a dish (before the tip). */
  price(id, qty = 1) {
    return Math.max(1, Math.round((getItem(id).value || 1) * PRICE_SHARE * (1 + REP_PRICE * this.rep / REP_MAX))) * qty;
  }
  /** The tip on a price: more for a short wait, a long streak, from a VIP, and with the skill's unlocks (`tip`). */
  tip(price, c) {
    const fast = c ? c.patience / c.max : 1;
    return Math.round(price * (TIP_BASE + TIP_FAST * fast) * (1 + STREAK_TIP * Math.min(this.streak, STREAK_TOP) / STREAK_TOP) * (c?.vip ? VIP_TIP : 1)
      * (1 + (unlockFx(this.game, 'hawkering').tip || 0)));
  }
  /** XP one serve of `qty` of a dish pays (before the life-skill rates Skills.addXp adds). */
  xpFor(id, qty = 1) { return (ORDER_BY_ID[id]?.xp || 0) * qty * hawkerXpMult(this.level); }

  // ---------------- Renting and opening ----------------
  rent() {
    const g = this.game;
    if (this.rented) { g.msg('The stall is already yours.'); return false; }
    if (g.inventory.count('coins') < STALL_RENT) { g.msg(`Renting the stall costs ${STALL_RENT.toLocaleString('en-GB')} coins.`); return false; }
    g.inventory.remove('coins', STALL_RENT);
    this.rented = true;
    g.msg('You rent a stall at the Marina Bay hawker centre. Stand at the counter and open up!', 'level');
    g.bus.emit('hawker');
    g.saveSoon = true;
    return true;
  }

  /** Walk to the counter and open up (the 'hawk' action). */
  open() {
    const g = this.game;
    if (!this.obj) return false;
    if (!this.rented) { g.msg(`Rent the stall first (${STALL_RENT.toLocaleString('en-GB')} coins).`); return false; }
    g.beginAction({ type: 'hawk', obj: this.obj }, { x: this.obj.x, y: this.obj.y }, true);
    return true;
  }

  /** The 'hawk' action's tick (game.js): run the stall while you stand at it. */
  tickAction(a) {
    const g = this.game, o = a.obj;
    if (!g._isReached({ x: o.x, y: o.y }, true)) { if (!g.player.isMoving) g.player.clearAction(); return; }
    g.player.stop();
    const now = g.tickCount || 0;
    if (now - this.lastTick > 2) this._reopen();   // it was closed: a fresh queue
    this.lastTick = now;
    this.t++;
    this._arrivals();
    this._patience();
    // Auto-serve: the front customer you can serve, when the last serve is done
    // (a Hawkering unlock's quick hands may serve a second in the same go).
    if (g.autoGather && this.t >= this.serveReady) { let n = 0; runSkillAction(g, a, () => this.serveNext(n++ > 0)); }
    g.bus.emit('hawker');   // patience bars run down (the window redraws a few times a second at most)
  }

  _reopen() {
    this.queue = [];
    this.t = 0; this.nextArrival = 0; this.serveReady = 0;
    if (this.rented) this.game.msg(this.menu().length ? 'You open your stall. Customers start to queue.' : 'You open your stall, but you have nothing to sell: bring dishes you can serve.', 'system');
    this.game.bus.emit('hawker');
  }

  /** A new customer, if a counter is free and there's something to order. */
  _arrivals() {
    const svc = this.service();
    if (this.t < this.nextArrival || this.queue.length >= svc.counters) return;
    // What's left to order, once the dishes those waiting asked for are set aside.
    const held = new Map();
    for (const c of this.queue) held.set(c.order, (held.get(c.order) || 0) + c.qty);
    const menu = this.menu().filter((o) => this.have(o.id) > (held.get(o.id) || 0));
    if (!menu.length) { this.nextArrival = this.t + 2; return; }
    const r = Math.random;
    const vip = this.level >= VIP_LEVEL && r() < VIP_CHANCE;
    // Most customers order the best dish you have; some fancy something else.
    // A VIP asks for a signature dish when you have one.
    const sig = menu.filter((o) => SIGNATURE_IDS.has(o.id));
    let order = menu[menu.length - 1];
    if (vip && sig.length) order = sig[sig.length - 1];
    else if (r() < 0.25) order = menu[Math.floor(r() * menu.length)];
    const left = this.have(order.id) - (held.get(order.id) || 0);
    const qty = vip && left >= 2 && r() < 0.5 ? 2 : 1;
    const who = vip ? VIPS[Math.floor(r() * VIPS.length)] : { id: CUSTOMERS[Math.floor(r() * CUSTOMERS.length)] };
    const max = PATIENCE * (vip ? 2 : 1);
    let name = RESIDENTS[who.id]?.name || 'Customer';   // a resident of the living world, or a townsperson
    if (!RESIDENTS[who.id]) try { name = getNpc(who.id).name; } catch { /* a missing townsperson: a plain customer */ }
    this.queue.push({ npcId: who.id, name, order: order.id, qty, patience: max, max, vip, line: who.line || '' });
    if (vip) this.game.msg(`VIP regular: ${name} wants ${qty > 1 ? `two ${getItem(order.id).name.toLowerCase()}` : getItem(order.id).name.toLowerCase()}. "${who.line}"`, 'level');
    // A busy hawker centre: a free counter fills again in a tick or two.
    this.nextArrival = this.t + 1 + (r() < 0.3 ? 1 : 0);
    this.game.bus.emit('hawker');
  }

  _patience() {
    let left = false;
    for (const c of this.queue) c.patience--;
    for (const c of this.queue.filter((x) => x.patience <= 0)) {
      this.queue = this.queue.filter((x) => x !== c);
      this.streak = 0;
      this.today.walked++;
      this.rep = Math.max(0, this.rep - REP_LOST);
      this.game.msg(`${c.name} got tired of waiting and walked off. Your streak is over.`, 'system');
      left = true;
    }
    if (left) this.game.bus.emit('hawker');
  }

  /** Serve the front customer you can serve (`quick`: a second in the same go,
   *  a skill unlock's, before the last serve is done). Returns whether more can follow. */
  serveNext(quick = false) {
    const i = this.queue.findIndex((c) => this.have(c.order) >= c.qty);
    if (i < 0) return false;
    return this.serve(i, quick);
  }

  /** Serve customer `i` in the queue: the dish from your pack (else the bank),
   *  the price and a tip in coins, Hawkering XP. False if you can't yet. */
  serve(i, quick = false) {
    const g = this.game, c = this.queue[i];
    if (!c || !this.isOpen()) return false;
    if (this.t < this.serveReady && !quick) return false;
    if (this.have(c.order) < c.qty) { g.msg(`You have no ${getItem(c.order).name.toLowerCase()} to serve.`); return false; }
    // The dish: from the pack first, then a runner fetches it from the bank.
    const fromBag = Math.min(c.qty, g.inventory.count(c.order));
    if (fromBag) g.inventory.remove(c.order, fromBag);
    if (c.qty - fromBag) g.bank.withdraw(c.order, c.qty - fromBag);
    const price = this.price(c.order, c.qty), tip = this.tip(price, c), coins = price + tip;
    if (g.inventory.canAdd('coins', coins) >= coins) g.inventory.add('coins', coins);
    else g.bank.deposit('coins', coins);   // a full pack: the takings go to the bank
    g.skills.addXp('hawkering', this.xpFor(c.order, c.qty));
    this.queue.splice(i, 1);
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.served += c.qty;
    this.earned += coins;
    this.today.served += c.qty; this.today.coins += coins; this.today.tips += tip;
    this.rep = Math.min(REP_MAX, this.rep + REP_SERVE * (c.vip ? 10 : 1));
    this.serveReady = this.t + this.service().ticks;
    if (!quick) g.bus.emit('sfx', 'make:hawker');
    g.spawnSparkle?.(g.player, '#ffd24a', c.vip ? 12 : 5);
    g.bus.emit('skillpose', { id: 'serve', prop: c.order, target: this.obj });
    g.addHitsplat?.(g.player, 0, { text: `+${coins.toLocaleString('en-GB')} coins` });
    if (c.vip) g.msg(`${c.name} is delighted: a ${tip.toLocaleString('en-GB')}-coin tip!`, 'level');
    if (this.streak > 0 && this.streak % 50 === 0) g.msg(`Serving streak: ${this.streak}! The tips keep getting better.`, 'level');
    g.bus.emit('hawker');
    g.saveSoon = true;
    return this.queue.some((x) => this.have(x.order) >= x.qty);
  }

  /** Stars for the window: reputation as 0-5. */
  stars() { return Math.round(this.rep / REP_MAX * 5 * 2) / 2; }

  // ---------------- Saving ----------------
  serialize() { return { rented: this.rented, rep: Math.round(this.rep * 100) / 100, served: this.served, earned: this.earned, bestStreak: this.bestStreak }; }
  /** Load a saved stall (older saves have none: not rented yet). */
  load(data) {
    if (!data || typeof data !== 'object') return;
    this.rented = data.rented === true;
    const num = (v, lo = 0, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
    this.rep = num(data.rep, 0, REP_MAX);
    this.served = Math.floor(num(data.served));
    this.earned = Math.floor(num(data.earned));
    this.bestStreak = Math.floor(num(data.bestStreak));
  }
}
