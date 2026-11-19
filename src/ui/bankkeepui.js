// The bank's Deposit loot button and keep list (src/game/bankkeep.js): the
// button beside Deposit all, the "Always keep" / "Stop keeping" line in an
// item's menu, and a small pin on kept items. ui.js only calls in here.
import { depositLoot, isKept, toggleKeep, staysInPack } from '../game/bankkeep.js';

/** The Deposit loot button, for the inventory column's header. */
export function depositLootButton(ui) {
  const b = document.createElement('button');
  b.className = 'bank-deposit-all bank-deposit-loot';
  b.textContent = 'Deposit loot';
  b.title = 'Bank everything except your tools, coins and kept items (set an item to Always keep from its menu)';
  b.addEventListener('click', () => depositLoot(ui.game));
  return b;
}

/** The keep-list line for an item's menu. */
export function keepMenuItem(ui, id) {
  const kept = isKept(ui.game, id);
  return { label: kept ? 'Stop keeping' : 'Always keep', fn: () => { toggleKeep(ui.game, id); ui._refreshModalIfOpen?.(['bank']); } };
}

/** Pin an inventory cell that Deposit loot leaves in the pack (tools, coins, kept items). */
export function markKept(ui, cell, id) {
  if (!staysInPack(ui.game, id)) return cell;
  cell.classList.add('bank-kept');
  return cell;
}
