// What a hit looks like in each element: fire throws embers, ice cracks into
// shards, lightning crackles, earth chips, water splashes, and so on. One small
// table, so a new element is one more entry; an element the table doesn't know
// (or none at all) falls back to a soft arcane sparkle rather than nothing.
//
// Each entry is a colour (the enchanted glow behind the hit) and a list of
// pieces. A piece names one of the effect pool's shapes (combatfx.js
// CombatFx.burstOf) and how many fly, how fast, for how long, in what colour.
// `ring` adds an expanding ring; `sq` < 1 flattens it onto the ground. `art`
// names a painted hit sticker (assets/fx/) that pops over the hit once it has
// loaded, with fewer of the drawn pieces round it. This module imports
// nothing, so the pool and the hit hooks can both use it.

export const ELEMENT_FX = {
  fire: { col: '#ff8a3d', pieces: [   // embers that float up and wink out
    { kind: 'dot', n: 9, speed: 0.08, life: 520, col: '#ffae3a', g: -0.00012, up: -0.03, add: true, size: 1.8 },
    { kind: 'dot', n: 4, speed: 0.05, life: 380, col: '#fff0a0', g: -0.0002, up: -0.04, add: true, size: 1.2 },
    { ring: true, r0: 4, r1: 18, life: 240, col: '#ffcf6a', w: 3 },
  ] },
  water: { col: '#6fc3ff', pieces: [  // droplets thrown up that fall back, and a flat splash ring
    { kind: 'dot', n: 9, speed: 0.11, life: 520, col: '#9fdcff', g: 0.0007, up: -0.12, size: 1.9 },
    { ring: true, r0: 4, r1: 22, life: 320, col: '#bfe8ff', w: 2.5, sq: 0.45, dy: 8 },
  ] },
  ice: { col: '#a8e6ff', art: 'fx-hit-ice', pieces: [    // shards cracking off, a frosty ring and a glint
    { kind: 'chip', n: 7, speed: 0.14, life: 560, col: '#bfeaff', g: 0.0006, up: -0.1, spin: 0.04, size: 3.4 },
    { kind: 'twinkle', n: 3, speed: 0.05, life: 420, col: '#ffffff', size: 3 },
    { ring: true, r0: 3, r1: 19, life: 280, col: '#7fd0ff', w: 3 },
  ] },
  lightning: { col: '#fff27a', art: 'fx-hit-lightning', pieces: [   // a crackle of little bolts and bright sparks
    { kind: 'bolt', n: 4, speed: 0, life: 220, col: '#ffd84a', size: 19 },
    { kind: 'spark', n: 6, speed: 0.24, life: 150, col: '#fff27a', add: true, size: 1.4 },
    { ring: true, r0: 2, r1: 16, life: 180, col: '#ffe680', w: 2.5 },
  ] },
  earth: { col: '#a87b4a', pieces: [  // tumbling chips of stone and a puff of dust
    { kind: 'chip', n: 7, speed: 0.12, life: 560, col: '#9a6f40', g: 0.0008, up: -0.12, spin: 0.03, size: 2.6 },
    { kind: 'cloud', n: 3, speed: 0.03, life: 460, col: '#d9c3a0', size: 4, dy: 8 },
  ] },
  wind: { col: '#a8f0c8', pieces: [   // little swirls spinning out
    { kind: 'swirl', n: 3, life: 420, col: '#8fe0b8', col2: '#d8fff0' },
    { kind: 'spark', n: 4, speed: 0.12, life: 220, col: '#e8fff6', add: true, size: 1.3 },
  ] },
  nature: { col: '#7fd36a', art: 'fx-hit-nature', pieces: [ // leaves twirling away
    { kind: 'chip', n: 6, speed: 0.1, life: 640, col: '#6cc35a', g: 0.0003, up: -0.08, spin: 0.05, size: 2.2 },
    { kind: 'twinkle', n: 2, speed: 0.04, life: 400, col: '#e6ffd0', size: 2.4 },
  ] },
  poison: { col: '#9be05a', art: 'fx-hit-poison', pieces: [ // bubbles that rise and pop
    { kind: 'dot', n: 7, speed: 0.04, life: 620, col: '#a8e66a', g: -0.00015, up: -0.03, size: 2.4 },
    { ring: true, r0: 3, r1: 14, life: 300, col: '#c6f08a', w: 2 },
  ] },
  holy: { col: '#fff0a8', art: 'fx-hit-holy', pieces: [   // a burst of light and glints
    { kind: 'ray', n: 6, life: 360, col: '#fff6c8', size: 26 },
    { kind: 'twinkle', n: 4, speed: 0.06, life: 460, col: '#fffbe0', size: 3 },
  ] },
  shadow: { col: '#9a6cd6', art: 'fx-hit-shadow', pieces: [ // dark wisps curling round
    { kind: 'swirl', n: 2, life: 460, col: '#7a4fb8', col2: '#c7a8f0' },
    { kind: 'cloud', n: 3, speed: 0.03, life: 480, col: '#b49ad8', size: 3.5 },
  ] },
  chaos: { col: '#d070ff', pieces: [ // a wild spray of sparks and a lopsided ring
    { kind: 'spark', n: 8, speed: 0.2, life: 260, col: '#f0a0ff', add: true, size: 1.6 },
    { kind: 'swirl', n: 2, life: 420, col: '#b050e0', col2: '#ffd0ff' },
    { ring: true, r0: 3, r1: 20, life: 260, col: '#e070ff', w: 2.5 },
  ] },
  blood: { col: '#e0304a', pieces: [ // red droplets flung out that fall back
    { kind: 'dot', n: 8, speed: 0.1, life: 520, col: '#d0243e', g: 0.0007, up: -0.1, size: 1.9 },
    { ring: true, r0: 3, r1: 16, life: 280, col: '#ff6a7a', w: 2 },
  ] },
  // The Priest's Light path and the Zealot's Flame path (magic.js): their
  // bolts have their own shapes too (render/classfx.js).
  radiance: { col: '#fff3b0', art: 'fx-hit-holy', pieces: [   // white-gold rays bursting where the beam lands
    { kind: 'ray', n: 8, life: 380, col: '#fff6c8', size: 28 },
    { kind: 'spark', n: 5, speed: 0.16, life: 240, col: '#ffffff', add: true, size: 1.4 },
  ] },
  grace: { col: '#ffd98a', pieces: [   // soft motes drifting down like feathers, and chime-like glints
    { kind: 'chip', n: 5, speed: 0.06, life: 760, col: '#fff6dc', g: 0.00012, up: -0.06, spin: 0.03, size: 2.6 },
    { kind: 'twinkle', n: 4, speed: 0.05, life: 520, col: '#fffbe0', size: 2.8 },
    { ring: true, r0: 3, r1: 15, life: 360, col: '#ffe6a0', w: 1.8 },
  ] },
  judgement: { col: '#d8e8ff', pieces: [   // the blade's flash and a ring of light on the ground
    { kind: 'spark', n: 7, speed: 0.2, life: 240, col: '#eef4ff', add: true, size: 1.5 },
    { kind: 'twinkle', n: 2, speed: 0.03, life: 380, col: '#ffffff', size: 3.2 },
    { ring: true, r0: 4, r1: 24, life: 340, col: '#cfe0ff', w: 2.6, sq: 0.4, dy: 9 },
  ] },
  sanctuary: { col: '#f6e7a8', pieces: [   // motes rising off a glowing circle
    { kind: 'dot', n: 8, speed: 0.03, life: 700, col: '#fff3c0', g: -0.00016, up: -0.04, add: true, size: 1.8 },
    { ring: true, r0: 6, r1: 26, life: 420, col: '#f0d880', w: 2.4, sq: 0.4, dy: 9 },
  ] },
  holyfire: { col: '#ffe9a0', pieces: [   // white-gold embers
    { kind: 'dot', n: 8, speed: 0.08, life: 520, col: '#ffe08a', g: -0.00012, up: -0.03, add: true, size: 1.8 },
    { kind: 'dot', n: 4, speed: 0.05, life: 380, col: '#ffffff', g: -0.0002, up: -0.04, add: true, size: 1.2 },
    { ring: true, r0: 4, r1: 17, life: 240, col: '#fff0b0', w: 2.6 },
  ] },
  wrath: { col: '#ff6a4a', pieces: [   // a red-gold shockwave
    { ring: true, r0: 4, r1: 24, life: 280, col: '#ffb060', w: 3.2 },
    { ring: true, r0: 2, r1: 15, life: 220, col: '#ff5a3a', w: 2.2 },
    { kind: 'spark', n: 6, speed: 0.22, life: 200, col: '#ffd08a', add: true, size: 1.5 },
  ] },
  ash: { col: '#c8a080', pieces: [   // grey ash puffing out, orange cinders winking
    { kind: 'cloud', n: 3, speed: 0.035, life: 520, col: '#b8aca6', size: 4 },
    { kind: 'dot', n: 6, speed: 0.09, life: 480, col: '#ff9a40', g: -0.0001, up: -0.03, add: true, size: 1.5 },
  ] },
  martyrdom: { col: '#e04a5a', pieces: [   // a heavy crimson-gold blow
    { kind: 'dot', n: 8, speed: 0.12, life: 460, col: '#d8304a', g: 0.0006, up: -0.1, size: 2 },
    { kind: 'spark', n: 6, speed: 0.2, life: 240, col: '#ffd27a', add: true, size: 1.6 },
    { ring: true, r0: 4, r1: 22, life: 300, col: '#ffcf70', w: 3 },
  ] },
  // Anything else (a new element nobody has drawn yet, or plain magic).
  arcane: { col: '#c890f0', pieces: [
    { ring: true, r0: 4, r1: 18, life: 260, col: '#c890f0', w: 2.5 },
    { kind: 'twinkle', n: 3, speed: 0.05, life: 420, col: '#f0dcff', size: 2.6 },
  ] },
};

// Other names the game (or the element rework) may use for the same look.
const ALIAS = { frost: 'ice', water_ice: 'ice', thunder: 'lightning', storm: 'lightning', electric: 'lightning', air: 'wind',
  stone: 'earth', rock: 'earth', flame: 'fire', light: 'holy', dark: 'shadow', void: 'shadow', plant: 'nature', toxic: 'poison' };

/** The table entry for an element name, falling back to 'arcane' for an
 *  unknown or missing element (so a hit always gets something). */
export function elementFx(el) {
  const k = typeof el === 'string' ? el.toLowerCase() : '';
  return ELEMENT_FX[k] || ELEMENT_FX[ALIAS[k]] || ELEMENT_FX.arcane;
}

/** Spawn an element's pieces into a CombatFx pool at (x, y). Crits get a
 *  bigger glow. The caller groups and delays them (CombatFx._begin/_end). */
export function spawnElement(fx, el, x, y, crit = false) {
  const e = elementFx(el);
  if (!fx.low) fx.glow(x, y, crit ? 30 : 22, 380, e.col);
  const art = e.art && fx.sticker?.(e.art, x, y, crit ? 34 : 27, 460, { grow: 0.25 });
  for (const p of e.pieces) {
    if (p.ring) fx.ring(x, y + (p.dy || 0), p.r0, p.r1 * (crit ? 1.25 : 1), p.life, p.col, p.w, p.sq || 1);
    else {
      const n = crit ? p.n + 2 : p.n;
      fx.burstOf(p.kind, x, y + (p.dy || 0), art ? Math.ceil(n / 2) : n, p);
    }
  }
}
