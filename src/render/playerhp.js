// Your own life bar over your head: bigger than a monster's, in the sticker
// style (white rim, navy hairline), green → amber → red as it falls, and a
// drain trail (the chunk just lost fades out over DRAIN_MS) so a hit reads at
// a glance. Shown in a fight or while hurt (playerBarVisible). The pure parts
// are what the tests drive; drawing costs a few rectangles and no garbage.

export const DRAIN_MS = 400;
export const PLAYER_BAR_W = 40;
export const PLAYER_BAR_H = 6;

// [high, middle, low]: the A-Worthy grass, sun and coral, or with colour-blind
// colours on, blue, amber and orange (the Okabe-Ito set main.css uses too).
const COLOURS = ['#3F9E5A', '#F2B33D', '#D8433C'];
const COLOURS_CB = ['#0072B2', '#E69F00', '#D55E00'];

/** 0 (over half), 1 (over a quarter) or 2 (a quarter or less): which colour
 *  the bar wears, here and on the HUD bar (ui/hpbar.js). */
export function hpBand(frac) {
  return frac > 0.5 ? 0 : frac > 0.25 ? 1 : 2;
}

/** Whether your own bar shows over your head: while you fight (a target, a
 *  monster on you, the fight camera's test) or while you are hurt at all. */
export function playerBarVisible(game) {
  const p = game.player;
  if (!p?.alive) return false;
  const max = game.maxHp ? game.maxHp() : p.maxHp;
  if (max > 0 && p.hp < max) return true;
  if (p.target?.alive) return true;
  if (p.action?.type === 'attack') return true;
  return !!game.cine?.inFight;
}

/** Where the trail stands at `now`: from where the bar was, sliding down to it. */
const trailAt = (st, now) => st.last + (st.from - st.last) * Math.max(0, 1 - (now - st.at) / DRAIN_MS);

/** The trail's end (a fraction) at `now`: where the bar stood before the last
 *  loss, sliding down to the bar over DRAIN_MS. `st` is kept between frames
 *  ({ last, from, at }); a heal drops the trail at once. */
export function drainTrail(st, frac, now) {
  if (st.last === undefined || frac > st.last) { st.last = st.from = frac; st.at = now; return frac; }
  if (frac < st.last) {
    // A new loss: the trail starts from wherever it had got to.
    st.from = trailAt(st, now);
    st.last = frac; st.at = now;
  }
  return trailAt(st, now);
}

/** Draw the bar centred at (cx, y top). */
export function drawPlayerHp(ctx, cx, y, frac, st, now, colourBlind) {
  frac = Math.max(0, Math.min(1, frac));
  const w = PLAYER_BAR_W, h = PLAYER_BAR_H, x = cx - w / 2;
  const trail = drainTrail(st, frac, now);
  // The sticker rim: navy hairline outside, white inside.
  ctx.fillStyle = '#22304A'; ctx.fillRect(x - 2.5, y - 2.5, w + 5, h + 5);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  ctx.fillStyle = '#4a3a3a'; ctx.fillRect(x, y, w, h);   // the empty track
  if (trail > frac) {
    // The chunk just lost: pale, fading as it shrinks.
    ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, 1 - (now - st.at) / DRAIN_MS);
    ctx.fillStyle = '#FFE9C9'; ctx.fillRect(x + w * frac, y, w * (trail - frac), h);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = (colourBlind ? COLOURS_CB : COLOURS)[hpBand(frac)];
  ctx.fillRect(x, y, w * frac, h);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x, y, w * frac, 1.5);   // a little gloss
}
