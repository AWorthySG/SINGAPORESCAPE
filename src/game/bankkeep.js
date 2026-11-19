// "Deposit loot": the bank's one-tap deposit that keeps what you'll want back
// out. Deposit all also banked your axe, pickaxe, net and coins, so every bank
// trip ended with withdrawing the same tools again. Deposit loot leaves in the
// pack every tool, your coins and anything on your keep list; the list is set
// per item from the bank's menu ("Always keep" / "Stop keeping") and saved as
// game.bankKeep (an optional field: older saves start with an empty list).
import { getItem } from '../data/items.js';

// Kept however the list is set: you need them for fares, shops and fees.
const ALWAYS = new Set(['coins']);
// A keep list is a handful of ids; more than this is a corrupt save.
export const KEEP_MAX = 60;

/** The keep list for this save (created on first use). */
export function keepList(game) {
  if (!(game.bankKeep instanceof Set)) game.bankKeep = new Set(Array.isArray(game.bankKeep) ? game.bankKeep : []);
  return game.bankKeep;
}

/** On the player's own keep list? */
export const isKept = (game, id) => keepList(game).has(id);

/** Does Deposit loot leave this item in the pack? Tools, coins and kept items. */
export function staysInPack(game, id) {
  return ALWAYS.has(id) || !!getItem(id)?.tool || isKept(game, id);
}

/** Add an item to the keep list, or take it off. Returns the new state. */
export function toggleKeep(game, id) {
  const list = keepList(game);
  if (list.has(id)) list.delete(id);
  else if (list.size < KEEP_MAX) list.add(id);
  game.saveSoon = true;
  return list.has(id);
}

/** Bank everything except what stays in the pack. Returns how many items moved. */
export function depositLoot(game) {
  const ids = [...new Set(game.inventory.slots.filter(Boolean).map((s) => s.id))].filter((id) => !staysInPack(game, id));
  let moved = 0;
  for (const id of ids) {
    const n = game.inventory.count(id);
    if (n > 0) { for (const p of game.inventory.take(id, n)) game.bank.deposit(id, p.n, p.q); moved += n; }
  }
  game.msg(moved ? 'You bank your loot and keep your tools.' : 'Nothing to bank: your pack holds only tools and kept items.', 'system');
  return moved;
}

// ---------------- Saving ----------------
export const serializeKeep = (game) => [...keepList(game)];

/** Load the saved list (older saves have none): only real item ids. */
export function loadKeep(game, data) {
  const ok = (id) => { try { return typeof id === 'string' && !!getItem(id); } catch { return false; } };
  game.bankKeep = new Set(Array.isArray(data) ? data.filter(ok).slice(0, KEEP_MAX) : []);
}
