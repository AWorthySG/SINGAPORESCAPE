// Collectible lore pages (data in src/data/lore.js). The pages you hold live on
// the story (game.story.pages, saved); this file finds them for you:
//   - a rare drop: a kill in a region may turn up that region's missing drop page
//   - a hidden spot: each region has a glinting note somewhere near its quest
//     giver; read it (Interact) to take the page
//   - a chapter: each finished story chapter gives its own page (story.js)
// A region's two pages make a set: finishing it wakes the region's lore guardian
// (a champion of the region's quest foe) at the hidden spot; beat it for a
// reward. Every chapter page together pays the story's own bonus.
//
// Nothing here rolls Math.random: drops use the story's own little generator,
// so the rest of the game (and the seeded test suite) rolls exactly as before.
import { LORE, LORE_BY_ID, LORE_SETS, STORY_SET, LORE_DROP_PER_MIL, LORE_DROP_PER_MIL_BIG, GUARDIAN_COINS, GUARDIAN_ITEM, STORY_SET_REWARD } from '../data/lore.js';
import { REGION_LINES, REGION_GIVERS } from '../data/regionQuests.js';
import { getItem } from '../data/items.js';
import { NPC } from './npc.js';
import { TILE } from '../config.js';

const LINE_BY_REGION = Object.fromEntries(REGION_LINES.map((l) => [l.region, l]));
const SPOT_PAGE = Object.fromEntries(LORE.filter((p) => p.from === 'spot').map((p) => [p.region, p]));
const DROP_PAGE = Object.fromEntries(LORE.filter((p) => p.from === 'drop').map((p) => [p.region, p]));

/** The monster a region's guardian is a champion of: its quest line's named foe's kind. */
export const guardianKind = (region) => LINE_BY_REGION[region]?.steps.find((s) => s.kind === 'foe')?.npc || null;

// The hidden note: a rolled-up lore scroll.
const spotDef = (base, page) => ({ ...base, name: 'Glinting note', type: 'storyobj', verb: 'Read', blocking: false,
  art: 'obj-lore_scroll', examine: `Something is pinned here, catching the light. (${page.region})` });

// A small string hash, so each region's spot is picked the same way every time.
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** Where a region's hidden note sits: a quiet, open tile 6-16 tiles from its
 *  quest giver's spot, with nothing built around it. The same tile every time. */
export function spotTile(game, region) {
  const cache = (game._loreTiles ||= {});
  if (cache[region] !== undefined) return cache[region];
  const w = game.world, l = LINE_BY_REGION[region], g = l && REGION_GIVERS[l.giver];
  cache[region] = null;
  if (!g) return null;
  const h = hash(region);
  const clear = (x, y) => w.inBounds(x, y) && !w.isBlocked(x, y) && !w.objectAt(x, y);
  for (let r = 6 + (h % 3); r <= 18; r++) {
    // Walk the ring from a different corner in each region, so the notes don't all sit due north.
    const ring = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([dx, dy]);
    const start = (h >>> 3) % ring.length;
    for (let k = 0; k < ring.length; k++) {
      const [dx, dy] = ring[(start + k) % ring.length];
      const x = g.at[0] + dx, y = g.at[1] + dy;
      if (w.zoneAt(x, y)?.name !== region) continue;
      let ok = true;
      for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1 && ok; i++) ok = clear(x + i, y + j);
      if (ok) return (cache[region] = { x, y });
    }
  }
  return null;
}

/** Put out the hidden notes whose pages you haven't read yet. */
export function placeSpots(story) {
  const g = story.game;
  for (const o of story._spots) g.world.removeObject(o);
  story._spots = [];
  for (const page of Object.values(SPOT_PAGE)) {
    if (story.pages.has(page.id)) continue;
    const t = spotTile(g, page.region);
    if (!t || g.world.objectAt(t.x, t.y)) continue;
    const base = g.world.objects.find((o) => o.objId === 'sign')?.def || { name: 'Signpost', type: 'scenery' };
    story._spots.push(g.world.addObject('sign', t.x, t.y, { def: spotDef(base, page), loreId: page.id }));
  }
}

/** Read a hidden note: the page is yours and the note is gone. */
export function readSpot(story, obj) {
  const g = story.game;
  if (!obj?.loreId) return false;
  g.world.removeObject(obj);
  story._spots = story._spots.filter((o) => o !== obj);
  g.spawnSparkle?.({ x: obj.x * TILE + TILE / 2, y: obj.y * TILE + TILE / 2 }, '#ffe27a', 14);
  return collect(story, obj.loreId, 'spot');
}

/** Take a page. `how` words the message; quiet: no banner (catching up a save). */
export function collect(story, id, how = '', quiet = false) {
  const g = story.game, page = LORE_BY_ID[id];
  if (!page || story.pages.has(id)) return false;
  story.pages.add(id);
  const where = how === 'drop' ? ' It fluttered out of the fight.' : '';
  g.msg(`Lore page found: “${page.title}” (${page.region}).${where} Read it in the Journal's Story tab.`, 'level');
  if (!quiet) {
    g.banner?.(`<span class="big">📜 Lore page found!</span>${page.title}`);
    g.bus.emit('sfx', how === 'spot' ? 'interact:read' : 'pickup');
  }
  g.saveSoon = true;
  checkSets(story, quiet);
  g.bus.emit('story');
  return true;
}

/** A monster died to you: maybe it drops its region's missing page. */
export function onKill(story, npc) {
  const g = story.game;
  if (!npc?.def?.attackable || npc.wave || npc.ally || npc.loreGuard) return false;
  const region = g.world.zoneAt(npc.x, npc.y)?.name;
  const page = region && DROP_PAGE[region];
  if (!page || story.pages.has(page.id)) return false;
  const big = npc.def.boss || npc.champion;
  if (story.roll() * 1000 >= (big ? LORE_DROP_PER_MIL_BIG : LORE_DROP_PER_MIL)) return false;
  return collect(story, page.id, 'drop');
}

/** After a page: any set just finished wakes its guardian (or pays the story bonus). */
export function checkSets(story, quiet = false) {
  const g = story.game;
  for (const set of LORE_SETS) {
    if (!set.pages.every((p) => story.pages.has(p.id))) continue;
    if (set.region === STORY_SET) {
      if (story.storyPaid) continue;
      story.storyPaid = true;
      g.inventory.add('coins', STORY_SET_REWARD.coins);
      g.msg(`Every chapter's page collected! ${STORY_SET_REWARD.coins.toLocaleString('en-GB')} coins and the title “${STORY_SET_REWARD.title}”.`, 'level');
      if (!quiet) g.banner?.(`<span class="big">📚 Set complete!</span>${STORY_SET} · title “${STORY_SET_REWARD.title}”`);
      continue;
    }
    if (story.guard[set.region]) continue;
    story.guard[set.region] = 'ready';
    const n = spawnGuardian(story, set.region);
    g.msg(`Lore set complete: ${set.region}! The region's guardian stirs by the hidden spot${n ? '' : ' (it will wait for you there)'}.`, 'level');
    if (!quiet) g.banner?.(`<span class="big">📜 Set complete!</span>${set.region}: its guardian stirs`);
  }
}

/** The waiting guardian of a region, spawned beside its hidden spot if it isn't about. */
export function spawnGuardian(story, region) {
  const g = story.game;
  const have = story._guardians[region];
  if (have && have.alive && g.npcs.includes(have)) return have;
  const kind = guardianKind(region), t = spotTile(g, region);
  if (!kind || !t) return null;
  const at = g._nearestFree(t.x + 1, t.y) || t;
  const n = story.quietly(() => new NPC(kind, at.x, at.y, 3, {}));   // (spawn options keep it from rolling champion itself)
  n.makeChampion();
  n.def = { ...n.def, name: `Guardian of ${region}`, respawn: 1e9, examine: `It guards the old stories of ${region}.` };
  n.loreGuard = region;
  g.npcs.push(n);
  story._guardians[region] = n;
  return n;
}

/** The guardian fell: its reward, and it's gone for good. */
export function onGuardianKill(story, npc) {
  const g = story.game, region = npc.loreGuard;
  npc.temporary = true;   // removed next tick, never respawned
  g.hasTemps = true;
  delete story._guardians[region];
  if (story.guard[region] !== 'ready') return false;
  story.guard[region] = 'done';
  const coins = GUARDIAN_COINS(LINE_BY_REGION[region]?.level || 1);
  g.inventory.add('coins', coins);
  g.inventory.add(GUARDIAN_ITEM[0], GUARDIAN_ITEM[1]);
  g.msg(`The Guardian of ${region} is laid to rest. ${coins.toLocaleString('en-GB')} coins and ${GUARDIAN_ITEM[1]} ${getItem(GUARDIAN_ITEM[0]).name}.`, 'level');
  g.banner?.(`<span class="big">Guardian defeated!</span>${region}`);
  g.saveSoon = true;
  g.bus.emit('story');
  return true;
}

/** Pages held / in all, for a set or every page. */
export function pageCount(story, region = null) {
  const list = region ? LORE.filter((p) => p.region === region) : LORE;
  return { have: list.filter((p) => story.pages.has(p.id)).length, total: list.length };
}
