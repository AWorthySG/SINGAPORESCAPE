// Round monster portraits (battle bar, story speakers) are framed from each
// picture's measured painted area (src/data/portraitcrops.js, made by
// tools/portrait_crops.py). These keep that table in step with the art files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { PORTRAIT_CROPS } from '../src/data/portraitcrops.js';
import { portraitFrame, portraitFor } from '../src/render/sprites.js';
import { getNpc } from '../src/data/npcs.js';

const files = (sub) => readdirSync(`assets/creatures/${sub}`).filter((f) => f.endsWith('.webp')).map((f) => `${sub}/${f.slice(0, -5)}`);

test('every creature picture has a measured portrait frame, and nothing else does', () => {
  const pics = [...files('species'), ...files('bosses')].sort();
  assert.deepEqual(Object.keys(PORTRAIT_CROPS).sort(), pics, 're-run tools/portrait_crops.py after adding or removing creature art');
  for (const [k, [cx, cy, sw, sh]] of Object.entries(PORTRAIT_CROPS)) {
    for (const v of [cx, cy, sw, sh]) assert.ok(v > 0 && v <= 1.2, `${k}: ${v}`);
  }
});

test('a frame turns the measured square into CSS background size and position', () => {
  // A square half the picture's width, centred: twice the size, centred.
  PORTRAIT_CROPS['species/__probe'] = [0.5, 0.5, 0.5, 0.5];
  assert.deepEqual(portraitFrame('species/__probe'), { pos: '50.0% 50.0%', size: '200.0% 200.0%' });
  // The same square in the top-left corner sits at 0% 0%.
  PORTRAIT_CROPS['species/__probe'] = [0.25, 0.25, 0.5, 0.5];
  assert.deepEqual(portraitFrame('species/__probe'), { pos: '0.0% 0.0%', size: '200.0% 200.0%' });
  delete PORTRAIT_CROPS['species/__probe'];
  // Unmeasured pictures keep the old guess.
  assert.equal(portraitFrame('species/__none').size, '165%');
});

test('a monster portrait carries its frame', () => {
  const pr = portraitFor('rat', getNpc('rat'));
  assert.ok(pr && /species\/.+\.webp$/.test(pr.src.split('?')[0]));
  assert.match(pr.size, /^\d+(\.\d)?% \d+(\.\d)?%$/);
  assert.match(pr.pos, /^\d+(\.\d)?% \d+(\.\d)?%$/);
});
