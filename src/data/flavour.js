// "Did you know?" notes for the encyclopedia: a short, true, family-friendly
// fact about each real Singapore place the game's regions are named after, and
// each creature based on a real animal. Fantasy creatures and spirits have none.
// Data only.

/** Region name -> one short fact. */
export const REGION_FLAVOUR = {};

/** Monster family (or monster id) -> one short fact. */
export const CREATURE_FLAVOUR = {};

/** The note for a region, or ''. */
export const regionFlavour = (name) => REGION_FLAVOUR[name] || '';

/** The note for a monster (by its family, else its own id), or ''. */
export const creatureFlavour = (def, id) => CREATURE_FLAVOUR[def?.family] || CREATURE_FLAVOUR[id] || '';
