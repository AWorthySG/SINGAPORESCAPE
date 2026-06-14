import { EventBus } from '../core/events.js';
import { buildWorld } from '../data/world.js';
import { getItem } from '../data/items.js';
import { chebyshev, randInt, weightedPick, capitalize } from '../core/utils.js';
import {
  TILE, TICK_MS, RESPAWN_TICKS, AUTOSAVE_TICKS,
} from '../config.js';

import { World } from './world.js';
import { Skills } from './skillset.js';
import { Inventory } from './inventory.js';
import { Equipment } from './equipment.js';
import { Bank } from './bank.js';
import { Player } from './player.js';
import { NPC } from './npc.js';
import { Camera } from '../engine/camera.js';
import { findPath } from '../engine/pathfinding.js';
import {
  playerAttackVsNpc, npcAttackVsPlayer, rollAttack, combatXp,
  playerRangedVsNpc, combatXpRanged, playerMagicVsNpc, RANGED_STYLES,
} from './combat.js';
import { getSpell } from '../data/magic.js';
import {
  resolveWoodcut, resolveMine, resolveFish, resolveCook,
  resolveSmelt, resolveSmith, resolveFiremake,
} from './skilling.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { getShop } from '../data/shops.js';
import { RARE_DROP_TABLE } from '../data/npcs.js';

const STARTER_TOOLS = ['bronze_axe', 'bronze_pickaxe', 'small_net', 'tinderbox', 'hammer', 'bronze_dagger'];

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
    this.player.hp = this.skills.hitpoints;

    this.npcs = data.npcSpawns.map((s) => new NPC(s.npcId, s.x, s.y, s.wander));

    this.camera = new Camera();
    this.ui = null;     // set by main
    this.input = null;  // set by main

    this.running = false;
    this.runEnergy = 100;
    this.effects = [];
    this.particles = [];
    this.hover = null;
    this.currentZoneName = null;
    this.wildLevel = 0;
    this.playerStun = 0;
    this.hasTemps = false;
    this.quests = { bone_collector: 'notStarted' };

    // Celebratory sparkle on level up.
    this.bus.on('levelup', () => this.spawnSparkle(this.player, '#ffe24a', 12));

    this.tickAcc = 0;
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
    } else {
      this.newGame();
    }
    this.bus.emit('inventory');
    this.bus.emit('equipment');
    this.bus.emit('skills');
    this.bus.emit('hp');
    this.bus.emit('run');
    this.updateRegion();
  }

  newGame() {
    for (const id of STARTER_TOOLS) this.inventory.add(id, 1);
    this.inventory.add('coins', 150);
    this.inventory.add('kaya_toast', 5);
    this.inventory.add('chicken_rice', 3);
    // Start combat-ready so the early game isn't punishing.
    this.equipment.set('weapon', 'bronze_scimitar');
    this.equipment.set('shield', 'wooden_shield');
    this.equipment.set('body', 'leather_body');
    this.player.hp = this.skills.hitpoints;
    this.starterGiven = true;
    this.msg(`Welcome to ${this.world.townName}, an island of adventure!`, 'system');
    this.msg('You are equipped and ready. Talk to the Kampong Guide for tips.', 'system');
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
  addHitsplat(entity, dmg) { this.effects.push({ type: 'hitsplat', entity, dmg, life: 1100 }); }

  // ---------------- Frame update (called from RAF) ----------------
  update(dt) {
    this.player.update(dt);
    for (const n of this.npcs) n.update(dt);

    this.tickAcc += dt;
    let guard = 0;
    while (this.tickAcc >= TICK_MS && guard++ < 5) {
      this.tickAcc -= TICK_MS;
      this.doTick();
    }

    const c = this.player.renderCenter();
    this.camera.follow(c.x, c.y, 0.22, { width: this.world.width, height: this.world.height });

    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);

    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
    if (this.particles.length) this.particles = this.particles.filter((p) => p.life > 0);

    this.updateHover();
  }

  // ---------------- Particles ----------------
  _pushParticle(p) { this.particles.push(p); if (this.particles.length > 300) this.particles.shift(); }

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

  // ---------------- Game tick (600ms) ----------------
  doTick() {
    this.tickCount++;
    if (!this.player.alive) {
      if (--this.player.respawnTimer <= 0) this.respawnPlayer();
    } else {
      if (this.player.attackCooldown > 0) this.player.attackCooldown--;
      if (this.playerStun > 0) this.playerStun--;
      else this.resolvePlayerAction();
    }
    // Only tick NPCs near the player (the bestiary is large).
    const px = this.player.x, py = this.player.y;
    for (const n of this.npcs) {
      if (Math.abs(n.x - px) > 46 || Math.abs(n.y - py) > 46) continue;
      n.tick(this);
    }
    if (this.hasTemps) this.npcs = this.npcs.filter((n) => !(n.temporary && !n.alive));
    if (this.player.alive) this.updateRegion();
    this.world.tick();
    this._spawnEmbers();

    if (this.player.alive && ++this.regenCounter >= 100) {
      this.regenCounter = 0;
      if (this.player.hp < this.skills.hitpoints) { this.player.hp++; this.bus.emit('hp'); }
    }
    this.updateRunEnergy();

    if (++this.autosaveCounter >= AUTOSAVE_TICKS) { this.autosaveCounter = 0; saveGame(this); }
    this.bus.emit('tick', this.tickCount);
  }

  updateRunEnergy() {
    let changed = false;
    if (this.running && this.player.isMoving && this.player.alive) {
      this.runEnergy = Math.max(0, this.runEnergy - 1.2);
      if (this.runEnergy === 0) this.running = false;
      changed = true;
    } else if (this.runEnergy < 100) {
      this.runEnergy = Math.min(100, this.runEnergy + 0.7 + this.skills.agility * 0.01);
      changed = true;
    }
    if (changed) this.bus.emit('run');
  }

  toggleRun() {
    if (!this.running && this.runEnergy <= 0) return;
    this.running = !this.running;
    this.bus.emit('run');
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
      case 'smelt': return this._tickContinuous(a, a.obj, () => resolveSmelt(this, a));
      case 'smith': return this._tickContinuous(a, a.obj, () => resolveSmith(this, a));
      // One-shot arrival actions (open a UI / talk).
      case 'cookmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openCookMenu(a.obj));
      case 'smeltmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openSmeltMenu(a.obj));
      case 'smithmenu': return this._tickArrival(a, a.obj, true, () => this.ui?.openSmithMenu(a.obj));
      case 'pray': return this._tickArrival(a, a.obj, true, () => {
        this.player.hp = this.skills.hitpoints;
        this.bus.emit('hp');
        this.spawnSparkle(this.player, '#9adcff', 16);
        this.msg('You kneel at the A-Worthy Monument. Your wounds are healed.', 'system');
      });
      case 'rest': return this._tickArrival(a, a.obj, true, () => {
        this.player.hp = this.skills.hitpoints;
        this.runEnergy = 100;
        this.bus.emit('hp'); this.bus.emit('run');
        this.spawnSparkle(this.player, '#f5a623', 16);
        this.msg('You rest at the Hyco Education obelisk. Health and run energy restored.', 'system');
      });
      case 'thieve': return this._tickArrival(a, a.target, true, () => this.pickpocket(a.npc));
      case 'agility': return this._tickContinuous(a, a.obj, () => this.resolveAgility(a.obj));
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
    if (!resolver()) this.player.clearAction();
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
    if (chebyshev(p.x, p.y, npc.x, npc.y) > range) {
      // Approach / chase a moving target.
      if (!a.lastNpcTile || a.lastNpcTile.x !== npc.x || a.lastNpcTile.y !== npc.y || !p.isMoving) {
        const path = findPath(this.pathCfg(), this.playerTile(), { x: npc.x, y: npc.y },
          { reachAdjacent: true, maxNodes: 4000 });
        if (path.length) this.player.setPath(path, this.canRun());
        else if (!p.isMoving) { this.msg("I can't reach that!"); p.clearAction(); return; }
        a.lastNpcTile = { x: npc.x, y: npc.y };
      }
      return;
    }
    p.stop();
    if (p.attackCooldown <= 0) this.doPlayerAttack(npc);
  }

  // ---------------- Combat resolution ----------------
  combatMode() { return this.equipment.combatType(); }
  attackRange() { const m = this.combatMode(); return m === 'ranged' ? 7 : m === 'magic' ? 8 : 1; }

  doPlayerAttack(npc) {
    const mode = this.combatMode();
    if (mode === 'ranged') return this._rangedAttack(npc);
    if (mode === 'magic') return this._magicAttack(npc);
    const { atkRoll, defRoll, max } = playerAttackVsNpc(this.skills, this.equipment, this.player.style, npc.def);
    const dmg = rollAttack(atkRoll, defRoll, max);
    this._applyPlayerHit(npc, dmg);
    if (dmg > 0) { this.spawnHitSparks(npc, '#fff2b0'); for (const x of combatXp(this.player.style, dmg)) this.skills.addXp(x.skill, x.xp); }
    this.player.attackCooldown = this.equipment.weaponSpeed();
    this._postAttack(npc);
  }

  _applyPlayerHit(npc, dmg) { npc.takeDamage(dmg); this.addHitsplat(npc, dmg); }
  _postAttack(npc) {
    if (!npc.target) npc.target = this.player; // provoke retaliation
    if (npc.hp <= 0) { this.killNpc(npc); this.player.clearAction(); }
  }

  _rangedAttack(npc) {
    const arrowIdx = this.inventory.slots.findIndex((s) => s && getItem(s.id).tags?.includes('ammo'));
    if (arrowIdx === -1) { this.msg('You have no arrows left.'); this.player.clearAction(); return; }
    const arrowStr = getItem(this.inventory.slotAt(arrowIdx).id).arrowStr || 0;
    const style = this.player.rangedStyle;
    const { atkRoll, defRoll, max } = playerRangedVsNpc(this.skills, this.equipment, style, npc.def, arrowStr);
    const dmg = rollAttack(atkRoll, defRoll, max);
    this.inventory.removeAt(arrowIdx, 1);
    this._projectile(npc, '#d9c45a');
    this._applyPlayerHit(npc, dmg);
    if (dmg > 0) { this.spawnHitSparks(npc, '#cfe0a0'); for (const x of combatXpRanged(style, dmg)) this.skills.addXp(x.skill, x.xp); }
    this.player.attackCooldown = Math.max(2, this.equipment.weaponSpeed() + (RANGED_STYLES[style]?.speedMod || 0));
    this._postAttack(npc);
  }

  _magicAttack(npc) {
    const spell = getSpell(this.player.spell);
    if (this.skills.magic < spell.level) { this.msg(`You need Magic level ${spell.level} to cast ${spell.name}.`); this.player.clearAction(); return; }
    if (!this._hasRunes(spell)) { this.msg(`You don't have the runes to cast ${spell.name}.`); this.player.clearAction(); return; }
    this._consumeRunes(spell);
    const { atkRoll, defRoll, max } = playerMagicVsNpc(this.skills, this.equipment, spell, npc.def);
    const dmg = rollAttack(atkRoll, defRoll, max);
    this._projectile(npc, spell.tint);
    this._applyPlayerHit(npc, dmg);
    this.skills.addXp('magic', spell.xp);
    if (dmg > 0) { this.spawnHitSparks(npc, spell.tint); this.skills.addXp('magic', dmg * 2); this.skills.addXp('hitpoints', dmg * 1.33); }
    this.player.attackCooldown = this.equipment.weaponSpeed();
    this._postAttack(npc);
  }

  _hasRunes(spell) { return Object.entries(spell.runes).every(([id, q]) => this.inventory.count(id) >= q); }
  _consumeRunes(spell) { for (const [id, q] of Object.entries(spell.runes)) this.inventory.remove(id, q); }

  _projectile(npc, color) {
    const from = this.player.renderCenter();
    const to = npc.renderCenter();
    this.effects.push({ type: 'projectile', x: from.x, y: from.y - 8, ex: to.x, ey: to.y - 8, color, life: 240, maxLife: 240 });
  }

  resolveNpcAttack(npc) {
    const p = this.player;
    if (!p.alive) return;
    const { atkRoll, defRoll, max } = npcAttackVsPlayer(npc.def, this.skills, this.equipment, p.style);
    const dmg = rollAttack(atkRoll, defRoll, max);
    p.takeDamage(dmg);
    this.addHitsplat(p, dmg);
    if (dmg > 0) this.spawnHitSparks(p, '#ff8a8a');
    this.bus.emit('hp');
    if (p.autoRetaliate && (!p.action || p.action.type !== 'attack')) this.attackNpc(npc);
    if (p.hp <= 0) this.playerDeath();
  }

  killNpc(npc) {
    if (npc.def.boss) {
      this.msg(`You have slain ${npc.name}!`, 'combat');
      this.banner(`<span class="big">${npc.name} defeated!</span>The spoils are yours.`);
    } else {
      this.msg(`You have defeated the ${npc.name}.`, 'combat');
    }
    this.rollDrops(npc);
    npc.die();
    if (this.player.target === npc) this.player.target = null;
  }

  // ---------------- Region / Wilderness ----------------
  updateRegion() {
    const z = this.world.zoneAt(this.player.x, this.player.y);
    const name = z ? z.name : 'Singapore';
    const wild = !!(z && z.wilderness);
    const lvl = wild ? Math.max(1, Math.floor((this.player.x - 94) / 3) + 1) : 0;
    if (name !== this.currentZoneName) {
      this.currentZoneName = name;
      if (wild) {
        this.banner('<span class="big">&#9888; The Wilderness</span>Lawless and deadly &mdash; no safe healing. Beware bosses!');
        this.msg('You enter the Wilderness. Fight or flee!', 'combat');
      } else {
        this.msg(`You enter ${name}.`, 'system');
      }
    }
    this.wildLevel = lvl;
    this.ui?.setRegion?.(name, lvl);
  }

  rollDrops(npc) {
    const def = npc.def;
    for (const d of def.alwaysDrop || []) {
      const q = d.min ? randInt(d.min, d.max) : 1;
      this.world.addGroundItem(d.id, q, npc.x, npc.y);
    }
    if (def.dropTable && def.dropTable.length) {
      const pick = weightedPick(def.dropTable);
      if (!pick.nothing) {
        const q = pick.min ? randInt(pick.min, pick.max) : 1;
        this.world.addGroundItem(pick.id, q, npc.x, npc.y);
      }
    }
    // Rare drop table — small base chance, much higher for bosses & high levels.
    const rareChance = Math.min(0.22, (def.level || 1) / 1200 + (def.boss ? 0.18 : 0.01));
    if (Math.random() < rareChance) {
      const pick = weightedPick(RARE_DROP_TABLE);
      const q = pick.min ? randInt(pick.min, pick.max) : 1;
      this.world.addGroundItem(pick.id, q, npc.x, npc.y);
      const nm = getItem(pick.id).name;
      this.msg(`A rare drop! ${q > 1 ? q + ' x ' : ''}${nm}.`, 'level');
      if (getItem(pick.id).value >= 5000) this.banner(`<span class="big">Rare drop!</span>${nm}`);
    }
  }

  // ---------------- New skills: Prayer, Thieving, Agility ----------------
  buryBones(index) {
    const s = this.inventory.slotAt(index);
    if (!s || s.id !== 'bones') { this.msg('You can only bury bones.'); return; }
    this.inventory.removeAt(index, 1);
    this.skills.addXp('prayer', 4.5);
    this.spawnSparkle(this.player, '#ffe89a', 6);
    this.msg('You bury the bones.', 'system');
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
    this.skills.addXp('agility', obj.def.xp || 18);
    this.runEnergy = Math.min(100, this.runEnergy + 8);
    this.bus.emit('run');
    this.spawnPoof(obj.x * TILE + TILE / 2, obj.y * TILE + TILE / 2 - 6, '#8fd6ff');
    return true; // keep training until the player moves
  }

  // ---------------- Boss mechanics ----------------
  spawnNpc(npcId, x, y, { temporary = false, wander = 3 } = {}) {
    const n = new NPC(npcId, x, y, wander);
    n.temporary = temporary;
    if (temporary) this.hasTemps = true;
    this.npcs.push(n);
    return n;
  }

  bossSpecial(npc) {
    const p = this.player;
    if (!p.alive) return;
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
            if (!this.world.isBlocked(ox, oy)) this.spawnNpc('imp', ox, oy, { temporary: true });
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

  playerDeath() {
    this.msg('Oh dear, you are dead!', 'combat');
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
    p.hp = this.skills.hitpoints;
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
      const path = findPath(this.pathCfg(), start, target, { reachAdjacent: adjacent, maxNodes: 6000 });
      if (!path.length) { this.msg("I can't reach that."); return false; }
      this.player.setPath(path, this.canRun());
    } else {
      this.player.setPath([], false); // stop after current step
    }
    this.player.setAction(action);
    return true;
  }

  walkTo(tile) {
    if (!this.world.inBounds(tile.x, tile.y)) return;
    const start = this.playerTile();
    if (start.x === tile.x && start.y === tile.y) { this.player.clearAction(); return; }
    let path = findPath(this.pathCfg(), start, tile, {});
    if (!path.length) path = findPath(this.pathCfg(), start, tile, { reachAdjacent: true });
    if (path.length) { this.player.setPath(path, this.canRun()); this.player.clearAction(); }
  }

  attackNpc(npc) {
    if (!npc.attackable) { this.msg("You can't attack that."); return; }
    this.beginAction({ type: 'attack', npc }, { x: npc.x, y: npc.y }, true);
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
      case 'bank': return this.beginAction({ type: 'openbank', target: tgt }, tgt, true);
      case 'shrine': return this.beginAction({ type: 'pray', obj }, tgt, true);
      case 'rest': return this.beginAction({ type: 'rest', obj }, tgt, true);
      case 'agility': return this.beginAction({ type: 'agility', obj }, tgt, true);
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
    if (gi.qty <= 0) this.world.removeGroundItem(gi);
    else this.bus.emit('grounditems');
  }

  pickup(gi) {
    this.beginAction({ type: 'pickup', gi }, { x: gi.x, y: gi.y }, false);
  }

  // ---------------- Inventory / equipment actions ----------------
  eatItem(index) {
    const s = this.inventory.slotAt(index);
    if (!s) return;
    const item = getItem(s.id);
    if (!item.heal) { this.msg(`You can't eat the ${item.name.toLowerCase()}.`); return; }
    this.inventory.removeAt(index, 1);
    this.player.hp = Math.min(this.skills.hitpoints, this.player.hp + item.heal);
    this.msg(`You eat the ${item.name.toLowerCase()}.`);
    this.bus.emit('hp');
  }

  equipItem(index) {
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
    this.inventory.removeAt(index, 1);
    const prev = this.equipment.get(eq.slot);
    this.equipment.set(eq.slot, s.id);
    if (prev) this.inventory.add(prev, 1);
    this.msg(`You ${eq.slot === 'weapon' ? 'wield' : 'wear'} the ${item.name.toLowerCase()}.`);
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
    this.world.addGroundItem(id, qty, this.player.x, this.player.y);
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
  startSmelt(recipe, obj) { this.beginAction({ type: 'smelt', recipe, obj }, { x: obj.x, y: obj.y }, true); }
  startSmith(recipe, obj) { this.beginAction({ type: 'smith', recipe, obj }, { x: obj.x, y: obj.y }, true); }

  handleDialogueAction(action) {
    if (action === 'giveStarter') this.giveStarter();
    else if (action === 'questStart') {
      if (this.quests.bone_collector === 'notStarted') {
        this.quests.bone_collector = 'active';
        this.msg('Quest started — A Bag of Bones: bring 10 bones to the Kampong Guide.', 'level');
      }
    } else if (action === 'questTurnIn') this.turnInBoneQuest();
  }

  turnInBoneQuest() {
    const q = this.quests.bone_collector;
    if (q === 'done') { this.msg('Thanks again, adventurer!', 'system'); return; }
    if (q !== 'active') { this.msg('Ask me about work first.', 'system'); return; }
    if (this.inventory.count('bones') < 10) { this.msg('Come back when you have 10 bones.', 'system'); return; }
    this.inventory.remove('bones', 10);
    this.inventory.add('coins', 1000);
    this.inventory.add('amulet_of_strength', 1);
    this.skills.addXp('prayer', 500);
    this.quests.bone_collector = 'done';
    this.msg('Quest complete — A Bag of Bones! 1000 coins, Prayer XP and an amulet of strength.', 'level');
    this.banner('<span class="big">Quest complete!</span>A Bag of Bones');
  }

  // ---------------- Shop trading ----------------
  buyItem(shopId, itemId, qty = 1) {
    const shop = getShop(shopId);
    const price = Math.max(1, Math.round(getItem(itemId).value * shop.buyMul));
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
    const price = Math.max(1, Math.round(getItem(itemId).value * shop.sellMul));
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

  withdraw(itemId, qty) {
    const want = Math.min(qty, this.bank.count(itemId));
    const amount = this.inventory.canAdd(itemId, want);
    if (amount <= 0) { this.msg('Your inventory is full.'); return; }
    this.bank.withdraw(itemId, amount);
    this.inventory.add(itemId, amount);
  }

  // ---------------- Hover (per frame) ----------------
  updateHover() {
    if (!this.input || !this.ui) return;
    if (!this.input.inside) { this.hover = null; this.ui.setHoverText(null); return; }
    const tile = this.camera.screenToTile(this.input.mx, this.input.my);
    const npc = this.npcAt(tile.x, tile.y);
    if (npc) {
      if (npc.attackable) this.ui.setHoverText('Attack', `${npc.name} (level ${npc.def.level})`);
      else if (npc.def.role === 'shop') this.ui.setHoverText('Trade with', npc.name);
      else if (npc.def.role === 'bank') this.ui.setHoverText('Bank', npc.name);
      else this.ui.setHoverText('Talk to', npc.name);
      return;
    }
    const gi = this.world.topGroundItemAt(tile.x, tile.y);
    if (gi) { this.ui.setHoverText('Take', getItem(gi.id).name); return; }
    const obj = this.world.objectAt(tile.x, tile.y);
    if (obj && obj.def.verb) {
      if (obj.def.type === 'tree' && obj.depleted) this.ui.setHoverText('Walk here', '');
      else this.ui.setHoverText(obj.def.verb, obj.def.name);
      return;
    }
    this.ui.setHoverText('Walk here', '');
  }

  // ---------------- Input entrypoints ----------------
  onLeftClick(sx, sy) {
    this.ui?.hideContextMenu();
    const tile = this.camera.screenToTile(sx, sy);
    if (!this.world.inBounds(tile.x, tile.y)) return;
    const npc = this.npcAt(tile.x, tile.y);
    if (npc) { this.defaultNpcAction(npc); return; }
    const gi = this.world.topGroundItemAt(tile.x, tile.y);
    if (gi) { this.pickup(gi); return; }
    const obj = this.world.objectAt(tile.x, tile.y);
    if (obj && obj.def.verb && !(obj.def.type === 'tree' && obj.depleted)) { this.defaultObjectAction(obj); return; }
    this.walkTo(tile);
  }

  onRightClick(sx, sy) {
    const tile = this.camera.screenToTile(sx, sy);
    if (!this.world.inBounds(tile.x, tile.y)) { this.ui?.hideContextMenu(); return; }
    const options = [];
    const npc = this.npcAt(tile.x, tile.y);
    if (npc) {
      if (npc.attackable) options.push({ label: 'Attack', target: `${npc.name} (level ${npc.def.level})`, fn: () => this.attackNpc(npc) });
      if (npc.def.role === 'shop') options.push({ label: 'Trade with', target: npc.name, fn: () => this.defaultNpcAction(npc) });
      if (npc.def.role === 'bank') options.push({ label: 'Bank', target: npc.name, fn: () => this.defaultNpcAction(npc) });
      if (npc.def.role === 'dialogue') options.push({ label: 'Talk to', target: npc.name, fn: () => this.defaultNpcAction(npc) });
      if (npc.def.role) options.push({ label: 'Pickpocket', target: npc.name, fn: () => this.startPickpocket(npc) });
      options.push({ label: 'Examine', target: npc.name, fn: () => this.msg(npc.def.examine, 'system') });
    }
    for (const g of this.world.groundItemsAt(tile.x, tile.y)) {
      options.push({ label: 'Take', target: getItem(g.id).name, fn: () => this.pickup(g) });
    }
    const obj = this.world.objectAt(tile.x, tile.y);
    if (obj) {
      if (obj.def.verb && !(obj.def.type === 'tree' && obj.depleted)) {
        options.push({ label: obj.def.verb, target: obj.def.name, fn: () => this.defaultObjectAction(obj) });
      }
      options.push({ label: 'Examine', target: obj.def.name, fn: () => this.msg(obj.def.examine, 'system') });
    }
    options.push({ label: 'Walk here', target: '', fn: () => this.walkTo(tile) });
    this.ui?.showContextMenu(sx, sy, options);
  }
}
