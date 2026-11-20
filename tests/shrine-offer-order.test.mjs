// The Offering Shrine's "Offer gear" section (salvageui.js shrineGearSection):
// "Offer all spare gear…" (its filters and its button) comes first, above the
// list of every spare piece, so it is in reach without scrolling past a full pack.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { shrineGearSection } from '../src/ui/salvageui.js';

test('"Offer all spare gear…" comes before the first gear row in the shrine window', () => {
  const g = freshGame('swordsman');
  for (const id of ['iron_sword', 'mithril_sword', 'rune_platebody', 'leather_body', 'gold_ring']) g.inventory.add(id, 2);
  // A stand-in DOM that writes everything into one HTML string, in order.
  const el = (tag = 'div') => ({
    tag, className: '', textContent: '', disabled: false, children: [], _html: '',
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
    appendChild(c) { this.children.push(c); return c; },
    insertAdjacentHTML(_, h) { this.children.push({ html: h }); },
    addEventListener() {}, querySelector: () => el(), querySelectorAll: () => [],
  });
  const html = (n) => (n.html !== undefined ? n.html
    : `<${n.tag} class="${n.className}">${n._html}${n.textContent}${n.children.map(html).join('')}</${n.tag}>`);
  const had = globalThis.document;
  globalThis.document = { createElement: el };
  try {
    const body = el();
    shrineGearSection({ game: g }, body, { pending: null, result: null }, () => {});
    const out = html(body);
    const bulk = out.indexOf('Offer all spare gear…');
    const ticks = out.indexOf('Not for my class'), select = out.indexOf('Quality below'), btn = out.indexOf('salvage-bulk');
    const firstRow = out.indexOf('gear-row');
    assert.ok(firstRow > 0, 'the pack\'s gear is listed');
    for (const [what, at] of [['heading', bulk], ['class tick', ticks], ['quality select', select], ['offer button', btn]]) {
      assert.ok(at >= 0 && at < firstRow, `the bulk ${what} comes before the first gear row`);
    }
    assert.ok(out.indexOf('Offer gear') < bulk, 'under the section\'s own heading');
  } finally { globalThis.document = had; }
});
