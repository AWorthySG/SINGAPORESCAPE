// The boss signature deal is frozen (bossWeapons.js): players own these weapons,
// so adding a class must never move a boss's own weapon, or an ascended one, to
// another class or weapon type. Below is the deal as it stood before the Monk
// joined (21 classes over 77 bosses); classes added since only add extra drops
// of their own (LATE_SIGS).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS } from '../src/data/items.js';
import { ASCENDED, LATE_CLASSES, LATE_SIGS, SIG_BOSSES, SIGNATURE_CLASS, sigDropsFor, sigIdFor } from '../src/data/bossWeapons.js';

const DEAL = {
  wizard: ['jade_dragon', 'bukit_brown_revenant', 'kranji_buffalo_king', 'duyung_queen'],
  dancer: ['celestial_garuda', 'the_garuda', 'reservoir_serpent', 'krait_matriarch'],
  lancer: ['spirit_of_badang', 'pulau_hantu_djinn', 'kelong_king_crab', 'jembalang_lord'],
  archer: ['singa_of_temasek', 'demon_lord', 'lion_of_light', 'atlas_moth_empress'],
  sorcerer: ['eternal_wyrm', 'changi_phantom', 'hantu_tinggi', 'toyol_kingpin'],
  juggernaut: ['jenglot_sovereign', 'coral_leviathan', 'chilli_crab', 'arowana_emperor'],
  sniper: ['drowned_admiral', 'wilderness_warlord', 'bedok_bandit_lord', 'slag_titan'],
  pistoler: ['tuas_crane_colossus', 'shadow_sovereign', 'sand_scorpion_king', 'sea_eagle_sovereign'],
  merchant: ['rift_tyrant', 'sentosa_kraken', 'durian_behemoth', 'kranji_bullfrog_emperor'],
  samurai: ['bunian_queen', 'punggol_lantern_spirit', 'buaya_putih', 'strangler_fig_mother'],
  rogue: ['harimau_jadian', 'tualang_treant', 'boar_king', 'bakau_mud_lobster'],
  swordsman: ['abyssal_oarfish', 'molten_golem', 'nian_beast', 'kopitiam_roach_queen'],
  brawler: ['kusu_tortoise', 'timah_drake', 'ubin_stone_frog', 'ubin_quarry_python'],
  berserker: ['orang_minyak', 'mangrove_hydra', 'macaque_alpha', 'toman_tyrant'],
  halberdier: ['coney_behemoth', 'bone_colossus', 'goblin_warchief'],
  ninja: ['shadow_panther', 'night_safari_tiger', 'fenghuang'],
  knight: ['dragon_kiln_wyrm', 'merlion', 'jade_moon_hare'],
  paladin: ['sentosa_megalodon', 'hungry_ghost_king', 'todak_king'],
  ranger: ['supertree_guardian', 'ancient_tembusu', 'void_eel_leviathan'],
  gladiator: ['rune_golem', 'bandit_kingpin', 'typhoon_mother'],
  corsair: ['langsuir_matriarch', 'spider_queen', 'great_argus_monarch'],
};
// The 21 dealt classes' weapon types.
const WEAPON = {
  rogue: 'dagger', swordsman: 'sword', corsair: 'scimitar', paladin: 'mace', knight: 'longsword', berserker: 'battleaxe',
  juggernaut: 'warhammer', gladiator: '2h_sword', lancer: 'spear', brawler: 'claws', samurai: 'katana', halberdier: 'halberd',
  merchant: 'cane', archer: 'shortbow', ranger: 'longbow', pistoler: 'pistol', sniper: 'rifle', ninja: 'shuriken',
  wizard: 'staff', sorcerer: 'wand', dancer: 'whip',
};
const ASC = ['sig_jade_dragon_sniper', 'sig_fenghuang_pistoler', 'sig_celestial_garuda_merchant', 'sig_jade_moon_hare_samurai',
  'sig_spirit_of_badang_rogue', 'sig_singa_of_temasek_swordsman', 'sig_todak_king_brawler', 'sig_eternal_wyrm_berserker',
  'sig_jenglot_sovereign_halberdier', 'sig_jade_dragon_ranger', 'sig_fenghuang_gladiator', 'sig_celestial_garuda_corsair'];

test('every boss keeps the class and weapon type its signature weapon was dealt', () => {
  const pinned = Object.entries(DEAL).flatMap(([cls, bosses]) => bosses.map((boss) => [boss, cls]));
  assert.equal(pinned.length, 77);
  for (const [boss, cls] of pinned) {
    const it = ITEMS[sigIdFor(boss)];
    assert.equal(SIGNATURE_CLASS[boss], cls, `${boss}'s weapon is still for the ${cls}`);
    assert.equal(it.signature.classId, cls, `${it.id}'s class`);
    assert.equal(it.equip.weaponType, WEAPON[cls], `${it.id} is still a ${WEAPON[cls]}`);
  }
  // Every boss listed is pinned (a new boss would join SIG_BOSSES at the end, dealt on from there).
  assert.deepEqual(SIG_BOSSES.map((b) => b[0]).sort(), pinned.map((p) => p[0]).sort());
});

test('the ascended weapons stay as they were, and late classes only add drops of their own', () => {
  assert.deepEqual(ASCENDED.map((a) => a.id), ASC);
  for (const id of ASC) assert.equal(ITEMS[id]?.signature?.ascended, true, `${id} is ascended`);
  for (const a of LATE_SIGS) {
    assert.ok(LATE_CLASSES.includes(a.classId), `${a.id} is for a late class`);
    assert.ok(!(a.classId in WEAPON), `${a.id} is not for a dealt class`);
    assert.equal(ITEMS[a.id]?.signature?.classId, a.classId, `${a.id} exists for its class`);
    assert.equal(sigDropsFor(a.boss)[0].id, sigIdFor(a.boss), `${a.boss} still drops its own weapon first`);
    assert.ok(sigDropsFor(a.boss).some((s) => s.id === a.id), `${a.boss} drops ${a.id} too`);
  }
  assert.equal(new Set(LATE_SIGS.map((a) => a.id)).size, LATE_SIGS.length, 'each late weapon once');
});
