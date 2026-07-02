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
  playerAttackVsNpc, npcAttackVsPlayer, rollAttack, rollGuaranteed, combatXp,
  playerRangedVsNpc, combatXpRanged, playerMagicVsNpc, RANGED_STYLES,
  weaknessOf, WEAKNESS_BONUS, critChance, CRIT_MULT,
} from './combat.js';
import { ABILITIES, ABILITY_BY_ID } from '../data/abilities.js';
import { getSpell } from '../data/magic.js';
import { PRAYERS, PRAYER_BY_ID, PRAYER_GROUPS } from '../data/prayers.js';
import {
  resolveWoodcut, resolveMine, resolveFish, resolveCook,
  resolveSmelt, resolveSmith, resolveFiremake, resolveCraft, resolveDish,
} from './skilling.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { getShop } from '../data/shops.js';
import { RARE_DROP_TABLE } from '../data/npcs.js';
import { ACHIEVEMENTS, rewardFor } from '../data/achievements.js';
import { eligibleTasks, SLAYER_REWARDS } from '../data/slayer.js';
import { STATION_BY_ID, MRT_FARE } from '../data/transport.js';
import { LIFE_STAGES, LIFE_GRAD, LIFE_STAGES_ADV, LIFE_GRAD_ADV } from '../data/lifeskills.js';
import { QUESTS, CHAMPION_QP, REDEMPTION_GOAL, CORRUPTION_GOAL } from '../data/quests.js';
import { CLUE_TIERS, CLUE_SPOTS, clueTierForLevel } from '../data/clues.js';

const STARTER_TOOLS = ['bronze_axe', 'bronze_pickaxe', 'small_net', 'fishing_rod', 'tinderbox', 'hammer', 'chisel', 'bronze_dagger'];
const COMBAT_SKILLS = new Set(['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic']);

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
    this.player.hp = this.maxHp();

    this.npcs = data.npcSpawns.map((s) => new NPC(s.npcId, s.x, s.y, s.wander, s.opts));

    this.camera = new Camera();
    this.ui = null;     // set by main
    this.input = null;  // set by main

    this.running = false;
    this.runEnergy = 100;
    this.effects = [];
    this.particles = [];
    // Screen-shake state (big hits, boss slams). Decays over shakeDur ms.
    this.shakeT = 0;
    this.shakeDur = 1;
    this.shakeMag = 0;
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
      champion: { state: 'notStarted', startBoss: 0 },
      redemption: { state: 'notStarted', baseGood: 0 },
      corruption: { state: 'notStarted', baseEvil: 0 },
    };

    // Achievement / collection-log progress.
    this.totalKills = 0;
    this.bossKills = 0;
    this.zonesVisited = new Set();
    this.achievements = new Set();
    this.kills = {}; // per-monster kill counts (bestiary)

    // Slayer task system.
    this.slayer = { task: null, points: 0, completed: 0 };

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
    this.abilityCd = {};          // ability id -> ticks until usable again
    this.braceTicks = 0;          // ticks of halved incoming damage left

    // Celebratory sparkle on level up; new milestones may unlock on level/quest changes.
    this.bus.on('levelup', (p) => {
      const c = this.player.renderCenter();
      this.spawnSparkle(this.player, '#ffe24a', 18);
      this.spawnPoof(c.x, c.y - 6, '#fff3a0');
      // Advancing a combat skill invigorates you — restore some health.
      if (this.player.alive && COMBAT_SKILLS.has(p?.skill)) {
        this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.ceil(this.maxHp() * 0.1));
        this.bus.emit('hp');
      }
      this.checkAchievements();
    });
    this.bus.on('quest', () => this.checkAchievements());

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
    this.prayerPoints = this.skills.prayer;
    this.bus.emit('prayer');
    this.updateRegion();
    this.checkAchievements(true);
    this.bus.emit('achievement');
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
    this.player.hp = this.maxHp();
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

  /** Max hitpoints = Hitpoints level + any bonus HP from equipment. */
  maxHp() { return this.skills.hitpoints + (this.equipment.bonuses().hp || 0); }

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
    this.effects.push({ type: 'hitsplat', entity, dmg, crit: !!opts.crit, life: 1100 });
    if (opts.crit && dmg > 0) this.addShake(2.5, 180); // crits thump the screen a little
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
    attacker.swing = 180;
    // Turn to face the foe so the sprite isn't swinging backwards.
    if (Math.abs(dx) > 2) attacker.facing = { dx: Math.sign(dx), dy: 0 };
  }

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
    this.camera.follow(c.x, c.y, 0.22, { width: this.world.width, height: this.world.height }, dt);

    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    // Harvest-judder timers on world objects (trees/rocks being worked).
    for (const o of this.world.objects) if (o.shakeT > 0) o.shakeT = Math.max(0, o.shakeT - dt);

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

  _deathBurst(npc) {
    const c = npc.renderCenter();
    this.spawnHitSparks(npc, '#ffd9b0');
    this.spawnPoof(c.x, c.y - 4, npc.def.color || '#caa15a');
    this.bus.emit('sfx', npc.def.boss ? 'bossdie' : 'die');
    if (npc.def.boss) { this.spawnSparkle(npc, '#ffd24a', 20); this.spawnPoof(c.x, c.y - 8, '#ff7a3a'); this.addShake(5, 340); }
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

  // Drifting ambient motes, tinted by region, to give the world some life.
  _spawnAmbient() {
    if (Math.random() < 0.5) return;
    const c = this.player.renderCenter();
    const x = c.x + (Math.random() - 0.5) * 360;
    const y = c.y + (Math.random() - 0.5) * 260;
    const zone = this.currentZoneName;
    let color = '#fff0b0';
    if (zone === 'Pulau Hantu') color = '#b58aff';
    else if (zone === 'The Wilderness') color = '#ff8a5a';
    else if (zone === 'MacRitchie Reservoir' || zone === 'Sentosa Beach') color = '#bfe8ff';
    else if (zone === 'Bukit Timah') color = '#dfff9a';
    this._pushParticle({
      x, y, vx: (Math.random() - 0.5) * 0.006, vy: -0.004 - Math.random() * 0.006, g: 0,
      life: 4200 + Math.random() * 2600, maxLife: 7000, size: 1 + Math.random() * 1.3, color, add: true,
    });
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
    if (this.player.alive) this._spawnAmbient();

    if (this.player.alive && ++this.regenCounter >= 100) {
      this.regenCounter = 0;
      if (this.player.hp < this.maxHp()) { this.player.hp++; this.bus.emit('hp'); }
    }
    this.updateRunEnergy();
    if (this.specEnergy < 100) { this.specEnergy = Math.min(100, this.specEnergy + 1); this.bus.emit('spec'); }
    this._tickCombatResources();
    this.drainPrayer();

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
        this.msg('You rest at the Hyco Education obelisk. Health and run energy restored.', 'system');
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
      if (dmg > 0) { this.spawnHitSparks(npc, (c.crit || fancy) ? '#ffd24a' : '#fff2b0'); for (const x of combatXp(this.player.style, dmg)) this.skills.addXp(x.skill, x.xp); }
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
    this.adrenaline = Math.min(100, this.adrenaline + n);
    this.bus.emit('adrenaline');
  }

  abilityUnlocked(ab) { return this.skills.combatLevel() >= (ab.unlock || 1); }

  /** Activate (or arm) a combat ability from the action bar / hotkey. */
  activateAbility(id) {
    const ab = ABILITY_BY_ID[id];
    if (!ab) return;
    if (!this.abilityUnlocked(ab)) { this.msg(`${ab.name} unlocks at combat level ${ab.unlock}.`, 'system'); return; }
    if ((this.abilityCd[id] || 0) > 0) { this.msg(`${ab.name} is on cooldown.`, 'system'); return; }
    if (this.adrenaline < ab.cost) { this.msg(`You need ${ab.cost}% adrenaline for ${ab.name}.`, 'system'); return; }
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
    if (!ab || ab.kind !== 'attack' || !this.abilityUnlocked(ab) || this.adrenaline < ab.cost || (this.abilityCd[ab.id] || 0) > 0) {
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
    const weak = weaknessOf(npc.def) === mode;
    let accM = (spec ? spec.acc || 1 : 1) * (weak ? WEAKNESS_BONUS.acc : 1);
    let dmgM = (spec ? spec.dmg || 1 : 1) * (ab ? ab.dmgMul || 1 : 1) * (weak ? WEAKNESS_BONUS.dmg : 1);
    // Magic casts once (rune cost), so its extra hits are ignored.
    const maxHits = mode === 'magic' ? 1 : Infinity;
    const hits = Math.min(maxHits, Math.max(spec ? spec.hits || 1 : 1, ab ? ab.hits || 1 : 1));
    const guaranteed = !!(ab && ab.guaranteed);
    const heal = spec ? spec.heal || 0 : 0;
    if (spec) { this.msg(`Special attack: ${spec.name}!`, 'combat'); this.spawnSparkle(this.player, '#ffd24a', 12); }
    if (ab) { this.msg(`Ability: ${ab.name}!`, 'combat'); this.spawnSparkle(this.player, '#ff9a3a', 10); this.bus.emit('sfx', 'spec'); }
    if (weak) this.spawnSparkle(npc, '#9affd0', 6);
    const lvl = mode === 'ranged' ? this.skills.ranged : mode === 'magic' ? this.skills.magic : this.skills.attack;
    const critCh = critChance(lvl, this.equipment.bonuses().crit);
    return { accM, dmgM, hits, guaranteed, heal, spec, ability: ab, weak, critCh };
  }

  /** Roll a critical hit on a landed blow: crits multiply damage by CRIT_MULT. */
  _critHit(dmg, critCh) {
    if (dmg > 0 && Math.random() < critCh) return { dmg: Math.max(dmg + 1, Math.round(dmg * CRIT_MULT)), crit: true };
    return { dmg, crit: false };
  }

  _applyPlayerHit(npc, dmg, opts = {}) {
    npc.takeDamage(dmg);
    this.addHitsplat(npc, dmg, opts);
    if (dmg > 0) { this.bus.emit('sfx', 'hit'); this._gainAdrenaline(10); }
  }
  _postAttack(npc) {
    if (!npc.target) npc.target = this.player; // provoke retaliation
    if (npc.hp <= 0) { this.killNpc(npc); this.player.clearAction(); }
  }

  /** A monster is winding up a heavy blow — flash a warning the player can react to. */
  npcTelegraph(npc) {
    this.spawnSparkle(npc, '#ff5a5a', 8);
    this.bus.emit('sfx', 'spec');
    if ((npc.def.level || 0) >= 30) this.msg(`${npc.name} is winding up a heavy attack — Brace yourself!`, 'combat');
  }

  _rangedAttack(npc) {
    const arrowIdx = this.inventory.slots.findIndex((s) => s && getItem(s.id).tags?.includes('ammo'));
    if (arrowIdx === -1) { this.msg('You have no arrows left.'); this.player.clearAction(); return; }
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
        this.inventory.removeAt(ai, 1);
      } else { this.inventory.removeAt(arrowIdx, 1); }
      const effMax = Math.max(1, Math.round(baseMax * mods.dmgM));
      let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollAttack(atkRoll * pr * mods.accM, defRoll, effMax);
      const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
      this._projectile(npc, (c.crit || fancy) ? '#ffd24a' : '#d9c45a');
      this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
      if (dmg > 0) { this.spawnHitSparks(npc, (c.crit || fancy) ? '#ffd24a' : '#cfe0a0'); for (const x of combatXpRanged(style, dmg)) this.skills.addXp(x.skill, x.xp); }
      total += dmg;
    }
    if (mods.heal && total > 0) { this.player.hp = Math.min(this.maxHp(), this.player.hp + Math.round(total * mods.heal)); this.bus.emit('hp'); }
    this.player.attackCooldown = Math.max(2, this.equipment.weaponSpeed() + (RANGED_STYLES[style]?.speedMod || 0));
    this._postAttack(npc);
  }

  _magicAttack(npc) {
    const spell = getSpell(this.player.spell);
    if (this.skills.magic < spell.level) { this.msg(`You need Magic level ${spell.level} to cast ${spell.name}.`); this.player.clearAction(); return; }
    if (!this._hasRunes(spell)) { this.msg(`You don't have the runes to cast ${spell.name}.`); this.player.clearAction(); return; }
    this._consumeRunes(spell);
    const { atkRoll, defRoll, max } = playerMagicVsNpc(this.skills, this.equipment, spell, npc.def);
    const mods = this._offensiveMods(npc, 'magic');
    const fancy = mods.spec || mods.ability;
    const effMax = Math.max(1, Math.round(max * mods.dmgM));
    let dmg = mods.guaranteed ? rollGuaranteed(effMax) : rollAttack(atkRoll * this.prayerMult().magic * mods.accM, defRoll, effMax);
    const c = this._critHit(dmg, mods.critCh); dmg = c.dmg;
    this._swingToward(this.player, npc.x, npc.y);
    this._projectile(npc, (c.crit || fancy) ? '#e0a0ff' : spell.tint);
    this._applyPlayerHit(npc, dmg, { crit: dmg > 0 && (c.crit || fancy || dmg >= effMax) });
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

  resolveNpcAttack(npc, opts = {}) {
    const p = this.player;
    if (!p.alive) return;
    this._swingToward(npc, p.x, p.y);
    const { atkRoll, defRoll, max } = npcAttackVsPlayer(npc.def, this.skills, this.equipment, p.style);
    const heavy = !!opts.heavy;
    let dmg = rollAttack(atkRoll, defRoll * this.prayerMult().def, heavy ? Math.round(max * 2) : max);
    if (heavy && dmg === 0) dmg = Math.max(1, Math.round(max * 1.2)); // a telegraphed blow always stings
    if (heavy) { this._slash(p, '#ff6a5a'); this.addShake(4, 260); }
    const prot = this.protectFactor();
    if (prot) dmg = Math.floor(dmg * (1 - prot));
    if (this.braceTicks > 0) dmg = Math.floor(dmg * 0.5); // the Brace ability soaks the blow
    p.takeDamage(dmg);
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

  killNpc(npc) {
    // Alignment: heroism vs cruelty. Bosses & aggressive foes are heroic to slay;
    // cutting down harmless creatures is a small evil.
    if (npc.def.boss) this.addGood(5);
    else if (npc.def.aggressive) this.addGood(1);
    else this.addEvil(1);
    if (npc.def.boss) {
      this.msg(`You have slain ${npc.name}!`, 'combat');
      this.banner(`<span class="big">${npc.name} defeated!</span>The spoils are yours.`);
    } else {
      this.msg(`You have defeated the ${npc.name}.`, 'combat');
    }
    this.totalKills++;
    this.kills[npc.npcId] = (this.kills[npc.npcId] || 0) + 1;
    if (npc.def.boss) this.bossKills++;
    if ((npc.def.boss && this.quests.island_defender.state === 'active') ||
        this.quests.big_game_hunter.state === 'active') this.bus.emit('quest');
    this.progressSlayer(npc);
    this.checkAchievements();
    this._deathBurst(npc);
    this.rollDrops(npc);
    npc.die();
    if (this.player.target === npc) this.player.target = null;
    const pc = this.quests.pest_control;
    if (pc.state === 'active' && npc.npcId === 'rat') {
      pc.kills++;
      if (pc.kills >= 8) {
        pc.state = 'done';
        this.inventory.add('coins', 600);
        this.skills.addXp('attack', 300);
        this.msg('Quest complete — Pest Control! 600 coins and Attack XP.', 'level');
        this.banner('<span class="big">Quest complete!</span>Pest Control');
      } else this.msg(`Pest Control: ${pc.kills}/8 giant rats slain.`, 'system');
      this.bus.emit('quest');
    }
  }

  // ---------------- Region / Wilderness ----------------
  updateRegion() {
    const z = this.world.zoneAt(this.player.x, this.player.y);
    const name = z ? z.name : 'Singapore';
    const wild = !!(z && z.wilderness);
    const lvl = wild ? Math.max(1, Math.floor((this.player.x - 94) / 3) + 1) : 0;
    if (z && !this.zonesVisited.has(name)) { this.zonesVisited.add(name); this.checkAchievements(); }
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
    // Treasure trails: a rare clue scroll, if you aren't already carrying one.
    if (!this.clue && !this._holdsClue()) {
      const clueChance = Math.min(0.05, (def.level || 1) / 3000 + (def.boss ? 0.04 : 0.006));
      if (Math.random() < clueChance) {
        const tier = clueTierForLevel(def.level || 1);
        this.world.addGroundItem(CLUE_TIERS[tier].item, 1, npc.x, npc.y);
        this.msg('A clue scroll drops to the ground!', 'level');
      }
    }
  }

  _holdsClue() { return this.inventory.slots.some((s) => s && s.id.startsWith('clue_scroll_')); }

  // ---------------- New skills: Prayer, Thieving, Agility ----------------
  buryBones(index) {
    const s = this.inventory.slotAt(index);
    if (!s || s.id !== 'bones') { this.msg('You can only bury bones.'); return; }
    this.inventory.removeAt(index, 1);
    this.skills.addXp('prayer', 4.5);
    this.addGood(1); // honouring the dead is a small good
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
    n.temporary = temporary;
    if (temporary) this.hasTemps = true;
    this.npcs.push(n);
    return n;
  }

  bossSpecial(npc) {
    const p = this.player;
    if (!p.alive) return;
    this.addShake(3.5, 280);
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

  /** Long-range walk used by the world map; snaps to the nearest walkable tile. */
  walkToFar(tile) {
    const t = this._nearestFree(tile.x, tile.y);
    if (!t) { this.msg("I can't reach there."); return; }
    if (this.playerTile().x === t.x && this.playerTile().y === t.y) return;
    const path = findPath(this.pathCfg(), this.playerTile(), t, { maxNodes: 40000 });
    if (path.length) { this.player.setPath(path, this.canRun()); this.player.clearAction(); this.msg('You set off across the island.', 'system'); }
    else this.msg("I can't find a path there.");
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
      case 'craft': return this.beginAction({ type: 'craftmenu', obj, target: tgt }, tgt, true);
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
  startDish(obj, recipe) { this.beginAction({ type: 'cookdish', obj, recipe }, { x: obj.x, y: obj.y }, true); }
  startSmelt(recipe, obj) { this.beginAction({ type: 'smelt', recipe, obj }, { x: obj.x, y: obj.y }, true); }
  startSmith(recipe, obj) { this.beginAction({ type: 'smith', recipe, obj }, { x: obj.x, y: obj.y }, true); }
  startCraft(recipe, obj) { this.beginAction({ type: 'craft', recipe, obj }, { x: obj.x, y: obj.y }, true); }

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
      if (q.state === 'notStarted') { q.state = 'active'; this.msg('Quest started — Pillars of the Island: pray at the A-Worthy Monument and rest at the Hyco Education obelisk.', 'level'); }
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
    const label = which === 'monument' ? 'A-Worthy Monument' : 'Hyco Education obelisk';
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
    const price = Math.max(1, Math.round(getItem(itemId).value * shop.buyMul * this.karmaFactor().buy));
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
    const price = Math.max(1, Math.round(getItem(itemId).value * shop.sellMul * this.karmaFactor().sell));
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
  updateHover() {
    if (!this.input || !this.ui) return;
    if (!this.input.inside) { this.hover = null; this.ui.setHoverText(null); return; }
    const tile = this.camera.screenToTile(this.input.mx, this.input.my);
    const npc = this.npcAt(tile.x, tile.y);
    if (npc) {
      this.hover = { npc };
      if (npc.attackable) this.ui.setHoverText('Attack', `${npc.name} (level ${npc.def.level})`);
      else if (npc.def.role === 'shop') this.ui.setHoverText('Trade with', npc.name);
      else if (npc.def.role === 'bank') this.ui.setHoverText('Bank', npc.name);
      else this.ui.setHoverText('Talk to', npc.name);
      return;
    }
    const gi = this.world.topGroundItemAt(tile.x, tile.y);
    if (gi) { this.hover = null; this.ui.setHoverText('Take', getItem(gi.id).name); return; }
    const obj = this.world.objectAt(tile.x, tile.y);
    if (obj && obj.def.verb) {
      if (obj.def.type === 'tree' && obj.depleted) { this.hover = null; this.ui.setHoverText('Walk here', ''); return; }
      this.hover = { obj };
      this.ui.setHoverText(obj.def.verb, obj.def.name);
      return;
    }
    this.hover = null;
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
