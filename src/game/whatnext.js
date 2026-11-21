// "What next?": two or three concrete goals picked from where you are now, each
// with a Go that starts on it. New players often stand in Kampong Glam not
// knowing what to do; older ones forget which quest step was next. The card
// sits at the top of the Quest Journal, and its first goal is a tappable row in
// the Objectives tracker (src/ui/whatnextui.js draws both).
//
// Goals, in order (at most three):
//  - gear: a piece in your pack beats what you wear -> Equip best;
//  - quest: the next step of the quest you're on (else the next one to start)
//    -> the journal's own Go (game.questTravel);
//  - skill: a life skill in its golden hours (or one a level or two from new
//    ground) -> walk to the best spot you can work and start;
//  - fight: monsters your level, outside the Wilderness -> walk there and
//    switch auto battle on.
// No DOM and no Math.random, so the tests can drive it.
import { betterRoundsInPack } from './rounds.js';
import { getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { QUESTS } from '../data/quests.js';
import { canWear } from '../data/classes.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { compareGear, meetsReq } from './gear.js';
import { gatherSources } from './skillguide.js';

export const MAX_GOALS = 3;
// A gathering skill this close to its next new source gets a nudge.
export const NEAR_UNLOCK = 2;
// Gathering skills the card can walk you to (each has placed objects).
const GO_SKILLS = ['woodcutting', 'mining', 'fishing', 'hunter', 'thieving', 'agility'];
// The skill card's verb for each.
const VERB = { woodcutting: 'Chop', mining: 'Mine', hunter: 'Trap', thieving: 'Steal from', agility: 'Run' };
/** What to do there, e.g. "Chop Oak tree", "Catch Raw anchovy at an anchovy shoal". */
const doText = (src) => (src.spot ? `Catch ${src.name} at ${/^[aeiou]/i.test(src.spot) ? 'an' : 'a'} ${src.spot.toLowerCase()}` : `${VERB[src.skill] || 'Work'} ${src.name}`);

const skillName = (s) => SKILL_BY_ID[s]?.name || s;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** The pieces in the pack that beat what you wear (and that you can wear now). */
export function packUpgrades(game) {
  const out = [];
  for (const s of game.inventory.slots) {
    if (!s || !getItem(s.id).equip || getItem(s.id).tool) continue;
    if (game.jobClass && !canWear(game.jobClass, s.id)) continue;
    if (!meetsReq(s.id, game.skills).ok) continue;
    if (game._canEquipNow && !game._canEquipNow(s.id)) continue;
    const v = compareGear(s.id, game.equipment, null, s.q || null)?.verdict;
    if (v === 'upgrade' || v === 'empty') out.push(s);
  }
  // Rounds that beat the loaded ones, while a gun is in hand (Equip best loads them).
  const r = betterRoundsInPack(game);
  if (r) out.push(r);
  return out;
}
/** The first of them, or null. */
export const packUpgrade = (game) => packUpgrades(game)[0] || null;

/** The quest to work on next: the first active one with a step to go to,
 *  else the first one you can start. { id, name, text } or null. */
export function nextQuest(game) {
  let start = null;
  for (const d of QUESTS) {
    const st = game.quests[d.id]?.state;
    if (st === 'done') continue;
    const g = game.questGuide(d.id);
    if (g.kind === 'none') continue;
    if (st === 'active') return { id: d.id, name: d.name, text: g.text };
    // The karma quests are a moral choice: never suggested, only taken up by hand.
    if (!start && d.id !== 'redemption' && d.id !== 'corruption') start = { id: d.id, name: d.name, text: g.text };
  }
  return start;
}

/** The best source of `skill` you can work now (your level, and a tool you
 *  carry or wear), with the nearest placed object of it: { src, obj } or null. */
export function bestSource(game, skill) {
  const lvl = game.skills.level(skill);
  const p = game.playerTile();
  const ok = gatherSources().filter((s) => s.skill === skill && s.objIds?.length && s.level <= lvl && (!s.tool || game.hasTool(s.tool)));
  for (const src of ok.slice().sort((a, b) => b.level - a.level)) {
    const ids = new Set(src.objIds);
    let obj = null;
    for (const o of game.world.objects) if (ids.has(o.objId) && !o.depleted && (!obj || dist(o, p) < dist(obj, p))) obj = o;
    if (obj) return { src, obj };
  }
  return null;
}

/** The next new source a skill opens, if it is within NEAR_UNLOCK levels: { src, gap } or null. */
export function nearUnlock(game, skill) {
  const lvl = game.skills.level(skill);
  const next = gatherSources().find((s) => s.skill === skill && s.objIds?.length && s.level > lvl);
  return next && next.level - lvl <= NEAR_UNLOCK ? { src: next, gap: next.level - lvl } : null;
}

/** Monsters to fight at your level: the nearest one a little under to a little
 *  over it that auto battle would take on, outside the Wilderness. */
export function fightTarget(game) {
  const cl = game.fightLevel();
  const p = game.playerTile();
  const lo = Math.max(1, cl - 8), hi = cl + 3;
  let best = null;
  for (const n of game.npcs) {
    if (!n.alive || !n.attackable || n.temporary || n.def.boss || n.def.fixed || n.champion) continue;
    const l = n.def.level || 1;
    if (l < lo || l > hi) continue;
    if (game.world.zoneAt(n.x, n.y)?.wilderness) continue;
    // Prefer the strongest of the band (better XP), then the nearest.
    if (!best || l > best.l + 2 || (Math.abs(l - best.l) <= 2 && dist(n, p) < dist(best.n, p))) best = { n, l };
  }
  return best ? best.n : null;
}

/** Up to MAX_GOALS goals: [{ key, kind, icon, title, text, go }]. */
export function whatNext(game) {
  const out = [];
  if (!game?.player || !game.jobClass) return out;   // nothing to suggest before a class is picked
  const up = packUpgrade(game);
  if (up) out.push({ key: `gear:${up.id}`, kind: 'gear', icon: '&#9650;', title: 'Wear your better gear', text: `${getItem(up.id).name} beats what you wear.`, go: 'Equip' });
  const q = nextQuest(game);
  if (q) out.push({ key: `quest:${q.id}`, kind: 'quest', quest: q.id, icon: '!', title: q.name, text: q.text, go: 'Go' });
  // A life skill: one in its golden hours first, else one about to open new ground.
  const golden = (game.goldenSkills?.() || []).filter((s) => GO_SKILLS.includes(s));
  let sk = null;
  for (const s of golden) { const b = bestSource(game, s); if (b) { sk = { skill: s, ...b, why: `Golden hours: +50% XP` }; break; } }
  if (!sk) {
    for (const s of GO_SKILLS) {
      const nu = nearUnlock(game, s);
      const b = nu && bestSource(game, s);
      if (b) { sk = { skill: s, ...b, why: `${nu.gap} level${nu.gap === 1 ? '' : 's'} to ${nu.src.name}` }; break; }
    }
  }
  if (sk) out.push({ key: `skill:${sk.skill}`, kind: 'skill', skill: sk.skill, obj: sk.obj, icon: '&#10022;', title: `Train ${skillName(sk.skill)}`, text: `${doText(sk.src)}. ${sk.why}.`, go: 'Go' });
  const mob = fightTarget(game);
  if (mob) out.push({ key: `fight:${mob.npcId}`, kind: 'fight', npc: mob, icon: '&#9876;', title: 'Train combat', text: `Fight monsters your level, like the ${getNpc(mob.npcId).name} (level ${mob.def.level || 1}). Auto battle takes over.`, go: 'Go' });
  return out.slice(0, MAX_GOALS);
}

/** Start on a goal (the card's Go). Returns true when something started. */
export function runGoal(game, goal) {
  if (!goal || !game.player.alive) return false;
  if (goal.kind === 'gear') {
    const n = game.equipBest();
    if (!n) game.msg('Nothing in your pack beats what you wear right now.', 'system');
    return n > 0;
  }
  if (goal.kind === 'quest') return game.questTravel(goal.quest) !== false;
  if (goal.kind === 'skill') {
    // The spot may have run dry since the card was drawn: pick again if so.
    const o = goal.obj && !goal.obj.depleted ? goal.obj : bestSource(game, goal.skill)?.obj;
    if (!o) { game.msg(`There's nothing for ${skillName(goal.skill)} I can take you to right now.`, 'system'); return false; }
    return game.goToObject(o);   // MRT hop, the long walk and the first swing (game.js)
  }
  if (goal.kind === 'fight') {
    const n = goal.npc?.alive ? goal.npc : fightTarget(game);
    if (!n) { game.msg('No monsters your level are about right now.', 'system'); return false; }
    if (dist(n, game.playerTile()) <= 12) game.attackNpc(n);
    else game.travelToTile({ x: n.x, y: n.y });   // auto battle picks a fight on arrival
    if (!game.autoBattle) game.toggleAutoBattle(true);
    return true;
  }
  return false;
}
