// First-time tips: which one to show next, and remembering which were seen.
//
// Each tip shows once per save (the seen ids are saved with the game, see
// save.js), and Settings > Tips: Off stops them altogether. The toast itself
// lives in ui.js (showTip); this part has no DOM so it can be tested headlessly.
import { getItem } from '../data/items.js';
import { canWear } from '../data/classes.js';
import { compareGear, meetsReq } from '../game/gear.js';
import { STONE as UP_STONE } from '../game/mastery.js';

// The old per-device list of seen tips (before they were saved per character).
export const TIPS_KEY = 'singaporescape:tips';

export const TIPS = {
  move: 'Move with the <b>joystick</b> (or W A S D). Walk up to something and press <b>Interact</b> (E / Space) to chop, mine, fish, talk or fight.',
  auto: 'Tap <b>Auto battle</b> to hunt monsters for you. The &#9881; next to it sets when to eat and what to fight.',
  gear: 'A green <b>&#9650;</b> on an item means it beats what you wear. <b>Hold</b> (or hover) an item for details, or open Worn Equipment &gt; <b>Gear Guide</b>.',
  dodge: 'A boss marked the ground in <b>red</b>! Walk out before it fills up to dodge the hit.',
  champion: 'A gold-ringed <b>&#9733; Champion</b> is nearby: tougher than normal, with extra loot.',
  bounty: 'You have <b>daily bounties</b> in the Quest Journal: three kill targets that pay coins. The tracker on the left points the way.',
  upgrade: 'Your gear gains <b>mastery</b> with every kill. Spend upgrade stones to <b>enchant</b> it in Worn Equipment &gt; Gear mastery &amp; enchanting.',
};

/** The seen-tip ids for this save (created on first use). */
export function tipsSeen(game) {
  if (!(game.tipsSeen instanceof Set)) game.tipsSeen = new Set(Array.isArray(game.tipsSeen) ? game.tipsSeen : []);
  return game.tipsSeen;
}

/** The tip to show now, or null: none while tips are off, and never one this
 *  save has already seen. In order of urgency (a boss marker first). */
export function nextTip(game) {
  if (game.tipsOn === false) return null;
  const seen = tipsSeen(game);
  const p = game.player;
  const want = (id, cond) => !seen.has(id) && cond();
  if (want('dodge', () => game.hazards.length > 0)) return 'dodge';
  if (want('move', () => game.tickCount > 3)) return 'move';
  if (want('champion', () => game.npcs.some((n) => n.alive && n.champion && Math.abs(n.x - p.x) <= 10 && Math.abs(n.y - p.y) <= 10))) return 'champion';
  if (want('auto', () => game.totalKills >= 1)) return 'auto';
  if (want('gear', () => game.tickCount % 5 === 0 && game.inventory.slots.some((s) => s && getItem(s.id).equip
    && compareGear(s.id, game.equipment, null, s.q || null).verdict === 'upgrade' && meetsReq(s.id, game.skills).ok && canWear(game.jobClass, s.id)))) return 'gear';
  if (want('bounty', () => game.tickCount > 150)) return 'bounty';
  if (want('upgrade', () => game.inventory.count(UP_STONE) >= 10)) return 'upgrade';
  return null;
}

/** Mark a tip seen as soon as it shows (so a reload mid-tip can't repeat it),
 *  and have the game save soon. */
export function markTipSeen(game, id) {
  tipsSeen(game).add(id);
  game.saveSoon = true;
}

/** Every tip counted as seen (an imported character, or a save from before
 *  tips were saved whose device had already dismissed them all). */
export function markAllTipsSeen(game) {
  for (const id of Object.keys(TIPS)) tipsSeen(game).add(id);
  game.saveSoon = true;
}
