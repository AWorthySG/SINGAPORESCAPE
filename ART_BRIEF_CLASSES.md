# Art brief: the Pistoler, Ninja and Merchant

This brief is for the design agent drawing art for SingaporeScape. The game has
three new classes. Until their own art arrives, they borrow other classes'
pictures, so this lists everything they need. The style is the same as the rest
of the game: the A-Worthy die-cut sticker style, navy ink outlines, white sticker
borders and pastel colours.

## 1. Class heroes (3 pictures)

Each hero is one full-body chibi picture facing right, 256 px tall, saved as
`assets/creatures/hero/<class>.webp`.

| Class | File | Look |
|---|---|---|
| Pistoler | `pistoler.webp` | A swashbuckling gunslinger with a flintlock pistol in each hand, a long coat and a wide-brimmed hat. |
| Ninja | `ninja.webp` | A masked ninja in dark wraps and a scarf, with a shuriken raised to throw. |
| Merchant | `merchant.webp` | A well-dressed shopkeeper with a waistcoat and a coin purse on the belt, leaning on a cane with a metal knob. |

## 2. Animation parts (18 pictures)

The game animates heroes from separate body parts. Draw each class's parts on a
transparent background, matching the layout of the existing parts in
`assets/creatures/hero/rig/`. The new files replace the copies that are there
now.

- **Merchant:** `merchant-body`, `-sword` (the cane), `-back`, `-left`,
  `-right`, `-strike`. Follow the Swordsman parts (`swordsman-*`) for the
  layout.
- **Ninja:** `ninja-body`, `-sword` (a shuriken in the hand), `-back`, `-left`,
  `-right`, `-strike` (the throwing arm). Follow the Corsair parts
  (`corsair-*`).
- **Pistoler:** `pistoler-body`, `-weapon` (the right-hand pistol), `-back`
  (the left-hand pistol), `-left`, `-right`, `-action` (a muzzle flash). Follow
  the Archer parts (`archer-*`).

All of these are `.webp` files in `assets/creatures/hero/rig/`.

## 3. Weapon stickers (39 pictures)

Each weapon comes in 13 metal tiers: `bronze`, `iron`, `steel`, `mithril`,
`adamant`, `rune`, `dragon`, `obsidian`, `orichalcum`, `jade`, `starmetal`,
`celestial` and `eternal`.

| Weapon | File name | Look |
|---|---|---|
| Pistol | `item-<tier>_pistol.webp` | A flintlock pistol. The barrel and lock take the metal's colour; the grip is wood. |
| Shuriken | `item-<tier>_shuriken.webp` | A four-point throwing star in the metal's colour, with a cream centre. |
| Cane | `item-<tier>_cane.webp` | A wooden cane with a round knob and a collar in the metal's colour. |

The stickers in the game now were made from simple vector drawings; replace
those files directly. They are 160 × 160 px `.webp` files in `assets/icons/`.

## 4. Mercenaries (optional)

The Merchant's hired mercenaries currently look like villagers. A small set of
3 or 4 hireling stickers, in the townsfolk style (256 px tall, in
`assets/creatures/townsfolk/`), would give them their own look. Ideas: a
sellsword, a spear guard, a burly bruiser and a quick duellist.
