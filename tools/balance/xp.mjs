// Combat levelling pace: a brand-new character of each fighting style, in its
// starter kit, left on normal auto battle. Prints how long (simulated play
// time) its fighting skill takes to reach each target level.
//
//   node tools/balance/xp.mjs                       # melee, ranged, magic, dance; up to 2 h each
//   node tools/balance/xp.mjs --quick               # 30 simulated minutes each, levels 50 and 99
//   node tools/balance/xp.mjs --classes corsair,wizard --levels 99,200 --minutes 180 --seed 777
//
// Like a player would, the run restocks the starter arrows and runes once a
// minute (999 bronze arrows or air and mind runes otherwise run out within the
// hour and auto battle stops) and turns auto battle back on after a death.
// Gear stays the starter kit. Simulating an hour of play takes roughly a minute
// of real time per class.
//
//   node tools/balance/xp.mjs --geared --classes swordsman,archer,wizard
//
// --geared estimates the long road instead (the starter kit stalls past 99): at
// sample levels up to 300 the class is kitted out as in classlab.mjs, fights
// level-matched monsters put beside it (no walking, so an upper bound on pace)
// with its level pinned, and the XP an hour is summed into hours to each level.
import { freshGame, parseArgs, printTable } from './common.mjs';
import { CLASS_BY_ID } from '../../src/data/classes.js';
import { setupClass, pickTargets } from './classlab.mjs';
import { NPC } from '../../src/game/npc.js';
import { Skills } from '../../src/game/skillset.js';
import { xpForLevel } from '../../src/data/xp.js';

const args = parseArgs();
const quick = !!args.quick;
const classes = String(args.classes || 'corsair,archer,wizard,dancer').split(',');
const levels = String(args.levels || (quick ? '50,99' : '50,99,200')).split(',').map(Number);
const minutes = Number(args.minutes) || (quick ? 30 : 120);
const seed = Number(args.seed) || 20261112;

/** The fighting level that the class's combat XP goes into. */
export function fightLevel(g) {
  const style = CLASS_BY_ID[g.jobClass].style;
  return style === 'dance' ? g.skills.danceLevel() : style === 'melee' ? g.skills.attack : g.skills[style];
}

/** Run one fresh character on auto battle; returns minutes to each level (null if not reached). */
export function paceRun(classId, { levels, minutes, seed }) {
  const g = freshGame(classId, seed);
  const stock = ['bronze_arrow', 'air_rune', 'mind_rune'].filter((id) => g.inventory.count(id) > 0);
  g.toggleAutoBattle(true);
  let deaths = 0;
  const died = g.playerDeath.bind(g);
  g.playerDeath = () => { deaths++; return died(); };
  const reached = {};
  const ticks = Math.round(minutes * 100);   // 100 ticks of 0.6 s per minute
  let t = 0;
  for (; t < ticks; t++) {
    if (t % 100 === 0) for (const id of stock) { const n = g.inventory.count(id); if (n < 999) g.inventory.add(id, 999 - n); }
    if (!g.autoBattle && g.player.alive) g.toggleAutoBattle(true);
    g.update(600);
    const L = fightLevel(g);
    for (const want of levels) if (reached[want] == null && L >= want) reached[want] = (t + 1) / 100;
    if (levels.every((w) => reached[w] != null)) break;
  }
  return { cls: classId, style: CLASS_BY_ID[classId].style, reached, minutes: (t + 1) / 100, level: fightLevel(g),
    defence: g.skills.defence, hitpoints: g.skills.hitpoints, agility: g.skills.agility, kills: g.totalKills,
    deaths };
}

/** Fighting-skill XP an hour at level L, best gear, monsters respawning beside you, level pinned. */
export function gearedRate(cls, L, ticks = 600) {
  const g = setupClass(cls, L);
  g.skills.addXp = Skills.prototype.addXp.bind(g.skills);   // setupClass froze XP
  const sk = { melee: 'attack', ranged: 'ranged', magic: 'magic' }[g.combatMode()] || 'ranged';
  const x0 = { ...g.skills.xp }, ids = pickTargets(L), px = g.player.x, py = g.player.y;
  let gain = 0;
  for (const id of ids) {
    const mk = () => { const t = new NPC(id, px + 1, py, 0, { aggressive: false }); t.tick = () => {}; return t; };
    let t = mk(); g.npcs = [t];
    for (let k = 0; k < ticks / ids.length; k++) {
      g.npcs = g.npcs.filter((n) => n === t || n.ally);
      const p = g.player;
      if (!p.action || p.action.type !== 'attack' || !p.action.npc?.alive) g.attackNpc(t);
      if (g.combatMode() === 'magic' && p.spellAuto) { const b = g._autoSpellFor(t); if (b) p.spell = b.id; }
      g._autoSkills(t);
      g.update(600);
      gain += g.skills.xp[sk] - x0[sk];
      Object.assign(g.skills.xp, x0);
      if (!t.alive || t.hp <= 0) { t = mk(); g.npcs.push(t); }
    }
  }
  return gain * 6000 / ticks;
}

/** Hours to each of `levels` from gearedRate at sample levels (linear in between). */
export function gearedHours(cls, levels, samples = [1, 10, 20, 35, 50, 65, 80, 99, 125, 150, 175, 200, 250, 300]) {
  const pts = samples.map((L) => [L, gearedRate(cls, L)]);
  const rAt = (L) => {
    let i = 0; while (i < pts.length - 1 && pts[i + 1][0] <= L) i++;
    if (i === pts.length - 1) return pts[i][1];
    const [a, ra] = pts[i], [b, rb] = pts[i + 1];
    return ra + (rb - ra) * (L - a) / (b - a);
  };
  const out = {}, top = Math.max(...levels);
  let h = 0;
  for (let L = 1; L < top; L++) { h += (xpForLevel(L + 1) - xpForLevel(L)) / rAt(L); if (levels.includes(L + 1)) out[L + 1] = h; }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}` && args.geared) {
  const lv = args.levels ? levels : [50, 99, 200, 300];
  const rows = classes.map((c) => ({ cls: c, ...Object.fromEntries(Object.entries(gearedHours(c, lv)).map(([L, h]) => ['to' + L, h])) }));
  console.log('Kitted out at each level, monsters beside you (an upper bound on pace); hours of play to each fighting level.');
  printTable(rows, [{ key: 'cls', label: 'class', w: 10, left: true }, ...lv.map((L) => ({ key: 'to' + L, label: 'to ' + L, w: 8, fmt: (v) => v.toFixed(2) + 'h' }))]);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const fmt = (v) => (v == null ? `>${minutes}m` : `${v.toFixed(1)}m`);
  const rows = [];
  for (const c of classes) {
    const t0 = Date.now();
    const r = paceRun(c, { levels, minutes, seed });
    r.real = ((Date.now() - t0) / 1000).toFixed(0) + 's';
    for (const L of levels) r['to' + L] = r.reached[L];
    rows.push(r);
  }
  console.log(`Fresh character, starter kit, auto battle; minutes of play to each fighting level (seed ${seed}).`);
  printTable(rows, [
    { key: 'cls', label: 'class', w: 10, left: true },
    { key: 'style', label: 'style', w: 6, left: true },
    ...levels.map((L) => ({ key: 'to' + L, label: 'to ' + L, w: 8, fmt })),
    { key: 'minutes', label: 'ran', w: 6, fmt: (v) => v.toFixed(0) + 'm' },
    { key: 'level', label: 'lvl', w: 5 },
    { key: 'defence', label: 'def', w: 5 },
    { key: 'hitpoints', label: 'hp', w: 5 },
    { key: 'agility', label: 'agil', w: 5 },
    { key: 'kills', label: 'kills', w: 6 },
    { key: 'deaths', label: 'died', w: 4 },
    { key: 'real', label: 'real', w: 5 },
  ]);
}
