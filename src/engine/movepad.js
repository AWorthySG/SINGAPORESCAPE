// Direct movement input: an on-screen joystick (touch and mouse) plus
// W/A/S/D and the arrow keys. Both feed one analogue vector into
// game.setMoveInput(x, y), with x/y in -1..1 (screen axes, +y = down).
const KEY_DIRS = {
  w: [0, -1], arrowup: [0, -1],
  s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
};

/** Joystick maths: a thumb offset (dx, dy) in px from where the touch landed,
 *  and the stick's reach in px, to the knob's offset (clamped to the reach) and
 *  the analogue vector (-1..1 each way). Pure, so it can be tested headlessly. */
export function stickVector(dx, dy, reach) {
  const d = Math.hypot(dx, dy);
  if (!(reach > 0) || d === 0) return { kx: 0, ky: 0, x: 0, y: 0 };
  const s = d > reach ? reach / d : 1;
  const kx = dx * s, ky = dy * s;
  return { kx, ky, x: kx / reach, y: ky / reach };
}

export class MovePad {
  constructor(game, root = document.getElementById('game-root'), canUseKeys = () => true) {
    this.game = game;
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this._buildJoystick(root);
    this._bindKeys(canUseKeys);
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

  _bindKeys(canUseKeys) {
    const typing = (e) => {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!KEY_DIRS[k] || e.defaultPrevented || e.isComposing || typing(e) || e.ctrlKey || e.metaKey || e.altKey || !canUseKeys()) return;
      if (k.startsWith('arrow')) e.preventDefault();   // don't scroll the page
      if (!this.keys.has(k)) { this.keys.add(k); this._push(); }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (this.keys.delete(k)) this._push();
    });
    // Releasing keys (or a thumb) while the page is unfocused or hidden (an
    // iPad notification, Control Centre, the app switcher) would leave them
    // "stuck"; the joystick also recentres its knob.
    const reset = () => { this.keys.clear(); this._resetStick?.(); this.stick = { x: 0, y: 0 }; this._push(); };
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
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

    // A floating stick: the vector is measured from where the thumb lands, not
    // from the base's centre, so a fresh touch always starts still and a thumb
    // landing off-centre doesn't send the player running. The base slides to
    // sit under the thumb, and its touch area reaches past the drawn ring.
    // Moves and lifts are followed on the window, by pointer id, so the stick
    // keeps steering if the thumb slides off it or pointer capture is lost,
    // and a second finger (Attack, a skill, a palm) never takes it over.
    let active = null, origin = null, home = null, reach = 1;
    // A second touch that lands on the stick while it is steering (a thumb
    // rolling or re-planting): it takes over when the old touch lifts.
    let spare = null;
    const update = (e) => {
      const v = stickVector(e.clientX - origin.x, e.clientY - origin.y, reach);
      knob.style.transform = `translate(calc(-50% + ${v.kx}px), calc(-50% + ${v.ky}px))`;
      this.stick = { x: v.x, y: v.y };
      this._push();
    };
    const end = () => {
      spare = null;
      if (active === null) return;
      active = null; origin = null; home = null;
      base.classList.remove('active');
      base.style.transform = '';
      knob.style.transform = 'translate(-50%, -50%)';
      this.stick = { x: 0, y: 0 };
      this._push();
    };
    this._resetStick = end;
    const place = ({ id, x, y }) => {
      home ||= base.getBoundingClientRect();
      // Reuse the resting bounds on handoff: the current ring is already
      // translated and may be a long way from the new thumb.
      const { left, right, top, bottom, width, height } = home;
      reach = Math.max(24, width / 2 - 8);
      active = id;
      origin = { x, y };
      const tx = Math.min(window.innerWidth - 4 - right, Math.max(4 - left, x - left - width / 2));
      const ty = Math.min(window.innerHeight - 4 - bottom, Math.max(4 - top, y - top - height / 2));
      base.style.transform = `translate(${tx}px, ${ty}px)`;
      try { base.setPointerCapture(id); } catch { /* the window still follows the pointer */ }
      base.classList.add('active');
      update({ clientX: x, clientY: y });
    };
    base.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const point = { id: e.pointerId, x: e.clientX, y: e.clientY };
      if (active !== null && !e.isPrimary) {
        if (spare === null && e.pointerType === 'touch') spare = point;
        return;
      }
      // A new primary press also recovers from a lift the browser never sent.
      spare = null;
      place(point);
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId === active) update(e);
      else if (spare && e.pointerId === spare.id) { spare.x = e.clientX; spare.y = e.clientY; }
    });
    // A normal lift can hand off to a thumb already on the stick. Cancel
    // stops the gesture outright, for example when the OS takes the touch.
    window.addEventListener('pointerup', (e) => {
      if (e.pointerId === active && spare) {
        const next = spare;
        spare = null;
        place(next);
      } else if (e.pointerId === active) end();
      else if (e.pointerId === spare?.id) spare = null;
    });
    window.addEventListener('pointercancel', (e) => {
      if (e.pointerId === active) end();
      else if (e.pointerId === spare?.id) spare = null;
    });
  }
}
