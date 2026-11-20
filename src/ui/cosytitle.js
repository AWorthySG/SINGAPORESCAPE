// The title screen's "cosy Singapore at golden hour" dressing (title.js calls
// it once the game is built; styles/cosy.css styles it):
//
// - a warm sunset sky laid over the live world behind the card, with a low sun;
// - a skyline of the old neighbourhood in front of the modern city: an HDB
//   block with bamboo laundry poles and a void deck, a kampong house on stilts
//   under a coconut palm, a row of pastel shophouses with five-foot-way arches,
//   red lanterns swaying from the eaves and a kopitiam with kopi steaming on
//   the table and a string of lights, and Marina Bay hazy in the distance;
// - fireflies drifting up at dusk.
//
// All of it is one inline SVG and a few CSS-animated dots, so it costs the
// phone almost nothing (CSS transforms and opacity only), and reduced motion
// or low graphics simply stills or drops the moving parts.
import { titleSkylineSvg } from './title.js';

const INK = '#22304A';
export const COSY_VIEW = { w: 1200, h: 220 };
const G = COSY_VIEW.h;   // the ground line

// ---------------- Pieces ----------------
const rows = (x, y, w, h, step, fill) => {
  let s = '';
  for (let yy = y; yy + step * 0.6 <= y + h; yy += step) for (let xx = x; xx + 10 <= x + w; xx += 16) s += `<rect x="${xx}" y="${yy}" width="10" height="${(step * 0.55).toFixed(0)}" rx="1.5" fill="${fill}"/>`;
  return s;
};

/** An HDB block: pastel slab, rows of windows (a few lit), a void deck of
 *  pillars at the foot and bamboo poles of laundry from some windows. */
function hdb(x, w, h, colour, accent, laundrySide = 1) {
  const top = G - h;
  let s = `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="4" fill="${colour}"/>`;
  s += `<rect x="${x - 4}" y="${top - 6}" width="${w + 8}" height="9" rx="3" fill="${accent}"/>`;
  s += `<g stroke="none">${rows(x + 8, top + 12, w - 14, h - 44, 18, '#FFE2A8')}</g>`;
  // The void deck: an open ground floor on pillars.
  s += `<rect x="${x + 2}" y="${G - 26}" width="${w - 4}" height="24" fill="#6E5A7E" fill-opacity=".45" stroke="none"/>`;
  for (let px = x + 10; px < x + w - 6; px += 22) s += `<rect x="${px}" y="${G - 26}" width="6" height="26" fill="${colour}"/>`;
  // Bamboo laundry poles with a few clothes.
  const clothes = ['#E0533D', '#7FC4D8', '#F5B82E', '#FFFFFF', '#B9DDBF'];
  for (let i = 0; i < 3; i++) {
    const py = top + 22 + i * 36, px0 = laundrySide > 0 ? x + w : x;
    const px1 = px0 + laundrySide * 34;
    s += `<path d="M${px0} ${py}L${px1} ${py - 2}" stroke="#C8A15A" stroke-width="3"/>`;
    for (let k = 0; k < 2; k++) {
      const cx = px0 + laundrySide * (8 + k * 13);
      s += `<rect class="ct-cloth" x="${cx - 4}" y="${py}" width="9" height="${11 + ((i + k) % 2) * 4}" rx="1.5" fill="${clothes[(i * 2 + k) % clothes.length]}" style="transform-origin:${cx}px ${py}px"/>`;
    }
  }
  return s;
}

/** A kampong house on stilts: plank walls, an attap roof, steps up to the door. */
function kampong(x) {
  const fy = G - 34;   // floor level
  let s = '';
  for (const sx of [x + 6, x + 40, x + 74, x + 104]) s += `<rect x="${sx}" y="${fy}" width="6" height="34" fill="#9C6B3E"/>`;
  s += `<rect x="${x}" y="${fy - 46}" width="116" height="48" rx="3" fill="#E2B67A"/>`;
  s += `<path d="M${x + 6} ${fy - 30}h104M${x + 6} ${fy - 16}h104" stroke="${INK}" stroke-opacity=".18" stroke-width="2"/>`;
  s += `<rect x="${x + 14}" y="${fy - 36}" width="22" height="18" rx="2" fill="#FFD27A"/><rect x="${x + 78}" y="${fy - 36}" width="22" height="18" rx="2" fill="#FFD27A"/>`;
  s += `<rect x="${x + 46}" y="${fy - 38}" width="22" height="38" rx="2" fill="#B07A45"/>`;
  // Attap roof: a steep thatch with a fringe.
  s += `<path d="M${x - 14} ${fy - 42}L${x + 58} ${fy - 96}L${x + 130} ${fy - 42}Z" fill="#B98546"/>`;
  s += `<path d="M${x - 6} ${fy - 46}L${x + 58} ${fy - 88}M${x + 18} ${fy - 46}L${x + 58} ${fy - 80}M${x + 122} ${fy - 46}L${x + 58} ${fy - 88}M${x + 98} ${fy - 46}L${x + 58} ${fy - 80}" stroke="${INK}" stroke-opacity=".2" stroke-width="2"/>`;
  // Steps.
  s += `<path d="M${x + 50} ${fy}L${x + 40} ${G}M${x + 64} ${fy}L${x + 54} ${G}M${x + 47} ${fy + 10}h14M${x + 44} ${fy + 21}h14" stroke="#9C6B3E" stroke-width="3"/>`;
  return s;
}

/** A coconut palm leaning a little. */
function palm(x, h, lean = 1) {
  const tx = x + lean * 18, ty = G - h;
  let s = `<path d="M${x - 4} ${G}Q${x + lean * 4} ${G - h * 0.5} ${tx - 3} ${ty}L${tx + 3} ${ty}Q${x + lean * 10} ${G - h * 0.5} ${x + 4} ${G}Z" fill="#A8794A"/>`;
  const frond = (a) => {
    const r = 46, ex = tx + Math.cos(a) * r, ey = ty + Math.sin(a) * r * 0.7 + 10;
    return `<path d="M${tx} ${ty}Q${tx + Math.cos(a) * r * 0.6} ${ty + Math.sin(a) * r * 0.4 - 16} ${ex.toFixed(0)} ${ey.toFixed(0)}Q${tx + Math.cos(a) * r * 0.5} ${ty + Math.sin(a) * r * 0.4 - 4} ${tx} ${ty}Z" fill="#7DBF6A"/>`;
  };
  s += `<g class="ct-palm" style="transform-origin:${tx}px ${ty}px">${[-2.9, -2.2, -1.5, -0.9, -0.25, 0.4].map(frond).join('')}`;
  s += `<circle cx="${tx - 4}" cy="${ty + 6}" r="5" fill="#8A6A3A"/><circle cx="${tx + 5}" cy="${ty + 7}" r="5" fill="#8A6A3A"/></g>`;
  return s;
}

/** A two-storey shophouse: pastel front, shuttered windows upstairs, a tiled
 *  roof edge and the five-foot-way arches below. */
function shophouse(x, w, colour, trim, sign = '') {
  const top = G - 118;
  let s = `<path d="M${x - 3} ${top + 4}L${x + w / 2} ${top - 14}L${x + w + 3} ${top + 4}Z" fill="#D9774B"/>`;
  s += `<rect x="${x}" y="${top}" width="${w}" height="118" rx="3" fill="${colour}"/>`;
  s += `<rect x="${x - 2}" y="${top + 50}" width="${w + 4}" height="8" rx="2" fill="${trim}"/>`;
  // Upstairs: two tall shuttered windows.
  for (const k of [0.18, 0.58]) {
    const wx = x + w * k, ww = w * 0.24;
    s += `<path d="M${wx} ${top + 44}V${top + 10 + ww / 2}A${ww / 2} ${ww / 2} 0 0 1 ${wx + ww} ${top + 10 + ww / 2}V${top + 44}Z" fill="#FFD98A"/>`;
    s += `<path d="M${wx + ww / 2} ${top + 12}v31M${wx + 3} ${top + 24}h${ww - 6}M${wx + 3} ${top + 32}h${ww - 6}" stroke="${INK}" stroke-opacity=".25" stroke-width="1.6"/>`;
  }
  // The five-foot way: arches along the shaded walkway, warm light inside.
  s += `<rect x="${x + 2}" y="${top + 60}" width="${w - 4}" height="56" fill="#5C4363" fill-opacity=".35" stroke="none"/>`;
  const n = 2, aw = (w - 12) / n;
  for (let i = 0; i < n; i++) {
    const ax = x + 6 + i * aw;
    s += `<path d="M${ax + 3} ${G}V${top + 80}Q${ax + aw / 2} ${top + 60} ${ax + aw - 3} ${top + 80}V${G}Z" fill="#FFC872" fill-opacity=".85"/>`;
  }
  if (sign) {
    s += `<rect x="${x + w * 0.16}" y="${top + 42}" width="${w * 0.68}" height="16" rx="3" fill="#FFF8EA"/>`;
    s += `<text x="${x + w / 2}" y="${top + 54.5}" text-anchor="middle" font-family="Nunito,'Trebuchet MS',sans-serif" font-weight="900" font-size="11" fill="#C0392B" stroke="none">${sign}</text>`;
  }
  return s;
}

/** A red paper lantern hanging from (x, y), swaying on its string. */
function lantern(x, y, drop = 14, i = 0) {
  return `<g class="ct-lantern" style="transform-origin:${x}px ${y}px;animation-delay:${(-i * 0.7).toFixed(1)}s">`
    + `<path d="M${x} ${y}v${drop}" stroke="${INK}" stroke-width="1.5"/>`
    + `<ellipse cx="${x}" cy="${y + drop + 9}" rx="8" ry="9" fill="#E0533D"/>`
    + `<path d="M${x - 4} ${y + drop}h8M${x - 4} ${y + drop + 18}h8" stroke="#F5B82E" stroke-width="3"/>`
    + `<path d="M${x} ${y + drop + 20}v6" stroke="#F5B82E" stroke-width="2"/></g>`;
}

/** The kopitiam: a zinc awning, a string of lights, a table with kopi steaming. */
function kopitiam(x) {
  const top = G - 92;
  let s = `<rect x="${x}" y="${top}" width="136" height="92" rx="3" fill="#F3E3C3"/>`;
  s += `<rect x="${x + 8}" y="${top + 26}" width="120" height="66" fill="#6B4E3D" fill-opacity=".35" stroke="none"/>`;
  // Striped awning.
  s += `<path d="M${x - 8} ${top + 26}L${x + 4} ${top + 4}H${x + 132}L${x + 144} ${top + 26}Z" fill="#FFFFFF"/>`;
  for (let i = 0; i < 6; i++) s += `<path d="M${x - 6 + i * 25} ${top + 25}L${x + 6 + i * 21} ${top + 5}H${x + 16 + i * 21}L${x + 6 + i * 25} ${top + 25}Z" fill="#3FA796" stroke="none"/>`;
  s += `<rect x="${x + 22}" y="${top - 18}" width="92" height="20" rx="4" fill="#FFF8EA"/>`;
  s += `<text x="${x + 68}" y="${top - 3.5}" text-anchor="middle" font-family="Nunito,'Trebuchet MS',sans-serif" font-weight="900" font-size="13" fill="#22304A" stroke="none">KOPITIAM</text>`;
  // A string of fairy lights along the awning.
  s += `<path d="M${x - 6} ${top + 30}Q${x + 68} ${top + 46} ${x + 142} ${top + 30}" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
  for (let i = 1; i < 9; i++) {
    const t = i / 9, bx = x - 6 + 148 * t, by = top + 30 + Math.sin(t * Math.PI) * 8;
    s += `<circle class="ct-bulb" cx="${bx.toFixed(1)}" cy="${(by + 3).toFixed(1)}" r="3" fill="#FFE08A" stroke="none" style="animation-delay:${(-i * 0.37).toFixed(2)}s"/>`;
  }
  // The marble-top table, two stools and a cup of kopi with its steam.
  s += `<rect x="${x + 34}" y="${G - 30}" width="60" height="7" rx="3" fill="#FFFFFF"/><path d="M${x + 64} ${G - 23}V${G}" stroke="${INK}" stroke-width="3"/>`;
  s += `<rect x="${x + 22}" y="${G - 16}" width="12" height="16" rx="2" fill="#E0533D"/><rect x="${x + 96}" y="${G - 16}" width="12" height="16" rx="2" fill="#E0533D"/>`;
  s += `<path d="M${x + 56} ${G - 42}h14l-2 12h-10z" fill="#FFFFFF"/><path d="M${x + 70} ${G - 39}q6 1 0 7" fill="none" stroke="${INK}" stroke-width="2"/>`;
  for (let i = 0; i < 3; i++) {
    const sx = x + 59 + i * 4;
    s += `<path class="ct-steam" d="M${sx} ${G - 46}q-4 -6 0 -12t0 -12" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" style="animation-delay:${(-i * 0.8).toFixed(1)}s"/>`;
  }
  return s;
}

/** A rain tree's wide umbrella canopy. */
function rainTree(x, h) {
  const top = G - h;
  return `<path d="M${x - 5} ${G}L${x - 3} ${top + 30}L${x + 3} ${top + 30}L${x + 5} ${G}Z" fill="#8E6A45"/>`
    + `<path d="M${x - 70} ${top + 36}Q${x - 74} ${top + 8} ${x - 40} ${top + 6}Q${x - 26} ${top - 12} ${x} ${top - 6}Q${x + 30} ${top - 14} ${x + 44} ${top + 6}Q${x + 76} ${top + 8} ${x + 70} ${top + 36}Q${x} ${top + 48} ${x - 70} ${top + 36}Z" fill="#8CC77A"/>`;
}

/**
 * The cosy skyline, 1200 x 220 units with the ground along the bottom: the
 * modern city hazy behind, the old neighbourhood in front. The middle third
 * (what a phone shows) holds the kampong house, the shophouses and the kopitiam.
 * `city: false` leaves the hazy city out (the title draws it as its own
 * parallax layers behind this one).
 */
export function cosySkylineSvg({ city = true } = {}) {
  const far = city ? titleSkylineSvg().replace('<svg ', '<svg x="0" y="36" width="1200" height="140" opacity=".55" ') : '';
  const near = [
    rainTree(40, 120),
    hdb(70, 120, 196, '#CDE7DF', '#7FB8A8', 1),
    palm(226, 150, 1),
    kampong(262),
    shophouse(408, 92, '#F6C9C4', '#E59A8E', 'TOKO'),
    shophouse(500, 92, '#CFE6C8', '#8FC18A'),
    shophouse(592, 92, '#FBE3A4', '#E8BE5A', 'KEDAI'),
    shophouse(684, 92, '#C9DDF2', '#8FB0D6'),
    // Lanterns along the eaves.
    [430, 470, 522, 562, 614, 654, 706, 746].map((lx, i) => lantern(lx, G - 62, 6 + (i % 2) * 6, i)).join(''),
    kopitiam(796),
    palm(958, 128, -1),
    hdb(990, 112, 168, '#F3DCC9', '#D9A68A', -1),
    rainTree(1150, 104),
  ];
  return `<svg viewBox="0 0 ${COSY_VIEW.w} ${COSY_VIEW.h}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="cosy-skyline">`
    + `<defs><linearGradient id="ctHaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB27A" stop-opacity=".0"/><stop offset="1" stop-color="#F59A7A" stop-opacity=".45"/></linearGradient></defs>`
    + far
    + (city ? `<rect x="0" y="40" width="1200" height="180" fill="url(#ctHaze)"/>` : '')
    + `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${near.join('')}</g>`
    + `<rect x="0" y="${G - 5}" width="1200" height="5" fill="#C9A77E"/></svg>`;
}

/** Fireflies drifting over the skyline: `n` little glowing dots with their own
 *  path and timing (CSS does the moving). */
export function fireflyHtml(n = 12, rand = Math.random) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const r = (a, b) => (a + rand() * (b - a)).toFixed(1);
    s += `<i class="ct-fly" style="left:${r(2, 98)}%;bottom:${r(4, 30)}%;--fx:${r(-40, 40)}px;--fy:${r(-90, -30)}px;animation-duration:${r(5, 9)}s;animation-delay:${r(-9, 0)}s"></i>`;
  }
  return s;
}

/** Dress the splash (browser only): the sunset sky and the fireflies. */
export function dressTitle(splash, { lowFx = false, still = false } = {}) {
  if (!splash || typeof document === 'undefined') return;
  splash.classList.add('cosy');
  if (lowFx) splash.classList.add('title-low');   // low graphics: the skyline holds still
  if (!splash.querySelector('.title-sky')) {
    const sky = document.createElement('div');
    sky.className = 'title-sky';
    sky.setAttribute('aria-hidden', 'true');
    splash.insertBefore(sky, splash.firstChild);
  }
  if (!lowFx && !still && !splash.querySelector('.title-flies')) {
    const flies = document.createElement('div');
    flies.className = 'title-flies';
    flies.setAttribute('aria-hidden', 'true');
    flies.innerHTML = fireflyHtml((globalThis.innerWidth || 800) < 600 ? 7 : 14);
    splash.insertBefore(flies, splash.querySelector('.splash-inner'));
  }
}
