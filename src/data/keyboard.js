// The keyboard guide and Compendium share these labels and keycaps.
const panels = [
  ['1', 'inventory', 'Bag'], ['2', 'skills', 'Skills'], ['3', 'combat', 'Combat'],
  ['4', 'quests', 'Quest Journal'], ['5', 'settings', 'Settings'],
  ['6', 'equipment', 'Worn Equipment'], ['7', 'prayer', 'Blessings'],
  ['8', 'stats', 'Final Stats'], ['9', 'story', 'Story'], ['0', 'achievements', 'Achievements'],
];

export const PANEL_SHORTCUTS = Object.fromEntries(panels.map(([key, view]) => [view, key]));
export const ABILITY_KEYS = ['z', 'x', 'c', 'v', 'b'];

export const KEYBOARD_GROUPS = [
  ['Navigation', [
    ['Move', 'W A S D', 'Arrow keys'], ['Search commands', '/', 'Ctrl / ⌘ + K'],
    ['Open or fold the side panel', 'I'], ['Open world map', 'M'],
    ['Close the top window', 'Esc'], ['Take a postcard', 'O'],
  ]],
  ['Panels', panels.map(([key, , label]) => [label, key])],
  ['Combat', [
    ['Attack nearest enemy', 'G'], ['Next enemy (while focused on the world)', 'Tab'],
    ['Use food or healing potion', 'F'], ['Toggle special attack', 'Q'],
    ['Faith Burst', 'L'], ['Abilities', ...ABILITY_KEYS.map((key) => key.toUpperCase())],
  ]],
  ['Quick actions', [
    ['Interact with the nearest target', 'E', 'Space'],
    ['Go to the nearest bank', 'Shift+E', 'N'], ['Go to the next quest step', 'Shift+Q', 'J'],
    ['Open Life skills', 'Shift+G'], ['Toggle auto battle', 'T'], ['Toggle auto gather', 'Y'],
    ['Toggle auto quest', 'U'], ['Custom quick bar slots', 'Shift+1–6'],
    ['Teleport to Kampong Glam', 'K'], ['Teleport to your gravestone', 'R'],
    ['Pickpocket', 'P'], ['Hire a mercenary (Merchant)', 'H'], ['Show keyboard controls', '?'],
  ]],
  ['Shop and Offering Shrine', [
    ['Point at an item to select a quantity', '1', '5', 'X (10)', 'A (all)'],
  ]],
];
