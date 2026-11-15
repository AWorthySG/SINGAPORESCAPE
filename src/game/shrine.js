// The Offering Shrine in Kampong Glam: a long-term sink for every life-skill
// material. Donating a material turns it into shrine points (a tenth of its
// value, see materialPoints in materials.js); points buy ranks in five
// blessings, each a permanent offensive bonus for your fighter. The bonuses
// join your life skill perks on top of your gear (Game.outsideBonuses, which
// Equipment.extra reads), so they count in every fight and show in the
// Equipment panel totals.
//
// Ranks have no cap; the price of each rank grows (100 x rank^1.5 points), so
// the first few come quickly and the later ones are a long goal:
//   rank 1: 100   rank 5: 1,118   rank 10: 3,162   rank 25: 12,500   rank 50: 35,355
//   (about 14,000 points in all to reach rank 10 on one blessing).
// Ten minutes of level-appropriate gathering is roughly 300-1,000 points, so a
// blessing's first ranks come in one sitting, rank 10 takes some 3-8 hours of
// gathering, and five blessings at rank 25 or more are a very long goal.

// id -> { name, per (the bonus each rank adds), label (shown per rank) }.
export const SHRINE_TRACKS = {
  might: { name: 'Might', per: { atkPct: 1, magPct: 1 }, label: '+1% Physical and Magic damage bonus (all damage)' },
  precision: { name: 'Precision', per: { crit: 0.5 }, label: '+0.5% crit chance' },
  ferocity: { name: 'Ferocity', per: { critDmg: 2 }, label: '+2% crit damage' },
  swiftness: { name: 'Swiftness', per: { haste: 1 }, label: '+1% attack speed' },
  giantslayer: { name: 'Giantslayer', per: { bossDmg: 2 }, label: '+2% boss and champion damage' },
};
export const SHRINE_TRACK_IDS = Object.keys(SHRINE_TRACKS);

/** Shrine points it costs to reach `rank` (from the rank below). */
export function shrineCost(rank) {
  return Math.round(100 * Math.max(1, rank) ** 1.5);
}

/** A blessing's bonuses at a rank: { atkPct: 3, magPct: 3 } and so on. */
export function trackBonus(track, rank) {
  const out = {};
  for (const [k, v] of Object.entries(SHRINE_TRACKS[track]?.per || {})) out[k] = Math.round(v * rank * 10) / 10;
  return out;
}

/** "+3% Physical damage bonus, +3% Magic bonus" style summary of a blessing at a rank. */
export function trackText(track, rank) {
  const t = SHRINE_TRACKS[track];
  if (!t) return '';
  const b = trackBonus(track, rank);
  const names = { atkPct: 'Physical damage bonus', magPct: 'Magic bonus', crit: 'crit chance', critDmg: 'crit damage', haste: 'attack speed', bossDmg: 'boss damage' };
  return Object.entries(b).map(([k, v]) => `+${v}% ${names[k] || k}`).join(', ');
}

export class Shrine {
  constructor() {
    this.points = 0;   // shrine points donated and not yet spent
    this.ranks = {};   // track id -> rank
    this.rev = 0;      // bumped when the bonuses change, so cached totals know
  }

  rank(track) { return this.ranks[track] || 0; }
  nextCost(track) { return shrineCost(this.rank(track) + 1); }

  /** Every blessing's bonuses added together. */
  bonuses() {
    if (this._cache && this._cache.rev === this.rev) return this._cache.totals;
    const totals = {};
    for (const t of SHRINE_TRACK_IDS) {
      for (const [k, v] of Object.entries(trackBonus(t, this.rank(t)))) totals[k] = Math.round(((totals[k] || 0) + v) * 10) / 10;
    }
    this._cache = { rev: this.rev, totals };
    return totals;
  }

  /** Spend points on the next rank of a blessing. True if it ranked up. */
  rankUp(track) {
    if (!SHRINE_TRACKS[track]) return false;
    const c = this.nextCost(track);
    if (this.points < c) return false;
    this.points -= c;
    this.ranks[track] = this.rank(track) + 1;
    this.rev++;
    return true;
  }

  serialize() { return { points: this.points, ranks: { ...this.ranks } }; }

  /** Older saves have no shrine: everything starts at nothing. */
  load(data) {
    this.points = 0; this.ranks = {};
    if (data && typeof data === 'object') {
      if (typeof data.points === 'number' && data.points > 0) this.points = Math.floor(data.points);
      for (const t of SHRINE_TRACK_IDS) {
        const r = data.ranks?.[t];
        if (typeof r === 'number' && r > 0) this.ranks[t] = Math.floor(r);
      }
    }
    this.rev++;
  }
}
