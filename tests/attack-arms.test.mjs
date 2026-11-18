// Painted attack arms (src/render/heroAnimArt.js) with their pictures loaded:
// once an arm hands back to the rig, the rig is at rest, not left mid-aim.
// Its own file, so the stub Image below is in place before any picture loads.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 64; } };
const { rangedAnimPose } = await import('../src/render/rangedHeroRig.js');
const { hasSwingArt } = await import('../src/render/heroAnimArt.js');
const { sampleHeroClip } = await import('../src/render/heroanim.js');

test('after a painted shot or cast the rifle, bow and staff are back at rest', () => {
  const opts = { gait: { phase: 0, move: 0 }, time: 0 };
  for (const [cls, clip] of [['sniper', 'rifle'], ['archer', 'bow_quick'], ['wizard', 'cast']]) {
    assert.ok(hasSwingArt(cls), `${cls}: painted attack arms ready`);
    // Late in the clip: the painted arm has gone back to guard and the rig shows.
    const ch = sampleHeroClip(clip, 0.95).ch;
    assert.equal(ch.paint, 1);
    const pose = rangedAnimPose(cls, opts, { ...ch, draw: 1, release: 1, charge: 1, cast: 1 });
    assert.deepEqual([pose.draw, pose.release, pose.charge, pose.cast], [0, 0, 0, 0], `${cls}: nothing left aimed`);
  }
  // The Pistoler's back gun is still the rig's own, so it keeps its aim and kick.
  const ch = { ...sampleHeroClip('pistols', 0.5).ch, draw: 1, kick2: 1 };
  const pose = rangedAnimPose('pistoler', opts, ch);
  assert.equal(pose.draw, 1);
  assert.equal(pose.kick2, 1);
});
