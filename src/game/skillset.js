import { SKILL_IDS, startLevel } from '../data/skills.js';
import { levelForXp, xpForLevel, MAX_XP } from '../data/xp.js';
import { XP_RATE } from '../config.js';

// Tracks XP per skill and derives levels. Emits 'xp' and 'levelup' on the bus.
export class Skills {
  constructor(bus) {
    this.bus = bus;
    this.xp = {};
    for (const id of SKILL_IDS) this.xp[id] = xpForLevel(startLevel(id));
  }

  level(id) { return levelForXp(this.xp[id] ?? 0); }

  /** Add experience; fires events; returns number of levels gained. */
  addXp(id, amount) {
    if (!(id in this.xp) || amount <= 0) return 0;
    amount *= XP_RATE;
    const before = this.level(id);
    this.xp[id] = Math.min(MAX_XP, this.xp[id] + amount);
    const after = this.level(id);
    this.bus.emit('xp', { skill: id, amount, total: this.xp[id] });
    if (after > before) {
      for (let lvl = before + 1; lvl <= after; lvl++) {
        this.bus.emit('levelup', { skill: id, level: lvl });
      }
    }
    return after - before;
  }

  get attack() { return this.level('attack'); }
  get strength() { return this.level('strength'); }
  get defence() { return this.level('defence'); }
  get hitpoints() { return this.level('hitpoints'); }
  get prayer() { return this.level('prayer'); }
  get agility() { return this.level('agility'); }

  combatLevel() {
    const base = 0.25 * (this.defence + this.hitpoints + Math.floor(this.prayer / 2));
    const melee = 0.325 * (this.attack + this.strength);
    return Math.floor(base + melee);
  }

  totalLevel() {
    return SKILL_IDS.reduce((sum, id) => sum + this.level(id), 0);
  }

  totalXp() {
    return SKILL_IDS.reduce((sum, id) => sum + (this.xp[id] || 0), 0);
  }

  serialize() { return { ...this.xp }; }

  load(data) {
    if (!data) return;
    for (const id of SKILL_IDS) {
      if (typeof data[id] === 'number') this.xp[id] = data[id];
    }
    // Floor every skill up to its starting baseline so older / weak saves
    // automatically receive the buffed starting stats.
    for (const id of SKILL_IDS) {
      const floor = xpForLevel(startLevel(id));
      if ((this.xp[id] || 0) < floor) this.xp[id] = floor;
    }
  }
}
