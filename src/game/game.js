import { EventBus } from '../core/events.js';
import { buildWorld, TERRAIN } from '../data/world.js';
import { compareGear, deltaText, gearRating, effectiveRating, weaponStyle } from './gear.js';
import { RARITY, dropRarity, lootDelay, rollUpgrade, qualityFor, NORMAL_GEAR_SKIP } from './loot.js';
import { dayKey, prevDayKey, makeBounties, streakMult } from './bounty.js';
import { ATTRS, ATTR_NAMES, statPointsAt, attrForMode, DMG_PER_POINT, LIFE_PER_STR, CRIT_PER_INT, SPEED_PER_DEX, RESET_COST_PER_POINT } from './attributes.js';
import { MAX_REFINE, refineCost, rollRefine, refineTag } from './refine.js';
import { MAX_UPGRADE, upgradeCost, upgradeChance, upgradedName, upgradedBonuses, RISKY_FROM, STONE as UP_STONE, WARD as UP_WARD } from './upgrade.js';
import { getItem, MELEE_REACH, accessoriesFor } from '../data/items.js';
import { chebyshev, randInt, weightedPick, capitalize } from '../core/utils.js';
import {
  TILE, TICK_MS, COMBAT_BEAT_MS, RESPAWN_TICKS, AUTOSAVE_TICKS, DAY_CYCLE_MS,
  XP_RATE, LEARNING_ENABLED,
} from '../config.js';

import { World } from './world.js';
import { Skills } from './skillset.js';
import { Inventory } from './inventory.js';
import { Equipment, canDualWield, canDualPair, EQUIP_SLOTS } from './equipment.js';
import { Bank } from './bank.js';
import { Player } from './player.js';
import { NPC } from './npc.js';
import { Camera } from '../engine/camera.js';
import { findPath } from '../engine/pathfinding.js';
import {
  playerAttackVsNpc, npcAttackVsPlayer, rollAttack, rollGuaranteed, rollHit, combatXp, magicXp, killXp, DAMAGE_XP_SHARE, KILL_XP_SHARE,
  playerRangedVsNpc, combatXpRanged, playerMagicVsNpc, RANGED_STYLES,
  weaknessOf, WEAKNESS_BONUS, critChance, CRIT_MULT, MEGA_CRIT_MULT, MEGA_CRIT_CHANCE,
  playerDanceVsNpc, combatXpDance, danceEvade, RHYTHM_MAX,
} from './combat.js';
import { ABILITY_BY_ID, abilitiesFor, ADREN_PER_HIT, ADREN_PER_HURT, CLASS_ADRENALINE, EXECUTE_BELOW } from '../data/abilities.js';
import { classPassiveMods, CLASS_SKILL } from '../data/classPassives.js';
import { RACES, raceOf, matchup, RACE_BONUS, RACE_PENALTY } from '../data/races.js';
import { DOT_KINDS } from '../data/bossAbilities.js';
import { CLASS_BY_ID, WEAPON_TYPE_NAMES, starterWeapon, equivalentWeapon, CLEAVE_SHARE, ARMOUR_FAMILY, ARMOUR_FAMILIES, canWear, equivalentArmour, classGearFor } from '../data/classes.js';
import { STYLE_TRACKS, sumPerks, perkAtLevel, rankName, PERK_SKILLS, PERK_CAPS } from '../data/perks.js';
import { getSpell, SPELLS, ELEMENTS, AOE_RADIUS, elementMatchup } from '../data/magic.js';
import { xpForLevel } from '../data/xp.js';
import { PRAYERS, PRAYER_BY_ID, PRAYER_GROUPS } from '../data/prayers.js';
import { isBone, boneXp, BONE_IDS, countBones, championBoneQty, RARE_BOSS_BONES, RARE_BONE_CHANCE, RARE_BONE_QTY, ALTAR_XP_MULT, ALTAR_RANGE } from '../data/bones.js';
import {
  resolveWoodcut, resolveMine, resolveFish, resolveCook,
  resolveSmelt, resolveSmith, resolveFiremake, resolveCraft, resolveDish,
  resolveHunt, resolveRecipe,
} from './skilling.js';
import { CROP_BY_SEED, cropFor, POTIONS } from '../data/trades.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { getShop } from '../data/shops.js';
import { RARE_DROP_TABLE, getNpc, ALL_BOSS_IDS } from '../data/npcs.js';
import { nextJob, jobKey } from './autoprocess.js';
import { ACHIEVEMENTS, rewardFor } from '../data/achievements.js';
import { eligibleTasks, SLAYER_REWARDS } from '../data/slayer.js';
import { STATIONS, STATION_BY_ID, MRT_FARE } from '../data/transport.js';
import { SKILLS } from '../data/skills.js';
import { Learning } from './learning.js';
import * as Mercs from './mercenary.js';
import { classPerks } from './classperks.js';
import { TOPIC_BY_ID } from '../data/questions.js';
import { LIFE_STAGES, LIFE_GRAD, LIFE_STAGES_ADV, LIFE_GRAD_ADV, LIFE_STAGES_WILD, LIFE_GRAD_WILD } from '../data/lifeskills.js';
import { QUESTS, CHAMPION_QP, REDEMPTION_GOAL, CORRUPTION_GOAL } from '../data/quests.js';
import { CLUE_TIERS, CLUE_SPOTS, clueTierForLevel } from '../data/clues.js';

// Auto quest: the dialogue actions that start and hand in each quest it can
// do ([start, hand-in]; Pest Control completes itself on the last rat). The
// karma quests are missing on purpose: that choice is the player's.
const AUTO_QUEST_ACTIONS = {
  life_skills: ['lifeStart', 'lifeTurnIn'], life_skills_adv: ['lifeAdvStart', 'lifeAdvTurnIn'], life_skills_wild: ['lifeWildStart', 'lifeWildTurnIn'],
  bone_collector: ['questStart', 'questTurnIn'], pest_control: ['pestStart', null], pillars: ['pillarsStart', 'pillarsTurnIn'],
  smith_apprentice: ['smithStart', 'smithTurnIn'], island_defender: ['defenderStart', 'defenderTurnIn'], big_game_hunter: ['bigGameStart', 'bigGameTurnIn'],
  mystic_trial: ['mysticStart', 'mysticTurnIn'], island_provisions: ['provisionsStart', 'provisionsTurnIn'], champion: ['championStart', 'championTurnIn'],
};
// Stations whose menu auto quest runs with "make everything" (autoprocess.js kinds).
const AUTO_QUEST_STATION = { furnace: 'smelt', range: 'cook', fire: 'cook', anvil: 'smith', craft: 'craft', fletch: 'fletching', herblore: 'herblore' };

const STARTER_TOOLS = ['bronze_axe', 'bronze_pickaxe', 'small_net', 'fishing_rod', 'tinderbox', 'hammer', 'chisel', 'bronze_dagger'];
const COMBAT_SKILLS = new Set(['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic']);

// Where the in-game day/night clock starts: the equivalent point in
// DAY_CYCLE_MS for the player's real local time of day, so a fresh session
// opens at a sensible hour (bright at your midday, dark at your midnight)
// instead of always at midnight.
// Every session starts on a bright morning (~7am), then runs the normal
// day/night cycle from there.
const MORNING_PHASE = 0.3;

// Combat XP: +25% per Wilderness level (1-10, deeper = higher), and a kill
// streak bonus of +5% per chained kill (up to +100%, kills within ~30s).
const WILD_EDGE_X = 95;
const WILD_XP_PER_LEVEL = 0.5;
const STREAK_XP_PER_KILL = 0.1;
const STREAK_MAX_BONUS = 2;
const STREAK_WINDOW_TICKS = 50;
// Bonus XP per boss level on a boss kill.
// Bosses are 100x tankier (BOSS_TOUGHNESS), so their rewards scale with them:
// the kill bonus is 100x, stackable loot (coins, runes, arrows...) comes in 100x
// the amount, and the gear, rare-table and upgrade-material rolls are richer.
const BOSS_XP_PER_LEVEL = 4000;
const BOSS_STACK_MULT = 100;
// Every coin drop, from any monster, boss or champion (and the rare table), is
// this many times what its drop table says.
export const COIN_LOOT_MULT = 2;
// Whip ricochet: bounces after each landed lash (one more at full Rhythm), and their share of the hit.
// World boss: every 2 minutes (if none is about) a random boss rises near you,
// far tougher than usual, and hunts you down. It leaves after 5 minutes unfought.
const WORLD_BOSS_EVERY = 200;      // ticks (0.6s each): 2 minutes
const WORLD_BOSS_STAY = 500;       // ticks it lingers without a fight: 5 minutes
const WORLD_BOSS_MULT = { hp: 5, hit: 2, stats: 1.5 };
const WORLD_BOSS_LOOT_ROLLS = 3;   // its loot, three times over
// Agility: every 10 levels give +1% movement speed, for every class, with no cap.
// Its bonus to attack and casting speed starts at the same pace but tapers off
// towards AGILITY_ATK_MAX (half of it at AGILITY_ATK_HALF levels): uncapped, it
// made level 9999 attack 11 times as often, which on top of damage growing with
// level made late-game damage soar.
const AGILITY_SPEED_PER = 10;
export const AGILITY_ATK_MAX = 100, AGILITY_ATK_HALF = 1000;
// Merchant: every coin throw costs 1 coin + 1 per 10 Ranged levels, and skills
// cost coins instead of adrenaline (the adrenaline cost x this, x2 per 100 Ranged).
const COIN_SKILL_MULT = 20;
const PLAYER_STEP_MUL = 0.7;   // the player's base step time (see player.js)
const ROAD_PACE = 0.75;        // step time on a road or bridge: a third quicker than open ground
const MRT_HOP_MIN = 60;        // trips longer than this (tiles) ride the MRT part of the way when it helps
const DANCE_RICOCHET = 2;
// Above this many attacks a beat (1/0.05 = 20), attacks are grouped into volleys.
const VOLLEY_MIN_BEATS = 0.05;
const RICOCHET_SHARE = 0.6;
const LONGBOW_DMG = 1.6;
// Sniper rifles fire only every 1.5s, but each round hits this many times as hard.
const RIFLE_DMG = 5.5;
// A sniper round carries on in a straight line through every
// monster up to this many tiles past the target (each takes the full hit).
// Bosses scale up to the player's combat level (see _scaleBoss), up to this
// many times their own level.
const BOSS_SCALE_MAX = 100;
// Agility XP for slipping a monster's blow: this many times its max hit (about
// what landing an average hit of that size would give a fighting skill).
export const DODGE_AGILITY_XP = 2;
// Every area attack, splash, ricochet and target search looks only at the
// NPCs within this many tiles of the player (see nearbyNpcs): the world holds
// thousands, and scanning them all on every hit was the main cause of lag.
const NEAR_RADIUS = 60;
const SPLAT_MERGE_MS = 120;   // hits on one foe this close together share one damage number
const RIFLE_PIERCE_TILES = 10;
// ...and the round's wake also catches anything within 1 tile to either side of
// its path (and beside the target), not just monsters squarely on the line.
const RIFLE_PIERCE_WIDTH = 1;
// Champions have 10x the life they used to (30x a monster, down from 150x), so
// their loot is trimmed to match: stackables x10, 4 table rolls, the rare table
// once and a few upgrade stones.
const CHAMPION_STACK_MULT = 10;

// Share of fired arrows recovered after the shot.
const ARROW_RECOVERY = 0.8;
const CLASS_LOOT_SHARE = 0.75;   // chance another class's weapon drop becomes your class's equivalent
const CLASS_FOR_TYPE = (t) => Object.values(CLASS_BY_ID).find((c) => c.weapon === t)?.name || 'different class';
// What a boss's ground attack says when it marks the ground.
const HAZARD_TEXT = {
  blast: (n) => `${n} targets the ground under you. Move out of the red!`,
  nova: (n) => `${n} gathers power around itself. Get away from it!`,
  quake: (n) => `${n} rears up for a huge quake. Get well clear!`,
  line: (n) => `${n} lines up a charge straight through you. Step aside!`,
  cross: (n) => `${n} marks a cross on you. Step diagonally out of it!`,
  ring: (n) => `${n} lashes out all around itself. Get in close to dodge!`,
  meteors: (n) => `${n} calls down meteors. Find a gap!`,
  rain: (n) => `${n} rains blows around you. Pick a safe tile!`,
  chase: (n) => `${n} hunts you with blast after blast. Keep moving!`,
  twin: (n) => `${n} strikes on both sides of you. Stand still!`,
};
export const BURY_BATCH = 100; // bones buried per click
export const BURY_RESTORE_CAP = 3; // at most this many bones per bury restore prayer
// Agility obstacles give AGILITY_XP_MULT x their listed XP, growing by 1/AGILITY_XP_DIV
// per Agility level (level 100 -> 11x the multiplier), so level 999 is a
// reachable goal (~12 hours of courses) rather than a lifetime.
export const AGILITY_XP_MULT = 5;
export const AGILITY_XP_DIV = 10;
// A Mark of grace trades for this many zip-line crossings' worth of Agility XP.
export const MARK_XP_CROSSINGS = 10;
export const BONE_PRAYER_XP = getItem('bones').prayerXp;   // plain bones; every kind's XP is its item's prayerXp (bones.js)
export const SPLIT_SHOT_LEVEL = 300;  // Ranged level at which every bow shot splits
const SPLIT_SHOT_TARGETS = 3;       // ...into this many arrows, one per target

// Alchemy: a utility spell cast on an inventory item.
const ALCHEMY = { level: 21, xp: 65, runes: { nature_rune: 1, fire_rune: 5 } };

// Actions that can fire the instant you press (no random roll to exploit by spamming).
const INSTANT_ACTIONS = new Set(['pickup', 'cookmenu', 'smeltmenu', 'smithmenu', 'craftmenu', 'fletchmenu', 'herbmenu', 'farm', 'pray', 'rest', 'transport', 'openbank', 'openshop', 'talk']);
const GATHER_ACTIONS = new Set(['woodcut', 'mine', 'fish', 'stall']);
// Ticks you get to answer a Knowledge Strike before the boss's special lands (~7s).
const KS_TICKS = 12;

export class Game {
  constructor() {
    this.bus = new EventBus();
    const data = buildWorld();
    this.world = new World(this.bus);
    this.world.build(data);

    this.skills = new Skills(this.bus);
    this.inventory = new Inventory(this.bus);
    this.equipment = new Equipment(this.bus);
    this.bank = new Bank(this.bus);

    this.player = new Player(data.spawnPoint.x, data.spawnPoint.y);
    this.player.walkable = (x, y) => this.world.inBounds(x, y) && !this.world.isBlocked(x, y);
    this.player.hp = this.maxHp();

    this.npcs = data.npcSpawns.map((s) => new NPC(s.npcId, s.x, s.y, s.wander, s.opts));

    this.camera = new Camera();
    this.ui = null;     // set by main
    this.input = null;  // set by main
    // Set true by newGame() for a brand-new character; the UI prompts a
    // melee/ranged/magic choice (see chooseStartingStyle) before combat gear
    // is granted. Never set for a loaded save.
    this.pendingStyleChoice = false;
    this.jobClass = null;            // permanent job class (one per weapon type), see classes.js
    this.pendingClassChoice = false; // an older save that hasn't picked a class yet
    this.potions = {};               // active potion id -> ms left (see trades.js POTIONS)

    this.running = true;    // everyone always runs (the run toggle was removed)
    this.runEnergy = 100;
    this.effects = [];
    this.hazards = [];          // pending boss area attacks (red ground markers)
    this.hitStop = 0;           // ms of near-frozen animation after a big hit
    this.killStreak = 0;        // chained kills for the XP bonus
    this._lastKillTick = -1e9;
    // Auto battle settings: eat below this fraction of life (0 = never),
    // fight only one monster type (null = anything), use attack skills.
    this.autoCfg = { eatAt: 0.4, target: null, abilities: true, bosses: true, champions: true, priority: true };
    this.particles = [];
    // Screen-shake state (big hits, boss slams). Decays over shakeDur ms.
    this.shakeT = 0;
    this.shakeDur = 1;
    this.shakeMag = 0;
    // Day/night clock: accumulated play time, wrapped into a repeating cycle
    // (see update()). Seeded from the player's real local time of day so a
    // fresh session opens at a sensible hour instead of always at midnight.
    this.playMs = MORNING_PHASE * DAY_CYCLE_MS;
    this.hover = null;
    this.currentZoneName = null;
    this.wildLevel = 0;
    this.playerStun = 0;
    this.hasTemps = false;
    this.prayerPoints = 0;
    this.activePrayers = new Set();
    this.quests = {
      bone_collector: { state: 'notStarted' },
      pest_control: { state: 'notStarted', kills: 0 },
      pillars: { state: 'notStarted', monument: false, obelisk: false },
      smith_apprentice: { state: 'notStarted' },
      island_defender: { state: 'notStarted', startBoss: 0 },
      big_game_hunter: { state: 'notStarted', startKills: 0 },
      mystic_trial: { state: 'notStarted' },
      island_provisions: { state: 'notStarted' },
      life_skills: { state: 'notStarted', stage: 0, base: 0 },
      life_skills_adv: { state: 'notStarted', stage: 0, base: 0 },
      life_skills_wild: { state: 'notStarted', stage: 0, base: 0 },
      champion: { state: 'notStarted', startBoss: 0 },
      redemption: { state: 'notStarted', baseGood: 0 },
      corruption: { state: 'notStarted', baseEvil: 0 },
    };

    // Achievement / collection-log progress.
    this.totalKills = 0;
    this.bossKills = 0;
    this.zonesVisited = new Set();
    this.stationsFound = new Set(['kampong_glam']);   // MRT stations you can ride to from the world map
    this.learning = new Learning();   // Wisdom, topic mastery, Codex cards and titles
    // Knowledge Strikes: bosses' specials can be interrupted by answering a question.
    // On by default in the browser; headless runs (tests) leave bosses as they were.
    this.knowledgeStrikes = LEARNING_ENABLED && typeof document !== 'undefined';
    this._ks = null;
    this.achievements = new Set();
    this.kills = {}; // per-monster kill counts (bestiary)

    // Slayer task system.
    this.slayer = { task: null, points: 0, completed: 0 };
    this.bounties = { day: null, list: [], streak: 0, lastFull: null };   // daily bounty board

    // Agility course: distinct obstacles touched this lap.
    this._agilityLap = new Set();

    // Active treasure trail (clue scroll), or null.
    this.clue = null;

    // Good / evil alignment. Heroic deeds raise good; theft & cruelty raise evil.
    this.karma = { good: 0, evil: 0 };
    this.attrs = { str: 0, int: 0, dex: 0 };   // spent stat points (see attributes.js)

    // Special-attack energy (spec bar).
    this.specEnergy = 100;
    this.specArmed = false;

    // Active-combat layer: adrenaline fuels abilities; brace mitigates heavy hits.
    this.adrenaline = 0;
    this.armedAbility = null;     // ability armed for the next attack
    this.moveInput = { x: 0, y: 0 }; // joystick / WASD vector, -1..1 on each axis
    this._driving = false;
    this.autoBattle = false;      // auto battle: hunt, fight, eat and use skills
    this.autoGather = false;      // auto gather: when a node runs dry, move on to the next one
    this.autoQuest = false;       // auto quest: work through quests by yourself (see _autoQuestTick)
    this.autoQuestId = null;      // the quest auto quest is on (the one you last pressed Go on)
    this._autoSkip = new Map();   // npc entityId -> tick until which it is skipped (unreachable)
    this._autoLast = null;
    this.abilityCd = {};          // ability id -> ticks until usable again
    this.braceTicks = 0;          // ticks of halved incoming damage left
    this.danceRhythm = 0;         // Dancer Rhythm stacks (more whip damage per landed lash)
    this.playerDot = null;        // boss damage-over-time on the player: { kind, dmg, ticks, from }
    this.playerRoot = 0;          // ticks the player can't move (webs, roots, coils)
    this._buffedBosses = new Set(); // bosses with a shield or reflect running
    this._danceHitTick = 0;

    // Celebratory sparkle on level up; new milestones may unlock on level/quest changes.
    this.bus.on('levelup', (p) => {
      // A big hit can jump many levels at once: the celebration and the
      // achievement check run once a tick, however many levels came in it.
      if (this._lvlFxTick === this.tickCount) { this._lvlLevelUpLight(p); return; }
      this._lvlFxTick = this.tickCount;
      const c = this.player.renderCenter();
      this.spawnSparkle(this.player, '#ffe24a', 18);
      this.spawnPoof(c.x, c.y - 6, '#fff3a0');
      // Confetti and a burst ring; round-number levels get a bigger celebration.
      const big = p?.level && (p.level % 10 === 0 || p.level === 99);
      this.spawnConfetti(c.x, c.y - 18, big ? 46 : 22);
      this.effects.push({ type: 'ring', x: c.x, y: c.y - 8, color: '#F5B82E', life: 520, maxLife: 520, r0: 6, r1: big ? 52 : 34 });
      if (big) this.addShake(2, 160);
      const perk = p?.skill && perkAtLevel(p.skill, p.level);
      if (perk) {
        this.msg(`New passive perk: ${perk.name}${perk.rank > 1 ? ` (Rank ${rankName(perk.rank)})` : ''}. ${perk.desc}.`, 'level');
        this.banner(`<span class="big">${perk.name}${perk.rank > 1 ? ' ' + rankName(perk.rank) : ''}</span>New passive perk: ${perk.desc}`);
      }
      if (p?.skill === 'ranged' && p.level === SPLIT_SHOT_LEVEL) {
        this.msg('Split shot unlocked! Every bow shot now also fires at two more monsters in reach.', 'level');
      }
      // Advancing a combat skill invigorates you — restore some health.
      if (this.player.alive && COMBAT_SKILLS.has(p?.skill)) {
        this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.ceil(this.maxHp() * 0.1));
        this.bus.emit('hp');
      }
      this.checkAchievements();
    });
    // The rest of a multi-level jump: just the perk news and the health top-up.
    this._lvlLevelUpLight = (p) => {
      const perk = p?.skill && perkAtLevel(p.skill, p.level);
      if (perk) this.msg(`New passive perk: ${perk.name}${perk.rank > 1 ? ` (Rank ${rankName(perk.rank)})` : ''}. ${perk.desc}.`, 'level');
      if (this.player.alive && COMBAT_SKILLS.has(p?.skill)) this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.ceil(this.maxHp() * 0.1));
    };
    this.bus.on('quest', () => this.checkAchievements());

    this.tickAcc = 0;
    this.beatAcc = 0;             // player combat runs on a faster beat than the world tick
    this.tickCount = 0;
    this.regenCounter = 0;
    this.autosaveCounter = 0;
    this.starterGiven = false;
  }

  // ---------------- Lifecycle ----------------
  start() {
    const loaded = hasSave() && loadGame(this);
    if (loaded) {
      this.starterGiven = true;
      this.msg(`Welcome back to ${this.world.townName}, ${this.player.name}!`, 'system');
      if (LEARNING_ENABLED && !this.learning.dailyDone(this.todayKey())) this.msg('Your daily revision is ready in the Knowledge Codex (Skills tab).', 'level');
    } else {
      this.newGame();
    }
    this.bus.emit('inventory');
    this.bus.emit('equipment');
    this.bus.emit('skills');
    this.bus.emit('hp');
    this.bus.emit('run');
    this.prayerPoints = this.skills.prayer;
    this.bus.emit('prayer');
    this.updateRegion();
    this.ensureBounties();
    this.checkAchievements(true);
    this.bus.emit('achievement');
  }

  newGame() {
    for (const id of STARTER_TOOLS) this.inventory.add(id, 1);
    this.inventory.add('coins', 150);
    this.inventory.add('kaya_toast', 5);
    this.inventory.add('chicken_rice', 3);
    this.player.hp = this.maxHp();
    this.starterGiven = true;
    // Combat gear is granted once the player picks a fighting style — see
    // chooseStartingStyle(). The UI prompts for this right after the splash.
    this.pendingStyleChoice = true;
    this.msg(`Welcome to ${this.world.townName}, an island of adventure!`, 'system');
  }

  /** Grant starting combat gear for a freshly-chosen fighting style. Only
   *  fires once, right after a brand-new game boots (never for a loaded save). */
  /** Older entry point: pick the default class of a fighting style. */
  chooseStartingStyle(style) {
    return this.chooseClass({ ranged: 'archer', magic: 'wizard', dance: 'dancer' }[style] || 'corsair');
  }

  /** Pick a job class (permanent). A brand-new character also gets its class's
   *  starting kit; an older save keeps its gear and is handed its class weapon. */
  chooseClass(classId) {
    const cls = CLASS_BY_ID[classId];
    if (!cls || this.jobClass) return;
    this.jobClass = classId;
    if (!this.pendingStyleChoice) {
      // An existing character: put away a weapon it can no longer use, and hand over its class weapon.
      this.pendingClassChoice = false;
      const w = this.equipment.get('weapon');
      if (w && getItem(w).equip?.weaponType && getItem(w).equip.weaponType !== cls.weapon && this.inventory.freeSlots?.() !== 0) {
        this.equipment.clearSlot('weapon'); this.inventory.add(w, 1);
      }
      const starter = starterWeapon(classId);
      if (!this.equipment.get('weapon')) this.equipment.set('weapon', starter); else this.inventory.add(starter, 1);
      this.msg(`You are now a ${cls.name}. Only ${WEAPON_TYPE_NAMES[cls.weapon]} can be wielded, and the choice is permanent.`, 'level');
      this.msg(`${cls.name} perk: ${classPerks(classId)[0].text} (see Class perks in the Combat tab)`, 'system');
      this.bus.emit('inventory'); this.bus.emit('equipment');
      return;
    }
    this.pendingStyleChoice = false;
    const style = cls.style;
    const starter = starterWeapon(classId);
    if (style === 'ranged') {
      this.equipment.set('weapon', starter);
      if (canDualWield(starter)) this.equipment.set('shield', starter);   // Pistolers start with a pair
      if (ARMOUR_FAMILY[classId] === 'leather') {   // the Ninja wears scout leather, not hide
        this.equipment.set('head', 'bronze_scout_hood');
        this.equipment.set('body', 'bronze_scout_jerkin');
        this.equipment.set('legs', 'bronze_scout_breeches');
      } else {
        this.equipment.set('head', 'coif');
        this.equipment.set('body', 'studded_body');
        this.equipment.set('legs', 'leather_chaps');
      }
      if (!getItem(starter).equip.noAmmo) this.inventory.add('bronze_arrow', 999);
    } else if (style === 'dance') {
      this.equipment.set('weapon', starter);
      this.equipment.set('head', 'silk_headdress');
      this.equipment.set('body', 'silk_dancer_top');
      this.equipment.set('legs', 'silk_dancer_skirt');
      this.equipment.set('feet', 'silk_slippers');
      // Dancers start at Agility 15, matching melee's starting Attack/Strength.
      this.skills.xp.agility = Math.max(this.skills.xp.agility, xpForLevel(15));
    } else if (style === 'magic') {
      this.equipment.set('weapon', starter);
      this.equipment.set('head', 'wizard_hat');
      this.equipment.set('body', 'wizard_robe_top');
      this.equipment.set('legs', 'wizard_robe_bottom');
      this.inventory.add('air_rune', 999);
      this.inventory.add('mind_rune', 999);
      // Casters start at Magic 15, matching melee's starting Attack/Strength.
      this.skills.xp.magic = Math.max(this.skills.xp.magic, xpForLevel(15));
    } else {
      this.equipment.set('weapon', starter);
      // Rogues and Corsairs start dual wielding; every other melee class gets a shield.
      this.equipment.set('shield', canDualWield(starter) ? starter : 'wooden_shield');
      // Heavy melee starts in chainmail, agile melee in leather (each class has its own armour).
      this.equipment.set('body', ARMOUR_FAMILY[classId] === 'plate' ? 'bronze_chainbody' : 'leather_body');
    }
    this.player.hp = this.maxHp();
    this.msg(`You are a ${cls.name}: you fight with ${WEAPON_TYPE_NAMES[cls.weapon]}. Talk to the Kampong Guide for tips.`, 'system');
    this.msg(`${cls.name} perk: ${classPerks(classId)[0].text} (see Class perks in the Combat tab)`, 'system');
    this.bus.emit('inventory'); this.bus.emit('equipment'); this.bus.emit('hp');
  }

  giveStarter() {
    let gave = false;
    for (const id of STARTER_TOOLS) {
      if (!this.inventory.has(id) && this.equipment.get('weapon') !== id) {
        this.inventory.add(id, 1); gave = true;
      }
    }
    if (gave) this.msg('The guide hands you some starter equipment.', 'system');
    else this.msg('You already have everything you need!', 'system');
  }

  // ---------------- Helpers ----------------
  pathCfg() {
    // Built once: every path search (hundreds a tick with many monsters) shares it.
    return this._pathCfg || (this._pathCfg = { width: this.world.width, height: this.world.height, isBlocked: (x, y) => this.world.isBlocked(x, y) });
  }

  // There is no walking or run energy any more: everyone always moves at full
  // (running) speed. runEnergy stays at 100 for older saves and effects.
  canRun() { return true; }

  /** Max hitpoints = Hitpoints level + any bonus HP from equipment. */
  maxHp() {
    const base = this.skills.hitpoints + (this.equipment.bonuses().hp || 0);
    return base + Math.floor(base * ((this.perkMods('defence').maxhp || 0)   // Vitality / Second Skin perks
      + (this.attrs?.str || 0) * LIFE_PER_STR));                               // Strength
  }

  // ---- Attributes: Strength, Intelligence, Dexterity (see attributes.js) ----
  /** Stat points earned so far: from your best fighting skill. */
  statPoints() {
    const sk = this.skills;
    return statPointsAt(Math.max(sk.attack, sk.ranged, sk.magic, sk.danceLevel ? sk.danceLevel() : sk.agility));
  }
  spentPoints() { return ATTRS.reduce((t, k) => t + (this.attrs[k] || 0), 0); }
  unspentPoints() { return Math.max(0, this.statPoints() - this.spentPoints()); }
  /** Put a point into an attribute. */
  addStat(k, n = 1) {
    if (!ATTRS.includes(k)) return false;
    const add = Math.min(n, this.unspentPoints());
    if (add <= 0) { this.msg('You have no stat points to spend. You earn more as your fighting skill grows.', 'system'); return false; }
    this.attrs[k] += add;
    this.bus.emit('hp'); this.bus.emit('stats');
    return true;
  }
  /** Refund every point, for coins. */
  resetStats() {
    const spent = this.spentPoints();
    if (!spent) return false;
    const cost = spent * RESET_COST_PER_POINT;
    if (this.inventory.count('coins') < cost) { this.msg(`Resetting your stats costs ${cost} coins.`, 'system'); return false; }
    this.inventory.remove('coins', cost);
    this.attrs = { str: 0, int: 0, dex: 0 };
    if (this.player.hp > this.maxHp()) this.player.hp = this.maxHp();
    this.msg(`Your stat points are refunded (${cost} coins).`, 'system');
    this.bus.emit('hp'); this.bus.emit('stats');
    return true;
  }

  /** Summed passive-perk modifiers for a fighting style (its tracks plus Defence),
   *  or for 'defence' alone. Cached until a relevant level changes. */
  perkMods(mode = this.combatMode()) {
    const sk = this.skills;
    const key = mode + ':' + (this.jobClass || '') + ':' + PERK_SKILLS.map((s) => sk.level(s)).join(',');
    this._perkCache ||= new Map();
    let m = this._perkCache.get(key);
    if (!m) {
      const tracks = mode === 'defence' ? ['defence'] : [...(STYLE_TRACKS[mode] || STYLE_TRACKS.melee), 'defence'];
      m = sumPerks(tracks, (s) => sk.level(s));
      // Class passives: one every 100 levels of the class's own fighting skill.
      const cls = this.jobClass && CLASS_BY_ID[this.jobClass];
      if (cls) {
        const cm = classPassiveMods(cls.id, sk.level(CLASS_SKILL[cls.style] || 'attack'));
        for (const [k, v] of Object.entries(cm)) m[k] = (m[k] || 0) + v;
        for (const k of Object.keys(m)) if (PERK_CAPS[k] != null) m[k] = Math.min(PERK_CAPS[k], m[k]);
      }
      if (this._perkCache.size > 64) this._perkCache.clear();
      this._perkCache.set(key, m);
    }
    // Potions add on top of the perks (a fresh object, so the cache stays clean).
    for (const _ in this.potions) {
      const pm = this.potionMods(mode === 'defence' ? this.combatMode() : mode);
      const out = { ...m };
      for (const [k, v] of Object.entries(pm)) out[k] = (out[k] || 0) + v;
      return out;
    }
    return m;
  }

  /** Damage taken after Defence perks (and Boss Ward against bosses). */
  _perkReduce(dmg, npc) {
    if (dmg <= 0) return dmg;
    const t = this.perkMods();
    const cut = (t.reduce || 0) + (npc?.def?.boss ? (t.bossReduce || 0) : 0);
    return cut > 0 ? Math.max(1, Math.round(dmg * (1 - Math.min(0.6, cut)))) : dmg;
  }

  /** Tile the player will next occupy (intent tile), used as a pathfinding start. */
  playerTile() {
    const p = this.player;
    return p.moving ? { x: p.tx, y: p.ty } : { x: p.x, y: p.y };
  }

  hasTool(tag) {
    if (this.equipment.hasTool(tag)) return true;
    return this.inventory.slots.some((s) => s && getItem(s.id).tool === tag);
  }

  npcAt(tx, ty) {
    return this.npcs.find((n) => n.alive && (
      (n.x === tx && n.y === ty) || (n.moving && n.tx === tx && n.ty === ty)
    )) || null;
  }

  msg(text, cls = 'game') { this.bus.emit('chat', { text, cls }); }
  banner(html) { this.ui?.showBanner(html); }
  addHitsplat(entity, dmg, opts = {}) {
    if (entity && dmg > 0) entity.hurt = 200; // flash the struck entity
    // Very fast attacks: hits landing on the same foe within 120ms of its last
    // number add into that number instead of each drawing its own, so a flurry
    // stays readable and cheap to draw. Text splats and crits keep their own.
    const last = entity._lastSplat;
    if (last && !opts.text && !last.text && dmg > 0 && last.dmg > 0 && !!opts.crit === last.crit && (opts.critX || 0) === last.critX
      && opts.tint === last.tint && last.life > last.maxLife - SPLAT_MERGE_MS && this.effects.includes(last)) {
      last.dmg += dmg;
      return;
    }
    entity._splatN = ((entity._splatN || 0) + 1) % 3;
    const fx = { type: 'hitsplat', entity, dmg, crit: !!opts.crit, critX: opts.critX || 0, text: opts.text, tint: opts.tint, life: opts.critX ? 1400 : 1100, fan: entity._splatN - 1 };
    fx.maxLife = fx.life;
    entity._lastSplat = fx;
    this.effects.push(fx);
    if (opts.crit && dmg > 0) {
      this.addShake(2.5, 180);                 // crits thump the screen a little...
      if (entity !== this.player) this.hitStop = Math.max(this.hitStop, 55);   // ...and freeze for a beat
    }
  }

  /** Kick off a decaying screen shake (kept subtle; the strongest is a boss kill). */
  addShake(mag = 3, ms = 220) {
    if (mag >= this.shakeMag * (this.shakeT / this.shakeDur)) {
      this.shakeMag = Math.min(6, mag);
      this.shakeDur = ms;
      this.shakeT = ms;
    }
  }

  /** A sweeping melee arc drawn over the target — gold for the player's fancy
   *  hits, red for a monster's telegraphed heavy blow. */
  _slash(target, color) {
    const c = target.renderCenter ? target.renderCenter() : target;
    this.effects.push({
      type: 'slash', x: c.x, y: c.y - 6,
      ang: Math.random() * Math.PI * 2, dir: Math.random() < 0.5 ? -1 : 1,
      color, life: 190, maxLife: 190,
    });
  }

  /** Point an attacker's lunge toward a tile and start the swing animation. */
  _swingToward(attacker, tx, ty) {
    const c = attacker.renderCenter();
    let dx = (tx * TILE + TILE / 2) - c.x, dy = (ty * TILE + TILE / 2) - c.y;
    const m = Math.hypot(dx, dy) || 1;
    attacker.lungeDX = dx / m; attacker.lungeDY = dy / m;
    attacker.swing = attacker.swingDur || 240;
    // Turn to face the foe so the sprite isn't swinging backwards.
    if (Math.abs(dx) > 2) { attacker.facing = { dx: Math.sign(dx), dy: 0 }; attacker.noteFacing?.(); }
  }

  // ---------------- Frame update (called from RAF) ----------------
  update(dt) {
    if (this.playerRoot > 0 && this.player.path?.length) this.player.path = [];   // rooted: no walking off
    this._driveMovement();
    // Hit-stop: on big hits and kills, animation all but freezes for a few
    // frames (game ticks carry on), which makes impacts feel weighty.
    let adt = dt;
    if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - dt); adt = dt * 0.12; }
    // Your own walking never freezes, though: stalling mid-stride on every kill
    // made moving between fights (auto battle above all) stutter.
    this.player.update(this.player.moving ? dt : adt);
    this._keepChasing();
    this._holdAttack();
    // Only NPCs near the player animate and walk (the rest are frozen until you
    // come close, like their AI), so a fuller world costs no more per frame.
    { const px = this.player.x, py = this.player.y;
      for (const n of this.npcs) if (n.ally || (Math.abs(n.x - px) <= 48 && Math.abs(n.y - py) <= 48)) n.update(adt); }
    this.playMs += dt;
    this._tickPotions(dt);

    this.tickAcc += dt;
    let guard = 0;
    while (this.tickAcc >= TICK_MS && guard++ < 5) {
      this.tickAcc -= TICK_MS;
      this.doTick();
    }
    this.beatAcc += dt;
    guard = 0;
    while (this.beatAcc >= COMBAT_BEAT_MS && guard++ < 10) {
      this.beatAcc -= COMBAT_BEAT_MS;
      this._combatBeat();
    }
    if (this._autoRetarget) { this._autoRetarget = false; if (this.autoBattle && this.player.alive) this._autoBattleTick(); }

    const c = this.player.renderCenter();
    this.camera.follow(c.x, c.y, 0.22, { width: this.world.width, height: this.world.height }, dt);

    for (const e of this.effects) e.life -= adt;
    this.effects = this.effects.filter((e) => e.life > 0);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    // Harvest-judder timers on world objects (trees/rocks being worked).
    for (const o of this.world.objects) if (o.shakeT > 0) o.shakeT = Math.max(0, o.shakeT - dt);

    for (const p of this.particles) {
      p.x += p.vx * adt; p.y += p.vy * adt; p.vy += p.g * adt; p.life -= adt;
      if (p.drag) { const d = Math.pow(p.drag, adt / 16); p.vx *= d; p.vy *= d; }
      if (p.spin) p.rot += p.spin * adt;
      if (p.sway !== undefined) { p.sway += adt * 0.004; p.vx = Math.sin(p.sway) * 0.025; }   // leaves rock side to side as they fall
    }
    if (this.particles.length) this.particles = this.particles.filter((p) => p.life > 0);

    this.updateHover();
  }

  // ---------------- Particles ----------------
  _pushParticle(p) {
    if (this.lowFx && Math.random() < 0.6) return;   // low graphics: far fewer particles
    this.particles.push(p);
    if (this.particles.length > (this.lowFx ? 80 : 300)) this.particles.shift();
  }

  spawnHitSparks(entity, color) {
    const c = entity.renderCenter();
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.04 + Math.random() * 0.08;
      this._pushParticle({ x: c.x, y: c.y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.03, g: 0.0004, life: 380, maxLife: 380, size: 2 + Math.random() * 1.5, color, add: true });
    }
  }

  spawnSparkle(entity, color, n = 8) {
    const c = entity.renderCenter ? entity.renderCenter() : entity;
    for (let i = 0; i < n; i++) {
      this._pushParticle({ x: c.x + (Math.random() - 0.5) * 18, y: c.y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 0.02, vy: -0.03 - Math.random() * 0.03, g: 0, life: 700, maxLife: 700, size: 2 + Math.random() * 2, color, add: true });
    }
  }

  _deathBurst(npc) {
    const c = npc.renderCenter();
    this.spawnHitSparks(npc, '#ffd9b0');
    this.spawnPoof(c.x, c.y - 4, npc.def.color || '#caa15a');
    this.bus.emit('sfx', npc.def.boss ? 'bossdie' : 'die');
    if (npc.def.boss) { this.spawnSparkle(npc, '#ffd24a', 20); this.spawnPoof(c.x, c.y - 8, '#ff7a3a'); this.addShake(5, 340); }
  }

  /** A burst of tumbling paper confetti in the brand's marker colours. */
  spawnConfetti(wx, wy, n = 22) {
    const cols = ['#F5B82E', '#C0392B', '#1F6FA8', '#3DAA5C', '#9B52AD', '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, s = 0.08 + Math.random() * 0.1;
      this._pushParticle({ x: wx, y: wy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.00025, drag: 0.996,
        life: 1100 + Math.random() * 500, maxLife: 1500, size: 2.2 + Math.random() * 1.6, color: cols[i % cols.length],
        add: false, shape: 'confetti', rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.03 });
    }
  }

  spawnPoof(wx, wy, color) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.02 + Math.random() * 0.05;
      this._pushParticle({ x: wx, y: wy, vx: Math.cos(a) * s, vy: -0.02 - Math.random() * 0.03, g: 0.0002, life: 450, maxLife: 450, size: 2 + Math.random() * 2, color, add: false });
    }
  }

  _spawnEmbers() {
    for (const o of this.world.objects) {
      if (o.def.type !== 'fire' && o.def.type !== 'furnace') continue;
      if (Math.random() < 0.45) {
        const wx = o.x * TILE + TILE / 2 + (Math.random() - 0.5) * 8;
        const wy = o.y * TILE + TILE / 2 - 6;
        this._pushParticle({ x: wx, y: wy, vx: (Math.random() - 0.5) * 0.01, vy: -0.03 - Math.random() * 0.02, g: -0.00002, life: 620, maxLife: 620, size: 1.4 + Math.random() * 1.4, color: '#ffae3a', add: true });
      }
    }
  }

  // Drifting ambient motes, tinted by region (fireflies after dark), to give
  // the world some life.
  _spawnAmbient() {
    if (this.lowFx || Math.random() < 0.5) return;
    const c = this.player.renderCenter();
    const x = c.x + (Math.random() - 0.5) * 360;
    const y = c.y + (Math.random() - 0.5) * 260;
    const zone = this.currentZoneName;
    const night = this.isNight();
    let color = night ? '#ffe37a' : '#fff0b0';
    if (zone === 'Pulau Hantu') color = '#b58aff';
    else if (zone === 'The Wilderness') color = '#ff8a5a';
    else if (zone === 'MacRitchie Reservoir' || zone === 'Sentosa Beach' || zone === 'Changi Coast' || zone === 'Marina Bay') color = '#bfe8ff';
    else if (zone === 'Sungei Buloh Wetlands' || zone === 'Jurong Forest') color = night ? '#d4ff5a' : '#dfff9a';
    else if (zone === 'Tekong Badlands') color = '#ff9a6a';
    else if (zone === 'Bukit Timah') color = night ? '#d4ff5a' : '#dfff9a'; // kunang-kunang after dark
    this._pushParticle({
      x, y, vx: (Math.random() - 0.5) * 0.006, vy: -0.004 - Math.random() * 0.006, g: 0,
      life: 4200 + Math.random() * 2600, maxLife: 7000, size: 1 + Math.random() * 1.3, color, add: true,
    });
    if (zone === 'The Wilderness') {
      // Ash and grit gusting sideways across the Wilderness.
      for (let i = 0; i < 2; i++) this._pushParticle({
        x: c.x - 200 + Math.random() * 60, y: c.y + (Math.random() - 0.5) * 260, vx: 0.05 + Math.random() * 0.04, vy: (Math.random() - 0.5) * 0.008, g: 0,
        life: 5200, maxLife: 5200, size: 0.8 + Math.random() * 1.2, color: Math.random() < 0.5 ? '#8a7a6a' : '#b5a48f', add: false,
      });
    } else {
      // A leaf now and then, tumbling down from a nearby tree.
      const trees = this.world.objects.filter((o) => o.def.type === 'tree' && Math.abs(o.x * TILE - c.x) < 200 && Math.abs(o.y * TILE - c.y) < 150);
      if (trees.length && Math.random() < 0.6) {
        const t = trees[Math.floor(Math.random() * trees.length)];
        const autumn = Math.random() < 0.3;
        this._pushParticle({
          x: t.x * TILE + TILE / 2 + (Math.random() - 0.5) * 18, y: t.y * TILE - 6, vx: (Math.random() - 0.5) * 0.02, vy: 0.012 + Math.random() * 0.01, g: 0,
          life: 2600, maxLife: 2600, size: 1.6 + Math.random() * 0.8, color: autumn ? '#e0a63a' : '#5fb05a', add: false,
          shape: 'leaf', rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.006, sway: Math.random() * 6.28,
        });
      }
    }
  }

  // ---------------- Game tick (600ms) ----------------
  doTick() {
    this.tickCount++;
    this._tickBossEffects();
    this._tickKnowledgeStrike();
    // Rhythm fades if the Dancer stops lashing for a few ticks.
    if (this.danceRhythm > 0 && this.tickCount - this._danceHitTick > 4) { this.danceRhythm = 0; this.bus.emit('rhythm'); }
    if (!this.player.alive) {
      if (--this.player.respawnTimer <= 0) this.respawnPlayer();
    } else {
      if (this.playerStun > 0) this.playerStun--;
      else { this.resolvePlayerAction(); this._autoBattleTick(); this._autoLifeTick(); this._autoQuestTick(); }
      this._autoPickup();
    }
    this._resolveHazards();
    this.player.stepMul = this.playerStepMul() * (this._onRoad() ? ROAD_PACE : 1);   // Agility quickens your steps, and so do roads
    this._tickWorldBoss();
    this._tickIgnites();
    if (this.killStreak && this.tickCount - this._lastKillTick > STREAK_WINDOW_TICKS) {
      this.msg(`Your kill streak of ${this.killStreak} ends.`, 'system');
      this.killStreak = 0; this.bus.emit('xpbonus');
    }
    this._checkNightfall();
    // Only tick NPCs near the player (the bestiary is large).
    const px = this.player.x, py = this.player.y;
    // Cached so every aggressive NPC's _combatAI can cheaply see how many
    // wandering monsters already have unprovoked aggro this tick, instead of
    // each one re-scanning the whole NPC list (avoids O(n^2) in dense areas).
    this._aggroAttackers = 0;
    for (const n of this.npcs) {
      if (n.alive && !n.temporary && n.target === this.player) this._aggroAttackers++;
    }
    const cl = this.skills.combatLevel();
    for (const n of this.npcs) {
      // Allies always tick, so they can catch up with a Merchant who travelled far.
      if (!n.ally && (Math.abs(n.x - px) > 46 || Math.abs(n.y - py) > 46)) continue;
      if (n.def.boss) this._scaleBoss(n, cl);
      n.tick(this);
    }
    Mercs.flushAllies(this);
    if (this.hasTemps) this.npcs = this.npcs.filter((n) => !(n.temporary && !n.alive));
    if (this._worldBoss && !this._worldBoss.alive) { this.npcs = this.npcs.filter((n) => n !== this._worldBoss); this._worldBoss = null; }
    if (this.player.alive) this.updateRegion();
    this.world.tick();
    this._tickFarms();
    this._spawnEmbers();
    if (this.player.alive) this._spawnAmbient();

    if (this.player.alive && ++this.regenCounter >= 100) {
      this.regenCounter = 0;
      if (this.player.hp < this.maxHp()) { this.player.hp++; this.bus.emit('hp'); }
    }
    this.updateRunEnergy();
    if (this.specEnergy < 100) { this.specEnergy = Math.min(100, this.specEnergy + 1); this.bus.emit('spec'); }
    this._tickCombatResources();
    this.drainPrayer();

    if (this.tickCount % 100 === 1) this.ensureBounties();   // roll over at local midnight
    if (++this.autosaveCounter >= AUTOSAVE_TICKS) { this.autosaveCounter = 0; saveGame(this); }
    // Catch wealth / collection milestones that don't fire a dedicated event.
    if (this.tickCount % 10 === 0) this.checkAchievements();
    this.bus.emit('tick', this.tickCount);
  }

  updateRunEnergy() { this.runEnergy = 100; }   // run energy was removed: always full

  toggleRun() {}   // kept so old key bindings and callers do nothing harmful

  // ---------------- Prayers ----------------
  maxPrayer() { return this.skills.prayer; }

  drainPrayer() {
    if (!this.activePrayers.size || this.prayerPoints <= 0) return;
    let drain = 0;
    for (const id of this.activePrayers) drain += PRAYER_BY_ID[id].drain;
    this.prayerPoints = Math.max(0, this.prayerPoints - drain * 0.15);
    if (this.prayerPoints <= 0) { this.activePrayers.clear(); this.msg('You have run out of prayer points.', 'system'); }
    this.bus.emit('prayer');
  }

  togglePrayer(id) {
    const p = PRAYER_BY_ID[id];
    if (!p) return;
    if (this.activePrayers.has(id)) { this.activePrayers.delete(id); this.bus.emit('prayer'); return; }
    if (this.skills.prayer < p.level) { this.msg(`You need Prayer level ${p.level} for ${p.name}.`); return; }
    if (this.prayerPoints <= 0) { this.msg('You have no prayer points. Restore at the A-Worthy Monument.'); return; }
    for (const ids of Object.values(PRAYER_GROUPS)) {
      if (ids.includes(id)) for (const other of ids) this.activePrayers.delete(other);
    }
    this.activePrayers.add(id);
    this.spawnSparkle(this.player, '#ffe89a', 6);
    this.bus.emit('prayer');
  }

  prayerMult() {
    const m = { att: 1, str: 1, def: 1, ranged: 1, magic: 1 };
    for (const id of this.activePrayers) {
      const p = PRAYER_BY_ID[id];
      for (const k of ['att', 'str', 'def', 'ranged', 'magic']) if (p[k]) m[k] += p[k];
    }
    return m;
  }

  protectFactor() {
    for (const id of this.activePrayers) { const p = PRAYER_BY_ID[id]; if (p.protect) return p.protect; }
    return 0;
  }

  // ---------------- Achievements / collection log ----------------
  checkAchievements(silent = false) {
    let unlocked = false;
    for (const a of ACHIEVEMENTS) {
      if (this.achievements.has(a.id)) continue;
      let done = false;
      try { done = a.test(this); } catch { done = false; }
      if (!done) continue;
      this.achievements.add(a.id);
      unlocked = true;
      if (!silent) {
        const reward = rewardFor(a.id);
        if (reward > 0) this.inventory.add('coins', reward);
        this.msg(`Achievement unlocked: ${a.name} — ${a.desc} (+${reward} coins)`, 'level');
        this.banner(`<span class="big">Achievement unlocked!</span>${a.name} &middot; +${reward} coins`);
        this.spawnSparkle(this.player, '#ffd24a', 14);
      }
    }
    if (unlocked) this.bus.emit('achievement');
  }

  // ---------------- Slayer task system ----------------
  assignSlayerTask() {
    if (this.slayer.task) { this.msg(`Finish your current task first: ${this.slayer.task.remaining} ${this.slayer.task.name} left.`, 'system'); return; }
    const pool = eligibleTasks(this.skills.slayer);
    if (!pool.length) { this.msg('No suitable tasks right now.', 'system'); return; }
    const t = pool[randInt(0, pool.length - 1)];
    const amount = randInt(t.min, t.max);
    this.slayer.task = { family: t.family, name: t.name, amount, remaining: amount };
    this.msg(`New Slayer task: slay ${amount} ${t.name}.`, 'level');
    this.banner(`<span class="big">Slayer task</span>Slay ${amount} ${t.name}`);
    this.bus.emit('slayer');
  }

  cancelSlayerTask() {
    if (!this.slayer.task) return;
    this.msg(`You abandon your task to slay ${this.slayer.task.name}.`, 'system');
    this.slayer.task = null;
    this.bus.emit('slayer');
  }

  progressSlayer(npc) {
    const task = this.slayer.task;
    if (!task || !npc.def.family || npc.def.family !== task.family) return;
    task.remaining = Math.max(0, task.remaining - 1);
    this.skills.addXp('slayer', Math.max(5, npc.def.level));
    if (task.remaining <= 0) {
      this.slayer.completed++;
      const bonus = this.slayer.completed % 10 === 0 ? 50 : this.slayer.completed % 5 === 0 ? 25 : 10;
      this.slayer.points += bonus;
      this.slayer.task = null;
      this.msg(`Slayer task complete! +${bonus} Slayer points (${this.slayer.points} total).`, 'level');
      this.banner('<span class="big">Task complete!</span>Visit the Slayer Master for another.');
      this.spawnSparkle(this.player, '#d0d0d0', 14);
    }
    this.bus.emit('slayer');
  }

  buySlayerReward(id) {
    const r = SLAYER_REWARDS.find((x) => x.id === id);
    if (!r) return;
    if (this.slayer.points < r.cost) { this.msg('Not enough Slayer points.', 'system'); return; }
    if (this.inventory.canAdd(id, r.qty) <= 0) { this.msg('You need more inventory space.', 'system'); return; }
    this.slayer.points -= r.cost;
    this.inventory.add(id, r.qty);
    this.msg(`You redeem ${r.qty > 1 ? r.qty + ' x ' : ''}${getItem(id).name} for ${r.cost} Slayer points.`, 'system');
    this.bus.emit('slayer');
  }

  // ---------------- Player action resolution ----------------
  resolvePlayerAction() {
    const p = this.player;
    const a = p.action;
    if (!a) return;

    switch (a.type) {
      case 'attack': return this._tickAttack(a);
      case 'pickup': return this._tickArrival(a, { x: a.gi.x, y: a.gi.y }, false, () => this.doPickup(a.gi));
      case 'firemake': {
        if (!resolveFiremake(this, a)) p.clearAction();
        return;
      }
      // Continuous gathering / processing (need adjacency).
      case 'woodcut': return this._tickContinuous(a, a.obj, () => resolveWoodcut(this, a));
      case 'mine': return this._tickContinuous(a, a.obj, () => resolveMine(this, a));
      case 'fish': return this._tickContinuous(a, a.obj, () => resolveFish(this, a));
      case 'cook': return this._tickContinuous(a, a.obj, () => resolveCook(this, a));
      case 'cookdish': return this._tickContinuous(a, a.obj, () => resolveDish(this, a));
      case 'smelt': return this._tickContinuous(a, a.obj, () => resolveSmelt(this, a));
      case 'smith': return this._tickContinuous(a, a.obj, () => resolveSmith(this, a));
      case 'craft': return this._tickContinuous(a, a.obj, () => resolveCraft(this, a));
      case 'hunt': return this._tickContinuous(a, a.obj, () => resolveHunt(this, a));
      case 'recipe': return this._tickContinuous(a, a.obj, () => resolveRecipe(this, a));
      case 'fletchmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openRecipeMenu('fletching', a.obj));
      case 'herbmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openRecipeMenu('herblore', a.obj));
      case 'farm': return this._tickArrival(a, a.obj, true, () => { this.tendPatch(a.obj, a.seed); if (this.autoGather) this._autoLife = { kind: 'farm' }; });
      // One-shot arrival actions (open a UI / talk).
      case 'cookmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openCookMenu(a.obj));
      case 'smeltmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openSmeltMenu(a.obj));
      case 'smithmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openSmithMenu(a.obj));
      case 'craftmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openCraftMenu(a.obj));
      case 'pray': return this._tickArrival(a, a.obj, true, () => {
        this.player.hp = this.maxHp();
        this.prayerPoints = this.skills.prayer;
        this.bus.emit('hp'); this.bus.emit('prayer');
        this.spawnSparkle(this.player, '#9adcff', 16);
        this.msg('You kneel at the A-Worthy Monument. Your health and prayer are restored.', 'system');
        if (this.inventory.slots.some((x) => x && isBone(x.id))) this.msg('You could offer your bones here for 2.5x Prayer XP (right-click them).', 'system');
        this.addGood(1); // devotion is a small good
        this.markPillar('monument');
      });
      case 'rest': return this._tickArrival(a, a.obj, true, () => {
        this.player.hp = this.maxHp();
        this.runEnergy = 100;
        this.bus.emit('hp'); this.bus.emit('run');
        this.spawnSparkle(this.player, '#f5a623', 16);
        this.msg('You rest at the A-Worthy Mascot Statue. Health restored.', 'system');
        this.markPillar('obelisk');
      });
      case 'thieve': return this._tickArrival(a, a.target, true, () => { this.pickpocket(a.npc); if (this.autoGather) this._autoLife = { kind: 'thieve', npc: a.npc }; });
      case 'agility': return this._tickContinuous(a, a.obj, () => this.resolveAgility(a.obj));
      case 'stall': return this._tickContinuous(a, a.obj, () => this.stealFromStall(a.obj));
      case 'transport': return this._tickArrival(a, a.target, true, () => this.ui?.openTransport(a.obj));
      case 'openbank': return this._tickArrival(a, a.target, true, () => this.ui?.openBank());
      case 'openshop': return this._tickArrival(a, a.target, true, () => this.ui?.openShop(a.shop));
      case 'talk': return this._tickArrival(a, a.target, true, () => this.ui?.openDialogue(a.npc));
      case 'questtalk': return this._tickArrival(a, a.target, true, () => this._autoQuestTalk(a.quest, a.npc));
      default: p.clearAction();
    }
  }

  _isReached(target, adjacent) {
    const p = this.player;
    if (p.isMoving) return false;
    return adjacent
      ? chebyshev(p.x, p.y, target.x, target.y) <= 1
      : p.x === target.x && p.y === target.y;
  }

  /** Continuous skill action against an object: approach, then run resolver each tick. */
  _tickContinuous(a, obj, resolver) {
    if (!this._isReached({ x: obj.x, y: obj.y }, true)) {
      if (!this.player.isMoving) this.player.clearAction(); // couldn't reach
      return;
    }
    this.player.stop();
    // Count the bag before and after so every item gathered pops up over you.
    const gather = GATHER_ACTIONS.has(a.type) || a.type === 'hunt';
    const before = gather ? this._bagCounts() : null;
    const going = resolver();
    if (gather) {
      const after = this._bagCounts();
      for (const [id, n] of after) {
        const got = n - (before.get(id) || 0);
        if (got > 0 && id !== 'coins') this.addHitsplat(this.player, 0, { text: `+${got} ${getItem(id).name}` });
      }
    }
    // Remember what we're gathering, so auto gather can pick it up again after
    // a fight, or once the mined-out rocks and felled trees grow back.
    if (gather && this.autoGather && obj?.objId) this._autoLife = { kind: 'gather', objId: obj.objId };
    // "Do all": when one recipe runs out, move straight on to the next one.
    if (!going && a.all) {
      a.done ||= new Set();
      a.done.add(jobKey(a));
      const nxt = nextJob(this, a.all, a.done);
      if (nxt) { Object.assign(a, { rawId: undefined, recipe: undefined, skill: undefined }, nxt); return; }
      this.msg('Done: nothing left you can make here.', 'system');
    }
    if (!going) {
      this.player.clearAction();
      if (gather && this.autoGather) this._autoGatherNext(a, obj);
    }
  }

  _bagCounts() {
    const m = new Map();
    for (const sl of this.inventory.slots) if (sl) m.set(sl.id, (m.get(sl.id) || 0) + sl.qty);
    return m;
  }

  /** Auto gather: the node ran dry (tree felled, rock mined out, fish moved on),
   *  so walk to the nearest node of the same kind and keep going until the bag
   *  is full. Anything else that stopped you (full bag, no tool, level) stops it. */
  _autoGatherNext(a, obj) {
    const gone = obj.depleted || this.world.objectAt(obj.x, obj.y) !== obj;
    if (!gone) return false;
    if (this.inventory.freeSlots() <= 0) { this.msg('Your bag is full: auto gather stops.', 'system'); return false; }
    const best = this._nextGatherNode(obj.objId, obj);
    if (!best) { this.msg(`No more ${obj.def.name.toLowerCase()}s nearby: auto gather waits here until they grow back.`, 'system'); return false; }
    this.defaultObjectAction(best);
    return true;
  }

  /** Where auto gather goes next: the nearest ready node of the same kind
   *  within 30 tiles, or failing that the nearest ready node of the same skill
   *  you have the level for (another kind of rock, tree or fishing spot). */
  _nextGatherNode(objId, exclude = null) {
    const here = this.playerTile();
    const def = this.world.objects.find((o) => o.objId === objId)?.def;
    let same = null, sd = Infinity, other = null, od = Infinity;
    for (const o of this.world.objects) {
      if (o === exclude || o.depleted) continue;
      const d = chebyshev(here.x, here.y, o.x, o.y);
      if (d > 30) continue;
      if (o.objId === objId) { if (d < sd) { sd = d; same = o; } continue; }
      if (def?.skill && o.def?.skill === def.skill && o.def.type === def.type
        && (o.def.level || 1) <= this.skills.level(def.skill) && d < od) { od = d; other = o; }
    }
    return same || other;
  }

  /** Auto gather for Farming and Thieving: once you're idle, carry on by
   *  yourself. Farming harvests ripe patches and replants empty ones with your
   *  best seed, patch after patch nearby; Thieving keeps picking the same
   *  pocket. It stops when there's nothing left to do or the bag is full. */
  _autoLifeTick() {
    const job = this._autoLife;
    const p = this.player;
    if (!job || !this.autoGather || p.action || p.isMoving || this.autoBattle) return;
    if (job.kind === 'gather') {
      // Back to the nearest node of the same kind that's ready again.
      if (this.inventory.freeSlots() <= 0) return;
      const best = this._nextGatherNode(job.objId);
      if (best) this.defaultObjectAction(best);
      return;
    }
    if (job.kind === 'thieve') {
      if (job.npc?.alive && chebyshev(job.npc.x, job.npc.y, p.x, p.y) <= 6) this.startPickpocket(job.npc);
      else this._autoLife = null;
      return;
    }
    // Farming: the nearest patch that's ripe, or empty when you have a seed you can plant.
    const lvl = this.skills.level('farming');
    const seed = this.inventory.slots.filter((sl) => sl && CROP_BY_SEED[sl.id] && cropFor(CROP_BY_SEED[sl.id][0]).level <= lvl)
      .map((sl) => sl.id).sort((a, b) => cropFor(CROP_BY_SEED[b][0]).level - cropFor(CROP_BY_SEED[a][0]).level)[0];
    const here = this.playerTile();
    let best = null, bd = Infinity;
    for (const o of this.world.objects) {
      if (o.def?.type !== 'farm') continue;
      const ripe = o.crop && !(o.growLeft > 0);
      if (!ripe && (o.crop || !seed)) continue;
      if (ripe && this.inventory.freeSlots() <= 0) continue;
      const d = chebyshev(here.x, here.y, o.x, o.y);
      if (d <= 20 && d < bd) { bd = d; best = o; }
    }
    if (!best) return;   // nothing ready yet: wait here (crops keep growing)
    const tgt = { x: best.x, y: best.y };
    this.beginAction({ type: 'farm', obj: best, target: tgt, seed: best.crop ? undefined : seed }, tgt, true);
  }

  toggleAutoGather(on = !this.autoGather) {
    this.autoGather = !!on;
    if (!this.autoGather) this._autoLife = null;
    this.msg(this.autoGather ? 'Auto gather on: when a node runs dry you move on to the next one.' : 'Auto gather off.', 'system');
    this.bus.emit('autogather');
  }

  /** "Go" from a skill guide or the world map: walk to the nearest of these
   *  objects (anywhere on the island) and start on it. */
  goToNearest(objIds) {
    const ids = new Set(objIds);
    const here = this.playerTile();
    let best = null, bd = Infinity;
    for (const o of this.world.objects) {
      if (!ids.has(o.objId) || o.depleted) continue;
      const d = (o.x - here.x) ** 2 + (o.y - here.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best || !this.player.alive) { this.msg("I can't find one of those anywhere.", 'system'); return false; }
    return this.goToObject(best);
  }

  /** Walk to one object, however far away, and start on it when you arrive. */
  goToObject(obj) {
    if (!this.player.alive) return false;
    this._mrtHopToward(obj);
    this._pathBudget = 150000;       // like quest trips, these can cross the whole map
    try { this.defaultObjectAction(obj); } finally { this._pathBudget = 0; }
    const ok = !!this.player.action || this.player.isMoving;
    this.msg(ok ? `You head for the ${obj.def.name.toLowerCase()}.` : "I can't find the way there.", 'system');
    if (ok) this.ui?.closeModal();
    return ok;
  }

  /** World map: ride the MRT to any station (every station is open from the start). */
  mrtFromMap(stationId) {
    if (this.npcs.some((n) => n.alive && n.target === this.player)) { this.msg("You can't take the MRT while something is attacking you.", 'system'); return false; }
    return this.travelTo(stationId);
  }

  /** A long trip: if a station lies much nearer the destination than you do,
   *  ride the MRT there first (one fare) so you only walk the last stretch.
   *  Returns true if it rode. Used by the world map's Travel, quest Go and auto quest. */
  _mrtHopToward(tile) {
    const p = this.player, here = this.playerTile();
    const walk = chebyshev(here.x, here.y, tile.x, tile.y);
    if (!p.alive || walk < MRT_HOP_MIN || this.inventory.count('coins') < MRT_FARE) return false;
    if (this.world.zoneAt(here.x, here.y)?.wilderness) return false;   // no MRT out of the Wilderness
    if (this.npcs.some((n) => n.alive && n.target === p)) return false;
    let best = null, bd = Infinity;
    for (const st of STATIONS) { const d = chebyshev(st.x, st.y, tile.x, tile.y); if (d < bd) { bd = d; best = st; } }
    if (!best || walk - bd < MRT_HOP_MIN / 2 || bd > walk * 0.6) return false;
    return this.travelTo(best.id);
  }

  /** World map: get to any tile, by MRT and on foot. */
  travelToTile(tile) {
    if (!this.player.alive) return false;
    this._mrtHopToward(tile);
    this._pathBudget = 150000;
    try { this.walkToFar(tile); } finally { this._pathBudget = 0; }
    return true;
  }

  /** One-shot action: approach, then fire `onArrive` and clear. */
  _tickArrival(a, target, adjacent, onArrive) {
    if (!this._isReached(target, adjacent)) {
      if (!this.player.isMoving) this.player.clearAction();
      return;
    }
    this.player.stop();
    this.player.clearAction();
    onArrive();
  }

  _tickAttack(a) {
    const p = this.player;
    const npc = a.npc;
    if (!npc || !npc.alive) { p.clearAction(); return; }
    const range = this.attackRange();
    // Steering or dodging: movement is yours; keep shooting whenever in reach.
    if (this._driving || this._dodging) return;
    if (chebyshev(p.x, p.y, npc.x, npc.y) > range) {
      // Approach / chase a moving target. Ranged attackers only walk as far as
      // the first tile within reach, not right up to it.
      if (!a.lastNpcTile || a.lastNpcTile.x !== npc.x || a.lastNpcTile.y !== npc.y || !p.isMoving) {
        let path = findPath(this.pathCfg(), this.playerTile(), { x: npc.x, y: npc.y },
          { reachAdjacent: true, maxNodes: 4000 });
        if (range > 1) {
          const cut = path.findIndex((t) => chebyshev(t.x, t.y, npc.x, npc.y) <= range);
          if (cut !== -1) path = path.slice(0, cut + 1);
        }
        if (path.length) this.player.setPath(path, this.canRun());
        else if (!p.isMoving) { this.msg("I can't reach that!"); p.clearAction(); return; }
        a.lastNpcTile = { x: npc.x, y: npc.y };
      }
      return;
    }
    p.stop();   // in range: the swing itself happens on the combat beat
  }

  /** Between ticks: a chase whose route ran out short of reach (the target
   *  stepped away) re-plans at once instead of standing still until the next
   *  0.6s tick. Throttled so an awkward target can't cost a path search a frame. */
  _keepChasing() {
    const p = this.player, a = p.action;
    if (p.moving || !p.alive || !a || a.type !== 'attack' || !a.npc?.alive) return;
    if (this._driving || this._dodging || this.playerStun > 0 || this.playerRoot > 0) return;
    if (chebyshev(p.x, p.y, a.npc.x, a.npc.y) <= this.attackRange()) return;
    if (this.playMs < (this._chaseRetryAt || 0)) return;
    this._chaseRetryAt = this.playMs + 150;
    this._tickAttack(a);
  }

  // Player swings run on a 300ms beat (twice the world tick), so weapon speeds
  // are counted in beats: the quickest weapons strike every 0.3s.
  _combatBeat() {
    const p = this.player;
    if (!p.alive) return;
    if (p.attackCooldown > 0) p.attackCooldown--;
    // Melee weapons have cooldowns under one beat, so the leftover carries over
    // and several swings can fit in one beat (up to 3 for the quickest).
    // No cap on attack speed. Past 20 attacks a beat, each attack call stands
    // for a volley of several (its damage multiplied to match), so the number
    // of hits a second keeps growing with attack speed without freezing the game.
    const iv = Math.max(1e-9, this.attackInterval());
    this._volley = iv < VOLLEY_MIN_BEATS ? VOLLEY_MIN_BEATS / iv : 1;
    for (let swings = 0; swings < 24; swings++) {
      if (this.playerStun > 0 || p.attackCooldown > 0) break;
      const a = p.action;
      if (!a || a.type !== 'attack' || !a.npc || !a.npc.alive) break;
      if (chebyshev(p.x, p.y, a.npc.x, a.npc.y) > this.attackRange()) break;
      this.doPlayerAttack(a.npc);
    }
    this._volley = 1;
  }

  // ---------------- Combat resolution ----------------
  combatMode() { return this.equipment.combatType(); }
  /** Tiles you can attack from: bows have their own reach (12-18), spells 8, melee 1. */
  attackRange() {
    const m = this.combatMode();
    if (m === 'ranged') { const w = this.equipment.get('weapon'); return ((w && getItem(w).equip?.range) || 12) + Math.floor(this.perkMods('ranged').range || 0); }
    if (m === 'dance') { const w = this.equipment.get('weapon'); return (w && getItem(w).equip?.range) || 3; }
    if (m === 'magic') return 8;
    // Melee: 2 tiles for most weapons, 3 for long ones (spear, halberd, longsword, 2h).
    const w = this.equipment.get('weapon');
    return (w && getItem(w).equip?.range) || MELEE_REACH;
  }

  doPlayerAttack(npc) {
    const mode = this.combatMode();
    if (mode === 'ranged') return this._rangedAttack(npc);
    if (mode === 'magic') return this._magicAttack(npc);
    if (mode === 'dance') return this._danceAttack(npc);
    const { max } = playerAttackVsNpc(this.skills, this.equipment, this.player.style, npc.def);
    const pm = this.prayerMult();
    const baseMax = Math.round(max * pm.str);
    this._swingToward(this.player, npc.x, npc.y);

    // Fold together special attack + armed ability + style-weakness bonuses.
    const mods = this._offensiveMods(npc, 'melee');
    const fancy = mods.spec || mods.ability;
    this._slash(npc, fancy ? '#ffd24a' : '#eef2f6');
    this.bus.emit('sfx', 'swish');
    let total = 0, raw = 0;   // raw: before crits, so each cleaved foe rolls its own
    for (let i = 0; i < mods.hits && npc.hp > 0; i++) {
      const effMax = Math.max(1, Math.round(baseMax * mods.dmgM));
      let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollHit(effMax);
      raw += dmg;
      const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
      if (dmg > 0) { this.spawnHitSparks(npc, (c.crit || fancy) ? '#ffd24a' : '#fff2b0'); for (const x of combatXp(this.player.style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult()); }
      total += dmg;
    }
    // Dual wielding: the off-hand dagger follows up with its own strike (60% max hit).
    if (this.equipment.isDualWielding() && npc.hp > 0) {
      const offMax = Math.max(1, Math.round(baseMax * 0.6));
      const dmg = rollHit(offMax);
      this._slash(npc, '#cfe8ff');
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && dmg >= offMax });
      if (dmg > 0) { this.spawnHitSparks(npc, '#e6f2ff'); for (const x of combatXp(this.player.style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult()); }
      total += dmg; raw += dmg;
    }
    // Cleave: every melee weapon but the quick ones (scimitars, claws) sweeps
    // through the foes crowding the target, heavy weapons hardest.
    if (total > 0) this._cleave(npc, raw);
    this._abilityAoe(npc, raw, 'melee');
    if (mods.heal && total > 0) {
      this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.round(total * mods.heal * (npc.def?.hpScale || 1)));
      this.bus.emit('hp');
    }
    // A sub-beat cooldown keeps what's left over (never banking more than one swing).
    this._resetCooldown(this.attackInterval());
    this._postAttack(npc);
  }

  /** If a melee special is armed and affordable, consume the energy and return it. */
  _takeSpec() {
    if (!this.specArmed) return null;
    const id = this.equipment.get('weapon');
    const spec = id && getItem(id).spec;
    if (!spec || this.specEnergy < spec.cost) { this.specArmed = false; this.bus.emit('spec'); return null; }
    this.specEnergy -= spec.cost;
    this.specArmed = false;
    this.bus.emit('spec');
    return spec;
  }

  toggleSpec() {
    const id = this.equipment.get('weapon');
    const spec = id && getItem(id).spec;
    if (!spec) { this.msg('This weapon has no special attack.'); return; }
    if (this.specEnergy < spec.cost) { this.msg(`You need ${spec.cost}% special energy for ${spec.name}.`); return; }
    this.specArmed = !this.specArmed;
    if (this.specArmed) { this.msg(`${spec.name} armed — your next hit is special.`, 'system'); this.bus.emit('sfx', 'spec'); }
    this.bus.emit('spec');
  }

  // ---------------- Active-combat resources & abilities ----------------
  /** NPCs within NEAR_RADIUS tiles of the player, worked out at most once a
   *  tick (again if the NPC list is replaced or grows, or the player changes
   *  tile). Hot paths loop over this instead of the whole world. */
  nearbyNpcs() {
    const p = this.player, px = Math.round(p.x), py = Math.round(p.y), c = this._near;
    if (c && c.tick === this.tickCount && c.arr === this.npcs && c.len === this.npcs.length && c.px === px && c.py === py) return c.list;
    const list = [];
    for (const n of this.npcs) if (Math.abs(n.x - px) <= NEAR_RADIUS && Math.abs(n.y - py) <= NEAR_RADIUS) list.push(n);
    this._near = { tick: this.tickCount, arr: this.npcs, len: this.npcs.length, px, py, list };
    return list;
  }

  _inCombat() {
    if (this.player.action && this.player.action.type === 'attack') return true;
    return this.nearbyNpcs().some((n) => n.alive && n.target === this.player);
  }

  _tickCombatResources() {
    let changed = false;
    for (const id of Object.keys(this.abilityCd)) {
      if (this.abilityCd[id] > 0) { this.abilityCd[id]--; changed = true; }
    }
    if (this.braceTicks > 0) this.braceTicks--;
    // Adrenaline ebbs away once you leave a fight, so abilities are a combat tool.
    if (!this._inCombat() && this.adrenaline > 0) { this.adrenaline = Math.max(0, this.adrenaline - 4); changed = true; }
    if (changed) { this.bus.emit('adrenaline'); this.bus.emit('ability'); }
  }

  /** How much extra adrenaline your class builds for an event (see CLASS_ADRENALINE). */
  _adrenTrait(k) { return CLASS_ADRENALINE[this.jobClass]?.[k] || 0; }
  /** Adrenaline for landing a hit: the base, plus your class's own way of building it. */
  _hitAdrenaline(crit) {
    let n = ADREN_PER_HIT + this._adrenTrait('hit');
    if (crit) n += this._adrenTrait('crit');
    if (this.player.hp < this.maxHp() * 0.5) n += this._adrenTrait('lowHp');
    this._gainAdrenaline(n);
  }

  _gainAdrenaline(n) {
    if (n <= 0) return;
    n *= 1 + (this.perkMods().adren || 0);   // Battle Rhythm / Lightfoot perks
    this.adrenaline = Math.min(100, this.adrenaline + n);
    this.bus.emit('adrenaline');
  }

  abilityUnlocked(ab) { return this.skills.combatLevel() >= (ab.unlock || 1); }

  /** The level you fight at, on the same scale as monster levels: your combat
   *  level, or the level of the skill you fight with (Melee, Ranged, Magic, or
   *  a Dancer's pooled Agility and Ranged) when that's higher. Combat level is compressed past
   *  100 (it tops out near 1,700) while monsters reach ~5,000 and bosses 9,999,
   *  so comparing monsters with combat level alone left late-game players unable
   *  to find, or be found by, anything their size. Auto battle's level band,
   *  monster aggression, bounties, world bosses and goal hunts all use this. */
  fightLevel() {
    const mode = this.combatMode();
    const lvl = mode === 'dance' ? this.skills.danceLevel() : this.skills.level({ ranged: 'ranged', magic: 'magic' }[mode] || 'attack');
    return Math.max(this.skills.combatLevel(), lvl);
  }

  /** The action-bar abilities for the weapon in hand (Z/X/B swap with the weapon). */
  currentAbilities() { return abilitiesFor(this.combatMode(), this.jobClass); }

  /** Hotkey entry point: Z/X/C/V/B resolve against the current weapon's set. */
  activateAbilityKey(key) {
    const ab = this.currentAbilities().find((a) => a.key.toLowerCase() === String(key).toLowerCase());
    if (ab) this.activateAbility(ab.id);
  }

  /** Activate (or arm) a combat ability from the action bar / hotkey. */
  activateAbility(id) {
    const ab = ABILITY_BY_ID[id];
    if (!ab) return;
    if (!this.abilityUnlocked(ab)) { this.msg(`${ab.name} unlocks at combat level ${ab.unlock}.`, 'system'); return; }
    if ((this.abilityCd[id] || 0) > 0) { this.msg(`${ab.name} is on cooldown.`, 'system'); return; }
    if (!this.canAffordAbility(ab)) { this.msg(`You need ${this.abilityCostText(ab)} for ${ab.name}.`, 'system'); return; }
    if (ab.cls && ab.cls !== this.jobClass) { this.msg(`${ab.name} is a ${CLASS_BY_ID[ab.cls]?.name || ab.cls} ability.`, 'system'); return; }
    if (ab.mode && ab.mode !== this.combatMode()) {
      const need = { melee: 'a melee weapon', ranged: 'a bow', magic: 'a staff' }[ab.mode];
      this.msg(`${ab.name} needs ${need} equipped.`, 'system');
      return;
    }
    if (ab.kind === 'attack' && ab.instant) {
      // Instant skills fire straight away at whatever you're fighting.
      const a = this.player.action;
      const npc = a && a.type === 'attack' ? a.npc : null;
      if (npc && npc.alive && this.player.alive && chebyshev(this.player.x, this.player.y, npc.x, npc.y) <= this.attackRange()) {
        this.armedAbility = id;
        this.player.stop();
        this.doPlayerAttack(npc);
        this.bus.emit('ability');
        return;
      }
    }
    if (ab.kind === 'attack') {
      // Toggle-arm like a special; spent and put on cooldown when the hit lands.
      this.armedAbility = this.armedAbility === id ? null : id;
      if (this.armedAbility) this.msg(`${ab.name} readied — your next hit unleashes it.`, 'system');
      this.bus.emit('ability');
      return;
    }
    // Immediate abilities (guard / heal) resolve right away.
    this._payAbility(ab);
    this.abilityCd[id] = ab.cd;
    if (ab.build) this._gainAdrenaline(ab.build);
    if (ab.kind === 'guard') {
      this.braceTicks = ab.guardTicks;
      this.msg('You brace for impact — incoming damage halved!', 'system');
      this.spawnSparkle(this.player, '#7fd8ff', 12);
      this.bus.emit('sfx', 'spec');
    } else if (ab.kind === 'buff') {
      // A class buff: one at a time, a new one replaces the last.
      this.buff = { id: ab.id, name: ab.name, ...ab.buff, until: this.tickCount + (ab.ticks || 10) };
      if (ab.rhythm) { this.danceRhythm = Math.min(RHYTHM_MAX, this.danceRhythm + ab.rhythm); this.bus.emit('rhythm'); }
      if (ab.summon && this.jobClass === 'merchant') for (let k = 0; k < ab.summon; k++) Mercs.spawnFollower(this);
      this.msg(`${ab.name}! ${ab.desc}`, 'system');
      this.addHitsplat(this.player, 0, { text: ab.name });
      this.spawnSparkle(this.player, '#ffd24a', 14);
      this.bus.emit('sfx', 'spec');
    } else if (ab.kind === 'heal') {
      const heal = Math.max(1, Math.round(this.maxHp() * ab.healFrac));
      this.player.hp = Math.min(this.maxHp(), this.player.hp + heal);
      this.msg(`${ab.name} restores ${heal} life.`, 'system');
      this.spawnSparkle(this.player, '#7fff8f', 14);
      this.bus.emit('hp');
      this.bus.emit('sfx', 'eat');
    }
    this.bus.emit('adrenaline');
    this.bus.emit('ability');
  }

  /** Agility's bonus to movement speed, in % (uncapped). */
  agilitySpeed() { return this.skills.agility / AGILITY_SPEED_PER; }
  /** Agility's bonus to attack and casting speed, in %: tapers towards AGILITY_ATK_MAX. */
  agilityAttackSpeed() { const a = this.skills.agility; return AGILITY_ATK_MAX * a / (a + AGILITY_ATK_HALF); }
  /** The player's step time multiplier: the base pace, quickened by Agility. */
  playerStepMul() { return PLAYER_STEP_MUL * 100 / (100 + this.agilitySpeed()); }
  /** Standing on a road or a bridge (walking there is quicker). */
  _onRoad() {
    const t = this.world.terrainAt(this.player.x, this.player.y);
    return t === TERRAIN.PATH || t === TERRAIN.WOOD;
  }

  /** The active buff's value for a key (dmg, haste, crit, lifesteal, reduce, dodge), or 0. */
  buffMod(k) {
    const b = this.buff;
    return b && b.until > this.tickCount ? b[k] || 0 : 0;
  }

  /** Merchant: coins per coin throw (1, +1 per 10 Ranged levels). */
  coinThrowCost() { return 1 + Math.floor(this.skills.ranged / 10); }
  /** Coins a skill costs a Merchant (every skill, instead of adrenaline); 0 for everyone else. */
  abilityCoinCost(ab) {
    return this.jobClass === 'merchant' ? Math.round(ab.cost * COIN_SKILL_MULT * (1 + Math.floor(this.skills.ranged / 100))) : 0;
  }
  canAffordAbility(ab) {
    const coins = this.abilityCoinCost(ab);
    return coins ? this.inventory.count('coins') >= coins : this.adrenaline >= ab.cost;
  }
  abilityCostText(ab) {
    const coins = this.abilityCoinCost(ab);
    if (coins) return `${coins} coins`;
    return ab.cost ? `${ab.cost}% adrenaline` : ab.build ? `free, builds ${ab.build}% adrenaline` : 'free';
  }
  _payAbility(ab) {
    const coins = this.abilityCoinCost(ab);
    if (coins) this.inventory.remove('coins', coins); else this.adrenaline -= ab.cost;
  }

  /** Consume an armed offensive ability for the current hit (spends adrenaline). */
  _takeAbility() {
    if (!this.armedAbility) return null;
    const ab = ABILITY_BY_ID[this.armedAbility];
    this.armedAbility = null;
    if (!ab || ab.kind !== 'attack' || !this.abilityUnlocked(ab) || !this.canAffordAbility(ab) || (this.abilityCd[ab.id] || 0) > 0
        || (ab.mode && ab.mode !== this.combatMode()) || (ab.cls && ab.cls !== this.jobClass)) {
      this.bus.emit('ability');
      return null;
    }
    this._payAbility(ab);
    this.abilityCd[ab.id] = ab.cd;
    if (ab.build) this._gainAdrenaline(ab.build);   // a basic skill builds adrenaline
    this.bus.emit('adrenaline');
    this.bus.emit('ability');
    return ab;
  }

  /** Combined offensive modifiers from an armed special + ability + weakness. */
  _offensiveMods(npc, mode) {
    const spec = this._takeSpec();
    const ab = this._takeAbility();
    const weak = weaknessOf(npc.def) === (mode === 'dance' ? 'melee' : mode);   // whips count as melee for weaknesses
    let dmgM = (spec ? spec.dmg || 1 : 1) * (ab ? ab.dmgMul || 1 : 1) * (weak ? WEAKNESS_BONUS.dmg : 1);
    // Finishers: more damage against a foe already under EXECUTE_BELOW life.
    if (ab?.execute && npc.hp < npc.maxHp * EXECUTE_BELOW) dmgM *= 1 + ab.execute;
    // Race: the weapon in hand bites harder into some races and is shrugged off by others.
    const race = this.raceMatchup(npc);
    if (race === 'strong') dmgM *= RACE_BONUS.dmg;
    else if (race === 'weak') dmgM *= RACE_PENALTY.dmg;
    // Magic casts once (rune cost), so its extra hits are ignored.
    const maxHits = mode === 'magic' ? 1 : Infinity;
    // Passive perks: damage (more against bosses and
    // champions), crit, and a chance of an extra hit (a spell echoes instead).
    const perk = this.perkMods(mode);
    this._perkCtx = perk;
    // Your attacks always land, so gear's armour pierce adds its % as damage;
    // boss damage from gear stacks with the perk's.
    const gb = this.equipment.bonuses();
    dmgM *= 1 + gb.pierce / 100;
    dmgM *= 1 + (this.attrs[attrForMode(mode)] || 0) * DMG_PER_POINT;   // Strength / Intelligence / Dexterity
    dmgM *= 1 + (perk.dmg || 0) + this.learning.perks().dmg +   // English mastery: Eloquence
      ((npc.def.boss || npc.champion) ? (perk.boss || 0) + gb.bossDmg / 100 : 0);
    // Attack bonus % boosts physical damage (melee, ranged, whips); Magic bonus % boosts spells.
    dmgM *= 1 + (mode === 'magic' ? gb.magPct : gb.atkPct) / 100;
    dmgM *= this._volley || 1;   // a volley of very fast attacks lands as one big hit
    dmgM *= 1 + this.buffMod('dmg');   // a class buff
    const bonusHit = Math.random() < (perk.extra || 0);
    perk._echo = mode === 'magic' && bonusHit;
    const hits = Math.min(maxHits, Math.max(spec ? spec.hits || 1 : 1, ab ? ab.hits || 1 : 1)) + (bonusHit && mode !== 'magic' ? 1 : 0);
    const guaranteed = !!(ab && ab.guaranteed);
    const heal = (spec ? spec.heal || 0 : 0) || (ab ? ab.lifesteal || 0 : 0);
    // Class ability extras: a wider cleave, a stun once the hit
    // lands, a brace afterwards, and (Merchant) A-Worthlings called up.
    this._abCleave = ab?.cleave || 1;
    this._abStun = ab?.stun && mode !== 'dance' ? ab.stun : 0;   // the Dancer's whip handles its own stun
    if (ab?.guard) this.braceTicks = Math.max(this.braceTicks || 0, ab.guard);
    if (ab?.summon && this.jobClass === 'merchant') for (let k = 0; k < ab.summon; k++) Mercs.spawnFollower(this);
    if (spec) { this.msg(`Special attack: ${spec.name}!`, 'combat'); this.spawnSparkle(this.player, '#ffd24a', 12); }
    if (ab) { this.msg(`Ability: ${ab.name}!`, 'combat'); this.spawnSparkle(this.player, '#ff9a3a', 10); this.bus.emit('sfx', 'spec'); }
    if (weak) this.spawnSparkle(npc, '#9affd0', 6);
    if (race === 'strong') this.spawnSparkle(npc, '#ffd24a', 5);
    // Say it once per foe: an "Effective!" pop the first time your weapon bites, or "Resisted".
    if (race && npc._raceSaid !== race + (this._castElement || '')) {
      npc._raceSaid = race + (this._castElement || '');
      const el = this._castElement ? `${ELEMENTS[this._castElement].name}: ` : '';
      this.addHitsplat(npc, 0, { text: el + (race === 'strong' ? 'Effective!' : 'Resisted') });
    }
    const lvl = mode === 'ranged' ? this.skills.ranged : mode === 'magic' ? this.skills.magic : mode === 'dance' ? this.skills.agility : this.skills.attack;
    // A `crit` ability makes every one of its hits a critical.
    const critCh = ab?.crit ? 1 : critChance(lvl, this.equipment.bonuses().crit) + (perk.crit || 0) + this.learning.perks().crit + this.buffMod('crit')
      + (mode === 'magic' ? (this.attrs.int || 0) * CRIT_PER_INT : 0);   // Intelligence
    this._abAoe = ab?.aoe || 0;   // an ultimate's area: everything this close to the target is hit too
    return { dmgM, hits, guaranteed, heal, spec, ability: ab, weak, race, critCh };
  }

  /** The type of the weapon in hand ('dagger', 'longbow', ...), or null bare-handed. */
  weaponType() {
    const w = this.equipment.get('weapon');
    return (w && getItem(w).equip?.weaponType) || null;
  }

  /** How the weapon in hand fares against this foe's race: 'strong', 'weak' or null. */
  raceMatchup(npc) {
    // Spells are judged by their element (fire, water...) rather than by the staff.
    if (this._castElement) return elementMatchup(this._castElement, raceOf(npc.def, npc.npcId));
    return matchup(this.weaponType(), raceOf(npc.def, npc.npcId));
  }

  /** Roll a critical hit on a landed blow: crits multiply damage by CRIT_MULT. */
  /** Time until the next attack. A cooldown that doesn't land on a whole beat
   *  keeps its leftover (never banking more than one beat), so fractional speeds
   *  from quick weapons and haste really are faster. */
  /** Combat beats between attacks in the current style, with no floor: the
   *  weapon's speed (attack speed % included), and for spells half that (spells
   *  come off quicker than a swing) times the element's cast speed. */
  attackInterval(spell = null) {
    // A class buff's attack speed and Agility's speed bonus, on top of gear.
    const ws = this.equipment.weaponSpeed() * 100 / (100 + this.buffMod('haste')) * 100 / (100 + this.agilityAttackSpeed())
      * 100 / (100 + (this.attrs?.dex || 0) * SPEED_PER_DEX);   // Dexterity
    if (this.combatMode() !== 'magic') return ws;
    const sp = spell || getSpell(this.player.spell);
    return ws * 0.5 * (ELEMENTS[sp.element]?.castSpeed || 1);
  }

  _resetCooldown(speed) {
    const p = this.player;
    speed *= this._volley || 1;   // a volley takes the time of all the attacks it stands for
    p.attackCooldown = Math.max(-1, Math.min(0, p.attackCooldown || 0)) + speed;
  }

  _critHit(dmg, critCh) {
    // A crit doubles the blow, or (one time in four) quadruples it; crit damage
    // from gear adds on top. The next hitsplat shows it big and red.
    this._pendingCrit = 0;
    this._aoeCritCh = critCh;   // area hits that follow roll their own crits at this chance
    if (dmg > 0 && Math.random() < critCh) {
      const mult = Math.random() < MEGA_CRIT_CHANCE ? MEGA_CRIT_MULT : CRIT_MULT;
      this._pendingCrit = mult;
      return { dmg: Math.max(dmg + 1, Math.round(dmg * (mult + this.equipment.bonuses().critDmg / 100))), crit: true, mult };
    }
    return { dmg, crit: false, mult: 1 };
  }

  /** An area hit (cleave, splash, ricochet) rolls its own crit at the main
   *  attack's crit chance: returns the damage and the hitsplat's ×2 / ×4 tag. */
  _aoeCrit(dmg) {
    if (dmg > 0 && Math.random() < (this._aoeCritCh || 0)) {
      const mult = Math.random() < MEGA_CRIT_CHANCE ? MEGA_CRIT_MULT : CRIT_MULT;
      return { dmg: Math.max(dmg + 1, Math.round(dmg * (mult + this.equipment.bonuses().critDmg / 100))), critX: mult };
    }
    return { dmg, critX: 0 };
  }

  _applyPlayerHit(npc, dmg, opts = {}) {
    // A stunning class ability: the foe reels once the blow lands.
    if (this._abStun && dmg > 0) {
      const t = this._abStun; this._abStun = 0;
      npc.windup = 0; npc.attackCooldown = Math.max(npc.attackCooldown || 0, t * 2);
      this.addHitsplat(npc, 0, { text: 'Stunned!' });
    }
    // A crit rolled just before this hit: show it as a big red ×2 / ×4 number.
    if (this._pendingCrit && dmg > 0) {
      opts = { ...opts, critX: this._pendingCrit };
      // Brawlers (claw fighters) rake the foe: three bloody swipe marks across it on every crit.
      if (this.jobClass === 'brawler') this.effects.push({ type: 'swipe', entity: npc, mega: this._pendingCrit >= 4, ang: (Math.random() - 0.5) * 0.5, life: 520, maxLife: 520 });
    }
    const wasCrit = this._pendingCrit > 0 && dmg > 0;
    this._pendingCrit = 0;
    if (npc.shieldTicks > 0 && dmg > 0) dmg = Math.max(1, Math.floor(dmg / 2));   // a boss shield halves the blow
    if (npc.reflectTicks > 0 && dmg > 0 && this.player.alive) {
      const back = Math.min(this.player.hp, Math.max(1, Math.round(dmg * (npc.reflectFrac || 0.2))), Math.ceil(this.maxHp() * 0.1));
      this.player.takeDamage(back);
      this.addHitsplat(this.player, back, { tint: '#f5b82e' });
      this.bus.emit('hp');
      if (this.player.hp <= 0) this.playerDeath();
    }
    npc.takeDamage(dmg);
    // Lifesteal from gear: heal a share of the damage dealt.
    // Lifesteal heals in your own life's units: a hit on a big monster counts at its real size.
    const realDmg = dmg * (npc.def?.hpScale || 1);
    const ls = dmg > 0 ? this.equipment.bonuses().lifesteal + this.buffMod('lifesteal') * 100 : 0;
    if (ls && this.player.alive && this.player.hp < this.maxHp()) {
      this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.max(1, Math.round(realDmg * ls / 100)));
      this.bus.emit('hp');
    }
    const perk = this._perkCtx;
    if (perk && dmg > 0) {
      this._lastHitDmg = dmg;
      if (perk.lifesteal) { const p = this.player; const heal = Math.max(1, Math.round(realDmg * perk.lifesteal)); if (p.hp < this.maxHp()) { p.hp = Math.min(this.maxHp(), p.hp + heal); this.bus.emit('hp'); } }
      if (perk.stun && npc.hp > 0 && Math.random() < perk.stun) { npc.windup = 0; npc.attackCooldown = Math.max(npc.attackCooldown || 0, 3); this.addHitsplat(npc, 0, { text: 'Stunned!' }); }
    }
    if (dmg > 0) this._knock(npc, this.player);
    // Effective blows land in gold, resisted ones in grey (unless something else tints them).
    const rm = dmg > 0 && !opts.tint ? this.raceMatchup(npc) : null;
    if (rm) opts = { ...opts, tint: rm === 'strong' ? '#f5b82e' : '#9aa3b2' };
    this.addHitsplat(npc, dmg, opts);
    if (dmg > 0) {
      this.bus.emit('sfx', 'hit'); this._hitAdrenaline(wasCrit);
      // A running average of your landed hits, so auto battle can tell when a
      // foe is about to drop and hold its big skills back.
      this._autoHitAvg = this._autoHitAvg ? this._autoHitAvg * 0.8 + dmg * 0.2 : dmg;
    }
  }
  _postAttack(npc) {
    const perk = this._perkCtx;
    if (perk && this._lastHitDmg > 0) {
      // Spell Echo: the spell lands a second time.
      if (perk._echo && npc.hp > 0) { const d = this._lastHitDmg; npc.takeDamage(d); this.addHitsplat(npc, d, { tint: '#9a52ad' }); this.spawnSparkle(npc, '#c890f0', 6); }
      // Cleave / Multishot / Chain Spell / Spin: a share of the hit lands on another monster nearby.
      if (perk.splash && Math.random() < perk.splash) this._perkSplash(npc, Math.max(1, Math.round(this._lastHitDmg * 0.6)));
    }
    this._lastHitDmg = 0;
    this._perkCtx = null;
    if (!npc.target) npc.target = this.player; // provoke retaliation
    if (npc.hp <= 0) { this.killNpc(npc); this.player.clearAction(); }
  }

  /** A monster is winding up a heavy blow — flash a warning the player can react to. */
  npcTelegraph(npc) {
    this.spawnSparkle(npc, '#ff5a5a', 8);
    this.bus.emit('sfx', 'spec');
    if ((npc.def.level || 0) >= 30) this.msg(`${npc.name} is winding up a heavy attack — Brace yourself!`, 'combat');
  }

  /** Most arrows are picked back up after a fight: only ~1 in 5 shots uses one up. */
  _spendArrow(idx) { if (Math.random() >= ARROW_RECOVERY && Math.random() >= (this.perkMods('ranged').arrowSave || 0)) this.inventory.removeAt(idx, 1); }

  /** Out of arrows or runes: say so once in a while, not on every retaliation. */
  _outOfAmmo(text) {
    if (this.tickCount - (this._ammoSaidAt ?? -99) < 15) return;
    this._ammoSaidAt = this.tickCount;
    this.msg(text);
  }

  /** The Dancer's whip: a lash that reaches 3 tiles. Landed lashes build Rhythm
   *  (more damage per stack); a miss or a pause lets it fade. Sweeping abilities
   *  lash every monster within reach, and Crack stuns. */
  _danceAttack(npc) {
    const p = this.player, style = p.danceStyle;
    const pm = this.prayerMult();
    const mods = this._offensiveMods(npc, 'dance');
    const fancy = mods.spec || mods.ability;
    this._swingToward(p, npc.x, npc.y);
    this.bus.emit('sfx', 'swish');
    const range = this.attackRange();
    const targets = mods.ability?.sweep
      ? [npc, ...this.nearbyNpcs().filter((n) => n !== npc && n.alive && n.attackable && !n.temporary && n.hp > 0 && chebyshev(p.x, p.y, n.x, n.y) <= range)]
      : [npc];
    let total = 0, raw = 0;   // raw: the main target's damage before crits, for the ricochet
    for (const t of targets) {
      const { max } = playerDanceVsNpc(this.skills, this.equipment, style, t.def, this.danceRhythm);
      this._lash(t, fancy ? '#ffd24a' : '#ff8ac0');
      for (let i = 0; i < mods.hits && t.hp > 0; i++) {
        const effMax = Math.max(1, Math.round(max * pm.str * mods.dmgM));
        let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollHit(effMax);
        if (t === npc) raw += dmg;
        const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
        this._applyPlayerHit(t, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
        if (dmg > 0) {
          this.spawnHitSparks(t, (c.crit || fancy) ? '#ffd24a' : '#ffb0d8');
          for (const x of combatXpDance(style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
          this.danceRhythm = Math.min(RHYTHM_MAX, this.danceRhythm + 1);
        } else if (t === npc) this.danceRhythm = 0;
        total += dmg;
      }
      if (mods.ability?.stun && t.hp > 0) {   // Crack: the monster reels and can't strike back for a moment
        t.windup = 0; t.attackCooldown = Math.max(t.attackCooldown || 0, mods.ability.stun * 2);
        this.addHitsplat(t, 0, { text: 'Stunned!' });
      }
      if (!t.target) t.target = p;
      if (t !== npc && t.hp <= 0) this.killNpc(t);
    }
    // A whip that lands ricochets on from the target to the monsters near it
    // (a sweep already lashes everyone in reach, so it doesn't bounce).
    if (raw > 0 && !mods.ability?.sweep) this._whipRicochet(npc, raw, mods.ability?.chain, mods.ability?.stun);
    if (mods.ability?.rhythm) this.danceRhythm = Math.min(RHYTHM_MAX, this.danceRhythm + mods.ability.rhythm);
    this._danceHitTick = this.tickCount;
    if (this.danceRhythm >= RHYTHM_MAX && total > 0) this.spawnSparkle(p, '#ff8ac0', 4);
    if (mods.heal && total > 0) { p.hp = Math.min(this.maxHp(), p.hp + Math.round(total * mods.heal * (npc.def?.hpScale || 1))); this.bus.emit('hp'); }
    this._resetCooldown(this.attackInterval());
    this.bus.emit('rhythm');
    this._postAttack(npc);
  }

  /** A sniper round goes straight through: every monster on the line from you
   *  through the target, up to RIFLE_PIERCE_TILES tiles past it, takes the same
   *  hit (rolling its own crit), with Ranged XP. */
  _riflePierce(target, raw, style) {
    const p = this.player;
    const dx = target.x - p.x, dy = target.y - p.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const m = this.combatXpMult();
    for (const o of this.nearbyNpcs()) {
      if (o === target || !o.alive || !o.attackable || o.ally || o.hp <= 0) continue;
      if (o.def.fixed && o.target !== p) continue;   // story bosses aren't dragged in
      const ox = o.x - p.x, oy = o.y - p.y;
      const along = ox * ux + oy * uy;                // how far down the line
      const off = Math.abs(ox * uy - oy * ux);        // how far to the side of it
      if (along < len - RIFLE_PIERCE_WIDTH || along > len + RIFLE_PIERCE_TILES || off > RIFLE_PIERCE_WIDTH + 0.5) continue;
      const c = this._aoeCrit(raw);
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      this.addHitsplat(o, d, { tint: '#ffe28a', critX: c.critX });
      this.spawnHitSparks(o, '#ffe28a');
      for (const x of combatXpRanged(style, d)) this.skills.addXp(x.skill, x.xp * m);
      if (!o.target) o.target = p;
      if (o.hp <= 0) this.killNpc(o);
    }
    // The tracer carries on past the target.
    const from = target.renderCenter();
    const life = 160;
    this.effects.push({ type: 'projectile', kind: 'bullet', x: from.x, y: from.y - 8,
      ex: from.x + ux * RIFLE_PIERCE_TILES * TILE, ey: from.y - 8 + uy * RIFLE_PIERCE_TILES * TILE, color: '#fff2b0', life, maxLife: life, arc: 0 });
  }

  /** An ultimate's area: every other monster within `radius` tiles of the target
   *  takes the same damage (before crits; each rolls its own), with XP. */
  _abilityAoe(target, raw, mode) {
    const r = this._abAoe; this._abAoe = 0;
    if (!r || raw <= 0) return;
    const p = this.player, m = this.combatXpMult();
    for (const o of this.nearbyNpcs()) {
      if (o === target || !o.alive || !o.attackable || o.ally || o.hp <= 0) continue;
      if (o.def.fixed && o.target !== p) continue;   // story bosses aren't dragged in
      if (chebyshev(o.x, o.y, target.x, target.y) > r) continue;
      const c = this._aoeCrit(raw);
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      this.addHitsplat(o, d, { tint: '#ffb347', critX: c.critX });
      this.spawnHitSparks(o, '#ffd9a0');
      const xp = mode === 'ranged' ? combatXpRanged(p.style, d) : mode === 'magic'
        ? magicXp(d) : mode === 'dance' ? combatXpDance(p.danceStyle, d) : combatXp(p.style, d);
      for (const x of xp) this.skills.addXp(x.skill, x.xp * m);
      if (!o.target) o.target = p;
      if (o.hp <= 0) this.killNpc(o);
    }
    this.addShake(3, 200);
  }

  /** Whip ricochet: the lash snaps on from monster to monster (each within 3
   *  tiles of the last), 2 bounces normally and 3 at full Rhythm, each for 60%
   *  of the hit and rolling its own crit. Chain Crack bounces further and stuns. */
  _whipRicochet(from, raw, chain = 0, stun = 0) {
    const p = this.player;
    const bounces = chain || (DANCE_RICOCHET + (this.danceRhythm >= RHYTHM_MAX ? 1 : 0));
    const hit = new Set([from]);
    let prev = from;
    for (let k = 0; k < bounces; k++) {
      let next = null, bd = Infinity;
      for (const n of this.nearbyNpcs()) {
        if (hit.has(n) || !n.alive || !n.attackable || n.ally || n.temporary || n.hp <= 0) continue;
        if (n.def.fixed && n.target !== p) continue;   // story bosses aren't dragged in
        const d = chebyshev(n.x, n.y, prev.x, prev.y);
        if (d <= 3 && d < bd) { bd = d; next = n; }
      }
      if (!next) break;
      hit.add(next);
      const c = this._aoeCrit(Math.max(1, Math.round(raw * RICOCHET_SHARE)));
      const d = Math.min(next.hp, c.dmg);
      this._lash(next, '#ff8ac0', prev);
      next.takeDamage(d);
      this.addHitsplat(next, d, { tint: '#ff8ac0', critX: c.critX });
      this.spawnHitSparks(next, '#ffb0d8');
      for (const x of combatXpDance(p.danceStyle, d)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
      if (stun && next.hp > 0) { next.windup = 0; next.attackCooldown = Math.max(next.attackCooldown || 0, stun * 2); this.addHitsplat(next, 0, { text: 'Stunned!' }); }
      if (!next.target) next.target = p;
      if (next.hp <= 0) this.killNpc(next);
      prev = next;
    }
  }

  /** Melee cleave: up to 3 other foes next to the target take a share of the hit. */
  _cleave(target, dmg) {
    const type = this.weaponType();
    // A class ability can widen the sweep for this one hit.
    const share = Math.min(1, (CLEAVE_SHARE[type] || 0) * (this._abCleave || 1));
    this._abCleave = 1;
    if (!share) return;
    let n = 0;
    for (const o of this.nearbyNpcs()) {
      if (n >= 3) break;
      if (o === target || !o.alive || !o.attackable || o.temporary || o.hp <= 0) continue;
      if (o.def.fixed && o.target !== this.player) continue;     // story bosses aren't dragged in
      if (chebyshev(o.x, o.y, target.x, target.y) > 1 || chebyshev(o.x, o.y, this.player.x, this.player.y) > this.attackRange() + 1) continue;
      const c = this._aoeCrit(Math.max(1, Math.round(dmg * share)));
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      // Cleave damage earns combat XP like any other hit.
      for (const x of combatXp(this.player.style, d)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
      this.addHitsplat(o, d, { tint: '#ffb347', critX: c.critX });
      this.spawnHitSparks(o, '#ffd9a0');
      if (!o.target) o.target = this.player;
      if (o.hp <= 0) this.killNpc(o);
      n++;
    }
    if (n) this._slash(target, '#ffb347');
  }

  _perkSplash(from, dmg) {
    const other = this.nearbyNpcs().find((n) => n !== from && n.alive && n.attackable && !n.temporary && n.hp > 0 && chebyshev(n.x, n.y, from.x, from.y) <= 3);
    if (!other) return;
    const c = this._aoeCrit(dmg); dmg = c.dmg;
    other.takeDamage(dmg);
    this.addHitsplat(other, dmg, { tint: '#f5b82e', critX: c.critX });
    this.spawnHitSparks(other, '#ffe89a');
    if (!other.target) other.target = this.player;
    if (other.hp <= 0) this.killNpc(other);
  }

  /** A whip crack: a wavy line from the hero's hand to the target. */
  _lash(npc, color, src = null) {
    // From the hero's hand, or (a ricochet) from the last monster the whip hit.
    const from = (src || this.player).renderCenter(), to = npc.renderCenter();
    const off = src ? 0 : (to.x >= from.x ? 8 : -8);
    this.effects.push({ type: 'lash', x: from.x + off, y: from.y - (src ? 8 : 4), ex: to.x, ey: to.y - 8, color, life: 260, maxLife: 260 });
  }

  /** The backpack slot holding your strongest arrows (highest arrow strength),
   *  so better arrows are always fired first; -1 when you have none. */
  _bestAmmoIdx() {
    let best = -1, bs = -1;
    this.inventory.slots.forEach((sl, i) => {
      if (!sl || !getItem(sl.id).tags?.includes('ammo')) return;
      const st = getItem(sl.id).arrowStr || 0;
      if (st > bs) { bs = st; best = i; }
    });
    return best;
  }

  _rangedAttack(npc) {
    // Pistols and shurikens need no ammo; their power comes from the weapon itself.
    const wpn = getItem(this.equipment.get('weapon')).equip;
    const noAmmo = !!wpn.noAmmo;
    const arrowIdx = noAmmo ? -1 : this._bestAmmoIdx();
    if (!noAmmo && arrowIdx === -1) { this._outOfAmmo('You have no arrows left.'); this.player.clearAction(); return; }
    const arrowStr = noAmmo ? Math.floor((wpn.bonuses.ranged || 0) / 3) : getItem(this.inventory.slotAt(arrowIdx).id).arrowStr || 0;
    // A Merchant's cane throws money: every throw (a volley counts in full) costs coins.
    if (wpn.coins) {
      const cost = Math.ceil(this.coinThrowCost() * (this._volley || 1));
      if (this.inventory.count('coins') < cost) { this._outOfAmmo(`You need ${cost} coins to throw.`); this.player.clearAction(); return; }
      this.inventory.remove('coins', cost);
    }
    // A Merchant's every throw may call up an A-Worthling (a mirror image).
    if (this.jobClass === 'merchant') Mercs.onMerchantAttack(this);
    const shot = this._shotKind(wpn);
    const tint = wpn.coins ? '#f5b82e' : wpn.weaponType === 'pistol' ? '#ffe28a' : wpn.weaponType === 'shuriken' ? '#cfd8e6' : '#d9c45a';
    const style = this.player.rangedStyle;
    const { max } = playerRangedVsNpc(this.skills, this.equipment, style, npc.def, arrowStr);
    const pr = this.prayerMult().ranged;
    // Longbows fire half as often as shortbows but each arrow hits 60% harder.
    const baseMax = Math.round(max * pr * (wpn.weaponType === 'longbow' ? LONGBOW_DMG : wpn.weaponType === 'rifle' ? RIFLE_DMG : 1));
    const mods = this._offensiveMods(npc, 'ranged');
    const fancy = mods.spec || mods.ability;
    this._swingToward(this.player, npc.x, npc.y);
    let total = 0, raw = 0;   // raw: before crits, for the ricochet
    for (let i = 0; i < mods.hits && npc.hp > 0; i++) {
      if (noAmmo) { /* nothing to spend */ } else if (i > 0) { // extra shots consume extra arrows
        const ai = this._bestAmmoIdx();
        if (ai === -1) break;
        this._spendArrow(ai);
      } else { this._spendArrow(arrowIdx); }
      const effMax = Math.max(1, Math.round(baseMax * mods.dmgM));
      let dmg = mods.guaranteed ? rollGuaranteed(effMax)
        : wpn.weaponType === 'rifle' ? randInt(Math.max(1, Math.floor(effMax / 4)), effMax)   // sniper rounds always land
        : rollHit(effMax);
      raw += dmg;
      const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
      this._projectile(npc, (c.crit || fancy) ? '#ffd24a' : tint, shot, mods.hits > 1 ? i - (mods.hits - 1) / 2 : 0);
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
      if (dmg > 0) { this.spawnHitSparks(npc, (c.crit || fancy) ? '#ffd24a' : '#cfe0a0'); for (const x of combatXpRanged(style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult()); }
      total += dmg;
    }
    // Dual pistols: the off-hand fires too (60% power).
    if (this.equipment.isDualWielding() && npc.hp > 0) {
      const offMax = Math.max(1, Math.round(baseMax * 0.6));
      let dmg = rollHit(offMax);
      this._projectile(npc, '#fff2b0', shot, 0.6);
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && dmg >= offMax });
      if (dmg > 0) for (const x of combatXpRanged(style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
      total += dmg;
    }
    // Shurikens ricochet off the target into one more foe nearby (60% of the hit).
    if (wpn.weaponType === 'shuriken' && total > 0) {
      const p = this.player;
      const o = this.nearbyNpcs().find((n) => n !== npc && n.alive && n.attackable && !n.temporary && n.hp > 0
        && chebyshev(n.x, n.y, npc.x, npc.y) <= 3 && chebyshev(n.x, n.y, p.x, p.y) <= this.attackRange() + 3
        && !(n.def.fixed && n.target !== p));
      if (o) {
        const c = this._aoeCrit(Math.max(1, Math.round(raw * 0.6)));
        const d = Math.min(o.hp, c.dmg);
        o.takeDamage(d);
        this.addHitsplat(o, d, { tint: '#cfd8e6', critX: c.critX });
        for (const x of combatXpRanged(style, d)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
        if (!o.target) o.target = p;
        if (o.hp <= 0) this.killNpc(o);
      }
    }
    if (mods.heal && total > 0) { this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.round(total * mods.heal * (npc.def?.hpScale || 1))); this.bus.emit('hp'); }
    this._abilityAoe(npc, raw, 'ranged');
    if (wpn.weaponType === 'rifle' && raw > 0) this._riflePierce(npc, raw, style);
    this._mainCritCh = mods.critCh;   // split-shot arrows crit like the main shot
    if (this.skills.ranged >= SPLIT_SHOT_LEVEL) this._splitShot(npc, style, pr);
    // Shots come as fast as the weapon and attack speed % allow (no floor).
    this._resetCooldown(this.attackInterval());
    this._postAttack(npc);
  }

  /** Split shot (Ranged 300+): each shot also looses an arrow at up to two other
   *  monsters in reach, nearest first, so three targets are hit at once. */
  _splitShot(main, style, pr) {
    const p = this.player, range = this.attackRange();
    const extra = this.nearbyNpcs()
      .filter((n) => n !== main && n.alive && n.attackable && !n.temporary && n.hp > 0 && chebyshev(p.x, p.y, n.x, n.y) <= range)
      .sort((a, b) => chebyshev(p.x, p.y, a.x, a.y) - chebyshev(p.x, p.y, b.x, b.y))
      .slice(0, SPLIT_SHOT_TARGETS - 1);
    const wpn = getItem(this.equipment.get('weapon')).equip;
    for (const n of extra) {
      let arrowStr = Math.floor((wpn.bonuses.ranged || 0) / 3);
      if (!wpn.noAmmo) {
        const ai = this._bestAmmoIdx();
        if (ai === -1) break;
        arrowStr = getItem(this.inventory.slotAt(ai).id).arrowStr || 0;
        this._spendArrow(ai);
      }
      const { max } = playerRangedVsNpc(this.skills, this.equipment, style, n.def, arrowStr);
      const effMax = Math.max(1, Math.round(max * pr));
      let dmg = rollHit(effMax);
      const c = this._critHit(dmg, this._mainCritCh || 0); dmg = c.dmg;
      this._projectile(n, '#9fe0ff', this._shotKind(wpn), 0);
      this._applyPlayerHit(n, dmg, { crit: dmg > 0 && (c.crit || dmg >= effMax) });
      if (dmg > 0) { this.spawnHitSparks(n, '#9fe0ff'); for (const x of combatXpRanged(style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult()); }
      if (!n.target) n.target = p;
      if (n.hp <= 0) this.killNpc(n);
    }
  }

  /** The strongest spell you can cast right now (level and runes), or null. */
  bestSpell() {
    for (let i = SPELLS.length - 1; i >= 0; i--) {
      const sp = SPELLS[i];
      if (this.skills.magic >= sp.level && this._hasRunes(sp)) return sp;
    }
    return null;
  }

  /** Every spell is an area attack: each other monster within AOE_RADIUS tiles
   *  of the target takes the same damage (100%), and it all earns Magic XP. */
  _spellSplash(target, dmg, spell) {
    const p = this.player;
    const radius = ELEMENTS[spell.element]?.aoeRadius || AOE_RADIUS;   // Earth's Quake reaches further
    let xp = 0;
    for (const o of this.nearbyNpcs()) {
      if (o === target || !o.alive || !o.attackable || o.ally || o.hp <= 0) continue;
      if (o.def.fixed && o.target !== p) continue;   // story bosses aren't dragged in
      if (chebyshev(o.x, o.y, target.x, target.y) > radius) continue;
      const c = this._aoeCrit(dmg);
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      this.addHitsplat(o, d, { tint: spell.tint, critX: c.critX });
      if (ELEMENTS[spell.element]?.slowTicks) this._slowFoe(o, ELEMENTS[spell.element].slowTicks);
      if (ELEMENTS[spell.element]?.ignite && d > 0) this._igniteFoe(o, d, ELEMENTS[spell.element].ignite);
      this.spawnHitSparks(o, spell.tint);
      xp += d;
      if (!o.target) o.target = p;
      if (o.hp <= 0) this.killNpc(o);
    }
    // Splash damage earns XP like any other hit, XP bonuses included.
    const m = this.combatXpMult();
    if (xp) for (const x of magicXp(xp)) this.skills.addXp(x.skill, x.xp * m);
  }

  _magicAttack(npc) {
    let spell = getSpell(this.player.spell);
    // Can't cast the chosen spell (level or runes)? Fall back to the best one you can.
    if (this.skills.magic < spell.level || !this._hasRunes(spell)) {
      const alt = this.bestSpell();
      if (!alt) { this._outOfAmmo(`You don't have the runes to cast ${spell.name}.`); this.player.clearAction(); return; }
      spell = alt;
    }
    this._consumeRunes(spell, npc);
    const { max } = playerMagicVsNpc(this.skills, this.equipment, spell, npc.def);
    this._castElement = spell.element;   // the element decides what this spell is strong or weak against
    const mods = this._offensiveMods(npc, 'magic');
    this._castElement = null;
    const fancy = mods.spec || mods.ability;
    const effMax = Math.max(1, Math.round(max * mods.dmgM));
    let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollHit(effMax);
    const raw = dmg;   // the splash rolls its own crits
    const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
    this._swingToward(this.player, npc.x, npc.y);
    this._projectile(npc, (c.crit || fancy) ? '#e0a0ff' : spell.tint, 'bolt');
    this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
    this.skills.addXp('magic', spell.xp * this.combatXpMult());
    if (dmg > 0) { const m = this.combatXpMult(); this.spawnHitSparks(npc, spell.tint); for (const x of magicXp(dmg)) this.skills.addXp(x.skill, x.xp * m); }
    if (dmg > 0) this._spellSplash(npc, raw, spell);
    this._abilityAoe(npc, raw, 'magic');
    const el = ELEMENTS[spell.element] || {};
    if (dmg > 0 && el.slowTicks) this._slowFoe(npc, el.slowTicks);   // Water's Tide
    if (dmg > 0 && el.ignite) this._igniteFoe(npc, dmg, el.ignite);   // Fire's Ignite
    // Spells come off at half the weapon's swing time (wands quicker than staves); Wind and Water quicker still.
    this._resetCooldown(this.attackInterval(spell));
    this._postAttack(npc);
  }

  /** Fire's Ignite: every hit adds its own burn, `share` of that hit every
   *  second, for as long as the foe lives. Burns stack without limit, so they
   *  are kept as one running total per foe: any number of stacks costs the same. */
  _igniteFoe(npc, hit, { share }) {
    if (!npc.alive || npc.hp <= 0) return;
    const ig = npc.ignite || (npc.ignite = { acc: 0, perSec: 0, critCh: 0 });
    ig.perSec += Math.max(1, Math.round(hit * share));
    ig.critCh = this._aoeCritCh || 0;   // every burn tick can crit, at the casting spell's crit chance
  }

  /** Burning foes near the player take all their burns' damage once a second
   *  (with Magic XP, like any spell damage) until they die. Called every tick. */
  _tickIgnites() {
    const p = this.player, m = this.combatXpMult();
    let xp = 0;
    for (const n of this.nearbyNpcs()) {
      const ig = n.ignite;
      if (!ig) continue;
      if (!n.alive || n.hp <= 0) { n.ignite = null; continue; }
      // Like the rest of the world, foes far from the player wait (still alight) until you return.
      if (Math.abs(n.x - p.x) > 46 || Math.abs(n.y - p.y) > 46) continue;
      ig.acc += TICK_MS / 1000;
      while (ig.acc >= 1 && n.hp > 0) {
        ig.acc -= 1;
        // Each tick rolls its own crit (x2, or x4 on a mega crit, plus gear crit damage).
        const saved = this._aoeCritCh; this._aoeCritCh = ig.critCh || 0;
        const c = this._aoeCrit(ig.perSec);
        this._aoeCritCh = saved;
        const d = Math.min(n.hp, c.dmg);
        n.takeDamage(d);
        this.addHitsplat(n, d, { tint: '#ff8a3d', critX: c.critX });
        this.spawnSparkle(n, '#ff9a4a', 3);
        xp += d;
        if (!n.target) n.target = p;
        if (n.hp <= 0) { this.killNpc(n); n.ignite = null; }
      }
    }
    if (xp) for (const x of magicXp(xp)) this.skills.addXp(x.skill, x.xp * m);
  }

  /** Water's Tide: the foe moves and attacks slower for a few ticks (see NPC.slowTicks). */
  _slowFoe(npc, ticks) {
    if (!npc.alive || npc.hp <= 0) return;
    if (!npc.slowTicks) { npc._baseStepMul = npc.stepMul; npc.stepMul = npc.stepMul * 1.6; this.spawnSparkle(npc, '#9fe6ff', 4); }
    npc.slowTicks = Math.max(npc.slowTicks || 0, ticks);
  }

  /** The rune an equipped elemental staff supplies without limit (or null). */
  freeRune() {
    const w = this.equipment.get('weapon');
    return (w && getItem(w).equip?.runes) || null;
  }
  _hasRunes(spell) { const free = this.freeRune(); return Object.entries(spell.runes).every(([id, q]) => id === free || this.inventory.count(id) >= q); }
  _consumeRunes(spell, npc = null) {
    if (Math.random() < (this.perkMods('magic').runeSave || 0)) return;   // Rune Saver perk
    const free = this.freeRune();
    for (const [id, q] of Object.entries(spell.runes)) {
      if (id === free) continue;
      this.inventory.remove(id, q);
      // Remember what each monster cost you, for the rune refund when it falls.
      if (npc) { npc._runesSpent = npc._runesSpent || {}; npc._runesSpent[id] = (npc._runesSpent[id] || 0) + q; }
    }
  }

  /** Rune refund: a monster you kill with spells gives back every rune you spent
   *  on it, so casting pays for itself (rune drops come on top). Runes go into
   *  the pack, or onto the ground if there's no room. */
  _refundRunes(npc) {
    const spent = npc._runesSpent;
    if (!spent) return;
    npc._runesSpent = null;
    let total = 0;
    for (const [id, q] of Object.entries(spent)) {
      if (q <= 0) continue;
      total += q;
      if (!this.inventory.add(id, q)) this.world.addGroundItem(id, q, npc.x, npc.y);
    }
    if (total) this.msg(`Rune refund: ${total} rune${total > 1 ? 's' : ''} back from the ${npc.name}.`, 'system');
  }

  /** Alchemy (Magic 21): 1 nature + 5 fire runes turn an item into 60% of its value in coins. */
  alchemyValue(id) { return Math.max(1, Math.floor((getItem(id).value || 0) * 0.6)); }
  alchemise(index) {
    const s = this.inventory.slotAt(index);
    if (!s || s.id === 'coins') return false;
    const item = getItem(s.id);
    if (!item.value || item.tags?.includes('rune')) { this.msg("That can't be turned into coins."); return false; }
    if (this.skills.magic < ALCHEMY.level) { this.msg(`You need Magic level ${ALCHEMY.level} to cast Alchemy.`); return false; }
    if (!this._hasRunes(ALCHEMY)) { this.msg('Alchemy needs 1 nature rune and 5 fire runes.'); return false; }
    this._consumeRunes(ALCHEMY);
    const coins = this.alchemyValue(s.id);
    this.inventory.removeAt(index, 1);
    this.inventory.add('coins', coins);
    this.skills.addXp('magic', ALCHEMY.xp);
    this.spawnSparkle(this.player, '#F5B82E', 12);
    this.bus.emit('sfx', 'spec');
    this.msg(`Alchemy turns your ${item.name.toLowerCase()} into ${coins} coins.`, 'system');
    return true;
  }

  /** Knock a struck entity briefly away from whoever hit it. */
  _knock(victim, from) {
    const a = victim.renderCenter(), b = from.renderCenter();
    const dx = a.x - b.x, dy = a.y - b.y, m = Math.hypot(dx, dy) || 1;
    victim.knockDX = dx / m; victim.knockDY = dy / m; victim.knock = 160;
  }

  /** What a ranged weapon fires: only bows loose arrows; pistols fire bullets
   *  and Ninjas throw spinning shurikens. */
  _shotKind(wpn) {
    return wpn?.coins ? 'coin' : wpn?.weaponType === 'pistol' || wpn?.weaponType === 'rifle' ? 'bullet' : wpn?.weaponType === 'shuriken' ? 'shuriken' : 'arrow';
  }

  _projectile(npc, color, kind = 'bolt', spread = 0) {
    const from = this.player.renderCenter();
    const to = npc.renderCenter();
    // `spread` fans a volley (Snapshot, Arrow Storm) so each arrow is visible.
    const off = spread * 5;
    // Arrows leave from the bow hand and fly at a steady speed, so long shots
    // take visibly longer; bolts stay quick.
    const fx = kind === 'arrow' ? from.x + (to.x >= from.x ? 9 : -9) : from.x;
    const dist = Math.hypot(to.x - fx, to.y - from.y);
    // Bullets are the quickest of all; shurikens spin across a little slower than arrows.
    const life = kind === 'arrow' ? Math.min(650, 140 + dist / 0.55) + Math.abs(spread) * 40
      : kind === 'bullet' ? 110 + dist / 2.2 + Math.abs(spread) * 20
        : kind === 'shuriken' || kind === 'coin' ? Math.min(560, 120 + dist / 0.6) + Math.abs(spread) * 40
          : 240 + Math.abs(spread) * 40;
    this.effects.push({ type: 'projectile', kind, x: fx, y: from.y - 6 + off, ex: to.x, ey: to.y - 8 + off * 0.6, color, life, maxLife: life,
      arc: kind === 'arrow' ? Math.min(22, dist * 0.09) : 0 });
  }

  /** Dodging a monster's attack trains Agility, more for harder-hitting foes. */
  _dodgeXp(npc) {
    if (!npc?.def) return;
    const { max } = npcAttackVsPlayer(npc.def, this.skills, this.equipment, this.player.style);
    this.skills.addXp('agility', Math.max(1, max) * DODGE_AGILITY_XP * this.combatXpMult());
  }

  resolveNpcAttack(npc, opts = {}) {
    const p = this.player;
    if (!p.alive) return;
    this._swingToward(npc, p.x, p.y);
    const heavy = !!opts.heavy;
    // Dancers slip blows entirely now and then.
    if (this.combatMode() === 'dance' && Math.random() < danceEvade(this.skills.agility, p.danceStyle) * (heavy ? 0.5 : 1)) {
      this.addHitsplat(p, 0, { text: 'Dodged!' });
      this.spawnSparkle(p, '#ff8ac0', 5);
      this._dodgeXp(npc);
      if (p.autoRetaliate && (!p.action || p.action.type !== 'attack')) this.attackNpc(npc);
      return;
    }
    const perk = this.perkMods();
    const dodge = (perk.dodge || 0) + this.buffMod('dodge');   // perks and a dodging class buff
    if (dodge && Math.random() < dodge * (heavy ? 0.5 : 1)) {   // Evasion / Graceful perks
      this.addHitsplat(p, 0, { text: 'Dodged!' });
      this._dodgeXp(npc);
      if (p.autoRetaliate && (!p.action || p.action.type !== 'attack')) this.attackNpc(npc);
      return;
    }
    const { atkRoll, defRoll, max } = npcAttackVsPlayer(npc.def, this.skills, this.equipment, p.style);
    let dmg = rollAttack(atkRoll, defRoll * this.prayerMult().def, heavy ? Math.round(max * 2) : max);
    if (heavy && dmg === 0) dmg = Math.max(1, Math.round(max * 1.2)); // a telegraphed blow always stings
    if (heavy) { this._slash(p, '#ff6a5a'); this.addShake(4, 260); }
    const prot = this.protectFactor();
    if (prot) dmg = Math.floor(dmg * (1 - prot));
    if (this.braceTicks > 0) dmg = Math.floor(dmg * 0.5); // the Brace ability soaks the blow
    if (this.buffMod('reduce')) dmg = Math.floor(dmg * (1 - Math.min(0.9, this.buffMod('reduce'))));   // a defensive class buff
    dmg = this._perkReduce(dmg, npc);
    if (dmg > 0 && perk.thorns && npc.alive) {           // Spiked Armour perk
      const back = Math.max(1, Math.round(dmg * perk.thorns / (npc.def?.hpScale || 1)));
      npc.takeDamage(back); this.addHitsplat(npc, back, { tint: '#9aa6b2' });
      if (npc.hp <= 0) { this.killNpc(npc); }
    }
    p.takeDamage(dmg);
    if (dmg > 0) this._knock(p, npc);
    this.addHitsplat(p, dmg, { crit: heavy && dmg > 0 });
    if (dmg > 0) { this.spawnHitSparks(p, heavy ? '#ff5a5a' : '#ff8a8a'); this.bus.emit('sfx', 'hurt'); this._gainAdrenaline((heavy ? 2 : 1) * ADREN_PER_HURT + this._adrenTrait('hurt')); }
    if (heavy) this.msg(`${npc.name} unleashes a heavy blow${this.braceTicks > 0 ? ' — you brace and soften it!' : '!'}`, 'combat');
    this.bus.emit('hp');
    if (p.autoRetaliate && (!p.action || p.action.type !== 'attack')) this.attackNpc(npc);
    if (p.hp <= 0) this.playerDeath();
  }

  // ---------------- Good / evil alignment ----------------
  addGood(n) { if (n > 0) { this.karma.good += n; this.bus.emit('karma'); } }
  addEvil(n) { if (n > 0) { this.karma.evil += n; this.bus.emit('karma'); } }
  alignment() { return this.karma.good - this.karma.evil; }

  /** Title + css class for the current alignment. */
  alignmentTitle() {
    const a = this.alignment();
    if (a >= 60) return { title: 'Paragon', cls: 'good' };
    if (a >= 25) return { title: 'Virtuous', cls: 'good' };
    if (a >= 8) return { title: 'Kind-hearted', cls: 'good' };
    if (a <= -60) return { title: 'Villain', cls: 'evil' };
    if (a <= -25) return { title: 'Wicked', cls: 'evil' };
    if (a <= -8) return { title: 'Mischievous', cls: 'evil' };
    return { title: 'Neutral', cls: 'neutral' };
  }

  /** Shop price modifiers: the virtuous are trusted (cheaper), the wicked gouged. */
  karmaFactor() {
    const a = this.alignment();
    if (a >= 60) return { buy: 0.85, sell: 1.12 };
    if (a >= 25) return { buy: 0.92, sell: 1.06 };
    if (a <= -60) return { buy: 1.20, sell: 0.85 };
    if (a <= -25) return { buy: 1.10, sell: 0.94 };
    return { buy: 1, sell: 1 };
  }

  /** Shop prices: karma, then the Economics Trader perk from mastered topics. */
  priceFactor() {
    const k = this.karmaFactor(), t = this.learning.perks().shop;
    return { buy: k.buy * (1 - t), sell: k.sell * (1 + t) };
  }

  /** A study question answered (from the Codex or a study session). Grants Wisdom
   *  XP, and on mastering a topic, its Codex card and title. */
  studyAnswer(question, correct) {
    const r = this.learning.answer(question, correct);
    if (r.levelUp) {
      const coins = 25 * r.levelUp;
      this.inventory.add('coins', coins);
      this.msg(`Your Wisdom is now level ${r.levelUp}! (+${coins} coins)`, 'level');
      this.bus.emit('sfx', 'level');
    }
    if (r.bounty) {
      this.inventory.add('coins', 40);
      this.msg('Mistake bounty cleared: you got it right this time! (double Wisdom XP, +40 coins)', 'level');
    }
    if (r.mastered) {
      const t = TOPIC_BY_ID[question.topic];
      this.msg(`Topic mastered: ${t.name}! New Codex card and title: "${t.title}".`, 'level');
      this.banner(`<span class="big">${t.icon} ${t.name} mastered!</span>Codex card unlocked · title "${t.title}"`);
      this.spawnSparkle(this.player, '#ffd24a', 18);
      if (!this.learning.title) this.learning.title = t.id;   // wear your first title straight away
    }
    this.bus.emit('learning');
    return r;
  }

  killNpc(npc, { byAlly = false } = {}) {
    // Alignment: heroism vs cruelty. Bosses & aggressive foes are heroic to slay;
    // cutting down harmless creatures is a small evil.
    if (npc.def.boss) this.addGood(5);
    else if (npc.def.aggressive) this.addGood(1);
    else this.addEvil(1);
    this.hitStop = Math.max(this.hitStop, npc.def.boss ? 180 : npc.champion ? 120 : 70);
    if (npc.def.boss) {
      this.msg(`You have slain ${npc.name}!`, 'combat');
      this.banner(`<span class="big">${npc.name} defeated!</span>The spoils are yours.`);
    } else if (npc.champion) {
      this.msg(`You have defeated the ${npc.name}! Champions drop extra loot.`, 'level');
      this.addShake(3.5, 260);
    } else {
      this.msg(`You have defeated the ${npc.name}.`, 'combat');
    }
    this.totalKills++;
    // Kill streak: chain kills (no more than ~30s apart) for a growing XP bonus.
    this.killStreak = (this.tickCount - this._lastKillTick <= STREAK_WINDOW_TICKS) ? this.killStreak + 1 : 1;
    this._lastKillTick = this.tickCount;
    if (this.killStreak > 1 && this.killStreak % 5 === 0) this.msg(`Kill streak ${this.killStreak}! Combat XP +${Math.round(Math.min(STREAK_MAX_BONUS, this.killStreak * STREAK_XP_PER_KILL) * 100)}%.`, 'level');
    this.bus.emit('xpbonus');
    this.kills[npc.npcId] = (this.kills[npc.npcId] || 0) + 1;
    if (!byAlly) this._gainAdrenaline(this._adrenTrait('kill'));   // Gladiators, Berserkers, Sorcerers
    // The kill reward: most of a monster's combat XP comes when it dies, worth
    // its full life, in the style you fight with (see killXp in combat.js).
    { const mode = this.combatMode(), m = this.combatXpMult();
      const skill = mode === 'ranged' ? 'ranged' : mode === 'magic' ? 'magic' : mode === 'dance' ? 'dance' : 'attack';
      // Life is shown smaller on big monsters (hpScale), so the reward is worked out on
      // its real size, plus the per-hit share that the smaller hits no longer pay.
      const hs = npc.def.hpScale || 1, real = npc.maxHp * hs;
      const owed = real + (real - npc.maxHp) * DAMAGE_XP_SHARE / KILL_XP_SHARE;
      for (const x of killXp(skill, owed)) this.skills.addXp(x.skill, x.xp * m); }
    if (npc.def.boss) {
      this.bossKills++;
      // A boss kill is a big payday: bonus XP in your combat style and Hitpoints.
      const xp = Math.round((npc.def.level || 1) * BOSS_XP_PER_LEVEL * this.combatXpMult());
      const mode = this.combatMode();
      if (mode === 'dance') {   // a Dancer's bonus is split between Agility and Ranged
        this.skills.addXp('agility', xp / 2); this.skills.addXp('ranged', xp / 2); this.skills.addXp('hitpoints', Math.round(xp / 3));
        this.msg(`Boss slain! +${xp * XP_RATE / 2} Agility and Ranged XP.`, 'level');
      } else {
        const skill = mode === 'ranged' ? 'ranged' : mode === 'magic' ? 'magic' : 'attack';
        this.skills.addXp(skill, xp); this.skills.addXp('hitpoints', Math.round(xp / 3));
        this.msg(`Boss slain! +${xp * XP_RATE} ${skill} XP.`, 'level');
      }
    }
    if ((npc.def.boss && this.quests.island_defender.state === 'active') ||
        this.quests.big_game_hunter.state === 'active') this.bus.emit('quest');
    this.progressSlayer(npc);
    this.progressBounties(npc);
    this.checkAchievements();
    this._deathBurst(npc);
    this.rollDrops(npc);
    if (npc.worldBoss) { for (let k = 1; k < WORLD_BOSS_LOOT_ROLLS; k++) this.rollDrops(npc); this.msg('World Boss slain! Triple loot.', 'level'); }
    this._refundRunes(npc);
    npc.die();
    if (this.player.target === npc) this.player.target = null;
    // Auto battle moves straight on to the next fight (right after this attack
    // resolves) instead of idling until the next world tick.
    if (this.autoBattle) { this._autoLast = null; this._autoRetarget = true; }
    const pc = this.quests.pest_control;
    if (pc.state === 'active' && npc.npcId === 'rat') {
      pc.kills++;
      if (pc.kills >= 8) {
        pc.state = 'done';
        if (this._questTarget === 'rat') this._questTarget = null;
        this.inventory.add('coins', 600);
        this.skills.addXp('attack', 300);
        this.msg('Quest complete — Pest Control! 600 coins and Attack XP.', 'level');
        this.banner('<span class="big">Quest complete!</span>Pest Control');
      } else this.msg(`Pest Control: ${pc.kills}/8 giant rats slain.`, 'system');
      this.bus.emit('quest');
    }
  }

  // ---------------- Daily bounties ----------------
  /** Make sure today's board exists (new day = three fresh bounties). */
  ensureBounties(today = dayKey()) {
    const b = this.bounties;
    if (b.day === today && b.list.length) return false;
    const seen = new Map();
    for (const n of this.npcs) {
      if (n.def.attackable && !n.def.boss && !n.temporary && !seen.has(n.npcId)) {
        const d = n.def.champion ? getNpc(n.npcId) : n.def;
        seen.set(n.npcId, { id: n.npcId, name: d.name, level: d.level || 1, zone: d.zone });
      }
    }
    b.day = today;
    b.list = makeBounties(today, this.fightLevel(), [...seen.values()]);
    if (b.lastFull && b.lastFull !== prevDayKey(today) && b.lastFull !== today) b.streak = 0;   // missed a day
    this.bus.emit('bounties');
    return true;
  }

  progressBounties(npc) {
    const b = this.bounties;
    let changed = false;
    for (const t of b.list) {
      if (t.done || t.id !== npc.npcId) continue;
      t.have++;
      changed = true;
      if (t.have >= t.need) {
        t.done = true;
        const pay = Math.round(t.reward * streakMult(b.streak));
        this.inventory.add('coins', pay);
        this.bus.emit('sfx', 'achievement');
        this.msg(`Bounty complete: ${t.need} ${t.name}! +${pay} coins.`, 'level');
        this.banner(`<span class="big">Bounty complete!</span>+${pay} coins`);
        if (b.list.every((x) => x.done)) {
          b.streak = b.lastFull === prevDayKey(b.day) ? b.streak + 1 : 1;
          b.lastFull = b.day;
          const bonus = Math.round(b.list.reduce((a, x) => a + x.reward, 0) * 0.5 * streakMult(b.streak));
          this.inventory.add('coins', bonus);
          this.msg(`All of today's bounties done! Bonus +${bonus} coins. Streak: ${b.streak} day${b.streak === 1 ? '' : 's'}.`, 'level');
        }
      } else if (t.have % 5 === 0) this.msg(`Bounty: ${t.have}/${t.need} ${t.name}.`, 'system');
    }
    if (changed) this.bus.emit('bounties');
  }

  // ---------------- Day / night cycle ----------------
  // A full day/night cycle takes DAY_CYCLE_MS of real play time (pausing when
  // the tab is hidden, since it rides the same accumulated dt as everything
  // else). After dark, combat XP is boosted and ghostly champions roam more (see combatXpMult, NPC.maybeChampion).
  /** Phase in [0,1): 0 = midnight, 0.5 = high noon. */
  dayPhase() { return (this.playMs % DAY_CYCLE_MS) / DAY_CYCLE_MS; }
  /** Smooth brightness curve: 0 at midnight, 1 at noon. */
  daylightFactor() { return (Math.cos((this.dayPhase() - 0.5) * Math.PI * 2) + 1) / 2; }
  /** true from dusk through dawn (used to gate lamp glow / firefly ambience). */
  isNight() { return this.daylightFactor() < 0.4; }

  /** Night hunt: combat XP is worth 25% more after dark. */
  // Combat XP multipliers, all stacking: night hunt x1.5, Wilderness level
  // (x1.5 at level 1 up to x6 at level 10), and kill streak (+10% per kill, up to +200%).
  combatXpMult() { return this.xpBreakdown().total; }
  xpBreakdown() {
    const night = this.isNight() ? 1.5 : 1;
    const wl = this.wildernessLevel();
    const wild = wl ? 1 + WILD_XP_PER_LEVEL * wl : 1;
    const streak = 1 + Math.min(STREAK_MAX_BONUS, this.killStreak * STREAK_XP_PER_KILL);
    return { night, wild, wildLevel: wl, streak, streakKills: this.killStreak, total: night * wild * streak };
  }
  inWilderness() { return this.wildernessLevel() > 0; }
  /** 0 outside the Wilderness; 1 at its western edge rising to 10 deep in the east (Pulau Hantu). */
  wildernessLevel() {
    const p = this.player;
    if (!this.world.zoneAt(p.x, p.y)?.wilderness) return 0;
    return Math.max(1, Math.min(10, 1 + Math.floor((p.x - WILD_EDGE_X) / 5)));
  }

  /** Announce dusk and dawn, since night changes what's out there. */
  _checkNightfall() {
    const night = this.isNight();
    if (this._wasNight === undefined) { this._wasNight = night; return; }
    if (night === this._wasNight) return;
    this._wasNight = night;
    if (night) {
      this.msg('Night falls. Ghosts and bats stir, and champions roam more often. Combat XP +50% until dawn.', 'level');
      this.banner('<span class="big">Night hunt</span>+50% combat XP until dawn');
    } else this.msg('Dawn breaks. The night hunt bonus fades.', 'system');
    this.bus.emit('night', night);
  }
  /** Flavour clock text, e.g. "11:42 PM" — purely cosmetic. */
  clockLabel() {
    const totalMin = Math.floor(this.dayPhase() * 24 * 60);
    let h = Math.floor(totalMin / 60), m = totalMin % 60;
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  // ---------------- Region / Wilderness ----------------
  updateRegion() {
    const z = this.world.zoneAt(this.player.x, this.player.y);
    const name = z ? z.name : 'Singapore';
    const wild = !!(z && z.wilderness);
    const lvl = this.wildernessLevel();   // same level the XP bonus uses
    if (z && !this.zonesVisited.has(name)) { this.zonesVisited.add(name); this.checkAchievements(); }
    if (name !== this.currentZoneName) {
      this.currentZoneName = name;
      if (wild) {
        this.banner('<span class="big">&#9888; The Wilderness</span>Lawless and deadly &mdash; no safe healing. Beware bosses!');
        this.msg('You enter the Wilderness: combat XP rises the deeper you go (up to x6), but fight or flee!', 'combat');
      } else {
        this.msg(`You enter ${name}.`, 'system');
      }
    }
    if (lvl !== this.wildLevel) this.bus.emit('xpbonus');
    this.wildLevel = lvl;
    this.ui?.setRegion?.(name, lvl);
  }

  rollDrops(npc) {
    const def = npc.def;
    const loot = [];
    for (const d of def.alwaysDrop || []) {
      const q = d.min ? randInt(d.min, d.max) : 1;
      loot.push([d.id, q, 'common']);
    }
    // Champions add Champion bones (more from stronger bands); a few bosses add a named rare kind.
    if (npc.champion) loot.push(['champion_bones', championBoneQty(def.tierLevel || def.level || 1), 'rare']);
    const rareBone = def.boss && RARE_BOSS_BONES[npc.npcId];
    if (rareBone && Math.random() < RARE_BONE_CHANCE) {
      const [a, b] = RARE_BONE_QTY[rareBone], q = randInt(a, b);
      loot.push([rareBone, q, 'epic']);
      this.msg(`A rare drop! ${q > 1 ? q + ' x ' : ''}${getItem(rareBone).name}.`, 'level');
    }
    if (def.dropTable && def.dropTable.length) {
      // Champions roll their table eight times, bosses ten, and neither comes up empty.
      const rolls = def.boss ? 10 : npc.champion ? 4 : 1;
      const normal = !def.boss && !npc.champion;
      for (let r = 0; r < rolls; r++) {
        let pick = weightedPick(def.dropTable);
        if (npc.champion || def.boss) for (let k = 0; pick.nothing && k < 5; k++) pick = weightedPick(def.dropTable);
        // Normal monsters drop gear much less often: most gear rolls become something else.
        // (Amulets, rings and capes are exempt, so accessories stay easy to find.)
        if (normal && !pick.nothing && getItem(pick.id).equip && !getItem(pick.id).equip.style && Math.random() < NORMAL_GEAR_SKIP) {
          for (let k = 0; !pick.nothing && getItem(pick.id).equip && k < 6; k++) pick = weightedPick(def.dropTable);
          if (!pick.nothing && getItem(pick.id).equip) continue;
        }
        if (pick.nothing) continue;
        const q = pick.min ? randInt(pick.min, pick.max) : 1;
        let rar = dropRarity(pick.id, 'table', { boss: !!def.boss });
        if (npc.champion && rar === 'common') rar = 'rare';
        loot.push([pick.id, q, rar]);
      }
    }
    // Rare drop table — small base chance, much higher for bosses, champions & high levels.
    const rareChance = def.boss || npc.champion ? 1 : Math.min(0.5, (def.tierLevel || def.level || 1) / 1200 + 0.01);
    // Bosses always hit the rare table five times, champions once.
    for (let rr = 0; rr < (def.boss ? 5 : 1); rr++) if (Math.random() < rareChance) {
      const pick = weightedPick(RARE_DROP_TABLE);
      const q = pick.min ? randInt(pick.min, pick.max) : 1;
      loot.push([pick.id, q, dropRarity(pick.id, 'rare')]);
      const nm = getItem(pick.id).name;
      this.msg(`A rare drop! ${q > 1 ? q + ' x ' : ''}${nm}.`, 'level');
      if (getItem(pick.id).value >= 5000) this.banner(`<span class="big">Rare drop!</span>${nm}`);
    }
    // Bosses always drop an accessory for your fighting style, and champions half the time.
    if ((def.boss || (npc.champion && Math.random() < 0.5))) {
      const mode = this.combatMode() === 'dance' ? 'melee' : this.combatMode();
      const acc = accessoriesFor(Math.max(1, def.tierLevel || def.level || 1), mode);
      if (acc.length) loot.push([acc[Math.floor(Math.random() * acc.length)], 1, 'epic']);
    }
    // Bosses always drop three pieces of gear for your class, of Superior quality or better.
    if (def.boss && this.jobClass) {
      for (let k = 0; k < 3; k++) {
        const g = classGearFor(this.jobClass, Math.max(1, def.tierLevel || def.level || 1));
        if (g) loot.push([g, 1, 'epic', 'boss']);
      }
    }
    // Upgrade materials: stones from anything (bosses and champions most), wards from bosses.
    const stoneChance = def.boss || npc.champion ? 1 : Math.min(0.12, 0.03 + (def.tierLevel || def.level || 1) / 2500);
    if (Math.random() < stoneChance) loot.push([UP_STONE, def.boss ? randInt(20, 50) : npc.champion ? randInt(2, 5) : 1, def.boss || npc.champion ? 'rare' : 'common']);
    if (def.boss) loot.push([UP_WARD, randInt(1, 3), 'epic']);
    else if (Math.random() < (npc.champion ? 0.1 : 0)) loot.push([UP_WARD, 1, 'epic']);
    // Treasure trails: a rare clue scroll, if you aren't already carrying one.
    if (!this.clue && !this._holdsClue()) {
      const clueChance = Math.min(0.05, (def.tierLevel || def.level || 1) / 3000 + (def.boss ? 0.04 : 0.006));
      if (Math.random() < clueChance) {
        const tier = clueTierForLevel(def.tierLevel || def.level || 1);
        loot.push([CLUE_TIERS[tier].item, 1, 'epic']);
        this.msg('You find a clue scroll!', 'level');
      }
    }
    // Weapons mostly drop as your own class's equivalent, so loot stays useful.
    const myType = this.jobClass && CLASS_BY_ID[this.jobClass]?.weapon;
    if (myType) {
      for (const l of loot) {
        const t = getItem(l[0]).equip?.weaponType;
        if (t && t !== myType && Math.random() < CLASS_LOOT_SHARE) l[0] = equivalentWeapon(l[0], myType);
        // Armour of another class's kind mostly turns into your own kind.
        const fam = getItem(l[0]).equip?.family, mine = ARMOUR_FAMILY[this.jobClass];
        if (fam && mine && fam !== mine && Math.random() < CLASS_LOOT_SHARE) l[0] = equivalentArmour(l[0], mine);
      }
    }
    // Boss hoards: stackables (coins, runes, arrows, seeds...) come in 100x the amount.
    const stackMult = def.boss ? BOSS_STACK_MULT : npc.champion ? CHAMPION_STACK_MULT : 1;
    if (stackMult > 1) for (const l of loot) if (l[0] !== UP_STONE && getItem(l[0]).stackable) l[1] *= stackMult;
    for (const l of loot) if (l[0] === 'coins') l[1] = Math.round(l[1] * COIN_LOOT_MULT);
    // Gear quality: a head start of upgrade levels for that item type.
    for (const l of loot) {
      if (!getItem(l[0]).equip) continue;
      const lv = rollUpgrade(l[3] === 'boss' || def.boss ? 'boss' : npc.champion ? 'champion' : 'normal');
      if (lv) { this._applyQuality(l[0], lv); l[2] = qualityFor(lv).rarity; }
      l.length = 3;
    }
    this._autoLoot(loot, npc.x, npc.y);
  }

  /** A quality drop raises that item type's upgrade level (never lowers it). */
  _applyQuality(id, level) {
    const Q = qualityFor(level), lv = this.equipment.upgradeLevel(id);
    const name = getItem(id).name;
    if (level > lv) {
      this.equipment.upgrades[id] = level;
      this.equipment._changed();
      this.msg(`${Q.label} ${name}! Your ${name.toLowerCase()} is now +${level}.`, 'level');
      if (level >= 5) this.banner(`<span class="big">${Q.label} drop!</span>${name} +${level}`);
    } else {
      this.msg(`${Q.label} ${name} +${level} (yours is already +${lv}).`, 'system');
    }
  }


  /** Auto-loot: drops go straight into the pack; whatever won't fit falls to the ground. */
  // MapleStory-style loot: drops pop out onto the ground in a little fan,
  // then (next tick) fly into your pack wherever you are.
  _autoLoot(loot, x, y) {
    let best = 'common';
    loot.forEach(([id, qty, rarity = 'common'], i) => {
      const gi = this.world.addGroundItem(id, qty, x, y);
      const a = (i / Math.max(1, loot.length)) * Math.PI * 2 + Math.random();
      gi.ox = Math.cos(a) * 9; gi.oy = Math.sin(a) * 5;     // pixel scatter
      gi.born = performance.now();
      gi.fromKill = true;
      gi.rarity = rarity;
      gi.lootAt = this.tickCount + lootDelay(rarity);       // rare drops linger so you see the beam
      if (RARITY[rarity].rank > RARITY[best].rank) best = rarity;
    });
    if (best !== 'common') {
      this.bus.emit('sfx', best === 'rare' ? 'droprare' : 'dropepic');
      if (best === 'legendary') this.addShake(3, 240);
    }
  }

  /** Each tick: sweep up kill drops (from anywhere) and any other loot within 2 tiles. */
  _autoPickup() {
    const p = this.player;
    if (!p.alive) return;
    const at = this.playerTile();
    const got = [];
    let special = false;
    for (const gi of [...this.world.groundItems]) {
      if (gi.playerDropped) continue;                     // things you drop stay dropped
      // Kill drops fly in once their (rarity-based) delay is up, wherever you are;
      // anything else is swept up when you're within 2 tiles.
      if (gi.fromKill ? this.tickCount < gi.lootAt : chebyshev(at.x, at.y, gi.x, gi.y) > 2) continue;
      const added = this.inventory.add(gi.id, gi.qty);
      if (added <= 0) continue;
      const rar = RARITY[gi.rarity];
      if (rar && rar.rank > 0) special = true;
      got.push(`${added > 1 ? added + ' x ' : ''}${getItem(gi.id).name}${rar && rar.rank > 0 ? ` (${rar.label})` : ''}`);
      const c = p.renderCenter();
      this.effects.push({ type: 'lootfly', id: gi.id, rarity: gi.rarity, x: gi.x * TILE + TILE / 2 + (gi.ox || 0), y: gi.y * TILE + TILE * 0.62 + (gi.oy || 0), ex: c.x, ey: c.y - 10, life: 420, maxLife: 420 });
      this.world.removeGroundItem(gi);
    }
    if (got.length) { this.msg(`You loot: ${got.join(', ')}.`, special ? 'level' : 'game'); this.bus.emit('sfx', 'pickup'); }
  }

  _holdsClue() { return this.inventory.slots.some((s) => s && s.id.startsWith('clue_scroll_')); }

  // ---------------- New skills: Prayer, Thieving, Agility ----------------
  /** Bury bones from a stack (any kind): 100 at a time by default, or `count` (Infinity = the whole stack).
   *  Offering at an A-Worthy Monument (`altar`) pays ALTAR_XP_MULT x. Each bone also restores a little prayer. */
  buryBones(index, count = BURY_BATCH, altar = false) {
    const s = this.inventory.slotAt(index);
    if (!s || !isBone(s.id)) { this.msg('You can only bury bones.'); return 0; }
    if (altar && !this.nearShrine()) { this.msg('You need to be at an A-Worthy Monument to offer bones.'); return 0; }
    const it = getItem(s.id), n = Math.min(s.qty, count);
    this.inventory.removeAt(index, n);
    this.skills.addXp('prayer', boneXp(s.id) * n * (altar ? ALTAR_XP_MULT : 1));
    // Only the first few bones of a click restore prayer, so a big stack can't stand in for a monument mid-fight.
    this.prayerPoints = Math.min(this.maxPrayer(), this.prayerPoints + (it.prayerRestore || 1) * Math.min(n, BURY_RESTORE_CAP));
    this.bus.emit('prayer');
    this.addGood(Math.min(n, 10)); // honouring the dead is a small good
    this.spawnSparkle(this.player, altar ? '#9adcff' : '#ffe89a', Math.min(24, 6 + n));
    const what = n > 1 ? `${n} ${it.name.toLowerCase()}` : `the ${it.name.toLowerCase()}`;
    this.msg(altar ? `You offer ${what} at the monument.` : `You bury ${what}.`, 'system');
    return n;
  }
  /** Bury (or offer) every kind of bone in the pack. Walks backwards: removeAt only nulls a slot
   *  and _pad only trims trailing nulls, so lower indices stay valid. */
  buryAllBones(altar = false) {
    if (altar && !this.nearShrine()) { this.msg('You need to be at an A-Worthy Monument to offer bones.'); return 0; }
    let total = 0;
    for (let i = this.inventory.size - 1; i >= 0; i--) { const s = this.inventory.slotAt(i); if (s && isBone(s.id)) total += this.buryBones(i, Infinity, altar); }
    if (!total) this.msg('You have no bones.');
    return total;
  }
  /** Close enough to an A-Worthy Monument to offer bones there. */
  nearShrine() { const p = this.player; return this.world.objects.some((o) => o.def.type === 'shrine' && chebyshev(p.x, p.y, o.x, o.y) <= ALTAR_RANGE); }

  startPickpocket(npc) {
    if (!npc.def.role) { this.msg("You can't pickpocket that."); return; }
    this.beginAction({ type: 'thieve', npc, target: { x: npc.x, y: npc.y } }, { x: npc.x, y: npc.y }, true);
  }

  pickpocket(npc) {
    if (!npc || !npc.def.role) return;
    const lvl = this.skills.level('thieving');
    if (Math.random() < Math.min(0.92, 0.45 + lvl * 0.006)) {
      const coins = randInt(3, 12) + Math.floor(lvl * 1.5);
      this.inventory.add('coins', coins);
      this.skills.addXp('thieving', 8 + lvl);
      this.addEvil(1); // theft tips you toward evil
      this.spawnSparkle(this.player, '#ffe24a', 6);
      this.msg(`You pick the ${npc.name}'s pocket and steal ${coins} coins.`, 'system');
    } else {
      const dmg = randInt(1, 2);
      this.player.takeDamage(dmg); this.addHitsplat(this.player, dmg); this.bus.emit('hp');
      this.playerStun = 3;
      this.msg(`You fail to pick the ${npc.name}'s pocket and are stunned!`, 'combat');
      if (this.player.hp <= 0) this.playerDeath();
    }
  }

  resolveAgility(obj) {
    const d = obj.def;
    if (d.level && this.skills.level('agility') < d.level) {
      this.msg(`You need Agility level ${d.level} for the ${d.name}.`, 'system');
      return false;
    }
    const xpScale = AGILITY_XP_MULT * (1 + this.skills.level('agility') / AGILITY_XP_DIV);
    this.skills.addXp('agility', (d.xp || 18) * xpScale);
    this.runEnergy = Math.min(100, this.runEnergy + 8);
    this.bus.emit('run');
    this.spawnPoof(obj.x * TILE + TILE / 2, obj.y * TILE + TILE / 2 - 6, '#8fd6ff');

    // Course lap tracking: touching every distinct obstacle once = a lap.
    if (d.markChance !== undefined) {
      this._agilityLap.add(obj.uid);
      let mark = Math.random() < d.markChance;
      if (d.finish && this._agilityLap.size >= 3) {
        // Completing the loop at the finish line: lap bonus + a guaranteed mark.
        this.skills.addXp('agility', Math.round((d.xp || 30) * 0.6 * xpScale));
        this._agilityLap.clear();
        mark = true;
        this.msg('You complete a lap of the course!', 'system');
      }
      if (mark) {
        this.inventory.add('mark_of_grace', 1);
        this.spawnSparkle(this.player, '#5fd0a0', 8);
        this.msg('You find a Mark of grace.', 'system');
      }
    }
    return d.finish ? false : true; // pause after the finish line; otherwise keep training
  }

  /** Trade Marks of grace for Agility XP: each is worth MARK_XP_CROSSINGS zip-line
   *  crossings at your current Agility level (so it keeps pace as you level).
   *  Trades the whole stack by default. */
  useMarkOfGrace(index, count = Infinity) {
    const s = this.inventory.slotAt(index);
    if (!s || s.id !== 'mark_of_grace') return;
    const n = Math.min(s.qty, count);
    if (n <= 0) return;
    this.inventory.removeAt(index, n);
    const each = this.markOfGraceXp();
    this.skills.addXp('agility', each * n);
    this.spawnSparkle(this.player, '#5fd0a0', Math.min(24, 8 + n));
    this.msg(n > 1 ? `You trade ${n} Marks of grace for Agility experience.` : 'You trade a Mark of grace for Agility experience.', 'system');
  }

  /** Agility XP (before the global XP rate) one Mark of grace is worth right now. */
  markOfGraceXp() {
    return MARK_XP_CROSSINGS * 60 * AGILITY_XP_MULT * (1 + this.skills.level('agility') / AGILITY_XP_DIV);
  }

  // ---------------- Thieving: market stalls ----------------
  stealFromStall(obj) {
    const d = obj.def;
    if (obj.depleted) { this.msg('The stall has nothing left — wait for it to restock.', 'system'); return false; }
    const lvl = this.skills.level('thieving');
    if (d.level && lvl < d.level) { this.msg(`You need Thieving level ${d.level} to steal from the ${d.name}.`, 'system'); return false; }
    // Success scales with level over the stall's requirement.
    const chance = Math.min(0.95, 0.5 + (lvl - (d.level || 1)) * 0.012);
    if (Math.random() < chance) {
      const pick = weightedPick(d.loot);
      const qty = pick.min ? randInt(pick.min, pick.max) : 1;
      this.inventory.add(pick.id, qty);
      this.skills.addXp('thieving', d.xp || 16);
      this.addEvil(1); // stealing from stalls is an evil deed
      this.spawnSparkle(this.player, '#ffe24a', 6);
      const name = getItem(pick.id).name;
      this.msg(`You steal ${qty > 1 ? qty + ' x ' : ''}${name} from the ${d.name}.`, 'system');
      obj.depleted = true; obj.respawnTimer = d.respawn || 5; // the stall is emptied briefly
      this.bus.emit('sfx', 'pickup');
    } else {
      const dmg = randInt(1, 3);
      this.player.takeDamage(dmg); this.addHitsplat(this.player, dmg); this.bus.emit('hp');
      this.playerStun = 3;
      this.msg(`You're caught stealing from the ${d.name} and are stunned!`, 'combat');
      if (this.player.hp <= 0) this.playerDeath();
    }
    return false; // one attempt per click
  }

  // ---------------- Treasure trails (clue scrolls) ----------------
  /** Read a clue scroll: start its trail, re-show the riddle, or dig if on the spot. */
  readClue(index) {
    const s = this.inventory.slotAt(index);
    if (!s || !s.id.startsWith('clue_scroll_')) return;
    const tierKey = s.id.replace('clue_scroll_', '');
    if (this.clue && this.clue.item === s.id) {
      const spot = this.clue.spots[this.clue.step];
      if (chebyshev(this.player.x, this.player.y, spot.x, spot.y) <= 1) this.digClue();
      else this.msg(`Clue: ${spot.hint}`, 'system');
      return;
    }
    if (this.clue) { this.msg('Finish your current treasure trail first.', 'system'); return; }
    const tier = CLUE_TIERS[tierKey];
    if (!tier) return;
    // Build a fresh trail of distinct dig spots.
    const pool = [...CLUE_SPOTS];
    const spots = [];
    for (let i = 0; i < tier.steps && pool.length; i++) spots.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
    this.clue = { tier: tierKey, item: tier.item, casket: tier.casket, step: 0, spots };
    this.msg(`You read the ${getItem(s.id).name}. ${spots.length} dig spots to find.`, 'level');
    this.msg(`Clue: ${spots[0].hint}`, 'system');
    this.bus.emit('clue');
  }

  digClue() {
    if (!this.clue) return;
    this.spawnPoof(this.player.x * TILE + TILE / 2, this.player.y * TILE + TILE / 2 + 4, '#caa15a');
    this.bus.emit('sfx', 'pickup');
    this.clue.step++;
    if (this.clue.step >= this.clue.spots.length) {
      const casket = this.clue.casket;
      const itemId = this.clue.item;
      this.clue = null;
      const idx = this.inventory.slots.findIndex((s) => s && s.id === itemId);
      if (idx >= 0) this.inventory.removeAt(idx, 1);
      this.inventory.add(casket, 1);
      this.msg('You dig up a reward casket! Open it to claim your loot.', 'level');
      this.banner('<span class="big">Treasure found!</span>A reward casket is yours.');
      this.spawnSparkle(this.player, '#ffd24a', 16);
    } else {
      this.msg(`You dig... and uncover the next clue! Clue: ${this.clue.spots[this.clue.step].hint}`, 'system');
    }
    this.bus.emit('clue');
  }

  /** Open a reward casket: roll its tier's loot table a few times. */
  openCasket(index) {
    const s = this.inventory.slotAt(index);
    if (!s || !s.id.startsWith('reward_casket_')) return;
    const tier = CLUE_TIERS[s.id.replace('reward_casket_', '')];
    if (!tier) return;
    this.inventory.removeAt(index, 1);
    const won = [];
    for (let i = 0; i < (tier.rolls || 2); i++) {
      const pick = weightedPick(tier.reward);
      const q = pick.min ? randInt(pick.min, pick.max) : 1;
      this.inventory.add(pick.id, q);
      won.push(`${q > 1 ? q + ' x ' : ''}${getItem(pick.id).name}`);
    }
    this.spawnSparkle(this.player, '#ffd24a', 16);
    this.msg(`The casket contained: ${won.join(', ')}.`, 'level');
    this.banner(`<span class="big">Casket loot!</span>${won.join(', ')}`);
    this.bus.emit('clue');
  }

  /** Open a bird's nest (from woodcutting) for coins or a gem. */
  openNest(index) {
    const s = this.inventory.slotAt(index);
    if (!s || s.id !== 'birds_nest') return;
    this.inventory.removeAt(index, 1);
    const table = [
      { id: 'coins', min: 60, max: 450, weight: 50 },
      { id: 'sapphire', weight: 18 }, { id: 'emerald', weight: 12 },
      { id: 'ruby', weight: 7 }, { id: 'diamond', weight: 3 },
    ];
    const pick = weightedPick(table);
    const q = pick.min ? randInt(pick.min, pick.max) : 1;
    this.inventory.add(pick.id, q);
    this.spawnSparkle(this.player, '#caa15a', 8);
    this.msg(`The bird's nest held ${q > 1 ? q + ' x ' : ''}${getItem(pick.id).name}.`, 'level');
  }

  // ---------------- Boss mechanics ----------------
  spawnNpc(npcId, x, y, { temporary = false, wander = 3 } = {}) {
    const n = new NPC(npcId, x, y, wander);
    n.wander = wander;          // an explicit 0 means "stay put" (the constructor would fall back to the default)
    n.temporary = temporary;
    if (temporary) this.hasTemps = true;
    this.npcs.push(n);
    return n;
  }

  /** World boss: every WORLD_BOSS_EVERY ticks, if none is about, a random boss
   *  (one at or above your combat level where possible) rises 8-14 tiles away:
   *  5x its life, 2x its hits, 1.5x attack and defence, aggressive from far off
   *  at any level. It never respawns, and leaves after WORLD_BOSS_STAY ticks
   *  unless you're fighting it. */
  _tickWorldBoss() {
    const wb = this._worldBoss;
    if (wb && wb.alive && this.tickCount > wb.worldBossUntil && wb.target !== this.player) {
      this.msg(`${wb.name} fades back into the wilds.`, 'system');
      this.npcs = this.npcs.filter((n) => n !== wb); this._worldBoss = null;
    }
    if (this.tickCount % WORLD_BOSS_EVERY !== 0 || this._worldBoss || !this.player.alive) return;
    return this.spawnWorldBoss();
  }

  /** Bosses grow with you: once your combat level passes a boss's level, the
   *  boss is rebuilt from its own stats scaled by f = your level / its level,
   *  with f x attack, strength, defence and max hit, and f^2 x life. It only
   *  happens while the boss is untouched (full life), so a fight in progress
   *  never shifts; a boss that has respawned scales again from its fresh stats. */
  _scaleBoss(n, cl) {
    if (!n.alive || n.hp < n.maxHp) return;
    if (n.def !== n._bossScaledDef) n._bossBase = n.def;     // fresh def (spawn, respawn): new base
    const base = n._bossBase, lvl = Math.max(1, base.level || 1);
    const f = Math.min(BOSS_SCALE_MAX, Math.max(1, cl / lvl));
    if (n._bossScaledDef && n._bossScale === f) return;
    const r = (v, m) => Math.max(1, Math.round((v || 1) * m));
    n.def = f === 1 ? base : { ...base, maxHp: r(base.maxHp, f * f), attack: r(base.attack, f), strength: r(base.strength, f),
      defence: r(base.defence, f), maxHit: r(base.maxHit, f), scaledTo: cl };
    n._bossScaledDef = n.def; n._bossScale = f;
    n.maxHp = n.def.maxHp || 1; n.hp = n.maxHp;
  }

  spawnWorldBoss() {
    const p = this.player, cl = this.fightLevel();
    const ids = ALL_BOSS_IDS.filter((id) => { try { const d = getNpc(id); return d.boss && !d.fixed && d.attackable; } catch { return false; } });
    if (!ids.length) return null;
    const lvl = (id) => getNpc(id).level || 1;
    const fit = ids.filter((id) => lvl(id) >= cl);
    const pool = fit.length ? fit : [ids.reduce((a, b) => (lvl(b) > lvl(a) ? b : a))];
    const id = pool[Math.floor(Math.random() * pool.length)];
    // A walkable tile 8-14 tiles from you.
    let spot = null;
    for (let tries = 0; tries < 60 && !spot; tries++) {
      const ang = Math.random() * Math.PI * 2, r = 8 + Math.random() * 6;
      const x = Math.round(p.x + Math.cos(ang) * r), y = Math.round(p.y + Math.sin(ang) * r);
      if (this.world.inBounds(x, y) && !this.world.isBlocked(x, y)) spot = { x, y };
    }
    if (!spot) return null;
    const n = this.spawnNpc(id, spot.x, spot.y, { wander: 6 });
    const d = n.def, M = WORLD_BOSS_MULT;
    n.def = { ...d, name: `World Boss ${d.name}`, maxHp: Math.round((d.maxHp || 1) * M.hp), maxHit: Math.max(2, Math.round((d.maxHit || 1) * M.hit)),
      attack: Math.round((d.attack || 1) * M.stats), defence: Math.round((d.defence || 1) * M.stats),
      aggressive: true, aggroRange: 16, ignoreLevelGate: true, scale: (d.scale || 1) * 1.3, worldBoss: true };
    n.maxHp = n.hp = n.def.maxHp;
    n.worldBoss = true;
    n.worldBossUntil = this.tickCount + WORLD_BOSS_STAY;
    this._worldBoss = n;
    this.msg(`A World Boss has appeared: ${n.name}! It's coming for you.`, 'level');
    this.banner(`<span class="big">World Boss!</span>${n.name} rises nearby`);
    this.addShake(5, 400);
    this.bus.emit('sfx', 'spec');
    return n;
  }

  /** Merchant: hire a mercenary for coins (see mercenary.js). */
  hireMercenary() { return Mercs.hire(this); }

  /** A boss winds up its special. With Knowledge Strikes on, a study question
   *  pops up first: answer it right in time to interrupt the move. */
  bossSpecial(npc) {
    if (!this.player.alive) return;
    if (this.knowledgeStrikes && !this._ks && npc.target === this.player) {
      const q = this.learning.pick();
      if (q) {
        this._ks = { npc, q, until: this.tickCount + KS_TICKS };
        this.msg(`${npc.name} gathers its power: answer the Knowledge Strike to interrupt it!`, 'combat');
        this.ui?.showKnowledgeStrike?.(q, KS_TICKS * TICK_MS, npc);
        return;
      }
    }
    this._fireBossSpecial(npc);
  }

  /** Local calendar day as YYYY-MM-DD (offset days back for "yesterday"). */
  todayKey(back = 0) {
    const d = new Date(Date.now() - back * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** The daily revision was finished: coins, a streak, and a banner. */
  finishDaily() {
    const r = this.learning.finishDaily(this.todayKey(), this.todayKey(1));
    if (!r) return null;
    this.inventory.add('coins', r.coins);
    this.msg(`Daily revision done! ${r.streak}-day streak · +${r.coins} coins.`, 'level');
    this.banner(`<span class="big">Daily revision done!</span>🔥 ${r.streak}-day streak · +${r.coins} coins`);
    this.spawnSparkle(this.player, '#ffd24a', 14);
    this.bus.emit('learning');
    return r;
  }

  /** A five-day hawker stall run finished. Wisdom XP for how close you came to
   *  the best possible profit; coins from your profit on the first run each day. */
  finishHawker(sum) {
    const L = this.learning, H = L.hawker, today = this.todayKey();
    const xp = 40 + Math.round(160 * sum.score);
    const before = L.level;
    L.xp += xp;
    const coins = H.date === today ? 0 : Math.max(0, Math.round(sum.profit * 2));
    if (coins) this.inventory.add('coins', coins);
    H.date = today; H.runs++;
    const record = sum.profit > H.best;
    if (record) H.best = sum.profit;
    if (L.level > before) this.msg(`Your Wisdom is now level ${L.level}!`, 'level');
    this.msg(`Hawker stall closed: $${sum.profit.toFixed(2)} profit (${Math.round(sum.score * 100)}% of the best possible). +${xp} Wisdom xp${coins ? `, +${coins} coins` : ''}.`, 'level');
    this.bus.emit('learning');
    return { xp, coins, record };
  }

  /** The Knowledge Strike was answered (or ran out of time: correct = false). */
  answerKnowledgeStrike(correct) {
    const ks = this._ks;
    if (!ks) return null;
    this._ks = null;
    const r = this.studyAnswer(ks.q, correct);
    const npc = ks.npc;
    if (correct && npc.alive) {
      // Interrupted: the boss staggers, takes a knowledge-shaped wound, and its special resets.
      npc.attackCooldown = Math.max(npc.attackCooldown || 0, 4);
      npc.specialCooldown = npc.def.specialEvery || 9;
      const dmg = Math.min(npc.hp - 1, Math.max(1, Math.round(npc.maxHp * 0.06)));
      if (dmg > 0) { npc.hp -= dmg; this.addHitsplat(npc, dmg, { crit: true }); }
      this.addHitsplat(npc, 0, { text: 'Interrupted!' });
      this.spawnSparkle(npc, '#7fd8ff', 16);
      this.msg(`Knowledge Strike! You interrupt ${npc.name}.`, 'combat');
      this.bus.emit('sfx', 'spec');
    } else if (npc.alive && this.player.alive) {
      this._fireBossSpecial(npc);
    }
    this.ui?.hideKnowledgeStrike?.(correct, ks.q);
    return r;
  }

  _tickKnowledgeStrike() {
    const ks = this._ks;
    if (!ks) return;
    if (!ks.npc.alive || !this.player.alive) { this._ks = null; this.ui?.hideKnowledgeStrike?.(null, ks.q); return; }
    if (this.tickCount >= ks.until) this.answerKnowledgeStrike(false);
  }

  _fireBossSpecial(npc) {
    const p = this.player;
    if (!p.alive) return;
    this.addShake(3.5, 280);
    if (npc.def.ability) { this._runBossAbility(npc, npc.def.ability); return; }
    switch (npc.def.mechanic) {
      case 'slam': {
        const { atkRoll, defRoll, max } = npcAttackVsPlayer(npc.def, this.skills, this.equipment, p.style);
        const dmg = Math.min(p.hp, Math.round(rollAttack(atkRoll, defRoll, max) * 1.6) + 2);
        p.takeDamage(dmg); this.addHitsplat(p, dmg); this.spawnHitSparks(p, '#ff5a3a'); this.bus.emit('hp');
        this.msg(`${npc.name} unleashes a crushing slam!`, 'combat');
        if (p.hp <= 0) this.playerDeath();
        break;
      }
      case 'heal': {
        npc.healCapped(npc.maxHp * 0.1); npc.combatLatch = 12;   // capped by recent damage (see NPC.healCapped)
        this.spawnSparkle(npc, '#5fe08a', 12);
        this.msg(`${npc.name} channels power and heals!`, 'combat');
        break;
      }
      case 'summon': {
        const adds = this.npcs.filter((n) => n.temporary && n.alive && !n.ally).length;
        if (adds < 4) {
          for (let i = 0; i < 2; i++) {
            const ox = npc.x + (i ? 1 : -1), oy = npc.y + 1;
            if (this.world.isBlocked(ox, oy)) continue;
            // Summoned minions always join the fight, whatever their species' temperament.
            const add = this.spawnNpc('imp', ox, oy, { temporary: true });
            add.def = { ...add.def, aggressive: true, aggroRange: 8, ignoreLevelGate: true };
            add.target = this.player;
          }
          this.msg(`${npc.name} summons minions!`, 'combat');
        }
        break;
      }
      case 'enrage': {
        if (!npc.enraged && npc.hp < npc.maxHp * 0.4) {
          npc.enraged = true;
          npc.def = { ...npc.def, attackSpeed: Math.max(2, (npc.def.attackSpeed || 5) - 1) };
          this.spawnSparkle(npc, '#ff5a3a', 14);
          this.msg(`${npc.name} flies into a rage!`, 'combat');
        }
        break;
      }
      case 'frenzy':
        this.resolveNpcAttack(npc);
        this.msg(`${npc.name} strikes in a frenzy!`, 'combat');
        break;
      default: break;
    }
  }

  /** Boss area attack: mark the ground now, strike in 3 ticks (~1.8s). Alternates
   *  between a 3x3 blast on the player and a 5x5 nova around the boss. */
  bossHazard(npc) {
    const p = this.player;
    if (!p.alive) return;
    // Each boss cycles through its own ground patterns (the default is blast / nova).
    const list = npc.def.ability?.hazards || ['blast', 'nova'];
    npc._hzi = ((npc._hzi ?? -1) + 1) % list.length;
    const pattern = list[npc._hzi];
    const squares = this._hazardSquares(pattern, npc, this.playerTile());
    const now = performance.now();
    squares.forEach((sq, i) => {
      const delay = sq.delay ?? (pattern === 'quake' ? 4 : 3);
      this.hazards.push({ ...sq, npc, kind: pattern, sign: i === 0 || sq.r > 0, fireTick: this.tickCount + delay, start: now, dur: delay * TICK_MS });
    });
    this.spawnSparkle(npc, '#ff5a5a', 10);
    this.bus.emit('sfx', 'spec');
    this.msg(HAZARD_TEXT[pattern]?.(npc.name) || `${npc.name} marks the ground. Move out of the red!`, 'combat');
  }

  /** Squares ({cx, cy, r}) covered by a ground-attack pattern. */
  _hazardSquares(pattern, npc, at) {
    const out = [];
    const near = (k) => ({ cx: at.x + Math.round((Math.random() - 0.5) * 2 * k), cy: at.y + Math.round((Math.random() - 0.5) * 2 * k) });
    switch (pattern) {
      case 'nova': out.push({ cx: npc.x, cy: npc.y, r: 2 }); break;
      case 'quake': out.push({ cx: npc.x, cy: npc.y, r: 3 }); break;
      case 'line': {   // a lane from the boss, through you and beyond
        const dx = Math.sign(at.x - npc.x), dy = Math.sign(at.y - npc.y);
        const sx = dx || (dy ? 0 : 1), sy = dy;
        for (let i = 1; i <= 9; i++) out.push({ cx: npc.x + sx * i, cy: npc.y + sy * i, r: 0 });
        break;
      }
      case 'cross':
        out.push({ cx: at.x, cy: at.y, r: 0 });
        for (let i = 1; i <= 3; i++) out.push({ cx: at.x + i, cy: at.y, r: 0 }, { cx: at.x - i, cy: at.y, r: 0 }, { cx: at.x, cy: at.y + i, r: 0 }, { cx: at.x, cy: at.y - i, r: 0 });
        break;
      case 'ring':     // everything 3 tiles out from the boss: step in close to dodge
        for (const [ox, oy] of [[-3, -3], [0, -3], [3, -3], [-3, 0], [3, 0], [-3, 3], [0, 3], [3, 3]]) out.push({ cx: npc.x + ox, cy: npc.y + oy, r: 1 });
        break;
      case 'meteors': out.push({ cx: at.x, cy: at.y, r: 1 }); for (let i = 0; i < 3; i++) out.push({ ...near(4), r: 1 }); break;
      case 'rain': for (let i = 0; i < 8; i++) out.push({ ...(i ? near(3) : { cx: at.x, cy: at.y }), r: 0 }); break;
      case 'chase': for (let i = 0; i < 3; i++) out.push({ cx: at.x, cy: at.y, r: 1, delay: 3 + i * 2, follow: i > 0 }); break;
      case 'twin': out.push({ cx: at.x - 2, cy: at.y, r: 1 }, { cx: at.x + 2, cy: at.y, r: 1 }); break;
      default: out.push({ cx: at.x, cy: at.y, r: 1 });   // blast
    }
    return out;
  }

  /** A boss's signature move: a named mix of effects (see bossAbilities.js). */
  _runBossAbility(npc, ab) {
    npc.castT = 700; npc.castCol = ab.color;   // the renderer plays the boss's cast flourish
    const p = this.player;
    this.msg(`${npc.name} uses ${ab.name}! ${ab.desc}`, 'combat');
    this.addHitsplat(npc, 0, { text: ab.name });
    this.spawnSparkle(npc, ab.color || '#ffd24a', 14);
    this.bus.emit('sfx', 'spec');
    const def = npc.def;
    for (const fx of ab.fx) {
      if (!p.alive) break;
      switch (fx.t) {
        case 'strike': {
          const { atkRoll, defRoll, max } = npcAttackVsPlayer(def, this.skills, this.equipment, p.style);
          for (let i = 0; i < (fx.hits || 1) && p.alive; i++) {
            const base = fx.sure ? rollGuaranteed(max) : rollAttack(atkRoll, defRoll, max);
            let dmg = Math.round(base * (fx.mul || 1)) + (base > 0 ? 1 : 0);
            dmg = Math.min(dmg, Math.ceil(this.maxHp() * 0.4));     // signature moves hurt, but never one-shot
            const prot = this.protectFactor();
            if (prot) dmg = Math.floor(dmg * (1 - prot));
            if (this.braceTicks > 0) dmg = Math.floor(dmg * 0.5);
            dmg = Math.min(p.hp, this._perkReduce(dmg, npc));
            p.takeDamage(dmg); this.addHitsplat(p, dmg, { crit: dmg > 0 });
            if (dmg > 0) this.spawnHitSparks(p, ab.color || '#ff5a3a');
            if (fx.steal && dmg > 0 && npc.healCapped(dmg * fx.steal) > 0) this.spawnSparkle(npc, '#5fe08a', 6);
          }
          this.bus.emit('hp');
          if (p.hp <= 0) { this.playerDeath(); return; }
          break;
        }
        case 'dot': {
          const per = Math.max(1, Math.round((def.maxHit || 1) * fx.per));
          this.playerDot = { kind: fx.kind, dmg: per, ticks: fx.ticks, from: npc.name };
          this.msg(`You are ${DOT_KINDS[fx.kind]?.name || 'hurt'}!`, 'combat');
          break;
        }
        case 'stun': this.playerStun = Math.max(this.playerStun, fx.ticks); break;
        case 'root': this.playerRoot = Math.max(this.playerRoot, fx.ticks); p.path = []; this.msg('You are held in place!', 'combat'); break;
        case 'pull': this._movePlayerNear(npc.x, npc.y, 1); break;
        case 'knock': {
          const dx = Math.sign(p.x - npc.x) || 1, dy = Math.sign(p.y - npc.y);
          for (let d = fx.dist; d > 0; d--) {
            const tx = p.x + dx * d, ty = p.y + dy * d;
            if (this.world.inBounds(tx, ty) && !this.world.isBlocked(tx, ty)) { this._placePlayer(tx, ty); break; }
          }
          break;
        }
        case 'blink': {
          const t = this._nearestFree(p.x + (Math.sign(npc.x - p.x) || 1), p.y);
          if (t) { npc.x = npc.tx = t.x; npc.y = npc.ty = t.y; npc.path = []; this.spawnPoof(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, ab.color || '#ffffff'); }
          break;
        }
        case 'heal': if (npc.healCapped(npc.maxHp * fx.frac) > 0) this.spawnSparkle(npc, '#5fe08a', 10); break;   // capped by recent damage (see NPC.healCapped)
        case 'shield': npc.shieldTicks = Math.max(npc.shieldTicks || 0, fx.ticks); this._buffedBosses.add(npc); break;
        case 'reflect': npc.reflectTicks = Math.max(npc.reflectTicks || 0, fx.ticks); npc.reflectFrac = fx.frac; this._buffedBosses.add(npc); break;
        case 'summon': {
          const adds = this.npcs.filter((n) => n.temporary && n.alive && !n.ally).length;
          for (let i = 0; i < fx.n && adds + i < 6; i++) {
            const t = this._nearestFree(npc.x + (i % 2 ? 1 : -1), npc.y + 1);
            if (!t) continue;
            const add = this.spawnNpc(fx.id, t.x, t.y, { temporary: true });
            if (!add) continue;
            add.def = { ...add.def, aggressive: true, aggroRange: 8, ignoreLevelGate: true };
            add.target = p;
          }
          break;
        }
        case 'enrage':
          if (!npc.enraged) {
            npc.enraged = true;
            npc.def = { ...npc.def, attackSpeed: Math.max(2, (npc.def.attackSpeed || 5) - 1) };
            this.spawnSparkle(npc, '#ff5a3a', 14);
            this.msg(`${npc.name} flies into a rage!`, 'combat');
          }
          break;
        case 'drain':
          if (fx.adrenaline) { this.adrenaline = Math.max(0, (this.adrenaline || 0) - fx.adrenaline); this.bus.emit('ability'); }
          if (fx.run) { this.runEnergy = Math.max(0, this.runEnergy - fx.run); this.bus.emit('run'); }
          break;
        default: break;
      }
    }
  }

  /** Move the player to the free tile nearest (x, y) within `r` of it. */
  _movePlayerNear(x, y, r = 1) {
    for (let d = 1; d <= r + 2; d++) {
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        if (this.world.inBounds(x + dx, y + dy) && !this.world.isBlocked(x + dx, y + dy)) { this._placePlayer(x + dx, y + dy); return; }
      }
    }
  }

  _placePlayer(x, y) {
    const p = this.player;
    p.stopNow?.(); p.path = [];
    p.x = p.tx = x; p.y = p.ty = y; p.progress = 0; p.moving = false;
  }

  /** Each world tick: damage over time on the player, root countdown, boss shield/reflect timers. */
  _tickBossEffects() {
    const p = this.player;
    if (this.playerRoot > 0) this.playerRoot--;
    // Regeneration / Fortitude perks.
    const regen = this.perkMods('defence').regen || 0;
    if (regen && p.alive && p.hp < this.maxHp()) {
      this._regenAcc = (this._regenAcc || 0) + regen;
      if (this._regenAcc >= 1) { const h = Math.floor(this._regenAcc); this._regenAcc -= h; p.hp = Math.min(this.maxHp(), p.hp + h); this.bus.emit('hp'); }
    }
    const d = this.playerDot;
    if (d && p.alive) {
      const dmg = Math.min(p.hp, Math.max(1, Math.round(d.dmg * (1 - (this.perkMods('defence').dotReduce || 0)))));
      p.takeDamage(dmg);
      this.addHitsplat(p, dmg, { tint: DOT_KINDS[d.kind]?.color });
      this.bus.emit('hp');
      if (--d.ticks <= 0) this.playerDot = null;
      if (p.hp <= 0) { this.playerDot = null; this.playerDeath(); }
    } else if (d) this.playerDot = null;
    for (const n of this._buffedBosses) {
      if (n.shieldTicks > 0) n.shieldTicks--;
      if (n.reflectTicks > 0) n.reflectTicks--;
      if (!n.alive || (!(n.shieldTicks > 0) && !(n.reflectTicks > 0))) this._buffedBosses.delete(n);
    }
  }

  /** Is this tile inside any pending boss attack? */
  hazardAt(x, y) {
    return this.hazards.some((h) => Math.abs(x - h.cx) <= h.r && Math.abs(y - h.cy) <= h.r);
  }

  _resolveHazards() {
    if (!this.hazards.length) return;
    const p = this.player;
    const keep = [];
    for (const h of this.hazards) {
      if (!h.npc.alive || !p.alive) continue;               // the boss fell: its attack fizzles
      if (chebyshev(p.x, p.y, h.cx, h.cy) > 15) continue;   // you've left (teleported away)
      // Follow-up blasts (the "chase" pattern) re-aim at you just before they land.
      if (h.follow && !h.aimed && this.tickCount >= h.fireTick - 2) {
        const t0 = this.playerTile(); h.cx = t0.x; h.cy = t0.y; h.aimed = true; h.start = performance.now(); h.dur = 2 * TICK_MS;
      }
      if (this.tickCount < h.fireTick) { keep.push(h); continue; }
      this.effects.push({ type: 'blast', x: h.cx * TILE + TILE / 2, y: h.cy * TILE + TILE / 2, r: (h.r + 0.5) * TILE, life: 380, maxLife: 380 });
      this.addShake(3.5, 260);
      const t = this.playerTile();
      if (Math.abs(t.x - h.cx) <= h.r && Math.abs(t.y - h.cy) <= h.r) {
        const { max } = npcAttackVsPlayer(h.npc.def, this.skills, this.equipment, p.style);
        let dmg = Math.min(Math.round(max * 1.8) + 2, Math.ceil(this.maxHp() * 0.45));  // hurts, never one-shots
        const prot = this.protectFactor();
        if (prot) dmg = Math.floor(dmg * (1 - prot));
        if (this.braceTicks > 0) dmg = Math.floor(dmg * 0.5);
        dmg = Math.min(p.hp, this._perkReduce(dmg, h.npc));
        p.takeDamage(dmg); this.addHitsplat(p, dmg, { crit: true }); this.spawnHitSparks(p, '#ff5a3a');
        this.bus.emit('sfx', 'hurt'); this.bus.emit('hp');
        this.msg(`${h.npc.name}'s attack hits you for ${dmg}!`, 'combat');
        if (p.hp <= 0) { this.playerDeath(); break; }
      } else {
        this.addHitsplat(p, 0, { text: 'Dodged!' });
        this._gainAdrenaline(8);                              // a clean dodge pays out
        this._dodgeXp(h.npc);
        this.msg(`You dodge ${h.npc.name}'s attack!`, 'combat');
      }
    }
    this.hazards = p.alive ? keep : [];
  }

  playerDeath() {
    this.msg('Oh dear, you are dead!', 'combat');
    this._dodging = false;
    this.killStreak = 0; this.bus.emit('xpbonus');
    if (this.autoBattle) this.toggleAutoBattle(false);
    if (this.autoQuest) this.toggleAutoQuest(false, 'you died.');
    this.banner('<span class="big">Oh dear, you are dead!</span>Respawning in town...');
    const p = this.player;
    p.alive = false;
    p.respawnTimer = RESPAWN_TICKS;
    p.stopNow();
    p.clearAction();
    for (const n of this.npcs) if (n.target === p) { n.target = null; }
    this.ui?.closeModal();
  }

  respawnPlayer() {
    const p = this.player;
    const rp = this.world.respawnPoint;
    p.alive = true;
    p.hp = this.maxHp();
    p.x = p.tx = rp.x;
    p.y = p.ty = rp.y;
    p.progress = 0;
    p.moving = false;
    p.path = [];
    this.regenCounter = 0;
    this.msg(`You wake up back in ${this.world.townName}.`, 'system');
    this.bus.emit('hp');
  }

  // ---------------- Begin actions (from input / UI) ----------------
  beginAction(action, target, adjacent) {
    const start = this.playerTile();
    const reached = adjacent
      ? chebyshev(start.x, start.y, target.x, target.y) <= 1
      : start.x === target.x && start.y === target.y;
    if (!reached) {
      const path = findPath(this.pathCfg(), start, target, { reachAdjacent: adjacent, maxNodes: this._pathBudget || 6000 });
      if (!path.length) { this.msg("I can't reach that."); return false; }
      this.player.setPath(path, this.canRun());
    } else {
      this.player.setPath([], false); // stop after current step
    }
    this.player.setAction(action);
    if (reached && !this.player.isMoving) this._kickoff(action);
    return true;
  }

  /** Respond to a press right away instead of on the next 0.6s tick. One-shot
   *  actions (talk, bank, shop, pick up...) fire now; gathering starts its swing
   *  now but keeps its normal roll timing, so tapping fast can't gather faster. */
  _kickoff(a) {
    if (INSTANT_ACTIONS.has(a.type)) { this.resolvePlayerAction(); return; }
    if (a.obj && GATHER_ACTIONS.has(a.type)) this._swingToward(this.player, a.obj.x, a.obj.y);
  }

  // ---------------- Auto battle ----------------
  /** One-line description of what auto battle is doing, for the HUD. */
  autoStatus() {
    if (!this.autoBattle) return 'Off';
    const p = this.player;
    const at = this.playerTile();
    if (this.hazards.some((h) => Math.abs(at.x - h.cx) <= h.r + 1 && Math.abs(at.y - h.cy) <= h.r + 1)) return 'Dodging!';
    const a = p.action;
    if (a && a.type === 'attack' && a.npc && a.npc.alive) {
      const inRange = chebyshev(p.x, p.y, a.npc.x, a.npc.y) <= this.attackRange();
      return `${inRange ? 'Fighting' : 'Heading to'} ${a.npc.name}`;
    }
    return 'Looking for a fight…';
  }

  toggleAutoBattle(on = !this.autoBattle) {
    this.autoBattle = !!on;
    this._autoSkip.clear();
    this._autoLast = null;
    if (this.autoBattle) this._autoRetarget = true;   // start at once, not on the next tick
    this.msg(this.autoBattle
      ? 'Auto battle on: you will hunt nearby monsters, eat when hurt and use your skills. Steer to pause.'
      : 'Auto battle off.', 'system');
    this.bus.emit('autobattle');
  }

  // Runs each world tick while auto battle is on: keep yourself fed, counter a
  // telegraphed blow, spend adrenaline on skills, and pick the next fight.
  _autoBattleTick() {
    const p = this.player;
    if (!this.autoBattle || !p.alive || this._driving) return;
    // 0. Out of ammunition: stop rather than walking at targets it can't hit.
    const mode = this.combatMode();
    const wpnNoAmmo = !!getItem(this.equipment.get('weapon') || 'coins').equip?.noAmmo;   // pistols and shurikens
    const noAmmo = mode === 'ranged' ? !wpnNoAmmo && !this.inventory.slots.some((sl) => sl && getItem(sl.id).tags?.includes('ammo'))
      : mode === 'magic' ? !this.bestSpell() : false;
    if (noAmmo) {
      this.msg(mode === 'ranged' ? 'Auto battle stopped: you have no arrows left.' : 'Auto battle stopped: you are out of runes for your spell.', 'system');
      this.toggleAutoBattle(false);
      return;
    }
    // 0a. A Merchant in a fight hires one more mercenary every tick, with no
    //     limit, as long as a reserve of three hires' worth of coins is left.
    if (this.jobClass === 'merchant' && p.action?.type === 'attack' && p.action.npc?.alive
      && this.inventory.count('coins') >= Mercs.hireCost(this) * 3) this.hireMercenary();
    // (Auto battle no longer steps out of boss ground markers: dodging is yours to do.)
    if (this._autoResume) {
      const n = this._autoResume;
      this._autoResume = null;
      if (n.alive) { this.attackNpc(n); return; }
    }
    // 1. Stay alive: eat below the chosen life level, or Second Wind when out of food.
    if (this.autoCfg.eatAt > 0 && p.hp <= this.maxHp() * this.autoCfg.eatAt) {
      const idx = this.inventory.slots.findIndex((sl) => sl && getItem(sl.id).heal);
      if (idx !== -1) this.eatItem(idx);
      else this._autoAbility((ab) => ab.kind === 'heal');
    }
    const a = p.action;
    const fighting = a && a.type === 'attack' && a.npc && a.npc.alive;
    // A target we just sent you at that cleared itself without dying was
    // unreachable: skip it for a while instead of retrying every tick.
    if (!fighting && this._autoLast && this._autoLast.alive) {
      this._autoSkip.set(this._autoLast.entityId, this.tickCount + 40);
    }
    this._autoLast = fighting ? a.npc : null;
    if (fighting) {
      // Give up on a target when the chase drags on (~24s without getting in
      // range: it keeps wandering off or can't be reached) or the fight stalls
      // (~12s in range without landing any damage).
      const tgt = a.npc;
      const dist = chebyshev(p.x, p.y, tgt.x, tgt.y);
      const inRange = dist <= this.attackRange();
      if (this._autoFight?.npc !== tgt) this._autoFight = { npc: tgt, hp: tgt.hp, since: this.tickCount, chase: this.tickCount, best: dist };
      const f = this._autoFight;
      if (!inRange) f.since = this.tickCount;              // the stall clock only runs in range
      // The chase clock only runs while you aren't getting any closer, so a long
      // walk to a far target (or a walk without run energy) never gives up early.
      if (inRange || dist < f.best) { f.chase = this.tickCount; f.best = Math.min(f.best, dist); }
      if (tgt.hp < f.hp) { f.hp = tgt.hp; f.since = this.tickCount; }
      if (this.tickCount - f.since > 20 || this.tickCount - f.chase > 25) {
        this._autoSkip.set(tgt.entityId, this.tickCount + 60);
        this._autoLast = null; this._autoFight = null;
        p.clearAction();
        return;
      }
      // Still chasing a target that isn't fighting back while something else is
      // already hitting you from within reach: turn and deal with that first.
      if (!inRange && tgt.target !== p) {
        const att = this.nearbyNpcs().find((n) => n !== tgt && n.alive && n.attackable && !n.ally && n.target === p
          && chebyshev(p.x, p.y, n.x, n.y) <= Math.max(1, this.attackRange()));
        if (att) { this._autoFight = null; this._autoLast = att; this.attackNpc(att); return; }
      }
      // Casters always throw the strongest spell they can afford.
      // Casters on 'Auto' get the element that suits the target; a chosen element is kept.
      if (this.combatMode() === 'magic' && p.spellAuto) { const best = this._autoSpellFor(tgt); if (best && best.id !== p.spell) { p.spell = best.id; this.bus.emit('spell'); } }
      // 2-3. Defend, then build and spend adrenaline (see _autoSkills).
      this._autoSkills(tgt);
      return;
    }
    // 4. Find the next fight. A monster well below your level is only fought
    //    when nothing in your level band can be reached: otherwise auto battle
    //    walks you to the nearest monsters of your level, fighting anything
    //    that attacks you on the way.
    const target = this._autoPickTarget();
    const weakPick = target && this._autoIsWeak(target);
    if ((!target || weakPick) && this._autoTravel && p.isMoving) return;   // still on the way
    this._autoTravel = null;
    if ((!target || weakPick) && this.tickCount >= (this._autoHeadNext || 0)) {
      if (this._autoHeadToLevel()) return;
      this._autoHeadNext = this.tickCount + 10;   // no route found: look again in a few seconds, not every tick
    }
    if (target) { this._autoLast = target; this._autoIdleSaid = false; this.attackNpc(target); }
    else if (!this._autoIdleSaid) {
      this._autoIdleSaid = true;
      this.msg('Auto battle: nothing to fight nearby. Walk somewhere wilder and it will pick up again.', 'system');
    }
  }

  /** The lowest monster level auto battle counts as "your level": three
   *  quarters of your combat level, but never above 85% of the strongest
   *  ordinary monster you could go to (so the very top players still have
   *  something in their band). */
  _autoBandLo(inWild) {
    const cl = this.fightLevel();
    if (this._autoTopFor !== inWild || this._autoTop == null) {
      let top = 1;
      for (const n of this.npcs) {
        if (!n.def.attackable || n.def.boss || n.temporary || n.ally) continue;
        if (!inWild && this.world.zoneAt(n.x, n.y)?.wilderness) continue;
        top = Math.max(top, n.def.level || 1);
      }
      this._autoTop = top; this._autoTopFor = inWild;
    }
    return Math.min(Math.floor(cl * 0.75), Math.floor(this._autoTop * 0.85));
  }

  /** A pick auto battle would rather walk past: an ordinary monster well below
   *  your level that isn't fighting you (bosses, champions, attackers, a chosen
   *  monster type or a quest hunt always count). */
  _autoIsWeak(n) {
    if (n.def.boss || n.champion || n.target === this.player || this.autoCfg.target || this._questTarget) return false;
    const inWild = !!this.world.zoneAt(this.player.x, this.player.y)?.wilderness;
    return (n.def.level || 1) < this._autoBandLo(inWild);
  }

  /** Walk towards the nearest monster in your level band (up to 20 levels
   *  above you), outside the Wilderness unless you are in it. True if a route
   *  was found and the walk has started. */
  _autoHeadToLevel() {
    const p = this.player, cl = this.fightLevel();
    const inWild = !!this.world.zoneAt(p.x, p.y)?.wilderness;
    const lo = this._autoBandLo(inWild);
    if (lo <= 1) return false;
    let best = null, bd = Infinity;
    for (const n of this.npcs) {
      if (!n.alive || !n.attackable || n.def.boss || n.champion || n.temporary || n.ally || n.def.fixed) continue;
      const lvl = n.def.level || 1;
      if (lvl < lo || lvl > cl + 20) continue;
      if ((this._autoSkip.get(n.entityId) || 0) > this.tickCount) continue;
      if (!inWild && this.world.zoneAt(n.x, n.y)?.wilderness) continue;
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) return false;
    const t = this._nearestFree(best.x, best.y);
    const path = t && findPath(this.pathCfg(), this.playerTile(), t, { maxNodes: 150000 });
    if (!path || !path.length) { this._autoSkip.set(best.entityId, this.tickCount + 100); return false; }
    p.setPath(path, this.canRun()); p.clearAction();
    this._autoTravel = { x: t.x, y: t.y };
    this.msg(`Auto battle: heading to monsters of your level (${best.name}, level ${best.def.level}).`, 'system');
    return true;
  }

  /** Auto battle's spell for a target: the element that hits it hardest (its
   *  damage x the race matchup), or Earth when a crowd stands within its reach. */
  _autoSpellFor(tgt) {
    const ok = SPELLS.filter((sp) => this.skills.magic >= sp.level && this._hasRunes(sp));
    if (!ok.length) return null;
    const race = raceOf(tgt.def, tgt.npcId);
    const crowd = this.nearbyNpcs().filter((n) => n !== tgt && n.alive && n.attackable && !n.ally && !n.def.fixed
      && chebyshev(n.x, n.y, tgt.x, tgt.y) <= 5).length;
    const value = (sp) => {
      const el = ELEMENTS[sp.element] || {};
      const m = elementMatchup(sp.element, race);
      // Damage per second from the casts alone (an average hit, the race matchup, the cast speed).
      const hit = playerMagicVsNpc(this.skills, this.equipment, sp, tgt.def).max * 0.625;
      const d = Math.max(1, hit * (m === 'strong' ? RACE_BONUS.dmg : m === 'weak' ? RACE_PENALTY.dmg : 1)
        / (this.attackInterval(sp) * COMBAT_BEAT_MS / 1000));
      // Fire's Ignite: every cast adds a burn of share x its hit every second until
      // the foe dies, so it pays off more the longer the fight. Work out how long
      // the kill takes: with burns the damage dealt by time T is d*T*(1 + share*T/2),
      // so a foe with hp life falls at T = (sqrt(1 + 2*share*hp/d) - 1) / share, and
      // the spell is worth hp/T. On a quick kill Wind's double cast speed wins;
      // on a long fight (a boss, a champion) Fire pulls far ahead.
      let v = d;
      if (el.ignite) {
        const s = el.ignite.share, hp = Math.max(1, tgt.hp);
        v = hp / ((Math.sqrt(1 + 2 * s * hp / d) - 1) / s);
      }
      // Area damage: Earth reaches everyone within 5 tiles, the rest only within 2.
      const near = el.aoeRadius ? crowd : this.nearbyNpcs().filter((n) => n !== tgt && n.alive && n.attackable && !n.ally && !n.def.fixed
        && chebyshev(n.x, n.y, tgt.x, tgt.y) <= AOE_RADIUS).length;
      return v * (1 + near);
    };
    return ok.reduce((a, b) => (value(b) > value(a) ? b : a));
  }

  /** Nearest walkable tile (within 4) that no boss attack is about to hit. */
  _safeTileNear(at) {
    for (let r = 1; r <= 4; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = at.x + dx, y = at.y + dy;
        if (!this.world.inBounds(x, y) || this.world.isBlocked(x, y) || this.hazardAt(x, y)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { x, y }; }
      }
      if (best) return best;
    }
    return null;
  }

  /** Auto battle's skill rotation, run each tick of a fight:
   *  - defend first: your class's guard or defensive move (C) when a heavy blow
   *    is being wound up, a boss is on you or you're under half life;
   *  - the ultimate (B) at full adrenaline, but only on a fight worth it (a boss
   *    or champion, a crowd, or a foe with plenty of life left);
   *  - the threshold skill (X) on the same kind of fight, or to avoid sitting
   *    on a full bar the ultimate can't use;
   *  - the free basic skills (Z, and an attacking C) whenever they're ready,
   *    since they build the adrenaline the others spend.
   *  Big skills are held back from a foe that's about to drop anyway. */
  _autoSkills(tgt) {
    if (!this.autoCfg.abilities || !tgt?.alive) return;
    const p = this.player;
    const ready = (k, f = () => true) => this.currentAbilities().find((ab) => ab.key === k && f(ab) && this.abilityUnlocked(ab)
      && (this.abilityCd[ab.id] || 0) <= 0 && this.canAffordAbility(ab));
    const near = this.nearbyNpcs();
    const attackers = near.filter((n) => n.alive && n.target === p && !n.ally).length;
    const crowd = near.filter((n) => n !== tgt && n.alive && n.attackable && !n.ally && chebyshev(n.x, n.y, tgt.x, tgt.y) <= 3).length;
    const hit = Math.max(1, this._autoHitAvg || 1);   // your recent landed hit
    const big = tgt.def.boss || tgt.champion;
    const worth = (mult) => big || attackers >= 2 || crowd >= 2 || tgt.hp > hit * mult;
    const hpFrac = p.hp / this.maxHp();
    const danger = big || hpFrac < 0.5 || near.some((n) => n.alive && n.target === p && n.windup > 0);
    // Defend.
    const defensive = (ab) => ab.kind === 'guard' || (ab.kind === 'heal' ? hpFrac < 0.6 : ab.kind === 'buff' && (ab.buff?.reduce || ab.buff?.dodge || ab.buff?.lifesteal));
    if (danger) { const c = ready('C', defensive); if (c) this.activateAbility(c.id); }
    if (hpFrac < 0.35) { const v = ready('V'); if (v) this.activateAbility(v.id); }
    // Spend.
    const buffUp = this.buff && this.buff.until > this.tickCount;
    const ult = ready('B');
    if (ult && !this.armedAbility && worth(4)) { this.activateAbility(ult.id); return; }
    const x = ready('X');
    const capped = this.adrenaline >= 100 && (!ult || !worth(4));
    if (x && (x.kind !== 'buff' || !buffUp) && (worth(3) || capped)) this.activateAbility(x.id);
    // Build.
    if (!this.armedAbility) {
      const c = ready('C', (ab) => ab.kind === 'attack' && (!ab.lifesteal || hpFrac < 0.8));
      const z = ready('Z');
      const pick = c || z;
      if (pick) this.activateAbility(pick.id);
    }
  }

  _autoAbility(filter, biggestFirst = false) {
    const ready = this.currentAbilities().filter((ab) => filter(ab) && this.abilityUnlocked(ab)
      && (this.abilityCd[ab.id] || 0) <= 0 && this.canAffordAbility(ab));
    if (!ready.length) return false;
    if (biggestFirst) ready.sort((x, y) => y.cost - x.cost);
    this.activateAbility(ready[0].id);
    return true;
  }

  // Nearby first (anything already on you wins); with nothing close, hunt out to
  // 40 tiles for a monster near your level, never straying into the Wilderness
  // from safe ground.
  _autoPickTarget() {
    // Archers and casters clear everything already in reach before moving:
    // in-range targets outrank everything out of range (bosses included).
    const range = this.attackRange();
    const shootable = (n, d) => range > 1 && d <= range;
    const p = this.player;
    const cl = this.fightLevel();
    const wildZone = (x, y) => !!this.world.zoneAt(x, y)?.wilderness;
    const inWild = wildZone(p.x, p.y);
    let best = null, bestScore = Infinity;
    const cands = [];
    // Only monsters near you matter here, and pack counts only look at those (see nearbyNpcs).
    const near = this.nearbyNpcs();
    let packAt = null;
    // Bosses and champions are fair game at any level now (they used to be
    // skipped when well above you, which made auto battle look like it ignored them).
    const canTake = () => true;
    for (const n of near) {
      if (!n.alive || !n.attackable) continue;
      const d = chebyshev(p.x, p.y, n.x, n.y);
      if (d > Math.max(25, range + 2)) continue;   // a Sniper picks off monsters from further still
      const hunting = n.target === p;
      // Anything already fighting you (a boss, its summoned adds, a champion)
      // is always answered, whatever its level or where it stands.
      if (hunting) {
        const tier = n.def.boss ? -3000 : n.champion ? -2000 : -200 - (shootable(n, d) ? 1000 : 0);
        cands.push({ n, score: d + tier, tier });
        continue;
      }
      if (n.temporary) continue;
      if (n.def.boss && !this.autoCfg.bosses) continue;
      if ((this._autoSkip.get(n.entityId) || 0) > this.tickCount) continue;
      if (this.autoCfg.target && n.npcId !== this.autoCfg.target) continue;   // only the chosen monster type
      if (this._questTarget && n.npcId !== this._questTarget) continue;       // a quest hunt (e.g. rats for Pest Control)
      // Bosses within reach are taken on whatever their level, ahead of everything else.
      // Story bosses (fixed spawns like the Lion of Light) and bosses far beyond
      // your level are left for you to take on yourself.
      if (n.def.boss) {
        if (n.def.fixed || !canTake(n.def.level || 1)) continue;   // story bosses are yours to start; only bosses you can realistically beat
        if (!inWild && wildZone(n.x, n.y)) continue;
        // "Bosses & champions first": a boss outranks everything, even monsters already in reach.
        { const tier = this.autoCfg.priority !== false ? -3000 : -300 - (shootable(n, d) ? 1000 : 0); cands.push({ n, score: d + tier, tier }); }
        continue;
      }
      // Then mini-bosses: gold-ringed champions within reach that you can take on.
      if (n.champion) {
        if (this.autoCfg.champions === false) continue;   // "Champions: Skip"
        if (!canTake(n.def.level || 1) || (!inWild && wildZone(n.x, n.y))) continue;
        { const tier = this.autoCfg.priority !== false ? -2000 : -150 - (shootable(n, d) ? 1000 : 0); cands.push({ n, score: d + tier, tier }); }
        continue;
      }
      const lvl = n.def.level || 1;
      // Close by: fight anything. Further out: only walk to monsters up to a
      // little above your level, so a hunt is worth the walk.
      if (d > 10 && lvl > cl + 20) continue;
      // Monsters well below your level rank behind any in your level band.
      const weak = !this.autoCfg.target && !this._questTarget && lvl < this._autoBandLo(inWild);
      if (!inWild && wildZone(n.x, n.y)) continue;
      // Anything within 8 tiles first, then the rest. Among those, a monster in
      // a pack (every hit cleaves or splashes into its neighbours) and one
      // already hurt (a quick kill) are worth a few tiles' extra walk.
      // Pack size from a per-tile count of nearby monsters (25 lookups, not a scan of every monster).
      if (!packAt) {
        packAt = new Map();
        for (const o of near) if (o.alive && o.attackable && !o.ally && !o.temporary) { const k = o.x * 4096 + o.y; packAt.set(k, (packAt.get(k) || 0) + 1); }
      }
      let pack = -1;   // not counting itself
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) pack += packAt.get((n.x + dx) * 4096 + n.y + dy) || 0;
      const hurt = n.maxHp ? 1 - n.hp / n.maxHp : 0;
      const tier = (d > 8 ? 50 : 0) - (shootable(n, d) ? 1000 : 0) - Math.min(3, pack) * 1.5 - hurt * 3 + (weak ? 2000 : 0);
      cands.push({ n, score: d + tier, tier });
    }
    // Nearest first by straight-line distance, then confirm a walkable route
    // (and use its real length) so it never heads for something across water.
    cands.sort((a, b) => a.score - b.score);
    // Route checks are the costly part: only the best few candidates get one.
    for (const { n, score, tier } of cands.slice(0, 4)) {
      // Already in reach (or adjacent): no walking needed, so no route check.
      if (chebyshev(p.x, p.y, n.x, n.y) <= Math.max(1, range)) { if (score < bestScore) { bestScore = score; best = n; } continue; }
      const route = findPath(this.pathCfg(), this.playerTile(), { x: n.x, y: n.y }, { reachAdjacent: true, maxNodes: 8000 });
      if (!route.length) { this._autoSkip.set(n.entityId, this.tickCount + 40); continue; }
      // Keep the priority tier (boss > something attacking you > champion > rest) over route length.
      const real = route.length + tier;
      if (real < bestScore) { bestScore = real; best = n; }
    }
    return best;
  }

  /** Joystick / WASD: the held direction as an analogue vector (screen axes). */
  setMoveInput(x, y) {
    this.moveInput.x = x || 0;
    this.moveInput.y = y || 0;
  }

  // While a direction is held the player glides that way at full speed (a
  // light push walks slower), sliding along walls, MOBA style. Steering
  // cancels whatever the player was doing (skilling, fighting, a clicked route).
  _driveMovement() {
    const p = this.player, v = this.moveInput;
    const held = Math.hypot(v.x, v.y) >= 0.3;
    if (!held || !p.alive || this.playerStun > 0 || this.playerRoot > 0) {
      p.stick = null;
      if (!held || !p.alive) this._driving = false;
      return;
    }
    if (!this._driving) {
      this._driving = true;
      this._autoLife = null;   // steering away ends any auto gather loop
      // Bows and spells keep firing while you steer (handy for dodging); other actions stop.
      const shooting = p.action?.type === 'attack' && this.attackRange() > 1;
      if (p.action && !shooting) p.clearAction();
      p.path = [];           // drop any clicked route
    }
    p.running = this.canRun();
    p.stick = { x: v.x, y: v.y };
  }

  walkTo(tile) {
    if (!this.world.inBounds(tile.x, tile.y)) return;
    this._autoLife = null;   // walking off yourself ends any auto gather loop
    const start = this.playerTile();
    if (start.x === tile.x && start.y === tile.y) { this.player.clearAction(); return; }
    let path = findPath(this.pathCfg(), start, tile, {});
    if (!path.length) path = findPath(this.pathCfg(), start, tile, { reachAdjacent: true });
    if (path.length) { this.player.setPath(path, this.canRun()); this.player.clearAction(); }
  }

  /** Long-range walk used by the world map; snaps to the nearest walkable tile. */
  walkToFar(tile) {
    this._autoLife = null;
    const t = this._nearestFree(tile.x, tile.y);
    if (!t) { this.msg("I can't reach there."); return; }
    if (this.playerTile().x === t.x && this.playerTile().y === t.y) return;
    const path = findPath(this.pathCfg(), this.playerTile(), t, { maxNodes: this._pathBudget || 40000 });
    if (path.length) { this.player.setPath(path, this.canRun()); this.player.clearAction(); this.msg('You set off across the island.', 'system'); }
    else this.msg("I can't find a path there.");
  }

  attackNpc(npc) {
    if (!npc.attackable) { this.msg("You can't attack that."); return; }
    const p0 = this.player;
    if (this.attackRange() > 1 && chebyshev(p0.x, p0.y, npc.x, npc.y) <= this.attackRange()) {
      // Bows and spells: already in reach, so shoot from right here.
      if (!this._driving && !this._dodging) p0.path = [];
      p0.setAction({ type: 'attack', npc });
    } else if (this.attackRange() > 1) {
      // Out of reach: walk only as far as the first tile in range.
      p0.setAction({ type: 'attack', npc });
      this._tickAttack(p0.action);
    } else this.beginAction({ type: 'attack', npc }, { x: npc.x, y: npc.y }, true);
    // Already in range and ready: swing now rather than on the next combat beat.
    const p = this.player;
    if (!p.isMoving && !this.playerStun && p.attackCooldown <= 0 && p.alive
      && chebyshev(p.x, p.y, npc.x, npc.y) <= this.attackRange()) this.doPlayerAttack(npc);
  }

  defaultNpcAction(npc) {
    if (npc.attackable) return this.attackNpc(npc);
    if (npc.def.role === 'shop') return this.beginAction({ type: 'openshop', shop: npc.def.shop, target: { x: npc.x, y: npc.y } }, { x: npc.x, y: npc.y }, true);
    if (npc.def.role === 'bank') return this.beginAction({ type: 'openbank', target: { x: npc.x, y: npc.y } }, { x: npc.x, y: npc.y }, true);
    return this.beginAction({ type: 'talk', npc, target: { x: npc.x, y: npc.y } }, { x: npc.x, y: npc.y }, true);
  }

  defaultObjectAction(obj) {
    const t = obj.def.type;
    const tgt = { x: obj.x, y: obj.y };
    switch (t) {
      case 'tree': return this.beginAction({ type: 'woodcut', obj }, tgt, true);
      case 'rock': return this.beginAction({ type: 'mine', obj }, tgt, true);
      case 'fishing': return this.beginAction({ type: 'fish', obj }, tgt, true);
      case 'fire': case 'range': return this.beginAction({ type: 'cookmenu', obj, target: tgt }, tgt, true);
      case 'furnace': return this.beginAction({ type: 'smeltmenu', obj, target: tgt }, tgt, true);
      case 'anvil': return this.beginAction({ type: 'smithmenu', obj, target: tgt }, tgt, true);
      case 'craft': return this.beginAction({ type: 'craftmenu', obj, target: tgt }, tgt, true);
      case 'hunt': return this.beginAction({ type: 'hunt', obj }, tgt, true);
      case 'fletch': return this.beginAction({ type: 'fletchmenu', obj, target: tgt }, tgt, true);
      case 'herblore': return this.beginAction({ type: 'herbmenu', obj, target: tgt }, tgt, true);
      case 'farm': return this.beginAction({ type: 'farm', obj, target: tgt }, tgt, true);
      case 'bank': return this.beginAction({ type: 'openbank', target: tgt }, tgt, true);
      case 'shrine': return this.beginAction({ type: 'pray', obj }, tgt, true);
      case 'rest': return this.beginAction({ type: 'rest', obj }, tgt, true);
      case 'agility': return this.beginAction({ type: 'agility', obj }, tgt, true);
      case 'stall': return this.beginAction({ type: 'stall', obj }, tgt, true);
      case 'transport': return this.beginAction({ type: 'transport', obj, target: tgt }, tgt, true);
      default: return this.walkTo(tgt);
    }
  }

  doPickup(gi) {
    if (!this.world.groundItems.includes(gi)) return;
    const space = this.inventory.canAdd(gi.id, gi.qty);
    if (space <= 0) { this.msg("You don't have enough inventory space."); return; }
    const added = this.inventory.add(gi.id, Math.min(space, gi.qty));
    gi.qty -= added;
    this.msg(`You pick up ${added > 1 ? added + ' x ' : ''}${getItem(gi.id).name}.`);
    this.bus.emit('sfx', 'pickup');
    if (gi.qty <= 0) this.world.removeGroundItem(gi);
    else this.bus.emit('grounditems');
  }

  pickup(gi) {
    this.beginAction({ type: 'pickup', gi }, { x: gi.x, y: gi.y }, false);
  }

  // ---------------- Inventory / equipment actions ----------------
  /** Eat the first food in the inventory (quick-eat hotkey). */
  eatFirstFood() {
    const idx = this.inventory.slots.findIndex((s) => s && getItem(s.id).heal);
    if (idx === -1) { this.msg('You have no food to eat.'); return; }
    this.eatItem(idx);
  }

  eatItem(index) {
    const s = this.inventory.slotAt(index);
    if (!s) return;
    const item = getItem(s.id);
    if (!item.heal) { this.msg(`You can't eat the ${item.name.toLowerCase()}.`); return; }
    this.inventory.removeAt(index, 1);
    this.player.hp = Math.min(this.maxHp(), this.player.hp + item.heal);
    this.msg(`You eat the ${item.name.toLowerCase()}.`);
    this.bus.emit('sfx', 'eat');
    this.bus.emit('hp');
  }

  /** Can this piece be worn right now (levels, class weapon and class armour)? Silent. */
  _canEquipNow(id) {
    const it = getItem(id), eq = it.equip;
    if (!eq || it.tool) return false;
    for (const [sk, lvl] of Object.entries(eq.req || {})) if (this.skills.level(sk) < lvl) return false;
    const cls = this.jobClass && CLASS_BY_ID[this.jobClass];
    if (cls && eq.weaponType && eq.weaponType !== cls.weapon) return false;
    return !cls || canWear(cls.id, id);
  }

  /** Best in slot: put on the strongest piece in the backpack for every slot
   *  (counting upgrade levels), keeping to your current weapon style, then fill
   *  a dual-wield off-hand. Returns how many pieces were changed. */
  equipBest() {
    let changed = 0;
    // Scores include each piece's upgrade level and count only the stats your
    // fighting style uses, so a +10 iron sword can beat a plain rune one.
    const mode = this.combatMode();
    const score = (id) => effectiveRating(id, this.equipment, mode);
    for (let guard = 0; guard < 30; guard++) {
      let best = null;
      this.inventory.slots.forEach((s, i) => {
        if (!s || !this._canEquipNow(s.id)) return;
        const eq = getItem(s.id).equip;
        // Dual wielders keep their off-hand for a second weapon, not a shield.
        if (eq.slot === 'shield' && canDualWield(this.equipment.get('weapon'))) return;
        const worn = this.equipment.get(eq.slot);
        // Keep to the weapon style you fight with (a staff won't replace a sword).
        if (eq.slot === 'weapon' && worn && weaponStyle(s.id) !== weaponStyle(worn)) return;
        const gain = score(s.id) - (worn ? score(worn) : 0);
        if (gain > 0 && (!best || gain > best.gain)) best = { i, gain };
      });
      if (!best) break;
      this.equipItem(best.i);
      changed++;
    }
    // Dual wielders: the best matching weapon left in the pack goes in the off-hand.
    const main = this.equipment.get('weapon');
    if (canDualWield(main)) {
      const off = this.equipment.get('shield');
      let bi = -1, br = canDualPair(off, main) ? score(off) : -1;
      this.inventory.slots.forEach((s, i) => {
        if (s && canDualPair(s.id, main) && this._canEquipNow(s.id) && score(s.id) > br) { bi = i; br = score(s.id); }
      });
      if (bi >= 0) { this.equipItem(bi, { offhand: true }); changed++; }
    }
    this.msg(changed ? `Best in slot: you put on ${changed} better piece${changed > 1 ? 's' : ''} of gear.` : 'You are already wearing your best gear.', changed ? 'level' : 'system');
    return changed;
  }

  _classWeaponType() { return this.jobClass ? CLASS_BY_ID[this.jobClass]?.weapon : null; }

  /** A quest reward that fits your class: a weapon becomes your class's weapon
   *  of about the same level, armour your class's family, and the XP goes to
   *  your own combat skill. Players without a class get the piece as written. */
  _classReward(id, xpSkill, xp) {
    const cls = this.jobClass && CLASS_BY_ID[this.jobClass];
    let give = id;
    if (cls) {
      const eq = getItem(id).equip;
      if (eq?.weaponType && eq.weaponType !== cls.weapon) give = equivalentWeapon(id, cls.weapon);
      else if (eq?.family && !canWear(cls.id, id)) give = equivalentArmour(id, ARMOUR_FAMILY[cls.id]);
    }
    this.inventory.add(give, 1);
    if (give !== id) this.msg(`Your reward is made for a ${cls.name}: ${getItem(give).name}.`, 'level');
    if (xpSkill && xp) {
      const style = cls?.style;
      const skill = !cls ? xpSkill : style === 'ranged' ? 'ranged' : style === 'magic' ? 'magic' : style === 'dance' ? 'agility' : (xpSkill === 'magic' || xpSkill === 'ranged' ? 'attack' : xpSkill);
      this.skills.addXp(skill, xp);
    }
    return give;
  }

  /** Wield a dagger in the off-hand (where a shield would go) for dual wielding. */
  equipOffhand(index) { return this.equipItem(index, { offhand: true }); }

  equipItem(index, opts = {}) {
    const s = this.inventory.slotAt(index);
    if (!s) return;
    const item = getItem(s.id);
    const eq = item.equip;
    if (!eq) { this.msg(`You can't wield the ${item.name.toLowerCase()}.`); return; }
    for (const [sk, lvl] of Object.entries(eq.req || {})) {
      if (this.skills.level(sk) < lvl) {
        this.msg(`You need ${capitalize(sk)} level ${lvl} to wear this.`);
        return;
      }
    }
    // Job classes: only your class's weapon type can be wielded (tools are fine).
    const cls = this.jobClass && CLASS_BY_ID[this.jobClass];
    if (cls && eq.weaponType && eq.weaponType !== cls.weapon) {
      this.msg(`Only a ${CLASS_FOR_TYPE(eq.weaponType)} can wield ${WEAPON_TYPE_NAMES[eq.weaponType]}. You are a ${cls.name}: you fight with ${WEAPON_TYPE_NAMES[cls.weapon]}.`);
      return;
    }
    // ...and only your class's kind of helm, body and legs armour.
    if (cls && !canWear(cls.id, s.id)) {
      const mine = ARMOUR_FAMILIES[ARMOUR_FAMILY[cls.id]];
      this.msg(`That's ${ARMOUR_FAMILIES[eq.family].name.toLowerCase()} armour. A ${cls.name} wears ${mine.name.toLowerCase()}: ${mine.desc}`);
      return;
    }
    // A dagger goes in the off-hand when asked, or by default when you already
    // hold a dagger and your off-hand isn't one yet.
    const main = this.equipment.get('weapon');
    const offhand = canDualPair(s.id, main)
      && (opts.offhand ?? !canDualPair(main, this.equipment.get('shield')));
    if (opts.offhand && !offhand) { this.msg('Only a dagger or scimitar can go in your off-hand, alongside another of the same kind.'); return; }
    const slot = offhand ? 'shield' : eq.slot;
    const cmp = offhand ? null : compareGear(s.id, this.equipment);
    this.inventory.removeAt(index, 1);
    const prev = this.equipment.get(slot);
    this.equipment.set(slot, s.id);
    if (prev) this.inventory.add(prev, 1);
    if (offhand) {
      this.msg(`You wield the ${item.name.toLowerCase()} in your off-hand. Dual wielding: every melee swing strikes twice.`, 'level');
      return;
    }
    // Swapping the main hand off daggers sends an off-hand dagger back to the pack.
    if (slot === 'weapon' && canDualWield(this.equipment.get('shield')) && !canDualPair(s.id, this.equipment.get('shield'))) {
      const off = this.equipment.clearSlot('shield');
      this.inventory.add(off, 1);
      this.msg(`You put away your off-hand ${getItem(off).name.toLowerCase()}.`, 'system');
    }
    this.msg(`You ${eq.slot === 'weapon' ? 'wield' : 'wear'} the ${item.name.toLowerCase()}.`);
    // Say plainly whether that was a step up, so players learn which gear is better.
    if (cmp && prev && cmp.verdict !== 'same' && cmp.verdict !== 'worn') {
      const head = { upgrade: 'Upgrade!', downgrade: 'Downgrade:', style: 'New style:' }[cmp.verdict];
      if (cmp.deltas.length) this.msg(`${head} ${deltaText(cmp.deltas)} vs your ${getItem(prev).name.toLowerCase()}.`, cmp.verdict === 'upgrade' ? 'level' : 'system');
    }
  }

  /** Spend coins (and bars, for metal gear) to raise an item type's upgrade level. */
  upgradeItem(id, opts = {}) {
    // Auto-upgrade runs many attempts in a row and sums them up itself, so it asks for quiet.
    const say = opts.quiet ? () => {} : (...a) => this.msg(...a);
    if (!getItem(id).equip) return false;
    const lv = this.equipment.upgradeLevel(id);
    if (lv >= MAX_UPGRADE) { say(`${upgradedName(id, lv)} is already fully upgraded.`); return false; }
    const next = lv + 1;
    const cost = upgradeCost(id, next);
    if (this.inventory.count('coins') < cost.coins) { say(`You need ${cost.coins} coins to upgrade to +${next}.`); return false; }
    if (cost.bar && this.inventory.count(cost.bar.id) < cost.bar.qty) {
      say(`You need ${cost.bar.qty} x ${getItem(cost.bar.id).name} to upgrade to +${next}.`); return false;
    }
    if (cost.stones && this.inventory.count(UP_STONE) < cost.stones) {
      say(`You need ${cost.stones} upgrade stones to upgrade to +${next}. Monsters drop them, bosses most of all.`); return false;
    }
    this.inventory.remove('coins', cost.coins);
    if (cost.bar) this.inventory.remove(cost.bar.id, cost.bar.qty);
    if (cost.stones) this.inventory.remove(UP_STONE, cost.stones);
    if (Math.random() < upgradeChance(next)) {
      this.equipment.upgrades[id] = next;
      this.equipment._changed();
      if (!opts.quiet) { this.spawnSparkle(this.player, '#F5B82E', 14); this.bus.emit('sfx', 'level'); }
      say(`Success! Your ${upgradedName(id, next)} is stronger.`, 'level');
      if (next === MAX_UPGRADE && !opts.quiet) this.banner(`<span class="big">+${MAX_UPGRADE}!</span>${getItem(id).name} is fully upgraded`);
      return true;
    }
    if (!opts.quiet) this.bus.emit('sfx', 'hurt');
    // Risky levels: a failure knocks the item down one level, unless a ward takes the blow.
    if (next >= RISKY_FROM) {
      if (this.inventory.count(UP_WARD) > 0) {
        this.inventory.remove(UP_WARD, 1);
        say(`The upgrade failed, but your upgrade ward crumbled instead: your ${upgradedName(id, lv)} keeps its level.`, 'system');
      } else {
        this.equipment.upgrades[id] = lv - 1;
        if (!this.equipment.upgrades[id]) delete this.equipment.upgrades[id];
        this.equipment._changed();
        say(`The upgrade failed and your gear lost a level: it is now ${upgradedName(id, lv - 1)}. (An upgrade ward would have saved it.)`, 'combat');
      }
      return false;
    }
    say(`The upgrade failed. Your ${upgradedName(id, lv)} is unharmed, but the materials are used up.`, 'system');
    return false;
  }

  /** What the next upgrade of an item costs, and whether you can pay for it now. */
  canAffordUpgrade(id) {
    const lv = this.equipment.upgradeLevel(id);
    if (lv >= MAX_UPGRADE) return false;
    const c = upgradeCost(id, lv + 1);
    return this.inventory.count('coins') >= c.coins && (!c.bar || this.inventory.count(c.bar.id) >= c.bar.qty)
      && (!c.stones || this.inventory.count(UP_STONE) >= c.stones);
  }

  /** How much stronger the next upgrade makes an item for the way you fight
   *  now: the stats it gains, weighted by what they do for you (your style's
   *  damage stat most, then crit, life and Defence), times the chance it works. */
  upgradeValue(id) {
    const lv = this.equipment.upgradeLevel(id);
    if (lv >= MAX_UPGRADE) return 0;
    const base = getItem(id).equip?.bonuses || {};
    const now = upgradedBonuses(base, lv), next = upgradedBonuses(base, lv + 1);
    const mode = this.combatMode();
    const W = { defence: 0.5, hp: 1, crit: 2,
      ...(mode === 'ranged' ? { ranged: 1 } : mode === 'magic' ? { magic: 0.5, magicStr: 8 } : mode === 'dance' ? { dance: 1 } : { strength: 1, attack: 0.25 }) };
    let v = 0;
    for (const [k, w] of Object.entries(W)) v += ((next[k] || 0) - (now[k] || 0)) * w;
    return v * upgradeChance(lv + 1);
  }

  /** Auto-upgrade: keep upgrading the gear you're wearing for as long as your
   *  coins, bars and stones last, always taking the upgrade that makes you
   *  strongest first (see upgradeValue), so the money goes where it counts. Risky levels (+8 and up, where a failure costs a
   *  level) are only tried while an upgrade ward can take the blow, unless
   *  `allowRisk` is set. Returns { tries, wins, changes, stoppedAtRisk }. */
  autoUpgradeEquipped({ allowRisk = false, maxTries = 2000 } = {}) {
    const ids = [...new Set(EQUIP_SLOTS.map((s) => this.equipment.get(s)).filter((id) => id && getItem(id).equip))];
    const start = Object.fromEntries(ids.map((id) => [id, this.equipment.upgradeLevel(id)]));
    let tries = 0, wins = 0, stoppedAtRisk = false;
    while (tries < maxTries) {
      const ready = ids.filter((id) => this.canAffordUpgrade(id));
      const safe = ready.filter((id) => allowRisk || this.equipment.upgradeLevel(id) + 1 < RISKY_FROM || this.inventory.count(UP_WARD) > 0);
      if (ready.length > safe.length) stoppedAtRisk = true;
      if (!safe.length) break;
      // The upgrade that makes you strongest first (ties go to the earlier slot: weapon first).
      const id = safe.reduce((a, b) => (this.upgradeValue(b) > this.upgradeValue(a) ? b : a));
      tries++;
      if (this.upgradeItem(id, { quiet: true })) wins++;
    }
    const changes = ids.filter((id) => this.equipment.upgradeLevel(id) !== start[id])
      .map((id) => ({ id, from: start[id], to: this.equipment.upgradeLevel(id) }));
    if (!tries) {
      this.msg(stoppedAtRisk ? `Auto-upgrade: your gear is ready for +${RISKY_FROM} or higher, where a failure costs a level. Carry an upgrade ward, or allow risky upgrades.`
        : 'Auto-upgrade: nothing you are wearing can be upgraded with what you have (coins, bars or stones).', 'system');
    } else {
      const list = changes.map((c) => `${upgradedName(c.id, c.to)} (from +${c.from})`).join(', ');
      this.msg(`Auto-upgrade: ${tries} attempt${tries > 1 ? 's' : ''}, ${wins} succeeded.${list ? ' ' + list + '.' : ''}`
        + (stoppedAtRisk ? ` Stopped before the risky levels (+${RISKY_FROM} and up) without a ward.` : ''), 'level');
      this.spawnSparkle(this.player, '#F5B82E', 18);
      this.bus.emit('sfx', wins ? 'level' : 'hurt');
    }
    return { tries, wins, changes, stoppedAtRisk };
  }

  /** Refine an item type one level (★1..★15), on top of its upgrades. The
   *  attempt costs coins and upgrade stones, and ends in success, failure,
   *  a downgrade or (from ★13) the item breaking, destroyed for good. An
   *  upgrade ward in your pack takes a downgrade or a break instead. Returns
   *  the outcome ('success' | 'fail' | 'downgrade' | 'broken' | 'warded'), or
   *  null when the attempt couldn't be made. */
  refineItem(id) {
    if (!getItem(id).equip) return null;
    const lv = this.equipment.refineLevel(id);
    const name = (l) => `${getItem(id).name}${l ? ' ' + refineTag(l) : ''}`;
    if (lv >= MAX_REFINE) { this.msg(`${name(lv)} is already fully refined.`); return null; }
    const next = lv + 1;
    const cost = refineCost(id, next);
    if (this.inventory.count('coins') < cost.coins) { this.msg(`You need ${cost.coins} coins to refine to ${refineTag(next)}.`); return null; }
    if (this.inventory.count(UP_STONE) < cost.stones) { this.msg(`You need ${cost.stones} upgrade stones to refine to ${refineTag(next)}.`); return null; }
    this.inventory.remove('coins', cost.coins);
    this.inventory.remove(UP_STONE, cost.stones);
    let out = rollRefine(next);
    // A ward takes a downgrade or a break instead (and is used up).
    if ((out === 'downgrade' || out === 'broken') && this.inventory.count(UP_WARD) > 0) {
      this.inventory.remove(UP_WARD, 1);
      this.msg(`The refine went badly, but your upgrade ward crumbled instead: your ${name(lv)} is unharmed.`, 'system');
      this.bus.emit('sfx', 'hurt');
      return 'warded';
    }
    if (out === 'success') {
      this.equipment.refines[id] = next;
      this.equipment._changed();
      this.spawnSparkle(this.player, '#9fd8ff', 16);
      this.bus.emit('sfx', 'level');
      this.msg(`Refine success! Your ${name(next)} shines brighter.`, 'level');
      if (next === MAX_REFINE) this.banner(`<span class="big">${refineTag(MAX_REFINE)}!</span>${getItem(id).name} is fully refined`);
    } else if (out === 'fail') {
      this.bus.emit('sfx', 'hurt');
      this.msg(`The refine failed. Your ${name(lv)} is unharmed, but the materials are used up.`, 'system');
    } else if (out === 'downgrade') {
      if (lv - 1 > 0) this.equipment.refines[id] = lv - 1; else delete this.equipment.refines[id];
      this.equipment._changed();
      this.bus.emit('sfx', 'hurt');
      this.msg(`The refine failed and your gear lost a level: it is now ${name(lv - 1)}. (An upgrade ward would have saved it.)`, 'combat');
    } else {
      // Broken: one copy is destroyed (the worn one first) and the type's refine resets.
      const slot = EQUIP_SLOTS.find((s) => this.equipment.get(s) === id);
      if (slot) this.equipment.clearSlot(slot); else this.inventory.remove(id, 1);
      delete this.equipment.refines[id];
      this.equipment._changed();
      this.bus.emit('sfx', 'hurt');
      this.addShake(4, 300);
      this.msg(`The refine shattered your ${name(lv)}! It is destroyed. (An upgrade ward would have saved it.)`, 'combat');
      this.banner(`<span class="big">Broken!</span>${getItem(id).name} shattered`);
    }
    return out;
  }

  unequip(slot) {
    const id = this.equipment.get(slot);
    if (!id) return;
    if (this.inventory.canAdd(id, 1) <= 0) { this.msg("You don't have enough inventory space."); return; }
    this.equipment.clearSlot(slot);
    this.inventory.add(id, 1);
    this.msg(`You remove the ${getItem(id).name.toLowerCase()}.`);
  }

  dropItem(index) {
    const s = this.inventory.slotAt(index);
    if (!s) return;
    const { id, qty } = s;
    this.inventory.removeAt(index, qty);
    const gi = this.world.addGroundItem(id, qty, this.player.x, this.player.y);
    gi.playerDropped = true;   // auto-loot leaves things you drop on purpose
    this.msg(`You drop the ${getItem(id).name.toLowerCase()}.`);
  }

  lightLogs(index) {
    const s = this.inventory.slotAt(index);
    if (!s) return;
    const item = getItem(s.id);
    if (!item.tags?.includes('log')) { this.msg("You can't light that."); return; }
    if (!this.hasTool('tinderbox')) { this.msg('You need a tinderbox to light a fire.'); return; }
    this.beginAction({ type: 'firemake', logId: s.id, tile: { x: this.player.x, y: this.player.y } },
      { x: this.player.x, y: this.player.y }, false);
  }

  // ---------------- Processing started from UI menus ----------------
  startCooking(obj, rawId) { this.beginAction({ type: 'cook', obj, rawId }, { x: obj.x, y: obj.y }, true); }
  startDish(obj, recipe) { this.beginAction({ type: 'cookdish', obj, recipe }, { x: obj.x, y: obj.y }, true); }
  startSmelt(recipe, obj) { this.beginAction({ type: 'smelt', recipe, obj }, { x: obj.x, y: obj.y }, true); }
  startSmith(recipe, obj) { this.beginAction({ type: 'smith', recipe, obj }, { x: obj.x, y: obj.y }, true); }
  startCraft(recipe, obj) { this.beginAction({ type: 'craft', recipe, obj }, { x: obj.x, y: obj.y }, true); }
  /** Fletching or Herblore at a station: `recipe` is { result, qty, inputs: [[id, n]], level, xp, tool? }. */
  /** "Do all" at a station: make everything you can there, best recipe first. */
  startAll(kind, obj) {
    const job = nextJob(this, kind);
    if (!job) { this.msg('You have nothing here you can make.'); return false; }
    this.beginAction({ ...job, obj, all: kind }, { x: obj.x, y: obj.y }, true);
    return true;
  }
  startRecipe(skill, recipe, obj) { this.beginAction({ type: 'recipe', skill, recipe, obj }, { x: obj.x, y: obj.y }, true); }

  // ---------------- Farming ----------------
  /** Walked up to a farm patch: harvest it, check on it, or plant the best seed you can. */
  tendPatch(obj, seedId) {
    if (obj.crop) {
      const c = cropFor(obj.crop);
      if (obj.growLeft > 0) {
        const pct = Math.round(100 * (1 - obj.growLeft / c.grow));
        this.msg(`The ${c.name.toLowerCase()} is growing (${pct}%). About ${Math.ceil(obj.growLeft * TICK_MS / 1000)}s to go.`);
        return;
      }
      return this.harvestPatch(obj);
    }
    const lvl = this.skills.level('farming');
    const seeds = this.inventory.slots.filter((sl) => sl && CROP_BY_SEED[sl.id]).map((sl) => sl.id);
    if (!seeds.length) { this.msg('You have no seeds to plant. The farmer at Kranji or in Kampong Glam sells them.'); return; }
    const can = seeds.filter((id) => cropFor(CROP_BY_SEED[id][0]).level <= lvl);
    if (!can.length) { this.msg(`You need a higher Farming level to plant those seeds.`); return; }
    if (!seedId && can.length > 1 && this.ui?.openSeedMenu) { this.ui.openSeedMenu(obj, can); return; }
    this.plantSeed(obj, seedId || can[0]);
  }

  plantSeed(obj, seedId) {
    const c = cropFor(CROP_BY_SEED[seedId]?.[0]);
    if (!c || obj.crop || !this.inventory.has(seedId)) return false;
    if (this.skills.level('farming') < c.level) { this.msg(`You need a Farming level of ${c.level} to plant this.`); return false; }
    this.inventory.remove(seedId, 1);
    obj.crop = c.id; obj.growLeft = c.grow;
    this.skills.addXp('farming', c.plantXp);
    this.spawnPoof(obj.x * TILE + TILE / 2, obj.y * TILE + TILE / 2, '#8a6a3a');
    this.msg(`You plant the ${c.name.toLowerCase()} seed. It will be ready in about ${Math.ceil(c.grow * TICK_MS / 1000)}s.`);
    this.bus.emit('sfx', 'gather');
    return true;
  }

  harvestPatch(obj) {
    const c = cropFor(obj.crop);
    const lvl = this.skills.level('farming');
    // Green fingers: higher levels coax a little more from each patch.
    const n = randInt(c.yield[0], c.yield[1]) + (Math.random() < Math.min(0.5, (lvl - c.level) / 100) ? 1 : 0);
    if (this.inventory.canAdd(c.id, n) <= 0) { this.msg('Your inventory is too full to harvest.'); return false; }
    this.inventory.add(c.id, n);
    this.skills.addXp('farming', c.harvestXp * n);
    obj.crop = null; obj.growLeft = 0;
    this.spawnSparkle({ x: obj.x, y: obj.y }, c.color, 10);
    this.msg(`You harvest ${n} ${c.name.toLowerCase()}.`);
    if (Math.random() < 0.25) { this.inventory.add(c.seed, 1); this.msg(`You save a ${c.name.toLowerCase()} seed for next time.`); }
    this.bus.emit('sfx', 'pickup');
    return true;
  }

  _tickFarms() {
    this._farms ||= this.world.objects.filter((o) => o.def.type === 'farm');
    for (const o of this._farms) if (o.crop && o.growLeft > 0) {
      o.growLeft--;
      if (o.growLeft === 0 && chebyshev(o.x, o.y, this.player.x, this.player.y) < 40) this.msg(`Your ${cropFor(o.crop).name.toLowerCase()} is ready to harvest.`, 'level');
    }
  }

  // ---------------- Potions (Herblore) ----------------
  drinkPotion(index) {
    const s = this.inventory.slotAt(index);
    const pot = s && POTIONS[s.id];
    if (!pot) return;
    this.inventory.removeAt(index, 1);
    if (pot.fx.heal) {
      this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.round(this.maxHp() * pot.fx.heal));
      this.bus.emit('hp');
    }
    if (pot.group) {
      for (const id of Object.keys(this.potions)) if (POTIONS[id].group === pot.group) delete this.potions[id];
      this.potions[s.id] = pot.ms;
    }
    this.spawnSparkle(this.player, pot.color, 10);
    this.msg(pot.group ? `You drink the ${pot.name.toLowerCase()}. You feel stronger for ${Math.round(pot.ms / 60000)} minutes.` : `You drink the ${pot.name.toLowerCase()}.`);
    this.bus.emit('sfx', 'eat');
    this.bus.emit('potions');
  }

  _tickPotions(dt) {
    let changed = false;
    for (const id of Object.keys(this.potions)) {
      this.potions[id] -= dt;
      if (this.potions[id] <= 0) { delete this.potions[id]; changed = true; this.msg(`Your ${POTIONS[id].name.toLowerCase()} has worn off.`, 'system'); }
    }
    if (changed) this.bus.emit('potions');
  }

  /** Combined combat boosts from the potions you have active, for a fighting style. */
  potionMods(mode = this.combatMode()) {
    const out = {};
    for (const id of Object.keys(this.potions)) {
      const pot = POTIONS[id];
      if (pot.style && pot.style !== mode) continue;
      for (const [k, v] of Object.entries(pot.fx)) if (k !== 'heal') out[k] = (out[k] || 0) + v;
    }
    return out;
  }

  handleDialogueAction(action) {
    if (action === 'giveStarter') this.giveStarter();
    else if (action === 'questStart') {
      const q = this.quests.bone_collector;
      if (q.state === 'notStarted') { q.state = 'active'; this.msg('Quest started — A Bag of Bones: bring 10 bones to the Kampong Guide.', 'level'); }
    } else if (action === 'questTurnIn') this.turnInBoneQuest();
    else if (action === 'pestStart') {
      const q = this.quests.pest_control;
      if (q.state === 'notStarted') { q.state = 'active'; q.kills = 0; this.msg('Quest started — Pest Control: slay 8 giant rats.', 'level'); }
    } else if (action === 'pillarsStart') {
      const q = this.quests.pillars;
      if (q.state === 'notStarted') { q.state = 'active'; this.msg('Quest started — Pillars of the Island: pray at the A-Worthy Monument and rest at the Mascot Statue.', 'level'); }
    } else if (action === 'pillarsTurnIn') this.turnInPillars();
    else if (action === 'smithStart') {
      const q = this.quests.smith_apprentice;
      if (q.state === 'notStarted') { q.state = 'active'; this.msg('Quest started — A Smith\'s Apprentice: forge and bring 8 steel bars.', 'level'); }
    } else if (action === 'smithTurnIn') this.turnInSmith();
    else if (action === 'defenderStart') {
      const q = this.quests.island_defender;
      if (q.state === 'notStarted') { q.state = 'active'; q.startBoss = this.bossKills; this.msg('Quest started — Island Defender: defeat 3 bosses.', 'level'); }
    } else if (action === 'defenderTurnIn') this.turnInDefender();
    else if (action === 'bigGameStart') {
      const q = this.quests.big_game_hunter;
      if (q.state === 'notStarted') { q.state = 'active'; q.startKills = this.totalKills; this.msg('Quest started — Big Game Hunter: defeat 50 creatures.', 'level'); }
    } else if (action === 'bigGameTurnIn') this.turnInBigGame();
    else if (action === 'mysticStart') {
      const q = this.quests.mystic_trial;
      if (q.state === 'notStarted') { q.state = 'active'; this.msg('Quest started — The Mystic\'s Trial: bring 25 death runes to the Kampong Guide.', 'level'); }
    } else if (action === 'mysticTurnIn') this.turnInMystic();
    else if (action === 'provisionsStart') {
      const q = this.quests.island_provisions;
      if (q.state === 'notStarted') { q.state = 'active'; this.msg('Quest started — Island Provisions: bring 10 cooked salmon to the Kampong Guide.', 'level'); }
    } else if (action === 'provisionsTurnIn') this.turnInProvisions();
    else if (action === 'lifeStart') this.startLife('life_skills');
    else if (action === 'lifeTurnIn') this.advanceLife('life_skills');
    else if (action === 'lifeRemind') this.remindLife('life_skills');
    else if (action === 'lifeAdvStart') this.startLife('life_skills_adv');
    else if (action === 'lifeAdvTurnIn') this.advanceLife('life_skills_adv');
    else if (action === 'lifeAdvRemind') this.remindLife('life_skills_adv');
    else if (action === 'lifeWildStart') this.startLife('life_skills_wild');
    else if (action === 'lifeWildTurnIn') this.advanceLife('life_skills_wild');
    else if (action === 'lifeWildRemind') this.remindLife('life_skills_wild');
    else if (action === 'championStart') this.startChampion();
    else if (action === 'championTurnIn') this.turnInChampion();
    else if (action === 'redemptionStart') this.startRedemption();
    else if (action === 'redemptionTurnIn') this.turnInRedemption();
    else if (action === 'redemptionRemind') this.remindRedemption();
    else if (action === 'corruptionStart') this.startCorruption();
    else if (action === 'corruptionTurnIn') this.turnInCorruption();
    else if (action === 'corruptionRemind') this.remindCorruption();
    this.bus.emit('quest');
  }

  // ---------------- Redemption & corruption arc ----------------
  startRedemption() {
    const q = this.quests.redemption;
    if (q.state === 'done') { this.msg('Sister Mei: You walk in the light now, child.', 'system'); return; }
    if (q.state === 'active') { this.remindRedemption(); return; }
    if (this.karma.evil < 10) { this.msg('Sister Mei: Your heart is not yet burdened by sin. Go in peace.', 'system'); return; }
    q.state = 'active';
    q.baseGood = this.karma.good;
    this.msg(`Quest started — The Path of Redemption: perform good works (+${REDEMPTION_GOAL} good karma) to atone.`, 'level');
    this.banner('<span class="big">Quest started!</span>The Path of Redemption');
  }

  remindRedemption() {
    const q = this.quests.redemption;
    if (q.state !== 'active') { this.msg('Sister Mei: Tell me if you wish to atone.', 'system'); return; }
    const done = Math.max(0, this.karma.good - (q.baseGood || 0));
    this.msg(`Sister Mei: Continue your penance through good deeds. (${Math.min(done, REDEMPTION_GOAL)}/${REDEMPTION_GOAL})`, 'system');
  }

  turnInRedemption() {
    const q = this.quests.redemption;
    if (q.state === 'done') { this.msg('Sister Mei: You are redeemed, child.', 'system'); return; }
    if (q.state !== 'active') { this.msg('Sister Mei: Seek atonement first.', 'system'); return; }
    const done = this.karma.good - (q.baseGood || 0);
    if (done < REDEMPTION_GOAL) { this.msg(`Sister Mei: Your penance is not complete. (${Math.max(0, done)}/${REDEMPTION_GOAL})`, 'system'); return; }
    this.karma.evil = 0; // sins washed away
    this.inventory.add('blessed_halo', 1);
    q.state = 'done';
    this.spawnSparkle(this.player, '#ffe9a8', 18);
    this.msg('Quest complete — The Path of Redemption! Your evil is washed away. You receive the Blessed halo.', 'level');
    this.banner('<span class="big">Redeemed!</span>Your sins are forgiven.');
    this.bus.emit('karma');
  }

  startCorruption() {
    const q = this.quests.corruption;
    if (q.state === 'done') { this.msg('The Tempter: The darkness is already yours, friend.', 'system'); return; }
    if (q.state === 'active') { this.remindCorruption(); return; }
    if (this.alignment() > -10) { this.msg('The Tempter: You are too... pure. Taste some wickedness first, then return to me.', 'system'); return; }
    q.state = 'active';
    q.baseEvil = this.karma.evil;
    this.msg(`Quest started — The Path of Corruption: deepen your evil (+${CORRUPTION_GOAL} evil karma) to be reborn in darkness.`, 'level');
    this.banner('<span class="big">Quest started!</span>The Path of Corruption');
  }

  remindCorruption() {
    const q = this.quests.corruption;
    if (q.state !== 'active') { this.msg('The Tempter: Ask, and the dark path opens.', 'system'); return; }
    const done = Math.max(0, this.karma.evil - (q.baseEvil || 0));
    this.msg(`The Tempter: Feed your darkness with wicked deeds. (${Math.min(done, CORRUPTION_GOAL)}/${CORRUPTION_GOAL})`, 'system');
  }

  turnInCorruption() {
    const q = this.quests.corruption;
    if (q.state === 'done') { this.msg('The Tempter: You are mine already.', 'system'); return; }
    if (q.state !== 'active') { this.msg('The Tempter: Embrace the path first.', 'system'); return; }
    const done = this.karma.evil - (q.baseEvil || 0);
    if (done < CORRUPTION_GOAL) { this.msg(`The Tempter: Not dark enough yet. (${Math.max(0, done)}/${CORRUPTION_GOAL})`, 'system'); return; }
    this.karma.good = 0; // forsake the light
    this.inventory.add('shadow_cloak', 1);
    q.state = 'done';
    this.spawnSparkle(this.player, '#6a4a8a', 18);
    this.msg('Quest complete — The Path of Corruption! You forsake the light. You receive the Shadow cloak.', 'level');
    this.banner('<span class="big">Corrupted!</span>Darkness is your ally now.');
    this.bus.emit('karma');
  }

  // ---------------- Trades of the Island (life-skills quest lines) ----------------
  // The basic and advanced ("Master of Trades") courses share one staged engine,
  // keyed by the quest id and its stage table.
  _lifeLine(key) {
    if (key === 'life_skills_adv') {
      return { q: this.quests.life_skills_adv, stages: LIFE_STAGES_ADV, grad: LIFE_GRAD_ADV, name: 'Master of Trades' };
    }
    if (key === 'life_skills_wild') {
      return { q: this.quests.life_skills_wild, stages: LIFE_STAGES_WILD, grad: LIFE_GRAD_WILD, name: 'Trades of the Wild' };
    }
    return { q: this.quests.life_skills, stages: LIFE_STAGES, grad: LIFE_GRAD, name: 'Trades of the Island' };
  }

  startLife(key) {
    const { q, name } = this._lifeLine(key);
    if (key === 'life_skills_adv' && this.quests.life_skills.state !== 'done') {
      this.msg('Cikgu Surya: Master the basics first — finish Trades of the Island, then return for the advanced course.', 'system');
      return;
    }
    if (q.state !== 'notStarted') { this.remindLife(key); return; }
    q.state = 'active';
    q.stage = 1;
    this.msg(`Quest started — ${name}: learn from Cikgu Surya.`, 'level');
    this.banner(`<span class="big">Quest started!</span>${name}`);
    this._beginLifeStage(key);
  }

  // Announce the current lesson and (for xp-based lessons) snapshot the baseline.
  _beginLifeStage(key) {
    const { q, stages } = this._lifeLine(key);
    const st = stages[q.stage - 1];
    if (!st) return;
    q.base = st.need.xp ? (this.skills.xp[st.skill] || 0) : 0;
    this.msg(`Cikgu Surya: ${st.teach}`, 'system');
  }

  remindLife(key) {
    const { q, stages } = this._lifeLine(key);
    if (q.state === 'done') { this.msg('Cikgu Surya: You have mastered this course, well done lah!', 'system'); return; }
    if (q.state !== 'active') { this.msg('Cikgu Surya: Ask me to teach you first.', 'system'); return; }
    const st = stages[q.stage - 1];
    this.msg(`Cikgu Surya (Lesson ${q.stage}/${stages.length}): ${st.teach}`, 'system');
  }

  advanceLife(key) {
    const { q, stages, grad, name } = this._lifeLine(key);
    if (q.state === 'done') { this.msg('Cikgu Surya: Your training is complete, adventurer.', 'system'); return; }
    if (q.state !== 'active') { this.msg('Cikgu Surya: Ask me to teach you first.', 'system'); return; }
    const st = stages[q.stage - 1];
    // Verify the lesson's requirement is met.
    if (st.need.item) {
      if (this.inventory.count(st.need.item) < st.need.qty) {
        this.msg(`Cikgu Surya: Not yet, lah — bring me ${st.need.qty} ${getItem(st.need.item).name}.`, 'system');
        return;
      }
      this.inventory.remove(st.need.item, st.need.qty);
    } else {
      const gained = (this.skills.xp[st.skill] || 0) - (q.base || 0);
      if (gained < st.need.xp) {
        this.msg(`Cikgu Surya: Keep practising your ${st.name}! (${Math.floor(Math.max(gained, 0))}/${st.need.xp} xp)`, 'system');
        return;
      }
    }
    // Pay out the lesson reward.
    this.skills.addXp(st.skill, st.reward.xp);
    if (st.reward.coins) this.inventory.add('coins', st.reward.coins);
    if (st.reward.item) this.inventory.add(st.reward.item, 1);
    this.msg(`Lesson complete — ${st.name}! +${st.reward.xp} ${st.name} XP${st.reward.coins ? ` and ${st.reward.coins} coins` : ''}.`, 'level');
    this.spawnSparkle(this.player, '#ffe24a', 12);
    // Move on to the next lesson, or graduate.
    q.stage++;
    if (q.stage > stages.length) {
      q.state = 'done';
      for (const s of grad.skills) this.skills.addXp(s, grad.xp);
      if (grad.coins) this.inventory.add('coins', grad.coins);
      if (grad.item) this.inventory.add(grad.item, 1);
      const extra = grad.item ? ` and the ${getItem(grad.item).name}` : '';
      this.msg(`Quest complete — ${name}! Cikgu Surya honours your mastery (+${grad.xp} XP in every life skill, +${grad.coins} coins${extra}).`, 'level');
      this.banner(`<span class="big">Quest complete!</span>${name}`);
    } else {
      this._beginLifeStage(key);
    }
  }

  // ---------------- Champion of Singapore (grandmaster capstone) ----------------
  /** Total quest points = sum over completed quests of their point value. */
  // ---------------- Quest guide ----------------
  /** What a quest needs next, and where: { text, kind: 'npc'|'obj'|'hunt'|'boss'|'none', ... }. */
  questGuide(id) {
    const q = this.quests[id];
    if (!q) return { text: '', kind: 'none' };
    const inv = (item) => this.inventory.count(item);
    const npc = (npcId, verb = 'Talk to') => ({ kind: 'npc', npcId, text: `${verb} ${getNpc(npcId).name}` });
    const obj = (objId, text) => ({ kind: 'obj', objId, text });
    const giver = { life_skills: 'skills_tutor', life_skills_adv: 'skills_tutor', life_skills_wild: 'skills_tutor', redemption: 'light_priestess', corruption: 'shadow_broker' }[id] || 'guide';
    if (q.state === 'done') return { text: 'Complete', kind: 'none' };
    if (q.state !== 'active') {
      if (id === 'champion' && this.questPoints() < CHAMPION_QP) return { text: `Earn ${CHAMPION_QP} quest points first`, kind: 'none' };
      if (id === 'life_skills_adv' && this.quests.life_skills.state !== 'done') return { text: 'Finish Trades of the Island first', kind: 'none' };
      return npc(giver, 'Start it with');
    }
    switch (id) {
      case 'life_skills': case 'life_skills_adv': case 'life_skills_wild': {
        const { stages } = this._lifeLine(id);
        const st = stages[q.stage - 1];
        if (!st) return npc(giver);
        const met = st.need.item ? inv(st.need.item) >= st.need.qty : (this.skills.xp[st.skill] || 0) - (q.base || 0) >= st.need.xp;
        if (met) return npc(giver, 'Hand in to');
        const SOURCE = { logs: 'tree', oak_logs: 'oak', copper_ore: 'copper_rock', iron_ore: 'iron_rock', bronze_bar: 'furnace', steel_bar: 'furnace',
          raw_anchovy: 'fishing_spot', raw_trout: 'rod_spot', anchovy: 'range', trout: 'range', chilli: 'farm_patch', attack_potion: 'apothecary_table', arrow_shaft: 'fletching_bench' };
        if (st.need.item) return obj(SOURCE[st.need.item] || 'tree', `${st.name}: get ${st.need.qty} ${getItem(st.need.item).name.toLowerCase()}`);
        if (st.skill === 'firemaking') {
          const log = this.inventory.slots.find((sl) => sl && getItem(sl.id).tags?.includes('log'));
          return log ? { kind: 'light', text: 'Firemaking: light your logs' } : obj('tree', 'Firemaking: chop some logs first');
        }
        if (st.skill === 'hunter') return obj('bird_snare', 'Hunter: check a bird snare');
        return npc(giver);
      }
      case 'bone_collector': return countBones(this.inventory) >= 10 ? npc('guide', 'Hand in to') : { kind: 'hunt', text: `Collect bones: ${countBones(this.inventory)}/10 (any kind of bones counts)` };
      case 'pest_control': return { kind: 'hunt', target: 'rat', text: `Slay rats: ${q.kills}/8` };
      case 'pillars': return !q.monument ? obj('shrine', 'Pray at the A-Worthy Monument') : !q.obelisk ? obj('mascot_statue', 'Rest at the Mascot Statue') : npc('guide', 'Hand in to');
      case 'smith_apprentice':
        if (inv('steel_bar') >= 8) return npc('guide', 'Hand in to');
        if (inv('iron_ore') && inv('coal') >= 2) return obj('furnace', 'Smelt steel bars at the furnace');
        if (inv('iron_ore') >= 4) return obj('coal_rock', 'Mine coal for the steel');
        return obj('iron_rock', `Mine iron ore (${inv('steel_bar')}/8 steel bars)`);
      case 'island_defender': return this.bossKills - (q.startBoss || 0) >= 3 ? npc('guide', 'Hand in to') : { kind: 'boss', text: 'Defeat a boss' };
      case 'big_game_hunter': return this.totalKills - (q.startKills || 0) >= 50 ? npc('guide', 'Hand in to') : { kind: 'hunt', text: 'Defeat creatures' };
      case 'mystic_trial': return inv('death_rune') >= 25 ? npc('guide', 'Hand in to') : npc('mage', 'Buy death runes from');
      case 'island_provisions':
        if (inv('salmon') >= 10) return npc('guide', 'Hand in to');
        if (inv('raw_salmon')) return obj('range', 'Cook your salmon on a range');
        return obj('rod_spot', 'Catch salmon (Fishing 30, fishing rod)');
      case 'champion': return this.bossKills - (q.startBoss || 0) >= 1 ? npc('guide', 'Hand in to') : { kind: 'boss', text: 'Final trial: defeat a boss' };
      default: return npc(giver);
    }
  }

  /** Quest journal "Go": walk to wherever the quest needs you next and start on it. */
  questTravel(id) {
    const g = this.questGuide(id);
    const p = this.player;
    const here = this.playerTile();
    const d2 = (o) => (o.x - here.x) ** 2 + (o.y - here.y) ** 2;
    const nearest = (list) => list.reduce((b, o) => (!b || d2(o) < d2(b) ? o : b), null);
    if (!p.alive || g.kind === 'none') { if (g.text && g.text !== 'Complete') this.msg(g.text + '.', 'system'); return false; }
    this._questTarget = null;
    this._pathBudget = 150000;       // quest trips can cross the whole map
    let ok = false;
    try {
      if (g.kind === 'npc') {
        const n = nearest(this.npcs.filter((x) => x.npcId === g.npcId));
        if (n) { this._mrtHopToward(n); ok = this.defaultNpcAction(n) !== false; }   // talk, or open the shop
      } else if (g.kind === 'obj') {
        const o = nearest(this.world.objects.filter((x) => x.objId === g.objId && !x.depleted));
        if (o) { this._mrtHopToward(o); this.defaultObjectAction(o); ok = !!p.action || p.isMoving; }
      } else if (g.kind === 'light') {
        const idx = this.inventory.slots.findIndex((sl) => sl && getItem(sl.id).tags?.includes('log'));
        if (idx !== -1) { this.lightLogs(idx); ok = true; }
      } else if (g.kind === 'hunt' || g.kind === 'boss') {
        const cl = this.fightLevel();
        const fits = g.kind === 'boss'
          ? (n) => n.def.boss && !n.def.fixed && (n.def.level || 1) <= Math.max(cl + 15, Math.round(cl * 1.2))
          : g.target ? (n) => n.npcId === g.target : (n) => !n.def.boss && (n.def.level || 1) <= cl + 5;
        const mob = nearest(this.npcs.filter((n) => n.alive && n.attackable && !n.temporary && fits(n)
          && (!this.world.zoneAt(n.x, n.y)?.wilderness || this.world.zoneAt(here.x, here.y)?.wilderness)));
        if (mob) {
          this._questTarget = g.target || null;
          if (g.kind === 'boss') this.autoCfg.bosses = true;
          if (this._mrtHopToward(mob)) this.walkToFar({ x: mob.x, y: mob.y });
          else if (chebyshev(here.x, here.y, mob.x, mob.y) > 12) this.walkToFar({ x: mob.x, y: mob.y });
          else this.attackNpc(mob);
          if (!this.autoBattle) this.toggleAutoBattle(true);
          ok = true;
        }
      }
    } finally { this._pathBudget = 0; }
    this.msg(ok ? `Quest: ${g.text}.` : `Quest: ${g.text}, but I can't find the way there.`, 'system');
    if (ok && AUTO_QUEST_ACTIONS[id]) this.autoQuestId = id;   // auto quest works on the quest you last chose
    return ok;
  }

  // ---------------- Auto quest ----------------
  /** The quest auto quest is on: the one you last sent it to, else the first
   *  unfinished one in journal order that it knows how to do. The karma quests
   *  are a moral choice, so they are always left to the player. */
  autoQuestPick() {
    const can = (id) => AUTO_QUEST_ACTIONS[id] && this.quests[id] && this.quests[id].state !== 'done' && this.questGuide(id).kind !== 'none';
    if (this.autoQuestId && can(this.autoQuestId)) return this.autoQuestId;
    return QUESTS.find((d) => can(d.id))?.id || null;
  }

  toggleAutoQuest(on = !this.autoQuest, why = '') {
    this.autoQuest = !!on;
    this._autoQuestStep = null;
    this._autoQuestMark = null;
    this._autoQuestStuck = 0;
    if (!this.autoQuest && this._autoQuestFight) {
      // Hand back a fight auto quest started for you.
      this._autoQuestFight = false;
      this._questTarget = null;
      if (this.autoBattle) this.toggleAutoBattle(false);
    }
    this.msg(this.autoQuest
      ? 'Auto quest on: you will start, work through and hand in your quests by yourself. Steer to pause.'
      : `Auto quest off${why ? `: ${why}` : '.'}`, 'system');
    this.bus.emit('autoquest');
  }

  /** A rough "has anything happened" mark (bag contents and total XP), so auto
   *  quest can tell when it keeps trying the same step and getting nowhere. */
  _autoQuestFingerprint() {
    let n = 0;
    for (const sl of this.inventory.slots) if (sl) n += sl.qty || 1;
    let xp = 0;
    for (const v of Object.values(this.skills.xp)) xp += v || 0;
    return `${n}:${Math.floor(xp)}`;
  }

  // Runs each world tick while auto quest is on and you are idle: work out the
  // quest's next step and do it, the same way the journal's "Go" does, but
  // also talking to quest givers, running station menus and buying supplies.
  _autoQuestTick() {
    const p = this.player;
    if (!this.autoQuest || !p.alive || this._driving) return;
    const id = this.autoQuestPick();
    if (!id) { this.toggleAutoQuest(false, 'no quests left that I can do for you.'); return; }
    const g = this.questGuide(id);
    const fighting = g.kind === 'hunt' || g.kind === 'boss';
    // A fight auto quest started has done its job: stop it and move on.
    if (this._autoQuestFight && !fighting) {
      this._autoQuestFight = false;
      this._questTarget = null;
      if (this.autoBattle) this.toggleAutoBattle(false);
    }
    if (fighting && this.autoBattle) return;          // auto battle is on the job
    if (p.action || p.isMoving) return;               // busy: wait until idle
    const name = QUESTS.find((d) => d.id === id)?.name || id;
    const step = `${id}:${g.text}`;
    if (step !== this._autoQuestStep) {
      this._autoQuestStep = step;
      this._autoQuestStuck = 0;
      this._autoQuestMark = null;
      this.msg(`Auto quest — ${name}: ${g.text}.`, 'system');
    }
    // Same step, nothing gained since the last try: count it, and give up
    // after a few rather than walking back and forth forever.
    const mark = this._autoQuestFingerprint();
    if (mark === this._autoQuestMark) {
      if (++this._autoQuestStuck >= 3) { this.toggleAutoQuest(false, `I'm stuck on "${g.text}". You'll need to do this step yourself.`); return; }
    } else this._autoQuestStuck = 0;
    this._autoQuestMark = mark;
    const here = this.playerTile();
    const d2 = (o) => (o.x - here.x) ** 2 + (o.y - here.y) ** 2;
    const nearest = (list) => list.reduce((b, o) => (!b || d2(o) < d2(b) ? o : b), null);
    this._pathBudget = 150000;       // quest trips can cross the whole map
    try {
      if (g.kind === 'npc') {
        const n = nearest(this.npcs.filter((x) => x.npcId === g.npcId));
        if (!n) { this.toggleAutoQuest(false, `I can't find ${getNpc(g.npcId).name}.`); return; }
        this._mrtHopToward(n);
        const tgt = { x: n.x, y: n.y };
        this.beginAction({ type: 'questtalk', npc: n, quest: id, target: tgt }, tgt, true);
      } else if (g.kind === 'obj') {
        const o = nearest(this.world.objects.filter((x) => x.objId === g.objId && !x.depleted));
        if (!o) { this.toggleAutoQuest(false, `I can't find anywhere to "${g.text}".`); return; }
        const make = AUTO_QUEST_STATION[o.def.type];
        this._mrtHopToward(o);
        if (make) {
          if (!nextJob(this, make)) { this.toggleAutoQuest(false, `you don't have what you need to "${g.text}".`); return; }
          this.startAll(make, o);
        } else {
          if (this.inventory.freeSlots() <= 0) { this.toggleAutoQuest(false, 'your bag is full. Bank or drop something and switch it back on.'); return; }
          this.defaultObjectAction(o);
        }
      } else if (g.kind === 'light') {
        const idx = this.inventory.slots.findIndex((sl) => sl && getItem(sl.id).tags?.includes('log'));
        if (idx === -1 || !this.hasTool('tinderbox')) { this.toggleAutoQuest(false, 'you need logs and a tinderbox to light a fire.'); return; }
        this.lightLogs(idx);
      } else if (fighting) {
        if (!this.questTravel(id)) { this.toggleAutoQuest(false, `there's nothing I can fight for "${g.text}" right now.`); return; }
        this._autoQuestFight = true;
      }
    } finally { this._pathBudget = 0; }
  }

  /** Auto quest reached a quest NPC: start the quest, hand it in, or (for the
   *  Mystic's Trial) buy the death runes it asks for. */
  _autoQuestTalk(id, npc) {
    const q = this.quests[id];
    const acts = AUTO_QUEST_ACTIONS[id];
    if (!q || !acts) return;
    if (id === 'mystic_trial' && q.state === 'active' && npc.def.role === 'shop') {
      const need = 25 - this.inventory.count('death_rune');
      if (need > 0) this.buyItem(npc.def.shop, 'death_rune', need);
      return;
    }
    const action = q.state === 'active' ? acts[1] : acts[0];
    if (action) this.handleDialogueAction(action);
  }

  questPoints() {
    let qp = 0;
    for (const def of QUESTS) if (this.quests[def.id]?.state === 'done') qp += def.qp || 0;
    return qp;
  }

  startChampion() {
    const q = this.quests.champion;
    if (q.state === 'done') { this.msg('You are already the Champion of Singapore.', 'system'); return; }
    if (q.state === 'active') { this.msg(`Champion of Singapore: defeat ${Math.max(0, 1 - (this.bossKills - (q.startBoss || 0)))} more boss to claim your title.`, 'system'); return; }
    const qp = this.questPoints();
    if (qp < CHAMPION_QP) { this.msg(`The Kampong Guide: prove yourself first — earn ${CHAMPION_QP} quest points (you have ${qp}).`, 'system'); return; }
    q.state = 'active';
    q.startBoss = this.bossKills;
    this.msg('Quest started — Champion of Singapore: defeat a boss as your final trial.', 'level');
    this.banner('<span class="big">Quest started!</span>Champion of Singapore');
  }

  turnInChampion() {
    const q = this.quests.champion;
    if (q.state === 'done') { this.msg('The island salutes its Champion!', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask the Kampong Guide about becoming Champion first.', 'system'); return; }
    if (this.bossKills - (q.startBoss || 0) < 1) { this.msg('Defeat a boss as your final trial first.', 'system'); return; }
    this.inventory.add('champions_cape', 1);
    this.inventory.add('coins', 10000);
    this.skills.addXp('hitpoints', 5000);
    this.skills.addXp('attack', 3000);
    this.skills.addXp('defence', 3000);
    q.state = 'done';
    this.msg("Quest complete — Champion of Singapore! You receive the Champion's cape.", 'level');
    this.banner('<span class="big">Champion of Singapore!</span>The island is yours to protect.');
  }

  turnInProvisions() {
    const q = this.quests.island_provisions;
    if (q.state === 'done') { this.msg('The kampung eats well thanks to you.', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask me about provisions first.', 'system'); return; }
    if (this.inventory.count('salmon') < 10) { this.msg('Bring 10 cooked salmon.', 'system'); return; }
    this.inventory.remove('salmon', 10);
    this.inventory.add('coins', 2500);
    this.skills.addXp('cooking', 1500);
    this.skills.addXp('fishing', 1000);
    q.state = 'done';
    this.msg('Quest complete — Island Provisions! Coins, Cooking and Fishing XP.', 'level');
    this.banner('<span class="big">Quest complete!</span>Island Provisions');
  }

  turnInMystic() {
    const q = this.quests.mystic_trial;
    if (q.state === 'done') { this.msg('May the runes favour you.', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask me about the mystic trial first.', 'system'); return; }
    if (this.inventory.count('death_rune') < 25) { this.msg('Bring 25 death runes to complete the trial.', 'system'); return; }
    this.inventory.remove('death_rune', 25);
    this._classReward('ancient_staff', 'magic', 4000);
    q.state = 'done';
    this.msg('Quest complete — The Mystic\'s Trial!', 'level');
    this.banner('<span class="big">Quest complete!</span>The Mystic\'s Trial');
  }

  turnInBigGame() {
    const q = this.quests.big_game_hunter;
    if (q.state === 'done') { this.msg('A fine hunter you are!', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask me about the hunt first.', 'system'); return; }
    if (this.totalKills - (q.startKills || 0) < 50) { this.msg(`Slay ${50 - (this.totalKills - (q.startKills || 0))} more creatures first.`, 'system'); return; }
    this._classReward('magic_shortbow', 'ranged', 5000);
    if (this._classWeaponType() === 'shortbow' || this._classWeaponType() === 'longbow' || !this.jobClass) this.inventory.add('rune_arrow', 100);
    q.state = 'done';
    this.msg('Quest complete — Big Game Hunter!', 'level');
    this.banner('<span class="big">Quest complete!</span>Big Game Hunter');
  }

  turnInSmith() {
    const q = this.quests.smith_apprentice;
    if (q.state === 'done') { this.msg('Fine work, apprentice!', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask me about smithing work first.', 'system'); return; }
    if (this.inventory.count('steel_bar') < 8) { this.msg('Come back with 8 steel bars.', 'system'); return; }
    this.inventory.remove('steel_bar', 8);
    this.inventory.add('kampong_gauntlets', 1);
    this.inventory.add('coins', 1500);
    this.skills.addXp('smithing', 1500);
    q.state = 'done';
    this.msg('Quest complete — A Smith\'s Apprentice! You receive the Kampong gauntlets.', 'level');
    this.banner('<span class="big">Quest complete!</span>A Smith\'s Apprentice');
  }

  turnInDefender() {
    const q = this.quests.island_defender;
    if (q.state === 'done') { this.msg('The island is safer for your deeds.', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask me about defending the island first.', 'system'); return; }
    if (this.bossKills - (q.startBoss || 0) < 3) { this.msg(`Defeat ${3 - (this.bossKills - (q.startBoss || 0))} more bosses first.`, 'system'); return; }
    this.inventory.add('island_aegis', 1);
    this._classReward('champions_helm');
    this.inventory.add('coins', 5000);
    this.skills.addXp('defence', 4000);
    q.state = 'done';
    this.msg('Quest complete — Island Defender! You receive the Island aegis and Champion\'s helm.', 'level');
    this.banner('<span class="big">Quest complete!</span>Island Defender');
  }

  markPillar(which) {
    const q = this.quests.pillars;
    if (q.state !== 'active' || q[which]) return;
    q[which] = true;
    const label = which === 'monument' ? 'A-Worthy Monument' : 'A-Worthy Mascot Statue';
    this.msg(`Pillars of the Island: you have honoured the ${label}.`, 'system');
    if (q.monument && q.obelisk) this.msg('Both pillars honoured — return to the Kampong Guide for your reward.', 'level');
    this.bus.emit('quest');
  }

  turnInPillars() {
    const q = this.quests.pillars;
    if (q.state === 'done') { this.msg('The pillars watch over you, adventurer.', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask me about the pillars first.', 'system'); return; }
    if (!q.monument || !q.obelisk) { this.msg('You must honour BOTH pillars first.', 'system'); return; }
    this.inventory.add('worthy_sigil', 1);
    this.inventory.add('coins', 2500);
    this.skills.addXp('prayer', 1200);
    this.skills.addXp('defence', 800);
    q.state = 'done';
    this.msg('Quest complete — Pillars of the Island! You receive the A-Worthy Sigil, coins and XP.', 'level');
    this.banner('<span class="big">Quest complete!</span>Pillars of the Island');
  }

  turnInBoneQuest() {
    const q = this.quests.bone_collector;
    if (q.state === 'done') { this.msg('Thanks again, adventurer!', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask me about work first.', 'system'); return; }
    if (countBones(this.inventory) < 10) { this.msg('Come back when you have 10 bones.', 'system'); return; }
    let left = 10;   // any kind counts; hand over the cheapest first
    for (const id of BONE_IDS) { const n = Math.min(left, this.inventory.count(id)); if (n) { this.inventory.remove(id, n); left -= n; } }
    this.inventory.add('coins', 1000);
    this.inventory.add('amulet_of_strength', 1);
    this.skills.addXp('prayer', 500);
    q.state = 'done';
    this.msg('Quest complete — A Bag of Bones! 1000 coins, Prayer XP and an amulet of strength.', 'level');
    this.banner('<span class="big">Quest complete!</span>A Bag of Bones');
  }

  // ---------------- Shop trading ----------------
  buyItem(shopId, itemId, qty = 1) {
    const shop = getShop(shopId);
    const price = Math.max(1, Math.round(getItem(itemId).value * shop.buyMul * this.priceFactor().buy));
    let bought = 0;
    for (let i = 0; i < qty; i++) {
      if (this.inventory.count('coins') < price) { if (i === 0) this.msg("You don't have enough coins."); break; }
      if (this.inventory.canAdd(itemId, 1) <= 0) { this.msg('Your inventory is full.'); break; }
      this.inventory.remove('coins', price);
      this.inventory.add(itemId, 1);
      bought++;
    }
    if (bought) this.msg(`You buy ${bought} x ${getItem(itemId).name} for ${price * bought} coins.`);
  }

  sellItem(shopId, itemId, qty = 1) {
    const shop = getShop(shopId);
    if (itemId === 'coins') return;
    const price = Math.max(1, Math.round(getItem(itemId).value * shop.sellMul * this.priceFactor().sell));
    const have = this.inventory.count(itemId);
    const sell = Math.min(qty, have);
    if (sell <= 0) return;
    this.inventory.remove(itemId, sell);
    this.inventory.add('coins', price * sell);
    this.msg(`You sell ${sell} x ${getItem(itemId).name} for ${price * sell} coins.`);
  }

  /** Is this gear for another class? Weapons of another type, armour of another
   *  family, accessories for another style, and arrows if you don't use a bow.
   *  Tools, shields and everything that isn't gear never count. */
  unrelatedToClass(id) {
    const cls = this.jobClass && CLASS_BY_ID[this.jobClass];
    const it = getItem(id);
    if (!cls || !it || id === 'coins' || it.tool) return false;
    if (it.tags?.includes('ammo')) return cls.weapon !== 'shortbow' && cls.weapon !== 'longbow';
    const eq = it.equip;
    if (!eq) return false;
    if (eq.weaponType) return eq.weaponType !== cls.weapon;
    if (eq.family) return !canWear(cls.id, id);
    if (eq.style) return eq.style !== (cls.style === 'dance' ? 'melee' : cls.style);
    return false;
  }

  /** Sell every item in the backpack that is gear for another class (see above). */
  sellUnrelated(shopId) {
    const ids = [...new Set(this.inventory.slots.filter(Boolean).map((s) => s.id))].filter((id) => this.unrelatedToClass(id));
    if (!ids.length) { this.msg('You have nothing for other classes to sell.', 'system'); return 0; }
    const before = this.inventory.count('coins');
    for (const id of ids) this.sellItem(shopId, id, this.inventory.count(id));
    const earned = this.inventory.count('coins') - before;
    this.msg(`You sell ${ids.length} kinds of gear for other classes for ${earned} coins.`, 'system');
    return earned;
  }

  // ---------------- Banking ----------------
  deposit(itemId, qty) {
    const have = this.inventory.count(itemId);
    const amount = Math.min(qty, have);
    if (amount <= 0) return;
    this.inventory.remove(itemId, amount);
    this.bank.deposit(itemId, amount);
  }

  depositAll() {
    // Snapshot ids first; removing while iterating compacts the slots.
    const ids = [...new Set(this.inventory.slots.filter(Boolean).map((s) => s.id))];
    let moved = 0;
    for (const id of ids) {
      const n = this.inventory.count(id);
      if (n > 0) { this.inventory.remove(id, n); this.bank.deposit(id, n); moved += n; }
    }
    if (moved) this.msg('You deposit your inventory.', 'system');
  }

  withdraw(itemId, qty) {
    const want = Math.min(qty, this.bank.count(itemId));
    const amount = this.inventory.canAdd(itemId, want);
    if (amount <= 0) { this.msg('Your inventory is full.'); return; }
    this.bank.withdraw(itemId, amount);
    this.inventory.add(itemId, amount);
  }

  // ---------------- MRT fast travel ----------------
  _nearestFree(x, y) {
    if (this.world.inBounds(x, y) && !this.world.isBlocked(x, y)) return { x, y };
    for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (this.world.inBounds(nx, ny) && !this.world.isBlocked(nx, ny)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  travelTo(stationId) {
    const st = STATION_BY_ID[stationId];
    if (!st) return false;
    if (this.inventory.count('coins') < MRT_FARE) { this.msg(`You need ${MRT_FARE} coins for the MRT fare.`); return false; }
    const tile = this._nearestFree(st.x, st.y);
    if (!tile) { this.msg('That station is unreachable.'); return false; }
    this.inventory.remove('coins', MRT_FARE);
    const p = this.player;
    p.stopNow(); p.clearAction();
    p.x = p.tx = tile.x; p.y = p.ty = tile.y; p.progress = 0; p.moving = false; p.path = [];
    this.spawnSparkle(this.player, '#8fd6ff', 14);
    this.msg(`You take the MRT to ${st.name}.`, 'system');
    this.bus.emit('sfx', 'travel');
    this.updateRegion();
    this.ui?.closeModal();
    return true;
  }

  // ---------------- Hover (per frame) ----------------
  // ---------------- Interact (no clicking the world) ----------------
  // The world isn't clicked: the Interact button / E / Space acts on the nearest
  // thing around you. Each frame we pick that thing, ring it, and label it.
  _findInteract() {
    const p = this.player;
    if (!p.alive) return null;
    const at = this.playerTile();
    const fx = p.facing?.dx || 0, fy = p.facing?.dy || 0;
    let best = null, bestScore = Infinity;
    const consider = (kind, ref, x, y, reach) => {
      const d = chebyshev(at.x, at.y, x, y);
      if (d > reach) return;
      // Nearest wins; ties go to what you're facing, then to items > people > objects.
      const ahead = (Math.sign(x - at.x) === fx && Math.sign(y - at.y) === fy) ? -0.4 : 0;
      const pref = kind === 'item' ? 0 : kind === 'npc' ? 0.1 : 0.2;
      const score = d + ahead + pref;
      if (score < bestScore) { bestScore = score; best = { kind, ref }; }
    };
    for (const g of this.world.groundItems) consider('item', g, g.x, g.y, 1);
    const fightReach = Math.max(2, this.attackRange());
    for (const n of this.npcs) {
      if (!n.alive || n.ally) continue;   // mercenaries aren't interactable
      consider('npc', n, n.x, n.y, n.attackable ? fightReach : 2);
    }
    for (const o of this.world.objects) {
      if (!o.def.verb || (o.def.type === 'tree' && o.depleted)) continue;
      if (Math.abs(o.x - at.x) > 2 || Math.abs(o.y - at.y) > 2) continue;
      consider('obj', o, o.x, o.y, 2);
    }
    return best;
  }

  _interactLabel(t) {
    if (!t) return null;
    if (t.kind === 'item') return ['Take', getItem(t.ref.id).name];
    if (t.kind === 'npc') {
      const n = t.ref;
      if (n.attackable) {
        const m = this.raceMatchup(n);
        const tip = m === 'strong' ? ', weak to your weapon' : m === 'weak' ? ', resists your weapon' : '';
        return ['Attack', `${n.name} (level ${n.def.level}, ${RACES[raceOf(n.def, n.npcId)].name}${tip})`];
      }
      if (n.def.role === 'shop') return ['Trade with', n.name];
      if (n.def.role === 'bank') return ['Bank', n.name];
      return ['Talk to', n.name];
    }
    const d = t.ref.def;
    // Gathering spots say which skill they use, and warn when you're too low.
    if (d.skill && d.level && this.skills.level(d.skill) < d.level) {
      const sk = SKILLS.find((x) => x.id === d.skill);
      return [d.verb, `${d.name} (needs ${sk ? sk.name : d.skill} ${d.level})`, d.skill, true];
    }
    return [d.verb, d.name, d.skill || null, false];
  }

  /** P: pickpocket the nearest townsperson (the old right-click option). */
  pickpocketNearest() {
    const at = this.playerTile();
    let best = null, bd = Infinity;
    for (const n of this.npcs) {
      if (!n.alive || n.attackable || !n.def.role) continue;
      const d = chebyshev(at.x, at.y, n.x, n.y);
      if (d <= 2 && d < bd) { bd = d; best = n; }
    }
    if (!best) { this.msg('There is nobody close enough to pickpocket.', 'system'); return; }
    this.startPickpocket(best);
  }

  /** Interact button / E / Space: act on the nearest thing around you. */
  // ---------------- MOBA-style attack and skill buttons ----------------
  /** The foe the Attack button (or a skill) should go for: whatever is hunting
   *  you first, then the nearest. With `dir` (a unit vector from a dragged
   *  skill), only foes inside a 60° cone that way count, nearest to the line
   *  first. Story bosses are left alone unless they're already on you. */
  nearestFoe(dir = null, reach = 10) {
    const p = this.player;
    let best = null, bestScore = Infinity;
    for (const n of this.nearbyNpcs()) {
      if (!n.alive || !n.attackable) continue;
      if (n.def.fixed && n.target !== p && p.action?.npc !== n) continue;
      const dx = n.x - p.fx, dy = n.y - p.fy, d = Math.hypot(dx, dy);
      if (d > reach) continue;
      let score = d - (n.target === p ? 3 : 0);
      if (dir) {
        const cos = d ? (dx * dir.x + dy * dir.y) / d : 1;
        if (cos < 0.5) continue;
        score = d * (2 - cos);
      }
      if (score < bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  /** Attack button: lock onto the best foe (keeping the current one if it's
   *  still alive, unless a direction was given) and fight it. */
  attackNearest(dir = null) {
    const a = this.player.action;
    const cur = a && a.type === 'attack' && a.npc && a.npc.alive ? a.npc : null;
    const foe = (!dir && cur) || this.nearestFoe(dir);
    if (!foe) {
      if (!this._noFoeSaid) this.msg('No enemies nearby.', 'system');
      this._noFoeSaid = true;
      return false;
    }
    this._noFoeSaid = false;
    if (foe !== cur) this.attackNpc(foe);
    return true;
  }

  /** A skill button: attack skills go for the foe it was aimed at (or the
   *  current / nearest foe on a tap), then the skill is readied or fired. */
  useSkillAt(id, dir = null) {
    const ab = ABILITY_BY_ID[id];
    if (!ab) return;
    if (ab.kind === 'attack' && this.player.alive) {
      const a = this.player.action;
      const cur = a && a.type === 'attack' && a.npc && a.npc.alive ? a.npc : null;
      const foe = dir ? this.nearestFoe(dir) : (cur || this.nearestFoe());
      if (foe && foe !== cur) this.attackNpc(foe);
    }
    this.activateAbility(id);
  }

  /** Holding the Attack button: when the foe falls, move straight on to the next. */
  _holdAttack() {
    if (!this.attackHeld || !this.player.alive) return;
    const a = this.player.action;
    if (a && a.type === 'attack' && a.npc && a.npc.alive) return;
    if (this.playMs < (this._holdRetryAt || 0)) return;
    this._holdRetryAt = this.playMs + 250;
    this.attackNearest();
  }

  interact() {
    const t = this._findInteract();
    if (!t) { this.msg('There is nothing to interact with here.', 'system'); return; }
    if (t.kind === 'item') this.pickup(t.ref);
    else if (t.kind === 'npc') this.defaultNpcAction(t.ref);
    else this.defaultObjectAction(t.ref);
  }

  updateHover() {
    if (!this.ui) return;
    const t = this._findInteract();
    this.interactTarget = t;
    this.hover = t && t.kind === 'npc' ? { npc: t.ref } : t && t.kind === 'obj' ? { obj: t.ref } : null;
    const label = this._interactLabel(t);
    if (label) this.ui.setHoverText(label[0], label[1]);
    else this.ui.setHoverText('');
    this.ui.setInteractLabel?.(label);
  }

  // ---------------- Input entrypoints ----------------
  // Clicking or tapping the world does nothing: you move with the joystick /
  // WASD and act with Interact. (The HUD panels are still clickable.)
  onLeftClick() { this.ui?.hideContextMenu(); }
  onRightClick() { this.ui?.hideContextMenu(); }
}
