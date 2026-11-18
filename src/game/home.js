// The kampong home: a plot in Kranji Farmlands you can buy and build up. Once
// it's yours it has a storage chest (its own store, separate from the bank), a
// cooking range, a fire that never goes out, farm patches, a trophy wall of
// your boss kills and rare finds, and a teleport home with a cooldown.
// Upgrades cost coins and materials (from your pack first, then the bank):
// a bigger chest, a better range (it lends Cooking unlock bonuses, read by
// skillunlocks.js through the range's `homeFx`), more patches, decor, and a
// faster-recharging teleport.
//
// Everything stands on ordinary world objects (range, fire, farm_patch, lamp,
// flower, fence, mascot_statue) plus three of its own (home_plot, home_chest,
// home_trophy in objects.js, borrowing existing pictures). They are placed at
// run time on a free patch of ground near the anchor below, so world.js and its
// seeded layout are left alone. Saved as game.home (save.js), optional on load.
import { getItem, ITEMS } from '../data/items.js';
import { ALL_BOSS_IDS, getNpc } from '../data/npcs.js';
import { teleportPlayer } from './skillunlocks.js';

export const HOME_PRICE = 25000;
// The plot is the first free 9 x 8 patch of open ground found around here
// (just east of Kranji Village; the search is deterministic, so it's the same
// patch every time the game boots).
export const HOME_ANCHOR = { x: 468, y: 124 };
export const HOME_W = 9, HOME_H = 8;

// Each upgrade line: tier 0 comes with the plot, the rest are bought in order.
// cost: { coins, items: { id: qty } }.
export const HOME_UPGRADES = {
  storage: { name: 'Storage chest', tiers: [
    { name: 'Wooden chest', desc: 'Holds 24 kinds of item', cap: 24 },
    { name: 'Teak chest', desc: 'Holds 48 kinds of item', cap: 48, cost: { coins: 15000, items: { teak_logs: 40, iron_bar: 20 } } },
    { name: 'Granite strongbox', desc: 'Holds 96 kinds of item', cap: 96, cost: { coins: 60000, items: { granite: 30, steel_bar: 40 } } },
  ] },
  range: { name: 'Cooking range', tiers: [
    { name: 'Clay range', desc: 'A plain range' },
    { name: 'Brick range', desc: '+5% chance a dish keeps its ingredients', fx: { save: 0.05 }, cost: { coins: 10000, items: { clay: 50, iron_bar: 10 } } },
    { name: 'Hawker range', desc: '+10% ingredients kept and 5% chance to cook twice', fx: { save: 0.10, quick: 0.05 }, cost: { coins: 40000, items: { granite: 20, mithril_bar: 20 } } },
  ] },
  patches: { name: 'Farm patches', tiers: [
    { name: 'Two patches', desc: 'Two farm patches by the house', count: 2 },
    { name: 'Four patches', desc: 'Two more patches', count: 4, cost: { coins: 8000, items: { oak_logs: 30 } } },
    { name: 'Six patches', desc: 'Two more patches', count: 6, cost: { coins: 30000, items: { willow_logs: 40, bamboo: 30 } } },
  ] },
  decor: { name: 'Decor', tiers: [
    { name: 'Bare plot', desc: 'Nothing yet' },
    { name: 'Lamps and orchids', desc: 'Lamp posts and flower beds', cost: { coins: 5000, items: { iron_bar: 5 } } },
    { name: 'Mascot garden', desc: 'A mascot statue to rest at, and a fence', cost: { coins: 50000, items: { granite: 40, maple_logs: 40 } } },
  ] },
  portal: { name: 'Home teleport', tiers: [
    { name: 'Home teleport', desc: 'Recharges in 10 minutes', ticks: 1000 },
    { name: 'Swift return', desc: 'Recharges in 4 minutes', ticks: 400, cost: { coins: 25000, items: { feather: 200, teak_logs: 30 } } },
  ] },
};
export const UPGRADE_KEYS = Object.keys(HOME_UPGRADES);

// Where everything stands, as [dx, dy] from the plot's top-left corner.
const BOARD = [4, 7];
const ARRIVE = [4, 5];
const PATCHES = [[1, 4], [3, 4], [5, 4], [7, 4], [2, 6], [6, 6]];
const DECOR = [
  [],
  [['lamp', 0, 0], ['lamp', 8, 0], ['flower', 0, 3], ['flower', 8, 3], ['flower', 0, 6], ['flower', 8, 6]],
  [['mascot_statue', 4, 2], ['fence', 0, 7], ['fence', 8, 7]],
];

/** The first free HOME_W x HOME_H patch of open ground around the anchor: { x, y } or null. */
export function findPlot(world, anchor = HOME_ANCHOR) {
  const free = (x0, y0) => {
    for (let y = y0; y < y0 + HOME_H; y++) for (let x = x0; x < x0 + HOME_W; x++) {
      if (!world.inBounds(x, y) || world.isBlocked(x, y) || world.objectAt(x, y)) return false;
    }
    return true;
  };
  for (let r = 0; r <= 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (free(anchor.x + dx, anchor.y + dy)) return { x: anchor.x + dx, y: anchor.y + dy };
    }
  }
  return null;
}

const costText = (cost) => [cost.coins ? `${cost.coins.toLocaleString('en-GB')} coins` : '',
  ...Object.entries(cost.items || {}).map(([id, n]) => `${n} ${getItem(id).name.toLowerCase()}`)].filter(Boolean).join(', ');
export { costText };

export class Home {
  constructor(game) {
    this.game = game;
    this.owned = false;
    this.tiers = Object.fromEntries(UPGRADE_KEYS.map((k) => [k, 0]));
    this.chest = [];        // [{ id, qty }], its own store
    this.tpReady = 0;       // game tick the home teleport is ready again
    this.origin = findPlot(game.world);
    // The plot's board stands there from the start: it's where you buy it.
    if (this.origin) this._put('home_plot', ...BOARD);
  }

  tile(dx, dy) { return { x: this.origin.x + dx, y: this.origin.y + dy }; }

  /** Place an object unless that one is already there; returns it. */
  _put(objId, dx, dy, extra = {}) {
    const { x, y } = this.tile(dx, dy);
    const w = this.game.world;
    const there = w.objectAt(x, y);
    if (there?.objId === objId) { Object.assign(there, extra); return there; }
    if (there) return null;
    return w.addObject(objId, x, y, extra);
  }

  /** Put up everything the plot's tiers call for (never takes anything down: tiers only rise). */
  refresh() {
    if (!this.owned || !this.origin) return;
    this._put('home_chest', 1, 1);
    this._put('range', 3, 1, { home: true, homeFx: HOME_UPGRADES.range.tiers[this.tiers.range].fx || null });
    const fire = this._put('fire', 5, 1, { home: true });
    if (fire) fire.lifetime = Infinity;   // the hearth never burns out
    this._put('home_trophy', 7, 1);
    const n = HOME_UPGRADES.patches.tiers[this.tiers.patches].count;
    for (const [dx, dy] of PATCHES.slice(0, n)) this._put('farm_patch', dx, dy, { home: true });
    this.game._farms = null;   // the farm tick caches its patch list
    for (let t = 1; t <= this.tiers.decor; t++) for (const [id, dx, dy] of DECOR[t]) this._put(id, dx, dy);
  }

  // ---------------- Buying and upgrades ----------------
  /** Can the player pay this? Counts the pack and the bank. */
  canPay(cost = {}) {
    const g = this.game;
    if ((cost.coins || 0) > g.inventory.count('coins')) return false;
    return Object.entries(cost.items || {}).every(([id, n]) => g.inventory.count(id) + g.bank.count(id) >= n);
  }
  _pay(cost = {}) {
    const g = this.game;
    if (cost.coins) g.inventory.remove('coins', cost.coins);
    for (const [id, n] of Object.entries(cost.items || {})) {
      const fromBag = Math.min(n, g.inventory.count(id));
      if (fromBag) g.inventory.remove(id, fromBag);
      if (n - fromBag) g.bank.withdraw(id, n - fromBag);
    }
  }

  buy() {
    const g = this.game;
    if (this.owned) { g.msg('This plot is already yours.'); return false; }
    if (!this.origin) { g.msg('There is no room for a house here.'); return false; }
    if (!this.canPay({ coins: HOME_PRICE })) { g.msg(`The plot costs ${HOME_PRICE.toLocaleString('en-GB')} coins.`); return false; }
    this._pay({ coins: HOME_PRICE });
    this.owned = true;
    this.refresh();
    g.banner?.('<span class="big">Your kampong home</span>The Kranji plot is yours: a chest, a range, a hearth and farm patches');
    g.msg('You buy the Kranji plot. Visit the board for upgrades; teleport home from the house button by the map.', 'level');
    g.bus.emit('home');
    g.saveSoon = true;
    return true;
  }

  /** The next tier of an upgrade line, or null at the top. */
  nextTier(key) { return HOME_UPGRADES[key]?.tiers[this.tiers[key] + 1] || null; }

  upgrade(key) {
    const g = this.game, next = this.nextTier(key);
    if (!this.owned) { g.msg('Buy the plot first.'); return false; }
    if (!next) { g.msg('That is as good as it gets.'); return false; }
    if (!this.canPay(next.cost)) { g.msg(`You need ${costText(next.cost)}.`); return false; }
    this._pay(next.cost);
    this.tiers[key]++;
    this.refresh();
    g.msg(`Home upgrade: ${next.name}. ${next.desc}.`, 'level');
    g.bus.emit('home');
    g.saveSoon = true;
    return true;
  }

  // ---------------- The storage chest ----------------
  get capacity() { return HOME_UPGRADES.storage.tiers[this.tiers.storage].cap; }
  count(id) { return this.chest.find((e) => e.id === id)?.qty || 0; }

  /** Move up to `qty` of an item from the pack into the chest; returns how many. */
  deposit(id, qty = Infinity) {
    const g = this.game;
    if (!this.owned) return 0;
    const have = g.inventory.count(id);
    const n = Math.min(have, qty);
    if (n <= 0) return 0;
    let e = this.chest.find((x) => x.id === id);
    if (!e) {
      if (this.chest.length >= this.capacity) { g.msg(`Your chest is full (${this.capacity} kinds). Upgrade it at the board.`); return 0; }
      e = { id, qty: 0 };
      this.chest.push(e);
    }
    g.inventory.remove(id, n);
    e.qty += n;
    g.bus.emit('home');
    return n;
  }

  /** Move up to `qty` from the chest into the pack (as much as fits); returns how many. */
  withdraw(id, qty = Infinity) {
    const g = this.game;
    const e = this.chest.find((x) => x.id === id);
    if (!e) return 0;
    const n = Math.min(e.qty, qty, Math.max(0, g.inventory.canAdd(id, Math.min(e.qty, qty))));
    if (n <= 0) { g.msg('Your pack is full.'); return 0; }
    g.inventory.add(id, n);
    e.qty -= n;
    if (e.qty <= 0) this.chest = this.chest.filter((x) => x !== e);
    g.bus.emit('home');
    return n;
  }

  // ---------------- Teleport home ----------------
  get tpTicks() { return HOME_UPGRADES.portal.tiers[this.tiers.portal].ticks; }
  tpWait() { return Math.max(0, this.tpReady - (this.game.tickCount || 0)); }

  teleport() {
    const g = this.game;
    if (!this.owned) { g.msg('You have no home to go to yet: buy the plot in Kranji Farmlands.'); return false; }
    if (!g.player.alive || g.waves?.active) { g.msg("You can't teleport home right now."); return false; }
    const wait = this.tpWait();
    if (wait > 0) { g.msg(`Your home teleport needs ${Math.ceil(wait * 0.6)}s more to recharge.`); return false; }
    const t = this.tile(...ARRIVE);
    if (!teleportPlayer(g, t.x, t.y, 'You teleport home to your kampong.')) return false;
    this.tpReady = (g.tickCount || 0) + this.tpTicks;
    return true;
  }

  // ---------------- The trophy wall ----------------
  /** { bosses: [{ id, name, kills }] most kills first, rares: [{ id, name }] }:
   *  your boss kills, and the bosses' signature weapons you own (worn, carried,
   *  banked or in the chest). */
  trophies() {
    const g = this.game;
    const bosses = ALL_BOSS_IDS.filter((id) => (g.kills?.[id] || 0) > 0)
      .map((id) => ({ id, name: getNpc(id).name, kills: g.kills[id] }))
      .sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
    const owned = new Set([...g.inventory.slots.filter(Boolean).map((s) => s.id), ...g.bank.items.map((e) => e.id),
      ...Object.values(g.equipment.slots || {}).filter(Boolean), ...this.chest.map((e) => e.id)]);
    const rares = [...owned].filter((id) => ITEMS[id]?.signature).map((id) => ({ id, name: getItem(id).name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { bosses, rares };
  }

  // ---------------- Saving ----------------
  serialize() {
    return { owned: this.owned, tiers: { ...this.tiers }, chest: this.chest.map((e) => ({ id: e.id, qty: e.qty })), tpWait: this.tpWait() };
  }

  /** Load a saved home (older saves have none: no house yet). */
  load(data) {
    if (!data || typeof data !== 'object') return;
    this.owned = data.owned === true;
    for (const k of UPGRADE_KEYS) {
      const t = data.tiers?.[k];
      this.tiers[k] = Number.isInteger(t) ? Math.max(0, Math.min(HOME_UPGRADES[k].tiers.length - 1, t)) : 0;
    }
    this.chest = Array.isArray(data.chest) ? data.chest.filter((e) => e && ITEMS[e.id] && e.qty > 0).map((e) => ({ id: e.id, qty: Math.floor(e.qty) })) : [];
    this.tpReady = (this.game.tickCount || 0) + (typeof data.tpWait === 'number' && data.tpWait > 0 ? Math.floor(data.tpWait) : 0);
    this.refresh();
    this.game.bus.emit('home');
  }
}
