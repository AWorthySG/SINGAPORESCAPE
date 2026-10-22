// Armour set bonuses. Wearing every listed piece grants the bonus (added on top
// of each piece's own stats), rewarding committing to a full matched set.
export const ARMOUR_SETS = [
  { id: 'dragon', name: 'Dragon', pieces: ['dragon_full_helm', 'dragon_platebody', 'dragon_platelegs'], bonus: { attack: 6, strength: 8 } },
  { id: 'rune', name: 'Rune', pieces: ['rune_full_helm', 'rune_platebody', 'rune_platelegs'], bonus: { defence: 8, strength: 4 } },
  { id: 'mystic', name: 'Mystic', pieces: ['mystic_hat', 'mystic_top', 'mystic_bottom'], bonus: { magic: 8, magicStr: 2 } },
  { id: 'wizard', name: 'Wizard', pieces: ['wizard_hat', 'wizard_robe_top', 'wizard_robe_bottom'], bonus: { magic: 4 } },
  { id: 'dragonhide', name: 'Dragonhide', pieces: ['dragonhide_coif', 'dragonhide_body', 'dragonhide_chaps'], bonus: { ranged: 10 } },
  { id: 'silk_dancer', name: 'Silk Dancer', pieces: ['silk_headdress', 'silk_dancer_top', 'silk_dancer_skirt'], bonus: { dance: 6 } },
  { id: 'starhide', name: 'Starhide', pieces: ['starhide_coif', 'starhide_body', 'starhide_chaps'], bonus: { ranged: 30 } },
  { id: 'eternalhide', name: 'Eternal Hide', pieces: ['eternalhide_coif', 'eternalhide_body', 'eternalhide_chaps'], bonus: { ranged: 70, defence: 20 } },
  { id: 'astral', name: 'Astral', pieces: ['astral_hat', 'astral_robe_top', 'astral_robe_bottom'], bonus: { magic: 30, magicStr: 6 } },
  { id: 'eternal_robes', name: 'Eternal Robes', pieces: ['eternal_hat', 'eternal_robe_top', 'eternal_robe_bottom'], bonus: { magic: 70, magicStr: 14 } },
  { id: 'jade_dancer', name: 'Jade Dancer', pieces: ['jade_headdress', 'jade_dancer_top', 'jade_dancer_skirt'], bonus: { dance: 40, defence: 12 } },
  { id: 'eternal_dancer', name: 'Eternal Dancer', pieces: ['eternal_headdress', 'eternal_dancer_top', 'eternal_dancer_skirt'], bonus: { dance: 90, defence: 30 } },
  { id: 'jade_plate', name: 'Jade', pieces: ['jade_full_helm', 'jade_platebody', 'jade_platelegs'], bonus: { defence: 30, strength: 15 } },
  { id: 'eternal_plate', name: 'Eternal', pieces: ['eternal_full_helm', 'eternal_platebody', 'eternal_platelegs'], bonus: { defence: 80, strength: 40, attack: 30 } },
  { id: 'golden_dancer', name: 'Golden Dancer', pieces: ['golden_headdress', 'golden_dancer_top', 'golden_dancer_skirt'], bonus: { dance: 18, defence: 6 } },
];
