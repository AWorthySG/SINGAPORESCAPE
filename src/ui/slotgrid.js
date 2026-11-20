// Long item grids (the bank's hundreds of slots) kept between redraws.
// Every withdraw or deposit redraws the open window; rebuilding a few hundred
// slots each time meant new elements, new listeners and a fresh layout and
// paint of the whole grid (a fifth of a second on a phone). Instead each slot
// is kept under a key that changes whenever its look would (item, quality,
// amount), and only the slots that changed are swapped in place.
// Plain DOM calls only (firstChild, nextSibling, insertBefore, remove), so the
// tests drive it with stand-in nodes.

/** Slots kept by key: `get(key, make)` returns the element made for that key
 *  before, or makes one; `prune()` forgets every key not asked for since the
 *  last prune (an emptied slot, or an amount that changed). */
export function keyedSlots() {
  let kept = new Map(), used = new Map();
  return {
    get(key, make) {
      let el = used.get(key) || kept.get(key);
      if (!el) el = make();
      used.set(key, el);
      return el;
    },
    prune() { kept = used; used = new Map(); },
    get size() { return kept.size; },
  };
}

/** Lay `cells` (in order) into `grid`, moving only what has to: slots already
 *  in place stay untouched, ones not wanted any more are taken out and new
 *  ones are slotted in where they belong. */
export function placeSlots(grid, cells) {
  const want = new Set(cells);
  for (let n = grid.firstChild; n;) { const next = n.nextSibling; if (!want.has(n)) n.remove(); n = next; }
  let at = grid.firstChild;
  for (const c of cells) {
    if (c === at) at = at.nextSibling;
    else grid.insertBefore(c, at);
  }
}
