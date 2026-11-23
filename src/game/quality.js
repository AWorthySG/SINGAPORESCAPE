import { QUALITY_ORDER } from './loot.js';
import { EQUIP_SLOTS } from './equipment.js';

// Gear quality on each copy (see loot.js for the tiers and their stat gains).
//
// Old saves kept quality as a tally per item id ("2 Fine and 1 Epic iron
// swords dropped"), not on the copies. On load the tally is handed out to the
// copies of that item you own, best quality first: the copies you wear, then
// the pack, then the bank. Copies beyond the tally stay plain, and a tally
// beyond the copies you own is dropped (those copies were sold or used up).

/** Hand an old save's quality tally (Equipment.legacyQuality) out to the copies you own. */
export function assignLegacyQuality(game) {
  const eqp = game.equipment, tally = eqp.legacyQuality;
  eqp.legacyQuality = null;
  if (!tally) return;
  for (const [id, row] of Object.entries(tally)) {
    const best = [];   // the qualities to hand out, best first
    for (let i = QUALITY_ORDER.length - 1; i >= 0; i--) for (let k = 0; k < (row[i] || 0); k++) best.push(QUALITY_ORDER[i]);
    // Worn copies first.
    for (const s of EQUIP_SLOTS) {
      if (!best.length) break;
      if (eqp.get(s) === id && !eqp.qualityIn(s)) eqp.slotQuality[s] = best.shift();
    }
    // Then plain copies in the pack, then in the bank: each one taken out
    // and put back with its quality.
    for (const store of [game.inventory, game.bank]) {
      if (!store || !best.length) continue;
      const plain = store === game.inventory ? store.countQ(id, null)
        : store.items.filter((e) => e.id === id && !e.q).reduce((n, e) => n + e.qty, 0);
      const n = Math.min(plain, best.length);
      if (!n) continue;
      if (store === game.inventory) store.remove(id, n, null); else store.take(id, n, null);
      for (const q of best.splice(0, n)) {
        if (store === game.inventory) store.add(id, 1, q); else store.deposit(id, 1, q);
      }
    }
  }
  eqp._changed();
}
