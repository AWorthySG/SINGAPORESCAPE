import { BOSS_ABILITIES } from '../data/bossAbilities.js';
import { inHazard } from './bossmech.js';

export const PRACTICE_SIZE = 11;
export const PRACTICE_BOSS = { x: 3, y: 5 };
export const PRACTICE_START = { x: 5, y: 5 };
const TIPS = {
  blast: 'Move at least two tiles away from the centre of the marked square.',
  nova: 'Step more than two tiles from the boss before the blast lands.',
  quake: 'Step more than three tiles from the boss before the quake lands.',
  line: 'Step sideways out of the marked lane.',
  cross: 'Move diagonally off the marked row and column.',
  ring: 'Step inside the ring and stay close to the boss.',
  chase: 'Keep moving. The later blasts aim at your new position.',
  twin: 'Move into the gap between the two marked areas or away from both.',
  meteors: 'Move to an unmarked tile and check the nearby impact squares.',
  rain: 'Move off the marked tile and watch for other impacts.',
};

export function bossPracticeTip(pattern, ability) {
  if (TIPS[pattern]) return TIPS[pattern];
  const effects = ability?.fx || [];
  if (effects.some((e) => e.t === 'reflect')) return 'Pause your attacks while damage is reflected.';
  if (effects.some((e) => e.t === 'summon')) return 'Clear the summoned enemies before returning to the boss.';
  if (effects.some((e) => e.t === 'strike')) return 'Save adrenaline for a defensive ability before the strike.';
  if (effects.some((e) => e.t === 'dot')) return 'Top up your life early and leave room to heal through the damage.';
  return 'Give yourself room to move and react when the next warning appears.';
}

export const PRACTICE_RESPONSES = {
  reflect: 'Stop attacking until the reflection fades',
  summon: 'Switch to the summoned enemies',
  strike: 'Brace for the hit',
  dot: 'Heal early and keep your life topped up',
  position: 'Keep room to reposition',
};

export function practiceResponse(move) {
  return ['reflect', 'summon', 'strike', 'dot'].find((type) => move.fx?.some((e) => e.t === type)) || 'position';
}

export function knownBossMove(id) {
  return Object.hasOwn(BOSS_ABILITIES, id) ? BOSS_ABILITIES[id] : null;
}

export function makePracticeDrill(game, pattern) {
  return game._hazardSquares(pattern, PRACTICE_BOSS, PRACTICE_START, () => 0.75)
    .map((square) => ({ ...square, delay: square.delay ?? (pattern === 'quake' ? 4 : 3) }));
}

export const practiceHit = (squares, position) => squares.some((s) => inHazard(s, position.x, position.y));
