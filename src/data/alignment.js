// Alignment tiers (good - evil karma) and everything that reads them: the
// title, its colour, the aura drawn round the hero, and what townsfolk say to
// you in passing. Kept here as plain data + pure functions so the game, the
// renderer and the tests all agree on where each tier starts.

// Highest threshold first within each side. `cls` is the css class the Skills
// tab already uses (good / evil / neutral).
export const ALIGN_TIERS = [
  { id: 'paragon', min: 60, title: 'Paragon', cls: 'good', color: '#FFE27A', aura: 'holy', strength: 3 },
  { id: 'virtuous', min: 25, title: 'Virtuous', cls: 'good', color: '#FFD24A', aura: 'holy', strength: 2 },
  { id: 'kind', min: 8, title: 'Kind-hearted', cls: 'good', color: '#F7E3A0', aura: 'holy', strength: 1 },
  { id: 'villain', max: -60, title: 'Villain', cls: 'evil', color: '#FF5A6A', aura: 'dark', strength: 3 },
  { id: 'wicked', max: -25, title: 'Wicked', cls: 'evil', color: '#C08AF5', aura: 'dark', strength: 2 },
  { id: 'mischievous', max: -8, title: 'Mischievous', cls: 'evil', color: '#B9A3E0', aura: 'dark', strength: 1 },
];
const NEUTRAL = { id: 'neutral', title: 'Neutral', cls: 'neutral', color: '#FFFFFF', aura: null, strength: 0 };

/** The tier for an alignment score (good - evil). */
export function alignmentTier(a) {
  for (const t of ALIGN_TIERS) {
    if (t.min != null && a >= t.min) return t;
    if (t.max != null && a <= t.max) return t;
  }
  return NEUTRAL;
}

/** How the hero looks at this alignment: the overhead title ("the Paragon",
 *  none at Neutral), its colour, and the aura (holy gold glow with a halo,
 *  dark purple smoke with red eyes for a Villain, nothing at Neutral). */
export function alignmentStyle(a) {
  const t = alignmentTier(a);
  return {
    tier: t.id, title: t.title, cls: t.cls, color: t.color,
    label: t.aura ? `the ${t.title}` : null,
    aura: t.aura, strength: t.strength,
    halo: t.aura === 'holy' && t.strength >= 2,
    eyes: t.id === 'villain',
  };
}

// What passing townsfolk say, by your tier. The warm lines are for the
// virtuous, the nervous ones for the wicked, and a Villain gets outright fear.
export const GREETINGS = {
  paragon: ['Wah, the hero of the island!', 'Thank you for everything, lah!', 'My kids look up to you!', 'Makan with us lah, hero!'],
  virtuous: ['Eh, good to see you!', 'Heard you helped people. Shiok!', 'You are a good one, ah.', 'Walk safe, friend!'],
  kind: ['Morning!', 'Hello hello!', 'Nice day, right?', 'Have you eaten?'],
  neutral: ['Hot today, eh?', 'Hmm?', 'Busy busy...', 'Ah, a traveller.'],
  mischievous: ['Eh, watch my wallet...', 'Hmm, I know that face.', 'Don\'t try anything, ah.'],
  wicked: ['Aiyoh, it\'s that one...', 'Keep your hands where I can see them.', 'Go away lah, trouble!', 'Kids, come inside!'],
  villain: ['Help! It\'s the Villain!', 'Please... take what you want...', 'Someone call the guards!', 'Run, run!'],
};

/** A greeting for this alignment; `r` in [0,1) picks which one. */
export function greetingFor(a, r = Math.random()) {
  const lines = GREETINGS[alignmentTier(a).id] || GREETINGS.neutral;
  return lines[Math.min(lines.length - 1, Math.floor(r * lines.length))];
}
