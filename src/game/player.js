import { Character } from './character.js';
import { uid } from '../core/utils.js';

// The player. Holds combat/action state; skills, inventory and equipment live
// on the Game so the UI and save system can reach them directly.
export class Player extends Character {
  constructor(x, y) {
    super(x, y);
    this.entityId = uid();
    this.name = 'Adventurer';
    this.hp = 10;
    this.alive = true;

    this.target = null;        // NPC being attacked
    this.attackCooldown = 0;   // ticks until next swing
    this.action = null;        // pending interaction (resolved on arrival / each tick)

    this.style = 'accurate';   // melee combat style id
    this.rangedStyle = 'accurate'; // ranged style id
    this.spell = 'wind_strike';    // selected combat spell
    this.autoRetaliate = true;
    this.respawnTimer = 0;
  }

  setAction(action) {
    this.action = action;
    this.target = action && action.type === 'attack' ? action.npc : null;
  }

  clearAction() {
    this.action = null;
    this.target = null;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    return this.hp;
  }

  heal(amount, maxHp) {
    this.hp = Math.min(maxHp, this.hp + amount);
  }
}
