// Mouse / touch / keyboard input. Reports screen-space coordinates; the game
// translates those into world/UI interactions.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mx = 0;
    this.my = 0;
    this.inside = false;
    this.handlers = { left: null, right: null, move: null, key: null };
    this._touchAt = -1e9;

    canvas.addEventListener('mousemove', (e) => {
      this._setMouse(e);
      this.handlers.move?.(this.mx, this.my);
    });
    canvas.addEventListener('mouseenter', () => { this.inside = true; });
    canvas.addEventListener('mouseleave', () => { this.inside = false; });

    canvas.addEventListener('mousedown', (e) => {
      // A tap already ran the left handler on touchstart; skip the mousedown
      // the browser makes up from it, so each tap acts once.
      if (e.timeStamp - this._touchAt < 800) return;
      this._setMouse(e);
      if (e.button === 0) this.handlers.left?.(this.mx, this.my, e);
      else if (e.button === 2) this.handlers.right?.(this.mx, this.my, e);
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._setMouse(e);
      this.handlers.right?.(this.mx, this.my, e);
    });

    // Basic touch support: tap = left click.
    canvas.addEventListener('touchstart', (e) => {
      if (!e.touches.length) return;
      this._touchAt = e.timeStamp;
      this._setMouse(e.touches[0]);
      this.handlers.left?.(this.mx, this.my, e);
    }, { passive: true });

    window.addEventListener('keydown', (e) => this.handlers.key?.(e));
  }

  _setMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mx = e.clientX - r.left;
    this.my = e.clientY - r.top;
  }

  onLeftClick(fn) { this.handlers.left = fn; }
  onRightClick(fn) { this.handlers.right = fn; }
  onMove(fn) { this.handlers.move = fn; }
  onKey(fn) { this.handlers.key = fn; }
}

// Controls you tap fast and often. A quick second tap on them must never zoom.
const PLAY_SURFACE = '#game-canvas, #joystick, #attack-btn, #interact-btn, .ability-btn';

/** iPad / iPhone Safari ignores user-scalable=no, so a quick double tap or a
 *  two-finger press can zoom the whole game mid-fight. The CSS touch-action
 *  rules do most of the work; this is the belt and braces for WebKit: no pinch
 *  gestures, no double-click zoom, and a quick second tap on the play surface
 *  is swallowed (those controls act on pointerdown, so nothing is lost; buttons
 *  that act on click are left alone so a quick second tap still clicks). */
export function guardTouchZoom(doc = globalThis.document) {
  if (!doc?.addEventListener) return;
  const stop = (e) => { if (e.cancelable) e.preventDefault(); };
  const active = { passive: false };
  doc.addEventListener('gesturestart', stop, active);
  doc.addEventListener('gesturechange', stop, active);
  doc.addEventListener('dblclick', stop, active);
  // Safari reports a pinch's scale on touchmove; one-finger scrolls are untouched.
  doc.addEventListener('touchmove', (e) => {
    if (e.touches?.length > 1 && typeof e.scale === 'number' && e.scale !== 1) stop(e);
  }, active);
  let lastEnd = -1e9;
  doc.addEventListener('touchend', (e) => {
    const quick = e.timeStamp - lastEnd < 300;
    lastEnd = e.timeStamp;
    if (quick && e.target?.closest?.(PLAY_SURFACE)) stop(e);
  }, active);
}

/** A tap only becomes a 'click' when it is the only touch on screen, so with a
 *  thumb on the joystick (or Attack held) a second finger tapping a panel tab,
 *  a bag slot or the special orb did nothing. Quick, still second-finger taps
 *  are turned into clicks here. The play-surface controls act on pointer
 *  events already; a long press is left to the touch card, and a real click
 *  the browser might still send for the same tap is dropped. */
export function clickSecondFingerTaps(doc = globalThis.document) {
  if (!doc?.addEventListener) return;
  const downs = new Map();
  let made = null;
  doc.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.isPrimary) return;
    downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, el: e.target });
  }, true);
  doc.addEventListener('pointercancel', (e) => downs.delete(e.pointerId), true);
  doc.addEventListener('pointerup', (e) => {
    const d = downs.get(e.pointerId);
    if (!d) return;
    downs.delete(e.pointerId);
    const el = d.el;
    if (!el?.isConnected || typeof el.click !== 'function' || el.closest?.(PLAY_SURFACE)) return;
    if (e.timeStamp - d.t > 400 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    made = { el, t: e.timeStamp };
    el.click();
  }, true);
  doc.addEventListener('click', (e) => {
    if (e.isTrusted && made && e.target === made.el && e.timeStamp - made.t < 500) {
      e.stopImmediatePropagation(); e.preventDefault();
    }
    if (e.isTrusted) made = null;
  }, true);
}
