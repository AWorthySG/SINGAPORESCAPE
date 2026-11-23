// The XP a line names is the XP the player really gets. Skills.addXp multiplies
// every amount by the XP rate, the life-skill boost (with its past-99 rate) and
// the bonus of the moment (golden hours, rested XP, a gathering streak); some
// chat lines used to print the amount before all that, 31x too small or worse.
// Now a line that reports a gain prints what addXp returns, and a menu that
// shows a reward first asks Skills.xpAtLevel. Each test here reads the number
// back out of the line and checks it against skills.xp before and after.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { NPC } from '../src/game/npc.js';
import { UI } from '../src/ui/ui.js';
import { GATHER_FUN, Gathering, nodeXp } from '../src/game/gathering.js';
import { resolveCook, COOKING } from '../src/game/skilling.js';
import { itemOtherUses, allRecipes } from '../src/game/skillguide.js';
import { cullingInvOptions } from '../src/ui/cullingui.js';
import { openSkillContracts } from '../src/ui/lifeskillui.js';
import { itemPageHTML } from '../src/ui/skillguideui.js';
import { xpForLevel, maxXpFor } from '../src/data/xp.js';
import { LIFE_STAGES, LIFE_GRAD } from '../src/data/lifeskills.js';
import { SKILL_BY_ID } from '../src/data/skills.js';
import { ITEMS, getItem } from '../src/data/items.js';
import { boneXp, ALTAR_XP_MULT } from '../src/data/bones.js';
import { XP_RATE, LIFE_XP_BOOST } from '../src/config.js';
import { formatNumber } from '../src/core/utils.js';

const RESTED = 3600000;   // an hour of rested XP: every gain x1.5, so a line that leaves it out is caught

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function boot(cls = 'swordsman') {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = g.npcs.filter((n) => !n.attackable);   // nothing wanders in to fight
  return g;
}
/** Every chat line from now on. */
function listen(g) {
  const said = [], msg = g.msg.bind(g);
  g.msg = (t, k) => { said.push(t); return msg(t, k); };
  return said;
}
const num = (s) => Number(String(s).replace(/,/g, ''));
const bag = (g) => { const m = new Map(); for (const s of g.inventory.slots) if (s) m.set(s.id, (m.get(s.id) || 0) + s.qty); return m; };
/** One successful gather at `obj`, as the game's gathering tick would report it. */
function gatherOnce(g, obj, id, type) {
  const before = bag(g);
  g.inventory.add(id, 1);
  g.tickCount++;
  return g.gathering.onGather({ type }, obj, before);
}

test('Skills.addXp returns the XP it really added; xpAtLevel is that amount before the bonus of the moment', () => {
  const g = boot();
  for (const [s, L] of [['mining', 50], ['mining', 249], ['attack', 120], ['prayer', 70], ['agility', 300]]) {
    g.skills.xp[s] = xpForLevel(L);
    const x0 = g.skills.xp[s], worth = g.skills.xpAtLevel(s, 10);
    const got = g.skills.addXp(s, 10);
    assert.equal(got, g.skills.xp[s] - x0, `${s} ${L}: what came back is what was added`);
    assert.ok(Math.abs(got - worth) < 1e-6, `${s} ${L}: nothing passing, so it is the steady rate (${got} vs ${worth})`);
  }
  assert.equal(g.skills.xpAtLevel('mining', 10), 10 * XP_RATE * g.skills.lifeXpMult('mining'));
  // Strength is Melee.
  const a0 = g.skills.xp.attack;
  assert.equal(g.skills.addXp('strength', 10), g.skills.xp.attack - a0);
  // Rested XP comes on top of xpAtLevel, and addXp's answer counts it.
  g.play.rested = RESTED;
  const m0 = g.skills.xp.mining;
  const got = g.skills.addXp('mining', 10);
  assert.equal(got, g.skills.xp.mining - m0);
  assert.ok(Math.abs(got - 1.5 * g.skills.xpAtLevel('mining', 10)) < 1e-6, 'rested: x1.5');
  // Asking what a reward is worth doesn't count as earning XP (it would spend rested time).
  g.play.xpTick = false;
  g.skills.xpAtLevel('mining', 100);
  assert.equal(g.play.xpTick, false);
  // At the cap, only what fits.
  g.skills.xp.woodcutting = maxXpFor('woodcutting') - 10;
  assert.equal(g.skills.addXp('woodcutting', 1000), 10);
  assert.equal(g.skills.addXp('woodcutting', 1000), 0);
  assert.equal(g.skills.addXp('woodcutting', 0), 0);
});

test('a lucky find names the XP it really adds (the rates, rested XP and the streak counted)', () => {
  const g = boot();
  g.todayKey = () => '2026-11-12';   // one day's board, even if the run crosses midnight
  GATHER_FUN.on = true;
  g.gathering.rand = () => 0;   // every roll lucky
  g.skills.xp.woodcutting = xpForLevel(150);   // past 99 the life-skill rate climbs as well
  g.play.rested = RESTED;
  const said = listen(g), banners = [];
  g.banner = (h) => banners.push(h);
  const tree = g.world.objects.find((o) => o.objId === 'oak');
  const x0 = g.skills.xp.woodcutting;
  gatherOnce(g, tree, 'oak_logs', 'woodcut');
  const gained = g.skills.xp.woodcutting - x0;
  const line = said.find((t) => t.startsWith('Lucky find!'));
  const m = line?.match(/ and ([\d,]+) bonus Woodcutting XP\.$/);
  assert.ok(m, line);
  assert.equal(num(m[1]), Math.round(gained), 'the number is the XP added');
  assert.ok(banners.some((h) => h.includes(`and ${m[1]} bonus Woodcutting XP`)), 'and the banner says the same');
  const listed = Math.round(nodeXp(tree.def, 150) * 5);
  assert.ok(num(m[1]) > listed * XP_RATE * LIFE_XP_BOOST, `far more than the listed ${listed}`);
});

test('a skilling contract names the XP it really adds: Cikgu Surya\'s board, the chat line and the banner', () => {
  const g = boot();
  g.todayKey = () => '2026-11-12';   // one day's board, even if the run crosses midnight
  GATHER_FUN.on = true;
  g.gathering.rand = () => 0.99;   // no lucky finds
  const list = g.gathering.ensureContracts();
  assert.ok(list.length >= 2);
  const board = () => {
    let html = '';
    openSkillContracts({ game: g, modal: {}, openModal: (t, render) => { const body = { innerHTML: '' }; render(body); html = body.innerHTML; } });
    return html;
  };
  const shownOn = (html, k) => num(html.split(Gathering.contractText(k))[1].match(/coins, ([\d,]+) XP<\/small>/)[1]);
  const said = listen(g), banners = [];
  g.banner = (h) => banners.push(h);
  const contractLine = () => said.filter((t) => t.startsWith('Skilling contract done')).at(-1);

  // Nothing passing (no streak, nothing rested): the board's figure is exactly what it pays.
  const k = list[0];
  const shown = shownOn(board(), k);
  assert.equal(shown, Math.round(g.skills.xpAtLevel(k.skill, k.xp)));
  assert.ok(shown > k.xp * 30, `the real amount, not the listed ${k.xp}`);
  const x0 = g.skills.xp[k.skill];
  g.gathering.completeContract(k);
  assert.equal(Math.round(g.skills.xp[k.skill] - x0), shown, 'the board told the truth');
  assert.equal(num(contractLine().match(/ and ([\d,]+) \w+ XP\.$/)[1]), shown);

  // Played out, rested and on a streak: the line counts both.
  const TYPE = { woodcutting: 'woodcut', mining: 'mine', fishing: 'fish', hunter: 'hunt' };
  const k2 = list[1];
  g.play.rested = RESTED;
  const obj = g.world.objects.find((o) => o.objId === k2.objId);
  const y0 = g.skills.xp[k2.skill];
  for (let i = 0; i < k2.need; i++) gatherOnce(g, obj, 'feather', TYPE[k2.skill]);
  assert.ok(k2.done);
  const gained = g.skills.xp[k2.skill] - y0;
  const name = SKILL_BY_ID[k2.skill].name;
  const m = contractLine().match(new RegExp(` and ([\\d,]+) ${name} XP\\.$`));
  assert.equal(num(m[1]), Math.round(gained), 'the chat line');
  assert.ok(banners.some((h) => h.includes(`+${m[1]} ${name} XP`)), 'the banner');
  assert.ok(gained > 1.5 * g.skills.xpAtLevel(k2.skill, k2.xp) * 0.99, 'rested and the streak are in it');
});

test('Cikgu Surya\'s lessons and graduation name the XP each skill really gains', () => {
  const g = boot();
  g.skills.xp.mining = xpForLevel(200);   // Mining past 99 earns more, so the six amounts differ
  g.play.rested = RESTED;
  const said = listen(g);
  g.startLife('life_skills');
  for (let i = 0; i < LIFE_STAGES.length; i++) {
    const st = LIFE_STAGES[g.quests.life_skills.stage - 1];
    if (st.need.item) g.inventory.add(st.need.item, st.need.qty);
    else g.skills.addXp(st.skill, st.need.xp);   // practise (Firemaking)
    const before = Object.fromEntries(LIFE_GRAD.skills.map((s) => [s, g.skills.xp[s]]));
    const n0 = said.length;
    g.advanceLife('life_skills');
    const lines = said.slice(n0);
    const lesson = lines.find((t) => t.startsWith(`Lesson complete — ${st.name}!`));
    const lessonXp = num(lesson.match(new RegExp(`\\+([\\d,]+) ${st.name} XP`))[1]);
    assert.ok(lessonXp > st.reward.xp * 30, `${st.name}: the real amount, not the listed ${st.reward.xp}`);
    if (i < LIFE_STAGES.length - 1) {
      assert.equal(lessonXp, Math.round(g.skills.xp[st.skill] - before[st.skill]), `${st.name} lesson`);
      continue;
    }
    const grad = lines.find((t) => t.startsWith('Quest complete') && t.includes('Trades of the Island'));
    assert.ok(grad && !grad.includes('every life skill'), grad);
    const got = {};
    for (const s of LIFE_GRAD.skills) {
      const m = grad.match(new RegExp(`\\+([\\d,]+) ${SKILL_BY_ID[s].name}\\b`));
      assert.ok(m, `${s} is named: ${grad}`);
      got[s] = num(m[1]);
      const gained = g.skills.xp[s] - before[s];
      if (s === st.skill) assert.ok(Math.abs(lessonXp + got[s] - gained) <= 1, `${s}: its lesson and graduation (${lessonXp} + ${got[s]} vs ${gained})`);
      else assert.equal(got[s], Math.round(gained), `${s} graduation`);
    }
    assert.ok(got.mining > got.woodcutting, 'each skill at its own rate');
  }
  assert.equal(g.quests.life_skills.state, 'done');
});

test('a moral choice names the XP it really adds (a life skill\'s boost and rested XP counted)', () => {
  const g = boot();
  g.play.rested = RESTED;
  const said = listen(g);
  const x0 = g.skills.xp.herblore;
  assert.ok(g.moralChoose('beaten_bandit', 'good'));
  const line = said.find((t) => t.includes('a good deed'));
  const m = line?.match(/\+([\d,]+) Herblore XP/);
  assert.ok(m, line);
  assert.equal(num(m[1]), Math.round(g.skills.xp.herblore - x0));
});

test('the boss bonus names what each skill really gains, by its name, Hitpoints too', () => {
  for (const [cls, want] of [['swordsman', ['Melee', 'Hitpoints']], ['dancer', ['Agility', 'Ranged', 'Hitpoints']]]) {
    const g = boot(cls);
    g.play.rested = RESTED;
    // Each gain as skills.xp saw it, and where the boss line fell among them.
    const log = [], add = g.skills.addXp.bind(g.skills);
    g.skills.addXp = (s, n) => { const k = s === 'strength' ? 'attack' : s; const x0 = g.skills.xp[k]; const r = add(s, n); log.push([k, g.skills.xp[k] - x0]); return r; };
    let line = null, at = 0;
    const msg = g.msg.bind(g);
    g.msg = (t, k) => { if (t.startsWith('Boss slain!')) { line = t; at = log.length; } return msg(t, k); };
    const boss = new NPC('goblin_warchief', g.player.x + 2, g.player.y, 0, {});
    boss.hp = 0; g.npcs.push(boss);
    g.killNpc(boss);
    assert.ok(line, `${cls}: the boss line`);
    const parts = [...line.matchAll(/\+([\d,]+) (\w+)/g)].map((m) => [m[2], num(m[1])]);
    assert.deepEqual(parts.map((p) => p[0]), want, line);
    const gains = log.slice(at - want.length, at);
    parts.forEach(([name, n], i) => {
      assert.equal(SKILL_BY_ID[gains[i][0]].name, name);
      assert.equal(n, Math.round(gains[i][1]), `${cls}: ${name}`);
    });
  }
});

test('the forager\'s lamp menu and the cooking menu show what the XP is worth at your level', () => {
  const g = boot();
  // The lamp: its "Rub" option names the XP the rub then adds.
  g.skills.xp.hunter = xpForLevel(50);
  g.inventory.add('forager_lamp', 1);
  const i = g.inventory.slots.findIndex((s) => s?.id === 'forager_lamp');
  const opt = cullingInvOptions({ game: g }, g.inventory.slots[i], i).find((o) => o.label === 'Rub: Hunter');
  const shown = num(opt.target.replace(/ XP$/, ''));
  assert.ok(shown > 25 * 50 * XP_RATE, 'the life-skill boost counted');
  const h0 = g.skills.xp.hunter;
  opt.fn();
  assert.equal(shown, Math.round(g.skills.xp.hunter - h0), 'the lamp gave what its option said');

  // The cooking menu, drawn without a page: each raw food's tooltip.
  const tips = [];
  const el = () => ({ appendChild() {}, addEventListener() {}, insertAdjacentHTML() {}, style: {} });
  globalThis.document = { createElement: el };
  try {
    g.inventory.add('raw_anchovy', 2);
    const ui = { game: g, modal: {}, openModal: (t, render) => render(el()), closeModal() {}, _doAllRow: el, _makeQtyRow: el, _cell: (id, qty, o) => { tips.push(o.tooltip); return el(); } };
    UI.prototype.openCookMenu.call(ui, null);
  } finally { delete globalThis.document; }
  const tip = tips.find((t) => t.includes(getItem(COOKING.raw_anchovy.result).name));
  const n = num(tip.match(/Cooking lvl \d+, ([\d,]+) xp/)[1]);
  const c0 = g.skills.xp.cooking, r = Math.random;
  Math.random = () => 0.99;   // not "perfectly cooked" (that pays half again)
  try { resolveCook(g, { rawId: 'raw_anchovy' }); } finally { Math.random = r; }
  assert.equal(n, Math.round(g.skills.xp.cooking - c0), 'a cooked anchovy pays what its tooltip says');
});

test('bones and the Mark of grace: no listed-XP number where the real one belongs', () => {
  const g = boot();
  // The Prayer texts give the monument's multiple; the bury row's badge has the real XP.
  const use = itemOtherUses('bones').find((o) => o.kind === 'prayer');
  assert.equal(use.text, `Bury for Prayer XP, or offer at a monument for ${ALTAR_XP_MULT}x as much`);
  const row = allRecipes().find((r) => r.kind === 'bury' && r.inputs[0].id === 'bones');
  assert.equal(row.note, `${ALTAR_XP_MULT}x the XP offered at a monument`);
  const badge = Math.round(g.skills.xpAtLevel('prayer', boneXp('bones')));
  assert.ok(itemPageHTML(g, 'bones').includes(`+${formatNumber(badge)} xp each`), 'the bones page shows the real XP');
  g.inventory.add('bones', 1);
  const p0 = g.skills.xp.prayer;
  g.buryBones(g.inventory.slots.findIndex((s) => s?.id === 'bones'), 1);
  assert.equal(Math.round(g.skills.xp.prayer - p0), badge, 'and burying one pays it');
  // A Mark of grace is a fixed amount, not "ten zip-line crossings" (a crossing's XP grows with your level).
  assert.ok(!/zip-line/.test(ITEMS.mark_of_grace.examine));
});
