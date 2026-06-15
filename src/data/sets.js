// Armour set bonuses. Wearing every listed piece grants the bonus (added on top
// of each piece's own stats), rewarding committing to a full matched set.
export const ARMOUR_SETS = [
  { id: 'dragon', name: 'Dragon', pieces: ['dragon_full_helm', 'dragon_platebody', 'dragon_platelegs'], bonus: { attack: 6, strength: 8 } },
  { id: 'rune', name: 'Rune', pieces: ['rune_full_helm', 'rune_platebody', 'rune_platelegs'], bonus: { defence: 8, strength: 4 } },
  { id: 'mystic', name: 'Mystic', pieces: ['mystic_hat', 'mystic_top', 'mystic_bottom'], bonus: { magic: 8, magicStr: 2 } },
  { id: 'wizard', name: 'Wizard', pieces: ['wizard_hat', 'wizard_robe_top', 'wizard_robe_bottom'], bonus: { magic: 4 } },
  { id: 'dragonhide', name: 'Dragonhide', pieces: ['dragonhide_coif', 'dragonhide_body', 'dragonhide_chaps'], bonus: { ranged: 10 } },
];
