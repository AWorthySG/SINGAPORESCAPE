// Boss signature weapons: every boss has exactly one special weapon, made for
// one job class. The classes are dealt out across the bosses at random, but
// from a fixed seed, so the same boss always serves the same class.
//
// This file imports nothing on purpose. items.js builds the weapons from it
// (calling signatureWeapons() before ITEMS is frozen), and npcs.js and
// classes.js both import items.js, so reading the boss list or the classes
// from those files here would make an import cycle. Instead the bosses and
// classes it needs are listed below, and tests/integration.test.mjs checks
// both lists against npcs.js and classes.js so they can't drift apart.

/** Chance that a boss drops its signature weapon on each kill (1 in 5; was 1 in 10). */
export const SIGNATURE_DROP_CHANCE = 0.2;

// The job classes: id, name and main weapon type (as in CLASSES in classes.js;
// the ones added after the deal are in LATE_CLASSES below).
export const SIG_CLASSES = [
  ['rogue', 'Rogue', 'dagger'], ['swordsman', 'Swordsman', 'sword'], ['corsair', 'Corsair', 'scimitar'], ['paladin', 'Paladin', 'mace'],
  ['knight', 'Knight', 'longsword'], ['berserker', 'Berserker', 'battleaxe'], ['juggernaut', 'Juggernaut', 'warhammer'],
  ['gladiator', 'Gladiator', '2h_sword'], ['lancer', 'Lancer', 'spear'], ['brawler', 'Brawler', 'claws'], ['samurai', 'Samurai', 'katana'],
  ['halberdier', 'Halberdier', 'halberd'], ['monk', 'Monk', 'knuckles'], ['merchant', 'Merchant', 'cane'], ['archer', 'Archer', 'shortbow'], ['ranger', 'Ranger', 'longbow'],
  ['pistoler', 'Pistoler', 'pistol'], ['sniper', 'Sniper', 'rifle'], ['ninja', 'Ninja', 'shuriken'], ['wizard', 'Wizard', 'staff'],
  ['sorcerer', 'Sorcerer', 'wand'], ['dancer', 'Dancer', 'whip'],
];

// Every boss: id, its loot-tier level (`tierLevel` in npcs.js), a short name for
// the weapon and its full name. Listed strongest first, the order the classes
// are dealt in, so every dealt class gets one from the 21 strongest bosses (57 bosses
// over 21 classes leaves six classes with two, and they miss out at the weak end).
// Add new bosses at the END of the list, so the bosses already here keep their
// classes.
export const SIG_BOSSES = [
  ['jade_dragon', 450, 'Jade Dragon', 'The Jade Emperor\'s Dragon'], ['celestial_garuda', 420, 'Celestial Garuda', 'The Celestial Garuda'],
  ['spirit_of_badang', 380, 'Badang', 'Spirit of Badang'], ['singa_of_temasek', 350, 'Singa', 'Singa of Temasek'],
  ['eternal_wyrm', 320, 'Eternal Wyrm', 'The Eternal Wyrm'], ['jenglot_sovereign', 300, 'Jenglot', 'Jenglot Sovereign'],
  ['drowned_admiral', 295, 'Drowned Admiral', 'The Drowned Admiral'], ['tuas_crane_colossus', 270, 'Crane Colossus', 'Tuas Crane Colossus'],
  ['rift_tyrant', 260, 'Rift Tyrant', 'Rift Tyrant'], ['bunian_queen', 235, 'Bunian Queen', 'Bunian Queen'],
  ['harimau_jadian', 210, 'Harimau', 'Harimau Jadian'], ['abyssal_oarfish', 205, 'Oarfish', 'The Abyssal Oarfish'],
  ['kusu_tortoise', 195, 'Kusu Tortoise', 'Great Kusu Tortoise'], ['orang_minyak', 158, 'Orang Minyak', 'Orang Minyak'],
  ['coney_behemoth', 155, 'Coney Behemoth', 'Coney Island Behemoth'], ['shadow_panther', 150, 'Shadow Panther', 'The Shadow Panther'],
  ['dragon_kiln_wyrm', 150, 'Kiln Wyrm', 'Dragon Kiln Wyrm'], ['sentosa_megalodon', 145, 'Megalodon', 'Sentosa Megalodon'],
  ['supertree_guardian', 140, 'Supertree', 'Supertree Guardian'], ['rune_golem', 140, 'Rune Golem', 'Rune Golem'],
  ['langsuir_matriarch', 140, 'Langsuir', 'Langsuir Matriarch'], ['bukit_brown_revenant', 138, 'Revenant', 'Bukit Brown Revenant'],
  ['the_garuda', 135, 'Garuda', 'The Garuda'], ['pulau_hantu_djinn', 132, 'Djinn', 'Pulau Hantu Djinn'],
  ['demon_lord', 130, 'Demon Lord', 'Demon Lord of Pulau'], ['changi_phantom', 128, 'Phantom', 'Changi Phantom'],
  ['coral_leviathan', 125, 'Leviathan', 'Coral Leviathan'], ['wilderness_warlord', 120, 'Warlord', 'Wilderness Warlord'],
  ['shadow_sovereign', 120, 'Shadow Sovereign', 'The Shadow Sovereign'], ['sentosa_kraken', 110, 'Kraken', 'Sentosa Kraken'],
  ['punggol_lantern_spirit', 110, 'Lantern Spirit', 'Punggol Lantern Spirit'], ['tualang_treant', 105, 'Treant', 'Tualang Treant'],
  ['molten_golem', 105, 'Molten Golem', 'Molten Golem'], ['timah_drake', 100, 'Timah Drake', 'Bukit Timah Drake'],
  ['mangrove_hydra', 95, 'Hydra', 'Mangrove Hydra'], ['bone_colossus', 95, 'Bone Colossus', 'Bone Colossus'],
  ['night_safari_tiger', 92, 'Night Tiger', 'Night Safari Tiger'], ['merlion', 90, 'Merlion', 'The Merlion'],
  ['hungry_ghost_king', 88, 'Ghost King', 'Hungry Ghost King'], ['ancient_tembusu', 88, 'Tembusu', 'Ancient Tembusu'],
  ['bandit_kingpin', 85, 'Kingpin', 'Bandit Kingpin'], ['spider_queen', 80, 'Spider Queen', 'Jungle Spider Queen'],
  ['kranji_buffalo_king', 80, 'Buffalo King', 'Kranji Buffalo King'], ['reservoir_serpent', 75, 'Reservoir Serpent', 'Reservoir Serpent'],
  ['kelong_king_crab', 75, 'Kelong King', 'Kelong King Crab'], ['lion_of_light', 72, 'Lion of Light', 'Lion of Light'],
  ['hantu_tinggi', 72, 'Hantu Tinggi', 'Hantu Tinggi'], ['chilli_crab', 70, 'Chilli Crab', 'Chilli Crab Colossus'],
  ['bedok_bandit_lord', 70, 'Bandit Lord', 'Bedok Bandit Lord'], ['sand_scorpion_king', 65, 'Scorpion King', 'Sand Scorpion King'],
  ['durian_behemoth', 60, 'Durian Behemoth', 'Durian Behemoth'], ['buaya_putih', 60, 'Buaya Putih', 'Buaya Putih, the White Crocodile'],
  ['boar_king', 60, 'Boar King', 'The Boar King'], ['nian_beast', 55, 'Nian', 'Nian, the New Year Beast'],
  ['ubin_stone_frog', 45, 'Stone Frog', 'The Stone Frog of Ubin'], ['macaque_alpha', 45, 'Macaque Alpha', 'Macaque Alpha'],
  ['goblin_warchief', 35, 'Goblin Warchief', 'Goblin Warchief'],
  // The bestiary expansion (bestiary.js), strongest first. Their order is chosen so the six
  // that join the 21 strongest are dealt the six classes of the bosses they push out.
  ['fenghuang', 440, 'Fenghuang', 'Fenghuang, the Vermilion Phoenix'], ['jade_moon_hare', 400, 'Jade Hare', 'The Jade Hare of the Moon'],
  ['todak_king', 330, 'Todak King', 'The Todak King'], ['void_eel_leviathan', 245, 'Void Eel', 'The Void Eel Leviathan'],
  ['typhoon_mother', 240, 'Typhoon Mother', 'The Typhoon Mother'], ['great_argus_monarch', 190, 'Argus Monarch', 'The Great Argus Monarch'],
  ['duyung_queen', 150, 'Duyung Queen', 'The Duyung Queen'], ['krait_matriarch', 130, 'Krait Matriarch', 'The Banded Krait Matriarch'],
  ['jembalang_lord', 125, 'Jembalang Lord', 'Jembalang Lord'], ['atlas_moth_empress', 100, 'Moth Empress', 'The Atlas Moth Empress'],
  ['toyol_kingpin', 95, 'Toyol Kingpin', 'The Toyol Kingpin'], ['arowana_emperor', 90, 'Arowana Emperor', 'The Arowana Emperor'],
  ['slag_titan', 68, 'Slag Titan', 'The Slag Titan'], ['sea_eagle_sovereign', 66, 'Sea Eagle', 'The Sea Eagle Sovereign'],
  ['kranji_bullfrog_emperor', 62, 'Bullfrog Emperor', 'The Bullfrog Emperor of Kranji'], ['strangler_fig_mother', 58, 'Fig Mother', 'The Strangler Fig Mother'],
  ['bakau_mud_lobster', 52, 'Mud Lobster', 'Bakau Mud Lobster'], ['kopitiam_roach_queen', 48, 'Roach Queen', 'The Kopitiam Roach Queen'],
  ['ubin_quarry_python', 40, 'Quarry Python', 'The Quarry Python of Ubin'], ['toman_tyrant', 40, 'Toman', 'Toman, the Snakehead Tyrant'],
];

/** The signature weapon's item id for a boss. */
export const sigIdFor = (bossId) => `sig_${bossId}`;

// A small seeded random (mulberry32) and string hash (FNV-1a), so the deal
// and each weapon's extras come out the same in every version of the game.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// Shuffle the classes once, then deal them round-robin down the boss list:
// every class gets two or three bosses, spread from the strongest downwards.
// The deal is frozen: players own these weapons, so no boss's first weapon may
// ever move to another class or weapon type. Classes added after it (LATE_CLASSES)
// stay out of the shuffle, which leaves the first 21 in their order and every
// boss with its class; they get extra drops of their own instead (LATE_SIGS).
const SIG_SEED = 20261114;
export const LATE_CLASSES = ['monk'];
const DEAL_ORDER = (() => {
  const order = SIG_CLASSES.map((c) => c[0]).filter((id) => !LATE_CLASSES.includes(id)), rand = seeded(SIG_SEED);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
})();
/** bossId -> the class its signature weapon is made for. */
export const SIGNATURE_CLASS = Object.fromEntries(SIG_BOSSES.map(([id], i) => [id, DEAL_ORDER[i % DEAL_ORDER.length]]));

// Ascended signature weapons (the owner's ask: every class has a signature weapon
// stronger than its eternal one). A signature weapon is built on the best plain
// weapon its boss's level allows, so only bosses of ASCENDED_LEVEL (the eternal
// tier) and up make one that beats eternal, and those serve only some classes.
// Each other class gets one more weapon, built on the eternal tier, dropped by one
// of those bosses besides its own (dealt from the strongest down). The bosses'
// first weapons stay exactly as they were.
export const ASCENDED_LEVEL = 300;
const TOP_BOSSES = SIG_BOSSES.filter((b) => b[1] >= ASCENDED_LEVEL).sort((a, b) => b[1] - a[1]);
/** [{ boss, classId, id }]: the ascended weapons, in deal order. */
export const ASCENDED = (() => {
  const served = new Set(TOP_BOSSES.map(([id]) => SIGNATURE_CLASS[id]));
  const need = DEAL_ORDER.filter((c) => !served.has(c));
  return need.map((classId, i) => { const boss = TOP_BOSSES[i % TOP_BOSSES.length][0]; return { boss, classId, id: `sig_${boss}_${classId}` }; });
})();
// The late classes' signature weapons: three a class, hand-picked, each an extra
// drop rolled on its own like an ascended one. One comes from a boss of the
// eternal tier (so it is ascended, stronger than eternal) and two from earlier
// bosses. Append only: never move or remove one (players own them).
// [{ boss, classId, id }], like ASCENDED.
export const LATE_SIGS = [
  ['monk', 'spirit_of_badang'], ['monk', 'harimau_jadian'], ['monk', 'macaque_alpha'],   // 380 the strongman, 210 the were-tiger, 45 the monkey style
].map(([classId, boss]) => ({ boss, classId, id: `sig_${boss}_${classId}` }));
/** Every signature weapon a boss drops: [{ id, classId }], its own first, then any ascended and late ones. */
export function sigDropsFor(bossId) {
  if (!SIGNATURE_CLASS[bossId]) return [];
  return [{ id: sigIdFor(bossId), classId: SIGNATURE_CLASS[bossId] },
    ...[...ASCENDED, ...LATE_SIGS].filter((a) => a.boss === bossId).map(({ id, classId }) => ({ id, classId }))];
}

// A noun for each weapon type: "Nian's Fang", "Kelong King's Longbow".
const NOUNS = {
  dagger: ['Fang', 'Sting'], sword: ['Edge', 'Blade'], scimitar: ['Crescent', 'Cutlass'], mace: ['Crusher', 'Sceptre'],
  longsword: ['Longblade', 'Oathblade'], battleaxe: ['Cleaver', 'Reaver'], warhammer: ['Hammer', 'Maul'], '2h_sword': ['Greatsword', 'Greatblade'],
  spear: ['Lance', 'Pike'], claws: ['Claws', 'Talons'], katana: ['Katana', 'Moonblade'], halberd: ['Halberd', 'Glaive'],
  cane: ['Cane', 'Gilded Cane'], shortbow: ['Shortbow', 'Stingbow'], longbow: ['Longbow', 'Warbow'], pistol: ['Pistol', 'Flintlock'],
  rifle: ['Longgun', 'Rifle'], shuriken: ['Stars', 'Shuriken'], staff: ['Staff', 'Stave'], wand: ['Wand', 'Rod'], whip: ['Lash', 'Whip'],
  knuckles: ['Knuckles', 'Fists'],
};
// How much stronger than the plain weapon of its tier: its fighting bonuses x1.3.
export const SIGNATURE_MULT = 1.3;
const SCALED = ['attack', 'strength', 'ranged', 'magic', 'magicStr', 'dance'];
// Two offensive extras per weapon, picked from the boss's id. Values start at
// about the boss uniques' (tiger_kris and friends) and grow to double for the
// strongest bosses.
const EXTRA_BASE = { crit: 3, critDmg: 10, pierce: 4, lifesteal: 2, haste: 2, bossDmg: 6, atkPct: 6, magPct: 6 };
const LVL_LO = 35, LVL_HI = 450;

/**
 * Build every boss's signature weapon from the plain weapon of its class's type
 * at the boss's tier. `RAW` is items.js's table (not yet classified or frozen),
 * `classify(id, equip)` its weapon-type classifier, `skip` ids that can't be a base
 * (the boss uniques). Returns the new items, their weapon types (for UNIQUE_TYPE)
 * and their extra offensive lines (for OFFENCE_EXTRA).
 */
export function signatureWeapons(RAW, classify, skip = new Set()) {
  const items = {}, types = {}, extras = {};
  const req = (eq) => Math.max(1, ...Object.values(eq.req || {}));
  const power = (b) => SCALED.reduce((s, k) => s + (b[k] || 0), 0);
  const byType = {};
  for (const [id, it] of Object.entries(RAW)) {
    const eq = it.equip;
    if (!eq || eq.slot !== 'weapon' || it.tool || skip.has(id)) continue;
    const t = classify(id, eq);
    if (t) (byType[t] = byType[t] || []).push(id);
  }
  const jobs = [...SIG_BOSSES.map(([bossId, level, short, full]) => [bossId, level, short, full, SIGNATURE_CLASS[bossId], sigIdFor(bossId)]),
    ...[...ASCENDED, ...LATE_SIGS].map(({ boss, classId, id }) => { const [, level, short, full] = SIG_BOSSES.find((b) => b[0] === boss); return [boss, level, short, full, classId, id]; })];
  for (const [bossId, level, short, full, sigClass, id] of jobs) {
    const cls = SIG_CLASSES.find((c) => c[0] === sigClass);
    const [classId, className, type] = cls;
    // The best plain weapon of the type the boss's tier allows (the lowest if none does).
    const list = (byType[type] || []).slice().sort((a, b) => req(RAW[b].equip) - req(RAW[a].equip) || power(RAW[b].equip.bonuses || {}) - power(RAW[a].equip.bonuses || {}));
    const baseId = list.find((x) => req(RAW[x].equip) <= level) || list[list.length - 1];
    if (!baseId) throw new Error(`no ${type} weapon to base ${bossId}'s signature weapon on`);
    const base = RAW[baseId], h = hash(id === sigIdFor(bossId) ? bossId : id);   // a boss's first weapon keeps its old hash
    const bonuses = { ...(base.equip.bonuses || {}) };
    for (const k of SCALED) if (bonuses[k]) bonuses[k] = Math.round(bonuses[k] * SIGNATURE_MULT);
    const ascended = id !== sigIdFor(bossId) && level >= ASCENDED_LEVEL;   // an extra one from a boss of the eternal tier
    const nouns = NOUNS[type];
    const article = /^[AEIOU]/.test(className) ? 'an' : 'a';
    const boss = full.replace(/^The /, 'the ');
    items[id] = { ...base, name: `${short}'s ${ascended ? 'Ascended ' : ''}${nouns[h % nouns.length]}`, value: Math.round((base.value || 100) * 3),
      examine: ascended ? `Signature weapon of ${boss}, ascended past the eternal tier. Made for ${article} ${className}'s hand.`
        : `Signature weapon of ${boss}. Made for ${article} ${className}'s hand.`,
      signature: { boss: bossId, classId, base: baseId, hue: h % 360, ...(ascended ? { ascended: true } : {}) },   // hue: its icon's tint
      equip: { ...base.equip, req: { ...(base.equip.req || {}) }, bonuses } };
    types[id] = type;
    // Two different extras, picked by the hash; magic weapons take Magic bonus %, the rest Physical damage bonus %.
    const pool = ['crit', 'critDmg', 'pierce', 'lifesteal', 'haste', 'bossDmg', base.equip.combatType === 'magic' ? 'magPct' : 'atkPct'];
    const a = h % pool.length, b = (a + 1 + ((h >>> 8) % (pool.length - 1))) % pool.length;
    const f = 1 + Math.min(1, Math.max(0, (level - LVL_LO) / (LVL_HI - LVL_LO)));
    extras[id] = { [pool[a]]: Math.round(EXTRA_BASE[pool[a]] * f), [pool[b]]: Math.round(EXTRA_BASE[pool[b]] * f) };
  }
  return { items, types, extras };
}
