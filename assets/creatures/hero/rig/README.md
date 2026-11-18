# Playable character animation rigs

All 17 playable classes have six transparent WebP components, generated with
OpenAI Image Gen from the existing class or combat-style portrait. The original
portraits remain the fallback until every part for the selected class loads.
No build step or runtime dependency is needed.

- `src/render/heroRig.js`: 13 melee/dance rigs. Part names are `body`, `sword`,
  `back`, `left`, `right`, `strike`; `sword` means raised weapon arm for any weapon.
- `src/render/rangedHeroRig.js`: Archer, Ranger, Wizard and Sorcerer. Part names
  are `body`, `weapon`, `back`, `left`, `right`, `action`. Bowstrings and nocked
  arrows are drawn locally so strings can follow the drawing hand.
- `src/render/sprites.js`: dispatches to the appropriate rig, retaining the
  existing facing, turning, whole-body attack effects and headless fallback.

Boots alternate with the game's movement phase, so running naturally advances
steps faster. Upper bodies breathe at rest. Weapon-specific timing covers quick
cuts, heavy blows, forward thrusts, paired claw strikes, whip sweeps, bow draws
and magic casts. Rogue's off-hand attack motion follows the `dualWield` option.
These motions do not create damage events or change attack speed or save data.

Knight, Archer and Wizard use their generic combat-style portraits as references
and loading fallbacks; their rig bodies provide complete class artwork in play.
All other rigs use their existing class portrait as the source reference.

Generated sheets are retained under `/workspace/generated_images` in the task
workspace. Components were isolated by their alpha-connected silhouettes and
exported as lossless WebP. Selected back arms were mirrored to attach to the left
shoulder. Lancer's empty bracing arm was generated separately to avoid carrying a
second spear. Shoulder pivots and weapon scales were tuned in browser pose views.

Keep every class's complete six-part set together. Tests enforce one rig per
playable class and exact registry/file correspondence. New classes require a rig,
pose handling and artwork; do not register incomplete sets.

## Painted animation parts (`assets/creatures/hero/anim/`)

Cut from the designer's animation pack 07 (in-between poses, hurt/blink/victory,
back view, the Sniper's own parts) and pack 05 (empty-hand arms), registered in
`src/render/heroAnimArt.js` and kept in lock-step by `tests/render.test.mjs`.

- `<class>_body/hurt/blink/victory`: the rig body on its own canvas grown by
  `FACE_PAD`; drawn in place of `<class>-body` (the Merchant keeps its rig body
  and only swaps faces).
- `<class>_wind/mid/follow` (and `_offwind/...` for the Corsair and Rogue): an
  attack's three weapon arms, hung from the rig's shoulder; picked from the clip
  channels by `swingPhase`. Two-handed grips keep the turning arm.
- `<class>_back*`: the back view, shown when facing straight up the screen.
- `<class>_hand`: the empty-hand arm for life skills (holding the tool) and
  for a hero with no weapon.
