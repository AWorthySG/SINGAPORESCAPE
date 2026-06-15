// Skill definitions. Order here drives the Skills tab layout (RS-style grid).
export const SKILLS = [
  { id: 'attack', name: 'Attack', icon: '⚔️', color: '#9c2b1f', combat: true, startLevel: 5 },
  { id: 'hitpoints', name: 'Hitpoints', icon: '❤️', color: '#9c2b1f', combat: true, startLevel: 15 },
  { id: 'mining', name: 'Mining', icon: '⛏️', color: '#6f7a8a' },
  { id: 'strength', name: 'Strength', icon: '💪', color: '#1f7a3a', combat: true, startLevel: 5 },
  { id: 'defence', name: 'Defence', icon: '🛡️', color: '#2f6fdb', combat: true, startLevel: 5 },
  { id: 'ranged', name: 'Ranged', icon: '🏹', color: '#5a8a3a', combat: true },
  { id: 'magic', name: 'Magic', icon: '✨', color: '#5b6bd6', combat: true },
  { id: 'smithing', name: 'Smithing', icon: '🔨', color: '#8a6f4a' },
  { id: 'fishing', name: 'Fishing', icon: '🎣', color: '#3a8aa0' },
  { id: 'cooking', name: 'Cooking', icon: '🍳', color: '#9c5b1f' },
  { id: 'firemaking', name: 'Firemaking', icon: '🔥', color: '#d4761f' },
  { id: 'woodcutting', name: 'Woodcutting', icon: '🪓', color: '#5a8a3a' },
  { id: 'prayer', name: 'Prayer', icon: '🙏', color: '#d9c45a', combat: true },
  { id: 'thieving', name: 'Thieving', icon: '🤏', color: '#7a4a8a' },
  { id: 'agility', name: 'Agility', icon: '🏃', color: '#3a8a9a' },
  { id: 'slayer', name: 'Slayer', icon: '💀', color: '#5a5a5a' },
];

export const SKILL_IDS = SKILLS.map((s) => s.id);

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** Starting level for a skill (Hitpoints starts at 10, like RS). */
export function startLevel(skillId) {
  return SKILL_BY_ID[skillId]?.startLevel ?? 1;
}
