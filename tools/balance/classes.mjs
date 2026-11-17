// Class balance table: every job class at the given levels, damage relative to
// the median class at that level (100 = the median).
//
//   node tools/balance/classes.mjs --levels 50,200        # full: 3 targets, 180 s fights (a few minutes)
//   node tools/balance/classes.mjs --quick                 # 1 target, 60 s fights, level 50 (well under a minute)
//   node tools/balance/classes.mjs --classes merchant,wizard --levels 100 --json
//
// Columns (damage in real HP per second, see classlab.mjs for the set-up):
//   kill   - against level-appropriate monsters with their real life, a fresh one
//            put in place on each death (overkill is wasted, as in play)
//   single - one frozen huge-life dummy (damage over time and allies included)
//   boss   - the same dummy flagged as a boss (boss armour, boss-damage gear)
//   crowd  - five frozen dummies bunched together, total damage to all of them
// Each class is measured in its own child process, several at a time (--jobs).
import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs, median, printTable } from './common.mjs';

const args = parseArgs();
const quick = !!args.quick;
const METRICS = ['kill', 'single', 'boss', 'crowd'];

if (args.child) {
  // Child: measure one class at one level and send the result back.
  const { measureClass } = await import('./classlab.mjs');
  const r = measureClass(args.cls, Number(args.level), { ticks: Number(args.ticks), targets: Number(args.targets), seed: Number(args.seed) });
  process.send(r);
  process.exit(0);
}

const { CLASS_IDS } = await import('./classlab.mjs');
const levels = String(args.levels || (quick ? '50' : '50,200')).split(',').map(Number);
const classes = args.classes ? String(args.classes).split(',') : CLASS_IDS;
const ticks = Number(args.ticks) || (quick ? 100 : 300);
const targets = Number(args.targets) || (quick ? 1 : 3);
const seed = Number(args.seed) || 20261112;
const jobs = Number(args.jobs) || Math.max(1, Math.min(8, availableParallelism() - 1));

const jobsList = levels.flatMap((L) => classes.map((cls) => ({ cls, L })));
const results = [];
const self = fileURLToPath(import.meta.url);
await new Promise((done) => {
  let next = 0, running = 0;
  const launch = () => {
    if (next >= jobsList.length && !running) return done();
    while (running < jobs && next < jobsList.length) {
      const { cls, L } = jobsList[next++];
      running++;
      const child = fork(self, ['--child', '--cls', cls, '--level', String(L), '--ticks', String(ticks), '--targets', String(targets), '--seed', String(seed)], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
      child.on('message', (r) => results.push(r));
      child.on('exit', (code) => { if (code) console.error(`${cls} @ ${L} failed (exit ${code})`); running--; launch(); });
    }
  };
  launch();
});

if (args.json) { console.log(JSON.stringify(results)); process.exit(0); }
console.log(`Damage relative to the median class (100); ${ticks * 0.6} s fights, ${targets} target(s), seed ${seed}.`);
for (const L of levels) {
  const rows = results.filter((r) => r.level === L);
  const med = Object.fromEntries(METRICS.map((m) => [m, median(rows.map((r) => r[m]))]));
  for (const r of rows) for (const m of METRICS) r[m + 'Rel'] = med[m] ? Math.round(100 * r[m] / med[m]) : null;
  rows.sort((a, b) => b.killRel - a.killRel);
  console.log(`\n== Level ${L}  (median real DPS: kill ${med.kill.toFixed(0)}, single ${med.single.toFixed(0)}, boss ${med.boss.toFixed(0)}, crowd ${med.crowd.toFixed(0)})`);
  printTable(rows, [
    { key: 'cls', label: 'class', w: 11, left: true },
    { key: 'weapon', label: 'weapon', w: 24, left: true },
    ...METRICS.map((m) => ({ key: m + 'Rel', label: m, w: 7 })),
  ]);
}
