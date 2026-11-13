// Mouse / touch / keyboard input. Reports screen-space coordinates; the game
// translates those into world/UI interactions.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mx = 0;
    this.my = 0;
    this.inside = false;
    this.handlers = { left: null, right: null, move: null, key: null };

    canvas.addEventListener('mousemove', (e) => {
      this._setMouse(e);
      this.handlers.move?.(this.mx, this.my);
    });
    canvas.addEventListener('mouseenter', () => { this.inside = true; });
    canvas.addEventListener('mouseleave', () => { this.inside = false; });

    canvas.addEventListener('mousedown', (e) => {
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
