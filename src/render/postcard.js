// Postcards, in the A-Worthy sticker style: cream card, white sticker border,
// navy ink, a scalloped stamp carrying the region's badge and a wavy postmark.
//
// - The arrival card: when you walk into a new region, a small postcard
//   ("Greetings from Chinatown") tilts in near the top of the screen, holds and
//   fades out (it rides the region title card's timing, cinematics.js). Baked
//   once per region into a small canvas, so a frame costs one image draw. The
//   grim lands keep their dark plaque (renderer.js).
// - The photo postcard: ui/photomode.js frames a snapshot of the world as a
//   postcard with the game's name, the region and the website, for sharing.
//
// The painting functions only draw on the context they are given (no DOM), so
// the tests drive them with a recording context. Fonts fall back to the
// browser's own when Nunito isn't loaded.
import { fxImage, badgeKey, DARK_REGIONS } from './fxart.js';
import { postcardLine, SITE_URL, TAGLINE } from '../data/postcards.js';

const INK = '#22304A', CREAM = '#FFF8EA', PAPER = '#FAF6EE', CORAL = '#E0533D', GOLD = '#F5B82E', BROWN = '#8A5A1E';
const FONT = 'Nunito,"Trebuchet MS",sans-serif';
// A stamp colour per region, so the cards don't all look alike.
const STAMP_HUES = ['#F7C9C0', '#CFE6C8', '#C9DDF2', '#F6DFA6', '#E3D2F2', '#BFE5E0'];
export const stampHue = (name) => STAMP_HUES[[...String(name)].reduce((n, c) => n + c.charCodeAt(0), 0) % STAMP_HUES.length];

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Set the font to the largest size up to `max` (px) at which `text` fits in `w`. */
export function fitFont(g, text, w, max, weight = 900, style = '') {
  let s = Math.max(6, Math.round(max));
  for (;;) {
    g.font = `${style}${weight} ${s}px ${FONT}`;
    if (s <= 6 || g.measureText(text).width <= w) return s;
    s -= 1;
  }
}

/** Sticker lettering: a white border round navy ink round the colour. */
export function stickerText(g, text, x, y, size, fill = CORAL) {
  g.lineJoin = 'round';
  g.strokeStyle = '#FFFFFF'; g.lineWidth = size * 0.36; g.strokeText(text, x, y);
  g.strokeStyle = INK; g.lineWidth = size * 0.16; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
}

/**
 * A postage stamp: scalloped white paper, a coloured frame, the region's badge
 * in the middle (or a little sun over the sea while the badge loads) and a
 * value in the corner. (x, y) is the top-left; drawn upright.
 */
export function paintStamp(g, x, y, w, h, { badge = null, hue = '#F7C9C0', value = '10\u00A2' } = {}) {
  const r = Math.max(2, w * 0.045);
  // White paper with a perforated rim: the rectangle and a row of little
  // circles round its edge filled even-odd inside the rectangle, so each
  // circle bites a notch out of it.
  const paper = () => {
    g.beginPath();
    g.rect(x, y, w, h);
    const step = r * 2.7;
    const dots = (x0, y0, x1, y1) => {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let i = 0; i <= n; i++) {
        const cx = x0 + (x1 - x0) * i / n, cy = y0 + (y1 - y0) * i / n;
        g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI * 2);
      }
    };
    dots(x, y, x + w, y); dots(x, y + h, x + w, y + h); dots(x, y + r * 2.7, x, y + h - r * 2.7); dots(x + w, y + r * 2.7, x + w, y + h - r * 2.7);
  };
  g.save();
  g.translate(r * 0.4, r * 0.7);
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  paper(); g.fillStyle = 'rgba(34,48,74,0.2)'; g.fill('evenodd');
  g.restore();
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  paper(); g.fillStyle = '#FFFFFF'; g.fill('evenodd');
  g.restore();
  // The printed picture inside.
  const m = w * 0.12;
  g.fillStyle = hue;
  roundRect(g, x + m, y + m, w - 2 * m, h - 2 * m, w * 0.06); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(1, w * 0.022); g.stroke();
  const cx = x + w / 2, cy = y + h / 2 + h * 0.02;
  if (badge) {
    const bh = Math.min(w, h) * 0.6, bw = bh * (badge.width || badge.naturalWidth || 1) / (badge.height || badge.naturalHeight || 1);
    g.drawImage(badge, cx - bw / 2, cy - bh / 2, bw, bh);
  } else {
    g.fillStyle = GOLD;
    g.beginPath(); g.arc(cx, cy, w * 0.16, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#7FC4D8';
    g.fillRect(x + m, cy + w * 0.08, w - 2 * m, h * 0.18);
  }
  g.fillStyle = INK; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  g.font = `900 ${Math.round(w * 0.16)}px ${FONT}`;
  g.fillText(value, x + w - m * 1.3, y + h - m * 1.25);
}

/** A round postmark (two rings, the place and a date) with wavy cancel lines
 *  running off to the left. Drawn in faded ink. */
export function paintPostmark(g, cx, cy, r, { place = 'SINGAPORE', date = '' } = {}) {
  g.save();
  g.globalAlpha *= 0.62;
  g.strokeStyle = INK; g.fillStyle = INK;
  g.lineWidth = Math.max(1.2, r * 0.07);
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.lineWidth = Math.max(1, r * 0.04);
  g.beginPath(); g.arc(cx, cy, r * 0.72, 0, Math.PI * 2); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.max(6, r * 0.24).toFixed(1)}px ${FONT}`;
  g.fillText(place.slice(0, 12).toUpperCase(), cx, cy - r * 0.18);
  if (date) { g.font = `800 ${Math.max(5, r * 0.2).toFixed(1)}px ${FONT}`; g.fillText(date, cx, cy + r * 0.2); }
  // The wavy cancel lines.
  g.lineWidth = Math.max(1.2, r * 0.07);
  for (let i = -1; i <= 1; i++) {
    const y = cy + i * r * 0.36;
    g.beginPath();
    for (let k = 0; k <= 24; k++) {
      const x = cx - r * 1.05 - k * r * 0.12;
      const yy = y + Math.sin(k * 0.9) * r * 0.08;
      if (k === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.restore();
}

/** Airmail stripes: red and blue slants along a band. */
function airmail(g, x, y, w, h) {
  g.save();
  roundRect(g, x, y, w, h, h / 2); g.clip();
  const s = h * 1.4;
  for (let i = -2, n = Math.ceil(w / s) + 2; i < n; i++) {
    g.fillStyle = i % 2 ? '#3E6FB0' : CORAL;
    g.beginPath();
    g.moveTo(x + i * s, y + h); g.lineTo(x + i * s + h, y); g.lineTo(x + i * s + h + s * 0.5, y); g.lineTo(x + i * s + s * 0.5, y + h);
    g.closePath(); g.fill();
  }
  g.restore();
}

/** The arrival card's size for a view `vw` wide (the renderer's view units, which the camera's zoom scales up). */
export const arrivalSize = (vw) => { const w = Math.round(Math.max(Math.min(300, vw - 24), Math.min(330, vw * 0.44))); return { w, h: Math.round(w * 0.36) }; };

/**
 * Paint a region's arrival postcard into a w x h box on `g` (the card's own
 * small canvas, or a test's recording context). `info`: { name, sub, line,
 * badge }.
 */
export function paintArrivalCard(g, w, h, info) {
  const pad = h * 0.07;
  // White sticker border, navy outline, cream card.
  g.fillStyle = '#FFFFFF';
  roundRect(g, 0, 0, w, h, h * 0.12); g.fill();
  g.fillStyle = CREAM; g.strokeStyle = INK; g.lineWidth = Math.max(2, h * 0.025);
  roundRect(g, pad * 0.6, pad * 0.6, w - pad * 1.2, h - pad * 1.2, h * 0.09); g.fill(); g.stroke();
  airmail(g, pad * 1.4, h - pad * 1.9, w * 0.62 - pad * 1.4, h * 0.045);
  // The stamp and its postmark, top right.
  const sw = h * 0.5, sh = h * 0.6, sx = w - pad * 1.5 - sw, sy = pad * 1.3;
  paintStamp(g, sx, sy, sw, sh, { badge: info.badge, hue: stampHue(info.name) });
  paintPostmark(g, sx + sw * 0.1, sy + sh * 0.82, h * 0.17, { place: 'S’PORE' });
  // "Greetings from", the name and the note, down the left.
  const tx = pad * 1.7, tw = sx - tx - pad;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = BROWN;
  g.font = `900 ${(h * 0.1).toFixed(1)}px ${FONT}`;
  g.fillText('GREETINGS FROM', tx, pad * 1.3 + h * 0.1);
  const ns = fitFont(g, info.name, tw, Math.round(h * 0.25));
  stickerText(g, info.name, tx + ns * 0.08, pad * 1.3 + h * 0.13 + ns * 0.95, ns);
  g.fillStyle = INK;
  const ls = fitFont(g, info.line || '', tw, Math.round(h * 0.095), 700, 'italic ');
  g.fillText(info.line || '', tx, h * 0.72);
  if (info.sub) {
    g.font = `800 ${Math.min(ls, h * 0.08).toFixed(1)}px ${FONT}`;
    g.fillStyle = '#6B5B4A';
    g.fillText(info.sub, tx, h * 0.72 + ls * 1.25);
  }
}

/**
 * The arrival postcards: baked per region on first use (and again once the
 * region's badge has loaded), drawn tilting in with the title card's fade.
 */
export class RegionPostcards {
  constructor() {
    this.ok = typeof document !== 'undefined' && !!document.createElement;
    this._cache = new Map();
  }

  _bake(tc, vw) {
    const { w, h } = arrivalSize(vw);
    const badge = fxImage(badgeKey(tc.name));
    const key = `${tc.name}|${tc.sub}|${w}`;
    const hit = this._cache.get(key);
    if (hit && (hit.badge || !badge)) return hit;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    let cv;
    try { cv = hit ? hit.cv : document.createElement('canvas'); } catch { return null; }
    const pw = Math.round((w + 16) * dpr), ph = Math.round((h + 16) * dpr);
    cv.width = pw; cv.height = ph;
    const g = cv.getContext && cv.getContext('2d');
    if (!g) return null;
    g.setTransform(dpr, 0, 0, dpr, 8 * dpr, 8 * dpr);
    // A soft drop shadow under the card, like the HUD's stickers.
    g.fillStyle = 'rgba(34,48,74,0.22)';
    roundRect(g, 3, 5, w, h, h * 0.12); g.fill();
    paintArrivalCard(g, w, h, { name: tc.name, sub: tc.sub, line: postcardLine(tc.name), badge });
    const out = { cv, w: w + 16, h: h + 16, badge: !!badge };
    if (this._cache.size > 12) this._cache.clear();
    this._cache.set(key, out);
    return out;
  }

  /** Draw `tc` (the cinematics title card) at opacity `a`. False when it
   *  can't (headless) or shouldn't (the grim lands keep their dark plaque). */
  draw(ctx, tc, vw, vh, a) {
    if (!this.ok || !tc || DARK_REGIONS.has(tc.name)) return false;
    const card = this._bake(tc, vw);
    if (!card) return false;
    const rise = 1 - a;
    ctx.save();
    ctx.globalAlpha = a;
    // Below the region label and the notices at the top, above the hero.
    ctx.translate(vw / 2, Math.max(card.h / 2 + 64, vh * 0.34) + rise * 18);
    ctx.rotate((-2.2 - rise * 4) * Math.PI / 180);
    ctx.drawImage(card.cv, -card.w / 2, -card.h / 2, card.w, card.h);
    ctx.restore();
    return true;
  }
}

// ---------------- The photo postcard (ui/photomode.js) ----------------

/** The photo postcard's size: wide on landscape screens, tall on phones held upright. */
export const photoPostcardSize = (vw, vh) => (vw >= vh ? { w: 1600, h: 1100 } : { w: 1080, h: 1440 });

/**
 * Paint the shareable postcard into a W x H box on `g`. `info`: { photo (a
 * canvas or image, drawn to cover its window), region, line, badge, logo,
 * date, url, tagline, name (the hero's) }. Returns the photo window
 * ({ x, y, w, h }) for tests.
 */
export function composePostcard(g, W, H, info = {}) {
  const wide = W >= H;
  const m = Math.round(Math.min(W, H) * 0.045);
  const region = info.region || 'Singapore';
  const url = info.url || SITE_URL;
  // Paper with a faint dotted texture, a white sticker rim and a navy outline.
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  g.fillStyle = PAPER; g.strokeStyle = INK; g.lineWidth = Math.max(4, m * 0.12);
  roundRect(g, m * 0.4, m * 0.4, W - m * 0.8, H - m * 0.8, m * 0.7); g.fill(); g.stroke();
  // The photo window.
  const pw = W - 2 * m, ph = Math.round(H * (wide ? 0.72 : 0.68));
  const px = m, py = m;
  g.save();
  roundRect(g, px, py, pw, ph, m * 0.5); g.clip();
  g.fillStyle = '#CFE6C8'; g.fillRect(px, py, pw, ph);
  const src = info.photo;
  const sw = src ? (src.width || src.naturalWidth || 0) : 0, sh = src ? (src.height || src.naturalHeight || 0) : 0;
  if (sw && sh) {
    const s = Math.max(pw / sw, ph / sh), dw = sw * s, dh = sh * s;
    g.drawImage(src, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
  }
  // A gentle warm, faded-print grade, darker at the corners.
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = 'rgba(255,190,110,0.5)'; g.fillRect(px, py, pw, ph);
  g.globalCompositeOperation = 'source-over';
  const vg = g.createRadialGradient(px + pw / 2, py + ph / 2, Math.min(pw, ph) * 0.35, px + pw / 2, py + ph / 2, Math.max(pw, ph) * 0.75);
  vg.addColorStop(0, 'rgba(60,40,30,0)'); vg.addColorStop(1, 'rgba(60,40,30,0.32)');
  g.fillStyle = vg; g.fillRect(px, py, pw, ph);
  g.restore();
  g.strokeStyle = '#FFFFFF'; g.lineWidth = m * 0.28;
  roundRect(g, px, py, pw, ph, m * 0.5); g.stroke();
  g.strokeStyle = INK; g.lineWidth = Math.max(3, m * 0.09);
  roundRect(g, px - m * 0.14, py - m * 0.14, pw + m * 0.28, ph + m * 0.28, m * 0.6); g.stroke();
  // "Greetings from <region>" in big sticker letters over the photo's foot.
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const gx = px + m * 0.8, gw = pw * (wide ? 0.62 : 0.86);
  const gs = Math.round(Math.min(W, H) * 0.045);
  g.font = `900 ${gs}px ${FONT}`;
  stickerText(g, 'Greetings from', gx, py + ph - m * 0.7 - gs * 2.1, gs, GOLD);
  const ns = fitFont(g, region, gw, Math.round(Math.min(W, H) * 0.11));
  stickerText(g, region, gx, py + ph - m * 0.7, ns, CORAL);
  // The stamp and postmark, top right of the photo.
  const sw2 = Math.round(Math.min(W, H) * 0.15), sh2 = Math.round(sw2 * 1.2);
  const sx = px + pw - sw2 - m * 0.6, sy = py + m * 0.6;
  g.save();
  g.translate(sx + sw2 / 2, sy + sh2 / 2); g.rotate(4 * Math.PI / 180);
  paintStamp(g, -sw2 / 2, -sh2 / 2, sw2, sh2, { badge: info.badge, hue: stampHue(region) });
  g.restore();
  paintPostmark(g, sx - sw2 * 0.05, sy + sh2 * 0.9, sw2 * 0.36, { place: 'S’PORE', date: info.date || '' });
  // The foot of the card: the logo and the game's name, the note, and a pill
  // saying where to play. Wide cards put the pill beside the words; tall ones
  // stack the logo row, the note and then the pill.
  const fy = py + ph + m * 0.55, fh = H - fy - m * 0.9;
  const u = Math.min(W, H);
  const titleS = Math.round(u * 0.044), tagS = Math.round(u * 0.03), us = Math.round(u * 0.03);
  const line = `\u201C${info.line || postcardLine(region)}\u201D`;
  const label = `Play free \u2192 ${url}`;
  g.font = `900 ${us}px ${FONT}`;
  const uw = g.measureText(label).width + us * 1.6, uh = us * 2;
  const ux = px + pw - uw;
  const uy = wide ? fy + (fh - uh) / 2 + us * 0.6 : H - m * 0.9 - uh;
  const logo = info.logo, lw0 = logo ? (logo.width || logo.naturalWidth || 0) : 0;
  const logoH = wide ? Math.min(fh * 0.9, u * 0.16) : Math.min(fh * 0.4, u * 0.14);
  let lx = px;
  if (lw0) {
    const lw = logoH * lw0 / (logo.height || logo.naturalHeight || 1);
    g.drawImage(logo, px, wide ? fy + (fh - logoH) / 2 : fy, lw, logoH);
    lx = px + lw + m * 0.4;
  }
  // The name and tagline, beside the logo.
  const nameY = wide ? fy + fh * 0.3 : fy + logoH * 0.45;
  const colW = (wide ? ux - m * 0.5 : px + pw) - lx;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = INK; fitFont(g, 'A-Worthy Adventure', colW, titleS);
  g.fillText('A-Worthy Adventure', lx, nameY);
  g.fillStyle = BROWN; fitFont(g, info.tagline || TAGLINE, colW, tagS, 800, 'italic ');
  g.fillText(info.tagline || TAGLINE, lx, nameY + tagS * 1.4);
  // The note, like handwriting on the back.
  g.fillStyle = INK;
  if (wide) { fitFont(g, line, colW, tagS, 700, 'italic '); g.fillText(line, lx, nameY + tagS * 2.9); }
  else { fitFont(g, line, pw, Math.round(tagS * 1.1), 700, 'italic '); g.fillText(line, px, fy + logoH + tagS * 1.6); }
  // "Play free" pill.
  g.font = `900 ${us}px ${FONT}`;
  g.fillStyle = CORAL; g.strokeStyle = INK; g.lineWidth = Math.max(2, us * 0.12);
  roundRect(g, ux, uy, uw, uh, uh / 2); g.fill(); g.stroke();
  g.fillStyle = '#FFFFFF'; g.textBaseline = 'middle';
  g.fillText(label, ux + us * 0.8, uy + uh / 2 + 1);
  g.textBaseline = 'alphabetic';
  // Signed by the hero: above the pill on wide cards, beside it on tall ones.
  if (info.name) {
    const sign = `\u2014 love, ${info.name}`;
    g.fillStyle = '#6B5B4A'; g.font = `italic 800 ${Math.round(us * 0.85)}px ${FONT}`;
    if (wide) { g.textAlign = 'right'; g.fillText(sign, px + pw - us * 0.4, uy - us * 0.55); }
    else {
      fitFont(g, sign, ux - px - m * 0.4, Math.round(us * 0.85), 800, 'italic ');
      g.textBaseline = 'middle'; g.fillText(sign, px, uy + uh / 2); g.textBaseline = 'alphabetic';
    }
    g.textAlign = 'left';
  }
  return { x: px, y: py, w: pw, h: ph };
}
