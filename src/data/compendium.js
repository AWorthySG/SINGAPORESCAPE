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
import { CLASSES, SECONDARY_WEAPON, WEAPON_TYPE_NAMES, ARMOUR_FAMILY, ARMOUR_FAMILIES, CLEAVE_SHARE } from './classes.js';
import { ITEMS, getItem, TWO_HANDED_TYPES, QUIVER_BOW_TYPES } from './items.js';
import { ALL_MONSTER_IDS, ALL_BOSS_IDS, getNpc, RARE_DROP_TABLE, stretchLevel } from './npcs.js';
import { RACES, WEAPON_VS_RACE, RACE_BONUS } from './races.js';
import { ELEMENTS, SPELLS } from './magic.js';
import { PRAYERS } from './prayers.js';
import { SKILLS, SKILL_BY_ID } from './skills.js';
import { SKILL_HOURS, GOLDEN_HOUR_XP } from './skillhours.js';
import { SKILL_UNLOCKS, UNLOCK_LEVELS, GATHER_CONSUMABLES } from './unlocks.js';
import { STATIONS, MRT_FARE } from './transport.js';
import { CLUE_TIERS } from './clues.js';
import { QUESTS } from './quests.js';
import { REGION_LINES } from './regionQuests.js';
import { SLAYER_REWARDS, SLAYER_DMG, SLAYER_LOOT, SLAYER_HELM_DMG, SLAYER_FULL_LEVEL } from './slayer.js';
import { EVENT_KINDS, EVENT_GAP, WEEKLY_TASKS } from './worldevents.js';
import { BOSS_MECHANICS, MECH_KINDS } from './bossMechanics.js';
import { SIGNATURE_DROP_CHANCE } from './bossWeapons.js';
import { ALTAR_XP_MULT } from './bones.js';
import { ADREN_PER_HIT, ADREN_PER_HURT, THRESHOLD_COST, ULTIMATE_COST } from './abilities.js';
import { MASTERY_RANKS, MAX_ENCHANTS, ENCHANT_LABELS, enchantCost } from '../game/mastery.js';
import { QUALITY, QUALITY_ORDER, QUALITY_RULES, RARITY, NORMAL_GEAR_SKIP } from '../game/loot.js';
import { MAX_REFINE, refineGain } from '../game/refine.js';
import { FEED_CAP_RANK } from '../game/materials.js';
import { QUALITY_MULT, SAME_KIND_MULT, WARD_CHANCE } from '../game/salvage.js';
import { SHRINE_TRACKS, shrineCost } from '../game/shrine.js';
import { GOODS_RATE } from '../game/offerings.js';
import {
  FOCUS_MAX_MS, FOCUS_ACTIVE_REFILL, TIRED_MULT, RESTED_MULT, RESTED_RATE, RESTED_CAP_MS,
  GRAVE_TICKS, GRAVE_COIN_SHARE, GRAVE_STACKS, GRAVE_FEE_SHARE, GRAVE_FEE_MIN,
} from '../game/playbalance.js';
import { GATE_MODS, CHAMPION_EVERY, BOSS_EVERY } from '../game/waves.js';
import { HOME_PRICE, HOME_UPGRADES } from '../game/home.js';
import { BOSS_PET_RATE, BOSS_PET_FLOOR, SKILL_PET_RATE } from '../game/pets.js';
import { MASTERY_TIERS, CONTRACT_COUNT } from '../game/culling.js';
import { CHAMPION_CHANCE, CHAMPION_HP_MULT } from '../game/npc.js';
import {
  CRIT_MULT, MEGA_CRIT_MULT, MEGA_CRIT_CHANCE, WEAKNESS_BONUS, ARMOUR_TIERS, ARMOUR_CAP, OFFHAND_SHARE,
} from '../game/combat.js';
import {
  SHIELD_TICKS, SHIELD_WRONG, SHIELD_BURST, EXPOSED_MULT, EXPOSED_TICKS, CIRCLE_TICKS, ADDS_TICKS, HEAL_EVERY,
  HEAL_FRAC, HEAL_CAP, CAST_TICKS, CAST_HIT, MECH_FIRST_TICKS, MECH_EVERY_TICKS,
} from '../game/bossmech.js';
import { TICK_MS, AUTOSAVE_TICKS, DAY_CYCLE_MS, RESPAWN_TICKS } from '../config.js';

// ---------------- Little helpers for the numbers ----------------
const pct = (x, dp = 0) => `${(Math.round(x * 100 * 10 ** dp) / 10 ** dp).toLocaleString('en-GB')}%`;
const num = (n) => Number(n).toLocaleString('en-GB');
const secs = (ticks) => {
  const s = ticks * TICK_MS / 1000;
  return s >= 60 && s % 60 === 0 ? `${s / 60} minute${s === 60 ? '' : 's'}` : `about ${Math.round(s * 10) / 10} seconds`;
};
const mins = (ms) => {
  const m = ms / 60000;
  return m >= 60 ? `${Math.round(m / 6) / 10} hours` : `${Math.round(m)} minutes`;
};
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

/** Mastery ranks: name, points, the share of base stats it adds. */
export function masteryRankRows() {
  return MASTERY_RANKS.map((r) => [r.name, num(r.points), r.gain ? `+${pct(r.gain)}` : '-']);
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

/** Prayers: name, Prayer level, what it does, drain. */
export function prayerRows() {
  return PRAYERS.map((p) => {
    const fx = [];
    if (p.str) fx.push(`+${pct(p.str)} melee damage`);
    if (p.def) fx.push(`+${pct(p.def)} Defence`);
    if (p.ranged) fx.push(`+${pct(p.ranged)} Ranged`);
    if (p.magic) fx.push(`+${pct(p.magic)} Magic`);
    if (p.crit) fx.push(`+${pct(p.crit)} crit chance`);
    if (p.protect) fx.push(`stops ${pct(p.protect)} of melee damage`);
    return [p.name, num(p.level), fx.join(', '), num(p.drain)];
  });
}

/** Spells: element, Magic level, what its element does. */
export function spellRows() {
  return SPELLS.map((s) => [`${ELEMENTS[s.element].icon} ${s.name}`, num(s.level), ELEMENTS[s.element].effect,
    ELEMENTS[s.element].strong.map((r) => RACES[r]?.name || r).join(', ')]);
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

/** Boss mechanics: kind, what to do, how many bosses use it. */
export function mechanicRows() {
  const HOW = {
    shield: 'Break it with the combat style its colour shows',
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
          `There are **${CLASSES.length} job classes** in four fighting styles. Each masters one main weapon type and one secondary type of the same style; no other weapons can be wielded. Armour (helm, body, legs, gloves and boots) belongs to one family per class; shields, capes, jewellery and tools are open to everyone.`,
          () => ({ table: { head: ['Class', 'Style', 'Main weapon', 'Secondary', 'Armour'], rows: classRows() } }),
          'Weapon and armour drops mostly turn into your own class\'s kind, so loot stays useful (see [[drops]]).',
        ],
        see: ['weapon-grips', 'armour-families', 'merchant-dancer'],
      },
      {
        id: 'weapon-grips', title: 'Two hands, two weapons and quivers',
        summary: 'Two-handed grips, dual wielding and the Archer\'s quiver.',
        body: [
          () => `**Two-handed** weapons fill both hands, so no shield, buckler or tome goes with them: ${[...TWO_HANDED_TYPES].map((t) => WEAPON_TYPE_NAMES[t]).join(', ')}. To make up for it each has a **two-handed grip**: the Defence and life of a same-tier kiteshield, plus (for most) the extras of a buckler or quiver.`,
          () => `**Quivers**: ${[...QUIVER_BOW_TYPES].map((t) => WEAPON_TYPE_NAMES[t]).join(' and ')} are drawn from a quiver at the hip, so a quiver (and only a quiver) can sit in the off-hand with them. The Fletcher sells them.`,
          `**Dual wielding**: daggers, scimitars, pistols and kerambits pair with a second one of the same kind in the off-hand. Each hand strikes with its own weapon; the off-hand's blow lands at ${pct(OFFHAND_SHARE)} of what that weapon would do.`,
          'A Knight\'s longsword and the toya staff are one-handed, so they keep a shield.',
          '**Reach**: most melee weapons strike from 2 tiles, longswords, halberds and two-handed swords from 3, spears from 4. Every melee weapon **cleaves** a share of each hit into foes next to the target, from a quarter for the quick blades to most of it for two-handed swords.',
        ],
        see: ['classes', 'equip-best'],
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
    ],
  },
  {
    id: 'combat-ch', title: 'Combat', icon: '🛡️',
    articles: [
      {
        id: 'combat-basics', title: 'How a fight works',
        summary: 'Hits always land; damage is what changes.',
        body: [
          'Your hits always land: what changes is how hard they hit. A weapon\'s speed is the number of 0.3-second beats between attacks, so lower is faster. Melee weapons swing twice as fast as their number says, quick weapons (scimitars, claws, kerambits, war fans) faster still, and pistols, shurikens and shortbows are the quickest ranged weapons.',
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
          `**Spells** each have an element. An element strong against a race also adds +${pct(RACE_BONUS.dmg - 1)}, and each element has its own effect:`,
          () => ({ table: { head: ['Spell', 'Magic', 'Effect', 'Strong against'], rows: spellRows() } }),
          'Every spell also blasts the area round its target for the same damage.',
        ],
        see: ['monster-armour', 'codex-mastery'],
      },
      {
        id: 'monster-armour', title: 'Monster armour and armour pierce',
        summary: 'A share of each hit a monster shrugs off.',
        body: [
          `Monsters wear armour that stops a share of every hit, by the kind of creature. Bosses and champions add ${pct(0.1)} each (and a little more or less by how far above or below you they are), up to ${pct(ARMOUR_CAP)} in all. Hitting a weakness gets past half of it.`,
          () => ({ table: { head: ['Armour', 'Stops', 'Who wears it'], rows: armourRows() } }),
          '**Armour pierce** on your gear cancels armour first; whatever pierce is left over adds damage instead. Plate armour carries the most.',
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
        id: 'prayers', title: 'Prayers',
        summary: 'Turn them on in the Combat tab; they drain prayer points.',
        body: [
          'Prayers boost you while they are on, and drain prayer points (some faster than others). Your prayer points top out at your Prayer level. Only one prayer of each kind (attack, strength, defence, ranged, magic) works at once.',
          `Train Prayer by burying bones, or offer them at an A-Worthy Monument for **x${ALTAR_XP_MULT} XP**.`,
          () => ({ table: { head: ['Prayer', 'Level', 'Effect', 'Drain rate'], rows: prayerRows() } }),
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
            `Each boss has a **signature weapon** for one class, which drops ${oneIn(SIGNATURE_DROP_CHANCE)} kills.`,
            'It also leaves 20 to 50 upgrade stones and 1 to 3 upgrade wards.',
            'A boss kill is worth 25 gear mastery points to every piece you wear.',
          ] },
          'If a boss beats you, auto battle leaves it alone until you are 10 fight levels stronger.',
        ],
        see: ['boss-mechanics', 'world-bosses', 'pets'],
      },
      {
        id: 'boss-mechanics', title: 'Boss mechanics',
        summary: 'Style shields, safe circles, healers and casts to interrupt.',
        body: [
          `About ${secs(MECH_FIRST_TICKS)} into a fight, and then every ${secs(MECH_EVERY_TICKS)} or so, a boss uses its mechanic:`,
          () => ({ table: { head: ['Mechanic', 'What to do', 'Bosses'], rows: mechanicRows() } }),
          { list: [
            `**Style shield**: you have ${secs(SHIELD_TICKS)} to break it. Hits of the wrong style do only ${pct(SHIELD_WRONG)} to it. Left unbroken it bursts for ${pct(SHIELD_BURST)} of your life; broken, the boss is exposed and takes x${EXPOSED_MULT} damage for ${secs(EXPOSED_TICKS)}.`,
            `**Safe circle**: red covers the ground round you; step into the small green circle within ${secs(CIRCLE_TICKS)}.`,
            `**Healing adds**: each mends ${pct(HEAL_FRAC, 1)} of the boss's life every ${secs(HEAL_EVERY)}, up to ${pct(HEAL_CAP)} in all, and fades after ${secs(ADDS_TICKS)}.`,
            `**Interruptible cast**: a ${secs(CAST_TICKS)} cast bar. Any skill or special attack stops it; if it lands it takes ${pct(CAST_HIT)} of your life (never all of it).`,
          ] },
          'No mechanic stuns you or throws you about. Auto battle turns on healers, interrupts casts and (if you leave it on) dodges the red markers for you.',
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
        summary: 'Using your gear makes it stronger: Novice to Ascended.',
        body: [
          'Mastery belongs to a **gear type**, not one item: every sword shares Sword mastery, every plate body Plate body mastery. So moving up a tier keeps everything you have earned.',
          'Every kill gives each type you wear mastery points: 1 for a monster, 5 for a champion, 25 for a boss. Each rank adds a share of the item\'s base stats:',
          () => ({ table: { head: ['Rank', 'Points', 'Stat bonus'], rows: masteryRankRows() } }),
          `You can also feed life-skill materials or [[salvage|sacrifice spare gear]] to a type; those stop at ${MASTERY_RANKS[FEED_CAP_RANK].name}, so the last ranks come from fighting.`,
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
            `**Sacrifice** it to the mastery of its own gear type for ${SAME_KIND_MULT}x its worth in points (up to ${MASTERY_RANKS[FEED_CAP_RANK].name}).`,
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
          `A game day lasts ${mins(DAY_CYCLE_MS)}. Each life skill has a **golden hour**, a six-hour window on the in-game clock (about two and a half real minutes) when its XP is worth **x${GOLDEN_HOUR_XP}**:`,
          () => ({ table: { head: ['Skill', 'When', 'Game time'], rows: goldenHourRows() } }),
        ],
        see: ['skills-overview', 'levels-xp'],
      },
      {
        id: 'skill-unlocks', title: 'Skill unlocks',
        summary: `Every life skill unlocks something at levels ${UNLOCK_LEVELS.join(', ')}.`,
        body: [
          `At levels **${UNLOCK_LEVELS.join(', ')}** each life skill unlocks something you feel while training it: double yields, quick actions, kept ingredients, trees and rocks that hold, new recipes, and a teleport to its best training spot (skill teleports share a 5-minute cooldown). Each skill's article lists its ladder.`,
          'Separately, every 20 levels of a fighting or life skill unlocks a passive perk that helps in a fight.',
        ],
        see: ['skills-overview', 'skill-chains'],
      },
      {
        id: 'skill-chains', title: 'Skill chains',
        summary: 'Life skills that feed one another.',
        body: [
          'The life skills lean on each other: logs feed Firemaking and Fletching, ore becomes bars for Smithing, raw fish and meat go to Cooking, crops to Herblore.',
          () => `Some makes boost another skill. ${Object.entries(GATHER_CONSUMABLES).map(([s, c]) => `A ${itemName(c.id).toLowerCase()} in your pack adds ${pct(c.double)} double ${SKILL_BY_ID[s].name} yield`).join('; ')}. Herblore brews can raise Fishing, Hunter and Mining yields, and boss-fight meals cook from Hunter meat, farmed herbs and fish.`,
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
          `Buy a home plot just east of Kranji Village for **${num(HOME_PRICE)} coins**. It has a storage chest (separate from the bank), a cooking range, a fire that never goes out, farm patches, a trophy wall, and a teleport home with a cooldown. Upgrades cost coins and materials:`,
          () => ({ table: { head: ['Upgrade', 'Tiers'], rows: homeRows() } }),
        ],
        see: ['mrt', 'skill-unlocks'],
      },
      {
        id: 'endless-gate', title: 'The Endless Gate',
        summary: 'Endless, ever-stronger waves; leave when you like.',
        body: [
          'Step through the **Endless Gate** in Kampong Glam into a sealed arena where monsters come in waves, each stronger than the last. Fight until you fall or choose to leave; either way you come out where you went in, **keeping everything**.',
          { list: [
            `Every ${CHAMPION_EVERY}th wave adds a champion, and every ${BOSS_EVERY}th is a boss wave with a guaranteed chest.`,
            'Clearing a wave pays coins, and from later waves upgrade stones, refine scrolls and wards.',
          ] },
          'Before a run you can pick **modifiers**. They stack, each making the run harder and paying for it:',
          () => ({ table: { head: ['Modifier', 'Harder', 'Reward'], rows: gateModRows() } }),
        ],
        see: ['upgrade-materials', 'death'],
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
