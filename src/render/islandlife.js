import { TILE } from '../config.js';
import { islandPhotoArt, LANDINGS, LOOMS, PATTERNS, PHOTO_ASSIGNMENTS, STAGES } from '../data/islandlife.js';

const SITES = [
  ...Object.values(LANDINGS).map((site) => ({ ...site, kind: 'boat' })),
  ...LOOMS.map((site) => ({ ...site, kind: 'cloth' })),
  ...STAGES.map((site) => ({ ...site, kind: 'stage' })),
];
const INK = '#344259';
const polygon = (g, points, colour) => {
  g.beginPath();
  points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
  g.fillStyle = colour;
  g.fill();
  g.stroke();
};

export function drawIslandSites(g, game, ox, oy, width, height, time, calm) {
  for (const { x, y, kind } of SITES) {
    const px = (x + .5) * TILE - ox, py = (y + .5) * TILE - oy;
    if (px < -36 || px > width + 36 || py < -36 || py > height + 36) continue;
    g.save();
    g.translate(px, py);
    g.strokeStyle = INK;
    g.lineWidth = 1;
    g.fillStyle = 'rgba(52,66,89,.16)';
    g.beginPath();
    g.ellipse(1, 4, 16, 7, 0, 0, Math.PI * 2);
    g.fill();
    if (kind === 'boat') {
      g.fillStyle = '#b79370';
      g.fillRect(-14, -5, 28, 13);
      g.fillStyle = '#e3c598';
      for (let i = -12; i < 13; i += 5) g.fillRect(i, -5, 3, 13);
      const sway = calm ? 0 : Math.sin(time / 680 + x) * 2;
      polygon(g, [[-8, 0], [8, 0], [4, 4], [-5, 4]], '#347d7c');
      polygon(g, [[0, -17], [0, -1], [8 + sway, -1]], '#ffdf9d');
      polygon(g, [[-1, -13], [-1, -1], [-7 + sway, -1]], '#d47f68');
    } else {
      const cloth = kind === 'cloth';
      g.fillStyle = cloth ? '#99536c' : '#826445';
      g.fillRect(-15, -8, 30, 16);
      for (let i = -12; i < 13; i += 6) {
        if (cloth) polygon(g, [[i, -5], [i + 2, 0], [i, 5], [i - 2, 0]], '#f4cd91');
        else { g.fillStyle = '#dec08b'; g.fillRect(i, -7, 2, 14); }
      }
    }
    g.restore();
  }
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
