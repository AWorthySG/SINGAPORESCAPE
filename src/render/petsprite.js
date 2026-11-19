// Drawing the pet that follows you (game/pets.js): a life-skill pet's own
// painted picture (assets/creatures/pets/<petId>.webp), or a boss pet's boss art
// at about 45% size, gliding after you and hopping gently as it goes. Until a
// picture loads (and headless) it falls back to its creature, like every monster
// does. Cheap: one image or sticker draw a frame.

import { TILE } from '../config.js';
import { getNpc } from '../data/npcs.js';
import { PET_BY_ID } from '../game/pets.js';
import { drawCreature, drawShadow } from './sprites.js';

export const PET_SCALE = 0.45;
const PET_ART_PX = 28;   // a pet picture's box on the map (its 256px canvas, shrunk)

/** Pets with a painted picture of their own (assets/creatures/pets/<id>.webp). */
export const PET_ART = new Set(['pet_mining', 'pet_smithing', 'pet_crafting', 'pet_fishing', 'pet_cooking', 'pet_firemaking',
  'pet_woodcutting', 'pet_thieving', 'pet_agility', 'pet_farming', 'pet_hunter', 'pet_herblore', 'pet_fletching']);
export const petArtSrc = (id) => (PET_ART.has(id) ? `assets/creatures/pets/${id}.webp` : null);
const _petImg = {};
function petImage(id) {
  if (_petImg[id] !== undefined) return _petImg[id];
  _petImg[id] = typeof Image === 'undefined' || !PET_ART.has(id) ? null : Object.assign(new Image(), { src: petArtSrc(id) });
  return _petImg[id];
}

/** The pet's drawable for the renderer's depth-sorted list, or null. */
export function petDrawable(game, ctx, ox, oy, vw, vh, timeMs) {
  const f = game.pets?.follower, P = f && PET_BY_ID[f.id];
  if (!P) return null;
  let def;
  try { def = getNpc(P.npcId); } catch { return null; }
  // Glide toward its tile (the tick moves it a whole tile at a time).
  const tx = f.x * TILE + TILE / 2, ty = f.y * TILE + TILE / 2;
  const dt = Math.min(100, Math.max(0, timeMs - (f.t ?? timeMs)));
  f.t = timeMs;
  if (f.px == null || Math.abs(tx - f.px) + Math.abs(ty - f.py) > TILE * 6) { f.px = tx; f.py = ty; }
  const k = 1 - Math.exp(-dt / 160);
  f.px += (tx - f.px) * k; f.py += (ty - f.py) * k;
  const moving = Math.abs(tx - f.px) + Math.abs(ty - f.py) > 1.5;
  const cx = f.px - ox, cy = f.py - oy;
  if (cx < -60 || cy < -60 || cx > vw + 60 || cy > vh + 60) return null;
  const sc = Math.max(0.55, (def.scale || 1) * PET_SCALE);
  // A little hop while it trots after you, a slow breath at rest (none with reduced motion).
  const hop = game.reduceMotion ? 0 : moving ? Math.abs(Math.sin(timeMs * 0.016)) * 5 : (1 + Math.sin(timeMs * 0.004)) * 0.6;
  const img = petImage(f.id);
  return { sortY: f.py / TILE - 0.02, z: 2, draw: () => {
    drawShadow(ctx, cx, cy + 9 * sc, 9 * sc * (1 - hop / 20), 4 * sc);
    if (img && img.complete && img.naturalWidth) {
      // Its own picture, feet where the creature's would be, turned the way it walks.
      ctx.save();
      ctx.translate(cx, cy - 2 - hop + 13.5 * sc);
      if ((f.fx || 1) < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -PET_ART_PX / 2, -PET_ART_PX, PET_ART_PX, PET_ART_PX);
      ctx.restore();
      return;
    }
    drawCreature(ctx, P.npcId, cx, cy - 2 - hop, {
      time: timeMs, fx: f.fx || 1, moving: false, still: true, pet: true, low: true,
      scale: sc, sprite: def.sprite, color: def.color, boss: def.boss, family: def.family,
    });
  } };
}
