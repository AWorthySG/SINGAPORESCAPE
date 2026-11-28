import { formatNumber } from '../core/utils.js';
import { ISLAND_BY_ID, PHOTO_ASSIGNMENTS, islandPhotoArt } from '../data/islandlife.js';
import { levelProgress, maxLevelFor, xpToNext } from '../data/xp.js';
import { islandMarketDay } from '../game/islandlife.js';

export function islandProgressHTML(game, skill) {
  const xp = game.skills.xp[skill] ?? 0, cap = maxLevelFor(skill);
  const remaining = Math.ceil(xpToNext(xp, cap));
  const progress = Math.floor(100 * levelProgress(xp, cap));
  const title = remaining ? `${formatNumber(remaining)} XP to level ${game.skills.level(skill) + 1}` : 'Maximum level reached';
  return `<div class="island-level-progress"><span>${title}</span><progress value="${progress}" max="100" aria-label="${ISLAND_BY_ID[skill].name} level progress"></progress></div>`;
}

export function islandMarketHTML(game, currentSkill) {
  const { stops, completed, needed } = islandMarketDay(game);
  const earned = completed >= needed;
  const rows = stops.map(({ skill, task, done }) => {
    const name = ISLAND_BY_ID[skill].name;
    const action = !done && skill !== currentSkill
      ? `<button type="button" class="wm-go" data-island-market="${skill}" aria-label="Open ${name}">Open</button>` : '';
    return `<li><div><b>${name}${done ? ' · Done' : ''}</b><small>${task}</small></div>${action}</li>`;
  }).join('');
  return `<details class="island-market"><summary>Market day <span>${earned ? 'Keepsake earned' : `${completed} of ${needed}`}</span></summary>
    <p>Choose any ${needed} activities to earn a Kampong Glam print for your home album.</p><ul>${rows}</ul></details>`;
}

export function bindIslandMarket(body, openSkill) {
  for (const button of body.querySelectorAll('[data-island-market]')) {
    button.addEventListener('click', () => openSkill(button.dataset.islandMarket));
  }
}

export function islandMarketKeepsake(game) {
  const { completed, needed } = islandMarketDay(game);
  if (completed < needed) return '';
  const art = islandPhotoArt(PHOTO_ASSIGNMENTS.find(({ id }) => id === 'market'));
  return `<figure class="island-print"><img src="${art}" alt=""><figcaption>Market day keepsake</figcaption></figure>`;
}
