// Culling: a gentle path of progress for clearing harmless creatures (the
// rats, mosquitoes, crabs and birds that never attack first). Four parts that
// work together, all kept free of the DOM so the tests can check them
// headlessly (the windows live in src/ui/cullingui.js):
//
//  1. Codex mastery. Every species in the Monster Codex has three mastery
//     tiers, reached by defeating enough of it (game.kills, which the save
//     already keeps, plus any extra from a Codex quill). Tier 1 hits that
//     species a little harder and finds a little more loot on it, tier 2 more
//     so plus a small bonus against its whole race, and tier 3 adds a title.
//     It counts for every species, aggressive ones and bosses too, but culling
//     is where the kill counts pile up.
//  2. Pest Control contracts. Officer Aziz in Kampong Glam hands out three
//     culling contracts a day ("Cull 25 rats in Bukit Timah"), seeded by the
//     date like the daily bounties, paid in Pest Control tokens and coins.
//     Tokens buy food, Hunter bait, a mosquito-net cape, gathering lamps and
//     Codex quills.
//  3. Stewardship. While you are Neutral (no Holy or Dark tier), culling
//     harmless creatures builds Stewardship, whose ranks give gentle utility
//     perks only: more gathering yield, more healing from food, more Hunter
//     XP. They never touch combat power, so they can't compete with the Holy
//     and Dark paths, and they rest while you walk either path.
//  4. Hunter. Each harmless kill gives a trickle of Hunter XP (by the
//     creature's level) and a small chance of a sensible hide, feather or meat.
//
// Balance (tests/culling.test.mjs, and the sim in the PR notes): an hour of
// culling on auto battle earns far less Hunter XP than an hour at a trap, a
// day's contracts give a couple of dozen tokens at most, and mastery's damage
// is a few percent against species you already farm.
import { getNpc } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { raceOf, RACES } from '../data/races.js';
import { dayKey, seeded } from './bounty.js';
import { CODEX_IDS } from './codex.js';

// ---------------- Who counts as harmless ----------------
/** A harmless creature: one that never attacks first, judged the way
 *  Game.killNpc judges it for alignment (a tamed spawn of a fierce species
 *  still counts as fierce). Bosses, the town watch, Endless Gate waves and
 *  summons never count. */
export function isHarmless(npc) {
  const d = npc?.def;
  if (!d || !d.attackable || d.boss || npc.townGuard || npc.wave || npc.temporary) return false;
  return !d.aggressive && !npc._spawnOpts?.tamed;
}

// ---------------- 1. Codex mastery ----------------
// Kills of one species for each tier, and what each tier gives against that
// species (dmg, loot: fractions) and towards its race (race). Auto battle
// kills a few hundred low-level creatures an hour spread over many species,
// so tier 1 comes in the first session, tier 2 after focused culling, and
// tier 3 (the title) is a long-term goal.
export const MASTERY_TIERS = [
  { tier: 1, kills: 20, name: 'Bronze', dmg: 0.02, loot: 0.05, race: 0 },
  { tier: 2, kills: 200, name: 'Silver', dmg: 0.04, loot: 0.10, race: 0.01 },
  { tier: 3, kills: 2000, name: 'Gold', dmg: 0.05, loot: 0.12, race: 0.02 },
];
/** The race bonus from every species of one race together stops here. */
export const RACE_MASTERY_CAP = 0.10;
// A Codex quill makes this many of your next kills count twice for mastery.
export const QUILL_KILLS = 200;

const CODEX_SET = new Set(CODEX_IDS);
// Title words by race (tier 3), and a few species with a classic of their own.
const TITLE_WORD = {
  beast: 'Tracker', bug: 'Swatter', avian: 'Fowler', reptile: 'Wrangler', aquatic: 'Netter', flora: 'Weeder',
  spirit: 'Exorcist', undead: 'Gravekeeper', humanoid: 'Bane', demon: 'Banisher', construct: 'Breaker', dragon: 'Slayer',
};
const TITLE_SPECIAL = { rat: 'Rat Catcher', chicken: 'Chicken Chaser', mosquito: 'Mosquito Swatter', goblin: 'Goblin Bane', macaque: 'Monkey Minder' };

/** Mastery kills for a species: its kills plus any a Codex quill doubled. */
export const masteryCount = (game, id) => (game?.kills?.[id] || 0) + (game?.culling?.extra?.[id] || 0);

/** The tier (0-3) for a mastery count. */
export function tierFor(count) {
  let t = 0;
  for (const m of MASTERY_TIERS) if (count >= m.kills) t = m.tier;
  return t;
}

/** The tier-3 title for a species ("Rat Catcher"); young, wild, elder and
 *  other variants share their species' title. */
export function titleFor(id) {
  const d = getNpc(id);
  if (TITLE_SPECIAL[d.family]) return TITLE_SPECIAL[d.family];
  const base = getNpc(d.family && CODEX_SET.has(d.family) ? d.family : id).name;
  return `${base} ${TITLE_WORD[raceOf(d, id)] || 'Warden'}`;
}

/** Everything about one species' mastery: { count, tier, name, next (kills
 *  for the next tier, or null), dmg, loot, race, title }. */
export function masteryOf(game, id) {
  const count = masteryCount(game, id), tier = tierFor(count);
  const t = MASTERY_TIERS[tier - 1], nx = MASTERY_TIERS[tier];
  return {
    count, tier, name: t?.name || 'None', next: nx ? nx.kills : null, prev: t ? t.kills : 0,
    dmg: t?.dmg || 0, loot: t?.loot || 0, race: t?.race || 0, title: tier >= 3 ? titleFor(id) : null,
  };
}

/** The race bonus (a fraction) from every species of `race` at tier 2 or 3,
 *  capped at RACE_MASTERY_CAP. Only the species you've fought are looked at. */
export function raceMastery(game, race) {
  let sum = 0;
  const seen = new Set([...Object.keys(game?.kills || {}), ...Object.keys(game?.culling?.extra || {})]);
  for (const id of seen) {
    if (!CODEX_SET.has(id)) continue;
    const t = tierFor(masteryCount(game, id));
    if (t < 2 || raceOf(getNpc(id), id) !== race) continue;
    sum += MASTERY_TIERS[t - 1].race;
  }
  return Math.min(RACE_MASTERY_CAP, Math.round(sum * 1000) / 1000);
}

/** Mastery's damage against this monster: { species, race, mult }, where
 *  mult = (1 + species) x (1 + race). Used by the attack code (_offensiveMods)
 *  and the Stats tab (statsheet.js damageMult), so the two always agree. */
export function masteryDamage(game, npc) {
  if (!npc?.def || !game?.kills) return { species: 0, race: 0, mult: 1 };
  const species = masteryOf(game, npc.npcId).dmg;
  const race = raceMastery(game, raceOf(npc.def, npc.npcId));
  return { species, race, mult: (1 + species) * (1 + race) };
}

/** Titles earned so far: [{ id, title }], one per title. */
export function earnedTitles(game) {
  const out = [], seen = new Set();
  for (const id of Object.keys(game?.kills || {})) {
    if (!CODEX_SET.has(id) || tierFor(masteryCount(game, id)) < 3) continue;
    const title = titleFor(id);
    if (!seen.has(title)) { seen.add(title); out.push({ id, title }); }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/** Wear a title you've earned (by species id), or none (null). */
export function setTitle(game, id) {
  const c = game.culling;
  if (!id) { c.title = null; game.bus.emit('culling'); return true; }
  if (!CODEX_SET.has(id) || tierFor(masteryCount(game, id)) < 3) return false;
  c.title = id;
  game.msg(`You are now known as the ${titleFor(id)}.`, 'system');
  game.bus.emit('culling');
  return true;
}
/** The title you wear, as text (or null). */
export const titleText = (game) => {
  const id = game?.culling?.title;
  return id && CODEX_SET.has(id) && tierFor(masteryCount(game, id)) >= 3 ? `the ${titleFor(id)}` : null;
};

/** How many species sit at each tier: [t1, t2, t3]. */
export function masterySummary(game) {
  const n = [0, 0, 0];
  for (const id of Object.keys(game?.kills || {})) {
    if (!CODEX_SET.has(id)) continue;
    const t = tierFor(masteryCount(game, id));
    if (t) n[t - 1]++;
  }
  return n;
}

// ---------------- 3. Stewardship ----------------
// One point per harmless kill while Neutral. Each rank's perks replace the
// last's (fractions): more gathering yield (a chance of a second log, ore or
// fish), more healing from food, and more Hunter XP.
export const STEWARD_RANKS = [
  { rank: 1, points: 100, name: 'Groundskeeper', yield: 0.02, food: 0.05, hunter: 0.05 },
  { rank: 2, points: 400, name: 'Warden', yield: 0.04, food: 0.10, hunter: 0.10 },
  { rank: 3, points: 1200, name: 'Ranger', yield: 0.06, food: 0.15, hunter: 0.15 },
  { rank: 4, points: 3000, name: 'Steward', yield: 0.08, food: 0.20, hunter: 0.20 },
  { rank: 5, points: 8000, name: 'Keeper of the Isle', yield: 0.10, food: 0.25, hunter: 0.25 },
];
const isNeutral = (game) => (game.karmaCombat?.().side || 'neutral') === 'neutral';

/** Your Stewardship: { points, rank, name, next, yield, food, hunter, active }.
 *  The perks only work while you are Neutral (active); they rest otherwise. */
export function stewardship(game) {
  const points = game?.culling?.steward || 0;
  let r = null;
  for (const s of STEWARD_RANKS) if (points >= s.points) r = s;
  const next = STEWARD_RANKS.find((s) => s.points > points) || null;
  const active = !!r && !!game?.karmaCombat && isNeutral(game);
  return {
    points, rank: r?.rank || 0, name: r?.name || 'None', next: next ? next.points : null, nextName: next?.name || null,
    perkYield: r?.yield || 0, perkFood: r?.food || 0, perkHunter: r?.hunter || 0, active,
    yield: active ? r.yield : 0, food: active ? r.food : 0, hunter: active ? r.hunter : 0,
  };
}

// ---------------- 4. Hunter ----------------
// Hunter XP (before the global XP rate) for each level of a harmless creature
// culled. A trickle: see the balance test.
export const CULL_HUNTER_XP_PER_LEVEL = 0.1;
// Small chances of a sensible catch from a culled creature: by its family
// first, else by its race. Only hides, feathers and meat the Hunter skill knows.
export const CULL_GOODS = {
  family: {
    chicken: [{ id: 'raw_chicken', chance: 0.04 }, { id: 'feather', min: 1, max: 3, chance: 0.06 }],
    wild_boar: [{ id: 'raw_boar_meat', chance: 0.03 }, { id: 'boar_tusk', chance: 0.005 }],
    sambar_deer: [{ id: 'raw_venison', chance: 0.04 }],
    reticulated_python: [{ id: 'python_skin', chance: 0.03 }],
    saltwater_crocodile: [{ id: 'croc_hide', chance: 0.03 }],
  },
  race: {
    avian: [{ id: 'feather', min: 1, max: 3, chance: 0.06 }],
    beast: [{ id: 'squirrel_pelt', chance: 0.02 }],
    reptile: [{ id: 'lizard_skin', chance: 0.02 }],
  },
};
// The mosquito-net cape's Hunter XP bonus.
export const NET_CAPE_HUNTER = 0.05;
// Hunter bait: a baited trap's XP bonus and chance of a second catch.
export const BAIT_XP = 0.10, BAIT_DOUBLE = 0.25;

/** Hunter XP multiplier from culling's side: Stewardship and the mosquito-net cape. */
export function hunterXpMult(game) {
  const cape = game?.equipment?.get?.('cape') === 'mosquito_net_cape' ? NET_CAPE_HUNTER : 0;
  return 1 + stewardship(game).hunter + cape;
}

/** What one catch at a trap gets from culling's side (skilling.js resolveHunt):
 *  { xpMult, double }. Uses up one Hunter bait if you carry any. */
export function huntExtras(game) {
  let xpMult = hunterXpMult(game), double = false;
  if (game.inventory.count('hunter_bait') > 0) {
    game.inventory.remove('hunter_bait', 1);
    xpMult += BAIT_XP;
    double = cullRand(game) < BAIT_DOUBLE;
  }
  return { xpMult, double };
}

/** Gathering's extra chance of a double yield (Stewardship). */
export const yieldBonus = (game) => (game?.culling ? stewardship(game).yield : 0);
/** Food's healing multiplier (Stewardship). */
export const foodMult = (game) => 1 + (game?.culling ? stewardship(game).food : 0);

// Culling's own dice: a small seeded generator, so its rolls never shift the
// game's Math.random sequence (tests replay seeded fights).
export function cullRand(game) {
  let h = game._cullSeed ?? 0x9e3779b9;
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  game._cullSeed = h >>> 0;
  return (game._cullSeed % 100000) / 100000;
}

// ---------------- 2. Pest Control contracts ----------------
export const CONTRACT_COUNT = 3;
// Paid for handing in all three of a day's contracts.
export const FULL_BOARD_TOKENS = 3;

// Plurals for contract text ("mosquitoes", "sambar deer").
const PLURAL_SAME = new Set(['deer', 'fish', 'sheep']);
export function plural(name) {
  const n = name.toLowerCase();
  const last = n.split(' ').pop();
  if (PLURAL_SAME.has(last)) return n;
  if (/(o)$/.test(n) && !/-o-/.test(n) && last !== 'wisp') return n + 'es';
  if (/(s|sh|ch|x|z)$/.test(n)) return n + 'es';
  if (/[^aeiou]y$/.test(n)) return n.slice(0, -1) + 'ies';
  return n + 's';
}

// A contract only sends you to a region whose strongest monsters are at most
// this many levels above you: harmless prey is no use if the walk there is
// through packs that kill a new character (a fresh Rogue sent to Sungei
// Buloh's toyols died on the way).
export const CONTRACT_SAFE_ABOVE = 15;

/** Pick a day's contracts: harmless species near your fight level that live
 *  outside the Wilderness, in a region safe for you. `pool` = [{ id, name,
 *  level, zone, zoneHi }]. Seeded by the date (and your level band), so a
 *  day's board doesn't change on reload. */
export function makeContracts(day, level, pool) {
  const rnd = seeded('pest:' + day + ':' + Math.floor(level / 5));
  const safe = pool.filter((m) => !m.zoneHi || m.zoneHi <= level + CONTRACT_SAFE_ABOVE);
  if (safe.length >= CONTRACT_COUNT) pool = safe;
  let lo = Math.max(1, level - 10), hi = level + 5;
  let picks = [];
  while (picks.length < CONTRACT_COUNT && hi < 20000) {
    picks = pool.filter((m) => m.level >= lo && m.level <= hi);
    lo = Math.max(1, lo - 8); hi += Math.max(8, Math.round(hi * 0.15));
  }
  if (!picks.length) picks = pool.slice();
  const out = [], used = new Set();
  for (let i = 0; i < CONTRACT_COUNT && used.size < picks.length; i++) {
    let m = picks[Math.floor(rnd() * picks.length)];
    for (let k = 0; used.has(m.id) && k < 12; k++) m = picks[Math.floor(rnd() * picks.length)];
    if (used.has(m.id)) m = picks.find((x) => !used.has(x.id));
    used.add(m.id);
    const need = 20 + 5 * Math.floor(rnd() * 5);   // 20, 25 ... 40
    const verb = i === 0 ? 'Clear' : i === 1 ? 'Cull' : 'Thin out';
    out.push({
      id: m.id, name: m.name, zone: m.zone, need, have: 0, done: false, claimed: false,
      text: `${verb} ${need} ${plural(m.name)} in ${m.zone}`,
      tokens: 3 + Math.min(5, Math.floor(m.level / 30)),
      coins: Math.round(m.level * need * 2 + 50),
    });
  }
  return out;
}

/** The harmless species living in the world outside the Wilderness, each in
 *  its safest region (the one with the weakest strongest monsters; the
 *  starter regions have no level range and count as safest). */
export function contractPool(game) {
  const seen = new Map();
  for (const n of game.npcs || []) {
    if (!isHarmless(n) || !CODEX_SET.has(n.npcId)) continue;
    const z = game.world?.zoneAt?.(n.spawnX ?? n.x, n.spawnY ?? n.y);
    if (!z || z.wilderness) continue;
    const old = seen.get(n.npcId), hi = z.hi || 0;
    if (old && old.zoneHi <= hi) continue;
    const d = getNpc(n.npcId);
    seen.set(n.npcId, { id: n.npcId, name: d.name, level: d.level || 1, zone: z.name, zoneHi: hi });
  }
  return [...seen.values()];
}

/** Make sure today's contracts exist. On a new day, any finished contract you
 *  didn't hand in is paid out first, so nothing earned is lost. True if a new
 *  board was drawn up. */
export function ensureContracts(game, today = dayKey()) {
  const k = game.culling.contracts;
  if (k.day === today && k.list.length) return false;
  if (k.list.some((x) => x.done && !x.claimed)) handInContracts(game, { quiet: true });
  k.day = today;
  k.list = makeContracts(today, game.fightLevel(), contractPool(game));
  k.bonusPaid = false;
  game.bus.emit('culling');
  return true;
}

/** Today's contracts (empty until you've met the officer today). */
export const activeContracts = (game, today = dayKey()) => {
  const k = game?.culling?.contracts;
  return k && k.day === today ? k.list : [];
};

/** Hand in every finished contract: tokens and coins, and a bonus once all
 *  three are in. Returns { tokens, coins, count }. */
export function handInContracts(game, { quiet = false } = {}) {
  const k = game.culling.contracts;
  let tokens = 0, coins = 0, count = 0;
  for (const c of k.list) {
    if (!c.done || c.claimed) continue;
    c.claimed = true; tokens += c.tokens; coins += c.coins; count++;
  }
  if (!count) { if (!quiet) game.msg('You have no finished contracts to hand in yet.'); return { tokens: 0, coins: 0, count: 0 }; }
  if (!k.bonusPaid && k.list.length && k.list.every((c) => c.claimed)) { k.bonusPaid = true; tokens += FULL_BOARD_TOKENS; }
  game.inventory.add('pest_token', tokens);
  game.inventory.add('coins', coins);
  game.msg(`Pest Control pays you ${tokens} token${tokens === 1 ? '' : 's'} and ${coins.toLocaleString('en-GB')} coins for ${count} contract${count === 1 ? '' : 's'}.`, 'level');
  game.bus.emit('sfx', 'achievement');
  game.bus.emit('culling');
  return { tokens, coins, count };
}

/** Send auto battle after a contract's creatures, wherever they live (the
 *  way a quest hunt does; it lets go once the contract is done). */
export function huntContract(game, id) {
  const c = activeContracts(game).find((x) => x.id === id && !x.done);
  if (!c) return false;
  game._questTarget = id;
  game._autoHeadNext = 0;
  if (!game.autoBattle) game.toggleAutoBattle(true);
  game.msg(`Auto battle: hunting ${plural(c.name)} for your Pest Control contract.`, 'system');
  return true;
}

// ---------------- Pest Control token shop ----------------
export const TOKEN_SHOP = [
  { id: 'chicken_rice', qty: 5, cost: 2 },
  { id: 'kaya_toast', qty: 10, cost: 1 },
  { id: 'hunter_bait', qty: 10, cost: 2 },
  { id: 'forager_lamp', qty: 1, cost: 8 },
  { id: 'codex_quill', qty: 1, cost: 6 },
  { id: 'mosquito_net_cape', qty: 1, cost: 30 },
];

export function buyTokenReward(game, id) {
  const r = TOKEN_SHOP.find((x) => x.id === id);
  if (!r) return false;
  const have = game.inventory.count('pest_token');
  if (have < r.cost) { game.msg(`You need ${r.cost} Pest Control tokens for that (you have ${have}).`); return false; }
  if (game.inventory.canAdd(id, r.qty) < r.qty) { game.msg('Your inventory is too full.'); return false; }
  game.inventory.remove('pest_token', r.cost);
  game.inventory.add(id, r.qty);
  game.msg(`You trade ${r.cost} token${r.cost === 1 ? '' : 's'} for ${r.qty > 1 ? `${r.qty} × ` : ''}${getItem(id).name}.`, 'system');
  game.bus.emit('culling');
  return true;
}

// Gathering lamps: base XP (before the global XP rate) per level of the skill rubbed into.
export const LAMP_SKILLS = ['woodcutting', 'mining', 'fishing', 'hunter', 'farming'];
export const LAMP_XP_PER_LEVEL = 25;

export function rubLamp(game, index, skill) {
  const s = game.inventory.slotAt(index);
  if (!s || s.id !== 'forager_lamp' || !LAMP_SKILLS.includes(skill)) return false;
  const xp = LAMP_XP_PER_LEVEL * game.skills.level(skill);
  game.inventory.removeAt(index, 1);
  game.skills.addXp(skill, xp);
  game.spawnSparkle?.(game.player, '#ffd24a', 12);
  game.msg(`The lamp glows warm: your ${skill[0].toUpperCase() + skill.slice(1)} grows.`, 'system');
  return true;
}

export function readQuill(game, index) {
  const s = game.inventory.slotAt(index);
  if (!s || s.id !== 'codex_quill') return false;
  game.inventory.removeAt(index, 1);
  game.culling.quill += QUILL_KILLS;
  game.msg(`You sharpen the Codex quill: your next ${game.culling.quill} kills count double towards codex mastery.`, 'system');
  game.bus.emit('culling');
  return true;
}

// ---------------- The kill ----------------
/** Everything culling does when you defeat a creature (called from
 *  Game.killNpc after the kill is counted and its loot rolled). */
export function onKill(game, npc) {
  const c = game.culling;
  if (!c || !npc?.def) return;
  const id = npc.npcId;
  if (!CODEX_SET.has(id)) return;
  // A Codex quill: this kill counts twice towards mastery.
  const quilled = c.quill > 0 && !npc.wave && !npc.temporary;
  if (quilled) { c.quill--; c.extra[id] = (c.extra[id] || 0) + 1; }
  const after = masteryCount(game, id), before = after - 1 - (quilled ? 1 : 0);
  const tb = tierFor(before), ta = tierFor(after);
  if (ta > tb) {
    const t = MASTERY_TIERS[ta - 1], name = getNpc(id).name;
    game.msg(`Codex mastery: ${t.name} for ${name}! +${Math.round(t.dmg * 100)}% damage and +${Math.round(t.loot * 100)}% loot against them${t.race ? `, +${Math.round(t.race * 100)}% against all ${RACES[raceOf(npc.def, id)]?.name || 'its kind'}` : ''}.`, 'level');
    if (ta >= 3) game.banner(`<span class="big">Codex mastery!</span>Title earned: ${titleFor(id)}`);
  }
  // Mastery's loot: a chance of a second loot roll (never on bosses, whose
  // ten rolls are a payday already).
  const loot = MASTERY_TIERS[ta - 1]?.loot || 0;
  if (loot && !npc.def.boss && !npc.worldBoss && cullRand(game) < loot) game.rollDrops(npc);
  let changed = ta > tb || quilled;
  // Contracts (waves and summons never count).
  if (!npc.wave && !npc.temporary) {
    for (const k of activeContracts(game)) {
      if (k.done || k.id !== id) continue;
      k.have++; changed = true;
      if (k.have >= k.need) {
        k.done = true;
        if (game._questTarget === id) game._questTarget = null;   // auto battle lets go of the hunt
        game.msg(`Pest Control contract done: ${k.text}. Hand it in to Officer Aziz in Kampong Glam.`, 'level');
      } else if (k.have % 10 === 0) game.msg(`Pest Control: ${k.have}/${k.need} ${plural(k.name)}.`, 'system');
    }
  }
  if (isHarmless(npc)) {
    // Stewardship, while Neutral.
    if (isNeutral(game)) {
      const r0 = stewardship(game).rank;
      c.steward++;
      const s = stewardship(game);
      if (s.rank > r0) game.msg(`Stewardship rank ${s.rank}: ${s.name}. Gathering, food and Hunter perks grow (while you stay Neutral).`, 'level');
      changed = true;
    }
    // Hunter: a trickle of XP, and now and then a hide, feather or meat.
    game.skills.addXp('hunter', Math.max(0.5, (npc.def.level || 1) * CULL_HUNTER_XP_PER_LEVEL) * hunterXpMult(game));
    const goods = CULL_GOODS.family[npc.def.family] || CULL_GOODS.race[raceOf(npc.def, id)] || [];
    for (const g of goods) {
      if (cullRand(game) >= g.chance) continue;
      const n = g.max ? g.min + Math.floor(cullRand(game) * (g.max - g.min + 1)) : 1;
      if (game.inventory.canAdd(g.id, n) < n) continue;
      game.inventory.add(g.id, n);
      game.msg(`You skin a little something useful: ${n > 1 ? `${n} × ` : ''}${getItem(g.id).name.toLowerCase()}.`, 'game');
    }
  }
  if (changed) game.bus.emit('culling');
}

// ---------------- Saved state ----------------
export function defaultCulling() {
  return { steward: 0, title: null, quill: 0, extra: {}, contracts: { day: null, list: [], bonusPaid: false } };
}

/** Read the saved state; older saves have none, and anything odd is dropped. */
export function loadCulling(data) {
  const c = defaultCulling();
  if (!data || typeof data !== 'object') return c;
  c.steward = Math.max(0, Math.floor(Number(data.steward) || 0));
  c.quill = Math.max(0, Math.floor(Number(data.quill) || 0));
  c.title = typeof data.title === 'string' && CODEX_SET.has(data.title) ? data.title : null;
  if (data.extra && typeof data.extra === 'object') {
    for (const [id, v] of Object.entries(data.extra)) if (CODEX_SET.has(id) && Number(v) > 0) c.extra[id] = Math.floor(Number(v));
  }
  const k = data.contracts;
  if (k && typeof k === 'object' && Array.isArray(k.list)) {
    c.contracts.day = typeof k.day === 'string' ? k.day : null;
    c.contracts.bonusPaid = k.bonusPaid === true;
    c.contracts.list = k.list.filter((x) => x && typeof x.id === 'string' && CODEX_SET.has(x.id)).map((x) => ({
      id: x.id, name: String(x.name || getNpc(x.id).name), zone: String(x.zone || ''), text: String(x.text || ''),
      need: Math.max(1, Number(x.need) || 1), have: Math.max(0, Number(x.have) || 0),
      done: x.done === true, claimed: x.claimed === true, tokens: Math.max(0, Number(x.tokens) || 0), coins: Math.max(0, Number(x.coins) || 0),
    }));
  }
  return c;
}

/** The mastery tier and progress shown in a codex entry. */
export function masteryProgress(game, id) {
  const m = masteryOf(game, id);
  const span = m.next ? m.next - m.prev : 1;
  return { ...m, pct: m.next ? Math.max(0, Math.min(100, Math.floor(((m.count - m.prev) / span) * 100))) : 100 };
}

