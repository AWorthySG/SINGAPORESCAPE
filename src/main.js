import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { Renderer } from './render/renderer.js';
import { Input } from './engine/input.js';
import { now } from './core/utils.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const game = new Game();
const ui = new UI(game);
const renderer = new Renderer(game, canvas, ctx);
const input = new Input(canvas);

game.ui = ui;
game.input = input;

ui.init();
game.start();

// Input wiring.
input.onLeftClick((x, y) => game.onLeftClick(x, y));
input.onRightClick((x, y) => game.onRightClick(x, y));
input.onKey((e) => {
  const map = { '1': 'inventory', '2': 'equipment', '3': 'skills', '4': 'combat', '5': 'prayer', '6': 'quests', '7': 'settings' };
  if (map[e.key]) {
    document.querySelector(`#panel-tabs .tab-btn[data-view="${map[e.key]}"]`)?.click();
  } else if (e.key === 'r' || e.key === 'R') {
    game.toggleRun();
  } else if (e.key === 'Escape') {
    ui.closeModal();
    ui.hideContextMenu();
  }
});

// Resize handling with device-pixel-ratio scaling for crisp rendering.
function resize() {
  const dpr = window.devicePixelRatio || 1;
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
function hideSplash() { splash && splash.classList.add('hidden'); }
splashEnter && splashEnter.addEventListener('click', hideSplash);
splash && splash.addEventListener('click', (e) => { if (e.target === splash) hideSplash(); });

// Expose for debugging in the console.
window.SS = { game, ui, renderer };
