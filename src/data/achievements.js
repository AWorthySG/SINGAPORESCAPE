// Achievement / collection-log definitions. Each has a test(game) predicate and
// an optional progress(game) label. Unlocks are tracked + persisted by the game.
import { SKILL_IDS } from './skills.js';

const own = (g, id) => g.inventory.count(id) > 0 || g.bank.count(id) > 0;
const coins = (g) => g.inventory.count('coins') + g.bank.count('coins');
const anyLvl = (g, n) => SKILL_IDS.some((id) => g.skills.level(id) >= n);
const questsDone = (g) => Object.values(g.quests).filter((q) => q && q.state === 'done').length;
const UNIQUES = ['merlion_blade', 'warlord_cape', 'merlion_amulet', 'boar_tusk', 'tiger_fang', 'leviathan_trident', 'garuda_wings', 'hydra_leather', 'treant_shield'];

export const ACHIEVEMENTS = [
  { id: 'first_blood', cat: 'Combat', name: 'First Blood', desc: 'Defeat your first monster.', test: (g) => g.totalKills >= 1, progress: (g) => `${Math.min(g.totalKills, 1)}/1` },
  { id: 'slayer_25', cat: 'Combat', name: 'Slayer', desc: 'Defeat 25 monsters.', test: (g) => g.totalKills >= 25, progress: (g) => `${Math.min(g.totalKills, 25)}/25` },
  { id: 'slayer_250', cat: 'Combat', name: 'Monster Hunter', desc: 'Defeat 250 monsters.', test: (g) => g.totalKills >= 250, progress: (g) => `${Math.min(g.totalKills, 250)}/250` },
  { id: 'boss_slayer', cat: 'Combat', name: 'Boss Slayer', desc: 'Defeat a boss.', test: (g) => g.bossKills >= 1, progress: (g) => `${Math.min(g.bossKills, 1)}/1` },
  { id: 'boss_hunter', cat: 'Combat', name: 'Boss Hunter', desc: 'Defeat 5 bosses.', test: (g) => g.bossKills >= 5, progress: (g) => `${Math.min(g.bossKills, 5)}/5` },
  { id: 'boss_master', cat: 'Combat', name: 'Boss Master', desc: 'Defeat 15 bosses.', test: (g) => g.bossKills >= 15, progress: (g) => `${Math.min(g.bossKills, 15)}/15` },
  { id: 'apprentice', cat: 'Skills', name: 'Apprentice', desc: 'Reach level 25 in any skill.', test: (g) => anyLvl(g, 25) },
  { id: 'expert', cat: 'Skills', name: 'Expert', desc: 'Reach level 50 in any skill.', test: (g) => anyLvl(g, 50) },
  { id: 'master', cat: 'Skills', name: 'Master', desc: 'Reach level 99 in any skill.', test: (g) => anyLvl(g, 99) },
  { id: 'renaissance', cat: 'Skills', name: 'Renaissance', desc: 'Reach 300 total level.', test: (g) => g.skills.totalLevel() >= 300, progress: (g) => `${g.skills.totalLevel()}/300` },
  { id: 'grandmaster', cat: 'Skills', name: 'Grandmaster', desc: 'Reach 600 total level.', test: (g) => g.skills.totalLevel() >= 600, progress: (g) => `${g.skills.totalLevel()}/600` },
  { id: 'pocket_money', cat: 'Wealth', name: 'Pocket Money', desc: 'Hold 1,000 coins.', test: (g) => coins(g) >= 1000 },
  { id: 'well_off', cat: 'Wealth', name: 'Well Off', desc: 'Hold 100,000 coins.', test: (g) => coins(g) >= 100000 },
  { id: 'millionaire', cat: 'Wealth', name: 'Millionaire', desc: 'Hold 1,000,000 coins.', test: (g) => coins(g) >= 1000000 },
  { id: 'wilderness', cat: 'Explore', name: 'Into the Wild', desc: 'Enter the Wilderness.', test: (g) => g.zonesVisited.has('The Wilderness') },
  { id: 'explorer', cat: 'Explore', name: 'Explorer', desc: 'Visit every region.', test: (g) => g.zonesVisited.size >= 6, progress: (g) => `${Math.min(g.zonesVisited.size, 6)}/6` },
  { id: 'helper', cat: 'Quests', name: 'Lend a Hand', desc: 'Complete a quest.', test: (g) => questsDone(g) >= 1 },
  { id: 'quester', cat: 'Quests', name: 'Quester', desc: 'Complete every quest.', test: (g) => questsDone(g) >= Object.keys(g.quests).length },
  { id: 'armed', cat: 'Collection', name: 'Armed and Ready', desc: 'Own a rune scimitar.', test: (g) => own(g, 'rune_scimitar') },
  { id: 'legendary', cat: 'Collection', name: 'Legendary Loot', desc: 'Own a boss unique item.', test: (g) => UNIQUES.some((id) => own(g, id)) },
];
