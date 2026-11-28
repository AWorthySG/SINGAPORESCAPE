import { TILE } from '../config.js';
import { islandPhotoArt, PATTERNS, PHOTO_ASSIGNMENTS } from '../data/islandlife.js';

const INK = '#344259';
const polygon = (g, points, colour) => {
  g.beginPath();
  points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
  g.fillStyle = colour;
  g.fill();
  g.stroke();
};

export function drawHomeAlbum(g, game, ox, oy, width, height) {
  const display = PHOTO_ASSIGNMENTS.find((p) => p.id === game.islandLife?.display);
  if (!display || !game.home?.owned || !game.home.origin) return;
  const t = game.home.tile(4, 3);
  const px = (t.x + .5) * TILE - ox, py = (t.y + .5) * TILE - oy;
  if (px < -26 || px > width + 26 || py < -26 || py > height + 26) return;
  const key = display.id;
  if (!prints.has(key) && typeof Image === 'function') {
    const image = new Image();
    image.src = islandPhotoArt(display);
    prints.set(key, image);
  }
  const img = prints.get(key);
  g.fillStyle = '#836348';
  g.fillRect(px - 12, py - 9, 24, 18);
  g.fillStyle = '#fbebc9';
  g.fillRect(px - 10, py - 7, 20, 14);
  if (img?.complete && img.naturalWidth) g.drawImage(img, px - 9, py - 7, 18, 13);
}
const prints = new Map();
const scarves = new Map();

export function drawIslandScarf(g, id, x, y, facing) {
  const pattern = PATTERNS.find((p) => p.id === id);
  if (!pattern) return;
  if (!scarves.has(id) && typeof Image === 'function') {
    const image = new Image();
    image.src = `assets/icons/scarf-${pattern.art || id}.webp`;
    scarves.set(id, image);
  }
  const art = scarves.get(id);
  if (art?.complete && art.naturalWidth) {
    g.save();
    g.translate(x, y);
    if (facing < 0) g.scale(-1, 1);
    if (pattern.hue) g.filter = `hue-rotate(${pattern.hue}deg)`;
    g.drawImage(art, -7, -5, 14, 14);
    g.restore();
    return;
  }
  g.save();
  g.translate(x, y);
  g.strokeStyle = INK;
  g.lineWidth = .65;
  const flip = facing < 0 ? -1 : 1;
  polygon(g, [[-5, -3], [5, -3], [4, 0], [3 * flip, 0], [5 * flip, 5], [2 * flip, 4], [0, 0], [-4, 0]], pattern.colours[0]);
  g.fillStyle = pattern.colours[1];
  g.fillRect(-3, -2, 6, 1);
  g.restore();
}
