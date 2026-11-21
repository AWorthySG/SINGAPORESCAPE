// Every boss has one interactive mechanic on top of its signature move and
// ground attacks: something the player has to *do* (src/game/bossmech.js runs
// them). Three kinds, spread across the bosses to fit each one's story:
//
//   circle               a huge area attack where only a green circle is safe
//   adds    { id, n }    small healers that mend the boss until you kill them
//   cast                 a long cast bar: any skill or special attack interrupts it
//
// No mechanic stuns, roots or throws you about: the owner asked for that gone.
// Nor does any boss shield itself (the old style shields soaked your blows to
// nothing until broken): the owner asked for boss shielding gone too.

export const MECH_KINDS = {
  circle: { name: 'Safe circle', icon: '◎' },
  adds: { name: 'Healing adds', icon: '✚' },
  cast: { name: 'Interruptible cast', icon: '⏳' },
};

export const BOSS_MECHANICS = {
  boar_king: { type: 'circle', name: 'Stampede Dust' },
  goblin_warchief: { type: 'adds', name: 'Goblin Medics', id: 'goblin', n: 2 },
  macaque_alpha: { type: 'adds', name: 'Snack Runners', id: 'macaque', n: 2 },
  reservoir_serpent: { type: 'cast', name: 'Tidal Coil' },
  chilli_crab: { type: 'circle', name: 'Sauce Flood' },
  spider_queen: { type: 'adds', name: 'Brood Nurses', id: 'jungle_spider', n: 2 },
  ancient_tembusu: { type: 'cast', name: 'Ironbark Groan' },
  merlion: { type: 'circle', name: 'Great Wave' },
  timah_drake: { type: 'circle', name: 'Granite Hail' },
  bandit_kingpin: { type: 'cast', name: 'Bounty Mark' },
  bone_colossus: { type: 'adds', name: 'Bone Menders', id: 'skeleton', n: 2 },
  molten_golem: { type: 'circle', name: 'Magma Eruption' },
  sentosa_kraken: { type: 'circle', name: 'Whirlpool' },
  demon_lord: { type: 'cast', name: 'Hellgate' },
  wilderness_warlord: { type: 'cast', name: 'Execution' },
  sand_scorpion_king: { type: 'circle', name: 'Sandstorm' },
  durian_behemoth: { type: 'circle', name: 'Durian Rain' },
  bedok_bandit_lord: { type: 'cast', name: 'Smoke Ambush' },
  hungry_ghost_king: { type: 'adds', name: 'Offering Spirits', id: 'wraith', n: 2 },
  night_safari_tiger: { type: 'cast', name: 'Killing Leap' },
  mangrove_hydra: { type: 'adds', name: 'Regrowth Buds', id: 'swamp_slime', n: 3 },
  tualang_treant: { type: 'adds', name: 'Honey Bees', id: 'wild_hornet', n: 3 },
  coral_leviathan: { type: 'cast', name: 'Reef Crush' },
  the_garuda: { type: 'circle', name: 'Cyclone' },
  rune_golem: { type: 'cast', name: 'Rune Overload' },
  sentosa_megalodon: { type: 'circle', name: 'Feeding Frenzy' },
  changi_phantom: { type: 'cast', name: 'Soul Rend' },
  pulau_hantu_djinn: { type: 'adds', name: 'Wish Servants', id: 'imp', n: 2 },
  bukit_brown_revenant: { type: 'adds', name: 'Grave Keepers', id: 'pocong', n: 2 },
  dragon_kiln_wyrm: { type: 'circle', name: 'Kiln Firestorm' },
  orang_minyak: { type: 'cast', name: 'Black Oil Curse' },
  lion_of_light: { type: 'cast', name: 'Dawn Judgement' },
  shadow_sovereign: { type: 'cast', name: 'Umbral Night' },
  supertree_guardian: { type: 'adds', name: 'Sunlight Fireflies', id: 'kunang_kunang', n: 3 },
  coney_behemoth: { type: 'circle', name: 'Earthquake Stampede' },
  kusu_tortoise: { type: 'circle', name: 'Shell Quake' },
  rift_tyrant: { type: 'cast', name: 'Rift Collapse' },
  eternal_wyrm: { type: 'circle', name: 'Sky Inferno' },
  kranji_buffalo_king: { type: 'cast', name: 'Thunder Charge' },
  punggol_lantern_spirit: { type: 'adds', name: 'Lantern Wisps', id: 'will_o_wisp', n: 3 },
  harimau_jadian: { type: 'cast', name: 'Were-Roar' },
  bunian_queen: { type: 'adds', name: 'Bunian Healers', id: 'bunian', n: 2 },
  tuas_crane_colossus: { type: 'circle', name: 'Falling Girders' },
  drowned_admiral: { type: 'circle', name: 'Full Broadside' },
  singa_of_temasek: { type: 'cast', name: 'Lion\'s Judgement' },
  spirit_of_badang: { type: 'circle', name: 'Boulder Rain' },
  celestial_garuda: { type: 'circle', name: 'Sunfall' },
  jade_dragon: { type: 'cast', name: 'Heaven\'s Verdict' },
  nian_beast: { type: 'circle', name: 'Firework Barrage' },
  kelong_king_crab: { type: 'circle', name: 'Tide Crash' },
  langsuir_matriarch: { type: 'cast', name: 'Death Wail' },
  shadow_panther: { type: 'cast', name: 'Night Strike' },
  abyssal_oarfish: { type: 'cast', name: 'Abyssal Omen' },
  jenglot_sovereign: { type: 'adds', name: 'Blood Kin', id: 'jenglot', n: 2 },
  ubin_stone_frog: { type: 'adds', name: 'Quarry Froglets', id: 'bullfrog', n: 2 },
  buaya_putih: { type: 'circle', name: 'Mud Flood' },
  hantu_tinggi: { type: 'cast', name: 'Looming Dread' },
  // The bestiary expansion (bestiary.js): six or seven of each kind.
  toman_tyrant: { type: 'circle', name: 'Swamp Thrash' },
  ubin_quarry_python: { type: 'circle', name: 'Rockslide' },
  kopitiam_roach_queen: { type: 'adds', name: 'Roach Brood', id: 'kopitiam_cockroach', n: 3 },
  bakau_mud_lobster: { type: 'adds', name: 'Fiddler Diggers', id: 'fiddler_crab', n: 2 },
  strangler_fig_mother: { type: 'adds', name: 'Fig Seedlings', id: 'strangler_fig', n: 2 },
  kranji_bullfrog_emperor: { type: 'adds', name: 'Tadpole Choir', id: 'bullfrog', n: 3 },
  sea_eagle_sovereign: { type: 'circle', name: 'Shadow of Wings' },
  slag_titan: { type: 'cast', name: 'Furnace Pour' },
  arowana_emperor: { type: 'cast', name: 'Golden Gleam' },
  toyol_kingpin: { type: 'adds', name: 'Coin Runners', id: 'toyol', n: 3 },
  atlas_moth_empress: { type: 'circle', name: 'Scale-Dust Storm' },
  jembalang_lord: { type: 'cast', name: 'Claim the Ground' },
  krait_matriarch: { type: 'adds', name: 'Krait Brood', id: 'banded_krait', n: 2 },
  duyung_queen: { type: 'circle', name: 'Siren Tide' },
  great_argus_monarch: { type: 'cast', name: 'Courtship Dance' },
  typhoon_mother: { type: 'circle', name: 'Eye of the Storm' },
  void_eel_leviathan: { type: 'cast', name: 'Starlight Discharge' },
  todak_king: { type: 'cast', name: 'Swordbill Charge' },
  jade_moon_hare: { type: 'cast', name: 'Elixir of the Moon' },
  fenghuang: { type: 'circle', name: 'Rebirth Blaze' },
};

/** How the mechanic plays, in plain words for the Monster Codex. */
export function mechanicHowTo(m) {
  if (!m) return '';
  switch (m.type) {
    case 'circle':
      return 'It marks the whole ground round you in red with one small green circle. Stand in the green circle before it lands '
        + '(auto battle\'s "Dodge boss attacks" walks you there). Anywhere else in the red takes a heavy hit.';
    case 'adds':
      return `It calls ${m.n} small healers that link to it with a green beam and mend it every few seconds. `
        + 'Kill them quickly (auto battle switches to them) or the boss wins back part of its life.';
    case 'cast':
      return 'It stops attacking to charge a long cast, shown by a bar over its head. Use any skill or a special attack '
        + 'before the bar fills to interrupt it and stagger the boss; otherwise a heavy blow lands (it never takes more than about a third of your life).';
    default: return '';
  }
}
