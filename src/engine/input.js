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
