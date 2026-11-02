# Art brief: scout leather and the hide vest

This brief is for the design agent drawing item stickers for SingaporeScape. The
game now gives each class its own kind of armour, and the agile melee classes
(Rogue, Corsair, Brawler, Samurai) wear a new **scout leather** line. These
pieces have no stickers of their own yet. Until they do, they borrow the leather
stickers (`coif`, `leather_body`, `leather_chaps`) with a colour tint.

## What to draw

40 item stickers in total.

**Scout leather: 3 pieces in each of 13 metal tiers (39 stickers).**

| Piece | File name | Look |
|---|---|---|
| Hood | `item-<tier>_scout_hood.webp` | A close leather hood with a short cape over the shoulders and metal studs on the brow band. |
| Jerkin | `item-<tier>_scout_jerkin.webp` | A sleeveless studded leather jerkin with a belt and a dagger loop. Lighter and shorter than a platebody. |
| Breeches | `item-<tier>_scout_breeches.webp` | Fitted leather breeches with studded knee guards and a strap at each thigh. |

The tiers, in order, are `bronze`, `iron`, `steel`, `mithril`, `adamant`, `rune`,
`dragon`, `obsidian`, `orichalcum`, `jade`, `starmetal`, `celestial` and `eternal`.
In each tier the leather stays a warm brown and only the **studs, buckles and
trim** take the metal's colour. Use the same metal colours as the existing
bronze to eternal weapons and plate. Higher tiers can add more trim and a small
glow on the studs (celestial and eternal), but keep the silhouette the same, so
the pieces read as one family.

**One single item.** `item-hide_vest.webp` is a soft, undyed hide vest for
beginner archers: rough stitched edges, laced front, no sleeves.

## Style

- The A-Worthy die-cut sticker style, matching the existing item icons: navy ink
  outline, white sticker border, pastel shading.
- One item per image, centred, seen straight on (front view), on a transparent
  background.
- Squares at **160 × 160 px**, saved as `.webp`.

## How they go in

Each file goes in `assets/icons/`, and its id is added to `ITEM_ART` in
`src/render/icons.js`. Once a piece has its own sticker, remove it from the
borrowing (`BORROW` / `BORROW_ID` in the same file). The tests check that every
item still has a sticker.
