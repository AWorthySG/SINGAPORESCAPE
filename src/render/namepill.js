// Name tags over heads as little sticker pills (cream card, thin navy line,
// soft drop shadow), in the same family as the speech bubbles. Heavy outlined
// text was hard to read over busy ground and cost a measure, a stroke and a
// fill per name per frame; a pill is painted once into a small bitmap, kept
// in a bounded cache keyed by its words, style and drawing scale, and copied
// from there with one drawImage. Headless runs (no document) paint straight
// onto the context instead, so the tests still see each name's words.

const FONT = 'Nunito,"Trebuchet MS",sans-serif';
const INK = '#22304A';

// fill, text colour, font size, weight and hairline width for each kind of tag.
// Monsters are coloured by how dangerous they are to you (foeThreat): green,
// gold or red words on a faintly tinted card; champions wear gold, bosses red.
export const PILL_STYLES = {
  town: { fill: '#FFFDF6', text: INK, size: 9.5, weight: 800, line: 1 },
  own: { fill: '#FFFFFF', text: INK, size: 10.5, weight: 800, line: 1 },
  easy: { fill: '#EDF8EE', text: '#23733C', size: 9.5, weight: 800, line: 1 },
  even: { fill: '#FFF5DD', text: '#9A5800', size: 9.5, weight: 800, line: 1 },
  danger: { fill: '#FFE7E4', text: '#C42626', size: 9.5, weight: 900, line: 1 },
  champion: { fill: '#FFD866', text: INK, size: 10.5, weight: 900, line: 1.25 },
  boss: { fill: '#E5484D', text: '#FFFFFF', size: 11, weight: 900, line: 1.5 },
  // Your target's tag: a navy pill, its words coloured by the matchup.
  tagStrong: { fill: INK, text: '#FFD24A', size: 8.5, weight: 800, line: 1, rim: '#FFFFFF' },
  tagWeak: { fill: INK, text: '#C8CCD4', size: 8.5, weight: 800, line: 1, rim: '#FFFFFF' },
  tagEven: { fill: INK, text: '#9AFFD0', size: 8.5, weight: 800, line: 1, rim: '#FFFFFF' },
};

/** Vertical room one pill takes: labels stepping aside move by this much. */
export const PILL_ROW = 14;
const PAD_X = 5;          // px either side of the words
const SHADOW_Y = 1.5;     // px the drop shadow sits below the card
export const PILL_CAP = 96;   // pills kept; the least recently drawn goes first

const cache = new Map();

/** The scale a pill is painted at, for the camera's pixel ratio and zoom:
 *  rounded up to a half step, so a fight's slow zoom only repaints a pill
 *  once or twice rather than every frame. */
export function pillRes(cam) {
  const s = (cam?.dpr || 1) * (cam?.zoom || 1);
  return Math.min(4, Math.max(1, Math.ceil(s * 2) / 2));
}

function pillHeight(st) { return Math.round(st.size + 4.5); }

/** Paint the pill centred on (cx, cy) in ctx's own units. */
function paint(ctx, text, st, w, cx, cy) {
  const h = pillHeight(st), x = cx - w / 2, y = cy - h / 2, r = h / 2;
  const round = (yy) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, yy, w, h, r); else ctx.rect(x, yy, w, h);
  };
  ctx.fillStyle = 'rgba(34,48,74,0.28)'; round(y + SHADOW_Y); ctx.fill();
  ctx.fillStyle = st.fill; round(y); ctx.fill();
  ctx.lineWidth = st.line; ctx.strokeStyle = st.rim || INK; ctx.stroke();
  ctx.font = `${st.weight} ${st.size}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = st.text; ctx.fillText(text, cx, cy + 0.5);
  ctx.textBaseline = 'alphabetic';
}

/** The pill for these words in this style: { cv, w, h } (w and h in screen
 *  units; cv is null headless). Comes from the cache when it can. */
export function namePill(ctx, text, style, res = 1) {
  const key = `${style}|${res}|${text}`;
  let p = cache.get(key);
  if (p) { cache.delete(key); cache.set(key, p); return p; }   // most recent last
  const st = PILL_STYLES[style] || PILL_STYLES.town;
  const font = `${st.weight} ${st.size}px ${FONT}`;
  const h = pillHeight(st);
  let cv = null, w;
  if (typeof document !== 'undefined' && document.createElement) {
    cv = document.createElement('canvas');
    const g = cv.getContext && cv.getContext('2d');
    if (g) {
      g.font = font;
      w = Math.ceil(g.measureText(text).width) + PAD_X * 2;
      // Room for the hairline and the shadow round the card.
      cv.width = Math.ceil((w + 2) * res); cv.height = Math.ceil((h + SHADOW_Y + 2) * res);
      g.scale(res, res);
      paint(g, text, st, w, (w + 2) / 2, (h + 2) / 2);
    } else cv = null;
  }
  if (!cv) { ctx.font = font; w = Math.ceil(ctx.measureText(text).width) + PAD_X * 2; }
  p = { cv, w, h, text, st, res };
  cache.set(key, p);
  if (cache.size > PILL_CAP) cache.delete(cache.keys().next().value);
  return p;
}

/** Draw a pill from namePill centred on (cx, cy). */
export function drawPill(ctx, p, cx, cy) {
  if (p.cv) ctx.drawImage(p.cv, cx - (p.w + 2) / 2, cy - (p.h + 2) / 2, p.cv.width / p.res, p.cv.height / p.res);
  else paint(ctx, p.text, p.st, p.w, cx, cy);
}

/** How many pills are cached (for the tests). */
export function pillCacheSize() { return cache.size; }
