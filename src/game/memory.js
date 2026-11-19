// NPCs remember you. A short memory of your latest big deeds (a boss or
// champion beaten, a quest finished, a world event won) and what townsfolk
// make of it: a remark as you pass now and then, a personal greeting when you
// talk to them, and a boss's taunt when a fight starts. The words live in
// src/data/npcchatter.js.
//
// game.deeds = { boss, champion, quest, event }: each { name, at } with `at`
// the play time (game.playMs) it happened. Saved as an optional field. A deed
// is "fresh" for two in-game days, then townsfolk move on to other gossip.
//
// No Math.random here: lines are picked by hashing the tick and the NPC, so
// the rest of the game's (seeded) rolls run exactly as they did before.
import { DAY_CYCLE_MS } from '../config.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { raceOf } from '../data/races.js';
import { greetingFor, alignmentTier } from '../data/alignment.js';
import { PET_BY_ID } from './pets.js';
import { weatherAt } from '../render/weather.js';
import { repRank, repAtLeast } from './reputation.js';
import {
  MEMORY_LINES, MORNING_LINES, EVENING_LINES, NIGHT_LINES, RAIN_LINES, AMBIENT_LINES,
  BOSS_TAUNTS_BY_ID, BOSS_TAUNTS_BY_RACE, BOSS_TAUNT_FALLBACK, REGION_NEWS, NEWS_FALLBACK,
} from '../data/npcchatter.js';

export const FRESH_MS = 2 * DAY_CYCLE_MS;
// Passing remarks: at most one every REMARK_EVERY ticks (~12s), from someone
// within REMARK_RANGE tiles who hasn't said anything for a while.
export const REMARK_EVERY = 20, REMARK_RANGE = 5, REMARK_NPC_GAP = 150;
const DEED_KINDS = ['boss', 'champion', 'quest', 'event'];

export const freshDeeds = () => ({});

/** A whole number hashed to [0, 1). */
export function hash01(n) {
  let h = Math.imul((n | 0) ^ 0x2545f491, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca77); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const pick = (arr, r) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
const idHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

/** Note a deed for townsfolk to talk about. */
export function noteDeed(game, kind, name) {
  if (!DEED_KINDS.includes(kind) || !name) return;
  (game.deeds ||= freshDeeds())[kind] = { name: String(name), at: game.playMs || 0 };
}
/** A deed still fresh enough to mention, or null. */
export function freshDeed(game, kind) {
  const d = game.deeds?.[kind];
  return d && (game.playMs || 0) - d.at <= FRESH_MS ? d : null;
}

/** Fill a line's {fields}. */
export function fillLine(line, game, extra = {}) {
  const f = {
    name: game.player?.name || 'friend',
    class: CLASS_BY_ID[game.jobClass]?.name || 'adventurer',
    level: game.fightLevel?.() || 1,
    region: game.currentZoneName || 'here',
    ...extra,
  };
  return line.replace(/\{(\w+)\}/g, (m, k) => (f[k] != null ? String(f[k]) : m));
}

/** The time-of-day and weather lines that fit right now. */
function momentLines(game) {
  const h = game.gameHour?.() ?? 12;
  const out = [];
  if (h >= 5 && h < 11) out.push(...MORNING_LINES);
  else if (h >= 17 && h < 20) out.push(...EVENING_LINES);
  else if (h >= 20 || h < 5) out.push(...NIGHT_LINES);
  const zone = game.world?.zoneAt?.(game.player?.x, game.player?.y);
  if (!zone?.instance && weatherAt(game.playMs || 0).rain > 0.3) out.push(...RAIN_LINES, ...RAIN_LINES);
  return out;
}

/**
 * Everything this person might say about you right now, freshest news first:
 * [{ kind, text }]. `region` is where they stand.
 */
export function memoryLines(game, region) {
  const out = [];
  const fill = (kind, arr, extra) => { for (const l of arr) out.push({ kind, text: fillLine(l, game, { region, ...extra }) }); };
  for (const kind of DEED_KINDS) {
    const d = freshDeed(game, kind);
    if (d) fill(kind, MEMORY_LINES[kind], { [kind]: d.name });
  }
  const pet = game.pets?.active && PET_BY_ID[game.pets.active];
  if (pet) fill('pet', MEMORY_LINES.pet, { pet: pet.name });
  if (region) {
    if (repRank(game, region).id === 'distrusted') fill('distrust', MEMORY_LINES.distrust);
    else if (repAtLeast(game, region, 'friend')) fill('rank', MEMORY_LINES.rank);
  }
  for (const l of momentLines(game)) out.push({ kind: 'moment', text: l });
  fill('name', MEMORY_LINES.name);
  if (game.jobClass) fill('class', MEMORY_LINES.class);
  if ((game.fightLevel?.() || 1) >= 5) fill('level', MEMORY_LINES.level);
  return out;
}

/** One remark, picked by `r` in [0,1): news beats small talk most of the time. */
export function remarkFor(game, region, r) {
  const lines = memoryLines(game, region);
  const news = lines.filter((l) => DEED_KINDS.includes(l.kind) || l.kind === 'pet' || l.kind === 'distrust');
  if (news.length && r < 0.6) return pick(news, r / 0.6).text;
  const rest = lines.length ? lines : AMBIENT_LINES.map((t) => ({ text: t }));
  return pick(rest, r < 0.6 ? r / 0.6 : (r - 0.6) / 0.4).text;
}

// Who makes remarks: townsfolk who aren't busy (no moral scene, no thieving
// mark, not a monster or a hired blade).
const talksToYou = (n) => n.alive && !n.attackable && !n.ally && !n.def.moral && n.def.role !== 'mark' && !n.worldEvent && (n.def.role || n.life);

/** Once a tick: now and then someone near you remarks on your deeds (rate-limited),
 *  and a boss that has just turned on you taunts you. */
export function tickMemory(game) {
  const p = game.player;
  if (!p?.alive) return;
  // Boss taunts: once per engagement (it forgets when it loses its target).
  for (const n of game.nearbyNpcs()) {
    if (!n.def.boss) continue;
    if (n.alive && n.target === p && !n._taunted) {
      n._taunted = true;
      const line = tauntFor(game, n);
      n.chatText = line; n.chatTimer = 5;
      game.msg?.(`${n.name}: "${line}"`, 'combat');
    } else if (n._taunted && (!n.alive || !n.target)) n._taunted = false;
  }
  if (game.tickCount % REMARK_EVERY !== REMARK_EVERY >> 1) return;   // off-beat from the alignment greetings
  let best = null, bd = Infinity;
  for (const n of game.nearbyNpcs()) {
    if (!talksToYou(n) || n.chatTimer > 0) continue;
    if (n._remarkAt && game.tickCount - n._remarkAt < REMARK_NPC_GAP) continue;
    if (n._greetedAt && game.tickCount - n._greetedAt < 16) continue;   // just greeted you
    const d = Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y));
    if (d <= REMARK_RANGE && d < bd) { bd = d; best = n; }
  }
  if (!best) return;
  best._remarkAt = game.tickCount;
  const region = game.world.zoneAt(best.x, best.y)?.name || game.currentZoneName;
  best.chatText = remarkFor(game, region, hash01(game.tickCount * 131 + idHash(best.npcId)));
  best.chatTimer = 4;
}

/** What a boss shouts when it turns on you. */
export function tauntFor(game, npc) {
  const r = hash01(game.tickCount * 17 + idHash(npc.npcId));
  const own = BOSS_TAUNTS_BY_ID[npc.npcId];
  const race = raceOf(npc.def, npc.npcId);
  const lines = own && r < 0.7 ? [own] : BOSS_TAUNTS_BY_RACE[race] || BOSS_TAUNT_FALLBACK;
  return fillLine(pick(lines, r < 0.7 ? r / 0.7 : (r - 0.7) / 0.3), game);
}

// ---------------- Dialogue ----------------
/** A greeting that knows you, for the start of a conversation. */
export function dialogueGreeting(game, npc) {
  const region = game.world?.zoneAt?.(npc.x, npc.y)?.name || game.currentZoneName;
  const tier = alignmentTier(game.alignment?.() || 0).id;
  const r = hash01((game.tickCount || 0) * 7 + idHash(npc.npcId));
  // The wicked get the same nerves in conversation as in the street.
  if (tier === 'villain' || tier === 'wicked') return greetingFor(game.alignment(), r);
  const deed = DEED_KINDS.map((k) => freshDeed(game, k) && k).find(Boolean);
  if (deed && r < 0.7) return fillLine(pick(MEMORY_LINES[deed], r / 0.7), game, { region, [deed]: game.deeds[deed].name });
  if (repAtLeast(game, region, 'known')) return fillLine(pick(MEMORY_LINES.rank.concat(MEMORY_LINES.name), r), game, { region });
  return fillLine(pick(MEMORY_LINES.name, r), game, { region });
}

/** The local news a Friend of the region hears. */
export const regionNews = (region) => REGION_NEWS[region] || NEWS_FALLBACK;

/**
 * Give a conversation a personal touch: it starts with a greeting that knows
 * you, a Friend of the region can ask for the local
 * news, and a living-world resident (who has no dialogue of their own) gets a
 * short chat from their lines. Returns a tree in dialogue.js's shape; the
 * original tree is never changed.
 */
export function personalise(game, npc, tree) {
  if (!npc || npc.def.moral || npc.attackable) return tree;
  const region = game.world?.zoneAt?.(npc.x, npc.y)?.name || game.currentZoneName;
  const speaker = npc.name;
  if (!tree && npc.life?.lines) {
    const r = hash01((game.tickCount || 0) * 5 + idHash(npc.npcId));
    return { start: { speaker, text: fillLine(pick(npc.life.lines, r), game, { region }), options: [{ label: 'Goodbye.', next: 'end' }] } };
  }
  if (!tree) return tree;
  const out = Object.create(tree);
  const greeting = dialogueGreeting(game, npc);   // the same words each time the start comes round
  const friend = npc.def.dialogue === 'region' && repAtLeast(game, region, 'friend');
  Object.defineProperty(out, 'start', {
    get() {
      const node = tree.start;
      if (!node) return node;
      const options = friend ? [{ label: 'Any news around here?', next: 'lifeNews' }, ...node.options] : node.options;
      return { ...node, text: `${greeting} ${node.text}`, options };
    },
  });
  out.lifeNews = { speaker, text: regionNews(region), options: [{ label: 'Thanks.', next: 'start' }] };
  return out;
}

// ---------------- Save ----------------
export function serializeDeeds(game) {
  const out = {};
  for (const k of DEED_KINDS) { const d = game.deeds?.[k]; if (d) out[k] = { name: d.name, at: d.at }; }
  return out;
}
export function loadDeeds(d) {
  const out = freshDeeds();
  if (!d || typeof d !== 'object') return out;
  for (const k of DEED_KINDS) {
    const x = d[k];
    if (x && typeof x.name === 'string' && typeof x.at === 'number' && Number.isFinite(x.at)) out[k] = { name: x.name.slice(0, 80), at: x.at };
  }
  return out;
}
