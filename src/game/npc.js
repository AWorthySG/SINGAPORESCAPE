import { Character } from './character.js';
import { getNpc } from '../data/npcs.js';
import { findPath } from '../engine/pathfinding.js';
import { chebyshev, randInt, uid } from '../core/utils.js';
import { AGGRO_FORGET_TILES } from '../config.js';

// Build a per-instance def from the shared registry entry plus spawn overrides.
// Supported opts: { aggressive:false } pacifies a mob; { statMul:n } scales its
// combat stats (hp/attack/strength/defence/maxHit) for easier or harder spawns.
function applySpawnOpts(base, opts) {
  const def = { ...base };
  if (opts.aggressive === false) { def.aggressive = false; def.aggroRange = 0; }
  if (opts.statMul && opts.statMul > 0) {
    const m = opts.statMul;
    def.maxHp = Math.max(2, Math.round((base.maxHp || 1) * m));
    def.attack = Math.max(1, Math.round((base.attack || 1) * m));
    def.strength = Math.max(1, Math.round((base.strength || 1) * m));
    def.defence = Math.max(1, Math.round((base.defence || 1) * m));
    def.maxHit = Math.max(1, Math.round((base.maxHit || 1) * m));
  }
  return def;
}

// A world NPC. Monsters fight/wander; townsfolk just wander or stand still.
export class NPC extends Character {
  constructor(npcId, x, y, wander = 0, opts = null) {
    super(x, y);
    this.entityId = uid();
    this.npcId = npcId;
    // Per-spawn tweaks (e.g. gentle starter monsters) override a private copy of
    // the def so the shared registry entry — and every other spawn — is untouched.
    this._spawnOpts = opts;
    this.def = opts ? applySpawnOpts(getNpc(npcId), opts) : getNpc(npcId);
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
    this.specialCooldown = this.def.specialEvery || 9; // boss special cadence
    this.enraged = false;
    this.temporary = false;       // summoned adds are removed on death
    // Telegraphed heavy attacks: regular monsters of level >= 12 wind up a strong
    // hit every few swings, giving the player a moment to Brace or back off.
    this.heavyEvery = (!this.def.boss && (this.def.level || 0) >= 12) ? randInt(3, 6) : 0;
    this.heavyCount = 0;
    this.windup = 0;              // 1 while a heavy blow is charging
    this.telegraph = 0;          // ticks the "!" warning is shown
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
    if (this.specialCooldown > 0) this.specialCooldown--;
    if (this.telegraph > 0) this.telegraph--;

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
        if (this.def.boss && this.specialCooldown <= 0) {
          game.bossSpecial(this);
          this.specialCooldown = this.def.specialEvery || 9;
        }
        if (this.attackCooldown <= 0) {
          const speed = Math.max(2, (this.def.attackSpeed || 4) - 2);
          if (this.windup > 0) {
            this.windup = 0;                     // the telegraphed heavy blow lands now
            game.resolveNpcAttack(this, { heavy: true });
            this.attackCooldown = speed;
          } else if (this.heavyEvery > 0 && ++this.heavyCount >= this.heavyEvery) {
            this.heavyCount = 0;                  // wind up: warn this tick, strike next
            this.windup = 1;
            this.telegraph = 2;
            game.npcTelegraph(this);
            this.attackCooldown = 1;             // the brief pause is the visible tell
          } else {
            game.resolveNpcAttack(this);
            this.attackCooldown = speed;
          }
        }
      } else if (!this.isMoving || this.repathCooldown <= 0) {
        // Chase: path to a tile adjacent to the target. Plan from the tile we're
        // stepping onto (not the stale one) so a mid-step repath continues
        // smoothly instead of jittering backwards.
        if (!this.lastTargetTile || this.lastTargetTile.x !== t.x || this.lastTargetTile.y !== t.y) {
          const path = findPath(game.pathCfg(), this.stepTile(), { x: t.x, y: t.y },
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
    this.deathT = 420; // ms of fall-over + fade-out animation
  }

  update(dt) {
    if (!this.alive && this.deathT > 0) this.deathT = Math.max(0, this.deathT - dt);
    super.update(dt);
  }

  respawn() {
    this.alive = true;
    this.deathT = 0;
    // Restore any enrage-mutated stats, re-applying this spawn's overrides so
    // tamed/weakened monsters stay tamed after they come back.
    this.def = this._spawnOpts ? applySpawnOpts(getNpc(this.npcId), this._spawnOpts) : getNpc(this.npcId);
    this.maxHp = this.def.maxHp || 1;
    this.hp = this.maxHp;
    this.x = this.tx = this.spawnX;
    this.y = this.ty = this.spawnY;
    this.progress = 0;
    this.moving = false;
    this.attackCooldown = 0;
    this.combatLatch = 0;
    this.enraged = false;
    this.specialCooldown = this.def.specialEvery || 9;
    this.windup = 0;
    this.telegraph = 0;
    this.heavyCount = 0;
  }
}
