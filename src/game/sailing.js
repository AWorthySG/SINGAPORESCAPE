import { seeded } from './bounty.js';

export const sailingSides = ['Port · left', 'Starboard · right'];
const sides = ['port', 'starboard'];
const PORT_ACCENTS = {
  changi: 'the Changi shallows',
  ubin: 'the mangrove bank',
  cove: 'the shell-cove sandbar',
  marina: 'the harbour wall',
  sentosa: 'the Sentosa reef',
};
const ROUTE_LEGS = ['wind', 'current', 'wash', 'leading', 'traffic', 'reef'];

function challenge(kind, side, tide, area, random) {
  const atSide = sides[side];
  if (kind === 'wind') return { label: 'Crosswind', reading: `The wind is pushing you towards ${atSide}.`, guide: 'Steer into the wind to hold your course.', safe: 1 - side };
  if (kind === 'current') return { label: `${tide} tide`, reading: `The current is carrying the boat towards ${atSide}.`, guide: 'Angle into the current to hold your course.', safe: 1 - side };
  if (kind === 'wash') return { label: 'Passing wake', reading: `A vessel has just passed on your ${atSide} side.`, guide: 'Take the sheltered side of the channel while its wake passes.', safe: 1 - side };
  if (kind === 'leading') return { label: 'Leading marks', reading: `The two white navigation marks line up to ${atSide}.`, guide: 'Head towards the aligned marks to stay in the deep channel.', safe: side };
  if (kind === 'traffic') return { label: 'Harbour traffic', reading: `A workboat is crossing the ${atSide} half of the fairway.`, guide: 'Give the workboat room and take the clear half.', safe: 1 - side };
  if (kind === 'reef') return { label: 'Reef edge', reading: `The water over the reef turns pale to ${atSide}.`, guide: 'Keep to the darker, deeper water.', safe: 1 - side };
  if (kind === 'set') {
    const windStrong = random() >= 0.5, wind = windStrong ? 'strong wind' : 'light wind';
    const stream = windStrong ? 'weak current' : 'strong current';
    return {
      label: 'Wind against tide', reading: `A ${wind} pushes ${atSide}. A ${stream} sets ${sides[1 - side]}.`,
      guide: 'Steer against the stronger force to hold your course.', safe: windStrong ? 1 - side : side,
    };
  }
  return { label: 'Channel marker', reading: `A yellow marker shows ${area} on your ${atSide} side.`, guide: 'Leave the shallow side clear and steer towards the open channel.', safe: 1 - side };
}

/** Each attempt is fixed once the boat leaves. A new passage presents different legs and conditions. */
export function sailingPassage(entry, date, phase, serial, { practice = false, freight = false } = {}) {
  const tide = phase % 0.5 < 0.25 ? 'Flood' : 'Ebb';
  const random = seeded(`${date}/${entry.id}/${serial}/${tide}`);
  const route = entry.legs || [
    'channel',
    ...entry.course.slice(1).map((_, i) => ROUTE_LEGS[(serial + i) % Math.min(ROUTE_LEGS.length, entry.level + 2)]),
  ];
  const legs = route.map((kind, i) => {
    const gustSide = random() >= 0.5 ? 1 : 0;
    const currentSide = (tide === 'Flood' ? 0 : 1) ^ (entry.course?.[i] ?? i % 2);
    const side = kind === 'current' ? currentSide : kind === 'set' ? 1 - currentSide : gustSide;
    const marker = kind === 'channel' ? { side, colour: 'yellow' } : kind === 'leading' ? { side, colour: 'white' } : null;
    return { ...challenge(kind, side, tide, PORT_ACCENTS[entry.from], random), marker };
  });
  return { id: entry.id, practice, freight, tide, legs, values: [], corrections: 0, finished: false };
}

export function steerPassage(passage, side) {
  const leg = passage.legs[passage.values.length];
  if (passage.finished || !leg || (side !== 0 && side !== 1)) return 'closed';
  if (leg.safe !== side) {
    passage.corrections++;
    return 'recover';
  }
  passage.values.push(side);
  return passage.values.length === passage.legs.length ? 'arrived' : 'ahead';
}
