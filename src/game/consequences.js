// Choices that change the world (data in src/data/consequences.js): which
// changes your moral choices and finished region quests have brought about,
// the residents they bring or send away, the shop prices they move, and the
// touch of light or gloom they leave on a region. Everything here is worked
// out from game.moral.choices and game.quests, which the save already keeps,
// so a reload rebuilds the same world with no extra saved state.
import { CONSEQUENCES, RESIDENTS } from '../data/consequences.js';
import { moodFor } from '../render/ambience.js';
import { NPC } from './npc.js';

/** Has this consequence's condition been met? */
export function consequenceMet(game, c) {
  const w = c.when || {};
  if (w.moral) return game.moral?.choices?.[w.moral] === w.side;
  if (w.quest) return game.quests?.[w.quest]?.state === 'done';
  return false;
}
/** Every consequence in force now. */
export const activeConsequences = (game) => CONSEQUENCES.filter((c) => consequenceMet(game, c));
/** Those in force in one region (for the Regions journal). */
export const consequencesIn = (game, region) => activeConsequences(game).filter((c) => c.region === region);

/** Your buying price multiplier at a shop from the consequences in force (1 = none). */
export function consequencePriceMult(game, shopId) {
  let m = 1;
  for (const c of CONSEQUENCES) if (c.price?.shop === shopId && consequenceMet(game, c)) m *= c.price.buy;
  return m;
}

/** A region's tone from the consequences there: +n brighter, -n gloomier. */
export function regionTone(game, region) {
  let t = 0;
  for (const c of CONSEQUENCES) if (c.mood && c.region === region && consequenceMet(game, c)) t += c.mood;
  return Math.max(-2, Math.min(2, t));
}

// Washes over the region's own mood: a light warm one reads a touch brighter,
// a dusky one a touch gloomier. Subtle on purpose.
const BRIGHT = [255, 244, 210], GLOOM = [62, 58, 96];
const _moods = {};
/**
 * The colour mood the renderer eases towards in a region (ambience.js's
 * moodFor), shaded by the consequences there. Cached per region and tone, so
 * asking every frame costs a lookup.
 */
export function worldMood(game, zoneName) {
  const base = moodFor(zoneName);
  const t = game ? regionTone(game, zoneName) : 0;
  if (!t) return base;
  const key = zoneName + t;
  if (_moods[key]) return _moods[key];
  const to = t > 0 ? BRIGHT : GLOOM, k = Math.min(1, Math.abs(t) * 0.5);
  const a = base[3] || 0;
  const mood = [
    base[0] + (to[0] - base[0]) * k, base[1] + (to[1] - base[1]) * k, base[2] + (to[2] - base[2]) * k,
    t > 0 ? Math.max(0.04, a) + 0.02 * Math.abs(t) : a + 0.05 * Math.abs(t),
  ];
  return (_moods[key] = mood);
}

// ---------------- Residents ----------------
/** Is a resident living in the world now? */
export function residentPresent(game, id) {
  const r = RESIDENTS[id];
  if (!r) return false;
  const active = activeConsequences(game);
  if (active.some((c) => c.leaves === id)) return false;
  if (r.always) return true;
  return active.some((c) => (Array.isArray(c.npc) ? c.npc.includes(id) : c.npc === id));
}

/** Put a resident on the nearest free tile to their spot, in their region. */
export function spawnResident(game, id) {
  const r = RESIDENTS[id];
  if (!r || game.npcs.some((n) => n.npcId === id)) return null;
  const w = game.world, taken = new Set(game.npcs.map((n) => n.x * 4096 + n.y));
  let spot = null;
  for (let rad = 0; rad <= 8 && !spot; rad++) {
    for (let dy = -rad; dy <= rad && !spot; dy++) for (let dx = -rad; dx <= rad && !spot; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
      const x = r.at[0] + dx, y = r.at[1] + dy;
      if (!w.inBounds(x, y) || w.isBlocked(x, y) || w.objectAt(x, y) || taken.has(x * 4096 + y)) continue;
      if (w.zoneAt(x, y)?.name !== r.region) continue;
      spot = { x, y };
    }
  }
  if (!spot) return null;
  // Spawn options keep a borrowed monster's art (Lucky the dog) from rolling
  // champion; the random stream is left alone so other spawns roll as before.
  const roll = Math.random;
  Math.random = () => 0.5;
  let n;
  try { n = new NPC(r.art, spot.x, spot.y, 0, { aggressive: false }); } finally { Math.random = roll; }
  n.npcId = id;
  n.artId = id;   // drawn by their own townsfolk picture (sprites.js TOWN_ART), else the one they borrow
  n.wander = 0;
  n.chatter = null;
  n.def = { ...n.def, name: r.name, attackable: false, aggressive: false, aggroRange: 0, role: r.role || 'dialogue',
    dialogue: null, shop: r.shop || null, examine: r.examine, chatter: null, level: 0, boss: false };
  n.life = { resident: id, lines: r.lines || [] };
  game.npcs.push(n);
  return n;
}

/** Send a resident away (they pack up and leave). */
export function removeResident(game, id) {
  const n = game.npcs.find((x) => x.npcId === id);
  if (!n) return false;
  game.npcs = game.npcs.filter((x) => x !== n);
  if (game._life) game._life.list = game._life.list.filter((x) => x !== n);
  return true;
}

/**
 * Bring the world in line with the consequences in force: residents arrive or
 * leave, and anything newly in force is announced (unless `quiet`: the first
 * sync after a load). Returns the consequences that were new. `onSpawn` is
 * told of each resident placed (npclife.js gives them their routine).
 */
export function syncConsequences(game, quiet = false, onSpawn = null) {
  const seen = (game._lifeSeen ||= new Set());
  const fresh = [];
  for (const c of activeConsequences(game)) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    fresh.push(c);
  }
  for (const id of Object.keys(RESIDENTS)) {
    const here = game.npcs.some((n) => n.npcId === id);
    const want = residentPresent(game, id);
    if (want && !here) { const n = spawnResident(game, id); if (n) onSpawn?.(n); }
    else if (!want && here) removeResident(game, id);
  }
  if (!quiet) {
    for (const c of fresh) {
      game.msg?.(c.announce, 'level');
      if (game.player) game.spawnSparkle?.(game.player, c.mood < 0 || c.leaves || c.price?.buy > 1 ? '#9a5ad8' : '#ffd24a', 10);
    }
    if (fresh.length) { game.bus?.emit('rep'); game.saveSoon = true; }
  }
  return fresh;
}
