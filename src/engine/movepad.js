// Direct movement input: an on-screen joystick (touch and mouse) plus
// W/A/S/D and the arrow keys. Both feed one analogue vector into
// game.setMoveInput(x, y), with x/y in -1..1 (screen axes, +y = down).
const KEY_DIRS = {
  w: [0, -1], arrowup: [0, -1],
  s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
};

export class MovePad {
  constructor(game, root = document.getElementById('game-root')) {
    this.game = game;
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this._buildJoystick(root);
    this._bindKeys();
  }

  _push() {
    let kx = 0, ky = 0;
    for (const k of this.keys) { const d = KEY_DIRS[k]; kx += d[0]; ky += d[1]; }
    const km = Math.hypot(kx, ky);
    if (km > 0) { kx /= km; ky /= km; }
    // Keys win while held; otherwise the joystick's analogue vector.
    if (km > 0) this.game.setMoveInput(kx, ky);
    else this.game.setMoveInput(this.stick.x, this.stick.y);
  }

  _bindKeys() {
    const typing = (e) => {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!KEY_DIRS[k] || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (k.startsWith('arrow')) e.preventDefault();   // don't scroll the page
      if (!this.keys.has(k)) { this.keys.add(k); this._push(); }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (this.keys.delete(k)) this._push();
    });
    // Releasing keys while the window is unfocused would leave them "stuck".
    window.addEventListener('blur', () => { this.keys.clear(); this.stick = { x: 0, y: 0 }; this._push(); });
  }

  _buildJoystick(root) {
    if (!root) return;
    const base = document.createElement('div');
    base.id = 'joystick';
    base.setAttribute('aria-label', 'Movement joystick');
    const knob = document.createElement('div');
    knob.id = 'joystick-knob';
    base.appendChild(knob);
    root.appendChild(base);
    this.el = base;

    let active = null;
    const update = (e) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const max = r.width / 2 - 8;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.stick = { x: dx / max, y: dy / max };
      this._push();
    };
    const end = (e) => {
      if (active === null || (e && e.pointerId !== active)) return;
      active = null;
      base.classList.remove('active');
      knob.style.transform = 'translate(-50%, -50%)';
      this.stick = { x: 0, y: 0 };
      this._push();
    };
    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      active = e.pointerId;
      base.setPointerCapture?.(e.pointerId);
      base.classList.add('active');
      update(e);
    });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === active) update(e); });
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    base.addEventListener('lostpointercapture', end);
  }
}
