import { getItem } from '../data/items.js';
import { SHOPS, getShop } from '../data/shops.js';
import { SMELT, SMITH } from '../data/smithing.js';
import { COOKING } from '../game/skilling.js';
import { SKILLS } from '../data/skills.js';
import { getDialogue } from '../data/dialogue.js';
import { MONSTER_IDS, BOSS_IDS, getNpc } from '../data/npcs.js';
import { levelProgress, xpToNext } from '../data/xp.js';
import { stackLabel, capitalize, formatNumber } from '../core/utils.js';
import { STYLE_ORDER, STYLES, RANGED_STYLE_ORDER, RANGED_STYLES } from '../game/combat.js';
import { SPELLS } from '../data/magic.js';
import { PRAYERS } from '../data/prayers.js';
import { ACHIEVEMENTS, rewardFor } from '../data/achievements.js';
import { QUESTS } from '../data/quests.js';
import { SLAYER_REWARDS } from '../data/slayer.js';
import { STATIONS, MRT_FARE } from '../data/transport.js';
import { EQUIP_SLOTS } from '../game/equipment.js';
import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { clearSave } from '../game/save.js';
import { itemIconSVG, skillIconSVG, tabIconSVG } from '../render/icons.js';

const EQUIP_LAYOUT = [
  null, 'head', null,
  'cape', 'amulet', null,
  'weapon', 'body', 'shield',
  null, 'legs', null,
  'hands', 'feet', 'ring',
];

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
      hpOrb: id('hp-orb'),
      hpOrbVal: id('hp-orb-value'),
      prayerOrb: id('prayer-orb'),
      prayerOrbVal: id('prayer-orb-value'),
      runOrb: id('run-orb'),
      specOrb: id('spec-orb'),
      specOrbVal: id('spec-orb-value'),
      minimap: id('minimap-canvas'),
      minimapRegion: id('minimap-region'),
      mapBtn: id('map-btn'),
    };
    this.minimapCtx = this.el.minimap.getContext('2d');

    // Swap the placeholder emoji tab glyphs for hand-drawn vector icons.
    document.querySelectorAll('#panel-tabs .tab-btn').forEach((b) => {
      b.innerHTML = tabIconSVG(b.dataset.view, 24);
    });
    this.el.panelHead = document.getElementById('panel-head');
    this.el.panelTitle = document.getElementById('panel-title');
    this.el.panelCollapse = document.getElementById('panel-collapse');
    this.el.sidepanel = document.getElementById('sidepanel');
    this._setPanelTitle('inventory');
    if (this.el.panelCollapse) this.el.panelCollapse.addEventListener('click', () => this.togglePanelCollapse());

    this._bindTabs();
    this._bindChatTabs();
    this._buildCombatPanel();
    this._buildPrayerPanel();
    this._buildSettingsPanel();

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

    // Bus subscriptions.
    this.bus.on('inventory', () => { this.renderInventory(); this._refreshModalIfOpen(['bank', 'shop']); });
    this.bus.on('equipment', () => { this.renderEquipment(); this.renderCombatPanel(); });
    this.bus.on('skills', () => { this.renderSkills(); this.renderCombatPanel(); });
    this.bus.on('xp', (p) => { this.renderSkills(); this.showXpDrop(p); });
    this.bus.on('levelup', (p) => this.onLevelUp(p));
    this.bus.on('chat', (p) => this.addChat(p.text, p.cls));
    this.bus.on('hp', () => this.renderHp());
    this.bus.on('run', () => this.renderRun());
    this.bus.on('spec', () => this.renderSpec());
    this.bus.on('equipment', () => this.renderSpec());
    this.bus.on('prayer', () => { this.renderPrayer(); this.renderPrayerPanel(); });
    this.bus.on('skills', () => this.renderPrayerPanel());
    this.bus.on('quest', () => { this.renderQuestPanel(); this.renderTracker(); });
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
    this.renderTracker();
  }

  // ---------------- Objective tracker ----------------
  renderTracker() {
    const el = this.el.tracker;
    if (!el) return;
    const g = this.game;
    const rows = [];
    if (g.slayer && g.slayer.task) {
      rows.push(`<div class="trk-row"><span class="trk-ic trk-slayer">&#9760;</span>${g.slayer.task.remaining} ${escapeHtml(g.slayer.task.name)}</div>`);
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

  // ---------------- Tabs ----------------
  _setPanelTitle(view) {
    const el = this.el.panelTitle || this.el.panelHead;
    if (!el) return;
    const titles = { inventory: 'Inventory', equipment: 'Worn Equipment', skills: 'Skills', combat: 'Combat', prayer: 'Prayers', quests: 'Quest Journal', achievements: 'Achievements', settings: 'Settings' };
    el.textContent = titles[view] || '';
  }

  togglePanelCollapse() {
    const sp = this.el.sidepanel;
    if (!sp) return;
    const collapsed = sp.classList.toggle('collapsed');
    if (this.el.panelCollapse) {
      this.el.panelCollapse.innerHTML = collapsed ? '&#9656;' : '&#9662;'; // ▸ collapsed / ▾ expanded
      this.el.panelCollapse.title = collapsed ? 'Expand panel' : 'Collapse panel';
    }
  }

  _bindTabs() {
    const tabs = document.querySelectorAll('#panel-tabs .tab-btn');
    const views = document.querySelectorAll('#panel-body .panel-view');
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabs.forEach((b) => b.classList.toggle('active', b === btn));
        const view = btn.dataset.view;
        this._setPanelTitle(view);
        views.forEach((v) => v.classList.toggle('hidden', v.dataset.view !== view));
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
  renderInventory() {
    const grid = this.el.inventory;
    grid.innerHTML = '';
    const slots = this.game.inventory.slots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const cell = document.createElement('div');
      cell.className = 'inv-slot' + (s ? ' filled' : '');
      if (s) {
        const item = getItem(s.id);
        cell.innerHTML = `<span class="icon">${itemIconSVG(s.id, 32)}</span>`;
        if (item.stackable || s.qty > 1) {
          const lbl = stackLabel(s.qty);
          const q = document.createElement('span');
          q.className = `qty ${lbl.cls}`;
          q.textContent = lbl.text;
          cell.appendChild(q);
        }
        cell.addEventListener('click', () => this._invDefault(i));
        cell.addEventListener('contextmenu', (e) => { e.preventDefault(); this._invContext(i, e); });
        cell.addEventListener('mouseenter', (e) => this.showTooltip(e, `<b>${item.name}</b><br><span style="opacity:.8">${item.examine}</span>`));
        cell.addEventListener('mousemove', (e) => this.moveTooltip(e));
        cell.addEventListener('mouseleave', () => this.hideTooltip());
      }
      grid.appendChild(cell);
    }
  }

  _invDefault(i) {
    const s = this.game.inventory.slotAt(i);
    if (!s) return;
    const item = getItem(s.id);
    if (item.heal) this.game.eatItem(i);
    else if (item.equip) this.game.equipItem(i);
    else if (item.tags?.includes('log')) this.game.lightLogs(i);
    else if (s.id === 'bones') this.game.buryBones(i);
    else this.game.msg(item.examine, 'system');
  }

  _invContext(i, e) {
    const s = this.game.inventory.slotAt(i);
    if (!s) return;
    const item = getItem(s.id);
    const opts = [];
    if (item.heal) opts.push({ label: 'Eat', target: item.name, fn: () => this.game.eatItem(i) });
    if (item.equip) opts.push({ label: item.equip.slot === 'weapon' ? 'Wield' : 'Wear', target: item.name, fn: () => this.game.equipItem(i) });
    if (item.tags?.includes('log')) opts.push({ label: 'Light', target: item.name, fn: () => this.game.lightLogs(i) });
    if (s.id === 'bones') opts.push({ label: 'Bury', target: item.name, fn: () => this.game.buryBones(i) });
    opts.push({ label: 'Drop', target: item.name, fn: () => this.game.dropItem(i) });
    opts.push({ label: 'Examine', target: item.name, fn: () => this.game.msg(item.examine, 'system') });
    this.showContextMenu(e.clientX, e.clientY, opts);
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
        cell.addEventListener('click', () => this.game.unequip(slot));
        cell.addEventListener('mouseenter', (e) => this.showTooltip(e, `<b>${item.name}</b><br><span style="opacity:.8">Click to remove</span>`));
        cell.addEventListener('mousemove', (e) => this.moveTooltip(e));
        cell.addEventListener('mouseleave', () => this.hideTooltip());
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
      `<div class="row"><span>Attack speed</span><span>${(speed * 0.6).toFixed(1)}s</span></div>` +
      specLine +
      (sets.length ? `<div class="row set-bonus"><span>Set bonus</span><span>${sets.join(', ')}</span></div>` : '');
  }

  // ---------------- Skills ----------------
  renderSkills() {
    const grid = this.el.skillsGrid;
    grid.innerHTML = '';
    for (const sk of SKILLS) {
      const lvl = this.game.skills.level(sk.id);
      const xp = this.game.skills.xp[sk.id];
      const cell = document.createElement('div');
      cell.className = 'skill-cell';
      cell.innerHTML =
        `<span class="skill-icon">${skillIconSVG(sk.id, 20)}</span>` +
        `<span class="skill-lvl"><span class="cur">${lvl}</span></span>` +
        `<div class="xp-bar" style="width:${Math.round(levelProgress(xp) * 100)}%"></div>`;
      const toNext = xpToNext(xp);
      cell.addEventListener('mouseenter', (e) => this.showTooltip(e,
        `<b>${sk.name}</b> &mdash; level ${lvl}<br>XP: ${formatNumber(Math.floor(xp))}<br>` +
        (toNext > 0 ? `Next level: ${formatNumber(toNext)} xp` : 'Maxed!')));
      cell.addEventListener('mousemove', (e) => this.moveTooltip(e));
      cell.addEventListener('mouseleave', () => this.hideTooltip());
      grid.appendChild(cell);
    }
    this.el.skillsTotal.textContent = `Total level: ${this.game.skills.totalLevel()}`;
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
        btn.innerHTML = `${sp.name}<span class="style-skill">L${sp.level} · max ${sp.maxHit} · ${escapeHtml(cost)}</span>`;
        btn.style.opacity = known ? (this.game._hasRunes(sp) ? '1' : '0.65') : '0.35';
        if (known) btn.addEventListener('click', () => { p.spell = sp.id; this.renderCombatPanel(); });
        row.appendChild(btn);
      }
    } else {
      const order = mode === 'ranged' ? RANGED_STYLE_ORDER : STYLE_ORDER;
      const map = mode === 'ranged' ? RANGED_STYLES : STYLES;
      const cur = mode === 'ranged' ? p.rangedStyle : p.style;
      for (const id of order) {
        const st = map[id];
        const btn = document.createElement('div');
        btn.className = 'style-btn' + (cur === id ? ' active' : '');
        const xpLabel = mode === 'ranged' ? (id === 'longrange' ? 'Ranged + Defence' : 'Ranged XP') : `${capitalize(st.skill)} XP`;
        btn.innerHTML = `${st.name}<span class="style-skill">${xpLabel}</span>`;
        btn.addEventListener('click', () => { if (mode === 'ranged') p.rangedStyle = id; else p.style = id; this.renderCombatPanel(); });
        row.appendChild(btn);
      }
    }
    const modeLabel = mode === 'ranged' ? 'Ranged' : mode === 'magic' ? 'Magic' : 'Melee';
    this.el.combat.querySelector('.cb-level').innerHTML = `Combat level: ${this.game.skills.combatLevel()} <span style="opacity:.7">&middot; ${modeLabel}</span>`;
    const cb = this.el.combat.querySelector('#auto-retal-cb');
    if (cb) cb.checked = p.autoRetaliate;
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
    mk('Delete save & restart', () => {
      if (confirm('Delete your saved character and start over?')) { clearSave(); location.reload(); }
    }, true);
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.innerHTML = 'Left-click to walk & interact. Right-click for more options.<br>' +
      'Click trees to chop, rocks to mine, water to fish, monsters to fight.<br>' +
      'Eat food to heal. Bank your loot. Your progress auto-saves.';
    p.appendChild(hint);
  }

  // ---------------- Orbs ----------------
  renderHp() {
    const hp = this.game.player.hp;
    const max = this.game.skills.hitpoints;
    this.el.hpOrbVal.textContent = hp;
    const frac = max ? hp / max : 1;
    const hue = Math.round(120 * frac);
    this.el.hpOrb.style.color = `hsl(${hue}, 90%, 65%)`;
  }

  renderRun() {
    this.el.runOrb.textContent = `${Math.round(this.game.runEnergy)}%`;
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
      cell.innerHTML = `<b>${pr.name}</b><span>Lvl ${pr.level} · ${effect}</span>`;
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
    let html = `<div class="quest-head">Quests complete: ${done} / ${QUESTS.length}</div>`;
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
        row.innerHTML = `<div class="b-head"><b>${escapeHtml(d.name)}</b><span class="b-lvl">Lvl ${d.level}${d.boss ? ' · Boss' : ''}</span><span class="b-kc">${k} kills</span></div><div class="b-drops">${dropHtml}</div>`;
        list.appendChild(row);
      }
      if (!shown) { const e = document.createElement('div'); e.className = 'modal-hint'; e.textContent = 'No creatures match your search.'; list.appendChild(e); }
      body.appendChild(list);
    };
    this.openModal('Bestiary', render);
    this.modal.kind = 'bestiary';
  }

  // ---------------- XP drops / level up ----------------
  showXpDrop({ skill, amount }) {
    const sk = SKILLS.find((s) => s.id === skill);
    const div = document.createElement('div');
    div.className = 'xp-drop';
    div.innerHTML = `<span class="xp-ic">${skillIconSVG(skill, 16)}</span><span>+${Math.round(amount)}</span>`;
    this.el.xpDrops.appendChild(div);
    setTimeout(() => div.remove(), 2300);
  }

  onLevelUp({ skill, level }) {
    const sk = SKILLS.find((s) => s.id === skill);
    this.addChat(`Congratulations, you just advanced a ${sk.name} level! You are now level ${level}.`, 'level');
    this.showBanner(`<span class="big">Level up!</span>Your ${sk.name} is now level ${level}.`);
    this.renderSkills();
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

  hideTooltip() { this.el.tooltip.classList.add('hidden'); }

  // ---------------- Modals ----------------
  openModal(title, render) {
    this.modal = { title, render };
    this.el.modalTitle.textContent = title;
    this.el.modalOverlay.classList.remove('hidden');
    render(this.el.modalBody);
  }

  closeModal() {
    this.modal = null;
    this.el.modalOverlay.classList.add('hidden');
    this.el.modalBody.innerHTML = '';
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
        const price = Math.max(1, Math.round(getItem(entry.id).value * shop.buyMul));
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
        const sell = Math.max(1, Math.round(getItem(s.id).value * shop.sellMul));
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
    if (!raws.length) { this.game.msg('You have nothing to cook.'); return; }
    const render = (body) => {
      body.innerHTML = '<div class="modal-hint">Choose what to cook. You\'ll cook until you run out.</div>';
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
    cell.addEventListener('mouseenter', (e) => this.showTooltip(e, tooltip || `<b>${item.name}</b>`));
    cell.addEventListener('mousemove', (e) => this.moveTooltip(e));
    cell.addEventListener('mouseleave', () => this.hideTooltip());
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
      c.font = `bold ${Math.max(9, scale * 3)}px "Trebuchet MS",sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const z of game.world.zones) {
        const cx = ((z.x0 + z.x1) / 2) * scale, cy = ((z.y0 + z.y1) / 2) * scale;
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
    // Player.
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
