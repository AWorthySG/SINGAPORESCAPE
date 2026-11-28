// Effects use this paint on their edges and sparks. The bright centre keeps a
// slash readable over scenery and leaves elemental spell colours recognisable.
const COLOURS = {
  rogue: '#388f91',
  swordsman: '#649cd7',
  corsair: '#4cb7d5',
  paladin: '#eab546',
  knight: '#6678d9',
  berserker: '#c95e4b',
  juggernaut: '#858997',
  gladiator: '#dc915f',
  lancer: '#9cc9f7',
  brawler: '#ee8d7b',
  samurai: '#bc4e76',
  halberdier: '#a97852',
  monk: '#75c29d',
  merchant: '#a2689e',
  archer: '#a4c663',
  ranger: '#4caa72',
  pistoler: '#38b7ad',
  sniper: '#a0a66e',
  ninja: '#8967c8',
  wizard: '#9d96f0',
  sorcerer: '#c084d7',
  priest: '#f1d9ae',
  zealot: '#ee763e',
  dancer: '#e687ba',
};

function paint(colour) {
  const channels = [1, 3, 5].map((i) => Number.parseInt(colour.slice(i, i + 2), 16));
  const light = channels.map((value) => Math.round(value + (255 - value) * 0.55).toString(16).padStart(2, '0')).join('');
  return Object.freeze({ colour, light: `#${light}`, rgb: channels.join(',') });
}

export const CLASS_ACCENTS = Object.freeze(Object.fromEntries(Object.entries(COLOURS).map(([id, colour]) => [id, paint(colour)])));
export const classAccent = (id) => Object.hasOwn(CLASS_ACCENTS, id) ? CLASS_ACCENTS[id] : null;
