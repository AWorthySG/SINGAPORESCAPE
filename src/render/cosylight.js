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
  '255,206,120', '255,236,170', '255,220,150', '255,210,160']);
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
    this._grades = [null, null];
    this._sprites = new Map();
    this.blooms = 0;   // blooms drawn last frame (for tests and tuning)
  }

  _canvas(w, h) {
    try {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      return cv.getContext('2d') ? cv : null;
    } catch { return null; }
  }

  // Bake one diagonal grade for each side of the sky. The light's strength
  // is applied at draw time, so the colours can fade throughout the evening.
  _gradePic(gr) {
    const key = gr.fromLeft ? 1 : 0;
    if (this._grades[key]) return this._grades[key];
    const cv = this._canvas(GRADE_W, GRADE_H);
    if (!cv) return null;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, GRADE_W, GRADE_H);
    const x0 = gr.fromLeft ? 0 : GRADE_W, x1 = GRADE_W - x0;
    const lin = g.createLinearGradient(x0, GRADE_H * 0.11, x1, GRADE_H * 0.9);
    const c = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    lin.addColorStop(0, c(gr.sun, 1));
    lin.addColorStop(0.55, c([(gr.sun[0] + gr.far[0]) >> 1, (gr.sun[1] + gr.far[1]) >> 1, (gr.sun[2] + gr.far[2]) >> 1], 1));
    lin.addColorStop(1, c(gr.far, 1));
    g.fillStyle = lin; g.fillRect(0, 0, GRADE_W, GRADE_H);
    const height = g.createLinearGradient(0, 0, 0, GRADE_H);
    height.addColorStop(0, 'rgba(255,220,175,0.24)');
    height.addColorStop(0.55, 'rgba(255,220,175,0)');
    height.addColorStop(1, 'rgba(153,102,149,0.22)');
    g.fillStyle = height; g.fillRect(0, 0, GRADE_W, GRADE_H);
    return (this._grades[key] = cv);
  }

  _sunPic() {
    if (this._sun !== undefined) return this._sun;
    const cv = this._canvas(64, 64);
    if (cv) {
      const g = cv.getContext('2d');
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,231,166,0.96)');
      r.addColorStop(0.36, 'rgba(255,180,103,0.46)');
      r.addColorStop(0.73, 'rgba(255,159,95,0.13)');
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
  draw(ctx, game, lights, night, ox, oy, vw, vh, t, pj = null, wx = null, look = null) {
    this.blooms = 0;
    if (!this.ok) return false;
    const fvw = vw, fvh = vh;   // the depth view's flat rectangle (pj), for finding the lamps
    if (pj) { vw = pj.vw; vh = pj.vh; }
    const gr = cosyGrade(game.dayPhase ? game.dayPhase() : 0.5, this._grade);
    const gloom = wx?.gloom || 0;
    // The rich amber sunlight suits the warm districts. Where the evening is
    // blue or violet, let the light pass's own colours show through it.
    const warmth = look ? Math.max(0, Math.min(1, (look.dusk[0] - look.dusk[2]) / 170)) : 1;
    const a = wx?.roofed ? 0 : gr.a * (0.32 + 0.68 * warmth) * (1 - (look?.cover || 0)) * (1 - gloom * 0.78);
    ctx.save();
    if (a > 0.002) {
      const pic = this._gradePic(gr);
      if (pic) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = a;
        ctx.drawImage(pic, 0, 0, vw, vh);
        // The low sun's glow from its side of the screen.
        const sun = this._sunPic();
        if (sun) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.48;
          const r = Math.max(vw, vh) * 0.78, ry = r * 0.69;
          const sx = gr.fromLeft ? -r * 0.16 : vw + r * 0.16;
          ctx.drawImage(sun, sx - r, vh * 0.23 - ry, r * 2, ry * 2);
        }
      }
    }
    const bk = bloomStrength(Math.max((look?.shade || 0) * 2.5, night + (1 - night) * gloom * 0.88));
    const scatter = Math.min(1, (wx?.mist || 0) * 0.74 + (wx?.rain || 0) * 0.38);
    if (bk > 0.02 && lights && lights.gather) {
      const list = lights._lights && lights.count ? lights._lights : lights.gather(game, ox, oy, fvw, fvh, t, pj);
      ctx.globalCompositeOperation = 'lighter';
      for (const L of list) {
        if (this.blooms >= MAX_BLOOMS) break;
        if (!L.bloom && !WARM.has(L.rgb.join(','))) continue;
        const pic = this._bloomPic(L.rgb);
        if (!pic) break;
        const r = L.r * (0.42 + scatter * 0.14) * L.k, ry = r * (1 + 0.23 * scatter);
        ctx.globalAlpha = Math.min(1, (0.5 + scatter * 0.14) * bk * L.k);
        ctx.drawImage(pic, L.x - r, L.y - ry, r * 2, ry * 2);
        this.blooms++;
      }
    }
    ctx.restore();
    return true;
  }
}
