// Quest metadata for the journal UI. The quest *logic* (rewards, conditions) lives
// in game.js; this is the display layer + an optional progress(game) label so the
// journal renders generically and scales as the quest line grows.
import { LIFE_STAGES } from './lifeskills.js';

export const QUESTS = [
  {
    id: 'life_skills', name: 'Trades of the Island',
    desc: 'Learn each of the island\'s life skills, one lesson at a time, with Cikgu Surya.',
    progress: (g) => {
      const q = g.quests.life_skills;
      if (q.state !== 'active') return '';
      const st = LIFE_STAGES[q.stage - 1];
      if (!st) return '';
      let have, need;
      if (st.need.item) { have = g.inventory.count(st.need.item); need = st.need.qty; }
      else { have = Math.floor((g.skills.xp[st.skill] || 0) - (q.base || 0)); need = st.need.xp; }
      return `Lesson ${q.stage}/${LIFE_STAGES.length}: ${st.name} — ${Math.min(Math.max(have, 0), need)}/${need}${st.need.xp ? ' xp' : ''}`;
    },
  },
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
  {
    id: 'big_game_hunter', name: 'Big Game Hunter',
    desc: 'Defeat 50 creatures across the island.',
    progress: (g) => { const q = g.quests.big_game_hunter; return q.state === 'active' ? `${Math.min(g.totalKills - (q.startKills || 0), 50)}/50 slain` : ''; },
  },
  {
    id: 'mystic_trial', name: "The Mystic's Trial",
    desc: 'Bring 25 death runes to the Kampong Guide.',
    progress: (g) => g.quests.mystic_trial.state === 'active' ? `${Math.min(g.inventory.count('death_rune'), 25)}/25 death runes` : '',
  },
  {
    id: 'island_provisions', name: 'Island Provisions',
    desc: 'Bring 10 cooked salmon to the Kampong Guide.',
    progress: (g) => g.quests.island_provisions.state === 'active' ? `${Math.min(g.inventory.count('salmon'), 10)}/10 salmon` : '',
  },
];

export const QUEST_IDS = QUESTS.map((q) => q.id);
