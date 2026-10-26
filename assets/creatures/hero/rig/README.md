# Swordsman animation pilot

The Swordsman uses separate body, back arm, sword arm, boots and strike arm
artwork generated from the existing class portrait. Other classes retain their
current puppet animation. The original portrait remains the loading fallback.

Runtime integration: `src/render/heroRig.js` and a small hook in
`src/render/sprites.js`. Regression coverage: `tests/hero-rig.test.mjs`.

The six-part source sheet was generated with OpenAI Image Gen using
`assets/creatures/hero/swordsman.webp` as its reference. Parts are exported as
transparent WebP files for the static game; no runtime dependencies are needed.

## Next batch: Rogue and Samurai

Rogue receives separate dagger arms for a quick two-hand attack; Samurai receives
an articulated katana arm with a deliberate wind-up and sweeping cut. Both keep
the portrait fallback while their parts load. Shared loading and gait handling
remain in `src/render/heroRig.js`; tests stay in `tests/hero-rig.test.mjs`.
