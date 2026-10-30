import { EventBus } from '../core/events.js';
import { buildWorld } from '../data/world.js';
import { compareGear, deltaText } from './gear.js';
import { RARITY, dropRarity, lootDelay } from './loot.js';
import { dayKey, prevDayKey, makeBounties, streakMult } from './bounty.js';
import { MAX_UPGRADE, upgradeCost, upgradeChance, upgradedName } from './upgrade.js';
import { getItem, MELEE_REACH } from '../data/items.js';
import { chebyshev, randInt, weightedPick, capitalize } from '../core/utils.js';
import {
  TILE, TICK_MS, COMBAT_BEAT_MS, RESPAWN_TICKS, AUTOSAVE_TICKS, DAY_CYCLE_MS,
  XP_RATE,
} from '../config.js';

import { World } from './world.js';
import { Skills } from './skillset.js';
import { Inventory } from './inventory.js';
import { Equipment, canDualWield } from './equipment.js';
import { Bank } from './bank.js';
import { Player } from './player.js';
import { NPC } from './npc.js';
import { Camera } from '../engine/camera.js';
import { findPath } from '../engine/pathfinding.js';
import {
  playerAttackVsNpc, npcAttackVsPlayer, rollAttack, rollGuaranteed, combatXp,
  playerRangedVsNpc, combatXpRanged, playerMagicVsNpc, RANGED_STYLES,
  weaknessOf, WEAKNESS_BONUS, critChance, CRIT_MULT,
  playerDanceVsNpc, combatXpDance, danceEvade, RHYTHM_MAX,
} from './combat.js';
import { ABILITY_BY_ID, abilitiesFor } from '../data/abilities.js';
import { RACES, raceOf, matchup, RACE_BONUS, RACE_PENALTY } from '../data/races.js';
import { DOT_KINDS } from '../data/bossAbilities.js';
import { CLASS_BY_ID, WEAPON_TYPE_NAMES, starterWeapon, equivalentWeapon } from '../data/classes.js';
import { STYLE_TRACKS, sumPerks, perkAtLevel, rankName, PERK_SKILLS } from '../data/perks.js';
import { getSpell, SPELLS } from '../data/magic.js';
import { xpForLevel } from '../data/xp.js';
import { PRAYERS, PRAYER_BY_ID, PRAYER_GROUPS } from '../data/prayers.js';
import {
  resolveWoodcut, resolveMine, resolveFish, resolveCook,
  resolveSmelt, resolveSmith, resolveFiremake, resolveCraft, resolveDish,
  resolveHunt, resolveRecipe,
} from './skilling.js';
import { CROP_BY_SEED, cropFor, POTIONS } from '../data/trades.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { getShop } from '../data/shops.js';
import { RARE_DROP_TABLE, getNpc } from '../data/npcs.js';
import { ACHIEVEMENTS, rewardFor } from '../data/achievements.js';
import { eligibleTasks, SLAYER_REWARDS } from '../data/slayer.js';
import { STATIONS, STATION_BY_ID, MRT_FARE } from '../data/transport.js';
import { SKILLS } from '../data/skills.js';
import { Learning } from './learning.js';
import { TOPIC_BY_ID } from '../data/questions.js';
import { LIFE_STAGES, LIFE_GRAD, LIFE_STAGES_ADV, LIFE_GRAD_ADV, LIFE_STAGES_WILD, LIFE_GRAD_WILD } from '../data/lifeskills.js';
import { QUESTS, CHAMPION_QP, REDEMPTION_GOAL, CORRUPTION_GOAL } from '../data/quests.js';
import { CLUE_TIERS, CLUE_SPOTS, clueTierForLevel } from '../data/clues.js';

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
const BOSS_XP_PER_LEVEL = 40;

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

    this.running = false;
    this.runEnergy = 100;
    this.effects = [];
    this.hazards = [];          // pending boss area attacks (red ground markers)
    this.hitStop = 0;           // ms of near-frozen animation after a big hit
    this.killStreak = 0;        // chained kills for the XP bonus
    this._lastKillTick = -1e9;
    // Auto battle settings: eat below this fraction of life (0 = never),
    // fight only one monster type (null = anything), use attack skills.
    this.autoCfg = { eatAt: 0.4, target: null, abilities: true, bosses: true, priority: true };
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
    this.knowledgeStrikes = typeof document !== 'undefined';
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
      if (!this.learning.dailyDone(this.todayKey())) this.msg('Your daily revision is ready in the Knowledge Codex (Skills tab).', 'level');
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
      this.bus.emit('inventory'); this.bus.emit('equipment');
      return;
    }
    this.pendingStyleChoice = false;
    const style = cls.style;
    const starter = starterWeapon(classId);
    if (style === 'ranged') {
      this.equipment.set('weapon', starter);
      this.equipment.set('head', 'coif');
      this.equipment.set('body', 'studded_body');
      this.equipment.set('legs', 'leather_chaps');
      this.inventory.add('bronze_arrow', 999);
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
      // Rogues start dual wielding; every other melee class gets a shield.
      this.equipment.set('shield', cls.weapon === 'dagger' ? starter : 'wooden_shield');
      this.equipment.set('body', 'leather_body');
    }
    this.player.hp = this.maxHp();
    this.msg(`You are a ${cls.name}: you fight with ${WEAPON_TYPE_NAMES[cls.weapon]}. Talk to the Kampong Guide for tips.`, 'system');
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
    return { width: this.world.width, height: this.world.height, isBlocked: (x, y) => this.world.isBlocked(x, y) };
  }

  canRun() { return this.running && this.runEnergy > 0; }

  /** Max hitpoints = Hitpoints level + any bonus HP from equipment. */
  maxHp() {
    const base = this.skills.hitpoints + (this.equipment.bonuses().hp || 0);
    return base + Math.floor(base * (this.perkMods('defence').maxhp || 0));   // Vitality / Second Skin perks
  }

  /** Summed passive-perk modifiers for a fighting style (its tracks plus Defence),
   *  or for 'defence' alone. Cached until a relevant level changes. */
  perkMods(mode = this.combatMode()) {
    const sk = this.skills;
    const key = mode + ':' + PERK_SKILLS.map((s) => sk.level(s)).join(',');
    this._perkCache ||= new Map();
    let m = this._perkCache.get(key);
    if (!m) {
      const tracks = mode === 'defence' ? ['defence'] : [...(STYLE_TRACKS[mode] || STYLE_TRACKS.melee), 'defence'];
      m = sumPerks(tracks, (s) => sk.level(s));
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
    entity._splatN = ((entity._splatN || 0) + 1) % 3;
    this.effects.push({ type: 'hitsplat', entity, dmg, crit: !!opts.crit, text: opts.text, tint: opts.tint, life: 1100, fan: entity._splatN - 1 });
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
      for (const n of this.npcs) if (Math.abs(n.x - px) <= 48 && Math.abs(n.y - py) <= 48) n.update(adt); }
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
      else { this.resolvePlayerAction(); this._autoBattleTick(); }
      this._autoPickup();
    }
    this._resolveHazards();
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
    for (const n of this.npcs) {
      if (Math.abs(n.x - px) > 46 || Math.abs(n.y - py) > 46) continue;
      n.tick(this);
    }
    if (this.hasTemps) this.npcs = this.npcs.filter((n) => !(n.temporary && !n.alive));
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

  updateRunEnergy() {
    let changed = false;
    if (this.running && this.player.isMoving && this.player.alive) {
      this.runEnergy = Math.max(0, this.runEnergy - 1.0);
      if (this.runEnergy === 0) this.running = false;
      changed = true;
    } else if (this.runEnergy < 100) {
      this.runEnergy = Math.min(100, this.runEnergy + 1.0 + this.skills.agility * 0.015);
      changed = true;
    }
    if (changed) this.bus.emit('run');
  }

  toggleRun() {
    if (!this.running && this.runEnergy <= 0) return;
    this.running = !this.running;
    this.bus.emit('run');
  }

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
      case 'farm': return this._tickArrival(a, a.obj, true, () => this.tendPatch(a.obj));
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
        this.addGood(1); // devotion is a small good
        this.markPillar('monument');
      });
      case 'rest': return this._tickArrival(a, a.obj, true, () => {
        this.player.hp = this.maxHp();
        this.runEnergy = 100;
        this.bus.emit('hp'); this.bus.emit('run');
        this.spawnSparkle(this.player, '#f5a623', 16);
        this.msg('You rest at the A-Worthy Mascot Statue. Health and run energy restored.', 'system');
        this.markPillar('obelisk');
      });
      case 'thieve': return this._tickArrival(a, a.target, true, () => this.pickpocket(a.npc));
      case 'agility': return this._tickContinuous(a, a.obj, () => this.resolveAgility(a.obj));
      case 'stall': return this._tickContinuous(a, a.obj, () => this.stealFromStall(a.obj));
      case 'transport': return this._tickArrival(a, a.target, true, () => this.ui?.openTransport(a.obj));
      case 'openbank': return this._tickArrival(a, a.target, true, () => this.ui?.openBank());
      case 'openshop': return this._tickArrival(a, a.target, true, () => this.ui?.openShop(a.shop));
      case 'talk': return this._tickArrival(a, a.target, true, () => this.ui?.openDialogue(a.npc));
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
    const here = this.playerTile();
    let best = null, bd = Infinity;
    for (const o of this.world.objects) {
      if (o === obj || o.objId !== obj.objId || o.depleted) continue;
      const d = chebyshev(here.x, here.y, o.x, o.y);
      if (d <= 20 && d < bd) { bd = d; best = o; }
    }
    if (!best) { this.msg(`No more ${obj.def.name.toLowerCase()}s nearby: auto gather waits here.`, 'system'); return false; }
    this.defaultObjectAction(best);
    return true;
  }

  toggleAutoGather(on = !this.autoGather) {
    this.autoGather = !!on;
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
    this._pathBudget = 150000;       // like quest trips, these can cross the whole map
    try { this.defaultObjectAction(obj); } finally { this._pathBudget = 0; }
    const ok = !!this.player.action || this.player.isMoving;
    this.msg(ok ? `You head for the ${obj.def.name.toLowerCase()}.` : "I can't find the way there.", 'system');
    if (ok) this.ui?.closeModal();
    return ok;
  }

  /** World map: ride the MRT to a station you've already found. */
  mrtFromMap(stationId) {
    if (!this.stationsFound.has(stationId)) { this.msg("You haven't found that station yet: walk there first.", 'system'); return false; }
    if (this.npcs.some((n) => n.alive && n.target === this.player)) { this.msg("You can't take the MRT while something is attacking you.", 'system'); return false; }
    const coins = this.inventory.count('coins');
    this.travelTo(stationId);
    return this.inventory.count('coins') < coins;
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
    if (this.playerStun > 0 || p.attackCooldown > 0) return;
    const a = p.action;
    if (!a || a.type !== 'attack' || !a.npc || !a.npc.alive) return;
    if (chebyshev(p.x, p.y, a.npc.x, a.npc.y) > this.attackRange()) return;
    this.doPlayerAttack(a.npc);
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
    const { atkRoll, defRoll, max } = playerAttackVsNpc(this.skills, this.equipment, this.player.style, npc.def);
    const pm = this.prayerMult();
    const baseMax = Math.round(max * pm.str);
    this._swingToward(this.player, npc.x, npc.y);

    // Fold together special attack + armed ability + style-weakness bonuses.
    const mods = this._offensiveMods(npc, 'melee');
    const fancy = mods.spec || mods.ability;
    this._slash(npc, fancy ? '#ffd24a' : '#eef2f6');
    this.bus.emit('sfx', 'swish');
    let total = 0;
    for (let i = 0; i < mods.hits && npc.hp > 0; i++) {
      const effMax = Math.max(1, Math.round(baseMax * mods.dmgM));
      let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollAttack(atkRoll * pm.att * mods.accM, defRoll, effMax);
      const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
      if (dmg > 0) { this.spawnHitSparks(npc, (c.crit || fancy) ? '#ffd24a' : '#fff2b0'); for (const x of combatXp(this.player.style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult()); }
      total += dmg;
    }
    // Dual wielding: the off-hand dagger follows up with its own strike (60% max hit).
    if (this.equipment.isDualWielding() && npc.hp > 0) {
      const offMax = Math.max(1, Math.round(baseMax * 0.6));
      const dmg = rollAttack(atkRoll * pm.att, defRoll, offMax);
      this._slash(npc, '#cfe8ff');
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && dmg >= offMax });
      if (dmg > 0) { this.spawnHitSparks(npc, '#e6f2ff'); for (const x of combatXp(this.player.style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult()); }
      total += dmg;
    }
    if (mods.heal && total > 0) {
      this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.round(total * mods.heal));
      this.bus.emit('hp');
    }
    this.player.attackCooldown = this.equipment.weaponSpeed();
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
  _inCombat() {
    if (this.player.action && this.player.action.type === 'attack') return true;
    return this.npcs.some((n) => n.alive && n.target === this.player);
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

  _gainAdrenaline(n) {
    if (n <= 0) return;
    n *= 1 + (this.perkMods().adren || 0);   // Battle Rhythm / Lightfoot perks
    this.adrenaline = Math.min(100, this.adrenaline + n);
    this.bus.emit('adrenaline');
  }

  abilityUnlocked(ab) { return this.skills.combatLevel() >= (ab.unlock || 1); }

  /** The action-bar abilities for the weapon in hand (Z/X/B swap with the weapon). */
  currentAbilities() { return abilitiesFor(this.combatMode()); }

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
    if (this.adrenaline < ab.cost) { this.msg(`You need ${ab.cost}% adrenaline for ${ab.name}.`, 'system'); return; }
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
    this.adrenaline -= ab.cost;
    this.abilityCd[id] = ab.cd;
    if (ab.kind === 'guard') {
      this.braceTicks = ab.guardTicks;
      this.msg('You brace for impact — incoming damage halved!', 'system');
      this.spawnSparkle(this.player, '#7fd8ff', 12);
      this.bus.emit('sfx', 'spec');
    } else if (ab.kind === 'heal') {
      const heal = Math.max(1, Math.round(this.maxHp() * ab.healFrac));
      this.player.hp = Math.min(this.maxHp(), this.player.hp + heal);
      this.msg(`Second Wind restores ${heal} life.`, 'system');
      this.spawnSparkle(this.player, '#7fff8f', 14);
      this.bus.emit('hp');
      this.bus.emit('sfx', 'eat');
    }
    this.bus.emit('adrenaline');
    this.bus.emit('ability');
  }

  /** Consume an armed offensive ability for the current hit (spends adrenaline). */
  _takeAbility() {
    if (!this.armedAbility) return null;
    const ab = ABILITY_BY_ID[this.armedAbility];
    this.armedAbility = null;
    if (!ab || ab.kind !== 'attack' || !this.abilityUnlocked(ab) || this.adrenaline < ab.cost || (this.abilityCd[ab.id] || 0) > 0
        || (ab.mode && ab.mode !== this.combatMode())) {
      this.bus.emit('ability');
      return null;
    }
    this.adrenaline -= ab.cost;
    this.abilityCd[ab.id] = ab.cd;
    this.bus.emit('adrenaline');
    this.bus.emit('ability');
    return ab;
  }

  /** Combined offensive modifiers from an armed special + ability + weakness. */
  _offensiveMods(npc, mode) {
    const spec = this._takeSpec();
    const ab = this._takeAbility();
    const weak = weaknessOf(npc.def) === (mode === 'dance' ? 'melee' : mode);   // whips count as melee for weaknesses
    let accM = (spec ? spec.acc || 1 : 1) * (weak ? WEAKNESS_BONUS.acc : 1);
    let dmgM = (spec ? spec.dmg || 1 : 1) * (ab ? ab.dmgMul || 1 : 1) * (weak ? WEAKNESS_BONUS.dmg : 1);
    // Race: the weapon in hand bites harder into some races and is shrugged off by others.
    const race = this.raceMatchup(npc);
    if (race === 'strong') { accM *= RACE_BONUS.acc; dmgM *= RACE_BONUS.dmg; }
    else if (race === 'weak') dmgM *= RACE_PENALTY.dmg;
    // Magic casts once (rune cost), so its extra hits are ignored.
    const maxHits = mode === 'magic' ? 1 : Infinity;
    // Passive perks: accuracy, armour piercing, damage (more against bosses and
    // champions), crit, and a chance of an extra hit (a spell echoes instead).
    const perk = this.perkMods(mode);
    this._perkCtx = perk;
    accM *= (1 + (perk.acc || 0) + this.learning.perks().acc) / (1 - (perk.pierce || 0));   // English mastery: Eloquence
    dmgM *= 1 + (perk.dmg || 0) + ((npc.def.boss || npc.champion) ? (perk.boss || 0) : 0);
    const bonusHit = Math.random() < (perk.extra || 0);
    perk._echo = mode === 'magic' && bonusHit;
    const hits = Math.min(maxHits, Math.max(spec ? spec.hits || 1 : 1, ab ? ab.hits || 1 : 1)) + (bonusHit && mode !== 'magic' ? 1 : 0);
    const guaranteed = !!(ab && ab.guaranteed);
    const heal = spec ? spec.heal || 0 : 0;
    if (spec) { this.msg(`Special attack: ${spec.name}!`, 'combat'); this.spawnSparkle(this.player, '#ffd24a', 12); }
    if (ab) { this.msg(`Ability: ${ab.name}!`, 'combat'); this.spawnSparkle(this.player, '#ff9a3a', 10); this.bus.emit('sfx', 'spec'); }
    if (weak) this.spawnSparkle(npc, '#9affd0', 6);
    if (race === 'strong') this.spawnSparkle(npc, '#ffd24a', 5);
    // Say it once per foe: an "Effective!" pop the first time your weapon bites, or "Resisted".
    if (race && npc._raceSaid !== race) { npc._raceSaid = race; this.addHitsplat(npc, 0, { text: race === 'strong' ? 'Effective!' : 'Resisted' }); }
    const lvl = mode === 'ranged' ? this.skills.ranged : mode === 'magic' ? this.skills.magic : mode === 'dance' ? this.skills.agility : this.skills.attack;
    const critCh = critChance(lvl, this.equipment.bonuses().crit) + (perk.crit || 0) + this.learning.perks().crit;
    return { accM, dmgM, hits, guaranteed, heal, spec, ability: ab, weak, race, critCh };
  }

  /** The type of the weapon in hand ('dagger', 'longbow', ...), or null bare-handed. */
  weaponType() {
    const w = this.equipment.get('weapon');
    return (w && getItem(w).equip?.weaponType) || null;
  }

  /** How the weapon in hand fares against this foe's race: 'strong', 'weak' or null. */
  raceMatchup(npc) {
    return matchup(this.weaponType(), raceOf(npc.def, npc.npcId));
  }

  /** Roll a critical hit on a landed blow: crits multiply damage by CRIT_MULT. */
  _critHit(dmg, critCh) {
    if (dmg > 0 && Math.random() < critCh) return { dmg: Math.max(dmg + 1, Math.round(dmg * CRIT_MULT)), crit: true };
    return { dmg, crit: false };
  }

  _applyPlayerHit(npc, dmg, opts = {}) {
    if (npc.shieldTicks > 0 && dmg > 0) dmg = Math.max(1, Math.floor(dmg / 2));   // a boss shield halves the blow
    if (npc.reflectTicks > 0 && dmg > 0 && this.player.alive) {
      const back = Math.min(this.player.hp, Math.max(1, Math.round(dmg * (npc.reflectFrac || 0.2))), Math.ceil(this.maxHp() * 0.1));
      this.player.takeDamage(back);
      this.addHitsplat(this.player, back, { tint: '#f5b82e' });
      this.bus.emit('hp');
      if (this.player.hp <= 0) this.playerDeath();
    }
    npc.takeDamage(dmg);
    const perk = this._perkCtx;
    if (perk && dmg > 0) {
      this._lastHitDmg = dmg;
      if (perk.lifesteal) { const p = this.player; const heal = Math.max(1, Math.round(dmg * perk.lifesteal)); if (p.hp < this.maxHp()) { p.hp = Math.min(this.maxHp(), p.hp + heal); this.bus.emit('hp'); } }
      if (perk.stun && npc.hp > 0 && Math.random() < perk.stun) { npc.windup = 0; npc.attackCooldown = Math.max(npc.attackCooldown || 0, 3); this.addHitsplat(npc, 0, { text: 'Stunned!' }); }
    }
    if (dmg > 0) this._knock(npc, this.player);
    // Effective blows land in gold, resisted ones in grey (unless something else tints them).
    const rm = dmg > 0 && !opts.tint ? this.raceMatchup(npc) : null;
    if (rm) opts = { ...opts, tint: rm === 'strong' ? '#f5b82e' : '#9aa3b2' };
    this.addHitsplat(npc, dmg, opts);
    if (dmg > 0) { this.bus.emit('sfx', 'hit'); this._gainAdrenaline(10); }
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
      ? [npc, ...this.npcs.filter((n) => n !== npc && n.alive && n.attackable && !n.temporary && n.hp > 0 && chebyshev(p.x, p.y, n.x, n.y) <= range)]
      : [npc];
    let total = 0;
    for (const t of targets) {
      const { atkRoll, defRoll, max } = playerDanceVsNpc(this.skills, this.equipment, style, t.def, this.danceRhythm);
      this._lash(t, fancy ? '#ffd24a' : '#ff8ac0');
      for (let i = 0; i < mods.hits && t.hp > 0; i++) {
        const effMax = Math.max(1, Math.round(max * pm.str * mods.dmgM));
        let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollAttack(atkRoll * pm.att * mods.accM, defRoll, effMax);
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
    this._danceHitTick = this.tickCount;
    if (this.danceRhythm >= RHYTHM_MAX && total > 0) this.spawnSparkle(p, '#ff8ac0', 4);
    if (mods.heal && total > 0) { p.hp = Math.min(this.maxHp(), p.hp + Math.round(total * mods.heal)); this.bus.emit('hp'); }
    p.attackCooldown = this.equipment.weaponSpeed();
    this.bus.emit('rhythm');
    this._postAttack(npc);
  }

  _perkSplash(from, dmg) {
    const other = this.npcs.find((n) => n !== from && n.alive && n.attackable && !n.temporary && n.hp > 0 && chebyshev(n.x, n.y, from.x, from.y) <= 3);
    if (!other) return;
    other.takeDamage(dmg);
    this.addHitsplat(other, dmg, { tint: '#f5b82e' });
    this.spawnHitSparks(other, '#ffe89a');
    if (!other.target) other.target = this.player;
    if (other.hp <= 0) this.killNpc(other);
  }

  /** A whip crack: a wavy line from the hero's hand to the target. */
  _lash(npc, color) {
    const from = this.player.renderCenter(), to = npc.renderCenter();
    this.effects.push({ type: 'lash', x: from.x + (to.x >= from.x ? 8 : -8), y: from.y - 4, ex: to.x, ey: to.y - 8, color, life: 260, maxLife: 260 });
  }

  _rangedAttack(npc) {
    const arrowIdx = this.inventory.slots.findIndex((s) => s && getItem(s.id).tags?.includes('ammo'));
    if (arrowIdx === -1) { this._outOfAmmo('You have no arrows left.'); this.player.clearAction(); return; }
    const arrowStr = getItem(this.inventory.slotAt(arrowIdx).id).arrowStr || 0;
    const style = this.player.rangedStyle;
    const { atkRoll, defRoll, max } = playerRangedVsNpc(this.skills, this.equipment, style, npc.def, arrowStr);
    const pr = this.prayerMult().ranged;
    const baseMax = Math.round(max * pr);
    const mods = this._offensiveMods(npc, 'ranged');
    const fancy = mods.spec || mods.ability;
    this._swingToward(this.player, npc.x, npc.y);
    let total = 0;
    for (let i = 0; i < mods.hits && npc.hp > 0; i++) {
      if (i > 0) { // extra shots consume extra arrows
        const ai = this.inventory.slots.findIndex((s) => s && getItem(s.id).tags?.includes('ammo'));
        if (ai === -1) break;
        this._spendArrow(ai);
      } else { this._spendArrow(arrowIdx); }
      const effMax = Math.max(1, Math.round(baseMax * mods.dmgM));
      let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollAttack(atkRoll * pr * mods.accM, defRoll, effMax);
      const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
      this._projectile(npc, (c.crit || fancy) ? '#ffd24a' : '#d9c45a', 'arrow', mods.hits > 1 ? i - (mods.hits - 1) / 2 : 0);
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
      if (dmg > 0) { this.spawnHitSparks(npc, (c.crit || fancy) ? '#ffd24a' : '#cfe0a0'); for (const x of combatXpRanged(style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult()); }
      total += dmg;
    }
    if (mods.heal && total > 0) { this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.round(total * mods.heal)); this.bus.emit('hp'); }
    if (this.skills.ranged >= SPLIT_SHOT_LEVEL) this._splitShot(npc, style, pr);
    this.player.attackCooldown = Math.max(1, this.equipment.weaponSpeed() + (RANGED_STYLES[style]?.speedMod || 0));
    this._postAttack(npc);
  }

  /** Split shot (Ranged 300+): each shot also looses an arrow at up to two other
   *  monsters in reach, nearest first, so three targets are hit at once. */
  _splitShot(main, style, pr) {
    const p = this.player, range = this.attackRange();
    const extra = this.npcs
      .filter((n) => n !== main && n.alive && n.attackable && !n.temporary && n.hp > 0 && chebyshev(p.x, p.y, n.x, n.y) <= range)
      .sort((a, b) => chebyshev(p.x, p.y, a.x, a.y) - chebyshev(p.x, p.y, b.x, b.y))
      .slice(0, SPLIT_SHOT_TARGETS - 1);
    for (const n of extra) {
      const ai = this.inventory.slots.findIndex((s) => s && getItem(s.id).tags?.includes('ammo'));
      if (ai === -1) break;
      const arrowStr = getItem(this.inventory.slotAt(ai).id).arrowStr || 0;
      this._spendArrow(ai);
      const { atkRoll, defRoll, max } = playerRangedVsNpc(this.skills, this.equipment, style, n.def, arrowStr);
      const effMax = Math.max(1, Math.round(max * pr));
      let dmg = rollAttack(atkRoll * pr, defRoll, effMax);
      const c = this._critHit(dmg, 0); dmg = c.dmg;
      this._projectile(n, '#9fe0ff', 'arrow', 0);
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

  _magicAttack(npc) {
    let spell = getSpell(this.player.spell);
    // Can't cast the chosen spell (level or runes)? Fall back to the best one you can.
    if (this.skills.magic < spell.level || !this._hasRunes(spell)) {
      const alt = this.bestSpell();
      if (!alt) { this._outOfAmmo(`You don't have the runes to cast ${spell.name}.`); this.player.clearAction(); return; }
      spell = alt;
    }
    this._consumeRunes(spell);
    const { atkRoll, defRoll, max } = playerMagicVsNpc(this.skills, this.equipment, spell, npc.def);
    const mods = this._offensiveMods(npc, 'magic');
    const fancy = mods.spec || mods.ability;
    const effMax = Math.max(1, Math.round(max * mods.dmgM));
    let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollAttack(atkRoll * this.prayerMult().magic * mods.accM, defRoll, effMax);
    const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
    this._swingToward(this.player, npc.x, npc.y);
    this._projectile(npc, (c.crit || fancy) ? '#e0a0ff' : spell.tint, 'bolt');
    this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
    this.skills.addXp('magic', spell.xp * this.combatXpMult());
    if (dmg > 0) { this.spawnHitSparks(npc, spell.tint); this.skills.addXp('magic', dmg * 2); this.skills.addXp('hitpoints', dmg * 1.33); }
    // Spells come off a staff a beat quicker than its swing speed.
    this.player.attackCooldown = Math.max(1, this.equipment.weaponSpeed() - 1);
    this._postAttack(npc);
  }

  /** The rune an equipped elemental staff supplies without limit (or null). */
  freeRune() {
    const w = this.equipment.get('weapon');
    return (w && getItem(w).equip?.runes) || null;
  }
  _hasRunes(spell) { const free = this.freeRune(); return Object.entries(spell.runes).every(([id, q]) => id === free || this.inventory.count(id) >= q); }
  _consumeRunes(spell) {
    if (Math.random() < (this.perkMods('magic').runeSave || 0)) return;   // Rune Saver perk
    const free = this.freeRune(); for (const [id, q] of Object.entries(spell.runes)) if (id !== free) this.inventory.remove(id, q);
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

  _projectile(npc, color, kind = 'bolt', spread = 0) {
    const from = this.player.renderCenter();
    const to = npc.renderCenter();
    // `spread` fans a volley (Snapshot, Arrow Storm) so each arrow is visible.
    const off = spread * 5;
    // Arrows leave from the bow hand and fly at a steady speed, so long shots
    // take visibly longer; bolts stay quick.
    const fx = kind === 'arrow' ? from.x + (to.x >= from.x ? 9 : -9) : from.x;
    const dist = Math.hypot(to.x - fx, to.y - from.y);
    const life = kind === 'arrow' ? Math.min(650, 140 + dist / 0.55) + Math.abs(spread) * 40 : 240 + Math.abs(spread) * 40;
    this.effects.push({ type: 'projectile', kind, x: fx, y: from.y - 6 + off, ex: to.x, ey: to.y - 8 + off * 0.6, color, life, maxLife: life,
      arc: kind === 'arrow' ? Math.min(22, dist * 0.09) : 0 });
  }

  resolveNpcAttack(npc, opts = {}) {
    const p = this.player;
    if (!p.alive) return;
    this._swingToward(npc, p.x, p.y);
    const heavy = !!opts.heavy;
    // Dancers slip blows entirely now and then (more often in the Twirl style).
    if (this.combatMode() === 'dance' && Math.random() < danceEvade(this.skills.agility, p.danceStyle) * (heavy ? 0.5 : 1)) {
      this.addHitsplat(p, 0, { text: 'Dodged!' });
      this.spawnSparkle(p, '#ff8ac0', 5);
      if (p.autoRetaliate && (!p.action || p.action.type !== 'attack')) this.attackNpc(npc);
      return;
    }
    const perk = this.perkMods();
    if (perk.dodge && Math.random() < perk.dodge * (heavy ? 0.5 : 1)) {   // Evasion / Graceful perks
      this.addHitsplat(p, 0, { text: 'Dodged!' });
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
    dmg = this._perkReduce(dmg, npc);
    if (dmg > 0 && perk.thorns && npc.alive) {           // Spiked Armour perk
      const back = Math.max(1, Math.round(dmg * perk.thorns));
      npc.takeDamage(back); this.addHitsplat(npc, back, { tint: '#9aa6b2' });
      if (npc.hp <= 0) { this.killNpc(npc); }
    }
    p.takeDamage(dmg);
    if (dmg > 0) this._knock(p, npc);
    this.addHitsplat(p, dmg, { crit: heavy && dmg > 0 });
    if (dmg > 0) { this.spawnHitSparks(p, heavy ? '#ff5a5a' : '#ff8a8a'); this.bus.emit('sfx', 'hurt'); this._gainAdrenaline(heavy ? 10 : 5); }
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

  killNpc(npc) {
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
    if (npc.def.boss) {
      this.bossKills++;
      // A boss kill is a big payday: bonus XP in your combat style and Hitpoints.
      const xp = Math.round((npc.def.level || 1) * BOSS_XP_PER_LEVEL * this.combatXpMult());
      const mode = this.combatMode();
      const skill = mode === 'ranged' ? 'ranged' : mode === 'magic' ? 'magic' : mode === 'dance' ? 'agility' : ({ aggressive: 'strength', defensive: 'defence' }[this.player.style] || 'attack');
      this.skills.addXp(skill, xp); this.skills.addXp('hitpoints', Math.round(xp / 3));
      this.msg(`Boss slain! +${xp * XP_RATE} ${skill} XP.`, 'level');
    }
    if ((npc.def.boss && this.quests.island_defender.state === 'active') ||
        this.quests.big_game_hunter.state === 'active') this.bus.emit('quest');
    this.progressSlayer(npc);
    this.progressBounties(npc);
    this.checkAchievements();
    this._deathBurst(npc);
    this.rollDrops(npc);
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
    b.list = makeBounties(today, this.skills.combatLevel(), [...seen.values()]);
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
    // Walking past an MRT station adds it to the world map's ride list.
    for (const st of STATIONS) {
      if (this.stationsFound.has(st.id) || chebyshev(this.player.x, this.player.y, st.x, st.y) > 6) continue;
      this.stationsFound.add(st.id);
      this.msg(`You found ${st.name} MRT station: you can ride here from the world map now.`, 'level');
    }
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
    if (def.dropTable && def.dropTable.length) {
      // Champions roll their table three times, bosses four, and neither comes up empty.
      const rolls = def.boss ? 4 : npc.champion ? 3 : 1;
      for (let r = 0; r < rolls; r++) {
        let pick = weightedPick(def.dropTable);
        if (npc.champion || def.boss) for (let k = 0; pick.nothing && k < 5; k++) pick = weightedPick(def.dropTable);
        if (pick.nothing) continue;
        const q = pick.min ? randInt(pick.min, pick.max) : 1;
        let rar = dropRarity(pick.id, 'table', { boss: !!def.boss });
        if (npc.champion && rar === 'common') rar = 'rare';
        loot.push([pick.id, q, rar]);
      }
    }
    // Rare drop table — small base chance, much higher for bosses, champions & high levels.
    const rareChance = def.boss ? 1 : Math.min(0.5, (def.level || 1) / 1200 + 0.01 + (npc.champion ? 0.25 : 0));
    // Bosses always hit the rare table, twice.
    for (let rr = 0; rr < (def.boss ? 2 : 1); rr++) if (Math.random() < rareChance) {
      const pick = weightedPick(RARE_DROP_TABLE);
      const q = pick.min ? randInt(pick.min, pick.max) : 1;
      loot.push([pick.id, q, dropRarity(pick.id, 'rare')]);
      const nm = getItem(pick.id).name;
      this.msg(`A rare drop! ${q > 1 ? q + ' x ' : ''}${nm}.`, 'level');
      if (getItem(pick.id).value >= 5000) this.banner(`<span class="big">Rare drop!</span>${nm}`);
    }
    // Treasure trails: a rare clue scroll, if you aren't already carrying one.
    if (!this.clue && !this._holdsClue()) {
      const clueChance = Math.min(0.05, (def.level || 1) / 3000 + (def.boss ? 0.04 : 0.006));
      if (Math.random() < clueChance) {
        const tier = clueTierForLevel(def.level || 1);
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
      }
    }
    this._autoLoot(loot, npc.x, npc.y);
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
  /** Bury bones from a stack: 100 at a time by default, or `count` (Infinity = the whole stack). */
  buryBones(index, count = BURY_BATCH) {
    const s = this.inventory.slotAt(index);
    if (!s || s.id !== 'bones') { this.msg('You can only bury bones.'); return; }
    const n = Math.min(s.qty, count);
    this.inventory.removeAt(index, n);
    this.skills.addXp('prayer', 4.5 * n);
    this.addGood(Math.min(n, 10)); // honouring the dead is a small good
    this.spawnSparkle(this.player, '#ffe89a', Math.min(24, 6 + n));
    this.msg(n > 1 ? `You bury ${n} bones.` : 'You bury the bones.', 'system');
  }

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
    this.skills.addXp('agility', d.xp || 18);
    this.runEnergy = Math.min(100, this.runEnergy + 8);
    this.bus.emit('run');
    this.spawnPoof(obj.x * TILE + TILE / 2, obj.y * TILE + TILE / 2 - 6, '#8fd6ff');

    // Course lap tracking: touching every distinct obstacle once = a lap.
    if (d.markChance !== undefined) {
      this._agilityLap.add(obj.uid);
      let mark = Math.random() < d.markChance;
      if (d.finish && this._agilityLap.size >= 3) {
        // Completing the loop at the finish line: lap bonus + a guaranteed mark.
        this.skills.addXp('agility', Math.round((d.xp || 30) * 0.6));
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

  // Spend a Mark of grace to catch your breath (restore run energy).
  useMarkOfGrace(index) {
    const s = this.inventory.slotAt(index);
    if (!s || s.id !== 'mark_of_grace') return;
    this.inventory.removeAt(index, 1);
    this.runEnergy = Math.min(100, this.runEnergy + 30);
    this.bus.emit('run');
    this.spawnSparkle(this.player, '#5fd0a0', 8);
    this.msg('You use a Mark of grace and feel re-energised.', 'system');
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
        npc.hp = Math.min(npc.maxHp, npc.hp + Math.round(npc.maxHp * 0.1)); npc.combatLatch = 12;
        this.spawnSparkle(npc, '#5fe08a', 12);
        this.msg(`${npc.name} channels power and heals!`, 'combat');
        break;
      }
      case 'summon': {
        const adds = this.npcs.filter((n) => n.temporary && n.alive).length;
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
            if (fx.steal && dmg > 0) { npc.hp = Math.min(npc.maxHp, npc.hp + Math.round(dmg * fx.steal)); this.spawnSparkle(npc, '#5fe08a', 6); }
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
        case 'heal': npc.hp = Math.min(npc.maxHp, npc.hp + Math.round(npc.maxHp * fx.frac)); this.spawnSparkle(npc, '#5fe08a', 10); break;
        case 'shield': npc.shieldTicks = Math.max(npc.shieldTicks || 0, fx.ticks); this._buffedBosses.add(npc); break;
        case 'reflect': npc.reflectTicks = Math.max(npc.reflectTicks || 0, fx.ticks); npc.reflectFrac = fx.frac; this._buffedBosses.add(npc); break;
        case 'summon': {
          const adds = this.npcs.filter((n) => n.temporary && n.alive).length;
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
    const noAmmo = mode === 'ranged' ? !this.inventory.slots.some((sl) => sl && getItem(sl.id).tags?.includes('ammo'))
      : mode === 'magic' ? !this.bestSpell() : false;
    if (noAmmo) {
      this.msg(mode === 'ranged' ? 'Auto battle stopped: you have no arrows left.' : 'Auto battle stopped: you are out of runes for your spell.', 'system');
      this.toggleAutoBattle(false);
      return;
    }
    // 0b. Step out of a boss's red ground marker, then go back to the fight.
    const at = this.playerTile();
    if (this.hazardAt(at.x, at.y)) {
      const safe = this._safeTileNear(at);
      if (safe) {
        const fighting = p.action?.type === 'attack' && p.action.npc?.alive;
        if (fighting && this.attackRange() > 1) {
          // Archers and casters sidestep without lowering their weapon: keep the
          // attack and keep firing on the move.
          const path = findPath(this.pathCfg(), at, safe, {});
          if (path.length) { p.setPath(path, this.canRun()); this._dodging = true; }
        } else {
          if (fighting) this._autoResume = p.action.npc;
          this.walkTo(safe);
        }
      }
      return;
    }
    if (this._dodging && !p.isMoving) this._dodging = false;
    // Mid-dodge: hold still until the attack lands, rather than chasing something back into it.
    if (this.hazards.some((h) => chebyshev(at.x, at.y, h.cx, h.cy) <= h.r + 4)) return;
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
      // 2. Brace against a heavy blow being wound up next to you.
      if (this.npcs.some((n) => n.alive && n.target === p && n.windup > 0)) this._autoAbility((ab) => ab.kind === 'guard');
      // Casters always throw the strongest spell they can afford.
      if (this.combatMode() === 'magic') { const best = this.bestSpell(); if (best && best.id !== p.spell) { p.spell = best.id; this.bus.emit('spell'); } }
      // 3. Spend adrenaline: the biggest attack skill you can afford.
      if (!this.armedAbility && this.autoCfg.abilities) this._autoAbility((ab) => ab.kind === 'attack', true);
      return;
    }
    // 4. Find the next fight.
    const target = this._autoPickTarget();
    if (target) { this._autoLast = target; this._autoIdleSaid = false; this.attackNpc(target); }
    else if (!this._autoIdleSaid) {
      this._autoIdleSaid = true;
      this.msg('Auto battle: nothing to fight nearby. Walk somewhere wilder and it will pick up again.', 'system');
    }
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

  _autoAbility(filter, biggestFirst = false) {
    const ready = this.currentAbilities().filter((ab) => filter(ab) && this.abilityUnlocked(ab)
      && (this.abilityCd[ab.id] || 0) <= 0 && this.adrenaline >= ab.cost);
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
    const cl = this.skills.combatLevel();
    const wildZone = (x, y) => !!this.world.zoneAt(x, y)?.wilderness;
    const inWild = wildZone(p.x, p.y);
    let best = null, bestScore = Infinity;
    const cands = [];
    // Bosses and champions somewhat above your level are still fair game.
    const canTake = (lvl) => lvl <= Math.max(cl + 15, Math.round(cl * 1.2));
    for (const n of this.npcs) {
      if (!n.alive || !n.attackable) continue;
      const d = chebyshev(p.x, p.y, n.x, n.y);
      if (d > 25) continue;
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
        if (!canTake(n.def.level || 1) || (!inWild && wildZone(n.x, n.y))) continue;
        { const tier = this.autoCfg.priority !== false ? -2000 : -150 - (shootable(n, d) ? 1000 : 0); cands.push({ n, score: d + tier, tier }); }
        continue;
      }
      const lvl = n.def.level || 1;
      // Close by: leave only far-stronger monsters alone. Further out: only
      // seek monsters around your level, so a hunt is worth the walk.
      if (d <= 10 ? lvl > cl * 1.5 + 5 : lvl > cl + 8) continue;
      if (!inWild && wildZone(n.x, n.y)) continue;
      // Anything within 8 tiles first, then the rest.
      const tier = (d > 8 ? 50 : 0) - (shootable(n, d) ? 1000 : 0);
      cands.push({ n, score: d + tier, tier });
    }
    // Nearest first by straight-line distance, then confirm a walkable route
    // (and use its real length) so it never heads for something across water.
    cands.sort((a, b) => a.score - b.score);
    for (const { n, score, tier } of cands.slice(0, 10)) {
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
    const start = this.playerTile();
    if (start.x === tile.x && start.y === tile.y) { this.player.clearAction(); return; }
    let path = findPath(this.pathCfg(), start, tile, {});
    if (!path.length) path = findPath(this.pathCfg(), start, tile, { reachAdjacent: true });
    if (path.length) { this.player.setPath(path, this.canRun()); this.player.clearAction(); }
  }

  /** Long-range walk used by the world map; snaps to the nearest walkable tile. */
  walkToFar(tile) {
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
    // A dagger goes in the off-hand when asked, or by default when you already
    // hold a dagger and your off-hand isn't one yet.
    const main = this.equipment.get('weapon');
    const offhand = canDualWield(s.id) && canDualWield(main)
      && (opts.offhand ?? !canDualWield(this.equipment.get('shield')));
    if (opts.offhand && !offhand) { this.msg('Only a dagger can go in your off-hand, alongside another dagger.'); return; }
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
    if (slot === 'weapon' && !canDualWield(s.id) && canDualWield(this.equipment.get('shield'))) {
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
  upgradeItem(id) {
    if (!getItem(id).equip) return false;
    const lv = this.equipment.upgradeLevel(id);
    if (lv >= MAX_UPGRADE) { this.msg(`${upgradedName(id, lv)} is already fully upgraded.`); return false; }
    const next = lv + 1;
    const cost = upgradeCost(id, next);
    if (this.inventory.count('coins') < cost.coins) { this.msg(`You need ${cost.coins} coins to upgrade to +${next}.`); return false; }
    if (cost.bar && this.inventory.count(cost.bar.id) < cost.bar.qty) {
      this.msg(`You need ${cost.bar.qty} x ${getItem(cost.bar.id).name} to upgrade to +${next}.`); return false;
    }
    this.inventory.remove('coins', cost.coins);
    if (cost.bar) this.inventory.remove(cost.bar.id, cost.bar.qty);
    if (Math.random() < upgradeChance(next)) {
      this.equipment.upgrades[id] = next;
      this.equipment._changed();
      this.spawnSparkle(this.player, '#F5B82E', 14);
      this.bus.emit('sfx', 'level');
      this.msg(`Success! Your ${upgradedName(id, next)} is stronger.`, 'level');
      if (next === MAX_UPGRADE) this.banner(`<span class="big">+${MAX_UPGRADE}!</span>${getItem(id).name} is fully upgraded`);
      return true;
    }
    this.bus.emit('sfx', 'hurt');
    this.msg(`The upgrade failed. Your ${upgradedName(id, lv)} is unharmed, but the materials are used up.`, 'system');
    return false;
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
      case 'bone_collector': return inv('bones') >= 10 ? npc('guide', 'Hand in to') : { kind: 'hunt', text: `Collect bones: ${inv('bones')}/10 (any monster drops them)` };
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
        if (n) ok = this.defaultNpcAction(n) !== false;   // talk, or open the shop
      } else if (g.kind === 'obj') {
        const o = nearest(this.world.objects.filter((x) => x.objId === g.objId && !x.depleted));
        if (o) { this.defaultObjectAction(o); ok = !!p.action || p.isMoving; }
      } else if (g.kind === 'light') {
        const idx = this.inventory.slots.findIndex((sl) => sl && getItem(sl.id).tags?.includes('log'));
        if (idx !== -1) { this.lightLogs(idx); ok = true; }
      } else if (g.kind === 'hunt' || g.kind === 'boss') {
        const cl = this.skills.combatLevel();
        const fits = g.kind === 'boss'
          ? (n) => n.def.boss && !n.def.fixed && (n.def.level || 1) <= Math.max(cl + 15, Math.round(cl * 1.2))
          : g.target ? (n) => n.npcId === g.target : (n) => !n.def.boss && (n.def.level || 1) <= cl + 5;
        const mob = nearest(this.npcs.filter((n) => n.alive && n.attackable && !n.temporary && fits(n)
          && (!this.world.zoneAt(n.x, n.y)?.wilderness || this.world.zoneAt(here.x, here.y)?.wilderness)));
        if (mob) {
          this._questTarget = g.target || null;
          if (g.kind === 'boss') this.autoCfg.bosses = true;
          if (chebyshev(here.x, here.y, mob.x, mob.y) > 12) this.walkToFar({ x: mob.x, y: mob.y });
          else this.attackNpc(mob);
          if (!this.autoBattle) this.toggleAutoBattle(true);
          ok = true;
        }
      }
    } finally { this._pathBudget = 0; }
    this.msg(ok ? `Quest: ${g.text}.` : `Quest: ${g.text}, but I can't find the way there.`, 'system');
    return ok;
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
    this.inventory.add('ancient_staff', 1);
    this.skills.addXp('magic', 4000);
    q.state = 'done';
    this.msg('Quest complete — The Mystic\'s Trial! You receive the ancient staff.', 'level');
    this.banner('<span class="big">Quest complete!</span>The Mystic\'s Trial');
  }

  turnInBigGame() {
    const q = this.quests.big_game_hunter;
    if (q.state === 'done') { this.msg('A fine hunter you are!', 'system'); return; }
    if (q.state !== 'active') { this.msg('Ask me about the hunt first.', 'system'); return; }
    if (this.totalKills - (q.startKills || 0) < 50) { this.msg(`Slay ${50 - (this.totalKills - (q.startKills || 0))} more creatures first.`, 'system'); return; }
    this.inventory.add('magic_shortbow', 1);
    this.inventory.add('rune_arrow', 100);
    this.skills.addXp('ranged', 5000);
    q.state = 'done';
    this.msg('Quest complete — Big Game Hunter! You receive a magic shortbow and 100 rune arrows.', 'level');
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
    this.inventory.add('champions_helm', 1);
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
    if (this.inventory.count('bones') < 10) { this.msg('Come back when you have 10 bones.', 'system'); return; }
    this.inventory.remove('bones', 10);
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
    if (!st) return;
    if (this.inventory.count('coins') < MRT_FARE) { this.msg(`You need ${MRT_FARE} coins for the MRT fare.`); return; }
    const tile = this._nearestFree(st.x, st.y);
    if (!tile) { this.msg('That station is unreachable.'); return; }
    this.inventory.remove('coins', MRT_FARE);
    const p = this.player;
    p.stopNow(); p.clearAction();
    p.x = p.tx = tile.x; p.y = p.ty = tile.y; p.progress = 0; p.moving = false; p.path = [];
    this.spawnSparkle(this.player, '#8fd6ff', 14);
    this.msg(`You take the MRT to ${st.name}.`, 'system');
    this.bus.emit('sfx', 'travel');
    this.updateRegion();
    this.ui?.closeModal();
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
      if (!n.alive) continue;
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
    for (const n of this.npcs) {
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
