import { Character } from './character.js';
import { getNpc } from '../data/npcs.js';
import { findPath } from '../engine/pathfinding.js';
import { chebyshev, randInt, uid } from '../core/utils.js';
import { AGGRO_FORGET_TILES } from '../config.js';

// A world NPC. Monsters fight/wander; townsfolk just wander or stand still.
export class NPC extends Character {
  constructor(npcId, x, y, wander = 0) {
    super(x, y);
    this.entityId = uid();
    this.npcId = npcId;
    this.def = getNpc(npcId);
    this.spawnX = x;
    this.spawnY = y;
    this.wander = wander || this.def.wander || 0;

    this.maxHp = this.def.maxHp || 1;
    this.hp = this.maxHp;
    this.alive = true;
    this.respawnTimer = 0;

    this.target = null;           // current foe (the player)
    this.attackCooldown = 0;      // ticks until next attack
    this.wanderCooldown = randInt(2, 8);
    this.repathCooldown = 0;
    this.lastTargetTile = null;
    this.combatLatch = 0;         // ticks left showing in-combat HP bar
  }

  get attackable() { return !!this.def.attackable && this.alive; }
  get name() { return this.def.name; }

  isAdjacentTo(tile) {
    return chebyshev(this.x, this.y, tile.x, tile.y) <= 1;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this.combatLatch = 12;
    return this.hp;
  }

  // ---------------- Per-tick AI ----------------
  tick(game) {
    if (!this.alive) {
      if (this.respawnTimer > 0 && --this.respawnTimer <= 0) this.respawn();
      return;
    }
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.repathCooldown > 0) this.repathCooldown--;
    if (this.combatLatch > 0) this.combatLatch--;

    if (this.def.attackable) {
      this._combatAI(game);
    } else {
      this._wanderAI(game);
    }
  }

  _combatAI(game) {
    const player = game.player;
    // Acquire a target through aggression.
    if (!this.target && this.def.aggressive && player.alive) {
      const range = this.def.aggroRange || 4;
      const distToPlayer = chebyshev(this.x, this.y, player.x, player.y);
      const distToSpawn = chebyshev(this.x, this.y, this.spawnX, this.spawnY);
      const tooStrong = game.skills.combatLevel() > this.def.level * 2 + 1;
      if (distToPlayer <= range && distToSpawn <= this.wander + range && !tooStrong) {
        this.target = player;
      }
    }

    if (this.target) {
      // Drop target if it's gone, dead, or we've been led too far from home.
      const leash = this.wander + AGGRO_FORGET_TILES;
      if (!this.target.alive || chebyshev(this.x, this.y, this.spawnX, this.spawnY) > leash) {
        this.target = null;
        this._returnHome(game);
        return;
      }
      const t = this.target;
      if (this.isAdjacentTo(t)) {
        this.stop();
        if (this.attackCooldown <= 0) {
          game.resolveNpcAttack(this);
          this.attackCooldown = this.def.attackSpeed || 4;
        }
      } else if (!this.isMoving || this.repathCooldown <= 0) {
        // Chase: path to a tile adjacent to the target.
        if (!this.lastTargetTile || this.lastTargetTile.x !== t.x || this.lastTargetTile.y !== t.y) {
          const path = findPath(game.pathCfg(), { x: this.x, y: this.y }, { x: t.x, y: t.y },
            { reachAdjacent: true, maxNodes: 2000 });
          if (path.length) this.setPath(path);
          this.lastTargetTile = { x: t.x, y: t.y };
          this.repathCooldown = 1;
        }
      }
      return;
    }

    this._wanderAI(game);
  }

  _returnHome(game) {
    if (this.isMoving) return;
    const path = findPath(game.pathCfg(), { x: this.x, y: this.y },
      { x: this.spawnX, y: this.spawnY }, { maxNodes: 2000 });
    if (path.length) this.setPath(path);
  }

  _wanderAI(game) {
    if (this.wander <= 0 || this.isMoving) return;
    if (--this.wanderCooldown > 0) return;
    this.wanderCooldown = randInt(3, 10);
    const tx = this.spawnX + randInt(-this.wander, this.wander);
    const ty = this.spawnY + randInt(-this.wander, this.wander);
    if (tx === this.x && ty === this.y) return;
    if (game.world.isBlocked(tx, ty)) return;
    const path = findPath(game.pathCfg(), { x: this.x, y: this.y }, { x: tx, y: ty },
      { maxNodes: 1500 });
    if (path.length) this.setPath(path);
  }

  die() {
    this.alive = false;
    this.target = null;
    this.stopNow();
    this.respawnTimer = this.def.respawn || 15;
  }

  respawn() {
    this.alive = true;
    this.hp = this.maxHp;
    this.x = this.tx = this.spawnX;
    this.y = this.ty = this.spawnY;
    this.progress = 0;
    this.moving = false;
    this.attackCooldown = 0;
    this.combatLatch = 0;
  }
}
