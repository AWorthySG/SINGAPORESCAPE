// The kampong home: a plot in Kranji Farmlands you can buy and build up. Once
// it's yours it has a storage chest (its own store, separate from the bank), a
// cooking range, a fire that never goes out, farm patches, a trophy wall of
// your boss kills and rare finds, and a teleport home with a cooldown.
// Everything after that is built with Construction (src/data/construction.js),
// room by room in the Build window (homeui.js): each build needs a
// Construction level and a hammer, costs planks, nails, bricks or furniture
// (from your pack first, then the bank) and some coins, and pays Construction
// XP. The rooms and their perks:
//   Parlour      Focus refills fast while you're home; the chest; a bank chest
//   Kitchen      the range, which lends Cooking unlock bonuses (`homeFx`, read
//                by skillunlocks.js)
//   Workshop     a workbench (saw and build at home), an anvil, a crafting
//                table and fletching bench, then kept materials at all of them
//   Altar room   offer bones at home for up to the monument's Prayer XP
//   Bedroom      Rested XP builds faster while you're away (playbalance.js)
//   Portal room  teleports to the MRT of any region you've visited, and a
//                faster teleport home
//   Garden       more farm patches, and decor
//   Trophy hall  a little extra damage to bosses (Game.outsideBonuses)
//
// Everything stands on ordinary world objects (range, fire, farm_patch, anvil,
// crafting_table, fletching_bench, lamp, flower, fence, mascot_statue) plus the
// home's own (home_* in objects.js, each with its own picture). They are
// placed at run time on a free patch of ground near the anchor below, so
// world.js and its seeded layout are left alone. Saved as game.home (save.js),
// optional on load: a save from before Construction keeps every tier it bought.
import { getItem, ITEMS } from '../data/items.js';
import { ALL_BOSS_IDS, getNpc } from '../data/npcs.js';
import { teleportPlayer } from './skillunlocks.js';
import { makeXp } from './skilling.js';
import { TICK_MS } from '../config.js';
import { FOCUS_ACTIVE_REFILL, FOCUS_MAX_MS } from './playbalance.js';

export const HOME_PRICE = 25000;
// The plot is the first free 9 x 8 patch of open ground found around here
// (just east of Kranji Village; the search is deterministic, so it's the same
// patch every time the game boots).
export const HOME_ANCHOR = { x: 468, y: 124 };
export const HOME_W = 9, HOME_H = 8;

// Each upgrade line: tier 0 comes with the plot, the rest are built in order
// with Construction. A tier's `level` is the Construction level it needs, its
// `xp` the Construction XP the build pays (as listed, times the skill's making
// multiple: about ten pieces of furniture of its tier), and its cost is
// { coins, items: { id: qty } }, materials from the pack first, then the bank.
// The first five lines (storage to portal) were bought with coins and raw
// materials before Construction: their tiers and perks are unchanged, so a
// save keeps everything it built; only the price of the next tier moved to
// planks, nails and bricks (with fewer coins).
export const HOME_UPGRADES = {
  storage: { name: 'Storage chest', tiers: [
    { name: 'Wooden chest', desc: 'Holds 24 kinds of item', cap: 24 },
    { name: 'Teak chest', desc: 'Holds 48 kinds of item', cap: 48, level: 30, xp: 900, cost: { coins: 5000, items: { teak_plank: 20, steel_nails: 30 } } },
    { name: 'Granite strongbox', desc: 'Holds 96 kinds of item', cap: 96, level: 55, xp: 1600, cost: { coins: 20000, items: { granite: 30, mahogany_plank: 20, mithril_nails: 40 } } },
    { name: 'Chengal vault', desc: 'Holds 160 kinds of item', cap: 160, level: 160, xp: 7200, cost: { coins: 150000, items: { chengal_plank: 40, jade_nails: 60, brick: 100 } } },
    { name: 'Heartwood strongroom', desc: 'Holds 240 kinds of item', cap: 240, level: 300, xp: 17700, cost: { coins: 600000, items: { heartwood_plank: 40, eternal_nails: 60, brick: 150 } } },
  ] },
  range: { name: 'Cooking range', tiers: [
    { name: 'Clay range', desc: 'A plain range' },
    { name: 'Brick range', desc: '+5% chance a dish keeps its ingredients', fx: { save: 0.05 }, level: 10, xp: 300, cost: { coins: 3000, items: { brick: 40, iron_nails: 16 } } },
    { name: 'Hawker range', desc: '+10% ingredients kept and 5% chance to cook twice', fx: { save: 0.10, quick: 0.05 }, level: 45, xp: 1400, cost: { coins: 15000, items: { brick: 80, granite: 20, mithril_nails: 30 } } },
    { name: 'Chengal kitchen', desc: '+12% ingredients kept and 8% chance to cook twice', fx: { save: 0.12, quick: 0.08 }, level: 160, xp: 7200, cost: { coins: 120000, items: { chengal_plank: 30, jade_nails: 45, brick: 150 } } },
    { name: 'Heartwood kitchen', desc: '+15% ingredients kept and 10% chance to cook twice', fx: { save: 0.15, quick: 0.10 }, level: 300, xp: 17700, cost: { coins: 500000, items: { heartwood_plank: 30, eternal_nails: 45, brick: 200 } } },
  ] },
  patches: { name: 'Farm patches', tiers: [
    { name: 'Two patches', desc: 'Two farm patches by the house', count: 2 },
    { name: 'Four patches', desc: 'Two more patches', count: 4, level: 5, xp: 150, cost: { coins: 3000, items: { plank: 20, bronze_nails: 20 } } },
    { name: 'Six patches', desc: 'Two more patches', count: 6, level: 25, xp: 600, cost: { coins: 10000, items: { oak_plank: 30, iron_nails: 30 } } },
  ] },
  decor: { name: 'Decor', tiers: [
    { name: 'Bare plot', desc: 'Nothing yet' },
    { name: 'Lamps and orchids', desc: 'Lamp posts and flower beds', level: 8, xp: 200, cost: { coins: 2000, items: { plank: 10, iron_bar: 5 } } },
    { name: 'Mascot garden', desc: 'A mascot statue to rest at, and a fence', level: 40, xp: 1200, cost: { coins: 20000, items: { granite: 40, teak_plank: 20, brick: 40 } } },
  ] },
  portal: { name: 'Home teleport', tiers: [
    { name: 'Home teleport', desc: 'Recharges in 10 minutes', ticks: 1000 },
    { name: 'Swift return', desc: 'Recharges in 4 minutes', ticks: 400, level: 35, xp: 1000, cost: { coins: 10000, items: { feather: 200, teak_plank: 20 } } },
    { name: 'Homing lantern', desc: 'Recharges in 2 minutes', ticks: 200, level: 130, xp: 5300, cost: { coins: 100000, items: { meranti_plank: 30, orichalcum_nails: 30 } } },
  ] },
  // ---- Construction's own rooms ----
  // `focus`: at home, Focus refills this many times as fast as hands-on play.
  parlour: { name: 'Parlour', tiers: [
    { name: 'Bare floor', desc: 'Nothing to sit on yet' },
    { name: 'Rattan chairs', desc: 'At home, Focus refills as fast as hands-on play', focus: 1, level: 5, xp: 180, cost: { coins: 1000, items: { wooden_stool: 4, plank: 6 } } },
    { name: 'Teak settee', desc: 'At home, Focus refills twice as fast as hands-on play', focus: 2, level: 35, xp: 900, cost: { coins: 8000, items: { oak_chair: 4, teak_table: 1 } } },
    { name: 'Peranakan parlour', desc: 'At home, Focus refills three times as fast as hands-on play', focus: 3, level: 80, xp: 2900, cost: { coins: 40000, items: { yew_bookcase: 2, mahogany_cabinet: 1, teak_table: 1 } } },
    { name: 'Starwood salon', desc: 'At home, Focus refills four times as fast as hands-on play', focus: 4, level: 200, xp: 9700, cost: { coins: 300000, items: { starwood_lantern_stand: 2, tok_panjang_table: 1 } } },
  ] },
  bank: { name: 'Bank chest', tiers: [
    { name: 'No bank chest', desc: 'Your bank is in town' },
    { name: 'Bank chest', desc: 'Your bank, right here at home', level: 40, xp: 1400, cost: { coins: 25000, items: { teak_plank: 20, steel_nails: 40, iron_bar: 10 } } },
  ] },
  // `fx`: the Master workshop's chance that a make at a home station keeps its materials.
  workshop: { name: 'Workshop', tiers: [
    { name: 'Empty shed', desc: 'Nothing to work at yet' },
    { name: 'Workbench', desc: 'Saw planks and build furniture at home', level: 1, xp: 120, cost: { coins: 500, items: { plank: 8, bronze_nails: 15 } } },
    { name: 'Home anvil', desc: 'An anvil for Smithing (and nails) at home', level: 25, xp: 600, cost: { coins: 6000, items: { oak_plank: 20, iron_bar: 20, brick: 20 } } },
    { name: 'Crafting corner', desc: 'A crafting table and a fletching bench at home', level: 55, xp: 1600, cost: { coins: 20000, items: { mahogany_plank: 20, mithril_nails: 30 } } },
    { name: 'Master workshop', desc: '+5% chance a make at a home station keeps its materials', fx: { save: 0.05 }, level: 130, xp: 5300, cost: { coins: 120000, items: { meranti_plank: 30, orichalcum_nails: 45, meranti_screen: 1 } } },
  ] },
  // `mult`: offering bones at the home altar pays this many times their XP (an A-Worthy Monument: ALTAR_XP_MULT, 2.5).
  altar: { name: 'Altar', tiers: [
    { name: 'No altar', desc: 'Offer bones at an A-Worthy Monument' },
    { name: 'Offering table', desc: 'Offer bones at home for 1.5x Prayer XP', mult: 1.5, level: 20, xp: 500, cost: { coins: 4000, items: { oak_plank: 12, iron_nails: 16, brick: 10 } } },
    { name: 'Teak altar', desc: 'Offer bones at home for 2x Prayer XP', mult: 2, level: 55, xp: 1600, cost: { coins: 20000, items: { teak_plank: 30, mithril_nails: 30, brick: 40 } } },
    { name: 'Seraya altar', desc: 'Offer bones at home for 2.25x Prayer XP', mult: 2.25, level: 110, xp: 3900, cost: { coins: 90000, items: { seraya_plank: 30, obsidian_nails: 30 } } },
    { name: 'Moonwood altar', desc: 'Offer bones at home for 2.5x Prayer XP, as at a monument', mult: 2.5, level: 250, xp: 13100, cost: { coins: 400000, items: { moonwood_plank: 30, celestial_nails: 30 } } },
  ] },
  // `rested`: time away builds Rested XP this much faster (playbalance.js applyAway).
  bedroom: { name: 'Bedroom', tiers: [
    { name: 'No bed', desc: 'You sleep on the floor' },
    { name: 'Sleeping mat', desc: 'Rested XP builds 25% faster while you are away', rested: 0.25, level: 10, xp: 250, cost: { coins: 2000, items: { plank: 10, bronze_nails: 10, wooden_stool: 1 } } },
    { name: 'Teak bed', desc: 'Rested XP builds 50% faster while you are away', rested: 0.5, level: 40, xp: 1400, cost: { coins: 12000, items: { teak_plank: 20, steel_nails: 30, oak_chair: 1 } } },
    { name: 'Four-poster bed', desc: 'Rested XP builds 75% faster while you are away', rested: 0.75, level: 75, xp: 2900, cost: { coins: 50000, items: { magic_plank: 20, rune_nails: 30, yew_bookcase: 1 } } },
    { name: 'Moonwood bed', desc: 'Rested XP builds twice as fast while you are away', rested: 1, level: 250, xp: 13100, cost: { coins: 400000, items: { moonwood_plank: 30, celestial_nails: 30, moonwood_wayang_stage: 1 } } },
  ] },
  // `ticks`: the portal arch's recharge, in game ticks.
  portals: { name: 'Portal arch', tiers: [
    { name: 'No portals', desc: 'Travel by MRT' },
    { name: 'Portal frame', desc: 'Teleport to the MRT of any region you have visited; recharges in 5 minutes', ticks: 500, level: 45, xp: 1400, cost: { coins: 30000, items: { mahogany_plank: 20, mithril_nails: 30, brick: 30 } } },
    { name: 'Carved portal arch', desc: 'Region portals recharge in 3 minutes', ticks: 300, level: 80, xp: 2900, cost: { coins: 80000, items: { magic_plank: 30, rune_nails: 30 } } },
    { name: 'Starwood portal', desc: 'Region portals recharge in 90 seconds', ticks: 150, level: 200, xp: 9700, cost: { coins: 300000, items: { starwood_plank: 30, starmetal_nails: 30 } } },
  ] },
  // `boss`: extra damage to bosses, in percent, while the trophies are on show.
  trophy: { name: 'Trophy hall', tiers: [
    { name: 'Trophy wall', desc: 'Your boss kills and rare finds, on show' },
    { name: 'Trophy cabinet', desc: '+2% damage to bosses', boss: 2, level: 30, xp: 900, cost: { coins: 8000, items: { teak_plank: 15, steel_nails: 20 } } },
    { name: 'Trophy hall', desc: '+4% damage to bosses', boss: 4, level: 65, xp: 2000, cost: { coins: 40000, items: { yew_plank: 20, adamant_nails: 30, yew_bookcase: 1 } } },
    { name: 'Hall of legends', desc: '+6% damage to bosses', boss: 6, level: 160, xp: 7200, cost: { coins: 200000, items: { chengal_plank: 30, jade_nails: 30, tok_panjang_table: 1 } } },
  ] },
};
// The Build window's room cards (homeui.js), each with its hotspots (upgrade lines), in order.
export const ROOMS = [
  { id: 'parlour', name: 'Parlour', icon: '🛋️', lines: ['parlour', 'storage', 'bank'] },
  { id: 'kitchen', name: 'Kitchen', icon: '🍳', lines: ['range'] },
  { id: 'workshop', name: 'Workshop', icon: '🔨', lines: ['workshop'] },
  { id: 'altar', name: 'Altar room', icon: '🕯️', lines: ['altar'] },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️', lines: ['bedroom'] },
  { id: 'portals', name: 'Portal room', icon: '🌀', lines: ['portals', 'portal'] },
  { id: 'garden', name: 'Garden', icon: '🌱', lines: ['patches', 'decor'] },
  { id: 'trophy', name: 'Trophy hall', icon: '🏆', lines: ['trophy'] },
];
export const UPGRADE_KEYS = Object.keys(HOME_UPGRADES);

// Where everything stands, as [dx, dy] from the plot's top-left corner.
const BOARD = [4, 7];
const ARRIVE = [4, 5];
const PATCHES = [[1, 4], [3, 4], [5, 4], [7, 4], [2, 6], [6, 6]];
// Construction's furniture: [line, from tier, objId, dx, dy]. Rows 2, 3 and 6
// leave column 4 (the path from where you arrive to the board) and the tiles
// round the chest and range clear.
const BUILT = [
  ['parlour', 1, 'home_parlour', 6, 2],
  ['workshop', 1, 'home_workbench', 1, 3], ['workshop', 2, 'anvil', 2, 3],
  ['workshop', 3, 'crafting_table', 6, 3], ['workshop', 3, 'fletching_bench', 7, 3],
  ['bedroom', 1, 'home_bed', 1, 6], ['altar', 1, 'home_altar', 3, 6],
  ['bank', 1, 'home_bank', 5, 6], ['portals', 1, 'home_portal', 7, 6],
];
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
    this.portalReady = 0;   // game tick the portal arch is ready again
    this.origin = findPlot(game.world, game.world.authoredTile(HOME_ANCHOR));
    game.bus?.on?.('tick', () => this.tick());
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
    // Construction's furniture, and the Master workshop's kept materials at the home stations.
    const shop = HOME_UPGRADES.workshop.tiers[this.tiers.workshop].fx || null;
    for (const [k, from, id, dx, dy] of BUILT) {
      if (this.tiers[k] < from) continue;
      this._put(id, dx, dy, { home: true, ...(k === 'workshop' ? { homeFx: shop } : {}) });
    }
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
    g.bus.emit('sfx', 'interact:buy');
    g.bus.emit('home');
    g.saveSoon = true;
    return true;
  }

  /** The next tier of an upgrade line, or null at the top. */
  nextTier(key) { return HOME_UPGRADES[key]?.tiers[this.tiers[key] + 1] || null; }

  /** Why the next tier of a line can't be built now, or '' when it can. */
  whyNot(key) {
    const g = this.game, next = this.nextTier(key);
    if (!this.owned) return 'Buy the plot first.';
    if (!next) return 'That is as good as it gets.';
    if (g.skills.level('construction') < (next.level || 1)) return `You need a Construction level of ${next.level} to build that.`;
    if (!g.hasTool?.('hammer')) return 'You need a hammer to build.';
    if (!this.canPay(next.cost)) return `You still need ${costText(this.shortOf(next.cost))}.`;
    return '';
  }

  /** What's missing for a cost (pack and bank counted): { coins, items }. */
  shortOf(cost = {}) {
    const g = this.game, items = {};
    for (const [id, n] of Object.entries(cost.items || {})) {
      const have = g.inventory.count(id) + g.bank.count(id);
      if (have < n) items[id] = n - have;
    }
    return { coins: Math.max(0, (cost.coins || 0) - g.inventory.count('coins')), items };
  }

  /** Build the next tier of an upgrade line (a Construction build). */
  upgrade(key) {
    const g = this.game, next = this.nextTier(key);
    const why = this.whyNot(key);
    if (why) { g.msg(why); return false; }
    this._pay(next.cost);
    this.tiers[key]++;
    this.refresh();
    const xp = makeXp(g, 'construction', next.xp || 0);
    if (xp > 0) g.skills.addXp('construction', xp);
    g.spawnSparkle?.(g.player, '#e4c48e', 14);
    g.bus.emit('sfx', 'make:construction');
    g.msg(`You build: ${next.name}. ${next.desc}.`, 'level');
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
    g.bus.emit('sfx', 'interact:deposit');
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
    g.bus.emit('sfx', 'interact:withdraw');
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

  // ---------------- Room perks ----------------
  _tier(key) { return HOME_UPGRADES[key].tiers[this.owned ? this.tiers[key] : 0]; }
  /** Offering bones at the home altar: this many times their XP (1 with no altar). */
  altarMult() { return this._tier('altar').mult || 1; }
  /** The bedroom: Rested XP builds this share faster while you're away. */
  restedBonus() { return this._tier('bedroom').rested || 0; }
  /** The trophy hall: extra damage to bosses, in percent. */
  trophyBoss() { return this._tier('trophy').boss || 0; }
  /** Is the player on the plot? */
  isHome(x = this.game.player.x, y = this.game.player.y) {
    const o = this.origin;
    return !!o && x >= o.x && x < o.x + HOME_W && y >= o.y && y < o.y + HOME_H;
  }

  /** Each game tick: the parlour refills your Focus while you're at home. */
  tick() {
    const f = this.owned && this._tier('parlour').focus, pl = this.game.play;
    if (!f || !pl || pl.focus >= FOCUS_MAX_MS || !this.isHome()) return;
    pl.focus = Math.min(FOCUS_MAX_MS, pl.focus + TICK_MS * FOCUS_ACTIVE_REFILL * f);
  }

  // ---------------- The portal arch ----------------
  get portalTicks() { return this._tier('portals').ticks || 0; }
  portalWait() { return Math.max(0, this.portalReady - (this.game.tickCount || 0)); }
  /** The MRT stations the portal arch can take you to: those in regions you've visited. */
  portalTargets() {
    const g = this.game;
    return g.world.stations.filter((st) => {
      const z = g.world.zoneAt?.(st.x, st.y);
      return z && g.zonesVisited?.has(z.name);
    });
  }
  /** Step through the portal arch to an MRT station (by id). */
  portalTo(stationId) {
    const g = this.game;
    if (!this.portalTicks) { g.msg('Build a portal arch in your portal room first.'); return false; }
    const st = this.portalTargets().find((s) => s.id === stationId);
    if (!st) { g.msg('Your portal only opens to regions you have visited.'); return false; }
    if (!g.player.alive || g.waves?.active) { g.msg("You can't use the portal right now."); return false; }
    const wait = this.portalWait();
    if (wait > 0) { g.msg(`Your portal arch needs ${Math.ceil(wait * 0.6)}s more to recharge.`); return false; }
    if (!teleportPlayer(g, st.x, st.y, `You step through the portal arch to ${st.name}.`)) return false;
    this.portalReady = (g.tickCount || 0) + this.portalTicks;
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
    return { owned: this.owned, tiers: { ...this.tiers }, chest: this.chest.map((e) => ({ id: e.id, qty: e.qty })), tpWait: this.tpWait(), portalWait: this.portalWait() };
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
    this.portalReady = (this.game.tickCount || 0) + (typeof data.portalWait === 'number' && data.portalWait > 0 ? Math.floor(data.portalWait) : 0);
    this.refresh();
    this.game.bus.emit('home');
  }
}
