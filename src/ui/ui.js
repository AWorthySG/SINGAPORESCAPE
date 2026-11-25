import { CLASSES, CLASS_BY_ID, WEAPON_TYPE_NAMES, starterWeapon, canWear, ARMOUR_FAMILY, ARMOUR_FAMILIES, canWield, SECONDARY_WEAPON, shieldBarred, noShieldMsg, weaponTypeOf, sigBarred } from '../data/classes.js';
import { SKILL_HOURS, windowLabel } from '../data/skillhours.js';
import { classPerks, classPerkSummary, classKeyPerks } from '../game/classperks.js';
import { LIFE_PERKS, LIFE_PERK_SKILLS, LIFE_PERK_FULL_LEVEL, LIFE_PERK_MAX_LEVEL, LIFE_PERK_TOP_LEVEL, lifePerkText, lifePerkNext } from '../game/lifeperks.js';
import { unlockTipText } from '../game/skillunlocks.js';
import { installHomeUI } from './homeui.js';
import { installStoryUI, speakerArt } from './storyui.js';
import { installReputationUI } from './reputationui.js';
import { personalise } from '../game/memory.js';
import * as Mercs from '../game/mercenary.js';
import { PERK_SKILLS, PERK_TRACKS, PERK_EVERY, trackPerks, rankName } from '../data/perks.js';
import { heroArtSrc, portraitFor } from '../render/sprites.js';
import { HeroStage, swingActor, prefersReducedMotion } from './title.js';
import { getItem } from '../data/items.js';
import { SHOPS, getShop } from '../data/shops.js';
import { SMELT, SMITH, smithToolRows } from '../data/smithing.js';
import { CRAFT } from '../data/crafting.js';
import { POTIONS, FLETCH, CROP_BY_SEED } from '../data/trades.js';
import { COOKING, makeXp } from '../game/skilling.js';
import { DISHES } from '../data/cooking.js';
import { SKILLS, SKILL_GROUPS } from '../data/skills.js';
import { SKILL_GUIDES } from '../game/skillguide.js';
import { openSkillGuide as openGuide, gatherPicksHTML } from './skillguideui.js';
import { OBJECTS } from '../data/objects.js';
import { SUBJECTS, SUBJECT_BY_ID, TOPICS, TOPIC_BY_ID } from '../data/questions.js';
import { DAILY_COUNT } from '../game/learning.js';
import * as Hawker from '../game/hawker.js';
import { buildReport, verifyReport } from '../game/report.js';
import { getDialogue } from '../data/dialogue.js';
import { moralDialogue, MORAL_BY_ID, MORAL_EVENTS, moralCoins } from '../data/moralEvents.js';
import { ALL_MONSTER_IDS as MONSTER_IDS, ALL_BOSS_IDS as BOSS_IDS, getNpc } from '../data/npcs.js';
import { SIGNATURE_CLASS, SIGNATURE_DROP_CHANCE, sigIdFor } from '../data/bossWeapons.js';
import { levelProgress, xpToNext, maxLevelFor } from '../data/xp.js';
import { stackLabel, capitalize, formatNumber, shortNumber, aOrAn } from '../core/utils.js';
import { RHYTHM_MAX, levelBonuses, playerMagicVsNpc } from '../game/combat.js';
import { CHI, chiStacks } from '../game/monk.js';
import { classPassives, CLASS_SKILL } from '../data/classPassives.js';
import { ELEMENTS, spellsFor, classSpell } from '../data/magic.js';
import { buildBlessingsPanel, renderBlessingsPanel, renderFaithOrb } from './blessingsui.js';
import { ACHIEVEMENTS, rewardFor } from '../data/achievements.js';
import { QUESTS } from '../data/quests.js';
import { SLAYER_REWARDS, SLAYER_FULL_LEVEL, SLAYER_HELM_DMG, slayerBuffs, nextSlayerUnlock } from '../data/slayer.js';
import { STATIONS, MRT_FARE } from '../data/transport.js';
import { EQUIP_SLOTS, canDualPair, isTwoHanded, offhandBlocked, takesQuiver } from '../game/equipment.js';
import { streakMult } from '../game/bounty.js';
import { itemCategory } from '../game/inventory.js';
import { MASTERY_RANKS, MAX_ENCHANTS, rankProgress, enchantLabel, compareEnchantOffer, masteryTypeName, STONE as UP_STONE, WARD as UP_WARD } from '../game/mastery.js';
import { MAX_REFINE, SCROLL as REFINE_SCROLL, refineCost, refineOdds, refineTag, refinedBonuses } from '../game/refine.js';
import { planCarry, carrySummary } from '../game/carry.js';
import { MATERIAL_KINDS, feedKind, FEED_CAP, FEED_CAP_RANK, materialKind } from '../game/materials.js';
import { SHRINE_TRACKS, SHRINE_TRACK_IDS, trackText } from '../game/shrine.js';
import { isSalvageable, sameKind, nearOfferingShrine } from '../game/salvage.js';
import { QUALITY, qualityNameHTML } from '../game/loot.js';
import { ranksCardHTML, openRanksGuide, masteryLine, masteryProgressText, qualityLine } from './ranksui.js';
import { openSacrifice, openSacrificeFrom, openDismantle, shrineGearSection, askOffer, redraw } from './salvageui.js';
import { hotOffer, TAP_HINT, HOT_HINT } from './shrinehot.js';
import { shrineGoodsSection, askGoods, shrineMaxButton } from './shrineui.js';
import { goodsKind } from '../game/offerings.js';
import { ATTRS, ATTR_NAMES, attrSummary, attrForMode, MAX_STAT_POINTS, RESET_COST_PER_POINT, holdRepeatDelay } from '../game/attributes.js';
import { STAT_LABELS, STAT_HELP, compareGear, deltaText, effectiveRating, gearBySlot, gearRating, meetsReq, swingBeats, tierOf, weaponStyle } from '../game/gear.js';
import { TILE, LEARNING_ENABLED, TICK_MS } from '../config.js';
import { zoneLevel } from '../data/world.js';
import { paintMinimapTerrain, minimapNpcKind, MINIMAP_DOT, MinimapChunks, bakeMinimapPatch, minimapObjectBadge, minimapNpcBadge, BADGE_ESSENTIAL, badgeSprite, minimapRing, rimPoint } from '../render/minimapart.js';
import { clearSave, suppressSaves, exportSaveCode, importSaveCode } from '../game/save.js';
import { statSheet } from '../game/statsheet.js';
import { statsPanelHTML } from './statspanel.js';
import { gearWorthNotes, gearSwapWorth, fmtWorth, worthTable } from '../game/statworth.js';
import { openCodex, monsterAtScreen, openCompendium } from './codexui.js';
import { setLinkedText, linkHTML } from './links.js';   // names that open their encyclopedia entry
import { openEntry } from './encyclopediaui.js';
import { openPestOfficer, contractTrackerRows, stewardLineHTML, cullingInvOptions } from './cullingui.js';
import { eventsPanelHTML, wireEventsPanel, eventTrackerRows, drawEventMarker } from './worldeventsui.js';
import { keyedSlots, placeSlots } from './slotgrid.js';
import { WindowMemory, initWindowEase, toggleTapClose } from './windowease.js';   // windows remember where you were; tap outside to close
import { itemIconSVG, skillIconSVG, tabIconSVG, sunIconSVG, moonIconSVG, abilityIconHTML, spellIconHTML, playIconHTML, lazyIcon, glyphArtHTML } from '../render/icons.js';
import { abilitiesFor } from '../data/abilities.js';   // a class's skills, for its Skills & perks window
import { weaknessOf, armourTierOf, ARMOUR_TIERS, levelFlatDmg } from '../game/combat.js';
import { isBone } from '../data/bones.js';
import { RACES, raceOf, weaponsFor, weaponTypeName, WEAPON_VS_RACE } from '../data/races.js';
import { WaveHud } from './wavehud.js';
import { PlayHud } from './playhud.js';
import { CompactHud } from './compacthud.js';
import { feedAllPlan, feedAll } from '../game/feedall.js';   // "Feed materials to worn gear" in one go
import { upgradeSlots, wouldWear, carryPreview } from '../game/bestpick.js';   // Equip best's own rule, for every upgrade signal
import { improveCount } from '../game/smartgear.js';
import { mountRefineRun, mountEnchantRun, openImprove } from './smartgearui.js';   // refine and enchant runs, "Improve worn gear"
export const COLLAPSE_V = 2;   // the saved fold states' version (see _loadCollapse)
export const TIP_LINGER_MS = 1000;   // an item's hover description stays this long after the pointer leaves
export const CHAT_LINES = 120;   // the chat keeps (and its log shows) this many lines
export const MINIMAP_LONG_NAME = 16;   // a minimap area name longer than this is set smaller (setRegion)
/** The world map's lettering, in canvas pixels: `screenPx` on screen once the
 *  canvas (drawn at 2+ pixels a tile) is shrunk `k` times to fit its window, and
 *  never under `base`. Sized in canvas pixels alone, the names came out 3-5px
 *  tall on screen, too small to read on a phone or a desktop. */
export const mapLabelPx = (screenPx, k, base) => Math.round(Math.max(base, screenPx * k));
/** At this many canvas pixels to a screen pixel or more (a phone), the map
 *  leaves out the resource zones', groves' and quarries' names: too many to fit
 *  beside the regions' own, so only their dots stay (a tap still names them). */
export const MAP_GROVE_NAMES_K = 2.5;
import { NoticeLane, afterLayout } from './noticelane.js';
import { QuickSlot, interactCaption, trackerHTML, TRACKER_ROWS, TRACKER_ROWS_PHONE, sellSideSmall, loadTrackerFolded, saveTrackerFolded, sheetSnap } from './hudease.js';
import { QuickBar } from './quickbar.js';
import { makeQtyRow, makePill, maxMakes, makeQtyOf } from './makeqty.js';
import { CmdSearch } from './cmdsearch.js';
import { addCollectionButton } from './collectionui.js';
import { renderHpBar } from './hpbar.js';
import { PanelSizer } from './panelsize.js';
import { TIPS, TIPS_KEY, TIP_MS, nextTip, markTipSeen, tipsSeen } from './tips.js';
import { labelMode, nextLabelMode, LABEL_MODE_NAMES, questNpcIds } from '../render/worldlabels.js';
import { applyAccessibility, countUp, playCloseGhost, inlineIcon } from './uifx.js';
import { installPressStates, easeHeight, swapIn, staggerIn, bump, sheetCloseGhost, celebrateLevel } from './motion.js';
import { mechLabel } from '../game/bossmech.js';
import { renderBossBar } from './bossbar.js';
import { whatNextHTML, wireWhatNext, whatNextTrackerRows, watchUpgrades, watchGoals } from './whatnextui.js';
import { depositLootButton, keepMenuItem, markKept } from './bankkeepui.js';
import { levelNews, levelNewsText } from '../game/levelnews.js';
import { whatNext } from '../game/whatnext.js';
import { XpDisplay } from './xpdisplay.js';
import { crossesMilestone, xpDisplayMode, nextXpDisplay, XP_DISPLAY_NAMES } from '../game/xptrack.js';
import { regionDialogue, canRegionTeleport, regionTeleport } from '../game/regionquests.js';
import { installLifeSkillUI, lifeTrackerRows } from './lifeskillui.js';
import { isRound, isGunId } from '../game/rounds.js';

const EQUIP_LAYOUT = [
  null, 'head', null,
  'cape', 'amulet', 'ammo',   // ammo: gun rounds (rounds.js), not one of the gear slots
  'weapon', 'body', 'shield',
  null, 'legs', null,
  'hands', 'feet', 'ring',
];

/** A dialogue's choices, with its farewell apart: the last option when it
 *  only ends the talk (no action, nowhere to go) and there are others to
 *  pick. It shows as a small "Goodbye" button rather than a full-width choice. */
export function farewellSplit(options = []) {
  const last = options[options.length - 1];
  const bye = options.length > 1 && last && !last.action && (!last.next || last.next === 'end') ? last : null;
  return { main: bye ? options.slice(0, -1) : options, bye };
}

// A region recommends a level "well above" yours once it's past a quarter more
// (plus a little, so the low levels aren't all flagged). Warns only; never blocks.
const tooHigh = (rec, you) => rec > 0 && rec > you * 1.25 + 5;
// World map marker filters: id, chip label, marker colour.
const MAP_FILTERS = [
  { id: 'mrt', name: 'MRT', col: '#ffffff' },
  { id: 'boss', name: 'Bosses', col: '#ff4a5a' },
  { id: 'bank', name: 'Banks', col: '#ffd24a' },
  { id: 'tree', name: 'Trees', col: '#b6f55a' },
  { id: 'rock', name: 'Rocks', col: '#e2e2e2' },
  { id: 'fishing', name: 'Fishing', col: '#7fd8ff' },
  { id: 'hunt', name: 'Traps', col: '#e0a060' },
  { id: 'farm', name: 'Farms', col: '#c9e26a' },
  { id: 'station', name: 'Crafting', col: '#f5a623' },
];

// Everything a finger means to press rather than drag. A phone sheet's drag
// (see _initSheets) never starts on one of these, so it never captures the
// pointer away from a tab, slot, row or button and eats its tap.
// The side panel's five tabs, each named by its first view (the tab button's
// data-view), and the views it holds. A tab with more than one view shows a
// row of sub-tabs at the top of the panel body to switch between them.
export const PANEL_TABS = {
  inventory: ['inventory', 'equipment'],
  skills: ['skills'],
  combat: ['combat', 'prayer', 'stats'],
  quests: ['quests', 'achievements', 'story'],
  settings: ['settings'],
};
const SUBTAB_LABELS = { inventory: 'Bag', equipment: 'Gear', combat: 'Combat', prayer: 'Blessings', stats: 'Stats', quests: 'Quests', achievements: 'Awards', story: 'Story' };
/** The tab that holds a view ('prayer' -> 'combat'). */
export const tabOfView = (view) => Object.keys(PANEL_TABS).find((t) => PANEL_TABS[t].includes(view)) || null;

const PRESSABLE = 'button, a, input, select, textarea, label, summary, [role="button"], '
  + '.tab-btn, .inv-slot, .equip-slot, .item-cell, .prayer-cell, .quest-row, .ctx-item, .dialogue-option';

/** Whether a pointerdown on this element may start dragging a sheet. */
export function sheetDragStarts(target) {
  return !target?.closest?.(PRESSABLE);
}

export class UI {
  constructor(game) {
    this.game = game;
    this.bus = game.bus;
    this.el = {};
    this.modal = null;        // { type, render }
    this.chatFilter = 'all';
    this.chatMessages = [];
    this._lastHover = '';
    this.minimapCtx = null;
  }

  init() {
    const id = (x) => document.getElementById(x);
    this.winMem ||= new WindowMemory(this);
    this.el = {
      hover: id('hover-text'),
      tracker: id('quest-tracker'),
      region: id('region-label'),
      xpDrops: id('xp-drops'),
      chatLog: id('chat-log'),
      inventory: id('inventory-grid'),
      equipLayout: id('equipment-layout'),
      equipBonuses: id('equipment-bonuses'),
      skillsGrid: id('skills-grid'),
      skillsTotal: id('skills-total'),
      combat: id('combat-panel'),
      prayerPanel: id('prayer-panel'),
      questPanel: id('quest-panel'),
      achievementPanel: id('achievement-panel'),
      statsPanel: id('stats-panel'),
      settings: id('settings-panel'),
      contextMenu: id('context-menu'),
      tooltip: id('tooltip'),
      modalOverlay: id('modal-overlay'),
      modalTitle: id('modal-title'),
      modalBody: id('modal-body'),
      modalClose: id('modal-close'),
      bossBar: id('boss-bar'),
      bossBarName: id('boss-bar-name'),
      bossBarFill: id('boss-bar-fill'),
      daynightBadge: id('daynight-badge'),
      daynightSun: id('daynight-sun'),
      daynightMoon: id('daynight-moon'),
      hpOrb: id('hp-orb'),
      hpOrbVal: id('hp-orb-value'),
      prayerOrb: id('prayer-orb'),
      prayerOrbVal: id('prayer-orb-value'),
      runOrb: id('run-orb'),
      runOrbVal: id('run-orb-value'),
      specOrb: id('spec-orb'),
      specOrbVal: id('spec-orb-value'),
      minimap: id('minimap-canvas'),
      minimapRegion: id('minimap-region'),
      mapBtn: id('map-btn'),
    };
    // The minimap draws in its own 160-unit square, backed by the screen's
    // pixels (shown a little larger than 160px, minimap.css) so the badges,
    // arrow and ring stay crisp; at most three pixels per unit.
    this._mmSize = this.el.minimap.width;
    this._mmDpr = Math.min(3, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1) * 1.1);
    this.el.minimap.width = this.el.minimap.height = this._mmSize * this._mmDpr;
    this.minimapCtx = this.el.minimap.getContext('2d');

    // Tab buttons: the mascot icon plus a short label, so each tab is easy to find.
    const TAB_LABELS = { inventory: 'Bag', skills: 'Skills', combat: 'Combat', quests: 'Journal', settings: 'Settings' };
    document.querySelectorAll('#panel-tabs .tab-btn').forEach((b) => {
      b.innerHTML = tabIconSVG(b.dataset.view, 32) + `<span class="tab-label">${TAB_LABELS[b.dataset.view] || ''}</span>`;
      b.setAttribute('aria-label', b.title || TAB_LABELS[b.dataset.view] || b.dataset.view);
    });
    this.el.panelHead = document.getElementById('panel-head');
    this.el.panelTitle = document.getElementById('panel-title');
    this.el.panelCollapse = document.getElementById('panel-collapse');
    this.el.sidepanel = document.getElementById('sidepanel');
    // Its window size: Normal / Large / Extra large / Full height, the − / + buttons and the grips (panelsize.js).
    this.panelSize = new PanelSizer(this.el.sidepanel, this.el.panelHead);
    this._setPanelTitle('inventory');
    // Phones (portrait or landscape): enables the fold-on-retap tab behaviour.
    if (typeof matchMedia === 'function') {
      const mq = matchMedia('(max-width: 540px), (max-height: 500px)');
      const set = () => this.el.sidepanel?.classList.toggle('compact-ui', mq.matches);
      set(); mq.addEventListener?.('change', set);
    }
    this._initCollapsibles();

    this._bindTabs();
    // The Bag tab opens on whichever of Bag / Gear it showed last time.
    this._showPanelView(PANEL_TABS.inventory.includes(this._subView?.inventory) ? this._subView.inventory : 'inventory');
    this._bindChatTabs();
    this._buildCombatPanel();
    this._buildPrayerPanel();
    this._buildSettingsPanel();
    // Text size, colour-blind colours and reduced motion live on <body>. A save
    // loads after the UI is built, so check again each tick (a cheap string compare).
    this._accessSig = applyAccessibility(this.game);
    this.bus.on('tick', () => {
      const sig = applyAccessibility(this.game);
      if (sig !== this._accessSig) { this._accessSig = sig; this._buildSettingsPanel(); }
    });
    this._buildAbilityBar();
    document.getElementById('auto-battle-btn')?.addEventListener('click', () => this.game.toggleAutoBattle());
    document.getElementById('auto-gather-btn')?.addEventListener('click', () => this.game.toggleAutoGather());
    document.getElementById('auto-quest-btn')?.addEventListener('click', () => this.game.toggleAutoQuest());
    document.getElementById('auto-battle-cfg')?.addEventListener('click', () => this.openAutoSettings());
    this._initAutoMenu();
    this._initSheets();
    this._initPressHold();
    this._initWindowHotkeys();
    document.getElementById('interact-btn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); this.game.interact(); });
    // Attack: a tap locks onto the nearest enemy; holding it keeps fighting,
    // moving straight on to the next foe as each one falls.
    const atk = document.getElementById('attack-btn');
    if (atk) {
      const release = () => { this.game.releaseAttack(); atk.classList.remove('held'); };
      atk.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { atk.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        this.game.attackHeld = true; atk.classList.add('held');
        this.game.attackNearest();
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) atk.addEventListener(ev, release);
    }
    // Next target: step through the enemies in reach (Tab on a keyboard).
    document.getElementById('target-btn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); this.game.nextTarget(); });
    this.renderAutoBattle();

    this.el.runOrb?.remove();   // no run energy any more: everyone always runs
    this.el.specOrb.addEventListener('click', () => this.game.toggleSpec());
    if (this.el.minimap) { this.el.minimap.style.cursor = 'var(--cur-pointer)'; this.el.minimap.title = 'Open world map (M)'; this.el.minimap.addEventListener('click', () => this.openWorldMap()); }
    if (this.el.mapBtn) this.el.mapBtn.addEventListener('click', () => this.openWorldMap());
    // Tap the foe's portrait on the battle bar to look it up in the Monster Codex
    // (the phone-friendly way to examine a monster; right-click works on desktop).
    const portrait = this.el.bossBar?.querySelector?.('#boss-bar-portrait');
    if (portrait) {
      portrait.title = 'Look it up in the Monster Codex';
      portrait.addEventListener('click', () => { if (this._bossPortraitFor) this.openBestiary(this._bossPortraitFor.npcId); });
    }
    this.el.modalClose.addEventListener('click', () => this.closeModal());
    initWindowEase(this);   // a tap outside closes the window (and walks there); swipe the title down (windowease.js)
    document.addEventListener('mousedown', (e) => {
      if (!this.el.contextMenu.contains(e.target)) this.hideContextMenu();
    });
    // One delegated, quiet click tick for every HUD control.
    document.addEventListener('click', (e) => {
      if (e.target.closest('button, .chat-tab, .ctx-item, .dialogue-option, .inv-slot.filled, .equip-slot.filled, .item-cell, .orb')) {
        this.bus.emit('sfx', 'click');
      }
    });

    // Bus subscriptions.
    this.bus.on('tick', () => { this.renderAutoBattle(); this.updateBossBar(); this.updateDayNight(); this.renderTracker(); this._tipsTick(); });
    this._initMinimalHud();
    this.waveHud = new WaveHud(this);   // the Endless Gate's run panel
    this.playHud = new PlayHud(this);   // Focus, Rested and the Grave button (playhud.js)
    this.lane ||= new NoticeLane(this);   // the one notification lane (noticelane.js)
    this.quickSlot = new QuickSlot(this);   // food / potion button beside Attack (hudease.js)
    this.bus.on('tick', () => this.lane.placeSoon());
    this.xpHud = new XpDisplay(this);   // XP counter, progress ring and level-up toasts (xpdisplay.js)
    this.compactHud = new CompactHud(this);   // Auto caption, quiet chat, area name on arrival (compacthud.js)
    this.cmdSearch = new CmdSearch(this);   // the / or Ctrl+K search box (cmdsearch.js)
    this.quickBar = new QuickBar(this);     // one-tap favourites (quickbar.js)
    watchUpgrades(this);   // "Wear it" when loot beats your gear (whatnextui.js)
    watchGoals(this);      // the journal's "What next?" card follows the goals
    this.bus.on('inventory', () => this.scheduleInventory());
    installPressStates();   // pressed looks on iPhones (motion.js)
    // Loot landing: the Bag tab (or the phone's folded menu button) gives a little hop.
    this.bus.on('sfx', (n) => { if (n === 'pickup') this._soon('lootBump', () => this._lootBump()); });
    // Gear changes come in bursts (every worn piece gains mastery on a kill), so redraw once a frame.
    this.bus.on('equipment', () => { this._soon('equipment', () => this.renderEquipment()); this._soon('combat', () => this.renderCombatPanel()); this.scheduleInventory(); });
    // Busy events (every hit gives XP, adrenaline, rhythm) only mark a panel to
    // redraw; _soon redraws it once on the next frame (the Skills list at most
    // ~3 times a second), instead of rebuilding it for every single hit.
    this.bus.on('rhythm', () => { if (this.game.combatMode() === 'dance') this._soon('combat', () => this.renderCombatPanel(), 150); });
    this.bus.on('chi', () => this._soon('combat', () => this.renderCombatPanel(), 150));   // a Monk's Chi
    this.bus.on('skills', () => { this._soon('skills', () => this.renderSkills()); this._soon('combat', () => this.renderCombatPanel()); });
    this.bus.on('xp', (p) => { this._soon('skills', () => this.renderSkills(), 350); this.showXpDrop(p); });
    this.bus.on('learning', () => this._soon('skills', () => this.renderSkills()));   // Codex button shows Wisdom and cards
    this.bus.on('levelup', (p) => this.onLevelUp(p));
    // New stat points can come with a level, and spending them changes the Stats box.
    // A stat spend only changes the stats box (and max life, via 'hp'): update
    // it in place rather than rebuilding the whole Combat panel per point.
    this.bus.on('stats', () => this._updateStats());
    this.bus.on('levelup', () => this._soon('combatStats', () => this.renderCombatPanel(), 400));
    this.bus.on('chat', (p) => this.addChat(p.text, p.cls));
    this.bus.on('hp', () => this._soon('hp', () => this.renderHp()));
    this.bus.on('run', () => this.renderRun());
    this.bus.on('spec', () => this.renderSpec());
    this.bus.on('equipment', () => { this._soon('spec', () => this.renderSpec()); this._soon('abilities', () => this.renderAbilities()); });
    this.bus.on('adrenaline', () => this._soon('abilities', () => this.renderAbilities(), 100));
    this.bus.on('ability', () => this._soon('abilities', () => this.renderAbilities()));
    this.bus.on('autobattle', () => this.renderAutoBattle());
    this.bus.on('autoquest', () => { this.renderQuestPanel(); this.renderAutoBattle(); });
    this.bus.on('autogather', () => this.renderAutoBattle());
    this.bus.on('karma', () => { this.renderAlignment(); this._refreshModalIfOpen(['shop']); });
    // Faith moves on every hit: draw the orb (and the Blessings panel) once per burst.
    this.bus.on('prayer', () => this._coalesce('prayer', () => { this.renderPrayer(); this.renderPrayerPanel(); }));
    this.bus.on('skills', () => this.renderPrayerPanel());
    this.bus.on('quest', () => { this.renderQuestPanel(); this._trackerSoon(); });
    this.bus.on('bounties', () => { this.renderQuestPanel(); this._trackerSoon(); });
    this.bus.on('worldevents', () => this._soon('worldevents', () => { this.renderQuestPanel(); this.renderTracker(); }, 1000));   // world events (worldeventsui.js)
    this.bus.on('xpbonus', () => this._trackerSoon());
    this.bus.on('spell', () => this.renderCombatPanel());
    this.bus.on('mercs', () => this.renderCombatPanel());
    this.bus.on('achievement', () => this._soon('achievements', () => this.renderAchievementPanel()));
    // The Stats tab: anything that changes a final stat redraws it (a few times a second at most),
    // and the tick keeps its potion and buff timers counting down.
    for (const ev of ['equipment', 'skills', 'stats', 'potions', 'prayer', 'ability', 'karma', 'slayer', 'spell', 'xpbonus', 'hp', 'tick', 'rhythm', 'chi', 'culling']) {
      this.bus.on(ev, () => this._soon('statsTab', () => this.renderStatsPanel(), 300));
    }
    this.bus.on('slayer', () => { this._refreshModalIfOpen(['slayer', 'slayerRewards']); this._trackerSoon(); });
    this.bus.on('bank', () => this._refreshModalIfOpen(['bank']));
    // Culling (culling.js): contracts, Stewardship and the token shop, a few times a second at most.
    this.bus.on('culling', () => this._soon('culling', () => { this._refreshModalIfOpen(['pest', 'pestShop']); this.renderTracker(); this.renderAlignment(); }, 250));

    this.renderInventory();
    this.renderEquipment();
    this.renderSkills();
    this.renderCombatPanel();
    this.renderPrayerPanel();
    this.renderQuestPanel();
    this.renderAchievementPanel();
    this.renderHp();
    this.renderRun();
    this.renderPrayer();
    this.renderSpec();
    this.renderAbilities();
    this.renderTracker();
    installHomeUI(this);   // the kampong home's panel and its button by the map (homeui.js)
    installStoryUI(this);  // the Journal's Story view and chapter scenes (storyui.js)
    installReputationUI(this, PANEL_TABS, SUBTAB_LABELS);   // the Journal's Regions view and the region pill (reputationui.js)
    installLifeSkillUI(this);   // Town / Grave teleports, skilling contracts (lifeskillui.js)
  }

  // ---------------- Active-combat ability bar ----------------
  _buildAbilityBar() {
    this.el.adrenalineFill = document.getElementById('adrenaline-fill');
    this.el.adrenalineVal = document.getElementById('adrenaline-val');
    const wrap = document.getElementById('ability-buttons');
    this.el.abilityBar = document.getElementById('ability-bar');
    if (!wrap) return;
    wrap.innerHTML = '';
    this._abilityBtns = {};
    // The bar reflects the weapon in hand; renderAbilities rebuilds it on a swap.
    const set = this.game.currentAbilities();
    this._abilitySig = set.map((a) => a.id).join(',');
    for (const ab of set) {
      const btn = document.createElement('button');
      btn.className = 'ability-btn';
      btn.dataset.ability = ab.id;
      // Our own hover card (the browser's title tip didn't show: the button redraws
      // every tick as its cooldown counts down). Mouse only: a touch uses the skill.
      btn.setAttribute('aria-label', `${ab.name} (${ab.key})`);
      btn.dataset.tipHost = '';
      btn._tipGet = () => this._skillTipHTML(ab);
      btn.addEventListener('mouseenter', (e) => { if (!this._touchUsed) this.showTooltip(e, this._skillTipHTML(ab), btn); });
      btn.addEventListener('mousemove', (e) => { if (!this._touchUsed) { clearTimeout(this._tipLinger); this._tipLingerArmed = false; this.moveTooltip(e); } });
      btn.addEventListener('mouseleave', () => this._lingerHide());
      btn.innerHTML =
        `<span class="ab-key">${ab.key}</span>` +
        `<span class="ab-icon">${abilityIconHTML(ab.id, 36)}</span>` +
        `<span class="ab-cost">${this.game.abilityCoinCost(ab) ? inlineIcon(itemIconSVG('coins', 12)) : ab.cost || (ab.build ? `+${ab.build}` : '·')}</span>` +
        `<span class="ab-cd"></span>`;
      this._bindSkillAim(btn, ab);
      wrap.appendChild(btn);
      this._abilityBtns[ab.id] = btn;
    }
  }

  /** Skill buttons, MOBA style: a tap uses the skill on your current (or the
   *  nearest) foe; dragging away from the button aims it, showing the aim on
   *  the ground, and letting go fires it at the foe in that direction. Letting
   *  go on the cancel button (or back on the skill) cancels. Guard and heal
   *  skills don't aim. */
  _bindSkillAim(btn, ab) {
    const g = this.game;
    const AIM_PX = 16;
    let start = null;
    const cancelEl = document.getElementById('aim-cancel');
    const overCancel = (e) => {
      if (!cancelEl || cancelEl.classList.contains('hidden')) return false;
      const r = cancelEl.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    const end = () => { start = null; g.aim = null; btn.classList.remove('aiming'); cancelEl?.classList.add('hidden'); cancelEl?.classList.remove('hot'); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY, aiming: false };
      try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    btn.addEventListener('pointermove', (e) => {
      if (!start || ab.kind !== 'attack') return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y, d = Math.hypot(dx, dy);
      if (d < AIM_PX) { if (start.aiming) g.aim = { dir: null, cancel: true }; return; }
      start.aiming = true;
      btn.classList.add('aiming');
      cancelEl?.classList.remove('hidden');
      const hot = overCancel(e);
      cancelEl?.classList.toggle('hot', hot);
      if (hot) { g.aim = { dir: null, cancel: true }; return; }
      const dir = { x: dx / d, y: dy / d };
      g.aim = { dir, foe: g.nearestFoe(dir) };
    });
    btn.addEventListener('pointerup', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y, d = Math.hypot(dx, dy);
      if (!start.aiming) g.useSkillAt(ab.id);                          // a plain tap
      else if (d >= AIM_PX && !overCancel(e)) g.useSkillAt(ab.id, { x: dx / d, y: dy / d });
      end();                                                             // dragged back: cancelled
    });
    btn.addEventListener('pointercancel', end);
  }

  /** Under the combat styles: which races the weapon in hand is strong and weak against. */
  _renderRaceHint(after) {
    let el = this._raceHint;
    if (!el) {
      el = this._raceHint = document.createElement('div');
      el.className = 'race-hint';
      after.parentNode?.insertBefore(el, after.nextSibling);
    }
    const wt = this.game.weaponType();
    if (!wt || !WEAPON_VS_RACE[wt]) { el.innerHTML = '<b>Races</b><span>Wield a weapon to see which races it works best against.</span>'; return; }
    const m = WEAPON_VS_RACE[wt];
    const list = (ids) => ids.map((r) => `${RACES[r].icon} ${escapeHtml(RACES[r].name)}`).join(', ');
    el.innerHTML = `<b>Your ${escapeHtml(weaponTypeName(wt))} against races</b>`
      + `<span class="rh-strong">Strong vs ${list(m.strong)}: +30% damage</span>`;   // (no race resists a weapon any more)
  }

  /** Label the Interact button with what it will do right now. */
  setInteractLabel(label) {
    const btn = this.el.interact || (this.el.interact = document.getElementById('interact-btn'));
    if (!btn) return;
    const keep = !!(label && label[0] === 'Attack' && label[4]);   // the Attack button would go for another foe (game._interactLabel)
    const key = label ? `${label[0]}|${label[2] || ''}|${label[3] || keep ? label[1] : ''}` : '';
    if (key === this._interactKey) return;
    this._interactKey = key;
    btn.classList.toggle('idle', !label);
    // Touch screens already have the big Attack button, so an "Attack" here
    // would be a second one; main.css hides it then (see .is-attack).
    // (Unless the big button would go for a different foe: then this one is the
    // only way to attack the one beside you, so it stays.)
    btn.classList.toggle('is-attack', !!(label && label[0] === 'Attack') && !keep);
    // Gathering spots show their skill's icon, and turn amber when your level is too low.
    const skill = label && label[2];
    btn.classList.toggle('warn', !!(label && label[3]));
    btn.classList.toggle('has-icon', !!skill);
    let ic = btn.querySelector('.ib-icon');
    if (skill) {
      if (!ic) { ic = document.createElement('span'); ic.className = 'ib-icon'; btn.prepend(ic); }
      ic.innerHTML = skillIconSVG(skill, 26);
    } else ic?.remove();
    // Always what it will do, short enough to fit: "Chop Oak", "Talk to Aziz" (hudease.js).
    const [verb, noun] = interactCaption(label, this.game?.interactTarget);
    btn.querySelector('.ib-verb').innerHTML = noun ? `${escapeHtml(verb)}<span class="ib-noun">${escapeHtml(noun)}</span>` : escapeHtml(verb);
    btn.title = label ? `${label[0]} ${label[1]}` : 'Interact with the nearest thing (E or Space)';
  }

  // The three auto switches on the action bar (battle, gather, quest), each
  // with its own on/off and a one-line status. Runs every tick.
  renderAutoBattle() {
    const g = this.game;
    const modes = [['auto-battle-btn', g.autoBattle, () => g.autoStatus()],
      ['auto-gather-btn', g.autoGather, () => g.autoGatherStatus()],
      ['auto-quest-btn', g.autoQuest, () => g.autoQuestStatus()]];
    this.el.autoBtns ||= {};
    for (const [id, on, status] of modes) {
      const btn = this.el.autoBtns[id] || (this.el.autoBtns[id] = document.getElementById(id));
      if (!btn) continue;
      btn.classList.toggle('active', on);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const st = btn.querySelector('.ab-status');
      const text = status();
      if (st && st.textContent !== text) st.textContent = text;
    }
  }

  openAutoSettings() {
    const g = this.game;
    const render = (body) => {
      const cfg = g.autoCfg;
      body.innerHTML = '';
      const list = document.createElement('div');
      list.className = 'auto-set';
      // One labelled row per setting, its choices as a segmented control.
      const row = (title, help, opts, cur, set) => {
        const r = document.createElement('div'); r.className = 'auto-set-row';
        r.innerHTML = `<div class="as-head"><b>${escapeHtml(title)}</b><span>${escapeHtml(help)}</span></div>`;
        const seg = document.createElement('div'); seg.className = 'as-seg';
        for (const [val, label] of opts) {
          const btn = document.createElement('button');
          btn.className = 'as-opt' + (val === cur ? ' active' : '');
          btn.textContent = label;
          btn.setAttribute('aria-pressed', val === cur ? 'true' : 'false');
          btn.addEventListener('click', () => { set(val); render(body); });
          seg.appendChild(btn);
        }
        r.appendChild(seg);
        list.appendChild(r);
      };
      row('Eat food', 'when your life drops below', [[0, 'Never'], [0.25, '25%'], [0.4, '40%'], [0.6, '60%']], cfg.eatAt, (v) => { cfg.eatAt = v; });
      // Monster types around you right now (plus the current choice).
      const p = g.player;
      const near = new Map();
      for (const n of g.npcs) {
        if (n.alive && n.attackable && !n.def.boss && Math.max(Math.abs(n.x - p.x), Math.abs(n.y - p.y)) <= 25) near.set(n.npcId, n.def.name.replace(/^Champion /, ''));
      }
      if (cfg.target && !near.has(cfg.target)) { try { near.set(cfg.target, getNpc(cfg.target).name); } catch { cfg.target = null; } }
      row('What to fight', 'monsters attacking you are always fought', [[null, 'Anything'], ...[...near].sort((x, y) => x[1].localeCompare(y[1])).slice(0, 12).map(([id, nm]) => [id, nm])],
        cfg.target, (v) => { cfg.target = v; });
      row('Bosses', 'take on bosses you can beat', [[true, 'Fight them'], [false, 'Skip']], cfg.bosses !== false, (v) => { cfg.bosses = v; });
      row('Champions', 'gold-ringed mini-bosses (one attacking you is always fought)', [[true, 'Fight them'], [false, 'Skip']], cfg.champions !== false, (v) => { cfg.champions = v; });
      const tHelp = cfg.priority === 'only' ? 'only champions and bosses (it goes looking for them); others only if they attack you'
        : cfg.priority !== false ? 'bosses and champions first, even mid-fight, then anything else' : 'the closest monster, by the walk there';
      row('Targets', tHelp, [[true, 'Champs & bosses first'], ['only', 'Champs & bosses only'], [false, 'Nearest']],
        cfg.priority === 'only' ? 'only' : cfg.priority !== false, (v) => { cfg.priority = v; });
      row('Boss attacks', cfg.dodge !== false ? 'step out of the red ground markers for you' : 'stand your ground: dodging is left to you', [[true, 'Auto dodge'], [false, 'Off']], cfg.dodge !== false, (v) => { cfg.dodge = v; });
      row('Attack skills', 'spend adrenaline on your skills', [[true, 'Use them'], [false, 'Save adrenaline']], cfg.abilities, (v) => { cfg.abilities = v; });
      body.appendChild(list);
      // Auto gather: the kinds ticked in the skill guides, and a way to untick them all.
      if (g.gatherPicks.size) {
        body.insertAdjacentHTML('beforeend', `<div class="skill-group">Auto gather</div>${gatherPicksHTML(g)}`);
        body.querySelector('[data-untick]')?.addEventListener('click', () => { g.clearGatherPicks(); render(body); });
      }
      const hint = document.createElement('div'); hint.className = 'modal-hint';
      hint.textContent = 'Auto battle braces against heavy blows, picks your strongest spell and (unless you turn it off above) steps out of boss attack markers for you; each dodge trains Agility. Steering pauses it; press T to switch it on or off.';
      body.appendChild(hint);
    };
    this.openModal('Auto Battle', render);
  }

  renderAbilities() {
    const g = this.game;
    if (this.el.adrenalineFill) this.el.adrenalineFill.style.width = `${Math.round(g.adrenaline)}%`;
    if (this.el.adrenalineVal) this.el.adrenalineVal.textContent = `${Math.round(g.adrenaline)}%`;
    if (!this._abilityBtns) return;
    const set = g.currentAbilities();
    if (set.map((a) => a.id).join(',') !== this._abilitySig) { this._buildAbilityBar(); return this.renderAbilities(); }
    for (const ab of set) {
      const btn = this._abilityBtns[ab.id];
      if (!btn) continue;
      const cd = g.abilityCd[ab.id] || 0;
      const unlocked = g.abilityUnlocked(ab);
      const ready = unlocked && cd <= 0 && g.canAffordAbility(ab);
      const armed = g.armedAbility === ab.id;
      btn.classList.toggle('locked', !unlocked);
      btn.classList.toggle('armed', armed);
      btn.classList.toggle('ready', ready && !armed);
      btn.classList.toggle('disabled', unlocked && !ready && !armed);
      const cdEl = btn.querySelector('.ab-cd');
      if (cdEl) {
        if (!unlocked) { cdEl.style.height = '100%'; cdEl.textContent = `🔒${ab.unlock}`; }
        else { cdEl.style.height = cd > 0 ? `${Math.min(100, cd * 25)}%` : '0%'; cdEl.textContent = cd > 0 ? String(cd) : ''; }
      }
    }
  }

  // ---------------- Objective tracker ----------------
  renderTracker() {
    const el = this.el.tracker;
    if (!el) return;
    this._trkDirty = false;   // drawn now: a redraw queued by _trackerSoon has nothing left to do
    const g = this.game;
    const rows = [];
    const xb = g.xpBreakdown();
    if (xb.total > 1.001) {
      const parts = [];
      if (xb.wildLevel) parts.push(`Wild lvl ${xb.wildLevel}`);
      if (xb.streakKills > 1) parts.push(`streak ${xb.streakKills}`);
      if (xb.night > 1) parts.push('night');
      if (xb.blessed > 1) parts.push('blessed');
      rows.push(`<div class="trk-row trk-xp"><span class="trk-ic">&#10022;</span><b>XP &times;${xb.total.toFixed(2)}</b> <span class="trk-prog">${parts.join(' · ')}</span></div>`);
    }
    if (g.slayer && g.slayer.task) {
      const t = g.slayer.task;
      rows.push(`<div class="trk-row"><span class="trk-ic trk-slayer">&#9760;</span>${Number(t.remaining) || 0} ${escapeHtml(t.name)} <span class="trk-buff" title="Slayer bonus against your task">+${g.slayerBonus().dmg}% dmg</span>${this._trkPointer((n) => n.def.family === t.family, `fam:${t.family}`)}</div>`);
    }
    // Today's unfinished bounties (up to two), each with a pointer to the nearest target.
    for (const t of (g.bounties?.list || []).filter((x) => !x.done).slice(0, 2)) {
      rows.push(`<div class="trk-row"><span class="trk-ic trk-bounty">&#9733;</span>${escapeHtml(t.name)} <span class="trk-prog">${Number(t.have) || 0}/${Number(t.need) || 0}</span>${this._trkPointer((n) => n.npcId === t.id, `id:${t.id}`)}</div>`);
    }
    rows.push(...eventTrackerRows(this));      // a world event under way
    rows.push(...contractTrackerRows(this));   // today's Pest Control contracts
    rows.push(...lifeTrackerRows(this));       // a gathering streak, today's skilling contracts (lifeskillui.js)
    rows.push(...whatNextTrackerRows(this));   // the first "What next?" goal, tap to start (whatnextui.js)
    for (const q of QUESTS) {
      const st = g.quests[q.id];
      if (st && st.state === 'active') {
        const p = q.progress ? q.progress(g) : '';
        rows.push(`<div class="trk-row"><span class="trk-ic trk-quest">!</span>${escapeHtml(q.name)}${p ? ` <span class="trk-prog">${escapeHtml(p)}</span>` : ''}</div>`);
        break; // show one active quest at a time to stay compact
      }
    }
    // Tap the header to fold it to one line; remembered on this device (hudease.js).
    if (this._trkFolded === undefined) {
      this._trkFolded = loadTrackerFolded();
      el.addEventListener?.('click', (e) => {
        // "+N more" shows every row (and "Show less" puts them away again).
        if (e.target.closest?.('.trk-more')) { this._trkOpen = !this._trkOpen; this.renderTracker(); return; }
        if (!e.target.closest?.('.trk-fold')) return;
        this._trkFolded = !this._trkFolded;
        saveTrackerFolded(this._trkFolded);
        this.renderTracker();
      });
      // Phones show two rows before "+N more", other screens three (hudease.js).
      this._trkPhone = typeof matchMedia === 'function' ? matchMedia('(max-width: 540px) and (pointer: coarse)') : null;
    }
    // Redrawn every tick, but only rewritten when it reads differently (a
    // rewrite costs a style and layout pass even when nothing changed).
    const max = this._trkPhone?.matches ? TRACKER_ROWS_PHONE : TRACKER_ROWS;
    const html = trackerHTML(rows, this._trkFolded, { max, open: !!this._trkOpen });
    if (html !== this._trkHTML) { this._trkHTML = html; el.innerHTML = html; }
    el.classList.toggle('hidden', rows.length === 0);
    el.classList.toggle('folded', !!this._trkFolded);
  }

  /** Arrow + distance from the player to the nearest living monster matching `pred`.
   *  `key` ('id:<npcId>' or 'fam:<family>') names what `pred` picks out: the
   *  search then visits only those NPCs (_trkCandidates), not the whole world. */
  _trkPointer(pred, key) {
    const g = this.game, p = g.player;
    let best = null, bd = Infinity;
    // The whole world is searched (a target can be far off), so compare squared
    // distances and take the one square root at the end.
    for (const n of (key ? this._trkCandidates(key, pred) : g.npcs)) {
      if (!n.alive) continue;
      const dx = n.x - p.x, dy = n.y - p.y, d = dx * dx + dy * dy;
      if (d < bd && pred(n)) { bd = d; best = n; }
    }
    if (!best) return '';
    bd = Math.sqrt(bd);
    if (bd <= 6) return '<span class="trk-dist here">here</span>';
    const deg = Math.round(Math.atan2(best.y - p.y, best.x - p.x) * 180 / Math.PI);
    return `<span class="trk-arrow" style="transform:rotate(${deg}deg)">&#10148;</span><span class="trk-dist">${Math.round(bd)}m</span>`;
  }

  /** The NPCs `pred` picks out (dead ones too: they come back), in list order,
   *  kept per `key` until the NPC list is replaced or grows. The world holds ten
   *  thousand and the tracker points at a few kinds several times a tick; NPCs
   *  only join or leave it that way, and their kind is set before they join. */
  _trkCandidates(key, pred) {
    const g = this.game;
    let c = this._trkIdx;
    if (!c || c.arr !== g.npcs || c.len !== g.npcs.length) c = this._trkIdx = { arr: g.npcs, len: g.npcs.length, lists: new Map() };
    let list = c.lists.get(key);
    if (!list) c.lists.set(key, list = g.npcs.filter(pred));
    return list;
  }

  /** Redraw the objectives once at the end of this task, however many events
   *  ask (one kill can move the XP bonus, a bounty and a contract). That is
   *  still before the browser paints, so it shows at the same moment; and the
   *  tick's own redraw, which comes last in a tick, covers what came before it. */
  _trackerSoon() {
    this._trkDirty = true;
    this._coalesce('tracker', () => { if (this._trkDirty) this.renderTracker(); });
  }

  // ---------------- Tabs ----------------
  _setPanelTitle(view) {
    const el = this.el.panelTitle || this.el.panelHead;
    if (!el) return;
    const titles = { inventory: 'Inventory', equipment: 'Worn Equipment', skills: 'Skills', combat: 'Combat', prayer: 'Blessings', quests: 'Quest Journal', stats: 'Final Stats', achievements: 'Achievements', story: 'Story', settings: 'Settings' };
    el.textContent = titles[view] || '';
  }

  // ---------------- Collapsible menus ----------------
  // Every on-screen menu (side panel, chat, minimap) can be folded away to
  // reduce clutter, and the state is remembered between sessions.
  _initCollapsibles() {
    this._collapse = this._loadCollapse();
    const id = (x) => document.getElementById(x);
    this._wireCollapse('panel', this.el.sidepanel, this.el.panelCollapse, 'panel');
    this._wireCollapse('chat', id('chatbox'), id('chat-collapse'), 'chat');
    this._wireCollapse('minimap', id('minimap-panel'), id('minimap-collapse'), 'minimap');
  }

  _wireCollapse(key, panel, btn, label) {
    if (!panel || !btn) return;
    let wired = false;
    const apply = (collapsed) => {
      // A phone's sheet slides away rather than vanishing (motion.js; the panel folds at once).
      if (key === 'panel' && wired && collapsed && !panel.classList.contains('collapsed')) sheetCloseGhost(panel, this.game);
      panel.classList.toggle('collapsed', collapsed);
      if (collapsed) panel.classList.remove('sheet-full');   // a phone sheet always reopens at half height
      if (key === 'panel' && !collapsed) this._fullForBag();   // (but the Bag, Gear and Skills open full)
      if (key === 'panel' && !collapsed && this._invStale) this.renderInventory();   // the bag skipped redraws while folded
      if (key === 'panel' && !collapsed) this._catchUpPanels();   // and so did the Gear, Combat, Journal and Awards views
      if (key === 'chat' && !collapsed) this._drawChat(false);   // the folded chat drew none of its new lines
      btn.innerHTML = glyphArtHTML('ui-collapse', collapsed ? '&#9656;' : '&#9662;', 16); // ▸ collapsed / ▾ expanded (the painted chevron turns, styles/compact.css)
      btn.title = `${collapsed ? 'Expand' : 'Collapse'} ${label}${key === 'panel' ? ' (I)' : ''}`;
    };
    // Small screens start with the big panels folded (the game needs the room);
    // a saved choice always wins.
    const compact = typeof matchMedia === 'function' && matchMedia('(max-width: 540px), (max-height: 500px)').matches;
    if (this._collapse[key] === undefined && compact && (key === 'panel' || key === 'chat')) this._collapse[key] = true;
    apply(!!this._collapse[key]);
    wired = true;
    this._collapseApply = this._collapseApply || {};
    this._collapseApply[key] = (c) => { this._collapse[key] = c; apply(c); this._saveCollapse(); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._collapse[key] = !panel.classList.contains('collapsed');
      apply(this._collapse[key]);
      this._saveCollapse();
    });
  }

  // Phones fold the Battle / Gather / Quest switches into one "Auto" button
  // (the CSS hides the card unless #ability-bar has .auto-open). A tap anywhere
  // else folds it again, so the card never sits over the game for long.
  _initAutoMenu() {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('ability-bar');
    const btn = document.getElementById('auto-menu-btn');
    if (!bar || !btn) return;
    const set = (open) => { bar.classList.toggle('auto-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(!bar.classList.contains('auto-open')); });
    document.addEventListener('pointerdown', (e) => {
      if (bar.classList.contains('auto-open') && !bar.contains(e.target)) set(false);
    }, true);
  }

  // While a finger (or the mouse) is down on a panel or window, its redraws
  // wait until the press is over. A panel rebuilt mid-tap replaces the very
  // button under the finger, and the phone's click then lands on nothing, so
  // taps "did nothing" whenever the game was busy (gathering, fighting, a
  // world event ticking). Held redraws run once, right after the click.
  _initPressHold() {
    if (typeof document === 'undefined') return;
    const HELD = ['renderInventory', 'renderEquipment', 'renderSkills', 'renderCombatPanel', 'renderPrayerPanel',
      'renderQuestPanel', 'renderStatsPanel', 'renderAchievementPanel', '_refreshModalIfOpen'];
    const held = new Map();
    let pressing = false, timer = 0, since = 0;
    this._unheld = {};   // the redraws themselves, for a view coming into sight (_catchUpPanels)
    for (const name of HELD) {
      const orig = this[name];
      if (typeof orig !== 'function') continue;
      this._unheld[name] = orig;
      this[name] = (...args) => {
        // A press held for seconds (a slow scroll) doesn't freeze the panel for good.
        if (pressing && performance.now() - since < 3000) { held.set(name, args); return undefined; }
        return orig.apply(this, args);
      };
    }
    const flush = () => {
      clearTimeout(timer); timer = 0;
      if (!pressing) return;
      pressing = false;
      const jobs = [...held]; held.clear();
      for (const [name, args] of jobs) this[name](...args);
    };
    const AREAS = '#sidepanel, #modal-overlay, #chatbox, #tooltip';
    document.addEventListener('pointerdown', (e) => {
      if (!e.target?.closest?.(AREAS)) return;
      pressing = true; since = performance.now(); clearTimeout(timer); timer = 0;
    }, true);
    // The click comes after the finger lifts: let it reach its button first
    // (bubble phase, after the button's own handler), then catch up.
    document.addEventListener('click', () => { if (pressing) setTimeout(flush, 0); });
    // A press that became a scroll, or a click that never came.
    const later = () => { if (pressing && !timer) timer = setTimeout(flush, 350); };
    document.addEventListener('pointerup', later, true);
    document.addEventListener('pointercancel', later, true);
  }

  // Shop and Offering Shrine hotkeys: point at an item (or an offer row) and
  // press 1, 5, X (10) or A (all; 100 when buying) instead of right-clicking for
  // a menu. Each pointable thing carries its action as `_hot(n)` (n = Infinity
  // for "all"); the window's hint line lists the keys.
  _initWindowHotkeys() {
    if (typeof document === 'undefined') return;
    const KEYS = { '1': 1, '5': 5, 'x': 10, 'a': Infinity };
    // Where the mouse is: the window redraws after each buy or sale, so the thing
    // pointed at is looked up afresh on every key press (a held key keeps going).
    let mx = -1, my = -1;
    document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, { capture: true, passive: true });
    document.addEventListener('keydown', (e) => {
      if (!this.modal || !['shop', 'shrine'].includes(this.modal.kind)) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = KEYS[(e.key || '').toLowerCase()];
      const at = n && mx >= 0 ? document.elementFromPoint(mx, my) : null;
      const over = at?.closest?.('.hot');
      // With the shrine open, an item in the bag takes the keys too (shrinehot.js).
      const bag = !over && this.modal.kind === 'shrine' && typeof this.modal._hotItem === 'function' ? at?.closest?.('.inv-slot.filled') : null;
      const slot = bag ? this.game.inventory.slotAt((this._invCells || []).indexOf(bag)) : null;
      if (slot) {
        e.preventDefault(); e.stopImmediatePropagation();
        this.modal._hotItem(slot.id, n);
        return;
      }
      if (!n || !over || typeof over._hot !== 'function') return;
      e.preventDefault(); e.stopImmediatePropagation();   // (not the game's own 1-5 tab keys)
      over._hot(n);
    }, true);
  }

  // Phones show the side panel and the big windows as sheets (see "Responsive
  // layout" in main.css). Dragging the handle or header down (or sideways to
  // the right for the landscape side sheet) past a short distance closes the
  // sheet; a plain tap on the handle closes it too. Only runs while the sheet
  // layout is in force, so desktop and tablets are untouched.
  _initSheets() {
    if (typeof document === 'undefined' || typeof matchMedia !== 'function') return;
    const phone = matchMedia('(pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px)');
    const side = () => matchMedia('(max-height: 500px)').matches;   // landscape: the sheet slides in from the right
    // `snap`: the side panel opens at half height on an upright phone; dragging
    // its handle up snaps it full, down to half, further down folds it (hudease.js).
    const wire = (sheet, grips, close, isOpen, snap = false) => {
      if (!sheet) return;
      let start = null, d = 0, up = 0;
      const move = (e) => {
        if (!start) return;
        const raw = side() ? e.clientX - start.x : e.clientY - start.y;
        d = Math.max(0, raw);
        up = snap && !side() ? Math.max(0, -raw) : 0;
        // Only a real drag takes the pointer: capturing it on pointerdown
        // would steer a plain tap's events to the grip as well.
        if ((d >= 6 || up >= 6) && !start.captured) { start.captured = true; start.grip.setPointerCapture?.(e.pointerId); }
        sheet.style.transform = side() ? `translateX(${d}px)` : `translateY(${d}px)`;
        if (snap && !side()) sheet.style.height = up ? `${Math.min(start.h + up, (globalThis.innerHeight || 800) * 0.85)}px` : '';
      };
      const end = () => {
        if (!start) return;
        const tap = d < 6 && up < 6 && start.handle;
        const h = start.h;
        start = null;
        sheet._dragD = d;   // a sheet let go part-way down slides away from there (motion.js)
        sheet.style.transition = ''; sheet.style.transform = ''; sheet.style.height = '';
        if (snap && !side() && !tap) {
          const to = sheetSnap({ full: sheet.classList.contains('sheet-full'), dy: d || -up, h });
          if (to === 'full' || to === 'half') sheet.classList.toggle('sheet-full', to === 'full');
          else if (to === 'close') close();
        } else if (d > 70 || tap) close();
        d = 0; up = 0; sheet._dragD = 0;
      };
      for (const g of grips) {
        if (!g) continue;
        g.addEventListener('pointerdown', (e) => {
          // Anything pressable in the header (fold, close) keeps its own taps.
          if (!phone.matches || !isOpen() || !sheetDragStarts(e.target)) return;
          start = { x: e.clientX, y: e.clientY, handle: g.classList.contains('sheet-handle'), grip: g, captured: false, h: sheet.getBoundingClientRect?.().height || 0 };
          d = 0;
          sheet.style.transition = 'none';
        });
        g.addEventListener('pointermove', move);
        g.addEventListener('pointerup', end);
        g.addEventListener('pointercancel', () => { d = 0; end(); });
      }
    };
    const panel = this.el.sidepanel;
    wire(panel, [panel?.querySelector('.sheet-handle'), this.el.panelHead],
      () => this._collapseApply?.panel?.(true), () => !panel.classList.contains('collapsed'), true);
    const win = document.getElementById('modal-window');
    wire(win, [win?.querySelector('.sheet-handle'), this.el.modalTitle],
      () => this.closeModal(), () => !!this.modal);
  }

  /** The I key: open the side panel (the menu) if it's folded, fold it if open. */
  toggleMenu() {
    const p = this.el.sidepanel;
    if (!p) return;
    this._dropTips();
    this._collapseApply?.panel?.(!p.classList.contains('collapsed'));
  }

  _loadCollapse() {
    let c;
    try { c = JSON.parse(localStorage.getItem('ss_ui_collapse')) || {}; } catch { c = {}; }
    // For a day, laptops started with the side panel folded, and that fold
    // could be saved without the player choosing it (it read as the menu
    // vanishing). Clear it once, so the menu opens; later choices are kept.
    if (c.v !== COLLAPSE_V) { delete c.panel; c.v = COLLAPSE_V; }
    return c;
  }

  _saveCollapse() {
    try { localStorage.setItem('ss_ui_collapse', JSON.stringify(this._collapse)); } catch {}
  }

  _bindTabs() {
    const tabs = document.querySelectorAll('#panel-tabs .tab-btn');
    // The sub-tab each tab last showed, remembered per viewer (it is only a convenience).
    try { this._subView = JSON.parse(localStorage.getItem('ss_ui_subtab')) || {}; } catch { this._subView = {}; }
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        this._dropTips();   // switching tabs never leaves an item's description behind
        // A folded panel opens on the tab you tap; tapping the open tab again folds it.
        const panel = document.getElementById('sidepanel');
        const folded = panel?.classList.contains('collapsed');
        // A quick second tap (a double tap, or a tap the phone sent twice) on
        // the tab just chosen is not a request to fold the panel again.
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const quick = this._tabTap?.btn === btn && now - this._tabTap.t < 450;
        this._tabTap = { btn, t: now };
        if (folded) this._collapseApply?.panel?.(false);
        else if (btn.classList.contains('active') && panel?.classList.contains('compact-ui')) { if (!quick) this._collapseApply?.panel?.(true); return; }
        tabs.forEach((b) => b.classList.toggle('active', b === btn));
        const tab = btn.dataset.view;
        const views = PANEL_TABS[tab] || [tab];
        this._showPanelView(views.includes(this._subView?.[tab]) ? this._subView[tab] : views[0]);
      });
    });
  }

  /** Show one view of the side panel (and its sub-tab row), without touching
   *  which tab button is lit or folding anything. */
  _showPanelView(view) {
    const tab = tabOfView(view) || view;
    this._panelView = view;
    this._fullForBag();
    this._setPanelTitle(view);
    document.querySelectorAll('#panel-body .panel-view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== view));
    if (this._subView) {
      this._subView[tab] = view;
      try { localStorage.setItem('ss_ui_subtab', JSON.stringify(this._subView)); } catch {}
    }
    this._renderSubtabs(tab, view);
    this._catchUpPanels();   // before the view's scroll is put back, so it lands on what will show
    this.winMem?.panelShown(tab, view);
    if (view === 'stats') this.renderStatsPanel();   // it only redraws while showing, so bring it up to date
    if (view === 'skills' && this._skillsStale) this.renderSkills();   // likewise
    if (view === 'inventory' && this._invStale) this.renderInventory();   // likewise
    if (view === 'story') this.renderStoryPanel?.();  // (storyui.js) likewise
    // The skills list carries a name + description per row, so it gets more room.
    document.getElementById('sidepanel')?.classList.toggle('wide', view === 'skills');
  }

  /** Phones: the Bag, Gear and Skills open at the sheet's full height. At
   *  half, the handle, tabs and filters left room for two rows of the bag (and
   *  about three skills). (Dragging the handle down still settles it at half:
   *  hudease.js sheetSnap.) */
  _fullForBag() {
    const p = this.el?.sidepanel;
    if (!p || p.classList.contains('collapsed') || !p.classList.contains('compact-ui')) return;
    if (['inventory', 'skills'].includes(tabOfView(this._panelView))) p.classList.add('sheet-full');
  }

  /** True while `el`, inside a side-panel view, can't be seen: the panel is
   *  folded (as it mostly is on a phone) or another view is showing. */
  _panelHidden(el) {
    return !!(this.el.sidepanel?.classList?.contains('collapsed') || el?.closest?.('.panel-view')?.classList.contains('hidden'));
  }

  /** The Gear, Combat, Journal and Awards views (and the alignment box under
   *  Skills) skip their redraws while out of sight: bring any that missed one
   *  up to date (each draws only if it now shows). Straight away, even while
   *  the tab is still pressed: the press-hold (_initPressHold) would draw it
   *  only after the click, so the view's first frame showed its old state.
   *  Nothing in a view just coming into sight is under the finger. */
  _catchUpPanels() {
    const draw = (name) => (this._unheld?.[name] || this[name]).call(this);
    if (this._equipStale) draw('renderEquipment');
    if (this._combatStale) draw('renderCombatPanel');
    if (this._questStale) draw('renderQuestPanel');
    if (this._achStale) draw('renderAchievementPanel');
    if (this._alignStale) draw('renderAlignment');
  }

  /** The "Bag | Gear" style row of sub-tabs at the top of the panel body. */
  _renderSubtabs(tab, view) {
    const row = document.getElementById('panel-subtabs');
    if (!row) return;
    // Phones: the bag's filters ride in this row (moved back first: the
    // row's buttons are redrawn below).
    const bag = document.getElementById('inventory-bar');
    if (bag && bag.parentNode === row) document.getElementById('inventory-grid')?.before(bag);
    const views = PANEL_TABS[tab] || [];
    row.classList.toggle('hidden', views.length < 2);
    if (row.dataset.tab !== tab) {
      row.dataset.tab = tab;
      row.innerHTML = views.length < 2 ? '' : views.map((v) =>
        `<button type="button" class="subtab-btn" role="tab" data-view="${v}">${SUBTAB_LABELS[v] || v}</button>`).join('');
      row.querySelectorAll('.subtab-btn').forEach((b) => b.addEventListener('click', () => {
        this._dropTips();
        this._showPanelView(b.dataset.view);   // (each view keeps its own scroll: windowease.js)
      }));
    }
    row.querySelectorAll('.subtab-btn').forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    // On a touch phone, Bag | Gear and the bag's filters are one strip of
    // chips that scrolls sideways (two stacked rows of pills, under the tabs,
    // ate a third of the short sheet before the first item).
    const merge = bag && tab === 'inventory' && view === 'inventory' && this.el?.sidepanel?.classList.contains('compact-ui')
      && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (merge) row.appendChild(bag);
    row.classList.toggle('with-bag', !!merge);
  }

  /** Open the side panel on a view, wherever it lives: lights its tab, picks
   *  its sub-tab and unfolds the panel. For code (and keys) that want, say,
   *  the achievements up rather than whatever the Journal tab last showed. */
  showPanelView(view) {
    if (typeof document === 'undefined') return;
    const tab = tabOfView(view);
    if (!tab) return;
    document.querySelectorAll('#panel-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === tab));
    if (document.getElementById('sidepanel')?.classList.contains('collapsed')) this._collapseApply?.panel?.(false);
    this._showPanelView(view);
  }

  _bindChatTabs() {
    document.querySelectorAll('.chat-tab').forEach((t) => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.chat-tab').forEach((x) => x.classList.toggle('active', x === t));
        this.chatFilter = t.dataset.filter;
        this._applyChatFilter();
      });
    });
  }

  // ---------------- Region label ----------------
  setRegion(name, wildLevel = 0) {
    // Called every tick: the labels are rewritten only when the place (or its
    // Wilderness level) changes, not rebuilt the same each time.
    const key = `${name}|${wildLevel}`;
    if (key === this._regionKey) return;
    this._regionKey = key;
    const wild = wildLevel > 0;
    if (this.el.region) {
      this.el.region.innerHTML = `<span class="loc-pin">&#128205;</span> ${escapeHtml(name)}` +
        (wild ? ` <span class="wild-lvl">Lvl ${wildLevel}</span>` : '');
      this.el.region.classList.toggle('wild', wild);
    }
    if (this.el.minimapRegion) {
      const label = wild ? `${name} (Lvl ${wildLevel})` : name;
      this.el.minimapRegion.textContent = label;
      this.el.minimapRegion.classList.toggle('wild', wild);
      // A long name ("The Wilderness (Lvl 3)") ran over the HP orb: set smaller (minimap.css).
      this.el.minimapRegion.classList.toggle('long', label.length > MINIMAP_LONG_NAME);
    }
  }

  // ---------------- Hover text ----------------
  setHoverText(verb, target = '', extra = '') {
    // Kept to one short line ("Attack Sambar deer (Lv 25)"): a foe's race,
    // weakness, armour and wounds are on the target card, and spelt out here
    // they ran into the region name and the target card at the top.
    const str = verb ? `${verb}|${target}|${extra}` : '';
    if (str === this._lastHover) return;
    this._lastHover = str;
    if (!verb) { this.el.hover.innerHTML = ''; return; }
    this.el.hover.innerHTML =
      `${escapeHtml(verb)} <span class="target">${escapeHtml(target)}</span>` +
      (extra ? ` <span class="extra">${escapeHtml(extra)}</span>` : '');
  }

  // ---------------- Chat ----------------
  // A big fight sends twenty-odd lines a second. Each is kept in chatMessages
  // as it comes, and the log draws what came in a task once, at its end (still
  // before the browser paints): one fragment in, the oldest lines out together.
  // While the chat is folded its log is out of sight, so nothing is drawn until
  // it opens; then its newest CHAT_LINES are, just as they would have been.
  addChat(text, cls = 'game') {
    this.chatMessages.push({ text, cls });
    if (this.chatMessages.length > CHAT_LINES) this.chatMessages.shift();
    this._chatSeq = (this._chatSeq || 0) + 1;   // lines ever added (the log has drawn up to _chatDrawn)
    this._coalesce('chat', () => this._drawChat());
  }

  /** Draw the lines added since the log was last drawn (the newest CHAT_LINES
   *  at most), unless the chat is folded. `follow`: then keep to the bottom. */
  _drawChat(follow = true) {
    const log = this.el.chatLog;
    const n = Math.min(this.chatMessages.length, (this._chatSeq || 0) - (this._chatDrawn || 0));
    if (!log || n <= 0 || log.parentElement?.classList.contains('collapsed')) return;
    this._chatDrawn = this._chatSeq;
    const frag = document.createDocumentFragment();
    for (let i = this.chatMessages.length - n; i < this.chatMessages.length; i++) {
      const { text, cls } = this.chatMessages[i];
      const div = document.createElement('div');
      div.className = `msg ${cls}`;
      setLinkedText(div, this.game, text);
      div.dataset.cls = cls;
      this._applyVisibility(div);
      frag.appendChild(div);
    }
    if (n >= CHAT_LINES) log.textContent = '';   // all new: every old line goes
    else for (let k = log.childElementCount + n - CHAT_LINES; k > 0; k--) log.removeChild(log.firstChild);
    log.appendChild(frag);
    if (!follow) return;
    // Scrolling to the bottom needs the page laid out: do it once a frame, not
    // per message, right after the browser's own layout (where reading the
    // log's height costs nothing; noticelane.js afterLayout), and not while the
    // chat is folded (its log isn't laid out, so there is nothing to scroll).
    if (this._chatScrollQueued) return;
    this._chatScrollQueued = true;
    const scroll = () => {
      this._chatScrollQueued = false;
      if (this.el.chatLog.parentElement?.classList.contains('collapsed')) return;
      this.el.chatLog.scrollTop = this.el.chatLog.scrollHeight;
    };
    if (!afterLayout(scroll)) this._soon('chatScroll', scroll);
  }

  /** Run `fn` once on the next animation frame, however many times it is asked
   *  for before then (keyed by `key`), and no sooner than `minMs` after its last
   *  run. Busy game events use this so the HUD redraws once a frame at most. */
  _soon(key, fn, minMs = 0) {
    const q = (this._soonQ || (this._soonQ = {}))[key] || (this._soonQ[key] = { pending: false, last: 0, fn: null });
    q.fn = fn;
    if (q.pending) return;
    q.pending = true;
    const run = () => { q.pending = false; q.last = performance.now(); q.fn(); };
    if (typeof requestAnimationFrame === 'undefined') { run(); return; }
    const wait = q.last + minMs - performance.now();
    if (wait > 0) setTimeout(() => requestAnimationFrame(run), wait);
    else requestAnimationFrame(run);
  }

  /** Run `fn` once at the end of the current task (a microtask), however many
   *  times it is asked for before then (keyed by `key`). Unlike _soon it lands
   *  in the same frame: the browser paints only after the task, so a redraw a
   *  burst of events each asked for shows at the very same moment, done once. */
  _coalesce(key, fn) {
    const q = this._coalesceQ || (this._coalesceQ = new Map());
    const queued = q.has(key);
    q.set(key, fn);
    if (queued) return;
    if (typeof queueMicrotask !== 'function') { q.delete(key); fn(); return; }
    queueMicrotask(() => {
      const f = q.get(key);
      q.delete(key);
      // Like the event bus: one bad redraw is logged, never thrown at the page.
      try { f(); } catch (err) { console.error(`Error in queued redraw "${key}":`, err); }
    });
  }

  _applyChatFilter() {
    [...this.el.chatLog.children].forEach((c) => this._applyVisibility(c));
    this.el.chatLog.scrollTop = this.el.chatLog.scrollHeight;
  }

  _applyVisibility(div) {
    const cls = div.dataset.cls;
    let show = true;
    if (this.chatFilter === 'combat') show = cls === 'combat';
    else if (this.chatFilter === 'game') show = cls !== 'combat';
    div.style.display = show ? '' : 'none';
  }

  // ---------------- Inventory ----------------
  _buildInvBar() {
    const tabs = document.getElementById('inv-tabs');
    if (!tabs || this._invBarBuilt) return;
    this._invBarBuilt = true;
    this.invFilter = 'all';
    for (const [id, label] of [['all', 'All'], ['gear', 'Gear'], ['food', 'Food'], ['materials', 'Mats'], ['other', 'Misc']]) {
      const b = document.createElement('button');
      b.className = 'inv-tab' + (id === 'all' ? ' active' : '');
      b.dataset.cat = id;
      b.textContent = label;
      b.addEventListener('click', () => {
        this.invFilter = id;
        for (const x of tabs.children) x.classList.toggle('active', x.dataset.cat === id);
        this.renderInventory();
      });
      tabs.appendChild(b);
    }
    document.getElementById('inv-sort')?.addEventListener('click', () => { this.game.inventory.sort(); this.game.msg('You tidy your pack.', 'system'); });
  }

  /** Coalesce bursts of inventory changes (auto-loot can add several items in
   *  one tick) into a single repaint on the next frame. */
  scheduleInventory() {
    if (this._invQueued) return;
    this._invQueued = true;
    const run = () => { this._invQueued = false; this.renderInventory(); this._refreshModalIfOpen(['bank', 'shop']); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else run();
  }

  // Cells are created once per slot (with listeners that read the slot live)
  // and only re-painted when that slot's contents actually change.
  renderInventory() {
    this._buildInvBar();
    const grid = this.el.inventory;
    // While the bag can't be seen (the panel folded, as it mostly is on a phone,
    // or another tab open) just note it is out of date: every pickup redrew
    // hundreds of hidden cells, and a whole seam or a busy fight brings many.
    // It catches up when shown (_showPanelView, and unfolding the panel).
    if (this._invCells?.length && (this.el.sidepanel?.classList?.contains('collapsed') || grid?.closest?.('.panel-view')?.classList.contains('hidden'))) {
      this._invStale = true;
      return;
    }
    this._invStale = false;
    const slots = this.game.inventory.slots;
    const f = this.invFilter || 'all';
    const cells = this._invCells || (this._invCells = []);
    while (cells.length < slots.length) {
      const i = cells.length;
      const cell = document.createElement('div');
      cell.className = 'inv-slot';
      cell.addEventListener('click', () => this._invDefault(i));
      cell.addEventListener('contextmenu', (e) => { e.preventDefault(); this._invContext(i, e); });
      this._tip(cell, () => {
        const sl = this.game.inventory.slotAt(i);
        if (!sl) return '';
        const item = getItem(sl.id);
        return `<b>${qualityNameHTML(sl.id, sl.q)}</b><br><span style="opacity:.8">${item.examine}</span>` + (item.equip ? this._gearTip(sl.id, 'main', sl.q || null) : '');
      }, () => this._invOptions(i));
      cell._sig = null;
      grid.appendChild(cell);
      cells.push(cell);
    }
    while (cells.length > slots.length) cells.pop().remove();
    // Whether a piece beats what you wear only changes with your gear, levels or
    // style, so it is worked out once per piece until one of those changes (the
    // endless pack holds hundreds of pieces late on, and every pickup redraws it).
    const eqp = this.game.equipment, sk = this.game.skills;
    // (Each worn piece's lines by stat and size: a replaced line changes what carries over.)
    const gearKey = this.game.combatMode() + '|' + ['attack', 'strength', 'defence', 'ranged', 'magic', 'agility', 'prayer'].map((k) => sk.level(k)).join(',')
      + '|' + EQUIP_SLOTS.map((sl) => { const w = eqp.get(sl); return w ? `${w}:${eqp.qualityIn?.(sl) || ''}:${eqp.refineLevel(w)}:${eqp.masteryRank(w)}:${(eqp.enchantLines?.(w) || []).map((l) => l.stat + l.value).join('+')}` : ''; }).join(',');
    if (this._betterKey !== gearKey) { this._betterKey = gearKey; this._betterOf = new Map(); }
    const betterOf = this._betterOf;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const cell = cells[i];
      // Category tabs show only matching items (coins count as "Other").
      const show = f === 'all' || (s && (itemCategory(s.id) === 'coins' ? 'other' : itemCategory(s.id)) === f);
      cell.style.display = show ? '' : 'none';
      let sig = 'empty';
      let up = 0, rl = 0, better = false;
      if (s) {
        const item = getItem(s.id);
        if (item.equip) {
          up = this.game.equipment.masteryRank(s.id);
          rl = this.game.equipment.refineLevel(s.id);
          const ln = eqp.enchantLines(s.id);
          const bk = `${s.id}|${s.q || ''}|${up}|${rl}${ln.length ? `|${ln.map((l) => l.stat + l.value).join('+')}` : ''}`;
          better = betterOf.get(bk);
          if (better === undefined) {
            better = wouldWear(this.game, s);   // what Equip best would put on, ★ and lines carried over (bestpick.js)
            betterOf.set(bk, better);
          }
        }
        sig = `${s.id}|${s.qty}|${up}|${rl}|${better ? 1 : 0}|${s.q || ''}`;
      }
      if (cell._sig === sig) continue;
      cell._sig = sig;
      cell.className = 'inv-slot' + (s ? ' filled' : '');
      if (!s) { cell.innerHTML = ''; continue; }
      const item = getItem(s.id);
      let html = `<span class="icon">${itemIconSVG(s.id, 32)}</span>`;
      if (item.stackable || s.qty > 1) {
        const lbl = stackLabel(s.qty);
        html += `<span class="qty ${lbl.cls}">${lbl.text}</span>`;
      }
      if (up || rl) html += this._gearBadge(s.id);
      if (s.q) html += this._qualityPip(s.q);   // a quality copy: a dot in its colour
      // Green arrow on gear that beats what you're wearing (and you can wear it).
      if (better) html += '<span class="gear-up" title="Better than what you are wearing">▲</span>';
      cell.innerHTML = html;
    }
  }

  _invDefault(i) {
    const s = this.game.inventory.slotAt(i);
    if (!s) return;
    const item = getItem(s.id);
    if (item.heal) this.game.eatItem(i);
    else if (item.potion) this.game.drinkPotion(i);
    else if (item.equip) this.game.equipItem(i);
    else if (isRound(s.id)) this.game.loadRounds(i);
    else if (item.tags?.includes('log')) this.askFireLogs(s.id);   // how many on this fire
    else if (isBone(s.id)) this.game.buryBones(i);
    else if (s.id === 'mark_of_grace') this.game.useMarkOfGrace(i);
    else if (s.id.startsWith('clue_scroll_')) this.game.readClue(i);
    else if (s.id.startsWith('reward_casket_')) this.game.openCasket(i);
    else if (s.id === 'birds_nest') this.game.openNest(i);
    else this.game.msg(item.examine, 'system');
  }

  _invContext(i, e) {
    const opts = this._invOptions(i);
    if (opts.length) this.showContextMenu(e.clientX, e.clientY, opts);
  }

  /** Everything you can do with an inventory item (right-click menu / hold card). */
  _invOptions(i) {
    const s = this.game.inventory.slotAt(i);
    if (!s) return [];
    const item = getItem(s.id);
    const opts = [];
    if (item.heal) opts.push({ label: 'Eat', target: item.name, fn: () => this.game.eatItem(i) });
    if (item.potion) opts.push({ label: 'Drink', target: item.name, fn: () => this.game.drinkPotion(i) });
    if (item.equip) {
      const main = this.game.equipment.get('weapon'), dual = canDualPair(s.id, main);
      if (dual) {
        // Holding a dagger already: choose which hand the new one goes in. A Monk's
        // knuckles (its gloves in the off-hand) offer the main hand first.
        const off = { label: 'Wield in off-hand', target: item.name, fn: () => this.game.equipOffhand(i) };
        const inMain = { label: 'Wield in main hand', target: item.name, fn: () => this.game.equipItem(i, { offhand: false }) };
        const shield = this.game.equipment.get('shield');
        const mixed = canDualPair(main, shield) && weaponTypeOf(main) !== weaponTypeOf(shield);
        opts.push(...(mixed && !this.game.goesOffhand(s.id) ? [inMain, off] : [off, inMain]));
      } else opts.push({ label: item.equip.slot === 'weapon' ? 'Wield' : 'Wear', target: item.name, fn: () => this.game.equipItem(i) });
      // Straight to its Refine or Enchant window (the runs are there), without the Gear Mastery list on the way.
      if (item.equip.bonuses && !item.tool) {
        opts.push({ label: 'Refine…', target: item.name, fn: () => this.openRefine(s.id) });
        opts.push({ label: 'Enchant…', target: item.name, fn: () => this.openEnchant(s.id) });
      }
    }
    if (isRound(s.id)) opts.push({ label: 'Load', target: item.name, fn: () => this.game.loadRounds(i) });
    if (item.tags?.includes('log')) opts.push({ label: 'Light', target: item.name, fn: () => this.askFireLogs(item.id) });
    if (isBone(s.id)) {
      opts.push({ label: s.qty > 1 ? `Bury ${Math.min(100, s.qty)}` : 'Bury', target: item.name, fn: () => this.game.buryBones(i) });
      if (s.qty > 100) opts.push({ label: `Bury all ${s.qty}`, target: item.name, fn: () => this.game.buryBones(i, Infinity) });
      if (s.qty > 1) opts.push({ label: 'Bury one', target: item.name, fn: () => this.game.buryBones(i, 1) });
      if (this.game.nearShrine()) opts.push({ label: 'Offer at monument', target: item.name, fn: () => this.game.buryBones(i, Infinity, true) }, { label: 'Offer all bones', target: 'every kind', fn: () => this.game.buryAllBones(true) });
      opts.push({ label: 'Bury all bones', target: 'every kind', fn: () => this.game.buryAllBones() });
    }
    if (s.id === 'mark_of_grace') opts.push({ label: 'Trade for XP', target: item.name, fn: () => this.game.useMarkOfGrace(i) });
    if (s.id.startsWith('clue_scroll_')) opts.push({ label: 'Read', target: item.name, fn: () => this.game.readClue(i) });
    opts.push(...cullingInvOptions(this, s, i));   // a forager's lamp or a Codex quill
    if (s.id.startsWith('reward_casket_')) opts.push({ label: 'Open', target: item.name, fn: () => this.game.openCasket(i) });
    if (s.id === 'birds_nest') opts.push({ label: 'Open', target: item.name, fn: () => this.game.openNest(i) });
    // Alchemy, once you can cast it and carry (or wield the staff for) nature runes.
    if (s.id !== 'coins' && item.value && !item.tags?.includes('rune') && this.game.skills.magic >= 21
      && (this.game.inventory.count('nature_rune') > 0 || this.game.freeRune() === 'nature_rune')) {
      opts.push({ label: 'Alchemise', target: `${item.name} (${this.game.alchemyValue(s.id)} coins)`, fn: () => this.game.alchemise(i) });
    }
    // Spare gear: sacrifice it to another piece's mastery, or break it down (salvage.js).
    if (isSalvageable(s.id)) {
      opts.push({ label: 'Sacrifice…', target: item.name, fn: () => openSacrificeFrom(this, s.id) });
      opts.push({ label: 'Dismantle', target: item.name, fn: () => openDismantle(this, s.id) });
    }
    // Beside the Offering Shrine, anything it takes can be offered from here.
    if ((isSalvageable(s.id) || goodsKind(s.id) || materialKind(s.id)) && nearOfferingShrine(this.game)) {
      // One tap offers (shrinehot.js): one, or every one you carry.
      const offer = (n) => {
        if (this.modal?.kind === 'shrine' && this.modal._hotItem) return this.modal._hotItem(s.id, n);
        const a = { pending: null, result: null }, b = { pending: null, result: null };
        if (!hotOffer(this, a, b, s.id, n) && (a.result || b.result)) this.game.msg(String(a.result || b.result).replace(/<[^>]+>/g, ''));
      };
      opts.push({ label: 'Offer at shrine', target: item.name, fn: () => offer(1) });
      if (this.game.inventory.count(s.id) > 1) opts.push({ label: 'Offer all at shrine', target: item.name, fn: () => offer(Infinity) });
      opts.push({ label: 'Open shrine', target: item.name, fn: () => this.openOfferingShrine() });
    }
    opts.push({ label: 'Drop', target: item.name, fn: () => this.game.dropItem(i, (n) => typeof confirm !== 'function'
      || confirm(`Drop all ${n.toLocaleString()} ${item.name}? Things left on the ground vanish after about 3 minutes.`)) });
    opts.push({ label: 'Info', target: item.name, fn: () => openEntry(this, 'item', s.id) });   // its encyclopedia page
    opts.push({ label: 'Examine', target: item.name, fn: () => this.game.msg(item.examine, 'system') });
    return opts;
  }

  // ---------------- Equipment ----------------
  /** The ammo slot: the rounds a gun fires (rounds.js), with how many are left. */
  _ammoCell(cell) {
    const a = this.game.equipment.ammo, gun = isGunId(this.game.equipment.get('weapon'));
    cell.dataset.slot = 'ammo';
    if (!a) {
      cell.className = 'equip-slot empty';
      cell.textContent = 'Ammo';
      this._tip(cell, () => `<b>Ammo slot</b><br>Load rounds here for pistols and sniper rifles: tap rounds in your pack.${gun ? '<br>Without rounds your guns fire plain shot.' : ''}`);
      return;
    }
    const it = getItem(a.id), lbl = stackLabel(a.qty);
    cell.className = 'equip-slot filled';
    cell.innerHTML = `${itemIconSVG(a.id, 32)}<span class="qty ${lbl.cls}">${lbl.text}</span>`;
    cell.addEventListener('click', () => this.game.unloadRounds());
    this._tip(cell, () => `<b>${escapeHtml(it.name)}</b> &times;${formatNumber(a.qty)}<br>+${it.roundStr} shot power for guns<br><span style="opacity:.8">${escapeHtml(it.examine)}</span>`
      + `${gun ? '' : '<br><span style="opacity:.8">Only pistols and sniper rifles fire rounds.</span>'}<br><span style="opacity:.8">Tap to unload</span>`,
      () => [{ label: 'Unload', target: it.name, fn: () => this.game.unloadRounds() }]);
  }

  renderEquipment() {
    const layout = this.el.equipLayout;
    // Out of sight (the panel folded, or the Bag showing) it only notes it is
    // out of date: every kill's gear mastery rebuilt it unseen. It catches up
    // when it shows (_catchUpPanels).
    if (this._equipDrawn && this._panelHidden(layout)) { this._equipStale = true; return; }
    this._equipDrawn = true;
    this._equipStale = false;
    this._equipBestBar(layout);
    layout.innerHTML = '';
    for (const slot of EQUIP_LAYOUT) {
      const cell = document.createElement('div');
      if (!slot) { cell.className = 'equip-slot empty'; cell.style.visibility = 'hidden'; layout.appendChild(cell); continue; }
      if (slot === 'ammo') { this._ammoCell(cell); layout.appendChild(cell); continue; }
      const id = this.game.equipment.get(slot);
      if (id) {
        const item = getItem(id);
        cell.className = 'equip-slot filled';
        cell.innerHTML = itemIconSVG(id, 32);
        const copy = this.game.equipment.copyIn(slot);   // a twin pair's off-hand copy has its own ★ and lines
        const q = this.game.equipment.qualityIn(slot);   // the worn copy's own quality
        if (this.game.equipment.masteryRank(id) || this.game.equipment.refineLevel(id, copy)) cell.insertAdjacentHTML('beforeend', this._gearBadge(id, copy));
        if (q) cell.insertAdjacentHTML('beforeend', this._qualityPip(q));
        cell.addEventListener('click', () => this.game.unequip(slot));
        // Hold (or right-click): Remove, as a tap does, then this piece's Refine and Enchant windows.
        const gear = !!item.equip?.bonuses && !item.tool;
        const acts = () => [{ label: 'Remove', target: item.name, fn: () => this.game.unequip(slot) },
          ...(gear ? [{ label: 'Refine…', target: item.name, fn: () => this.openRefine(id, copy) }, { label: 'Enchant…', target: item.name, fn: () => this.openEnchant(id, null, copy) }] : [])];
        cell.addEventListener('contextmenu', (e) => { e.preventDefault(); this.showContextMenu(e.clientX, e.clientY, acts()); });
        this._tip(cell, () => `<b>${qualityNameHTML(id, q)}</b>${this._gearTip(id, copy, q)}<br><span style="opacity:.8">${gear ? 'Tap to remove · hold or right-click to refine or enchant' : 'Tap to remove'}</span>`, acts);
      } else {
        cell.className = 'equip-slot empty';
        cell.textContent = capitalize(slot);
      }
      layout.appendChild(cell);
    }
    const b = this.game.equipment.bonuses();
    const speed = this.game.attackInterval();   // what you really get, spells and attack speed % included
    const sets = this.game.equipment.activeSets();
    const wid = this.game.equipment.get('weapon');
    let specLine = '';
    try { const sp = wid && getItem(wid).spec; if (sp) specLine = `<div class="row"><span>Special</span><span>${sp.name} (${sp.cost}%)</span></div>`; } catch {}
    this.el.equipBonuses.innerHTML =
      `<div class="row"><span>Melee attack</span><span>+${b.attack}</span></div>` +
      `<div class="row"><span>Melee power</span><span>+${b.strength}</span></div>` +
      `<div class="row"><span>Defence bonus</span><span>+${b.defence}</span></div>` +
      // Dual wielding: both weapons' stats count above, and each hand hits with its own weapon.
      (() => { const dm = this.game.dualMaxHits?.(); return dm ? `<div class="row dual-hits"><span>Max hit (each weapon its own)</span><span>Main hand ${dm.main} · Off-hand ${dm.off}</span></div>` : ''; })() +
      (b.ranged ? `<div class="row"><span>Ranged bonus</span><span>+${b.ranged}</span></div>` : '') +
      (b.magic ? `<div class="row"><span>Magic attack</span><span>+${b.magic}</span></div>` : '') +
      (b.crit ? `<div class="row"><span>Crit chance</span><span>+${b.crit}%</span></div>` : '') +
      (b.hp ? `<div class="row"><span>Bonus HP</span><span>+${b.hp}</span></div>` : '') +
      // The extra offensive stats, from armour families and gear.
      [['atkPct', 'Physical damage bonus'], ['magPct', 'Magic bonus'], ['pierce', 'Armour pierce'], ['critDmg', 'Crit damage'], ['haste', 'Attack speed'], ['lifesteal', 'Lifesteal'], ['bossDmg', 'Boss damage']]
        .map(([k, l]) => (b[k] ? `<div class="row off-stat"><span>${l}</span><span>+${b[k]}%</span></div>` : '')).join('') +
      // What your fighting levels add on top of your gear (see levelBonuses).
      (() => { const lb = levelBonuses({ attack: this.game.skills.attack, ranged: this.game.skills.ranged, magic: this.game.skills.magic, agility: this.game.skills.agility, dance: this.game.skills.danceLevel() });
        const sk = this.game.skills;
        return `<div class="row lvl-bonus"><span>From your levels</span><span>+${lb.attack} Atk/Str · +${lb.ranged} Rng · +${lb.magic} Mag (+${lb.magicStr} dmg) · +${lb.dance} Dance</span></div>`
          + `<div class="row lvl-bonus"><span>Level damage</span><span>+${levelFlatDmg(sk.attack)} melee · +${levelFlatDmg(sk.ranged)} ranged · +${levelFlatDmg(sk.magic)} magic max hit</span></div>`; })() +
      `<div class="row"><span>Time between attacks</span><span>${speed * 0.3 < 0.1 ? (speed * 0.3).toFixed(3) : speed * 0.3 < 0.3 ? (speed * 0.3).toFixed(2) : (speed * 0.3).toFixed(1)}s</span></div>` +
      specLine +
      (sets.length ? `<div class="row set-bonus"><span>Set bonus</span><span>${sets.join(', ')}</span></div>` : '');
    // What you're wearing, slot by slot: name, mastery rank and stats. Tap a
    // row to open its full details (tier, requirements, class armour note).
    const worn = EQUIP_SLOTS.filter((s) => this.game.equipment.get(s));
    const list = document.createElement('div');
    list.className = 'eq-list';
    list.innerHTML = `<div class="eq-head">Equipped (${worn.length}/${EQUIP_SLOTS.length})</div>`;
    if (!worn.length) list.insertAdjacentHTML('beforeend', '<div class="eq-empty">Nothing equipped yet.</div>');
    for (const slot of worn) {
      const id = this.game.equipment.get(slot);
      const eq = getItem(id).equip;
      const rk = this.game.equipment.masteryRank(id), copy = this.game.equipment.copyIn(slot), rl = this.game.equipment.refineLevel(id, copy);
      const q = this.game.equipment.qualityIn(slot);
      const fam = eq.family ? `<span class="eq-fam">${ARMOUR_FAMILIES[eq.family].name}</span>` : '';
      const row = document.createElement('details');
      row.className = 'eq-row';
      row.innerHTML = `<summary><span class="eq-ic">${itemIconSVG(id, 26)}</span>`
        + `<span class="eq-txt"><span class="eq-slot">${slot === 'shield' && this.game.equipment.isDualWielding() ? 'Off-hand' : capitalize(slot)}</span>`
        + `<b class="eq-name">${qualityNameHTML(id, q, escapeHtml)}${rl ? ` <span class="refine-tag">${refineTag(rl)}</span>` : ''}</b>${rk ? `<span class="eq-mastery">${masteryTypeName(id)} mastery: ${MASTERY_RANKS[rk].name}</span>` : ''}${fam}`
        + `<span class="eq-stats">${this._gearStats(id, false, copy, q)}</span></span></summary>`
        + `<div class="eq-detail">${this._gearTip(id, copy, q)}</div>`;
      const off = document.createElement('button');
      off.className = 'eq-remove'; off.type = 'button'; off.textContent = 'Remove';
      off.addEventListener('click', () => this.game.unequip(slot));
      row.querySelector('.eq-detail').appendChild(off);
      list.appendChild(row);
    }
    this.el.equipBonuses.prepend(list);
    const guide = document.createElement('button');
    guide.className = 'bestiary-open gear-guide-open';
    guide.textContent = 'Gear Guide: which equipment is better?';
    guide.addEventListener('click', () => this.openGearGuide());
    this.el.equipBonuses.appendChild(guide);
    // What mastery ranks and quality tiers mean, as two ladders.
    const rq = document.createElement('button');
    rq.className = 'bestiary-open gear-guide-open ranks-open';
    rq.textContent = '? Mastery ranks & quality tiers explained';
    rq.addEventListener('click', () => openRanksGuide(this));
    this.el.equipBonuses.appendChild(rq);
    const ms = document.createElement('button');
    ms.className = 'bestiary-open gear-guide-open';
    ms.textContent = 'Gear mastery & enchanting';
    ms.addEventListener('click', () => this.openMastery());
    this.el.equipBonuses.appendChild(ms);
    // Refining lives in the same window, next to each piece's Enchant button.
    const rf = document.createElement('button');
    rf.className = 'bestiary-open gear-guide-open';
    rf.textContent = `Refine gear (★1 to ★${MAX_REFINE})`;
    rf.addEventListener('click', () => this.openMastery());
    this.el.equipBonuses.appendChild(rf);
  }

  /** "Equip best in slot", pinned to the top of the Gear view: one tap puts on
   *  the strongest gear in the bag, and it says how many pieces would change.
   *  (It sat below the worn slots, so on a phone's short sheet the owner had to
   *  scroll down to it and back up to see what changed.) */
  _equipBestBar(layout) {
    let bar = this._eqBestBar;
    if (!bar) {
      bar = this._eqBestBar = document.createElement('div');
      bar.className = 'eq-bestbar';
      // Beside it, every safe upgrade on what you wear in one go (smartgearui.js).
      bar.innerHTML = '<button type="button" class="bestiary-open gear-guide-open eq-best"></button><button type="button" class="bestiary-open gear-guide-open eq-improve"></button>';
      bar.firstChild.addEventListener('click', () => this.game.equipBest());
      bar.lastChild.addEventListener('click', () => openImprove(this));
      layout.parentNode?.insertBefore(bar, layout);
    }
    // Slots, not pieces: three better shields are one upgrade (bestpick.js).
    const n = upgradeSlots(this.game).size;
    const html = `${inlineIcon(tabIconSVG('equipment', 18))} Equip best in slot${n ? ` <span class="eq-best-n">${n} upgrade${n > 1 ? 's' : ''}</span>` : ''}`;
    if (bar.firstChild.innerHTML !== html) bar.firstChild.innerHTML = html;
    bar.firstChild.classList.toggle('has-up', n > 0);
    const k = improveCount(this.game), imp = bar.lastChild;
    const ih = `&#10022; Improve${k ? ` <span class="eq-best-n">${k}</span>` : ''}`;
    if (imp._html !== ih) { imp._html = ih; imp.innerHTML = ih; }
    imp.classList.toggle('none', !k);
    imp.title = k ? `${k} worn piece${k > 1 ? 's' : ''} can be improved safely` : 'Nothing safe to improve right now';
    // It pins just under the Bag / Gear switch, which is pinned too: measured
    // after the browser's own layout (next frame), so this forces none.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => {
      const pb = document.getElementById('panel-body'), st = document.getElementById('panel-subtabs');
      if (!pb || !bar.isConnected) return;
      const pad = parseFloat(getComputedStyle(pb).paddingTop) || 0;
      const under = st && st.offsetParent && getComputedStyle(st).position === 'sticky' ? st.getBoundingClientRect().bottom - pb.getBoundingClientRect().top : 0;
      bar.style.top = `${Math.round(under - pad)}px`;
    });
  }

  /** The little corner badge on a gear icon: its mastery rank and refine level ("M★7"). */
  _gearBadge(id, copy = 'main') {
    const rk = this.game.equipment.masteryRank(id), rl = this.game.equipment.refineLevel(id, copy);
    const title = [rk ? `${masteryTypeName(id)} mastery: ${MASTERY_RANKS[rk].name}` : '', rl ? `Refined ${refineTag(rl)}` : ''].filter(Boolean).join(', ');
    return `<span class="up-badge" title="${title}">${rk ? MASTERY_RANKS[rk].abbr : ''}${rl ? `<span class="refine-star">${refineTag(rl)}</span>` : ''}</span>`;
  }

  /** A quality copy's dot, in the quality's colour (on its icon). */
  _qualityPip(q) {
    // Its painted badge on the coloured dot (the dot shows if the picture can't load).
    return QUALITY[q] ? `<span class="q-pip q-${q}" style="background:${QUALITY[q].color}" title="${QUALITY[q].label} quality">${playIconHTML(`quality-${q}`, 14)}</span>` : '';
  }

  /** Stat chips for one piece of gear, e.g. "+12 Defence · 1.2s" (`q`: the copy's quality).
   *  `notes` (statworth.js gearWorthNotes): what each offensive stat is worth to you. */
  _gearStats(id, base = false, copy = 'main', q = null, notes = null) {
    const eq = getItem(id).equip;
    const b = base ? (eq.bonuses || {}) : this.game.equipment.itemBonuses(id, copy, q);
    const chips = Object.keys(STAT_LABELS).filter((k) => b[k]).map((k) => `+${Math.round(b[k] * 10) / 10} ${STAT_LABELS[k]}`
      + (notes?.[k] ? ` <span class="gt-worth">(${notes[k]})</span>` : ''));
    if (eq.slot === 'weapon') chips.push(`${capitalize(weaponStyle(id))}, ${(swingBeats(id) * 0.3).toFixed(1)}s swing`);
    if (eq.range) chips.push(`${eq.range}-tile range`);
    if (eq.runes) chips.push(`Unlimited ${getItem(eq.runes).name.toLowerCase()}s`);
    return chips.join(' · ') || 'No combat stats';
  }

  /** Tooltip block for equipment: stats, tier in its slot, requirements and
   *  how it compares with what's worn. `copy` 'off': the worn off-hand copy of
   *  a twin pair, which has its own refine and enchant lines. */
  _gearTip(id, copy = 'main', q = null) {
    const eq = getItem(id).equip;
    const t = tierOf(id);
    const req = meetsReq(id, this.game.skills);
    const reqTxt = Object.entries(eq.req || {}).filter(([, l]) => l > 1).map(([k, l]) => `${capitalize(k)} ${l}`).join(', ');
    const rk = this.game.equipment.masteryRank(id), lines = this.game.equipment.enchantLines(id, copy), rl = this.game.equipment.refineLevel(id, copy);
    // A boss's signature weapon: whose it is and which class it's made for.
    const sig = getItem(id).signature;
    let html = (sig ? `<div class="gt-sig">Signature weapon of ${escapeHtml(getNpc(sig.boss).name)} · for ${escapeHtml(CLASS_BY_ID[sig.classId].name)}</div>` : '')
      + (QUALITY[q] ? `<div class="gt-qual">${qualityLine(q)}</div>` : '')
      + `<div class="gt-up">${masteryLine(masteryTypeName(id), this.game.equipment.masteryXp(id))}</div>`
      + (copy === 'off' ? '<div class="gt-up">Off-hand copy: its own refine and enchantments</div>' : '')
      + (rl ? `<div class="gt-refine">Refined ${refineTag(rl)}</div>` : '')
      + (lines.length ? `<div class="gt-ench">Enchanted: ${lines.map(enchantLabel).join(' · ')}</div>` : '')
      + `<div class="gt-stats">${this._gearStats(id, false, copy, q, gearWorthNotes(this.game, id, copy, q))}</div>`
      + `<div class="gt-tier">#${t.rank} of ${t.of} ${eq.slot === 'weapon' ? weaponStyle(id) + ' weapons' : eq.slot + ' items'}</div>`;
    if (reqTxt) html += `<div class="gt-req ${req.ok ? 'ok' : 'no'}">Needs ${reqTxt}${req.ok ? ' ✓' : ''}</div>`;
    if (sig && sigBarred(this.game.jobClass, id)) return html + `<div class="gt-req no">Made for ${escapeHtml(CLASS_BY_ID[sig.classId].name)}s only: a trophy for you</div>`;
    if (isTwoHanded(id)) {
      html += `<div class="gt-req">Two-handed: no shield${takesQuiver(id) ? ' (a quiver fits)' : ''}</div>`;
      // The grip bonus that stands in for the off-hand (already counted in the stats above).
      const g = eq.grip;
      if (g) html += `<div class="gt-grip">Two-handed grip: +${g.defence} Defence, +${g.hp} life${g.ranged ? `, +${g.ranged} Ranged` : ''}${g.atkPct != null ? `, +${g.atkPct}% damage, +${g.haste}% attack speed` : ''} (makes up for having no ${takesQuiver(id) ? 'shield' : 'off-hand'})</div>`;
    }
    else if (eq.slot === 'shield' && offhandBlocked(this.game.equipment.get('weapon'), id)) html += `<div class="gt-req no">Your weapon is two-handed: no shield</div>`;
    else if (shieldBarred(this.game.jobClass, id)) { html += `<div class="gt-req no">${noShieldMsg(this.game.jobClass)}</div>`; return html; }
    // Accessories suit one fighting style: say which, and whether it's yours.
    if (eq.style) {
      const mine = this.game.combatMode() === 'dance' ? 'melee' : this.game.combatMode();
      html += `<div class="gt-req ${eq.style === mine ? 'ok' : 'no'}">For ${eq.style} fighters${eq.style === mine ? ' ✓' : ''}</div>`;
    }
    // Class armour: say whose armour this is, and warn when it isn't yours.
    if (eq.family) {
      const who = Object.keys(ARMOUR_FAMILY).filter((c) => ARMOUR_FAMILY[c] === eq.family).map((c) => CLASS_BY_ID[c].name).join(', ');
      const ok = canWear(this.game.jobClass, id);
      html += `<div class="gt-req ${ok ? 'ok' : 'no'}">${ARMOUR_FAMILIES[eq.family].name} armour: ${who}${ok ? '' : ' (not your class)'}</div>`;
      if (!ok) return html;
    }
    const eqp = this.game.equipment;
    // A different type of the dual kind always goes on the other hand (a Monk's gloves
    // beside its knuckles, Game.goesOffhand), so it is weighed there alone.
    const main = eqp.get('weapon');
    const mixedOff = canDualPair(id, main) && weaponTypeOf(id) !== weaponTypeOf(main) && this.game.goesOffhand(id);
    // A dual wielder's spare weapon is weighed against the off-hand too (each hand hits with its own weapon).
    const dualOff = !mixedOff && eqp.isDualWielding() && canDualPair(id, main);
    if (copy === 'off' || ((dualOff || mixedOff) && eqp.get('shield') === id && main !== id)) return html + '<div class="gt-verdict same">Currently worn (off-hand)</div>';
    const cmp = compareGear(id, eqp, mixedOff ? 'shield' : null, q, this.game.combatMode());
    if (cmp.verdict === 'worn') return html + '<div class="gt-verdict same">Currently worn</div>';
    const offCmp = dualOff && eqp.get('shield') !== id ? compareGear(id, eqp, 'shield', q, this.game.combatMode()) : null;
    // A matching weapon goes in a free off-hand first, as equipItem does.
    const slot = mixedOff || (canDualPair(id, main) && !dualOff) ? 'shield' : eq.slot;
    // A piece in the pack bound for its own slot is weighed as it will be
    // worn: with the ★ and lines that carry over to it, as Equip best weighs
    // it (bestpick.js). A plain higher tier read "Downgrade" here, then went on.
    const pv = slot === eq.slot && this.game.inventory.count(id) > 0 ? carryPreview(this.game, id, q) : null;
    const vs = cmp.worn ? ` vs ${escapeHtml(getItem(cmp.worn).name)}` : '';
    const label = pv ? { upgrade: cmp.verdict !== 'upgrade' ? '▲ Upgrade once your ★ and lines carry over' : '▲ Upgrade', downgrade: '▼ Downgrade, even with your ★ and lines carried over', same: '= Same strength' }[pv.verdict]
      : { upgrade: '▲ Upgrade', downgrade: '▼ Downgrade', same: '= Same strength', empty: '▲ Fills an empty slot', style: '⇄ Different fighting style' }[cmp.verdict];
    html += `<div class="gt-verdict ${pv ? pv.verdict : cmp.verdict}">${label}${vs}</div>`;
    const deltas = pv ? pv.deltas : cmp.deltas;
    if (deltas.length && cmp.worn) html += `<div class="gt-deltas">${deltas.map((d) => {
      const good = d.lowerIsBetter ? d.delta < 0 : d.delta > 0;
      return `<span class="${good ? 'pos' : 'neg'}">${deltaText([d])}</span>`;
    }).join(' ')}</div>`;
    // The offensive stats summed up in plain damage terms (statworth.js).
    const sw = pv ? pv.worth : cmp.worn && cmp.verdict !== 'style' && !mixedOff ? gearSwapWorth(this.game, id, eq.slot, q) : null;
    if (sw != null && Math.abs(sw) >= 0.05) {
      html += `<div class="gt-worth-all ${sw > 0 ? 'pos' : 'neg'}">Overall: ≈ ${fmtWorth(sw)} damage vs equipped${pv ? ', once the carry is done' : ' <span class="gt-worth">(offensive stats)</span>'}</div>`;
    }
    if (offCmp?.worn) html += `<div class="gt-verdict ${offCmp.verdict}">Off-hand: ${{ upgrade: '▲ Upgrade', downgrade: '▼ Downgrade', same: '= Same strength' }[offCmp.verdict] || ''} vs ${escapeHtml(getItem(offCmp.worn).name)}</div>`;
    // Say what a better piece would take over from the worn one (carry.js).
    for (const [s, pre] of [[slot, ''], ...(dualOff ? [['shield', 'Off-hand: ']] : [])]) {
      const plan = planCarry(eqp, id, s, q);
      if (plan) html += `<div class="gt-carry">${pre}Equipping carries over ${escapeHtml(carrySummary(plan))}</div>`;
    }
    return html;
  }

  // ---------------- Gear mastery & enchanting ----------------
  // Every piece you wear or carry: its mastery rank with a bar to the next,
  // and its enchant lines with a button to add (or replace) one.
  openMastery(focusId = null) {
    const g = this.game;
    const render = (body) => {
      // The ranks card and the rules fold away under one line: open, they
      // filled a phone's whole window before the first piece of gear.
      body.innerHTML = '<div class="gear-intro"><details class="gear-help"><summary>How mastery, quality, enchanting and refining work</summary>'
        + ranksCardHTML() + '<p>Gear grows stronger as you fight with it: <b>mastery</b> and <b>quality</b> are shown above. '
        + `<b>Enchanting</b> adds up to ${MAX_ENCHANTS} bonus lines: choose one of three on offer, paid for with upgrade stones and coins. An <b>upgrade ward</b> rerolls the offer. `
        + `<b>Refining</b> (★1 to ★${MAX_REFINE}) adds a share of the base stats on top, paid for with <b>refine scrolls</b> only; the higher you go, the riskier it gets. `
        + `<b>Feed materials</b> from your life skills to add mastery too (bars for metal, logs for bows and staves, hides for leather, gems for jewellery, herbs for cloth), up to ${MASTERY_RANKS[FEED_CAP_RANK].name}. `
        + '<b>Sacrifice</b> spare gear of the same type for mastery as well, or <b>dismantle</b> it for upgrade stones and refine scrolls. '
        + 'Enchantments and refining belong to the item, so every copy you own shares them; a weapon worn in both hands is the one exception, as its off-hand copy has its own refine and enchantments. '
        + '</p></details>'
        + `<p>You have ${formatNumber(g.inventory.count(UP_STONE))} stones, ${g.inventory.count(UP_WARD)} wards and ${formatNumber(g.inventory.count(REFINE_SCROLL))} refine scrolls.</p></div>`;
      // One go: feed what your pack holds to every piece you wear (feedall.js),
      // after a look at what it would use. Then the spare-gear dismantler.
      const top = document.createElement('div');
      top.className = 'gear-view';
      // First: every safe upgrade on everything worn, in one go (smartgearui.js).
      const imp = document.createElement('button');
      imp.type = 'button';
      imp.className = 'gear-tab improve-open' + (improveCount(g) > 0 ? ' active' : '');
      imp.innerHTML = '&#10022; Improve all worn gear…';
      imp.addEventListener('click', () => openImprove(this));
      top.appendChild(imp);
      const plan = feedAllPlan(g);
      if (plan.length) {
        const fa = document.createElement('button');
        fa.type = 'button';
        fa.className = 'gear-tab feed-all active';
        fa.textContent = 'Feed materials to worn gear…';
        fa.addEventListener('click', () => this._openFeedAll());
        top.appendChild(fa);
      }
      // Spare gear can be broken down for stones and scrolls (salvage.js).
      const dis = document.createElement('button');
      dis.type = 'button';
      dis.className = 'gear-tab salvage-open';
      dis.textContent = 'Dismantle spare gear…';
      dis.addEventListener('click', () => openDismantle(this));
      top.appendChild(dis);
      body.appendChild(top);
      const worn = [...new Set(EQUIP_SLOTS.map((s) => g.equipment.get(s)).filter(Boolean))];
      const bag = [...new Set(g.inventory.slots.filter((s) => s && getItem(s.id).equip?.bonuses).map((s) => s.id))].filter((id) => !worn.includes(id));
      // Wearing first; the gear in your bag (often a pile of spares) a tab away.
      if (bag.length && !worn.includes(focusId) && bag.includes(focusId)) this._gearView = 'bag';
      const view = bag.length && this._gearView === 'bag' ? 'bag' : 'worn';
      if (bag.length) {
        const tabs = document.createElement('div');
        tabs.className = 'gear-view';
        for (const [v, label] of [['worn', `Wearing (${worn.length})`], ['bag', `In your bag (${bag.length})`]]) {
          const t = document.createElement('button');
          t.type = 'button';
          t.className = 'gear-tab' + (v === view ? ' active' : '');
          t.dataset.view = v;
          t.textContent = label;
          t.addEventListener('click', () => { this._gearView = v; redraw(body, render); });
          tabs.appendChild(t);
        }
        body.appendChild(tabs);
      }
      const ids = view === 'bag' ? bag : worn;
      const list = document.createElement('div');
      list.className = 'gear-list';
      if (!ids.length) list.innerHTML = '<div class="modal-hint">Wear or carry some gear to see its mastery.</div>';
      for (const id of ids) {
        const xp = g.equipment.masteryXp(id), p = rankProgress(xp);
        const lines = g.equipment.enchantLines(id);
        const c = g.enchantCostFor(id);
        const okS = g.inventory.count(UP_STONE) >= c.stones, okC = g.inventory.count('coins') >= c.coins;
        const worn = EQUIP_SLOTS.some((s) => g.equipment.get(s) === id);
        const rl = g.equipment.refineLevel(id);
        const row = document.createElement('div');
        row.className = 'gear-row mastery-row';
        row.dataset.id = id;   // so coming Back from a piece's Enchant or Refine lands on it again
        row.innerHTML = `<span class="gear-ic">${itemIconSVG(id, 28)}</span>`
          + `<div class="gear-info"><div class="gear-name"><b>${escapeHtml(getItem(id).name)}</b>${rl ? `<span class="gear-tag refine-tag">${refineTag(rl)}</span>` : ''}<span class="gear-tag mastery-tag">${masteryTypeName(id)}: ${MASTERY_RANKS[p.rank].name}</span>${worn ? '<span class="gear-tag worn">Wearing</span>' : ''}</div>`
          + `<div class="mastery-bar"><span style="width:${Math.round(p.frac * 100)}%"></span></div>`
          + `<div class="gear-stats mastery-xp">${masteryProgressText(xp)}</div>`
          + `<div class="gear-stats">${this._gearStats(id)}</div>`
          + `<div class="ench-lines">Enchantments ${lines.length}/${MAX_ENCHANTS}: ${lines.length ? lines.map((l) => `<span class="ench-chip">${enchantLabel(l)}</span>`).join(' ') : 'none yet'}</div>`
          + (g.equipment.twinWorn(id) ? (() => {
            // One in each hand: the off-hand copy has its own ★ and lines (Enchant and Refine ask which hand).
            const ol = g.equipment.enchantLines(id, 'off'), orl = g.equipment.refineLevel(id, 'off');
            return `<div class="ench-lines off-copy">Off-hand copy: ${orl ? `<span class="gear-tag refine-tag">${refineTag(orl)}</span>` : 'not refined'} · ${ol.length}/${MAX_ENCHANTS}: ${ol.length ? ol.map((l) => `<span class="ench-chip">${enchantLabel(l)}</span>`).join(' ') : 'none yet'}</div>`;
          })() : '')
          + '</div>';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gear-tab ench-open' + (okS && okC ? ' active' : '');
        b.innerHTML = `${lines.length >= MAX_ENCHANTS ? 'Replace a line' : 'Enchant'}<br><span class="${okS ? '' : 'short'}">${c.stones} stones</span>, <span class="${okC ? '' : 'short'}">${formatNumber(c.coins)} coins</span>`;
        b.addEventListener('click', () => this.openEnchant(id));
        // Refine sits next to Enchant: the next ★ and its scroll cost.
        const btns = document.createElement('div');
        btns.className = 'gear-btns';
        btns.appendChild(b);
        const rb = document.createElement('button');
        rb.type = 'button';
        if (rl >= MAX_REFINE) {
          rb.className = 'gear-tab refine-open';
          rb.innerHTML = `Refine<br>${refineTag(MAX_REFINE)} (max)`;
        } else {
          const rc = refineCost(id, rl + 1), okR = g.inventory.count(REFINE_SCROLL) >= rc.scrolls;
          rb.className = 'gear-tab refine-open' + (okR ? ' active' : '');
          rb.innerHTML = `Refine ${refineTag(rl + 1)}<br><span class="${okR ? '' : 'short'}">${rc.scrolls} scroll${rc.scrolls > 1 ? 's' : ''}</span>`;
        }
        rb.addEventListener('click', () => this.openRefine(id));
        btns.appendChild(rb);
        // Feed sits below: life-skill materials for mastery points, up to Master.
        const fb = document.createElement('button');
        fb.type = 'button';
        const kind = feedKind(id), capped = xp >= FEED_CAP;
        fb.className = 'gear-tab feed-open' + (!capped && g.feedOptions(id).length ? ' active' : '');
        fb.innerHTML = capped ? `Feed materials<br>${MASTERY_RANKS[FEED_CAP_RANK].name} reached` : `Feed materials<br>${MATERIAL_KINDS[kind] || ''}`;
        fb.addEventListener('click', () => this.openFeed(id));
        btns.appendChild(fb);
        // ...and spare gear (any class, any slot) can be sacrificed to it.
        const sb = document.createElement('button');
        sb.type = 'button';
        sb.className = 'gear-tab sacrifice-open' + (!capped && g.inventory.slots.some((x) => x && x.id !== id && isSalvageable(x.id) && sameKind(id, x.id)) ? ' active' : '');
        sb.innerHTML = capped ? `Sacrifice gear<br>${MASTERY_RANKS[FEED_CAP_RANK].name} reached` : `Sacrifice gear<br>spare ${masteryTypeName(id).toLowerCase()} gear`;
        sb.addEventListener('click', () => openSacrifice(this, id));
        btns.appendChild(sb);
        row.appendChild(btns);
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('Gear Mastery', render);
    // Back from a piece's Enchant or Refine: scroll that piece's row into view.
    if (focusId && this.el?.modalBody) {
      const row = [...this.el.modalBody.querySelectorAll('.mastery-row')].find((r) => r.dataset.id === focusId);
      try { row?.scrollIntoView({ block: 'center' }); } catch { /* old browsers */ }
      row?.classList.add('focus-flash');
    }
  }

  /** "Improve worn gear" (smartgearui.js), for the quick bar and search. */
  openImproveGear() { openImprove(this); }

  /** "Feed materials to worn gear": what it would use and add, then Feed or Back. */
  _openFeedAll() {
    const g = this.game;
    const render = (body) => {
      const plan = feedAllPlan(g);
      body.innerHTML = '';
      if (!plan.length) {
        body.insertAdjacentHTML('beforeend', '<div class="modal-hint">Nothing to feed: your worn gear is at Master, or your pack holds no materials it takes.</div>');
      } else {
        const used = new Map();
        for (const p of plan) used.set(p.matId, (used.get(p.matId) || 0) + p.n);
        body.insertAdjacentHTML('beforeend', `<p>This uses ${[...used].map(([id, n]) => `<b>${formatNumber(n)} ${escapeHtml(getItem(id).name)}</b>`).join(', ')} from your pack, up to ${MASTERY_RANKS[FEED_CAP_RANK].name} on each piece:</p>`
          + `<ul class="feed-plan">${plan.map((p) => `<li>${itemIconSVG(p.gearId, 18)} ${escapeHtml(getItem(p.gearId).name)}: ${formatNumber(p.n)} ${escapeHtml(getItem(p.matId).name)}, +${formatNumber(p.xp)} mastery XP</li>`).join('')}</ul>`);
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'gear-tab active';
        go.textContent = 'Feed';
        go.addEventListener('click', () => { feedAll(g, plan); this.openMastery(); });
        body.appendChild(go);
      }
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'gear-tab';
      back.textContent = 'Back to all gear';
      back.addEventListener('click', () => this.openMastery());
      body.appendChild(back);
    };
    this.openModal('Feed materials to worn gear', render);
  }

  /** "Main hand | Off-hand" tabs for a weapon worn in both hands: each copy
   *  of a twin pair is refined and enchanted on its own. Null otherwise. */
  _handPicker(id, copy, pick) {
    if (!this.game.equipment.twinWorn(id)) return null;
    const box = document.createElement('div');
    box.className = 'hand-pick';
    box.insertAdjacentHTML('beforeend', '<span class="hand-pick-label">Which copy?</span>');
    for (const [c, label] of [['main', 'Main hand'], ['off', 'Off-hand']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gear-tab hand-tab' + (c === copy ? ' active' : '');
      b.dataset.hand = c;
      b.textContent = `${label} ${refineTag(this.game.equipment.refineLevel(id, c)) || '★0'}`;
      b.addEventListener('click', () => pick(c));
      box.appendChild(b);
    }
    return box;
  }

  /** Enchant one item type: three lines on offer, pick one (the cost is paid
   *  then), reroll with a ward, or go back. A full item first asks which of its
   *  lines to replace. `copy` 'off': a twin pair's off-hand copy. */
  openEnchant(id, replace = null, copy = 'main') {
    const g = this.game;
    if (!g.equipment.twinWorn(id)) copy = 'main';
    const name = escapeHtml(getItem(id).name);
    const button = (html, fn, cls = '') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gear-tab ' + cls;
      b.innerHTML = html;
      b.addEventListener('click', fn);
      return b;
    };
    let done = null;   // the line just added, shown at the top
    const render = (body) => {
      const lines = g.equipment.enchantLines(id, copy);
      const full = lines.length >= MAX_ENCHANTS;
      const c = g.enchantCostFor(id, copy);
      const can = g.canAffordEnchant(id, copy);
      body.innerHTML = `<div class="gear-intro"><p>${done ? `<b class="refine-out success">Enchanted: ${enchantLabel(done)}</b><br>` : ''}${copy === 'off' ? 'Your off-hand ' : ''}${name} has ${lines.length}/${MAX_ENCHANTS} enchantments${lines.length ? ': ' + lines.map(enchantLabel).join(', ') : ''}. `
        + `Enchanting costs <b>${c.stones} upgrade stones</b> and <b>${formatNumber(c.coins)} coins</b>, paid when you pick a line. `
        + `You have ${formatNumber(g.inventory.count(UP_STONE))} stones and ${formatNumber(g.inventory.count('coins'))} coins.`
        + (can ? '' : ' <span class="short">You can\'t afford it yet.</span>') + '</p></div>';
      const hands = this._handPicker(id, copy, (c2) => { copy = c2; replace = null; redraw(body, render); });
      if (hands) body.prepend(hands);
      mountEnchantRun(this, body, id, copy, () => redraw(body, render));   // "Keep enchanting until…"
      const box = document.createElement('div');
      box.className = 'ench-choices';
      const wards = g.inventory.count(UP_WARD);
      const reroll = () => button(`Reroll the offer (uses a ward, ${wards} left; wards also save ★10+ refines)`, () => { g.rerollEnchant(id, copy); redraw(body, render); });
      if (full && replace == null) {
        // What is on offer, so you can choose which line goes knowing what comes in.
        box.insertAdjacentHTML('beforeend', `<div class="ench-preview">On offer now: ${g.enchantOffers(id, copy).map(enchantLabel).join(' · ')}</div>`
          + '<div class="ench-head">All three lines are full. Which one should go?</div>');
        lines.forEach((l, i) => box.appendChild(button(`Replace ${enchantLabel(l)}`, () => { replace = i; redraw(body, render); })));
        if (wards > 0) box.appendChild(reroll());
      } else {
        box.insertAdjacentHTML('beforeend', `<div class="ench-head">${full ? `Replacing ${enchantLabel(lines[replace])}. ` : ''}Choose one:</div>`);
        g.enchantOffers(id, copy).forEach((o, i) => {
          // Picking a line stays on this piece (the owner found jumping back to the list clunky).
          // Each offer says how it measures up against the lines the piece already has.
          const v = compareEnchantOffer(o, lines, replace);
          const b = button(`${enchantLabel(o)}<span class="ench-verdict ${v.kind}">${escapeHtml(v.text)}</span>`, () => { if (g.pickEnchant(id, i, replace, copy)) { done = o; replace = null; } redraw(body, render); }, 'active ench-offer');
          b.disabled = !can;
          box.appendChild(b);
        });
        if (wards > 0) box.appendChild(reroll());
      }
      box.appendChild(button('Refine this piece', () => this.openRefine(id, copy), 'ench-switch'));
      box.appendChild(button('Back to all gear', () => this.openMastery(id), 'ench-cancel'));
      body.appendChild(box);
    };
    this.openModal(`Enchant ${getItem(id).name}`, render);
  }

  /** Refine one item type: its ★ level, what the next level adds, the odds,
   *  the scrolls it takes against the scrolls you have, and a button to try.
   *  `copy` 'off': a twin pair's off-hand copy, refined on its own. */
  openRefine(id, copy = 'main') {
    const g = this.game;
    if (!g.equipment.twinWorn(id)) copy = 'main';
    const name = escapeHtml(getItem(id).name);
    const pct = (x) => `${Math.round(x * 100)}%`;
    let last = null;   // the outcome of the attempt just made, shown at the top
    const render = (body) => {
      const lv = g.equipment.refineLevel(id, copy);
      const have = g.inventory.count(REFINE_SCROLL), wards = g.inventory.count(UP_WARD);
      const said = { success: 'Success! It shines brighter.', fail: 'The refine failed; the scrolls are used up.', downgrade: 'The refine failed and the item lost a level.',
        broken: 'The item shattered and is gone.', warded: 'It went badly, but your upgrade ward crumbled instead.' }[last];
      let html = `<div class="gear-intro"><p>${said ? `<b class="refine-out ${last}">${said}</b><br>` : ''}`
        + `${copy === 'off' ? 'Your off-hand ' : ''}${name} is ${lv ? `refined <b>${refineTag(lv)}</b>` : 'not refined yet'}. You have ${wards} upgrade ward${wards === 1 ? '' : 's'}.</p>`
        // The rules fold away, so the Refine button stays on a phone's screen.
        + '<details class="gear-help"><summary>How refining works</summary><p>'
        + `Each ★ adds a share of <i>this item's own</i> base stats (stronger gear gains more) on top of mastery: 6% a level to ★9, 10% to ★12, 15% to ★${MAX_REFINE}. `
        + '★1–★5 always work; from ★6 an attempt can <b>fail</b> (scrolls lost); from ★10 it can <b>downgrade</b> the item a level; from ★13 it can <b>break</b> the item, destroying it. '
        + 'An <b>upgrade ward</b> in your pack takes a downgrade or a break instead.</p></details></div>';
      if (lv >= MAX_REFINE) {
        html += `<div class="ench-head">Fully refined: ${refineTag(MAX_REFINE)}.</div>`;
      } else {
        // What the next ★ adds: the gain at the next level less the gain now, both from the base stats.
        const next = lv + 1, c = refineCost(id, next), o = refineOdds(next);
        const base = getItem(id).equip?.bonuses || {};
        const gain = refinedBonuses(base, {}, next), had = refinedBonuses(base, {}, lv);
        const add = (k) => Math.round(((gain[k] || 0) - (had[k] || 0)) * 10) / 10;
        const chips = Object.keys(STAT_LABELS).filter((k) => add(k) > 0).map((k) => `+${add(k)} ${STAT_LABELS[k]}`);
        html += `<div class="ench-head">Next: ${refineTag(next)}</div>`
          + `<div class="gear-stats">Now: ${this._gearStats(id, false, copy)}</div>`
          + `<div class="gear-stats refine-gain">${refineTag(next)} adds ${chips.join(' · ') || 'nothing (no combat stats)'}</div>`
          + `<div class="gear-stats">${pct(o.success)} success` + (o.fail ? ` · ${pct(o.fail)} fail` : '')
          + (o.downgrade ? ` · <span class="short">${pct(o.downgrade)} downgrade</span>` : '')
          + (o.broken ? ` · <span class="short">${pct(o.broken)} break</span>` : '') + '</div>'
          + `<div class="gear-stats">Costs <span class="${have >= c.scrolls ? '' : 'short'}"><b>${c.scrolls} refine scroll${c.scrolls > 1 ? 's' : ''}</b></span> (you have ${formatNumber(have)}). `
          + `${o.downgrade || o.broken ? (wards ? 'A ward will take the blow if it goes badly.' : '<span class="short">No ward: a bad roll will cost you.</span>') : ''}</div>`;
      }
      body.innerHTML = html;
      const hands = this._handPicker(id, copy, (c2) => { copy = c2; last = null; redraw(body, render); });
      if (hands) body.prepend(hands);
      mountRefineRun(this, body, id, copy, () => redraw(body, render));   // "Keep refining until…"
      const box = document.createElement('div');
      box.className = 'ench-choices refine-box';
      if (lv < MAX_REFINE) {
        const c = refineCost(id, lv + 1);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gear-tab active refine-go';
        b.textContent = `Refine to ${refineTag(lv + 1)}`;
        b.disabled = have < c.scrolls;
        b.addEventListener('click', () => {
          last = g.refineItem(id, Math.random(), copy);
          // A broken item may be gone for good: back to the list if no copy is left.
          if (last === 'broken' && !EQUIP_SLOTS.some((s) => g.equipment.get(s) === id) && !g.inventory.count(id)) { this.openMastery(); return; }
          if (!g.equipment.twinWorn(id)) copy = 'main';   // a broken twin leaves one copy, on the main record
          redraw(body, render);
        });
        box.appendChild(b);
      }
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'gear-tab ench-cancel';
      back.textContent = 'Back to all gear';
      back.addEventListener('click', () => this.openMastery(id));
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'gear-tab ench-switch';
      sw.textContent = 'Enchant this piece';
      sw.addEventListener('click', () => this.openEnchant(id, null, copy));
      box.appendChild(sw);
      box.appendChild(back);
      body.appendChild(box);
    };
    this.openModal(`Refine ${getItem(id).name}`, render);
  }

  /** Feed one item type with materials: the ones in your pack that fit it,
   *  the mastery each gives, and 1 / 10 / all buttons. */
  openFeed(id) {
    const g = this.game;
    const name = escapeHtml(getItem(id).name);
    const render = (body) => {
      const pts = g.equipment.masteryXp(id), p = rankProgress(pts);
      const cap = MASTERY_RANKS[FEED_CAP_RANK].name, kind = MATERIAL_KINDS[feedKind(id)] || 'nothing';
      body.innerHTML = `<div class="gear-intro"><p>${name} is <b>${MASTERY_RANKS[p.rank].name}</b> mastery (${masteryProgressText(pts)}). `
        + `It is fed with <b>${kind}</b>; finer materials give more. Materials can take it up to <b>${cap}</b> (${formatNumber(FEED_CAP)} XP); after that, only battle trains it.</p></div>`;
      const list = document.createElement('div');
      list.className = 'gear-list feed-list';
      const opts = g.feedOptions(id);
      if (pts >= FEED_CAP) list.innerHTML = `<div class="modal-hint">Already ${MASTERY_RANKS[p.rank].name}: fight with it to go further.</div>`;
      else if (!opts.length) list.innerHTML = `<div class="modal-hint">You carry no ${kind} to feed it. (Materials in the bank don't count: take some out first.)</div>`;
      else for (const o of opts) {
        const row = document.createElement('div');
        row.className = 'gear-row feed-row';
        row.innerHTML = `<span class="gear-ic">${itemIconSVG(o.id, 28)}</span>`
          + `<div class="gear-info"><div class="gear-name"><b>${escapeHtml(getItem(o.id).name)}</b><span class="gear-tag">x${formatNumber(o.count)}</span></div>`
          + `<div class="gear-stats">+${formatNumber(o.points)} mastery XP each</div></div>`;
        const btns = document.createElement('div');
        btns.className = 'qty-btns';
        for (const [label, n] of [['Offer', 1], ['10', 10], ['All', Infinity]]) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'gear-tab small';
          b.textContent = label;
          b.addEventListener('click', () => { g.feedMastery(id, o.id, n); redraw(body, render); });
          btns.appendChild(b);
        }
        row.appendChild(btns);
        list.appendChild(row);
      }
      body.appendChild(list);
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'gear-tab ench-cancel feed-back';
      back.textContent = 'Back';
      back.addEventListener('click', () => this.openMastery(id));
      body.appendChild(back);
    };
    this.openModal(`Feed ${getItem(id).name}`, render);
  }

  // ---------------- The Offering Shrine ----------------
  // Donate life-skill materials, spare gear (salvageui.js) and any other item
  // (shrineui.js) for shrine points, then spend points on ranks in five
  // permanent offensive blessings (see shrine.js). `itemId`: something from
  // the pack to offer straight away (from its item menu).
  openOfferingShrine(itemId = null) {
    const g = this.game;
    const st = { pending: null, result: null }, stGoods = { pending: null, result: null };   // offers awaiting a second tap
    if (itemId && isSalvageable(itemId)) askOffer(this, st, itemId, 1);
    else if (itemId && goodsKind(itemId)) askGoods(this, stGoods, itemId, 1);
    const render = (body) => {
      const sh = g.shrine;
      body.innerHTML = '<div class="gear-intro"><p>Offer the materials your life skills gather (bars, ore, gems, logs, hides, herbs, fish and feathers), spare gear, or anything else, for '
        + '<b>shrine points</b> (a material gives a tenth of its value; gear and other items less). Spend them on <b>blessings</b>: permanent bonuses to your fighting that never run out. '
        + `Each rank costs a little more than the last.</p><p class="shrine-points">Shrine points: <b>${formatNumber(sh.points)}</b></p></div>`
        + `<div class="modal-hint">${TAP_HINT}</div><div class="modal-hint hotkey-hint">${HOT_HINT}</div>`;
      const tracks = document.createElement('div');
      tracks.className = 'gear-list shrine-tracks';
      for (const t of SHRINE_TRACK_IDS) {
        const T = SHRINE_TRACKS[t], r = sh.rank(t), cost = sh.nextCost(t), ok = sh.points >= cost;
        const row = document.createElement('div');
        row.className = 'gear-row shrine-row';
        row.innerHTML = `<div class="gear-info"><div class="gear-name"><b>${T.name}</b><span class="gear-tag mastery-tag">Rank ${r}</span></div>`
          + `<div class="gear-stats">${r ? `Now ${trackText(t, r)}` : 'Not blessed yet'} &middot; each rank ${escapeHtml(T.label)}</div>`
          + `<div class="mastery-bar"><span style="width:${Math.min(100, Math.round(sh.points / cost * 100))}%"></span></div></div>`;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gear-tab shrine-up' + (ok ? ' active' : '');
        b.innerHTML = `Rank ${r + 1}<br><span class="${ok ? '' : 'short'}">${formatNumber(cost)} pts</span>`;
        b.disabled = !ok;
        b.addEventListener('click', () => { g.shrineRankUp(t); redraw(body, render); });
        // One rank, or every rank the points afford ("Max", shrineui.js).
        const btns = document.createElement('div');
        btns.className = 'shrine-btns';
        btns.appendChild(b);
        btns.appendChild(shrineMaxButton(g, t, () => redraw(body, render)));
        row.appendChild(btns);
        tracks.appendChild(row);
      }
      body.appendChild(tracks);
      body.insertAdjacentHTML('beforeend', '<div class="ench-head shrine-head">Offer materials</div>');
      const list = document.createElement('div');
      list.className = 'gear-list feed-list';
      const opts = g.shrineDonatables();
      if (!opts.length) list.innerHTML = '<div class="modal-hint">You carry no materials to offer. Gather some, or take them out of the bank.</div>';
      for (const o of opts) {
        const row = document.createElement('div');
        row.className = 'gear-row feed-row hot';
        row._hot = (n) => { g.donateToShrine(o.id, n); redraw(body, render); };
        row.innerHTML = `<span class="gear-ic">${itemIconSVG(o.id, 28)}</span>`
          + `<div class="gear-info"><div class="gear-name"><b>${escapeHtml(getItem(o.id).name)}</b><span class="gear-tag">x${formatNumber(o.count)}</span></div>`
          + `<div class="gear-stats">${formatNumber(o.points)} point${o.points > 1 ? 's' : ''} each (${formatNumber(o.points * o.count)} for all)</div></div>`;
        const btns = document.createElement('div');
        btns.className = 'qty-btns';
        for (const [label, n] of [['Offer', 1], ['10', 10], ['All', Infinity]]) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'gear-tab small';
          b.textContent = label;
          b.addEventListener('click', () => { g.donateToShrine(o.id, n); redraw(body, render); });
          btns.appendChild(b);
        }
        row.appendChild(btns);
        list.appendChild(row);
      }
      body.appendChild(list);
      shrineGearSection(this, body, st, () => redraw(body, render), hot);
      shrineGoodsSection(this, body, stGoods, () => redraw(body, render), hot);
    };
    // A hotkey on a gear or goods row, or on an item in the bag (shrinehot.js).
    const hot = (id, n) => { hotOffer(this, st, stGoods, id, n); if (this.modal?.kind === 'shrine') redraw(this.el.modalBody, render); };
    this.openModal('Offering Shrine', render);
    this.modal.kind = 'shrine';
    this.modal._hotItem = hot;
  }

  // ---------------- Gear guide ----------------
  // Every equippable item per slot, ranked best first, with what it needs and
  // whether you already own it — so players can see which equipment is better.
  openGearGuide(slot) {
    const g = this.game;
    // The slot and style tabs you left it on (remembered: windowease.js).
    const mem = this._gearGuide || (this._gearGuide = {});
    slot ||= mem.slot || 'weapon';
    let style = mem.style || g.combatMode?.() || g.equipment.combatType();
    const render = (body) => {
      body.innerHTML = '';
      const intro = document.createElement('div');
      intro.className = 'gear-intro';
      intro.innerHTML = '<p>Each slot is ranked <b>best first</b> for a fighting style (yours, to start): only the stats that style uses count, with weapons counted as damage per swing, so a fast sword can beat a slow axe. <b>★ Best in slot</b> marks the strongest of all, <b>★ Best you can wear now</b> the strongest you have the levels for. Look for the green <span class="gear-up-inline">▲</span> in your pack. It marks gear that beats what you are wearing.</p>'
        + `<details><summary>What do the stats mean?</summary><ul>${STAT_HELP.map(([k, v]) => `<li><b>${k}</b>: ${v}</li>`).join('')}</ul></details>`;
      body.appendChild(intro);
      const tabs = document.createElement('div');
      tabs.className = 'gear-tabs';
      const bySlot = gearBySlot();
      for (const s of EQUIP_SLOTS) {
        if (!bySlot[s].length) continue;
        const b = document.createElement('button');
        b.className = 'gear-tab' + (s === slot ? ' active' : '');
        b.textContent = capitalize(s);
        b.addEventListener('click', () => { slot = mem.slot = s; render(body); });
        tabs.appendChild(b);
      }
      body.appendChild(tabs);
      let ids = bySlot[slot] || [];
      const myCls = CLASS_BY_ID[g.jobClass];
      if (slot === 'weapon' && myCls) {
        // A job class can only wield its own weapon type, so list just those.
        const note = document.createElement('div');
        note.className = 'modal-hint';
        note.innerHTML = `As a <b>${myCls.name}</b> you can wield <b>${WEAPON_TYPE_NAMES[myCls.weapon]}</b> and <b>${WEAPON_TYPE_NAMES[SECONDARY_WEAPON[myCls.id]]}</b>. Other weapons you find are worth selling.`;
        body.appendChild(note);
        ids = ids.filter((id) => { const t = getItem(id).equip?.weaponType; return t && canWield(myCls.id, t) && !sigBarred(myCls.id, id); });
      } else {
        // The style the list is ranked for: weapons only compare fairly within one,
        // and jewellery, capes and the like are worth most to the style they suit.
        const st = document.createElement('div');
        st.className = 'gear-tabs gear-styles';
        for (const k of ['melee', 'ranged', 'magic', 'dance']) {
          const b = document.createElement('button');
          b.className = 'gear-tab small' + (k === style ? ' active' : '');
          b.textContent = k === 'dance' ? 'Dancer' : capitalize(k);
          b.addEventListener('click', () => { style = mem.style = k; render(body); });
          st.appendChild(b);
        }
        body.appendChild(st);
        if (slot === 'weapon') ids = ids.filter((id) => weaponStyle(id) === style);
      }
      // Ranked for the style: a weapon for its own, anything else for the style picked
      // (a Magic ring is worth little to a swordsman). The owner asked to see the best plainly.
      const styleOf = (id) => (slot === 'weapon' ? weaponStyle(id) : style);
      const score = (id) => effectiveRating(id, {}, styleOf(id));
      ids = [...ids].sort((a, b) => score(b) - score(a) || gearRating(b) - gearRating(a));
      const bestNow = ids.find((id) => meetsReq(id, g.skills).ok);
      const list = document.createElement('div');
      list.className = 'gear-list';
      const worn = g.equipment.get(slot);
      ids.forEach((id, i) => {
        const it = getItem(id);
        const req = meetsReq(id, g.skills);
        const reqTxt = Object.entries(it.equip.req || {}).filter(([, l]) => l > 1).map(([k, l]) => `${capitalize(k)} ${l}`).join(', ');
        let tag = '';
        if (id === worn) tag = '<span class="gear-tag worn">Wearing</span>';
        else if (g.inventory.count(id)) tag = '<span class="gear-tag own">In pack</span>';
        else if (g.bank.count(id)) tag = '<span class="gear-tag own">In bank</span>';
        if (!req.ok) tag += `<span class="gear-tag lock">Needs ${req.missing.map((m) => `${capitalize(m.skill)} ${m.lvl}`).join(', ')}</span>`;
        if (i === 0) tag += '<span class="gear-tag best">★ Best in slot</span>';
        else if (id === bestNow) tag += '<span class="gear-tag best now">★ Best you can wear now</span>';
        // Which style a piece is for (jewellery, capes, gloves, boots carry one).
        const st = it.equip.style;
        if (slot !== 'weapon' && st) tag += `<span class="gear-tag style">${st === 'melee' ? 'Melee' : st === 'ranged' ? 'Ranged' : 'Magic'}</span>`;
        else if (slot !== 'weapon' && ['ring', 'amulet'].includes(slot) && !st && (it.equip.bonuses?.attack || it.equip.bonuses?.ranged || it.equip.bonuses?.magic)) tag += '<span class="gear-tag style">All styles</span>';
        const row = document.createElement('div');
        row.className = 'gear-row' + (id === worn ? ' is-worn' : '') + (req.ok ? '' : ' locked');
        row.innerHTML = `<span class="gear-rank">#${i + 1}</span><span class="gear-ic">${itemIconSVG(id, 28)}</span>`
          + `<div class="gear-info"><div class="gear-name"><b>${escapeHtml(it.name)}</b>${tag}</div>`
          + `<div class="gear-stats">${this._gearStats(id, true)}${reqTxt && req.ok ? ` · <i>req ${reqTxt}</i>` : ''}</div></div>`
          + `<span class="gear-score" title="Gear score for this style">${Math.round(score(id))}</span>`;
        list.appendChild(row);
      });
      body.appendChild(list);
      // Start the list at the piece you're wearing, so the next upgrades sit just above it.
      const mine = list.querySelector('.is-worn');
      if (mine) list.scrollTop = Math.max(0, mine.offsetTop - list.offsetTop - list.clientHeight / 2);
    };
    this.openModal('Gear Guide', render);
  }

  // ---------------- Skills ----------------
  renderSkills() {
    const grid = this.el.skillsGrid;
    // Every XP drop asks for this (a few times a second in a fight): while the
    // Skills view is hidden, just note it is out of date and rebuild on opening.
    if (grid?.closest?.('.panel-view')?.classList.contains('hidden')) { this._skillsStale = true; return; }
    this._skillsStale = false;
    grid.innerHTML = '';
    // One labelled row per skill (icon, name, what it's for, level), grouped
    // into Combat / Gathering / Making / Other. The skills come first; the
    // perk and Resources links follow as one row of small chips under them
    // (as big cards on top they pushed the skills below the fold).
    const links = document.createElement('div');
    links.className = 'skill-links';
    const perkBtn = document.createElement('button');
    perkBtn.className = 'perks-open';
    perkBtn.title = 'A new perk every 20 levels in a fighting skill';
    perkBtn.innerHTML = '<b>Passive perks</b>';
    perkBtn.addEventListener('click', () => this.openPerks());
    links.appendChild(perkBtn);
    // Life skill perks: every life skill level adds a little to your fighting.
    const lifeBtn = document.createElement('button');
    lifeBtn.className = 'perks-open life-perks-open';
    lifeBtn.title = 'Every life skill level makes your fighter stronger';
    lifeBtn.innerHTML = '<b>Life skill perks</b>';
    lifeBtn.addEventListener('click', () => this.openLifePerks());
    links.appendChild(lifeBtn);
    // Resources: where every material comes from and what it goes into.
    const resBtn = document.createElement('button');
    resBtn.className = 'perks-open resources-open';
    resBtn.title = 'Where every material comes from, and what it makes';
    resBtn.innerHTML = '<b>Resources</b>';
    resBtn.addEventListener('click', () => this.openSkillGuide(null));
    links.appendChild(resBtn);
    // Study: the Knowledge Codex, with Wisdom level and topic mastery (switched
    // off for now: see LEARNING_ENABLED in config.js).
    if (LEARNING_ENABLED) {
      const L = this.game.learning;
      const codexBtn = document.createElement('button');
      codexBtn.className = 'perks-open codex-open';
      const dailyReady = !L.dailyDone(this.game.todayKey());
      codexBtn.classList.toggle('daily', dailyReady);
      codexBtn.innerHTML = `<b>${inlineIcon(itemIconSVG('arcane_tome', 18))} Knowledge Codex · Wisdom ${L.level}${dailyReady ? ' · ✨ daily revision ready' : ''}</b><span>Study topics to master them: ${L.masteredCount()}/${TOPICS.length} cards collected</span>`;
      codexBtn.addEventListener('click', () => this.openCodex());
      links.appendChild(codexBtn);
    }
    for (const grp of SKILL_GROUPS) {
      const head = document.createElement('div');
      head.className = 'skill-group';
      head.textContent = grp.name;
      grid.appendChild(head);
      const golden = new Set(this.game.goldenSkills?.() || []);
      for (const sk of SKILLS.filter((x) => x.group === grp.id && !x.hidden)) {
        const lvl = this.game.skills.level(sk.id);
        const xp = this.game.skills.xp[sk.id];
        const cell = document.createElement('div');
        cell.className = 'skill-cell';
        cell.innerHTML =
          `<span class="skill-icon">${skillIconSVG(sk.id, 36)}</span>` +
          `<span class="skill-text"><b class="skill-name">${sk.name}</b><span class="skill-desc">${sk.desc || ''}</span>` +
          (PERK_SKILLS.includes(sk.id) ? `<span class="skill-perks">${Math.min(10, Math.floor(lvl / PERK_EVERY))}/10 perks${lvl >= 220 ? ' · ranked up' : ''}</span>` : '') +
          (LIFE_PERKS[sk.id] ? `<span class="skill-perks life">Combat: ${lifePerkText(sk.id, lvl)}</span>` : '') +
          (sk.id === 'slayer' ? `<span class="skill-perks life">On task: +${slayerBuffs(lvl).dmg}% damage, ${slayerBuffs(lvl).loot}% extra loot</span>` : '') +
          // Golden hours (skillhours.js): lit up while this skill's time of day is on.
          (SKILL_HOURS[sk.id] ? `<span class="skill-perks golden${golden.has(sk.id) ? ' on' : ''}">${golden.has(sk.id) ? '✨ Golden hours now: +50% XP' : `Golden hours: ${windowLabel(sk.id)}`}</span>` : '') + `</span>` +
          `<span class="skill-lvl"><span class="cur">${lvl}</span></span>` +
          `<div class="xp-bar" style="width:${Math.round(levelProgress(xp, maxLevelFor(sk.id)) * 100)}%"></div>`;
        const toNext = xpToNext(xp, maxLevelFor(sk.id));
        this._tip(cell, `<b>${sk.name}</b> &mdash; level ${lvl}<br>XP: ${formatNumber(Math.floor(xp))}<br>` +
          (toNext > 0 ? `Next level: ${formatNumber(toNext)} xp` : 'Maxed!') + this._lifePerkTip(sk.id, lvl) + this._slayerTip(sk.id, lvl));
        // Every skill opens a guide: what you can gather, make or unlock, and where.
        if (SKILL_GUIDES[sk.id]) {
          cell.classList.add('has-guide');
          cell.addEventListener('click', () => this.openSkillGuide(sk.id));
        }
        grid.appendChild(cell);
      }
    }
    grid.appendChild(links);
    this.el.skillsTotal.textContent = `Total level: ${this.game.skills.totalLevel()}`;
    this.renderAlignment();
  }

  /** A skill's guide (skillguideui.js): every node or recipe with its level,
   *  XP, inputs and outputs and where to go; for a fighting skill its perks,
   *  gear and training spots. With no skill, the Resources index. */
  openSkillGuide(skill, opts) {
    openGuide(this, skill, opts);
  }

  /** The Knowledge Codex: Wisdom level, subject perks, your title, and a card
   *  per topic (learning objective), each with a Study button. */
  openCodex() {
    const g = this.game, L = g.learning;
    const render = (body) => {
      body.innerHTML = '';
      const lvl = L.level;
      const head = document.createElement('div');
      head.className = 'codex-head';
      head.innerHTML = `<div class="codex-wis"><b>Wisdom ${lvl}</b><span>${formatNumber(Math.floor(L.xp))} xp · ${xpToNext(L.xp) > 0 ? formatNumber(xpToNext(L.xp)) + ' to next level' : 'maxed'}</span>` +
        `<div class="codex-bar"><i style="width:${Math.round(levelProgress(L.xp) * 100)}%"></i></div></div>`;
      const mixed = document.createElement('button');
      mixed.className = 'wm-go'; mixed.textContent = 'Mixed revision';
      // Knowledge Strikes switch: boss specials pause for a question you can answer to interrupt them.
      const ks = document.createElement('button');
      ks.className = 'sg-auto codex-ks' + (g.knowledgeStrikes ? ' on' : '');
      ks.innerHTML = `<span class="ab-switch" aria-hidden="true"><i></i></span><span><b>Knowledge Strikes</b> ${g.knowledgeStrikes ? 'On' : 'Off'}: answer a question to interrupt a boss's special move</span>`;
      ks.addEventListener('click', () => { g.knowledgeStrikes = !g.knowledgeStrikes; render(body); });
      mixed.addEventListener('click', () => this.openStudy({}));
      head.appendChild(mixed);
      body.appendChild(head);
      // Daily revision and mistake bounties.
      const habits = document.createElement('div');
      habits.className = 'codex-habits';
      const done = L.dailyDone(g.todayKey());
      const daily = document.createElement('button');
      daily.className = 'wm-go' + (done ? ' ride' : '');
      daily.innerHTML = done ? `Daily done · ${inlineIcon(skillIconSVG('firemaking', 16))} ${L.daily.streak}-day streak` : `${playIconHTML('ui-daily', 18)} Daily revision (${DAILY_COUNT} questions)${L.daily.streak ? ` · ${inlineIcon(skillIconSVG('firemaking', 16))} ${L.daily.streak}` : ''}`;
      daily.disabled = done;
      daily.addEventListener('click', () => this.openStudy({ queue: L.dailySet(), daily: true }));
      habits.appendChild(daily);
      if (L.mistakes.length) {
        const mb = document.createElement('button');
        mb.className = 'wm-go bounty';
        mb.textContent = `🎯 Mistake bounties (${L.mistakes.length}): double XP`;
        mb.addEventListener('click', () => this.openStudy({ mistakes: true }));
        habits.appendChild(mb);
      }
      const rc = document.createElement('button');
      rc.className = 'wm-go ride';
      rc.innerHTML = `${playIconHTML('ui-report', 18)} Report card`;
      rc.addEventListener('click', () => this.openReport());
      habits.appendChild(rc);
      body.appendChild(habits);
      body.appendChild(ks);
      // Perks earned from each subject, and the title picker.
      const perks = L.perks();
      const perkVal = { econ: `${Math.round(perks.shop * 100)}% better shop prices`, math: `+${Math.round(perks.crit * 100)}% crit chance`, english: `+${Math.round(perks.dmg * 100)}% damage` };
      const pk = document.createElement('div');
      pk.className = 'codex-perks';
      pk.innerHTML = SUBJECTS.map((sb) => `<span style="--sc:${sb.color}" title="${sb.perkDesc}"><b>${sb.perk}</b> ${L.masteredIn(sb.id) ? perkVal[sb.id] : `master ${/^[AEIOU]/.test(sb.name) ? 'an' : 'a'} ${sb.name} topic to unlock`}</span>`).join('');
      body.appendChild(pk);
      const titles = L.titles();
      if (titles.length) {
        const tl = document.createElement('label');
        tl.className = 'codex-title';
        tl.innerHTML = 'Title shown above your name: ';
        const sel = document.createElement('select');
        sel.innerHTML = '<option value="">None</option>' + titles.map((t) => `<option value="${t.id}"${L.title === t.id ? ' selected' : ''}>${t.title}</option>`).join('');
        sel.addEventListener('change', () => { L.title = sel.value || null; g.bus.emit('learning'); });
        tl.appendChild(sel);
        body.appendChild(tl);
      }
      for (const sb of SUBJECTS) {
        const h = document.createElement('div');
        h.className = 'skill-group';
        h.innerHTML = `${sb.name} <small>${L.masteredIn(sb.id)}/${TOPICS.filter((t) => t.subject === sb.id).length} mastered</small>`;
        body.appendChild(h);
        if (sb.id === 'econ') {
          // Learn by doing: run a chicken rice stall for five days.
          const hk = document.createElement('button');
          hk.className = 'perks-open hawker-open';
          hk.innerHTML = `<b>${inlineIcon(skillIconSVG('cooking', 18))} Run a hawker stall</b><span>Set prices for five days of news, see demand and supply at work${L.hawker.best ? ` · best $${L.hawker.best.toFixed(2)}` : ''}</span>`;
          hk.addEventListener('click', () => this.openHawker());
          body.appendChild(hk);
        }
        const grid = document.createElement('div');
        grid.className = 'codex-grid';
        for (const t of TOPICS.filter((x) => x.subject === sb.id)) {
          const done = L.isMastered(t.id), prog = L.progress(t.id), st = L.topics[t.id];
          const card = document.createElement('div');
          card.className = 'codex-card' + (done ? ' mastered' : '');
          card.style.setProperty('--sc', sb.color);
          card.innerHTML = `<div class="cc-icon">${done ? t.icon : '?'}</div><b>${t.name}</b>` +
            (done ? `<span class="cc-title">« ${t.title} »</span>` : `<div class="codex-bar"><i style="width:${Math.round(prog * 100)}%"></i></div>`) +
            `<span class="cc-desc">${t.desc}</span>` +
            `<span class="cc-stat">${st ? `${st.correct} right · ${st.wrong} wrong` : 'Not started'}</span>`;
          const b = document.createElement('button');
          b.className = 'wm-go'; b.textContent = done ? 'Revise' : 'Study';
          b.addEventListener('click', () => this.openStudy({ topic: t.id }));
          card.appendChild(b);
          grid.appendChild(card);
        }
        body.appendChild(grid);
      }
    };
    this.openModal('Knowledge Codex', render);
    this.modal.kind = 'codex';
  }

  /** The learning report card: mastery per learning objective, to copy,
   *  download or print and hand in through the LMS. Teachers can paste a
   *  report back in to check its code. */
  openReport() {
    const g = this.game;
    const rep = buildReport(g.learning, { name: g.player.name });
    const render = (body) => {
      body.innerHTML = '';
      const t = rep.totals;
      const head = document.createElement('div');
      head.className = 'rc-head';
      head.innerHTML = `<b>${escapeHtml(g.player.name)}</b><span>Wisdom ${t.wisdom} · ${t.mastered}/${t.topics} topics mastered · ${t.answered} questions${t.accuracy !== null ? ` · ${t.accuracy}% correct` : ''}</span>` +
        `<span>Daily streak ${t.streak} (best ${t.bestStreak}) · ${t.openMistakes} mistakes to revisit · check code <code>${rep.code}</code></span>`;
      body.appendChild(head);
      const table = document.createElement('table');
      table.className = 'rc-table';
      table.innerHTML = '<thead><tr><th>Learning objective</th><th>Mastery</th><th>Right</th><th>Wrong</th></tr></thead>';
      const tb = document.createElement('tbody');
      for (const sb of SUBJECTS) {
        tb.insertAdjacentHTML('beforeend', `<tr class="rc-sub"><td colspan="4" style="--sc:${sb.color}">${sb.name}</td></tr>`);
        for (const r of rep.rows.filter((x) => x.subject === sb.id)) {
          tb.insertAdjacentHTML('beforeend', `<tr><td>${r.topic}</td><td>${r.mastered ? '<b class="rc-m">Mastered</b>' : `${r.mastery}%`}</td><td>${r.correct}</td><td>${r.wrong}</td></tr>`);
        }
      }
      table.appendChild(tb);
      body.appendChild(table);
      const row = document.createElement('div');
      row.className = 'study-row rc-actions';
      const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'wm-go ' + cls; b.textContent = label; b.addEventListener('click', fn); row.appendChild(b); return b; };
      const copy = btn('Copy', async () => {
        try { await navigator.clipboard.writeText(rep.text); copy.textContent = 'Copied!'; } catch { copy.textContent = 'Copy failed: use Download'; }
      });
      btn('Download', () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([rep.text], { type: 'text/plain' }));
        a.download = `a-worthy-adventure-report-${String(g.player.name).replace(/[^a-z0-9]+/gi, '_')}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      btn('Print / PDF', () => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.title = 'A-Worthy Adventure learning report';
        const pre = w.document.createElement('pre');
        pre.style.cssText = 'font:14px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;padding:24px';
        pre.textContent = rep.text;
        w.document.body.appendChild(pre);
        w.print();
      }, 'ride');
      body.appendChild(row);
      body.insertAdjacentHTML('beforeend', '<div class="modal-hint">Hand this in through your LMS (paste it into an assignment, or upload the downloaded file).</div>');
      // Teacher check: paste a report to see whether it was edited.
      const det = document.createElement('details');
      det.className = 'rc-verify';
      det.innerHTML = '<summary>Teachers: check a report</summary><textarea rows="5" placeholder="Paste a report here"></textarea><div class="rc-result"></div>';
      const ta = det.querySelector('textarea'), out = det.querySelector('.rc-result');
      ta.addEventListener('input', () => {
        const v = ta.value.trim();
        out.textContent = !v ? '' : verifyReport(v) ? '✓ The check code matches: this report has not been edited.' : '✗ The check code does not match: the report was changed or is incomplete.';
        out.className = 'rc-result ' + (v && verifyReport(v) ? 'ok' : 'no');
      });
      body.appendChild(det);
    };
    this.openModal('Learning report card', render);
    this.modal.kind = 'report';
  }

  /** The hawker stall simulation: five days of setting a price and cooking
   *  plates, each day's news shifting demand or cost, with a debrief after each. */
  openHawker() {
    const g = this.game;
    const run = Hawker.newRun();
    let price = 4, cooked = 50, last = null, reward = null;
    const money = (v) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
    // A small demand-curve chart: your price and the best price on today's curve.
    const chart = (res) => {
      const p = Hawker.params(res.event);
      const W = 260, H = 150, qMax = 200, pMax = 12;
      const X = (q) => 30 + (q / qMax) * (W - 40), Y = (pr) => H - 22 - (pr / pMax) * (H - 32);
      const pt = (q, pr, col, label) => `<circle cx="${X(q)}" cy="${Y(pr)}" r="5" fill="${col}" stroke="#22304A" stroke-width="1.5"/>` +
        `<text x="${X(q) + 8}" y="${Y(pr) + 4}" font-size="10" font-weight="800" fill="#22304A">${label}</text>`;
      return `<svg class="hk-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Demand curve for the day">` +
        `<line x1="30" y1="${H - 22}" x2="${W - 8}" y2="${H - 22}" stroke="#22304A"/><line x1="30" y1="8" x2="30" y2="${H - 22}" stroke="#22304A"/>` +
        `<text x="${W - 8}" y="${H - 8}" font-size="9" text-anchor="end" fill="#625d54">plates wanted</text>` +
        `<text x="34" y="14" font-size="9" fill="#625d54">price ($)</text>` +
        `<line x1="${X(0)}" y1="${Y(Math.min(pMax, p.a / p.b))}" x2="${X(Math.min(qMax, p.a))}" y2="${Y(Math.max(0, (p.a - Math.min(qMax, p.a)) / p.b))}" stroke="#e0a03a" stroke-width="3"/>` +
        `<text x="${X(Math.min(qMax, p.a)) - 4}" y="${Y(0) - 6}" font-size="10" font-weight="900" fill="#b07a1a" text-anchor="end">Demand</text>` +
        pt(res.best.wanted, res.best.price, '#5fbf5f', 'best') + pt(res.wanted, res.price, '#e05a3a', 'you') + `</svg>`;
    };
    const render = (body) => {
      body.innerHTML = '';
      const done = run.day >= Hawker.DAYS && !last;
      if (done) {
        const sum = Hawker.summary(run);
        reward ||= g.finishHawker(sum);
        body.innerHTML = `<div class="study-summary"><b>Stall closed for the week!</b>` +
          `<span>Your profit: <b>${money(sum.profit)}</b> · best possible: ${money(sum.best)} (${Math.round(sum.score * 100)}%)</span>` +
          `<span>+${reward.xp} Wisdom xp${reward.coins ? ` · +${reward.coins} coins` : ' · coins are paid on your first week each day'}${reward.record ? ' · new record!' : ''}</span></div>` +
          `<div class="hk-table">${run.results.map((r, i) => `<span>Day ${i + 1}: ${Hawker.EVENT_BY_ID[r.event].news}</span><b class="${r.profit < 0 ? 'neg' : ''}">${money(r.profit)}</b>`).join('')}</div>`;
        const row = document.createElement('div'); row.className = 'study-row';
        const again = document.createElement('button'); again.className = 'wm-go'; again.textContent = 'Play another week';
        again.addEventListener('click', () => this.openHawker());
        const back = document.createElement('button'); back.className = 'wm-go ride'; back.textContent = 'Back to Codex';
        back.addEventListener('click', () => this.openCodex());
        row.append(back, again); body.appendChild(row);
        return;
      }
      if (last) {
        // Debrief: what happened, which curve moved, and the best you could have done.
        const r = last, ev = Hawker.EVENT_BY_ID[r.event];
        body.innerHTML = `<div class="hk-day">Day ${run.day} of ${Hawker.DAYS} · results</div>` +
          `<div class="hk-results"><div class="hk-nums">` +
          `<span>Price</span><b>${money(r.price)}</b><span>Customers wanting a plate</span><b>${r.wanted}</b>` +
          `<span>Plates cooked</span><b>${r.cooked}</b><span>Plates sold</span><b>${r.sold}</b>` +
          (r.unsold ? `<span>Wasted</span><b class="neg">${r.unsold}</b>` : '') + (r.missed ? `<span>Turned away</span><b class="neg">${r.missed}</b>` : '') +
          `<span>Revenue</span><b>${money(r.revenue)}</b><span>Costs (plates + rent)</span><b>${money(r.cost)}</b>` +
          `<span>Profit</span><b class="${r.profit < 0 ? 'neg' : 'pos'}">${money(r.profit)}</b></div>${chart(r)}</div>` +
          `<div class="study-fb ok"><b>The economics:</b> ${ev.why}<div class="study-why">Best today: charge ${money(r.best.price)} and cook ${r.best.cooked} plates for ${money(r.best.profit)} profit.</div></div>`;
        const row = document.createElement('div'); row.className = 'study-row';
        const nx = document.createElement('button'); nx.className = 'wm-go';
        nx.textContent = run.day >= Hawker.DAYS ? 'Close the stall' : 'Next day';
        nx.addEventListener('click', () => { last = null; render(body); });
        row.appendChild(nx); body.appendChild(row);
        return;
      }
      // Plan the day: read the news, then set price and plates.
      const ev = Hawker.EVENT_BY_ID[run.events[run.day]], p = Hawker.params(ev.id);
      body.innerHTML = `<div class="hk-day">Day ${run.day + 1} of ${Hawker.DAYS}</div>` +
        `<div class="hk-news"><b>📰 Today's news</b><span></span></div>` +
        `<div class="hk-facts">Each plate costs <b>${money(p.cost)}</b> to make · stall rent <b>${money(p.rent)}</b> a day · unsold plates are wasted</div>` +
        `<label class="hk-slider">Price per plate <b class="hk-pv">${money(price)}</b><input type="range" min="1" max="12" step="0.1" value="${price}" class="hk-price"></label>` +
        `<label class="hk-slider">Plates to cook <b class="hk-cv">${cooked}</b><input type="range" min="0" max="200" step="1" value="${cooked}" class="hk-cooked"></label>`;
      body.querySelector('.hk-news span').textContent = ev.news;
      const pi = body.querySelector('.hk-price'), ci = body.querySelector('.hk-cooked');
      pi.addEventListener('input', () => { price = Number(pi.value); body.querySelector('.hk-pv').textContent = money(price); });
      ci.addEventListener('input', () => { cooked = Number(ci.value); body.querySelector('.hk-cv').textContent = cooked; });
      const row = document.createElement('div'); row.className = 'study-row';
      const go = document.createElement('button'); go.className = 'wm-go'; go.textContent = 'Open the stall';
      go.addEventListener('click', () => { last = Hawker.playDay(run, price, cooked); render(body); });
      row.appendChild(go); body.appendChild(row);
    };
    this.openModal('Hawker stall: chicken rice', render);
    this.modal.kind = 'hawker';
  }

  /** Knowledge Strike: a boss is winding up its special. A question card drops
   *  in over the fight (the game keeps running) with a countdown bar. */
  showKnowledgeStrike(q, ms, npc) {
    if (typeof document === 'undefined') return;
    let el = this.el.ks;
    if (!el) { el = this.el.ks = document.createElement('div'); el.id = 'ks-card'; document.body.appendChild(el); }
    clearTimeout(this._ksHide);
    const t = TOPIC_BY_ID[q.topic], sb = SUBJECT_BY_ID[t.subject];
    const order = q.answers.map((_, i) => i).sort(() => Math.random() - 0.5);
    el.style.setProperty('--sc', sb.color);
    el.className = 'show';
    el.innerHTML = `<div class="ks-head"><b>⚡ Knowledge Strike!</b><span>${npc.name} is charging · ${t.icon} ${t.name}</span></div>` +
      `<div class="ks-q"></div><div class="ks-answers"></div><div class="ks-timer"><i style="animation-duration:${ms}ms"></i></div>`;
    el.querySelector('.ks-q').textContent = q.q;
    const list = el.querySelector('.ks-answers');
    order.forEach((ai, n) => {
      const b = document.createElement('button');
      b.className = 'study-ans'; b.dataset.ai = ai;
      b.innerHTML = `<i>${'ABCD'[n]}</i><span></span>`;
      b.querySelector('span').textContent = q.answers[ai];
      b.addEventListener('click', () => { if (ai !== 0) b.classList.add('wrong'); this.game.answerKnowledgeStrike(ai === 0); });
      list.appendChild(b);
    });
  }

  hideKnowledgeStrike(correct, q) {
    const el = this.el.ks;
    if (!el) return;
    if (correct === null) { el.className = ''; return; }
    // Show the right answer and the explanation for a moment, then slide away.
    for (const b of el.querySelectorAll('.study-ans')) {
      b.disabled = true;
      if (b.dataset.ai === '0') b.classList.add('right');
    }
    el.querySelector('.ks-timer')?.remove();
    const fb = document.createElement('div');
    fb.className = 'study-fb ' + (correct ? 'ok' : 'no');
    fb.innerHTML = `<b>${correct ? 'Interrupted!' : 'The special lands!'}</b> `;
    fb.appendChild(document.createTextNode(q.why));
    el.appendChild(fb);
    clearTimeout(this._ksHide);
    this._ksHide = setTimeout(() => { el.className = ''; }, correct ? 2200 : 3800);
  }

  /** A study session: one multiple-choice question at a time from a topic (or
   *  mixed), with the explanation after each answer. */
  openStudy(opts) {
    const g = this.game, L = g.learning;
    let q = null, order = null, picked = null, result = null, streak = 0, answered = 0, right = 0, idx = 0, reward = null;
    const next = () => {
      // A fixed set (the daily revision), your open bounties, or a free pick.
      q = opts.queue ? opts.queue[idx++] || null : opts.mistakes ? (L.mistakes.length ? L.pick({ ids: L.mistakes }) : null) : L.pick(opts);
      picked = null; result = null;
      if (!q && opts.daily && !reward) reward = g.finishDaily() || { streak: L.daily.streak, coins: 0 };
      order = q ? q.answers.map((_, i) => i).sort(() => Math.random() - 0.5) : [];
    };
    next();
    const render = (body) => {
      body.innerHTML = '';
      if (!q) {
        // End of a daily set or of the bounty list: a short summary.
        const sum = document.createElement('div');
        sum.className = 'study-summary';
        sum.innerHTML = opts.daily ? `<b>Daily revision done!</b><span>${right}/${answered} right · ${inlineIcon(skillIconSVG('firemaking', 16))} ${reward.streak}-day streak${reward.coins ? ` · +${reward.coins} coins` : ''}</span><span>Come back tomorrow to keep the streak going.</span>`
          : opts.mistakes ? `<b>All mistake bounties cleared!</b><span>${right}/${answered} right this session.</span>`
          : '<b>No questions here yet.</b>';
        body.appendChild(sum);
        const back = document.createElement('button');
        back.className = 'wm-go'; back.textContent = 'Back to Codex';
        back.addEventListener('click', () => this.openCodex());
        body.appendChild(back);
        return;
      }
      const t = TOPIC_BY_ID[q.topic], sb = SUBJECT_BY_ID[t.subject];
      const top = document.createElement('div');
      top.className = 'study-top';
      top.style.setProperty('--sc', sb.color);
      const prog = Math.round(L.progress(t.id) * 100);
      top.innerHTML = `<span class="study-topic">${t.icon} ${sb.name} · ${t.name}</span>` +
        `<span class="study-meta">${opts.queue ? `Question ${idx} of ${opts.queue.length} · ` : ''}${L.isMastered(t.id) ? 'Mastered ✓' : `Mastery ${prog}%`} · ${right}/${answered} this session${streak >= 3 ? ` · 🔥 ${streak} in a row` : ''}</span>`;
      body.appendChild(top);
      const qe = document.createElement('div');
      qe.className = 'study-q'; qe.textContent = q.q;
      body.appendChild(qe);
      const list = document.createElement('div');
      list.className = 'study-answers';
      order.forEach((ai, n) => {
        const b = document.createElement('button');
        b.className = 'study-ans';
        b.innerHTML = `<i>${'ABCD'[n]}</i><span></span>`;
        b.querySelector('span').textContent = q.answers[ai];
        if (picked !== null) {
          b.disabled = true;
          if (ai === 0) b.classList.add('right');
          else if (ai === picked) b.classList.add('wrong');
        } else {
          b.addEventListener('click', () => {
            picked = ai;
            result = g.studyAnswer(q, ai === 0);
            answered++;
            if (ai === 0) { right++; streak++; } else streak = 0;
            render(body);
          });
        }
        list.appendChild(b);
      });
      body.appendChild(list);
      if (result) {
        const fb = document.createElement('div');
        fb.className = 'study-fb ' + (result.correct ? 'ok' : 'no');
        fb.innerHTML = `<b>${result.correct ? (result.bounty ? 'Bounty cleared! 🎯' : 'Correct!') : 'Not quite.'}</b> <span class="study-xp">+${result.xp} Wisdom xp${result.bounty ? ' · +40 coins' : ''}</span>` +
          (!result.correct ? '<div class="study-note">Added to your mistake bounties: get it right later for double XP.</div>' : '') +
          (result.mastered ? `<div class="study-master">${t.icon} Topic mastered! Codex card and title “${t.title}” unlocked.</div>` : '');
        const why = document.createElement('div');
        why.className = 'study-why'; why.textContent = q.why;
        fb.appendChild(why);
        body.appendChild(fb);
        const row = document.createElement('div');
        row.className = 'study-row';
        const nx = document.createElement('button');
        nx.className = 'wm-go'; nx.textContent = 'Next question';
        nx.addEventListener('click', () => { next(); render(body); });
        const back = document.createElement('button');
        back.className = 'wm-go ride'; back.textContent = 'Back to Codex';
        back.addEventListener('click', () => this.openCodex());
        row.append(back, nx);
        body.appendChild(row);
      }
    };
    this.openModal(opts.daily ? 'Daily revision' : opts.mistakes ? 'Mistake bounties' : opts.topic ? `Study: ${TOPIC_BY_ID[opts.topic].name}` : 'Mixed revision', render);
    this.modal.kind = 'study';
  }

  /** Every perk track: what each perk does, its rank, and when the next rank unlocks. */
  openPerks() {
    const g = this.game;
    const NAMES = { attack: 'Melee', strength: 'Melee power', defence: 'Defence', ranged: 'Ranged', magic: 'Magic', agility: 'Agility (Dancer)' };
    let tab = PERK_SKILLS.includes(this._perksTab) ? this._perksTab : PERK_SKILLS.find((s) => g.skills.level(s) >= PERK_EVERY) || 'attack';
    const render = (body) => {
      body.innerHTML = '<div class="modal-hint">Every 20 levels in a fighting skill unlocks that skill\'s next passive perk. After level 200 the perks rank up again (Rank II at 220, III at 420...) until the skill\'s top level (9,999 for Defence, 30,000 for Agility, 99,999 for Melee, Ranged and Magic). Defence perks help in every style.</div>';
      const tabs = document.createElement('div'); tabs.className = 'gear-tabs';
      for (const s of PERK_SKILLS) {
        const b = document.createElement('button');
        b.className = 'gear-tab' + (s === tab ? ' active' : '');
        b.textContent = `${NAMES[s].split(' ')[0]} ${g.skills.level(s)}`;
        b.addEventListener('click', () => { tab = this._perksTab = s; render(body); });
        tabs.appendChild(b);
      }
      body.appendChild(tabs);
      const lvl = g.skills.level(tab);
      const list = document.createElement('div'); list.className = 'perk-list';
      for (const p of trackPerks(tab, lvl)) {
        // The next level at which this perk unlocks or ranks up.
        const next = (p.index + 1 + p.rank * 10) * PERK_EVERY;
        const row = document.createElement('div');
        row.className = 'perk-row' + (p.rank ? ' owned' : '');
        row.innerHTML = `<span class="perk-rank">${p.rank ? rankName(p.rank) : '–'}</span>`
          + `<span class="perk-text"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.desc)}${p.rank > 1 ? ` (x${p.rank})` : ''}</span></span>`
          + `<span class="perk-next">${next <= maxLevelFor(tab) ? `${p.rank ? 'Rank up' : 'Unlocks'} at ${next}` : 'Max rank'}</span>`;
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('Passive Perks', render);
    this.modal.kind = 'perks';
  }

  /** A life skill's combat perk for its tooltip: now, and at the next milestone. */
  _lifePerkTip(skill, lvl) {
    if (!LIFE_PERKS[skill]) return '';
    const next = lifePerkNext(skill, lvl);
    return `<br>Combat perk: <b>${lifePerkText(skill, lvl)}</b>` +
      (next ? `<br>At level ${next.level}: ${next.text}` : '<br>Full strength') + unlockTipText(skill, lvl);
  }

  /** Slayer's tooltip: the on-task bonuses now and at full strength, and the next unlock. */
  _slayerTip(skill, lvl) {
    if (skill !== 'slayer') return '';
    const b = slayerBuffs(lvl), full = slayerBuffs(SLAYER_FULL_LEVEL), next = nextSlayerUnlock(lvl);
    return `<br>Against your Slayer task: <b>+${b.dmg}% damage</b>, <b>${b.loot}% chance of extra loot</b>` +
      `<br>At level ${SLAYER_FULL_LEVEL}: +${full.dmg}% damage, ${full.loot}% extra loot` +
      `<br>Slayer helmet worn: +${SLAYER_HELM_DMG}% more on-task damage` +
      (next ? `<br>Level ${next.level} unlocks: ${escapeHtml(next.names.slice(0, 3).join(', '))}${next.names.length > 3 ? '…' : ''}` : '');
  }

  /** Every life skill's combat perk: what it gives now and at full strength. */
  openLifePerks() {
    const g = this.game;
    const render = (body) => {
      body.innerHTML = `<div class="modal-hint">Each life skill adds one combat stat that grows with every level to level ${LIFE_PERK_FULL_LEVEL}, then half as fast to level ${LIFE_PERK_MAX_LEVEL}, then slowly on to its full strength at level ${formatNumber(LIFE_PERK_TOP_LEVEL)}. They work in every style and stack on top of your gear (they are counted in the Equipment panel's totals).</div>`;
      const list = document.createElement('div'); list.className = 'perk-list';
      for (const s of LIFE_PERK_SKILLS) {
        const lvl = g.skills.level(s), next = lifePerkNext(s, lvl);
        const row = document.createElement('div');
        row.className = 'perk-row' + (lvl > 1 ? ' owned' : '');
        row.innerHTML = `<span class="perk-rank">${lvl}</span>`
          + `<span class="perk-text"><b>${escapeHtml(SKILLS.find((x) => x.id === s).name)}: ${escapeHtml(lifePerkText(s, lvl))}</b>`
          + `<span>At level ${LIFE_PERK_FULL_LEVEL}: ${escapeHtml(lifePerkText(s, LIFE_PERK_FULL_LEVEL))} · at ${LIFE_PERK_MAX_LEVEL}: ${escapeHtml(lifePerkText(s, LIFE_PERK_MAX_LEVEL))} · full, at ${formatNumber(LIFE_PERK_TOP_LEVEL)}: ${escapeHtml(lifePerkText(s, LIFE_PERK_TOP_LEVEL))}</span></span>`
          + `<span class="perk-next">${next ? `${escapeHtml(next.text.split(' ')[0])} at ${next.level}` : 'Full'}</span>`;
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('Life Skill Perks', render);
    this.modal.kind = 'lifeperks';
  }

  // ---------------- Good / evil alignment ----------------
  renderAlignment() {
    const el = this.el.alignment || (this.el.alignment = document.getElementById('alignment-readout'));
    if (!el) return;
    // It sits under the Skills list: out of sight it waits (Culling's Stewardship
    // line moved it a few times a second in a fight) and catches up when shown.
    if (this._alignDrawn && this._panelHidden(el)) { this._alignStale = true; return; }
    this._alignDrawn = true;
    this._alignStale = false;
    const g = this.game;
    const { title, cls } = g.alignmentTitle();
    const good = g.karma.good, evil = g.karma.evil, total = good + evil || 1;
    const goodPct = Math.round((good / total) * 100);
    el.className = `align-${cls}`;
    el.innerHTML =
      `<div class="align-head">Alignment: <b>${title}</b> <span class="align-net">(${g.alignment() >= 0 ? '+' : ''}${g.alignment()})</span></div>` +
      `<div class="align-bar"><span class="align-good" style="width:${goodPct}%"></span></div>` +
      `<div class="align-legend"><span class="ag-good">Good ${good}</span><span class="ag-evil">Evil ${evil}</span></div>` +
      `<div class="align-combat">${this._karmaCombatText(g.karmaCombat())}</div>` + stewardLineHTML(g) +
      `<div class="align-hint">Make choices around the island to shape your path (${Object.keys(g.moral?.choices || {}).length}/${MORAL_EVENTS.length} met).</div>`;
  }

  /** One line on what your alignment does in a fight. */
  _karmaCombatText(kc) {
    if (kc.side === 'holy') return `Holy path: +${Math.round(kc.holyDmg * 100)}% damage to Undead, Spirits and Demons; each kill heals ${Math.round(kc.killHeal * 100)}% of your life.`;
    if (kc.side === 'dark') return `Dark path: +${kc.critDmg}% crit damage and +${kc.lifesteal}% lifesteal against everything.`;
    return 'Neutral: lean good (Holy path) or evil (Dark path) for a combat bonus.';
  }

  // ---------------- Combat panel ----------------
  _buildCombatPanel() {
    this.el.combat.innerHTML = `<div class="style-row"></div><div class="cb-level"></div>
      <label class="auto-retal"><input type="checkbox" id="auto-retal-cb"> Auto retaliate</label>`;
    this._styleRow = this.el.combat.querySelector('.style-row');
    const cb = this.el.combat.querySelector('#auto-retal-cb');
    cb.addEventListener('change', () => { this.game.player.autoRetaliate = cb.checked; });
  }

  // Combat panel adapts to the wielded weapon: melee styles, ranged styles, or spellbook.
  /** Strength / Intelligence / Dexterity: spend stat points (see attributes.js).
   *  The box is built once and its buttons kept: a spend only rewrites the
   *  numbers in place (via the 'stats' event), so taps land instantly and a
   *  button is never swapped out from under the finger pressing it. */
  _renderStats(after, mode) {
    const g = this.game;
    let box = this.el.combat.querySelector('.cb-stats');
    if (!box) {
      box = document.createElement('div'); box.className = 'cb-stats'; after.insertAdjacentElement('afterend', box);
      box.innerHTML = `<div class="st-head"><b>Stats</b><span class="st-free"></span>`
        + `<button type="button" class="st-all">Spend all &rarr; <span></span></button></div>`
        + ATTRS.map((k) => `<div class="st-row" data-k="${k}"><span class="st-name">${ATTR_NAMES[k]} <b class="st-val"></b></span>`
          + `<span class="st-btns"><button type="button" class="st-add" data-n="1" aria-label="Add 1 point to ${ATTR_NAMES[k]}">+1</button>`
          + `<button type="button" class="st-add" data-n="10" aria-label="Add 10 points to ${ATTR_NAMES[k]}">+10</button></span>`
          + `<span class="st-eff"></span></div>`).join('')
        + `<div class="st-foot">Points come as your fighting skill grows (up to ${MAX_STAT_POINTS}). Hold + to keep adding.`
        + ` <button type="button" class="st-reset"></button></div>`;
      const rows = {};
      for (const k of ATTRS) {
        const row = box.querySelector(`.st-row[data-k="${k}"]`);
        rows[k] = { row, val: row.querySelector('.st-val'), eff: row.querySelector('.st-eff') };
        // Only spend while points remain, so a held button stops quietly
        // instead of printing "no stat points" every repeat.
        row.querySelectorAll('.st-add').forEach((b) => this._holdToRepeat(b, () => g.unspentPoints() > 0 && g.addStat(k, +b.dataset.n) && g.unspentPoints() > 0));
      }
      const all = box.querySelector('.st-all');
      all.addEventListener('click', () => g.spendAllStats());
      box.querySelector('.st-reset').addEventListener('click', () => g.resetStats());
      this._stats = { box, rows, free: box.querySelector('.st-free'), all, allName: all.querySelector('span'),
        adds: [...box.querySelectorAll('.st-add')], reset: box.querySelector('.st-reset') };
    }
    this._updateStats(mode);
  }

  /** Rewrite the stats box's numbers and button states in place (cheap: no rebuild). */
  _updateStats(mode = this.game.combatMode()) {
    const s = this._stats;
    if (!s) return;
    const g = this.game, set = (el, t) => { if (el.textContent !== t) el.textContent = t; };
    const free = g.unspentPoints(), sum = attrSummary(g.attrs), main = attrForMode(mode), spent = g.spentPoints();
    set(s.free, free ? `${free} point${free > 1 ? 's' : ''} to spend` : `${g.statPoints()}/${MAX_STAT_POINTS} points`);
    s.free.classList.toggle('has', free > 0);
    for (const k of ATTRS) {
      const r = s.rows[k];
      r.row.classList.toggle('main', k === main);
      set(r.val, String(g.attrs[k])); set(r.eff, sum[k]);
    }
    for (const b of s.adds) b.disabled = !free;
    s.all.hidden = !free;
    set(s.allName, ATTR_NAMES[main]);
    s.reset.hidden = !spent;
    set(s.reset, `Reset (${spent * RESET_COST_PER_POINT} coins)`);
  }

  /** Spend with `fire` on a press, then keep firing while it is held, faster
   *  and faster (holdRepeatDelay). `fire` returns false to stop.
   *  - Mouse / pen: fires the moment the button goes down (no click delay).
   *  - Touch: a tap fires when the finger lifts, and a hold starts repeating
   *    after the first repeat delay. Nothing is spent until then, so a swipe
   *    that starts on a button scrolls the panel (touch-action: pan-y) and
   *    costs nothing: moving more than a few pixels, or the browser taking
   *    the gesture (pointercancel), drops the press.
   *  A press ends when it is released anywhere, slides off the button, or the
   *  window loses focus or is hidden, so a missed release can't keep spending.
   *  Enter / Space add one each, as for any button. */
  _holdToRepeat(btn, fire) {
    let timer = 0, n = 0, press = null, lastPress = -1e9;
    const end = () => { clearTimeout(timer); timer = 0; if (press) { press = null; lastPress = performance.now(); } };
    // Repeat only while the press is live and the button is still on screen and usable.
    const live = () => press && !btn.disabled && btn.isConnected && btn.offsetParent !== null;
    const step = () => { timer = 0; if (!live()) return end(); press.spent = true; if (fire()) timer = setTimeout(step, holdRepeatDelay(n++)); };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || btn.disabled) return;
      end(); n = 0;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', spent: false };
      if (press.touch) {
        // A touch is captured by the button it starts on, so without this the
        // finger could slide away and never leave it. Off-button moves are
        // caught below.
        if (btn.hasPointerCapture?.(e.pointerId)) btn.releasePointerCapture(e.pointerId);
        timer = setTimeout(step, holdRepeatDelay(n++));
      } else {
        e.preventDefault();        // no text selection or focus-scroll on a long press
        step();
      }
    });
    btn.addEventListener('pointerleave', (e) => { if (press && e.pointerId === press.id) end(); });
    // Window-level, capture phase: these see the press wherever the pointer goes.
    const mine = (e) => press && e.pointerId === press.id;
    window.addEventListener('pointermove', (e) => {
      if (!mine(e)) return;
      const r = btn.getBoundingClientRect();
      const off = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      // A touch that wanders before its first spend is a scroll or a swipe, not a tap.
      if (off || (press.touch && !press.spent && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8)) end();
    }, { capture: true, passive: true });
    window.addEventListener('pointerup', (e) => {
      if (!mine(e)) return;
      const tap = press.touch && !press.spent && btn.contains(e.target);
      end();
      if (tap && !btn.disabled) fire();
    }, true);
    window.addEventListener('pointercancel', (e) => { if (mine(e)) end(); }, true);
    window.addEventListener('blur', end);
    document.addEventListener('visibilitychange', () => { if (document.hidden) end(); });
    // Enter / Space add one here (a held key repeats), and are kept from the
    // game's Space shortcut, which would otherwise talk to a nearby NPC.
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); e.stopPropagation();
      fire();
    });
    // The click that follows a press is already counted; only a click with no
    // press just before it (a screen reader's, say) adds a point here.
    btn.addEventListener('click', () => { if (!press && performance.now() - lastPress > 500) fire(); });
  }

  renderCombatPanel() {
    if (!this._styleRow) return;
    // Out of sight it waits too (gear and levels change all fight long).
    if (this._combatDrawn && this._panelHidden(this._styleRow)) { this._combatStale = true; return; }
    this._combatDrawn = true;
    this._combatStale = false;
    const mode = this.game.combatMode();
    const p = this.game.player;
    const row = this._styleRow;
    this._renderRaceHint(row);
    row.innerHTML = '';
    row.classList.toggle('spells', mode === 'magic');
    if (mode === 'magic') {
      for (const sp of spellsFor(this.game.jobClass)) {   // a Priest or a Zealot sees only its own
        const known = this.game.skills.magic >= sp.level;
        const btn = document.createElement('div');
        btn.className = 'style-btn spell' + (classSpell(this.game.jobClass, p.spell) === sp ? ' active' : '');
        const cost = Object.entries(sp.runes).map(([id, q]) => `${q}${id.replace('_rune', '').slice(0, 3)}`).join(' ');
        btn.innerHTML = `<span class="sp-ic">${spellIconHTML(sp.id, 26)}</span><span class="sp-text">${sp.name}<span class="style-skill">L${sp.level} · max ${playerMagicVsNpc(this.game.skills, this.game.equipment, sp, { defence: 1 }).max} · ${ELEMENTS[sp.element].icon} area · ${escapeHtml(cost)}<br>${escapeHtml(ELEMENTS[sp.element].effect)}</span></span>`;
        btn.style.opacity = known ? (this.game._hasRunes(sp) ? '1' : '0.65') : '0.35';
        if (known) btn.addEventListener('click', () => { p.spell = sp.id; p.spellAuto = false; this.renderCombatPanel(); });
        if (p.spellAuto) btn.classList.remove('active');
        row.appendChild(btn);
      }
      // Auto: auto battle chooses the element that suits each target.
      const auto = document.createElement('div');
      auto.className = 'style-btn spell spell-auto' + (p.spellAuto ? ' active' : '');
      auto.innerHTML = `<span class="sp-ic">${skillIconSVG('magic', 28)}</span><span class="sp-text">Auto element<span class="style-skill">Auto battle picks the best element for each monster${p.spellAuto ? ` (now: ${escapeHtml(classSpell(this.game.jobClass, p.spell).name)})` : ''}</span></span>`;
      auto.addEventListener('click', () => { p.spellAuto = true; this.renderCombatPanel(); });
      row.appendChild(auto);
    } else {
      // No stances to pick: say what every hit trains.
      const skill = mode === 'ranged' ? 'Ranged' : mode === 'dance' ? 'Agility' : 'Melee';
      const note = document.createElement('div');
      note.className = 'style-note';
      note.textContent = `Every hit trains ${skill}, Defence and Hitpoints.`;
      row.appendChild(note);
    }
    const modeLabel = mode === 'ranged' ? 'Ranged' : mode === 'magic' ? 'Magic' : mode === 'dance' ? `Dancer &middot; Rhythm ${this.game.danceRhythm}/${RHYTHM_MAX}`
      : this.game.jobClass === 'monk' ? `Monk &middot; Chi ${chiStacks(this.game)}/${CHI.max}` : 'Melee';
    const cls = CLASS_BY_ID[this.game.jobClass];
    const clsLabel = cls ? `<div class="cb-class">Class: <b>${cls.name}</b> &middot; ${WEAPON_TYPE_NAMES[cls.weapon]} <button class="cb-perks" type="button">Skills &amp; perks</button></div>`
      + `<div class="cb-perkline">${classPerkSummary(cls.id)}</div>` : '';
    const lvlEl = this.el.combat.querySelector('.cb-level');
    lvlEl.innerHTML = `${clsLabel}Combat level: ${this.game.skills.combatLevel()} <span style="opacity:.7">&middot; ${modeLabel}</span>`;
    lvlEl.querySelector('.cb-perks')?.addEventListener('click', () => this.openClassPerks());
    this._renderStats(lvlEl, mode);
    // Merchant: hire mercenaries for coins.
    if (cls?.id === 'merchant') {
      const n = Mercs.activeMercs(this.game).length;
      const hire = document.createElement('button');
      hire.type = 'button';
      hire.className = 'wm-go merc-hire';
      const f = Mercs.activeFollowers(this.game).length;
      hire.textContent = `Hire mercenary (${Mercs.hireCost(this.game)} coins) · ${n}/${Mercs.MAX_MERCS} on contract${f ? ` · ${f} A-Worthling${f > 1 ? 's' : ''}` : ''}`;
      hire.addEventListener('click', () => { this.game.hireMercenary(); this.renderCombatPanel(); });
      lvlEl.prepend(hire);
    }
    const cb = this.el.combat.querySelector('#auto-retal-cb');
    if (cb) cb.checked = p.autoRetaliate;
  }

  /** Your class's perks in full: its signature, weapon speed, reach, cleave,
   *  dual wielding, crit, strong and weak matchups and passive perk tracks. */
  openClassPerks(classId = this.game.jobClass) {
    const cls = CLASS_BY_ID[classId];
    if (!cls) return;
    this.openModal(`${cls.name}: skills and perks`, (body) => {
      const art = heroArtSrc(cls.id);
      body.innerHTML = `<div class="sg-head"><span class="class-pic">${art ? `<img src="${art}" alt="" width="48" height="48">` : itemIconSVG(starterWeapon(cls.id), 40)}</span>`
        + `<div><b>${cls.name} · ${WEAPON_TYPE_NAMES[cls.weapon]}</b><span>${cls.desc}</span></div></div>`
        + this._skillsSection(cls)
        + `<div class="cp-head"><b>Perks</b></div><div class="cp-list">${classPerks(cls.id).map((p) => `<div class="cp-row"><span class="cp-ic">${p.icon}</span><span><b>${p.label}</b> ${p.text}</span></div>`).join('')}</div>`
        // Class passives: one every 100 levels of the class's fighting skill.
        + (() => {
          const skill = CLASS_SKILL[cls.style] || 'attack';
          const lvl = classId === this.game.jobClass ? this.game.skills.level(skill) : 0;
          const skName = { attack: 'Melee', ranged: 'Ranged', magic: 'Magic', agility: 'Agility', dance: 'Dance' }[skill];
          return `<div class="cp-head"><b>Class passives</b> · one every 100 ${skName} levels${lvl ? ` (you: ${lvl})` : ''}</div><div class="cp-list">`
            + classPassives(cls.id, lvl).map((p) => `<div class="cp-row${p.rank ? '' : ' locked'}"><span class="cp-ic">${p.rank ? tabIconSVG('achievements', 20) : '🔒'}</span><span><b>${escapeHtml(p.name)}${p.rank > 1 ? ` (Rank ${p.rank})` : ''}</b> ${escapeHtml(p.desc)} · <i>${skName} ${p.unlockAt}${p.rank ? '' : ' to unlock'}, ranks up every 300 levels after</i></span></div>`).join('')
            + '</div>';
        })()
        + '<div class="modal-hint">Every class can use any armour, tools and the learning perks in the Knowledge Codex.</div>';
    });
    this.modal.kind = 'classperks';
  }

  /** How many logs go on this fire (the owner's ask): a few choices and All.
   *  `logId` null burns your best logs first and moves on to the next kind. */
  askFireLogs(logId = null) {
    const g = this.game;
    const have = logId ? g.inventory.count(logId) : g.burnableLogs().reduce((n, id) => n + g.inventory.count(id), 0);
    if (have <= 1) { g.startFiremaking(logId); return; }
    const name = logId ? getItem(logId).name.toLowerCase() : 'logs';
    this.openModal('Light a fire', (body) => {
      body.innerHTML = `<div class="modal-hint">How many ${escapeHtml(name)} go on this fire? You have ${formatNumber(have)}. More logs make a bigger fire that burns longer and warms you more, from further away.</div>`;
      const row = document.createElement('div');
      row.className = 'dialogue-options';
      for (const n of [...new Set([1, 5, 10, 25].filter((k) => k < have)), have]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dialogue-option';
        b.textContent = n === have ? `All ${formatNumber(have)}` : String(n);
        b.addEventListener('click', () => { this.closeModal(); g.startFiremaking(logId, n); });
        row.appendChild(b);
      }
      body.appendChild(row);
    });
  }

  /** The class's five skills (Z X C V B) in full: the owner found them only on
   *  the action bar's hover, which phones never show. Yours follow the weapon in
   *  your hand, as the bar does; another class's show its own weapon's set. */
  _skillsSection(cls) {
    const g = this.game, own = cls.id === g.jobClass;
    const set = own ? g.currentAbilities() : abilitiesFor(cls.style, cls.id);
    const rows = set.map((ab) => {
      const cost = own ? g.abilityCostText(ab) : ab.cost ? `${ab.cost}% adrenaline` : ab.build ? `free, builds ${ab.build}% adrenaline` : 'free';
      const locked = own && !g.abilityUnlocked(ab);
      const bits = [cost, `${+(ab.cd * TICK_MS / 1000).toFixed(1)}s cooldown`, ...(ab.unlock > 1 ? [`from combat level ${ab.unlock}`] : [])];
      return `<div class="cp-row sk-row${locked ? ' locked' : ''}"><span class="cp-ic">${abilityIconHTML(ab.id, 28)}</span>`
        + `<span><b><kbd>${ab.key}</kbd> ${escapeHtml(ab.name)}</b> <i class="sk-meta">${escapeHtml(bits.join(' · '))}</i><br>${escapeHtml(ab.desc)}</span></div>`;
    }).join('');
    return `<div class="cp-head"><b>Skills</b> · ${own ? 'for the weapon in your hand' : `with ${aOrAn(WEAPON_TYPE_NAMES[cls.weapon].toLowerCase())}`}</div><div class="cp-list">${rows}</div>`;
  }

  /** A skill button's hover card: name, key, cost, cooldown and what it does. */
  _skillTipHTML(ab) {
    const g = this.game, cd = g.abilityCd[ab.id] || 0;
    const state = !g.abilityUnlocked(ab) ? `🔒 Unlocks at combat level ${ab.unlock}`
      : cd > 0 ? `Ready in ${+(cd * TICK_MS / 1000).toFixed(1)}s` : g.lifeCostBlocked(ab) ? 'Too hurt to pay for it in life' : !g.canAffordAbility(ab) ? 'Not enough adrenaline yet' : 'Ready';
    return `<b>${escapeHtml(ab.name)}</b> (${ab.key})<br><span style="opacity:.8">${escapeHtml(g.abilityCostText(ab))} · ${+(ab.cd * TICK_MS / 1000).toFixed(1)}s cooldown</span><br>${escapeHtml(ab.desc)}<br><i>${state}</i>`;
  }

  // ---------------- First-time tips ----------------
  // One small, dismissible tip at a time, each shown once per save (ui/tips.js),
  // as a slim card in the notification lane (noticelane.js) with a close button
  // and "Don't show tips" (the same switch as Settings > Tips).
  _tipsTick() {
    const g = this.game;
    if (this.lane?.has('tip')) return;
    if (this.modal || g.pendingStyleChoice || g.pendingClassChoice || !g.player.alive) return;
    if (g.tipsFromDevice) {
      // A save from before tips were saved: carry over what this device had
      // already dismissed, once, so a returning player isn't shown them again.
      g.tipsFromDevice = false;
      try { for (const id of JSON.parse(localStorage.getItem(TIPS_KEY) || '[]')) if (TIPS[id]) tipsSeen(g).add(id); } catch { /* ignore */ }
    }
    const id = nextTip(g);
    if (id) this.showTip(id);
  }

  showTip(id) {
    markTipSeen(this.game, id);   // seen as soon as it shows: a reload can't repeat it
    const lane = (this.lane ||= new NoticeLane(this));
    lane.dismissKind('tip');
    // The boss marker tip is urgent; the others wait their turn. Each puts
    // itself away after TIP_MS (tips.js), so none sits over the play area.
    lane.push({ kind: 'tip', key: `tip:${id}`, html: TIPS[id], ttl: TIP_MS, priority: id === 'dodge' ? 2 : 0 });
  }

  /** "Don't show tips" on a tip card: the Settings switch, turned off. */
  tipsOff() {
    this.game.tipsOn = false;
    this.game.saveSoon = true;
    this.lane?.dismissKind('tip');
    this._tipsBtn?.refresh?.();
    this.game.msg('Tips are off. Settings > Tips turns them back on.', 'system');
  }

  // ---------------- Minimal HUD ----------------
  // With the setting on, the side panel, chat log, objectives and labels tuck
  // away while you're exploring (out of combat, nothing open), leaving the
  // orbs, minimap, adrenaline and action buttons. Hovering or tapping where a
  // panel was brings everything back for a few seconds (see .hud-min in main.css).
  _initMinimalHud() {
    const peek = () => { this._hudPeekUntil = this._now() + 8000; this._minimalHudTick(); };
    for (const id of ['sidepanel', 'chatbox']) {
      const el = document.getElementById(id);
      el?.addEventListener('pointerdown', peek, true);
      el?.addEventListener('click', peek, true);   // the number keys "click" the tabs
    }
    this.bus.on('tick', () => this._minimalHudTick());
  }

  _now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  _minimalHudTick() {
    const root = this._hudRoot || (this._hudRoot = document.getElementById('game-root'));
    if (!root) return;
    const g = this.game;
    const on = !!g.minimalHud && g.player.alive && !g.cine?.inFight && !this.modal && this._now() > (this._hudPeekUntil || 0);
    root.classList.toggle('hud-min', on);
  }

  // ---------------- Settings ----------------
  // Grouped cards (Account, Sound, Display, Gameplay, Help) of label + switch
  // rows, the same switch as Auto battle (.ab-switch). A row's title still
  // reads "Sound: On", the words the old pill buttons showed.
  _buildSettingsPanel() {
    const p = this.el.settings;
    p.innerHTML = '';
    let group = p;
    // A card of settings under a small heading; what follows goes in it.
    const sec = (label) => {
      group = p.appendChild(document.createElement('div'));
      group.className = 'set-group';
      const h = group.appendChild(document.createElement('div'));
      h.className = 'set-section';
      h.textContent = label;
      return group;
    };
    const mk = (label, fn, danger) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = danger ? 'set-act danger' : 'set-act';
      b.addEventListener('click', fn);
      group.appendChild(b);
      return b;
    };
    // A label + switch row. `isOn` reads the setting, `flip` changes it; the
    // row redraws itself after (and on `.refresh()`, for changes made elsewhere).
    const row = (label, isOn, flip) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'set-row';
      b.setAttribute('role', 'switch');
      b.innerHTML = '<span class="set-lbl"></span><span class="ab-switch" aria-hidden="true"><i></i></span>';
      b.querySelector('.set-lbl').textContent = label;
      b.refresh = () => {
        const on = !!isOn();
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.title = `${label}: ${on ? 'On' : 'Off'}`;
      };
      b.addEventListener('click', () => { flip(); b.refresh(); });
      b.refresh();
      group.appendChild(b);
      return b;
    };
    // A row with a few choices (World labels: Smart / All / Off): its value on a chip, a tap moves to the next.
    const cycle = (label, value, next) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'set-row set-cycle';
      b.innerHTML = '<span class="set-lbl"></span><span class="set-val"></span>';
      b.querySelector('.set-lbl').textContent = label;
      const show = () => { const v = value(); b.querySelector('.set-val').textContent = v; b.title = `${label}: ${v}`; };
      b.addEventListener('click', () => { next(); show(); });
      show();
      group.appendChild(b);
      return b;
    };
    const au = () => this.game.audio;

    // ---- Account: who you are, and your save ----
    const account = sec('Account');
    account.classList.add('set-pairs');   // its actions two to a row
    // Account and cloud save (accountui.js fills this in; its own heading is
    // hidden here, under this card's).
    const acct = account.appendChild(document.createElement('div'));
    import('./accountui.js').then((m) => m.accountSettings(acct)).catch(() => {});
    mk('Save game now', () => { import('../game/save.js').then((m) => {
      const saved = m.saveGame(this.game);
      if (saved) this.game.msg('Game saved.', 'system');
      else if (saved === null) this.game.msg('Saving is paused: reload the page to carry on.', 'system');
      else this.game.msg('Could not save: this browser\'s storage is full or blocked. Your progress is not being kept.', 'system');
    }); }).classList.add('set-wide');
    // Install as an app: the browser's own install dialog where it offers one,
    // or the Add to Home Screen steps on iPhone and iPad.
    import('../pwa.js').then((pwa) => {
      if (pwa.isInstalled() || p.querySelector('.install-app')) return;   // the panel can be rebuilt before this resolves
      const btn = document.createElement('button');
      btn.className = 'set-act set-wide install-app';
      const show = () => { btn.hidden = !pwa.canInstall() && !pwa.isIos(); btn.textContent = 'Install as an app'; };
      btn.addEventListener('click', async () => {
        if (pwa.canInstall()) { if (await pwa.promptInstall()) this.game.msg('A-Worthy Adventure is installed: open it from your home screen or app list.', 'level'); }
        else this.game.msg('To install on iPhone or iPad: tap the Share button in Safari, then "Add to Home Screen".', 'system');
        show();
      });
      pwa.onInstallChange(show);
      show();
      account.insertBefore(btn, acct.nextSibling);
    }).catch(() => {});
    // Carry a character to another browser, device or web address (saves live
    // in one site's storage, so they don't follow the player on their own).
    mk('Export save', () => this.openExportSave());
    mk('Import save', () => this.openImportSave());
    mk('Delete save & restart', () => {
      if (confirm('Delete your saved character and start over?')) { suppressSaves(); clearSave(); location.reload(); }
    }, true);

    // ---- Sound: the three switches, then the three volume sliders together ----
    sec('Sound');
    row('Sound', () => !(au() && au().muted), () => { const a = au(); if (a) { a.unlock(); a.toggle(); } });
    row('Music', () => !!au()?.musicOn, () => { const a = au(); if (a) { a.unlock(); a.toggleMusic(); } });
    row('Ambience', () => au()?.ambienceOn !== false, () => { const a = au(); if (a) { a.unlock(); a.toggleAmbience(); } });
    // Volume sliders: everything, then the sound effects and the music on their own.
    const slider = (label, level, set, sample) => {
      const vol = document.createElement('label');
      vol.className = 'set-slider';
      const pct = Math.round((level ?? 1) * 100);
      vol.innerHTML = `<span>${label} <b>${pct}%</b></span><input type="range" min="0" max="100" step="5" value="${pct}">`;
      vol.querySelector('input').addEventListener('input', (e) => {
        const v = Number(e.target.value);
        vol.querySelector('b').textContent = `${v}%`;
        const a = this.game.audio;
        if (a) { a.unlock(); set(a, v / 100); }
      });
      if (sample) vol.querySelector('input').addEventListener('change', () => this.game.audio?.play('pickup'));
      group.appendChild(vol);
    };
    slider('Volume', au()?.volume, (a, v) => a.setVolume(v), true);
    slider('Sound effects', au()?.sfxVolume, (a, v) => a.setSfxVolume(v), true);
    slider('Music', au()?.musicVolume, (a, v) => a.setMusicVolume(v), false);

    // ---- Display: what is drawn, and how (accessibility included) ----
    sec('Display');
    cycle('Graphics', () => (this.game.lowFx ? 'Low (faster)' : 'High'), () => {
      this.game.lowFx = !this.game.lowFx;
      try { localStorage.setItem('singaporescape:gfx', this.game.lowFx ? 'low' : 'high'); } catch {}
      window.dispatchEvent(new Event('resize'));   // re-size the canvas for the new quality
    });
    row('Minimal HUD', () => !!this.game.minimalHud, () => {
      this.game.minimalHud = !this.game.minimalHud;
      this.game.saveSoon = true;
      if (this.game.minimalHud) this.game.msg('Minimal HUD: panels tuck away while you explore. Hover or tap where they were to bring them back.', 'system');
      this._hudPeekUntil = this._now() + 4000;   // don't vanish the button you just pressed
      this._minimalHudTick();
    });
    // XP display: Combined / Per skill / Off (xpdisplay.js).
    cycle('XP display', () => XP_DISPLAY_NAMES[xpDisplayMode(this.game)], () => {
      this.game.xpDisplay = nextXpDisplay(xpDisplayMode(this.game));
      this.game.saveSoon = true;
      this.xpHud?.refresh();
    });
    // World labels: Smart (only what matters now), All, or Off. See render/worldlabels.js.
    cycle('World labels', () => LABEL_MODE_NAMES[labelMode(this.game)], () => {
      this.game.worldLabels = nextLabelMode(labelMode(this.game));
      this.game.saveSoon = true;
    });
    // The side panel's size (panelsize.js): with a mouse, how big its window
    // is (− / + in its header do the same; the text stays its size); on a
    // touch screen, bigger menu text if wanted. compact.css shows whichever
    // row fits the screen.
    const ps = this.panelSize;
    if (ps instanceof PanelSizer) {
      const size = cycle('Side panel size', () => ps.label(), () => ps.step(1, true));
      size.classList.add('set-ps-desk');
      ps.onChange = () => {
        const v = ps.label(), val = size.querySelector('.set-val');
        if (val && val.textContent !== v) { val.textContent = v; size.title = `Side panel size: ${v}`; }
      };
      row('Bigger menu text', () => ps.bigText, () => ps.setBigText(!ps.bigText)).classList.add('set-ps-touch');
    }
    // Accessibility: saved with the other settings; uifx.js puts them on <body>.
    // (No Text size setting any more: it enlarged panels with CSS zoom, which
    // iPhone Safari hit-tests a few pixels off, so taps missed their buttons.)
    const access = () => { this._accessSig = applyAccessibility(this.game); this.game.saveSoon = true; };
    row('Colour-blind friendly', () => !!this.game.colourBlind, () => { this.game.colourBlind = !this.game.colourBlind; access(); });
    row('Reduce motion', () => !!this.game.reduceMotion, () => { this.game.reduceMotion = !this.game.reduceMotion; access(); });
    // Screen shake on big hits and crits (render/juice.js); Reduce motion turns it off too.
    row('Screen shake', () => this.game.screenShake !== false, () => {
      this.game.screenShake = this.game.screenShake === false;
      this.game.saveSoon = true;
    });
    // A small readout of frame times and what fills each frame, for a screenshot
    // of what is slow (perfhud.js; main.js keeps the choice on this device).
    row('Show performance', () => !!this.perfOn, () => this.setPerf?.(!this.perfOn));
    // Phones keep the minimap's camera and day/night badges off the HUD
    // (compact.css), so both are here too: postcard mode, and the time of day
    // (updateDayNight keeps it current).
    this._clockLine = group.appendChild(document.createElement('div'));
    this._clockLine.className = 'set-clock';
    this.updateDayNight();
    mk('Postcard mode: snap this view (O)', () => document.getElementById('photo-btn')?.click());

    // ---- Gameplay ----
    sec('Gameplay');
    // Tapping the dim space around a window closes it (windowease.js); some prefer the ✕ alone.
    row('Tap outside a window to close it', () => this.game.tapClose !== false, () => toggleTapClose(this.game));
    this._tipsBtn = row('Tips', () => this.game.tipsOn !== false, () => {
      this.game.tipsOn = this.game.tipsOn === false;
      this.game.saveSoon = true;
      if (!this.game.tipsOn) this.lane?.dismissKind('tip');
    });
    mk('Show tips again', () => {
      try { localStorage.removeItem(TIPS_KEY); } catch {}
      this.game.tipsSeen = new Set();
      this.game.tipsOn = true;
      this.game.saveSoon = true;
      this._tipsBtn.refresh();
      this.game.msg('Tips will show again as you play.', 'system');
    });

    // ---- Help ----
    sec('Help');
    mk('Compendium: how the game works', () => openCompendium(this));
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.innerHTML = 'Move: joystick or W A S D / arrow keys. Interact with the nearest thing: the Interact button, E or Space. P pickpockets, T toggles auto battle.<br>' +
      'Stand by a tree to chop, a rock to mine, the water to fish, or a monster to fight, then press Interact.<br>' +
      'In combat, build <b>Adrenaline</b> and spend it on abilities (Z/X/C/V): ' +
      'Power Strike, Flurry, Brace and Second Wind. Hit each foe\'s <b>weakness</b> ' +
      '(melee/ranged/magic) for +25% damage and <b>Brace</b> when a monster winds up a heavy blow (!).<br>' +
      'Eat food to heal. Bank your loot. Your progress auto-saves.';
    group.appendChild(hint);
  }

  /** The save as a code to copy out. Buttons and a plain textarea, so it works
   *  the same with a mouse or a finger. */
  openExportSave() {
    const code = exportSaveCode(this.game);
    this.openModal('Export save', (body) => {
      if (!code) {
        body.innerHTML = `<div class="modal-hint">${this.game.pendingStyleChoice ? 'There is nothing to export yet: pick a class first.'
          : 'There is no save here to export. Reload the page and try again.'}</div>`;
        return;
      }
      body.innerHTML = '<p class="save-xfer-note">Copy this code and keep it somewhere safe. To carry on elsewhere, open the game there and paste it into <b>Settings → Import save</b>.</p>' +
        '<textarea class="save-code" readonly rows="6" spellcheck="false"></textarea><div class="study-row save-xfer-actions"></div>';
      const ta = body.querySelector('textarea');
      ta.value = code;
      // One tap selects the whole code, ready for the system Copy menu.
      const selectAll = () => { ta.focus(); ta.setSelectionRange(0, ta.value.length); };
      ta.addEventListener('focus', selectAll);
      const copy = document.createElement('button');
      copy.className = 'wm-go';
      copy.textContent = 'Copy';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(code); copy.textContent = 'Copied!'; return; } catch { /* fall back below */ }
        // No clipboard access (older browsers, insecure pages): select it instead.
        selectAll();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { /* ignore */ }
        copy.textContent = ok ? 'Copied!' : 'Selected: copy it now';
      });
      body.querySelector('.save-xfer-actions').appendChild(copy);
    });
    this.modal.kind = 'saveExport';
  }

  /** Paste a save code to replace this browser's save. The current save is kept
   *  as a backup, and the page reloads so the imported game starts cleanly.
   *  From the class picker (a returning player on a new address), back() goes
   *  back to it, and the modal can't be closed in between. */
  openImportSave(back = null) {
    this.openModal('Import save', (body) => {
      body.innerHTML = '<p class="save-xfer-note">Paste a save code from <b>Export save</b>. It replaces the character saved here; your current save is kept as a backup. Close any other tabs with the game open first.</p>' +
        '<textarea class="save-code" rows="6" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="AWA1:…"></textarea>' +
        '<div class="save-xfer-msg" role="status"></div><div class="study-row save-xfer-actions"></div>';
      const ta = body.querySelector('textarea'), msg = body.querySelector('.save-xfer-msg');
      const go = document.createElement('button');
      go.className = 'wm-go';
      go.textContent = 'Import';
      go.addEventListener('click', () => {
        const res = importSaveCode(ta.value);
        msg.textContent = res.ok ? 'Save imported! Loading your character…' : res.error;
        msg.className = 'save-xfer-msg ' + (res.ok ? 'ok' : 'no');
        if (!res.ok) return;
        go.disabled = ta.disabled = true;
        if (backBtn) backBtn.disabled = true;
        if (this.modal) this.modal.locked = true;   // nothing else to do now but reload
        // An imported character has played before: don't greet it with beginner tips.
        try { localStorage.setItem(TIPS_KEY, JSON.stringify(Object.keys(TIPS))); } catch { /* ignore */ }
        setTimeout(() => location.reload(), 900);
      });
      ta.addEventListener('input', () => { msg.textContent = ''; msg.className = 'save-xfer-msg'; });
      const actions = body.querySelector('.save-xfer-actions');
      let backBtn = null;
      if (back) {
        backBtn = document.createElement('button');
        backBtn.className = 'wm-go';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => { if (this.modal) this.modal.locked = false; back(); });
        actions.appendChild(backBtn);
      }
      actions.appendChild(go);
    });
    this.modal.kind = 'saveImport';
    if (back) {
      this.modal.locked = true;
      if (this.el.modalClose) this.el.modalClose.classList.add('hidden');
    }
  }

  /** Another tab imported a save: this tab's game is out of date and has stopped
   *  saving, so the only way on is a reload. */
  showSaveReplacedElsewhere() {
    if (this.modal) { this.modal.locked = false; this.closeModal(); }
    this.openModal('Save replaced', (body) => {
      body.innerHTML = '<p class="save-xfer-note">A save was imported in another tab, so this tab has stopped saving. Reload to carry on with the imported character.</p><div class="study-row save-xfer-actions"></div>';
      const b = document.createElement('button');
      b.className = 'wm-go';
      b.textContent = 'Reload';
      b.addEventListener('click', () => location.reload());
      body.querySelector('.save-xfer-actions').appendChild(b);
    });
    this.modal.kind = 'saveReplaced';
    this.modal.locked = true;
    if (this.el.modalClose) this.el.modalClose.classList.add('hidden');
  }

  // ---------------- Boss battle bar ----------------
  updateBossBar() {
    const g = this.game;
    if (!this.el.bossBar) return;
    const p = g.player;
    // The boss we're engaged with: fighting us, being fought, or freshly hurt.
    // Champions get the bar too, in gold.
    const engaged = (n) => n.alive && Math.abs(n.x - p.x) <= 16 && Math.abs(n.y - p.y) <= 16 &&
      (n.target === p || p.target === n || n.combatLatch > 0);
    // A boss or champion takes the bar; otherwise the ordinary monster you're
    // fighting gets a smaller, plainer one. Engaged means within 16 tiles, so
    // the NPCs near you (in list order, as the whole list) hold every one: no
    // need to search the whole world's ten thousand every tick.
    const near = g.nearbyNpcs ? g.nearbyNpcs() : g.npcs;
    const boss = near.find((n) => (n.def.boss || n.champion) && engaged(n))
      || (p.target && p.target.attackable && engaged(p.target) ? p.target : null)
      || near.find((n) => n.attackable && n.target === p && engaged(n));
    const on = !!boss && p.alive;
    document.body.classList.toggle('boss-on', on);   // lets the tracker/tips move out of its way
    if (!on) { this.el.bossBar.classList.add('hidden'); return; }
    this.el.bossBar.classList.remove('hidden');
    renderBossBar(this, boss);   // name, life, mechanic badge, threat frame, portrait (bossbar.js)
  }

  // ---------------- Day/night badge ----------------
  updateDayNight() {
    const g = this.game;
    if (!this.el.daynightBadge) return;
    if (!this._dnInit) {
      this.el.daynightSun.innerHTML = sunIconSVG(18);
      this.el.daynightMoon.innerHTML = moonIconSVG(18);
      this._dnInit = true;
    }
    const night = g.isNight();
    this.el.daynightBadge.classList.toggle('night', night);
    this.el.daynightSun.style.opacity = night ? 0 : 1;
    this.el.daynightMoon.style.opacity = night ? 1 : 0;
    const when = `${night ? 'Night' : 'Day'} · ${g.clockLabel()}`;
    if (this.el.daynightBadge.title !== when) this.el.daynightBadge.title = when;
    const cl = this._clockLine;
    if (cl && cl._when !== when) { cl._when = when; cl.textContent = `${night ? '🌙' : '☀️'} Time of day: ${when}`; }
  }

  // ---------------- Orbs ----------------
  renderHp() {
    const hp = this.game.player.hp;
    const max = this.game.maxHp();
    this.el.hpOrbVal.textContent = hp;
    const frac = max ? hp / max : 1;
    // The orb fills like a jar (CSS reads --fill); the number keeps its deep
    // sticker colour so it stays readable on the white disc at any level.
    this.el.hpOrb.style.setProperty('--fill', Math.max(0, Math.min(1, frac)).toFixed(3));
    this.el.hpOrb.classList.toggle('low', frac <= 0.25 && this.game.player.alive);
    renderHpBar(this, hp, max, this.game.player.alive, this.game.player.ward);   // the HUD's life bar (hpbar.js), and a Grace ward
  }

  renderRun() {
    if (!this.el.runOrb?.isConnected) return;
    (this.el.runOrbVal || this.el.runOrb).textContent = `${Math.round(this.game.runEnergy)}%`;
    this.el.runOrb.classList.toggle('active', this.game.running);
  }

  renderSpec() {
    if (!this.el.specOrb) return;
    const e = Math.round(this.game.specEnergy);
    if (this.el.specOrbVal) this.el.specOrbVal.textContent = e;
    const id = this.game.equipment.get('weapon');
    let hasSpec = false;
    try { hasSpec = !!(id && getItem(id).spec); } catch { hasSpec = false; }
    this.el.specOrb.classList.toggle('armed', this.game.specArmed);
    this.el.specOrb.classList.toggle('disabled', !hasSpec);
    this.el.specOrb.style.setProperty('--fill', Math.max(0, Math.min(1, e / 100)).toFixed(3));
    this.el.specOrb.title = hasSpec
      ? `Special: ${getItem(id).spec.name} (${getItem(id).spec.cost}%) — click to arm`
      : 'Special attack (needs a spec weapon)';
  }

  // ---------------- Prayer: Blessings and Faith (blessingsui.js) ----------------
  renderPrayer() { renderFaithOrb(this); }
  _buildPrayerPanel() { buildBlessingsPanel(this); }
  renderPrayerPanel() { renderBlessingsPanel(this); }

  // ---------------- Quest journal ----------------
  renderQuestPanel() {
    const game = this.game;
    // Out of sight it waits, like the Gear view: working out "What next?" and
    // every quest's next step is the dearest redraw in the panel.
    if (this._questDrawn && this._panelHidden(this.el.questPanel)) { this._questStale = true; return; }
    this._questDrawn = true;
    this._questStale = false;
    // Status is a small chip in the card's top row, beside (never over) the title.
    const status = (s) => s === 'done' ? '<span class="q-chip done">Done</span>'
      : s === 'active' ? '<span class="q-chip active">Active</span>'
        : '<span class="q-chip todo">Not started</span>';
    const done = QUESTS.filter((d) => game.quests[d.id]?.state === 'done').length;
    // "What next?": two or three goals with a Go each (whatnextui.js).
    const goals = this._wnGoals = whatNext(game);
    let html = whatNextHTML(game, goals);
    const b = game.bounties;
    if (b && b.list.length) {
      const mult = Math.round((streakMult(b.streak) - 1) * 100);
      html += `<div class="quest-head">Daily bounties &middot; streak ${b.streak} day${b.streak === 1 ? '' : 's'}${mult ? ` (+${mult}% pay)` : ''}</div>`;
      for (const t of b.list) {
        const pct = Math.min(100, Math.round((t.have / t.need) * 100));
        html += `<div class="quest-row bounty-row${t.done ? ' done' : ''}"><div class="q-top"><b>${escapeHtml(t.name)}</b>`
          + (t.done ? '<span class="q-chip done">Paid</span>' : `<span class="q-chip ${t.have > 0 ? 'active' : 'todo'}">${t.have}/${t.need}</span>`) + '</div>'
          + `<span class="q-desc">Defeat ${t.need}${t.zone ? ` in ${escapeHtml(t.zone)}` : ''} &middot; ${shortNumber(Math.round(t.reward * streakMult(b.streak)))} coins</span>`
          + `<div class="bounty-bar"><i style="width:${pct}%"></i></div></div>`;
      }
      html += '<div class="modal-hint">New bounties every day. Finish all three for a bonus, and on back-to-back days to grow your streak.</div>';
    }
    html += eventsPanelHTML(game);   // the running world event and the weekly region challenge
    html += `<div class="quest-head">Quests complete: ${done} / ${QUESTS.length} &middot; Quest points: ${game.questPoints()}</div>`;
    // Auto quest: works on the quest you last pressed Go on, else the next one.
    const aq = game.autoQuestPick();
    const aqName = aq ? QUESTS.find((d) => d.id === aq)?.name : '';
    // Drawn as the same switch as Auto battle, so both automations read On and Off alike.
    html += `<button class="q-auto${game.autoQuest ? ' on' : ''}" aria-pressed="${game.autoQuest}" title="Start, work through and hand in quests by yourself">`
      + '<span class="ab-switch" aria-hidden="true"><i></i></span><span class="ab-text"><b class="ab-label">Auto quest</b>'
      + `<span class="ab-status">${game.autoQuest ? 'On' : 'Off'}${aqName ? ` &middot; ${escapeHtml(aqName)}` : ''}</span></span></button>`;
    for (const d of QUESTS) {
      const st = game.quests[d.id]?.state || 'notStarted';
      let prog = '';
      if (d.progress) { try { prog = d.progress(game); } catch { prog = ''; } }
      const guide = game.questGuide(d.id);
      const canGo = guide.kind !== 'none';
      const tp = canRegionTeleport(game, d.id);   // a finished region quest's teleport
      const next = st !== 'done' && guide.text ? `<span class="q-next">${canGo ? '&#10148; ' : ''}${linkHTML(game, guide.text)}</span>` : '';
      html += `<div class="quest-row${canGo ? ' can-go' : ''}" data-quest="${d.id}"><div class="q-top"><b>${escapeHtml(d.name)}</b>${status(st)}</div>` +
        `<span class="q-desc">${linkHTML(game, d.desc)}${prog ? ` <span class="q-prog">(${escapeHtml(prog)})</span>` : ''}</span>` +
        // The next step and its Go button share the card's foot, so Go never squeezes the text.
        (next || canGo || tp ? `<div class="q-foot">${next}` +
          (canGo ? `<button class="q-go" data-quest="${d.id}" title="Walk there and start on it">Go</button>` : '')
          + (tp ? `<button class="q-go q-tp" data-tp="${d.id}" title="Teleport there">Teleport</button>` : '') + '</div>' : '') + `</div>`;
    }
    this.el.questPanel.innerHTML = html;
    // Tap a quest (or its Go button) to travel to wherever it needs you next.
    for (const row of this.el.questPanel.querySelectorAll('.quest-row.can-go')) {
      row.addEventListener('click', () => { game.questTravel(row.dataset.quest); this.renderQuestPanel(); });
    }
    for (const b of this.el.questPanel.querySelectorAll('.q-tp')) b.addEventListener('click', (e) => { e.stopPropagation(); regionTeleport(game, b.dataset.tp); });
    this.el.questPanel.querySelector('.q-auto')?.addEventListener('click', () => { game.toggleAutoQuest(); });
    wireEventsPanel(this, this.el.questPanel);
    wireWhatNext(this, this.el.questPanel, goals);
  }

  // ---------------- Achievements / collection log ----------------
  // ---------------- Stats tab (final values, everything combined) ----------------
  /** Redraw the Stats tab, only while it is showing (opening the tab draws it).
   *  Open breakdowns stay open, and an unchanged sheet leaves the page alone. */
  renderStatsPanel() {
    const el = this.el.statsPanel;
    if (!el || el.closest('.panel-view')?.classList.contains('hidden')) return;
    const open = new Set([...el.querySelectorAll('details[open]')].map((d) => d.dataset.row));
    let html;
    try { html = statsPanelHTML(statSheet(this.game), open, worthTable(this.game)); } catch (e) { console.warn('Stats tab:', e); return; }
    if (html !== this._statsHTML) { el.innerHTML = html; this._statsHTML = html; }
  }

  renderAchievementPanel() {
    const panel = this.el.achievementPanel;
    if (!panel) return;
    // Out of sight it waits too (every new collection entry redrew it).
    if (this._achDrawn && this._panelHidden(panel)) { this._achStale = true; return; }
    this._achDrawn = true;
    this._achStale = false;
    const game = this.game;
    const owned = game.achievements;
    const cats = [...new Set(ACHIEVEMENTS.map((a) => a.cat))];
    let html = `<div class="ach-head">Unlocked: ${owned.size} / ${ACHIEVEMENTS.length}</div>`;
    for (const cat of cats) {
      html += `<div class="ach-cat">${escapeHtml(cat)}</div><div class="ach-grid">`;
      for (const a of ACHIEVEMENTS.filter((x) => x.cat === cat)) {
        const done = owned.has(a.id);
        let prog = '';
        if (!done && a.progress) { try { prog = a.progress(game); } catch { prog = ''; } }
        // "12/25"-style progress also fills a thin bar along the card's foot.
        const m = /^\s*([\d,]+)\s*\/\s*([\d,]+)/.exec(prog);
        const frac = m ? Math.min(1, Number(m[1].replace(/,/g, '')) / (Number(m[2].replace(/,/g, '')) || 1)) : 0;
        html += `<div class="ach-cell ${done ? 'done' : 'locked'}" title="${escapeHtml(a.desc)}">` +
          `<div class="ach-top"><b>${escapeHtml(a.name)}</b>` +
          (done ? '<span class="ach-tick">&#10003;</span>' : (prog ? `<span class="ach-prog">${escapeHtml(prog)}</span>` : '')) + '</div>' +
          `<span class="ach-desc">${escapeHtml(a.desc)}</span>` +
          `<span class="ach-reward">&#9733; ${shortNumber(rewardFor(a.id))}</span>` +
          (!done && m ? `<span class="ach-bar"><i style="width:${Math.round(frac * 100)}%"></i></span>` : '') +
          `</div>`;
      }
      html += '</div>';
    }
    panel.innerHTML = html;
    const btn = document.createElement('button');
    btn.className = 'bestiary-open';
    const ids = MONSTER_IDS.length + BOSS_IDS.length;
    const seen = [...MONSTER_IDS, ...BOSS_IDS].filter((id) => (game.kills[id] || 0) > 0).length;
    btn.textContent = `Open Monster Codex (${seen}/${ids})`;
    btn.addEventListener('click', () => this.openBestiary());
    panel.insertBefore(btn, panel.firstChild);
    addCollectionButton(this, panel);   // the Collection log and pets (collectionui.js)
    // (The Compendium is one tap away in the Codex and in Settings: a third
    // copy at the top of the Journal only pushed the quests down.)
  }

  // ---------------- Bestiary / Monster Codex ----------------
  /** The old Bestiary entry point now opens the Monster Codex (codexui.js);
   *  with an npc id it opens straight on that creature's entry. */
  openBestiary(id = null) { openCodex(this, id); }

  /** Right-click on the game screen: over a monster, offer to look it up in the codex. */
  worldRightClick(x, y) {
    const n = monsterAtScreen(this.game, x, y, TILE);
    if (!n) return;
    const r = this.game.input?.canvas?.getBoundingClientRect?.() || { left: 0, top: 0 };
    this.showContextMenu(r.left + x, r.top + y, [
      { label: 'Examine', target: n.name, fn: () => { this.game.msg(n.def.examine || n.name, 'system'); this.openBestiary(n.npcId); } },
    ]);
  }

  // ---------------- XP drops / level up ----------------
  // The running counter, ring and pills live in xpdisplay.js (under the minimap).
  showXpDrop(p) { this.xpHud?.onXp(p); }

  onLevelUp({ skill, level }) {
    // A big kill (a boss) can give dozens or hundreds of levels at once: gather
    // them and announce each skill once a frame, rather than redrawing the
    // Skills panel and posting a chat line for every single level (that froze
    // the game for a moment on boss and champion kills).
    const q = this._levelUps || (this._levelUps = new Map());
    const e = q.get(skill);
    q.set(skill, { from: e ? e.from : level - 1, to: level });
    this._soon('levelups', () => this._flushLevelUps());
    this._soon('skills', () => this.renderSkills());
    this.scheduleInventory();   // a new level can unlock gear (green upgrade arrows)
  }

  _flushLevelUps() {
    const q = this._levelUps;
    if (!q?.size) return;
    let last = null, big = false;
    for (const [skill, { from, to }] of q) {
      const sk = SKILLS.find((s) => s.id === skill);
      const n = to - from;
      // What the new level opened: trees, recipes, gear (levelnews.js).
      const news = levelNewsText(levelNews(this.game, skill, from, to));
      this.addChat((n > 1
        ? `Congratulations, you just advanced ${n} ${sk.name} levels! You are now level ${to}.`
        : `Congratulations, you just advanced ${aOrAn(sk.name)} level! You are now level ${to}.`) + (news ? ` ${news}` : ''), 'level');
      if (!big || crossesMilestone(from, to)) last = { sk, n, to, news };   // the banner names a milestone skill
      big = big || crossesMilestone(from, to);
      this.xpHud?.levelUp(skill, from, to);   // a gold pulse on the ring and a toast at the edge
    }
    // The big centre banner is kept for milestone levels (every tenth, 99).
    if (!big) { q.clear(); return; }
    const more = q.size > 1 ? ` (and ${q.size - 1} more skill${q.size > 2 ? 's' : ''})` : '';
    this.showBanner(`<span class="big">Level up!</span>Your ${last.sk.name} is now level ${last.to}${last.n > 1 ? ` (+${last.n})` : ''}${more}.${last.news ? ` <span class="lvl-news">${escapeHtml(last.news)}</span>` : ''}`);
    celebrateLevel({ skill: last.sk.id, name: last.sk.name, level: last.to, more: q.size - 1 }, this.game);   // the gold burst (motion.js)
    q.clear();
  }

  /** Loot just went into the bag: hop the Bag tab if it shows, else the
   *  phone's folded menu button (it shows one tab: the way to the bag). */
  _lootBump() {
    if (typeof document === 'undefined') return;
    const tabs = document.querySelectorAll('#panel-tabs .tab-btn');
    const bag = [...tabs].find((b) => b.dataset.view === 'inventory' && b.offsetParent !== null);
    const btn = bag || [...tabs].find((b) => b.offsetParent !== null && b.classList.contains('active'));
    if (btn) bump(btn, 'ui-bump', this.game);
  }

  // Banners go to the one notification lane (noticelane.js): a small card,
  // a couple at a time, the same one twice shown once as "x2".
  showBanner(html, tag = null) {
    (this.lane ||= new NoticeLane(this)).push({ html, tag, kind: 'banner' });
  }

  /** Take down early only what `tag` put up (leaving the Endless Gate clears
   *  its wave banners, never a level-up). */
  hideBanner(tag) {
    this.lane?.dismissTag(tag);
  }

  // ---------------- Context menu ----------------
  showContextMenu(x, y, options) {
    this._dropTips();   // the item's description never stays up beside its menu
    const menu = this.el.contextMenu;
    menu.innerHTML = '<div class="ctx-title">Choose Option</div>';
    for (const o of options) {
      const item = document.createElement('div');
      item.className = 'ctx-item';
      item.innerHTML = `${escapeHtml(o.label)}${o.target ? ` <span class="ctx-target">${escapeHtml(o.target)}</span>` : ''}`;
      item.addEventListener('click', () => { this.hideContextMenu(); o.fn(); });
      menu.appendChild(item);
    }
    menu.classList.remove('hidden');
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.min(x, window.innerWidth - mw - 4) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - mh - 4) + 'px';
  }

  hideContextMenu() { this.el.contextMenu.classList.add('hidden'); }

  // ---------------- Tooltip ----------------
  showTooltip(e, html, owner = null) {
    const t = this.el.tooltip;
    t.innerHTML = html;
    t.classList.remove('hidden');
    clearTimeout(this._tipLinger);
    this._tipOwner = owner;
    this.moveTooltip(e);
    if (!this._tipGuard) {
      // A hover tip can outlive its item: the bag and equipment panels redraw
      // as you fight or gather, and a removed item never sends "mouse left".
      // Moving onto the redrawn copy of the item keeps the tip (it used to
      // close on the slightest nudge, so it barely stayed up while gathering);
      // moving away lets it linger a moment before closing; a click, a scroll,
      // a key press or the window losing focus closes it at once.
      this._tipGuard = (ev) => {
        const o = this._tipOwner;
        if (this._cardOpen || t.classList.contains('hidden')) return;
        // A scroll closes it only if it moves the item: its own list, or the
        // page. (The chat log scrolls itself as lines arrive while you gather,
        // which used to close the tip with the mouse still resting on the item.)
        if (ev.type === 'scroll') {
          const sc = ev.target;
          if (sc && sc !== document && sc !== document.documentElement && sc !== document.body && o && !sc.contains?.(o)) return;
          this.hideTooltip(); return;
        }
        if (ev.type !== 'mousemove') { this.hideTooltip(); return; }
        if (o && o.isConnected && o.contains(ev.target)) { clearTimeout(this._tipLinger); return; }
        const host = ev.target?.closest?.('[data-tip-host]');
        if (host && o && !o.isConnected && host._tipGet) {   // the item was redrawn under the pointer
          const h = host._tipGet();
          if (h) { t.innerHTML = h; this._tipOwner = host; clearTimeout(this._tipLinger); return; }
        }
        if (host && host !== o) return;   // another item: its own hover shows its tip
        this._lingerHide();
      };
      document.addEventListener('mousemove', this._tipGuard, { passive: true });
      document.addEventListener('mousedown', this._tipGuard, { capture: true });
      document.addEventListener('wheel', this._tipGuard, { passive: true });
      document.addEventListener('keydown', this._tipGuard);
      window.addEventListener('blur', this._tipGuard);
      window.addEventListener('scroll', this._tipGuard, { passive: true, capture: true });
    }
  }

  moveTooltip(e) {
    const t = this.el.tooltip;
    t.style.left = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8) + 'px';
    t.style.top = Math.min(e.clientY + 14, window.innerHeight - t.offsetHeight - 8) + 'px';
  }

  /** Close every item pop-up: the hover tip and a held-open touch card. */
  _dropTips() {
    if (this._cardOpen) this.closeTouchCard();
    this._tipOwner = null;
    this.el.tooltip?.classList.add('hidden');
  }

  /** Close the hover tip after a short moment (TIP_LINGER_MS), unless the
   *  pointer comes back to the item or onto another. */
  _lingerHide() {
    if (this._tipLinger && this._tipLingerArmed) return;
    clearTimeout(this._tipLinger);
    this._tipLingerArmed = true;
    this._tipLinger = setTimeout(() => { this._tipLingerArmed = false; this.hideTooltip(); }, TIP_LINGER_MS);
  }

  hideTooltip() {
    if (this._cardOpen) return;            // a held-open touch card stays until you tap away
    clearTimeout(this._tipLinger); this._tipLingerArmed = false;
    this._tipOwner = null;
    this.el.tooltip.classList.add('hidden');
  }

  /** Details on hover (mouse) or press-and-hold (touch). On touch the details open
   *  as a card with the item's actions as buttons, since phones can't hover. */
  _tip(el, html, actions) {
    const get = () => (typeof html === 'function' ? html() : html);
    el.dataset.tipHost = '';   // marks it for the tip guard (a redrawn copy keeps the tip)
    el._tipGet = get;
    el.addEventListener('mouseenter', (e) => { if (this._touchUsed) return; const h = get(); if (h) this.showTooltip(e, h, el); });
    el.addEventListener('mousemove', (e) => { if (!this._touchUsed) { clearTimeout(this._tipLinger); this._tipLingerArmed = false; this.moveTooltip(e); } });
    el.addEventListener('mouseleave', () => this._lingerHide());
    let timer = 0, sx = 0, sy = 0, fired = false, touching = false;
    const open = () => {
      if (fired || !el.isConnected) return;   // the item was redrawn away mid-press
      fired = true; clearTimeout(timer);
      const h = get();
      if (!h) return;                         // nothing to show (an empty slot)
      try { navigator.vibrate?.(12); } catch {}
      this.showTouchCard(sx, sy, h, actions ? actions() : []);
    };
    el.addEventListener('touchstart', (e) => {
      this._touchUsed = true; touching = true; fired = false;
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      clearTimeout(timer);
      timer = setTimeout(open, 420);
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (Math.hypot(t.clientX - sx, t.clientY - sy) > 10) clearTimeout(timer);
    }, { passive: true });
    el.addEventListener('touchend', (e) => { touching = false; clearTimeout(timer); if (fired) e.preventDefault(); });
    el.addEventListener('touchcancel', () => { touching = false; clearTimeout(timer); });
    // Android turns a long press into a right-click: show our card instead of the menu.
    el.addEventListener('contextmenu', (e) => {
      if (!touching) return;
      e.preventDefault(); e.stopImmediatePropagation();
      open();
    }, { capture: true });
  }

  showTouchCard(x, y, html, actions = []) {
    const t = this.el.tooltip;
    this.hideContextMenu();
    t.innerHTML = html;
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'tc-actions';
      for (const o of actions) {
        const b = document.createElement('button');
        b.textContent = o.label;
        b.addEventListener('click', (e) => { e.stopPropagation(); this.closeTouchCard(); o.fn(); });
        row.appendChild(b);
      }
      t.appendChild(row);
    }
    t.classList.add('touch-card');
    t.classList.remove('hidden');
    this._cardOpen = true;
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.max(8, Math.min(x - w / 2, window.innerWidth - w - 8)) + 'px';
    t.style.top = (y - h - 18 > 8 ? y - h - 18 : Math.min(y + 18, window.innerHeight - h - 8)) + 'px';
    if (!this._cardCloser) {
      // Any tap outside the card closes it.
      this._cardCloser = (e) => { if (this._cardOpen && !t.contains(e.target)) this.closeTouchCard(); };
      document.addEventListener('touchstart', this._cardCloser, { passive: true, capture: true });
      document.addEventListener('mousedown', this._cardCloser, { capture: true });
    }
  }

  closeTouchCard() {
    this._cardOpen = false;
    this.el.tooltip.classList.remove('touch-card');
    this.el.tooltip.classList.add('hidden');
  }

  // ---------------- Modals ----------------
  openModal(title, render) {
    this._dropTips();
    this.winMem?.leave();   // a window opened from another: remember where that one was
    const swap = !!this.modal && this.el.modalOverlay?.classList?.contains?.('hidden') === false;
    this.modal = { title, render };
    this.el.modalTitle.textContent = title;
    this.el.modalOverlay.classList.remove('hidden');
    // A new window starts at its top. The body element is shared, so without
    // this a window opened from a scrolled one (Gear Mastery -> Dismantle)
    // opened part-way down, its intro and first rows out of sight.
    this.el.modalBody.scrollTop = 0;
    // From another window, the shared window's height glides to the new page's (motion.js).
    if (swap) easeHeight(this.el.modalOverlay.querySelector?.('#modal-window'), () => render(this.el.modalBody), this.game);
    else render(this.el.modalBody);
    this.winMem?.enter();   // ...then back to where this window was last time (windowease.js)
    // Opened from another window, the new page fades in; a fresh window's
    // sections rise in one after another (motion.js; both only visual).
    if (swap) swapIn(this.el.modalBody, this.game);
    else staggerIn(this.el.modalBody, this.game);
  }

  /** One-time, non-dismissible prompt: pick a job class. A new character gets its
   *  class's kit; an older save keeps its gear. The choice is permanent. */
  openStyleChoice() {
    const g = this.game;
    const STYLES = [
      { id: 'melee', name: 'Melee', art: 'assets/creatures/hero/melee.webp', blurb: 'Fight up close (most weapons reach 2 tiles).' },
      { id: 'ranged', name: 'Ranged', art: 'assets/creatures/hero/ranged.webp', blurb: 'Shoot from far away. Starts with 999 arrows.' },
      { id: 'magic', name: 'Magic', art: 'assets/creatures/hero/magic.webp', blurb: 'Cast spells from a distance. Starts with runes.' },
      { id: 'dance', name: 'Dance', art: 'assets/creatures/hero/dancer.webp', blurb: 'Lash from 3 tiles, build Rhythm and dodge blows.' },
    ];
    const render = (body) => {
      body.innerHTML = `<div class="dialogue path-intro">${g.pendingClassChoice ? 'Choose your job class. You keep your gear, but from now on you can only wield your class\'s weapon type.' : 'Choose your job class. Each class masters one weapon type.'} <b>This choice is permanent.</b></div>`;
      // A returning player on a new web address or device: bring the old
      // character in straight away, instead of first starting a throwaway one.
      if (g.pendingStyleChoice) {
        const imp = document.createElement('div');
        imp.className = 'save-xfer-intro';
        imp.innerHTML = '<span>Played before? Bring your character over with a save code.</span>';
        const b = document.createElement('button');
        b.className = 'wm-go';
        b.textContent = 'Import save';
        b.addEventListener('click', () => this.openImportSave(() => this.openStyleChoice()));
        imp.appendChild(b);
        body.appendChild(imp);
      }
      // The cards, and above them a spotlight playing the class's attack beside
      // its perks (title.js draws the heroes). Pointing at a card, or its
      // Preview button on a touch screen, puts that class in the spotlight;
      // clicking the card picks it.
      const picker = document.createElement('div');
      picker.className = 'class-picker';
      body.appendChild(picker);
      const still = prefersReducedMotion();
      let chosen = false;
      const choose = (c, card) => {
        if (chosen) return;
        chosen = true;
        g.chooseClass(c.id);
        if (this.modal) this.modal.locked = false; // a choice has been made — safe to close now
        this.renderCombatPanel();
        // A moment to see the new hero swing before the picker closes.
        card?.classList.add('chosen');
        spot.show(c.id, true, true);
        const close = () => { if (this.modal?.kind === 'classpick') this.closeModal(); };
        if (still) close(); else setTimeout(close, 900);
      };
      let n = 0;
      for (const st of STYLES) {
        const sec = document.createElement('div');
        sec.className = 'class-section';
        const pic = `<img src="${st.art}" alt="" width="40" height="40">`;
        sec.innerHTML = `<div class="class-head">${pic}<b>${st.name}</b><span>${st.blurb}</span></div>`;
        const grid = document.createElement('div');
        grid.className = 'dialogue-options class-grid';
        for (const c of CLASSES.filter((x) => x.style === st.id)) {
          const div = document.createElement('div');
          div.className = 'dialogue-option class-card';
          div.tabIndex = 0;
          div.dataset.cls = c.id;
          div.innerHTML = `<span class="class-pic has-stage"><canvas class="class-stage"></canvas></span><span class="class-text"><b>${c.name}</b>`
            + `<span class="class-weapon">${WEAPON_TYPE_NAMES[c.weapon]}</span><span class="class-desc">${c.desc}</span>`
            + `<span class="class-perks">${classPerkSummary(c.id)}</span></span>`
            + '<button class="class-peek" type="button" title="Preview" aria-label="Preview">&#128065;</button>';
          // The card's hero idles on its little stage (each a step out of time with the next).
          const actor = { classId: c.id, phase: (n++) * 431 };
          new HeroStage(div.querySelector('canvas'), (w, h) => [{ actor, x: w / 2, y: h - 7, scale: Math.min(w / 64, h / 62) }], { fps: 24, still });
          div.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); div.click(); } });
          div.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') spot.show(c.id, true); });
          div.addEventListener('focus', () => spot.show(c.id, true));
          div.querySelector('.class-peek').addEventListener('click', (e) => { e.stopPropagation(); spot.show(c.id, true); });
          div.addEventListener('click', () => choose(c, div));
          grid.appendChild(div);
        }
        sec.appendChild(grid);
        picker.appendChild(sec);
      }
      const spot = this._classSpotlight(picker, still, (id) => choose(CLASS_BY_ID[id], picker.querySelector(`.class-card[data-cls="${id}"]`)));
    };
    this.openModal('Choose Your Class', render);
    this.modal.kind = 'classpick';
    this.modal.locked = true;
    if (this.el.modalClose) this.el.modalClose.classList.add('hidden');
  }


  /** The class picker's spotlight: a bigger stage where the class shown swings
   *  its weapon every couple of seconds, with its signature and perks and a
   *  button to choose it. Placed after the cards (so a search for a class's
   *  name finds its card first) and shown above them by CSS. */
  _classSpotlight(parent, still, onChoose) {
    const el = document.createElement('div');
    el.className = 'class-spot';
    el.innerHTML = '<canvas class="class-spot-stage"></canvas><div class="class-spot-info"><div class="class-spot-name"><b></b><span></span></div>'
      + '<p class="class-spot-sig"></p><ul class="class-spot-perks"></ul><button class="class-spot-more" type="button" aria-expanded="false"></button><ul class="class-spot-all"></ul></div><button class="class-spot-go" type="button"></button>';
    parent.appendChild(el);
    // Three chips show; "+N more" opens every perk in full, and stays open while
    // other classes are previewed, so they can be compared.
    const more = el.querySelector('.class-spot-more');
    more.addEventListener('click', () => {
      const open = el.classList.toggle('open');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Less' : more.dataset.more;
    });
    const actor = { classId: null };
    let next = 0;
    new HeroStage(el.querySelector('canvas'), (w, h, now) => {
      if (!still && now > next) { swingActor(actor, now); next = now + 2300; }
      return [{ actor, x: w * 0.44, y: h - 12, scale: Math.min(w / 72, h / 66) }];
    }, { fps: 40, still });
    const show = (id, swing = false, picked = false) => {
      const c = CLASS_BY_ID[id];
      if (!c) return;
      if (actor.classId !== id) {
        actor.classId = id; actor.blend = null;
        el.querySelector('.class-spot-name b').textContent = c.name;
        el.querySelector('.class-spot-name span').textContent = WEAPON_TYPE_NAMES[c.weapon];
        const perks = classPerks(id);
        el.querySelector('.class-spot-sig').textContent = perks[0]?.text || c.desc;
        const { key, rest } = classKeyPerks(id);
        el.querySelector('.class-spot-perks').innerHTML = key.map((p) => `<li title="${escapeHtml(p.text)}"${p.label === 'Speed' || p.label === 'Reach' ? ' class="terse"' : ''}><b>${p.icon} <span>${p.label}</span></b> ${p.chip}</li>`).join('');
        more.dataset.more = `+${rest.length} more`;
        if (!el.classList.contains('open')) more.textContent = more.dataset.more;
        // Opened, every perk shows in full (the chips' short forms included), and
        // on a phone, where the signature above is cut to two lines, that too.
        el.querySelector('.class-spot-all').innerHTML = perks.map((p, i) => `<li${i ? '' : ' class="sig"'}><b>${p.icon} ${p.label}</b> ${p.text}</li>`).join('');
        el.querySelector('.class-spot-go').textContent = `Choose ${c.name} \u25B6`;
        parent.querySelectorAll('.class-card.previewing').forEach((d) => d.classList.remove('previewing'));
        parent.querySelector(`.class-card[data-cls="${id}"]`)?.classList.add('previewing');
        el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
      }
      if (picked) { el.classList.add('chosen'); el.querySelector('.class-spot-sig').textContent = `You are ${aOrAn(c.name)}! ${el.querySelector('.class-spot-sig').textContent}`; }
      if (swing && !still) { swingActor(actor, performance.now()); next = performance.now() + 2300; }
    };
    el.querySelector('.class-spot-go').addEventListener('click', () => onChoose(actor.classId));
    show(CLASSES[0].id);
    return { el, show };
  }

  closeModal() {
    if (this.modal?.locked) return; // e.g. the starting-style choice — must pick one
    this._dropTips();
    if (this.modal && typeof document !== 'undefined') playCloseGhost(this.el.modalOverlay);
    this.winMem?.leave();
    this.modal = null;
    this.winMem?.closed();
    this.el.modalOverlay.classList.add('hidden');
    this.el.modalBody.innerHTML = '';
    // Removed cells never fire mouseleave, and the hover tip now sits above
    // the modal, so drop it here rather than leave it floating over the game.
    this.hideTooltip();
    if (this.el.modalClose) this.el.modalClose.classList.remove('hidden');
  }

  _refreshModalIfOpen(types) {
    if (this.modal && types.includes(this.modal.kind)) this.modal.render(this.el.modalBody);
  }

  // Bank ---------------------------------------------------------------
  openBank() {
    // The bank's slots outlive a redraw, and a closing (slotgrid.js): a withdraw
    // or deposit swaps in only the slots that changed, and opening the bank again
    // reuses them, rather than rebuilding and laying out hundreds of slots.
    const slots = this._bankSlots || (this._bankSlots = keyedSlots());
    let view = null;   // the window's parts, made on its first draw
    const build = (body) => {
      body.innerHTML = '';
      // Totals at the top: coins in the bank and what everything in it is worth.
      const stats = document.createElement('div');
      stats.className = 'ui-stats';
      body.appendChild(stats);
      const cols = document.createElement('div');
      cols.className = 'modal-cols';
      // Bank side
      const bankSide = document.createElement('div');
      const bankHead = document.createElement('div');
      bankHead.className = 'modal-section-title bank-head';
      bankHead.innerHTML = '<span>Bank</span>';
      const search = document.createElement('input');
      search.type = 'text';
      search.className = 'bank-search';
      search.placeholder = 'Search…';
      search.value = this._bankSearch || '';
      // Filtering redraws the slots only, so the box keeps its focus and caret.
      search.addEventListener('input', () => { this._bankSearch = search.value; fill(); });
      bankHead.appendChild(search);
      bankSide.appendChild(bankHead);
      const bankGrid = document.createElement('div');
      bankGrid.className = 'item-grid';
      bankSide.appendChild(bankGrid);
      const empty = document.createElement('div');
      empty.className = 'modal-hint';
      bankSide.appendChild(empty);
      // Inventory side
      const invSide = document.createElement('div');
      const invHead = document.createElement('div');
      invHead.className = 'modal-section-title bank-head';
      invHead.innerHTML = '<span>Inventory</span>';
      const depAll = document.createElement('button');
      depAll.className = 'bank-deposit-all';
      depAll.textContent = 'Deposit all';
      depAll.addEventListener('click', () => this.game.depositAll());
      invHead.appendChild(depositLootButton(this));   // keeps tools, coins and kept items (bankkeepui.js)
      invHead.appendChild(depAll);
      invSide.appendChild(invHead);
      const invGrid = document.createElement('div');
      invGrid.className = 'item-grid';
      invSide.appendChild(invGrid);
      cols.appendChild(bankSide);
      cols.appendChild(invSide);
      body.appendChild(cols);
      const hint = document.createElement('div');
      hint.className = 'modal-hint';
      // The first tap that opens the bank lands on the canvas, so ask the browser too.
      const touch = this._touchUsed || !!window.matchMedia?.('(pointer: coarse)').matches;
      hint.textContent = touch
        ? 'Tap to withdraw/deposit one. Press and hold for amounts.'
        : 'Left-click to withdraw/deposit one. Right-click for amounts.';
      body.appendChild(hint);
      return { body, stats, bankGrid, empty, invGrid };
    };
    const fill = () => {
      const { stats, bankGrid, empty, invGrid } = view;
      const coinsIn = this.game.bank.items.find((e) => e.id === 'coins')?.qty || 0;
      const worth = this.game.bank.items.reduce((t, e) => t + (getItem(e.id)?.value || 0) * e.qty, 0);
      stats.innerHTML = `<div class="ui-stat">${inlineIcon(itemIconSVG('coins', 22))}<span class="ui-stat-label">Coins banked</span><b class="ui-stat-num bank-coins"></b></div>`
        + `<div class="ui-stat"><span class="ui-stat-label">Bank value</span><b class="ui-stat-num bank-total"></b></div>`;
      countUp(stats.querySelector('.bank-coins'), 'bank-coins', coinsIn, shortNumber);
      countUp(stats.querySelector('.bank-total'), 'bank-total', worth, shortNumber);
      const term = (this._bankSearch || '').trim().toLowerCase();
      const shown = term
        ? this.game.bank.items.filter((e) => getItem(e.id).name.toLowerCase().includes(term))
        : this.game.bank.items;
      // A slot's key changes whenever its look would: item, quality or amount.
      placeSlots(bankGrid, shown.map((e) => {
        const q = e.q || null;   // each quality of an item is its own entry
        return slots.get(`${e.id}|${q || ''}|${e.qty}`, () => this._cell(e.id, e.qty, {
          onClick: () => this.game.withdraw(e.id, 1, q),
          menu: () => [
            { label: 'Withdraw 1', fn: () => this.game.withdraw(e.id, 1, q) },
            { label: 'Withdraw 5', fn: () => this.game.withdraw(e.id, 5, q) },
            { label: 'Withdraw 10', fn: () => this.game.withdraw(e.id, 10, q) },
            { label: 'Withdraw All', fn: () => this.game.withdraw(e.id, e.qty, q) },
            keepMenuItem(this, e.id),
            { label: 'Info', fn: () => openEntry(this, 'item', e.id) },
          ],
          q,
        }));
      }));
      // Only a search shows part of the bank: keep the rest of it for when the search is cleared.
      if (!term) slots.prune();
      empty.classList.toggle('hidden', shown.length > 0);
      empty.textContent = term ? 'No matching items.' : 'Your bank is empty.';
      invGrid.innerHTML = '';
      this.game.inventory.slots.forEach((s, i) => {
        if (!s) return;
        const q = s.q || null;
        invGrid.appendChild(markKept(this, this._cell(s.id, s.qty, {
          onClick: () => this.game.deposit(s.id, s.qty, q),
          menu: () => [
            { label: 'Deposit 1', fn: () => this.game.deposit(s.id, 1, q) },
            { label: 'Deposit 5', fn: () => this.game.deposit(s.id, 5, q) },
            { label: 'Deposit All', fn: () => this.game.deposit(s.id, this.game.inventory.count(s.id)) },
            keepMenuItem(this, s.id),
          ],
          q,
        }), s.id));
      });
    };
    const render = (body) => {
      if (!view || view.body !== body || !body.contains(view.bankGrid)) view = build(body);
      fill();
    };
    this.openModal('Bank of Singapore', render);
    this.modal.kind = 'bank';
  }

  // Shop ---------------------------------------------------------------
  openShop(shopId) {
    const shop = getShop(shopId);
    const render = (body) => {
      body.innerHTML = `<div class="ui-stats"><div class="ui-stat">${inlineIcon(itemIconSVG('coins', 22))}<span class="ui-stat-label">Coins</span><b class="ui-stat-num shop-coins"></b></div></div>`;
      countUp(body.querySelector('.shop-coins'), 'coins', this.game.inventory.count('coins'), shortNumber);
      const cols = document.createElement('div');
      cols.className = 'modal-cols';
      // Shop stock
      const shopSide = document.createElement('div');
      shopSide.innerHTML = '<div class="modal-section-title">For sale</div>';
      const shopGrid = document.createElement('div');
      shopGrid.className = 'item-grid shop';
      for (const entry of shop.stock) {
        const price = Math.max(1, Math.round(getItem(entry.id).value * shop.buyMul * this.game.priceFactor(shopId).buy));
        const buyCell = this._cell(entry.id, entry.qty, {
          tooltip: `<b>${getItem(entry.id).name}</b><br>Buy: ${price} coins`,
          onClick: (e) => this.game.buyItem(shopId, entry.id, e?.shiftKey ? 10 : 1),
          menu: () => [
            { label: `Buy 1 (${price})`, fn: () => this.game.buyItem(shopId, entry.id, 1) },
            { label: 'Buy 5', fn: () => this.game.buyItem(shopId, entry.id, 5) },
            { label: 'Buy 10', fn: () => this.game.buyItem(shopId, entry.id, 10) },
            // Runes and arrows are used up by the hundred: buy them by the thousand too.
            ...(/(^|,)(rune|ammo)(,|$)/.test((getItem(entry.id).tags || []).join(',')) ? [
              { label: 'Buy 100', fn: () => this.game.buyItem(shopId, entry.id, 100) },
              { label: `Buy 1000 (${(price * 1000).toLocaleString()})`, fn: () => this.game.buyItem(shopId, entry.id, 1000) },
            ] : []),
            { label: 'Value', fn: () => this.game.msg(`${getItem(entry.id).name}: ${price} coins.`, 'system') },
          ],
        });
        buyCell.classList.add('hot');
        buyCell._hot = (n) => this.game.buyItem(shopId, entry.id, n === Infinity ? 100 : n);
        // The price under each cell, so you needn't point at every item (or,
        // on a phone, long-press it) to see what it costs.
        buyCell.appendChild(shopPriceEl(price));
        shopGrid.appendChild(buyCell);
      }
      shopSide.appendChild(shopGrid);
      // Player inventory (sell)
      const invSide = document.createElement('div');
      invSide.innerHTML = '<div class="modal-section-title">Sell from inventory</div>';
      // One click sells every weapon, armour piece, accessory and arrow made for another class.
      const cls = this.game.jobClass && CLASS_BY_ID[this.game.jobClass];
      if (cls) {
        const n = this.game.inventory.slots.filter((s) => s && this.game.unrelatedToClass(s.id)).length;
        const btn = document.createElement('button');
        btn.className = 'bestiary-open gear-guide-open sell-unrelated'; btn.type = 'button';
        btn.innerHTML = `${inlineIcon(itemIconSVG('coins', 18))} Sell gear not for ${cls.name}s (${n})`;
        btn.title = 'Sells weapons, armour, accessories and arrows your class can\'t use';
        btn.disabled = !n;
        btn.onclick = () => this.game.sellUnrelated(shopId);
        invSide.appendChild(btn);
      }
      const invGrid = document.createElement('div');
      invGrid.className = 'item-grid shop';
      this.game.inventory.slots.forEach((s) => {
        if (!s || s.id === 'coins') return;
        const sell = Math.max(1, Math.round(getItem(s.id).value * shop.sellMul * this.game.priceFactor().sell));
        const sellCell = this._cell(s.id, s.qty, {
          tooltip: `<b>${getItem(s.id).name}</b><br>Sell: ${sell} coins`,
          onClick: (e) => this.game.sellItem(shopId, s.id, e?.shiftKey ? 10 : 1),
          menu: () => [
            { label: `Sell 1 (${sell})`, fn: () => this.game.sellItem(shopId, s.id, 1) },
            { label: 'Sell 5', fn: () => this.game.sellItem(shopId, s.id, 5) },
            { label: 'Sell All', fn: () => this.game.sellItem(shopId, s.id, this.game.inventory.count(s.id)) },
          ],
        });
        sellCell.classList.add('hot');
        sellCell._hot = (n) => this.game.sellItem(shopId, s.id, n === Infinity ? this.game.inventory.count(s.id) : n);
        sellCell.appendChild(shopPriceEl(sell));
        invGrid.appendChild(sellCell);
      });
      invSide.appendChild(invGrid);
      // A short pack leaves the sell side mostly empty: give the stock the room.
      cols.classList.add('shop-cols');
      cols.classList.toggle('sell-small', sellSideSmall(invGrid.childElementCount, shop.stock.length));
      cols.appendChild(shopSide);
      cols.appendChild(invSide);
      body.insertAdjacentHTML('beforeend', '<div class="modal-hint hotkey-hint">Click: 1 · Shift-click: 10 · Point at an item and press <kbd>1</kbd> <kbd>5</kbd> <kbd>X</kbd> (10) or <kbd>A</kbd> (sell all / buy 100)</div>');
      body.appendChild(cols);
    };
    this.openModal(shop.name, render);
    this.modal.kind = 'shop';
    this.modal.shopId = shopId;
  }

  // Cooking ------------------------------------------------------------
  openCookMenu(obj) {
    const raws = [...new Set(this.game.inventory.slots.filter((s) => s && COOKING[s.id]).map((s) => s.id))];
    const dishes = DISHES.filter((d) => d.inputs.every((inp) => this.game.inventory.has(inp.id, inp.qty)));
    if (!raws.length && !dishes.length) { this.game.msg('You have nothing to cook.'); return; }
    const render = (body) => {
      const q = makeQtyOf(this.game);
      body.innerHTML = `<div class="modal-hint">Choose what to cook. ${q === Infinity ? 'You\'ll cook until you run out.' : `You'll cook ${formatNumber(q)} (or all you have, if fewer).`}</div>`;
      body.appendChild(this._doAllRow('cook', obj, 'Cook all'));
      body.appendChild(this._makeQtyRow());
      if (raws.length) {
        const grid = document.createElement('div');
        grid.className = 'item-grid';
        for (const rawId of raws) {
          const cook = COOKING[rawId];
          grid.appendChild(this._cell(rawId, this.game.inventory.count(rawId), {
            tooltip: `<b>${getItem(cook.result).name}</b><br>Cooking lvl ${cook.level}, ${formatNumber(Math.round(this.game.skills.xpAtLevel('cooking', makeXp(this.game, 'cooking', cook.xp))))} xp<br>${makePill(this.game, maxMakes(this.game, 'cook', rawId))}`,
            onClick: () => { this.game.startCooking(obj, rawId); this.closeModal(); },
          }));
        }
        body.appendChild(grid);
      }
      // Combination dishes (use crafted pottery + cooked ingredients).
      if (dishes.length) {
        body.appendChild(Object.assign(document.createElement('div'), { className: 'modal-section-title', textContent: 'Dishes' }));
        const list = document.createElement('div');
        for (const d of dishes) {
          const can = this.game.skills.level('cooking') >= d.level;
          const row = document.createElement('div');
          row.className = 'dialogue-option';
          row.style.opacity = can ? '1' : '0.5';
          const needs = d.inputs.map((inp) => `${inp.qty} ${getItem(inp.id).name}`).join(' + ');
          row.innerHTML = `<span class="row-ic">${itemIconSVG(d.result, 22)}</span> <b>${getItem(d.result).name}</b> <span style="opacity:.75">(lvl ${d.level} &mdash; ${needs})</span>${makePill(this.game, maxMakes(this.game, 'dish', d))}`;
          row.addEventListener('click', () => { this.game.startDish(obj, d); this.closeModal(); });
          list.appendChild(row);
        }
        body.appendChild(list);
      }
    };
    this.openModal('Cooking', render);
    this.modal.kind = 'cook';
  }

  /** A "Do all" row at the top of a station menu: make everything you can here. */
  _doAllRow(kind, obj, label) {
    const row = document.createElement('div');
    row.className = 'dialogue-option do-all';
    row.innerHTML = `<b>⚡ ${label}</b> <span style="opacity:.75">(everything you can make here, best first)</span>`;
    row.addEventListener('click', () => { this.game.startAll(kind, obj); this.closeModal(); });
    return row;
  }

  /** The "1 · 5 · 10 · X · All" amount chips under "Do all" (makeqty.js). */
  _makeQtyRow() {
    return makeQtyRow(this.game, () => this.modal?.render(this.el.modalBody));
  }

  // Smelting -----------------------------------------------------------
  openSmeltMenu(obj) {
    const render = (body) => {
      body.innerHTML = '<div class="modal-hint">Smelt ore into bars.</div>';
      const list = document.createElement('div');
      list.appendChild(this._doAllRow('smelt', obj, 'Smelt all'));
      list.appendChild(this._makeQtyRow());
      for (const r of SMELT) {
        const can = r.inputs.every((inp) => this.game.inventory.has(inp.id, inp.qty)) && this.game.skills.level('smithing') >= r.level;
        const row = document.createElement('div');
        row.className = 'dialogue-option';
        row.style.opacity = can ? '1' : '0.5';
        const needs = r.inputs.map((inp) => `${inp.qty} ${getItem(inp.id).name}`).join(' + ');
        row.innerHTML = `<span class="row-ic">${itemIconSVG(r.result, 22)}</span> <b>${getItem(r.result).name}</b> <span style="opacity:.75">(lvl ${r.level} &mdash; ${needs})</span>${makePill(this.game, maxMakes(this.game, 'smelt', r))}`;
        row.addEventListener('click', () => { this.game.startSmelt(r, obj); this.closeModal(); });
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('Smelting', render);
    this.modal.kind = 'smelt';
  }

  // Crafting -----------------------------------------------------------
  openCraftMenu(obj) {
    const render = (body) => {
      body.innerHTML = '<div class="modal-hint">Craft pottery and jewellery from gathered materials, and refine scrolls and upgrade wards from gems and bars.</div>';
      const list = document.createElement('div');
      list.appendChild(this._doAllRow('craft', obj, 'Craft all'));
      list.appendChild(this._makeQtyRow());
      for (const r of CRAFT) {
        const hasTool = !r.tool || this.game.hasTool(r.tool);
        const can = hasTool && r.inputs.every((inp) => this.game.inventory.has(inp.id, inp.qty)) && this.game.skills.level('crafting') >= r.level;
        const row = document.createElement('div');
        row.className = 'dialogue-option';
        row.style.opacity = can ? '1' : '0.5';
        const needs = r.inputs.map((inp) => `${inp.qty} ${getItem(inp.id).name}`).join(' + ');
        row.innerHTML = `<span class="row-ic">${itemIconSVG(r.result, 22)}</span> <b>${r.qty > 1 ? r.qty + ' ' : ''}${getItem(r.result).name}</b> <span style="opacity:.75">(lvl ${r.level} &mdash; ${needs}${r.tool ? ', chisel' : ''})</span>${makePill(this.game, maxMakes(this.game, 'craft', r))}`;
        row.addEventListener('click', () => { this.game.startCraft(r, obj); this.closeModal(); });
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('Crafting', render);
    this.modal.kind = 'craft';
  }

  // Fletching and Herblore ---------------------------------------------
  openRecipeMenu(skill, obj) {
    const g = this.game;
    const recipes = skill === 'herblore'
      ? Object.entries(POTIONS).map(([id, p]) => ({ result: id, qty: 1, inputs: p.inputs, level: p.level, xp: p.xp }))
      : FLETCH;
    const render = (body) => {
      body.innerHTML = `<div class="modal-hint">${skill === 'herblore'
        ? 'Brew farmed herbs into potions. Drink one from your pack for a boost in battle.'
        : 'Carve logs with a knife, and tip arrow shafts with feathers and a metal bar.'}</div>`;
      const list = document.createElement('div');
      list.appendChild(this._doAllRow(skill, obj, skill === 'herblore' ? 'Brew all' : 'Fletch all'));
      list.appendChild(this._makeQtyRow());
      for (const r of recipes) {
        const hasTool = !r.tool || g.hasTool(r.tool);
        const can = hasTool && g.skills.level(skill) >= r.level && r.inputs.every(([id, n]) => g.inventory.has(id, n));
        const row = document.createElement('div');
        row.className = 'dialogue-option';
        row.style.opacity = can ? '1' : '0.5';
        const needs = r.inputs.map(([id, n]) => `${n} ${getItem(id).name}`).join(' + ');
        row.innerHTML = `<span class="row-ic">${itemIconSVG(r.result, 22)}</span> <b>${r.qty > 1 ? r.qty + ' ' : ''}${getItem(r.result).name}</b> <span style="opacity:.75">(lvl ${r.level} &mdash; ${needs}${r.tool ? ', knife' : ''})</span>${makePill(g, maxMakes(g, 'recipe', r))}`;
        row.addEventListener('click', () => { g.startRecipe(skill, r, obj); this.closeModal(); });
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal(skill === 'herblore' ? 'Herblore' : 'Fletching', render);
    this.modal.kind = skill;
  }

  // Farming: choose which seed to plant ------------------------------------
  openSeedMenu(obj, seeds) {
    const render = (body) => {
      body.innerHTML = '<div class="modal-hint">Choose a seed to plant in this patch.</div>';
      const list = document.createElement('div');
      for (const id of seeds) {
        const c = CROP_BY_SEED[id];
        const row = document.createElement('div');
        row.className = 'dialogue-option';
        row.innerHTML = `<span class="row-ic">${itemIconSVG(id, 22)}</span> <b>${getItem(id).name}</b> <span style="opacity:.75">(Farming ${c[2]} &mdash; ${this.game.inventory.count(id)} in pack)</span>`;
        row.addEventListener('click', () => { this.closeModal(); this.game.plantSeed(obj, id); });
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('Plant a seed', render);
    this.modal.kind = 'farm';
  }

  // Smithing -----------------------------------------------------------
  openSmithMenu(obj) {
    const render = (body) => {
      body.innerHTML = '<div class="modal-hint">Hammer bars into equipment, or into upgrade stones for enchanting.</div>';
      const list = document.createElement('div');
      list.appendChild(this._doAllRow('smith', obj, 'Smith all'));
      list.appendChild(this._makeQtyRow());
      const lvl = this.game.skills.level('smithing');
      const row = (r) => {
        const can = this.game.inventory.has(r.bar, r.barCount) && lvl >= r.level && this.game.hasTool('hammer');
        const el = document.createElement('div');
        el.className = 'dialogue-option';
        el.style.opacity = can ? '1' : '0.5';
        el.innerHTML = `<span class="row-ic">${itemIconSVG(r.result, 22)}</span> <b>${r.qty > 1 ? r.qty + ' ' : ''}${getItem(r.result).name}</b> <span style="opacity:.75">(lvl ${r.level} &mdash; ${r.barCount} ${getItem(r.bar).name})</span>${makePill(this.game, maxMakes(this.game, 'smith', r))}`;
        el.addEventListener('click', () => { this.game.startSmith(r, obj); this.closeModal(); });
        return el;
      };
      const head = (text) => { const h = document.createElement('div'); h.className = 'set-section'; h.textContent = text; return h; };
      // Gathering tools first (they were at the bottom of 300-odd recipes): each
      // kind's tiers up to the next one past your level, best first.
      const tools = smithToolRows(lvl);
      if (tools.length) {
        list.appendChild(head('Gathering tools'));
        for (const r of tools) list.appendChild(row(r));
        list.appendChild(head('Weapons, armour and more'));
      }
      const shown = new Set(tools);
      for (const r of SMITH) if (!shown.has(r) && !r.toolTag) list.appendChild(row(r));
      body.appendChild(list);
    };
    this.openModal('Smithing', render);
    this.modal.kind = 'smith';
  }

  // Slayer Master ------------------------------------------------------
  openSlayerMaster(npc) {
    const render = (body) => {
      const g = this.game;
      const t = g.slayer.task;
      body.innerHTML = '';
      const info = document.createElement('div');
      info.className = 'dialogue';
      info.innerHTML = `<div class="speaker">${escapeHtml(npc.name)}</div>` +
        (t ? `Your task: slay <b>${t.remaining}</b> more <b>${escapeHtml(t.name)}</b> (${t.amount - t.remaining}/${t.amount}).`
          : 'You have no task, lah. Want one?') +
        `<div class="slayer-stats">Slayer level ${g.skills.slayer} &middot; <b>${g.slayer.points}</b> points &middot; ${g.slayer.completed} tasks done</div>`;
      body.appendChild(info);
      // What Slayer gives you, spelled out: the on-task bonuses, the helmet,
      // the next unlock and what points are for.
      const sb = g.slayerBonus(), next = nextSlayerUnlock(g.skills.slayer);
      const buffs = document.createElement('div');
      buffs.className = 'slayer-buffs';
      buffs.innerHTML = '<b>Your Slayer bonuses</b> (against monsters on your task)<ul>' +
        `<li><b>+${sb.dmg}% damage</b>${sb.helm ? ` (includes +${sb.helm}% from your Slayer helmet)` : ` &middot; wear a Slayer helmet for +${SLAYER_HELM_DMG}% more`}</li>` +
        `<li><b>${sb.loot}% chance of extra loot</b> from each kill</li>` +
        '<li>Both grow with your Slayer level</li>' +
        (next ? `<li>Level ${next.level} unlocks tougher tasks: ${escapeHtml(next.names.slice(0, 3).join(', '))}${next.names.length > 3 ? '…' : ''}</li>` : '<li>Every task monster is unlocked</li>') +
        '<li>Finish tasks for points: 10 each, 25 every 5th, 50 every 10th. Spend them in the rewards shop.</li></ul>';
      body.appendChild(buffs);
      const opts = document.createElement('div');
      opts.className = 'dialogue-options';
      const mk = (label, fn) => { const d = document.createElement('div'); d.className = 'dialogue-option'; d.textContent = label; d.addEventListener('click', fn); opts.appendChild(d); };
      if (!t) mk('Give me a Slayer task', () => g.assignSlayerTask());
      else mk('Cancel my current task', () => g.cancelSlayerTask());
      // Auto quest can run Slayer tasks back to back by itself.
      if (g.autoQuest && g.autoQuestId === 'slayer') mk('Stop doing Slayer tasks automatically', () => { g.toggleAutoQuest(false); render(body); });
      else mk('Auto quest: do Slayer tasks for me', () => { g.autoSlayer(); this.closeModal(); });
      mk('Slayer rewards shop', () => this.openSlayerRewards());
      mk('Goodbye', () => this.closeModal());
      body.appendChild(opts);
    };
    this.openModal('Slayer Master', render);
    this.modal.kind = 'slayer';
  }

  openSlayerRewards() {
    const render = (body) => {
      const g = this.game;
      body.innerHTML = `<div class="modal-hint">Slayer points: <b>${g.slayer.points}</b></div>`;
      const grid = document.createElement('div');
      grid.className = 'item-grid shop';
      for (const r of SLAYER_REWARDS) {
        const it = getItem(r.id);
        grid.appendChild(this._cell(r.id, r.qty, {
          tooltip: `<b>${it.name}</b><br>Cost: ${r.cost} Slayer points`,
          onClick: () => g.buySlayerReward(r.id),
        }));
        const last = grid.lastChild;
        const tag = document.createElement('span');
        tag.className = 'slayer-cost' + (g.slayer.points < r.cost ? ' short' : '');
        tag.textContent = `${r.cost}p`;
        last.appendChild(tag);
      }
      body.appendChild(grid);
      const back = document.createElement('div');
      back.className = 'dialogue-options';
      const b = document.createElement('div'); b.className = 'dialogue-option'; b.textContent = 'Back';
      b.addEventListener('click', () => this.openSlayerMaster({ name: 'Slayer Master', def: {} }));
      back.appendChild(b);
      body.appendChild(back);
    };
    this.openModal('Slayer Rewards', render);
    this.modal.kind = 'slayerRewards';
  }

  // The Endless Gate (wavehud.js) ----------------------------------------
  openWaveGate() { (this.waveHud ||= new WaveHud(this)).openGate(); }

  // MRT fast travel ----------------------------------------------------
  openTransport(obj) {
    const render = (body) => {
      const here = this._nearestStation(obj);
      body.innerHTML = `<div class="modal-hint">Tap your EZ-link card. Fare: ${MRT_FARE} coins &middot; Coins: ${formatNumber(this.game.inventory.count('coins'))}</div>`;
      const list = document.createElement('div');
      list.className = 'mrt-list';
      for (const st of STATIONS) {
        const row = document.createElement('div');
        row.className = 'dialogue-option mrt-row' + (st.id === here ? ' current' : '');
        row.innerHTML = `<span class="mrt-dot"></span><b>${escapeHtml(st.name)}</b>${st.id === here ? ' <span class="mrt-here">(you are here)</span>' : ''}`;
        if (st.id !== here) row.addEventListener('click', () => this.game.travelTo(st.id));
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('MRT Network', render);
    this.modal.kind = 'transport';
  }

  _nearestStation(obj) {
    let best = null, bd = Infinity;
    for (const st of STATIONS) {
      const d = Math.abs(st.x - obj.x) + Math.abs(st.y - obj.y);
      if (d < bd) { bd = d; best = st.id; }
    }
    return best;
  }

  // Dialogue -----------------------------------------------------------
  openDialogue(npc) {
    if (npc.def.dialogue === 'slayer') return this.openSlayerMaster(npc);
    if (npc.def.dialogue === 'pest') return openPestOfficer(this, npc);   // Pest Control contracts (cullingui.js)
    if (npc.def.dialogue === 'story') return this.game.story?.talkTo(npc);   // a story messenger (story.js)
    const tree = personalise(this.game, npc, npc.def.moral ? this._moralTree(npc.def.moral) : npc.def.dialogue === 'region' ? regionDialogue(this.game, npc) : getDialogue(npc.def.dialogue));   // memory.js
    if (!tree) { this.game.msg(`${npc.name} has nothing to say.`); return; }
    const show = (nodeId) => {
      const node = tree[nodeId];
      if (!node || nodeId === 'end') { this.closeModal(); return; }
      const render = (body) => {
        // The speaker's picture beside their words (the story scenes' portrait).
        const art = speakerArt(npc.npcId);
        const pic = art ? `<span class="dlg-portrait" aria-hidden="true"><img alt="" src="${escapeHtml(art.src)}"${art.filter ? ` style="filter:${escapeHtml(art.filter)}"` : ''}></span>` : '';
        body.innerHTML = `<div class="dialogue${art ? ' has-portrait' : ''}">${pic}<div class="dlg-words"><div class="speaker">${escapeHtml(node.speaker)}</div>${escapeHtml(node.text)}</div></div>`;
        const opts = document.createElement('div');
        opts.className = 'dialogue-options';
        const { main, bye } = farewellSplit(node.options);
        const pick = (o) => () => {
          if (o.action) this.game.handleDialogueAction(o.action);
          show(o.next || 'end');
        };
        for (const o of main) {
          const div = document.createElement('div');
          div.className = 'dialogue-option';
          div.textContent = o.label;
          div.addEventListener('click', pick(o));
          opts.appendChild(div);
        }
        body.appendChild(opts);
        // "Goodbye." is a small button under the choices, not one of them.
        if (bye) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'dlg-bye';
          b.textContent = bye.label;
          b.addEventListener('click', pick(bye));
          const foot = document.createElement('div');
          foot.className = 'dlg-foot';
          foot.appendChild(b);
          body.appendChild(foot);
        }
      };
      if (!this.modal) this.openModal(npc.name, render);
      // The next line of talk: the sheet's height glides to fit (motion.js).
      else { this.modal.render = render; easeHeight(this.el.modalOverlay.querySelector?.('#modal-window'), () => render(this.el.modalBody), this.game); }
    };
    this.openModal(npc.name, () => {});
    this.modal.kind = 'dialogue';
    show('start');
  }

  /** A moral encounter's dialogue: its two choices, or a parting line once answered. */
  _moralTree(id) {
    const g = this.game, ev = MORAL_BY_ID[id];
    const cost = ev?.good.cost ? moralCoins(ev.good.cost, g.fightLevel()) : 0;
    return moralDialogue(id, { chosen: g.moral.choices[id], cost, canAfford: g.inventory.count('coins') >= cost });
  }

  // Shared item cell ---------------------------------------------------
  // `menu` lists the amount choices (Buy 5, Withdraw all ...): a right-click menu on
  // desktop, and buttons on the press-and-hold card on phones, which have no right-click.
  _cell(id, qty, { onClick, menu, tooltip, q = null } = {}) {
    const item = getItem(id);
    const cell = document.createElement('div');
    cell.className = 'item-cell';
    cell.innerHTML = `<span>${lazyIcon(itemIconSVG(id, 30))}</span>${q ? this._qualityPip(q) : ''}`;
    if (item.stackable || qty > 1) {
      const lbl = stackLabel(qty);
      const q = document.createElement('span'); q.className = 'qty'; q.textContent = lbl.text;
      cell.appendChild(q);
    }
    if (onClick) cell.addEventListener('click', onClick);
    if (menu) cell.addEventListener('contextmenu', (e) => { e.preventDefault(); this.showContextMenu(e.clientX, e.clientY, menu()); });
    // Built when first pointed at: a bank of hundreds of slots needn't write every card up front.
    this._tip(cell, tooltip || (() => `<b>${qualityNameHTML(id, q)}</b><br><span style="opacity:.8">${item.examine || ''}</span>${q && item.equip ? this._gearTip(id, 'main', q) : ''}`), menu);
    return cell;
  }

  // ---------------- World map (full overview) ----------------
  openWorldMap(focus = null) {
    const game = this.game;
    const W = game.world.width, H = game.world.mapHeight || game.world.height;   // not the Endless Gate's sea
    // Which markers show; remembered between openings.
    const on = this._mapFilters || (this._mapFilters = new Set(['mrt', 'boss', 'bank']));
    // `focus` ({ x, y, label }) opens with that spot picked (the Monster Codex's Show on map).
    let sel = focus && Number.isFinite(focus.x) ? focus : null;
    // The terrain never changes, so paint it once (one pixel per tile) and scale it up.
    // It is the minimap's sticker map, at the two pixels per tile the map is
    // drawn at (minimapart.js), painted on first open.
    if (!this._mapBase) this._mapBase = bakeMinimapPatch(game.world, 0, 0, W, H, 2);
    if (!this._mapBase) {
      const b = document.createElement('canvas');
      b.width = W; b.height = H;
      const bc = b.getContext('2d');
      // The minimap's one-pixel-per-tile picture is the same map in the same
      // colours: copy its top W x H (was 200,000 one-pixel fills on first open).
      const mini = this._minimapTerrain();
      if (mini && bc) bc.drawImage(mini, 0, 0, W, H, 0, 0, W, H);
      this._mapBase = b;
    }
    const skillName = (id) => SKILLS.find((x) => x.id === id)?.name || id;
    const objTypes = { tree: ['tree'], rock: ['rock'], fishing: ['fishing'], hunt: ['hunt'], farm: ['farm'], bank: ['bank'],
      station: ['furnace', 'anvil', 'range', 'craft', 'fletch', 'herblore'] };
    const filterOf = Object.create(null);   // object type -> its filter, looked up once per object below
    for (const k of Object.keys(objTypes)) for (const t of objTypes[k]) filterOf[t] ??= k;
    const markers = () => {
      const out = [];
      if (on.has('mrt')) for (const st of STATIONS) {
        out.push({ f: 'mrt', x: st.x, y: st.y, big: true, station: st, label: `${st.name} MRT` });
      }
      if (on.has('boss')) for (const n of game.npcs) {
        if (!n.alive || !n.def.boss || n.temporary) continue;
        out.push({ f: 'boss', x: n.x, y: n.y, big: true, npc: n, label: `${n.name} (level ${n.def.level})` });
      }
      for (const o of game.world.objects) {
        const f = filterOf[o.def.type];
        if (!f || !on.has(f)) continue;
        const d = o.def;
        const locked = !!(d.skill && d.level && game.skills.level(d.skill) < d.level);
        out.push({ f, x: o.x, y: o.y, obj: o, locked, big: f === 'bank' || f === 'station' || f === 'farm',
          label: d.skill && d.level ? `${d.name} (${skillName(d.skill)} ${d.level})` : d.name });
      }
      return out;
    };
    const render = (body) => {
      body.innerHTML = '';
      const chips = document.createElement('div');
      chips.className = 'wm-chips';
      for (const f of MAP_FILTERS) {
        const b = document.createElement('button');
        b.className = 'wm-chip' + (on.has(f.id) ? ' on' : '');
        b.innerHTML = `<i style="background:${f.col}"></i>${f.name}`;
        b.addEventListener('click', () => { on.has(f.id) ? on.delete(f.id) : on.add(f.id); sel = null; render(body); });
        chips.appendChild(b);
      }
      body.appendChild(chips);
      const scale = Math.max(2, Math.floor(Math.min((Math.min(window.innerWidth * 0.9, 620)) / W, (window.innerHeight * 0.6) / H)));
      const cnv = document.createElement('canvas');
      cnv.width = W * scale; cnv.height = H * scale;
      cnv.className = 'worldmap-canvas';
      const c = cnv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(this._mapBase, 0, 0, W * scale, H * scale);
      const list = markers();
      // The canvas is shrunk to fit the panel, so size markers in on-screen pixels.
      const k = cnv.width / Math.min(cnv.width, window.innerWidth * 0.9, 620);
      for (const m of list) {
        const col = MAP_FILTERS.find((f) => f.id === m.f).col;
        const cx = m.x * scale + scale / 2, cy = m.y * scale + scale / 2;
        if (m.big) {
          // Big markers are sticker dots: navy ink ring, colour fill (hollow when locked).
          const r = (m.f === 'mrt' ? 5 : 3.5) * k;
          c.fillStyle = '#22304A'; c.beginPath(); c.arc(cx, cy, r + 1.2 * k, 0, Math.PI * 2); c.fill();
          c.fillStyle = m.locked ? '#6b7383' : col; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
          if (m.f === 'mrt' && !m.locked) {
            c.fillStyle = '#22304A'; c.font = `900 ${Math.round(r * 1.3)}px Nunito,sans-serif`;
            c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', cx, cy + 0.5);
          }
        } else {
          c.globalAlpha = m.locked ? 0.35 : 1;
          const sz = Math.max(scale, 2 * k);
          c.fillStyle = '#22304A'; c.fillRect(cx - sz / 2 - k * 0.6, cy - sz / 2 - k * 0.6, sz + k * 1.2, sz + k * 1.2);
          c.fillStyle = col; c.fillRect(cx - sz / 2, cy - sz / 2, sz, sz);
          c.globalAlpha = 1;
        }
      }
      // Map lettering: navy-outlined sticker letters, so names read on grass and sea alike.
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      const label = (text, x, y, fill) => { c.strokeStyle = 'rgba(34,48,74,0.85)'; c.lineWidth = 2.6 * k; c.strokeText(text, x, y); c.fillStyle = fill; c.fillText(text, x, y); };
      // Resource zones (world.js): a green dot and the zone's name at its signpost.
      c.font = `800 ${mapLabelPx(8.5, k, Math.max(8, scale * 2.4))}px Nunito,"Trebuchet MS",sans-serif`;
      for (const rz of game.world.resourceZones || []) {
        const zx = rz.cx * scale + scale / 2, zy = rz.cy * scale + scale / 2;
        c.fillStyle = '#22304A'; c.beginPath(); c.arc(zx, zy, 4.5 * k, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#9be37a'; c.beginPath(); c.arc(zx, zy, 3.2 * k, 0, Math.PI * 2); c.fill();
        if (k < MAP_GROVE_NAMES_K) label(rz.name, zx, zy - 10 * k, '#c8f5b0');
      }
      // Groves and quarries (groves.js): a smaller dot and name, a darker green (grey for a quarry).
      c.font = `800 ${mapLabelPx(7.5, k, Math.max(7, scale * 2))}px Nunito,"Trebuchet MS",sans-serif`;
      for (const g of game.world.groves || []) {
        const gx = g.cx * scale + scale / 2, gy = g.cy * scale + scale / 2;
        const q = g.kind === 'quarry';   // quarries in stone grey
        c.fillStyle = '#22304A'; c.beginPath(); c.arc(gx, gy, 3.6 * k, 0, Math.PI * 2); c.fill();
        c.fillStyle = q ? '#a9b4c2' : '#4fae5a'; c.beginPath(); c.arc(gx, gy, 2.4 * k, 0, Math.PI * 2); c.fill();
        if (k < MAP_GROVE_NAMES_K) label(g.name, gx, gy - 9 * k, q ? '#e2e8f0' : '#b6e8a4');
      }
      // Zone labels last, over every dot.
      const zonePx = mapLabelPx(8.5, k, Math.max(9, scale * 3));
      c.font = `800 ${zonePx}px Nunito,"Trebuchet MS",sans-serif`;
      // Nudge labels apart where neighbouring regions' names would overlap.
      const placed = [];
      // Regions with a level band carry it, on the scale monsters show, and turn
      // amber where it's well above you.
      const you = game.fightLevel();
      for (const z of game.world.zones) {
        const rec = zoneLevel(z);
        const text = rec ? `${z.name} ${rec}+` : z.name;
        const w2 = c.measureText(text).width / 2 + 3, h = zonePx + 2;
        const cx = Math.min(cnv.width - w2, Math.max(w2, ((z.x0 + z.x1) / 2) * scale));   // kept inside the map's edges
        let cy = ((z.y0 + z.y1) / 2) * scale;
        while (placed.some((b) => Math.abs(b.cx - cx) < b.w2 + w2 && Math.abs(b.cy - cy) < h)) cy += h;
        placed.push({ cx, cy, w2 });
        label(text, cx, cy, z.wilderness ? '#ff8a7a' : tooHigh(rec, you) ? '#ffb347' : '#fff3c8');
      }
      c.textAlign = 'start'; c.textBaseline = 'alphabetic';
      // The picked spot gets a gold ring.
      if (sel) {
        c.strokeStyle = '#F5B82E'; c.lineWidth = 3;
        c.lineWidth = 2 * k;
        c.beginPath(); c.arc(sel.x * scale + scale / 2, sel.y * scale + scale / 2, 9 * k, 0, Math.PI * 2); c.stroke();
      }
      // player marker
      const px = game.player.x * scale + scale / 2, py = game.player.y * scale + scale / 2;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 5 * k, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d8324a'; c.beginPath(); c.arc(px, py, 3.6 * k, 0, Math.PI * 2); c.fill();
      // Tap to pick a spot (snapping to the nearest marker), then Go / Ride below.
      cnv.addEventListener('click', (e) => {
        const r = cnv.getBoundingClientRect();
        const tpp = W / r.width;     // tiles per on-screen pixel
        const fx = (e.clientX - r.left) * tpp, fy = (e.clientY - r.top) * tpp;
        const tx = Math.floor(fx), ty = Math.floor(fy);
        if (!game.world.inBounds(tx, ty)) return;
        const reach = Math.max(2, 12 * tpp);
        let best = null, bd = Infinity;
        for (const m of list) {
          const d = Math.hypot(m.x + 0.5 - fx, m.y + 0.5 - fy) - (m.big ? 1.5 : 0);
          if (d < reach && d < bd) { bd = d; best = m; }
        }
        sel = best || { x: tx, y: ty, label: game.world.zoneAt(tx, ty)?.name || 'Open ground' };
        render(body);
      });
      body.appendChild(cnv);
      const info = document.createElement('div');
      info.className = 'wm-info';
      if (!sel) {
        info.innerHTML = '<span>Tap the map or a marker to pick where to go. Tap an <b>M</b> station to ride the MRT there; long trips ride part of the way by themselves.</span>';
      } else {
        const dist = Math.max(Math.abs(sel.x - game.player.x), Math.abs(sel.y - game.player.y));
        info.innerHTML = `<span><b>${sel.label}</b> · ${dist} tiles away</span>`;
        const btn = (text, fn, cls = '') => {
          const b = document.createElement('button'); b.className = 'wm-go ' + cls; b.textContent = text;
          b.addEventListener('click', fn); info.appendChild(b);
        };
        if (sel.station) {
          // Still rideable, but warn when the station's region is well above you.
          const rec = zoneLevel(game.world.zoneAt(sel.station.x, sel.station.y)), you = game.fightLevel();
          if (tooHigh(rec, you)) {
            // Quote the Combat level the character panel shows (the threshold uses
            // your best fighting level, so it only warns when even that falls short).
            info.insertAdjacentHTML('beforeend', `<span class="wm-warn">Monsters ${rec}+ · you: combat ${game.skills.combatLevel()}</span>`);
            btn(`Ride MRT anyway (${MRT_FARE} coins)`, () => game.mrtFromMap(sel.station.id), 'ride danger');
          } else btn(`Ride MRT (${MRT_FARE} coins)`, () => game.mrtFromMap(sel.station.id), 'ride');
        }
        if (sel.obj) btn('Go', () => game.goToObject(sel.obj));
        else btn('Travel here', () => { game.travelToTile({ x: sel.x, y: sel.y }); this.closeModal(); });
      }
      body.appendChild(info);
      // On a short laptop screen the buttons can sit below the fold: bring them up.
      if (sel && info.scrollIntoView) requestAnimationFrame(() => info.scrollIntoView({ block: 'nearest' }));
    };
    this.openModal('World Map — Singapore', render);
    this.modal.kind = 'worldmap';
  }

  // ---------------- Minimap ----------------
  /** The whole map's terrain at one pixel per tile, built once (terrain never changes). */
  _minimapTerrain() {
    if (this._miniTerr !== undefined) return this._miniTerr;
    const world = this.game.world, w = world.width, h = world.height;
    if (typeof document === 'undefined') return (this._miniTerr = null);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); if (!c) return (this._miniTerr = null);
    // The painted ground's own colours, soft edges where ground kinds meet (minimapart.js).
    const img = c.createImageData(w, h);
    paintMinimapTerrain(world, img.data);
    c.putImageData(img, 0, 0);
    return (this._miniTerr = cv);
  }

  renderMinimap() {
    // Skip the per-tile scan entirely while the minimap is folded away.
    if (this._collapse && this._collapse.minimap) return;
    // The minimap is called every frame from the main loop; ~7 fps is plenty
    // and keeps the per-tile scan off the hot path.
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this._lastMinimap && now - this._lastMinimap < 140) return;
    this._lastMinimap = now;
    const ctx = this.minimapCtx;
    const game = this.game;
    const dpr = this._mmDpr || 1;
    const W = this._mmSize || this.el.minimap.width, H = W;
    const scale = 4;                 // px per tile
    const MR = W / 2 - 8;            // the map's radius inside the sticker ring
    const radius = Math.ceil(MR / scale);
    const px = game.player.x, py = game.player.y;
    // A small minimap (phones) keeps only the badges you look for most.
    const small = (this.el.minimap.clientWidth || W) < 130;
    const pulse = game.reduceMotion ? 0.5 : (Math.sin(now / 260) + 1) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, MR, 0, Math.PI * 2); ctx.clip();

    // Ground: the sticker map, baked in chunks as you walk into them and then
    // just copied (minimapart.js). Until a chunk is ready the flat
    // one-pixel-per-tile picture shows underneath, scaled up.
    const chunks = this._mmChunks || (this._mmChunks = new MinimapChunks(game.world));
    const terr = this._mmWhole ? null : this._minimapTerrain();
    if (terr) {
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      const side = radius * 2 + 1;
      ctx.drawImage(terr, Math.round(px) - radius, Math.round(py) - radius, side, side,
        W / 2 + (Math.round(px) - px - radius) * scale - scale / 2, H / 2 + (Math.round(py) - py - radius) * scale - scale / 2, side * scale, side * scale);
      ctx.imageSmoothingEnabled = prev;
    }
    this._mmWhole = chunks.draw(ctx, px, py, W, H, scale);
    const inView = (dx, dy) => dx * dx + dy * dy <= (radius + 0.5) * (radius + 0.5);
    // Landmarks: sticker badges for the places you look for (bank, MRT,
    // anvils and furnaces, shrines, stalls); trees, rocks and buildings are
    // in the baked ground. Just those in the minimap's square (spatial index).
    const mmObjs = game.world.objectsIn ? game.world.objectsIn(Math.floor(px - radius), Math.floor(py - radius), Math.ceil(px + radius), Math.ceil(py + radius), this._mmObjs || (this._mmObjs = [])) : game.world.objects;
    const BR = 5.5;   // badge radius
    // One badge stands for a cluster of the same kind within five tiles (a
    // town's anvils and furnaces show once), so the map never fills up with stickers.
    const placed = this._mmPlaced || (this._mmPlaced = []);
    placed.length = 0;
    const badge = (kind, x, y) => {
      if (small && !BADGE_ESSENTIAL.has(kind)) return;
      for (let i = 0; i < placed.length; i += 3) if (placed[i] === kind && (placed[i + 1] - x) ** 2 + (placed[i + 2] - y) ** 2 < 400) return;
      placed.push(kind, x, y);
      const sp = badgeSprite(kind, BR, dpr);
      if (sp) ctx.drawImage(sp, x - sp.width / dpr / 2, y - sp.height / dpr / 2, sp.width / dpr, sp.height / dpr);
    };
    for (const o of mmObjs) {
      const kind = minimapObjectBadge(o);
      if (!kind) continue;
      const dx = o.x - px, dy = o.y - py;
      if (inView(dx, dy)) badge(kind, W / 2 + dx * scale, H / 2 + dy * scale);
    }
    // Ground items: a small pink sparkle on a white edge.
    for (const g of game.world.groundItems) {
      const dx = g.x - px, dy = g.y - py;
      if (!inView(dx, dy)) continue;
      const x = W / 2 + dx * scale, y = H / 2 + dy * scale;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E5484D'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    // NPCs (only nearby ones can be on the minimap): two kinds of dot, red
    // for anything you can fight and cream for everyone else, each on a navy
    // ink edge; bosses and shopkeepers wear a badge instead; people a quest
    // sends you to are kept back and drawn last, bigger, as gold markers on
    // top of the crowd (minimapart.js). Colour-blind friendly: foes get a
    // white ring as well, so they never rely on red against green.
    const quest = this._mmQuest || (this._mmQuest = []);
    quest.length = 0;
    const dots = this._mmDots || (this._mmDots = []);
    dots.length = 0;
    const cb = !!game.colourBlind;
    ctx.fillStyle = MINIMAP_DOT.ink;
    for (const n of (game.nearbyNpcs ? game.nearbyNpcs() : game.npcs)) {
      if (!n.alive) continue;
      const dx = n.x - px, dy = n.y - py;
      if (!inView(dx, dy)) continue;
      const kind = minimapNpcKind(game, n);
      if (kind === 'quest') { quest.push(n); continue; }
      const x = W / 2 + dx * scale, y = H / 2 + dy * scale;
      const nb = minimapNpcBadge(n);
      if (nb) { dots.push(x, y, 2 + (nb === 'boss' ? 0 : nb === 'shop' ? 1 : 2)); continue; }
      dots.push(x, y, kind === 'foe' ? 1 : 0);
      ctx.beginPath(); ctx.arc(x, y, cb && kind === 'foe' ? 3.6 : 3, 0, Math.PI * 2); ctx.fill();   // the ink edges first, in one colour
    }
    if (cb) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < dots.length; i += 3) if (dots[i + 2] === 1) { ctx.beginPath(); ctx.arc(dots[i], dots[i + 1], 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
    for (const kind of [0, 1]) {
      ctx.fillStyle = kind ? (cb ? '#D6336C' : MINIMAP_DOT.foe) : MINIMAP_DOT.friend;
      for (let i = 0; i < dots.length; i += 3) {
        if (dots[i + 2] !== kind) continue;
        ctx.beginPath(); ctx.arc(dots[i], dots[i + 1], kind && cb ? 1.7 : 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let i = 0; i < dots.length; i += 3) if (dots[i + 2] >= 2) badge(['boss', 'shop', 'bank'][dots[i + 2] - 2], dots[i], dots[i + 1]);
    // Your pet, if one follows you: a small lilac dot.
    const pet = game.pets?.follower;
    if (pet && inView(pet.x - px, pet.y - py)) {
      ctx.fillStyle = MINIMAP_DOT.ink; ctx.beginPath(); ctx.arc(W / 2 + (pet.x - px) * scale, H / 2 + (pet.y - py) * scale, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#C7B5F0'; ctx.beginPath(); ctx.arc(W / 2 + (pet.x - px) * scale, H / 2 + (pet.y - py) * scale, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Treasure-trail dig spot (pulsing gold).
    if (game.clue) {
      const spot = game.clue.spots[game.clue.step];
      if (spot) {
        const dx = spot.x - px, dy = spot.y - py;
        if (inView(dx, dy)) {
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath(); ctx.arc(W / 2 + dx * scale, H / 2 + dy * scale, 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }
    drawEventMarker(ctx, game, W, H, px, py, radius, scale, MR - 6);   // a world event: here, or which way (inside the ring)
    // Quest markers on top: a gold diamond with a navy edge in a gently
    // pulsing glow.
    for (const n of quest) {
      const x = W / 2 + (n.x - px) * scale, y = H / 2 + (n.y - py) * scale;
      ctx.fillStyle = `rgba(255,210,74,${(0.25 + pulse * 0.3).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(x, y, 6.5 + pulse * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = MINIMAP_DOT.quest; ctx.strokeStyle = MINIMAP_DOT.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y - 5.5); ctx.lineTo(x + 4.5, y); ctx.lineTo(x, y + 5.5); ctx.lineTo(x - 4.5, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // You: a white arrow pointing the way you face, in a soft halo.
    const f = game.player.facing;
    if (f && (f.dx || f.dy)) this._mmFace = Math.atan2(f.dy, f.dx);
    const want = this._mmFace ?? Math.PI / 2;
    let ang = this._mmAng ?? want;
    ang += Math.atan2(Math.sin(want - ang), Math.cos(want - ang)) * (game.reduceMotion ? 1 : 0.6);   // turn the short way, smoothly
    this._mmAng = ang;
    ctx.fillStyle = 'rgba(34,48,74,0.16)';   // a halo that shows on pale paving and on grass
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 9.5, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = 'rgba(34,48,74,0.3)';
    ctx.beginPath(); ctx.moveTo(0, -5.5 + 1.2); ctx.lineTo(4.6, 5.2 + 1.2); ctx.lineTo(0, 2.6 + 1.2); ctx.lineTo(-4.6, 5.2 + 1.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = MINIMAP_DOT.ink; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.lineTo(4.6, 5.2); ctx.lineTo(0, 2.6); ctx.lineTo(-4.6, 5.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // After dark only a light navy veil: the map stays readable at night.
    const night = 1 - game.daylightFactor();
    if (night > 0.05) {
      ctx.fillStyle = `rgba(20,30,70,${Math.min(0.16, night * 0.2).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    // The sticker ring and its compass, painted once.
    if (this._mmRing === undefined) this._mmRing = minimapRing(W, MR, dpr);
    if (this._mmRing) ctx.drawImage(this._mmRing, 0, 0, W, H);
    // Quest people off the edge of the map: a small gold arrow on the rim
    // pointing the way (the nearest of each, at most three).
    let shown = 0;
    for (const id of questNpcIds(game)) {
      if (shown >= 3) break;
      let best = null, bd = Infinity;
      for (const n of this._trkCandidates('id:' + id, (m) => m.npcId === id)) {
        if (!n.alive) continue;
        const d = (n.x - px) ** 2 + (n.y - py) ** 2;
        if (d < bd) { bd = d; best = n; }
      }
      if (!best || inView(best.x - px, best.y - py)) continue;
      shown++;
      const p = rimPoint(W, H, best.x - px, best.y - py, MR - 6 - pulse * 1.5);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = MINIMAP_DOT.quest; ctx.strokeStyle = MINIMAP_DOT.ink; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5.5); ctx.lineTo(-1.5, 0); ctx.lineTo(-4, 5.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** A shop cell's price tag ("1.2K"), drawn under the cell (compact.css .shop-price). */
function shopPriceEl(coins) {
  const el = document.createElement('span');
  el.className = 'shop-price';
  el.textContent = shortNumber(coins);
  return el;
}
