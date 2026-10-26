# Bow and casting animation

`src/render/rangedHeroRig.js` handles Archer/Ranger and Wizard/Sorcerer. Archer
uses a shorter bow; Wizard uses a longer staff. Each has separate boots, body,
weapon arm, free/drawing arm and alternate action arm.

Bows have no baked bowstring. The renderer joins the bow tips through the nock
point, which moves back during draw and snaps forward on release. The local
nocked arrow disappears during release; combat owns the actual projectile.
Casting raises the weapon during charge, extends it for the spell, then recovers.
Existing game attack effects remain in the shared sprite library.

`tests/ranged-hero-rig.test.mjs` covers loading/failure, cache separation, opacity,
movement phases, draw/release and charge/cast endpoints.
