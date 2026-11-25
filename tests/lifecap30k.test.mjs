// The life skills go to level 30,000 (the owner's ask); Defence, Hitpoints,
// Prayer and Slayer stay at 9999 and Melee, Ranged and Magic at 99,999. Every
// life-skill bonus is exactly as it was up to 9999 (checked against values
// recorded before the change), then keeps growing at the pace it had just
// below 9999 to 30,000. Chances stop at 100%.
import './seed.mjs';   // seeded Math.random, and the level haul, unlocks and jackpots off
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { SKILLS } from '../src/data/skills.js';
import {
  MAX_LEVEL, LIFE_MAX_LEVEL, COMBAT_MAX_LEVEL, maxLevelFor, maxXpFor, XP_TABLE, xpForLevel, levelForXp, levelProgress, xpToNext, towardTop, pastSure,
} from '../src/data/xp.js';
import { lifePerkValue } from '../src/game/lifeperks.js';
import { unlockGrowth } from '../src/game/skillunlocks.js';
import { levelHaulPct, LEVEL_HAUL_SURE } from '../src/game/levelhaul.js';
import { haulBonus, passingSchoolSize, SCHOOL_HAUL, SCHOOL_HAUL_MAX } from '../src/game/fishschool.js';
import { greenFingersChance } from '../src/data/trades.js';
import { jackpotBase, jackpotChance, NODE_JACKPOT } from '../src/game/jackpot.js';
import { doubleChance, bigCatchChance, gemChance, extraChance, EXTRA_AT_TOP } from '../src/game/skilling.js';
import { UNLOCKS } from '../src/data/unlocks.js';
import { LEVEL_HAUL } from '../src/game/levelhaul.js';
import { FISH_SCHOOL } from '../src/game/fishschool.js';
import { gatherSources } from '../src/game/skillguide.js';
import { xpRate } from '../src/game/xprate.js';

const LIFE = SKILLS.filter((s) => s.group !== 'combat').map((s) => s.id);

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} }); g.npcs = [];
  return g;
}

// Each bonus as a function of the level (a plain tool, no Stewardship).
const tb0 = { yield: 0, find: 0 };
const dbl = (l) => doubleChance(null, l, tb0, 0), big = (l) => bigCatchChance(null, l, tb0, false, 0), gem = (l) => gemChance(l, tb0);
const smith = (l) => 0.03 + l * 0.001;   // skilling.js smithExtraChance
const BONUS = {
  'perk.mining': (l) => lifePerkValue('mining', l),
  'perk.fishing': (l) => lifePerkValue('fishing', l),
  'perk.herblore': (l) => lifePerkValue('herblore', l),
  'perk.thieving': (l) => lifePerkValue('thieving', l),
  unlockGrowth,
  levelHaulPct,
  schoolBonus: (l) => haulBonus(l, null),
  schoolBonusTop: (l) => haulBonus(l, { speed: 99 }),
  'greenFingers.1': (l) => greenFingersChance(l, 1),
  'greenFingers.300': (l) => greenFingersChance(l, 300),
  jackpotBase,
  jackpotBestTool: (l) => jackpotChance(1, l),
  extraLogsOre: (l) => extraChance(dbl, l),
  extraFish: (l) => extraChance(big, l),
  extraGem: (l) => extraChance(gem, l),
  extraSmith: (l) => extraChance(smith, l),
};
// Recorded on origin/main before the change (tools: a script calling each of these).
const KEYS = ['perk.mining', 'perk.fishing', 'perk.herblore', 'perk.thieving', 'unlockGrowth', 'levelHaulPct', 'schoolBonus', 'schoolBonusTop', 'greenFingers.1', 'greenFingers.300', 'jackpotBase', 'jackpotBestTool', 'extraLogsOre', 'extraFish', 'extraGem', 'extraSmith'];
const BEFORE = {
  1: [0, 0, 0, 0, 1, 0, 0, 50, 0, -2.99, 0.05, 0.075, 0, 0, 0, 0],
  50: [14.8, 2.5, 2, 3, 1, 9.8, 50, 100, 0.49, -2.5, 0.05, 0.075, 0, 0, 0, 0],
  99: [29.5, 4.9, 3.9, 5.9, 1, 19.6, 50, 100, 0.501206272618, -2.01, 0.05, 0.075, 0, 0, 0, 0],
  200: [60, 10, 8, 12, 1.005101010101, 39.8, 100, 150, 0.503744471251, -1, 0.055, 0.0825, 0, 0, 0, 0],
  251: [61.9, 10.3, 8.3, 12.4, 1.007676767677, 50, 100, 150, 0.505026135907, -0.49, 0.055, 0.0825, 0, 0, 0, 0],
  500: [71.3, 11.9, 9.5, 14.3, 1.020252525253, 50.638592531801, 102, 152, 0.511283675111, 0.5038864131, 0.0625, 0.09375, 0, 0, 0, 0],
  960: [88.5, 14.8, 11.8, 17.7, 1.043484848485, 51.818321707017, 104, 154, 0.522843787696, 0.515804746606, 0.0725, 0.10875, 0, 0.017439584297, 0, 0],
  1000: [90, 15, 12, 18, 1.045505050505, 51.920906852688, 104, 154, 0.523849014877, 0.516841123432, 0.075, 0.1125, 0.002212634141, 0.019575043599, 0, 0.001661313545],
  1647: [92.2, 15.4, 12.3, 18.4, 1.078181818182, 53.580221583915, 107, 157, 0.540108564536, 0.533604518603, 0.09, 0.135, 0.038001991371, 0.054116097804, 0.000019954504, 0.037490309004],
  5000: [103.3, 17.2, 13.8, 20.7, 1.247525252525, 62.179421419778, 124, 174, 0.624371733012, 0.620478806094, 0.175, 0.2625, 0.223476048235, 0.233120973769, 0.200742307539, 0.223169786244],
  9998: [120, 20, 16, 24, 1.499949494949, 74.997435371358, 149, 199, 0.74997486932, 0.749974090579, 0.2975, 0.44625, 0.499944684146, 0.499946613517, 0.499940136489, 0.499944622882],
  9999: [120, 20, 16, 24, 1.5, 75, 150, 200, 0.75, 0.75, 0.2975, 0.44625, 0.5, 0.5, 0.5, 0.5],
};
// The chances among them, which stop at 100% (levelHaulPct is a percentage).
const CHANCE = { levelHaulPct: 100, 'greenFingers.1': 1, 'greenFingers.300': 1, jackpotBase: 1, jackpotBestTool: 1, extraLogsOre: 1, extraFish: 1, extraGem: 1, extraSmith: 1 };

test('level caps: life skills 30,000, Defence, Hitpoints, Prayer and Slayer 9999, Melee, Ranged and Magic 99,999', () => {
  assert.equal(LIFE_MAX_LEVEL, 30000);
  assert.deepEqual(LIFE, ['mining', 'smithing', 'crafting', 'fishing', 'cooking', 'firemaking', 'woodcutting', 'thieving', 'agility', 'farming', 'hunter', 'herblore', 'fletching', 'diving', 'construction', 'hawkering', 'archaeology']);
  for (const s of SKILLS) {
    const want = LIFE.includes(s.id) ? LIFE_MAX_LEVEL : ['attack', 'strength', 'ranged', 'magic'].includes(s.id) ? COMBAT_MAX_LEVEL : MAX_LEVEL;
    assert.equal(maxLevelFor(s.id), want, s.id);
    assert.equal(maxXpFor(s.id), XP_TABLE[want], s.id);
  }
  for (const id of ['defence', 'hitpoints', 'prayer', 'slayer']) assert.equal(maxLevelFor(id), 9999, id);
  assert.equal(maxLevelFor('no_such_skill'), MAX_LEVEL);
});

test('the XP table and levelForXp run to 30,000 for a life skill', () => {
  for (let l = 2; l <= LIFE_MAX_LEVEL; l++) assert.ok(XP_TABLE[l] > XP_TABLE[l - 1], `level ${l} costs something`);
  const top = xpForLevel(LIFE_MAX_LEVEL);
  assert.equal(levelForXp(top, LIFE_MAX_LEVEL), LIFE_MAX_LEVEL);
  assert.equal(levelForXp(top - 1, LIFE_MAX_LEVEL), LIFE_MAX_LEVEL - 1);
  assert.equal(levelForXp(top * 10, LIFE_MAX_LEVEL), LIFE_MAX_LEVEL, 'no further');
  assert.equal(levelForXp(xpForLevel(20000), LIFE_MAX_LEVEL), 20000);
  assert.equal(levelProgress(top, LIFE_MAX_LEVEL), 1);
  assert.equal(xpToNext(top, LIFE_MAX_LEVEL), 0);
  assert.equal(xpToNext(xpForLevel(MAX_LEVEL), LIFE_MAX_LEVEL), XP_TABLE[MAX_LEVEL + 1] - XP_TABLE[MAX_LEVEL], '9999 is no longer the top');
  // The default cap (Wisdom, Defence and the like) is still 9999.
  assert.equal(levelForXp(top), MAX_LEVEL);
});

test('every life-skill bonus is as it was at or below 9999', () => {
  for (const [L, row] of Object.entries(BEFORE)) {
    KEYS.forEach((k, i) => {
      const v = BONUS[k](Number(L));
      assert.ok(Math.abs(v - row[i]) < 1e-9, `${k} at ${L}: ${v}, was ${row[i]}`);
    });
  }
  // towardTop and pastSure themselves: 1 at 9999, as before.
  assert.equal(towardTop(MAX_LEVEL, 99), 1);
  assert.equal(pastSure(dbl, MAX_LEVEL), 1);
});

test('past 9999 each bonus keeps growing at the pace it had just below 9999, up to 30,000', () => {
  for (const k of KEYS) {
    const f = BONUS[k], cap = CHANCE[k];
    const at = (l) => f(l);
    assert.ok(at(20000) > at(MAX_LEVEL) || at(MAX_LEVEL) === cap, `${k} grows past 9999 (${at(MAX_LEVEL)} -> ${at(20000)})`);
    assert.ok(at(LIFE_MAX_LEVEL) >= at(20000), `${k} grows on to 30,000`);
    // (A level never passes 30,000; the jackpot's straight line has no end of its own.)
    if (k !== 'jackpotBase') assert.equal(at(LIFE_MAX_LEVEL + 1000), at(LIFE_MAX_LEVEL), `${k} stops at 30,000`);
    if (cap !== undefined) for (const l of [MAX_LEVEL, 15000, 20000, 25000, LIFE_MAX_LEVEL]) assert.ok(at(l) <= cap, `${k} at ${l} is at most 100% (${at(l)})`);
  }
  // The straight-line ones: the step past 9999 is the step just below it (the
  // perks are rounded to a tenth and the school to whole fish, so they are
  // checked over 1000 levels).
  for (const k of ['unlockGrowth', 'levelHaulPct', 'greenFingers.1', 'greenFingers.300', 'extraLogsOre', 'extraFish', 'extraGem', 'extraSmith']) {
    const f = BONUS[k];
    const below = f(MAX_LEVEL) - f(MAX_LEVEL - 1), above = f(MAX_LEVEL + 1) - f(MAX_LEVEL);
    assert.ok(Math.abs(above - below) < 1e-9 && above > 0, `${k}: ${below} a level below 9999, ${above} above`);
  }
  for (const k of ['perk.mining', 'perk.fishing', 'perk.herblore', 'perk.thieving', 'schoolBonus']) {
    const f = BONUS[k];
    const below = f(MAX_LEVEL) - f(MAX_LEVEL - 1000), above = f(MAX_LEVEL + 1000) - f(MAX_LEVEL);
    assert.ok(Math.abs(above - below) <= 1.01 && above > 0, `${k}: +${below} over the 1000 levels below 9999, +${above} over the 1000 above`);
  }
  // The values the PR quotes.
  assert.equal(lifePerkValue('mining', 20000), 153.3);
  assert.equal(lifePerkValue('mining', LIFE_MAX_LEVEL), 186.7);
  assert.equal(unlockGrowth(LIFE_MAX_LEVEL).toFixed(2), '2.51');
  assert.equal(levelHaulPct(LEVEL_HAUL_SURE), 100);
  assert.ok(levelHaulPct(LEVEL_HAUL_SURE - 1) < 100);
  assert.equal(haulBonus(LIFE_MAX_LEVEL, null), 251);
  assert.equal(passingSchoolSize(SCHOOL_HAUL[1], LIFE_MAX_LEVEL, { speed: 99 }), SCHOOL_HAUL_MAX);
  assert.equal(passingSchoolSize(SCHOOL_HAUL[1], MAX_LEVEL, { speed: 99 }), 650, 'as before at 9999');
  assert.ok(Math.abs(jackpotBase(20000) - 0.55) < 1e-12 && Math.abs(jackpotBase(LIFE_MAX_LEVEL) - 0.8) < 1e-12);
  assert.equal(jackpotChance(1, LIFE_MAX_LEVEL), 1, 'with the best tools a whole tree or seam is certain, never more');
  // A double log is certain from 960; the third that grows from it is certain about 19,038.
  assert.equal(extraChance(dbl, 19038), 1);
  assert.ok(extraChance(dbl, 19037) < 1);
  assert.ok(EXTRA_AT_TOP * pastSure(dbl, LIFE_MAX_LEVEL) > 1.5, 'pastSure itself carries on, the chance stops at 100%');
});

test('a life skill trains to 30,000 in a headless game, and a save at the old 9999 cap resumes gaining', () => {
  const g = newGame();
  const ups = [];
  g.bus.on('levelup', (e) => ups.push(e));
  // An old save clamped at 9999 Mining (its XP is all a save keeps).
  g.skills.xp.mining = XP_TABLE[MAX_LEVEL];
  assert.equal(g.skills.level('mining'), MAX_LEVEL);
  const got = g.skills.addXp('mining', XP_TABLE[MAX_LEVEL + 1] - XP_TABLE[MAX_LEVEL]);
  assert.ok(got > 0, 'XP still lands past the old cap');
  assert.ok(g.skills.level('mining') > MAX_LEVEL, `level ${g.skills.level('mining')}`);
  assert.ok(ups.some((e) => e.skill === 'mining' && e.level === MAX_LEVEL + 1), 'a level-up past 9999');
  // On to the top: XP is held at the cap's XP, and the level stops at 30,000.
  g.skills.xp.mining = xpForLevel(LIFE_MAX_LEVEL - 1);
  ups.length = 0;
  g.skills.addXp('mining', 1e12);
  assert.equal(g.skills.level('mining'), LIFE_MAX_LEVEL);
  assert.equal(g.skills.xp.mining, maxXpFor('mining'));
  assert.deepEqual(ups.filter((e) => e.skill === 'mining').map((e) => e.level), [LIFE_MAX_LEVEL]);
  assert.equal(g.skills.addXp('mining', 1000), 0, 'nothing more at the top');
  // Agility (trained apart from the other life skills) goes there too.
  g.skills.addXp('agility', 1e15);
  assert.equal(g.skills.level('agility'), LIFE_MAX_LEVEL);
  // A combat skill outside the fighting three still stops at 9999.
  g.skills.addXp('defence', 1e15);
  assert.equal(g.skills.level('defence'), MAX_LEVEL);
  assert.equal(g.skills.xp.defence, XP_TABLE[MAX_LEVEL]);
  // The XP is what a save keeps: it loads back at 30,000.
  const saved = g.skills.serialize();
  const g2 = newGame();
  g2.skills.load(saved);
  assert.equal(g2.skills.level('mining'), LIFE_MAX_LEVEL);
  assert.equal(g2.skills.level('defence'), MAX_LEVEL);
  // Agility's movement and attack speed keep their ceilings (game.js).
  assert.ok(g.agilitySpeed() < 50 && g.agilityAttackSpeed() < 75, `${g.agilitySpeed()}% / ${g.agilityAttackSpeed()}%`);
});

test("the skill guide's XP an hour stays a real number at 30,000, with every extra on", () => {
  const was = [UNLOCKS.on, NODE_JACKPOT.on, LEVEL_HAUL.on, FISH_SCHOOL.on];
  UNLOCKS.on = NODE_JACKPOT.on = LEVEL_HAUL.on = FISH_SCHOOL.on = true;
  try {
    const g = newGame();
    for (const s of LIFE) g.skills.xp[s] = xpForLevel(LIFE_MAX_LEVEL);
    let n = 0;
    for (const s of gatherSources()) {
      const r = xpRate(g, s);
      if (!r) continue;
      n++;
      assert.ok(Number.isFinite(r.perHour) && r.perHour > 0, `${s.skill} ${s.key || s.objIds?.[0]}: ${r.perHour}`);
    }
    assert.ok(n > 10, `${n} sources priced`);
  } finally { [UNLOCKS.on, NODE_JACKPOT.on, LEVEL_HAUL.on, FISH_SCHOOL.on] = was; }
});
