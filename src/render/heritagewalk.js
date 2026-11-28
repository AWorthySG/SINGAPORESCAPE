import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { PHOTO_ASSIGNMENTS } from '../data/islandlife.js';

// Inlaid tiles following the existing plaza and south road. Beyond the road,
// a short approach turns into the hall's forecourt at the foot of the dome.
const SPANS = [
  [51, 49, 51, 55], [52, 55, 57, 55], [57, 56, 57, 61], [57, 63, 57, 82],
  [58, 61, 63, 61], [58, 62, 58, 62], [58, 63, 62, 63], [63, 62, 63, 63], [64, 63, 64, 63], [58, 82, 62, 82],
];
const STOPS = [
  { x: 51, y: 49, kind: 'bank' },
  { x: 64, y: 63, kind: 'market' },
  { x: 62, y: 82, kind: 'dome' },
];
const BANK = { x: 51, y: 48 };
const MARKET = { x: 64, y: 62 };
const COLOURS = {
  bank: ['#356c68', '#f4cb81'],
  market: ['#ac6651', '#ffe1a0'],
  dome: ['#84684a', '#f8d487'],
};

const locationsByWorld = new WeakMap();

/** Resolve the authored details once per world, as individual tiles so the
 *  inlay can cross the edge of a district. */
export function heritageLocations(world) {
  const cached = locationsByWorld.get(world);
  if (cached && cached.terrain === world.terrain) return cached;
  const resolve = (point) => world.authoredTile?.(point) || point;
  const inlays = [];
  for (const [left, top, right, bottom] of SPANS) {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const stop = STOPS.find((s) => s.x === x && s.y === y);
      inlays.push(resolve({ x, y, horizontal: top === bottom, kind: stop?.kind }));
    }
  }
  const locations = { terrain: world.terrain, bank: resolve(BANK), market: resolve(MARKET), inlays,
    photos: PHOTO_ASSIGNMENTS.filter((p) => p.subject).map(resolve) };
  locationsByWorld.set(world, locations);
  return locations;
}

export function heritageTiles(world, x0, y0, x1, y1) {
  return heritageLocations(world).inlays.filter(({ x, y }) => x >= x0 && x < x1 && y >= y0 && y < y1
    && !world.isBlocked?.(x, y) && world.terrainAt(x, y) !== TERRAIN.WATER);
}

function diamond(g, x, y, radius, colour) {
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(x, y - radius);
  g.lineTo(x + radius, y);
  g.lineTo(x, y + radius);
  g.lineTo(x - radius, y);
  g.closePath();
  g.fill();
}

export function landmarkPhotoTiles(world, x0, y0, x1, y1) {
  return heritageLocations(world).photos.filter(({ x, y }) => x >= x0 && x < x1 && y >= y0 && y < y1
    && !world.isBlocked(x, y) && world.terrainAt(x, y) !== TERRAIN.WATER);
}

export function paintHeritageTiles(g, world, x0, y0, x1, y1) {
  for (const { x, y, horizontal, kind } of heritageTiles(world, x0, y0, x1, y1)) {
    const px = (x - x0) * TILE, py = (y - y0) * TILE, half = TILE / 2;
    g.fillStyle = 'rgba(77,56,48,.22)';
    // A continuous grout line, with handmade terracotta and ivory tiles.
    g.fillRect(px + (horizontal ? 0 : half - 5), py + (horizontal ? half - 5 : 0), horizontal ? TILE : 10, horizontal ? 10 : TILE);
    for (let i = 0; i < 4; i++) {
      const a = (i + .5) * TILE / 4;
      diamond(g, px + (horizontal ? a : half), py + (horizontal ? half : a), 3.4, i % 2 ? '#b77e66' : '#e7c7a1');
    }
    if (!kind) continue;
    const [border, centre] = COLOURS[kind];
    if (kind === 'dome') {
      g.fillStyle = border;
      g.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      g.fillStyle = '#d7b582';
      g.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      for (const dx of [6, TILE - 6]) {
        for (const dy of [6, TILE - 6]) diamond(g, px + dx, py + dy, 2.4, '#f8e5bf');
      }
    }
    diamond(g, px + half, py + half, 13, border);
    diamond(g, px + half, py + half, 10, centre);
    diamond(g, px + half, py + half, 5, border);
  }
  // Mark the same viewpoints used by the Photography assignments.
  for (const { id, x, y } of landmarkPhotoTiles(world, x0, y0, x1, y1)) {
    const cx = (x - x0 + .5) * TILE, cy = (y - y0 + .5) * TILE;
    if (id !== 'dome') {
      diamond(g, cx, cy, 12, '#537b72');
      diamond(g, cx, cy, 9.5, '#34615c');
    }
    g.fillStyle = '#fff5d8';
    g.fillRect(cx - 5, cy - 3, 10, 7);
    g.fillRect(cx - 3, cy - 4, 4, 2);
    g.fillStyle = id === 'dome' ? '#84684a' : '#34615c';
    g.beginPath();
    g.arc(cx, cy + .5, 2.2, 0, Math.PI * 2);
    g.fill();
  }
}

// The bank's sign sits just above the booth art, at the centre of the three
// counters. Keep the booth itself visible and targetable from either side.
export function drawHeritageBank(g, x, y) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#2e4946';
  g.fillRect(-23, -35, 46, 13);
  g.fillStyle = '#50847a';
  g.fillRect(-22, -34, 44, 10);
  g.fillStyle = '#f8dc9d';
  g.fillRect(-19, -33, 38, 1);
  g.font = '900 8px Nunito,"Trebuchet MS",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BANK', 0, -28, 37);
  g.restore();
}

// Cloth under the food stall's eaves, with a small breeze at the free edge.
export function drawMarketValance(g, x, y, time, still) {
  const sway = still ? 0 : Math.sin(time / 560) * 1.4;
  g.save();
  g.translate(x, y);
  for (let i = 0; i < 6; i++) {
    const left = -18 + i * 6, bottom = -14 + sway * Math.sin(i * .85);
    g.fillStyle = i % 2 ? '#f4d39f' : '#a25443';
    g.beginPath();
    g.moveTo(left, -20);
    g.lineTo(left + 6, -20);
    g.lineTo(left + 6, bottom);
    g.quadraticCurveTo(left + 3, bottom + 2.5, left, bottom);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// A quiet ground cue works with touch as well as a mouse and shares the gold
// already used for hovered objects. Only the closest local service gets one.
export function heritageService(world, player) {
  const { bank: bankAt, market } = heritageLocations(world);
  const bankX = Math.max(bankAt.x - 1, Math.min(bankAt.x + 1, player.x));
  if (Math.max(Math.abs(player.x - bankX), Math.abs(player.y - bankAt.y)) <= 2) {
    const bank = world.objectAt?.(bankX, bankAt.y);
    if (bank?.objId === 'bank_booth') return bank;
  }
  if (Math.max(Math.abs(player.x - market.x), Math.abs(player.y - market.y)) <= 2) {
    const food = world.objectAt?.(market.x, market.y);
    if (food?.objId === 'stall_food') return food;
  }
  return null;
}

export function drawHeritageServiceCue(g, obj, ox, oy) {
  g.save();
  g.strokeStyle = 'rgba(194,139,52,.75)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.ellipse((obj.x + .5) * TILE - ox, (obj.y + 1.04) * TILE - oy, 13, 5, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}
