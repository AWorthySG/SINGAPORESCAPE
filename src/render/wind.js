// The wind as a field over the map, purely for looks: gust fronts roll across
// the island in the wind's direction, so a gust bends the palms on one side
// of the screen first, then the bushes and flowers in its path, then blows
// the leaves, petals and sand past you, and a lull follows it. Everything that
// moves in the breeze asks this one field, which is what makes the world move
// together rather than every plant rocking on its own beat.
//
// Plain functions of position and time (no state, no Math.random), so the
// same spot at the same moment always looks the same, and the tests can check
// it headless. Cheap: a few sines per call, asked only for things on screen.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// The wind blows east and a little south (the way the leaves already drift).
const DIR = Math.hypot(0.93, 0.37);
export const WIND_DX = 0.93 / DIR, WIND_DY = 0.37 / DIR;
export const GUST_SPEED = 0.14;   // world px per ms: a front crosses the screen in about 8s
export const GUST_LEN = 560;      // world px between gust fronts (a second, longer swell rides on it)
const K1 = (Math.PI * 2) / GUST_LEN, K2 = (Math.PI * 2) / (GUST_LEN * 1.73);

/**
 * How gusty it is at world pixel (x, y) at time t (ms): 0 in a lull .. 1 in
 * the middle of a gust front. The fronts are bent (they meander across their
 * width), so they read as wind over the land rather than ruled lines.
 */
export function gustAt(x, y, t) {
  const along = x * WIND_DX + y * WIND_DY, across = y * WIND_DX - x * WIND_DY;
  const s = along - t * GUST_SPEED + 70 * Math.sin(across * 0.0041 + t * 0.00021);
  const g = 0.5 + 0.32 * Math.sin(s * K1) + 0.18 * Math.sin(s * K2 + 1.9 + across * 0.0017);
  return smooth(0.32, 0.92, g);
}

/** The wind's strength at (x, y): the island's breeze (`wind` 0..1, windAt in
 *  ambient.js) raised in a gust and dropped in a lull. 0 .. about 1.25. */
export function localWind(x, y, t, wind) {
  return wind * (0.35 + 0.9 * gustAt(x, y, t));
}

/**
 * A plant's lean (a shear factor for its picture, about its base) at (x, y):
 * pushed downwind by the local wind and fluttering on its own beat, `freq`
 * (radians per ms) and phase `ph` (from its tile, so neighbours never rock in
 * step). `amp` is how far this kind of plant leans in a full gust. Negative
 * leans the top east, the way the wind blows.
 */
export function plantLean(amp, x, y, t, wind, freq, ph) {
  const w = localWind(x, y, t, wind);
  const flutter = Math.sin(t * freq + ph) * (0.2 + 0.55 * w) + Math.sin(t * freq * 2.3 + ph * 1.7) * 0.12 * w;
  return -amp * WIND_DX * (0.6 * w + 0.5 * flutter);
}
