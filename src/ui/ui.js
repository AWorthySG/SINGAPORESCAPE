import { CLASSES, CLASS_BY_ID, WEAPON_TYPE_NAMES, starterWeapon } from '../data/classes.js';
import { PERK_SKILLS, PERK_TRACKS, PERK_EVERY, trackPerks, rankName } from '../data/perks.js';
import { drawPlayer, heroArtSrc } from '../render/sprites.js';
import { getItem } from '../data/items.js';
import { SHOPS, getShop } from '../data/shops.js';
import { SMELT, SMITH } from '../data/smithing.js';
import { CRAFT } from '../data/crafting.js';
import { POTIONS, FLETCH, CROP_BY_SEED } from '../data/trades.js';
import { COOKING } from '../game/skilling.js';
import { DISHES } from '../data/cooking.js';
import { SKILLS, SKILL_GROUPS } from '../data/skills.js';
import { getDialogue } from '../data/dialogue.js';
import { MONSTER_IDS, BOSS_IDS, getNpc } from '../data/npcs.js';
import { levelProgress, xpToNext } from '../data/xp.js';
import { stackLabel, capitalize, formatNumber } from '../core/utils.js';
import { STYLE_ORDER, STYLES, RANGED_STYLE_ORDER, RANGED_STYLES, DANCE_STYLE_ORDER, DANCE_STYLES, RHYTHM_MAX } from '../game/combat.js';
import { SPELLS } from '../data/magic.js';
import { PRAYERS } from '../data/prayers.js';
import { ACHIEVEMENTS, rewardFor } from '../data/achievements.js';
import { QUESTS } from '../data/quests.js';
import { SLAYER_REWARDS } from '../data/slayer.js';
import { STATIONS, MRT_FARE } from '../data/transport.js';
import { EQUIP_SLOTS, canDualWield } from '../game/equipment.js';
import { streakMult } from '../game/bounty.js';
import { itemCategory } from '../game/inventory.js';
import { MAX_UPGRADE, upgradeCost, upgradeChance, upgradedName } from '../game/upgrade.js';
import { STAT_LABELS, STAT_HELP, compareGear, deltaText, gearBySlot, gearRating, meetsReq, swingBeats, tierOf, weaponStyle } from '../game/gear.js';
import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { clearSave } from '../game/save.js';
import { itemIconSVG, skillIconSVG, tabIconSVG, sunIconSVG, moonIconSVG, abilityIconHTML, prayerIconHTML, spellIconHTML } from '../render/icons.js';
import { weaknessOf } from '../game/combat.js';

const EQUIP_LAYOUT = [
  null, 'head', null,
  'cape', 'amulet', null,
  'weapon', 'body', 'shield',
  null, 'legs', null,
  'hands', 'feet', 'ring',
];

// The Dancer has no painted art yet: draw the in-game Dancer once into an image
// for the class picker (null without a canvas, e.g. in tests).
let _dancerPic;
function dancerPortrait() {
  if (_dancerPic !== undefined) return _dancerPic;
  _dancerPic = null;
  try {
    const cv = document.createElement('canvas'); cv.width = 144; cv.height = 144;
    const c = cv.getContext('2d');
    if (!c) return null;
    c.scale(2.6, 2.6);
    drawPlayer(c, 26, 32, { time: 0, hasWeapon: true, weaponType: 'dance', hasBody: true, hasHelm: true, swingK: -1, facing: { dx: 1, dy: 0 } });
    _dancerPic = cv.toDataURL('image/png');
  } catch { _dancerPic = null; }
  return _dancerPic;
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
      settings: id('settings-panel'),
      contextMenu: id('context-menu'),
      tooltip: id('tooltip'),
      modalOverlay: id('modal-overlay'),
      modalTitle: id('modal-title'),
      modalBody: id('modal-body'),
      modalClose: id('modal-close'),
      banner: id('banner'),
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
    this.minimapCtx = this.el.minimap.getContext('2d');

    // Tab buttons: the mascot icon plus a short label, so each tab is easy to find.
    const TAB_LABELS = { inventory: 'Bag', equipment: 'Gear', skills: 'Skills', combat: 'Combat', prayer: 'Prayer', quests: 'Quests', achievements: 'Awards', settings: 'Settings' };
    document.querySelectorAll('#panel-tabs .tab-btn').forEach((b) => {
      b.innerHTML = tabIconSVG(b.dataset.view, 32) + `<span class="tab-label">${TAB_LABELS[b.dataset.view] || ''}</span>`;
      b.setAttribute('aria-label', b.title || TAB_LABELS[b.dataset.view] || b.dataset.view);
    });
    this.el.panelHead = document.getElementById('panel-head');
    this.el.panelTitle = document.getElementById('panel-title');
    this.el.panelCollapse = document.getElementById('panel-collapse');
    this.el.sidepanel = document.getElementById('sidepanel');
    this._setPanelTitle('inventory');
    // Phones (portrait or landscape): enables the fold-on-retap tab behaviour.
    if (typeof matchMedia === 'function') {
      const mq = matchMedia('(max-width: 540px), (max-height: 500px)');
      const set = () => this.el.sidepanel?.classList.toggle('compact-ui', mq.matches);
      set(); mq.addEventListener?.('change', set);
    }
    this._initCollapsibles();

    this._bindTabs();
    this._bindChatTabs();
    this._buildCombatPanel();
    this._buildPrayerPanel();
    this._buildSettingsPanel();
    this._buildAbilityBar();
    document.getElementById('auto-battle-btn')?.addEventListener('click', () => this.game.toggleAutoBattle());
    document.getElementById('auto-battle-cfg')?.addEventListener('click', () => this.openAutoSettings());
    document.getElementById('interact-btn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); this.game.interact(); });
    this.renderAutoBattle();

    this.el.runOrb.addEventListener('click', () => this.game.toggleRun());
    this.el.specOrb.addEventListener('click', () => this.game.toggleSpec());
    if (this.el.minimap) { this.el.minimap.style.cursor = 'pointer'; this.el.minimap.title = 'Open world map (M)'; this.el.minimap.addEventListener('click', () => this.openWorldMap()); }
    if (this.el.mapBtn) this.el.mapBtn.addEventListener('click', () => this.openWorldMap());
    this.el.modalClose.addEventListener('click', () => this.closeModal());
    this.el.modalOverlay.addEventListener('mousedown', (e) => {
      if (e.target === this.el.modalOverlay) this.closeModal();
    });
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
    this.bus.on('inventory', () => this.scheduleInventory());
    this.bus.on('equipment', () => { this.renderEquipment(); this.renderCombatPanel(); this.scheduleInventory(); });
    this.bus.on('rhythm', () => { if (this.game.combatMode() === 'dance') this.renderCombatPanel(); });
    this.bus.on('skills', () => { this.renderSkills(); this.renderCombatPanel(); });
    this.bus.on('xp', (p) => { this.renderSkills(); this.showXpDrop(p); });
    this.bus.on('levelup', (p) => this.onLevelUp(p));
    this.bus.on('chat', (p) => this.addChat(p.text, p.cls));
    this.bus.on('hp', () => this.renderHp());
    this.bus.on('run', () => this.renderRun());
    this.bus.on('spec', () => this.renderSpec());
    this.bus.on('equipment', () => { this.renderSpec(); this.renderAbilities(); });
    this.bus.on('adrenaline', () => this.renderAbilities());
    this.bus.on('ability', () => this.renderAbilities());
    this.bus.on('autobattle', () => this.renderAutoBattle());
    this.bus.on('karma', () => { this.renderAlignment(); this._refreshModalIfOpen(['shop']); });
    this.bus.on('prayer', () => { this.renderPrayer(); this.renderPrayerPanel(); });
    this.bus.on('skills', () => this.renderPrayerPanel());
    this.bus.on('quest', () => { this.renderQuestPanel(); this.renderTracker(); });
    this.bus.on('bounties', () => { this.renderQuestPanel(); this.renderTracker(); });
    this.bus.on('xpbonus', () => this.renderTracker());
    this.bus.on('spell', () => this.renderCombatPanel());
    this.bus.on('achievement', () => this.renderAchievementPanel());
    this.bus.on('slayer', () => { this._refreshModalIfOpen(['slayer', 'slayerRewards']); this.renderTracker(); });
    this.bus.on('bank', () => this._refreshModalIfOpen(['bank']));

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
      btn.title = `${ab.name} (${ab.key}) — ${ab.cost}% adrenaline\n${ab.desc}`;
      btn.innerHTML =
        `<span class="ab-key">${ab.key}</span>` +
        `<span class="ab-icon">${abilityIconHTML(ab.id, 36)}</span>` +
        `<span class="ab-cost">${ab.cost}</span>` +
        `<span class="ab-cd"></span>`;
      btn.addEventListener('click', () => this.game.activateAbility(ab.id));
      wrap.appendChild(btn);
      this._abilityBtns[ab.id] = btn;
    }
  }

  /** Label the Interact button with what it will do right now. */
  setInteractLabel(label) {
    const btn = this.el.interact || (this.el.interact = document.getElementById('interact-btn'));
    if (!btn) return;
    const key = label ? label[0] : '';
    if (key === this._interactKey) return;
    this._interactKey = key;
    btn.classList.toggle('idle', !label);
    btn.querySelector('.ib-verb').textContent = label ? label[0] : 'Interact';
  }

  renderAutoBattle() {
    const btn = this.el.autoBattle || (this.el.autoBattle = document.getElementById('auto-battle-btn'));
    if (!btn) return;
    const on = this.game.autoBattle;
    btn.classList.toggle('active', on);
    btn.closest('.auto-row')?.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const st = btn.querySelector('.ab-status');
    if (st) st.textContent = this.game.autoStatus();
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
      row('Targets', 'who auto battle goes for first', [[true, 'Bosses & champions'], [false, 'Nearest']], cfg.priority !== false, (v) => { cfg.priority = v; });
      row('Attack skills', 'spend adrenaline on your skills', [[true, 'Use them'], [false, 'Save adrenaline']], cfg.abilities, (v) => { cfg.abilities = v; });
      body.appendChild(list);
      const hint = document.createElement('div'); hint.className = 'modal-hint';
      hint.textContent = 'Auto battle always steps out of boss attack markers, braces against heavy blows and picks your strongest spell. Steering pauses it; press T to switch it on or off.';
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
      const ready = unlocked && cd <= 0 && g.adrenaline >= ab.cost;
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
    const g = this.game;
    const rows = [];
    const xb = g.xpBreakdown();
    if (xb.total > 1.001) {
      const parts = [];
      if (xb.wildLevel) parts.push(`Wild lvl ${xb.wildLevel}`);
      if (xb.streakKills > 1) parts.push(`streak ${xb.streakKills}`);
      if (xb.night > 1) parts.push('night');
      rows.push(`<div class="trk-row trk-xp"><span class="trk-ic">&#10022;</span><b>XP &times;${xb.total.toFixed(2)}</b> <span class="trk-prog">${parts.join(' · ')}</span></div>`);
    }
    if (g.slayer && g.slayer.task) {
      const t = g.slayer.task;
      rows.push(`<div class="trk-row"><span class="trk-ic trk-slayer">&#9760;</span>${t.remaining} ${escapeHtml(t.name)}${this._trkPointer((n) => n.def.family === t.family)}</div>`);
    }
    // Today's unfinished bounties (up to two), each with a pointer to the nearest target.
    for (const t of (g.bounties?.list || []).filter((x) => !x.done).slice(0, 2)) {
      rows.push(`<div class="trk-row"><span class="trk-ic trk-bounty">&#9733;</span>${escapeHtml(t.name)} <span class="trk-prog">${t.have}/${t.need}</span>${this._trkPointer((n) => n.npcId === t.id)}</div>`);
    }
    for (const q of QUESTS) {
      const st = g.quests[q.id];
      if (st && st.state === 'active') {
        const p = q.progress ? q.progress(g) : '';
        rows.push(`<div class="trk-row"><span class="trk-ic trk-quest">!</span>${escapeHtml(q.name)}${p ? ` <span class="trk-prog">${escapeHtml(p)}</span>` : ''}</div>`);
        break; // show one active quest at a time to stay compact
      }
    }
    el.innerHTML = rows.length ? `<div class="trk-title">Objectives</div>${rows.join('')}` : '';
    el.classList.toggle('hidden', rows.length === 0);
  }

  /** Arrow + distance from the player to the nearest living monster matching `pred`. */
  _trkPointer(pred) {
    const g = this.game, p = g.player;
    let best = null, bd = Infinity;
    for (const n of g.npcs) {
      if (!n.alive || !pred(n)) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) return '';
    if (bd <= 6) return '<span class="trk-dist here">here</span>';
    const deg = Math.round(Math.atan2(best.y - p.y, best.x - p.x) * 180 / Math.PI);
    return `<span class="trk-arrow" style="transform:rotate(${deg}deg)">&#10148;</span><span class="trk-dist">${Math.round(bd)}m</span>`;
  }

  // ---------------- Tabs ----------------
  _setPanelTitle(view) {
    const el = this.el.panelTitle || this.el.panelHead;
    if (!el) return;
    const titles = { inventory: 'Inventory', equipment: 'Worn Equipment', skills: 'Skills', combat: 'Combat', prayer: 'Prayers', quests: 'Quest Journal', achievements: 'Achievements', settings: 'Settings' };
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
    const apply = (collapsed) => {
      panel.classList.toggle('collapsed', collapsed);
      btn.innerHTML = collapsed ? '&#9656;' : '&#9662;'; // ▸ collapsed / ▾ expanded
      btn.title = `${collapsed ? 'Expand' : 'Collapse'} ${label}`;
    };
    // Small screens start with the big panels folded (the game needs the room);
    // a saved choice always wins.
    const compact = typeof matchMedia === 'function' && matchMedia('(max-width: 540px), (max-height: 500px)').matches;
    if (this._collapse[key] === undefined && compact && (key === 'panel' || key === 'chat')) this._collapse[key] = true;
    apply(!!this._collapse[key]);
    this._collapseApply = this._collapseApply || {};
    this._collapseApply[key] = (c) => { this._collapse[key] = c; apply(c); this._saveCollapse(); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._collapse[key] = !panel.classList.contains('collapsed');
      apply(this._collapse[key]);
      this._saveCollapse();
    });
  }

  _loadCollapse() {
    try { return JSON.parse(localStorage.getItem('ss_ui_collapse')) || {}; } catch { return {}; }
  }

  _saveCollapse() {
    try { localStorage.setItem('ss_ui_collapse', JSON.stringify(this._collapse)); } catch {}
  }

  _bindTabs() {
    const tabs = document.querySelectorAll('#panel-tabs .tab-btn');
    const views = document.querySelectorAll('#panel-body .panel-view');
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        // A folded panel opens on the tab you tap; tapping the open tab again folds it.
        const panel = document.getElementById('sidepanel');
        const folded = panel?.classList.contains('collapsed');
        if (folded) this._collapseApply?.panel?.(false);
        else if (btn.classList.contains('active') && panel?.classList.contains('compact-ui')) { this._collapseApply?.panel?.(true); return; }
        tabs.forEach((b) => b.classList.toggle('active', b === btn));
        const view = btn.dataset.view;
        this._setPanelTitle(view);
        views.forEach((v) => v.classList.toggle('hidden', v.dataset.view !== view));
        // The skills list carries a name + description per row, so it gets more room.
        document.getElementById('sidepanel')?.classList.toggle('wide', view === 'skills');
      });
    });
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
    const wild = wildLevel > 0;
    if (this.el.region) {
      this.el.region.innerHTML = `<span class="loc-pin">&#128205;</span> ${escapeHtml(name)}` +
        (wild ? ` <span class="wild-lvl">Lvl ${wildLevel}</span>` : '');
      this.el.region.classList.toggle('wild', wild);
    }
    if (this.el.minimapRegion) {
      this.el.minimapRegion.textContent = wild ? `${name} (Lvl ${wildLevel})` : name;
      this.el.minimapRegion.classList.toggle('wild', wild);
    }
  }

  // ---------------- Hover text ----------------
  setHoverText(verb, target = '', extra = '') {
    const str = verb ? `${verb}|${target}|${extra}` : '';
    if (str === this._lastHover) return;
    this._lastHover = str;
    if (!verb) { this.el.hover.innerHTML = ''; return; }
    this.el.hover.innerHTML =
      `${escapeHtml(verb)} <span class="target">${escapeHtml(target)}</span>` +
      (extra ? ` <span class="extra">${escapeHtml(extra)}</span>` : '');
  }

  // ---------------- Chat ----------------
  addChat(text, cls = 'game') {
    this.chatMessages.push({ text, cls });
    if (this.chatMessages.length > 120) this.chatMessages.shift();
    const div = document.createElement('div');
    div.className = `msg ${cls}`;
    div.textContent = text;
    div.dataset.cls = cls;
    this.el.chatLog.appendChild(div);
    while (this.el.chatLog.childElementCount > 120) this.el.chatLog.removeChild(this.el.chatLog.firstChild);
    this._applyVisibility(div);
    this.el.chatLog.scrollTop = this.el.chatLog.scrollHeight;
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
        return `<b>${item.name}</b><br><span style="opacity:.8">${item.examine}</span>` + (item.equip ? this._gearTip(sl.id) : '');
      }, () => this._invOptions(i));
      cell._sig = null;
      grid.appendChild(cell);
      cells.push(cell);
    }
    while (cells.length > slots.length) cells.pop().remove();
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const cell = cells[i];
      // Category tabs show only matching items (coins count as "Other").
      const show = f === 'all' || (s && (itemCategory(s.id) === 'coins' ? 'other' : itemCategory(s.id)) === f);
      cell.style.display = show ? '' : 'none';
      let sig = 'empty';
      let up = 0, better = false;
      if (s) {
        const item = getItem(s.id);
        if (item.equip) {
          up = this.game.equipment.upgradeLevel(s.id);
          const cmp = compareGear(s.id, this.game.equipment);
          better = (cmp.verdict === 'upgrade' || cmp.verdict === 'empty') && meetsReq(s.id, this.game.skills).ok;
        }
        sig = `${s.id}|${s.qty}|${up}|${better ? 1 : 0}`;
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
      if (up) html += `<span class="up-badge">+${up}</span>`;
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
    else if (item.tags?.includes('log')) this.game.lightLogs(i);
    else if (s.id === 'bones') this.game.buryBones(i);
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
      const dual = canDualWield(s.id) && canDualWield(this.game.equipment.get('weapon'));
      if (dual) {
        // Holding a dagger already: choose which hand the new one goes in.
        opts.push({ label: 'Wield in off-hand', target: item.name, fn: () => this.game.equipOffhand(i) });
        opts.push({ label: 'Wield in main hand', target: item.name, fn: () => this.game.equipItem(i, { offhand: false }) });
      } else opts.push({ label: item.equip.slot === 'weapon' ? 'Wield' : 'Wear', target: item.name, fn: () => this.game.equipItem(i) });
    }
    if (item.tags?.includes('log')) opts.push({ label: 'Light', target: item.name, fn: () => this.game.lightLogs(i) });
    if (s.id === 'bones') {
      opts.push({ label: s.qty > 1 ? `Bury ${Math.min(100, s.qty)}` : 'Bury', target: item.name, fn: () => this.game.buryBones(i) });
      if (s.qty > 100) opts.push({ label: `Bury all ${s.qty}`, target: item.name, fn: () => this.game.buryBones(i, Infinity) });
      if (s.qty > 1) opts.push({ label: 'Bury one', target: item.name, fn: () => this.game.buryBones(i, 1) });
    }
    if (s.id === 'mark_of_grace') opts.push({ label: 'Use', target: item.name, fn: () => this.game.useMarkOfGrace(i) });
    if (s.id.startsWith('clue_scroll_')) opts.push({ label: 'Read', target: item.name, fn: () => this.game.readClue(i) });
    if (s.id.startsWith('reward_casket_')) opts.push({ label: 'Open', target: item.name, fn: () => this.game.openCasket(i) });
    if (s.id === 'birds_nest') opts.push({ label: 'Open', target: item.name, fn: () => this.game.openNest(i) });
    // Alchemy, once you can cast it and carry (or wield the staff for) nature runes.
    if (s.id !== 'coins' && item.value && !item.tags?.includes('rune') && this.game.skills.magic >= 21
      && (this.game.inventory.count('nature_rune') > 0 || this.game.freeRune() === 'nature_rune')) {
      opts.push({ label: 'Alchemise', target: `${item.name} (${this.game.alchemyValue(s.id)} coins)`, fn: () => this.game.alchemise(i) });
    }
    opts.push({ label: 'Drop', target: item.name, fn: () => this.game.dropItem(i) });
    opts.push({ label: 'Examine', target: item.name, fn: () => this.game.msg(item.examine, 'system') });
    return opts;
  }

  // ---------------- Equipment ----------------
  renderEquipment() {
    const layout = this.el.equipLayout;
    layout.innerHTML = '';
    for (const slot of EQUIP_LAYOUT) {
      const cell = document.createElement('div');
      if (!slot) { cell.className = 'equip-slot empty'; cell.style.visibility = 'hidden'; layout.appendChild(cell); continue; }
      const id = this.game.equipment.get(slot);
      if (id) {
        const item = getItem(id);
        cell.className = 'equip-slot filled';
        cell.innerHTML = itemIconSVG(id, 32);
        const lv = this.game.equipment.upgradeLevel(id);
        if (lv) cell.insertAdjacentHTML('beforeend', `<span class="up-badge">+${lv}</span>`);
        cell.addEventListener('click', () => this.game.unequip(slot));
        this._tip(cell, () => `<b>${item.name}</b>${this._gearTip(id)}<br><span style="opacity:.8">Tap to remove</span>`,
          () => [{ label: 'Remove', target: item.name, fn: () => this.game.unequip(slot) }]);
      } else {
        cell.className = 'equip-slot empty';
        cell.textContent = capitalize(slot);
      }
      layout.appendChild(cell);
    }
    const b = this.game.equipment.bonuses();
    const speed = this.game.equipment.weaponSpeed();
    const sets = this.game.equipment.activeSets();
    const wid = this.game.equipment.get('weapon');
    let specLine = '';
    try { const sp = wid && getItem(wid).spec; if (sp) specLine = `<div class="row"><span>Special</span><span>${sp.name} (${sp.cost}%)</span></div>`; } catch {}
    this.el.equipBonuses.innerHTML =
      `<div class="row"><span>Attack bonus</span><span>+${b.attack}</span></div>` +
      `<div class="row"><span>Strength bonus</span><span>+${b.strength}</span></div>` +
      `<div class="row"><span>Defence bonus</span><span>+${b.defence}</span></div>` +
      (b.ranged ? `<div class="row"><span>Ranged bonus</span><span>+${b.ranged}</span></div>` : '') +
      (b.magic ? `<div class="row"><span>Magic bonus</span><span>+${b.magic}</span></div>` : '') +
      (b.crit ? `<div class="row"><span>Crit chance</span><span>+${b.crit}%</span></div>` : '') +
      (b.hp ? `<div class="row"><span>Bonus HP</span><span>+${b.hp}</span></div>` : '') +
      `<div class="row"><span>Attack speed</span><span>${(speed * 0.3).toFixed(1)}s</span></div>` +
      specLine +
      (sets.length ? `<div class="row set-bonus"><span>Set bonus</span><span>${sets.join(', ')}</span></div>` : '');
    const guide = document.createElement('button');
    guide.className = 'bestiary-open gear-guide-open';
    guide.textContent = 'Gear Guide: which equipment is better?';
    guide.addEventListener('click', () => this.openGearGuide());
    this.el.equipBonuses.appendChild(guide);
    const up = document.createElement('button');
    up.className = 'bestiary-open gear-guide-open';
    up.textContent = 'Upgrade gear (+1 to +10)';
    up.addEventListener('click', () => this.openUpgrade());
    this.el.equipBonuses.appendChild(up);
  }

  /** Stat chips for one piece of gear, e.g. "+12 Defence · 1.2s". */
  _gearStats(id, base = false) {
    const eq = getItem(id).equip;
    const b = base ? (eq.bonuses || {}) : this.game.equipment.itemBonuses(id);
    const chips = Object.keys(STAT_LABELS).filter((k) => b[k]).map((k) => `+${b[k]} ${STAT_LABELS[k]}`);
    if (eq.slot === 'weapon') chips.push(`${capitalize(weaponStyle(id))}, ${(swingBeats(id) * 0.3).toFixed(1)}s swing`);
    if (eq.range) chips.push(`${eq.range}-tile range`);
    if (eq.runes) chips.push(`Unlimited ${getItem(eq.runes).name.toLowerCase()}s`);
    return chips.join(' · ') || 'No combat stats';
  }

  /** Tooltip block for equipment: stats, tier in its slot, requirements and
   *  how it compares with what's worn. */
  _gearTip(id) {
    const eq = getItem(id).equip;
    const t = tierOf(id);
    const req = meetsReq(id, this.game.skills);
    const reqTxt = Object.entries(eq.req || {}).filter(([, l]) => l > 1).map(([k, l]) => `${capitalize(k)} ${l}`).join(', ');
    const lv = this.game.equipment.upgradeLevel(id);
    let html = (lv ? `<div class="gt-up">Upgraded +${lv}</div>` : '') + `<div class="gt-stats">${this._gearStats(id)}</div>`
      + `<div class="gt-tier">#${t.rank} of ${t.of} ${eq.slot === 'weapon' ? weaponStyle(id) + ' weapons' : eq.slot + ' items'}</div>`;
    if (reqTxt) html += `<div class="gt-req ${req.ok ? 'ok' : 'no'}">Needs ${reqTxt}${req.ok ? ' ✓' : ''}</div>`;
    const cmp = compareGear(id, this.game.equipment);
    if (cmp.verdict === 'worn') return html + '<div class="gt-verdict same">Currently worn</div>';
    const vs = cmp.worn ? ` vs ${escapeHtml(getItem(cmp.worn).name)}` : '';
    const label = { upgrade: '▲ Upgrade', downgrade: '▼ Downgrade', same: '= Same strength', empty: '▲ Fills an empty slot', style: '⇄ Different fighting style' }[cmp.verdict];
    html += `<div class="gt-verdict ${cmp.verdict}">${label}${vs}</div>`;
    if (cmp.deltas.length && cmp.worn) html += `<div class="gt-deltas">${cmp.deltas.map((d) => {
      const good = d.lowerIsBetter ? d.delta < 0 : d.delta > 0;
      return `<span class="${good ? 'pos' : 'neg'}">${deltaText([d])}</span>`;
    }).join(' ')}</div>`;
    return html;
  }

  // ---------------- Gear upgrades ----------------
  openUpgrade() {
    const g = this.game;
    const render = (body) => {
      body.innerHTML = '<div class="gear-intro"><p>Spend coins (and metal bars, for metal gear) to make an item stronger: each level adds about 8% to its stats. '
        + 'Levels belong to the item type, so every copy you own shares them. Up to +5 always works; after that it can fail, which only uses up the materials.</p></div>';
      const ids = [...new Set([...EQUIP_SLOTS.map((s) => g.equipment.get(s)).filter(Boolean),
        ...g.inventory.slots.filter((s) => s && getItem(s.id).equip).map((s) => s.id)])];
      const list = document.createElement('div');
      list.className = 'gear-list';
      if (!ids.length) list.innerHTML = '<div class="modal-hint">Wear or carry some gear to upgrade it.</div>';
      for (const id of ids) {
        const lv = g.equipment.upgradeLevel(id);
        const row = document.createElement('div');
        row.className = 'gear-row';
        let costHtml = '<b>Fully upgraded</b>';
        let can = false;
        if (lv < MAX_UPGRADE) {
          const c = upgradeCost(id, lv + 1);
          const okC = g.inventory.count('coins') >= c.coins;
          const okB = !c.bar || g.inventory.count(c.bar.id) >= c.bar.qty;
          can = okC && okB;
          costHtml = `<span class="${okC ? '' : 'short'}">${formatNumber(c.coins)} coins</span>`
            + (c.bar ? ` · <span class="${okB ? '' : 'short'}">${c.bar.qty} x ${escapeHtml(getItem(c.bar.id).name)}</span>` : '')
            + ` · ${Math.round(upgradeChance(lv + 1) * 100)}% success`;
        }
        const worn = EQUIP_SLOTS.some((s) => g.equipment.get(s) === id);
        row.innerHTML = `<span class="gear-ic">${itemIconSVG(id, 28)}</span>`
          + `<div class="gear-info"><div class="gear-name"><b>${escapeHtml(upgradedName(id, lv))}</b>${worn ? '<span class="gear-tag worn">Wearing</span>' : ''}</div>`
          + `<div class="gear-stats">${this._gearStats(id)}</div><div class="gear-stats">Next: ${costHtml}</div></div>`;
        if (lv < MAX_UPGRADE) {
          const b = document.createElement('button');
          b.className = 'gear-tab' + (can ? ' active' : '');
          b.textContent = `+${lv + 1}`;
          b.disabled = !can;
          b.addEventListener('click', () => { g.upgradeItem(id); render(body); });
          row.appendChild(b);
        }
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('Upgrade Gear', render);
  }

  // ---------------- Gear guide ----------------
  // Every equippable item per slot, ranked best first, with what it needs and
  // whether you already own it — so players can see which equipment is better.
  openGearGuide(slot = 'weapon') {
    const g = this.game;
    let style = g.equipment.combatType();
    const render = (body) => {
      body.innerHTML = '';
      const intro = document.createElement('div');
      intro.className = 'gear-intro';
      intro.innerHTML = '<p>Each slot is ranked <b>best first</b> by its <b>gear score</b>: total bonuses, with weapons counted as damage per swing, so a fast sword can beat a slow axe. Look for the green <span class="gear-up-inline">▲</span> in your pack. It marks gear that beats what you are wearing.</p>'
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
        b.addEventListener('click', () => { slot = s; render(body); });
        tabs.appendChild(b);
      }
      body.appendChild(tabs);
      let ids = bySlot[slot] || [];
      const myCls = CLASS_BY_ID[g.jobClass];
      if (slot === 'weapon' && myCls) {
        // A job class can only wield its own weapon type, so list just those.
        const note = document.createElement('div');
        note.className = 'modal-hint';
        note.innerHTML = `As a <b>${myCls.name}</b> you can wield <b>${WEAPON_TYPE_NAMES[myCls.weapon]}</b>. Other weapons you find are worth selling.`;
        body.appendChild(note);
        ids = ids.filter((id) => getItem(id).equip?.weaponType === myCls.weapon);
      } else if (slot === 'weapon') {
        // Weapons only compare fairly within a fighting style.
        const st = document.createElement('div');
        st.className = 'gear-tabs gear-styles';
        for (const k of ['melee', 'ranged', 'magic', 'dance']) {
          const b = document.createElement('button');
          b.className = 'gear-tab small' + (k === style ? ' active' : '');
          b.textContent = k === 'dance' ? 'Dancer' : capitalize(k);
          b.addEventListener('click', () => { style = k; render(body); });
          st.appendChild(b);
        }
        body.appendChild(st);
        ids = ids.filter((id) => weaponStyle(id) === style);
      }
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
        const row = document.createElement('div');
        row.className = 'gear-row' + (id === worn ? ' is-worn' : '') + (req.ok ? '' : ' locked');
        row.innerHTML = `<span class="gear-rank">#${i + 1}</span><span class="gear-ic">${itemIconSVG(id, 28)}</span>`
          + `<div class="gear-info"><div class="gear-name"><b>${escapeHtml(it.name)}</b>${tag}</div>`
          + `<div class="gear-stats">${this._gearStats(id, true)}${reqTxt && req.ok ? ` · <i>req ${reqTxt}</i>` : ''}</div></div>`
          + `<span class="gear-score" title="Gear score">${gearRating(id)}</span>`;
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
    grid.innerHTML = '';
    // One labelled row per skill (icon, name, what it's for, level), grouped
    // into Combat / Gathering / Making / Other.
    const perkBtn = document.createElement('button');
    perkBtn.className = 'perks-open';
    perkBtn.innerHTML = '<b>Passive perks</b><span>A new perk every 20 levels in a fighting skill</span>';
    perkBtn.addEventListener('click', () => this.openPerks());
    grid.appendChild(perkBtn);
    for (const grp of SKILL_GROUPS) {
      const head = document.createElement('div');
      head.className = 'skill-group';
      head.textContent = grp.name;
      grid.appendChild(head);
      for (const sk of SKILLS.filter((x) => x.group === grp.id)) {
        const lvl = this.game.skills.level(sk.id);
        const xp = this.game.skills.xp[sk.id];
        const cell = document.createElement('div');
        cell.className = 'skill-cell';
        cell.innerHTML =
          `<span class="skill-icon">${skillIconSVG(sk.id, 36)}</span>` +
          `<span class="skill-text"><b class="skill-name">${sk.name}</b><span class="skill-desc">${sk.desc || ''}</span>` +
          (PERK_SKILLS.includes(sk.id) ? `<span class="skill-perks">${Math.min(10, Math.floor(lvl / PERK_EVERY))}/10 perks${lvl >= 220 ? ' · ranked up' : ''}</span>` : '') + `</span>` +
          `<span class="skill-lvl"><span class="cur">${lvl}</span></span>` +
          `<div class="xp-bar" style="width:${Math.round(levelProgress(xp) * 100)}%"></div>`;
        const toNext = xpToNext(xp);
        this._tip(cell, `<b>${sk.name}</b> &mdash; level ${lvl}<br>XP: ${formatNumber(Math.floor(xp))}<br>` +
          (toNext > 0 ? `Next level: ${formatNumber(toNext)} xp` : 'Maxed!'));
        grid.appendChild(cell);
      }
    }
    this.el.skillsTotal.textContent = `Total level: ${this.game.skills.totalLevel()}`;
    this.renderAlignment();
  }

  /** Every perk track: what each perk does, its rank, and when the next rank unlocks. */
  openPerks() {
    const g = this.game;
    const NAMES = { attack: 'Attack', strength: 'Strength', defence: 'Defence', ranged: 'Ranged', magic: 'Magic', agility: 'Agility (Dancer)' };
    let tab = PERK_SKILLS.find((s) => g.skills.level(s) >= PERK_EVERY) || 'attack';
    const render = (body) => {
      body.innerHTML = '<div class="modal-hint">Every 20 levels in a fighting skill unlocks that skill\'s next passive perk. After level 200 the perks rank up again (Rank II at 220, III at 420...) until level 999. Defence perks help in every style.</div>';
      const tabs = document.createElement('div'); tabs.className = 'gear-tabs';
      for (const s of PERK_SKILLS) {
        const b = document.createElement('button');
        b.className = 'gear-tab' + (s === tab ? ' active' : '');
        b.textContent = `${NAMES[s].split(' ')[0]} ${g.skills.level(s)}`;
        b.addEventListener('click', () => { tab = s; render(body); });
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
          + `<span class="perk-next">${next <= 999 ? `${p.rank ? 'Rank up' : 'Unlocks'} at ${next}` : 'Max rank'}</span>`;
        list.appendChild(row);
      }
      body.appendChild(list);
    };
    this.openModal('Passive Perks', render);
    this.modal.kind = 'perks';
  }

  // ---------------- Good / evil alignment ----------------
  renderAlignment() {
    const el = this.el.alignment || (this.el.alignment = document.getElementById('alignment-readout'));
    if (!el) return;
    const g = this.game;
    const { title, cls } = g.alignmentTitle();
    const good = g.karma.good, evil = g.karma.evil, total = good + evil || 1;
    const goodPct = Math.round((good / total) * 100);
    el.className = `align-${cls}`;
    el.innerHTML =
      `<div class="align-head">Alignment: <b>${title}</b> <span class="align-net">(${g.alignment() >= 0 ? '+' : ''}${g.alignment()})</span></div>` +
      `<div class="align-bar"><span class="align-good" style="width:${goodPct}%"></span></div>` +
      `<div class="align-legend"><span class="ag-good">Good ${good}</span><span class="ag-evil">Evil ${evil}</span></div>`;
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
  renderCombatPanel() {
    if (!this._styleRow) return;
    const mode = this.game.combatMode();
    const p = this.game.player;
    const row = this._styleRow;
    row.innerHTML = '';
    row.classList.toggle('spells', mode === 'magic');
    if (mode === 'magic') {
      for (const sp of SPELLS) {
        const known = this.game.skills.magic >= sp.level;
        const btn = document.createElement('div');
        btn.className = 'style-btn spell' + (p.spell === sp.id ? ' active' : '');
        const cost = Object.entries(sp.runes).map(([id, q]) => `${q}${id.replace('_rune', '').slice(0, 3)}`).join(' ');
        btn.innerHTML = `<span class="sp-ic">${spellIconHTML(sp.id, 26)}</span><span class="sp-text">${sp.name}<span class="style-skill">L${sp.level} · max ${sp.maxHit} · ${escapeHtml(cost)}</span></span>`;
        btn.style.opacity = known ? (this.game._hasRunes(sp) ? '1' : '0.65') : '0.35';
        if (known) btn.addEventListener('click', () => { p.spell = sp.id; this.renderCombatPanel(); });
        row.appendChild(btn);
      }
    } else {
      const order = mode === 'ranged' ? RANGED_STYLE_ORDER : mode === 'dance' ? DANCE_STYLE_ORDER : STYLE_ORDER;
      const map = mode === 'ranged' ? RANGED_STYLES : mode === 'dance' ? DANCE_STYLES : STYLES;
      const cur = mode === 'ranged' ? p.rangedStyle : mode === 'dance' ? p.danceStyle : p.style;
      for (const id of order) {
        const st = map[id];
        const btn = document.createElement('div');
        btn.className = 'style-btn' + (cur === id ? ' active' : '');
        const xpLabel = mode === 'ranged' ? (id === 'longrange' ? 'Ranged + Defence' : 'Ranged XP')
          : mode === 'dance' ? (id === 'twirl' ? 'Agility + Defence, dodge more' : 'Agility XP') : `${capitalize(st.skill)} XP`;
        btn.innerHTML = `${st.name}<span class="style-skill">${xpLabel}</span>`;
        btn.addEventListener('click', () => {
          if (mode === 'ranged') p.rangedStyle = id; else if (mode === 'dance') p.danceStyle = id; else p.style = id;
          this.renderCombatPanel();
        });
        row.appendChild(btn);
      }
    }
    const modeLabel = mode === 'ranged' ? 'Ranged' : mode === 'magic' ? 'Magic' : mode === 'dance' ? `Dancer &middot; Rhythm ${this.game.danceRhythm}/${RHYTHM_MAX}` : 'Melee';
    const cls = CLASS_BY_ID[this.game.jobClass];
    const clsLabel = cls ? `<div class="cb-class">Class: <b>${cls.name}</b> &middot; ${WEAPON_TYPE_NAMES[cls.weapon]}</div>` : '';
    this.el.combat.querySelector('.cb-level').innerHTML = `${clsLabel}Combat level: ${this.game.skills.combatLevel()} <span style="opacity:.7">&middot; ${modeLabel}</span>`;
    const cb = this.el.combat.querySelector('#auto-retal-cb');
    if (cb) cb.checked = p.autoRetaliate;
  }

  // ---------------- First-time tips ----------------
  // One small, dismissible tip at a time, each shown once (remembered on this device).
  _tipsTick() {
    const g = this.game;
    if (this._tipEl || this.modal || g.pendingStyleChoice || g.pendingClassChoice || !g.player.alive) return;
    if (!this._tipsSeen) { try { this._tipsSeen = new Set(JSON.parse(localStorage.getItem(TIPS_KEY) || '[]')); } catch { this._tipsSeen = new Set(); } }
    const p = g.player;
    const want = (id, cond) => !this._tipsSeen.has(id) && cond();
    let id = null;
    if (want('dodge', () => g.hazards.length > 0)) id = 'dodge';
    else if (want('move', () => g.tickCount > 3)) id = 'move';
    else if (want('champion', () => g.npcs.some((n) => n.alive && n.champion && Math.abs(n.x - p.x) <= 10 && Math.abs(n.y - p.y) <= 10))) id = 'champion';
    else if (want('auto', () => g.totalKills >= 1)) id = 'auto';
    else if (want('gear', () => g.tickCount % 5 === 0 && g.inventory.slots.some((s) => s && getItem(s.id).equip
      && compareGear(s.id, g.equipment).verdict === 'upgrade' && meetsReq(s.id, g.skills).ok))) id = 'gear';
    else if (want('bounty', () => g.tickCount > 150)) id = 'bounty';
    else if (want('upgrade', () => g.inventory.count('coins') >= 3000)) id = 'upgrade';
    if (id) this.showTip(id);
  }

  showTip(id) {
    const el = document.createElement('div');
    el.id = 'tip-toast';
    el.innerHTML = `<span class="tip-badge">Tip</span><div class="tip-text">${TIPS[id]}</div>`;
    const ok = document.createElement('button');
    ok.textContent = 'Got it';
    const done = () => {
      this._tipsSeen.add(id);
      try { localStorage.setItem(TIPS_KEY, JSON.stringify([...this._tipsSeen])); } catch {}
      el.remove(); this._tipEl = null;
    };
    ok.addEventListener('click', done);
    el.appendChild(ok);
    document.body.appendChild(el);
    this._tipEl = el;
    clearTimeout(this._tipTimer);
    this._tipTimer = setTimeout(() => { if (this._tipEl === el) done(); }, id === 'dodge' ? 6000 : 14000);
  }

  // ---------------- Settings ----------------
  _buildSettingsPanel() {
    const p = this.el.settings;
    p.innerHTML = '';
    const mk = (label, fn, danger) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (danger) b.className = 'danger';
      b.addEventListener('click', fn);
      p.appendChild(b);
      return b;
    };
    mk('Save game now', () => { import('../game/save.js').then((m) => { m.saveGame(this.game); this.game.msg('Game saved.', 'system'); }); });
    mk('Toggle run', () => this.game.toggleRun());
    const soundBtn = mk('', () => {
      const a = this.game.audio;
      if (!a) return;
      a.unlock();
      const muted = a.toggle();
      soundBtn.textContent = `Sound: ${muted ? 'Off' : 'On'}`;
    });
    soundBtn.textContent = `Sound: ${this.game.audio && this.game.audio.muted ? 'Off' : 'On'}`;
    const musicBtn = mk('', () => {
      const a = this.game.audio;
      if (!a) return;
      a.unlock();
      const on = a.toggleMusic();
      musicBtn.textContent = `Music: ${on ? 'On' : 'Off'}`;
    });
    musicBtn.textContent = `Music: ${this.game.audio && this.game.audio.musicOn ? 'On' : 'Off'}`;
    // Volume slider.
    const vol = document.createElement('label');
    vol.className = 'set-slider';
    const pct = Math.round((this.game.audio?.volume ?? 1) * 100);
    vol.innerHTML = `<span>Volume <b>${pct}%</b></span><input type="range" min="0" max="100" step="5" value="${pct}">`;
    vol.querySelector('input').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      vol.querySelector('b').textContent = `${v}%`;
      const a = this.game.audio;
      if (a) { a.unlock(); a.setVolume(v / 100); }
    });
    vol.querySelector('input').addEventListener('change', () => this.game.audio?.play('pickup'));
    p.appendChild(vol);
    const gfxBtn = mk('', () => {
      this.game.lowFx = !this.game.lowFx;
      try { localStorage.setItem('singaporescape:gfx', this.game.lowFx ? 'low' : 'high'); } catch {}
      gfxBtn.textContent = `Graphics: ${this.game.lowFx ? 'Low (faster)' : 'High'}`;
      window.dispatchEvent(new Event('resize'));   // re-size the canvas for the new quality
    });
    gfxBtn.textContent = `Graphics: ${this.game.lowFx ? 'Low (faster)' : 'High'}`;
    mk('Show tips again', () => {
      try { localStorage.removeItem(TIPS_KEY); } catch {}
      this._tipsSeen = new Set();
      this.game.msg('Tips will show again as you play.', 'system');
    });
    mk('Delete save & restart', () => {
      if (confirm('Delete your saved character and start over?')) { clearSave(); location.reload(); }
    }, true);
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.innerHTML = 'Move: joystick or W A S D / arrow keys. Interact with the nearest thing: the Interact button, E or Space. P pickpockets, T toggles auto battle.<br>' +
      'Stand by a tree to chop, a rock to mine, the water to fish, or a monster to fight, then press Interact.<br>' +
      'In combat, build <b>Adrenaline</b> and spend it on abilities (Z/X/C/V): ' +
      'Power Strike, Flurry, Brace and Second Wind. Hit each foe\'s <b>weakness</b> ' +
      '(melee/ranged/magic) and <b>Brace</b> when a monster winds up a heavy blow (!).<br>' +
      'Eat food to heal. Bank your loot. Your progress auto-saves.';
    p.appendChild(hint);
  }

  // ---------------- Boss battle bar ----------------
  updateBossBar() {
    const g = this.game;
    if (!this.el.bossBar) return;
    const p = g.player;
    // The boss we're engaged with: fighting us, being fought, or freshly hurt.
    // Champions get the bar too, in gold.
    const boss = g.npcs.find((n) => n.alive && (n.def.boss || n.champion) &&
      Math.abs(n.x - p.x) <= 16 && Math.abs(n.y - p.y) <= 16 &&
      (n.target === p || p.target === n || n.combatLatch > 0));
    const on = !!boss && p.alive;
    document.body.classList.toggle('boss-on', on);   // lets the tracker/tips move out of its way
    if (!on) { this.el.bossBar.classList.add('hidden'); return; }
    this.el.bossBar.classList.remove('hidden');
    this.el.bossBar.classList.toggle('champion', !!boss.champion);
    const warn = g.hazards.some((h) => h.npc === boss);
    this.el.bossBar.classList.toggle('warn', warn);
    this.el.bossBarName.textContent = warn ? '⚠ Get out of the red!'
      : `${boss.champion ? '★ ' : ''}${boss.name} — level ${boss.def.level} · ${Math.ceil(boss.hp)}/${boss.maxHp}`;
    this.el.bossBarFill.style.width = `${Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100))}%`;
    this.el.bossBar.classList.toggle('enraged', !!boss.enraged);
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
    this.el.daynightBadge.title = `${night ? 'Night' : 'Day'} · ${g.clockLabel()}`;
  }

  // ---------------- Orbs ----------------
  renderHp() {
    const hp = this.game.player.hp;
    const max = this.game.maxHp();
    this.el.hpOrbVal.textContent = hp;
    const frac = max ? hp / max : 1;
    const hue = Math.round(120 * frac);
    this.el.hpOrb.style.color = `hsl(${hue}, 90%, 65%)`;
    this.el.hpOrb.classList.toggle('low', frac <= 0.25 && this.game.player.alive);
  }

  renderRun() {
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
    this.el.specOrb.style.color = `hsl(${Math.round(e * 1.2)}, 85%, 62%)`;
    this.el.specOrb.title = hasSpec
      ? `Special: ${getItem(id).spec.name} (${getItem(id).spec.cost}%) — click to arm`
      : 'Special attack (needs a spec weapon)';
  }

  // ---------------- Prayer ----------------
  renderPrayer() {
    if (this.el.prayerOrbVal) this.el.prayerOrbVal.textContent = Math.ceil(this.game.prayerPoints);
    if (this.el.prayerOrb) {
      const max = this.game.maxPrayer();
      const frac = max ? this.game.prayerPoints / max : 0;
      this.el.prayerOrb.style.color = `hsl(48, 90%, ${Math.round(45 + frac * 25)}%)`;
      this.el.prayerOrb.classList.toggle('active', this.game.activePrayers.size > 0);
    }
  }

  _buildPrayerPanel() {
    this.el.prayerPanel.innerHTML = '<div class="prayer-pts"></div><div class="prayer-grid"></div>';
    this._prayerGrid = this.el.prayerPanel.querySelector('.prayer-grid');
    const labels = { att: 'Att', str: 'Str', def: 'Def', ranged: 'Rng', magic: 'Mag' };
    for (const pr of PRAYERS) {
      const cell = document.createElement('div');
      cell.className = 'prayer-cell';
      cell.dataset.prayer = pr.id;
      const effect = pr.protect
        ? `-${Math.round(pr.protect * 100)}% melee dmg`
        : Object.keys(labels).filter((k) => pr[k]).map((k) => `+${Math.round(pr[k] * 100)}% ${labels[k]}`).join(' ');
      cell.innerHTML = `<span class="pr-ic">${prayerIconHTML(pr.id, 30)}</span><span class="pr-text"><b>${pr.name}</b><span>Lvl ${pr.level} · ${effect}</span></span>`;
      cell.addEventListener('click', () => this.game.togglePrayer(pr.id));
      this._prayerGrid.appendChild(cell);
    }
  }

  renderPrayerPanel() {
    if (!this._prayerGrid) return;
    const lvl = this.game.skills.prayer;
    this.el.prayerPanel.querySelector('.prayer-pts').textContent =
      `Prayer points: ${Math.ceil(this.game.prayerPoints)} / ${this.game.maxPrayer()}`;
    for (const cell of this._prayerGrid.children) {
      const pr = PRAYERS.find((p) => p.id === cell.dataset.prayer);
      cell.classList.toggle('active', this.game.activePrayers.has(pr.id));
      cell.classList.toggle('locked', lvl < pr.level);
    }
  }

  // ---------------- Quest journal ----------------
  renderQuestPanel() {
    const game = this.game;
    const status = (s) => s === 'done' ? '<span class="q-done">Complete</span>'
      : s === 'active' ? '<span class="q-active">In progress</span>'
        : '<span class="q-todo">Not started</span>';
    const done = QUESTS.filter((d) => game.quests[d.id]?.state === 'done').length;
    let html = '';
    const b = game.bounties;
    if (b && b.list.length) {
      const mult = Math.round((streakMult(b.streak) - 1) * 100);
      html += `<div class="quest-head">Daily bounties &middot; streak ${b.streak} day${b.streak === 1 ? '' : 's'}${mult ? ` (+${mult}% pay)` : ''}</div>`;
      for (const t of b.list) {
        const pct = Math.min(100, Math.round((t.have / t.need) * 100));
        html += `<div class="quest-row bounty-row${t.done ? ' done' : ''}"><b>${escapeHtml(t.name)}</b>`
          + (t.done ? '<span class="q-done">Paid</span>' : `<span class="q-active">${t.have}/${t.need}</span>`)
          + `<span class="q-desc">Defeat ${t.need}${t.zone ? ` in ${escapeHtml(t.zone)}` : ''} &middot; ${formatNumber(Math.round(t.reward * streakMult(b.streak)))} coins</span>`
          + `<div class="bounty-bar"><i style="width:${pct}%"></i></div></div>`;
      }
      html += '<div class="modal-hint">New bounties every day. Finish all three for a bonus, and on back-to-back days to grow your streak.</div>';
    }
    html += `<div class="quest-head">Quests complete: ${done} / ${QUESTS.length} &middot; Quest points: ${game.questPoints()}</div>`;
    for (const d of QUESTS) {
      const st = game.quests[d.id]?.state || 'notStarted';
      let prog = '';
      if (d.progress) { try { prog = d.progress(game); } catch { prog = ''; } }
      html += `<div class="quest-row"><b>${escapeHtml(d.name)}</b>${status(st)}` +
        `<span class="q-desc">${escapeHtml(d.desc)}${prog ? ` <span class="q-prog">(${escapeHtml(prog)})</span>` : ''}</span></div>`;
    }
    this.el.questPanel.innerHTML = html;
  }

  // ---------------- Achievements / collection log ----------------
  renderAchievementPanel() {
    const panel = this.el.achievementPanel;
    if (!panel) return;
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
        html += `<div class="ach-cell ${done ? 'done' : 'locked'}" title="${escapeHtml(a.desc)}">` +
          `<b>${escapeHtml(a.name)}</b><span class="ach-desc">${escapeHtml(a.desc)}</span>` +
          `<span class="ach-reward">&#9733; ${formatNumber(rewardFor(a.id))}</span>` +
          (done ? '<span class="ach-tick">&#10003;</span>' : (prog ? `<span class="ach-prog">${escapeHtml(prog)}</span>` : '')) +
          `</div>`;
      }
      html += '</div>';
    }
    panel.innerHTML = html;
    const btn = document.createElement('button');
    btn.className = 'bestiary-open';
    const ids = MONSTER_IDS.length + BOSS_IDS.length;
    const seen = [...MONSTER_IDS, ...BOSS_IDS].filter((id) => (game.kills[id] || 0) > 0).length;
    btn.textContent = `Open Bestiary (${seen}/${ids})`;
    btn.addEventListener('click', () => this.openBestiary());
    panel.insertBefore(btn, panel.firstChild);
  }

  // ---------------- Bestiary / collection log ----------------
  openBestiary() {
    const ids = [...BOSS_IDS, ...MONSTER_IDS];
    const render = (body) => {
      const seen = ids.filter((id) => (this.game.kills[id] || 0) > 0).length;
      body.innerHTML = `<div class="modal-hint">Discovered ${seen} / ${ids.length} creatures.</div>`;
      const search = document.createElement('input');
      search.className = 'bank-search'; search.placeholder = 'Search creatures…'; search.value = this._bestSearch || '';
      search.addEventListener('input', () => {
        this._bestSearch = search.value; render(body);
        const n = body.querySelector('.bank-search'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
      });
      body.appendChild(search);
      const list = document.createElement('div'); list.className = 'bestiary-list';
      const term = (this._bestSearch || '').trim().toLowerCase();
      let shown = 0;
      for (const id of ids) {
        const d = getNpc(id);
        if (term && !d.name.toLowerCase().includes(term)) continue;
        if (++shown > 120) break; // cap rows for performance; narrow via search
        const k = this.game.kills[id] || 0;
        const drops = (d.dropTable || []).filter((x) => !x.nothing).map((x) => x.id);
        const dropHtml = k
          ? (drops.length ? drops.slice(0, 10).map((did) => `<span class="b-drop" title="${escapeHtml(getItem(did).name)}">${itemIconSVG(did, 20)}</span>`).join('') : '<span class="b-hidden">No notable drops.</span>')
          : '<span class="b-hidden">Defeat one to reveal its drops.</span>';
        const row = document.createElement('div');
        row.className = 'bestiary-row' + (k ? '' : ' undiscovered');
        const weak = k ? `<span class="b-weak">weak: ${weaknessOf(d)}</span>` : '';
        const abil = d.ability ? `<div class="b-ability"><b>${escapeHtml(d.ability.name)}:</b> ${escapeHtml(d.ability.desc)}</div>` : '';
        row.innerHTML = `<div class="b-head"><b>${escapeHtml(d.name)}</b><span class="b-lvl">Lvl ${d.level}${d.boss ? ' · Boss' : ''}</span>${weak}<span class="b-kc">${k} kills</span></div>${abil}<div class="b-drops">${dropHtml}</div>`;
        list.appendChild(row);
      }
      if (!shown) { const e = document.createElement('div'); e.className = 'modal-hint'; e.textContent = 'No creatures match your search.'; list.appendChild(e); }
      body.appendChild(list);
    };
    this.openModal('Bestiary', render);
    this.modal.kind = 'bestiary';
  }

  // ---------------- XP drops / level up ----------------
  // Fast combat earns XP several times a second, so drops for the same skill
  // merge into one rising pill for ~0.8s, and at most 4 show at once.
  showXpDrop({ skill, amount }) {
    this._xpLive = this._xpLive || {};
    const now = performance.now();
    const live = this._xpLive[skill];
    if (live && now - live.t < 800 && live.div.isConnected) {
      live.total += amount;
      live.div.querySelector('.xp-amt').textContent = `+${Math.round(live.total)}`;
      return;
    }
    const div = document.createElement('div');
    div.className = 'xp-drop';
    div.innerHTML = `<span class="xp-ic">${skillIconSVG(skill, 20)}</span><span class="xp-amt">+${Math.round(amount)}</span>`;
    this.el.xpDrops.appendChild(div);
    this._xpLive[skill] = { div, total: amount, t: now };
    while (this.el.xpDrops.children.length > 4) this.el.xpDrops.firstElementChild.remove();
    setTimeout(() => div.remove(), 2300);
  }

  onLevelUp({ skill, level }) {
    const sk = SKILLS.find((s) => s.id === skill);
    this.addChat(`Congratulations, you just advanced a ${sk.name} level! You are now level ${level}.`, 'level');
    this.showBanner(`<span class="big">Level up!</span>Your ${sk.name} is now level ${level}.`);
    this.renderSkills();
    this.scheduleInventory();   // a new level can unlock gear (green upgrade arrows)
  }

  showBanner(html) {
    this.el.banner.innerHTML = html;
    this.el.banner.classList.remove('hidden');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.el.banner.classList.add('hidden'), 3200);
  }

  // ---------------- Context menu ----------------
  showContextMenu(x, y, options) {
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
  showTooltip(e, html) {
    const t = this.el.tooltip;
    t.innerHTML = html;
    t.classList.remove('hidden');
    this.moveTooltip(e);
  }

  moveTooltip(e) {
    const t = this.el.tooltip;
    t.style.left = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8) + 'px';
    t.style.top = Math.min(e.clientY + 14, window.innerHeight - t.offsetHeight - 8) + 'px';
  }

  hideTooltip() {
    if (this._cardOpen) return;            // a held-open touch card stays until you tap away
    this.el.tooltip.classList.add('hidden');
  }

  /** Details on hover (mouse) or press-and-hold (touch). On touch the details open
   *  as a card with the item's actions as buttons, since phones can't hover. */
  _tip(el, html, actions) {
    const get = () => (typeof html === 'function' ? html() : html);
    el.addEventListener('mouseenter', (e) => { if (this._touchUsed) return; const h = get(); if (h) this.showTooltip(e, h); });
    el.addEventListener('mousemove', (e) => { if (!this._touchUsed) this.moveTooltip(e); });
    el.addEventListener('mouseleave', () => this.hideTooltip());
    let timer = 0, sx = 0, sy = 0, fired = false, touching = false;
    const open = () => {
      if (fired) return;
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
    this.modal = { title, render };
    this.el.modalTitle.textContent = title;
    this.el.modalOverlay.classList.remove('hidden');
    render(this.el.modalBody);
  }

  /** One-time, non-dismissible prompt: pick a job class. A new character gets its
   *  class's kit; an older save keeps its gear. The choice is permanent. */
  openStyleChoice() {
    const g = this.game;
    const STYLES = [
      { id: 'melee', name: 'Melee', art: 'assets/creatures/hero/melee.webp', blurb: 'Fight up close (most weapons reach 2 tiles).' },
      { id: 'ranged', name: 'Ranged', art: 'assets/creatures/hero/ranged.webp', blurb: 'Shoot from far away. Starts with 999 arrows.' },
      { id: 'magic', name: 'Magic', art: 'assets/creatures/hero/magic.webp', blurb: 'Cast spells from a distance. Starts with runes.' },
      { id: 'dance', name: 'Dance', art: null, blurb: 'Lash from 3 tiles, build Rhythm and dodge blows.' },
    ];
    const render = (body) => {
      body.innerHTML = `<div class="dialogue path-intro">${g.pendingClassChoice ? 'Choose your job class. You keep your gear, but from now on you can only wield your class\'s weapon type.' : 'Choose your job class. Each class masters one weapon type.'} <b>This choice is permanent.</b></div>`;
      for (const st of STYLES) {
        const sec = document.createElement('div');
        sec.className = 'class-section';
        const pic = st.art ? `<img src="${st.art}" alt="" width="40" height="40">` : (dancerPortrait() ? `<img src="${dancerPortrait()}" alt="" width="40" height="40">` : '');
        sec.innerHTML = `<div class="class-head">${pic}<b>${st.name}</b><span>${st.blurb}</span></div>`;
        const grid = document.createElement('div');
        grid.className = 'dialogue-options class-grid';
        for (const c of CLASSES.filter((x) => x.style === st.id)) {
          const div = document.createElement('div');
          div.className = 'dialogue-option class-card';
          div.tabIndex = 0;
          div.dataset.cls = c.id;
          const art = heroArtSrc(c.id);
          div.innerHTML = `<span class="class-pic">${art ? `<img src="${art}" alt="" width="40" height="40">` : itemIconSVG(starterWeapon(c.id), 34)}</span><span class="class-text"><b>${c.name}</b>`
            + `<span class="class-weapon">${WEAPON_TYPE_NAMES[c.weapon]}</span><span class="class-desc">${c.desc}</span></span>`;
          div.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); div.click(); } });
          div.addEventListener('click', () => {
            g.chooseClass(c.id);
            if (this.modal) this.modal.locked = false; // a choice has been made — safe to close now
            this.closeModal();
            this.renderCombatPanel();
          });
          grid.appendChild(div);
        }
        sec.appendChild(grid);
        body.appendChild(sec);
      }
    };
    this.openModal('Choose Your Class', render);
    this.modal.locked = true;
    if (this.el.modalClose) this.el.modalClose.classList.add('hidden');
  }


  closeModal() {
    if (this.modal?.locked) return; // e.g. the starting-style choice — must pick one
    this.modal = null;
    this.el.modalOverlay.classList.add('hidden');
    this.el.modalBody.innerHTML = '';
    if (this.el.modalClose) this.el.modalClose.classList.remove('hidden');
  }

  _refreshModalIfOpen(types) {
    if (this.modal && types.includes(this.modal.kind)) this.modal.render(this.el.modalBody);
  }

  // Bank ---------------------------------------------------------------
  openBank() {
    const render = (body) => {
      body.innerHTML = '';
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
      search.addEventListener('input', () => {
        this._bankSearch = search.value;
        render(body);
        const next = body.querySelector('.bank-search');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      });
      bankHead.appendChild(search);
      bankSide.appendChild(bankHead);
      const bankGrid = document.createElement('div');
      bankGrid.className = 'item-grid';
      const term = (this._bankSearch || '').trim().toLowerCase();
      const shown = term
        ? this.game.bank.items.filter((e) => getItem(e.id).name.toLowerCase().includes(term))
        : this.game.bank.items;
      for (const e of shown) {
        bankGrid.appendChild(this._cell(e.id, e.qty, {
          onClick: () => this.game.withdraw(e.id, 1),
          onRight: (ev) => this.showContextMenu(ev.clientX, ev.clientY, [
            { label: 'Withdraw 1', fn: () => this.game.withdraw(e.id, 1) },
            { label: 'Withdraw 5', fn: () => this.game.withdraw(e.id, 5) },
            { label: 'Withdraw 10', fn: () => this.game.withdraw(e.id, 10) },
            { label: 'Withdraw All', fn: () => this.game.withdraw(e.id, e.qty) },
          ]),
        }));
      }
      bankSide.appendChild(bankGrid);
      if (!shown.length) {
        const empty = document.createElement('div');
        empty.className = 'modal-hint';
        empty.textContent = term ? 'No matching items.' : 'Your bank is empty.';
        bankSide.appendChild(empty);
      }
      // Inventory side
      const invSide = document.createElement('div');
      const invHead = document.createElement('div');
      invHead.className = 'modal-section-title bank-head';
      invHead.innerHTML = '<span>Inventory</span>';
      const depAll = document.createElement('button');
      depAll.className = 'bank-deposit-all';
      depAll.textContent = 'Deposit all';
      depAll.addEventListener('click', () => this.game.depositAll());
      invHead.appendChild(depAll);
      invSide.appendChild(invHead);
      const invGrid = document.createElement('div');
      invGrid.className = 'item-grid';
      this.game.inventory.slots.forEach((s, i) => {
        if (!s) return;
        invGrid.appendChild(this._cell(s.id, s.qty, {
          onClick: () => this.game.deposit(s.id, s.qty),
          onRight: (ev) => this.showContextMenu(ev.clientX, ev.clientY, [
            { label: 'Deposit 1', fn: () => this.game.deposit(s.id, 1) },
            { label: 'Deposit 5', fn: () => this.game.deposit(s.id, 5) },
            { label: 'Deposit All', fn: () => this.game.deposit(s.id, this.game.inventory.count(s.id)) },
          ]),
        }));
      });
      invSide.appendChild(invGrid);
      cols.appendChild(bankSide);
      cols.appendChild(invSide);
      body.appendChild(cols);
      const hint = document.createElement('div');
      hint.className = 'modal-hint';
      hint.textContent = 'Left-click to withdraw/deposit one. Right-click for amounts.';
      body.appendChild(hint);
    };
    this.openModal('Bank of Singapore', render);
    this.modal.kind = 'bank';
  }

  // Shop ---------------------------------------------------------------
  openShop(shopId) {
    const shop = getShop(shopId);
    const render = (body) => {
      body.innerHTML = `<div class="modal-hint">Coins: ${formatNumber(this.game.inventory.count('coins'))}</div>`;
      const cols = document.createElement('div');
      cols.className = 'modal-cols';
      // Shop stock
      const shopSide = document.createElement('div');
      shopSide.innerHTML = '<div class="modal-section-title">For sale</div>';
      const shopGrid = document.createElement('div');
      shopGrid.className = 'item-grid shop';
      for (const entry of shop.stock) {
        const price = Math.max(1, Math.round(getItem(entry.id).value * shop.buyMul * this.game.karmaFactor().buy));
        shopGrid.appendChild(this._cell(entry.id, entry.qty, {
          tooltip: `<b>${getItem(entry.id).name}</b><br>Buy: ${price} coins`,
          onClick: () => this.game.buyItem(shopId, entry.id, 1),
          onRight: (ev) => this.showContextMenu(ev.clientX, ev.clientY, [
            { label: `Buy 1 (${price})`, fn: () => this.game.buyItem(shopId, entry.id, 1) },
            { label: 'Buy 5', fn: () => this.game.buyItem(shopId, entry.id, 5) },
            { label: 'Buy 10', fn: () => this.game.buyItem(shopId, entry.id, 10) },
            { label: 'Value', fn: () => this.game.msg(`${getItem(entry.id).name}: ${price} coins.`, 'system') },
          ]),
        }));
      }
      shopSide.appendChild(shopGrid);
      // Player inventory (sell)
      const invSide = document.createElement('div');
      invSide.innerHTML = '<div class="modal-section-title">Sell from inventory</div>';
      const invGrid = document.createElement('div');
      invGrid.className = 'item-grid shop';
      this.game.inventory.slots.forEach((s) => {
        if (!s || s.id === 'coins') return;
        const sell = Math.max(1, Math.round(getItem(s.id).value * shop.sellMul * this.game.karmaFactor().sell));
        invGrid.appendChild(this._cell(s.id, s.qty, {
          tooltip: `<b>${getItem(s.id).name}</b><br>Sell: ${sell} coins`,
          onClick: () => this.game.sellItem(shopId, s.id, 1),
          onRight: (ev) => this.showContextMenu(ev.clientX, ev.clientY, [
            { label: `Sell 1 (${sell})`, fn: () => this.game.sellItem(shopId, s.id, 1) },
            { label: 'Sell 5', fn: () => this.game.sellItem(shopId, s.id, 5) },
            { label: 'Sell All', fn: () => this.game.sellItem(shopId, s.id, this.game.inventory.count(s.id)) },
          ]),
        }));
      });
      invSide.appendChild(invGrid);
      cols.appendChild(shopSide);
      cols.appendChild(invSide);
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
      body.innerHTML = '<div class="modal-hint">Choose what to cook. You\'ll cook until you run out.</div>';
      if (raws.length) {
        const grid = document.createElement('div');
        grid.className = 'item-grid';
        for (const rawId of raws) {
          const cook = COOKING[rawId];
          grid.appendChild(this._cell(rawId, this.game.inventory.count(rawId), {
            tooltip: `<b>${getItem(cook.result).name}</b><br>Cooking lvl ${cook.level}, ${cook.xp} xp`,
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
          row.innerHTML = `<span class="row-ic">${itemIconSVG(d.result, 22)}</span> <b>${getItem(d.result).name}</b> <span style="opacity:.75">(lvl ${d.level} &mdash; ${needs})</span>`;
          row.addEventListener('click', () => { this.game.startDish(obj, d); this.closeModal(); });
          list.appendChild(row);
        }
        body.appendChild(list);
      }
    };
    this.openModal('Cooking', render);
    this.modal.kind = 'cook';
  }

  // Smelting -----------------------------------------------------------
  openSmeltMenu(obj) {
    const render = (body) => {
      body.innerHTML = '<div class="modal-hint">Smelt ore into bars.</div>';
      const list = document.createElement('div');
      for (const r of SMELT) {
        const can = r.inputs.every((inp) => this.game.inventory.has(inp.id, inp.qty)) && this.game.skills.level('smithing') >= r.level;
        const row = document.createElement('div');
        row.className = 'dialogue-option';
        row.style.opacity = can ? '1' : '0.5';
        const needs = r.inputs.map((inp) => `${inp.qty} ${getItem(inp.id).name}`).join(' + ');
        row.innerHTML = `<span class="row-ic">${itemIconSVG(r.result, 22)}</span> <b>${getItem(r.result).name}</b> <span style="opacity:.75">(lvl ${r.level} &mdash; ${needs})</span>`;
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
      body.innerHTML = '<div class="modal-hint">Craft pottery and jewelry from gathered materials.</div>';
      const list = document.createElement('div');
      for (const r of CRAFT) {
        const hasTool = !r.tool || this.game.hasTool(r.tool);
        const can = hasTool && r.inputs.every((inp) => this.game.inventory.has(inp.id, inp.qty)) && this.game.skills.level('crafting') >= r.level;
        const row = document.createElement('div');
        row.className = 'dialogue-option';
        row.style.opacity = can ? '1' : '0.5';
        const needs = r.inputs.map((inp) => `${inp.qty} ${getItem(inp.id).name}`).join(' + ');
        row.innerHTML = `<span class="row-ic">${itemIconSVG(r.result, 22)}</span> <b>${getItem(r.result).name}</b> <span style="opacity:.75">(lvl ${r.level} &mdash; ${needs}${r.tool ? ', chisel' : ''})</span>`;
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
      for (const r of recipes) {
        const hasTool = !r.tool || g.hasTool(r.tool);
        const can = hasTool && g.skills.level(skill) >= r.level && r.inputs.every(([id, n]) => g.inventory.has(id, n));
        const row = document.createElement('div');
        row.className = 'dialogue-option';
        row.style.opacity = can ? '1' : '0.5';
        const needs = r.inputs.map(([id, n]) => `${n} ${getItem(id).name}`).join(' + ');
        row.innerHTML = `<span class="row-ic">${itemIconSVG(r.result, 22)}</span> <b>${r.qty > 1 ? r.qty + ' ' : ''}${getItem(r.result).name}</b> <span style="opacity:.75">(lvl ${r.level} &mdash; ${needs}${r.tool ? ', knife' : ''})</span>`;
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
      body.innerHTML = '<div class="modal-hint">Hammer bars into equipment.</div>';
      const list = document.createElement('div');
      for (const r of SMITH) {
        const can = this.game.inventory.has(r.bar, r.barCount) && this.game.skills.level('smithing') >= r.level && this.game.hasTool('hammer');
        const row = document.createElement('div');
        row.className = 'dialogue-option';
        row.style.opacity = can ? '1' : '0.5';
        row.innerHTML = `<span class="row-ic">${itemIconSVG(r.result, 22)}</span> <b>${getItem(r.result).name}</b> <span style="opacity:.75">(lvl ${r.level} &mdash; ${r.barCount} ${getItem(r.bar).name})</span>`;
        row.addEventListener('click', () => { this.game.startSmith(r, obj); this.closeModal(); });
        list.appendChild(row);
      }
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
      const opts = document.createElement('div');
      opts.className = 'dialogue-options';
      const mk = (label, fn) => { const d = document.createElement('div'); d.className = 'dialogue-option'; d.textContent = label; d.addEventListener('click', fn); opts.appendChild(d); };
      if (!t) mk('Give me a Slayer task', () => g.assignSlayerTask());
      else mk('Cancel my current task', () => g.cancelSlayerTask());
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
    const tree = getDialogue(npc.def.dialogue);
    if (!tree) { this.game.msg(`${npc.name} has nothing to say.`); return; }
    const show = (nodeId) => {
      const node = tree[nodeId];
      if (!node || nodeId === 'end') { this.closeModal(); return; }
      const render = (body) => {
        body.innerHTML = `<div class="dialogue"><div class="speaker">${escapeHtml(node.speaker)}</div>${escapeHtml(node.text)}</div>`;
        const opts = document.createElement('div');
        opts.className = 'dialogue-options';
        for (const o of node.options) {
          const div = document.createElement('div');
          div.className = 'dialogue-option';
          div.textContent = o.label;
          div.addEventListener('click', () => {
            if (o.action) this.game.handleDialogueAction(o.action);
            show(o.next || 'end');
          });
          opts.appendChild(div);
        }
        body.appendChild(opts);
      };
      if (!this.modal) this.openModal(npc.name, render);
      else { this.modal.render = render; render(this.el.modalBody); }
    };
    this.openModal(npc.name, () => {});
    this.modal.kind = 'dialogue';
    show('start');
  }

  // Shared item cell ---------------------------------------------------
  _cell(id, qty, { onClick, onRight, tooltip } = {}) {
    const item = getItem(id);
    const cell = document.createElement('div');
    cell.className = 'item-cell';
    cell.innerHTML = `<span>${itemIconSVG(id, 30)}</span>`;
    if (item.stackable || qty > 1) {
      const lbl = stackLabel(qty);
      const q = document.createElement('span'); q.className = 'qty'; q.textContent = lbl.text;
      cell.appendChild(q);
    }
    if (onClick) cell.addEventListener('click', onClick);
    if (onRight) cell.addEventListener('contextmenu', (e) => { e.preventDefault(); onRight(e); });
    this._tip(cell, tooltip || `<b>${item.name}</b><br><span style="opacity:.8">${item.examine || ''}</span>`);
    return cell;
  }

  // ---------------- World map (full overview) ----------------
  openWorldMap() {
    const game = this.game;
    const W = game.world.width, H = game.world.height;
    const render = (body) => {
      body.innerHTML = '';
      const scale = Math.max(2, Math.floor(Math.min((Math.min(window.innerWidth * 0.9, 620)) / W, (window.innerHeight * 0.66) / H)));
      const cnv = document.createElement('canvas');
      cnv.width = W * scale; cnv.height = H * scale;
      cnv.className = 'worldmap-canvas';
      const c = cnv.getContext('2d');
      const colors = {
        [TERRAIN.GRASS]: '#3f6e2c', [TERRAIN.DARKGRASS]: '#365f25', [TERRAIN.PATH]: '#9c8456',
        [TERRAIN.WATER]: '#2f6f9e', [TERRAIN.SAND]: '#c8b27a', [TERRAIN.STONE]: '#8a8378', [TERRAIN.WOOD]: '#7a5a36',
      };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        c.fillStyle = colors[game.world.terrainAt(x, y)] || '#3f6e2c';
        c.fillRect(x * scale, y * scale, scale, scale);
      }
      // notable objects
      for (const o of game.world.objects) {
        let col = null, big = false;
        const t = o.def.type;
        if (t === 'bank') { col = '#ffd24a'; big = true; }
        else if (t === 'transport') { col = '#ffffff'; big = true; }
        else if (t === 'shrine') { col = '#6aa0ff'; big = true; }
        else if (t === 'rest') { col = '#f5a623'; big = true; }
        else if (t === 'fishing') col = '#7fd8ff';
        else if (t === 'tree' && !o.depleted) col = '#1f5a1f';
        else if (t === 'rock' && !o.depleted) col = '#cfcfcf';
        if (!col) continue;
        c.fillStyle = col;
        const s = big ? scale + 2 : scale;
        c.fillRect(o.x * scale - (big ? 1 : 0), o.y * scale - (big ? 1 : 0), s, s);
      }
      // zone labels
      c.font = `800 ${Math.max(9, scale * 3)}px Nunito,"Trebuchet MS",sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      // Nudge labels apart where neighbouring regions' names would overlap.
      const placed = [];
      for (const z of game.world.zones) {
        const cx = ((z.x0 + z.x1) / 2) * scale;
        let cy = ((z.y0 + z.y1) / 2) * scale;
        const w2 = c.measureText(z.name).width / 2 + 3, h = Math.max(9, scale * 3) + 2;
        while (placed.some((b) => Math.abs(b.cx - cx) < b.w2 + w2 && Math.abs(b.cy - cy) < h)) cy += h;
        placed.push({ cx, cy, w2 });
        c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(z.name, cx + 1, cy + 1);
        c.fillStyle = z.wilderness ? '#ff8a7a' : '#fff3c8'; c.fillText(z.name, cx, cy);
      }
      c.textAlign = 'start'; c.textBaseline = 'alphabetic';
      // player marker
      const px = game.player.x * scale + scale / 2, py = game.player.y * scale + scale / 2;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, scale + 1.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d8324a'; c.beginPath(); c.arc(px, py, scale, 0, Math.PI * 2); c.fill();
      // Click anywhere to travel there.
      cnv.addEventListener('click', (e) => {
        const r = cnv.getBoundingClientRect();
        const tx = Math.floor((e.clientX - r.left) / (r.width / W));
        const ty = Math.floor((e.clientY - r.top) / (r.height / H));
        if (game.world.inBounds(tx, ty)) { game.walkToFar({ x: tx, y: ty }); this.closeModal(); }
      });
      body.appendChild(cnv);
      const legend = document.createElement('div');
      legend.className = 'modal-hint worldmap-legend';
      legend.innerHTML = 'Click the map to travel. &nbsp; <b style="color:#d8324a">●</b> You &nbsp; <b style="color:#ffd24a">▪</b> Bank &nbsp; <b style="color:#fff">▪</b> MRT &nbsp; <b style="color:#6aa0ff">▪</b> Monument &nbsp; <b style="color:#f5a623">▪</b> Obelisk &nbsp; <b style="color:#7fd8ff">▪</b> Fishing';
      body.appendChild(legend);
    };
    this.openModal('World Map — Singapore', render);
    this.modal.kind = 'worldmap';
  }

  // ---------------- Minimap ----------------
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
    const W = this.el.minimap.width, H = this.el.minimap.height;
    const scale = 4;                 // px per tile
    const radius = Math.ceil(W / scale / 2);
    const px = game.player.x, py = game.player.y;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); ctx.clip();

    const colors = {
      [TERRAIN.GRASS]: '#3f6e2c', [TERRAIN.DARKGRASS]: '#365f25', [TERRAIN.PATH]: '#9c8456',
      [TERRAIN.WATER]: '#2f6f9e', [TERRAIN.SAND]: '#c8b27a', [TERRAIN.STONE]: '#8a8378', [TERRAIN.WOOD]: '#7a5a36',
    };
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = px + dx, ty = py + dy;
        if (!game.world.inBounds(tx, ty)) continue;
        ctx.fillStyle = colors[game.world.terrainAt(tx, ty)] || '#3f6e2c';
        ctx.fillRect(W / 2 + dx * scale - scale / 2, H / 2 + dy * scale - scale / 2, scale, scale);
      }
    }
    // Objects (notable ones).
    for (const o of game.world.objects) {
      const dx = o.x - px, dy = o.y - py;
      if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue;
      let col = null;
      if (o.def.type === 'tree' && !o.depleted) col = '#1f5a1f';
      else if (o.def.type === 'rock' && !o.depleted) col = '#cfcfcf';
      else if (o.def.type === 'bank') col = '#ffd24a';
      else if (o.def.type === 'fishing') col = '#7fd8ff';
      else if (o.def.type === 'transport') col = '#ffffff';
      if (!col) continue;
      const big = o.def.type === 'bank' || o.def.type === 'transport';
      ctx.fillStyle = col;
      ctx.fillRect(W / 2 + dx * scale - (big ? 1.5 : 1), H / 2 + dy * scale - (big ? 1.5 : 1), big ? 4 : 3, big ? 4 : 3);
    }
    // Ground items.
    ctx.fillStyle = '#ff3b3b';
    for (const g of game.world.groundItems) {
      const dx = g.x - px, dy = g.y - py;
      if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue;
      ctx.fillRect(W / 2 + dx * scale, H / 2 + dy * scale, 2, 2);
    }
    // NPCs.
    for (const n of game.npcs) {
      if (!n.alive) continue;
      const dx = n.x - px, dy = n.y - py;
      if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue;
      let col, r = 2.5;
      if (n.attackable) { col = '#ffe24a'; r = 2; }
      else if (n.def.role === 'bank') col = '#ffd24a';
      else if (n.def.role === 'shop') col = '#ff9a3a';
      else if (n.def.dialogue === 'slayer') col = '#ff5a5a';
      else if (n.def.role === 'dialogue') { col = '#7CFC00'; r = 3; } // quest-givers stand out
      else col = '#5ad1ff';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(W / 2 + dx * scale, H / 2 + dy * scale, r, 0, Math.PI * 2); ctx.fill();
    }
    // Treasure-trail dig spot (pulsing gold).
    if (game.clue) {
      const spot = game.clue.spots[game.clue.step];
      if (spot) {
        const dx = spot.x - px, dy = spot.y - py;
        if (Math.abs(dx) <= radius && Math.abs(dy) <= radius) {
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath(); ctx.arc(W / 2 + dx * scale, H / 2 + dy * scale, 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }
    // Player.
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fill();
    // A faint navy wash after dark keeps the minimap in step with the world.
    const night = 1 - game.daylightFactor();
    if (night > 0.05) {
      ctx.fillStyle = `rgba(8,16,40,${Math.min(0.45, night * night * 0.55).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}

const TIPS_KEY = 'singaporescape:tips';
const TIPS = {
  move: 'Move with the <b>joystick</b> (or W A S D). Walk up to something and press <b>Interact</b> (E / Space) to chop, mine, fish, talk or fight.',
  auto: 'Tap <b>Auto battle</b> to hunt monsters for you. The &#9881; next to it sets when to eat and what to fight.',
  gear: 'A green <b>&#9650;</b> on an item means it beats what you wear. <b>Hold</b> (or hover) an item for details, or open Worn Equipment &gt; <b>Gear Guide</b>.',
  dodge: 'A boss marked the ground in <b>red</b>! Walk out before it fills up to dodge the hit.',
  champion: 'A gold-ringed <b>&#9733; Champion</b> is nearby: tougher than normal, with extra loot.',
  bounty: 'You have <b>daily bounties</b> in the Quest Journal: three kill targets that pay coins. The tracker on the left points the way.',
  upgrade: 'Got coins to spare? <b>Upgrade</b> your gear up to +10 in Worn Equipment &gt; Upgrade gear.',
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
