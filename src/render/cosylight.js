// Cosy light: the warm, filmic look of a Singapore evening, painted over the
// light pass (lighting.js) in two cheap layers.
//
// - Golden hour: around dawn and dusk the scene gets a soft-light colour grade,
//   honey gold where the low sun comes from and dusky rose on the far side, and
//   a faint glow of sun from that edge. It is one small gradient canvas, baked
//   when the colours change and stretched over the screen.
// - Glow: after dark, fires, lamps, stall lanterns and lit windows get a soft
//   additive bloom on top of their pools of light, so a hawker street at night
//   looks lit by lanterns rather than just less dark. Only lights already in
//   view are drawn (the light pass gathers them), from one baked sprite per
//   colour.
//
// Low graphics and headless runs skip the whole thing (draw returns false).

// The light pass's warm, homely lights get the bloom; magic and boss glows keep
// their own look.
const WARM = new Set(['255,214,140', '255,150,70', '255,128,60', '255,166,90', '255,200,120', '255,206,140', '255,222,160',
  '255,206,120', '255,236,170', '255,220,150', '255,210,160',
  // ...and the neon lamps of Marina Bay and Chinatown (lighting.js NEON).
  '255,120,200', '110,220,255', '255,140,210', '120,230,255']);
export const MAX_BLOOMS = 24;
const GRADE_W = 64, GRADE_H = 40;   // the grade canvas (all smooth gradient, so tiny is fine)

const bump = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };

/**
 * How golden the light is at `phase` (0 midnight, 0.25 dawn, 0.5 noon, 0.75
 * dusk): 0 through the middle of the day and the night, up to 1 with the sun
 * on the horizon. Dusk runs a little longer and stronger than dawn.
 */
export function goldenHour(phase) {
  const p = ((phase % 1) + 1) % 1;
  return Math.min(1, 0.75 * bump(p, 0.255, 0.05) + bump(p, 0.735, 0.06));
}

/**
 * The golden-hour grade at `phase`: `sun` and `far` are the colours at the
 * sunny edge and the opposite one ([r, g, b]), `a` how strongly it is laid on
 * (soft light), and `fromLeft` whether the sun sits to the west (dusk) or the
 * east (dawn). `a` is 0 when there is no golden hour.
 */
export function cosyGrade(phase, out = { sun: [0, 0, 0], far: [0, 0, 0], a: 0, fromLeft: true }) {
  const p = ((phase % 1) + 1) % 1;
  const k = goldenHour(p);
  const dusk = p > 0.5;
  out.fromLeft = dusk;
  // Dawn is a paler rosy gold; dusk a deep honey amber going to plum.
  const s = dusk ? [255, 176, 84] : [255, 196, 140];
  const f = dusk ? [196, 110, 150] : [210, 150, 190];
  for (let i = 0; i < 3; i++) { out.sun[i] = s[i]; out.far[i] = f[i]; }
  out.a = 0.62 * k;
  return out;
}

/** How strongly lanterns bloom: none by day, coming on at dusk, full at night. */
export function bloomStrength(night) {
  const k = Math.max(0, Math.min(1, (night - 0.38) / 0.45));
  return k * k * (3 - 2 * k);
}

export class CosyLight {
  constructor() {
    this.ok = typeof document !== 'undefined' && !!document.createElement;
    this._grade = cosyGrade(0.5);
    this._gradeCv = null; this._gradeKey = '';
    this._sprites = new Map();
    this.blooms = 0;   // blooms drawn last frame (for tests and tuning)
  }

  _canvas(w, h) {
    try {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      return cv.getContext('2d') ? cv : null;
    } catch { return null; }
  }

  // The grade picture: a sideways gradient from the sun's colour to the far
  // colour, with the sun's own glow low on its edge. Re-baked only when the
  // colours move enough to see (a few times over a dusk).
  _gradePic(gr) {
    const key = `${gr.fromLeft ? 'L' : 'R'}${Math.round(gr.a * 40)}`;
    if (this._gradeCv && key === this._gradeKey) return this._gradeCv;
    const cv = this._gradeCv || this._canvas(GRADE_W, GRADE_H);
    if (!cv) return null;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, GRADE_W, GRADE_H);
    const x0 = gr.fromLeft ? 0 : GRADE_W, x1 = GRADE_W - x0;
    const lin = g.createLinearGradient(x0, 0, x1, GRADE_H * 0.6);
    const c = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    lin.addColorStop(0, c(gr.sun, 1));
    lin.addColorStop(0.55, c([(gr.sun[0] + gr.far[0]) >> 1, (gr.sun[1] + gr.far[1]) >> 1, (gr.sun[2] + gr.far[2]) >> 1], 1));
    lin.addColorStop(1, c(gr.far, 1));
    g.fillStyle = lin; g.fillRect(0, 0, GRADE_W, GRADE_H);
    this._gradeCv = cv; this._gradeKey = key;
    return cv;
  }

  _sunPic() {
    if (this._sun !== undefined) return this._sun;
    const cv = this._canvas(64, 64);
    if (cv) {
      const g = cv.getContext('2d');
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,214,140,0.9)');
      r.addColorStop(0.4, 'rgba(255,170,90,0.35)');
      r.addColorStop(1, 'rgba(255,150,80,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    }
    return (this._sun = cv);
  }

  _bloomPic(rgb) {
    const key = rgb.join(',');
    let cv = this._sprites.get(key);
    if (cv !== undefined) return cv;
    cv = this._canvas(48, 48);
    if (cv) {
      const g = cv.getContext('2d');
      const r = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      r.addColorStop(0, `rgba(255,246,220,0.95)`);
      r.addColorStop(0.18, `rgba(${key},0.7)`);
      r.addColorStop(0.55, `rgba(${key},0.18)`);
      r.addColorStop(1, `rgba(${key},0)`);
      g.fillStyle = r; g.fillRect(0, 0, 48, 48);
    }
    this._sprites.set(key, cv);
    return cv;
  }

  /**
   * Paint the golden hour and the lantern bloom onto `ctx` (screen space,
   * vw x vh). `lights` is the light pass (for its gathered lights), `night`
   * the renderer's darkness (0 noon .. 1 midnight). False when it can't run.
   */
  draw(ctx, game, lights, night, ox, oy, vw, vh, t, pj = null) {
    this.blooms = 0;
    if (!this.ok) return false;
    const fvw = vw, fvh = vh;   // the depth view's flat rectangle (pj), for finding the lamps
    if (pj) { vw = pj.vw; vh = pj.vh; }
    const gr = cosyGrade(game.dayPhase ? game.dayPhase() : 0.5, this._grade);
    ctx.save();
    if (gr.a > 0.02) {
      const pic = this._gradePic(gr);
      if (pic) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = gr.a;
        ctx.drawImage(pic, 0, 0, vw, vh);
        // The low sun's glow from its side of the screen.
        const sun = this._sunPic();
        if (sun) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = gr.a * 0.45;
          const r = Math.max(vw, vh) * 0.7;
          const sx = gr.fromLeft ? -r * 0.25 : vw + r * 0.25;
          ctx.drawImage(sun, sx - r, vh * 0.12 - r, r * 2, r * 2);
        }
      }
    }
    const bk = bloomStrength(night);
    if (bk > 0.02 && lights && lights.gather) {
      const list = lights._lights && lights.count ? lights._lights : lights.gather(game, ox, oy, fvw, fvh, t, pj);
      ctx.globalCompositeOperation = 'lighter';
      for (const L of list) {
        if (this.blooms >= MAX_BLOOMS) break;
        if (!WARM.has(L.rgb.join(','))) continue;
        const pic = this._bloomPic(L.rgb);
        if (!pic) break;
        const r = L.r * 0.42 * L.k;
        ctx.globalAlpha = Math.min(1, 0.5 * bk * L.k);
        ctx.drawImage(pic, L.x - r, L.y - r, r * 2, r * 2);
        this.blooms++;
      }
    }
    ctx.restore();
    return true;
  }
}
