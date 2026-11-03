# Art brief: upgrade materials and three class heroes

This brief is for the design agent drawing art for SingaporeScape. Five
pictures are still missing. The style is the same as the rest of the game: the
A-Worthy die-cut sticker style, navy ink outlines, a white sticker border and
pastel shading, on a transparent background.

## 1. Two upgrade materials (item stickers)

These are items for upgrading gear. They borrow the sapphire and clue scroll
stickers for now. Each is one item, centred and seen from the front, in a
**160 × 160 px** square saved as `.webp`.

| File name | Item | Look |
|---|---|---|
| `item-upgrade_stone.webp` | Upgrade stone | A dense, glittering blue-violet stone with sharp facets and a few sparkles. Monsters drop it, and smiths use it to push gear past its limits. |
| `item-upgrade_ward.webp` | Upgrade ward | A blessed scroll tied with a gold ribbon and a glowing seal. It crumbles to save gear from losing a level when an upgrade fails. |

They go in `assets/icons/`. Add each id to `ITEM_ART` and remove it from
`BORROW_ID`, both in `src/render/icons.js`.

## 2. Three class heroes

The Knight, Archer and Wizard animate in the game from separate body parts, but
they have no single hero picture. Without one, the class picker and portraits
show a weapon icon instead. Draw each as one full-body picture facing right, in
the same sausage mascot style as the other heroes (for example
`assets/creatures/hero/swordsman.webp`). Match their existing animation parts in
`assets/creatures/hero/rig/` so they look like the same character. Each is
**200 × 256 px**, saved as `.webp`, with the feet at the bottom of the picture.

| File name | Class | Look |
|---|---|---|
| `knight.webp` | Knight | Shining plate armour and a visored helm, holding a longsword, with a kite shield on the other arm. |
| `archer.webp` | Archer | A green hooded tunic and a quiver on the back, holding a shortbow. |
| `wizard.webp` | Wizard | A tall pointed hat and starry robes, holding a staff topped with a glowing orb. |

They go in `assets/creatures/hero/`. Add each class id to `CLASS_HERO_ART` in
`src/render/sprites.js`.
