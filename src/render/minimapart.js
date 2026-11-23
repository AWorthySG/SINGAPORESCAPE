// The minimap's look: the ground in the colours of the painted ground
// textures (so it reads as the same pastel world, not a grey board), and
// what each creature shows as. Drawn by the UI's renderMinimap (ui.js); the
// terrain is painted once into a one-pixel-per-tile picture, so only these
// colour lookups and the dots are per-refresh work.
import { TERRAIN } from '../data/world.js';
import { questNpcIds } from './worldlabels.js';

// Each terrain's colour: the average of its painted ground texture
// (assets/world/ground-<name>.webp), dark grass a shade deeper as the
// renderer bakes it, so lawns, paths, plazas and water read as on screen.
export const MINIMAP_RGB = {
  [TERRAIN.GRASS]: [145, 195, 101],
  [TERRAIN.DARKGRASS]: [124, 176, 88],
  [TERRAIN.PATH]: [224, 179, 124],
  [TERRAIN.SAND]: [247, 218, 171],
  [TERRAIN.STONE]: [228, 207, 184],   // warmed like the town paving's tint (renderer.js)
  [TERRAIN.WOOD]: [187, 140, 95],
  [TERRAIN.WATER]: [90, 189, 230],
};
// Where one kind of ground meets another, the tile on the far side is shaded
// this much, a soft edge like the world's kerbs and shorelines.
const EDGE_SHADE = 0.86;

/** Fill `d` (RGBA, width x height) with the whole map's ground. */
export function paintMinimapTerrain(world, d) {
  const w = world.width, h = world.height, grass = MINIMAP_RGB[TERRAIN.GRASS];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = world.terrainAt(x, y);
    const col = MINIMAP_RGB[t] || grass;
    const edge = (y > 0 && world.terrainAt(x, y - 1) !== t) || (x > 0 && world.terrainAt(x - 1, y) !== t);
    const k = edge ? EDGE_SHADE : 1;
    const i = (y * w + x) * 4;
    d[i] = col[0] * k; d[i + 1] = col[1] * k; d[i + 2] = col[2] * k; d[i + 3] = 255;
  }
}

// Dot colours: two kinds for creatures, plus the quest marker drawn on top.
export const MINIMAP_DOT = { foe: '#E5484D', friend: '#FFF4D6', quest: '#FFD24A', ink: '#22304A' };

/** How a creature shows on the minimap: 'quest' (someone a quest in hand
 *  sends you to, or a moral choice waiting), 'foe' (anything you can fight)
 *  or 'friend' (townsfolk, shopkeepers, bankers...). */
export function minimapNpcKind(game, n) {
  if (n.attackable) return 'foe';
  if (game.moralPending?.(n) || questNpcIds(game).has(n.npcId)) return 'quest';
  return 'friend';
}
