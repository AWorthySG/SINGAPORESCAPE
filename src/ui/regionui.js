// The Places section of the Codex window: every region of the island, and a
// page for each with its level band, monsters and bosses, resource zones,
// quest givers, shops, MRT stops, your reputation there, a small map and Go.
// The facts come from src/game/regioninfo.js.
//
// The map is drawn once per region from the world's terrain (one pixel a
// tile) and kept as an image, so opening a page again costs nothing. Without
// a DOM (the tests) there is simply no map.
import { getNpc } from '../data/npcs.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { TERRAIN } from '../data/world.js';
import { formatNumber } from '../core/utils.js';
import { regionList, regionInfo } from '../game/regioninfo.js';
import { regionFlavour } from '../data/flavour.js';
import { districtArtwork } from '../data/districtVisuals.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pctOf = (a, b) => (b ? Math.floor((a / b) * 100) : 0);

// The map's colours: the world's own pastel ground (renderer.js), and its sea.
const MAP_RGB = {
  [TERRAIN.GRASS]: [170, 216, 146], [TERRAIN.DARKGRASS]: [150, 200, 128], [TERRAIN.PATH]: [238, 216, 178],
  [TERRAIN.SAND]: [248, 232, 196], [TERRAIN.STONE]: [222, 214, 200], [TERRAIN.WOOD]: [222, 186, 142], [TERRAIN.WATER]: [122, 190, 232],
};
const MARK = { station: [214, 51, 108], zone: [240, 140, 20], giver: [255, 210, 74] };

/** A region's little map as an image URL (made once, then cached), or null without a DOM. */
export function regionMapSrc(game, r) {
  if (typeof document === 'undefined' || !r?.zone || !game?.world) return null;
  const cache = (game._regionMaps ||= {});
  if (cache[r.name] !== undefined) return cache[r.name];
  cache[r.name] = null;
  try {
    const z = r.zone, w = game.world;
    const W = z.x1 - z.x0 + 1, H = z.y1 - z.y0 + 1;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = MAP_RGB[w.terrainAt(z.x0 + x, z.y0 + y)] || MAP_RGB[TERRAIN.GRASS];
      const i = (y * W + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Markers grow with the map, so a small town's don't swamp it.
    const k = Math.max(W, H) < 60 ? 0 : 1;
    const dot = (x, y, rgb, s = 1 + k) => { ctx.fillStyle = `rgb(${rgb.join(',')})`; ctx.fillRect(x - z.x0 - s, y - z.y0 - s, s * 2 + 1, s * 2 + 1); };
    for (const q of r.zones) dot(q.x, q.y, MARK.zone, 2 + k);
    for (const q of r.givers) dot(q.x, q.y, MARK.giver);
    for (const q of r.stations) dot(q.x, q.y, MARK.station);
    cache[r.name] = cv.toDataURL('image/png');
  } catch { cache[r.name] = null; }
  return cache[r.name];
}

function placePicture(art, fallback = '') {
  if (!art) return `<span class="ency-place-picture unknown" aria-hidden="true">${fallback}</span>`;
  return `<span class="ency-place-picture${art.scenery ? ' scenery' : ''}" aria-hidden="true"><img src="${esc(art.scenery || art.src)}" alt="" loading="lazy" decoding="async"></span>`;
}

/** Every region: name, level band and a picture revealed on the first visit. */
export function regionListHTML(game) {
  const list = regionList(game);
  const seen = list.filter((r) => r.visited).length;
  const groups = [...new Set(list.map((r) => r.group))];
  return `<div class="cx-head"><div class="cx-prog"><span class="cx-prog-label">Visited <b>${seen} / ${list.length}</b> · ${pctOf(seen, list.length)}%</span>` +
    `<span class="cx-bar"><i style="width:${pctOf(seen, list.length)}%"></i></span></div></div>` +
    groups.map((g) => `<h4 class="ency-h4">${esc(g)}</h4><div class="ency-place-grid">` + list.filter((r) => r.group === g).map((r) => {
      const art = r.visited ? districtArtwork(r.name) : null;
      const palette = art ? ` style="--district-ink:${art.ink};--district-paper:${art.paper}"` : '';
      return `<button type="button" class="cx-row ency-place-card${r.visited ? '' : ' unseen'}" data-region="${esc(r.name)}"${palette}>` +
        placePicture(art, r.visited ? '🗺️' : '?') +
        `<span class="ency-place-copy"><b>${r.visited ? esc(r.name) : '???'}</b>` +
        `<span class="cx-row-sub">${r.band ? `Monsters level ${esc(r.band)}` : 'Peaceful'}</span>` +
        `<span class="ency-place-status">${r.visited ? 'Visited' : 'Not visited'}</span></span></button>`;
    }).join('') + '</div>').join('');
}

const goBtn = (x, y, label = 'Go') => `<button type="button" class="wm-go" data-goxy="${x},${y}">${label}</button>`;

/** One region's page. Its name shows even before your first visit (you tapped it). */
export function regionPageHTML(game, name) {
  const r = regionInfo(game, name);
  if (!r) return '<div class="modal-hint">That place is missing.</div>';
  const art = districtArtwork(r.name);
  const palette = art ? ` style="--district-ink:${art.ink};--district-paper:${art.paper}"` : '';
  const mon = (id) => `<button type="button" class="cp-chip ency-chip" data-monster="${esc(id)}">${game?.kills?.[id] > 0 ? esc(getNpc(id).name) : '???'} <small>${formatNumber(getNpc(id).level)}</small></button>`;
  let html = `<div class="cx-entry ency-entry ency-region"><div class="ency-place-hero"${palette}>` +
    (art ? placePicture(art) : '') +
    `<div class="ency-place-heading"><div class="cx-entry-name">${esc(r.name)}</div>` +
    `<div class="cx-entry-lvl">${r.band ? `Monsters level ${esc(r.band)}` : 'Peaceful'} · ${esc(r.group)}${r.visited ? '' : ' · not visited yet'}</div>`;
  if (art) html += `<div class="ency-place-landmark">${esc(art.landmark)}</div>`;
  if (r.rep) {
    const n = r.rep.next;
    html += `<div class="ency-rep"><span>Your reputation: <b style="color:${esc(r.rep.rank.colour)}">${esc(r.rep.rank.name)}</b> (${formatNumber(Math.floor(r.rep.points))})</span>` +
      (n ? `<span class="cx-bar"><i style="width:${Math.round(n.frac * 100)}%"></i></span><small>${formatNumber(n.need)} to ${esc(n.next.name)}</small>` : '<small>The highest rank</small>') + '</div>';
  }
  html += '</div></div>';
  const p = game?.player;
  html += `<div class="cx-go-row ency-go-row"><span class="cx-dist">${p ? `${formatNumber(Math.max(Math.abs(r.go.x - p.x), Math.abs(r.go.y - p.y)))} tiles away` : ''}</span>` +
    `<button type="button" class="wm-go cx-map" data-mapxy="${r.go.x},${r.go.y}" data-label="${esc(r.name)}">World map</button>${goBtn(r.go.x, r.go.y)}</div>`;
  // The map, with you on it when you are inside.
  const src = regionMapSrc(game, r);
  const z = r.zone;
  const you = p && r.inside(p.x, p.y) ? `<i class="ency-you" style="left:${((p.x - z.x0 + 0.5) / (z.x1 - z.x0 + 1) * 100).toFixed(1)}%;top:${((p.y - z.y0 + 0.5) / (z.y1 - z.y0 + 1) * 100).toFixed(1)}%"></i>` : '';
  if (src) {
    // At most about 260px tall, whatever the region's shape.
    const W = z.x1 - z.x0 + 1, H = z.y1 - z.y0 + 1;
    html += `<div class="ency-map" style="aspect-ratio:${W}/${H};max-width:min(100%, ${Math.round(260 * W / H)}px)"><img src="${src}" alt="Map of ${esc(r.name)}">${you}</div>` +
      '<div class="ency-legend"><span><i class="lg st"></i>MRT</span><span><i class="lg gv"></i>Quest giver</span><span><i class="lg rz"></i>Resource zone</span>' + (you ? '<span><i class="lg you"></i>You</span>' : '') + '</div>';
  }
  const note = regionFlavour(r.name);
  if (note) html += `<div class="cx-sec ency-dyk"><h4>Did you know?</h4><p>${esc(note)}</p></div>`;
  if (r.stations.length) html += `<div class="cx-sec"><h4>MRT</h4>${r.stations.map((s) => `<div class="ency-line"><span>🚇 <b>${esc(s.name)}</b></span>${goBtn(s.x, s.y)}</div>`).join('')}</div>`;
  if (r.givers.length) {
    html += `<div class="cx-sec"><h4>Quest givers</h4>${r.givers.map((g) => `<div class="ency-line"><span>❗ <b>${esc(g.name)}</b>: ${esc(g.quest)} <small>(fight level ${formatNumber(g.level)})${g.done ? ' ✓ done' : ''}</small></span>${goBtn(g.x, g.y)}</div>`).join('')}</div>`;
  }
  if (r.shops.length) html += `<div class="cx-sec"><h4>Shops</h4>${r.shops.map((s) => `<div class="ency-line"><span>🛒 <b>${esc(s.name)}</b></span>${goBtn(s.x, s.y)}</div>`).join('')}</div>`;
  if (r.zones.length) {
    html += `<div class="cx-sec"><h4>Resource zones</h4>${r.zones.map((q) => `<div class="ency-line"><span>⛏️ ${esc(q.summary)} <small>(<span class="ency-link" role="button" tabindex="0" data-ency="skill:${esc(q.skill)}">${esc(SKILL_BY_ID[q.skill]?.name || q.skill)} guide</span>)</small></span>${goBtn(q.x, q.y)}</div>`).join('')}</div>`;
  }
  if (r.bosses.length) html += `<div class="cx-sec"><h4>Bosses</h4><div class="cp-chips">${r.bosses.map(mon).join('')}</div></div>`;
  if (r.monsters.length) html += `<div class="cx-sec"><h4>Creatures <small>(${formatNumber(r.monsters.length)}, level shown)</small></h4><div class="cp-chips">${r.monsters.map(mon).join('')}</div></div>`;
  return html + '</div>';
}
