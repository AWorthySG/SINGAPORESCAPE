// Every boss has one interactive mechanic on top of its signature move and
// ground attacks: something the player has to *do* (src/game/bossmech.js runs
// them). Four kinds, spread across the bosses to fit each one's story:
//
//   shield  { styles }   a shield only one combat style breaks (cycles through
//                        `styles`); its colour and badge show which
//   circle               a huge area attack where only a green circle is safe
//   adds    { id, n }    small healers that mend the boss until you kill them
//   cast                 a long cast bar: any skill or special attack interrupts it
//
// No mechanic stuns, roots or throws you about: the owner asked for that gone.

export const MECH_STYLES = {
  melee: { name: 'melee', label: 'Melee', color: '#e04a3a', how: 'swords, axes, claws and other close-up weapons' },
  ranged: { name: 'ranged', label: 'Ranged', color: '#3f9a3a', how: 'bows, guns and thrown weapons' },
  magic: { name: 'magic', label: 'Magic', color: '#6a5ae8', how: 'staves and spells' },
};

export const MECH_KINDS = {
  shield: { name: 'Style shield', icon: '🛡' },
  circle: { name: 'Safe circle', icon: '◎' },
  adds: { name: 'Healing adds', icon: '✚' },
  cast: { name: 'Interruptible cast', icon: '⏳' },
};

export const BOSS_MECHANICS = {
  boar_king: { type: 'circle', name: 'Stampede Dust' },
  goblin_warchief: { type: 'adds', name: 'Goblin Medics', id: 'goblin', n: 2 },
  macaque_alpha: { type: 'adds', name: 'Snack Runners', id: 'macaque', n: 2 },
  reservoir_serpent: { type: 'cast', name: 'Tidal Coil' },
  chilli_crab: { type: 'shield', name: 'Chilli Shell', styles: ['melee'] },
  spider_queen: { type: 'adds', name: 'Brood Nurses', id: 'jungle_spider', n: 2 },
  ancient_tembusu: { type: 'shield', name: 'Ironbark', styles: ['magic'] },
  merlion: { type: 'circle', name: 'Great Wave' },
  timah_drake: { type: 'shield', name: 'Granite Plates', styles: ['melee'] },
  bandit_kingpin: { type: 'cast', name: 'Bounty Mark' },
  bone_colossus: { type: 'adds', name: 'Bone Menders', id: 'skeleton', n: 2 },
  molten_golem: { type: 'shield', name: 'Cooling Crust', styles: ['magic'] },
  sentosa_kraken: { type: 'circle', name: 'Whirlpool' },
  demon_lord: { type: 'cast', name: 'Hellgate' },
  wilderness_warlord: { type: 'cast', name: 'Execution' },
  sand_scorpion_king: { type: 'circle', name: 'Sandstorm' },
  durian_behemoth: { type: 'shield', name: 'Spiked Husk', styles: ['ranged'] },
  bedok_bandit_lord: { type: 'cast', name: 'Smoke Ambush' },
  hungry_ghost_king: { type: 'adds', name: 'Offering Spirits', id: 'wraith', n: 2 },
  night_safari_tiger: { type: 'cast', name: 'Killing Leap' },
  mangrove_hydra: { type: 'adds', name: 'Regrowth Buds', id: 'swamp_slime', n: 3 },
  tualang_treant: { type: 'adds', name: 'Honey Bees', id: 'wild_hornet', n: 3 },
  coral_leviathan: { type: 'shield', name: 'Coral Carapace', styles: ['melee'] },
  the_garuda: { type: 'circle', name: 'Cyclone' },
  rune_golem: { type: 'shield', name: 'Rune Ward', styles: ['ranged'] },
  sentosa_megalodon: { type: 'circle', name: 'Feeding Frenzy' },
  changi_phantom: { type: 'cast', name: 'Soul Rend' },
  pulau_hantu_djinn: { type: 'adds', name: 'Wish Servants', id: 'imp', n: 2 },
  bukit_brown_revenant: { type: 'adds', name: 'Grave Keepers', id: 'pocong', n: 2 },
  dragon_kiln_wyrm: { type: 'circle', name: 'Kiln Firestorm' },
  orang_minyak: { type: 'cast', name: 'Black Oil Curse' },
  lion_of_light: { type: 'shield', name: 'Halo of Dawn', styles: ['ranged'] },
  shadow_sovereign: { type: 'shield', name: 'Umbral Veil', styles: ['ranged'] },
  supertree_guardian: { type: 'adds', name: 'Sunlight Fireflies', id: 'kunang_kunang', n: 3 },
  coney_behemoth: { type: 'circle', name: 'Earthquake Stampede' },
  kusu_tortoise: { type: 'shield', name: 'Jade Shell', styles: ['magic'] },
  rift_tyrant: { type: 'cast', name: 'Rift Collapse' },
  eternal_wyrm: { type: 'circle', name: 'Sky Inferno' },
  kranji_buffalo_king: { type: 'cast', name: 'Thunder Charge' },
  punggol_lantern_spirit: { type: 'adds', name: 'Lantern Wisps', id: 'will_o_wisp', n: 3 },
  harimau_jadian: { type: 'cast', name: 'Were-Roar' },
  bunian_queen: { type: 'adds', name: 'Bunian Healers', id: 'bunian', n: 2 },
  tuas_crane_colossus: { type: 'shield', name: 'Steel Plating', styles: ['melee'] },
  drowned_admiral: { type: 'circle', name: 'Full Broadside' },
  singa_of_temasek: { type: 'cast', name: 'Lion\'s Judgement' },
  spirit_of_badang: { type: 'circle', name: 'Boulder Rain' },
  celestial_garuda: { type: 'circle', name: 'Sunfall' },
  jade_dragon: { type: 'shield', name: 'Jade Aegis', styles: ['melee', 'ranged', 'magic'] },
  nian_beast: { type: 'circle', name: 'Firework Barrage' },
  kelong_king_crab: { type: 'shield', name: 'Barnacle Shell', styles: ['melee'] },
  langsuir_matriarch: { type: 'cast', name: 'Death Wail' },
  shadow_panther: { type: 'cast', name: 'Night Strike' },
  abyssal_oarfish: { type: 'shield', name: 'Silver Scales', styles: ['magic'] },
  jenglot_sovereign: { type: 'adds', name: 'Blood Kin', id: 'jenglot', n: 2 },
  ubin_stone_frog: { type: 'shield', name: 'Granite Hide', styles: ['magic'] },
  buaya_putih: { type: 'circle', name: 'Mud Flood' },
  hantu_tinggi: { type: 'cast', name: 'Looming Dread' },
};

/** How the mechanic plays, in plain words for the Monster Codex. */
export function mechanicHowTo(m) {
  if (!m) return '';
  switch (m.type) {
    case 'shield': {
      const st = m.styles.map((s) => MECH_STYLES[s].name);
      const which = st.length > 1 ? `one style at a time (${st.join(', then ')})` : `${st[0]} attacks`;
      return `Every so often it raises a coloured shield that only ${which} can break: the badge and colour show which. `
        + 'While it is up the boss takes no damage; the right style cracks it four times faster than the others. '
        + 'Break it and the boss is exposed, taking extra damage for a few seconds. Leave it and the shield bursts, '
        + 'hurting you and mending the boss a little.';
    }
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
