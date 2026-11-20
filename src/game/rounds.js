// Gun ammunition: rounds for pistols and sniper rifles.
//
// Guns load rounds into their own ammo slot (Equipment.ammo, a stack of one
// kind of rounds), apart from the ten gear slots, so a stack of rounds never
// gets mastery, enchant lines, refine stars or quality like a piece of gear.
// Bows draw their arrows straight from the pack instead; a quiver is gear.
//
// A gun's own power is a third of its Ranged bonus (as it was before rounds);
// the loaded rounds add their `roundStr` on top. Out of rounds, a gun still
// fires plain shot at its own power, so a Pistoler or Sniper is never left
// unable to fight (auto battle never stalls for want of rounds), and the gun
// reloads from the best rounds in the pack whenever its slot runs dry.
//
// Like arrows (most are picked back up after a fight), only some shots use a
// round up: a rifle about one shot in five, as a bow does, and pistols, which
// fire four times as often as a bow, one shot in twenty.
import { getItem, ITEMS } from '../data/items.js';
import { CLASS_BY_ID, SECONDARY_WEAPON } from '../data/classes.js';

/** The weapon types that fire rounds. */
export const GUN_TYPES = new Set(['pistol', 'rifle']);
/** The chance that one shot uses up a round, by gun type. */
export const ROUND_SPEND = { pistol: 0.05, rifle: 0.2 };
/** Rounds loaded into a new Pistoler's or Sniper's ammo slot, and handed once
 *  to a gun user from before rounds (see grantStarterRounds). */
export const STARTER_ROUNDS = 999;
export const OLD_SAVE_ROUNDS = 500;
// The special rounds' effects, each on SPECIAL_CHANCE of the hits that land.
export const SPECIAL_CHANCE = 0.2;
export const INCENDIARY_SHARE = 0.3;   // fire: a burst of extra fire damage
export const FROST_SLOW_TICKS = 5;     // frost: the foe moves and attacks slower for 3s
export const SHOCK_SHARE = 0.5;        // shock: the bolt jumps to one foe nearby

export const isGunId = (weaponId) => !!weaponId && GUN_TYPES.has(getItem(weaponId)?.equip?.weaponType);
/** Is this item a stack of rounds (rather than arrows)? */
export const isRound = (id) => { try { return typeof getItem(id).roundStr === 'number'; } catch { return false; } };
/** Arrows, the ammo bows draw from the pack (rounds are ammo too, but only guns fire them). */
export const isArrow = (id) => { try { const it = getItem(id); return !!it.tags?.includes('ammo') && !isRound(id); } catch { return false; } };
/** Does this class fight with a gun (its main or its secondary weapon type)? */
export const classUsesGuns = (classId) => GUN_TYPES.has(CLASS_BY_ID[classId]?.weapon) || GUN_TYPES.has(SECONDARY_WEAPON[classId]);

/** The rounds a gun user picks up where an arrow drop would fall (see the loot in Game.killNpc):
 *  the same metal's rounds, with dragon arrows turning into obsidian rounds. */
export function roundsForArrow(arrowId) {
  const m = /^([a-z]+)_arrow$/.exec(arrowId || '');
  if (!m) return null;
  const id = m[1] === 'dragon' ? 'obsidian_rounds' : `${m[1]}_rounds`;
  return ITEMS[id] ? id : null;
}

/** The pack slot holding the strongest rounds (highest roundStr), or -1. */
export function bestRoundsIdx(inventory) {
  let best = -1, bs = -1;
  inventory.slots.forEach((sl, i) => {
    if (!sl || !isRound(sl.id)) return;
    const st = getItem(sl.id).roundStr;
    if (st > bs) { bs = st; best = i; }
  });
  return best;
}

/** How hard a gun shot hits before Ranged bonuses: the gun's own power (a third
 *  of its Ranged bonus) plus the loaded rounds' strength. `wpnEquip` is the gun's `equip`. */
export function gunShotStr(equipment, wpnEquip) {
  const base = Math.floor((wpnEquip?.bonuses?.ranged || 0) / 3);
  if (!GUN_TYPES.has(wpnEquip?.weaponType)) return base;
  const a = equipment.ammo;
  return base + (a && a.qty > 0 ? getItem(a.id).roundStr || 0 : 0);
}

/** Load the rounds in pack slot `index` into the ammo slot. Rounds of the same
 *  kind top the slot up; another kind swaps with what's loaded (it goes back to
 *  the pack). Returns true when loaded. */
export function loadRounds(game, index, { quiet = false } = {}) {
  const s = game.inventory.slotAt(index);
  if (!s || !isRound(s.id)) return false;
  const eq = game.equipment, cur = eq.ammo;
  if (cur && cur.id !== s.id && cur.qty > 0) {
    // The old rounds go back into the pack first (they need a place there).
    if (game.inventory.canAdd(cur.id, cur.qty) < cur.qty) { if (!quiet) game.msg("You don't have enough inventory space to unload your rounds."); return false; }
  }
  const { id, qty } = s;
  game.inventory.removeAt(index, qty);
  if (cur && cur.id !== id && cur.qty > 0) game.inventory.add(cur.id, cur.qty);
  eq.setAmmo(id, (cur && cur.id === id ? cur.qty : 0) + qty);
  if (!quiet) game.msg(`You load ${qty} ${getItem(id).name.toLowerCase()} into your ammo slot.${isGunId(eq.get('weapon')) ? '' : ' Only guns (pistols and sniper rifles) fire rounds.'}`);
  return true;
}

/** Take the loaded rounds out and put them in the pack. */
export function unloadRounds(game) {
  const a = game.equipment.ammo;
  if (!a) return false;
  if (game.inventory.canAdd(a.id, a.qty) < a.qty) { game.msg("You don't have enough inventory space."); return false; }
  game.inventory.add(a.id, a.qty);
  game.equipment.setAmmo(null, 0);
  game.msg(`You unload your ${getItem(a.id).name.toLowerCase()}.`);
  return true;
}

/** An empty ammo slot reloads from the strongest rounds in the pack. True when loaded. */
export function reloadRounds(game) {
  if (game.equipment.ammo?.qty > 0) return false;
  const i = bestRoundsIdx(game.inventory);
  if (i === -1) return false;
  const id = game.inventory.slotAt(i).id;
  if (!loadRounds(game, i, { quiet: true })) return false;
  game.msg(`You reload with ${getItem(id).name.toLowerCase()}.`, 'system');
  return true;
}

/** Load the strongest rounds in the pack if they beat what's loaded (Equip best
 *  in slot). True when something changed. */
export function loadBestRounds(game) {
  const i = bestRoundsIdx(game.inventory);
  if (i === -1) return false;
  const a = game.equipment.ammo;
  const id = game.inventory.slotAt(i).id;
  if (a && a.qty > 0 && (a.id === id || getItem(a.id).roundStr >= getItem(id).roundStr)) return false;
  return loadRounds(game, i, { quiet: true });
}

/** Rounds in the pack that beat the loaded ones, while a gun is in hand (the "Wear it" note). */
export function betterRoundsInPack(game) {
  if (!isGunId(game.equipment.get('weapon'))) return null;
  const i = bestRoundsIdx(game.inventory);
  if (i === -1) return null;
  const s = game.inventory.slotAt(i), a = game.equipment.ammo;
  if (a && a.qty > 0 && getItem(a.id).roundStr >= getItem(s.id).roundStr) return null;
  return s;
}

/** One shot fired: maybe use up a round (perks that save arrows save rounds
 *  too), then reload or say the slot is empty. */
export function spendRound(game, weaponType) {
  const a = game.equipment.ammo;
  if (!a || !(a.qty > 0)) return;
  if (Math.random() >= (ROUND_SPEND[weaponType] ?? 0.2)) return;
  if (Math.random() < (game.perkMods?.('ranged').arrowSave || 0)) return;
  game.equipment.setAmmo(a.id, a.qty - 1);
  if (game.equipment.ammo) return;
  if (!reloadRounds(game)) game._outOfAmmo?.('You are out of rounds: your guns fire plain shot until you load more.');
}

/** A special round's effect on a hit that landed (incendiary, frost or shock). */
export function roundEffect(game, npc, dmg) {
  const a = game.equipment.ammo;
  const sp = a && a.qty > 0 && getItem(a.id).special;
  if (!sp || !(dmg > 0) || Math.random() >= SPECIAL_CHANCE) return;
  if (sp === 'frost') { game._slowFoe?.(npc, FROST_SLOW_TICKS); return; }
  const fire = sp === 'fire';
  let target = npc;
  if (!fire) {
    // Shock: the bolt jumps to the nearest other foe within 3 tiles of the target.
    target = game.nearbyNpcs().find((n) => n !== npc && n.alive && n.attackable && !n.temporary && n.hp > 0
      && Math.max(Math.abs(n.x - npc.x), Math.abs(n.y - npc.y)) <= 3 && !game._aoeSpares?.(n));
    if (!target) return;
  }
  if (!target.alive || target.hp <= 0) return;
  const d = Math.min(target.hp, Math.max(1, Math.round(dmg * (fire ? INCENDIARY_SHARE : SHOCK_SHARE))));
  target.takeDamage(d);
  game.addHitsplat(target, d, { aoe: true, tint: fire ? '#ff8a3d' : '#ffe24a' });
  game.spawnSparkle?.(target, fire ? '#ff9a4a' : '#fff27a', 4);
  if (!target.target) target.target = game.player;
  if (target.hp <= 0) game.killNpc(target);
}

/** New Pistolers and Snipers start with rounds loaded; gun users from before
 *  rounds are handed some once (game.gunRoundsGiven, saved). */
export function grantStarterRounds(game, qty = OLD_SAVE_ROUNDS) {
  if (game.gunRoundsGiven) return false;
  const gun = isGunId(game.equipment.get('weapon')) || (game.jobClass && classUsesGuns(game.jobClass));
  if (!gun) return false;
  game.gunRoundsGiven = true;
  if (game.equipment.ammo) return false;
  game.equipment.setAmmo('bronze_rounds', qty);
  game.msg(`Guns now take rounds in an ammo slot (see Equipment): you load ${qty} bronze rounds. Better rounds hit harder; without any, your guns fire plain shot.`, 'level');
  return true;
}
