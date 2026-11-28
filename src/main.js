import { showResumeNotice } from './ui/journeyui.js';
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
import { installLinks } from './ui/links.js';
import { handleGameShortcut, keyboardBlocked } from './ui/keyboard.js';
import { FxGovernor, slowFrames, shouldScaleDown, judgeFrames, TRIM_OFF_HOLD } from './render/governor.js';
import { preloadFx } from './render/fxart.js';
import { clearNamePillCache } from './render/namepill.js';

const VIEW_TILES = 15;        // tiles shown across the shorter side of the screen, at most
const VIEW_TILES_LONG = 24;   // ...and along the longer side

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
// Its own pictures are asked for at once: the connection is free while the world is built.
title.warm();
// Signed in: settle the cloud save first (a newer one from another device loads
// straight in). Gives up after a couple of seconds offline (see cloud.js).
await cloud().boot();

const game = new Game({ layout: 'singapore' });
// Graphics quality: "low" renders at 1x and trims particles, for older phones.
game.lowFx = lowGfx;
const ui = new UI(game);
installLinks(ui);   // names in the chat, quests and Codex open their entry (links.js)
const renderer = new Renderer(game, canvas, ctx);
const input = new Input(canvas);
const movepad = new MovePad(game, undefined, () => !title.active && !keyboardBlocked(ui, game));
guardTouchZoom();
guardPageShift();   // taps landing off-target after the iPhone keyboard (see input.js)
clickSecondFingerTaps();

game.ui = ui;
game.input = input;
game.audio = new Sfx(game.bus);
// The ambience beds follow the region you're in and the hour.
game.audio.ambienceSource = () => ({ zone: game.currentZoneName, night: 1 - game.daylightFactor() });
game.audio.musicSource = () => title.active ? 'Singapore' : game.currentZoneName;
// Routine combat sounds sit a little lower while auto battle runs the fight.
game.audio.autoSource = () => game.autoBattle;
// Web Audio needs a user gesture to start; unlock on the first interaction.
const unlockAudio = () => game.audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// Settings > Show performance (ui/perfhud.js): a small readout of frame times
// and what fills each frame, for a screenshot of what is slow on a phone. Off
// (the default) it costs nothing: its module isn't even loaded, and the frame
// loop only checks that it isn't there. Kept on this device, like Graphics.
const PERF_KEY = 'singaporescape:perf';
let perfHud = null;
function showPerf(on) {
  ui.perfOn = on;
  if (!on) { perfHud?.remove(); perfHud = null; return; }
  import('./ui/perfhud.js').then((m) => {
    if (ui.perfOn && !perfHud) perfHud = new m.PerfHud(game, canvas, () => autoScale);
  }).catch(() => {});
}
ui.perfOn = false;
ui.setPerf = (on) => {
  try { localStorage.setItem(PERF_KEY, on ? '1' : '0'); } catch { /* storage blocked: just this visit */ }
  showPerf(on);
};
try { if (localStorage.getItem(PERF_KEY) === '1') showPerf(true); } catch { /* ignore */ }

ui.init();
// A slow font load can leave fallback letters baked into HUD bitmaps.
// Let play start on time and repaint the cached labels once Nunito is ready.
const hudFont = '900 12px Nunito';
if (document.fonts && !document.fonts.check(hudFont)) {
  document.fonts.load(hudFont).then(() => {
    clearNamePillCache();
    ui.refreshCanvasFonts();
  }).catch(() => {});
}
game.start();
title.attach(game);
// The painted critters, particles, banners and plaques (fxart.js): the ones in
// view load as they're drawn; the rest once the title has finished loading.
title.later(preloadFx);
// Accounts: background cloud uploads, the Account button on the title, the cloud toast.
cloud().attach(game);
import('./ui/accountui.js').then((m) => m.initAccountUi(document.getElementById('splash'))).catch(() => {});
// Postcard mode: the camera button that frames the view as a shareable postcard.
import('./ui/photomode.js').then((m) => m.initPhotoMode(game, canvas)).catch(() => {});

// Input wiring.
// Clicks and the action keys count as hands-on play, which refills Focus (playbalance.js).
input.onLeftClick((x, y) => { handsOn(game); game.onLeftClick(x, y); });
input.onRightClick((x, y) => { handsOn(game); game.onRightClick(x, y); });
// A tap on the game around an open window closes it and still reaches the game
// as a tap (windowease.js; a press on the joystick there starts walking).
ui.onWorldTap = (cx, cy) => {
  const r = canvas.getBoundingClientRect();
  handsOn(game); game.onLeftClick(cx - r.left, cy - r.top);
};
input.onKey((e) => {
  // On the title screen the keys belong to it: Enter goes in (as does Space or
  // Enter on its focused button), and nothing reaches the game behind it.
  if (title.active) {
    if (!e.defaultPrevented && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.key === 'Enter' && !e.target?.closest?.('button, a, input, select, textarea')) hideSplash();
    return;
  }
  handleGameShortcut(e, game, ui);
});

// Resize handling with device-pixel-ratio scaling for crisp rendering.
// Drawing cost grows with the canvas's pixel count, so it is kept within a
// budget: big or very sharp screens draw at a slightly lower resolution (the
// browser scales it up). `autoScale` drops further if frames keep running slow.
const PIXEL_BUDGET = 2.4e6;
let autoScale = 1;
let sceneNeedsRedraw = true;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  // Cap the backing-store density at 2x: 3x phone screens look the same at 2x
  // but would cost more than twice the fill-rate per frame.
  const budget = Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h));
  const dpr = Math.max(0.6, Math.min(game.lowFx ? 1 : 2, window.devicePixelRatio || 1, budget) * autoScale);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  sceneNeedsRedraw = true;
  // Zoom the world in so it never looks far away: at most VIEW_TILES tiles across
  // the shorter side and VIEW_TILES_LONG along the longer one.
  const zoom = Math.max(1, Math.min(2.2, Math.max(Math.min(w, h) / (VIEW_TILES * TILE), Math.max(w, h) / (VIEW_TILES_LONG * TILE))));
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
  game.camera.resize(w, h, zoom, dpr);
}
window.addEventListener('resize', resize);
resize();

// Main loop.
let last = now(), slowAvg = 16, lastScaleDown = 0, slowTrimUntil = 0, playFrom = -1;
const governor = new FxGovernor();
function frame() {
  const t = now();
  let dt = t - last;
  last = t;
  if (dt > 250) dt = 250; // avoid huge catch-up after a tab switch
  // Only frames of play count toward the trim and the resolution, and not the
  // first few seconds of it (governor.js judgeFrames): the title's loading and
  // the first area being made ready run slow on any phone, and a phone judged
  // by them started play at a lower resolution it didn't need.
  if (title.active) playFrom = -1; else if (playFrom < 0) playFrom = t;
  const judge = judgeFrames(playFrom >= 0, t - playFrom);
  // Frames averaging slower than ~30fps for a couple of seconds, with the
  // extras already trimmed: draw at a lower resolution (a step at a time,
  // down to 60%; a reload starts afresh).
  if (dt < 250 && judge) {
    slowAvg = slowAvg * 0.97 + dt * 0.03;
    if (shouldScaleDown(slowAvg, game.fxTrim) && autoScale > 0.6 && t - lastScaleDown > 2500) {
      autoScale = Math.max(0.6, autoScale - 0.15); lastScaleDown = t; slowAvg = 20; resize();
    }
  }
  // One bad frame must not stop the loop: the game (and its autosave) would
  // freeze for good. Log the first error and carry on with the next frame.
  try {
    // Settings > Show performance times the update and the drawing (perfhud.js);
    // off, perfHud is null and no clock is read.
    const ph = perfHud, p0 = ph ? now() : 0;
    game.update(dt);
    const p1 = ph ? now() : 0;
    if (!title.active) game.playMs = (game.playMs || 0) + dt;   // time played (saved; shown when choosing a cloud save)
    const loadingTitle = title.active && !title.ready;
    title.frame(dt);   // on the title: tours the camera, runs the loading bar
    const p2 = ph ? now() : 0;
    // Keep the opening view cached for the fade, including the last loading
    // frame and any resize that cleared the canvas behind the title.
    if (sceneNeedsRedraw || loadingTitle || !title.worldHidden) {
      renderer.render(t);
      sceneNeedsRedraw = false;
    }
    const p3 = ph ? now() : 0;
    ui.renderMinimap();
    // Frames whose work keeps running long trim the decorative extras (governor.js).
    // So do frames that keep arriving slowly whatever the work (a phone whose
    // painting can't keep up): the extras go before the resolution does.
    // It holds for a while once on (TRIM_OFF_HOLD), so it doesn't flicker.
    if (judge) {
      if (slowFrames(slowAvg)) slowTrimUntil = t + TRIM_OFF_HOLD;
      game.fxTrim = governor.frame(now() - t, t) || t < slowTrimUntil;
    }
    ph?.frame(t, p1 - p0, p3 - p2);   // last, so the readout's own work isn't timed as the frame's
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
  // Hand the camera back and open the class picker when needed.
  title.exit(() => {
    if (game.pendingStyleChoice || game.pendingClassChoice) ui.openStyleChoice();
    else showResumeNotice(ui);
  });
}
splashEnter && splashEnter.addEventListener('click', hideSplash);
splash && splash.addEventListener('click', (e) => { if (e.target === splash) hideSplash(); });

// Expose for debugging in the console.
window.SS = { game, ui, renderer, movepad, title };
