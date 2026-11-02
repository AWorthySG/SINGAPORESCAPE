# Art brief: new monsters and bosses

This brief is for the design agent drawing creature art for SingaporeScape. The
game has 12 new monster species and 6 new bosses. Until their own art arrives,
each one borrows a relative's picture. The style is the same as every other
creature: the A-Worthy die-cut sticker style, navy ink outlines, a white
sticker border and pastel colours. Each creature faces right, stands with its
feet on the ground line, and sits on a transparent background.

## 1. Monster species (12 pictures)

Each species is one picture, 256 px, saved as
`assets/creatures/species/<family>.webp`. Every form of the species (normal,
Elder and Ancient) and its champions share the picture; the game tints and
scales them.

| File | Species | Where | Look |
|---|---|---|---|
| `malayan_tapir.webp` | Malayan tapir | Pulau Ubin | A chubby black tapir with its white "saddle" and a little trunk-like snout. |
| `wild_hornet.webp` | Wild hornet | Pulau Ubin | A fat yellow-and-black hornet with buzzing wings and a stinger. |
| `kelong_crab.webp` | Kelong crab | Changi Coast | A rusty orange crab tangled in a scrap of fishing net. |
| `dugong.webp` | Dugong | Changi Coast | A gentle grey sea cow with a round snout and paddle flippers. |
| `merlion_whelp.webp` | Merlion whelp | Marina Bay | A baby merlion: lion head with a fluffy mane and a fish tail, spouting a little water. |
| `weaver_ant.webp` | Weaver ant | Sungei Buloh Wetlands | A big orange weaver ant carrying a rolled leaf. |
| `tiger_cub.webp` | Tiger cub | Jurong Forest | A playful striped tiger cub with oversized paws. |
| `orchid_mantis.webp` | Orchid mantis | Gardens by the Bay | A pink-and-white mantis shaped like orchid petals. |
| `langsuir.webp` | Langsuir | Tekong Badlands | A floating spirit in a long pale dress, with long black hair and clawed fingers. Spooky but cute. |
| `black_panther.webp` | Black panther | Coney Island | A sleek black panther with glowing yellow eyes. |
| `oarfish.webp` | Oarfish | Southern Islands | A long silver ribbon fish with a red crest along its back. |
| `jenglot.webp` | Jenglot | The Shadow Rift | A tiny withered creature with long hair, long nails and fangs. |

## 2. Bosses (6 pictures)

Each boss is one picture, 320 px, saved as
`assets/creatures/bosses/<npcId>.webp`. Bosses wear their own crown or
crest in the art.

| File | Boss | Level | Where | Look |
|---|---|---|---|---|
| `nian_beast.webp` | Nian, the New Year Beast | 55 | Marina Bay | The red Lunar New Year beast: a horned lion-like monster with a big grin, scared of firecrackers and red lanterns. |
| `kelong_king_crab.webp` | Kelong King Crab | 75 | Changi Coast | A huge crab wearing a kelong hut on its back like a shell, net trailing from one claw. |
| `langsuir_matriarch.webp` | Langsuir Matriarch | 140 | Tekong Badlands | A towering langsuir with a crown of hair ornaments, mid-shriek. |
| `shadow_panther.webp` | The Shadow Panther | 150 | Coney Island | A giant black panther wrapped in purple shadow smoke. |
| `abyssal_oarfish.webp` | The Abyssal Oarfish | 205 | Southern Islands | A colossal oarfish coiling out of the sea, crest glowing deep blue. |
| `jenglot_sovereign.webp` | Jenglot Sovereign | 300 | The Shadow Rift | A jenglot grown huge on a bone throne, with blood-red eyes and a crown of claws. |

## How they go in

1. Run each new species picture through `tools/unify_creatures.py`, and each
   boss picture too. It gives every creature one border, a common size, feet on
   the ground and a gentle colour grade.
2. Put the files in `assets/creatures/species/` and `assets/creatures/bosses/`.
3. In `src/render/sprites.js`, add each species id to `SPECIES_ART` and each
   boss id to `BOSS_ART`.
4. In the same file, delete that creature's line from `SPECIES_ALIAS` or
   `BOSS_ALIAS`, the borrowed-art lists.
5. Run `npm test`. The tests check that the registries match the files on
   disk.
