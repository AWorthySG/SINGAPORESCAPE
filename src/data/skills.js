// Skill definitions. Order here drives the Skills tab layout (RS-style grid).
export const SKILLS = [
  { id: 'attack', name: 'Attack', icon: '⚔️', color: '#9c2b1f', combat: true, startLevel: 15,
    group: 'combat', desc: 'Melee accuracy. Train it fighting in the Accurate style.' },
  { id: 'hitpoints', name: 'Hitpoints', icon: '❤️', color: '#9c2b1f', combat: true, startLevel: 25,
    group: 'combat', desc: 'Your life. Rises as you deal damage; eat food to heal.' },
  { id: 'mining', name: 'Mining', icon: '⛏️', color: '#6f7a8a',
    group: 'gathering', desc: 'Mine rocks for ore and gems. Needs a pickaxe.' },
  { id: 'strength', name: 'Strength', icon: '💪', color: '#1f7a3a', combat: true, startLevel: 15,
    group: 'combat', desc: 'How hard your melee hits land. Train it in the Aggressive style.' },
  { id: 'defence', name: 'Defence', icon: '🛡️', color: '#2f6fdb', combat: true, startLevel: 12,
    group: 'combat', desc: 'Shrugs off hits and lets you wear tougher armour. Train it in the Defensive style.' },
  { id: 'ranged', name: 'Ranged', icon: '🏹', color: '#5a8a3a', combat: true,
    group: 'combat', desc: 'Bow accuracy and damage. Train it by shooting with a bow.' },
  { id: 'magic', name: 'Magic', icon: '✨', color: '#5b6bd6', combat: true,
    group: 'combat', desc: 'Spell power and new spells. Train it by casting with a staff.' },
  { id: 'smithing', name: 'Smithing', icon: '🔨', color: '#8a6f4a',
    group: 'making', desc: 'Smelt ore into bars at a furnace, then hammer gear at an anvil.' },
  { id: 'crafting', name: 'Crafting', icon: '💍', color: '#a86fd0',
    group: 'making', desc: 'Make pottery and jewellery at the crafting table.' },
  { id: 'fishing', name: 'Fishing', icon: '🎣', color: '#3a8aa0',
    group: 'gathering', desc: 'Catch fish at fishing spots by the water.' },
  { id: 'cooking', name: 'Cooking', icon: '🍳', color: '#9c5b1f',
    group: 'making', desc: 'Cook raw food on a fire or range so it heals you.' },
  { id: 'firemaking', name: 'Firemaking', icon: '🔥', color: '#d4761f',
    group: 'making', desc: 'Light logs with a tinderbox to make fires.' },
  { id: 'woodcutting', name: 'Woodcutting', icon: '🪓', color: '#5a8a3a',
    group: 'gathering', desc: 'Chop trees for logs. Needs an axe.' },
  { id: 'prayer', name: 'Prayer', icon: '🙏', color: '#d9c45a', combat: true,
    group: 'combat', desc: 'Unlocks prayers that boost you in a fight. Train it by burying bones.' },
  { id: 'thieving', name: 'Thieving', icon: '🤏', color: '#7a4a8a',
    group: 'other', desc: 'Pickpocket townsfolk and steal from market stalls.' },
  { id: 'agility', name: 'Agility', icon: '🏃', color: '#3a8a9a',
    group: 'other', desc: 'Run obstacle courses; higher levels refill run energy faster.' },
  { id: 'slayer', name: 'Slayer', icon: '💀', color: '#5a5a5a',
    group: 'combat', desc: 'Hunt monsters on tasks from Slayer Master Rajan.' },
];

// Skills panel sections, in display order.
export const SKILL_GROUPS = [
  { id: 'combat', name: 'Combat' },
  { id: 'gathering', name: 'Gathering' },
  { id: 'making', name: 'Making' },
  { id: 'other', name: 'Other' },
];

export const SKILL_IDS = SKILLS.map((s) => s.id);

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** Starting level for a skill (Hitpoints starts at 10, like RS). */
export function startLevel(skillId) {
  return SKILL_BY_ID[skillId]?.startLevel ?? 1;
}
