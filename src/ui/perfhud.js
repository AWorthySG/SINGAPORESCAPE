// Settings > Show performance: a small readout at the edge of the screen, so a
// player can screenshot what is slow on their own phone (Safari on an iPhone
// has no profiler to hand). It shows, over the last few seconds: frames per
// second and the median and worst-5% time between frames; how much of a frame
// the game's update, the drawing and the rest of the game's script take, and
// the slowest update and drawing (what is left of the frame goes on the
// browser's own painting, or waiting); the
// canvas's resolution and how far it was scaled down; whether the slow-frame
// trim and low graphics are on; how many creatures are drawn and how many
// monsters are alive nearby; the bag's size; and the chat's lines per second.
//
// main.js only loads this module once the setting is on, then calls frame()
// once a frame. Off, it costs nothing; on, a few clock reads a frame, and the
// words change at most twice a second. It only reads the game, never changes it.
import { TILE } from '../config.js';
import { now } from '../core/utils.js';

export const WINDOW_MS = 5000;   // the figures cover the last five seconds
export const REFRESH_MS = 500;   // ...and the words change at most twice a second
const PAUSE_MS = 2000;           // a gap this long is a hidden tab, not a slow frame
const CAP = 1024;                // frames kept: five seconds even at 120fps

/** The q-th quantile (0..1) of an ascending list, by nearest rank: 0.5 is the
 *  median, 0.95 the time only the slowest 5% of frames go over. */
export function quantile(sorted, q) {
  const n = sorted.length;
  if (!n) return 0;
  return sorted[Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1))];
}

/** Figures for a run of frames: `gaps` is the time between frames (ms), and
 *  for each frame `upd`, `ren` and `work` the ms in the game's update, in the
 *  renderer, and in all of the frame's script (those two, the minimap and the
 *  rest). The slowest update and drawing say which of them made the slow
 *  frames (a game tick's kills and loot, say). Null for no frames. */
export function frameFigures(gaps, upd, ren, work) {
  const n = gaps.length;
  if (!n) return null;
  let total = 0, u = 0, r = 0, w = 0, uMax = 0, rMax = 0;
  for (let i = 0; i < n; i++) {
    total += gaps[i]; u += upd[i]; r += ren[i]; w += work[i];
    if (upd[i] > uMax) uMax = upd[i];
    if (ren[i] > rMax) rMax = ren[i];
  }
  const sorted = Float64Array.from(gaps).sort();
  return {
    frames: n, fps: total > 0 ? n * 1000 / total : 0, frameMs: total / n,
    p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95), upd: u / n, ren: r / n, work: w / n, updMax: uMax, renMax: rMax,
  };
}

/** How many creatures are drawn (alive or keeling over, and in the camera's
 *  view, with the renderer's room for big ones) and how many monsters are
 *  alive, among `npcs` (the ones near the player). */
export function creatureCounts(npcs, cam) {
  let drawn = 0, alive = 0;
  const ox = cam.originX, oy = cam.originY, vw = cam.viewW, vh = cam.viewH;
  for (const n of npcs) {
    if (n.attackable && !n.ally) alive++;
    if (!n.alive && !(n.deathT > 0)) continue;
    const pad = 48 * (n.def?.scale || 1);
    const cx = n.x * TILE + TILE / 2 - ox, cy = n.y * TILE + TILE / 2 - oy;
    if (cx >= -pad && cy >= -pad && cx <= vw + pad && cy <= vh + pad) drawn++;
  }
  return { drawn, alive };
}

/** Filled slots in the bag, and its size (it grows as it fills). */
export function bagCounts(inv) {
  const slots = inv?.slots || [];
  let used = 0;
  for (const s of slots) if (s) used++;
  return { used, size: slots.length };
}

/** Lines a second from [lines, ms] pairs, one pair per refresh. */
export function perSecond(hist) {
  let n = 0, ms = 0;
  for (const [k, d] of hist) { n += k; ms += d; }
  return ms > 0 ? n * 1000 / ms : 0;
}

const ms = (x) => (x >= 100 ? String(Math.round(x)) : x.toFixed(1));

/** The readout's lines, from PerfHud.figures(). */
export function perfText(f) {
  const lines = [];
  if (f.frames) {
    lines.push(`${f.fps.toFixed(1)} fps · frame p50 ${ms(f.p50)} · p95 ${ms(f.p95)}`);
    lines.push(`script ${f.work.toFixed(1)} of ${ms(f.frameMs)} ms a frame`);
    lines.push(`upd ${f.upd.toFixed(1)} · draw ${f.ren.toFixed(1)} · rest ${Math.max(0, f.work - f.upd - f.ren).toFixed(1)}`);
    lines.push(`slowest upd ${ms(f.updMax)} · draw ${ms(f.renMax)}`);
  } else lines.push('measuring…');
  lines.push(`canvas ${f.canvasW}×${f.canvasH} · ${f.dpr.toFixed(2)} of ${+f.deviceDpr.toFixed(2)}x`);
  lines.push(`res ${Math.round(f.autoScale * 100)}% · trim ${f.trim ? 'on' : 'off'} · low gfx ${f.low ? 'on' : 'off'}`);
  lines.push(`mobs ${f.drawn} drawn · ${f.alive} alive near`);
  lines.push(`bag ${f.bagUsed}/${f.bagSize} · chat ${f.chat.toFixed(1)} lines/s`);
  return lines.join('\n');
}

export class PerfHud {
  /** `scale()` gives main.js's resolution step for slow frames (autoScale).
   *  Without a page (the tests) it keeps its words in `text` alone. */
  constructor(game, canvas, scale = () => 1) {
    this.game = game;
    this.canvas = canvas;
    this.scale = scale;
    // The last CAP frames, a ring: when each was, its gap, and its timings.
    this.at = new Float64Array(CAP); this.gap = new Float64Array(CAP);
    this.upd = new Float64Array(CAP); this.ren = new Float64Array(CAP); this.work = new Float64Array(CAP);
    this.count = 0; this.head = 0; this.lastT = 0;
    // Room to copy the last five seconds out in order at each refresh.
    this._win = [new Float64Array(CAP), new Float64Array(CAP), new Float64Array(CAP), new Float64Array(CAP)];
    this.shownAt = -1;
    // Chat lines the game sends (game.msg), counted between refreshes.
    this.chatLines = 0;
    this.chatHist = [];
    this._unchat = game.bus?.on('chat', () => { this.chatLines++; });
    this.text = 'measuring…';
    this.el = this.node = null;
    if (typeof document !== 'undefined') {
      const el = this.el = document.createElement('div');
      el.className = 'perf-hud';
      el.setAttribute('aria-hidden', 'true');
      this.node = el.appendChild(document.createTextNode(this.text));
      (document.getElementById('game-root') || document.body).appendChild(el);
    }
  }

  /** One frame that started at `t` (main.js's clock) and spent `upd` ms in
   *  game.update() and `ren` in renderer.render(); `work` is all of its
   *  script, read here, as the last thing the frame does. */
  frame(t, upd, ren, work = now() - t) {
    const gap = this.lastT ? t - this.lastT : 0;
    this.lastT = t;
    if (gap > 0 && gap < PAUSE_MS) {
      const i = this.head;
      this.at[i] = t; this.gap[i] = gap; this.upd[i] = upd; this.ren[i] = ren; this.work[i] = work;
      this.head = (i + 1) % CAP;
      if (this.count < CAP) this.count++;
    }
    // Back from a hidden tab: the chat's lines a second shouldn't count the time away.
    if (this.shownAt < 0 || gap >= PAUSE_MS) this.shownAt = t;
    else if (t - this.shownAt >= REFRESH_MS) this.refresh(t);
  }

  /** Work the figures out and change the words. */
  refresh(t) {
    this.chatHist.push([this.chatLines, t - this.shownAt]);
    if (this.chatHist.length > WINDOW_MS / REFRESH_MS) this.chatHist.shift();
    this.chatLines = 0;
    this.shownAt = t;
    this.text = perfText(this.figures(t));
    if (this.node) this.node.data = this.text;
  }

  /** Everything the readout shows, as of `t`. */
  figures(t) {
    const [g, u, r, w] = this._win;
    let n = 0;
    for (let k = 0, i = this.head; k < this.count; k++) {
      i = (i + CAP - 1) % CAP;
      if (this.at[i] < t - WINDOW_MS) break;
      g[n] = this.gap[i]; u[n] = this.upd[i]; r[n] = this.ren[i]; w[n] = this.work[i]; n++;
    }
    const game = this.game, cam = game.camera, c = this.canvas;
    // The renderer has just asked for the same nearby list this frame, so this only reads it.
    const counts = creatureCounts(game.nearbyNpcs?.() || [], cam);
    const bag = bagCounts(game.inventory);
    return {
      ...(frameFigures(g.subarray(0, n), u.subarray(0, n), r.subarray(0, n), w.subarray(0, n)) || { frames: 0 }),
      canvasW: c?.width || 0, canvasH: c?.height || 0, dpr: cam?.dpr || 1,
      deviceDpr: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, autoScale: this.scale(),
      trim: !!game.fxTrim, low: !!game.lowFx, drawn: counts.drawn, alive: counts.alive,
      bagUsed: bag.used, bagSize: bag.size, chat: perSecond(this.chatHist),
    };
  }

  /** Take the readout off the screen and stop counting. */
  remove() {
    this._unchat?.();
    this._unchat = null;
    this.el?.remove();
    this.el = this.node = null;
  }
}
