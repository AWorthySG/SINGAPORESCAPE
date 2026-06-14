import { getItem } from '../data/items.js';
import { SHOPS, getShop } from '../data/shops.js';
import { SMELT, SMITH } from '../data/smithing.js';
import { COOKING } from '../game/skilling.js';
import { SKILLS } from '../data/skills.js';
import { getDialogue } from '../data/dialogue.js';
import { levelProgress, xpToNext } from '../data/xp.js';
import { stackLabel, capitalize, formatNumber } from '../core/utils.js';
import { STYLE_ORDER, STYLES } from '../game/combat.js';
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
      xpDrops: id('xp-drops'),
      chatLog: id('chat-log'),
      inventory: id('inventory-grid'),
      equipLayout: id('equipment-layout'),
      equipBonuses: id('equipment-bonuses'),
      skillsGrid: id('skills-grid'),
      skillsTotal: id('skills-total'),
      combat: id('combat-panel'),
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
      runOrb: id('run-orb'),
      minimap: id('minimap-canvas'),
    };
    this.minimapCtx = this.el.minimap.getContext('2d');

    // Swap the placeholder emoji tab glyphs for hand-drawn vector icons.
    document.querySelectorAll('#panel-tabs .tab-btn').forEach((b) => {
      b.innerHTML = tabIconSVG(b.dataset.view, 24);
    });
    this.el.panelHead = document.getElementById('panel-head');
    this._setPanelTitle('inventory');

    this._bindTabs();
    this._bindChatTabs();
    this._buildCombatPanel();
    this._buildSettingsPanel();

    this.el.runOrb.addEventListener('click', () => this.game.toggleRun());
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
    this.bus.on('bank', () => this._refreshModalIfOpen(['bank']));

    this.renderInventory();
    this.renderEquipment();
    this.renderSkills();
    this.renderCombatPanel();
    this.renderHp();
    this.renderRun();
  }

  // ---------------- Tabs ----------------
  _setPanelTitle(view) {
    if (!this.el.panelHead) return;
    const titles = { inventory: 'Inventory', equipment: 'Worn Equipment', skills: 'Skills', combat: 'Combat', settings: 'Settings' };
    this.el.panelHead.textContent = titles[view] || '';
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
    this.el.equipBonuses.innerHTML =
      `<div class="row"><span>Attack bonus</span><span>+${b.attack}</span></div>` +
      `<div class="row"><span>Strength bonus</span><span>+${b.strength}</span></div>` +
      `<div class="row"><span>Defence bonus</span><span>+${b.defence}</span></div>` +
      `<div class="row"><span>Attack speed</span><span>${(speed * 0.6).toFixed(1)}s</span></div>`;
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
    for (const styleId of STYLE_ORDER) {
      const st = STYLES[styleId];
      const btn = document.createElement('div');
      btn.className = 'style-btn';
      btn.dataset.style = styleId;
      btn.innerHTML = `${st.name}<span class="style-skill">${capitalize(st.skill)} XP</span>`;
      btn.addEventListener('click', () => { this.game.player.style = styleId; this.renderCombatPanel(); });
      this._styleRow.appendChild(btn);
    }
    const cb = this.el.combat.querySelector('#auto-retal-cb');
    cb.addEventListener('change', () => { this.game.player.autoRetaliate = cb.checked; });
  }

  renderCombatPanel() {
    if (!this._styleRow) return;
    [...this._styleRow.children].forEach((b) => b.classList.toggle('active', b.dataset.style === this.game.player.style));
    this.el.combat.querySelector('.cb-level').textContent = `Combat level: ${this.game.skills.combatLevel()}`;
    const cb = this.el.combat.querySelector('#auto-retal-cb');
    if (cb) cb.checked = this.game.player.autoRetaliate;
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
      bankSide.innerHTML = '<div class="modal-section-title">Bank</div>';
      const bankGrid = document.createElement('div');
      bankGrid.className = 'item-grid';
      for (const e of this.game.bank.items) {
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
      if (!this.game.bank.items.length) bankSide.innerHTML += '<div class="modal-hint">Your bank is empty.</div>';
      bankSide.appendChild(bankGrid);
      // Inventory side
      const invSide = document.createElement('div');
      invSide.innerHTML = '<div class="modal-section-title">Inventory</div>';
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

  // Dialogue -----------------------------------------------------------
  openDialogue(npc) {
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

  // ---------------- Minimap ----------------
  renderMinimap() {
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
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(W / 2 + dx * scale - 1, H / 2 + dy * scale - 1, 3, 3);
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
      ctx.fillStyle = n.attackable ? '#ffe24a' : '#5ad1ff';
      ctx.beginPath(); ctx.arc(W / 2 + dx * scale, H / 2 + dy * scale, 2.5, 0, Math.PI * 2); ctx.fill();
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
