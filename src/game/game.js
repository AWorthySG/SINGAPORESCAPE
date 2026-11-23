import { getObject } from '../data/objects.js';   // quest guides read node levels
import { EventBus } from '../core/events.js';
import { goldenMult, goldenSkills, GOLDEN_HOUR_XP, SKILL_HOURS } from '../data/skillhours.js';
import { buildWorld, TERRAIN, zoneLevel } from '../data/world.js';
import { compareGear, deltaText, gearRating, effectiveRating, offenceFirstScore, weaponStyle, reqLevel } from './gear.js';
import { planCarry, applyCarry, carryMessages, scoreAfterCarry } from './carry.js';
import { RARITY, dropRarity, lootDelay, rollQuality, QUALITY, NORMAL_GEAR_SKIP, qualityName } from './loot.js';
import { dayKey, prevDayKey, makeBounties, streakMult } from './bounty.js';
import { ATTRS, ATTR_NAMES, statPointsAt, attrForMode, DMG_PER_POINT, LIFE_PER_STR, CRIT_PER_INT, SPEED_PER_DEX, RESET_COST_PER_POINT } from './attributes.js';
import { MASTERY_RANKS, BANNER_RANK, BATTLE_CAP, TOP_XP, MAX_ENCHANTS, killMastery, isWorldBoss, masteryType, masteryTypeName, enchantCost, rollEnchantOffers, enchantLabel, STONE as UP_STONE, WARD as UP_WARD } from './mastery.js';
import { MAX_REFINE, SCROLL as REFINE_SCROLL, refineCost, rollRefine, refineTag, refineScrollDrop } from './refine.js';
import { materialKind, materialPoints, feedKind, feedXp, FEED_CAP, FEED_CAP_RANK } from './materials.js';
import { Shrine, SHRINE_TRACKS, trackText, maxAffordable } from './shrine.js';
import { getItem, ITEMS, MELEE_REACH, accessoriesFor } from '../data/items.js';
import { chebyshev, randInt, weightedPick, capitalize, damageNumber, aOrAn, AOrAn } from '../core/utils.js';
import {
  TILE, TICK_MS, COMBAT_BEAT_MS, RESPAWN_TICKS, AUTOSAVE_TICKS, DAY_CYCLE_MS,
  XP_RATE, COMBAT_XP_RATE, LEARNING_ENABLED, AGGRO_FORGET_TILES,
} from '../config.js';

import { World } from './world.js';
import { Skills, xpText } from './skillset.js';
import { Inventory } from './inventory.js';
import { Equipment, canDualWield, canDualPair, EQUIP_SLOTS, isTwoHanded, offhandBlocked, takesQuiver } from './equipment.js';
import { Bank } from './bank.js';
import { Player, STICK_DEAD } from './player.js';
import { NPC } from './npc.js';
import { Camera } from '../engine/camera.js';
import { Cinematics } from './cinematics.js';
import { leafArt } from '../render/fxart.js';
import { footFx } from './footfx.js';
import { CombatFx, MAX_EFFECTS, keepLive, hitImpact, hitsplatFx, deathFx, isMilestoneLevel } from '../render/combatfx.js';
import { juiceHit, juiceKill, juiceLevel, noteAbility, shakeAllowed, spriteDt } from '../render/juice.js';
import { findPath } from '../engine/pathfinding.js';
import {
  playerAttackVsNpc, npcAttackVsPlayer, OFFHAND_SHARE, rollAttack, rollGuaranteed, rollHit, combatXp, magicXp, killXp, DAMAGE_XP_SHARE, KILL_XP_SHARE,
  playerRangedVsNpc, combatXpRanged, playerMagicVsNpc, RANGED_STYLES,
  weaknessOf, WEAKNESS_BONUS, armourOf, armourMult, critChance, hitChance, CRIT_MULT, MEGA_CRIT_MULT, MEGA_CRIT_CHANCE,
  playerDanceVsNpc, combatXpDance, danceEvade, RHYTHM_MAX, RANGED_TYPE_DMG, combatLevelXpMult, CLASS_POWER, OPEN_WOUNDS, openWoundStacks, shatterPierce, hexStacks,
  bossTypeDmgMult, bossGrazeMult, bossBreakMult } from './combat.js';
import { ABILITY_BY_ID, abilitiesFor, ADREN_PER_HIT, ADREN_PER_HURT, CLASS_ADRENALINE, EXECUTE_BELOW, SUNDER_TICKS } from '../data/abilities.js';
import { classPassiveMods, CLASS_SKILL } from '../data/classPassives.js';
import { RACES, raceOf, matchup, RACE_BONUS, RACE_PENALTY } from '../data/races.js';
import { DOT_KINDS } from '../data/bossAbilities.js';
import { CLASS_BY_ID, WEAPON_TYPE_NAMES, starterWeapon, equivalentWeapon, CLEAVE_SHARE, ARMOUR_FAMILY, ARMOUR_FAMILIES, canWear, equivalentArmour, classGearFor, canWield, classesForType, SECONDARY_WEAPON, shieldBarred, NO_SHIELD_MSG } from '../data/classes.js';
import { STYLE_TRACKS, sumPerks, perkAtLevel, rankName, PERK_SKILLS, PERK_CAPS } from '../data/perks.js';
import { getSpell, SPELLS, ELEMENTS, AOE_RADIUS, elementMatchup, elementMult } from '../data/magic.js';
import { xpForLevel, pastCapXpMult } from '../data/xp.js';
import { PRAYER_BY_ID, FAITH_BASE } from '../data/prayers.js';
import * as Bless from './blessings.js';
import { isBone, boneXp, BONE_IDS, countBones, championBoneQty, RARE_BOSS_BONES, RARE_BONE_CHANCE, RARE_BONE_QTY, ALTAR_XP_MULT, ALTAR_RANGE } from '../data/bones.js';
import {
  resolveWoodcut, resolveMine, resolveFish, resolveCook,
  resolveSmelt, smeltBatch, resolveSmith, resolveFiremake, resolveCraft, resolveDish,
  resolveHunt, resolveRecipe,
} from './skilling.js';
import { installSkillUnlocks, runSkillAction, extraCrop, growTicks } from './skillunlocks.js';
import { Home } from './home.js';
import { CROP_BY_SEED, cropFor, POTIONS, greenFingersChance } from '../data/trades.js';
import { saveGame, loadGame, hasSave } from './save.js';
import * as Play from './playbalance.js';
import { getShop } from '../data/shops.js';
import { RARE_DROP_TABLE, getNpc, ALL_BOSS_IDS, ALL_MONSTER_IDS } from '../data/npcs.js';
import { MORAL_EVENTS, MORAL_BY_ID, moralCoins, BLESS_MS, BLESS_XP } from '../data/moralEvents.js';
import { alignmentTier, alignmentStyle, greetingFor } from '../data/alignment.js';
import { tickBossMechanics, mechAbilityUsed, mechAutoFight, inHazard } from './bossmech.js';
import { SIGNATURE_DROP_CHANCE, sigDropsFor } from '../data/bossWeapons.js';
import { nextJob, jobKey, makeBatch, batched } from './autoprocess.js';
import { ACHIEVEMENTS, rewardFor } from '../data/achievements.js';
import { eligibleTasks, SLAYER_REWARDS, SLAYER_TASKS, SLAYER_HELM_DMG, slayerBuffs, slayerBuffText } from '../data/slayer.js';
import { STATIONS, STATION_BY_ID, MRT_FARE } from '../data/transport.js';
import { SKILLS, SKILL_BY_ID } from '../data/skills.js';
import { Learning } from './learning.js';
import { Waves, addArena } from './waves.js';
import { Collection } from './collection.js';
import { Pets } from './pets.js';
import { WorldEvents } from './worldevents.js';
import * as Mercs from './mercenary.js';
import * as Culling from './culling.js';
import { classPerks } from './classperks.js';
import { LIFE_PERKS, LIFE_PERK_SKILLS, LIFE_PERK_TOP_LEVEL, lifePerkNoteAt, lifePerkTotals, lifePerkText } from './lifeperks.js';
import { TOPIC_BY_ID } from '../data/questions.js';
import { LIFE_STAGES, LIFE_GRAD, LIFE_STAGES_ADV, LIFE_GRAD_ADV, LIFE_STAGES_WILD, LIFE_GRAD_WILD } from '../data/lifeskills.js';
import { QUESTS, CHAMPION_QP, REDEMPTION_GOAL, CORRUPTION_GOAL } from '../data/quests.js';
import { CLUE_TIERS, CLUE_SPOTS, clueTierForLevel } from '../data/clues.js';
import * as RQ from './regionquests.js';   // region story quests
import { Story } from './story.js';   // the main story, lore pages, story events and scenes
import * as Life from './npclife.js';   // living NPCs, region reputation, consequences (npclife.js)
import { repPriceMult, repTitleText } from './reputation.js';
import { consequencePriceMult } from './consequences.js';
import { Gathering } from './gathering.js';   // gathering streaks, lucky finds, skilling contracts
import { FishSchools } from './fishschool.js';   // schools of fish visiting the spots
import { bossToolDrop } from './bosstools.js';   // world bosses drop gathering tools of their level
import { levelHaul } from './levelhaul.js';   // a bigger haul as your gathering level rises
import { tickWarmth, warmthBonus } from './bonfire.js';   // bonfires and their warmth
import { Teleports } from './teleports.js';   // the Town and Grave teleports
import { Discovery } from './discovery.js';   // encyclopedia discoveries and their rewards
import * as Rounds from './rounds.js';   // gun rounds and the ammo slot
import { bestTool, toolSpeed } from './tools.js';   // tiered gathering tools

const GOLDEN_BANNER_GAP = 50;   // ticks (30s): golden hours opening within this share one banner
const SAVE_SOON_GAP = 5;        // ticks (3s): the least time between two key-moment saves (see doTick)

// Auto quest: the dialogue actions that start and hand in each quest it can
// do ([start, hand-in]; Pest Control completes itself on the last rat). The
// karma quests are missing on purpose: that choice is the player's.
const AUTO_QUEST_ACTIONS = {
  life_skills: ['lifeStart', 'lifeTurnIn'], life_skills_adv: ['lifeAdvStart', 'lifeAdvTurnIn'], life_skills_wild: ['lifeWildStart', 'lifeWildTurnIn'],
  bone_collector: ['questStart', 'questTurnIn'], pest_control: ['pestStart', null], pillars: ['pillarsStart', 'pillarsTurnIn'],
  smith_apprentice: ['smithStart', 'smithTurnIn'], island_defender: ['defenderStart', 'defenderTurnIn'], big_game_hunter: ['bigGameStart', 'bigGameTurnIn'],
  mystic_trial: ['mysticStart', 'mysticTurnIn'], island_provisions: ['provisionsStart', 'provisionsTurnIn'], champion: ['championStart', 'championTurnIn'],
  ...RQ.REGION_AUTO_ACTIONS,
};
// Stations whose menu auto quest runs with "make everything" (autoprocess.js kinds).
const AUTO_QUEST_STATION = { furnace: 'smelt', range: 'cook', fire: 'cook', anvil: 'smith', craft: 'craft', fletch: 'fletching', herblore: 'herblore' };

// The hunting snare joined the kit late: traps did nothing without one, and new
// players took the trap for broken. (Anyone without one gets it from the Kampong Guide.)
const STARTER_TOOLS = ['bronze_axe', 'bronze_pickaxe', 'small_net', 'fishing_rod', 'tinderbox', 'hammer', 'chisel', 'hunting_snare', 'bronze_dagger'];
const COMBAT_SKILLS = new Set(['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic']);

// Where the in-game day/night clock starts: the equivalent point in
// DAY_CYCLE_MS for the player's real local time of day, so a fresh session
// opens at a sensible hour (bright at your midday, dark at your midnight)
// instead of always at midnight.
// Every session starts on a bright morning (~7am), then runs the normal
// day/night cycle from there.
const MORNING_PHASE = 0.3;

// Combat XP: +50% per Wilderness level (1-10, deeper = higher), and a kill
// streak bonus of +10% per chained kill (up to +50%, kills within ~30s; it was
// up to +200%, which tripled the XP of any steady auto battle).
const WILD_EDGE_X = 95;
const WILD_XP_PER_LEVEL = 0.5;
const STREAK_XP_PER_KILL = 0.1;
export const STREAK_MAX_BONUS = 0.5;
const STREAK_WINDOW_TICKS = 50;
// Bonus XP per boss level on a boss kill.
// Bosses are 100x tankier (BOSS_TOUGHNESS), so their rewards scale with them:
// the kill bonus is 100x, stackable loot (coins, runes, arrows...) comes in 100x
// the amount, and the gear, rare-table and upgrade-material rolls are richer.
const BOSS_XP_PER_LEVEL = 4000;
const BOSS_STACK_MULT = 100;
// Every coin drop, from any monster, boss or champion (and the rare table), is
// this many times what its drop table says.
export const COIN_LOOT_MULT = 4;
// Whip ricochet: bounces after each landed lash (one more at full Rhythm), and their share of the hit.
// World boss: every 2 minutes (if none is about) a random boss rises near you,
// far tougher than usual, and hunts you down. It leaves after 5 minutes unfought.
const WORLD_BOSS_EVERY = 200;      // ticks (0.6s each): 2 minutes
const WORLD_BOSS_STAY = 500;       // ticks it lingers without a fight: 5 minutes
const WORLD_BOSS_MULT = { hp: 5, hit: 2, stats: 1.5 };
const WORLD_BOSS_LOOT_ROLLS = 3;   // its loot, three times over
// New players are left alone: none rise until you've finished a couple of
// quests and reached this fight level, never in the first island's towns, and
// never within this many tiles of a bank (every town has one).
const WORLD_BOSS_MIN_QUESTS = 2, WORLD_BOSS_MIN_LEVEL = 40, WORLD_BOSS_TOWN_GAP = 20;
const WORLD_BOSS_SAFE_ZONES = ['Kampong Glam', 'Chinatown'];
// Alignment out in the world (see moralEvents.js and alignment.js).
// Killing aggressive monsters is only a little heroic now: +1 good karma for
// every HERO_KILLS_PER_GOOD of them. It used to be every kill, which made
// grinding the main way to turn good and drowned out the moral choices.
// Bosses stay +5 good each. Harmless creatures are neutral now (they were +1
// evil each, which turned every auto-battler Villain within minutes).
const HERO_KILLS_PER_GOOD = 10;
// Town guards challenge a Villain who walks into a town: one guard (two once
// you are a byword for evil, GUARD_PAIR_AT), with an ordinary monster's stats
// at your fight level but GUARD_HP_MULT of its life and GUARD_HIT_MULT of its
// hits, at most once every GUARD_COOLDOWN ticks. Never below GUARD_MIN_LEVEL,
// nor in Kampong Glam (the starter town) below GUARD_STARTER_LEVEL. Each guard
// slain pays coins and GUARD_EVIL more evil karma.
const GUARD_COOLDOWN = 300;   // ticks: 3 minutes
const GUARD_MIN_LEVEL = 20, GUARD_STARTER_LEVEL = 40;
const GUARD_PAIR_AT = -100;
const GUARD_HP_MULT = 0.8, GUARD_HIT_MULT = 0.8;
const GUARD_EVIL = 3;
const GUARD_STAY = 150;       // ticks a guard waits about without a fight before leaving
// Townsfolk call out as you pass (one within GREET_RANGE tiles every
// GREET_EVERY ticks), warmly or nervously by your alignment. A Paragon also
// gets one small gift a day from a grateful local.
const GREET_EVERY = 8, GREET_RANGE = 6;
// Agility quickens every class's movement and attacks. Both bonuses taper
// towards a cap (half of it at the _HALF level), in line with the life-skill
// perks: movement used to grow without limit (+1000% at 9999, crossing the map
// in seconds) and attack speed tapered to +100%, ten times Fletching's full perk.
// Movement: about +12% at 99, +38% at 1000, +49% at 9999.
// Attacks:  about +7% at 99, +38% at 1000, +68% at 9999 (the owner raised the
// cap from 30% to 75%).
export const AGILITY_MOVE_MAX = 50, AGILITY_MOVE_HALF = 300;
export const AGILITY_ATK_MAX = 75, AGILITY_ATK_HALF = 1000;
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
const LONGBOW_DMG = RANGED_TYPE_DMG.longbow;
// Thrown weapons that bounce on: extra foes and the share of the hit each takes.
const RICOCHET = { shuriken: { hits: 1, share: 0.6 }, chakram: { hits: 2, share: 0.45 } };
// Sniper rifles fire only every 1.5s, but each round hits this many times as hard.
const RIFLE_DMG = RANGED_TYPE_DMG.rifle;
// A sniper round carries on in a straight line through every
// monster up to this many tiles past the target (each takes the full hit).
// Bosses scale up to the player's combat level (see _scaleBoss), up to this
// many times their own level.
const BOSS_SCALE_MAX = 100;
// Actions that are a life skill at work: being attacked doesn't pull you off them.
const LIFE_SKILL_ACTIONS = new Set(['woodcut', 'mine', 'fish', 'hunt', 'farm', 'cook', 'cookdish', 'craft', 'smelt', 'smith', 'agility', 'thieve', 'stall']);
// Agility XP for slipping a monster's blow: this many times its max hit (about
// what landing an average hit of that size would give a fighting skill).
export const DODGE_AGILITY_XP = 2;
// Shortbows fire this many arrows a shot, each at this share of a full arrow's
// damage: about half as much again as one arrow, for half the old reach.
export const SHORTBOW_ARROWS = 3;
// Wounds from blades: daggers poison, claws open bleeding wounds. On a blow,
// `chance` to add a stack dealing `share` of that hit every second for `secs`
// seconds, up to `stacks` at once.
export const WOUNDS = {
  poison: { chance: 0.35, share: 0.06, secs: 8, stacks: 5, color: '#6cc24a', label: 'Poisoned' },
  bleed: { chance: 0.4, share: 0.1, secs: 4, stacks: 3, color: '#d23a3a', label: 'Bleeding' },
};
export const WOUND_BY_WEAPON = { dagger: 'poison', claws: 'bleed' };
export const SHORTBOW_ARROW_DMG = 0.5;
// Each spread also flings an extra arrow into up to SHORTBOW_FAN_FOES other foes
// within SHORTBOW_FAN_TILES of the target, each at SHORTBOW_FAN_SHARE of a full
// arrow; the target still takes the whole spread.
export const SHORTBOW_FAN_TILES = 2;
export const SHORTBOW_FAN_FOES = 2;
export const SHORTBOW_FAN_SHARE = 0.3;
// ...or this share of what killing the monster pays (3 XP per point of its
// life), whichever is more, so dodging keeps pace with kill XP as you climb.
export const DODGE_KILL_SHARE = 0.04;
// Bosses have huge life pools and long fights full of dodges, so each dodge is
// a much smaller share of the kill (a whole fight's dodges add up to about one kill).
export const DODGE_BOSS_SHARE = 0.001;
// Stepping out of a boss's red ground marker pays this many ordinary dodges.
export const HAZARD_DODGE_MULT = 3;
// Every area attack, splash, ricochet and target search looks only at the
// NPCs within this many tiles of the player (see nearbyNpcs): the world holds
// thousands, and scanning them all on every hit was the main cause of lag.
const NEAR_RADIUS = 60;
// NPCs further than this from the player are frozen (no animation, no AI), so
// a list of everyone within NEAR_RADIUS + NEAR_SLACK of where it was made, plus
// the allies, holds everyone the frame or the tick can touch until the player
// strays NEAR_SLACK / 2 tiles from there (see _npcsAround).
const UPDATE_RADIUS = 48;
const NEAR_SLACK = 8;
// ...and that list is made afresh at least this often (ticks), whatever happens.
const AROUND_REFRESH_TICKS = 10;
const SPLAT_MERGE_MS = 200;   // hits on one foe this close together share one damage number (crits merge with crits)
const SPLAT_MAX_PER = 5;      // damage numbers shown at once over one foe
// Tiny hits (a sliver of the target's life, like poison and burn ticks or a
// flurry of chip damage) from the same source fold together over a longer
// window, so a stream of 1s and 2s reads as one growing number.
const SPLAT_TINY_MERGE_MS = 550;
const SPLAT_TINY_SHARE = 0.03;
const RIFLE_PIERCE_TILES = 10;
// ...and the round's wake also catches anything within 1 tile to either side of
// its path (and beside the target), not just monsters squarely on the line.
const RIFLE_PIERCE_WIDTH = 1;
// Longbow arrows pierce too (the owner: "give longbows some form of AoE in the
// early game"): each shot carries on through its target into the monsters
// lined up behind it (within LONGBOW_PIERCE_WIDTH tiles of the line, up to
// LONGBOW_PIERCE_TILES past the target), each taking LONGBOW_PIERCE_SHARE of
// the shot. 1 extra foe from the start, 2 from Ranged 40, 3 from Ranged 70.
// Only other monsters are hit, so single-target and boss damage is unchanged.
// Sized so a Ranger clears a pack noticeably quicker than it did, but no
// quicker than a shortbow Archer (a half share made it the faster of the two).
export const LONGBOW_PIERCE_SHARE = 0.3;
export const LONGBOW_PIERCE_TILES = 3, LONGBOW_PIERCE_WIDTH = 1;
export const LONGBOW_PIERCE_LEVELS = [1, 40, 70];
export const longbowPierceFoes = (ranged) => LONGBOW_PIERCE_LEVELS.filter((l) => ranged >= l).length;
const CHAMPION_STACK_MULT = 1;
// Good and evil in combat (see karmaCombat). The bonus grows through the three
// alignment tiers (Kind-hearted / Virtuous / Paragon, Mischievous / Wicked / Villain).
const KARMA_TIERS = [8, 25, 60];
// Holy (good): more damage against the unholy, and each kill heals a share of your life.
const HOLY_DMG = [0.12, 0.22, 0.35], HOLY_HEAL = [0.03, 0.06, 0.1];
const UNHOLY_RACES = new Set(['undead', 'spirit', 'demon']);
// Dark (evil): extra crit damage and lifesteal against everything (in %).
const DARK_CRITDMG = [15, 30, 50], DARK_LIFESTEAL = [2, 4, 7];
// Auto battle: after a boss kills you, it is skipped until you are this many fight levels stronger.
const BOSS_RETRY_LEVELS = 10;
// Auto battle travels to bosses up to this far away (in tiles), using the MRT when it helps.
const BOSS_SEEK_TILES = 220;
// Auto battle only goes looking for a champion (30x life) it could kill in
// about this many seconds, and that couldn't kill you in under CHAMPION_SAFE_SECS.
// (The estimate is rough and hopeful: it counts any buff running, and a real
// fight took about twice as long.)
// Without this a fresh character walked straight to the nearest champion and
// spent minutes on it (a fresh Archer burned all 999 arrows on one, a fresh
// Wizard sat on an 80,000-life one for six minutes) while its pack mauled them.
const CHAMPION_HUNT_SECS = 15, CHAMPION_SAFE_SECS = 40;
// ...and only with this many times the estimated runes or arrows for it.
const CHAMPION_AMMO_SPARE = 3;
// "Far above you": more than this many levels (or a quarter of your fight level,
// whichever is more) over your fight level; below fight level 40, more than
// half your level over it (a fresh character, fight level 19 with 25 life, was
// being worn down by the heavy blows of level 33-40 packmates). Auto battle
// never picks such a monster unless it is fighting you, and area hits leave it alone.
const FAR_ABOVE_LEVELS = 20;
// Area hits stop waking idle monsters once this many (plus one per
// CROWD_PER_LIFE Hitpoints levels) are already fighting you, and wake none
// while you're below CROWD_HURT of your life. Scaled by Hitpoints, not fight
// level: a melee character's Attack runs well ahead of its life (a level 45
// Lancer had 37 life), and 3 + 1 per 5 fight levels buried it under a dozen
// monsters once the Dark path's lifesteal no longer came free with every kill.
const CROWD_BASE = 1, CROWD_PER_LIFE = 8, CROWD_HURT = 0.7;
// Auto battle eats early enough to outlast the crowd's blows together, but never
// above this share of your life (see _autoBattleTick).
const EAT_CROWD_CAP = 0.75;
// Auto battle runs from a monster far above you when its rough time to empty
// your life is under this many times yours to empty its (the estimate of your
// side is hopeful, see _autoFightTimes).
const FLEE_MARGIN = 2, FLEE_HURT = 0.5;
// Auto battle tops up to this share of your life between fights.
const REST_AT = 0.5;
// Auto gather can take turns between up to this many kinds of node.
const AUTO_GATHER_KINDS = 6;
// How each melee weapon's cleave moves (and looks): spears pierce in a line
// through the target, heavy blades sweep a wide arc, blunt weapons slam a
// shockwave, quick blades flurry, and swords slash a crescent.
export const CLEAVE_STYLE = {
  spear: 'pierce',
  battleaxe: 'sweep', '2h_sword': 'sweep', halberd: 'sweep', parang: 'sweep', longsword: 'sweep',
  mace: 'slam', warhammer: 'slam', toya: 'slam', cane: 'slam',
  dagger: 'flurry', claws: 'flurry', scimitar: 'flurry', kerambit: 'flurry',
  sword: 'arc', katana: 'arc',
};
// Two-handed swords' great upward sweep reaches further than other cleaves:
// every foe within 3 tiles of the target or of you, with no limit on how many.
const CLEAVE_WIDE = { '2h_sword': { around: 3, max: Infinity } };   // (was 10; champions now roll a normal kill's loot many times instead)
// A champion has CHAMPION_HP_MULT (30) times a normal monster's life, so it drops
// what that many normal kills of its kind would: it rolls the monster's own loot
// (table, rare table, upgrade stones) this many times, as a normal kill would,
// on top of its champion extras (champion bones, a 50% accessory, a 20% ward).
const CHAMPION_LOOT_KILLS = 30;
// Monsters with a rank in their name (every form above the plain species, from
// Wild up to Divine) are worth more loot: their drop table, rare-table chances
// and upgrade stones roll this many times (a half is a 50% chance of one more).
// Young monsters, the weaker form, stay at one roll like the plain species.
export { CLASS_POWER, OPEN_WOUNDS, openWoundStacks };
export const RANK_LOOT_ROLLS = { Wild: 1.5, Feral: 2, Elder: 2.5, Dire: 3, Ancient: 3.5, Mythic: 4, Primordial: 4.5, Eternal: 5, Celestial: 5.5, Divine: 6 };
const _slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
/** A normal monster's rank word ('Elder', 'Dire'...), or '' for the plain
 *  species. Read against its family, so a species whose own name starts with a
 *  rank word ("Wild boar") isn't mistaken for a ranked form. */
export function monsterRank(def) {
  if (!def?.family || !def.name || _slug(def.name) === def.family) return '';
  return def.name.split(' ')[0];
}
/** Average loot rolls for a monster's rank (1 for none). */
export function rankLootRolls(def) {
  return RANK_LOOT_ROLLS[monsterRank(def)] || 1;
}
/** The whole number of rolls for one kill: the fraction is a chance of one more. */
export function rollRankLoot(def, rand = Math.random) {
  const r = rankLootRolls(def);
  return Math.floor(r) + (rand() < r % 1 ? 1 : 0);
}
// A champion's chance of an upgrade ward (was 10%, doubled with champion rates).
export const CHAMPION_WARD_CHANCE = 0.2;

// Share of fired arrows recovered after the shot.
const ARROW_RECOVERY = 0.8;
const CLASS_LOOT_SHARE = 0.75;   // chance another class's weapon drop becomes your class's equivalent
const CLASS_FOR_TYPE = (t) => classesForType(t).map((c) => c.name).join(' or ') || 'different class';
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
// per Agility level up to 99 (11x the multiplier there). Past 99 the growth
// stops and the usual life-skill rate takes over (pastCapXpMult in xp.js), so
// each level past 99 takes about as long as 98->99 did: it used to keep
// growing, which put Agility 9999 about 15 hours away. Even then a course
// reached 99 in about 4 minutes (its obstacles sit close together), so all
// course XP is divided by AGILITY_SLOWDOWN: 99 in about an hour, and the levels
// past it at the same pace as the other life skills.
export const AGILITY_SLOWDOWN = 16;
export const AGILITY_XP_MULT = 5 / AGILITY_SLOWDOWN;
export const AGILITY_XP_DIV = 10;
export const AGILITY_XP_LEVEL_CAP = 99;
// Dropping more than this many of one thing asks first (see dropItem).
export const DROP_ASK_OVER = 999;
// A Mark of grace trades for this many zip-line crossings' worth of Agility XP,
// at the zip-line's listed XP: a fixed amount, not scaled to your level (it used
// to scale, which roughly doubled course XP).
export const MARK_XP_CROSSINGS = 10;
export const MARK_XP = MARK_XP_CROSSINGS * 60 / AGILITY_SLOWDOWN;
export const BONE_PRAYER_XP = getItem('bones').prayerXp;   // plain bones; every kind's XP is its item's prayerXp (bones.js)

// Alchemy: a utility spell cast on an inventory item.
const ALCHEMY = { level: 21, xp: 65, runes: { nature_rune: 1, fire_rune: 5 } };

// Actions that can fire the instant you press (no random roll to exploit by spamming).
const INSTANT_ACTIONS = new Set(['pickup', 'cookmenu', 'smeltmenu', 'smithmenu', 'craftmenu', 'fletchmenu', 'herbmenu', 'farm', 'pray', 'rest', 'transport', 'openbank', 'openshop', 'talk', 'shrinemenu', 'homemenu']);
const GATHER_ACTIONS = new Set(['woodcut', 'mine', 'fish', 'stall']);
// Gathering (woodcutting, mining, fishing, Hunter) goes this much faster: every
// 1/(GATHER_SPEED-1) ticks an extra roll, so each action takes about 20% less
// time. (Smelting and making, MAKE_FAST, are a whole batch at once, see makeBatch
// in autoprocess.js; Firemaking walks a tile per fire, so it gets the same boost
// as XP instead: see FIRE_XP in skilling.js.)
export const GATHER_SPEED = 1.25;
const MAKE_FAST = new Set(['cook', 'cookdish', 'smith', 'craft', 'recipe']);
// One item of each instant make (makeBatch in autoprocess.js runs the batch).
const MAKE_RESOLVE = { cook: resolveCook, cookdish: resolveDish, smith: resolveSmith, craft: resolveCraft, recipe: resolveRecipe };
const GATHER_FAST = new Set(['woodcut', 'mine', 'fish', 'hunt', ...MAKE_FAST]);
// Thieving's numbers (Game.pickpocket, Game.stealFromStall), shared with the
// skill guide's XP an hour (xprate.js) so the two can't drift apart.
/** XP an ordinary pocket pays: it grows with level only up to 99 (past that the life-skill rate in addXp takes over). */
export const pickpocketXp = (lvl) => 8 + Math.min(lvl, 99);
/** A theft's chance at a stall: a half at its level (or the stall's own `sure`), more with each level over, at most 95%. */
export const stallChance = (def, lvl) => Math.min(0.95, (def.sure || 0.5) + (lvl - (def.level || 1)) * 0.012);
export const STALL_STUN_TICKS = 3;   // caught at a stall: stunned this long
// Ticks you get to answer a Knowledge Strike before the boss's special lands (~7s).
const KS_TICKS = 12;

export class Game {
  constructor() {
    this.bus = new EventBus();
    const data = addArena(buildWorld());   // the Endless Gate's arena, below the map (waves.js)
    this.world = new World(this.bus);
    this.world.build(data);

    this.skills = new Skills(this.bus);
    Play.initPlay(this);   // Focus, Rested XP and the gravestone (playbalance.js)
    this.skills.timeMult = (id) => goldenMult(id, this.gameHour()) * Play.xpMult(this) * (this.gathering?.xpMult(id) ?? 1);   // golden hours (skillhours.js), rested and tired, gathering streaks
    this.inventory = new Inventory(this.bus);
    this.equipment = new Equipment(this.bus);
    this.shrine = new Shrine();   // the Offering Shrine's blessings (see shrine.js)
    this.equipment.extra = () => this.outsideBonuses();   // life skill perks and shrine blessings count with your gear
    this.bank = new Bank(this.bus);

    this.player = new Player(data.spawnPoint.x, data.spawnPoint.y);
    this.player.walkable = (x, y) => this.world.inBounds(x, y) && !this.world.isBlocked(x, y);
    this.player.hp = this.maxHp();

    this.npcs = data.npcSpawns.map((s) => new NPC(s.npcId, s.x, s.y, s.wander, s.opts));
    this._placeMoralNpcs();
    RQ.placeRegionGivers(this);   // one quest giver per region (regionquests.js)

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
    this.meal = null;                // an endgame dish's short boost: { id, ms, fx } (see eatItem)

    this.running = true;    // everyone always runs (the run toggle was removed)
    this.runEnergy = 100;
    this.effects = [];
    this.hazards = [];          // pending boss area attacks (red ground markers)
    this.hitStop = 0;           // ms of near-frozen animation after a big hit
    this.killStreak = 0;        // chained kills for the XP bonus
    this._lastKillTick = -1e9;
    // Auto battle settings: eat below this fraction of life (0 = never),
    // fight only one monster type (null = anything), use attack skills.
    // Bosses start off for new games (auto battle used to walk new players into
    // bosses far above them); saves keep whatever the player chose.
    this.autoCfg = { eatAt: 0.4, target: null, abilities: true, bosses: false, champions: true, priority: true, dodge: true };
    this.particles = [];
    this.cine = new Cinematics();   // camera lead/push-in, boss entrances, region title cards
    this.minimalHud = false;        // Settings > Minimal HUD (saved with the settings)
    this.colourBlind = false; this.reduceMotion = false;   // Settings > Accessibility (saved too)
    this.screenShake = true;   // ...and Screen shake (render/juice.js)
    this.worldLabels = 'smart';     // Settings > World labels: smart / all / off (render/worldlabels.js)
    this.tipsOn = true;             // Settings > Tips: On / Off
    this.tipsSeen = new Set();      // first-time tips this save has shown (ui/tips.js)
    this._footSt = {};              // footFx's memory of your last step and turn
    this.cfx = new CombatFx();      // pooled impact, crit, death and level-up effects (render/combatfx.js)
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
    this.prayerPoints = 0;          // Faith (blessings.js); the old field name, for saves
    this.activePrayers = new Set(); // the equipped Blessings
    this.burstWard = 0; this.burstZeal = 0;   // a Prayer Burst's ward and zeal, in ticks
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
      ...RQ.regionQuestState(),
    };

    // Achievement / collection-log progress.
    this.totalKills = 0;
    this.bossKills = 0;
    this.zonesVisited = new Set();
    this.stationsFound = new Set(['kampong_glam']);   // MRT stations you can ride to from the world map
    this.learning = new Learning();   // Wisdom, topic mastery, Codex cards and titles
    this.waves = new Waves(this);     // the Endless Gate: a run of monster waves, and your best wave
    this.collection = new Collection(this);   // the Collection log: every source's unique drops (collection.js)
    this.pets = new Pets(this);       // rare boss and life-skill pets, and the one following you (pets.js)
    this.worldEvents = new WorldEvents(this);   // roaming world events and weekly region challenges (worldevents.js)
    this.story = new Story(this);     // the main story's chapters, lore pages, story events and scenes (story.js)
    installSkillUnlocks(this);        // life skill unlocks at 10/25/50/75/99 (skillunlocks.js)
    this.home = new Home(this);       // the kampong home plot in Kranji (home.js)
    this.gathering = new Gathering(this);   // gathering streaks, lucky finds and daily skilling contracts (gathering.js)
    this.fishSchools = new FishSchools(this);   // a school of fish now and then at a spot near you (fishschool.js)
    this.teleports = new Teleports(this);   // the Town (K) and Grave (R) teleports (teleports.js)
    this.discovery = new Discovery(this);   // what the encyclopedia shows as found (discovery.js)
    this.snareGiven = true;           // a new character has the starter snare; older saves get one on load (onboarding.js)
    // Knowledge Strikes: bosses' specials can be interrupted by answering a question.
    // On by default in the browser; headless runs (tests) leave bosses as they were.
    this.knowledgeStrikes = LEARNING_ENABLED && typeof document !== 'undefined';
    this._ks = null;
    this.achievements = new Set();
    this.kills = {}; // per-monster kill counts (bestiary)

    // Slayer task system.
    this.slayer = { task: null, points: 0, completed: 0 };
    this.bounties = { day: null, list: [], streak: 0, lastFull: null };   // daily bounty board
    this.culling = Culling.defaultCulling();   // codex mastery, Pest Control contracts, Stewardship (culling.js)

    // Agility course: distinct obstacles touched this lap.
    this._agilityLap = new Set();

    // Active treasure trail (clue scroll), or null.
    this.clue = null;

    // Good / evil alignment. Heroic deeds raise good; theft & cruelty raise evil.
    this.karma = { good: 0, evil: 0 };
    // Moral choice encounters you have answered (id -> 'good' | 'evil'), aggressive
    // kills towards the next good point, and the day a Paragon's gift was given.
    this.moral = { choices: {}, heroKills: 0, giftDay: null };
    this.blessedMs = 0;           // the Blessed buff from a good choice (not saved)
    this._guardReadyAt = 0;       // tick from which town guards may challenge a Villain again
    this.attrs = { str: 0, int: 0, dex: 0 };   // spent stat points (see attributes.js)

    // Special-attack energy (spec bar).
    this.specEnergy = 100;
    this.specArmed = false;

    // Active-combat layer: adrenaline fuels abilities; brace mitigates heavy hits.
    this.adrenaline = 0;
    this.armedAbility = null;     // ability armed for the next attack
    this.moveInput = { x: 0, y: 0 }; // joystick / WASD vector, -1..1 on each axis
    this._driving = false;
    this._stopOnAttackRelease = false;   // the stick was let go while Attack was held
    this.autoBattle = false;      // auto battle: hunt, fight, eat and use skills
    this.autoGather = false;      // auto gather: when a node runs dry, move on to the next one
    this.autoGatherKinds = [];    // ...cycling through every kind of node you've gathered since turning it on
    this.gatherPicks = new Set(); // ...or exactly the kinds you ticked in a skill guide (kept between sessions)
    this.autoQuest = false;       // auto quest: work through quests by yourself (see _autoQuestTick)
    this.autoQuestId = null;      // the quest auto quest is on (the one you last pressed Go on)
    this._autoSkip = new Map();   // npc entityId -> tick until which it is skipped (unreachable)
    this._autoFled = new Map();   // npc entityId -> tick until which it is only answered once it catches up (see _autoFlee)
    this._autoSkipSaid = new Set();   // bosses auto battle has said it is skipping as too strong
    // What auto battle has learned about each kind of boss: beaten (take it on
    // again any time) or lost to (at what fight level). Saved.
    this.bossRecord = { beat: {}, lost: {} };
    this._questBoss = false;      // a quest boss step (journal "Go") lets auto battle take on bosses for that trip
    this._autoLast = null;
    this.abilityCd = {};          // ability id -> ticks until usable again
    this.stackBuffs = {};         // stacking class buffs (the Ranger's skills): ability id -> { ...buff, until }
    this.braceTicks = 0;          // ticks of halved incoming damage left
    this.danceRhythm = 0;         // Dancer Rhythm stacks (more whip damage per landed lash)
    this.playerDot = null;        // boss damage-over-time on the player: { kind, dmg, ticks, from }
    this.playerRoot = 0;          // ticks the player can't move (webs, roots, coils)
    this._buffedBosses = new Set(); // bosses with a reflect running
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
      const big = isMilestoneLevel(p?.level);
      this.spawnConfetti(c.x, c.y - 18, big ? 46 : 22);
      if (big) this.cfx.levelBurst(c.x, c.y - 10);   // milestones: a ring of light and rays as well
      juiceLevel(this, p, big);   // stars round you, confetti and a "<Skill> <level>!" sticker
      this.effects.push({ type: 'ring', x: c.x, y: c.y - 8, color: '#F5B82E', life: 520, maxLife: 520, r0: 6, r1: big ? 52 : 34 });
      if (big) this.addShake(2, 160);
      const perk = p?.skill && perkAtLevel(p.skill, p.level);
      if (perk) {
        this.msg(`New passive perk: ${perk.name}${perk.rank > 1 ? ` (Rank ${rankName(perk.rank)})` : ''}. ${perk.desc}.`, 'level');
        this.banner(`<span class="big">${perk.name}${perk.rank > 1 ? ' ' + rankName(perk.rank) : ''}</span>New passive perk: ${perk.desc}`);
      }
      this._lifePerkNote(p);
      this._slayerNote(p);
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
      this._lifePerkNote(p);
      this._slayerNote(p);
      if (this.player.alive && COMBAT_SKILLS.has(p?.skill)) this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.ceil(this.maxHp() * 0.1));
    };
    // Every 10 life skill levels, say what that skill now adds in a fight, so
    // players notice their gathering and making makes them stronger.
    this._lifePerkNote = (p) => {
      // (Past level 200, where it grows half as fast, every 50 levels to 1000,
      // then every 500 as it grows slowly on to 9999: lifePerkNoteAt.)
      if (!LIFE_PERKS[p?.skill] || !lifePerkNoteAt(p.level)) return;
      const name = SKILL_BY_ID[p.skill]?.name || p.skill;
      const text = `Life skill perk: your ${name} now gives ${lifePerkText(p.skill, p.level)} in combat${p.level === LIFE_PERK_TOP_LEVEL ? ' (its full strength)' : ''}.`;
      if (this._batchNews) this._batchNews.notes.set(`lifeperk:${p.skill}`, [text, 'level']);   // a batch says only the last (autoprocess.js)
      else this.msg(text, 'level');
    };
    // Slayer level-ups: new task monsters when a tier opens, and the on-task
    // bonuses every 10 levels.
    this._slayerNote = (p) => {
      if (p?.skill !== 'slayer') return;
      const opened = SLAYER_TASKS.filter((t) => t.req === p.level).map((t) => t.name);
      if (opened.length) this.msg(`Slayer ${p.level}: the Slayer Master can now give you ${opened.slice(0, 4).join(', ')}${opened.length > 4 ? ` and ${opened.length - 4} more` : ''}.`, 'level');
      if (p.level % 10 === 0) this.msg(`Slayer bonus: ${slayerBuffText(p.level)}.`, 'level');
    };
    this.bus.on('quest', () => { this.checkAchievements(); this.saveSoon = true; });

    this.tickAcc = 0;
    this.beatAcc = 0;             // player combat runs on a faster beat than the world tick
    this.tickCount = 0;
    this.regenCounter = 0;
    this.autosaveCounter = 0;
    this.saveSoon = false;        // set by key moments: save on the next tick
    this._savedTick = -Infinity;  // the tick doTick last saved on
    this.starterGiven = false;
  }

  // ---------------- Lifecycle ----------------
  start() {
    const loaded = hasSave() && loadGame(this);
    if (loaded) {
      this.starterGiven = true;
      // Saves from before two-handed weapons may hold a shield with one.
      if (this.equipment.get('shield') && offhandBlocked(this.equipment.get('weapon'), this.equipment.get('shield'))) this._stowShield();
      this._bankNinjaShield();   // Ninjas from before dual shurikens may still hold a shield
      this._giveBowQuiver();
      Rounds.grantStarterRounds(this);   // guns from before the ammo slot get some rounds
      this.msg(`Welcome back to ${this.world.townName}, ${this.player.name}!`, 'system');
      if (this.play.welcome) { this.msg(this.play.welcome, 'level'); this.play.welcome = null; }
      if (LEARNING_ENABLED && !this.learning.dailyDone(this.todayKey())) this.msg('Your daily revision is ready in the Knowledge Codex (Skills tab).', 'level');
    } else {
      this.newGame();
      if (this.saveBackedUp) this.msg('Your old save could not be read, so a new game has started. A copy of it was kept in this browser.', 'system');
      else if (this.saveBackedUp === false) this.msg('Your old save could not be read, and older unreadable saves already fill the backup space, so it could not be kept.', 'system');
    }
    this.bus.emit('inventory');
    this.bus.emit('equipment');
    this.bus.emit('skills');
    this.bus.emit('hp');
    this.bus.emit('run');
    this.prayerPoints = Math.min(this.prayerPoints, this.maxPrayer());   // Faith (a save's, or none for a new game)
    this.bus.emit('prayer');
    this.updateRegion();
    RQ.syncRegionQuests(this);
    this.story.sync();
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
    this.saveSoon = true;   // a permanent choice: don't lose it to a closed tab
    if (!this.pendingStyleChoice) {
      // An existing character: put away a weapon it can no longer use, and hand over its class weapon.
      this.pendingClassChoice = false;
      const w = this.equipment.get('weapon');
      if (w && getItem(w).equip?.weaponType && !canWield(classId, getItem(w).equip.weaponType) && this.inventory.freeSlots?.() !== 0) {
        const wq = this.equipment.qualityIn('weapon'); this.equipment.clearSlot('weapon'); this.inventory.add(w, 1, wq);
      }
      const starter = starterWeapon(classId);
      if (!this.equipment.get('weapon')) this.equipment.set('weapon', starter); else this.inventory.add(starter, 1);
      if (this.equipment.get('shield') && offhandBlocked(this.equipment.get('weapon'), this.equipment.get('shield'))) this._stowShield();
      this._bankNinjaShield();
      this._giveBowQuiver();
      Rounds.grantStarterRounds(this);
      this.msg(`You are now ${aOrAn(cls.name)}. Only ${WEAPON_TYPE_NAMES[cls.weapon]} and ${WEAPON_TYPE_NAMES[SECONDARY_WEAPON[classId]]} can be wielded, and the choice is permanent.`, 'level');
      this.msg(`${cls.name} perk: ${classPerks(classId)[0].text} (see Skills & perks in the Combat tab)`, 'system');
      this.bus.emit('inventory'); this.bus.emit('equipment');
      return;
    }
    this.pendingStyleChoice = false;
    const style = cls.style;
    const starter = starterWeapon(classId);
    if (style === 'ranged') {
      this.equipment.set('weapon', starter);
      if (canDualWield(starter)) this.equipment.set('shield', starter);   // Pistolers and Ninjas start with a pair
      else if (takesQuiver(starter)) this.equipment.set('shield', 'bronze_quiver');   // Archers and Rangers start with a quiver
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
      if (Rounds.isGunId(starter)) { this.equipment.setAmmo('bronze_rounds', Rounds.STARTER_ROUNDS); this.gunRoundsGiven = true; }   // Pistolers and Snipers start loaded
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
      // Rogues and Corsairs start dual wielding; one-handed melee classes get a shield.
      // (Two-handed weapons leave no hand free for a shield.)
      if (canDualWield(starter)) this.equipment.set('shield', starter);
      else if (!isTwoHanded(starter)) this.equipment.set('shield', 'wooden_shield');
      // Heavy melee starts in chainmail, agile melee in leather (each class has its own armour).
      this.equipment.set('body', ARMOUR_FAMILY[classId] === 'plate' ? 'bronze_chainbody' : 'leather_body');
    }
    this.player.hp = this.maxHp();
    this.msg(`You are ${aOrAn(cls.name)}: you fight with ${WEAPON_TYPE_NAMES[cls.weapon]} (or ${WEAPON_TYPE_NAMES[SECONDARY_WEAPON[classId]]}). Talk to the Kampong Guide for tips.`, 'system');
    this.msg(`${cls.name} perk: ${classPerks(classId)[0].text} (see Skills & perks in the Combat tab)`, 'system');
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
    const add = Math.min(Math.floor(n), this.unspentPoints());
    if (add <= 0) { this.msg('You have no stat points to spend. You earn more as your fighting skill grows.', 'system'); return false; }
    this.attrs[k] += add;
    this.bus.emit('hp'); this.bus.emit('stats');
    return true;
  }
  /** Put every free point into the stat your current fighting style uses. */
  spendAllStats() {
    return this.unspentPoints() > 0 && this.addStat(attrForMode(this.combatMode()), this.unspentPoints());
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
    const sk = this.skills, cl = this.jobClass || '';
    // Asked several times a blow: while the levels behind this mode's last
    // answer haven't moved, that answer stands, with no key to build.
    const last = (this._perkLast ||= {})[mode];
    let m = last && last.cl === cl ? last.m : null;
    if (m) for (let i = 0; i < PERK_SKILLS.length; i++) if (sk.level(PERK_SKILLS[i]) !== last.lv[i]) { m = null; break; }
    if (!m) m = this._perkModsFor(mode, cl);
    // Potions and a meal's boost add on top of the perks (a fresh object, so the cache stays clean).
    let boosted = !!this.meal;
    for (const _ in this.potions) { boosted = true; break; }
    if (boosted) {
      const pm = this.potionMods(mode === 'defence' ? this.combatMode() : mode);
      const out = { ...m };
      for (const [k, v] of Object.entries(pm)) out[k] = (out[k] || 0) + v;
      return out;
    }
    return m;
  }

  /** The cached perk sums behind perkMods, by mode, class and the PERK_SKILLS levels. */
  _perkModsFor(mode, cl) {
    const sk = this.skills, lv = PERK_SKILLS.map((s) => sk.level(s));
    const key = mode + ':' + cl + ':' + lv.join(',');
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
    this._perkLast[mode] = { cl, lv, m };
    return m;
  }

  /** Life skill perks (see lifeperks.js), as gear-style bonuses. Asked for on
   *  every hit, so the totals are kept until a life skill's XP changes. */
  lifePerks() {
    const xp = this.skills.xp, c = this._lifePerkCache;
    if (c && LIFE_PERK_SKILLS.every((s, i) => c.xp[i] === xp[s])) return c.totals;
    const totals = lifePerkTotals((s) => this.skills.level(s));
    this._lifePerkCache = { xp: LIFE_PERK_SKILLS.map((s) => xp[s]), totals };
    return totals;
  }

  /** Every bonus from outside your gear, merged once for Equipment.extra:
   *  life skill perks plus the Offering Shrine's blessings. Kept until either changes. */
  outsideBonuses() {
    const lp = this.lifePerks(), rev = this.shrine.rev, c = this._outsideCache;
    const kc = this.karmaCombat(), kKey = `${kc.side}${kc.tier}`, rq = RQ.regionPerks(this), warm = this.warmth || 0;
    if (c && c.lp === lp && c.rev === rev && c.kKey === kKey && c.rq === rq && c.warm === warm) return c.totals;
    const totals = { ...lp };
    for (const [k, v] of Object.entries(warmthBonus(this) || {})) totals[k] = (totals[k] || 0) + v;   // a fire's warmth (bonfire.js)
    for (const [k, v] of Object.entries(this.shrine.bonuses())) totals[k] = (totals[k] || 0) + v;
    for (const [k, v] of Object.entries(rq)) totals[k] = (totals[k] || 0) + v;   // region quest perks
    // The Dark path's crit damage and lifesteal count like gear's.
    if (kc.side === 'dark') { totals.critDmg = (totals.critDmg || 0) + kc.critDmg; totals.lifesteal = (totals.lifesteal || 0) + kc.lifesteal; }
    this._outsideCache = { lp, rev, kKey, rq, warm, totals };
    return totals;
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
    // A tiered tool counts only once your level lets you use it (tools.js).
    return !!bestTool(this, tag);
  }

  npcAt(tx, ty) {
    return this.npcs.find((n) => n.alive && (
      (n.x === tx && n.y === ty) || (n.moving && n.tx === tx && n.ty === ty)
    )) || null;
  }

  msg(text, cls = 'game') { this.bus.emit('chat', { text, cls }); }
  banner(html, tag) { this.ui?.showBanner(html, tag); this.saveSoon = true; }
  addHitsplat(entity, dmg, opts = {}) {
    if (entity && dmg > 0) entity.hurt = 200; // flash the struck entity
    // Very fast attacks: hits landing on the same foe within 120ms of its last
    // number add into that number instead of each drawing its own, so a flurry
    // stays readable and cheap to draw. Text splats and crits keep their own.
    // Area and splash hits (opts.aoe) are drawn apart from the main hit and
    // never fold into it; a shortbow's three arrows (opts.noMerge) each show.
    const last = entity._lastSplat;
    // Same source = same tint and kind; crits never merge with plain hits, so
    // they keep their own look. Tiny hits get the longer window (see above).
    const tinyCap = Math.max(2, (entity.maxHp || (entity === this.player ? this.maxHp() : 0)) * SPLAT_TINY_SHARE);
    const tiny = !opts.crit && !opts.critX && dmg <= tinyCap && last && last.dmg <= tinyCap * 3;
    const mergeMs = tiny ? SPLAT_TINY_MERGE_MS : SPLAT_MERGE_MS;
    if (last && !opts.noMerge && !opts.text && !last.text && !!opts.aoe === !!last.aoe && dmg > 0 && last.dmg > 0 && !!opts.crit === last.crit && (opts.critX || 0) === last.critX && !!opts.weak === !!last.weak
      && opts.tint === last.tint && last.life > last.maxLife - mergeMs && this.effects.includes(last)) {
      last.dmg += dmg;
      last.bumps = (last.bumps || 0) + 1;   // the number pops again, so every blow shows landing (renderer.js)
      return;
    }
    // Five fan positions, so quick hits sit side by side instead of in a column,
    // and at most SPLAT_MAX_PER numbers per foe: the oldest fades out early.
    entity._splatN = ((entity._splatN || 0) + 1) % 5;
    // ...and each new number takes the other of two rows, so back-to-back
    // numbers never overlap even where the fan wraps round.
    entity._splatRow = entity._splatRow ? 0 : 1;
    const mine = this.effects.filter((e) => e.type === 'hitsplat' && e.entity === entity);
    if (mine.length >= SPLAT_MAX_PER) for (const e of mine.slice(0, mine.length - SPLAT_MAX_PER + 1)) e.life = Math.min(e.life, 120);
    const fx = { type: 'hitsplat', entity, dmg, crit: !!opts.crit, critX: opts.critX || 0, text: opts.text, tint: opts.tint, aoe: !!opts.aoe, weak: !!opts.weak, life: opts.critX ? 1000 : 800, fan: (entity._splatN - 2) * 0.8, row: entity._splatRow };
    fx.maxLife = fx.life;
    entity._lastSplat = fx;
    this.effects.push(fx);
    hitsplatFx(this, entity, dmg, opts);   // crit stars and the screen-edge pulse on big hits
    juiceHit(this, entity, dmg, opts);     // a shake scaled to the hit, the struck sprite's hit-stop and squash
  }

  /** Kick off a decaying screen shake (kept subtle; the strongest is a boss kill). */
  addShake(mag = 3, ms = 220) {
    if (!shakeAllowed(this)) return;   // Settings: Screen shake off, or Reduce motion
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
    // A spear doesn't sweep: its hit is a straight streak along the thrust,
    // from you through the target.
    if (this.weaponType() === 'spear' && target !== this.player) {
      const pc = this.player.renderCenter();
      this.effects.push({ type: 'slash', thrust: true, x: c.x, y: c.y - 6, ang: Math.atan2(c.y - pc.y, c.x - pc.x), color, life: 170, maxLife: 170 });
      return;
    }
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
    // Your swing lasts about as long as the gap between your attacks (within
    // 120-300ms), so each one finishes as the next begins instead of being cut
    // off and restarted mid-lunge (fast attackers looked jittery).
    if (attacker === this.player) attacker.swingDur = Math.max(120, Math.min(300, this.attackInterval() * COMBAT_BEAT_MS * 0.9));
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
    if (this.reduceMotion) this.hitStop = 0;
    if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - dt); adt = dt * 0.12; }
    adt *= this.cine.timeScale();   // a boss's death plays out in slow motion
    const wdt = dt * this.cine.timeScale();   // monsters' own time: a hit-stop slows only the sprite struck (juice.js)
    // Your own walking never freezes, though: stalling mid-stride on every kill
    // made moving between fights (auto battle above all) stutter.
    this.player.update(this.player.moving ? dt : adt);
    this._keepChasing();
    this._holdAttack();
    // Only NPCs near the player animate and walk (the rest are frozen until you
    // come close, like their AI), so a fuller world costs no more per frame.
    { const px = this.player.x, py = this.player.y;
      for (const n of this._npcsAround()) if (n.ally || (Math.abs(n.x - px) <= UPDATE_RADIUS && Math.abs(n.y - py) <= UPDATE_RADIUS)) n.update(spriteDt(n, this.hitStop > 0 ? adt : wdt, this.playMs)); }
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
      this._tickIgnites();   // Fire's burns go off on the beat (every half second, and after hits)
    }
    if (this._autoRetarget) { this._autoRetarget = false; if (this.autoBattle && this.player.alive) this._autoRun(() => this._autoBattleTick()); }

    // The camera follows a little ahead of you (and toward a boss making its entrance).
    const c = this.story.camera(this.cine.update(this, dt), dt);   // a story scene leans toward its speaker
    this.camera.follow(c.x, c.y, 0.22, { width: this.world.width, height: this.world.height }, dt);

    for (const e of this.effects) e.life -= adt;
    keepLive(this.effects, MAX_EFFECTS);   // in place, and capped
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    // Harvest-judder timers on world objects (trees/rocks being worked).
    this.world.tickShakes(dt);

    for (const p of this.particles) {
      p.x += p.vx * adt; p.y += p.vy * adt; p.vy += p.g * adt; p.life -= adt;
      if (p.drag) { const d = Math.pow(p.drag, adt / 16); p.vx *= d; p.vy *= d; }
      if (p.spin) p.rot += p.spin * adt;
      if (p.sway !== undefined) { p.sway += adt * 0.004; p.vx = Math.sin(p.sway) * 0.025; }   // leaves rock side to side as they fall
    }
    if (this.particles.length) keepLive(this.particles);
    footFx(this, this._footSt);   // dust at your feet, leaves from trees you pass

    this.updateHover();
  }

  // ---------------- Particles ----------------
  _pushParticle(p) {
    if (this.lowFx && Math.random() < 0.6) return;   // low graphics: far fewer particles
    this.particles.push(p);
    if (this.particles.length > (this.lowFx ? 80 : 300)) this.particles.shift();
  }

  spawnHitSparks(entity, color) {
    if (entity !== this.player) hitImpact(this, entity, color);   // the weapon's own impact (render/combatfx.js)
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
    deathFx(this, npc);   // a puff of stars and a sticker "poof" as it falls
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
    for (const o of this.world.emberSources()) {
      if (Math.random() < 0.45) {
        const wx = o.x * TILE + TILE / 2 + (Math.random() - 0.5) * 8;
        const wy = o.y * TILE + TILE / 2 - 6;
        this._pushParticle({ x: wx, y: wy, vx: (Math.random() - 0.5) * 0.01, vy: -0.03 - Math.random() * 0.02, g: -0.00002, life: 620, maxLife: 620, size: 1.4 + Math.random() * 1.4, color: '#ffae3a', add: true, art: 'ember' });
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
        life: 5200, maxLife: 5200, size: 0.8 + Math.random() * 1.2, color: Math.random() < 0.5 ? '#8a7a6a' : '#b5a48f', add: false, art: 'dust_l',
      });
    } else {
      // A leaf now and then, tumbling down from a nearby tree. (Only the objects
      // in a box around you, from the world's spatial index and in list order,
      // are tested: not the thousands in the whole world, every tick.)
      const box = this.world.objectsIn(Math.floor((c.x - 200) / TILE), Math.floor((c.y - 150) / TILE), Math.ceil((c.x + 200) / TILE), Math.ceil((c.y + 150) / TILE));
      const trees = box.filter((o) => o.def.type === 'tree' && Math.abs(o.x * TILE - c.x) < 200 && Math.abs(o.y * TILE - c.y) < 150);
      if (trees.length && Math.random() < 0.6) {
        const t = trees[Math.floor(Math.random() * trees.length)];
        const autumn = Math.random() < 0.3;
        this._pushParticle({
          x: t.x * TILE + TILE / 2 + (Math.random() - 0.5) * 18, y: t.y * TILE - 6, vx: (Math.random() - 0.5) * 0.02, vy: 0.012 + Math.random() * 0.01, g: 0,
          life: 2600, maxLife: 2600, size: 1.6 + Math.random() * 0.8, color: autumn ? '#e0a63a' : '#5fb05a', add: false,
          shape: 'leaf', art: leafArt(t, autumn), rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.006, sway: Math.random() * 6.28,
        });
      }
    }
  }

  // ---------------- Game tick (600ms) ----------------
  doTick() {
    this.tickCount++;
    tickWarmth(this);   // standing near a fire warms you (bonfire.js)
    this._tickBossEffects();
    this._tickKnowledgeStrike();
    // Rhythm fades if the Dancer stops lashing for a few ticks.
    if (this.danceRhythm > 0 && this.tickCount - this._danceHitTick > 4) { this.danceRhythm = 0; this.bus.emit('rhythm'); }
    if (!this.player.alive) {
      if (--this.player.respawnTimer <= 0) this.respawnPlayer();
    } else {
      if (this.playerStun > 0) this.playerStun--;
      else { this.resolvePlayerAction(); this._autoRun(() => { this._autoBattleTick(); this._autoLifeTick(); this._autoQuestTick(); }); }
      this._autoPickup();
    }
    this._resolveHazards();
    Play.tickPlay(this);
    tickBossMechanics(this);   // each boss's interactive mechanic (bossmech.js)
    this.player.stepMul = this.playerStepMul() * (this._onRoad() ? ROAD_PACE : 1);   // Agility quickens your steps, and so do roads
    this._tickWorldBoss();
    this.waves.tick();
    this.worldEvents.tick();
    this._tickTownGuards();
    this._tickGreetings();
    Life.tickLife(this);   // routines, chats, remarks, reputation (npclife.js)
    this.cine.tick(this);   // fight push-in, and a boss's entrance the first time it engages
    this._tickWounds();
    if (this.killStreak && this.tickCount - this._lastKillTick > STREAK_WINDOW_TICKS) {
      this.msg(`Your kill streak of ${this.killStreak} ends.`, 'system');
      this.killStreak = 0; this.bus.emit('xpbonus');
    }
    this._checkNightfall();
    this._checkGoldenHours();
    // Only tick NPCs near the player (the bestiary is large).
    const px = this.player.x, py = this.player.y;
    // Cached so every aggressive NPC's _combatAI can cheaply see how many
    // wandering monsters already have unprovoked aggro this tick, instead of
    // each one re-scanning the whole NPC list (avoids O(n^2) in dense areas).
    // The same pass over the whole list picks out who ticks, in list order: a
    // tick only ever moves the NPC ticking, so this picks the very NPCs that
    // checking each in turn would (and it is one walk of ten thousand, not two).
    this._aggroAttackers = 0;
    const npcs = this.npcs, len0 = npcs.length, ticking = [];
    for (let i = 0; i < len0; i++) {
      const n = npcs[i];
      if (n.alive && !n.temporary && n.target === this.player) this._aggroAttackers++;
      // Allies always tick, so they can catch up with a Merchant who travelled far.
      if (n.ally || !(Math.abs(n.x - px) > 46 || Math.abs(n.y - py) > 46)) ticking.push(n);
    }
    const cl = this.skills.squashedCombatLevel();   // bosses' scaling was tuned on the squashed level
    for (const n of ticking) {
      if (n.def.boss && !n.wave) this._scaleBoss(n, cl);   // a wave boss is already scaled to its wave
      n.tick(this);
    }
    // Anyone added during those ticks (a boss's adds) ticks straight away, as before.
    for (let i = len0; i < npcs.length; i++) {
      const n = npcs[i];
      if (!n.ally && (Math.abs(n.x - px) > 46 || Math.abs(n.y - py) > 46)) continue;
      if (n.def.boss && !n.wave) this._scaleBoss(n, cl);
      n.tick(this);
    }
    Mercs.flushAllies(this);
    // Only when one has actually gone: once any temporary had ever been made,
    // the whole list was copied every tick, throwing away every list kept of
    // who is near you with it.
    if (this.hasTemps && this.npcs.some((n) => n.temporary && !n.alive)) this.npcs = this.npcs.filter((n) => !(n.temporary && !n.alive));
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
    Bless.tickBlessings(this);   // a Prayer Burst's ward and zeal run down
    // A full bar of Faith fires the Prayer Burst by itself in any fight, with or
    // without auto battle (blessings.js shouldAutoBurst). autoCfg.burst = false turns it off.
    if (this.autoCfg?.burst !== false && Bless.shouldAutoBurst(this)) this.prayerBurst();

    if (this.tickCount % 100 === 1) this.ensureBounties();   // roll over at local midnight
    // Big moments (a class picked, a quest done, anything with a banner) save on
    // the next tick rather than waiting up to 30s for the autosave.
    // Not before a brand-new player has picked a class: a classless save would
    // reload as an old character and skip the starting kit.
    // In a big fight the Collection log and loot banners ask nearly every tick,
    // and each save writes the whole character (tens of KB with a full bag), so
    // they come at most every SAVE_SOON_GAP ticks. (Leaving the page saves at once.)
    const soon = this.saveSoon && this.tickCount - this._savedTick >= SAVE_SOON_GAP;
    if ((++this.autosaveCounter >= AUTOSAVE_TICKS || soon) && !this.pendingStyleChoice) {
      this.autosaveCounter = 0; this.saveSoon = false; this._savedTick = this.tickCount;
      // Storage full or blocked: say so once instead of failing silently forever.
      // (null is saving paused before a reload, which is not a failure.)
      if (saveGame(this) === false && !this.saveWarned) { this.saveWarned = true; this.msg('Could not save: this browser\'s storage is full or blocked. Your progress is not being kept.', 'system'); }
    }
    // Catch wealth / collection milestones that don't fire a dedicated event.
    if (this.tickCount % 10 === 0) this.checkAchievements();
    this.bus.emit('tick', this.tickCount);
  }

  updateRunEnergy() { this.runEnergy = 100; }   // run energy was removed: always full

  toggleRun() {}   // kept so old key bindings and callers do nothing harmful

  // ---------------- Blessings and Faith (blessings.js) ----------------
  /** Faith's cap: FAITH_BASE + Prayer level. */
  maxPrayer() { return FAITH_BASE + this.skills.prayer; }
  blessingSlots() { return Bless.blessingSlots(this.skills.prayer); }
  toggleBlessing(id) { return Bless.toggleBlessing(this, id); }
  togglePrayer(id) { return this.toggleBlessing(id); }   // older callers
  gainFaith(frac) { Bless.gainFaith(this, frac); }
  prayerBurst() { return Bless.prayerBurst(this); }
  burstActive() { return this.burstWard > 0 || this.burstZeal > 0; }

  prayerMult() {
    // Blessings of the same type stack, the weaker ones at a share (Bless.blessingBonus).
    const b = Bless.blessingBonus(this.activePrayers);
    const m = { att: 1 + b.att, str: 1 + b.str, def: 1 + b.def, ranged: 1 + b.ranged, magic: 1 + b.magic };
    const zeal = Bless.burstZeal(this);   // a Prayer Burst's extra damage, for every style
    if (zeal) { m.str += zeal; m.ranged += zeal; m.magic += zeal; }
    return m;
  }

  /** Extra crit chance (a fraction) from the Attack blessings, for every style. */
  prayerCrit() {
    return Bless.blessingBonus(this.activePrayers).crit;
  }

  protectFactor() {
    if (this.burstWard > 0) return 1;   // a Prayer Burst's ward stops every blow
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

  /** Is this monster one your current Slayer task counts? */
  onSlayerTask(npc) {
    const t = this.slayer?.task;
    return !!(t && npc?.def?.family && npc.def.family === t.family);
  }

  /** Your Slayer bonuses against task monsters right now: { dmg, loot, helm }
   *  in percent (dmg already includes the Slayer helmet's share, helm). */
  slayerBonus() {
    const b = slayerBuffs(this.skills.level('slayer'));
    const helm = this.equipment.get('head') === 'slayer_helmet' ? SLAYER_HELM_DMG : 0;
    return { dmg: b.dmg + helm, loot: b.loot, helm };
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
    this.collection.record('slayer', id, r.qty);
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
      // Making is instant too, like smelting: the whole batch (and with "Do all"
      // every recipe after it) at once, each item still its own roll (autoprocess.js).
      case 'cook': case 'cookdish': case 'smith': case 'craft': case 'recipe':
        return this._tickContinuous(a, a.obj, () => makeBatch(this, a, (x) => runSkillAction(this, x, () => MAKE_RESOLVE[x.type](this, x))));
      // Smelting is instant: the whole batch at once, and with "Smelt all" every
      // kind of bar your ores allow, one after another in the same moment.
      case 'smelt': return this._tickContinuous(a, a.obj, () => batched(this, () => {   // the bag and XP told once (autoprocess.js)
        smeltBatch(this, a);
        while (a.all) {
          (a.done ||= new Set()).add(jobKey(a));
          const nxt = nextJob(this, a.all, a.done);
          if (!nxt || nxt.type !== 'smelt') break;
          Object.assign(a, { rawId: undefined, recipe: undefined, skill: undefined }, nxt);
          smeltBatch(this, a);
        }
        return false;
      }));
      case 'hunt': return this._tickContinuous(a, a.obj, () => resolveHunt(this, a));
      case 'fletchmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openRecipeMenu('fletching', a.obj));
      case 'herbmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openRecipeMenu('herblore', a.obj));
      case 'farm': return this._tickArrival(a, a.obj, true, () => { this.tendPatch(a.obj, a.seed); if (this.autoGather) this._autoLife = { kind: 'farm' }; });
      // One-shot arrival actions (open a UI / talk).
      case 'cookmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openCookMenu(a.obj));
      case 'smeltmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openSmeltMenu(a.obj));
      case 'smithmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openSmithMenu(a.obj));
      case 'craftmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openCraftMenu(a.obj));
      case 'shrinemenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openOfferingShrine());
      case 'pray': return this._tickArrival(a, a.obj, true, () => {
        this.player.hp = this.maxHp();
        this.prayerPoints = this.maxPrayer();
        this.bus.emit('hp'); this.bus.emit('prayer');
        this.spawnSparkle(this.player, '#9adcff', 16);
        this.msg('You kneel at the A-Worthy Monument. Your health and Faith are restored.', 'system');
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
      case 'stall': return this._tickContinuous(a, a.obj, () => this.stealFromStall(a.obj, a));
      case 'transport': return this._tickArrival(a, a.target, true, () => this.ui?.openTransport(a.obj));
      // The Endless Gate asks first (its panel shows your best wave); its exit portal just takes you out.
      case 'gate': return this._tickArrival(a, a.target, true, () => (a.obj.objId === 'wave_exit' ? this.waves.leave() : this.ui ? this.ui.openWaveGate?.(a.obj) : this.waves.enter()));
      case 'openbank': return this._tickArrival(a, a.target, true, () => this.ui?.openBank());
      case 'homemenu': return this._tickArrival(a, a.target, true, () => this.bus.emit('homeopen', a.obj.def.homeTab));   // homeui.js
      case 'openshop': return this._tickArrival(a, a.target, true, () => this.ui?.openShop(a.shop));
      case 'talk': return this._tickArrival(a, a.target, true, () => this.ui?.openDialogue(a.npc));
      case 'storyobj': return this._tickArrival(a, a.target, true, () => this.story.useObject(a.obj));
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
    // With the skill's unlocks (skillunlocks.js); an instant make batch applies them per item itself.
    let going = MAKE_FAST.has(a.type) ? resolver() : runSkillAction(this, a, resolver);
    // A gathering or making skill's extra share of a tick (GATHER_SPEED): every so often, a
    // second roll. (Making swaps item for item, so it needs no free slot.)
    if (going && GATHER_FAST.has(a.type)) {
      a._quick = (a._quick || 0) + (GATHER_SPEED - 1) + toolSpeed(this, a, GATHER_SPEED);   // a better tool adds more (tools.js)
      // (A loop, not one extra: the best tools add up to +100%, so a tick can hold two extra rolls.)
      while (going && a._quick >= 1 && (MAKE_FAST.has(a.type) || this.inventory.freeSlots() > 0) && !obj.depleted) { a._quick -= 1; going = runSkillAction(this, a, resolver); }
    }
    if (gather) this.gathering.onGather(a, obj, before);   // streaks, lucky finds, contracts (gathering.js)
    if (gather) {
      levelHaul(this, a, obj, before);   // a bonus one now and then, likelier as your level rises (levelhaul.js)
      const after = this._bagCounts();
      for (const [id, n] of after) {
        const got = n - (before.get(id) || 0);
        if (got > 0 && id !== 'coins') this.addHitsplat(this.player, 0, { text: `+${got} ${getItem(id).name}` });
        if (got > 0) this.collection.onGather(a.type, id, got);   // rare finds for the Collection log
      }
      this.worldEvents.onGather(obj, before, after);   // event nodes' bonus, weekly region challenge
    }
    // Remember what we're gathering, so auto gather can pick it up again after
    // a fight, or once the mined-out rocks and felled trees grow back.
    if (gather && this.autoGather && obj?.objId) {
      this._autoLife = { kind: 'gather', objId: obj.objId };
      this._addAutoGatherKind(obj);
    }
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

  /** Auto gather does several kinds of node at once: every kind you gather
   *  while it's on joins the round (copper and tin for bronze, or rocks and
   *  trees together), up to AUTO_GATHER_KINDS of them, oldest dropped first. */
  _addAutoGatherKind(obj) {
    if (this.gatherPicks.size) return;   // a ticked list decides the round instead
    let list = this.autoGatherKinds;
    if (list.includes(obj.objId)) return;
    // Moving on to another skill (fishing, then off to chop trees) starts a new
    // round: only kinds of the same skill take turns, or auto gather kept
    // walking back to the old fishing spots between trees.
    const skillOf = (id) => this.world.objects.find((o) => o.objId === id)?.def?.skill;
    const skill = obj.def?.skill ?? skillOf(obj.objId);
    if (skill && list.some((id) => skillOf(id) !== skill)) list = this.autoGatherKinds = [];
    list.push(obj.objId);
    if (list.length > AUTO_GATHER_KINDS) list.shift();
    if (list.length > 1) this.msg(`Auto gather now takes turns at: ${list.map((id) => this._gatherKindName(id)).join(', ')}. Turn it off and on to start a new list.`, 'system');
    this.bus.emit('autogather');
  }

  /** The kinds auto gather takes turns between: the ones ticked in a skill
   *  guide, else every kind gathered since it was switched on. */
  _gatherRound() {
    return this.gatherPicks.size ? [...this.gatherPicks] : (this.autoGatherKinds || []);
  }

  /** Tick or untick a kind of node (its object ids) for auto gather's round. */
  toggleGatherPick(objIds) {
    const on = !objIds.every((id) => this.gatherPicks.has(id));
    for (const id of objIds) { if (on) this.gatherPicks.add(id); else this.gatherPicks.delete(id); }
    if (!on) this._forgetGatherKinds(objIds);
    this.saveSoon = true;
    this.bus.emit('autogather');
    return on;
  }

  /** Untick every kind at once (skill guides and the Auto menu). Returns how many were cleared. */
  clearGatherPicks() {
    const n = this.gatherPicks.size;
    this._forgetGatherKinds([...this.gatherPicks]);
    this.gatherPicks.clear();
    this.saveSoon = true;
    this.bus.emit('autogather');
    this.msg('Cleared your auto gather picks: it goes back to whatever you gather.', 'system');
    return n;
  }

  /** An unticked kind leaves auto gather altogether: out of the round it built
   *  up by itself, and no longer the node it goes back to once idle (unticking
   *  fishing used to leave it walking back to a fishing spot). */
  _forgetGatherKinds(objIds) {
    this.autoGatherKinds = (this.autoGatherKinds || []).filter((id) => !objIds.includes(id));
    if (this._autoLife?.kind === 'gather' && objIds.includes(this._autoLife.objId)) this._autoLife = null;
  }

  /** Auto gather with a ticked list and nothing to do: head for the nearest ticked node. */
  startGatherPicks() {
    if (!this.gatherPicks.size) return false;
    const here = this.playerTile();
    let best = null, bd = Infinity;
    for (const o of this.world.objects) {
      if (!this.gatherPicks.has(o.objId) || o.depleted) continue;
      if (o.def?.skill && (o.def.level || 1) > this.skills.level(o.def.skill)) continue;
      const d = chebyshev(here.x, here.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) { this.msg('None of the kinds you ticked are ready nearby yet.', 'system'); return false; }
    if (!this.autoGather) this.toggleAutoGather(true);
    return this.goToObject(best);
  }

  _gatherKindName(objId) {
    return (this.world.objects.find((o) => o.objId === objId)?.def?.name || objId).toLowerCase();
  }

  /** Where auto gather goes next. With several kinds in the round, it takes
   *  turns: the nearest ready node of the next kind after this one, then any
   *  kind in the round. Failing those, the nearest ready node of the same kind,
   *  or of the same skill you have the level for (another rock, tree or spot),
   *  anywhere in your current region (or within 30 tiles outside one). With
   *  kinds ticked in a skill guide, only those. */
  _nextGatherNode(objId, exclude = null) {
    const here = this.playerTile();
    const def = this.world.objects.find((o) => o.objId === objId)?.def;
    const kinds = this._gatherRound();
    const i = kinds.indexOf(objId);
    const next = kinds.length > 1 && i >= 0 ? kinds[(i + 1) % kinds.length] : null;
    // A ticked list (skill guide) is strict: only the kinds you ticked, never a
    // nearby rock or tree of the same skill (that sent auto mining to tin when
    // the ticked adamantite and runite rocks were all mined out).
    const picked = this.gatherPicks.size ? this.gatherPicks : null;
    const zone = this.world.zoneAt(here.x, here.y);
    // Two reaches: within 30 tiles first, exactly as before; only when there are
    // no nodes of the kind nearby at all does it look across the region you're in (the
    // owner asked for the whole region, so auto mining walks on to the next
    // cluster of runite by itself) and then only for the kinds in the round,
    // never a stand-in rock of the same skill.
    const best = () => ({ turn: null, td: Infinity, round: null, rd: Infinity, same: null, sd: Infinity, other: null, od: Infinity });
    const near = best(), far = best();
    // Kinds in the round that have nodes nearby at all (ready or not): those
    // grow back in seconds, so waiting beats a long walk to another cluster.
    let nearAny = false;
    for (const o of this.world.objects) {
      if (picked && !picked.has(o.objId)) continue;
      const d = chebyshev(here.x, here.y, o.x, o.y);
      if (d <= 30 && (o.objId === objId || kinds.includes(o.objId))) nearAny = true;
      if (o === exclude || o.depleted) continue;
      const b = d <= 30 ? near : (zone && this.world.zoneAt(o.x, o.y) === zone ? far : null);
      if (!b) continue;
      const lvlOk = !o.def?.skill || (o.def.level || 1) <= this.skills.level(o.def.skill);
      if (next && o.objId === next && lvlOk && d < b.td) { b.td = d; b.turn = o; }
      if (kinds.includes(o.objId) && o.objId !== objId && lvlOk && d < b.rd) { b.rd = d; b.round = o; }
      if (o.objId === objId) { if (d < b.sd) { b.sd = d; b.same = o; } continue; }
      if (b === near && def?.skill && o.def?.skill === def.skill && o.def.type === def.type
        && (o.def.level || 1) <= this.skills.level(def.skill) && d < b.od) { b.od = d; b.other = o; }
    }
    return near.turn || near.round || near.same || near.other || (nearAny ? null : far.turn || far.round || far.same);
  }

  /** Auto gather for Farming and Thieving: once you're idle, carry on by
   *  yourself. Farming harvests ripe patches and replants empty ones with your
   *  best seed, patch after patch nearby; Thieving keeps picking the same
   *  pocket. It stops when there's nothing left to do or the bag is full. */
  _autoLifeTick() {
    const job = this._autoLife;
    const p = this.player;
    if (!job || !this.autoGather || p.action || p.isMoving || this.autoBattle || this.waves.active) return;
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
    this.autoGatherKinds = [];   // a fresh round each time it's switched on
    if (!this.autoGather) this._autoLife = null;
    this.msg(this.autoGather ? 'Auto gather on: when a node runs dry you move on to the next one.' : 'Auto gather off.', 'system');
    this.bus.emit('autogather');
  }

  /** One-line description of what auto gather is doing, for the HUD. */
  autoGatherStatus() {
    if (!this.autoGather) return 'Off';
    const a = this.player.action;
    const round = this._gatherRound();
    if (round.length > 1) return round.map((id) => capitalize(this._gatherKindName(id))).join(' + ');
    if (a && GATHER_ACTIONS.has(a.type) && a.obj?.def) return a.obj.def.name;
    if (a?.type === 'farm' || this._autoLife?.kind === 'farm') return 'Farming';
    if (a?.type === 'thieve' || this._autoLife?.kind === 'thieve') return 'Pickpocketing';
    return this._autoLife ? 'Waiting for regrowth' : 'Start gathering';
  }

  /** "Go" from a skill guide or the world map: walk to the nearest of these
   *  objects (anywhere on the island) and start on it (or `start(obj)`, the
   *  life skill shortcuts' "make everything you can here"). */
  goToNearest(objIds, start = null) {
    const ids = new Set(objIds);
    const here = this.playerTile();
    let best = null, bd = Infinity;
    for (const o of this.world.objects) {
      if (!ids.has(o.objId) || o.depleted) continue;
      const d = (o.x - here.x) ** 2 + (o.y - here.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best || !this.player.alive) { this.msg("I can't find one of those anywhere.", 'system'); return false; }
    return this.goToObject(best, start && (() => start(best)));
  }

  /** Walk to one object, however far away, and start on it when you arrive
   *  (or do `start()` instead of what tapping it does). */
  goToObject(obj, start = null) {
    if (!this.player.alive) return false;
    this._mrtHopToward(obj);
    this._pathBudget = 150000;       // like quest trips, these can cross the whole map
    let r;
    try { r = start ? start() : this.defaultObjectAction(obj); } finally { this._pathBudget = 0; }
    // (Making at a station is instant, so a "do all" beside one is already done.)
    const ok = !!this.player.action || this.player.isMoving || (!!start && r === true);
    this.msg(ok ? `You head for the ${obj.def.name.toLowerCase()}.` : "I can't find the way there.", 'system');
    if (ok && !this._autoTrip) this.ui?.closeModal();
    return ok;
  }

  /** Walk to someone, however far away, and talk to them (or whatever tapping
   *  them does) when you arrive: the life skill shortcut to the Slayer master. */
  goToNpc(npc) {
    if (!this.player.alive || !npc?.alive) return false;
    this._mrtHopToward(npc);
    this._pathBudget = 150000;
    try { this.defaultNpcAction(npc); } finally { this._pathBudget = 0; }
    const ok = !!this.player.action || this.player.isMoving;
    this.msg(ok ? `You head for ${npc.name}.` : "I can't find the way there.", 'system');
    if (ok && !this._autoTrip) this.ui?.closeModal();
    return ok;
  }

  /** Run the auto battle / gather / quest step. Trips it starts itself (an
   *  MRT hop to a boss or a quest) leave an open window alone: it used to
   *  close Gear Mastery, a refine or a dismantle under the player's finger. */
  _autoRun(fn) {
    this._autoTrip = true;
    try { fn(); } finally { this._autoTrip = false; }
  }

  /** World map: ride the MRT to any station (every station is open from the start).
   *  Not mid-fight: the map is no escape hatch. A station's own gates (openTransport,
   *  then travelTo) still let you ride out while something attacks you, so arriving
   *  somewhere too dangerous is never a trap. */
  mrtFromMap(stationId) {
    if (this.npcs.some((n) => n.alive && n.target === this.player)) { this.msg("You can't ride from the map while something is attacking you: tap in at a station's gates instead.", 'system'); return false; }
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
  /** Tiles you can attack from: bows and guns have their own reach (shortbows 5-9, longbows 9-10), spells 8, melee 2-4. */
  attackRange() {
    const m = this.combatMode();
    if (m === 'ranged') { const w = this.equipment.get('weapon'); return ((w && getItem(w).equip?.range) || 12) + Math.floor(this.perkMods('ranged').range || 0); }
    if (m === 'dance') { const w = this.equipment.get('weapon'); return (w && getItem(w).equip?.range) || 3; }
    if (m === 'magic') return 8;
    // Melee: 2 tiles for most weapons, 3 for long ones (halberd, longsword, 2h), 4 for spears.
    const w = this.equipment.get('weapon');
    return (w && getItem(w).equip?.range) || MELEE_REACH;
  }

  doPlayerAttack(npc) {
    const mode = this.combatMode();
    if (mode === 'ranged') return this._rangedAttack(npc);
    if (mode === 'magic') return this._magicAttack(npc);
    if (mode === 'dance') return this._danceAttack(npc);
    // Dual wielding: each hand strikes with its own weapon's stats (see _offHandBlow).
    this._hand = 'main';
    const { max } = playerAttackVsNpc(this.skills, this.equipment, this.player.style, npc.def, 'main');
    const pm = this.prayerMult();
    const baseMax = Math.round(max * pm.str);
    this._swingToward(this.player, npc.x, npc.y);

    // Fold together special attack + armed ability + style-weakness bonuses.
    const mods = this._offensiveMods(npc, 'melee');
    const fancy = mods.spec || mods.ability;
    this._slash(npc, fancy ? '#ffd24a' : '#eef2f6');
    this.bus.emit('sfx', `atk:${this.weaponType() || 'unarmed'}`);   // each weapon kind has its own swing sound
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
    // Dual wielding: the off-hand weapon follows up with its own strike.
    if (mods.off && npc.hp > 0) {
      const max = playerAttackVsNpc(this.skills, this.equipment, this.player.style, npc.def, 'off').max * pm.str;
      const r = this._offHandBlow(npc, max, mods, () => this._slash(npc, '#cfe8ff'));
      total += r.dmg; raw += r.raw;
    }
    this._hand = null;
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

  /** A dual wielder's off-hand blow, from the off-hand weapon's own max hit
   *  (`max`, prayers included): OFFHAND_SHARE of it, with that weapon's damage
   *  stats and crit chance (mods.off), its own crit roll, hitsplat, sparks and
   *  XP, and the on-hit effects every blow gets (wounds, lifesteal, perks).
   *  `fx` draws the swing or shot. Returns the damage and its pre-crit roll. */
  _offHandBlow(npc, max, mods, fx) {
    this._hand = 'off';
    const offMax = Math.max(1, Math.round(max * OFFHAND_SHARE * mods.off.dmgM));
    let dmg = rollHit(offMax);
    const raw = dmg;
    const c = this._critHit(dmg, mods.off.critCh); dmg = c.dmg;
    fx(c.crit);
    this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || dmg >= offMax) });
    const ranged = this.combatMode() === 'ranged';
    if (dmg > 0) {
      this.spawnHitSparks(npc, c.crit ? '#ffd24a' : '#e6f2ff');
      for (const x of (ranged ? combatXpRanged : combatXp)(ranged ? this.player.rangedStyle : this.player.style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
    }
    // Area hits that follow (cleave, ricochet) stay with the main hand's crit chance.
    this._aoeCritCh = mods.critCh;
    this._hand = 'main';
    return { dmg, raw };
  }

  /** A dual wielder's max hit with each hand (prayers included; before crits,
   *  armour and per-hit boosts), for the Equipment panel; null when not dual wielding. */
  dualMaxHits() {
    if (!this.equipment.isDualWielding()) return null;
    const pm = this.prayerMult(), ranged = this.combatMode() === 'ranged';
    const one = (slot, hand) => {
      if (!ranged) return playerAttackVsNpc(this.skills, this.equipment, this.player.style, null, hand).max * pm.str;
      const w = getItem(this.equipment.get(slot)).equip;   // pistols: the gun's own power plus its rounds
      return playerRangedVsNpc(this.skills, this.equipment, this.player.rangedStyle, null, Rounds.gunShotStr(this.equipment, w), hand).max * pm.ranged;
    };
    return { main: Math.round(one('weapon', 'main')), off: Math.max(1, Math.round(one('shield', 'off') * OFFHAND_SHARE)) };
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
    mechAbilityUsed(this);   // a special interrupts a boss's cast
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
    for (const n of this._npcsAround()) if (Math.abs(n.x - px) <= NEAR_RADIUS && Math.abs(n.y - py) <= NEAR_RADIUS) list.push(n);
    this._near = { tick: this.tickCount, arr: this.npcs, len: this.npcs.length, px, py, list };
    return list;
  }

  /** Everyone who might be within NEAR_RADIUS of the player, in list order:
   *  the NPCs within NEAR_RADIUS + NEAR_SLACK of where the list was made, and
   *  every ally. NPCs that far out stand frozen (only those near you move, and
   *  only ever themselves), so it only needs making again when the NPC list
   *  changes or once the player has strayed NEAR_SLACK / 2 tiles; it is also
   *  remade every AROUND_REFRESH_TICKS ticks to be safe. Per frame this saves a
   *  pass over the whole world's ten thousand (the frame update and nearbyNpcs
   *  both start from it), and now per tick too. */
  _npcsAround() {
    const p = this.player, px = Math.round(p.x), py = Math.round(p.y), c = this._around;
    if (c && c.tick <= this.tickCount && this.tickCount - c.tick < AROUND_REFRESH_TICKS && c.arr === this.npcs && c.len === this.npcs.length
      && Math.abs(c.px - px) <= NEAR_SLACK / 2 && Math.abs(c.py - py) <= NEAR_SLACK / 2) return c.list;
    const list = [], R = NEAR_RADIUS + NEAR_SLACK;
    for (const n of this.npcs) if (n.ally || (Math.abs(n.x - px) <= R && Math.abs(n.y - py) <= R)) list.push(n);
    this._around = { tick: this.tickCount, arr: this.npcs, len: this.npcs.length, px, py, list };
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
    Bless.faithGain(this, 'hit');   // fighting fills Faith too
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
    const lvl = mode === 'dance' ? this.skills.danceLevel() : this.skills.level(mode === 'ranged' || mode === 'magic' ? mode : 'attack');
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
    if (ab.cls && ab.cls !== this.jobClass) { this.msg(`${ab.name} is ${aOrAn(CLASS_BY_ID[ab.cls]?.name || ab.cls)} ability.`, 'system'); return; }
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
    mechAbilityUsed(this);
    if (ab.build) this._gainAdrenaline(ab.build);
    if (ab.kind === 'guard') {
      this.braceTicks = ab.guardTicks;
      this.braceCounter = ab.counter || 0;   // a guard that strikes back (see resolveNpcAttack)
      this.msg('You brace for impact — incoming damage halved!', 'system');
      this.spawnSparkle(this.player, '#7fd8ff', 12);
      this.bus.emit('sfx', 'spec');
    } else if (ab.kind === 'buff') {
      // A class buff: one at a time, a new one replaces the last. A stacking
      // buff (the Ranger's skills) runs alongside it and the other stacking ones.
      const b = { id: ab.id, name: ab.name, ...ab.buff, until: this.tickCount + (ab.ticks || 10) };
      const fresh = !ab.stack || !this.stackBuffUp(ab.id);   // topping up a running one is quiet
      if (ab.stack) this.stackBuffs[ab.id] = b; else this.buff = b;
      if (ab.rhythm) { this.danceRhythm = Math.min(RHYTHM_MAX, this.danceRhythm + ab.rhythm); this.bus.emit('rhythm'); }
      if (ab.summon && this.jobClass === 'merchant') for (let k = 0; k < ab.summon; k++) Mercs.spawnFollower(this);
      if (fresh) {
        this.msg(`${ab.name}! ${ab.desc}`, 'system');
        this.addHitsplat(this.player, 0, { text: ab.name });
        this.spawnSparkle(this.player, '#ffd24a', 14);
        this.bus.emit('sfx', 'spec');
      }
    } else if (ab.kind === 'heal') {
      const heal = Math.max(1, Math.round(this.maxHp() * ab.healFrac));
      this.player.hp = Math.min(this.maxHp(), this.player.hp + heal);
      this.msg(`${ab.name} restores ${heal} life.`, 'system');
      this.spawnSparkle(this.player, '#7fff8f', 14);
      this.bus.emit('hp');
      this.bus.emit('sfx', 'eat');
    }
    // An offensive rider: a threshold skill strikes the foe you're fighting at
    // once; a free one rides on your next hit (never a free extra attack).
    if (ab.strike) {
      this._strikeAb = { id: ab.id, name: ab.name, kind: 'attack', ...ab.strike };
      const a = this.player.action, npc = a && a.type === 'attack' ? a.npc : null;
      if (ab.cost && npc && npc.alive && this.player.alive && chebyshev(this.player.x, this.player.y, npc.x, npc.y) <= this.attackRange()) this.doPlayerAttack(npc);
    }
    this.bus.emit('adrenaline');
    this.bus.emit('ability');
  }

  /** Agility's bonus to movement speed, in %: tapers towards AGILITY_MOVE_MAX. */
  agilitySpeed() { const a = this.skills.agility; return AGILITY_MOVE_MAX * a / (a + AGILITY_MOVE_HALF); }
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
    let v = b && b.until > this.tickCount ? b[k] || 0 : 0;
    for (const s of Object.values(this.stackBuffs || {})) if (s.until > this.tickCount) v += s[k] || 0;
    return v;
  }
  /** Is this stacking buff (a Ranger skill) running? */
  stackBuffUp(id) { return (this.stackBuffs?.[id]?.until || 0) > this.tickCount; }

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
    // A skill's strike (already paid for) goes first; an armed skill waits for the next hit.
    if (this._strikeAb) { const s = this._strikeAb; this._strikeAb = null; return s; }
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
    mechAbilityUsed(this);   // any skill interrupts a boss's cast
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
    this._hitMode = mode === 'dance' ? 'melee' : mode;   // tags each blow that hits a weakness (_applyPlayerHit)
    // The special attack's and ability's own boosts belong to the main hand's
    // blow alone (abM); everything else below lands on a dual wielder's off-hand too.
    let abM = (spec ? spec.dmg || 1 : 1) * (ab ? ab.dmgMul || 1 : 1);
    let dmgM = weak ? WEAKNESS_BONUS.dmg : 1;
    // Finishers: more damage against a foe already under EXECUTE_BELOW life.
    if (ab?.execute && npc.hp < npc.maxHp * EXECUTE_BELOW) abM *= 1 + ab.execute;
    // Race: the weapon in hand bites harder into some races and is shrugged off by others.
    const race = this.raceMatchup(npc);
    if (this._castElement) dmgM *= elementMult(race);   // a spell's element: x1.5 strong, x0.7 resisted
    else if (race === 'strong') dmgM *= RACE_BONUS.dmg;
    else if (race === 'weak') dmgM *= RACE_PENALTY.dmg;
    // The Holy path (good alignment) smites the unholy: undead, spirits and demons.
    { const kc = this.karmaCombat(); if (kc.side === 'holy' && UNHOLY_RACES.has(raceOf(npc.def, npc.npcId))) dmgM *= 1 + kc.holyDmg; }
    // Magic casts once (rune cost), so its extra hits are ignored.
    const maxHits = mode === 'magic' ? 1 : Infinity;
    // Passive perks: damage (more against bosses and
    // champions), crit, and a chance of an extra hit (a spell echoes instead).
    const perk = this.perkMods(mode);
    this._perkCtx = perk;
    // Monster armour shrugs off a share of each hit (see armourOf); hitting its
    // weakness gets past half of it, and gear's Armour pierce cancels it first,
    // any pierce left over adding damage. Boss damage from gear stacks with the perk's.
    // A dual wielder's hands each use their own weapon's stats (this._hand, see
    // Equipment.bonuses), so the gear-driven part is worked out per hand.
    const armour = armourOf(npc.def, { champion: npc.champion, fightLevel: this.fightLevel() });
    const cracks = shatterPierce(npc, this.tickCount) * bossBreakMult(npc.def);   // Earth's Shatter: cracked armour, for every style (deeper on a thick hide)
    const gearM = (g) => armourMult(armour, g.pierce + cracks + this.buffMod('pierce'), weak)
      * (1 + (perk.dmg || 0) + this.learning.perks().dmg +   // English mastery: Eloquence
        ((npc.def.boss || npc.champion) ? (perk.boss || 0) + g.bossDmg / 100 : (g.mobDmg || 0) / 100))   // Cooking's perk: normal monsters
      // Physical damage bonus % (atkPct) boosts melee, ranged and whips; Magic bonus % boosts spells.
      * (1 + (mode === 'magic' ? g.magPct : g.atkPct) / 100);
    const gb = this.equipment.bonuses(this._hand);
    dmgM *= 1 + (this.attrs[attrForMode(mode)] || 0) * DMG_PER_POINT;   // Strength / Intelligence / Dexterity
    dmgM *= this._volley || 1;   // a volley of very fast attacks lands as one big hit
    dmgM *= 1 + this.buffMod('dmg');   // a class buff
    if (this.onSlayerTask(npc)) dmgM *= 1 + this.slayerBonus().dmg / 100;   // Slayer: hit task monsters harder
    dmgM *= Culling.masteryDamage(this, npc).mult;   // codex mastery of its species and race
    dmgM *= Mercs.merchantPower(this);   // the strongest class (see mercenary.js)
    dmgM *= 1 + openWoundStacks(npc, this.tickCount) * OPEN_WOUNDS.per;   // a Brawler's Open Wounds on the foe
    dmgM *= 1 + hexStacks(npc, this.tickCount) * ELEMENTS.dark.hex.per / 100;   // Dark's Hex on the foe (every style)
    if (npc.sunderUntil > this.tickCount) dmgM *= 1 + (npc.sunder || 0) * bossBreakMult(npc.def);   // armour broken by a skill
    // A boss's armour type: blunt weapons crack plate, wards soak spells, light blows glance off a thick hide.
    dmgM *= bossTypeDmgMult(npc.def, { mode, weaponType: this.weaponType(), interval: this.attackInterval() });
    dmgM *= CLASS_POWER;   // every class 20% stronger
    const sharedM = dmgM;   // what both hands share
    dmgM *= abM * gearM(gb);
    const bonusHit = Math.random() < (perk.extra || 0) + (gb.extra || 0) / 100;   // Thieving's perk adds to the chance
    perk._echo = mode === 'magic' && bonusHit;
    const hits = Math.min(maxHits, Math.max(spec ? spec.hits || 1 : 1, ab ? ab.hits || 1 : 1)) + (bonusHit && mode !== 'magic' ? 1 : 0);
    const guaranteed = !!(ab && ab.guaranteed);
    const heal = (spec ? spec.heal || 0 : 0) || (ab ? ab.lifesteal || 0 : 0);
    // Class ability extras: a wider cleave, a stun once the hit
    // lands, a brace afterwards, and (Merchant) A-Worthlings called up.
    this._abCleave = ab?.cleave || 1;
    this._abStun = ab?.stun && mode !== 'dance' ? ab.stun : 0;   // the Dancer's whip handles its own stun
    this._abRider = ab && (ab.bleed || ab.sunder) ? ab : null;   // a bleed or armour break once the blow lands
    if (ab?.guard) { if (!(this.braceTicks > 0)) this.braceCounter = 0; this.braceTicks = Math.max(this.braceTicks || 0, ab.guard); }
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
    const critRest = (perk.crit || 0) + this.learning.perks().crit + this.buffMod('crit') + this.prayerCrit()
      + (mode === 'magic' ? (this.attrs.int || 0) * CRIT_PER_INT : 0)   // Intelligence
      + (this._castElement ? ELEMENTS[this._castElement].crit || 0 : 0);   // Wind's Gale
    const critCh = ab?.crit ? 1 : critChance(lvl, gb.crit) + critRest;
    this._abAoe = ab?.aoe || 0;   // an ultimate's area: everything this close to the target is hit too
    noteAbility(this, ab);   // its swoosh (or an ultimate's flourish) over the first foe it hits (juice.js)
    // A dual wielder's off-hand blow: its own weapon's damage stats and crit
    // chance, everything shared, but none of the special attack's or ability's boosts.
    let off = null;
    if ((mode === 'melee' || mode === 'ranged') && this.equipment.isDualWielding()) {
      const go = this.equipment.bonuses('off');
      off = { dmgM: sharedM * gearM(go), critCh: critChance(lvl, go.crit) + critRest };
    }
    return { dmgM, hits, guaranteed, heal, spec, ability: ab, weak, race, critCh, off };
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
      * 100 / (100 + (this.attrs?.dex || 0) * SPEED_PER_DEX)   // Dexterity
      / (1 + (this.perkMods().haste || 0));   // a haste brew (Herblore)
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
      return { dmg: Math.max(dmg + 1, Math.round(dmg * (mult + this.equipment.bonuses(this._hand).critDmg / 100))), crit: true, mult };
    }
    return { dmg, crit: false, mult: 1 };
  }

  /** An area hit (cleave, splash, ricochet) rolls its own crit at the main
   *  attack's crit chance: returns the damage and the hitsplat's ×2 / ×4 tag. */
  _aoeCrit(dmg, area = true) {
    // Farming's perk: area hits land harder (not a damage-over-time tick).
    const aoe = area && dmg > 0 ? this.equipment.bonuses().aoe || 0 : 0;
    if (aoe) dmg = Math.max(1, Math.round(dmg * (1 + aoe / 100)));
    if (dmg > 0 && Math.random() < (this._aoeCritCh || 0)) {
      const mult = Math.random() < MEGA_CRIT_CHANCE ? MEGA_CRIT_MULT : CRIT_MULT;
      return { dmg: Math.max(dmg + 1, Math.round(dmg * (mult + this.equipment.bonuses().critDmg / 100))), critX: mult };
    }
    return { dmg, critX: 0 };
  }

  /** Area hits (cleave, splash, ricochet, sweeps, pierces) leave alone any boss
   *  that isn't already fighting you: a stray share of a hit on a monster beside
   *  it would wake a boss you never chose to fight (or that auto battle judged
   *  too strong), and it would then hunt you down. */
  _aoeSpares(o) {
    if (o.target === this.player) return false;
    // A champion, or a monster far above your level, isn't dragged in either:
    // a new character's cleave into a starter pack used to wake its level 59
    // Dire and level 111 Elder packmates, which then killed them.
    if (o.def.fixed || o.def.boss || o.champion || this._farAbove(o)) return true;
    // Nor does it wake more of the crowd once enough are on you already (see
    // CROWD_BASE), or while you're hurt (CROWD_HURT): in the first minute a
    // cleave into MacRitchie's packed camps used to pull in fifteen at once,
    // which killed a new character.
    const p = this.player;
    if (p.hp < this.maxHp() * CROWD_HURT) return true;
    // Counted once a tick, plus whatever this tick's area hits have woken since:
    // counting once a tick alone let one ultimate or cleave wake a whole camp.
    if (!this._crowd || this._crowd.tick !== this.tickCount) {
      let n = 0;
      for (const x of this.nearbyNpcs()) if (x.alive && x.target === p) n++;
      this._crowd = { tick: this.tickCount, n, woken: new Set() };
    }
    const c = this._crowd;
    let crowd = c.n;
    for (const x of c.woken) if (x.target === p) crowd++;   // let through earlier this tick, and hit since
    if (crowd >= CROWD_BASE + Math.floor(this.skills.hitpoints / CROWD_PER_LIFE)) return true;
    c.woken.add(o);
    return false;
  }

  /** Is this monster far above your fight level (see FAR_ABOVE_LEVELS)? */
  _farAbove(n, cl = this.fightLevel()) {
    return (n.def.level || 1) > cl + Math.max(Math.min(FAR_ABOVE_LEVELS, Math.round(cl / 2)), Math.round(cl / 4));
  }

  /** Would auto battle take on this champion that isn't fighting you yet? Only
   *  when a rough time-to-kill says it's a short fight you'd survive. */
  _autoChampionOk(n) {
    const t = this._autoFightTimes(n);
    if (!t || t.myTime > CHAMPION_HUNT_SECS) return false;
    // You'd survive it counting everything already hitting you too: a Lancer
    // with seven monsters on it used to turn to a 15,000-life champion and die.
    let dps = t.theirDps;
    for (const x of this.nearbyNpcs()) if (x !== n && x.alive && x.target === this.player) dps += this._autoFightTimes(x)?.theirDps || 0;
    if (this.maxHp() / Math.max(0.01, dps) < CHAMPION_SAFE_SECS) return false;
    // Casters and archers must also carry the runes or arrows for the whole
    // fight, with plenty to spare (the estimate is hopeful): running dry
    // halfway strands you beside a champion with auto battle switched off.
    const need = t.attacks * CHAMPION_AMMO_SPARE;
    if (t.spell) {
      const free = this.freeRune();
      return Object.entries(t.spell.runes).every(([id, q]) => id === free || this.inventory.count(id) >= need * q);
    }
    const wpn = getItem(this.equipment.get('weapon') || 'coins').equip;
    if (this.combatMode() === 'ranged' && !wpn?.noAmmo && !wpn?.coins) {
      const arrows = this.inventory.slots.reduce((a, sl) => a + (sl && getItem(sl.id).tags?.includes('ammo') ? sl.qty || 1 : 0), 0);
      return arrows >= need * (1 - ARROW_RECOVERY);
    }
    return true;
  }

  _applyPlayerHit(npc, dmg, opts = {}) {
    // An evasive boss slips your blows: slow swings do less to it than quick
    // attacks (combat.js bossGrazeMult). Every blow still lands in full view,
    // with no roll and no "Grazed" label: it used to roll a graze on 15-45% of
    // blows, which read as a miss (the owner's call: attacks never miss).
    const slip = dmg > 0 && !opts.aoe ? bossGrazeMult(npc.def, this.attackInterval()) : 1;
    if (slip < 1) dmg = Math.max(1, Math.round(dmg * slip));
    if (dmg > 0 && !opts.aoe) this._woundFoe(npc, dmg);   // daggers may poison, claws may make it bleed
    // Brawler: each blow adds an Open Wound (more damage taken), up to 30 stacks.
    if (dmg > 0 && this.jobClass === 'brawler') {
      const now = this.playMs || 0, had = openWoundStacks(npc, this.tickCount);
      const n = now >= (npc._openWoundNext || 0) ? Math.min(OPEN_WOUNDS.max, had + 1) : had;
      if (n > had) npc._openWoundNext = now + OPEN_WOUNDS.everyMs;
      npc.openWounds = n; npc.openWoundsAt = this.tickCount;   // any blow keeps the wounds open
      if (n % 10 === 0 && npc._openWoundsSaid !== n) { npc._openWoundsSaid = n; this.addHitsplat(npc, 0, { text: `Open wounds ×${n}` }); }
    }
    // A stunning class ability: the foe reels once the blow lands.
    if (this._abStun && dmg > 0) {
      const t = this._abStun; this._abStun = 0;
      npc.windup = 0; npc.attackCooldown = Math.max(npc.attackCooldown || 0, t * 2);
      this.addHitsplat(npc, 0, { text: 'Stunned!' });
    }
    if (this._abRider && dmg > 0 && !opts.aoe) this._applyRider(npc, dmg);
    // A crit rolled just before this hit: show it as a big red ×2 / ×4 number.
    if (this._pendingCrit && dmg > 0) {
      opts = { ...opts, critX: this._pendingCrit };
      // Brawlers (claw fighters) rake the foe: three bloody swipe marks across it on every crit.
      if (this.jobClass === 'brawler') this.effects.push({ type: 'swipe', entity: npc, mega: this._pendingCrit >= 4, ang: (Math.random() - 0.5) * 0.5, life: 520, maxLife: 520 });
    }
    const wasCrit = this._pendingCrit > 0 && dmg > 0;
    this._pendingCrit = 0;
    // At most a tenth of your life a tick in all, not a tenth a hit: an Archer's
    // volley (a dozen arrows a tick) was burnt back a dozen times and died from full life.
    if (npc.reflectTicks > 0 && this._reflectTick !== this.tickCount) { this._reflectTick = this.tickCount; this._reflectLeft = Math.ceil(this.maxHp() * 0.1); }
    if (npc.reflectTicks > 0 && dmg > 0 && this.player.alive && this._reflectLeft > 0) {
      const back = Math.min(this.player.hp, Math.max(1, Math.round(dmg * (npc.reflectFrac || 0.2))), this._reflectLeft);
      this._reflectLeft -= back;
      this.player.takeDamage(back);
      this.addHitsplat(this.player, back, { tint: '#f5b82e' });
      this.bus.emit('hp');
      if (this.player.hp <= 0) this.playerDeath();
    }
    npc.takeDamage(dmg);
    // Lifesteal from gear: heal a share of the damage dealt.
    // Lifesteal heals in your own life's units: a hit on a big monster counts at its real size.
    const realDmg = dmg * (npc.def?.hpScale || 1);
    const ls = dmg > 0 ? this.equipment.bonuses(this._hand).lifesteal + this.buffMod('lifesteal') * 100 : 0;   // the striking hand's weapon's own
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
    if (dmg > 0 && !opts.aoe && this._hitMode && weaknessOf(npc.def) === this._hitMode) opts = { ...opts, weak: true };   // a "weak!" tag on the number
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
    this.bus.emit('sfx', `atk:${this.weaponType() || 'whip'}`);
    const range = this.attackRange();
    const targets = mods.ability?.sweep
      ? [npc, ...this.nearbyNpcs().filter((n) => n !== npc && n.alive && n.attackable && !n.temporary && n.hp > 0 && chebyshev(p.x, p.y, n.x, n.y) <= range && !this._aoeSpares(n))]
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
    const reach = len + RIFLE_PIERCE_TILES + RIFLE_PIERCE_WIDTH + 1;   // nothing further from you is on the line
    for (const o of this.nearbyNpcs()) {
      if (Math.abs(o.x - p.x) > reach || Math.abs(o.y - p.y) > reach) continue;
      if (o === target || !o.alive || !o.attackable || o.ally || o.hp <= 0) continue;
      const ox = o.x - p.x, oy = o.y - p.y;
      const along = ox * ux + oy * uy;                // how far down the line
      const off = Math.abs(ox * uy - oy * ux);        // how far to the side of it
      if (along < len - RIFLE_PIERCE_WIDTH || along > len + RIFLE_PIERCE_TILES || off > RIFLE_PIERCE_WIDTH + 0.5) continue;
      if (this._aoeSpares(o)) continue;   // bosses aren't dragged in
      const c = this._aoeCrit(raw);
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      this.addHitsplat(o, d, { aoe: true, tint: '#ffe28a', critX: c.critX });
      this.spawnHitSparks(o, '#ffe28a');
      for (const x of combatXpRanged(style, d)) this.skills.addXp(x.skill, x.xp * m);
      if (!o.target) o.target = p;
      if (o.hp <= 0) this.killNpc(o);
    }
    // The tracer carries on past the target.
    const from = target.renderCenter();
    const life = 160;
    this.effects.push({ type: 'projectile', kind: 'bullet', gun: 'rifle', x: from.x, y: from.y - 8,
      ex: from.x + ux * RIFLE_PIERCE_TILES * TILE, ey: from.y - 8 + uy * RIFLE_PIERCE_TILES * TILE, color: '#fff2b0', life, maxLife: life, arc: 0 });
  }

  /** A longbow arrow passes through its target into up to longbowPierceFoes()
   *  monsters lined up behind it (nearest first), each taking LONGBOW_PIERCE_SHARE
   *  of the shot (rolling its own crit, at least 1), with Ranged XP. */
  _longbowPierce(target, raw, style) {
    const p = this.player;
    const dx = target.x - p.x, dy = target.y - p.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const hits = [];
    const reach = len + LONGBOW_PIERCE_TILES + LONGBOW_PIERCE_WIDTH + 1;   // nothing further from you is on the line
    for (const o of this.nearbyNpcs()) {
      if (Math.abs(o.x - p.x) > reach || Math.abs(o.y - p.y) > reach) continue;
      if (o === target || !o.alive || !o.attackable || o.ally || o.temporary || o.hp <= 0) continue;
      const ox = o.x - p.x, oy = o.y - p.y;
      const along = ox * ux + oy * uy - len;          // how far past the target
      const off = Math.abs(ox * uy - oy * ux);        // how far to the side of the line
      if (along < 0.5 || along > LONGBOW_PIERCE_TILES + 0.5 || off > LONGBOW_PIERCE_WIDTH + 0.01) continue;
      if (this._aoeSpares(o)) continue;   // bosses aren't dragged in
      hits.push([along, o]);
    }
    if (!hits.length) return;
    hits.sort((a, b) => a[0] - b[0]);
    hits.length = Math.min(hits.length, longbowPierceFoes(this.skills.ranged));
    const m = this.combatXpMult();
    for (const [, o] of hits) {
      const c = this._aoeCrit(this._aoeShare(raw * LONGBOW_PIERCE_SHARE, target, o));
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      this.addHitsplat(o, d, { aoe: true, tint: '#d9c45a', critX: c.critX });
      this.spawnHitSparks(o, '#cfe0a0');
      for (const x of combatXpRanged(style, d)) this.skills.addXp(x.skill, x.xp * m);
      if (!o.target) o.target = p;
      if (o.hp <= 0) this.killNpc(o);
    }
    // The arrow flies on from the target to the last foe it pierced.
    const from = target.renderCenter(), to = hits[hits.length - 1][1].renderCenter();
    const life = 120 + Math.hypot(to.x - from.x, to.y - from.y) / 0.8;
    this.effects.push({ type: 'projectile', kind: 'arrow', x: from.x, y: from.y - 8, ex: to.x, ey: to.y - 8,
      color: '#d9c45a', life, maxLife: life, arc: 0, ammo: this._shotAmmo || null, crit: false, gun: null });
  }

  /** The other foes a shortbow's spread fans into: up to `n` monsters within
   *  SHORTBOW_FAN_TILES of the target, nearest first, by the same rules as a
   *  longbow's pierce (bosses not already fighting you are left alone). */
  _shortbowFan(target, n) {
    const near = [];
    for (const o of this.nearbyNpcs()) {
      if (o === target || !o.alive || !o.attackable || o.ally || o.temporary || o.hp <= 0) continue;
      const d = chebyshev(o.x, o.y, target.x, target.y);
      if (d > SHORTBOW_FAN_TILES || this._aoeSpares(o)) continue;
      near.push([d, o]);
    }
    near.sort((a, b) => a[0] - b[0]);
    return near.slice(0, n).map((e) => e[1]);
  }

  /** A shortbow's fanned arrows: for each of `spreads` spreads, every foe in
   *  `fan` takes one extra arrow of SHORTBOW_FAN_SHARE of a full arrow (`fullMax`),
   *  rolling its own hit and crit, at least 1, with Ranged XP. */
  _fanArrows(target, fan, spreads, fullMax, tint, shot, style) {
    const p = this.player, m = this.combatXpMult();
    for (let k = 0; k < spreads; k++) {
      for (const o of fan) {
        if (!o.alive || o.hp <= 0) continue;
        const c = this._aoeCrit(this._aoeShare(Math.max(1, Math.round(rollHit(fullMax) * SHORTBOW_FAN_SHARE)), target, o));
        const d = Math.min(o.hp, c.dmg);
        this._projectile(o, c.critX ? '#ffd24a' : tint, shot, 0);
        o.takeDamage(d);
        this.addHitsplat(o, d, { aoe: true, noMerge: true, tint: '#d9c45a', critX: c.critX });
        this.spawnHitSparks(o, '#cfe0a0');
        for (const x of combatXpRanged(style, d)) this.skills.addXp(x.skill, x.xp * m);
        if (!o.target) o.target = p;
        if (o.hp <= 0) this.killNpc(o);
      }
    }
  }

  /** An ultimate's area: every other monster within `radius` tiles of the target
   *  takes the same damage (before crits; each rolls its own), with XP. */
  _abilityAoe(target, raw, mode) {
    const r = this._abAoe; this._abAoe = 0;
    if (!r || raw <= 0) return;
    const p = this.player, m = this.combatXpMult();
    for (const o of this.nearbyNpcs()) {
      if (o === target || !o.alive || !o.attackable || o.ally || o.hp <= 0) continue;
      if (chebyshev(o.x, o.y, target.x, target.y) > r) continue;
      if (this._aoeSpares(o)) continue;   // bosses aren't dragged in
      const c = this._aoeCrit(this._aoeShare(raw, target, o));
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      this.addHitsplat(o, d, { aoe: true, tint: '#ffb347', critX: c.critX });
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
        if (Math.abs(n.x - prev.x) > 3 || Math.abs(n.y - prev.y) > 3) continue;   // (out of reach: skip the rest)
        if (hit.has(n) || !n.alive || !n.attackable || n.ally || n.temporary || n.hp <= 0) continue;
        const d = chebyshev(n.x, n.y, prev.x, prev.y);
        if (d > 3 || d >= bd || this._aoeSpares(n)) continue;   // bosses aren't dragged in
        bd = d; next = n;
      }
      if (!next) break;
      hit.add(next);
      const c = this._aoeCrit(Math.max(1, Math.round(raw * RICOCHET_SHARE)));
      const d = Math.min(next.hp, c.dmg);
      this._lash(next, '#ff8ac0', prev);
      next.takeDamage(d);
      this.addHitsplat(next, d, { aoe: true, tint: '#ff8ac0', critX: c.critX });
      this.spawnHitSparks(next, '#ffb0d8');
      for (const x of combatXpDance(p.danceStyle, d)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
      if (stun && next.hp > 0) { next.windup = 0; next.attackCooldown = Math.max(next.attackCooldown || 0, stun * 2); this.addHitsplat(next, 0, { text: 'Stunned!' }); }
      if (!next.target) next.target = p;
      if (next.hp <= 0) this.killNpc(next);
      prev = next;
    }
  }

  /** A share of a hit moved from one monster to another. Big monsters show
   *  their life (and the hits on them) in smaller numbers (hpScale), so the
   *  share is carried over at its real size, not in the first monster's numbers. */
  _aoeShare(dmg, from, to) {
    return Math.max(1, Math.round(dmg * (from?.def?.hpScale || 1) / (to?.def?.hpScale || 1)));
  }

  /** Melee cleave: the swing carries on into up to 3 other foes. It catches
   *  anything touching the target (the swing carries a tile past it) and
   *  anything crowding you (a sweep). Those already fighting you are hit first, then
   *  the closest to the target, so the share lands where the crowd actually is. */
  _cleave(target, dmg) {
    const type = this.weaponType();
    // A class ability can widen the sweep for this one hit.
    const share = Math.min(1, (CLEAVE_SHARE[type] || 0) * (this._abCleave || 1));
    this._abCleave = 1;
    if (!share) return;
    const p = this.player, reach = Math.max(1, this.attackRange());
    const style = CLEAVE_STYLE[type] || 'arc';
    // A spear's thrust runs in a line: from you through the target and up to
    // two tiles past it, a tile wide (the line's direction, in tiles).
    const vx = target.x - p.x, vy = target.y - p.y, vlen = Math.hypot(vx, vy) || 1;
    const caught = [];
    // Nothing further from you than the sweep can reach is ever caught (a
    // thrust's line, or reach and a tile past the target), so the hundreds of
    // monsters beyond it are passed over without the sums.
    const far = style === 'pierce' ? vlen + 4 : reach + (CLEAVE_WIDE[type]?.around || 1);
    for (const o of this.nearbyNpcs()) {
      if (Math.abs(o.x - p.x) > far || Math.abs(o.y - p.y) > far) continue;
      if (o === target || !o.alive || !o.attackable || o.ally || o.temporary || o.hp <= 0) continue;
      const dt = chebyshev(o.x, o.y, target.x, target.y), dp = chebyshev(o.x, o.y, p.x, p.y);
      if (style === 'pierce') {
        const ux = o.x - p.x, uy = o.y - p.y;
        const along = (ux * vx + uy * vy) / vlen, side = Math.abs(ux * vy - uy * vx) / vlen;
        if (along <= 0 || along > vlen + 2.5 || side > 0.75) continue;
        caught.push({ o, rank: along });   // nearest along the thrust first
        continue;
      }
      // Touching the target (the swing carries one tile past it), or crowding you.
      const wide = CLEAVE_WIDE[type]?.around || 1;
      if (!((dt <= wide && dp <= reach + wide) || dp <= wide)) continue;
      caught.push({ o, rank: (o.target === p ? 0 : 10) + dt });
    }
    caught.sort((a, b) => a.rank - b.rank);
    let n = 0;
    const hitFoes = [];
    for (const { o } of caught) {
      if (n >= (CLEAVE_WIDE[type]?.max || 3)) break;
      // Checked as each foe is hit, so the swing's own wakes count towards the crowd.
      if (this._aoeSpares(o)) continue;     // bosses aren't dragged in
      const c = this._aoeCrit(this._aoeShare(dmg * share, target, o));
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      // Cleave damage earns combat XP like any other hit.
      for (const x of combatXp(this.player.style, d)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
      this.addHitsplat(o, d, { aoe: true, tint: '#ffb347', critX: c.critX });
      this.spawnHitSparks(o, '#ffd9a0');
      hitFoes.push(o);
      if (!o.target) o.target = this.player;
      if (o.hp <= 0) this.killNpc(o);
      n++;
    }
    if (n) this._cleaveFx(style, target, hitFoes);
    return n;
  }

  /** The cleave's look for its weapon kind (see CLEAVE_STYLE): a thrust streak
   *  through the line, a wide arc swept around you, a shockwave slammed down on
   *  the target, a flurry of cuts on every foe caught, or a crescent slash. */
  _cleaveFx(style, target, foes) {
    const pc = this.player.renderCenter(), tc = target.renderCenter();
    const pts = foes.map((o) => o.renderCenter());
    let ex = tc.x, ey = tc.y;
    if (style === 'pierce') {   // the streak runs on to the furthest foe it skewered
      for (const q of pts) if (Math.hypot(q.x - pc.x, q.y - pc.y) > Math.hypot(ex - pc.x, ey - pc.y)) { ex = q.x; ey = q.y; }
    }
    const reachPx = Math.max(TILE, ...[tc, ...pts].map((q) => Math.hypot(q.x - pc.x, q.y - pc.y)));
    this.effects.push({ type: 'cleave', style, x: pc.x, y: pc.y - 6, tx: tc.x, ty: tc.y - 6, ex, ey: ey - 6,
      r: reachPx, foes: pts.map((q) => ({ x: q.x, y: q.y - 6 })), color: '#ffb347',
      life: style === 'slam' ? 340 : 260, maxLife: style === 'slam' ? 340 : 260 });
    if (style === 'slam') this.addShake(2.5, 180);
  }

  _perkSplash(from, dmg) {
    // The closest other foe within 3 tiles (one already fighting you wins a tie).
    let other = null, bd = Infinity;
    for (const n of this.nearbyNpcs()) {
      if (Math.abs(n.x - from.x) > 4 || Math.abs(n.y - from.y) > 4) continue;   // (well out of it: skip the rest)
      if (n === from || !n.alive || !n.attackable || n.ally || n.temporary || n.hp <= 0) continue;
      const d = chebyshev(n.x, n.y, from.x, from.y) - (n.target === this.player ? 0.5 : 0);
      if (d > 3 || d >= bd || this._aoeSpares(n)) continue;
      bd = d; other = n;
    }
    if (!other) return;
    const c = this._aoeCrit(this._aoeShare(dmg, from, other)); dmg = Math.min(other.hp, c.dmg);
    other.takeDamage(dmg);
    this.addHitsplat(other, dmg, { aoe: true, tint: '#f5b82e', critX: c.critX });
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
      if (!sl || !Rounds.isArrow(sl.id)) return;   // rounds are for guns (rounds.js)
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
    const gun = Rounds.GUN_TYPES.has(wpn.weaponType);
    if (gun) Rounds.reloadRounds(this);   // an empty ammo slot reloads from the pack
    // Guns add their loaded rounds to their own power (rounds.js).
    const arrowStr = noAmmo ? Rounds.gunShotStr(this.equipment, wpn) : getItem(this.inventory.slotAt(arrowIdx).id).arrowStr || 0;
    // A Merchant's cane throws money: every throw (a volley counts in full) costs coins.
    if (wpn.coins) {
      const cost = Math.ceil(this.coinThrowCost() * (this._volley || 1));
      if (this.inventory.count('coins') < cost) { this._outOfAmmo(`You need ${cost} coins to throw.`); this.player.clearAction(); return; }
      this.inventory.remove('coins', cost);
    }
    // A Merchant's every throw may call up an A-Worthling (a mirror image).
    if (this.jobClass === 'merchant') Mercs.onMerchantAttack(this);
    const shot = this._shotKind(wpn);
    this.bus.emit('sfx', `atk:${wpn.weaponType || 'shortbow'}`);   // a twang, a crack, a pop, a whirr...
    const tint = wpn.coins ? '#f5b82e' : wpn.weaponType === 'pistol' ? '#ffe28a' : wpn.weaponType === 'shuriken' || wpn.weaponType === 'chakram' ? '#cfd8e6' : '#d9c45a';
    const style = this.player.rangedStyle;
    this._hand = 'main';   // dual pistols: each fires with its own stats (see _offHandBlow)
    const { max } = playerRangedVsNpc(this.skills, this.equipment, style, npc.def, arrowStr, 'main');
    const pr = this.prayerMult().ranged;
    // Longbows fire half as often as shortbows but each arrow hits 60% harder.
    const baseMax = Math.round(max * pr * (wpn.weaponType === 'longbow' ? LONGBOW_DMG : wpn.weaponType === 'rifle' ? RIFLE_DMG : 1));
    const mods = this._offensiveMods(npc, 'ranged');
    const fancy = mods.spec || mods.ability;
    this._swingToward(this.player, npc.x, npc.y);
    let total = 0, raw = 0;   // raw: before crits, for the ricochet
    // A shortbow looses a spread of three arrows each shot, each at SHORTBOW_ARROW_DMG
    // of a full arrow (half its old reach is the trade, see items.js).
    const spread = wpn.weaponType === 'shortbow' ? SHORTBOW_ARROWS : 1;
    const arrowDmg = spread > 1 ? SHORTBOW_ARROW_DMG : 1;
    const shots = mods.hits * spread;
    // The spread also flings an extra arrow into each of the nearest other foes
    // around the target (see _shortbowFan); the target still takes all three.
    const fan = spread > 1 ? this._shortbowFan(npc, SHORTBOW_FAN_FOES) : [];
    let spreads = 0;
    for (let i = 0; i < shots && npc.hp > 0; i++) {
      // A shortbow's spread of three costs one arrow, as a single shot did before
      // spreads: paying for all three ran a new Archer's 999 arrows dry within
      // a few minutes, and auto battle then stopped for good.
      if (noAmmo || i % spread) { /* nothing to spend */ } else if (i > 0) { // extra shots consume extra arrows
        const ai = this._bestAmmoIdx();
        if (ai === -1) break;
        this._spendArrow(ai);
      } else { this._spendArrow(arrowIdx); }
      if (i % spread === 0) spreads++;
      if (gun) Rounds.spendRound(this, wpn.weaponType);
      this._shotAmmo = noAmmo ? null : this.inventory.slotAt(this._bestAmmoIdx())?.id || this._shotAmmo;   // the arrow being drawn
      const effMax = Math.max(1, Math.round(baseMax * mods.dmgM * arrowDmg));
      let dmg = mods.guaranteed ? rollGuaranteed(effMax)
        : wpn.weaponType === 'rifle' ? randInt(Math.max(1, Math.floor(effMax / 4)), effMax)   // sniper rounds always land
        : rollHit(effMax);
      raw += dmg;
      const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
      this._projectile(npc, (c.crit || fancy) ? '#ffd24a' : tint, shot, shots > 1 ? (i % (spread > 1 ? spread : shots)) - ((spread > 1 ? spread : shots) - 1) / 2 : 0);
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax), noMerge: spread > 1 });   // each arrow of a spread shows its own number
      if (gun) Rounds.roundEffect(this, npc, dmg);   // incendiary, frost or shock rounds
      if (dmg > 0) { this.spawnHitSparks(npc, (c.crit || fancy) ? '#ffd24a' : '#cfe0a0'); for (const x of combatXpRanged(style, dmg)) this.skills.addXp(x.skill, x.xp * this.combatXpMult()); }
      total += dmg;
    }
    // After the target's arrows (so its own rolls are just as before), each
    // spread loosed flings its extra arrows into the foes around it.
    if (fan.length && spreads) this._fanArrows(npc, fan, spreads, Math.max(1, Math.round(baseMax * mods.dmgM)), tint, shot, style);
    // Dual pistols (and shurikens): the off-hand one fires its own shot, with its own power.
    let offRaw = 0;
    if (mods.off && npc.hp > 0) {
      const ow = getItem(this.equipment.get('shield')).equip;
      const oStr = ow.noAmmo ? Rounds.gunShotStr(this.equipment, ow) : arrowStr;
      const max = playerRangedVsNpc(this.skills, this.equipment, style, npc.def, oStr, 'off').max * pr;
      const r = this._offHandBlow(npc, max, mods, (crit) => this._projectile(npc, crit ? '#ffd24a' : '#fff2b0', shot, 0.6));
      total += r.dmg; offRaw = r.raw || 0;
    }
    this._hand = null;
    // Shurikens ricochet off the target into one more foe nearby (60% of the hit,
    // both hands' throws together); chakrams bounce on into two more (45% each).
    const rc = RICOCHET[wpn.weaponType];
    if (rc && total > 0) {
      const p = this.player;
      const hit = new Set([npc]);
      for (let k = 0; k < rc.hits; k++) {
        const o = this.nearbyNpcs().find((n) => !hit.has(n) && n.alive && n.attackable && !n.temporary && n.hp > 0
          && chebyshev(n.x, n.y, npc.x, npc.y) <= 3 && chebyshev(n.x, n.y, p.x, p.y) <= this.attackRange() + 3
          && !this._aoeSpares(n));
        if (!o) break;
        hit.add(o);
        const c = this._aoeCrit(Math.max(1, Math.round((raw + offRaw) * rc.share)));
        const d = Math.min(o.hp, c.dmg);
        o.takeDamage(d);
        this.addHitsplat(o, d, { aoe: true, tint: '#cfd8e6', critX: c.critX });
        for (const x of combatXpRanged(style, d)) this.skills.addXp(x.skill, x.xp * this.combatXpMult());
        if (!o.target) o.target = p;
        if (o.hp <= 0) this.killNpc(o);
      }
    }
    if (mods.heal && total > 0) { this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.round(total * mods.heal * (npc.def?.hpScale || 1))); this.bus.emit('hp'); }
    // A Merchant's thrown coins scatter into the foes beside the target, as its allies' do.
    if (wpn.coins && raw > 0) Mercs.allyCleave(this, npc, raw);
    this._abilityAoe(npc, raw, 'ranged');
    if (wpn.weaponType === 'rifle' && raw > 0) this._riflePierce(npc, raw, style);
    if (wpn.weaponType === 'longbow' && raw > 0) this._longbowPierce(npc, raw, style);
    // Shots come as fast as the weapon and attack speed % allow (no floor).
    this._resetCooldown(this.attackInterval());
    this._postAttack(npc);
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
    let xp = 0, real = 0;
    for (const o of this.nearbyNpcs()) {
      if (o === target || !o.alive || !o.attackable || o.ally || o.hp <= 0) continue;
      if (chebyshev(o.x, o.y, target.x, target.y) > radius) continue;
      if (this._aoeSpares(o)) continue;   // bosses aren't dragged in
      const c = this._aoeCrit(dmg);
      const d = Math.min(o.hp, c.dmg);
      o.takeDamage(d);
      this.addHitsplat(o, d, { aoe: true, tint: spell.tint, critX: c.critX });
      if (ELEMENTS[spell.element]?.slowTicks) this._slowFoe(o, ELEMENTS[spell.element].slowTicks);
      if (ELEMENTS[spell.element]?.ignite && d > 0) this._igniteFoe(o, dmg, ELEMENTS[spell.element].ignite);   // from the hit before its crit (see _magicAttack)
      if (ELEMENTS[spell.element]?.shatter && d > 0) this._shatterFoe(o, ELEMENTS[spell.element].shatter);
      if (ELEMENTS[spell.element]?.hex && d > 0) this._hexFoe(o, ELEMENTS[spell.element].hex);   // Dark's Hex
      this.spawnHitSparks(o, spell.tint);
      xp += d;
      real += d * (o.def?.hpScale || 1);
      if (!o.target) o.target = p;
      if (o.hp <= 0) this.killNpc(o);
    }
    // Splash damage earns XP like any other hit, XP bonuses included.
    const m = this.combatXpMult();
    if (xp) for (const x of magicXp(xp)) this.skills.addXp(x.skill, x.xp * m);
    return real;   // in your own life's units (a big monster's hits count at their real size), for Blood's Siphon
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
    // The Mystic blessings (and a Prayer Burst's zeal) boost spells as the Strength
    // and Ranged ones boost blows and arrows (they used to be left out of spells).
    const effMax = Math.max(1, Math.round(max * this.prayerMult().magic * mods.dmgM));
    const el = ELEMENTS[spell.element] || {};
    let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollHit(effMax);
    // Chaos's Wild Surge: anywhere from half to double the roll (splash and burns too).
    if (el.chaos) dmg = Math.max(1, Math.round(dmg * (el.chaos.min + Math.random() * (el.chaos.max - el.chaos.min))));
    const raw = dmg;   // the splash rolls its own crits
    const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
    this._swingToward(this.player, npc.x, npc.y);
    this._projectile(npc, (c.crit || fancy) ? spell.critTint || spell.tint : spell.tint, 'bolt', 0, !!(c.crit || fancy));   // the element's colour, brighter and bigger for a crit
    this.bus.emit('sfx', `atk:${this.weaponType() || 'staff'}`);   // staves shimmer, wands sparkle, orbs hum
    // The number shows the element: gold where it bites, grey where it's resisted, else its own colour.
    const tint = mods.race === 'strong' ? '#f5b82e' : mods.race === 'weak' ? '#9aa3b2' : ELEMENTS[spell.element]?.splat;
    this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax), tint });
    this.skills.addXp('magic', spell.xp * this.combatXpMult());
    if (dmg > 0) { const m = this.combatXpMult(); this.spawnHitSparks(npc, spell.tint); for (const x of magicXp(dmg)) this.skills.addXp(x.skill, x.xp * m); }
    const splashed = dmg > 0 ? this._spellSplash(npc, raw, spell) : 0;
    this._abilityAoe(npc, raw, 'magic');
    if (dmg > 0 && el.slowTicks) this._slowFoe(npc, el.slowTicks);   // Water's Tide
    // Fire's Ignite: the burn is a share of the hit before its crit, since every
    // burn tick rolls its own crit (a crit's burn critting again made Fire twice
    // as strong as any other element once crits came easily).
    if (dmg > 0 && el.ignite) this._igniteFoe(npc, raw, el.ignite);
    if (dmg > 0 && el.shatter) this._shatterFoe(npc, el.shatter);   // Earth's Shatter
    if (dmg > 0 && el.hex) this._hexFoe(npc, el.hex);               // Dark's Hex
    if (dmg > 0 && el.chaos && Math.random() < el.chaos.surge) this._chaosSurge(npc, raw);
    // Blood's Siphon: a share of everything the cast dealt comes back to you as life.
    if (dmg > 0 && el.siphon && this.player.alive && this.player.hp < this.maxHp()) {
      const heal = Math.max(1, Math.round((dmg * (npc.def?.hpScale || 1) + splashed) * el.siphon));
      this.player.hp = Math.min(this.maxHp(), this.player.hp + heal);
      this.spawnSparkle(this.player, '#ff5a72', 3);
      this.bus.emit('hp');
    }
    // Spells come off at half the weapon's swing time (wands quicker than staves); Wind and Water quicker still.
    this._resetCooldown(this.attackInterval(spell));
    this._postAttack(npc);
  }

  /** Fire's Ignite: every hit adds its own burn, worth `share` of the hit, for
   *  `secs` seconds (at most `max` at once: the oldest goes out first). A
   *  burning foe's burns all go off together every `tickMs` (half a second), and
   *  again every time it takes damage from anyone: your hits and splashes,
   *  allies, and the half-second burn ticks too (the owner's rules). The burns
   *  set off by damage don't set themselves off again, or one burn would never
   *  stop. Burns used to tick once a second and nothing else; before that they
   *  lasted until the foe died, which let Fire's damage climb for ever. */
  _igniteFoe(npc, hit, { share, secs = 5, tickMs = 1000, max = Infinity }) {
    if (!npc.alive || npc.hp <= 0) return;
    const ig = npc.ignite || (npc.ignite = { burns: [], sum: 0, owed: 0, owedN: 0, acc: 0, tickMs, critCh: 0 });
    const dmg = Math.max(1, Math.round(hit * share));
    ig.burns.push({ dmg, left: secs * 1000 });
    ig.sum += dmg;
    if (ig.burns.length > max) ig.sum -= ig.burns.shift().dmg;
    ig.tickMs = tickMs;
    ig.critCh = this._aoeCritCh || 0;   // every burn can crit, at the casting spell's crit chance
  }

  /** Every combat beat: burning foes near the player take what their burns owe
   *  (the half-second ticks, and the hits they took since the last beat; see
   *  NPC.takeDamage), in one number a beat however many hits there were, with
   *  Magic XP like any spell damage, and their burns run down. */
  _tickIgnites(stepMs = COMBAT_BEAT_MS) {
    const p = this.player;
    let xp = 0;
    for (const n of this.nearbyNpcs()) {
      const ig = n.ignite;
      if (!ig) continue;
      if (!n.alive || n.hp <= 0) { n.ignite = null; continue; }
      // Like the rest of the world, foes far from the player wait (still alight) until you return.
      if (Math.abs(n.x - p.x) > 46 || Math.abs(n.y - p.y) > 46) continue;
      // The half-second tick, which counts as a hit too, so it sets the burns off a second time.
      ig.acc += stepMs;
      while (ig.acc >= ig.tickMs) { ig.acc -= ig.tickMs; ig.owed += 2 * ig.sum; ig.owedN += 2; }
      if (ig.owedN > 0 && ig.owed > 0) {
        // Each burn going off rolls its own crit (x2, or x4 on a mega crit, plus gear crit damage).
        const saved = this._aoeCritCh; this._aoeCritCh = ig.critCh || 0;
        const each = ig.owed / ig.owedN;
        let dmg = 0, critX = 0;
        for (let i = 0; i < ig.owedN; i++) { const c = this._aoeCrit(each, false); dmg += c.dmg; if (c.critX > critX) critX = c.critX; }
        this._aoeCritCh = saved;
        ig.owed = 0; ig.owedN = 0;
        const d = Math.min(n.hp, Math.max(1, Math.round(dmg)));
        n.ignite = null; n.takeDamage(d); n.ignite = ig;   // a flare-up doesn't set the burns off again
        // Drawn apart from your blows like splash damage (an orange tag), and with no
        // shake or hit-stop: burns go off several times a second.
        this.addHitsplat(n, d, { tint: '#ff8a3d', critX, aoe: true });
        this.spawnSparkle(n, '#ff9a4a', 2);
        xp += d;
        if (!n.target) n.target = p;
        if (n.hp <= 0) { this.killNpc(n); n.ignite = null; continue; }
      }
      // The burns run down, and go out after their `secs`.
      let k = 0, sum = 0;
      for (const b of ig.burns) { b.left -= stepMs; if (b.left > 0) { ig.burns[k++] = b; sum += b.dmg; } }
      ig.burns.length = k; ig.sum = sum;
      if (!k) n.ignite = null;   // burnt out
    }
    if (xp) { const m = this.combatXpMult(); for (const x of magicXp(xp)) this.skills.addXp(x.skill, x.xp * m); }
  }

  /** A skill's rider on the first blow that lands: a sure bleeding wound
   *  (`bleed` of the blow a second, like a claw's) and/or broken armour (the
   *  foe takes `sunder` more damage from you for SUNDER_TICKS ticks). */
  _applyRider(npc, hit) {
    const ab = this._abRider; this._abRider = null;
    if (!npc.alive) return;
    if (ab.bleed) {
      const w = npc.wounds || (npc.wounds = {}), list = w.bleed || (w.bleed = []);
      list.push({ perSec: Math.max(1, Math.round(hit * ab.bleed)), left: WOUNDS.bleed.secs });
      if (list.length > WOUNDS.bleed.stacks) list.sort((a, b) => b.perSec - a.perSec).length = WOUNDS.bleed.stacks;
      this.spawnSparkle(npc, WOUNDS.bleed.color, 5);
    }
    if (ab.sunder) {
      npc.sunder = Math.max(npc.sunderUntil > this.tickCount ? npc.sunder || 0 : 0, ab.sunder);
      npc.sunderUntil = this.tickCount + SUNDER_TICKS;
      this.addHitsplat(npc, 0, { text: 'Armour broken!' });
    }
  }

  /** Daggers poison and claws open bleeding wounds: a chance on each blow
   *  (WOUNDS) to add a stack that deals a share of that hit every second for a
   *  while. Poison is slow and stacks deep; bleeding is shorter and sharper.
   *  Both get past armour (the damage is already inside). */
  _woundFoe(npc, hit) {
    const kind = WOUND_BY_WEAPON[this.weaponType()];
    if (!kind || !npc.alive || npc.hp <= 0) return;
    const W = WOUNDS[kind];
    if (Math.random() >= W.chance) return;
    const w = npc.wounds || (npc.wounds = {});
    const list = w[kind] || (w[kind] = []);
    list.push({ perSec: Math.max(1, Math.round(hit * W.share)), left: W.secs });
    if (list.length > W.stacks) list.sort((a, b) => b.perSec - a.perSec).length = W.stacks;   // keep the strongest
    if (list.length === 1) this.spawnSparkle(npc, W.color, 5);
  }

  /** Poisoned and bleeding foes near the player take their wounds' damage once
   *  a second (melee XP, like the blow that caused it) until the wounds run out. */
  _tickWounds() {
    const p = this.player, m = this.combatXpMult();
    let xp = 0;
    for (const n of this.nearbyNpcs()) {
      const w = n.wounds;
      if (!w) continue;
      if (!n.alive || n.hp <= 0) { n.wounds = null; continue; }
      w.acc = (w.acc || 0) + TICK_MS / 1000;
      while (w.acc >= 1 && n.hp > 0) {
        w.acc -= 1;
        for (const kind of Object.keys(WOUNDS)) {
          const list = w[kind];
          if (!list?.length || n.hp <= 0) continue;
          const d = Math.min(n.hp, list.reduce((t, s) => t + s.perSec, 0));
          for (const s of list) s.left--;
          w[kind] = list.filter((s) => s.left > 0);
          n.takeDamage(d);
          this.addHitsplat(n, d, { tint: WOUNDS[kind].color });
          this.spawnSparkle(n, WOUNDS[kind].color, 2);
          xp += d;
          if (!n.target) n.target = p;
          if (n.hp <= 0) { this.killNpc(n); n.wounds = null; }
        }
      }
      if (n.wounds && !Object.keys(WOUNDS).some((k) => n.wounds[k]?.length)) n.wounds = null;
    }
    if (xp) for (const x of combatXp(p.style, xp)) this.skills.addXp(x.skill, x.xp * m);
  }

  /** Water's Chill: the foe moves and attacks slower for a few ticks (see
   *  NPC.slowTicks), and its blows land softer meanwhile (resolveNpcAttack). */
  _slowFoe(npc, ticks) {
    if (!npc.alive || npc.hp <= 0) return;
    if (!npc.slowTicks) {
      npc._baseStepMul = npc.stepMul; npc.stepMul = npc.stepMul * 1.6; this.spawnSparkle(npc, '#9fe6ff', 4);
      if (npc._chillSaid !== this.tickCount) { npc._chillSaid = this.tickCount; this.addHitsplat(npc, 0, { text: 'Chilled!' }); }
    }
    npc.slowTicks = Math.max(npc.slowTicks || 0, ticks);
  }

  /** Earth's Shatter: each hit adds a crack to the foe's armour, up to `max`;
   *  every crack is `per`% armour pierce for any hit landed on it (see
   *  shatterPierce in combat.js), until `ticks` ticks after the last Earth hit. */
  _shatterFoe(npc, { max, ticks }) {
    if (!npc.alive || npc.hp <= 0) return;
    const had = shatterPierce(npc, this.tickCount) ? npc.shatter.n : 0;
    npc.shatter = { n: Math.min(max, had + 1), until: this.tickCount + ticks };
    if (npc.shatter.n > had) this.spawnSparkle(npc, '#b08850', 3);
    if (npc.shatter.n === max && had < max) this.addHitsplat(npc, 0, { text: 'Shattered!' });
  }

  /** Dark's Hex: each hit curses the foe a little more (up to `max` hexes, each
   *  ELEMENTS.dark.hex.per % more damage from you, every style), fading `ticks`
   *  after the last one (like Earth's cracks). */
  _hexFoe(npc, { max, ticks }) {
    if (!npc.alive || npc.hp <= 0) return;
    const had = hexStacks(npc, this.tickCount);
    npc.hex = { n: Math.min(max, had + 1), until: this.tickCount + ticks };
    if (npc.hex.n > had) this.spawnSparkle(npc, '#9a6cd6', 3);
    if (npc.hex.n === max && had < max) this.addHitsplat(npc, 0, { text: 'Hexed!' });
  }

  /** Chaos's Wild Surge: one of the other elements' effects, at random: a burn
   *  (Fire), a chill (Water) or a crack in its armour (Earth). */
  _chaosSurge(npc, raw) {
    const pick = ['fire', 'water', 'earth'][Math.floor(Math.random() * 3)], E = ELEMENTS[pick];
    if (pick === 'fire') this._igniteFoe(npc, raw, E.ignite);
    else if (pick === 'water') this._slowFoe(npc, E.slowTicks);
    else this._shatterFoe(npc, E.shatter);
    this.spawnSparkle(npc, '#e0a0ff', 3);
    return pick;
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
  /** Auto retaliate answers a blow, except while you're working a life skill:
   *  chopping, mining, fishing and the rest carry on when something attacks you
   *  (the owner asked for it). Click the monster, or stop, to fight back. */
  _shouldRetaliate() {
    const p = this.player;
    if (!p.autoRetaliate) return false;
    if (this._fleeing) return false;   // auto battle is running from a fight it would lose (see _autoFlee)
    const t = p.action?.type;
    return !t || (t !== 'attack' && !LIFE_SKILL_ACTIONS.has(t));
  }

  _knock(victim, from) {
    const a = victim.renderCenter(), b = from.renderCenter();
    const dx = a.x - b.x, dy = a.y - b.y, m = Math.hypot(dx, dy) || 1;
    victim.knockDX = dx / m; victim.knockDY = dy / m; victim.knock = 160;
  }

  /** What a ranged weapon fires: only bows loose arrows; pistols fire bullets
   *  and Ninjas throw spinning shurikens. */
  _shotKind(wpn) {
    return wpn?.coins ? 'coin' : wpn?.weaponType === 'pistol' || wpn?.weaponType === 'rifle' ? 'bullet' : wpn?.weaponType === 'shuriken' || wpn?.weaponType === 'chakram' ? 'shuriken' : 'arrow';
  }

  _projectile(npc, color, kind = 'bolt', spread = 0, crit = color === '#ffd24a') {
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
      : kind === 'bullet' ? 60 + dist / 5 + Math.abs(spread) * 12   // about twice as quick as they were; a longer streak keeps them in sight
        : kind === 'shuriken' || kind === 'coin' ? Math.min(560, 120 + dist / 0.6) + Math.abs(spread) * 40
          : 240 + Math.abs(spread) * 40;
    this.effects.push({ type: 'projectile', kind, x: fx, y: from.y - 6 + off, ex: to.x, ey: to.y - 8 + off * 0.6, color, life, maxLife: life,
      arc: kind === 'arrow' ? Math.min(22, dist * 0.09) : 0,
      // Which arrows were loosed (bronze ... eternal): the renderer draws each kind its own way.
      ammo: kind === 'arrow' ? this._shotAmmo || null : null, crit,
      // Which gun fired a bullet: the Pistoler's rounds are tiny, the Sniper's a long tracer (renderer.js).
      gun: kind === 'bullet' ? (this.weaponType() === 'rifle' ? 'rifle' : 'pistol') : null });
  }

  /** Dodging a monster's attack trains Agility, more for tougher foes: a share
   *  of what killing it pays (DODGE_KILL_SHARE of its kill XP), and never less
   *  than DODGE_AGILITY_XP x its max hit. Stepping out of a boss's ground
   *  marker is the skilful kind of dodge and pays HAZARD_DODGE_MULT times that.
   *  In the Endless Gate it grows with the wave (waves.dodgeXpMult). A gain of
   *  a point or more floats up beside "Dodged!" as "+N Agility". */
  _dodgeXp(npc, mult = 1) {
    if (!npc?.def) return;
    const base = (o) => {
      const { max } = npcAttackVsPlayer(o.def, this.skills, this.equipment, this.player.style);
      return Math.max(Math.max(1, max) * DODGE_AGILITY_XP, (o.maxHp || o.def.hp || 1) * 3 * (o.def.boss ? DODGE_BOSS_SHARE : DODGE_KILL_SHARE));
    };
    // Deep in the Endless Gate, no more than the same monster at wave 20 (waves.dodgeRef).
    const ref = this.waves.dodgeRef(npc);
    // (Not rounded: at the combat XP rate one small dodge is a fraction of a point.)
    const xp0 = this.skills.xp.agility;
    this.skills.addXp('agility', (ref ? Math.min(base(npc), base(ref)) : base(npc)) * mult * this.combatXpMult() * this.waves.dodgeXpMult(npc));
    const got = this.skills.xp.agility - xp0;   // after the XP rate and boosts addXp applies
    if (got >= 1) this.addHitsplat(this.player, 0, { text: `+${damageNumber(got)} Agility`, noMerge: true });
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
      if (this._shouldRetaliate()) this.attackNpc(npc);
      return;
    }
    const perk = this.perkMods();
    const dodge = (perk.dodge || 0) + this.buffMod('dodge');   // perks and a dodging class buff
    if (dodge && Math.random() < dodge * (heavy ? 0.5 : 1)) {   // Evasion / Graceful perks
      this.addHitsplat(p, 0, { text: 'Dodged!' });
      this._dodgeXp(npc);
      if (this._shouldRetaliate()) this.attackNpc(npc);
      return;
    }
    const { atkRoll, defRoll, max } = npcAttackVsPlayer(npc.def, this.skills, this.equipment, p.style);
    let dmg = rollAttack(atkRoll, defRoll * this.prayerMult().def, heavy ? Math.round(max * 2) : max);
    if (heavy && dmg === 0) dmg = Math.max(1, Math.round(max * 1.2)); // a telegraphed blow always stings
    if (heavy) { this._slash(p, '#ff6a5a'); this.addShake(4, 260); }
    if (npc.slowTicks > 0) dmg = Math.floor(dmg * (1 - ELEMENTS.water.chill));   // Water's Chill: a chilled foe hits softer
    const prot = this.protectFactor();
    if (prot) dmg = Math.floor(dmg * (1 - prot));
    // A skill's thorns or counter strikes back a share of the blow as it came, before the guard.
    const blow = dmg, skillThorns = this.buffMod('thorns') + (this.braceTicks > 0 ? this.braceCounter || 0 : 0);
    if (this.braceTicks > 0) dmg = Math.floor(dmg * 0.5); // the Brace ability soaks the blow
    if (this.buffMod('reduce')) dmg = Math.floor(dmg * (1 - Math.min(0.9, this.buffMod('reduce'))));   // a defensive class buff
    dmg = this._perkReduce(dmg, npc);
    if ((dmg > 0 && perk.thorns || blow > 0 && skillThorns) && npc.alive) {           // Spiked Armour perk, thorny skills
      const back = Math.max(1, Math.round((dmg * (perk.thorns || 0) + blow * skillThorns) / (npc.def?.hpScale || 1)));
      npc.takeDamage(back); this.addHitsplat(npc, back, { tint: '#9aa6b2' });
      if (npc.hp <= 0) { this.killNpc(npc); }
    }
    p.takeDamage(dmg);
    if (dmg > 0) this._knock(p, npc);
    this.addHitsplat(p, dmg, { crit: heavy && dmg > 0 });
    if (dmg > 0) { this.spawnHitSparks(p, heavy ? '#ff5a5a' : '#ff8a8a'); this.bus.emit('sfx', 'hurt'); this._gainAdrenaline((heavy ? 2 : 1) * ADREN_PER_HURT + this._adrenTrait('hurt')); Bless.faithGain(this, 'hurt'); }
    if (heavy) this.msg(`${npc.name} unleashes a heavy blow${this.braceTicks > 0 ? ' — you brace and soften it!' : '!'}`, 'combat');
    this.bus.emit('hp');
    if (this._shouldRetaliate()) this.attackNpc(npc);
    if (p.hp <= 0) this.playerDeath();
  }

  // ---------------- Good / evil alignment ----------------
  addGood(n) { if (n > 0) { this.karma.good += n; this.bus.emit('karma'); } }
  addEvil(n) { if (n > 0) { this.karma.evil += n; this.bus.emit('karma'); } }
  alignment() { const k = this.karma; return k ? k.good - k.evil : 0; }   // (gear bonuses can be asked for before karma exists)

  /** What your alignment does in a fight: the Holy path (good) or the Dark
   *  path (evil), stronger at each alignment tier; Neutral gives nothing. */
  karmaCombat() {
    const a = this.alignment();
    let tier = 0;   // (how many tiers you've reached: asked whenever your gear's totals are)
    for (const t of KARMA_TIERS) if (Math.abs(a) >= t) tier++;
    if (!tier) return { side: 'neutral', tier: 0 };
    if (a > 0) return { side: 'holy', tier, holyDmg: HOLY_DMG[tier - 1], killHeal: HOLY_HEAL[tier - 1] };
    return { side: 'dark', tier, critDmg: DARK_CRITDMG[tier - 1], lifesteal: DARK_LIFESTEAL[tier - 1] };
  }

  /** Title + css class for the current alignment. */
  alignmentTitle() {
    const t = alignmentTier(this.alignment());   // the tiers live in alignment.js
    return { title: t.title, cls: t.cls };
  }
  /** Overhead title, colour and aura for the current alignment (alignment.js). */
  alignmentStyle() {
    const a = this.alignment(), t = Culling.titleText(this) || repTitleText(this);   // asked every frame by the renderer: kept until either changes
    // A Neutral hero has no alignment title, so a codex title they wear shows instead.
    if (this._alStyle?.a !== a || this._alStyle.t !== t) { const st = alignmentStyle(a); this._alStyle = { a, t, ...st, label: st.label || t }; }
    return this._alStyle;
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

  /** Shop prices: karma, then the Economics Trader perk from mastered topics,
   *  then (buying at `shopId`) your standing in the region and your choices. */
  priceFactor(shopId = null) {
    const k = this.karmaFactor(), t = this.learning.perks().shop;
    const local = shopId ? repPriceMult(this, this.currentZoneName) * consequencePriceMult(this, shopId) : 1;
    return { buy: k.buy * (1 - t) * local, sell: k.sell * (1 + t) };
  }

  // ---------------- Moral choice encounters (moralEvents.js) ----------------
  /** Put each encounter's person on their spot (the nearest free walkable
   *  tile). They wear an existing NPC's art (artId) but have their own npcId,
   *  so nothing that looks NPCs up by id (quest givers, shops, bounties) can
   *  mistake them for the real hawker or a huntable dog. */
  _placeMoralNpcs() {
    const taken = new Set(this.npcs.map((n) => n.x * 4096 + n.y));
    for (const ev of MORAL_EVENTS) {
      let spot = null;
      for (let r = 0; r <= 6 && !spot; r++) {
        for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = ev.x + dx, y = ev.y + dy;
          if (this.world.inBounds(x, y) && !this.world.isBlocked(x, y) && !taken.has(x * 4096 + y)) spot = { x, y };
        }
      }
      if (!spot) continue;
      taken.add(spot.x * 4096 + spot.y);
      // Spawn options keep a monster's art (the stray dog) from rolling champion.
      const n = new NPC(ev.art, spot.x, spot.y, 0, { aggressive: false });
      n.npcId = `moral_${ev.id}`;
      n.artId = ev.art;
      n.wander = 0;
      n.def = { ...n.def, name: ev.name, attackable: false, aggressive: false, aggroRange: 0, role: 'dialogue', dialogue: null, shop: null,
        moral: ev.id, examine: 'Someone who could use a hand... or be taken advantage of.' };
      this.npcs.push(n);
    }
  }

  /** Answer a moral encounter with 'good' or 'evil'. Only the dialogue box
   *  calls this: auto quest and auto battle never choose for you. Each
   *  encounter can be answered once. Returns true if the choice was made. */
  moralChoose(id, side) {
    const ev = MORAL_BY_ID[id];
    if (!ev || (side !== 'good' && side !== 'evil') || this.moral.choices[id]) return false;
    const c = ev[side], fl = this.fightLevel();
    if (c.cost) {
      const cost = moralCoins(c.cost, fl);
      if (this.inventory.count('coins') < cost) { this.msg(`You need ${cost} coins for that.`, 'system'); return false; }
      this.inventory.remove('coins', cost);
    }
    this.moral.choices[id] = side;
    if (side === 'good') this.addGood(c.karma); else this.addEvil(c.karma);
    const gains = [`${c.karma} ${side} karma`];
    if (c.skill && c.xp) {
      // A share of the XP to the skill's next level, so it matters at any level.
      const lvl = this.skills.level(c.skill), need = xpForLevel(lvl + 1) - xpForLevel(lvl);
      const xp = Math.max(1, Math.round(need * c.xp / XP_RATE / this.skills.lifeXpMult(c.skill)));
      gains.push(`${xpText(this.skills.addXp(c.skill, xp))} ${SKILL_BY_ID[c.skill]?.name || c.skill} XP`);
    }
    if (c.coins) { const n = moralCoins(c.coins, fl); this.inventory.add('coins', n); gains.push(`${n} coins`); }
    for (const [item, q] of c.items || []) { this.inventory.add(item, q); gains.push(`${q} ${getItem(item).name}`); }
    if (c.shrine) { this.shrine.points += c.shrine; this.bus.emit('shrine'); gains.push(`${c.shrine} shrine points`); }
    if (c.bless) { this.blessedMs = BLESS_MS; this.bus.emit('xpbonus'); gains.push(`Blessed (+${Math.round((BLESS_XP - 1) * 100)}% combat XP for ${BLESS_MS / 60000} minutes)`); }
    this.msg(`${ev.name}: ${side === 'good' ? 'a good deed' : 'an evil deed'}. +${gains.join(', +')}.`, 'level');
    this.spawnSparkle(this.player, side === 'good' ? '#ffd24a' : '#9a5ad8', 14);
    this.bus.emit('sfx', side === 'good' ? 'level' : 'hurt');
    // They thank or curse you out loud.
    const n = this.npcs.find((x) => x.def.moral === id);
    if (n) { n.chatText = side === 'good' ? 'Thank you!' : 'How could you?!'; n.chatTimer = 4; }
    return true;
  }

  /** True while an encounter's person is still waiting for your choice. */
  moralPending(npc) { return !!(npc?.def.moral && !this.moral.choices[npc.def.moral]); }

  // ---------------- Alignment in town: greetings and guards ----------------
  /** Townsfolk near you call out now and then: warmly if you are good,
   *  nervously if you are wicked. A Paragon also gets one gift a day. */
  _tickGreetings() {
    const p = this.player;
    if (this.tickCount % GREET_EVERY !== 0 || !p.alive) return;
    let best = null, bd = Infinity;
    for (const n of this.nearbyNpcs()) {
      if (!n.alive || n.attackable || n.ally || !n.def.role || n.def.moral || n.chatTimer > 0) continue;
      if (n._greetedAt && this.tickCount - n._greetedAt < GREET_EVERY * 8) continue;   // not the same face every time
      const d = chebyshev(p.x, p.y, n.x, n.y);
      if (d <= GREET_RANGE && d < bd) { bd = d; best = n; }
    }
    if (!best) return;
    const a = this.alignment();
    best._greetedAt = this.tickCount;
    best.chatText = greetingFor(a, ((this.tickCount / GREET_EVERY) * 0.618) % 1);   // varied, without using up random rolls
    best.chatTimer = 4;
    if (alignmentTier(a).id === 'paragon' && this.moral.giftDay !== dayKey()) {
      this.moral.giftDay = dayKey();
      const coins = moralCoins(40, this.fightLevel());
      this.inventory.add('coins', coins);
      this.inventory.add('chicken_rice', 2);
      best.chatText = 'For you, hero! Terima kasih!';
      this.msg(`${best.name} presses a thank-you gift into your hands: ${coins} coins and 2 chicken rice.`, 'level');
    }
  }

  /** Would the town watch challenge you here? Only a Villain, only inside a
   *  town, never a low-level player, and in the starter area (within 30 tiles
   *  of the respawn point, the starter ring) only from GUARD_STARTER_LEVEL. */
  guardsWouldChallenge(x = this.player.x, y = this.player.y) {
    if (alignmentTier(this.alignment()).id !== 'villain') return false;
    const fl = this.fightLevel();
    if (fl < GUARD_MIN_LEVEL || !this._worldBossInTown(x, y)) return false;
    const rp = this.world.respawnPoint;
    if (rp && chebyshev(x, y, rp.x, rp.y) <= 30 && fl < GUARD_STARTER_LEVEL) return false;
    return true;
  }

  _tickTownGuards() {
    const p = this.player;
    // Guards that lost you (you fled or fell) or found nobody to fight go back on patrol.
    if (this._guards?.length) {
      this._guards = this._guards.filter((g) => {
        if (!g.alive) return false;
        if (p.alive && g.target === p) { g.guardUntil = this.tickCount + GUARD_STAY; return true; }
        if (p.alive && this.tickCount < g.guardUntil && chebyshev(p.x, p.y, g.x, g.y) <= 20) return true;
        this.npcs = this.npcs.filter((n) => n !== g);
        if (p.target === g) p.target = null;
        return false;
      });
    }
    if (!p.alive || this.tickCount < this._guardReadyAt || this._guards?.length) return;
    if (this.guardsWouldChallenge()) this.spawnTownGuards();
  }

  /** The town watch comes for a Villain: one or two guards with an ordinary
   *  monster's stats at your fight level (a humanoid if one is near it), a
   *  little softer, who go straight for you. */
  spawnTownGuards() {
    const p = this.player, fl = this.fightLevel();
    let base = null, bd = Infinity;
    for (const id of ALL_MONSTER_IDS) {
      const d = getNpc(id);
      if (!d.attackable || d.boss) continue;
      const score = Math.abs((d.level || 1) - fl) * (d.sprite === 'humanoid' ? 0.5 : 1);
      if (score < bd) { bd = score; base = d; }
    }
    if (!base) return [];
    const out = [];
    for (let i = 0, n = this.alignment() <= GUARD_PAIR_AT ? 2 : 1; i < n; i++) {
      let spot = null;
      for (let tries = 0; tries < 40 && !spot; tries++) {
        const ang = Math.random() * Math.PI * 2, r = 4 + Math.random() * 3;
        const x = Math.round(p.x + Math.cos(ang) * r), y = Math.round(p.y + Math.sin(ang) * r);
        if (this.world.inBounds(x, y) && !this.world.isBlocked(x, y)) spot = { x, y };
      }
      if (!spot) continue;
      const g = new NPC('mercenary_spear_guard', spot.x, spot.y, 0);
      g.npcId = 'town_guard';
      g.artId = 'mercenary_spear_guard';   // the spear guard's painted art
      g.def = { name: 'Town Guard', examine: 'The town watch. They know your face.', attackable: true, aggressive: true, aggroRange: 16,
        ignoreLevelGate: true, family: 'town_guard', level: base.level, tierLevel: base.tierLevel, hpScale: base.hpScale,
        attack: base.attack, strength: base.strength, defence: base.defence, attackSpeed: base.attackSpeed || 4,
        maxHp: Math.max(2, Math.round(base.maxHp * GUARD_HP_MULT)), maxHit: Math.max(1, Math.round(base.maxHit * GUARD_HIT_MULT)),
        alwaysDrop: [], dropTable: [] };
      g.maxHp = g.hp = g.def.maxHp;
      g.temporary = true;
      g.townGuard = true;
      g.stepMul = 1.8;   // a monster's pace
      g.target = p;
      g.guardUntil = this.tickCount + GUARD_STAY;
      this.npcs.push(g);
      out.push(g);
    }
    if (!out.length) return out;
    this.hasTemps = true;
    this._guards = out;
    this._guardReadyAt = this.tickCount + GUARD_COOLDOWN;
    out[0].chatText = 'Halt, villain!'; out[0].chatTimer = 4;
    this.msg(`The town watch knows your face: ${out.length > 1 ? 'two guards close' : 'a guard closes'} in!`, 'combat');
    this.bus.emit('sfx', 'spec');
    return out;
  }

  /** A town guard cut down: their purse is yours, and your name grows darker. */
  _guardSlain(npc) {
    const coins = moralCoins(30, this.fightLevel());
    this.inventory.add('coins', coins);
    this.addEvil(GUARD_EVIL);
    this.msg(`You cut down the ${npc.name} and take ${coins} coins from their purse. (+${GUARD_EVIL} evil karma)`, 'combat');
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
    // Alignment: heroism vs cruelty. Bosses are heroic to slay (+5 good) and
    // aggressive foes a little (+1 good per HERO_KILLS_PER_GOOD, so the moral
    // choice encounters, not grinding, decide your path). Cutting down harmless
    // creatures is neutral (the owner's call: it made grinding a road to Villainy);
    // cutting down the town watch is still evil.
    if (npc.townGuard) this._guardSlain(npc);
    else if (npc.def.boss) this.addGood(5);
    // A spawn tamed for new players (see world.js) is judged by its species'
    // nature: otherwise every kill around the starter town was a harmless one,
    // and a new character on auto battle turned Villain within minutes (and the
    // town watch then set on them each time they woke at the respawn point).
    else if (npc.def.aggressive || npc._spawnOpts?.tamed) {
      if (++this.moral.heroKills >= HERO_KILLS_PER_GOOD) { this.moral.heroKills = 0; this.addGood(1); }
    }
    juiceKill(this, npc);   // it alone freezes for a beat before it falls
    if (npc.def.boss) {
      this.msg(`You have slain ${npc.name}!`, 'combat');
      this.banner(`<span class="big">${npc.name} defeated!</span>The spoils are yours.`);
      this.cine.bossDown(this);   // slow motion and a flash as it falls
    } else if (npc.champion) {
      this.msg(`You have defeated the ${npc.name}! Champions drop extra loot.`, 'level');
      this.addShake(3.5, 260);
    } else {
      this.msg(`You have defeated the ${npc.name}.`, 'combat');
    }
    this.totalKills++;
    this._gainMastery(npc);
    // Kill streak: chain kills (no more than ~30s apart) for a growing XP bonus.
    this.killStreak = (this.tickCount - this._lastKillTick <= STREAK_WINDOW_TICKS) ? this.killStreak + 1 : 1;
    this._lastKillTick = this.tickCount;
    if (this.killStreak > 1 && this.killStreak % 5 === 0) this.msg(`Kill streak ${this.killStreak}! Combat XP +${Math.round(Math.min(STREAK_MAX_BONUS, this.killStreak * STREAK_XP_PER_KILL) * 100)}%.`, 'level');
    this.bus.emit('xpbonus');
    this.kills[npc.npcId] = (this.kills[npc.npcId] || 0) + 1;
    if (!byAlly) { this._gainAdrenaline(this._adrenTrait('kill')); Bless.faithGain(this, 'kill'); }   // kill adrenaline (Gladiators, Berserkers, Sorcerers), and Faith
    // The Holy path: each of your kills heals you a little.
    if (!byAlly && this.player.alive) {
      const kc = this.karmaCombat();
      if (kc.side === 'holy') {
        const heal = Math.min(this.maxHp() - this.player.hp, Math.ceil(this.maxHp() * kc.killHeal));
        if (heal > 0) { this.player.hp += heal; this.bus.emit('hp'); }
      }
    }
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
      this.bossRecord.beat[npc.npcId] = true;   // auto battle will take it on again
      delete this.bossRecord.lost[npc.npcId];
      // A boss kill is a big payday: bonus XP in your combat style and Hitpoints.
      // A late boss's siege (npcs.js bossSiegeScale) lasts longer, so its bonus grows to match.
      const xp = Math.round((npc.def.level || 1) * BOSS_XP_PER_LEVEL * (npc.def.siege || 1) * this.combatXpMult());
      const mode = this.combatMode();
      // The line names what each skill really gained (rested XP, golden hours and all).
      const gain = (s, n) => `+${xpText(this.skills.addXp(s, n))} ${SKILL_BY_ID[s].name}`;
      if (mode === 'dance') {   // a Dancer's bonus is split between Agility and Ranged
        const a = gain('agility', xp / 2), r = gain('ranged', xp / 2), h = gain('hitpoints', Math.round(xp / 3));
        this.msg(`Boss slain! ${a}, ${r} and ${h} XP.`, 'level');
      } else {
        const skill = mode === 'ranged' ? 'ranged' : mode === 'magic' ? 'magic' : 'attack';
        const a = gain(skill, xp), h = gain('hitpoints', Math.round(xp / 3));
        this.msg(`Boss slain! ${a} and ${h} XP.`, 'level');
      }
    }
    if ((npc.def.boss && this.quests.island_defender.state === 'active') ||
        this.quests.big_game_hunter.state === 'active') this.bus.emit('quest');
    const onTask = this.onSlayerTask(npc);   // (the last kill ends the task, so ask first)
    this.progressSlayer(npc);
    this.progressBounties(npc);
    this.checkAchievements();
    this._deathBurst(npc);
    this.rollDrops(npc);
    this.pets.onKill(npc);   // a boss's very rare pet (pets.js)
    Life.lifeOnKill(this, npc, onTask);   // region reputation and the deeds townsfolk talk about
    // Slayer: a task monster sometimes drops a second helping of loot.
    if (onTask && Math.random() < this.slayerBonus().loot / 100) { this.rollDrops(npc); this.msg('Slayer bonus: extra loot!', 'system'); }
    if (npc.worldBoss) { for (let k = 1; k < WORLD_BOSS_LOOT_ROLLS; k++) this.rollDrops(npc); this.msg('World Boss slain! Triple loot.', 'level'); }
    Culling.onKill(this, npc);   // codex mastery, Pest Control contracts, Stewardship, Hunter
    this.worldEvents.onKill(npc, byAlly);   // world event credit, weekly region challenge
    this._refundRunes(npc);
    npc.die();
    if (this.player.target === npc) this.player.target = null;
    // Auto battle moves straight on to the next fight (right after this attack
    // resolves) instead of idling until the next world tick.
    if (this.autoBattle) { this._autoLast = null; this._autoRetarget = true; }
    RQ.onRegionKill(this, npc);
    this.story.onKill(npc);   // lore page drops, lore guardians (story.js)
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
  // (x1.5 at level 1 up to x6 at level 10), and kill streak (+10% per kill, up to +50%).
  // On top, every combat XP gain is paid at COMBAT_XP_RATE (xpBreakdown shows only the bonuses),
  // grown by your fighting level so the climb past the 70s doesn't stall (combatLevelXpMult).
  combatXpMult() { return this.xpBreakdown().total * COMBAT_XP_RATE * combatLevelXpMult(this.fightingLevel()) * this.waves.xpMult(); }
  /** The level of the fighting skill your weapon trains (Melee, Ranged, Magic or the Dancer's pooled level). */
  fightingLevel() {
    const m = this.combatMode();
    return m === 'ranged' ? this.skills.ranged : m === 'magic' ? this.skills.magic : m === 'dance' ? this.skills.danceLevel() : this.skills.attack;
  }
  xpBreakdown() {
    const night = this.isNight() ? 1.5 : 1;
    const wl = this.wildernessLevel();
    const wild = wl ? 1 + WILD_XP_PER_LEVEL * wl : 1;
    const streak = 1 + Math.min(STREAK_MAX_BONUS, this.killStreak * STREAK_XP_PER_KILL);
    const blessed = this.blessedMs > 0 ? BLESS_XP : 1;   // a good deed's blessing (moralEvents.js)
    return { night, wild, wildLevel: wl, streak, streakKills: this.killStreak, blessed, total: night * wild * streak * blessed };
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
  /** The in-game hour, 0-24 (fractional). */
  gameHour() { return this.dayPhase() * 24; }
  /** Life skills whose golden hours are on now (skillhours.js): +50% XP. */
  goldenSkills() { return goldenSkills(this.gameHour()); }
  /** Announce a life skill's golden hours as they begin (one line for several). */
  _checkGoldenHours() {
    const now = goldenSkills(this.gameHour());
    const was = this._goldenWas;
    this._goldenWas = now;
    if (!was) return;   // the first tick only notes what's on
    const opened = now.filter((s) => !was.includes(s));
    // The Skills tab badges follow the clock, but only when the set of skills
    // changes: this used to fire every tick while any golden hour was on,
    // redrawing the Skills and Combat panels so often phone taps landed on
    // buttons that had just been replaced.
    const changed = was.length !== now.length || now.some((s) => !was.includes(s));
    if (changed && !opened.length) this.bus.emit('skills');
    if (!opened.length) return;
    const names = opened.map((s) => SKILL_BY_ID[s]?.name || s).join(' and ');
    const pct = Math.round((GOLDEN_HOUR_XP - 1) * 100);
    this.msg(`Golden hours: ${names} +${pct}% XP for half a day (${opened.map((s) => SKILL_HOURS[s].why).join('; ')}).`, 'level');
    // Several skills can open a few ticks apart: one banner for the burst.
    const t = this.tickCount || 0;
    if (!(t - (this._goldenBannerAt ?? -Infinity) < GOLDEN_BANNER_GAP)) {
      this._goldenBannerAt = t;
      this.banner(`<span class="big">Golden hours</span>${names} +${pct}% XP`);
    }
    this.bus.emit('skills');
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
    if (z && !z.instance && !this.zonesVisited.has(name)) { this.zonesVisited.add(name); this.checkAchievements(); }
    if (name !== this.currentZoneName) {
      this.currentZoneName = name;
      if (wild) {
        this.banner('<span class="big">&#9888; The Wilderness</span>Lawless and deadly &mdash; no safe healing. Beware bosses!');
        this.msg('You enter the Wilderness: combat XP rises the deeper you go (up to x6), but fight or flee!', 'combat');
      } else {
        // Regions with a level band say so, on the scale their monsters show.
        const rec = zoneLevel(z);
        this.msg(rec ? `You enter ${name} (monsters level ${rec}+).` : `You enter ${name}.`, 'system');
        this.cine.enterRegion(name, { sub: rec ? `Monsters level ${rec}+` : '' });
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
    // A champion's loot is CHAMPION_LOOT_KILLS normal kills' worth of its monster.
    // A ranked monster (Wild up to Divine) rolls more times too (rollRankLoot).
    const kills = npc.champion && !def.boss ? CHAMPION_LOOT_KILLS : def.boss ? 1 : rollRankLoot(def);
    if (def.dropTable && def.dropTable.length) {
      // Bosses roll their table ten times and never come up empty; champions roll
      // it once per normal kill they're worth, by a normal monster's rules.
      const rolls = def.boss ? 10 : kills;
      const normal = !def.boss;
      for (let r = 0; r < rolls; r++) {
        let pick = weightedPick(def.dropTable);
        if (def.boss) for (let k = 0; pick.nothing && k < 5; k++) pick = weightedPick(def.dropTable);
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
    const rareChance = def.boss ? 1 : Math.min(0.5, (def.tierLevel || def.level || 1) / 1200 + 0.01);
    // Bosses always hit the rare table five times; champions get a normal kill's chance per kill they're worth.
    for (let rr = 0; rr < (def.boss ? 5 : kills); rr++) if (Math.random() < rareChance) {
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
    // A boss's signature weapon (bossWeapons.js), 1 kill in 5 whatever your class:
    // it is made for one class, so for the rest it's a trophy or something to trade.
    // The strongest bosses also carry an ascended one for another class, rolled on its own.
    if (def.boss) for (const { id: sid, classId } of sigDropsFor(npc.npcId)) if (Math.random() < SIGNATURE_DROP_CHANCE) {
      const nm = getItem(sid).name, who = CLASS_BY_ID[classId]?.name;
      loot.push([sid, 1, 'legendary', 'sig']);
      this.msg(`Signature drop! ${nm} (for ${who})`, 'level');
      this.banner(`<span class="big">Signature drop!</span>${nm} (for ${who})`);
    }
    // A world boss now and then leaves an upgraded gathering tool of its level (bosstools.js).
    const tool = bossToolDrop(npc);
    if (tool) { loot.push(tool); this.msg(`Tool drop! ${getItem(tool[0]).name}.`, 'level'); }
    // Upgrade materials: stones from anything (bosses and champions most), wards from bosses.
    // A late boss's longer siege (npcs.js bossSiegeScale) leaves a bigger pile of
    // stones, wards and scrolls, and a bigger hoard below, so they come as fast per
    // minute; an early boss's shorter fight (siege under 1) a smaller one, but
    // always at least one ward and scroll.
    const siege = def.boss ? def.siege || 1 : 1;
    if (def.boss) loot.push([UP_STONE, Math.round(randInt(20, 50) * siege), 'rare']);
    else {
      const stoneChance = Math.min(0.12, 0.03 + (def.tierLevel || def.level || 1) / 2500);
      let stones = 0;
      for (let k = 0; k < kills; k++) if (Math.random() < stoneChance) stones++;
      if (npc.champion) stones = Math.max(2, stones);   // a champion always leaves a couple
      if (stones) loot.push([UP_STONE, stones, npc.champion ? 'rare' : 'common']);
    }
    if (def.boss) loot.push([UP_WARD, Math.max(1, Math.round(randInt(1, 3) * siege)), 'epic']);
    else if (Math.random() < (npc.champion ? CHAMPION_WARD_CHANCE : 0)) loot.push([UP_WARD, 1, 'epic']);
    // Refine scrolls: rare from monsters, likelier from champions, a few from every boss (see refine.js).
    const scrolls = refineScrollDrop(def.tierLevel || def.level || 1, def.boss ? 'boss' : npc.champion ? 'champion' : 'normal');
    if (scrolls) loot.push([REFINE_SCROLL, Math.max(1, Math.round(scrolls * siege)), def.boss ? 'epic' : 'rare']);
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
        if (l[3] === 'sig') continue;   // a signature weapon stays itself, whoever it's for
        const t = getItem(l[0]).equip?.weaponType;
        if (t && !canWield(this.jobClass, t) && Math.random() < CLASS_LOOT_SHARE) l[0] = equivalentWeapon(l[0], myType);
        // Armour of another class's kind mostly turns into your own kind.
        const fam = getItem(l[0]).equip?.family, mine = ARMOUR_FAMILY[this.jobClass];
        if (fam && mine && fam !== mine && Math.random() < CLASS_LOOT_SHARE) l[0] = equivalentArmour(l[0], mine);
        // Arrows drop as rounds of the same metal for a gun user.
        if (Rounds.classUsesGuns(this.jobClass) && Rounds.roundsForArrow(l[0])) l[0] = Rounds.roundsForArrow(l[0]);
      }
    }
    // Boss hoards: stackables (coins, runes, arrows, seeds...) come in 100x the amount
    // (not upgrade stones, wards or refine scrolls: those are counted as dropped).
    const stackMult = def.boss ? BOSS_STACK_MULT * siege : npc.champion ? CHAMPION_STACK_MULT : 1;
    if (stackMult > 1) for (const l of loot) if (l[0] !== UP_STONE && l[0] !== REFINE_SCROLL && l[0] !== UP_WARD && getItem(l[0]).stackable) l[1] = Math.round(l[1] * stackMult);
    for (const l of loot) if (l[0] === 'coins') l[1] = Math.round(l[1] * COIN_LOOT_MULT);
    // A champion's many rolls: stack repeats of the same stackable into one pile.
    if (kills > 1) {
      const piles = new Map();
      for (let i = loot.length - 1; i >= 0; i--) {
        const l = loot[i];
        if (!getItem(l[0]).stackable) continue;
        const first = piles.get(l[0]);
        if (first) { first[1] += l[1]; loot.splice(i, 1); } else piles.set(l[0], l);
      }
    }
    // Gear quality: the copy that drops keeps it (loot.js), and it multiplies that copy's stats.
    for (const l of loot) {
      if (!getItem(l[0]).equip) continue;
      const q = rollQuality(l[3] === 'boss' || def.boss ? 'boss' : npc.champion ? 'champion' : 'normal');
      const sig = l[3] === 'sig';
      l.length = 3;
      if (!q) continue;
      l[2] = sig ? 'legendary' : QUALITY[q].rarity;
      l[3] = q;
      this._announceQuality(l[0], q);
    }
    Play.trimLoot(this, loot);   // automatic play with no Focus left: a lighter haul
    this.collection.onDrops(npc, loot);   // tick off the Collection log
    this._autoLoot(loot, npc.x, npc.y);
  }

  /** A quality drop is named in its colour (a banner from Legendary up). */
  _announceQuality(id, q) {
    const Q = QUALITY[q];
    this.msg(`${qualityName(id, q)}! ${AOrAn(Q.label)} copy: +${Math.round(Q.gain * 100)}% to its stats.`, `qual-${q}`);
    if (Q.step >= QUALITY.legendary.step) this.banner(`<span class="big">${Q.label} drop!</span>${getItem(id).name}`);
  }

  /** Every kill trains the gear you are wearing: each gear type worn gains
   *  mastery XP (by the monster's level; more for a champion or boss, see
   *  killMastery), and may rank up. Past Ascended only world bosses count.
   *  (Two pieces of one type, such as a pair of daggers, train it once.) */
  _gainMastery(npc) {
    const pts = killMastery(npc), cap = isWorldBoss(npc) ? TOP_XP : BATTLE_CAP;
    const types = new Map();
    for (const s of EQUIP_SLOTS) { const id = this.equipment.get(s); if (id && getItem(id).equip?.bonuses && !types.has(masteryType(id))) types.set(masteryType(id), id); }
    if (!types.size) return;
    for (const id of types.values()) this._addMastery(id, pts, cap);
    this.equipment._changed();
  }

  /** Add mastery XP to `id`'s gear type, but not past `cap` (XP already past
   *  it stays), announcing a new rank (with a banner from Master up). Kills,
   *  sacrifices and fed materials all come through here. */
  _addMastery(id, pts, cap = TOP_XP) {
    const before = this.equipment.masteryRank(id), have = this.equipment.masteryXp(id);
    if (have >= cap) return;
    this.equipment.setMastery(id, Math.min(cap, have + pts));
    const after = this.equipment.masteryRank(id);
    if (after > before) {
      const R = MASTERY_RANKS[after], type = masteryTypeName(id);
      this.msg(`${type} mastery reached ${R.name}!`, 'level');
      if (after >= BANNER_RANK) this.banner(`<span class="big">${R.name} mastery!</span>${type}`);
    }
  }

  /** Auto-loot: drops go straight into the pack; whatever won't fit falls to the ground. */
  // MapleStory-style loot: drops pop out onto the ground in a little fan,
  // then (next tick) fly into your pack wherever you are.
  _autoLoot(loot, x, y) {
    let best = 'common';
    loot.forEach(([id, qty, rarity = 'common', q], i) => {
      const gi = this.world.addGroundItem(id, qty, x, y);
      if (q) gi.q = q;   // a quality copy keeps its quality all the way into the pack
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
    // The bag is told once, after the sweep: a busy fight's dozens of drops a
    // tick each had every bag listener rescan the whole (late-game, huge) pack.
    const held = this.inventory.hold();
    try {
      for (const gi of [...this.world.groundItems]) {
        if (gi.playerDropped) continue;                     // things you drop stay dropped
        // Kill drops fly in once their (rarity-based) delay is up, wherever you are;
        // anything else is swept up when you're within 2 tiles.
        if (gi.fromKill ? this.tickCount < gi.lootAt : chebyshev(at.x, at.y, gi.x, gi.y) > 2) continue;
        const added = this.inventory.add(gi.id, gi.qty, gi.q);
        if (added <= 0) continue;
        const rar = RARITY[gi.rarity];
        if (rar && rar.rank > 0) special = true;
        got.push(`${added > 1 ? added + ' x ' : ''}${qualityName(gi.id, gi.q)}${rar && rar.rank > 0 && !gi.q ? ` (${rar.label})` : ''}`);
        const c = p.renderCenter();
        this.effects.push({ type: 'lootfly', id: gi.id, rarity: gi.rarity, x: gi.x * TILE + TILE / 2 + (gi.ox || 0), y: gi.y * TILE + TILE * 0.62 + (gi.oy || 0), ex: c.x, ey: c.y - 10, life: 420, maxLife: 420 });
        this.world.removeGroundItem(gi);
      }
    } finally { if (held) this.inventory.release(); }
    if (got.length) { this.msg(`You loot: ${got.join(', ')}.`, special ? 'level' : 'game'); this.bus.emit('sfx', 'pickup'); }
  }

  _holdsClue() { return this.inventory.slots.some((s) => s && s.id.startsWith('clue_scroll_')); }

  // ---------------- New skills: Prayer, Thieving, Agility ----------------
  /** Bury bones from a stack (any kind): 100 at a time by default, or `count` (Infinity = the whole stack).
   *  Offering at an A-Worthy Monument (`altar`) pays ALTAR_XP_MULT x. Each bone also restores a little Faith. */
  buryBones(index, count = BURY_BATCH, altar = false) {
    const s = this.inventory.slotAt(index);
    if (!s || !isBone(s.id)) { this.msg('You can only bury bones.'); return 0; }
    if (altar && !this.nearShrine()) { this.msg('You need to be at an A-Worthy Monument to offer bones.'); return 0; }
    const it = getItem(s.id), n = Math.min(s.qty, count);
    this.inventory.removeAt(index, n);
    this.skills.addXp('prayer', boneXp(s.id) * n * (altar ? ALTAR_XP_MULT : 1));
    // Only the first few bones of a click restore Faith, so a big stack can't stand in for a monument mid-fight.
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
    if (!npc.def.role || npc.def.moral) { this.msg("You can't pickpocket that."); return; }   // an encounter is a choice, not a mark
    this.beginAction({ type: 'thieve', npc, target: { x: npc.x, y: npc.y } }, { x: npc.x, y: npc.y }, true);
  }

  pickpocket(npc) {
    if (!npc || !npc.def.role) return;
    const lvl = this.skills.level('thieving');
    // A mark (the endgame marks: def.thieving) has a level and a loot table of
    // its own, rolled once a pick like a stall's; its XP is fixed, not by level.
    const t = npc.def.thieving;
    if (t) {
      if (lvl < t.level) { this.msg(`You need Thieving level ${t.level} to pick the ${npc.name}'s pocket.`, 'system'); return; }
      const pick = weightedPick(t.loot);
      const qty = pick.min ? randInt(pick.min, pick.max) : 1;
      this.inventory.add(pick.id, qty);
      this.collection.onGather('thieve', pick.id, qty);
      this.skills.addXp('thieving', t.xp);
      this.addEvil(1); // theft tips you toward evil
      this.spawnSparkle(this.player, '#ffe24a', 6);
      this.msg(`You pick the ${npc.name}'s pocket and steal ${qty > 1 ? qty + ' x ' : ''}${getItem(pick.id).name}.`, 'system');
      return;
    }
    // Pickpocketing never fails any more (life skills never fail).
    {
      const coins = randInt(3, 12) + Math.floor(lvl * 1.5);
      this.inventory.add('coins', coins);
      // XP grows with level only up to 99; past that the life-skill rate in
      // addXp takes over (it used to keep growing, on top of the steeper curve).
      this.skills.addXp('thieving', pickpocketXp(lvl));
      this.addEvil(1); // theft tips you toward evil
      this.spawnSparkle(this.player, '#ffe24a', 6);
      this.msg(`You pick the ${npc.name}'s pocket and steal ${coins} coins.`, 'system');
    }
  }

  resolveAgility(obj) {
    const d = obj.def;
    if (d.level && this.skills.level('agility') < d.level) {
      this.msg(`You need Agility level ${d.level} for the ${d.name}.`, 'system');
      return false;
    }
    // A course obstacle can't be crossed again until the rest of the lap is
    // done (standing on one used to repeat it every tick).
    const course = d.markChance !== undefined ? this._agilityCourse(obj) : null;
    if (course && this._agilityLap.has(obj.uid)) {
      this.msg(`You've done the ${d.name.toLowerCase()} this lap. Run the rest of the course first.`, 'system');
      return false;
    }
    const lvl = this.skills.level('agility');
    const xpScale = this.agilityXpScale(lvl);
    this.skills.addXp('agility', (d.xp || 18) * xpScale);
    this.runEnergy = Math.min(100, this.runEnergy + 8);
    this.bus.emit('run');
    this.spawnPoof(obj.x * TILE + TILE / 2, obj.y * TILE + TILE / 2 - 6, '#8fd6ff');
    if (!course) return true;   // a lone obstacle is a lap of its own: keep training

    // Course lap tracking: a lap is every obstacle of the course you have the
    // level for, once each, in any order.
    this._agilityLap.add(obj.uid);
    let mark = Math.random() < d.markChance;
    const usable = course.filter((o) => !o.def.level || lvl >= o.def.level);
    const left = usable.filter((o) => !this._agilityLap.has(o.uid));
    if (!left.length) {
      this._agilityLap.clear();
      if (usable.length === course.length) {
        // A full lap: a bonus worth 60% of the last obstacle, and a guaranteed
        // mark. (Below the level for every obstacle you just go round again.)
        this.skills.addXp('agility', Math.round((d.xp || 30) * 0.6 * xpScale));
        mark = true;
        this.msg('You complete a lap of the course!', 'system');
      }
    }
    if (mark) {
      this.inventory.add('mark_of_grace', 1);
      this.spawnSparkle(this.player, '#5fd0a0', 8);
      this.msg('You find a Mark of grace.', 'system');
    }
    // Head on to the nearest obstacle still to do (with auto gather on, start
    // the next lap too); otherwise stop here.
    const next = left.length ? left : (this.autoGather ? usable : []);
    const p = this.player;
    const to = next.reduce((a, o) => (!a || chebyshev(p.x, p.y, o.x, o.y) < chebyshev(p.x, p.y, a.x, a.y) ? o : a), null);
    if (to === obj) return true;   // a new lap starts right here
    return to ? this.beginAction({ type: 'agility', obj: to }, { x: to.x, y: to.y }, true) : false;
  }

  /** The XP multiplier on an obstacle's listed XP at an Agility level: grows
   *  with level up to 99, then follows the life-skill rate past 99. */
  agilityXpScale(lvl) {
    return AGILITY_XP_MULT * (1 + Math.min(lvl, AGILITY_XP_LEVEL_CAP) / AGILITY_XP_DIV) * pastCapXpMult(lvl);
  }

  /** The obstacles of the course `obj` belongs to: every Mark-of-grace obstacle
   *  near it (worked out once per obstacle; the world's objects never move). */
  _agilityCourse(obj) {
    const m = (this._courses ||= new Map());
    if (!m.has(obj.uid)) m.set(obj.uid, this.world.objects.filter((o) => o.def.type === 'agility' &&
      o.def.markChance !== undefined && chebyshev(o.x, o.y, obj.x, obj.y) <= 12));
    return m.get(obj.uid);
  }

  /** Trade Marks of grace for Agility XP: each is worth MARK_XP_CROSSINGS zip-line
   *  crossings' listed XP (a fixed amount). Trades the whole stack by default. */
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
    return MARK_XP;
  }

  // ---------------- Thieving: market stalls ----------------
  /** One attempt at a stall. Given the stall action `a`, a success keeps you
   *  at the stall, waiting quietly for it to restock and stealing again, until
   *  you're caught or move off. */
  stealFromStall(obj, a = null) {
    const d = obj.def;
    if (obj.depleted) {
      if (a?.stealing) return true;   // wait for the restock
      this.msg('The stall has nothing left — wait for it to restock.', 'system'); return false;
    }
    const lvl = this.skills.level('thieving');
    if (d.level && lvl < d.level) { this.msg(`You need Thieving level ${d.level} to steal from the ${d.name}.`, 'system'); return false; }
    // Success scales with level over the stall's requirement, from a half at
    // that level (or the stall's own `sure`: the endgame chests are surer, so
    // a new tier doesn't start far behind the one before it).
    const chance = stallChance(d, lvl);
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
      if (a) { a.stealing = true; return true; }
    } else {
      const dmg = randInt(1, 3);
      this.player.takeDamage(dmg); this.addHitsplat(this.player, dmg); this.bus.emit('hp');
      this.playerStun = STALL_STUN_TICKS;
      this.msg(`You're caught stealing from the ${d.name} and are stunned!`, 'combat');
      if (this.player.hp <= 0) this.playerDeath();
    }
    return false; // caught (or a one-off attempt): stop
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
      this.collection.record(`clue:${s.id.replace('reward_casket_', '')}`, pick.id, q);
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
   *  (one of the few nearest your fight level) rises 8-14 tiles away:
   *  5x its life, 2x its hits, 1.5x attack and defence, aggressive from far off
   *  at any level. It never respawns, and leaves after WORLD_BOSS_STAY ticks
   *  unless you're fighting it. */
  _tickWorldBoss() {
    const wb = this._worldBoss;
    if (wb && wb.alive && this.tickCount > wb.worldBossUntil && wb.target !== this.player) {
      this.msg(`${wb.name} fades back into the wilds.`, 'system');
      this.npcs = this.npcs.filter((n) => n !== wb); this._worldBoss = null;
    } else if (wb && wb.alive && this._worldBossInTown(this.player.x, this.player.y)) {
      // Retreating into town is safe: it won't follow you in and fight there.
      this.msg(`${wb.name} loses your trail and fades back into the wilds.`, 'system');
      if (this.player.target === wb) this.player.target = null;
      this.npcs = this.npcs.filter((n) => n !== wb); this._worldBoss = null;
    }
    if (this.tickCount % WORLD_BOSS_EVERY !== 0 || this._worldBoss || !this.player.alive || this.waves.active) return;
    // Not for players who couldn't beat even an ordinary boss yet: it would only
    // hunt them down again and again (the same check auto battle uses).
    if (!this._worldBossFair()) return;
    // Nor for new players (a couple of quests and some levels first), nor in town.
    const done = QUESTS.filter((def) => this.quests[def.id]?.state === 'done').length;
    if (done < WORLD_BOSS_MIN_QUESTS || this.fightLevel() < WORLD_BOSS_MIN_LEVEL) return;
    if (this._worldBossTooNearTown(this.player.x, this.player.y)) return;
    return this.spawnWorldBoss();
  }

  /** True for tiles in or within WORLD_BOSS_TOWN_GAP of a town (the starting
   *  towns and every outer town) or a bank: a World Boss never rises there (or
   *  near you while you stand there). Measured from each town's edges, since
   *  the bigger towns reach well past 20 tiles from their bank. */
  _worldBossTooNearTown(x, y) {
    const g = WORLD_BOSS_TOWN_GAP;
    if (this._worldBossTowns().some(([a, b, c, d]) => x >= a - g && x <= c + g && y >= b - g && y <= d + g)) return true;
    this._bankSpots ??= this.world.objects.filter((o) => o.objId === 'bank_booth');
    return this._bankSpots.some((b) => Math.abs(b.x - x) <= g && Math.abs(b.y - y) <= g && Math.hypot(b.x - x, b.y - y) <= g);
  }

  /** True when standing in a town itself (no margin): a World Boss gives up there. */
  _worldBossInTown(x, y) {
    return this._worldBossTowns().some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
  }

  /** Town rectangles [x0, y0, x1, y1]: the starting towns' zones plus the outer towns (worked out once). */
  _worldBossTowns() {
    return this._wbTowns ??= [
      ...this.world.zones.filter((z) => WORLD_BOSS_SAFE_ZONES.includes(z.name)).map((z) => [z.x0, z.y0, z.x1, z.y1]),
      ...(this.world.towns || []),
    ];
  }

  /** True when you could beat at least one ordinary (non-story) boss. */
  _worldBossFair() {
    return ALL_BOSS_IDS.some((id) => {
      let d; try { d = getNpc(id); } catch { return false; }
      return d.boss && !d.fixed && d.attackable && this._autoCanBeat({ def: d, hp: d.maxHp || 1 });
    });
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
    // One of the three bosses nearest your level: picking from everything at or
    // above it sent bosses thousands of levels too strong. Bosses you could beat
    // in their normal form come first (the auto battle check); the rest only if none.
    const lvl = (id) => getNpc(id).level || 1;
    const beatable = ids.filter((id) => { const d = getNpc(id); return this._autoCanBeat({ def: d, hp: d.maxHp || 1 }); });
    const pool = (beatable.length ? beatable : ids).slice().sort((a, b) => Math.abs(lvl(a) - cl) - Math.abs(lvl(b) - cl)).slice(0, 3);
    const id = pool[Math.floor(Math.random() * pool.length)];
    // A walkable tile 8-14 tiles from you, and not in or near a town.
    let spot = null;
    for (let tries = 0; tries < 60 && !spot; tries++) {
      const ang = Math.random() * Math.PI * 2, r = 8 + Math.random() * 6;
      const x = Math.round(p.x + Math.cos(ang) * r), y = Math.round(p.y + Math.sin(ang) * r);
      if (this.world.inBounds(x, y) && !this.world.isBlocked(x, y) && !this._worldBossTooNearTown(x, y)) spot = { x, y };
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
  /** Auto battle's hiring: only to keep the contracts filled up to the cap, and
   *  only while a reserve of three hires' worth of coins is left. */
  _autoHire() {
    if (Mercs.activeMercs(this).length >= Mercs.MAX_MERCS || this.inventory.count('coins') < Mercs.hireCost(this) * 3) return null;
    return this.hireMercenary();
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
        case 'stun': break;   // bosses never stun you (the owner asked for it gone), even from an old move list
        case 'root': this.playerRoot = Math.max(this.playerRoot, fx.ticks); p.path = []; this.msg('You are held in place!', 'combat'); break;
        case 'pull': this._movePlayerNear(npc.x, npc.y, 1); break;
        case 'knock': break;   // bosses no longer throw you back (the owner asked for it gone); the rest of the move still lands
        case 'blink': {
          const t = this._nearestFree(p.x + (Math.sign(npc.x - p.x) || 1), p.y);
          if (t) { npc.x = npc.tx = t.x; npc.y = npc.ty = t.y; npc.path = []; this.spawnPoof(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, ab.color || '#ffffff'); }
          break;
        }
        case 'heal': if (npc.healCapped(npc.maxHp * fx.frac) > 0) this.spawnSparkle(npc, '#5fe08a', 10); break;   // capped by recent damage (see NPC.healCapped)
        case 'shield': break;   // bosses no longer shield themselves (the owner asked for it gone)
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

  /** Each world tick: damage over time on the player, root countdown, boss reflect timers. */
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
      if (n.reflectTicks > 0) n.reflectTicks--;
      if (!n.alive || !(n.reflectTicks > 0)) this._buffedBosses.delete(n);
    }
  }

  /** Is this tile inside any pending boss attack? */
  hazardAt(x, y) {
    return this.hazards.some((h) => inHazard(h, x, y));
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
      if (inHazard(h, t.x, t.y)) {   // (a safe circle's green hole is safe)
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
        this._dodgeXp(h.npc, HAZARD_DODGE_MULT);
        this.msg(`You dodge ${h.npc.name}'s attack!`, 'combat');
      }
    }
    this.hazards = p.alive ? keep : [];
  }

  playerDeath() {
    // A brew that saves you from death (the phoenix elixir), while it runs:
    // back on your feet with part of your life, and the brew is used up.
    const saver = Object.keys(this.potions).find((id) => POTIONS[id].revive);
    if (saver && this.player.alive) {
      delete this.potions[saver];
      this.player.hp = Math.max(1, Math.round(this.maxHp() * POTIONS[saver].revive));
      this.msg(`Your ${POTIONS[saver].name.toLowerCase()} flares up and you rise from the ashes!`, 'level');
      this.spawnSparkle(this.player, POTIONS[saver].color, 18);
      this.bus.emit('hp'); this.bus.emit('potions');
      return;
    }
    this.msg('Oh dear, you are dead!', 'combat');
    // Killed by a boss you hadn't beaten yet: auto battle steers clear of it for a while.
    {
      const p0 = this.player, a = p0.action;
      const boss = (a?.type === 'attack' && a.npc?.def.boss && a.npc) || this.nearbyNpcs().find((n) => n.alive && n.def.boss && n.target === p0);
      if (boss && !boss.wave && !this.bossRecord.beat[boss.npcId]) {   // (an Endless Gate boss is the wave's, not the boss's record)
        this.bossRecord.lost[boss.npcId] = this.fightLevel();
        this.msg(`Auto battle will leave ${boss.name} alone until you are ${BOSS_RETRY_LEVELS} fight levels stronger.`, 'system');
      }
    }
    this._dodging = false;
    this.killStreak = 0; this.bus.emit('xpbonus');
    const gate = this.waves.active;   // in the Endless Gate you rise by its shrine, and auto battle fights on
    if (this.autoBattle && !gate) this.toggleAutoBattle(false);
    this._autoBossTrip = null;
    if (this.autoQuest) this.toggleAutoQuest(false, 'you died.');
    this.banner(`<span class="big">Oh dear, you are dead!</span>${gate ? 'Rising at the shrine...' : 'Respawning in town...'}`);
    const p = this.player;
    p.alive = false;
    p.respawnTimer = RESPAWN_TICKS;
    p.stopNow();
    p.clearAction();
    for (const n of this.npcs) if (n.target === p) { n.target = null; }
    // A World Boss that beat you leaves rather than waiting by the respawn point.
    const wb = this._worldBoss;
    if (wb) {
      if (wb.alive) this.msg(`${wb.name} fades back into the wilds.`, 'system');
      this.npcs = this.npcs.filter((n) => n !== wb); this._worldBoss = null;
    }
    Play.onDeath(this);   // a gravestone holds part of your pack until you walk back for it
    // Falling in the Endless Gate: you rise by its shrine a little later, and the run goes on (waves.js).
    this._respawnAt = this.waves.onDeath();
    this.worldEvents.onDeath();   // a world event is called off (and packed away)
    this.story.onDeath();   // ...and so is a story event or scene
    this.ui?.closeModal();
  }

  respawnPlayer() {
    const p = this.player;
    const back = this._respawnAt && this._nearestFree(this._respawnAt.x, this._respawnAt.y);
    this._respawnAt = null;
    const rp = back || this.world.respawnPoint;
    p.alive = true;
    p.hp = this.maxHp();
    p.x = p.tx = rp.x;
    p.y = p.ty = rp.y;
    p.progress = 0;
    p.moving = false;
    p.path = [];
    this.regenCounter = 0;
    this.msg(back ? (this.waves.active ? 'You rise again beside the A-Worthy Shrine.' : 'You wake up outside the Endless Gate.') : `You wake up back in ${this.world.townName}.`, 'system');
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
    else { this._questBoss = false; this._dodging = false; }   // a quest's boss hunt (and any dodge) ends with auto battle
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
    // 0a. A Merchant in a fight keeps their mercenaries topped up (see _autoHire).
    if (this.jobClass === 'merchant' && p.action?.type === 'attack' && p.action.npc?.alive) this._autoHire();
    if (this._autoResume) {
      const n = this._autoResume;
      this._autoResume = null;
      if (n.alive) { this.attackNpc(n); return; }
    }
    // 1. Stay alive: eat below the chosen life level, or Second Wind when out of food.
    //    With a crowd on you, eat sooner: once their blows together could take
    //    what you have left (up to EAT_CROWD_CAP of your life). A fresh Rogue on
    //    30 life with four level 35-40 monsters on it went from 13 to dead in one
    //    tick, its food untouched.
    if (this.autoCfg.eatAt > 0 && p.hp <= Math.max(this.maxHp() * this.autoCfg.eatAt,
      Math.min(this.maxHp() * EAT_CROWD_CAP, this._autoCrowdBlow()))) {
      // The biggest dish that the missing life can take whole (else the smallest):
      // eating the first slot meant a kaya toast (3 life) mid-crowd with chicken
      // rice (9) still in the bag.
      const miss = this.maxHp() - p.hp;
      let idx = -1, best = 0;
      this.inventory.slots.forEach((sl, i) => {
        const h = sl && getItem(sl.id).heal;
        if (!h) return;
        const score = h <= miss ? h : -h;   // fits: bigger is better; overheals: smaller is better
        if (idx === -1 || score > best) { idx = i; best = score; }
      });
      if (idx !== -1) this.eatItem(idx);
      else this._autoAbility((ab) => ab.kind === 'heal');
    }
    // 1a. Run from a monster far above you that you'd lose to (see _autoFlee).
    if (this._autoFlee()) return;
    // 1b. Step out of a boss's ground marker, still fighting (see _autoDodge).
    this._autoDodge();
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
      // Auto quest leads: on its hunt, drop a monster it doesn't want (unless
      // it is attacking you); on any other step, only fight back.
      if (this.autoQuest && tgt.target !== p && !this._questWants(tgt)) {
        this._autoLast = null; this._autoFight = null; p.clearAction(); return;
      }
      if (this.tickCount - f.since > 20 || this.tickCount - f.chase > 25) {
        this._autoSkip.set(tgt.entityId, this.tickCount + 60);
        this._autoLast = null; this._autoFight = null;
        p.clearAction();
        return;
      }
      // A boss mechanic: interrupt its cast, turn on its healers (bossmech.js).
      const heal = mechAutoFight(this, tgt, f);
      if (heal) { this._autoFight = null; this._autoLast = heal; this.attackNpc(heal); return; }
      // In the Endless Gate, a monster striking the shrine draws you off one that
      // isn't (one fighting you near the shrine is fought out: you're defending it).
      if (this.waves.active && this.tickCount % 3 === 0 && !this.waves.besieging(tgt) && !tgt.mech
        && (tgt.target !== p || this.waves.shrineDist(p) > Math.max(4, this.attackRange())) && this.nearbyNpcs().some((n) => this.waves.besieging(n))) {
        const up = this._autoPickTarget();
        if (up && up !== tgt && this.waves.besieging(up)) { this._autoFight = null; this._autoLast = up; this.attackNpc(up); return; }
      }
      // "Bosses & champions first" holds mid-fight too: when one you'd take on
      // turns up within reach of an ordinary fight, switch to it (checked every
      // few ticks, and only when one is actually near).
      if (this.autoCfg.priority !== false && !tgt.def.boss && !tgt.champion && !tgt.mechHealer && this.tickCount % 3 === 0
        && this.nearbyNpcs().some((n) => n !== tgt && n.alive && n.attackable && (n.def.boss || n.champion)
          && chebyshev(p.x, p.y, n.x, n.y) <= Math.max(12, this.attackRange() + 2))) {
        const up = this._autoPickTarget();
        if (up && up !== tgt && (up.def.boss || up.champion) && chebyshev(p.x, p.y, up.x, up.y) <= Math.max(12, this.attackRange() + 2)) {
          this._autoFight = null; this._autoLast = up; this.attackNpc(up); return;
        }
      }
      // Still chasing a target that isn't fighting back while something else is
      // already hitting you from within reach: turn and deal with that first.
      if (!inRange && tgt.target !== p) {
        const att = this.nearbyNpcs().find((n) => n !== tgt && n.alive && n.attackable && !n.ally && n.target === p
          && chebyshev(p.x, p.y, n.x, n.y) <= Math.max(1, this.attackRange()));
        if (att) { this._autoFight = null; this._autoLast = att; this.attackNpc(att); return; }
      }
      // Bows and spells: a target that has wandered out of reach isn't chased
      // while another can be shot from right here (checked every other tick).
      if (!inRange && this._holdsGround() && !tgt.def.boss && this.tickCount % 2 === 0) {
        const up = this._autoPickTarget();
        if (up && up !== tgt && chebyshev(p.x, p.y, up.x, up.y) <= this.attackRange()) {
          this._autoFight = null; this._autoLast = up; this.attackNpc(up); return;
        }
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
    // Auto quest leads. On a step that isn't a fight (talking, gathering,
    // crafting, walking somewhere) auto battle only answers monsters attacking
    // you, and never wanders off to "monsters of your level" or to bosses.
    // In the Endless Gate: fight the wave, and nothing else. There is no way out
    // on foot, so no trips to quests, bosses or monsters of your level elsewhere.
    if (this.waves.active) {
      const t = this._autoPickTarget();
      if (t) { this._autoLast = t; this._autoIdleSaid = false; this.attackNpc(t); }
      return;
    }
    if (this.autoQuest && !this._autoQuestFight) {
      const att = this.nearbyNpcs().find((n) => n.alive && n.attackable && !n.ally && n.target === p
        && chebyshev(p.x, p.y, n.x, n.y) <= Math.max(2, this.attackRange() + 1));
      if (att) { this._autoLast = att; this.attackNpc(att); }
      return;
    }
    // Between fights, hurt and with nothing on you: patch up before the next one
    // (food, else a healing skill as it comes off cooldown) instead of starting
    // it hurt. Without this a level 40 Archer took on lizard after lizard, each
    // costing it more life than it had won back, until one killed it.
    if (this.autoCfg.eatAt > 0 && p.hp < this.maxHp() * REST_AT
      && !this.nearbyNpcs().some((n) => n.alive && n.target === p && !(this._autoRanFrom(n) && chebyshev(p.x, p.y, n.x, n.y) > 2))) {
      const miss = this.maxHp() - p.hp;
      const idx = this.inventory.slots.findIndex((sl) => sl && getItem(sl.id).heal && getItem(sl.id).heal <= miss);
      if (idx !== -1) { this.eatItem(idx); return; }
      if (this._autoAbility((ab) => ab.kind === 'heal')) return;
      if (this.currentAbilities().some((ab) => ab.kind === 'heal' && this.abilityUnlocked(ab))) return;   // wait for it
    }
    let target = this._autoPickTarget();
    // On a trip to a boss: only stop for the boss, a champion or something
    // attacking you, not every monster along the way.
    const trip = this._autoBossTrip;
    if (trip && (!trip.npc.alive || this.tickCount > trip.until)) this._autoBossTrip = null;
    if (this._autoBossTrip && target && !target.def.boss && !target.champion && target.target !== p) {
      if (p.isMoving) return;
      target = null;
    }
    // "Bosses & champions first", and none in reach: go and find a boss on the map.
    if (!(target && (target.def.boss || target.champion)) && this._autoSeekBoss()) return;
    const weakPick = target && this._autoIsWeak(target);
    if ((!target || weakPick) && this._autoTravel && p.isMoving) return;   // still on the way
    this._autoTravel = null;
    if ((!target || weakPick) && this.tickCount >= (this._autoHeadNext || 0)) {
      // A quest or Slayer hunt goes after its own monsters, wherever they are;
      // "monsters of your level" would be ones the hunt won't let you fight.
      // (On auto quest's other fight steps, the nearest monster of any kind;
      // its boss trips find their own way.)
      if (this._questFamily || this._questTarget || (this.autoQuest && !this._questBoss) ? this._autoHeadToQuestHunt()
        : !this.autoQuest && this.autoCfg.priority !== 'only' && this._autoHeadToLevel()) return;   // (auto quest's boss trips find their own way; "only" doesn't wander to ordinary monsters)
      this._autoHeadNext = this.tickCount + 10;   // no route found: look again in a few seconds, not every tick
    }
    if (target) { this._autoLast = target; this._autoIdleSaid = false; this.attackNpc(target); }
    else if (!this._autoIdleSaid) {
      this._autoIdleSaid = true;
      this.msg(this.autoCfg.priority === 'only' ? 'Auto battle: no champions or bosses you can take on nearby. It waits here and picks up when one appears.'
        : 'Auto battle: nothing to fight nearby. Walk somewhere wilder and it will pick up again.', 'system');
    }
  }

  /** Auto battle runs from a fight it would lose: the monsters on you would
   *  empty your life (food included) well before you could kill them all. A
   *  champion or a monster far above you (see _farAbove) is run from whenever
   *  that is so; ordinary ones only once you're below FLEE_HURT of your life.
   *  You run out past their leash, where they give up and go home. Fighting on
   *  got a level 51 Archer killed by a level 111 tarantula that came for it
   *  unprovoked, and a level 40 one by a level 40 lizard it couldn't outlast.
   *  True while running. */
  _autoFlee() {
    const p = this.player, f = this._fleeing;
    if (f && this.tickCount < f.until && p.isMoving && f.foes.some((n) => n.alive && n.target === p)) return true;
    this._fleeing = null;
    const foes = this.nearbyNpcs().filter((n) => n.alive && n.target === p && !n.def.boss && !n.wave && !n.temporary
      && chebyshev(p.x, p.y, n.x, n.y) <= 8);
    if (!foes.length) return false;
    // A champion only counts when it is the danger itself: not one you could
    // take on (see _autoChampionOk), not one you chose to fight, and not a weak
    // one in a crowd. Running at full life from a level 9 champion with a few
    // ordinary monsters about, again and again, was most of auto battle's walking.
    const chosen = p.action?.type === 'attack' ? p.action.npc : null;
    const strong = foes.some((n) => this._farAbove(n) || (n.champion && n !== chosen && this._autoChampionDanger(n)));
    if (!strong && p.hp >= this.maxHp() * FLEE_HURT) return false;
    let dps = 0, kill = 0;
    for (const n of foes) {
      const t = this._autoFightTimes(n);
      if (!t) return false;
      dps += t.theirDps; kill += t.myTime;
    }
    let food = 0;
    for (const sl of this.inventory.slots) if (sl && getItem(sl.id).heal) food += getItem(sl.id).heal * (sl.qty || 1);
    if ((p.hp + food) / Math.max(0.01, dps) >= kill * FLEE_MARGIN) return false;
    // Away from their homes, to just past where the last stops chasing: straight
    // away if it can, else bending off to the side (backed against the sea at
    // the map's edge, running straight on found nowhere to go, and a Berserker
    // stood and died to a level 101 jellyfish).
    let sx = 0, sy = 0, far = 0;
    for (const n of foes) { sx += n.spawnX / foes.length; sy += n.spawnY / foes.length; far = Math.max(far, (n.wander || 0) + AGGRO_FORGET_TILES + 3); }
    const away = Math.atan2(p.y - sy, p.x - sx);
    let path = null;
    for (const turn of [0, 1, -1, 2, -2, 3, -3]) {
      const a = away + turn * Math.PI / 4;
      const tx = Math.max(0, Math.min(this.world.width - 1, Math.round(sx + Math.cos(a) * far)));
      const ty = Math.max(0, Math.min(this.world.height - 1, Math.round(sy + Math.sin(a) * far)));
      const to = this._nearestFree(tx, ty);
      // Clamped to the map, it may no longer be past their leash.
      if (!to || foes.some((n) => chebyshev(to.x, to.y, n.spawnX, n.spawnY) <= (n.wander || 0) + AGGRO_FORGET_TILES)) continue;
      path = findPath(this.pathCfg(), this.playerTile(), to, { maxNodes: 20000 });
      if (path?.length) break;
    }
    if (!path?.length) return false;
    p.setPath(path, this.canRun()); p.clearAction();
    for (const n of foes) { this._autoSkip.set(n.entityId, this.tickCount + 200); this._autoFled.set(n.entityId, this.tickCount + 200); }
    // Keep away from what it ran from for a while (see _autoNearDanger): going
    // back for the monsters beside it woke it again, and round it went.
    const danger = foes.filter((n) => this._farAbove(n) || n.champion);
    this._autoDanger = (danger.length ? danger : foes).map((n) => ({ n, until: this.tickCount + 200 }));
    this._fleeing = { foes, until: this.tickCount + 60 };
    this.msg(`Auto battle: ${foes.length > 1 ? 'that fight is' : `${foes[0].name} is`} too much for you, so you run for it.`, 'system');
    return true;
  }

  /** A champion worth running from: one you couldn't take on whose own blows
   *  would empty your life in under CHAMPION_SAFE_SECS. */
  _autoChampionDanger(n) {
    if (this._autoChampionOk(n)) return false;
    const t = this._autoFightTimes(n);
    return !t || t.theirTime < CHAMPION_SAFE_SECS;
  }

  /** Is this spot within reach of a monster auto battle ran from lately (its
   *  aggro range and a few tiles more)? Picks there are passed over. */
  _autoNearDanger(x, y) {
    const list = this._autoDanger;
    if (!list?.length) return false;
    for (const { n, until } of list) {
      if (until > this.tickCount && n.alive && chebyshev(x, y, n.x, n.y) <= (n.def.aggroRange || 4) + 3) return true;
    }
    return false;
  }

  /** Has auto battle run from this monster lately (see _autoFlee)? */
  _autoRanFrom(n) { return (this._autoFled.get(n.entityId) || 0) > this.tickCount; }

  /** The biggest blows the monsters on you could land together (their max
   *  hits), counting those close enough to strike. */
  _autoCrowdBlow() {
    const p = this.player;
    let sum = 0;
    for (const n of this.nearbyNpcs()) {
      if (n.alive && n.target === p && chebyshev(p.x, p.y, n.x, n.y) <= 2) sum += n.def.maxHit || 0;
    }
    return sum;
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

  /** Does auto battle fight from where you stand (bows, guns, thrown coins and
   *  shurikens, spells) rather than walk up to each foe? */
  _holdsGround() {
    const m = this.combatMode();
    return m === 'ranged' || m === 'magic';
  }

  /** A pick auto battle would rather walk past: an ordinary monster well below
   *  your level that isn't fighting you (bosses, champions, attackers, a chosen
   *  monster type or a quest hunt always count). */
  _autoIsWeak(n) {
    if (n.wave || n.def.boss || n.champion || n.target === this.player || this.autoCfg.target || this._questTarget || this._questFamily) return false;
    const inWild = !!this.world.zoneAt(this.player.x, this.player.y)?.wilderness;
    return (n.def.level || 1) < this._autoBandLo(inWild);
  }

  /** Could you beat this boss, so auto battle (or a quest's boss step) may pick
   *  the fight? First the quick check: no more than about a quarter above your
   *  fight level. Then a rough time-to-kill from both sides: your average hits
   *  must empty its life within about 30 minutes (boss fights are long), and its
   *  average hits must take at least 20 seconds to empty yours, which healing,
   *  lifesteal and food then hold off. Both sides are rough (specials and heals
   *  are left out) and lean towards leaving a boss alone. */
  _autoCanBeat(n) {
    const cl = this.fightLevel(), def = n.def;
    // Learn from results: the quick guess below can't see a boss's signature
    // moves, which do most of the killing. A boss you've beaten is fair game
    // from then on; one that killed you waits until you're BOSS_RETRY_LEVELS stronger.
    if (this.bossRecord.beat[n.npcId]) return true;
    const lost = this.bossRecord.lost[n.npcId];
    if (lost && cl < lost + BOSS_RETRY_LEVELS) return false;
    if ((def.level || 1) > Math.max(cl + 5, Math.round(cl * 1.25))) return false;
    const t = this._autoFightTimes(n);
    // A late boss's siege (npcs.js bossSiegeScale) is meant to take that many times
    // longer, so it gets that much more time: the same call as before sieges.
    return !!t && t.myTime <= 1800 * (def.siege || 1) && t.theirTime >= 20;
  }

  /** Rough seconds for you to empty this monster's life, and for its average
   *  hits to empty yours (see _autoCanBeat), plus about how many attacks that
   *  takes; or null when you can't attack it at all (a caster out of runes). */
  _autoFightTimes(n) {
    const cl = this.fightLevel(), def = n.def;
    const mode = this.combatMode(), pm = this.prayerMult();
    let max, sp = null;
    if (mode === 'magic') {
      const chosen = getSpell(this.player.spell);
      sp = this.skills.magic >= chosen.level && this._hasRunes(chosen) ? chosen : this.bestSpell();
      if (!sp) return null;
      max = playerMagicVsNpc(this.skills, this.equipment, sp, def).max * pm.magic;
    } else if (mode === 'ranged') {
      const wpn = getItem(this.equipment.get('weapon'))?.equip || {};
      const idx = wpn.noAmmo ? -1 : this._bestAmmoIdx();
      const arrowStr = wpn.noAmmo ? Rounds.gunShotStr(this.equipment, wpn) : idx === -1 ? 0 : getItem(this.inventory.slotAt(idx).id).arrowStr || 0;
      max = playerRangedVsNpc(this.skills, this.equipment, this.player.rangedStyle, def, arrowStr).max * pm.ranged;
    } else if (mode === 'dance') {
      max = playerDanceVsNpc(this.skills, this.equipment, this.player.danceStyle, def, 0).max * pm.str;
    } else max = playerAttackVsNpc(this.skills, this.equipment, this.player.style, def).max * pm.str;
    // Your blows always land, for a quarter to all of the max hit (5/8 on average);
    // crits, abilities and perks roughly treble that in a real fight.
    // Your attack interval is in 0.3s beats; its attack speed is in 0.6s ticks.
    const weak = weaknessOf(def) === (mode === 'dance' ? 'melee' : mode);
    // (Your gear's totals and attack interval, looked up once for the whole estimate:
    // auto battle asks this of every champion and attacker near you, after every kill.)
    const gb = this.equipment.bonuses(), iv = this.attackInterval();
    max *= armourMult(armourOf(def, { champion: n.champion, fightLevel: cl }), gb.pierce, weak);   // its armour
    // ...and every lasting damage bonus a real hit gets (see _offensiveMods): its
    // weakness and your weapon's race match-up, stats, passive perks and boss
    // damage, Physical / Magic damage bonus %, and any class buff running. Leaving
    // these out made auto battle think it couldn't beat bosses it easily could.
    const perk = this.perkMods(mode);
    if (weak) max *= WEAKNESS_BONUS.dmg;
    // A boss's armour type (its armour is already in armourOf): blunt, spells, glancing and grazing blows.
    max *= bossTypeDmgMult(def, { mode, weaponType: this.weaponType(), interval: iv }) * bossGrazeMult(def, iv);
    // (A spell is judged by its element, not by the staff: see raceMatchup.)
    const race = sp ? elementMatchup(sp.element, raceOf(def, n.npcId)) : this.raceMatchup(n);
    if (sp) max *= elementMult(race);
    else if (race === 'strong') max *= RACE_BONUS.dmg; else if (race === 'weak') max *= RACE_PENALTY.dmg;
    max *= 1 + (this.attrs[attrForMode(mode)] || 0) * DMG_PER_POINT;
    max *= 1 + (perk.dmg || 0) + this.learning.perks().dmg + (perk.boss || 0) + gb.bossDmg / 100;
    max *= 1 + (mode === 'magic' ? gb.magPct : gb.atkPct) / 100;
    max *= 1 + this.buffMod('dmg');
    max *= Mercs.merchantPower(this);   // 1 for every class but the Merchant
    const swingSecs = Math.max(0.1, iv) * COMBAT_BEAT_MS / 1000;
    const myDps = 3 * max * 0.625 / swingSecs;
    const { atkRoll, defRoll, max: theirMax } = npcAttackVsPlayer(def, this.skills, this.equipment, this.player.style);
    const theirDps = hitChance(atkRoll, defRoll * pm.def) * theirMax * 0.625 * (1 - this.protectFactor())
      / (Math.max(2, (def.attackSpeed || 4) - 2) * TICK_MS / 1000);
    const myTime = (n.hp || n.maxHp || 1) / Math.max(0.01, myDps);
    const theirTime = this.maxHp() / Math.max(0.01, theirDps);
    // Spells come off quicker than the weapon's swing (see _magicAttack).
    const castSecs = sp ? Math.max(0.1, this.attackInterval(sp)) * COMBAT_BEAT_MS / 1000 : swingSecs;
    return { myTime, theirTime, theirDps, attacks: myTime / castSecs, spell: sp };
  }

  /** Auto battle with Bosses on and "Bosses & champions first": head for the
   *  nearest boss on the map it would take on (a story boss, one in the
   *  Wilderness when you aren't, or one that beat you recently is left
   *  alone), riding the MRT on long trips. True while a trip is under way. */
  _autoSeekBoss() {
    const p = this.player;
    const only = this.autoCfg.priority === 'only';   // "Champions & bosses only" also seeks out champions
    if ((!this.autoCfg.bosses && !only) || this.autoCfg.priority === false || this.autoCfg.target || this._questTarget || this._questFamily) return false;
    if (this._autoBossTrip) {
      if (p.isMoving) return true;
      // Arrived (or stopped short): within reach, the normal pick takes over.
      const n = this._autoBossTrip.npc;
      if (chebyshev(p.x, p.y, n.x, n.y) <= 20) { this._autoBossTrip = null; return false; }
    }
    if (this.tickCount < (this._autoBossNext || 0)) return false;
    this._autoBossNext = this.tickCount + 15;   // a map-wide look, so not every tick
    const inWild = !!this.world.zoneAt(p.x, p.y)?.wilderness;
    let best = null, bd = Infinity;
    for (const n of this.npcs) {
      const champ = only && n.champion && !n.def.boss && !this.autoQuest;
      if (!n.alive || !(n.def.boss || champ) || !n.attackable || n.def.fixed || n.temporary) continue;
      if (n.def.boss && !this.autoCfg.bosses && !only) continue;
      const d = chebyshev(p.x, p.y, n.x, n.y);
      if (d > BOSS_SEEK_TILES || d >= bd) continue;
      if (!inWild && this.world.zoneAt(n.x, n.y)?.wilderness) continue;
      if ((this._autoSkip.get(n.entityId) || 0) > this.tickCount) continue;
      if (champ ? !this._autoChampionOk(n) : !this._autoCanBeat(n)) continue;
      best = n; bd = d;
    }
    if (!best || bd <= 20) return false;   // none, or already close: the normal pick handles it
    this._pathBudget = 150000;
    let hopped = false;
    try {
      hopped = this._mrtHopToward(best);
      if (!hopped) this.walkToFar({ x: best.x, y: best.y });
    } finally { this._pathBudget = 0; }
    if (!hopped && !p.isMoving) { this._autoSkip.set(best.entityId, this.tickCount + 200); return false; }   // no way there
    if (hopped) this._autoBossNext = this.tickCount;   // off the train: walk the rest next tick
    if (this._autoBossTrip?.npc !== best) this.msg(`Auto battle: heading for ${best.name} (level ${best.def.level}).`, 'system');
    this._autoBossTrip = { npc: best, until: this._autoBossTrip?.npc === best ? this._autoBossTrip.until : this.tickCount + 1500 };
    return true;
  }

  /** Auto battle says once per boss when it walks past one it can't beat. */
  _autoSaySkip(n) {
    if (this._autoSkipSaid.has(n.entityId)) return;
    this._autoSkipSaid.add(n.entityId);
    this.msg(`Skipping ${n.name}: too strong for now.`, 'system');
  }

  /** Walk towards the nearest monster in your level band (up to 20 levels
   *  above you), outside the Wilderness unless you are in it. True if a route
   *  was found and the walk has started. */
  /** Is this monster one auto quest's current fight step wants? */
  _questWants(n) {
    if (this._questTarget) return n.npcId === this._questTarget;
    if (this._questFamily) return n.def.family === this._questFamily;
    if (this._questBoss) return !!n.def.boss;
    return !!this._autoQuestFight;   // "defeat any creatures": anything will do
  }

  /** On a quest or Slayer hunt with none of its monsters within reach: go to
   *  the nearest one anywhere on the map (by MRT when that's quicker). */
  _autoHeadToQuestHunt() {
    const p = this.player, here = this.playerTile();
    const inWild = !!this.world.zoneAt(here.x, here.y)?.wilderness;
    let best = null, bd = Infinity;
    for (const n of this.npcs) {
      if (!n.alive || !n.attackable || n.def.boss || n.temporary || n.ally || n.def.fixed) continue;
      if (this._questTarget && n.npcId !== this._questTarget) continue;
      if (this._questFamily && n.def.family !== this._questFamily) continue;
      if ((this._autoSkip.get(n.entityId) || 0) > this.tickCount) continue;
      if (!inWild && this.world.zoneAt(n.x, n.y)?.wilderness) continue;
      const d = (n.x - here.x) ** 2 + (n.y - here.y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) return false;
    this._mrtHopToward(best);
    const t = this._nearestFree(best.x, best.y);
    const path = t && findPath(this.pathCfg(), this.playerTile(), t, { maxNodes: 150000 });
    if (!path || !path.length) { this._autoSkip.set(best.entityId, this.tickCount + 100); return false; }
    p.setPath(path, this.canRun()); p.clearAction();
    this._autoTravel = { x: t.x, y: t.y };
    this.msg(`Auto battle: heading to ${best.name} for your ${this._questFamily ? 'Slayer task' : 'quest'}.`, 'system');
    return true;
  }

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
      if (d < bd && !this._autoNearDanger(n.x, n.y)) { bd = d; best = n; }
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
    // For Wind's Gale (extra crit chance is worth nothing past 100%) and Earth's
    // Shatter (cracks are armour pierce: worth most against heavy armour).
    const gb = this.equipment.bonuses();
    const critNow = critChance(this.skills.magic, gb.crit) + (this.perkMods('magic').crit || 0) + this.prayerCrit();
    const armour = armourOf(tgt.def, { champion: tgt.champion, fightLevel: this.fightLevel() }), weak = weaknessOf(tgt.def) === 'magic';
    const value = (sp) => {
      const el = ELEMENTS[sp.element] || {};
      const m = elementMatchup(sp.element, race);
      // Damage per second from the casts alone (an average hit, the race matchup, the cast speed).
      const hit = playerMagicVsNpc(this.skills, this.equipment, sp, tgt.def).max * 0.625;
      const casts = 1000 / (this.attackInterval(sp) * COMBAT_BEAT_MS);   // a second
      const d = Math.max(1, hit * elementMult(m) * casts);
      // Fire's Ignite: every cast adds a burn of share x its hit for `secs`
      // seconds (at most `max` at once), and a burning foe's burns all go off
      // twice every tick (the tick, and the flare-up it sets off) and once more
      // for every hit. So up to min(max, casts x secs) burns are going, each
      // going off 2/tick + casts times a second. They build up over the first
      // `secs` seconds, and those still going when the foe dies are wasted (T,
      // the fight's length on the casts alone, hp/d): a quick kill favours
      // Wind's quick casts, a longer fight Fire's burns.
      let v = d;
      if (el.ignite) {
        const { share, secs = 5, tickMs = 1000, max = Infinity } = el.ignite, T = Math.max(1, tgt.hp) / d;
        const ramp = T <= secs ? T / (2 * secs) : 1 - secs / (2 * T);
        v = d * (1 + share * Math.min(max, casts * secs) * ramp * (2000 / tickMs + casts) / casts);
      }
      // A crit lands x2 (x4 one time in four): +1% crit chance is about +1.5% damage.
      if (el.crit) v *= 1 + 1.5 * Math.min(el.crit, Math.max(0, 1 - critNow));
      // Chaos rolls half to double (1.25x on average), and a cast in four adds another element's effect.
      if (el.chaos) v *= ((el.chaos.min + el.chaos.max) / 2) * (1 + el.chaos.surge * 0.3);
      // Dark's hexes build over the first casts, like Earth's cracks: count most of the full effect.
      if (el.hex) v *= 1 + 0.8 * el.hex.per * el.hex.max / 100;
      // Blood heals: worth more the more hurt you are.
      if (el.siphon) v *= 1 + el.siphon * (1 - this.player.hp / Math.max(1, this.maxHp()));
      // Shatter's cracks build over the first few casts: count most of the full effect.
      if (el.shatter) v *= 1 + 0.8 * (armourMult(armour, gb.pierce + el.shatter.per * el.shatter.max, weak) / armourMult(armour, gb.pierce, weak) - 1);
      // Area damage: Earth reaches everyone within 5 tiles, the rest only within 2.
      const near = el.aoeRadius ? crowd : this.nearbyNpcs().filter((n) => n !== tgt && n.alive && n.attackable && !n.ally && !n.def.fixed
        && chebyshev(n.x, n.y, tgt.x, tgt.y) <= AOE_RADIUS).length;
      return v * (1 + near);
    };
    return ok.reduce((a, b) => (value(b) > value(a) ? b : a));
  }

  /** Nearest walkable tile (within 4) that no boss attack is about to hit. */
  /** The nearest tile outside every boss ground marker. With a `target`, one
   *  still within `range` of it is preferred (up to 5 tiles away), so a dodge
   *  never takes you out of reach when it doesn't have to. */
  _safeTileNear(at, target = null, range = 0) {
    let best = null, bd = Infinity, inReach = false;
    for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = at.x + dx, y = at.y + dy;
        if (!this.world.inBounds(x, y) || this.world.isBlocked(x, y) || this.hazardAt(x, y)) continue;
        const reach = !!target && chebyshev(x, y, target.x, target.y) <= range && (x !== target.x || y !== target.y);
        const d = dx * dx + dy * dy;
        // A tile in reach always beats one out of reach; otherwise the nearest.
        if ((reach && !inReach) || (reach === inReach && d < bd)) { bd = d; best = { x, y }; inReach = reach; }
      }
      if (best && (inReach || !target)) return best;   // found one that keeps you fighting
    }
    return best;
  }

  /** Auto battle steps out of a boss's red ground marker before it lands. The
   *  fight carries on: the attack is kept (every style, melee included), so
   *  you swing or shoot on the move whenever the target is in reach, and the
   *  dodge heads for a safe tile still within your weapon's reach if there is
   *  one. True while a dodge is under way. */
  _autoDodge() {
    const p = this.player;
    // "Dodge boss attacks: Off" in the auto battle settings leaves the red markers to you.
    if (!this.hazards.length || this.autoCfg.dodge === false || this.playerRoot > 0 || this.playerStun > 0) {
      if (this._dodging && !p.isMoving) this._dodging = false;
      return false;
    }
    const at = this.playerTile();
    if (!this.hazardAt(at.x, at.y)) {
      if (this._dodging && !p.isMoving) this._dodging = false;
      return this._dodging;
    }
    if (this._dodging && p.isMoving && this._dodgeTo && !this.hazardAt(this._dodgeTo.x, this._dodgeTo.y)) return true;   // already on the way out
    const a = p.action;
    const tgt = a?.type === 'attack' && a.npc?.alive ? a.npc : null;
    const safe = this._safeTileNear(at, tgt, this.attackRange());
    if (!safe) return false;
    const path = findPath(this.pathCfg(), at, safe, { maxNodes: 2000 });
    if (!path.length) return false;
    p.setPath(path, this.canRun());   // the attack action stays: no clearAction
    this._dodging = true; this._dodgeTo = safe;
    return true;
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
    // (A short defensive buff never replaces the threshold buff while you're
    // still healthy: only one buff runs at a time, and the X one hits harder.)
    const buffUp = this.buff && this.buff.until > this.tickCount;
    const keepBuff = buffUp && hpFrac >= 0.5 && ABILITY_BY_ID[this.buff.id]?.key === 'X';
    const defensive = (ab) => ab.kind === 'guard' || (ab.kind === 'heal' ? hpFrac < 0.6 : ab.kind === 'buff' && !keepBuff && (ab.buff?.reduce || ab.buff?.dodge || ab.buff?.lifesteal));
    if (danger) { const c = ready('C', defensive); if (c) this.activateAbility(c.id); }
    if (hpFrac < 0.35) { const v = ready('V'); if (v) this.activateAbility(v.id); }
    // Stacking buffs (the Ranger's skills): keep each one up while the fight is
    // worth it; the ultimate's buff only for a boss, a champion, a crowd or a
    // long fight, never on trash.
    const stacker = (ab) => ab.stack && ab.kind === 'buff' && !this.stackBuffUp(ab.id);
    if (this.currentAbilities().some((ab) => ab.stack)) {
      const bigFight = big || attackers + crowd >= 3 || tgt.hp > hit * 15;
      const b = ready('B', stacker);
      if (b && bigFight) this.activateAbility(b.id);
      const x = ready('X', stacker);
      if (x && (worth(3) || this.adrenaline >= 100)) this.activateAbility(x.id);
      const c = ready('C', stacker);
      if (c && (danger || worth(3))) this.activateAbility(c.id);
      const z = ready('Z', (ab) => ab.stack);   // free, and builds adrenaline: topped up whenever it's ready
      if (z) this.activateAbility(z.id);
      return;
    }
    // Spend.
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
    // Bows, guns and spells hold their ground: a champion out of reach waits
    // until nothing is left in reach (walking off to one, through every pack on
    // the way, was most of a ranged fighter's walking). Melee is unchanged.
    const holds = this._holdsGround();
    const p = this.player;
    const cl = this.fightLevel();
    const wildZone = (x, y) => !!this.world.zoneAt(x, y)?.wilderness;
    const inWild = wildZone(p.x, p.y);
    let best = null, bestScore = Infinity;
    const cands = [];
    // Only monsters near you matter here, and pack counts only look at those (see nearbyNpcs).
    const near = this.nearbyNpcs();
    let packAt = null, bandLo;
    // "Targets": Bosses & champions first (the default), or Nearest, which is
    // simply the closest monster by the walk there (ties go to one already
    // fighting you). Either way a monster well below your level waits until
    // nothing in your level band is around.
    const first = this.autoCfg.priority !== false;
    // "Champions & bosses only": ordinary monsters are left alone unless they
    // attack you (or a quest or Slayer hunt, or a chosen monster type, asks for them).
    const only = this.autoCfg.priority === 'only' && !this.autoCfg.target && !this._questTarget && !this._questFamily;
    // Champions are fair game at any level now (they used to be skipped when
    // well above you, which made auto battle look like it ignored them).
    // Bosses must pass _autoCanBeat.
    for (const n of near) {
      if (!n.alive || !n.attackable) continue;
      const d = chebyshev(p.x, p.y, n.x, n.y);
      if (d > Math.max(25, range + 2)) continue;   // a Sniper picks off monsters from further still
      const hunting = n.target === p || !!n.wave || !!n.worldEvent;   // a wave or world event monster is coming for you, whatever its level
      // One auto battle has just run from is left alone until it catches up:
      // a pack that stayed by its home, still set on you, drew a Rogue back
      // into the fight it had fled, again and again until it died.
      if (hunting && d > 2 && this._autoRanFrom(n)) continue;
      // Anything already fighting you (a boss, its summoned adds, a champion)
      // is always answered, whatever its level or where it stands.
      if (hunting) {
        // In the Endless Gate a champion or boss leads every wave: its escort
        // goes first (each hits nearly as hard for a sixth of the life), then
        // the leader, unless it is in the middle of a mechanic (see bossmech.js).
        const escortFirst = n.wave && (n.def.boss || n.champion) && !n.mech;
        // ...but whatever is striking the A-Worthy Shrine comes first (a boss or
        // champion before its escort), then those nearest the shrine (waves.js).
        const siege = this.waves.besieging(n) && !n.mech;
        const tier = !first ? -0.5 : siege ? -2500 - (n.def.boss || n.champion ? 400 : 0) : escortFirst ? -150 : n.def.boss ? -3000 : n.champion ? -2000 : -200 - (shootable(n, d) ? 1000 : 0);
        cands.push({ n, score: d + tier + (n.wave ? this.waves.shrineDist(n) * 0.5 : 0), tier });
        continue;
      }
      if (n.temporary) continue;
      if (this._autoNearDanger(n.x, n.y)) continue;   // beside something it ran from
      if (n.def.boss && !this.autoCfg.bosses && !this._questBoss && !only) continue;
      if ((this._autoSkip.get(n.entityId) || 0) > this.tickCount) continue;
      if (this.autoCfg.target && n.npcId !== this.autoCfg.target) continue;   // only the chosen monster type
      if (this._questTarget && n.npcId !== this._questTarget) continue;       // a quest hunt (e.g. rats for Pest Control)
      if (this._questFamily && n.def.family !== this._questFamily) continue;  // a Slayer task's monster kind
      // Bosses within reach that you could beat are taken on ahead of everything else.
      // Story bosses (fixed spawns like the Lion of Light) and bosses too strong
      // for you are left for you to take on yourself.
      if (n.def.boss) {
        if (n.def.fixed) continue;   // story bosses are yours to start
        if (!inWild && wildZone(n.x, n.y)) continue;
        if (!this._autoCanBeat(n)) { this._autoSaySkip(n); continue; }
        // "Bosses & champions first": a boss outranks everything, even monsters already in reach.
        { const tier = first ? -3000 : 0; cands.push({ n, score: d + tier, tier }); }
        continue;
      }
      // Then mini-bosses: gold-ringed champions within reach that you can take on.
      if (n.champion) {
        if (this.autoCfg.champions === false && !only) continue;   // "Champions: Skip"
        // Auto quest leads: a champion's 30x-life fight would stall the quest, so one
        // that isn't attacking you is left alone while a quest is being followed.
        if (this.autoQuest) continue;
        if (!inWild && wildZone(n.x, n.y)) continue;
        if (!this._autoChampionOk(n)) continue;   // a slog you'd likely lose: leave it until you're stronger
        { const tier = !first ? 0 : holds && !shootable(n, d) ? -500 : -2000; cands.push({ n, score: d + tier, tier }); }
        continue;
      }
      if (only) continue;   // "Champions & bosses only"
      const lvl = n.def.level || 1;
      // Only monsters up to a little above your level, near or far. (Close by
      // it used to fight anything, so a new character beside a pack's level 59
      // Dire or level 111 Elder picked that and died.)
      if (this._farAbove(n, cl)) continue;
      // Monsters well below your level rank behind any in your level band
      // (the band worked out once per pick, not once per monster).
      const weak = !this.autoCfg.target && !this._questTarget && !this._questFamily && lvl < (bandLo ??= this._autoBandLo(inWild));
      if (!inWild && wildZone(n.x, n.y)) continue;
      // "Nearest" really is the nearest: no ranking by level band, pack or wounds.
      if (!first) { cands.push({ n, score: d, tier: 0 }); continue; }
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
    const held = Math.hypot(v.x, v.y) >= STICK_DEAD;
    if (!held || !p.alive || this.playerStun > 0 || this.playerRoot > 0) {
      p.stick = null;
      if ((!held || !p.alive) && this._driving) {
        this._driving = false;
        // Letting go of the stick means stop. A close-range target picked up
        // while steering (Attack tapped mid-run) that is now well out of reach
        // would otherwise drag the player off after it the moment the thumb
        // lifts. Holding Attack still chases (until Attack is let go too, see
        // releaseAttack), a foe close by is still fought, and bows and spells
        // keep their target for kiting.
        if (this.attackHeld) this._stopOnAttackRelease = true;
        else this._dropFarMeleeTarget();
      }
      return;
    }
    if (!this._driving) {
      this._driving = true;
      this._stopOnAttackRelease = false;
      this._autoLife = null;   // steering away ends any auto gather loop
      // Bows and spells keep firing while you steer (handy for dodging); other actions stop.
      const shooting = p.action?.type === 'attack' && this.attackRange() > 1;
      if (p.action && !shooting) p.clearAction();
      p.path = [];           // drop any clicked route
    }
    p.running = this.canRun();
    p.stick = { x: v.x, y: v.y };
  }

  /** Drops a close-range (range 3 or less) attack target that is well out of
   *  reach, so letting go of the controls doesn't run the player off after it. */
  _dropFarMeleeTarget() {
    const p = this.player, a = p.action, range = this.attackRange();
    if (a?.type === 'attack' && range <= 3 && a.npc
      && chebyshev(p.x, p.y, a.npc.x, a.npc.y) > range + 2) { p.clearAction(); p.path = []; }
  }

  /** The Attack button is let go. If the stick was let go while Attack was
   *  held, nothing is held any more, so the same "letting go stops" rule
   *  applies now. A plain tapped Attack still chases its target as before. */
  releaseAttack() {
    this.attackHeld = false;
    if (this._stopOnAttackRelease && !this._driving) this._dropFarMeleeTarget();
    this._stopOnAttackRelease = false;
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
    if (npc.def.role === 'mark') return this.startPickpocket(npc);   // a Thieving mark has nothing to say
    const at = Life.holdNpc(this, npc);   // they stop and turn to you (npclife.js)
    if (npc.def.role === 'shop') return this.beginAction({ type: 'openshop', shop: npc.def.shop, target: at }, at, true);
    if (npc.def.role === 'bank') return this.beginAction({ type: 'openbank', target: at }, at, true);
    return this.beginAction({ type: 'talk', npc, target: at }, at, true);
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
      case 'offering': return this.beginAction({ type: 'shrinemenu', obj, target: tgt }, tgt, true);
      case 'rest': return this.beginAction({ type: 'rest', obj }, tgt, true);
      case 'agility': return this.beginAction({ type: 'agility', obj }, tgt, true);
      case 'stall': return this.beginAction({ type: 'stall', obj }, tgt, true);
      case 'transport': return this.beginAction({ type: 'transport', obj, target: tgt }, tgt, true);
      case 'gate': return this.beginAction({ type: 'gate', obj, target: tgt }, tgt, true);
      case 'home': return this.beginAction({ type: 'homemenu', obj, target: tgt }, tgt, true);
      case 'storyobj': return this.beginAction({ type: 'storyobj', obj, target: tgt }, tgt, true);   // lore notes, story events (story.js)
      default: return this.walkTo(tgt);
    }
  }

  doPickup(gi) {
    if (!this.world.groundItems.includes(gi)) return;
    const space = this.inventory.canAdd(gi.id, gi.qty);
    if (space <= 0) { this.msg("You don't have enough inventory space."); return; }
    const added = this.inventory.add(gi.id, Math.min(space, gi.qty), gi.q);
    gi.qty -= added;
    this.msg(`You pick up ${added > 1 ? added + ' x ' : ''}${qualityName(gi.id, gi.q)}.`);
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
    if (this.waves.blocksFood()) { this.waves.foodRefused(); return; }   // the Endless Gate's Fasting modifier
    this.inventory.removeAt(index, 1);
    // Endgame dishes heal a share of your life (healPct), so they keep up as it grows.
    // (Stewardship's food perk adds a share on top, see culling.js.)
    const heal = Math.round((item.healPct ? Math.max(item.heal, Math.round(this.maxHp() * item.healPct)) : item.heal) * Culling.foodMult(this));
    this.player.hp = Math.min(this.maxHp(), this.player.hp + heal);
    this.msg(`You eat the ${item.name.toLowerCase()}.`);
    if (item.meal) this._eatMeal(item);
    this.bus.emit('sfx', 'eat');
    this.bus.emit('hp');
  }

  /** A dish with a `meal` boost: its damage boost, or its healing over time
   *  (regenPct of your life spread over its ticks, counted like the Regeneration
   *  perk), for a short while. A new meal replaces the last one. Not saved. */
  _eatMeal(item) {
    const m = item.meal, fx = { ...(m.fx || {}) };
    // (Spread over one tick fewer than it lasts: it wears off just before its last tick.)
    if (m.regenPct) fx.regen = this.maxHp() * m.regenPct / Math.max(1, Math.round(m.ms / TICK_MS) - 1);
    this.meal = { id: item.id, ms: m.ms, fx };
    if (fx.dmg) this.msg(`You feel fired up: +${Math.round(fx.dmg * 100)}% damage for ${Math.round(m.ms / 1000)} seconds.`, 'system');
  }

  /** Can this piece be worn right now (levels, class weapon and class armour)? Silent. */
  /** Bows used to carry a quiver's bonus built into their grip; now the quiver is
   *  a real off-hand. An Archer or Ranger from before that, holding a bow with an
   *  empty off-hand and no quiver anywhere, is handed one of the bow's own tier
   *  (once), so nobody comes back weaker. */
  _giveBowQuiver() {
    const w = this.equipment.get('weapon');
    if (!takesQuiver(w) || this.equipment.get('shield') || this.bowQuiverGiven) return;
    this.bowQuiverGiven = true;
    const owns = (id) => this.inventory.has(id) || this.bank?.count?.(id) > 0;
    if (Object.keys(ITEMS).some((id) => /_quiver$/.test(id) && owns(id))) return;
    const tier = getItem(w).equip.grip?.tier || 'bronze';
    const q = ITEMS[`${tier}_quiver`] ? `${tier}_quiver` : 'bronze_quiver';
    this.equipment.set('shield', q);
    this.msg(`Bows now take a real quiver in the off-hand: you sling on ${aOrAn(getItem(q).name.toLowerCase())}.`, 'level');
  }

  /** Take off the shield (a two-handed weapon is in hand) and put it in the pack. */
  _stowShield() {
    const shQ = this.equipment.qualityIn('shield');
    const sh = this.equipment.clearSlot('shield');
    if (!sh) return;
    this.inventory.add(sh, 1, shQ);
    this.msg(`Your weapon needs both hands, so you put your ${getItem(sh).name.toLowerCase()} in your pack.`, 'system');
  }

  /** A Ninja holds no shield (a shuriken goes in each hand): one still worn,
   *  from a save made before that, goes to the bank (the pack if it can't).
   *  The off-hand is left empty; Equip best fills it with a spare shuriken. */
  _bankNinjaShield() {
    const sh = this.equipment.get('shield');
    if (!sh || !shieldBarred(this.jobClass, sh)) return;
    const shQ = this.equipment.qualityIn('shield');
    this.equipment.clearSlot('shield');
    const name = getItem(sh).name.toLowerCase();
    if (this.bank?.deposit) { this.bank.deposit(sh, 1, shQ); this.msg(`${NO_SHIELD_MSG} Your ${name} was put in your bank.`, 'system'); }
    else { this.inventory.add(sh, 1, shQ); this.msg(`${NO_SHIELD_MSG} Your ${name} was put in your pack.`, 'system'); }
  }

  _canEquipNow(id) {
    const it = getItem(id), eq = it.equip;
    if (!eq || it.tool) return false;
    for (const [sk, lvl] of Object.entries(eq.req || {})) if (reqLevel(id, sk, this.skills) < lvl) return false;   // a Dancer's gear: its pooled dance level
    const cls = this.jobClass && CLASS_BY_ID[this.jobClass];
    if (cls && eq.weaponType && !canWield(cls.id, eq.weaponType)) return false;
    return !cls || canWear(cls.id, id);
  }

  /** Best in slot: put on the strongest piece in the backpack for every slot
   *  (counting mastery and enchantments), keeping to your current weapon style, then fill
   *  a dual-wield off-hand. Returns how many pieces were changed. */
  equipBest() {
    let changed = 0;
    // Scores include each piece's mastery and enchant lines and count only the
    // stats your fighting style uses, so a Legendary iron sword can beat a plain mithril one.
    const mode = this.combatMode();
    // Offensive stats first: damage decides, Defence and HP only break a tie.
    // Each copy is weighed with its own quality (`q`), the worn piece with its own.
    const score = (id, q = null) => offenceFirstScore(id, this.equipment, mode, 'main', q);
    for (let guard = 0; guard < 30; guard++) {
      let best = null;
      this.inventory.slots.forEach((s, i) => {
        if (!s || !this._canEquipNow(s.id)) return;
        const eq = getItem(s.id).equip;
        // Dual wielders keep their off-hand for a second weapon, not a shield.
        if (eq.slot === 'shield' && canDualWield(this.equipment.get('weapon'))) return;
        // ...and a two-handed weapon leaves no hand for a shield at all (a bow still takes a quiver).
        if (eq.slot === 'shield' && offhandBlocked(this.equipment.get('weapon'), s.id)) return;
        const worn = this.equipment.get(eq.slot);
        // Keep to the weapon style you fight with (a staff won't replace a sword).
        if (eq.slot === 'weapon' && worn && weaponStyle(s.id) !== weaponStyle(worn)) return;
        // Keep to the weapon type in hand: ratings can't compare a main and a secondary type fairly.
        // (A tool in hand, such as an axe, has no type and is always swapped for a weapon.)
        const wornType = worn && getItem(worn).equip.weaponType;
        if (eq.slot === 'weapon' && wornType && this.jobClass && getItem(s.id).equip.weaponType !== wornType) return;
        // Refine and enchantments carry over to a better piece (carry.js), and
        // mastery belongs to the gear type, so a higher tier of the same line
        // (the same weapon type, or the same armour family) goes on first, the
        // highest tier first, as long as it is at least as strong as the worn
        // piece once the carry is done (a plain higher tier won't replace a
        // Mythic copy that is still stronger). Anything else is weighed as it
        // will be worn, after the carry, and must be stronger.
        const wornQ = worn ? this.equipment.qualityIn(eq.slot) : null;
        const after = () => (worn ? scoreAfterCarry(this.equipment, s.id, eq.slot, (id) => score(id, s.q || null), s.q || null) : score(s.id, s.q || null)) - (worn ? score(worn, wornQ) : 0);
        const sameLine = worn && (eq.slot === 'weapon' ? !!wornType : !!eq.family && eq.family === getItem(worn).equip.family);
        if (sameLine) {
          const base = gearRating(s.id), wornBase = gearRating(worn);
          if (base > wornBase) {
            if (after() < 0) return;
            const rank = 1e15 + base;
            if (!best || rank > best.gain) best = { i, gain: rank };
            return;
          }
        }
        const gain = after();
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
      // Each candidate as it would be worn there: a twin of the main weapon reads its off-hand copy's upgrades.
      const offScore = (id, q = null) => offenceFirstScore(id, this.equipment, mode, this.equipment.copyFor(id, 'shield'), q);
      let bi = -1, br = canDualPair(off, main) ? offScore(off, this.equipment.qualityIn('shield')) : -1;
      this.inventory.slots.forEach((s, i) => {
        if (s && canDualPair(s.id, main) && this._canEquipNow(s.id) && offScore(s.id, s.q || null) > br) { bi = i; br = offScore(s.id, s.q || null); }
      });
      if (bi >= 0) { this.equipItem(bi, { offhand: true }); changed++; }
    }
    // Guns: load the strongest rounds in the pack (rounds.js).
    if (Rounds.isGunId(this.equipment.get('weapon')) && Rounds.loadBestRounds(this)) changed++;
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
      if (eq?.weaponType && !canWield(cls.id, eq.weaponType)) give = equivalentWeapon(id, cls.weapon);
      else if (eq?.family && !canWear(cls.id, id)) give = equivalentArmour(id, ARMOUR_FAMILY[cls.id]);
    }
    this.inventory.add(give, 1);
    if (give !== id) this.msg(`Your reward is made for ${aOrAn(cls.name)}: ${getItem(give).name}.`, 'level');
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
      if (reqLevel(s.id, sk, this.skills) < lvl) {
        this.msg(`You need ${capitalize(sk)} level ${lvl} to wear this.`);
        return;
      }
    }
    // Job classes: only your class's weapon type can be wielded (tools are fine).
    const cls = this.jobClass && CLASS_BY_ID[this.jobClass];
    if (cls && eq.weaponType && !canWield(cls.id, eq.weaponType)) {
      this.msg(`Only ${aOrAn(CLASS_FOR_TYPE(eq.weaponType))} can wield ${WEAPON_TYPE_NAMES[eq.weaponType]}. You are ${aOrAn(cls.name)}: you fight with ${WEAPON_TYPE_NAMES[cls.weapon]} and ${WEAPON_TYPE_NAMES[SECONDARY_WEAPON[cls.id]]}.`);
      return;
    }
    // Ninjas hold a shuriken in each hand, never a shield.
    if (cls && shieldBarred(cls.id, s.id)) { this.msg(NO_SHIELD_MSG); return; }
    // ...and only your class's kind of helm, body and legs armour.
    if (cls && !canWear(cls.id, s.id)) {
      const mine = ARMOUR_FAMILIES[ARMOUR_FAMILY[cls.id]];
      this.msg(`That's ${ARMOUR_FAMILIES[eq.family].name.toLowerCase()} armour. ${AOrAn(cls.name)} wears ${mine.name.toLowerCase()}: ${mine.desc}`);
      return;
    }
    // A dagger goes in the off-hand when asked, or by default when you already
    // hold a dagger and your off-hand isn't one yet.
    const main = this.equipment.get('weapon');
    const offhand = canDualPair(s.id, main)
      && (opts.offhand ?? !canDualPair(main, this.equipment.get('shield')));
    if (opts.offhand && !offhand) { this.msg('Only a second weapon of the same dual-wield kind (daggers, scimitars, kerambits, pistols or shurikens) can go in your off-hand.'); return; }
    const slot = offhand ? 'shield' : eq.slot;
    if (slot === 'shield' && offhandBlocked(main, s.id)) {
      this.msg(takesQuiver(main) ? `Your ${getItem(main).name.toLowerCase()} needs both hands: only a quiver can go with it.`
        : `Your ${getItem(main).name.toLowerCase()} needs both hands, so you can't hold a shield with it.`);
      return;
    }
    // An off-hand weapon is weighed against the one already in the off-hand (each
    // hand hits with its own weapon's stats), not against a shield.
    const q = s.q || null;   // this copy's quality goes on with it
    const cmp = !offhand ? compareGear(s.id, this.equipment, null, q)
      : canDualPair(this.equipment.get('shield'), main) ? compareGear(s.id, this.equipment, 'shield', q) : null;
    // A better piece takes over the old one's refine and enchantments (carry.js),
    // worked out before the swap while the old piece is still the one worn.
    const carry = planCarry(this.equipment, s.id, slot, q);
    this.inventory.removeAt(index, 1);
    const prev = this.equipment.get(slot), prevQ = this.equipment.qualityIn(slot);
    this.equipment.set(slot, s.id, q);
    if (prev) this.inventory.add(prev, 1, prevQ);
    if (carry) applyCarry(this.equipment, carry);
    // Say plainly whether that was a step up, so players learn which gear is better.
    const verdict = () => {
      if (cmp && prev && cmp.verdict !== 'same' && cmp.verdict !== 'worn' && cmp.deltas.length) {
        const head = { upgrade: 'Upgrade!', downgrade: 'Downgrade:', style: 'New style:' }[cmp.verdict];
        this.msg(`${head} ${deltaText(cmp.deltas)} vs your ${offhand ? 'off-hand ' : ''}${getItem(prev).name.toLowerCase()}.`, cmp.verdict === 'upgrade' ? 'level' : 'system');
      }
      for (const m of carryMessages(carry)) this.msg(m, 'level');   // what came across from the old piece
    };
    if (offhand) {
      this.msg(`You wield the ${item.name.toLowerCase()} in your off-hand. Dual wielding: each hand strikes with its own weapon's stats.`, 'level');
      verdict();
      return;
    }
    // Swapping the main hand off daggers sends an off-hand dagger back to the pack.
    if (slot === 'weapon' && canDualWield(this.equipment.get('shield')) && !canDualPair(s.id, this.equipment.get('shield'))) {
      const offQ = this.equipment.qualityIn('shield');
      const off = this.equipment.clearSlot('shield');
      this.inventory.add(off, 1, offQ);
      this.msg(`You put away your off-hand ${getItem(off).name.toLowerCase()}.`, 'system');
    }
    // A two-handed weapon needs both hands: the shield goes back in the pack.
    if (slot === 'weapon' && this.equipment.get('shield') && offhandBlocked(s.id, this.equipment.get('shield'))) this._stowShield();
    this.msg(`You ${eq.slot === 'weapon' ? 'wield' : 'wear'} the ${item.name.toLowerCase()}.`);
    verdict();
  }

  // ---------------- Enchanting ----------------
  // An item type holds up to three enchant lines. An attempt offers three
  // random lines; the stones and coins are paid only when you pick one. The
  // offer is kept until you pick, so closing the window can't be used as a
  // free reroll: a reroll costs an upgrade ward.
  // `copy` 'off' works on the off-hand copy of a twin pair (the same weapon in
  // both hands, see Equipment.offRefines), which has its own lines, costs and offer.

  /** What the next enchant of this item costs ({ stones, coins }). */
  enchantCostFor(id, copy = 'main') { return enchantCost(id, this.equipment.enchantLines(id, copy).length); }

  canAffordEnchant(id, copy = 'main') {
    const c = this.enchantCostFor(id, copy);
    return this.inventory.count(UP_STONE) >= c.stones && this.inventory.count('coins') >= c.coins;
  }

  /** The off-hand copy can only be worked on while the pair is worn. */
  _offCopyOk(id, copy) {
    if (copy !== 'off' || this.equipment.twinWorn(id)) return true;
    this.msg(`Wield ${aOrAn(getItem(id).name.toLowerCase())} in each hand to upgrade the off-hand one.`);
    return false;
  }

  /** The three lines on offer for this item (rolled the first time you look). */
  enchantOffers(id, copy = 'main') {
    if (!getItem(id).equip?.bonuses) return [];
    this._enchantOffers ||= {};
    const key = copy === 'off' ? `${id}#off` : id;
    if (!this._enchantOffers[key]) this._enchantOffers[key] = rollEnchantOffers(id);
    return this._enchantOffers[key];
  }

  /** Use up an upgrade ward to swap the offer for three new lines. */
  rerollEnchant(id, copy = 'main') {
    if (this.inventory.count(UP_WARD) < 1) { this.msg('You need an upgrade ward to reroll the offer.'); return null; }
    this.inventory.remove(UP_WARD, 1);
    this._enchantOffers ||= {};
    const key = copy === 'off' ? `${id}#off` : id;
    this._enchantOffers[key] = rollEnchantOffers(id);
    this.msg('Your upgrade ward crumbles, and three new enchantments shimmer into view.', 'system');
    return this._enchantOffers[key];
  }

  /** Take offer `pick` (0-2). When all three lines are full, `replace` (0-2)
   *  says which line it takes the place of. Returns the new line, or null. */
  pickEnchant(id, pick, replace = null, copy = 'main') {
    if (!this._offCopyOk(id, copy)) return null;
    const offers = this.enchantOffers(id, copy);
    const line = offers[pick];
    if (!line) return null;
    const lines = this.equipment.enchantLines(id, copy);
    const full = lines.length >= MAX_ENCHANTS;
    if (full && !(Number.isInteger(replace) && replace >= 0 && replace < lines.length)) { this.msg('Choose which enchantment to replace.'); return null; }
    const c = this.enchantCostFor(id, copy);
    if (this.inventory.count(UP_STONE) < c.stones) { this.msg(`You need ${c.stones} upgrade stones to enchant this. Monsters drop them, bosses most of all.`); return null; }
    if (this.inventory.count('coins') < c.coins) { this.msg(`You need ${c.coins} coins to enchant this.`); return null; }
    this.inventory.remove(UP_STONE, c.stones);
    this.inventory.remove('coins', c.coins);
    const next = lines.slice();
    const old = full ? next[replace] : null;
    if (full) next[replace] = { ...line }; else next.push({ ...line });
    this.equipment.enchantMap(copy)[id] = next;
    delete this._enchantOffers[copy === 'off' ? `${id}#off` : id];
    this.equipment._changed();
    this.spawnSparkle(this.player, '#A66CFF', 16);
    this.bus.emit('sfx', 'level');
    const name = (copy === 'off' ? 'off-hand ' : '') + getItem(id).name;
    this.msg(old ? `Your ${name.toLowerCase()} trades ${enchantLabel(old)} for ${enchantLabel(line)}.`
      : `Your ${name.toLowerCase()} is enchanted: ${enchantLabel(line)}.`, 'level');
    return line;
  }

  // ---------------- Feeding gear with materials ----------------
  // Life-skill materials add mastery XP to an item type, worn or in your
  // pack: bars for metal gear, logs for bows and staves, hides for leather and
  // hide, gems for jewellery, herbs for cloth (see materials.js). Materials
  // stop at Master; the ranks above are earned in battle.

  /** The materials in your pack that can feed this item type, best first:
   *  [{ id, count, points (mastery XP each) }]. */
  feedOptions(id) {
    const out = [];
    for (const s of this.inventory.slots) {
      if (!s || out.some((o) => o.id === s.id)) continue;
      const points = feedXp(id, s.id);
      if (points) out.push({ id: s.id, count: this.inventory.count(s.id), points });
    }
    return out.sort((a, b) => b.points - a.points);
  }

  /** Feed up to `qty` of material `matId` to item type `id` (worn or in your
   *  pack). Only what it takes to reach Master is used up. Returns the
   *  mastery XP added (0 when nothing could be fed). */
  feedMastery(id, matId, qty = 1) {
    if (!getItem(id).equip?.bonuses) return 0;
    if (!EQUIP_SLOTS.some((s) => this.equipment.get(s) === id) && !this.inventory.count(id)) { this.msg('Wear or carry the gear you want to feed.'); return 0; }
    const per = feedXp(id, matId);
    const name = getItem(id).name;
    if (!per) { this.msg(`${getItem(matId).name} can't feed your ${name.toLowerCase()}: it takes ${feedKind(id) || 'nothing'} materials.`); return 0; }
    const have = this.inventory.count(matId);
    if (!have) { this.msg(`You have no ${getItem(matId).name.toLowerCase()}.`); return 0; }
    const pts = this.equipment.masteryXp(id);
    if (pts >= FEED_CAP) { this.msg(`Materials can take gear only to ${MASTERY_RANKS[FEED_CAP_RANK].name} mastery. Fight with your ${name.toLowerCase()} to go further.`); return 0; }
    const n = Math.min(Math.max(1, Math.floor(qty)), have, Math.ceil((FEED_CAP - pts) / per));
    this.inventory.remove(matId, n);
    this._addMastery(id, n * per);
    this.equipment._changed();
    this.spawnSparkle(this.player, '#ffd24a', 8);
    this.msg(`You work ${n} x ${getItem(matId).name} into your ${name.toLowerCase()}: +${n * per} mastery XP.`, 'system');
    return n * per;
  }

  // ---------------- The Offering Shrine ----------------
  // Donate any life-skill material for shrine points (a tenth of its value),
  // then spend them on ranks in five permanent offensive blessings (shrine.js).

  /** Every material in your pack the shrine accepts: [{ id, count, points (each) }], best first. */
  shrineDonatables() {
    const out = [];
    for (const s of this.inventory.slots) {
      if (!s || !materialKind(s.id) || out.some((o) => o.id === s.id)) continue;
      out.push({ id: s.id, count: this.inventory.count(s.id), points: materialPoints(s.id) });
    }
    return out.sort((a, b) => b.points - a.points);
  }

  /** Donate up to `qty` of a material. Returns the shrine points gained. */
  donateToShrine(matId, qty = 1) {
    const per = materialPoints(matId);
    if (!per) { this.msg('The shrine accepts only gathered materials: bars, ore, gems, logs, hides, herbs, fish and feathers.'); return 0; }
    const n = Math.min(Math.max(1, Math.floor(qty)), this.inventory.count(matId));
    if (n <= 0) return 0;
    this.inventory.remove(matId, n);
    this.shrine.points += n * per;
    this.msg(`You offer ${n} x ${getItem(matId).name} at the shrine: +${n * per} shrine points.`, 'system');
    this.bus.emit('shrine');
    this.saveSoon = true;
    return n * per;
  }

  /** Spend shrine points on the next rank of a blessing. True if it ranked up. */
  shrineRankUp(track) {
    const t = SHRINE_TRACKS[track];
    if (!t) return false;
    const cost = this.shrine.nextCost(track);
    if (!this.shrine.rankUp(track)) { this.msg(`${t.name} rank ${this.shrine.rank(track) + 1} needs ${cost} shrine points.`); return false; }
    const r = this.shrine.rank(track);
    this.equipment._changed();   // the Equipment panel's totals now include it
    this.spawnSparkle(this.player, '#ffe08a', 16);
    this.bus.emit('sfx', 'level');
    this.msg(`The shrine glows. ${t.name} rank ${r}: ${trackText(track, r)}.`, 'level');
    if (r % 10 === 0) this.banner(`<span class="big">${t.name} ${r}!</span>${trackText(track, r)}`);
    this.bus.emit('shrine');
    return true;
  }

  /** Spend as many shrine points as it takes on one blessing: every rank the
   *  points afford, in one go, with one message. Returns the ranks bought. */
  shrineRankUpMax(track) {
    const t = SHRINE_TRACKS[track];
    if (!t) return 0;
    const sh = this.shrine, { ranks, cost } = maxAffordable(sh, track);
    if (!ranks) { this.msg(`${t.name} rank ${sh.rank(track) + 1} needs ${sh.nextCost(track)} shrine points.`); return 0; }
    const r0 = sh.rank(track), r1 = r0 + ranks;
    sh.points -= cost;
    sh.ranks[track] = r1;
    sh.rev++;
    this.equipment._changed();
    this.spawnSparkle(this.player, '#ffe08a', 16);
    this.bus.emit('sfx', 'level');
    this.msg(`The shrine glows. ${t.name} +${ranks} rank${ranks > 1 ? 's' : ''} (${r0} → ${r1}): ${trackText(track, r1)}.`, 'level');
    // A banner when the ranks passed a tenth rank, as single rank-ups give.
    if (Math.floor(r1 / 10) > Math.floor(r0 / 10)) this.banner(`<span class="big">${t.name} ${r1}!</span>${trackText(track, r1)}`);
    this.bus.emit('shrine');
    this.saveSoon = true;
    return ranks;
  }

  // ---------------- Refining ----------------
  /** Refine an item type one level (★1..★15), on top of its mastery. The
   *  attempt costs refine scrolls only, and ends in success, failure, a
   *  downgrade or (from ★13) the item breaking, destroyed for good. An
   *  upgrade ward in your pack takes a downgrade or a break instead. Returns
   *  the outcome ('success' | 'fail' | 'downgrade' | 'broken' | 'warded'), or
   *  null when the attempt couldn't be made. `r` fixes the roll (for tests).
   *  `copy` 'off' refines the off-hand copy of a twin pair on its own: it
   *  pays its own scrolls and takes its own risks (see Equipment.offRefines). */
  refineItem(id, r = Math.random(), copy = 'main') {
    if (!getItem(id).equip?.bonuses) return null;
    if (!this._offCopyOk(id, copy)) return null;
    const refines = this.equipment.refineMap(copy);
    const lv = this.equipment.refineLevel(id, copy);
    const name = (l) => `${copy === 'off' ? 'off-hand ' : ''}${getItem(id).name}${l ? ' ' + refineTag(l) : ''}`;
    if (lv >= MAX_REFINE) { this.msg(`${name(lv)} is already fully refined.`); return null; }
    const next = lv + 1;
    const cost = refineCost(id, next);
    if (this.inventory.count(REFINE_SCROLL) < cost.scrolls) {
      this.msg(`You need ${cost.scrolls} refine scroll${cost.scrolls > 1 ? 's' : ''} to refine to ${refineTag(next)}. Monsters drop them now and then, bosses always.`);
      return null;
    }
    this.inventory.remove(REFINE_SCROLL, cost.scrolls);
    const out = rollRefine(next, r);
    // A ward takes a downgrade or a break instead (and is used up).
    if ((out === 'downgrade' || out === 'broken') && this.inventory.count(UP_WARD) > 0) {
      this.inventory.remove(UP_WARD, 1);
      this.msg(`The refine went badly, but your upgrade ward crumbled instead: your ${name(lv)} is unharmed.`, 'system');
      this.bus.emit('sfx', 'hurt');
      return 'warded';
    }
    if (out === 'success') {
      refines[id] = next;
      this.equipment._changed();
      this.spawnSparkle(this.player, '#9fd8ff', 16);
      this.bus.emit('sfx', 'level');
      this.msg(`Refine success! Your ${name(next)} shines brighter.`, 'level');
      if (next === MAX_REFINE) this.banner(`<span class="big">${refineTag(MAX_REFINE)}!</span>${getItem(id).name} is fully refined`);
    } else if (out === 'fail') {
      this.bus.emit('sfx', 'hurt');
      this.msg(`The refine failed. Your ${name(lv)} is unharmed, but the scrolls are used up.`, 'system');
    } else if (out === 'downgrade') {
      if (lv - 1 > 0) refines[id] = lv - 1; else delete refines[id];
      this.equipment._changed();
      this.bus.emit('sfx', 'hurt');
      this.msg(`The refine failed and your gear lost a level: it is now ${name(lv - 1)}. (An upgrade ward would have saved it.)`, 'combat');
    } else {
      // Broken: one copy is destroyed (the worn one first) and the type's refine resets.
      const eqp = this.equipment;
      if (eqp.twinWorn(id)) {
        // One of a twin pair: the off-hand copy goes and its own refine resets.
        // When the main copy breaks, the off-hand copy survives and moves to the
        // main hand with its own upgrades: its refine and lines become the main
        // record, and the broken copy's lines wait in the second copy's record
        // (a break never takes enchant lines). Moved, so nothing is doubled.
        const offQ = eqp.qualityIn('shield');
        eqp.clearSlot('shield');
        if (copy === 'main') {
          eqp.set('weapon', id, offQ);   // the surviving copy keeps its own quality
          const lines = eqp.enchants[id];
          if (eqp.offRefines[id]) eqp.refines[id] = eqp.offRefines[id]; else delete eqp.refines[id];
          if (eqp.offEnchants[id]) eqp.enchants[id] = eqp.offEnchants[id]; else delete eqp.enchants[id];
          if (lines) eqp.offEnchants[id] = lines; else delete eqp.offEnchants[id];
        }
        delete eqp.offRefines[id];
      } else {
        const slot = EQUIP_SLOTS.find((s) => eqp.get(s) === id);
        if (slot) eqp.clearSlot(slot); else this.inventory.remove(id, 1);
        delete eqp.refines[id];
      }
      this.equipment._changed();
      this.bus.emit('sfx', 'hurt');
      this.addShake(4, 300);
      this.msg(`The refine shattered your ${name(lv)}! It is destroyed. (An upgrade ward would have saved it.)`, 'combat');
      this.banner(`<span class="big">Broken!</span>${getItem(id).name} shattered`);
    }
    return out;
  }

  /** Load the rounds in pack slot `index` into the ammo slot (rounds.js). */
  loadRounds(index) { return Rounds.loadRounds(this, index); }
  /** Take the loaded rounds back into the pack. */
  unloadRounds() { return Rounds.unloadRounds(this); }

  unequip(slot) {
    if (slot === 'ammo') return this.unloadRounds();
    const id = this.equipment.get(slot);
    if (!id) return;
    if (this.inventory.canAdd(id, 1) <= 0) { this.msg("You don't have enough inventory space."); return; }
    const q = this.equipment.qualityIn(slot);
    this.equipment.clearSlot(slot);
    this.inventory.add(id, 1, q);
    this.msg(`You remove the ${getItem(id).name.toLowerCase()}.`);
  }

  // Drop lets go of the whole stack, and a stack can now be millions (a slot
  // held 999 at most before): past that many, `ask(qty)` (the bag menu's
  // confirm) is asked first, and a no keeps it in the bag.
  dropItem(index, ask = null) {
    const s = this.inventory.slotAt(index);
    if (!s) return;
    const { id, qty } = s;
    if (qty > DROP_ASK_OVER && ask && !ask(qty)) return;
    this.inventory.removeAt(index, qty);
    const gi = this.world.addGroundItem(id, qty, this.player.x, this.player.y);
    if (s.q) gi.q = s.q;   // the copy keeps its quality on the ground
    gi.playerDropped = true;   // auto-loot leaves things you drop on purpose
    this.msg(`You drop the ${getItem(id).name.toLowerCase()}.`);
  }

  lightLogs(index) {
    const s = this.inventory.slotAt(index);
    if (!s) return;
    if (!getItem(s.id).tags?.includes('log')) { this.msg("You can't light that."); return; }
    this.startFiremaking(s.id);   // all of them (the bag asks how many first: ui.js askFireLogs)
  }

  /** The logs you can burn, best (highest Firemaking level) first. */
  burnableLogs() {
    const lvl = this.skills.level('firemaking');
    const ids = [...new Set(this.inventory.slots.filter((sl) => sl && getItem(sl.id).tags?.includes('log')).map((sl) => sl.id))];
    return ids.filter((id) => (getItem(id).firemaking || 1) <= lvl)
      .sort((a, b) => (getItem(b).firemaking || 1) - (getItem(a).firemaking || 1));
  }

  /** Light fires (the Skills menu's "Light a fire", or a log tapped in the bag).
   *  With no `logId` it burns your best logs first and moves on to the next kind
   *  when one runs out. It lights where you stand, or on the nearest free tile
   *  beside you when something is already there (a fire, a tree, a stall).
   *  (It used to aim at player.x/y even mid-step, so a tap while walking waited
   *  for a tile it had already left and nothing ever caught.) */
  startFiremaking(logId = null, count = Infinity) {
    if (!this.hasTool('tinderbox')) { this.msg('You need a tinderbox to light a fire. The Kampong Guide hands one out, and the General Store sells them.'); return false; }
    const all = !logId;
    const id = logId || this.burnableLogs()[0];
    if (!id) {
      const any = this.inventory.slots.some((sl) => sl && getItem(sl.id).tags?.includes('log'));
      this.msg(any ? 'Your Firemaking level is too low to burn any of the logs you carry.' : 'You have no logs to burn. Chop some trees first.');
      return false;
    }
    const lvl = getItem(id).firemaking || 1;
    if (this.skills.level('firemaking') < lvl) { this.msg(`You need a Firemaking level of ${lvl} to burn these logs.`); return false; }
    const tile = this._fireTile();
    if (!tile) { this.msg("There's no room to light a fire here. Step into the open."); return false; }
    return this.beginAction({ type: 'firemake', logId: id, all, tile, count }, tile, false);
  }

  /** Where a fire can go: a fire you stand on or beside (the logs pile onto it:
   *  a bigger bonfire, bonfire.js), else your own tile, else the nearest free
   *  tile within 2. */
  _fireTile() {
    const here = this.playerTile();
    const free = (x, y) => !this.world.isBlocked(x, y) && !this.world.objectAt(x, y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const o = this.world.objectAt(here.x + dx, here.y + dy);
      if (o?.def.type === 'fire') return { x: o.x, y: o.y };
    }
    if (free(here.x, here.y)) return here;
    for (let r = 1; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(here.x + dx, here.y + dy)) return { x: here.x + dx, y: here.y + dy };
      }
    }
    return null;
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
    return this.beginAction({ ...job, obj, all: kind }, { x: obj.x, y: obj.y }, true);
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
    obj.crop = c.id; obj.growLeft = growTicks(this, c.grow);   // Farming unlocks grow it faster
    this.skills.addXp('farming', c.plantXp);
    this.spawnPoof(obj.x * TILE + TILE / 2, obj.y * TILE + TILE / 2, '#8a6a3a');
    this.msg(`You plant the ${c.name.toLowerCase()} seed. It will be ready in about ${Math.ceil(c.grow * TICK_MS / 1000)}s.`);
    this.bus.emit('sfx', 'gather');
    return true;
  }

  harvestPatch(obj) {
    const c = cropFor(obj.crop);
    const lvl = this.skills.level('farming');
    // Green fingers: higher levels coax a little more from each patch (50% at
    // the crop's level + 50, then on to 75% at level 9999: trades.js).
    const n = randInt(c.yield[0], c.yield[1]) + (Math.random() < greenFingersChance(lvl, c.level) ? 1 : 0) + extraCrop(this);
    if (this.inventory.canAdd(c.id, n) <= 0) { this.msg('Your inventory is too full to harvest.'); return false; }
    this.inventory.add(c.id, n);
    this.skills.addXp('farming', c.harvestXp * n);
    obj.crop = null; obj.growLeft = 0;
    this.spawnSparkle({ x: obj.x, y: obj.y }, c.color, 10);
    this.msg(`You harvest ${n} ${c.name.toLowerCase()}.`);
    if (Math.random() < 0.25) { this.inventory.add(c.seed, 1); this.msg(`You save ${aOrAn(c.name.toLowerCase())} seed for next time.`); }
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
    if (this.blessedMs > 0 && (this.blessedMs -= dt) <= 0) {
      this.blessedMs = 0;
      this.msg('Your blessing fades.', 'system');
      this.bus.emit('xpbonus');
    }
    for (const id of Object.keys(this.potions)) {
      this.potions[id] -= dt;
      if (this.potions[id] <= 0) { delete this.potions[id]; changed = true; this.msg(`Your ${POTIONS[id].name.toLowerCase()} has worn off.`, 'system'); }
    }
    if (this.meal && (this.meal.ms -= dt) <= 0) {
      if (this.meal.fx.dmg) this.msg(`The ${getItem(this.meal.id).name.toLowerCase()} wears off.`, 'system');
      this.meal = null;
    }
    if (changed) {
      // A max-life brew (the naga elixir) wearing off takes its extra life with it.
      if (this.player.hp > this.maxHp()) { this.player.hp = this.maxHp(); this.bus.emit('hp'); }
      this.bus.emit('potions');
    }
  }

  /** Combined combat boosts from the potions you have active, for a fighting style. */
  potionMods(mode = this.combatMode()) {
    const out = {};
    // A potion that stands in for others (the phoenix elixir) leaves them out.
    const covered = new Set(Object.keys(this.potions).flatMap((id) => POTIONS[id].covers || []));
    for (const id of Object.keys(this.potions)) {
      const pot = POTIONS[id];
      if (pot.style && pot.style !== mode) continue;
      if (covered.has(pot.group)) continue;
      for (const [k, v] of Object.entries(pot.fx)) if (k !== 'heal') out[k] = (out[k] || 0) + v;
    }
    if (this.meal) for (const [k, v] of Object.entries(this.meal.fx)) out[k] = (out[k] || 0) + v;   // any style
    return out;
  }

  handleDialogueAction(action) {
    if (action === 'giveStarter') this.giveStarter();
    else if (action === 'questStart') {
      const q = this.quests.bone_collector;
      if (q.state === 'notStarted') { q.state = 'active'; this.msg('Quest started — A Bag of Bones: bring 10 bones to the Kampong Guide.', 'level'); }
    } else if (action === 'questTurnIn') this.turnInBoneQuest();
    else if (action === 'skillContracts') this.bus.emit('skillcontractsopen');   // Cikgu Surya's skilling contracts (gathering.js)
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
    else if (action.startsWith('rq:')) RQ.regionAction(this, action);
    else if (action.startsWith('moral:')) { const [, id, side] = action.split(':'); this.moralChoose(id, side); }
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
    // Pay out the lesson reward (reward.xp is listed XP: the line says what really landed).
    const got = this.skills.addXp(st.skill, st.reward.xp);
    if (st.reward.coins) this.inventory.add('coins', st.reward.coins);
    if (st.reward.item) this.inventory.add(st.reward.item, 1);
    this.msg(`Lesson complete — ${st.name}! +${xpText(got)} ${st.name} XP${st.reward.coins ? ` and ${st.reward.coins} coins` : ''}.`, 'level');
    this.spawnSparkle(this.player, '#ffe24a', 12);
    // Move on to the next lesson, or graduate.
    q.stage++;
    if (q.stage > stages.length) {
      q.state = 'done';
      // The course's own skills, each named with what it really gained (its own
      // level and golden hours change the rate, so they can differ).
      const gains = grad.skills.map((s) => `+${xpText(this.skills.addXp(s, grad.xp))} ${SKILL_BY_ID[s].name}`);
      if (grad.coins) this.inventory.add('coins', grad.coins);
      if (grad.item) this.inventory.add(grad.item, 1);
      const extra = grad.item ? ` and the ${getItem(grad.item).name}` : '';
      this.msg(`Quest complete — ${name}! Cikgu Surya honours your mastery (${gains.join(', ')} XP, +${grad.coins.toLocaleString('en-GB')} coins${extra}).`, 'level');
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
    // Slayer isn't a quest in the journal, but auto quest can run tasks back to
    // back: get one from the Slayer Master, hunt its monster kind, repeat.
    if (id === 'slayer') {
      const t = this.slayer.task;
      return t ? { kind: 'hunt', family: t.family, text: `Slayer task: slay ${t.remaining} more ${t.name}` }
        : { kind: 'npc', npcId: 'slayer_master', text: `Get a Slayer task from ${getNpc('slayer_master').name}` };
    }
    if (RQ.isRegionQuest(id)) return RQ.regionGuide(this, id);
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
        const buy = (item, what) => ({ ...npc('farmer', `${st.name}: buy ${what} from`), buy: { item, qty: 1 } });
        // Chillies come from a patch: harvest one that is ripe, wait for one
        // that is growing (other crops don't count), else plant or buy a seed.
        const growChilli = () => {
          const crop = (this._farms ||= this.world.objects.filter((o) => o.def.type === 'farm')).find((o) => o.crop === 'chilli');
          if (inv('chilli_seed')) return obj('farm_patch', `${st.name}: plant a chilli seed`);
          if (crop?.growLeft > 0) return { ...obj('farm_patch', `${st.name}: wait for your chilli to grow`), wait: true };
          return crop ? obj('farm_patch', `${st.name}: harvest your chilli`) : buy('chilli_seed', 'chilli seeds');
        };
        if (st.need.item) {
          // A made item needs its ingredients first: send the player to whichever
          // one is short (ore before the furnace, a catch before the range, logs
          // and a knife before the bench), so Go and auto quest never walk to a
          // station with nothing to work on.
          const left = st.need.qty - inv(st.need.item);
          const lesson = `${st.name}: get ${st.need.qty} ${getItem(st.need.item).name.toLowerCase()}`;
          const short = (item, per = 1) => inv(item) < left * per;
          switch (st.need.item) {
            case 'bronze_bar':
              if (short('copper_ore')) return obj('copper_rock', `${st.name}: mine copper ore (${inv('copper_ore')}/${left})`);
              if (short('tin_ore')) return obj('tin_rock', `${st.name}: mine tin ore (${inv('tin_ore')}/${left})`);
              break;
            case 'steel_bar':
              if (short('iron_ore')) return obj('iron_rock', `${st.name}: mine iron ore (${inv('iron_ore')}/${left})`);
              if (short('coal', 2)) return obj('coal_rock', `${st.name}: mine coal (${inv('coal')}/${left * 2})`);
              break;
            case 'anchovy': if (short('raw_anchovy')) return obj('fishing_spot', `${st.name}: catch raw anchovies (${inv('raw_anchovy')}/${left})`); break;
            case 'trout': if (short('raw_trout')) return obj('rod_spot', `${st.name}: catch raw trout (${inv('raw_trout')}/${left})`); break;
            case 'attack_potion':
              if (!inv('chilli')) return growChilli();
              if (!inv('vial')) return buy('vial', 'a vial');
              break;
            case 'chilli': return growChilli();
            case 'arrow_shaft':
              if (!this.hasTool('knife')) return buy('knife', 'a knife');
              if (!inv('logs')) return obj('tree', `${st.name}: chop some logs first`);
              break;
          }
          return obj(SOURCE[st.need.item] || 'tree', lesson);
        }
        if (st.skill === 'firemaking') {
          const log = this.inventory.slots.find((sl) => sl && getItem(sl.id).tags?.includes('log'));
          return log ? { kind: 'light', text: 'Firemaking: light your logs' } : obj('tree', 'Firemaking: chop some logs first');
        }
        if (st.skill === 'hunter') return this.hasTool('snare') ? obj('bird_snare', 'Hunter: check a bird snare') : buy('hunting_snare', 'a hunting snare');
        return npc(giver);
      }
      case 'bone_collector': return countBones(this.inventory) >= 10 ? npc('guide', 'Hand in to') : { kind: 'hunt', text: `Collect bones: ${countBones(this.inventory)}/10 (any kind of bones counts)` };
      case 'pest_control': return { kind: 'hunt', target: 'rat', text: `Slay rats: ${q.kills}/8` };
      case 'pillars': return !q.monument ? obj('shrine', 'Pray at the A-Worthy Monument') : !q.obelisk ? obj('mascot_statue', 'Rest at the Mascot Statue') : npc('guide', 'Hand in to');
      case 'smith_apprentice': {
        // Gather the ore for every bar still owed before the furnace, then smelt
        // them all in one visit (it used to head off as soon as it held one ore
        // and two coal, walking rock -> furnace -> rock for each bar).
        const left = 8 - inv('steel_bar');
        if (left <= 0) return npc('guide', 'Hand in to');
        // Steel needs Smithing 30, iron Mining 15 and coal its own level: until then auto
        // quest sets this aside (as Island Provisions does) rather than smelt iron bars.
        const needs = [['smithing', 30, 'smelt steel'], ['mining', getObject('iron_rock').level, 'mine iron'], ['mining', getObject('coal_rock').level, 'mine coal']]
          .find(([sk, lv]) => this.skills.level(sk) < lv);
        if (needs) return { text: `Reach ${needs[0] === 'mining' ? 'Mining' : 'Smithing'} ${needs[1]} to ${needs[2]}`, kind: 'none' };
        if (inv('iron_ore') < left) return obj('iron_rock', `Mine iron ore (${inv('iron_ore')}/${left})`);
        if (inv('coal') < left * 2) return obj('coal_rock', `Mine coal for the steel (${inv('coal')}/${left * 2})`);
        return { ...obj('furnace', `Smelt ${left} steel bar${left > 1 ? 's' : ''} at the furnace`), make: 'steel_bar' };
      }
      case 'island_defender': return this.bossKills - (q.startBoss || 0) >= 3 ? npc('guide', 'Hand in to') : { kind: 'boss', text: 'Defeat a boss' };
      case 'big_game_hunter': return this.totalKills - (q.startKills || 0) >= 50 ? npc('guide', 'Hand in to') : { kind: 'hunt', text: 'Defeat creatures' };
      case 'mystic_trial': return inv('death_rune') >= 25 ? npc('guide', 'Hand in to') : npc('mage', 'Buy death runes from');
      case 'island_provisions': {
        // Catch every salmon still owed, then cook the lot in one go (a burnt
        // one just means a few more to catch). Salmon come from the salmon runs
        // (netted, in Marina Bay: fishspots.js), and only from Fishing 30.
        const left = 10 - inv('salmon');
        if (left <= 0) return npc('guide', 'Hand in to');
        if (inv('raw_salmon') < left) {
          if (this.skills.level('fishing') < 30) return { text: 'Reach Fishing 30 to catch salmon', kind: 'none' };
          return obj('salmon_spot', `Net salmon (${inv('raw_salmon')}/${left})`);
        }
        return obj('range', `Cook your ${left} salmon on a range`);
      }
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
    this._questFamily = null;
    this._questBoss = false;
    this._pathBudget = 150000;       // quest trips can cross the whole map
    let ok = false, tooStrong = false, wildOnly = false;
    try {
      if (g.kind === 'npc') {
        const n = nearest(this.npcs.filter((x) => x.npcId === g.npcId));
        if (n) { this._mrtHopToward(n); ok = this.defaultNpcAction(n) !== false; }   // talk, or open the shop
      } else if (g.kind === 'obj') {
        const o = nearest(this.world.objects.filter((x) => x.objId === g.objId && !x.depleted));
        if (o) { this._mrtHopToward(o); this.defaultObjectAction(o); ok = !!p.action || p.isMoving; }
      } else if (g.kind === 'light') {
        if (this.burnableLogs().length) ok = this.startFiremaking() !== false;
      } else if (g.kind === 'hunt' || g.kind === 'boss') {
        const cl = this.fightLevel();
        const fits = g.kind === 'boss'
          ? (n) => n.def.boss && !n.def.fixed && this._autoCanBeat(n)   // the same can-beat check as auto battle
          : g.target ? (n) => n.npcId === g.target
          : g.family ? (n) => !n.def.boss && n.def.family === g.family
          : (n) => !n.def.boss && (n.def.level || 1) <= cl + 5;
        const mob = g.npc?.alive ? g.npc : nearest(this.npcs.filter((n) => n.alive && n.attackable && !n.temporary && fits(n)
          && (!this.world.zoneAt(n.x, n.y)?.wilderness || this.world.zoneAt(here.x, here.y)?.wilderness)));
        if (mob) {
          this._questTarget = g.target || null;
          this._questFamily = g.family || null;
          // Bosses are taken on for this quest trip only, not switched on for good.
          this._questBoss = g.kind === 'boss';
          if (this._mrtHopToward(mob)) this.walkToFar({ x: mob.x, y: mob.y });
          else if (chebyshev(here.x, here.y, mob.x, mob.y) > 12) this.walkToFar({ x: mob.x, y: mob.y });
          else this.attackNpc(mob);
          if (!this.autoBattle) this.toggleAutoBattle(true);
          ok = true;
        } else if (g.kind === 'boss') {
          // Say why: a boss you could beat that only roams the Wilderness, or none at all.
          wildOnly = this.npcs.some((n) => n.alive && n.attackable && !n.temporary && fits(n));
          tooStrong = !wildOnly;
        }
      }
    } finally { this._pathBudget = 0; }
    this.msg(ok ? `Quest: ${g.text}.` : tooStrong ? `Quest: ${g.text}, but every boss is too strong for you for now. Train up first.`
      : wildOnly ? `Quest: ${g.text}, but the only boss you can beat roams the Wilderness. Head there yourself.`
      : `Quest: ${g.text}, but I can't find the way there.`, 'system');
    if (ok && (AUTO_QUEST_ACTIONS[id] || id === 'slayer')) this.autoQuestId = id;   // auto quest works on the quest you last chose
    return ok;
  }

  // ---------------- Auto quest ----------------
  /** The quest auto quest is on: the one you last sent it to, else the first
   *  unfinished one in journal order that it knows how to do. The karma quests
   *  are a moral choice, so they are always left to the player. */
  autoQuestPick() {
    const can = (id) => AUTO_QUEST_ACTIONS[id] && this.quests[id] && this.quests[id].state !== 'done' && this.questGuide(id).kind !== 'none'
      && (id === this.autoQuestId || !this._autoQuestSkip?.has(id));
    if (this.autoQuestId === 'slayer') return 'slayer';   // Slayer tasks never run out
    if (this.autoQuestId && can(this.autoQuestId)) return this.autoQuestId;
    // Finish what you have already started before taking on anything new.
    return QUESTS.find((d) => this.quests[d.id]?.state === 'active' && can(d.id))?.id
      || QUESTS.find((d) => can(d.id))?.id || null;
  }

  /** Put auto quest on Slayer: fetch a task, hunt it down, fetch the next. */
  autoSlayer() {
    this.autoQuestId = 'slayer';
    this._autoQuestStep = null;
    if (!this.autoQuest) this.toggleAutoQuest(true);
    this.msg('Auto quest is on Slayer: it fetches a task from the Slayer Master, hunts it down and comes back for the next one.', 'system');
    this.bus.emit('autoquest');
  }

  toggleAutoQuest(on = !this.autoQuest, why = '') {
    this.autoQuest = !!on;
    this._autoQuestStep = null;
    this._autoQuestMark = null;
    this._autoQuestStuck = 0;
    if (this.autoQuest) this._autoQuestSkip = null;   // switching it back on tries everything again
    if (!this.autoQuest && this._autoQuestFight) {
      // Hand back a fight auto quest started for you.
      this._autoQuestFight = false;
      this._questTarget = null;
      this._questFamily = null;
      this._questBoss = false;
      if (this.autoBattle && !this._autoQuestKeepBattle) this.toggleAutoBattle(false);   // you had it on yourself: leave it on
    }
    if (!this.autoQuest) this._questFamily = null;   // auto battle goes back to fighting anything
    this.msg(this.autoQuest
      ? 'Auto quest on: you will start, work through and hand in your quests by yourself. Steer to pause.'
      : `Auto quest off${why ? `: ${why}` : '.'}`, 'system');
    this.bus.emit('autoquest');
  }

  /** One-line description of what auto quest is doing, for the HUD. */
  autoQuestStatus() {
    if (!this.autoQuest) return 'Off';
    const id = this.autoQuestPick();
    if (id === 'slayer') return this.slayer.task ? `Slayer: ${this.slayer.task.remaining} ${this.slayer.task.name}` : 'Slayer task';
    return id ? QUESTS.find((d) => d.id === id)?.name || id : 'No quest';
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
    if (!this.autoQuest || !p.alive || this._driving || this.waves.active) return;   // paused in the Endless Gate
    const id = this.autoQuestPick();
    if (!id) { this.toggleAutoQuest(false, 'no quests left that I can do for you.'); return; }
    const g = this.questGuide(id);
    const fighting = g.kind === 'hunt' || g.kind === 'boss';
    // A fight auto quest started has done its job: stop it and move on.
    if (this._autoQuestFight && !fighting) {
      this._autoQuestFight = false;
      this._questTarget = null;
      this._questFamily = null;
      this._questBoss = false;
      if (this.autoBattle && !this._autoQuestKeepBattle) this.toggleAutoBattle(false);
    }
    if (fighting && this.autoBattle) {
      // Auto battle was already on: point it at the quest's monsters (it would
      // otherwise go on fighting whatever it liked), and leave it on afterwards.
      if (!this._autoQuestFight) {
        this._pathBudget = 150000;
        let ok;
        try { ok = this.questTravel(id); } finally { this._pathBudget = 0; }
        if (!ok) { this.toggleAutoQuest(false, `there's nothing I can fight for "${g.text}" right now.`); return; }
        this._autoQuestFight = true;
        this._autoQuestKeepBattle = true;
      }
      return;                                         // auto battle is on the job
    }
    // Fishing spots never run dry, so a catch would go on for ever once the
    // lesson has enough: stop gathering as soon as the step wants something else.
    const a = p.action;
    if (a && (GATHER_ACTIONS.has(a.type) || a.type === 'hunt') && (g.kind !== 'obj' || a.obj?.objId !== g.objId)) { p.clearAction(); p.stop(); }
    if (p.action || p.isMoving) return;               // busy: wait until idle
    const name = id === 'slayer' ? 'Slayer' : QUESTS.find((d) => d.id === id)?.name || id;
    // (A Slayer task's text counts down every kill; keep the step steady while hunting.)
    // (Nor does a gathering count like "(3/8)" make a new step on every ore.)
    const step = id === 'slayer' ? `slayer:${g.kind}:${g.family || ''}` : `${id}:${g.objId || g.npcId || ''}:${g.text.replace(/\(\d+\/\d+/, '(')}`;
    if (step !== this._autoQuestStep) {
      this._autoQuestStep = step;
      this._autoQuestStuck = 0;
      this._autoQuestMark = null;
      this.msg(`Auto quest — ${name}: ${g.text}.`, 'system');
    }
    if (g.wait) return;              // a crop is growing: waiting is not being stuck
    // Same step, nothing gained since the last try: count it, and give up
    // after a few rather than walking back and forth forever.
    const mark = this._autoQuestFingerprint();
    if (mark === this._autoQuestMark) {
      if (++this._autoQuestStuck >= 3) {
        // A quest you didn't send it to (one you merely accepted, say at too low
        // a level) is set aside for this session so it can get on with others.
        if (id !== this.autoQuestId) {
          (this._autoQuestSkip ||= new Set()).add(id);
          if (this.autoQuestPick()) {
            this._autoQuestStep = null;
            this.msg(`Auto quest: I can't do "${g.text}" yet, so I'll leave ${name} for now.`, 'system');
            return;
          }
          this._autoQuestSkip.delete(id);   // nothing else to do: say where it got stuck
        }
        this.toggleAutoQuest(false, `I'm stuck on "${g.text}". You'll need to do this step yourself.`); return;
      }
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
        // A farm patch has to be one you can use now: ripe, or empty with a seed to plant.
        const seed = this.inventory.slots.some((sl) => sl && CROP_BY_SEED[sl.id]);
        const o = nearest(this.world.objects.filter((x) => x.objId === g.objId && !x.depleted
          && (x.def.type !== 'farm' || (x.crop ? !(x.growLeft > 0) : seed))));
        if (!o) { this.toggleAutoQuest(false, `I can't find anywhere to "${g.text}".`); return; }
        const make = AUTO_QUEST_STATION[o.def.type];
        this._mrtHopToward(o);
        if (make) {
          // A step that names what it wants (`make`) makes just that, so a spare
          // ore from a lucky swing isn't smelted into a lesser bar.
          let job = nextJob(this, make);
          for (const skip = new Set(); g.make && job && job.recipe?.result !== g.make; job = nextJob(this, make, skip)) skip.add(jobKey(job));
          if (!job) { this.toggleAutoQuest(false, `you don't have what you need to "${g.text}".`); return; }
          if (g.make) this.beginAction({ ...job, obj: o }, { x: o.x, y: o.y }, true);
          else this.startAll(make, o);
        } else {
          if (this.inventory.freeSlots() <= 0) { this.toggleAutoQuest(false, 'your bag is full. Bank or drop something and switch it back on.'); return; }
          this.defaultObjectAction(o);
        }
      } else if (g.kind === 'light') {
        if (!this.burnableLogs().length || !this.hasTool('tinderbox')) { this.toggleAutoQuest(false, 'you need logs and a tinderbox to light a fire.'); return; }
        this.startFiremaking();
      } else if (fighting) {
        if (!this.questTravel(id)) { this.toggleAutoQuest(false, `there's nothing I can fight for "${g.text}" right now.`); return; }
        this._autoQuestFight = true;
        this._autoQuestKeepBattle = false;   // auto quest switched auto battle on, so it switches it off again
      }
    } finally { this._pathBudget = 0; }
  }

  /** Auto quest reached a quest NPC: start the quest, hand it in, or (for the
   *  Mystic's Trial) buy the death runes it asks for. */
  _autoQuestTalk(id, npc) {
    if (id === 'slayer') { if (!this.slayer.task && npc.npcId === 'slayer_master') this.assignSlayerTask(); return; }
    const q = this.quests[id];
    const acts = AUTO_QUEST_ACTIONS[id];
    if (!q || !acts) return;
    // A lesson step that sends you shopping (a vial, a knife, seeds): buy it.
    const g = this.questGuide(id);
    if (g.buy && npc.def.role === 'shop') {
      if (this.inventory.count(g.buy.item) < g.buy.qty) this.buyItem(npc.def.shop, g.buy.item, g.buy.qty);
      return;
    }
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
    const price = Math.max(1, Math.round(getItem(itemId).value * shop.buyMul * this.priceFactor(shopId).buy));
    let bought = 0;
    // Stackables (runes, arrows...) are bought in one go: as many as your coins
    // cover, up to the amount asked for (a thousand at a time is common).
    if (getItem(itemId).stackable) {
      const n = Math.min(qty, Math.floor(this.inventory.count('coins') / price));
      if (n <= 0) { this.msg("You don't have enough coins."); return; }
      const got = this.inventory.add(itemId, n);   // you only pay for what fits
      if (got <= 0) { this.msg('Your inventory is full.'); return; }
      this.inventory.remove('coins', price * got);
      this.msg(`You buy ${got} x ${getItem(itemId).name} for ${price * got} coins.${got < qty ? ' (That is all your coins cover.)' : ''}`);
      return;
    }
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
    if (Rounds.isRound(id)) return !Rounds.classUsesGuns(cls.id);   // rounds, if you don't use a gun
    if (it.tags?.includes('ammo')) return cls.weapon !== 'shortbow' && cls.weapon !== 'longbow';
    const eq = it.equip;
    if (!eq) return false;
    if (eq.weaponType) return !canWield(cls.id, eq.weaponType);
    if (shieldBarred(cls.id, id)) return true;   // a Ninja's shields
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
  // Gear copies keep their quality both ways: `q` (null for plain) picks the
  // copies of one quality, and without it the plainest go first.
  deposit(itemId, qty, q) {
    const have = q === undefined ? this.inventory.count(itemId) : this.inventory.countQ(itemId, q);
    const amount = Math.min(qty, have);
    if (amount <= 0) return;
    for (const p of this.inventory.take(itemId, amount, q)) this.bank.deposit(itemId, p.n, p.q);
  }

  depositAll() {
    // Snapshot ids first; removing while iterating compacts the slots.
    const ids = [...new Set(this.inventory.slots.filter(Boolean).map((s) => s.id))];
    let moved = 0;
    for (const id of ids) {
      const n = this.inventory.count(id);
      if (n > 0) { for (const p of this.inventory.take(id, n)) this.bank.deposit(id, p.n, p.q); moved += n; }
    }
    if (moved) this.msg('You deposit your inventory.', 'system');
  }

  withdraw(itemId, qty, q) {
    const banked = q === undefined ? this.bank.count(itemId) : this.bank.items.filter((e) => e.id === itemId && (e.q || null) === q).reduce((n, e) => n + e.qty, 0);
    const want = Math.min(qty, banked);
    const amount = this.inventory.canAdd(itemId, want);
    if (amount <= 0) { this.msg('Your inventory is full.'); return; }
    for (const p of this.bank.take(itemId, amount, q)) this.inventory.add(itemId, p.n, p.q);
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
    if (!this._autoTrip) this.ui?.closeModal();   // a ride you chose closes the map; an auto trip doesn't (_autoRun)
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
    // (Loot piles up in a busy fight: only what lies beside you is scored.)
    for (const g of this.world.groundItems) if (Math.abs(g.x - at.x) <= 1 && Math.abs(g.y - at.y) <= 1) consider('item', g, g.x, g.y, 1);
    const fightReach = Math.max(2, this.attackRange());
    // Runs every frame: only the NPCs near you (nearbyNpcs reaches well past
    // any bow), not the whole world's ten thousand.
    for (const n of this.nearbyNpcs()) {
      if (!n.alive || n.ally) continue;   // mercenaries aren't interactable
      if (Math.abs(n.x - at.x) > fightReach || Math.abs(n.y - at.y) > fightReach) continue;   // beyond any reach (most of the list): no need to score it
      consider('npc', n, n.x, n.y, n.attackable ? fightReach : 2);
    }
    // Only the objects within two tiles (the world's spatial index, in list order).
    for (const o of this.world.objectsIn(at.x - 2, at.y - 2, at.x + 2, at.y + 2, this._interactObjs || (this._interactObjs = []))) {
      if (!o.def.verb || (o.def.type === 'tree' && o.depleted)) continue;
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
      if (n.def.role === 'mark') return ['Pickpocket', n.name];
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
      if (!n.alive || n.attackable || !n.def.role || n.def.moral) continue;
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

  /** Next target (the round button by Attack, or Tab): switch to the next
   *  closest enemy within reach. Repeated presses step through every foe in
   *  reach, nearest first, before coming back round; a pause of a few seconds
   *  starts the round again from the nearest. Returns the new target. */
  nextTarget() {
    const p = this.player;
    if (!p.alive) return null;
    const a = p.action;
    const cur = a && a.type === 'attack' && a.npc && a.npc.alive ? a.npc : null;
    const dist = (n) => Math.hypot(n.x - p.fx, n.y - p.fy);
    const foes = this.nearbyNpcs().filter((n) => n.alive && n.attackable && !n.ally && !n.temporaryAlly
      && !(n.def.fixed && n.target !== p && n !== cur) && dist(n) <= 10).sort((x, y) => dist(x) - dist(y));
    if (!foes.length) { this.msg('No enemies nearby.', 'system'); return null; }
    if (!this._cycle || this.playMs - this._cycle.at > 4000) this._cycle = { seen: new Set() };
    this._cycle.at = this.playMs;
    if (cur) this._cycle.seen.add(cur);
    let next = foes.find((n) => n !== cur && !this._cycle.seen.has(n));
    if (!next) {   // every foe in reach has had a turn: round again from the nearest
      this._cycle.seen = new Set(cur ? [cur] : []);
      next = foes.find((n) => n !== cur) || foes[0];
    }
    this._cycle.seen.add(next);
    if (next !== cur) this.attackNpc(next);
    if (this.autoBattle) { this._autoLast = next; this._autoFight = null; }   // auto battle keeps fighting the one you picked
    this.addHitsplat(next, 0, { text: 'Target' });
    return next;
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
  // Right-clicking a monster offers Examine, which opens its Monster Codex entry.
  onRightClick(x, y) { this.ui?.hideContextMenu(); if (x !== undefined) this.ui?.worldRightClick?.(x, y); }
}
