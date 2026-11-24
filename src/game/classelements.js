// What the Priest's and the Zealot's own elements do beyond their damage (the
// Light and Flame paths, magic.js ELEMENTS radiance ... bloodprice). Each effect
// is a field on its element, as Fire's `ignite` or Dark's `hex` are, so the
// numbers stay in the data table. Kept out of game.js, which only calls in:
//  - _offensiveMods multiplies a cast by castMult (the path's power, Verdict,
//    Retribution and Blood Price), and the Stats tab (statsheet.js) shows it;
//  - _magicAttack and _spellSplash call markFoe on every foe a spell hits
//    (Dazzle, Ash's mark, Consecrate's count; the Blood Price is paid as the
//    cast goes off), and _magicAttack calls afterCast once the cast has landed
//    (Ward, Consecrate, Brand, Wrath spent);
//  - resolveNpcAttack asks dazzleMiss before a foe's blow lands, and the Ward
//    soaks blows in Player.soakWard; Player.takeDamage stores Wrath;
//  - killNpc calls onKill (Cinders), and doTick calls tick (the Ward fading).
import { ELEMENTS, getSpell } from '../data/magic.js';
import { LIFE_COST_FLOOR } from '../data/abilities.js';
import { magicXp } from './combat.js';

// A small effect the renderer draws (render/classfx.js): a flare as the brands
// burst, an ash burst on a death, a chime as the ward fills.
function fx(game, kind, entity, life = 520, extra = null) {
  const c = entity.renderCenter ? entity.renderCenter() : entity;
  game.effects.push({ type: 'classfx', kind, x: c.x, y: c.y - 6, life, maxLife: life, ...extra });
}

/** Dazzle: does this foe's blow miss? Only a dazzled foe rolls (an extra miss
 *  chance, halved for a telegraphed heavy blow, as dodging is). */
export function dazzleMiss(game, npc, heavy = false) {
  if (!(npc?.dazzleUntil > game.tickCount)) return false;
  return Math.random() < ELEMENTS.radiance.dazzle.miss * (heavy ? 0.5 : 1);
}

/** Wrath's Retribution: the bonus the next Wrath cast gets from the damage you
 *  have taken since the last one (twice the share of your life, capped). */
export function wrathBonus(game) {
  const r = ELEMENTS.wrath.retribution;
  return Math.min(r.cap, r.per * (game.player.wrath || 0) / Math.max(1, game.maxHp()));
}

/** A cast's damage multiplier from its element's own effects (1 for the seven
 *  elements): the path's power, Verdict on a hurt foe, stored Wrath, and the
 *  Zealot's Blood Price, but only while there is life above the floor to pay. */
export function castMult(game, npc, element) {
  const el = ELEMENTS[element];
  if (!el) return 1;
  let m = el.power || 1;
  if (el.verdict && npc?.maxHp > 0) m *= 1 + el.verdict * Math.max(0, Math.min(1, 1 - npc.hp / npc.maxHp));
  if (el.retribution) m *= 1 + wrathBonus(game);
  if (el.sacrifice && lifeCost(game, el.sacrifice.life) > 0) m *= 1 + el.sacrifice.dmg;
  return m;
}

/** Every foe a spell hits, before its damage lands (`first`: the spell's own
 *  target, so a new cast starts Consecrate's count). */
export function markFoe(game, npc, spell, first = false) {
  const el = ELEMENTS[spell.element];
  if (first) game._consecrated = 0;
  // Blood's price is paid as the cast goes off, as castMult has just counted it
  // (nothing between the two changes your life), so a hit is only harder when paid.
  if (first && el?.sacrifice) payLife(game, el.sacrifice.life);
  if (!el || !npc.alive) return;
  if (el.dazzle) {
    if (!(npc.dazzleUntil > game.tickCount)) game.spawnSparkle(npc, '#fff6c8', 3);
    npc.dazzleUntil = game.tickCount + el.dazzle.ticks;
  }
  if (el.cinders) npc.ashUntil = game.tickCount + el.cinders.ticks;   // a death while branded or burning bursts
  if (el.consecrate) game._consecrated++;
}

/** After a cast has landed on `npc`: `dmg` its hit as landed, `raw` before its
 *  crit (what the splash takes), `dealt` everything it dealt in your own life's
 *  units (big monsters' hits at their real size, splash included). */
export function afterCast(game, npc, spell, { dmg, raw, dealt }) {
  const el = ELEMENTS[spell.element];
  if (!el) return;
  const p = game.player;
  if (el.ward && dealt > 0 && p.alive) addWard(game, dealt * el.ward.share);
  if (el.consecrate && game._consecrated > 0 && p.alive && p.hp < game.maxHp()) {
    const heal = Math.max(1, Math.round(game.maxHp() * Math.min(el.consecrate.cap, el.consecrate.per * game._consecrated)));
    p.hp = Math.min(game.maxHp(), p.hp + heal);
    game.spawnSparkle(p, '#fff0a0', 4);
    game.bus.emit('hp');
  }
  if (el.retribution) p.wrath = 0;   // spent on this cast (castMult counted it)
  if (el.brand && dmg > 0) brandFoe(game, npc, dmg, raw, spell);
}

/** Grace's Ward: `amt` more life of ward, up to its cap, fading `ticks` after the last top-up. */
export function addWard(game, amt) {
  const p = game.player, W = ELEMENTS.grace.ward;
  const was = p.ward || 0;
  p.ward = Math.min(Math.round(game.maxHp() * W.cap), Math.round(was + amt));
  p.wardUntil = game.tickCount + W.ticks;
  if (p.ward > was) { if (!was) fx(game, 'ward', p, 600); game.bus.emit('hp'); }
}

/** Blood's price for a cast now: `share` of your life as it is, never taking you
 *  under LIFE_COST_FLOOR of your life (as the Zealot's life-paid skills); 0 at
 *  or under the floor. At least 1 life above it: with the floor at 1%, a share of
 *  a little life rounds down to nothing, and Blood would hit hard for free. */
export function lifeCost(game, share) {
  const p = game.player, floor = Math.ceil(game.maxHp() * LIFE_COST_FLOOR);
  return Math.max(0, Math.min(Math.max(1, Math.floor(p.hp * share)), p.hp - floor));
}

/** Pay Blood's price: the life comes off with a deep-red number over you, and
 *  red droplets drawn out of you into the bolt (render/classfx.js). */
export function payLife(game, share) {
  const p = game.player, cost = lifeCost(game, share);
  if (!(cost > 0)) return 0;
  p.hp -= cost;
  game.addHitsplat(p, cost, { tint: '#b0102a' });
  fx(game, 'bloodprice', p, 520, { low: !!game.lowFx, calm: !!game.reduceMotion });
  game.bus.emit('hp');
  return cost;
}

/** Holy Fire's Brand: one more on the foe; the last one bursts for the hit
 *  again, on the foe and on everything its splash reaches, and clears them. */
function brandFoe(game, npc, dmg, raw, spell) {
  if (!npc.alive || npc.hp <= 0) return;
  const B = ELEMENTS[spell.element].brand, t = game.tickCount;
  const n = (npc.brand?.until > t ? npc.brand.n : 0) + 1;
  if (n < B.max) { npc.brand = { n, until: t + B.ticks }; return; }
  npc.brand = null;
  const d = Math.min(npc.hp, Math.max(1, Math.round(dmg * B.burst)));
  npc.takeDamage(d);
  game.addHitsplat(npc, d, { tint: ELEMENTS[spell.element].splat, crit: true });
  game.addHitsplat(npc, 0, { text: 'Brands burst!' });
  fx(game, 'flare', npc, 560);
  const m = game.combatXpMult();
  for (const x of magicXp(d)) game.skills.addXp(x.skill, x.xp * m);
  if (!npc.target) npc.target = game.player;
  if (npc.hp <= 0) game.killNpc(npc);
  game._spellSplash(npc, Math.max(1, Math.round(raw * B.burst)), spell);
}

/** Is this foe branded (Holy Fire) right now? */
export const brands = (game, npc) => (npc?.brand?.until > game.tickCount ? npc.brand.n : 0);

/** A foe has died: Ash's Cinders if it had been struck by Ash and was still
 *  branded or burning (holy fire or Fire's Ignite). Each foe bursts once. */
export function onKill(game, npc) {
  if (!(npc.ashUntil > game.tickCount)) return;
  npc.ashUntil = 0;
  const burning = npc.ignite?.burns?.length || npc.wounds?.holyfire?.length || brands(game, npc);
  if (!burning) return;
  const spell = getSpell('ash_strike'), d = Math.round((npc.lastHit || 0) * ELEMENTS[spell.element].cinders.share);
  fx(game, 'ash', npc, 640);
  if (d > 0) game._spellSplash(npc, d, spell);   // AOE_RADIUS (2 tiles) round the body
}

/** Every game tick: the Ward fades once it has gone `ticks` without a top-up. */
export function tick(game) {
  const p = game.player;
  if (p.ward > 0 && game.tickCount >= (p.wardUntil || 0)) { p.ward = 0; game.bus.emit('hp'); }
}

/** A death (or a fresh life) empties the Ward and the stored Wrath. */
export function reset(game) {
  game.player.ward = 0; game.player.wrath = 0;
}
