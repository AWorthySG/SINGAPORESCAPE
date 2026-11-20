// Real boss fights, headlessly: one class at one level against a real boss with
// its mechanics, signature moves and ground attacks live, auto battle fighting it
// the way a player's would (eating, dodging, skills, healers), food in the bag.
// Shared by tests/elements-sieges.test.mjs (the boss fight length guard) and the
// CLI below:
//   node tools/balance/bossfight.mjs --levels 100,300,1000 --classes swordsman,archer,wizard --builds typical,modest --n 2
// Not deployed (the site build copies only index.html, styles, src, assets...).
import { parseArgs } from './common.mjs';
import { setupClass } from './classlab.mjs';
import { getNpc, ALL_BOSS_IDS } from '../../src/data/npcs.js';
import { EQUIP_SLOTS } from '../../src/game/equipment.js';
import { masteryType, MASTERY_RANKS, enchantValue, isMagicItem } from '../../src/game/mastery.js';
import { starterBlessings } from '../../src/game/blessings.js';
import { CLASS_BY_ID } from '../../src/data/classes.js';
import { BOSS_MECHANICS } from '../../src/data/bossMechanics.js';
import { chebyshev } from '../../src/core/utils.js';

/** Upgrades as a player has them at level L. Typical: the late-damage lab's
 *  build (quality, mastery, refining and enchant lines climbing with level).
 *  Modest: the same best-tier gear, but plain, a lower mastery rank, a low refine
 *  and no enchant lines. Both with the best starter blessings. */
export function buildProfile(L, kind = 'typical') {
  if (kind === 'modest') return L <= 100 ? { q: null, rank: 1, star: 2, lines: 0 } : L <= 300 ? { q: null, rank: 2, star: 4, lines: 0 }
    : L <= 1000 ? { q: null, rank: 3, star: 6, lines: 0 } : { q: null, rank: 4, star: 8, lines: 0 };
  if (L <= 50) return { q: 'fine', rank: 1, star: 2, lines: 0 };
  if (L <= 100) return { q: 'fine', rank: 2, star: 4, lines: 1 };
  if (L <= 200) return { q: 'superior', rank: 3, star: 6, lines: 2 };
  if (L <= 300) return { q: 'epic', rank: 4, star: 9, lines: 3 };
  if (L <= 1000) return { q: 'epic', rank: 5, star: 10, lines: 3 };
  return { q: 'legendary', rank: 5, star: 12, lines: 3 };
}

/** A class at level L (classlab's set-up) with the build's upgrades. */
export function kitOut(cls, L, kind = 'typical') {
  const g = setupClass(cls, L), P = buildProfile(L, kind), eq = g.equipment;
  for (const s of EQUIP_SLOTS) {
    const id = eq.slots[s];
    if (!id) continue;
    if (P.q) eq.slotQuality[s] = P.q;
    eq.mastery[masteryType(id)] = MASTERY_RANKS[P.rank].points;
    const off = s === 'shield' && eq.slots.weapon === id;
    (off ? eq.offRefines : eq.refines)[id] = P.star;
    (off ? eq.offEnchants : eq.enchants)[id] = [isMagicItem(id) ? 'magPct' : 'atkPct', 'critDmg', 'crit'].slice(0, P.lines).map((stat) => ({ stat, value: enchantValue(id, stat) }));
  }
  const style = CLASS_BY_ID[cls].style;
  g.activePrayers = new Set(starterBlessings(L, style === 'dance' ? 'melee' : style));
  g.player.hp = g.maxHp();
  return g;
}

const BOSSES = ALL_BOSS_IDS.map((id) => [id, getNpc(id)]).filter(([, d]) => !d.fixed && d.attackable);
/** The n bosses nearest a fight level (level-appropriate, as auto battle sees it). */
export const bossesNear = (level, n = 1) => BOSSES.slice()
  .sort((x, y) => Math.abs(x[1].level - level) - Math.abs(y[1].level - level) || x[0].localeCompare(y[0])).slice(0, n).map((b) => b[0]);

/** One real fight. Returns the seconds it took, whether the boss died, deaths,
 *  and the shares of the fight spent under a mechanic and not hitting the boss. */
export function bossFight(cls, L, bossId, { build = 'typical', maxTicks = 2000, food = 'arowana_feast', foodN = 14 } = {}) {
  const g = kitOut(cls, L, build), p = g.player;
  g.autoCfg.burst = true;     // a real player has the Prayer Burst
  g.autoCfg.bosses = true;
  g.npcs = g.npcs.filter((n) => chebyshev(n.x, n.y, p.x, p.y) > 30);
  for (let i = 0; i < foodN && g.inventory.add(food, 1); i++);
  const t = g._nearestFree(p.x + 3, p.y);
  const boss = g.spawnNpc(bossId, t.x, t.y, { wander: 0 });
  g.update(600);   // it scales to you (Game._scaleBoss) before the first blow
  const life = boss.maxHp;
  let eats = 0;
  const eat = g.eatItem.bind(g);
  g.eatItem = (i) => { eats++; eat(i); };
  g.toggleAutoBattle(true);
  g.attackNpc(boss);
  let ticks = 0, mech = 0, off = 0, away = 0, healed = 0, last = boss.hp, gaveUp = false;
  while (ticks < maxTicks) {
    g.update(600); ticks++;
    if (!boss.alive || boss.hp <= 0 || !p.alive) break;
    if (boss.hp > last) healed += boss.hp - last;
    last = boss.hp;
    if (boss.mech) mech++;
    const a = p.action, on = a?.type === 'attack' && a.npc === boss, onAdd = a?.type === 'attack' && a.npc?.mechHealer === boss;
    if (!on) off++;
    away = on || onAdd ? 0 : away + 1;
    if (away > 25) { gaveUp = true; break; }   // auto battle walked off to something else
  }
  const killed = !boss.alive || boss.hp <= 0;
  return { cls, L, build, bossId, bossLevel: getNpc(bossId).level, fightLevel: g.fightLevel(), lifeScale: life / getNpc(bossId).maxHp,
    secs: ticks * 0.6, killed, died: !p.alive, gaveUp, eats, mechShare: mech / ticks, offShare: off / ticks, healed: healed / life,
    mechanic: BOSS_MECHANICS[bossId]?.type };
}

if (process.argv[1]?.endsWith('bossfight.mjs')) {
  const a = parseArgs();
  const LEVELS = String(a.levels || '100,300,1000').split(',').map(Number);
  const CLS = String(a.classes || 'swordsman,archer,wizard').split(',');
  const BUILDS = String(a.builds || 'typical,modest').split(',');
  const N = Number(a.n || 2), MAX = Number(a.max || 2000);
  const rows = [];
  for (const L of LEVELS) for (const build of BUILDS) for (const cls of CLS) {
    for (const b of bossesNear(setupClass(cls, L).fightLevel(), N)) {
      const r = bossFight(cls, L, b, { build, maxTicks: MAX });
      rows.push(r);
      const end = r.killed ? 'KILL' : r.died ? 'DIED' : r.gaveUp ? 'GAVEUP' : 'TIME';
      console.log(`L${L} ${build.padEnd(7)} ${cls.padEnd(9)} ${b.padEnd(24)} lv${r.bossLevel} fl${r.fightLevel} life x${r.lifeScale.toFixed(2)} ${end} ${r.secs.toFixed(0)}s`
        + ` mech ${(r.mechShare * 100).toFixed(0)}% off-boss ${(r.offShare * 100).toFixed(0)}% eats ${r.eats} healed ${(r.healed * 100).toFixed(0)}% ${r.mechanic}`);
    }
  }
  if (a.json) (await import('node:fs')).writeFileSync(a.json, JSON.stringify(rows));
}
