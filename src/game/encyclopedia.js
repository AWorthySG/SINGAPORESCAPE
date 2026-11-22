// The item encyclopedia, and the names the game's text can link to. Kept free
// of the DOM: src/ui/encyclopediaui.js draws it, and the tests check it
// headlessly (tests/encyclopedia.test.mjs).
//
// An item's page reuses the skill guide's facts (skillguide.js itemEntry: who
// drops it, which nodes give it, which recipes make it and what it goes
// into), so the Resources index and the encyclopedia never disagree. This
// file adds what the Resources index leaves out: every item (gear, food,
// keys, rewards, not only materials), what it is for at a glance, and the
// nearest place to get one, for the page's Go button.
import { ITEMS, getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { SKILLS } from '../data/skills.js';
import { chebyshev } from '../core/utils.js';
import { CODEX_IDS } from './codex.js';
import { RESOURCE_CATS, resourceCat, itemSources } from './skillguide.js';
import { searchArticles } from '../data/compendium.js';

/** Every item the encyclopedia lists (coins aside), by name. */
let _all = null;
export function allItemIds() {
  if (_all) return _all;
  _all = Object.keys(ITEMS).filter((id) => id !== 'coins').sort((a, b) => getItem(a).name.localeCompare(getItem(b).name) || a.localeCompare(b));
  return _all;
}

export const ITEM_SHELVES = [{ id: 'all', name: 'All' }, ...RESOURCE_CATS];

/** The list's ids for a search, a shelf and a found filter ('all' | 'seen' | 'unseen'),
 *  found ones first.
 *  An item you haven't found is still searchable by name, as in the Monster
 *  Codex: players often know what they are looking for. */
export function searchItems(game, { search = '', cat = 'all', disc = 'all' } = {}) {
  const t = String(search).trim().toLowerCase();
  const d = game?.discovery;
  const out = allItemIds().filter((id) => {
    if (cat !== 'all' && resourceCat(id) !== cat) return false;
    if (t && !getItem(id).name.toLowerCase().includes(t)) return false;
    if (disc === 'seen' && !d?.items.has(id)) return false;
    if (disc === 'unseen' && d?.items.has(id)) return false;
    return true;
  });
  // Found ones first (still by name), so the list opens on what you know.
  return d ? [...out.filter((id) => d.items.has(id)), ...out.filter((id) => !d.items.has(id))] : out;
}

/** What an item is, in a few words: "Two-handed sword · Melee 40" or "Food · heals 12". */
export function itemKind(id) {
  const it = getItem(id), eq = it.equip;
  if (eq) {
    const req = Object.entries(eq.req || {}).map(([s, l]) => `${s === 'attack' ? 'Melee' : s[0].toUpperCase() + s.slice(1)} ${l}`).join(', ');
    const what = eq.slot === 'weapon' ? `${(eq.weaponType || 'weapon').replace(/_/g, ' ')}` : `${eq.slot} slot`;
    return `${what[0].toUpperCase()}${what.slice(1)}${req ? ` · ${req}` : ''}`;
  }
  if (it.healPct) return `Food · heals ${Math.round(it.healPct * 100)}% of your life`;
  if (it.heal) return `Food · heals ${it.heal}`;
  if (it.tool) return 'Tool';
  return RESOURCE_CATS.find((c) => c.id === resourceCat(id))?.name || 'Item';
}

/** Where to buy it, cheapest first: [{ shopId, name, price }]. */
export const shopsFor = (id) => itemSources(id).filter((s) => s.kind === 'shop').sort((a, b) => a.price - b.price);

/** The nearest world spawn of one NPC kind (in a region, if named): { x, y, dist } or null. */
export function nearestNpcSpawn(game, npcId, region = null) {
  return nearestNpcOf(game, (n) => n.npcId === npcId && (!region || game.world?.zoneAt?.(n.spawnX ?? n.x, n.spawnY ?? n.y)?.name === region));
}

/** A nearest NPC spawn of this kind: { x, y, dist } or null. */
function nearestNpcOf(game, pred) {
  const p = game?.player;
  if (!p) return null;
  let best = null;
  for (const n of game.npcs || []) {
    if (n.temporary || n.wave || !pred(n)) continue;
    const x = n.spawnX ?? n.x, y = n.spawnY ?? n.y, d = chebyshev(p.x, p.y, x, y);
    if (!best || d < best.dist) best = { x, y, dist: d, npcId: n.npcId };
  }
  return best;
}

/** The nearest place you can get this item now, for the Go button:
 *  { kind: 'node'|'shop'|'drop', label, x, y, dist, objIds? } or null.
 *  A node needs your skill level; a monster drop counts if it comes at least
 *  1 kill in 100 from a monster no more than 20 levels above your fight
 *  level (so Go never sends a beginner to a boss for its rare). */
export function nearestSource(game, id) {
  const p = game?.player;
  if (!p) return null;
  const level = (s) => game.skills?.level?.(s) || 1;
  const fight = game.fightLevel?.() || game.skills?.combatLevel?.() || 1;
  const cands = [];
  const srcs = itemSources(id);
  const nodeObjs = new Set();
  for (const s of srcs) if (s.kind === 'node' && s.source.objIds && level(s.source.skill) >= s.source.level) for (const o of s.source.objIds) nodeObjs.add(o);
  if (nodeObjs.size) {
    let best = null;
    for (const o of game.world?.objects || []) {
      if (!nodeObjs.has(o.objId)) continue;
      const d = chebyshev(p.x, p.y, o.x, o.y);
      if (!best || d < best.dist) best = { kind: 'node', label: o.def?.name || 'a gathering spot', x: o.x, y: o.y, dist: d, objIds: [...nodeObjs] };
    }
    if (best) cands.push(best);
  }
  const shopIds = new Set(srcs.filter((s) => s.kind === 'shop').map((s) => s.shopId));
  if (shopIds.size) {
    const s = nearestNpcOf(game, (n) => shopIds.has(n.def?.shop));
    if (s) cands.push({ kind: 'shop', label: getNpc(s.npcId).name, x: s.x, y: s.y, dist: s.dist });
  }
  const drops = new Set(srcs.filter((s) => s.kind === 'drop' && s.chance >= 0.01 && s.level <= fight + 20).map((s) => s.npcId));
  if (drops.size) {
    const s = nearestNpcOf(game, (n) => drops.has(n.npcId));
    if (s) cands.push({ kind: 'drop', label: getNpc(s.npcId).name, x: s.x, y: s.y, dist: s.dist, npcId: s.npcId });
  }
  // Hunting for a drop takes a few kills, so a node or shop wins unless the
  // monster is much nearer.
  const cost = (c) => c.dist * (c.kind === 'drop' ? 2 : 1);
  return cands.sort((a, b) => cost(a) - cost(b))[0] || null;
}

/** Send the player to an item's nearest source. A node is walked to and
 *  started on (the skill guide's Go); a shop or a monster is travelled to. */
export function goToSource(game, id) {
  const s = nearestSource(game, id);
  if (!s) { game?.msg?.("I don't know anywhere near to get one of those yet.", 'system'); return false; }
  if (s.kind === 'node') return game.goToNearest(s.objIds);
  game.msg?.(`You head for ${s.kind === 'shop' ? s.label : `the nearest ${s.label.toLowerCase()}`}.`, 'system');
  return game.travelToTile({ x: s.x, y: s.y });
}

// ---------------- Names the game's text can link to ----------------
// Chat lines, quest text and encyclopedia pages mention monsters, items,
// skills and regions by name; links.js turns those names into taps that open
// the entry. Names are matched as whole words, ignoring case and punctuation,
// longest first ("Elder macaque" before "Macaque").

/** A name broken into lower-case words: "St John's Island" -> "st john's island". */
export const nameKey = (s) => (String(s).toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) || []).join(' ');

// Everyday words that happen to be item names: linking every "logs" or "bones"
// in the chat would bury the useful links.
const TOO_COMMON = new Set(['coins', 'logs', 'bones', 'feather', 'feathers', 'ashes', 'fire', 'water', 'arrows', 'rune', 'bread', 'gold', 'silver', 'bronze', 'iron', 'steel', 'clay', 'coal', 'seaweed', 'fish', 'rat', 'chicken', 'cow', 'goat']);

let _names = null;
/** Map nameKey -> { kind, id }, and the longest name's word count. Built once
 *  (again only if a region name it hasn't seen turns up). */
export function linkNames(regionNames = []) {
  if (_names && regionNames.every((r) => _names.regions.has(r))) return _names;
  const regions = new Set([...(_names?.regions || []), ...regionNames]);
  regionNames = [...regions];
  const map = new Map();
  const put = (name, kind, id) => {
    const k = nameKey(name);
    if (!k || k.length < 4 || TOO_COMMON.has(k) || map.has(k)) return;
    map.set(k, { kind, id });
  };
  // Regions and skills first (they win a tie), then creatures, then items.
  for (const r of regionNames) put(r, 'region', r);
  for (const s of SKILLS) if (!s.hidden) put(s.name, 'skill', s.id);
  for (const id of CODEX_IDS) put(getNpc(id).name, 'monster', id);
  for (const id of allItemIds()) put(getItem(id).name, 'item', id);
  let longest = 1;
  for (const k of map.keys()) longest = Math.max(longest, k.split(' ').length);
  _names = { map, longest: Math.min(longest, 7), regions };
  return _names;
}

/** Split text into plain runs and linked names: [{ text, link? }]. */
export function findLinks(text, regionNames = []) {
  const { map, longest } = linkNames(regionNames);
  const s = String(text ?? '');
  const words = [...s.matchAll(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)];
  const low = words.map((m) => m[0].toLowerCase());   // each word lower-cased once
  const keys = [];
  const out = [];
  let at = 0;
  for (let i = 0; i < words.length;) {
    // The names that could start here, one word long up to `longest`, built up
    // a word at a time (every chat line goes through this), then tried longest first.
    const most = Math.min(longest, words.length - i);
    keys[0] = low[i];
    for (let n = 2; n <= most; n++) keys[n - 1] = `${keys[n - 2]} ${low[i + n - 1]}`;
    let hit = null;
    for (let n = most; n >= 1 && !hit; n--) {
      const e = map.get(keys[n - 1]);
      if (e) hit = { n, e };
    }
    if (!hit) { i++; continue; }
    const from = words[i].index, last = words[i + hit.n - 1], to = last.index + last[0].length;
    if (from > at) out.push({ text: s.slice(at, from) });
    out.push({ text: s.slice(from, to), link: hit.e });
    at = to;
    i += hit.n;
  }
  if (at < s.length) out.push({ text: s.slice(at) });
  return out;
}

// ---------------- One search over everything ----------------

/** Search monsters, items, regions and Compendium articles at once:
 *  { monsters, items, regions, articles }, each [{ id, title, sub }] (all
 *  matches; the page shows the first few of each). Every word must appear
 *  in the name (or, for an article, anywhere in it). Names you haven't found
 *  yet still match: you typed them, so you know them. */
export function searchAll(game, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const empty = { monsters: [], items: [], regions: [], articles: [] };
  if (!words.length) return empty;
  const hit = (name) => { const n = name.toLowerCase(); return words.every((w) => n.includes(w)); };
  // Closest names first: an exact or starting match beats one buried inside.
  const rank = (name) => { const n = name.toLowerCase(), q = words.join(' '); return n === q ? 0 : n.startsWith(q) ? 1 : 2; };
  const byRank = (a, b) => rank(a.title) - rank(b.title) || a.title.length - b.title.length || a.title.localeCompare(b.title);
  const monsters = CODEX_IDS.filter((id) => hit(getNpc(id).name)).map((id) => {
    const d = getNpc(id);
    return { id, title: d.name, sub: `${d.boss ? 'Boss' : 'Creature'} · level ${d.level.toLocaleString('en-GB')}${game?.kills?.[id] > 0 ? '' : ' · not met yet'}` };
  }).sort(byRank);
  const items = allItemIds().filter((id) => hit(getItem(id).name)).map((id) => ({ id, title: getItem(id).name, sub: itemKind(id) })).sort(byRank);
  const regions = (game?.world?.zones || []).filter((z) => !z.instance && hit(z.name)).map((z) => ({ id: z.name, title: z.name, sub: game.zonesVisited?.has(z.name) ? 'Region · visited' : 'Region' })).sort(byRank);
  const articles = searchArticles(words.join(' ')).map((h) => ({ id: h.article.id, title: h.article.title, sub: h.inTitle ? h.article.summary : h.snippet || h.article.summary }));
  return { monsters, items, regions, articles };
}
