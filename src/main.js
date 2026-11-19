import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { Renderer } from './render/renderer.js';
import { Input, guardTouchZoom, guardPageShift, clickSecondFingerTaps } from './engine/input.js';
import { MovePad } from './engine/movepad.js';
import { Sfx } from './audio/sfx.js';
import { now } from './core/utils.js';
import { TILE } from './config.js';
import { saveGame, watchForImports } from './game/save.js';
import { handsOn } from './game/playbalance.js';
import { receiveTransfer, forwardToNewHome } from './game/transfer.js';
import { initPwa } from './pwa.js';
import { TitleScreen } from './ui/title.js';
import { cloud } from './game/cloud.js';
import { quickUse } from './game/quickuse.js';
import { installLinks } from './ui/links.js';

const VIEW_TILES = 15;        // tiles shown across the shorter side of the screen, at most
const VIEW_TILES_LONG = 24;   // ...and along the longer side

const ABILITY_KEYS = new Set(['z', 'x', 'c', 'v', 'b']);   // resolved against the weapon in hand

const canvas = document.getElementById('game-canvas');
// Opaque context: the world covers the whole canvas, so the browser can skip
// alpha-blending it against the page every frame.
const ctx = canvas.getContext('2d', { alpha: false });

// A save handed over from the game's old home at a-worthy.com (see transfer.js):
// imported before the game starts, then the page reloads into it.
receiveTransfer();
// On the old github.io address: hand the player over to the new one, and don't
// start a game here meanwhile (this await never finishes; the page is leaving).
if (forwardToNewHome()) await new Promise(() => {});
// Installable as an app, and playable offline once loaded (see pwa.js, sw.js).
initPwa();

// The title screen and its loading bar (title.js): it counts every picture the
// game asks for from here on, so it has to start before the game is built.
let lowGfx = false;
try { lowGfx = localStorage.getItem('singaporescape:gfx') === 'low'; } catch { /* ignore */ }
const title = new TitleScreen(document.getElementById('splash'), { lowFx: lowGfx });
title.trackImages();
// Signed in: settle the cloud save first (a newer one from another device loads
// straight in). Gives up after a couple of seconds offline (see cloud.js).
await cloud().boot();

const game = new Game();
// Graphics quality: "low" renders at 1x and trims particles, for older phones.
game.lowFx = lowGfx;
const ui = new UI(game);
installLinks(ui);   // names in the chat, quests and Codex open their entry (links.js)
const renderer = new Renderer(game, canvas, ctx);
const input = new Input(canvas);
const movepad = new MovePad(game);
guardTouchZoom();
guardPageShift();   // taps landing off-target after the iPhone keyboard (see input.js)
clickSecondFingerTaps();

game.ui = ui;
game.input = input;
game.audio = new Sfx(game.bus);
// The ambience beds follow the region you're in and the hour.
game.audio.ambienceSource = () => ({ zone: game.currentZoneName, night: 1 - game.daylightFactor() });
// Web Audio needs a user gesture to start; unlock on the first interaction.
const unlockAudio = () => game.audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

ui.init();
game.start();
title.attach(game);
// Accounts: background cloud uploads, the Account button on the title, the cloud toast.
cloud().attach(game);
import('./ui/accountui.js').then((m) => m.initAccountUi(document.getElementById('splash'))).catch(() => {});
// Postcard mode: the camera button that frames the view as a shareable postcard.
import('./ui/photomode.js').then((m) => m.initPhotoMode(game, canvas)).catch(() => {});

// Input wiring.
// Clicks and the action keys count as hands-on play, which refills Focus (playbalance.js).
input.onLeftClick((x, y) => { handsOn(game); game.onLeftClick(x, y); });
input.onRightClick((x, y) => { handsOn(game); game.onRightClick(x, y); });
input.onKey((e) => {
  // On the title screen the keys belong to it: Enter goes in (as does Space or
  // Enter on its focused button), and nothing reaches the game behind it.
  if (title.active) { if (e.key === 'Enter' && document.activeElement?.id !== 'splash-enter') hideSplash(); return; }
  // Typing in a search box (bank, bestiary) must not fire the shortcut keys.
  const t = e.target;
  if (e.key !== 'Escape' && t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if ('fgqlepzxcvb '.includes(e.key?.toLowerCase() || '-')) handsOn(game);
  // The number keys pick the five panel tabs: 1 Bag, 2 Skills, 3 Combat, 4 Journal, 5 Settings.
  const map = { '1': 'inventory', '2': 'skills', '3': 'combat', '4': 'quests', '5': 'settings' };
  if (map[e.key]) {
    document.querySelector(`#panel-tabs .tab-btn[data-view="${map[e.key]}"]`)?.click();
  } else if (e.key === 'f' || e.key === 'F') {
    quickUse(game);   // the food or potion that best fits your wound (game/quickuse.js)
  } else if (e.key === 'Tab' && !document.activeElement?.closest?.('#sidepanel, #modal-overlay, #chatbox, #ability-bar')) {
    // Tab in the world switches target; inside a panel it still moves keyboard focus.
    e.preventDefault();
    game.nextTarget();
  } else if (e.key === 'g' || e.key === 'G') {
    game.attackNearest();   // lock onto the nearest enemy, like the Attack button
  } else if (e.key === 'q' || e.key === 'Q') {
    game.toggleSpec();
  } else if (e.key === 'l' || e.key === 'L') {
    game.prayerBurst();   // spend a full bar of Faith (game/blessings.js)
  } else if (ABILITY_KEYS.has(e.key?.toLowerCase())) {
    game.activateAbilityKey(e.key);
  } else if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
    if (e.key === ' ') e.preventDefault();   // don't scroll the page
    game.interact();
  } else if (e.key === 'p' || e.key === 'P') {
    game.pickpocketNearest();
  } else if ((e.key === 'h' || e.key === 'H') && game.jobClass === 'merchant') {
    game.hireMercenary();   // Merchant: hire a mercenary
  } else if (e.key === 't' || e.key === 'T') {
    game.toggleAutoBattle();
  } else if (e.key === 'y' || e.key === 'Y') {
    game.toggleAutoGather();
  } else if (e.key === 'u' || e.key === 'U') {
    game.toggleAutoQuest();
  } else if (e.key === 'k' || e.key === 'K') {
    game.teleports?.start('town');    // teleport to Kampong Glam (teleports.js)
  } else if (e.key === 'r' || e.key === 'R') {
    game.teleports?.start('grave');   // teleport to your gravestone
  } else if (e.key === 'm' || e.key === 'M') {
    ui.openWorldMap();
  } else if (e.key === 'Escape') {
    ui.closeModal();
    ui.hideContextMenu();
  }
});

// Resize handling with device-pixel-ratio scaling for crisp rendering.
// Drawing cost grows with the canvas's pixel count, so it is kept within a
// budget: big or very sharp screens draw at a slightly lower resolution (the
// browser scales it up). `autoScale` drops further if frames keep running slow.
const PIXEL_BUDGET = 2.4e6;
let autoScale = 1;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  // Cap the backing-store density at 2x: 3x phone screens look the same at 2x
  // but would cost more than twice the fill-rate per frame.
  const budget = Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h));
  const dpr = Math.max(0.6, Math.min(game.lowFx ? 1 : 2, window.devicePixelRatio || 1, budget) * autoScale);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  // Zoom the world in so it never looks far away: at most VIEW_TILES tiles across
  // the shorter side and VIEW_TILES_LONG along the longer one.
  const zoom = Math.max(1, Math.min(2.2, Math.max(Math.min(w, h) / (VIEW_TILES * TILE), Math.max(w, h) / (VIEW_TILES_LONG * TILE))));
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
  game.camera.resize(w, h, zoom, dpr);
}
window.addEventListener('resize', resize);
resize();

// Main loop.
let last = now(), slowAvg = 16, lastScaleDown = 0;
function frame() {
  const t = now();
  let dt = t - last;
  last = t;
  if (dt > 250) dt = 250; // avoid huge catch-up after a tab switch
  // Frames averaging slower than ~30fps for a couple of seconds: draw at a
  // lower resolution (a step at a time, down to 60%; a reload starts afresh).
  if (dt < 250) {
    slowAvg = slowAvg * 0.97 + dt * 0.03;
    if (slowAvg > 33 && autoScale > 0.6 && t - lastScaleDown > 2500) {
      autoScale = Math.max(0.6, autoScale - 0.15); lastScaleDown = t; slowAvg = 20; resize();
    }
  }
  // One bad frame must not stop the loop: the game (and its autosave) would
  // freeze for good. Log the first error and carry on with the next frame.
  try {
    game.update(dt);
    if (!title.active) game.playMs = (game.playMs || 0) + dt;   // time played (saved; shown when choosing a cloud save)
    title.frame(dt);   // on the title: tours the camera, runs the loading bar
    renderer.render(t);
    ui.renderMinimap();
  } catch (err) {
    if (!frameErrorLogged) { frameErrorLogged = true; console.error('Frame error (the game keeps running):', err); }
  }
  requestAnimationFrame(frame);
}
let frameErrorLogged = false;
requestAnimationFrame(frame);

// Save when the tab is hidden or closed, so nothing since the last autosave
// (up to ~30s) is lost. Phones often kill a background tab without warning.
const saveOnLeave = () => { if (!game.pendingStyleChoice) saveGame(game); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveOnLeave(); });
window.addEventListener('pagehide', saveOnLeave);
// A save imported in another tab: this tab's game would autosave the old
// character back over it, so it stops saving and asks for a reload.
watchForImports(() => ui.showSaveReplacedElsewhere());

// Title / splash screen dismissal.
const splash = document.getElementById('splash');
const splashEnter = document.getElementById('splash-enter');
function hideSplash() {
  if (!title.ready) return;   // still loading (the button only shows once it's done)
  game.audio.unlock();
  // Dip to cream, hand the camera back, open the class picker, fade the title away.
  title.exit(() => { if (game.pendingStyleChoice || game.pendingClassChoice) ui.openStyleChoice(); });
}
splashEnter && splashEnter.addEventListener('click', hideSplash);
splash && splash.addEventListener('click', (e) => { if (e.target === splash) hideSplash(); });

// Expose for debugging in the console.
window.SS = { game, ui, renderer, movepad, title };
