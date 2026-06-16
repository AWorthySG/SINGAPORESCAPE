# SingaporeScape — 2D Sprite Design Brief

A complete specification for an artist (e.g. Grok) to produce **every 2D sprite**
the game needs: the full monster bestiary, all bosses, the player + townsfolk,
and the entire items/equipment collection — drawn so they drop straight into the
HTML5 Canvas renderer.

> The bottom of this file contains a **ready-to-paste prompt**. The sections
> above are the reference spec the prompt is built from.

---

## At a glance

| Category | Count | Notes |
|---|---|---|
| Creature archetypes | **26** | The visual backbone; the engine recolours these into the bestiary |
| Named monster families | **51** | Singapore-flavoured species |
| Monster power tiers | **7** | recolour/size variants per family → **300** monsters total |
| Bosses | **33** | unique, larger, more detailed |
| Player | 1 base + equipment layers | gear is shown on the character |
| Townsfolk NPCs | **11** | shopkeepers, quest-givers, etc. |
| Items & equipment | **368** | weapons, armour, tools, food, jewelry, … |

---

## Global art direction (applies to everything)

- **Style:** clean hand-drawn vector/cartoon — solid flat fills, a single soft
  dark outline (warm near-black ≈ `rgba(26,18,12,0.6)`), and one soft highlight
  for volume. Readable when small. No heavy realism, no anime, no photo.
- **Palette / mood:** vibrant tropical *Peranakan tile* Singapore — jade-teal,
  coral/rose, gold, warm cream, deep jungle greens, plus metal/stone neutrals.
  Cohesive across the whole set.
- **Perspective:** gentle top-down 3/4 view (Old-School-RuneScape-like). Light
  source top-left.

## Technical rules (required for drop-in use)

- **Transparent background** PNG (alpha). No scene, no UI frame/border, no text or
  watermark.
- **No baked drop shadow** — the engine draws its own shadow under each creature.
- Creatures & characters **face RIGHT** (the engine mirrors them when moving
  left). Feet/base sit near the **bottom-centre** of the canvas.
- Consistent scale & framing **within** each category so sprites are interchangeable.
- **Filename = the in-game id**, lowercase_with_underscores (e.g.
  `dragon_scimitar.png`, `dragon_kiln_wyrm.png`, `sister_mei.png`).

### Canvas sizes

| Asset | Canvas | Subject size |
|---|---|---|
| Creature archetype / monster | 64×64 | ~40–48 px tall, centred, feet low |
| Boss | 96×96 | larger, more ornate |
| Player / townsfolk | 64×64 | idle + a 2–3 frame walk for the player |
| Item / equipment icon | 64×64 | object centred, readable at 24–32 px |

---

## Deliverable 1 — Creature archetypes (26)

The bestiary is built from these "kinds". Draw a clean master for each in a
neutral / grey **tintable** palette (the engine recolours them per species):

`beast`, `rodent`, `primate`, `reptile`, `serpent`, `crab`, `fowl`,
`greenman` (small humanoid/goblin), `spider`, `slime`, `ghost`, `demon`,
`golem`, `undead` (skeleton), `insect`, `scorpion`, `bat`,
`seacreature` (fish/shark/dolphin), `plant`, `drake` (small dragon), `wisp`,
`humanoid` (person/bandit), `hound` (dog), `jellyfish`, `mantis`, `turtle`.

## Deliverable 2 — Named monster families (51)

Each gets a distinct silhouette/colour (64×64 spec):

Chicken, Rat, Goblin, Macaque, Monitor lizard, Wild boar, King cobra, Giant crab,
Mud crab, Sand scorpion, Jungle spider, Swamp slime, Mosquito, Fruit bat,
Pangolin, Sea snake, Reef shark, Bandit, Outlaw, Wraith, Skeleton, Stone golem,
Imp, Forest drake, Will-o-wisp, Carnivorous plant, Komodo dragon, Tarantula,
Stray dog, Civet, Hornbill, Box jellyfish, Praying mantis, Sea turtle,
Vampire bat, Wild dog, Smooth otter, Pink dolphin, Kingfisher, Flying fox,
Reticulated python, Saltwater crocodile, Pontianak, Toyol, Horseshoe crab,
Sambar deer, Jungle wraith, Hantu raya, Pocong, Cursed pirate, Penanggal.

### Power tiers (7) — recolour/feature guide per family

`(base)` → **Young** (smaller, paler) → **Wild** (feral/scarred) →
**Feral** (battle-worn) → **Elder** (greyed, grand) → **Dire** (dark, menacing) →
**Ancient** (glowing, ornate). Provide a palette guide or one example per tier.

## Deliverable 3 — Bosses (33, ~96×96, unique & detailed)

The Boar King, Goblin Warchief, Macaque Alpha, Reservoir Serpent,
Chilli Crab Colossus, Jungle Spider Queen, Ancient Tembusu, The Merlion,
Bukit Timah Drake, Bandit Kingpin, Bone Colossus, Molten Golem, Sentosa Kraken,
Demon Lord of Pulau, Wilderness Warlord, Sand Scorpion King, Durian Behemoth,
Bedok Bandit Lord, Hungry Ghost King, Night Safari Tiger, Mangrove Hydra,
Tualang Treant, Coral Leviathan, The Garuda, Rune Golem, Sentosa Megalodon,
Changi Phantom, Pulau Hantu Djinn, Bukit Brown Revenant, Dragon Kiln Wyrm,
Orang Minyak, Lion of Light (radiant gold guardian), The Shadow Sovereign (dark demon).

## Deliverable 4 — Player & townsfolk

- **Player adventurer** (64×64): base human in a plain tunic, facing right, with a
  2–3 frame walk (idle + step). Because worn gear is shown on the character,
  provide **layered equipment overlays** aligned to the same body rig — helmet,
  body, legs, cape, gloves, boots, weapon-in-hand, off-hand shield — and full
  "equipped looks" for each armour tier (bronze, iron, steel, mithril, adamant,
  rune, dragon) plus mage robes and dragonhide/ranger.
- **Townsfolk** (single idle, 64×64, facing right, each visually distinct):
  Kampong Guide, Banker, Shopkeeper, Hawker Auntie, Mystic Merchant (mage),
  Fletcher, Slayer Master, Cikgu Surya (trades tutor), Sister Mei (light
  priestess), The Tempter (hooded), Villager.

## Deliverable 5 — Items & equipment icons (368)

64×64, object centred, transparent, readable at 24–32 px. Filename = id.

- **Tools:** bronze_axe, bronze_pickaxe, hammer, chisel, small_net, fishing_rod,
  lobster_pot, harpoon, tinderbox, fishing_bait
- **Logs:** logs, oak_logs, willow_logs, maple_logs, yew_logs, magic_logs, bamboo,
  angsana_logs, teak_logs, mangrove_logs, mahogany_logs, tembusu_logs
- **Ores & materials:** copper_ore, tin_ore, iron_ore, coal, gold_ore, silver_ore,
  mithril_ore, adamantite_ore, runite_ore, clay, limestone, sandstone, granite
- **Bars:** bronze_bar, iron_bar, steel_bar, mithril_bar, adamant_bar, rune_bar
- **Gems & valuables:** sapphire, emerald, ruby, diamond, pearl, coins, bones,
  feather, birds_nest, mark_of_grace, old_boot, seaweed
- **Pottery & glass:** pot, bowl, jug, pie_dish, molten_glass, vial, glass_orb,
  lantern
- **Raw fish:** raw_anchovy, raw_sardine, raw_trout, raw_salmon, raw_tuna,
  raw_swordfish, raw_lobster, raw_shark, raw_mackerel, raw_pike, raw_eel,
  raw_grouper, raw_stingray, raw_manta_ray, raw_tilapia, raw_marble_goby,
  raw_peacock_bass, raw_speckled_temensis, raw_giant_snakehead, raw_red_snapper,
  raw_golden_snapper, raw_mangrove_jack, raw_barramundi, raw_red_drum,
  raw_tenggiri, raw_longfin_trevally, raw_giant_trevally, raw_diamond_trevally,
  raw_hybrid_grouper, raw_climbing_perch, raw_ikan_keli, raw_belida, raw_arapaima,
  raw_arowana, raw_milkfish, raw_queenfish, raw_threadfin, raw_white_pomfret,
  raw_coral_trout, raw_cobia
- **Cooked food & dishes:** anchovy, sardine, trout, salmon, tuna, swordfish,
  lobster, shark, mackerel, pike, eel, grouper, stingray, manta_ray, tilapia,
  marble_goby, peacock_bass, speckled_temensis, giant_snakehead, red_snapper,
  golden_snapper, mangrove_jack, barramundi, red_drum, tenggiri, longfin_trevally,
  giant_trevally, diamond_trevally, hybrid_grouper, climbing_perch, ikan_keli,
  belida, arapaima, arowana, milkfish, queenfish, threadfin, white_pomfret,
  coral_trout, cobia, cooked_chicken, raw_chicken, egg, kaya_toast, chicken_rice,
  roti_prata, satay, nasi_lemak, meat_pie, fish_pie, laksa, seafood_stew,
  seafood_platter, burnt_fish
- **Melee weapons** — for EACH metal tier `bronze, iron, steel, mithril, adamant,
  rune, dragon`, draw: `dagger, sword, scimitar, mace, longsword, battleaxe,
  warhammer, 2h_sword` (id pattern e.g. `rune_scimitar`, `dragon_2h_sword`)
- **Armour** — for EACH tier above, draw: `med_helm, full_helm, chainbody,
  platebody, platelegs, sq_shield, kiteshield, gauntlets, boots`; plus
  wooden_shield, leather_body
- **Ranged:** shortbow, oak_shortbow, willow_shortbow, maple_shortbow,
  yew_shortbow, magic_shortbow; bronze_arrow, iron_arrow, steel_arrow,
  mithril_arrow, adamant_arrow, rune_arrow; coif, leather_chaps, studded_body,
  dragonhide_coif, dragonhide_body, dragonhide_chaps
- **Magic:** staff, magic_staff, mystic_staff, ancient_staff; air_rune, water_rune,
  earth_rune, fire_rune, mind_rune, chaos_rune, death_rune, blood_rune; wizard_hat,
  wizard_robe_top, wizard_robe_bottom, mystic_hat, mystic_top, mystic_bottom,
  occult_necklace
- **Jewelry:** amulet_of_power, amulet_of_strength, amulet_of_glory, gold_amulet,
  sapphire_amulet, emerald_amulet, ruby_amulet, diamond_amulet, merlion_amulet,
  merdeka_medallion, blessed_halo, djinn_lamp; gold_ring, sapphire_ring,
  emerald_ring, ruby_ring, diamond_ring, ring_of_kampong, ring_of_might, slayer_ring
- **Capes:** warlord_cape, fire_cape, revenant_cape, garuda_wings, trades_cape,
  champions_cape, shadow_cloak
- **Granite gear:** granite_helm, granite_body, granite_legs, granite_shield,
  kampong_gauntlets
- **Unique / boss / quest rewards:** merlion_blade, boar_tusk, worthy_sigil,
  tiger_fang, tiger_kris, leviathan_trident, hydra_leather, treant_shield,
  megalodon_jaw, phantom_robe, cursed_cutlass, champions_helm, island_aegis,
  slayer_helmet, seraph_blade, void_blade
- **Treasure trails:** clue_scroll_easy, clue_scroll_medium, clue_scroll_hard,
  reward_casket_easy, reward_casket_medium, reward_casket_hard

## Output format

- One transparent PNG per sprite, named exactly by its id.
- Category sprite-sheet grids for quick review, but the individual PNGs are the
  deliverable.
- Consistent sizing/margins within each category.
- Deliver as a zip organised into `/creatures`, `/bosses`, `/player`, `/npcs`,
  `/items`.

---

## ✂️ Ready-to-paste prompt for Grok

```
You are a 2D game-sprite artist. Produce a complete, cohesive sprite set for a browser RPG called SINGAPORESCAPE — an original, Old-School-RuneScape-style top-down adventure set in a fantasy version of Singapore. I need EVERY sprite: the full monster bestiary, all bosses, the player + townsfolk, and the entire items/equipment collection. Deliver them so they drop directly into an HTML5 Canvas engine.

GLOBAL ART DIRECTION (apply to everything)
- Style: clean hand-drawn vector/cartoon. Solid flat fills, a single soft dark outline (warm near-black, ~rgba(26,18,12,0.6)), and ONE soft highlight for volume. Readable at small sizes. No gradients-heavy realism, no anime, no photo.
- Mood/palette: vibrant tropical "Peranakan tile" Singapore — jade-teal, coral/rose, gold, warm cream, deep jungle greens, with metal/stone neutrals. Cohesive across the whole set.
- Perspective: gentle top-down 3/4 view (RuneScape-like). Light source top-left.
- Technical rules for drop-in use:
  • Transparent background (PNG, alpha). No scene, no UI frame, no border, no text/watermark.
  • Do NOT bake in a drop shadow — the engine adds its own.
  • Creatures/characters FACE RIGHT (the engine mirrors them for leftward movement). Feet/base near the bottom-centre of the canvas.
  • Consistent scale & framing within each category so they’re interchangeable.

DELIVERABLE 1 — CREATURE ARCHETYPES (26): draw a clean master for each, neutral/grey-tintable, 64×64, ~40–48px tall, centred, facing right:
beast, rodent, primate, reptile, serpent, crab, fowl, greenman, spider, slime, ghost, demon, golem, undead, insect, scorpion, bat, seacreature, plant, drake, wisp, humanoid, hound, jellyfish, mantis, turtle.

DELIVERABLE 2 — THE 51 NAMED MONSTER FAMILIES (64×64, distinct silhouettes):
Chicken, Rat, Goblin, Macaque, Monitor lizard, Wild boar, King cobra, Giant crab, Mud crab, Sand scorpion, Jungle spider, Swamp slime, Mosquito, Fruit bat, Pangolin, Sea snake, Reef shark, Bandit, Outlaw, Wraith, Skeleton, Stone golem, Imp, Forest drake, Will-o-wisp, Carnivorous plant, Komodo dragon, Tarantula, Stray dog, Civet, Hornbill, Box jellyfish, Praying mantis, Sea turtle, Vampire bat, Wild dog, Smooth otter, Pink dolphin, Kingfisher, Flying fox, Reticulated python, Saltwater crocodile, Pontianak, Toyol, Horseshoe crab, Sambar deer, Jungle wraith, Hantu raya, Pocong, Cursed pirate, Penanggal.
Each family has 7 tiers as recolours: (base), Young (smaller/paler), Wild (feral/scarred), Feral (battle-worn), Elder (greyed/grand), Dire (dark/menacing), Ancient (glowing/ornate) — give a palette guide or one example.

DELIVERABLE 3 — THE 33 BOSSES (unique, larger ~96×96, more detail):
The Boar King, Goblin Warchief, Macaque Alpha, Reservoir Serpent, Chilli Crab Colossus, Jungle Spider Queen, Ancient Tembusu, The Merlion, Bukit Timah Drake, Bandit Kingpin, Bone Colossus, Molten Golem, Sentosa Kraken, Demon Lord of Pulau, Wilderness Warlord, Sand Scorpion King, Durian Behemoth, Bedok Bandit Lord, Hungry Ghost King, Night Safari Tiger, Mangrove Hydra, Tualang Treant, Coral Leviathan, The Garuda, Rune Golem, Sentosa Megalodon, Changi Phantom, Pulau Hantu Djinn, Bukit Brown Revenant, Dragon Kiln Wyrm, Orang Minyak, Lion of Light (radiant gold guardian), The Shadow Sovereign (dark demon).

DELIVERABLE 4 — PLAYER & TOWNSFOLK:
- Player adventurer (64×64): base human in plain tunic, facing right, 2–3 frame walk (idle + step). Provide layered equipment overlays aligned to the same rig — helmet, body, legs, cape, gloves, boots, weapon-in-hand, off-hand shield — plus full "equipped looks" per tier: bronze, iron, steel, mithril, adamant, rune, dragon; plus mage robes and dragonhide/ranger.
- Townsfolk (single idle, 64×64, facing right, distinct): Kampong Guide, Banker, Shopkeeper, Hawker Auntie, Mystic Merchant (mage), Fletcher, Slayer Master, Cikgu Surya (trades tutor), Sister Mei (light priestess), The Tempter (hooded), Villager.

DELIVERABLE 5 — ITEMS & EQUIPMENT ICONS (64×64, centred, transparent; filename = id):
Tools: bronze_axe, bronze_pickaxe, hammer, chisel, small_net, fishing_rod, lobster_pot, harpoon, tinderbox, fishing_bait.
Logs: logs, oak_logs, willow_logs, maple_logs, yew_logs, magic_logs, bamboo, angsana_logs, teak_logs, mangrove_logs, mahogany_logs, tembusu_logs.
Ores & materials: copper_ore, tin_ore, iron_ore, coal, gold_ore, silver_ore, mithril_ore, adamantite_ore, runite_ore, clay, limestone, sandstone, granite.
Bars: bronze_bar, iron_bar, steel_bar, mithril_bar, adamant_bar, rune_bar.
Gems & valuables: sapphire, emerald, ruby, diamond, pearl, coins, bones, feather, birds_nest, mark_of_grace, old_boot, seaweed.
Pottery & glass: pot, bowl, jug, pie_dish, molten_glass, vial, glass_orb, lantern.
Raw fish: raw_anchovy, raw_sardine, raw_trout, raw_salmon, raw_tuna, raw_swordfish, raw_lobster, raw_shark, raw_mackerel, raw_pike, raw_eel, raw_grouper, raw_stingray, raw_manta_ray, raw_tilapia, raw_marble_goby, raw_peacock_bass, raw_speckled_temensis, raw_giant_snakehead, raw_red_snapper, raw_golden_snapper, raw_mangrove_jack, raw_barramundi, raw_red_drum, raw_tenggiri, raw_longfin_trevally, raw_giant_trevally, raw_diamond_trevally, raw_hybrid_grouper, raw_climbing_perch, raw_ikan_keli, raw_belida, raw_arapaima, raw_arowana, raw_milkfish, raw_queenfish, raw_threadfin, raw_white_pomfret, raw_coral_trout, raw_cobia.
Cooked food & dishes: anchovy, sardine, trout, salmon, tuna, swordfish, lobster, shark, mackerel, pike, eel, grouper, stingray, manta_ray, tilapia, marble_goby, peacock_bass, speckled_temensis, giant_snakehead, red_snapper, golden_snapper, mangrove_jack, barramundi, red_drum, tenggiri, longfin_trevally, giant_trevally, diamond_trevally, hybrid_grouper, climbing_perch, ikan_keli, belida, arapaima, arowana, milkfish, queenfish, threadfin, white_pomfret, coral_trout, cobia, cooked_chicken, raw_chicken, egg, kaya_toast, chicken_rice, roti_prata, satay, nasi_lemak, meat_pie, fish_pie, laksa, seafood_stew, seafood_platter, burnt_fish.
Melee weapons — for EACH metal tier (bronze, iron, steel, mithril, adamant, rune, dragon): dagger, sword, scimitar, mace, longsword, battleaxe, warhammer, 2h_sword (e.g. rune_scimitar, dragon_2h_sword).
Armour — for EACH tier: med_helm, full_helm, chainbody, platebody, platelegs, sq_shield, kiteshield, gauntlets, boots. Plus wooden_shield, leather_body.
Ranged: shortbow, oak_shortbow, willow_shortbow, maple_shortbow, yew_shortbow, magic_shortbow; bronze_arrow, iron_arrow, steel_arrow, mithril_arrow, adamant_arrow, rune_arrow; coif, leather_chaps, studded_body, dragonhide_coif, dragonhide_body, dragonhide_chaps.
Magic: staff, magic_staff, mystic_staff, ancient_staff; air_rune, water_rune, earth_rune, fire_rune, mind_rune, chaos_rune, death_rune, blood_rune; wizard_hat, wizard_robe_top, wizard_robe_bottom, mystic_hat, mystic_top, mystic_bottom, occult_necklace.
Jewelry: amulet_of_power, amulet_of_strength, amulet_of_glory, gold_amulet, sapphire_amulet, emerald_amulet, ruby_amulet, diamond_amulet, merlion_amulet, merdeka_medallion, blessed_halo, djinn_lamp; gold_ring, sapphire_ring, emerald_ring, ruby_ring, diamond_ring, ring_of_kampong, ring_of_might, slayer_ring.
Capes: warlord_cape, fire_cape, revenant_cape, garuda_wings, trades_cape, champions_cape, shadow_cloak.
Granite gear: granite_helm, granite_body, granite_legs, granite_shield, kampong_gauntlets.
Unique/boss/quest rewards: merlion_blade, boar_tusk, worthy_sigil, tiger_fang, tiger_kris, leviathan_trident, hydra_leather, treant_shield, megalodon_jaw, phantom_robe, cursed_cutlass, champions_helm, island_aegis, slayer_helmet, seraph_blade, void_blade.
Treasure trails: clue_scroll_easy, clue_scroll_medium, clue_scroll_hard, reward_casket_easy, reward_casket_medium, reward_casket_hard.

OUTPUT FORMAT
- One transparent PNG per sprite, named EXACTLY by its id (lowercase_with_underscores, e.g. dragon_scimitar.png, dragon_kiln_wyrm.png, sister_mei.png).
- Also provide category sprite-sheet previews (grids) for review, but individual PNGs are the deliverable.
- Keep sizing/margins consistent within each category. Deliver as a zip with folders: /creatures, /bosses, /player, /npcs, /items.
- If you can’t do it all in one pass, go category by category in this order: items → creature archetypes → named monsters → bosses → player → townsfolk, and tell me where you stopped so I can say "continue".
```
