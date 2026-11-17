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
import { freshGame, parseArgs, printTable } from './common.mjs';
import { CLASS_BY_ID } from '../../src/data/classes.js';

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

if (import.meta.url === `file://${process.argv[1]}`) {
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
