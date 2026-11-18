// Hunter onboarding for older saves: characters made before the starter kit
// had a hunting snare never got one, so Hunter traps looked broken to them.
// On loading a save, if there's no snare anywhere (pack, worn or bank), one is
// slipped into the pack (or the bank when the pack is full), once per save:
// game.snareGiven is saved, so it never happens again.
import { getItem } from '../data/items.js';

const isSnare = (id) => { try { return getItem(id).tool === 'snare'; } catch { return false; } };

/** Give a hunting snare once if the player has none. Returns true when one was given. */
export function ensureHunterSnare(game) {
  if (game.snareGiven) return false;
  game.snareGiven = true;
  const has = game.inventory.slots.some((s) => s && isSnare(s.id))
    || Object.values(game.equipment.slots || {}).some((id) => id && isSnare(id))
    || game.bank.items.some((e) => isSnare(e.id));
  if (has) return false;
  if (game.inventory.canAdd('hunting_snare', 1) > 0) game.inventory.add('hunting_snare', 1);
  else game.bank.deposit('hunting_snare', 1);
  game.msg('You found a hunting snare in your pack — Hunter traps are ready to use.', 'system');
  return true;
}
