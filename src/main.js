import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { Renderer } from './render/renderer.js';
import { Input } from './engine/input.js';
import { MovePad } from './engine/movepad.js';
import { Sfx } from './audio/sfx.js';
import { now } from './core/utils.js';

const ABILITY_KEYS = new Set(['z', 'x', 'c', 'v', 'b']);   // resolved against the weapon in hand

const canvas = document.getElementById('game-canvas');
// Opaque context: the world covers the whole canvas, so the browser can skip
// alpha-blending it against the page every frame.
const ctx = canvas.getContext('2d', { alpha: false });

const game = new Game();
// Graphics quality: "low" renders at 1x and trims particles, for older phones.
try { game.lowFx = localStorage.getItem('singaporescape:gfx') === 'low'; } catch { /* ignore */ }
const ui = new UI(game);
const renderer = new Renderer(game, canvas, ctx);
const input = new Input(canvas);
const movepad = new MovePad(game);

game.ui = ui;
game.input = input;
game.audio = new Sfx(game.bus);
// Web Audio needs a user gesture to start; unlock on the first interaction.
const unlockAudio = () => game.audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

ui.init();
game.start();

// Input wiring.
input.onLeftClick((x, y) => game.onLeftClick(x, y));
input.onRightClick((x, y) => game.onRightClick(x, y));
input.onKey((e) => {
  const map = { '1': 'inventory', '2': 'equipment', '3': 'skills', '4': 'combat', '5': 'prayer', '6': 'quests', '7': 'achievements', '8': 'settings' };
  if (map[e.key]) {
    document.querySelector(`#panel-tabs .tab-btn[data-view="${map[e.key]}"]`)?.click();
  } else if (e.key === 'r' || e.key === 'R') {
    game.toggleRun();
  } else if (e.key === 'f' || e.key === 'F') {
    game.eatFirstFood();
  } else if (e.key === 'g' || e.key === 'G') {
    game.attackNearest();   // lock onto the nearest enemy, like the Attack button
  } else if (e.key === 'q' || e.key === 'Q') {
    game.toggleSpec();
  } else if (ABILITY_KEYS.has(e.key?.toLowerCase())) {
    game.activateAbilityKey(e.key);
  } else if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
    if (e.key === ' ') e.preventDefault();   // don't scroll the page
    game.interact();
  } else if (e.key === 'p' || e.key === 'P') {
    game.pickpocketNearest();
  } else if (e.key === 't' || e.key === 'T') {
    game.toggleAutoBattle();
  } else if (e.key === 'm' || e.key === 'M') {
    ui.openWorldMap();
  } else if (e.key === 'Escape') {
    ui.closeModal();
    ui.hideContextMenu();
  }
});

// Resize handling with device-pixel-ratio scaling for crisp rendering.
function resize() {
  // Cap the backing-store density at 2x: 3x phone screens look the same at 2x
  // but would cost more than twice the fill-rate per frame.
  const dpr = Math.min(game.lowFx ? 1 : 2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.camera.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// Main loop.
let last = now();
function frame() {
  const t = now();
  let dt = t - last;
  last = t;
  if (dt > 250) dt = 250; // avoid huge catch-up after a tab switch
  game.update(dt);
  renderer.render(t);
  ui.renderMinimap();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Title / splash screen dismissal.
const splash = document.getElementById('splash');
const splashEnter = document.getElementById('splash-enter');
function hideSplash() {
  game.audio.unlock();
  splash && splash.classList.add('hidden');
  if (game.pendingStyleChoice || game.pendingClassChoice) ui.openStyleChoice();
}
splashEnter && splashEnter.addEventListener('click', hideSplash);
splash && splash.addEventListener('click', (e) => { if (e.target === splash) hideSplash(); });

// Expose for debugging in the console.
window.SS = { game, ui, renderer, movepad };
