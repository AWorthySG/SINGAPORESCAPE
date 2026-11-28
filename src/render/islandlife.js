import { TILE } from '../config.js';
import { islandPhotoArt, PATTERNS, PHOTO_ASSIGNMENTS } from '../data/islandlife.js';
import { photoThumbnail } from '../game/photowalk.js';
import { TEXTILE_PROJECTS } from '../data/textiles.js';

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
  const thumb = photoThumbnail(game, display.id);
  const capture = thumb && printImage(`${display.id}:capture`, thumb);
  const img = capture?.complete && capture.naturalWidth ? capture : printImage(display.id, islandPhotoArt(display));
  g.fillStyle = '#836348';
  g.fillRect(px - 12, py - 9, 24, 18);
  g.fillStyle = '#fbebc9';
  g.fillRect(px - 10, py - 7, 20, 14);
  if (img?.complete && img.naturalWidth) g.drawImage(img, px - 9, py - 7, 18, 13);
}
const prints = new Map();
const scarves = new Map();

function printImage(key, src) {
  let entry = prints.get(key);
  if (entry?.src !== src && typeof Image === 'function') {
    const image = new Image();
    image.src = src;
    entry = { src, image };
    prints.set(key, entry);
  }
  return entry?.image;
}

export function drawHomeTextile(g, game, ox, oy, width, height) {
  const selected = game.islandLife?.textiles?.display;
  if (!selected || !game.home?.owned || !game.home.origin) return;
  const project = TEXTILE_PROJECTS.find((p) => p.id === selected);
  if (!project) return;
  const t = game.home.tile(5, 3);
  const px = (t.x + .5) * TILE - ox, py = (t.y + .5) * TILE - oy;
  if (px < -22 || px > width + 22 || py < -22 || py > height + 22) return;
  const [cloth, resist, accent] = project.colours;
  g.save();
  g.translate(px, py);
  g.fillStyle = 'rgba(41, 39, 42, .22)';
  g.fillRect(-13, 9, 28, 5);
  g.fillStyle = '#70513e';
  g.fillRect(-13, -14, 2, 27);
  g.fillRect(11, -14, 2, 27);
  g.fillRect(-15, -15, 30, 3);
  g.strokeStyle = INK;
  g.lineWidth = 1;
  polygon(g, [[-11, -12], [11, -12], [10, 9], [-9, 10]], cloth);
  g.fillStyle = accent;
  g.fillRect(-10, -10, 20, 2);
  g.fillRect(-9, 6, 18, 2);
  g.fillStyle = resist;
  for (let x = -8; x <= 8; x += 4) g.fillRect(x, 9, 1, x % 8 ? 2 : 3);
  g.strokeStyle = resist;
  g.lineWidth = .65;
  for (const x of [-5, 5]) for (const y of [-4, 3]) {
    if (project.motif === 'wave') {
      g.beginPath(); g.moveTo(x - 3, y + 1);
      g.quadraticCurveTo(x - 1, y - 3, x + 1, y);
      g.quadraticCurveTo(x + 2, y + 1, x + 3, y - 1); g.stroke();
    } else if (project.motif === 'tile' || project.motif === 'star') {
      polygon(g, [[x, y - 2.7], [x + 3, y], [x, y + 2.7], [x - 3, y]], accent);
      if (project.motif === 'star') {
        g.beginPath(); g.moveTo(x - 2.5, y - 2.5); g.lineTo(x + 2.5, y + 2.5);
        g.moveTo(x - 2.5, y + 2.5); g.lineTo(x + 2.5, y - 2.5); g.stroke();
      }
    } else {
      g.fillStyle = resist;
      for (const [dx, dy] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]]) {
        g.beginPath(); g.arc(x + dx, y + dy, 1, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = accent;
      g.fillRect(x - .7, y - .7, 1.4, 1.4);
    }
  }
  g.restore();
}

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
