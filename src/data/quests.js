// Quest metadata for the journal UI. The quest *logic* (rewards, conditions) lives
// in game.js; this is the display layer + an optional progress(game) label so the
// journal renders generically and scales as the quest line grows.
export const QUESTS = [
  {
    id: 'bone_collector', name: 'A Bag of Bones',
    desc: 'Bring 10 bones to the Kampong Guide.',
    progress: (g) => g.quests.bone_collector.state === 'active' ? `${Math.min(g.inventory.count('bones'), 10)}/10 bones` : '',
  },
  {
    id: 'pest_control', name: 'Pest Control',
    desc: 'Slay 8 giant rats.',
    progress: (g) => g.quests.pest_control.state === 'active' ? `${g.quests.pest_control.kills}/8 rats` : '',
  },
  {
    id: 'pillars', name: 'Pillars of the Island',
    desc: 'Pray at the A-Worthy Monument & rest at the Hyco obelisk.',
    progress: (g) => { const q = g.quests.pillars; return q.state === 'active' ? `${(q.monument ? 1 : 0) + (q.obelisk ? 1 : 0)}/2 honoured` : ''; },
  },
  {
    id: 'smith_apprentice', name: "A Smith's Apprentice",
    desc: 'Forge and bring 8 steel bars to the Kampong Guide.',
    progress: (g) => g.quests.smith_apprentice.state === 'active' ? `${Math.min(g.inventory.count('steel_bar'), 8)}/8 bars` : '',
  },
  {
    id: 'island_defender', name: 'Island Defender',
    desc: 'Defeat 3 bosses to prove your might.',
    progress: (g) => { const q = g.quests.island_defender; return q.state === 'active' ? `${Math.min(g.bossKills - (q.startBoss || 0), 3)}/3 bosses` : ''; },
  },
];

export const QUEST_IDS = QUESTS.map((q) => q.id);
