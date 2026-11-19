// Elder and Dire monsters drop more loot; every class hits 20% harder.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, rankLootRolls, rollRankLoot, monsterRank, RANK_LOOT_ROLLS, CLASS_POWER } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import * as combat from '../src/game/combat.js';
import { ALL_MONSTER_IDS, getNpc } from '../src/data/npcs.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function game() {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}

test('Elder and Dire monsters roll their loot more times than the plain rank', () => {
  assert.equal(rankLootRolls({ name: 'Elder sea snake', family: 'sea_snake' }), RANK_LOOT_ROLLS.Elder);
  assert.equal(rankLootRolls({ name: 'Dire wild boar', family: 'wild_boar' }), RANK_LOOT_ROLLS.Dire);
  assert.equal(rankLootRolls({ name: 'Wild boar', family: 'wild_boar' }), 1, 'a species named Wild boar is not a Wild form');
  assert.equal(rankLootRolls({ name: 'Young rat', family: 'rat' }), 1, 'Young is the weaker form: no extra');
  assert.equal(rankLootRolls({ name: 'Elderberry bush', family: 'elderberry_bush' }), 1, 'only the rank word counts');
  // Every labelled rank above the plain species rolls more, the tougher the more.
  const order = ['Wild', 'Feral', 'Elder', 'Dire', 'Ancient', 'Mythic', 'Primordial', 'Eternal', 'Celestial', 'Divine'];
  for (let i = 1; i < order.length; i++) assert.ok(RANK_LOOT_ROLLS[order[i]] > RANK_LOOT_ROLLS[order[i - 1]], order[i]);
  // Every rank word in the monster list has a loot entry (except Young).
  for (const id of ALL_MONSTER_IDS) { const r = monsterRank(getNpc(id)); if (r && r !== 'Young') assert.ok(RANK_LOOT_ROLLS[r] > 1, `${r} (${id}) gets extra loot`); }
  // Halves: 1.5 is one roll, plus one more half the time.
  assert.equal(rollRankLoot({ name: 'Wild rat', family: 'rat' }, () => 0.4), 2);
  assert.equal(rollRankLoot({ name: 'Wild rat', family: 'rat' }, () => 0.6), 1);
  const ids = ALL_MONSTER_IDS.filter((id) => /^(elder|dire)_/.test(id));
  assert.ok(ids.length > 10, 'there are Elder and Dire monsters');
  // Drop counts over many kills: a Dire monster brings home well over what its plain kin do.
  const g = game();
  const avg = (id) => {
    let n = 0; const N = 300;
    const orig = g._autoLoot; g._autoLoot = (loot) => { n += loot.length; };
    for (let i = 0; i < N; i++) g.rollDrops({ def: getNpc(id), npcId: id, x: 0, y: 0 });
    g._autoLoot = orig; return n / N;
  };
  const dire = ids.find((id) => id.startsWith('dire_'));
  const plain = dire.replace(/^dire_/, '');
  assert.ok(getNpc(plain), `${plain} exists`);
  assert.ok(avg(dire) > avg(plain) * 1.6, `${dire} drops more than ${plain}`);
});

test('every class hits 20% harder', () => {
  assert.equal(CLASS_POWER, 1.2);
  const g = game();
  const npc = g.npcs.find((n) => n.def.attackable && !n.def.boss);
  npc.hp = 1e9; npc.maxHp = 1e9;
  const mode = g.combatMode();
  // A fresh character against a monster with no weakness or race edge: the
  // damage multiplier is armour times CLASS_POWER (nothing else is in play yet).
  const { armourOf, armourMult } = combat;
  const m = g._offensiveMods(npc, mode);
  const armour = armourMult(armourOf(npc.def, { champion: npc.champion, fightLevel: g.fightLevel() }), g.equipment.bonuses().pierce, m.weak);
  if (!m.weak && !m.race) assert.ok(Math.abs(m.dmgM / armour - CLASS_POWER) < 0.25, `x${(m.dmgM / armour).toFixed(3)} over armour`);
  assert.ok(m.dmgM >= armour * CLASS_POWER * 0.999, 'at least the class power on top of armour');
});
