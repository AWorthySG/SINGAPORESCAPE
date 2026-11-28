import { PHOTO_ASSIGNMENTS } from './islandlife.js';

const subjects = Object.fromEntries(PHOTO_ASSIGNMENTS.map((photo) => [photo.id, photo]));
const stop = (id, name = subjects[id].name, dusk = false) => ({ ...subjects[id], name, dusk });

// Use the same mapped landmarks as the album. The light is a composition bonus,
// so a walk remains trainable at any hour, unlike a timed album commission.
export const PHOTO_WALKS = [
  { id: 'kampong_study', level: 1, name: 'Kampong Glam study', xp: 100, stops: [stop('market'), stop('dome', 'The golden dome')] },
  { id: 'street_stories', level: 25, name: 'Street stories', xp: 220, stops: [stop('market'), stop('playground'), stop('temple')] },
  { id: 'shorelines', level: 50, name: 'Island shorelines', xp: 530, stops: [stop('ubin'), stop('wetlands'), stop('wheel', 'Marina Bay waterfront', true)] },
  { id: 'city_in_light', level: 75, name: 'City in changing light', xp: 1320, stops: [stop('dome', 'The golden dome', true), stop('temple'), stop('wheel', 'Marina Bay waterfront', true), stop('gardens')] },
  { id: 'singapore_portfolio', level: 99, name: 'Singapore portfolio', xp: 2280, stops: [stop('wetlands'), stop('market'), stop('ubin'), stop('wheel', 'Marina Bay waterfront', true), stop('gardens')] },
];

export const photoWalkById = (id) => PHOTO_WALKS.find((walk) => walk.id === id);
