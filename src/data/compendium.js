// The Compendium: a player's encyclopedia of how the game works, shown as a
// section of the Codex window (src/ui/compendiumui.js draws it). Chapters hold
// short articles; each article has a title, a one-line summary and a body.
//
// A body is a list of blocks:
//   'text'                       a paragraph; **bold**, and [[article-id]] or
//                                [[article-id|words]] for a link to another article
//   { list: [...] }              a bulleted list (each item marked up the same way)
//   { keys: [[key, what], ...] } a table of keys and what they do
//   { table: { head, rows } }    a table (plain cells)
//   { tip: 'text' }              a note in a box
//   () => block                  worked out when the article is drawn
// `see` names related articles (tap to jump); inline links are added to it.
//
// Every number either comes straight from the game's own tables (the *Rows
// functions below build the tables from them, so they keep in step when
// something is retuned) or matches a constant in the module named beside it.
// Kept free of the DOM so the tests can check it headlessly.
import { CLASSES, CLASS_BY_ID, SECONDARY_WEAPON, WEAPON_TYPE_NAMES, ARMOUR_FAMILY, ARMOUR_FAMILIES, CLEAVE_SHARE } from './classes.js';
import { ITEMS, getItem, TWO_HANDED_TYPES, QUIVER_BOW_TYPES } from './items.js';
import { ALL_MONSTER_IDS, ALL_BOSS_IDS, getNpc, RARE_DROP_TABLE, stretchLevel } from './npcs.js';
import { RACES, WEAPON_VS_RACE, RACE_BONUS } from './races.js';
import { ELEMENTS, SPELLS, ELEMENT_MATCHUP } from './magic.js';
import { PRAYERS, BLESSING_SLOT_LADDER, FAITH_BASE, FAITH_GAIN, burstPower, STACK_SHARE, STACK_CAP } from './prayers.js';
import { SKILLS, SKILL_BY_ID } from './skills.js';
import { SKILL_HOURS, GOLDEN_HOUR_XP } from './skillhours.js';
import { SKILL_UNLOCKS, UNLOCK_LEVELS, UNLOCK_TOP_MULT, GATHER_CONSUMABLES } from './unlocks.js';
import { MAX_LEVEL, LIFE_MAX_LEVEL, towardTop } from './xp.js';
import { STATIONS, MRT_FARE } from './transport.js';
import { CLUE_TIERS } from './clues.js';
import { QUESTS } from './quests.js';
import { REGION_LINES } from './regionQuests.js';
import { SLAYER_REWARDS, SLAYER_DMG, SLAYER_LOOT, SLAYER_HELM_DMG, SLAYER_FULL_LEVEL } from './slayer.js';
import { EVENT_KINDS, EVENT_GAP, WEEKLY_TASKS } from './worldevents.js';
import { BOSS_MECHANICS, MECH_KINDS } from './bossMechanics.js';
import { BOSS_TYPES } from './bossTypes.js';
import { SIGNATURE_DROP_CHANCE, ASCENDED, ASCENDED_LEVEL, LATE_SIGS } from './bossWeapons.js';
import { ALTAR_XP_MULT } from './bones.js';
import { ADREN_PER_HIT, ADREN_PER_HURT, THRESHOLD_COST, ULTIMATE_COST, LIFE_COST_FLOOR } from './abilities.js';
import { MASTERY_RANKS, MAX_ENCHANTS, ENCHANT_LABELS, enchantCost, BATTLE_CAP_RANK, KILL_XP, KILL_MULT } from '../game/mastery.js';
import { QUALITY, QUALITY_ORDER, QUALITY_RULES, RARITY, NORMAL_GEAR_SKIP } from '../game/loot.js';
import { MAX_REFINE, refineGain } from '../game/refine.js';
import { FEED_CAP_RANK } from '../game/materials.js';
import { QUALITY_MULT, SACRIFICE_XP, WARD_CHANCE } from '../game/salvage.js';
import { SHRINE_TRACKS, shrineCost } from '../game/shrine.js';
import { GOODS_RATE } from '../game/offerings.js';
import {
  FOCUS_MAX_MS, FOCUS_ACTIVE_REFILL, TIRED_MULT, RESTED_MULT, RESTED_RATE, RESTED_CAP_MS,
  GRAVE_TICKS, GRAVE_COIN_SHARE, GRAVE_STACKS, GRAVE_FEE_SHARE, GRAVE_FEE_MIN,
} from '../game/playbalance.js';
import { GATE_MODS, BOSS_EVERY, MILESTONE_EVERY } from '../game/waves.js';
import { HOME_PRICE, HOME_UPGRADES } from '../game/home.js';
import { STALL_RENT } from './hawkering.js';
import { CHI, MONK_DODGE } from '../game/monk.js';
import { PRIEST } from '../game/priest.js';
import { ZEALOT, HOLY_FIRE } from '../game/zealot.js';
import { BOSS_PET_RATE, BOSS_PET_FLOOR, SKILL_PET_RATE } from '../game/pets.js';
import { MASTERY_TIERS, CONTRACT_COUNT } from '../game/culling.js';
import { CHAMPION_CHANCE, CHAMPION_HP_MULT } from '../game/npc.js';
import {
  CRIT_MULT, MEGA_CRIT_MULT, MEGA_CRIT_CHANCE, WEAKNESS_BONUS, ARMOUR_TIERS, ARMOUR_CAP, OFFHAND_SHARE,
} from '../game/combat.js';
import {
  CIRCLE_TICKS, ADDS_TICKS, HEAL_EVERY,
  HEAL_FRAC, HEAL_CAP, CAST_TICKS, CAST_HIT, MECH_FIRST_TICKS, MECH_EVERY_TICKS,
} from '../game/bossmech.js';
import { TICK_MS, AUTOSAVE_TICKS, DAY_CYCLE_MS, RESPAWN_TICKS } from '../config.js';
import { BESTIARY_SPECIES, BESTIARY_BOSSES, BESTIARY_FORMS } from './bestiary.js';
import { STORY_NAME, CHAPTERS as STORY_CHAPTERS, RAID_TICKS, RANSACK_TICKS, RAIDERS } from './story.js';
import { LORE, LORE_SETS, LORE_DROP_PER_MIL, LORE_DROP_PER_MIL_BIG, GUARDIAN_ITEM, STORY_SET_REWARD } from './lore.js';
import { CONSEQUENCES } from './consequences.js';
import { MORAL_EVENTS, BLESS_MS, BLESS_XP } from './moralEvents.js';
import { ALIGN_TIERS } from './alignment.js';
import { REP_RANKS, REP_GAIN, REP_FLOOR, REP_CAP } from '../game/reputation.js';
import { FRESH_MS, REMARK_EVERY, REMARK_RANGE } from '../game/memory.js';
import { HOLD_TICKS } from '../game/npclife.js';
import {
  STREAK_STEP, STREAK_TIERS, STREAK_XP_STEP, STREAK_GAP_TICKS, LUCKY_RATE, LUCKY_STREAK_BONUS,
  CONTRACT_COUNT as GATHER_CONTRACTS, CONTRACT_STREAK_STEP, CONTRACT_SKILLS,
} from '../game/gathering.js';
import { CAST_TICKS as TP_CAST_TICKS, TOWN_COOLDOWN_TICKS, COMBAT_LOCK_TICKS, TOWN_KEY, GRAVE_KEY } from '../game/teleports.js';
import { REWARD_COINS_EACH, REWARD_COINS_MIN, REWARD_COINS_MAX, REWARD_LAMPS } from '../game/discovery.js';

// ---------------- Little helpers for the numbers ----------------
import { AOrAn } from '../core/utils.js';
import { SMITH } from './smithing.js';
import { ROUND_SPEND, SPECIAL_CHANCE, INCENDIARY_SHARE, SHOCK_SHARE, FROST_SLOW_TICKS } from '../game/rounds.js';
// One number formatter for them all: toLocaleString makes a new one at every
// call, and the tables below format a few thousand numbers as the game loads.
const EN_GB = new Intl.NumberFormat('en-GB');
const pct = (x, dp = 0) => `${EN_GB.format(Math.round(x * 100 * 10 ** dp) / 10 ** dp)}%`;
// A crit's average multiplier: x2, or x4 one time in four (2.5).
const avgCrit = () => (1 - MEGA_CRIT_CHANCE) * CRIT_MULT + MEGA_CRIT_CHANCE * MEGA_CRIT_MULT;
const num = (n) => EN_GB.format(Number(n));
const secs = (ticks) => {
  const s = ticks * TICK_MS / 1000;
  return s >= 60 && s % 60 === 0 ? `${s / 60} minute${s === 60 ? '' : 's'}` : `about ${Math.round(s * 10) / 10} seconds`;
};
const mins = (ms) => {
  const m = ms / 60000;
  return m >= 60 ? `${Math.round(m / 6) / 10} hours` : `${Math.round(m)} minutes`;
};
const sec = (ticks) => secs(ticks).replace(/^about /, '');   // "every 1.8 seconds", not "every about 1.8 seconds"
const oneIn = (p) => (p <= 0 ? '-' : p >= 0.1 ? pct(p) : `1 in ${num(Math.round(1 / p))}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const weaponName = (t) => cap(WEAPON_TYPE_NAMES[t] || t);
const itemName = (id) => (ITEMS[id] ? getItem(id).name : id);

// ---------------- Tables worked out from the game's data ----------------

/** The job classes: name, fighting style, main and secondary weapon, armour. */
export function classRows() {
  const STYLE = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic', dance: 'Dance' };
  return CLASSES.map((c) => [c.name, STYLE[c.style] || c.style, weaponName(c.weapon), weaponName(SECONDARY_WEAPON[c.id] || ''),
    ARMOUR_FAMILIES[ARMOUR_FAMILY[c.id]]?.name || '-']);
}

/** Gear tiers, from the platebodies of each metal: metal and the level it needs. */
export function gearTierRows() {
  return Object.entries(ITEMS)
    .filter(([id, it]) => /^[a-z]+_platebody$/.test(id) && it.equip?.family === 'plate')
    .map(([, it]) => ({ metal: it.name.replace(/ platebody$/, ''), lvl: Math.max(1, ...Object.values(it.equip.req || {})) }))
    .sort((a, b) => a.lvl - b.lvl)
    .map((t) => [t.metal, num(t.lvl)]);
}

/** Mastery ranks: name, XP, the share of base stats it adds (world-boss ranks marked). */
export function masteryRankRows() {
  return MASTERY_RANKS.map((r) => [r.worldBoss ? `${r.name} (world bosses)` : r.name, num(r.xp), r.gain ? `+${pct(r.gain)}` : '-']);
}

/** The chance a gear drop reaches each quality, from QUALITY_RULES' ladder. */
export function qualityChance(source, key) {
  const r = QUALITY_RULES[source];
  const reach = (L) => (L <= 0 ? 1 : L <= r.from ? r.start : r.start * r.step ** (Math.min(15, L) - r.from));
  const i = QUALITY_ORDER.indexOf(key);
  const next = QUALITY_ORDER[i + 1];
  return reach(QUALITY[key].step) - (next ? reach(QUALITY[next].step) : 0);
}

/** Quality tiers: name, stat bonus, and its chance on a gear drop from each source. */
export function qualityRows() {
  return QUALITY_ORDER.map((k) => [QUALITY[k].label, `+${pct(QUALITY[k].gain)}`,
    oneIn(qualityChance('normal', k)), oneIn(qualityChance('champion', k)), oneIn(qualityChance('boss', k))]);
}

/** Drop rarity colours. */
export function rarityRows() {
  const WHAT = {
    common: 'Everyday drops; anything that is always dropped',
    rare: 'Gear, or worth 1,000 coins or more',
    epic: 'Worth 5,000 coins or more, gear from a boss, the rare drop table and clue scrolls',
    legendary: 'Worth 20,000 coins or more, and the best of the rare drop table',
  };
  return Object.entries(RARITY).map(([k, r]) => [r.label, WHAT[k] || '']);
}

/** Monster ranks, worked out from the monsters themselves: how many there are,
 *  their level range, and how many of them attack on sight. */
export function monsterRankRows() {
  const RANK_NAMES = ['Young', 'Wild', 'Feral', 'Elder', 'Dire', 'Ancient', 'Mythic', 'Primordial', 'Eternal'];
  const mobs = ALL_MONSTER_IDS.map((id) => getNpc(id)).filter((d) => d.attackable);
  return RANK_NAMES.map((p) => {
    const l = mobs.filter((d) => d.name.startsWith(`${p} `));
    if (!l.length) return null;
    const lv = l.map((d) => d.level);
    const agg = l.filter((d) => d.aggressive).length;
    return [p, num(l.length), `${num(Math.min(...lv))}–${num(Math.max(...lv))}`, agg === l.length ? 'All' : agg ? 'Some' : 'None'];
  }).filter(Boolean);
}

/** Regions by the levels of the monsters that live there (lowest first). */
export function regionRows() {
  const z = new Map();
  for (const id of ALL_MONSTER_IDS) {
    const d = getNpc(id);
    if (!d.attackable || !d.zone) continue;
    const e = z.get(d.zone) || { lo: Infinity, hi: 0, n: 0, bosses: 0 };
    e.lo = Math.min(e.lo, d.level); e.hi = Math.max(e.hi, d.level); e.n++;
    z.set(d.zone, e);
  }
  for (const id of ALL_BOSS_IDS) { const d = getNpc(id); if (z.has(d.zone)) z.get(d.zone).bosses++; }
  return [...z].sort((a, b) => a[1].lo - b[1].lo || a[1].hi - b[1].hi)
    .map(([name, e]) => [name, `${num(e.lo)}–${num(e.hi)}`, num(e.n), num(e.bosses)]);
}

/** MRT stations. */
export function mrtRows() {
  return STATIONS.map((s) => [s.name]);
}

/** Blessings: name, Prayer level, what it does, slots it takes. */
export function prayerRows() {
  return PRAYERS.map((p) => {
    const fx = [];
    if (p.str) fx.push(`+${pct(p.str)} melee damage`);
    if (p.def) fx.push(`+${pct(p.def)} Defence`);
    if (p.ranged) fx.push(`+${pct(p.ranged)} Ranged`);
    if (p.magic) fx.push(`+${pct(p.magic)} Magic`);
    if (p.crit) fx.push(`+${pct(p.crit)} crit chance`);
    if (p.protect) fx.push(`stops ${pct(p.protect)} of damage taken`);
    return [p.name, num(p.level), fx.join(', '), num(p.slots || 1)];
  });
}

/** Spells: element, Magic level, what its element does, and the races it bites into and is resisted by.
 *  The Priest's and the Zealot's own elements say whose they are. */
export function spellRows() {
  const races = (ids) => ids.map((r) => RACES[r]?.name || r).join(', ') || '-';
  return SPELLS.map((s) => [`${ELEMENTS[s.element].icon} ${s.name}${s.cls ? ` (${s.cls === 'priest' ? 'Priest' : 'Zealot'} only)` : ''}`, num(s.level), ELEMENTS[s.element].effect,
    races(ELEMENTS[s.element].strong), races(ELEMENTS[s.element].weak)]);
}

/** Races and the weapon types strong against each. */
export function raceRows() {
  return Object.entries(RACES).map(([rid, r]) => [`${r.icon} ${r.name}`,
    Object.entries(WEAPON_VS_RACE).filter(([, m]) => m.strong.includes(rid)).map(([w]) => weaponName(w)).join(', ')]);
}

/** Monster armour by kind. */
export function armourRows() {
  const WHO = { none: 'Slimes, wisps, jellyfish', light: 'Birds, bats, insects, rodents, plants, monkeys, hounds, ghosts', medium: 'Beasts, people, spiders, snakes, undead, demons', heavy: 'Reptiles, scorpions, drakes', armoured: 'Golems, crabs, turtles' };
  return Object.entries(ARMOUR_TIERS).map(([k, v]) => [cap(k), pct(v), WHO[k] || '']);
}

/** Boss armour types: type, what it does, how to beat it, how many bosses wear it. */
export function bossTypeRows() {
  const WHAT = {
    plated: `${pct(BOSS_TYPES.plated.armour)} more armour (up to ${pct(BOSS_TYPES.plated.cap)}); maces, warhammers and toyas hit ×${BOSS_TYPES.plated.blunt}`,
    warded: `${pct(-BOSS_TYPES.warded.armour)} less armour; spells do ×${BOSS_TYPES.warded.magic}`,
    evasive: `${pct(-BOSS_TYPES.evasive.armour)} less armour; it slips your blows, so quick attacks do ${pct(BOSS_TYPES.evasive.graze[0] * (1 - BOSS_TYPES.evasive.grazeDmg))} less and slow swings up to ${pct(BOSS_TYPES.evasive.graze[1] * (1 - BOSS_TYPES.evasive.grazeDmg))} less (every blow still lands)`,
    thick: `Quick blows do ×${BOSS_TYPES.thick.glance[0]}, slow heavy ones ×${BOSS_TYPES.thick.glance[1]}; armour breaks count ×${BOSS_TYPES.thick.breaks}`,
  };
  const n = {};
  for (const id of ALL_BOSS_IDS) n[getNpc(id).armourType] = (n[getNpc(id).armourType] || 0) + 1;
  return Object.entries(BOSS_TYPES).map(([k, t]) => [`${t.icon} ${t.name}`, WHAT[k], t.hint.replace(/^[^:]+: (.)/, (_, c) => c.toUpperCase()), num(n[k] || 0)]);
}

/** Boss mechanics: kind, what to do, how many bosses use it. */
export function mechanicRows() {
  const HOW = {
    circle: 'Step into the green circle before the blast',
    adds: 'Kill the little healers first',
    cast: 'Use any skill or special attack to interrupt the cast bar',
  };
  const n = {};
  for (const m of Object.values(BOSS_MECHANICS)) n[m.type] = (n[m.type] || 0) + 1;
  return Object.entries(MECH_KINDS).map(([k, m]) => [`${m.icon} ${m.name}`, HOW[k] || '', num(n[k] || 0)]);
}

/** Golden hours: skill, time of day, game hours. */
export function goldenHourRows() {
  const hh = (h) => `${String(h % 24).padStart(2, '0')}:00`;
  return Object.entries(SKILL_HOURS).map(([s, h]) => [SKILL_BY_ID[s]?.name || s, h.when, `${hh(h.from)}–${hh(h.to)}`]);
}

/** A life skill's unlock ladder. */
export function unlockRows(skill) {
  return (SKILL_UNLOCKS[skill] || []).map((u) => [num(u.level), u.name, u.desc]);
}

/** Offering Shrine blessings. */
export function shrineRows() {
  return Object.values(SHRINE_TRACKS).map((t) => [t.name, t.label]);
}

/** Endless Gate modifiers. */
export function gateModRows() {
  return Object.values(GATE_MODS).map((m) => [m.name, m.risk, m.reward]);
}

/** Home upgrades: line and each tier's name. */
export function homeRows() {
  return Object.values(HOME_UPGRADES).map((u) => [u.name, u.tiers.map((t) => t.name).join(' → ')]);
}

/** Codex mastery tiers. */
export function codexMasteryRows() {
  return MASTERY_TIERS.map((t) => [t.name, num(t.kills), `+${pct(t.dmg)}`, `+${pct(t.loot)}`, t.race ? `+${pct(t.race)}` : '-']);
}

/** World events. */
export function eventRows() {
  return Object.values(EVENT_KINDS).map((e) => [`${e.icon} ${e.name}`, `${Math.round(e.secs / 60)} min`]);
}

/** Story quests (not the region lines). */
export function storyQuestRows() {
  const region = new Set(REGION_LINES.map((l) => l.id));
  return QUESTS.filter((q) => !region.has(q.id)).map((q) => [q.name, num(q.qp || 0)]);
}

/** Region quest lines, in the order they open. */
export function regionQuestRows() {
  return REGION_LINES.map((l) => [l.region, l.name, num(l.level)]);
}

/** Clue scroll tiers, by the level of the monster that drops them. */
export function clueRows() {
  const from = { easy: 1, medium: stretchLevel(20), hard: stretchLevel(45) };
  return Object.entries(CLUE_TIERS).map(([k, t]) => [cap(k), `${num(from[k])}+`, num(t.steps), num(t.rolls)]);
}

/** The bosses that use one kind of mechanic, by name. */
export const mechanicBosses = (kind) => Object.entries(BOSS_MECHANICS).filter(([, m]) => m.type === kind).map(([id]) => getNpc(id).name).sort();

/** The new species and bosses of the bestiary expansion, by region. */
export function bestiaryRows() {
  const by = new Map();
  for (const s of BESTIARY_SPECIES) { const e = by.get(s.zone) || { n: 0, b: 0 }; e.n++; by.set(s.zone, e); }
  for (const b of BESTIARY_BOSSES) { const e = by.get(b.zone) || { n: 0, b: 0 }; e.b++; by.set(b.zone, e); }
  return [...by].map(([z, e]) => [z, num(e.n), num(e.b)]);
}

/** The main story's chapters: number, title, regions, the title it gives. */
export function storyChapterRows() {
  return STORY_CHAPTERS.map((c, i) => [num(i + 1), c.title, c.regions.join(', '), c.reward.title]);
}

/** Region reputation ranks. */
export function repRankRows() {
  return REP_RANKS.map((r) => [r.name, Number.isFinite(r.min) ? num(r.min) : 'below 0', r.discount > 0 ? `${pct(r.discount)} off` : r.discount < 0 ? `${pct(-r.discount)} more` : '-', r.title ? `${r.title} …` : '-']);
}

/** What raises (and lowers) region reputation. */
export function repGainRows() {
  const NAME = { kill: 'A monster killed there', slayerKill: 'A Slayer task kill there', champion: 'A champion', boss: 'A boss', regionQuest: 'Its region quest line', quest: 'A story quest there',
    worldEvent: 'A world event there', bounty: 'A daily bounty there', goodChoice: 'A good choice there', evilChoice: 'An evil choice there' };
  return Object.entries(REP_GAIN).map(([k, v]) => [NAME[k] || k, `${v > 0 ? '+' : ''}${num(v)}`]);
}

/** Alignment titles by karma. */
export function alignmentRows() {
  return ALIGN_TIERS.map((t) => [t.title, t.min != null ? `${num(t.min)} or more` : `${num(t.max)} or less`]);
}

const STAT_ROWS = () => SKILLS.filter((s) => !s.hidden).map((s) => [`${s.icon} ${s.name}`, s.desc]);

// ---------------- The chapters ----------------
// `icon` is an emoji shown beside the chapter's name.
export const CHAPTERS = [
  {
    id: 'start', title: 'Getting started', icon: '🌱',
    articles: [
      {
        id: 'welcome', title: 'Welcome to the island',
        summary: 'What A-Worthy Adventure is and how to begin.',
        body: [
          'You arrive in **Kampong Glam**, the starting town, on a cosy, storybook Singapore. Fight monsters, train life skills, finish quests and collect better gear, at your own pace.',
          'First you pick a **job class** (see [[classes]]). It decides your weapon and your armour, and it is permanent, so read the cards and try the Preview first.',
          { list: [
            'Talk to the **Kampong Guide** and **Cikgu Surya** in town for the first quests and the life skills (see [[story-quests]]).',
            'Fight the small creatures around town to level up; the Monster Codex tells you what lives where (see [[monster-ranks]]).',
            'Turn on [[auto-battle]] when you would rather watch, and keep an eye on [[focus-rested]].',
          ] },
          'The game saves itself every few seconds (see [[saving]]).',
        ],
        see: ['controls-keyboard', 'controls-phone', 'panels'],
      },
      {
        id: 'controls-keyboard', title: 'Keyboard and mouse',
        summary: 'Moving, fighting and the hotkeys on a computer.',
        body: [
          'Click the ground to walk there, or steer with **W A S D** or the **arrow keys**. Click a monster to attack it, and a tree, rock, person or shop to use it. Right-click for every option, and right-click a monster to look it up in the Monster Codex.',
          { keys: [
            ['G', 'Attack the nearest enemy'],
            ['Tab', 'Switch to the next closest enemy'],
            ['E or Space', 'Interact with the nearest thing'],
            ['F', 'Quick eat: eat the first food in your bag'],
            ['Q', 'Arm your weapon\'s special attack'],
            ['L', 'Faith Burst, when your Faith is full (see [[prayers]])'],
            ['Z X C V B', 'Your five combat skills (see [[abilities]])'],
            ['T', 'Auto battle on or off'],
            ['Y', 'Auto gather on or off'],
            ['U', 'Auto quest on or off'],
            ['P', 'Pickpocket the nearest person'],
            ['H', 'Merchant only: hire a mercenary'],
            ['M', 'World map'],
            ['K', 'Teleport back to Kampong Glam (stand still 3s; recharges in 2.5 minutes)'],
            ['R', 'Teleport to your gravestone after a death'],
            ['O', 'Postcard mode: snap the view as a postcard to save or share'],
            ['I', 'Open or fold the menu (the side panel)'],
            ['1 2 3 4 5', 'Side panel tabs: Bag, Skills, Combat, Journal, Settings'],
            ['Esc', 'Close the window or menu'],
          ] },
          { tip: 'In a shop or at the Offering Shrine, point at an item and press **1**, **5**, **X** (ten) or **A** (all) to buy, sell or offer that many at once.' },
        ],
        see: ['controls-phone', 'auto-battle'],
      },
      {
        id: 'controls-phone', title: 'Playing on a phone',
        summary: 'The joystick, the big buttons and the sheets.',
        body: [
          'Put your thumb anywhere on the left of the screen and drag: a joystick appears and you walk that way. Tap the ground to walk there instead, and tap a monster, tree or person to use it.',
          { list: [
            '**Attack** (the crossed swords) locks onto the nearest enemy. Hold it to keep fighting.',
            '**Next target** (the circling arrow) switches to the next closest enemy.',
            '**Interact** acts on the nearest thing and shows what it will do ("Chop", "Talk").',
            '**Auto** folds the three auto switches (battle, gather, quest) into one button.',
            'The skill buttons on the action bar are your [[abilities]]; the orb is your special attack.',
            'Press and hold an item, monster or button for its card of details.',
          ] },
          'The side panel and big windows open as sheets: drag the handle down, or tap it, to close one.',
        ],
        see: ['controls-keyboard', 'panels'],
      },
      {
        id: 'panels', title: 'The side panel',
        summary: 'Bag, Skills, Combat, Journal and Settings.',
        body: [
          'The side panel has five tabs (keys 1 to 5). Three of them hold more than one view, switched by the row of sub-tabs at the top:',
          { list: [
            '**Bag**: your pack, and **Gear** (what you wear, Equip best and Gear Mastery).',
            '**Skills**: every skill and its level; tap one for its guide.',
            '**Combat**: your weapon and spells, **Prayer**, and **Stats** (every bonus added up).',
            '**Journal**: **Quests** (bounties, events and the quest list) and **Awards** (achievements, the Monster Codex, the Collection log).',
            '**Settings**: saving, your account, sound, graphics and this Compendium.',
          ] },
        ],
        see: ['story-quests', 'collection-log', 'saving'],
      },
      {
        id: 'levels-xp', title: 'Levels and XP',
        summary: 'How skills level up, and what boosts your XP.',
        body: [
          'Every skill levels from XP on an old-school curve, and the climb goes on past 99. Fighting trains your fighting skill (Melee, Ranged, Magic, or Agility and Ranged for the Dancer) plus Defence and Hitpoints. A quarter of combat XP comes as you deal damage and the rest when a monster dies.',
          'Your **fight level** is the higher of your combat level and the skill your weapon trains. Monsters, bounties, events and auto battle all measure you by it.',
          'Combat XP is boosted by:',
          { list: [
            '**Night hunt**: x1.5 after dark.',
            '**Wilderness**: x1.5 at Wilderness level 1, up to x6 at level 10.',
            '**Kill streak**: +10% for each kill within about 30 seconds of the last, up to +50%.',
            '**Rested XP**: x1.5 while it lasts (see [[focus-rested]]).',
          ] },
          `Life skills earn more during their [[golden-hours]] (x${GOLDEN_HOUR_XP}).`,
        ],
        see: ['skills-overview'],
      },
    ],
  },
  {
    id: 'classes-ch', title: 'Classes and weapons', icon: '⚔️',
    articles: [
      {
        id: 'classes', title: 'The job classes',
        summary: `${CLASSES.length} classes, one weapon type each, chosen once for good.`,
        body: [
          `There are **${CLASSES.length} job classes** in four fighting styles. Each masters one main weapon type and one secondary type of the same style; no other weapons can be wielded. Armour (helm, body, legs, gloves and boots) belongs to one family per class; capes, jewellery and tools are open to everyone, and shields to every class but the Ninja, who holds a shuriken in each hand, and the [[the-monk|Monk]], who wears monk knuckles and monk gloves.`,
          () => ({ table: { head: ['Class', 'Style', 'Main weapon', 'Secondary', 'Armour'], rows: classRows() } }),
          'Weapon and armour drops mostly turn into your own class\'s kind, so loot stays useful (see [[drops]]).',
        ],
        see: ['weapon-grips', 'armour-families', 'merchant-dancer', 'the-monk', 'priest-zealot'],
      },
      {
        id: 'weapon-grips', title: 'Two hands, two weapons and quivers',
        summary: 'Two-handed grips, dual wielding and the Archer\'s quiver.',
        body: [
          () => `**Two-handed** weapons fill both hands, so no shield, buckler or tome goes with them: ${[...TWO_HANDED_TYPES].map((t) => WEAPON_TYPE_NAMES[t]).join(', ')}. To make up for it each has a **two-handed grip**: the Defence and life of a same-tier kiteshield, plus (for most) the extras of a buckler or quiver.`,
          () => `**Quivers**: ${[...QUIVER_BOW_TYPES].map((t) => WEAPON_TYPE_NAMES[t]).join(' and ')} are drawn from a quiver at the hip, so a quiver (and only a quiver) can sit in the off-hand with them. The Fletcher sells them.`,
          `**Dual wielding**: daggers, scimitars, pistols, kerambits and shurikens pair with a second one of the same kind in the off-hand, and a Monk's monk knuckles with its monk gloves (knuckles in the main hand, gloves in the off-hand). Each hand strikes with its own weapon; the off-hand's blow lands at ${pct(OFFHAND_SHARE)} of what that weapon would do. Ninjas fight with a shuriken in each hand and Monks with knuckles and gloves, so neither holds a shield.`,
          'A Knight\'s longsword and the toya staff are one-handed, so they keep a shield.',
          '**Reach**: most melee weapons strike from 2 tiles, longswords, halberds and two-handed swords from 3, spears from 4. Every melee weapon **cleaves** a share of each hit into foes next to the target, from a quarter for the quick blades to most of it for two-handed swords.',
        ],
        see: ['classes', 'equip-best', 'gun-rounds'],
      },
      {
        id: 'gun-rounds', title: 'Gun rounds',
        summary: 'The bullets Pistolers and Snipers fire: what each kind adds, how fast they go and where to get them.',
        body: [
          'Pistols and sniper rifles fire **rounds**. Rounds sit in their own **ammo slot** beside your gear (they never gain mastery, quality or enchantments), and each kind adds its **shot power** to the gun\'s own power, so better rounds make every shot hit harder.',
          () => `Most rounds are picked back up after a fight, like arrows, so only some shots use one up: a **pistol** about one shot in ${Math.round(1 / ROUND_SPEND.pistol)} (pistols fire about four times as fast as a bow) and a **sniper rifle** about one shot in ${Math.round(1 / ROUND_SPEND.rifle)}.`,
          'When the slot runs dry your gun reloads from the **best rounds in your pack**. With none at all it still fires **plain shot** at its own power, so you are never left unable to fight. New Pistolers and Snipers start with a full stack.',
          () => ({ table: { head: ['Rounds', 'Shot power', 'Smithing (20 a bar)', 'Where to get them'], rows: Object.values(ITEMS).filter((it) => typeof it.roundStr === 'number' && !it.special).sort((a, b) => a.roundStr - b.roundStr).map((it) => {
            const id = Object.keys(ITEMS).find((k) => ITEMS[k] === it);
            const r = SMITH.find((x) => x.result === id);
            const metal = id.replace(/_rounds$/, '');
            const shop = ['bronze', 'iron'].includes(metal) ? 'General Store, Archery Emporium' : ['steel', 'mithril', 'adamant', 'rune'].includes(metal) ? 'Archery Emporium' : 'smithing only';
            return [it.name, `+${it.roundStr}`, r ? `level ${r.level}` : '-', shop];
          }) } }),
          () => ({ table: { head: ['Special rounds (rune strength)', `Effect, on ${pct(SPECIAL_CHANCE)} of the hits that land`], rows: [
            ['Incendiary rounds', `bursts into flame for ${pct(INCENDIARY_SHARE)} more damage`],
            ['Frost rounds', `chills the foe, slowing its moves and attacks for ${Math.round(FROST_SLOW_TICKS * 0.6)}s`],
            ['Shock rounds', `arcs into a foe nearby for ${pct(SHOCK_SHARE)} of the hit`],
          ] } }),
          'Special rounds are sold at the Archery Emporium and found in treasure caskets; they are never smithed. Monsters that would drop arrows drop the same metal\'s rounds for a gun user instead.',
        ],
        see: ['weapon-grips', 'classes'],
      },
      {
        id: 'armour-families', title: 'Armour families',
        summary: 'Plate, scout leather, hide, robes and dancewear.',
        body: [
          'Each class wears one armour family: helm, body, legs, gloves and boots. Each family carries its own extra stat:',
          () => ({ table: { head: ['Family', 'What it does'], rows: Object.values(ARMOUR_FAMILIES).map((f) => [f.name, f.desc]) } }),
        ],
        see: ['gear-tiers', 'classes'],
      },
      {
        id: 'merchant-dancer', title: 'The Merchant and the Dancer',
        summary: 'Two classes that play differently from the rest.',
        body: [
          'The **Merchant** throws money with a cane: every attack and skill costs coins, but its coin throws and allies hit about twice as hard as other classes (a little more as Ranged rises). It hires mercenaries (H) and calls up A-Worthling mirror images.',
          'The **Dancer** lashes with whips from 3 tiles away, builds **Rhythm** as its lashes land, and dodges blows. Its whip ricochets into nearby monsters, one more bounce at full Rhythm. Its fighting XP is split between Agility and Ranged.',
        ],
        see: ['classes', 'abilities'],
      },
      {
        id: 'the-monk', title: 'The Monk',
        summary: 'Bare knuckles and palms: a punch and a palm strike every swing, and Chi.',
        body: [
          `The **Monk** fights with his fists: **monk knuckles** in the main hand punch, quick and keen to crit, and **monk gloves** in the off-hand follow every punch with a heavier palm strike (at ${pct(OFFHAND_SHARE)} of the gloves' hit). Either can go in either hand, but knuckles first and gloves second hit hardest. Monks hold no shield.`,
          `Every blow that lands builds **Chi** (one every ${CHI.everyMs / 1000}s, up to ${CHI.max}): each Chi adds ${pct(CHI.per)} damage. At ${CHI.max} it overflows, healing ${pct(CHI.heal)} of your life, and drops back to ${CHI.keep}. Stop fighting for ${(CHI.fadeTicks * 0.6).toFixed(0)} seconds and it fades. Inner Focus and Hundred Fists make it overflow at once.`,
          `Monks are **light on their feet**: ${pct(MONK_DODGE)} of blows miss them altogether (half as many heavy, telegraphed ones).`,
        ],
        see: ['classes', 'weapon-grips', 'abilities'],
      },
      {
        id: 'priest-zealot', title: 'The Priest and the Zealot',
        summary: 'Two casters of holy light and fire: spells that heal, and fires paid for in life.',
        body: [
          `The **Priest** casts through **orbs** (or censers). Every spell that lands heals it ${pct(PRIEST.heal)} of the hit (splashes and burns heal nothing), and its spells hit undead, spirits and demons ${pct(PRIEST.smite)} harder. Its skills heal it more (Holy Light, Judgement), shield it (Sanctuary) and lift its [[prayers|blessings]]: Uplift makes every blessing count 50% more for 9 seconds and fills a quarter of its Faith at once.`,
          `The **Zealot** swings a **censer** on a chain (or casts through an orb). Every spell cast through a censer leaves the foe burning with **holy fire**: ${pct(HOLY_FIRE.share)} of the hit every second for ${HOLY_FIRE.secs} seconds, past its armour, and the fires stack (up to ${HOLY_FIRE.stacks}). Holy fire pays Magic XP like any spell, and a Priest holding a censer sets it too.`,
          `**Fervour**: a Zealot hits harder the more hurt it is, up to +${pct(ZEALOT.fervour)} with no life left (+${pct(ZEALOT.fervour / 2)} at half life), with a censer in hand: through an orb, its second weapon, it has no Fervour and hits ${pct(1 - ZEALOT.orb)} softer. Burning Oath and Pillar of Flame are paid for in life as well as adrenaline (a share of the life you have, never the last of it), and neither can be used at ${pct(LIFE_COST_FLOOR)} of your life or less, so auto battle never spends you to nothing.`,
          'Both wear robes and can hold a shield or a tome.',
        ],
        see: ['classes', 'abilities', 'prayers'],
      },
    ],
  },
  {
    id: 'combat-ch', title: 'Combat', icon: '🛡️',
    articles: [
      {
        id: 'combat-basics', title: 'How a fight works',
        summary: 'Hits always land; damage is what changes.',
        body: [
          'Your hits always land: what changes is how hard they hit. A weapon\'s speed is the number of 0.3-second beats between attacks, so lower is faster. Melee weapons swing twice as fast as their number says, quick weapons (scimitars, claws, kerambits, war fans, monk knuckles) faster still, and pistols, shurikens and shortbows are the quickest ranged weapons.',
          'Damage grows with your fighting skill, your gear and every bonus on top. The **Stats** view in the Combat tab adds everything up.',
          'Only aggressive monsters attack you on sight, and only one wandering monster at a time attacks you unprovoked. A monster you attack always fights back.',
          'Eat food to heal (F eats the first food in your bag); better food heals more. Your life also creeps back on its own.',
        ],
        see: ['weakness', 'crits', 'monster-armour', 'abilities'],
      },
      {
        id: 'weakness', title: 'Weaknesses, races and elements',
        summary: `Hit a monster's weakness for +${pct(WEAKNESS_BONUS.dmg - 1)}; the right weapon for its race adds +${pct(RACE_BONUS.dmg - 1)}.`,
        body: [
          `Every monster is **weak to one combat style**: melee, ranged or magic. Hitting it with that style does **+${pct(WEAKNESS_BONUS.dmg - 1)} damage** and gets past half its armour; the number carries a small "weak!" tag. Broadly: beasts and people are weak to melee, flying, small and quick things to ranged, and armoured, undead and magical things to magic.`,
          `Every monster also belongs to a **race**. Each weapon type is strong against a couple of races for **+${pct(RACE_BONUS.dmg - 1)} damage**. Matchups only ever help: no weapon is worse against anything.`,
          () => ({ table: { head: ['Race', 'Strong weapons'], rows: raceRows() } }),
          `**Spells** are judged by their element, not by the staff. An element hits the races it is strong against for **x${ELEMENT_MATCHUP.strong}** damage (gold numbers) and is **resisted** by others, doing only **x${ELEMENT_MATCHUP.weak}** (grey numbers), so pick the element for the foe: Auto element in the spell list does it for you.`,
          'Each element also has its own effect, shown on the foe while it lasts: **burning** foes glow orange (🔥 under their life bar), **chilled** ones turn icy blue (❄) and hit softer, and **cracked** armour shows a brown wash (🪨 and the number of cracks).',
          () => ({ table: { head: ['Spell', 'Magic', 'Effect', 'Strong against', 'Resisted by'], rows: spellRows() } }),
          'Every spell also blasts the area round its target for the same damage. Earth\'s cracks count for every hit you land on that foe, whatever you hit it with.',
          'The **Priest** and the **Zealot** have elements of their own and cast only those: the Priest the Light path (Radiance, Grace, Judgement, Sanctuary: dazzling, warding, judging the hurt and healing), the Zealot the Flame path (Holy Fire, Wrath, Ash, Blood: brands that burst, stored wrath, cinders and life paid for much harder hits; the Zealot\'s Blood is its own, not the Wizard\'s). The Wizard and the Sorcerer cast the seven above.',
        ],
        see: ['monster-armour', 'codex-mastery'],
      },
      {
        id: 'monster-armour', title: 'Monster armour and armour pierce',
        summary: 'A share of each hit a monster shrugs off.',
        body: [
          `Monsters wear armour that stops a share of every hit, by the kind of creature. Bosses and champions add ${pct(0.1)} each (and a little more or less by how far above or below you they are), up to ${pct(ARMOUR_CAP)} in all. Hitting a weakness gets past half of it.`,
          () => ({ table: { head: ['Armour', 'Stops', 'Who wears it'], rows: armourRows() } }),
          '**Armour pierce** on your gear cancels armour first; whatever pierce is left over adds damage instead. Plate, scout leather, hide, robes and dancewear all carry it, more on higher-level pieces, and it counts for spells too.',
          'Every **boss** also wears one of four **armour types**, shown in the Codex, on its battle bar and in its hover details, so each class has bosses it is good against and bosses it finds hard:',
          () => ({ table: { head: ['Type', 'What it does', 'How to beat it', 'Bosses'], rows: bossTypeRows() } }),
        ],
        see: ['weakness', 'combat-basics'],
      },
      {
        id: 'crits', title: 'Critical hits',
        summary: `Crits hit x${CRIT_MULT}; one in ${Math.round(1 / MEGA_CRIT_CHANCE)} is a mega crit at x${MEGA_CRIT_MULT}.`,
        body: [
          `Your crit chance comes from your fighting level (about 15% at 99) plus every **crit %** on your gear, prayers and blessings, up to 100%. A critical hit does **x${CRIT_MULT}** damage, and one crit in ${Math.round(1 / MEGA_CRIT_CHANCE)} is a **mega crit** at **x${MEGA_CRIT_MULT}**.`,
          '**Crit damage %** (scout leather, enchantments, the Ferocity blessing) makes every critical hit bigger still.',
        ],
        see: ['enchanting', 'offering-shrine', 'prayers'],
      },
      {
        id: 'damage-stats', title: 'Physical damage vs crit damage vs pierce',
        summary: '1% of one damage stat is not 1% of another: what each point is really worth.',
        body: [
          '**Physical damage bonus %** (melee and ranged) and **Magic bonus %** (spells) make every hit that much bigger: +1% is +1% damage, a little less once you already have a lot.',
          () => `**Crit damage %** only counts on critical hits. A crit does x${CRIT_MULT} (x${MEGA_CRIT_MULT} one time in ${Math.round(1 / MEGA_CRIT_CHANCE)}, so x${avgCrit()} on average), and crit damage adds to that multiplier. With crit chance c, a hit is worth 1 + c x (${avgCrit() - 1} + crit damage / 100) on average, so a point of crit damage is worth less than c times a point of physical damage: much less until you crit often.`,
          () => ({ table: { head: ['Crit chance', '+1% Physical damage', '+1% Crit damage'], rows: [0.1, 0.2, 0.4, 0.7, 1].map((c) => [pct(c), '+1%', `+${(100 * c / (100 + c * (avgCrit() - 1) * 100)).toFixed(2)}%`]) } }),
          () => `**Crit chance %** adds crits: with no other bonuses each point is worth about ${avgCrit() - 1}% damage (more with crit damage), until every hit crits.`,
          '**Armour pierce %** cancels a monster\'s armour first, and only what is left over adds damage. Until your pierce matches the armour, each point gives back more than 1% damage (it takes back a share of the hit the armour stopped); past that, each extra point adds a little less than 1%.',
          '**Attack speed %** gives more attacks: damage per second grows by (100 + attack speed) / 100.',
          { tip: 'The **Stats** view shows "What 1 point is worth" for you right now, and every gear tooltip notes what its stats add for you (≈ +X% dmg).' },
        ],
        see: ['crits', 'monster-armour', 'enchanting'],
      },
      {
        id: 'abilities', title: 'Skills, adrenaline and special attacks',
        summary: 'Five combat skills on Z X C V B, fuelled by adrenaline; Q arms a special.',
        body: [
          `**Adrenaline** builds as you fight: +${ADREN_PER_HIT} for each hit you land, +${ADREN_PER_HURT} for each hit you take, and every class builds extra its own way (crits, kills, being hurt).`,
          { list: [
            '**Z**: a basic attack. Free, and it builds adrenaline.',
            `**X**: a threshold skill for ${THRESHOLD_COST} adrenaline.`,
            '**C**: your class\'s own basic skill.',
            '**V**: Second Wind, a heal.',
            `**B**: the ultimate, for ${ULTIMATE_COST} adrenaline (from combat level 45). It hits every monster near the target too.`,
          ] },
          'The skills on the bar swap with the weapon in your hand. Each has a cooldown.',
          '**Special attacks**: many weapons have one. Press **Q** (or the orb) to arm it, and your next hit is special. Special energy refills by 1% a tick, so it is full again a minute after you empty it.',
          { tip: 'Any skill or special attack interrupts a boss\'s cast (see [[boss-mechanics]]).' },
        ],
        see: ['prayers', 'auto-battle'],
      },
      {
        id: 'prayers', title: 'Blessings and the Faith Burst',
        summary: 'Equip Blessings in the Combat tab: always on, no drain. Full Faith fires a Burst (L).',
        body: [
          `**Blessings** are Prayer's loadout. Equip them in the **Prayer** view of the Combat tab: an equipped blessing is always on and never drains. You have ${BLESSING_SLOT_LADDER.map((r) => `**${r.slots}** slot${r.slots > 1 ? 's' : ''} at Prayer ${r.level}`).join(', ')}. With a free slot you can equip two or more of the same kind (attack, strength, defence, ranged, magic) and they **stack**: the strongest counts in full and each other one at ${pct(STACK_SHARE)}, up to +${pct(STACK_CAP)} for a kind. With the slots full, a new blessing swaps out the weakest of its kind. Spirit of the Worthy takes two slots. Tap a slot to take its blessing off.`,
          `**Faith** fills as you fight: ${pct(FAITH_GAIN.hit)} of the bar for each hit you land, ${pct(FAITH_GAIN.hurt)} for each hit you take and ${pct(FAITH_GAIN.kill)} for a kill, so about 45 seconds of fighting fills it. Burying bones and kneeling at an A-Worthy Monument fill it too, and prayer accessories make it fill faster (+30 Faith bonus doubles it). The bar holds ${FAITH_BASE} + your Prayer level.`,
          `With a full bar, press **L** (or tap the Faith orb, or **Burst** in the panel) for a **Faith Burst**: heal ${pct(burstPower(1).heal)} of your life (more with Prayer level, up to ${pct(burstPower(300).heal)}), a ward that stops every blow for 3 seconds, and +${pct(burstPower(1).zeal)} damage (up to +${pct(burstPower(300).zeal)}) for 8 seconds. Auto battle fires it when you drop below 40% life or fight a boss or champion.`,
          `Train Prayer by burying bones, or offer them at an A-Worthy Monument for **x${ALTAR_XP_MULT} XP**.`,
          () => ({ table: { head: ['Blessing', 'Level', 'Effect', 'Slots'], rows: prayerRows() } }),
        ],
        see: ['abilities', 'skills-overview'],
      },
    ],
  },
  {
    id: 'monsters-ch', title: 'Monsters and bosses', icon: '🐉',
    articles: [
      {
        id: 'monster-ranks', title: 'Monster ranks',
        summary: 'Young to Ancient, and Mythic, Primordial and Eternal in the endgame.',
        body: [
          'Most species come in several **ranks**, each a stronger form of the same creature. Young ones keep to themselves; from Wild up, the naturally fierce species attack on sight. Elder, Dire and Ancient monsters roll their loot more times (see [[drops]]).',
          'The endgame ranks, **Mythic**, **Primordial** and **Eternal**, live in the Southern Islands and the Shadow Rift and always attack on sight.',
          () => ({ table: { head: ['Rank', 'Monsters', 'Levels', 'Attack on sight'], rows: monsterRankRows() } }),
          'The Monster Codex (Journal → Awards) lists every one, where it lives and, once you have beaten one, its stats and drops.',
        ],
        see: ['champions', 'regions', 'codex-mastery'],
      },
      {
        id: 'champions', title: 'Champions',
        summary: `A gold-ringed mini-boss with ${CHAMPION_HP_MULT}x the life and far better loot.`,
        body: [
          `Any ordinary monster has a **${pct(CHAMPION_CHANCE)}** chance to turn up as a **champion**: bigger, ringed in gold, with **${CHAMPION_HP_MULT}x its life**, harder hits and more armour. Ghostly monsters turn champion three times as often after dark.`,
          `A champion drops what ${CHAMPION_HP_MULT} ordinary kills of its kind would, plus champion bones, a 50% chance of an accessory for your style, a 20% chance of an upgrade ward and always a couple of upgrade stones. Its gear drops climb the quality ladder far more often (see [[quality]]).`,
          'A champion kill is worth 5 gear mastery points to every piece you wear.',
        ],
        see: ['drops', 'auto-battle'],
      },
      {
        id: 'bosses', title: 'Bosses',
        summary: 'Huge fights with a signature move, ground attacks and a mechanic.',
        body: [
          `There are **${ALL_BOSS_IDS.length} bosses** across the island. Each has a signature move, red ground markers to step out of, and one [[boss-mechanics|mechanic]] you must deal with. The Monster Codex shows a boss's mechanic before you fight it.`,
          { list: [
            'A boss rolls its drop table ten times and never comes up empty, hits the rare drop table five times, and always drops an accessory and three pieces of gear for your class, Superior quality or better.',
            `Each boss has a **signature weapon** for one class, which drops ${oneIn(SIGNATURE_DROP_CHANCE)} kills. It is a third stronger than the plain weapon of the boss's level.`,
            `So every class has one stronger than its eternal weapon, the bosses of level ${ASCENDED_LEVEL} and up also carry an **ascended** signature weapon for a class none of them serve (${ASCENDED.map((a) => `${getNpc(a.boss).name}: ${CLASS_BY_ID[a.classId].name}`).join(', ')}), which drops just as often.`,
            // Classes added after the weapons were dealt keep the deal as it was and carry extra weapons of their own.
            ...(LATE_SIGS.length ? [`The newer classes have three signature weapons each, carried by bosses on top of their own and dropping just as often (${LATE_SIGS.map((a) => `${getNpc(a.boss).name}: ${CLASS_BY_ID[a.classId].name}`).join(', ')}). The one from a boss of level ${ASCENDED_LEVEL} or more is ascended.`] : []),
            'It also leaves 20 to 50 upgrade stones and 1 to 3 upgrade wards.',
            'A boss kill is worth 25 gear mastery points to every piece you wear.',
          ] },
          'If a boss beats you, auto battle leaves it alone until you are 10 fight levels stronger.',
        ],
        see: ['boss-mechanics', 'world-bosses', 'pets'],
      },
      {
        id: 'boss-mechanics', title: 'Boss mechanics',
        summary: 'Safe circles, healers and casts to interrupt.',
        body: [
          `About ${secs(MECH_FIRST_TICKS)} into a fight, and then every ${secs(MECH_EVERY_TICKS)} or so, a boss uses its mechanic:`,
          () => ({ table: { head: ['Mechanic', 'What to do', 'Bosses'], rows: mechanicRows() } }),
          { list: [
            `**Safe circle**: red covers the ground round you; step into the small green circle within ${secs(CIRCLE_TICKS)}.`,
            `**Healing adds**: each mends ${pct(HEAL_FRAC, 1)} of the boss's life every ${secs(HEAL_EVERY)}, up to ${pct(HEAL_CAP)} in all, and fades after ${secs(ADDS_TICKS)}.`,
            `**Interruptible cast**: a ${secs(CAST_TICKS)} cast bar. Any skill or special attack stops it; if it lands it takes ${pct(CAST_HIT)} of your life (never all of it).`,
          ] },
          'No mechanic stuns you or throws you about, and no boss shields itself: every blow you land counts in full. Auto battle turns on healers, interrupts casts and (if you leave it on) dodges the red markers for you.',
        ],
        see: ['bosses', 'abilities', 'auto-battle'],
      },
      {
        id: 'world-bosses', title: 'World bosses',
        summary: 'A tougher boss that rises near you and hunts you down.',
        body: [
          'Once you have finished two quests and reached fight level 40, every 2 minutes (if none is about) a **World Boss** may rise near you: one of the bosses closest to your fight level, with 5x its life, twice as hard a hit, and more Attack and Defence. It hunts you from far off.',
          'Beat it for **triple loot**. It leaves after 5 minutes if you do not fight it, and it never follows you into a town or near a bank, so retreating there is always safe.',
        ],
        see: ['bosses', 'world-events'],
      },
      {
        id: 'codex-mastery', title: 'The Monster Codex and codex mastery',
        summary: 'Every species, and a little more damage the more of one you defeat.',
        body: [
          'The **Monster Codex** lists every monster and boss. A creature is discovered once you defeat one; then its stats, matchups and drops show. Tap the portrait on the battle bar, or right-click a monster, to open its entry.',
          'Defeating enough of one species earns **codex mastery** over it:',
          () => ({ table: { head: ['Tier', 'Kills', 'Damage', 'Loot', 'Whole race'], rows: codexMasteryRows() } }),
          'Gold mastery also earns a title to wear above your name.',
        ],
        see: ['monster-ranks', 'pest-control'],
      },
      {
        id: 'bestiary-expansion', title: 'New creatures of the island',
        summary: `${BESTIARY_SPECIES.length} newer species in ${BESTIARY_FORMS.length} forms each, and ${BESTIARY_BOSSES.length} more bosses.`,
        body: [
          `The island's wild side keeps growing: **${BESTIARY_SPECIES.length} newer species**, each in ${BESTIARY_FORMS.length} forms (${BESTIARY_FORMS.map((f) => f.p || 'plain').join(', ')}), and **${BESTIARY_BOSSES.length} newer bosses**, spread over every region and level band. Many are real Singapore wildlife (plantain squirrels, junglefowl, toman snakeheads, fiddler crabs); others come from old kampong stories.`,
          () => ({ table: { head: ['Region', 'New species', 'New bosses'], rows: bestiaryRows() } }),
          'Each new species has a themed extra drop on top of its level\'s usual loot, and its own Slayer task name. Each new boss has a signature move, a [[boss-mechanics|mechanic]] and a signature weapon, like the older bosses.',
          { tip: 'Look them up in the Monster Codex: an undiscovered one shows as a silhouette with its level and where it lives, so you can go hunting.' },
        ],
        see: ['monster-ranks', 'codex-mastery', 'discoveries'],
      },
      {
        id: 'mech-circle', title: 'Mechanic: safe circles',
        summary: 'Red everywhere: stand in the green circle.',
        body: [
          `A boss with a **safe circle** paints the ground round you red, all but one small green circle. You have ${secs(CIRCLE_TICKS)} to step into it before the blast lands.`,
          'Auto battle\'s dodge setting (if you leave it on) moves you off red ground for you, into the circle too.',
          () => `Bosses with a safe circle: ${mechanicBosses('circle').join(', ')}.`,
        ],
        see: ['boss-mechanics', 'auto-battle'],
      },
      {
        id: 'mech-adds', title: 'Mechanic: healing adds',
        summary: 'Little helpers that mend the boss: kill them first.',
        body: [
          `A boss with **healing adds** calls a few small helpers. Each mends ${pct(HEAL_FRAC, 1)} of the boss's life every ${sec(HEAL_EVERY)}, up to ${pct(HEAL_CAP)} in all, and fades after ${sec(ADDS_TICKS)} if you leave it.`,
          'They have little life: switch to them, then go back to the boss. Auto battle turns on them by itself.',
          () => `Bosses with healing adds: ${mechanicBosses('adds').join(', ')}.`,
        ],
        see: ['boss-mechanics', 'auto-battle'],
      },
      {
        id: 'mech-cast', title: 'Mechanic: interruptible casts',
        summary: 'A long cast bar: break it with a skill or special attack.',
        body: [
          `A boss with an **interruptible cast** starts a cast bar that fills in ${sec(CAST_TICKS)}. Any skill or special attack stops it. If it lands it takes ${pct(CAST_HIT)} of your life (never all of it).`,
          'Keep a skill ready for the cast: auto battle uses one on it while you leave its skills on.',
          () => `Bosses with an interruptible cast: ${mechanicBosses('cast').join(', ')}.`,
        ],
        see: ['boss-mechanics', 'abilities'],
      },
    ],
  },
  {
    id: 'loot-ch', title: 'Loot', icon: '💎',
    articles: [
      {
        id: 'drops', title: 'Drops and rarity',
        summary: 'What monsters drop, and what the coloured beams mean.',
        body: [
          'Every monster rolls its own drop table. A rarer drop glows in its colour, shoots a beam of light and lingers a moment before it flies into your pack:',
          () => ({ table: { head: ['Rarity', 'What it is'], rows: rarityRows() } }),
          `Ordinary monsters drop gear sparingly: ${pct(NORMAL_GEAR_SKIP)} of their gear rolls become something else (accessories are exempt). Bosses and champions are the place to farm gear.`,
          'Elder monsters roll their table twice and Dire and Ancient ones three times. Weapons and armour of another class mostly turn into your own class\'s kind.',
          'Upgrade stones drop from anything, more from stronger monsters; refine scrolls turn up now and then too.',
        ],
        see: ['rare-table', 'quality', 'champions'],
      },
      {
        id: 'rare-table', title: 'The rare drop table',
        summary: 'A small extra chance on any kill.',
        body: [
          'Any kill has a small chance to roll the shared **rare drop table**: 1% plus a little more the higher the monster\'s level (up to 50%). Champions get that chance once for each kill they are worth, and bosses always hit it five times.',
          () => ({ table: { head: ['Item', 'Share'], rows: (() => { const t = RARE_DROP_TABLE.reduce((s, e) => s + e.weight, 0); return RARE_DROP_TABLE.map((e) => [`${e.min ? `${num(e.min)}–${num(e.max)} ` : ''}${itemName(e.id)}`, pct(e.weight / t, 1)]); })() } }),
        ],
        see: ['drops'],
      },
      {
        id: 'clues', title: 'Clue scrolls',
        summary: 'Riddles that lead to a reward casket.',
        body: [
          'Monsters rarely drop a **clue scroll** (about 1 kill in 160 for the weakest, up to 1 in 20 for high levels and bosses), and only while you are not already carrying one. Read it for a riddle pointing to a landmark, go there and dig. Each step gives the next riddle; the last opens a reward casket.',
          () => ({ table: { head: ['Tier', 'Dropped from level', 'Steps', 'Casket rolls'], rows: clueRows() } }),
        ],
        see: ['collection-log'],
      },
      {
        id: 'collection-log', title: 'The Collection log',
        summary: 'Tick off every unique drop; full pages earn titles.',
        body: [
          'The **Collection log** (Journal → Awards) has a page for every source of loot: each boss, champions, Slayer, each clue tier, the Endless Gate and the life skills\' rare finds. An item is ticked off when it drops (with a count), and finishing a page earns a title to wear.',
        ],
        see: ['pets', 'clues'],
      },
      {
        id: 'pets', title: 'Pets',
        summary: 'Very rare companions from bosses and life skills.',
        body: [
          `Every boss and every life skill has a **pet**. A boss kill rolls 1 in ${num(BOSS_PET_RATE)} at first, getting better by one for each kill of that boss down to 1 in ${num(BOSS_PET_FLOOR)}. Each life-skill action rolls 1 in ${num(SKILL_PET_RATE)}.`,
          'A new pet follows you straight away. Choose or dismiss your follower from the Pets section of the Collection log; pets take no bag space.',
        ],
        see: ['collection-log', 'bosses'],
      },
    ],
  },
  {
    id: 'gear-ch', title: 'Gear', icon: '🗡️',
    articles: [
      {
        id: 'gear-tiers', title: 'Gear tiers',
        summary: 'Bronze to Eternal: the level each metal needs.',
        body: [
          'Weapons and armour come in metal tiers. Each needs a level in the skill it uses (Defence for armour, your fighting skill for weapons):',
          () => ({ table: { head: ['Tier', 'Level'], rows: gearTierRows() } }),
          'Bows, staves and wands follow the same ladder in wood, and bosses add their own unique pieces. The **Gear Guide** ranks every piece in a slot, best first; a green ▲ in your bag marks gear better than what you wear.',
        ],
        see: ['equip-best', 'quality', 'mastery'],
      },
      {
        id: 'mastery', title: 'Gear mastery',
        summary: `Using your gear makes it stronger: ${MASTERY_RANKS[0].name} to ${MASTERY_RANKS[MASTERY_RANKS.length - 1].name}.`,
        body: [
          'Mastery belongs to a **gear type**, not one item: every sword shares Sword mastery, every plate body Plate body mastery. So moving up a tier keeps everything you have earned.',
          `Every kill gives each type you wear mastery XP: ${KILL_XP} for a level 1 monster and 10 more for every 100 levels (20 at level 100, 40 at level 300), so stronger monsters count for more; ${KILL_MULT.champion}x that for a champion, ${KILL_MULT.boss}x for an Endless Gate boss and ${KILL_MULT.worldBoss}x for a world boss. Each rank adds a share of the item\'s base stats:`,
          () => ({ table: { head: ['Rank', 'XP', 'Stat bonus'], rows: masteryRankRows() } }),
          `You can also feed life-skill materials or [[salvage|sacrifice spare gear]] to a type; those stop at ${MASTERY_RANKS[FEED_CAP_RANK].name}, so the ranks above come from fighting.`,
          `The last two ranks are unlocked by defeating world bosses: past ${MASTERY_RANKS[BATTLE_CAP_RANK].name}, only XP from bosses fought in the open world counts. Ordinary kills, Endless Gate bosses, materials and sacrifices add nothing more.`,
        ],
        see: ['quality', 'enchanting', 'carry-over'],
      },
      {
        id: 'quality', title: 'Quality',
        summary: 'Fine to Mythic: one copy\'s stats, multiplied.',
        body: [
          'A dropped piece of gear can arrive with a **quality**. Quality belongs to that one copy and multiplies its stats, mastery included. It has nothing to do with mastery ranks. Each tier is far rarer than the one before, and who dropped it matters:',
          () => ({ table: { head: ['Quality', 'Stats', 'Monster', 'Champion', 'Boss'], rows: qualityRows() } }),
          'The chances are for each piece of gear that drops. Bosses always drop Superior or better.',
        ],
        see: ['mastery', 'champions', 'salvage'],
      },
      {
        id: 'enchanting', title: 'Enchanting',
        summary: `Up to ${MAX_ENCHANTS} bonus lines on an item, paid in upgrade stones.`,
        body: [
          `Enchanting adds up to **${MAX_ENCHANTS} bonus lines** to an item (every copy of that item shares them). Each attempt offers three random lines and you keep the one you pick. It costs upgrade stones (${[0, 1, 2].map((n) => enchantCost('bronze_sword', n).stones).join(', ')} for the first, second and third line) and coins (half the item's value plus 200).`,
          () => `Lines can be: ${Object.values(ENCHANT_LABELS).join(', ')} (physical damage for weapons and armour that hit, magic for casters). Lines grow with the item's level.`,
          'An **upgrade ward** lets you reroll the three offers. On a full item, a new line replaces one you choose.',
        ],
        see: ['refining', 'upgrade-materials', 'carry-over'],
      },
      {
        id: 'refining', title: 'Refining',
        summary: `★1 to ★${MAX_REFINE}: more stats, more risk.`,
        body: [
          `Refining raises an item from ★1 to **★${MAX_REFINE}**. Each level adds a share of its base stats: 6% a level to ★9, 10% to ★12 and 15% to ★15 (${pct(refineGain(MAX_REFINE))} at ★${MAX_REFINE}). Every attempt costs refine scrolls, and the higher you go the riskier it gets:`,
          { list: [
            '**From ★6** an attempt can fail (the scrolls are used up).',
            '**From ★10** it can also drop a level.',
            '**From ★13** it can break the item and reset the refine.',
          ] },
          'An **upgrade ward** in your pack takes the blow of a drop or a break instead (it is used up, and the attempt counts as a plain failure).',
        ],
        see: ['enchanting', 'upgrade-materials', 'carry-over'],
      },
      {
        id: 'upgrade-materials', title: 'Upgrade stones, wards and scrolls',
        summary: 'Where they come from and what they do.',
        body: [
          { list: [
            '**Upgrade stones** pay for enchanting. They drop from anything (most from bosses and champions), from dismantled gear and the Endless Gate, and Smithing can forge them.',
            '**Upgrade wards** reroll enchant offers and protect a refine. Bosses always leave some, champions sometimes; Crafting makes them too.',
            '**Refine scrolls** pay for refining. Rare from monsters, likelier from champions, a few from every boss; Smithing hammers them from adamant.',
          ] },
        ],
        see: ['enchanting', 'refining', 'salvage', 'endless-gate'],
      },
      {
        id: 'carry-over', title: 'Carrying upgrades over',
        summary: 'Better gear takes your refine and enchantments with it.',
        body: [
          'When you put a better piece into a slot, the old piece\'s refine and enchantments move across, so outgrowing a piece never wastes what you spent on it:',
          { list: [
            '**Refine** levels swap, but at most ★10 goes across; anything above stays on the old piece.',
            '**Enchantments** move when the new piece has none or theirs are worth less. Lines it can\'t roll stay behind.',
            '**Mastery** never needs moving: it belongs to the gear type.',
          ] },
          'A weapon keeps its style (a staff never takes a sword\'s upgrades). Nothing is ever copied, only moved, so swapping back and forth can\'t make more of anything.',
        ],
        see: ['mastery', 'equip-best'],
      },
      {
        id: 'equip-best', title: 'Equip best',
        summary: 'One button to put on your strongest gear.',
        body: [
          '**Equip best in slot** (Bag → Gear) puts on the strongest piece in your pack for every slot, counting mastery, enchantments and each copy\'s quality, and keeping to your current weapon style. Damage decides; Defence and life only break a tie. Then it fills a dual-wield off-hand.',
        ],
        see: ['gear-tiers', 'weapon-grips'],
      },
      {
        id: 'salvage', title: 'Sacrifice and dismantle',
        summary: 'Turn spare gear into mastery or upgrade materials.',
        body: [
          'Spare gear (any class\'s, any slot) can be used up two ways, from the Gear Mastery window or the item\'s menu:',
          { list: [
            `**Sacrifice** it to the mastery of its own gear type for ${SACRIFICE_XP}x its worth in mastery XP, more for a refined piece and as your mastery climbs (up to ${MASTERY_RANKS[FEED_CAP_RANK].name}).`,
            `**Dismantle** it into upgrade stones and sometimes a refine scroll. A Legendary piece has a ${pct(WARD_CHANCE.legendary)} chance of a ward, a Mythic one ${pct(WARD_CHANCE.mythic)}, and a boss unique ${pct(WARD_CHANCE.unique)} or more.`,
          ] },
          () => `A piece's worth grows with its level, how high it ranks in its slot, and its quality: ${QUALITY_ORDER.map((k) => `${QUALITY[k].label} x${QUALITY_MULT[k]}`).join(', ')}. Boss uniques and signature weapons are worth far more.`,
          'You are warned before using up something you might want, like your best copy or a high quality.',
        ],
        see: ['mastery', 'offering-shrine', 'upgrade-materials'],
      },
      {
        id: 'offering-shrine', title: 'The Offering Shrine',
        summary: 'Turn materials into permanent combat blessings.',
        body: [
          `The **Offering Shrine** in Kampong Glam takes life-skill materials (worth a tenth of their value in shrine points), spare gear, and other goods (their value ÷ ${GOODS_RATE}). Points buy ranks in five blessings, each a permanent bonus in every fight:`,
          () => ({ table: { head: ['Blessing', 'Each rank'], rows: shrineRows() } }),
          `Ranks have no cap; each costs more than the last (rank 1: ${num(shrineCost(1))} points, rank 10: ${num(shrineCost(10))}, rank 25: ${num(shrineCost(25))}).`,
        ],
        see: ['salvage', 'skills-overview'],
      },
    ],
  },
  {
    id: 'skills-ch', title: 'Skills', icon: '⛏️',
    articles: [
      {
        id: 'skills-overview', title: 'All the skills',
        summary: 'Combat, gathering, making and the rest.',
        body: [
          () => ({ table: { head: ['Skill', 'What it does'], rows: STAT_ROWS() } }),
          'Tap a skill in the Skills tab for its guide: where to train, what you can make, and a **Go** button to walk to the nearest spot.',
        ],
        see: ['golden-hours', 'skill-unlocks', 'skill-chains'],
      },
      {
        id: 'golden-hours', title: 'Golden hours',
        summary: `Each life skill earns x${GOLDEN_HOUR_XP} XP at its own time of day.`,
        body: [
          `A game day lasts ${mins(DAY_CYCLE_MS)}. Each life skill has a **golden hour**, a twelve-hour window on the in-game clock (about five real minutes, half the day) when its XP is worth **x${GOLDEN_HOUR_XP}**:`,
          () => ({ table: { head: ['Skill', 'When', 'Game time'], rows: goldenHourRows() } }),
        ],
        see: ['skills-overview', 'levels-xp'],
      },
      {
        id: 'skill-unlocks', title: 'Skill unlocks',
        summary: `Every life skill unlocks something at levels ${UNLOCK_LEVELS.join(', ')}, and their bonuses keep growing to level ${num(LIFE_MAX_LEVEL)}.`,
        body: [
          `At levels **${UNLOCK_LEVELS.join(', ')}** each life skill unlocks something you feel while training it: double yields, quick actions, kept ingredients, trees and rocks that hold, new recipes, and a teleport to its best training spot (skill teleports share a 5-minute cooldown). Each skill's article lists its ladder.`,
          `Past the last rung every bonus they give keeps growing, a little with every level, to **x${UNLOCK_TOP_MULT}** by level ${num(MAX_LEVEL)} and on at that pace to **x${(1 + (UNLOCK_TOP_MULT - 1) * towardTop(LIFE_MAX_LEVEL, UNLOCK_LEVELS[UNLOCK_LEVELS.length - 1])).toFixed(2)}** at ${num(LIFE_MAX_LEVEL)} (teleports and recipes stay as they are). The ladders show each rung before that growth; a skill's guide shows how much more they give you now.`,
          'Separately, every 20 levels of a fighting or life skill unlocks a passive perk that helps in a fight.',
        ],
        see: ['skills-overview', 'skill-chains'],
      },
      {
        id: 'skill-chains', title: 'Skill chains',
        summary: 'Life skills that feed one another.',
        body: [
          'The life skills lean on each other: logs feed Firemaking, Fletching and Construction (as planks), ore becomes bars for Smithing (and nails for Construction), raw fish and meat go to Cooking, crops to Herblore.',
          () => `Some makes boost another skill. ${Object.entries(GATHER_CONSUMABLES).map(([s, c]) => `${AOrAn(itemName(c.id).toLowerCase())} in your pack adds ${pct(c.double)} double ${SKILL_BY_ID[s].name} yield`).join('; ')}. Herblore brews can raise Fishing, Hunter and Mining yields, and boss-fight meals cook from Hunter meat, farmed herbs and fish.`,
        ],
        see: ['skills-overview', 'auto-gather'],
      },
      ...SKILLS.filter((s) => SKILL_UNLOCKS[s.id]).map((s) => ({
        id: `skill-${s.id}`, title: s.name,
        summary: s.desc,
        body: [
          s.desc,
          SKILL_HOURS[s.id] ? `Golden hour: **${SKILL_HOURS[s.id].when}** (${SKILL_HOURS[s.id].why}).` : null,
          { tip: 'Open the skill\'s guide from the Skills tab for every spot, recipe and requirement.' },
          () => ({ table: { head: ['Level', 'Unlock', 'Effect'], rows: unlockRows(s.id) } }),
        ].filter(Boolean),
        see: ['skill-unlocks', 'golden-hours'],
      })),
      {
        id: 'gathering-streaks', title: 'Gathering streaks',
        summary: `Gather on and on for up to +${pct(STREAK_TIERS * STREAK_XP_STEP)} XP.`,
        body: [
          `Every successful gather in the same skill adds to a **streak**. Each ${STREAK_STEP} in a row adds +${pct(STREAK_XP_STEP)} XP in that skill, up to ${STREAK_TIERS} steps (+${pct(STREAK_TIERS * STREAK_XP_STEP)}), and makes [[lucky-finds]] a little likelier.`,
          `Change skill, or go ${secs(STREAK_GAP_TICKS)} without a catch, and the streak starts again: long enough to walk to the next tree, not long enough for a trip to the bank.`,
        ],
        see: ['lucky-finds', 'resource-zones', 'auto-gather'],
      },
      {
        id: 'lucky-finds', title: 'Lucky finds',
        summary: `About 1 gather in ${num(LUCKY_RATE)} turns up a little cache.`,
        body: [
          `Any Woodcutting, Mining, Fishing, Hunter, Diving or Archaeology gather has a 1 in ${num(LUCKY_RATE)} chance of a **lucky find**, ${pct(LUCKY_STREAK_BONUS)} likelier for each step of your [[gathering-streaks|streak]].`,
          { list: [
            'Coins (more at higher-level nodes).',
            "The skill's own rare find: a bird's nest from trees, a gem from rocks, a pearl from fishing, a bundle of feathers from Hunter, a seed pearl or two from Diving, a handful of old coins from Archaeology.",
            'A burst of XP, about five gathers\' worth.',
          ] },
          'A sparkle and a banner tell you when one turns up.',
        ],
        see: ['gathering-streaks', 'collection-log'],
      },
      {
        id: 'skilling-contracts', title: 'Daily skilling contracts',
        summary: `${GATHER_CONTRACTS} gathering jobs a day from Cikgu Surya.`,
        body: [
          () => `Cikgu Surya in Kampong Glam hands out **${GATHER_CONTRACTS} skilling contracts** a day, each in a different skill from ${CONTRACT_SKILLS.map((s) => SKILL_BY_ID[s]?.name || s).join(', ')}: "gather 25 to 50 times at one kind of node", picked from the best nodes you can use.`,
          `Each pays coins and XP the moment it is done. Clear all ${GATHER_CONTRACTS} on back-to-back days to build a streak worth +${pct(CONTRACT_STREAK_STEP)} pay a day, up to +100%.`,
        ],
        see: ['bounties', 'resource-zones'],
      },
      {
        id: 'resource-zones', title: 'Resource zones',
        summary: 'Named places packed with one skill\'s nodes.',
        body: [
          'A few places are packed with one life skill\'s nodes, laid out in a tidy grid with a signpost in the middle: somewhere worth settling in to train. Walking in tells you what it holds and the levels it wants, and the world map labels each one.',
          { list: [
            '**Ubin Granite Quarry** (Mining) and **Tekong Deep Mine** (Mining).',
            '**Jurong Timberland** (Woodcutting) and **Coney Old-Growth Woods** (Woodcutting).',
            '**Changi Fishing Pier** (Fishing).',
            '**Buloh Hunting Grounds** (Hunter).',
          ] },
          'A working ground is **calm**: the monsters camped beside it do not attack on sight (you can still fight them). Each one you walk into counts as a [[discoveries|discovery]].',
        ],
        see: ['gathering-streaks', 'skilling-contracts', 'auto-gather'],
      },
      {
        id: 'do-all', title: 'Do all at a station',
        summary: 'Smelt, cook, fletch or brew everything you can in one go.',
        body: [
          '**Do all** at a crafting station works through every recipe you can make there, best first, one after another, until nothing is left you can make: smelt all your ore, cook all your fish, fletch all your logs, brew all your herbs, smith all your bars, craft all your gems and clay.',
        ],
        see: ['skill-chains', 'auto-gather'],
      },
    ],
  },
  {
    id: 'auto-ch', title: 'Auto play', icon: '🤖',
    articles: [
      {
        id: 'auto-battle', title: 'Auto battle',
        summary: 'Press T and your hero hunts, eats and uses skills alone.',
        body: [
          'With **auto battle** on (T, or the Battle switch) your hero picks monsters, fights, eats when hurt, uses its skills and braces against heavy blows. Steering pauses it. The ⚙ button beside the switches sets how it plays:',
          { list: [
            '**Eat food**: never, or below 25%, 40% or 60% life.',
            '**What to fight**: anything, or one kind of monster near you. Anything attacking you is always fought.',
            '**Bosses** and **Champions**: fight them or skip them (one attacking you is always fought).',
            '**Targets**: *Champs & bosses first* (even mid-fight, then anything else), *Champs & bosses only* (it goes looking for them; others only if they attack you), or *Nearest* (the closest by the walk there).',
            '**Boss attacks**: auto dodge steps out of red markers for you (each dodge trains Agility), or leave dodging to you.',
            '**Attack skills**: spend adrenaline on skills, or save it.',
          ] },
          'Auto battle uses up [[focus-rested|Focus]].',
        ],
        see: ['auto-gather', 'auto-quest', 'focus-rested'],
      },
      {
        id: 'auto-gather', title: 'Auto gather',
        summary: 'Press Y and you move on when a tree, rock or spot runs dry.',
        body: [
          'With **auto gather** on (Y), when a node runs dry you walk to the next one. Every kind you gather while it is on joins the round (copper and tin for bronze, say), up to 6 kinds of the same skill. It also farms ripe patches and picks pockets.',
          '**Picks**: tick kinds in a skill guide and auto gather takes turns at exactly those instead. Untick them all from the auto battle settings.',
          'It stops when your bag is full, and waits when nothing nearby has grown back.',
        ],
        see: ['auto-battle', 'skill-chains'],
      },
      {
        id: 'auto-quest', title: 'Auto quest',
        summary: 'Press U to start, work through and hand in quests by yourself.',
        body: [
          'With **auto quest** on (U, or the switch in the Journal) you start, work through and hand in your quests on your own: the one you last pressed **Go** on, else the next. It switches auto battle on for fights. It can also run **Slayer**: fetch a task, hunt it down and come back for the next.',
          'Steering pauses it; dying switches it off.',
        ],
        see: ['story-quests', 'slayer', 'auto-battle'],
      },
      {
        id: 'focus-rested', title: 'Focus and rested XP',
        summary: 'Gentle nudges for automatic play and time away.',
        body: [
          `**Focus**: auto battle and auto gather spend it; hands-on play (clicking, steering, keys) refills it ${FOCUS_ACTIVE_REFILL} times as fast, and it trickles back on its own, faster while you are away. A full bar is ${mins(FOCUS_MAX_MS)} of automatic play. When it runs dry, automatic play carries on at ${pct(TIRED_MULT)} of the XP and loot.`,
          `**Rested XP**: time logged out builds a rested pool (${pct(RESTED_RATE)} of the time away, up to ${mins(RESTED_CAP_MS)}). While it lasts every XP gain is worth **x${RESTED_MULT}**.`,
        ],
        see: ['auto-battle', 'levels-xp'],
      },
    ],
  },
  {
    id: 'quests-ch', title: 'Quests and goals', icon: '📜',
    articles: [
      {
        id: 'story-quests', title: 'Story quests',
        summary: 'The main quests and the quest points they give.',
        body: [
          'Quests are in the Journal tab. Tap one (or its **Go**) to travel to wherever it needs you next. Quest points mark your progress.',
          () => ({ table: { head: ['Quest', 'Quest points'], rows: storyQuestRows() } }),
        ],
        see: ['region-quests', 'auto-quest'],
      },
      {
        id: 'region-quests', title: 'Region quests',
        summary: 'A short quest line in every region, each with its own giver.',
        body: [
          'Every region has a short quest line with its own quest giver, running outwards from Kampong Glam by the fight level it asks for. Finishing one unlocks something: a teleport to the giver, a ferry, a shop, gathering spots or a permanent bonus.',
          () => ({ table: { head: ['Region', 'Quest', 'From fight level'], rows: regionQuestRows() } }),
        ],
        see: ['story-quests', 'regions'],
      },
      {
        id: 'bounties', title: 'Daily bounties and weekly challenges',
        summary: 'Three kill targets a day, and three tasks a week.',
        body: [
          '**Daily bounties**: three kill targets a day near your fight level, paid in coins. Finish all three for a bonus; on back-to-back days you build a **streak** worth +10% pay a day (up to +100%).',
          () => `**Weekly challenges**: each week features one region with three tasks: ${WEEKLY_TASKS.map((t) => t.text('the region').replace(/^./, (c) => c.toLowerCase())).join('; ')}. All three open a reward crate (a casket, coins, upgrade stones and a refine scroll).`,
        ],
        see: ['world-events', 'pest-control'],
      },
      {
        id: 'world-events', title: 'World events',
        summary: 'Something happening somewhere on the island.',
        body: [
          `Every ${Math.round(EVENT_GAP[0] * TICK_MS / 60000)} to ${Math.round(EVENT_GAP[1] * TICK_MS / 60000)} minutes of play a **world event** starts in a region. It is marked on the minimap and in the Journal with a **Go** button, and pays by your share of it.`,
          () => ({ table: { head: ['Event', 'Lasts'], rows: eventRows() } }),
          'Skilling events (shoal, meteor, ancient tree) pay double XP and bonus resources.',
        ],
        see: ['bounties', 'world-bosses'],
      },
      {
        id: 'slayer', title: 'Slayer',
        summary: 'Tasks from Slayer Master Rajan; hit task monsters harder.',
        body: [
          'Slayer Master Rajan gives you a task: defeat a number of one family of monster (any rank counts). Higher Slayer levels unlock tougher families.',
          `On task you hit harder (+${SLAYER_DMG[0]}% at level 1, rising to +${SLAYER_DMG[1]}% at level ${SLAYER_FULL_LEVEL}) and get a chance of a second helping of loot (+${SLAYER_LOOT[0]}% to +${SLAYER_LOOT[1]}%). The Slayer helmet adds +${SLAYER_HELM_DMG}% on top.`,
          'Each finished task pays 10 Slayer points, 25 every fifth task and 50 every tenth. Points buy:',
          () => ({ table: { head: ['Reward', 'Points'], rows: SLAYER_REWARDS.map((r) => [`${r.qty > 1 ? `${num(r.qty)} ` : ''}${itemName(r.id)}`, num(r.cost)]) } }),
        ],
        see: ['auto-quest', 'pest-control'],
      },
      {
        id: 'pest-control', title: 'Pest Control',
        summary: 'Daily culling contracts from Officer Aziz.',
        body: [
          `Pest Control Officer Aziz in Kampong Glam hands out ${CONTRACT_COUNT} **culling contracts** a day ("Cull 25 rats in Bukit Timah"), paid in Pest Control tokens and coins. Tokens buy food, Hunter bait, a mosquito-net cape, gathering lamps and Codex quills.`,
          'Clearing harmless creatures also gives a trickle of Hunter XP, counts towards [[codex-mastery]], and (while you are Neutral) builds Stewardship, whose ranks bring gentle gathering and food perks.',
        ],
        see: ['codex-mastery', 'bounties'],
      },
    ],
  },
  {
    id: 'story-ch', title: 'The story and the island\'s people', icon: '📕',
    articles: [
      {
        id: 'main-story', title: `The main story: ${STORY_NAME}`,
        summary: `${STORY_CHAPTERS.length} chapters, from Kampong Glam to the edge of the Rift.`,
        body: [
          `Something is tearing the Shadow Rift open. **${STORY_NAME}** ties the region quest lines and a few story quests into one journey across the island, in ${STORY_CHAPTERS.length} chapters played in order. A chapter is done when all its quests are, however you finished them, so one can open already complete.`,
          'Opening a chapter plays its **scene** (the speaker comes to you, or a messenger runs up with a letter when they are far away); finishing one pays coins, an item, a title and a badge, and gives the chapter\'s lore page. Replay any scene from the Story page of the Journal.',
          () => ({ table: { head: ['Chapter', 'Title', 'Where', 'Title earned'], rows: storyChapterRows() } }),
          { tip: 'Scenes never interrupt auto battle or auto quest (their lines go to the chat instead), and never start mid-fight.' },
        ],
        see: ['story-events', 'lore-pages', 'region-quests'],
      },
      {
        id: 'story-events', title: 'Story events: raids, ransacks and messengers',
        summary: 'Small happenings in the world as the quest lines move on.',
        body: [
          'As a region\'s quest line moves on, little story events happen near its quest giver:',
          { list: [
            `**Ransack**: when a line begins, the giver\'s stall has been turned over. Tidy it up (it packs itself away after ${mins(RANSACK_TICKS * TICK_MS)}).`,
            `**Raid**: when a line reaches its named foe, ${RAIDERS} of the foe\'s gang raid the giver\'s patch for up to ${mins(RAID_TICKS * TICK_MS)}. Drive them off.`,
            '**Messenger**: when a chapter opens far from its speaker, a runner brings you the letter.',
          ] },
          'One runs at a time, and everything an event puts in the world is taken away again when it ends, when you fall, or when you reload.',
        ],
        see: ['main-story', 'region-quests'],
      },
      {
        id: 'lore-pages', title: 'Lore pages',
        summary: `${LORE.length} pages of the island\'s story to collect.`,
        body: [
          `There are **${LORE.length} lore pages** in ${LORE_SETS.length} sets: two for each region, and one for each chapter of the main story.`,
          { list: [
            `A region\'s **drop page**: any kill in that region may turn it up (about 1 in ${num(Math.round(1000 / LORE_DROP_PER_MIL))}, or 1 in ${num(Math.round(1000 / LORE_DROP_PER_MIL_BIG))} from a boss or champion).`,
            "A region's **hidden page**: a glinting note somewhere near its quest giver. Read it to take the page.",
            'A **chapter page**: each finished chapter of the main story gives its own.',
          ] },
          () => `Finishing a region's two pages wakes its **lore guardian**, a champion waiting by the hidden spot: beat it for coins and ${GUARDIAN_ITEM[1]} ${itemName(GUARDIAN_ITEM[0]).toLowerCase()}. Every chapter page together pays ${num(STORY_SET_REWARD.coins)} coins and the title "${STORY_SET_REWARD.title}".`,
          'Each page you hold counts as a [[discoveries|discovery]].',
        ],
        see: ['main-story', 'discoveries'],
      },
      {
        id: 'reputation', title: 'Region reputation',
        summary: 'From Stranger to Legend in every region.',
        body: [
          `Every region keeps a meter of how well its people know you, from Stranger up to Legend (at most ${num(REP_CAP)} points). Evil choices made there can sink it as far as ${num(REP_FLOOR)}: Distrusted.`,
          () => ({ table: { head: ['Rank', 'Points', 'Shop prices there', 'Title to wear'], rows: repRankRows() } }),
          'What moves it:',
          () => ({ table: { head: ['Deed', 'Points'], rows: repGainRows() } }),
          'Known: the quest givers greet you as a regular. Friend: they share the local news, and shops there give you a discount. Hero and Legend: a title. The Regions page of the Journal shows every meter. An older save starts with credit for what it had already done there.',
        ],
        see: ['choices', 'npc-memory', 'region-quests'],
      },
      {
        id: 'choices', title: 'Choices and their consequences',
        summary: `${MORAL_EVENTS.length} moral choices, and how the world remembers them.`,
        body: [
          `Here and there someone needs you: a crying child with a purse, a hawker who gave too much change, a beaten bandit. There are **${MORAL_EVENTS.length}** of these moments across the island, and each has a **good** and an **evil** answer.`,
          `A good answer gives karma towards good, often a little XP, and the **Blessed** buff: +${pct(BLESS_XP - 1)} combat XP for ${mins(BLESS_MS)} (a different thing from the [[prayers|Blessings]] you equip with Prayer). An evil answer pays coins and karma towards evil.`,
          () => `Your choices, and the region quest lines you finish, leave **${CONSEQUENCES.length} lasting changes** in the world: new residents who set up a stall, ones who pack up and leave, shop prices that go up or down, and regions whose light turns a touch warmer or gloomier. The Regions journal lists the ones you have caused.`,
          'Your karma sets your **alignment**:',
          () => ({ table: { head: ['Title', 'Karma (good minus evil)'], rows: alignmentRows() } }),
          'A Paragon glows gold; a Villain trails dark smoke, townsfolk are afraid of them, and the town guards may challenge them.',
        ],
        see: ['reputation', 'npc-memory'],
      },
      {
        id: 'npc-memory', title: 'NPCs who remember you',
        summary: 'Townsfolk talk about your latest big deeds.',
        body: [
          `People remember your latest big deeds: a boss or champion beaten, a quest finished, a world event won. For ${mins(FRESH_MS)} of play after each one, townsfolk mention it.`,
          { list: [
            `Now and then (at most every ${sec(REMARK_EVERY)} or so) someone within ${REMARK_RANGE} tiles passes a remark.`,
            'Talk to someone and they greet you personally; quest givers in a region where you are Known or better have more to say.',
            'A boss taunts you as the fight starts, and some remember you by name.',
          ] },
        ],
        see: ['reputation', 'npc-routines'],
      },
      {
        id: 'npc-routines', title: 'Townsfolk and their day',
        summary: 'Stall keepers go home at night; neighbours stop for a chat.',
        body: [
          'Townsfolk and the region quest givers keep simple daily routines on the in-game clock: a stall keeper minds the stall by day and walks home at night, others run errands between two or three spots, and villagers potter about and stop for a chat with a neighbour.',
          `Click someone and they stop and turn to you, waiting ${secs(HOLD_TICKS)} for you to arrive, so a routine never gets in the way of a shop, a bank or a quest.`,
        ],
        see: ['npc-memory', 'golden-hours'],
      },
    ],
  },
  {
    id: 'places-ch', title: 'Places', icon: '🗺️',
    articles: [
      {
        id: 'regions', title: 'Regions',
        summary: 'Where monsters of each level live.',
        body: [
          'The island spreads out from the starting towns: the old island in the north-west, the open world east and south of it, and the far regions beyond. The deeper you go, the stronger the monsters. Press **M** for the world map.',
          () => ({ table: { head: ['Region', 'Monster levels', 'Kinds', 'Bosses'], rows: regionRows() } }),
          'The **Wilderness** pays more combat XP the deeper you go (see [[levels-xp]]).',
        ],
        see: ['mrt', 'region-quests'],
      },
      {
        id: 'mrt', title: 'The MRT',
        summary: `Fast travel between stations for ${MRT_FARE} coins.`,
        body: [
          `Board the **MRT** at any station and ride to another for ${MRT_FARE} coins. The Wilderness and Pulau Hantu are not on the network: walk there.`,
          () => ({ table: { head: ['Station'], rows: mrtRows() } }),
          'The Codex\'s Go button rides the MRT for you when it is quicker.',
        ],
        see: ['regions', 'home'],
      },
      {
        id: 'home', title: 'Your kampong home',
        summary: `A plot in Kranji Farmlands for ${num(HOME_PRICE)} coins.`,
        body: [
          `Buy a home plot just east of Kranji Village for **${num(HOME_PRICE)} coins**. It has a storage chest (separate from the bank), a cooking range, a fire that never goes out, farm patches, a trophy wall, and a teleport home with a cooldown.`,
          'Then build it up with **Construction**, room by room, in the home window\'s **Build** tab: each build needs a Construction level and a hammer, costs planks, nails, bricks or furniture (from your pack, then the bank) and some coins, pays Construction XP and gives the room a perk. Rooms: a parlour (Focus refills fast while you\'re home, and a bank chest), a kitchen (a better range), a workshop (a workbench, an anvil, a crafting table and a fletching bench of your own), an altar (offer bones at home), a bedroom (Rested XP builds faster while you\'re away), a portal room (teleports to the MRT of any region you\'ve visited), a garden and a trophy hall (a little extra damage to bosses). Upgrades bought before Construction are all kept.',
          () => ({ table: { head: ['Upgrade', 'Tiers'], rows: homeRows() } }),
        ],
        see: ['mrt', 'skill-unlocks'],
      },
      {
        id: 'hawker-stall', title: 'Your hawker stall',
        summary: `Hawkering: rent a stall at Marina Bay for ${num(STALL_RENT)} coins and serve the queue.`,
        body: [
          `Rent your own stall at the **Marina Bay hawker centre** for **${num(STALL_RENT)} coins** and open up: townsfolk queue at your counters, each wanting a dish you have (from your pack, or your bank: a runner fetches it). Serve them before their **patience** runs out for a hawker's fair price (about what a shop would pay), a **tip** and **Hawkering** XP.`,
          { list: [
            'Serve quickly and keep a **streak** going without anyone walking off: the tips grow, and so does the stall\'s **reputation** (and its prices).',
            '**Auto-serve** (the auto gather switch) keeps serving from what you carry, best dish first.',
            'Levels bring more counters and faster service, **VIP regulars** with special orders and big tips (level 40), and **signature dishes** cooked at the stall\'s wok from the Hawker Auntie\'s dry goods.',
            'From level 100 customers order the endgame dishes; at level 50 a skill unlock teleports you to Marina Bay.',
          ] },
        ],
        see: ['skill-unlocks', 'home'],
      },
      {
        id: 'endless-gate', title: 'The Endless Gate',
        summary: 'Endless, ever-stronger waves; leave when you like.',
        body: [
          'Step through the **Endless Gate** in Kampong Glam into a sealed arena where monsters come in waves, each stronger than the last. Fight until you fall or choose to leave; either way you come out where you went in, **keeping everything**.',
          { list: [
            `Gate monsters are tougher than the same monsters outside: more life, harder and surer hits.`,
            `Every wave is led by a champion (two from wave 20), and every ${BOSS_EVERY}th by a boss instead, with a guaranteed chest; every ${MILESTONE_EVERY}th wave's chest is a bigger milestone chest.`,
            'Clearing a wave pays coins, and from later waves upgrade stones, refine scrolls and wards.',
          ] },
          'Before a run you can pick **modifiers**. They stack, each making the run harder and paying for it:',
          () => ({ table: { head: ['Modifier', 'Harder', 'Reward'], rows: gateModRows() } }),
        ],
        see: ['upgrade-materials', 'death'],
      },
      {
        id: 'teleports', title: 'Town and Grave teleports',
        summary: `Home to Kampong Glam (${TOWN_KEY}) or back to your gravestone (${GRAVE_KEY}).`,
        body: [
          'Two teleports are yours from the start, on the **Town** and **Grave** buttons:',
          { keys: [[TOWN_KEY, 'Town: back to Kampong Glam'], [GRAVE_KEY, 'Grave: to your gravestone after a fall']] },
          { list: [
            `Each is a short cast: stand still for ${secs(TP_CAST_TICKS)} while the sparkles gather. Walking off, taking a hit or falling breaks it.`,
            `Neither starts mid-fight (a monster after you, or a hit in the last ${sec(COMBAT_LOCK_TICKS)}): they are a way home, not an escape button.`,
            `The Town teleport then recharges for ${mins(TOWN_COOLDOWN_TICKS * TICK_MS)}. The Grave teleport has no recharge of its own, and lands you beside the stone, which hands your things straight back.`,
          ] },
        ],
        see: ['death', 'mrt'],
      },
    ],
  },
  {
    id: 'safety-ch', title: 'Death and saving', icon: '💾',
    articles: [
      {
        id: 'death', title: 'Dying and your gravestone',
        summary: 'You keep your gear; part of your pack waits at a gravestone.',
        body: [
          `If you fall you wake in Kampong Glam a moment later (${secs(RESPAWN_TICKS)}) with full life. **Worn gear is always safe.** A **gravestone** marks where you fell, holding ${pct(GRAVE_COIN_SHARE)} of the coins in your pack and its ${GRAVE_STACKS} most valuable stacks (never tools or clue scrolls).`,
          { list: [
            `Walk back within ${mins(GRAVE_TICKS * TICK_MS)} of play to take it all back.`,
            `Or pay ${pct(GRAVE_FEE_SHARE)} of what it holds (at least ${GRAVE_FEE_MIN} coins) from the Grave button to have it brought to you.`,
            'Dying again first moves the old stone\'s goods to the new one: nothing is lost.',
            'Only a stone left until it crumbles is lost.',
          ] },
          'Dying switches auto battle and auto quest off and calls off a world event. Falling in the Endless Gate just ends the run: nothing is lost there.',
        ],
        see: ['saving', 'endless-gate'],
      },
      {
        id: 'saving', title: 'Saving, accounts and moving devices',
        summary: 'Saved on this device; an account keeps a copy in the cloud.',
        body: [
          `The game saves to this browser on its own every ${secs(AUTOSAVE_TICKS)} or so, and straight after important moments. **Settings → Save game now** saves at once.`,
          '**Export save** gives you a code to keep somewhere safe; **Import save** on another device or browser brings your character over.',
          'With an **account** (Settings) a copy is kept in the cloud as well, uploaded at most once a minute while you play. On another device, log in and your character comes with you. If both copies have moved on since they last matched, you choose which to keep.',
          { tip: 'Clearing your browser\'s site data wipes the save on this device. Export a code, or use an account, to be safe.' },
        ],
        see: ['death'],
      },
    ],
  },
  {
    id: 'codex-ch', title: 'The Codex and your discoveries', icon: '🔎',
    articles: [
      {
        id: 'encyclopedia', title: 'Using the Codex',
        summary: 'Monsters, items, places, this guide, and what suits you now.',
        body: [
          'The Codex window has sections, switched at its top:',
          { list: [
            '**Monsters**: every monster and boss (see [[codex-mastery]]).',
            '**Items**: every item in the game. Its page says what it is, who drops it and how often, which nodes give it and in which regions, what makes it and what it makes, where it is sold and what it is worth, with a **Go** button to the nearest place to get one.',
            '**Places**: every region, with its level band, monsters and bosses, resource zones, quest givers, shops, MRT stops, your reputation there, a small map, a "Did you know?" about the real place, and Go.',
            '**Compendium**: this guide.',
            '**For you**: where to train each life skill at your level (with a rough XP an hour), monsters your weapon is strong against, and gear you could wear and get now that beats what you have on.',
            '**Search**: one box over monsters, items, places and this guide, your recent pages, and your [[discoveries]].',
          ] },
          'Names of monsters, items, skills and regions in the chat, in quest text and on Codex pages are **links**: tap one to open its page. An item in your bag or bank has an **Info** option too.',
        ],
        see: ['discoveries', 'codex-mastery'],
      },
      {
        id: 'discoveries', title: 'Discoveries and their rewards',
        summary: 'Fill in the silhouettes; finish a category for a reward.',
        body: [
          'Codex entries start as silhouettes and fill in as you find them:',
          { list: [
            'A creature or boss: once you defeat one.',
            'An item: once one has been in your pack or bank.',
            'A region: once you visit it. A resource zone: once you walk in.',
            'A lore page: once you pick it up.',
          ] },
          `The Search section shows how far along each category is. Finish one and claim its reward there: ${num(REWARD_COINS_EACH)} coins for each entry in it (at least ${num(REWARD_COINS_MIN)}, at most ${num(REWARD_COINS_MAX)}) and ${REWARD_LAMPS} forager's lamps, each worth a burst of XP in a gathering skill.`,
          'Items are split into shelves (ores, bars, gems, logs, food, gear and so on), each its own category, so every one has a goal in reach.',
        ],
        see: ['encyclopedia', 'collection-log', 'lore-pages'],
      },
    ],
  },
];

// ---------------- Lookups and search ----------------
/** Every article, each with its chapter: [{ ...article, chapter }]. */
export const ARTICLES = CHAPTERS.flatMap((ch) => ch.articles.map((a) => ({ ...a, chapter: ch.id })));
export const ARTICLE_BY_ID = Object.fromEntries(ARTICLES.map((a) => [a.id, a]));
export const CHAPTER_BY_ID = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

const LINK_RE = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

/** An article's body with every worked-out block resolved. */
export function articleBlocks(a) {
  return (a?.body || []).map((b) => (typeof b === 'function' ? b() : b)).filter((b) => b != null);
}

/** The article ids a piece of marked-up text links to. */
export function linksIn(text) {
  return [...String(text).matchAll(LINK_RE)].map((m) => m[1]);
}

/** A block's marked-up strings (paragraph, list items, tip, key descriptions). */
function blockStrings(b) {
  if (typeof b === 'string') return [b];
  if (b.list) return b.list;
  if (b.tip) return [b.tip];
  if (b.keys) return b.keys.flat();
  if (b.table) return [...(b.table.head || []), ...b.table.rows.flat()].map(String);
  return [];
}

/** Every article an article points to: its inline links first, then `see`. */
export function relatedOf(a) {
  const ids = articleBlocks(a).flatMap(blockStrings).flatMap(linksIn);
  return [...new Set([...ids, ...(a?.see || [])])].filter((id) => id !== a.id);
}

/** Marked-up text as plain words ("[[mrt|the MRT]]" -> "the MRT", no **). */
export function plainText(text) {
  return String(text).replace(LINK_RE, (_, id, label) => label || ARTICLE_BY_ID[id]?.title || id).replace(/\*\*|\*/g, '');
}

// The searchable text of each article, worked out once (the data never changes in play).
let _index = null;
function searchIndex() {
  if (!_index) {
    _index = ARTICLES.map((a) => ({
      a,
      title: a.title.toLowerCase(),
      raw: [a.summary, ...articleBlocks(a).flatMap(blockStrings)].map(plainText).join(' '),
    }));
    for (const e of _index) e.text = e.raw.toLowerCase();
  }
  return _index;
}

/** Articles matching a search: every word must appear in the title, summary or
 *  body. Title matches come first. Returns [{ article, inTitle, snippet }]. */
export function searchArticles(query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const e of searchIndex()) {
    const all = `${e.title} ${e.text}`;
    if (!words.every((w) => all.includes(w))) continue;
    const inTitle = words.every((w) => e.title.includes(w));
    // A few words either side of the first body match, for the result's second line.
    let snippet = '';
    const at = e.text.indexOf(words[0]);
    if (at >= 0) {
      const from = Math.max(0, at - 40), to = Math.min(e.text.length, at + words[0].length + 60);
      snippet = (from ? '…' : '') + e.raw.slice(from, to).trim() + (to < e.text.length ? '…' : '');
    }
    out.push({ article: e.a, inTitle, snippet });
  }
  return out.sort((x, y) => Number(y.inTitle) - Number(x.inTitle));
}
