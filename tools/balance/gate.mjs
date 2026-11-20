// Endless Gate lab: how deep a kitted-out class gets in the gate, measured with
// the real game code headlessly (auto battle drives the run, as a player's
// would). Usage: node tools/balance/gate.mjs [classes] [levels] [waveCap]
//   e.g. node tools/balance/gate.mjs swordsman,archer,wizard 20,60,150 40
import { seedRandom } from './common.mjs';
import { setupClass } from './classlab.mjs';
import { GATE } from '../../src/game/waves.js';

/** Food for a run: a stack of the level's usual meal. */
const foodFor = (L) => (L >= 90 ? 'shark' : L >= 50 ? 'lobster' : L >= 20 ? 'salmon' : 'trout');
export const GATE_FOOD = 20;

/** One run: { wave reached, how it ended, minutes }. */
export function gateRun(cls, L, { cap = 40, seed = 20261112, maxTicks = 60000 } = {}) {
  const g = setupClass(cls, L, seed);
  g.skills.addXp = () => 0;
  g.inventory.add(foodFor(L), GATE_FOOD);
  const p = g.player;
  p.x = p.tx = GATE.x - 1; p.y = p.ty = GATE.y + 1; p.path = [];
  seedRandom(seed);
  g.waves.enter();
  g.toggleAutoBattle(true);
  let t = 0;
  for (; t < maxTicks; t++) {
    g.update(600);
    if (!g.waves.active) break;
    if (g.waves.wave > cap) break;
  }
  const died = !g.waves.active;
  return { wave: died ? g.waves.wave : g.waves.wave - 1, died, capped: !died && g.waves.wave > cap, mins: +(t * 0.6 / 60).toFixed(1) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const classes = (process.argv[2] || 'swordsman,archer,wizard').split(',');
  const levels = (process.argv[3] || '20,60,150').split(',').map(Number);
  const cap = +(process.argv[4] || 40);
  for (const L of levels) for (const c of classes) {
    const r = gateRun(c, L, { cap });
    console.log(`${c.padEnd(11)} L${String(L).padEnd(4)} ${r.died ? 'fell at wave' : r.capped ? 'cleared to ' : 'stalled at '} ${r.wave}  (${r.mins} min)`);
  }
}
