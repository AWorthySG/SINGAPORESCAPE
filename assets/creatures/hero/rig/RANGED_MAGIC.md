# Ranger and Sorcerer animation batch

Ranger gets articulated bow and drawing arms; Sorcerer gets separate wand and
casting arms. Each class uses six transparent WebP components generated from its
existing portrait. Keep original portraits as the all-or-nothing loading fallback.

Runtime: `src/render/rangedHeroRig.js`; small hook in `src/render/sprites.js`.
Regression tests: `tests/ranged-hero-rig.test.mjs`.

This batch is independent of the Rogue/Samurai work in PR #178. When merging
both, preserve both optional rig hooks in the player drawing code.
