// Which name labels the playfield shows, and the short tag over your target.
//
// Every tree, rock and fishing spot used to carry a permanent name pill, so a
// busy forest or mine hill became a wall of text. The "World labels" setting
// (Settings panel, saved with the game) now picks one of three modes:
//   smart (the default): only what matters right now: the thing under the
//         mouse or Interact focus, the thing you're working, and, for a few
//         seconds as you reach them, the nearest few nodes you could work
//         with the tools you carry; for creatures,
//         your target, whatever is attacking you, bosses, champions, quest
//         NPCs and the hovered one.
//   all:  every label, as before (and every creature's name).
//   off:  no name labels at all (health bars, hitsplats and warnings stay).
//
// Kept free of drawing code so the rules can be tested headlessly.
import { RACES, raceOf } from '../data/races.js';
import { weaknessOf, armourTierOf } from '../game/combat.js';

export const LABEL_MODES = ['smart', 'all', 'off'];
export const LABEL_MODE_NAMES = { smart: 'Smart', all: 'All', off: 'Off' };
// Smart mode: nodes within this many tiles that your tools can work get a
// label for a moment, at most this many of them (nearest first).
export const NEAR_LABEL_TILES = 3;
export const NEAR_LABEL_MAX = 3;
// ...and only briefly: a nearby node's pill shows for this long after you come
// within reach, then fades away until you walk off and come back (hovering or
// working it still shows it).
export const NEAR_LABEL_MS = 3500;
const LABELLED_TYPES = new Set(['tree', 'rock', 'fishing']);

/** The current mode, falling back to smart for a missing or unknown value. */
export function labelMode(game) {
  return LABEL_MODES.includes(game?.worldLabels) ? game.worldLabels : 'smart';
}

/** The next mode in the Settings button's cycle (Smart → All → Off → Smart). */
export function nextLabelMode(mode) {
  const i = LABEL_MODES.indexOf(mode);
  return LABEL_MODES[(i + 1) % LABEL_MODES.length];
}

/** True for world objects that carry a name pill at all. */
export function isLabelledObject(o) {
  return !!o && LABELLED_TYPES.has(o.def?.type) && !!o.def.label && !o.depleted;
}

/** Nodes near you that your tools can work, nearest first (at most
 *  NEAR_LABEL_MAX). Worked out once per tick and player tile, not every frame. */
export function nearbyWorkable(game) {
  const p = game.player;
  const key = `${game.tickCount}|${p.x}|${p.y}`;
  const memo = game._nearLabels;
  if (memo && memo.key === key) return memo.set;
  const tools = new Map();
  const has = (tag) => {
    if (!tag) return true;
    if (!tools.has(tag)) tools.set(tag, !!game.hasTool?.(tag));
    return tools.get(tag);
  };
  const near = [];
  for (const o of game.world.objects) {
    if (!isLabelledObject(o)) continue;
    const d = Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y));
    if (d > NEAR_LABEL_TILES || !has(o.def.tool)) continue;
    // ...and that you have the level for (a "needs Mining 15" rock isn't relevant yet).
    if (o.def.skill && o.def.level && game.skills?.level(o.def.skill) < o.def.level) continue;
    near.push([d, o]);
  }
  near.sort((a, b) => a[0] - b[0]);
  const set = new Set(near.slice(0, NEAR_LABEL_MAX).map((e) => e[1]));
  // When each one came within reach (dropped once it leaves, so it shows again next time).
  const since = game._nearSince instanceof Map ? game._nearSince : (game._nearSince = new Map());
  const now = game.playMs || 0;
  for (const o of since.keys()) if (!set.has(o)) since.delete(o);
  for (const o of set) if (!since.has(o)) since.set(o, now);
  game._nearLabels = { key, set };
  return set;
}

/** How visible a nearby node's brief label is now: 1 while fresh, fading to 0
 *  over its last half second, 0 once its moment has passed. */
export function nearLabelAlpha(game, o) {
  if (!nearbyWorkable(game).has(o)) return 0;
  const left = NEAR_LABEL_MS - ((game.playMs || 0) - (game._nearSince?.get(o) ?? 0));
  return left <= 0 ? 0 : Math.min(1, left / 500);
}

/** How strongly this tree / rock / fishing spot shows its name pill, 0 to 1
 *  (0 = no pill; a brief nearby label fades out at the end). */
export function objectLabelAlpha(game, o, mode = labelMode(game)) {
  if (!isLabelledObject(o) || mode === 'off') return 0;
  if (mode === 'all') return 1;
  if (game.hover?.obj === o) return 1;
  if (game.player?.action?.obj === o) return 1;
  return nearLabelAlpha(game, o);
}

/** Should this tree / rock / fishing spot show its name pill? */
export function objectLabelVisible(game, o, mode = labelMode(game)) {
  return objectLabelAlpha(game, o, mode) > 0;
}

/** NPC ids that a quest in progress is sending you to talk to, refreshed once
 *  a tick. (Quests not yet started don't count, or every quest giver in town
 *  would wear a name.) */
export function questNpcIds(game) {
  const memo = game._questNpcLabels;
  if (memo && memo.tick === game.tickCount) return memo.ids;
  const ids = new Set();
  if (game.quests && game.questGuide) {
    for (const id of Object.keys(game.quests)) {
      const st = game.quests[id]?.state;
      if (st !== 'active') continue;
      try {
        const g = game.questGuide(id);
        if (g?.kind === 'npc' && g.npcId) ids.add(g.npcId);
      } catch { /* a guide that can't be worked out just gets no label */ }
    }
  }
  game._questNpcLabels = { tick: game.tickCount, ids };
  return ids;
}

/** Should this creature or townsperson show its name over its head? */
export function npcNameVisible(game, n, mode = labelMode(game)) {
  if (!n || !n.alive || mode === 'off') return false;
  if (mode === 'all') return true;
  const p = game.player;
  if (n.def?.boss || n.champion) return true;
  if (p?.target === n || n.target === p) return true;
  if (game.hover?.npc === n) return true;
  // Quest givers you still need; monsters never count (a hunt task names a kind, not one foe).
  return !n.attackable && questNpcIds(game).has(n.npcId);
}

/** The compact tag drawn under your target's health bar: race icon, ▲/▼ for
 *  how your weapon fares, and one status (the biggest wound stack) if any.
 *  The long version lives in the battle bar and the hover text (foeDetails). */
export function targetTag(game, n) {
  const r = RACES[raceOf(n.def, n.npcId)] || RACES.beast;
  const m = game.raceMatchup ? game.raceMatchup(n) : null;
  const arrow = m === 'strong' ? '▲' : m === 'weak' ? '▼' : '';
  const poison = n.wounds?.poison?.length || 0, bleed = n.wounds?.bleed?.length || 0;
  const burns = n.ignite?.burns?.length || 0;
  let status = '';
  const top = Math.max(poison, bleed, burns);
  if (top > 0) status = (top === poison ? '☠' : top === bleed ? '🩸' : '🔥') + (top > 1 ? top : '');
  return `${r.icon}${arrow}${status ? ' ' + status : ''}`;
}

/** The full read-out on a foe: race, matchup, weakness, armour and wounds. */
export function foeDetails(game, n) {
  const r = RACES[raceOf(n.def, n.npcId)] || RACES.beast;
  const m = game.raceMatchup ? game.raceMatchup(n) : null;
  const parts = [`${r.icon} ${r.name}${m === 'strong' ? ' ▲' : m === 'weak' ? ' ▼' : ''}`,
    `weak: ${weaknessOf(n.def)}`, `armour: ${armourTierOf(n.def)}`];
  if (n.wounds?.poison?.length) parts.push(`poisoned ×${n.wounds.poison.length}`);
  if (n.wounds?.bleed?.length) parts.push(`bleeding ×${n.wounds.bleed.length}`);
  if (n.ignite?.burns?.length) parts.push(`burning ×${n.ignite.burns.length}`);
  return parts.join(' · ');
}
