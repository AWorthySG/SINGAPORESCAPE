// The bank's slots are kept between redraws (src/ui/slotgrid.js): a withdraw
// swaps only the slots that changed instead of rebuilding hundreds of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyedSlots, placeSlots } from '../src/ui/slotgrid.js';

// Just enough of a DOM element for the grid: children in order, with moves counted.
class Node_ {
  constructor(name) { this.name = name; this.parent = null; }
  get nextSibling() { const k = this.parent?.kids; return k ? k[k.indexOf(this) + 1] || null : null; }
  remove() { if (this.parent) { this.parent.kids.splice(this.parent.kids.indexOf(this), 1); this.parent.moves++; this.parent = null; } }
}
class Grid {
  constructor() { this.kids = []; this.moves = 0; }
  get firstChild() { return this.kids[0] || null; }
  insertBefore(n, ref) {
    if (n.parent) n.remove();
    const i = ref ? this.kids.indexOf(ref) : this.kids.length;
    this.kids.splice(i, 0, n); n.parent = this; this.moves++;
  }
  names() { return this.kids.map((k) => k.name).join(','); }
}

test('a slot is made once per key and kept until a prune finds it unused', () => {
  const slots = keyedSlots();
  let made = 0;
  const make = (k) => () => { made++; return new Node_(k); };
  const a = slots.get('a', make('a')), b = slots.get('b', make('b'));
  slots.prune();
  assert.equal(slots.get('a', make('a')), a, 'the same element comes back');
  assert.equal(made, 2);
  slots.prune();                       // b wasn't asked for this time
  assert.notEqual(slots.get('b', make('b')), b, 'a forgotten slot is made afresh');
  assert.equal(made, 3);
});

test('placing slots moves only what changed, in order', () => {
  const grid = new Grid();
  const [a, b, c, d, b2] = ['a', 'b', 'c', 'd', 'b2'].map((n) => new Node_(n));
  placeSlots(grid, [a, b, c]);
  assert.equal(grid.names(), 'a,b,c');
  grid.moves = 0;
  placeSlots(grid, [a, b, c]);
  assert.equal(grid.moves, 0, 'an unchanged bank touches nothing');
  placeSlots(grid, [a, b2, c]);         // b's amount changed
  assert.equal(grid.names(), 'a,b2,c');
  assert.equal(grid.moves, 2, 'one out, one in');
  grid.moves = 0;
  placeSlots(grid, [a, c]);             // withdrawn completely
  assert.equal(grid.names(), 'a,c');
  assert.equal(grid.moves, 1);
  placeSlots(grid, [d, a, c]);          // a new item at the front
  assert.equal(grid.names(), 'd,a,c');
  placeSlots(grid, []);
  assert.equal(grid.names(), '');
});
