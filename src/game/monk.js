// The Monk (the owner's ask: "fights with his bare knuckles and palms"): monk
// knuckles punch from the main hand, monk gloves palm-strike from the off-hand,
// and every blow builds Chi. Each Chi adds damage; a full bar overflows into a
// small heal and drops back to CHI.keep. Monks are light on their feet: a few
// blows miss them altogether. Kept out of game.js, which only calls in:
// _applyPlayerHit calls onHit, _offensiveMods multiplies by chiPower,
// resolveNpcAttack adds dodge, a skill's `chi` calls gainChi, and the tick fades
// it (tickChi). Not saved: it fades in a few seconds anyway.

// max: the bar; per: damage per Chi; everyMs: at most one Chi from blows this
// often (either hand): one a game tick, counted in ticks rather than play time,
// which the browser's frame loop advances faster than the tests do; heal: the overflow's heal, a share of max life; keep: Chi
// left after an overflow; fadeTicks: ticks without a landed blow before it fades.
export const CHI = { max: 10, per: 0.03, everyMs: 600, heal: 0.05, keep: 5, fadeTicks: 5 };
// A share of blows that miss a Monk entirely (halved against heavy, telegraphed ones).
export const MONK_DODGE = 0.1;

const isMonk = (game) => game.jobClass === 'monk';

/** The Monk's Chi now (0 for anyone else, or once it has faded). */
export function chiStacks(game) {
  if (!isMonk(game) || !(game.chi > 0)) return 0;
  return game.tickCount - (game.chiAt || 0) > CHI.fadeTicks ? 0 : game.chi;
}

/** The damage multiplier Chi gives (1 for anyone else). */
export const chiPower = (game) => 1 + chiStacks(game) * CHI.per;

/** Gain `n` Chi; a full bar overflows: a small heal, back down to CHI.keep. */
export function gainChi(game, n = 1) {
  if (!isMonk(game) || !(n > 0)) return;
  game.chi = Math.min(CHI.max, chiStacks(game) + n);
  game.chiAt = game.tickCount;
  if (game.chi >= CHI.max) {
    const p = game.player, max = game.maxHp();
    if (p.alive) p.hp = Math.min(max, p.hp + Math.max(1, Math.round(max * CHI.heal)));
    game.chi = CHI.keep;
    game.addHitsplat?.(p, 0, { text: 'Chi flows!' });
    game.spawnSparkle?.(p, '#8fe3ff', 10);
    game.bus.emit('hp');
  }
  game.bus.emit('chi');
}

/** A blow that landed (either hand, not an area hit): it keeps the Chi alive,
 *  and builds one at most once a tick (CHI.everyMs), so quicker swings don't fill it faster. */
export function onHit(game) {
  if (!isMonk(game)) return;
  game.chiAt = game.tickCount;
  if (game._chiTick === game.tickCount) return;
  game._chiTick = game.tickCount;
  gainChi(game, 1);
}

/** Each tick: Chi left alone fades away (and the Combat tab's readout says so). */
export function tickChi(game) {
  if (game.chi > 0 && !chiStacks(game)) { game.chi = 0; game.bus.emit('chi'); }
}

/** The Monk's own dodge chance (0 for anyone else). */
export const dodge = (game) => (isMonk(game) ? MONK_DODGE : 0);
