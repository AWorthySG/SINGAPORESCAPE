// Diving (gathering): dive the reefs off Sentosa, Pulau Ubin, Changi, Marina
// Bay and Coney Island, and from level 100 the far reefs, for shells, sea glass,
// coral, pearls and the odd sunken chest.
//
// A dive spot is worked like a fishing spot (it never runs dry, and auto gather
// works it), but you dive from the shore holding your breath: a dive lasts your
// breath in ticks, then you come up for air for SURFACE_TICKS (a short pause
// the hero's breath bar shows), then down you go again. Breath grows with your
// Diving level and with the gear you carry (DIVE_GEAR, a ladder like the
// pickaxes': the best piece you carry and can use is picked for you). You can
// free-dive with no gear at all, so the skill never looks broken to a new diver.
//
// The rules live in src/game/diving.js; objects.js, items.js and crafting.js
// build their entries from the tables here; divereefs.js places the reefs.

import { TOOL_TIERS } from './tooltiers.js';

export const DIVE_TAG = 'divegear';

// ---------------- Breath ----------------
// Ticks (600ms each) a dive lasts with no gear at level 1, one more for every
// BREATH_PER levels up to 99, then one more every BREATH_PER_PAST levels past 99
// (life skills keep growing towards 9999). Coming up for air takes SURFACE_TICKS.
export const BREATH_BASE = 8;
export const BREATH_PER = 10;
export const BREATH_PER_PAST = 100;
export const SURFACE_TICKS = 2;
/** Breath in ticks from your Diving level alone. */
export const levelBreath = (lvl = 1) => BREATH_BASE + Math.floor(Math.min(99, Math.max(1, lvl)) / BREATH_PER)
  + Math.floor(Math.max(0, lvl - 99) / BREATH_PER_PAST);
/** Breath in ticks at level `lvl` with dive gear of tier `tier` (-1: none). */
export const maxBreath = (lvl, tier = -1) => levelBreath(lvl) + (tier >= 0 ? DIVE_GEAR[tier].breath : 0);
/** The share of the time spent underwater gathering (the rest is surfacing). */
export const diveUptime = (breath) => breath / (breath + SURFACE_TICKS);

// ---------------- Gear ----------------
// One piece per tool tier (tooltiers.js: the same levels as the pickaxes and
// the same speed, double-yield and rare-find bonuses), plus `breath`: ticks
// added to every dive. The first five are sold at the Kampong General Store;
// the rest are crafted at a crafting table from that tier's bars and the coral
// or shell of the reef before it (`from`).
// [id, name, breath, examine, sticker it borrows until its own arrives, tint, craft input]
const GEAR = [
  ['snorkel', 'Snorkel', 1, 'A rubber snorkel. Breathe easy face-down in the shallows.', 'vial', 'hue-rotate(160deg) saturate(1.6)', null],
  ['dive_mask', 'Dive mask', 2, 'A glass dive mask: you can see the reef clearly now.', 'bronze_med_helm', 'hue-rotate(170deg) saturate(1.4) brightness(1.1)', null],
  ['swim_fins', 'Swim fins', 3, 'Bright yellow fins. Kick down to the reef in no time.', 'bronze_boots', 'sepia(1) saturate(4) hue-rotate(10deg) brightness(1.2)', null],
  ['wetsuit', 'Wetsuit', 4, 'A snug neoprene wetsuit that keeps the cold water off.', 'leather_body', 'grayscale(0.6) hue-rotate(180deg) brightness(0.8)', null],
  ['air_tank', 'Air tank', 5, 'A little air tank on a harness: a few more breaths below.', 'vial', 'grayscale(0.4) hue-rotate(190deg) brightness(0.9) saturate(2)', null],
  ['rebreather', 'Rebreather', 6, 'A coral-lined rebreather that makes every breath go further.', 'rune_full_helm', 'hue-rotate(150deg) saturate(1.3)', 'black_coral'],
  ['obsidian_dive_helm', 'Obsidian dive helm', 7, 'A dive helm of polished obsidian with a dragon-coral seal.', 'obsidian_full_helm', 'hue-rotate(160deg) saturate(1.2)', 'dragon_coral'],
  ['orichalcum_dive_suit', 'Orichalcum dive suit', 8, 'A coppery-gold dive suit, lined with abyssal nacre.', 'dragonhide_body', 'sepia(1) saturate(2.4) hue-rotate(-10deg)', 'abyssal_nacre'],
  ['jade_fins', 'Jade fins', 9, 'Fins of carved jade, light as a fish\'s tail.', 'jade_boots', 'hue-rotate(20deg) saturate(1.2)', 'moon_shell'],
  ['starmetal_rebreather', 'Starmetal rebreather', 10, 'A starmetal rebreather that hums with starlight.', 'starmetal_full_helm', 'hue-rotate(180deg) brightness(1.1)', 'star_coral'],
  ['celestial_dive_helm', 'Celestial dive helm', 11, 'A skyglass helm. Down below, it shines like the moon.', 'celestial_full_helm', 'hue-rotate(160deg) brightness(1.1)', 'rift_coral'],
  ['eternal_dive_suit', 'Eternal dive suit', 12, 'A dive suit of eternal gold. The sea itself makes way for you.', 'dragonhide_body', 'sepia(1) saturate(3.2) hue-rotate(5deg) brightness(1.15)', 'eternal_conch'],
];
export const DIVE_GEAR = GEAR.map(([id, name, breath, examine, art, tint, from], i) => ({
  id, name, breath, examine, artFrom: [art, tint], from, tier: i, level: TOOL_TIERS[i].level, metal: TOOL_TIERS[i].metal,
}));
export const DIVE_GEAR_BY_ID = Object.fromEntries(DIVE_GEAR.map((g) => [g.id, g]));
// The highest tier shops sell (snorkel to air tank, as the tools: bronze to adamant).
export const SHOP_DIVE_TIER = 4;

// ---------------- Pearls ----------------
// The grades, worst first. An oyster bed rolls `pearl.chance` a dive for a
// pearl, then picks its grade by the bed's weights (the deeper beds give the
// better grades).
export const PEARL_GRADES = ['seed_pearl', 'pearl', 'lustrous_pearl', 'golden_pearl', 'perfect_pearl'];

// ---------------- Dive spots ----------------
// [id, name, label, level, catch, xp, region, [x0, y0, x1, y1], colour, examine, extra]
// Each spot holds one catch, like a fishing spot. xp was fitted (measured, not
// guessed) so each spot pays about 1.08 times the average of the best rock and
// tree at its own level, an hour, with auto gather and the best gear for the
// level, the extras off: between Mining and Woodcutting and Fishing's quarter
// more. The jump at the cowrie reef follows the gold and gem rocks' at 40. Each
// pays more a dive than the one before it (tests/diving.test.mjs times them).
// `extra`: pearl { chance, w: weights over PEARL_GRADES }, chest (times the
// sunken-chest chance), night (more XP while the moon is up).
const SPOTS = [
  ['shell_shallows', 'Shell shallows', 'Shells', 1, 'seashell', 91, 'Sentosa Beach', [2, 85, 92, 103], '#f6c8a8',
    'Warm, clear shallows with shells scattered over the sand.'],
  ['sea_glass_cove', 'Sea glass cove', 'Sea glass', 12, 'sea_glass', 136, 'Sentosa Beach', [2, 85, 92, 103], '#9ee0d0',
    'Smooth green and blue sea glass glints between the rocks.'],
  ['oyster_bed', 'Oyster bed', 'Oysters', 20, 'oyster_shell', 189, 'Pulau Ubin', [161, 2, 227, 97], '#d8d0c0',
    'A bed of crusty oysters. Now and then one holds a pearl.', { pearl: { chance: 0.06, w: [70, 30, 0, 0, 0] } }],
  ['coral_garden', 'Coral garden', 'Coral', 32, 'coral_fragment', 240, 'Changi Coast', [232, 2, 297, 97], '#f49ab0',
    'Soft pink coral sways in the current. Broken bits wash loose.'],
  ['cowrie_reef', 'Cowrie reef', 'Cowries', 45, 'cowrie_shell', 560, 'Changi Coast', [232, 2, 297, 97], '#e8c890',
    'Glossy cowrie shells hide in the cracks of the reef.'],
  ['pearl_oyster_reef', 'Pearl oyster reef', 'Pearl oysters', 58, 'mother_of_pearl', 600, 'Marina Bay', [161, 102, 227, 197], '#e0e8f4',
    'Big pearl oysters, lined with shimmering mother-of-pearl.', { pearl: { chance: 0.08, w: [30, 50, 20, 0, 0] } }],
  ['sunken_junk', 'Sunken tongkang', 'Wreck', 70, 'sunken_trinket', 640, 'Marina Bay', [161, 102, 227, 197], '#b89a6a',
    'An old wooden tongkang rests on the seabed, trinkets spilled around it.', { chest: 3 }],
  ['black_coral_reef', 'Black coral reef', 'Black coral', 85, 'black_coral', 690, 'Coney Island', [302, 102, 396, 201], '#5a5a7a',
    'Deep water where rare black coral grows in slow, dark fans.'],
  // ---- Endgame reefs (Diving 100-300), in the far regions like the endgame fish ----
  ['dragon_coral_reef', 'Dragon coral reef', 'Dragon coral', 100, 'dragon_coral', 800, 'Southern Islands', [2, 206, 197, 277], '#f07a4a',
    'Fiery red coral, branched like a dragon\'s horns, round the Southern Islands.'],
  ['abyssal_pearl_bed', 'Abyssal pearl bed', 'Abyssal pearls', 130, 'abyssal_nacre', 1104, 'Tuas Docklands', [2, 282, 176, 376], '#7a8ad0',
    'Giant oysters in the deep channel past the docks.', { pearl: { chance: 0.08, w: [0, 40, 40, 18, 2] } }],
  ['moonlit_lagoon', 'Moonlit lagoon', 'Moon shells', 160, 'moon_shell', 1448, 'Punggol Waterway', [402, 2, 536, 87], '#d8dcf4',
    'A still lagoon where pale moon shells glow. Best dived by moonlight.', { night: true }],
  ['star_coral_trench', 'Star coral trench', 'Star coral', 200, 'star_coral', 1921, 'The Celestial Peaks', [364, 282, 536, 376], '#8a9af0',
    'Coral shaped like little stars, in a cold mountain trench.'],
  ['rift_reef', 'Rift reef', 'Rift coral', 250, 'rift_coral', 2861, 'The Shadow Rift', [202, 206, 396, 277], '#9a6ad0',
    'Coral that glows violet in the Rift\'s dark water.'],
  ['sunken_palace', 'Sunken palace', 'Palace', 300, 'eternal_conch', 3656, 'Temasek Ruins', [184, 282, 356, 376], '#f5c84a',
    'The drowned courtyard of an old island palace. Golden conches lie in the weed.', { pearl: { chance: 0.05, w: [0, 0, 30, 50, 20] }, chest: 2 }],
];
export const DIVE_SPOTS = SPOTS.map(([id, name, label, level, gives, xp, region, rect, color, examine, extra = {}]) => ({
  id, name, label, level, gives, xp, region, rect, color, examine, ...extra,
}));
export const DIVE_SPOT_BY_ID = Object.fromEntries(DIVE_SPOTS.map((s) => [s.id, s]));
// How many of each reef the world places, together on one stretch of shore.
export const DIVE_REEF_SIZE = 5;

// ---------------- The sunken chest ----------------
// About one dive in CHEST_RATE turns up a sunken chest (more with better gear's
// rare-find share, and at the wreck and the palace): coins by the reef's level,
// a gem, and a clue scroll if you aren't on a trail already.
export const CHEST_RATE = 400;
export const CHEST_GEMS = [{ id: 'sapphire', weight: 50 }, { id: 'emerald', weight: 28 }, { id: 'ruby', weight: 16 }, { id: 'diamond', weight: 6 }];
/** The clue tier a chest from a reef of level `lvl` holds. */
export const chestClue = (lvl) => (lvl >= 70 ? 'clue_scroll_hard' : lvl >= 30 ? 'clue_scroll_medium' : 'clue_scroll_easy');

// ---------------- Items ----------------
// Every catch, pearl and piece of gear. All borrow a sticker for now (`artFrom`:
// [sticker, tint], icons.js) until their own art arrives.
const CATCH_ART = {
  seashell: ['pearl', 'sepia(0.7) saturate(1.6) hue-rotate(-15deg) brightness(1.1)'],
  sea_glass: ['molten_glass', 'hue-rotate(110deg) saturate(1.4)'],
  oyster_shell: ['pearl', 'grayscale(0.8) brightness(0.95)'],
  coral_fragment: ['naga_scale', 'hue-rotate(170deg) saturate(1.6) brightness(1.2)'],
  cowrie_shell: ['pearl', 'sepia(1) saturate(2) brightness(1.05)'],
  mother_of_pearl: ['pearl', 'hue-rotate(180deg) saturate(0.6) brightness(1.15)'],
  sunken_trinket: ['ring_of_kampong', 'sepia(0.9) saturate(0.9) brightness(0.85)'],
  black_coral: ['naga_scale', 'grayscale(1) brightness(0.55)'],
  dragon_coral: ['phoenix_ember', 'hue-rotate(-10deg) saturate(1.3)'],
  abyssal_nacre: ['pearl', 'hue-rotate(210deg) saturate(2) brightness(0.9)'],
  moon_shell: ['pearl', 'grayscale(0.5) brightness(1.25)'],
  star_coral: ['naga_scale', 'hue-rotate(230deg) saturate(1.4) brightness(1.2)'],
  rift_coral: ['naga_scale', 'hue-rotate(270deg) saturate(1.6)'],
  eternal_conch: ['hornbill_casque', 'sepia(1) saturate(3) hue-rotate(5deg) brightness(1.2)'],
};
const CATCH_TEXT = {
  seashell: ['Seashell', 4, 'A pretty spiral shell from the shallows. Shops buy them; one day they might decorate a home.'],
  sea_glass: ['Sea glass', 9, 'Glass worn smooth and frosty by the sea.'],
  oyster_shell: ['Oyster shell', 15, 'A rough oyster shell, pearly inside.'],
  coral_fragment: ['Coral fragment', 24, 'A broken branch of pink coral that washed loose.'],
  cowrie_shell: ['Cowrie shell', 38, 'A glossy, speckled cowrie. Once used as money.'],
  mother_of_pearl: ['Mother-of-pearl', 60, 'A shimmering slice of nacre from a pearl oyster.'],
  sunken_trinket: ['Barnacled trinket', 95, 'A little brass trinket from an old wreck, crusted with barnacles.'],
  black_coral: ['Black coral', 150, 'A dark, glossy fan of rare black coral.'],
  dragon_coral: ['Dragon coral', 280, 'Fiery red coral, branched like a dragon\'s horns.'],
  abyssal_nacre: ['Abyssal nacre', 400, 'Deep-blue nacre from the giant oysters of the deep channel.'],
  moon_shell: ['Moon shell', 560, 'A pale shell that glows softly in the dark.'],
  star_coral: ['Star coral', 800, 'Coral that grows in little five-pointed stars.'],
  rift_coral: ['Rift coral', 1150, 'Violet coral from the Rift. It hums faintly.'],
  eternal_conch: ['Eternal conch', 1700, 'A golden conch from the sunken palace. Hold it up and you hear the sea of long ago.'],
};
const PEARL_ITEMS = {
  seed_pearl: ['Seed pearl', 150, 'A tiny pearl, no bigger than a grain of rice.', ['pearl', 'brightness(1.1) saturate(0.6)']],
  lustrous_pearl: ['Lustrous pearl', 2500, 'A big pearl with a deep, rainbow sheen.', ['pearl', 'hue-rotate(200deg) saturate(1.8) brightness(1.1)']],
  golden_pearl: ['Golden pearl', 9000, 'A rare golden pearl from the deep beds.', ['pearl', 'sepia(1) saturate(3) brightness(1.1)']],
  perfect_pearl: ['Perfect pearl', 40000, 'Flawless, round and glowing. Divers wait a lifetime for one.', ['pearl', 'brightness(1.2) saturate(1.3) contrast(1.1)']],
};
// Pearl jewellery (Crafting), magic-style like the pearl ring and amulet before
// them: [id, name, slot, power P (accessoryStats), value, Crafting level, xp, inputs, sticker, tint, examine].
// Its power steps up the magic ladder alongside the gem pieces of its band.
export const PEARL_JEWELLERY = [
  ['lustrous_pearl_ring', 'Lustrous pearl ring', 'ring', 5, 6000, 40, 115, [['silver_bar', 1], ['lustrous_pearl', 1]], 'pearl_ring', 'hue-rotate(200deg) saturate(1.5)',
    'A silver ring set with a lustrous pearl. Steadies a caster\'s hand.'],
  ['lustrous_pearl_amulet', 'Lustrous pearl amulet', 'amulet', 10, 9000, 50, 150, [['gold_bar', 1], ['lustrous_pearl', 1], ['seed_pearl', 4]], 'pearl_amulet', 'hue-rotate(200deg) saturate(1.5)',
    'A lustrous pearl on a string of seed pearls.'],
  ['golden_pearl_ring', 'Golden pearl ring', 'ring', 8, 22000, 68, 200, [['gold_bar', 1], ['golden_pearl', 1]], 'pearl_ring', 'sepia(1) saturate(2.6)',
    'A gold band crowned with a golden pearl.'],
  ['golden_pearl_amulet', 'Golden pearl amulet', 'amulet', 14, 30000, 78, 240, [['gold_bar', 1], ['golden_pearl', 2]], 'pearl_amulet', 'sepia(1) saturate(2.6)',
    'Two golden pearls on a gold chain. Spells come easier wearing it.'],
  ['perfect_pearl_amulet', 'Perfect pearl amulet', 'amulet', 20, 90000, 92, 320, [['gold_bar', 2], ['perfect_pearl', 1], ['diamond', 1]], 'pearl_amulet', 'brightness(1.2) saturate(1.4)',
    'A perfect pearl set over a diamond. The finest piece a pearl diver can make.'],
];

/** Every Diving item, for items.js (without the jewellery's stats: items.js adds those). */
export function diveItems() {
  const out = {};
  for (const [id, [name, value, examine]] of Object.entries(CATCH_TEXT)) {
    out[id] = { name, icon: '🐚', value, stackable: true, examine, artFrom: CATCH_ART[id] };
  }
  for (const [id, [name, value, examine, art]] of Object.entries(PEARL_ITEMS)) {
    out[id] = { name, icon: '🦪', value, stackable: true, examine, artFrom: art };
  }
  for (const g of DIVE_GEAR) {
    out[g.id] = { name: g.name, icon: '🤿', value: Math.round(25 * TOOL_TIERS[g.tier].value), tool: DIVE_TAG, diveTier: g.tier,
      toolLevel: g.level, toolSkill: 'diving', artFrom: g.artFrom,
      examine: `${g.examine} Diving ${g.level} to use; +${g.breath} breath${tierBonusText(g.tier)}. The best dive gear you carry is used for you.` };
  }
  return out;
}
function tierBonusText(i) {
  const T = TOOL_TIERS[i], bits = [];
  if (T.speed) bits.push(`+${T.speed}% speed`);
  if (T.yield) bits.push(`+${Math.round(T.yield * 100)}% double catches`);
  if (T.find) bits.push(`+${Math.round(T.find * 100)}% rare finds`);
  return bits.length ? `, ${bits.join(', ')}` : '';
}

/** Crafting recipes: the gear above the shop's tiers, and the pearl jewellery (crafting.js). */
export function diveCraftRecipes() {
  const out = [];
  for (const g of DIVE_GEAR) {
    if (!g.from) continue;
    out.push({ result: g.id, inputs: [{ id: `${g.metal}_bar`, qty: 2 }, { id: g.from, qty: 4 }], level: g.level + 3, xp: Math.round(40 + g.level * 2.2), tool: 'chisel', upgrade: true });
  }
  for (const [result, , , , , level, xp, inputs] of PEARL_JEWELLERY) {
    out.push({ result, inputs: inputs.map(([id, qty]) => ({ id, qty })), level, xp, tool: 'chisel' });
  }
  return out;
}
