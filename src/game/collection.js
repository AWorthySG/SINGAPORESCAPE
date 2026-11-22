// The Collection log: a page for every source of loot (each boss, champions,
// Slayer, each clue tier, the Endless Gate and the life skills' rare finds)
// listing its unique drops. An item is ticked off when it actually drops or is
// gathered from that source, with a count; a pet (pets.js) is ticked off once
// owned. Finishing a page earns a title you can wear above your name.
//
// The lists are worked out from the loot tables themselves (npcs.js, clues.js,
// slayer.js, trades.js, objects.js, waves.js), so a new boss or reward appears
// here without anyone having to remember this file. Kept out of game.js: the
// game only calls `collection.onDrops / record / onGather` where loot lands.

import { ALL_MONSTER_IDS, ALL_BOSS_IDS, RARE_DROP_TABLE, getNpc } from '../data/npcs.js';
import { ITEMS, getItem } from '../data/items.js';
import { CLUE_TIERS } from '../data/clues.js';
import { SLAYER_REWARDS } from '../data/slayer.js';
import { HUNT } from '../data/trades.js';
import { OBJECTS } from '../data/objects.js';
import { RARE_BOSS_BONES } from '../data/bones.js';
import { sigDropsFor } from '../data/bossWeapons.js';
import { GEM_TABLE } from './skilling.js';
import { GATE_LOOT } from './waves.js';
import { BOSS_PETS, SKILL_PETS, PET_BY_ID } from './pets.js';

const real = (id) => !!ITEMS[id];
const uniq = (ids) => [...new Set(ids.filter(real))];

// How many loot tables (monsters and bosses) each item turns up in: a boss's
// own uniques are the gear that one or two tables at most can give.
const TABLES = new Map();
for (const id of [...ALL_BOSS_IDS, ...ALL_MONSTER_IDS]) {
  for (const e of new Set((getNpc(id).dropTable || []).filter((x) => !x.nothing).map((x) => x.id))) TABLES.set(e, (TABLES.get(e) || 0) + 1);
}
const lowerThe = (name) => name.replace(/^The /, 'the ');

/** A boss's page: its own unique gear, the three most valuable things on its
 *  table, its signature weapon and rare bones (if it has them), and its pet. */
function bossItems(id) {
  const table = uniq((getNpc(id).dropTable || []).filter((e) => !e.nothing).map((e) => e.id));
  const gear = table.filter((x) => !getItem(x).stackable);
  const own = gear.filter((x) => getItem(x).equip && TABLES.get(x) <= 2);
  const top = [...gear].sort((a, b) => (getItem(b).value || 0) - (getItem(a).value || 0)).slice(0, 3);
  const out = uniq([...own, ...top]);
  for (const s of sigDropsFor(id)) if (real(s.id)) out.push(s.id);   // its signature weapon(s)
  if (RARE_BOSS_BONES[id]) out.push(RARE_BOSS_BONES[id]);
  return out;
}

// Small-share rolls on a thieving table (a stall, a chest or a mark): its rare finds.
function thievingFinds() {
  const tables = Object.values(OBJECTS).filter((o) => o.type === 'stall' && o.loot).map((o) => o.loot);
  for (const id of ['marina_high_roller', 'jade_merchant']) { try { const t = getNpc(id).thieving; if (t) tables.push(t.loot); } catch { /* not in this build */ } }
  const out = [];
  for (const loot of tables) {
    const total = loot.reduce((s, e) => s + (e.weight || 0), 0);
    for (const e of loot) if (e.id !== 'coins' && total && e.weight / total <= 0.05) out.push(e.id);
  }
  return out;
}

/** Each life skill's rare finds, by skill: the bird's nest from trees, gems in
 *  the rock, pearls from the sea, the trophies a trap seldom gives, a thief's
 *  rare hauls. Read from the same tables the skills roll on. */
export const RARE_FINDS = {
  woodcutting: uniq(['birds_nest']),
  mining: uniq(GEM_TABLE.map((g) => g.id)),
  fishing: uniq(['pearl']),
  hunter: uniq(Object.values(HUNT).flatMap((h) => h.gives.filter((g) => (g.chance ?? 1) <= 0.2).map((g) => g.id))),
  thieving: uniq(thievingFinds()),
};
const FIND_SKILL = new Map();
for (const [skill, ids] of Object.entries(RARE_FINDS)) for (const id of ids) if (!FIND_SKILL.has(id)) FIND_SKILL.set(id, skill);
// What each gathering action trains, for onGather.
const ACTION_SKILL = { woodcut: 'woodcutting', mine: 'mining', fish: 'fishing', hunt: 'hunter', stall: 'thieving', thieve: 'thieving' };

const item = (id) => ({ kind: 'item', id });
const pet = (id) => ({ kind: 'pet', id });

/** Every page: { id, name, group, title, entries: [{ kind: 'item'|'pet', id }] }. */
export const PAGES = [];
for (const id of ALL_BOSS_IDS) {
  const d = getNpc(id);
  if (!d.attackable || !d.boss) continue;
  PAGES.push({ id: `boss:${id}`, npcId: id, name: d.name, group: 'Bosses', title: `Bane of ${lowerThe(d.name)}`,
    entries: [...bossItems(id).map(item), ...(BOSS_PETS[id] ? [pet(BOSS_PETS[id].id)] : [])] });
}
const rareTable = uniq(RARE_DROP_TABLE.map((e) => e.id).filter((x) => x !== 'coins'));
PAGES.push(
  { id: 'champions', name: 'Champions', group: 'Other', title: 'Champion Hunter',
    entries: uniq(['champion_bones', 'upgrade_ward', 'refine_scroll', ...rareTable]).map(item) },
  { id: 'slayer', name: 'Slayer', group: 'Other', title: 'Master Slayer',
    entries: uniq([...SLAYER_REWARDS.filter((r) => r.id !== 'coins' && getItem(r.id).equip).map((r) => r.id),
      ...rareTable.filter((x) => getItem(x).equip)]).map(item) },
  ...Object.entries(CLUE_TIERS).map(([tier, t]) => ({ id: `clue:${tier}`, name: `${tier[0].toUpperCase()}${tier.slice(1)} clues`, group: 'Other',
    title: { easy: 'Trail Seeker', medium: 'Trail Blazer', hard: 'Treasure Master' }[tier] || `${tier} Treasure Hunter`,
    entries: uniq(t.reward.map((e) => e.id).filter((x) => x !== 'coins')).map(item) })),
  { id: 'gate', name: 'The Endless Gate', group: 'Other', title: 'Gatekeeper', entries: uniq(GATE_LOOT).map(item) },
  { id: 'finds', name: 'Rare finds', group: 'Life skills', title: 'Lucky Hands',
    entries: uniq(Object.values(RARE_FINDS).flat()).map(item) },
  { id: 'pets', name: 'Pets', group: 'Life skills', title: 'Beastmaster',
    entries: [...Object.values(BOSS_PETS), ...Object.values(SKILL_PETS)].map((p) => pet(p.id)) },
);
export const PAGE_BY_ID = Object.fromEntries(PAGES.map((p) => [p.id, p]));
// Quick "is this item on that page?" lookups.
const PAGE_ITEMS = new Map(PAGES.map((p) => [p.id, new Set(p.entries.filter((e) => e.kind === 'item').map((e) => e.id))]));

export class Collection {
  constructor(game) {
    this.game = game;
    this.log = {};          // { pageId: { itemId: count } } (saved)
    this.done = new Set();  // pages finished (saved: the title is announced once)
    this.title = null;      // the page whose title you wear (saved)
  }

  /** Has this page's entry been collected? Pets count once owned. */
  has(pageId, e) {
    if (e.kind === 'pet') return !!this.game.pets?.owned[e.id];
    return (this.log[pageId]?.[e.id] || 0) > 0;
  }
  count(pageId, e) { return e.kind === 'pet' ? (this.game.pets?.owned[e.id] || 0) : (this.log[pageId]?.[e.id] || 0); }
  /** { got, total } for a page. */
  progress(pageId) {
    const p = PAGE_BY_ID[pageId];
    if (!p) return { got: 0, total: 0 };
    return { got: p.entries.filter((e) => this.has(pageId, e)).length, total: p.entries.length };
  }
  isComplete(pageId) { const { got, total } = this.progress(pageId); return total > 0 && got >= total; }
  /** Every entry on every page: { got, total }. */
  totals() {
    let got = 0, total = 0;
    for (const p of PAGES) { const r = this.progress(p.id); got += r.got; total += r.total; }
    return { got, total };
  }
  pagesDone() { return this.done.size; }

  /** Note `qty` of item `id` from a source. Only items on that page count. */
  record(pageId, id, qty = 1) {
    if (!PAGE_ITEMS.get(pageId)?.has(id) || !(qty > 0)) return false;
    const pg = (this.log[pageId] ||= {});
    const first = !pg[id];
    pg[id] = (pg[id] || 0) + qty;
    if (first) {
      this.game.msg?.(`New collection log item: ${getItem(id).name} (${PAGE_BY_ID[pageId].name}).`, 'level');
      this.check(pageId);
    }
    this.game.saveSoon = true;
    this.game.bus?.emit('collection');
    return first;
  }

  /** A monster's loot, as rollDrops is about to hand it out: [[id, qty, ...]].
   *  A boss fills its own page; a champion the Champions page; a monster on
   *  your Slayer task the Slayer page. */
  onDrops(npc, loot) {
    const pages = [];
    if (npc.def?.boss && PAGE_BY_ID[`boss:${npc.npcId}`]) pages.push(`boss:${npc.npcId}`);
    if (npc.champion && !npc.def?.boss) pages.push('champions');
    if (this.game.onSlayerTask?.(npc)) pages.push('slayer');
    for (const pg of pages) for (const l of loot) this.record(pg, l[0], l[1]);
  }

  /** Something a life-skill action brought in (`action` is the action type). */
  onGather(action, id, qty = 1) {
    const skill = ACTION_SKILL[action];
    if (skill && RARE_FINDS[skill]?.includes(id)) this.record('finds', id, qty);
  }

  /** Award a page's title the first time it is complete. Called when something
   *  new lands on it (and for the Pets page, when a pet does). */
  check(pageId) {
    if (this.done.has(pageId) || !this.isComplete(pageId)) return false;
    this.done.add(pageId);
    const g = this.game, p = PAGE_BY_ID[pageId];
    g.msg?.(`Collection log page complete: ${p.name}! You earn the title "${p.title}".`, 'level');
    g.banner?.(`<span class="big">Collection complete!</span>${p.name} · title "${p.title}"`);
    if (g.player) g.spawnSparkle?.(g.player, '#ffd24a', 18);
    if (!this.title && !g.learning?.title) this.title = pageId;   // wear your first one straight away
    g.checkAchievements?.();
    g.bus?.emit('collection');
    return true;
  }

  /** Titles you've earned: [{ id, title }]. */
  titles() { return PAGES.filter((p) => this.done.has(p.id)).map((p) => ({ id: p.id, title: p.title })); }
  /** Wear an earned title (page id) or none. Wearing one takes off a Codex title. */
  setTitle(pageId) {
    if (pageId && !this.done.has(pageId)) return false;
    this.title = pageId || null;
    if (pageId && this.game.learning) this.game.learning.title = null;
    this.game.bus?.emit('collection');
    this.game.bus?.emit('learning');
    return true;
  }
  titleText() { return this.title && this.done.has(this.title) ? PAGE_BY_ID[this.title]?.title || null : null; }

  serialize() { return { log: this.log, done: [...this.done], title: this.title }; }
  /** Restore from a save; anything odd or unknown is dropped. */
  load(d) {
    this.log = {}; this.done = new Set(); this.title = null;
    if (!d || typeof d !== 'object') return;
    if (d.log && typeof d.log === 'object') {
      for (const [pg, items] of Object.entries(d.log)) {
        if (!PAGE_ITEMS.has(pg) || !items || typeof items !== 'object') continue;
        for (const [id, n] of Object.entries(items)) if (PAGE_ITEMS.get(pg).has(id) && typeof n === 'number' && n > 0) (this.log[pg] ||= {})[id] = Math.floor(n);
      }
    }
    if (Array.isArray(d.done)) for (const pg of d.done) if (PAGE_BY_ID[pg]) this.done.add(pg);
    if (typeof d.title === 'string' && this.done.has(d.title)) this.title = d.title;
  }
}

export { PET_BY_ID };
