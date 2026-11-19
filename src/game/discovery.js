// Discovery: which encyclopedia entries you have found, and the small rewards
// for finding everything in a category. The Codex window draws it
// (src/ui/encyclopediaui.js); entries you haven't found show as silhouettes.
//
//  - Creatures and bosses: found once you defeat one (game.kills, which the
//    save already keeps: the Monster Codex works the same way).
//  - Items: found once one has been in your pack or bank. This file keeps that
//    list (game.discovery.items), filled as the pack and bank change.
//  - Regions: found once visited (game.zonesVisited, already saved).
//  - Resource zones: found once you walk in (game.discovery.places).
//  - Lore pages: found once picked up (game.story.pages, already saved).
//
// Rewards are claimed from the window (a button on a finished category), never
// handed out mid-tick, so nothing here moves the seeded test suite's rolls or
// bags. Saved as an optional field: an older save starts with what its bag,
// bank, worn gear and Collection log already hold.
import { ITEMS, getItem } from '../data/items.js';
import { ALL_MONSTER_IDS, ALL_BOSS_IDS, getNpc } from '../data/npcs.js';
import { LORE } from '../data/lore.js';
import { RESOURCE_CATS, resourceCat, itemSources } from './skillguide.js';

// What finishing a category pays: coins per entry in it (at least the floor),
// and forager's lamps (rub one for XP in a gathering skill, culling.js).
export const REWARD_COINS_EACH = 250;
export const REWARD_COINS_MIN = 2000;
export const REWARD_COINS_MAX = 250000;
export const REWARD_LAMPS = 2;

// Items the encyclopedia counts: every real item that something in the game
// gives (a node, a recipe, a drop, a shop, a reward...). Developer-only and
// retired items with no source are listed but never needed for 100%.
let _obtainable = null;
export function obtainableItems() {
  if (_obtainable) return _obtainable;
  _obtainable = Object.keys(ITEMS).filter((id) => id !== 'coins' && itemSources(id).length > 0);
  return _obtainable;
}
let _obtainableSet = null;
export const isObtainable = (id) => (_obtainableSet ||= new Set(obtainableItems())).has(id);

const attackable = (id) => getNpc(id).attackable;
const MONSTERS = [...new Set(ALL_MONSTER_IDS)].filter((id) => attackable(id) && !getNpc(id).boss);
const BOSSES = [...new Set(ALL_BOSS_IDS)].filter(attackable);

export class Discovery {
  constructor(game) {
    this.game = game;
    this.items = new Set();    // item ids that have been in your pack or bank (saved)
    this.places = new Set();   // resource zone ids walked into (saved)
    this.claimed = new Set();  // category ids whose reward is paid (saved)
    const bus = game.bus;
    bus?.on('inventory', () => this.noteSlots(game.inventory?.slots));
    bus?.on('bank', () => this.noteSlots(game.bank?.items));
    bus?.on('tick', () => this.tick());
  }

  /** Note every item in a list of slots ({ id } or null). Cheap: a bag is a few dozen slots. */
  noteSlots(slots) {
    for (const s of slots || []) if (s?.id && s.id !== 'coins' && ITEMS[s.id]) this.items.add(s.id);
  }

  /** Resource zones: the gathering module already watches which one you stand in. */
  tick() {
    if (!this._filled) { this._filled = true; this.backfill(); }   // a new character's starting kit
    const z = this.game.gathering?.zones?.current;
    if (z) this.places.add(z);
  }

  hasItem(id) { return this.items.has(id); }

  /** Everything already in reach on an older save (or a fresh load): the bag,
   *  bank and worn gear, and every Collection log entry. */
  backfill() {
    const g = this.game;
    this.noteSlots(g.inventory?.slots);
    this.noteSlots(g.bank?.items);
    for (const id of Object.values(g.equipment?.slots || {})) if (id && ITEMS[id]) this.items.add(id);
    for (const page of Object.values(g.collection?.log || {})) for (const [id, n] of Object.entries(page || {})) if (n > 0 && ITEMS[id]) this.items.add(id);
  }

  serialize() { return { items: [...this.items], places: [...this.places], claimed: [...this.claimed] }; }

  load(d) {
    const arr = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string') : []);
    this.items = new Set(arr(d?.items).filter((id) => ITEMS[id]));
    this.places = new Set(arr(d?.places));
    this.claimed = new Set(arr(d?.claimed));
    this.backfill();
  }
}

/** Every discovery category, worked out from the game: [{ id, name, icon, group,
 *  seen, total, done, claimed, reward: { coins, lamps } }]. Shelves of items
 *  are their own categories, so each has a reachable goal. */
export function discoveryCategories(game) {
  const d = game?.discovery;
  const kills = game?.kills || {};
  const out = [];
  const add = (id, name, icon, group, seenN, total) => {
    const coins = Math.min(REWARD_COINS_MAX, Math.max(REWARD_COINS_MIN, total * REWARD_COINS_EACH));
    out.push({ id, name, icon, group, seen: seenN, total, done: total > 0 && seenN >= total, claimed: !!d?.claimed.has(id), reward: { coins, lamps: REWARD_LAMPS } });
  };
  add('creatures', 'Creatures', '🐾', 'Codex', MONSTERS.filter((id) => kills[id] > 0).length, MONSTERS.length);
  add('bosses', 'Bosses', '👑', 'Codex', BOSSES.filter((id) => kills[id] > 0).length, BOSSES.length);
  const shelves = new Map(RESOURCE_CATS.map((c) => [c.id, { seen: 0, total: 0 }]));
  for (const id of obtainableItems()) {
    const s = shelves.get(resourceCat(id)) || shelves.get('other');
    s.total++;
    if (d?.items.has(id)) s.seen++;
  }
  for (const c of RESOURCE_CATS) { const s = shelves.get(c.id); if (s.total) add(`items:${c.id}`, c.name, '🎒', 'Items', s.seen, s.total); }
  const regions = (game?.world?.zones || []).filter((z) => !z.instance).map((z) => z.name);
  add('regions', 'Regions', '🗺️', 'Places', regions.filter((n) => game.zonesVisited?.has(n)).length, regions.length);
  const rz = game?.world?.resourceZones || [];
  if (rz.length) add('zones', 'Resource zones', '⛏️', 'Places', rz.filter((z) => d?.places.has(z.id)).length, rz.length);
  const pages = game?.story?.pages || new Set();
  add('lore', 'Lore pages', '📜', 'Story', LORE.filter((p) => pages.has(p.id)).length, LORE.length);
  return out;
}

/** Overall discovery: { seen, total } across every category. */
export function discoveryTotals(game) {
  let seen = 0, total = 0;
  for (const c of discoveryCategories(game)) { seen += Math.min(c.seen, c.total); total += c.total; }
  return { seen, total };
}

/** Finished categories whose reward is still waiting. */
export const unclaimed = (game) => discoveryCategories(game).filter((c) => c.done && !c.claimed);

/** Pay a finished category's reward once. Returns true if it paid. */
export function claimDiscovery(game, id) {
  const d = game?.discovery;
  const c = discoveryCategories(game).find((x) => x.id === id);
  if (!d || !c || !c.done || d.claimed.has(id)) return false;
  d.claimed.add(id);
  game.inventory.add('coins', c.reward.coins);
  if (c.reward.lamps) game.inventory.add('forager_lamp', c.reward.lamps);
  game.msg?.(`Discovery complete: ${c.name}! You receive ${c.reward.coins.toLocaleString('en-GB')} coins and ${c.reward.lamps} ${getItem('forager_lamp').name.toLowerCase()}s.`, 'level');
  game.saveSoon = true;
  return true;
}
