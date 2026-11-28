import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { leafArt } from '../render/fxart.js';

// Little reactions to the player moving through the world, made from the game's
// own particles (so they share its cap): dust kicked up at your feet as you run
// or turn sharply, and leaves shaken loose from trees you pass beneath. Purely
// cosmetic and off in low graphics. Footstep audio also follows the gait.

// Dust colours per ground: sandy on sand, pale on paths and paving, a soft
// grey-green on grass. Water throws none.
const DUST = {
  [TERRAIN.SAND]: '#e9d7ad', [TERRAIN.PATH]: '#e2cfa8', [TERRAIN.STONE]: '#ddd5c6', [TERRAIN.WOOD]: '#cfb48e',
  [TERRAIN.GRASS]: '#c9d9b4', [TERRAIN.DARKGRASS]: '#bccfa8',
};
const FOOTSTEP = {
  [TERRAIN.STONE]: 'footstep:stone', [TERRAIN.GRASS]: 'footstep:grass', [TERRAIN.DARKGRASS]: 'footstep:grass',
  [TERRAIN.PATH]: 'footstep:path', [TERRAIN.WOOD]: 'footstep:wood', [TERRAIN.SAND]: 'footstep:sand', [TERRAIN.WATER]: 'footstep:water',
};
const LEAF_CHANCE = 0.3;   // per tile stepped beside a tree

// Its own little random source, so these cosmetic rolls never shift the game's
// Math.random sequence (fights and drops stay exactly as they were).
let seed = 0x9e3779b9;
function rnd() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}

/** Call once a frame: watches the player's steps and turns. State lives on `st`. */
export function footFx(game, st) {
  const p = game.player;
  // walkPhase advances with travel, including the frame a last step lands.
  // Reading it separately from the particles keeps audio on low graphics.
  const stepped = Math.floor(p.walkPhase + 1e-9) > Math.floor((st.phase ?? p.walkPhase) + 1e-9);
  st.phase = p.walkPhase;
  if (p.alive && stepped) {
    const cue = FOOTSTEP[game.world.terrainAt(p.x, p.y)];
    if (cue) game.bus.emit('sfx', cue);
  }
  if (game.lowFx || !p.alive) { st.tile = -1; return; }
  const c = p.renderCenter();
  // A running footstep raises a small puff behind the player.
  if (stepped && p.running && p.moving) dust(game, c.x - (p.facing?.dx || 0) * 6, c.y + 13, 2);
  // A sharp turn (the sprite's turn-around just started): a bigger scuff.
  if (p.turnT > (st.turn || 0) && p.moving) dust(game, c.x, c.y + 13, 4);
  st.turn = p.turnT;
  // Each new tile beside a tree may shake a leaf or two loose (and rustle it).
  const tile = p.y * game.world.width + p.x;
  if (tile !== st.tile) {
    st.tile = tile;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const o = game.world.objectAt(p.x + dx, p.y + dy);
      if (!o || o.def.type !== 'tree' || o.depleted || rnd() > LEAF_CHANCE) continue;
      game.world.shake(o, Math.max(o.shakeT || 0, 140));
      const n = 1 + (rnd() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const autumn = rnd() < 0.25;
        game._pushParticle({
        x: o.x * TILE + TILE / 2 + (rnd() - 0.5) * 22, y: o.y * TILE - 8 - rnd() * 10,
        vx: (rnd() - 0.5) * 0.02, vy: 0.014 + rnd() * 0.01, g: 0,
        life: 2000, maxLife: 2000, size: 1.6 + rnd() * 0.8, color: autumn ? '#e0a63a' : '#5fb05a', add: false,
        shape: 'leaf', art: leafArt(o, autumn, i), rot: rnd() * 6.28, spin: (rnd() - 0.5) * 0.006, sway: rnd() * 6.28,
        });
      }
      return;   // one tree per step is plenty
    }
  }
}

function dust(game, x, y, n) {
  const t = game.world.terrainAt(game.player.x, game.player.y);
  const color = DUST[t];
  if (!color) return;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, s = 0.006 + rnd() * 0.014;
    game._pushParticle({ x: x + Math.cos(a) * 3, y, vx: Math.cos(a) * s, vy: -0.008 - rnd() * 0.01, g: 0.00001, drag: 0.97,
      life: 340 + rnd() * 120, maxLife: 460, size: 1.8 + rnd() * 1.4, color, add: false, art: n >= 4 ? 'dust_m' : 'dust_s' });
  }
}
