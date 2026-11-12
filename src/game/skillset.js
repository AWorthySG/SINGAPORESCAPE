import { SKILL_IDS, startLevel } from '../data/skills.js';
import { levelForXp, xpForLevel, maxLevelFor, maxXpFor } from '../data/xp.js';
import { XP_RATE } from '../config.js';

// Tracks XP per skill and derives levels. Emits 'xp' and 'levelup' on the bus.
export class Skills {
  constructor(bus) {
    this.bus = bus;
    this.xp = {};
    for (const id of SKILL_IDS) this.xp[id] = xpForLevel(startLevel(id));
  }

  /** The Dancer's fighting level: Agility and Ranged experience pooled together
   *  (the Dancer's combat XP is split between them), so splitting it never slows
   *  a Dancer down and Ranged trained with a bow powers the whip as well. */
  danceLevel() { return levelForXp((this.xp.agility || 0) + (this.xp.ranged || 0), maxLevelFor('ranged')); }
  get dance() { return this.danceLevel(); }

  // Melee is one skill: Strength mirrors Attack (shown as "Melee"), so every
  // Strength requirement, perk and formula reads the Melee level.
  level(id) { const k = id === 'strength' ? 'attack' : id; return levelForXp(this.xp[k] ?? 0, maxLevelFor(k)); }

  /** Add experience; fires events; returns number of levels gained. */
  addXp(id, amount) {
    if (id === 'strength') id = 'attack';
    if (!(id in this.xp) || amount <= 0) return 0;
    amount *= XP_RATE;
    const before = this.level(id);
    this.xp[id] = Math.min(maxXpFor(id), this.xp[id] + amount);
    if (id === 'attack' && 'strength' in this.xp) this.xp.strength = this.xp.attack;
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
  get ranged() { return this.level('ranged'); }
  get magic() { return this.level('magic'); }
  get slayer() { return this.level('slayer'); }

  /** Combat level: the RuneScape formula up to 100, then it climbs much more
   *  slowly (100 + 6 x the square root of the rest), so bosses that scale with
   *  it (see Game._scaleBoss) don't run away from you as your skills soar.
   *  E.g. a raw 1000 is combat 280, a raw 13000 (level ~9999 everything) 781. */
  combatLevel() {
    const raw = this.rawCombatLevel();
    return raw <= 100 ? raw : Math.floor(100 + 6 * Math.sqrt(raw - 100));
  }

  rawCombatLevel() {
    const base = 0.25 * (this.defence + this.hitpoints + Math.floor(this.prayer / 2));
    const melee = 0.325 * (this.attack * 2);   // Melee counts for the old Attack + Strength, so levels don't drop
    const range = 0.325 * Math.floor(this.ranged * 1.5);
    const mage = 0.325 * Math.floor(this.magic * 1.5);
    const dance = 0.325 * Math.floor(this.danceLevel() * 1.5);   // the Dancer fights with Agility and Ranged
    return Math.floor(base + Math.max(melee, range, mage, dance));
  }

  totalLevel() {
    return SKILL_IDS.reduce((sum, id) => sum + (id === 'strength' ? 0 : this.level(id)), 0);
  }

  totalXp() {
    return SKILL_IDS.reduce((sum, id) => sum + (id === 'strength' ? 0 : this.xp[id] || 0), 0);
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
    // Older saves trained Attack and Strength apart: Melee keeps the higher of the two.
    this.xp.attack = Math.max(this.xp.attack || 0, this.xp.strength || 0);
    this.xp.strength = this.xp.attack;
  }
}
